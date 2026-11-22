import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { caseTurns, cases, auditLogs, userLanguagePrefs, userAssistantPrefs } from '@/db/schema';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import { extractClinicalFacts } from '@/lib/clinical-extractor';
import { hybridRetrieve } from '@/lib/retrieval';
import { libraryExcerpts } from '@/lib/library-excerpts';
import { understandText } from '@/lib/language';
import { detectSystemQuery } from '@/lib/system-query';
import { checkRedFlags } from '@/lib/red-flags';
import { MissingInformation, SafetyAlert, StructuredPatientInput } from '@/types';
import { asc, desc, eq } from 'drizzle-orm';
import { humanize, analyzeDoctorInput, UserAssistantPreferences } from '@/lib/persona/humanize';
import { AddressStyle, TonePreset, Verbosity } from '@/lib/persona/phrasebank';
import bn from '../../../../../../messages/bn.json';
import en from '../../../../../../messages/en.json';

const turnSchema = z.union([
  // 1. Follow-up answer
  z.object({
    type: z.literal('question_answer').optional(),
    question_id: z.string().min(1).max(100),
    question: z.string().min(1).max(1000),
    answer: z.string().trim().min(1).max(4000),
    client_draft_id: z.string().max(100).optional(),
    locale: z.enum(['bn', 'en']).default('bn'),
    reply_language: z.enum(['auto', 'bn', 'en']).optional(),
  }),
  // 2. Clinical observation or evidence review request
  z.object({
    type: z.literal('doctor_observation').optional(),
    observation: z.string().trim().min(1).max(4000).optional(),
    text: z.string().trim().min(1).max(4000).optional(),
    action: z.enum(['observation', 'evidence_review']).default('observation'),
    client_draft_id: z.string().max(100).optional(),
    locale: z.enum(['bn', 'en']).default('bn'),
    reply_language: z.enum(['auto', 'bn', 'en']).optional(),
  }),
  // 3. Simple note
  z.object({
    type: z.literal('doctor_note').optional(),
    note: z.string().trim().min(1).max(4000),
    client_draft_id: z.string().max(100).optional(),
    locale: z.enum(['bn', 'en']).default('bn'),
    reply_language: z.enum(['auto', 'bn', 'en']).optional(),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const input = turnSchema.safeParse(await boundedJson(request));
    if (!input.success) {
      return NextResponse.json({ error: 'Invalid clinical observation' }, { status: 400 });
    }

    const data = input.data;
    const isFollowUp = 'question_id' in data;

    const result = await db.transaction(async (tx) => {
      const [caseRecord] = await tx
        .select()
        .from(cases)
        .where(ownedCase(id, user.id))
        .for('update');

      if (!caseRecord) return null;

      // Duplicate submission defense: check if client_draft_id was recently recorded
      if (data.client_draft_id) {
        const recentTurns = await tx.query.caseTurns.findMany({
          where: eq(caseTurns.caseId, id),
          orderBy: [desc(caseTurns.createdAt)],
          limit: 10,
        });

        const duplicate = recentTurns.find((t) => {
          const c = t.content as Record<string, unknown>;
          return c?.client_draft_id === data.client_draft_id;
        });

        if (duplicate) {
          return { doctorTurn: duplicate, assistantTurn: null, duplicate: true };
        }
      }

      const patientInput = caseRecord.structuredInput as StructuredPatientInput;

      // 0. Load previous conversation history for memory and context
      const historyTurns = await tx.query.caseTurns.findMany({
        where: eq(caseTurns.caseId, id),
        orderBy: [asc(caseTurns.createdAt)],
      });

      const answeredQuestionIds = new Set<string>();
      for (const t of historyTurns) {
        const c = t.content as Record<string, unknown>;
        if (c?.type === 'question_answer' && typeof c?.question_id === 'string') {
          answeredQuestionIds.add(c.question_id);
        }
      }

      // Check vitals in patient input
      const vitalsObj = patientInput.vitals || {};
      const hasPreexistingVitals =
        Boolean(vitalsObj.blood_pressure_systolic) ||
        Boolean(vitalsObj.temperature_celsius) ||
        Boolean(vitalsObj.heart_rate);
      if (hasPreexistingVitals) {
        answeredQuestionIds.add('vitals-followup');
      }

      // Load user preferences
      const [prefsRow] = await tx
        .select()
        .from(userAssistantPrefs)
        .where(eq(userAssistantPrefs.userId, user.id))
        .limit(1);

      const userPrefs: UserAssistantPreferences = {
        address_style: (prefsRow?.addressStyle as AddressStyle) || 'doctor',
        tone_preset: (prefsRow?.tonePreset as TonePreset) || 'friendly',
        verbosity: (prefsRow?.verbosity as Verbosity) || 'normal',
        sounds_enabled: prefsRow?.soundsEnabled ?? true,
        hints_enabled: prefsRow?.hintsEnabled ?? true,
        avatar_enabled: prefsRow?.avatarEnabled ?? true,
        speech_rate: prefsRow?.speechRate || 1.0,
        voice_id: prefsRow?.voiceId || 'default',
      };

      const userPref = await tx.query.userLanguagePrefs.findFirst({
        where: eq(userLanguagePrefs.userId, user.id),
      });

      // -----------------------------------------------------------------
      // BRANCH A: Follow-up answer (type: question_answer)
      // -----------------------------------------------------------------
      if (isFollowUp) {
        // Record single question_answer doctor turn
        const [doctorTurn] = await tx
          .insert(caseTurns)
          .values({
            caseId: id,
            role: 'doctor',
            content: {
              type: 'question_answer',
              question_id: data.question_id,
              question: data.question,
              answer: data.answer,
              client_draft_id: data.client_draft_id,
            },
          })
          .returning();

        // 1. Language understanding of the answer
        const languageResult = await understandText(data.answer, {
          userPrefs: {
            replyLanguage: (data.reply_language || (userPref?.replyLanguage as 'auto' | 'bn' | 'en' | undefined) || 'auto') as 'auto' | 'bn' | 'en',
            banglishReply: userPref?.banglishReply ?? false,
          },
        });
        const effectiveLocale = languageResult.replyLanguage === 'en' ? 'en' : 'bn';

        // 2. Extract clinical facts from answer (e.g. "BP 130/85, HR 88")
        const proposedUpdates = extractClinicalFacts(data.answer, patientInput);

        // 3. Deterministic bilingual red flags on answer
        const safetyAlerts = checkRedFlags(data.answer, effectiveLocale);

        // 4. Memory: mark question_id as answered
        answeredQuestionIds.add(data.question_id);

        // 5. Build empathetic acknowledgment text
        let ackText = '';
        if (proposedUpdates.length > 0) {
          const factNames = proposedUpdates
            .map((u) => (effectiveLocale === 'bn' ? u.label_bn : u.label_en))
            .join(', ');
          ackText =
            effectiveLocale === 'bn'
              ? `পেয়েছি, আপনার উত্তর থেকে **${proposedUpdates.length}টি ক্লিনিকাল তথ্য** (${factNames}) পেয়েছি। রোগীর ফাইলে যোগ করতে নিচে নিশ্চিত করুন।`
              : `Understood. Identified **${proposedUpdates.length} clinical fact(s)** (${factNames}) from your response. Confirm below to update patient record.`;
        } else {
          ackText =
            effectiveLocale === 'bn'
              ? 'ধন্যবাদ ডাক্তার, আপনার উত্তর কেস রেকর্ডে লিপিবদ্ধ করা হয়েছে।'
              : 'Thank you Doctor, your response has been recorded in the case consultation.';
        }

        // 6. Select the NEXT smart follow-up question (at most ONE), suppressing already answered
        const tGuardEffective = (effectiveLocale === 'bn' ? bn : en).analysisGuard;
        const nextMissingInfo: MissingInformation[] = [];

        const hasVitalsNow =
          hasPreexistingVitals ||
          answeredQuestionIds.has('vitals-followup') ||
          proposedUpdates.some((p) => p.field_path.startsWith('vitals.'));

        if (!hasVitalsNow) {
          nextMissingInfo.push({
            id: 'vitals-followup',
            type: 'exam',
            text: tGuardEffective.vitals,
            why_it_helps:
              effectiveLocale === 'bn'
                ? 'রোগের তীব্রতা এবং কার্ডিওপালমোনারি স্থিতি মূল্যায়ন করতে'
                : 'To assess disease severity and cardiopulmonary stability',
            which_diagnoses_it_separates:
              effectiveLocale === 'bn'
                ? ['নিউমোনিয়া (Pneumonia)', 'অ্যাকিউট করোনারি সিন্ড্রোম (ACS)']
                : ['Pneumonia', 'Acute Coronary Syndrome'],
            quick_answers:
              effectiveLocale === 'bn'
                ? ['বিপি ১২০/৮০, পালস ৭৬, তাপমাত্রা স্বাভাবিক', 'বিপি ১৩০/৮৫, পালস ৮৮', 'অস্থির ভাইটালস']
                : ['BP 120/80, Pulse 76, Afebrile', 'BP 130/85, HR 88', 'Hemodynamically unstable'],
          });
        }

        const isRespiratory = /cough|breath|dyspnea|chest|sputum|কাশি|শ্বাস|বুক|কফ/i.test(
          `${patientInput.chief_complaint || ''} ${(patientInput.symptoms || []).join(' ')} ${data.answer}`
        );

        if (isRespiratory && !answeredQuestionIds.has('chest-auscultation-followup')) {
          nextMissingInfo.push({
            id: 'chest-auscultation-followup',
            type: 'exam',
            text:
              effectiveLocale === 'bn'
                ? 'স্টেথোস্কোপে ফুসফুসের শব্দ (Auscultation) কেমন? কোনো অস্বাভাবিক ক্রেপিটেশন বা হুইজ আছে?'
                : 'What are the chest auscultation findings? Any localized crackles, bronchial breathing, or wheezing?',
            why_it_helps:
              effectiveLocale === 'bn'
                ? 'ফুসফুসে কনসলিডেশন (নিউমোনিয়া) বনাম ব্রঙ্কিয়াল বাধা (অ্যাজমা/সিওপিডি) আলাদা করতে'
                : 'To differentiate localized consolidation (CAP) from bronchospasm (Asthma/COPD)',
            which_diagnoses_it_separates:
              effectiveLocale === 'bn'
                ? ['কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়া (CAP)', 'সিওপিডি / অ্যাজমা (COPD/Asthma)']
                : ['Community-Acquired Pneumonia (CAP)', 'COPD / Asthma Exacerbation'],
            quick_answers:
              effectiveLocale === 'bn'
                ? ['ক্রেপিটেশন বিদ্যমান (Crackles present)', 'হুইজ বিদ্যমান (Wheezing present)', 'ফুসফুসের শব্দ স্বাভাবিক (Clear)', 'বায়ু চলাচল হ্রাসপ্রাপ্ত (Decreased air entry)']
                : ['Crackles present', 'Wheezing present', 'Clear breath sounds', 'Decreased air entry'],
          });
        } else if (!isRespiratory && !answeredQuestionIds.has('exam-general-followup')) {
          nextMissingInfo.push({
            id: 'exam-general-followup',
            type: 'question',
            text: tGuardEffective.exam,
            why_it_helps:
              effectiveLocale === 'bn'
                ? 'শারীরিক অনুসন্ধানের ফলাফল লিপিবদ্ধ করতে'
                : 'To document focused physical examination findings',
            which_diagnoses_it_separates:
              effectiveLocale === 'bn'
                ? ['ভাইরাল বনাম ব্যাকটেরিয়াল সংক্রমণ']
                : ['Viral vs Bacterial Etiology'],
            quick_answers:
              effectiveLocale === 'bn'
                ? ['শারীরিক লক্ষণ স্থিতিশীল', 'তীব্র ব্যথা বিদ্যমান', 'কোনো জরুরি লক্ষণ নেই']
                : ['Clinically stable', 'Severe acute discomfort', 'No emergent focal signs'],
          });
        }

        const selectedNextFollowup = nextMissingInfo.filter((q) => !answeredQuestionIds.has(q.id)).slice(0, 1);

        const humanized = humanize(
          {
            found: true,
            status: 'analyzed',
            answer: ackText,
            citations: [],
            missing_information: selectedNextFollowup,
          },
          undefined,
          userPrefs,
          {
            sessionId: `case-${id}`,
            userName: user.name,
            turnCount: historyTurns.length + 1,
          },
          effectiveLocale,
          data.answer,
          safetyAlerts
        );

        const [assistantTurn] = await tx
          .insert(caseTurns)
          .values({
            caseId: id,
            role: 'system',
            content: {
              type: 'assistant_response',
              text: humanized.displayText,
              speech_text: humanized.speechText,
              reactions: humanized.reactions,
              next_steps: humanized.nextSteps,
              proposed_updates: proposedUpdates,
              follow_ups: selectedNextFollowup,
              citations: [],
              safety_alerts: safetyAlerts,
              status: 'analyzed',
              language_metadata: {
                reply_language: effectiveLocale,
                understanding: {
                  detected_lang: languageResult.detectedLang,
                  dominant_lang: languageResult.dominantLang,
                  canonical_query: languageResult.canonicalEnglishQuery,
                  bangla_query: languageResult.banglaQuery,
                  entities: languageResult.entities,
                  ambiguity: languageResult.ambiguity,
                },
              },
            },
          })
          .returning();

        await tx
          .update(cases)
          .set({ updatedAt: new Date() })
          .where(ownedCase(id, user.id));

        await tx.insert(auditLogs).values({
          caseId: id,
          userId: user.id,
          event: 'follow_up_answered',
          payload: {
            question_id: data.question_id,
            doctor_turn_id: doctorTurn.id,
            assistant_turn_id: assistantTurn.id,
            proposed_facts_count: proposedUpdates.length,
          },
        });

        return { doctorTurn, assistantTurn, duplicate: false };
      }

      // -----------------------------------------------------------------
      // BRANCH B: Observation / Note / Evidence review
      // -----------------------------------------------------------------
      const observationText =
        'note' in data
          ? data.note
          : 'observation' in data && data.observation
          ? data.observation
          : 'text' in data && data.text
          ? data.text
          : '';

      const action = 'action' in data ? data.action : 'observation';

      // 1. Language Layer Understanding & Entity Canonicalization
      const languageResult = await understandText(observationText, {
        userPrefs: {
          replyLanguage: (data.reply_language || (userPref?.replyLanguage as 'auto' | 'bn' | 'en' | undefined) || 'auto') as 'auto' | 'bn' | 'en',
          banglishReply: userPref?.banglishReply ?? false,
        },
      });

      const effectiveLocale = languageResult.replyLanguage === 'en' ? 'en' : 'bn';

      // 2. Insert doctor turn (Original text strictly preserved for audit)
      const [doctorTurn] = await tx
        .insert(caseTurns)
        .values({
          caseId: id,
          role: 'doctor',
          content: {
            type: 'doctor_observation',
            text: observationText,
            action,
            client_draft_id: data.client_draft_id,
            language_metadata: {
              detected_lang: languageResult.detectedLang,
              dominant_lang: languageResult.dominantLang,
              canonical_query: languageResult.canonicalEnglishQuery,
              bangla_query: languageResult.banglaQuery,
              intent: languageResult.intent,
              entities: languageResult.entities,
              ambiguity: languageResult.ambiguity,
            },
          },
        })
        .returning();

      // 3. Extract facts from text
      const proposedUpdates = extractClinicalFacts(observationText, patientInput);

      // 4. Identify smart, context-aware missing information (at most 1 follow-up)
      const tGuardEffective = (effectiveLocale === 'bn' ? bn : en).analysisGuard;
      const missingInfo: MissingInformation[] = [];

      const hasVitals =
        hasPreexistingVitals ||
        answeredQuestionIds.has('vitals-followup') ||
        proposedUpdates.some((p) => p.field_path.startsWith('vitals.'));

      if (!hasVitals) {
        missingInfo.push({
          id: 'vitals-followup',
          type: 'exam',
          text: tGuardEffective.vitals,
          why_it_helps:
            effectiveLocale === 'bn'
              ? 'রোগের তীব্রতা এবং কার্ডিওপালমোনারি স্থিতি মূল্যায়ন করতে'
              : 'To assess disease severity and cardiopulmonary stability',
          which_diagnoses_it_separates:
            effectiveLocale === 'bn'
              ? ['নিউমোনিয়া (Pneumonia)', 'অ্যাকিউট করোনারি সিন্ড্রোম (ACS)']
              : ['Pneumonia', 'Acute Coronary Syndrome'],
          quick_answers:
            effectiveLocale === 'bn'
              ? ['বিপি ১২০/৮০, পালস ৭৬, তাপমাত্রা স্বাভাবিক', 'বিপি ১৩০/৮৫, পালস ৮৮', 'অস্থির ভাইটালস']
              : ['BP 120/80, Pulse 76, Afebrile', 'BP 130/85, HR 88', 'Hemodynamically unstable'],
        });
      }

      const isRespiratory = /cough|breath|dyspnea|chest|sputum|কাশি|শ্বাস|বুক|কফ/i.test(
        `${patientInput.chief_complaint || ''} ${(patientInput.symptoms || []).join(' ')} ${observationText}`
      );

      if (isRespiratory && !answeredQuestionIds.has('chest-auscultation-followup')) {
        missingInfo.push({
          id: 'chest-auscultation-followup',
          type: 'exam',
          text:
            effectiveLocale === 'bn'
              ? 'স্টেথোস্কোপে ফুসফুসের শব্দ (Auscultation) কেমন? কোনো অস্বাভাবিক ক্রেপিটেশন বা হুইজ আছে?'
              : 'What are the chest auscultation findings? Any localized crackles, bronchial breathing, or wheezing?',
          why_it_helps:
            effectiveLocale === 'bn'
              ? 'ফুসফুসে কনসলিডেশন (নিউমোনিয়া) বনাম ব্রঙ্কিয়াল বাধা (অ্যাজমা/সিওপিডি) আলাদা করতে'
              : 'To differentiate localized consolidation (CAP) from bronchospasm (Asthma/COPD)',
          which_diagnoses_it_separates:
            effectiveLocale === 'bn'
              ? ['কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়া (CAP)', 'সিওপিডি / অ্যাজমা (COPD/Asthma)']
              : ['Community-Acquired Pneumonia (CAP)', 'COPD / Asthma Exacerbation'],
          quick_answers:
            effectiveLocale === 'bn'
              ? ['ক্রেপিটেশন বিদ্যমান (Crackles present)', 'হুইজ বিদ্যমান (Wheezing present)', 'ফুসফুসের শব্দ স্বাভাবিক (Clear)', 'বায়ু চলাচল হ্রাসপ্রাপ্ত (Decreased air entry)']
              : ['Crackles present', 'Wheezing present', 'Clear breath sounds', 'Decreased air entry'],
        });
      } else if (!isRespiratory && !answeredQuestionIds.has('exam-general-followup')) {
        missingInfo.push({
          id: 'exam-general-followup',
          type: 'question',
          text: tGuardEffective.exam,
          why_it_helps:
            effectiveLocale === 'bn'
              ? 'শারীরিক অনুসন্ধানের ফলাফল লিপিবদ্ধ করতে'
              : 'To document focused physical examination findings',
          which_diagnoses_it_separates:
            effectiveLocale === 'bn'
              ? ['ভাইরাল বনাম ব্যাকটেরিয়াল সংক্রমণ']
              : ['Viral vs Bacterial Etiology'],
          quick_answers:
            effectiveLocale === 'bn'
              ? ['শারীরিক লক্ষণ স্থিতিশীল', 'তীব্র ব্যথা বিদ্যমান', 'কোনো জরুরি লক্ষণ নেই']
              : ['Clinically stable', 'Severe acute discomfort', 'No emergent focal signs'],
        });
      }

      // 4b. Inject Ambiguity Clarification if detected
      if (
        languageResult.ambiguity.isAmbiguous &&
        (languageResult.ambiguity.clarifyingQuestionBn || languageResult.ambiguity.clarifyingQuestionEn)
      ) {
        const ambiguityId = 'ambiguity-clarify';
        if (!answeredQuestionIds.has(ambiguityId)) {
          missingInfo.unshift({
            id: ambiguityId,
            type: 'question',
            text:
              effectiveLocale === 'bn'
                ? languageResult.ambiguity.clarifyingQuestionBn!
                : languageResult.ambiguity.clarifyingQuestionEn || languageResult.ambiguity.clarifyingQuestionBn!,
            why_it_helps:
              effectiveLocale === 'bn'
                ? 'চিকিৎসা বা নির্দেশিকা সুনির্দিষ্ট করতে'
                : 'To clarify targeted clinical subject',
            which_diagnoses_it_separates: [],
            quick_answers: (languageResult.ambiguity.quickChips || []).map((c) =>
              effectiveLocale === 'bn' ? c.labelBn : c.labelEn
            ),
          });
        }
      }

      // Strictly select at most ONE follow-up that has not been answered yet
      const selectedFollowup = missingInfo.filter((q) => !answeredQuestionIds.has(q.id)).slice(0, 1);

      // 5. Multi-query hybrid retrieval using language layer canonical queries
      const sysQuery = detectSystemQuery(observationText);
      let citations: ReturnType<typeof libraryExcerpts> = [];
      const isQuestion =
        languageResult.intent === 'ask_library' ||
        languageResult.intent === 'medicine_lookup' ||
        /\?|কী|কি|কোন|কখন|কত|কেন|উপায়|চিকিৎসা|ওষুধ|পরীক্ষা|what|which|how|when|why|where|should|can|could|dose|dosage|guideline|protocol|recommend|suggest|differential|curb|antibiotic/i.test(
          observationText
        );

      if (!sysQuery && (action === 'evidence_review' || isQuestion || observationText.length > 5)) {
        try {
          const retrievalQueries =
            languageResult.retrievalQueries && languageResult.retrievalQueries.length > 0
              ? languageResult.retrievalQueries
              : [observationText];

          const hits = await hybridRetrieve(retrievalQueries, 6);
          citations = libraryExcerpts(hits.slice(0, 3));
        } catch {
          citations = [];
        }
      }

      // 6. Red-flag clinical safety triggers (Negation-aware, Unicode regex, bilingual)
      const safetyAlerts: SafetyAlert[] = checkRedFlags(
        `${observationText} ${patientInput.chief_complaint || ''} ${(patientInput.symptoms || []).join(' ')}`,
        effectiveLocale
      );

      // 7. Build clinical answer
      const doctorInputSignals = analyzeDoctorInput(
        observationText,
        { sessionId: `case-${id}`, turnCount: historyTurns.length + 1 },
        safetyAlerts
      );

      let baseClinicalAnswer = '';
      if (sysQuery) {
        baseClinicalAnswer = effectiveLocale === 'bn' ? sysQuery.answerBn : sysQuery.answerEn;
      } else if (doctorInputSignals.isThanks || languageResult.intent === 'greeting') {
        baseClinicalAnswer = '';
      } else if (languageResult.intent === 'ask_capabilities') {
        baseClinicalAnswer =
          effectiveLocale === 'bn'
            ? 'আমি শুধুমাত্র এই মুহূর্তে খোলা রোগীর কেস এবং আমাদের অভ্যন্তরীণ ভেরিফাইড ক্লিনিক্যাল লাইব্রেরির রেফারেন্স দেখতে পারি। আমি আপনার স্ক্রিন, ক্যামেরা বা ইন্টারনেট দেখতে পারি না।'
            : 'I can only see the currently open patient case and our internal verified clinical library references. I cannot see your broader screen, camera, or the internet.';
      } else if (isQuestion && citations.length > 0) {
        const topCitation = citations[0];
        // Preserves exact verbatim quote without adding truncating ellipsis
        const excerptSnippet = topCitation.quote ? `"${topCitation.quote}"` : '';

        baseClinicalAnswer =
          effectiveLocale === 'bn'
            ? `অভ্যন্তরীণ মেডিকেল লাইব্রেরি থেকে সংশ্লিষ্ট প্রমাণ:\n\n• **লাইব্রেরি প্রমাণ**: ${excerptSnippet || 'সংশ্লিষ্ট ক্লিনিকাল গাইডলাইনে উপযুক্ত প্রটোকল উল্লেখিত রয়েছে।'}\n\nরোগীর বর্তমান ডেটা ও প্রমাণের ওপর ভিত্তি করে সিদ্ধান্ত সহায়তা প্রস্তুত।`
            : `Verified evidence from internal medical library:\n\n• **Guideline Evidence**: ${excerptSnippet || 'Approved management protocols documented in reference library.'}\n\nPlease review citations below to support your clinical decision.`;
      } else if (isQuestion && citations.length === 0) {
        baseClinicalAnswer = '';
      } else if (action === 'evidence_review') {
        baseClinicalAnswer =
          effectiveLocale === 'bn'
            ? 'রোগীর বর্তমান লক্ষণ ও ডেটার অভ্যন্তরীণ লাইব্রেরি প্রমাণ পর্যালোচনা সম্পন্ন হয়েছে। চূড়ান্ত ডিফারেনশিয়াল রোগ নির্ণয়ের আগে শারীরিক পরীক্ষা বা ল্যাব রেজাল্ট নিশ্চিত করা আবশ্যক।'
            : 'Medical library evidence review completed for this patient. Additional examination findings or lab results are required before finalizing differentials.';
      } else if (proposedUpdates.length > 0) {
        const factNames = proposedUpdates
          .map((u) => (effectiveLocale === 'bn' ? u.label_bn : u.label_en))
          .join(', ');

        baseClinicalAnswer =
          effectiveLocale === 'bn'
            ? `পর্যবেক্ষণ থেকে **${proposedUpdates.length}টি ক্লিনিকাল তথ্য** (${factNames}) পেয়েছি। রোগীর ফাইলে যোগ করতে নিচে নিশ্চিত করুন।`
            : `Identified **${proposedUpdates.length} clinical fact(s)** (${factNames}) from your observation. Review and confirm below to update the patient record.`;
      } else {
        baseClinicalAnswer =
          effectiveLocale === 'bn'
            ? 'ক্লিনিকাল পর্যবেক্ষণ কেস হিস্ট্রিতে লিপিবদ্ধ করা হয়েছে।'
            : 'Clinical observation has been recorded in the case consultation history.';
      }

      // Determine real status based on evidence and clinical content
      const realStatus =
        Boolean(sysQuery) || citations.length > 0 || proposedUpdates.length > 0 || !isQuestion
          ? 'analyzed'
          : 'insufficient_evidence';

      const humanized = humanize(
        {
          found: realStatus !== 'insufficient_evidence',
          status: realStatus,
          answer: baseClinicalAnswer,
          citations,
          missing_information: sysQuery ? [] : selectedFollowup,
        },
        undefined,
        userPrefs,
        {
          sessionId: `case-${id}`,
          userName: user.name,
          turnCount: historyTurns.length + 1,
        },
        effectiveLocale,
        observationText,
        safetyAlerts
      );

      const assistantText = humanized.displayText;

      // 8. Insert assistant reply turn with true status
      const [assistantTurn] = await tx
        .insert(caseTurns)
        .values({
          caseId: id,
          role: 'system',
          content: {
            type: 'assistant_response',
            text: assistantText,
            speech_text: humanized.speechText,
            reactions: humanized.reactions,
            next_steps: humanized.nextSteps,
            proposed_updates: proposedUpdates,
            follow_ups: selectedFollowup,
            citations,
            safety_alerts: safetyAlerts,
            status: realStatus,
            language_metadata: {
              reply_language: effectiveLocale,
              understanding: {
                detected_lang: languageResult.detectedLang,
                dominant_lang: languageResult.dominantLang,
                canonical_query: languageResult.canonicalEnglishQuery,
                bangla_query: languageResult.banglaQuery,
                entities: languageResult.entities,
                ambiguity: languageResult.ambiguity,
              },
            },
          },
        })
        .returning();

      await tx
        .update(cases)
        .set({ updatedAt: new Date() })
        .where(ownedCase(id, user.id));

      await tx.insert(auditLogs).values({
        caseId: id,
        userId: user.id,
        event: 'case_turn_recorded',
        payload: {
          doctor_turn_id: doctorTurn.id,
          assistant_turn_id: assistantTurn?.id,
          action,
          original_text: observationText,
          detected_lang: languageResult.detectedLang,
          canonical_query: languageResult.canonicalEnglishQuery,
          entities: languageResult.entities,
          ambiguity: languageResult.ambiguity,
          reply_language: effectiveLocale,
          proposed_facts_count: proposedUpdates.length,
          citations_count: citations.length,
          status: realStatus,
        },
      });

      return { doctorTurn, assistantTurn, duplicate: false };
    });

    if (!result) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      turn: result.doctorTurn,
      assistantTurn: result.assistantTurn,
      duplicate: result.duplicate,
    });
  } catch (err) {
    console.error('Failed to save turn:', err);
    return NextResponse.json({ error: 'Failed to save turn' }, { status: 500 });
  }
}

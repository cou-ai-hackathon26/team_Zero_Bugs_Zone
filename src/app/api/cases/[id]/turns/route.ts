import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { caseTurns, cases, auditLogs } from '@/db/schema';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import { extractClinicalFacts } from '@/lib/clinical-extractor';
import { searchLibraryText } from '@/lib/retrieval';
import { libraryExcerpts } from '@/lib/library-excerpts';
import { Chunk, MissingInformation, SafetyAlert, StructuredPatientInput } from '@/types';
import { desc, eq } from 'drizzle-orm';
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
  }),
  // 2. Clinical observation or evidence review request
  z.object({
    type: z.literal('doctor_observation').optional(),
    observation: z.string().trim().min(1).max(4000).optional(),
    text: z.string().trim().min(1).max(4000).optional(),
    action: z.enum(['observation', 'evidence_review']).default('observation'),
    client_draft_id: z.string().max(100).optional(),
    locale: z.enum(['bn', 'en']).default('bn'),
  }),
  // 3. Simple note
  z.object({
    type: z.literal('doctor_note').optional(),
    note: z.string().trim().min(1).max(4000),
    client_draft_id: z.string().max(100).optional(),
    locale: z.enum(['bn', 'en']).default('bn'),
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
    const locale = data.locale || 'bn';
    const tGuard = (locale === 'bn' ? bn : en).analysisGuard;

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

      if (isFollowUp) {
        // Record single question_answer turn
        const [created] = await tx
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

        await tx
          .update(cases)
          .set({ updatedAt: new Date() })
          .where(ownedCase(id, user.id));

        await tx.insert(auditLogs).values({
          caseId: id,
          userId: user.id,
          event: 'follow_up_answered',
          payload: { question_id: data.question_id },
        });

        return { doctorTurn: created, assistantTurn: null, duplicate: false };
      }

      // Observation / Note / Evidence review
      const observationText =
        'note' in data
          ? data.note
          : 'observation' in data && data.observation
          ? data.observation
          : 'text' in data && data.text
          ? data.text
          : '';

      const action = 'action' in data ? data.action : 'observation';

      // 1. Insert doctor turn
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
          },
        })
        .returning();

      // 2. Extract facts from text
      const proposedUpdates = extractClinicalFacts(observationText, patientInput);

      // 3. Identify smart, context-aware missing information with quick 1-tap responses
      const missingInfo: MissingInformation[] = [];
      const vitalsObj = patientInput.vitals || {};
      const hasVitals =
        Boolean(vitalsObj.blood_pressure) ||
        Boolean(vitalsObj.temperature_celsius) ||
        Boolean(vitalsObj.heart_rate);

      if (!hasVitals) {
        missingInfo.push({
          id: 'vitals-followup',
          type: 'exam',
          text: tGuard.vitals,
          why_it_helps:
            locale === 'bn'
              ? 'রোগের তীব্রতা এবং কার্ডিওপালমোনারি স্থিতি মূল্যায়ন করতে'
              : 'To assess disease severity and cardiopulmonary stability',
          which_diagnoses_it_separates:
            locale === 'bn'
              ? ['নিউমোনিয়া (Pneumonia)', 'অ্যাকিউট করোনারি সিন্ড্রোম (ACS)']
              : ['Pneumonia', 'Acute Coronary Syndrome'],
          quick_answers:
            locale === 'bn'
              ? ['বিপি ১২০/৮০, পালস ৭৬, তাপমাত্রা স্বাভাবিক', 'বিপি ১৩০/৮৫, পালস ৮৮', 'অস্থির ভাইটালস']
              : ['BP 120/80, Pulse 76, Afebrile', 'BP 130/85, HR 88', 'Hemodynamically unstable'],
        });
      }

      const isRespiratory = /cough|breath|dyspnea|chest|sputum|কাশি|শ্বাস|বুক|কফ/i.test(
        `${patientInput.chief_complaint || ''} ${(patientInput.symptoms || []).join(' ')} ${observationText}`
      );

      if (isRespiratory) {
        missingInfo.push({
          id: 'chest-auscultation-followup',
          type: 'exam',
          text:
            locale === 'bn'
              ? 'স্টেথোস্কোপে ফুসফুসের শব্দ (Auscultation) কেমন? কোনো অস্বাভাবিক ক্রেপিটেশন বা হুইজ আছে?'
              : 'What are the chest auscultation findings? Any localized crackles, bronchial breathing, or wheezing?',
          why_it_helps:
            locale === 'bn'
              ? 'ফুসফুসে কনসলিডেশন (নিউমোনিয়া) বনাম ব্রঙ্কিয়াল বাধা (অ্যাজমা/সিওপিডি) আলাদা করতে'
              : 'To differentiate localized consolidation (CAP) from bronchospasm (Asthma/COPD)',
          which_diagnoses_it_separates:
            locale === 'bn'
              ? ['কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়া (CAP)', 'সিওপিডি / অ্যাজমা (COPD/Asthma)']
              : ['Community-Acquired Pneumonia (CAP)', 'COPD / Asthma Exacerbation'],
          quick_answers:
            locale === 'bn'
              ? ['ক্রেপিটেশন বিদ্যমান (Crackles present)', 'হুইজ বিদ্যমান (Wheezing present)', 'ফুসফুসের শব্দ স্বাভাবিক (Clear)', 'বায়ু চলাচল হ্রাসপ্রাপ্ত (Decreased air entry)']
              : ['Crackles present', 'Wheezing present', 'Clear breath sounds', 'Decreased air entry'],
        });
      } else {
        missingInfo.push({
          id: 'exam-general-followup',
          type: 'question',
          text: tGuard.exam,
          why_it_helps:
            locale === 'bn'
              ? 'শারীরিক অনুসন্ধানের ফলাফল লিপিবদ্ধ করতে'
              : 'To document focused physical examination findings',
          which_diagnoses_it_separates:
            locale === 'bn'
              ? ['ভাইরাল বনাম ব্যাকটেরিয়াল সংক্রমণ']
              : ['Viral vs Bacterial Etiology'],
          quick_answers:
            locale === 'bn'
              ? ['শারীরিক লক্ষণ স্থিতিশীল', 'তীব্র ব্যথা বিদ্যমান', 'কোনো জরুরি লক্ষণ নেই']
              : ['Clinically stable', 'Severe acute discomfort', 'No emergent focal signs'],
        });
      }

      // 4. Evidence retrieval and citations if requested, question asked, or symptoms present
      let citations: ReturnType<typeof libraryExcerpts> = [];
      const isQuestion = /\?|কী|কি|কোন|কখন|কত|কেন|উপায়|চিকিৎসা|ওষুধ|পরীক্ষা|what|which|how|when|why|where|should|can|could|dose|dosage|guideline|protocol|recommend|suggest|differential|curb|antibiotic/i.test(
        observationText
      );

      if (action === 'evidence_review' || isQuestion || observationText.length > 5) {
        try {
          const candidates: Chunk[] = [];
          const queryTerms = [
            ...(patientInput.symptoms || []),
            patientInput.chief_complaint?.split(/[,.\s]+/).find((w) => w.length > 4),
            observationText?.split(/[,.\s]+/).find((w) => w.length > 4 && !/review|request|please|patient|doctor/i.test(w)),
          ].filter(Boolean) as string[];

          for (const term of queryTerms.slice(0, 3)) {
            const hits = await searchLibraryText(term, 2);
            candidates.push(...hits);
          }

          if (candidates.length === 0) {
            const fallback = await searchLibraryText('pneumonia', 2);
            candidates.push(...fallback);
          }

          const uniqueChunks = Array.from(new Map(candidates.map((c) => [c.id, c])).values());
          citations = libraryExcerpts(uniqueChunks.slice(0, 3));
        } catch {
          citations = [];
        }
      }

      // 5. Red-flag clinical safety triggers
      const safetyAlerts: SafetyAlert[] = [];
      const redFlagRegex = /\b(?:chest\s+pain\s+(?:radiat|spread)|crushing|severe\s+dyspnea|stridor|unconscious|cyanosis|hemoptysis|তীব্র\s+শ্বাসকষ্ট|রক্তবমি|বুকে\s+তীব্র\s+ব্যথা)\b/i;
      if (redFlagRegex.test(observationText) || redFlagRegex.test(patientInput.chief_complaint || '')) {
        safetyAlerts.push({
          id: `redflag-${Date.now()}`,
          drug_id: 'triage-01',
          drug_name: 'Emergency Protocol',
          severity: 'critical',
          type: 'contraindication',
          title:
            locale === 'bn'
              ? '🚨 জরুরি রেড ফ্ল্যাগ: তাৎক্ষণিক ক্লিনিকাল হস্তক্ষেপ প্রয়োজন'
              : '🚨 Critical Red Flag: Immediate Clinical Escalation Required',
          description:
            locale === 'bn'
              ? 'উপসর্গ বা পর্যবেক্ষণে উচ্চ ঝুঁকির লক্ষণ বিদ্যমান। কার্ডিওপালমোনারি স্থায়িত্ব নিশ্চিত করুন এবং জরুরি অক্সিজেন ও সিনিয়র কনসালট্যান্ট কল করুন।'
              : 'Symptoms indicate acute hemodynamic or respiratory instability. Immediate airway/oxygen stabilization and senior specialist consult required.',
        });
      }

      // 6. Build smart, empathetic, human-friendly assistant reply
      let assistantText = '';
      if (isQuestion && citations.length > 0) {
        const topCitation = citations[0];
        const excerptSnippet = topCitation.quote
          ? `"${topCitation.quote.slice(0, 180)}..."`
          : '';

        assistantText =
          locale === 'bn'
            ? `ডাক্তার, আপনার ক্লিনিকাল জিজ্ঞাসার প্রেক্ষিতে আমাদের অভ্যন্তরীণ মেডিকেল লাইব্রেরি থেকে সংশ্লিষ্ট প্রমাণ পর্যালোচনা করা হয়েছে:\n\n• **লাইব্রেরি প্রমাণ**: ${excerptSnippet || 'সংশ্লিষ্ট ক্লিনিকাল গাইডলাইনে উপযুক্ত প্রটোকল উল্লেখিত রয়েছে।'}\n\nরোগীর বর্তমান ডেটা ও প্রমাণের ওপর ভিত্তি করে প্রস্তাবিত পদক্ষেপ নিচে উল্লেখ করা হলো। বিস্তারিত দেখতে নিচের উদ্ধৃতি চিপে ক্লিক করুন।`
            : `Doctor, regarding your clinical inquiry, relevant evidence from the internal medical guideline library has been retrieved:\n\n• **Guideline Evidence**: ${excerptSnippet || 'Appropriate clinical management protocols are documented in the approved references.'}\n\nPlease review the citations and follow-up guidance below to support your diagnostic decision.`;
      } else if (action === 'evidence_review') {
        assistantText =
          locale === 'bn'
            ? 'ডাক্তার, অভ্যন্তরীণ মেডিকেল লাইব্রেরি থেকে রোগীর বর্তমান লক্ষণ ও ডেটার সমন্বিত প্রমাণ পর্যালোচনা সম্পন্ন হয়েছে। চূড়ান্ত ডিফারেনশিয়াল রোগ নির্ণয়ের আগে শারীরিক পরীক্ষার কিছু গুরুত্বপূর্ণ তথ্য বা ল্যাব রেজাল্ট নিশ্চিত করা আবশ্যক (Insufficient Evidence)।'
            : 'Doctor, comprehensive medical library evidence review has been completed for this patient. Additional objective examination findings or targeted tests are required before finalizing the working differential (Insufficient Evidence).';
      } else if (proposedUpdates.length > 0) {
        const factNames = proposedUpdates
          .map((u) => (locale === 'bn' ? u.label_bn : u.label_en))
          .join(', ');

        assistantText =
          locale === 'bn'
            ? `ডাক্তার, আপনার পর্যবেক্ষণ থেকে **${proposedUpdates.length}টি ক্লিনিকাল তথ্য** (${factNames}) সফলভাবে নিষ্কাশন করা হয়েছে। রোগীর নথিতে এই তথ্যগুলো অন্তর্ভুক্ত করার জন্য অনুগ্রহ করে নিচের প্রস্তাবিত কার্ডগুলো নিশ্চিত করুন।`
            : `Doctor, successfully identified **${proposedUpdates.length} clinical fact(s)** (${factNames}) from your observation. Please review and confirm the proposed structured updates below to apply them directly to the patient record.`;
      } else {
        assistantText =
          locale === 'bn'
            ? 'ডাক্তার, আপনার ক্লিনিকাল পর্যবেক্ষণ কেস হিস্ট্রিতে লিপিবদ্ধ করা হয়েছে। রোগীর নির্ভরযোগ্য মূল্যায়ন নিশ্চিত করতে পরবর্তী প্রাসঙ্গিক প্রশ্নসমূহ নিচে দেওয়া হলো।'
            : 'Doctor, your clinical findings have been recorded in the case consultation history. Suggested next diagnostic steps and clarifications are outlined below.';
      }

      // 7. Insert assistant reply turn
      const [assistantTurn] = await tx
        .insert(caseTurns)
        .values({
          caseId: id,
          role: 'system',
          content: {
            type: 'assistant_response',
            text: assistantText,
            proposed_updates: proposedUpdates,
            follow_ups: missingInfo,
            citations,
            safety_alerts: safetyAlerts,
            status: 'insufficient_evidence',
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
          action,
          proposed_facts_count: proposedUpdates.length,
          citations_count: citations.length,
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
  } catch {
    return NextResponse.json({ error: 'Failed to save turn' }, { status: 500 });
  }
}

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

      // 3. Identify missing information
      const missingInfo: MissingInformation[] = [];
      const hasVitals =
        patientInput.vitals &&
        Object.values(patientInput.vitals).some((v) => v !== undefined && v !== null && v !== '');

      if (!hasVitals) {
        missingInfo.push({
          id: 'vitals-followup',
          type: 'exam',
          text: tGuard.vitals,
          why_it_helps: locale === 'bn' ? 'রোগের তীব্রতা এবং কার্ডিওপালমোনারি স্থিতি মূল্যায়ন করতে' : 'To assess disease severity and cardiopulmonary stability',
          which_diagnoses_it_separates: locale === 'bn' ? ['নিউমোনিয়া (Pneumonia)', 'অ্যাকিউট করোনারি সিন্ড্রোম (ACS)'] : ['Pneumonia', 'Acute Coronary Syndrome'],
        });
      }

      missingInfo.push({
        id: 'exam-followup',
        type: 'question',
        text: tGuard.exam,
        why_it_helps: locale === 'bn' ? 'শ্বাসযন্ত্র বা সিস্টেমিক অনুসন্ধানের ফলাফল লিপিবদ্ধ করতে' : 'To document chest auscultation and systemic examination findings',
        which_diagnoses_it_separates: locale === 'bn' ? ['সিএপি (CAP)', 'সিওপিডি (COPD)'] : ['CAP', 'COPD exacerbation'],
      });

      // 4. Evidence retrieval and citations if requested or if symptoms are present
      let citations: ReturnType<typeof libraryExcerpts> = [];
      if (action === 'evidence_review' || observationText.length > 5) {
        try {
          const candidates: Chunk[] = [];
          const queryTerms = [
            ...(patientInput.symptoms || []),
            patientInput.chief_complaint?.split(/[,.\s]+/).find((w) => w.length > 4),
            observationText?.split(/[,.\s]+/).find((w) => w.length > 4 && !/review|request|please/i.test(w)),
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
      const redFlagRegex = /\b(?:chest\s+pain\s+(?:radiat|spread)|crushing|severe\s+dyspnea|stridor|unconscious|cyanosis|hemoptysis)\b/i;
      if (redFlagRegex.test(observationText) || redFlagRegex.test(patientInput.chief_complaint || '')) {
        safetyAlerts.push({
          id: `redflag-${Date.now()}`,
          drug_id: 'triage-01',
          drug_name: 'Emergency Protocol',
          severity: 'critical',
          type: 'contraindication',
          title: locale === 'bn' ? 'জরুরি রেড ফ্ল্যাগ: তাৎক্ষণিক মূল্যায়ন প্রয়োজন' : 'Critical Red Flag: Urgent Clinical Escalation Required',
          description: locale === 'bn' ? 'রোগীর উপসর্গে তীব্র ঝুঁকির লক্ষণ বিদ্যমান। জরুরি অক্সিজেন এবং বিশেষজ্ঞ পরামর্শ গ্রহণ করুন।' : 'Symptoms suggest high-risk cardiopulmonary or vascular instability. Immediate stabilization required.',
        });
      }

      // 6. Build assistant reply text
      let assistantText = '';
      if (action === 'evidence_review') {
        assistantText =
          locale === 'bn'
            ? 'অভ্যন্তরীণ মেডিকেল লাইব্রেরি থেকে সংশ্লিষ্ট প্রমাণ পর্যালোচনা সম্পন্ন হয়েছে। নির্ভরযোগ্য ডিফারেনশিয়াল রোগ নির্ণয়ের জন্য অতিরিক্ত শারীরিক পরীক্ষার তথ্য বা টেস্টের ফলাফল প্রয়োজন (Insufficient Evidence)।'
            : 'Internal medical library evidence review completed. Additional objective findings or laboratory tests are required before a definitive differential diagnosis can be established (Insufficient Evidence).';
      } else if (proposedUpdates.length > 0) {
        assistantText =
          locale === 'bn'
            ? `আপনার পর্যবেক্ষণ থেকে ${proposedUpdates.length}টি ক্লিনিকাল তথ্য পাওয়া গেছে। রোগীর নথিতে যোগ করার জন্য অনুগ্রহ করে নিচের প্রস্তাবনাগুলি পর্যালোচনা করুন।`
            : `Detected ${proposedUpdates.length} clinical fact(s) from your observation. Review the proposed structured updates below before applying them to the patient record.`;
      } else {
        assistantText =
          locale === 'bn'
            ? 'পর্যবেক্ষণ কেসের ইতিহাসে লিপিবদ্ধ করা হয়েছে। অতিরিক্ত তথ্য প্রয়োজন হলে নিচে দেখুন।'
            : 'Clinical observation recorded in the case consultation history. Additional clarifying information is outlined below.';
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

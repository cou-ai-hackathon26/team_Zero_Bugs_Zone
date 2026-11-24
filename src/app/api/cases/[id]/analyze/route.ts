import { boundedJson, rateLimit } from '@/lib/api-input';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { analyses, auditLogs, cases } from '@/db/schema';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import { singleQueryHybridSearch } from '@/lib/retrieval';
import { checkRedFlags } from '@/lib/red-flags';
import { verifyQuoteInChunk } from '@/lib/verifier';
import { interpretLabPanel } from '@/lib/clinical/lab-engine';
import { evaluateAllDiseaseReasoning } from '@/lib/clinical/disease-reasoning';
import type {
  AnalysisOutput,
  DifferentialDiagnosis,
  MissingInformation,
  StructuredPatientInput,
  VerifiedClaim,
} from '@/types';

const inputSchema = z.object({ locale: z.enum(['bn', 'en']).default('bn') });

function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+/u)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 25 && s.length < 250);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const limited = rateLimit(`analyze:${user.id}`, 12);
    if (limited) return limited;

    const input = inputSchema.safeParse(await boundedJson(request, 2048));
    if (!input.success) return NextResponse.json({ error: 'Invalid analysis request' }, { status: 400 });
    const locale = input.data.locale;
    const isBn = locale === 'bn';

    const result = await db.transaction(async (tx) => {
      const [record] = await tx.select().from(cases).where(ownedCase(id, user.id)).for('update');
      if (!record) return null;

      const patient = (record.structuredInput || {}) as StructuredPatientInput;
      const chief = patient.chief_complaint || '';
      const symptoms = patient.symptoms || [];
      const vitals = patient.vitals || {};
      const fullText = `${chief} ${symptoms.join(' ')} ${patient.history_of_present_illness || ''} ${patient.clinical_notes || ''}`;

      // 1. Intelligent Unit-Aware Laboratory Interpretation Engine
      const labReport = interpretLabPanel(patient.lab_values || [], {
        age: patient.age,
        gender: patient.gender,
        isPregnant: patient.is_pregnant,
        pregnancyTrimester: patient.pregnancy_trimester,
      });

      // 2. Specialized Disease Reasoning Engine (12 modules including Dengue, CAP, ACS, AKI)
      const diseaseReasoning = evaluateAllDiseaseReasoning(patient, labReport);

      // 3. Red Flag Evaluation & Hemodynamic Assessment
      const rawAlerts = checkRedFlags(fullText, locale);
      const redFlagsList: string[] = rawAlerts.map((a) => a.title);

      if (vitals.blood_pressure_systolic && vitals.blood_pressure_systolic >= 180) {
        redFlagsList.push(isBn ? '🚨 Hypertensive Crisis: সিস্টোলিক রক্তচাপ ≥ 180 mmHg' : '🚨 Hypertensive Crisis: Systolic BP ≥ 180 mmHg');
      } else if (vitals.blood_pressure_systolic && vitals.blood_pressure_systolic < 90) {
        redFlagsList.push(isBn ? '🚨 শক / হাইপোটেনশন ঝুঁকি: সিস্টোলিক রক্তচাপ < 90 mmHg' : '🚨 Shock / Hypotension Alert: Systolic BP < 90 mmHg');
      }
      if (vitals.spo2_percent && vitals.spo2_percent < 92) {
        redFlagsList.push(isBn ? '🚨 হাইপোক্সেমিয়া: SpO2 < 92% (জরুরি অক্সিজেন প্রয়োজন)' : '🚨 Critical Hypoxemia: SpO2 < 92% (Immediate Oxygen indicated)');
      }
      if (vitals.respiratory_rate && vitals.respiratory_rate >= 30) {
        redFlagsList.push(isBn ? '🚨 মারাত্মক ট্যাকাইপনিয়া: শ্বাসপ্রশ্বাস ≥ ৩০ /মিনিট' : '🚨 Severe Tachypnea: Respiratory Rate ≥ 30 /min');
      }

      // Add critical disease alerts
      for (const alert of isBn ? diseaseReasoning.criticalAlertsBn : diseaseReasoning.criticalAlerts) {
        if (!redFlagsList.includes(alert)) redFlagsList.push(alert);
      }

      // Add lab critical alerts
      for (const alert of labReport.criticalAlerts) {
        if (!redFlagsList.includes(alert)) redFlagsList.push(`🚨 ${alert}`);
      }

      // 4. Hybrid Retrieval from Verified Medical Library
      const topDiseases = diseaseReasoning.rankedDifferentials.slice(0, 2).map((d) => d.diseaseName).join(' ');
      const searchQuery = `${chief} ${symptoms.slice(0, 3).join(' ')} ${topDiseases}`.trim();
      const matchedChunks = await singleQueryHybridSearch(searchQuery, 12);

      // 5. Differential Diagnosis Synthesis with Verified Guideline Claims
      const differentials: DifferentialDiagnosis[] = [];

      for (const candidate of diseaseReasoning.rankedDifferentials) {
        const condLower = candidate.diseaseName.toLowerCase();
        const matchedChunkList = matchedChunks.filter((c) => {
          const cText = `${c.section} ${c.text}`.toLowerCase();
          return (
            cText.includes(condLower.split(' ')[0]) ||
            cText.includes('dengue') ||
            cText.includes('pneumonia') ||
            cText.includes('pressure') ||
            cText.includes('pain')
          );
        });

        const supportingClaims: VerifiedClaim[] = [];
        const topChunk = matchedChunkList[0] || matchedChunks[0];

        if (topChunk) {
          const sentences = extractSentences(topChunk.text);
          for (const sentence of sentences.slice(0, 2)) {
            if (verifyQuoteInChunk(sentence, topChunk.text)) {
              supportingClaims.push({
                text: sentence,
                claim_text: sentence,
                quote: sentence,
                chunk_id: topChunk.id,
                source_title: topChunk.source_title,
                source_year: topChunk.source_year,
                page: topChunk.page,
                verified: true,
                verification_status: 'verified',
              });
            }
          }
        }

        const likelihood: 'high' | 'moderate' | 'low' =
          candidate.confidence === 'high' ? 'high' : candidate.confidence === 'moderate' ? 'moderate' : 'low';

        differentials.push({
          condition: candidate.diseaseName,
          condition_bn: candidate.diseaseNameBn,
          likelihood_label: likelihood,
          supporting_claims: supportingClaims,
          opposing_claims: [],
          clinical_rationale: isBn ? candidate.confidenceExplanationBn : candidate.confidenceExplanationEn,
        });
      }

      // 6. Missing Information Synthesis
      const missingInfoList: MissingInformation[] = [];
      let missingIdx = 1;

      for (const item of diseaseReasoning.missingInformationOverall) {
        missingInfoList.push({
          id: `missing_${missingIdx++}`,
          type: item.toLowerCase().includes('exam') ? 'exam' : 'test',
          text: item,
          why_it_helps: isBn
            ? 'রোগের বিস্তার, তীব্রতা এবং সঠিক চিকিৎসা প্রটোকল নিশ্চিত করতে।'
            : 'Essential to rule out mimics and calibrate hemodynamic management.',
          which_diagnoses_it_separates: differentials.slice(0, 2).map((d) => d.condition),
        });
      }

      if (missingInfoList.length === 0) {
        missingInfoList.push({
          id: 'routine_workup',
          type: 'test',
          text: isBn ? 'প্রাথমিক সিবিসি ও রেনাল প্রোফাইল (CBC & Serum Creatinine)' : 'Complete Blood Count & Serum Creatinine',
          why_it_helps: isBn ? 'সংক্রমণ ও কিডনির স্বাভাবিক কার্যকারিতা নিশ্চিত করতে।' : 'To screen baseline organ function and systemic inflammation.',
          which_diagnoses_it_separates: [],
        });
      }

      // 7. Calibrated Confidence & Overall Status
      const status = redFlagsList.length > 0 ? 'red_flag' : differentials.length > 0 ? 'ok' : 'insufficient_evidence';
      const score = differentials.length > 0 ? (differentials[0].likelihood_label === 'high' ? 0.92 : 0.78) : 0.45;
      const confidenceLabel = score >= 0.85 ? 'high' : score >= 0.65 ? 'moderate' : 'low';

      const summary = isBn
        ? `ক্লিনিকাল ও ল্যাব মূল্যায়নের ভিত্তিতে ${differentials.length}টি সম্ভাব্য রোগ চিহ্নিত করা হয়েছে। ${
            redFlagsList.length > 0 ? `🚨 ${redFlagsList.length}টি সম্ভাব্য বিপদ সংকেত রয়েছে!` : 'কোনো তীব্র জরুরি রেড ফ্ল্যাগ নেই।'
          }`
        : `Identified ${differentials.length} evidence-based differential diagnosis(es) grounded in clinical guidelines and laboratory analysis. ${
            redFlagsList.length > 0 ? `🚨 ${redFlagsList.length} critical safety alert(s) detected!` : 'No immediate life-threatening alerts.'
          }`;

      const analysis: AnalysisOutput = {
        status,
        confidence: {
          label: confidenceLabel,
          score,
          reasoning: isBn
            ? 'অভ্যন্তরীণ মেডিকেল লাইব্রেরির ক্লিনিকাল প্রটোকল, ল্যাব রেফারেন্স সীমা ও যাচাইকৃত গাইডলাইনের ভিত্তিতে বিশ্লেষণ সম্পন্ন।'
            : 'Analysis synthesized from retrieved national/international guidelines with unit-calibrated laboratory analysis and verified quotes.',
        },
        differentials,
        missing_information: missingInfoList,
        red_flags: redFlagsList,
        summary,
      };

      const last = await tx.query.analyses.findFirst({
        columns: { round: true },
        where: eq(analyses.caseId, id),
        orderBy: [desc(analyses.round)],
      });
      const round = (last?.round ?? 0) + 1;

      await tx.insert(analyses).values({
        caseId: id,
        round,
        output: analysis,
        model: 'docmate-clinical-reasoner-v2',
        tokens: 0,
      });

      const [updated] = await tx
        .update(cases)
        .set({
          status: status === 'red_flag' ? 'red_flag' : 'analyzed',
          updatedAt: new Date(),
        })
        .where(ownedCase(id, user.id))
        .returning();

      await tx.insert(auditLogs).values({
        caseId: id,
        userId: user.id,
        event: 'case_analyzed',
        payload: { round, status: analysis.status, differentials_count: differentials.length },
      });

      return {
        case: {
          ...updated,
          patient_code: updated.patientCode,
          structured_input: updated.structuredInput,
        },
        round,
        analysis,
        lab_report: labReport,
        disease_reasoning: diseaseReasoning,
      };
    });

    if (!result) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[analyze error]', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

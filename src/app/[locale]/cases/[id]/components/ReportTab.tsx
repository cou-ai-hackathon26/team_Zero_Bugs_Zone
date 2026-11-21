'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  PatientCase,
  TreatmentPlan,
  StructuredPatientInput,
  TreatmentSuggestion,
} from '@/types';
import {
  Printer,
  FileText,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

interface ReportTabProps {
  caseData: PatientCase;
  treatmentPlan: TreatmentPlan | null;
  approvedDrugIds: Set<string>;
  acknowledgedAlerts: Set<string>;
  doctorNotes: string;
}

export function ReportTab({
  caseData,
  treatmentPlan,
  approvedDrugIds,
  acknowledgedAlerts,
  doctorNotes,
}: ReportTabProps) {
  const t = useTranslations('report');
  const format = useFormatter();
  const tTreatment = useTranslations('treatment');
  const input = ((caseData.structured_input || (caseData as unknown as Record<string, unknown>).structuredInput) || {}) as unknown as StructuredPatientInput;
  const patientCode = caseData.patient_code || (caseData as unknown as Record<string, unknown>).patientCode as string;
  const vitals = input.vitals || {};

  const approvedDrugs: TreatmentSuggestion[] = [];
  if (treatmentPlan) {
    treatmentPlan.first_line?.forEach((d) => {
      if (approvedDrugIds.has(d.drug_id)) approvedDrugs.push(d);
    });
    treatmentPlan.alternatives?.forEach((d) => {
      if (approvedDrugIds.has(d.drug_id)) approvedDrugs.push(d);
    });
  }

  const acknowledgedAlertItems = treatmentPlan?.safety_alerts.filter((a) =>
    acknowledgedAlerts.has(a.id)
  ) || [];

  return (
    <div className="space-y-4">
      {/* Top action bar (hidden on print) */}
      <div className="flex items-center justify-between no-print bg-card p-3 rounded-lg border border-border/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {t('draftPreview')}
          </span>
        </div>
        <Button disabled size="sm" className="gap-1.5 text-xs font-semibold">
          <Printer className="w-3.5 h-3.5" />
          {tTreatment('printReport')}
        </Button>
      </div>

      {/* Printable Report Document */}
      <Card className="no-print border border-border shadow-xs bg-white text-black p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl text-primary tracking-tight">DocMate AI</span>
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-widest font-semibold">
                Clinical Decision Support
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Internal Closed-Library Decision Support System &bull; Audit Trail ID: {caseData.id.slice(0, 8)}
            </p>
          </div>

          <div className="text-right text-xs space-y-0.5">
            <p className="font-semibold text-foreground">{t('caseDate')}: {caseData.created_at ? format.dateTime(new Date(caseData.created_at), { dateStyle: 'medium', timeZone: 'UTC' }) : '—'}</p>
            <p className="text-muted-foreground">Patient Code: <strong className="text-foreground">{patientCode}</strong></p>
            <Badge variant="outline" className="text-[10px] uppercase font-bold mt-1">
              {caseData.status}
            </Badge>
          </div>
        </div>

        {/* Persistent Legal Medical Disclaimer */}
        <div className="p-3 bg-muted/40 border border-border/70 rounded-md text-center space-y-0.5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground/80">
            Clinical decision support only. Not a substitute for professional judgement.
          </p>
          <p className="font-medium text-muted-foreground">
            শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।
          </p>
        </div>

        {/* Patient Profile & Baseline Vitals */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            {t('patientDetails')}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Age / Gender:</span>
              <span className="font-semibold capitalize">{input.age} yrs, {input.gender}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Weight:</span>
              <span className="font-semibold">{input.weight_kg ? `${input.weight_kg} kg` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Blood Pressure:</span>
              <span className="font-semibold">
                {vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic
                  ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic} mmHg`
                  : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Heart Rate / SpO2:</span>
              <span className="font-semibold">
                {vitals.heart_rate ? `${vitals.heart_rate} bpm` : 'N/A'} &bull;{' '}
                {vitals.spo2_percent ? `${vitals.spo2_percent}%` : 'N/A'}
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs space-y-1">
            <p>
              <strong className="text-muted-foreground font-semibold">Chief Complaint: </strong>
              <span className="font-medium">{input.chief_complaint}</span>
            </p>
            <p>
              <strong className="text-muted-foreground font-semibold">Known Allergies: </strong>
              <span className={input.allergies?.length ? 'font-bold text-rose-600' : 'italic text-muted-foreground'}>
                {input.allergies?.length ? input.allergies.join(', ') : t('noAllergiesRecorded')}
              </span>
            </p>
          </div>
        </div>

        <Separator />

        {/* Confirmed Diagnosis */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            {t('workingDiagnosis')}
          </h4>
          <div className="flex items-center gap-2 pt-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-sm text-foreground">
              {caseData.confirmed_diagnosis || treatmentPlan?.confirmed_diagnosis || 'Pending Diagnosis Confirmation'}
            </span>
          </div>
        </div>

        <Separator />

        {/* Prescribed Medications */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            {t('selectedTreatment')} ({approvedDrugs.length})
          </h4>

          {approvedDrugs.length > 0 ? (
            <div className="space-y-3">
              {approvedDrugs.map((drug, idx) => (
                <div
                  key={drug.drug_id}
                  className="p-3 rounded border border-border/80 bg-muted/10 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">
                      {idx + 1}. {drug.generic_name} ({drug.drug_class})
                    </span>
                    <span className="text-[11px] font-semibold text-primary uppercase">
                      {drug.route} &bull; {drug.frequency}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">
                    Dose: {drug.dose_text}
                  </p>
                  {drug.duration_days > 0 && (
                    <p className="text-muted-foreground text-[11px]">
                      Duration: {drug.duration_days} days
                    </p>
                  )}
                  {drug.rationale && (
                    <p className="text-muted-foreground italic text-[11px]">
                      Rationale: {drug.rationale}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No medications selected or approved yet.
            </p>
          )}
        </div>

        {/* Non-Pharmacological Care */}
        {treatmentPlan?.non_pharmacological && treatmentPlan.non_pharmacological.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
              Supportive &amp; Non-Pharmacological Care
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-foreground/90 pl-1">
              {treatmentPlan.non_pharmacological.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Safety & Interaction Review */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            {t('safetyReview')}
          </h4>

          {acknowledgedAlertItems.length > 0 ? (
            <div className="p-3 rounded border border-amber-500/30 bg-amber-500/5 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Physician Acknowledged Safety Overrides ({acknowledgedAlertItems.length}):</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground pl-1">
                {acknowledgedAlertItems.map((a) => (
                  <li key={a.id}>
                    <strong>{a.title}</strong>: {a.description}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <span>{t('safetyUnavailable')}</span>
            </div>
          )}
        </div>

        {/* Doctor Notes */}
        {doctorNotes && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
              Physician Instructions &amp; Follow-Up
            </h4>
            <p className="text-xs text-foreground bg-muted/20 p-2.5 rounded border border-border/60">
              {doctorNotes}
            </p>
          </div>
        )}

        <Separator />

        <p className="text-xs text-muted-foreground">{t('unsignedDraft')}</p>
      </Card>
    </div>
  );
}

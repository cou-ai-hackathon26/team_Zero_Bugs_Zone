'use client';

import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  PatientCase,
  CaseTurn,
  StructuredPatientInput,
  PatientVitals,
} from '@/types';
import {
  User,
  Heart,
  Activity,
  Thermometer,
  Wind,
  AlertTriangle,
  Pill,
  FileText,
  TestTube2,
  CheckCircle2,
  Baby,
  ShieldAlert,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PatientSummaryPanelProps {
  caseData: PatientCase;
  turns: CaseTurn[];
}

export function PatientSummaryPanel({ caseData, turns }: PatientSummaryPanelProps) {
  const t = useTranslations('workspace');
  const tIntake = useTranslations('intake');
  const input = ((caseData.structured_input || (caseData as unknown as Record<string, unknown>).structuredInput) || {}) as unknown as StructuredPatientInput;
  const patientCode = caseData.patient_code || (caseData as unknown as Record<string, unknown>).patientCode as string;
  const vitals = input.vitals || {};

  const getVitalStatus = (vital: keyof PatientVitals, val?: number) => {
    if (val === undefined || val === null) return null;
    switch (vital) {
      case 'spo2_percent':
        if (val < 92) return { text: 'Hypoxia / Critical', variant: 'destructive' as const };
        if (val < 95) return { text: 'Borderline', variant: 'secondary' as const };
        return { text: 'Normal', variant: 'outline' as const };
      case 'blood_pressure_systolic':
        if (val >= 180 || val < 90) return { text: 'Critical', variant: 'destructive' as const };
        if (val >= 140) return { text: 'Elevated', variant: 'secondary' as const };
        return { text: 'Normal', variant: 'outline' as const };
      case 'temperature_celsius':
        if (val >= 38.5) return { text: 'High Fever', variant: 'destructive' as const };
        if (val >= 37.5) return { text: 'Low-Grade', variant: 'secondary' as const };
        return { text: 'Normal', variant: 'outline' as const };
      case 'heart_rate':
        if (val > 110 || val < 50) return { text: 'Abnormal', variant: 'destructive' as const };
        if (val > 90) return { text: 'Tachycardia', variant: 'secondary' as const };
        return { text: 'Normal', variant: 'outline' as const };
      case 'respiratory_rate':
        if (val > 24 || val < 10) return { text: 'Tachypnea', variant: 'destructive' as const };
        return { text: 'Normal', variant: 'outline' as const };
      default:
        return null;
    }
  };

  return (
    <Card className="h-full flex flex-col border-border/80 shadow-xs overflow-hidden">
      <CardHeader className="p-3 sm:p-4 pb-2 border-b border-border/60">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                {t('patientSummary')} &bull; {patientCode}
              </CardTitle>
              <p className="text-[11px] sm:text-xs text-muted-foreground capitalize truncate">
                {input.age ? `${input.age} yrs, ` : ''}{input.gender}
                {input.weight_kg ? ` • ${input.weight_kg} kg` : ''}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] sm:text-xs uppercase font-medium shrink-0">
            {caseData.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-4 space-y-4">
        {/* Chief Complaint & Symptoms */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            {tIntake('chiefComplaint')}
          </h4>
          <p className="text-xs font-medium text-foreground bg-muted/60 p-2.5 rounded-md border border-border/60 leading-relaxed">
            {input.chief_complaint}
          </p>
          {input.symptoms && input.symptoms.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {input.symptoms.map((s, idx) => (
                <Badge key={idx} variant="secondary" className="text-[11px] font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Vitals Grid */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            {tIntake('vitals')}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {/* Blood Pressure */}
            <div className="p-2 rounded border border-border/70 bg-card text-xs flex flex-col justify-between">
              <span className="text-muted-foreground text-[10px] flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-500" />
                {tIntake('bp')}
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-semibold text-foreground text-sm">
                  {vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic
                    ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}`
                    : '—'}{' '}
                  <span className="text-[10px] text-muted-foreground font-normal">mmHg</span>
                </span>
                {getVitalStatus('blood_pressure_systolic', vitals.blood_pressure_systolic) && (
                  <Badge
                    variant={getVitalStatus('blood_pressure_systolic', vitals.blood_pressure_systolic)?.variant}
                    className="text-[9px] px-1 py-0"
                  >
                    {getVitalStatus('blood_pressure_systolic', vitals.blood_pressure_systolic)?.text}
                  </Badge>
                )}
              </div>
            </div>

            {/* Heart Rate */}
            <div className="p-2 rounded border border-border/70 bg-card text-xs flex flex-col justify-between">
              <span className="text-muted-foreground text-[10px] flex items-center gap-1">
                <Activity className="w-3 h-3 text-primary" />
                {tIntake('hr')}
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-semibold text-foreground text-sm">
                  {vitals.heart_rate ?? '—'}{' '}
                  <span className="text-[10px] text-muted-foreground font-normal">bpm</span>
                </span>
                {getVitalStatus('heart_rate', vitals.heart_rate) && (
                  <Badge
                    variant={getVitalStatus('heart_rate', vitals.heart_rate)?.variant}
                    className="text-[9px] px-1 py-0"
                  >
                    {getVitalStatus('heart_rate', vitals.heart_rate)?.text}
                  </Badge>
                )}
              </div>
            </div>

            {/* Respiratory Rate */}
            <div className="p-2 rounded border border-border/70 bg-card text-xs flex flex-col justify-between">
              <span className="text-muted-foreground text-[10px] flex items-center gap-1">
                <Wind className="w-3 h-3 text-cyan-600" />
                {tIntake('rr')}
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-semibold text-foreground text-sm">
                  {vitals.respiratory_rate ?? '—'}{' '}
                  <span className="text-[10px] text-muted-foreground font-normal">/min</span>
                </span>
                {getVitalStatus('respiratory_rate', vitals.respiratory_rate) && (
                  <Badge
                    variant={getVitalStatus('respiratory_rate', vitals.respiratory_rate)?.variant}
                    className="text-[9px] px-1 py-0"
                  >
                    {getVitalStatus('respiratory_rate', vitals.respiratory_rate)?.text}
                  </Badge>
                )}
              </div>
            </div>

            {/* Temperature */}
            <div className="p-2 rounded border border-border/70 bg-card text-xs flex flex-col justify-between">
              <span className="text-muted-foreground text-[10px] flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-amber-500" />
                {tIntake('temp')}
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-semibold text-foreground text-sm">
                  {vitals.temperature_celsius ?? '—'}{' '}
                  <span className="text-[10px] text-muted-foreground font-normal">°C</span>
                </span>
                {getVitalStatus('temperature_celsius', vitals.temperature_celsius) && (
                  <Badge
                    variant={getVitalStatus('temperature_celsius', vitals.temperature_celsius)?.variant}
                    className="text-[9px] px-1 py-0"
                  >
                    {getVitalStatus('temperature_celsius', vitals.temperature_celsius)?.text}
                  </Badge>
                )}
              </div>
            </div>

            {/* SpO2 */}
            <div className="col-span-2 p-2 rounded border border-border/70 bg-card text-xs flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-teal-600" />
                {tIntake('spo2')}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">
                  {vitals.spo2_percent !== undefined ? `${vitals.spo2_percent}%` : '—'}
                </span>
                {getVitalStatus('spo2_percent', vitals.spo2_percent) && (
                  <Badge
                    variant={getVitalStatus('spo2_percent', vitals.spo2_percent)?.variant}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {getVitalStatus('spo2_percent', vitals.spo2_percent)?.text}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Known Allergies */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            {tIntake('allergies')}
          </h4>
          {input.allergies && input.allergies.length > 0 ? (
            <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-medium space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Known Allergies Reported:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                {input.allergies.map((allergy, i) => (
                  <li key={i}>{allergy}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No known drug allergies (NKDA)</p>
          )}
        </div>

        <Separator />

        {/* Current Medicines */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5 text-indigo-500" />
            {tIntake('currentMedicines')}
          </h4>
          {input.current_medicines && input.current_medicines.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {input.current_medicines.map((med, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-muted/40 font-normal">
                  {med}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No regular medications</p>
          )}
        </div>

        {/* Past Medical History */}
        {input.past_medical_history && input.past_medical_history.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tIntake('pastHistory')}
              </h4>
              <div className="flex flex-wrap gap-1">
                {input.past_medical_history.map((hist, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">
                    {hist}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Lab Values */}
        {input.lab_values && input.lab_values.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TestTube2 className="w-3.5 h-3.5 text-teal-600" />
                {tIntake('labs')}
              </h4>
              <div className="space-y-1">
                {input.lab_values.map((lab, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-1.5 rounded bg-muted/40 text-xs border border-border/40"
                  >
                    <span className="font-medium text-foreground">{lab.name}</span>
                    <span className="font-semibold text-primary">
                      {lab.value}{' '}
                      <span className="text-[10px] text-muted-foreground font-normal">{lab.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Special Clinical Conditions (Pregnancy, Renal) */}
        {(input.is_pregnant || input.egfr !== undefined) && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clinical Flags
              </h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {input.is_pregnant && (
                  <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                    <Baby className="w-3 h-3" />
                    Pregnant {input.pregnancy_trimester ? `(Trimester ${input.pregnancy_trimester})` : ''}
                  </Badge>
                )}
                {input.egfr !== undefined && (
                  <Badge
                    variant={input.egfr < 60 ? 'destructive' : 'outline'}
                    className="gap-1 text-xs"
                  >
                    eGFR: {input.egfr} mL/min/1.73m²
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}

        {/* Follow-up Q&A History */}
        {turns && turns.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Follow-up Q&amp;A History
              </h4>
              <div className="space-y-2">
                {turns.map((turn) => {
                  const content = turn.content as Record<string, string>;
                  return (
                    <div
                      key={turn.id}
                      className="p-2.5 rounded-md border border-border/70 bg-muted/30 text-xs space-y-1"
                    >
                      {content.question && (
                        <p className="font-semibold text-foreground/90">
                          Q: {content.question}
                        </p>
                      )}
                      {content.answer && (
                        <p className="text-emerald-700 dark:text-emerald-400 font-medium pl-2 border-l-2 border-emerald-500">
                          A: &ldquo;{content.answer}&rdquo;
                        </p>
                      )}
                      {content.note && (
                        <p className="text-muted-foreground italic pl-2 border-l-2 border-primary">
                          Note: {content.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </ScrollArea>
    </Card>
  );
}

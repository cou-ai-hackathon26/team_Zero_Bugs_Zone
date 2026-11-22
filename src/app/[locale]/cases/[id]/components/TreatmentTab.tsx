'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CitationChip } from '@/components/shared/CitationChip';
import { SafetyAlertItem } from '@/components/shared/SafetyAlertItem';
import {
  TreatmentPlan,
  TreatmentSuggestion,
} from '@/types';
import {
  Pill,
  CheckCircle2,
  FileCheck,
  Stethoscope,
  Clock,
  ShieldAlert,
  Loader2,
  Lock,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface TreatmentTabProps {
  confirmedDiagnosis?: string;
  treatmentPlan: TreatmentPlan | null;
  loading: boolean;
  onGenerateTreatment: () => void;
  onOpenConfirmDiag: () => void;
  approvedDrugIds: Set<string>;
  onToggleDrug: (drugId: string) => void;
  acknowledgedAlerts: Set<string>;
  onAcknowledgeAlert: (alertId: string) => void;
  doctorNotes: string;
  onDoctorNotesChange: (notes: string) => void;
  onFinalizePrescription: () => void;
  isFinalized: boolean;
  finalizing: boolean;
}

export function TreatmentTab({
  confirmedDiagnosis,
  treatmentPlan,
  loading,
  onGenerateTreatment,
  onOpenConfirmDiag,
  approvedDrugIds,
  onToggleDrug,
  acknowledgedAlerts,
  onAcknowledgeAlert,
  doctorNotes,
  onDoctorNotesChange,
  onFinalizePrescription,
  isFinalized,
  finalizing,
}: TreatmentTabProps) {
  const locale = useLocale();
  const t = useTranslations('treatment');

  if (!confirmedDiagnosis) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {locale === 'bn' ? 'কোনো রোগ নির্ধারিত হয়নি' : 'No Working Diagnosis Confirmed'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {locale === 'bn'
              ? 'ওষুধের সঠিক মাত্রা ও নিরাপত্তা যাচাই করতে প্রথমে একটি রোগ নির্ধারণ করুন।'
              : 'Please confirm a working diagnosis first to generate dosage-validated treatment options.'}
          </p>
        </div>
        <Button onClick={onOpenConfirmDiag} size="sm" className="gap-2 font-semibold text-xs h-8">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{locale === 'bn' ? 'রোগ নির্ধারণ করুন' : 'Select Diagnosis'}</span>
        </Button>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {locale === 'bn' ? 'চিকিৎসা প্রটোকল প্রস্তুত করা হচ্ছে...' : 'Validating Treatment Protocols...'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {locale === 'bn'
              ? 'রোগীর অ্যালার্জি, ইন্টারঅ্যাকশন ও রেনাল ডোজ নিরাপত্তা যাচাই করা হচ্ছে...'
              : 'Executing deterministic allergy, drug interaction, and renal safety rules...'}
          </p>
        </div>
      </Card>
    );
  }

  if (!treatmentPlan) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Pill className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {locale === 'bn' ? 'নির্ধারিত রোগ:' : 'Working Diagnosis:'} {confirmedDiagnosis}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {t('unavailable')}
          </p>
        </div>
        <Button disabled onClick={onGenerateTreatment} size="sm" className="gap-2 font-semibold text-xs h-8">
          <FileCheck className="w-3.5 h-3.5" />
          <span>{locale === 'bn' ? 'চিকিৎসা তৈরি করুন' : 'Generate Treatment Plan'}</span>
        </Button>
      </Card>
    );
  }

  // Count unacknowledged critical alerts
  const criticalAlerts = treatmentPlan.safety_alerts.filter(
    (a) => a.severity === 'critical'
  );
  const unacknowledgedCriticalCount = criticalAlerts.filter(
    (a) => !acknowledgedAlerts.has(a.id)
  ).length;

  const renderDrugCard = (drug: TreatmentSuggestion, isFirstLine: boolean) => {
    const isApproved = approvedDrugIds.has(drug.drug_id);
    const relatedAlerts = treatmentPlan.safety_alerts.filter(
      (a) => a.drug_id === drug.drug_id
    );

    return (
      <Card
        key={drug.drug_id}
        className={`border transition-all ${
          isApproved
            ? 'border-primary/60 bg-card shadow-2xs'
            : 'border-border/60 bg-muted/20 opacity-80'
        }`}
      >
        <CardHeader className="p-3.5 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Checkbox
                id={`drug-${drug.drug_id}`}
                checked={isApproved}
                disabled={isFinalized}
                onCheckedChange={() => onToggleDrug(drug.drug_id)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <label
                  htmlFor={`drug-${drug.drug_id}`}
                  className="text-xs sm:text-sm font-bold text-foreground cursor-pointer flex items-center gap-1.5 flex-wrap"
                >
                  <span>{drug.generic_name}</span>
                  {isFirstLine ? (
                    <Badge className="bg-emerald-600 text-white text-[10px] py-0">First Line</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0">Alternative</Badge>
                  )}
                </label>
                <p className="text-[11px] text-muted-foreground font-medium">{drug.drug_class}</p>
              </div>
            </div>

            {drug.claim && (
              <CitationChip claim={drug.claim} className="shrink-0" />
            )}
          </div>
        </CardHeader>

        <CardContent className="p-3.5 pt-0 space-y-2.5">
          {/* Dose rules (Deterministic) */}
          <div className="p-2 rounded-md bg-primary/5 border border-primary/20 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary flex items-center gap-1">
                <Pill className="w-3.5 h-3.5" />
                <span>{t('dose')}:</span>
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-medium">
                {drug.route} • {drug.frequency}
              </span>
            </div>
            <p className="font-bold text-foreground">
              {drug.dose_text}
            </p>
            {drug.duration_days > 0 && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{locale === 'bn' ? `মেয়াদ: ${drug.duration_days} দিন` : `Duration: ${drug.duration_days} days`}</span>
              </p>
            )}
          </div>

          {/* Rationale */}
          <p className="text-xs text-foreground/90 leading-relaxed">
            <span className="text-muted-foreground font-medium">{t('rationale')}: </span>
            {drug.rationale}
          </p>

          {/* Monitoring & Follow-up */}
          {(drug.monitoring?.length > 0 || drug.follow_up) && (
            <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
              {drug.monitoring?.length > 0 && (
                <p>
                  <strong className="text-foreground/80 font-medium">{t('monitoring')}:</strong>{' '}
                  {drug.monitoring.join(', ')}
                </p>
              )}
              {drug.follow_up && (
                <p>
                  <strong className="text-foreground/80 font-medium">{t('followUp')}:</strong>{' '}
                  {drug.follow_up}
                </p>
              )}
            </div>
          )}

          {/* Related Safety Alerts */}
          {relatedAlerts.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {relatedAlerts.map((alert) => (
                <SafetyAlertItem
                  key={alert.id}
                  alert={{ ...alert, acknowledged: acknowledgedAlerts.has(alert.id) }}
                  onAcknowledge={onAcknowledgeAlert}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-lg bg-card border border-border/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              {t('title')}
            </h3>
            <Badge className="bg-emerald-600 text-white text-[10px]">
              {confirmedDiagnosis}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        {isFinalized && (
          <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 bg-emerald-500/10">
            <Lock className="w-3 h-3" />
            <span>{locale === 'bn' ? 'প্রেসক্রিপশন চূড়ান্ত' : 'Prescription Finalized'}</span>
          </Badge>
        )}
      </div>

      {/* Critical Safety Block Banner */}
      {criticalAlerts.length > 0 && (
        <Alert variant="destructive" className="border shadow-xs">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <AlertTitle className="text-xs font-bold">
            {criticalAlerts.length} Critical Safety Alerts
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {t('criticalAlertWarning')}
          </AlertDescription>
        </Alert>
      )}

      {/* First-Line Therapeutic Regimens */}
      {treatmentPlan.first_line && treatmentPlan.first_line.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            {t('firstLine')} ({treatmentPlan.first_line.length})
          </h4>
          <div className="space-y-2">
            {treatmentPlan.first_line.map((drug) => renderDrugCard(drug, true))}
          </div>
        </div>
      )}

      {/* Alternative Regimens */}
      {treatmentPlan.alternatives && treatmentPlan.alternatives.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            {t('alternatives')} ({treatmentPlan.alternatives.length})
          </h4>
          <div className="space-y-2">
            {treatmentPlan.alternatives.map((drug) => renderDrugCard(drug, false))}
          </div>
        </div>
      )}

      {/* Non-Pharmacological Care */}
      {treatmentPlan.non_pharmacological && treatmentPlan.non_pharmacological.length > 0 && (
        <Card className="p-3.5 border-border/80 bg-card shadow-2xs space-y-2 text-xs">
          <h4 className="font-bold text-foreground">
            {t('nonPharmacological')}
          </h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed">
            {treatmentPlan.non_pharmacological.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Doctor Notes & Finalize CTA */}
      <Card className="p-3.5 border-border/80 bg-card shadow-2xs space-y-3">
        <div className="space-y-1">
          <label htmlFor="doc-notes" className="text-xs font-semibold text-foreground block">
            {locale === 'bn' ? 'চিকিৎসকের অতিরিক্ত নির্দেশনা ও পরামর্শ:' : 'Attending Physician Notes & Advice:'}
          </label>
          <Textarea
            id="doc-notes"
            placeholder={locale === 'bn' ? 'রোগীর জন্য কোনো বিশেষ পরামর্শ লিখুন...' : 'Enter lifestyle recommendations, precautions, or follow-up notes...'}
            value={doctorNotes}
            disabled={isFinalized}
            onChange={(e) => onDoctorNotesChange(e.target.value)}
            rows={2}
            className="text-xs resize-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
          <div className="text-[11px] text-muted-foreground">
            {approvedDrugIds.size} {locale === 'bn' ? 'ওষুধ নির্বাচিত' : 'drug(s) selected'}
            {unacknowledgedCriticalCount > 0 && (
              <span className="text-destructive font-semibold ml-1">
                • {unacknowledgedCriticalCount} critical alert(s) unacknowledged
              </span>
            )}
          </div>

          {!isFinalized && (
            <Button
              size="sm"
              onClick={onFinalizePrescription}
              disabled={approvedDrugIds.size === 0 || finalizing}
              className="gap-1.5 text-xs font-semibold h-8"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>{t('finalizePrescription')}</span>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

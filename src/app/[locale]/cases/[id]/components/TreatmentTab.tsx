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
  AlertTriangle,
  FileCheck,
  Stethoscope,
  Clock,
  Activity,
  ShieldAlert,
  Loader2,
  Lock,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('treatment');

  if (!confirmedDiagnosis) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Stethoscope className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            No Working Diagnosis Confirmed
          </h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Treatment protocols and deterministic dosage validation require an active working diagnosis confirmed by the attending physician.
          </p>
        </div>
        <Button onClick={onOpenConfirmDiag} className="gap-2 font-semibold text-xs">
          <CheckCircle2 className="w-4 h-4" />
          Select &amp; Confirm Diagnosis
        </Button>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            Evaluating Treatment Protocols &amp; Safety Checks...
          </h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Retrieving clinical guidelines, pulling structured drug formulary rules, and executing deterministic allergy, interaction, and renal safety engine...
          </p>
        </div>
      </Card>
    );
  }

  if (!treatmentPlan) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Pill className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            Confirmed Working Diagnosis: {confirmedDiagnosis}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md">
            {t('unavailable')}
          </p>
        </div>
        <Button disabled onClick={onGenerateTreatment} className="gap-2 font-semibold text-xs">
          <FileCheck className="w-4 h-4" />
          Generate Treatment Plan
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
            ? 'border-primary/60 bg-card shadow-xs'
            : 'border-border/60 bg-muted/20 opacity-80'
        }`}
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`drug-${drug.drug_id}`}
                checked={isApproved}
                disabled={isFinalized}
                onCheckedChange={() => onToggleDrug(drug.drug_id)}
                className="mt-1"
              />
              <div>
                <label
                  htmlFor={`drug-${drug.drug_id}`}
                  className="text-sm font-bold text-foreground cursor-pointer flex items-center gap-2"
                >
                  {drug.generic_name}
                  {isFirstLine ? (
                    <Badge className="bg-emerald-600 text-white text-[10px] py-0">First Line</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0">Alternative</Badge>
                  )}
                </label>
                <p className="text-xs text-muted-foreground font-medium">{drug.drug_class}</p>
              </div>
            </div>

            {drug.claim && (
              <CitationChip claim={drug.claim} />
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-1 space-y-3">
          {/* Dose rules (Deterministic) */}
          <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-primary flex items-center gap-1">
                <Pill className="w-3.5 h-3.5" />
                {t('dose')} (Deterministic Formulary):
              </span>
              <span className="text-[11px] text-muted-foreground uppercase font-medium">
                {drug.route} &bull; {drug.frequency}
              </span>
            </div>
            <p className="text-xs font-bold text-foreground">
              {drug.dose_text}
            </p>
            {drug.duration_days > 0 && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Recommended Duration: {drug.duration_days} days
              </p>
            )}
          </div>

          {/* Rationale */}
          <p className="text-xs text-foreground/90 leading-relaxed">
            <strong className="text-muted-foreground font-medium">{t('rationale')}: </strong>
            {drug.rationale}
          </p>

          {/* Monitoring & Follow-up */}
          {(drug.monitoring?.length > 0 || drug.follow_up) && (
            <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border/40">
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
    <div className="space-y-5">
      {/* Confirmed Diagnosis Header */}
      <Card className="p-4 border-emerald-500/30 bg-emerald-500/5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Confirmed Working Diagnosis
              </span>
              <h3 className="text-sm font-bold text-foreground">
                {confirmedDiagnosis}
              </h3>
            </div>
          </div>

          {!isFinalized && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenConfirmDiag}
              className="text-xs"
            >
              Change Diagnosis
            </Button>
          )}
        </div>
      </Card>

      {/* Critical Alert Warning (if unacknowledged) */}
      {unacknowledgedCriticalCount > 0 && (
        <Alert variant="destructive" className="border-2 shadow-sm">
          <ShieldAlert className="w-5 h-5 animate-bounce" />
          <div className="flex-1">
            <AlertTitle className="text-sm font-bold">
              {t('criticalAlertWarning')} ({unacknowledgedCriticalCount} pending)
            </AlertTitle>
            <AlertDescription className="text-xs mt-1">
              Hospital clinical safety policy requires the prescribing physician to explicitly acknowledge and override critical contraindications or severe drug interactions before finalising the prescription.
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* First-Line Regimens */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Pill className="w-3.5 h-3.5 text-primary" />
          {t('firstLine')} ({treatmentPlan.first_line?.length || 0})
        </h4>
        <div className="space-y-3">
          {treatmentPlan.first_line?.map((drug) => renderDrugCard(drug, true))}
        </div>
      </div>

      {/* Alternative Regimens */}
      {treatmentPlan.alternatives && treatmentPlan.alternatives.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('alternatives')} ({treatmentPlan.alternatives.length})
          </h4>
          <div className="space-y-3">
            {treatmentPlan.alternatives.map((drug) => renderDrugCard(drug, false))}
          </div>
        </div>
      )}

      {/* Non-Pharmacological Care */}
      {treatmentPlan.non_pharmacological && treatmentPlan.non_pharmacological.length > 0 && (
        <Card className="p-4 border-border/80">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            {t('nonPharmacological')}
          </h4>
          <ul className="list-disc list-inside space-y-1 text-xs text-foreground/90 leading-relaxed">
            {treatmentPlan.non_pharmacological.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Doctor Notes & Finalization */}
      <Card className="p-4 border-border/80 space-y-3 bg-card shadow-xs">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileCheck className="w-3.5 h-3.5 text-primary" />
          Physician Finalization &amp; Prescription Notes
        </h4>

        <Textarea
          placeholder="Enter special patient instructions, dosage adjustments, or review timeline..."
          value={doctorNotes}
          disabled={isFinalized}
          onChange={(e) => onDoctorNotesChange(e.target.value)}
          rows={3}
          className="text-xs"
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/60">
          <p className="text-[11px] text-muted-foreground">
            {isFinalized ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Prescription finalized and locked in audit trail.
              </span>
            ) : unacknowledgedCriticalCount > 0 ? (
              <span className="text-destructive font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Must acknowledge {unacknowledgedCriticalCount} critical safety alert(s) first.
              </span>
            ) : (
              <span>Ready to sign and create printable clinical record.</span>
            )}
          </p>

          <Button
            onClick={onFinalizePrescription}
            disabled
            className="gap-2 font-semibold text-xs shrink-0 w-full sm:w-auto"
          >
            {isFinalized ? (
              <>
                <Lock className="w-4 h-4" />
                Prescription Finalized
              </>
            ) : finalizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Finalizing...
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                {t('finalizePrescription')}
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

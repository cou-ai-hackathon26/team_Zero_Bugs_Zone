'use client';

import { useTranslations } from 'next-intl';
import React from 'react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SafetyAlertItem } from '@/components/shared/SafetyAlertItem';
import { PatientCase, TreatmentPlan, StructuredPatientInput } from '@/types';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Baby,
  Activity,
  CheckCircle2,
} from 'lucide-react';

interface SafetyTabProps {
  caseData: PatientCase;
  treatmentPlan: TreatmentPlan | null;
  acknowledgedAlerts: Set<string>;
  onAcknowledgeAlert: (alertId: string) => void;
}

export function SafetyTab({
  caseData,
  treatmentPlan,
  acknowledgedAlerts,
  onAcknowledgeAlert,
}: SafetyTabProps) {
  const t = useTranslations('report');
  if (!treatmentPlan) {
    return <Alert><AlertDescription>{t('safetyUnavailable')}</AlertDescription></Alert>;
  }

  const input = ((caseData.structured_input || (caseData as unknown as Record<string, unknown>).structuredInput) || {}) as unknown as StructuredPatientInput;

  const alerts = treatmentPlan?.safety_alerts || [];
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  const infoAlerts = alerts.filter((a) => a.severity === 'info');

  return (
    <div className="space-y-4">
      {/* Overview Status Banner */}
      {criticalAlerts.length > 0 ? (
        <Alert variant="destructive" className="border-2 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          <AlertTitle className="text-sm font-bold">
            {criticalAlerts.length} Critical Safety Alerts Detected
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Deterministic drug rules identified high-risk allergies, severe drug interactions, or absolute contraindications. Each critical alert must be acknowledged.
          </AlertDescription>
        </Alert>
      ) : alerts.length > 0 ? (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <AlertTitle className="text-sm font-semibold">
            {alerts.length} Clinical Safety Flags &amp; Monitoring Recommendations
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 text-amber-800 dark:text-amber-300">
            Review cautionary adjustments, monitoring parameters, and minor interactions below.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <AlertTitle className="text-sm font-semibold">
            Zero Safety Conflicts Detected
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 text-emerald-800 dark:text-emerald-300">
            All candidate medications pass patient allergy screens, drug-drug interaction matrix checks, and renal dosing criteria.
          </AlertDescription>
        </Alert>
      )}

      {/* Patient Clinical Baseline Profile */}
      <Card className="p-4 border-border/80 bg-card shadow-2xs space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Patient Safety Baseline
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded-md bg-muted/40 border border-border/50 space-y-1">
            <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-500" /> Allergies
            </span>
            <p className="font-semibold text-foreground">
              {input.allergies?.length ? input.allergies.join(', ') : t('noAllergiesRecorded')}
            </p>
          </div>

          <div className="p-2.5 rounded-md bg-muted/40 border border-border/50 space-y-1">
            <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center gap-1">
              <Activity className="w-3 h-3 text-primary" /> Renal eGFR
            </span>
            <p className="font-semibold text-foreground">
              {input.egfr ? `${input.egfr} mL/min/1.73m²` : 'Not specified (assumed > 60)'}
            </p>
          </div>

          <div className="p-2.5 rounded-md bg-muted/40 border border-border/50 space-y-1">
            <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center gap-1">
              <Baby className="w-3 h-3 text-amber-500" /> Pregnancy Status
            </span>
            <p className="font-semibold text-foreground">
              {input.is_pregnant
                ? `Pregnant (Trimester ${input.pregnancy_trimester || 1})`
                : 'Not Pregnant / N/A'}
            </p>
          </div>
        </div>
      </Card>

      {/* Categorized Alerts List */}
      <div className="space-y-4">
        {criticalAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Critical Alerts (Override &amp; Acknowledgment Required)
            </h4>
            <div className="space-y-2">
              {criticalAlerts.map((alert) => (
                <SafetyAlertItem
                  key={alert.id}
                  alert={{ ...alert, acknowledged: acknowledgedAlerts.has(alert.id) }}
                  onAcknowledge={onAcknowledgeAlert}
                />
              ))}
            </div>
          </div>
        )}

        {warningAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Cautionary Warnings &amp; Dose Adjustments
            </h4>
            <div className="space-y-2">
              {warningAlerts.map((alert) => (
                <SafetyAlertItem
                  key={alert.id}
                  alert={{ ...alert, acknowledged: acknowledgedAlerts.has(alert.id) }}
                  onAcknowledge={onAcknowledgeAlert}
                />
              ))}
            </div>
          </div>
        )}

        {infoAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              Monitoring Guidance &amp; Info Notes
            </h4>
            <div className="space-y-2">
              {infoAlerts.map((alert) => (
                <SafetyAlertItem
                  key={alert.id}
                  alert={{ ...alert, acknowledged: acknowledgedAlerts.has(alert.id) }}
                  onAcknowledge={onAcknowledgeAlert}
                />
              ))}
            </div>
          </div>
        )}

        {alerts.length === 0 && (
          <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            <h3 className="text-sm font-semibold text-foreground">
              No Safety Warnings Active
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Confirm a working diagnosis and generate a treatment plan to run patient-specific safety checks against prescribed drugs.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

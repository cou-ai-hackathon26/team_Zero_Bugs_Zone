'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PatientDetailSheet } from './components/PatientDetailSheet';
import { CaseConversationTab } from './components/CaseConversationTab';
import { DifferentialsTab } from './components/DifferentialsTab';
import { MissingInfoTab } from './components/MissingInfoTab';
import { TreatmentTab } from './components/TreatmentTab';
import { SafetyTab } from './components/SafetyTab';
import { ReportTab } from './components/ReportTab';
import { ConfirmDiagnosisDialog } from './components/ConfirmDiagnosisDialog';
import { FinalizePrescriptionDialog } from './components/FinalizePrescriptionDialog';
import {
  PatientCase,
  CaseTurn,
  AnalysisOutput,
  TreatmentPlan,
  StructuredPatientInput,
} from '@/types';
import {
  Stethoscope,
  HelpCircle,
  Pill,
  ShieldCheck,
  FileText,
  ArrowLeft,
  MessagesSquare,
  User,
  CheckCircle2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { toast } from 'sonner';

interface CaseWorkspacePageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

function CaseWorkspaceContent({ params }: CaseWorkspacePageProps) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.id;

  const router = useRouter();
  const locale = useLocale();
  const tAnalysisGuard = useTranslations('analysisGuard');
  const searchParams = useSearchParams();
  const t = useTranslations('workspace');
  const tIntake = useTranslations('intake');

  // Active tab state (synced with ?tab=, defaults to conversation)
  const currentTab = searchParams.get('tab') || 'conversation';
  const [activeTab, setActiveTab] = useState<string>(currentTab);

  // Overlay states: Sheet & Drawer
  const [patientDetailOpen, setPatientDetailOpen] = useState(false);

  // Case & Clinical State
  const [caseData, setCaseData] = useState<PatientCase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisOutput | null>(null);
  const [turns, setTurns] = useState<CaseTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analysis execution state
  const [analyzing, setAnalyzing] = useState(false);

  // Treatment plan state
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null);
  const [treatmentLoading, setTreatmentLoading] = useState(false);
  const [approvedDrugIds, setApprovedDrugIds] = useState<Set<string>>(new Set());
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [signature, setSignature] = useState<string>('Dr. Farhana Rahman (MBBS, FCPS)');

  // Dialogs state
  const [confirmDiagOpen, setConfirmDiagOpen] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState('');
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  // Update tab in URL when changed
  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', val);
    router.replace(`?${params.toString()}`);
  };

  // Fetch treatment plan for diagnosis
  const fetchTreatmentPlan = useCallback(async (diagnosis: string) => {
    try {
      setTreatmentLoading(true);
      const res = await fetch(`/api/cases/${caseId}/treatment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedDiagnosis: diagnosis }),
      });
      const data = await res.json();
      if (res.status === 409 && data.status === 'insufficient_evidence') {
        setTreatmentPlan(null);
        setApprovedDrugIds(new Set());
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate treatment plan');
      }

      const plan = data.treatment || data.treatment_plan;
      setTreatmentPlan(plan);

      // Pre-select first-line drugs by default
      const defaultApproved = new Set<string>();
      plan?.first_line?.forEach((d: { drug_id: string }) => {
        defaultApproved.add(d.drug_id);
      });
      setApprovedDrugIds(defaultApproved);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Treatment error';
      toast.error(msg);
    } finally {
      setTreatmentLoading(false);
    }
  }, [caseId]);

  // Fetch case details, latest analysis, and turns
  const fetchCaseData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/cases/${caseId}`);
      if (!res.ok) {
        throw new Error('Case not found or unable to load.');
      }
      const data = await res.json();
      setCaseData(data.case);
      setAnalysis(data.analysis || null);
      setTurns(data.turns || []);

      if (data.case?.status === 'treated') {
        setIsFinalized(true);
      }

      if (data.case?.confirmedDiagnosis) {
        void fetchTreatmentPlan(data.case.confirmedDiagnosis);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load case';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [caseId, fetchTreatmentPlan]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCaseData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCaseData]);

  // Run clinical reasoning analysis
  const handleRunAnalysis = async () => {
    try {
      setAnalyzing(true);
      const res = await fetch(`/api/cases/${caseId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Clinical analysis failed');
      }

      setCaseData(data.case);
      setAnalysis(data.analysis);
      toast.info(tAnalysisGuard('completed'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to run analysis';
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  // Answer follow-up question
  const handleAnswerSubmit = async (
    questionId: string,
    answer: string,
    questionText: string
  ) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'question_answer',
          question_id: questionId,
          question: questionText,
          answer,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to record follow-up answer.');
      }

      const data = await res.json();
      if (data.turn) {
        setTurns((prev) => [...prev, data.turn]);
        toast.success(locale === 'bn' ? 'ক্লিনিকাল পর্যবেক্ষণ সংরক্ষিত' : 'Observation recorded');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting answer';
      toast.error(msg);
    }
  };

  // Confirm working diagnosis
  const handleConfirmDiagnosis = async (condition: string) => {
    if (!caseData) return;
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedDiagnosis: condition }),
      });
      if (!response.ok) throw new Error('Unable to record working diagnosis');
      setCaseData({
        ...caseData,
        confirmed_diagnosis: condition,
        status: 'confirmed',
      });
      toast.success(`${locale === 'bn' ? 'নির্ধারিত রোগ' : 'Confirmed diagnosis'}: ${condition}`);
      await fetchTreatmentPlan(condition);
      handleTabChange('treatment');
    } catch {
      toast.error('Failed to confirm working diagnosis');
    }
  };

  // Toggle drug approval
  const handleToggleDrug = (drugId: string) => {
    setApprovedDrugIds((prev) => {
      const next = new Set(prev);
      if (next.has(drugId)) {
        next.delete(drugId);
      } else {
        next.add(drugId);
      }
      return next;
    });
  };

  // Acknowledge safety alert
  const handleAcknowledgeAlert = (alertId: string) => {
    setAcknowledgedAlerts((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
    toast.success(locale === 'bn' ? 'নিরাপত্তা সতর্কতা নিশ্চিত করা হয়েছে' : 'Clinical safety override recorded.');
  };

  // Finalize prescription
  const handleFinalize = async () => {
    try {
      setFinalizing(true);
      const res = await fetch(`/api/cases/${caseId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_drugs: Array.from(approvedDrugIds),
          doctor_notes: doctorNotes,
          unacknowledged_critical_alerts_count: 0,
          signature,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to finalize prescription');
      }

      setIsFinalized(true);
      setFinalizeDialogOpen(false);
      toast.success(locale === 'bn' ? 'প্রেসক্রিপশন সফলভাবে চূড়ান্ত করা হয়েছে' : 'Prescription finalized and locked.');
      handleTabChange('report');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Finalization failed';
      toast.error(msg);
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <LoadingState message={locale === 'bn' ? 'কেস ওয়ার্কস্পেস লোড হচ্ছে...' : 'Loading patient case workspace...'} />
      </AppShell>
    );
  }

  if (error || !caseData) {
    return (
      <AppShell>
        <ErrorState
          title={locale === 'bn' ? 'কেস পাওয়া যায়নি' : 'Case Not Found'}
          message={error || (locale === 'bn' ? 'অনুরোধকৃত রোগীর কেস বিদ্যমান নেই।' : 'The requested patient case does not exist.')}
          onRetry={fetchCaseData}
        />
      </AppShell>
    );
  }

  const input = ((caseData.structured_input ||
    (caseData as unknown as Record<string, unknown>).structuredInput) ||
    {}) as unknown as StructuredPatientInput;

  const criticalAlerts =
    treatmentPlan?.safety_alerts.filter((a) => a.severity === 'critical') || [];
  const unacknowledgedCriticalCount = criticalAlerts.filter(
    (a) => !acknowledgedAlerts.has(a.id)
  ).length;

  const differentials = analysis?.differentials || [];

  return (
    <AppShell fullHeight>
      <div className="h-full min-h-0 flex flex-col overflow-hidden space-y-2">
        {/* Unified High-Density Clinical Workspace Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-card/90 backdrop-blur-xs shadow-2xs">
          {/* Left: Back button + Patient Code + Status + Demographics + Chief Complaint */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link href="/cases">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                title={locale === 'bn' ? 'সকল কেস' : 'All Cases'}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="sr-only">{locale === 'bn' ? 'সকল কেস' : 'All Cases'}</span>
              </Button>
            </Link>

            <div className="h-4 w-px bg-border/80 shrink-0 hidden sm:block" />

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-xs sm:text-sm text-foreground tracking-tight">
                {caseData.patient_code}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold h-5 px-1.5 py-0">
                {caseData.status.replace('_', ' ')}
              </Badge>
            </div>

            {input.chief_complaint && (
              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground min-w-0 overflow-hidden">
                <span className="h-3 w-px bg-border/60 shrink-0 mx-1" />
                <span className="font-medium text-foreground shrink-0">{tIntake('chiefComplaint')}:</span>
                <span className="truncate max-w-xs">{input.chief_complaint}</span>
              </div>
            )}
          </div>

          {/* Right: Diagnosis & Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {caseData.confirmed_diagnosis ? (
              <Badge className="bg-emerald-600 text-white text-[10px] gap-1 h-6 py-0 px-2 font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{caseData.confirmed_diagnosis}</span>
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDiagOpen(true)}
                className="h-7 px-2 text-xs font-semibold gap-1 text-primary border-primary/30"
              >
                <Stethoscope className="w-3 h-3" />
                <span>{locale === 'bn' ? 'রোগ নির্ধারণ' : 'Set Diagnosis'}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPatientDetailOpen(true)}
              className="h-7 px-2 text-xs font-semibold gap-1 border-primary/30 text-primary hover:bg-primary/10"
              aria-label={t('viewPatientSummary')}
            >
              <User className="w-3 h-3" />
              <span className="hidden sm:inline">{t('viewPatientSummary')}</span>
            </Button>
          </div>
        </div>

        {/* Slide-over Sheet (Desktop) & Bottom Drawer (Mobile) for Patient Details */}
        <PatientDetailSheet
          open={patientDetailOpen}
          onOpenChange={setPatientDetailOpen}
          caseData={caseData}
          turns={turns}
        />

        {/* Workspace Body: Full Width Tabbed Clinical Workspace */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-stretch">
          <div className="w-full h-full min-h-0 overflow-hidden flex flex-col bg-card rounded-xl border border-border/80 shadow-xs p-2 sm:p-2.5">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full h-full min-h-0 flex flex-col overflow-hidden">
              {/* Tab Navigation List */}
              <div className="shrink-0 border-b border-border/60 pb-2 mb-2 overflow-x-auto scrollbar-none">
                <TabsList className="flex flex-nowrap gap-1 p-0.5 bg-muted/80 rounded-lg min-w-max justify-start h-7.5">
                  <TabsTrigger
                    value="conversation"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <MessagesSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{t('tabConversation')}</span>
                    {turns.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5 h-4 min-w-4 flex items-center justify-center">
                        {turns.length}
                      </Badge>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="differentials"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <Stethoscope className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{t('tabDifferentials')}</span>
                    {analysis?.differentials?.length ? (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5 h-4 min-w-4 flex items-center justify-center">
                        {analysis.differentials.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>

                  <TabsTrigger
                    value="missing_info"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{t('tabMissingInfo')}</span>
                    {analysis?.missing_information?.length ? (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-0.5 h-4 min-w-4 flex items-center justify-center">
                        {analysis.missing_information.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>

                  <TabsTrigger
                    value="treatment"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <Pill className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{t('tabTreatment')}</span>
                    {caseData.confirmed_diagnosis && (
                      <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0 ml-0.5 h-4">
                        Ready
                      </Badge>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="safety"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{t('tabSafety')}</span>
                    {criticalAlerts.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-0.5 animate-pulse h-4">
                        {criticalAlerts.length} Critical
                      </Badge>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="report"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{t('tabReport')}</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab Contents - Full Height, Internal Scroll */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <TabsContent value="conversation" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <CaseConversationTab
                    caseId={caseId}
                    caseData={caseData}
                    turns={turns}
                    onTurnsUpdate={setTurns}
                    onCaseUpdate={setCaseData}
                    onOpenPatientDetail={() => setPatientDetailOpen(true)}
                    onSwitchTab={handleTabChange}
                  />
                </TabsContent>

                <TabsContent value="differentials" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <DifferentialsTab
                    analysis={analysis}
                    analyzing={analyzing}
                    onRunAnalysis={handleRunAnalysis}
                    onSelectDiagnosis={(cond) => {
                      setSelectedDiagnosis(cond);
                      setConfirmDiagOpen(true);
                    }}
                    onGoToMissingInfo={() => handleTabChange('missing_info')}
                  />
                </TabsContent>

                <TabsContent value="missing_info" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <MissingInfoTab
                    missingInfo={analysis?.missing_information || []}
                    onAnswerSubmit={handleAnswerSubmit}
                    onReAnalyze={handleRunAnalysis}
                    reAnalyzing={analyzing}
                  />
                </TabsContent>

                <TabsContent value="treatment" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <TreatmentTab
                    confirmedDiagnosis={caseData.confirmed_diagnosis}
                    treatmentPlan={treatmentPlan}
                    loading={treatmentLoading}
                    onGenerateTreatment={() => {
                      if (caseData.confirmed_diagnosis) {
                        void fetchTreatmentPlan(caseData.confirmed_diagnosis);
                      } else {
                        setConfirmDiagOpen(true);
                      }
                    }}
                    onOpenConfirmDiag={() => setConfirmDiagOpen(true)}
                    approvedDrugIds={approvedDrugIds}
                    onToggleDrug={handleToggleDrug}
                    acknowledgedAlerts={acknowledgedAlerts}
                    onAcknowledgeAlert={handleAcknowledgeAlert}
                    doctorNotes={doctorNotes}
                    onDoctorNotesChange={setDoctorNotes}
                    onFinalizePrescription={() => setFinalizeDialogOpen(true)}
                    isFinalized={isFinalized}
                    finalizing={finalizing}
                  />
                </TabsContent>

                <TabsContent value="safety" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <SafetyTab
                    caseData={caseData}
                    treatmentPlan={treatmentPlan}
                    acknowledgedAlerts={acknowledgedAlerts}
                    onAcknowledgeAlert={handleAcknowledgeAlert}
                  />
                </TabsContent>

                <TabsContent value="report" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <ReportTab
                    caseData={caseData}
                    treatmentPlan={treatmentPlan}
                    approvedDrugIds={approvedDrugIds}
                    acknowledgedAlerts={acknowledgedAlerts}
                    doctorNotes={doctorNotes}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Confirm Working Diagnosis Dialog (Modal) */}
        <ConfirmDiagnosisDialog
          open={confirmDiagOpen}
          onOpenChange={setConfirmDiagOpen}
          differentials={differentials}
          initialCondition={selectedDiagnosis || differentials[0]?.condition}
          onConfirm={handleConfirmDiagnosis}
        />

        {/* Finalize Prescription Dialog (AlertDialog) */}
        <FinalizePrescriptionDialog
          open={finalizeDialogOpen}
          onOpenChange={setFinalizeDialogOpen}
          signature={signature}
          onSignatureChange={setSignature}
          onFinalize={handleFinalize}
          finalizing={finalizing}
          unacknowledgedCriticalCount={unacknowledgedCriticalCount}
        />
      </div>
    </AppShell>
  );
}

export default function CaseWorkspacePage(props: CaseWorkspacePageProps) {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground animate-pulse">লোড হচ্ছে...</div>}>
      <CaseWorkspaceContent {...props} />
    </React.Suspense>
  );
}

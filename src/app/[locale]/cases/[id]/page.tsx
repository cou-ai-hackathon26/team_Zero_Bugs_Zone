'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PatientSummaryPanel } from './components/PatientSummaryPanel';
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
} from '@/types';
import {
  Stethoscope,
  HelpCircle,
  Pill,
  ShieldCheck,
  FileText,
  ArrowLeft,
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

export default function CaseWorkspacePage({ params }: CaseWorkspacePageProps) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.id;

  const router = useRouter();
  const locale = useLocale();
  const tAnalysisGuard = useTranslations('analysisGuard');
  const searchParams = useSearchParams();
  const t = useTranslations('workspace');

  // Active tab state (synced with ?tab=)
  const currentTab = searchParams.get('tab') || 'differentials';
  const [activeTab, setActiveTab] = useState<string>(currentTab);

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

      // If case already has confirmed diagnosis, fetch treatment plan
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
        toast.success('Clinical observation recorded in patient history.');
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
      setCaseData({
        ...caseData,
        confirmed_diagnosis: condition,
        status: 'confirmed',
      });
      toast.success(`Confirmed working diagnosis: ${condition}`);
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
    toast.success('Clinical safety override recorded.');
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
      toast.success('Prescription finalized and locked in audit log.');
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
        <LoadingState message="Loading patient case workspace..." />
      </AppShell>
    );
  }

  if (error || !caseData) {
    return (
      <AppShell>
        <ErrorState
          title="Case Not Found"
          message={error || 'The requested patient case does not exist.'}
          onRetry={fetchCaseData}
        />
      </AppShell>
    );
  }

  const criticalAlerts = treatmentPlan?.safety_alerts.filter(
    (a) => a.severity === 'critical'
  ) || [];
  const unacknowledgedCriticalCount = criticalAlerts.filter(
    (a) => !acknowledgedAlerts.has(a.id)
  ).length;

  const differentials = analysis?.differentials || [];

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Page Header with Breadcrumb */}
        <PageHeader
          title={`Case Workspace: ${caseData.patient_code}`}
          subtitle={`Clinical Decision Support & Differential Reasoning • Round ${caseData.structured_input?.past_medical_history ? 'Active' : '1'}`}
          action={
            <div className="flex items-center gap-2">
              <Link href="/cases">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  All Cases
                </Button>
              </Link>
            </div>
          }
        />

        {/* Workspace Body: Responsive Two-Panel Layout (Side-by-side on lg+, Stacked on mobile) */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Patient Summary & Turn History (4 cols on lg+) */}
          <div className="w-full lg:col-span-4 lg:sticky lg:top-4 max-h-[calc(100vh-8rem)]">
            <PatientSummaryPanel caseData={caseData} turns={turns} />
          </div>

          {/* Right Panel: Tabbed Clinical Workspace (8 cols on lg+) */}
          <div className="w-full lg:col-span-8 bg-card rounded-xl border border-border/80 shadow-xs p-4 sm:p-5">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <div className="border-b border-border/60 pb-3 mb-4">
                <TabsList className="flex flex-wrap h-auto gap-1.5 p-1.5 bg-muted/80 rounded-lg w-full">
                  <TabsTrigger value="differentials" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{t('tabDifferentials')}</span>
                    {analysis?.differentials?.length ? (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">
                        {analysis.differentials.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>

                  <TabsTrigger value="missing_info" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{t('tabMissingInfo')}</span>
                    {analysis?.missing_information?.length ? (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-1">
                        {analysis.missing_information.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>

                  <TabsTrigger value="treatment" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5">
                    <Pill className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{t('tabTreatment')}</span>
                    {caseData.confirmed_diagnosis ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] px-1 py-0 ml-1">
                        Confirmed
                      </Badge>
                    ) : null}
                  </TabsTrigger>

                  <TabsTrigger value="safety" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{t('tabSafety')}</span>
                    {criticalAlerts.length > 0 ? (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-1 animate-pulse">
                        {criticalAlerts.length} Critical
                      </Badge>
                    ) : null}
                  </TabsTrigger>

                  <TabsTrigger value="report" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{t('tabReport')}</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div>
                <TabsContent value="differentials" className="mt-0 focus-visible:outline-none">
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

                <TabsContent value="missing_info" className="mt-0 focus-visible:outline-none">
                  <MissingInfoTab
                    missingInfo={analysis?.missing_information || []}
                    onAnswerSubmit={handleAnswerSubmit}
                    onReAnalyze={handleRunAnalysis}
                    reAnalyzing={analyzing}
                  />
                </TabsContent>

                <TabsContent value="treatment" className="mt-0 focus-visible:outline-none">
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

                <TabsContent value="safety" className="mt-0 focus-visible:outline-none">
                  <SafetyTab
                    caseData={caseData}
                    treatmentPlan={treatmentPlan}
                    acknowledgedAlerts={acknowledgedAlerts}
                    onAcknowledgeAlert={handleAcknowledgeAlert}
                  />
                </TabsContent>

                <TabsContent value="report" className="mt-0 focus-visible:outline-none">
                  <ReportTab
                    caseData={caseData}
                    treatmentPlan={treatmentPlan}
                    approvedDrugIds={approvedDrugIds}
                    acknowledgedAlerts={acknowledgedAlerts}
                    doctorNotes={doctorNotes}
                    signature={signature}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Confirm Working Diagnosis Dialog */}
        <ConfirmDiagnosisDialog
          open={confirmDiagOpen}
          onOpenChange={setConfirmDiagOpen}
          differentials={differentials}
          initialCondition={selectedDiagnosis || differentials[0]?.condition}
          onConfirm={handleConfirmDiagnosis}
        />

        {/* Finalize Prescription AlertDialog */}
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

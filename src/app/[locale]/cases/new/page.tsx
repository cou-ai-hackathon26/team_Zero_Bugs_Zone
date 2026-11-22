'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useRouter } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Stethoscope,
  HeartPulse,
  Activity,
  Pill,
  TestTube2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Save,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { LabValue, StructuredPatientInput } from '@/types';

function getInitialDraft(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const draft = localStorage.getItem('docmate_intake_draft');
    return draft ? JSON.parse(draft) : {};
  } catch {
    return {};
  }
}

export default function NewCasePage() {
  const t = useTranslations('intake');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [patientCode, setPatientCode] = useState(() => (getInitialDraft().patientCode as string) || '');
  const [age, setAge] = useState<number | ''>(() => {
    const a = getInitialDraft().age;
    return typeof a === 'number' ? a : '';
  });
  const [gender, setGender] = useState<StructuredPatientInput['gender'] | ''>(
    () => (getInitialDraft().gender as StructuredPatientInput['gender']) || ''
  );
  const [weightKg, setWeightKg] = useState('');

  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [temperatureCelsius, setTemperatureCelsius] = useState('');
  const [spo2Percent, setSpo2Percent] = useState('');

  // Symptoms
  const [chiefComplaint, setChiefComplaint] = useState(() => (getInitialDraft().chiefComplaint as string) || '');
  const [symptomsInput, setSymptomsInput] = useState(() => (getInitialDraft().symptomsInput as string) || '');
  const [hpi, setHpi] = useState('');

  // History & Meds
  const [pastHistoryInput, setPastHistoryInput] = useState('');
  const [currentMedsInput, setCurrentMedsInput] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [isPregnant, setIsPregnant] = useState(false);
  const [pregnancyTrimester, setPregnancyTrimester] = useState<'1' | '2' | '3'>('1');

  // Labs & Notes
  const [egfr, setEgfr] = useState('');
  const [labValues, setLabValues] = useState<LabValue[]>([
    { name: 'WBC', value: '', unit: '/μL', reference_range: '4000-11000' },
  ]);
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Autosave Draft in localStorage
  useEffect(() => {
    const draft = localStorage.getItem('docmate_intake_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        queueMicrotask(() => {
          if (parsed.patientCode) setPatientCode(parsed.patientCode);
          if (typeof parsed.age === 'number') setAge(parsed.age);
          if (parsed.gender) setGender(parsed.gender);
          if (parsed.chiefComplaint) setChiefComplaint(parsed.chiefComplaint);
          if (parsed.symptomsInput) setSymptomsInput(parsed.symptomsInput);
        });
      } catch {}
    }
  }, []);
  const saveToLocalStorage = () => {
    const data = {
      patientCode,
      age,
      gender,
      chiefComplaint,
      symptomsInput,
      hpi,
      pastHistoryInput,
      currentMedsInput,
      allergiesInput,
      isPregnant,
      egfr,
    };
    localStorage.setItem('docmate_intake_draft', JSON.stringify(data));
    toast.success(t('draftSaved'));
  };

  const handleAddLab = () => {
    setLabValues([...labValues, { name: '', value: '', unit: '', reference_range: '' }]);
  };

  const handleRemoveLab = (index: number) => {
    setLabValues(labValues.filter((_, idx) => idx !== index));
  };

  const handleLabChange = (index: number, field: keyof LabValue, val: string) => {
    const updated = [...labValues];
    updated[index] = { ...updated[index], [field]: val };
    setLabValues(updated);
  };

  const hasDemographics = /^P-[0-9]{3,8}$/.test(patientCode.trim()) &&
    age !== '' && Number.isInteger(age) && age >= 0 && age <= 130 && gender !== '';

  const handleSubmit = async () => {
    if (!hasDemographics) {
      toast.error(t('invalidDemographics'));
      setCurrentStep(1);
      return;
    }

    if (!chiefComplaint.trim()) {
      toast.error('Chief complaint is required');
      setCurrentStep(2);
      return;
    }

    setLoading(true);

    const structuredPayload: StructuredPatientInput = {
      age,
      gender,
      weight_kg: weightKg ? Number(weightKg) : undefined,
      chief_complaint: chiefComplaint.trim(),
      symptoms: symptomsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      history_of_present_illness: hpi.trim() || undefined,
      past_medical_history: pastHistoryInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      current_medicines: currentMedsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      allergies: allergiesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      vitals: {
        blood_pressure_systolic: bpSystolic ? Number(bpSystolic) : undefined,
        blood_pressure_diastolic: bpDiastolic ? Number(bpDiastolic) : undefined,
        heart_rate: heartRate ? Number(heartRate) : undefined,
        respiratory_rate: respiratoryRate ? Number(respiratoryRate) : undefined,
        temperature_celsius: temperatureCelsius ? Number(temperatureCelsius) : undefined,
        spo2_percent: spo2Percent ? Number(spo2Percent) : undefined,
      },
      lab_values: labValues.filter((l) => l.name && l.value !== ''),
      is_pregnant: isPregnant,
      pregnancy_trimester: isPregnant ? (Number(pregnancyTrimester) as 1 | 2 | 3) : undefined,
      egfr: egfr ? Number(egfr) : undefined,
      clinical_notes: clinicalNotes.trim() || undefined,
    };

    try {
      // 1. Create Case
      const createRes = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_code: patientCode,
          structured_input: structuredPayload,
        }),
      });

      if (!createRes.ok) {
        throw new Error('Failed to create case');
      }

      const caseData = await createRes.json();
      const caseId = caseData.case.id;

      // 2. Trigger Diagnostic Analysis Immediately
      await fetch(`/api/cases/${caseId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });

      // Clear draft
      localStorage.removeItem('docmate_intake_draft');
      toast.success('Patient case created & diagnostic evaluation started');
      router.push(`/cases/${caseId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error starting analysis');
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: t('stepVitals'), icon: HeartPulse },
    { num: 2, label: t('stepSymptoms'), icon: Stethoscope },
    { num: 3, label: t('stepHistory'), icon: Pill },
    { num: 4, label: t('stepLabs'), icon: TestTube2 },
  ];

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <PageHeader
          title={t('title')}
          subtitle="Structured patient intake with clinical validation and closed-library analysis."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={saveToLocalStorage}
              className="gap-1.5 text-xs font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('saveDraft')}</span>
            </Button>
          }
        />

        {/* Multi-Step Stepper Header */}
        <div className="grid grid-cols-4 gap-2 border-b border-border pb-4">
          {steps.map((s) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setCurrentStep(s.num)}
                className={`flex flex-col sm:flex-row items-center gap-2 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-primary/10 text-primary font-semibold border border-primary/30'
                    : isCompleted
                    ? 'text-foreground font-medium hover:bg-muted/50'
                    : 'text-muted-foreground/60 hover:bg-muted/30'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className="text-xs truncate">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step 1: Demographics & Vitals */}
        {currentStep === 1 && (
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-primary" />
                <span>{t('stepVitals')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="patient-code" className="text-xs font-semibold">
                    {t('patientCode')}
                  </Label>
                  <Input
                    id="patient-code"
                    value={patientCode}
                    onChange={(e) => setPatientCode(e.target.value.toUpperCase())}
                    placeholder="P-104"
                    required
                    className="font-mono text-xs uppercase"
                  />
                  <p className="text-[11px] text-muted-foreground">{t('patientCodeHint')}</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="age" className="text-xs font-semibold">
                    {t('age')} *
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value === '' ? '' : e.target.valueAsNumber)}
                    min="0"
                    max="130"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-xs font-semibold">
                    {t('gender')}
                  </Label>
                  <Select value={gender} onValueChange={(val) => val && setGender(val as 'male' | 'female' | 'other')}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder={t('gender')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('genderMale')}</SelectItem>
                      <SelectItem value="female">{t('genderFemale')}</SelectItem>
                      <SelectItem value="other">{t('genderOther')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="case-weight" className="text-xs font-semibold">{t('weight')}</Label>
                  <Input id="case-weight" type="number" min="0.01" max="1000" step="any"
                    value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span>Objective Vital Signs</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bp-sys" className="text-xs font-medium">
                      {t('bpSystolic')}
                    </Label>
                    <Input
                      id="bp-sys"
                      type="number"
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(e.target.value)}
                      placeholder="120"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bp-dia" className="text-xs font-medium">
                      {t('bpDiastolic')}
                    </Label>
                    <Input
                      id="bp-dia"
                      type="number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(e.target.value)}
                      placeholder="80"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hr" className="text-xs font-medium">
                      {t('heartRate')}
                    </Label>
                    <Input
                      id="hr"
                      type="number"
                      value={heartRate}
                      onChange={(e) => setHeartRate(e.target.value)}
                      placeholder="72"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rr" className="text-xs font-medium">
                      {t('respiratoryRate')}
                    </Label>
                    <Input
                      id="rr"
                      type="number"
                      value={respiratoryRate}
                      onChange={(e) => setRespiratoryRate(e.target.value)}
                      placeholder="18"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="temp" className="text-xs font-medium">
                      {t('temperature')}
                    </Label>
                    <Input
                      id="temp"
                      type="number"
                      step="0.1"
                      value={temperatureCelsius}
                      onChange={(e) => setTemperatureCelsius(e.target.value)}
                      placeholder="37.0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="spo2" className="text-xs font-medium">
                      {t('spo2')}
                    </Label>
                    <Input
                      id="spo2"
                      type="number"
                      value={spo2Percent}
                      onChange={(e) => setSpo2Percent(e.target.value)}
                      placeholder="98"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <span className="text-xs text-muted-foreground">Step 1 of 4</span>
              <Button onClick={() => {
                if (hasDemographics) setCurrentStep(2);
                else toast.error(t('invalidDemographics'));
              }} className="gap-2 bg-primary text-primary-foreground font-semibold">
                <span>{tCommon('next')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 2: Symptoms & Complaint */}
        {currentStep === 2 && (
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                <span>{t('stepSymptoms')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="chief-complaint" className="text-xs font-semibold">
                  {t('chiefComplaint')} *
                </Label>
                <Input
                  id="chief-complaint"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. High fever, chills, and productive cough with rust-colored sputum for 4 days"
                  required
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="symptoms" className="text-xs font-semibold">
                  {t('symptoms')}
                </Label>
                <Input
                  id="symptoms"
                  value={symptomsInput}
                  onChange={(e) => setSymptomsInput(e.target.value)}
                  placeholder="Fever, Productive cough, Right pleuritic chest pain, Dyspnea"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hpi" className="text-xs font-semibold">
                  {t('hpi')}
                </Label>
                <Textarea
                  id="hpi"
                  rows={4}
                  value={hpi}
                  onChange={(e) => setHpi(e.target.value)}
                  placeholder="Detail the timeline, onset, character, radiation, severity, aggravating and relieving factors..."
                  className="text-sm resize-none"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>{tCommon('back')}</span>
              </Button>
              <Button onClick={() => setCurrentStep(3)} className="gap-2 bg-primary text-primary-foreground font-semibold">
                <span>{tCommon('next')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: Past History, Medications & Allergies */}
        {currentStep === 3 && (
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Pill className="w-5 h-5 text-primary" />
                <span>{t('stepHistory')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="allergies" className="text-xs font-bold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t('allergies')}</span>
                </Label>
                <Input
                  id="allergies"
                  value={allergiesInput}
                  onChange={(e) => setAllergiesInput(e.target.value)}
                  placeholder="e.g. Penicillin, Aspirin, Sulfa drugs (leave blank if none)"
                  className="text-sm border-destructive/40 focus-visible:ring-destructive"
                />
                <p className="text-[11px] text-muted-foreground">
                  Every suggested medication is strictly checked against this field by the deterministic safety engine.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="current-meds" className="text-xs font-semibold">
                  {t('currentMeds')}
                </Label>
                <Input
                  id="current-meds"
                  value={currentMedsInput}
                  onChange={(e) => setCurrentMedsInput(e.target.value)}
                  placeholder="e.g. Amlodipine 5mg OD, Warfarin, Metformin"
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Used for automated pairwise drug-drug interaction screening.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="past-history" className="text-xs font-semibold">
                  {t('pastHistory')}
                </Label>
                <Input
                  id="past-history"
                  value={pastHistoryInput}
                  onChange={(e) => setPastHistoryInput(e.target.value)}
                  placeholder="e.g. Hypertension, Asthma, Diabetes Mellitus Type 2, Peptic Ulcer"
                  className="text-sm"
                />
              </div>

              <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is-pregnant" className="text-xs font-semibold">
                    {t('isPregnant')}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Activates FDA pregnancy category X and D teratogenicity blockers.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isPregnant && (
                    <Select value={pregnancyTrimester} onValueChange={(val) => val && setPregnancyTrimester(val as '1' | '2' | '3')}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue placeholder="Trimester" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Trimester</SelectItem>
                        <SelectItem value="2">2nd Trimester</SelectItem>
                        <SelectItem value="3">3rd Trimester</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Switch
                    id="is-pregnant"
                    checked={isPregnant}
                    onCheckedChange={setIsPregnant}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>{tCommon('back')}</span>
              </Button>
              <Button onClick={() => setCurrentStep(4)} className="gap-2 bg-primary text-primary-foreground font-semibold">
                <span>{tCommon('next')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 4: Labs, Renal & Analysis Submission */}
        {currentStep === 4 && (
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TestTube2 className="w-5 h-5 text-primary" />
                <span>{t('stepLabs')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="egfr" className="text-xs font-semibold">
                    {t('egfr')}
                  </Label>
                  <Input
                    id="egfr"
                    type="number"
                    value={egfr}
                    onChange={(e) => setEgfr(e.target.value)}
                    placeholder="90"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required for renal dosage adjustments and clearance alerts.
                  </p>
                </div>
              </div>

              {/* Dynamic Lab Values */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('labs')} (Objective Evidence)
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddLab}
                    className="h-7 text-xs gap-1 border-dashed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('addLab')}</span>
                  </Button>
                </div>

                {labValues.map((lab, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      placeholder={t('labName')}
                      value={lab.name}
                      onChange={(e) => handleLabChange(idx, 'name', e.target.value)}
                      className="col-span-4 text-xs h-8"
                    />
                    <Input
                      placeholder={t('labValue')}
                      value={String(lab.value)}
                      onChange={(e) => handleLabChange(idx, 'value', e.target.value)}
                      className="col-span-3 text-xs h-8"
                    />
                    <Input
                      placeholder={t('labUnit')}
                      value={lab.unit}
                      onChange={(e) => handleLabChange(idx, 'unit', e.target.value)}
                      className="col-span-3 text-xs h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveLab(idx)}
                      className="col-span-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Physician Clinical Notes */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <Label htmlFor="clinical-notes" className="text-xs font-semibold">
                  {t('clinicalNotes')}
                </Label>
                <Textarea
                  id="clinical-notes"
                  rows={3}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Physical exam observations, auscultation findings, tentative working thoughts..."
                  className="text-sm resize-none"
                />
              </div>

              {/* Review Summary Pill Box */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-primary">
                  <span>Intake Profile Summary: {patientCode}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {age}yo {gender}
                  </Badge>
                </div>
                <p className="text-xs text-foreground font-medium truncate">
                  Chief Complaint: {chiefComplaint || 'None provided'}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground pt-1">
                  <span>Allergies: {allergiesInput || 'None'}</span>
                  <span>•</span>
                  <span>Meds: {currentMedsInput || 'None'}</span>
                  <span>•</span>
                  <span>eGFR: {egfr || 'Normal'}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(3)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>{tCommon('back')}</span>
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !chiefComplaint.trim()}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm h-10 px-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Clinical Evidence...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{t('submitAndAnalyze')}</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

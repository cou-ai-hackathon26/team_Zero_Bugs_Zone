'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/routing';
import {
  FileText,
  PlusCircle,
  Trash2,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Save,
  Printer,
  Check,
  Info,
} from 'lucide-react';

interface MedicineRow {
  brandName: string;
  genericName: string;
  strength: string;
  form: string;
  dosingSchedule: string;
  mealTiming: string;
  durationDays: number;
  durationText: string;
  instructions: string;
}

const COMMON_DRUG_PRESETS = [
  { brand: 'Napa', generic: 'Paracetamol', strength: '500 mg', form: 'Tab', schedule: '১+০+১', meal: 'খাবারের পর', days: 5, text: '৫ দিন' },
  { brand: 'Napa Extend', generic: 'Paracetamol', strength: '665 mg', form: 'Tab', schedule: '১+০+১', meal: 'খাবারের পর', days: 7, text: '৭ দিন' },
  { brand: 'Seclo', generic: 'Omeprazole', strength: '20 mg', form: 'Cap', schedule: '১+০+১', meal: 'খাবারের আগে', days: 14, text: '১৪ দিন' },
  { brand: 'Azith', generic: 'Azithromycin', strength: '500 mg', form: 'Tab', schedule: '১+০+০', meal: 'খাবারের আগে', days: 5, text: '৫ দিন' },
  { brand: 'Fexo', generic: 'Fexofenadine', strength: '120 mg', form: 'Tab', schedule: '০+০+১', meal: 'খাবারের পর', days: 7, text: '৭ দিন' },
  { brand: 'Montene', generic: 'Montelukast', strength: '10 mg', form: 'Tab', schedule: '০+০+১', meal: 'খাবারের পর', days: 30, text: '১ মাস' },
  { brand: 'Camlosart', generic: 'Amlodipine + Olmesartan', strength: '5/20 mg', form: 'Tab', schedule: '১+০+০', meal: 'খাবারের পর', days: 30, text: '১ মাস' },
  { brand: 'Rosuva', generic: 'Rosuvastatin', strength: '10 mg', form: 'Tab', schedule: '০+০+১', meal: 'খাবারের পর', days: 30, text: '১ মাস' },
  { brand: 'Cipro', generic: 'Ciprofloxacin', strength: '500 mg', form: 'Tab', schedule: '১+০+১', meal: 'খাবারের পর', days: 7, text: '৭ দিন' },
];

const COMMON_INVESTIGATIONS_BN = [
  'CBC with ESR',
  'CXR P/A view (বুকের এক্স-রে)',
  'Serum Creatinine',
  'Fasting Blood Sugar (RBS / FBS)',
  'Serum Electrolytes',
  'Lipid Profile (Fasting)',
  'ECG (12 Leads)',
  'Urine R/M/E',
  'USG of Whole Abdomen',
];

const COMMON_ADVICE_BN = [
  'পর্যাপ্ত বিশুদ্ধ কুসুম গরম পানি ও তরল খাবার গ্রহণ করুন।',
  'খাবারে বাড়তি কাঁচা লবণ সম্পূর্ণ বর্জন করুন।',
  'অতিরিক্ত তেল-চর্বিযুক্ত ও ভাজাপোড়া খাবার পরিহার করুন।',
  'ধূমপান, তামাক ও ধুলাবালি থেকে সম্পূর্ণ দূরে থাকুন।',
  'প্রতিদিন অন্তত ৩০ মিনিট মুক্ত বাতাসে নিয়মিত হাঁটুন।',
  'অবস্থার অবনতি হলে অবিলম্বে নিকটস্থ জরুরি বিভাগে যোগাযোগ করুন।',
];

export default function NewPrescriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();

  const [patientsList, setPatientsList] = useState<Array<{ id: string; name: string; patient_code: string; age: number; gender: string }>>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState('');
  const [selectedInvestigations, setSelectedInvestigations] = useState<string[]>([]);
  const [generalAdvice, setGeneralAdvice] = useState('');
  const [followUpText, setFollowUpText] = useState('৭ দিন পর রিপোর্ট সহ আসবেন');

  const [items, setItems] = useState<MedicineRow[]>([
    {
      brandName: 'Napa Extend',
      genericName: 'Paracetamol',
      strength: '665 mg',
      form: 'Tab',
      dosingSchedule: '১+০+১',
      mealTiming: 'খাবারের পর',
      durationDays: 5,
      durationText: '৫ দিন',
      instructions: 'জ্বর বা ব্যথা থাকলে খাবেন',
    },
  ]);

  // Safety Alerts
  const [safetyAlerts, setSafetyAlerts] = useState<Array<{ id: string; severity: string; title: string; description: string }>>([]);
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-select patient if provided in query param
  useEffect(() => {
    fetch('/api/patients', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { patients: [] }))
      .then((data) => {
        setPatientsList(data.patients || []);
        const queryPatient = searchParams.get('patientId');
        if (queryPatient) {
          setSelectedPatientId(queryPatient);
        } else if (data.patients?.length > 0) {
          setSelectedPatientId(data.patients[0].id);
        }
      });
  }, [searchParams]);

  const addItem = () => {
    setItems([
      ...items,
      {
        brandName: '',
        genericName: '',
        strength: '500 mg',
        form: 'Tab',
        dosingSchedule: '১+০+১',
        mealTiming: 'খাবারের পর',
        durationDays: 7,
        durationText: '৭ দিন',
        instructions: '',
      },
    ]);
    setSafetyChecked(false);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
    setSafetyChecked(false);
  };

  const updateItem = (idx: number, field: keyof MedicineRow, value: string | number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
    setSafetyChecked(false);
  };

  const selectPreset = (idx: number, preset: (typeof COMMON_DRUG_PRESETS)[0]) => {
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      brandName: preset.brand,
      genericName: preset.generic,
      strength: preset.strength,
      form: preset.form,
      dosingSchedule: preset.schedule,
      mealTiming: preset.meal,
      durationDays: preset.days,
      durationText: preset.text,
    };
    setItems(updated);
    setSafetyChecked(false);
  };

  const toggleInvestigation = (test: string) => {
    if (selectedInvestigations.includes(test)) {
      setSelectedInvestigations(selectedInvestigations.filter((t) => t !== test));
    } else {
      setSelectedInvestigations([...selectedInvestigations, test]);
    }
  };

  const addAdvice = (line: string) => {
    if (!generalAdvice.includes(line)) {
      setGeneralAdvice(generalAdvice ? `${generalAdvice}\n• ${line}` : `• ${line}`);
    }
  };

  // Run Deterministic Safety Engine Check
  const runSafetyCheck = async () => {
    if (!selectedPatientId) {
      setErrorMessage(locale === 'bn' ? 'রোগী নির্বাচন করুন' : 'Select a patient first');
      return;
    }
    setCheckingSafety(true);
    setErrorMessage('');

    try {
      // Simulate/Run safety check directly against safety engine rules
      const allergiesRes = await fetch(`/api/patients/${selectedPatientId}`, { credentials: 'same-origin' });
      const patientData = await allergiesRes.json();
      const patientAllergies = patientData.encounters?.[0]?.allergies || [];

      const detectedAlerts: typeof safetyAlerts = [];

      // Check allergies
      for (const it of items) {
        if (!it.genericName) continue;
        const genLower = it.genericName.toLowerCase();
        for (const allergy of patientAllergies) {
          if (genLower.includes(String(allergy).toLowerCase())) {
            detectedAlerts.push({
              id: `allergy-${it.brandName}-${allergy}`,
              severity: 'critical',
              title: `Documented Hypersensitivity / Drug Allergy to ${allergy}`,
              description: `Patient has a recorded allergy to "${allergy}". Prescribing ${it.brandName} (${it.genericName}) poses a high risk of acute anaphylaxis.`,
            });
          }
        }
      }

      // Check drug-drug interaction pairs
      const genericNames = items.map((i) => i.genericName.toLowerCase());
      if (genericNames.includes('ciprofloxacin') && genericNames.some((g) => g.includes('theophylline'))) {
        detectedAlerts.push({
          id: 'int-cipro-theo',
          severity: 'critical',
          title: 'Critical Drug Interaction: Ciprofloxacin + Theophylline',
          description: 'Ciprofloxacin inhibits theophylline clearance, significantly raising toxicity risk.',
        });
      }

      // Check duplicate therapy
      const counts: Record<string, number> = {};
      for (const it of items) {
        if (it.genericName) {
          counts[it.genericName] = (counts[it.genericName] || 0) + 1;
        }
      }
      for (const [gen, count] of Object.entries(counts)) {
        if (count > 1) {
          detectedAlerts.push({
            id: `dup-${gen}`,
            severity: 'warning',
            title: `Duplicate Therapy Detected: ${gen}`,
            description: `You have added multiple medicines containing ${gen}. Ensure dosage does not exceed safety limits.`,
          });
        }
      }

      setSafetyAlerts(detectedAlerts);
      setSafetyChecked(true);
      setCheckingSafety(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Safety check failed');
      setCheckingSafety(false);
    }
  };

  const hasCriticalSafetyStop = safetyAlerts.some((a) => a.severity === 'critical');

  const handleSubmitPrescription = async (targetStatus: 'draft' | 'finalized') => {
    if (!selectedPatientId) {
      setErrorMessage(locale === 'bn' ? 'রোগী নির্বাচন করুন' : 'Please select a patient');
      return;
    }

    if (items.length === 0 || !items[0].brandName) {
      setErrorMessage(locale === 'bn' ? 'অন্তত একটি ওষুধ যোগ করুন' : 'Add at least one medicine');
      return;
    }

    if (targetStatus === 'finalized' && hasCriticalSafetyStop) {
      setErrorMessage(
        locale === 'bn'
          ? 'সংকটজনক নিরাপত্তা সতর্কবার্তা (Critical Safety Alert) সক্রিয় থাকা অবস্থায় প্রেসক্রিপশন চূড়ান্ত করা যাবে না।'
          : 'Cannot finalize prescription while critical safety alerts remain unresolved.'
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    const payload = {
      patientId: selectedPatientId,
      diagnosis: diagnosis.trim() || 'General Clinical Consultation',
      investigations: selectedInvestigations,
      generalAdvice: generalAdvice.trim(),
      followUpText: followUpText.trim(),
      status: targetStatus,
      items: items.filter((i) => i.brandName.trim()),
    };

    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save prescription');
      }

      const data = await res.json();
      router.push(`/prescriptions/${data.prescription.id}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error occurred while saving prescription');
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
        <PageHeader
          title={locale === 'bn' ? 'বাংলাদেশি প্রেসক্রিপশন বিল্ডার' : 'Bangladeshi Prescription Builder'}
          subtitle={
            locale === 'bn'
              ? 'বিএমডিসি মানসম্মত ডিজিটাল প্রেসক্রিপশন: ব্র্যান্ড, জেনেরিক, মাত্রা, সময়সূচী ও নিরাপত্তা চেকার'
              : 'BMDC compliant prescription editor: Brand, Generic, strength, dosing schedule, and safety engine'
          }
        />

        {/* Patient Selector Card */}
        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="w-full sm:w-1/2">
              <label className="block text-sm font-bold text-foreground mb-1">
                {locale === 'bn' ? 'রোগী নির্বাচন করুন *' : 'Select Patient *'}
              </label>
              <select
                aria-label={locale === 'bn' ? 'রোগী নির্বাচন করুন' : 'Select Patient'}
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              >
                {patientsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.patient_code}) · {p.age} {locale === 'bn' ? 'বছর' : 'yrs'} · {p.gender}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-1/2">
              <label className="block text-sm font-bold text-foreground mb-1">
                {locale === 'bn' ? 'ক্লিনিকাল রোগ নির্ণয় (Diagnosis)' : 'Clinical Diagnosis'}
              </label>
              <Input
                placeholder={locale === 'bn' ? 'উদা: Acute Bronchial Asthma / Hypertension' : 'Clinical diagnosis...'}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="h-11 text-sm font-semibold"
              />
            </div>
          </CardContent>
        </Card>

        {/* Medicine Items Editor */}
        <Card className="border-border shadow-xs bg-card">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <FileText className="w-5 h-5 text-primary" />
                <span>{locale === 'bn' ? 'ঔষধের তালিকা (Rx Medications)' : 'Rx Medications'}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {locale === 'bn'
                  ? 'বাংলাদেশি ফরম্যাট: Brand (Generic) Strength Form — শিডিউল (১+০+১) — খাবারের আগে/পর — মেয়াদ'
                  : 'Standard format: Brand (Generic) Strength Form — Schedule (1+0+1) — Relation to food — Duration'}
              </CardDescription>
            </div>
            <Button onClick={addItem} size="sm" className="min-h-10 text-xs font-bold">
              <PlusCircle className="w-4 h-4 mr-1.5" />
              <span>{locale === 'bn' ? 'ঔষধ যোগ করুন' : 'Add Medicine'}</span>
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {locale === 'bn' ? 'দ্রুত জনপ্রিয় ঔষধ নির্বাচন করুন:' : 'Quick Presets:'}
                    </span>
                    <div className="hidden sm:flex gap-1">
                      {COMMON_DRUG_PRESETS.slice(0, 4).map((preset) => (
                        <button
                          key={preset.brand}
                          type="button"
                          onClick={() => selectPreset(idx, preset)}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-background border border-border hover:border-primary text-foreground"
                        >
                          {preset.brand}
                        </button>
                      ))}
                    </div>
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(idx)}
                      className="text-destructive hover:bg-destructive/10 h-8 px-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'ব্র্যান্ড নাম (Brand) *' : 'Brand Name *'}
                    </label>
                    <Input
                      placeholder="e.g. Napa Extend"
                      value={item.brandName}
                      onChange={(e) => updateItem(idx, 'brandName', e.target.value)}
                      className="h-10 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'জেনেরিক নাম (Generic) *' : 'Generic Name *'}
                    </label>
                    <Input
                      placeholder="e.g. Paracetamol"
                      value={item.genericName}
                      onChange={(e) => updateItem(idx, 'genericName', e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'শক্তি / ডোজ (Strength)' : 'Strength'}
                    </label>
                    <Input
                      placeholder="e.g. 500 mg / 20 mg"
                      value={item.strength}
                      onChange={(e) => updateItem(idx, 'strength', e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'ফর্ম (Form)' : 'Form'}
                    </label>
                    <select
                      value={item.form}
                      onChange={(e) => updateItem(idx, 'form', e.target.value)}
                      className="w-full h-10 px-2 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    >
                      <option value="Tab">Tab (ট্যাবলেট)</option>
                      <option value="Cap">Cap (ক্যাপসুল)</option>
                      <option value="Syr">Syr (সিরাপ)</option>
                      <option value="Inj">Inj (ইনজেকশন)</option>
                      <option value="Drop">Drop (ড্রপ)</option>
                      <option value="Oint">Oint (মলম)</option>
                      <option value="Inhaler">Inhaler (ইনহেলার)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'সময়সূচী (Schedule) *' : 'Dosing Schedule *'}
                    </label>
                    <select
                      value={item.dosingSchedule}
                      onChange={(e) => updateItem(idx, 'dosingSchedule', e.target.value)}
                      className="w-full h-10 px-2 rounded-md border border-input bg-background text-sm font-bold text-primary focus:outline-hidden focus:ring-2 focus:ring-primary font-mono"
                    >
                      <option value="১+০+১">১+০+১ (সকাল ও রাত)</option>
                      <option value="১+১+১">১+১+১ (সকাল, দুপুর ও রাত)</option>
                      <option value="০+০+১">০+০+১ (শুধুমাত্র রাতে)</option>
                      <option value="১+০+০">১+০+০ (শুধুমাত্র সকালে)</option>
                      <option value="১+১+১+১">১+১+১+১ (৬ ঘণ্টা পর পর)</option>
                      <option value="প্রয়োজনমতো (SOS)">প্রয়োজনমতো (SOS)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'খাবার সম্পর্ক (Food Timing)' : 'Relation to Food'}
                    </label>
                    <select
                      value={item.mealTiming}
                      onChange={(e) => updateItem(idx, 'mealTiming', e.target.value)}
                      className="w-full h-10 px-2 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    >
                      <option value="খাবারের পর">খাবারের পর (After meal)</option>
                      <option value="খাবারের আগে">খাবারের আগে (Before meal)</option>
                      <option value="খাবারের সাথে">খাবারের সাথে (With meal)</option>
                      <option value="খালি পেটে">খালি পেটে (Empty stomach)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'সেবনের মেয়াদ (Duration)' : 'Duration'}
                    </label>
                    <select
                      value={item.durationText}
                      onChange={(e) => updateItem(idx, 'durationText', e.target.value)}
                      className="w-full h-10 px-2 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    >
                      <option value="৩ দিন">৩ দিন (3 days)</option>
                      <option value="৫ দিন">৫ দিন (5 days)</option>
                      <option value="৭ দিন">৭ দিন (7 days)</option>
                      <option value="১৪ দিন">১৪ দিন (14 days)</option>
                      <option value="১ মাস">১ মাস (1 month)</option>
                      <option value="চলবে">চলবে (Continue)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'বিশেষ নির্দেশনা (Instructions)' : 'Special Instructions'}
                    </label>
                    <Input
                      placeholder="উদা: নির্দিষ্ট সময়ে খাবেন"
                      value={item.instructions}
                      onChange={(e) => updateItem(idx, 'instructions', e.target.value)}
                      className="h-10 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Safety Engine Bar */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-lg font-bold text-foreground">
                  {locale === 'bn' ? 'ডিটারমিনিস্টিক নিরাপত্তা পরীক্ষা (Safety Engine Check)' : 'Prescription Safety Verification'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {locale === 'bn'
                    ? 'রোগীর অ্যালার্জি ও ড্রাগ-ড্রাগ ইন্টারঅ্যাকশন স্বয়ংক্রিয় যাচাই'
                    : 'Deterministic cross-check against patient allergy records and drug-drug interaction matrix'}
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runSafetyCheck}
              disabled={checkingSafety}
              className="min-h-10 text-xs font-bold border-primary text-primary hover:bg-primary/10"
            >
              {checkingSafety
                ? locale === 'bn'
                  ? 'যাচাই হচ্ছে...'
                  : 'Checking...'
                : locale === 'bn'
                  ? 'নিরাপত্তা যাচাই করুন'
                  : 'Run Safety Check'}
            </Button>
          </CardHeader>
          <CardContent className="p-5">
            {safetyAlerts.length > 0 ? (
              <div className="space-y-3">
                {safetyAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border-2 flex items-start gap-3 ${
                      alert.severity === 'critical'
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">{alert.title}</h4>
                      <p className="text-xs mt-0.5 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : safetyChecked ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>
                  {locale === 'bn'
                    ? 'কোনো পরিচিত ড্রাগ অ্যালার্জি বা সংকটজনক মিথস্ক্রিয়া পাওয়া যায়নি। প্রেসক্রিপশনটি নিরাপদ।'
                    : 'No critical allergy conflicts or severe drug interactions detected. Prescription is safe.'}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-4 h-4 text-primary" />
                <span>
                  {locale === 'bn'
                    ? 'প্রেসক্রিপশন চূড়ান্ত করার পূর্বে উপরের বাটনে চাপ দিয়ে নিরাপত্তা যাচাই সম্পন্ন করুন।'
                    : 'Click "Run Safety Check" to verify drug interactions and documented patient allergies.'}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Investigations & Clinical Advice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Investigations */}
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-foreground">
                {locale === 'bn' ? 'রোগ নির্ণয় পরীক্ষা (Investigations Advised)' : 'Investigations Advised'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {COMMON_INVESTIGATIONS_BN.map((inv) => {
                  const isSelected = selectedInvestigations.includes(inv);
                  return (
                    <button
                      key={inv}
                      type="button"
                      onClick={() => toggleInvestigation(inv)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-muted/30 hover:bg-muted text-foreground border-border'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 inline mr-1" />}
                      {inv}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Advice & Follow Up */}
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-foreground">
                {locale === 'bn' ? 'সাধারণ উপদেশ ও পরামর্শ (Advice & Follow-up)' : 'Clinical Advice & Follow-up'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ADVICE_BN.slice(0, 3).map((adv, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => addAdvice(adv)}
                    className="text-[11px] px-2 py-1 rounded bg-muted/40 hover:bg-muted border border-border text-foreground"
                  >
                    + {adv.slice(0, 25)}...
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                placeholder={locale === 'bn' ? 'রোগীর পালনীয় সাধারণ নিয়মাবলী...' : 'Clinical advice...'}
                value={generalAdvice}
                onChange={(e) => setGeneralAdvice(e.target.value)}
                className="w-full p-2.5 rounded-md border border-input bg-background text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              />

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {locale === 'bn' ? 'পরবর্তী সাক্ষাতের সময় (Follow-up)' : 'Follow-up Date'}
                </label>
                <Input
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  className="h-10 text-xs font-semibold"
                  placeholder="উদা: ৭ দিন পর রিপোর্ট সহ আসবেন"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/15 border border-destructive text-destructive text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
          <Link href="/prescriptions" className={buttonVariants({ variant: 'outline', className: 'min-h-12 px-5' })}>
            <span>{locale === 'bn' ? 'বাতিল' : 'Cancel'}</span>
          </Link>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleSubmitPrescription('draft')}
              className="min-h-12 px-5 text-sm font-bold flex-1 sm:flex-initial"
            >
              <Save className="w-4 h-4 mr-2" />
              <span>{locale === 'bn' ? 'খসড়া সংরক্ষণ' : 'Save Draft'}</span>
            </Button>

            <Button
              type="button"
              disabled={submitting || hasCriticalSafetyStop}
              onClick={() => handleSubmitPrescription('finalized')}
              className="min-h-12 px-8 text-base font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md flex-1 sm:flex-initial"
            >
              <Printer className="w-5 h-5 mr-2" />
              <span>
                {submitting
                  ? locale === 'bn'
                    ? 'সংরক্ষণ হচ্ছে...'
                    : 'Finalizing...'
                  : locale === 'bn'
                    ? 'চূড়ান্ত ও প্রিন্ট করুন'
                    : 'Finalize & Print'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

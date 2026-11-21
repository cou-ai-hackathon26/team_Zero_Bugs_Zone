'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  UserPlus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  HeartPulse,
  Activity,
  ShieldCheck,
  Save,
  Check,
} from 'lucide-react';

const COMMON_SYMPTOMS_BN = [
  'জ্বর (Fever)',
  'কাশি (Cough)',
  'বুকে ব্যথা (Chest Pain)',
  'শ্বাসকষ্ট (Shortness of breath)',
  'পেট ব্যথা (Abdominal Pain)',
  'বমি ভাব (Nausea / Vomiting)',
  'মাথা ব্যথা (Headache)',
  'দুর্বলতা (Fatigue)',
  'প্রস্রাবে জ্বালা (Dysuria)',
  'ডায়রিয়া (Diarrhea)',
  'মাথা ঘোরা (Dizziness)',
];

const COMMON_ALLERGIES_BN = [
  'Penicillin (পেনিসিলিন)',
  'Sulfa Drugs (সালফা)',
  'Ciprofloxacin (সিপ্রোফ্লক্সাসিন)',
  'Aspirin / NSAIDs (অ্যাসপিরিন)',
  'ধূলোবালি / অ্যালার্জি (Dust / Allergen)',
];

const COMMON_HISTORY_BN = [
  'উচ্চ রক্তচাপ (Hypertension)',
  'ডায়াবেটিস (Diabetes Mellitus)',
  'অ্যাজমা / হাঁপানি (Asthma)',
  'কিডনি রোগ (Chronic Kidney Disease)',
  'হৃদরোগ (Ischemic Heart Disease)',
];

export default function NewPatientIntakePage() {
  const router = useRouter();
  const locale = useLocale();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [autoSavedTime, setAutoSavedTime] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>(35);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [consentObtained, setConsentObtained] = useState(true);

  // Step 2: Chief Complaint & Symptoms
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  // Step 3: Vitals
  const [bpSystolic, setBpSystolic] = useState<number | ''>(120);
  const [bpDiastolic, setBpDiastolic] = useState<number | ''>(80);
  const [pulse, setPulse] = useState<number | ''>(76);
  const [tempF, setTempF] = useState<number | ''>(98.6);
  const [weightKg, setWeightKg] = useState<number | ''>(65);
  const [spo2, setSpo2] = useState<number | ''>(98);

  // Step 4: Allergies & History
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [currentMedsText, setCurrentMedsText] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<string[]>([]);

  // Restore draft from localStorage if present
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const draft = localStorage.getItem('docmate_patient_intake_draft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.name) setName(parsed.name);
          if (parsed.age) setAge(parsed.age);
          if (parsed.gender) setGender(parsed.gender);
          if (parsed.phone) setPhone(parsed.phone);
          if (parsed.bloodGroup) setBloodGroup(parsed.bloodGroup);
          if (parsed.chiefComplaint) setChiefComplaint(parsed.chiefComplaint);
          if (parsed.selectedSymptoms) setSelectedSymptoms(parsed.selectedSymptoms);
        }
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Autosave every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const payload = {
          name,
          age,
          gender,
          phone,
          bloodGroup,
          chiefComplaint,
          selectedSymptoms,
          bpSystolic,
          bpDiastolic,
          pulse,
          tempF,
          weightKg,
          spo2,
          selectedAllergies,
          currentMedsText,
          selectedHistory,
        };
        localStorage.setItem('docmate_patient_intake_draft', JSON.stringify(payload));
        setAutoSavedTime(new Date().toLocaleTimeString(locale === 'bn' ? 'bn-BD' : 'en-US'));
      } catch {}
    }, 30000);
    return () => clearInterval(timer);
  }, [
    name,
    age,
    gender,
    phone,
    bloodGroup,
    chiefComplaint,
    selectedSymptoms,
    bpSystolic,
    bpDiastolic,
    pulse,
    tempF,
    weightKg,
    spo2,
    selectedAllergies,
    currentMedsText,
    selectedHistory,
    locale,
  ]);

  const toggleSymptom = (sym: string) => {
    if (selectedSymptoms.includes(sym)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== sym));
    } else {
      setSelectedSymptoms([...selectedSymptoms, sym]);
      if (!chiefComplaint) {
        setChiefComplaint(sym);
      }
    }
  };

  const toggleAllergy = (all: string) => {
    if (selectedAllergies.includes(all)) {
      setSelectedAllergies(selectedAllergies.filter((a) => a !== all));
    } else {
      setSelectedAllergies([...selectedAllergies, all]);
    }
  };

  const toggleHistory = (h: string) => {
    if (selectedHistory.includes(h)) {
      setSelectedHistory(selectedHistory.filter((item) => item !== h));
    } else {
      setSelectedHistory([...selectedHistory, h]);
    }
  };

  const addCustomAllergy = () => {
    if (customAllergy.trim() && !selectedAllergies.includes(customAllergy.trim())) {
      setSelectedAllergies([...selectedAllergies, customAllergy.trim()]);
      setCustomAllergy('');
    }
  };

  // Critical Vitals Detection
  const isCriticalBP = (Number(bpSystolic) >= 180 || Number(bpSystolic) <= 90 || Number(bpDiastolic) >= 110);
  const isCriticalSpO2 = (Number(spo2) < 92);
  const isHighFever = (Number(tempF) >= 103);
  const hasCriticalVital = isCriticalBP || isCriticalSpO2 || isHighFever;

  const handleFinalSubmit = async () => {
    if (!consentObtained) {
      setErrorMessage(
        locale === 'bn'
          ? 'রোগীর ডেটা সুরক্ষার সম্মতি প্রদান আবশ্যক।'
          : 'Patient data consent is strictly mandatory.'
      );
      return;
    }

    if (!name || !age) {
      setErrorMessage(
        locale === 'bn' ? 'রোগীর নাম ও বয়স প্রদান করুন।' : 'Please enter patient name and age.'
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    const vitalsData = {
      bpSystolic: Number(bpSystolic) || 120,
      bpDiastolic: Number(bpDiastolic) || 80,
      pulse: Number(pulse) || 76,
      tempF: Number(tempF) || 98.6,
      weightKg: Number(weightKg) || 65,
      spo2: Number(spo2) || 98,
    };

    const currentMedsList = currentMedsText
      .split('\n')
      .map((m) => m.trim())
      .filter(Boolean)
      .map((brand) => ({ brand, generic: brand }));

    const payload = {
      name: name.trim(),
      age: Number(age),
      gender,
      phone: phone.trim(),
      bloodGroup,
      emergencyContact: emergencyContact.trim(),
      consentObtained: true,
      chiefComplaint: chiefComplaint.trim() || selectedSymptoms.join(', ') || 'General Consultation',
      symptoms: selectedSymptoms,
      vitals: vitalsData,
      allergies: selectedAllergies,
      currentMedications: currentMedsList,
      pastHistory: selectedHistory.join(', '),
    };

    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save patient');
      }

      const data = await res.json();
      localStorage.removeItem('docmate_patient_intake_draft');
      router.push(`/patients/${data.patient.id}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error occurred while saving patient record');
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        <PageHeader
          title={locale === 'bn' ? 'নতুন রোগী গ্রহণ (Intake)' : 'New Patient Intake'}
          subtitle={
            locale === 'bn'
              ? '৪-ধাপের সহজ ক্লিনিকাল ইনটেক: মৌলিক তথ্য, উপসর্গ, ভাইটাল ও প্রেসক্রিপশন প্রস্তুতি'
              : '4-step clinician intake: demographics, symptoms, vitals, and medical history'
          }
        />

        {/* 4-Step Progress Indicator */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
          <div
            onClick={() => setStep(1)}
            className={`cursor-pointer p-3 rounded-xl border-2 transition-all ${
              step === 1
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50'
            }`}
          >
            <span className="block text-[11px] opacity-80">{locale === 'bn' ? 'ধাপ ১' : 'Step 1'}</span>
            <span className="text-sm">{locale === 'bn' ? 'মৌলিক ও সম্মতি' : 'Info & Consent'}</span>
          </div>

          <div
            onClick={() => setStep(2)}
            className={`cursor-pointer p-3 rounded-xl border-2 transition-all ${
              step === 2
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50'
            }`}
          >
            <span className="block text-[11px] opacity-80">{locale === 'bn' ? 'ধাপ ২' : 'Step 2'}</span>
            <span className="text-sm">{locale === 'bn' ? 'উপসর্গ সমূহ' : 'Symptoms'}</span>
          </div>

          <div
            onClick={() => setStep(3)}
            className={`cursor-pointer p-3 rounded-xl border-2 transition-all ${
              step === 3
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50'
            }`}
          >
            <span className="block text-[11px] opacity-80">{locale === 'bn' ? 'ধাপ ৩' : 'Step 3'}</span>
            <span className="text-sm">{locale === 'bn' ? 'ভাইটাল সাইন' : 'Vitals'}</span>
          </div>

          <div
            onClick={() => setStep(4)}
            className={`cursor-pointer p-3 rounded-xl border-2 transition-all ${
              step === 4
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50'
            }`}
          >
            <span className="block text-[11px] opacity-80">{locale === 'bn' ? 'ধাপ ৪' : 'Step 4'}</span>
            <span className="text-sm">{locale === 'bn' ? 'অ্যালার্জি ও ইতিহাস' : 'Allergies & Meds'}</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/15 border border-destructive text-destructive text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Basic Info & Mandatory Consent */}
        {step === 1 && (
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <UserPlus className="w-5 h-5 text-primary" />
                <span>{locale === 'bn' ? 'ধাপ ১: রোগীর সাধারণ তথ্য ও ডেটা সম্মতি' : 'Step 1: Patient Information & Consent'}</span>
              </CardTitle>
              <CardDescription className="text-sm">
                {locale === 'bn'
                  ? 'রোগীর নাম, বয়স, যোগাযোগ এবং ডেটা সুরক্ষার সম্মতি নিশ্চিত করুন।'
                  : 'Enter patient demographics and verify mandatory privacy consent.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Mandatory Consent Checkbox */}
              <div className="p-4 rounded-xl border-2 border-primary/40 bg-primary/5 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consentCheckbox"
                  checked={consentObtained}
                  onChange={(e) => setConsentObtained(e.target.checked)}
                  className="w-6 h-6 mt-0.5 rounded text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="consentCheckbox" className="text-sm font-bold text-foreground cursor-pointer leading-snug">
                  <span>{locale === 'bn' ? 'রোগীর ডেটা সুরক্ষার সম্মতি নেওয়া হয়েছে (Consent Obtained)' : 'Patient Data Protection Consent Obtained'}</span>
                  <span className="block font-normal text-xs text-muted-foreground mt-1">
                    {locale === 'bn'
                      ? 'রোগী তার ক্লিনিকাল পর্যবেক্ষণ ও স্বাস্থ্য তথ্য ডকমেইট এআই সিস্টেমে নিরাপদ এনক্রিপশনে সংরক্ষণ করতে সম্মত হয়েছেন।'
                      : 'The patient has explicitly consented to encrypted storage and clinical processing of their health data.'}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'রোগীর পুরো নাম *' : 'Patient Full Name *'}
                  </label>
                  <Input
                    placeholder={locale === 'bn' ? 'উদা: মোসাম্মৎ আয়েশা বেগম' : 'e.g. Ayesha Begum'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 text-base"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'বয়স (বছর) *' : 'Age (Years) *'}
                  </label>
                  <Input
                    type="number"
                    placeholder="35"
                    value={age}
                    onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                    className="h-12 text-base"
                    min={0}
                    max={130}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'লিঙ্গ *' : 'Gender *'}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                    className="w-full h-12 px-3 rounded-md border border-input bg-background text-base font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  >
                    <option value="male">{locale === 'bn' ? 'পুরুষ (Male)' : 'Male'}</option>
                    <option value="female">{locale === 'bn' ? 'মহিলা (Female)' : 'Female'}</option>
                    <option value="other">{locale === 'bn' ? 'অন্যান্য (Other)' : 'Other'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full h-12 px-3 rounded-md border border-input bg-background text-base font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="">{locale === 'bn' ? 'জানা নেই (Unknown)' : 'Unknown'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                  </label>
                  <Input
                    placeholder="+8801712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">
                  {locale === 'bn' ? 'জরুরি যোগাযোগ (সম্পর্ক ও ফোন)' : 'Emergency Contact (Relation & Phone)'}
                </label>
                <Input
                  placeholder={locale === 'bn' ? 'স্বামী: মো: রফিকুল ইসলাম (+8801711223344)' : 'Spouse / Guardian phone'}
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => {
                    if (!name.trim()) {
                      setErrorMessage(locale === 'bn' ? 'রোগীর নাম পূরণ করুন' : 'Enter patient name');
                      return;
                    }
                    if (!consentObtained) {
                      setErrorMessage(locale === 'bn' ? 'সম্মতি প্রদান আবশ্যক' : 'Consent is required');
                      return;
                    }
                    setErrorMessage('');
                    setStep(2);
                  }}
                  className="min-h-12 px-6 text-base font-bold"
                >
                  <span>{locale === 'bn' ? 'পরবর্তী: উপসর্গ নির্বাচন' : 'Next: Symptoms'}</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Chief Complaint & Symptoms */}
        {step === 2 && (
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Activity className="w-5 h-5 text-primary" />
                <span>{locale === 'bn' ? 'ধাপ ২: প্রধান কষ্ট ও উপসর্গসমূহ (Symptoms)' : 'Step 2: Chief Complaint & Symptoms'}</span>
              </CardTitle>
              <CardDescription className="text-sm">
                {locale === 'bn'
                  ? 'দ্রুত উপসর্গ চিপে ক্লিক করুন অথবা চিকিৎসকের নিজস্ব ভাষায় বিস্তারিত লিখুন।'
                  : 'Click common symptoms chips or write detailed clinical complaints.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  {locale === 'bn' ? 'সাধারণ উপসর্গ চিপসমূহ (ক্লিক করে নির্বাচন করুন):' : 'Common Symptoms (Click to toggle):'}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {COMMON_SYMPTOMS_BN.map((sym) => {
                    const isSelected = selectedSymptoms.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => toggleSymptom(sym)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-muted/40 hover:bg-muted text-foreground border-border'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 inline mr-1" />}
                        {sym}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">
                  {locale === 'bn' ? 'প্রধান কষ্ট / বিস্তারিত বিবরণ (Chief Complaint)' : 'Chief Complaint Description'}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    locale === 'bn'
                      ? 'উদা: তীব্র জ্বর ও শ্বাসকষ্ট ৪ দিন যাবত। রাতে কাশির তীব্রতা বৃদ্ধি পায়...'
                      : 'e.g. High fever with cough and dyspnea for 4 days...'
                  }
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="w-full p-3 rounded-lg border border-input bg-background text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="min-h-12 px-5 text-base">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  <span>{locale === 'bn' ? 'পূর্ববর্তী' : 'Back'}</span>
                </Button>
                <Button onClick={() => setStep(3)} className="min-h-12 px-6 text-base font-bold">
                  <span>{locale === 'bn' ? 'পরবর্তী: ভাইটাল সাইন' : 'Next: Vitals'}</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Vitals */}
        {step === 3 && (
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <HeartPulse className="w-5 h-5 text-primary" />
                <span>{locale === 'bn' ? 'ধাপ ৩: ভাইটাল সাইন (Vital Signs)' : 'Step 3: Vital Signs'}</span>
              </CardTitle>
              <CardDescription className="text-sm">
                {locale === 'bn'
                  ? 'ক্লিনিকাল স্ট্যান্ডার্ড ভাইটাল পরিমাপ নথিভুক্ত করুন। বিপজ্জনক মানে স্বয়ংক্রিয় সতর্কবার্তা দেখাবে।'
                  : 'Record baseline patient vitals. Critical values trigger automatic clinical highlights.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {hasCriticalVital && (
                <div className="p-4 rounded-xl bg-destructive/15 border-2 border-destructive text-destructive font-bold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 shrink-0 animate-pulse" />
                  <span>
                    {locale === 'bn'
                      ? 'সতর্কতা: পরিমাপকৃত ভাইটাল সাইনের মধ্যে সংকটজনক মান পরিলক্ষিত হয়েছে (Critical Vital Detected)!'
                      : 'Warning: Abnormal or critical vital signs detected! Immediate stabilization may be warranted.'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'রক্তচাপ সিস্টোলিক (BP Sys)' : 'Systolic BP (mmHg)'}
                  </label>
                  <Input
                    type="number"
                    value={bpSystolic}
                    onChange={(e) => setBpSystolic(e.target.value ? Number(e.target.value) : '')}
                    className={`h-12 text-base ${isCriticalBP ? 'border-destructive bg-destructive/5 font-bold text-destructive' : ''}`}
                    placeholder="120"
                  />
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">স্বাভাবিক: ১১০ - ১৩০ mmHg</span>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'রক্তচাপ ডায়াস্টোলিক (BP Dia)' : 'Diastolic BP (mmHg)'}
                  </label>
                  <Input
                    type="number"
                    value={bpDiastolic}
                    onChange={(e) => setBpDiastolic(e.target.value ? Number(e.target.value) : '')}
                    className="h-12 text-base"
                    placeholder="80"
                  />
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">স্বাভাবিক: ৭০ - ৮৫ mmHg</span>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'নাড়ির স্পন্দন (Pulse / min)' : 'Pulse (bpm)'}
                  </label>
                  <Input
                    type="number"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value ? Number(e.target.value) : '')}
                    className="h-12 text-base"
                    placeholder="76"
                  />
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">স্বাভাবিক: ৬০ - ১০০ bpm</span>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'তাপমাত্রা (°F)' : 'Temperature (°F)'}
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={tempF}
                    onChange={(e) => setTempF(e.target.value ? Number(e.target.value) : '')}
                    className={`h-12 text-base ${isHighFever ? 'border-destructive bg-destructive/5 font-bold text-destructive' : ''}`}
                    placeholder="98.6"
                  />
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">স্বাভাবিক: ৯৮.৪°F - ৯৮.৬°F</span>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'অক্সিজেন স্যাচুরেশন (SpO2 %)' : 'SpO2 (%)'}
                  </label>
                  <Input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value ? Number(e.target.value) : '')}
                    className={`h-12 text-base ${isCriticalSpO2 ? 'border-destructive bg-destructive/5 font-bold text-destructive' : ''}`}
                    placeholder="98"
                  />
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">স্বাভাবিক: ৯৫% - ১০০%</span>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {locale === 'bn' ? 'ওজন (কেজি / kg)' : 'Weight (kg)'}
                  </label>
                  <Input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : '')}
                    className="h-12 text-base"
                    placeholder="65"
                  />
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">ওষুধের সঠিক ডোজের জন্য</span>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)} className="min-h-12 px-5 text-base">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  <span>{locale === 'bn' ? 'পূর্ববর্তী' : 'Back'}</span>
                </Button>
                <Button onClick={() => setStep(4)} className="min-h-12 px-6 text-base font-bold">
                  <span>{locale === 'bn' ? 'পরবর্তী: অ্যালার্জি ও ওষুধ' : 'Next: Allergies & History'}</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Allergies, Current Meds & Medical History */}
        {step === 4 && (
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <span>{locale === 'bn' ? 'ধাপ ৪: পরিচিত অ্যালার্জি ও পূর্বের ওষুধ' : 'Step 4: Known Allergies & History'}</span>
              </CardTitle>
              <CardDescription className="text-sm">
                {locale === 'bn'
                  ? 'ওষুধের পার্শ্বপ্রতিক্রিয়া এবং ড্রাগ ইন্টারঅ্যাকশন রোধে পূর্ববর্তী তথ্য নথিভুক্ত করুন।'
                  : 'Document hypersensitivities, existing medications, and chronic conditions to prevent adverse events.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Known Allergies */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  {locale === 'bn' ? 'পরিচিত ড্রাগ অ্যালার্জি (Known Drug Allergies):' : 'Known Drug Allergies:'}
                </label>
                <div className="flex flex-wrap gap-2.5 mb-3">
                  {COMMON_ALLERGIES_BN.map((all) => {
                    const isSelected = selectedAllergies.includes(all);
                    return (
                      <button
                        key={all}
                        type="button"
                        onClick={() => toggleAllergy(all)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                          isSelected
                            ? 'bg-destructive text-destructive-foreground border-destructive'
                            : 'bg-muted/40 hover:bg-muted text-foreground border-border'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 inline mr-1" />}
                        {all}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={locale === 'bn' ? 'অন্য কোনো অ্যালার্জি যোগ করুন...' : 'Add other allergy...'}
                    value={customAllergy}
                    onChange={(e) => setCustomAllergy(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAllergy())}
                    className="h-11 text-sm"
                  />
                  <Button type="button" variant="outline" onClick={addCustomAllergy} className="h-11">
                    {locale === 'bn' ? 'যোগ করুন' : 'Add'}
                  </Button>
                </div>
              </div>

              {/* Current Medications */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">
                  {locale === 'bn' ? 'বর্তমানে সেবনরত ওষুধ সমূহ (প্রতি লাইনে একটি)' : 'Current Medications (One per line)'}
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    locale === 'bn'
                      ? 'উদা: Tab Napa 500mg (1+0+1)\nCap Seclo 20mg (1+0+0)'
                      : 'e.g. Tab Napa 500mg\nCap Seclo 20mg'
                  }
                  value={currentMedsText}
                  onChange={(e) => setCurrentMedsText(e.target.value)}
                  className="w-full p-3 rounded-lg border border-input bg-background text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Past History */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  {locale === 'bn' ? 'পূর্বের রোগব্যাধি ও ইতিহাস (Past Medical History):' : 'Past Medical History:'}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {COMMON_HISTORY_BN.map((hist) => {
                    const isSelected = selectedHistory.includes(hist);
                    return (
                      <button
                        key={hist}
                        type="button"
                        onClick={() => toggleHistory(hist)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/40 hover:bg-muted text-foreground border-border'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 inline mr-1" />}
                        {hist}
                      </button>
                    );
                  })}
                </div>
              </div>

              {autoSavedTime && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2">
                  <Save className="w-3.5 h-3.5 text-primary" />
                  <span>{locale === 'bn' ? `খসড়া স্বয়ংক্রিয় সংরক্ষিত: ${autoSavedTime}` : `Draft autosaved at: ${autoSavedTime}`}</span>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(3)} className="min-h-12 px-5 text-base">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  <span>{locale === 'bn' ? 'পূর্ববর্তী' : 'Back'}</span>
                </Button>
                <Button
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  className="min-h-12 px-8 text-base font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  <span>
                    {submitting
                      ? locale === 'bn'
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : locale === 'bn'
                        ? 'রোগী গ্রহণ সম্পন্ন করুন'
                        : 'Complete Patient Intake'}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

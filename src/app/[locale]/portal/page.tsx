'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  Calendar,
  Clock,
  FileText,
  UploadCloud,
  CheckCircle2,
  Circle,
  ShieldAlert,
  ShieldCheck,
  User,
  HeartPulse,
  Send,
  ExternalLink,
  Plus,
  HelpCircle,
  LogOut,
  Globe,
  Sun,
  Moon,
  Sunset,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ScheduleItem {
  id: string;
  medicineName: string;
  dosage: string;
  slot: 'morning' | 'noon' | 'night';
  mealRelation: string;
  takenToday: boolean;
  lastTakenAt: string | null;
  instructions: string | null;
}

interface PatientProfile {
  code: string;
  gender: string;
  age: number;
  bloodGroup: string | null;
  consentObtained: boolean;
}

interface PrescriptionItem {
  id: string;
  brandName: string;
  genericName: string;
  strength: string;
  form: string;
  dosingSchedule: string;
  mealTiming: string;
  durationText: string;
  instructions: string | null;
}

interface Prescription {
  id: string;
  rxNumber: string;
  diagnosis: string | null;
  investigations: string[];
  generalAdvice: string | null;
  followUpText: string | null;
  status: string;
  qrHash: string;
  finalizedAt: string | null;
  doctorName: string | null;
  doctorBmdc: string | null;
  items: PrescriptionItem[];
}

interface PatientReport {
  id: string;
  title: string;
  reportType: string;
  fileName: string;
  notes: string | null;
  uploadedAt: string;
}

interface PreVisitRecord {
  id: string;
  chiefComplaint: string;
  symptoms: string[];
  duration: string;
  notes: string | null;
  status: string;
  submittedAt: string;
}

export default function PatientPortalPage() {
  const router = useRouter();
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [activeTab, setActiveTab] = useState<'schedule' | 'prescriptions' | 'reports' | 'pre_visit' | 'consent'>('schedule');
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [prescriptionsList, setPrescriptionsList] = useState<Prescription[]>([]);
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [preVisits, setPreVisits] = useState<PreVisitRecord[]>([]);

  // Pre-visit form state
  const [complaint, setComplaint] = useState('');
  const [duration, setDuration] = useState('১-২ দিন');
  const [notes, setNotes] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [isSubmittingPreVisit, setIsSubmittingPreVisit] = useState(false);

  // Upload report modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportType, setNewReportType] = useState('lab_test');
  const [newReportNotes, setNewReportNotes] = useState('');

  // Consent revocation confirmation
  const [showConsentConfirm, setShowConsentConfirm] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/schedules');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.patient || null);
        setSchedules(data.schedules || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchPrescriptions = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/prescriptions');
      if (res.ok) {
        const data = await res.json();
        setPrescriptionsList(data.prescriptions || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchPreVisits = useCallback(async () => {
    try {
      const res = await fetch('/api/patient/pre-visit');
      if (res.ok) {
        const data = await res.json();
        setPreVisits(data.preVisits || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSchedules();
      fetchPrescriptions();
      fetchReports();
      fetchPreVisits();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSchedules, fetchPrescriptions, fetchReports, fetchPreVisits]);

  const handleToggleTaken = async (item: ScheduleItem) => {
    const nextTaken = !item.takenToday;
    try {
      const res = await fetch('/api/patient/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: item.id, takenToday: nextTaken }),
      });
      if (res.ok) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, takenToday: nextTaken } : s))
        );
        toast.success(
          nextTaken
            ? isBn
              ? 'ওষুধ গ্রহণের রেকর্ড সংরক্ষিত হয়েছে'
              : 'Marked as taken'
            : isBn
              ? 'স্ট্যাটাস পরিবর্তন হয়েছে'
              : 'Status updated'
        );
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক সমস্যা' : 'Network error');
    }
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportTitle) {
      toast.error(isBn ? 'রিপোর্টের শিরোনাম দিন' : 'Report title is required');
      return;
    }

    try {
      const res = await fetch('/api/patient/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newReportTitle,
          reportType: newReportType,
          fileName: `${newReportTitle.replace(/\s+/g, '_')}.pdf`,
          notes: newReportNotes,
        }),
      });

      if (res.ok) {
        toast.success(isBn ? 'রিপোর্ট সফলভাবে আপলোড হয়েছে' : 'Report uploaded successfully');
        setShowUploadModal(false);
        setNewReportTitle('');
        setNewReportNotes('');
        fetchReports();
      } else {
        toast.error(isBn ? 'আপলোড ব্যর্থ হয়েছে' : 'Upload failed');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    }
  };

  const handleSubmitPreVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) {
      toast.error(isBn ? 'প্রধান সমস্যার বিবরণ দিন' : 'Please describe your chief complaint');
      return;
    }

    setIsSubmittingPreVisit(true);
    try {
      const res = await fetch('/api/patient/pre-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chiefComplaint: complaint,
          symptoms: selectedSymptoms,
          duration,
          notes,
        }),
      });

      if (res.ok) {
        toast.success(
          isBn
            ? 'আপনার সমস্যা সফলভাবে ডাক্তারের কাছে জমা হয়েছে'
            : 'Pre-visit notes submitted to your doctor'
        );
        setComplaint('');
        setNotes('');
        setSelectedSymptoms([]);
        fetchPreVisits();
      } else {
        toast.error(isBn ? 'জমা দেওয়া যায়নি' : 'Submission failed');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setIsSubmittingPreVisit(false);
    }
  };

  const handleToggleConsent = async () => {
    if (!profile) return;
    setIsUpdatingConsent(true);
    const action = profile.consentObtained ? 'revoked' : 'granted';

    try {
      const res = await fetch('/api/patient/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'revoked' ? 'Patient requested consent revocation from portal.' : 'Consent restored.',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => (prev ? { ...prev, consentObtained: data.consentObtained } : null));
        setShowConsentConfirm(false);
        toast.success(data.message);
      } else {
        toast.error(isBn ? 'অনুরোধ ব্যর্থ' : 'Action failed');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  const morningItems = schedules.filter((s) => s.slot === 'morning');
  const noonItems = schedules.filter((s) => s.slot === 'noon');
  const nightItems = schedules.filter((s) => s.slot === 'night');

  const commonSymptoms = [
    'জ্বর (Fever)',
    'কাশি (Cough)',
    'শ্বাসকষ্ট (Shortness of Breath)',
    'মাথাব্যথা (Headache)',
    'পেটব্যথা (Abdominal Pain)',
    'বমি ভাব (Nausea)',
    'শরীর দুর্বলতা (Fatigue)',
  ];

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s]
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Top Patient Header Bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-400">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-foreground">
                  {isBn ? 'রোগী পোর্টাল' : 'Patient Portal'}
                </span>
                {profile && (
                  <Badge variant="outline" className="text-xs bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200">
                    {profile.code}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isBn ? 'প্রেসক্রিপশন ও দৈনিক ওষুধের সময়সূচি' : 'Prescriptions & Daily Medication Schedule'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5"
              onClick={() => router.push('/portal', { locale: isBn ? 'en' : 'bn' })}
            >
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              {isBn ? 'English' : 'বাংলা'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs flex items-center gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/login');
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              {isBn ? 'লগআউট' : 'Log Out'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Patient Profile Card & Consent Notice */}
        {profile && (
          <Card className="border border-border bg-card shadow-xs">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center font-bold text-lg text-foreground">
                  <User className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">
                      {isBn ? 'নিবন্ধিত রোগী' : 'Registered Patient'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({profile.age} {isBn ? 'বছর' : 'yrs'}, {profile.gender})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {profile.bloodGroup && (
                      <span>{isBn ? 'রক্তের গ্রুপ:' : 'Blood Group:'} <strong className="text-foreground">{profile.bloodGroup}</strong></span>
                    )}
                    <span>•</span>
                    <span>
                      {isBn ? 'সম্মতি স্ট্যাটাস:' : 'Consent:'}{' '}
                      <strong className={profile.consentObtained ? 'text-teal-700 dark:text-teal-400' : 'text-destructive'}>
                        {profile.consentObtained
                          ? isBn ? 'সক্রিয় (Active)' : 'Active'
                          : isBn ? 'প্রত্যাহারকৃত (Revoked)' : 'Revoked'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {!profile.consentObtained && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs border border-amber-200 dark:border-amber-900">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{isBn ? 'তথ্য শেয়ারিং বন্ধ রাখা হয়েছে।' : 'Data sharing is revoked.'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'schedule' | 'prescriptions' | 'reports' | 'pre_visit' | 'consent')} className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="schedule" className="text-xs sm:text-sm py-2">
              <Calendar className="w-4 h-4 mr-1.5 hidden sm:inline" />
              {isBn ? 'ওষুধ সূচি' : 'Schedule'}
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="text-xs sm:text-sm py-2">
              <FileText className="w-4 h-4 mr-1.5 hidden sm:inline" />
              {isBn ? 'প্রেসক্রিপশন' : 'Prescriptions'}
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm py-2">
              <UploadCloud className="w-4 h-4 mr-1.5 hidden sm:inline" />
              {isBn ? 'রিপোর্ট' : 'Reports'}
            </TabsTrigger>
            <TabsTrigger value="pre_visit" className="text-xs sm:text-sm py-2">
              <Send className="w-4 h-4 mr-1.5 hidden sm:inline" />
              {isBn ? 'পূর্ব-ভিজিট' : 'Pre-Visit'}
            </TabsTrigger>
            <TabsTrigger value="consent" className="text-xs sm:text-sm py-2">
              <ShieldCheck className="w-4 h-4 mr-1.5 hidden sm:inline" />
              {isBn ? 'সম্মতি' : 'Consent'}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Medication Schedule */}
          <TabsContent value="schedule" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {isBn ? 'আজকের ওষুধের সময়সূচি' : "Today's Medication Schedule"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'চিকিৎসকের প্রেসক্রিপশন অনুযায়ী প্রতিদিন ওষুধ গ্রহণের পর টিক দিন'
                    : 'Track your daily medicines as prescribed by your doctor'}
                </p>
              </div>
            </div>

            {/* Morning Slot */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <Sun className="w-4 h-4" />
                <span>{isBn ? 'সকাল (Morning)' : 'Morning'}</span>
                <span className="text-xs text-muted-foreground font-normal">({morningItems.length} টি ওষুধ)</span>
              </div>
              <div className="space-y-2">
                {morningItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-6">{isBn ? 'সকালে কোনো ওষুধ নেই' : 'No medicines for morning'}</p>
                ) : (
                  morningItems.map((item) => (
                    <Card
                      key={item.id}
                      className={`border transition-all cursor-pointer ${
                        item.takenToday
                          ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900'
                          : 'bg-card border-border hover:border-teal-300'
                      }`}
                      onClick={() => handleToggleTaken(item)}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-0.5 text-teal-700 dark:text-teal-400 focus:outline-none"
                            aria-label={item.takenToday ? 'Mark not taken' : 'Mark taken'}
                          >
                            {item.takenToday ? (
                              <CheckCircle2 className="w-6 h-6 fill-teal-100 dark:fill-teal-950" />
                            ) : (
                              <Circle className="w-6 h-6 text-muted-foreground" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-base ${item.takenToday ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {item.medicineName}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {item.dosage}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="font-medium text-foreground">{item.mealRelation}</span>
                              {item.instructions && <span>• {item.instructions}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <Badge
                            className={
                              item.takenToday
                                ? 'bg-teal-700 hover:bg-teal-800 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }
                          >
                            {item.takenToday ? (isBn ? 'খেয়েছি ✓' : 'Taken ✓') : (isBn ? 'এখনও খাইনি' : 'Pending')}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Noon Slot */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
                <Sunset className="w-4 h-4" />
                <span>{isBn ? 'দুপুর (Noon / Afternoon)' : 'Noon'}</span>
                <span className="text-xs text-muted-foreground font-normal">({noonItems.length} টি ওষুধ)</span>
              </div>
              <div className="space-y-2">
                {noonItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-6">{isBn ? 'দুপুরে কোনো ওষুধ নেই' : 'No medicines for noon'}</p>
                ) : (
                  noonItems.map((item) => (
                    <Card
                      key={item.id}
                      className={`border transition-all cursor-pointer ${
                        item.takenToday
                          ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900'
                          : 'bg-card border-border hover:border-teal-300'
                      }`}
                      onClick={() => handleToggleTaken(item)}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-0.5 text-teal-700 dark:text-teal-400 focus:outline-none"
                            aria-label={item.takenToday ? 'Mark not taken' : 'Mark taken'}
                          >
                            {item.takenToday ? (
                              <CheckCircle2 className="w-6 h-6 fill-teal-100 dark:fill-teal-950" />
                            ) : (
                              <Circle className="w-6 h-6 text-muted-foreground" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-base ${item.takenToday ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {item.medicineName}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {item.dosage}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="font-medium text-foreground">{item.mealRelation}</span>
                              {item.instructions && <span>• {item.instructions}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <Badge
                            className={
                              item.takenToday
                                ? 'bg-teal-700 hover:bg-teal-800 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }
                          >
                            {item.takenToday ? (isBn ? 'খেয়েছি ✓' : 'Taken ✓') : (isBn ? 'এখনও খাইনি' : 'Pending')}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Night Slot */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                <Moon className="w-4 h-4" />
                <span>{isBn ? 'রাত (Night / Bedtime)' : 'Night'}</span>
                <span className="text-xs text-muted-foreground font-normal">({nightItems.length} টি ওষুধ)</span>
              </div>
              <div className="space-y-2">
                {nightItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-6">{isBn ? 'রাতে কোনো ওষুধ নেই' : 'No medicines for night'}</p>
                ) : (
                  nightItems.map((item) => (
                    <Card
                      key={item.id}
                      className={`border transition-all cursor-pointer ${
                        item.takenToday
                          ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900'
                          : 'bg-card border-border hover:border-teal-300'
                      }`}
                      onClick={() => handleToggleTaken(item)}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-0.5 text-teal-700 dark:text-teal-400 focus:outline-none"
                            aria-label={item.takenToday ? 'Mark not taken' : 'Mark taken'}
                          >
                            {item.takenToday ? (
                              <CheckCircle2 className="w-6 h-6 fill-teal-100 dark:fill-teal-950" />
                            ) : (
                              <Circle className="w-6 h-6 text-muted-foreground" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-base ${item.takenToday ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {item.medicineName}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {item.dosage}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="font-medium text-foreground">{item.mealRelation}</span>
                              {item.instructions && <span>• {item.instructions}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <Badge
                            className={
                              item.takenToday
                                ? 'bg-teal-700 hover:bg-teal-800 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }
                          >
                            {item.takenToday ? (isBn ? 'খেয়েছি ✓' : 'Taken ✓') : (isBn ? 'এখনও খাইনি' : 'Pending')}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: My Prescriptions */}
          <TabsContent value="prescriptions" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {isBn ? 'আমার প্রেসক্রিপশনসমূহ' : 'My Prescriptions'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'চিকিৎসক কর্তৃক যাচাইকৃত ও ডিজিটালি স্বাক্ষরিত অফিসিয়াল প্রেসক্রিপশন'
                    : 'Officially verified and digitally signed prescriptions'}
                </p>
              </div>
            </div>

            {prescriptionsList.length === 0 ? (
              <Card className="border border-dashed border-border p-8 text-center">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isBn ? 'এখনও কোনো প্রেসক্রিপশন রেকর্ড পাওয়া যায়নি।' : 'No prescriptions found yet.'}
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {prescriptionsList.map((rx) => (
                  <Card key={rx.id} className="border border-border bg-card shadow-xs">
                    <CardHeader className="p-4 pb-2 border-b border-border/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{rx.rxNumber}</span>
                            <Badge className="bg-teal-700 text-white text-xs">
                              {rx.status === 'finalized' ? (isBn ? 'চূড়ান্ত' : 'Finalized') : (isBn ? 'খসড়া' : 'Draft')}
                            </Badge>
                          </div>
                          {rx.doctorName && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {rx.doctorName} {rx.doctorBmdc && `(BMDC: ${rx.doctorBmdc})`}
                            </p>
                          )}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex items-center gap-1.5 self-start sm:self-auto"
                          onClick={() => router.push(`/prescriptions/${rx.id}`)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {isBn ? 'অফিসিয়াল প্যাড ভিউ' : 'View Official Pad'}
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3">
                      {rx.diagnosis && (
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground block">{isBn ? 'রোগ নির্ণয়:' : 'Diagnosis:'}</span>
                          <span className="text-sm font-medium text-foreground">{rx.diagnosis}</span>
                        </div>
                      )}

                      <div>
                        <span className="text-xs font-semibold text-muted-foreground block mb-1.5">
                          {isBn ? 'প্রেসক্রিপশনভুক্ত ওষুধসমূহ:' : 'Prescribed Medicines:'}
                        </span>
                        <div className="space-y-1.5">
                          {rx.items.map((item) => (
                            <div key={item.id} className="text-xs p-2 rounded bg-muted/40 flex items-center justify-between gap-2">
                              <div>
                                <span className="font-semibold text-foreground">
                                  {item.form} {item.brandName}
                                </span>{' '}
                                <span className="text-muted-foreground">({item.strength})</span>
                                <span className="block text-muted-foreground">
                                  {item.mealTiming} • {item.durationText}
                                </span>
                              </div>
                              <Badge variant="outline" className="font-mono text-xs">
                                {item.dosingSchedule}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      {rx.generalAdvice && (
                        <div className="text-xs text-muted-foreground bg-teal-50/40 dark:bg-teal-950/20 p-2.5 rounded-lg border border-teal-100 dark:border-teal-900">
                          <strong className="text-foreground">{isBn ? 'সাধারণ উপদেশ:' : 'Advice:'}</strong> {rx.generalAdvice}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Uploaded Reports */}
          <TabsContent value="reports" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {isBn ? 'মেডিকেল রিপোর্ট ও ফাইল' : 'Medical Reports & Files'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isBn ? 'ডাক্তারের দেখার জন্য পূর্বের টেস্ট ও রিপোর্ট সংরক্ষণ করুন' : 'Store previous lab tests and reports for your doctor to review'}
                </p>
              </div>

              <Button
                size="sm"
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs flex items-center gap-1.5"
                onClick={() => setShowUploadModal(true)}
              >
                <Plus className="w-4 h-4" />
                {isBn ? 'নতুন রিপোর্ট যোগ করুন' : 'Add Report'}
              </Button>
            </div>

            {reports.length === 0 ? (
              <Card className="border border-dashed border-border p-8 text-center">
                <UploadCloud className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isBn ? 'এখনও কোনো রিপোর্ট আপলোড করা হয়নি।' : 'No reports uploaded yet.'}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reports.map((rep) => (
                  <Card key={rep.id} className="border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {rep.reportType.replace('_', ' ')}
                        </Badge>
                        <h4 className="font-semibold text-sm text-foreground">{rep.title}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{rep.fileName}</p>
                        {rep.notes && <p className="text-xs text-muted-foreground mt-1">{rep.notes}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(rep.uploadedAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab 4: Pre-Visit Symptom Form */}
          <TabsContent value="pre_visit" className="space-y-4 mt-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isBn ? 'ডাক্তার সাক্ষাতের পূর্ব-প্রস্তুতি' : 'Pre-Visit Consultation Form'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isBn
                  ? 'আপনার বর্তমান শারীরিক সমস্যা ও লক্ষণসমূহ আগে থেকেই লিখে রাখুন যেন চিকিৎসক দ্রুত পর্যবেক্ষণ করতে পারেন'
                  : 'Submit your symptoms beforehand so your doctor can prepare for your visit'}
              </p>
            </div>

            <Card className="border border-border bg-card">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <form onSubmit={handleSubmitPreVisit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      {isBn ? 'প্রধান সমস্যা (Chief Complaint) *' : 'Chief Complaint *'}
                    </label>
                    <Input
                      placeholder={isBn ? 'যেমন: দুই দিন ধরে তীব্র জ্বর ও শুকনা কাশি' : 'e.g. High fever and persistent dry cough for 2 days'}
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      {isBn ? 'লক্ষণসমূহ নির্বাচন করুন (ট্যাপ করুন):' : 'Select Common Symptoms:'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {commonSymptoms.map((s) => {
                        const active = selectedSymptoms.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleSymptom(s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-teal-700 text-white border-teal-700'
                                : 'bg-background text-foreground border-border hover:border-teal-400'
                            }`}
                          >
                            {active ? '✓ ' : '+ '}
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        {isBn ? 'সমস্যার স্থায়িত্বকাল' : 'Duration'}
                      </label>
                      <Input
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder={isBn ? 'যেমন: ৩ দিন' : 'e.g. 3 days'}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        {isBn ? 'অন্যান্য বিবরণ বা প্রশ্ন (ঐচ্ছিক)' : 'Additional Notes / Questions'}
                      </label>
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={isBn ? 'ডাক্তারকে বিশেষ কিছু জানাতে চান?' : 'Any specific question for your doctor?'}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmittingPreVisit}
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-2.5"
                  >
                    {isSubmittingPreVisit ? (isBn ? 'জমা হচ্ছে...' : 'Submitting...') : (isBn ? 'সমস্যা চিকিৎসকের কাছে জমা দিন' : 'Submit Pre-Visit Notes')}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Past Pre-Visit Submissions */}
            {preVisits.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isBn ? 'পূর্বে জমা দেওয়া নোটসমূহ:' : 'Previous Submissions:'}
                </h4>
                {preVisits.map((pv) => (
                  <Card key={pv.id} className="border border-border bg-card p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{pv.chiefComplaint}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {pv.status}
                      </Badge>
                    </div>
                    {pv.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pv.symptoms.map((sym) => (
                          <span key={sym} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                            {sym}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab 5: Consent & Privacy */}
          <TabsContent value="consent" className="space-y-4 mt-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isBn ? 'সম্মতি ও স্বাস্থ্য তথ্যের গোপনীয়তা' : 'Consent & Health Data Privacy'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isBn
                  ? 'আপনার স্বাস্থ্য তথ্য ব্যবহারের পূর্ণ নিয়ন্ত্রণ আপনার হাতে। আপনি যেকোনো সময় সম্মতি প্রত্যাহার করতে পারেন।'
                  : 'You have full sovereignty over your health data. You may grant or revoke processing consent at any time.'}
              </p>
            </div>

            <Card className="border border-border bg-card">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900">
                  <ShieldCheck className="w-6 h-6 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-foreground block text-sm">
                      {isBn ? 'তথ্য সুরক্ষা ও গোপনীয়তার নীতি' : 'Data Privacy & Encryption Safeguards'}
                    </span>
                    <p className="text-muted-foreground">
                      {isBn
                        ? 'আপনার নাম ও মোবাইল নম্বর মিলিটারি-গ্রেড AES-256 এনক্রিপশনের মাধ্যমে সংরক্ষিত। কোনো তৃতীয় পক্ষ বা এআই মডেলের কাছে আপনার পরিচয় প্রকাশ করা হয় না।'
                        : 'Your identity and contact numbers are stored with AES-256-GCM encryption. No PHI is ever disclosed to external AI models.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-border">
                  <div>
                    <span className="font-semibold text-sm text-foreground block">
                      {isBn ? 'ডিজিটাল প্রেসক্রিপশন ও স্বাস্থ্য তথ্য শেয়ারিং' : 'Digital Prescription Data Sharing'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {profile?.consentObtained
                        ? isBn
                          ? 'সম্মতি প্রদান করা হয়েছে। চিকিৎসক আপনার প্রেসক্রিপশন ও ফলোআপ দেখতে পারবেন।'
                          : 'Consent granted. Doctors can record visits and prepare prescriptions.'
                        : isBn
                          ? 'সম্মতি প্রত্যাহারকৃত। চিকিৎসক নতুন রেকর্ড সংযুক্ত করতে পারবেন না।'
                          : 'Consent revoked. Doctors cannot attach new records.'}
                    </span>
                  </div>

                  <Button
                    variant={profile?.consentObtained ? 'destructive' : 'default'}
                    size="sm"
                    disabled={isUpdatingConsent}
                    onClick={() => setShowConsentConfirm(true)}
                  >
                    {profile?.consentObtained
                      ? isBn ? 'সম্মতি প্রত্যাহার করুন' : 'Revoke Consent'
                      : isBn ? 'সম্মতি প্রদান করুন' : 'Grant Consent'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Persistent Doctor Decides Disclaimer */}
        <div className="text-center p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground border border-border">
          <HelpCircle className="w-4 h-4 inline mr-1 text-teal-700 dark:text-teal-400" />
          {isBn
            ? 'শুধুমাত্র রোগীর তথ্য ও ওষুধ সেবনের সময়সূচি সহায়তা। প্রেসক্রিপশন এবং ওষুধের মাত্রা চিকিৎসক দ্বারা নির্ধারিত।'
            : 'Patient medication tracking support only. Dosages and treatments are strictly determined by your physician.'}
        </div>
      </main>

      {/* Upload Report Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border border-border">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-base text-foreground">
                {isBn ? 'নতুন মেডিকেল রিপোর্ট আপলোড' : 'Upload Medical Report'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <form onSubmit={handleUploadReport} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    {isBn ? 'রিপোর্টের নাম *' : 'Report Title *'}
                  </label>
                  <Input
                    placeholder={isBn ? 'যেমন: সিরাম ক্রিয়েটিনিন টেস্ট' : 'e.g. Serum Creatinine Test'}
                    value={newReportTitle}
                    onChange={(e) => setNewReportTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    {isBn ? 'ধরন' : 'Report Type'}
                  </label>
                  <select
                    className="w-full text-xs p-2 rounded-md border border-border bg-background text-foreground"
                    value={newReportType}
                    onChange={(e) => setNewReportType(e.target.value)}
                  >
                    <option value="lab_test">{isBn ? 'ল্যাব টেস্ট (Lab Test)' : 'Lab Test'}</option>
                    <option value="imaging">{isBn ? 'এক্স-রে / আল্ট্রাসাউন্ড (Imaging)' : 'Imaging'}</option>
                    <option value="prior_prescription">{isBn ? 'পূর্ববর্তী প্রেসক্রিপশন' : 'Prior Prescription'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    {isBn ? 'মন্তব্য (ঐচ্ছিক)' : 'Notes (Optional)'}
                  </label>
                  <Input
                    placeholder={isBn ? 'ল্যাবরেটরি বা কোনো বিশেষ পর্যবেক্ষণ' : 'Lab details or remarks'}
                    value={newReportNotes}
                    onChange={(e) => setNewReportNotes(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowUploadModal(false)}>
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </Button>
                  <Button type="submit" size="sm" className="bg-teal-700 hover:bg-teal-800 text-white">
                    {isBn ? 'আপলোড সম্পন্ন করুন' : 'Confirm Upload'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Consent Confirmation Dialog */}
      {showConsentConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-card border border-border">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-base text-foreground">
                {profile?.consentObtained
                  ? isBn ? 'সম্মতি প্রত্যাহারের নিশ্চিতকরণ' : 'Confirm Consent Revocation'
                  : isBn ? 'সম্মতি প্রদানের নিশ্চিতকরণ' : 'Confirm Consent Grant'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {profile?.consentObtained
                  ? isBn
                    ? 'আপনি কি নিশ্চিত যে আপনি আপনার স্বাস্থ্য তথ্য শেয়ারিংয়ের সম্মতি প্রত্যাহার করতে চান? এটি করলে চিকিৎসক আপনার প্রোফাইলে নতুন ভিজিট তৈরি করতে পারবেন না।'
                    : 'Are you sure you want to revoke consent? Doctors will not be able to record new visits or prescriptions.'
                  : isBn
                    ? 'আপনি আপনার ডিজিটাল স্বাস্থ্য রেকর্ড চিকিৎসকের সাথে শেয়ার করার সম্মতি প্রদান করছেন।'
                    : 'You are granting consent for your doctor to access and record visits.'}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowConsentConfirm(false)}>
                  {isBn ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button
                  variant={profile?.consentObtained ? 'destructive' : 'default'}
                  size="sm"
                  onClick={handleToggleConsent}
                  disabled={isUpdatingConsent}
                >
                  {isUpdatingConsent
                    ? isBn ? 'হালনাগাদ হচ্ছে...' : 'Updating...'
                    : profile?.consentObtained
                      ? isBn ? 'হ্যাঁ, প্রত্যাহার করুন' : 'Yes, Revoke'
                      : isBn ? 'হ্যাঁ, সম্মতি দিন' : 'Yes, Grant'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

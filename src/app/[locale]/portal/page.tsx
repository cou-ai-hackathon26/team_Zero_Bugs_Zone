'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { OnboardingTourBlock } from '@/components/shared/OnboardingTourBlock';
import {
  Clock,
  FileText,
  UploadCloud,
  Circle,
  ShieldCheck,
  User,
  HeartPulse,
  Plus,
  Sun,
  Moon,
  Sunset,
  Eye,
  Check,
  UserPlus,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ProfileItem {
  id: string;
  name: string;
  relation: string;
  age: number;
  gender: string;
  bloodGroup: string | null;
  claimed: boolean;
  createdAt: string;
}

interface ScheduleItem {
  id: string;
  prescriptionItemId?: string;
  medicineName: string;
  dosage: string;
  slot: 'morning' | 'noon' | 'night';
  mealRelation: string;
  takenToday: boolean;
  lastTakenAt: string | null;
  instructions: string | null;
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
  doctorName: string;
  doctorBmdc: string;
  items: PrescriptionItem[];
}

interface PatientReport {
  id: string;
  title: string;
  reportType: string;
  fileUrl: string;
  fileName: string;
  notes: string | null;
  isShared: boolean;
  uploadedAt: string;
}

interface GrantItem {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorBmdc: string;
  scope: string;
  status: string;
  grantedVia: string;
  expiresAt: string | null;
  daysRemaining: number | null;
  createdAt: string;
}

interface AccessLogItem {
  id: string;
  action: string;
  recordType: string | null;
  reason: string | null;
  createdAt: string;
  accessorName: string;
  accessorRole: string;
}

interface HealthSummary {
  allergies: string[];
  chronicConditions: string[];
  currentMedicines: Array<{ brand: string; generic: string; dose?: string }>;
  bloodGroup: string | null;
  version: number;
}

export default function PatientPortalPage() {
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [activeProfile, setActiveProfile] = useState<ProfileItem | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [grants, setGrants] = useState<GrantItem[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLogItem[]>([]);

  // Modals
  const [showAddDependent, setShowAddDependent] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);

  // New Dependent Form
  const [depName, setDepName] = useState('');
  const [depRelation, setDepRelation] = useState<'child' | 'spouse' | 'parent' | 'other'>('child');
  const [depAge, setDepAge] = useState<number | ''>(8);
  const [depGender, setDepGender] = useState<'male' | 'female'>('male');
  const [depBlood, setDepBlood] = useState('B+');
  const [addingDep, setAddingDep] = useState(false);

  // Upload Form
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportType, setNewReportType] = useState('lab_test');
  const [newReportNotes, setNewReportNotes] = useState('');
  const [uploadingReport, setUploadingReport] = useState(false);

  const fetchPortalData = useCallback(async (profId?: string) => {
    try {
      const q = profId ? `?profileId=${profId}` : '';
      const res = await fetch(`/api/patient/portal${q}`, { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error('Failed to load portal data');
      }
      const data = await res.json();
      setProfiles(data.profiles || []);
      setActiveProfile(data.activeProfile || null);
      if (data.activeProfile) {
        setActiveProfileId(data.activeProfile.id);
      }
      setHealthSummary(data.healthSummary);
      setSchedules(data.schedules || []);
      setPrescriptions(data.prescriptions || []);
      setReports(data.reports || []);
      setGrants(data.grants || []);
      setAccessLogs(data.accessLogs || []);
    } catch (err: unknown) {
      console.error(err);
      toast.error(isBn ? 'পোর্টাল তথ্য লোড করা যায়নি' : 'Failed to load portal data');
    } finally {
      setLoading(false);
    }
  }, [isBn]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const res = await fetch('/api/patient/portal', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to load portal data');
        const data = await res.json();
        if (!mounted) return;
        setProfiles(data.profiles || []);
        setActiveProfile(data.activeProfile || null);
        if (data.activeProfile) {
          setActiveProfileId(data.activeProfile.id);
        }
        setHealthSummary(data.healthSummary);
        setSchedules(data.schedules || []);
        setPrescriptions(data.prescriptions || []);
        setReports(data.reports || []);
        setGrants(data.grants || []);
        setAccessLogs(data.accessLogs || []);
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleProfileSwitch = (profId: string) => {
    setActiveProfileId(profId);
    setLoading(true);
    fetchPortalData(profId);
  };

  // Medicine Taken Toggle
  const handleMarkTaken = async (item: ScheduleItem) => {
    if (item.takenToday) return;
    try {
      const res = await fetch('/api/patient/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: activeProfileId,
          prescriptionItemId: item.prescriptionItemId,
          scheduleId: item.id,
          slot: item.slot,
        }),
      });
      if (res.ok) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, takenToday: true, lastTakenAt: new Date().toISOString() } : s))
        );
        toast.success(isBn ? `${item.medicineName} সেবন রেকর্ড করা হয়েছে!` : `${item.medicineName} marked as taken!`);
      } else {
        toast.error(isBn ? 'রেকর্ড সংরক্ষণ ব্যর্থ' : 'Failed to record dose');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    }
  };

  // Add Dependent Profile
  const handleCreateDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depName.trim() || !depAge) {
      toast.error(isBn ? 'নাম ও বয়স প্রদান করুন' : 'Provide name and age');
      return;
    }
    try {
      setAddingDep(true);
      const res = await fetch('/api/patient/dependent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: depName.trim(),
          relation: depRelation,
          age: Number(depAge),
          gender: depGender,
          bloodGroup: depBlood,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(isBn ? 'সদস্যের প্রোফাইল যোগ হয়েছে!' : 'Family member added!');
        setShowAddDependent(false);
        setDepName('');
        fetchPortalData(data.profile.id);
      } else {
        toast.error(data.error || 'Failed to add member');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setAddingDep(false);
    }
  };

  // Revoke Access Grant
  const handleRevokeGrant = async (grantId: string) => {
    try {
      setRevokingGrantId(grantId);
      const res = await fetch('/api/patient/grants/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId, profileId: activeProfileId }),
      });
      if (res.ok) {
        toast.success(isBn ? 'ডাক্তারের অনুমতি বাতিল করা হয়েছে' : 'Doctor access grant revoked');
        setGrants((prev) =>
          prev.map((g) => (g.id === grantId ? { ...g, status: 'revoked' } : g))
        );
      } else {
        toast.error(isBn ? 'অনুমতি বাতিল ব্যর্থ' : 'Failed to revoke grant');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setRevokingGrantId(null);
    }
  };

  // Toggle Report Sharing
  const handleToggleReportShare = async (reportId: string, currentShare: boolean) => {
    try {
      const nextShare = !currentShare;
      const res = await fetch('/api/patient/reports/toggle-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, isShared: nextShare }),
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, isShared: nextShare } : r))
        );
        toast.success(
          nextShare
            ? isBn ? 'রিপোর্টটি এখন ডাক্তারের সাথে শেয়ার করা হচ্ছে' : 'Report shared with doctor'
            : isBn ? 'রিপোর্টটি গোপন রাখা হয়েছে' : 'Report kept private'
        );
      }
    } catch {
      toast.error(isBn ? 'হালনাগাদ ব্যর্থ' : 'Failed to update sharing');
    }
  };

  // Upload Report Submit
  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportTitle.trim()) return;
    try {
      setUploadingReport(true);
      const res = await fetch('/api/patient/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newReportTitle,
          reportType: newReportType,
          fileName: `${newReportTitle.replace(/\s+/g, '_')}.pdf`,
          fileUrl: `/uploads/demo_${Date.now()}.pdf`,
          notes: newReportNotes,
          profileId: activeProfileId,
        }),
      });
      if (res.ok) {
        toast.success(isBn ? 'রিপোর্ট আপলোড সম্পন্ন হয়েছে' : 'Report uploaded successfully');
        setShowUploadModal(false);
        setNewReportTitle('');
        setNewReportNotes('');
        fetchPortalData(activeProfileId);
      } else {
        toast.error(isBn ? 'আপলোড ব্যর্থ হয়েছে' : 'Failed to upload report');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setUploadingReport(false);
    }
  };

  const morningItems = schedules.filter((s) => s.slot === 'morning');
  const noonItems = schedules.filter((s) => s.slot === 'noon');
  const nightItems = schedules.filter((s) => s.slot === 'night');

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center space-y-3 animate-pulse">
          <HeartPulse className="w-10 h-10 text-primary mx-auto animate-bounce" />
          <p className="text-sm text-muted-foreground">
            {isBn ? 'রোগী পোর্টাল ও প্রেসক্রিপশন লোড হচ্ছে...' : 'Loading patient portal & prescriptions...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <PageHeader
          title={isBn ? 'রোগী পোর্টাল' : 'Patient Portal'}
          subtitle={
            isBn
              ? 'প্রেসক্রিপশন, ওষুধ গ্রহণ ট্র্যাকার ও সম্মতি নিয়ন্ত্রণ'
              : 'Prescriptions, medication tracker & consent control'
          }
        />

        {/* Multi-Profile Switcher Bar */}
        <div className="p-3 rounded-xl border border-border bg-card/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              {isBn ? 'রোগী প্রোফাইল নির্বাচন করুন (Family Account Profiles):' : 'Select Active Profile:'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {profiles.map((p) => {
                const isActive = p.id === activeProfileId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProfileSwitch(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted/70 hover:bg-muted text-foreground border border-border'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{p.name}</span>
                    <span className="text-[10px] opacity-80">({p.relation})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAddDependent(true)}
            className="text-xs h-8 px-2.5 gap-1 shrink-0 border-dashed"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isBn ? '+ নতুন সদস্য' : '+ Add Family Member'}</span>
          </Button>
        </div>

        {/* Active Profile Health Card */}
        {activeProfile && (
          <Card data-tour="portal-profile" className="border border-border bg-card shadow-xs">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">
                      {activeProfile.name}
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {activeProfile.age} {isBn ? 'বছর' : 'yrs'}, {activeProfile.gender}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {activeProfile.relation}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                    {activeProfile.bloodGroup && (
                      <span>
                        {isBn ? 'রক্তের গ্রুপ:' : 'Blood Group:'}{' '}
                        <strong className="text-destructive font-bold">{activeProfile.bloodGroup}</strong>
                      </span>
                    )}
                    {healthSummary?.allergies && healthSummary.allergies.length > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 font-medium">
                        • {isBn ? 'অ্যালার্জি:' : 'Allergies:'} {healthSummary.allergies.join(', ')}
                      </span>
                    )}
                    {healthSummary?.chronicConditions && healthSummary.chronicConditions.length > 0 && (
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        • {isBn ? 'দীর্ঘমেয়াদী রোগ:' : 'Conditions:'} {healthSummary.chronicConditions.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Portal Tabs Navigation */}
        <Tabs defaultValue="today" className="space-y-4">
          <TabsList data-tour="portal-tabs" className="grid grid-cols-4 w-full bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="today" data-tour="portal-schedule" className="text-xs font-semibold gap-1.5 py-2">
              <Clock className="w-3.5 h-3.5" />
              <span>{isBn ? 'আজকের ওষুধ' : 'Today’s Meds'}</span>
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="text-xs font-semibold gap-1.5 py-2">
              <FileText className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্রেসক্রিপশন' : 'Prescriptions'}</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs font-semibold gap-1.5 py-2">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{isBn ? 'রিপোর্ট' : 'Reports'}</span>
            </TabsTrigger>
            <TabsTrigger value="consent" data-tour="portal-consent" className="text-xs font-semibold gap-1.5 py-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isBn ? 'অনুমতি ও নিরাপত্তা' : 'Consent & Logs'}</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Today's Medication Routine with 'খেয়েছি' (Taken) buttons */}
          <TabsContent value="today" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {isBn ? 'আজকের ওষুধ সেবনের সময়সূচি' : 'Today’s Medication Schedule'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'ওষুধ খাওয়ার পর "খেয়েছি" বোতামে চাপ দিয়ে হিস্ট্রি সংরক্ষণ করুন'
                    : 'Tap "Taken" after having each dose to keep an accurate medication log'}
                </p>
              </div>
            </div>

            {schedules.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <CardContent className="p-0 text-sm text-muted-foreground">
                  {isBn ? 'বর্তমানে কোনো সক্রিয় ওষুধের সময়সূচি নেই' : 'No active medication schedule for today'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Morning Slot */}
                {morningItems.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="p-3.5 pb-2 bg-amber-500/5 border-b border-border/40">
                      <CardTitle className="text-xs font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <Sun className="w-4 h-4" />
                        <span>{isBn ? 'সকাল (Morning Routine)' : 'Morning Routine'}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 space-y-2.5">
                      {morningItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-all gap-3"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-sm text-foreground block">
                              {item.medicineName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.dosage} • <strong className="text-foreground">{item.mealRelation}</strong>
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={item.takenToday}
                            onClick={() => handleMarkTaken(item)}
                            className={`min-h-9 px-3.5 text-xs font-bold gap-1.5 transition-all ${
                              item.takenToday
                                ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                            }`}
                          >
                            {item.takenToday ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{isBn ? '✓ সম্পন্ন' : '✓ Done'}</span>
                              </>
                            ) : (
                              <>
                                <Circle className="w-3.5 h-3.5" />
                                <span>{isBn ? 'খেয়েছি' : 'Taken'}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Noon Slot */}
                {noonItems.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="p-3.5 pb-2 bg-blue-500/5 border-b border-border/40">
                      <CardTitle className="text-xs font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Sunset className="w-4 h-4" />
                        <span>{isBn ? 'দুপুর (Noon Routine)' : 'Noon Routine'}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 space-y-2.5">
                      {noonItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-all gap-3"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-sm text-foreground block">
                              {item.medicineName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.dosage} • <strong className="text-foreground">{item.mealRelation}</strong>
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={item.takenToday}
                            onClick={() => handleMarkTaken(item)}
                            className={`min-h-9 px-3.5 text-xs font-bold gap-1.5 transition-all ${
                              item.takenToday
                                ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                            }`}
                          >
                            {item.takenToday ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{isBn ? '✓ সম্পন্ন' : '✓ Done'}</span>
                              </>
                            ) : (
                              <>
                                <Circle className="w-3.5 h-3.5" />
                                <span>{isBn ? 'খেয়েছি' : 'Taken'}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Night Slot */}
                {nightItems.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="p-3.5 pb-2 bg-indigo-500/5 border-b border-border/40">
                      <CardTitle className="text-xs font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                        <Moon className="w-4 h-4" />
                        <span>{isBn ? 'রাত (Night Routine)' : 'Night Routine'}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3.5 space-y-2.5">
                      {nightItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-all gap-3"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-sm text-foreground block">
                              {item.medicineName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.dosage} • <strong className="text-foreground">{item.mealRelation}</strong>
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={item.takenToday}
                            onClick={() => handleMarkTaken(item)}
                            className={`min-h-9 px-3.5 text-xs font-bold gap-1.5 transition-all ${
                              item.takenToday
                                ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                            }`}
                          >
                            {item.takenToday ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{isBn ? '✓ সম্পন্ন' : '✓ Done'}</span>
                              </>
                            ) : (
                              <>
                                <Circle className="w-3.5 h-3.5" />
                                <span>{isBn ? 'খেয়েছি' : 'Taken'}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: My Prescriptions */}
          <TabsContent value="prescriptions" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {isBn ? 'সংরক্ষিত প্রেসক্রিপশনসমূহ' : 'Recorded Prescriptions'}
              </h2>
            </div>

            {prescriptions.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <CardContent className="p-0 text-sm text-muted-foreground">
                  {isBn ? 'এখনও কোনো প্রেসক্রিপশন তৈরি হয়নি' : 'No prescriptions recorded yet'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {prescriptions.map((rx) => (
                  <Card key={rx.id} className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              #{rx.rxNumber}
                            </span>
                            <Badge className="bg-emerald-600 text-white text-[10px]">
                              {rx.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground block mt-0.5">
                            {rx.doctorName} ({rx.doctorBmdc})
                          </span>
                        </div>
                        {rx.finalizedAt && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {new Date(rx.finalizedAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
                          </span>
                        )}
                      </div>

                      {rx.diagnosis && (
                        <div className="text-xs text-foreground">
                          <strong className="text-muted-foreground">{isBn ? 'রোগ নির্ণয়:' : 'Diagnosis:'}</strong> {rx.diagnosis}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {rx.items.map((it) => (
                          <span
                            key={it.id}
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-muted text-foreground border border-border"
                          >
                            {it.brandName} {it.strength} ({it.dosingSchedule})
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Reports & Investigations */}
          <TabsContent value="reports" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {isBn ? 'মেডিকেল রিপোর্ট ও ফাইল' : 'Medical Reports & Files'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'আপনার ল্যাব রিপোর্ট সংরক্ষণ করুন এবং ডাক্তারের সাথে শেয়ারিং নিয়ন্ত্রণ করুন'
                    : 'Manage lab reports and control whether doctors can view them'}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowUploadModal(true)}
                className="text-xs h-8 px-3 gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isBn ? 'আপলোড করুন' : 'Upload Report'}</span>
              </Button>
            </div>

            {reports.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <CardContent className="p-0 text-sm text-muted-foreground">
                  {isBn ? 'কোনো রিপোর্ট আপলোড করা হয়নি' : 'No reports uploaded yet'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <Card key={rep.id} className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="font-bold text-sm text-foreground">{rep.title}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {rep.reportType}
                          </Badge>
                        </div>
                        {rep.notes && <p className="text-xs text-muted-foreground">{rep.notes}</p>}
                        <span className="text-[11px] text-muted-foreground block font-mono">
                          {new Date(rep.uploadedAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Share Toggle Button */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleReportShare(rep.id, rep.isShared)}
                          className={`text-xs h-8 px-2.5 font-semibold gap-1.5 ${
                            rep.isShared
                              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                              : 'border-muted text-muted-foreground'
                          }`}
                        >
                          {rep.isShared ? (
                            <>
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{isBn ? 'ডাক্তার দেখতে পারেন' : 'Shared with Doctor'}</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{isBn ? 'ব্যক্তিগত (লুকানো)' : 'Private'}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: Consent & Access Grants & Access Log */}
          <TabsContent value="consent" className="space-y-6">
            {/* Active Grants */}
            <div className="space-y-3">
              <div className="space-y-0.5">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <span>{isBn ? 'ডাক্তারের অ্যাক্সেস অনুমতিসমূহ' : 'Doctor Access Grants'}</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'কোন ডাক্তারদের আপনার ক্লিনিকাল হিস্ট্রি দেখার অনুমতি দিয়েছেন। যেকোনো সময় বাতিল করতে পারেন।'
                    : 'Doctors authorized to view your clinical history. You can revoke access at any time.'}
                </p>
              </div>

              {grants.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <CardContent className="p-0 text-sm text-muted-foreground">
                    {isBn ? 'বর্তমানে কোনো সক্রিয় অনুমতি নেই' : 'No active doctor grants'}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {grants.map((g) => (
                    <Card key={g.id} className="border-border bg-card shadow-xs">
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{g.doctorName}</span>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {g.doctorBmdc}
                            </Badge>
                            {g.status === 'active' ? (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                {isBn ? `সক্রিয় (${g.daysRemaining ?? '—'} দিন বাকি)` : `Active (${g.daysRemaining ?? '—'}d left)`}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                {g.status}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isBn ? `অনুমতির ধরন: ${g.scope} (ওটিপি দ্বারা অনুমোদিত)` : `Scope: ${g.scope} via OTP`}
                          </p>
                        </div>

                        {g.status === 'active' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={revokingGrantId === g.id}
                            onClick={() => handleRevokeGrant(g.id)}
                            className="text-xs h-8 px-3 font-bold shrink-0"
                          >
                            {revokingGrantId === g.id
                              ? isBn ? 'বাতিল হচ্ছে...' : 'Revoking...'
                              : isBn ? 'অনুমতি বাতিল করুন' : 'Revoke Access'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Access Audit Log: Who Accessed My Data */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{isBn ? 'কে আমার তথ্য দেখেছেন (Access Audit Log)' : 'Who Viewed My Records (Audit Log)'}</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'আপনার স্বাস্থ্য তথ্য অ্যাক্সেসের প্রতিটি ঘটনা এখানে স্বয়ংক্রিয়ভাবে লিপিবদ্ধ থাকে'
                    : 'Tamper-evident log of clinical access to this patient profile'}
                </p>
              </div>

              {accessLogs.length === 0 ? (
                <Card className="p-6 text-center border-dashed">
                  <CardContent className="p-0 text-xs text-muted-foreground">
                    {isBn ? 'এখনও কোনো অ্যাক্সেস লগ রেকর্ড নেই' : 'No access events logged yet'}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {accessLogs.slice(0, 15).map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border border-border/70 bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground">
                          {log.accessorName} ({log.accessorRole})
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {log.reason || log.action}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(log.createdAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>



      {/* Add Dependent Family Member Modal */}
      {showAddDependent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border border-border shadow-lg">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <span>{isBn ? 'পরিবারের সদস্যের প্রোফাইল যোগ করুন' : 'Add Family Member Profile'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <form onSubmit={handleCreateDependent} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">
                    {isBn ? 'সদস্যের পূর্ণ নাম *' : 'Full Name *'}
                  </label>
                  <Input
                    placeholder={isBn ? 'যেমন: তাহমিদ আহমেদ' : 'e.g. Tahmid Ahmed'}
                    value={depName}
                    onChange={(e) => setDepName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground block">
                      {isBn ? 'সম্পর্ক *' : 'Relation *'}
                    </label>
                    <select
                      className="w-full text-xs p-2 rounded-md border border-border bg-background text-foreground"
                      value={depRelation}
                      onChange={(e) => setDepRelation(e.target.value as 'child' | 'spouse' | 'parent' | 'other')}
                    >
                      <option value="child">{isBn ? 'সন্তান (Child)' : 'Child'}</option>
                      <option value="spouse">{isBn ? 'স্ত্রী / স্বামী (Spouse)' : 'Spouse'}</option>
                      <option value="parent">{isBn ? 'পিতা / মাতা (Parent)' : 'Parent'}</option>
                      <option value="other">{isBn ? 'অন্যান্য (Other)' : 'Other'}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground block">
                      {isBn ? 'বয়স *' : 'Age *'}
                    </label>
                    <Input
                      type="number"
                      value={depAge}
                      onChange={(e) => setDepAge(e.target.value === '' ? '' : Number(e.target.value))}
                      required
                      min={0}
                      max={120}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground block">
                      {isBn ? 'লিঙ্গ *' : 'Gender *'}
                    </label>
                    <select
                      className="w-full text-xs p-2 rounded-md border border-border bg-background text-foreground"
                      value={depGender}
                      onChange={(e) => setDepGender(e.target.value as 'male' | 'female')}
                    >
                      <option value="male">{isBn ? 'পুরুষ' : 'Male'}</option>
                      <option value="female">{isBn ? 'মহিলা' : 'Female'}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground block">
                      {isBn ? 'রক্তের গ্রুপ' : 'Blood Group'}
                    </label>
                    <select
                      className="w-full text-xs p-2 rounded-md border border-border bg-background text-foreground"
                      value={depBlood}
                      onChange={(e) => setDepBlood(e.target.value)}
                    >
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAddDependent(false)}>
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </Button>
                  <Button type="submit" size="sm" disabled={addingDep}>
                    {addingDep
                      ? isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'
                      : isBn ? 'প্রোফাইল তৈরি করুন' : 'Create Profile'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Report Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border border-border shadow-lg">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-primary" />
                <span>{isBn ? 'নতুন মেডিকেল রিপোর্ট আপলোড' : 'Upload Medical Report'}</span>
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
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowUploadModal(false)}>
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </Button>
                  <Button type="submit" size="sm" disabled={uploadingReport}>
                    {uploadingReport
                      ? isBn ? 'আপলোড হচ্ছে...' : 'Uploading...'
                      : isBn ? 'আপলোড সম্পন্ন করুন' : 'Confirm Upload'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </AppShell>
  );
}

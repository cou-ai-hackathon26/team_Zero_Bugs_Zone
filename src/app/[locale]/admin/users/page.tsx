'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Search,
  CheckCircle,
  XCircle,
  Ban,
  FileText,
  KeyRound,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  phone?: string | null;
  bmdcNumber?: string | null;
  createdAt: string;
  doctorVerification?: {
    bmdcNumber: string;
    documentUrl: string;
    status: string;
    rejectionReason?: string;
  } | null;
  studentVerification?: {
    instituteName: string;
    studentIdNumber: string;
    status: string;
  } | null;
  researcherVerification?: {
    instituteName: string;
    orcid?: string;
    status: string;
  } | null;
}

export default function AdminUsersPage() {
  const locale = useLocale();
  const t = useTranslations('admin');

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Reject dialog state
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);

    fetch(`/api/admin/users?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUsers(data.users || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          toast.error('Failed to load users');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [search, roleFilter, statusFilter, refreshTrigger]);

  const handleAction = async (action: string, userId: string, extraReason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId,
          reason: extraReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      toast.success(
        action === 'approve_verification'
          ? (locale === 'bn' ? 'যাচাইকরণ অনুমোদিত হয়েছে' : 'Verification approved')
          : action === 'reject_verification'
          ? (locale === 'bn' ? 'যাচাইকরণ প্রত্যাখ্যাত হয়েছে' : 'Verification rejected')
          : action === 'suspend_user'
          ? (locale === 'bn' ? 'ব্যবহারকারী স্থগিত করা হয়েছে' : 'User suspended')
          : action === 'activate_user'
          ? (locale === 'bn' ? 'ব্যবহারকারী সক্রিয় করা হয়েছে' : 'User activated')
          : (locale === 'bn' ? 'MFA রিসেট সম্পন্ন' : 'MFA reset successful')
      );

      setRejectingUserId(null);
      setRejectionReason('');
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t('users')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'bn'
              ? 'নিবন্ধিত স্বাস্থ্যকর্মী, শিক্ষার্থী ও গবেষকদের পরিচয় যাচাই এবং অ্যাকাউন্ট নিয়ন্ত্রণ।'
              : 'Verify clinician licenses, institute affiliations, and manage user access states.'}
          </p>
        </div>

        <Button
          onClick={() => {
            setLoading(true);
            setRefreshTrigger((v) => v + 1);
          }}
          variant="outline"
          size="sm"
          disabled={loading}
          className="text-xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{locale === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border-border bg-card shadow-2xs">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === 'bn' ? 'নাম, ইমেইল, বা BMDC নম্বর দিয়ে খুঁজুন...' : 'Search by name, email, or BMDC...'}
              className="pl-9 text-xs h-10"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-xs font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="all">{locale === 'bn' ? 'সকল রোল' : 'All Roles'}</option>
              <option value="doctor">{locale === 'bn' ? 'চিকিৎসক (Doctor)' : 'Doctor'}</option>
              <option value="patient">{locale === 'bn' ? 'রোগী (Patient)' : 'Patient'}</option>
              <option value="student">{locale === 'bn' ? 'শিক্ষার্থী (Student)' : 'Student'}</option>
              <option value="researcher">{locale === 'bn' ? 'গবেষক (Researcher)' : 'Researcher'}</option>
              <option value="medicine_controller">{locale === 'bn' ? 'ওষুধ নিয়ন্ত্রক (Controller)' : 'Medicine Controller'}</option>
              <option value="super_admin">{locale === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin'}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-xs font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="all">{locale === 'bn' ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
              <option value="active">{locale === 'bn' ? 'সক্রিয় (Active)' : 'Active'}</option>
              <option value="pending_verification">{locale === 'bn' ? 'যাচাই পেন্ডিং' : 'Pending Verification'}</option>
              <option value="suspended">{locale === 'bn' ? 'স্থগিত (Suspended)' : 'Suspended'}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">{locale === 'bn' ? 'ব্যবহারকারী লোড হচ্ছে...' : 'Loading users...'}</span>
          </div>
        ) : users.length === 0 ? (
          <Card className="border-border p-12 text-center text-muted-foreground">
            <p className="text-sm font-medium">
              {locale === 'bn' ? 'কোন ব্যবহারকারী পাওয়া যায়নি' : 'No users match your filters'}
            </p>
          </Card>
        ) : (
          users.map((u) => {
            const isPending = u.status === 'pending_verification';
            const isSuspended = u.status === 'suspended';

            return (
              <Card key={u.id} className="border-border bg-card shadow-2xs hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* User info */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{u.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase bg-muted text-foreground">
                        {u.role.replace('_', ' ')}
                      </span>
                      {isPending ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {locale === 'bn' ? 'যাচাই পেন্ডিং' : 'Pending Verification'}
                        </span>
                      ) : isSuspended ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-destructive/15 text-destructive flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          {locale === 'bn' ? 'স্থগিত' : 'Suspended'}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {locale === 'bn' ? 'সক্রিয়' : 'Active'}
                        </span>
                      )}
                      {u.mfaEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono font-medium">
                          MFA
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                      <span>{u.email}</span>
                      {u.phone && <span>{u.phone}</span>}
                      {u.bmdcNumber && (
                        <span className="text-primary font-semibold">BMDC: {u.bmdcNumber}</span>
                      )}
                      {u.studentVerification && (
                        <span>ID: {u.studentVerification.studentIdNumber} ({u.studentVerification.instituteName})</span>
                      )}
                      {u.researcherVerification && (
                        <span>ORCID: {u.researcherVerification.orcid || 'N/A'}</span>
                      )}
                    </div>

                    {/* Verification documents view */}
                    {u.doctorVerification && (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 pt-0.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>
                          {locale === 'bn' ? 'সনদপত্র নথি:' : 'BMDC Document:'}
                        </span>
                        <a
                          href={u.doctorVerification.documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline font-medium hover:text-primary/80"
                        >
                          {locale === 'bn' ? 'ডকুমেন্ট দেখুন' : 'View Uploaded Document'}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
                    {isPending ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAction('approve_verification', u.id)}
                          disabled={actionLoading}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          <span>{t('approve')}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRejectingUserId(u.id)}
                          disabled={actionLoading}
                          className="text-xs h-8 px-3"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          <span>{t('reject')}</span>
                        </Button>
                      </>
                    ) : (
                      <>
                        {isSuspended ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction('activate_user', u.id)}
                            disabled={actionLoading}
                            className="text-xs h-8 text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            <span>{t('activate')}</span>
                          </Button>
                        ) : (
                          u.role !== 'super_admin' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction('suspend_user', u.id)}
                              disabled={actionLoading}
                              className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" />
                              <span>{t('suspend')}</span>
                            </Button>
                          )
                        )}

                        {u.mfaEnabled && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAction('reset_mfa', u.id)}
                            disabled={actionLoading}
                            className="text-xs h-8 text-muted-foreground hover:text-foreground"
                            title="Reset MFA"
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1" />
                            <span>{t('resetMfa')}</span>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Reject Verification Modal */}
      {rejectingUserId && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-border shadow-lg bg-card">
            <CardHeader>
              <CardTitle className="text-base font-bold text-destructive flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                <span>{locale === 'bn' ? 'যাচাইকরণ প্রত্যাখ্যান' : 'Reject Verification'}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {locale === 'bn'
                  ? 'প্রত্যাখ্যানের সুনির্দিষ্ট কারণ উল্লেখ করুন (যেমন: অস্পষ্ট BMDC সনদ, মেয়াদ উত্তীর্ণ আইডি)।'
                  : 'Specify the clinical or regulatory reason for rejecting this verification request.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">{t('rejectionReason')}</Label>
                <Input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={locale === 'bn' ? 'প্রত্যাখ্যানের কারণ লিখুন...' : 'Enter rejection reason...'}
                  className="text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRejectingUserId(null);
                    setRejectionReason('');
                  }}
                  disabled={actionLoading}
                  className="text-xs"
                >
                  {locale === 'bn' ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleAction('reject_verification', rejectingUserId, rejectionReason)}
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="text-xs"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  <span>{t('confirmReject')}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

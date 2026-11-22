'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Cpu,
  CheckCircle,
  Plus,
  RotateCcw,
  Loader2,
  RefreshCw,
  AlertOctagon,
  Sliders,
  Mic,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/routing';
import { AiCredentialsCard } from '@/components/settings/AiCredentialsCard';

interface PromptVersion {
  id: string;
  name: string;
  systemPrompt: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
}

const CRITICAL_FEATURES = [
  { key: 'ai.analyze', label: 'AI Diagnostic Reasoning', bn: 'এআই রোগ নির্ণয় ও বিশ্লেষণ' },
  { key: 'ai.treatment', label: 'Treatment & Drug Guidance', bn: 'চিকিৎসা ও ওষুধ পরামর্শ' },
  { key: 'prescription.create', label: 'Prescription Finalization', bn: 'প্রেসক্রিপশন প্রদান' },
  { key: 'library.ask', label: 'Library Q&A Querying', bn: 'লাইব্রেরিতে সরাসরি জিজ্ঞাসা' },
  { key: 'medicine.interactions', label: 'Drug Interaction Engine', bn: 'ওষুধের মিথস্ক্রিয়া ইঞ্জিন' },
];

export default function AdminAiPage() {
  const locale = useLocale();
  const t = useTranslations('admin');

  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState('v1.0.0');
  const [model, setModel] = useState('gpt-4o-mini');
  const [abstainThreshold, setAbstainThreshold] = useState(0.70);
  const [killswitches, setKillswitches] = useState<Record<string, { disabled: boolean; reason?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // New prompt version form
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newSystemPrompt, setNewSystemPrompt] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/ai', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setVersions(data.versions || []);
          setActiveVersionId(data.activeVersionId || 'v1.0.0');
          if (data.config) {
            setModel(data.config.model || 'gpt-4o-mini');
            setAbstainThreshold(data.config.abstainThreshold ?? 0.70);
          }
          setKillswitches(data.killswitches || {});
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          toast.error('Failed to load AI settings');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refreshTrigger]);

  const toggleKillswitch = async (featureKey: string, currentDisabled: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_killswitch',
          featureKey,
          disabled: !currentDisabled,
          reason: !currentDisabled ? 'Manual emergency hold via admin panel' : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle kill switch');

      toast.success(
        !currentDisabled
          ? (locale === 'bn' ? `${featureKey} কিল-সুইচ সক্রিয় করা হয়েছে (স্থগিত)` : `${featureKey} halted by kill switch`)
          : (locale === 'bn' ? `${featureKey} পুনরায় চালু করা হয়েছে` : `${featureKey} restored to active`)
      );
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Kill switch action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const saveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_ai_config',
          model,
          abstainThreshold,
        }),
      });

      if (!res.ok) throw new Error('Failed to update AI config');
      toast.success(locale === 'bn' ? 'এআই কনফিগারেশন সংরক্ষিত হয়েছে' : 'AI configuration saved');
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Config save failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim() || !newSystemPrompt.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_prompt_version',
          name: newVersionName.trim(),
          systemPrompt: newSystemPrompt.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to create prompt version');
      toast.success(locale === 'bn' ? 'নতুন প্রম্পট ভার্সন তৈরি সম্পন্ন' : 'New prompt version created');
      setShowNewVersion(false);
      setNewVersionName('');
      setNewSystemPrompt('');
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Version creation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateVersion = async (versionId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate_prompt_version',
          versionId,
        }),
      });

      if (!res.ok) throw new Error('Failed to activate version');
      toast.success(
        locale === 'bn'
          ? `প্রম্পট ভার্সন ${versionId} সক্রিয় করা হয়েছে`
          : `Activated prompt version ${versionId}`
      );
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const activeVersion = versions.find((v) => v.id === activeVersionId) || versions[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t('ai')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'bn'
              ? 'ক্লিনিকাল এআই মডেল, প্রম্পট ভার্সনিং, পর্যাপ্ত প্রমাণের সীমা এবং জরুরি কিল-সুইচ নিয়ন্ত্রণ।'
              : 'Prompt version lifecycle, confidence calibration threshold, and emergency safety kill switches.'}
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
          className="text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{locale === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Voice Assistant & Edge Neural TTS Quick Navigation Banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Mic className="w-4 h-4 text-primary" />
              <span>{locale === 'bn' ? 'ভয়েস সহকারী, স্থায়ী ফ্রি নিউরাল কণ্ঠ ও রিঅ্যাকশন সেটিংস' : 'Voice Assistant, Edge Neural TTS & Vocal Reactions'}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {locale === 'bn'
                ? 'মাইক্রোসফট এজ নিউরাল ভয়েস (বাংলা/ইংরেজি), ০-মিলি-সেকেন্ডের হিউম্যান ফিলার রিঅ্যাকশন ও ক্যারেক্টার পরিচালনা করতে ভয়েস কন্ট্রোল প্যানেল খুলুন।'
                : 'Configure permanent free Edge Neural TTS (Bangla & English), 0ms instant human vocal reactions, and avatar governance.'}
            </p>
          </div>
          <Link
            href="/admin/voice"
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold ring-offset-background transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 shrink-0 gap-1.5 shadow-xs"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{locale === 'bn' ? 'ভয়েস সেটিংস খুলুন' : 'Open Voice Settings'}</span>
          </Link>
        </CardContent>
      </Card>

      {/* Emergency Feature Kill Switches Section */}
      <Card className="border-destructive/30 bg-card shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="w-5 h-5 shrink-0" />
            <CardTitle className="text-base font-bold">
              {locale === 'bn' ? 'জরুরি ক্লিনিকাল সেফটি কিল-সুইচ (Emergency Kill Switches)' : 'Emergency Clinical Safety Kill Switches'}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            {locale === 'bn'
              ? 'যেকোনো ফিচার বন্ধ করতে টগল করুন। কিল-সুইচ সক্রিয় থাকলে সংশ্লিষ্ট এআই ফাংশন অবিলম্বে বন্ধ হয়ে যাবে।'
              : 'Immediately halt specific automated capabilities across all users in case of safety anomalies.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CRITICAL_FEATURES.map((item) => {
              const isHalted = killswitches[item.key]?.disabled === true;
              return (
                <div
                  key={item.key}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isHalted
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : 'border-border bg-muted/20 text-foreground'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs">{locale === 'bn' ? item.bn : item.label}</div>
                    <div className="text-[10px] font-mono opacity-70">{item.key}</div>
                  </div>

                  <Button
                    size="sm"
                    variant={isHalted ? 'destructive' : 'outline'}
                    onClick={() => toggleKillswitch(item.key, isHalted)}
                    disabled={actionLoading}
                    className={`text-xs h-8 px-3 font-semibold ${
                      !isHalted ? 'text-muted-foreground hover:text-destructive hover:border-destructive/40' : ''
                    }`}
                  >
                    {isHalted
                      ? (locale === 'bn' ? 'স্থগিত (HALTED)' : 'HALTED')
                      : (locale === 'bn' ? 'চালু (Active)' : 'Active')}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Global AI Model Credentials & API Keys */}
      <AiCredentialsCard />

      {/* Model & Safety Calibration */}
      <Card className="border-border bg-card shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-bold">
              {locale === 'bn' ? 'মডেল ও প্রমাণের আত্মবিশ্বাস কনফিগারেশন' : 'Model Selection & Evidence Threshold'}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            {locale === 'bn'
              ? 'অভ্যন্তরীণ মেডিকেল লাইব্রেরি থেকে পর্যাপ্ত প্রমাণ না থাকলে সিস্টেম নিজে থেকে দাবি করা থেকে বিরত থাকে।'
              : 'When evidence relevance falls below this threshold, DocMate AI declares insufficient_evidence.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveAiConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{locale === 'bn' ? 'এআই ব্যাকএন্ড মডেল' : 'Active LLM Model'}</Label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="h-10 w-full px-3 rounded-md border border-input bg-background text-xs font-medium focus:ring-1 focus:ring-primary"
              >
                <option value="gpt-4o-mini">gpt-4o-mini (Fast, Clinical Decision Baseline)</option>
                <option value="gpt-4o">gpt-4o (Deep Complex Multi-morbidity Analysis)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Extended Context Retrieval)</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  {locale === 'bn' ? 'বিরত থাকার থ্রেশহোল্ড (Abstain Threshold)' : 'Abstain Confidence Threshold'}
                </Label>
                <span className="text-xs font-mono font-bold text-primary">
                  {(abstainThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.05"
                value={abstainThreshold}
                onChange={(e) => setAbstainThreshold(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <p className="text-[11px] text-muted-foreground">
                {locale === 'bn'
                  ? 'থ্রেশহোল্ডের নিচে স্কোর পেলে এআই কোনো অনুমান করবে না এবং ফলো-আপ প্রশ্ন করবে।'
                  : 'Scores below this confidence return status: "insufficient_evidence" with targeted questions.'}
              </p>
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" size="sm" disabled={actionLoading} className="text-xs font-medium">
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                <span>{t('saveChanges')}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Prompt Version Manager */}
      <Card className="border-border bg-card shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-bold">
                {locale === 'bn' ? 'সিস্টেম প্রম্পট ভার্সন ম্যানেজার' : 'Prompt Version Lifecycle Manager'}
              </CardTitle>
            </div>

            <Button
              size="sm"
              onClick={() => setShowNewVersion(!showNewVersion)}
              className="text-xs self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>{locale === 'bn' ? 'নতুন ভার্সন তৈরি করুন' : 'Create New Version'}</span>
            </Button>
          </div>
          <CardDescription className="text-xs">
            {locale === 'bn'
              ? 'বন্ধ লাইব্রেরির নির্দেশনা, উদ্ধৃতি নীতি এবং চিকিৎসকের চূড়ান্ত সিদ্ধান্তের সুরক্ষা প্রম্পট ট্র্যাক ও রোলব্যাক করুন।'
              : 'Maintain immutable prompt versions. Roll back instantly to any previous golden baseline.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* New version form */}
          {showNewVersion && (
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold">{locale === 'bn' ? 'নতুন প্রম্পট ভার্সন যুক্ত করুন' : 'Draft New Prompt Version'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateVersion} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">{locale === 'bn' ? 'ভার্সনের নাম/উদ্দেশ্য' : 'Version Label'}</Label>
                    <Input
                      value={newVersionName}
                      onChange={(e) => setNewVersionName(e.target.value)}
                      placeholder="e.g. Bangladesh DGDA Formulary Strictness v2"
                      className="text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">{locale === 'bn' ? 'সিস্টেম প্রম্পট টেক্সট' : 'System Prompt Text'}</Label>
                    <textarea
                      value={newSystemPrompt}
                      onChange={(e) => setNewSystemPrompt(e.target.value)}
                      placeholder="Enter complete closed-library clinical system prompt..."
                      rows={6}
                      className="w-full p-2.5 rounded-md border border-input bg-background text-xs font-mono leading-relaxed"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewVersion(false)}
                      className="text-xs"
                    >
                      {locale === 'bn' ? 'বাতিল' : 'Cancel'}
                    </Button>
                    <Button type="submit" size="sm" disabled={actionLoading} className="text-xs">
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      <span>{locale === 'bn' ? 'সংরক্ষণ করুন' : 'Save Version'}</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Active Version Display */}
          {activeVersion && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground">
                    {activeVersion.id}
                  </span>
                  <span className="text-xs font-bold text-foreground">{activeVersion.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>ACTIVE</span>
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {new Date(activeVersion.createdAt).toLocaleDateString()}
                </span>
              </div>
              <pre className="p-3 rounded-lg bg-card border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
                {activeVersion.systemPrompt}
              </pre>
            </div>
          )}

          {/* Historical Versions List */}
          <div className="space-y-2 pt-2">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {locale === 'bn' ? 'পূর্বে ব্যবহৃত ভার্সন সমূহ' : 'Version History & Rollbacks'}
            </h2>
            {versions.map((ver) => {
              const isCurrent = ver.id === activeVersionId;
              return (
                <div
                  key={ver.id}
                  className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{ver.id}</span>
                      <span className="font-semibold text-foreground">{ver.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Created by {ver.createdBy} on {new Date(ver.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleActivateVersion(ver.id)}
                      disabled={actionLoading}
                      className="text-xs h-8 px-2.5 self-start sm:self-auto shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      <span>{locale === 'bn' ? 'রোলব্যাক / সক্রিয় করুন' : 'Rollback / Activate'}</span>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

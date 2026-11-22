'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Mic,
  ShieldAlert,
  Save,
  Loader2,
  Sparkles,
  Bot,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { VoiceConfig } from '@/lib/voice/types';
import { DocMateAvatar } from '@/components/voice/DocMateAvatar';

interface VoiceMetrics {
  totalSessions: number;
  totalMinutes: number;
  totalTtsChars: number;
  avgLatencyMs: number;
  errorRatePct: number;
  estimatedCostBdt: number;
}

export default function AdminVoiceSettingsPage() {
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTts, setTestingTts] = useState(false);
  const [metrics, setMetrics] = useState<VoiceMetrics>({
    totalSessions: 0,
    totalMinutes: 0,
    totalTtsChars: 0,
    avgLatencyMs: 0,
    errorRatePct: 0,
    estimatedCostBdt: 0,
  });

  const [config, setConfig] = useState<VoiceConfig>({
    enabled: true,
    kill_switch: false,
    stt_provider: 'browser',
    tts_provider: 'browser',
    persona_name: 'ডকমেট (DocMate)',
    persona_greeting_bn: 'স্বাগতম, ডাক্তার। বলুন, কীভাবে সাহায্য করতে পারি?',
    persona_greeting_en: 'Welcome, Doctor. How can I assist you today?',
    intro_disclaimer_bn: 'আমি একটি এআই সহকারী। চূড়ান্ত সিদ্ধান্ত আপনার।',
    intro_disclaimer_en: 'I am an AI assistant. The final decision is yours.',
    default_voice_gender: 'female',
    default_speed: 1.0,
    private_mode_default: true,
    avatar_enabled_default: true,
  });

  useEffect(() => {
    fetch('/api/settings/voice')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.config) {
          setConfig((prev) => ({ ...prev, ...data.config }));
        }
        if (data?.metrics) {
          setMetrics(data.metrics);
        }
      })
      .catch(() => toast.error(isBn ? 'সেটিংস লোড ব্যর্থ' : 'Failed to load voice settings'))
      .finally(() => setLoading(false));
  }, [isBn]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        toast.success(isBn ? 'ভয়েস সেটিংস সফলভাবে সংরক্ষিত হয়েছে' : 'Voice configuration saved successfully');
      } else {
        toast.error(isBn ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save settings');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTts = () => {
    setTestingTts(true);
    const testPhrase = isBn ? config.persona_greeting_bn : config.persona_greeting_en;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(testPhrase);
      u.lang = isBn ? 'bn-BD' : 'en-US';
      u.rate = config.default_speed;
      u.onend = () => setTestingTts(false);
      u.onerror = () => setTestingTts(false);
      window.speechSynthesis.speak(u);
    } else {
      setTestingTts(false);
      toast.info(isBn ? 'ব্রাউজার স্পিচ সিন্থেসিস উপলব্ধ নয়' : 'Speech synthesis not available in browser');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            <span>{isBn ? 'ভয়েস সহকারী ও ক্যারেক্টার কন্ট্রোল' : 'Voice Assistant & Avatar Governance'}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isBn
              ? 'ডকমেট এআই ভয়েস সহকারী, কার্টুন ডক্টর ক্যারেক্টার, প্রদানকারী ও ব্যবহার মেট্রিক্স পরিচালনা করুন।'
              : 'Configure DocMate AI voice engine, cartoon doctor avatar, provider routing, and cost metrics.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isBn ? 'সেটিংস সংরক্ষণ করুন' : 'Save Voice Settings'}</span>
          </Button>
        </div>
      </div>

      {/* Metrics Ledger Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 space-y-1 bg-card border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {isBn ? 'মোট সেশন' : 'Total Sessions'}
          </span>
          <span className="text-xl font-bold text-foreground font-mono">{metrics.totalSessions}</span>
        </Card>
        <Card className="p-3.5 space-y-1 bg-card border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {isBn ? 'কথা বলার সময়' : 'Spoken Minutes'}
          </span>
          <span className="text-xl font-bold text-foreground font-mono">{metrics.totalMinutes} m</span>
        </Card>
        <Card className="p-3.5 space-y-1 bg-card border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {isBn ? 'উচ্চারিত অক্ষর' : 'TTS Characters'}
          </span>
          <span className="text-xl font-bold text-foreground font-mono">{metrics.totalTtsChars.toLocaleString()}</span>
        </Card>
        <Card className="p-3.5 space-y-1 bg-card border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {isBn ? 'গড় প্রতিক্রিয়া' : 'Avg Latency'}
          </span>
          <span className="text-xl font-bold text-foreground font-mono">{metrics.avgLatencyMs} ms</span>
        </Card>
        <Card className="p-3.5 space-y-1 bg-card border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {isBn ? 'ত্রুটির হার' : 'Error Rate'}
          </span>
          <span className="text-xl font-bold text-foreground font-mono">{metrics.errorRatePct}%</span>
        </Card>
        <Card className="p-3.5 space-y-1 bg-card border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {isBn ? 'আনুমানিক খরচ' : 'Est. Cost'}
          </span>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            ৳ {metrics.estimatedCostBdt}
          </span>
        </Card>
      </div>

      {/* Global Master Toggles & Kill Switch */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span>{isBn ? 'সার্বিক ভয়েস নিয়ন্ত্রণ ও কিল-সুইচ' : 'Global Voice Status & Master Kill Switch'}</span>
            </span>
            {config.kill_switch ? (
              <Badge variant="destructive">{isBn ? 'কিল-সুইচ সক্রিয় (ভয়েস বন্ধ)' : 'Kill Switch Active'}</Badge>
            ) : config.enabled ? (
              <Badge className="bg-emerald-600 text-white">{isBn ? 'সক্রিয়' : 'Enabled'}</Badge>
            ) : (
              <Badge variant="secondary">{isBn ? 'নিষ্ক্রিয়' : 'Disabled'}</Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            {isBn
              ? 'জরুরি পরিস্থিতিতে পুরো সিস্টেমে ভয়েস তাৎক্ষণিক বন্ধ করতে কিল-সুইচ ব্যবহার করুন।'
              : 'Instantly disable voice capabilities across the entire platform in clinical emergency.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border border-border bg-muted/20 gap-3">
            <div>
              <Label className="font-semibold text-sm">{isBn ? 'ভয়েস সহকারী সক্রিয় রাখুন' : 'Enable Voice Assistant'}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isBn ? 'ডাক্তার ও ব্যবহারকারীদের জন্য ভয়েস ফিচার দৃশ্যমান থাকবে।' : 'Toggles visibility and availability of voice assistant globally.'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
              className="accent-primary w-5 h-5 rounded cursor-pointer shrink-0"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5 gap-3">
            <div>
              <Label className="font-semibold text-sm text-destructive">{isBn ? 'ইমার্জেন্সি ভয়েস কিল-সুইচ' : 'Emergency Voice Kill-Switch'}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isBn ? 'চালু থাকলে সমস্ত ভয়েস এপিআই কল এবং অডিও প্লেব্যাক তাৎক্ষণিক ব্লক হবে।' : 'Immediately blocks all STT and TTS API execution system-wide.'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.kill_switch}
              onChange={(e) => setConfig((p) => ({ ...p, kill_switch: e.target.checked }))}
              className="accent-destructive w-5 h-5 rounded cursor-pointer shrink-0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Provider Routing & Live Test */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            <span>{isBn ? 'প্রদানকারী (Provider) কনফিগারেশন' : 'STT & TTS Provider Routing'}</span>
          </CardTitle>
          <CardDescription className="text-xs">
            {isBn
              ? 'স্পিচ-টু-টেক্সট এবং টেক্সট-টু-স্পিচ ইঞ্জিন নির্বাচন করুন। ব্রাউজার ইঞ্জিন সম্পূর্ণ ফ্রি।'
              : 'Choose transcription and synthesis providers. Browser Web Speech is 100% free with zero cloud latency.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 p-3.5 rounded-lg border border-border bg-card">
            <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              {isBn ? 'স্পিচ-টু-টেক্সট (STT Engine)' : 'STT Provider'}
            </Label>
            <select
              value={config.stt_provider}
              onChange={(e) => setConfig((p) => ({ ...p, stt_provider: e.target.value as 'browser' | 'openai' | 'custom_stub' }))}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
            >
              <option value="browser">Browser Web Speech API (Free & Local)</option>
              <option value="openai">OpenAI Whisper (Cloud Paid)</option>
              <option value="custom_stub">Offline Diagnostic Stub</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              {config.stt_provider === 'browser'
                ? isBn
                  ? '✓ ক্লায়েন্টের ডিভাইসেই প্রসেস হয়। অডিও কখনো সার্ভারে যায় না।'
                  : '✓ Processed on client device. Zero audio uploaded.'
                : isBn
                  ? 'উচ্চ নির্ভুলতা প্রদান করে, প্রতি মিনিটে ওপেনএআই কোটা খরচ হয়।'
                  : 'Higher vocabulary accuracy, charges OpenAI API balance.'}
            </p>
          </div>

          <div className="space-y-2 p-3.5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                {isBn ? 'টেক্সট-টু-স্পিচ (TTS Engine)' : 'TTS Provider'}
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestTts}
                disabled={testingTts}
                className="h-7 px-2.5 text-xs font-semibold gap-1 text-primary border-primary/30"
              >
                {testingTts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isBn ? 'শব্দ পরীক্ষা' : 'Test Audio'}</span>
              </Button>
            </div>
            <select
              value={config.tts_provider}
              onChange={(e) => setConfig((p) => ({ ...p, tts_provider: e.target.value as 'browser' | 'openai' | 'custom_stub' }))}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
            >
              <option value="browser">Browser SpeechSynthesis (Free Bengali/English)</option>
              <option value="openai">OpenAI TTS (tts-1)</option>
              <option value="custom_stub">Offline Diagnostic Stub</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              {config.tts_provider === 'browser'
                ? isBn
                  ? 'ডিভাইসের বিল্ট-ইন বাংলা কণ্ঠস্বর ব্যবহার করে।'
                  : 'Uses device natural voices with zero network overhead.'
                : isBn
                  ? 'ওপেনএআই প্রাকৃতিক সিন্থেসিস অডিও স্ট্রিম।'
                  : 'OpenAI cloud synthesized MP3 audio.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Persona & Animated Cartoon Doctor Preview */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span>{isBn ? 'পারসোনা ও অ্যানিমেটেড ক্যারেক্টার' : 'Persona & Animated Doctor Avatar'}</span>
          </CardTitle>
          <CardDescription className="text-xs">
            {isBn
              ? 'ডকমেট এআই-এর অভিবাদন, পরিচয় ও বাচনভঙ্গি কাস্টমাইজ করুন।'
              : 'Customize name, greetings, speed, and avatar appearance.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="space-y-4 md:col-span-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{isBn ? 'সহকারীর নাম' : 'Assistant Persona Name'}</Label>
              <Input
                value={config.persona_name}
                onChange={(e) => setConfig((p) => ({ ...p, persona_name: e.target.value }))}
                className="text-sm h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{isBn ? 'বাংলা স্বাগতম অভিবাদন' : 'Bangla Greeting'}</Label>
              <Input
                value={config.persona_greeting_bn}
                onChange={(e) => setConfig((p) => ({ ...p, persona_greeting_bn: e.target.value }))}
                className="text-sm h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{isBn ? 'ইংরেজি স্বাগতম অভিবাদন' : 'English Greeting'}</Label>
              <Input
                value={config.persona_greeting_en}
                onChange={(e) => setConfig((p) => ({ ...p, persona_greeting_en: e.target.value }))}
                className="text-sm h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{isBn ? 'ডিফল্ট কণ্ঠ' : 'Default Voice Gender'}</Label>
                <select
                  value={config.default_voice_gender}
                  onChange={(e) => setConfig((p) => ({ ...p, default_voice_gender: e.target.value as 'female' | 'male' }))}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="female">নারী কণ্ঠ (Female)</option>
                  <option value="male">পুরুষ কণ্ঠ (Male)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{isBn ? 'কথার গতি' : 'Default Speed'}</Label>
                <select
                  value={config.default_speed}
                  onChange={(e) => setConfig((p) => ({ ...p, default_speed: parseFloat(e.target.value) }))}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-mono"
                >
                  <option value="0.8">0.8x (ধীর / Slow)</option>
                  <option value="0.9">0.9x</option>
                  <option value="1.0">1.0x (স্বাভাবিক / Normal)</option>
                  <option value="1.1">1.1x</option>
                  <option value="1.2">1.2x (দ্রুত / Fast)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Avatar Preview Box */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-center text-center space-y-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isBn ? 'লাইভ ক্যারেক্টার প্রিভিউ' : 'Live Character Preview'}
            </span>
            <DocMateAvatar state="idle" size="lg" />
            <div className="space-y-1">
              <span className="font-bold text-sm text-foreground block">{config.persona_name}</span>
              <p className="text-[11px] text-muted-foreground italic max-w-xs">
                &ldquo;{isBn ? config.intro_disclaimer_bn : config.intro_disclaimer_en}&rdquo;
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

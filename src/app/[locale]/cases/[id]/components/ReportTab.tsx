'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  PatientCase,
  TreatmentPlan,
  StructuredPatientInput,
  TreatmentSuggestion,
} from '@/types';
import {
  Printer,
  FileText,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Globe,
  Stethoscope,
  Activity,
  Layers,
} from 'lucide-react';
import { useFormatter, useTranslations, useLocale } from 'next-intl';
import { generate21SectionClinicalReport, type ReportSection } from '@/lib/clinical/report-generator';

interface ReportTabProps {
  caseData: PatientCase;
  treatmentPlan: TreatmentPlan | null;
  approvedDrugIds: Set<string>;
  acknowledgedAlerts: Set<string>;
  doctorNotes: string;
}

/** Helper component to render formatted clinical markdown & tables without external dependencies */
function FormattedSectionContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = (key: number) => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(1).filter((r) => !r.every((c) => /^[:-]+$/.test(c.trim())));
      elements.push(
        <div key={`table-${key}`} className="my-2.5 overflow-x-auto rounded border border-border/80">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-muted/70 text-foreground font-semibold border-b border-border">
                {headerRow.map((col, cIdx) => (
                  <th key={cIdx} className="p-2 border-r last:border-r-0 border-border/60">
                    {col.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={`border-b last:border-b-0 border-border/40 hover:bg-muted/30 ${
                    rIdx % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                  }`}
                >
                  {row.map((col, cIdx) => (
                    <td key={cIdx} className="p-2 border-r last:border-r-0 border-border/40 text-foreground/90">
                      {formatInlineMarkdown(col.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      const cols = trimmed.split('|').slice(1, -1);
      tableRows.push(cols);
      return;
    }

    if (inTable) {
      flushTable(idx);
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={idx} className="font-bold text-sm text-foreground pt-2 pb-1 flex items-center gap-1.5">
          {formatInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
    } else if (trimmed.startsWith('#### ')) {
      elements.push(
        <h5 key={idx} className="font-semibold text-xs text-foreground/90 pt-1.5 pb-0.5">
          {formatInlineMarkdown(trimmed.replace(/^####\s+/, ''))}
        </h5>
      );
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <div
          key={idx}
          className="my-1.5 p-2.5 rounded bg-muted/40 border-l-4 border-primary/70 text-xs italic text-foreground/90"
        >
          {formatInlineMarkdown(trimmed.replace(/^>\s+/, ''))}
        </div>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={idx} className="text-xs text-foreground/90 pl-3 my-0.5 flex items-start gap-1.5">
          <span className="text-primary mt-1 text-[8px]">&bull;</span>
          <span className="flex-1">{formatInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</span>
        </div>
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      elements.push(
        <div key={idx} className="text-xs text-foreground/90 pl-3 my-0.5 flex items-start gap-1.5">
          <span className="font-semibold text-primary">{trimmed.match(/^\d+\./)?.[0]}</span>
          <span className="flex-1">{formatInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''))}</span>
        </div>
      );
    } else if (trimmed.length > 0) {
      elements.push(
        <p key={idx} className="text-xs text-foreground/80 leading-relaxed my-1">
          {formatInlineMarkdown(trimmed)}
        </p>
      );
    }
  });

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{elements}</div>;
}

/** Basic inline markdown formatter: bold, code, highlights */
function formatInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      return <strong key={i} className="font-bold text-foreground">{inner}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const inner = part.slice(1, -1);
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] text-primary">
          {inner}
        </code>
      );
    }
    return part;
  });
}

export function ReportTab({
  caseData,
  treatmentPlan,
  approvedDrugIds,
  acknowledgedAlerts,
  doctorNotes,
}: ReportTabProps) {
  const currentLocale = useLocale() as 'bn' | 'en';
  const [reportLocale, setReportLocale] = useState<'bn' | 'en'>(currentLocale || 'bn');
  const format = useFormatter();
  const t = useTranslations('report');
  const tTreatment = useTranslations('treatment');

  const isBn = reportLocale === 'bn';

  // Deterministically generate the 21-section report
  const clinicalReport = useMemo(() => {
    return generate21SectionClinicalReport({
      caseData,
      treatmentPlan,
      locale: reportLocale,
    });
  }, [caseData, treatmentPlan, reportLocale]);

  // Approved drugs from doctor workflow
  const approvedDrugs: TreatmentSuggestion[] = [];
  if (treatmentPlan) {
    treatmentPlan.first_line?.forEach((d) => {
      if (approvedDrugIds.has(d.drug_id)) approvedDrugs.push(d);
    });
    treatmentPlan.alternatives?.forEach((d) => {
      if (approvedDrugIds.has(d.drug_id)) approvedDrugs.push(d);
    });
  }

  const acknowledgedAlertItems =
    treatmentPlan?.safety_alerts.filter((a) => acknowledgedAlerts.has(a.id)) || [];

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden space-y-2">
      {/* Top action bar (hidden on print) */}
      <div className="flex flex-wrap items-center justify-between no-print bg-card p-2 sm:p-2.5 rounded-lg border border-border/80 shadow-2xs shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {isBn ? 'পূর্ণাঙ্গ ২১-সেকশন ক্লিনিক্যাল AI রিপোর্ট' : 'Comprehensive 21-Section Clinical AI Report'}
          </span>
          <Badge
            variant={clinicalReport.overallAcuity === 'emergency' ? 'destructive' : 'outline'}
            className="text-[10px] uppercase font-bold tracking-wider"
          >
            {clinicalReport.overallAcuity}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setReportLocale('bn')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                reportLocale === 'bn'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              বাংলা (BN)
            </button>
            <button
              type="button"
              onClick={() => setReportLocale('en')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                reportLocale === 'en'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              English (EN)
            </button>
          </div>

          <Button onClick={handlePrint} size="sm" className="gap-1.5 text-xs font-semibold h-7">
            <Printer className="w-3.5 h-3.5" />
            {tTreatment('printReport')}
          </Button>
        </div>
      </div>

      {/* Printable Report Document (Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
        <Card className="border border-border shadow-xs bg-white text-black p-5 sm:p-7 space-y-5 print:shadow-none print:border-none print:p-0 print:m-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl text-primary tracking-tight">DocMate AI</span>
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-widest font-semibold">
                  Clinical Decision Support System
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {isBn
                  ? 'অভ্যন্তরীণ মেডিকেল লাইব্রেরি থেকে যাচাইকৃত সিদ্ধান্ত সহায়তা • নিরীক্ষা ট্রেইল আইডি:'
                  : 'Internal Closed-Library Clinical Intelligence System • Audit Trail ID:'}{' '}
                <span className="font-mono text-foreground font-semibold">{clinicalReport.caseId.slice(0, 8)}</span>
              </p>
            </div>

            <div className="text-right text-xs space-y-0.5">
              <p className="font-semibold text-foreground">
                {isBn ? 'কেস তারিখ:' : 'Case Date:'}{' '}
                {caseData.created_at
                  ? format.dateTime(new Date(caseData.created_at), { dateStyle: 'medium', timeZone: 'UTC' })
                  : '—'}
              </p>
              <p className="text-muted-foreground">
                {isBn ? 'রোগীর কোড:' : 'Patient Code:'}{' '}
                <strong className="text-foreground">{clinicalReport.patientCode}</strong>
              </p>
              <Badge
                variant={clinicalReport.overallStatus === 'critical' ? 'destructive' : 'outline'}
                className="text-[10px] uppercase font-bold mt-1"
              >
                {clinicalReport.overallAcuity}
              </Badge>
            </div>
          </div>

          {/* Persistent Legal Medical Disclaimer (AGENTS.md Hard Rule 5) */}
          <div className="p-3 bg-muted/30 border border-border/70 rounded-md text-center space-y-0.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground/80">
              Clinical decision support only. Not a substitute for professional judgement.
            </p>
            <p className="font-medium text-muted-foreground">
              শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।
            </p>
          </div>

          {/* Emergency Alert Banner if Active Red Flags */}
          {clinicalReport.hasEmergencyRedFlags && (
            <div className="p-3 rounded-lg border-2 border-red-500 bg-red-50 text-red-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-red-700">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse shrink-0" />
                <span>
                  {isBn
                    ? '🚨 জরুরি ক্লিনিক্যাল সতর্কতা: তাৎক্ষণিক মনোযোগ ও পরীক্ষা আবশ্যক'
                    : '🚨 CRITICAL SAFETY ALERT: Immediate Clinical Action Required'}
                </span>
              </div>
              <p className="text-xs text-red-900 pl-7 leading-relaxed">
                {isBn
                  ? 'রোগীর ভাইটাল সাইন, ল্যাব পরীক্ষা বা শারীরিক লক্ষণে উচ্চ ঝুঁকির সংকেত পাওয়া গেছে। রোগীকে জরুরি নিবিড় পর্যবেক্ষণে রাখুন।'
                  : 'High-risk hemodynamic, laboratory, or red flag findings detected. Initiate rapid clinical triage and specialist review.'}
              </p>
            </div>
          )}

          {/* 21 Clinical Report Sections */}
          <div className="space-y-4 pt-1">
            {clinicalReport.sections.map((section: ReportSection) => {
              const isAlert = section.status === 'critical' || section.status === 'alert';
              const content = isBn ? section.contentMarkdownBn : section.contentMarkdownEn;
              const title = isBn ? section.titleBn : section.titleEn;

              return (
                <div
                  key={section.id}
                  className={`rounded-lg border p-3.5 transition-all ${
                    section.status === 'critical'
                      ? 'border-red-300 bg-red-50/40 text-red-950'
                      : section.status === 'alert'
                      ? 'border-amber-300 bg-amber-50/30 text-amber-950'
                      : section.status === 'abnormal'
                      ? 'border-orange-200 bg-orange-50/20'
                      : 'border-border/70 bg-card/60'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/50 mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary/80" />
                      {title}
                    </h3>
                    <Badge
                      variant={
                        section.status === 'critical'
                          ? 'destructive'
                          : section.status === 'alert'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-[10px] font-mono uppercase"
                    >
                      {section.status}
                    </Badge>
                  </div>

                  <FormattedSectionContent content={content} />
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Prescribed Medications Section (from Physician Approval) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
              {isBn ? 'চিকিৎসকের অনুমোদিত প্রেসক্রিপশন ও ওষুধসমূহ' : 'Physician Approved Prescriptions'} ({approvedDrugs.length})
            </h4>

            {approvedDrugs.length > 0 ? (
              <div className="space-y-2.5">
                {approvedDrugs.map((drug, idx) => (
                  <div
                    key={drug.drug_id}
                    className="p-3 rounded border border-border/80 bg-muted/10 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">
                        {idx + 1}. {drug.generic_name} ({drug.drug_class})
                      </span>
                      <span className="text-[11px] font-semibold text-primary uppercase">
                        {drug.route} &bull; {drug.frequency}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground">
                      {isBn ? 'মাত্রা:' : 'Dose:'} {drug.dose_text}
                    </p>
                    {drug.duration_days > 0 && (
                      <p className="text-muted-foreground text-[11px]">
                        {isBn ? 'মেয়াদ:' : 'Duration:'} {drug.duration_days} {isBn ? 'দিন' : 'days'}
                      </p>
                    )}
                    {drug.rationale && (
                      <p className="text-muted-foreground italic text-[11px]">
                        {isBn ? 'যৌক্তিক ভিত্তি:' : 'Rationale:'} {drug.rationale}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {isBn
                  ? 'কোনো ওষুধ এখনও চূড়ান্ত বা অনুমোদিত হয়নি।'
                  : 'No medications selected or finalized in prescription tab yet.'}
              </p>
            )}
          </div>

          {/* Physician Acknowledged Safety Overrides */}
          {acknowledgedAlertItems.length > 0 && (
            <div className="p-3 rounded border border-amber-500/30 bg-amber-500/5 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>
                  {isBn
                    ? `চিকিৎসক কর্তৃক স্বীকৃত সেফটি ওভাররাইড (${acknowledgedAlertItems.length}):`
                    : `Physician Acknowledged Safety Overrides (${acknowledgedAlertItems.length}):`}
                </span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground pl-1">
                {acknowledgedAlertItems.map((a) => (
                  <li key={a.id}>
                    <strong>{a.title}</strong>: {a.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Doctor Notes */}
          {doctorNotes && (
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                {isBn ? 'চিকিৎসকের ব্যক্তিগত মন্তব্য ও নির্দেশনা' : 'Physician Instructions & Follow-Up Notes'}
              </h4>
              <p className="text-xs text-foreground bg-muted/20 p-2.5 rounded border border-border/60 whitespace-pre-wrap">
                {doctorNotes}
              </p>
            </div>
          )}

          <Separator />

          {/* Footer & Signature Block */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-muted-foreground gap-2 pt-2">
            <div>
              <p className="font-semibold text-foreground">
                {isBn ? 'DocMate AI ক্লিনিক্যাল ইন্টেলিজেন্স সিস্টেম' : 'DocMate AI Clinical Intelligence System'}
              </p>
              <p className="text-[11px]">
                {isBn
                  ? 'সব তথ্য অভ্যন্তরীণ মেডিকেল গাইডলাইন থেকে সংকলিত। কোনো বাহ্যিক ওয়েব সংযোগ ব্যবহৃত হয়নি।'
                  : 'Closed-library evidence synthesis. Zero external web access. Verbatim cited guidelines.'}
              </p>
            </div>
            <div className="border-t border-foreground/40 pt-1 text-right min-w-[160px]">
              <p className="font-semibold text-foreground">
                {isBn ? 'অনুমোদিত চিকিৎসকের স্বাক্ষর' : 'Attending Physician Signature'}
              </p>
              <p className="text-[10px] text-muted-foreground">BMDC Reg. No: _________________</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

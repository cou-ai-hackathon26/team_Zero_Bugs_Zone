'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import {
  FileText,
  PlusCircle,
  Calendar,
  Phone,
  AlertTriangle,
  Stethoscope,
  Printer,
  ChevronRight,
} from 'lucide-react';

interface PatientProfile {
  id: string;
  patient_code: string;
  name: string;
  phone: string;
  age: number;
  gender: string;
  blood_group?: string;
  emergency_contact?: string;
  created_at: string;
}

interface Encounter {
  id: string;
  visit_date: string;
  chief_complaint: string;
  symptoms: string[];
  vitals: {
    bpSystolic?: number;
    bpDiastolic?: number;
    pulse?: number;
    tempF?: number;
    weightKg?: number;
    spo2?: number;
  };
  allergies: string[];
  past_history?: string;
  status: string;
}

interface Prescription {
  id: string;
  rx_number: string;
  diagnosis: string;
  status: string;
  created_at: string;
  finalized_at?: string;
  items: Array<{
    id: string;
    brand_name: string;
    generic_name: string;
    strength: string;
    form: string;
    dosing_schedule: string;
    meal_timing: string;
    duration_text: string;
  }>;
}

export default function PatientProfilePage() {
  const { id } = useParams() as { id: string };
  const locale = useLocale();

  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/patients/${id}`, { credentials: 'same-origin', signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load patient profile');
        return res.json();
      })
      .then((data) => {
        setPatient(data.patient);
        setEncounters(data.encounters || []);
        setPrescriptions(data.prescriptions || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="p-12 text-center text-muted-foreground animate-pulse text-base">
          {locale === 'bn' ? 'রোগীর প্রোফাইল লোড হচ্ছে...' : 'Loading patient profile...'}
        </div>
      </AppShell>
    );
  }

  if (error || !patient) {
    return (
      <AppShell>
        <div className="p-8 text-center max-w-md mx-auto space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">{locale === 'bn' ? 'প্রোফাইল লোড করা যায়নি' : 'Profile Not Found'}</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link href="/patients" className={buttonVariants({ className: 'min-h-11' })}>
            {locale === 'bn' ? 'রোগীর তালিকায় ফিরুন' : 'Back to Patient List'}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Top Header Card */}
        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-md">
                    {patient.patient_code}
                  </span>
                  <Badge variant="outline" className="text-xs font-semibold">
                    {patient.gender === 'female'
                      ? locale === 'bn'
                        ? 'মহিলা'
                        : 'Female'
                      : locale === 'bn'
                        ? 'পুরুষ'
                        : 'Male'}
                    , {patient.age} {locale === 'bn' ? 'বছর' : 'yrs'}
                  </Badge>
                  {patient.blood_group && (
                    <Badge variant="secondary" className="text-xs font-bold text-destructive">
                      {locale === 'bn' ? 'রক্ত:' : 'Blood:'} {patient.blood_group}
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{patient.name}</h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                  {patient.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{patient.phone}</span>
                    </div>
                  )}
                  {patient.emergency_contact && (
                    <div>
                      <span className="font-semibold text-foreground">
                        {locale === 'bn' ? 'জরুরি যোগাযোগ:' : 'Emergency:'}
                      </span>{' '}
                      {patient.emergency_contact}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {locale === 'bn' ? 'নিবন্ধন:' : 'Registered:'}{' '}
                      {new Date(patient.created_at).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href={`/prescriptions/new?patientId=${patient.id}`}
                  className={buttonVariants({ className: 'min-h-12 px-5 text-sm font-bold bg-primary text-primary-foreground shadow-sm' })}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  <span>{locale === 'bn' ? 'নতুন প্রেসক্রিপশন তৈরি' : 'New Prescription'}</span>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout: Encounters & Prescriptions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Consultation Encounters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                <span>{locale === 'bn' ? 'ভিজিট ও ক্লিনিকাল হিস্ট্রি' : 'Visits & Encounters'}</span>
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {encounters.length} {locale === 'bn' ? 'টি ভিজিট' : 'visits'}
              </span>
            </div>

            {encounters.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <CardContent className="p-0 text-sm text-muted-foreground">
                  {locale === 'bn' ? 'কোনো ভিজিট রেকর্ড পাওয়া যায়নি' : 'No recorded visits yet'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {encounters.map((enc) => (
                  <Card key={enc.id} className="border-border bg-card">
                    <CardHeader className="p-4 pb-2 border-b border-border/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(enc.visit_date).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US')}
                        </span>
                        <Badge variant="outline" className="text-[11px]">
                          {enc.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground pt-1">
                        {enc.chief_complaint}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      {/* Vitals Summary */}
                      {enc.vitals && Object.keys(enc.vitals).length > 0 && (
                        <div className="p-2.5 rounded-lg bg-muted/40 grid grid-cols-3 gap-2 text-center">
                          {enc.vitals.bpSystolic && (
                            <div>
                              <span className="block text-[10px] text-muted-foreground">BP</span>
                              <span className="font-bold text-foreground">
                                {enc.vitals.bpSystolic}/{enc.vitals.bpDiastolic}
                              </span>
                            </div>
                          )}
                          {enc.vitals.pulse && (
                            <div>
                              <span className="block text-[10px] text-muted-foreground">Pulse</span>
                              <span className="font-bold text-foreground">{enc.vitals.pulse} bpm</span>
                            </div>
                          )}
                          {enc.vitals.tempF && (
                            <div>
                              <span className="block text-[10px] text-muted-foreground">Temp</span>
                              <span className="font-bold text-foreground">{enc.vitals.tempF}°F</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Symptoms */}
                      {enc.symptoms && enc.symptoms.length > 0 && (
                        <div>
                          <span className="font-semibold text-foreground block mb-1">
                            {locale === 'bn' ? 'উপসর্গসমূহ:' : 'Symptoms:'}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {enc.symptoms.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-[11px]">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Allergies Alert */}
                      {enc.allergies && enc.allergies.length > 0 && (
                        <div className="flex items-center gap-1.5 text-destructive font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {locale === 'bn' ? 'অ্যালার্জি:' : 'Allergies:'} {enc.allergies.join(', ')}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Prescriptions History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span>{locale === 'bn' ? 'প্রেসক্রিপশন রেকর্ড' : 'Prescription Records'}</span>
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {prescriptions.length} {locale === 'bn' ? 'টি প্রেসক্রিপশন' : 'prescriptions'}
              </span>
            </div>

            {prescriptions.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <CardContent className="p-0 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {locale === 'bn'
                      ? 'এই রোগীর কোনো প্রেসক্রিপশন তৈরি করা হয়নি।'
                      : 'No prescriptions created for this patient yet.'}
                  </p>
                  <Link
                    href={`/prescriptions/new?patientId=${patient.id}`}
                    className={buttonVariants({ size: 'sm', className: 'min-h-10' })}
                  >
                    <PlusCircle className="w-4 h-4 mr-1.5" />
                    <span>{locale === 'bn' ? 'প্রেসক্রিপশন তৈরি করুন' : 'Create Prescription'}</span>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((rx) => (
                  <Card key={rx.id} className="border-border bg-card hover:border-primary/50 transition-all">
                    <CardHeader className="p-4 pb-2 border-b border-border/40">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">
                          {rx.rx_number}
                        </span>
                        <Badge
                          variant={rx.status === 'finalized' ? 'outline' : 'secondary'}
                          className={`text-[11px] ${
                            rx.status === 'finalized'
                              ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                              : ''
                          }`}
                        >
                          {rx.status === 'finalized'
                            ? locale === 'bn'
                              ? 'চূড়ান্ত (Finalized)'
                              : 'Finalized'
                            : locale === 'bn'
                              ? 'খসড়া (Draft)'
                              : 'Draft'}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground pt-1">
                        {rx.diagnosis || (locale === 'bn' ? 'রোগ নির্ণয় উল্লেখ নেই' : 'Clinical Diagnosis')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {/* Prescribed Items Preview */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-muted-foreground block">
                          {locale === 'bn' ? 'ওষুধের তালিকা:' : 'Prescribed Medicines:'}
                        </span>
                        <div className="space-y-1">
                          {rx.items.slice(0, 3).map((item, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-foreground flex items-center justify-between p-1.5 rounded bg-muted/30"
                            >
                              <span className="font-bold">
                                {item.form} {item.brand_name} ({item.generic_name}) {item.strength}
                              </span>
                              <span className="font-mono text-muted-foreground">{item.dosing_schedule}</span>
                            </div>
                          ))}
                          {rx.items.length > 3 && (
                            <span className="text-[11px] text-muted-foreground italic">
                              +{rx.items.length - 3} {locale === 'bn' ? 'টি আরো ওষুধ...' : 'more items...'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-border/50">
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(rx.created_at).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US')}
                        </span>
                        <Link
                          href={`/prescriptions/${rx.id}`}
                          className={buttonVariants({ size: 'sm', variant: 'outline', className: 'text-xs min-h-9' })}
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" />
                          <span>{locale === 'bn' ? 'দেখুন ও প্রিন্ট' : 'View & Print'}</span>
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

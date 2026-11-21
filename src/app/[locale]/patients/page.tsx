'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import {
  Users,
  PlusCircle,
  Search,
  Phone,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface PatientItem {
  id: string;
  patient_code: string;
  name: string;
  phone: string;
  age: number;
  gender: string;
  blood_group?: string;
  emergency_contact?: string;
  created_at: string;
  updated_at: string;
}

export default function PatientsListPage() {
  const locale = useLocale();
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/patients?search=${encodeURIComponent(search)}`, { credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { patients: [] }))
      .then((data) => {
        setPatients(data.patients || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching patients:', err);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [search]);

  const filtered = patients.filter((p) => {
    if (genderFilter !== 'all' && p.gender !== genderFilter) return false;
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Persistent Clinical Disclaimer */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-primary font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {locale === 'bn'
                ? 'শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।'
                : 'Clinical decision support only. Not a substitute for professional judgement.'}
            </span>
          </div>
          <span className="text-muted-foreground hidden sm:inline">
            {locale === 'bn' ? 'চিকিৎসকই চূড়ান্ত সিদ্ধান্ত নেন।' : 'The doctor decides.'}
          </span>
        </div>

        <PageHeader
          title={locale === 'bn' ? 'রোগীর তালিকা ও রেজিস্ট্রি' : 'Patient Registry'}
          subtitle={
            locale === 'bn'
              ? 'আপনার চিকিৎসাধীন সকল রোগীর বিবরণ, পূর্বের ভিজিট এবং প্রেসক্রিপশন হিস্ট্রি'
              : 'Registered patients under your clinical care, consultation records, and history'
          }
          action={
            <Link
              href="/patients/new"
              data-tour="patients-new-btn"
              className={buttonVariants({ className: 'min-h-12 text-base font-semibold px-5 shadow-sm' })}
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              <span>{locale === 'bn' ? 'নতুন রোগী গ্রহণ' : 'New Patient Intake'}</span>
            </Link>
          }
        />

        {/* Filter and Search Bar */}
        <Card data-tour="patients-search" className="border-border shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={
                  locale === 'bn'
                    ? 'রোগীর নাম, কোড (P-101) বা ফোন নম্বর দিয়ে খুঁজুন...'
                    : 'Search by patient name, code (P-101), or phone...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 text-base"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                aria-label={locale === 'bn' ? 'লিঙ্গ ফিল্টার' : 'Gender Filter'}
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="h-11 px-3 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary w-full sm:w-auto"
              >
                <option value="all">{locale === 'bn' ? 'সকল লিঙ্গ' : 'All Genders'}</option>
                <option value="female">{locale === 'bn' ? 'মহিলা (Female)' : 'Female'}</option>
                <option value="male">{locale === 'bn' ? 'পুরুষ (Male)' : 'Male'}</option>
                <option value="other">{locale === 'bn' ? 'অন্যান্য' : 'Other'}</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Patient Cards / Table List */}
        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse text-base">
            {locale === 'bn' ? 'রোগীর তালিকা লোড হচ্ছে...' : 'Loading patient records...'}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <CardContent className="p-0 space-y-4">
              <Users className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-bold text-foreground">
                {locale === 'bn' ? 'কোনো রোগী পাওয়া যায়নি' : 'No patients found'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {locale === 'bn'
                  ? 'আপনার অনুসন্ধানের সাথে কোনো রেকর্ড মিলছে না। নতুন রোগী যুক্ত করতে নিচের বাটনে ক্লিক করুন।'
                  : 'No patient matched your search criteria. Register a new patient to get started.'}
              </p>
              <Link href="/patients/new" className={buttonVariants({ className: 'min-h-11 mt-2' })}>
                <PlusCircle className="w-4 h-4 mr-2" />
                <span>{locale === 'bn' ? 'নতুন রোগী গ্রহণ করুন' : 'New Patient Intake'}</span>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div data-tour="patients-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((patient) => (
              <Card
                key={patient.id}
                className="border-border hover:border-primary/50 transition-all hover:shadow-sm bg-card flex flex-col justify-between"
              >
                <div className="p-5 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
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
                  </div>

                  <h3 className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                    <Link href={`/patients/${patient.id}`}>{patient.name}</Link>
                  </h3>

                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {patient.blood_group && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {locale === 'bn' ? 'রক্তের গ্রুপ:' : 'Blood Group:'}
                        </span>
                        <span className="text-destructive font-bold">{patient.blood_group}</span>
                      </div>
                    )}
                    {patient.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{patient.phone}</span>
                      </div>
                    )}
                    {patient.emergency_contact && (
                      <div className="truncate text-[11px] text-muted-foreground/80">
                        {patient.emergency_contact}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-3 border-t border-border/50 bg-muted/20 rounded-b-xl flex items-center justify-between gap-2">
                  <Link
                    href={`/patients/${patient.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm', className: 'text-xs min-h-10' })}
                  >
                    <span>{locale === 'bn' ? 'প্রোফাইল দেখুন' : 'View Profile'}</span>
                  </Link>

                  <Link
                    href={`/prescriptions/new?patientId=${patient.id}`}
                    className={buttonVariants({ size: 'sm', className: 'text-xs min-h-10 bg-primary font-semibold' })}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    <span>{locale === 'bn' ? 'প্রেসক্রিপশন' : 'Prescribe'}</span>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

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
  Droplet,
  User,
  Loader2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
          title={locale === 'bn' ? 'রোগীর তালিকা' : 'Patient List'}
          subtitle={
            locale === 'bn'
              ? 'চিকিৎসাধীন রোগীর তালিকা ও রেকর্ড'
              : 'Registered patients and consultation records'
          }
          action={
            <Link
              href="/patients/new"
              data-tour="patients-new-btn"
              className={buttonVariants({ className: 'h-10 text-sm font-semibold px-4 shadow-xs' })}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              <span>{locale === 'bn' ? 'নতুন রোগী' : 'New Patient'}</span>
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

        {/* Patient Table List */}
        <div data-tour="patients-list">
          {loading ? (
            <Card className="border-border shadow-xs">
              <CardContent className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>{locale === 'bn' ? 'রোগীর তালিকা লোড হচ্ছে...' : 'Loading patient records...'}</span>
              </CardContent>
            </Card>
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
            <Card className="border-border shadow-xs overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/40">
                      <TableHead className="w-32 font-semibold">
                        {locale === 'bn' ? 'রোগী কোড' : 'Patient Code'}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {locale === 'bn' ? 'রোগীর নাম' : 'Patient Name'}
                      </TableHead>
                      <TableHead className="w-36 font-semibold">
                        {locale === 'bn' ? 'বয়স ও লিঙ্গ' : 'Age & Gender'}
                      </TableHead>
                      <TableHead className="w-28 font-semibold">
                        {locale === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}
                      </TableHead>
                      <TableHead className="w-44 font-semibold">
                        {locale === 'bn' ? 'যোগাযোগ' : 'Contact'}
                      </TableHead>
                      <TableHead className="w-44 text-right font-semibold">
                        {locale === 'bn' ? 'অ্যাকশন' : 'Actions'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((patient) => (
                      <TableRow
                        key={patient.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-mono font-bold text-xs">
                          <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md inline-block">
                            {patient.patient_code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/patients/${patient.id}`}
                            className="font-bold text-sm text-foreground hover:text-primary transition-colors block"
                          >
                            {patient.name}
                          </Link>
                          {patient.emergency_contact && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                              {patient.emergency_contact}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs font-medium">
                            {patient.gender === 'female'
                              ? locale === 'bn'
                                ? 'মহিলা'
                                : 'Female'
                              : locale === 'bn'
                                ? 'পুরুষ'
                                : 'Male'}
                            , {patient.age} {locale === 'bn' ? 'বছর' : 'yrs'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {patient.blood_group ? (
                            <Badge
                              variant="outline"
                              className="font-bold text-destructive border-destructive/30 bg-destructive/5 text-xs inline-flex items-center gap-1"
                            >
                              <Droplet className="w-3 h-3 fill-destructive/20 text-destructive" />
                              {patient.blood_group}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {patient.phone ? (
                            <div className="flex items-center gap-1.5 font-mono">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground/70" />
                              <span>{patient.phone}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/patients/${patient.id}`}
                              className={buttonVariants({
                                variant: 'outline',
                                size: 'sm',
                                className: 'h-8 px-2.5 text-xs font-medium gap-1',
                              })}
                            >
                              <User className="w-3.5 h-3.5" />
                              <span>{locale === 'bn' ? 'প্রোফাইল' : 'Profile'}</span>
                            </Link>
                            <Link
                              href={`/prescriptions/new?patientId=${patient.id}`}
                              className={buttonVariants({
                                size: 'sm',
                                className: 'h-8 px-2.5 text-xs bg-primary hover:bg-primary/90 font-semibold gap-1',
                              })}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{locale === 'bn' ? 'প্রেসক্রাইব' : 'Prescribe'}</span>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

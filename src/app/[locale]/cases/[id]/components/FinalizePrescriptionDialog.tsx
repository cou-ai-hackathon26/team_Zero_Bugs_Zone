'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FinalizePrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signature: string;
  onSignatureChange: (sig: string) => void;
  onFinalize: () => void;
  finalizing: boolean;
  unacknowledgedCriticalCount: number;
}

export function FinalizePrescriptionDialog({
  open,
  onOpenChange,
  signature,
  onSignatureChange,
  onFinalize,
  finalizing,
  unacknowledgedCriticalCount,
}: FinalizePrescriptionDialogProps) {
  const t = useTranslations('treatment');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md space-y-4">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold">
            <FileCheck className="w-5 h-5" />
            <AlertDialogTitle className="text-base font-bold">
              {t('finalizePrescription')}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {t('finalizeWarning')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {unacknowledgedCriticalCount > 0 ? (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Safety Block: Unacknowledged Critical Alerts</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              You must acknowledge all {unacknowledgedCriticalCount} critical alert(s) in the Treatment tab before finalising.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="doctor-signature" className="text-xs font-semibold text-foreground">
                Attending Physician Digital Signature / Name:
              </Label>
              <Input
                id="doctor-signature"
                placeholder="e.g. Dr. Farhana Rahman (MBBS, FCPS)"
                value={signature}
                onChange={(e) => onSignatureChange(e.target.value)}
                className="text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              By confirming, you certify that you have reviewed the deterministic dosage rules and clinical evidence recommendations.
            </p>
          </div>
        )}

        <AlertDialogFooter className="flex gap-2 sm:justify-end">
          <AlertDialogCancel className="text-xs">
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            size="sm"
            onClick={onFinalize}
            disabled={unacknowledgedCriticalCount > 0 || !signature.trim() || finalizing}
            className="gap-1.5 text-xs font-semibold"
          >
            {finalizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Finalizing...
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                Sign &amp; Finalize
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

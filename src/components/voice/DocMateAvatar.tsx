'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { VoiceState } from '@/lib/voice/types';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, HelpCircle, Loader2, Mic, Volume2 } from 'lucide-react';

export interface DocMateAvatarProps {
  state?: VoiceState;
  amplitude?: number; // 0.0 to 1.0 (audio volume level for dynamic mouth aperture)
  size?: 'sm' | 'md' | 'lg';
  reducedMotion?: boolean;
  className?: string;
  onClick?: () => void;
  showBadge?: boolean;
}

const SIZE_CLASSES = {
  sm: 'w-10 h-10', // 40px
  md: 'w-20 h-20', // 80px
  lg: 'w-44 h-44 sm:w-52 sm:h-52', // ~180px - 210px
};

const STATE_ICONS: Record<string, React.ReactNode> = {
  listening: <Mic className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 animate-pulse" />,
  transcribing: <Loader2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 animate-spin" />,
  thinking: <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin" />,
  speaking: <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-bounce" />,
  alert: <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
  happy: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
  confused: <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
};

export function DocMateAvatar({
  state = 'idle',
  amplitude = 0,
  size = 'md',
  reducedMotion: propReducedMotion,
  className,
  onClick,
  showBadge = false,
}: DocMateAvatarProps) {
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [blink, setBlink] = useState(false);

  // Check prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setSystemReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isReducedMotion = propReducedMotion ?? systemReducedMotion;

  // Periodic blinking effect for natural life (every 3.5s)
  useEffect(() => {
    if (isReducedMotion || state === 'speaking' || state === 'alert') return;
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 180);
    }, 3800);
    return () => clearInterval(interval);
  }, [isReducedMotion, state]);

  // Asset path determination
  const avatarSrc = useMemo(() => {
    switch (state) {
      case 'listening':
        return '/avatar/docmate-listening.svg';
      case 'transcribing':
      case 'thinking':
        return '/avatar/docmate-thinking.svg';
      case 'speaking':
        return '/avatar/docmate-speaking.svg';
      case 'alert':
      case 'error':
        return '/avatar/docmate-alert.svg';
      case 'happy':
        return '/avatar/docmate-happy.svg';
      case 'confused':
        return '/avatar/docmate-confused.svg';
      case 'idle':
      default:
        return '/avatar/docmate-idle.svg';
    }
  }, [state]);

  // Compute dynamic mouth scale based on amplitude during speech
  const mouthScale = useMemo(() => {
    if (state !== 'speaking' || isReducedMotion) return 1;
    // Map 0..1 to scale 1.0 to 1.7
    return 1 + Math.min(1.0, Math.max(0.0, amplitude)) * 0.7;
  }, [state, amplitude, isReducedMotion]);

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'relative select-none flex items-center justify-center rounded-full transition-transform duration-200',
        onClick && 'cursor-pointer hover:scale-105 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
        SIZE_CLASSES[size],
        className
      )}
      aria-label={`DocMate AI Avatar (${state})`}
    >
      {/* Outer Pulse Ring for Listening State */}
      {state === 'listening' && !isReducedMotion && (
        <span className="absolute inset-0 rounded-full animate-ping bg-teal-500/25 pointer-events-none" />
      )}

      {/* Speaking Sound Glow */}
      {state === 'speaking' && !isReducedMotion && (
        <span
          className="absolute -inset-1.5 rounded-full bg-blue-500/20 blur-xs transition-opacity duration-150 pointer-events-none"
          style={{ opacity: 0.3 + Math.min(1, amplitude) * 0.7 }}
        />
      )}

      {/* Main Avatar Vector Image */}
      <div
        className={cn(
          'relative w-full h-full rounded-full overflow-hidden shadow-xs transition-transform duration-200',
          blink && 'scale-y-95',
          state === 'thinking' && !isReducedMotion && 'animate-pulse',
          state === 'alert' && 'ring-2 ring-amber-500/80 shadow-amber-500/20'
        )}
        style={{
          transform: state === 'speaking' ? `scale(${mouthScale})` : undefined,
        }}
      >
        <Image
          src={avatarSrc}
          alt={`DocMate AI Assistant - ${state}`}
          fill
          sizes="(max-width: 768px) 160px, 210px"
          priority
          className="object-contain"
        />
      </div>

      {/* State Badge Pill */}
      {showBadge && STATE_ICONS[state] && (
        <div className="absolute -bottom-1 -right-1 p-1 bg-background/95 rounded-full border border-border shadow-xs flex items-center justify-center">
          {STATE_ICONS[state]}
        </div>
      )}
    </div>
  );
}

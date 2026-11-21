'use client';

import React from 'react';
import {
  Sparkles,
  HeartPulse,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface DoctorAiIllustrationProps {
  locale: string;
  className?: string;
}

export function DoctorAiIllustration({ locale, className = '' }: DoctorAiIllustrationProps) {
  const isBn = locale === 'bn';

  return (
    <div className={`relative w-full max-w-lg mx-auto flex items-center justify-center select-none ${className}`}>
      {/* Background Ambient Glows */}
      <div
        className="absolute -top-6 -right-6 w-72 h-72 rounded-full bg-primary/20 dark:bg-primary/25 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-8 -left-6 w-64 h-64 rounded-full bg-teal-500/15 dark:bg-teal-400/20 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Main SVG Vector Artwork */}
      <div className="relative w-full aspect-[500/520] max-h-[540px]">
        <svg
          viewBox="0 0 500 520"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-xl"
          role="img"
          aria-label={isBn ? 'ডকমেট এআই সহকারী ভেক্টর চিত্র' : 'DocMate Doctor AI Assistant Illustration'}
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="aiHalo" x1="120" y1="60" x2="380" y2="380" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.05" />
            </linearGradient>

            <radialGradient id="centralGlow" cx="50%" cy="45%" r="50%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="skinBase" x1="220" y1="120" x2="280" y2="240" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="50%" stopColor="#fdba74" />
              <stop offset="100%" stopColor="#fba048" />
            </linearGradient>

            <linearGradient id="skinShadow" x1="230" y1="180" x2="270" y2="250" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fba048" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0.4" />
            </linearGradient>

            <linearGradient id="hairGradient" x1="200" y1="80" x2="300" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            <linearGradient id="hairHighlight" x1="220" y1="80" x2="280" y2="130" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>

            <linearGradient id="coatGrad" x1="160" y1="240" x2="340" y2="500" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#f8fafc" />
              <stop offset="85%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>

            <linearGradient id="coatShadow" x1="200" y1="280" x2="300" y2="480" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.7" />
            </linearGradient>

            <linearGradient id="scrubsGrad" x1="220" y1="240" x2="280" y2="340" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0d9488" />
              <stop offset="50%" stopColor="#0f766e" />
              <stop offset="100%" stopColor="#115e59" />
            </linearGradient>

            <linearGradient id="stethoMetal" x1="210" y1="210" x2="290" y2="330" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>

            <linearGradient id="stethoTube" x1="190" y1="250" x2="310" y2="360" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="50%" stopColor="#0369a1" />
              <stop offset="100%" stopColor="#075985" />
            </linearGradient>

            <linearGradient id="tabletBody" x1="170" y1="360" x2="330" y2="470" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="50%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient id="tabletScreen" x1="180" y1="375" x2="320" y2="455" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0c4a6e" />
              <stop offset="50%" stopColor="#075985" />
              <stop offset="100%" stopColor="#082f49" />
            </linearGradient>

            <linearGradient id="screenHolo" x1="250" y1="380" x2="250" y2="310" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </linearGradient>

            {/* Glowing Holographic Filters */}
            <filter id="holoGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* AI Background Tech Rings & Matrix */}
          <g opacity="0.85">
            {/* Radial glow background orb */}
            <circle cx="250" cy="230" r="190" fill="url(#centralGlow)" />

            {/* Concentric Tech Rings */}
            <circle
              cx="250"
              cy="230"
              r="200"
              stroke="var(--primary)"
              strokeOpacity="0.2"
              strokeWidth="1.5"
              strokeDasharray="4 8"
            />
            <circle
              cx="250"
              cy="230"
              r="165"
              stroke="#06b6d4"
              strokeOpacity="0.25"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />
            <circle
              cx="250"
              cy="230"
              r="130"
              stroke="var(--primary)"
              strokeOpacity="0.3"
              strokeWidth="1"
            />

            {/* Tech Orbital Nodes */}
            <circle cx="415" cy="230" r="4" fill="#06b6d4" />
            <circle cx="85" cy="230" r="3" fill="var(--primary)" />
            <circle cx="250" cy="30" r="3.5" fill="#0ea5e9" />
            <circle cx="366" cy="114" r="2.5" fill="#14b8a6" />
            <circle cx="134" cy="114" r="2.5" fill="#06b6d4" />

            {/* Subtle Crosshairs / Digital Accents */}
            <path d="M 240 30 L 260 30 M 250 20 L 250 40" stroke="var(--primary)" strokeOpacity="0.4" strokeWidth="1.5" />
            <path d="M 440 230 L 460 230 M 450 220 L 450 240" stroke="#06b6d4" strokeOpacity="0.4" strokeWidth="1.5" />
            <path d="M 40 230 L 60 230 M 50 220 L 50 240" stroke="var(--primary)" strokeOpacity="0.4" strokeWidth="1.5" />

            {/* Hexagon AI Data Ring */}
            <polygon
              points="250,55 390,140 390,300 250,385 110,300 110,140"
              fill="none"
              stroke="#0ea5e9"
              strokeOpacity="0.12"
              strokeWidth="1.5"
              strokeDasharray="8 6"
            />
          </g>

          {/* ==================================================== */}
          {/* THE DOCTOR CHARACTER ILLUSTRATION                   */}
          {/* ==================================================== */}

          {/* Torso / White Lab Coat Back Shadow */}
          <path
            d="M 150 480 L 160 310 C 165 270 195 245 235 245 L 265 245 C 305 245 335 270 340 310 L 350 480 Z"
            fill="url(#coatShadow)"
          />

          {/* Doctor Scrub Top (V-Neck Under Coat) */}
          <path
            d="M 215 245 L 285 245 L 295 330 L 205 330 Z"
            fill="url(#scrubsGrad)"
          />
          <path
            d="M 230 245 L 250 295 L 270 245 Z"
            fill="#094e47"
            opacity="0.85"
          />

          {/* Neck */}
          <path
            d="M 230 195 L 230 255 C 230 262 238 268 250 268 C 262 268 270 262 270 255 L 270 195 Z"
            fill="url(#skinBase)"
          />
          {/* Neck Shadow under Chin */}
          <ellipse cx="250" cy="205" rx="20" ry="8" fill="url(#skinShadow)" />

          {/* Ears */}
          <ellipse cx="198" cy="168" rx="8" ry="13" fill="url(#skinBase)" />
          <ellipse cx="199" cy="168" rx="4" ry="7" fill="#ea580c" opacity="0.3" />
          <ellipse cx="302" cy="168" rx="8" ry="13" fill="url(#skinBase)" />
          <ellipse cx="301" cy="168" rx="4" ry="7" fill="#ea580c" opacity="0.3" />

          {/* Doctor Smart AI Earpiece (Right Ear) */}
          <g>
            <rect x="299" y="164" width="7" height="12" rx="3.5" fill="#f8fafc" stroke="#0ea5e9" strokeWidth="1" />
            <circle cx="302.5" cy="170" r="1.5" fill="#06b6d4" />
            <path d="M 304 170 Q 312 170 316 178" stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="1.5 1.5" strokeOpacity="0.8" />
            <circle cx="316" cy="178" r="2" fill="#06b6d4" />
          </g>

          {/* Face Structure */}
          <path
            d="M 204 145 C 204 195 218 215 250 215 C 282 215 296 195 296 145 C 296 115 282 105 250 105 C 218 105 204 115 204 145 Z"
            fill="url(#skinBase)"
          />

          {/* Hair (Modern, Professional Doctor Hair) */}
          <path
            d="M 198 140 C 195 125 200 100 220 85 C 240 70 270 72 288 88 C 302 100 305 120 302 142 C 296 130 290 125 280 124 C 265 122 250 128 235 120 C 220 112 210 125 198 140 Z"
            fill="url(#hairGradient)"
          />
          {/* Hair Highlights */}
          <path
            d="M 225 88 C 245 76 272 78 285 92 C 280 90 262 84 240 90 C 230 93 226 90 225 88 Z"
            fill="url(#hairHighlight)"
          />

          {/* Eyebrows */}
          <path d="M 218 145 C 224 141 232 142 237 146" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 263 146 C 268 142 276 141 282 145" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />

          {/* Eyes */}
          <g>
            {/* Left Eye */}
            <ellipse cx="228" cy="155" rx="5.5" ry="4" fill="#ffffff" />
            <circle cx="229" cy="155" r="2.8" fill="#1e293b" />
            <circle cx="230" cy="154" r="1" fill="#ffffff" />
            {/* Right Eye */}
            <ellipse cx="272" cy="155" rx="5.5" ry="4" fill="#ffffff" />
            <circle cx="271" cy="155" r="2.8" fill="#1e293b" />
            <circle cx="270" cy="154" r="1" fill="#ffffff" />
          </g>

          {/* Nose */}
          <path d="M 250 155 L 248 172 C 246 175 254 175 252 172" stroke="#ea580c" strokeOpacity="0.45" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

          {/* Cheerful Professional Smile */}
          <path
            d="M 238 186 C 244 194 256 194 262 186"
            stroke="#c2410c"
            strokeWidth="2"
            strokeLinecap="round"
            fill="#ffffff"
          />

          {/* Doctor White Lab Coat (Front & Lapels) */}
          <path
            d="M 152 480 L 164 305 C 168 268 196 248 232 248 L 268 248 C 304 248 332 268 336 305 L 348 480 Z"
            fill="url(#coatGrad)"
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Coat Lapels & Collar */}
          <path
            d="M 205 248 L 232 248 L 245 350 L 195 285 Z"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
          <path
            d="M 295 248 L 268 248 L 255 350 L 305 285 Z"
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />

          {/* Coat Seams & Pockets */}
          <path d="M 250 350 L 250 480" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
          {/* Left Pocket with Doctor Badge & Pens */}
          <g>
            <rect x="282" y="335" width="34" height="42" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <path d="M 282 344 L 316 344" stroke="#cbd5e1" strokeWidth="1" />

            {/* Medical Pens */}
            <rect x="288" y="322" width="3.5" height="15" rx="1.5" fill="#0284c7" />
            <rect x="294" y="325" width="3.5" height="12" rx="1.5" fill="#0d9488" />

            {/* DocMate AI Smart ID Card */}
            <rect x="301" y="338" width="12" height="18" rx="2" fill="#0f172a" stroke="#0ea5e9" strokeWidth="0.8" />
            <circle cx="307" cy="344" r="2.5" fill="#0ea5e9" />
            <rect x="304" y="349" width="6" height="1.5" rx="0.5" fill="#ffffff" />
            <rect x="305" y="352" width="4" height="1.2" rx="0.5" fill="#38bdf8" />
          </g>

          {/* Stethoscope around Neck */}
          <g>
            {/* Stethoscope Rubber Tubing */}
            <path
              d="M 220 220 C 205 235 195 260 195 295 C 195 330 215 350 238 350 C 248 350 252 340 252 330"
              stroke="url(#stethoTube)"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 280 220 C 295 235 305 260 305 295 C 305 325 295 345 285 355 L 275 365"
              stroke="url(#stethoTube)"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Metal Binaural Ear Tubes */}
            <path
              d="M 202 180 C 205 195 212 210 220 220"
              stroke="url(#stethoMetal)"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 298 180 C 295 195 288 210 280 220"
              stroke="url(#stethoMetal)"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Metallic Stethoscope Chest Piece (Bell) with glowing sensor */}
            <g transform="translate(230, 320)">
              <circle cx="16" cy="16" r="16" fill="url(#stethoMetal)" filter="url(#softShadow)" />
              <circle cx="16" cy="16" r="12" fill="#0f172a" />
              <circle cx="16" cy="16" r="8" fill="#06b6d4" opacity="0.8" />
              <circle cx="16" cy="16" r="4" fill="#ffffff" />
            </g>
          </g>

          {/* Doctor's Arms and Hands holding Tablet */}
          <g>
            {/* Left Arm Sleeves */}
            <path
              d="M 160 310 L 140 400 C 138 410 144 425 158 430 L 195 440 L 190 380 Z"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            {/* Right Arm Sleeves */}
            <path
              d="M 340 310 L 360 400 C 362 410 356 425 342 430 L 305 440 L 310 380 Z"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="1"
            />

            {/* Hands (Holding the Smart Tablet) */}
            <ellipse cx="185" cy="435" rx="14" ry="9" fill="url(#skinBase)" transform="rotate(-15 185 435)" />
            <ellipse cx="315" cy="435" rx="14" ry="9" fill="url(#skinBase)" transform="rotate(15 315 435)" />
          </g>

          {/* ==================================================== */}
          {/* THE HOLOGRAPHIC AI DIAGNOSTIC TABLET                */}
          {/* ==================================================== */}
          <g>
            {/* Holographic Projection Beam from Screen */}
            <polygon
              points="195,385 305,385 335,275 165,275"
              fill="url(#screenHolo)"
              opacity="0.6"
            />

            {/* Tablet Chassis */}
            <rect
              x="175"
              y="375"
              width="150"
              height="105"
              rx="12"
              fill="url(#tabletBody)"
              stroke="#38bdf8"
              strokeWidth="2"
              filter="url(#softShadow)"
            />

            {/* Tablet Inner Screen */}
            <rect
              x="182"
              y="382"
              width="136"
              height="90"
              rx="8"
              fill="url(#tabletScreen)"
            />

            {/* Screen Header Bar */}
            <rect x="187" y="388" width="55" height="6" rx="3" fill="#0284c7" opacity="0.6" />
            <circle cx="304" cy="391" r="2.5" fill="#10b981" />
            <circle cx="310" cy="391" r="2" fill="#38bdf8" />

            {/* Live ECG Waveform on Tablet Screen */}
            <path
              d="M 188 418 L 210 418 L 215 410 L 220 428 L 225 402 L 230 422 L 235 418 L 255 418 L 260 412 L 264 425 L 268 406 L 272 420 L 276 418 L 310 418"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#holoGlow)"
            />

            {/* Guideline Assessment Bars */}
            <rect x="188" y="432" width="70" height="5" rx="2.5" fill="#10b981" opacity="0.9" />
            <rect x="188" y="441" width="50" height="4" rx="2" fill="#38bdf8" opacity="0.75" />
            <rect x="188" y="449" width="35" height="4" rx="2" fill="#0284c7" opacity="0.6" />

            {/* Verified Badge Icon on Tablet Screen */}
            <g transform="translate(285, 432)">
              <circle cx="12" cy="12" r="10" fill="#10b981" opacity="0.25" />
              <circle cx="12" cy="12" r="8" fill="#10b981" />
              <path d="M 8 12 L 11 15 L 16 9" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

            {/* Floating Hologram Data Ring over Tablet */}
            <ellipse
              cx="250"
              cy="345"
              rx="45"
              ry="12"
              stroke="#06b6d4"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              fill="none"
              opacity="0.8"
            />
            {/* Holographic Crosshair */}
            <circle cx="250" cy="345" r="3" fill="#38bdf8" />
          </g>

          {/* Floating Medical AI Crosses and Particles */}
          <g opacity="0.75">
            {/* Cross 1 */}
            <path d="M 120 180 L 128 180 M 124 176 L 124 184" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
            {/* Cross 2 */}
            <path d="M 370 170 L 378 170 M 374 166 L 374 174" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
            {/* Diamond Node */}
            <polygon points="380,310 385,315 380,320 375,315" fill="#38bdf8" />
            <polygon points="115,310 120,315 115,320 110,315" fill="var(--primary)" />
          </g>
        </svg>

        {/* ==================================================== */}
        {/* FLOATING GLASSMORPHIC AI ASSISTANT OVERLAYS          */}
        {/* ==================================================== */}

        {/* Badge 1: Top Right - DocMate AI Assistant */}
        <div className="absolute top-2 -right-2 sm:right-2 z-10">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-card/90 dark:bg-card/85 backdrop-blur-md border border-primary/30 shadow-lg text-left">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 text-primary">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">
                  {isBn ? 'ডকমেট এআই সহকারী' : 'DocMate AI Assistant'}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground block font-medium">
                {isBn ? 'ক্লিনিকাল ডিসিশন সাপোর্ট' : 'Clinical Decision Support'}
              </span>
            </div>
          </div>
        </div>

        {/* Badge 2: Middle Left - Real-time ECG / Guideline Grounding */}
        <div className="absolute top-1/3 -left-3 sm:-left-4 z-10">
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-card/90 dark:bg-card/85 backdrop-blur-md border border-border/80 shadow-lg text-left max-w-[200px]">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
              <HeartPulse className="w-4 h-4 text-rose-500 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-foreground truncate">
                  {isBn ? 'গাইডলাইন বিশ্লেষণ' : 'Guideline Active'}
                </span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                {isBn ? 'WHO ও NICE স্ট্যান্ডার্ড' : 'WHO & NICE Grounded'}
              </span>
            </div>
          </div>
        </div>

        {/* Badge 3: Bottom Right - Safe Rx & Safety Clearance */}
        <div className="absolute bottom-4 -right-2 sm:right-0 z-10">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card/90 dark:bg-card/85 backdrop-blur-md border border-emerald-500/30 shadow-xl text-left">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">
                  {isBn ? 'নিরাপদ ড্রাগ চেক' : 'Safe Rx Verification'}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  PASS
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground block">
                {isBn ? 'অ্যালার্জি ও মিথস্ক্রিয়া মুক্ত' : 'Zero DDI & Allergy Safe'}
              </span>
            </div>
          </div>
        </div>

        {/* Badge 4: Top Left - Physician Control */}
        <div className="absolute top-10 -left-2 sm:left-0 z-10 hidden sm:block">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-xs text-[11px] font-semibold text-primary">
            <UserCheck className="w-3.5 h-3.5" />
            <span>{isBn ? 'চিকিৎসক নিয়ন্ত্রিত' : 'Doctor in Control'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

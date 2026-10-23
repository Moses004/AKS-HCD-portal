import React from 'react';
import akwaIbomCrestImg from '../../assets/images/akwa_ibom_crest_1791434140170.jpg';
import ariseAgendaLogoSvg from '../../assets/images/arise_agenda_logo.svg';
import ariseHcdLogoImg from '../../assets/images/arise_hcd_logo.jpg';

/**
 * Official Human Capital Development (HCD) Logo
 * The authentic circular seal of ARISE Human Capital Development:
 * Deep green outer ring with bold white text 'ARISE HUMAN CAPITAL DEVELOPMENT' and yellow star,
 * with inner white field featuring the Akwa Ibom State map outline,
 * and celebrating figures emerging from an open red arch.
 */
export const HcdLogo: React.FC<{
  className?: string;
  size?: number;
  withBackground?: boolean;
}> = ({
  className = 'w-8 h-8',
  size,
}) => {
  return (
    <img
      src="/assets/aistudio/IMG-20261013-WA0049_58348b43.jpg"
      alt="Official ARISE Human Capital Development Emblem"
      className={`report-logo object-contain shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      referrerPolicy="no-referrer"
      loading="eager"
    />
  );
};

/**
 * Official Government of Akwa Ibom State Seal / Crest
 * Displays the high-resolution circular crest:
 * "GOVERNMENT OF AKWA IBOM STATE, NIGERIA - 1987 THE LAND OF PROMISE"
 */
export const AkwaIbomStateLogo: React.FC<{
  className?: string;
  size?: number;
  alt?: string;
}> = ({
  className = 'w-10 h-10',
  size,
  alt = 'Government of Akwa Ibom State Official Crest',
}) => {
  return (
    <img
      src={akwaIbomCrestImg}
      alt={alt}
      className={`report-logo rounded-full object-contain shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      referrerPolicy="no-referrer"
      loading="eager"
    />
  );
};

/**
 * Official ARISE Agenda Logo File
 * Features the 5 rising sun figures and the bold ARISE wordmark in forest green.
 */
export const AriseAgendaLogo: React.FC<{
  className?: string;
  size?: number;
  alt?: string;
}> = ({
  className = 'w-10 h-10',
  size,
  alt = 'Akwa Ibom State ARISE Agenda Logo',
}) => {
  return (
    <img
      src="/assets/aistudio/images__2__a39b6d2f.jpeg"
      alt={alt}
      className={`report-logo object-contain shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      referrerPolicy="no-referrer"
      loading="eager"
    />
  );
};

// Aliases for clean importing
export const AriseLogo = AriseAgendaLogo;
export const AriseHcdLogo = HcdLogo;
export const AksLogo = AkwaIbomStateLogo;
export const AksSealLogo = AkwaIbomStateLogo;

/**
 * Combined Dual Emblem Component
 * Displays the Akwa Ibom State ARISE Agenda logo paired with the HCD Core Emblem
 */
export const AksHcdDualLogo: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  orientation?: 'horizontal' | 'stacked';
  showLabel?: boolean;
}> = ({
  size = 'md',
  variant = 'dark',
  orientation = 'horizontal',
  showLabel = true,
}) => {
  const isDark = variant === 'dark';
  const sizeClasses = {
    sm: { hcd: 'w-7 h-7', text: 'text-xs', sub: 'text-[9px]' },
    md: { hcd: 'w-10 h-10', text: 'text-sm', sub: 'text-[10px]' },
    lg: { hcd: 'w-16 h-16', text: 'text-lg', sub: 'text-xs' },
  }[size];

  return (
    <div
      className={`flex ${
        orientation === 'horizontal' ? 'items-center gap-3' : 'flex-col items-center gap-2'
      }`}
    >
      {/* HCD Logo with Crest Border */}
      <div className="flex items-center justify-center bg-white/95 p-1.5 rounded-xl border border-[#D4AF37]/50 shadow-xs">
        <HcdLogo className={sizeClasses.hcd} />
      </div>

      {showLabel && (
        <div className="leading-tight text-left">
          <span
            className={`font-black tracking-tight block ${sizeClasses.text} ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            AKS-HCD PORTAL
          </span>
          <span
            className={`uppercase tracking-wider font-semibold block ${sizeClasses.sub} ${
              isDark ? 'text-[#D4AF37]' : 'text-emerald-800'
            }`}
          >
            ARISE Agenda · 31 LGAs
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Official Print & Report Letterhead Banner
 * Automatically appears on printed reports/dossiers (or on-screen when alwaysVisible=true)
 * so every printed or exported page carries the official AKS-HCD site logo.
 */
export const OfficialPrintLetterhead: React.FC<{
  title?: string;
  subtitle?: string;
  alwaysVisible?: boolean;
}> = ({
  title = 'AKWA IBOM STATE HUMAN CAPITAL DEVELOPMENT PORTAL',
  subtitle = 'Directorate of Human Capital Development • Official ARISE Agenda Monitoring & Evaluation Record',
  alwaysVisible = false,
}) => {
  return (
    <div
      className={`print-letterhead ${
        alwaysVisible ? 'flex' : 'hidden print:flex'
      } items-center justify-between gap-4 border-b-2 border-[#0B4619] bg-white px-4 py-3 mb-4`}
    >
      <div className="flex items-center gap-3">
        <div className="p-1 rounded-xl border border-[#D4AF37] bg-white shadow-2xs shrink-0">
          <HcdLogo className="w-12 h-12" />
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0B4619]">
            Government of Akwa Ibom State • ARISE Agenda
          </p>
          <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
            {title}
          </h1>
          <p className="text-[11px] text-slate-600 font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="text-right hidden sm:block print:block">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-emerald-800">
            Official Verified Record
          </span>
          <span className="block text-[9px] text-slate-500 font-mono">
            Printed: {new Date().toLocaleDateString('en-NG')}
          </span>
        </div>
        <div className="p-1 rounded-lg border border-slate-200 bg-white shrink-0">
          <AriseAgendaLogo className="w-10 h-10" />
        </div>
      </div>
    </div>
  );
};


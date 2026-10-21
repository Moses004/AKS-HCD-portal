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
      className={`object-contain shrink-0 ${className}`}
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
      className={`rounded-full object-contain shrink-0 ${className}`}
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
      className={`object-contain shrink-0 ${className}`}
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

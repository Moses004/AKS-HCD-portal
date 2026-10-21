import React from 'react';
import { ALL_31_LGAS } from '../../data/lgas';
import { HcdLogo } from './Logos';
import { ShieldCheck, MapPin, Database, Award, ArrowUpRight } from 'lucide-react';

import { useData } from '../../context/DataContext';

interface FooterProps {
  onSelectLga?: (lgaId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectLga }) => {
  const { pillars } = useData();

  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-[#0B4619] to-emerald-900 text-slate-300 pt-12 pb-8 border-t-4 border-[#D4AF37]">
      {/* Subtle White & Emerald Government Identity Gradient Sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-emerald-950/50" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-emerald-800/60">
          {/* Col 1: Government Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center p-1 rounded-xl bg-white border border-[#D4AF37] shadow-sm shrink-0">
                <HcdLogo className="h-9 w-auto object-contain" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm tracking-wide">
                  AKWA IBOM STATE
                </h4>
                <p className="text-[#D4AF37] text-xs font-semibold">
                  ARISE Agenda · HCD Portal
                </p>
              </div>
            </div>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              Unified digital infrastructure aggregating, measuring, and verifying human capacity investments across all 31 Local Government Areas in alignment with the ARISE Agenda.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Government House, Uyo, Akwa Ibom State</span>
            </div>
          </div>

          {/* Col 2: The Strategic HCD Pillars */}
          <div className="space-y-3">
            <h5 className="text-white font-semibold text-xs tracking-wider uppercase">
              Strategic HCD Pillars
            </h5>
            <ul className="space-y-2 text-xs text-emerald-200/70">
              {pillars.map((p, idx) => (
                <li key={p.pillar_code} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shrink-0" />
                  <span className="truncate" title={p.display_name}>
                    {idx + 1}. {p.display_name}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Senatorial Districts Coverage */}
          <div className="space-y-3">
            <h5 className="text-white font-semibold text-xs tracking-wider uppercase">
              Autonomous Councils Coverage
            </h5>
            <div className="space-y-2 text-xs text-emerald-200/70">
              <div>
                <strong className="text-white">Uyo District (NE):</strong>
                <p className="text-[11px] text-emerald-300/80">9 LGAs · Uyo, Itu, Ibiono Ibom, Etinan, Ibesikpo, Nsit Ubium, Nsit Ibom, Nsit Atai, Uruan</p>
              </div>
              <div>
                <strong className="text-white">Ikot Ekpene District (NW):</strong>
                <p className="text-[11px] text-emerald-300/80">10 LGAs · Ikot Ekpene, Abak, Essien Udim, Etim Ekpo, Ika, Ikono, Ini, Obot Akara, Oruk Anam, Ukanafun</p>
              </div>
              <div>
                <strong className="text-white">Eket District (South):</strong>
                <p className="text-[11px] text-emerald-300/80">12 LGAs · Eket, Ibeno, Eastern Obolo, Ikot Abasi, Mkpat Enin, Onna, Esit Eket, Mbo, Okobo, Oron, Udung Uko, Urue-Offong/Oruko</p>
              </div>
            </div>
          </div>

          {/* Col 4: Platform Security & Offline Sync Architecture */}
          <div className="space-y-3">
            <h5 className="text-white font-semibold text-xs tracking-wider uppercase">
              Architecture & Security
            </h5>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              Multi-tenant isolation backed by software-enforced Row-Level Security, demographic balance assertions, and offline field sync caches.
            </p>
            <div className="p-3 rounded-lg bg-emerald-900/50 border border-emerald-700/60 text-[11px] space-y-1.5">
              <div className="flex items-center gap-1.5 text-[#D4AF37] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Strict Tenant Sandboxing</span>
              </div>
              <p className="text-emerald-200/70">
                LGA contributors cannot mutate peer council datasets. All published metrics require State Cabinet sign-off.
              </p>
            </div>
          </div>
        </div>

        {/* 31 LGAs Quick Directory Bar */}
        <div className="py-6 border-b border-emerald-800/40">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-2">
            31 Local Government Area Workspaces
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_31_LGAS.map((lga) => (
              <button
                key={lga.id}
                onClick={() => onSelectLga && onSelectLga(lga.id)}
                className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-100 transition-colors border border-emerald-700/40"
              >
                {lga.name}
              </button>
            ))}
          </div>
        </div>

        {/* Copyright & Meta */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-300/60">
          <p>© {new Date().getFullYear()} Government of Akwa Ibom State, Federal Republic of Nigeria. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>ARISE Agenda Implementation</span>
            <span>·</span>
            <span>Single-Database / Shared-Schema Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

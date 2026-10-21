import React from 'react';
import { useActivityMedia } from '../../hooks/useActivityMedia';
import { VerificationMedia, StateEvidenceFile, PillarId } from '../../types';
import {
  FileText,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  FileSearch,
} from 'lucide-react';
import { PILLARS } from '../../data/lgas';

export interface ActivityMediaImageProps {
  media?: VerificationMedia | StateEvidenceFile | null;
  activityTitle?: string;
  pillar?: PillarId;
  lgaName?: string;
  community?: string;
  className?: string; // Container class
  imageClassName?: string;
  aspectRatioClass?: string; // Default: 'h-48 w-full'
  showBadgeOverlays?: boolean;
  onReuploadRequested?: () => void;
  canReupload?: boolean;
}

export const ActivityMediaImage: React.FC<ActivityMediaImageProps> = ({
  media,
  activityTitle = 'Government Activity',
  pillar,
  lgaName,
  community,
  className = '',
  imageClassName = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300',
  aspectRatioClass = 'h-48 w-full',
  showBadgeOverlays = true,
  onReuploadRequested,
  canReupload = false,
}) => {
  const { url, status, isLoading, isError, isDocument, isGeotagValid, retry, handleImageError, result } =
    useActivityMedia(media);

  const pillarObj = pillar ? PILLARS[pillar] : undefined;

  // Render document file card
  if (isDocument) {
    return (
      <div
        className={`relative ${aspectRatioClass} bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-100/50 border border-emerald-200/60 overflow-hidden flex flex-col justify-between p-4 ${className}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
            Official PDF Document
          </span>
        </div>

        <div className="space-y-1 my-auto">
          <div className="font-semibold text-xs text-slate-900 line-clamp-2" title={result.fileName}>
            {result.fileName || 'Attached Documentation'}
          </div>
          {media && 'caption' in media && media.caption && (
            <p className="text-[11px] text-slate-500 line-clamp-1">{media.caption}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-emerald-200/50">
          <span className="text-[10px] font-mono text-slate-500">{result.fileSize || 'Dossier Asset'}</span>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
            >
              <span>Inspect Document</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <button
              onClick={retry}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Token</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render loading state with stable dimensions
  if (isLoading) {
    return (
      <div
        className={`relative ${aspectRatioClass} bg-slate-100 overflow-hidden flex flex-col items-center justify-center p-4 animate-pulse ${className}`}
      >
        <div className="w-8 h-8 rounded-full border-2 border-emerald-700 border-t-transparent animate-spin mb-2" />
        <span className="text-[11px] font-medium text-slate-500">Resolving secure evidence...</span>
      </div>
    );
  }

  // Render image if resolved successfully
  if (url && status === 'resolved') {
    return (
      <div className={`relative ${aspectRatioClass} bg-slate-100 overflow-hidden ${className}`}>
        <img
          src={url}
          alt={media && 'caption' in media && media.caption ? media.caption : activityTitle}
          loading="lazy"
          onError={handleImageError}
          className={imageClassName}
        />

        {showBadgeOverlays && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />

            {/* LGA Tag */}
            {lgaName && (
              <div className="absolute top-3 left-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-white bg-emerald-950/90 px-2.5 py-1 rounded-md shadow-xs backdrop-blur-xs">
                  {lgaName} LGA
                </span>
              </div>
            )}

            {/* Geotag and Community verification: strictly validated */}
            <div className="absolute bottom-2.5 left-3 right-3 text-white flex items-center justify-between text-xs pointer-events-none">
              {community ? (
                <span className="font-semibold truncate max-w-[180px] drop-shadow-xs">
                  {community}
                </span>
              ) : (
                <span />
              )}

              {isGeotagValid ? (
                <span className="text-[10px] bg-emerald-900/90 text-emerald-200 border border-emerald-400/40 backdrop-blur-xs px-2 py-0.5 rounded font-bold shadow-xs">
                  ✓ Verified Geotag
                </span>
              ) : (
                <span className="text-[10px] bg-black/50 text-slate-200 backdrop-blur-xs px-2 py-0.5 rounded font-medium">
                  Field Photo
                </span>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Missing file status (file not in storage vault)
  if (status === 'missing_file') {
    return (
      <div
        className={`relative ${aspectRatioClass} bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 overflow-hidden flex flex-col justify-between p-4 ${className}`}
      >
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
            Evidence Pending
          </span>
        </div>

        <div className="space-y-1 text-left my-auto">
          <h5 className="text-xs font-bold text-amber-950">Evidence File Missing</h5>
          <p className="text-[11px] text-amber-800/90 leading-tight">
            Original object not found in private vault. File metadata is securely recorded.
          </p>
        </div>

        <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
          {canReupload && onReuploadRequested ? (
            <button
              onClick={onReuploadRequested}
              className="px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] transition-colors cursor-pointer"
            >
              Re-upload Evidence
            </button>
          ) : (
            <span className="text-[10px] text-amber-700 font-mono truncate max-w-[170px]" title={result.storagePath || ''}>
              {result.fileName || 'Archive missing'}
            </span>
          )}

          <button
            onClick={retry}
            title="Retry connecting to evidence vault"
            className="p-1 rounded text-amber-800 hover:bg-amber-100 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Unauthorized access status
  if (status === 'unauthorized') {
    return (
      <div
        className={`relative ${aspectRatioClass} bg-slate-900 text-white overflow-hidden flex flex-col justify-between p-4 ${className}`}
      >
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl bg-white/10 text-amber-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Classified Dossier
          </span>
        </div>

        <div className="my-auto space-y-1">
          <h5 className="text-xs font-bold text-slate-100">Restricted Evidence</h5>
          <p className="text-[11px] text-slate-400 leading-tight">
            Clearance required to inspect official beneficiary registry files.
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500">
          Akwa Ibom State Evidence Vault · RLS Protected
        </div>
      </div>
    );
  }

  // Legacy local invalid status or error
  if (status === 'legacy_local_invalid') {
    return (
      <div
        className={`relative ${aspectRatioClass} bg-slate-50 border border-slate-200 overflow-hidden flex flex-col justify-between p-4 ${className}`}
      >
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
            <FileSearch className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700">
            Awaiting Cloud Proof
          </span>
        </div>

        <div className="my-auto space-y-1">
          <h5 className="text-xs font-semibold text-slate-800">Field Evidence Required</h5>
          <p className="text-[11px] text-slate-500 leading-tight">
            Draft asset recorded without cloud storage reference.
          </p>
        </div>

        {canReupload && onReuploadRequested && (
          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={onReuploadRequested}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
            >
              Attach Cloud Evidence →
            </button>
          </div>
        )}
      </div>
    );
  }

  // Neutral Branded Placeholder: Never show broken browser image icon!
  // Uses authentic Akwa Ibom State green/gold styling with subtle pillar emblem
  return (
    <div
      className={`relative ${aspectRatioClass} bg-gradient-to-br from-slate-900 via-[#0B4619] to-emerald-950 text-white overflow-hidden flex flex-col justify-between p-4 select-none ${className}`}
    >
      {/* Background seal pattern */}
      <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none blur-xs" />
      <div className="absolute right-3 top-3 opacity-20 pointer-events-none">
        <div className="w-16 h-16 rounded-full border border-white/40 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border border-white/30" />
        </div>
      </div>

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-800/80 border border-emerald-400/30 flex items-center justify-center text-[#D4AF37] font-bold text-xs shadow-xs">
            AKS
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-emerald-300 uppercase block">
              Akwa Ibom State
            </span>
            <span className="text-[11px] font-bold text-white leading-none">
              HCD Initiative
            </span>
          </div>
        </div>

        {lgaName && (
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-emerald-200 border border-white/20">
            {lgaName} LGA
          </span>
        )}
      </div>

      <div className="relative z-10 my-auto text-left py-2">
        <h5 className="text-xs font-bold text-white line-clamp-2 leading-snug drop-shadow-xs">
          {activityTitle}
        </h5>
        {community && (
          <p className="text-[11px] text-emerald-200/90 truncate mt-0.5">
            📍 {community}
          </p>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/15 text-[10px] text-emerald-200/80">
        <span>{pillarObj?.name || 'Human Capital Development'}</span>
        <span className="font-mono text-emerald-400">ARISE Agenda</span>
      </div>
    </div>
  );
};

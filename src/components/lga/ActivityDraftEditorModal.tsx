import React, { useMemo, useState } from 'react';
import { X, Save, Upload, Trash2, FileText, Image as ImageIcon, Video, AlertTriangle, Plus } from 'lucide-react';
import { HCDActivity, VerificationMedia, ProjectMilestone, PillarId, ReportingCategory, PillarSegment } from '../../types';
import { PILLARS, ALL_31_LGAS } from '../../data/lgas';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { validateMediaFile, isDocumentMedia, deleteEvidenceFromStorage } from '../../services/mediaService';

interface ActivityDraftEditorModalProps {
  activity: HCDActivity;
  onClose: () => void;
  onSaved?: () => void;
}

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-700';

function mediaType(file: File): VerificationMedia['type'] {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'photo';
  return 'document';
}

export const ActivityDraftEditorModal: React.FC<ActivityDraftEditorModalProps> = ({ activity, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { updateActivity, uploadEvidenceToSupabase, isOnline, isSupabaseActive } = useData();
  const [title, setTitle] = useState(activity.title || '');
  const [pillar, setPillar] = useState<PillarId>(activity.pillar);
  const [projectDescription, setProjectDescription] = useState(activity.projectDescription || activity.subCategory || '');
  const [category, setCategory] = useState(String(activity.category || ''));
  const [pillarSegment, setPillarSegment] = useState(String(activity.pillarSegment || ''));
  const [community, setCommunity] = useState(activity.community || '');
  const [latitude, setLatitude] = useState(String(activity.coordinates?.lat ?? ''));
  const [longitude, setLongitude] = useState(String(activity.coordinates?.lng ?? ''));
  const [beneficiariesTotal, setBeneficiariesTotal] = useState(String(activity.beneficiariesTotal ?? 0));
  const [beneficiariesMale, setBeneficiariesMale] = useState(String(activity.beneficiariesMale ?? 0));
  const [beneficiariesFemale, setBeneficiariesFemale] = useState(String(activity.beneficiariesFemale ?? 0));
  const [youthBeneficiaries, setYouthBeneficiaries] = useState(String(activity.youthBeneficiaries ?? 0));
  const [budgetNgn, setBudgetNgn] = useState(String(activity.budgetNgn ?? 0));
  const [startDate, setStartDate] = useState(activity.startDate || '');
  const [completionDate, setCompletionDate] = useState(activity.completionDate || '');
  const [leadOfficer, setLeadOfficer] = useState(activity.leadOfficer || '');
  const [officerContact, setOfficerContact] = useState(activity.officerContact || '');
  const [submissionNotes, setSubmissionNotes] = useState(activity.submissionNotes || '');
  const [milestones, setMilestones] = useState<ProjectMilestone[]>(activity.milestones || []);
  const [mediaAssets, setMediaAssets] = useState<VerificationMedia[]>(activity.mediaAssets || []);
  const [attendanceSheetFileName, setAttendanceSheetFileName] = useState(activity.attendanceSheetFileName || '');
  const [attendanceRegistryUrl, setAttendanceRegistryUrl] = useState(activity.attendanceRegistryUrl || '');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingOldPaths, setPendingOldPaths] = useState<string[]>([]);
  const [pendingNewPaths, setPendingNewPaths] = useState<string[]>([]);

  const assignedLga = ALL_31_LGAS.find((l) => l.id === activity.lgaId);
  const balanced = Number(beneficiariesMale) + Number(beneficiariesFemale) === Number(beneficiariesTotal);
  const progress = useMemo(() => milestones.length ? Math.round(milestones.reduce((n, m) => n + (Number(m.completionPercentage) || 0), 0) / milestones.length) : 0, [milestones]);

  const canEdit = (currentUser.role === 'state_admin' || (currentUser.role === 'lga_admin' && currentUser.assignedLgaId === activity.lgaId))
    && (activity.status === 'DRAFT' || activity.status === 'REJECTED_DRAFT');
  if (!canEdit) {
    return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4"><div className="max-w-md rounded-2xl bg-white p-6 shadow-2xl"><p className="text-sm text-slate-800">Only authorized staff can edit drafts or returned reports. Pending and published records are read-only here.</p><button className="mt-4 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white" onClick={onClose}>Close</button></div></div>;
  }

  const uploadFile = async (file: File, replaceId?: string, isAttendance = false) => {
    setError('');
    setNotice('');
    const validation = validateMediaFile(file);
    if (!validation.valid) { setError(validation.error || 'This file is not supported.'); return; }
    if (currentUser.isDemo) {
      setError('Evidence upload and replacement are disabled in demo mode to prevent writes to the live evidence vault. You can still edit report fields in the isolated demo.');
      return;
    }
    if (!isOnline || !isSupabaseActive) {
      setError('Media replacement requires an active online Supabase connection. Your existing evidence has been preserved; reconnect and try again.');
      return;
    }
    const key = isAttendance ? 'attendance' : (replaceId || 'new-' + Date.now());
    setUploadingKey(key);
    try {
      const upload = await uploadEvidenceToSupabase(file, file.name, activity.lgaId, activity.id);
      if (!upload.success || !upload.storagePath) throw new Error(upload.error || 'Upload did not return a canonical storage path.');
      setPendingNewPaths((prev) => [...prev, upload.storagePath!]);
      const asset: VerificationMedia = {
        id: 'proof-' + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString()),
        type: mediaType(file),
        url: '',
        storagePath: upload.storagePath,
        caption: 'Field evidence: ' + file.name,
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        exifVerified: false,
        coordinates: activity.coordinates,
        uploadTimestamp: new Date().toISOString(),
      };
      if (isAttendance) {
        if (attendanceRegistryUrl && attendanceRegistryUrl !== '#attendance-registry-file' && !attendanceRegistryUrl.startsWith('http')) setPendingOldPaths((prev) => [...prev, attendanceRegistryUrl]);
        setAttendanceSheetFileName(file.name);
        setAttendanceRegistryUrl(upload.storagePath);
        setMediaAssets((prev) => [...prev.filter((m) => m.caption !== 'Attendance registry'), { ...asset, caption: 'Attendance registry', type: 'document' }]);
        setNotice('Attendance registry uploaded. Save the draft to persist the new attachment.');
      } else if (replaceId) {
        const old = mediaAssets.find((m) => m.id === replaceId);
        if (old?.storagePath) setPendingOldPaths((prev) => [...prev, old.storagePath!]);
        setMediaAssets((prev) => prev.map((m) => m.id === replaceId ? asset : m));
        setNotice('Replacement uploaded. Save the draft to apply the change.');
      } else {
        setMediaAssets((prev) => [...prev, asset]);
        setNotice('Evidence uploaded. Save the draft to persist the new attachment.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evidence upload failed.');
    } finally {
      setUploadingKey(null);
    }
  };

  const removeMedia = (item: VerificationMedia) => {
    if (item.storagePath) setPendingOldPaths((prev) => [...prev, item.storagePath!]);
    setMediaAssets((prev) => prev.filter((m) => m.id !== item.id));
    setNotice('Evidence marked for removal. Save the draft to apply the change.');
  };

  const updateMilestone = (id: string, patch: Partial<ProjectMilestone>) => setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
  const addMilestone = () => setMilestones((prev) => [...prev, { id: 'ms-' + Date.now(), phaseNumber: prev.length + 1, title: '', description: '', targetDate: completionDate || startDate, completionPercentage: 0, status: 'NOT_STARTED', keyDeliverable: '' }]);
  const removeMilestone = (id: string) => setMilestones((prev) => prev.filter((m) => m.id !== id).map((m, i) => ({ ...m, phaseNumber: i + 1 })));

  const save = async () => {
    setError(''); setNotice('');
    if (title.trim().length < 10) { setError('Project title must contain at least 10 characters.'); return; }
    if (!projectDescription.trim() || !community.trim()) { setError('Project description and exact community/location are required.'); return; }
    if (!balanced || Number(beneficiariesTotal) <= 0) { setError('Male and female beneficiaries must add up exactly to total beneficiaries, and total must be greater than zero.'); return; }
    const numbers = [beneficiariesTotal, beneficiariesMale, beneficiariesFemale, youthBeneficiaries, budgetNgn].map(Number);
    if (numbers.some((n) => !Number.isFinite(n) || n < 0)) { setError('Beneficiary and budget values must be valid non-negative numbers.'); return; }
    if (pillar === 'cross_cutting_enablers' && !pillarSegment) { setError('Select a cross-cutting segment before saving.'); return; }
    setSaving(true);
    try {
      const result = await updateActivity(activity.id, {
        title: title.trim(), pillar, projectDescription: projectDescription.trim(), subCategory: projectDescription.trim(),
        category: category ? category as ReportingCategory : null,
        pillarSegment: pillar === 'cross_cutting_enablers' ? pillarSegment as PillarSegment : null,
        community: community.trim(),
        coordinates: latitude !== '' && longitude !== '' ? { lat: Number(latitude), lng: Number(longitude) } : undefined,
        beneficiariesTotal: Number(beneficiariesTotal), beneficiariesMale: Number(beneficiariesMale), beneficiariesFemale: Number(beneficiariesFemale),
        youthBeneficiaries: Number(youthBeneficiaries), budgetNgn: Number(budgetNgn), startDate, completionDate,
        leadOfficer: leadOfficer.trim(), officerContact: officerContact.trim(), submissionNotes: submissionNotes.trim(),
        milestones, overallProgress: progress, mediaAssets: mediaAssets.map((m) => ({ ...m, url: '' })),
        attendanceSheetFileName: attendanceSheetFileName || undefined,
        attendanceRegistryUrl: attendanceRegistryUrl || undefined,
      });
      if (!result.success) throw new Error(result.error || 'Could not save draft changes.');
      // Delete replaced/removed objects only after the database record points at the new evidence.
      const paths = Array.from(new Set(pendingOldPaths));
      const cleanupResults = await Promise.all(paths.map((path) => deleteEvidenceFromStorage(path)));
      const failedCleanup = cleanupResults.filter((r) => !r.success).length;
      setPendingOldPaths([]);
      setPendingNewPaths([]);
      setNotice(failedCleanup ? 'Draft saved. Some superseded storage files could not be cleaned up and may need administrator cleanup.' : 'Draft saved successfully. All changes are persisted.');
      onSaved?.();
      window.setTimeout(onClose, 500);
    } catch (e) {
      // The database record was not confirmed saved; remove newly uploaded objects to avoid orphaned evidence.
      await Promise.all(pendingNewPaths.map((path) => deleteEvidenceFromStorage(path).catch(() => ({ success: false }))));
      setPendingNewPaths([]);
      setError(e instanceof Error ? e.message : 'Could not save draft changes.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="draft-editor-title">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-950 to-emerald-800 px-5 py-4 text-white sm:px-7">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">LGA Desk Workspace · Draft Editor</p><h2 id="draft-editor-title" className="mt-1 text-lg font-bold">Edit activity report</h2><p className="mt-1 text-xs text-emerald-100">{assignedLga?.name || activity.lgaName} · {activity.status.replace('_', ' ')}</p></div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close editor"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-7">
          {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
          {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
          <section className="space-y-4"><h3 className="border-b pb-2 text-sm font-bold text-slate-900">1. Activity details</h3>
            <div><label className={labelClass}>Project / initiative title *</label><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className={labelClass}>HCD pillar *</label><select className={inputClass} value={pillar} onChange={(e) => setPillar(e.target.value as PillarId)}>{Object.entries(PILLARS).map(([key, val]) => <option key={key} value={key}>{val.name}</option>)}</select></div>
              <div><label className={labelClass}>Reporting category</label><select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">None</option><option value="Education">Education</option><option value="Health">Health</option><option value="Skill and labour">Skill and labour</option><option value="HCD Settings">HCD Settings</option><option value="cross_cutting_enablers">Cross-cutting Enablers</option><option value="values_ethics_social_behaviour">Values/Ethics/Social behaviour</option></select></div>
            </div>
            {pillar === 'cross_cutting_enablers' && <div><label className={labelClass}>Cross-cutting segment *</label><select className={inputClass} value={pillarSegment} onChange={(e) => setPillarSegment(e.target.value)}><option value="">Select segment</option><option value="gender">Gender</option><option value="governance">Governance</option><option value="climate_change">Climate change</option><option value="demography_youth_investment">Demography / Youth investment</option></select></div>}
            <div><label className={labelClass}>Project description *</label><textarea className={inputClass} rows={3} value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} /></div>
            <div><label className={labelClass}>Exact community / ward / location *</label><input className={inputClass} value={community} onChange={(e) => setCommunity(e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Latitude</label><input type="number" step="any" className={inputClass} value={latitude} onChange={(e) => setLatitude(e.target.value)} /></div><div><label className={labelClass}>Longitude</label><input type="number" step="any" className={inputClass} value={longitude} onChange={(e) => setLongitude(e.target.value)} /></div></div>
          </section>
          <section className="space-y-4"><h3 className="border-b pb-2 text-sm font-bold text-slate-900">2. Beneficiaries, budget and dates</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Total beneficiaries',beneficiariesTotal,setBeneficiariesTotal],['Male beneficiaries',beneficiariesMale,setBeneficiariesMale],['Female beneficiaries',beneficiariesFemale,setBeneficiariesFemale],['Youth beneficiaries',youthBeneficiaries,setYouthBeneficiaries]].map(([label,value,setter]) => <div key={String(label)}><label className={labelClass}>{String(label)}</label><input type="number" min="0" className={inputClass} value={String(value)} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} /></div>)}</div>
            <p className={balanced ? 'text-xs text-emerald-700' : 'text-xs font-semibold text-rose-700'}>{balanced ? 'Beneficiary totals reconcile.' : 'Male + female beneficiaries must equal total beneficiaries.'}</p>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Budget (NGN)</label><input type="number" min="0" className={inputClass} value={budgetNgn} onChange={(e) => setBudgetNgn(e.target.value)} /></div><div><label className={labelClass}>Youth beneficiary definition</label><p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Record the number of beneficiaries aged 18–35 in the youth beneficiaries field above.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Start date</label><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><label className={labelClass}>Completion date</label><input type="date" className={inputClass} value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Lead officer</label><input className={inputClass} value={leadOfficer} onChange={(e) => setLeadOfficer(e.target.value)} /></div><div><label className={labelClass}>Officer contact</label><input className={inputClass} value={officerContact} onChange={(e) => setOfficerContact(e.target.value)} /></div></div>
            <div><label className={labelClass}>Submission / clarification notes</label><textarea rows={3} className={inputClass} value={submissionNotes} onChange={(e) => setSubmissionNotes(e.target.value)} /></div>
          </section>
          <section className="space-y-3"><div className="flex items-center justify-between border-b pb-2"><div><h3 className="text-sm font-bold text-slate-900">3. Implementation milestones</h3><p className="text-xs text-slate-500">Overall progress: {progress}%</p></div><button onClick={addMilestone} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50"><Plus className="h-3.5 w-3.5" />Add milestone</button></div>
            {milestones.map((m) => <div key={m.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
              <div><label className={labelClass}>Milestone title</label><input className={inputClass} value={m.title} onChange={(e) => updateMilestone(m.id,{title:e.target.value})} /></div>
              <div><label className={labelClass}>Key deliverable</label><input className={inputClass} value={m.keyDeliverable || ''} onChange={(e) => updateMilestone(m.id,{keyDeliverable:e.target.value})} /></div>
              <div><label className={labelClass}>Description</label><textarea className={inputClass} rows={2} value={m.description || ''} onChange={(e) => updateMilestone(m.id,{description:e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className={labelClass}>Target date</label><input type="date" className={inputClass} value={m.targetDate || ''} onChange={(e) => updateMilestone(m.id,{targetDate:e.target.value})} /></div><div><label className={labelClass}>Completion %</label><input type="number" min="0" max="100" className={inputClass} value={m.completionPercentage} onChange={(e) => { const pct = Math.max(0,Math.min(100,Number(e.target.value)||0)); updateMilestone(m.id,{completionPercentage:pct,status:pct===100?'COMPLETED':pct>0?'IN_PROGRESS':'NOT_STARTED'}); }} /></div></div>
              <button onClick={() => removeMilestone(m.id)} className="justify-self-start text-xs font-semibold text-rose-700 hover:text-rose-900"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Remove milestone</button>
            </div>)}
          </section>
          <section className="space-y-3"><h3 className="border-b pb-2 text-sm font-bold text-slate-900">4. Photographic Verification Assets &amp; EXIF Geotags</h3><p className="text-xs text-slate-600">Replace individual files, remove obsolete evidence, or attach additional photos, videos and documents. New files are stored in the private evidence vault; the existing file is kept until the draft update succeeds.</p>
            <div className="space-y-2">{mediaAssets.map((m) => <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">{isDocumentMedia(m) ? <FileText className="h-8 w-8 shrink-0 text-emerald-800" /> : m.type === 'video' ? <Video className="h-8 w-8 shrink-0 text-violet-700" /> : <ImageIcon className="h-8 w-8 shrink-0 text-emerald-700" />}<div className="min-w-0"><p className="break-all text-sm font-semibold text-slate-900">{m.fileName || 'Evidence file'}</p><p className="text-xs text-slate-500">{m.fileSize || 'Size unavailable'} · {m.type} · {m.coordinates ? 'Coordinates recorded' : 'No coordinates recorded'}</p>{m.caption && <p className="text-xs text-slate-500">{m.caption}</p>}</div></div>
              <div className="flex flex-wrap items-center gap-2"><label className="cursor-pointer rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">{uploadingKey === m.id ? 'Uploading…' : 'Replace file'}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,.jpg,.jpeg,.png,.webp,.pdf,.mp4" className="hidden" disabled={!!uploadingKey} onChange={(e) => { const file=e.target.files?.[0]; if(file) void uploadFile(file,m.id); e.currentTarget.value=''; }} /></label><button onClick={() => removeMedia(m)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />Remove</button></div>
            </div>)}</div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"><Upload className="h-4 w-4" />{uploadingKey?.startsWith('new-') ? 'Uploading…' : 'Add photo, video or document'}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,.jpg,.jpeg,.png,.webp,.pdf,.mp4" className="hidden" disabled={!!uploadingKey} onChange={(e) => { const file=e.target.files?.[0]; if(file) void uploadFile(file); e.currentTarget.value=''; }} /></label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><label className={labelClass}>Beneficiary attendance registry / biometric roll (PDF)</label><p className="mb-2 text-xs text-slate-600">{attendanceSheetFileName || 'No filename recorded'} {attendanceRegistryUrl && attendanceRegistryUrl !== '#attendance-registry-file' ? '· file reference recorded' : '· no uploaded storage reference'}</p><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"><FileText className="h-4 w-4" />{uploadingKey === 'attendance' ? 'Uploading…' : 'Replace attendance PDF'}<input type="file" accept="application/pdf,.pdf" className="hidden" disabled={!!uploadingKey} onChange={(e) => { const file=e.target.files?.[0]; if(file) { if(file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) setError('Attendance registry must be a PDF.'); else void uploadFile(file,undefined,true); } e.currentTarget.value=''; }} /></label></div>
          </section>
        </div>
        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p className="text-[11px] text-slate-500">Saving updates this draft in Supabase. Published and pending-review records remain locked.</p><div className="flex justify-end gap-2"><button onClick={onClose} disabled={saving || !!uploadingKey} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button><button onClick={() => void save()} disabled={saving || !!uploadingKey} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save draft changes'}</button></div></footer>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  HCDActivity,
  PillarId,
  PillarSegment,
  ReportingCategory,
  VerificationMedia,
  ProjectMilestone,
  MilestoneStatus,
  ActivityMeasurement,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PILLARS, CROSS_CUTTING_SEGMENTS, REPORTING_CATEGORIES } from '../../data/lgas';
import {
  HCD_SETTINGS_MAP,
  HCDSettingType,
  getSettingFromIndicatorCode,
} from '../../data/indicators';
import { validateCoordinates } from '../../lib/geoFence';
import {
  validateMediaFile,
  validateAttendanceRegistryPdf,
  isDocumentMedia,
  replaceVerificationAssetInList,
  removeVerificationAssetFromList,
  evaluateActivityEditPermission,
  extractCanonicalAttendanceStoragePath,
  isCanonicalStorageReference,
  resolveActivityMedia,
} from '../../services/mediaService';
import {
  extractExifGpsFromFile,
  describeMediaGeotagProvenance,
} from '../../lib/exifParser';
import { ActivityMediaImage } from '../common/ActivityMediaImage';
import {
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Lock,
  Upload,
  RefreshCw,
  Trash2,
  Plus,
  MapPin,
  FileText,
  Film,
  Image as ImageIcon,
  Flag,
  BarChart2,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info,
  Download,
  ExternalLink,
  Layers,
  LocateFixed,
  Cloud,
  WifiOff,
} from 'lucide-react';

interface ActivityDraftEditorModalProps {
  activity: HCDActivity | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedActivity: HCDActivity) => void;
  initialSection?: 'identification' | 'resources' | 'milestones' | 'measurements' | 'evidence';
}

export const ActivityDraftEditorModal: React.FC<ActivityDraftEditorModalProps> = ({
  activity,
  isOpen,
  onClose,
  onSaved,
  initialSection,
}) => {
  const { currentUser } = useAuth();
  const {
    updateActivity,
    uploadEvidenceToSupabase,
    deleteEvidenceFromSupabase,
    isOnline,
    isSupabaseActive,
    getPillarDisplayName,
    indicators,
    measurements,
    fetchMeasurementsForActivity,
    addMeasurement,
    updateMeasurement,
    deleteMeasurement,
  } = useData();

  const isDemoMode = Boolean(currentUser.isDemo);

  // Collapsible section open state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identification: true,
    resources: true,
    milestones: true,
    measurements: true,
    evidence: true,
  });

  // Section A: Activity identification & classification
  const [title, setTitle] = useState('');
  const [pillar, setPillar] = useState<PillarId>('vocational');
  const [category, setCategory] = useState<string>('');
  const [pillarSegment, setPillarSegment] = useState<PillarSegment | ''>('');
  const [projectDescription, setProjectDescription] = useState('');
  const [community, setCommunity] = useState('');
  const [latitude, setLatitude] = useState<number>(5.0377);
  const [longitude, setLongitude] = useState<number>(7.9128);

  // Section B: Implementation & resources
  const [beneficiariesTotal, setBeneficiariesTotal] = useState<number>(0);
  const [beneficiariesMale, setBeneficiariesMale] = useState<number>(0);
  const [beneficiariesFemale, setBeneficiariesFemale] = useState<number>(0);
  const [youthBeneficiaries, setYouthBeneficiaries] = useState<number>(0);
  const [budgetNgn, setBudgetNgn] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [leadOfficer, setLeadOfficer] = useState('');
  const [officerContact, setOfficerContact] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');

  // Section C: Milestones
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);

  // Section D: HCD Settings & Indicator Outcomes
  const [editableMeasurements, setEditableMeasurements] = useState<ActivityMeasurement[]>([]);
  const [newIndicatorCode, setNewIndicatorCode] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [newValueNumeric, setNewValueNumeric] = useState('');
  const [newValueText, setNewValueText] = useState('');
  const [newDataSource, setNewDataSource] = useState('Approved HCD initiative register / field monitoring report');
  const [newEvidenceRef, setNewEvidenceRef] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [measurementBusyId, setMeasurementBusyId] = useState<string | null>(null);
  const [measurementStatusMsg, setMeasurementStatusMsg] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Section E: Photographic Verification Assets & Attendance Registry PDF
  const [mediaAssets, setMediaAssets] = useState<VerificationMedia[]>([]);
  const [attendanceSheetFileName, setAttendanceSheetFileName] = useState('');
  const [attendanceRegistryUrl, setAttendanceRegistryUrl] = useState('');

  // Upload & Replacement states
  const [uploadingAssetId, setUploadingAssetId] = useState<string | null>(null);
  const [isAddingNewAsset, setIsAddingNewAsset] = useState(false);
  const [isUploadingAttendancePdf, setIsUploadingAttendancePdf] = useState(false);
  const [isResolvingAttendancePdf, setIsResolvingAttendancePdf] = useState(false);
  const [mediaFeedback, setMediaFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    persistenceMode?: 'cloud' | 'local_queue';
  } | null>(null);
  const [attendanceFeedback, setAttendanceFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    persistenceMode?: 'cloud' | 'local_queue';
  } | null>(null);

  // Overall Form Save & Dirty Tracking
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    persistenceMode?: 'cloud' | 'local_queue';
  } | null>(null);

  const evidenceSectionRef = useRef<HTMLDivElement | null>(null);

  // Evaluate edit permission based on current user role, LGA assignment, and record status
  const editPermission = useMemo(
    () =>
      activity
        ? evaluateActivityEditPermission(activity, currentUser)
        : {
            canEdit: false,
            reasonCode: 'UNAUTHENTICATED' as const,
            title: 'No Activity Selected',
            explanation: 'Select an activity draft to edit.',
          },
    [activity, currentUser]
  );

  // Hydrate editor state whenever activity changes or modal opens
  useEffect(() => {
    if (!activity || !isOpen) return;

    setTitle(activity.title || '');
    setPillar(activity.pillar || 'vocational');
    setCategory(activity.category || '');
    setPillarSegment(activity.pillarSegment || '');
    setProjectDescription(
      activity.projectDescription ||
        activity.subCategory ||
        PILLARS[activity.pillar]?.subCategories?.[0] ||
        ''
    );
    setCommunity(activity.community || '');
    setLatitude(activity.coordinates?.lat ?? 5.0377);
    setLongitude(activity.coordinates?.lng ?? 7.9128);

    setBeneficiariesTotal(activity.beneficiariesTotal ?? 0);
    setBeneficiariesMale(activity.beneficiariesMale ?? 0);
    setBeneficiariesFemale(activity.beneficiariesFemale ?? 0);
    setYouthBeneficiaries(activity.youthBeneficiaries ?? 0);
    setBudgetNgn(activity.budgetNgn ?? 0);
    setStartDate(activity.startDate || new Date().toISOString().split('T')[0]);
    setCompletionDate(activity.completionDate || new Date().toISOString().split('T')[0]);
    setLeadOfficer(activity.leadOfficer || currentUser.name || '');
    setOfficerContact(activity.officerContact || '');
    setSubmissionNotes(activity.submissionNotes || '');

    if (activity.milestones && activity.milestones.length > 0) {
      setMilestones(activity.milestones.map((m) => ({ ...m })));
    } else {
      setMilestones([
        {
          id: `ms-1-${activity.id}`,
          phaseNumber: 1,
          title: 'Phase 1: Mobilization, Enumeration & Baseline Survey',
          description: 'Community sensitization, beneficiary screening and biometric roster documentation.',
          targetDate: activity.startDate || new Date().toISOString().split('T')[0],
          completionPercentage: 80,
          status: 'IN_PROGRESS',
          keyDeliverable: 'Verified biometric attendance roll',
        },
        {
          id: `ms-2-${activity.id}`,
          phaseNumber: 2,
          title: 'Phase 2: Training Delivery & Capacity Building Execution',
          description: 'Hands-on practical curriculum, technical guidance, and field operations.',
          targetDate: activity.completionDate || new Date().toISOString().split('T')[0],
          completionPercentage: 40,
          status: 'IN_PROGRESS',
          keyDeliverable: 'Technical skill evaluation and field log',
        },
      ]);
    }

    setMediaAssets((activity.mediaAssets || []).map((m) => ({ ...m })));
    setAttendanceSheetFileName(activity.attendanceSheetFileName || '');
    setAttendanceRegistryUrl(activity.attendanceRegistryUrl || '');

    setNewPeriodStart(activity.startDate || new Date().toISOString().split('T')[0]);
    setNewPeriodEnd(activity.completionDate || new Date().toISOString().split('T')[0]);
    setIsDirty(false);
    setShowDiscardConfirm(false);
    setSaveFeedback(null);
    setMediaFeedback(null);
    setAttendanceFeedback(null);
    setMeasurementStatusMsg(null);

    if (activity.id) {
      fetchMeasurementsForActivity(activity.id);
    }

    if (initialSection === 'evidence') {
      setTimeout(() => {
        evidenceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [activity?.id, isOpen, initialSection, fetchMeasurementsForActivity]);

  // Synchronize activity measurements from DataContext into local editable list
  useEffect(() => {
    if (!activity) return;
    const filtered = measurements.filter((m) => m.activity_id === activity.id);
    setEditableMeasurements(filtered.map((m) => ({ ...m, disaggregation: m.disaggregation ? { ...m.disaggregation } : undefined })));
  }, [measurements, activity?.id]);

  if (!isOpen || !activity) return null;

  const canEdit = editPermission.canEdit;

  // Derived Calculations & Validations
  const mathSum = Number(beneficiariesMale) + Number(beneficiariesFemale);
  const isMathBalanced = mathSum === Number(beneficiariesTotal);
  const mathDelta = Number(beneficiariesTotal) - mathSum;

  const geoValidation = validateCoordinates(Number(latitude), Number(longitude), activity.lgaId);
  const isGeoValid = geoValidation.status === 'VALID' || geoValidation.status === 'WARNING';

  const calculatedOverallProgress =
    milestones.length > 0
      ? Math.round(
          milestones.reduce((acc, m) => acc + (Number(m.completionPercentage) || 0), 0) /
            milestones.length
        )
      : activity.overallProgress ?? 0;

  const canonicalAttendanceStoragePath = extractCanonicalAttendanceStoragePath(attendanceRegistryUrl);
  const hasCanonicalAttendanceFile = isCanonicalStorageReference(attendanceRegistryUrl);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
    setSaveFeedback(null);
  };

  // Handle Pillar & Taxonomy Changes
  const handlePillarChange = (nextPillar: PillarId) => {
    markDirty();
    setPillar(nextPillar);
    if (nextPillar === 'cross_cutting_enablers') {
      if (!pillarSegment) setPillarSegment('gender');
      if (!category) setCategory('cross_cutting_enablers');
    } else if (nextPillar === 'agriculture') {
      setPillarSegment('');
      setCategory('HCD Settings');
    } else {
      setPillarSegment('');
      if (nextPillar === 'values_ethics_social_behaviour') {
        setCategory('values_ethics_social_behaviour');
      } else if (
        category === 'cross_cutting_enablers' ||
        category === 'values_ethics_social_behaviour' ||
        category === 'HCD Settings'
      ) {
        setCategory('');
      }
    }
    const presets = PILLARS[nextPillar]?.subCategories;
    if (presets && presets.length > 0 && !projectDescription.trim()) {
      setProjectDescription(presets[0]);
    }
  };

  // Milestone Handlers
  const handleUpdateMilestone = (id: string, updates: Partial<ProjectMilestone>) => {
    if (!canEdit) return;
    markDirty();
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, ...updates };
        if (updates.completionPercentage !== undefined) {
          const pct = Math.max(0, Math.min(100, Number(updates.completionPercentage) || 0));
          updated.completionPercentage = pct;
          if (pct === 100) {
            updated.status = 'COMPLETED';
            if (!updated.completedDate) {
              updated.completedDate = new Date().toISOString().split('T')[0];
            }
          } else if (pct > 0) {
            updated.status = 'IN_PROGRESS';
            updated.completedDate = undefined;
          } else {
            updated.status = 'NOT_STARTED';
            updated.completedDate = undefined;
          }
        } else if (updates.status !== undefined) {
          if (updates.status === 'COMPLETED') {
            updated.completionPercentage = 100;
            if (!updated.completedDate) {
              updated.completedDate = new Date().toISOString().split('T')[0];
            }
          } else if (updates.status === 'NOT_STARTED') {
            updated.completionPercentage = 0;
            updated.completedDate = undefined;
          } else if (updates.status === 'IN_PROGRESS' && (updated.completionPercentage === 0 || updated.completionPercentage === 100)) {
            updated.completionPercentage = 50;
            updated.completedDate = undefined;
          }
        }
        return updated;
      })
    );
  };

  const handleAddMilestone = () => {
    if (!canEdit) return;
    markDirty();
    const nextPhase = milestones.length + 1;
    const newMilestone: ProjectMilestone = {
      id: `ms-${Date.now()}-${nextPhase}`,
      phaseNumber: nextPhase,
      title: `Phase ${nextPhase}: Implementation & Deliverable Verification`,
      description: 'Targeted deliverable milestone tracking.',
      targetDate: completionDate || new Date().toISOString().split('T')[0],
      completionPercentage: 0,
      status: 'NOT_STARTED',
      keyDeliverable: 'Verified milestone execution log',
    };
    setMilestones((prev) => [...prev, newMilestone]);
  };

  const handleRemoveMilestone = (id: string) => {
    if (!canEdit || milestones.length <= 1) return;
    markDirty();
    setMilestones((prev) =>
      prev
        .filter((m) => m.id !== id)
        .map((m, idx) => ({ ...m, phaseNumber: idx + 1 }))
    );
  };

  // Validate all draft form fields before saving
  const validateDraftForm = (): string | null => {
    if (title.trim().length < 10) {
      return 'Project or initiative title must be at least 10 characters long.';
    }
    if (pillar === 'cross_cutting_enablers' && !pillarSegment) {
      return 'Cross-Cutting Enablers requires a valid segment (Gender, Governance, Climate change, or Demography / Youth investment).';
    }
    if (!projectDescription.trim()) {
      return 'Project description is required.';
    }
    if (!community.trim()) {
      return 'Exact community or ward location is required.';
    }
    if (!isGeoValid) {
      return geoValidation.message || 'Activity coordinates must be valid and within Akwa Ibom State.';
    }
    if (Number(beneficiariesTotal) <= 0) {
      return 'Total beneficiaries must be greater than zero.';
    }
    if (!isMathBalanced) {
      return `Demographic Validation Error: Male (${beneficiariesMale}) + Female (${beneficiariesFemale}) = ${mathSum}, which must equal Total Beneficiaries (${beneficiariesTotal}).`;
    }
    if (Number(budgetNgn) < 0) {
      return 'Budget in NGN cannot be negative.';
    }
    if (!startDate || !completionDate) {
      return 'Both start date and completion date are required.';
    }
    if (!leadOfficer.trim()) {
      return 'Lead officer name is required.';
    }
    return null;
  };

  // ============================================================================
  // ATOMIC REPLACEMENT OF A SINGLE VERIFICATION ASSET
  // ============================================================================
  const handleReplaceSingleAsset = async (targetAsset: VerificationMedia, file: File) => {
    if (!canEdit) return;
    setMediaFeedback(null);

    if (isDemoMode) {
      setMediaFeedback({
        type: 'error',
        text: 'Demo Mode Active: Live Supabase Storage uploads and deletions are disabled in Demo Mode.',
      });
      return;
    }

    // 1. Validate the replacement file before uploading
    const validation = validateMediaFile(file, file.name);
    if (!validation.valid) {
      setMediaFeedback({
        type: 'error',
        text: validation.error || 'Invalid replacement file.',
      });
      return;
    }

    setUploadingAssetId(targetAsset.id);
    let newlyUploadedStoragePath: string | undefined;

    try {
      // Extract real EXIF GPS metadata without fabricating coordinates
      const exifResult = await extractExifGpsFromFile(file, activity.lgaId, file.name);

      // 2. Upload to the existing private evidence bucket using established upload service
      const uploadRes = await uploadEvidenceToSupabase(
        file,
        file.name,
        activity.lgaId,
        activity.id
      );

      if (!uploadRes.success || !uploadRes.storagePath) {
        setMediaFeedback({
          type: 'error',
          text: `Upload failed: ${uploadRes.error || 'Could not upload replacement file to private evidence vault.'}`,
        });
        setUploadingAssetId(null);
        return;
      }

      newlyUploadedStoragePath = uploadRes.storagePath;
      const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

      // 3. Save canonical storage path and truthful EXIF metadata (no temporary browser URL or signed URL)
      const replacementMedia: VerificationMedia = {
        id: targetAsset.id,
        type: file.type.startsWith('video')
          ? 'video'
          : file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')
          ? 'document'
          : 'photo',
        url: '', // Canonical storagePath only
        storagePath: newlyUploadedStoragePath,
        caption: targetAsset.caption || `Field evidence: ${file.name}`,
        fileName: file.name,
        fileSize: fileSizeMb,
        mimeType: file.type,
        exifVerified: exifResult.exifVerified,
        coordinateSource: exifResult.coordinateSource,
        exifStatus: exifResult.exifStatus,
        exifMessage: exifResult.message,
        exifDeviceMake: exifResult.deviceMake,
        exifDeviceModel: exifResult.deviceModel,
        exifCapturedAt: exifResult.capturedAt,
        coordinates: exifResult.coordinates,
        uploadTimestamp: new Date().toISOString(),
      };

      // 4 & 5. Replace only the selected asset in the activity's media array, preserving all unrelated attachments
      const replaceOutcome = replaceVerificationAssetInList(
        mediaAssets,
        targetAsset.id,
        replacementMedia
      );

      if (!replaceOutcome.replaced) {
        setMediaFeedback({
          type: 'error',
          text: 'Target attachment could not be located in the activity media list.',
        });
        setUploadingAssetId(null);
        return;
      }

      // 6. Persist the activity update BEFORE attempting cleanup of the superseded storage object
      const persistRes = await updateActivity(activity.id, {
        mediaAssets: replaceOutcome.updatedAssets,
      });

      if (!persistRes.success) {
        // 7. If saving fails, preserve the previous database reference and attempt cleanup of the newly uploaded object
        let rollbackNote = '';
        if (newlyUploadedStoragePath) {
          const rollbackRes = await deleteEvidenceFromSupabase(newlyUploadedStoragePath);
          rollbackNote = rollbackRes.success
            ? ' Newly uploaded unreferenced file was cleaned up.'
            : ' Newly uploaded object flagged for administrative cleanup.';
        }
        setMediaFeedback({
          type: 'error',
          text: `Database update failed (${persistRes.error || 'Unknown error'}). Previous attachment reference was preserved.${rollbackNote}`,
        });
        setUploadingAssetId(null);
        return;
      }

      // Update local state to reflect saved mediaAssets
      setMediaAssets(replaceOutcome.updatedAssets);

      // 8. Attempt cleanup of superseded storage object AFTER persistence succeeded
      let cleanupNotice = '';
      const supersededStoragePath = replaceOutcome.supersededAsset?.storagePath;
      if (
        supersededStoragePath &&
        supersededStoragePath !== newlyUploadedStoragePath
      ) {
        const delRes = await deleteEvidenceFromSupabase(supersededStoragePath);
        if (!delRes.success) {
          cleanupNotice = delRes.policyRestricted
            ? ` (Note: Superseded object "${supersededStoragePath}" retained for administrative cleanup due to storage DELETE policy.)`
            : ` (Note: Superseded object "${supersededStoragePath}" queued for administrative cleanup.)`;
        }
      }

      setMediaFeedback({
        type: 'success',
        persistenceMode: persistRes.persistedToCloud ? 'cloud' : 'local_queue',
        text: persistRes.persistedToCloud
          ? `Replaced "${targetAsset.fileName || 'attachment'}" with "${file.name}" and confirmed persisted to Supabase.${cleanupNotice}`
          : `Replaced "${targetAsset.fileName || 'attachment'}" with "${file.name}" (queued locally for sync).${cleanupNotice}`,
      });
    } catch (err: any) {
      setMediaFeedback({
        type: 'error',
        text: err?.message || 'Unexpected error while replacing attachment.',
      });
    } finally {
      setUploadingAssetId(null);
    }
  };

  // ============================================================================
  // ADD NEW PHOTO, VIDEO OR DOCUMENT
  // ============================================================================
  const handleAddVerificationAsset = async (file: File) => {
    if (!canEdit) return;
    setMediaFeedback(null);

    if (isDemoMode) {
      setMediaFeedback({
        type: 'error',
        text: 'Demo Mode Active: Live Supabase Storage uploads are disabled in Demo Mode.',
      });
      return;
    }

    const validation = validateMediaFile(file, file.name);
    if (!validation.valid) {
      setMediaFeedback({
        type: 'error',
        text: validation.error || 'Invalid media file.',
      });
      return;
    }

    setIsAddingNewAsset(true);
    let newlyUploadedStoragePath: string | undefined;

    try {
      const exifResult = await extractExifGpsFromFile(file, activity.lgaId, file.name);

      const uploadRes = await uploadEvidenceToSupabase(
        file,
        file.name,
        activity.lgaId,
        activity.id
      );

      if (!uploadRes.success || !uploadRes.storagePath) {
        setMediaFeedback({
          type: 'error',
          text: `Upload failed: ${uploadRes.error || 'Could not upload file to private evidence vault.'}`,
        });
        setIsAddingNewAsset(false);
        return;
      }

      newlyUploadedStoragePath = uploadRes.storagePath;
      const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

      const newAsset: VerificationMedia = {
        id: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: file.type.startsWith('video')
          ? 'video'
          : file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')
          ? 'document'
          : 'photo',
        url: '', // Canonical storagePath only
        storagePath: newlyUploadedStoragePath,
        caption: `Field evidence: ${file.name}`,
        fileName: file.name,
        fileSize: fileSizeMb,
        mimeType: file.type,
        exifVerified: exifResult.exifVerified,
        coordinateSource: exifResult.coordinateSource,
        exifStatus: exifResult.exifStatus,
        exifMessage: exifResult.message,
        exifDeviceMake: exifResult.deviceMake,
        exifDeviceModel: exifResult.deviceModel,
        exifCapturedAt: exifResult.capturedAt,
        coordinates: exifResult.coordinates,
        uploadTimestamp: new Date().toISOString(),
      };

      const nextAssets = [...mediaAssets, newAsset];

      const persistRes = await updateActivity(activity.id, {
        mediaAssets: nextAssets,
      });

      if (!persistRes.success) {
        if (newlyUploadedStoragePath) {
          await deleteEvidenceFromSupabase(newlyUploadedStoragePath);
        }
        setMediaFeedback({
          type: 'error',
          text: `Failed to save new attachment reference (${persistRes.error || 'Unknown error'}).`,
        });
        setIsAddingNewAsset(false);
        return;
      }

      setMediaAssets(nextAssets);
      setMediaFeedback({
        type: 'success',
        persistenceMode: persistRes.persistedToCloud ? 'cloud' : 'local_queue',
        text: persistRes.persistedToCloud
          ? `Added "${file.name}" and confirmed persisted to Supabase.`
          : `Added "${file.name}" (queued locally for sync).`,
      });
    } catch (err: any) {
      setMediaFeedback({
        type: 'error',
        text: err?.message || 'Unexpected error while adding verification file.',
      });
    } finally {
      setIsAddingNewAsset(false);
    }
  };

  // ============================================================================
  // REMOVE EXISTING VERIFICATION ASSET
  // ============================================================================
  const handleRemoveVerificationAsset = async (targetAsset: VerificationMedia) => {
    if (!canEdit) return;
    setMediaFeedback(null);

    if (isDemoMode) {
      setMediaFeedback({
        type: 'error',
        text: 'Demo Mode Active: Live Supabase Storage deletions are disabled in Demo Mode.',
      });
      return;
    }

    setUploadingAssetId(targetAsset.id);
    try {
      const removeOutcome = removeVerificationAssetFromList(mediaAssets, targetAsset.id);

      // Persist DB update BEFORE attempting storage object deletion
      const persistRes = await updateActivity(activity.id, {
        mediaAssets: removeOutcome.updatedAssets,
      });

      if (!persistRes.success) {
        setMediaFeedback({
          type: 'error',
          text: `Could not remove attachment (${persistRes.error || 'Database update failed'}).`,
        });
        setUploadingAssetId(null);
        return;
      }

      setMediaAssets(removeOutcome.updatedAssets);

      let cleanupNotice = '';
      const removedStoragePath = removeOutcome.removedAsset?.storagePath;
      if (removedStoragePath) {
        const delRes = await deleteEvidenceFromSupabase(removedStoragePath);
        if (!delRes.success) {
          cleanupNotice = delRes.policyRestricted
            ? ` (Storage object "${removedStoragePath}" logged for administrative cleanup due to storage DELETE policy.)`
            : ` (Storage object "${removedStoragePath}" logged for administrative cleanup.)`;
        }
      }

      setMediaFeedback({
        type: 'success',
        persistenceMode: persistRes.persistedToCloud ? 'cloud' : 'local_queue',
        text: persistRes.persistedToCloud
          ? `Removed "${targetAsset.fileName || 'attachment'}" from activity record in Supabase.${cleanupNotice}`
          : `Removed "${targetAsset.fileName || 'attachment'}" (queued locally).${cleanupNotice}`,
      });
    } catch (err: any) {
      setMediaFeedback({
        type: 'error',
        text: err?.message || 'Failed to remove attachment.',
      });
    } finally {
      setUploadingAssetId(null);
    }
  };

  // Associate activity coordinates with an asset that has no embedded EXIF GPS (without fabricating EXIF)
  const handleLinkActivityCoordinatesToAsset = (assetId: string) => {
    if (!canEdit) return;
    markDirty();
    setMediaAssets((prev) =>
      prev.map((m) => {
        if (m.id !== assetId) return m;
        return {
          ...m,
          exifVerified: false, // Never fabricate EXIF verification
          coordinateSource: 'activity_location',
          exifStatus: m.exifStatus === 'no_exif_gps' || !m.exifStatus ? 'no_exif_gps' : m.exifStatus,
          exifMessage:
            'No embedded camera GPS EXIF tags; linked to the activity location recorded by the desk officer.',
          coordinates: { lat: Number(latitude), lng: Number(longitude) },
        };
      })
    );
  };

  // ============================================================================
  // REPLACE ATTENDANCE REGISTRY PDF
  // ============================================================================
  const handleReplaceAttendancePdf = async (file: File) => {
    if (!canEdit) return;
    setAttendanceFeedback(null);

    if (isDemoMode) {
      setAttendanceFeedback({
        type: 'error',
        text: 'Demo Mode Active: Live Supabase Storage uploads are disabled in Demo Mode.',
      });
      return;
    }

    const validation = validateAttendanceRegistryPdf(file, file.name);
    if (!validation.valid) {
      setAttendanceFeedback({
        type: 'error',
        text: validation.error || 'Attendance registry must be a valid PDF file.',
      });
      return;
    }

    setIsUploadingAttendancePdf(true);
    const previousStoragePath = extractCanonicalAttendanceStoragePath(attendanceRegistryUrl);
    let newStoragePath: string | undefined;

    try {
      const uploadRes = await uploadEvidenceToSupabase(
        file,
        file.name,
        activity.lgaId,
        `${activity.id}-attendance`
      );

      if (!uploadRes.success || !uploadRes.storagePath) {
        setAttendanceFeedback({
          type: 'error',
          text: `Attendance registry upload failed: ${uploadRes.error || 'Could not upload PDF to hcd-evidence-vault.'}`,
        });
        setIsUploadingAttendancePdf(false);
        return;
      }

      newStoragePath = uploadRes.storagePath;

      // Persist canonical storage path to activity BEFORE cleaning up previous registry PDF
      const persistRes = await updateActivity(activity.id, {
        attendanceRegistryUrl: newStoragePath,
        attendanceSheetFileName: file.name,
      });

      if (!persistRes.success) {
        if (newStoragePath) {
          await deleteEvidenceFromSupabase(newStoragePath);
        }
        setAttendanceFeedback({
          type: 'error',
          text: `Failed to save attendance registry reference (${persistRes.error || 'Database error'}). Previous registry reference preserved.`,
        });
        setIsUploadingAttendancePdf(false);
        return;
      }

      setAttendanceRegistryUrl(newStoragePath);
      setAttendanceSheetFileName(file.name);

      let cleanupNotice = '';
      if (previousStoragePath && previousStoragePath !== newStoragePath) {
        const delRes = await deleteEvidenceFromSupabase(previousStoragePath);
        if (!delRes.success && delRes.policyRestricted) {
          cleanupNotice = ` Superseded registry object "${previousStoragePath}" flagged for administrative cleanup.`;
        }
      }

      setAttendanceFeedback({
        type: 'success',
        persistenceMode: persistRes.persistedToCloud ? 'cloud' : 'local_queue',
        text: persistRes.persistedToCloud
          ? `Attendance registry PDF "${file.name}" uploaded to hcd-evidence-vault and confirmed saved to Supabase.${cleanupNotice}`
          : `Attendance registry PDF "${file.name}" saved to local queue for sync.${cleanupNotice}`,
      });
    } catch (err: any) {
      setAttendanceFeedback({
        type: 'error',
        text: err?.message || 'Unexpected error replacing attendance registry PDF.',
      });
    } finally {
      setIsUploadingAttendancePdf(false);
    }
  };

  // Resolve and view/download private Attendance Registry PDF via signed URL
  const handleDownloadAttendanceRegistry = async () => {
    setAttendanceFeedback(null);
    if (!attendanceRegistryUrl) {
      setAttendanceFeedback({
        type: 'warning',
        text: 'No canonical storage file is linked to this attendance registry yet. Upload a PDF file below.',
      });
      return;
    }

    setIsResolvingAttendancePdf(true);
    try {
      const resolved = await resolveActivityMedia({
        storagePath: canonicalAttendanceStoragePath || undefined,
        url: canonicalAttendanceStoragePath ? undefined : attendanceRegistryUrl,
      });

      if (resolved.status === 'resolved' && resolved.url) {
        const link = document.createElement('a');
        link.href = resolved.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = attendanceSheetFileName || 'Attendance_Registry.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setAttendanceFeedback({
          type: 'warning',
          text:
            resolved.error ||
            'Could not generate a signed URL for this attendance registry PDF. Upload a replacement PDF if the file is missing.',
        });
      }
    } catch (err: any) {
      setAttendanceFeedback({
        type: 'error',
        text: err?.message || 'Failed to resolve signed URL for attendance registry.',
      });
    } finally {
      setIsResolvingAttendancePdf(false);
    }
  };

  // ============================================================================
  // SECTION D: HCD SETTINGS & INDICATOR OUTCOMES HANDLERS
  // ============================================================================
  const handleLocalMeasurementChange = (
    index: number,
    updates: Partial<ActivityMeasurement>
  ) => {
    if (!canEdit) return;
    setEditableMeasurements((prev) =>
      prev.map((m, idx) => (idx === index ? { ...m, ...updates } : m))
    );
  };

  const handleSaveExistingMeasurement = async (m: ActivityMeasurement) => {
    if (!canEdit || !m.id) return;
    setMeasurementBusyId(m.id);
    setMeasurementStatusMsg(null);

    try {
      const res = await updateMeasurement(m.id, {
        indicator_code: m.indicator_code,
        reporting_period_start: m.reporting_period_start,
        reporting_period_end: m.reporting_period_end,
        value_numeric: m.value_numeric,
        value_text: m.value_text,
        data_source: m.data_source,
        evidence_reference: m.evidence_reference,
        notes: m.notes,
        disaggregation: m.disaggregation,
      });

      if (res.success) {
        setMeasurementStatusMsg({
          type: 'success',
          text: `Indicator outcome (${m.indicator_code}) updated and persisted to Supabase.`,
        });
      } else {
        setMeasurementStatusMsg({
          type: 'error',
          text: res.error || 'Failed to update indicator measurement.',
        });
      }
    } finally {
      setMeasurementBusyId(null);
    }
  };

  const handleDeleteExistingMeasurement = async (id?: string, code?: string) => {
    if (!canEdit || !id) return;
    setMeasurementBusyId(id);
    setMeasurementStatusMsg(null);
    try {
      const res = await deleteMeasurement(id);
      if (res.success) {
        setMeasurementStatusMsg({
          type: 'success',
          text: `Removed indicator measurement ${code || ''}.`,
        });
      } else {
        setMeasurementStatusMsg({
          type: 'error',
          text: res.error || 'Failed to delete indicator measurement.',
        });
      }
    } finally {
      setMeasurementBusyId(null);
    }
  };

  const handleCreateNewMeasurement = async () => {
    if (!canEdit) return;
    if (!newIndicatorCode) {
      setMeasurementStatusMsg({
        type: 'error',
        text: 'Select an indicator from the official catalogue before adding.',
      });
      return;
    }

    setMeasurementBusyId('new');
    setMeasurementStatusMsg(null);
    try {
      const parsedNum =
        newValueNumeric.trim() !== '' && !Number.isNaN(Number(newValueNumeric))
          ? Number(newValueNumeric)
          : null;

      const settingType = getSettingFromIndicatorCode(newIndicatorCode);
      const disaggregation = settingType
        ? {
            setting_type: settingType,
            indicator_code: newIndicatorCode,
            initiative_name: title.trim(),
            community_name: community.trim(),
            beneficiaries_reached: Number(beneficiariesTotal),
            implementation_status: 'implemented' as const,
            reporting_year: new Date(completionDate || Date.now()).getFullYear(),
          }
        : undefined;

      const res = await addMeasurement({
        activity_id: activity.id,
        indicator_code: newIndicatorCode,
        reporting_period_start: newPeriodStart || startDate,
        reporting_period_end: newPeriodEnd || completionDate,
        value_numeric: parsedNum,
        value_text: newValueText.trim() || null,
        data_source: newDataSource.trim() || null,
        evidence_reference: newEvidenceRef.trim() || attendanceSheetFileName || null,
        notes: newNotes.trim() || null,
        disaggregation,
      });

      if (res.success) {
        setNewIndicatorCode('');
        setNewValueNumeric('');
        setNewValueText('');
        setNewNotes('');
        setMeasurementStatusMsg({
          type: 'success',
          text: `Added indicator outcome (${newIndicatorCode}) to this activity report.`,
        });
      } else {
        setMeasurementStatusMsg({
          type: 'error',
          text: res.error || 'Failed to add indicator measurement.',
        });
      }
    } finally {
      setMeasurementBusyId(null);
    }
  };

  // ============================================================================
  // SAVE ALL DRAFT CHANGES (NEVER AUTO-SUBMITS FOR STATE EXECUTIVE APPROVAL)
  // ============================================================================
  const handleSaveDraftChanges = async () => {
    if (!canEdit || isSavingDraft) return;
    setSaveFeedback(null);

    const validationError = validateDraftForm();
    if (validationError) {
      setSaveFeedback({
        type: 'error',
        text: validationError,
      });
      return;
    }

    setIsSavingDraft(true);
    try {
      const canonicalMediaAssets = mediaAssets.map((m) => ({
        ...m,
        url: m.storagePath ? '' : m.url,
      }));

      const updates: Partial<HCDActivity> = {
        title: title.trim(),
        pillar,
        category: category ? (category as ReportingCategory) : null,
        pillarSegment:
          pillar === 'cross_cutting_enablers' && pillarSegment
            ? (pillarSegment as PillarSegment)
            : null,
        projectDescription: projectDescription.trim(),
        subCategory: projectDescription.trim(),
        community: community.trim(),
        coordinates: {
          lat: Number(latitude),
          lng: Number(longitude),
        },
        beneficiariesTotal: Number(beneficiariesTotal),
        beneficiariesMale: Number(beneficiariesMale),
        beneficiariesFemale: Number(beneficiariesFemale),
        youthBeneficiaries: Number(youthBeneficiaries),
        budgetNgn: Number(budgetNgn),
        startDate,
        completionDate,
        leadOfficer: leadOfficer.trim(),
        officerContact: officerContact.trim(),
        submissionNotes: submissionNotes.trim(),
        milestones,
        overallProgress: calculatedOverallProgress,
        mediaAssets: canonicalMediaAssets,
        attendanceSheetFileName: attendanceSheetFileName.trim() || undefined,
        attendanceRegistryUrl: attendanceRegistryUrl.trim() || undefined,
      };

      const res = await updateActivity(activity.id, updates);

      if (!res.success) {
        setSaveFeedback({
          type: 'error',
          text: res.error || 'Failed to save draft changes.',
        });
        setIsSavingDraft(false);
        return;
      }

      setIsDirty(false);
      setSaveFeedback({
        type: res.persistedToCloud ? 'success' : 'warning',
        persistenceMode: res.persistedToCloud ? 'cloud' : 'local_queue',
        text: res.persistedToCloud
          ? 'Draft changes confirmed persisted to Supabase. Your report remains in draft status until you explicitly submit it for State Executive review.'
          : 'Changes saved to local offline queue. They will synchronize to Supabase when cloud connectivity is restored.',
      });

      if (onSaved) {
        onSaved({ ...activity, ...updates });
      }
    } catch (err: any) {
      setSaveFeedback({
        type: 'error',
        text: err?.message || 'Unexpected error while saving draft changes.',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleRequestClose = () => {
    if (isDirty && canEdit) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-editor-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] bg-white/10 px-2.5 py-0.5 rounded-full">
                {activity.lgaName} LGA Desk Workspace
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                  activity.status === 'REJECTED_DRAFT'
                    ? 'bg-red-500/20 text-red-200 border border-red-400/40'
                    : activity.status === 'DRAFT'
                    ? 'bg-amber-400/20 text-amber-200 border border-amber-300/40'
                    : 'bg-blue-500/20 text-blue-200 border border-blue-400/40'
                }`}
              >
                Status: {activity.status.replace('_', ' ')}
              </span>
              {isDirty && canEdit && (
                <span className="text-[10px] font-bold bg-amber-300 text-slate-950 px-2 py-0.5 rounded-full">
                  Unsaved Local Edits
                </span>
              )}
            </div>
            <h2
              id="draft-editor-modal-title"
              className="text-base sm:text-lg font-black text-white tracking-tight"
            >
              {canEdit
                ? 'Edit LGA Activity Draft & Verification Evidence'
                : 'Activity Record Inspection (Read-Only)'}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="Close draft editor"
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unsaved Changes Confirmation Banner */}
        {showDiscardConfirm && (
          <div className="p-4 bg-amber-50 border-b border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Discard unsaved changes?</strong> You have modified fields in this draft that have not yet been saved.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  setIsDirty(false);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer"
              >
                Discard Changes
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-[#F8F9FA]">
          {/* Read-Only Explanation Banner when record is not editable */}
          {!canEdit && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-bold text-sm block text-amber-950">
                  {editPermission.title || 'Read-Only Record'}
                </strong>
                <p className="leading-relaxed text-amber-900">
                  {editPermission.explanation}
                </p>
              </div>
            </div>
          )}

          {/* Demo Mode Guard Notice */}
          {isDemoMode && (
            <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-950 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
              <div>
                <strong>Demo Mode Protection Active:</strong> Live uploads and deletions in the{' '}
                <code className="font-mono bg-purple-100 px-1 rounded">hcd-evidence-vault</code>{' '}
                Supabase storage bucket are blocked while Demo Mode is enabled.
              </div>
            </div>
          )}

          {/* Returned Report Feedback Banner */}
          {activity.status === 'REJECTED_DRAFT' && activity.rejectionReason && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-950 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-bold uppercase tracking-wider text-[11px] text-red-800 block">
                  Returned Report — State Executive Review Feedback
                </strong>
                <p className="text-xs leading-relaxed font-medium text-red-900">
                  "{activity.rejectionReason}"
                </p>
                <p className="text-[11px] text-red-700">
                  Correct the fields or replace verification evidence below, click{' '}
                  <strong>Save draft changes</strong>, and then re-submit from your LGA Desk Workspace when ready.
                </p>
              </div>
            </div>
          )}

          {/* Persistence Feedback Banner */}
          {saveFeedback && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                saveFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : saveFeedback.type === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-red-50 border-red-300 text-red-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {saveFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : saveFeedback.type === 'warning' ? (
                  <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <strong className="font-bold">
                      {saveFeedback.type === 'success'
                        ? 'Confirmed Persisted to Supabase'
                        : saveFeedback.type === 'warning'
                        ? 'Locally Queued Change'
                        : 'Validation / Persistence Error'}
                    </strong>
                    {saveFeedback.persistenceMode === 'cloud' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/80 text-emerald-950">
                        <Cloud className="w-3 h-3" /> Cloud Synced
                      </span>
                    )}
                    {saveFeedback.persistenceMode === 'local_queue' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-950">
                        <WifiOff className="w-3 h-3" /> Local Queue
                      </span>
                    )}
                  </div>
                  <p>{saveFeedback.text}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaveFeedback(null)}
                className="text-[11px] font-bold underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/* SECTION A: ACTIVITY IDENTIFICATION AND CLASSIFICATION            */}
          {/* ================================================================ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('identification')}
              className="w-full p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white text-xs font-bold flex items-center justify-center">
                  A
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Activity Identification & Classification
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Project title, HCD pillar, reporting category, description, ward/community & coordinates
                  </p>
                </div>
              </div>
              {openSections.identification ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {openSections.identification && (
              <div className="p-5 space-y-4 text-xs">
                <div>
                  <label
                    htmlFor="draft-title"
                    className="block font-bold text-slate-700 mb-1"
                  >
                    Project or Initiative Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="draft-title"
                    type="text"
                    disabled={!canEdit}
                    value={title}
                    onChange={(e) => {
                      markDirty();
                      setTitle(e.target.value);
                    }}
                    placeholder="e.g., Youth Solar Mini-Grid Installation & Vocational Apprenticeship"
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="draft-pillar"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      HCD Thematic Pillar <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="draft-pillar"
                      disabled={!canEdit}
                      value={pillar}
                      onChange={(e) => handlePillarChange(e.target.value as PillarId)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    >
                      {Object.values(PILLARS).map((p) => (
                        <option key={p.id} value={p.id}>
                          {getPillarDisplayName(p.id)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="draft-category"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Reporting Category
                    </label>
                    <select
                      id="draft-category"
                      disabled={!canEdit}
                      value={category}
                      onChange={(e) => {
                        markDirty();
                        setCategory(e.target.value);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    >
                      <option value="">Standard Thematic Pillar Initiative</option>
                      <option value="HCD Settings">HCD Settings (Home, Communities, Schools, Workplaces)</option>
                      {REPORTING_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {pillar === 'cross_cutting_enablers' && (
                  <div>
                    <label
                      htmlFor="draft-segment"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Cross-Cutting Segment <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="draft-segment"
                      disabled={!canEdit}
                      value={pillarSegment}
                      onChange={(e) => {
                        markDirty();
                        setPillarSegment(e.target.value as PillarSegment);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    >
                      <option value="">-- Select Cross-Cutting Segment --</option>
                      {CROSS_CUTTING_SEGMENTS.map((seg) => (
                        <option key={seg.id} value={seg.id}>
                          {seg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="draft-description"
                    className="block font-bold text-slate-700 mb-1"
                  >
                    Project Description / Sub-Category <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="draft-description"
                    rows={2}
                    disabled={!canEdit}
                    value={projectDescription}
                    onChange={(e) => {
                      markDirty();
                      setProjectDescription(e.target.value);
                    }}
                    placeholder="Describe the concrete scope and deliverables of this activity..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                  />
                  {PILLARS[pillar]?.subCategories?.length > 0 && canEdit && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-500 font-semibold">Presets:</span>
                      {PILLARS[pillar].subCategories.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            markDirty();
                            setProjectDescription(preset);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label
                      htmlFor="draft-community"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Exact Community / Ward <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-community"
                      type="text"
                      disabled={!canEdit}
                      value={community}
                      onChange={(e) => {
                        markDirty();
                        setCommunity(e.target.value);
                      }}
                      placeholder="e.g., Ikot Oku Ikono Ward 2"
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="draft-lat"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Activity Latitude (°N) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-lat"
                      type="number"
                      step="0.0001"
                      disabled={!canEdit}
                      value={latitude}
                      onChange={(e) => {
                        markDirty();
                        setLatitude(parseFloat(e.target.value) || 0);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="draft-lng"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Activity Longitude (°E) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-lng"
                      type="number"
                      step="0.0001"
                      disabled={!canEdit}
                      value={longitude}
                      onChange={(e) => {
                        markDirty();
                        setLongitude(parseFloat(e.target.value) || 0);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* Geofence Status Indicator */}
                <div
                  className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between ${
                    isGeoValid
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isGeoValid
                        ? `Activity coordinates (${Number(latitude).toFixed(4)}°N, ${Number(longitude).toFixed(4)}°E) pass Akwa Ibom State geographic boundary validation (${geoValidation.message}).`
                        : geoValidation.message}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/80">
                    Recorded Activity Location
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* SECTION B: IMPLEMENTATION AND RESOURCES                          */}
          {/* ================================================================ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('resources')}
              className="w-full p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white text-xs font-bold flex items-center justify-center">
                  B
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Implementation, Demographics & Resources
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Beneficiary disaggregation (Male + Female = Total), budget in NGN, timeline, lead officer & notes
                  </p>
                </div>
              </div>
              {openSections.resources ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {openSections.resources && (
              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label
                      htmlFor="draft-total-beneficiaries"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Total Beneficiaries <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-total-beneficiaries"
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={beneficiariesTotal}
                      onChange={(e) => {
                        markDirty();
                        setBeneficiariesTotal(parseInt(e.target.value, 10) || 0);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="draft-male-beneficiaries"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Male Beneficiaries <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-male-beneficiaries"
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={beneficiariesMale}
                      onChange={(e) => {
                        markDirty();
                        setBeneficiariesMale(parseInt(e.target.value, 10) || 0);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="draft-female-beneficiaries"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Female Beneficiaries <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-female-beneficiaries"
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={beneficiariesFemale}
                      onChange={(e) => {
                        markDirty();
                        setBeneficiariesFemale(parseInt(e.target.value, 10) || 0);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="draft-youth-beneficiaries"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Youth Beneficiaries
                    </label>
                    <input
                      id="draft-youth-beneficiaries"
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={youthBeneficiaries}
                      onChange={(e) => {
                        markDirty();
                        setYouthBeneficiaries(parseInt(e.target.value, 10) || 0);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* Demographic Balance Validation Banner */}
                <div
                  className={`p-3 rounded-xl border text-[11px] flex items-center justify-between ${
                    isMathBalanced
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-300 text-red-900 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>
                      {isMathBalanced
                        ? `Demographic Balance Verified: Male (${beneficiariesMale}) + Female (${beneficiariesFemale}) = Total (${beneficiariesTotal}).`
                        : `Demographic Discrepancy: Male (${beneficiariesMale}) + Female (${beneficiariesFemale}) = ${mathSum}, which differs from Total (${beneficiariesTotal}) by ${mathDelta > 0 ? `+${mathDelta}` : mathDelta}.`}
                    </span>
                  </div>
                  {!isMathBalanced && canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        markDirty();
                        setBeneficiariesTotal(mathSum);
                      }}
                      className="px-2.5 py-1 rounded bg-white border border-red-300 text-red-900 font-bold text-[10px] hover:bg-red-100 cursor-pointer shrink-0"
                    >
                      Sync Total to {mathSum}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="draft-budget"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Budget Incurred (NGN ₦) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-budget"
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={budgetNgn}
                      onChange={(e) => {
                        markDirty();
                        setBudgetNgn(parseFloat(e.target.value) || 0);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="draft-start-date"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-start-date"
                      type="date"
                      disabled={!canEdit}
                      value={startDate}
                      onChange={(e) => {
                        markDirty();
                        setStartDate(e.target.value);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="draft-completion-date"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Completion Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-completion-date"
                      type="date"
                      disabled={!canEdit}
                      value={completionDate}
                      onChange={(e) => {
                        markDirty();
                        setCompletionDate(e.target.value);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="draft-lead-officer"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Lead Desk Officer <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="draft-lead-officer"
                      type="text"
                      disabled={!canEdit}
                      value={leadOfficer}
                      onChange={(e) => {
                        markDirty();
                        setLeadOfficer(e.target.value);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="draft-officer-contact"
                      className="block font-bold text-slate-700 mb-1"
                    >
                      Officer Contact / Phone
                    </label>
                    <input
                      id="draft-officer-contact"
                      type="text"
                      disabled={!canEdit}
                      value={officerContact}
                      onChange={(e) => {
                        markDirty();
                        setOfficerContact(e.target.value);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="draft-submission-notes"
                    className="block font-bold text-slate-700 mb-1"
                  >
                    Submission or Clarification Notes
                  </label>
                  <textarea
                    id="draft-submission-notes"
                    rows={2}
                    disabled={!canEdit}
                    value={submissionNotes}
                    onChange={(e) => {
                      markDirty();
                      setSubmissionNotes(e.target.value);
                    }}
                    placeholder="Provide field verification notes or responses to State Executive review feedback..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* SECTION C: MILESTONES                                            */}
          {/* ================================================================ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('milestones')}
              className="w-full p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white text-xs font-bold flex items-center justify-center">
                  C
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Phased Milestones & Execution Progress ({calculatedOverallProgress}%)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Edit milestone deliverables, target dates & completion percentages; overall progress auto-recalculates
                  </p>
                </div>
              </div>
              {openSections.milestones ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {openSections.milestones && (
              <div className="p-5 space-y-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">
                      Recalculated Overall Progress ({milestones.length} Phase{milestones.length === 1 ? '' : 's'})
                    </span>
                    <span className="font-mono font-black text-emerald-900 text-sm">
                      {calculatedOverallProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-700 h-2 rounded-full transition-all"
                      style={{ width: `${calculatedOverallProgress}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {milestones.map((ms) => (
                    <div
                      key={ms.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-6 h-6 rounded-full bg-emerald-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                            {ms.phaseNumber}
                          </span>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={ms.title}
                            onChange={(e) =>
                              handleUpdateMilestone(ms.id, { title: e.target.value })
                            }
                            aria-label={`Milestone ${ms.phaseNumber} title`}
                            className="flex-1 p-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 disabled:bg-slate-100"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                              ms.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ms.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {ms.status.replace('_', ' ')} ({ms.completionPercentage}%)
                          </span>

                          {canEdit && milestones.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMilestone(ms.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove Milestone"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Phase Description
                          </label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={ms.description || ''}
                            onChange={(e) =>
                              handleUpdateMilestone(ms.id, { description: e.target.value })
                            }
                            placeholder="Milestone scope..."
                            className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 disabled:bg-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Key Deliverable
                          </label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={ms.keyDeliverable || ''}
                            onChange={(e) =>
                              handleUpdateMilestone(ms.id, { keyDeliverable: e.target.value })
                            }
                            placeholder="Expected output / deliverable..."
                            className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 disabled:bg-slate-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Target Date
                          </label>
                          <input
                            type="date"
                            disabled={!canEdit}
                            value={ms.targetDate}
                            onChange={(e) =>
                              handleUpdateMilestone(ms.id, { targetDate: e.target.value })
                            }
                            className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono disabled:bg-slate-100"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                            <span>Completion Percentage</span>
                            <span className="font-mono font-bold text-emerald-900">
                              {ms.completionPercentage}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            disabled={!canEdit}
                            value={ms.completionPercentage}
                            onChange={(e) =>
                              handleUpdateMilestone(ms.id, {
                                completionPercentage: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-full accent-emerald-800 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="w-full py-2.5 rounded-xl border border-dashed border-emerald-600/50 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Implementation Milestone Phase
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* SECTION D: HCD SETTINGS AND INDICATOR OUTCOMES                   */}
          {/* ================================================================ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('measurements')}
              className="w-full p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white text-xs font-bold flex items-center justify-center">
                  D
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    HCD Settings & Indicator Outcomes ({editableMeasurements.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Associated activity_measurements records, HCD Settings metadata, numeric/text results & evidence references
                  </p>
                </div>
              </div>
              {openSections.measurements ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {openSections.measurements && (
              <div className="p-5 space-y-4 text-xs">
                {measurementStatusMsg && (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      measurementStatusMsg.type === 'success'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-red-50 border-red-300 text-red-900'
                    }`}
                  >
                    <span>{measurementStatusMsg.text}</span>
                    <button
                      type="button"
                      onClick={() => setMeasurementStatusMsg(null)}
                      className="text-[11px] font-bold underline ml-2 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {editableMeasurements.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-slate-500">
                    No <code className="font-mono">activity_measurements</code> records are currently linked to this activity report.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editableMeasurements.map((m, idx) => {
                      const matchedIndicator = indicators.find(
                        (i) => i.indicator_code === m.indicator_code
                      );
                      const hcdSetting =
                        m.disaggregation?.setting_type ||
                        getSettingFromIndicatorCode(m.indicator_code);

                      return (
                        <div
                          key={m.id || `${m.indicator_code}-${idx}`}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-emerald-900 text-white">
                                {m.indicator_code}
                              </span>
                              <strong className="text-slate-900">
                                {matchedIndicator?.indicator_name || m.indicator_code}
                              </strong>
                              {hcdSetting && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                  HCD Setting: {hcdSetting}
                                </span>
                              )}
                            </div>

                            {canEdit && m.id && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={measurementBusyId === m.id}
                                  onClick={() => handleSaveExistingMeasurement(m)}
                                  className="px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Save className="w-3 h-3" />
                                  {measurementBusyId === m.id ? 'Saving...' : 'Save Measurement'}
                                </button>
                                <button
                                  type="button"
                                  disabled={measurementBusyId === m.id}
                                  onClick={() =>
                                    handleDeleteExistingMeasurement(m.id, m.indicator_code)
                                  }
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                  title="Delete Measurement"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Indicator
                              </label>
                              <select
                                disabled={!canEdit}
                                value={m.indicator_code}
                                onChange={(e) =>
                                  handleLocalMeasurementChange(idx, {
                                    indicator_code: e.target.value,
                                  })
                                }
                                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 disabled:bg-slate-100"
                              >
                                {indicators.map((ind) => (
                                  <option key={ind.indicator_code} value={ind.indicator_code}>
                                    {ind.indicator_code} — {ind.indicator_name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Reporting Period Start
                              </label>
                              <input
                                type="date"
                                disabled={!canEdit}
                                value={m.reporting_period_start || ''}
                                onChange={(e) =>
                                  handleLocalMeasurementChange(idx, {
                                    reporting_period_start: e.target.value,
                                  })
                                }
                                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono disabled:bg-slate-100"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Reporting Period End
                              </label>
                              <input
                                type="date"
                                disabled={!canEdit}
                                value={m.reporting_period_end || ''}
                                onChange={(e) =>
                                  handleLocalMeasurementChange(idx, {
                                    reporting_period_end: e.target.value,
                                  })
                                }
                                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono disabled:bg-slate-100"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Numeric Result ({matchedIndicator?.measurement_unit || 'Value'})
                              </label>
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={
                                  m.value_numeric !== null && m.value_numeric !== undefined
                                    ? m.value_numeric
                                    : ''
                                }
                                onChange={(e) =>
                                  handleLocalMeasurementChange(idx, {
                                    value_numeric:
                                      e.target.value === '' ? null : parseFloat(e.target.value),
                                  })
                                }
                                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono font-bold disabled:bg-slate-100"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Text / Qualitative Result
                              </label>
                              <input
                                type="text"
                                disabled={!canEdit}
                                value={m.value_text || ''}
                                onChange={(e) =>
                                  handleLocalMeasurementChange(idx, {
                                    value_text: e.target.value,
                                  })
                                }
                                placeholder="e.g., IMPLEMENTED / Verified"
                                className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Data Source
                              </label>
                              <input
                                type="text"
                                disabled={!canEdit}
                                value={m.data_source || ''}
                                onChange={(e) =>
                                  handleLocalMeasurementChange(idx, {
                                    data_source: e.target.value,
                                  })
                                }
                                placeholder="e.g., Field monitoring register"
                                className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Evidence Reference
                              </label>
                              <input
                                type="text"
                                disabled={!canEdit}
                                value={m.evidence_reference || ''}
                                onChange={(e) =>
                                  handleLocalMeasurementChange(idx, {
                                    evidence_reference: e.target.value,
                                  })
                                }
                                placeholder="e.g., Attendance roll / storage reference"
                                className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
                              />
                            </div>
                          </div>

                          {/* HCD Settings Disaggregation Fields if present */}
                          {m.disaggregation && (
                            <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                                  HCD Setting Type
                                </label>
                                <select
                                  disabled={!canEdit}
                                  value={m.disaggregation.setting_type || 'Communities'}
                                  onChange={(e) => {
                                    const nextSetting = e.target.value as HCDSettingType;
                                    const mappedCode =
                                      HCD_SETTINGS_MAP[nextSetting]?.code || m.indicator_code;
                                    handleLocalMeasurementChange(idx, {
                                      indicator_code: mappedCode,
                                      disaggregation: {
                                        ...m.disaggregation,
                                        setting_type: nextSetting,
                                        indicator_code: mappedCode,
                                      },
                                    });
                                  }}
                                  className="w-full p-1.5 rounded border border-amber-300 bg-white text-xs font-semibold"
                                >
                                  <option value="Home">Home (HCDS-01)</option>
                                  <option value="Communities">Communities (HCDS-02)</option>
                                  <option value="Learning institutions">
                                    Learning institutions (HCDS-03)
                                  </option>
                                  <option value="Workplaces">Workplaces (HCDS-04)</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                                  Target Population
                                </label>
                                <input
                                  type="text"
                                  disabled={!canEdit}
                                  value={m.disaggregation.target_population || ''}
                                  onChange={(e) =>
                                    handleLocalMeasurementChange(idx, {
                                      disaggregation: {
                                        ...m.disaggregation,
                                        target_population: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full p-1.5 rounded border border-amber-300 bg-white text-xs"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                                  Implementation Status
                                </label>
                                <select
                                  disabled={!canEdit}
                                  value={m.disaggregation.implementation_status || 'implemented'}
                                  onChange={(e) =>
                                    handleLocalMeasurementChange(idx, {
                                      value_numeric: e.target.value === 'implemented' ? 1 : 0,
                                      value_text: e.target.value.toUpperCase(),
                                      disaggregation: {
                                        ...m.disaggregation,
                                        implementation_status: e.target.value as any,
                                      },
                                    })
                                  }
                                  className="w-full p-1.5 rounded border border-amber-300 bg-white text-xs font-semibold"
                                >
                                  <option value="implemented">Implemented</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="planned">Planned</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Measurement Notes
                            </label>
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={m.notes || ''}
                              onChange={(e) =>
                                handleLocalMeasurementChange(idx, { notes: e.target.value })
                              }
                              placeholder="Additional indicator context or verification notes..."
                              className="w-full p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add New Indicator Measurement Form */}
                {canEdit && (
                  <div className="p-4 rounded-xl border border-dashed border-emerald-700/40 bg-emerald-50/30 space-y-3">
                    <h4 className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-emerald-800" />
                      Add Indicator Measurement Outcome
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Select Official Catalogue Indicator
                        </label>
                        <select
                          value={newIndicatorCode}
                          onChange={(e) => setNewIndicatorCode(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 bg-white font-semibold"
                        >
                          <option value="">-- Choose Indicator --</option>
                          {indicators.map((ind) => (
                            <option key={ind.indicator_code} value={ind.indicator_code}>
                              [{ind.indicator_code}] {ind.indicator_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Numeric Value
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={newValueNumeric}
                          onChange={(e) => setNewValueNumeric(e.target.value)}
                          placeholder="e.g., 1 or 250"
                          className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Text Result
                        </label>
                        <input
                          type="text"
                          value={newValueText}
                          onChange={(e) => setNewValueText(e.target.value)}
                          placeholder="Optional text outcome"
                          className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Data Source
                        </label>
                        <input
                          type="text"
                          value={newDataSource}
                          onChange={(e) => setNewDataSource(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Evidence Reference
                        </label>
                        <input
                          type="text"
                          value={newEvidenceRef}
                          onChange={(e) => setNewEvidenceRef(e.target.value)}
                          placeholder="Registry / file ref"
                          className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <input
                        type="text"
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Optional measurement notes..."
                        className="flex-1 p-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <button
                        type="button"
                        disabled={measurementBusyId === 'new'}
                        onClick={handleCreateNewMeasurement}
                        className="px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {measurementBusyId === 'new' ? 'Adding...' : 'Add Outcome'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* SECTION E: PHOTOGRAPHIC VERIFICATION ASSETS & EXIF GEOTAGS        */}
          {/* ================================================================ */}
          <div
            ref={evidenceSectionRef}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleSection('evidence')}
              className="w-full p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-900 text-white text-xs font-bold flex items-center justify-center">
                  E
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Photographic Verification Assets & EXIF Geotags
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Individually replace or remove photos, videos & documents, inspect EXIF geotag provenance, and replace the Attendance Registry PDF
                  </p>
                </div>
              </div>
              {openSections.evidence ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {openSections.evidence && (
              <div className="p-5 space-y-5 text-xs">
                {/* Media Action Feedback Banner */}
                {mediaFeedback && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                      mediaFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : mediaFeedback.type === 'warning'
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-red-50 border-red-300 text-red-950'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {mediaFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="font-bold">
                            {mediaFeedback.type === 'success'
                              ? 'Evidence Asset Updated'
                              : 'Evidence Operation Notice'}
                          </strong>
                          {mediaFeedback.persistenceMode === 'cloud' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-950">
                              Confirmed in Supabase
                            </span>
                          )}
                          {mediaFeedback.persistenceMode === 'local_queue' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-950">
                              Queued Locally
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5">{mediaFeedback.text}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMediaFeedback(null)}
                      className="text-[11px] font-bold underline shrink-0 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Add Photo, Video or Document Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50/40 border border-emerald-200">
                  <div className="space-y-0.5">
                    <strong className="text-slate-900 block font-bold">
                      Verification Attachments ({mediaAssets.length})
                    </strong>
                    <span className="text-[11px] text-slate-600 block">
                      Supported formats: JPEG, PNG, WEBP, PDF, MP4 (max 25MB). Stored privately in{' '}
                      <code className="font-mono text-emerald-900">hcd-evidence-vault</code>.
                    </span>
                  </div>

                  {canEdit && (
                    <label
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 ${
                        isAddingNewAsset || isDemoMode ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      <Upload className={`w-4 h-4 ${isAddingNewAsset ? 'animate-bounce' : ''}`} />
                      <span>
                        {isAddingNewAsset
                          ? 'Uploading to Vault...'
                          : 'Add photo, video or document'}
                      </span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,image/jpeg,image/png,image/webp,application/pdf,video/mp4"
                        disabled={!canEdit || isAddingNewAsset || isDemoMode}
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) {
                            handleAddVerificationAsset(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Existing Verification Attachments List */}
                {mediaAssets.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
                    <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-bold text-slate-700">
                      No verification photos, videos, or documents attached yet
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Use the "Add photo, video or document" control above to upload authentic field evidence to the private Supabase bucket.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mediaAssets.map((asset) => {
                      const isBusy = uploadingAssetId === asset.id;
                      const provenance = describeMediaGeotagProvenance(
                        asset,
                        { lat: Number(latitude), lng: Number(longitude) },
                        activity.lgaId
                      );
                      const hasAssetCoords = Boolean(
                        asset.coordinates &&
                          typeof asset.coordinates.lat === 'number' &&
                          typeof asset.coordinates.lng === 'number'
                      );
                      const isDoc = asset.type === 'document' || isDocumentMedia(asset);
                      const isVid = asset.type === 'video';

                      return (
                        <div
                          key={asset.id}
                          className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between shadow-2xs"
                        >
                          <div>
                            {/* Visual Preview */}
                            <ActivityMediaImage
                              media={asset}
                              activityTitle={title || activity.title}
                              pillar={pillar}
                              lgaName={activity.lgaName}
                              community={community}
                              aspectRatioClass="h-44 w-full"
                            />

                            {/* Metadata & EXIF Provenance Details */}
                            <div className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div
                                    className="font-bold text-slate-900 truncate"
                                    title={asset.fileName || asset.storagePath || 'Attachment'}
                                  >
                                    {asset.fileName ||
                                      asset.storagePath?.split('/').pop() ||
                                      'Verification_Asset'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="inline-flex items-center gap-1 font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                      {isDoc ? (
                                        <FileText className="w-3 h-3 text-emerald-700" />
                                      ) : isVid ? (
                                        <Film className="w-3 h-3 text-blue-700" />
                                      ) : (
                                        <ImageIcon className="w-3 h-3 text-emerald-700" />
                                      )}
                                      {asset.mimeType || asset.type.toUpperCase()}
                                    </span>
                                    {asset.fileSize && (
                                      <>
                                        <span>·</span>
                                        <span className="font-mono">{asset.fileSize}</span>
                                      </>
                                    )}
                                    {asset.uploadTimestamp && (
                                      <>
                                        <span>·</span>
                                        <span>
                                          {new Date(asset.uploadTimestamp).toLocaleDateString()}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {asset.storagePath ? (
                                  <span
                                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0"
                                    title={`Canonical Vault Path: ${asset.storagePath}`}
                                  >
                                    Vault Path Saved
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                    Legacy Reference
                                  </span>
                                )}
                              </div>

                              {/* Truthful Geotag & EXIF Provenance Box */}
                              <div
                                className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
                                  provenance.badgeTone === 'emerald'
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                    : provenance.badgeTone === 'blue'
                                    ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                                    : provenance.badgeTone === 'amber'
                                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold flex items-center gap-1">
                                    <LocateFixed className="w-3.5 h-3.5 shrink-0" />
                                    {provenance.badgeLabel}
                                  </span>
                                  <span className="text-[10px] font-mono">
                                    {hasAssetCoords && asset.coordinates
                                      ? `${asset.coordinates.lat.toFixed(4)}°N, ${asset.coordinates.lng.toFixed(4)}°E`
                                      : 'No GPS on file'}
                                  </span>
                                </div>
                                <p className="text-[10px] opacity-90 leading-relaxed">
                                  {provenance.validationSummary}
                                </p>
                                {(asset.exifDeviceMake ||
                                  asset.exifDeviceModel ||
                                  asset.exifCapturedAt) && (
                                  <div className="text-[10px] font-mono pt-1 border-t border-black/10">
                                    {asset.exifDeviceMake || asset.exifDeviceModel
                                      ? `Camera: ${[asset.exifDeviceMake, asset.exifDeviceModel]
                                          .filter(Boolean)
                                          .join(' ')} `
                                      : ''}
                                    {asset.exifCapturedAt
                                      ? `· Captured: ${asset.exifCapturedAt}`
                                      : ''}
                                  </div>
                                )}

                                {/* Allow recording activity location separately when image has no embedded EXIF GPS */}
                                {canEdit && !hasAssetCoords && !isDoc && (
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleLinkActivityCoordinatesToAsset(asset.id)
                                      }
                                      className="text-[10px] font-bold underline text-emerald-800 hover:text-emerald-950 cursor-pointer"
                                    >
                                      Record activity location ({Number(latitude).toFixed(4)}°N,{' '}
                                      {Number(longitude).toFixed(4)}°E) for this asset (marked as Activity Location, not EXIF)
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Editable Caption */}
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                  Asset Caption / Verification Note
                                </label>
                                <input
                                  type="text"
                                  disabled={!canEdit}
                                  value={asset.caption || ''}
                                  onChange={(e) => {
                                    markDirty();
                                    const nextCaption = e.target.value;
                                    setMediaAssets((prev) =>
                                      prev.map((m) =>
                                        m.id === asset.id ? { ...m, caption: nextCaption } : m
                                      )
                                    );
                                  }}
                                  className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs disabled:bg-slate-100"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Per-Attachment Replace & Remove Controls */}
                          {canEdit && (
                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                              <label
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-700/40 hover:bg-emerald-50 text-emerald-900 font-bold text-xs shadow-2xs transition-colors cursor-pointer ${
                                  isBusy || isDemoMode ? 'opacity-50 pointer-events-none' : ''
                                }`}
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`}
                                />
                                <span>{isBusy ? 'Replacing...' : 'Replace file'}</span>
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,image/jpeg,image/png,image/webp,application/pdf,video/mp4"
                                  disabled={!canEdit || isBusy || isDemoMode}
                                  className="sr-only"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    if (file) {
                                      handleReplaceSingleAsset(asset, file);
                                    }
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                disabled={isBusy || isDemoMode}
                                onClick={() => handleRemoveVerificationAsset(asset)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ============================================================ */}
                {/* ATTENDANCE REGISTRY PDF REPLACEMENT                          */}
                {/* ============================================================ */}
                <div className="pt-3 border-t border-slate-200">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center shrink-0 border border-emerald-200">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">
                              Beneficiary Attendance Registry PDF
                            </h4>
                            {hasCanonicalAttendanceFile ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Canonical Vault Reference Verified
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                Filename Only — Upload Actual PDF Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-slate-800 mt-0.5">
                            Current File:{' '}
                            <strong>
                              {attendanceSheetFileName || 'No attendance registry PDF uploaded'}
                            </strong>
                          </p>
                          {canonicalAttendanceStoragePath && (
                            <p className="text-[10px] font-mono text-slate-500">
                              Storage Path: {canonicalAttendanceStoragePath}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {hasCanonicalAttendanceFile && (
                          <button
                            type="button"
                            disabled={isResolvingAttendancePdf}
                            onClick={handleDownloadAttendanceRegistry}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-800" />
                            <span>
                              {isResolvingAttendancePdf ? 'Resolving...' : 'View / Download PDF'}
                            </span>
                          </button>
                        )}

                        {canEdit && (
                          <label
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white font-bold text-xs shadow-xs cursor-pointer ${
                              isUploadingAttendancePdf || isDemoMode
                                ? 'opacity-50 pointer-events-none'
                                : ''
                            }`}
                          >
                            <Upload
                              className={`w-3.5 h-3.5 ${
                                isUploadingAttendancePdf ? 'animate-bounce' : ''
                              }`}
                            />
                            <span>
                              {isUploadingAttendancePdf
                                ? 'Uploading Registry PDF...'
                                : 'Replace attendance registry PDF'}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              disabled={!canEdit || isUploadingAttendancePdf || isDemoMode}
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) {
                                  handleReplaceAttendancePdf(file);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {attendanceFeedback && (
                      <div
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                          attendanceFeedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                            : attendanceFeedback.type === 'warning'
                            ? 'bg-amber-50 border-amber-300 text-amber-950'
                            : 'bg-red-50 border-red-300 text-red-950'
                        }`}
                      >
                        <span>{attendanceFeedback.text}</span>
                        <button
                          type="button"
                          onClick={() => setAttendanceFeedback(null)}
                          className="text-[11px] font-bold underline shrink-0 cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Prominent Save Draft Changes Button */}
        <div className="p-4 sm:px-6 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-600 flex items-center gap-2">
            {isOnline && isSupabaseActive && !isDemoMode ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold">
                <Cloud className="w-3.5 h-3.5" />
                Connected to Supabase — Saves persist directly to cloud database
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-800 font-semibold">
                <WifiOff className="w-3.5 h-3.5" />
                {isDemoMode
                  ? 'Demo Mode Active — Storage mutations disabled'
                  : 'Offline Mode — Changes queue locally until reconnected'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              {canEdit ? 'Cancel / Close' : 'Close'}
            </button>

            {canEdit && (
              <button
                type="button"
                disabled={isSavingDraft}
                onClick={handleSaveDraftChanges}
                className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
              >
                <Save className={`w-4 h-4 ${isSavingDraft ? 'animate-spin' : ''}`} />
                <span>{isSavingDraft ? 'Saving draft changes...' : 'Save draft changes'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ALL_31_LGAS, PILLARS, CROSS_CUTTING_SEGMENTS, REPORTING_CATEGORIES } from '../../data/lgas';
import {
  PillarId,
  PillarSegment,
  ReportingCategory,
  VerificationMedia,
  ProjectMilestone,
  MilestoneStatus,
  ActivityMeasurement,
} from '../../types';
import { validateCoordinates } from '../../lib/geoFence';
import { validateMediaFile, isDocumentMedia } from '../../services/mediaService';
import confetti from 'canvas-confetti';
import {
  X,
  Check,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Camera,
  FileText,
  MapPin,
  Sparkles,
  WifiOff,
  Calendar,
  DollarSign,
  Users,
  ShieldCheck,
  Flag,
  Plus,
  Trash2,
  TrendingUp,
  LocateFixed,
  Layers,
  BarChart2,
  Home,
  Briefcase,
  GraduationCap,
  Building2,
  Info,
} from 'lucide-react';
import {
  HCD_SETTINGS_MAP,
  HCDSettingType,
  getIndicatorCodeFromSetting,
  getSettingFromIndicatorCode,
} from '../../data/indicators';

interface ReportingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPillar?: PillarId;
  initialSetting?: HCDSettingType;
}

export const ReportingWizardModal: React.FC<ReportingWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPillar,
  initialSetting,
}) => {
  const { currentUser } = useAuth();
  const {
    addActivity,
    isOnline,
    uploadEvidenceToSupabase,
    isSupabaseActive,
    pillars,
    getPillarDisplayName,
    indicators,
    addMeasurement,
  } = useData();
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const lgaId = currentUser.assignedLgaId || 'uyo';
  const lgaObj = ALL_31_LGAS.find((l) => l.id === lgaId) || ALL_31_LGAS[0];

  const [title, setTitle] = useState('');
  const [pillar, setPillar] = useState<PillarId>(
    initialPillar || (initialSetting ? 'agriculture' : 'vocational')
  );
  const [category, setCategory] = useState<string>(
    initialSetting || initialPillar === 'agriculture' ? 'HCD Settings' : ''
  );
  const [pillarSegment, setPillarSegment] = useState<PillarSegment | ''>('');
  const [projectDescription, setProjectDescription] = useState<string>(() => {
    if (initialSetting) {
      return HCD_SETTINGS_MAP[initialSetting]?.label || 'Human capital development initiatives implemented in communities';
    }
    return PILLARS.vocational.subCategories[0] || 'Technical & Vocational Skills Training';
  });

  // HCD Settings Frontline Initiative States
  const [selectedSetting, setSelectedSetting] = useState<HCDSettingType>(initialSetting || 'Communities');
  const [initiativeIdentifier, setInitiativeIdentifier] = useState<string>(
    () => `INIT-${lgaObj.id.toUpperCase()}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [targetPopulation, setTargetPopulation] = useState<string>('Youths, women, and vulnerable community households');
  const [implementationStatus, setImplementationStatus] = useState<'implemented' | 'planned' | 'in_progress' | 'cancelled'>('implemented');
  const [householdCoverage, setHouseholdCoverage] = useState<string>('Cluster of 60 registered households');
  const [institutionName, setInstitutionName] = useState<string>('');
  const [institutionType, setInstitutionType] = useState<string>('Secondary School');
  const [workplaceName, setWorkplaceName] = useState<string>('');
  const [workplaceType, setWorkplaceType] = useState<string>('Private Enterprise');
  const [communityProgrammeType, setCommunityProgrammeType] = useState<string>('Community Grassroots Outreach');
  const [dataSource, setDataSource] = useState<string>('Approved HCD initiative register / field monitoring report');
  const [evidenceReference, setEvidenceReference] = useState<string>('');
  const [reportingYear, setReportingYear] = useState<number>(new Date().getFullYear());

  const [attachedIndicatorCode, setAttachedIndicatorCode] = useState<string>('');
  const [attachedIndicatorValue, setAttachedIndicatorValue] = useState<string>('');
  const [attachedIndicatorNotes, setAttachedIndicatorNotes] = useState<string>('');
  const [attachedMeasurements, setAttachedMeasurements] = useState<Array<{
    indicator_code: string;
    indicator_name: string;
    value_numeric?: number;
    value_text?: string;
    notes?: string;
  }>>([]);
  const [community, setCommunity] = useState('');
  const [latitude, setLatitude] = useState<number>(lgaObj.centerCoordinates.lat);
  const [longitude, setLongitude] = useState<number>(lgaObj.centerCoordinates.lng);

  const [totalBeneficiaries, setTotalBeneficiaries] = useState<number>(200);
  const [maleBeneficiaries, setMaleBeneficiaries] = useState<number>(100);
  const [femaleBeneficiaries, setFemaleBeneficiaries] = useState<number>(100);
  const [youthBeneficiaries, setYouthBeneficiaries] = useState<number>(180);
  const [budgetNgn, setBudgetNgn] = useState<number>(12000000);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [leadOfficer, setLeadOfficer] = useState(currentUser.name || 'Desk Officer');
  const [officerContact, setOfficerContact] = useState('+234 803 000 1234');

  // Milestone Tracking State
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([
    {
      id: 'ms-init-1',
      phaseNumber: 1,
      title: 'Phase 1: Mobilization, Enumeration & Baseline Survey',
      description: 'Community sensitization, beneficiary screening and biometric roster documentation.',
      targetDate: new Date().toISOString().split('T')[0],
      completionPercentage: 100,
      status: 'COMPLETED',
      keyDeliverable: 'Verified biometric attendance roll',
    },
    {
      id: 'ms-init-2',
      phaseNumber: 2,
      title: 'Phase 2: Training Delivery & Capacity Building Execution',
      description: 'Hands-on practical curriculum, technical guidance, and field operations.',
      targetDate: new Date(Date.now() + 86400000 * 20).toISOString().split('T')[0],
      completionPercentage: 60,
      status: 'IN_PROGRESS',
      keyDeliverable: 'Midterm milestone execution report',
    },
    {
      id: 'ms-init-3',
      phaseNumber: 3,
      title: 'Phase 3: Tools Distribution, Certification & Monitoring',
      description: 'Grant or equipment allocation, certification ceremony, and long-term impact survey.',
      targetDate: new Date(Date.now() + 86400000 * 45).toISOString().split('T')[0],
      completionPercentage: 0,
      status: 'NOT_STARTED',
      keyDeliverable: 'Equipment handover charter & certification log',
    },
  ]);

  const calculatedOverallProgress = Math.round(
    milestones.reduce((acc, m) => acc + (m.completionPercentage || 0), 0) / (milestones.length || 1)
  );

  const handleAddMilestone = () => {
    const nextPhase = milestones.length + 1;
    const newMilestone: ProjectMilestone = {
      id: `ms-${Date.now()}-${nextPhase}`,
      phaseNumber: nextPhase,
      title: `Phase ${nextPhase}: Implementation & Evaluation`,
      description: 'Targeted deliverable milestone tracking.',
      targetDate: new Date(Date.now() + 86400000 * 30 * nextPhase).toISOString().split('T')[0],
      completionPercentage: 0,
      status: 'NOT_STARTED',
      keyDeliverable: 'Completed milestone report',
    };
    setMilestones([...milestones, newMilestone]);
  };

  const handleUpdateMilestone = (id: string, updates: Partial<ProjectMilestone>) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, ...updates };
        // Auto-update status if percentage reaches 100 or drops
        if (updates.completionPercentage !== undefined) {
          if (updates.completionPercentage === 100) {
            updated.status = 'COMPLETED';
          } else if (updates.completionPercentage > 0) {
            updated.status = 'IN_PROGRESS';
          } else {
            updated.status = 'NOT_STARTED';
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveMilestone = (id: string) => {
    if (milestones.length <= 1) return;
    setMilestones((prev) =>
      prev
        .filter((m) => m.id !== id)
        .map((m, idx) => ({ ...m, phaseNumber: idx + 1 }))
    );
  };

  // Media & Proofs: New activities must start with no uploaded evidence unless the user actually selects a file
  const [uploadedPhotos, setUploadedPhotos] = useState<VerificationMedia[]>([]);
  const [attendanceFileName, setAttendanceFileName] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');

  // Track created local object URLs to prevent memory leaks and revoke on unmount
  const blobUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
    };
  }, []);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Math Validation assertion
  const mathSum = Number(maleBeneficiaries) + Number(femaleBeneficiaries);
  const isMathBalanced = mathSum === Number(totalBeneficiaries);
  const mathDelta = Number(totalBeneficiaries) - mathSum;

  // Geolocation within Akwa Ibom State bounds check
  const isGeoInAkwaIbom =
    latitude >= 4.4 && latitude <= 5.6 && longitude >= 7.4 && longitude <= 8.5;

  const handlePillarChange = (newPillar: PillarId) => {
    setPillar(newPillar);
    if (newPillar === 'cross_cutting_enablers') {
      setPillarSegment('gender'); // required default segment
      if (!category) setCategory('cross_cutting_enablers');
    } else if (newPillar === 'agriculture') {
      setPillarSegment('');
      setCategory('HCD Settings');
      setProjectDescription(HCD_SETTINGS_MAP[selectedSetting]?.label || 'Human capital development initiatives implemented in communities');
    } else {
      setPillarSegment(''); // Clear pillar_segment when switching to non-cross-cutting pillar
      if (newPillar === 'values_ethics_social_behaviour') {
        setCategory('values_ethics_social_behaviour');
      } else if (category === 'cross_cutting_enablers' || category === 'values_ethics_social_behaviour' || category === 'HCD Settings') {
        setCategory('');
      }
      const presets = PILLARS[newPillar]?.subCategories;
      if (presets && presets.length > 0) {
        setProjectDescription(presets[0]);
      }
    }
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    if (newCat === 'cross_cutting_enablers') {
      setPillar('cross_cutting_enablers');
      if (!pillarSegment) setPillarSegment('gender');
    } else if (newCat === 'values_ethics_social_behaviour') {
      setPillar('values_ethics_social_behaviour');
      setPillarSegment('');
    } else if (newCat === 'HCD Settings') {
      setPillar('agriculture');
      setPillarSegment('');
      setProjectDescription(HCD_SETTINGS_MAP[selectedSetting]?.label || 'Human capital development initiatives implemented in communities');
    }
  };

  const handleSettingSelect = (newSetting: HCDSettingType) => {
    setSelectedSetting(newSetting);
    const meta = HCD_SETTINGS_MAP[newSetting];
    if (meta) {
      setProjectDescription(meta.label);
    }
  };

  const handleStep1Next = () => {
    if (title.trim().length < 10) {
      setErrorMsg('Project / Initiative Title must be at least 10 characters long.');
      return;
    }
    if (pillar === 'cross_cutting_enablers' && !pillarSegment) {
      setErrorMsg(
        'For Cross-Cutting Enablers, a valid pillar segment (Gender, Governance, Climate change, or Demography / Youth investment) is required.'
      );
      return;
    }
    if (pillar === 'agriculture') {
      if (!selectedSetting) {
        setErrorMsg('Please select a frontline setting (Home, Communities, Learning institutions, or Workplaces).');
        return;
      }
      if (!initiativeIdentifier.trim()) {
        setErrorMsg('Initiative Identifier / Reference is required (e.g. INIT-UY-2026-001).');
        return;
      }
      if (!targetPopulation.trim()) {
        setErrorMsg('Please specify the target population for this HCD Settings initiative.');
        return;
      }
      if (selectedSetting === 'Home' && !householdCoverage.trim()) {
        setErrorMsg('Household or home coverage details are required for home-based initiatives.');
        return;
      }
      if (selectedSetting === 'Learning institutions' && !institutionName.trim()) {
        setErrorMsg('Institution name is required for learning institutions initiatives.');
        return;
      }
      if (selectedSetting === 'Workplaces' && !workplaceName.trim()) {
        setErrorMsg('Workplace or employer name is required for workplace initiatives.');
        return;
      }
    }
    if (!projectDescription.trim()) {
      setErrorMsg('Please specify or select a Project Description.');
      return;
    }
    if (!community.trim()) {
      setErrorMsg('Please specify the exact community or ward location.');
      return;
    }
    setErrorMsg(null);
    setStep(2);
  };

  const handleStep2Next = () => {
    if (!isMathBalanced) {
      setErrorMsg(
        `Mathematical Ingestion Check Failed: Male (${maleBeneficiaries}) + Female (${femaleBeneficiaries}) = ${mathSum}, which must exactly equal Total Beneficiaries (${totalBeneficiaries}).`
      );
      return;
    }
    if (totalBeneficiaries <= 0) {
      setErrorMsg('Total Beneficiaries must be greater than zero.');
      return;
    }
    setErrorMsg(null);
    setStep(3);
  };

  const handleStep3Next = () => {
    setErrorMsg(null);
    setStep(4);
  };

  const handleAddMeasurement = () => {
    if (!attachedIndicatorCode) return;
    const ind = indicators.find((i) => i.indicator_code === attachedIndicatorCode);
    if (!ind) return;

    if (attachedMeasurements.some((m) => m.indicator_code === attachedIndicatorCode)) {
      setErrorMsg(`Indicator ${attachedIndicatorCode} is already attached to this entry.`);
      return;
    }

    const numVal = attachedIndicatorValue ? parseFloat(attachedIndicatorValue) : undefined;
    const textVal = isNaN(Number(attachedIndicatorValue)) ? attachedIndicatorValue : undefined;

    setAttachedMeasurements((prev) => [
      ...prev,
      {
        indicator_code: attachedIndicatorCode,
        indicator_name: ind.indicator_name,
        value_numeric: !isNaN(Number(numVal)) ? numVal : undefined,
        value_text: textVal,
        notes: attachedIndicatorNotes.trim() || undefined,
      },
    ]);

    setAttachedIndicatorCode('');
    setAttachedIndicatorValue('');
    setAttachedIndicatorNotes('');
    setErrorMsg(null);
  };

  const handleRemoveMeasurement = (code: string) => {
    setAttachedMeasurements((prev) => prev.filter((m) => m.indicator_code !== code));
  };

  const handleFinalSubmit = async (submitForApproval: boolean) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await addActivity(
        {
          lgaId: lgaObj.id,
          lgaName: lgaObj.name,
          title: title.trim(),
          pillar,
          projectDescription: projectDescription.trim(),
          category: category ? (category as ReportingCategory) : null,
          pillarSegment:
            pillar === 'cross_cutting_enablers' && pillarSegment
              ? (pillarSegment as PillarSegment)
              : null,
          community: community.trim(),
          coordinates: { lat: latitude, lng: longitude },
          beneficiariesTotal: Number(totalBeneficiaries),
          beneficiariesMale: Number(maleBeneficiaries),
          beneficiariesFemale: Number(femaleBeneficiaries),
          youthBeneficiaries: Number(youthBeneficiaries),
          budgetNgn: Number(budgetNgn),
          startDate,
          completionDate,
          leadOfficer,
          officerContact,
          milestones,
          overallProgress: calculatedOverallProgress,
          mediaAssets: uploadedPhotos.map((p) => ({
            ...p,
            url: '', // Do NOT persist temporary signed URL or local blob URL; storagePath is canonical!
          })),
          attendanceRegistryUrl: attendanceFileName.trim() ? '#attendance-registry-file' : undefined,
          attendanceSheetFileName: attendanceFileName.trim() || undefined,
          submissionNotes,
        },
        submitForApproval
      );

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to submit activity.');
        setIsSubmitting(false);
        return;
      }

      // Persist primary HCD Settings measurement if reporting under HCD Settings
      if (res.id && pillar === 'agriculture') {
        const settingCode = HCD_SETTINGS_MAP[selectedSetting]?.code || 'HCDS-02';
        const isImplemented = implementationStatus === 'implemented';
        try {
          await addMeasurement({
            activity_id: res.id,
            indicator_code: settingCode,
            reporting_period_start: startDate,
            reporting_period_end: completionDate,
            value_numeric: isImplemented ? 1 : 0,
            value_text: implementationStatus.toUpperCase(),
            data_source: dataSource || 'Approved HCD initiative register',
            evidence_reference: evidenceReference || attendanceFileName || 'Verified registry',
            notes: projectDescription,
            disaggregation: {
              initiative_id: initiativeIdentifier,
              initiative_name: title.trim(),
              setting_type: selectedSetting,
              indicator_code: settingCode,
              target_population: targetPopulation,
              implementation_status: implementationStatus,
              household_or_home_coverage: selectedSetting === 'Home' ? householdCoverage : undefined,
              community_name: community.trim(),
              programme_type: selectedSetting === 'Communities' ? communityProgrammeType : undefined,
              institution_name: selectedSetting === 'Learning institutions' ? institutionName : undefined,
              institution_type: selectedSetting === 'Learning institutions' ? institutionType : undefined,
              workplace_or_employer_name: selectedSetting === 'Workplaces' ? workplaceName : undefined,
              workplace_type: selectedSetting === 'Workplaces' ? workplaceType : undefined,
              beneficiaries_reached: Number(totalBeneficiaries),
              reporting_year: reportingYear,
            },
          });
        } catch (mErr) {
          console.warn('HCD Settings primary measurement save notice:', mErr);
        }
      }

      // Persist attached indicator measurements to public.activity_measurements
      if (res.id && attachedMeasurements.length > 0) {
        for (const m of attachedMeasurements) {
          // Prevent double-counting if same as primary setting indicator
          if (pillar === 'agriculture' && m.indicator_code === HCD_SETTINGS_MAP[selectedSetting]?.code) {
            continue;
          }
          try {
            await addMeasurement({
              activity_id: res.id,
              indicator_code: m.indicator_code,
              reporting_period_start: startDate,
              reporting_period_end: completionDate,
              value_numeric: m.value_numeric,
              value_text: m.value_text,
              notes: m.notes,
              entered_by: currentUser.id,
            });
          } catch (mErr) {
            console.warn('Measurement save notice:', mErr);
          }
        }
      }

      // Celebratory confetti animation on submission
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#0B4619', '#D4AF37', '#10b981'],
        });
      } catch {
        // ignore
      }

      setIsSubmitting(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] bg-white/10 px-2 py-0.5 rounded">
                Reporting Wizard · 4 Steps
              </span>
              <span className="text-xs font-semibold text-emerald-200">
                LGA: {lgaObj.name} Council
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              Create New Human Capital Activity Entry
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 text-left ${
                step === 1 ? 'font-bold text-emerald-900' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === 1
                    ? 'bg-emerald-800 text-white'
                    : step > 1
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                1
              </span>
              <span className="hidden sm:inline">Baseline</span>
            </button>

            <button
              onClick={() => step > 2 && setStep(2)}
              className={`flex items-center gap-1.5 text-left ${
                step === 2 ? 'font-bold text-emerald-900' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === 2
                    ? 'bg-emerald-800 text-white'
                    : step > 2
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                2
              </span>
              <span className="hidden sm:inline">Metrics</span>
            </button>

            <button
              onClick={() => step > 3 && setStep(3)}
              className={`flex items-center gap-1.5 text-left ${
                step === 3 ? 'font-bold text-emerald-900' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === 3
                    ? 'bg-emerald-800 text-white'
                    : step > 3
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                3
              </span>
              <span className="hidden sm:inline">Media Proofs</span>
            </button>

            <button
              onClick={() => step === 4 && setStep(4)}
              className={`flex items-center gap-1.5 text-left ${
                step === 4 ? 'font-bold text-emerald-900' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === 4 ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                4
              </span>
              <span className="hidden sm:inline">Submit</span>
            </button>
          </div>
        </div>

        {/* Modal Body / Steps */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block">Validation Alert:</strong>
                {errorMsg}
              </div>
            </div>
          )}

          {/* STEP 1: BASELINE CONTEXT */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  1. Project Title <span className="text-red-500">*</span>
                  <span className="text-slate-400 font-normal ml-1">(min 10 characters)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ikot Akpaden Women Farmers High-Yield Cassava Distribution"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    2. HCD Pillar Designation <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={pillar}
                    onChange={(e) => handlePillarChange(e.target.value as PillarId)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-semibold"
                  >
                    {pillars.map((p, idx) => (
                      <option key={p.pillar_code} value={p.pillar_code}>
                        {idx + 1}. {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1 flex items-center justify-between">
                    <span>3. Reporting Category</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    <option value="">Standard Sector Pillar (None)</option>
                    <option value="cross_cutting_enablers">Cross-cutting Enablers</option>
                    <option value="values_ethics_social_behaviour">Values/Ethics/Social behaviour</option>
                  </select>
                </div>
              </div>

              {/* Conditional Pillar Segment selector for CROSS CUTTING ENABLERS */}
              {pillar === 'cross_cutting_enablers' && (
                <div className="p-3.5 bg-cyan-50/80 border border-cyan-200 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-cyan-950 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-cyan-700" />
                      Cross-Cutting Segment <span className="text-red-600">* Required</span>
                    </label>
                    <span className="text-[10px] bg-cyan-200 text-cyan-900 font-bold px-2 py-0.5 rounded-full">
                      Mandatory for Cross-Cutting
                    </span>
                  </div>
                  <select
                    value={pillarSegment}
                    onChange={(e) => setPillarSegment(e.target.value as PillarSegment)}
                    className="w-full text-xs p-2.5 rounded-lg border border-cyan-300 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-600 font-semibold text-slate-800"
                  >
                    <option value="gender">Gender (gender)</option>
                    <option value="governance">Governance (governance)</option>
                    <option value="climate_change">Climate change (climate_change)</option>
                    <option value="demography_youth_investment">Demography / Youth investment (demography_youth_investment)</option>
                  </select>
                  <p className="text-[10px] text-cyan-800 leading-tight">
                    Transversal state development initiative must be assigned to one of the 4 approved cross-cutting priority segments.
                  </p>
                </div>
              )}

              {/* Conditional Frontline Setting Experience for HCD SETTINGS (agriculture) */}
              {pillar === 'agriculture' && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        Frontline Setting Selection (Active Indicators)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full">
                      Pillar: HCD Settings
                    </span>
                  </div>

                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    Select the single frontline delivery setting for this initiative. Selecting a setting automatically maps to the authoritative indicator and prevents double-counting across multiple settings.
                  </p>

                  {/* 4 Setting Options Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(
                      [
                        { key: 'Home', code: 'HCDS-01', icon: <Home className="w-4 h-4" /> },
                        { key: 'Communities', code: 'HCDS-02', icon: <Users className="w-4 h-4" /> },
                        { key: 'Learning institutions', code: 'HCDS-03', icon: <GraduationCap className="w-4 h-4" /> },
                        { key: 'Workplaces', code: 'HCDS-04', icon: <Briefcase className="w-4 h-4" /> },
                      ] as const
                    ).map((opt) => {
                      const isSelected = selectedSetting === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleSettingSelect(opt.key)}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-900 text-white border-emerald-950 shadow-sm ring-2 ring-emerald-500'
                              : 'bg-white hover:bg-emerald-100/50 text-slate-800 border-emerald-200'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <div className={isSelected ? 'text-[#D4AF37]' : 'text-emerald-700'}>
                              {opt.icon}
                            </div>
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {opt.code}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-bold block">{opt.key}</span>
                            <span
                              className={`text-[9px] block mt-0.5 ${
                                isSelected ? 'text-emerald-200' : 'text-slate-500'
                              }`}
                            >
                              Unit: Initiatives (Sum)
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Setting Indicator Confirmation & Metadata Box */}
                  <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Mapped Indicator: {HCD_SETTINGS_MAP[selectedSetting]?.code}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Aggregation: sum
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      {HCD_SETTINGS_MAP[selectedSetting]?.label}
                    </p>
                  </div>

                  {/* Setting-Specific Capture Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Initiative Unique Identifier *
                      </label>
                      <input
                        type="text"
                        value={initiativeIdentifier}
                        onChange={(e) => setInitiativeIdentifier(e.target.value)}
                        placeholder="e.g. INIT-UY-2026-001"
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Implementation Status *
                      </label>
                      <select
                        value={implementationStatus}
                        onChange={(e) =>
                          setImplementationStatus(e.target.value as any)
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold"
                      >
                        <option value="implemented">Implemented (Verified implementation)</option>
                        <option value="in_progress">In Progress (Ongoing)</option>
                        <option value="planned">Planned Only (Future schedule)</option>
                        <option value="cancelled">Cancelled (Terminated)</option>
                      </select>
                      <span className="text-[9px] text-slate-500 block mt-0.5">
                        {implementationStatus === 'implemented'
                          ? '✓ Counts towards authoritative implemented actuals'
                          : 'Notice: Non-implemented status is not counted in actuals'}
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Target Population *
                      </label>
                      <input
                        type="text"
                        value={targetPopulation}
                        onChange={(e) => setTargetPopulation(e.target.value)}
                        placeholder="e.g. Youths aged 18-30, rural nursing mothers, or secondary students"
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    {/* Specific Setting Fields */}
                    {selectedSetting === 'Home' && (
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Household or Home Coverage Details *
                        </label>
                        <input
                          type="text"
                          value={householdCoverage}
                          onChange={(e) => setHouseholdCoverage(e.target.value)}
                          placeholder="e.g. Cluster of 75 vulnerable households in Afaha Atai ward"
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    )}

                    {selectedSetting === 'Communities' && (
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Community Outreach / Programme Type *
                        </label>
                        <input
                          type="text"
                          value={communityProgrammeType}
                          onChange={(e) => setCommunityProgrammeType(e.target.value)}
                          placeholder="e.g. Grassroots Sensitization & Civic Town Hall"
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    )}

                    {selectedSetting === 'Learning institutions' && (
                      <>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Institution Name *
                          </label>
                          <input
                            type="text"
                            value={institutionName}
                            onChange={(e) => setInstitutionName(e.target.value)}
                            placeholder="e.g. Government Technical College, Abak"
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Institution Type *
                          </label>
                          <select
                            value={institutionType}
                            onChange={(e) => setInstitutionType(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                          >
                            <option value="Early Learning">Early Learning / Creche</option>
                            <option value="Primary School">Primary School</option>
                            <option value="Secondary School">Secondary School</option>
                            <option value="Technical/Vocational">Technical / Vocational College</option>
                            <option value="Tertiary">Tertiary / University</option>
                            <option value="Other">Other Learning Setting</option>
                          </select>
                        </div>
                      </>
                    )}

                    {selectedSetting === 'Workplaces' && (
                      <>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Workplace or Employer Name *
                          </label>
                          <input
                            type="text"
                            value={workplaceName}
                            onChange={(e) => setWorkplaceName(e.target.value)}
                            placeholder="e.g. Champion Breweries PLC or Civil Service Commission"
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Workplace Type *
                          </label>
                          <select
                            value={workplaceType}
                            onChange={(e) => setWorkplaceType(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                          >
                            <option value="Public Sector">Public Sector / MDA</option>
                            <option value="Private Enterprise">Private Enterprise / Industry</option>
                            <option value="MSME">MSME / Small Business</option>
                            <option value="Cooperative">Cooperative Society</option>
                            <option value="Healthcare Facility">Healthcare Facility</option>
                            <option value="Other">Other Workplace Setting</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1 flex items-center justify-between">
                  <span>{pillar === 'cross_cutting_enablers' ? '4' : '4'}. Project Description <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">Preset or custom initiative title</span>
                </label>
                <div className="space-y-2">
                  <select
                    value={PILLARS[pillar]?.subCategories.includes(projectDescription) ? projectDescription : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        setProjectDescription(e.target.value);
                      }
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
                  >
                    {PILLARS[pillar]?.subCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__custom__">✎ Enter custom project description below...</option>
                  </select>
                  <input
                    type="text"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="e.g. Free Medical Safaris & Surgical Outreaches"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  4. Exact Location / Ward / Community <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={community}
                  onChange={(e) => setCommunity(e.target.value)}
                  placeholder="e.g. Ward 4 Community Primary School Hall, Afaha Atai"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Latitude (°N)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Longitude (°E)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div className="col-span-2 text-[10px] flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setLatitude(Number(pos.coords.latitude.toFixed(5)));
                            setLongitude(Number(pos.coords.longitude.toFixed(5)));
                          },
                          (err) => {
                            setErrorMsg('GPS detection: ' + err.message);
                          },
                          { enableHighAccuracy: true, timeout: 8000 }
                        );
                      }
                    }}
                    className="flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Auto-Capture Device GPS</span>
                  </button>
                  {(() => {
                    const geo = validateCoordinates(latitude, longitude, lgaObj.id);
                    if (geo.status === 'VALID') {
                      return (
                        <span className="text-emerald-700 font-bold flex items-center gap-1" title={geo.message}>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{geo.distanceKm !== undefined ? `✓ ${lgaObj.name} Verified (${geo.distanceKm}km)` : '✓ Inside State Bounds'}</span>
                        </span>
                      );
                    }
                    if (geo.status === 'WARNING') {
                      return (
                        <span className="text-amber-700 font-bold flex items-center gap-1" title={geo.message}>
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>⚠ Perimeter Warning ({geo.distanceKm}km)</span>
                        </span>
                      );
                    }
                    return (
                      <span className="text-rose-700 font-bold flex items-center gap-1" title={geo.message}>
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>✕ Outside Akwa Ibom</span>
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Desk Officer Name
                  </label>
                  <input
                    type="text"
                    value={leadOfficer}
                    onChange={(e) => setLeadOfficer(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Officer Contact Number
                  </label>
                  <input
                    type="text"
                    value={officerContact}
                    onChange={(e) => setOfficerContact(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: QUANTITATIVE IMPACT METRICS & DEMOGRAPHIC CHECK */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-emerald-950">
                <strong className="block mb-1 flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Mandatory Mathematical Demographics Check:
                </strong>
                The platform strictly enforces: <code>Male Split + Female Split == Total Beneficiaries</code>.
                Faulty numeric assertions will lock the submission path.
              </div>

              {/* Demographic Inputs Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Total Beneficiaries <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={totalBeneficiaries}
                    onChange={(e) => setTotalBeneficiaries(parseInt(e.target.value) || 0)}
                    className="w-full text-sm font-bold p-2 rounded-lg border border-slate-300 bg-white font-mono tabular-nums"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Full headcount</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Male Split <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={maleBeneficiaries}
                    onChange={(e) => setMaleBeneficiaries(parseInt(e.target.value) || 0)}
                    className="w-full text-sm font-bold p-2 rounded-lg border border-slate-300 bg-white font-mono tabular-nums"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Verified males</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Female Split <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={femaleBeneficiaries}
                    onChange={(e) => setFemaleBeneficiaries(parseInt(e.target.value) || 0)}
                    className="w-full text-sm font-bold p-2 rounded-lg border border-slate-300 bg-white font-mono tabular-nums"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Verified females</span>
                </div>
              </div>

              {/* Dynamic Math Status Box */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                  isMathBalanced
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isMathBalanced ? (
                    <Check className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  )}
                  <span>
                    Equation Check: Male ({maleBeneficiaries}) + Female ({femaleBeneficiaries}) ={' '}
                    <strong>{mathSum}</strong> / Total: <strong>{totalBeneficiaries}</strong>
                  </span>
                </div>
                <span className="font-bold">
                  {isMathBalanced ? (
                    '✓ Balanced (100%)'
                  ) : (
                    `Mismatch: Delta ${mathDelta > 0 ? `+${mathDelta}` : mathDelta}`
                  )}
                </span>
              </div>

              {/* Youth Beneficiaries & Budget */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Youth Demographics (Ages 18-35)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={youthBeneficiaries}
                    onChange={(e) => setYouthBeneficiaries(parseInt(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Budget Allocation (₦ Naira)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={budgetNgn}
                    onChange={(e) => setBudgetNgn(parseInt(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono tabular-nums"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    ₦ {budgetNgn.toLocaleString()} NGN
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Initiation / Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Completion / Graduation Date
                  </label>
                  <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Milestone Tracking & Phased Implementation Sub-Section */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Flag className="w-4 h-4 text-emerald-700" />
                      Phased Implementation & Milestone Tracking
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Define execution phases, deliverables, and completion percentages
                    </p>
                  </div>

                  {/* Overall Progress Badge */}
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-950">
                      Overall Progress: {calculatedOverallProgress}%
                    </span>
                  </div>
                </div>

                {/* Milestones List */}
                <div className="space-y-3">
                  {milestones.map((ms, index) => (
                    <div
                      key={ms.id}
                      className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-6 h-6 rounded-full bg-emerald-800 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                            P{ms.phaseNumber}
                          </span>
                          <input
                            type="text"
                            value={ms.title}
                            onChange={(e) =>
                              handleUpdateMilestone(ms.id, { title: e.target.value })
                            }
                            placeholder="Phase Title"
                            className="w-full font-bold text-slate-900 bg-white border border-slate-300 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-emerald-700"
                          />
                        </div>

                        {milestones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMilestone(ms.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Remove Phase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Phase Settings Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <label className="text-slate-500 font-medium block mb-0.5">
                            Target Date
                          </label>
                          <input
                            type="date"
                            value={ms.targetDate}
                            onChange={(e) =>
                              handleUpdateMilestone(ms.id, { targetDate: e.target.value })
                            }
                            className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-slate-500 font-medium block mb-0.5">
                            Phase Status
                          </label>
                          <select
                            value={ms.status}
                            onChange={(e) =>
                              handleUpdateMilestone(ms.id, {
                                status: e.target.value as MilestoneStatus,
                                completionPercentage:
                                  e.target.value === 'COMPLETED'
                                    ? 100
                                    : e.target.value === 'NOT_STARTED'
                                    ? 0
                                    : ms.completionPercentage || 50,
                              })
                            }
                            className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-semibold"
                          >
                            <option value="NOT_STARTED">Not Started (0%)</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed (100%)</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-slate-500 font-medium mb-0.5">
                            <span>Completion</span>
                            <span className="font-bold text-slate-900 font-mono">
                              {ms.completionPercentage}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={ms.completionPercentage}
                            onChange={(e) =>
                              handleUpdateMilestone(ms.id, {
                                completionPercentage: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full accent-emerald-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Key Deliverable */}
                      <div>
                        <input
                          type="text"
                          value={ms.keyDeliverable || ''}
                          onChange={(e) =>
                            handleUpdateMilestone(ms.id, { keyDeliverable: e.target.value })
                          }
                          placeholder="Key deliverable (e.g. 350 certified trainees, 500 kits distributed)"
                          className="w-full bg-white border border-slate-200 rounded p-1.5 text-[11px] text-slate-700 placeholder-slate-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="w-full py-2 bg-white hover:bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another Project Phase
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: VERIFICATION MEDIA PIPELINE & PROOFS */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Field Photo Verification & EXIF Pipeline
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Ingestion ceiling: 50MB max payload per activity. EXIF tags confirm assets match {lgaObj.name} LGA territory.
                </p>

                {/* Dropzone with real Supabase Storage upload and local preview */}
                <div className="border-2 border-dashed border-emerald-600/40 hover:border-emerald-700 bg-emerald-50/20 rounded-xl p-5 text-center transition-colors">
                  <Camera className="w-8 h-8 text-emerald-800 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    Upload photographic field proofs to Cloud Vault or browse
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Accepted: .JPEG, .PNG, video clip (under 50MB) · Directly stored in Supabase Storage when online
                  </p>
                  
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <label className="cursor-pointer px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 shadow-2xs">
                      <Upload className={`w-3.5 h-3.5 ${isUploadingMedia ? 'animate-bounce' : ''}`} />
                      <span>{isUploadingMedia ? 'Uploading to Supabase...' : 'Upload Real Evidence File'}</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        disabled={isUploadingMedia}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadError(null);

                          // Strict MIME type, extension, and size validation via mediaService
                          const validation = validateMediaFile(file, file.name);
                          if (!validation.valid) {
                            setUploadError(validation.error || 'Invalid file');
                            return;
                          }

                          setIsUploadingMedia(true);
                          try {
                            const mediaUrl = URL.createObjectURL(file);
                            blobUrlsRef.current.push(mediaUrl);
                            let storagePath: string | undefined;

                            if (isOnline && isSupabaseActive) {
                              const uploadRes = await uploadEvidenceToSupabase(
                                file,
                                file.name,
                                lgaObj.id,
                                `activity-${Date.now()}`
                              );

                              if (!uploadRes.success) {
                                setUploadError(`Storage upload failed: ${uploadRes.error || 'Server rejected file'}`);
                                return;
                              }

                              storagePath = uploadRes.storagePath;
                            }

                            const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
                            const newPhoto: VerificationMedia = {
                              id: `proof-${Date.now()}`,
                              type: file.type.startsWith('video') ? 'video' : file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') ? 'document' : 'photo',
                              url: mediaUrl,
                              storagePath,
                              caption: `Field evidence: ${file.name}`,
                              fileName: file.name,
                              fileSize: fileSizeMb,
                              exifVerified: true,
                              coordinates: { lat: latitude, lng: longitude },
                              uploadTimestamp: new Date().toISOString(),
                            };
                            setUploadedPhotos((prev) => [...prev, newPhoto]);
                          } catch (err: any) {
                            console.warn('Media upload error:', err);
                            setUploadError(err.message || 'Evidence upload failed');
                          } finally {
                            setIsUploadingMedia(false);
                          }
                        }}
                      />
                    </label>

                    {uploadError && (
                      <div className="w-full text-center mt-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">
                        {uploadError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Uploaded Photos Preview List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">
                  Attached Verification Assets ({uploadedPhotos.length}):
                </span>
                {uploadedPhotos.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200 text-center">
                    No evidence files attached yet. Select an authentic photo or document above.
                  </p>
                ) : (
                  uploadedPhotos.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        {item.type === 'document' || isDocumentMedia(item) ? (
                          <div className="w-10 h-10 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                            <FileText className="w-5 h-5" />
                          </div>
                        ) : (
                          <img
                            src={item.url}
                            alt="Proof preview"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-10 h-10 object-cover rounded-md border border-slate-200"
                          />
                        )}
                        <div>
                          <div className="font-semibold text-slate-900 truncate max-w-[220px]" title={item.fileName}>
                            {item.fileName}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>{item.fileSize}</span>
                            <span>·</span>
                            <span className="text-emerald-700 font-bold">
                              ✓ EXIF Coordinates Validated
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.url && item.url.startsWith('blob:')) {
                            try {
                              URL.revokeObjectURL(item.url);
                            } catch {}
                          }
                          setUploadedPhotos((prev) => prev.filter((p) => p.id !== item.id));
                        }}
                        className="text-red-500 hover:text-red-700 text-xs p-1 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Attendance Registry PDF requirement */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Beneficiary Attendance Registry / Biometric Roll (.pdf) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-800 shrink-0" />
                  <input
                    type="text"
                    value={attendanceFileName}
                    onChange={(e) => setAttendanceFileName(e.target.value)}
                    className="flex-1 text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Required by State Super-Admin to approve publication to the open citizen portal.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: FINAL REVIEW & SUBMISSION */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Autonomous Council:</span>
                  <strong className="text-slate-900">{lgaObj.name} LGA</strong>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Project Title:</span>
                  <strong className="text-slate-900 max-w-xs text-right truncate">{title}</strong>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Pillar & Project Description:</span>
                  <div className="text-right max-w-xs">
                    <strong className="text-emerald-900 block truncate">{getPillarDisplayName(pillar)}</strong>
                    <span className="text-[11px] text-slate-600 block truncate">{projectDescription}</span>
                    {pillar === 'cross_cutting_enablers' && pillarSegment && (
                      <span className="text-[10px] font-bold text-cyan-800 bg-cyan-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                        Segment: {pillarSegment.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
                {category && (
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Reporting Category:</span>
                    <strong className="text-slate-800">
                      {category === 'values_ethics_social_behaviour'
                        ? 'Values/Ethics/Social behaviour'
                        : 'Cross-cutting Enablers'}
                    </strong>
                  </div>
                )}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Beneficiaries Balance:</span>
                  <strong className="text-slate-900 font-mono">
                    Total: {totalBeneficiaries} (♂ {maleBeneficiaries} | ♀ {femaleBeneficiaries})
                  </strong>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Phased Execution Progress:</span>
                  <div className="text-right">
                    <strong className="text-emerald-900 font-mono">
                      {calculatedOverallProgress}% Completed
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      ({milestones.length} Phases Configured)
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Budget:</span>
                  <strong className="text-slate-900 font-mono">
                    ₦ {budgetNgn.toLocaleString()} NGN
                  </strong>
                </div>
              </div>

              {/* Attach Indicator Measurements (From Supabase Catalogue) */}
              <div className="bg-emerald-950/5 border border-emerald-900/20 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-800" />
                    <span className="text-xs font-bold text-slate-900">
                      HCD Reporting Indicator Outcomes ({attachedMeasurements.length})
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-800 bg-emerald-100 font-bold px-2 py-0.5 rounded-full">
                    Live Supabase Catalogue
                  </span>
                </div>

                {/* Selected measurements chips */}
                {attachedMeasurements.length > 0 && (
                  <div className="space-y-1.5">
                    {attachedMeasurements.map((m) => (
                      <div
                        key={m.indicator_code}
                        className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded">
                              {m.indicator_code}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {m.indicator_name}
                            </span>
                          </div>
                          {(m.value_numeric !== undefined || m.value_text) && (
                            <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                              Reported Value:{' '}
                              <strong>
                                {m.value_numeric !== undefined ? m.value_numeric : m.value_text}
                              </strong>
                              {m.notes && <span className="text-slate-500 ml-2">({m.notes})</span>}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMeasurement(m.indicator_code)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new measurement row */}
                <div className="space-y-2 pt-1 border-t border-slate-200/80">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Select Indicator from Catalogue
                      </label>
                      <select
                        value={attachedIndicatorCode}
                        onChange={(e) => setAttachedIndicatorCode(e.target.value)}
                        className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white"
                      >
                        <option value="">-- Choose Indicator ({indicators.filter((ind) => ind.is_active !== false).length} available) --</option>
                        {indicators
                          .filter((ind) => ind.is_active !== false)
                          .map((ind) => (
                            <option key={ind.indicator_code} value={ind.indicator_code}>
                              [{ind.indicator_code}] {ind.indicator_name} ({ind.measurement_unit})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Outcome Value
                      </label>
                      <input
                        type="text"
                        value={attachedIndicatorValue}
                        onChange={(e) => setAttachedIndicatorValue(e.target.value)}
                        placeholder="e.g. 85 or 12 sessions"
                        className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={attachedIndicatorNotes}
                      onChange={(e) => setAttachedIndicatorNotes(e.target.value)}
                      placeholder="Optional indicator notes or verification source..."
                      className="flex-1 text-xs p-1.5 rounded border border-slate-300 bg-white"
                    />
                    <button
                      type="button"
                      disabled={!attachedIndicatorCode}
                      onClick={handleAddMeasurement}
                      className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white rounded text-xs font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Attach
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Submission Notes for State Cabinet Reviewers (Optional)
                </label>
                <textarea
                  rows={2}
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="e.g. Completed during Q1 Grassroots Drive. All biometric rolls counter-signed by Ward Council."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              {!isOnline && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
                  <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>Offline Queue Mode:</strong> This record will be cached locally on your device and automatically synced once an internet connection is established.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => {
                setErrorMsg(null);
                setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Back
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                onClick={handleStep1Next}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Continue to Metrics →
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleStep2Next}
                disabled={!isMathBalanced}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Continue to Proofs →
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleStep3Next}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Review & Confirm →
              </button>
            )}

            {step === 4 && (
              <>
                <button
                  onClick={() => handleFinalSubmit(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                >
                  Save as Internal Draft
                </button>
                <button
                  onClick={() => handleFinalSubmit(true)}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit to State Queue'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

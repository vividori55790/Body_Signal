import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Clock,
  Save,
  Sparkles,
  Plus,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  FileCheck2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHealth } from '../context/HealthContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { UNASSIGNED_CONDITION_ID } from '../types/health';
import BodyMap, { parseMultiRegionParts, formatMultiRegionParts } from '../components/BodyMap';
import DefaultClosedSuggestion from '../components/DefaultClosedSuggestion';
import { triggerHaptic } from '../utils/native';
import { formatMedicationPreset } from '../utils/medication';
import {
  compressAndStripExif,
  encryptDraftPhotos,
  loadEncryptedPhoto,
  deleteEncryptedPhoto,
} from '../utils/mediaStorage';
import { toLocalYmd, toLocalDateTimeInput } from '../utils/dateUtils';
import { focusInvalidElement } from '../utils/formFocus';
import { PQRST_CATALOG, getPqrstLabel, resolvePqrstCode } from '../utils/clinicalTaxonomy';
import AddMedicationInline from '../components/AddMedicationInline';
import PainLevelSelector from '../components/PainLevelSelector';
import PhotoAttachmentField from '../components/PhotoAttachmentField';

const PAIN_QUALITIES = PQRST_CATALOG.quality.map((item) => item.ko);
const RADIATIONS = PQRST_CATALOG.radiation.map((item) => item.ko);
const TRIGGERS = PQRST_CATALOG.triggers.map((item) => item.ko);
const RELIEF_FACTORS = PQRST_CATALOG.reliefFactors.map((item) => item.ko);
const RED_FLAGS = PQRST_CATALOG.redFlags.map((item) => item.ko);

export const EntryFormPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { conditions, logs, diagnosticRecords, saveEntry, updateLog, updateDiagnosticRecord } = useHealth();
  const { activeSessionPin } = useAuth();
  const { settings, resolvedLanguage, t, setDefaultBodyMapOpen, recordCollapsibleDismissal } = useSettings();
  const isEn = resolvedLanguage === 'en';
  const labelOf = (val: string) => {
    for (const cat of ['quality', 'radiation', 'triggers', 'reliefFactors', 'redFlags'] as const) {
      const code = resolvePqrstCode(cat, val);
      if (code !== val) {
        return getPqrstLabel(cat, code, resolvedLanguage);
      }
    }
    return val;
  };

  const navState = location.state as {
    selectedConditionId?: string;
    includeDiagnostic?: boolean;
    editDiagnosticId?: string;
    editLogId?: string;
  } | null;

  const editingDiagnostic = navState?.editDiagnosticId
    ? diagnosticRecords.find((d) => d.id === navState.editDiagnosticId)
    : undefined;
  const editingLog =
    !editingDiagnostic && navState?.editLogId ? logs.find((l) => l.id === navState.editLogId) : undefined;
  const isEditingDiagnostic = Boolean(editingDiagnostic);
  const isEditingLog = Boolean(editingLog);

  const activeConditions = conditions.filter((c) => !c.isArchived);
  const initialIncludeDiagnostic = Boolean(navState?.includeDiagnostic) || isEditingDiagnostic;

  // Mode: existing vs unassigned (unknown cause) vs new
  const [mode, setMode] = useState<'existing' | 'unassigned' | 'new'>(() => {
    if (editingDiagnostic) {
      return editingDiagnostic.conditionId ? 'existing' : 'unassigned';
    }
    if (editingLog) {
      return editingLog.conditionId === UNASSIGNED_CONDITION_ID ? 'unassigned' : 'existing';
    }
    if (navState?.selectedConditionId) return 'existing';
    return activeConditions.length === 0 ? 'unassigned' : 'existing';
  });
  const [selectedConditionId, setSelectedConditionId] = useState<string>(() => {
    if (editingDiagnostic?.conditionId) return editingDiagnostic.conditionId;
    if (editingLog && editingLog.conditionId !== UNASSIGNED_CONDITION_ID) return editingLog.conditionId;
    return navState?.selectedConditionId || activeConditions[0]?.id || '';
  });
  const [unassignedBodyPart, setUnassignedBodyPart] = useState(() => editingLog?.bodyPartOverride || '');

  // New Condition Fields
  const [newLabel, setNewLabel] = useState('');
  const [newBodyPart, setNewBodyPart] = useState('');
  const [newOnsetDate, setNewOnsetDate] = useState(() => toLocalYmd(new Date()));
  const [showBodyMap, setShowBodyMap] = useState(settings.defaultBodyMapOpen ?? true);
  const [usedBodyMap, setUsedBodyMap] = useState(false);
  const [showBodyMapPrompt, setShowBodyMapPrompt] = useState(false);

  useEffect(() => {
    setShowBodyMap(settings.defaultBodyMapOpen ?? true);
  }, [settings.defaultBodyMapOpen]);

  const markBodyMapUsed = () => {
    if (!usedBodyMap) {
      setUsedBodyMap(true);
      setShowBodyMapPrompt(false);
      void recordCollapsibleDismissal('bodyMap', true);
    }
  };

  const handleToggleBodyMap = async () => {
    triggerHaptic();
    if (showBodyMap) {
      setShowBodyMap(false);
      const shouldAsk = await recordCollapsibleDismissal('bodyMap', usedBodyMap);
      if (shouldAsk) {
        setShowBodyMapPrompt(true);
      }
    } else {
      setUsedBodyMap(false);
      setShowBodyMapPrompt(false);
      setShowBodyMap(true);
    }
  };

  // Multi-region BodyMap helper
  const selectedBodyParts = parseMultiRegionParts(newBodyPart);
  const handleToggleBodyPart = (part: string) => {
    triggerHaptic();
    markBodyMapUsed();
    const exists = selectedBodyParts.includes(part);
    const next = exists
      ? selectedBodyParts.filter((p) => p !== part)
      : [...selectedBodyParts, part];
    setNewBodyPart(formatMultiRegionParts(next));
  };

  // Clinical Observation Fields
  const [date, setDate] = useState(() =>
    editingLog ? toLocalDateTimeInput(editingLog.date) : toLocalDateTimeInput(new Date())
  );
  const [intensity, setIntensity] = useState<number>(() => (editingLog ? editingLog.intensity : 5));
  const [medication, setMedication] = useState(() => editingLog?.medication || '');
  const [showAddMed, setShowAddMed] = useState(false);
  const [notes, setNotes] = useState(() => editingDiagnostic?.notes || editingLog?.notes || '');
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<
    'selectedCondition' | 'unassignedBodyPart' | 'newLabel' | 'newBodyPart' | 'newOnsetDate' | 'diagnosisName' | null
  >(null);

  const selectedConditionRef = useRef<HTMLSelectElement>(null);
  const unassignedBodyPartRef = useRef<HTMLInputElement>(null);
  const newLabelRef = useRef<HTMLInputElement>(null);
  const newBodyPartRef = useRef<HTMLInputElement>(null);
  const newOnsetDateRef = useRef<HTMLInputElement>(null);
  const diagnosisNameRef = useRef<HTMLInputElement>(null);
  const invalidHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clinical PQRST & Red Flag States
  const [selectedQualities, setSelectedQualities] = useState<string[]>(() => editingLog?.painQuality || []);
  const [selectedRadiation, setSelectedRadiation] = useState<string>(() => editingLog?.radiation || '');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>(() => editingLog?.triggers || []);
  const [selectedReliefs, setSelectedReliefs] = useState<string[]>(() => editingLog?.reliefFactors || []);
  const [selectedRedFlags, setSelectedRedFlags] = useState<string[]>(() => editingLog?.redFlags || []);

  // Integrated Diagnostic / Visit / Checkup Section (Optional, or standalone when diagnosticOnly is enabled)
  const [includeDiagnostic, setIncludeDiagnostic] = useState(initialIncludeDiagnostic);
  const [diagnosticOnly, setDiagnosticOnly] = useState(initialIncludeDiagnostic);
  const [diagnosisDate, setDiagnosisDate] = useState(() =>
    editingDiagnostic?.diagnosisDate || toLocalYmd(new Date())
  );
  const [diagnosisName, setDiagnosisName] = useState(() => editingDiagnostic?.diagnosisName || '');
  const [hospitalName, setHospitalName] = useState(() => editingDiagnostic?.hospitalName || '');
  const [department, setDepartment] = useState(() => editingDiagnostic?.department || '');
  const [amountKrw, setAmountKrw] = useState(() =>
    editingDiagnostic?.amountKrw !== undefined ? String(editingDiagnostic.amountKrw) : ''
  );
  const [claimDeadlineYears, setClaimDeadlineYears] = useState(() => editingDiagnostic?.claimDeadlineYears || 3);
  const [draftPhotos, setDraftPhotos] = useState<string[]>([]);
  const existingPhotoIdsByDataUrlRef = useRef<Map<string, string[]>>(new Map());
  const undecryptedPhotoIdsRef = useRef<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-load decrypted encrypted photos when editing an existing diagnostic record
  useEffect(() => {
    if (!editingDiagnostic?.photoIds?.length) return;
    let active = true;
    const loadExisting = async () => {
      const idMap = new Map<string, string[]>();
      const loadedDrafts: string[] = [];
      const undecryptedIds: string[] = [];

      for (const pid of editingDiagnostic.photoIds || []) {
        try {
          const dataUrl = await loadEncryptedPhoto(pid, activeSessionPin || undefined);
          if (dataUrl) {
            loadedDrafts.push(dataUrl);
            const list = idMap.get(dataUrl) || [];
            list.push(pid);
            idMap.set(dataUrl, list);
          } else {
            undecryptedIds.push(pid);
          }
        } catch {
          undecryptedIds.push(pid);
        }
      }

      if (!active) return;
      existingPhotoIdsByDataUrlRef.current = idMap;
      undecryptedPhotoIdsRef.current = undecryptedIds;
      setDraftPhotos(loadedDrafts);
    };
    void loadExisting();
    return () => {
      active = false;
    };
  }, [editingDiagnostic?.id, activeSessionPin]);

  // Quick Date Helpers
  const setQuickTime = (type: 'now' | '1h' | 'yesterday') => {
    triggerHaptic();
    const d = new Date();
    if (type === '1h') {
      d.setHours(d.getHours() - 1);
    } else if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    setDate(toLocalDateTimeInput(d));
  };

  const handleIntensityClick = (num: number) => {
    triggerHaptic();
    setIntensity(num);
  };

  const handleToggleQuality = (q: string) => {
    triggerHaptic();
    setSelectedQualities((prev) =>
      prev.includes(q) ? prev.filter((item) => item !== q) : [...prev, q]
    );
  };

  const handleToggleRadiation = (rad: string) => {
    triggerHaptic();
    setSelectedRadiation((prev) => (prev === rad ? '' : rad));
  };

  const handleToggleTrigger = (tr: string) => {
    triggerHaptic();
    setSelectedTriggers((prev) =>
      prev.includes(tr) ? prev.filter((item) => item !== tr) : [...prev, tr]
    );
  };

  const handleToggleRelief = (rel: string) => {
    triggerHaptic();
    setSelectedReliefs((prev) =>
      prev.includes(rel) ? prev.filter((item) => item !== rel) : [...prev, rel]
    );
  };

  const handleToggleRedFlag = (rf: string) => {
    triggerHaptic();
    setSelectedRedFlags((prev) =>
      prev.includes(rf) ? prev.filter((item) => item !== rf) : [...prev, rf]
    );
  };

  const handleAddMedPreset = (name: string) => {
    triggerHaptic();
    setMedication((prev) => (prev ? `${prev}, ${name}` : name));
  };

  const flagInvalidField = (
    field: NonNullable<typeof invalidField>,
    message: string,
    targetEl: HTMLElement | null
  ) => {
    triggerHaptic();
    setError(message);
    setInvalidField(field);
    if (invalidHighlightTimerRef.current) {
      clearTimeout(invalidHighlightTimerRef.current);
    }
    focusInvalidElement(targetEl);
    invalidHighlightTimerRef.current = setTimeout(() => {
      setInvalidField(null);
    }, 2400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInvalidField(null);

    if (mode === 'new') {
      if (!newLabel.trim()) {
        flagInvalidField(
          'newLabel',
          isEn ? 'Enter the condition name.' : '질환명을 입력해 주세요.',
          newLabelRef.current
        );
        return;
      }
      if (!newBodyPart.trim()) {
        flagInvalidField(
          'newBodyPart',
          isEn ? 'Select or enter the affected body part.' : '신체 부위를 선택하거나 입력해 주세요.',
          newBodyPartRef.current
        );
        return;
      }
      if (!newOnsetDate) {
        flagInvalidField(
          'newOnsetDate',
          isEn ? 'Select the condition onset date.' : '발병일을 선택해 주세요.',
          newOnsetDateRef.current
        );
        return;
      }
    } else if (mode === 'existing' && !selectedConditionId) {
      flagInvalidField(
        'selectedCondition',
        isEn ? 'Please select a condition to track.' : '추적할 질환을 선택해 주세요.',
        selectedConditionRef.current
      );
      return;
    } else if (mode === 'unassigned' && !diagnosticOnly && !unassignedBodyPart.trim()) {
      flagInvalidField(
        'unassignedBodyPart',
        isEn ? 'Select or enter the affected body part.' : '아픈 부위를 선택하거나 입력해 주세요.',
        unassignedBodyPartRef.current
      );
      return;
    }

    const hasDiagnosticInput =
      includeDiagnostic ||
      diagnosticOnly ||
      Boolean(diagnosisName.trim() || hospitalName.trim() || department.trim() || amountKrw.trim() || draftPhotos.length > 0);

    if (hasDiagnosticInput && !diagnosisName.trim()) {
      setIncludeDiagnostic(true);
      setTimeout(() => {
        flagInvalidField(
          'diagnosisName',
          isEn
            ? 'Please enter a diagnosis, visit, or checkup title.'
            : '진단명 또는 진료·검사 내용을 입력해 주세요.',
          diagnosisNameRef.current
        );
      }, 20);
      return;
    }

    setIsSubmitting(true);
    let createdPhotoIds: string[] = [];
    try {
      const parsedAmount = amountKrw.trim() ? Number(amountKrw.replace(/,/g, '')) : undefined;
      const normalizedAmount = parsedAmount && !Number.isNaN(parsedAmount) ? parsedAmount : undefined;

      if (editingDiagnostic) {
        // Reuse existing encrypted photo IDs for unchanged images; encrypt only newly added images
        const remainingMap = new Map<string, string[]>();
        existingPhotoIdsByDataUrlRef.current.forEach((ids, dataUrl) => {
          remainingMap.set(dataUrl, [...ids]);
        });
        const reusedIds: string[] = [];
        const newDrafts: string[] = [];
        for (const draft of draftPhotos) {
          const matchingIds = remainingMap.get(draft);
          if (matchingIds && matchingIds.length > 0) {
            reusedIds.push(matchingIds.shift()!);
          } else {
            newDrafts.push(draft);
          }
        }
        const newlyEncrypted = await encryptDraftPhotos(newDrafts, activeSessionPin || undefined);
        createdPhotoIds = newlyEncrypted;
        const finalPhotoIds = [...undecryptedPhotoIdsRef.current, ...reusedIds, ...newlyEncrypted];

        const success = await updateDiagnosticRecord(editingDiagnostic.id, {
          conditionId: mode === 'existing' && selectedConditionId ? selectedConditionId : undefined,
          diagnosisDate,
          diagnosisName: diagnosisName.trim(),
          hospitalName: hospitalName.trim(),
          department: department.trim(),
          amountKrw: normalizedAmount,
          notes: notes.trim(),
          photoIds: finalPhotoIds,
          claimDeadlineYears,
        });

        if (success) {
          const keptSet = new Set(finalPhotoIds);
          const removedIds = (editingDiagnostic.photoIds || []).filter((pid) => !keptSet.has(pid));
          if (removedIds.length) {
            await Promise.all(removedIds.map((pid) => deleteEncryptedPhoto(pid).catch(() => {})));
          }
          triggerHaptic();
          navigate(-1);
        } else {
          if (createdPhotoIds.length) {
            await Promise.all(createdPhotoIds.map((pid) => deleteEncryptedPhoto(pid).catch(() => {})));
          }
          setError(
            isEn ? 'Failed to update record. Please check your inputs.' : '기록 수정에 실패했습니다. 입력값을 확인해 주세요.'
          );
        }
        return;
      }

      if (editingLog) {
        const success = await updateLog(editingLog.id, {
          conditionId: mode === 'unassigned' ? UNASSIGNED_CONDITION_ID : selectedConditionId,
          bodyPartOverride: mode === 'unassigned' ? unassignedBodyPart.trim() : undefined,
          date: new Date(date).toISOString(),
          intensity,
          medication,
          notes,
          painQuality: selectedQualities,
          radiation: selectedRadiation,
          triggers: selectedTriggers,
          reliefFactors: selectedReliefs,
          redFlags: selectedRedFlags,
        });
        if (success) {
          triggerHaptic();
          navigate(-1);
        } else {
          setError(
            isEn ? 'Failed to update record. Please check your inputs.' : '기록 수정에 실패했습니다. 입력값을 확인해 주세요.'
          );
        }
        return;
      }

      const photoIds = await encryptDraftPhotos(draftPhotos, activeSessionPin || undefined);
      createdPhotoIds = photoIds;

      const payload = {
        isNewCondition: mode === 'new',
        isUnassigned: mode === 'unassigned',
        skipPainLog: diagnosticOnly,
        conditionData:
          mode === 'new'
            ? {
                label: newLabel,
                bodyPart: newBodyPart,
                onsetDate: newOnsetDate,
              }
            : mode === 'unassigned'
            ? {}
            : { id: selectedConditionId },
        logData: {
          date: new Date(date).toISOString(),
          intensity,
          medication,
          notes,
          bodyPartOverride: mode === 'unassigned' ? unassignedBodyPart.trim() : undefined,
          painQuality: selectedQualities,
          radiation: selectedRadiation,
          triggers: selectedTriggers,
          reliefFactors: selectedReliefs,
          redFlags: selectedRedFlags,
        },
        diagnosticData: hasDiagnosticInput
          ? {
              diagnosisDate,
              diagnosisName: diagnosisName.trim(),
              hospitalName: hospitalName.trim(),
              department: department.trim(),
              amountKrw: normalizedAmount,
              notes: notes.trim(),
              photoIds,
              claimDeadlineYears,
            }
          : undefined,
      };

      const success = await saveEntry(payload);
      if (success) {
        triggerHaptic();
        navigate('/');
      } else {
        if (createdPhotoIds.length) {
          await Promise.all(createdPhotoIds.map((pid) => deleteEncryptedPhoto(pid).catch(() => {})));
        }
        setError(
          isEn ? 'Failed to save record. Please check your inputs.' : '기록 저장에 실패했습니다. 입력값을 확인해 주세요.'
        );
      }
    } catch (err: any) {
      if (createdPhotoIds.length) {
        await Promise.all(createdPhotoIds.map((pid) => deleteEncryptedPhoto(pid).catch(() => {})));
      }
      setError(
        err?.message || (isEn ? 'Failed to save record. Please try again.' : '기록 저장 중 오류가 발생했습니다.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIntensityColor = (num: number) => {
    if (num >= 8) return 'bg-rose-500 text-white border-rose-600 shadow-rose-200';
    if (num >= 5) return 'bg-amber-500 text-white border-amber-600 shadow-amber-200';
    return 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200';
  };

  const getIntensityDescription = (num: number) => {
    if (num <= 3) return '1~3: 가벼운 통증 (일상생활 가능, 수면 지장 없음)';
    if (num <= 6) return '4~6: 중등도 통증 (일상생활에 지장 발생, 진통제 필요)';
    if (num <= 8) return '7~8: 매우 심한 통증 (거동 힘들고 집중 불가능)';
    return '9~10: 극심하여 참을 수 없음 (즉시 응급 진료 요망)';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold">
            {isEditingDiagnostic
              ? t('editDiagnosticTitle')
              : isEditingLog
              ? t('editPainLogTitle')
              : t('entryTitle')}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate className="p-4 max-w-md mx-auto space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs font-bold text-rose-600 dark:text-rose-400">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Section 1: Condition Mode & Selector */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('conditionContext')}
            </h2>
          </div>

          {/* Toggle Mode: Existing Disease | Unknown Cause | New Disease */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              disabled={activeConditions.length === 0}
              onClick={() => {
                triggerHaptic();
                setMode('existing');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'existing'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 disabled:opacity-40'
              }`}
            >
              {t('followUpMode')}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setMode('unassigned');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'unassigned'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {isEn ? 'Unassigned' : '원인 미상'}
            </button>
            <button
              type="button"
              disabled={isEditingDiagnostic || isEditingLog}
              onClick={() => {
                triggerHaptic();
                setMode('new');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'new'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 disabled:opacity-40'
              }`}
            >
              {t('newConditionMode')}
            </button>
          </div>

          {mode === 'existing' ? (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                {t('selectCondition')}
              </label>
              <select
                ref={selectedConditionRef}
                value={selectedConditionId}
                onChange={(e) => {
                  setSelectedConditionId(e.target.value);
                  if (invalidField === 'selectedCondition') setInvalidField(null);
                }}
                className={`w-full rounded-xl border bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 ${
                  invalidField === 'selectedCondition'
                    ? 'border-rose-500 ring-2 ring-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                }`}
              >
                {activeConditions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.bodyPart})
                  </option>
                ))}
              </select>
            </div>
          ) : mode === 'unassigned' ? (
            <div className="space-y-3 animate-in fade-in">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isEn
                  ? 'Not sure of the diagnosis yet? Log the area & symptoms first, then group under a condition later.'
                  : '병명이 아직 확정되지 않았다면 부위와 증상만 먼저 기록하고, 나중에 진단된 질병으로 묶을 수 있습니다.'}
              </p>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {isEn ? 'Affected Area' : '아픈 부위'}
                  </label>
                  <button
                    type="button"
                    onClick={handleToggleBodyMap}
                    className="text-[11px] font-bold text-teal-600 dark:text-teal-400 underline"
                  >
                    {showBodyMap
                      ? isEn
                        ? 'Hide BodyMap'
                        : '바디맵 닫기'
                      : isEn
                      ? 'Pick on BodyMap'
                      : '바디맵에서 칠하기'}
                  </button>
                </div>
                <input
                  ref={unassignedBodyPartRef}
                  required={!diagnosticOnly}
                  type="text"
                  placeholder={t('bodyPartPlaceholder')}
                  value={unassignedBodyPart}
                  onChange={(e) => {
                    setUnassignedBodyPart(e.target.value);
                    if (invalidField === 'unassignedBodyPart') setInvalidField(null);
                  }}
                  className={`w-full rounded-xl border bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 ${
                    invalidField === 'unassignedBodyPart'
                      ? 'border-rose-500 ring-2 ring-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                  }`}
                />
              </div>
              {showBodyMapPrompt && (
                <DefaultClosedSuggestion
                  featureName={isEn ? 'BodyMap' : '인체 바디맵'}
                  onConfirmDefaultClosed={async () => {
                    triggerHaptic();
                    await setDefaultBodyMapOpen(false);
                    setShowBodyMapPrompt(false);
                  }}
                  onKeepOpen={async () => {
                    triggerHaptic();
                    await recordCollapsibleDismissal('bodyMap', true);
                    setShowBodyMapPrompt(false);
                  }}
                />
              )}
              {showBodyMap && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2">
                  <BodyMap
                    selectedParts={parseMultiRegionParts(unassignedBodyPart)}
                    onTogglePart={(part) => {
                      markBodyMapUsed();
                      const cur = parseMultiRegionParts(unassignedBodyPart);
                      const next = cur.includes(part) ? cur.filter((p) => p !== part) : [...cur, part];
                      setUnassignedBodyPart(formatMultiRegionParts(next));
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {t('conditionLabel')}
                </label>
                <input
                  ref={newLabelRef}
                  required
                  type="text"
                  placeholder={t('conditionLabelPlaceholder')}
                  value={newLabel}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    if (invalidField === 'newLabel') setInvalidField(null);
                  }}
                  className={`w-full rounded-xl border bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 ${
                    invalidField === 'newLabel'
                      ? 'border-rose-500 ring-2 ring-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t('bodyPart')}
                  </label>
                  <button
                    type="button"
                    onClick={handleToggleBodyMap}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 underline"
                  >
                    {showBodyMap
                      ? isEn
                        ? 'Hide BodyMap'
                        : '바디맵 닫기'
                      : isEn
                      ? 'Open BodyMap'
                      : '인체 바디맵 열기'}
                  </button>
                </div>
                <input
                  ref={newBodyPartRef}
                  required
                  type="text"
                  placeholder={t('bodyPartPlaceholder')}
                  value={newBodyPart}
                  onChange={(e) => {
                    setNewBodyPart(e.target.value);
                    if (invalidField === 'newBodyPart') setInvalidField(null);
                  }}
                  className={`w-full rounded-xl border bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 ${
                    invalidField === 'newBodyPart'
                      ? 'border-rose-500 ring-2 ring-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                  }`}
                />
              </div>

              {showBodyMapPrompt && (
                <DefaultClosedSuggestion
                  featureName={isEn ? 'BodyMap' : '인체 바디맵'}
                  onConfirmDefaultClosed={async () => {
                    triggerHaptic();
                    await setDefaultBodyMapOpen(false);
                    setShowBodyMapPrompt(false);
                  }}
                  onKeepOpen={async () => {
                    triggerHaptic();
                    await recordCollapsibleDismissal('bodyMap', true);
                    setShowBodyMapPrompt(false);
                  }}
                />
              )}

              {showBodyMap && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 animate-in fade-in">
                  <BodyMap
                    selectedParts={selectedBodyParts}
                    onTogglePart={handleToggleBodyPart}
                    selectedPart={newBodyPart}
                    onSelectPart={(part) => {
                      markBodyMapUsed();
                      if (!selectedBodyParts.includes(part)) {
                        setNewBodyPart(formatMultiRegionParts([...selectedBodyParts, part]));
                      }
                    }}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {t('onsetDate')}
                </label>
                <input
                  ref={newOnsetDateRef}
                  required
                  type="date"
                  value={newOnsetDate}
                  onChange={(e) => {
                    setNewOnsetDate(e.target.value);
                    if (invalidField === 'newOnsetDate') setInvalidField(null);
                  }}
                  className={`w-full rounded-xl border bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 ${
                    invalidField === 'newOnsetDate'
                      ? 'border-rose-500 ring-2 ring-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                  }`}
                />
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Toggle Diagnostic-Only OR Pain Intensity */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('painRating')}
            </h2>
            <button
              type="button"
              disabled={isEditingDiagnostic || isEditingLog}
              onClick={() => {
                triggerHaptic();
                const next = !diagnosticOnly;
                setDiagnosticOnly(next);
                if (next) setIncludeDiagnostic(true);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border disabled:opacity-40 ${
                diagnosticOnly
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {diagnosticOnly
                ? isEn
                  ? '✓ Visit / Checkup Only'
                  : '✓ 진료·검사만 기록 중'
                : isEn
                ? 'Log Visit/Checkup Only'
                : '진료·검사만 기록'}
            </button>
          </div>

          {!diagnosticOnly && (
            <>
              <PainLevelSelector
                value={intensity}
                onChange={setIntensity}
                variant="auto"
                showDescription={true}
              />

              {/* Date & Time with Quick Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t('timestamp')}
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQuickTime('now')}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500"
                    >
                      {isEn ? 'Now' : '지금'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickTime('1h')}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500"
                    >
                      {isEn ? '1h ago' : '1시간 전'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickTime('yesterday')}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500"
                    >
                      {isEn ? 'Yesterday' : '어제'}
                    </button>
                  </div>
                </div>
                <input
                  required
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          )}
        </section>

        {!diagnosticOnly && (
          <>

        {/* Section 3: Clinical PQRST (Pain Quality & Radiation) */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isEn ? 'Pain Quality & Radiation (PQRST)' : '통증 양상 및 방사통 (PQRST 의학 척도)'}
            </h2>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              {isEn ? 'Key Clinical Context' : '의사 문진 필수 항목'}
            </span>
          </div>

          {/* Quality Chips */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
              {isEn ? 'How does it feel? (Multi-select)' : '어떤 느낌으로 아픈가요? (다중 선택 가능)'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_QUALITIES.map((q) => {
                const isSelected = selectedQualities.includes(q);
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleToggleQuality(q)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm scale-102'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 active:scale-95'
                    }`}
                  >
                    {labelOf(q)} {isSelected && '✓'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Radiation Chips */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
              {isEn ? 'Does the pain radiate elsewhere?' : '다른 부위로 뻗치는 방사통이 있나요?'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RADIATIONS.map((rad) => {
                const isSelected = selectedRadiation === rad;
                return (
                  <button
                    key={rad}
                    type="button"
                    onClick={() => handleToggleRadiation(rad)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm scale-102'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 active:scale-95'
                    }`}
                  >
                    {labelOf(rad)} {isSelected && '✓'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Triggers & Relief Factors */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
              {isEn ? 'Aggravating Triggers:' : '통증 악화 요인:'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {TRIGGERS.map((tr) => {
                const isSelected = selectedTriggers.includes(tr);
                return (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => handleToggleTrigger(tr)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      isSelected
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {labelOf(tr)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
              {isEn ? 'Relieving Factors:' : '통증 완화 요인:'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RELIEF_FACTORS.map((rel) => {
                const isSelected = selectedReliefs.includes(rel);
                return (
                  <button
                    key={rel}
                    type="button"
                    onClick={() => handleToggleRelief(rel)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      isSelected
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {labelOf(rel)}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 4: Red Flags Safety Check (Medical Safety Net) */}
        <section className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 shadow-sm space-y-2.5">
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <ShieldAlert size={16} />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              {isEn ? 'Red Flags Safety Check' : '위험 징후 (Red Flags) 확인'}
            </h2>
          </div>
          <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80">
            {isEn
              ? 'Check any urgent warning signs (flagged in clinical summaries):'
              : '해당되는 응급 증상이 있다면 체크하세요 (의료진에게 최우선 경고 전달):'}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {RED_FLAGS.map((rf) => {
              const isSelected = selectedRedFlags.includes(rf);
              return (
                <button
                  key={rf}
                  type="button"
                  onClick={() => handleToggleRedFlag(rf)}
                  className={`p-2 rounded-xl text-xs font-bold text-left transition-all border ${
                    isSelected
                      ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {labelOf(rf)} {isSelected && '⚠️'}
                </button>
              );
            })}
          </div>

          {selectedRedFlags.length > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-[11px] font-bold text-rose-900 dark:text-rose-100 flex items-start gap-1.5 animate-in fade-in">
              <AlertTriangle size={15} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>
                {isEn
                  ? 'Red flags selected. These will be highlighted in clinical summaries. Seek emergency care immediately if symptoms worsen.'
                  : '위험 징후가 체크되었습니다. 의무기록에 응급 상태로 표기되며, 진단 전이라도 상태 악화 시 즉시 응급실을 내원하시기 바랍니다.'}
              </span>
            </div>
          )}
        </section>

        {/* Section 5: Medication & Treatment */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {t('medicationLabel')}
          </label>

          {/* Quick Medication Chips */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {t('quickMedPresets')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {settings.medicationPresets.map((preset) => {
                const formattedName = formatMedicationPreset(preset, resolvedLanguage);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAddMedPreset(formattedName)}
                    className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 active:scale-95 transition-all"
                  >
                    + {formattedName}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setShowAddMed(true);
                }}
                className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-dashed border-emerald-300 dark:border-emerald-700 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 active:scale-95 transition-all flex items-center gap-1"
              >
                {isEn ? '+ Add Med' : '+ 약 추가'}
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder={t('medicationPlaceholder')}
            value={medication}
            onChange={(e) => setMedication(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <AddMedicationInline
            isOpen={showAddMed}
            onClose={() => setShowAddMed(false)}
            onAdded={(newMed) => {
              handleAddMedPreset(newMed);
              setShowAddMed(false);
            }}
          />
        </section>
          </>
        )}

        {/* Section 6: Integrated Clinical Visit / Checkup / Diagnostic Vault Record */}
        <section className="rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              if (!diagnosticOnly) {
                setIncludeDiagnostic((prev) => !prev);
              }
            }}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400">
                <FileCheck2 size={16} />
              </span>
              <div>
                <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isEn ? 'Hospital Visit, Checkup & Diagnostic Record' : '진료 · 검진 · 진단서 기록 통합 (선택)'}
                </h2>
                <p className="text-[10px] text-slate-400">
                  {isEn
                    ? 'Link clinic visit, receipt/X-ray photos (EXIF stripped) & claim tracking'
                    : '병원명 · 진단/검사 내용 · 영수증/진단서 사진 · 실손 청구 시효 함께 저장'}
                </p>
              </div>
            </div>
            {!diagnosticOnly && (
              <span className="text-slate-400">
                {includeDiagnostic ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            )}
          </button>

          {(includeDiagnostic || diagnosticOnly) && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {isEn ? 'Visit / Exam Date' : '진료·검사 일자'}
                  </label>
                  <input
                    type="date"
                    value={diagnosisDate}
                    onChange={(e) => setDiagnosisDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {isEn ? 'Claim Window (Years)' : '실손 청구 시효'}
                  </label>
                  <select
                    value={claimDeadlineYears}
                    onChange={(e) => setClaimDeadlineYears(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  >
                    <option value={3}>{isEn ? '3 Years (Standard)' : '3년 (실손 표준)'}</option>
                    <option value={2}>{isEn ? '2 Years' : '2년'}</option>
                    <option value={5}>{isEn ? '5 Years' : '5년'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isEn ? 'Diagnosis / Exam Details' : '진단명 / 진료·검사 내용'}
                </label>
                <input
                  ref={diagnosisNameRef}
                  type="text"
                  required={diagnosticOnly}
                  value={diagnosisName}
                  onChange={(e) => {
                    setDiagnosisName(e.target.value);
                    if (invalidField === 'diagnosisName') setInvalidField(null);
                  }}
                  placeholder={
                    isEn ? 'e.g., Lumbar X-ray, Outpatient orthopedic visit' : '예: 요추 X-ray 검사, 정형외과 외래 진료'
                  }
                  className={`w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 ${
                    invalidField === 'diagnosisName'
                      ? 'border-rose-500 ring-2 ring-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {isEn ? 'Hospital' : '병원명'}
                  </label>
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    placeholder={isEn ? 'Clinic' : '예: OO병원'}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {isEn ? 'Dept.' : '진료과'}
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder={isEn ? 'Ortho' : '예: 정형외과'}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {isEn ? 'Cost' : '진료비(원)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={amountKrw}
                    onChange={(e) => setAmountKrw(e.target.value)}
                    placeholder="35000"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <PhotoAttachmentField
                photos={draftPhotos}
                onChange={setDraftPhotos}
                onError={setError}
                processFile={compressAndStripExif}
              />
            </div>
          )}
        </section>

        {/* Section 7: Notes */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {t('notesLabel')}
          </label>
          <textarea
            rows={2}
            placeholder={t('notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </section>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-600/30 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={18} />
          {isSubmitting
            ? isEn
              ? 'Saving...'
              : '저장 중...'
            : isEditingDiagnostic || isEditingLog
            ? t('saveChangesBtn')
            : t('saveRecordBtn')}
        </button>
      </form>
    </div>
  );
};

export default EntryFormPage;

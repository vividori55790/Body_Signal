import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Shield,
  X,
  Calendar,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import PhotoAttachmentField from '../components/PhotoAttachmentField';
import { useAuthorizedDelete } from '../components/DeleteAuthModal';
import { useHealth } from '../context/HealthContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { DiagnosticRecord } from '../types/health';
import { calculateInsuranceClaimStatus } from '../utils/insurance';
import {
  compressAndStripExif,
  encryptDraftPhotos,
  saveEncryptedPhoto,
  loadEncryptedPhoto,
  deleteEncryptedPhoto,
} from '../utils/mediaStorage';
import { toLocalYmd } from '../utils/dateUtils';
import { focusInvalidElement } from '../utils/formFocus';
import { triggerHaptic } from '../utils/native';

export const DiagnosticsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const location = useLocation();
  const { conditions, diagnosticRecords, addDiagnosticRecord, updateDiagnosticRecord, deleteDiagnosticRecord } = useHealth();
  const { activeSessionPin, isUnlocked } = useAuth();
  const { settings } = useSettings();
  const { requestAuthorizedDelete, authModal: deleteAuthModal } = useAuthorizedDelete();
  const isEn = settings.language === 'en';

  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed');
  const [sortBy, setSortBy] = useState<'deadline' | 'date'>('deadline');
  const [filterPendingOnly, setFilterPendingOnly] = useState(false);

  // Add modal state
  const preselectedConditionId = (location.state as { conditionId?: string } | null)?.conditionId || '';
  const [isFormOpen, setIsFormOpen] = useState(Boolean(preselectedConditionId));
  const [linkedConditionId, setLinkedConditionId] = useState(preselectedConditionId);
  const [diagnosisDate, setDiagnosisDate] = useState(() => toLocalYmd(new Date()));
  const [diagnosisName, setDiagnosisName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [department, setDepartment] = useState('');
  const [amountKrw, setAmountKrw] = useState('');
  const [notes, setNotes] = useState('');
  const [claimDeadlineYears, setClaimDeadlineYears] = useState(3);
  const [draftPhotos, setDraftPhotos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [invalidField, setInvalidField] = useState<'diagnosisDate' | 'diagnosisName' | null>(null);
  const diagnosisDateRef = useRef<HTMLInputElement>(null);
  const diagnosisNameRef = useRef<HTMLInputElement>(null);
  const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decrypted photos cache in memory (automatically purged on lock/unmount)
  const [decryptedPhotos, setDecryptedPhotos] = useState<Record<string, string>>({});
  const decryptedPhotosRef = useRef(decryptedPhotos);
  decryptedPhotosRef.current = decryptedPhotos;
  const inFlightDecryptRef = useRef<Set<string>>(new Set());
  const [expandedPhotoRecords, setExpandedPhotoRecords] = useState<Record<string, boolean>>({});
  const [lightboxState, setLightboxState] = useState<{
    photoIds: string[];
    index: number;
    title: string;
  } | null>(null);

  const INITIAL_PREVIEW_PHOTOS = 4;
  const DECRYPT_BATCH_SIZE = 4;

  const ensurePhotosDecrypted = useCallback(
    async (ids: string[]) => {
      if (!isUnlocked || ids.length === 0) return;
      const missingIds = ids.filter(
        (id) => !decryptedPhotosRef.current[id] && !inFlightDecryptRef.current.has(id)
      );
      if (missingIds.length === 0) return;

      missingIds.forEach((id) => inFlightDecryptRef.current.add(id));
      try {
        for (let i = 0; i < missingIds.length; i += DECRYPT_BATCH_SIZE) {
          const chunk = missingIds.slice(i, i + DECRYPT_BATCH_SIZE);
          const results = await Promise.all(
            chunk.map(async (id) => {
              try {
                const url = await loadEncryptedPhoto(id, activeSessionPin || undefined);
                return [id, url] as const;
              } catch {
                return [id, null] as const;
              }
            })
          );
          setDecryptedPhotos((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const [id, url] of results) {
              if (url && !next[id]) {
                next[id] = url;
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }
      } finally {
        missingIds.forEach((id) => inFlightDecryptRef.current.delete(id));
      }
    },
    [activeSessionPin, isUnlocked]
  );

  useEffect(() => {
    if (!isUnlocked) {
      setDecryptedPhotos({});
      setLightboxState(null);
      inFlightDecryptRef.current.clear();
      return;
    }

    const prioritizedIds = diagnosticRecords.flatMap((rec) => {
      const pids = rec.photoIds || [];
      if (expandedPhotoRecords[rec.id]) return pids;
      return pids.slice(0, viewMode === 'grid' ? 1 : INITIAL_PREVIEW_PHOTOS);
    });

    void ensurePhotosDecrypted(prioritizedIds);
  }, [diagnosticRecords, expandedPhotoRecords, viewMode, isUnlocked, ensurePhotosDecrypted]);

  // Also ensure active lightbox slide and adjacent neighbors are decrypted immediately
  useEffect(() => {
    if (!lightboxState || !isUnlocked) return;
    const { photoIds, index } = lightboxState;
    const neighborIds = [photoIds[index], photoIds[index - 1], photoIds[index + 1]].filter(
      (id): id is string => Boolean(id)
    );
    void ensurePhotosDecrypted(neighborIds);
  }, [lightboxState, isUnlocked, ensurePhotosDecrypted]);

  const enrichedRecords = useMemo(() => {
    const items = diagnosticRecords.map((rec) => ({
      record: rec,
      insurance: calculateInsuranceClaimStatus(
        rec.diagnosisDate,
        rec.claimStatus,
        rec.claimDeadlineYears || 3,
        new Date(),
        settings.language
      ),
    }));

    const filtered = filterPendingOnly
      ? items.filter((i) => i.record.claimStatus === 'pending')
      : items;

    return filtered.sort((a, b) => {
      if (sortBy === 'deadline') {
        if (a.record.claimStatus === 'pending' && b.record.claimStatus !== 'pending') return -1;
        if (a.record.claimStatus !== 'pending' && b.record.claimStatus === 'pending') return 1;
        return a.insurance.daysRemaining - b.insurance.daysRemaining;
      }
      return b.record.diagnosisDate.localeCompare(a.record.diagnosisDate);
    });
  }, [diagnosticRecords, sortBy, filterPendingOnly, settings.language]);

  const pendingStats = useMemo(() => {
    const pending = enrichedRecords.filter((i) => i.record.claimStatus === 'pending');
    const urgent = pending.filter(
      (i) => i.insurance.urgency === 'critical' || i.insurance.urgency === 'soon' || i.insurance.urgency === 'expired'
    );
    return {
      pendingCount: pending.length,
      urgentCount: urgent.length,
    };
  }, [enrichedRecords]);

  const resetForm = () => {
    setDiagnosisDate(toLocalYmd(new Date()));
    setDiagnosisName('');
    setHospitalName('');
    setDepartment('');
    setAmountKrw('');
    setNotes('');
    setClaimDeadlineYears(3);
    setLinkedConditionId('');
    setDraftPhotos([]);
    setFormError('');
    setInvalidField(null);
    setIsFormOpen(false);
  };

  const flagInvalid = (
    field: NonNullable<typeof invalidField>,
    message: string,
    targetEl: HTMLElement | null
  ) => {
    triggerHaptic();
    setFormError(message);
    setInvalidField(field);
    if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
    focusInvalidElement(targetEl);
    invalidTimerRef.current = setTimeout(() => setInvalidField(null), 2400);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvalidField(null);
    if (!diagnosisDate) {
      flagInvalid(
        'diagnosisDate',
        isEn ? 'Please select the diagnosis or visit date.' : '진단일자를 선택해 주세요.',
        diagnosisDateRef.current
      );
      return;
    }
    if (!diagnosisName.trim()) {
      flagInvalid(
        'diagnosisName',
        isEn ? 'Please enter a diagnosis or visit title.' : '진단명 또는 진료 내용을 입력해 주세요.',
        diagnosisNameRef.current
      );
      return;
    }

    setIsSaving(true);
    setFormError('');
    let createdPhotoIds: string[] = [];
    try {
      triggerHaptic();
      const photoIds = await encryptDraftPhotos(
        draftPhotos,
        activeSessionPin || undefined,
        saveEncryptedPhoto
      );
      createdPhotoIds = photoIds;

      const parsedAmount = amountKrw.trim() ? Number(amountKrw.replace(/,/g, '')) : undefined;
      await addDiagnosticRecord({
        conditionId: linkedConditionId || undefined,
        diagnosisDate,
        diagnosisName: diagnosisName.trim(),
        hospitalName: hospitalName.trim(),
        department: department.trim(),
        amountKrw: parsedAmount && !Number.isNaN(parsedAmount) ? parsedAmount : undefined,
        notes: notes.trim(),
        photoIds,
        claimStatus: 'pending',
        claimDeadlineYears,
      });

      setDecryptedPhotos((prev) => {
        const next = { ...prev };
        photoIds.forEach((pid, idx) => {
          if (draftPhotos[idx]) next[pid] = draftPhotos[idx];
        });
        return next;
      });

      resetForm();
    } catch (err: any) {
      if (createdPhotoIds.length) {
        await Promise.all(createdPhotoIds.map((pid) => deleteEncryptedPhoto(pid).catch(() => {})));
      }
      setFormError(err?.message || (isEn ? 'Failed to save diagnostic record.' : '진단 기록 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleClaimStatus = async (rec: DiagnosticRecord) => {
    triggerHaptic();
    const nextStatus = rec.claimStatus === 'claimed' ? 'pending' : 'claimed';
    await updateDiagnosticRecord(rec.id, {
      claimStatus: nextStatus,
      claimedAt: nextStatus === 'claimed' ? new Date().toISOString() : undefined,
    });
  };

  const handleDelete = (rec: DiagnosticRecord) => {
    requestAuthorizedDelete({
      title: isEn ? 'Delete Diagnostic Record' : '진단·실손 기록 삭제',
      description: isEn
        ? 'Permanently delete this diagnostic record and its encrypted photos?'
        : '이 진단 기록과 첨부된 암호화 사진을 영구 삭제하시겠습니까?',
      onAuthorized: async () => {
        triggerHaptic();
        await deleteDiagnosticRecord(rec.id);
        setDecryptedPhotos((prev) => {
          const next = { ...prev };
          for (const pid of rec.photoIds || []) {
            delete next[pid];
          }
          return next;
        });
      },
    });
  };

  const getBadgeStyle = (urgency: string) => {
    switch (urgency) {
      case 'claimed':
        return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'expired':
      case 'critical':
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'soon':
        return 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <div className={`${embedded ? 'space-y-4' : 'min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-4'}`}>
      {/* Header */}
      <header className="flex items-center justify-between gap-2">
        <div>
          {!embedded && (
            <h1 className="text-xl font-bold">{isEn ? 'Diagnostic & Insurance Vault' : '진단·실손 보관함'}</h1>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isEn ? 'Encrypted Document Vault · Claim Deadlines' : '암호화 사진 보관 · 실손 마감 D-day'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setIsFormOpen(true);
          }}
          className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
        >
          <Plus size={15} /> {isEn ? 'Add Record' : '진단 등록'}
        </button>
      </header>

      {/* Insurance Deadline Summary Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl ${
              pendingStats.urgentCount > 0
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {pendingStats.urgentCount > 0 ? <AlertTriangle size={18} /> : <Shield size={18} />}
          </div>
          <div>
            <p className="text-xs font-bold">
              {isEn ? `${pendingStats.pendingCount} pending claims` : `실손 청구 대기 ${pendingStats.pendingCount}건`}
              {pendingStats.urgentCount > 0 && (
                <span className="ml-1.5 text-rose-600 dark:text-rose-400">
                  {isEn ? `(${pendingStats.urgentCount} urgent)` : `(주의/임박 ${pendingStats.urgentCount}건)`}
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-400">
              {isEn
                ? 'Tracks statutory claim window & safe latest filing date (14d prior)'
                : '상법 제662조 기준 3년 소멸시효 · 추천 최후 접수일(만료 14일 전) 안내'}
            </p>
          </div>
        </div>
      </div>

      {/* Controls: View Toggle (Grid vs Feed) + Sort + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setSortBy(sortBy === 'deadline' ? 'date' : 'deadline');
            }}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300"
          >
            {isEn
              ? `Sort: ${sortBy === 'deadline' ? 'Earliest Deadline' : 'Latest Date'}`
              : `정렬: ${sortBy === 'deadline' ? '청구 마감 임박순' : '최신 진단일순'}`}
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setFilterPendingOnly(!filterPendingOnly);
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
              filterPendingOnly
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {isEn ? 'Pending Only' : '미청구만'}
          </button>
        </div>

        <div className="flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1">
          <button
            type="button"
            aria-label={isEn ? 'Feed view' : '피드 뷰'}
            onClick={() => {
              triggerHaptic();
              setViewMode('feed');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              viewMode === 'feed'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <ListIcon size={13} /> {isEn ? 'Feed' : '피드'}
          </button>
          <button
            type="button"
            aria-label={isEn ? 'Grid view' : '그리드 뷰'}
            onClick={() => {
              triggerHaptic();
              setViewMode('grid');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <LayoutGrid size={13} /> {isEn ? 'Grid' : '그리드'}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {enrichedRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-8 text-center space-y-2">
          <Camera size={28} className="mx-auto text-slate-400" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {isEn ? 'No diagnostic or insurance records saved yet' : '저장된 진단서·실손 기록이 없습니다'}
          </p>
          <p className="text-xs text-slate-400">
            {isEn
              ? 'Encrypt receipts and diagnostic photos (EXIF stripped) and track claim deadlines.'
              : '진단일자와 영수증/진단서 사진을 촬영해 암호화 보관하고, 실손 청구 마감일을 놓치지 마세요.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-2 gap-3">
          {enrichedRecords.map(({ record, insurance }) => {
            const firstPhotoId = record.photoIds?.[0];
            const thumbSrc = firstPhotoId ? decryptedPhotos[firstPhotoId] : undefined;
            return (
              <div
                key={record.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex flex-col"
              >
                <div
                  onClick={() => {
                    if (record.photoIds && record.photoIds.length > 0) {
                      setLightboxState({
                        photoIds: record.photoIds,
                        index: 0,
                        title: `${record.diagnosisName} (${record.diagnosisDate})`,
                      });
                    }
                  }}
                  className="h-32 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center cursor-pointer"
                >
                  {thumbSrc ? (
                    <img src={thumbSrc} alt={record.diagnosisName} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={28} className="text-slate-400" />
                  )}
                  {(record.photoIds?.length || 0) > 1 && (
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-bold">
                      +{record.photoIds.length - 1}
                    </span>
                  )}
                  <span
                    className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold border ${getBadgeStyle(
                      insurance.urgency
                    )}`}
                  >
                    {insurance.badgeText}
                  </span>
                </div>
                <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xs truncate">{record.diagnosisName}</h3>
                    <p className="text-[10px] text-slate-400 truncate">
                      {record.diagnosisDate} {record.hospitalName ? `· ${record.hospitalName}` : ''}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isEn ? `File by: ~${insurance.recommendedLatestDate}` : `추천 청구: ~${insurance.recommendedLatestDate}`}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => toggleClaimStatus(record)}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                    >
                      {record.claimStatus === 'claimed'
                        ? isEn
                          ? 'Claimed ✓'
                          : '청구완료 ✓'
                        : isEn
                        ? 'Mark Claimed'
                        : '청구완료 처리'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(record)}
                      aria-label={isEn ? 'Delete diagnostic record' : '진단 기록 삭제'}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Feed View */
        <div className="space-y-3">
          {enrichedRecords.map(({ record, insurance }) => (
            <article
              key={record.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm">{record.diagnosisName}</h3>
                    {record.conditionId && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        {conditions.find((c) => c.id === record.conditionId)?.label ||
                          (isEn ? 'Linked Condition' : '연결 질병')}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(
                        insurance.urgency
                      )}`}
                    >
                      {insurance.badgeText}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {isEn ? 'Date' : '진단일'} {record.diagnosisDate}
                    </span>
                    {record.hospitalName && (
                      <span className="flex items-center gap-1">
                        <Building2 size={12} /> {record.hospitalName}
                        {record.department ? ` (${record.department})` : ''}
                      </span>
                    )}
                    {record.amountKrw !== undefined && (
                      <span className="font-bold text-slate-600 dark:text-slate-300">
                        {record.amountKrw.toLocaleString()}
                        {isEn ? ' KRW' : '원'}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(record)}
                  aria-label={isEn ? 'Delete diagnostic record' : '진단 기록 삭제'}
                  className="p-1.5 text-slate-400 hover:text-rose-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Insurance Deadline Box */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                    <Clock size={12} className="text-emerald-500" />
                    {isEn
                      ? `Statutory Deadline: ${insurance.deadlineDate} (${record.claimDeadlineYears || 3}y)`
                      : `법정 청구 마감: ${insurance.deadlineDate} (${record.claimDeadlineYears || 3}년)`}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {isEn ? 'Safe latest claim date: ' : '가능한 한 늦게 청구 시 안전 권고일: '}
                    <strong className="text-slate-700 dark:text-slate-200">{insurance.recommendedLatestDate}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleClaimStatus(record)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                    record.claimStatus === 'claimed'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <CheckCircle2 size={13} />
                  {record.claimStatus === 'claimed'
                    ? isEn
                      ? 'Claimed'
                      : '청구 완료됨'
                    : isEn
                    ? 'Mark Claimed'
                    : '청구 완료 표시'}
                </button>
              </div>

              {/* Encrypted Photos Strip (Batched / On-Demand for up to 50 photos) */}
              {record.photoIds && record.photoIds.length > 0 && (() => {
                const isExpanded = Boolean(expandedPhotoRecords[record.id]);
                const visiblePhotoIds = isExpanded
                  ? record.photoIds
                  : record.photoIds.slice(0, INITIAL_PREVIEW_PHOTOS);
                const hiddenCount = Math.max(0, record.photoIds.length - visiblePhotoIds.length);
                return (
                  <div className="space-y-1.5">
                    <div
                      className={
                        isExpanded && record.photoIds.length > 4
                          ? 'grid grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-0.5'
                          : 'flex gap-2 overflow-x-auto pb-1'
                      }
                    >
                      {visiblePhotoIds.map((pid, idx) => {
                        const src = decryptedPhotos[pid];
                        return (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => {
                              setLightboxState({
                                photoIds: record.photoIds,
                                index: idx,
                                title: `${record.diagnosisName} (${record.diagnosisDate})`,
                              });
                            }}
                            className={`relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${
                              isExpanded && record.photoIds.length > 4 ? 'aspect-square w-full' : 'h-24 w-24 shrink-0'
                            }`}
                          >
                            {src ? (
                              <img src={src} alt={isEn ? 'Encrypted document' : '암호화 진단서'} className="w-full h-full object-cover" />
                            ) : (
                              <Shield size={18} className="text-slate-400 animate-pulse" />
                            )}
                            {record.photoIds.length > 4 && (
                              <span className="absolute bottom-1 left-1 px-1 rounded bg-slate-900/70 text-white text-[9px] font-bold tabular-nums">
                                {idx + 1}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {record.photoIds.length > INITIAL_PREVIEW_PHOTOS && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPhotoRecords((prev) => ({
                            ...prev,
                            [record.id]: !prev[record.id],
                          }))
                        }
                        className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        {isExpanded
                          ? isEn
                            ? 'Show fewer photos'
                            : '사진 접기'
                          : isEn
                          ? `Show all ${record.photoIds.length} photos (+${hiddenCount})`
                          : `사진 ${record.photoIds.length}장 모두 보기 (+${hiddenCount}장)`}
                      </button>
                    )}
                  </div>
                );
              })()}

              {record.notes && (
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                  {record.notes}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Add Diagnostic Record Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveRecord}
            noValidate
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">
                {isEn ? 'Add Diagnosis & Encrypted Photos' : '새 진단일자 & 암호화 사진 등록'}
              </h2>
              <button type="button" onClick={resetForm} className="p-1 text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isEn ? 'Diagnosis Date' : '진단일자'}
                </label>
                <input
                  ref={diagnosisDateRef}
                  type="date"
                  required
                  value={diagnosisDate}
                  onChange={(e) => {
                    setDiagnosisDate(e.target.value);
                    if (invalidField === 'diagnosisDate') setInvalidField(null);
                  }}
                  className={`w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 ${
                    invalidField === 'diagnosisDate'
                      ? 'border-rose-500 ring-2 ring-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isEn ? 'Claim Window (Years)' : '청구 시효(년)'}
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
                {isEn ? 'Diagnosis / Visit Details *' : '진단명 / 진료 내용 *'}
              </label>
              <input
                ref={diagnosisNameRef}
                type="text"
                required
                value={diagnosisName}
                onChange={(e) => {
                  setDiagnosisName(e.target.value);
                  if (invalidField === 'diagnosisName') setInvalidField(null);
                }}
                placeholder={isEn ? 'e.g., Lumbar sprain, Outpatient migraine visit' : '예: 요추 염좌, 편두통 외래 진료'}
                className={`w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 ${
                  invalidField === 'diagnosisName'
                    ? 'border-rose-500 ring-2 ring-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500'
                }`}
              />
            </div>

            {conditions.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isEn ? 'Link Condition (Optional)' : '소속 질병 연결 (선택)'}
                </label>
                <select
                  value={linkedConditionId}
                  onChange={(e) => setLinkedConditionId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                >
                  <option value="">{isEn ? 'None (Standalone)' : '미지정 (단독 보관)'}</option>
                  {conditions.filter((c) => !c.isArchived).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.bodyPart})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isEn ? 'Hospital / Clinic' : '병원명'}
                </label>
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder={isEn ? 'e.g., City Orthopedic Clinic' : '예: OO정형외과'}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isEn ? 'Amount (KRW)' : '진료비(원)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={amountKrw}
                  onChange={(e) => setAmountKrw(e.target.value)}
                  placeholder={isEn ? 'e.g., 35000' : '예: 35000'}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <PhotoAttachmentField
              photos={draftPhotos}
              onChange={setDraftPhotos}
              onError={setFormError}
              processFile={compressAndStripExif}
            />

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                {isEn ? 'Notes' : '메모'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isEn ? 'Claim checklist or visit notes...' : '청구 서류 확인 사항이나 진료 메모...'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            {formError && <p className="text-xs font-bold text-rose-500">{formError}</p>}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md disabled:opacity-50"
            >
              {isSaving
                ? isEn
                  ? 'Encrypting & Saving...'
                  : '암호화 저장 중...'
                : isEn
                ? 'Encrypt & Save'
                : '암호화하여 저장'}
            </button>
          </form>
        </div>
      )}

      {/* Lightbox Photo Viewer with Multi-Photo Navigation */}
      {lightboxState && (() => {
        const activePhotoId = lightboxState.photoIds[lightboxState.index];
        const activeSrc = activePhotoId ? decryptedPhotos[activePhotoId] : undefined;
        const total = lightboxState.photoIds.length;
        return (
          <div
            onClick={() => setLightboxState(null)}
            className="fixed inset-0 z-[100] bg-slate-950/95 flex flex-col items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md flex items-center justify-between text-white mb-3 gap-2"
            >
              <span className="text-xs font-bold truncate">
                {lightboxState.title}
                {total > 1 ? ` (${lightboxState.index + 1}/${total})` : ''}
              </span>
              <button
                type="button"
                aria-label={isEn ? 'Close lightbox' : '사진 뷰어 닫기'}
                onClick={() => setLightboxState(null)}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md flex items-center justify-center min-h-[240px]"
            >
              {activeSrc ? (
                <img
                  src={activeSrc}
                  alt={lightboxState.title}
                  className="max-h-[75vh] max-w-full rounded-xl object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-300 py-12">
                  <Shield size={28} className="animate-pulse text-teal-400" />
                  <span className="text-xs font-semibold">
                    {isEn ? 'Decrypting photo...' : '사진 복호화 중...'}
                  </span>
                </div>
              )}
              {total > 1 && (
                <>
                  <button
                    type="button"
                    aria-label={isEn ? 'Previous photo' : '이전 사진'}
                    disabled={lightboxState.index === 0}
                    onClick={() =>
                      setLightboxState((prev) =>
                        prev && prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev
                      )
                    }
                    className="absolute left-1 p-2 rounded-full bg-slate-900/80 text-white disabled:opacity-30"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    aria-label={isEn ? 'Next photo' : '다음 사진'}
                    disabled={lightboxState.index >= total - 1}
                    onClick={() =>
                      setLightboxState((prev) =>
                        prev && prev.index < total - 1 ? { ...prev, index: prev.index + 1 } : prev
                      )
                    }
                    className="absolute right-1 p-2 rounded-full bg-slate-900/80 text-white disabled:opacity-30"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {deleteAuthModal}
    </div>
  );
};

export default DiagnosticsPage;

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  CURRENT_SCHEMA_VERSION,
  Condition,
  PainLog,
  PainLogRevision,
  PainLogSnapshot,
  DiaryEntry,
  DiagnosticRecord,
  DiagnosticRevision,
  DiagnosticSnapshot,
  HealthDataPayload,
  HealthDataPayloadSchema,
  ClinicalBriefing,
  InputSource,
  RevisionReason,
  UNASSIGNED_CONDITION_ID,
} from '../types/health';
import {
  loadHealthData,
  saveHealthData,
  resetAllData,
  recoverAndNormalizeHealthPayload,
} from '../utils/storage';
import {
  AuditChainVerificationResult,
  computeDiagnosticSignature,
  computeRecordSignature,
  getGenesisSignature,
  verifyAuditChain,
  verifyDiagnosticSignature,
  verifyRecordSignature,
} from '../utils/crypto';
import { deleteEncryptedPhoto } from '../utils/mediaStorage';
import { normalizeIsoTimestamp, normalizeLocalYmd, toLocalYmd } from '../utils/dateUtils';
import { resolveBodyPartIds, resolvePqrstCodes } from '../utils/clinicalTaxonomy';
import { useAuth } from './AuthContext';
import { format, differenceInDays } from 'date-fns';

function buildPainLogSnapshot(log: PainLog): PainLogSnapshot {
  return {
    conditionId: log.conditionId,
    date: log.date,
    intensity: log.intensity,
    medication: log.medication,
    notes: log.notes,
    bodyPartOverride: log.bodyPartOverride,
    painQuality: log.painQuality,
    radiation: log.radiation,
    painTiming: log.painTiming,
    triggers: log.triggers,
    reliefFactors: log.reliefFactors,
    redFlags: log.redFlags,
    postMedIntensity: log.postMedIntensity,
    postMedSideEffects: log.postMedSideEffects,
    postMedEvaluatedAt: log.postMedEvaluatedAt,
    deletedAt: log.deletedAt,
    inputSource: log.inputSource,
    chainIndex: log.chainIndex,
    signature: log.signature,
    prevSignature: log.prevSignature,
    signedAt: log.signedAt,
  };
}

function buildDiagnosticSnapshot(diag: DiagnosticRecord): DiagnosticSnapshot {
  return {
    conditionId: diag.conditionId,
    diagnosisDate: diag.diagnosisDate,
    diagnosisName: diag.diagnosisName,
    hospitalName: diag.hospitalName,
    department: diag.department,
    amountKrw: diag.amountKrw,
    notes: diag.notes,
    photoIds: diag.photoIds,
    claimStatus: diag.claimStatus,
    claimDeadlineYears: diag.claimDeadlineYears,
    claimedAt: diag.claimedAt,
    deletedAt: diag.deletedAt,
    inputSource: diag.inputSource,
    signature: diag.signature,
    prevSignature: diag.prevSignature,
    signedAt: diag.signedAt,
  };
}

function getLatestAuditChainTip(allLogs: PainLog[]): PainLog | undefined {
  const signed = allLogs.filter((l) => Boolean(l.signature));
  if (signed.length === 0) return allLogs[0];
  return [...signed].sort((a, b) => {
    const aHasIdx = typeof a.chainIndex === 'number';
    const bHasIdx = typeof b.chainIndex === 'number';
    if (aHasIdx && bHasIdx && a.chainIndex !== b.chainIndex) {
      return (b.chainIndex as number) - (a.chainIndex as number);
    }
    if (aHasIdx !== bHasIdx) return aHasIdx ? -1 : 1;
    const aOrig = a.revisions?.[0]?.previous?.signedAt || a.signedAt;
    const bOrig = b.revisions?.[0]?.previous?.signedAt || b.signedAt;
    const aTime = aOrig ? new Date(aOrig).getTime() : 0;
    const bTime = bOrig ? new Date(bOrig).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function getActiveLogsSorted(allLogs: PainLog[]): PainLog[] {
  return allLogs
    .filter((l) => !l.deletedAt)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getActiveDiagnostics(allDiagnostics: DiagnosticRecord[]): DiagnosticRecord[] {
  return allDiagnostics.filter((d) => !d.deletedAt);
}

interface HealthContextValue {
  conditions: Condition[];
  logs: PainLog[];
  diaryEntries: DiaryEntry[];
  diagnosticRecords: DiagnosticRecord[];
  isLoading: boolean;
  saveEntry: (payload: {
    isNewCondition: boolean;
    isUnassigned?: boolean;
    skipPainLog?: boolean;
    inputSource?: InputSource;
    conditionData: { id?: string; label?: string; bodyPart?: string; onsetDate?: string };
    logData: {
      date: string;
      intensity: number;
      medication?: string;
      notes?: string;
      bodyPartOverride?: string;
      painQuality?: string[];
      radiation?: string;
      painTiming?: 'morning' | 'afternoon' | 'evening' | 'night' | 'constant' | 'intermittent';
      triggers?: string[];
      reliefFactors?: string[];
      redFlags?: string[];
      postMedIntensity?: number;
    };
    diagnosticData?: {
      diagnosisDate: string;
      diagnosisName: string;
      hospitalName?: string;
      department?: string;
      amountKrw?: number;
      notes?: string;
      photoIds?: string[];
      claimDeadlineYears?: number;
    };
  }) => Promise<boolean>;
  assignLogsToCondition: (
    logIds: string[],
    target: {
      existingConditionId?: string;
      newCondition?: { label: string; bodyPart: string; onsetDate?: string };
    }
  ) => Promise<string | null>;
  updateCondition: (id: string, updates: Partial<Condition>) => Promise<boolean>;
  archiveCondition: (id: string, isArchived: boolean) => Promise<boolean>;
  updateLog: (id: string, updates: Partial<PainLog>, reason?: RevisionReason) => Promise<boolean>;
  deleteLog: (id: string) => Promise<boolean>;
  verifyLogIntegrity: (log: PainLog) => Promise<boolean>;
  verifyAuditTrail: () => Promise<AuditChainVerificationResult>;
  verifyDiagnosticIntegrity: (record: DiagnosticRecord) => Promise<boolean>;
  saveDiaryEntry: (date: string, text: string) => void;
  addDiagnosticRecord: (
    record: Omit<DiagnosticRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<DiagnosticRecord>;
  updateDiagnosticRecord: (id: string, updates: Partial<DiagnosticRecord>) => Promise<boolean>;
  deleteDiagnosticRecord: (id: string) => Promise<boolean>;
  getClinicalBriefing: () => ClinicalBriefing;
  generateEMRSummaryText: (formatType?: 'standard' | 'soap') => string;
  exportBackupJson: () => string;
  importBackupJson: (jsonStr: string) => Promise<void>;
  resetData: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | null>(null);

export const HealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeSessionPin, isUnlocked, isPinSet } = useAuth();
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [logs, setLogs] = useState<PainLog[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diagnosticRecords, setDiagnosticRecords] = useState<DiagnosticRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Debounce timer for diary auto-saving and live refs to avoid stale closures / race overwrites
  const diaryDebounceTimer = useRef<any>(null);
  const conditionsRef = useRef<Condition[]>([]);
  const logsRef = useRef<PainLog[]>([]);
  const diaryEntriesRef = useRef<DiaryEntry[]>([]);
  const diagnosticRecordsRef = useRef<DiagnosticRecord[]>([]);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Load data once unlocked; purge sensitive records from memory immediately when locked
  useEffect(() => {
    if (!isUnlocked) {
      if (diaryDebounceTimer.current) {
        clearTimeout(diaryDebounceTimer.current);
        diaryDebounceTimer.current = null;
      }
      conditionsRef.current = [];
      logsRef.current = [];
      diaryEntriesRef.current = [];
      diagnosticRecordsRef.current = [];
      setConditions([]);
      setLogs([]);
      setDiaryEntries([]);
      setDiagnosticRecords([]);
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    loadHealthData(activeSessionPin || undefined)
      .then(({ data }) => {
        const nextConditions = data.conditions || [];
        const nextAllLogs = data.logs || [];
        const nextDiary = data.diaryEntries || [];
        const nextAllDiagnostics = data.diagnosticRecords || [];
        conditionsRef.current = nextConditions;
        logsRef.current = nextAllLogs;
        diaryEntriesRef.current = nextDiary;
        diagnosticRecordsRef.current = nextAllDiagnostics;
        setConditions(nextConditions);
        setLogs(getActiveLogsSorted(nextAllLogs));
        setDiaryEntries(nextDiary);
        setDiagnosticRecords(getActiveDiagnostics(nextAllDiagnostics));
      })
      .catch((err) => {
        console.error('Failed to load health data:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isUnlocked, activeSessionPin]);

  // Serialized persist helper ensuring latest slices & persist-before-commit safety
  const persist = (
    nextConditions: Condition[] = conditionsRef.current,
    nextLogs: PainLog[] = logsRef.current,
    nextDiary: DiaryEntry[] = diaryEntriesRef.current,
    nextDiagnostics: DiagnosticRecord[] = diagnosticRecordsRef.current
  ): Promise<void> => {
    if (isPinSet && !activeSessionPin) {
      const isEn = typeof document !== 'undefined' && document.documentElement?.dataset?.lang === 'en';
      return Promise.reject(
        new Error(
          isEn
            ? 'App is locked; cannot access the encryption key.'
            : '앱이 잠겨 있어 암호화 키에 접근할 수 없습니다.'
        )
      );
    }
    const payload: HealthDataPayload = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      conditions: nextConditions,
      logs: nextLogs,
      diaryEntries: nextDiary,
      diagnosticRecords: nextDiagnostics,
      lastUpdated: new Date().toISOString(),
    };
    const task = persistQueueRef.current.then(() => saveHealthData(payload, activeSessionPin || undefined));
    persistQueueRef.current = task.catch(() => {});
    return task;
  };

  const saveEntry = async (payload: {
    isNewCondition: boolean;
    isUnassigned?: boolean;
    skipPainLog?: boolean;
    inputSource?: InputSource;
    conditionData: { id?: string; label?: string; bodyPart?: string; onsetDate?: string };
    logData: {
      date: string;
      intensity: number;
      medication?: string;
      notes?: string;
      bodyPartOverride?: string;
      painQuality?: string[];
      radiation?: string;
      painTiming?: 'morning' | 'afternoon' | 'evening' | 'night' | 'constant' | 'intermittent';
      triggers?: string[];
      reliefFactors?: string[];
      redFlags?: string[];
      postMedIntensity?: number;
    };
    diagnosticData?: {
      diagnosisDate: string;
      diagnosisName: string;
      hospitalName?: string;
      department?: string;
      amountKrw?: number;
      notes?: string;
      photoIds?: string[];
      claimDeadlineYears?: number;
    };
  }): Promise<boolean> => {
    const curConditions = conditionsRef.current;
    const curLogs = logsRef.current;
    const curDiary = diaryEntriesRef.current;
    const curDiagnostics = diagnosticRecordsRef.current;

    let conditionId = payload.isUnassigned ? UNASSIGNED_CONDITION_ID : payload.conditionData.id;
    let nextConditions = [...curConditions];

    if (payload.isNewCondition && !payload.isUnassigned) {
      if (!payload.conditionData.label?.trim() || !payload.conditionData.bodyPart?.trim()) {
        return false;
      }
      conditionId = crypto.randomUUID();
      const bodyPartText = payload.conditionData.bodyPart.trim();
      const newCond: Condition = {
        id: conditionId,
        label: payload.conditionData.label.trim(),
        bodyPart: bodyPartText,
        bodyPartIds: resolveBodyPartIds(bodyPartText),
        onsetDate: normalizeLocalYmd(payload.conditionData.onsetDate),
        isArchived: false,
      };
      nextConditions = [...nextConditions, newCond];
    }

    if (!conditionId) return false;

    const nowIso = new Date().toISOString();
    let nextLogs = curLogs;
    if (!payload.skipPainLog) {
      const tip = getLatestAuditChainTip(curLogs);
      const prevSignature = tip ? getGenesisSignature(tip) : '';
      const chainIndex =
        typeof tip?.chainIndex === 'number' ? tip.chainIndex + 1 : curLogs.length;
      const painQualities = payload.logData.painQuality || [];
      const radiationText = payload.logData.radiation?.trim() || '';
      const triggers = payload.logData.triggers || [];
      const reliefFactors = payload.logData.reliefFactors || [];
      const redFlags = payload.logData.redFlags || [];
      const newLog: PainLog = {
        id: crypto.randomUUID(),
        conditionId,
        date: normalizeIsoTimestamp(payload.logData.date, nowIso),
        intensity: Number(payload.logData.intensity),
        medication: payload.logData.medication?.trim() || '',
        notes: payload.logData.notes?.trim() || '',
        bodyPartOverride: payload.logData.bodyPartOverride,
        bodyPartOverrideIds: resolveBodyPartIds(payload.logData.bodyPartOverride),
        painQuality: painQualities,
        painQualityCodes: resolvePqrstCodes('quality', painQualities),
        radiation: radiationText,
        radiationCodes: radiationText ? resolvePqrstCodes('radiation', [radiationText]) : [],
        painTiming: payload.logData.painTiming,
        triggers,
        triggerCodes: resolvePqrstCodes('triggers', triggers),
        reliefFactors,
        reliefFactorCodes: resolvePqrstCodes('reliefFactors', reliefFactors),
        redFlags,
        redFlagCodes: resolvePqrstCodes('redFlags', redFlags),
        postMedIntensity: payload.logData.postMedIntensity,
        prevSignature,
        signedAt: nowIso,
        chainIndex,
        inputSource: payload.inputSource,
      };

      newLog.signature = await computeRecordSignature(newLog, prevSignature);
      nextLogs = [newLog, ...curLogs];
    }

    let nextDiagnostics = curDiagnostics;
    const diagName = payload.diagnosticData?.diagnosisName?.trim();
    if (diagName) {
      const prevDiagSig = curDiagnostics.find((d) => Boolean(d.signature))?.signature || '';
      const newDiag: DiagnosticRecord = {
        id: crypto.randomUUID(),
        conditionId: payload.isUnassigned ? undefined : conditionId,
        diagnosisDate: normalizeLocalYmd(payload.diagnosticData?.diagnosisDate),
        diagnosisName: diagName,
        hospitalName: payload.diagnosticData?.hospitalName?.trim() || '',
        department: payload.diagnosticData?.department?.trim() || '',
        amountKrw: payload.diagnosticData?.amountKrw,
        notes: payload.diagnosticData?.notes?.trim() || '',
        photoIds: payload.diagnosticData?.photoIds || [],
        claimStatus: 'pending',
        claimDeadlineYears: payload.diagnosticData?.claimDeadlineYears || 3,
        createdAt: nowIso,
        updatedAt: nowIso,
        prevSignature: prevDiagSig,
        signedAt: nowIso,
        inputSource: payload.inputSource,
      };
      newDiag.signature = await computeDiagnosticSignature(newDiag, prevDiagSig);
      nextDiagnostics = [newDiag, ...curDiagnostics];
    }

    await persist(nextConditions, nextLogs, curDiary, nextDiagnostics);
    if (nextConditions !== curConditions) {
      conditionsRef.current = nextConditions;
      setConditions(nextConditions);
    }
    if (nextLogs !== curLogs) {
      logsRef.current = nextLogs;
      setLogs(getActiveLogsSorted(nextLogs));
    }
    if (nextDiagnostics !== curDiagnostics) {
      diagnosticRecordsRef.current = nextDiagnostics;
      setDiagnosticRecords(getActiveDiagnostics(nextDiagnostics));
    }
    return true;
  };

  const assignLogsToCondition = async (
    logIds: string[],
    target: {
      existingConditionId?: string;
      newCondition?: { label: string; bodyPart: string; onsetDate?: string };
    }
  ): Promise<string | null> => {
    if (!logIds.length) return null;

    let targetId = target.existingConditionId;
    const curConditions = conditionsRef.current;
    const curLogs = logsRef.current;
    const curDiary = diaryEntriesRef.current;
    const curDiagnostics = diagnosticRecordsRef.current;
    let nextConditions = [...curConditions];

    if (!targetId && target.newCondition) {
      const label = target.newCondition.label.trim();
      const bodyPart = target.newCondition.bodyPart.trim();
      if (!label || !bodyPart) return null;

      targetId = crypto.randomUUID();
      nextConditions = [
        ...nextConditions,
        {
          id: targetId,
          label,
          bodyPart,
          bodyPartIds: resolveBodyPartIds(bodyPart),
          onsetDate: normalizeLocalYmd(target.newCondition.onsetDate),
          isArchived: false,
        },
      ];
    }

    if (!targetId) return null;

    const idSet = new Set(logIds);
    const nowIso = new Date().toISOString();
    const nextLogs = await Promise.all(
      curLogs.map(async (log) => {
        if (!idSet.has(log.id) || log.deletedAt) return log;
        const revision: PainLogRevision = {
          editedAt: nowIso,
          reason: 'reassign_condition',
          previous: buildPainLogSnapshot(log),
        };
        const updated: PainLog = {
          ...log,
          conditionId: targetId!,
          signedAt: nowIso,
          revisions: [...(log.revisions || []), revision],
        };
        updated.signature = await computeRecordSignature(updated, updated.prevSignature || '');
        return updated;
      })
    );

    await persist(nextConditions, nextLogs, curDiary, curDiagnostics);
    conditionsRef.current = nextConditions;
    logsRef.current = nextLogs;
    setConditions(nextConditions);
    setLogs(getActiveLogsSorted(nextLogs));
    return targetId;
  };

  const updateCondition = async (id: string, updates: Partial<Condition>): Promise<boolean> => {
    const resolvedUpdates: Partial<Condition> =
      updates.bodyPart !== undefined && updates.bodyPartIds === undefined
        ? { ...updates, bodyPartIds: resolveBodyPartIds(updates.bodyPart) }
        : updates;
    const next = conditionsRef.current.map((c) => (c.id === id ? { ...c, ...resolvedUpdates } : c));
    await persist(next, logsRef.current, diaryEntriesRef.current, diagnosticRecordsRef.current);
    conditionsRef.current = next;
    setConditions(next);
    return true;
  };

  const archiveCondition = async (id: string, isArchived: boolean): Promise<boolean> => {
    return updateCondition(id, { isArchived });
  };

  const updateLog = async (
    id: string,
    updates: Partial<PainLog>,
    reason: RevisionReason = 'edit'
  ): Promise<boolean> => {
    const curLogs = logsRef.current;
    const logToUpdate = curLogs.find((l) => l.id === id);
    if (!logToUpdate || logToUpdate.deletedAt) return false;

    const nowIso = new Date().toISOString();
    const resolvedReason: RevisionReason =
      updates.postMedIntensity !== undefined && reason === 'edit' ? 'post_med_eval' : reason;
    const revision: PainLogRevision = {
      editedAt: nowIso,
      reason: resolvedReason,
      previous: buildPainLogSnapshot(logToUpdate),
    };

    const updatedLog: PainLog = {
      ...logToUpdate,
      ...updates,
      prevSignature: logToUpdate.prevSignature || '',
      chainIndex: logToUpdate.chainIndex,
      signedAt: nowIso,
      revisions: [...(logToUpdate.revisions || []), revision],
    };
    updatedLog.signature = await computeRecordSignature(updatedLog, updatedLog.prevSignature || '');

    const next = curLogs.map((l) => (l.id === id ? updatedLog : l));
    await persist(conditionsRef.current, next, diaryEntriesRef.current, diagnosticRecordsRef.current);
    logsRef.current = next;
    setLogs(getActiveLogsSorted(next));
    return true;
  };

  const deleteLog = async (id: string): Promise<boolean> => {
    const curLogs = logsRef.current;
    const logToDelete = curLogs.find((l) => l.id === id);
    if (!logToDelete || logToDelete.deletedAt) return false;

    // Soft-delete preserves the node in the SHA-256 audit chain so downstream prevSignature links remain unbroken.
    const nowIso = new Date().toISOString();
    const revision: PainLogRevision = {
      editedAt: nowIso,
      reason: 'soft_delete',
      previous: buildPainLogSnapshot(logToDelete),
    };
    const softDeleted: PainLog = {
      ...logToDelete,
      deletedAt: nowIso,
      signedAt: nowIso,
      revisions: [...(logToDelete.revisions || []), revision],
    };
    softDeleted.signature = await computeRecordSignature(
      softDeleted,
      softDeleted.prevSignature || ''
    );

    const next = curLogs.map((l) => (l.id === id ? softDeleted : l));
    await persist(conditionsRef.current, next, diaryEntriesRef.current, diagnosticRecordsRef.current);
    logsRef.current = next;
    setLogs(getActiveLogsSorted(next));
    return true;
  };

  // Debounced Diary Entry saving using live refs to avoid overwriting concurrent log/condition changes
  const saveDiaryEntry = (date: string, text: string) => {
    const dateKey = toLocalYmd(date);
    const curEntries = diaryEntriesRef.current;
    const existingIndex = curEntries.findIndex((e) => e.date === dateKey);
    const nextEntries = [...curEntries];

    if (existingIndex >= 0) {
      if (!text.trim()) {
        nextEntries.splice(existingIndex, 1);
      } else {
        nextEntries[existingIndex] = {
          date: dateKey,
          text,
          updatedAt: new Date().toISOString(),
        };
      }
    } else if (text.trim()) {
      nextEntries.push({
        date: dateKey,
        text,
        updatedAt: new Date().toISOString(),
      });
    }

    diaryEntriesRef.current = nextEntries;
    setDiaryEntries(nextEntries);

    if (diaryDebounceTimer.current) {
      clearTimeout(diaryDebounceTimer.current);
    }
    diaryDebounceTimer.current = setTimeout(() => {
      diaryDebounceTimer.current = null;
      persist(
        conditionsRef.current,
        logsRef.current,
        diaryEntriesRef.current,
        diagnosticRecordsRef.current
      ).catch((err) => {
        console.error('Failed to persist debounced diary entry:', err);
      });
    }, 400);
  };

  // Clinical Briefing Generator (For Doctors & Nurses)
  const getClinicalBriefing = (): ClinicalBriefing => {
    const now = new Date();
    const activeConditions = conditions.filter((c) => !c.isArchived);

    // Days tracked
    const uniqueDates = new Set(logs.map((l) => toLocalYmd(l.date)));

    // Red flags accumulator
    const redFlagsSet = new Set<string>();
    const qualityMap: Record<string, number> = {};
    const timingMap = {
      morningCount: 0,
      nightCount: 0,
      constantCount: 0,
      intermittentCount: 0,
    };

    logs.forEach((l) => {
      l.redFlags?.forEach((rf) => redFlagsSet.add(rf));
      l.painQuality?.forEach((q) => {
        qualityMap[q] = (qualityMap[q] || 0) + 1;
      });
      if (l.painTiming === 'morning') timingMap.morningCount += 1;
      if (l.painTiming === 'night') timingMap.nightCount += 1;
      if (l.painTiming === 'constant') timingMap.constantCount += 1;
      if (l.painTiming === 'intermittent') timingMap.intermittentCount += 1;
    });

    // Condition summaries
    const conditionsSummary = activeConditions.map((cond) => {
      const cLogs = logs
        .filter((l) => l.conditionId === cond.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const recentLog = cLogs[cLogs.length - 1] || null;
      const prevLog = cLogs[cLogs.length - 2] || null;

      // 7-day logs
      const logs7d = cLogs.filter((l) => differenceInDays(now, new Date(l.date)) <= 7);
      const avg7d = logs7d.length
        ? Number((logs7d.reduce((s, l) => s + l.intensity, 0) / logs7d.length).toFixed(1))
        : null;

      // 30-day logs
      const logs30d = cLogs.filter((l) => differenceInDays(now, new Date(l.date)) <= 30);
      const avg30d = logs30d.length
        ? Number((logs30d.reduce((s, l) => s + l.intensity, 0) / logs30d.length).toFixed(1))
        : null;

      const peak = cLogs.length ? Math.max(...cLogs.map((l) => l.intensity)) : null;

      let trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data' = 'insufficient_data';
      let delta: number | null = null;
      if (recentLog && prevLog) {
        delta = recentLog.intensity - prevLog.intensity;
        if (delta > 0) trend = 'worsening';
        else if (delta < 0) trend = 'improving';
        else trend = 'stable';
      }

      // Medications
      const medCounts: Record<string, number> = {};
      let logsWithMeds = 0;
      const qualities = new Set<string>();
      const radiations = new Set<string>();
      const triggers = new Set<string>();
      const reliefFactors = new Set<string>();

      cLogs.forEach((l) => {
        if (l.medication?.trim()) {
          logsWithMeds += 1;
          medCounts[l.medication.trim()] = (medCounts[l.medication.trim()] || 0) + 1;
        }
        l.painQuality?.forEach((q) => qualities.add(q));
        if (l.radiation) radiations.add(l.radiation);
        l.triggers?.forEach((t) => triggers.add(t));
        l.reliefFactors?.forEach((r) => reliefFactors.add(r));
      });

      const frequentMeds = Object.entries(medCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const adherenceRate = cLogs.length ? Math.round((logsWithMeds / cLogs.length) * 100) : 0;

      return {
        condition: cond,
        recentIntensity: recentLog?.intensity ?? null,
        avgIntensity7Days: avg7d,
        avgIntensity30Days: avg30d,
        peakIntensity: peak,
        trend,
        delta,
        frequentMedications: frequentMeds,
        medicationAdherenceRate: adherenceRate,
        recentLogs: cLogs.slice(-5).reverse(),
        painQualities: Array.from(qualities),
        radiations: Array.from(radiations),
        triggers: Array.from(triggers),
        reliefFactors: Array.from(reliefFactors),
      };
    });

    const isEn = typeof document !== 'undefined' && document.documentElement?.dataset?.lang === 'en';

    // Body Part distribution (split comma-separated multi-region parts)
    const bodyPartDist: Record<string, { count: number; maxIntensity: number }> = {};
    logs.forEach((log) => {
      const cond = conditions.find((c) => c.id === log.conditionId);
      const rawPart = log.bodyPartOverride || cond?.bodyPart || (isEn ? 'Unspecified' : '미지정');
      const parts = rawPart.includes(',')
        ? rawPart.split(',').map((s) => s.trim()).filter(Boolean)
        : [rawPart];

      parts.forEach((part) => {
        if (!bodyPartDist[part]) {
          bodyPartDist[part] = { count: 0, maxIntensity: 0 };
        }
        bodyPartDist[part].count += 1;
        bodyPartDist[part].maxIntensity = Math.max(bodyPartDist[part].maxIntensity, log.intensity);
      });
    });

    // Medication response
    const medMap: Record<string, { totalInt: number; count: number }> = {};
    logs.forEach((l) => {
      if (l.medication?.trim()) {
        const med = l.medication.trim();
        if (!medMap[med]) medMap[med] = { totalInt: 0, count: 0 };
        medMap[med].totalInt += l.intensity;
        medMap[med].count += 1;
      }
    });

    const medicationResponse = Object.entries(medMap).map(([medication, stats]) => ({
      medication,
      logCount: stats.count,
      avgIntensityWhenTaken: Number((stats.totalInt / stats.count).toFixed(1)),
      nextDayAvgIntensity: null,
    }));

    // Build Standard SOAP Note
    const chiefComplaints = conditionsSummary.map((c) => `${c.condition.label} (${c.condition.bodyPart})`).join(', ');
    const sQualities = Object.keys(qualityMap).join(', ') || (isEn ? 'None specified' : '특이 양상 미기재');
    const noneLabel = isEn ? 'None' : '없음';
    const soapSubjective = isEn
      ? `Chief Complaint (CC): ${chiefComplaints || noneLabel}\nPain Quality (PQRST): ${sQualities}\nRadiation: ${
          conditionsSummary.flatMap((c) => c.radiations).join(', ') || noneLabel
        }\nTriggers: ${conditionsSummary.flatMap((c) => c.triggers).join(', ') || noneLabel}\nRelieving Factors: ${
          conditionsSummary.flatMap((c) => c.reliefFactors).join(', ') || noneLabel
        }`
      : `주호소(CC): ${chiefComplaints || '없음'}\n통증 양상(PQRST): ${sQualities}\n방사통: ${
          conditionsSummary.flatMap((c) => c.radiations).join(', ') || '없음'
        }\n유발인자: ${conditionsSummary.flatMap((c) => c.triggers).join(', ') || '없음'}\n완화인자: ${
          conditionsSummary.flatMap((c) => c.reliefFactors).join(', ') || '없음'
        }`;

    const soapObjective = isEn
      ? `Pain Intensity (NRS): 7d Avg ${conditionsSummary[0]?.avgIntensity7Days ?? '-'}/10, Peak ${
          conditionsSummary[0]?.peakIntensity ?? '-'
        }/10, Latest ${conditionsSummary[0]?.recentIntensity ?? '-'}/10\nMedication Adherence: ${
          conditionsSummary[0]?.medicationAdherenceRate ?? 0
        }%\nRed Flags: ${Array.from(redFlagsSet).join(', ') || 'None detected (Negative)'}`
      : `통증 강도(NRS): 7일 평균 ${
          conditionsSummary[0]?.avgIntensity7Days ?? '-'
        }/10, 최고 ${conditionsSummary[0]?.peakIntensity ?? '-'}/10, 최근 ${
          conditionsSummary[0]?.recentIntensity ?? '-'
        }/10\n투약 순응도: ${conditionsSummary[0]?.medicationAdherenceRate ?? 0}%\n위험징후(Red Flags): ${
          Array.from(redFlagsSet).join(', ') || '특이소견 없음(음성)'
        }`;

    const soapAssessment = isEn
      ? `Course: ${conditionsSummary
          .map(
            (c) =>
              `${c.condition.label}: ${
                c.trend === 'improving' ? 'Improving' : c.trend === 'worsening' ? 'Worsening' : 'Stable'
              }`
          )
          .join('; ')}\nMedication Response: ${
          medicationResponse.map((m) => `${m.medication} (Avg NRS ${m.avgIntensityWhenTaken})`).join(', ') || 'No records'
        }`
      : `경과 상태: ${
          conditionsSummary.map((c) => `${c.condition.label}: ${c.trend === 'improving' ? '호전' : c.trend === 'worsening' ? '악화' : '유지'}`).join('; ')
        }\n복약 반응: ${medicationResponse.map((m) => `${m.medication}(평균 NRS ${m.avgIntensityWhenTaken})`).join(', ') || '기록 없음'}`;

    const soapPlan = isEn
      ? `Medication Management: Evaluate continuation, titration, or adjustment of current regimen\nFollow-up: Consider specialist diagnostic workup if NRS >= 7 persists`
      : `투약 관리: 현재 처방약 복용 지속 여부 및 증량/변경 평가 요망\n추적 관찰: NRS 7 이상 지속 시 전문 정밀 진단 권고`;

    return {
      patientSummary: {
        activeConditionsCount: activeConditions.length,
        totalLogsRecorded: logs.length,
        daysTracked: uniqueDates.size,
      },
      conditionsSummary,
      bodyPartDistribution: bodyPartDist,
      medicationResponse,
      redFlagsDetected: Array.from(redFlagsSet),
      timingAnalysis: timingMap,
      qualityDistribution: qualityMap,
      soapNote: {
        subjective: soapSubjective,
        objective: soapObjective,
        assessment: soapAssessment,
        plan: soapPlan,
      },
    };
  };

  // Generate EMR Formatted Text for Doctors & Nurses
  const generateEMRSummaryText = (formatType: 'standard' | 'soap' = 'standard'): string => {
    const isEn = typeof document !== 'undefined' && document.documentElement?.dataset?.lang === 'en';
    const briefing = getClinicalBriefing();
    const today = format(new Date(), 'yyyy-MM-dd HH:mm');

    if (formatType === 'soap') {
      let soap = `[SOAP CLINICAL PROGRESS NOTE - Bignal]\n`;
      soap += `Date/Time: ${today}\n`;
      soap += `--------------------------------------------------\n`;
      soap += `[S - Subjective]\n${briefing.soapNote.subjective}\n\n`;
      soap += `[O - Objective]\n${briefing.soapNote.objective}\n\n`;
      soap += `[A - Assessment]\n${briefing.soapNote.assessment}\n\n`;
      soap += `[P - Plan]\n${briefing.soapNote.plan}\n`;
      soap += `--------------------------------------------------\n`;
      soap += isEn
        ? `* Integrity verified on-device based on patient self-reported logs (NRS 0-10 standard).`
        : `* 국제 통증 표준(NRS 0-10) 및 환자 온디바이스 자가 기록 기반 무결성 검증 완료.`;
      return soap;
    }

    if (isEn) {
      let text = `[Body Signal Clinical Visit Summary - ${today}]\n`;
      text += `■ Tracking Overview: ${briefing.patientSummary.activeConditionsCount} active conditions / ${briefing.patientSummary.daysTracked} days tracked\n`;

      if (briefing.redFlagsDetected.length > 0) {
        text += `🚨 [Alert: Emergency Red Flags Detected]\n- ${briefing.redFlagsDetected.join(', ')}\n\n`;
      }

      briefing.conditionsSummary.forEach((item, idx) => {
        text += `[Condition ${idx + 1}] ${item.condition.label} (${item.condition.bodyPart})\n`;
        text += `- Onset: ${item.condition.onsetDate || 'Unknown'}\n`;
        text += `- Latest Pain: ${item.recentIntensity !== null ? `NRS ${item.recentIntensity}/10` : 'No record'}\n`;
        text += `- 7d Avg: ${item.avgIntensity7Days !== null ? `NRS ${item.avgIntensity7Days}` : '-'} | Peak: NRS ${item.peakIntensity ?? '-'}\n`;
        text += `- Trend: ${
          item.trend === 'improving' ? 'Improving (↓)' : item.trend === 'worsening' ? 'Worsening (↑)' : 'Stable (→)'
        } (${item.delta ? (item.delta > 0 ? `+${item.delta}` : item.delta) : 0})\n`;

        if (item.painQualities.length > 0) {
          text += `- Qualities: ${item.painQualities.join(', ')}\n`;
        }
        if (item.radiations.length > 0) {
          text += `- Radiation: ${item.radiations.join(', ')}\n`;
        }
        if (item.triggers.length > 0) {
          text += `- Triggers: ${item.triggers.join(', ')}\n`;
        }
        if (item.reliefFactors.length > 0) {
          text += `- Relieving Factors: ${item.reliefFactors.join(', ')}\n`;
        }
        if (item.frequentMedications.length > 0) {
          text += `- Medications: ${item.frequentMedications.join(', ')} (Logging rate: ${item.medicationAdherenceRate}%)\n`;
        }
        if (item.recentLogs.length > 0) {
          text += `- Recent Logs:\n`;
          item.recentLogs.slice(0, 3).forEach((l) => {
            text += `  * ${format(new Date(l.date), 'MM/dd HH:mm')} [NRS ${l.intensity}] ${l.medication ? `Med: ${l.medication}` : ''} ${l.notes ? `"${l.notes}"` : ''}\n`;
          });
        }
        text += `\n`;
      });

      if (Object.keys(briefing.bodyPartDistribution).length > 0) {
        text += `■ Affected Body Regions:\n`;
        Object.entries(briefing.bodyPartDistribution).forEach(([part, data]) => {
          text += `- ${part}: ${data.count} logs (Peak NRS ${data.maxIntensity})\n`;
        });
        text += `\n`;
      }

      text += `* Automatically compiled from encrypted on-device self-reported records in Body Signal.`;
      return text;
    }

    let text = `[Body Signal 임상 진료 요약 - ${today}]\n`;
    text += `■ 환자 증상 추적 현황: 관리 질환 ${briefing.patientSummary.activeConditionsCount}개 / 기록 일수 ${briefing.patientSummary.daysTracked}일\n`;

    if (briefing.redFlagsDetected.length > 0) {
      text += `🚨 [주의: 응급 위험 징후(Red Flags) 감지]\n- ${briefing.redFlagsDetected.join(', ')}\n\n`;
    }

    briefing.conditionsSummary.forEach((item, idx) => {
      text += `[질환 ${idx + 1}] ${item.condition.label} (${item.condition.bodyPart})\n`;
      text += `- 발병일: ${item.condition.onsetDate || '미상'}\n`;
      text += `- 최근 통증: ${item.recentIntensity !== null ? `NRS ${item.recentIntensity}/10` : '기록 없음'}\n`;
      text += `- 7일 평균: ${item.avgIntensity7Days !== null ? `NRS ${item.avgIntensity7Days}` : '-'} | 최고 통증: NRS ${item.peakIntensity ?? '-'}\n`;
      text += `- 변화 추세: ${
        item.trend === 'improving' ? '호전 중 (↓)' : item.trend === 'worsening' ? '악화 (↑)' : '유지 (→)'
      } (${item.delta ? (item.delta > 0 ? `+${item.delta}` : item.delta) : 0})\n`;

      if (item.painQualities.length > 0) {
        text += `- 통증 양상: ${item.painQualities.join(', ')}\n`;
      }
      if (item.radiations.length > 0) {
        text += `- 방사통: ${item.radiations.join(', ')}\n`;
      }
      if (item.triggers.length > 0) {
        text += `- 악화 유발: ${item.triggers.join(', ')}\n`;
      }
      if (item.reliefFactors.length > 0) {
        text += `- 완화 요인: ${item.reliefFactors.join(', ')}\n`;
      }
      if (item.frequentMedications.length > 0) {
        text += `- 복용 약제: ${item.frequentMedications.join(', ')} (투약 기록률: ${item.medicationAdherenceRate}%)\n`;
      }
      if (item.recentLogs.length > 0) {
        text += `- 최근 기록:\n`;
        item.recentLogs.slice(0, 3).forEach((l) => {
          text += `  * ${format(new Date(l.date), 'MM/dd HH:mm')} [NRS ${l.intensity}] ${l.medication ? `약: ${l.medication}` : ''} ${l.notes ? `"${l.notes}"` : ''}\n`;
        });
      }
      text += `\n`;
    });

    if (Object.keys(briefing.bodyPartDistribution).length > 0) {
      text += `■ 주요 환부 분포:\n`;
      Object.entries(briefing.bodyPartDistribution).forEach(([part, data]) => {
        text += `- ${part}: 총 ${data.count}회 기록 (최고 강도 NRS ${data.maxIntensity})\n`;
      });
      text += `\n`;
    }

    text += `* 본 요약은 환자가 바디 시그널(Body Signal) 앱에 직접 기록한 온디바이스 암호화 데이터를 바탕으로 자동 집계되었습니다.`;
    return text;
  };

  const addDiagnosticRecord = async (
    record: Omit<DiagnosticRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DiagnosticRecord> => {
    const now = new Date().toISOString();
    const prevDiagSig =
      diagnosticRecordsRef.current.find((d) => Boolean(d.signature))?.signature || '';
    const created: DiagnosticRecord = {
      ...record,
      diagnosisDate: normalizeLocalYmd(record.diagnosisDate),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      prevSignature: prevDiagSig,
      signedAt: now,
    };
    created.signature = await computeDiagnosticSignature(created, prevDiagSig);
    const nextDiagnostics = [created, ...diagnosticRecordsRef.current];
    await persist(conditionsRef.current, logsRef.current, diaryEntriesRef.current, nextDiagnostics);
    diagnosticRecordsRef.current = nextDiagnostics;
    setDiagnosticRecords(getActiveDiagnostics(nextDiagnostics));
    return created;
  };

  const updateDiagnosticRecord = async (
    id: string,
    updates: Partial<DiagnosticRecord>
  ): Promise<boolean> => {
    const curDiagnostics = diagnosticRecordsRef.current;
    const target = curDiagnostics.find((d) => d.id === id);
    if (!target || target.deletedAt) return false;

    const now = new Date().toISOString();
    const revision: DiagnosticRevision = {
      editedAt: now,
      reason: 'edit',
      previous: buildDiagnosticSnapshot(target),
    };
    const updated: DiagnosticRecord = {
      ...target,
      ...updates,
      diagnosisDate: normalizeLocalYmd(updates.diagnosisDate ?? target.diagnosisDate),
      updatedAt: now,
      signedAt: now,
      prevSignature: target.prevSignature || '',
      revisions: [...(target.revisions || []), revision],
    };
    updated.signature = await computeDiagnosticSignature(updated, updated.prevSignature || '');

    const nextDiagnostics = curDiagnostics.map((d) => (d.id === id ? updated : d));
    await persist(conditionsRef.current, logsRef.current, diaryEntriesRef.current, nextDiagnostics);
    diagnosticRecordsRef.current = nextDiagnostics;
    setDiagnosticRecords(getActiveDiagnostics(nextDiagnostics));
    return true;
  };

  const deleteDiagnosticRecord = async (id: string): Promise<boolean> => {
    const curDiagnostics = diagnosticRecordsRef.current;
    const target = curDiagnostics.find((d) => d.id === id);
    if (!target || target.deletedAt) return false;

    const now = new Date().toISOString();
    const revision: DiagnosticRevision = {
      editedAt: now,
      reason: 'soft_delete',
      previous: buildDiagnosticSnapshot(target),
    };
    const softDeleted: DiagnosticRecord = {
      ...target,
      deletedAt: now,
      updatedAt: now,
      signedAt: now,
      prevSignature: target.prevSignature || '',
      revisions: [...(target.revisions || []), revision],
    };
    softDeleted.signature = await computeDiagnosticSignature(
      softDeleted,
      softDeleted.prevSignature || ''
    );

    const nextDiagnostics = curDiagnostics.map((d) => (d.id === id ? softDeleted : d));
    await persist(conditionsRef.current, logsRef.current, diaryEntriesRef.current, nextDiagnostics);
    if (target.photoIds?.length) {
      await Promise.all(target.photoIds.map((pid) => deleteEncryptedPhoto(pid)));
    }
    diagnosticRecordsRef.current = nextDiagnostics;
    setDiagnosticRecords(getActiveDiagnostics(nextDiagnostics));
    return true;
  };

  const exportBackupJson = (): string => {
    const payload: HealthDataPayload = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      conditions: conditionsRef.current,
      logs: logsRef.current,
      diaryEntries: diaryEntriesRef.current,
      diagnosticRecords: diagnosticRecordsRef.current,
      lastUpdated: new Date().toISOString(),
    };
    return JSON.stringify(payload, null, 2);
  };

  const importBackupJson = async (jsonStr: string) => {
    const parsed = JSON.parse(jsonStr);
    const raw = parsed?.data || parsed;
    if (raw && Array.isArray(raw.conditions) && Array.isArray(raw.logs)) {
      const candidate = {
        ...raw,
        diaryEntries: Array.isArray(raw.diaryEntries) ? raw.diaryEntries : [],
        diagnosticRecords: Array.isArray(raw.diagnosticRecords) ? raw.diagnosticRecords : [],
        lastUpdated: typeof raw.lastUpdated === 'string' ? raw.lastUpdated : new Date().toISOString(),
      };
      const strictCheck = HealthDataPayloadSchema.safeParse(candidate);
      let validated: HealthDataPayload;
      if (strictCheck.success) {
        validated = recoverAndNormalizeHealthPayload(strictCheck.data).payload;
      } else {
        const { payload, recoveredWarnings } = recoverAndNormalizeHealthPayload(candidate);
        if (
          raw.conditions.length + raw.logs.length > 0 &&
          payload.conditions.length + payload.logs.length === 0
        ) {
          validated = HealthDataPayloadSchema.parse(candidate) as HealthDataPayload;
        } else {
          if (recoveredWarnings.length > 0) {
            console.warn('Imported backup recovery warnings:', recoveredWarnings);
          }
          validated = payload;
        }
      }
      await persist(
        validated.conditions,
        validated.logs,
        validated.diaryEntries,
        validated.diagnosticRecords
      );
      conditionsRef.current = validated.conditions;
      logsRef.current = validated.logs;
      diaryEntriesRef.current = validated.diaryEntries;
      diagnosticRecordsRef.current = validated.diagnosticRecords;
      setConditions(validated.conditions);
      setLogs(getActiveLogsSorted(validated.logs));
      setDiaryEntries(validated.diaryEntries);
      setDiagnosticRecords(getActiveDiagnostics(validated.diagnosticRecords));
    } else {
      const isEn = typeof document !== 'undefined' && document.documentElement?.dataset?.lang === 'en';
      throw new Error(isEn ? 'Invalid backup file format.' : '올바른 백업 파일 형식이 아닙니다.');
    }
  };

  const resetData = async () => {
    if (diaryDebounceTimer.current) {
      clearTimeout(diaryDebounceTimer.current);
      diaryDebounceTimer.current = null;
    }
    await resetAllData();
    conditionsRef.current = [];
    logsRef.current = [];
    diaryEntriesRef.current = [];
    diagnosticRecordsRef.current = [];
    setConditions([]);
    setLogs([]);
    setDiaryEntries([]);
    setDiagnosticRecords([]);
  };

  const verifyAuditTrail = () => verifyAuditChain(logsRef.current);

  return (
    <HealthContext.Provider
      value={{
        conditions,
        logs,
        diaryEntries,
        diagnosticRecords,
        isLoading,
        saveEntry,
        assignLogsToCondition,
        updateCondition,
        archiveCondition,
        updateLog,
        deleteLog,
        verifyLogIntegrity: verifyRecordSignature,
        verifyAuditTrail,
        verifyDiagnosticIntegrity: verifyDiagnosticSignature,
        saveDiaryEntry,
        addDiagnosticRecord,
        updateDiagnosticRecord,
        deleteDiagnosticRecord,
        getClinicalBriefing,
        generateEMRSummaryText,
        exportBackupJson,
        importBackupJson,
        resetData,
      }}
    >
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used within HealthProvider');
  }
  return context;
};

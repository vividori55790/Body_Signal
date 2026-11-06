import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { Condition, PainLog, DiaryEntry, HealthDataPayload, ClinicalBriefing } from '../types/health';
import { loadHealthData, saveHealthData, resetAllData } from '../utils/storage';
import { useAuth } from './AuthContext';
import { format, subDays, differenceInDays } from 'date-fns';

interface HealthContextValue {
  conditions: Condition[];
  logs: PainLog[];
  diaryEntries: DiaryEntry[];
  isLoading: boolean;
  saveEntry: (payload: {
    isNewCondition: boolean;
    conditionData: { id?: string; label?: string; bodyPart?: string; onsetDate?: string };
    logData: { date: string; intensity: number; medication?: string; notes?: string; bodyPartOverride?: string };
  }) => Promise<boolean>;
  updateCondition: (id: string, updates: Partial<Condition>) => Promise<boolean>;
  archiveCondition: (id: string, isArchived: boolean) => Promise<boolean>;
  updateLog: (id: string, updates: Partial<PainLog>) => Promise<boolean>;
  deleteLog: (id: string) => Promise<boolean>;
  saveDiaryEntry: (date: string, text: string) => void;
  getClinicalBriefing: () => ClinicalBriefing;
  generateEMRSummaryText: () => string;
  exportBackupJson: () => string;
  importBackupJson: (jsonStr: string) => Promise<void>;
  resetData: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | null>(null);

export const HealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeSessionPin, isUnlocked } = useAuth();
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [logs, setLogs] = useState<PainLog[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Debounce timer for diary auto-saving
  const diaryDebounceTimer = useRef<any>(null);

  // Load data once unlocked
  useEffect(() => {
    if (!isUnlocked) return;

    setIsLoading(true);
    loadHealthData(activeSessionPin || undefined)
      .then(({ data }) => {
        setConditions(data.conditions || []);
        setLogs(data.logs || []);
        setDiaryEntries(data.diaryEntries || []);
      })
      .catch((err) => {
        console.error('Failed to load health data:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isUnlocked, activeSessionPin]);

  // Persist data helper
  const persist = async (nextConditions: Condition[], nextLogs: PainLog[], nextDiary: DiaryEntry[]) => {
    const payload: HealthDataPayload = {
      conditions: nextConditions,
      logs: nextLogs,
      diaryEntries: nextDiary,
      lastUpdated: new Date().toISOString(),
    };
    await saveHealthData(payload, activeSessionPin || undefined);
  };

  const saveEntry = async (payload: {
    isNewCondition: boolean;
    conditionData: { id?: string; label?: string; bodyPart?: string; onsetDate?: string };
    logData: { date: string; intensity: number; medication?: string; notes?: string; bodyPartOverride?: string };
  }): Promise<boolean> => {
    let conditionId = payload.conditionData.id;
    let nextConditions = [...conditions];

    if (payload.isNewCondition) {
      if (!payload.conditionData.label?.trim() || !payload.conditionData.bodyPart?.trim()) {
        return false;
      }
      conditionId = crypto.randomUUID();
      const newCond: Condition = {
        id: conditionId,
        label: payload.conditionData.label.trim(),
        bodyPart: payload.conditionData.bodyPart.trim(),
        onsetDate: payload.conditionData.onsetDate || new Date().toISOString().split('T')[0],
        isArchived: false,
      };
      nextConditions = [...nextConditions, newCond];
      setConditions(nextConditions);
    }

    if (!conditionId) return false;

    const newLog: PainLog = {
      id: crypto.randomUUID(),
      conditionId,
      date: payload.logData.date || new Date().toISOString(),
      intensity: Number(payload.logData.intensity),
      medication: payload.logData.medication?.trim() || '',
      notes: payload.logData.notes?.trim() || '',
      bodyPartOverride: payload.logData.bodyPartOverride,
    };

    const nextLogs = [newLog, ...logs];
    setLogs(nextLogs);
    await persist(nextConditions, nextLogs, diaryEntries);
    return true;
  };

  const updateCondition = async (id: string, updates: Partial<Condition>): Promise<boolean> => {
    const next = conditions.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setConditions(next);
    await persist(next, logs, diaryEntries);
    return true;
  };

  const archiveCondition = async (id: string, isArchived: boolean): Promise<boolean> => {
    return updateCondition(id, { isArchived });
  };

  const updateLog = async (id: string, updates: Partial<PainLog>): Promise<boolean> => {
    const next = logs.map((l) => (l.id === id ? { ...l, ...updates } : l));
    setLogs(next);
    await persist(conditions, next, diaryEntries);
    return true;
  };

  const deleteLog = async (id: string): Promise<boolean> => {
    const next = logs.filter((l) => l.id !== id);
    setLogs(next);
    await persist(conditions, next, diaryEntries);
    return true;
  };

  // Debounced Diary Entry saving
  const saveDiaryEntry = (date: string, text: string) => {
    const dateKey = date.slice(0, 10);
    const existingIndex = diaryEntries.findIndex((e) => e.date === dateKey);
    let nextEntries = [...diaryEntries];

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

    setDiaryEntries(nextEntries);

    // Debounce IndexedDB writing
    if (diaryDebounceTimer.current) {
      clearTimeout(diaryDebounceTimer.current);
    }
    diaryDebounceTimer.current = setTimeout(() => {
      persist(conditions, logs, nextEntries);
    }, 400);
  };

  // Clinical Briefing Generator (For Doctors & Nurses)
  const getClinicalBriefing = (): ClinicalBriefing => {
    const now = new Date();
    const activeConditions = conditions.filter((c) => !c.isArchived);

    // Days tracked
    const uniqueDates = new Set(logs.map((l) => l.date.slice(0, 10)));

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
      cLogs.forEach((l) => {
        if (l.medication?.trim()) {
          logsWithMeds += 1;
          medCounts[l.medication.trim()] = (medCounts[l.medication.trim()] || 0) + 1;
        }
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
      };
    });

    // Body Part distribution
    const bodyPartDist: Record<string, { count: number; maxIntensity: number }> = {};
    logs.forEach((log) => {
      const cond = conditions.find((c) => c.id === log.conditionId);
      const part = log.bodyPartOverride || cond?.bodyPart || '미지정';
      if (!bodyPartDist[part]) {
        bodyPartDist[part] = { count: 0, maxIntensity: 0 };
      }
      bodyPartDist[part].count += 1;
      bodyPartDist[part].maxIntensity = Math.max(bodyPartDist[part].maxIntensity, log.intensity);
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

    return {
      patientSummary: {
        activeConditionsCount: activeConditions.length,
        totalLogsRecorded: logs.length,
        daysTracked: uniqueDates.size,
      },
      conditionsSummary,
      bodyPartDistribution: bodyPartDist,
      medicationResponse,
    };
  };

  // Generate EMR Formatted Text for Doctors & Nurses
  const generateEMRSummaryText = (): string => {
    const briefing = getClinicalBriefing();
    const today = format(new Date(), 'yyyy-MM-dd HH:mm');

    let text = `[Body Signal 임상 진료 요약 - ${today}]\n`;
    text += `■ 환자 증상 추적 현황: 관리 질환 ${briefing.patientSummary.activeConditionsCount}개 / 기록 일수 ${briefing.patientSummary.daysTracked}일\n\n`;

    briefing.conditionsSummary.forEach((item, idx) => {
      text += `[질환 ${idx + 1}] ${item.condition.label} (${item.condition.bodyPart})\n`;
      text += `- 발병일: ${item.condition.onsetDate || '미상'}\n`;
      text += `- 최근 통증: ${item.recentIntensity !== null ? `NRS ${item.recentIntensity}/10` : '기록 없음'}\n`;
      text += `- 7일 평균: ${item.avgIntensity7Days !== null ? `NRS ${item.avgIntensity7Days}` : '-'} | 최고 통증: NRS ${item.peakIntensity ?? '-'}\n`;
      text += `- 변화 추세: ${
        item.trend === 'improving' ? '호전 중 (↓)' : item.trend === 'worsening' ? '악화 (↑)' : '유지 (→)'
      } (${item.delta ? (item.delta > 0 ? `+${item.delta}` : item.delta) : 0})\n`;
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

    text += `* 본 요약은 환자가 바디 시그널(Body Signal) 앱에 직접 기록한 데이터를 바탕으로 임상 참고용으로 자동 집계되었습니다.`;
    return text;
  };

  const exportBackupJson = (): string => {
    const payload: HealthDataPayload = {
      conditions,
      logs,
      diaryEntries,
      lastUpdated: new Date().toISOString(),
    };
    return JSON.stringify(payload, null, 2);
  };

  const importBackupJson = async (jsonStr: string) => {
    const parsed = JSON.parse(jsonStr);
    const data = parsed?.data || parsed;
    if (data && Array.isArray(data.conditions) && Array.isArray(data.logs)) {
      setConditions(data.conditions);
      setLogs(data.logs);
      setDiaryEntries(data.diaryEntries || []);
      await persist(data.conditions, data.logs, data.diaryEntries || []);
    } else {
      throw new Error('올바른 백업 파일 형식이 아닙니다.');
    }
  };

  const resetData = async () => {
    await resetAllData();
    setConditions([]);
    setLogs([]);
    setDiaryEntries([]);
  };

  return (
    <HealthContext.Provider
      value={{
        conditions,
        logs,
        diaryEntries,
        isLoading,
        saveEntry,
        updateCondition,
        archiveCondition,
        updateLog,
        deleteLog,
        saveDiaryEntry,
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

import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { Condition, DiagnosticRecord, DiaryEntry, PainLog, UNASSIGNED_CONDITION_ID } from '../types/health';
import { parseMultiRegionParts } from '../components/BodyMap';

export interface BodyPartStat {
  part: string;
  count: number;
  avgNrs: number;
}

export interface TimeSlotStat {
  id: 'morning' | 'afternoon' | 'evening' | 'night';
  label: string;
  count: number;
  pct: number;
}

export interface ConditionOutcomeSummary {
  id: string;
  label: string;
  bodyPart: string;
  isArchived: boolean;
  count: number;
  firstNrs: number;
  latestNrs: number;
  delta: number; // latest - first (negative = improved)
}

export interface TreatmentMetrics {
  hasEnoughUsage: boolean;
  totalLogs: number;
  totalConditions: number;
  activeConditionsCount: number;
  archivedConditionsCount: number;
  unassignedCount: number;
  improvedConditionsCount: number;
  comparableConditionsCount: number;
  overallPainDelta: number | null; // negative = improved
  overallImprovementPct: number | null;
  avgNrs: number;
  maxNrs: number;
  minNrs: number;
  activeDaysCount: number;
  currentStreakDays: number;
  longestStreakDays: number;
  diaryDaysCount: number;
  diagnosticsCount: number;
  medEvaluatedCount: number;
  avgMedReliefDelta: number | null; // positive = pain reduced after med
  topBodyParts: BodyPartStat[];
  timeOfDayDist: TimeSlotStat[];
  conditionOutcomes: ConditionOutcomeSummary[];
}

export function computeTreatmentMetrics(
  conditions: Condition[],
  logs: PainLog[],
  diaryEntries: DiaryEntry[] = [],
  diagnosticRecords: DiagnosticRecord[] = []
): TreatmentMetrics {
  const activeConditions = conditions.filter((c) => !c.isArchived);
  const archivedConditions = conditions.filter((c) => c.isArchived);
  const unassignedLogs = logs.filter((l) => l.conditionId === UNASSIGNED_CONDITION_ID);

  const sortedAsc = [...logs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Per-condition outcomes
  const conditionOutcomes: ConditionOutcomeSummary[] = conditions
    .map((cond) => {
      const cLogs = sortedAsc.filter((l) => l.conditionId === cond.id);
      if (cLogs.length === 0) return null;
      const firstNrs = cLogs[0].intensity;
      const latestNrs = cLogs[cLogs.length - 1].intensity;
      return {
        id: cond.id,
        label: cond.label,
        bodyPart: cond.bodyPart,
        isArchived: Boolean(cond.isArchived),
        count: cLogs.length,
        firstNrs,
        latestNrs,
        delta: Number((latestNrs - firstNrs).toFixed(1)),
      };
    })
    .filter((item): item is ConditionOutcomeSummary => item !== null)
    .sort((a, b) => b.count - a.count);

  const comparable = conditionOutcomes.filter((c) => c.count >= 2 || c.isArchived);
  const improvedConditionsCount = comparable.filter(
    (c) => c.delta < 0 || (c.isArchived && c.latestNrs <= c.firstNrs)
  ).length;

  // Overall early vs recent delta & percentage
  let overallPainDelta: number | null = null;
  let overallImprovementPct: number | null = null;

  if (sortedAsc.length >= 2) {
    const splitIdx = Math.max(1, Math.floor(sortedAsc.length / 2));
    const early = sortedAsc.slice(0, splitIdx);
    const recent = sortedAsc.slice(splitIdx);
    const earlyAvg = early.reduce((s, l) => s + l.intensity, 0) / early.length;
    const recentAvg = recent.reduce((s, l) => s + l.intensity, 0) / recent.length;
    overallPainDelta = Number((recentAvg - earlyAvg).toFixed(1));
    if (earlyAvg > 0) {
      overallImprovementPct = Math.round(((earlyAvg - recentAvg) / earlyAvg) * 100);
    }
  }

  // Basic NRS aggregates
  const intensities = logs.map((l) => l.intensity);
  const avgNrs = intensities.length
    ? Number((intensities.reduce((a, b) => a + b, 0) / intensities.length).toFixed(1))
    : 0;
  const maxNrs = intensities.length ? Math.max(...intensities) : 0;
  const minNrs = intensities.length ? Math.min(...intensities) : 0;

  // Active tracking days & streaks
  const dateSet = new Set<string>();
  sortedAsc.forEach((l) => {
    const d = l.date ? format(new Date(l.date), 'yyyy-MM-dd') : '';
    if (d) dateSet.add(d);
  });
  diaryEntries.forEach((d) => {
    if (d.text && d.text.trim()) dateSet.add(d.date);
  });

  const uniqueDatesAsc = Array.from(dateSet).sort();
  let longestStreakDays = 0;
  let run = 0;
  for (let i = 0; i < uniqueDatesAsc.length; i++) {
    if (i === 0) {
      run = 1;
    } else {
      const diff = differenceInCalendarDays(
        parseISO(uniqueDatesAsc[i]),
        parseISO(uniqueDatesAsc[i - 1])
      );
      run = diff === 1 ? run + 1 : 1;
    }
    if (run > longestStreakDays) longestStreakDays = run;
  }

  let currentStreakDays = 0;
  if (uniqueDatesAsc.length > 0) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const latestStr = uniqueDatesAsc[uniqueDatesAsc.length - 1];
    const gapFromToday = differenceInCalendarDays(parseISO(todayStr), parseISO(latestStr));
    if (gapFromToday <= 1) {
      currentStreakDays = 1;
      for (let i = uniqueDatesAsc.length - 1; i > 0; i--) {
        const diff = differenceInCalendarDays(
          parseISO(uniqueDatesAsc[i]),
          parseISO(uniqueDatesAsc[i - 1])
        );
        if (diff === 1) currentStreakDays += 1;
        else break;
      }
    }
  }

  // Body part frequency & average NRS
  const partMap = new Map<string, { count: number; totalNrs: number }>();
  logs.forEach((l) => {
    const cond = conditions.find((c) => c.id === l.conditionId);
    const rawPart = l.bodyPartOverride || cond?.bodyPart || '미지정';
    const parts = parseMultiRegionParts(rawPart);
    const targets = parts.length > 0 ? parts : ['미지정'];
    targets.forEach((p) => {
      const cur = partMap.get(p) || { count: 0, totalNrs: 0 };
      cur.count += 1;
      cur.totalNrs += l.intensity;
      partMap.set(p, cur);
    });
  });

  const topBodyParts: BodyPartStat[] = Array.from(partMap.entries())
    .map(([part, v]) => ({
      part,
      count: v.count,
      avgNrs: Number((v.totalNrs / v.count).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Time-of-day distribution
  const slotCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  logs.forEach((l) => {
    const h = new Date(l.date).getHours();
    if (h >= 5 && h < 11) slotCounts.morning += 1;
    else if (h >= 11 && h < 17) slotCounts.afternoon += 1;
    else if (h >= 17 && h < 22) slotCounts.evening += 1;
    else slotCounts.night += 1;
  });
  const totalForSlots = logs.length || 1;
  const timeOfDayDist: TimeSlotStat[] = [
    { id: 'morning', label: '아침 (05~11시)', count: slotCounts.morning, pct: Math.round((slotCounts.morning / totalForSlots) * 100) },
    { id: 'afternoon', label: '낮 (11~17시)', count: slotCounts.afternoon, pct: Math.round((slotCounts.afternoon / totalForSlots) * 100) },
    { id: 'evening', label: '저녁 (17~22시)', count: slotCounts.evening, pct: Math.round((slotCounts.evening / totalForSlots) * 100) },
    { id: 'night', label: '밤 (22~05시)', count: slotCounts.night, pct: Math.round((slotCounts.night / totalForSlots) * 100) },
  ];

  // Medication efficacy stats
  const evaluatedMeds = logs.filter((l) => typeof l.postMedIntensity === 'number');
  const avgMedReliefDelta = evaluatedMeds.length
    ? Number(
        (
          evaluatedMeds.reduce((s, l) => s + (l.intensity - (l.postMedIntensity ?? l.intensity)), 0) /
          evaluatedMeds.length
        ).toFixed(1)
      )
    : null;

  const diaryDaysCount = diaryEntries.filter((d) => d.text && d.text.trim().length > 0).length;

  return {
    hasEnoughUsage: logs.length >= 2 || archivedConditions.length > 0,
    totalLogs: logs.length,
    totalConditions: conditions.length,
    activeConditionsCount: activeConditions.length,
    archivedConditionsCount: archivedConditions.length,
    unassignedCount: unassignedLogs.length,
    improvedConditionsCount,
    comparableConditionsCount: comparable.length,
    overallPainDelta,
    overallImprovementPct,
    avgNrs,
    maxNrs,
    minNrs,
    activeDaysCount: uniqueDatesAsc.length,
    currentStreakDays,
    longestStreakDays,
    diaryDaysCount,
    diagnosticsCount: diagnosticRecords.length,
    medEvaluatedCount: evaluatedMeds.length,
    avgMedReliefDelta,
    topBodyParts,
    timeOfDayDist,
    conditionOutcomes,
  };
}

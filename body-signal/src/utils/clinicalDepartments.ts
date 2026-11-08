import { Condition, PainLog } from '../types/health';
import { parseMultiRegionParts } from '../components/BodyMap';
import { differenceInDays } from 'date-fns';

/**
 * 4 Primary Medical Department Keys
 * Strictly standardized for doctor-facing clinical triage and hospital referrals.
 */
export const DEPARTMENT_KEYS = {
  ORTHOPEDICS: '정형외과 / 재활의학과',
  NEUROLOGY: '신경과 / 신경외과',
  GASTROENTEROLOGY: '소화기내과',
  INTERNAL_MEDICINE: '일반내과 / 기타 진료과',
} as const;

export type DepartmentType = (typeof DEPARTMENT_KEYS)[keyof typeof DEPARTMENT_KEYS];

export type DepartmentId = 'orthopedics' | 'neurology' | 'gastroenterology' | 'internal_medicine';

export interface DepartmentMeta {
  id: DepartmentId;
  name: DepartmentType;
  shortName: string;
  description: string;
  badgeColor: string; // Tailwind class
  accentColor: string; // Tailwind class
  iconName: string;
}

export const DEPARTMENT_METAS: Record<DepartmentType, DepartmentMeta> = {
  [DEPARTMENT_KEYS.ORTHOPEDICS]: {
    id: 'orthopedics',
    name: DEPARTMENT_KEYS.ORTHOPEDICS,
    shortName: '정형·재활',
    description: '척추, 관절, 사지 근골격계 통증',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    accentColor: 'border-blue-500',
    iconName: 'Activity',
  },
  [DEPARTMENT_KEYS.NEUROLOGY]: {
    id: 'neurology',
    name: DEPARTMENT_KEYS.NEUROLOGY,
    shortName: '신경과·신경외과',
    description: '두통, 신경통, 저림 및 방사통',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    accentColor: 'border-purple-500',
    iconName: 'Brain',
  },
  [DEPARTMENT_KEYS.GASTROENTEROLOGY]: {
    id: 'gastroenterology',
    name: DEPARTMENT_KEYS.GASTROENTEROLOGY,
    shortName: '소화기내과',
    description: '복부 통증, 위장관 장애, 소화기 증상',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    accentColor: 'border-amber-500',
    iconName: 'ShieldAlert',
  },
  [DEPARTMENT_KEYS.INTERNAL_MEDICINE]: {
    id: 'internal_medicine',
    name: DEPARTMENT_KEYS.INTERNAL_MEDICINE,
    shortName: '일반내과·기타',
    description: '전신 증상, 미분류 통증 및 기타 만성 질환',
    badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    accentColor: 'border-teal-500',
    iconName: 'Stethoscope',
  },
};

/**
 * Anatomical part classification oracle.
 * Precedence rule: Neurology takes precedence over Orthopedics for nerve/headache terms
 * (e.g. '팔 저림(말초신경통)' maps to Neurology, not Orthopedics).
 */
export function classifyAnatomicalPart(partName?: string | null): DepartmentType {
  if (!partName) return DEPARTMENT_KEYS.INTERNAL_MEDICINE;
  const lower = partName.toLowerCase();

  // 1. Neurology / Neurosurgery (Head, Neuropathy, Radiating pain)
  if (
    lower.includes('머리') ||
    lower.includes('두통') ||
    lower.includes('안면') ||
    lower.includes('신경') ||
    lower.includes('저림') ||
    lower.includes('방사통') ||
    lower.includes('어지럼') ||
    lower.includes('뇌')
  ) {
    return DEPARTMENT_KEYS.NEUROLOGY;
  }

  // 2. Gastroenterology (Abdomen, Stomach, GI tract)
  if (
    lower.includes('복부') ||
    lower.includes('위장') ||
    lower.includes('위경련') ||
    lower.includes('체함') ||
    lower.includes('속쓰림') ||
    lower.includes('복통') ||
    lower.includes('배/') ||
    lower.includes('소화')
  ) {
    return DEPARTMENT_KEYS.GASTROENTEROLOGY;
  }

  // 3. Orthopedics / Physiatry (Spine, Joint, Extremities)
  if (
    lower.includes('허리') ||
    lower.includes('목(앞)') ||
    lower.includes('목(뒤)') ||
    lower.includes('목/경추') ||
    lower.includes('목덜미') ||
    lower.includes('어깨') ||
    lower.includes('무릎') ||
    lower.includes('팔') ||
    lower.includes('손') ||
    lower.includes('발') ||
    lower.includes('골반') ||
    lower.includes('허벅지') ||
    lower.includes('종아리') ||
    lower.includes('척추') ||
    lower.includes('디스크') ||
    lower.includes('관절') ||
    lower.includes('등') ||
    lower.includes('경추') ||
    lower.includes('요추') ||
    lower.includes('둔부') ||
    lower.includes('엉덩이') ||
    lower.includes('견갑골') ||
    lower.includes('발목') ||
    lower.includes('손목') ||
    lower.includes('팔꿈치')
  ) {
    return DEPARTMENT_KEYS.ORTHOPEDICS;
  }

  // 4. Fallback -> Internal Medicine / Other
  return DEPARTMENT_KEYS.INTERNAL_MEDICINE;
}

/**
 * Department Briefing Group Interface
 */
export interface DepartmentBriefingGroup {
  departmentName: DepartmentType;
  departmentId: DepartmentId;
  meta: DepartmentMeta;
  activeConditions: string[]; // labels (matches T1.F12.5 contract)
  conditions: Condition[]; // full condition records
  logs: PainLog[];
  logCount: number;
  avgIntensity: number | null; // e.g. 6.0 (matches T1.F12.5 and T2.F12.4)
  avgIntensity7Days: number | null;
  peakIntensity: number | null;
  medications: string[]; // unique list of meds
  frequentTriggers: string[];
  painQualities: string[];
  redFlags: string[];
  recentMedicationResponse: {
    medication: string;
    preIntensity: number;
    postIntensity: number;
    relief: number;
    sideEffects: string[];
  }[];
}

/**
 * Categorizes active conditions and logs into Medical Department groups.
 * Multi-region conditions (e.g. '머리/두통, 오른쪽 무릎') are partitioned across
 * all matching departments so that each specialist views relevant symptoms.
 */
export function categorizeByDepartment(
  conditions: Condition[],
  logs: PainLog[]
): DepartmentBriefingGroup[] {
  const now = new Date();
  const activeConditions = conditions.filter((c) => !c.isArchived);

  const deptOrder: DepartmentType[] = [
    DEPARTMENT_KEYS.ORTHOPEDICS,
    DEPARTMENT_KEYS.NEUROLOGY,
    DEPARTMENT_KEYS.GASTROENTEROLOGY,
    DEPARTMENT_KEYS.INTERNAL_MEDICINE,
  ];

  // Map active conditions to departments (a multi-region condition may map to multiple departments)
  const conditionDeptsMap = new Map<string, Set<DepartmentType>>();
  activeConditions.forEach((cond) => {
    const parts = parseMultiRegionParts(cond.bodyPart);
    const depts = new Set<DepartmentType>();
    if (parts.length === 0) {
      depts.add(classifyAnatomicalPart(cond.bodyPart));
    } else {
      parts.forEach((p) => depts.add(classifyAnatomicalPart(p)));
    }
    conditionDeptsMap.set(cond.id, depts);
  });

  return deptOrder.map((deptName) => {
    const meta = DEPARTMENT_METAS[deptName];

    // Conditions belonging to this department
    const matchingConditions = activeConditions.filter((c) => {
      const depts = conditionDeptsMap.get(c.id);
      return depts ? depts.has(deptName) : false;
    });

    const matchingConditionIds = new Set(matchingConditions.map((c) => c.id));

    // Logs belonging to this department:
    // Either the log's condition belongs to this department, OR the log has a bodyPartOverride mapping here
    const matchingLogs = logs
      .filter((log) => {
        if (log.bodyPartOverride) {
          const overrideParts = parseMultiRegionParts(log.bodyPartOverride);
          if (overrideParts.length === 0) {
            return classifyAnatomicalPart(log.bodyPartOverride) === deptName;
          }
          const overrideDepts = overrideParts.map(classifyAnatomicalPart);
          return overrideDepts.includes(deptName);
        }
        return matchingConditionIds.has(log.conditionId);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Compute metrics
    const intensities = matchingLogs.map((l) => l.intensity);
    const avgIntensity =
      intensities.length > 0
        ? Number((intensities.reduce((a, b) => a + b, 0) / intensities.length).toFixed(1))
        : null;

    const logs7d = matchingLogs.filter((l) => differenceInDays(now, new Date(l.date)) <= 7);
    const avgIntensity7Days =
      logs7d.length > 0
        ? Number((logs7d.reduce((s, l) => s + l.intensity, 0) / logs7d.length).toFixed(1))
        : null;

    const peakIntensity = intensities.length > 0 ? Math.max(...intensities) : null;

    // Unique medications
    const medSet = new Set<string>();
    matchingLogs.forEach((l) => {
      if (l.medication?.trim()) medSet.add(l.medication.trim());
    });

    // PQRST & Red Flags
    const triggerSet = new Set<string>();
    const qualitySet = new Set<string>();
    const redFlagSet = new Set<string>();

    matchingLogs.forEach((l) => {
      l.triggers?.forEach((t) => triggerSet.add(t));
      l.painQuality?.forEach((q) => qualitySet.add(q));
      l.redFlags?.forEach((rf) => redFlagSet.add(rf));
    });

    // Recent medication responses (max 5)
    const medResponses = matchingLogs
      .filter(
        (l) =>
          l.postMedIntensity !== undefined ||
          (l.postMedSideEffects && l.postMedSideEffects.length > 0)
      )
      .slice(0, 5)
      .map((l) => ({
        medication: l.medication || '처방약',
        preIntensity: l.intensity,
        postIntensity: l.postMedIntensity ?? l.intensity,
        relief: l.postMedIntensity !== undefined ? l.intensity - l.postMedIntensity : 0,
        sideEffects: l.postMedSideEffects || [],
      }));

    return {
      departmentName: deptName,
      departmentId: meta.id,
      meta,
      activeConditions: matchingConditions.map((c) => c.label),
      conditions: matchingConditions,
      logs: matchingLogs,
      logCount: matchingLogs.length,
      avgIntensity,
      avgIntensity7Days,
      peakIntensity,
      medications: Array.from(medSet),
      frequentTriggers: Array.from(triggerSet),
      painQualities: Array.from(qualitySet),
      redFlags: Array.from(redFlagSet),
      recentMedicationResponse: medResponses,
    };
  });
}

/**
 * Text summary generator maintaining exact department headers (T2.F12.5)
 */
export function generateDepartmentSummaryText(groups: DepartmentBriefingGroup[]): string {
  let text = `[진료과별 통증 요약]\n`;
  groups.forEach((g) => {
    text += `■ ${g.departmentName}:\n`;
    if (g.logCount === 0 && g.activeConditions.length === 0) {
      text += `  - 기록된 증상 없음\n`;
    } else {
      const condList = g.conditions.map((c) => `${c.label} (${c.bodyPart})`).join(', ');
      text += `  - 주요 질환: ${condList || '미지정'}\n`;
      text += `  - 통증 지표: 7일 평균 NRS ${g.avgIntensity7Days ?? g.avgIntensity ?? '-'}/10, 최고 NRS ${g.peakIntensity ?? '-'}/10 (총 ${g.logCount}건)\n`;
      if (g.medications.length > 0) {
        text += `  - 복용 약제: ${g.medications.join(', ')}\n`;
      }
      if (g.redFlags.length > 0) {
        text += `  - 🚨 위험 징후: ${g.redFlags.join(', ')}\n`;
      }
    }
  });
  return text;
}

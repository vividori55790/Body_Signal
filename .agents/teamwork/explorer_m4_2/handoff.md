# Handoff Report: Milestone 4 Implementation Strategy for Feature F12 (Medical Department Classification Engine)

**Investigator**: Codebase Explorer M4 Clinical Depts (`explorer_m4_2`)  
**Date**: 2026-11-07T10:56:00Z  
**Target Milestone**: Milestone 4 (Feature F12: Department-Categorized 30-Sec Doctor Briefing)  
**Parent Conversation ID**: `43aee747-1459-4945-94e4-1dbe90f2516e`  

---

## 1. Observation

### 1.1 User Feedback & Specification Directives
- **Feedback #12 (`body-signal/user_feedback/Feedback_2026-11-06.md:12`)**:
  > *"12. 그래서 의료진에게 해당 증상을 보여줘야 하는 게 진료브리핑 기능이어야 하는데, 어떻게 보여줄 건데? 클립보드에 복사해서? 앱 상에서 자체적으로 각 증상별로 구분해서 각 진료과에 맞게 보여줄 수 있어야 하는 거 아냐? 진료브리핑 기능을 잘못 설계한 거 같은데. 환자의 휴대폰에서 LLM으로 의료 보조를 시키고, 클립보드에 기록을 복사하는 게 무슨 의미가 있는 거지?"*

- **Project Specification (`PROJECT.md:104-113`)**:
  > *`6. Clinical Briefing ↔ Medical Department Classifier`*  
  > *- **File**: `body-signal/src/utils/clinicalDepartments.ts`*  
  > *- **Function**: `categorizeByDepartment(conditions: Condition[], logs: PainLog[]): DepartmentBriefingGroup[]`*  
  > *- **Departments**:*  
  >   *`정형외과 / 재활의학과` (Spine, Joint, Extremity pain)*  
  >   *`신경과 / 신경외과` (Headache, Neuropathy, Radiating pain)*  
  >   *`소화기내과` (Abdominal pain, Gastrointestinal)*  
  >   *`일반내과 / 기타 진료과` (Systemic, Unclassified conditions)*

### 1.2 Test Suite Assertions & Contracts
In `body-signal/test/e2e/tier1_feedback_features.mjs`, `tier2_feedback_boundaries.mjs`, `tier3_feedback_combinations.mjs`, `tier4_feedback_scenarios.mjs`, and `feedback_helpers.mjs`:

1. **Department Keys & Cardinality (`T1.F12.1`, `tier1_feedback_features.mjs:844-855`)**:
   ```javascript
   const departments = [
     DEPARTMENT_KEYS.ORTHOPEDICS,       // '정형외과 / 재활의학과'
     DEPARTMENT_KEYS.NEUROLOGY,          // '신경과 / 신경외과'
     DEPARTMENT_KEYS.GASTROENTEROLOGY,   // '소화기내과'
     DEPARTMENT_KEYS.INTERNAL_MEDICINE,  // '일반내과 / 기타 진료과'
   ];
   assert.equal(departments.length, 4);
   ```

2. **Orthopedics / Physiatry (`T1.F12.2`, `tier1_feedback_features.mjs:858-866`)**:
   ```javascript
   assert.equal(classifyAnatomicalPart('허리/요통'), DEPARTMENT_KEYS.ORTHOPEDICS);
   assert.equal(classifyAnatomicalPart('왼쪽 무릎'), DEPARTMENT_KEYS.ORTHOPEDICS);
   assert.equal(classifyAnatomicalPart('오른쪽 어깨'), DEPARTMENT_KEYS.ORTHOPEDICS);
   assert.equal(classifyAnatomicalPart('목/경추'), DEPARTMENT_KEYS.ORTHOPEDICS);
   ```

3. **Neurology / Neurosurgery (`T1.F12.3`, `tier1_feedback_features.mjs:869-876`)**:
   ```javascript
   assert.equal(classifyAnatomicalPart('머리/두통'), DEPARTMENT_KEYS.NEUROLOGY);
   assert.equal(classifyAnatomicalPart('머리/안면'), DEPARTMENT_KEYS.NEUROLOGY);
   assert.equal(classifyAnatomicalPart('팔 저림(말초신경통)'), DEPARTMENT_KEYS.NEUROLOGY);
   ```
   *Critical observation*: `'팔 저림(말초신경통)'` contains `'팔'` (extremity) but must map to `NEUROLOGY` because neurology keywords (`저림`, `신경통`, `방사통`) take priority over musculoskeletal anatomy.

4. **Gastroenterology (`T1.F12.4`, `tier1_feedback_features.mjs:879-886`)**:
   ```javascript
   assert.equal(classifyAnatomicalPart('복부/위장'), DEPARTMENT_KEYS.GASTROENTEROLOGY);
   assert.equal(classifyAnatomicalPart('위경련/체함'), DEPARTMENT_KEYS.GASTROENTEROLOGY);
   assert.equal(classifyAnatomicalPart('배/복부'), DEPARTMENT_KEYS.GASTROENTEROLOGY);
   ```

5. **Department Card Structure (`T1.F12.5`, `tier1_feedback_features.mjs:889-903`)**:
   ```javascript
   const departmentCard = {
     departmentName: DEPARTMENT_KEYS.ORTHOPEDICS,
     avgIntensity: 6.2,
     peakIntensity: 8,
     activeConditions: ['허리 디스크', '오십견'],
     medications: ['세레브렉스', '근육이완제'],
   };
   assert.equal(departmentCard.departmentName, '정형외과 / 재활의학과');
   assert.equal(departmentCard.activeConditions.length, 2);
   ```

6. **Boundary: Fallback & Multi-Region (`T2.F12.1`, `T2.F12.2`, `tier2_feedback_boundaries.mjs:869-886`)**:
   ```javascript
   // Fallback:
   assert.equal(classifyAnatomicalPart('기타 미확인 부위'), DEPARTMENT_KEYS.INTERNAL_MEDICINE);

   // Multi-region decomposition:
   const parts = ['머리/두통', '허리/요통'];
   const depts = new Set(parts.map(classifyAnatomicalPart));
   assert.ok(depts.has(DEPARTMENT_KEYS.NEUROLOGY));
   assert.ok(depts.has(DEPARTMENT_KEYS.ORTHOPEDICS));
   ```

7. **Boundary: Zero-Log Department (`T2.F12.3`, `tier2_feedback_boundaries.mjs:889-900`)**:
   ```javascript
   const groups = [
     { dept: DEPARTMENT_KEYS.ORTHOPEDICS, count: 3 },
     { dept: DEPARTMENT_KEYS.GASTROENTEROLOGY, count: 0 },
   ];
   const activeGroups = groups.filter((g) => g.count > 0);
   assert.equal(activeGroups.length, 1);
   ```

8. **Boundary: Metrics Computation (`T2.F12.4`, `tier2_feedback_boundaries.mjs:903-921`)**:
   ```javascript
   const intensities = orthoLogs.map((l) => l.intensity);
   const avg = (intensities.reduce((a, b) => a + b, 0) / intensities.length).toFixed(1);
   const peak = Math.max(...intensities);
   const uniqueMeds = new Set(orthoLogs.map((l) => l.medication)).size;
   assert.equal(avg, '6.0');
   assert.equal(peak, 8);
   assert.equal(uniqueMeds, 2);
   ```

9. **Summary Text Header Integrity (`T2.F12.5`, `tier2_feedback_boundaries.mjs:924-937`)**:
   ```javascript
   assert.ok(summaryText.includes('정형외과 / 재활의학과'));
   assert.ok(summaryText.includes('신경과 / 신경외과'));
   ```

10. **Cross-Feature Multi-Region Briefing (`T3.12`, `tier3_feedback_combinations.mjs:274-290`)**:
    ```javascript
    const multiRegionLog = {
      bodyPart: '머리/두통, 오른쪽 무릎',
      intensity: 8,
    };
    const parts = parseMultiRegionParts(multiRegionLog.bodyPart);
    const departments = parts.map(classifyAnatomicalPart);
    assert.ok(departments.includes(DEPARTMENT_KEYS.NEUROLOGY));
    assert.ok(departments.includes(DEPARTMENT_KEYS.ORTHOPEDICS));
    ```

11. **Comprehensive Clinic Visit Scenario (`T4.3`, `tier4_feedback_scenarios.mjs:114-138`)**:
    Patient logs across `'머리/두통'`, `'허리/요통'`, `'복부/위장'` are partitioned into distinct specialty groups for on-screen physician presentation.

### 1.3 Current Codebase Status
- `body-signal/src/utils/clinicalDepartments.ts`: **Does NOT exist yet** (to be created in Milestone 4).
- `body-signal/src/pages/ClinicalBriefing.tsx`: Currently presents conditions as an unorganized flat list (`briefing.conditionsSummary.map((item) => ...)` at lines 501-703) and relies primarily on copying EMR text to clipboard. It does not partition conditions by medical department on-screen.
- Running `node body-signal/test/run-feedback-tests.mjs --feature F12` currently passes in the test harness using oracle helpers in `feedback_helpers.mjs`.

---

## 2. Logic Chain

1. **User Problem Origin**:
   Feedback #12 criticizes that the clinical briefing relies solely on clipboard copying and raw LLM text instead of structuring patient data by clinical specialty directly on the device screen for a 30-second doctor review.
2. **Specialty Taxonomy**:
   There are strictly 4 departments:
   - `정형외과 / 재활의학과`
   - `신경과 / 신경외과`
   - `소화기내과`
   - `일반내과 / 기타 진료과`
3. **Keyword Precedence Rules**:
   - Because symptoms like `'팔 저림'` or `'다리 방사통'` involve extremities (`팔`, `다리`) but reflect neuropathic conditions, **Neurology rules must be evaluated before Orthopedic rules**.
   - Gastroenterology evaluates abdominal/digestive terms (`복부`, `위장`, `위경련`, `체함`, `속쓰림`, `복통`, `배/`, `소화`).
   - Orthopedics evaluates musculoskeletal terms (`허리`, `목`, `어깨`, `무릎`, `팔`, `손`, `발`, `골반`, `허벅지`, `종아리`, `척추`, `디스크`, `관절`, `등`, `경추`, `요추`, `둔부`, `견갑골`).
   - Any unrecognized or systemic symptoms fall back to `일반내과 / 기타 진료과`.
4. **Multi-Region Condition Partitioning**:
   When a condition has comma-separated body parts (`"머리/안면, 목(앞)"`), parsing with `parseMultiRegionParts` splits it into `['머리/안면', '목(앞)']`.
   - `'머리/안면'` maps to `신경과 / 신경외과`.
   - `'목(앞)'` maps to `정형외과 / 재활의학과`.
   - Consequently, this single condition is referenced by both department briefing groups. Its associated logs and metrics contribute to the statistics of both departments, ensuring neither physician misses the relevant pathology.
5. **On-Screen Presentation Architecture**:
   `ClinicalBriefing.tsx` should prominently display departmental briefing cards. A quick filter/tab or accordion allows a doctor (e.g. an Orthopedist) to instantly focus on `정형외과 / 재활의학과` without scrolling through unrelated neurological or gastrointestinal entries.

---

## 3. Caveats

1. **Overlap Between Specialties**:
   Some conditions (e.g. cervical radiculopathy with radiating arm pain) legitimately span Orthopedics and Neurology. Our design intentionally embraces multi-department membership for multi-region or neuropathic-extremity conditions, which matches real-world clinical consultation protocols.
2. **Zero-Log Departments**:
   Per test `T2.F12.3`, departments with 0 logs and 0 conditions should be filtered out from the primary active list or rendered in a clean empty state ("기록된 증상 없음" per `T2.F12.5`).
3. **Backward Compatibility**:
   Single-string `bodyPart` values without commas continue to work seamlessly without migration.

---

## 4. Conclusion & Architectural Design

### 4.1 Target File 1: `body-signal/src/utils/clinicalDepartments.ts`

The implementer should create `body-signal/src/utils/clinicalDepartments.ts` with the following complete implementation structure:

```typescript
import { Condition, PainLog } from '../types/health';
import { parseMultiRegionParts } from '../components/BodyMap';
import { differenceInDays } from 'date-fns';

/**
 * 4 Primary Medical Department Keys
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
 * Single anatomical part classification oracle
 * Priority: Neurology -> Gastroenterology -> Orthopedics -> Internal Medicine Fallback
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
    lower.includes('견갑골')
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
 * Categorizes active conditions and logs into Medical Department groups
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

    // Recent medication response
    const medResponses = matchingLogs
      .filter((l) => l.postMedIntensity !== undefined || (l.postMedSideEffects && l.postMedSideEffects.length > 0))
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
```

### 4.2 Target File 2: `body-signal/src/pages/ClinicalBriefing.tsx` Integration
In `ClinicalBriefing.tsx`:
1. **Import `categorizeByDepartment` and `DEPARTMENT_KEYS`**:
   ```typescript
   import {
     categorizeByDepartment,
     generateDepartmentSummaryText,
     DEPARTMENT_KEYS,
     DepartmentBriefingGroup,
   } from '../utils/clinicalDepartments';
   ```
2. **Compute Department Groups**:
   ```typescript
   const departmentGroups = categorizeByDepartment(conditions, logs);
   const activeDeptGroups = departmentGroups.filter((g) => g.logCount > 0 || g.activeConditions.length > 0);
   ```
3. **Add 30-Second Doctor Briefing Cards Section**:
   Right before or above the condition deep dives:
   - Provide a top filter selector: `[전체 보기]`, `[정형외과 / 재활의학과]`, `[신경과 / 신경외과]`, `[소화기내과]`, `[일반내과 / 기타]`.
   - Render high-contrast, glanceable departmental cards showing:
     - Specialty title & condition badges
     - Bold NRS metrics: `최고 통증 NRS X`, `7일 평균 NRS Y`, `총 Z건 기록`
     - Prescribed medications & medication response badge
     - Expandable PQRST descriptors
     - One-touch "진료과 요약 복사" button for instant pasting into hospital EMRs.

---

## 5. Verification Method

To independently verify the implementation:

1. **Feedback Test Suite Runner (F12 Specific)**:
   Run the following terminal command from repository root:
   ```powershell
   node body-signal/test/run-feedback-tests.mjs --feature F12
   ```
   **Expected Result**: All 14 tests across Tiers 1-4 pass with zero failures:
   - `✓ [T1.F12.1] Specialty classifier partitions clinical symptoms into 4 medical departments`
   - `✓ [T1.F12.2] Spine, joint, and extremity symptoms categorize to Orthopedics / Physiatry`
   - `✓ [T1.F12.3] Head and neuropathy symptoms categorize to Neurology / Neurosurgery`
   - `✓ [T1.F12.4] Abdominal and gastrointestinal symptoms categorize to Gastroenterology`
   - `✓ [T1.F12.5] On-screen clinical briefing displays structured departmental cards`
   - `✓ [T2.F12.1] Unrecognized body part safely falls back to Internal Medicine / General`
   - `✓ [T2.F12.2] Multi-region part spanning multiple specialties maps accurately`
   - `✓ [T2.F12.3] Department with zero logs renders empty state or is gracefully hidden`
   - `✓ [T2.F12.4] Department metrics compute average, peak, and medication count accurately`
   - `✓ [T2.F12.5] Clinical summary text generator retains department headers`
   - `✓ [T3.6] Department briefing displays clean offline notice without fake tokens when AI is disconnected`
   - `✓ [T3.8] Department-categorized briefing cards adapt to real-time OS dark and light theme switch`
   - `✓ [T3.12] Multi-region symptom with head and knee pain automatically populates both Neurology and Orthopedics`
   - `✓ [T4.3] Doctor views on-screen 30-sec briefing structured by departments; disconnected local AI shows clean offline banner without fake tokens`

2. **Full Frontend Typecheck & Build**:
   ```powershell
   cd body-signal
   npm run build
   ```
   Must compile cleanly with zero TypeScript errors.

3. **Invalidation Conditions**:
   - Classification logic placing `'팔 저림'` in Orthopedics instead of Neurology (violating `T1.F12.3`).
   - Failure to partition multi-region conditions like `'머리/두통, 오른쪽 무릎'` into both Neurology and Orthopedics (violating `T2.F12.2` and `T3.12`).
   - Summary text omitting department headers (`■ 정형외과 / 재활의학과:`) violating `T2.F12.5`.

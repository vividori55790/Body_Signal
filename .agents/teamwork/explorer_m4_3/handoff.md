# Handoff Report: Milestone 4 Implementation Strategy for Feature F12 UI (Doctor-Facing 30-Second Clinical Briefing Screen)

**Investigator**: Codebase Explorer M4 Briefing UI (`explorer_m4_3`)  
**Date**: 2026-11-07T11:00:00Z  
**Target Milestone**: Milestone 4 (Feature F12: Department-Categorized 30-Sec Doctor Briefing UI)  
**Parent Conversation ID**: `43aee747-1459-4945-94e4-1dbe90f2516e`  

---

## 1. Observation

### 1.1 User Feedback Directives & Flaws Identified
- **Feedback #12 (`body-signal/user_feedback/Feedback_2026-11-06.md:12`)**:
  > *"12. 그래서 의료진에게 해당 증상을 보여줘야 하는 게 진료브리핑 기능이어야 하는데, 어떻게 보여줄 건데? 클립보드에 복사해서? 앱 상에서 자체적으로 각 증상별로 구분해서 각 진료과에 맞게 보여줄 수 있어야 하는 거 아냐? 진료브리핑 기능을 잘못 설계한 거 같은데. 환자의 휴대폰에서 LLM으로 의료 보조를 시키고, 클립보드에 기록을 복사하는 게 무슨 의미가 있는 거지?"*

### 1.2 Current Implementation Deficiencies in `ClinicalBriefing.tsx` (`body-signal/src/pages/ClinicalBriefing.tsx`)
1. **Primary Screen Real Estate Dominated by Clipboard Copy**:
   - Lines 221–260 place a massive gradient banner (`bg-gradient-to-r from-emerald-600 to-teal-700`) titled *"전자의무기록(EMR) 즉시 복사 - Hospital EMR Integration"* with large action buttons for copying text to clipboard (`handleCopyEMR('standard')` and `handleCopyEMR('soap')`).
   - In a clinical consultation room, a doctor has 30 to 60 seconds to review the patient's symptoms. A physician cannot paste mobile clipboard data across secured hospital intranet terminals due to strict hospital network isolation and security compliance.
2. **Interactive Chat Assistant Distraction in Consultation Screen**:
   - Lines 262–471 render a verbose LLM chatbot interface (*"로컬 LLM 임상 보조 AI"* & *"로컬 AI에게 내 증상 물어보기"*), consuming over 200 lines of UI with suggested question chips, chat message streams, and an input bar with a Send button.
   - This turns a doctor-facing clinical triage briefing into a patient conversational toy, which is counterproductive during a rapid clinical encounter.
3. **Flat, Unstructured Symptom Display**:
   - Lines 496–703 render a generic condition list (`briefing.conditionsSummary.map((item) => ...)`).
   - All conditions (spinal, neurological, gastrointestinal) are rendered sequentially without medical department categorization. A visiting orthopedic doctor must manually scroll through unrelated headaches or digestive logs to find relevant knee or spine data.
4. **Scattered Clinical Insights**:
   - Peak NRS, 7-day average, aggravating factors, relieving factors, medication adherence, and side effects are displayed in separate disparate blocks rather than consolidated into a cohesive departmental card.

### 1.3 Specification Contracts (`PROJECT.md:20-22, 104-113`)
- **F12 Requirement**: Restructure Clinical Briefing into a high-visibility, 30-second on-screen presentation grouped by medical specialties:
  1. `정형외과 / 재활의학과` (Orthopedics / Physiatry: Spine, Joint, Extremity pain)
  2. `신경과 / 신경외과` (Neurology / Neurosurgery: Headache, Neuropathy, Radiating pain)
  3. `소화기내과` (Gastroenterology: Abdominal pain, Gastrointestinal)
  4. `일반내과 / 기타 진료과` (Internal Medicine / General: Systemic, Unclassified conditions)
- **F11 Guard Integration (`PROJECT.md:100-102`)**: Suppress fake simulated fallback tokens when offline; render a clean, non-intrusive offline banner without breaking or corrupting the on-screen clinical data.

### 1.4 Test Suite Assertions (`body-signal/test/e2e/`)
- **`T1.F12.5` (`tier1_feedback_features.mjs:889-903`)**:
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
- **`T2.F12.3` (`tier2_feedback_boundaries.mjs:889-901`)**: Departments with zero active conditions/logs are gracefully filtered out or display clean empty states.
- **`T2.F12.4` (`tier2_feedback_boundaries.mjs:903-922`)**: Department metrics compute 7-day average, peak NRS, and medication list accurately.
- **`T3.6` (`tier3_feedback_combinations.mjs:145-174`)**: When local AI is disconnected (`isAiConnected = false`), department briefing displays clean offline notice without fake tokens (`fakeTokensEmitted === 0`, `briefing.status === 'offline'`), while departmental groups remain intact.
- **`T3.8` (`tier3_feedback_combinations.mjs:193-211`)**: Department cards react dynamically to real-time dark/light theme switching (`dark:bg-slate-900 text-white`).
- **`T3.12` (`tier3_feedback_combinations.mjs:274-291`)**: Multi-region condition spanning head and knee pain automatically populates both Neurology and Orthopedics.
- **`T4.3` (`tier4_feedback_scenarios.mjs:114-155`)**: Comprehensive Clinic Visit Doctor Briefing: On-screen 30-sec briefing structured by departments; disconnected local AI shows clean offline banner without fake tokens.

---

## 2. Logic Chain

```
[User Feedback #12 & Doctor Pain Point]
  - Copying clipboard text into hospital EMR is impractical & secure-network hostile.
  - Doctors need to absorb the patient's pain profile in 30 seconds directly from the screen.
                 │
                 ▼
[Architectural Reorganization of ClinicalBriefing.tsx]
  1. Top Clinical Triage Bar:
     - 30-Second Doctor Mode badge (High Contrast, Bold Typography)
     - Red Flag Emergency Alert Banner (immediate danger signals at top)
     - Clean F11 Offline AI Warning Banner (unobtrusive, zero fake tokens)
  2. Department Quick Switcher (Filter Pills):
     - [전체 보기], [정형외과 / 재활의학과], [신경과 / 신경외과], [소화기내과], [일반내과 / 기타]
  3. Structured Departmental Cards Grid (Core F12 Presentation):
     - Department header with badge & active condition tags
     - High-contrast 4-metric grid (Peak NRS, 7-Day Avg, Recent NRS, Log Count)
     - Aggravating Factors (Triggers) vs Relieving Factors
     - Pain Qualities & Radiations
     - Medication Response & Side Effects summary
     - Recent observed timeline (last 2-3 logs)
  4. Topographical Visual Correlation:
     - Embedded BodyMap Heatmap reflecting affected anatomical regions
  5. Secondary Convenience Toolbar / Bottom Drawer:
     - Print report & EMR text copy moved to compact secondary actions
                 │
                 ▼
[Integration with Peer Subsystems]
  - Consumes `categorizeByDepartment` from `src/utils/clinicalDepartments.ts` (designed by explorer_m4_2)
  - Connects to `LocalLlmOfflineError` from `src/utils/localLlm.ts` (designed by explorer_m4_1)
```

1. **Reorienting the Screen Purpose**:
   The primary consumer of this screen is the **physician during a face-to-face consultation**, not the patient typing queries. Therefore, the UI must prioritize **readability, scannability, and high contrast** (e.g., text-2xl numbers, distinct color-coded badges, clear borders).
2. **Multi-Region Condition Distribution**:
   When a condition has multiple anatomical regions (e.g. `"머리/안면, 목(앞)"`), `categorizeByDepartment()` routes the condition to both `신경과 / 신경외과` and `정형외과 / 재활의학과`. The UI must faithfully render the relevant department cards without duplicate ID crashes.
3. **Decoupling AI from Clinical Data**:
   AI analysis should enhance, never obstruct. If local LLM is offline or disabled, a slim status pill (`⚡ 로컬 AI 미연결 (규칙 기반 온디바이스 모드)`) appears at the top. The entire departmental briefing continues to display with 100% fidelity using local IndexedDB data.
4. **Subordinating Copy & Print Actions**:
   Buttons for hospital EMR copying (Standard & SOAP Note) and printing are kept accessible in a compact secondary toolbar (top right or bottom action sheet), fulfilling secondary convenience without overshadowing the visual briefing.

---

## 3. Caveats

1. **Zero-Condition / Empty State**:
   If a patient has 0 recorded conditions, the screen must render a helpful empty state with guidance to record symptoms first.
2. **Hospital Lighting Environments & Glare**:
   In bright clinic rooms or under low-light exam settings, contrast must remain sharp. We utilize `dark:bg-slate-900 bg-white` with solid `border-slate-200 dark:border-slate-800` and high-contrast text (`text-slate-900 dark:text-slate-100`).
3. **Print Media Styles**:
   The print stylesheet (`@media print`) should hide interactive filter pills, the AI offline banner, and action buttons, while expanding all department cards for clean paper printing.

---

## 4. Conclusion & Concrete Implementation Blueprint

### 4.1 Screen Component Structure for `ClinicalBriefing.tsx`

```
┌────────────────────────────────────────────────────────────────────────┐
│ [🩺 30초 진료실 브리핑 (Doctor Briefing)]           [🖨️ 인쇄] [📋 EMR] │
│ Subtitle: 의사 대면 진료를 위한 고대비 임상 요약 리포트                 │
├────────────────────────────────────────────────────────────────────────┤
│ 🚨 [응급 위험 징후 (Red Flags) 감지]                                    │
│  - 마비/감각 저하, 고열 동반 -> 즉시 신경근/감염 감별 진단 권고          │
├────────────────────────────────────────────────────────────────────────┤
│ ⚡ [로컬 AI 상태 배너 (F11)]                                             │
│  - 로컬 AI 미연결: 기기 내 규칙 기반 정밀 데이터 브리핑 모드 동작 중     │
├────────────────────────────────────────────────────────────────────────┤
│ [진료과 필터] [전체 (4)] [🦴 정형·재활 (2)] [🧠 신경과 (1)] [🫁 소화기 (0)] │
├────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 🦴 정형외과 / 재활의학과                                [요약 복사] │ │
│ │ 질환: [허리 디스크] [오십견]                                        │ │
│ │ ┌──────────────┬──────────────┬──────────────┬───────────────────┐ │ │
│ │ │ 최고 통증     │ 7일 평균      │ 최근 통증     │ 기록 건수          │ │ │
│ │ │ NRS 8/10     │ NRS 6.2/10   │ NRS 6 (호전↓) │ 총 14건           │ │ │
│ │ └──────────────┴──────────────┴──────────────┴───────────────────┘ │ │
│ │ • 악화 요인: 오래 앉아있을 때, 기침/재채기                           │ │
│ │ • 완화 요인: 온찜질, 누워서 안정                                    │ │
│ │ • 통증 양상: 쑤시는 통증, 뻐근함  |  방사통: 우측 하지 방사통         │ │
│ │ • 복약 반응: 세레브렉스 200mg (투약률 85%, 평균 2.1점 완화, 부작용 무) │ │
│ │ • 최근 기록 타임라인 (최신 2건 요약)                               │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 🧠 신경과 / 신경외과                                    [요약 복사] │ │
│ │ 질환: [편두통]                                                     │ │
│ │ (동일한 고대비 4-메트릭 그리드 + PQRST + 투약 반응)                   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ 🗺️ [환부 집중 분포 (바디맵 히트맵)]                                     │
├────────────────────────────────────────────────────────────────────────┤
│ 📦 [보조 기능 (Secondary): EMR 차팅 복사 (Standard / SOAP Note)]       │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Proposed Implementation Code for `ClinicalBriefing.tsx`

The implementer should update `body-signal/src/pages/ClinicalBriefing.tsx` as follows:

```tsx
import React, { useState, useMemo } from 'react';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import {
  Stethoscope,
  Copy,
  Check,
  TrendingDown,
  TrendingUp,
  Minus,
  Pill,
  ShieldCheck,
  Printer,
  Calendar,
  Activity,
  AlertTriangle,
  Bot,
  Sparkles,
  FileText,
  Clock,
  RefreshCw,
  Brain,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Share2,
} from 'lucide-react';
import BodyMap from '../components/BodyMap';
import TrustBadge from '../components/TrustBadge';
import { format } from 'date-fns';
import { triggerHaptic } from '../utils/native';
import {
  categorizeByDepartment,
  DEPARTMENT_KEYS,
  DepartmentType,
  DepartmentBriefingGroup,
  generateDepartmentSummaryText,
} from '../utils/clinicalDepartments';
import {
  generateClinicalAiAnalysisStream,
  LocalLlmOfflineError,
} from '../utils/localLlm';

export const ClinicalBriefingPage: React.FC = () => {
  const { conditions, logs, getClinicalBriefing, generateEMRSummaryText } = useHealth();
  const { settings, t } = useSettings();

  // Selected Department Filter ('all' or specific DepartmentType)
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [copiedFormat, setCopiedFormat] = useState<'standard' | 'soap' | string | null>(null);

  // Local AI State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiOfflineNotice, setAiOfflineNotice] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showEmrExportModal, setShowEmrExportModal] = useState(false);

  const briefing = getClinicalBriefing();

  // Categorize conditions and logs into 4 Medical Departments
  const departmentGroups = useMemo(() => {
    return categorizeByDepartment(conditions, logs);
  }, [conditions, logs]);

  // Active groups that have conditions or logs recorded
  const activeDeptGroups = useMemo(() => {
    return departmentGroups.filter((g) => g.logCount > 0 || g.activeConditions.length > 0);
  }, [departmentGroups]);

  // Filtered groups according to user selection
  const displayedGroups = useMemo(() => {
    if (selectedDeptFilter === 'all') {
      return activeDeptGroups;
    }
    return activeDeptGroups.filter((g) => g.departmentName === selectedDeptFilter);
  }, [activeDeptGroups, selectedDeptFilter]);

  const handleCopyText = async (text: string, formatKey: string) => {
    triggerHaptic();
    await navigator.clipboard.writeText(text);
    setCopiedFormat(formatKey);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  const handleCopyDeptSummary = async (group: DepartmentBriefingGroup) => {
    triggerHaptic();
    const text = generateDepartmentSummaryText([group]);
    await navigator.clipboard.writeText(text);
    setCopiedFormat(group.departmentName);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  const handleGenerateAiAnalysis = async () => {
    triggerHaptic();
    setIsGeneratingAi(true);
    setAiOfflineNotice(null);
    setAiAnalysis('');

    const contextText = generateEMRSummaryText('standard');
    try {
      await generateClinicalAiAnalysisStream(
        settings.localLlm,
        contextText,
        (_delta, accumulated) => {
          setAiAnalysis(accumulated);
        },
        'doctor'
      );
      triggerHaptic();
    } catch (err: any) {
      if (err instanceof LocalLlmOfflineError || err.name === 'LocalLlmOfflineError') {
        setAiOfflineNotice('⚡ 로컬 AI 오프라인 상태입니다. 기기 내부 규칙 기반 요약 모드가 표시됩니다.');
      } else {
        setAiOfflineNotice(`로컬 AI 안내: ${err.message || '엔드포인트에 연결할 수 없습니다.'}`);
      }
      setAiAnalysis(null);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handlePrint = () => {
    triggerHaptic();
    window.print();
  };

  if (conditions.length === 0 && logs.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
          <Stethoscope size={32} />
        </div>
        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">{t('briefingTitle')}</h2>
        <p className="text-xs text-slate-500 max-w-xs">{t('noClinicalData')}</p>
        <TrustBadge compact />
      </div>
    );
  }

  // Map body part distribution for BodyMap heatmap
  const bodyPartIntensityMap: Record<string, number> = {};
  Object.entries(briefing.bodyPartDistribution).forEach(([part, stats]) => {
    bodyPartIntensityMap[part] = stats.maxIntensity;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-4">
      {/* 1. Header with Doctor Mode Indicator & Secondary Actions */}
      <header className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Stethoscope size={20} />
            </span>
            <h1 className="text-xl font-black tracking-tight">{t('briefingTitle')}</h1>
            <span className="text-[10px] font-extrabold uppercase bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-sm">
              의사용 30초 모드
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            전문의 대면 진료를 위한 진료과별 고대비 임상 요약 리포트
          </p>
        </div>

        {/* Secondary Toolbar (Print & EMR Export) */}
        <div className="flex items-center gap-1.5 print:hidden">
          <button
            type="button"
            onClick={() => setShowEmrExportModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm active:scale-95 transition-all"
            title="병원 EMR 차팅 텍스트 내보내기"
          >
            <FileText size={15} className="text-teal-600" />
            <span className="hidden sm:inline">EMR 복사</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm active:scale-95 transition-all"
            title="진료 리포트 인쇄"
          >
            <Printer size={16} />
          </button>
        </div>
      </header>

      {/* 2. Red Flags Alert Banner (High-Priority Clinical Warning) */}
      {briefing.redFlagsDetected.length > 0 && (
        <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/60 p-4 shadow-md text-rose-900 dark:text-rose-100 space-y-1.5 animate-in fade-in">
          <div className="flex items-center gap-2 font-black text-sm text-rose-600 dark:text-rose-400">
            <AlertTriangle size={20} className="fill-rose-500 text-white shrink-0" />
            <span>🚨 [주의: 응급 위험 징후(Red Flags) 감지]</span>
          </div>
          <p className="text-xs font-semibold leading-relaxed">
            환자 기록 중 다음 위험 징후가 감지되었습니다:{' '}
            <strong className="underline text-rose-700 dark:text-rose-200">
              {briefing.redFlagsDetected.join(', ')}
            </strong>
          </p>
          <p className="text-[11px] text-rose-700 dark:text-rose-400">
            단순 통증 외 신경근 압박, 척수병증, 급성 감염 여부의 우선 문진 및 감별 진단을 권고합니다.
          </p>
        </div>
      )}

      {/* 3. F11 Clean Offline AI Notice Banner (Non-blocking) */}
      {(!settings.localLlm.enabled || aiOfflineNotice) && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs">
          <div className="flex items-center gap-2 truncate">
            <Bot size={15} className="text-slate-400 shrink-0" />
            <span className="truncate">
              {aiOfflineNotice || '⚡ 로컬 AI 미연결: 기기 내 규칙 기반 정밀 데이터 브리핑 모드 (클라우드 전송 0%)'}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full shrink-0">
            온디바이스
          </span>
        </div>
      )}

      {/* 4. Patient High-level Triage Badges */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400">관리 질환</span>
          <div className="mt-0.5 text-lg font-black text-slate-800 dark:text-slate-100">
            {briefing.patientSummary.activeConditionsCount}개
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400">총 기록 건수</span>
          <div className="mt-0.5 text-lg font-black text-emerald-600 dark:text-emerald-400">
            {briefing.patientSummary.totalLogsRecorded}건
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400">추적 일수</span>
          <div className="mt-0.5 text-lg font-black text-blue-600 dark:text-blue-400">
            {briefing.patientSummary.daysTracked}일
          </div>
        </div>
      </div>

      {/* 5. Medical Department Filter Tabs */}
      <div className="space-y-1.5 print:hidden">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          진료과별 즉시 포커스 (Specialty Filter):
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setSelectedDeptFilter('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDeptFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            전체 보기 ({activeDeptGroups.length})
          </button>
          {activeDeptGroups.map((g) => (
            <button
              key={g.departmentId}
              type="button"
              onClick={() => {
                triggerHaptic();
                setSelectedDeptFilter(g.departmentName);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedDeptFilter === g.departmentName
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              <span>{g.meta.shortName}</span>
              <span className="text-[10px] opacity-75">({g.logCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 6. Structured Medical Department Cards (Core F12 Feature) */}
      <section className="space-y-4">
        {displayedGroups.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            해당 진료과에 기록된 증상이 없습니다.
          </div>
        ) : (
          displayedGroups.map((group) => {
            return (
              <div
                key={group.departmentId}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5 transition-all"
              >
                {/* Department Card Header */}
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${group.meta.badgeColor}`}>
                        {group.departmentName}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {group.meta.description}
                      </span>
                    </div>
                    {/* Active Conditions Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {group.conditions.map((cond) => (
                        <span
                          key={cond.id}
                          className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-lg"
                        >
                          {cond.label} ({cond.bodyPart})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* One-touch Department Summary Copy */}
                  <button
                    type="button"
                    onClick={() => handleCopyDeptSummary(group)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all print:hidden"
                    title="해당 진료과 요약 클립보드 복사"
                  >
                    {copiedFormat === group.departmentName ? <Check size={12} /> : <Copy size={12} />}
                    {copiedFormat === group.departmentName ? '복사됨' : '과별 복사'}
                  </button>
                </div>

                {/* High-Contrast 4-Column Clinical Metrics Grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">최고 통증</span>
                    <span className="mt-0.5 block text-lg font-black text-rose-600 dark:text-rose-400">
                      {group.peakIntensity !== null ? `${group.peakIntensity}` : '-'}
                      <span className="text-[10px] font-normal text-slate-400">/10</span>
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">7일 평균</span>
                    <span className="mt-0.5 block text-lg font-black text-slate-800 dark:text-slate-100">
                      {group.avgIntensity7Days !== null ? `${group.avgIntensity7Days}` : '-'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">전체 평균</span>
                    <span className="mt-0.5 block text-lg font-black text-slate-800 dark:text-slate-100">
                      {group.avgIntensity !== null ? `${group.avgIntensity}` : '-'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">기록 건수</span>
                    <span className="mt-0.5 block text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {group.logCount}건
                    </span>
                  </div>
                </div>

                {/* PQRST & Clinical Descriptors for Department */}
                {(group.frequentTriggers.length > 0 ||
                  group.painQualities.length > 0 ||
                  group.medications.length > 0) && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">
                      임상 특징 (PQRST & 약물 반응)
                    </span>

                    {group.frequentTriggers.length > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-500 shrink-0">악화 요인:</strong>
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          {group.frequentTriggers.join(', ')}
                        </span>
                      </div>
                    )}

                    {group.painQualities.length > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-500 shrink-0">통증 양상:</strong>
                        <span>{group.painQualities.join(', ')}</span>
                      </div>
                    )}

                    {group.medications.length > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-500 shrink-0">복용 약제:</strong>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {group.medications.join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Department Specific Red Flags */}
                    {group.redFlags.length > 0 && (
                      <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 pt-0.5">
                        <strong className="shrink-0 font-bold">🚨 위험 징후:</strong>
                        <span className="font-bold underline">{group.redFlags.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Recent Observed Logs in Department (Top 2 logs) */}
                {group.logs.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      최근 관찰 타임라인
                    </span>
                    {group.logs.slice(0, 2).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[10px] text-slate-400">
                            {format(new Date(log.date), 'MM/dd HH:mm')}
                          </span>
                          {log.medication && (
                            <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-1.5 py-0.5 rounded">
                              {log.medication}
                            </span>
                          )}
                          {log.notes && (
                            <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-[150px]">
                              "{log.notes}"
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 ml-2">
                          NRS {log.intensity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* 7. Topographical Body Map Distribution with Heatmap Badges */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            환부 집중 분포 (바디맵 기반 NRS 히트맵)
          </h2>
          <span className="text-[10px] text-slate-400">다중 선택 환부 통합 표시</span>
        </div>
        <BodyMap readOnly intensityMap={bodyPartIntensityMap} />
      </section>

      {/* 8. Optional On-Demand AI Clinical Summary (Collapsible) */}
      <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2.5 print:hidden">
        <button
          type="button"
          onClick={() => setShowAiPanel((prev) => !prev)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Bot size={15} />
            </span>
            <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
              로컬 AI 종합 임상 소견 (SOAP)
            </span>
          </div>
          {showAiPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAiPanel && (
          <div className="pt-2 space-y-2 border-t border-purple-100 dark:border-purple-900/40 text-xs">
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={handleGenerateAiAnalysis}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> 분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> AI 소견 생성
                  </>
                )}
              </button>
            </div>

            {aiAnalysis && (
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {aiAnalysis}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 9. Secondary Convenience: EMR Export Modal / Sheet */}
      {showEmrExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                병원 EMR 차팅 텍스트 내보내기
              </h3>
              <button
                type="button"
                onClick={() => setShowEmrExportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500">
              병원 진료실 차팅 프로그램에 붙여넣을 양식을 선택하여 클립보드로 복사합니다.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCopyText(generateEMRSummaryText('standard'), 'modal-standard')}
                className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100 active:scale-95 transition-all"
              >
                {copiedFormat === 'modal-standard' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copiedFormat === 'modal-standard' ? '복사완료!' : '일반 EMR 양식'}
              </button>

              <button
                type="button"
                onClick={() => handleCopyText(generateEMRSummaryText('soap'), 'modal-soap')}
                className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100 active:scale-95 transition-all"
              >
                {copiedFormat === 'modal-soap' ? <Check size={14} className="text-emerald-500" /> : <FileText size={14} />}
                {copiedFormat === 'modal-soap' ? 'SOAP 복사완료!' : 'SOAP Note 양식'}
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowEmrExportModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold active:scale-95 transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trust & Privacy Notice */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 text-[11px]">
        <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
        <span>{t('privacyModeNotice')}</span>
      </div>
    </div>
  );
};

export default ClinicalBriefingPage;
```

---

## 5. Verification Method

To independently verify this strategy:

1. **Run Feature F12 E2E Tests**:
   ```powershell
   node body-signal/test/run-feedback-tests.mjs --feature F12
   ```
   **Pass Criteria**:
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

2. **Integration Typecheck & Compilation**:
   ```powershell
   cd body-signal
   npm run build
   ```
   Ensures Vite & TypeScript compilation completes with zero errors.

3. **Invalidation Conditions**:
   - Primary view still defaulting to clipboard copy banner or AI chat prompt inputs.
   - Departments missing key 4 metrics (Peak NRS, 7-Day Average, Recent NRS, Log count).
   - Disconnected AI failing to show clean status banner or generating fake fallback text.

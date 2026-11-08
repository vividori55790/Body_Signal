# Milestone 3 Explorer Handoff: Features F8 & F9

**Role**: Codebase Explorer M3 Dashboard
**Scope**: Milestone 3 — Feature F8 (Standard Symptom Logging Stability) & Feature F9 (Dashboard Entry Streamlining)
**Date**: 2026-11-07
**Target Implementer**: Implementer Agent (M3)

---

## 1. Observation

### 1.1 Inventory of Symptom Recording Entry Points in Current Codebase

Inspection of `body-signal/src/pages/Dashboard.tsx`, `Layout.tsx`, `QuickPainLogger.tsx`, `AcutePainMode.tsx`, and `EntryForm.tsx` reveals **5 distinct symptom-related recording entry points and 1 persistent floating widget**:

1. **Top Emergency 1-Sec Acute Pain Mode Banner** (`Dashboard.tsx:313-337`):
   - Element: Massive high-contrast button `🚨 지금 너무 아파요 (1초 급성 통증 기록)`.
   - Action: Invokes `openAcute()` from `AcutePainContext`.
   - Behavior: Opens full-screen `AcutePainMode.tsx` with giant 56dp+ touch buttons (NRS 1-10), top 6 acute anatomical regions, and medication check for 1-tap/3-sec instant emergency recording.
2. **Medication Follow-up / Drug Response Card** (`Dashboard.tsx:340-472`):
   - Condition: Triggered when `recentMedLog` exists (medication taken within last 24h, `diffHours <= 24`, without prior `postMedIntensity`).
   - Action: 4 one-tap rating buttons (`훨씬 편해요 (-3)`, `덜 아파요 (-1)`, `비슷해요 (0)`, `더 아파요 (+1)`) and quick side-effects chips.
   - Behavior: Updates existing log record via `updateLog(recentMedLog.id, { postMedIntensity, postMedSideEffects, postMedEvaluatedAt })`.
3. **Embedded 3-Second Quick Pain Logger Card** (`Dashboard.tsx:493` -> `QuickPainLogger.tsx:1-254`):
   - Component: `<QuickPainLogger />` embedded in dashboard main body.
   - Action: 3-step inline logging (NRS 1-10 touch grid, 8 body part chips, quick medication chips) with instant `[NRS X • Part] 3초 바로 기록하기` button.
   - Behavior: Saves entry directly via `saveEntry(payload)` to `HealthContext`.
4. **Primary Action Button: "새 증상 기록하기"** (`Dashboard.tsx:548-557`):
   - Element: `<button onClick={() => navigate('/entry')}>{t('createRecordBtn')}</button>` with Plus icon.
   - Action: Navigates to `/entry` (`EntryForm.tsx`) for comprehensive clinical recording.
5. **Duplicate Embedded Inline Quick Form inside Condition Card** (`Dashboard.tsx:14-230`, specifically `155-228`):
   - Element: `<DetailedConditionCard>` with `isExpanded` state toggle.
   - Content when expanded:
     ```tsx
     <form onSubmit={handleSaveLog} className="space-y-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border ...">
       <h4>{condition.label} 빠른 기록</h4>
       <input type="datetime-local" value={date} onChange={...} />
       <input type="range" min="1" max="10" value={intensity} onChange={...} />
       <input type="text" placeholder="복용 약물 ..." value={medication} onChange={...} />
       <textarea placeholder="간단한 증상 메모..." value={notes} onChange={...} />
       <button type="submit"><Save size={14} /> 기록 저장</button>
     </form>
     ```
   - **Root Cause of Redundancy & Clutter**: Expanding ANY condition card expands a full duplicate form with range slider, date-time input, medication input, and textarea. This directly duplicates both `QuickPainLogger` and `EntryForm`, taking up excessive vertical screen space, breaking visual hierarchy, and creating confusion about which form to use.
6. **Persistent Floating Quick SOS Widget** (`Layout.tsx:28-43`):
   - Element: `<aside className="fixed bottom-20 right-4 z-40">` with `🚨 1초 긴급 기록` button.
   - Condition: Guarded by `settings.quickSosEnabled !== false`.
   - Behavior: Opens `AcutePainMode` modal from any app route (`/`, `/calendar`, `/history`, `/briefing`, `/settings`).

### 1.2 Feedback & Authoritative Specifications
- **User Feedback #9** (`Feedback_2026-11-06.md:9`):
  > "전체적으로 대시보드가 번잡하고 기록을 추가할 방법이 너무 많게 설계되어서 중복되어 있어. 하지만 이 부분은 꽤나 유지할 만한 가치가 있어 보여."
- **User Feedback #8** (`Feedback_2026-11-06.md:8`):
  > "또 일반적인 증상 기록에서는 잘 되네."
- **Project Architecture Specification** (`PROJECT.md:19`):
  > "Streamlines Dashboard into 3 distinct operational tiers (1-Sec SOS, 3-Sec Chronic Log, Full PQRST Entry)."
- **Feature Contract F9** (`PROJECT.md:42`):
  > "Rationalize dashboard into 3 distinct non-competing tiers, eliminating redundant duplicate forms"
- **Feedback E2E Test Contract** (`body-signal/test/e2e/tier1_feedback_features.mjs:626-653`):
  - `T1.F9.1`: Validates 3 operational tiers: Tier 1 (1-Sec SOS, `openAcute()`), Tier 2 (3-Sec Chronic, `QuickPainLogger`), Tier 3 (Full PQRST, `navigate(/entry)`).
  - `T1.F9.2`: `hasRedundantInlineForm: false` — Condition cards must NOT have duplicate inline form inputs; they must focus on sparkline charts and history.
  - `T2.F9.4`: Tapping condition card expands sparkline chart without opening redundant log inputs.
  - `T3.9`: `assert.equal(dashboardTiers.duplicateInlineForms, false)`.

### 1.3 Standard General Symptom Logging (`EntryForm.tsx`) Stability
- **Clinical Field Coverage**:
  - Condition context: Mode toggle (`existing` vs `new`), `selectedConditionId` (with `location.state?.selectedConditionId` pre-selection support), `label`, `bodyPart`, `onsetDate`.
  - Pain Intensity: Large touch grid 1-10 with color coding (Green 1-3, Amber 4-6, Rose 7-10).
  - PQRST Metrics: 7 pain qualities (`PAIN_QUALITIES`), 4 radiating patterns (`RADIATIONS`), 6 provoking triggers (`TRIGGERS`), 5 palliative factors (`RELIEF_FACTORS`).
  - Medical Safety Net: 4 critical Red Flag warnings (`RED_FLAGS`) with alert banner.
  - Medication: Free-text input + preset chip insertion (`settings.medicationPresets`).
  - Cryptographic Signing: Calls `saveEntry(payload)` which derives SHA-256 canonical signature chain (`prevSignature` -> `signature`) and persists with PBKDF2/AES-GCM 256.

---

## 2. Logic Chain

```
[Observation 1.1] Dashboard contains 5 entry points, including an awkward inline form inside every DetailedConditionCard.
      │
      ├─► [User Feedback #9 & PROJECT.md § Architecture line 19] Dashboard is cluttered by duplicate forms,
      │   but multiple entry paths are valuable when structured into 3 distinct tiers.
      │
      ├─► [Tests T1.F9.1, T1.F9.2, T2.F9.4, T3.9] Explicitly demand:
      │   - Tier 1: 1-Sec SOS (AcutePainMode modal)
      │   - Tier 2: 3-Sec Chronic Quick Log (QuickPainLogger)
      │   - Tier 3: Full PQRST Entry (EntryForm)
      │   - conditionCardFeatures: { hasTrendSparkline: true, hasHistoryViewer: true, hasRedundantInlineForm: false }
      │
      ▼
[Conclusion 1: Elimination of Inline Form in DetailedConditionCard]
Removing `<form onSubmit={handleSaveLog}>` and replacing it with an expanded sparkline chart,
recent logs feed (last 3 entries), and a direct contextual link ("상세 기록 추가 (Full PQRST)" -> `/entry` with `selectedConditionId` pre-selected)
eliminates 100% of the clutter while preserving seamless condition-specific logging.
      │
      ├─► [Observation 1.3 & Feedback #8] General symptom logging in EntryForm.tsx works well and is highly trusted.
      │
      ▼
[Conclusion 2: Preservation of F8 Operational Stability]
EntryForm.tsx remains the robust Tier 3 clinical documentation engine with full validation,
PQRST metrics, multi-region BodyMap selection (F10), in-flow medication additions (F6),
and chained SHA-256 cryptographic signatures.
```

---

## 3. Design of 3 Distinct Operational Tiers (F9)

| Tier | Name | Target Persona & Context | Entry Point(s) | UI / Interaction Model | Time to Complete |
|:---:|:---|:---|:---|:---|:---:|
| **Tier 1** | **1-Sec SOS / Acute Mode** | Sudden unbearable pain flare-up, emergency distress (NRS 7-10). Patient has zero motor/cognitive bandwidth. | • Top Emergency Banner (`Dashboard.tsx:313`)<br>• Persistent Floating SOS Button (`Layout.tsx:28`)<br>• Android Shortcut (`/?mode=acute`) | Full-screen modal (`AcutePainMode.tsx`). Massive 56dp+ buttons (1-10), 6 primary body parts with emojis, 1-tap medication check, 1-tap auto-save. | **1 ~ 3 seconds** |
| **Tier 2** | **3-Sec Chronic Quick Log** | Daily check-in, recurrent baseline chronic pain tracking (lower back, neck, headache). Patient is on home screen. | • Clean Embedded `<QuickPainLogger />` card on `Dashboard.tsx:493` | Embedded 3-step card: 1-10 NRS buttons, 8 body part chips (auto-matched to primary condition), quick med chips. Direct save button. | **3 seconds** (in-place) |
| **Tier 3** | **Full Detailed PQRST Entry** | Comprehensive medical documentation, clinical visit preparation, initial onset, multi-region complex symptoms. | • "새 증상 기록하기" button (`Dashboard.tsx:548`)<br>• "상세 기록 추가" from expanded Condition Card<br>• Android Shortcut (`/entry`) | Dedicated route `/entry` (`EntryForm.tsx`). Mode toggle (`existing`/`new`), BodyMap multi-selection, full PQRST metrics, Red Flags, custom medication. | **30 ~ 60 seconds** |

### Visual Hierarchy on Dashboard (Top to Bottom)
1. **Tier 1 Emergency Banner**: `🚨 지금 너무 아파요 (1초 급성 통증 기록)` (Rose gradient, high contrast, top-most).
2. **Medication Follow-up Banner**: Conditional drug response re-evaluation within 24h (1-tap -3/-1/0/+1 delta).
3. **Dashboard Header & Badges**: 7-day average NRS, Trust & Security badge (`TrustBadge`).
4. **Tier 2 Routine Logger**: `<QuickPainLogger />` (3-second rapid logger embedded).
5. **Clinical Briefing Banner**: Stethoscope banner linking to `/briefing` for medical consultations.
6. **Summary Stats & Overall Heatmap**: Active condition count, total logs count, 90-day Calendar Heatmap.
7. **Tier 3 Action Button**: Clean emerald button `+ 새 증상 기록하기` (`t('createRecordBtn')`).
8. **Condition Filter Pills**: `All` / `Critical (>=7)` / `Improved`.
9. **Streamlined Condition Cards**: Sparkline trend chart, latest NRS, average NRS. When expanded: reveals detailed trend chart, recent 3 logs snippet, "완치/보관" toggle, and "상세 기록 추가 (Full PQRST)" link navigating to `/entry` with `selectedConditionId`.

---

## 4. Proposed Code Modifications

### 4.1 `body-signal/src/pages/Dashboard.tsx` (Refactoring `DetailedConditionCard`)

#### Before:
```tsx
const DetailedConditionCard: React.FC<{
  condition: Condition;
  logs: PainLog[];
  isArchived?: boolean;
}> = ({ condition, logs, isArchived = false }) => {
  const navigate = useNavigate();
  const { updateCondition, saveEntry } = useHealth();
  const { t } = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);

  // Redundant form state:
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [intensity, setIntensity] = useState(5);
  const [medication, setMedication] = useState('');
  const [notes, setNotes] = useState('');
  ...
  // Cluttered inline form rendered when isExpanded is true
```

#### After (Streamlined, Non-Competing):
```tsx
const DetailedConditionCard: React.FC<{
  condition: Condition;
  logs: PainLog[];
  isArchived?: boolean;
}> = ({ condition, logs, isArchived = false }) => {
  const navigate = useNavigate();
  const { updateCondition } = useHealth();
  const { t } = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);

  const conditionLogs = logs
    .filter((l) => l.conditionId === condition.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const lastLog = conditionLogs[conditionLogs.length - 1];
  const recentThreeLogs = [...conditionLogs].reverse().slice(0, 3);

  const avgIntensity = conditionLogs.length
    ? (conditionLogs.reduce((a, b) => a + b.intensity, 0) / conditionLogs.length).toFixed(1)
    : '0';

  const chartData = conditionLogs
    .map((l) => ({
      date: l.date,
      value: l.intensity,
    }))
    .slice(-10);

  const handleToggleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    await updateCondition(condition.id, { isArchived: !isArchived });
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all overflow-hidden ${
        isExpanded ? 'ring-2 ring-emerald-500/30 shadow-md' : 'hover:shadow-md'
      }`}
    >
      {/* Card Header */}
      <div
        className="p-4 flex justify-between items-center cursor-pointer select-none"
        onClick={() => {
          triggerHaptic();
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{condition.label}</h3>
            {isArchived && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                완치/보관
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 uppercase font-medium">{condition.bodyPart}</p>
        </div>

        <div className="flex items-center gap-3 text-right">
          {lastLog && (
            <div>
              <div
                className={`text-2xl font-black ${
                  lastLog.intensity >= 8
                    ? 'text-rose-500'
                    : lastLog.intensity >= 5
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                }`}
              >
                {lastLog.intensity}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">최근 NRS</div>
            </div>
          )}
          <div className="text-slate-400">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {/* Mini Trend Sparkline (Always rendered if >1 record) */}
      {chartData.length > 1 && (
        <div className={`px-4 opacity-80 ${isExpanded ? 'h-16 py-1' : 'h-10'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <YAxis domain={[0, 10]} hide />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} dot={isExpanded} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Card Footer Summary (Collapsed) */}
      {!isExpanded && (
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <div>
            평균 통증: <span className="font-bold text-slate-700 dark:text-slate-200">{avgIntensity}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/condition/${condition.id}`);
            }}
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
          >
            상세 분석 <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Expanded History & Action Viewer (No duplicate form!) */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 space-y-3.5 animate-in fade-in">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
              누적 기록 {conditionLogs.length}건 (평균 NRS {avgIntensity})
            </span>
            <button
              type="button"
              onClick={handleToggleArchive}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95 transition-all"
            >
              <CheckCircle size={14} />
              {isArchived ? t('restoreCondition') : t('archiveCondition')}
            </button>
          </div>

          {/* Recent Logs Snippet */}
          {recentThreeLogs.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">최근 기록 내역</span>
              <div className="space-y-1">
                {recentThreeLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                          log.intensity >= 8
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
                            : log.intensity >= 5
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        NRS {log.intensity}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {new Date(log.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {log.medication && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 font-bold truncate max-w-[100px]">
                          💊 {log.medication}
                        </span>
                      )}
                    </div>
                    {log.notes && (
                      <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{log.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Row: Link to Tier 3 Entry or Condition Detail */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                navigate('/entry', { state: { selectedConditionId: condition.id } });
              }}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Plus size={14} /> 이 질환 상세 기록
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                navigate(`/condition/${condition.id}`);
              }}
              className="py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              전체 차트·분석 <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 4.2 `body-signal/src/pages/EntryForm.tsx` (F8 Stability Enforcement)
- Ensure complete stability of standard symptom logging:
  1. **Validation Safety**: Retain strict checks on `mode === 'new'` (requires label and bodyPart) and `mode === 'existing'` (requires `selectedConditionId`).
  2. **Location State Support**: Already supports `location.state?.selectedConditionId`. When entering from condition card `이 질환 상세 기록`, `selectedConditionId` is initialized cleanly.
  3. **Multi-Region Selection (F10)**: Update `BodyMap` prop passing to support `selectedParts` array alongside legacy `selectedPart`.
  4. **In-Flow Medication (F6)**: Integrate custom medication addition cleanly without disrupting active draft states (verified by `T3.10`).
  5. **Cryptographic Signing Chain**: Maintain unchanged invocation of `saveEntry(payload)`.

---

## 5. Test Verification Strategy & Regressions

### 5.1 Verification Checklist across All Tiers

| Test Level | Target Command / Script | Success Criteria |
|---|---|---|
| **Tier 1 (Happy Path)** | `node body-signal/test/run-feedback-tests.mjs` | `T1.F8.1` - `T1.F8.5` PASS<br>`T1.F9.1` - `T1.F9.5` PASS (`hasRedundantInlineForm: false`) |
| **Tier 2 (Boundaries)** | `node body-signal/test/run-feedback-tests.mjs` | `T2.F8.1` - `T2.F8.5` PASS (validation, NRS 0/10, emojis, date clamping)<br>`T2.F9.1` - `T2.F9.5` PASS (`T2.F9.4` expands sparkline without opening inputs) |
| **Tier 3 (Combinations)** | `node body-signal/test/run-feedback-tests.mjs` | `T3.5` (F8+F10 signature chain) PASS<br>`T3.9` (F5+F9 duplicate form elimination) PASS<br>`T3.10` (F6+F8 active form fields) PASS<br>`T3.11` (F7+F9 font scale touch targets) PASS |
| **Tier 4 (Scenarios)** | `node body-signal/test/run-feedback-tests.mjs` | `T4.1` (Acute log & AES-GCM 256) PASS<br>`T4.2` (Multi-region & in-flow med) PASS<br>`T4.5` (Silent mode zero vibration) PASS<br>`T4.6` (Full daily journey: 3-sec quick log -> re-evaluation -> evening full review) PASS |
| **Baseline Regression** | `node body-signal/scripts/run-e2e-tests.mjs` | All 170 baseline tests (R1.1 - R5.3) PASS cleanly |
| **Unified 331 Test Pass** | `node body-signal/test/run-all-tests.mjs` | 331 / 331 tests PASS (170 baseline + 161 feedback) |
| **Build & Type Check** | `cd body-signal; npm run build` | Vite build succeeds with 0 TypeScript/ESLint errors |

### 5.2 Critical Invalidation Conditions
- If `Dashboard.tsx` removes the string `/🚨 지금 너무 아파요 \(1초 급성 통증 기록\)/` or `/openAcute\(\)/`, `T1.2.1` will fail.
- If `Dashboard.tsx` removes `<QuickPainLogger`, `T1.2.2` will fail.
- If `DetailedConditionCard` retains an inline `<form` or input controls, `T1.F9.2` and `T3.9` will fail.
- If `EntryForm.tsx` fails to validate empty `label` or `bodyPart`, `T2.F8.1` will fail.
- If SHA-256 signature chain derivation in `HealthContext.saveEntry` is altered, `T1.F8.3` and `T3.5` will fail.

---

## 6. Caveats
- **Active Condition Auto-Creation**: `QuickPainLogger` and `AcutePainMode` both auto-create conditions if no matching condition exists for the selected body part. This behavior is verified by baseline tests (`T1.1.4`) and must be preserved.
- **Medication Follow-up Card Exclusivity**: The medication follow-up card on Dashboard only appears when a log with medication is found within 24 hours without a post-med rating. It is not an alternative new-symptom entry point, but a re-evaluation widget. It should remain immediately below Tier 1 SOS.
- **Strict Read-Only Mode**: No source code was modified during this investigation. All proposed changes and diffs are detailed for the implementer agent.

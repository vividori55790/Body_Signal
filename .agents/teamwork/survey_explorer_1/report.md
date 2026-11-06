# Bignal (Body Signal) Architecture & Requirement R1 Survey Report

## Executive Summary
본 보고서는 모바일 통증 및 증상 추적 앱 **Bignal (Body Signal)**의 코드베이스 아키텍처, 기존 UI 컴포넌트, 상태 관리 및 데이터 스키마를 전수 조사하고, **Requirement R1 ("아플 때 1초 만에 직관적으로 기록하는 극강의 사용성 & 대형 터치 UI 및 약물 복용 후 효과 판정 1탭 재평가 추적")**을 프로덕션 레벨로 고도화하기 위한 정밀 기술 분석 및 구현 방안을 제시합니다.

---

## 1. Core Codebase Architecture

### 1.1 프로젝트 디렉터리 구조 및 듀얼 레이어 구조
- **루트 디렉터리 (`c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal`)**:
  - 프로젝트 관리 산출물, `build_apk.ps1`, `Bignal-v0.1.0-debug.apk`, `.agents/teamwork/` 관리 폴더 위치.
- **실제 소스코드 코어 디렉터리 (`body-signal/`)**:
  - React 19 + Vite 7 + TypeScript 7 + Tailwind CSS 3 기반 SPA 웹앱이자 Capacitor 8 네이티브 안드로이드 프로젝트 래퍼.
  - `body-signal/package.json`:
    - Core: `react@^19.2.0`, `react-dom@^19.2.0`, `react-router-dom@^7.12.0`
    - Native/Capacitor: `@capacitor/android@^8.0.0`, `@capacitor/cli@^8.0.0`, `@capacitor/core@^8.0.0`, `@capacitor/haptics@^8.0.2`, `@capacitor/local-notifications@^8.3.1`
    - Data & Validation: `idb@^8.0.4`, `zod@^4.6.7`, `date-fns@^4.1.0`
    - UI & Charts: `lucide-react@^0.562.0`, `recharts@^3.6.0`, `tailwindcss@^3.4.17`
  - `body-signal/android/`: Capacitor 공식 안드로이드 네이티브 프로젝트 (`com.bodysignal.app`), Gradle 래퍼 (`gradlew.bat`), `build.gradle`.

### 1.2 라우팅 및 뷰 아키텍처 (`src/App.tsx`, `src/components/Layout.tsx`)
- `BrowserRouter` 기반 단일 진입점 구성:
  - `/` -> `DashboardPage` (메인 대시보드 및 상단 긴급 기록 배너, 약효 확인 카드, 3초 퀵 통증 기록기)
  - `/acute` -> `DashboardPage` (`AcutePainContext`에 의해 진입 즉시 `AcutePainMode` 풀스크린 모달 활성화)
  - `/calendar` -> `CalendarPage` (월간 히트맵 및 일별 건강 저널/다이어리)
  - `/history` -> `HistoryPage` (타임라인별 통증 기록 및 수정/삭제)
  - `/briefing` -> `ClinicalBriefingPage` (의사·간호사용 30초 EMR 복사, SOAP 노트, 로컬 AI 소견 스트리밍)
  - `/entry` -> `EntryFormPage` (28부위 바디맵 및 PQRST 임상 지표 입력)
  - `/condition/:id` -> `ConditionDetailPage` (단일 질환별 시계열 차트 및 정보 편집)
  - `/settings` -> `SettingsPage` (보안 PIN, 테마, 햅틱, 약물 프리셋, 로컬 LLM 설정)
- `Layout.tsx`:
  - 상단 메인 컨텐츠 영역 (`<Outlet />`).
  - 우측 하단 고정 상시 접근 플로팅 위젯 (`fixed bottom-20 right-4`, `🚨 1초 긴급 기록`).
  - 모바일 Safe-area 대응 하단 네비게이션 바 (대시보드, 캘린더, 기록내역, 진료브리핑, 설정).

### 1.3 글로벌 상태 관리 및 데이터 영속화
- **Context API 기반 상태 저장소**:
  1. `SettingsContext.tsx`: 다국어(`ko`/`en`), 다크/라이트 테마, 햅틱 피드백 토글, 일일 알림 시간, 약물 프리셋 리스트(`medicationPresets`), 로컬 LLM 설정 관리.
  2. `AuthContext.tsx`: 온디바이스 AES-GCM 암호화 연동 세션 PIN 관리, 앱 잠금 상태(`isUnlocked`), 백그라운드 전환 감지 프라이버시 마스킹(`isPrivacyMasked`), 60초 자동 잠금 타임아웃.
  3. `HealthContext.tsx`: 질환 목록(`conditions`), 통증 기록(`logs`), 일기(`diaryEntries`) 관리. IndexedDB 영속화 및 암호화 연동. EMR/SOAP 요약 생성기(`getClinicalBriefing`, `generateEMRSummaryText`).
  4. `AcutePainContext.tsx`: 전역 급성 통증 모달 제어(`isOpen`, `openAcute`, `closeAcute`). 쿼리 스트링 `?mode=acute` 및 경로 `/acute` 자동 감지.
- **영속화 엔진 (`src/utils/storage.ts` & `src/utils/crypto.ts`)**:
  - IndexedDB (`bignal_mobile_db`, store: `app_state`).
  - PIN 활성화 시 Web Crypto API 기반 PBKDF2(100,000회 반복) + AES-GCM 256비트 암호화 패키지로 저장.
  - 평문 또는 복호화된 페이로드는 `HealthDataPayloadSchema` (Zod)로 런타임 유효성 검증.

---

## 2. Existing UI Components & Pain/Medication Systems

### 2.1 통증 기록 컴포넌트 현황
1. **`src/components/AcutePainMode.tsx` (급성 통증 전용 모달)**:
   - 환자가 극심한 통증으로 세부 입력이 불가능할 때 사용하는 집중 기록 UI.
   - **대형 터치 NRS 번호 (1~10)**: 5열 2행 (`h-14` 대형 터치 타일), 8~10점 선택 시 강렬한 Rose 링 및 햅틱 피드백.
   - **주요 급성 통증 부위 6종**: 머리/두통(🧠), 목/경추(🧣), 어깨/등(💪), 허리/요통(🧍), 무릎/관절(🦵), 배/복통(🫄).
   - **원터치 약물 여부**: 안 먹음 / 먹었음 토글 및 4종 핵심 약물 칩.
   - **하단 대형 플로팅 저장 버튼**: `[NRS X점 • Y] 즉시 저장하기`.
   - 저장 시 녹색 확인 화면 1.6초 표시 후 자동 닫힘.
2. **`src/components/QuickPainLogger.tsx` (홈 화면 임베디드 3초 퀵 로거)**:
   - `DashboardPage` 상단에 직접 임베드되어 모달을 열지 않고도 3번의 터치로 저장.
   - 10개 NRS 가로 버튼 + 8개 환부 칩 + 4개 약물 칩 + 즉시 저장 버튼.
3. **`src/pages/EntryForm.tsx` (정밀 임상 기록 폼)**:
   - 앞면/뒷면 전환 가능한 28부위 SVG 인터랙티브 `BodyMap.tsx` 내장.
   - PQRST 임상 척도 (통증 양상 7종, 방사통 4종, 유발인자 6종, 완화인자 5종).
   - 응급 위험 징후(Red Flags 4종) 감지 및 EMR 경고 연동.

### 2.2 약물 기록 및 추적 시스템 현황
1. **스키마 정의 (`src/types/health.ts`)**:
   - `PainLogSchema`:
     - `medication: z.string().max(500).optional().default('')`
     - `postMedIntensity: z.number().int().min(0).max(10).optional()` (복약 후 재평가 점수)
   - `UserSettingsSchema`:
     - `medicationPresets`: 사용자 지정 상용 복용약 목록. 기본값: 타이레놀 500mg, 이부프로펜 400mg, 소염진통제, 근이완제, 위장보호제.
2. **복약 후 효과 판정 (Medication Response) UI (`DashboardPage.tsx`)**:
   - 최근 24시간 내에 `medication`이 기록되었으나 `postMedIntensity`가 없는 가장 최근 기록(`recentMedLog`) 자동 감지.
   - 홈 화면 상단에 전용 카드 노출: `"방금 드신 약의 효과가 나타났나요?"`
   - 1탭 재평가 선택지 4종:
     - `훨씬 편해요 (-3점)`
     - `덜 아파요 (-1점)`
     - `비슷해요 (변화없음)`
     - `더 아파요 (악화)`
   - 탭 즉시 `updateLog(recentMedLog.id, { postMedIntensity: opt.val })` 실행 및 햅틱 + 저장 완료 안내 배너 노출.
3. **의료진 브리핑 연동 (`ClinicalBriefingPage.tsx` & `HealthContext.tsx`)**:
   - `getClinicalBriefing()`에서 약제별 복용 횟수, 복용 시 평균 통증 집계, 투약 순응도(Adherence rate %) 자동 계산.
   - EMR/SOAP 노트에 자동 반영.

---

## 3. In-depth Analysis for Requirement R1

### 3.1 Requirement R1-1: 아플 때 1초 만에 직관적으로 기록하는 극강의 사용성 & 대형 터치 UI

#### 현상 분석 및 평가
- 현재 코드베이스에는 이미 `AcutePainMode.tsx`와 `QuickPainLogger.tsx`가 구현되어 있어 1차 프로토타입 수준의 구조가 갖추어져 있습니다.
- 그러나 실제 환자가 극심한 통증(NRS 7~10)으로 시야가 흐려지거나 손이 떨리는 환경에서 **진정한 "1초 만에 탭하고 3초 안에 끝나는"** 사용자 경험을 달성하기 위해서는 다음 사항의 강화가 필요합니다:
  1. **터치 타깃 크기 및 인체공학적 배치**:
     - 현재 `AcutePainMode.tsx`의 NRS 버튼은 `grid-cols-5`로 2행에 걸쳐 배치되어 있습니다 (`h-14`, 약 56px). 모바일 화면에서 한 손 조작 시 엄지손가락이 닿기 쉬운 최적 영역(Thumb Zone)에 배치되어야 합니다.
  2. **1-탭 즉시 저장(Instant 3-Second Quick Save) 옵션**:
     - 현재는 [NRS 선택] -> [부위 선택] -> [하단 저장 버튼 탭]의 3단계 구조입니다.
     - 환자가 이미 기존에 등록된 대표 질환(예: 만성 요통)이 있거나, 기본 선택 부위가 지정되어 있는 경우, **NRS 숫자를 탭하는 즉시 3초 카운트다운과 함께 자동 저장되거나 1탭 즉시 저장**되는 원터치 숏컷 옵션이 유효합니다.
  3. **홈 화면 최상단 연동 강화**:
     - `DashboardPage.tsx` 최상단에 빨간색 긴급 배너(`🚨 지금 너무 아파요`)가 위치하고 있으며, 그 아래 `QuickPainLogger.tsx`가 배치되어 있습니다.
     - 긴급 배너 탭 시 `openAcute()`를 호출하여 풀스크린 `AcutePainMode`로 즉각 전환되며, 홈 화면 상단 `QuickPainLogger`에서도 1~10 대형 터치 버튼으로 화면 이동 없이 즉시 저장이 가능합니다.

#### R1-1 권장 아키텍처 및 구현 세부사항
1. **`AcutePainMode.tsx` 고도화**:
   - **신체 부위 단일 탭 자동 선택**: 사용자가 가장 자주 아픈 부위(또는 최근 1순위 질환의 부위)를 최상단 1순위로 디폴트 활성화.
   - **원핸드 대형 터치 타일**: 버튼 높이 56px~64px 유지, 탭 시 시각적 링 애니메이션 및 Heavy Haptic 피드백(`ImpactStyle.Heavy`) 전달.
   - **자동 질환 매핑 로직**: `selectedPart`와 일치하는 기존 `Condition`이 있을 경우 자동으로 해당 `conditionId`로 연결하여 불필요한 질환 중복 생성을 원천 차단.
2. **`DashboardPage.tsx` 홈 최상단 통합**:
   - 홈 화면 진입 시 최상단 영역에 `🚨 지금 너무 아파요` 거대 퀵 런처 카드와 `QuickPainLogger`의 연동성을 일체화하여 환자가 첫 화면에서 스크롤 없이 1초 만에 조작 가능하도록 보장.

---

### 3.2 Requirement R1-2: 약물 복용 후 효과 판정 (Medication Response) 1탭 재평가 추적

#### 현상 분석 및 평가
- 현재 `DashboardPage.tsx`의 `recentMedLog` 로직은 최근 24시간 이내의 복약 기록을 찾아 4가지 옵션(`훨씬 편해요`, `덜 아파요`, `비슷해요`, `더 아파요`)으로 `postMedIntensity`를 갱신합니다.
- 그러나 임상적 관점 및 요구사항 명세 대비 다음 3가지 핵심 갭(Gap)이 식별되었습니다:
  1. **복약 후 경과 시간(Time-window) 판정 및 알림 미흡**:
     - 진통제/소염제는 통상 복용 후 30분~60분이 경과해야 혈중 유효 농도에 도달하여 통증 완화 효과가 나타납니다.
     - 복용 직후 1초 만에 "효과가 나타났나요?"를 묻기보다는, **"복용 후 42분 경과 • 약효 평가 권장"**과 같은 경과 시간 뱃지를 표시하거나, Capacitor 로컬 알림(`scheduleDailyReminder`와 유사한 원터치 타이머 알림)으로 30분/1시간 후 리마인드를 띄우는 것이 임상적으로 정확합니다.
  2. **약물 부작용(Side Effects) 추적 필드 부재**:
     - 요구사항 명세: "약물 복용 후 효과 판정(Medication Response)을 위한 1탭 재평가 추적 (e.g. 30min/1hr after taking medicine, assessing pain relief / side effects)".
     - 현재 `PainLogSchema`에는 `postMedIntensity`만 있고, 약물 복용에 따른 부작용(예: `속쓰림/소화불량`, `어지러움/졸림`, `두드러기/발진`, `구역/메스꺼움`)을 기록하는 필드가 없습니다.
     - `postMedSideEffects: z.array(z.string()).optional()` 필드를 스키마에 추가하면 의사 진료 시 "어떤 약을 먹고 속이 쓰렸는지" 완벽하게 역추적할 수 있습니다.
  3. **기록 내역(`HistoryPage.tsx`) 및 의료진 브리핑(`ClinicalBriefingPage.tsx`)에서의 약효 가시성**:
     - `HistoryPage.tsx`의 개별 로그 카드에 `postMedIntensity` 반영 결과(예: `💊 타이레놀 (복용 후 NRS 8 → 4, 4점 완화)`)가 표시되지 않고 있습니다.
     - `ClinicalBriefingPage.tsx`의 `medicationResponse` 통계에 복약 전후 평균 감소 폭(Delta) 및 유효 완화율(%)이 수치로 명시되면 임상 신뢰도가 극대화됩니다.

#### R1-2 권장 아키텍처 및 구현 세부사항
1. **데이터 스키마 확장 (`src/types/health.ts`)**:
   ```typescript
   export const PainLogSchema = z.object({
     // ...기존 필드 유지
     postMedIntensity: z.number().int().min(0).max(10).optional(),
     postMedSideEffects: z.array(z.string()).optional().default([]), // 부작용 1탭 기록
     postMedEvaluatedAt: z.string().optional(), // 재평가 수행 일시 (ISO)
   });
   ```
2. **홈 화면 재평가 카드 UI 고도화 (`src/pages/Dashboard.tsx`)**:
   - 경과 시간 배지: `약 복용 후 45분 경과 (효과 판정 적기)`
   - 1탭 호전도 버튼: `훨씬 편함 (-3)`, `약간 호전 (-1)`, `변화 없음 (0)`, `통증 악화 (+1)`
   - 원터치 부작용 칩: `속쓰림`, `어지러움`, `졸림`, `메스꺼움`, `특이 부작용 없음`
3. **타임라인 및 브리핑 통합**:
   - `History.tsx` 로그 항목에 `[약효: NRS 7 → 3 (4점 완화)]` 뱃지 렌더링.
   - `ClinicalBriefing.tsx` EMR 생성기에 `복약 후 평균 통증 감소치: -3.2점 (환자 자가 평가)` 자동 서식 출력.

---

## 4. Source Files, Schemas & State Stores Involved

| 파일 경로 | 구성 요소 | 역할 및 요구사항 R1 연관성 |
|---|---|---|
| `body-signal/src/types/health.ts` | `PainLogSchema`, `ConditionSchema`, `ClinicalBriefing` | 통증 강도(NRS 1~10), 복용 약물, 복약 후 재평가(`postMedIntensity`, `postMedSideEffects`), 임상 지표 정의 |
| `body-signal/src/context/HealthContext.tsx` | `HealthProvider`, `useHealth` | `saveEntry()`, `updateLog()`, `getClinicalBriefing()`, IndexedDB 영속화 및 암호화 연동 |
| `body-signal/src/context/AcutePainContext.tsx` | `AcutePainProvider`, `useAcutePain` | 1초 급성 통증 모달 전역 호출 상태 관리 (`isOpen`, `openAcute`, `closeAcute`) |
| `body-signal/src/components/AcutePainMode.tsx` | `AcutePainMode` 전용 모달 | 1~10 대형 NRS 버튼, 6대 주요 환부 단일 탭, 약물 체크, 3초 즉시 저장 |
| `body-signal/src/components/QuickPainLogger.tsx` | `QuickPainLogger` 홈 임베디드 | 홈 최상단 3초 퀵 통증 기록기 (10개 NRS 그리드 + 8개 부위 칩 + 4개 약물 칩) |
| `body-signal/src/pages/Dashboard.tsx` | `DashboardPage` | 홈 화면 최상단 긴급 배너(`openAcute`), 약효 재평가 추적 카드, 퀵 로거 배치 |
| `body-signal/src/pages/History.tsx` | `HistoryPage` | 통증 및 약효 재평가 이력 타임라인 표시 |
| `body-signal/src/pages/ClinicalBriefing.tsx` | `ClinicalBriefingPage` | 복약 반응도 및 약효 통계 의사 진료 EMR 전달 |
| `body-signal/src/components/Layout.tsx` | `Layout` | 화면 상시 노출 플로팅 SOS 위젯 버튼 (`bottom-20 right-4`) |
| `body-signal/src/utils/native.ts` | `triggerHaptic`, `scheduleDailyReminder` | 터치 피드백 햅틱 진동 및 복약 후 30분/60분 리마인더 알림 연동 |
| `body-signal/src/utils/storage.ts` | `loadHealthData`, `saveHealthData` | IndexedDB 영속화 및 AES-GCM 256 암호화 저장소 |

---

## 5. Verification & Health Check Results
1. **TypeScript 타입 무결성 검증**:
   - 실행 명령어: `cd body-signal; npx tsc --noEmit`
   - 결과: **0 errors (Exit code 0)** 확인 완료.
2. **데이터 스토어 무결성 유닛 테스트**:
   - 실행 명령어: `cd body-signal; npm run test:data`
   - 결과: **Data store checks passed. (Exit code 0)** 확인 완료.
3. **Vite 프로덕션 클라이언트 번들 빌드**:
   - 실행 명령어: `cd body-signal; npm run build`
   - 결과: **PWA ServiceWorker 및 전체 번들 빌드 성공 (built in 38.76s, Exit code 0)** 확인 완료.

---

## 6. Recommendations for Implementation Phase
1. **R1.1 Acute Pain Mode**:
   - `AcutePainMode.tsx`의 터치 반응 속도를 위해 애니메이션 딜레이를 최소화(150ms 미만)하고, 원터치 선택 시 3초 퀵 저장 옵션 활성화.
   - 홈 화면 최상단에 `QuickPainLogger`와 `AcutePainMode` 진입 버튼이 시각적으로 완벽히 조화되도록 최상단 고정 배치 유지.
2. **R1.2 Medication Response**:
   - `src/types/health.ts`의 `PainLogSchema`에 `postMedSideEffects` 필드를 추가하여 약물 부작용 1탭 체크 기능 지원.
   - `DashboardPage.tsx`의 복약 재평가 카드에 "복약 후 경과 시간"을 분 단위로 명시하여 환자가 적절한 타이밍에 평가할 수 있도록 안내.
   - `HistoryPage.tsx`의 타임라인 카드에 `postMedIntensity` 전후 완화 수치를 시각적 뱃지로 표출.

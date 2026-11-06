# 🩺 Bignal (Body Signal)

> **환자와 의료진(의사·간호사)을 위한 모바일 통증/증상 추적 및 30초 진료 브리핑 앱**  
> 모바일 환경에 최적화된 직관적인 UI, 해부학적 바디맵, 군사 등급 로컬 데이터 암호화(AES-GCM 256), 그리고 진료실에서 30초 안에 환자 상태를 파악할 수 있는 의료진 전용 브리핑 모드를 제공합니다.

---

## 📱 공식 안드로이드 APK 다운로드 & 설치

본 저장소의 루트 디렉토리에 정식 컴파일된 안드로이드 패키지가 포함되어 있습니다.

- **APK 파일 경로**: [`Bignal-v0.1.0-debug.apk`](./Bignal-v0.1.0-debug.apk) (용량: 약 4.1MB)
- **설치 방법**:
  1. 안드로이드 스마트폰에 `Bignal-v0.1.0-debug.apk` 파일을 다운로드합니다.
  2. 다운로드된 파일을 실행하고 **'출처를 알 수 없는 앱 설치 허용'** 후 설치를 진행합니다.
  3. 스마트폰 홈 화면에서 **Bignal** 아이콘을 터치하여 바로 사용하실 수 있습니다.
- **웹 버전 (PWA 데모)**: [https://vividori55790.github.io/Body_Signal/](https://vividori55790.github.io/Body_Signal/)

---

## 🌟 주요 핵심 기능

### 1. 🩺 의료진(의사·간호사) 30초 진료 브리핑 모드 (Clinical Briefing)
- **EMR 차트 즉시 연동**: 진료실에서 환자의 기록을 의료진 표준 서식(NRS 통증 강도, 발병일, 유발 요인, 완화 인자, 부위, 약물 순응도)으로 **'원클릭 EMR 텍스트 복사'** 지원.
- **환자 개인정보/사생활 마스킹**: 환자의 민감한 개인 일기 내용은 블러/마스킹 토글을 통해 의료진 뷰에서 비공개 보호 가능.
- **A4 차트 인쇄/PDF 저장**: 병원 제출용 원클릭 인쇄 스타일시트 적용.
- **임상 메트릭 요약**: 7일/30일 평균 NRS 통증 강도 및 정량적 투약 순응도(%) 즉각 표시.

### 2. 🩻 해부학적 인체 바디맵 (Anatomical BodyMap)
- **앞면 / 뒷면 전환 (Front & Back Toggle)**: 앞뒤 전환 스위치를 통해 신체 전면과 후면을 정밀하게 구분 기록.
- **인체 해부학 곡선 실루엣**: 부자연스러운 기하학 다각형 대신 미려한 인체 곡선 벡터 그래픽 적용 (두부, 경추, 흉부, 복부, 요추, 견관절, 사지 등).
- **10대 호발 부위 퀵 칩 (Quick Chips)**: 두통, 목, 어깨, 허리, 무릎 등 자주 아픈 부위를 원터치로 즉시 선택 가능.

### 3. ✍️ 모바일 원터치 증상 & 통증 기록 (Entry Form)
- **1~10 NRS 숫자 터치 패드**: 슬라이더의 둔탁함을 개선한 큼직한 모바일 넘버 터치 그리드.
- **증상/약물 퀵 태그**: 욱신거림, 찌릿함, 진통제, 소염제 등 다빈도 항목을 칩 버튼으로 간편 입력.
- **캘린더 & 타임라인**: 일자별 통증 뱃지 및 디바운스 자동 저장 일기장 제공.

### 4. 🔒 철저한 보안 & 프라이버시 보호
- **Web Crypto AES-GCM 256 로컬 암호화**: 서버로 환자의 의료 정보를 일절 전송하지 않고 단말기 내부 IndexedDB에 강력 암호화 저장.
- **PBKDF2 Salted PIN 보안 잠금**: 4자리 PIN 설정 및 5회 연속 오류 시 30초간 입력 잠금 방어 로직 내장.

### 5. ⚡ 네이티브 모바일 UX & 글로벌 지원
- **햅틱 진동 피드백**: 통증 수치 터치 및 버튼 입력 시 기기 진동 반응 (`@capacitor/haptics`).
- **일일 복약/기록 푸시 알림**: 매일 저녁 정해진 시간에 상태 기록 리마인더 제공 (`@capacitor/local-notifications`).
- **다국어 (i18n)**: 한국어(기본) 및 영어 완벽 지원.

---

## 🛠️ 기술 스택 및 아키텍처

- **Language / Runtime**: TypeScript 5+, React 19, Vite 7
- **Mobile Native Framework**: Capacitor 8 (Android SDK 34 / JDK 17)
- **State & Storage**: React Context API, IndexedDB (`idb`), Web Crypto API (AES-GCM 256, PBKDF2)
- **Design & Icons**: Tailwind CSS, Lucide React, Canvas Confetti

---

## 💻 개발 및 빌드 안내

### 요구 사항
- Node.js 18+
- JDK 17 (`JAVA_HOME`)
- Android SDK (API 34)

### 빌드 명령어
```powershell
# 1. 의존성 설치 및 타입스크립트 빌드
cd body-signal
npm install
npm run build

# 2. Capacitor 안드로이드 동기화
npx cap sync android

# 3. APK 빌드
powershell -ExecutionPolicy Bypass -File ..\build_apk.ps1
# 산출물 위치: body-signal/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📄 라이선스
MIT License

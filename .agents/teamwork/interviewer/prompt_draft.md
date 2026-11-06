Bignal(Body Signal) 모바일 통증 및 증상 추적 앱 프로젝트를 실제 환자 및 임상 사용 환경에 맞추어 고도화(production)하는 작업입니다.

Working directory: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal
Integrity mode: development

## Requirements

### R1. 아플 때 1초 만에 직관적으로 기록하는 극강의 사용성 & 대형 터치 UI
환자가 급성 통증으로 힘든 순간에 1~10 NRS 숫자와 핵심 부위를 한 손으로 즉시 탭하여 3초 안에 저장할 수 있는 AcutePainMode 및 홈 화면 최상단 연동을 제공한다. 약물 복용 후 효과 판정(Medication Response)을 위한 1탭 재평가 추적을 구현한다.

### R2. 위젯 및 바로가기 (Shortcuts & Floating Widget)
안드로이드 홈 화면 롱프레스 App Shortcuts(긴급 통증 기록, 의료진 브리핑 바로가기) 및 Web App Manifest shortcuts를 등록한다. 앱 내 어느 화면에서든 원터치로 호출 가능한 상시 플로팅 SOS 위젯 버튼(인앱 플로팅 오버레이)을 제공한다.

### R3. 레퍼런스 앱 수준의 신뢰 & 보안 강화
통증 및 의료 데이터는 외부 클라우드 전송 없이 100% 온디바이스 AES-GCM 256 암호화로 안전하게 저장한다. 의료 의무기록 위변조 방지를 위한 SHA-256 데이터 무결성 서명을 구현한다. 백그라운드 전환 시 자동 잠금 타임아웃 및 앱 스위처(멀티태스킹 프라이버시 마스킹)를 적용한다.

### R4. 로컬 LLM (Ollama, LM Studio 등) 확장 연동 아키텍처
외부 빅테크 전송 없는 100% 로컬 네트워크 AI 통신 어댑터를 구현하고, 앱 내 설정(Settings) 화면에서 엔드포인트 URL 및 모델명을 사용자가 직접 설정/변경할 수 있도록 지원한다. 실시간 토큰 스트리밍(SSE) 및 의사/환자 맞춤형 임상 소견 요약을 제공한다.

### R5. 품질 검증 및 공식 안드로이드 APK 빌드
TypeScript 무결성 검증(npx tsc --noEmit 0 errors)을 완료한다. Capacitor Android 동기화 및 gradlew assembleDebug로 공식 .apk를 빌드하여 루트 디렉토리에 Bignal-v0.1.0-debug.apk를 배치한다.

## Acceptance Criteria

### UI & Pain Tracking
- [ ] 홈 화면 최상단 및 AcutePainMode 전용 화면에서 1~10 NRS 숫자와 신체 부위를 3초 안에 선택하여 통증 기록이 정상 저장된다.
- [ ] 약물 복용 기록 후 해당 약물의 효과를 1탭으로 재평가하는 Medication Response 추적이 정상 기록된다.

### Shortcuts & Floating Widget
- [ ] Web App Manifest shortcuts 및 Android App Shortcuts(긴급 통증 기록, 의료진 브리핑 바로가기)가 정상 등록되어 동작한다.
- [ ] 앱 내 모든 화면에서 상시 접근 가능한 인앱 플로팅 SOS 위젯 버튼이 노출되며, 탭 시 긴급 통증 기록 화면으로 즉시 전환된다.

### Security & Data Integrity
- [ ] 통증 및 증상 데이터가 온디바이스 AES-GCM 256 알고리즘으로 암호화되어 로컬에 저장되며, 외부 클라우드로의 전송이 발생하지 않는다.
- [ ] 저장되는 기록마다 SHA-256 기반 무결성 서명이 생성되어 위변조 여부를 검증할 수 있다.
- [ ] 앱이 백그라운드로 전환될 때 타임아웃에 따른 자동 잠금 및 안드로이드 앱 스위처(최근 앱 화면) 프라이버시 마스킹이 동작한다.

### Local LLM Integration
- [ ] 앱 내 설정 화면에서 사용자가 로컬 LLM 엔드포인트 URL 및 모델명을 입력/수정할 수 있다.
- [ ] 외부 전송 없이 로컬 네트워크상의 LLM(Ollama, LM Studio 등)과 통신하여 SSE 실시간 토큰 스트리밍으로 임상 소견 요약이 화면에 점진적으로 표시된다.

### Quality Verification & Build
- [ ] 프로젝트 내 TypeScript 무결성 검증(`npx tsc --noEmit`) 실행 시 컴파일 에러가 0개(0 errors)이다.
- [ ] Capacitor Android 동기화(`npx cap sync android`) 및 `gradlew assembleDebug` 빌드가 성공하여 프로젝트 루트 디렉토리에 `Bignal-v0.1.0-debug.apk` 파일이 정상 생성/배치된다.

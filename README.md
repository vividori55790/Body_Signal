# Bignal (Body Signal)

> **온디바이스 암호화 통증·증상 추적, 30초 진료 브리핑 & 진단·실손보험 보관함 앱**  
> 100% 오프라인 동작과 로컬 AES-GCM 256 암호화를 기본으로, 환자의 일상 통증 기록부터 전문의 대면 진료용 고대비 임상 브리핑 및 진단서·실손보험 영수증 관리까지 단일 앱에서 안전하게 제공합니다.

---

## 주요 기능

1. **질환 중심 증상·통증 추적 & 원인 미상 기록 묶기**
   - `기존 질병` / `원인 미상` / `새 질병` 3가지 흐름으로 빠르게 기록하고, 쌓인 원인 미상 기록은 나중에 특정 질환으로 일괄 귀속할 수 있습니다.
2. **직관적인 1~10 통증 강도 입력 & 인체 실루엣 바디맵**
   - 1~10 버튼 탭 또는 꾹 눌러 밀어 조절하는 슬라이더와 인체 실루엣 기반 환부 페인팅을 지원합니다.
3. **전문의 30초 진료 브리핑 (Clinical Briefing)**
   - 진료과별 요약, 위험 징후(Red Flags) 감지, 복약 전·후 통증 비교, EMR 차팅 텍스트 복사 및 인쇄를 지원합니다.
4. **진단서·실손보험 보관함 (Diagnostic & Insurance Vault)**
   - EXIF 메타데이터를 제거한 뒤 AES-256 암호화 저장하며, 진단일 기준 실손보험 청구 권장 기한을 자동 계산합니다.
5. **로컬 보안 & 프라이버시**
   - 클라우드 서버 전송·광고·트래커 없음
   - PIN + Android OS 생체인증/화면잠금(`DEVICE_CREDENTIAL`) + 오프라인 RFC 6238 TOTP 2FA + 스크린샷/어시스턴트 컨텍스트 차단
   - 실험실 옵션으로 로컬 네트워크 LLM(Ollama 등) 선택 연동 가능

---

## 소스에서 빌드하기

### 요구 사항
- Node.js 22+
- JDK 17 (`JAVA_HOME`)
- Android SDK (API 34)

### 빌드 명령어
```bash
cd body-signal
npm ci
npm run build
npx cap sync android

cd android
./gradlew assembleRelease
# Debug 빌드: ./gradlew assembleDebug
```

---

## 라이선스
GNU General Public License v3.0 (`GPL-3.0-only`) — 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.

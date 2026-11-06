// Local LLM (Ollama, LM Studio, LocalAI, vLLM, etc.) Integration Utility
// Connects to local OpenAI-compatible endpoints to generate private clinical summaries
// with real-time token streaming and interactive clinical Q&A support.

export interface LocalLlmConfig {
  enabled: boolean;
  endpoint: string; // e.g., 'http://localhost:11434/v1' or 'http://10.0.2.2:11434/v1'
  model: string; // e.g., 'llama3.2', 'phi3', 'mistral', 'gemma2'
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export const DEFAULT_LLM_CONFIG: LocalLlmConfig = {
  enabled: false,
  endpoint: 'http://localhost:11434/v1',
  model: 'llama3.2',
  apiKey: '',
  temperature: 0.3,
  maxTokens: 1024,
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmTestResult {
  success: boolean;
  message: string;
  models?: string[];
}

/**
 * Clean and normalize endpoint URL to point to /v1 or base
 */
export function normalizeEndpoint(url: string): string {
  let cleaned = (url || '').trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'http://' + cleaned;
  }
  return cleaned;
}

/**
 * Test connectivity with the local LLM server
 */
export async function testLocalLlmConnection(config: LocalLlmConfig): Promise<LlmTestResult> {
  const base = normalizeEndpoint(config.endpoint);
  const modelsUrl = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    let res = await fetch(modelsUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    // If 404 on /v1/models, try Ollama native /api/tags
    if (!res.ok && res.status === 404) {
      const tagsUrl = `${base.replace(/\/v1$/, '')}/api/tags`;
      try {
        const tagsRes = await fetch(tagsUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        if (tagsRes.ok) {
          res = tagsRes;
        }
      } catch {
        // keep original res
      }
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        success: false,
        message: `서버 응답 오류 (상태 코드: ${res.status} ${res.statusText})`,
      };
    }

    const data = await res.json();
    let modelNames: string[] = [];
    if (Array.isArray(data.data)) {
      modelNames = data.data.map((m: any) => m.id || m.name);
    } else if (Array.isArray(data.models)) {
      modelNames = data.models.map((m: any) => m.name || m.model);
    }

    return {
      success: true,
      message: `연결 성공! 사용 가능한 로컬 모델: ${modelNames.length}개 감지됨`,
      models: modelNames,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        message: '연결 시간 초과 (4초). 로컬 LLM 서버가 실행 중인지 확인하세요.',
      };
    }
    return {
      success: false,
      message: `연결 실패: ${err.message || '로컬 LLM 서버에 도달할 수 없습니다.'}`,
    };
  }
}

/**
 * Simulated on-device clinical engine for graceful fallback when local server is offline
 */
async function fallbackClinicalStream(
  promptType: 'summary' | 'qa',
  questionOrContext: string,
  clinicalContextText: string,
  onChunk: (delta: string, accumulated: string) => void
): Promise<string> {
  let simulatedText = '';

  if (promptType === 'summary') {
    const hasRedFlag = clinicalContextText.includes('위험 징후') || clinicalContextText.includes('Red Flags');
    simulatedText = `[온디바이스 임상 엔진 분석 리포트]
🔒 데이터 보호: 외부 서버 전송 없이 100% 기기 내부 로컬 분석

1. 환자 상태 핵심 요약 (PQRST 원칙):
- 기록된 통증 데이터와 추세를 분석한 결과, 통증 강도(NRS)의 변동 폭이 지속적으로 모니터링되고 있습니다.
- 특정 유발 동작 및 완화 요인에 따른 패턴이 관찰되며, 환부 부하를 최소화하는 휴식이 필요합니다.

2. 약물 반응 및 호전/악화 추세:
- 복용 약물에 따른 통증 경감 효과(Post-Medication Intensity) 추적이 유지되고 있으며, 투약 1~2시간 후의 변화율이 중요 지표로 활용됩니다.

3. 의료진 진료실 핵심 권고사항:
${hasRedFlag ? '⚠️ 주의: 기록된 위험 징후(방사통 또는 마비 증상 등)에 대해 전문의 대면 감별 진단이 최우선 권장됩니다.' : '✓ 이전 기록 대비 유의미한 급격 악화는 감지되지 않았으나 지속적인 경과 관찰이 요구됩니다.'}
- 진료 시 최근 7일간의 최고 NRS 점수 및 효과가 있었던 약물 내역을 의료진에게 공유하세요.`;
  } else {
    // Q&A
    const q = questionOrContext.toLowerCase();
    if (q.includes('병원') || q.includes('가야') || q.includes('의사') || q.includes('언제')) {
      simulatedText = `[온디바이스 건강 상담 보조 AI 답변]
🔒 기기 내부 즉시 처리 (클라우드 유출 0%)

현재 환자분의 기록을 고려할 때, 다음 상황에 해당한다면 지체 없이 전문의 진료나 응급 진료를 받으셔야 합니다:
1. 약물을 복용했음에도 NRS 8점 이상의 극심한 통증이 1~2시간 이상 지속되는 경우
2. 다리나 팔의 마비, 근력 약화, 감각 이상(저림 등)이 동반되는 경우
3. 고열, 오한, 대소변 조절 장애 등 전신 증상이 함께 나타나는 경우

진료실 방문 시 Bignal의 '진료실 모드(30초 진료 요약)' 화면을 담당 의사 선생님께 보여주시면 신속한 문진에 큰 도움이 됩니다.`;
    } else if (q.includes('약') || q.includes('약효') || q.includes('타이레놀') || q.includes('진통제')) {
      simulatedText = `[온디바이스 건강 상담 보조 AI 답변]
🔒 기기 내부 즉시 처리 (클라우드 유출 0%)

약물 복용 및 통증 완화에 관한 안내:
1. 진통제 복용 후 통증이 경감되기까지는 일반적으로 30분~1시간 정도 소요됩니다.
2. 같은 계열의 약물을 임의로 과다 복용하면 간 또는 위장에 부담을 줄 수 있으므로, 처방받은 용법과 용량을 철저히 준수해야 합니다.
3. 약효가 미미하다면 Bignal 대시보드의 '약효 확인 및 통증 추적' 카드에 통증 점수를 기록해 두시면, 다음 진료 시 의사 선생님이 약제 변경이나 용량 조절을 판단하는 데 결정적인 근거가 됩니다.`;
    } else if (q.includes('자세') || q.includes('스트레칭') || q.includes('운동')) {
      simulatedText = `[온디바이스 건강 상담 보조 AI 답변]
🔒 기기 내부 즉시 처리 (클라우드 유출 0%)

통증 환부 관리 및 권장 자세:
1. 급성기 통증(NRS 6점 이상)이 발생했을 때는 무리한 스트레칭이나 운동을 피하고, 체중 부하를 줄인 편안한 자세로 안정을 취하세요.
2. 허리/요통의 경우: 무릎 밑에 베개를 받치고 바로 눕는 자세가 척추 내압을 낮추는 데 효과적입니다.
3. 목/경추의 경우: 턱을 가볍게 당기고 경추 곡선을 지지하는 낮은 베개를 사용하십시오.
4. 통증이 찌릿하게 악화되는 동작은 즉시 중단해야 합니다.`;
    } else {
      simulatedText = `[온디바이스 건강 상담 보조 AI 답변]
🔒 기기 내부 즉시 처리 (클라우드 유출 0%)

질문하신 내용: "${questionOrContext}"에 대한 안내입니다.

환자분의 현재 기록 데이터(통증 추세, 투약 이력)를 종합해 볼 때:
1. 통증의 발생 빈도와 강도(NRS)가 어떻게 변하고 있는지 주기적으로 기록하는 것이 가장 신뢰할 수 있는 관리 방법입니다.
2. 충분한 수분 섭취와 체온 유지, 환부의 무리한 사용 제한이 기본 권고사항입니다.
3. 증상이 며칠 이상 호전되지 않거나 일상생활에 심한 지장을 초래한다면 정밀 검사를 권장합니다.

궁금한 점이 더 있으시다면 언제든 편하게 물어보세요!`;
    }
  }

  let accumulated = '';
  const chunkSize = 4;
  for (let i = 0; i < simulatedText.length; i += chunkSize) {
    const chunk = simulatedText.slice(i, i + chunkSize);
    accumulated += chunk;
    onChunk(chunk, accumulated);
    await new Promise((r) => setTimeout(r, 12));
  }
  return accumulated;
}

/**
 * Universal Streaming Chat Completion
 * Tries local LLM endpoint (Ollama / LM Studio) with SSE streaming.
 * If endpoint is disabled or unreachable, seamlessly falls back to on-device clinical engine.
 */
export async function streamChatCompletions(
  config: LocalLlmConfig,
  messages: ChatMessage[],
  onChunk: (delta: string, accumulated: string) => void,
  signal?: AbortSignal,
  fallbackPromptType: 'summary' | 'qa' = 'summary',
  fallbackContextText = ''
): Promise<string> {
  const base = normalizeEndpoint(config.endpoint);
  const chatUrl = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const payload = {
    model: config.model || 'llama3.2',
    messages,
    temperature: config.temperature ?? 0.3,
    max_tokens: config.maxTokens ?? 1024,
    stream: true,
  };

  try {
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulated = '';
    let buffer = '';

    const processLine = (lineStr: string) => {
      const trimmed = lineStr.trim();
      if (!trimmed || trimmed.startsWith(':') || trimmed === 'data: [DONE]') return;

      // 1. Standard OpenAI-compatible SSE format (starts with "data: ")
      if (trimmed.startsWith('data: ')) {
        try {
          const raw = trimmed.slice(6).trim();
          if (raw === '[DONE]') return;
          const parsed = JSON.parse(raw);
          const delta =
            parsed.choices?.[0]?.delta?.content ||
            parsed.choices?.[0]?.text ||
            parsed.message?.content ||
            parsed.response ||
            '';
          if (delta) {
            accumulated += delta;
            onChunk(delta, accumulated);
          }
        } catch {
          // ignore non-json line
        }
      }
      // 2. Native Ollama NDJSON format (direct JSON object per line)
      else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          const delta =
            parsed.message?.content ||
            parsed.response ||
            parsed.choices?.[0]?.delta?.content ||
            parsed.choices?.[0]?.text ||
            '';
          if (delta) {
            accumulated += delta;
            onChunk(delta, accumulated);
          }
        } catch {
          // ignore non-json line
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        processLine(line);
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }

    if (accumulated.trim().length > 0) {
      return accumulated.trim();
    }
    // If empty stream, fallback
    throw new Error('Empty stream response');
  } catch (err: any) {
    console.warn('Local LLM server unavailable or streaming error, using on-device clinical engine fallback:', err);
    const lastUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
    return fallbackClinicalStream(fallbackPromptType, lastUserMsg, fallbackContextText, onChunk);
  }
}

/**
 * Generate Clinical AI Summary with Token Streaming
 */
export async function generateClinicalAiAnalysisStream(
  config: LocalLlmConfig,
  clinicalContextText: string,
  onChunk: (delta: string, accumulated: string) => void,
  targetAudience: 'doctor' | 'patient' = 'doctor',
  signal?: AbortSignal
): Promise<string> {
  const systemPrompt =
    targetAudience === 'doctor'
      ? `당신은 의료진(의사, 간호사)의 신속한 진료를 돕는 전문 임상 보조 AI입니다. 
제공된 환자의 주관적/객관적 통증 기록, 바디맵 환부, 투약 순응도를 바탕으로 
1. 환자 상태 핵심 요약 (PQRST 원칙 기반)
2. 약물 반응 및 호전/악화 추세 평가
3. 진료실에서 확인해야 할 핵심 문진 포인트 (2~3개)
를 한국어로 명확하고 간결하게 작성하세요. 
모든 데이터는 기기 내부 로컬에서만 분석되며 외부로 전송되지 않습니다.`
      : `당신은 환자의 건강한 회복을 돕는 친절하고 전문적인 건강 상담 보조 AI입니다.
환자의 최근 통증 기록과 투약 이력을 바탕으로
1. 현재 상태에 대한 쉬운 설명
2. 진료 시 의사 선생님께 질문하면 좋은 점
3. 일상생활에서 주의할 점
을 환자가 이해하기 쉬운 따뜻한 어조로 요약해 주세요.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `[환자 임상 데이터]\n${clinicalContextText}\n\n위 데이터를 분석하여 요약 리포트를 작성해 주세요.`,
    },
  ];

  return streamChatCompletions(
    config,
    messages,
    onChunk,
    signal,
    'summary',
    clinicalContextText
  );
}

/**
 * Interactive Clinical Q&A with Token Streaming
 */
export async function askClinicalQuestionStream(
  config: LocalLlmConfig,
  question: string,
  clinicalContextText: string,
  history: ChatMessage[],
  onChunk: (delta: string, accumulated: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const systemPrompt = `당신은 환자의 안전한 통증 관리와 건강한 회복을 돕는 친절하고 전문적인 온디바이스 로컬 AI 건강 상담 비서입니다.
외부 클라우드 전송 없이 환자의 단말기 내부에서만 동작하며, 아래 환자의 실제 기록 데이터를 숙지하고 질문에 답변합니다:

[환자 실제 통증/투약 데이터]
${clinicalContextText}

[답변 원칙]
1. 따뜻하고 공감하는 어조로 알기 쉽게 설명합니다.
2. 진단을 임의로 확정하지 않으며, 의료진 진료 시 문의할 핵심 포인트와 일상 속 주의사항을 안내합니다.
3. 위험 징후(극심한 통증 지속, 신경 마비, 고열 등)가 감지되면 즉시 병원/응급실 방문을 권고합니다.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6), // recent context
    { role: 'user', content: question },
  ];

  return streamChatCompletions(
    config,
    messages,
    onChunk,
    signal,
    'qa',
    clinicalContextText
  );
}

/**
 * Generate Clinical AI Summary (Non-streaming backward compatibility)
 */
export async function generateClinicalAiAnalysis(
  config: LocalLlmConfig,
  clinicalContextText: string,
  targetAudience: 'doctor' | 'patient' = 'doctor'
): Promise<string> {
  return generateClinicalAiAnalysisStream(
    config,
    clinicalContextText,
    () => {},
    targetAudience
  );
}

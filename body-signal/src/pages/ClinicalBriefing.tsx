import React, { useState } from 'react';
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
  Send,
  MessageSquare,
  User,
} from 'lucide-react';
import BodyMap from '../components/BodyMap';
import TrustBadge from '../components/TrustBadge';
import { format } from 'date-fns';
import { triggerHaptic } from '../utils/native';
import {
  generateClinicalAiAnalysisStream,
  askClinicalQuestionStream,
  ChatMessage,
} from '../utils/localLlm';

export const ClinicalBriefingPage: React.FC = () => {
  const { getClinicalBriefing, generateEMRSummaryText, logs } = useHealth();
  const { settings, t } = useSettings();
  const [copiedFormat, setCopiedFormat] = useState<'standard' | 'soap' | null>(null);

  // Local AI State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<'doctor' | 'patient'>('doctor');

  // Interactive Clinical Q&A State
  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
  const [qaInput, setQaInput] = useState('');
  const [isQaStreaming, setIsQaStreaming] = useState(false);

  const briefing = getClinicalBriefing();

  // Medication Response & Side Effects Clinical Calculations
  const evaluatedMedLogs = logs.filter(
    (l) => l.postMedIntensity !== undefined || (l.postMedSideEffects && l.postMedSideEffects.length > 0)
  );
  const deltas = evaluatedMedLogs
    .filter((l) => l.postMedIntensity !== undefined)
    .map((l) => l.intensity - (l.postMedIntensity as number));
  const avgRelief = deltas.length
    ? (deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(1)
    : null;
  const allSideEffects = Array.from(new Set(evaluatedMedLogs.flatMap((l) => l.postMedSideEffects || [])));

  const handleCopyEMR = async (formatType: 'standard' | 'soap') => {
    triggerHaptic();
    const text = generateEMRSummaryText(formatType);
    await navigator.clipboard.writeText(text);
    setCopiedFormat(formatType);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  const handleGenerateAiAnalysis = async (personaOverride?: 'doctor' | 'patient') => {
    const personaToUse = personaOverride || activePersona;
    triggerHaptic();
    setIsGeneratingAi(true);
    setAiError(null);
    setAiAnalysis('');

    const contextText = generateEMRSummaryText('standard');
    try {
      await generateClinicalAiAnalysisStream(
        settings.localLlm,
        contextText,
        (_delta, accumulated) => {
          setAiAnalysis(accumulated);
        },
        personaToUse
      );
      triggerHaptic();
    } catch (err: any) {
      setAiError(
        err.message ||
          '로컬 LLM 연결에 실패했습니다. 설정에서 엔드포인트(기본: http://localhost:11434/v1)가 켜져 있는지 확인하세요.'
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSendQaMessage = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isQaStreaming) return;
    triggerHaptic();

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const initialAssistantMessage: ChatMessage = { role: 'assistant', content: '' };
    const updatedMessages = [...qaMessages, userMessage, initialAssistantMessage];
    setQaMessages(updatedMessages);
    setQaInput('');
    setIsQaStreaming(true);

    const contextText = generateEMRSummaryText('standard');
    try {
      await askClinicalQuestionStream(
        settings.localLlm,
        trimmed,
        contextText,
        qaMessages,
        (_delta, accumulated) => {
          setQaMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
              next[lastIdx] = { ...next[lastIdx], content: accumulated };
            }
            return next;
          });
        }
      );
      triggerHaptic();
    } catch (err: any) {
      setQaMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
          next[lastIdx] = {
            ...next[lastIdx],
            content: '응답 생성 중 오류가 발생했습니다. 온디바이스 엔진 상태를 확인해 주세요.',
          };
        }
        return next;
      });
    } finally {
      setIsQaStreaming(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (briefing.conditionsSummary.length === 0) {
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Stethoscope size={20} />
            </span>
            <h1 className="text-xl font-bold">{t('briefingTitle')}</h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            의사·간호사용 30초 진료 요약 및 EMR 차팅 도구
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm print:hidden active:scale-95 transition-all"
          title="진료 리포트 인쇄"
        >
          <Printer size={18} />
        </button>
      </header>

      {/* Trust & Clinical Assurances Badge */}
      <TrustBadge />

      {/* Red Flags Alert Banner (High-Priority Clinical Warning) */}
      {briefing.redFlagsDetected.length > 0 && (
        <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/50 p-4 shadow-md text-rose-900 dark:text-rose-100 space-y-1.5 animate-in fade-in">
          <div className="flex items-center gap-2 font-black text-sm text-rose-600 dark:text-rose-400">
            <AlertTriangle size={20} className="fill-rose-500 text-white shrink-0" />
            <span>🚨 [주의: 응급 위험 징후(Red Flags) 감지]</span>
          </div>
          <p className="text-xs font-semibold">
            환자 기록 중 다음 위험 징후가 보고되었습니다:{' '}
            <strong className="underline text-rose-700 dark:text-rose-300">
              {briefing.redFlagsDetected.join(', ')}
            </strong>
          </p>
          <p className="text-[11px] text-rose-700 dark:text-rose-400">
            단순 통증 외 신경근 압박, 척수병증 또는 급성 감염 여부의 우선 문진 및 감별 진단을 권고합니다.
          </p>
        </div>
      )}

      {/* Quick Action: Dual EMR One-Click Copy */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md print:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
              Hospital EMR Integration
            </span>
            <h3 className="mt-1 font-bold text-sm">전자의무기록(EMR) 즉시 복사</h3>
            <p className="text-[11px] text-emerald-100">병원 차팅 프로그램에 바로 붙여넣기(Ctrl+V)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleCopyEMR('standard')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
              copiedFormat === 'standard'
                ? 'bg-white text-emerald-800 scale-95'
                : 'bg-white/95 hover:bg-white text-emerald-950 active:scale-95'
            }`}
          >
            {copiedFormat === 'standard' ? <Check size={14} /> : <Copy size={14} />}
            {copiedFormat === 'standard' ? '복사완료!' : '일반 EMR 양식'}
          </button>

          <button
            type="button"
            onClick={() => handleCopyEMR('soap')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
              copiedFormat === 'soap'
                ? 'bg-white text-teal-800 scale-95'
                : 'bg-white/95 hover:bg-white text-teal-950 active:scale-95'
            }`}
          >
            {copiedFormat === 'soap' ? <Check size={14} /> : <FileText size={14} />}
            {copiedFormat === 'soap' ? 'SOAP 복사완료!' : 'SOAP Note 양식'}
          </button>
        </div>
      </div>

      {/* Local LLM AI Clinical Assistant (Zero Cloud Data Leakage) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Bot size={18} />
            </span>
            <div>
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                로컬 LLM 임상 보조 AI
                <span className="text-[9px] bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 font-bold px-1.5 py-0.5 rounded">
                  온디바이스 프라이빗
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">외부 전송 없이 내 기기/로컬 서버 AI로 종합 소견 도출</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isGeneratingAi}
            onClick={() => handleGenerateAiAnalysis()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {isGeneratingAi ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Sparkles size={13} />
                AI 소견 생성
              </>
            )}
          </button>
        </div>

        {/* Persona Selection Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          <button
            type="button"
            disabled={isGeneratingAi}
            onClick={() => {
              triggerHaptic();
              setActivePersona('doctor');
            }}
            className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activePersona === 'doctor'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200/50 dark:border-purple-800/50'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Stethoscope size={13} className={activePersona === 'doctor' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'} />
            의사용 전문 임상 요약 (SOAP)
          </button>
          <button
            type="button"
            disabled={isGeneratingAi}
            onClick={() => {
              triggerHaptic();
              setActivePersona('patient');
            }}
            className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activePersona === 'patient'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200/50 dark:border-purple-800/50'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <User size={13} className={activePersona === 'patient' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'} />
            환자용 쉬운 소견 요약
          </button>
        </div>

        {aiError && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
            {aiError}
          </div>
        )}

        {aiAnalysis && (
          <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 text-xs text-slate-700 dark:text-slate-200 space-y-2 leading-relaxed animate-in fade-in">
            <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-900 pb-1.5">
              <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1">
                <Sparkles size={13} />
                {activePersona === 'doctor'
                  ? '로컬 AI 의사용 전문 임상 요약 (SOAP):'
                  : '로컬 AI 환자용 쉬운 소견 요약:'}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  navigator.clipboard.writeText(aiAnalysis);
                }}
                className="text-[10px] font-bold text-purple-700 dark:text-purple-300 underline"
              >
                소견 복사
              </button>
            </div>
            <p className="whitespace-pre-line text-xs">{aiAnalysis}</p>
          </div>
        )}
      </div>

      {/* Interactive Clinical Q&A Assistant ("로컬 AI에게 내 증상 물어보기") */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 p-4 shadow-sm space-y-3.5 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
              <MessageSquare size={17} />
            </span>
            <div>
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                로컬 AI에게 내 증상 물어보기
                <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold px-1.5 py-0.5 rounded-full">
                  100% 프라이빗 Q&A
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">내 통증 기록 기반 실시간 맞춤 상담 (외부 유출 0%)</p>
            </div>
          </div>
        </div>

        {/* Suggested Quick Questions */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            💡 자주 묻는 질문 (원터치 선택):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              '💊 복용 중인 약 효과가 떨어질 때 어떻게 하나요?',
              '🩺 의사 진료 시 꼭 전해야 할 핵심 포인트는?',
              '⚠️ 감지된 위험 징후(Red Flags) 대처법은?',
              '🏃‍♂️ 통증 부위에 좋은 스트레칭과 주의할 자세는?',
            ].map((suggested) => (
              <button
                key={suggested}
                type="button"
                disabled={isQaStreaming}
                onClick={() => handleSendQaMessage(suggested)}
                className="text-[11px] font-medium bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700/60 active:scale-95 transition-all text-left disabled:opacity-50"
              >
                {suggested}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Message History */}
        {qaMessages.length > 0 && (
          <div className="space-y-2.5 max-h-80 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            {qaMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-[9px] font-bold text-slate-400 mb-0.5 px-1">
                  {msg.role === 'user' ? '내 질문' : '🤖 로컬 AI 비서'}
                </span>
                <div
                  className={`p-3 rounded-2xl max-w-[90%] whitespace-pre-line leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                  }`}
                >
                  {msg.content || (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <RefreshCw size={12} className="animate-spin" /> 생각 중...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQaMessage(qaInput);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={qaInput}
            onChange={(e) => setQaInput(e.target.value)}
            disabled={isQaStreaming}
            placeholder="증상, 투약, 진료에 관해 궁금한 점을 물어보세요..."
            className="flex-1 px-3 py-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!qaInput.trim() || isQaStreaming}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
          >
            {isQaStreaming ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            전송
          </button>
        </form>
      </div>

      {/* Patient High-level Metric Badges */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400">관리 질환</span>
          <div className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">
            {briefing.patientSummary.activeConditionsCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400">총 기록 건수</span>
          <div className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
            {briefing.patientSummary.totalLogsRecorded}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400">추적 일수</span>
          <div className="mt-1 text-xl font-black text-blue-600 dark:text-blue-400">
            {briefing.patientSummary.daysTracked}일
          </div>
        </div>
      </div>

      {/* Condition Deep Dives with PQRST Details */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          진료 대상 질환 및 PQRST 임상 지표
        </h2>

        {briefing.conditionsSummary.map((item) => {
          const isImproving = item.trend === 'improving';
          const isWorsening = item.trend === 'worsening';

          return (
            <div
              key={item.condition.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                      {item.condition.label}
                    </h3>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full">
                      {item.condition.bodyPart}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    발병일: {item.condition.onsetDate || '미상'}
                  </p>
                </div>

                {/* Trend Badge */}
                <div
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    isImproving
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : isWorsening
                      ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isImproving ? (
                    <TrendingDown size={14} />
                  ) : isWorsening ? (
                    <TrendingUp size={14} />
                  ) : (
                    <Minus size={14} />
                  )}
                  <span>
                    {isImproving ? t('improved') : isWorsening ? t('worsened') : t('stable')}
                  </span>
                </div>
              </div>

              {/* NRS Pain Metrics Grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">최근 통증</span>
                  <span
                    className={`mt-0.5 block text-lg font-black ${
                      (item.recentIntensity ?? 0) >= 7
                        ? 'text-rose-500'
                        : (item.recentIntensity ?? 0) >= 4
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    }`}
                  >
                    {item.recentIntensity !== null ? `${item.recentIntensity}` : '-'}
                    <span className="text-[10px] font-normal text-slate-400">/10</span>
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">7일 평균</span>
                  <span className="mt-0.5 block text-lg font-black text-slate-700 dark:text-slate-200">
                    {item.avgIntensity7Days !== null ? `${item.avgIntensity7Days}` : '-'}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">30일 평균</span>
                  <span className="mt-0.5 block text-lg font-black text-slate-700 dark:text-slate-200">
                    {item.avgIntensity30Days !== null ? `${item.avgIntensity30Days}` : '-'}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">최고 통증</span>
                  <span className="mt-0.5 block text-lg font-black text-rose-600 dark:text-rose-400">
                    {item.peakIntensity !== null ? `${item.peakIntensity}` : '-'}
                  </span>
                </div>
              </div>

              {/* PQRST Clinical Descriptors Card */}
              {(item.painQualities.length > 0 ||
                item.radiations.length > 0 ||
                item.triggers.length > 0 ||
                item.reliefFactors.length > 0) && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">
                    PQRST 세부 임상 소견
                  </span>
                  {item.painQualities.length > 0 && (
                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-500">통증 양상:</strong>
                      <span>{item.painQualities.join(', ')}</span>
                    </div>
                  )}
                  {item.radiations.length > 0 && (
                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-500">방사통:</strong>
                      <span className="text-blue-600 dark:text-blue-400">{item.radiations.join(', ')}</span>
                    </div>
                  )}
                  {item.triggers.length > 0 && (
                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-500">악화 인자:</strong>
                      <span className="text-rose-600 dark:text-rose-400">{item.triggers.join(', ')}</span>
                    </div>
                  )}
                  {item.reliefFactors.length > 0 && (
                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-500">완화 인자:</strong>
                      <span className="text-teal-600 dark:text-teal-400">{item.reliefFactors.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Medication Adherence */}
              {item.frequentMedications.length > 0 && (
                <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <Pill size={13} className="text-blue-500" />
                      {t('frequentMeds')}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      투약 기록율: {item.medicationAdherenceRate}%
                    </span>
                  </div>
                  <p className="text-blue-800 dark:text-blue-200 font-medium">
                    {item.frequentMedications.join(' • ')}
                  </p>
                </div>
              )}

              {/* Recent 3 Log Entries */}
              {item.recentLogs.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    최근 관찰 타임라인
                  </span>
                  {item.recentLogs.slice(0, 3).map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-col gap-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5"
                    >
                      <div className="flex items-center justify-between">
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
                            <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-[140px]">
                              "{log.notes}"
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 ml-2">
                          NRS {log.intensity}
                        </span>
                      </div>

                      {/* Medication Response & Side Effect Badges in Timeline */}
                      {(log.postMedIntensity !== undefined || (log.postMedSideEffects && log.postMedSideEffects.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          {log.postMedIntensity !== undefined && (
                            <span className="text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                              복약 효과: NRS {log.intensity} → {log.postMedIntensity} (
                              {log.intensity > log.postMedIntensity
                                ? `${log.intensity - log.postMedIntensity}점 완화`
                                : log.intensity === log.postMedIntensity
                                ? '변화 없음'
                                : `${log.postMedIntensity - log.intensity}점 악화`}
                              )
                            </span>
                          )}
                          {log.postMedSideEffects && log.postMedSideEffects.length > 0 && (
                            <span className="text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                              부작용: {log.postMedSideEffects.join(', ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Medication Response & Efficacy Clinical Summary Card */}
      <section className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/30 dark:to-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm text-xs">
              <Pill size={15} />
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                복약 효과 및 부작용 임상 판정 요약 (Medication Response)
              </h2>
              <p className="text-[10px] text-slate-400">환자 자가 1-탭 재평가 기반 약효 및 유해반응 집계</p>
            </div>
          </div>
          {avgRelief !== null && (
            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              평균 {avgRelief}점 완화
            </span>
          )}
        </div>

        {evaluatedMedLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-1">
            아직 재평가된 복약 기록이 없습니다. 홈 화면의 '약효 확인' 카드를 통해 1-탭 평가를 진행할 수 있습니다.
          </p>
        ) : (
          <div className="space-y-2.5">
            {/* Side Effects Aggregation Badge */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300">보고된 부작용 징후:</span>
              {allSideEffects.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {allSideEffects.map((se) => (
                    <span
                      key={se}
                      className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-bold border border-rose-200 dark:border-rose-800"
                    >
                      ⚠️ {se}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                  ✓ 특이 부작용 보고 없음 (안전)
                </span>
              )}
            </div>

            {/* List of Evaluated Responses */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                최근 복약 반응 평가 내역 ({evaluatedMedLogs.length}건)
              </span>
              {evaluatedMedLogs.slice(0, 5).map((log) => {
                const cond = briefing.conditionsSummary.find((c) => c.condition.id === log.conditionId);
                const delta = log.postMedIntensity !== undefined ? log.intensity - log.postMedIntensity : null;
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-700 dark:text-blue-300">💊 {log.medication}</span>
                        {cond && <span className="text-[10px] text-slate-400">({cond.condition.label})</span>}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {format(new Date(log.date), 'MM/dd HH:mm')}
                        </span>
                      </div>
                      {log.postMedSideEffects && log.postMedSideEffects.length > 0 && (
                        <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                          부작용: {log.postMedSideEffects.join(', ')}
                        </div>
                      )}
                    </div>
                    {log.postMedIntensity !== undefined && (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs shrink-0 ml-2">
                        복약 효과: NRS {log.intensity} → {log.postMedIntensity} (
                        {delta !== null && delta > 0 ? `${delta}점 완화` : delta === 0 ? '변화 없음' : `${Math.abs(delta!)}점 악화`})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Topographical Body Map Distribution with Heatmap Badges */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          환부 집중 분포 (바디맵 기반 NRS 히트맵)
        </h2>
        <BodyMap readOnly intensityMap={bodyPartIntensityMap} />
      </section>

      {/* Privacy Notice */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 text-[11px]">
        <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
        <span>{t('privacyModeNotice')}</span>
      </div>
    </div>
  );
};

export default ClinicalBriefingPage;

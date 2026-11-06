import React, { useState } from 'react';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { Stethoscope, Copy, Check, TrendingDown, TrendingUp, Minus, Pill, ShieldCheck, Printer, Calendar, Activity } from 'lucide-react';
import BodyMap from '../components/BodyMap';
import { format } from 'date-fns';
import { triggerHaptic } from '../utils/native';

export const ClinicalBriefingPage: React.FC = () => {
  const { getClinicalBriefing, generateEMRSummaryText } = useHealth();
  const { t } = useSettings();
  const [copied, setCopied] = useState(false);

  const briefing = getClinicalBriefing();

  const handleCopyEMR = async () => {
    triggerHaptic();
    const text = generateEMRSummaryText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  if (briefing.conditionsSummary.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
          <Stethoscope size={32} />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-700 dark:text-slate-200">{t('briefingTitle')}</h2>
        <p className="mt-2 text-xs text-slate-500 max-w-xs">{t('noClinicalData')}</p>
      </div>
    );
  }

  // Map body part distribution for BodyMap heatmap
  const bodyPartIntensityMap: Record<string, number> = {};
  Object.entries(briefing.bodyPartDistribution).forEach(([part, stats]) => {
    bodyPartIntensityMap[part] = stats.maxIntensity;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Stethoscope size={20} />
            </span>
            <h1 className="text-xl font-bold">{t('briefingTitle')}</h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('briefingSubtitle')}</p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm print:hidden"
          title="진료 리포트 인쇄"
        >
          <Printer size={18} />
        </button>
      </header>

      {/* Quick Action: EMR One-Click Copy */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
              Medical Staff Quick Tool
            </span>
            <h3 className="mt-1 font-bold text-sm">의무기록(EMR) 요약 텍스트</h3>
            <p className="text-[11px] text-emerald-100">의사·간호사 차팅용 정형화된 요약 복사</p>
          </div>
          <button
            type="button"
            onClick={handleCopyEMR}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              copied
                ? 'bg-white text-emerald-700 scale-95'
                : 'bg-white/90 hover:bg-white text-emerald-900 active:scale-95'
            }`}
          >
            {copied ? (
              <>
                <Check size={14} />
                {t('copied')}
              </>
            ) : (
              <>
                <Copy size={14} />
                {t('copy')}
              </>
            )}
          </button>
        </div>
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

      {/* Condition Deep Dives */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {t('chiefComplaint')} (진료 대상 질환)
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

              {/* Recent 3 Log Entries (Clinical Observations) */}
              {item.recentLogs.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    최근 관찰 타임라인
                  </span>
                  {item.recentLogs.slice(0, 3).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-xs rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5"
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
                          <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-[140px]">
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
        })}
      </section>

      {/* Topographical Body Map Distribution */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {t('affectedDistribution')}
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

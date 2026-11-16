import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Minus,
  Flame,
  CalendarDays,
  Pill,
  FolderPlus,
  Activity,
  FileCheck2,
  BookOpen,
} from 'lucide-react';
import { useHealth } from '../context/HealthContext';
import { computeTreatmentMetrics } from '../utils/treatmentMetrics';
import { triggerHaptic } from '../utils/native';

export const StatsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { conditions, logs, diaryEntries, diagnosticRecords } = useHealth();

  const metrics = useMemo(
    () => computeTreatmentMetrics(conditions, logs, diaryEntries, diagnosticRecords),
    [conditions, logs, diaryEntries, diagnosticRecords]
  );

  const deltaLabel =
    metrics.overallPainDelta === null
      ? '-'
      : metrics.overallPainDelta < 0
      ? `${metrics.overallPainDelta}점 (${metrics.overallImprovementPct}% 개선)`
      : metrics.overallPainDelta > 0
      ? `+${metrics.overallPainDelta}점`
      : '유지 (0점)';

  return (
    <div
      className={
        embedded
          ? 'space-y-4'
          : 'min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-4'
      }
    >
      {!embedded && (
        <header className="flex items-center gap-2">
          <BarChart3 size={20} className="text-teal-600 dark:text-teal-400" />
          <h1 className="text-xl font-bold">앱 사용 · 치료 통계</h1>
        </header>
      )}

      {/* Unassigned Warning Signal inside Stats */}
      {metrics.unassignedCount > 0 && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold text-amber-900 dark:text-amber-200">
              미분류 증상 {metrics.unassignedCount}건이 통계에서 개별 질병으로 묶이지 않았습니다
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              질병으로 분류하면 치료 경과와 개선율이 더 정확하게 계산됩니다
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              navigate('/history?group=unassigned');
            }}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1"
          >
            <FolderPlus size={13} /> 분류하기
          </button>
        </div>
      )}

      {/* 1. Quantitative Treatment Outcomes */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" /> 질병 치료 · 통증 개선 지표
          </h2>
          <span className="text-[10px] font-bold text-slate-400">
            전체 질병 {metrics.totalConditions}개
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 p-3 text-center">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">
              치료 종료
            </span>
            <strong className="mt-0.5 block text-xl font-black text-emerald-700 dark:text-emerald-300">
              {metrics.archivedConditionsCount}개
            </strong>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 p-3 text-center">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
              개선된 질병
            </span>
            <strong className="mt-0.5 block text-xl font-black text-slate-800 dark:text-slate-100">
              {metrics.improvedConditionsCount}
              <span className="text-xs font-normal text-slate-400">
                /{metrics.comparableConditionsCount}
              </span>
            </strong>
          </div>

          <div className="rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-900/50 p-3 text-center">
            <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 block">
              평균 NRS
            </span>
            <strong className="mt-0.5 block text-xl font-black text-teal-700 dark:text-teal-300">
              {metrics.avgNrs || '-'}
            </strong>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            {metrics.overallPainDelta !== null && metrics.overallPainDelta < 0 ? (
              <TrendingDown size={15} className="text-emerald-500" />
            ) : metrics.overallPainDelta !== null && metrics.overallPainDelta > 0 ? (
              <TrendingUp size={15} className="text-rose-500" />
            ) : (
              <Minus size={15} className="text-slate-400" />
            )}
            초기 대비 최근 통증 변화
          </span>
          <span
            className={`font-extrabold ${
              metrics.overallPainDelta !== null && metrics.overallPainDelta < 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : metrics.overallPainDelta !== null && metrics.overallPainDelta > 0
                ? 'text-rose-500'
                : 'text-slate-500'
            }`}
          >
            {deltaLabel}
          </span>
        </div>
      </section>

      {/* 2. App Usage Statistics */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Activity size={14} className="text-cyan-600" /> 앱 사용 통계
        </h2>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center gap-2.5">
            <CalendarDays size={18} className="text-teal-600 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">기록 일수 · 총 건수</span>
              <strong className="text-sm font-black">
                {metrics.activeDaysCount}일 · {metrics.totalLogs}건
              </strong>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center gap-2.5">
            <Flame size={18} className="text-amber-500 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">연속 기록 (현재/최장)</span>
              <strong className="text-sm font-black">
                {metrics.currentStreakDays}일 / {metrics.longestStreakDays}일
              </strong>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center gap-2.5">
            <BookOpen size={18} className="text-emerald-500 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">건강 일기 작성</span>
              <strong className="text-sm font-black">{metrics.diaryDaysCount}일</strong>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center gap-2.5">
            <FileCheck2 size={18} className="text-indigo-500 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">보관 진단서 · 약효 평가</span>
              <strong className="text-sm font-black">
                {metrics.diagnosticsCount}건 · {metrics.medEvaluatedCount}회
              </strong>
            </div>
          </div>
        </div>

        {metrics.avgMedReliefDelta !== null && (
          <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 px-3.5 py-2.5 flex items-center justify-between text-xs">
            <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Pill size={14} className="text-blue-500" /> 복약 후 평균 통증 완화폭
            </span>
            <strong className="text-blue-700 dark:text-blue-300 font-black">
              {metrics.avgMedReliefDelta > 0
                ? `-${metrics.avgMedReliefDelta}점 감소`
                : `${metrics.avgMedReliefDelta}점`}
            </strong>
          </div>
        )}
      </section>

      {/* 3. Per-Condition Outcome Breakdown */}
      {metrics.conditionOutcomes.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2.5">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            질병별 통증 변화 (최초 → 최근)
          </h2>
          <div className="space-y-2">
            {metrics.conditionOutcomes.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  triggerHaptic();
                  navigate(`/condition/${item.id}`);
                }}
                className="cursor-pointer rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2.5 flex items-center justify-between text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold truncate">{item.label}</span>
                    {item.isArchived && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                        치료 종료
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {item.bodyPart} · {item.count}건
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-black text-slate-700 dark:text-slate-200">
                    {item.firstNrs} → {item.latestNrs}
                  </span>
                  <span
                    className={`block text-[10px] font-bold ${
                      item.delta < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : item.delta > 0
                        ? 'text-rose-500'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.delta < 0 ? `${item.delta}점 개선` : item.delta > 0 ? `+${item.delta}점` : '변화 없음'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Top Body Parts & Time-of-Day Distribution */}
      {metrics.totalLogs > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {metrics.topBodyParts.length > 0 && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2.5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                가장 자주 기록한 부위 Top {metrics.topBodyParts.length}
              </h2>
              <div className="space-y-2">
                {metrics.topBodyParts.map((item) => {
                  const pct = Math.round((item.count / metrics.totalLogs) * 100);
                  return (
                    <div key={item.part} className="space-y-1 text-xs">
                      <div className="flex justify-between font-bold">
                        <span>{item.part}</span>
                        <span className="text-slate-500">
                          {item.count}회 · 평균 NRS {item.avgNrs}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-teal-600 dark:bg-teal-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2.5">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              시간대별 증상 기록 분포
            </h2>
            <div className="space-y-2">
              {metrics.timeOfDayDist.map((slot) => (
                <div key={slot.id} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span>{slot.label}</span>
                    <span className="text-slate-500">
                      {slot.count}건 ({slot.pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-600 dark:bg-cyan-500"
                      style={{ width: `${slot.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default StatsPage;

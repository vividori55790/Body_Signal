import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Edit3,
  PlusCircle,
  X,
  Save,
  Pill,
  FileCheck2,
  Stethoscope,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';
import { calculateInsuranceClaimStatus } from '../utils/insurance';

export const ConditionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { conditions, logs, diagnosticRecords, updateCondition } = useHealth();
  const { t } = useSettings();

  const condition = conditions.find((c) => c.id === id);

  const conditionDiagnostics = useMemo(() => {
    return diagnosticRecords
      .filter((d) => d.conditionId === id)
      .sort((a, b) => b.diagnosisDate.localeCompare(a.diagnosisDate));
  }, [diagnosticRecords, id]);

  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editBodyPart, setEditBodyPart] = useState('');
  const [editError, setEditError] = useState('');
  const [showDoctorSummary, setShowDoctorSummary] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const conditionLogs = useMemo(() => {
    return logs
      .filter((l) => l.conditionId === id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, id]);

  const chartData = useMemo(() => {
    return [...conditionLogs].reverse().map((l) => ({
      date: format(new Date(l.date), 'M/d'),
      intensity: l.intensity,
      note: l.notes || '',
    }));
  }, [conditionLogs]);

  const doctorSummary = useMemo(() => {
    if (!condition) return null;
    const chrono = [...conditionLogs].reverse();
    const first = chrono[0] || null;
    const latest = chrono[chrono.length - 1] || null;
    const painDelta =
      first && latest && chrono.length >= 2 ? first.intensity - latest.intensity : null;
    const avgVal = conditionLogs.length
      ? Number(
          (conditionLogs.reduce((sum, l) => sum + l.intensity, 0) / conditionLogs.length).toFixed(1)
        )
      : 0;
    const maxVal = conditionLogs.length ? Math.max(...conditionLogs.map((l) => l.intensity)) : 0;
    const minVal = conditionLogs.length ? Math.min(...conditionLogs.map((l) => l.intensity)) : 0;

    const collectUnique = (pick: (l: (typeof conditionLogs)[number]) => string[] | undefined) =>
      Array.from(new Set(conditionLogs.flatMap((l) => pick(l) || []).filter(Boolean)));

    const qualities = collectUnique((l) => l.painQuality);
    const triggers = collectUnique((l) => l.triggers);
    const reliefFactors = collectUnique((l) => l.reliefFactors);
    const redFlags = collectUnique((l) => l.redFlags);
    const medications = Array.from(
      new Set(conditionLogs.map((l) => l.medication?.trim()).filter((m): m is string => Boolean(m)))
    );

    const medEvaluated = conditionLogs.filter(
      (l) => typeof l.postMedIntensity === 'number' && Boolean(l.medication?.trim())
    );
    const avgMedRelief =
      medEvaluated.length > 0
        ? Number(
            (
              medEvaluated.reduce(
                (sum, l) => sum + (l.intensity - (l.postMedIntensity ?? l.intensity)),
                0
              ) / medEvaluated.length
            ).toFixed(1)
          )
        : null;

    const lines = [
      `[진료 요약] ${condition.label} (${condition.bodyPart})`,
      `- 상태: ${condition.isArchived ? '치료 완료/보관' : '추적 관리 중'} · 발병일: ${condition.onsetDate}`,
      conditionLogs.length > 0
        ? `- 총 ${conditionLogs.length}회 기록 | 평균 NRS ${avgVal} (최저 ${minVal} / 최고 ${maxVal})`
        : '- 아직 통증 기록이 없습니다.',
      first && latest
        ? `- 통증 변화: 최초 ${first.intensity}/10 (${format(new Date(first.date), 'yyyy.M.d')}) → 최근 ${latest.intensity}/10 (${format(new Date(latest.date), 'yyyy.M.d')})${
            painDelta !== null
              ? painDelta > 0
                ? ` (${painDelta}점 완화)`
                : painDelta < 0
                ? ` (${Math.abs(painDelta)}점 상승)`
                : ' (변동 없음)'
              : ''
          }`
        : '',
      qualities.length ? `- 통증 양상: ${qualities.join(', ')}` : '',
      triggers.length ? `- 악화/유발 요인: ${triggers.join(', ')}` : '',
      reliefFactors.length ? `- 완화 요인: ${reliefFactors.join(', ')}` : '',
      redFlags.length ? `- 주의(적신호) 증상: ${redFlags.join(', ')}` : '',
      medications.length
        ? `- 복용/처치 약물: ${medications.join(', ')}${
            avgMedRelief !== null ? ` (복약 후 평균 NRS ${avgMedRelief > 0 ? `-${avgMedRelief}` : avgMedRelief})` : ''
          }`
        : '',
      conditionDiagnostics.length
        ? `- 관련 진단 기록: ${conditionDiagnostics
            .map((d) => `${d.diagnosisDate} ${d.hospitalName} (${d.diagnosisName})`)
            .join(' / ')}`
        : '',
    ].filter(Boolean);

    return {
      first,
      latest,
      painDelta,
      avgVal,
      maxVal,
      minVal,
      qualities,
      triggers,
      reliefFactors,
      redFlags,
      medications,
      avgMedRelief,
      plainText: lines.join('\n'),
    };
  }, [condition, conditionLogs, conditionDiagnostics]);

  if (!condition) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-500">
        <p>{t('conditionNotFound')}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 text-emerald-600 font-bold text-sm"
        >
          {t('goHome')}
        </button>
      </div>
    );
  }

  const lastLog = conditionLogs[0];
  const avgIntensity = conditionLogs.length
    ? (conditionLogs.reduce((a, b) => a + b.intensity, 0) / conditionLogs.length).toFixed(1)
    : '0';

  const handleSaveEdit = async () => {
    if (!editLabel.trim() || !editBodyPart.trim()) {
      setEditError(t('fillAllConditionFields'));
      return;
    }
    triggerHaptic();
    const success = await updateCondition(condition.id, {
      label: editLabel.trim(),
      bodyPart: editBodyPart.trim(),
    });
    if (success) {
      setIsEditing(false);
      setEditError('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="p-1 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="text-center">
          <h1 className="font-bold text-base">{condition.label}</h1>
          <p className="text-[11px] font-medium text-slate-400 uppercase">{condition.bodyPart}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setShowDoctorSummary((prev) => !prev);
            }}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold border transition-all ${
              showDoctorSummary
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-teal-600 dark:border-teal-500'
                : 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100'
            }`}
          >
            <Stethoscope size={14} />
            의료진 요약
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setEditLabel(condition.label);
              setEditBodyPart(condition.bodyPart);
              setIsEditing(true);
            }}
            className="p-1.5 text-slate-400 hover:text-emerald-500"
            aria-label="질병 정보 수정"
          >
            <Edit3 size={18} />
          </button>
        </div>
      </header>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">{t('editConditionInfo')}</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase">{t('conditionLabel')}</label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase">{t('bodyPart')}</label>
                <input
                  type="text"
                  value={editBodyPart}
                  onChange={(e) => setEditBodyPart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-bold"
                />
              </div>
              {editError && <p className="text-rose-500 font-bold">{editError}</p>}
            </div>

            <button
              type="button"
              onClick={handleSaveEdit}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Save size={14} /> {t('save')}
            </button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-5">
        {showDoctorSummary && doctorSummary && (
          <section
            aria-label="의료진 제시용 질병 요약"
            className="rounded-3xl bg-slate-900 text-white p-5 shadow-lg border border-slate-700 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-700/80 pb-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-teal-300">
                  <Stethoscope size={14} />
                  의료진 제시용 진료 요약 (Doctor View)
                </div>
                <h2 className="text-xl font-extrabold mt-1">
                  {condition.label}{' '}
                  <span className="text-sm font-semibold text-slate-300">· {condition.bodyPart}</span>
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  발병/시작일 {condition.onsetDate} ·{' '}
                  {condition.isArchived ? '치료 완료/보관' : '추적 관리 중'} · 총 {conditionLogs.length}회 기록
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic();
                  try {
                    await navigator.clipboard.writeText(doctorSummary.plainText);
                    setCopiedSummary(true);
                    setTimeout(() => setCopiedSummary(false), 2000);
                  } catch {
                    setCopiedSummary(false);
                  }
                }}
                className="shrink-0 flex items-center gap-1 rounded-xl bg-teal-600 hover:bg-teal-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
              >
                {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
                {copiedSummary ? '복사됨' : '요약 복사'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-800/90 p-3">
                <div className="text-[11px] text-slate-400">최초 → 최근</div>
                <div className="text-base font-extrabold mt-0.5 tabular-nums">
                  {doctorSummary.first && doctorSummary.latest
                    ? `${doctorSummary.first.intensity} → ${doctorSummary.latest.intensity}`
                    : '-'}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-800/90 p-3">
                <div className="text-[11px] text-slate-400">통증 변화</div>
                <div
                  className={`text-base font-extrabold mt-0.5 tabular-nums ${
                    doctorSummary.painDelta === null
                      ? 'text-slate-300'
                      : doctorSummary.painDelta > 0
                      ? 'text-emerald-400'
                      : doctorSummary.painDelta < 0
                      ? 'text-rose-400'
                      : 'text-slate-200'
                  }`}
                >
                  {doctorSummary.painDelta === null
                    ? '단일 기록'
                    : doctorSummary.painDelta > 0
                    ? `-${doctorSummary.painDelta} 완화`
                    : doctorSummary.painDelta < 0
                    ? `+${Math.abs(doctorSummary.painDelta)} 악화`
                    : '변동 없음'}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-800/90 p-3">
                <div className="text-[11px] text-slate-400">평균 / 최고</div>
                <div className="text-base font-extrabold mt-0.5 tabular-nums">
                  {doctorSummary.avgVal} / {doctorSummary.maxVal}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-200">
              {doctorSummary.redFlags.length > 0 && (
                <div className="flex items-start gap-2 rounded-2xl bg-rose-950/70 border border-rose-700/60 p-3 text-rose-100">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <span className="font-bold">주의(적신호) 증상: </span>
                    {doctorSummary.redFlags.join(', ')}
                  </div>
                </div>
              )}
              {doctorSummary.qualities.length > 0 && (
                <div>
                  <span className="font-bold text-slate-400">통증 양상: </span>
                  {doctorSummary.qualities.join(', ')}
                </div>
              )}
              {doctorSummary.triggers.length > 0 && (
                <div>
                  <span className="font-bold text-slate-400">유발/악화 요인: </span>
                  {doctorSummary.triggers.join(', ')}
                </div>
              )}
              {doctorSummary.reliefFactors.length > 0 && (
                <div>
                  <span className="font-bold text-slate-400">완화 요인: </span>
                  {doctorSummary.reliefFactors.join(', ')}
                </div>
              )}
              {doctorSummary.medications.length > 0 && (
                <div>
                  <span className="font-bold text-slate-400">복용 약물/처치: </span>
                  {doctorSummary.medications.join(', ')}
                  {doctorSummary.avgMedRelief !== null && (
                    <span className="ml-1.5 text-teal-300 font-semibold">
                      (복약 후 평균 NRS {doctorSummary.avgMedRelief > 0 ? `-${doctorSummary.avgMedRelief}` : doctorSummary.avgMedRelief})
                    </span>
                  )}
                </div>
              )}
              {conditionDiagnostics.length > 0 && (
                <div>
                  <span className="font-bold text-slate-400">연결된 진단: </span>
                  {conditionDiagnostics
                    .map((d) => `${d.diagnosisDate} ${d.hospitalName} (${d.diagnosisName})`)
                    .join(' / ')}
                </div>
              )}
              {conditionLogs.length > 0 && (
                <div className="pt-1 border-t border-slate-800">
                  <div className="font-bold text-slate-400 mb-1">최근 경과 메모</div>
                  <ul className="space-y-1">
                    {conditionLogs.slice(0, 3).map((l) => (
                      <li key={l.id} className="text-[11px] text-slate-300">
                        • {format(new Date(l.date), 'M/d HH:mm')} — NRS {l.intensity}/10
                        {l.medication ? ` · ${l.medication}` : ''}
                        {l.notes ? ` · "${l.notes}"` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">{t('currentPainLevel')}</span>
            <div
              className={`mt-1 text-3xl font-black ${
                (lastLog?.intensity ?? 0) >= 8
                  ? 'text-rose-500'
                  : (lastLog?.intensity ?? 0) >= 5
                  ? 'text-amber-500'
                  : 'text-emerald-500'
              }`}
            >
              {lastLog ? lastLog.intensity : '-'}
              <span className="text-xs font-normal text-slate-400">/10</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">{t('cumulativeAvgPain')}</span>
            <div className="mt-1 text-3xl font-black text-slate-700 dark:text-slate-200">
              {avgIntensity}
            </div>
          </div>
        </div>

        {/* 30-Day Line Chart */}
        {chartData.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Activity size={16} className="text-emerald-500" />
                {t('painTrendChart')}
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold">
                최근 30일
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={20} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      backgroundColor: '#1e293b',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="intensity"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-400">
            표시할 통증 기록이 없습니다.
          </div>
        )}

        {/* Quick Log Action & Logs List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">{t('logHistoryTitle')}</h3>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                navigate('/entry', { state: { selectedConditionId: condition.id } });
              }}
              className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm active:scale-95"
            >
              <PlusCircle size={14} /> {t('quickLog')}
            </button>
          </div>

          <div className="space-y-2">
            {conditionLogs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center justify-between"
              >
                <div className="flex-1 mr-3 space-y-1">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {format(new Date(log.date), 'yyyy-MM-dd a h:mm')}
                  </div>
                  {log.medication && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      <Pill size={12} /> {log.medication}
                    </div>
                  )}
                  {log.reliefFactors && log.reliefFactors.length > 0 && (
                    <div className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                      완화/자관리: {log.reliefFactors.join(', ')}
                    </div>
                  )}
                  {log.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{log.notes}"</p>
                  )}
                </div>

                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl font-black text-lg shrink-0 ${
                    log.intensity >= 8
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                      : log.intensity >= 5
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                  }`}
                >
                  {log.intensity}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Linked Diagnostic & Insurance Records */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileCheck2 size={15} className="text-teal-600" /> 연결된 진료·진단서 ({conditionDiagnostics.length}건)
            </h3>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                navigate('/diagnostics', { state: { conditionId: condition.id } });
              }}
              className="text-xs font-bold text-teal-600 dark:text-teal-400"
            >
              + 진단서 추가
            </button>
          </div>

          {conditionDiagnostics.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center text-xs text-slate-400">
              이 질병에 연결된 진료·진단서 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {conditionDiagnostics.map((rec) => {
                const info = calculateInsuranceClaimStatus(rec.diagnosisDate, rec.claimStatus, rec.claimDeadlineYears || 3);
                return (
                  <div
                    key={rec.id}
                    onClick={() => navigate('/diagnostics')}
                    className="cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-xs">{rec.diagnosisName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {rec.diagnosisDate} {rec.hospitalName ? `· ${rec.hospitalName}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {info.badgeText}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConditionDetailPage;

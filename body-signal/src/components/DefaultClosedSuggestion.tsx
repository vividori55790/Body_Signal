import React from 'react';

interface DefaultClosedSuggestionProps {
  featureName: string;
  onConfirmDefaultClosed: () => void;
  onKeepOpen: () => void;
}

/**
 * Shared prompt shown when a user repeatedly collapses a default-open helper
 * (e.g. QuickPainLogger or BodyMap) without using it.
 */
export const DefaultClosedSuggestion: React.FC<DefaultClosedSuggestionProps> = ({
  featureName,
  onConfirmDefaultClosed,
  onKeepOpen,
}) => {
  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/90 dark:bg-teal-950/40 px-3 py-2.5 text-xs space-y-2 animate-in fade-in">
      <p className="font-bold text-teal-900 dark:text-teal-200 leading-snug">
        {featureName}을(를) 사용하지 않고 계속 닫으셨어요. 다음부터 기본 상태를 &lsquo;닫힘&rsquo;으로 설정할까요?
      </p>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onKeepOpen}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-600 dark:text-slate-300"
        >
          열림 유지
        </button>
        <button
          type="button"
          onClick={onConfirmDefaultClosed}
          className="px-3 py-1 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-[11px] font-bold"
        >
          기본 닫기로 설정
        </button>
      </div>
    </div>
  );
};

export default DefaultClosedSuggestion;

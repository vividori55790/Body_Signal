import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Pill, X, Check } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';
import { formatMedicationPreset, validateMedicationInput } from '../utils/medication';

export interface AddMedicationInlineProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (formattedMedName: string) => void;
  placeholder?: string;
}

export const AddMedicationInline: React.FC<AddMedicationInlineProps> = ({
  isOpen,
  onClose,
  onAdded,
  placeholder,
}) => {
  const { settings, addMedicationPreset } = useSettings();
  const isEn = settings.language === 'en';
  const resolvedPlaceholder =
    placeholder || (isEn ? 'Medication name (e.g., Ibuprofen, Tylenol)' : '약 이름 (예: 타이레놀, 세레브렉스)');
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic();
    setName('');
    setDosage('');
    setError(null);
    onClose();
  };

  const handleAdd = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    triggerHaptic();

    const validation = validateMedicationInput(name, dosage, settings.language);
    if (!validation.valid) {
      setError(
        validation.error || (isEn ? 'Please check the medication name.' : '약 이름을 확인해 주세요.')
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const preset = await addMedicationPreset(validation.cleanName!, validation.cleanDosage);
      if (preset) {
        const formatted = formatMedicationPreset(preset, settings.language);
        setName('');
        setDosage('');
        setError(null);
        onAdded(formatted);
      } else {
        setError(isEn ? 'Failed to add medication.' : '약 추가에 실패했습니다.');
      }
    } catch {
      setError(isEn ? 'An error occurred while saving.' : '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Portal outside any enclosing form element so Enter/Add never submits parent EntryForm
  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleAdd();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            handleCancel();
          }
        }}
      >
        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <Pill size={18} />
            </span>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {isEn ? 'Add Medication Preset' : '새 복용 약 등록'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-95"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              {isEn ? 'Medication Name' : '약 이름'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              maxLength={80}
              placeholder={resolvedPlaceholder}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className="w-full min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              {isEn ? 'Dosage / Unit (Optional)' : '용량 / 규격 (선택)'}
            </label>
            <input
              type="text"
              maxLength={40}
              placeholder={isEn ? 'e.g., 500mg, 1 tablet' : '예: 500mg, 1정, 1포'}
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-[11px] font-bold text-rose-500 animate-in fade-in">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full min-h-[44px] py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all"
            >
              {isEn ? 'Cancel' : '취소'}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleAdd}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Check size={16} /> {isEn ? 'Add & Select' : '추가 및 선택'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modal, document.body);
  }
  return modal;
};

export default AddMedicationInline;

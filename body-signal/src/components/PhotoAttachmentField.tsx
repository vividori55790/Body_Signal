import React, { useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { compressAndStripExif } from '../utils/mediaStorage';
import { getErrorMessage } from '../utils/errors';

const PHOTO_PROCESS_BATCH_SIZE = 4;

export interface PhotoAttachmentFieldProps {
  photos: string[];
  onChange: (nextPhotos: string[]) => void;
  onError?: (message: string) => void;
  maxPhotos?: number;
  processFile?: (file: File) => Promise<string>;
}

export const PhotoAttachmentField: React.FC<PhotoAttachmentFieldProps> = ({
  photos,
  onChange,
  onError,
  maxPhotos = 50,
  processFile = compressAndStripExif,
}) => {
  const { beginExternalPickerGrace } = useAuth();
  const { resolvedLanguage } = useSettings();
  const isEn = resolvedLanguage === 'en';
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    onError?.('');

    const remaining = Math.max(0, maxPhotos - photos.length);
    if (remaining === 0) {
      onError?.(
        isEn
          ? `Up to ${maxPhotos} photos can be attached per record.`
          : `한 기록당 최대 ${maxPhotos}장까지 첨부할 수 있습니다.`
      );
      e.target.value = '';
      return;
    }

    const filesToProcess = files.slice(0, remaining);
    const truncated = files.length > remaining;
    setProgress({ done: 0, total: filesToProcess.length });

    try {
      const processed: string[] = [];
      for (let i = 0; i < filesToProcess.length; i += PHOTO_PROCESS_BATCH_SIZE) {
        const chunk = filesToProcess.slice(i, i + PHOTO_PROCESS_BATCH_SIZE);
        const chunkResults = await Promise.all(chunk.map((f) => processFile(f)));
        processed.push(...chunkResults);
        setProgress({
          done: Math.min(filesToProcess.length, processed.length),
          total: filesToProcess.length,
        });
      }

      onChange([...photos, ...processed].slice(0, maxPhotos));
      if (truncated) {
        onError?.(
          isEn
            ? `Max ${maxPhotos} photos allowed. Added first ${processed.length}.`
            : `최대 ${maxPhotos}장까지 첨부 가능해 앞 ${processed.length}장만 추가되었습니다.`
        );
      }
    } catch (err: unknown) {
      onError?.(getErrorMessage(err, isEn ? 'Failed to process photos.' : '사진을 처리할 수 없습니다.'));
    } finally {
      setProgress(null);
      e.target.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[10px] font-bold text-slate-400 uppercase">
          {isEn
            ? `Attach Photos (EXIF Stripped, AES-256 Encrypted, max ${maxPhotos})`
            : `진단서·영수증 사진 첨부 (EXIF 제거 후 AES-256 암호화, 최대 ${maxPhotos}장)`}
        </label>
        <span className="text-[10px] font-extrabold text-teal-600 dark:text-teal-400 tabular-nums">
          {photos.length}/{maxPhotos}
        </span>
      </div>
      <div className="flex gap-2">
        <label className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
          <Camera size={15} /> {isEn ? 'Camera' : '카메라 촬영'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={Boolean(progress)}
            onClick={() => beginExternalPickerGrace()}
            onChange={handlePhotoFiles}
            className="hidden"
          />
        </label>
        <label className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
          <ImageIcon size={15} /> {isEn ? 'Gallery' : '앨범 선택'}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={Boolean(progress)}
            onClick={() => beginExternalPickerGrace()}
            onChange={handlePhotoFiles}
            className="hidden"
          />
        </label>
      </div>
      {progress && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-teal-600 dark:text-teal-400">
          <Loader2 size={13} className="animate-spin" />
          <span>
            {isEn
              ? `Processing photos (${progress.done}/${progress.total})...`
              : `사진 최적화·EXIF 제거 중 (${progress.done}/${progress.total})...`}
          </span>
        </div>
      )}
      {photos.length > 0 && (
        <div
          className={
            photos.length > 5
              ? 'grid grid-cols-5 gap-1.5 mt-2 max-h-48 overflow-y-auto pr-0.5'
              : 'flex gap-2 mt-2 overflow-x-auto'
          }
        >
          {photos.map((src, idx) => (
            <div
              key={idx}
              className={`relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 ${
                photos.length > 5 ? 'aspect-square w-full' : 'h-16 w-16 shrink-0'
              }`}
            >
              <img src={src} alt={isEn ? 'Preview' : '미리보기'} className="w-full h-full object-cover" />
              {photos.length > 6 && (
                <span className="absolute bottom-0.5 left-0.5 rounded bg-slate-900/75 px-1 text-[9px] font-bold text-white tabular-nums">
                  {idx + 1}
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, i) => i !== idx))}
                aria-label={isEn ? 'Remove photo' : '사진 제거'}
                className="absolute top-0.5 right-0.5 rounded-full bg-slate-900/80 text-white p-0.5"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoAttachmentField;

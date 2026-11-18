import React from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { compressAndStripExif } from '../utils/mediaStorage';

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
  maxPhotos = 6,
  processFile = compressAndStripExif,
}) => {
  const { beginExternalPickerGrace } = useAuth();
  const { settings } = useSettings();
  const isEn = settings.language === 'en';

  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    onError?.('');
    try {
      const processed = await Promise.all(files.map((f) => processFile(f)));
      onChange([...photos, ...processed].slice(0, maxPhotos));
    } catch (err: any) {
      onError?.(err?.message || (isEn ? 'Failed to process photos.' : '사진을 처리할 수 없습니다.'));
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
        {isEn
          ? `Attach Photos (EXIF Stripped, AES-256 Encrypted, max ${maxPhotos})`
          : `진단서·영수증 사진 첨부 (EXIF 제거 후 AES-256 암호화, 최대 ${maxPhotos}장)`}
      </label>
      <div className="flex gap-2">
        <label className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
          <Camera size={15} /> {isEn ? 'Camera' : '카메라 촬영'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
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
            onClick={() => beginExternalPickerGrace()}
            onChange={handlePhotoFiles}
            className="hidden"
          />
        </label>
      </div>
      {photos.length > 0 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {photos.map((src, idx) => (
            <div
              key={idx}
              className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <img src={src} alt={isEn ? 'Preview' : '미리보기'} className="w-full h-full object-cover" />
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

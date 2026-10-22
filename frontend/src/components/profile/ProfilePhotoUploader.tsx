import { useRef, useState, type DragEvent } from 'react';
import { Camera, Check, Trash2, UploadCloud, X } from 'lucide-react';
import { useCopy } from '../../lib/i18n';
import { usePublicSettings } from '../../hooks/usePublicSettings';
import { Modal } from '../ui/Modal';
import { dangerButton, primaryButton, secondaryButton } from '../ui/formStyles';
import { Spinner } from '../layout/Loading';
import { ProfileAvatar } from './ProfileAvatar';

export function ProfilePhotoUploader({
  photoId,
  value,
  onChange,
  disabled = false,
  name,
}: {
  photoId?: string | null;
  value?: string | null;
  onChange: (photo: string | null) => void;
  disabled?: boolean;
  name: string;
}) {
  const c = useCopy();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <span className="block text-sm font-semibold">{c('Profile Photo')}</span>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <ProfileAvatar photoId={value === undefined ? photoId : null} source={value} name={name} />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen(true)}
              className={secondaryButton}
            >
              <Camera aria-hidden="true" className="h-4 w-4" />
              {c('Choose Photo')}
            </button>
            {(value || (value === undefined && photoId)) && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(null)}
                className={dangerButton}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {c('Remove')}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {c('JPEG, PNG or WebP. Photos are reviewed by an administrator.')}
          </p>
        </div>
      </div>
      {open && (
        <PhotoUploadModal
          onClose={() => setOpen(false)}
          onUpload={(photo) => {
            onChange(photo);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PhotoUploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: (photo: string) => void;
}) {
  const c = useCopy();
  const settings = usePublicSettings();
  const maxBytes = settings.data?.profilePhotoMaxBytes ?? 2_000_000;
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number; source: string }>();
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  async function choose(selected?: File) {
    if (!selected || reading) return;
    setError(undefined);
    setFile(undefined);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      setError('Choose a JPEG, PNG, or WebP photo');
      return;
    }
    if (selected.size > maxBytes) {
      setError('The photo is too large');
      return;
    }
    setReading(true);
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener(
          'load',
          () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error())),
          { once: true },
        );
        reader.addEventListener('error', () => reject(new Error()), { once: true });
        reader.readAsDataURL(selected);
      });
      const preview = new window.Image();
      preview.src = source;
      await preview.decode();
      setFile({ name: selected.name, size: selected.size, source });
    } catch {
      setError('The photo could not be loaded.');
    } finally {
      setReading(false);
      if (input.current) input.current.value = '';
    }
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void choose(event.dataTransfer.files[0]);
  }
  return (
    <Modal
      title={c('Profile Photo Uploader')}
      icon={UploadCloud}
      onClose={onClose}
      busy={reading}
      footer={
        <>
          <button type="button" disabled={reading} onClick={onClose} className={secondaryButton}>
            <X aria-hidden="true" className="h-4 w-4" />
            {c('Cancel')}
          </button>
          <button
            type="button"
            disabled={reading || !file}
            onClick={() => {
              setFile(undefined);
              setError(undefined);
            }}
            className={dangerButton}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {c('Clear')}
          </button>
          <button
            type="button"
            disabled={reading || !file}
            onClick={() => {
              if (file) onUpload(file.source);
            }}
            className={primaryButton}
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            {c('Use Photo')}
          </button>
        </>
      }
    >
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label={c('Choose Profile Photo')}
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={reading}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'profile-photo-upload-error' : undefined}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={`flex min-h-64 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${error ? 'border-rose-500 bg-rose-50 dark:border-rose-400 dark:bg-rose-950/20' : dragging ? 'border-teal-500 bg-teal-100 dark:bg-teal-900/40' : 'border-teal-300 bg-teal-50/40 hover:bg-teal-50 dark:border-teal-500/50 dark:bg-teal-950/20 dark:hover:bg-teal-900/30'}`}
      >
        {reading ? (
          <Spinner className="h-12 w-12 text-teal-600" />
        ) : (
          <UploadCloud aria-hidden="true" className="h-14 w-14 text-teal-600 dark:text-teal-300" />
        )}
        <span className="font-display text-lg font-bold">{c('Select a Photo to Upload')}</span>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {c('Drag and drop a photo here, or click to browse.')}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {c('JPEG, PNG or WebP · Maximum {{size}} MB', { size: maxBytes / 1_000_000 })}
        </span>
      </button>
      {error && (
        <p
          id="profile-photo-upload-error"
          role="alert"
          className="text-sm text-rose-700 dark:text-rose-300"
        >
          {c(error)}
        </p>
      )}
      {file && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <img
            src={file.source}
            alt={c('Selected Profile Photo')}
            className="h-20 w-20 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{c('File Name')}</p>
            <p className="mt-1 break-all text-sm font-semibold">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {c('{{size}} MB', { size: (file.size / 1_000_000).toFixed(2) })}
            </p>
          </div>
          <button type="button" onClick={() => setFile(undefined)} className={dangerButton}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {c('Remove')}
          </button>
        </div>
      )}
    </Modal>
  );
}

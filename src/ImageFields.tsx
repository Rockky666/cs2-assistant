import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Plus, X } from 'lucide-react';
import type { Shot } from './model';
import { useI18n } from './i18n';
import { ShotVisual } from './components';

export async function readImage(file: File): Promise<Shot> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('ERR_IMAGE_TYPE');
  if (file.size > 8 * 1024 * 1024) throw new Error('ERR_IMAGE_SIZE');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('ERR_IMAGE_READ'));
    reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('ERR_IMAGE_READ'));
    img.src = data;
  });
  return { id: crypto.randomUUID(), name: file.name, data };
}
type IO = { busy: (reading: boolean) => void; error: (error: unknown) => void };
export function ImageSlot({
  shot,
  label,
  caption,
  onChange,
  busy,
  error,
}: IO & {
  shot: Shot | null;
  label: string;
  caption?: string;
  onChange: (shot: Shot | null) => void;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file) return;
    busy(true);
    try {
      onChange(await readImage(file));
    } catch (err) {
      error(err);
    } finally {
      busy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div className="image-slot">
      <div className="slot-label">{label}</div>
      <input
        ref={input}
        type="file"
        className="visually-hidden"
        accept="image/png,image/jpeg,image/webp"
        aria-label={`${t('selectShots')}: ${label}`}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {shot ? (
        <div className="shot-tile">
          <ShotVisual data={shot.data} title={shot.name} caption={caption} />
          <div className="shot-toolbar">
            <button type="button" className="text-button" onClick={() => input.current?.click()}>
              {t('replaceShot')}
            </button>
            <button
              type="button"
              className="icon-button push"
              onClick={() => onChange(null)}
              aria-label={`${t('remove')} ${label}`}
            >
              <X size={17} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="upload-tile"
          onClick={() => input.current?.click()}
          aria-label={`${t('addShots')}: ${label}`}
        >
          <Plus size={24} />
          <span>{t('addShots')}</span>
        </button>
      )}
    </div>
  );
}
export function ImageGalleryEditor({
  images,
  utility,
  throwType,
  onChange,
  busy,
  error,
}: IO & {
  images: Shot[];
  utility: boolean;
  throwType: string;
  onChange: (images: Shot[]) => void;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const labels = [t('standing'), t('aiming'), t('result')];
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    busy(true);
    try {
      if (files.length + images.length > 30) throw new Error('ERR_IMAGES_LIMIT');
      onChange([...images, ...(await Promise.all(Array.from(files).map(readImage)))]);
    } catch (err) {
      error(err);
    } finally {
      setReading(false);
      busy(false);
      if (input.current) input.current.value = '';
    }
  }
  function move(index: number, shift: number) {
    const next = [...images];
    [next[index], next[index + shift]] = [next[index + shift], next[index]];
    onChange(next);
  }
  return (
    <>
      <p className="muted">{t(utility ? 'shotsOrder' : 'shotsHint')}</p>
      <input
        className="visually-hidden"
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(e) => void upload(e.target.files)}
        aria-label={t('selectShots')}
      />
      <div className="upload-grid">
        {images.map((shot, index) => (
          <div className="shot-tile" key={shot.id}>
            <ShotVisual
              data={shot.data}
              title={shot.name}
              caption={utility && index === 1 ? throwType : undefined}
            />
            <div className="shot-toolbar">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <button
                type="button"
                disabled={index === 0}
                className="icon-button"
                onClick={() => move(index, -1)}
                aria-label={`${t('screenshot', { number: index + 1 })}: ${t('earlier')}`}
              >
                <ArrowLeft size={15} />
              </button>
              <button
                type="button"
                disabled={index === images.length - 1}
                className="icon-button"
                onClick={() => move(index, 1)}
                aria-label={`${t('screenshot', { number: index + 1 })}: ${t('later')}`}
              >
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => onChange(images.filter((s) => s.id !== shot.id))}
                aria-label={`${t('remove')} ${t('screenshot', { number: index + 1 })}`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="shot-caption">{utility && index < 3 ? labels[index] : shot.name}</div>
          </div>
        ))}
        {Array.from({ length: Math.max(0, 3 - images.length) }, (_, i) => (
          <button
            type="button"
            className="upload-tile"
            key={i}
            onClick={() => input.current?.click()}
          >
            <Plus size={25} />
            <span>
              {utility
                ? labels[images.length + i]
                : t('screenshot', { number: images.length + i + 1 })}
            </span>
          </button>
        ))}
      </div>
      <div className="upload-footer">
        <button
          type="button"
          className="text-button"
          disabled={images.length >= 30}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={17} />
          {t(reading ? 'reading' : 'addShots')}
        </button>
        <span className="muted">{t('imageLimits')}</span>
      </div>
    </>
  );
}

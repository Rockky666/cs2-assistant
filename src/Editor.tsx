import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Plus, Save, X } from 'lucide-react';
import { categories, defaultThrows, entrySchema, type Entry, type Shot } from './model';
import { Markdown } from './components';

type Props = {
  entry: Entry;
  customThrows: string[];
  save: (entry: Entry, customThrows: string[]) => Promise<void>;
  cancel: () => void;
  dirty: () => void;
};
const imageLabels = ['Где стоять', 'Куда целиться', 'Результат броска'];
async function readImage(file: File): Promise<Shot> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Добавляйте PNG, JPG или WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error(`«${file.name}» больше 8 МБ.`);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`«${file.name}» не является корректным изображением`));
    image.src = data;
  });
  return { id: crypto.randomUUID(), name: file.name, data };
}
export default function Editor({ entry, customThrows, save, cancel, dirty }: Props) {
  const [draft, setDraft] = useState(entry);
  const [throws, setThrows] = useState(customThrows);
  const [custom, setCustom] = useState('');
  const [addingThrow, setAddingThrow] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const category = categories.find((c) => c.id === draft.categoryId)!;
  function update<K extends keyof Entry>(key: K, value: Entry[K]) {
    dirty();
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setReading(true);
    try {
      if (files.length + draft.images.length > 30)
        throw new Error('В одном материале может быть до 30 скриншотов.');
      const shots = await Promise.all(Array.from(files).map(readImage));
      update('images', [...draft.images, ...shots]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  function move(index: number, shift: number) {
    const images = [...draft.images];
    [images[index], images[index + shift]] = [images[index + shift], images[index]];
    update('images', images);
  }
  function addThrow() {
    const value = custom.trim();
    if (!value) return;
    if (!defaultThrows.includes(value) && !throws.includes(value)) {
      if (throws.length >= 100) {
        setError('Можно добавить до 100 своих способов броска.');
        return;
      }
      setThrows([...throws, value]);
    }
    update('throwType', value);
    setCustom('');
    setAddingThrow(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const parsed = entrySchema.safeParse({ ...draft, updatedAt: new Date().toISOString() });
      if (!parsed.success)
        throw new Error('Проверьте обязательные поля: ' + parsed.error.issues[0].message);
      await save(parsed.data, throws);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="editor" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{category.name} / Редактор</span>
          <h1>{entry.title ? 'Редактировать материал' : 'Новый материал'}</h1>
          <p>Сохрани детали сейчас, чтобы вспомнить их перед игрой.</p>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <fieldset disabled={busy || reading}>
        <section className="form-panel">
          <div className="panel-title">
            <span className="step">01</span>
            <h2>Основное</h2>
          </div>
          <label>
            Название <span className="required">*</span>
            <input
              autoFocus
              required
              maxLength={200}
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={category.utility ? 'Например, смок в джангл' : 'Название материала'}
            />
          </label>
          {category.utility && (
            <>
              <div className="form-row">
                <label>
                  Откуда <span className="required">*</span>
                  <input
                    required
                    maxLength={200}
                    value={draft.from}
                    onChange={(e) => update('from', e.target.value)}
                    placeholder="Т-спавн"
                  />
                </label>
                <ArrowRight className="field-arrow" size={20} />
                <label>
                  Куда <span className="required">*</span>
                  <input
                    required
                    maxLength={200}
                    value={draft.to}
                    onChange={(e) => update('to', e.target.value)}
                    placeholder="Джангл"
                  />
                </label>
              </div>
              <label>
                Способ броска <span className="required">*</span>
                <div className="input-action">
                  <select
                    required
                    value={draft.throwType}
                    onChange={(e) => update('throwType', e.target.value)}
                  >
                    <option value="">Выбери способ броска</option>
                    {Array.from(
                      new Set([
                        ...defaultThrows,
                        ...throws,
                        ...(draft.throwType ? [draft.throwType] : []),
                      ]),
                    ).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setAddingThrow(!addingThrow)}
                    aria-label="Добавить свой способ броска"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </label>
              {addingThrow && (
                <div className="input-action custom-throw">
                  <input
                    aria-label="Свой способ броска"
                    maxLength={200}
                    placeholder="Например, шаг + jumpthrow"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addThrow();
                      }
                    }}
                  />
                  <button type="button" className="secondary" onClick={addThrow}>
                    <Check size={17} /> Добавить
                  </button>
                </div>
              )}
            </>
          )}
        </section>
        <section className="form-panel">
          <div className="panel-title">
            <span className="step">02</span>
            <h2>Скриншоты</h2>
            <span className="muted push">{draft.images.length} / 30</span>
          </div>
          <p className="muted">
            {category.utility
              ? 'По порядку: где стоять → куда целиться → результат. Порядок можно менять.'
              : 'Добавь изображения в том порядке, в котором их нужно смотреть.'}
          </p>
          <input
            className="visually-hidden"
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => void upload(e.target.files)}
            aria-label="Выбрать скриншоты"
          />
          <div className="upload-grid">
            {draft.images.map((shot, index) => (
              <div className="shot-tile" key={shot.id}>
                <img src={shot.data} alt={shot.name} />
                <div className="shot-toolbar">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <button
                    type="button"
                    disabled={index === 0}
                    className="icon-button"
                    onClick={() => move(index, -1)}
                    aria-label={`Скриншот ${index + 1}: переместить раньше`}
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={index === draft.images.length - 1}
                    className="icon-button"
                    onClick={() => move(index, 1)}
                    aria-label={`Скриншот ${index + 1}: переместить позже`}
                  >
                    <ArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      update(
                        'images',
                        draft.images.filter((s) => s.id !== shot.id),
                      )
                    }
                    aria-label={`Удалить скриншот ${index + 1}`}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="shot-caption">
                  {category.utility && index < 3 ? imageLabels[index] : shot.name}
                </div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 3 - draft.images.length) }, (_, i) => (
              <button
                type="button"
                className="upload-tile"
                key={i}
                onClick={() => fileInput.current?.click()}
              >
                <Plus size={25} />
                <span>
                  {category.utility
                    ? imageLabels[draft.images.length + i]
                    : `Скриншот ${draft.images.length + i + 1}`}
                </span>
              </button>
            ))}
          </div>
          <div className="upload-footer">
            <button
              type="button"
              className="text-button"
              disabled={draft.images.length >= 30}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus size={17} />
              {reading ? 'Читаю изображения…' : 'Добавить скриншоты'}
            </button>
            <span className="muted">PNG, JPG, WebP · до 8 МБ каждый</span>
          </div>
        </section>
        <section className="form-panel">
          <div className="panel-title">
            <span className="step">03</span>
            <h2>{category.utility ? 'Заметки' : 'Описание'}</h2>
            <div className="segmented push">
              <button
                type="button"
                className={!preview ? 'active' : ''}
                onClick={() => setPreview(false)}
              >
                Markdown
              </button>
              <button
                type="button"
                className={preview ? 'active' : ''}
                onClick={() => setPreview(true)}
              >
                Просмотр
              </button>
            </div>
          </div>
          {preview ? (
            <div className="preview">
              <Markdown>{draft.markdown || '*Пока нет описания*'}</Markdown>
            </div>
          ) : (
            <textarea
              className="markdown-input"
              maxLength={100000}
              value={draft.markdown}
              onChange={(e) => update('markdown', e.target.value)}
              placeholder={
                '## Что нужно знать\n\n1. Займи позицию\n2. Проверь прицел\n3. Выполни бросок'
              }
              aria-label="Описание Markdown"
            />
          )}
          <p className="field-hint">Заголовки, списки, **жирный текст**, таблицы и `команды`.</p>
        </section>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={cancel}>
            Отмена
          </button>
          <button className="primary" type="submit">
            <Save size={18} />
            {busy ? 'Сохраняю…' : 'Сохранить материал'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

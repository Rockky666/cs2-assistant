import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Save, Trash2, X } from 'lucide-react';
import {
  categories,
  defaultThrows,
  entrySchema,
  getCategories,
  newLineup,
  type Category,
  type CategoryKind,
  type CustomCategory,
  type Entry,
  type Lineup,
} from './model';
import { MarkdownInput } from './links';
import { Markdown } from './components';
import { ImageGalleryEditor, ImageSlot } from './ImageFields';
import { useI18n } from './i18n';
import { categoryName, errorText, translator, type MessageKey } from './messages';
import { moveEntryCategory } from './editor-model';
import { youtubeVideo } from './video';

type Props = {
  entry: Entry;
  customThrows: string[];
  customCategories: CustomCategory[];
  existingTags: string[];
  save: (entry: Entry, throws: string[], categories: CustomCategory[]) => Promise<void>;
  cancel: () => void;
  dirty: () => void;
};
export function ThrowField({
  value,
  change,
  throws,
  add,
  suffix = '',
}: {
  value: string;
  change: (value: string) => void;
  throws: string[];
  add: (value: string) => boolean;
  suffix?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  function submit() {
    const text = custom.trim();
    if (text && add(text)) {
      change(text);
      setCustom('');
      setOpen(false);
    }
  }
  return (
    <div className="throw-field">
      <label>
        {t('throwType')} {suffix}
        <span className="required"> *</span>
        <div className="input-action">
          <select required value={value} onChange={(e) => change(e.target.value)}>
            <option value="">{t('chooseThrow')}</option>
            {Array.from(new Set([...defaultThrows, ...throws, ...(value ? [value] : [])])).map(
              (method) => (
                <option key={method}>{method}</option>
              ),
            )}
          </select>
          <button
            type="button"
            className="secondary"
            aria-label={`${t('addThrow')}${suffix ? ' ' + suffix : ''}`}
            onClick={() => setOpen(!open)}
          >
            <Plus size={18} />
          </button>
        </div>
      </label>
      {open && (
        <div className="input-action custom-throw">
          <input
            value={custom}
            maxLength={200}
            aria-label={t('customThrow')}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button type="button" className="secondary" onClick={submit}>
            <Check size={17} />
            {t('add')}
          </button>
        </div>
      )}
    </div>
  );
}
export default function Editor({
  entry,
  customThrows,
  customCategories,
  existingTags,
  save,
  cancel,
  dirty,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(entry);
  const [throws, setThrows] = useState(customThrows);
  const [customCats, setCustomCats] = useState(customCategories);
  const [addingCategory, setAddingCategory] = useState(false);
  const [catName, setCatName] = useState('');
  const [catKind, setCatKind] = useState<CategoryKind>('note');
  const [tag, setTag] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const choices = getCategories({ customCategories: customCats }, draft.mapId);
  const category = choices.find((c) => c.id === draft.categoryId)!;
  const utility = category.kind === 'utility';
  const lineup = category.kind === 'lineup';
  function update<K extends keyof Entry>(key: K, value: Entry[K]) {
    dirty();
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function report(err: unknown) {
    setError(errorText(err, t));
  }
  function selectCategory(next: Category) {
    if (
      category.kind !== next.kind &&
      (draft.images.length || draft.lineups.some((l) => l.aim || l.result)) &&
      !window.confirm(t('typeChange'))
    )
      return false;
    try {
      const converted = moveEntryCategory(draft, category, next);
      dirty();
      setDraft(converted);
      return true;
    } catch (err) {
      report(err);
      return false;
    }
  }
  function addCategory() {
    const name = catName.trim();
    if (!name) return;
    const builtinNames = categories.flatMap((c) =>
      (['ru', 'en', 'pt'] as const).map((lang) => categoryName(c, translator(lang))),
    );
    if (
      [...choices.map((c) => c.name), ...builtinNames].some(
        (n) => n.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      report(new Error('ERR_CATEGORY_DUPLICATE'));
      return;
    }
    if (customCats.length >= 200) {
      report(new Error('ERR_CATEGORIES_LIMIT'));
      return;
    }
    const newCat: CustomCategory = {
      id: crypto.randomUUID(),
      name,
      mapId: draft.mapId,
      kind: catKind,
    };
    if (selectCategory(newCat)) {
      setCustomCats([...customCats, newCat]);
      setCatName('');
      setAddingCategory(false);
      setError('');
    }
  }
  function addThrow(value: string) {
    if (!defaultThrows.includes(value) && !throws.includes(value)) {
      if (throws.length >= 100) {
        report(new Error('ERR_THROWS_LIMIT'));
        return false;
      }
      setThrows([...throws, value]);
      dirty();
    }
    return true;
  }
  function tagsWithPending() {
    const value = tag.trim().replace(/^#/, '');
    if (!value || draft.tags.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase()))
      return draft.tags;
    if (draft.tags.length >= 20 || value.length > 40) throw new Error('ERR_TAG_LIMIT');
    return [...draft.tags, value];
  }
  function addTag() {
    try {
      update('tags', tagsWithPending());
      setTag('');
    } catch (err) {
      report(err);
    }
  }
  function updateLineup(id: string, change: Partial<Lineup>) {
    update(
      'lineups',
      draft.lineups.map((l) => (l.id === id ? { ...l, ...change } : l)),
    );
  }
  function moveLineup(index: number, shift: number) {
    const next = [...draft.lineups];
    [next[index], next[index + shift]] = [next[index + shift], next[index]];
    update('lineups', next);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (draft.videoUrl && !youtubeVideo(draft.videoUrl)) throw new Error('ERR_VIDEO_URL');
      const parsed = entrySchema.safeParse({
        ...draft,
        tags: tagsWithPending(),
        updatedAt: new Date().toISOString(),
      });
      if (!parsed.success) throw new Error('ERR_INVALID_DATA');
      await save(parsed.data, throws, customCats);
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="editor" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {categoryName(category, t)} / {t('editor')}
          </span>
          <h1>{t(entry.title ? 'editMaterial' : 'newMaterial')}</h1>
          <p>{t('editorHint')}</p>
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
            <h2>{t('basic')}</h2>
          </div>
          <label>
            {t('title')} <span className="required">*</span>
            <input
              autoFocus
              required
              maxLength={200}
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={t('titlePlaceholder')}
            />
          </label>
          <label>
            {t('category')}
            <div className="input-action">
              <select
                value={draft.categoryId}
                onChange={(e) => selectCategory(choices.find((c) => c.id === e.target.value)!)}
              >
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryName(c, t)}
                  </option>
                ))}
              </select>
              <button
                className="secondary"
                type="button"
                onClick={() => setAddingCategory(!addingCategory)}
                aria-label={t('addCategory')}
              >
                <Plus size={18} />
              </button>
            </div>
          </label>
          {addingCategory && (
            <div className="category-creator">
              <label>
                {t('categoryName')}
                <input
                  maxLength={200}
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    dirty();
                  }}
                />
              </label>
              <label>
                {t('categoryType')}
                <select
                  value={catKind}
                  onChange={(e) => setCatKind(e.target.value as CategoryKind)}
                >
                  {(['note', 'utility', 'lineup'] as const).map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`kind_${kind}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="secondary" onClick={addCategory}>
                <Check size={17} />
                {t('add')}
              </button>
              <p className="field-hint">{t('categoryHint')}</p>
            </div>
          )}
          {(utility || lineup) && (
            <div className="form-row">
              <label>
                {t('from')} <span className="required">*</span>
                <input
                  required
                  maxLength={200}
                  value={draft.from}
                  onChange={(e) => update('from', e.target.value)}
                  placeholder={t('fromPlaceholder')}
                />
              </label>
              {utility && (
                <>
                  <ArrowRight size={20} className="field-arrow" />
                  <label>
                    {t('to')} <span className="required">*</span>
                    <input
                      required
                      maxLength={200}
                      value={draft.to}
                      onChange={(e) => update('to', e.target.value)}
                      placeholder={t('toPlaceholder')}
                    />
                  </label>
                </>
              )}
            </div>
          )}
          {utility && (
            <ThrowField
              value={draft.throwType}
              change={(value) => update('throwType', value)}
              throws={throws}
              add={addThrow}
            />
          )}
          <label>
            {t('tags')}
            <div className="input-action">
              <input
                list="existing-tags"
                aria-label={t('tags')}
                value={tag}
                maxLength={40}
                placeholder={t('tagPlaceholder')}
                onChange={(e) => {
                  setTag(e.target.value);
                  dirty();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button type="button" className="secondary" aria-label={t('addTag')} onClick={addTag}>
                <Plus size={18} />
              </button>
            </div>
          </label>
          <datalist id="existing-tags">
            {existingTags.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <div className="tags">
            {draft.tags.map((value) => (
              <span className="tag" key={value}>
                #{value}
                <button
                  type="button"
                  aria-label={`${t('remove')} #${value}`}
                  onClick={() =>
                    update(
                      'tags',
                      draft.tags.filter((v) => v !== value),
                    )
                  }
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <p className="field-hint">{t('tagsHint')}</p>
        </section>
        <section className="form-panel">
          <div className="panel-title">
            <span className="step">02</span>
            <h2>{t('screenshots')}</h2>
          </div>
          {(lineup || draft.cover) && (
            <div className="standing-slot">
              <ImageSlot
                shot={draft.cover}
                label={t('cover')}
                onChange={(shot) => update('cover', shot)}
                busy={setReading}
                error={report}
              />
              <p className="field-hint">{t('coverHint')}</p>
            </div>
          )}
          {lineup ? (
            <>
              <p className="muted">{t('lineupHint')}</p>
              <div className="standing-slot">
                <ImageSlot
                  shot={draft.images[0] ?? null}
                  label={t('standing')}
                  onChange={(shot) => update('images', shot ? [shot] : [])}
                  busy={setReading}
                  error={report}
                />
              </div>
              <div className="lineup-groups">
                {draft.lineups.map((item, index) => (
                  <section className="lineup-group" key={item.id}>
                    <div className="panel-title">
                      <span className="step">{String(index + 1).padStart(2, '0')}</span>
                      <h3>{t('variant', { number: index + 1 })}</h3>
                      <div className="button-row push">
                        <button
                          type="button"
                          className="icon-button"
                          disabled={index === 0}
                          onClick={() => moveLineup(index, -1)}
                          aria-label={`${t('variant', { number: index + 1 })}: ${t('earlier')}`}
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          disabled={index === draft.lineups.length - 1}
                          onClick={() => moveLineup(index, 1)}
                          aria-label={`${t('variant', { number: index + 1 })}: ${t('later')}`}
                        >
                          <ArrowRight size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          disabled={draft.lineups.length === 1}
                          onClick={() =>
                            update(
                              'lineups',
                              draft.lineups.filter((l) => l.id !== item.id),
                            )
                          }
                          aria-label={`${t('remove')} ${t('variant', { number: index + 1 })}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="lineup-fields">
                      <label>
                        {t('to')} {index + 1}
                        <input
                          required
                          maxLength={200}
                          value={item.to}
                          onChange={(e) => updateLineup(item.id, { to: e.target.value })}
                          placeholder={t('toPlaceholder')}
                        />
                      </label>
                      <ThrowField
                        suffix={String(index + 1)}
                        value={item.throwType}
                        change={(value) => updateLineup(item.id, { throwType: value })}
                        throws={throws}
                        add={addThrow}
                      />
                    </div>
                    <div className="lineup-pair">
                      <ImageSlot
                        label={`${t('aiming')} ${index + 1}`}
                        shot={item.aim}
                        caption={item.throwType}
                        onChange={(shot) => updateLineup(item.id, { aim: shot })}
                        busy={setReading}
                        error={report}
                      />
                      <ImageSlot
                        label={`${t('result')} ${index + 1}`}
                        shot={item.result}
                        onChange={(shot) => updateLineup(item.id, { result: shot })}
                        busy={setReading}
                        error={report}
                      />
                    </div>
                  </section>
                ))}
              </div>
              <button
                type="button"
                className="secondary"
                disabled={draft.lineups.length >= 20}
                onClick={() => update('lineups', [...draft.lineups, newLineup()])}
              >
                <Plus size={18} />
                {t('addVariant')}
              </button>
              <p className="field-hint">{t('imageLimits')}</p>
            </>
          ) : (
            <ImageGalleryEditor
              images={draft.images}
              utility={utility}
              flash={draft.categoryId === 'flash'}
              throwType={draft.throwType}
              onChange={(shots) => update('images', shots)}
              busy={setReading}
              error={report}
            />
          )}
        </section>
        <section className="form-panel">
          <div className="panel-title">
            <span className="step">03</span>
            <h2>{t(utility || lineup ? 'notes' : 'description')}</h2>
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
                {t('preview')}
              </button>
            </div>
          </div>
          {preview ? (
            <div className="preview">
              <Markdown>{draft.markdown || `*${t('noDescription')}*`}</Markdown>
            </div>
          ) : (
            <MarkdownInput value={draft.markdown} change={(value) => update('markdown', value)} />
          )}
          <p className="field-hint">{t('markdownHint')}</p>
        </section>
        <section className="form-panel">
          <div className="panel-title">
            <h2>{t('video')}</h2>
          </div>
          <label>
            {t('videoUrl')}
            <input
              type="url"
              maxLength={2048}
              value={draft.videoUrl}
              onChange={(e) => update('videoUrl', e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </label>
          <p className="field-hint">{t('videoUrlHint')}</p>
        </section>
        <div className="form-actions">
          <button className="secondary" type="button" onClick={cancel}>
            {t('cancel')}
          </button>
          <button className="primary" type="submit">
            <Save size={18} />
            {t(busy ? 'saving' : 'saveMaterial')}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

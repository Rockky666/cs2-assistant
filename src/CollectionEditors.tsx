import { useState, type FormEvent } from 'react';
import { commandSchema, crosshairSchema, type Command, type Crosshair, type Shot } from './model';
import { Modal } from './components';
import { ImageSlot } from './ImageFields';
import { useI18n } from './i18n';
import { errorText } from './messages';

type Base = { close: () => void; dirty: () => void };
export function CommandEditor({
  command,
  close,
  dirty,
  save,
}: Base & { command: Command; save: (command: Command) => Promise<void> }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(command.title);
  const [text, setText] = useState(command.command);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const parsed = commandSchema.safeParse({ ...command, title, command: text });
      if (!parsed.success) throw new Error('ERR_INVALID_DATA');
      await save(parsed.data);
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t(command.title ? 'editCommand' : 'newCommand')}
      close={() => {
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={busy}>
          <label>
            {t('title')}
            <input
              autoFocus
              required
              maxLength={200}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                dirty();
              }}
            />
          </label>
          <label>
            {t('command')}
            <textarea
              required
              maxLength={10000}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                dirty();
              }}
              placeholder="cl_showfps 1"
            />
          </label>
          <p className="field-hint">{t('commandHint')}</p>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={close}>
              {t('cancel')}
            </button>
            <button className="primary" type="submit">
              {t(busy ? 'saving' : 'save')}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
export type CrosshairDraft = Omit<Crosshair, 'image'> & { image: Shot | null };
export function CrosshairEditor({
  crosshair,
  close,
  dirty,
  save,
}: Base & { crosshair: CrosshairDraft; save: (crosshair: Crosshair) => Promise<void> }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(crosshair);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const parsed = crosshairSchema.safeParse({ ...draft, updatedAt: new Date().toISOString() });
      if (!parsed.success) throw new Error('ERR_CODE');
      await save(parsed.data);
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t(crosshair.code ? 'editCrosshair' : 'newCrosshair')}
      close={() => {
        if (!busy && !reading) close();
      }}
    >
      <form onSubmit={submit}>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={busy || reading}>
          <ImageSlot
            shot={draft.image}
            label={t('crosshairShot')}
            onChange={(image) => {
              setDraft({ ...draft, image });
              dirty();
            }}
            busy={setReading}
            error={(e) => setError(errorText(e, t))}
          />
          <p className="field-hint">{t('imageLimits')}</p>
          <label>
            {t('importCode')}
            <textarea
              autoFocus
              required
              maxLength={10000}
              value={draft.code}
              onChange={(e) => {
                setDraft({ ...draft, code: e.target.value });
                dirty();
              }}
              placeholder="CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
              spellCheck={false}
            />
          </label>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={close}>
              {t('cancel')}
            </button>
            <button className="primary" type="submit">
              {t(busy ? 'saving' : 'save')}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

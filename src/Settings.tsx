import {
  Database as DatabaseIcon,
  Download,
  ExternalLink,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { type Database, type Settings as Preferences, type Theme, entryShotCount } from './model';
import { useI18n } from './i18n';
import { themeLogos } from './assets';
import { APP_VERSION, DEVELOPER } from './app-info';
import type { MessageKey } from './messages';

const themeOptions: { id: Theme; key: MessageKey; color: string }[] = [
  { id: 'dark-blue', key: 'theme_blue', color: '#0B1120' },
  { id: 'dark', key: 'theme_dark', color: '#0D0D0D' },
  { id: 'dark-red', key: 'theme_red', color: '#480002' },
  { id: 'orange', key: 'theme_orange', color: '#21150D' },
  { id: 'light', key: 'theme_light', color: '#F4F5F7' },
];
export function Settings({
  settings,
  busy,
  change,
  openRepository,
}: {
  settings: Preferences;
  busy: boolean;
  change: (settings: Preferences) => void;
  openRepository: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">CS2 ASSISTANT</span>
          <h1>{t('settings')}</h1>
          <p>{t('settingsHint')}</p>
        </div>
      </div>
      <fieldset disabled={busy}>
        <section className="form-panel">
          <div className="panel-title">
            <h2>{t('language')}</h2>
          </div>
          <label className="language-field">
            {t('language')}
            <select
              value={settings.language}
              onChange={(e) =>
                change({ ...settings, language: e.target.value as Preferences['language'] })
              }
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select>
          </label>
        </section>
        <section className="form-panel">
          <div className="panel-title">
            <h2>{t('theme')}</h2>
          </div>
          <div className="theme-grid">
            {themeOptions.map((theme) => (
              <button
                type="button"
                className={`theme-option ${theme.id === settings.theme ? 'selected' : ''}`}
                key={theme.id}
                aria-pressed={theme.id === settings.theme}
                onClick={() => change({ ...settings, theme: theme.id })}
              >
                <span className="theme-preview" style={{ backgroundColor: theme.color }}>
                  <img src={themeLogos[theme.id]} alt="" />
                </span>
                <strong>{t(theme.key)}</strong>
                <code>{theme.color}</code>
              </button>
            ))}
          </div>
        </section>
      </fieldset>
      <section className="form-panel">
        <div className="panel-title">
          <h2>{t('about')}</h2>
        </div>
        <dl className="about-list">
          <div>
            <dt>{t('version')}</dt>
            <dd>{APP_VERSION}</dd>
          </div>
          <div>
            <dt>{t('developer')}</dt>
            <dd>{DEVELOPER}</dd>
          </div>
        </dl>
        <button className="text-button" onClick={openRepository}>
          <ExternalLink size={17} />
          {t('repository')}
        </button>
      </section>
    </>
  );
}
export function Backups({
  db,
  busy,
  backup,
}: {
  db: Database;
  busy: boolean;
  backup: (action: 'export' | 'import') => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t('localLibrary')}</span>
          <h1>{t('backupTitle')}</h1>
          <p>{t('backupHint')}</p>
        </div>
      </div>
      <div className="stats-grid">
        <div>
          <strong>{db.entries.length}</strong>
          <span>{t('materials')}</span>
        </div>
        <div>
          <strong>
            {db.entries.reduce((sum, e) => sum + entryShotCount(e), db.crosshairs.length)}
          </strong>
          <span>{t('screenshots')}</span>
        </div>
        <div>
          <strong>{db.commands.length}</strong>
          <span>{t('commands')}</span>
        </div>
        <div>
          <strong>{db.crosshairs.length}</strong>
          <span>{t('crosshairs')}</span>
        </div>
      </div>
      <section className="form-panel">
        <div className="panel-title">
          <DatabaseIcon size={22} />
          <h2>{t('backupSection')}</h2>
        </div>
        <p className="muted">{t('backupDescription')}</p>
        <div className="button-row">
          <button disabled={busy} className="primary" onClick={() => backup('export')}>
            <Download size={18} />
            {t('export')}
          </button>
          <button disabled={busy} className="secondary" onClick={() => backup('import')}>
            <Upload size={18} />
            {t('restore')}
          </button>
        </div>
      </section>
      <div className="info-note">
        <ShieldCheck size={21} />
        <p>{t('storageHint')}</p>
      </div>
    </>
  );
}

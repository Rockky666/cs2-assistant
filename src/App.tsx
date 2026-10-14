import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Crosshair as CrosshairIcon,
  Database as DatabaseIcon,
  Edit3,
  FolderOpen,
  Grid2X2,
  HardDrive,
  Layers3,
  Map as MapIcon,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Target,
  Terminal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  categories,
  maps,
  emptyDatabase,
  getCategories,
  newEntry,
  sortPinned,
  type Command,
  type Database,
  type Entry,
  type MapId,
} from './model';
import { storage } from './storage';
import { categoryIcon, Modal, PinButton, ShotVisual, type Lightbox } from './components';
import { MaterialCards, MaterialDetail, MapPositions } from './MaterialViews';
import { CommandEditor, CrosshairEditor, type CrosshairDraft } from './CollectionEditors';
import { Settings, Backups } from './Settings';
import Editor from './Editor';
import { categoryName, errorText, translator, type MessageKey } from './messages';
import { LanguageContext } from './i18n';
import { backgroundFor, themeLogos } from './assets';
import { APP_VERSION } from './app-info';

type Route = {
  page:
    | 'maps'
    | 'map'
    | 'map-image'
    | 'list'
    | 'detail'
    | 'editor'
    | 'commands'
    | 'aim'
    | 'peeks'
    | 'crosshairs'
    | 'settings'
    | 'data';
  mapId?: MapId;
  categoryId?: string;
  entryId?: string;
};
function readRoute(): Route {
  try {
    const route = JSON.parse(decodeURIComponent(location.hash.slice(1) || '{"page":"maps"}'));
    return route &&
      [
        'maps',
        'map',
        'map-image',
        'list',
        'detail',
        'commands',
        'aim',
        'peeks',
        'crosshairs',
        'settings',
        'data',
      ].includes(route.page)
      ? route
      : { page: 'maps' };
  } catch {
    return { page: 'maps' };
  }
}
const sideItems = [
  { page: 'maps', icon: MapIcon },
  { page: 'aim', icon: Target },
  { page: 'peeks', icon: Layers3 },
  { page: 'commands', icon: Terminal },
  { page: 'crosshairs', icon: CrosshairIcon },
] as const;
type Deleting = { id: string; title: string; kind: 'entry' | 'command' | 'crosshair' };
export default function App() {
  const [db, setDb] = useState<Database>(emptyDatabase);
  const dbRef = useRef(db);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [route, setRoute] = useState<Route>(readRoute);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Entry | null>(null);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [crosshair, setCrosshair] = useState<CrosshairDraft | null>(null);
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  const t = translator(db.settings.language);
  function apply(data: Database) {
    dbRef.current = data;
    setDb(data);
  }
  useEffect(() => {
    storage
      .load()
      .then(apply)
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = db.settings.theme;
    document.documentElement.lang = db.settings.language;
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.href = themeLogos[db.settings.theme];
  }, [db.settings]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const listener = () => {
      if (writing.current || (dirty && !window.confirm(t('unsaved')))) {
        history.pushState(null, '', '#' + encodeURIComponent(JSON.stringify(route)));
        return;
      }
      setDirty(false);
      setDraft(null);
      setCommand(null);
      setCrosshair(null);
      setSearch('');
      setRoute(readRoute());
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty || writing.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('hashchange', listener);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('hashchange', listener);
      window.removeEventListener('beforeunload', unload);
    };
  }, [dirty, route, db.settings.language]);
  function navigate(next: Route, force = false) {
    if (writing.current || (!force && dirty && !window.confirm(t('unsaved')))) return;
    setDirty(false);
    setDraft(null);
    setCommand(null);
    setCrosshair(null);
    setSearch('');
    setError(null);
    setRoute(next);
    history.pushState(null, '', '#' + encodeURIComponent(JSON.stringify(next)));
    window.scrollTo(0, 0);
  }
  function edit(entry: Entry) {
    if (writing.current) return;
    setDraft(entry);
    setDirty(false);
    setSearch('');
    setRoute({
      page: 'editor',
      mapId: entry.mapId,
      categoryId: entry.categoryId,
      entryId: entry.id,
    });
    window.scrollTo(0, 0);
  }
  async function mutate(update: (current: Database) => Database) {
    if (writing.current) throw new Error('ERR_BUSY');
    writing.current = true;
    setBusy(true);
    try {
      const saved = await storage.save(update(dbRef.current));
      apply(saved);
      return saved;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  function closeEditor() {
    if (!writing.current && (!dirty || window.confirm(t('unsaved')))) {
      setDirty(false);
      setCommand(null);
      setCrosshair(null);
    }
  }
  const map = maps.find((m) => m.id === route.mapId);
  const mapCategories = getCategories(db, map?.id);
  const category = mapCategories.find((c) => c.id === route.categoryId);
  const selected = db.entries.find((e) => e.id === route.entryId);
  const query = search.trim().replace(/^#/, '').toLocaleLowerCase();
  const entries = sortPinned(
    db.entries.filter(
      (e) =>
        (!map || e.mapId === map.id) &&
        (route.page !== 'list' || e.categoryId === category?.id) &&
        (!query ||
          `${e.title} ${e.from} ${e.to} ${e.throwType} ${e.markdown} ${e.tags.join(' ')} ${e.lineups.map((l) => `${l.to} ${l.throwType}`).join(' ')} ${maps.find((m) => m.id === e.mapId)?.name}`
            .toLocaleLowerCase()
            .includes(query)),
    ),
  );
  const activePage = ['map', 'map-image', 'list', 'detail', 'editor'].includes(route.page)
    ? 'maps'
    : route.page;
  async function backup(action: 'export' | 'import') {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === 'export') {
        if (await storage.exportBackup()) setToast(t('backupSaved'));
      } else {
        const imported = await storage.importBackup();
        if (imported) {
          apply(imported);
          setLoadError(null);
          setToast(translator(imported.settings.language)('backupRestored'));
        }
      }
    } catch (err) {
      setError(err);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    try {
      await mutate((current) => ({
        ...current,
        entries:
          deleting.kind === 'entry'
            ? current.entries.filter((e) => e.id !== deleting.id)
            : current.entries,
        commands:
          deleting.kind === 'command'
            ? current.commands.filter((c) => c.id !== deleting.id)
            : current.commands,
        crosshairs:
          deleting.kind === 'crosshair'
            ? current.crosshairs.filter((c) => c.id !== deleting.id)
            : current.crosshairs,
      }));
      setDeleting(null);
      setToast(t('removed'));
      if (route.page === 'detail')
        navigate({ page: 'list', mapId: route.mapId, categoryId: route.categoryId });
    } catch (err) {
      setError(err);
    }
  }
  function pin(kind: 'entries' | 'commands' | 'crosshairs', id: string) {
    void mutate((current) => ({
      ...current,
      [kind]: current[kind].map((item) =>
        item.id === id ? { ...item, pinned: !item.pinned } : item,
      ),
    })).catch(setError);
  }
  function copy(value: string) {
    void storage
      .copy(value)
      .then(() => setToast(t('copied')))
      .catch(setError);
  }
  function cards(items: Entry[]) {
    return (
      <MaterialCards
        entries={items}
        categories={[...categories, ...db.customCategories]}
        busy={busy}
        open={(entry) =>
          navigate({
            page: 'detail',
            mapId: entry.mapId,
            categoryId: entry.categoryId,
            entryId: entry.id,
          })
        }
        edit={edit}
        remove={(entry) => setDeleting({ id: entry.id, title: entry.title, kind: 'entry' })}
        pin={(entry) => pin('entries', entry.id)}
        tag={setSearch}
      />
    );
  }
  function empty(title: MessageKey, description: MessageKey, add?: () => void) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <FolderOpen size={34} strokeWidth={1.3} />
        </div>
        <h2>{t(title)}</h2>
        <p>{t(description)}</p>
        {add && (
          <button className="primary" onClick={add}>
            <Plus size={18} />
            {t('addMaterial')}
          </button>
        )}
      </div>
    );
  }
  function content() {
    if (loading)
      return (
        <div className="empty-state">
          <div className="spinner" />
          <p>{t('loading')}</p>
        </div>
      );
    if (loadError)
      return (
        <div className="empty-state">
          <DatabaseIcon size={35} />
          <h2>{t('loadFailed')}</h2>
          <p className="error">{errorText(loadError, t)}</p>
          <button disabled={busy} className="primary" onClick={() => void backup('import')}>
            <Upload size={18} />
            {t('restore')}
          </button>
        </div>
      );
    if (route.page === 'editor' && draft)
      return (
        <Editor
          key={draft.id}
          entry={draft}
          customThrows={db.customThrows}
          customCategories={db.customCategories}
          existingTags={Array.from(new Set(db.entries.flatMap((e) => e.tags))).sort()}
          dirty={() => setDirty(true)}
          cancel={() =>
            navigate({ page: 'list', mapId: draft.mapId, categoryId: draft.categoryId })
          }
          save={async (entry, customThrows, customCategories) => {
            await mutate((current) => ({
              ...current,
              customThrows,
              customCategories,
              entries: [...current.entries.filter((e) => e.id !== entry.id), entry],
            }));
            navigate(
              {
                page: 'detail',
                mapId: entry.mapId,
                categoryId: entry.categoryId,
                entryId: entry.id,
              },
              true,
            );
            setToast(t('materialSaved'));
          }}
        />
      );
    if (route.page === 'maps')
      return (
        <>
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="blue-dot" />
                {t('heroEyebrow')}
              </span>
              <h1>
                {t('heroTitle')}
                <br />
                {t('heroBefore')} <span>{t('heroAccent')}</span>
              </h1>
              <p>{t('heroDescription')}</p>
              <div className="hero-meta">
                <span>
                  <HardDrive size={14} />
                  {t('alwaysReady')}
                </span>
                <span>
                  <ShieldCheck size={14} />
                  {t('worksOffline')}
                </span>
              </div>
            </div>
            <div className="radar-art" aria-hidden="true">
              <div className="radar-ring ring-one" />
              <div className="radar-ring ring-two" />
              <div className="radar-ring ring-three" />
              <CrosshairIcon className="radar-cross" size={110} strokeWidth={0.6} />
              <span className="radar-point point-a">A</span>
              <span className="radar-point point-b">B</span>
              <span className="radar-coord">CS2 / FIELD NOTES</span>
            </div>
          </section>
          <div className="section-heading">
            <div>
              <h2>{t(query ? 'searchResults' : 'chooseMap')}</h2>
              <p>{t(query ? 'trySearch' : 'chooseMapHint')}</p>
            </div>
            <span className="count-badge">
              {t(query ? 'materialsCount' : 'mapsCount', {
                count: query ? entries.length : maps.length,
              })}
            </span>
          </div>
          {query ? (
            entries.length ? (
              cards(entries)
            ) : (
              empty('noResults', 'trySearch')
            )
          ) : (
            <div className="map-grid">
              {maps.map((item, index) => (
                <button
                  className={`map-card map-${item.id}`}
                  key={item.id}
                  onClick={() => navigate({ page: 'map', mapId: item.id })}
                >
                  <div className="map-art photo" aria-hidden="true">
                    <img src={backgroundFor(item.id)} alt="" />
                    <span className="map-index">
                      0{index + 1} / DE_{item.id.toUpperCase()}
                    </span>
                  </div>
                  <div className="map-info">
                    <div>
                      <h3>{item.name}</h3>
                      <span>
                        {t('materialsCount', {
                          count: db.entries.filter((e) => e.mapId === item.id).length,
                        })}
                      </span>
                    </div>
                    <span className="map-arrow">
                      <ArrowRight size={19} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!query && (
            <div className="bottom-note">
              <BookOpen size={18} />
              <p>{t('libraryHint')}</p>
            </div>
          )}
        </>
      );
    if (['map', 'map-image'].includes(route.page) && map)
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {t('mapLibrary')} / {map.code}
              </span>
              <h1>{map.name}</h1>
            </div>
            <button className="primary" onClick={() => edit(newEntry(map.id, 'smoke', 'utility'))}>
              <Plus size={18} />
              {t('addMaterial')}
            </button>
          </div>
          <div className="map-tabs" role="tablist" aria-label={map.name}>
            <button
              role="tab"
              aria-selected={route.page === 'map'}
              className={route.page === 'map' ? 'active' : ''}
              onClick={() => navigate({ page: 'map', mapId: map.id })}
            >
              <Grid2X2 size={17} />
              {t('materials')}
            </button>
            <button
              role="tab"
              aria-selected={route.page === 'map-image'}
              className={route.page === 'map-image' ? 'active' : ''}
              onClick={() => navigate({ page: 'map-image', mapId: map.id })}
            >
              <MapIcon size={17} />
              {t('mapTab')}
            </button>
          </div>
          {route.page === 'map-image' ? (
            <MapPositions key={map.id} mapId={map.id} enlarge={setLightbox} />
          ) : query ? (
            entries.length ? (
              cards(entries)
            ) : (
              empty('noResults', 'trySearch')
            )
          ) : (
            <div className="category-grid">
              {mapCategories.map((cat) => {
                const Icon = categoryIcon(cat.id);
                return (
                  <button
                    className="category-card"
                    key={cat.id}
                    onClick={() => navigate({ page: 'list', mapId: map.id, categoryId: cat.id })}
                  >
                    <div className={`category-icon ${cat.id}`}>
                      <Icon size={27} strokeWidth={1.5} />
                    </div>
                    <h2>{categoryName(cat, t)}</h2>
                    <p>{t(`hint_${cat.kind}`)}</p>
                    <div>
                      <span>
                        {t('materialsCount', {
                          count: db.entries.filter(
                            (e) => e.mapId === map.id && e.categoryId === cat.id,
                          ).length,
                        })}
                      </span>
                      <ArrowRight size={18} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      );
    if (route.page === 'list' && map && category)
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {map.name} / {t('library')}
              </span>
              <h1>{categoryName(category, t)}</h1>
              <p>{t(`hint_${category.kind}`)}</p>
            </div>
            <button
              className="primary"
              onClick={() => edit(newEntry(map.id, category.id, category.kind))}
            >
              <Plus size={18} />
              {t(category.kind === 'utility' ? 'addUtility' : 'addMaterial')}
            </button>
          </div>
          <div className="list-summary">
            <span>{t('materialsCount', { count: entries.length })}</span>
            <span>{t('sortHint')}</span>
          </div>
          {entries.length
            ? cards(entries)
            : query
              ? empty('noResults', 'trySearch')
              : empty('collectionStart', `hint_${category.kind}`, () =>
                  edit(newEntry(map.id, category.id, category.kind)),
                )}
        </>
      );
    if (route.page === 'detail' && selected && category)
      return (
        <MaterialDetail
          entry={selected}
          category={category}
          busy={busy}
          edit={() => edit(selected)}
          remove={() => setDeleting({ id: selected.id, title: selected.title, kind: 'entry' })}
          pin={() => pin('entries', selected.id)}
          enlarge={setLightbox}
        />
      );
    if (route.page === 'commands') {
      const commands = sortPinned(
        db.commands.filter((c) => `${c.title} ${c.command}`.toLocaleLowerCase().includes(query)),
      );
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('library')}</span>
              <h1>{t('commands')}</h1>
              <p>{t('commandsHint')}</p>
            </div>
            <button
              className="primary"
              onClick={() =>
                setCommand({ id: crypto.randomUUID(), title: '', command: '', pinned: false })
              }
            >
              <Plus size={18} />
              {t('addCommand')}
            </button>
          </div>
          <div className="command-list">
            {commands.map((cmd) => (
              <article className={`command-card ${cmd.pinned ? 'pinned-card' : ''}`} key={cmd.id}>
                <div className="command-icon">
                  <Terminal size={22} />
                </div>
                <div className="command-content">
                  <h3>{cmd.title}</h3>
                  <code>{cmd.command}</code>
                </div>
                <div className="button-row">
                  <PinButton
                    pinned={cmd.pinned}
                    name={cmd.title}
                    disabled={busy}
                    toggle={() => pin('commands', cmd.id)}
                  />
                  <button
                    className="icon-button"
                    aria-label={`${t('copy')} ${cmd.title}`}
                    onClick={() => copy(cmd.command)}
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    disabled={busy}
                    className="icon-button"
                    aria-label={`${t('edit')} ${cmd.title}`}
                    onClick={() => setCommand(cmd)}
                  >
                    <Edit3 size={17} />
                  </button>
                  <button
                    disabled={busy}
                    className="icon-button danger"
                    aria-label={`${t('remove')} ${cmd.title}`}
                    onClick={() => setDeleting({ id: cmd.id, title: cmd.title, kind: 'command' })}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!commands.length &&
            empty(query ? 'noResults' : 'emptyCommands', query ? 'trySearch' : 'commandHint')}
        </>
      );
    }
    if (route.page === 'crosshairs') {
      const items = sortPinned(
        db.crosshairs.filter((c) => c.code.toLocaleLowerCase().includes(query)),
      );
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('library')}</span>
              <h1>{t('crosshairs')}</h1>
              <p>{t('crosshairsHint')}</p>
            </div>
            <button
              className="primary"
              onClick={() =>
                setCrosshair({
                  id: crypto.randomUUID(),
                  code: '',
                  image: null,
                  pinned: false,
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              <Plus size={18} />
              {t('addCrosshair')}
            </button>
          </div>
          <div className="crosshair-grid">
            {items.map((item) => (
              <article
                className={`crosshair-card ${item.pinned ? 'pinned-card' : ''}`}
                key={item.id}
              >
                <button
                  className="crosshair-image"
                  onClick={() => setLightbox({ data: item.image.data, title: t('crosshairShot') })}
                >
                  <img src={item.image.data} alt={t('crosshairShot')} />
                </button>
                <code>{item.code}</code>
                <div className="card-actions">
                  <PinButton
                    pinned={item.pinned}
                    name={item.code}
                    disabled={busy}
                    toggle={() => pin('crosshairs', item.id)}
                  />
                  <button
                    className="icon-button"
                    aria-label={`${t('copy')} ${item.code}`}
                    onClick={() => copy(item.code)}
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`${t('edit')} ${item.code}`}
                    onClick={() => setCrosshair(item)}
                  >
                    <Edit3 size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    disabled={busy}
                    aria-label={`${t('remove')} ${item.code}`}
                    onClick={() =>
                      setDeleting({ id: item.id, title: item.code, kind: 'crosshair' })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!items.length &&
            empty(query ? 'noResults' : 'emptyCrosshairs', query ? 'trySearch' : 'crosshairsHint')}
        </>
      );
    }
    if (route.page === 'settings')
      return (
        <Settings
          settings={db.settings}
          busy={busy}
          change={(settings) => {
            void mutate((current) => ({ ...current, settings }))
              .then((saved) => setToast(translator(saved.settings.language)('saved')))
              .catch(setError);
          }}
          openRepository={() => {
            void storage.openRepository().catch(setError);
          }}
        />
      );
    if (route.page === 'data')
      return <Backups db={db} busy={busy} backup={(action) => void backup(action)} />;
    if (route.page === 'aim' || route.page === 'peeks')
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('library')}</span>
              <h1>{t(route.page)}</h1>
            </div>
            <span className="count-badge">{t('soon')}</span>
          </div>
          {empty('emptySection', 'emptySectionHint')}
        </>
      );
    return empty('notFound', 'returnToMaps');
  }
  return (
    <LanguageContext.Provider value={db.settings.language}>
      <div className="app-shell">
        <aside className="sidebar">
          <button className="brand" onClick={() => navigate({ page: 'maps' })}>
            <span className="brand-mark">
              <img src={themeLogos[db.settings.theme]} alt="CS2 Assistant" />
            </span>
            <span>
              CS2<span className="brand-subtitle">ASSISTANT</span>
            </span>
            <span className="version">02</span>
          </button>
          <div className="nav-caption">{t('yourGuide')}</div>
          <nav aria-label={t('navigation')}>
            {sideItems.map((item) => (
              <button
                key={item.page}
                aria-label={t(item.page)}
                title={t(item.page)}
                className={`nav-item ${activePage === item.page ? 'active' : ''}`}
                onClick={() => navigate({ page: item.page })}
              >
                <item.icon size={19} strokeWidth={1.6} />
                <span>{t(item.page)}</span>
                {item.page === 'maps' && <span className="nav-count">7</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="library-status">
              <span className="status-dot" />
              <span>
                {t('localLibrary')}
                <small>{t('materialsCount', { count: db.entries.length })}</small>
              </span>
            </div>
            {(
              [
                { page: 'settings', key: 'settings', icon: SettingsIcon },
                { page: 'data', key: 'backups', icon: ArrowDownToLine },
              ] as const
            ).map((item) => (
              <button
                key={item.page}
                className={`nav-item ${route.page === item.page ? 'active' : ''}`}
                aria-label={t(item.key)}
                title={t(item.key)}
                onClick={() => navigate({ page: item.page })}
              >
                <item.icon size={18} />
                <span>{t(item.key)}</span>
              </button>
            ))}
            <div className="sidebar-footer">
              CS2 ASSISTANT <span>v{APP_VERSION}</span>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumbs">
              <button onClick={() => navigate({ page: 'maps' })}>
                <Grid2X2 size={16} />
                <span>{t('library')}</span>
              </button>
              {map && (
                <>
                  <ChevronRight size={14} />
                  <button onClick={() => navigate({ page: 'map', mapId: map.id })}>
                    {map.name}
                  </button>
                </>
              )}
              {category && (
                <>
                  <ChevronRight size={14} />
                  <button
                    onClick={() =>
                      navigate({ page: 'list', mapId: map?.id, categoryId: category.id })
                    }
                  >
                    {categoryName(category, t)}
                  </button>
                </>
              )}
            </div>
            {['maps', 'map', 'list', 'commands', 'crosshairs'].includes(route.page) && (
              <label className="search">
                <Search size={17} />
                <input
                  aria-label={t('search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                />
                {search && (
                  <button onClick={() => setSearch('')} aria-label={t('clearSearch')}>
                    <X size={15} />
                  </button>
                )}
              </label>
            )}
            <span className="offline">
              <span className="status-dot" />
              {t('offline')}
            </span>
          </header>
          <main>
            {!window.desktop && <div className="preview-banner">{t('previewBanner')}</div>}
            {!!error && (
              <div className="error" role="alert">
                {errorText(error, t)}
                <button
                  className="icon-button"
                  onClick={() => setError(null)}
                  aria-label={t('close')}
                >
                  <X size={17} />
                </button>
              </div>
            )}
            {route.page !== 'maps' && route.page !== 'editor' && (
              <button
                className="back-button"
                onClick={() =>
                  navigate(
                    route.page === 'detail'
                      ? { page: 'list', mapId: route.mapId, categoryId: route.categoryId }
                      : route.page === 'list'
                        ? { page: 'map', mapId: route.mapId }
                        : { page: 'maps' },
                  )
                }
              >
                <ArrowLeft size={16} />
                {t(
                  route.page === 'detail'
                    ? 'backToList'
                    : route.page === 'list'
                      ? 'backToMap'
                      : 'allMaps',
                )}
              </button>
            )}
            {content()}
          </main>
          <footer className="main-footer">
            <span>{t('footer')}</span>
            <span>{t('footerSmall')}</span>
          </footer>
        </div>
        {toast && (
          <div className="toast" role="status">
            <Check size={18} />
            {toast}
          </div>
        )}
        {deleting && (
          <Modal
            title={t('deleteTitle')}
            close={() => {
              if (!busy) {
                setDeleting(null);
                setError(null);
              }
            }}
          >
            <p>{t('deleteDescription', { name: deleting.title })}</p>
            {!!error && (
              <p className="error" role="alert">
                {errorText(error, t)}
              </p>
            )}
            <div className="form-actions">
              <button disabled={busy} className="secondary" onClick={() => setDeleting(null)}>
                {t('cancel')}
              </button>
              <button disabled={busy} className="primary destructive" onClick={() => void remove()}>
                {t(busy ? 'deleting' : 'remove')}
              </button>
            </div>
          </Modal>
        )}
        {command && (
          <CommandEditor
            command={command}
            close={closeEditor}
            dirty={() => setDirty(true)}
            save={async (cmd) => {
              await mutate((current) => ({
                ...current,
                commands: [...current.commands.filter((c) => c.id !== cmd.id), cmd],
              }));
              setCommand(null);
              setDirty(false);
              setToast(t('saved'));
            }}
          />
        )}
        {crosshair && (
          <CrosshairEditor
            crosshair={crosshair}
            close={closeEditor}
            dirty={() => setDirty(true)}
            save={async (item) => {
              await mutate((current) => ({
                ...current,
                crosshairs: [...current.crosshairs.filter((c) => c.id !== item.id), item],
              }));
              setCrosshair(null);
              setDirty(false);
              setToast(t('saved'));
            }}
          />
        )}
        {lightbox && (
          <Modal title={lightbox.title} wide close={() => setLightbox(null)}>
            <div className="lightbox-content">
              <ShotVisual {...lightbox} lightbox />
            </div>
          </Modal>
        )}
      </div>
    </LanguageContext.Provider>
  );
}

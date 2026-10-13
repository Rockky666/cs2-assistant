import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Crosshair,
  Database as DatabaseIcon,
  Download,
  Edit3,
  FolderOpen,
  Grid2X2,
  HardDrive,
  ImageIcon,
  Layers3,
  Map as MapIcon,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Terminal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { categories, maps, emptyDatabase, type Command, type Database, type Entry } from './model';
import { storage } from './storage';
import { categoryIcons, Markdown, Modal } from './components';
import Editor from './Editor';

type Route = {
  page:
    | 'maps'
    | 'map'
    | 'list'
    | 'detail'
    | 'editor'
    | 'commands'
    | 'aim'
    | 'peeks'
    | 'crosshairs'
    | 'settings';
  mapId?: string;
  categoryId?: string;
  entryId?: string;
};
function readRoute(): Route {
  try {
    const route = JSON.parse(
      decodeURIComponent(location.hash.slice(1) || '%7B%22page%22%3A%22maps%22%7D'),
    );
    return route &&
      [
        'maps',
        'map',
        'list',
        'detail',
        'commands',
        'aim',
        'peeks',
        'crosshairs',
        'settings',
      ].includes(route.page)
      ? route
      : { page: 'maps' };
  } catch {
    return { page: 'maps' };
  }
}
const sideItems = [
  { page: 'maps', title: 'Карты', icon: MapIcon },
  { page: 'aim', title: 'Стрельба', icon: Target },
  { page: 'peeks', title: 'Пики', icon: Layers3 },
  { page: 'commands', title: 'Консольные команды', icon: Terminal },
  { page: 'crosshairs', title: 'Прицелы', icon: Crosshair },
] as const;
function newEntry(mapId: string, categoryId: string): Entry {
  return {
    id: crypto.randomUUID(),
    mapId: mapId as Entry['mapId'],
    categoryId: categoryId as Entry['categoryId'],
    title: '',
    from: '',
    to: '',
    throwType: '',
    markdown: '',
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
export default function App() {
  const [db, setDb] = useState<Database>(emptyDatabase);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState<Route>(readRoute);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Entry | null>(null);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<{
    id: string;
    title: string;
    kind: 'entry' | 'command';
  } | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [lightbox, setLightbox] = useState<{ data: string; title: string } | null>(null);
  useEffect(() => {
    storage
      .load()
      .then(setDb)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const listener = () => {
      if (dirty && !window.confirm('Выйти из редактора? Несохранённые изменения будут потеряны.')) {
        history.pushState(null, '', '#' + encodeURIComponent(JSON.stringify(route)));
        return;
      }
      setDirty(false);
      setDraft(null);
      setSearch('');
      setRoute(readRoute());
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) {
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
  }, [dirty, route]);
  function navigate(next: Route, force = false) {
    if (
      !force &&
      dirty &&
      !window.confirm('Выйти из редактора? Несохранённые изменения будут потеряны.')
    )
      return;
    setDirty(false);
    setDraft(null);
    setSearch('');
    setError('');
    setRoute(next);
    history.pushState(null, '', '#' + encodeURIComponent(JSON.stringify(next)));
    window.scrollTo(0, 0);
  }
  function edit(entry: Entry) {
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
  async function persist(data: Database) {
    const saved = await storage.save(data);
    setDb(saved);
  }
  const map = maps.find((m) => m.id === route.mapId);
  const category = categories.find((c) => c.id === route.categoryId);
  const selected = db.entries.find((e) => e.id === route.entryId);
  const query = search.trim().toLocaleLowerCase('ru');
  const entries = db.entries
    .filter(
      (e) =>
        (!map || e.mapId === map.id) &&
        (route.page !== 'list' || e.categoryId === category?.id) &&
        (!query ||
          `${e.title} ${e.from} ${e.to} ${e.throwType} ${e.markdown} ${maps.find((m) => m.id === e.mapId)?.name}`
            .toLocaleLowerCase('ru')
            .includes(query)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activePage = ['map', 'list', 'detail', 'editor'].includes(route.page) ? 'maps' : route.page;
  async function backup(action: 'export' | 'import') {
    setBusy(true);
    setError('');
    try {
      if (action === 'export') {
        if (await storage.exportBackup()) setToast('Резервная копия сохранена');
      } else {
        const imported = await storage.importBackup();
        if (imported) {
          setDb(imported);
          setLoadError('');
          setToast('Библиотека восстановлена');
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError('');
    try {
      await persist({
        ...db,
        ...(deleting.kind === 'entry'
          ? { entries: db.entries.filter((e) => e.id !== deleting.id) }
          : { commands: db.commands.filter((c) => c.id !== deleting.id) }),
      });
      setDeleting(null);
      setToast('Удалено');
      if (route.page === 'detail')
        navigate({ page: 'list', mapId: route.mapId, categoryId: route.categoryId });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function cards(items: Entry[]) {
    return (
      <div className="entry-grid">
        {items.map((entry) => {
          const cat = categories.find((c) => c.id === entry.categoryId)!;
          const Icon = categoryIcons[entry.categoryId];
          return (
            <article className={`entry-card ${cat.utility ? '' : 'note-card'}`} key={entry.id}>
              <button
                className="card-main"
                onClick={() =>
                  navigate({
                    page: 'detail',
                    mapId: entry.mapId,
                    categoryId: entry.categoryId,
                    entryId: entry.id,
                  })
                }
              >
                {cat.utility && (
                  <div className="entry-image">
                    {entry.images[2] || entry.images[0] ? (
                      <img src={(entry.images[2] || entry.images[0]).data} alt={entry.title} />
                    ) : (
                      <Icon size={38} strokeWidth={1} />
                    )}
                    <span className="image-badge">
                      {maps.find((m) => m.id === entry.mapId)?.name}
                    </span>
                  </div>
                )}
                <div className="entry-body">
                  <span className="eyebrow">
                    <Icon size={13} /> {cat.name}
                  </span>
                  <h3>{entry.title}</h3>
                  {cat.utility ? (
                    <>
                      <p className="route-line">
                        {entry.from}
                        <ArrowRight size={14} />
                        {entry.to}
                      </p>
                      <span className="tag">{entry.throwType}</span>
                    </>
                  ) : (
                    <p className="muted">
                      {maps.find((m) => m.id === entry.mapId)?.name} · {entry.images.length}{' '}
                      скриншотов
                    </p>
                  )}
                </div>
              </button>
              <div className="card-actions">
                <button
                  className="icon-button"
                  aria-label={`Редактировать ${entry.title}`}
                  onClick={() => edit(entry)}
                >
                  <Edit3 size={16} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`Удалить ${entry.title}`}
                  onClick={() => setDeleting({ id: entry.id, title: entry.title, kind: 'entry' })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    );
  }
  function empty(title: string, description: string, add?: () => void) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <FolderOpen size={34} strokeWidth={1.3} />
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        {add && (
          <button className="primary" onClick={add}>
            <Plus size={18} />
            Добавить материал
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
          <p>Открываю библиотеку…</p>
        </div>
      );
    if (loadError)
      return (
        <div className="empty-state">
          <DatabaseIcon size={35} />
          <h2>Не удалось открыть библиотеку</h2>
          <p className="error">{loadError}</p>
          <button disabled={busy} className="primary" onClick={() => void backup('import')}>
            <Upload size={18} />
            Восстановить из копии
          </button>
        </div>
      );
    if (route.page === 'editor' && draft)
      return (
        <Editor
          key={draft.id}
          entry={draft}
          customThrows={db.customThrows}
          dirty={() => setDirty(true)}
          cancel={() =>
            navigate({ page: 'list', mapId: draft.mapId, categoryId: draft.categoryId })
          }
          save={async (entry, customThrows) => {
            await persist({
              ...db,
              customThrows,
              entries: [...db.entries.filter((e) => e.id !== entry.id), entry],
            });
            navigate(
              {
                page: 'detail',
                mapId: entry.mapId,
                categoryId: entry.categoryId,
                entryId: entry.id,
              },
              true,
            );
            setToast('Материал сохранён');
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
                ТВОЯ ЛИЧНАЯ БАЗА ЗНАНИЙ
              </span>
              <h1>
                Хороший раунд
                <br />
                начинается <span>до игры.</span>
              </h1>
              <p>
                Раскидки, позиции и тактики — всё, что нужно
                <br className="desktop-break" /> помнить, в одном месте.
              </p>
              <div className="hero-meta">
                <span>
                  <HardDrive size={14} />
                  Всегда под рукой
                </span>
                <span>
                  <ShieldCheck size={14} />
                  Работает офлайн
                </span>
              </div>
            </div>
            <div className="radar-art" aria-hidden="true">
              <div className="radar-ring ring-one" />
              <div className="radar-ring ring-two" />
              <div className="radar-ring ring-three" />
              <Crosshair className="radar-cross" size={110} strokeWidth={0.6} />
              <span className="radar-point point-a">A</span>
              <span className="radar-point point-b">B</span>
              <span className="radar-coord">CS2 / FIELD NOTES</span>
            </div>
          </section>
          <div className="section-heading">
            <div>
              <h2>{query ? 'Поиск по библиотеке' : 'Выбери карту'}</h2>
              <p>
                {query
                  ? `Результатов: ${entries.length}`
                  : 'Собери свою коллекцию полезного для каждой карты.'}
              </p>
            </div>
            <span className="count-badge">{query ? `${entries.length} материалов` : '7 карт'}</span>
          </div>
          {query ? (
            entries.length ? (
              cards(entries)
            ) : (
              empty('Ничего не найдено', 'Попробуй другое название, позицию или способ броска.')
            )
          ) : (
            <div className="map-grid">
              {maps.map((item, index) => (
                <button
                  className={`map-card map-${item.id}`}
                  key={item.id}
                  style={{ '--map-color': item.color } as CSSProperties}
                  onClick={() => navigate({ page: 'map', mapId: item.id })}
                >
                  <div className="map-art" aria-hidden="true">
                    <span className="map-index">
                      0{index + 1} / DE_{item.id.toUpperCase()}
                    </span>
                    <div className="map-plan">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="map-monogram">{item.code}</span>
                    <span className="map-site">A</span>
                  </div>
                  <div className="map-info">
                    <div>
                      <h3>{item.name}</h3>
                      <span>{db.entries.filter((e) => e.mapId === item.id).length} материалов</span>
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
              <p>
                Твой опыт — твоя библиотека.<span> Выбери карту и добавь первый материал.</span>
              </p>
              <span className="push">LOCAL FIRST</span>
            </div>
          )}
        </>
      );
    if (route.page === 'map' && map)
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">БИБЛИОТЕКА КАРТЫ / {map.code}</span>
              <h1>{map.name}</h1>
              <p>{map.subtitle}</p>
            </div>
            <span className="count-badge">
              {db.entries.filter((e) => e.mapId === map.id).length} материалов
            </span>
          </div>
          {query ? (
            entries.length ? (
              cards(entries)
            ) : (
              empty('Ничего не найдено', 'Попробуй изменить запрос.')
            )
          ) : (
            <div className="category-grid">
              {categories.map((cat) => {
                const Icon = categoryIcons[cat.id];
                return (
                  <button
                    className="category-card"
                    key={cat.id}
                    onClick={() => navigate({ page: 'list', mapId: map.id, categoryId: cat.id })}
                  >
                    <div className={`category-icon ${cat.id}`}>
                      <Icon size={27} strokeWidth={1.5} />
                    </div>
                    <h2>{cat.name}</h2>
                    <p>{cat.note}</p>
                    <div>
                      <span>
                        {
                          db.entries.filter((e) => e.mapId === map.id && e.categoryId === cat.id)
                            .length
                        }{' '}
                        материалов
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
              <span className="eyebrow">{map.name} / БИБЛИОТЕКА</span>
              <h1>{category.name}</h1>
              <p>{category.note}</p>
            </div>
            <button className="primary" onClick={() => edit(newEntry(map.id, category.id))}>
              <Plus size={18} />
              {category.utility ? 'Добавить гранату' : 'Добавить материал'}
            </button>
          </div>
          <div className="list-summary">
            <span>{entries.length} материалов</span>
            <span>Сначала недавно изменённые</span>
          </div>
          {entries.length
            ? cards(entries)
            : query
              ? empty('Ничего не найдено', 'Попробуй изменить запрос.')
              : empty(
                  'Здесь начинается твоя коллекция',
                  category.utility
                    ? 'Добавь первую раскидку: позицию, прицел и результат броска.'
                    : 'Сохрани полезную идею, добавь скриншоты и описание.',
                  () => edit(newEntry(map.id, category.id)),
                )}
        </>
      );
    if (route.page === 'detail' && selected && map && category)
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {map.name} / {category.name}
              </span>
              <h1>{selected.title}</h1>
              {category.utility && (
                <p className="detail-route">
                  {selected.from}
                  <ArrowRight size={18} />
                  {selected.to}
                  <span className="tag">{selected.throwType}</span>
                </p>
              )}
            </div>
            <div className="button-row">
              <button className="secondary" onClick={() => edit(selected)}>
                <Edit3 size={17} />
                Редактировать
              </button>
              <button
                className="secondary danger"
                aria-label="Удалить материал"
                onClick={() =>
                  setDeleting({ id: selected.id, title: selected.title, kind: 'entry' })
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
          <div className="detail-shots">
            {selected.images.map((shot, index) => (
              <figure key={shot.id}>
                <figcaption>
                  <span className="step">{String(index + 1).padStart(2, '0')}</span>
                  {category.utility
                    ? ['Где стоять', 'Куда целиться', 'Результат броска'][index] ||
                      `Скриншот ${index + 1}`
                    : `Скриншот ${index + 1}`}
                  <span className="muted push">Нажми, чтобы увеличить</span>
                </figcaption>
                <button onClick={() => setLightbox({ data: shot.data, title: shot.name })}>
                  <img src={shot.data} alt={shot.name} />
                </button>
              </figure>
            ))}
          </div>
          {!selected.images.length && (
            <div className="no-images">
              <ImageIcon size={25} />
              <span>Скриншоты пока не добавлены</span>
            </div>
          )}
          {selected.markdown && (
            <section className="form-panel">
              <h2>{category.utility ? 'Заметки' : 'Описание'}</h2>
              <Markdown>{selected.markdown}</Markdown>
            </section>
          )}
          <p className="field-hint">
            Изменено: {new Date(selected.updatedAt).toLocaleString('ru-RU')}
          </p>
        </>
      );
    if (route.page === 'commands') {
      const commands = db.commands.filter((c) =>
        `${c.title} ${c.command}`.toLowerCase().includes(query),
      );
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">ИНСТРУМЕНТЫ</span>
              <h1>Консольные команды</h1>
              <p>Нужная команда — в одном нажатии.</p>
            </div>
            <button
              className="primary"
              onClick={() => setCommand({ id: crypto.randomUUID(), title: '', command: '' })}
            >
              <Plus size={18} />
              Добавить команду
            </button>
          </div>
          <div className="command-list">
            {commands.map((cmd) => (
              <article className="command-card" key={cmd.id}>
                <div className="command-icon">
                  <Terminal size={22} />
                </div>
                <div className="command-content">
                  <h3>{cmd.title}</h3>
                  <code>{cmd.command}</code>
                </div>
                <div className="button-row">
                  <button
                    className="icon-button"
                    aria-label={`Копировать ${cmd.title}`}
                    onClick={() => {
                      void storage
                        .copy(cmd.command)
                        .then(() => setToast('Команда скопирована'))
                        .catch((e) => setError(e.message));
                    }}
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Редактировать ${cmd.title}`}
                    onClick={() => setCommand(cmd)}
                  >
                    <Edit3 size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Удалить ${cmd.title}`}
                    onClick={() => setDeleting({ id: cmd.id, title: cmd.title, kind: 'command' })}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!commands.length &&
            empty(
              query ? 'Ничего не найдено' : 'Твои команды будут здесь',
              query
                ? 'Попробуй другой запрос.'
                : 'Добавляй команды для тренировок и настройки игры.',
            )}
        </>
      );
    }
    if (route.page === 'settings')
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">ЛОКАЛЬНОЕ ХРАНЕНИЕ</span>
              <h1>Твоя библиотека</h1>
              <p>Данные принадлежат тебе. Сохрани копию для переноса на другой компьютер.</p>
            </div>
          </div>
          <div className="stats-grid">
            <div>
              <strong>{db.entries.length}</strong>
              <span>материалов</span>
            </div>
            <div>
              <strong>{db.entries.reduce((sum, e) => sum + e.images.length, 0)}</strong>
              <span>скриншотов</span>
            </div>
            <div>
              <strong>{db.commands.length}</strong>
              <span>команд</span>
            </div>
          </div>
          <section className="form-panel">
            <div className="panel-title">
              <DatabaseIcon size={22} />
              <h2>Резервные копии</h2>
            </div>
            <p className="muted">
              Экспорт включает все материалы, скриншоты, команды и свои способы броска. Импорт
              заменяет текущую библиотеку после подтверждения.
            </p>
            <div className="button-row">
              <button disabled={busy} className="primary" onClick={() => void backup('export')}>
                <Download size={18} />
                Экспортировать
              </button>
              <button disabled={busy} className="secondary" onClick={() => void backup('import')}>
                <Upload size={18} />
                Восстановить из копии
              </button>
            </div>
          </section>
          <div className="info-note">
            <ShieldCheck size={21} />
            <p>
              Изменения сохраняются при нажатии «Сохранить». В приложении предыдущая версия базы
              остаётся в файле library.json.bak. Общий размер библиотеки — до 100 МБ.
            </p>
          </div>
        </>
      );
    if (['aim', 'peeks', 'crosshairs'].includes(route.page))
      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">ИНСТРУМЕНТЫ</span>
              <h1>{sideItems.find((item) => item.page === route.page)?.title}</h1>
            </div>
            <span className="count-badge">Скоро</span>
          </div>
          {empty(
            'Место для новых возможностей',
            'Раздел подготовлен. Наполнение появится на следующем этапе.',
          )}
        </>
      );
    return empty('Материал не найден', 'Вернись к картам и выбери нужный раздел.');
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate({ page: 'maps' })}>
          <span className="brand-mark">
            <Crosshair size={26} />
          </span>
          <span>
            CS2<span className="brand-subtitle">ASSISTANT</span>
          </span>
          <span className="version">01</span>
        </button>
        <div className="nav-caption">ТВОЙ СПРАВОЧНИК</div>
        <nav aria-label="Основная навигация">
          {sideItems.map((item) => (
            <button
              key={item.page}
              aria-label={item.title}
              title={item.title}
              className={`nav-item ${activePage === item.page ? 'active' : ''}`}
              onClick={() => navigate({ page: item.page })}
            >
              <item.icon size={19} strokeWidth={1.6} />
              <span>{item.title}</span>
              {item.page === 'maps' && <span className="nav-count">7</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="library-status">
            <span className="status-dot" />
            <span>
              Локальная библиотека<small>{db.entries.length} материалов сохранено</small>
            </span>
          </div>
          <button
            aria-label="Данные и резервные копии"
            title="Данные и резервные копии"
            className={`nav-item ${route.page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate({ page: 'settings' })}
          >
            <ArrowDownToLine size={18} />
            <span>Данные и резервные копии</span>
          </button>
          <div className="sidebar-footer">
            CS2 ASSISTANT <span>v0.1.0</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <button onClick={() => navigate({ page: 'maps' })}>
              <Grid2X2 size={16} />
              <span>Библиотека</span>
            </button>
            {map && (
              <>
                <ChevronRight size={14} />
                <button onClick={() => navigate({ page: 'map', mapId: map.id })}>{map.name}</button>
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
                  {category.name}
                </button>
              </>
            )}
          </div>
          {['maps', 'map', 'list', 'commands'].includes(route.page) && (
            <label className="search">
              <Search size={17} />
              <input
                aria-label="Поиск"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Найти в библиотеке…"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Очистить поиск">
                  <X size={15} />
                </button>
              )}
            </label>
          )}
          <span className="offline">
            <span className="status-dot" />
            Офлайн
          </span>
        </header>
        <main>
          {!window.desktop && (
            <div className="preview-banner">
              Предпросмотр интерфейса · изменения исчезнут при перезагрузке. Для сохранения запусти
              приложение через npm start.
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                className="icon-button"
                onClick={() => setError('')}
                aria-label="Закрыть ошибку"
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
              {route.page === 'detail'
                ? 'К списку'
                : route.page === 'list'
                  ? 'К разделам карты'
                  : 'Все карты'}
            </button>
          )}
          {content()}
        </main>
        <footer className="main-footer">
          <span>Меньше искать. Больше играть.</span>
          <span>СОБРАНО ТОБОЙ. ДЛЯ ТВОЕЙ ИГРЫ.</span>
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
          title="Удалить запись?"
          close={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>«{deleting.title}» будет удалена из библиотеки.</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button disabled={busy} className="secondary" onClick={() => setDeleting(null)}>
              Отмена
            </button>
            <button disabled={busy} className="primary destructive" onClick={() => void remove()}>
              {busy ? 'Удаляю…' : 'Удалить'}
            </button>
          </div>
        </Modal>
      )}
      {command && (
        <CommandEditor
          command={command}
          close={() => setCommand(null)}
          save={async (cmd) => {
            await persist({
              ...db,
              commands: [...db.commands.filter((c) => c.id !== cmd.id), cmd],
            });
            setCommand(null);
            setToast('Команда сохранена');
          }}
        />
      )}
      {lightbox && (
        <Modal title={lightbox.title} wide close={() => setLightbox(null)}>
          <img className="lightbox-image" src={lightbox.data} alt={lightbox.title} />
        </Modal>
      )}
    </div>
  );
}
function CommandEditor({
  command,
  close,
  save,
}: {
  command: Command;
  close: () => void;
  save: (cmd: Command) => Promise<void>;
}) {
  const [title, setTitle] = useState(command.title);
  const [text, setText] = useState(command.command);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ ...command, title: title.trim(), command: text.trim() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (
      !busy &&
      ((title === command.title && text === command.command) ||
        window.confirm('Закрыть без сохранения?'))
    )
      close();
  }
  return (
    <Modal title={command.title ? 'Редактировать команду' : 'Новая команда'} close={cancel}>
      <form onSubmit={submit}>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={busy}>
          <label>
            Название
            <input
              autoFocus
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например, показать FPS"
            />
          </label>
          <label>
            Команда
            <textarea
              required
              maxLength={10000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="cl_showfps 1"
            />
          </label>
          <p className="field-hint">
            Команда только хранится и копируется. В игре её нужно выполнить самостоятельно.
          </p>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={cancel}>
              Отмена
            </button>
            <button className="primary" type="submit">
              {busy ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

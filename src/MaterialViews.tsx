import { useState } from 'react';
import { ArrowRight, Edit3, ImageIcon, Pin, Trash2, Share2 } from 'lucide-react';
import { type Category, type Entry, type MapId, type Shot, maps, entryShotCount } from './model';
import { useI18n } from './i18n';
import { categoryName } from './messages';
import { categoryIcon, Markdown, PinButton, ShotVisual, type Lightbox } from './components';
import { mapAssets, positionsFor } from './assets';
import { VideoPlayer } from './VideoPlayer';

export function MaterialCards({
  entries,
  categories,
  busy,
  open,
  edit,
  remove,
  pin,
  tag,
  share,
}: {
  entries: Entry[];
  categories: Category[];
  busy: boolean;
  open: (entry: Entry) => void;
  edit: (entry: Entry) => void;
  remove: (entry: Entry) => void;
  pin: (entry: Entry) => void;
  tag: (tag: string) => void;
  share: (entry: Entry) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="entry-grid">
      {entries.map((entry) => {
        const cat = categories.find((c) => c.id === entry.categoryId)!;
        const Icon = categoryIcon(cat.id);
        const visual = cat.kind !== 'note';
        const thumb =
          cat.kind === 'lineup'
            ? (entry.cover ?? entry.lineups.find((l) => l.result)?.result ?? entry.images[0])
            : (entry.images[2] ?? entry.images[0]);
        return (
          <article
            className={`entry-card ${visual ? '' : 'note-card'} ${entry.pinned ? 'pinned-card' : ''}`}
            key={entry.id}
            data-entry-id={entry.id}
          >
            <button className="card-main" onClick={() => open(entry)}>
              {visual && (
                <div className="entry-image">
                  {thumb ? (
                    <img src={thumb.data} alt={entry.title} />
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
                  <Icon size={13} />
                  {categoryName(cat, t)}
                  {entry.pinned && <Pin size={13} className="push" aria-label={t('pinned')} />}
                </span>
                <h3>{entry.title}</h3>
                {visual ? (
                  <>
                    <p className="route-line">
                      {entry.from}
                      <ArrowRight size={14} />
                      {cat.kind === 'lineup'
                        ? `${entry.lineups.length} ${t('cat_lineup')}`
                        : entry.to}
                    </p>
                    {cat.kind === 'utility' && <span className="tag">{entry.throwType}</span>}
                  </>
                ) : (
                  <p className="muted">
                    {maps.find((m) => m.id === entry.mapId)?.name} ·{' '}
                    {t('screenshotsCount', { count: entryShotCount(entry) })}
                  </p>
                )}
              </div>
            </button>
            {!!entry.tags.length && (
              <div className="tags card-tags">
                {entry.tags.map((value) => (
                  <button key={value} className="tag" onClick={() => tag(value)}>
                    #{value}
                  </button>
                ))}
              </div>
            )}
            <div className="card-actions">
              <button
                className="icon-button"
                disabled={busy}
                aria-label={`${t('shareMaterial')} ${entry.title}`}
                title={t('shareMaterial')}
                onClick={() => share(entry)}
              >
                <Share2 size={17} />
              </button>
              <PinButton
                pinned={entry.pinned}
                name={entry.title}
                disabled={busy}
                toggle={() => pin(entry)}
              />
              <button
                className="icon-button"
                disabled={busy}
                aria-label={`${t('edit')} ${entry.title}`}
                onClick={() => edit(entry)}
              >
                <Edit3 size={16} />
              </button>
              <button
                className="icon-button danger"
                disabled={busy}
                aria-label={`${t('remove')} ${entry.title}`}
                onClick={() => remove(entry)}
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
export function MaterialDetail({
  entry,
  category,
  busy,
  edit,
  remove,
  pin,
  enlarge,
  share,
}: {
  entry: Entry;
  category: Category;
  busy: boolean;
  edit: () => void;
  remove: () => void;
  pin: () => void;
  enlarge: (shot: Lightbox) => void;
  share: () => void;
}) {
  const { t, language } = useI18n();
  const labels = [t('standing'), t('aiming'), t('result')];
  function shot(shot: Shot | null, title: string, caption?: string) {
    return (
      <figure key={shot?.id ?? title}>
        <figcaption>
          {title}
          <span className="muted push">{shot ? t('enlarge') : t('missingShot')}</span>
        </figcaption>
        {shot ? (
          <button
            className="image-open"
            onClick={() => enlarge({ data: shot.data, title, caption })}
          >
            <ShotVisual data={shot.data} title={shot.name} caption={caption} />
          </button>
        ) : (
          <div className="no-images">
            <ImageIcon size={24} />
            {t('missingShot')}
          </div>
        )}
      </figure>
    );
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {maps.find((m) => m.id === entry.mapId)?.name} / {categoryName(category, t)}
          </span>
          <h1>{entry.title}</h1>
          {category.kind !== 'note' && (
            <p className="detail-route">
              {entry.from}
              {category.kind === 'utility' && (
                <>
                  <ArrowRight size={18} />
                  {entry.to}
                  <span className="tag">{entry.throwType}</span>
                </>
              )}
            </p>
          )}
          <div className="tags">
            {entry.tags.map((tag) => (
              <span className="tag" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="button-row">
          <button className="secondary" disabled={busy} onClick={share}>
            <Share2 size={17} />
            {t('shareMaterial')}
          </button>
          <PinButton name={entry.title} pinned={entry.pinned} disabled={busy} toggle={pin} />
          <button className="secondary" onClick={edit}>
            <Edit3 size={17} />
            {t('edit')}
          </button>
          <button
            className="secondary danger"
            disabled={busy}
            aria-label={`${t('remove')} ${entry.title}`}
            onClick={remove}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
      {category.kind === 'lineup' ? (
        <>
          <div className="detail-shots standing-detail">
            {shot(entry.images[0] ?? null, t('standing'))}
          </div>
          {entry.lineups.map((lineup, index) => (
            <section className="lineup-detail" key={lineup.id}>
              <div className="panel-title">
                <span className="step">{String(index + 1).padStart(2, '0')}</span>
                <h2>{lineup.to}</h2>
                <span className="tag push">{lineup.throwType}</span>
              </div>
              <div className="detail-shots lineup-pair">
                {shot(lineup.aim, t('aiming'), lineup.throwType)}
                {shot(lineup.result, t('result'))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <>
          <div className="detail-shots">
            {entry.images.map((image, index) =>
              shot(
                image,
                category.kind === 'utility' && index < 3
                  ? labels[index]
                  : t('screenshot', { number: index + 1 }),
                category.kind === 'utility' && index === 1 ? entry.throwType : undefined,
              ),
            )}
          </div>
          {!entry.images.length && (
            <div className="no-images">
              <ImageIcon size={25} />
              {t('noShots')}
            </div>
          )}
        </>
      )}
      {entry.markdown && (
        <section className="form-panel detail-markdown">
          <h2>{t(category.kind === 'note' ? 'description' : 'notes')}</h2>
          <Markdown>{entry.markdown}</Markdown>
        </section>
      )}
      {entry.videoUrl && <VideoPlayer key={entry.id + entry.videoUrl} url={entry.videoUrl} />}
      <p className="field-hint">
        {t('updated', { date: new Date(entry.updatedAt).toLocaleString(language) })}
      </p>
    </>
  );
}
export function MapPositions({
  mapId,
  enlarge,
}: {
  mapId: MapId;
  enlarge: (shot: Lightbox) => void;
}) {
  const { t } = useI18n();
  const [alternative, setAlternative] = useState(false);
  const map = maps.find((m) => m.id === mapId)!;
  const source = positionsFor(mapId, alternative);
  const title = t('mapImage', {
    map: map.name,
    variant: t(alternative ? 'alternative' : 'normal'),
  });
  return (
    <div className="map-position-layout">
      <div className="map-position-image">
        <button className="image-open" onClick={() => enlarge({ data: source, title })}>
          <img src={source} alt={title} />
        </button>
        <p className="field-hint">{t('mapHint')}</p>
      </div>
      <aside className="map-variants">
        <div className="segmented vertical" aria-label={t('mapTab')}>
          <button
            aria-pressed={!alternative}
            className={!alternative ? 'active' : ''}
            onClick={() => setAlternative(false)}
          >
            {t('normal')}
          </button>
          <button
            aria-pressed={alternative}
            className={alternative ? 'active' : ''}
            disabled={!mapAssets[mapId].alternative}
            onClick={() => setAlternative(true)}
          >
            {t('alternative')}
          </button>
        </div>
        {!mapAssets[mapId].alternative && <p className="field-hint">{t('noAlternative')}</p>}
      </aside>
    </div>
  );
}

import { createContext, useContext, useRef, useState } from 'react';
import type { Entry, GuideArticle, Category } from './model';
import { categoryName } from './messages';
import { maps } from './model';
import { useI18n } from './i18n';

export const internalLinkPattern =
  /^cs2:\/\/(material|guide)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
export function parseInternalLink(url: string) {
  const match = internalLinkPattern.exec(url);
  return match ? { kind: match[1].toLowerCase(), id: match[2].toLowerCase() } : null;
}
export const LinksContext = createContext<{
  entries: Entry[];
  articles: GuideArticle[];
  categories: Category[];
  open: (url: string) => void;
}>({ entries: [], articles: [], categories: [], open: () => {} });

export function MarkdownInput({
  value,
  change,
}: {
  value: string;
  change: (value: string) => void;
}) {
  const { t } = useI18n();
  const { entries, articles, categories } = useContext(LinksContext);
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: value.length, end: value.length });
  const targets = [
    ...entries.map((e) => ({
      id: e.id,
      title: e.title,
      kind: 'material',
      context: `${maps.find((m) => m.id === e.mapId)?.name} · ${categoryName(
        categories.find((c) => c.id === e.categoryId)!,
        t,
      )} · ${e.tags.join(' ')}`,
    })),
    ...articles.map((a) => ({ id: a.id, title: a.title, kind: 'guide', context: t('guide') })),
  ].filter((item) =>
    `${item.title} ${item.context}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  function insert(item: (typeof targets)[number]) {
    const { start, end } = selection.current;
    const label = (value.slice(start, end) || item.title)
      .replace(/[\\[\]]/g, '\\$&')
      .replace(/\n/g, ' ');
    const link = `[${label}](cs2://${item.kind}/${item.id})`;
    const next = value.slice(0, start) + link + value.slice(end);
    if (next.length > 100000) return;
    change(next);
    setChoosing(false);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(start + link.length, start + link.length);
    });
  }
  return (
    <>
      <button
        className="text-button"
        type="button"
        onClick={() => {
          if (input.current)
            selection.current = {
              start: input.current.selectionStart,
              end: input.current.selectionEnd,
            };
          setChoosing(!choosing);
        }}
      >
        {t('insertLink')}
      </button>
      {choosing && (
        <div className="link-picker">
          <input
            aria-label={t('linkSearch')}
            placeholder={t('linkSearch')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="link-results">
            {targets.map((item) => (
              <button
                className="secondary"
                type="button"
                key={item.id}
                onClick={() => insert(item)}
              >
                {item.title} · {item.context}
              </button>
            ))}
          </div>
          {!targets.length && <p>{t('noResults')}</p>}
        </div>
      )}
      <textarea
        ref={input}
        className="markdown-input"
        maxLength={100000}
        value={value}
        onSelect={(e) => {
          selection.current = {
            start: e.currentTarget.selectionStart,
            end: e.currentTarget.selectionEnd,
          };
        }}
        onChange={(e) => change(e.target.value)}
        placeholder={t('markdownPlaceholder')}
        aria-label={t('markdownLabel')}
      />
    </>
  );
}

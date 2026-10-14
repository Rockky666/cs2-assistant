import { useEffect, useRef, useContext, type ReactNode } from 'react';
import {
  X,
  Cloud,
  Bomb,
  Zap,
  Flame,
  MapPin,
  Route,
  Lightbulb,
  Layers3,
  Folder,
  Pin,
  PinOff,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LinksContext, parseInternalLink } from './links';
import { useI18n } from './i18n';

export const categoryIcons = {
  smoke: Cloud,
  he: Bomb,
  flash: Zap,
  molotov: Flame,
  position: MapPin,
  tactic: Route,
  tip: Lightbulb,
  lineup: Layers3,
};
export function categoryIcon(id: string) {
  return categoryIcons[id as keyof typeof categoryIcons] ?? Folder;
}
export function Markdown({ children }: { children: string }) {
  const links = useContext(LinksContext);
  const { t } = useI18n();
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => (parseInternalLink(url) ? url : '')}
        components={{
          a: ({ children, href }) =>
            href && parseInternalLink(href) ? (
              <button type="button" className="markdown-link" onClick={() => links.open(href)}>
                {children}
              </button>
            ) : (
              <span>{children}</span>
            ),
          img: ({ alt }) => (
            <span className="muted">[{t('markdownImage', { name: alt || t('addShots') })}]</span>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-label={title}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label={t('close')}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export type Lightbox = { data: string; title: string; caption?: string };
export function ShotVisual({
  data,
  title,
  caption,
  lightbox = false,
}: Lightbox & { lightbox?: boolean }) {
  return (
    <span className={`shot-visual ${lightbox ? 'enlarged' : ''}`}>
      <img src={data} alt={title} />
      {caption && <span className="throw-overlay">{caption}</span>}
    </span>
  );
}
export function PinButton({
  pinned,
  name,
  disabled,
  toggle,
}: {
  pinned: boolean;
  name: string;
  disabled?: boolean;
  toggle: () => void;
}) {
  const { t } = useI18n();
  const Icon = pinned ? PinOff : Pin;
  return (
    <button
      className={`icon-button ${pinned ? 'is-pinned' : ''}`}
      aria-label={`${t(pinned ? 'unpin' : 'pin')} ${name}`}
      title={t(pinned ? 'unpin' : 'pin')}
      aria-pressed={pinned}
      disabled={disabled}
      onClick={toggle}
    >
      <Icon size={17} />
    </button>
  );
}

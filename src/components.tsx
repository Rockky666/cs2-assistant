import { useEffect, useRef, type ReactNode } from 'react';
import { X, Cloud, Bomb, Zap, Flame, MapPin, Route, Lightbulb } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const categoryIcons = {
  smoke: Cloud,
  he: Bomb,
  flash: Zap,
  molotov: Flame,
  position: MapPin,
  tactic: Route,
  tip: Lightbulb,
};
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children }) => <span className="markdown-link">{children}</span>,
          img: ({ alt }) => (
            <span className="muted">[Изображение: {alt || 'добавьте файл в скриншоты'}]</span>
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
        <button className="icon-button" onClick={close} aria-label="Закрыть">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

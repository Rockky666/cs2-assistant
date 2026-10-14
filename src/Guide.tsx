import { useState } from 'react';
import type { Database, GuideArticle, GuideTopic } from './model';
import { useI18n } from './i18n';
import { errorText } from './messages';
import { Markdown, Modal } from './components';
import { MarkdownInput } from './links';

type Props = {
  db: Database;
  topicId?: string;
  articleId?: string;
  busy: boolean;
  navigate: (topicId?: string, articleId?: string, force?: boolean) => void;
  mutate: (update: (db: Database) => Database) => Promise<Database>;
  dirty: (value: boolean) => void;
};
export function Guide({ db, topicId, articleId, busy, navigate, mutate, dirty }: Props) {
  const { t } = useI18n();
  const [topicDraft, setTopicDraft] = useState<GuideTopic | null>(null);
  const [articleDraft, setArticleDraft] = useState<GuideArticle | null>(null);
  const [changed, setChanged] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const topic = db.guideTopics.find((x) => x.id === topicId);
  const article = db.guideArticles.find((x) => x.id === articleId && x.topicId === topicId);
  function touch() {
    setChanged(true);
    dirty(true);
  }
  function close() {
    if (busy || (changed && !window.confirm(t('unsaved')))) return;
    setTopicDraft(null);
    setArticleDraft(null);
    setChanged(false);
    dirty(false);
    setError(null);
  }
  async function save() {
    try {
      await mutate((current) => ({
        ...current,
        guideTopics: topicDraft
          ? [...current.guideTopics.filter((x) => x.id !== topicDraft.id), topicDraft]
          : current.guideTopics,
        guideArticles: articleDraft
          ? [
              ...current.guideArticles.filter((x) => x.id !== articleDraft.id),
              { ...articleDraft, updatedAt: new Date().toISOString() },
            ]
          : current.guideArticles,
      }));
      const nextTopic = topicDraft?.id ?? topicId;
      const nextArticle = articleDraft?.id;
      setTopicDraft(null);
      setArticleDraft(null);
      setChanged(false);
      dirty(false);
      setError(null);
      navigate(nextTopic, nextArticle, true);
    } catch (err) {
      setError(err);
    }
  }
  async function remove(kind: 'topic' | 'article', id: string) {
    if (!window.confirm(kind === 'topic' ? t('deleteTopic') : t('deleteTitle'))) return;
    try {
      await mutate((current) => ({
        ...current,
        guideTopics:
          kind === 'topic' ? current.guideTopics.filter((x) => x.id !== id) : current.guideTopics,
        guideArticles: current.guideArticles.filter((x) =>
          kind === 'topic' ? x.topicId !== id : x.id !== id,
        ),
      }));
      navigate(kind === 'topic' ? undefined : topicId);
    } catch (err) {
      setError(err);
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>{t('guide')}</h1>
          <p>{t('guideHint')}</p>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => setTopicDraft({ id: crypto.randomUUID(), title: '' })}
        >
          {t('addTopic')}
        </button>
      </div>
      {!!error && !topicDraft && !articleDraft && (
        <p className="error" role="alert">
          {errorText(error, t)}
        </p>
      )}
      <div className="guide-layout">
        <aside className="guide-topics">
          {db.guideTopics.map((item) => (
            <div className="guide-topic" key={item.id}>
              <button
                className={topicId === item.id ? 'primary' : 'secondary'}
                onClick={() => navigate(item.id)}
              >
                {item.title}
              </button>
              <button
                className="icon-button"
                disabled={busy}
                aria-label={`${t('edit')} ${item.title}`}
                onClick={() => setTopicDraft(item)}
              >
                ✎
              </button>
              <button
                className="icon-button danger"
                disabled={busy}
                aria-label={`${t('remove')} ${item.title}`}
                onClick={() => void remove('topic', item.id)}
              >
                ×
              </button>
            </div>
          ))}
        </aside>
        <section>
          {topic && (
            <div className="section-heading">
              <h2>{topic.title}</h2>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setPreview(false);
                  setArticleDraft({
                    id: crypto.randomUUID(),
                    topicId: topic.id,
                    title: '',
                    markdown: '',
                    updatedAt: new Date().toISOString(),
                  });
                }}
              >
                {t('addArticle')}
              </button>
            </div>
          )}
          {articleId && !article && <p role="alert">{t('missingLink')}</p>}
          {article ? (
            <article className="form-panel guide-detail">
              <div className="section-heading">
                <h2>{article.title}</h2>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() => {
                      setPreview(false);
                      setArticleDraft(article);
                    }}
                  >
                    {t('edit')}
                  </button>
                  <button
                    className="secondary danger"
                    disabled={busy}
                    onClick={() => void remove('article', article.id)}
                  >
                    {t('remove')}
                  </button>
                </div>
              </div>
              <Markdown>{article.markdown}</Markdown>
            </article>
          ) : (
            !articleId && (
              <div className="guide-articles">
                {db.guideArticles
                  .filter((x) => topic && x.topicId === topic.id)
                  .map((item) => (
                    <article className="guide-article" key={item.id}>
                      <button
                        className="text-button"
                        onClick={() => navigate(item.topicId, item.id)}
                      >
                        {item.title}
                      </button>
                    </article>
                  ))}
                {!topic && <p className="muted">{t('guideHint')}</p>}
              </div>
            )
          )}
        </section>
      </div>
      {(topicDraft || articleDraft) && (
        <Modal
          title={t(topicDraft ? 'topicTitle' : 'articleTitle')}
          close={close}
          wide={!!articleDraft}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {!!error && (
              <p className="error" role="alert">
                {errorText(error, t)}
              </p>
            )}
            <fieldset disabled={busy}>
              <label>
                {t(topicDraft ? 'topicTitle' : 'articleTitle')}
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={(topicDraft ?? articleDraft)!.title}
                  onChange={(e) => {
                    touch();
                    if (topicDraft) setTopicDraft({ ...topicDraft, title: e.target.value });
                    else if (articleDraft)
                      setArticleDraft({ ...articleDraft, title: e.target.value });
                  }}
                />
              </label>
              {articleDraft && (
                <>
                  <button className="secondary" type="button" onClick={() => setPreview(!preview)}>
                    {preview ? 'Markdown' : t('preview')}
                  </button>
                  {preview ? (
                    <Markdown>{articleDraft.markdown}</Markdown>
                  ) : (
                    <MarkdownInput
                      value={articleDraft.markdown}
                      change={(markdown) => {
                        touch();
                        setArticleDraft({ ...articleDraft, markdown });
                      }}
                    />
                  )}
                </>
              )}
              <div className="form-actions">
                <button className="secondary" type="button" onClick={close}>
                  {t('cancel')}
                </button>
                <button className="primary" type="submit">
                  {t(busy ? 'saving' : 'save')}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}

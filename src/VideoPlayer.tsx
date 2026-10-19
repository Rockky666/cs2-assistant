import { useState } from 'react';
import { youtubeVideo } from './video';
import { useI18n } from './i18n';
import { storage } from './storage';
import { errorText } from './messages';

export function VideoPlayer({ url }: { url: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<unknown>(null);
  const video = youtubeVideo(url);
  if (!video) return null;
  return (
    <section className="form-panel video-section">
      <div className="panel-title">
        <h2>{t('video')}</h2>
      </div>
      <iframe
        key={video.embedUrl}
        className="video-player"
        src={video.embedUrl}
        title={t('videoPlayer')}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
      />
      <p className="field-hint">{t('videoPlaybackHint')}</p>
      <button
        className="text-button"
        onClick={() => void storage.openVideo(video.watchUrl).catch(setError)}
      >
        {t('openVideo')}
      </button>
      {!!error && (
        <p className="error" role="alert">
          {errorText(error, t)}
        </p>
      )}
    </section>
  );
}

// Only video IDs are used to build embed URLs; user input never becomes an iframe URL.
export const VIDEO_REFERRER = 'https://com.rockky.cs2assistant/';
export function youtubeVideo(input: string) {
  try {
    const url = new URL(input.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port)
      return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (
      [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
      ].includes(host)
    ) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else id = /^\/(?:shorts|live|embed)\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
    }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    const time = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '';
    let start = 0;
    if (/^\d+$/.test(time)) start = Number(time);
    else {
      const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time);
      if (parts)
        start = Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0);
    }
    if (!Number.isSafeInteger(start) || start > 2147483647) start = 0;
    return {
      id,
      start,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&start=${start}`,
      watchUrl: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`,
    };
  } catch {
    return null;
  }
}

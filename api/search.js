import CryptoJS from 'crypto-js';

const cache = new Map();

function decryptMediaUrl(encrypted) {
  if (!encrypted) return null;
  try {
    const key = CryptoJS.enc.Utf8.parse('38346591');
    const ciphertext = CryptoJS.enc.Base64.parse(encrypted);
    const decrypted = CryptoJS.DES.decrypt({ ciphertext }, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8).replace(/\0/g, '').trim();
  } catch {
    return null;
  }
}

function cleanHtml(str) {
  if (!str) return '';
  return str.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
}

async function searchSaavn(query) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=20&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const data = await res.json();
    if (!data.results || !data.results.length) return [];

    const tracks = [];
    for (const s of data.results) {
      if (!s.encrypted_media_url) continue;
      const directUrl = decryptMediaUrl(s.encrypted_media_url);
      if (!directUrl) continue;

      const hqUrl = directUrl.replace(/_96\.mp4|_160\.mp4/, '_320.mp4');
      const durationSec = parseInt(s.duration, 10) || 210;
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      const cover = (s.image || '').replace(/150x150\.jpg|50x50\.jpg/, '500x500.jpg');

      tracks.push({
        id: `saavn-${s.id}`,
        title: cleanHtml(s.song || 'Unknown Song'),
        artist: cleanHtml(s.primary_artists || 'Unknown Artist'),
        album: cleanHtml(s.album || 'Single'),
        duration: durationStr,
        durationSec: durationSec,
        cover: cover,
        src: hqUrl,
        type: 'audio' // Direct native HTML5 audio stream for uninterrupted iOS background play!
      });
    }
    return tracks;
  } catch (err) {
    console.error('Saavn search error:', err.message);
    return [];
  }
}

async function searchYouTube(query) {
  const cacheKey = query.toLowerCase().trim();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en'
      }
    });
    const html = await res.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
    const videos = [];

    for (const item of contents) {
      const v = item.videoRenderer;
      if (v && v.videoId && v.title?.runs?.[0]?.text) {
        const titleText = v.title.runs.map(r => r.text).join('');
        const cleanTitle = titleText.replace(/(\(Official.*?\)|\[Official.*?\]|\(Lyric.*?\)|\[Lyric.*?\]|\(Audio\)|\[Audio\])/gi, '').trim();
        const artist = v.ownerText?.runs?.[0]?.text || 'Unknown Artist';
        const durationStr = v.lengthText?.simpleText || '3:30';

        const parts = durationStr.split(':').map(Number);
        const durationSec = parts.length === 2 ? parts[0] * 60 + parts[1] : (parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 210);

        const thumbs = v.thumbnail?.thumbnails || [];
        const bestThumb = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

        videos.push({
          id: `yt-${v.videoId}`,
          youtubeId: v.videoId,
          title: cleanTitle,
          artist: artist,
          album: 'YouTube Music',
          duration: durationStr,
          durationSec: durationSec,
          cover: bestThumb,
          type: 'youtube'
        });
      }
    }

    cache.set(cacheKey, videos);
    return videos;
  } catch (err) {
    console.error('Search error:', err.message);
    return [];
  }
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[.'"`]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRelevant(title, artist, query) {
  const normQuery = normalize(query);
  const normText = normalize(`${title} ${artist}`);
  
  if (normText.includes(normQuery)) return true;
  
  const compactQuery = normQuery.replace(/\s+/g, '');
  const compactText = normText.replace(/\s+/g, '');
  if (compactQuery.length >= 2 && compactText.includes(compactQuery)) return true;
  
  const qWords = normQuery.split(' ').filter(Boolean);
  return qWords.every(w => {
    const regex = new RegExp(`(^|\\s)${w}(\\s|$)`, 'i');
    return regex.test(normText);
  });
}

async function resolveDirectAudio(title, artist) {
  try {
    const cleanTitle = (title || '')
      .replace(/(\(.*?\)|\[.*?\])/g, '')
      .replace(/ft\..*|feat\..*/i, '')
      .replace(/official.*|lyrics.*|audio.*|music video|video/gi, '')
      .trim();
    const query = `${cleanTitle} ${artist || ''}`.trim();
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=3&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const data = await res.json();
    const match = (data.results || [])[0];
    if (match && match.encrypted_media_url) {
      const direct = decryptMediaUrl(match.encrypted_media_url);
      if (direct) {
        return {
          src: direct.replace(/_96\.mp4|_160\.mp4/, '_320.mp4'),
          cover: (match.image || '').replace(/150x150\.jpg|50x50\.jpg/, '500x500.jpg')
        };
      }
    }
  } catch (_) {}
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const q = req.query.q || '';
  if (!q) {
    res.status(200).json({ tracks: [] });
    return;
  }

  const ytUrlMatch = q.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytUrlMatch) {
    const vid = ytUrlMatch[1];
    res.status(200).json({
      tracks: [{
        id: `yt-${vid}`,
        youtubeId: vid,
        title: 'Custom YouTube Track',
        artist: 'YouTube',
        album: 'Direct Stream',
        duration: '3:30',
        durationSec: 210,
        cover: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        type: 'youtube'
      }]
    });
    return;
  }

  // Run both searches in parallel
  const [saavnRaw, ytRaw] = await Promise.all([
    searchSaavn(q),
    searchYouTube(q)
  ]);

  // Keep genuinely relevant JioSaavn tracks (for 320kbps direct stream)
  const relevantSaavn = saavnRaw.filter(t => isRelevant(t.title, t.artist, q));

  // Auto-upgrade YouTube tracks to direct 320kbps CDN audio for iOS background playback
  await Promise.all(ytRaw.slice(0, 10).map(async (yt) => {
    const direct = await resolveDirectAudio(yt.title, yt.artist);
    if (direct && direct.src) {
      yt.src = direct.src;
      yt.type = 'audio';
      if (direct.cover) yt.cover = direct.cover;
    }
  }));

  // Combine and deduplicate
  const combined = [];
  const seen = new Set();

  for (const t of relevantSaavn) {
    const key = `${normalize(t.title)}__${normalize(t.artist)}`;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(t);
    }
  }

  for (const t of ytRaw) {
    const key = normalize(t.title);
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(t);
    }
  }

  const finalTracks = combined.length > 0 ? combined : ytRaw;
  res.status(200).json({ tracks: finalTracks });
}

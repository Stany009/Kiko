import CryptoJS from 'crypto-js';

const TRENDING_QUERIES = [
  'top hits english',
  'trending pop english',
  'chill lofi beats',
  'electronic dance hits'
];

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
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=12&q=${encodeURIComponent(query)}`;
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
    console.error('Saavn trending error:', err.message);
    return [];
  }
}

async function searchYouTube(query) {
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
    return videos;
  } catch (err) {
    console.error('Trending error:', err.message);
    return [];
  }
}

async function getCategoryTracks(query) {
  const saavnTracks = await searchSaavn(query);
  if (saavnTracks && saavnTracks.length > 0) return saavnTracks;
  return searchYouTube(query);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const results = await Promise.all(TRENDING_QUERIES.map(q => getCategoryTracks(q)));
  res.status(200).json({
    hits: results[0] || [],
    pop: results[1] || [],
    chill: results[2] || [],
    electronic: results[3] || []
  });
}

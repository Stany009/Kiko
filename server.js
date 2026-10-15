import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CryptoJS from 'crypto-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables if .env exists
if (fs.existsSync(path.join(__dirname, '.env'))) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(path.join(__dirname, '.env'));
    } else {
      const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
      envContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
        if (match) {
          const key = match[1];
          let val = match[2] || '';
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      });
    }
  } catch (err) {
    console.warn('Could not parse .env:', err.message);
  }
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

const cache = new Map();

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

const TRENDING_QUERIES = [
  'top global hits billboard',
  'trending pop music',
  'chill lofi beats',
  'electronic dance hits'
];

async function getTrending() {
  const results = await Promise.all(TRENDING_QUERIES.map(async (q) => {
    const saavnTracks = await searchSaavn(q);
    if (saavnTracks && saavnTracks.length > 0) return saavnTracks;
    return searchYouTube(q);
  }));
  return {
    hits: results[0] || [],
    pop: results[1] || [],
    chill: results[2] || [],
    electronic: results[3] || []
  };
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Search
  if (pathname === '/api/search') {
    const q = parsedUrl.searchParams.get('q') || '';
    if (!q) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tracks: [] }));
      return;
    }

    // Direct YouTube link match
    const ytUrlMatch = q.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytUrlMatch) {
      const vid = ytUrlMatch[1];
      const single = [{
        id: `yt-${vid}`,
        youtubeId: vid,
        title: 'Custom YouTube Track',
        artist: 'YouTube',
        album: 'Direct Stream',
        duration: '3:30',
        durationSec: 210,
        cover: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        type: 'youtube'
      }];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tracks: single }));
      return;
    }

    const [saavnRaw, ytRaw] = await Promise.all([
      searchSaavn(q),
      searchYouTube(q)
    ]);

    // Keep genuinely relevant JioSaavn tracks (for 320kbps direct stream)
    const relevantSaavn = saavnRaw.filter(t => isRelevant(t.title, t.artist, q));

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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tracks: finalTracks }));
    return;
  }

  // API: Trending
  if (pathname === '/api/trending') {
    const trending = await getTrending();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(trending));
    return;
  }

  // API: Public Config for Supabase
  if (pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL || 'https://lbyvueqbjqkilmamlqml.supabase.co',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieXZ1ZXFianFraWxtYW1scW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDMzODIsImV4cCI6MjA3NjAxOTM4Mn0.L1r-sXzN9w_xP721-iQz7fK8eM4k8v6d9n3q2b1y5w0'
    }));
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  // If file doesn't exist, serve index.html (SPA fallback)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'index.html');
  }

  const contentType = MIME_TYPES[ext] || 'text/html';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

export default function handler(req, res) {
  return new Promise((resolve) => {
    server.emit('request', req, res);
    res.on('finish', resolve);
  });
}

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Kiko server is running on http://localhost:${PORT}`);
  });
}

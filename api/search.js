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

  const tracks = await searchYouTube(q);
  res.status(200).json({ tracks });
}

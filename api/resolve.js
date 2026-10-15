import CryptoJS from 'crypto-js';

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

  const title = req.query.title || '';
  const artist = req.query.artist || '';

  const direct = await resolveDirectAudio(title, artist);
  if (direct && direct.src) {
    res.status(200).json({ success: true, src: direct.src, cover: direct.cover, type: 'audio' });
  } else {
    res.status(200).json({ success: false });
  }
}

/* Ported from /public/spotify/js/script.js — pure helpers, no DOM access */

export function fmt(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '0:00';
  sec = Math.floor(sec);
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

export function bigArt(url, size = 300) {
  if (!url) return '';
  return url
    .replace('100x100bb', size + 'x' + size + 'bb')
    .replace('60x60bb', size + 'x' + size + 'bb');
}

export function fmtDur(ms) {
  if (!ms) return '';
  return fmt(Math.round(ms / 1000));
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- SEARCH ACCURACY ----------
export function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft|featuring|with|x)\b\.?/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s) {
  return norm(s).split(' ').filter((w) => w.length > 1);
}

export const BAD_VER = ['karaoke', 'tribute', 'cover', 'remix', 'sped up', 'slowed', '8d', 'nightcore', 'instrumental', 'lullaby', 'chipmunk', 'parody', 'ringtone', '1 hour', '10 hours'];

export function scoreTrack(t, q) {
  const qn = norm(q), qt = tokens(q);
  if (!qt.length) return 0;
  const tn = norm(t.trackName), an = norm(t.artistName);
  let s = 0;
  if (tn === qn) s += 100;
  const hay = tn + ' ' + an;
  let hit = 0;
  qt.forEach((w) => { if (hay.includes(w)) hit++; });
  s += (hit / qt.length) * 60;
  if (qt[0] && tn.startsWith(qt[0])) s += 15;
  if (qt.length > 1 && an.includes(qt[qt.length - 1])) s += 10;
  const low = ((t.trackName || '') + ' ' + (t.collectionName || '')).toLowerCase();
  const askedBad = BAD_VER.some((b) => qn.includes(b));
  if (!askedBad) BAD_VER.forEach((b) => { if (low.includes(b)) s -= 25; });
  if (!qn.includes('live') && /\blive\b/.test(low)) s -= 8;
  if (t.trackTimeMillis && t.trackTimeMillis < 60000) s -= 10;
  return s;
}

export function dedupeTracks(results) {
  const seen = new Set(), out = [];
  for (const t of results) {
    const k = norm(t.trackName) + '|' + norm(t.artistName);
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out;
}

export function scoreVideo(title, q) {
  const qt = tokens(q);
  if (!qt.length) return 0;
  const tt = norm(title);
  if (!tt) return 0;
  let hit = 0;
  qt.forEach((w) => { if (tt.includes(w)) hit++; });
  let s = (hit / qt.length) * 60;
  if (/official/.test(tt)) s += 20;
  if (/lyric/.test(tt)) s += 5;
  if (/topic/.test(tt)) s += 8;
  const qn = norm(q);
  BAD_VER.forEach((b) => { if (!qn.includes(b) && tt.includes(b)) s -= 30; });
  return s;
}

// ---------- ITUNES SEARCH (free, no API key) ----------
export async function itunesSearch(term, limit = 20) {
  const url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(term) + '&media=music&entity=song&limit=' + limit;
  const c = new AbortController();
  const to = setTimeout(() => c.abort(), 8000);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) throw new Error('itunes http ' + res.status);
    const data = await res.json();
    return data.results || [];
  } finally {
    clearTimeout(to);
  }
}

export function parseYouTubeId(s) {
  s = String(s || '').trim();
  const m = s.match(/[?&]v=([\w-]{11})/) || s.match(/youtu\.be\/([\w-]{11})/) ||
    s.match(/\/shorts\/([\w-]{11})/) || s.match(/\/embed\/([\w-]{11})/);
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(s)) return s;
  return null;
}

// ---------- YOUTUBE ID RESOLVE (no API key, parallel race) ----------
export async function fetchJson(url, ms = 5000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

function idFromWatchUrl(u) {
  const m = String(u || '').match(/[?&]v=([\w-]{11})/);
  return m ? m[1] : null;
}

function extractIds(html) {
  const ids = [];
  const re = /"videoId":"([\w-]{11})"/g;
  let m;
  while ((m = re.exec(String(html || ''))) && ids.length < 8) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

export async function resolveVideoIds(query, ylog = () => {}) {
  const q = encodeURIComponent(query);
  const yurl = encodeURIComponent('https://www.youtube.com/results?search_query=' + q);
  const piped = (host, rawQ) => async () => {
    const d = await fetchJson('https://' + host + '/search?q=' + q + '&filter=videos');
    return (d.items || [])
      .map((v) => ({ id: idFromWatchUrl(v.url), title: v.title || '' }))
      .filter((x) => x.id)
      .sort((a, b) => scoreVideo(b.title, rawQ) - scoreVideo(a.title, rawQ))
      .map((x) => x.id);
  };
  const invid = (host, rawQ) => async () => {
    const d = await fetchJson('https://' + host + '/api/v1/search?q=' + q + '&type=video');
    return (Array.isArray(d) ? d : [])
      .map((v) => ({ id: (/^[\w-]{11}$/.test(v.videoId || '') ? v.videoId : null), title: v.title || '' }))
      .filter((x) => x.id)
      .sort((a, b) => scoreVideo(b.title, rawQ) - scoreVideo(a.title, rawQ))
      .map((x) => x.id);
  };
  const sources = [
    ['allorigins', async () => {
      const d = await fetchJson('https://api.allorigins.win/get?url=' + yurl);
      return extractIds(d && d.contents);
    }],
    ['corsproxy.io', async () => {
      const r = await fetch('https://corsproxy.io/?url=' + yurl, { signal: AbortSignal.timeout(5000) });
      return extractIds(await r.text());
    }],
    ['lemnoslife', async () => {
      const d = await fetchJson('https://yt.lemnoslife.com/noKey/search?part=snippet&q=' + q + '&type=video&maxResults=5', 7000);
      const items = d.items || d.results || [];
      return items.map((v) => v.videoId || ((v.id || {}).videoId) || idFromWatchUrl(v.url)).filter((id) => /^[\w-]{11}$/.test(id || ''));
    }],
    ['piped:adminforge', piped('pipedapi.adminforge.de', query)],
    ['piped:kavin', piped('pipedapi.kavin.rocks', query)],
    ['piped:leptons', piped('pipedapi.leptons.xyz', query)],
    ['piped:r4fo', piped('pipedapi.r4fo.com', query)],
    ['invid:f5.si', invid('invidious.f5.si', query)],
    ['invid:nadeko', invid('inv.nadeko.net', query)],
    ['invid:tux', invid('inv.tux.pizza', query)],
  ];
  ylog('resolving "' + query + '" via ' + sources.length + ' servers...');
  const jobs = sources.map(([name, s]) => s().then((ids) => {
    if (ids && ids.length) { ylog('OK: ' + name + ' (' + ids.length + ' ids)'); return ids.slice(0, 8); }
    throw new Error('empty');
  }).catch(() => { ylog('fail: ' + name); throw new Error('fail'); }));
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000));
  try { return await Promise.race([Promise.any(jobs), timeout]); }
  catch (e) { ylog('resolve: TANAN palpak para sa "' + query + '"'); return []; }
}

// ---------- AUDIUS + ARCHIVE (free full MP3, no key) ----------
export async function audiusFull(t, ylog = () => {}) {
  const variants = [...new Set([t.trackName + ' ' + t.artistName, t.trackName])];
  const hosts = ['discoveryprovider.audius.co', 'discoveryprovider2.audius.co', 'discoveryprovider3.audius.co'];
  const target = (t.trackTimeMillis || 200000) / 1000;
  const jobs = [];
  for (const h of hosts) for (const v of variants) {
    jobs.push((async () => {
      const c = new AbortController();
      const to = setTimeout(() => c.abort(), 6000);
      try {
        const r = await fetch('https://' + h + '/v1/tracks/search?query=' + encodeURIComponent(v) + '&app_name=spotifyclone&limit=10', { signal: c.signal });
        const d = await r.json();
        const tracks = (d.data || []).filter((x) => x.is_streamable !== false && x.duration && x.duration > 60 && x.id);
        if (!tracks.length) throw new Error('empty');
        tracks.sort((a, b) => Math.abs(a.duration - target) - Math.abs(b.duration - target));
        const best = tracks[0];
        if (Math.abs(best.duration - target) > 90) throw new Error('no-match');
        return { best, h };
      } finally { clearTimeout(to); }
    })());
  }
  try {
    const { best, h } = await Promise.any(jobs);
    ylog('audius OK: ' + (best.title || '').slice(0, 50));
    return { url: 'https://' + h + '/v1/tracks/' + best.id + '/stream?app_name=spotifyclone', via: 'Audius' };
  } catch (e) { ylog('audius: walay match'); return null; }
}

export async function archiveFull(t, ylog = () => {}) {
  const c = new AbortController();
  const to = setTimeout(() => c.abort(), 12000);
  try {
    const q = encodeURIComponent(t.trackName + ' ' + t.artistName);
    const s = await fetch('https://archive.org/advancedsearch.php?q=' + q + '+AND+mediatype:audio&fl[]=identifier&rows=6&output=json', { signal: c.signal });
    const d = await s.json();
    const docs = ((d.response || {}).docs || []).map((x) => x.identifier).filter(Boolean).slice(0, 3);
    if (!docs.length) { ylog('archive: walay result'); return null; }
    const target = (t.trackTimeMillis || 200000) / 1000;
    const metas = await Promise.all(docs.map((id) =>
      fetch('https://archive.org/metadata/' + id, { signal: c.signal }).then((r) => r.json()).catch(() => null)
    ));
    let best = null;
    for (const m of metas) {
      if (!m || !m.files || !m.metadata || !m.metadata.identifier) continue;
      const mp3s = m.files.filter((f) => /\.mp3$/i.test(f.name || '') && !/spectrogram/i.test(f.name || ''));
      for (const f of mp3s) {
        const dur = parseFloat(f.length || 0);
        if (!dur || dur < 60) continue;
        const score = Math.abs(dur - target);
        if (!best || score < best.score) best = { score, url: 'https://archive.org/download/' + m.metadata.identifier + '/' + encodeURIComponent(f.name), dur };
      }
    }
    if (best && best.score < 150) { ylog('archive OK (' + Math.round(best.dur) + 's)'); return { url: best.url, via: 'Archive' }; }
    ylog('archive: walay duol og length');
    return null;
  } catch (e) { ylog('archive fail'); return null; }
  finally { clearTimeout(to); }
}

// ---------- FULL-SONG CACHE ----------
export function loadVidCache() {
  try { return JSON.parse(localStorage.getItem('sp_vidcache') || '{}'); }
  catch (e) { return {}; }
}
export function cacheKey(t) {
  return ((t.trackName || '') + ' — ' + (t.artistName || '')).toLowerCase().trim();
}

// ---------- STATIC DATA ----------
export const CATS = [
  ['Podcasts', '#E13300', 'P'], ['Made For You', '#1E3264', 'M'],
  ['Charts', '#8D67AB', 'C'], ['Pop', '#E8115B', 'P'],
  ['Hip-Hop', '#BA5D07', 'H'], ['Rock', '#E61E32', 'R'],
  ['Latin', '#E1118C', 'L'], ['K-Pop', '#DC148C', 'K'],
  ['R&B', '#477D95', 'R'], ['Jazz', '#509BF5', 'J'],
  ['Classical', '#8D67AB', 'C'], ['Country', '#D84000', 'C'],
  ['Workout', '#633212', 'W'], ['Chill', '#2D46B9', 'C'],
  ['Party', '#AF2896', 'P'], ['OPM', '#148A08', 'O'],
];

export const QUICK_COLORS = ['#8d67ab', '#e13300', '#1e3264', '#148a08', '#ba5d07', '#e8115b', '#2d46b9', '#af2896'];

export const DEMO_TRACKS = Array.from({ length: 12 }, (_, i) => ({
  trackId: 9000 + i, trackName: 'Demo Track ' + (i + 1),
  artistName: 'Demo Artist', collectionName: 'Demo Album',
  artworkUrl100: '', trackTimeMillis: 200000,
}));

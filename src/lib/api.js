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

// Verify top candidates via YouTube oEmbed (no key, CORS-enabled):
// i-score ang tinuod nga titulo, isalikway ang klarong sayop (karaoke/cover/wrong song).
async function verifyIds(ids, query, ylog = () => {}) {
  if (!ids || ids.length < 2) return ids || [];
  const checked = await Promise.all(ids.slice(0, 4).map(async (id) => {
    try {
      const d = await fetchJson('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json', 3500);
      return { id, s: scoreVideo(d.title || '', query) };
    } catch { return { id, s: null }; }
  }));
  const known = checked.filter((x) => x.s !== null);
  if (!known.length) return ids; // dili ma-verify — salig sa source order
  known.sort((a, b) => b.s - a.s);
  const good = known.filter((x) => x.s >= 15);
  const ranked = (good.length ? good : known).map((x) => x.id);
  if (ranked[0] !== ids[0]) ylog('oembed: mas accurate nga match napili (score ' + Math.round((good.length ? good : known)[0].s) + ')');
  const rest = ids.filter((id) => !ranked.includes(id));
  return [...ranked, ...rest];
}

export async function resolveVideoIds(query, ylog = () => {}) {
  const q = encodeURIComponent(query);
  const yurl = encodeURIComponent('https://www.youtube.com/results?search_query=' + q);
  const run = (name, fn) => fn().then((ids) => {
    if (ids && ids.length) { ylog('OK: ' + name + ' (' + ids.length + ' ids)'); return ids.slice(0, 8); }
    throw new Error('empty');
  }).catch(() => { ylog('fail: ' + name); throw new Error('fail'); });
  const piped = (host) => async () => {
    const d = await fetchJson('https://' + host + '/search?q=' + q + '&filter=videos');
    return (d.items || [])
      .map((v) => ({ id: idFromWatchUrl(v.url), title: v.title || '' }))
      .filter((x) => x.id)
      .sort((a, b) => scoreVideo(b.title, query) - scoreVideo(a.title, query))
      .map((x) => x.id);
  };
  const invid = (host) => async () => {
    const d = await fetchJson('https://' + host + '/api/v1/search?q=' + q + '&type=video');
    return (Array.isArray(d) ? d : [])
      .map((v) => ({ id: (/^[\w-]{11}$/.test(v.videoId || '') ? v.videoId : null), title: v.title || '' }))
      .filter((x) => x.id)
      .sort((a, b) => scoreVideo(b.title, query) - scoreVideo(a.title, query))
      .map((x) => x.id);
  };
  // Tier 1: sources nga naay titulo — ma-score og tarong, pinaka-accurate nga match ang mapili.
  // (Sa una, kinsay pinakapaspas mo-tubag maoy daug bisan sayop nga video.)
  const scored = [
    ['piped:adminforge', piped('pipedapi.adminforge.de')],
    ['piped:kavin', piped('pipedapi.kavin.rocks')],
    ['piped:leptons', piped('pipedapi.leptons.xyz')],
    ['piped:r4fo', piped('pipedapi.r4fo.com')],
    ['invid:f5.si', invid('invidious.f5.si')],
    ['invid:nadeko', invid('inv.nadeko.net')],
    ['invid:tux', invid('inv.tux.pizza')],
    ['lemnoslife', async () => {
      const d = await fetchJson('https://yt.lemnoslife.com/noKey/search?part=snippet&q=' + q + '&type=video&maxResults=5', 7000);
      const items = d.items || d.results || [];
      return items
        .map((v) => ({ id: v.videoId || ((v.id || {}).videoId) || idFromWatchUrl(v.url), title: v.title || ((v.snippet || {}).title) || '' }))
        .filter((x) => /^[\w-]{11}$/.test(x.id || ''))
        .sort((a, b) => scoreVideo(b.title, query) - scoreVideo(a.title, query))
        .map((x) => x.id);
    }],
  ];
  ylog('resolving "' + query + '" via scored servers...');
  const tierTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('tier-timeout')), 7000));
  try {
    const ids = await Promise.race([Promise.any(scored.map(([name, s]) => run(name, s))), tierTimeout]);
    if (ids && ids.length) return await verifyIds(ids.slice(0, 8), query, ylog);
  } catch { ylog('scored servers palpak — suway scrape fallback...'); }
  // Tier 2: raw scrape fallback (walay title scoring — last resort lang).
  const scraped = [
    ['allorigins', async () => {
      const d = await fetchJson('https://api.allorigins.win/get?url=' + yurl);
      return extractIds(d && d.contents);
    }],
    ['corsproxy.io', async () => {
      const r = await fetch('https://corsproxy.io/?url=' + yurl, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error('http ' + r.status);
      return extractIds(await r.text());
    }],
  ];
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000));
  try {
    const ids = await Promise.race([Promise.any(scraped.map(([name, s]) => run(name, s))), timeout]);
    return await verifyIds(ids.slice(0, 8), query, ylog);
  }
  catch (e) { ylog('resolve: TANAN palpak para sa "' + query + '"'); return []; }
}

// ---------- AUDIUS + ARCHIVE (free full MP3, no key) ----------
export async function audiusFull(t, ylog = () => {}) {
  const query = t.trackName + ' ' + t.artistName;
  const variants = [...new Set([query, t.trackName])];
  const hosts = ['discoveryprovider.audius.co', 'discoveryprovider2.audius.co', 'discoveryprovider3.audius.co'];
  const target = (t.trackTimeMillis || 200000) / 1000;
  const jobs = [];
  for (const h of hosts) for (const v of variants) {
    jobs.push((async () => {
      const c = new AbortController();
      const to = setTimeout(() => c.abort(), 6000);
      try {
        const r = await fetch('https://' + h + '/v1/tracks/search?query=' + encodeURIComponent(v) + '&app_name=spotifyclone&limit=10', { signal: c.signal });
        if (!r.ok) throw new Error('http ' + r.status);
        const d = await r.json();
        // I-score ang titulo (dili length ra) — isalikway ang sayop nga kanta.
        const cands = (d.data || [])
          .filter((x) => x.is_streamable !== false && x.duration && x.duration > 60 && x.id)
          .map((x) => ({ x, titleScore: scoreVideo(x.title || '', query), durDiff: Math.abs(x.duration - target) }))
          .filter((x) => x.titleScore >= 12 && x.durDiff <= 30);
        if (!cands.length) throw new Error('no-match');
        cands.sort((a, b) => b.titleScore - a.titleScore || a.durDiff - b.durDiff);
        return { best: cands[0].x, h, score: cands[0].titleScore };
      } finally { clearTimeout(to); }
    })());
  }
  try {
    const { best, h, score } = await Promise.any(jobs);
    ylog('audius OK: ' + (best.title || '').slice(0, 50));
    return { url: 'https://' + h + '/v1/tracks/' + best.id + '/stream?app_name=spotifyclone', via: 'Audius', score };
  } catch (e) { ylog('audius: walay match'); return null; }
}

export async function archiveFull(t, ylog = () => {}) {
  const c = new AbortController();
  const to = setTimeout(() => c.abort(), 12000);
  try {
    const query = t.trackName + ' ' + t.artistName;
    // I-quote ang query para relevant ang results (dili tagsa-tagsa nga pulong).
    const q = encodeURIComponent('"' + query + '"');
    const s = await fetch('https://archive.org/advancedsearch.php?q=' + q + '+AND+mediatype:audio&fl[]=identifier,title&rows=6&output=json', { signal: c.signal });
    if (!s.ok) throw new Error('http ' + s.status);
    const d = await s.json();
    const docs = ((d.response || {}).docs || []).map((x) => ({ id: x.identifier, title: x.title || '' })).filter((x) => x.id).slice(0, 3);
    if (!docs.length) { ylog('archive: walay result'); return null; }
    const target = (t.trackTimeMillis || 200000) / 1000;
    const metas = await Promise.all(docs.map((doc) =>
      fetch('https://archive.org/metadata/' + doc.id, { signal: c.signal }).then((r) => r.json()).then((m) => ({ m, title: doc.title })).catch(() => null)
    ));
    let best = null;
    for (const item of metas) {
      if (!item || !item.m || !item.m.files || !item.m.metadata || !item.m.metadata.identifier) continue;
      // I-score ang titulo sa item — sayop nga kanta nga parehag length dili ma-pili.
      const titleScore = scoreVideo((item.m.metadata.title || '') + ' ' + item.title, query);
      if (titleScore < 12) continue;
      const mp3s = item.m.files.filter((f) => /\.mp3$/i.test(f.name || '') && !/spectrogram/i.test(f.name || ''));
      for (const f of mp3s) {
        const dur = parseFloat(f.length || 0);
        if (!dur || dur < 60) continue;
        const durDiff = Math.abs(dur - target);
        const combined = titleScore - durDiff / 30;
        if (!best || combined > best.combined) best = { combined, url: 'https://archive.org/download/' + item.m.metadata.identifier + '/' + encodeURIComponent(f.name), dur, score: titleScore };
      }
    }
    if (best && best.score >= 12) { ylog('archive OK (' + Math.round(best.dur) + 's)'); return { url: best.url, via: 'Archive', score: best.score }; }
    ylog('archive: walay duol og titulo/length');
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

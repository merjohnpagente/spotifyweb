import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import HomeView from './components/HomeView.jsx';
import SearchView from './components/SearchView.jsx';
import PlaylistView from './components/PlaylistView.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import DebugPanel from './components/DebugPanel.jsx';
import {
  archiveFull, audiusFull, bigArt, cacheKey, dedupeTracks, DEMO_TRACKS,
  fetchJson, itunesSearch, loadVidCache, parseYouTubeId,
  resolveVideoIds, scoreTrack,
} from './lib/api.js';

export default function App() {
  // ---------- VIEW + DATA ----------
  const [view, setView] = useState('home');
  const [homePool, setHomePool] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [currentTracks, setCurrentTracks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0);
  const [liked, setLiked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sp_liked') || '[]'); }
    catch { return []; }
  });
  const likedIds = useMemo(() => new Set(liked.map((t) => t.trackId)), [liked]);

  // ---------- PLAYER UI ----------
  const [ytStatus, setYtStatus] = useState('Connecting to YouTube...');
  const [ytLive, setYtLive] = useState(false);
  const [toast, setToast] = useState('');
  const [dbgOpen, setDbgOpen] = useState(false);
  const [dbgLines, setDbgLines] = useState([]);
  const [dbgLink, setDbgLink] = useState('');
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('sp_ytkey') || ''; } catch { return ''; }
  });
  const [muted, setMuted] = useState(false);

  // ---------- REFS (mutable playback state, dili mo-re-render) ----------
  const audioRef = useRef(null);
  const ytPlayer = useRef(null);
  const ytReady = useRef(false);
  const ytActive = useRef(false);
  const searchToken = useRef(0);
  const searchSeq = useRef(0);
  const fullToken = useRef(0);
  const resolvingFull = useRef(false);
  const fullAudioActive = useRef(false);
  const pendingFullUrl = useRef(null);
  const pendingFullVia = useRef('');
  const playIntent = useRef(false);
  const ytCandidates = useRef([]);
  const ytDeadRetry = useRef(false);
  const currentQuery = useRef('');
  const cache = useRef(loadVidCache());
  const toastTimer = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { currentTracks, currentIndex, shuffleOn, repeatMode, liked };

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const ylog = useCallback((msg) => {
    const t = new Date().toLocaleTimeString();
    setDbgLines((prev) => [...prev.slice(-79), '[' + t + '] ' + msg]);
    try { console.log('[YT]', msg); } catch { /* noop */ }
  }, []);

  const saveCache = useCallback(() => {
    try { localStorage.setItem('sp_vidcache', JSON.stringify(cache.current)); } catch { /* noop */ }
  }, []);

  // ---------- FULL SONG RESOLVE ----------
  const youtubeKeySearch = useCallback(async (q) => {
    if (!apiKey) return null;
    try {
      const r = await fetchJson('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=' + encodeURIComponent(q) + '&key=' + apiKey, 7000);
      const ids = ((r && r.items) || []).map((v) => v.id && v.id.videoId).filter((id) => /^[\w-]{11}$/.test(id || ''));
      if (ids.length) { ylog('YT API key OK (' + ids.length + ' ids)'); return { type: 'youtube', ids }; }
    } catch { /* fail */ }
    ylog('YT API key fail — basin sayop key o nahurot ang quota');
    return null;
  }, [apiKey, ylog]);

  const resolveFullSong = useCallback(async (t, q) => {
    const c = cache.current[cacheKey(t)];
    if (c) {
      if (c.videoId) { ylog('cache HIT (YouTube) — instant full'); return { type: 'youtube', ids: [c.videoId] }; }
      if (c.audioUrl) { ylog('cache HIT (' + (c.via || 'audio') + ') — instant full'); return { type: 'audio', url: c.audioUrl, via: c.via || 'cache' }; }
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt === 2) { ylog('retry full resolve (attempt 2)...'); await new Promise((r) => setTimeout(r, 1500)); }
      // Ang YouTube ids kay verified na og titulo (oEmbed) — hatagan og higayon
      // nga mapili ibabaw sa ubos-score nga audio result.
      const ytJob = resolveVideoIds(q + ' official audio', ylog).then((ids) => { if (ids.length) return { type: 'youtube', ids }; throw new Error('no-yt'); });
      const jobs = [
        youtubeKeySearch(q + ' official audio').then((r) => { if (r) return r; throw new Error('no-key'); }),
        audiusFull(t, ylog).then((r) => { if (r) return { type: 'audio', url: r.url, via: r.via, score: r.score || 0 }; throw new Error('no-audius'); }),
        archiveFull(t, ylog).then((r) => { if (r) return { type: 'audio', url: r.url, via: r.via, score: r.score || 0 }; throw new Error('no-archive'); }),
        ytJob,
      ];
      try {
        let res = await Promise.any(jobs);
        if (res.type === 'audio' && (res.score || 0) < 25) {
          const grace = new Promise((resolve) => setTimeout(() => resolve(null), 2500));
          const ytRes = await Promise.race([ytJob.then((r) => r).catch(() => null), grace]);
          if (ytRes) { ylog('YT verified gipili ibabaw sa ubos-score nga audio'); res = ytRes; }
        }
        if (res.type === 'youtube') {
          cache.current[cacheKey(t)] = { videoId: res.ids[0] };
          const keys = Object.keys(cache.current);
          if (keys.length > 200) delete cache.current[keys[0]];
          saveCache();
        } else {
          cache.current[cacheKey(t)] = { audioUrl: res.url, via: res.via };
          saveCache();
        }
        return res;
      } catch { ylog('full attempt ' + attempt + ' palpak'); }
    }
    return null;
  }, [saveCache, ylog, youtubeKeySearch]);

  // ---------- PLAYBACK ----------
  const handleEnded = useCallback(() => {
    const { currentTracks: ct, currentIndex: ci, shuffleOn: sh, repeatMode: rp } = stateRef.current;
    if (rp === 2 && ci >= 0) { playTrackRef.current(ci); return; }
    if (!ct.length) return;
    if (sh) { playTrackRef.current(Math.floor(Math.random() * ct.length)); return; }
    if (ci < ct.length - 1) playTrackRef.current(ci + 1);
    else if (rp === 1) playTrackRef.current(0);
    else setIsPlaying(false);
  }, []);

  const loadYtQuery = useCallback((q) => {
    currentQuery.current = q;
    if (!ytReady.current || !ytPlayer.current || !ytPlayer.current.loadVideoById) {
      setYtStatus('Connecting to YouTube...');
      return;
    }
    setYtStatus('Loading full song from YouTube...');
    const my = ++searchToken.current;
    resolveVideoIds(q, ylog).then((ids) => {
      if (my !== searchToken.current) return;
      if (ids.length) {
        ytCandidates.current = ids.slice(1);
        setYtStatus('Found full song — loading...');
        try { ytPlayer.current.loadVideoById(ids[0]); } catch { /* noop */ }
        return;
      }
      setYtStatus('Full song blocked');
      showToast('Dili ma-load ang full song (adblock/network?)');
    });
  }, [showToast, ylog]);

  const playTrack = useCallback((i, list) => {
    const tracks = list || stateRef.current.currentTracks;
    if (!tracks.length) return;
    const idx = ((i % tracks.length) + tracks.length) % tracks.length;
    const t = tracks[idx];
    setCurrentTracks(tracks);
    setCurrentIndex(idx);
    setIsPlaying(false);
    setYtLive(false);
    setYtStatus('Loading FULL version...');
    showToast('Loading FULL: ' + t.trackName);
    ytActive.current = false;
    playIntent.current = true;
    // Patya dayon ang nag-play nga YouTube — kung dili, magdungan og tukar
    // inig switch ngadto sa Audius/Archive audio (ang audio ra ang mapalong sa ubos).
    try { if (ytPlayer.current && ytPlayer.current.pauseVideo) ytPlayer.current.pauseVideo(); } catch { /* noop */ }
    ytDeadRetry.current = false;
    fullAudioActive.current = false;
    pendingFullUrl.current = null;
    searchToken.current++;
    const myFull = ++fullToken.current;
    const audio = audioRef.current;
    try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch { /* noop */ }
    resolvingFull.current = true;
    const q = t.trackName + ' ' + t.artistName;
    ylog('looking for FULL: ' + q);
    currentQuery.current = q + ' official audio';

    resolveFullSong(t, q).then((res) => {
      resolvingFull.current = false;
      if (myFull !== fullToken.current) return;
      setTimeout(() => {
        try {
          const nxt = tracks[idx + 1];
          if (nxt && !cache.current[cacheKey(nxt)]) {
            ylog('pre-resolve next: ' + nxt.trackName);
            resolveFullSong(nxt, nxt.trackName + ' ' + nxt.artistName).then(() => ylog('pre-resolve done'));
          }
        } catch { /* noop */ }
      }, 3000);
      if (!res) {
        ylog('walay full source — tanan servers palpak');
        setYtStatus('FULL failed — paste link sa ubos');
        setDbgOpen(true);
        showToast('Dili ma-load ang FULL — paste YouTube link sa ubos');
        return;
      }
      if (!playIntent.current) {
        // Nag-pause ang user samtang nag-load — i-hold ang FULL, ayaw autoplay.
        if (res.type === 'audio') {
          fullAudioActive.current = false;
          pendingFullUrl.current = res.url;
          pendingFullVia.current = res.via;
        } else {
          ytCandidates.current = res.ids.slice(1);
          try {
            if (ytPlayer.current && ytPlayer.current.cueVideoById) ytPlayer.current.cueVideoById(res.ids[0]);
            else if (ytPlayer.current && ytPlayer.current.loadVideoById) ytPlayer.current.loadVideoById(res.ids[0]);
          } catch { /* noop */ }
        }
        setYtStatus('FULL ready — i-press ang play');
        ylog('gi-hold ang FULL (nag-pause ka samtang nag-load)');
        return;
      }
      if (res.type === 'audio') {
        if (ytActive.current) { ylog('full audio skipped — YT na ang ga-tukar'); return; }
        fullAudioActive.current = true;
        pendingFullUrl.current = null;
        // Siguraduhon nga hilom ang YT sa dili pa mo-play ang audio (likay dungan).
        try { if (ytPlayer.current && ytPlayer.current.pauseVideo) ytPlayer.current.pauseVideo(); } catch { /* noop */ }
        ylog('FULL audio via ' + res.via);
        setYtStatus('Playing FULL via ' + res.via);
        setYtLive(true);
        audio.src = res.url;
        audio.play().then(() => {
          if (myFull !== fullToken.current) return;
          setIsPlaying(true);
        }).catch(() => {
          pendingFullUrl.current = res.url;
          pendingFullVia.current = res.via;
          fullAudioActive.current = false;
          setYtStatus('FULL ready — i-press ang play');
          ylog('full nakuha pero gi-block ang autoplay — press play');
          showToast('FULL ready — i-press ang play');
        });
        showToast('FULL song: ' + t.trackName);
      } else {
        if (fullAudioActive.current) return;
        ytCandidates.current = res.ids.slice(1);
        setYtStatus('Found full song — loading...');
        ylog('loadVideoById: ' + res.ids[0] + ' (+' + ytCandidates.current.length + ' backup)');
        try {
          if (!ytPlayer.current) throw new Error('yt-not-ready');
          ytPlayer.current.loadVideoById(res.ids[0]);
        } catch {
          ylog('loadVideoById fail — queue sa YT inig ready');
          loadYtQuery(currentQuery.current);
        }
      }
    });
  }, [resolveFullSong, showToast, ylog, loadYtQuery]);
  const playTrackRef = useRef(playTrack);
  playTrackRef.current = playTrack;

  // ---------- SEARCH ----------
  const doSearch = useCallback(async (q, autoplay = true) => {
    q = q.trim();
    if (!q) return;
    setView('search');
    setHasSearched(true);
    setSearching(true);
    setResults([]);
    // Dili na mag loadYtQuery diri — ang playTrack(0) sa ubos na ang mo-resolve
    // sa FULL para sa actual top result (likay sa race/double-network).
    const mySearch = ++searchSeq.current;
    try {
      const raw = await itunesSearch(q, 20);
      if (mySearch !== searchSeq.current) return; // daan nga search — ayaw pag-overwrite
      if (!raw.length) { setResults([]); setSearching(false); return; }
      const ranked = dedupeTracks(raw).sort((a, b) => scoreTrack(b, q) - scoreTrack(a, q));
      ylog('search "' + q + '": ' + raw.length + ' → ' + ranked.length + ' unique');
      setResults(ranked);
      setSearching(false);
      setCurrentTracks((prev) => (autoplay ? ranked : prev));
      if (autoplay) {
        setCurrentIndex(-1);
        playTrackRef.current(0, ranked);
      }
    } catch {
      setSearching(false);
    }
  }, [ylog]);

  // ---------- INIT: home + YT API + audio events + progress ----------
  useEffect(() => {
    (async () => {
      try {
        const [a, b, c] = await Promise.all([
          itunesSearch('top hits 2025 pop', 12),
          itunesSearch('weeknd dua lipa hits', 12),
          itunesSearch('opm hits', 12),
        ]);
        const pool = dedupeTracks([...a, ...b, ...c]);
        setHomePool(pool.length ? pool : DEMO_TRACKS);
        if (pool.length) setCurrentTracks((prev) => (prev.length ? prev : pool.slice(0, 12)));
        else setCurrentTracks((prev) => (prev.length ? prev : DEMO_TRACKS));
      } catch {
        setHomePool(DEMO_TRACKS);
      }
    })();
  }, []);

  useEffect(() => {
    const onState = (e) => {
      const YS = window.YT.PlayerState;
      const names = { '-1': 'UNSTARTED', 0: 'ENDED', 1: 'PLAYING', 2: 'PAUSED', 3: 'BUFFERING', 5: 'CUED' };
      ylog('YT state: ' + (names[e.data] || e.data));
      if (e.data === YS.PLAYING) {
        ytActive.current = true;
        try { audioRef.current.pause(); } catch { /* noop */ }
        setIsPlaying(true);
        setYtStatus('Playing from YouTube');
        setYtLive(true);
      } else if (e.data === YS.PAUSED) {
        if (ytActive.current) setIsPlaying(false);
      } else if (e.data === YS.ENDED) {
        ytActive.current = false;
        handleEnded();
      } else if (e.data === YS.CUED) {
        setYtStatus('Full song ready — i-press ang play');
        showToast('Full version ready — i-press ang play');
      } else if (e.data === YS.BUFFERING) {
        setYtStatus('Loading full song from YouTube...');
      }
    };
    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return false;
      ytPlayer.current = new window.YT.Player('youtube-player', {
        height: '2', width: '2',
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0 },
        events: {
          onReady: (e) => {
            ytReady.current = true;
            ylog('YT API ready — player OK');
            e.target.setVolume(80);
            setYtStatus('YouTube connected');
          },
          onStateChange: onState,
          onError: (ev) => {
            ylog('YT ERROR code=' + (ev && ev.data));
            if (ytCandidates.current.length) {
              const nid = ytCandidates.current.shift();
              ylog('suway sunod nga video: ' + nid);
              try { ytPlayer.current.loadVideoById(nid); return; } catch { /* noop */ }
            }
            // Nahurot ang backup — basin patay na ang naka-cache nga video.
            // Pangtangtangon sa cache + usa ka auto re-resolve (dili permanente maipit).
            const { currentTracks: ect, currentIndex: eci } = stateRef.current;
            const bad = eci >= 0 ? ect[eci] : null;
            if (bad) {
              const k = cacheKey(bad);
              if (cache.current[k]) { delete cache.current[k]; saveCache(); ylog('dead cache gi-pangtangtang'); }
            }
            ytActive.current = false;
            setIsPlaying(false);
            if (bad && !ytDeadRetry.current) {
              ytDeadRetry.current = true;
              ylog('re-resolve kay patay ang video...');
              setYtStatus('Bad video — nangita og lain...');
              playTrackRef.current(eci);
              return;
            }
            setYtStatus('YouTube failed — paste link sa ubos');
            showToast('YouTube failed — paste link para FULL');
            setDbgOpen(true);
          },
        },
      });
      return true;
    };
    let iv, to;
    if (!initPlayer()) {
      iv = setInterval(() => { if (initPlayer()) clearInterval(iv); }, 500);
      to = setTimeout(() => {
        if (!ytReady.current) { ylog('YT API WALA mo-load — na-block ang youtube.com'); setYtStatus('YouTube blocked'); }
      }, 10000);
    }
    return () => {
      if (iv) clearInterval(iv);
      if (to) clearTimeout(to);
      try { if (ytPlayer.current && ytPlayer.current.destroy) ytPlayer.current.destroy(); } catch { /* noop */ }
      ytPlayer.current = null;
      ytReady.current = false;
    };
  }, [handleEnded, saveCache, showToast, ylog]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.8;
    const onEnded = () => {
      if (ytActive.current || resolvingFull.current) return;
      handleEnded();
    };
    const onErr = () => {
      if (ytActive.current || resolvingFull.current) return;
      const { currentTracks: ct, currentIndex: ci } = stateRef.current;
      if (ci < 0 || !ct[ci]) return;
      if (fullAudioActive.current) {
        fullAudioActive.current = false;
        ylog('full audio error — suway YouTube');
        setYtStatus('Full audio naputol — loading YouTube...');
        loadYtQuery(ct[ci].trackName + ' ' + ct[ci].artistName + ' official audio');
      }
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onErr);
    return () => { audio.removeEventListener('ended', onEnded); audio.removeEventListener('error', onErr); };
  }, [handleEnded, loadYtQuery, ylog]);

  // ---------- ACTIONS ----------
  const toggleLike = useCallback((t) => {
    setLiked((prev) => {
      const has = prev.some((x) => x.trackId === t.trackId);
      const next = has ? prev.filter((x) => x.trackId !== t.trackId) : [...prev, t];
      try { localStorage.setItem('sp_liked', JSON.stringify(next)); } catch { /* noop */ }
      if (!has) showToast('Added to Liked Songs');
      return next;
    });
  }, [showToast]);

  const track = currentIndex >= 0 ? currentTracks[currentIndex] : null;
  const likedCount = liked.length + (liked.length === 1 ? ' song' : ' songs');

  const onPlayPause = () => {
    const audio = audioRef.current;
    if (currentIndex < 0) {
      if (currentTracks.length) playTrack(0);
      else showToast('Search muna og kanta, dayon press play');
      return;
    }
    if (isPlaying) {
      playIntent.current = false;
      try { if (ytReady.current && ytActive.current) ytPlayer.current.pauseVideo(); } catch { /* noop */ }
      audio.pause();
      setIsPlaying(false);
    } else {
      playIntent.current = true;
      if (pendingFullUrl.current && !fullAudioActive.current && !ytActive.current) {
        ylog('retry FULL via ' + pendingFullVia.current);
        audio.src = pendingFullUrl.current;
        audio.play().then(() => {
          fullAudioActive.current = true;
          setYtStatus('Playing FULL via ' + pendingFullVia.current);
          setYtLive(true);
          pendingFullUrl.current = null;
          setIsPlaying(true);
        }).catch(() => showToast('I-press pag-usab ang play'));
        setIsPlaying(true);
        return;
      }
      if (!audio.src && !ytActive.current && !pendingFullUrl.current) {
        if (resolvingFull.current) { showToast('Loading pa ang FULL... huwat kadiyot'); return; }
        if (currentIndex >= 0) { ylog('manual retry FULL'); playTrack(currentIndex); return; }
        try { if (ytReady.current) ytPlayer.current.playVideo(); } catch { /* noop */ }
        return;
      }
      try { if (ytReady.current) ytPlayer.current.playVideo(); } catch { /* noop */ }
      if (!ytActive.current && audio.src && audio.paused) audio.play().catch(() => showToast('I-press pag-usab ang play'));
      setIsPlaying(true);
    }
  };

  const onNext = () => {
    if (!currentTracks.length) return;
    if (shuffleOn) { playTrack(Math.floor(Math.random() * currentTracks.length)); return; }
    if (currentIndex + 1 >= currentTracks.length) {
      if (repeatMode === 1) playTrack(0);
      else setIsPlaying(false);
      return;
    }
    playTrack(currentIndex + 1);
  };
  const onPrev = () => {
    let c = 0;
    try { c = (ytReady.current && ytActive.current) ? ytPlayer.current.getCurrentTime() : audioRef.current.currentTime || 0; } catch { /* noop */ }
    if (c > 3) {
      try { if (ytReady.current && ytActive.current) ytPlayer.current.seekTo(0, true); } catch { /* noop */ }
      try { audioRef.current.currentTime = 0; } catch { /* noop */ }
      return;
    }
    if (!currentTracks.length) return;
    playTrack(currentIndex - 1 < 0 ? 0 : currentIndex - 1);
  };
  const onSeek = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (ytReady.current && ytActive.current) {
      try { ytPlayer.current.seekTo(ytPlayer.current.getDuration() * f, true); } catch { /* noop */ }
    } else if (audioRef.current.src && audioRef.current.duration) {
      try { audioRef.current.currentTime = audioRef.current.duration * f; } catch { /* noop */ }
    }
  };

  const actionsRef = useRef({});
  useEffect(() => { actionsRef.current = { onPlayPause, onNext, onPrev }; });

  // Lock-screen / background controls (Media Session API): mo-gana ang
  // play/pause/next/prev sa phone notification ug headset buttons, ug
  // magpadayon og tukar kung gi-minimize o gi-lock ang screen.
  // NOTE: kung gi-quit gyud ang Chrome app mismo, mapalong gyud — native app ang kinahanglan para ana.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => actionsRef.current.onPlayPause());
      navigator.mediaSession.setActionHandler('pause', () => actionsRef.current.onPlayPause());
      navigator.mediaSession.setActionHandler('previoustrack', () => actionsRef.current.onPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => actionsRef.current.onNext());
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      if (track) {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: track.trackName || 'Unknown',
          artist: track.artistName || '',
          album: track.collectionName || '',
          artwork: track.artworkUrl100 ? [{ src: bigArt(track.artworkUrl100, 512), sizes: '512x512', type: 'image/jpeg' }] : [],
        });
      }
    } catch { /* noop */ }
  }, [track, isPlaying]);

  const progressRef = useRef(null);

  return (
    <>
      <div className="app">
        <Sidebar
          view={view}
          liked={liked}
          likedCount={likedCount}
          onNav={setView}
          onOpenLiked={() => setView('playlist')}
        />
        <main className="main">
          <Topbar
            view={view}
            query={query}
            setQuery={setQuery}
            onSubmit={() => doSearch(query, true)}
            onClear={() => { setQuery(''); setHasSearched(false); setResults([]); }}
            onBack={() => setView('home')}
            onToast={showToast}
          />
          <nav className="mobile-nav">
            <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Home</button>
            <button className={view === 'search' ? 'active' : ''} onClick={() => setView('search')}>Search</button>
            <button className={view === 'playlist' ? 'active' : ''} onClick={() => setView('playlist')}>Library</button>
          </nav>
          <div className="content">
            {view === 'home' && <HomeView pool={homePool} onPlayTrack={playTrack} onToast={showToast} />}
            {view === 'search' && (
              <SearchView
                searching={searching}
                results={results}
                hasSearched={hasSearched}
                currentId={track ? track.trackId : -1}
                likedIds={likedIds}
                onPlayTrack={playTrack}
                onToggleLike={toggleLike}
                onBrowse={(cat) => { setQuery(cat); doSearch(cat); }}
              />
            )}
            {view === 'playlist' && (
              <PlaylistView
                liked={liked}
                currentId={track ? track.trackId : -1}
                onPlayTrack={playTrack}
                onToggleLike={toggleLike}
              />
            )}
            <footer className="main-footer">
              <div className="foot-cols">
                <div><p>Company</p><a>About</a><a>Jobs</a><a>For the Record</a></div>
                <div><p>Communities</p><a>For Artists</a><a>Developers</a><a>Advertising</a><a>Investors</a></div>
                <div><p>Useful links</p><a>Support</a><a>Free Mobile App</a></div>
                <div><p>Spotify Plans</p><a>Premium Individual</a><a>Premium Duo</a><a>Premium Family</a></div>
              </div>
              <div className="foot-bottom"><span>© 2026 Spotify Clone (React + Vite, plays via YouTube)</span></div>
            </footer>
          </div>
        </main>
      </div>

      <PlayerBar
        key={track ? track.trackId : 'none'}
        track={track}
        isPlaying={isPlaying}
        liked={track ? likedIds.has(track.trackId) : false}
        ytStatus={ytStatus}
        ytLive={ytLive}
        shuffleOn={shuffleOn}
        repeatMode={repeatMode}
        onPlayPause={onPlayPause}
        onNext={onNext}
        onPrev={onPrev}
        onShuffle={() => { setShuffleOn((s) => !s); showToast(!shuffleOn ? 'Shuffle on' : 'Shuffle off'); }}
        onRepeat={() => { setRepeatMode((r) => (r + 1) % 3); showToast(['Repeat off', 'Repeat all', 'Repeat one'][(repeatMode + 1) % 3]); }}
        onLike={() => track && toggleLike(track)}
        onSeek={onSeek}
        muted={muted}
        onMute={() => {
          setMuted((m) => {
            const next = !m;
            try { audioRef.current.muted = next; } catch { /* noop */ }
            try { if (next) ytPlayer.current.mute(); else ytPlayer.current.unMute(); } catch { /* noop */ }
            return next;
          });
        }}
        onOpenYt={() => {
          if (!currentQuery.current) { showToast('Wala pay nag-play nga kanta'); return; }
          window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(currentQuery.current), '_blank');
        }}
        onToggleDebug={() => setDbgOpen((o) => !o)}
        progressRef={progressRef}
        audioRef={audioRef}
        ytPlayerRef={ytPlayer}
        ytReadyRef={ytReady}
        ytActiveRef={ytActive}
      />

      <audio ref={audioRef} preload="none" />
      <div id="yt-holder"><div id="youtube-player"></div></div>
      <DebugPanel
        open={dbgOpen}
        lines={dbgLines}
        link={dbgLink}
        setLink={setDbgLink}
        onPlayLink={() => {
          const id = parseYouTubeId(dbgLink);
          if (!id) { showToast('Dili valid nga YouTube link'); return; }
          if (!ytReady.current) { showToast('YouTube player wala pa — huwata kadiyot'); return; }
          ylog('manual link play: ' + id);
          try { audioRef.current.pause(); } catch { /* noop */ }
          try { ytPlayer.current.loadVideoById(id); setYtStatus('Loading full song...'); } catch { showToast('Dili ma-load ang video'); }
        }}
        apiKey={apiKey}
        setApiKey={setApiKey}
        onSaveKey={() => {
          try { localStorage.setItem('sp_ytkey', apiKey.trim()); } catch { /* noop */ }
          ylog(apiKey ? 'API key saved — official YouTube search ON' : 'API key cleared');
          showToast(apiKey ? 'API key saved — sure full na' : 'API key cleared');
        }}
        onCopy={() => {
          const done = () => showToast('Na-copy ang log — i-send nako');
          const fail = () => showToast('Dili ma-copy, screenshot na lang');
          try {
            const p = navigator.clipboard.writeText(dbgLines.join('\n'));
            if (p && p.then) p.then(done).catch(fail);
            else done();
          } catch { fail(); }
        }}
      />
      {toast && <div id="toast">{toast}</div>}
    </>
  );
}

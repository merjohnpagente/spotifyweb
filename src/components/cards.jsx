import { bigArt, fmtDur } from '../lib/api.js';

export function PlayIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#000"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14z" /></svg>
  );
}

export function SpotifyCard({ t, round, onPlay }) {
  const art = bigArt(t.artworkUrl100, 300);
  return (
    <div className="card" onClick={onPlay}>
      <div className="card-cover-wrap">
        {art
          ? <img className={'card-cover' + (round ? ' round' : '')} src={art} loading="lazy" alt="" />
          : <div className="card-cover" style={{ background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900 }}>{(t.trackName || '?')[0]}</div>}
        <button className="card-play" title="Play" onClick={(e) => { e.stopPropagation(); onPlay(); }}>
          <PlayIcon />
        </button>
      </div>
      <p className="card-title">{t.trackName || 'Unknown'}</p>
      <p className="card-sub">{(t.artistName || '') + (t.collectionName ? ' • ' + t.collectionName : '')}</p>
    </div>
  );
}

export function TrackRow({ t, index, playing, liked, onPlay, onLike }) {
  return (
    <div className={'track-row' + (playing ? ' playing' : '')} onClick={onPlay}>
      <span className="track-num">{index + 1}</span>
      <span className="track-play-mini">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14z" /></svg>
      </span>
      {t.artworkUrl100
        ? <img className="track-img" src={t.artworkUrl100} loading="lazy" alt="" />
        : <div className="track-img" style={{ background: '#333' }} />}
      <div style={{ minWidth: 0 }}>
        <p className="track-title">{t.trackName}</p>
        <p className="track-artist">{t.artistName}</p>
      </div>
      <span className="track-album">{t.collectionName || ''}</span>
      <span className="track-dur">{fmtDur(t.trackTimeMillis)}</span>
      <button className={'like-btn' + (liked ? ' liked' : '')} title="Like" onClick={(e) => { e.stopPropagation(); onLike(); }}>
        <svg viewBox="0 0 16 16" width="15" height="15" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z" /></svg>
      </button>
    </div>
  );
}

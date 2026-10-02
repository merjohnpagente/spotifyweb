import { bigArt, fmt } from '../lib/api.js';

export default function PlayerBar({ track, isPlaying, liked, ytStatus, ytLive, cur, dur, shuffleOn, repeatMode, onPlayPause, onNext, onPrev, onShuffle, onRepeat, onLike, onSeek, onMute, onOpenYt, onToggleDebug, progressRef }) {
  const art = track ? bigArt(track.artworkUrl100, 300) : '';
  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  return (
    <footer className="player">
      <div className="p-left">
        {art
          ? <img src={art} alt="" className="p-cover" />
          : <div className="p-cover placeholder">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#b3b3b3"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" /></svg>
            </div>}
        <div className="p-info">
          <p>{track ? track.trackName : 'Pick a song'}</p>
          <p>{track ? track.artistName : 'Search, then press play — powered by YouTube'}</p>
        </div>
        <button className="icon-btn" title="Save to Liked Songs" onClick={onLike}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill={liked ? '#1ed760' : 'none'} stroke={liked ? '#1ed760' : 'currentColor'} strokeWidth="1.5">
            <path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z" />
          </svg>
        </button>
      </div>

      <div className="p-center">
        <div className="p-controls">
          <button className={'c-btn' + (shuffleOn ? ' on' : '')} title="Shuffle" onClick={onShuffle}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-1.804H13.11l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75 13.15.922z" /></svg>
          </button>
          <button className="c-btn nav-skip" title="Previous" onClick={onPrev}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 4h2.5v16H6zM19 4v16L9.5 12z" /></svg>
          </button>
          <button className="play-btn" title="Play" onClick={onPlayPause}>
            {isPlaying
              ? <svg viewBox="0 0 24 24" width="22" height="22" fill="#000"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
              : <svg viewBox="0 0 24 24" width="22" height="22" fill="#000"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14z" /></svg>}
          </button>
          <button className="c-btn nav-skip" title="Next" onClick={onNext}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.5 4H18v16h-2.5zM5 4l9.5 8L5 20z" /></svg>
          </button>
          <button className={'c-btn' + (repeatMode > 0 ? ' on' : '')} title="Repeat" onClick={onRepeat}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z" /></svg>
          </button>
        </div>
        <div className="p-progress">
          <span>{fmt(cur)}</span>
          <div className="bar" ref={progressRef} onClick={onSeek}>
            <div className="bar-fill" style={{ width: pct + '%' }} />
            <div className="bar-dot" style={{ left: pct + '%' }} />
          </div>
          <span>{fmt(dur)}</span>
        </div>
      </div>

      <div className="p-right">
        <span className={'yt-badge' + (ytLive ? ' live' : '')} onClick={onToggleDebug} title="Audio is streamed — click for debug log" style={{ cursor: 'pointer' }}>
          <svg viewBox="0 0 28 20" width="26" height="18"><path fill="#FF0000" d="M27.4 3.1c-.3-1.2-1.3-2.2-2.5-2.5C22.7 0 14 0 14 0S5.3 0 3.1.6C1.9.9.9 1.9.6 3.1 0 5.3 0 10 0 10s0 4.7.6 6.9c.3 1.2 1.3 2.2 2.5 2.5C5.3 20 14 20 14 20s8.7 0 10.9-.6c1.2-.3 2.2-1.3 2.5-2.5.6-2.2.6-6.9.6-6.9s0-4.7-.6-6.9z" /><path fill="#fff" d="M11.2 14.3V5.7L18.5 10l-7.3 4.3z" /></svg>
          <span>{ytStatus}</span>
        </span>
        <button className="c-btn" title="Volume" onClick={onMute}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.642 3.642 0 0 1-1.33-4.967 3.639 3.639 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 1.125.649z" /></svg>
        </button>
        <button className="c-btn" title="Open YouTube video" onClick={onOpenYt}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.53 9.47a.75.75 0 0 1 0 1.06l-2.72 2.72h1.018a.75.75 0 0 1 0 1.5H1.25v-3.579a.75.75 0 0 1 1.5 0v1.018l2.72-2.72a.75.75 0 0 1 1.06 0zm2.94-2.94a.75.75 0 0 1 0-1.06l2.72-2.72h-1.018a.75.75 0 1 1 0-1.5h3.578v3.579a.75.75 0 0 1-1.5 0V3.81l-2.72 2.72a.75.75 0 0 1-1.06 0z" /></svg>
        </button>
      </div>
    </footer>
  );
}

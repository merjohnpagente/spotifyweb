import { TrackRow } from './cards.jsx';

export default function PlaylistView({ liked, currentId, onPlayTrack, onToggleLike }) {
  if (!liked.length) {
    return (
      <section id="playlist-view">
        <div className="playlist-hero">
          <div className="playlist-cover-big liked-cover-big">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="#fff"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
          </div>
          <div>
            <p className="hero-kicker">Playlist</p>
            <h1 className="hero-title">Liked Songs</h1>
            <p className="hero-sub"><span className="hero-user">You</span> • 0 songs</p>
          </div>
        </div>
        <p style={{ color: '#b3b3b3', padding: '20px 10px' }}>Wala pay liked songs. Pag-search og kanta, dayon i-heart para ma-save diri.</p>
      </section>
    );
  }
  return (
    <section id="playlist-view">
      <div className="playlist-hero">
        <div className="playlist-cover-big liked-cover-big">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="#fff"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
        </div>
        <div>
          <p className="hero-kicker">Playlist</p>
          <h1 className="hero-title">Liked Songs</h1>
          <p className="hero-sub"><span className="hero-user">You</span> • {liked.length} song{liked.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <div className="playlist-bar">
        <button className="big-play" title="Play" onClick={() => onPlayTrack(0, liked)}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#000"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14z" /></svg>
        </button>
      </div>
      <div>
        {liked.map((t, i) => (
          <TrackRow
            key={t.trackId}
            t={t}
            index={i}
            playing={t.trackId === currentId}
            liked
            onPlay={() => onPlayTrack(i, liked)}
            onLike={() => onToggleLike(t)}
          />
        ))}
      </div>
    </section>
  );
}

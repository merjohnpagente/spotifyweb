import { bigArt, QUICK_COLORS } from '../lib/api.js';
import { SpotifyCard } from './cards.jsx';

export default function HomeView({ pool, onPlayTrack, onToast }) {
  const quick = pool.slice(0, 8);
  return (
    <section id="home-view">
      <div className="filter-chips">
        <button className="chip active">All</button>
        <button className="chip">Music</button>
        <button className="chip">Podcasts</button>
      </div>
      <h2 className="greeting">Good afternoon</h2>
      <div className="quick-grid">
        {quick.map((t, i) => {
          const art = bigArt(t.artworkUrl100, 200);
          return (
            <div className="quick-card" key={t.trackId} onClick={() => onPlayTrack(i, pool)}>
              {art
                ? <img className="quick-cover" src={art} alt="" />
                : <div className="quick-cover ph" style={{ background: QUICK_COLORS[i % 8] }}>{(t.trackName || '?')[0]}</div>}
              <span className="quick-title">{t.trackName || 'Unknown'}</span>
              <button className="quick-play" title="Play" onClick={(e) => { e.stopPropagation(); onPlayTrack(i, pool); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#000"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14z" /></svg>
              </button>
            </div>
          );
        })}
      </div>

      <div className="section-head"><h2>Made For You</h2><button className="show-all" onClick={() => onToast('Demo view — pag-search para sa daghang results')}>Show all</button></div>
      <div className="card-row">
        {pool.slice(0, 6).map((t) => (
          <SpotifyCard key={'m' + t.trackId} t={t} onPlay={() => onPlayTrack(pool.indexOf(t), pool)} />
        ))}
      </div>

      <div className="section-head"><h2>Your top mixes</h2><button className="show-all" onClick={() => onToast('Demo view — pag-search para sa daghang results')}>Show all</button></div>
      <div className="card-row">
        {pool.slice(6, 12).map((t) => (
          <SpotifyCard key={'x' + t.trackId} t={t} onPlay={() => onPlayTrack(pool.indexOf(t), pool)} />
        ))}
      </div>

      <div className="section-head"><h2>Jump back in</h2><button className="show-all" onClick={() => onToast('Demo view — pag-search para sa daghang results')}>Show all</button></div>
      <div className="card-row">
        {[...pool].reverse().slice(0, 6).map((t) => (
          <SpotifyCard key={'r' + t.trackId} t={t} round onPlay={() => onPlayTrack(pool.indexOf(t), pool)} />
        ))}
      </div>
    </section>
  );
}

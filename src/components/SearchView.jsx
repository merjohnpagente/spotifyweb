import { bigArt, CATS } from '../lib/api.js';
import { SpotifyCard, TrackRow } from './cards.jsx';

export default function SearchView({ searching, results, hasSearched, currentId, likedIds, onPlayTrack, onToggleLike, onBrowse }) {
  if (!hasSearched) {
    return (
      <section id="search-view">
        <h2>Browse all</h2>
        <div className="browse-grid">
          {CATS.map(([n, c, l]) => (
            <div className="browse-card" key={n} style={{ background: c }} onClick={() => onBrowse(n)}>
              <span>{n}</span><div className="b-icon">{l}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (searching) return <section><p style={{ color: '#b3b3b3' }}>Searching...</p></section>;
  if (!results.length) return <section><p style={{ color: '#b3b3b3' }}>No results</p></section>;

  const top = results[0];
  const seen = new Map();
  results.forEach((t) => { if (!seen.has(t.artistName)) seen.set(t.artistName, t); });

  return (
    <section id="search-view">
      <div className="results-top">
        <div className="top-result-card">
          <h2>Top result</h2>
          <div className="top-result-box" onClick={() => onPlayTrack(0, results)}>
            {top.artworkUrl100 ? <img src={bigArt(top.artworkUrl100, 300)} alt="" /> : null}
            <p className="tr-big-title">{top.trackName}</p>
            <p className="tr-sub">{top.artistName} • {top.collectionName || 'Single'}</p>
            <span className="tr-pill">Song</span>
          </div>
        </div>
        <div className="songs-col">
          <h2>Songs</h2>
          <div>
            {results.slice(0, 8).map((t, i) => (
              <TrackRow
                key={t.trackId}
                t={t}
                index={i}
                playing={t.trackId === currentId}
                liked={likedIds.has(t.trackId)}
                onPlay={() => onPlayTrack(i, results)}
                onLike={() => onToggleLike(t)}
              />
            ))}
          </div>
        </div>
      </div>
      <h2>Artists</h2>
      <div className="card-row">
        {[...seen.values()].slice(0, 6).map((t) => (
          <div className="card" key={t.artistName} onClick={() => onBrowse(t.artistName)}>
            <div className="card-cover-wrap">
              {t.artworkUrl100
                ? <img className="card-cover round" src={bigArt(t.artworkUrl100, 300)} loading="lazy" alt="" />
                : <div className="card-cover round" style={{ background: '#333' }} />}
            </div>
            <p className="card-title">{t.artistName}</p><p className="card-sub">Artist</p>
          </div>
        ))}
      </div>
      <h2>Albums</h2>
      <div className="card-row">
        {results.slice(0, 6).map((t) => (
          <SpotifyCard key={'a' + t.trackId} t={t} onPlay={() => onPlayTrack(results.indexOf(t), results)} />
        ))}
      </div>
    </section>
  );
}

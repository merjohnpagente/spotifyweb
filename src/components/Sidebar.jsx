export default function Sidebar({ view, liked, likedCount, onNav, onOpenLiked }) {
  const recent = [...liked].slice(-4).reverse();
  return (
    <aside className="sidebar">
      <div className="logo-row">
        <div className="logo-icon" title="Spotify">
          <svg viewBox="0 0 168 168" width="32" height="32"><circle cx="84" cy="84" r="84" fill="#fff" /><path fill="black" d="M122 110c-1.5 2.5-4.7 3.3-7.2 1.8-19.7-12-44.5-14.7-73.7-8-2.8.6-5.6-1.1-6.2-3.9-.6-2.8 1.1-5.6 3.9-6.2 32.3-7.3 59.6-4.1 81.4 9.3 2.5 1.5 3.3 4.7 1.8 7.2zm12.3-21.2c-1.9 3-5.9 4-8.9 2.1-22.5-13.8-56.8-17.8-83.4-9.7-3.4 1-7-1-8-4.4-1-3.4 1-7 4.4-8 30.4-9.2 68.2-4.7 94 11.1 3 1.9 4 5.9 2.1 8.9zm1.1-22.1C112.5 53 68.8 52 42.1 60.2c-4 1.2-8.3-1.1-9.5-5.1-1.2-4 1.1-8.3 5.1-9.5 30.4-9.3 79.1-8.2 110.3 7.7 3.6 1.8 5 6.2 3.2 9.8-1.9 3.6-6.2 5-9.8 3.6z" /></svg>
        </div>
        <span className="logo-text">Spotify</span>
      </div>

      <nav className="side-nav">
        <button className={'nav-item' + (view === 'home' ? ' active' : '')} onClick={() => onNav('home')}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12.5 3.247a1 1 0 0 0-1 0L4 7.577V20h4.5v-6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6H20V7.577l-7.5-4.33zm-2-1.732a3 3 0 0 1 3 0l7.5 4.33a2 2 0 0 1 1 1.732V20a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1v-6h-3v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.577a2 2 0 0 1 1-1.732l7.5-4.33z" /></svg>
          <span>Home</span>
        </button>
        <button className={'nav-item' + (view === 'search' ? ' active' : '')} onClick={() => onNav('search')}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5zM.25 7a6.75 6.75 0 1 1 12.096 4.12l3.535 3.536a.75.75 0 1 1-1.061 1.06l-3.535-3.535A6.75 6.75 0 0 1 .25 7z" /></svg>
          <span>Search</span>
        </button>
      </nav>

      <div className="library">
        <div className="lib-header">
          <button className="lib-title" onClick={onOpenLiked}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M14.5 2.134a1 1 0 0 1 1 0l6 3.464a1 1 0 0 1 .5.866V21a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2h-2v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.464a1 1 0 0 1 .5-.866l6-3.464zM9 2 3.5 5.175V20h4v-6a1 1 0 0 1 1-1h7V5.175L9 2z" /></svg>
            <span>Your Library</span>
          </button>
        </div>
        <div className="lib-filters">
          <button className="chip">Playlists</button>
          <button className="chip">Artists</button>
          <button className="chip">Albums</button>
        </div>
        <ul className="lib-list">
          <li className="lib-item" onClick={onOpenLiked}>
            <div className="lib-cover liked-cover">
              <svg viewBox="0 0 16 16" width="20" height="20" fill="#fff"><path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z" /></svg>
            </div>
            <div className="lib-meta">
              <p className="lib-name">Liked Songs</p>
              <p className="lib-sub">Playlist • {likedCount}</p>
            </div>
          </li>
          {recent.map((t) => (
            <li className="lib-item" key={t.trackId}>
              <div className="lib-cover">{t.artworkUrl100 ? <img src={t.artworkUrl100} alt="" /> : null}</div>
              <div className="lib-meta">
                <p className="lib-name">{t.trackName}</p>
                <p className="lib-sub">{t.artistName}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

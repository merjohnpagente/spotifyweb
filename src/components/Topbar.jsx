export default function Topbar({ query, setQuery, onSubmit, onClear, onBack, onToast }) {
  return (
    <header className="topbar">
      <div className="top-left">
        <button className="round-btn" onClick={onBack} title="Go back">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0z" /></svg>
        </button>
        <div className="search-pill">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5zM.25 7a6.75 6.75 0 1 1 12.096 4.12l3.535 3.536a.75.75 0 1 1-1.061 1.06l-3.535-3.535A6.75 6.75 0 0 1 .25 7z" /></svg>
          <input
            type="text"
            placeholder="What do you want to play?"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
          />
          {query && (
            <button className="clear-btn" onClick={onClear} title="Clear">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2.47 1.47a.75.75 0 0 1 1.06 0L8 5.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 7l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 8.06l-4.47 4.47a.75.75 0 1 1-1.06-1.06L6.94 7 2.47 2.53a.75.75 0 0 1 0-1.06z" /></svg>
            </button>
          )}
        </div>
      </div>
      <div className="top-right">
        <button className="premium-btn" onClick={() => onToast('Demo ni — libre tanan dinhi')}>Explore Premium</button>
        <button className="avatar">J</button>
      </div>
    </header>
  );
}

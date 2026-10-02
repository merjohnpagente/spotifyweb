export default function DebugPanel({ open, lines, link, setLink, onPlayLink, apiKey, setApiKey, onSaveKey, onCopy }) {
  if (!open) return null;
  return (
    <div id="yt-debug">
      <div className="dbg-head"><span>YouTube debug log</span><button onClick={onCopy}>Kopyaha</button></div>
      <pre id="dbg-lines">{lines.length ? lines.join('\n') : 'Wala pay log — pag-search ug pag-play og kanta.'}</pre>
      <div className="dbg-link">
        <input value={link} onChange={(e) => setLink(e.target.value)} type="text" placeholder="Paste YouTube link dinhi para FULL..." />
        <button onClick={onPlayLink}>Play FULL</button>
      </div>
      <div className="dbg-link">
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="text" placeholder="YouTube API key (optional, para sure full)..." />
        <button onClick={onSaveKey}>Save</button>
      </div>
      <p className="dbg-hint">Libre nga key: console.cloud.google.com → YouTube Data API v3 → Create API key → paste dinhi.</p>
    </div>
  );
}

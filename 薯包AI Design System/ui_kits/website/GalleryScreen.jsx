/* 薯包AI · Gallery grid (薯包出品) */
(function () {
  function GalleryScreen({ onOpenNote, onRemix }) {
    const D = window.SB_DATA;
    const NoteCard = window.NoteCard;
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px 64px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, textAlign: "center", margin: "0 0 6px", color: "var(--text-strong)" }}>
          薯包出品 <span className="sb-grad-text">🔥</span>
        </h1>
        <p style={{ textAlign: "center", color: "var(--text-muted)", margin: "0 0 32px", fontSize: 15 }}>
          全部由薯包 AI 一键生成 · 点「查看全套」看完整图文，或「一键同款」立刻生成你的版本
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {D.gallery.map(g => <NoteCard key={g.id} item={g} onClick={() => onOpenNote(g)} onRemix={(it) => onRemix(it)} />)}
        </div>
      </div>
    );
  }
  window.GalleryScreen = GalleryScreen;
})();

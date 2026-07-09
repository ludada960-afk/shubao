/* 薯包AI · top navigation bar */
(function () {
  const { Button, Badge } = window.AIDesignSystem_67568f;

  function Nav({ page, setPage, logged, setLogged, pts, onLogin }) {
    const links = [["home", "首页"], ["gallery", "薯包出品"], ["pricing", "价格方案"], ["works", "我的作品"]];
    return (
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 28px", background: "rgba(255,250,249,.82)",
        backdropFilter: "blur(16px)", borderBottom: "1.5px solid var(--coral-100)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
               onClick={() => setPage("home")}>
            <img src="../../assets/logo-icon.webp" alt="薯包AI"
                 style={{ width: 36, height: 36, borderRadius: 11, boxShadow: "var(--sh-sm)" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--coral-500)", whiteSpace: "nowrap" }}>薯包AI</span>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {links.map(([k, v]) => (
              <button key={k} onClick={() => setPage(k)}
                style={{
                  fontFamily: "var(--font-body)", fontSize: 14,
                  fontWeight: page === k ? 700 : 500,
                  color: page === k ? "var(--coral-600)" : "var(--text-muted)",
                  background: page === k ? "var(--coral-50)" : "transparent",
                  border: "none", padding: "8px 15px", cursor: "pointer",
                  borderRadius: "var(--r-pill)", transition: "all .15s",
                }}>{v}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {logged && (
            <Badge tone="coral" icon={<span style={{ fontSize: 11 }}>✦</span>}>{pts} 套</Badge>
          )}
          {logged
            ? <Button variant="secondary" size="sm" onClick={() => setLogged(false)}>已登录</Button>
            : <Button variant="primary" size="sm" onClick={onLogin}>登录</Button>}
        </div>
      </nav>
    );
  }
  window.Nav = Nav;
})();

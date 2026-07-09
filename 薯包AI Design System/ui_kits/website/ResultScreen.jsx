/* 薯包AI · Loading + Result (Xiaohongshu note) screens */
(function () {
  const { Button, Badge, Tag, Avatar } = window.AIDesignSystem_67568f;
  const { Sparkles, Copy, Check, Heart, Share, Bookmark, MessageCircle, ArrowLeft, Download, Refresh, Zap } = window;
  const { useState, useEffect } = React;

  /* ---------- LOADING ---------- */
  function LoadingScreen({ stage }) {
    const D = window.SB_DATA;
    const [tip, setTip] = useState(0);
    useEffect(() => { const t = setInterval(() => setTip(i => (i + 1) % D.tips.length), 2600); return () => clearInterval(t); }, []);
    const st = D.stages[stage] || D.stages[0];
    return (
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "54px 20px", textAlign: "center", animation: "sb-pop-in .3s" }}>
        <img src={`../../assets/mascot-${st.pose}.webp`} alt={st.label} style={{ height: 168, animation: "sb-float 2s ease-in-out infinite", filter: "drop-shadow(0 12px 26px rgba(255,71,87,.2))" }} />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "16px 0 6px", color: "var(--text-strong)" }}>{st.label}</h2>
        <p style={{ fontSize: 14.5, color: "var(--text-muted)", margin: "0 0 26px" }}>{st.desc}</p>
        <div style={{ display: "flex", gap: 5, marginBottom: 24, padding: "0 24px" }}>
          {D.stages.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: i <= stage ? "var(--grad-coral)" : "var(--ink-200)", transition: "background .5s" }} />
          ))}
        </div>
        <div style={{ background: "var(--coral-50)", borderRadius: "var(--r-md)", padding: "11px 16px", marginBottom: 18, fontSize: 12.5, color: "var(--coral-700)", display: "flex", gap: 7, alignItems: "center", justifyContent: "center" }}>
          ⏳ 生成中请勿刷新页面，否则会浪费 1 套额度
        </div>
        <div style={{ background: "var(--surface-card)", borderRadius: "var(--r-md)", padding: "14px 18px", boxShadow: "var(--clay-raised)", textAlign: "left" }}>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}><Zap size={12} color="var(--sun-500)" />小红书冷知识</div>
          <div style={{ fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.7, minHeight: 36 }}>{D.tips[tip]}</div>
        </div>
      </div>
    );
  }

  /* ---------- RESULT / NOTE ---------- */
  function CopyBtn({ text, label }) {
    const [ok, setOk] = useState(false);
    return (
      <button onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, padding: "6px 12px", borderRadius: "var(--r-pill)", background: ok ? "var(--sprout-50)" : "var(--coral-50)", color: ok ? "var(--sprout-600)" : "var(--coral-600)", transition: "all .15s" }}>
        {ok ? <><Check size={12} />已复制</> : <><Copy size={12} />{label}</>}
      </button>
    );
  }

  function ResultScreen({ item, onBack, onRemix }) {
    const imgs = [item.cover, "mascot-jump", "mascot-paint", "mascot-cook"];
    const [idx, setIdx] = useState(0);
    const body = item.body || "";
    const tagStr = (item.tags || []).map(t => "#" + t).join(" ");

    return (
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "20px 20px 64px", animation: "sb-pop-in .3s" }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={onBack} style={{ marginBottom: 14 }}>返回</Button>
        <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* LEFT — image */}
          <div style={{ flex: "1 1 320px", maxWidth: 380 }}>
            <div style={{ position: "relative", borderRadius: "var(--r-lg)", overflow: "hidden", background: item.grad, aspectRatio: "3/4", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-lg)" }}>
              <div style={{ position: "absolute", inset: 0, background: "var(--gloss)", opacity: .5 }} />
              <img src={`../../assets/${imgs[idx]}.webp`} alt="" style={{ width: "72%", objectFit: "contain", filter: "drop-shadow(0 10px 22px rgba(0,0,0,.2))" }} />
              <div style={{ position: "absolute", right: 10, bottom: 10, background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)", borderRadius: "var(--r-sm)", padding: "3px 9px", color: "#fff", fontSize: 11, fontFamily: "var(--font-num)" }}>{idx + 1}/{imgs.length}</div>
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
              {imgs.map((im, i) => (
                <div key={i} onClick={() => setIdx(i)} style={{ width: 52, height: 68, borderRadius: "var(--r-sm)", overflow: "hidden", background: item.grad, cursor: "pointer", border: i === idx ? "2.5px solid var(--coral-400)" : "2.5px solid transparent", opacity: i === idx ? 1 : .55, transition: "all .15s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={`../../assets/${im}.webp`} alt="" style={{ width: "76%", objectFit: "contain" }} />
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" block icon={<Refresh size={13} />} style={{ marginTop: 10 }}>重新生成这张</Button>
          </div>

          {/* RIGHT — text */}
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Avatar src="../../assets/logo-icon.webp" name="薯包" size={40} ring />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>薯包 AI</div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>AI 创作 · 即刻发布</div>
              </div>
              <span style={{ marginLeft: "auto" }}><Badge tone="coral">{item.cat}</Badge></span>
            </div>

            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1.4, color: "var(--coral-600)", margin: "0 0 12px" }}>{item.title}</h1>
            <div style={{ fontSize: 14.5, lineHeight: 2, color: "var(--text-body)", whiteSpace: "pre-wrap", marginBottom: 16 }}>{body}</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
              {(item.tags || []).map((t, i) => <Tag key={i}>{t}</Tag>)}
            </div>

            {/* xiaohongshu action bar */}
            <div style={{ display: "flex", gap: 18, padding: "12px 0", borderTop: "1.5px solid var(--ink-100)", borderBottom: "1.5px solid var(--ink-100)", marginBottom: 16, color: "var(--text-muted)", fontSize: 13 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Heart size={18} color="var(--like)" fill="var(--like)" />{item.likes}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Bookmark size={18} />收藏</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><MessageCircle size={18} />评论</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}><Share size={18} />分享</span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn text={item.title} label="复制标题" />
              <CopyBtn text={tagStr} label="复制标签" />
              <CopyBtn text={item.title + "\n\n" + body + "\n\n" + tagStr} label="复制全文" />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Button variant="primary" icon={<Sparkles size={16} />} onClick={() => onRemix(item)}>一键同款</Button>
              <Button variant="secondary" icon={<Download size={15} />}>下载图片</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.LoadingScreen = LoadingScreen;
  window.ResultScreen = ResultScreen;
})();

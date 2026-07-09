/* 薯包AI · Home — hero, generator, features, gallery teaser */
(function () {
  const { Button, Card, Badge, Tag, Mascot } = window.AIDesignSystem_67568f;
  const { Sparkles, Hash, Target, Zap, Layers, Refresh, Wand, Eye, Heart, ChevronRight } = window;
  const { useState, useEffect } = React;

  const FEATURES = [
    { Icon: Target, title: "智能识别赛道", desc: "粘贴任意素材，AI 自动判断旅游、美食、好物等最佳内容策略，无需手动选择", tone: "coral" },
    { Icon: Zap, title: "爆款公式驱动", desc: "内置数字结果式、反差痛点式等经过验证的爆款标题和正文公式", tone: "sun" },
    { Icon: Layers, title: "9 张完整配图", desc: "1 张封面 + 8 张内容页，带拼图排版和文字标注，下载即可发布", tone: "sprout" },
    { Icon: Refresh, title: "单张可重生成", desc: "对某张图不满意？单独刷新这一张，不浪费整套额度", tone: "grape" },
    { Icon: Wand, title: "一键复制文案", desc: "标题、正文、标签分别复制或一键全部复制，打开小红书直接粘贴", tone: "coral" },
    { Icon: Sparkles, title: "按套计费不套路", desc: "用多少买多少，不搞自动续费，新用户免费体验 1 套", tone: "sun" },
  ];
  const TONE = {
    coral: ["var(--grad-coral)", "rgba(255,71,87,.3)"],
    sun: ["var(--grad-sunset)", "rgba(255,160,0,.32)"],
    sprout: ["var(--grad-sprout)", "rgba(92,201,122,.3)"],
    grape: ["var(--grad-grape)", "rgba(139,92,246,.3)"],
  };

  function FeatureCard({ f }) {
    const [h, setH] = useState(false);
    const [g, gShadow] = TONE[f.tone];
    return (
      <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{
          background: "var(--surface-card)", borderRadius: "var(--r-lg)",
          border: "1.5px solid var(--border-soft)", padding: 22,
          boxShadow: h ? "var(--sh-lg)" : "var(--clay-raised)",
          transform: h ? "translateY(-6px)" : "none",
          transition: "transform .28s var(--ease-spring), box-shadow .28s",
        }}>
        <div style={{
          width: 48, height: 48, borderRadius: "var(--r-md)", background: g,
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
          marginBottom: 14, boxShadow: `0 8px 18px ${gShadow}`,
          transform: h ? "rotate(-6deg) scale(1.08)" : "none",
          transition: "transform .3s var(--ease-spring)",
        }}><f.Icon size={24} /></div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: "0 0 6px", color: "var(--text-strong)" }}>{f.title}</h3>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "var(--text-muted)" }}>{f.desc}</p>
      </div>
    );
  }

  function HomeScreen({ onGenerate, onOpenNote }) {
    const [text, setText] = useState("");
    const [focus, setFocus] = useState(false);
    const [hint, setHint] = useState(0);
    const D = window.SB_DATA;
    useEffect(() => {
      const t = setInterval(() => setHint(i => (i + 1) % D.hints.length), 2600);
      return () => clearInterval(t);
    }, []);

    return (
      <div>
        {/* HERO */}
        <section style={{ position: "relative", overflow: "hidden", background: "var(--grad-spotlight)", padding: "44px 20px 36px" }}>
          {/* floating sparkles */}
          {[["8%", "18%", 22, "0s"], ["88%", "26%", 16, ".6s"], ["16%", "70%", 14, "1.1s"], ["82%", "66%", 20, ".3s"]].map(([l, t, s, d], i) => (
            <span key={i} style={{ position: "absolute", left: l, top: t, fontSize: s, color: "var(--sun-400)", animation: `sb-twinkle 2.4s ${d} ease-in-out infinite` }}>✦</span>
          ))}
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative" }}>
            <div style={{ display: "inline-flex", marginBottom: 6 }}>
              <Badge tone="coral" variant="solid" icon={<Sparkles size={12} />}>小红书爆款 · 一键生成</Badge>
            </div>
            <Mascot src="../../assets/mascot-wave.webp" size={120} anim="float" style={{ margin: "10px auto 6px" }} />
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px,5vw,50px)", lineHeight: 1.18, color: "var(--text-strong)", margin: "0 0 12px" }}>
              一句话主题，<span className="sb-grad-text">秒出爆款图文</span>
            </h1>
            <p style={{ fontSize: 16, color: "var(--text-muted)", maxWidth: 520, margin: "0 auto 26px", lineHeight: 1.7 }}>
              输入任意主题或素材，薯包 AI 自动识别赛道，生成爆款标题 + 种草文案 + 9 张精美配图
            </p>

            {/* GENERATOR CARD */}
            <div style={{
              background: "var(--surface-card)", borderRadius: "var(--r-xl)", padding: 22,
              boxShadow: "var(--sh-xl)", border: "1.5px solid var(--coral-100)", textAlign: "left",
              maxWidth: 600, margin: "0 auto",
            }}>
              <div style={{
                position: "relative", borderRadius: "var(--r-lg)",
                border: `2px solid ${focus ? "var(--coral-400)" : "var(--border-soft)"}`,
                boxShadow: focus ? "var(--ring-brand)" : "var(--clay-inset)",
                transition: "all .2s", background: "#fff", padding: "14px 16px",
              }}>
                <textarea value={text} onChange={e => setText(e.target.value)}
                  onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                  placeholder={"输入你想创作的主题，一句话就够了\n例如：云南3天2夜旅游攻略、百元蓝牙耳机测评…"}
                  style={{ width: "100%", minHeight: 96, border: "none", outline: "none", resize: "vertical", fontFamily: "var(--font-body)", fontSize: 15, lineHeight: 1.75, color: "var(--text-strong)", background: "transparent" }} />
              </div>

              {/* rotating hint */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 2px", color: "var(--text-faint)", fontSize: 12 }}>
                <Hash size={13} color="var(--coral-400)" />
                <span>试试热门主题：</span>
                <button onClick={() => setText(D.hints[hint])}
                  style={{ border: "none", background: "var(--coral-50)", color: "var(--coral-600)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12.5, padding: "5px 12px", borderRadius: "var(--r-pill)", cursor: "pointer", transition: "all .25s var(--ease-out)" }}>
                  {D.hints[hint]} ↵
                </button>
              </div>

              <Button variant="primary" size="lg" block disabled={!text.trim()}
                icon={<Sparkles size={20} />} onClick={() => onGenerate(text)}>
                一键生成爆款图文
              </Button>
              <div style={{ textAlign: "center", marginTop: 10, fontSize: 11.5, color: "var(--text-faint)" }}>
                新用户免费体验 1 套 · 无需信用卡
              </div>
            </div>

            {/* social proof */}
            <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 26, flexWrap: "wrap" }}>
              {[["12 万+", "篇图文生成"], ["98%", "用户好评"], ["15 秒", "平均出稿"]].map(([n, l]) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-num)", fontWeight: 700, fontSize: 26, color: "var(--coral-500)" }}>{n}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GALLERY TEASER — right under the generator so users see real output */}
        <section style={{ maxWidth: 1000, margin: "0 auto", padding: "44px 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, margin: "0 0 4px", color: "var(--text-strong)" }}>薯包出品 🔥 看看生成效果</h2>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>下面都是薯包 AI 一键生成的 · 点「一键同款」立刻做你的专属版本</p>
            </div>
            <Button variant="ghost" iconRight={<ChevronRight size={16} />} onClick={() => onOpenNote(null)}>查看全部</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {D.gallery.slice(0, 4).map(g => <NoteCard key={g.id} item={g} onClick={() => onOpenNote(g)} onRemix={(it) => onGenerate(it.title)} />)}
          </div>
        </section>

        {/* FEATURES */}
        <section style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px 64px" }}>
          <h2 style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: 32, margin: "0 0 6px", color: "var(--text-strong)" }}>为什么选薯包 AI</h2>
          <p style={{ textAlign: "center", color: "var(--text-muted)", margin: "0 0 32px", fontSize: 15 }}>把小红书爆款方法论，装进一个会卖萌的小薯包</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {FEATURES.map((f, i) => <FeatureCard key={i} f={f} />)}
          </div>
        </section>
      </div>
    );
  }

  /* Shared note card (used here + gallery) */
  function NoteCard({ item, onClick, onRemix }) {
    const { Card, Badge } = window.AIDesignSystem_67568f;
    const { Heart, Eye, Sparkles } = window;
    const [h, setH] = React.useState(false);
    return (
      <Card hover onClick={onClick} pad={0} variant="raised">
        <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
          style={{ background: item.grad, height: 150, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "var(--gloss)", opacity: .5 }} />
          <img src={`../../assets/${item.cover}.webp`} alt="" loading="lazy" decoding="async" style={{ height: 110, objectFit: "contain", filter: "drop-shadow(0 6px 14px rgba(0,0,0,.18))", transform: h ? "scale(1.08) rotate(-3deg)" : "none", transition: "transform .35s var(--ease-spring)" }} />
          <span style={{ position: "absolute", top: 10, left: 10 }}><Badge tone="neutral" variant="solid" style={{ background: "rgba(255,255,255,.28)", backdropFilter: "blur(4px)", color: "#fff" }}>{item.cat}</Badge></span>
          {h && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.28)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, animation: "sb-pop-in .2s" }}>
            <span onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} style={{ background: "#fff", color: "var(--coral-600)", fontSize: 12.5, fontWeight: 700, padding: "7px 16px", borderRadius: "var(--r-pill)", display: "flex", alignItems: "center", gap: 5, boxShadow: "var(--sh-md)", cursor: "pointer" }}><Eye size={14} />查看全套</span>
            <span onClick={(e) => { e.stopPropagation(); onRemix && onRemix(item); }} style={{ background: "var(--grad-coral)", color: "#fff", fontSize: 12.5, fontWeight: 700, padding: "7px 16px", borderRadius: "var(--r-pill)", display: "flex", alignItems: "center", gap: 5, boxShadow: "var(--glow-coral)", cursor: "pointer" }}><Sparkles size={14} />一键同款</span>
          </div>}
        </div>
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, color: "var(--text-strong)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 40 }}>{item.title}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--like)", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}><Heart size={11} fill="var(--like)" />{item.likes}</span>
            <span style={{ fontSize: 10, color: "var(--text-faint)" }}>薯包AI 出品</span>
          </div>
        </div>
      </Card>
    );
  }

  window.HomeScreen = HomeScreen;
  window.NoteCard = NoteCard;
})();

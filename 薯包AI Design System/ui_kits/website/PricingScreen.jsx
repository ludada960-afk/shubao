/* 薯包AI · Pricing plans */
(function () {
  const { Button, Badge, Mascot } = window.AIDesignSystem_67568f;
  const { Sparkles, Check } = window;
  const { useState } = React;

  function PlanCard({ p, onBuy }) {
    const [h, setH] = useState(false);
    return (
      <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{
          position: "relative", background: p.pop ? "var(--surface-card)" : "var(--surface-card)",
          borderRadius: "var(--r-xl)", padding: "26px 20px", textAlign: "center",
          border: p.pop ? "2.5px solid var(--coral-400)" : "1.5px solid var(--border-soft)",
          boxShadow: h ? "var(--sh-xl)" : (p.pop ? "var(--glow-coral)" : "var(--clay-raised)"),
          transform: h ? "translateY(-8px)" : (p.pop ? "translateY(-6px)" : "none"),
          transition: "transform .3s var(--ease-spring), box-shadow .3s",
        }}>
        {p.pop && <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)" }}>
          <Badge tone="coral" variant="solid" icon={<Sparkles size={11} />}>最受欢迎</Badge>
        </div>}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-strong)", marginBottom: 4 }}>{p.name}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>{p.desc}</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginBottom: 2 }}>
          <span style={{ fontFamily: "var(--font-num)", fontWeight: 700, fontSize: 18, color: "var(--coral-500)" }}>¥</span>
          <span className="sb-grad-text" style={{ fontFamily: "var(--font-num)", fontWeight: 700, fontSize: 46 }}>{p.price}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>{p.sets} 套图文 · 约 ¥{p.per}/套</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, textAlign: "left", marginBottom: 20, fontSize: 13 }}>
          {[`${p.sets} 套完整图文（含 9 张配图）`, `单张重生成 ${p.regen} 次/套`, "标题 + 正文 + 标签全包", "一次性购买，不自动续费"].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-body)" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--sprout-100)", color: "var(--sprout-600)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}><Check size={11} /></span>
              {t}
            </div>
          ))}
        </div>
        <Button variant={p.pop ? "primary" : "secondary"} block onClick={() => onBuy(p)}>
          {p.pop ? "立即购买" : "选择套餐"}
        </Button>
      </div>
    );
  }

  function PricingScreen({ onBuy }) {
    const D = window.SB_DATA;
    return (
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 20px 64px" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <Mascot src="../../assets/mascot-upgrade.webp" size={96} anim="bob" style={{ margin: "0 auto" }} />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, textAlign: "center", margin: "0 0 6px", color: "var(--text-strong)" }}>价格方案</h1>
        <p style={{ textAlign: "center", color: "var(--text-muted)", margin: "0 0 34px", fontSize: 15 }}>
          按套收费，不搞自动续费 · 每套包含完整标题 + 正文 + 标签 + 9 张配图
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, alignItems: "start" }}>
          {D.pricing.map((p, i) => <PlanCard key={i} p={p} onBuy={onBuy} />)}
        </div>
        <p style={{ textAlign: "center", marginTop: 26, fontSize: 12.5, color: "var(--text-faint)" }}>
          所有套餐均为一次性购买 · 不自动续费 · 不限使用时间
        </p>
      </div>
    );
  }
  window.PricingScreen = PricingScreen;
})();

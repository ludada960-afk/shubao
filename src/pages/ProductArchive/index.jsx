// 4c183cd4 续命 P3 商品档案独立页 (/product-archives/:profileId) - 分享用
// 用途: 创作者可以分享档案 URL, 让他人查看 (但不能编辑)
import React, { useEffect, useState } from "react";
import { getProductProfile } from "../../services/projects.js";

// 简单 hash router (匹配既有 DSH App.jsx 风格)
function readHashPath() {
  const hash = (typeof window !== "undefined" ? window.location.hash : "") || "";
  const m = hash.match(/^#?(?:\/)?(?:product-archives)\/(profile-[^/?#]+)/i);
  if (!m) return { profileId: null };
  return { profileId: decodeURIComponent(m[1]) };
}

function ProductArchive() {
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const { profileId } = readHashPath();
        if (!profileId) { setErr("未提供商品档案 id"); setLoading(false); return; }
        const data = await getProductProfile(profileId);
        if (cancelled) return;
        setProfile(data && data.profile ? data.profile : data);
      } catch (e) {
        if (cancelled) return;
        setErr(e && e.message ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return React.createElement("section", { className: "product-archive-page" }, "加载中...");
  if (err) return React.createElement("section", { className: "product-archive-page" }, "错误: ", err);
  if (!profile) return React.createElement("section", { className: "product-archive-page" }, "商品档案不存在");

  const copyLink = async () => {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (navigator && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch (e) { /* ignore */ }
  };

  return React.createElement("section", { className: "product-archive-page", "data-testid": "product-archive" },
    React.createElement("header", null,
      React.createElement("h1", null, "商品档案公开页"),
      React.createElement("p", null, "由薯包用户公开分享"),
      React.createElement("button", { type: "button", "data-testid": "copy-link", onClick: copyLink }, "复制分享链接")
    ),
    React.createElement("section", { className: "product-archive-meta" },
      React.createElement("h2", null, profile.name || "未命名"),
      profile.category ? React.createElement("p", null, "类目: ", profile.category) : null,
      profile.sellingPoints ? React.createElement("p", null, "卖点: ", profile.sellingPoints.join ? profile.sellingPoints.join(" / ") : profile.sellingPoints) : null
    ),
    profile.assets && profile.assets.length ? React.createElement("section", { className: "product-archive-assets" },
      React.createElement("h3", null, "素材 (", profile.assets.length, ")"),
      React.createElement("ul", null, profile.assets.map(function (a, i) {
        return React.createElement("li", { key: i }, a.role || a.kind || "素材", " #", i + 1);
      }))
    ) : null,
  );
}

export default ProductArchive;
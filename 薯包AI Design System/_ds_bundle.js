/* @ds-bundle: {"format":3,"namespace":"AIDesignSystem_67568f","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Mascot","sourcePath":"components/core/Mascot.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"4fa075c873e4","components/core/Badge.jsx":"35a72c3cefaf","components/core/Button.jsx":"5eaa2272a453","components/core/Card.jsx":"fc56cd793394","components/core/Mascot.jsx":"7fe39976a33c","components/core/Tag.jsx":"9cf8d3e934a7","components/forms/Input.jsx":"2daaa067be98","components/forms/Switch.jsx":"7442e380f95b","ui_kits/website/GalleryScreen.jsx":"022a02f7fc50","ui_kits/website/HomeScreen.jsx":"5f888df08277","ui_kits/website/Nav.jsx":"09bba4d5842f","ui_kits/website/PricingScreen.jsx":"ef45078de400","ui_kits/website/ResultScreen.jsx":"a0617e855b7f","ui_kits/website/data.js":"579414625a66","ui_kits/website/icons.jsx":"b867652da3c1"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AIDesignSystem_67568f = window.AIDesignSystem_67568f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * 薯包AI Avatar — rounded user / creator avatar with optional ring.
 */
function Avatar({
  src,
  name = "",
  size = 40,
  ring = false,
  style = {},
  ...rest
}) {
  const initial = name ? name.trim().slice(0, 1) : "薯";
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: size,
      height: size,
      borderRadius: "var(--r-pill)",
      overflow: "hidden",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto",
      background: src ? "var(--ink-100)" : "var(--grad-coral)",
      color: "#fff",
      fontFamily: "var(--font-display)",
      fontSize: size * 0.42,
      boxShadow: ring ? "0 0 0 2.5px var(--surface-card), 0 0 0 4.5px var(--coral-300), var(--sh-sm)" : "var(--sh-xs)",
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initial);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * 薯包AI Badge — small status / category pill.
 * tone: coral | sprout | sun | grape | neutral
 * variant: soft (tinted) | solid (filled gradient)
 */
function Badge({
  children,
  tone = "coral",
  variant = "soft",
  icon = null,
  style = {},
  ...rest
}) {
  const tones = {
    coral: {
      soft: ["var(--coral-50)", "var(--coral-600)"],
      grad: "var(--grad-coral)"
    },
    sprout: {
      soft: ["var(--sprout-50)", "var(--sprout-700)"],
      grad: "var(--grad-sprout)"
    },
    sun: {
      soft: ["var(--sun-100)", "var(--sun-600)"],
      grad: "var(--grad-sunset)"
    },
    grape: {
      soft: ["#F1ECFE", "var(--grape-600)"],
      grad: "var(--grad-grape)"
    },
    neutral: {
      soft: ["var(--ink-100)", "var(--ink-600)"],
      grad: "linear-gradient(135deg,#9C8488,#5A4145)"
    }
  };
  const t = tones[tone] || tones.coral;
  const solid = variant === "solid";
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontFamily: "var(--font-body)",
      fontSize: "var(--fs-xs)",
      fontWeight: 700,
      lineHeight: 1,
      padding: "5px 11px",
      borderRadius: "var(--r-pill)",
      color: solid ? "#fff" : t.soft[1],
      background: solid ? t.grad : t.soft[0],
      boxShadow: solid ? "0 4px 12px rgba(120,40,50,.18)" : "none",
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * 薯包AI Button — chunky 3D "jelly" button with springy press.
 * variant: primary | secondary | ghost | sun | sprout
 * size: sm | md | lg
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  disabled = false,
  icon = null,
  iconRight = null,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const sizes = {
    sm: {
      padding: "8px 16px",
      fontSize: 13,
      radius: "var(--r-sm)",
      gap: 6,
      h: 0
    },
    md: {
      padding: "13px 26px",
      fontSize: 15,
      radius: "var(--r-md)",
      gap: 8,
      h: 0
    },
    lg: {
      padding: "17px 38px",
      fontSize: 18,
      radius: "var(--r-lg)",
      gap: 10,
      h: 0
    }
  };
  const sz = sizes[size] || sizes.md;
  const palettes = {
    primary: {
      bg: "var(--grad-brand)",
      color: "#fff",
      rest: "var(--btn-3d-coral)",
      down: "var(--btn-3d-coral-press)"
    },
    sun: {
      bg: "var(--grad-sunset)",
      color: "#fff",
      rest: "0 1px 0 rgba(255,255,255,.5) inset, 0 6px 0 #C98A00, 0 12px 22px rgba(255,160,0,.4)",
      down: "0 1px 0 rgba(255,255,255,.5) inset, 0 2px 0 #C98A00, 0 6px 14px rgba(255,160,0,.35)"
    },
    sprout: {
      bg: "var(--grad-sprout)",
      color: "#fff",
      rest: "0 1px 0 rgba(255,255,255,.5) inset, 0 6px 0 var(--sprout-700), 0 12px 22px rgba(92,201,122,.4)",
      down: "0 1px 0 rgba(255,255,255,.5) inset, 0 2px 0 var(--sprout-700), 0 6px 14px rgba(92,201,122,.35)"
    },
    secondary: {
      bg: "#fff",
      color: "var(--coral-600)",
      rest: "var(--btn-3d-white)",
      down: "0 1px 0 rgba(255,255,255,.9) inset, 0 2px 0 #F0DADA, 0 6px 14px rgba(120,40,50,.12)",
      border: "var(--bw) solid var(--coral-200)"
    },
    ghost: {
      bg: "transparent",
      color: "var(--coral-600)",
      rest: "none",
      down: "none",
      flat: true
    }
  };
  const p = palettes[variant] || palettes.primary;
  const lift = press ? 4 : hover ? -2 : 0;
  const boxShadow = disabled ? "none" : press ? p.down : p.rest;
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    disabled: disabled,
    style: {
      display: block ? "flex" : "inline-flex",
      width: block ? "100%" : "auto",
      alignItems: "center",
      justifyContent: "center",
      gap: sz.gap,
      fontFamily: "var(--font-body)",
      fontWeight: 700,
      fontSize: sz.fontSize,
      lineHeight: 1,
      letterSpacing: ".01em",
      padding: sz.padding,
      borderRadius: sz.radius,
      border: p.border || "none",
      cursor: disabled ? "not-allowed" : "pointer",
      color: p.color,
      background: p.bg,
      boxShadow,
      opacity: disabled ? 0.5 : 1,
      transform: p.flat ? hover && !disabled ? "scale(1.04)" : "scale(1)" : `translateY(${lift}px)`,
      transition: "transform .14s var(--ease-spring), box-shadow .14s var(--ease-out), background .2s",
      WebkitTapHighlightColor: "transparent",
      ...(variant === "ghost" && hover && !disabled ? {
        background: "var(--coral-50)"
      } : {}),
      ...style
    }
  }, rest), icon, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * 薯包AI Card — soft clay-raised surface with optional hover-lift
 * and a gradient header band (for Xiaohongshu-style note covers).
 * variant: plain | raised | gradient
 */
function Card({
  children,
  variant = "raised",
  hover = false,
  gradient = "var(--grad-brand)",
  header = null,
  headerHeight = 150,
  pad = 20,
  onClick,
  style = {},
  ...rest
}) {
  const [h, setH] = useState(false);
  const base = {
    position: "relative",
    background: "var(--surface-card)",
    borderRadius: "var(--r-lg)",
    border: "var(--bw) solid var(--border-soft)",
    overflow: "hidden",
    transition: "transform .28s var(--ease-spring), box-shadow .28s var(--ease-out)",
    cursor: hover || onClick ? "pointer" : "default"
  };
  const shadows = {
    plain: "var(--sh-sm)",
    raised: "var(--clay-raised)",
    gradient: "var(--sh-md)"
  };
  const lift = (hover || onClick) && h;
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      ...base,
      boxShadow: lift ? "var(--sh-lg)" : shadows[variant] || shadows.raised,
      transform: lift ? "translateY(-6px)" : "translateY(0)",
      ...style
    }
  }, rest), header !== null && /*#__PURE__*/React.createElement("div", {
    style: {
      height: headerHeight,
      background: gradient,
      position: "relative",
      display: "flex",
      alignItems: "flex-end",
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(transparent 45%, rgba(0,0,0,.42))"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--gloss)",
      opacity: .6,
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1
    }
  }, header)), children != null && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: pad
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Mascot.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * 薯包AI Mascot — renders the brand potato-bag character illustration
 * with a soft drop-shadow and optional idle animation.
 *
 * Provide an explicit `src`, OR a `pose` name + `base` directory.
 * Pose names map to files like `assets/mascot-<pose>.webp`.
 */
const POSES = ["wave", "jump", "superhero", "welcome", "empty", "ready", "walk", "sit", "writing", "meditate", "surf", "analyze", "upgrade", "lookup", "done", "crash", "approve", "photographer", "inspect", "lift", "curator", "cook", "sleep", "paint", "dance", "error"];
function Mascot({
  src,
  pose = "wave",
  base = "assets",
  size = 120,
  anim = "float",
  glow = true,
  alt = "小薯包",
  style = {},
  ...rest
}) {
  const url = src || `${base}/mascot-${pose}.webp`;
  const animations = {
    float: "sb-float 3s ease-in-out infinite",
    bob: "sb-bob 2.4s ease-in-out infinite",
    twinkle: "sb-wobble 2.6s ease-in-out infinite",
    none: "none"
  };
  return /*#__PURE__*/React.createElement("img", _extends({
    src: url,
    alt: alt,
    loading: "lazy",
    decoding: "async",
    style: {
      width: size,
      height: "auto",
      display: "block",
      objectFit: "contain",
      filter: glow ? "drop-shadow(0 10px 22px rgba(255,71,87,.22))" : "none",
      animation: animations[anim] || animations.float,
      ...style
    }
  }, rest));
}
Mascot.POSES = POSES;
Object.assign(__ds_scope, { Mascot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Mascot.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * 薯包AI Tag — Xiaohongshu-style #hashtag chip.
 * Clickable; subtle coral tint with springy hover.
 */
function Tag({
  children,
  onClick,
  active = false,
  style = {},
  ...rest
}) {
  const [h, setH] = useState(false);
  const label = typeof children === "string" && !children.startsWith("#") ? "#" + children : children;
  return /*#__PURE__*/React.createElement("span", _extends({
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      fontFamily: "var(--font-body)",
      fontSize: "var(--fs-sm)",
      fontWeight: 500,
      lineHeight: 1,
      padding: "6px 13px",
      borderRadius: "var(--r-pill)",
      color: active ? "#fff" : "var(--coral-600)",
      background: active ? "var(--grad-coral)" : h ? "var(--coral-100)" : "var(--coral-50)",
      cursor: onClick ? "pointer" : "default",
      transform: h && onClick ? "translateY(-2px)" : "none",
      boxShadow: active ? "0 4px 12px rgba(255,71,87,.28)" : "none",
      transition: "transform .15s var(--ease-spring), background .18s",
      ...style
    }
  }, rest), label);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * 薯包AI Input — clay-inset field. Renders <input> or <textarea>.
 * Coral focus ring + lift.
 */
function Input({
  as = "input",
  value,
  onChange,
  placeholder = "",
  label = null,
  icon = null,
  rows = 4,
  disabled = false,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  const Tag = as === "textarea" ? "textarea" : "input";
  const field = /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: as === "textarea" ? "flex-start" : "center",
      gap: 10,
      background: "var(--surface-card)",
      borderRadius: "var(--r-md)",
      border: `var(--bw) solid ${focus ? "var(--coral-400)" : "var(--border-soft)"}`,
      boxShadow: focus ? "var(--ring-brand)" : "var(--clay-inset)",
      padding: as === "textarea" ? "14px 16px" : "0 16px",
      transition: "border-color .18s, box-shadow .2s",
      opacity: disabled ? 0.6 : 1
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      color: focus ? "var(--coral-500)" : "var(--text-faint)",
      display: "flex",
      marginTop: as === "textarea" ? 2 : 0
    }
  }, icon), /*#__PURE__*/React.createElement(Tag, _extends({
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    rows: as === "textarea" ? rows : undefined,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-body)",
      fontSize: "var(--fs-body)",
      lineHeight: as === "textarea" ? 1.75 : 1,
      color: "var(--text-strong)",
      resize: as === "textarea" ? "vertical" : "none",
      padding: as === "textarea" ? 0 : "13px 0",
      ...style
    }
  }, rest)));
  if (!label) return field;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: "var(--fs-sm)",
      fontWeight: 700,
      color: "var(--text-body)",
      marginBottom: 8
    }
  }, label), field);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * 薯包AI Switch — pill toggle with springy knob and coral gradient track.
 */
function Switch({
  checked = false,
  onChange,
  disabled = false,
  size = "md",
  style = {},
  ...rest
}) {
  const dims = size === "sm" ? {
    w: 40,
    h: 24,
    k: 18
  } : {
    w: 52,
    h: 30,
    k: 24
  };
  const pad = (dims.h - dims.k) / 2;
  return /*#__PURE__*/React.createElement("button", _extends({
    role: "switch",
    "aria-checked": checked,
    disabled: disabled,
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: dims.w,
      height: dims.h,
      borderRadius: "var(--r-pill)",
      border: "none",
      padding: 0,
      position: "relative",
      cursor: disabled ? "not-allowed" : "pointer",
      background: checked ? "var(--grad-coral)" : "var(--ink-200)",
      boxShadow: checked ? "inset 0 1px 3px rgba(200,30,55,.3), 0 4px 10px rgba(255,71,87,.3)" : "var(--clay-inset)",
      opacity: disabled ? 0.5 : 1,
      transition: "background .25s var(--ease-out)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: pad,
      left: checked ? dims.w - dims.k - pad : pad,
      width: dims.k,
      height: dims.k,
      borderRadius: "var(--r-pill)",
      background: "#fff",
      boxShadow: "0 2px 6px rgba(120,40,50,.3)",
      transition: "left .26s var(--ease-spring)"
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/GalleryScreen.jsx
try { (() => {
/* 薯包AI · Gallery grid (薯包出品) */
(function () {
  function GalleryScreen({
    onOpenNote,
    onRemix
  }) {
    const D = window.SB_DATA;
    const NoteCard = window.NoteCard;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 1000,
        margin: "0 auto",
        padding: "40px 20px 64px"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 36,
        textAlign: "center",
        margin: "0 0 6px",
        color: "var(--text-strong)"
      }
    }, "\u85AF\u5305\u51FA\u54C1 ", /*#__PURE__*/React.createElement("span", {
      className: "sb-grad-text"
    }, "\uD83D\uDD25")), /*#__PURE__*/React.createElement("p", {
      style: {
        textAlign: "center",
        color: "var(--text-muted)",
        margin: "0 0 32px",
        fontSize: 15
      }
    }, "\u5168\u90E8\u7531\u85AF\u5305 AI \u4E00\u952E\u751F\u6210 \xB7 \u70B9\u300C\u67E5\u770B\u5168\u5957\u300D\u770B\u5B8C\u6574\u56FE\u6587\uFF0C\u6216\u300C\u4E00\u952E\u540C\u6B3E\u300D\u7ACB\u523B\u751F\u6210\u4F60\u7684\u7248\u672C"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: 16
      }
    }, D.gallery.map(g => /*#__PURE__*/React.createElement(NoteCard, {
      key: g.id,
      item: g,
      onClick: () => onOpenNote(g),
      onRemix: it => onRemix(it)
    }))));
  }
  window.GalleryScreen = GalleryScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/GalleryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/HomeScreen.jsx
try { (() => {
/* 薯包AI · Home — hero, generator, features, gallery teaser */
(function () {
  const {
    Button,
    Card,
    Badge,
    Tag,
    Mascot
  } = window.AIDesignSystem_67568f;
  const {
    Sparkles,
    Hash,
    Target,
    Zap,
    Layers,
    Refresh,
    Wand,
    Eye,
    Heart,
    ChevronRight
  } = window;
  const {
    useState,
    useEffect
  } = React;
  const FEATURES = [{
    Icon: Target,
    title: "智能识别赛道",
    desc: "粘贴任意素材，AI 自动判断旅游、美食、好物等最佳内容策略，无需手动选择",
    tone: "coral"
  }, {
    Icon: Zap,
    title: "爆款公式驱动",
    desc: "内置数字结果式、反差痛点式等经过验证的爆款标题和正文公式",
    tone: "sun"
  }, {
    Icon: Layers,
    title: "9 张完整配图",
    desc: "1 张封面 + 8 张内容页，带拼图排版和文字标注，下载即可发布",
    tone: "sprout"
  }, {
    Icon: Refresh,
    title: "单张可重生成",
    desc: "对某张图不满意？单独刷新这一张，不浪费整套额度",
    tone: "grape"
  }, {
    Icon: Wand,
    title: "一键复制文案",
    desc: "标题、正文、标签分别复制或一键全部复制，打开小红书直接粘贴",
    tone: "coral"
  }, {
    Icon: Sparkles,
    title: "按套计费不套路",
    desc: "用多少买多少，不搞自动续费，新用户免费体验 1 套",
    tone: "sun"
  }];
  const TONE = {
    coral: ["var(--grad-coral)", "rgba(255,71,87,.3)"],
    sun: ["var(--grad-sunset)", "rgba(255,160,0,.32)"],
    sprout: ["var(--grad-sprout)", "rgba(92,201,122,.3)"],
    grape: ["var(--grad-grape)", "rgba(139,92,246,.3)"]
  };
  function FeatureCard({
    f
  }) {
    const [h, setH] = useState(false);
    const [g, gShadow] = TONE[f.tone];
    return /*#__PURE__*/React.createElement("div", {
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        background: "var(--surface-card)",
        borderRadius: "var(--r-lg)",
        border: "1.5px solid var(--border-soft)",
        padding: 22,
        boxShadow: h ? "var(--sh-lg)" : "var(--clay-raised)",
        transform: h ? "translateY(-6px)" : "none",
        transition: "transform .28s var(--ease-spring), box-shadow .28s"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 48,
        height: 48,
        borderRadius: "var(--r-md)",
        background: g,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        marginBottom: 14,
        boxShadow: `0 8px 18px ${gShadow}`,
        transform: h ? "rotate(-6deg) scale(1.08)" : "none",
        transition: "transform .3s var(--ease-spring)"
      }
    }, /*#__PURE__*/React.createElement(f.Icon, {
      size: 24
    })), /*#__PURE__*/React.createElement("h3", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 18,
        margin: "0 0 6px",
        color: "var(--text-strong)"
      }
    }, f.title), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13.5,
        lineHeight: 1.7,
        color: "var(--text-muted)"
      }
    }, f.desc));
  }
  function HomeScreen({
    onGenerate,
    onOpenNote
  }) {
    const [text, setText] = useState("");
    const [focus, setFocus] = useState(false);
    const [hint, setHint] = useState(0);
    const D = window.SB_DATA;
    useEffect(() => {
      const t = setInterval(() => setHint(i => (i + 1) % D.hints.length), 2600);
      return () => clearInterval(t);
    }, []);
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("section", {
      style: {
        position: "relative",
        overflow: "hidden",
        background: "var(--grad-spotlight)",
        padding: "44px 20px 36px"
      }
    }, [["8%", "18%", 22, "0s"], ["88%", "26%", 16, ".6s"], ["16%", "70%", 14, "1.1s"], ["82%", "66%", 20, ".3s"]].map(([l, t, s, d], i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        position: "absolute",
        left: l,
        top: t,
        fontSize: s,
        color: "var(--sun-400)",
        animation: `sb-twinkle 2.4s ${d} ease-in-out infinite`
      }
    }, "\u2726")), /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 720,
        margin: "0 auto",
        textAlign: "center",
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "coral",
      variant: "solid",
      icon: /*#__PURE__*/React.createElement(Sparkles, {
        size: 12
      })
    }, "\u5C0F\u7EA2\u4E66\u7206\u6B3E \xB7 \u4E00\u952E\u751F\u6210")), /*#__PURE__*/React.createElement(Mascot, {
      src: "../../assets/mascot-wave.webp",
      size: 120,
      anim: "float",
      style: {
        margin: "10px auto 6px"
      }
    }), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(30px,5vw,50px)",
        lineHeight: 1.18,
        color: "var(--text-strong)",
        margin: "0 0 12px"
      }
    }, "\u4E00\u53E5\u8BDD\u4E3B\u9898\uFF0C", /*#__PURE__*/React.createElement("span", {
      className: "sb-grad-text"
    }, "\u79D2\u51FA\u7206\u6B3E\u56FE\u6587")), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 16,
        color: "var(--text-muted)",
        maxWidth: 520,
        margin: "0 auto 26px",
        lineHeight: 1.7
      }
    }, "\u8F93\u5165\u4EFB\u610F\u4E3B\u9898\u6216\u7D20\u6750\uFF0C\u85AF\u5305 AI \u81EA\u52A8\u8BC6\u522B\u8D5B\u9053\uFF0C\u751F\u6210\u7206\u6B3E\u6807\u9898 + \u79CD\u8349\u6587\u6848 + 9 \u5F20\u7CBE\u7F8E\u914D\u56FE"), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface-card)",
        borderRadius: "var(--r-xl)",
        padding: 22,
        boxShadow: "var(--sh-xl)",
        border: "1.5px solid var(--coral-100)",
        textAlign: "left",
        maxWidth: 600,
        margin: "0 auto"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        borderRadius: "var(--r-lg)",
        border: `2px solid ${focus ? "var(--coral-400)" : "var(--border-soft)"}`,
        boxShadow: focus ? "var(--ring-brand)" : "var(--clay-inset)",
        transition: "all .2s",
        background: "#fff",
        padding: "14px 16px"
      }
    }, /*#__PURE__*/React.createElement("textarea", {
      value: text,
      onChange: e => setText(e.target.value),
      onFocus: () => setFocus(true),
      onBlur: () => setFocus(false),
      placeholder: "输入你想创作的主题，一句话就够了\n例如：云南3天2夜旅游攻略、百元蓝牙耳机测评…",
      style: {
        width: "100%",
        minHeight: 96,
        border: "none",
        outline: "none",
        resize: "vertical",
        fontFamily: "var(--font-body)",
        fontSize: 15,
        lineHeight: 1.75,
        color: "var(--text-strong)",
        background: "transparent"
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "12px 2px",
        color: "var(--text-faint)",
        fontSize: 12
      }
    }, /*#__PURE__*/React.createElement(Hash, {
      size: 13,
      color: "var(--coral-400)"
    }), /*#__PURE__*/React.createElement("span", null, "\u8BD5\u8BD5\u70ED\u95E8\u4E3B\u9898\uFF1A"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setText(D.hints[hint]),
      style: {
        border: "none",
        background: "var(--coral-50)",
        color: "var(--coral-600)",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: 12.5,
        padding: "5px 12px",
        borderRadius: "var(--r-pill)",
        cursor: "pointer",
        transition: "all .25s var(--ease-out)"
      }
    }, D.hints[hint], " \u21B5")), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      disabled: !text.trim(),
      icon: /*#__PURE__*/React.createElement(Sparkles, {
        size: 20
      }),
      onClick: () => onGenerate(text)
    }, "\u4E00\u952E\u751F\u6210\u7206\u6B3E\u56FE\u6587"), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        marginTop: 10,
        fontSize: 11.5,
        color: "var(--text-faint)"
      }
    }, "\u65B0\u7528\u6237\u514D\u8D39\u4F53\u9A8C 1 \u5957 \xB7 \u65E0\u9700\u4FE1\u7528\u5361")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        gap: 28,
        marginTop: 26,
        flexWrap: "wrap"
      }
    }, [["12 万+", "篇图文生成"], ["98%", "用户好评"], ["15 秒", "平均出稿"]].map(([n, l]) => /*#__PURE__*/React.createElement("div", {
      key: l,
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-num)",
        fontWeight: 700,
        fontSize: 26,
        color: "var(--coral-500)"
      }
    }, n), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, l)))))), /*#__PURE__*/React.createElement("section", {
      style: {
        maxWidth: 1000,
        margin: "0 auto",
        padding: "44px 20px 16px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 22
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 30,
        margin: "0 0 4px",
        color: "var(--text-strong)"
      }
    }, "\u85AF\u5305\u51FA\u54C1 \uD83D\uDD25 \u770B\u770B\u751F\u6210\u6548\u679C"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        color: "var(--text-muted)",
        fontSize: 14
      }
    }, "\u4E0B\u9762\u90FD\u662F\u85AF\u5305 AI \u4E00\u952E\u751F\u6210\u7684 \xB7 \u70B9\u300C\u4E00\u952E\u540C\u6B3E\u300D\u7ACB\u523B\u505A\u4F60\u7684\u4E13\u5C5E\u7248\u672C")), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      iconRight: /*#__PURE__*/React.createElement(ChevronRight, {
        size: 16
      }),
      onClick: () => onOpenNote(null)
    }, "\u67E5\u770B\u5168\u90E8")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: 14
      }
    }, D.gallery.slice(0, 4).map(g => /*#__PURE__*/React.createElement(NoteCard, {
      key: g.id,
      item: g,
      onClick: () => onOpenNote(g),
      onRemix: it => onGenerate(it.title)
    })))), /*#__PURE__*/React.createElement("section", {
      style: {
        maxWidth: 1000,
        margin: "0 auto",
        padding: "40px 20px 64px"
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        textAlign: "center",
        fontFamily: "var(--font-display)",
        fontSize: 32,
        margin: "0 0 6px",
        color: "var(--text-strong)"
      }
    }, "\u4E3A\u4EC0\u4E48\u9009\u85AF\u5305 AI"), /*#__PURE__*/React.createElement("p", {
      style: {
        textAlign: "center",
        color: "var(--text-muted)",
        margin: "0 0 32px",
        fontSize: 15
      }
    }, "\u628A\u5C0F\u7EA2\u4E66\u7206\u6B3E\u65B9\u6CD5\u8BBA\uFF0C\u88C5\u8FDB\u4E00\u4E2A\u4F1A\u5356\u840C\u7684\u5C0F\u85AF\u5305"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gap: 16
      }
    }, FEATURES.map((f, i) => /*#__PURE__*/React.createElement(FeatureCard, {
      key: i,
      f: f
    })))));
  }

  /* Shared note card (used here + gallery) */
  function NoteCard({
    item,
    onClick,
    onRemix
  }) {
    const {
      Card,
      Badge
    } = window.AIDesignSystem_67568f;
    const {
      Heart,
      Eye,
      Sparkles
    } = window;
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement(Card, {
      hover: true,
      onClick: onClick,
      pad: 0,
      variant: "raised"
    }, /*#__PURE__*/React.createElement("div", {
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        background: item.grad,
        height: 150,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: "var(--gloss)",
        opacity: .5
      }
    }), /*#__PURE__*/React.createElement("img", {
      src: `../../assets/${item.cover}.webp`,
      alt: "",
      loading: "lazy",
      decoding: "async",
      style: {
        height: 110,
        objectFit: "contain",
        filter: "drop-shadow(0 6px 14px rgba(0,0,0,.18))",
        transform: h ? "scale(1.08) rotate(-3deg)" : "none",
        transition: "transform .35s var(--ease-spring)"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 10,
        left: 10
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral",
      variant: "solid",
      style: {
        background: "rgba(255,255,255,.28)",
        backdropFilter: "blur(4px)",
        color: "#fff"
      }
    }, item.cat)), h && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,.28)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        animation: "sb-pop-in .2s"
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: e => {
        e.stopPropagation();
        onClick && onClick();
      },
      style: {
        background: "#fff",
        color: "var(--coral-600)",
        fontSize: 12.5,
        fontWeight: 700,
        padding: "7px 16px",
        borderRadius: "var(--r-pill)",
        display: "flex",
        alignItems: "center",
        gap: 5,
        boxShadow: "var(--sh-md)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(Eye, {
      size: 14
    }), "\u67E5\u770B\u5168\u5957"), /*#__PURE__*/React.createElement("span", {
      onClick: e => {
        e.stopPropagation();
        onRemix && onRemix(item);
      },
      style: {
        background: "var(--grad-coral)",
        color: "#fff",
        fontSize: 12.5,
        fontWeight: 700,
        padding: "7px 16px",
        borderRadius: "var(--r-pill)",
        display: "flex",
        alignItems: "center",
        gap: 5,
        boxShadow: "var(--glow-coral)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(Sparkles, {
      size: 14
    }), "\u4E00\u952E\u540C\u6B3E"))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "12px 14px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        lineHeight: 1.5,
        color: "var(--text-strong)",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        minHeight: 40
      }
    }, item.title), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: "var(--like)",
        display: "flex",
        alignItems: "center",
        gap: 3,
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement(Heart, {
      size: 11,
      fill: "var(--like)"
    }), item.likes), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)"
      }
    }, "\u85AF\u5305AI \u51FA\u54C1"))));
  }
  window.HomeScreen = HomeScreen;
  window.NoteCard = NoteCard;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Nav.jsx
try { (() => {
/* 薯包AI · top navigation bar */
(function () {
  const {
    Button,
    Badge
  } = window.AIDesignSystem_67568f;
  function Nav({
    page,
    setPage,
    logged,
    setLogged,
    pts,
    onLogin
  }) {
    const links = [["home", "首页"], ["gallery", "薯包出品"], ["pricing", "价格方案"], ["works", "我的作品"]];
    return /*#__PURE__*/React.createElement("nav", {
      style: {
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 28px",
        background: "rgba(255,250,249,.82)",
        backdropFilter: "blur(16px)",
        borderBottom: "1.5px solid var(--coral-100)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 26
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        cursor: "pointer"
      },
      onClick: () => setPage("home")
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo-icon.webp",
      alt: "\u85AF\u5305AI",
      style: {
        width: 36,
        height: 36,
        borderRadius: 11,
        boxShadow: "var(--sh-sm)"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 22,
        color: "var(--coral-500)",
        whiteSpace: "nowrap"
      }
    }, "\u85AF\u5305AI")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 2
      }
    }, links.map(([k, v]) => /*#__PURE__*/React.createElement("button", {
      key: k,
      onClick: () => setPage(k),
      style: {
        fontFamily: "var(--font-body)",
        fontSize: 14,
        fontWeight: page === k ? 700 : 500,
        color: page === k ? "var(--coral-600)" : "var(--text-muted)",
        background: page === k ? "var(--coral-50)" : "transparent",
        border: "none",
        padding: "8px 15px",
        cursor: "pointer",
        borderRadius: "var(--r-pill)",
        transition: "all .15s"
      }
    }, v)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, logged && /*#__PURE__*/React.createElement(Badge, {
      tone: "coral",
      icon: /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11
        }
      }, "\u2726")
    }, pts, " \u5957"), logged ? /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      onClick: () => setLogged(false)
    }, "\u5DF2\u767B\u5F55") : /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "sm",
      onClick: onLogin
    }, "\u767B\u5F55")));
  }
  window.Nav = Nav;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Nav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/PricingScreen.jsx
try { (() => {
/* 薯包AI · Pricing plans */
(function () {
  const {
    Button,
    Badge,
    Mascot
  } = window.AIDesignSystem_67568f;
  const {
    Sparkles,
    Check
  } = window;
  const {
    useState
  } = React;
  function PlanCard({
    p,
    onBuy
  }) {
    const [h, setH] = useState(false);
    return /*#__PURE__*/React.createElement("div", {
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        position: "relative",
        background: p.pop ? "var(--surface-card)" : "var(--surface-card)",
        borderRadius: "var(--r-xl)",
        padding: "26px 20px",
        textAlign: "center",
        border: p.pop ? "2.5px solid var(--coral-400)" : "1.5px solid var(--border-soft)",
        boxShadow: h ? "var(--sh-xl)" : p.pop ? "var(--glow-coral)" : "var(--clay-raised)",
        transform: h ? "translateY(-8px)" : p.pop ? "translateY(-6px)" : "none",
        transition: "transform .3s var(--ease-spring), box-shadow .3s"
      }
    }, p.pop && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: -13,
        left: "50%",
        transform: "translateX(-50%)"
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "coral",
      variant: "solid",
      icon: /*#__PURE__*/React.createElement(Sparkles, {
        size: 11
      })
    }, "\u6700\u53D7\u6B22\u8FCE")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 22,
        color: "var(--text-strong)",
        marginBottom: 4
      }
    }, p.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-muted)",
        marginBottom: 16
      }
    }, p.desc), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "center",
        gap: 2,
        marginBottom: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-num)",
        fontWeight: 700,
        fontSize: 18,
        color: "var(--coral-500)"
      }
    }, "\xA5"), /*#__PURE__*/React.createElement("span", {
      className: "sb-grad-text",
      style: {
        fontFamily: "var(--font-num)",
        fontWeight: 700,
        fontSize: 46
      }
    }, p.price)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        marginBottom: 18
      }
    }, p.sets, " \u5957\u56FE\u6587 \xB7 \u7EA6 \xA5", p.per, "/\u5957"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 9,
        textAlign: "left",
        marginBottom: 20,
        fontSize: 13
      }
    }, [`${p.sets} 套完整图文（含 9 张配图）`, `单张重生成 ${p.regen} 次/套`, "标题 + 正文 + 标签全包", "一次性购买，不自动续费"].map((t, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        gap: 8,
        alignItems: "center",
        color: "var(--text-body)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "var(--sprout-100)",
        color: "var(--sprout-600)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto"
      }
    }, /*#__PURE__*/React.createElement(Check, {
      size: 11
    })), t))), /*#__PURE__*/React.createElement(Button, {
      variant: p.pop ? "primary" : "secondary",
      block: true,
      onClick: () => onBuy(p)
    }, p.pop ? "立即购买" : "选择套餐"));
  }
  function PricingScreen({
    onBuy
  }) {
    const D = window.SB_DATA;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 1040,
        margin: "0 auto",
        padding: "40px 20px 64px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement(Mascot, {
      src: "../../assets/mascot-upgrade.webp",
      size: 96,
      anim: "bob",
      style: {
        margin: "0 auto"
      }
    })), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 36,
        textAlign: "center",
        margin: "0 0 6px",
        color: "var(--text-strong)"
      }
    }, "\u4EF7\u683C\u65B9\u6848"), /*#__PURE__*/React.createElement("p", {
      style: {
        textAlign: "center",
        color: "var(--text-muted)",
        margin: "0 0 34px",
        fontSize: 15
      }
    }, "\u6309\u5957\u6536\u8D39\uFF0C\u4E0D\u641E\u81EA\u52A8\u7EED\u8D39 \xB7 \u6BCF\u5957\u5305\u542B\u5B8C\u6574\u6807\u9898 + \u6B63\u6587 + \u6807\u7B7E + 9 \u5F20\u914D\u56FE"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: 16,
        alignItems: "start"
      }
    }, D.pricing.map((p, i) => /*#__PURE__*/React.createElement(PlanCard, {
      key: i,
      p: p,
      onBuy: onBuy
    }))), /*#__PURE__*/React.createElement("p", {
      style: {
        textAlign: "center",
        marginTop: 26,
        fontSize: 12.5,
        color: "var(--text-faint)"
      }
    }, "\u6240\u6709\u5957\u9910\u5747\u4E3A\u4E00\u6B21\u6027\u8D2D\u4E70 \xB7 \u4E0D\u81EA\u52A8\u7EED\u8D39 \xB7 \u4E0D\u9650\u4F7F\u7528\u65F6\u95F4"));
  }
  window.PricingScreen = PricingScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/PricingScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/ResultScreen.jsx
try { (() => {
/* 薯包AI · Loading + Result (Xiaohongshu note) screens */
(function () {
  const {
    Button,
    Badge,
    Tag,
    Avatar
  } = window.AIDesignSystem_67568f;
  const {
    Sparkles,
    Copy,
    Check,
    Heart,
    Share,
    Bookmark,
    MessageCircle,
    ArrowLeft,
    Download,
    Refresh,
    Zap
  } = window;
  const {
    useState,
    useEffect
  } = React;

  /* ---------- LOADING ---------- */
  function LoadingScreen({
    stage
  }) {
    const D = window.SB_DATA;
    const [tip, setTip] = useState(0);
    useEffect(() => {
      const t = setInterval(() => setTip(i => (i + 1) % D.tips.length), 2600);
      return () => clearInterval(t);
    }, []);
    const st = D.stages[stage] || D.stages[0];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 440,
        margin: "0 auto",
        padding: "54px 20px",
        textAlign: "center",
        animation: "sb-pop-in .3s"
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: `../../assets/mascot-${st.pose}.webp`,
      alt: st.label,
      style: {
        height: 168,
        animation: "sb-float 2s ease-in-out infinite",
        filter: "drop-shadow(0 12px 26px rgba(255,71,87,.2))"
      }
    }), /*#__PURE__*/React.createElement("h2", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 26,
        margin: "16px 0 6px",
        color: "var(--text-strong)"
      }
    }, st.label), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14.5,
        color: "var(--text-muted)",
        margin: "0 0 26px"
      }
    }, st.desc), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 5,
        marginBottom: 24,
        padding: "0 24px"
      }
    }, D.stages.map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        height: 6,
        borderRadius: 99,
        background: i <= stage ? "var(--grad-coral)" : "var(--ink-200)",
        transition: "background .5s"
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--coral-50)",
        borderRadius: "var(--r-md)",
        padding: "11px 16px",
        marginBottom: 18,
        fontSize: 12.5,
        color: "var(--coral-700)",
        display: "flex",
        gap: 7,
        alignItems: "center",
        justifyContent: "center"
      }
    }, "\u23F3 \u751F\u6210\u4E2D\u8BF7\u52FF\u5237\u65B0\u9875\u9762\uFF0C\u5426\u5219\u4F1A\u6D6A\u8D39 1 \u5957\u989D\u5EA6"), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface-card)",
        borderRadius: "var(--r-md)",
        padding: "14px 18px",
        boxShadow: "var(--clay-raised)",
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--text-faint)",
        marginBottom: 5,
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement(Zap, {
      size: 12,
      color: "var(--sun-500)"
    }), "\u5C0F\u7EA2\u4E66\u51B7\u77E5\u8BC6"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        color: "var(--text-body)",
        lineHeight: 1.7,
        minHeight: 36
      }
    }, D.tips[tip])));
  }

  /* ---------- RESULT / NOTE ---------- */
  function CopyBtn({
    text,
    label
  }) {
    const [ok, setOk] = useState(false);
    return /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1400);
      },
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: 12,
        padding: "6px 12px",
        borderRadius: "var(--r-pill)",
        background: ok ? "var(--sprout-50)" : "var(--coral-50)",
        color: ok ? "var(--sprout-600)" : "var(--coral-600)",
        transition: "all .15s"
      }
    }, ok ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Check, {
      size: 12
    }), "\u5DF2\u590D\u5236") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Copy, {
      size: 12
    }), label));
  }
  function ResultScreen({
    item,
    onBack,
    onRemix
  }) {
    const imgs = [item.cover, "mascot-jump", "mascot-paint", "mascot-cook"];
    const [idx, setIdx] = useState(0);
    const body = item.body || "";
    const tagStr = (item.tags || []).map(t => "#" + t).join(" ");
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 940,
        margin: "0 auto",
        padding: "20px 20px 64px",
        animation: "sb-pop-in .3s"
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      icon: /*#__PURE__*/React.createElement(ArrowLeft, {
        size: 15
      }),
      onClick: onBack,
      style: {
        marginBottom: 14
      }
    }, "\u8FD4\u56DE"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 22,
        alignItems: "flex-start",
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "1 1 320px",
        maxWidth: 380
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        background: item.grad,
        aspectRatio: "3/4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "var(--sh-lg)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: "var(--gloss)",
        opacity: .5
      }
    }), /*#__PURE__*/React.createElement("img", {
      src: `../../assets/${imgs[idx]}.webp`,
      alt: "",
      style: {
        width: "72%",
        objectFit: "contain",
        filter: "drop-shadow(0 10px 22px rgba(0,0,0,.2))"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        right: 10,
        bottom: 10,
        background: "rgba(0,0,0,.45)",
        backdropFilter: "blur(4px)",
        borderRadius: "var(--r-sm)",
        padding: "3px 9px",
        color: "#fff",
        fontSize: 11,
        fontFamily: "var(--font-num)"
      }
    }, idx + 1, "/", imgs.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 7,
        marginTop: 10
      }
    }, imgs.map((im, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => setIdx(i),
      style: {
        width: 52,
        height: 68,
        borderRadius: "var(--r-sm)",
        overflow: "hidden",
        background: item.grad,
        cursor: "pointer",
        border: i === idx ? "2.5px solid var(--coral-400)" : "2.5px solid transparent",
        opacity: i === idx ? 1 : .55,
        transition: "all .15s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: `../../assets/${im}.webp`,
      alt: "",
      style: {
        width: "76%",
        objectFit: "contain"
      }
    })))), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      block: true,
      icon: /*#__PURE__*/React.createElement(Refresh, {
        size: 13
      }),
      style: {
        marginTop: 10
      }
    }, "\u91CD\u65B0\u751F\u6210\u8FD9\u5F20")), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: "1 1 360px",
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      src: "../../assets/logo-icon.webp",
      name: "\u85AF\u5305",
      size: 40,
      ring: true
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, "\u85AF\u5305 AI"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "var(--text-faint)"
      }
    }, "AI \u521B\u4F5C \xB7 \u5373\u523B\u53D1\u5E03")), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "coral"
    }, item.cat))), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 22,
        lineHeight: 1.4,
        color: "var(--coral-600)",
        margin: "0 0 12px"
      }
    }, item.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        lineHeight: 2,
        color: "var(--text-body)",
        whiteSpace: "pre-wrap",
        marginBottom: 16
      }
    }, body), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 7,
        marginBottom: 18
      }
    }, (item.tags || []).map((t, i) => /*#__PURE__*/React.createElement(Tag, {
      key: i
    }, t))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 18,
        padding: "12px 0",
        borderTop: "1.5px solid var(--ink-100)",
        borderBottom: "1.5px solid var(--ink-100)",
        marginBottom: 16,
        color: "var(--text-muted)",
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement(Heart, {
      size: 18,
      color: "var(--like)",
      fill: "var(--like)"
    }), item.likes), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement(Bookmark, {
      size: 18
    }), "\u6536\u85CF"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement(MessageCircle, {
      size: 18
    }), "\u8BC4\u8BBA"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement(Share, {
      size: 18
    }), "\u5206\u4EAB")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement(CopyBtn, {
      text: item.title,
      label: "\u590D\u5236\u6807\u9898"
    }), /*#__PURE__*/React.createElement(CopyBtn, {
      text: tagStr,
      label: "\u590D\u5236\u6807\u7B7E"
    }), /*#__PURE__*/React.createElement(CopyBtn, {
      text: item.title + "\n\n" + body + "\n\n" + tagStr,
      label: "\u590D\u5236\u5168\u6587"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: /*#__PURE__*/React.createElement(Sparkles, {
        size: 16
      }),
      onClick: () => onRemix(item)
    }, "\u4E00\u952E\u540C\u6B3E"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: /*#__PURE__*/React.createElement(Download, {
        size: 15
      })
    }, "\u4E0B\u8F7D\u56FE\u7247")))));
  }
  window.LoadingScreen = LoadingScreen;
  window.ResultScreen = ResultScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/ResultScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/data.js
try { (() => {
/* 薯包AI · sample content for the UI kit (Xiaohongshu viral notes) */
window.SB_DATA = {
  gallery: [{
    id: 1,
    cat: "旅游攻略",
    tone: "sun",
    grad: "var(--grad-sunset)",
    title: "反向旅游🔥这5个小县城比大理舒服100倍",
    likes: 3852,
    cover: "mascot-surf",
    body: "谁懂啊！不去大理人挤人了，这5个小县城真的绝了\n📍 贵州黔东南·肇兴侗寨 人均300住3天\n📍 云南·芒市 东南亚风情满满的边境小城\n📍 福建·霞浦 摄影师天堂 日出美哭\n📍 浙江·松阳 最后的江南秘境\n📍 四川·西昌 邛海边的慢生活\n\n全部高铁可达周末就能出发\n物价感人100块吃一天不重样",
    tags: ["反向旅游", "小众旅行地", "小县城", "周末去哪儿", "旅行攻略"]
  }, {
    id: 2,
    cat: "好物评测",
    tone: "coral",
    grad: "var(--grad-coral)",
    title: "拼多多30元以下好物🧧这8件真的物超所值",
    likes: 2290,
    cover: "mascot-inspect",
    body: "PDD用了3年挖到的宝藏！全部30元以内\n🎯 手机支架 9.9元 追剧神器\n🎯 磁吸充电线 15元 再也不用插拔\n🎯 桌面收纳盒 12元 桌面瞬间整洁\n🎯 硅胶冰格 8元 夏天快乐水必备\n\n每个都亲自用过的不好用来骂我",
    tags: ["拼多多好物", "平价好物", "学生党", "省钱", "居家好物"]
  }, {
    id: 3,
    cat: "美食探店",
    tone: "sun",
    grad: "var(--grad-sunset)",
    title: "社区咖啡店探店☕藏在小区里的神仙小店",
    likes: 4523,
    cover: "mascot-cook",
    body: "小区楼下新开的咖啡店差点错过！\n☕ 招牌 Dirty 28元 一口惊艳\n🍰 巴斯克蛋糕 35元 不甜不腻刚刚好\n📸 每个角落都出片！胶片风装修\n📍 藏在老小区里导航到xx路再走3分钟",
    tags: ["咖啡探店", "社区咖啡", "小众咖啡馆", "上海美食", "周末去哪"]
  }, {
    id: 4,
    cat: "穿搭分享",
    tone: "grape",
    grad: "var(--grad-grape)",
    title: "Clean Fit穿搭法则👔基础款也能穿出高级感",
    likes: 5103,
    cover: "mascot-walk",
    body: "Clean Fit真的太适合普通人了！不用买大牌\n👕 上装：白T恤、条纹衫、衬衫选重磅面料\n👖 下装：直筒牛仔裤、卡其裤、阔腿西装裤\n👟 鞋子：德训鞋、帆布鞋、乐福鞋\n🎨 配色公式：黑白灰蓝卡其三色就够了",
    tags: ["CleanFit", "穿搭公式", "基础款", "极简穿搭", "优衣库穿搭"]
  }, {
    id: 5,
    cat: "数码3C",
    tone: "grape",
    grad: "var(--grad-grape)",
    title: "2025年最值得买的AI工具合集🤖打工人必备",
    likes: 3120,
    cover: "mascot-analyze",
    body: "用了半年AI工具这6个真的能提升效率\n🤖 写作翻译代码都强\n🎨 做设计太方便了\n📝 写周报会议纪要神器\n📊 做PPT只要5分钟\n\n每个我都深度用过的不是标题党",
    tags: ["AI工具", "效率神器", "打工人", "AIGC", "干货"]
  }, {
    id: 6,
    cat: "学习干货",
    tone: "grape",
    grad: "var(--grad-grape)",
    title: "考研英语85分｜我做了这5件事上岸985📚",
    likes: 6890,
    cover: "mascot-writing",
    body: "英语一85分！我的方法真的适合基础差的\n📌 单词：每天200个用艾宾浩斯记忆法\n📌 阅读：真题逐句分析\n📌 作文：整理5个万能模板+高级替换词\n📌 翻译：每天精翻2个长难句\n\n坚持4个月从四级飘到85分",
    tags: ["考研英语", "考研", "上岸", "985", "学习经验"]
  }, {
    id: 7,
    cat: "家居家装",
    tone: "sprout",
    grad: "var(--grad-sprout)",
    title: "300元爆改出租屋🛏️房东看了想涨房租",
    likes: 3421,
    cover: "mascot-paint",
    body: "月租800的老破小300块改造后不想出门了\n🛏️ 床头罩+靠枕 50元 遮丑效果绝了\n💡 日落灯+串灯 40元 氛围感拉满\n📦 收纳柜 80元 乱的东西全藏起来\n🪞 全身镜 60元 空间瞬间变大",
    tags: ["出租屋改造", "租房改造", "老破小改造", "独居", "氛围感"]
  }, {
    id: 8,
    cat: "健身减肥",
    tone: "sprout",
    grad: "var(--grad-sprout)",
    title: "居家普拉提30天变化🔥肚子小了腰围瘦了8cm",
    likes: 7340,
    cover: "mascot-lift",
    body: "坚持30天居家普拉提真的会谢！\n📌 Week1：每天10分钟基础核心训练\n📌 Week2：15分钟腹部+臀部专项\n📌 Week3：20分钟全身燃脂\n✅ 腰围从72到64cm\n✅ 体态肉眼可见变好",
    tags: ["普拉提", "居家健身", "瘦腰", "减肥", "体态矫正"]
  }],
  pricing: [{
    name: "入门",
    price: 18,
    sets: 6,
    regen: 3,
    desc: "适合偶尔创作",
    per: "3.0"
  }, {
    name: "进阶",
    price: 42,
    sets: 16,
    regen: 5,
    pop: true,
    desc: "个人博主首选",
    per: "2.6"
  }, {
    name: "创作者",
    price: 78,
    sets: 36,
    regen: 8,
    desc: "高频创作者",
    per: "2.2"
  }, {
    name: "工作室",
    price: 148,
    sets: 80,
    regen: "不限",
    desc: "团队批量使用",
    per: "1.85"
  }],
  hints: ["反向旅游5个小县城", "拼多多30元好物", "小区宝藏咖啡店", "Clean Fit基础穿搭", "2025AI工具合集", "考研英语85分方法", "300元出租屋改造", "精简护肤5样就够了"],
  tips: ["标题带数字的笔记，点击率平均高出 47%", "发布时间建议：周四 / 周五晚上 8-9 点", "正文前 3 行决定 80% 用户是否继续阅读", "每篇笔记建议 5-7 个精准标签", "封面配色统一度直接影响账号调性"],
  stages: [{
    pose: "analyze",
    label: "研读素材",
    desc: "小薯包正在认真分析你的内容…"
  }, {
    pose: "writing",
    label: "撰写文案",
    desc: "灵感爆发！正在打磨爆款文案"
  }, {
    pose: "paint",
    label: "生成配图",
    desc: "正在精心绘制 9 张图片"
  }, {
    pose: "inspect",
    label: "质量检查",
    desc: "最后检查一下，确保每张都完美"
  }, {
    pose: "done",
    label: "打包完成",
    desc: "搞定！你的爆款图文来啦"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/data.js", error: String((e && e.message) || e) }); }

// ui_kits/website/icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* 薯包AI · Lucide-style line icons (24px, 2px stroke).
   The brand uses Lucide (https://lucide.dev) for all UI glyphs.
   These inline copies keep the UI kit self-contained. */
const Ic = (paths, props = {}) => {
  const {
    size = 18,
    color = "currentColor",
    strokeWidth = 2,
    fill = "none",
    ...rest
  } = props;
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: fill,
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, rest), paths);
};
const Sparkles = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "M9.94 14.34 12 20l2.06-5.66L20 12l-5.94-2.34L12 4l-2.06 5.66L4 12z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M19 4v3"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5 17v2"
})), p);
const Copy = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
  x: "9",
  y: "9",
  width: "11",
  height: "11",
  rx: "2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5 15V5a2 2 0 0 1 2-2h10"
})), p);
const Check = p => Ic(/*#__PURE__*/React.createElement("path", {
  d: "M20 6 9 17l-5-5"
}), p);
const Heart = p => Ic(/*#__PURE__*/React.createElement("path", {
  d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"
}), p);
const Eye = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "3"
})), p);
const Download = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
}), /*#__PURE__*/React.createElement("path", {
  d: "m7 10 5 5 5-5"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 15V3"
})), p);
const Refresh = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "M3 12a9 9 0 0 1 15-6.7L21 8"
}), /*#__PURE__*/React.createElement("path", {
  d: "M21 3v5h-5"
}), /*#__PURE__*/React.createElement("path", {
  d: "M21 12a9 9 0 0 1-15 6.7L3 16"
}), /*#__PURE__*/React.createElement("path", {
  d: "M3 21v-5h5"
})), p);
const Hash = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "M4 9h16"
}), /*#__PURE__*/React.createElement("path", {
  d: "M4 15h16"
}), /*#__PURE__*/React.createElement("path", {
  d: "M10 3 8 21"
}), /*#__PURE__*/React.createElement("path", {
  d: "M16 3l-2 18"
})), p);
const LogIn = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
}), /*#__PURE__*/React.createElement("path", {
  d: "m10 17 5-5-5-5"
}), /*#__PURE__*/React.createElement("path", {
  d: "M15 12H3"
})), p);
const ArrowLeft = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "m12 19-7-7 7-7"
}), /*#__PURE__*/React.createElement("path", {
  d: "M19 12H5"
})), p);
const ArrowRight = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "M5 12h14"
}), /*#__PURE__*/React.createElement("path", {
  d: "m12 5 7 7-7 7"
})), p);
const Zap = p => Ic(/*#__PURE__*/React.createElement("path", {
  d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
}), p);
const ImageIcon = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "3",
  width: "18",
  height: "18",
  rx: "2"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "9",
  cy: "9",
  r: "2"
}), /*#__PURE__*/React.createElement("path", {
  d: "m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"
})), p);
const ChevronRight = p => Ic(/*#__PURE__*/React.createElement("path", {
  d: "m9 18 6-6-6-6"
}), p);
const Layers = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"
}), /*#__PURE__*/React.createElement("path", {
  d: "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"
}), /*#__PURE__*/React.createElement("path", {
  d: "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"
})), p);
const Target = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "10"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "6"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "2"
})), p);
const Wand = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
  d: "m3 21 9-9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M15 4V2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M15 16v-2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M8 9h2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M20 9h2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M17.8 11.8 19 13"
}), /*#__PURE__*/React.createElement("path", {
  d: "M15 9h.01"
}), /*#__PURE__*/React.createElement("path", {
  d: "M17.8 6.2 19 5"
}), /*#__PURE__*/React.createElement("path", {
  d: "m3 21 9-9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12.2 6.2 11 5"
})), p);
const Bookmark = p => Ic(/*#__PURE__*/React.createElement("path", {
  d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
}), p);
const Share = p => Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
  cx: "18",
  cy: "5",
  r: "3"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "6",
  cy: "12",
  r: "3"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "18",
  cy: "19",
  r: "3"
}), /*#__PURE__*/React.createElement("path", {
  d: "m8.59 13.51 6.83 3.98"
}), /*#__PURE__*/React.createElement("path", {
  d: "m15.41 6.51-6.82 3.98"
})), p);
const MessageCircle = p => Ic(/*#__PURE__*/React.createElement("path", {
  d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
}), p);
Object.assign(window, {
  Sparkles,
  Copy,
  Check,
  Heart,
  Eye,
  Download,
  Refresh,
  Hash,
  LogIn,
  ArrowLeft,
  ArrowRight,
  Zap,
  ImageIcon,
  ChevronRight,
  Layers,
  Target,
  Wand,
  Bookmark,
  Share,
  MessageCircle
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/icons.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Mascot = __ds_scope.Mascot;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Switch = __ds_scope.Switch;

})();

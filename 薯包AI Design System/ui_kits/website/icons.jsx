/* 薯包AI · Lucide-style line icons (24px, 2px stroke).
   The brand uses Lucide (https://lucide.dev) for all UI glyphs.
   These inline copies keep the UI kit self-contained. */
const Ic = (paths, props = {}) => {
  const { size = 18, color = "currentColor", strokeWidth = 2, fill = "none", ...rest } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths}
    </svg>
  );
};

const Sparkles = (p) => Ic(<><path d="M9.94 14.34 12 20l2.06-5.66L20 12l-5.94-2.34L12 4l-2.06 5.66L4 12z"/><path d="M19 4v3"/><path d="M5 17v2"/></>, p);
const Copy = (p) => Ic(<><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>, p);
const Check = (p) => Ic(<path d="M20 6 9 17l-5-5"/>, p);
const Heart = (p) => Ic(<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>, p);
const Eye = (p) => Ic(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>, p);
const Download = (p) => Ic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></>, p);
const Refresh = (p) => Ic(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>, p);
const Hash = (p) => Ic(<><path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/></>, p);
const LogIn = (p) => Ic(<><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></>, p);
const ArrowLeft = (p) => Ic(<><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></>, p);
const ArrowRight = (p) => Ic(<><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>, p);
const Zap = (p) => Ic(<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>, p);
const ImageIcon = (p) => Ic(<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></>, p);
const ChevronRight = (p) => Ic(<path d="m9 18 6-6-6-6"/>, p);
const Layers = (p) => Ic(<><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></>, p);
const Target = (p) => Ic(<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>, p);
const Wand = (p) => Ic(<><path d="m3 21 9-9"/><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></>, p);
const Bookmark = (p) => Ic(<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>, p);
const Share = (p) => Ic(<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></>, p);
const MessageCircle = (p) => Ic(<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>, p);

Object.assign(window, { Sparkles, Copy, Check, Heart, Eye, Download, Refresh, Hash, LogIn, ArrowLeft, ArrowRight, Zap, ImageIcon, ChevronRight, Layers, Target, Wand, Bookmark, Share, MessageCircle });

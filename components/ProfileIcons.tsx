// Иконки разделов профиля (как в соцсетях): лента, видео, репосты, отметки.
type P = { size?: number };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconGrid = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
  </svg>
);
export const IconVideoTab = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M10.5 9.5v5l4.2-2.5z" fill="currentColor" />
  </svg>
);
export const IconRepost = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 11V9a3 3 0 013-3h11l-3-3M20 13v2a3 3 0 01-3 3H6l3 3" />
  </svg>
);
export const IconTagTab = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <circle cx="12" cy="10" r="2.6" />
    <path d="M6.8 19c.6-2.6 2.6-4 5.2-4s4.6 1.4 5.2 4" />
  </svg>
);
export const IconPlaySmall = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
    <path d="M8 5v14l11-7z" />
  </svg>
);

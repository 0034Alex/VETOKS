export function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10.5L12 3l9 7.5"
        stroke={active ? "#C9A227" : "#8A8A8E"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5"
        stroke={active ? "#C9A227" : "#8A8A8E"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUsers({ active }: { active?: boolean }) {
  const c = active ? "#C9A227" : "#8A8A8E";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke={c} strokeWidth="1.8" />
      <path
        d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke={c}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="17" cy="8.5" r="2.3" stroke={c} strokeWidth="1.6" />
      <path
        d="M15.5 14c2.6.3 4.5 2.2 5 4.8"
        stroke={c}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconPlay({ active }: { active?: boolean }) {
  const c = active ? "#C9A227" : "#8A8A8E";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.8" />
      <path d="M10 8.5l6 3.5-6 3.5v-7z" fill={c} />
    </svg>
  );
}

export function IconStar({ active }: { active?: boolean }) {
  const c = active ? "#C9A227" : "#8A8A8E";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l2.6 5.9 6.4.6-4.8 4.2 1.4 6.3L12 16.9l-5.6 3.1 1.4-6.3-4.8-4.2 6.4-.6L12 3z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill={active ? "#C9A227" : "none"}
      />
    </svg>
  );
}

export function IconChart({ active }: { active?: boolean }) {
  const c = active ? "#C9A227" : "#8A8A8E";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 20V4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 20v-7" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 20v-3" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconGift({ active }: { active?: boolean }) {
  const c = active ? "#C9A227" : "#8A8A8E";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="9" width="16" height="11" rx="1" stroke={c} strokeWidth="1.8" />
      <path d="M4 9h16v3H4z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 9v11" stroke={c} strokeWidth="1.8" />
      <path
        d="M12 9c0-2.5-2-4-3.5-4S6 6 6 7.2 7.3 9 9 9h3z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 9c0-2.5 2-4 3.5-4S18 6 18 7.2 16.7 9 15 9h-3z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconProfile({ active }: { active?: boolean }) {
  const c = active ? "#C9A227" : "#8A8A8E";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.8" />
      <path
        d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"
        stroke={c}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconHeart({ filled, color = "#fff" }: { filled?: boolean; color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? "#E24B4A" : "none"}>
      <path
        d="M12 20.5s-7.5-4.6-9.8-9.4C.7 7.7 2.2 4 6 4c2.2 0 3.7 1.3 6 3.7C14.3 5.3 15.8 4 18 4c3.8 0 5.3 3.7 3.8 7.1C19.5 15.9 12 20.5 12 20.5z"
        stroke={filled ? "#E24B4A" : color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconComment({ color = "#fff" }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.2-.2-3.1-.7L4 20l1.1-4.4C4.4 14.4 4 13.2 4 12z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconShare({ color = "#fff" }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 17c1-5.5 4-7.5 9-8"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 5l4 4-4 4"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCrownVote({ color = "#F0997B" }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 18h16l-1.4-8-4.1 3.2L12 8l-2.5 5.2L5.4 10 4 18z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M5 20.5h14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlusBadge() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconSearchWhite() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="1.8" />
      <path d="M20 20l-4.3-4.3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

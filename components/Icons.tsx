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

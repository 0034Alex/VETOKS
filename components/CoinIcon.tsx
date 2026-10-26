// Монета VETOKS: золотое кольцо и корона одного цвета. Размер — в пикселях.
export default function CoinIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  const id = "cg" + size;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3E3A0" />
          <stop offset=".5" stopColor="#DDB84C" />
          <stop offset="1" stopColor="#B38A22" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill={`url(#${id})`} />
      <circle cx="60" cy="60" r="49" fill="#16161A" />
      <g fill={`url(#${id})`} transform="translate(60 61) scale(.52) translate(-50 -35)">
        <path d="M8 58 L16 18 L34 38 L50 8 L66 38 L84 18 L92 58 Z M12 62 H88 V68 H12 Z" />
        <circle cx="50" cy="7" r="5" />
        <circle cx="16" cy="16" r="4.5" />
        <circle cx="84" cy="16" r="4.5" />
      </g>
    </svg>
  );
}

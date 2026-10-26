// Монета VETOKS (вариант «Рельеф»): золотой обод, золотое поле, светлая корона с тенью. Размер — в пикселях.
export default function CoinIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  const id = "cg" + size;
  const crown = (
    <>
      <path d="M8 58 L16 18 L34 38 L50 8 L66 38 L84 18 L92 58 Z M12 62 H88 V68 H12 Z" />
      <circle cx="50" cy="7" r="5" />
      <circle cx="16" cy="16" r="4.5" />
      <circle cx="84" cy="16" r="4.5" />
    </>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <linearGradient id={id + "r"} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F7E9AE" />
          <stop offset=".55" stopColor="#C79B2E" />
          <stop offset="1" stopColor="#7A5C14" />
        </linearGradient>
        <linearGradient id={id + "f"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F7E9AE" />
          <stop offset=".5" stopColor="#DDB84C" />
          <stop offset="1" stopColor="#B38A22" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill={`url(#${id}r)`} />
      <circle cx="60" cy="60" r="49" fill={`url(#${id}f)`} />
      <circle cx="60" cy="60" r="49" fill="none" stroke="#7A5C14" strokeOpacity=".55" strokeWidth="1.5" />
      <g fill="#8A6A18" opacity=".55" transform="translate(61.5 63) translate(-30 -21) scale(.6)">{crown}</g>
      <g fill="#FFF3C4" transform="translate(60 61) translate(-30 -21) scale(.6)">{crown}</g>
    </svg>
  );
}

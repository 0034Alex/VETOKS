export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size * 0.6}
        viewBox="0 0 100 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8D48A" />
            <stop offset="100%" stopColor="#C9A227" />
          </linearGradient>
        </defs>
        <path
          d="M10 50 L20 15 L35 35 L50 8 L65 35 L80 15 L90 50 Z"
          fill="none"
          stroke="url(#goldGrad)"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="50" cy="8" r="4" fill="url(#goldGrad)" />
        <circle cx="20" cy="15" r="3" fill="url(#goldGrad)" />
        <circle cx="80" cy="15" r="3" fill="url(#goldGrad)" />
      </svg>
      <span
        className="text-gold font-semibold tracking-[0.25em]"
        style={{ fontSize: size * 0.32 }}
      >
        VETOKS
      </span>
    </div>
  );
}

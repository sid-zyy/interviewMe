interface Props {
  size?: number;
}

export function Logo({ size = 28 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="braceGradient"
          x1="0"
          y1="0"
          x2="128"
          y2="128"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#8AB4F8" />
          <stop offset="100%" stopColor="#9168C0" />
        </linearGradient>

        <linearGradient
          id="nodeGradient"
          x1="64"
          y1="28"
          x2="64"
          y2="92"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#B388FF" />
          <stop offset="100%" stopColor="#669DF6" />
        </linearGradient>
      </defs>

      {/* Left Brace */}
      <path
        d="
          M38 22
          C28 22 28 34 28 42
          L28 48
          C28 54 24 58 18 60
          C24 62 28 66 28 72
          L28 86
          C28 94 28 106 38 106
        "
        stroke="url(#braceGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right Brace */}
      <path
        d="
          M90 22
          C100 22 100 34 100 42
          L100 48
          C100 54 104 58 110 60
          C104 62 100 66 100 72
          L100 86
          C100 94 100 106 90 106
        "
        stroke="url(#braceGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Tree edges */}
      <g stroke="url(#nodeGradient)" strokeWidth="3">
        <line x1="64" y1="40" x2="48" y2="58" />
        <line x1="64" y1="40" x2="80" y2="58" />
        <line x1="48" y1="58" x2="38" y2="80" />
        <line x1="48" y1="58" x2="58" y2="80" />
        <line x1="80" y1="58" x2="70" y2="80" />
        <line x1="80" y1="58" x2="90" y2="80" />
      </g>

      {/* Nodes */}
      <g fill="url(#nodeGradient)">
        <circle cx="64" cy="36" r="6" />
        <circle cx="48" cy="58" r="5" />
        <circle cx="80" cy="58" r="5" />
        <circle cx="38" cy="80" r="4.5" />
        <circle cx="58" cy="80" r="4.5" />
        <circle cx="70" cy="80" r="4.5" />
        <circle cx="90" cy="80" r="4.5" />
      </g>
    </svg>
  );
}
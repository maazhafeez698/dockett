// apps/web/components/logo.tsx

interface LogoProps {
  className?: string;
  markOnly?: boolean;
  size?: number;
}

export function Logo({ className, markOnly = false, size = 28 }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient
            id="formless-logo-g"
            x1="4"
            y1="4"
            x2="28"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.75" />
            <stop offset="1" stopColor="var(--primary)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" className="fill-foreground/5 dark:fill-white/5" />
        <path
          d="M9 22 L9 12.5 L16 8 L23 12.5 L23 15.5 L16 11 L12.5 13 L12.5 22 Z"
          fill="url(#formless-logo-g)"
        />
        <path d="M16 15 L23 19.5 L23 22 L16 22 Z" fill="url(#formless-logo-g)" fillOpacity="0.55" />
      </svg>
      {!markOnly && <span className="text-lg font-semibold tracking-tight">Formless</span>}
    </span>
  );
}

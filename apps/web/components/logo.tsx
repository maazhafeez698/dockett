import { useId } from "react";

interface LogoProps {
  className?: string;
  /** Render only the symbol. */
  markOnly?: boolean;
  /** Symbol height in px (wordmark scales with it). */
  size?: number;
  /** "color": ember symbol + themed wordmark. "mono": everything follows currentColor. */
  tone?: "color" | "mono";
}

export function LogoMark({
  size = 28,
  className,
  simplified,
}: {
  size?: number;
  className?: string;
  simplified?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const small = simplified ?? size < 20;
  return (
    <svg
      width={(size * 44) / 40}
      height={size}
      viewBox="0 0 44 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <defs>
        <mask id={`dk-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="44" height="40">
          <path d="M0 0h22a20 20 0 0 1 0 40H0z" fill="#fff" />
          {/* punch hole */}
          <circle cx="29" cy="20" r="6.6" fill="#000" />
          {small ? null : (
            <>
              {/* edge notch */}
              <circle cx="0" cy="20" r="4.4" fill="#000" />
              {/* perforation */}
              <rect x="8.2" y="4.4" width="2.8" height="2.8" fill="#000" />
              <rect x="8.2" y="10.6" width="2.8" height="2.8" fill="#000" />
              <rect x="8.2" y="26.6" width="2.8" height="2.8" fill="#000" />
              <rect x="8.2" y="32.8" width="2.8" height="2.8" fill="#000" />
            </>
          )}
        </mask>
      </defs>
      <rect width="44" height="40" fill="currentColor" mask={`url(#dk-${id})`} />
    </svg>
  );
}

export function Logo({ className, markOnly = false, size = 28, tone = "color" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-[0.32em] ${className ?? ""}`}>
      <LogoMark size={size} className={tone === "color" ? "text-primary" : ""} />
      {!markOnly && (
        <span
          className="font-display leading-none font-extrabold"
          style={{ fontSize: size * 0.98, letterSpacing: "-0.055em" }}
        >
          dockett<span className={tone === "color" ? "text-primary" : ""}>.</span>
        </span>
      )}
    </span>
  );
}

/** The compass — the site's mark, used in both navs and as the favicon
 * (public/favicon.svg is the same path, colors baked in since a favicon has
 * no access to the page's CSS custom properties). */
export function CompassMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
      <path d="M12 7l2.4 5-2.4 5-2.4-5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Faint relief-contour lines, the recurring cartographic texture behind a
 * quiet ground (the hero, the chat page). Absolutely positioned; give the
 * parent `position: relative` (or `isolate`, which the hero uses) and a
 * height, or it stretches to the nearest positioned ancestor. */
export function Contours({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={
        "pointer-events-none absolute inset-0 -z-10 h-full w-full text-relief opacity-[0.11] " +
        (className ?? "")
      }
      viewBox="0 0 1200 460"
      preserveAspectRatio="none"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.25">
        <path d="M-40 90 C 220 30 380 150 620 110 C 860 70 980 180 1240 120" />
        <path d="M-40 160 C 220 100 380 220 620 180 C 860 140 980 250 1240 190" />
        <path d="M-40 230 C 220 170 380 290 620 250 C 860 210 980 320 1240 260" />
        <path d="M-40 300 C 220 240 380 360 620 320 C 860 280 980 390 1240 330" />
        <path d="M-40 370 C 220 310 380 430 620 390 C 860 350 980 460 1240 400" />
      </g>
    </svg>
  );
}

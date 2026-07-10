"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const SERVICES = ["Flights", "Hotels", "Tours", "Study Abroad"];
const COMPANY = ["Nigerian HQ", "Contact Us"];

// Real browsers only — used so the height-sync effect below commits before
// paint instead of after, matching the fallback used in layout.tsx. Falls
// back to useEffect during SSR (useLayoutEffect is a no-op there and warns).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Conservative worst-case mobile footer height (3 stacked blocks + gaps +
// py-10 padding) — must match the fallback baked into layout.tsx's
// `var(--footer-height, …)` so first paint doesn't reserve too little space
// and let the fixed footer overlap real content before JS corrects it.
const FALLBACK_FOOTER_HEIGHT = 480;

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

export function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  // Mirrors the footer's real rendered height into a ref (not state) so the
  // scroll handler below can read the latest value every frame without
  // needing to be recreated whenever it changes.
  const footerHeightRef = useRef(FALLBACK_FOOTER_HEIGHT);
  // How much of the reserved trailing scroll space (see layout.tsx) has
  // been scrolled through — 0 while the real content above still fully
  // covers the fixed footer, rising to 1 once it's completely exposed.
  // Drives the footer's own content fade/rise so it animates in smoothly
  // as you scroll, rather than only appearing once scrolling stops.
  const [revealProgress, setRevealProgress] = useState(0);

  // Keeps --footer-height (and the reserved trailing scroll space it drives
  // in layout.tsx) in sync with the footer's real rendered height, at any
  // breakpoint or content reflow. useLayoutEffect (not useEffect) so this
  // commits before paint — matters whenever IntroTakeoff's overlay isn't
  // masking the page (repeat visits in the same session, reduced-motion
  // users), where an after-paint correction would show as a visible jump.
  useIsoLayoutEffect(() => {
    const el = footerRef.current;
    if (!el) return;

    const setHeightVar = () => {
      const height = el.offsetHeight;
      document.documentElement.style.setProperty(
        "--footer-height",
        `${height}px`,
      );
      footerHeightRef.current = height;
    };

    setHeightVar();
    const observer = new ResizeObserver(setHeightVar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Recomputed straight from live scroll/document measurements on every
  // frame, rather than a scroll-position range cached once up front — the
  // page's total height keeps growing as images further up (Hero,
  // PopularDestinations, TravelInsights, ...) finish loading, so a cached
  // range would drift out of sync with where the trailing reveal space
  // actually ends up, making the fade finish well before the footer was
  // really exposed.
  useEffect(() => {
    let ticking = false;

    const updateProgress = () => {
      ticking = false;
      const doc = document.documentElement;
      const distanceFromBottom =
        doc.scrollHeight - window.scrollY - window.innerHeight;
      const progress =
        1 -
        Math.min(
          1,
          Math.max(0, distanceFromBottom / footerHeightRef.current),
        );
      setRevealProgress(progress);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateProgress);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className="fixed inset-x-0 bottom-0 z-0 overflow-hidden rounded-t-[32px] bg-indigo-100 px-4 py-10 sm:px-6 sm:py-12 lg:px-14 lg:py-14"
      style={{
        boxShadow: [
          // Bleeds down from the top edge, inside the box — reads as the
          // footer sitting recessed into the page rather than a flat panel.
          "inset 0 18px 30px -14px rgba(15, 23, 42, 0.35)",
          // Same treatment down the left and right edges, continuing the
          // sunken feel along the sides — deliberately omitted on the
          // bottom, which sits flush against the viewport edge.
          "inset 18px 0 30px -14px rgba(15, 23, 42, 0.35)",
          "inset -18px 0 30px -14px rgba(15, 23, 42, 0.35)",
          // Thin rim right at the lip, where the "sunken" edge would catch a
          // hairline of shadow.
          "inset 0 1px 0 rgba(15, 23, 42, 0.12)",
          // Soft ambient shadow cast just above the opening.
          "0 -10px 24px -14px rgba(15, 23, 42, 0.15)",
        ].join(", "),
      }}
    >
      <div
        className="mx-auto flex max-w-[1600px] flex-col gap-8 sm:flex-row sm:items-start sm:gap-16 lg:gap-24"
        style={{
          opacity: revealProgress,
          transform: `translateY(${lerp(28, 0, revealProgress)}px)`,
        }}
      >
        <div className="flex flex-col gap-2">
          <p className="font-display text-xl font-bold text-navy">
            MasterTrip
          </p>
          <p className="max-w-xs text-caption text-slate-600">
            © 2024 MasterTrip. Global Travel &amp; Study Abroad Excellence.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-body font-semibold text-navy">Services</p>
          <ul className="flex flex-col gap-2">
            {SERVICES.map((label) => (
              <li key={label}>
                <a
                  href="#"
                  className="text-caption text-slate-600 underline decoration-slate-400 underline-offset-2 transition-colors hover:text-navy"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-body font-semibold text-navy">Company</p>
          <ul className="flex flex-col gap-2">
            {COMPANY.map((label) => (
              <li key={label}>
                <a
                  href="#"
                  className="text-caption text-slate-600 underline decoration-slate-400 underline-offset-2 transition-colors hover:text-navy"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

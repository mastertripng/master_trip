"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Search, Menu, X } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LiquidGlass from "liquid-glass-react";
import { MobileMenu, type MobileMenuVariant } from "./MobileMenu";
import { useIntroComplete } from "./IntroTakeoff";

gsap.registerPlugin(ScrollTrigger);

// Distance (px) over which the navbar transitions from its resting state to
// its docked/scrolled state.
const SHRINK_DISTANCE = 120;

// Which mobile menu open/close animation to use — flip this to preview
// another variant. "grid": blocks tile in, then links flip up. "circle": an
// expanding circular wipe from the toggle button, then links mask up.
// "curtain": vertical panels rise like a curtain. "curtain-rtl"/"curtain-ltr":
// same panels, but sweeping in horizontally from the right/left edge.
const MOBILE_MENU_VARIANT: MobileMenuVariant = "curtain";

const NAV_LINKS = [
  { label: "Flights", href: "/flights" },
  { label: "Hotels", href: "/hotels" },
  { label: "Tours", href: "/tours" },
  { label: "Study Abroad", href: "/study-abroad" },
];

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function Logo({ progress }: { progress: number }) {
  return (
    <Link href="/" className="flex shrink-0 items-center">
      <img
        src="/logo.svg"
        alt="Mastertrip Travels"
        style={{ height: lerp(48, 60, progress) }}
        className="w-auto"
      />
    </Link>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [activeLink, setActiveLink] = useState("Flights");
  // Scroll progress (0 = top of page, 1 = fully docked), driven by
  // ScrollTrigger below and consumed directly as React state so it can feed
  // both plain CSS values and LiquidGlass's own props.
  const [progress, setProgress] = useState(0);

  const headerRef = useRef<HTMLElement>(null);
  const lastResizeNudgeProgressRef = useRef(0);

  // Held back until the intro's view-transition has fully finished (or,
  // on repeat visits where the intro never shows, until just after mount)
  // so the slide-in is never seen playing out underneath the overlay.
  const introComplete = useIntroComplete();
  const [animateIn, setAnimateIn] = useState(false);
  useGSAP(() => {
    if (introComplete) setAnimateIn(true);
  }, [introComplete]);

  useGSAP(() => {
    // The dock/shrink effect continuously varies padding, corner radius, and
    // blur in lockstep with scroll offset — skip it for reduced-motion users
    // and leave the navbar at its resting state instead.
    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const trigger = ScrollTrigger.create({
      trigger: document.body,
      start: "top top",
      end: `${SHRINK_DISTANCE} top`,
      scrub: true,
      onUpdate: (self) => {
        setProgress(self.progress);
        // The glass layers below size themselves off a measurement that is
        // only refreshed on the native `resize` event, not on the padding
        // change driving our shrink — nudge it back in sync as we scroll.
        // Gated to ~2% progress steps (plus the 0/1 boundaries): dispatching
        // on every single onUpdate tick fired a global `resize` event on
        // every scroll frame, which every other ScrollTrigger instance on
        // the page (GlobalEducation, PopularDestinations, TravelInsights,
        // WhyChooseUs) also listens for and re-refreshes on — a step this
        // small is visually indistinguishable but cuts that dispatch rate
        // by roughly 98%.
        const last = lastResizeNudgeProgressRef.current;
        if (
          Math.abs(self.progress - last) >= 0.02 ||
          self.progress === 0 ||
          self.progress === 1
        ) {
          lastResizeNudgeProgressRef.current = self.progress;
          window.dispatchEvent(new Event("resize"));
        }
      },
    });
    return () => trigger.kill();
  }, []);

  const paddingY = lerp(14, 7, progress);
  const gutter = lerp(16, 8, progress);
  // Corners open up into a fuller pill as the bar docks, and the bar itself
  // narrows a good deal more than the gutter alone would give it — both
  // driven by the same scroll progress so the shrink actually reads as one
  // continuous motion instead of a barely-there nudge.
  const cornerRadius = lerp(24, 40, progress);
  const maxWidth = lerp(1400, 1040, progress);

  return (
    <>
      <header
        ref={headerRef}
        className={`sticky top-0 z-50 flex justify-center ${
          animateIn ? "animate-navbar-slide-in" : "opacity-0"
        }`}
        style={{
          paddingTop: gutter,
          paddingLeft: gutter,
          paddingRight: gutter,
        }}
      >
        <div
          className="navbar-pill w-full overflow-hidden"
          style={
            {
              maxWidth,
              borderRadius: cornerRadius,
              backgroundColor: `rgba(255, 255, 255, ${lerp(0, 0.4, progress)})`,
              boxShadow: `0 ${lerp(0, 18, progress)}px ${lerp(0, 36, progress)}px -14px rgba(15, 23, 42, ${lerp(0, 0.32, progress)})`,
              border: `1px solid rgba(15, 23, 42, ${lerp(0, 0.12, progress)})`,
              // Read by the `.navbar-pill::after` specular sheen so it fades
              // in on the same curve as everything else — at rest there is
              // no border, no shadow, no tint, no sheen; scrolling is what
              // reveals the glass.
              "--glass-progress": progress,
            } as React.CSSProperties
          }
        >
          <LiquidGlass
            className="navbar-liquid-box"
            padding="0px"
            cornerRadius={cornerRadius}
            elasticity={0}
            saturation={lerp(100, 160, progress)}
            blurAmount={lerp(0, 0.22, progress)}
          >
            <div
              className="flex w-full items-center justify-between px-4 sm:px-6 lg:px-10"
              style={{ paddingTop: paddingY, paddingBottom: paddingY }}
            >
              <Logo progress={progress} />

              <nav className="hidden lg:flex items-center gap-8">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setActiveLink(link.label)}
                    className={`text-body font-medium transition-colors ${
                      activeLink === link.label
                        ? "text-primary underline underline-offset-8 decoration-2"
                        : "text-slate-700 hover:text-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="hidden lg:flex items-center gap-4">
                <button
                  type="button"
                  aria-label="Search"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Search className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="rounded-full bg-navy px-6 py-2.5 text-body font-semibold text-white transition-colors hover:bg-slate-900"
                >
                  Consultation
                </button>
              </div>

              <button
                type="button"
                aria-label={open ? "Close menu" : "Open menu"}
                onClick={() => setOpen((v) => !v)}
                className={`relative z-50 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 lg:hidden ${
                  open ? "text-white" : "text-navy"
                }`}
              >
                <span
                  className={`transition-transform duration-300 ${open ? "rotate-90" : "rotate-0"}`}
                >
                  {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </span>
              </button>
            </div>
          </LiquidGlass>
        </div>
      </header>

      <MobileMenu
        variant={MOBILE_MENU_VARIANT}
        open={open}
        links={NAV_LINKS}
        activeLink={activeLink}
        onNavigate={(label) => {
          setActiveLink(label);
          setOpen(false);
        }}
      />
    </>
  );
}

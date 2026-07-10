"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { MobileMenuProps } from "./MobileMenu";

const PANEL_COUNT = 6;

type Direction = "rtl" | "ltr";

function MobileMenuCurtainSlide({
  direction,
  open,
  links,
  activeLink,
  onNavigate,
}: MobileMenuProps & { direction: Direction }) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement[]>([]);
  const linkMaskRefs = useRef<HTMLDivElement[]>([]);
  const ctaRef = useRef<HTMLButtonElement>(null);

  // Every panel drops straight down (top to bottom) and retreats back up
  // on close — the axis of motion never changes. What "rtl"/"ltr" controls
  // is purely which side of the row starts dropping first, so the curtain
  // reads as sweeping across the screen from right-to-left or left-to-right
  // as each panel falls into place.
  const openFrom = direction === "rtl" ? "end" : "start";
  const closeFrom = direction === "rtl" ? "start" : "end";

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mounted]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const panels = panelsRef.current;
    const linkMasks = linkMaskRefs.current;
    const closeTargets = ctaRef.current ? [...linkMasks, ctaRef.current] : linkMasks;
    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          if (!open) setMounted(false);
        },
      });

      if (prefersReduced) {
        gsap.set(panels, { yPercent: open ? 0 : -100 });
        gsap.set(closeTargets, { autoAlpha: open ? 1 : 0, y: 0 });
        if (!open) setMounted(false);
        return;
      }

      if (open) {
        gsap.set(panels, { yPercent: -100 });
        gsap.set(closeTargets, { autoAlpha: 0, y: "110%" });

        tl.to(panels, {
          yPercent: 0,
          duration: 0.7,
          ease: "power3.inOut",
          stagger: { amount: 0.3, from: openFrom },
        }).to(
          closeTargets,
          {
            autoAlpha: 1,
            y: "0%",
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.08,
          },
          "-=0.35"
        );
      } else {
        // Re-assert the fully-open state before tweening back — the
        // previous ("open") gsap.context has just been reverted, which
        // strips these inline transforms, so without this the close tween
        // has nothing valid to animate from and just snaps shut.
        gsap.set(panels, { yPercent: 0 });
        gsap.set(closeTargets, { autoAlpha: 1, y: "0%" });

        tl.to(closeTargets, {
          autoAlpha: 0,
          y: "-110%",
          duration: 0.3,
          ease: "power2.in",
          stagger: 0.04,
        }).to(
          panels,
          {
            yPercent: -100,
            duration: 0.6,
            ease: "power3.inOut",
            stagger: { amount: 0.25, from: closeFrom },
          },
          "-=0.05"
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [open, mounted, openFrom, closeFrom]);

  if (!mounted) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 flex">
        {Array.from({ length: PANEL_COUNT }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) panelsRef.current[i] = el;
            }}
            className="h-full flex-1 bg-navy"
          />
        ))}
      </div>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-8">
        <nav className="flex flex-col items-center gap-3">
          {links.map((link, i) => (
            <div
              key={link.label}
              ref={(el) => {
                if (el) linkMaskRefs.current[i] = el;
              }}
              className="overflow-hidden py-1"
            >
              <Link
                href={link.href}
                onClick={() => onNavigate(link.label)}
                className={`block px-4 text-h4 font-display font-semibold transition-colors ${
                  activeLink === link.label ? "text-coral" : "text-white"
                }`}
              >
                {link.label}
              </Link>
            </div>
          ))}
        </nav>
        <button
          ref={ctaRef}
          type="button"
          className="mt-6 rounded-full bg-coral px-8 py-3 text-body font-semibold text-white"
        >
          Consultation
        </button>
      </div>
    </div>
  );
}

export function MobileMenuCurtainRTL(props: MobileMenuProps) {
  return <MobileMenuCurtainSlide direction="rtl" {...props} />;
}

export function MobileMenuCurtainLTR(props: MobileMenuProps) {
  return <MobileMenuCurtainSlide direction="ltr" {...props} />;
}

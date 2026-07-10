"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { MobileMenuProps } from "./MobileMenu";

const PANEL_COUNT = 6;

export function MobileMenuCurtain({
  open,
  links,
  activeLink,
  onNavigate,
}: MobileMenuProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement[]>([]);
  const linkMaskRefs = useRef<HTMLDivElement[]>([]);
  const ctaRef = useRef<HTMLButtonElement>(null);

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
        gsap.set(panels, { scaleY: open ? 1 : 0 });
        gsap.set(closeTargets, { autoAlpha: open ? 1 : 0, y: 0 });
        if (!open) setMounted(false);
        return;
      }

      if (open) {
        gsap.set(panels, { scaleY: 0, transformOrigin: "bottom" });
        gsap.set(closeTargets, { autoAlpha: 0, y: "110%" });

        tl.to(panels, {
          scaleY: 1,
          duration: 0.7,
          ease: "power3.inOut",
          stagger: { amount: 0.3, from: "start" },
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
        // Re-assert the fully-open state before tweening back — on close,
        // the previous ("open") gsap.context has just been reverted, which
        // strips the inline scaleY/autoAlpha we depend on. Without this, the
        // tween has no valid state to animate from and just snaps shut
        // instead of animating closed.
        gsap.set(panels, { scaleY: 1, transformOrigin: "bottom" });
        gsap.set(closeTargets, { autoAlpha: 1, y: "0%" });

        tl.to(closeTargets, {
          autoAlpha: 0,
          y: "-110%",
          duration: 0.3,
          ease: "power2.in",
          stagger: 0.04,
        }).set(panels, { transformOrigin: "top" }).to(
          panels,
          {
            scaleY: 0,
            duration: 0.6,
            ease: "power3.inOut",
            stagger: { amount: 0.25, from: "end" },
          },
          "-=0.05"
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [open, mounted]);

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

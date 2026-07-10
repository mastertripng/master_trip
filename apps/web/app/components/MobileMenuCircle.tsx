"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { MobileMenuProps } from "./MobileMenu";

// Origin the wipe expands from/into — pinned near the hamburger/close
// button's on-screen position (top-right of the header gutter) so the
// reveal reads as coming *from* the control the user just pressed.
const ORIGIN = "calc(100% - 32px) 32px";
const CLIP_CLOSED = `circle(0% at ${ORIGIN})`;
const CLIP_OPEN = `circle(150% at ${ORIGIN})`;

export function MobileMenuCircle({
  open,
  links,
  activeLink,
  onNavigate,
}: MobileMenuProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
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
    const overlay = overlayRef.current;
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
        gsap.set(overlay, { autoAlpha: open ? 1 : 0, clipPath: CLIP_OPEN });
        gsap.set(closeTargets, { autoAlpha: open ? 1 : 0, y: 0 });
        if (!open) setMounted(false);
        return;
      }

      if (open) {
        gsap.set(overlay, { autoAlpha: 1, clipPath: CLIP_CLOSED });
        gsap.set(closeTargets, { autoAlpha: 0, y: "110%" });

        tl.to(overlay, {
          clipPath: CLIP_OPEN,
          duration: 0.9,
          ease: "power4.inOut",
        }).to(
          closeTargets,
          {
            autoAlpha: 1,
            y: "0%",
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.08,
          },
          "-=0.45"
        );
      } else {
        // Re-assert the fully-open state before tweening back — on close,
        // the previous ("open") gsap.context has just been reverted, which
        // strips the inline clip-path we depend on. Without this, the tween
        // has no valid circle(...) string to animate from (only computed
        // "none"), so it can't interpolate and just snaps shut instead of
        // shrinking back into the button.
        gsap.set(overlay, { autoAlpha: 1, clipPath: CLIP_OPEN });
        gsap.set(closeTargets, { autoAlpha: 1, y: "0%" });

        tl.to(closeTargets, {
          autoAlpha: 0,
          y: "-110%",
          duration: 0.35,
          ease: "power2.in",
          stagger: 0.04,
        }).to(
          overlay,
          {
            clipPath: CLIP_CLOSED,
            duration: 0.7,
            ease: "power3.inOut",
            onComplete: () => gsap.set(overlay, { autoAlpha: 0 }),
          },
          "-=0.1"
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [open, mounted]);

  if (!mounted) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-40 lg:hidden">
      <div ref={overlayRef} className="absolute inset-0 bg-navy" />

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

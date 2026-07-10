"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { MobileMenuProps } from "./MobileMenu";

const GRID_COLS = 6;
const GRID_ROWS = 8;
const BLOCK_COUNT = GRID_COLS * GRID_ROWS;

export function MobileMenuGrid({
  open,
  links,
  activeLink,
  onNavigate,
}: MobileMenuProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<HTMLDivElement[]>([]);
  const linksRef = useRef<HTMLAnchorElement[]>([]);
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
    const blocks = blocksRef.current;
    const linkEls = linksRef.current;
    const closeTargets = ctaRef.current
      ? [...linkEls, ctaRef.current]
      : linkEls;
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
        gsap.set(blocks, { scale: open ? 1 : 0 });
        gsap.set(closeTargets, { autoAlpha: open ? 1 : 0, rotateX: 0 });
        if (!open) setMounted(false);
        return;
      }

      if (open) {
        gsap.set(blocks, { scale: 0 });
        gsap.set(closeTargets, { autoAlpha: 0, rotateX: -90 });

        tl.to(blocks, {
          scale: 1.02,
          duration: 0.45,
          ease: "power2.out",
          stagger: {
            amount: 0.5,
            grid: [GRID_ROWS, GRID_COLS],
            from: "start",
          },
        }).to(
          closeTargets,
          {
            autoAlpha: 1,
            rotateX: 0,
            duration: 0.55,
            ease: "back.out(1.6)",
            stagger: 0.08,
          },
          "-=0.15"
        );
      } else {
        // Re-assert the fully-open state before tweening back — on close,
        // the previous ("open") gsap.context has just been reverted, which
        // strips the inline scale/autoAlpha we depend on. Without this, the
        // tween has no valid state to animate from and just snaps shut
        // instead of animating closed.
        gsap.set(blocks, { scale: 1.02 });
        gsap.set(closeTargets, { autoAlpha: 1, rotateX: 0 });

        tl.to(closeTargets, {
          autoAlpha: 0,
          rotateX: 90,
          duration: 0.3,
          ease: "power1.in",
          stagger: 0.04,
        }).to(
          blocks,
          {
            scale: 0,
            duration: 0.4,
            ease: "power2.in",
            stagger: {
              amount: 0.4,
              grid: [GRID_ROWS, GRID_COLS],
              from: "end",
            },
          },
          "-=0.1"
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [open, mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 lg:hidden"
      style={{ perspective: 1000 }}
    >
      <div
        className="absolute inset-0"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
        }}
      >
        {Array.from({ length: BLOCK_COUNT }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) blocksRef.current[i] = el;
            }}
            className="bg-navy"
            style={{ transformOrigin: "center" }}
          />
        ))}
      </div>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-8">
        <nav className="flex flex-col items-center gap-3">
          {links.map((link, i) => (
            <Link
              key={link.label}
              href={link.href}
              ref={(el) => {
                if (el) linksRef.current[i] = el;
              }}
              onClick={() => onNavigate(link.label)}
              className={`px-4 py-2 text-h4 font-display font-semibold transition-colors ${
                activeLink === link.label ? "text-coral" : "text-white"
              }`}
              style={{ transformStyle: "preserve-3d" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          ref={ctaRef}
          type="button"
          className="mt-6 rounded-full bg-coral px-8 py-3 text-body font-semibold text-white"
          style={{ transformStyle: "preserve-3d" }}
        >
          Consultation
        </button>
      </div>
    </div>
  );
}

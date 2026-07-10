"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export type NavLink = { label: string; href: string };

export type MobileMenuVariant =
  | "grid"
  | "circle"
  | "curtain"
  | "curtain-rtl"
  | "curtain-ltr";

export type MobileMenuProps = {
  open: boolean;
  links: NavLink[];
  activeLink: string;
  onNavigate: (label: string) => void;
};

// Dynamically imported (not statically, per-variant) so only the one variant
// actually selected by MOBILE_MENU_VARIANT in Navbar.tsx is ever fetched and
// parsed by the client — the other four exploration takes stay out of the
// production bundle entirely instead of shipping ~700 combined lines of dead
// code to every visitor. ssr: false since the overlay only ever renders
// after a user opens the menu client-side.
const VARIANTS: Record<MobileMenuVariant, ComponentType<MobileMenuProps>> = {
  // Original take: a grid of blocks pops in tile-by-tile, then the links
  // flip up into place.
  grid: dynamic(
    () => import("./MobileMenuGrid").then((m) => m.MobileMenuGrid),
    { ssr: false },
  ),
  // Awwwards-style take: the panel wipes open as an expanding circle from
  // the toggle button, then each link masks up into view.
  circle: dynamic(
    () => import("./MobileMenuCircle").then((m) => m.MobileMenuCircle),
    { ssr: false },
  ),
  // Awwwards-style take: vertical panels rise like a curtain, then the
  // links mask up into view; on close the curtain drops back down.
  curtain: dynamic(
    () => import("./MobileMenuCurtain").then((m) => m.MobileMenuCurtain),
    { ssr: false },
  ),
  // Same curtain family, but the panels sweep in horizontally from the
  // right edge and retreat back out the same way on close.
  "curtain-rtl": dynamic(
    () =>
      import("./MobileMenuCurtainSlide").then((m) => m.MobileMenuCurtainRTL),
    { ssr: false },
  ),
  // Mirror of the above — panels sweep in from the left edge.
  "curtain-ltr": dynamic(
    () =>
      import("./MobileMenuCurtainSlide").then((m) => m.MobileMenuCurtainLTR),
    { ssr: false },
  ),
};

export function MobileMenu({
  variant = "circle",
  ...props
}: MobileMenuProps & { variant?: MobileMenuVariant }) {
  const Variant = VARIANTS[variant];
  return <Variant {...props} />;
}

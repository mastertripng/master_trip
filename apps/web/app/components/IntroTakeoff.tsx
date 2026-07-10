"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const SESSION_KEY = "mt-intro-shown";
const MIN_LOADING_MS = 1400;
const SAFETY_TIMEOUT_MS = 4000;
const TAKEOFF_MS = 2000;
const DISPLAY_SIZE = 108; // px, square (plane.svg viewBox is 0 0 32 32)
const CONE_HALF_DEG = 30; // 60deg full aperture
const MASK_OVERSHOOT = 1.9; // how far past the corner the mask apex reaches
// Start point for the flight, as a fraction of the viewport — matches the
// bottom-left "peek" position so takeoff picks up exactly where it left off.
const START_FRAC = { x: 0.02, y: 1.03 };

// plane.svg local geometry (0..32 viewBox), read off the path data.
const CENTER_LOCAL = { x: 16, y: 16 };
const NOSE_LOCAL = { x: 31.2, y: 0.8 };
const TAIL_LOCAL = { x: 10.5, y: 31.7 };
// Middle of the rear (back) wing — the small wing near the tail, distinct
// from the large front wing by the nose. This is where the mask's cone
// point is pinned, not the fuselage tip.
const BACK_WING_LOCAL = { x: 5, y: 23 };
const ASSET_ANGLE_DEG =
  (Math.atan2(
    NOSE_LOCAL.y - TAIL_LOCAL.y,
    NOSE_LOCAL.x - TAIL_LOCAL.x
  ) *
    180) /
  Math.PI;
const SCALE = DISPLAY_SIZE / 32;
const BACK_WING_OFFSET = {
  x: (BACK_WING_LOCAL.x - CENTER_LOCAL.x) * SCALE,
  y: (BACK_WING_LOCAL.y - CENTER_LOCAL.y) * SCALE,
};
const PITCH_START_DEG = -5;
const PITCH_SWEEP_DEG = 9;

// SSR-safe: real browsers only, used solely to seed sensible defaults.
const FALLBACK_VW = 1440;
const FALLBACK_VH = 900;

type Phase = "loading" | "takeoff" | "done";

// Lets descendants (e.g. the navbar) hold their own entrance animations
// until the intro's view-transition has fully finished, instead of playing
// underneath the overlay where they'd already be settled by reveal time.
const IntroCompleteContext = createContext(false);

export function useIntroComplete() {
  return useContext(IntroCompleteContext);
}

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function easeInAccel(t: number) {
  return Math.pow(t, 1.7);
}

function rotateDeg(v: { x: number; y: number }, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

// The whole point: the flight is aimed at the literal top-right corner of
// whatever screen it's running on, not a fixed angle that might exit through
// the top edge early on a wide viewport. Angle and rotation fall out of that
// single aim point, so peek pose and takeoff always agree.
function computeFlightGeometry(vw: number, vh: number) {
  const startPx = { x: START_FRAC.x * vw, y: START_FRAC.y * vh };
  const cornerPx = { x: vw, y: 0 };
  const toCorner = { x: cornerPx.x - startPx.x, y: cornerPx.y - startPx.y };
  const cornerDist = Math.hypot(toCorner.x, toCorner.y);
  const dir = { x: toCorner.x / cornerDist, y: toCorner.y / cornerDist };
  const flightAngleDeg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  const baseRot = flightAngleDeg - ASSET_ANGLE_DEG;
  return { startPx, dir, cornerDist, baseRot };
}

export function IntroTakeoff({ children }: { children: React.ReactNode }) {
  // Default to "loading" so the very first server-rendered paint already
  // shows the intro — no frame where the real page is visible first.
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [peekRot, setPeekRot] = useState(
    () => computeFlightGeometry(FALLBACK_VW, FALLBACK_VH).baseRot + PITCH_START_DEG
  );

  const overlayRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);

  // Runs before the browser paints the first client frame: bail out of the
  // intro entirely (no flash of it) if it already played this session, or
  // if the user asked for reduced motion. Also swaps the SSR-fallback peek
  // rotation for the one computed from the real screen, so the plane is
  // aimed at the actual corner before anything is visible.
  useIsoLayoutEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      alreadyShown = false;
    }
    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (alreadyShown || prefersReduced) {
      setPhase("done");
    }

    const { baseRot } = computeFlightGeometry(
      window.innerWidth || FALLBACK_VW,
      window.innerHeight || FALLBACK_VH
    );
    setPeekRot(baseRot + PITCH_START_DEG);
  }, []);

  // Loading phase: drive the progress bar toward completion.
  useEffect(() => {
    if (phase !== "loading") return;
    let raf = 0;
    let cancelled = false;
    const start = performance.now();
    let loaded = document.readyState === "complete";
    const onLoad = () => {
      loaded = true;
    };
    window.addEventListener("load", onLoad);

    function tick(now: number) {
      if (cancelled) return;
      const elapsed = now - start;
      const base = Math.min(92, (elapsed / MIN_LOADING_MS) * 92);
      const ready = loaded && elapsed >= MIN_LOADING_MS;
      const timedOut = elapsed >= SAFETY_TIMEOUT_MS;

      setProgress(ready || timedOut ? 100 : base);

      if (ready || timedOut) {
        window.setTimeout(() => setPhase("takeoff"), 220);
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("load", onLoad);
    };
  }, [phase]);

  // Takeoff phase: fly the plane across the screen while a 60deg cone,
  // anchored at the middle of its back wing, sweeps open behind it —
  // continuously, right up to the moment it has swallowed the whole
  // viewport. No stall, no hand-off to a fade; the geometry itself
  // finishes the reveal.
  useEffect(() => {
    if (phase !== "takeoff") return;
    let raf = 0;
    let cancelled = false;
    const start = performance.now();
    const vw = window.innerWidth || FALLBACK_VW;
    const vh = window.innerHeight || FALLBACK_VH;
    const diag = Math.hypot(vw, vh);

    const { startPx, dir, cornerDist, baseRot } = computeFlightGeometry(
      vw,
      vh
    );
    // The plane passes straight through the actual top-right corner partway
    // through the flight, then keeps going the same direction (overshoot) so
    // the 60deg cone has fully swallowed the viewport by the time it's gone
    // — plane and mask apex are driven by the exact same position, every
    // frame, so the cone's point is always pinned to the plane.
    const travelDistance = cornerDist * MASK_OVERSHOOT;
    const reverse = { x: -dir.x, y: -dir.y };
    const edgeA = rotateDeg(reverse, CONE_HALF_DEG);
    const edgeB = rotateDeg(reverse, -CONE_HALF_DEG);

    function tick(now: number) {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / TAKEOFF_MS);
      const eased = easeInAccel(t);
      const rot = baseRot + PITCH_START_DEG + PITCH_SWEEP_DEG * eased;

      const planeX = startPx.x + dir.x * travelDistance * eased;
      const planeY = startPx.y + dir.y * travelDistance * eased;

      if (planeRef.current) {
        planeRef.current.style.transform = `translate3d(${planeX}px, ${planeY}px, 0) translate(-50%, -50%) rotate(${rot}deg)`;
      }

      if (overlayRef.current) {
        // The cone's apex is pinned to the middle of the plane's back wing,
        // every frame — the plane is always exactly at the point of the angle.
        const wingWorld = rotateDeg(BACK_WING_OFFSET, rot);
        const apexX = planeX + wingWorld.x;
        const apexY = planeY + wingWorld.y;

        const len = Math.hypot(apexX - vw / 2, apexY - vh / 2) + 2 * diag;
        const p1x = apexX + edgeA.x * len;
        const p1y = apexY + edgeA.y * len;
        const p2x = apexX + edgeB.x * len;
        const p2y = apexY + edgeB.y * len;

        overlayRef.current.style.clipPath = `path(evenodd, "M -20 -20 L ${
          vw + 20
        } -20 L ${vw + 20} ${vh + 20} L -20 ${
          vh + 20
        } Z M ${apexX} ${apexY} L ${p1x} ${p1y} L ${p2x} ${p2y} Z")`;
      }

      if (t >= 1) {
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "done") return;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* sessionStorage unavailable */
    }
  }, [phase]);

  const showOverlay = phase === "loading" || phase === "takeoff";

  // Lock page scroll while the overlay is up — otherwise a user can scroll
  // past a below-the-fold section's ScrollTrigger start point before it's
  // even registered (sections wait for `introComplete` to create their
  // triggers), causing that section's entrance animation to skip straight
  // to its end state instead of playing on scroll.
  useEffect(() => {
    if (!showOverlay) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showOverlay]);

  return (
    <>
      <IntroCompleteContext.Provider value={phase === "done"}>
        {children}
      </IntroCompleteContext.Provider>
      {showOverlay && (
        <div
          ref={overlayRef}
          aria-hidden="true"
          className="fixed inset-0 z-[100] bg-gradient-to-br from-white via-sky to-white"
        >
          {phase === "loading" && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6">
              <img
                src="/logo.svg"
                alt="Mastertrip Travels"
                className="w-52 sm:w-64 animate-intro-logo-in drop-shadow-sm"
              />
              <div className="w-56 sm:w-64">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-navy to-coral transition-[width] duration-150 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div
            ref={planeRef}
            className="fixed left-0 top-0"
            style={{
              width: DISPLAY_SIZE,
              height: DISPLAY_SIZE,
              transform: `translate3d(${START_FRAC.x * 100}vw, ${
                START_FRAC.y * 100
              }vh, 0) translate(-50%, -50%) rotate(${peekRot}deg)`,
            }}
          >
            <img
              src="/plane.svg"
              alt=""
              className={`h-full w-full ${
                phase === "loading" ? "animate-intro-plane-idle" : ""
              }`}
            />
          </div>
        </div>
      )}
    </>
  );
}

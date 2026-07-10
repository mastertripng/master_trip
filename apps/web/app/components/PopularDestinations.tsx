"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIntroComplete } from "./IntroTakeoff";

gsap.registerPlugin(ScrollTrigger);

const DESTINATIONS = [
  {
    city: "London",
    tag: "Flights, Hotels & Study",
    image:
      "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  },
  {
    city: "Paris",
    tag: "Tours & Hotels",
    image:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80",
  },
  {
    city: "Toronto",
    tag: "Study Abroad",
    image:
      "https://images.unsplash.com/photo-1517090504586-fde19ea6066f?w=800&q=80",
  },
  {
    city: "Sydney",
    tag: "Flights & Study",
    image:
      "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80",
  },
];

export function PopularDestinations() {
  const sectionRef = useRef<HTMLElement>(null);
  const introComplete = useIntroComplete();

  // Scroll-triggered reveals don't fire until scrolled into view anyway, but
  // gating on the intro means a short viewport can't catch this section
  // mid-animation while the view-transition overlay is still up.
  useGSAP(
    () => {
      if (!introComplete) return;

      const prefersReduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (prefersReduced) {
        gsap.set([".destinations-heading", ".destination-card"], {
          y: 0,
          opacity: 1,
        });
        return;
      }

      gsap.from(".destinations-heading", {
        y: 24,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".destinations-heading",
          start: "top 85%",
        },
      });

      gsap.from(".destination-card", {
        y: 40,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: ".destinations-grid",
          start: "top 80%",
        },
      });

      const cards = gsap.utils.toArray<HTMLElement>(".destination-card");
      const cleanups = cards.map((card) => {
        // fromTo (not to) so the rest state is a fixed, known value — a
        // scroll-triggered entrance tween still in flight on this same card
        // can get overwritten mid-slide by a quick hover, and a relative
        // `.to()` would then reverse back to that leftover offset instead
        // of home, leaving the card stuck instead of bouncing back.
        const restShadow = getComputedStyle(card).boxShadow;
        const tl = gsap.timeline({
          paused: true,
          defaults: { duration: 0.35, ease: "power2.out" },
        });
        tl.fromTo(
          card,
          { y: 0, boxShadow: restShadow },
          { y: -6, boxShadow: "0 20px 40px -12px rgba(15,23,42,0.35)" },
        );

        const onEnter = () => tl.play();
        const onLeave = () => tl.reverse();
        card.addEventListener("mouseenter", onEnter);
        card.addEventListener("mouseleave", onLeave);
        return () => {
          card.removeEventListener("mouseenter", onEnter);
          card.removeEventListener("mouseleave", onLeave);
        };
      });

      return () => cleanups.forEach((cleanup) => cleanup());
    },
    { scope: sectionRef, dependencies: [introComplete] },
  );

  return (
    <section
      ref={sectionRef}
      className="bg-slate-50 px-4 pb-20 pt-4 sm:px-6 sm:pb-24 lg:px-14 lg:pb-32"
    >
      <div className="mx-auto max-w-[1600px]">
        <div
          className={`destinations-heading text-center ${
            introComplete ? "" : "opacity-0"
          }`}
        >
          <h2 className="font-display text-3xl font-bold text-navy sm:text-h3">
            Popular Destinations
          </h2>
          <p className="mt-2 text-body text-slate-500">
            Explore our most booked locations
          </p>
        </div>

        <div className="destinations-grid mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {DESTINATIONS.map((destination) => (
            <div
              key={destination.city}
              className={`destination-card group relative aspect-[16/10] overflow-hidden rounded-image bg-slate-200 sm:aspect-[3/4] ${
                introComplete ? "" : "opacity-0"
              }`}
            >
              <Image
                src={destination.image}
                alt={destination.city}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <h3 className="font-display text-lg font-bold text-white sm:text-xl">
                  {destination.city}
                </h3>
                <p className="mt-0.5 text-small text-white/80">
                  {destination.tag}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

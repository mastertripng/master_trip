"use client";

import { useRef } from "react";
import Image from "next/image";
import { ArrowRight, BedDouble, Luggage, Plane } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIntroComplete } from "./IntroTakeoff";

gsap.registerPlugin(ScrollTrigger);

const DESTINATIONS = [
  {
    country: "United Kingdom",
    flagCode: "gb",
    iconBg: "bg-violet-100",
    description:
      "Undergraduate & Masters programs with post-study work options.",
  },
  {
    country: "Canada",
    flagCode: "ca",
    iconBg: "bg-red-100",
    description:
      "Top-tier universities and excellent pathway to permanent residency.",
  },
  {
    country: "United States",
    flagCode: "us",
    iconBg: "bg-slate-100",
    description: "World-renowned institutions and diverse cultural experiences.",
  },
  {
    country: "Australia",
    flagCode: "au",
    iconBg: "bg-amber-100",
    description:
      "High quality of life and world-class educational facilities.",
  },
];

const SERVICES = [
  {
    label: "Book Flights",
    description: "Find the best deals on international and domestic flights.",
    cta: "Search Flights",
    icon: Plane,
    iconClassName: "-rotate-45",
  },
  {
    label: "Find Hotels",
    description: "Comfortable stays around the globe for every budget.",
    cta: "Browse Hotels",
    icon: BedDouble,
    iconClassName: "",
  },
  {
    label: "Tour Packages",
    description: "Curated experiences and guided tours for unforgettable trips.",
    cta: "Explore Tours",
    icon: Luggage,
    iconClassName: "",
  },
];

export function GlobalEducation() {
  const sectionRef = useRef<HTMLElement>(null);
  const introComplete = useIntroComplete();

  useGSAP(
    () => {
      if (!introComplete) return;

      const prefersReduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (prefersReduced) {
        gsap.set(
          [
            ".education-heading",
            ".education-cta",
            ".education-card",
            ".service-card",
          ],
          { y: 0, opacity: 1 },
        );
        return;
      }

      gsap.from(".education-heading", {
        y: 24,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".education-panel",
          start: "top 80%",
        },
      });

      gsap.from(".education-cta", {
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".education-panel",
          start: "top 80%",
        },
      });

      gsap.from(".education-card", {
        y: 36,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: ".education-grid",
          start: "top 82%",
        },
      });

      gsap.from(".service-card", {
        y: 36,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: ".services-grid",
          start: "top 85%",
        },
      });

      const cardCleanups = [
        ...gsap.utils.toArray<HTMLElement>(".education-card"),
        ...gsap.utils.toArray<HTMLElement>(".service-card"),
      ].map((card) => {
        // fromTo (not to) so the rest state is a fixed, known value — a
        // scroll-triggered entrance tween still in flight on this same card
        // can get overwritten mid-slide by a quick hover, and a relative
        // `.to()` would then reverse back to that leftover offset instead
        // of home, leaving the card stuck instead of bouncing back.
        const restShadow = getComputedStyle(card).boxShadow;
        const tl = gsap.timeline({
          paused: true,
          defaults: { duration: 0.3, ease: "power2.out" },
        });
        tl.fromTo(
          card,
          { y: 0, boxShadow: restShadow },
          { y: -6, boxShadow: "0 20px 40px -14px rgba(15,23,42,0.25)" },
        );

        const icon = card.querySelector<HTMLElement>(".card-icon");
        if (icon) {
          tl.fromTo(icon, { scale: 1 }, { scale: 1.12 }, 0);
        }

        const onEnter = () => tl.play();
        const onLeave = () => tl.reverse();
        card.addEventListener("mouseenter", onEnter);
        card.addEventListener("mouseleave", onLeave);
        return () => {
          card.removeEventListener("mouseenter", onEnter);
          card.removeEventListener("mouseleave", onLeave);
        };
      });

      return () => cardCleanups.forEach((cleanup) => cleanup());
    },
    { scope: sectionRef, dependencies: [introComplete] },
  );

  return (
    <section
      ref={sectionRef}
      className="bg-slate-50 px-4 pb-20 sm:px-6 sm:pb-24 lg:px-14 lg:pb-32"
    >
      <div className="mx-auto max-w-[1600px]">
        <div className="education-panel rounded-floating bg-sky p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div
              className={`education-heading ${introComplete ? "" : "opacity-0"}`}
            >
              <h2 className="font-display text-3xl font-bold text-navy sm:text-h3">
                Global Education
              </h2>
              <p className="mt-1 text-body text-slate-500">
                Top study destinations for international students
              </p>
            </div>
            <a
              href="#"
              className={`education-cta inline-flex shrink-0 items-center gap-1 self-end text-body font-semibold text-coral transition-colors hover:text-coral/80 sm:self-auto ${
                introComplete ? "" : "opacity-0"
              }`}
            >
              View All Programs
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="education-grid mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {DESTINATIONS.map((destination) => (
              <div
                key={destination.country}
                className={`education-card rounded-card bg-white p-5 shadow-card sm:p-6 ${
                  introComplete ? "" : "opacity-0"
                }`}
              >
                <div
                  className={`card-icon relative h-12 w-12 overflow-hidden rounded-full ${destination.iconBg}`}
                >
                  <Image
                    src={`https://flagcdn.com/w80/${destination.flagCode}.png`}
                    alt={`${destination.country} flag`}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <h3 className="mt-4 text-body-lg font-bold text-navy">
                  {destination.country}
                </h3>
                <p className="mt-2 text-caption text-slate-500">
                  {destination.description}
                </p>
                <button
                  type="button"
                  className="mt-5 w-full rounded-full border-2 border-navy px-6 py-2.5 text-body font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
                >
                  Apply Now
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="services-grid mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-3 sm:gap-5 lg:gap-6">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.label}
                className={`service-card rounded-card bg-sky p-6 ${
                  introComplete ? "" : "opacity-0"
                }`}
              >
                <Icon
                  className={`card-icon h-7 w-7 text-navy ${service.iconClassName}`}
                />
                <h3 className="mt-4 text-body-lg font-bold text-navy">
                  {service.label}
                </h3>
                <p className="mt-2 text-caption text-slate-500">
                  {service.description}
                </p>
                <a
                  href="#"
                  className="mt-4 inline-flex items-center gap-1 text-caption font-semibold text-coral transition-colors hover:text-coral/80"
                >
                  {service.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

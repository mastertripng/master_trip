"use client";

import { useRef } from "react";
import { BadgeCheck, Briefcase, MapPin, Star } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIntroComplete } from "./IntroTakeoff";

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    title: "Trustworthy",
    description:
      "Years of reliable service with thousands of satisfied clients globally.",
    icon: BadgeCheck,
  },
  {
    title: "Professional",
    description:
      "Dedicated team ensuring smooth processing of all travel and study needs.",
    icon: Briefcase,
  },
  {
    title: "Expert Advisory",
    description:
      "Specialized guidance for complex visa applications and university admissions.",
    icon: MapPin,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "MasterTrip made my UK study visa application completely stress-free. Their advisory team guided me through every single step.",
    initials: "SO",
    name: "Sarah O.",
    role: "MSc Student, UK",
  },
  {
    quote:
      "Booked a family tour to Dubai. The itinerary was perfectly planned, hotels were great, and flights were seamless.",
    initials: "JD",
    name: "John D.",
    role: "Leisure Traveler",
  },
];

export function WhyChooseUs() {
  const sectionRef = useRef<HTMLElement>(null);
  const introComplete = useIntroComplete();

  useGSAP(
    () => {
      if (!introComplete) return;

      const prefersReduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (prefersReduced) {
        gsap.set([".why-heading", ".feature-card", ".testimonial-card"], {
          y: 0,
          opacity: 1,
        });
        return;
      }

      gsap.from(".why-heading", {
        y: 24,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".why-heading",
          start: "top 85%",
        },
      });

      gsap.from(".feature-card", {
        y: 32,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: ".features-grid",
          start: "top 85%",
        },
      });

      gsap.from(".testimonial-card", {
        y: 36,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: ".testimonials-grid",
          start: "top 85%",
        },
      });
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
          className={`why-heading text-center ${
            introComplete ? "" : "opacity-0"
          }`}
        >
          <h2 className="font-display text-3xl font-bold text-navy sm:text-h3">
            Why Choose MasterTrip
          </h2>
        </div>

        <div className="features-grid mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6 lg:gap-8">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`feature-card flex flex-col items-center text-center ${
                  introComplete ? "" : "opacity-0"
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-coral text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-body-lg font-bold text-navy">
                  {feature.title}
                </h3>
                <p className="mt-2 max-w-xs text-caption text-slate-500">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-floating bg-navy px-6 py-12 text-center sm:mt-10 sm:px-10 sm:py-14 lg:py-16">
          <h2 className="font-display text-3xl font-bold text-white sm:text-h3">
            Success Stories
          </h2>
          <p className="mt-2 text-body text-slate-300">
            Hear from our recent clients and students
          </p>

          <div className="testimonials-grid mt-8 grid grid-cols-1 gap-5 text-left sm:mt-10 sm:grid-cols-2 sm:gap-6">
            {TESTIMONIALS.map((testimonial) => (
              <div
                key={testimonial.name}
                className={`testimonial-card rounded-card bg-white/5 p-6 ${
                  introComplete ? "" : "opacity-0"
                }`}
              >
                <div className="flex gap-1 text-amber">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber" />
                  ))}
                </div>
                <p className="mt-4 text-body text-slate-200">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-caption font-semibold text-white">
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="text-body font-semibold text-white">
                      {testimonial.name}
                    </p>
                    <p className="text-caption text-slate-400">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

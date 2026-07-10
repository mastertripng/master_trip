"use client";

import { useRef } from "react";
import Image from "next/image";
import { ArrowRight, Bot, MessageCircle } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIntroComplete } from "./IntroTakeoff";

gsap.registerPlugin(ScrollTrigger);

const ARTICLES = [
  {
    category: "Travel Tips",
    title: "How to find the cheapest international flights",
    description:
      "Learn our insider secrets for booking the best airfare deals.",
    image:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80",
  },
  {
    category: "Study Abroad",
    title: "Top 10 Universities in Canada for 2024",
    description:
      "A comprehensive guide to choosing the right Canadian institution.",
    image:
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80",
  },
  {
    category: "Visa Guide",
    title: "UK Student Visa Document Checklist",
    description:
      "Ensure your visa application is successful with this checklist.",
    image:
      "https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=800&q=80",
  },
];

export function TravelInsights() {
  const sectionRef = useRef<HTMLElement>(null);
  const introComplete = useIntroComplete();

  useGSAP(
    () => {
      if (!introComplete) return;

      const prefersReduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (prefersReduced) {
        gsap.set([".insights-heading", ".insight-card", ".help-panel"], {
          y: 0,
          opacity: 1,
        });
        return;
      }

      gsap.from(".insights-heading", {
        y: 24,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".insights-heading",
          start: "top 85%",
        },
      });

      gsap.from(".insight-card", {
        y: 36,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: ".insights-grid",
          start: "top 82%",
        },
      });

      gsap.from(".help-panel", {
        y: 24,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".help-panel",
          start: "top 88%",
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
          className={`insights-heading flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${
            introComplete ? "" : "opacity-0"
          }`}
        >
          <div>
            <h2 className="font-display text-3xl font-bold text-navy sm:text-h3">
              Travel Insights &amp; Guides
            </h2>
            <p className="mt-1 text-body text-slate-500">
              Latest news, tips, and updates
            </p>
          </div>
          <a
            href="#"
            className="inline-flex shrink-0 items-center gap-1 text-body font-semibold text-coral transition-colors hover:text-coral/80"
          >
            Read Blog
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="insights-grid mt-8 grid grid-cols-1 gap-6 sm:mt-10 sm:grid-cols-3 sm:gap-5 lg:gap-6">
          {ARTICLES.map((article) => (
            <div
              key={article.title}
              className={`insight-card ${introComplete ? "" : "opacity-0"}`}
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-image bg-slate-200">
                <Image
                  src={article.image}
                  alt={article.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <p className="mt-4 text-small font-bold uppercase tracking-wide text-coral">
                {article.category}
              </p>
              <h3 className="mt-1 text-body-lg font-bold text-navy">
                {article.title}
              </h3>
              <p className="mt-1 text-caption text-slate-500">
                {article.description}
              </p>
            </div>
          ))}
        </div>

        <div
          className={`help-panel mt-8 rounded-floating bg-sky p-6 sm:mt-10 sm:p-8 lg:p-10 ${
            introComplete ? "" : "opacity-0"
          }`}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-navy sm:text-h4">
                Need Help Planning?
              </h2>
              <p className="mt-2 max-w-md text-body text-slate-500">
                Our expert advisors and AI Assistant are available 24/7 to
                help you with bookings, visa applications, and study abroad
                queries.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:shrink-0">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-6 py-3 text-body font-semibold text-white transition-colors hover:bg-navy/90"
              >
                <Bot className="h-4 w-4" />
                Ask AI Assistant
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-body font-semibold text-white transition-colors hover:bg-[#20bd5c]"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Us
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

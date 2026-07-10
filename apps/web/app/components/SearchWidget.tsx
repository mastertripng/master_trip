"use client";

import { useRef, useState } from "react";
import {
  Plane,
  BedDouble,
  Compass,
  GraduationCap,
  Calendar,
  Search,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useIntroComplete } from "./IntroTakeoff";

const TABS = [
  { label: "Flights", icon: Plane },
  { label: "Hotels", icon: BedDouble },
  { label: "Tours", icon: Compass },
  { label: "Study Abroad", icon: GraduationCap },
] as const;

type TabLabel = (typeof TABS)[number]["label"];

function Field({
  label,
  icon,
  value,
  className = "",
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="whitespace-nowrap px-1 text-small font-medium text-slate-500">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-body text-slate-900">
        <span className="shrink-0 text-slate-400">{icon}</span>
        <span className="whitespace-nowrap font-medium">{value}</span>
      </div>
    </div>
  );
}

export function SearchWidget() {
  const [activeTab, setActiveTab] = useState<TabLabel>("Flights");
  const introComplete = useIntroComplete();
  const widgetRef = useRef<HTMLDivElement>(null);

  // The widget itself renders immediately (no blank gap right after the
  // intro), but its icons get a small lively pop once the view-transition
  // has finished, instead of just sitting there static.
  useGSAP(
    () => {
      if (!introComplete) return;

      const prefersReduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (prefersReduced) {
        gsap.set(".search-icon", { scale: 1, rotate: 0, opacity: 1 });
        return;
      }

      gsap.from(".search-icon", {
        scale: 0,
        rotate: -15,
        opacity: 0,
        duration: 0.6,
        ease: "back.out(1.7)",
        stagger: 0.06,
      });
    },
    { scope: widgetRef, dependencies: [introComplete] },
  );

  const searchLabel =
    activeTab === "Flights"
      ? "Search Flights"
      : activeTab === "Hotels"
        ? "Search Hotels"
        : activeTab === "Tours"
          ? "Search Tours"
          : "Search Programs";

  return (
    <div
      ref={widgetRef}
      className="w-full rounded-floating bg-white p-5 text-left shadow-floating sm:p-6 lg:p-7"
    >
      <div className="flex flex-wrap items-center gap-1.5 pb-4 sm:gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.label === activeTab;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveTab(tab.label)}
              className={`flex shrink-0 items-center gap-1.5 rounded-button px-2.5 py-2 text-caption font-semibold transition-colors sm:px-4 sm:text-body ${
                isActive
                  ? "bg-coral text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <Icon
                className={`search-icon h-4 w-4 shrink-0 ${
                  introComplete ? "" : "opacity-0"
                }`}
              />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:items-end lg:gap-4">
          <Field
            label="From"
            icon={
              <Plane
                className={`search-icon h-4 w-4 -rotate-45 ${
                  introComplete ? "" : "opacity-0"
                }`}
              />
            }
            value="Lagos (LOS)"
          />
          <Field
            label="To"
            icon={
              <Plane
                className={`search-icon h-4 w-4 rotate-45 ${
                  introComplete ? "" : "opacity-0"
                }`}
              />
            }
            value="London (LHR)"
          />
          <Field
            label="Dates"
            icon={
              <Calendar
                className={`search-icon h-4 w-4 ${
                  introComplete ? "" : "opacity-0"
                }`}
              />
            }
            value="Oct 15 - Oct 22"
          />
          <button
            type="button"
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-6 py-3.5 text-body font-semibold text-white shadow-button transition-colors hover:bg-primary-hover hover:shadow-button-hover active:bg-primary-active sm:col-span-3 lg:col-span-1 lg:px-8"
          >
            <Search
              className={`search-icon h-4 w-4 ${
                introComplete ? "" : "opacity-0"
              }`}
            />
            {searchLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

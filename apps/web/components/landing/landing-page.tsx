// apps/web/components/landing/landing-page.tsx
//
// The public landing page — shown to signed-out visitors. Signed-in users are
// sent straight to the dashboard's Create window.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, Check } from "lucide-react";

import { Logo, LogoMark } from "~/components/logo";
import { ScrollExperience } from "~/components/scroll-experience";
import { ThemeToggle } from "~/components/theme-toggle";
import { useUser } from "~/hooks/api/auth";
import {
  FeaturesSection,
  StepsSection,
  PricingSection,
  FaqSection,
  FinalCta,
  LandingFooter,
} from "./landing-sections";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const USE_CASES = [
  "Job applications",
  "Event RSVPs",
  "Bug reports",
  "Customer feedback",
  "Course enrollment",
  "IT requests",
  "Guestbooks",
];

const FEATURES = [
  "AI form builder",
  "Drag-and-drop list view",
  "Node canvas",
  "One question at a time",
  "Live preview",
  "Starter templates",
  "Light & dark",
  "Analytics & CSV export",
  "Google sign-in",
  "One shareable link",
];

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/70 bg-background/95 dark:bg-[#1C1B18]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Dockett home">
          <Logo size={22} />
        </Link>

        <nav aria-label="Landing" className="hidden items-center gap-5 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="mono-label text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="!size-8" />
          <Link
            href="/signin"
            className="mono-label flex h-8 items-center border border-foreground/70 px-3.5 transition-colors hover:bg-foreground hover:text-background"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="mono-label flex h-8 items-center bg-solid px-3.5 text-solid-foreground transition-opacity hover:opacity-85"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroTicket() {
  return (
    <div
      className="relative -rotate-[3deg] border border-foreground/80 bg-card shadow-[6px_6px_0_0_var(--hard-shadow)] transition-transform duration-300 hover:-rotate-1 motion-reduce:transition-none"
      aria-label="Example form ticket: Job Application"
    >
      <div className="grid grid-cols-[1fr_34%]">
        <div className="p-5 sm:p-6">
          <p className="mono-label-sm text-muted-foreground">Document DK-4721 · Type STD</p>
          <p className="font-display mt-2 text-[34px] leading-none font-extrabold text-primary sm:text-[40px]">
            Job Application
          </p>
          <p className="mono-label-sm mt-3 text-muted-foreground">Class A1 · 7 fields · ~2 min</p>
          <Link
            href="/signup"
            className="mono-label mt-4 inline-flex h-8 items-center gap-1.5 bg-solid px-3 text-solid-foreground transition-opacity hover:opacity-85"
          >
            Start <span aria-hidden="true">↵</span>
          </Link>
        </div>

        <div className="relative border-l border-dashed border-foreground/80 p-4 text-right sm:p-5">
          <span className="absolute -top-2 -left-2 size-4 rounded-full border border-foreground/80 bg-background [clip-path:inset(50%_0_0_0)]" />
          <span className="absolute -bottom-2 -left-2 size-4 rounded-full border border-foreground/80 bg-background [clip-path:inset(0_0_50%_0)]" />
          <p className="mono-label-sm text-muted-foreground">Admit one</p>
          <p className="numeral mt-1 text-[64px] sm:text-[80px]">07</p>
        </div>
      </div>
    </div>
  );
}

function MiniNode({
  label,
  title,
  className,
  tone = "paper",
}: {
  label: string;
  title: string;
  className: string;
  tone?: "paper" | "ember" | "outlined";
}) {
  const tones = {
    paper: "border border-foreground/70 bg-card",
    ember: "bg-primary text-primary-foreground",
    outlined: "border-2 border-primary bg-card",
  } as const;
  return (
    <div className={`absolute px-2 py-1.5 ${tones[tone]} ${className}`}>
      <p className="mono-label-sm text-[7px] opacity-70">{label}</p>
      <p className="text-[11px] leading-tight font-bold">{title}</p>
    </div>
  );
}

function HeroBuilder() {
  return (
    <div
      className="relative mt-8 border border-foreground/80 bg-card shadow-[6px_6px_0_0_var(--hard-shadow)]"
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 rounded-full border border-foreground/50" />
        ))}
        <span className="mono-label-sm ml-2 text-muted-foreground">Builder · Nodes</span>
      </div>
      <div className="dotgrid relative aspect-[300/140] w-full">
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 300 140"
          fill="none"
          preserveAspectRatio="none"
        >
          <g stroke="var(--primary)" strokeWidth="1.5">
            <path d="M90 38H114" />
            <path d="M192 38H216" />
            <path d="M255 56V87" />
            <path d="M216 105H192" />
            <path d="M114 105H90" />
          </g>
        </svg>
        <MiniNode
          label="Start"
          title="Form opens"
          tone="ember"
          className="top-[14%] left-[4%] w-[26%]"
        />
        <MiniNode label="Short text" title="Full name" className="top-[14%] left-[38%] w-[26%]" />
        <MiniNode label="Email" title="Email" className="top-[14%] left-[72%] w-[26%]" />
        <MiniNode label="End" title="Submit" tone="ember" className="top-[62%] left-[4%] w-[26%]" />
        <MiniNode label="Number" title="Years exp." className="top-[62%] left-[38%] w-[26%]" />
        <MiniNode
          label="Single-select"
          title="Employment"
          tone="outlined"
          className="top-[62%] left-[72%] w-[26%]"
        />
      </div>
      <span className="mono-label-sm absolute -right-2 -bottom-3 rotate-3 bg-primary px-3 py-2 text-primary-foreground shadow-[3px_3px_0_0_#171717] dark:shadow-[3px_3px_0_0_var(--ember)]">
        ✦ AI built this in seconds
      </span>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-foreground/70">
      <div className="mx-auto grid max-w-310 items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <div>
          <div className="mb-8 inline-grid grid-cols-[auto_auto_auto_auto] border border-foreground/70 bg-card text-left">
            {[
              ["Document", "DK-4721 · NOW ISSUING"],
              ["Type", "STD"],
              ["Zone", "07"],
              ["Seq", "23"],
            ].map(([l, v], i) => (
              <div
                key={l}
                className={`px-2.5 py-1.5 ${i > 0 ? "border-l border-foreground/40" : ""}`}
              >
                <div className="mono-label-sm text-muted-foreground">{l}</div>
                <div
                  className={`font-mono text-[10px] font-bold tracking-wide uppercase ${i === 0 ? "text-primary" : ""}`}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>

          <h1 className="font-display text-[clamp(64px,10.5vw,148px)] leading-[0.86] font-extrabold">
            Every
            <br />
            form, a
            <br />
            <span className="text-primary">ticket.</span>
          </h1>

          <p className="mt-7 max-w-[470px] text-[17px] leading-snug">
            Describe a form and Dockett builds it. Shape it on a canvas, publish with one click, and
            give people a one-question-at-a-time experience they actually finish.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="mono-label flex h-11 items-center gap-2 bg-primary px-5 text-primary-foreground transition-all hover:brightness-110 active:translate-y-px"
            >
              Start free — no card <ArrowRight className="size-3.5" />
            </Link>
            <a
              href="#how"
              className="mono-label flex h-11 items-center gap-2 border border-foreground/70 px-5 transition-colors hover:bg-foreground hover:text-background"
            >
              See how it works <ArrowDown className="size-3.5" />
            </a>
          </div>

          <ul className="mono-label-sm mt-5 flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
            {["Free plan", "Google sign-in", "CSV export"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-3 text-primary" aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto w-full max-w-[520px] lg:mx-0 lg:ml-auto">
          <HeroTicket />
          <HeroBuilder />
        </div>
      </div>
    </section>
  );
}

function Banner({
  items,
  label,
  reverse = false,
  tone = "paper",
}: {
  items: string[];
  label: string;
  /** false: scrolls left → right. true: right → left. */
  reverse?: boolean;
  tone?: "paper" | "ember";
}) {
  // Two identical groups; the track moves exactly one group's width, so the loop never jumps.
  const group = [...items, ...items];
  const ember = tone === "ember";
  return (
    <div
      className={`overflow-hidden border-b border-foreground/70 py-3 ${
        ember ? "bg-primary text-primary-foreground" : "bg-card"
      }`}
      role="marquee"
      aria-label={label}
    >
      <div
        className={`flex w-max will-change-transform hover:[animation-play-state:paused] ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        }`}
        aria-hidden="true"
      >
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0">
            {group.map((m, i) => (
              <span
                key={`${k}-${i}`}
                className={`mono-label flex items-center gap-5 pr-5 ${ember ? "text-[12px] font-bold" : ""}`}
              >
                <span className={ember ? "text-ink" : "text-primary"}>{ember ? "✦" : "●"}</span>
                {m}
              </span>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">{items.join(", ")}</span>
    </div>
  );
}

function Banners() {
  return (
    <>
      <Banner items={USE_CASES} label="Use Dockett for" />
      <Banner items={FEATURES} label="Dockett features" reverse tone="ember" />
    </>
  );
}

export function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [redirecting, setRedirecting] = useState(false);

  // Signed-in visitors never need the landing page.
  useEffect(() => {
    if (!isLoading && user?.id) {
      setRedirecting(true);
      router.replace("/dashboard");
    }
  }, [isLoading, user?.id, router]);

  if (redirecting) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-background"
        role="status"
        aria-label="Opening your dashboard"
      >
        <LogoMark size={44} className="animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <ScrollExperience>
      <div className="min-h-dvh bg-background text-foreground">
        <a
          href="#product"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-solid focus:px-3 focus:py-2 focus:text-solid-foreground"
        >
          Skip to content
        </a>
        <Nav />
        <main>
          <Hero />
          <Banners />
          <FeaturesSection />
          <StepsSection />
          <PricingSection />
          <FaqSection />
          <FinalCta />
        </main>
        <LandingFooter />
      </div>
    </ScrollExperience>
  );
}

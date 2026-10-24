"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowRight, ArrowUp, Check, Clock, Minus, Plus } from "lucide-react";

import { Logo } from "~/components/logo";
import { ContactSalesDialog } from "~/components/billing/contact-sales-dialog";

const wrap = "mx-auto max-w-[1240px] px-5 sm:px-8";

function SectionHead({ line1, line2, aside }: { line1: string; line2: string; aside: string }) {
  return (
    <div data-scroll-reveal className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <h2 className="font-display text-[clamp(44px,6.4vw,84px)] leading-[0.9] font-extrabold">
        {line1}
        <br />
        <span className="text-primary">{line2}</span>
      </h2>
      <p className="max-w-[300px] pb-2 text-sm text-muted-foreground">{aside}</p>
    </div>
  );
}

function FeatureCard({
  kicker,
  title,
  children,
  className = "",
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      data-scroll-reveal
      className={`flex flex-col border border-border bg-card p-5 sm:p-6 ${className}`}
    >
      <p className="mono-label-sm text-primary">{kicker}</p>
      <h3 className="font-display mt-2 text-[26px] leading-[1.02] font-extrabold sm:text-[30px]">
        {title}
      </h3>
      {children}
    </article>
  );
}

/* -------------------------------- features -------------------------------- */

function AiDemo() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const chips = ["Event RSVP", "Customer feedback", "Job application", "Course enrollment"];
  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        Type what you need. Dockett drafts fields, order and wording — then you edit every detail.
      </p>
      <div className="mt-4 flex items-center gap-2 border border-foreground/70 bg-background/40 p-1.5 pl-3 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && router.push("/signup")}
          placeholder='Try "Create a customer satisfaction survey"'
          aria-label="Describe a form"
          className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
        <Link
          href="/signup"
          aria-label="Create an account to generate this form"
          className="flex size-7 shrink-0 items-center justify-center bg-primary text-primary-foreground"
        >
          <ArrowUp className="size-3.5" />
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setPrompt(c)}
            className="mono-label-sm border border-foreground/50 px-2 py-1.5 transition-colors hover:bg-foreground hover:text-background"
          >
            {c}
          </button>
        ))}
      </div>
    </>
  );
}

function PacingDemo() {
  const [one, setOne] = useState(true);
  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">Or all at once. Switch pacing per form.</p>
      <div
        className="mt-4 grid grid-cols-2 border border-foreground/70 p-0.5"
        role="group"
        aria-label="Pacing demo"
      >
        {(
          [
            [true, "One at a time"],
            [false, "All at once"],
          ] as const
        ).map(([v, t]) => (
          <button
            key={t}
            type="button"
            aria-pressed={one === v}
            onClick={() => setOne(v)}
            className={`mono-label-sm py-2.5 transition-colors ${one === v ? "bg-solid text-solid-foreground" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4 h-1 bg-foreground/15">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: one ? "28.5%" : "100%" }}
        />
      </div>
      <p className="mono-label-sm mt-2 text-muted-foreground">
        {one ? "Question 2 of 7" : "All 7 questions on one page"}
      </p>
    </>
  );
}

function NodesDemo() {
  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        Connect fields as nodes, branch on answers, and see the whole journey at a glance.
      </p>
      <div className="mt-5 flex items-center" aria-hidden="true">
        <span className="flex h-12 w-[26%] items-center bg-primary px-3 text-sm font-bold text-primary-foreground">
          Start
        </span>
        <span className="h-0.5 w-5 bg-primary" />
        <span className="flex h-12 w-[26%] items-center border border-foreground/70 bg-card px-3 text-sm font-bold">
          Name
        </span>
        <span className="h-0.5 w-5 bg-primary" />
        <span className="flex h-12 flex-1 items-center justify-between border-2 border-primary bg-card px-3 text-sm font-bold">
          If Intern <ArrowRight className="size-3.5" />
        </span>
      </div>
    </>
  );
}

function AnalyticsDemo() {
  const bars = [14, 30, 22, 48, 36, 62, 78];
  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        Views, completion rate and a response timeline — export it all to CSV.
      </p>
      <div className="mt-3 flex items-end gap-3" aria-hidden="true">
        <span className="numeral text-[84px]">78%</span>
        <div className="flex h-[70px] flex-1 items-end gap-1.5 pb-1">
          {bars.map((h, i) => (
            <span key={i} className="flex-1 bg-primary" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <p className="mono-label-sm text-muted-foreground">Sample data</p>
    </>
  );
}

function ThemeDemo() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">Easy on the eyes, day or night.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(["light", "dark"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={resolvedTheme === t}
            className={`mono-label-sm flex h-10 items-center justify-center gap-2 border transition-colors ${
              resolvedTheme === t
                ? "border-primary text-primary"
                : "border-foreground/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`size-3 border border-foreground/60 ${t === "light" ? "bg-[#F4F1EA]" : "bg-[#1C1B18]"}`}
            />
            {t}
          </button>
        ))}
      </div>
    </>
  );
}

export function FeaturesSection() {
  return (
    <section id="product" className="scroll-mt-16 border-b border-foreground/70 py-16 sm:py-24">
      <div className={wrap}>
        <SectionHead
          line1="Issue it. Shape it."
          line2="Punch it live."
          aside="Everything between “I need a form” and “responses are in” — in one calm, ticket-simple workspace."
        />

        <div className="mt-10 grid gap-3.5 md:grid-cols-3">
          <FeatureCard
            kicker="01 · AI generate"
            title="Describe a form, and let AI build it."
            className="md:col-span-2"
          >
            <AiDemo />
          </FeatureCard>
          <FeatureCard kicker="02 · Pacing" title="One at a time.">
            <PacingDemo />
          </FeatureCard>

          <FeatureCard
            kicker="03 · Node builder"
            title="Build on a canvas."
            className="md:col-span-3 lg:col-span-1"
          >
            <NodesDemo />
          </FeatureCard>
          <FeatureCard kicker="04 · Analytics" title="Know what lands." className="md:col-span-2">
            <AnalyticsDemo />
          </FeatureCard>

          <FeatureCard kicker="05 · Templates" title={`Start from templates.`}>
            <p className="mt-2 text-sm text-muted-foreground">
              Job application, RSVP, bug report and more.
            </p>
          </FeatureCard>
          <FeatureCard kicker="06 · Share" title="One link.">
            <p className="mt-2 text-sm text-muted-foreground">
              Publish, share and collect — on any device.
            </p>
            <div className="mt-3 border border-foreground/50 bg-background/40 px-3 py-2 font-mono text-[11px]">
              dockett.app/f/job-application
            </div>
          </FeatureCard>
          <FeatureCard kicker="07 · Theme" title="Light & dark.">
            <ThemeDemo />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- steps ---------------------------------- */

export function StepsSection() {
  const steps = [
    ["01", "Issue", "Describe your form to AI, or pick a template and make it yours."],
    ["02", "Shape", "Drag fields onto the list or wire them up as nodes. Preview as you go."],
    [
      "03",
      "Punch live",
      "Publish the link, share it, and watch responses and completion rate roll in.",
    ],
  ];
  return (
    <section id="how" className="scroll-mt-16 border-b border-foreground/70 py-16 sm:py-24">
      <div className={wrap}>
        <SectionHead
          line1="Three steps."
          line2="Zero friction."
          aside="From blank page to live link, the same way every time."
        />
        <ol className="mt-10 grid gap-3.5 md:grid-cols-3">
          {steps.map(([n, t, d]) => (
            <li key={n} data-scroll-reveal className="border border-border bg-card p-5">
              <p className="mono-label-sm text-muted-foreground">Step</p>
              <p className="numeral text-[88px]">{n}</p>
              <div className="my-4 border-t border-dashed border-foreground/60" />
              <h3 className="font-display text-2xl font-extrabold">{t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------- pricing -------------------------------- */

// Mirrors packages/services/billing/plans.ts (public marketing copy).
const PLANS = [
  {
    key: "basic",
    kicker: "Basic",
    price: "$0",
    suffix: "/mo",
    blurb: "For trying things out and small projects.",
    features: [
      "Up to 5 active forms",
      "100 responses / form / month",
      "Standard themes",
      "Basic analytics",
      "Limited AI generations",
    ],
    soon: [] as string[],
    cta: "Start free",
    href: "/signup",
  },
  {
    key: "premium",
    kicker: "Most popular",
    price: "$5",
    suffix: "/mo",
    blurb: "For creators who need more room and more polish.",
    features: [
      "Up to 50 active forms",
      "1,000 responses / form / month",
      "Pro themes",
      "Advanced analytics",
      "Increased AI generations",
      "Conditional rendering",
      "Personal customization",
    ],
    cta: "Go Pro",
    href: "/signup",
  },
  {
    key: "business",
    kicker: "Business",
    price: "Custom",
    suffix: "",
    blurb: "For organizations with custom needs.",
    features: ["Unlimited everything", "Dedicated support", "On-demand integrations"],
    cta: "Contact sales",
    href: "",
  },
];

export function PricingSection() {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <section id="pricing" className="scroll-mt-16 border-b border-foreground/70 py-16 sm:py-24">
      <div className={wrap}>
        <div
          data-scroll-reveal
          className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4"
        >
          <h2 className="font-display text-[clamp(44px,6.4vw,84px)] leading-[0.9] font-extrabold">
            Pick your <span className="text-primary">class.</span>
          </h2>
          <p className="max-w-[300px] pb-2 text-sm text-muted-foreground">
            Start free. Upgrade when your forms outgrow it.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-5 md:grid-cols-3">
          {PLANS.map((p) => {
            const featured = p.key === "premium";
            return (
              <article
                key={p.key}
                data-scroll-reveal
                className={`flex flex-col bg-card p-6 ${
                  featured
                    ? "border-2 border-primary shadow-[6px_6px_0_0_var(--hard-shadow)] md:-translate-y-2"
                    : "border border-border"
                }`}
              >
                <p className="mono-label-sm text-muted-foreground">{p.kicker}</p>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-[56px] leading-none font-extrabold">
                    {p.price}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{p.suffix}</span>
                </p>
                {p.key === "premium" ? (
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                    Or $50/year, billed annually · save 17%
                  </p>
                ) : null}
                <p className="mt-2 min-h-[2.5rem] text-sm text-muted-foreground">{p.blurb}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                  {p.soon?.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Clock className="mt-0.5 size-3.5 shrink-0" /> {f} — coming soon
                    </li>
                  ))}
                </ul>
                {p.href ? (
                  <Link
                    href={p.href}
                    className={`mono-label mt-6 flex h-10 items-center justify-center gap-1.5 transition-all ${
                      featured
                        ? "bg-primary text-primary-foreground hover:brightness-110"
                        : "border border-foreground/70 hover:bg-foreground hover:text-background"
                    }`}
                  >
                    {p.cta} {featured ? <ArrowRight className="size-3.5" /> : null}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setContactOpen(true)}
                    className="mono-label mt-6 flex h-10 items-center justify-center border border-foreground/70 transition-colors hover:bg-foreground hover:text-background"
                  >
                    {p.cta}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
      <ContactSalesDialog open={contactOpen} onOpenChange={setContactOpen} />
    </section>
  );
}

/* ----------------------------------- faq ---------------------------------- */

const FAQ = [
  {
    q: "Is Dockett free?",
    a: "Yes. The Basic plan is free with up to 5 active forms and 100 responses per form each month. Upgrade any time.",
  },
  {
    q: "How does the AI builder work?",
    a: "Describe the form you need in plain words — “a job application with a portfolio link” — and Dockett drafts the fields, their order and the wording. You review the draft, tweak anything, and approve it. Basic includes limited AI generations; Pro raises the limit.",
  },
  {
    q: "What is the node builder?",
    a: "The Nodes view lays your form out as a flow on a canvas — Start, each question, Submit. Drag nodes to reorder them, click one to edit it, and see the whole journey at a glance. Prefer a simple list? Switch to List view any time; it's the same form.",
  },
  {
    q: "Can respondents answer one question at a time?",
    a: "Yes. Set the pacing per form: one question at a time, with a progress bar, or every field at once on a single page.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Export every response as a CSV from the Analytics page — one column per field, in your form's order.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-16 border-b border-foreground/70 py-16 sm:py-24">
      <div className="mx-auto max-w-[760px] px-5 sm:px-8">
        <h2
          data-scroll-reveal
          className="font-display text-[clamp(44px,6.4vw,84px)] leading-[0.9] font-extrabold"
        >
          Questions,
          <br />
          <span className="text-primary">answered.</span>
        </h2>
        <div className="mt-10 border-t border-foreground/70">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} data-scroll-reveal className="border-b border-foreground/30">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-bold"
                  >
                    {item.q}
                    {isOpen ? (
                      <Minus className="size-4 shrink-0 text-primary" />
                    ) : (
                      <Plus className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                </h3>
                <div
                  id={`faq-${i}`}
                  role="region"
                  hidden={!isOpen}
                  className="pb-4 text-sm text-muted-foreground"
                >
                  {item.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- final CTA -------------------------------- */

export function FinalCta() {
  return (
    <section className="py-16 sm:py-24">
      <div className={wrap}>
        <div
          data-scroll-reveal
          className="grid items-end gap-8 rounded-md bg-primary p-7 text-primary-foreground shadow-[8px_8px_0_0_var(--hard-shadow)] sm:p-12 lg:grid-cols-[1.4fr_1fr]"
        >
          <div>
            <p className="mono-label-sm opacity-90">Now boarding</p>
            <h2 className="font-display mt-3 text-[clamp(48px,7.5vw,104px)] leading-[0.9] font-extrabold">
              Issue your first form today.
            </h2>
          </div>
          <div>
            <p className="text-sm">Free plan. Sign in with Google. Published in a click.</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link
                href="/signup"
                className="mono-label flex h-11 items-center gap-2 bg-ink px-5 text-paper transition-opacity hover:opacity-85"
              >
                Start free <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/signup"
                className="mono-label flex h-11 items-center border border-white/80 px-5 transition-colors hover:bg-white hover:text-ink"
              >
                Browse templates
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- footer --------------------------------- */

export function LandingFooter() {
  const cols: { title: string; items: { label: string; href?: string }[] }[] = [
    {
      title: "Product",
      items: [
        { label: "Features", href: "#product" },
        { label: "Pricing", href: "#pricing" },
        { label: "How it works", href: "#how" },
      ],
    },
    {
      title: "Resources",
      items: [
        { label: "Templates", href: "/signup" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    {
      title: "Company",
      items: [
        { label: "About", href: "/about" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Contact us", href: "/contact" },
      ],
    },
  ];
  return (
    <footer className="border-t border-foreground/70 bg-card">
      <div className={`${wrap} grid gap-10 py-12 md:grid-cols-[1fr_auto]`}>
        <div>
          <Logo size={22} />
          <p className="mt-3 text-sm text-muted-foreground">Every form, a ticket.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3 sm:gap-x-16">
          {cols.map((c) => (
            <div key={c.title}>
              <p className="mono-label-sm text-muted-foreground">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.items.map((i) => (
                  <li key={i.label}>
                    {i.href?.startsWith("#") ? (
                      <a href={i.href} className="text-sm hover:text-primary">
                        {i.label}
                      </a>
                    ) : (
                      <Link href={i.href ?? "/"} className="text-sm hover:text-primary">
                        {i.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-dashed border-border">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-2 py-4`}>
          <span className="mono-label-sm text-muted-foreground">
            © {new Date().getFullYear()} dockett.
          </span>
          <span className="mono-label-sm text-muted-foreground">DK-4721 · STD · Zone 07</span>
        </div>
      </div>
    </footer>
  );
}

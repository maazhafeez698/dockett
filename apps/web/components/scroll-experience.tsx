"use client";

import { useEffect, useRef } from "react";

export function ScrollExperience({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = container.querySelectorAll<HTMLElement>("[data-scroll-reveal]");
    if (targets.length === 0) return;

    let observer: IntersectionObserver | null = null;
    const reveal = (target: HTMLElement) => {
      target.setAttribute("data-scroll-revealed", "");
      target.style.opacity = "1";
      target.style.transform = "translateY(0)";
      observer?.unobserve(target);
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) reveal(entry.target as HTMLElement);
          });
        },
        { threshold: 0, rootMargin: "0px 0px -8% 0px" },
      );
    }

    targets.forEach((target) => {
      target.style.opacity = "0";
      target.style.transform = "translateY(18px)";
      target.style.transition =
        "opacity 500ms ease, transform 500ms cubic-bezier(0.2, 0.7, 0.2, 1)";
      observer?.observe(target);
    });

    const revealVisibleSections = () => {
      const viewportHeight = window.innerHeight;
      targets.forEach((target) => {
        if (target.hasAttribute("data-scroll-revealed")) return;
        const bounds = target.getBoundingClientRect();
        if (bounds.top < viewportHeight * 0.92 && bounds.bottom > viewportHeight * 0.08) {
          reveal(target);
        }
      });
    };

    const revealFocusedSection = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const target = event.target.closest<HTMLElement>("[data-scroll-reveal]");
      if (target && container.contains(target)) reveal(target);
    };

    revealVisibleSections();
    window.addEventListener("scroll", revealVisibleSections, { passive: true });
    document.addEventListener("scroll", revealVisibleSections, { passive: true });
    window.addEventListener("resize", revealVisibleSections);
    container.addEventListener("focusin", revealFocusedSection);

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", revealVisibleSections);
      document.removeEventListener("scroll", revealVisibleSections);
      window.removeEventListener("resize", revealVisibleSections);
      container.removeEventListener("focusin", revealFocusedSection);
      targets.forEach((target) => {
        target.removeAttribute("data-scroll-revealed");
        target.style.removeProperty("opacity");
        target.style.removeProperty("transform");
        target.style.removeProperty("transition");
      });
    };
  }, []);

  return (
    <div ref={containerRef} className="scroll-experience-page">
      {children}
    </div>
  );
}

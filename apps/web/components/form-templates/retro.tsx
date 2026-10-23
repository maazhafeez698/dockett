// apps/web/components/form-templates/retro.tsx
//
// A beveled 90s-desktop window: title bar with minimize/maximize/close
// squares, inset/outset borders, a teal "desktop" backdrop behind the
// window. Deliberately chunky, low-radius, high-contrast — the opposite
// of the rest of the product's glassmorphism.

"use client";

import { CheckCircle2, Globe2, Home, RefreshCw, Shield, Star } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

const bevelOut = {
  borderStyle: "solid",
  borderWidth: 2,
  borderColor: "#ffffff #4d4d4d #4d4d4d #ffffff",
};
const bevelIn = {
  borderStyle: "solid",
  borderWidth: 2,
  borderColor: "#4d4d4d #ffffff #ffffff #4d4d4d",
};

export function RetroShell(props: FormTemplateShellProps) {
  const {
    title,
    description,
    visibleFields,
    values,
    onChange,
    missingFieldIds,
    layout,
    stepIndex,
    stepCount,
    isLastStep,
    onNext,
    onBack,
    onSubmit,
    submitting,
    submitted,
    errorMessage,
  } = props;

  const design = getTemplateDesign("RETRO", props.designSettings);

  return (
    <div
      className="mx-auto max-w-xl rounded-none p-1"
      style={{ background: "#008080", ...bevelOut }}
    >
      <div className="bg-[#C0C0C0] text-[#1B1B1B]" style={bevelOut}>
        {/* title bar */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#0A246A] to-[#A6CAF0] px-2 py-1">
          <span className="flex-1 truncate text-sm font-bold text-white select-none">
            {title || "Untitled"} — Guestbook
          </span>
          <span
            className="flex size-4 items-center justify-center bg-[#C0C0C0] text-[10px] font-bold"
            style={bevelOut}
          >
            _
          </span>
          <span
            className="flex size-4 items-center justify-center bg-[#C0C0C0] text-[10px] font-bold"
            style={bevelOut}
          >
            □
          </span>
          <span
            className="flex size-4 items-center justify-center bg-[#C0C0C0] text-[10px] font-bold"
            style={bevelOut}
          >
            ×
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-[#D5D5D5] px-2 py-1 text-[10px] text-[#242424]" style={bevelOut}>
          {["Back", "Forward", "Home", "Reload"].map((item, index) => {
            const Icon = [RefreshCw, Globe2, Home, RefreshCw][index]!;
            return <span key={item} className="inline-flex items-center gap-1 px-2 py-1"><Icon className="size-3" />{item}</span>;
          })}
          <span className="ml-2 flex min-w-0 flex-1 items-center gap-1 bg-white px-2 py-1 text-[#355E3B]" style={bevelIn}><Shield className="size-3 shrink-0" /> https://guestbook.dockett.site/sign</span>
        </div>

        <div className="p-4 sm:p-6">
          {description ? (
            <p className="mb-3 bg-white px-2 py-1 text-xs text-[#333]" style={bevelIn}>
              {description}
            </p>
          ) : null}

          <div className="mb-4 border-b-2 border-dotted border-[#9A9A9A] pb-3 text-center">
            <p className="font-mono text-[10px] tracking-[0.18em] text-[#0A246A]">✦ DIGITAL GUESTBOOK ✦</p>
            <h1 className="mt-1 font-serif text-xl font-bold text-[#0A246A]">{title || "Sign the guestbook"}</h1>
            <p className="mt-1 text-[11px] text-[#555]">Leave a little note. It’ll be kept here for a long time.</p>
          </div>

          {submitted ? (
            <div
              className="flex flex-col items-center gap-2 bg-white p-8 text-center"
              style={bevelIn}
            >
              <CheckCircle2 className="size-8 text-[#0A246A]" />
                <p className="text-sm font-bold text-[#0A246A]">Thanks for signing the guestbook!</p>
                <p className="text-xs text-[#555]">Your note has been added to the collection.</p>
            </div>
          ) : (
            <form data-submission-form onSubmit={onSubmit} noValidate className="space-y-4">
              {stepCount > 1 ? (
                <p className="text-[11px] font-bold text-[#0A246A]">
                  {layout === "ONE_AT_A_TIME"
                    ? `Entry ${stepIndex + 1} of ${stepCount}`
                    : `Page ${stepIndex + 1} of ${stepCount}`}
                </p>
              ) : null}

              <div className="space-y-3 bg-white p-3 sm:p-4" style={bevelIn}>
                {visibleFields.map((f) => (
                  <div key={f.id} className="[&_label]:text-[#0A246A] [&_label]:font-bold">
                    <FormFieldRenderer
                      field={f}
                      value={values[f.id] ?? ""}
                      onChange={(v) => onChange(f.id, v)}
                      isMissing={missingFieldIds.has(f.id)}
                      accent={design.accent}
                      fieldBackground={design.fieldBackground}
                      fieldForeground={design.fieldForeground}
                    />
                  </div>
                ))}
              </div>

              {errorMessage ? (
                <p
                  className="bg-[#FFFFCC] px-2 py-1 text-xs font-bold text-red-700"
                  style={bevelIn}
                >
                  ⚠ {errorMessage}
                </p>
              ) : null}
              {missingFieldIds.size > 0 ? (
                <p
                  className="bg-[#FFFFCC] px-2 py-1 text-xs font-bold text-red-700"
                  style={bevelIn}
                >
                  ⚠ Required fields missing.
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                {stepIndex > 0 ? (
                  <Button
                    type="button"
                    onClick={onBack}
                    className="rounded-none border-0 bg-[#C0C0C0] px-5 text-black hover:bg-[#C0C0C0]"
                    style={bevelOut}
                  >
                    &lt; Back
                  </Button>
                ) : null}
                {!isLastStep ? (
                  <Button
                    type="button"
                    onClick={onNext}
                    className="rounded-none border-0 bg-[#C0C0C0] px-5 text-black hover:bg-[#C0C0C0]"
                    style={bevelOut}
                  >
                    Next &gt;
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="rounded-none border-0 bg-[#C0C0C0] px-5 text-black hover:bg-[#C0C0C0]"
                    style={bevelOut}
                  >
                    {submitting ? "Saving..." : <><Star className="size-3.5" /> Sign guestbook</>}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

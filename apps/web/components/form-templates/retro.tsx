// apps/web/components/form-templates/retro.tsx
//
// A beveled 90s-desktop window: title bar with minimize/maximize/close
// squares, inset/outset borders, a teal "desktop" backdrop behind the
// window. Deliberately chunky, low-radius, high-contrast — the opposite
// of the rest of the product's glassmorphism.

"use client";

import { CheckCircle2 } from "lucide-react";
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
    fields,
    visibleFields,
    values,
    onChange,
    missingFieldIds,
    layout,
    stepIndex,
    isLastStep,
    onNext,
    onBack,
    onSubmit,
    submitting,
    submitted,
    errorMessage,
  } = props;

  const design = getTemplateDesign("RETRO");

  return (
    <div
      className="mx-auto max-w-xl rounded-none p-1"
      style={{ background: "#008080", ...bevelOut }}
    >
      <div className="bg-[#C0C0C0]" style={bevelOut}>
        {/* title bar */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#0A246A] to-[#A6CAF0] px-2 py-1">
          <span className="flex-1 truncate text-sm font-bold text-white select-none">
            {title || "Untitled"}.frm — Notepad
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

        <div className="p-4">
          {description ? (
            <p className="mb-3 bg-white px-2 py-1 text-xs text-[#333]" style={bevelIn}>
              {description}
            </p>
          ) : null}

          {submitted ? (
            <div
              className="flex flex-col items-center gap-2 bg-white p-8 text-center"
              style={bevelIn}
            >
              <CheckCircle2 className="size-8 text-[#0A246A]" />
              <p className="text-sm font-bold text-[#0A246A]">Entry saved to guestbook.exe</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {layout === "ONE_AT_A_TIME" && fields.length > 1 ? (
                <p className="text-[11px] font-bold text-[#0A246A]">
                  Entry {stepIndex + 1} of {fields.length}
                </p>
              ) : null}

              <div className="space-y-3 bg-white p-3" style={bevelIn}>
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
                {layout === "ONE_AT_A_TIME" && stepIndex > 0 ? (
                  <Button
                    type="button"
                    onClick={onBack}
                    className="rounded-none border-0 bg-[#C0C0C0] px-5 text-black hover:bg-[#C0C0C0]"
                    style={bevelOut}
                  >
                    &lt; Back
                  </Button>
                ) : null}
                {layout === "ONE_AT_A_TIME" && !isLastStep ? (
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
                    {submitting ? "Saving..." : "OK"}
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

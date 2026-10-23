// apps/web/components/form-templates/index.tsx
//
// Single dispatcher used by both the public fill page and the builder's
// live preview pane, so the two never drift apart.

import type { FormTemplateId } from "~/lib/template-designs";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";
import { ClassicShell } from "./classic";
import { CorporateShell } from "./corporate";
import { SurveyShell } from "./survey";
import { EducationShell } from "./education";
import { DeveloperShell } from "./developer";
import { RetroShell } from "./retro";
import { InvitationShell } from "./invitation";
import { TicketShell } from "./ticket";
import { LandingShell } from "./landing";

export type { FormTemplateShellProps } from "./types";

const SHELLS: Record<FormTemplateId, (props: FormTemplateShellProps) => React.ReactElement> = {
  CLASSIC: ClassicShell,
  CORPORATE: CorporateShell,
  SURVEY: SurveyShell,
  EDUCATION: EducationShell,
  DEVELOPER: DeveloperShell,
  RETRO: RetroShell,
  INVITATION: InvitationShell,
  TICKET: TicketShell,
  LANDING: LandingShell,
};

export function FormTemplateRenderer(
  props: FormTemplateShellProps & { template: string | null | undefined },
) {
  const Shell = SHELLS[(props.template as FormTemplateId) ?? "CLASSIC"] ?? ClassicShell;
  const design = getTemplateDesign(props.template, props.designSettings);
  return (
    <div
      className="template-frame"
      data-template-surface={props.designSettings?.surfaceMode ?? "LIGHT"}
      data-template-corners={props.designSettings?.corners ?? "DEFAULT"}
      data-template-typography={props.designSettings?.typography ?? "TEMPLATE"}
      style={{
        "--template-surface": design.surface,
        "--template-panel": design.panel ?? design.surface,
        "--template-foreground": design.foreground,
        "--template-muted": design.mutedForeground ?? design.foreground,
        "--template-border": design.border ?? "rgba(15, 23, 42, 0.16)",
        "--template-radius": design.cornerRadius,
        "--primary": design.accent,
        "--primary-foreground": design.accentForeground,
        "--template-accent": design.accent,
        fontFamily: design.fontFamily,
      } as React.CSSProperties}
    >
      <Shell {...props} />
    </div>
  );
}

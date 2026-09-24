// apps/web/components/form-templates/index.tsx
//
// Single dispatcher used by both the public fill page and the builder's
// live preview pane, so the two never drift apart.

import type { FormTemplateId } from "~/lib/template-designs";
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
  return <Shell {...props} />;
}

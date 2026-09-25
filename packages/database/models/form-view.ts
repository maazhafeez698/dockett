import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { formsTable } from "./form";

// One row per real page-load of a form's public fill page (recorded as a
// side effect of getFormAccessInfo — the one call that always fires exactly
// once per visit). Deliberately minimal — no IP, no session, just enough to
// power "Total Views" and a device breakdown. The form owner's own test
// visits count too, same limitation most lightweight analytics have.
export const formViewDeviceEnum = pgEnum("form_view_device_enum", [
  "DESKTOP",
  "MOBILE",
  "TABLET",
  "UNKNOWN",
]);

export const formViewsTable = pgTable("form_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  formId: uuid("form_id").references(() => formsTable.id, { onDelete: "cascade" }),
  device: formViewDeviceEnum("device").default("UNKNOWN").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

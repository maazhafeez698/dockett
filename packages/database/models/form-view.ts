import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { formsTable } from "./form";

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

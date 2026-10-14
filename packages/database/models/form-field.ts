import {
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { formsTable } from "./form";

// TEXT already covers "short text" — kept as-is rather than renamed to avoid
// a risky enum-value rename against existing data. LONG_TEXT, DATE, RATING,
// and the option-based types (DROPDOWN/MULTI_SELECT/CHECKBOX_GROUP) are new.
// PASSWORD is kept for now; it's retired in Phase 4 in favor of form-level
// password protection, not removed here.
export const fieldTypeEnum = pgEnum("field_type_enum", [
  "TEXT",
  "EMAIL",
  "NUMBER",
  "YES_NO",
  "PASSWORD",
  "LONG_TEXT",
  "DROPDOWN",
  "MULTI_SELECT",
  "CHECKBOX_GROUP",
  "DATE",
  "RATING",
  // Final field list: RADIO_GROUP (visible single choice) and FILE_UPLOAD (direct-to-storage
  // uploads, see packages/services/file-upload) were added. PASSWORD is no longer offered in the
  // builder but stays in the enum so existing forms keep working.
  "RADIO_GROUP",
  "FILE_UPLOAD",
]);

export const formFieldsTable = pgTable("form_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  formId: uuid("form_id").references(() => formsTable.id, { onDelete: "cascade" }),

  label: varchar("label", { length: 100 }).notNull(),
  labelKey: varchar("label_key", { length: 100 }).notNull(),

  description: text("description"),

  placeholder: text("placeholer"),
  isRequired: boolean("is_required").default(false).notNull(),

  // Type-specific settings — options list for DROPDOWN/MULTI_SELECT/
  // CHECKBOX_GROUP/RADIO_GROUP, max scale for RATING, maxLength for LONG_TEXT,
  // min/max/step for NUMBER, accept/maxFiles/maxSizeMB for FILE_UPLOAD. Null for
  // types that don't need configuration.
  config: jsonb("config"),

  index: numeric("index").notNull(),
  type: fieldTypeEnum("type").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

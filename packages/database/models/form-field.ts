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

  config: jsonb("config"),

  index: numeric("index").notNull(),
  type: fieldTypeEnum("type").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

// apps/web/lib/templates-data.ts
//
// 8 templates, each pairing a real field set for a real use case with a
// structurally distinct design (see components/form-templates/*) — not a
// recolor of one layout. `template` selects the design; `submissionLayout`
// is each template's sensible default pacing (the owner can still change
// either after "Use Template").

import type { FormTemplateId } from "./template-designs";

export type TemplateFieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "EMAIL"
  | "YES_NO"
  | "DROPDOWN"
  | "RADIO_GROUP"
  | "FILE_UPLOAD"
  | "MULTI_SELECT"
  | "CHECKBOX_GROUP"
  | "DATE"
  | "RATING";

export interface TemplateField {
  label: string;
  type: TemplateFieldType;
  isRequired?: boolean;
  placeholder?: string;
  description?: string;
  config?: { options?: string[]; max?: number };
}

export interface FormTemplate {
  id: string;
  name: string;
  template: FormTemplateId;
  description: string;
  submissionLayout: "ONE_AT_A_TIME" | "ALL_AT_ONCE";
  fields: TemplateField[];
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "corporate-job-application",
    name: "Job Application",
    template: "CORPORATE",
    description:
      "Formal candidate intake — role, experience, and portfolio, laid out like a real HR form.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Full name", type: "TEXT", isRequired: true },
      { label: "Email", type: "EMAIL", isRequired: true },
      { label: "Position applying for", type: "TEXT", isRequired: true },
      { label: "Years of experience", type: "NUMBER" },
      {
        label: "Employment type",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Full-time", "Part-time", "Contract", "Internship"] },
      },
      { label: "LinkedIn or portfolio URL", type: "TEXT", placeholder: "https://" },
      { label: "Why do you want to join us?", type: "LONG_TEXT", isRequired: true },
    ],
  },
  {
    id: "survey-customer-feedback",
    name: "Customer Feedback",
    template: "SURVEY",
    description: "Satisfaction and NPS-style pulse check, one focused question at a time.",
    submissionLayout: "ONE_AT_A_TIME",
    fields: [
      { label: "Overall satisfaction", type: "RATING", isRequired: true, config: { max: 5 } },
      {
        label: "How likely are you to recommend us to a friend?",
        type: "RATING",
        isRequired: true,
        config: { max: 10 },
      },
      { label: "What did you like most?", type: "LONG_TEXT" },
      { label: "What could we improve?", type: "LONG_TEXT" },
      { label: "Email (optional, for follow-up)", type: "EMAIL" },
    ],
  },
  {
    id: "education-course-enrollment",
    name: "Course Enrollment",
    template: "EDUCATION",
    description: "Student sign-up with schedule preference and prior experience level.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Student name", type: "TEXT", isRequired: true },
      { label: "Student email", type: "EMAIL", isRequired: true },
      {
        label: "Course",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Introduction", "Intermediate", "Advanced"] },
      },
      {
        label: "Preferred schedule",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Weekday mornings", "Weekday evenings", "Weekends"] },
      },
      { label: "Prior experience level", type: "RATING", config: { max: 5 } },
      { label: "Anything else we should know?", type: "LONG_TEXT" },
    ],
  },
  {
    id: "developer-bug-report",
    name: "Bug Report",
    template: "DEVELOPER",
    description: "Structured bug intake — environment, severity, repro steps, and logs.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "reporter", type: "TEXT", isRequired: true },
      {
        label: "environment",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["production", "staging", "local"] },
      },
      {
        label: "severity",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["critical", "high", "medium", "low"] },
      },
      { label: "steps_to_reproduce", type: "LONG_TEXT", isRequired: true },
      { label: "expected_vs_actual", type: "LONG_TEXT", isRequired: true },
      {
        label: "stack_trace",
        type: "LONG_TEXT",
        placeholder: "// paste logs here",
      },
    ],
  },
  {
    id: "retro-guestbook",
    name: "Retro Guestbook",
    template: "RETRO",
    description: "A playful, nostalgic guestbook — sign in and leave a message.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Your name", type: "TEXT", isRequired: true },
      { label: "Your website", type: "TEXT", placeholder: "https://" },
      { label: "Message", type: "LONG_TEXT", isRequired: true },
      { label: "Mood", type: "DROPDOWN", config: { options: [":)", ":(", ":P", "<3"] } },
      { label: "I promise to be nice", type: "YES_NO" },
    ],
  },
  {
    id: "invitation-party-rsvp",
    name: "Wedding / Party RSVP",
    template: "INVITATION",
    description: "Elegant guest RSVP with meal choice and a message for the hosts.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Guest name", type: "TEXT", isRequired: true },
      { label: "Will you attend?", type: "YES_NO", isRequired: true },
      {
        label: "Meal choice",
        type: "DROPDOWN",
        config: { options: ["Chicken", "Fish", "Vegetarian", "Vegan"] },
      },
      { label: "Number of guests", type: "NUMBER" },
      { label: "Message for the couple", type: "LONG_TEXT" },
    ],
  },
  {
    id: "ticket-it-support",
    name: "IT Support Request",
    template: "TICKET",
    description: "Internal ticket intake with department, category, and priority.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Requester name", type: "TEXT", isRequired: true },
      {
        label: "Department",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Engineering", "Sales", "Marketing", "Operations", "Other"] },
      },
      {
        label: "Issue category",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Hardware", "Software", "Network", "Account Access", "Other"] },
      },
      {
        label: "Priority",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Low", "Medium", "High", "Critical"] },
      },
      { label: "Description", type: "LONG_TEXT", isRequired: true },
    ],
  },
  {
    id: "landing-waitlist-signup",
    name: "Newsletter / Waitlist",
    template: "LANDING",
    description: "Lightweight lead capture with interest tags — one field per screen to convert.",
    submissionLayout: "ONE_AT_A_TIME",
    fields: [
      { label: "Name", type: "TEXT", isRequired: true },
      { label: "Email", type: "EMAIL", isRequired: true },
      {
        label: "How did you hear about us?",
        type: "DROPDOWN",
        config: { options: ["Search", "Social media", "Friend", "Other"] },
      },
      {
        label: "Interested features",
        type: "MULTI_SELECT",
        config: { options: ["Early access", "Beta testing", "Product updates", "Community"] },
      },
    ],
  },
];

export function getTemplateById(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.id === id);
}

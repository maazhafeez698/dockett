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
  config?: { options?: string[]; max?: number; minValue?: number; maxValue?: number; step?: number };
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
      "A clear, respectful application that gathers the essentials without making candidates repeat themselves.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Full name", type: "TEXT", isRequired: true },
      { label: "Email address", type: "EMAIL", isRequired: true, description: "We’ll use this for updates about your application." },
      { label: "Role you’re applying for", type: "TEXT", isRequired: true },
      { label: "Current role or organization", type: "TEXT" },
      { label: "Years of relevant experience", type: "NUMBER", config: { minValue: 0, maxValue: 60, step: 1 } },
      {
        label: "Employment type",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Full-time", "Part-time", "Contract", "Internship"] },
      },
      { label: "Portfolio or LinkedIn", type: "TEXT", placeholder: "https://" },
      { label: "What interests you about this role?", type: "LONG_TEXT", isRequired: true, description: "A few specific sentences are plenty." },
    ],
  },
  {
    id: "survey-customer-feedback",
    name: "Customer Feedback",
    template: "SURVEY",
    description: "A short, considerate check-in to learn what’s working and where to improve.",
    submissionLayout: "ONE_AT_A_TIME",
    fields: [
      { label: "How satisfied are you with your experience?", type: "RATING", isRequired: true, config: { max: 5 }, description: "1 means not satisfied; 5 means very satisfied." },
      {
        label: "How likely are you to recommend us to a friend?",
        type: "RATING",
        isRequired: true,
        config: { max: 10 },
      },
      { label: "What’s one thing we did well?", type: "LONG_TEXT" },
      { label: "What should we improve next?", type: "LONG_TEXT" },
      { label: "Email (optional, for follow-up)", type: "EMAIL" },
    ],
  },
  {
    id: "education-course-enrollment",
    name: "Course Enrollment",
    template: "EDUCATION",
    description: "Help us place you in the right course and find a schedule that works.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Student name", type: "TEXT", isRequired: true },
      { label: "Student email", type: "EMAIL", isRequired: true },
      {
        label: "Which course are you interested in?",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Introduction", "Intermediate", "Advanced"] },
      },
      {
        label: "Preferred class schedule",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Weekday mornings", "Weekday evenings", "Weekends"] },
      },
      { label: "How familiar are you with this subject?", type: "RATING", config: { max: 5 } },
      { label: "What would you like to be able to do after this course?", type: "LONG_TEXT" },
    ],
  },
  {
    id: "developer-bug-report",
    name: "Bug Report",
    template: "DEVELOPER",
    description: "Give the engineering team a reliable path to reproduce and diagnose the issue.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Your name or team", type: "TEXT", isRequired: true },
      {
        label: "Where did the issue happen?",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Production", "Staging", "Local development", "Other"] },
      },
      {
        label: "How much does this affect your work?",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Blocks my work", "Major issue", "Minor issue", "Cosmetic"] },
      },
      { label: "Steps to reproduce", type: "LONG_TEXT", isRequired: true, description: "Start from a fresh page and list each action in order." },
      { label: "What did you expect to happen?", type: "LONG_TEXT", isRequired: true },
      { label: "What happened instead?", type: "LONG_TEXT", isRequired: true },
      { label: "Browser, device, or app version", type: "TEXT", placeholder: "e.g. Chrome 129 on Windows 11" },
      { label: "Error message or relevant logs", type: "LONG_TEXT", placeholder: "Paste a short, redacted excerpt if available." },
    ],
  },
  {
    id: "retro-guestbook",
    name: "Retro Guestbook",
    template: "RETRO",
    description: "You found the guestbook. Leave a note for the hosts and make yourself at home.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Your name", type: "TEXT", isRequired: true },
      { label: "Where are you visiting from?", type: "TEXT" },
      { label: "Your little corner of the web", type: "TEXT", placeholder: "https://" },
      { label: "Leave a message", type: "LONG_TEXT", isRequired: true, description: "A greeting, a memory, a recommendation — anything kind." },
      { label: "Pick your guestbook mood", type: "DROPDOWN", config: { options: [":) Happy", "<3 Love this", ":P Playful", "^_^ Cozy"] } },
      { label: "May we keep your note in the guestbook?", type: "YES_NO", isRequired: true },
    ],
  },
  {
    id: "invitation-party-rsvp",
    name: "Wedding / Party RSVP",
    template: "INVITATION",
    description: "Please reply for each guest in your party so we can prepare for your visit.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Your name", type: "TEXT", isRequired: true },
      { label: "Will you join us?", type: "YES_NO", isRequired: true },
      {
        label: "Meal choice",
        type: "DROPDOWN",
        config: { options: ["Herb-roasted chicken", "Seasonal fish", "Vegetarian", "Vegan"] },
      },
      { label: "How many guests are in your party?", type: "NUMBER", config: { minValue: 1, maxValue: 8, step: 1 } },
      { label: "Dietary needs or accessibility requests", type: "LONG_TEXT" },
      { label: "A note for the hosts", type: "LONG_TEXT" },
    ],
  },
  {
    id: "ticket-it-support",
    name: "IT Support Request",
    template: "TICKET",
    description: "Tell the service desk what’s affected and how to reach you. Please avoid sharing passwords.",
    submissionLayout: "ALL_AT_ONCE",
    fields: [
      { label: "Requester name", type: "TEXT", isRequired: true },
      { label: "Work email", type: "EMAIL", isRequired: true },
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
        label: "How urgent is this?",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Routine — when convenient", "Soon — work is slowed", "Urgent — work is blocked", "Critical — team-wide impact"] },
      },
      { label: "Who or what is affected?", type: "TEXT", placeholder: "Just me, my team, a shared system…" },
      { label: "Describe the issue", type: "LONG_TEXT", isRequired: true, description: "Include the steps you took and any exact error message." },
      { label: "When did it start?", type: "TEXT", placeholder: "Today around 10:30 AM" },
    ],
  },
  {
    id: "landing-waitlist-signup",
    name: "Newsletter / Waitlist",
    template: "LANDING",
    description: "One useful email each week. Pick what you care about and change your mind any time.",
    submissionLayout: "ONE_AT_A_TIME",
    fields: [
      { label: "What should we call you?", type: "TEXT" },
      { label: "Where should the newsletter land?", type: "EMAIL", isRequired: true },
      {
        label: "What brought you here?",
        type: "DROPDOWN",
        config: { options: ["A friend", "Search", "Social media", "Another newsletter", "Other"] },
      },
      {
        label: "What would you like to read about?",
        type: "MULTI_SELECT",
        config: { options: ["Product ideas", "Design", "Engineering", "Founder notes", "Community"] },
      },
      { label: "How often should we write?", type: "DROPDOWN", config: { options: ["Weekly highlights", "Only the big updates"] } },
    ],
  },
];

export function getTemplateById(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.id === id);
}

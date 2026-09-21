// apps/web/lib/templates-data.ts
//
// Each template is a real, distinct field set for a real use case — not
// the same 3 fields recolored. "theme" picks a sensible default from the
// existing 5 presets; the differentiation that matters is the structure.

export type TemplateFieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "EMAIL"
  | "YES_NO"
  | "DROPDOWN"
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
  category: string;
  description: string;
  theme: "MIDNIGHT" | "CORAL" | "MINT" | "LAVENDER" | "OCEAN";
  fields: TemplateField[];
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "customer-feedback",
    name: "Customer Feedback",
    category: "Professional",
    description: "Satisfaction, praise, and improvement areas from real customers.",
    theme: "OCEAN",
    fields: [
      { label: "Name", type: "TEXT", isRequired: true },
      { label: "Email", type: "EMAIL", isRequired: true },
      { label: "Overall satisfaction", type: "RATING", isRequired: true, config: { max: 5 } },
      { label: "What did you like most?", type: "LONG_TEXT" },
      { label: "What could we improve?", type: "LONG_TEXT" },
      { label: "Would you recommend us to others?", type: "YES_NO", isRequired: true },
    ],
  },
  {
    id: "job-application",
    name: "Job Application",
    category: "Professional",
    description: "Candidate intake with role, experience, and portfolio links.",
    theme: "MIDNIGHT",
    fields: [
      { label: "Full name", type: "TEXT", isRequired: true },
      { label: "Email", type: "EMAIL", isRequired: true },
      { label: "Position applying for", type: "TEXT", isRequired: true },
      { label: "Years of experience", type: "NUMBER" },
      { label: "LinkedIn or portfolio URL", type: "TEXT" },
      { label: "Why do you want to join us?", type: "LONG_TEXT", isRequired: true },
    ],
  },
  {
    id: "event-rsvp",
    name: "Event RSVP",
    category: "Team & Collaboration",
    description: "Attendance, guest count, and dietary needs for an event.",
    theme: "CORAL",
    fields: [
      { label: "Full name", type: "TEXT", isRequired: true },
      { label: "Email", type: "EMAIL", isRequired: true },
      { label: "Will you attend?", type: "YES_NO", isRequired: true },
      { label: "Number of guests", type: "NUMBER" },
      { label: "Dietary restrictions", type: "LONG_TEXT" },
    ],
  },
  {
    id: "team-retro",
    name: "Team Retrospective",
    category: "Team & Collaboration",
    description: "What went well, what didn't, and action items for next sprint.",
    theme: "OCEAN",
    fields: [
      { label: "Your name", type: "TEXT", isRequired: true },
      { label: "What went well?", type: "LONG_TEXT", isRequired: true },
      { label: "What didn't go well?", type: "LONG_TEXT", isRequired: true },
      { label: "Action items for next sprint", type: "LONG_TEXT" },
      { label: "Overall sprint rating", type: "RATING", config: { max: 5 } },
    ],
  },
  {
    id: "it-support-request",
    name: "IT Support Request",
    category: "Team & Collaboration",
    description: "Internal ticket intake with category, priority, and description.",
    theme: "MIDNIGHT",
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
    id: "course-enrollment",
    name: "Course Enrollment",
    category: "Education",
    description: "Student sign-up for a course, with schedule and experience level.",
    theme: "MINT",
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
    ],
  },
  {
    id: "lecture-feedback",
    name: "Lecture Feedback",
    category: "Education",
    description: "Post-lecture pulse check on clarity, pace, and unclear topics.",
    theme: "LAVENDER",
    fields: [
      { label: "Student name", type: "TEXT" },
      {
        label: "Which topics were unclear?",
        type: "CHECKBOX_GROUP",
        config: { options: ["Topic 1", "Topic 2", "Topic 3"] },
      },
      { label: "Rate the lecture pace", type: "RATING", isRequired: true, config: { max: 5 } },
      { label: "Additional comments", type: "LONG_TEXT" },
    ],
  },
  {
    id: "bug-report",
    name: "Bug Report",
    category: "Developer",
    description: "Structured bug intake — environment, severity, repro steps, logs.",
    theme: "MIDNIGHT",
    fields: [
      { label: "Reporter", type: "TEXT", isRequired: true },
      {
        label: "Environment",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Production", "Staging", "Local"] },
      },
      {
        label: "Severity",
        type: "DROPDOWN",
        isRequired: true,
        config: { options: ["Critical", "High", "Medium", "Low"] },
      },
      { label: "Steps to reproduce", type: "LONG_TEXT", isRequired: true },
      { label: "Expected vs actual behavior", type: "LONG_TEXT", isRequired: true },
      {
        label: "Log output / stack trace",
        type: "LONG_TEXT",
        placeholder: "Paste relevant logs here",
      },
    ],
  },
  {
    id: "feature-request",
    name: "Feature Request",
    category: "Developer",
    description: "Problem, proposed solution, and priority — console-style intake.",
    theme: "MIDNIGHT",
    fields: [
      { label: "Submitted by", type: "TEXT", isRequired: true },
      { label: "Feature title", type: "TEXT", isRequired: true },
      { label: "Problem it solves", type: "LONG_TEXT", isRequired: true },
      { label: "Proposed solution", type: "LONG_TEXT" },
      { label: "Priority", type: "RATING", config: { max: 5 } },
    ],
  },
  {
    id: "retro-guestbook",
    name: "Retro Guestbook",
    category: "Retro",
    description: "A playful, nostalgic guestbook — sign in and leave a message.",
    theme: "LAVENDER",
    fields: [
      { label: "Your name", type: "TEXT", isRequired: true },
      { label: "Your website", type: "TEXT", placeholder: "https://" },
      { label: "Message", type: "LONG_TEXT", isRequired: true },
      { label: "Mood", type: "DROPDOWN", config: { options: [":)", ":(", ":P", "<3"] } },
      { label: "I promise to be nice", type: "YES_NO" },
    ],
  },
  {
    id: "party-rsvp",
    name: "Wedding / Party RSVP",
    category: "Lifestyle",
    description: "Guest RSVP with meal choice and a message for the hosts.",
    theme: "CORAL",
    fields: [
      { label: "Guest name", type: "TEXT", isRequired: true },
      { label: "Will you attend?", type: "YES_NO", isRequired: true },
      {
        label: "Meal choice",
        type: "DROPDOWN",
        config: { options: ["Chicken", "Fish", "Vegetarian", "Vegan"] },
      },
      { label: "Song request", type: "TEXT" },
      { label: "Message for the couple", type: "LONG_TEXT" },
    ],
  },
  {
    id: "waitlist-signup",
    name: "Newsletter / Waitlist",
    category: "Marketing",
    description: "Lightweight lead capture with interest tags.",
    theme: "MINT",
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

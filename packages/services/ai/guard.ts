export type GuardKind = "GREETING" | "OFF_TOPIC" | "INJECTION";

export interface GuardResult {
  kind: GuardKind;
  reply: string;
  // Off-topic and jailbreak attempts count toward the cool-down; greetings don't.
  strike: boolean;
}

const FORM_WORDS =
  /\b(forms?|survey|surveys|questionnaire|quiz|quizzes|poll|polls|feedback|rsvp|registration|register|sign[- ]?ups?|signups?|application|apply|intake|checklist|waitlist|booking|order form|contact us|fields?|questions?|enrol(?:l)?ment|evaluation|assessment|invitation|ticket|reservation|appointment|subscribe|newsletter)\b/i;

const INJECTION =
  /(ignore|disregard|forget|override|bypass)\s+(all\s+|any\s+|your\s+|the\s+|these\s+|previous\s+|prior\s+|above\s+|earlier\s+)*(instructions?|rules?|prompts?|guidelines?|restrictions?|system)|(reveal|show|print|repeat|tell me|leak)\s+(me\s+)?(your\s+|the\s+)?(system\s+)?(prompt|instructions|rules)|system\s*prompt|jailbreak|developer\s+mode|you\s+are\s+now\s+(?!building|making)|pretend\s+(to\s+be|you(?:'| a)?re)|act\s+as\s+(?:if\s+you\s+(?:are|were)\s+)?(?:an?\s+)?(?:unrestricted|unfiltered|evil|different|my)/i;

// Case-sensitive on purpose: "DAN" the jailbreak, not "Dan" the guest on an RSVP list.
const DAN = /\bDAN\b/;

const OFF_TOPIC_NOUNS =
  /\b(poem|poetry|essay|joke|jokes|lyrics|haiku|recipe|horoscope|homework|equation|calculus|algebra|python|javascript|typescript|golang|sql|regex|bitcoin|crypto|translate|translation|summari[sz]e|trivia|debug|algorithm|capital of)\b/i;

const GREETING =
  /^\s*(?:hi+|hii+|hello+|hey+|heya|hiya|yo+|sup|hola|howdy|namaste|salam|assalam(?:u)?\s*alaikum|good\s+(?:morning|afternoon|evening)|thanks?|thank\s+you|ty|ok(?:ay)?|cool|nice|great|test(?:ing)?)(?:\s+(?:there|bro|dude|man|buddy|friend|mate|guys|everyone|again|so\s+much))?[\s!.,?😊👋🙂🙏]*$/i;

const GREETING_REPLIES = [
  "Hey there! 👋 I'm here to build forms — tell me what you need and who'll be filling it in.",
  "Hi! Ready when you are. What kind of form are we making today?",
  "Hello! Got a form in mind? A survey, sign-up, application… describe it and I'll sketch it out.",
  "Hey! Give me a form idea — even a rough one like \"workshop sign-up\" — and I'll take it from there.",
  "Hi there! Fun fact: I'm happiest when somebody says \"feedback form for…\". What are we building?",
];

const OFF_TOPIC_REPLIES = [
  "Ha — nice try, but I'd just be wasting your time and my tokens 😄 I only build forms. What kind of form do you need?",
  "Tempting, but forms are my whole personality 📝 Don't waste your time (or my tokens!) — what form shall we make?",
  "That's a bit outside my lane — I'm strictly a form builder 😄 Come to the point: what form do you want?",
  "I'd love to help, but I'm a one-trick pony and the trick is forms 🐴 What are we building?",
  "Plot twist: I only do forms. Tell me what the form is for and I'll get cracking!",
  "Wrong department! 😄 Form questions only here — describe the form you need and I'm all yours.",
];

const INJECTION_REPLIES = [
  "Nice try 😄 My rules stay put — but I'll happily build you a form. What's it for?",
  "Ooh, sneaky! Still not budging though. Got a form you need? That I can do.",
  "Cute. 😎 I'm only here for forms — what would you like to build?",
];

function pick<T>(items: T[], seed: string): T {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  return items[Math.abs(h) % items.length]!;
}

export function preScreen(prompt: string): GuardResult | null {
  const text = prompt.trim();
  if (!text) return null;

  if (GREETING.test(text) && text.split(/\s+/).length <= 5) {
    return { kind: "GREETING", reply: pick(GREETING_REPLIES, text), strike: false };
  }

  // A real form word means "probably legitimate" - let the model decide the details.
  const looksLikeForm = FORM_WORDS.test(text);

  if (INJECTION.test(text) || DAN.test(text)) {
    return { kind: "INJECTION", reply: pick(INJECTION_REPLIES, text), strike: true };
  }

  if (!looksLikeForm) {
    const fenced = text.includes("```");
    if (fenced || OFF_TOPIC_NOUNS.test(text)) {
      return { kind: "OFF_TOPIC", reply: pick(OFF_TOPIC_REPLIES, text), strike: true };
    }
  }

  return null;
}

export const COOLDOWN_REPLY =
  "Okay, I admire the persistence 😄 but I only do forms. Take a short breather, then come back with a form idea and we'll get going!";

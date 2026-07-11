export const TRANSCRIPT_NORMALIZATIONS = [
  [/[’']/g, ""],
  [/\bmeet\s+joe?s\b/g, "meet joz"],
  [/\bmeet\s+jose\b/g, "meet joz"],
  [/\bmeet\s+joes\b/g, "meet joz"],
  [/\bmeet\s+joze\b/g, "meet joz"],
  [/\bmeet\s+joas\b/g, "meet joz"],
  [/\bmeet\s+jaws\b/g, "meet joz"],
  [/\bmeet\s+jawz\b/g, "meet joz"],
  [/\bmeej\s+joe\b/g, "meet joz"],
  [/\bmeej\s+joz\b/g, "meet joz"],
  [/\bneo\s+meet\s+joe?s\b/g, "neo meet joz"],
  [/\bneo\s+meet\s+jose\b/g, "neo meet joz"],
  [/\bneo\s+meet\s+jaws\b/g, "neo meet joz"],
  [/\bneo\s+meej\s+joz\b/g, "neo meet joz"],
  [/\btalk\s+to\s+joe\b/g, "talk to joz"],
  [/\btalk\s+to\s+jose\b/g, "talk to joz"],
  [/\btalk\s+to\s+jaws\b/g, "talk to joz"],
  [/\btalk\s+to\s+joseph?\b/g, "talk to joz"],
  [/\bopen\s+meet\s+joe\b/g, "open meet joz"],
  [/\bopen\s+meet\s+jaws\b/g, "open meet joz"],
  [/\bjoe?s\b/g, "joz"],
  [/\bjose\b/g, "joz"],
  [/\bjoes\b/g, "joz"],
  [/\bflax\b/g, "flex"],
  [/\bflecks\b/g, "flex"],
  [/\bflux\b/g, "flex"],
  [/\bplex\b/g, "flex"],
  [/\bmogs\b/g, "mogg"],
  [/\bascent\b/g, "ascend"],
  [/\baccent\b/g, "ascend"],
  [/\ba\s+send\b/g, "ascend"],
  [/\bsend\b/g, "ascend"],
  [/\boffend\b/g, "ascend"],
  [/\bmark\b/g, "mogg"],
  [/\bmug\b/g, "mogg"],
  [/\bmocha\b/g, "mogg"],
  [/\bmoch\b/g, "mogg"],
  [/\bmog\b/g, "mogg"],
  [/\bthe max\b/g, "maxx"],
  [/\bmax\b/g, "maxx"],
  [/\bspace max\b/g, "space maxx"],
  [/\bspace maxx\b/g, "space maxx"],
  [/\bworld max\b/g, "world maxx"],
  [/\bview maxx in space\b/g, "view in space maxx"],
  [/\bbrain portal\b/g, "brain"],
  [/\bneuron portal\b/g, "brain"],
  [/\bneurons portal\b/g, "brain"],
  [/\benter the neurons\b/g, "enter the brain"],
  [/\bentered the neurons\b/g, "enter the brain"],
  [/\binside the neurons\b/g, "inside the brain"],
  [/\bopen the neurons\b/g, "open the brain"],
  [/\bentered\s+the\s+brain\b/g, "enter the brain"],
  [/\bentered\s+brain\b/g, "enter the brain"],
  [/\binside brain\b/g, "inside the brain"],
  [/\s+/g, " "],
];

export const ROOT_BRAIN_PHRASES = [
  "why",
  "enter",
  "explore",
  "go inside",
  "step inside",
  "open portal",
  "open the portal",
  "open maxx",
  "enter maxx",
  "enter the brain",
  "enter the neurons",
  "go inside the brain",
  "go inside the neurons",
  "go inside mind",
  "open the brain",
  "open the neurons",
  "inside the brain",
  "inside the neurons",
  "enter the mind",
  "enter mind",
  "open the mind",
  "open mind",
  "show the philosophy",
  "show philosophy",
  "open philosophy",
  "the philosophy",
];

export const ROOT_MEET_JOZ_PHRASES = [
  "meet joz",
  "meet joe",
  "meet joe's",
  "meet jaws",
  "meej joe",
  "meej joz",
  "neo meet joz",
  "neo meet jaws",
  "neo meej joz",
  "talk to joz",
  "talk to jaws",
  "open meet joz",
  "open meet jaws",
  "go to meet joz",
  "open ball",
  "go to ball",
];

export const FLEX_PHRASES = ["vibe", "flex", "flax", "flecks", "open flex", "show flex"];

export const DISCOVER_PHRASES = [
  "discover",
  "ascend",
  "ascent",
  "accent",
  "a send",
  "send",
  "offend",
  "open ascend",
  "show ascend",
];

export const SURPRISE_ME_PHRASES = ["surprise me"];

export const SKILLS_PHRASES = [
  "skills",
  "skill",
  "mogg",
  "mog",
  "mark",
  "mug",
  "mocha",
  "moch",
  "show mogg",
  "open mogg",
  "show skills",
  "open skills",
];

export const PAUSE_PHRASES = [
  "pause",
  "stop",
  "pause neurons",
  "stop neurons",
  "pause animation",
  "stop animation",
];

export const RESUME_PHRASES = [
  "play",
  "resume",
  "continue",
  "start",
  "resume neurons",
  "play neurons",
  "start neurons",
  "resume animation",
  "play animation",
];

export const BACK_PHRASES = ["back", "go back", "previous", "step back", "return"];

export const EXIT_PHRASES = [
  "exit",
  "leave",
  "leave portal",
  "close portal",
  "close joz",
  "exit joz",
  "leave joz",
];

export const AR_PHRASES = [
  "launch in space",
  "open in space",
  "view in space",
  "view in ar",
  "launch ar",
  "show in space",
  "space maxx",
  "world maxx",
];

export const CONTACT_PHRASES = [
  "contact",
  "email",
  "message",
  "send email",
  "send an email",
  "reach out",
  "write to",
];

export const CALL_PHRASES = ["call", "phone", "ring", "dial", "call joz", "phone joz"];

export const HIDE_CONTACT_PHRASES = [
  "hide contact",
  "hide buttons",
  "hide contact buttons",
  "remove contact",
  "dismiss contact buttons",
];

export const SHOW_CONTACT_PHRASES = [
  "show contact",
  "show buttons",
  "show contact buttons",
  "bring back contact",
  "display contact",
];

export function escapePhrasePattern(value) {
  return String(value || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
}

export function hasPhrase(text, phrases) {
  return phrases.some((phrase) => {
    const pattern = escapePhrasePattern(phrase);
    return new RegExp(`\\b${pattern}\\b`, "i").test(text);
  });
}

export function normalizeVoiceTranscript(text) {
  let clean = String(text || "").toLowerCase();
  for (const [pattern, replacement] of TRANSCRIPT_NORMALIZATIONS) {
    clean = clean.replace(pattern, replacement);
  }
  return clean.trim();
}

// apps/web/components/hoop-upload/engine.ts
//
// HoopUpload — "slingshot a file into a basketball hoop" upload widget.
// Framework-agnostic core ported 1:1 from the reference implementation (hoop-upload.html).
// No dependencies, no DOM access at import time (SSR-safe): everything happens inside
// createHoopUpload(), which is only ever called from the browser.
//
// ALL geometry is in DESIGN UNITS (dp): the stage is 432 x 539 dp and is uniformly scaled to its
// container (see `fit()`), so every number below is the same at any size. 1 dp = 0.5 px of the 2x
// source recording. G, FINISH, PULL_PATH and the timing constants were measured from that
// recording — do not "improve" them.
//
// Interaction model (v3):
//   - By default the widget is a normal uploader: browsing for files, or dropping them anywhere on
//     the stage, uploads them straight away.
//   - Shot mode is an opt-in switch (`shotMode` option / setShotMode()). While it is on, every file
//     that is browsed or dropped waits for a basket first: it sits where it was dropped (or at the
//     default spot for browsed files), the cursor turns into an aiming reticle, and you slingshot
//     it from anywhere. The flight is simulated with real physics (gravity, rim collisions, walls,
//     floor). Only a file that scores is uploaded; a miss becomes a failed upload (a "Failed" row).
//     Turning shot mode off at any time uploads whatever is still waiting.
//   - The scripted, always-scoring slingshot (the original recording) is still what the keyboard
//     (Enter / Space on the file) and demo() use, so the widget stays accessible.
//   - The "Uploaded" counter counts finished uploads (it used to count shots).
//   - Exactly two sounds, both synthesised (no audio files): a pleasant chime on a basket and a
//     soft low "thud" on a miss.
//
// Intentional deviations from the reference (everything else is identical):
//   - matchMedia is read inside the factory, not at import time (SSR).
//   - Theme CSS variables are namespaced `--hu-*` (the reference's `--accent`/`--muted`/... would
//     collide with the app's shadcn tokens). Defaults live in the injected stylesheet so a dark
//     theme can override them; only values the caller passes are written inline.
//   - Text options are escaped, and the file badge label is restricted to [A-Z0-9] (the reference
//     built it with innerHTML from the file extension, which a hostile filename could abuse).
//   - destroy() really cleans up: every timer is tracked, the ResizeObserver is disconnected and
//     pending uploads can no longer touch the DOM.
//   - Added: maxSize / maxFiles / accept validation with a flashing message, `disabled`, a
//     hover-only remove (x) button on finished rows, onRemove / onBusyChange / onReject hooks, and
//     Space on the dropzone no longer scrolls the page.

/* ---------- 1. CONFIG (everything a consumer may customise) ---------- */

export interface HuTheme {
  bg: string;
  ink: string;
  muted: string;
  faint: string;
  surface: string;
  dash: string;
  accent: string;
  accentSoft: string;
  net: string;
  ok: string;
  track: string;
  pill: string;
  /** default file-type badge colour */
  badge: string;
  font: string;
}

export interface HuText {
  title: string;
  subtitle: string;
  dropTitle: string;
  dropHint: string;
  counter: string;
  uploading: string;
  done: string;
  failed: string;
  plusOne: string;
  /** shown when a file is rejected: {max} = size limit, {n} = file limit */
  rejectType: string;
  rejectSize: string;
  rejectCount: string;
  disabled: string;
  remove: string;
  /** toast after a missed shot */
  miss: string;
  /** tooltip on the failed row of a missed shot */
  missReason: string;
  /** shown after an upload finishes */
  uploadedMsg: string;
  /** subtitle while a file is waiting for a shot */
  shotHint: string;
  /** subtitle while shot mode is on and nothing is waiting */
  shotReady: string;
}

/** The minimal file shape the widget needs (real `File`s satisfy it; the demo uses a plain object). */
export interface HuFileLike {
  name: string;
  size: number;
  type?: string;
}

export interface HoopUploadOptions {
  theme: Partial<HuTheme>;
  text: Partial<HuText>;
  /** file extension (lowercase, no dot) -> badge colour */
  kinds: Record<string, string>;
  /** `<input accept>` syntax: ".pdf,.docx,image/png". Empty = anything. Also enforced on drops. */
  accept: string;
  multiple: boolean;
  /** Largest accepted file in bytes (0 = unlimited). */
  maxSize: number;
  /** Most files accepted in total (uploaded + waiting). Infinity = unlimited. */
  maxFiles: number;
  /** slingshot limits (dp) */
  maxPull: number;
  minPull: number;
  /** simulated upload length when no `upload` fn is given */
  uploadMs: number;
  /** Real upload. Report progress 0..1. Reject to show "Failed" on the row. Its resolved value is passed to onUploaded. */
  upload: ((file: File | HuFileLike, onProgress: (p: number) => void) => Promise<unknown>) | null;
  onUploaded: ((file: File | HuFileLike, result: unknown) => void) | null;
  /** Start with shot mode on (default off). Change later with setShotMode(). */
  shotMode: boolean;
  /** The user removed a finished (or failed) row. */
  onRemove: ((file: File | HuFileLike, result: unknown) => void) | null;
  /** A file was refused before entering the queue. */
  onReject: ((file: File | HuFileLike, reason: "type" | "size" | "count" | "miss") => void) | null;
  /** true while any upload is in flight (use it to block form submission). */
  onBusyChange: ((busy: boolean) => void) | null;
  /** Skip the flight and just add the row. Default: never (the throw always plays). */
  reducedMotion: boolean | undefined;
  /**
   * Follow the OS "reduce motion" setting (skip the flight when it is on). Off by default: the throw is
   * started by the visitor's own drag, and skipping it made shots look like the file just vanished.
   */
  respectReducedMotion: boolean;
  /** Adopt the app's dark theme (`.dark` ancestor) via tokens.css. */
  adaptive: boolean;
  disabled: boolean;
  /** Files that are already uploaded (restored without animation, e.g. when going back a step). */
  initialFiles: { file: HuFileLike; result: unknown }[];
  /** Play the basket / miss sound (two short synthesised tones, nothing else). */
  sound: boolean;
  /** Reference-recording compatibility: bump the counter when the shot scores instead of when the upload succeeds. */
  countOnScore: boolean;
}

export const DEFAULT_THEME: HuTheme = {
  bg: "#EFF0F5",
  ink: "#0E0F14",
  muted: "#6B7280",
  faint: "#9096A0",
  surface: "#FFFFFF",
  dash: "#C9CED6",
  accent: "#F15D2E",
  accentSoft: "#FDF1EC",
  net: "#A9B0BC",
  ok: "#2EAF6A",
  track: "#E4E5EA",
  pill: "#E3E6ED",
  badge: "#DC3545",
  font: "var(--font-sans), sans-serif",
};

export const DEFAULTS: HoopUploadOptions = {
  theme: {},
  text: {},
  kinds: {
    pdf: "#DC3545",
    doc: "#2B6CD9",
    docx: "#2B6CD9",
    png: "#8B5CF6",
    jpg: "#8B5CF6",
    jpeg: "#8B5CF6",
    zip: "#E0A100",
  },
  accept: "",
  multiple: true,
  maxSize: 0,
  maxFiles: Number.POSITIVE_INFINITY,
  maxPull: 60,
  minPull: 12,
  uploadMs: 400,
  upload: null,
  onUploaded: null,
  onRemove: null,
  onReject: null,
  onBusyChange: null,
  reducedMotion: undefined,
  respectReducedMotion: false,
  adaptive: false,
  disabled: false,
  shotMode: false,
  initialFiles: [],
  sound: true,
  countOnScore: false,
};

export const DEFAULT_TEXT: HuText = {
  title: "Upload files",
  subtitle: "Drag and drop, or take the shot.",
  dropTitle: "Drop files here",
  dropHint: "or click to browse",
  counter: "Uploaded",
  uploading: "Uploading…",
  done: "Uploaded",
  failed: "Failed",
  plusOne: "+1",
  rejectType: "That file type isn’t allowed.",
  rejectSize: "That file is too large (max {max}).",
  rejectCount: "You can upload up to {n} file(s).",
  disabled: "Uploads are turned off in preview.",
  remove: "Remove file",
  miss: "Missed! The file wasn\u2019t uploaded.",
  missReason: "Missed the basket",
  uploadedMsg: "File uploaded successfully",
  shotHint: "Shot mode: pull back anywhere and release",
  shotReady: "Shot mode is on: add a file, then score a basket",
};

/* ---------- 2. GEOMETRY / TIMING measured from the recording ---------- */
const G = {
  W: 432,
  H: 539,
  rest: { x: 98.5, y: 420 }, // file centre at rest
  rim: { x: 216, y: 256 }, // rim centre (hoop anchor)
  file: { w: 46, h: 58 },
  dz: { x: 100.5, y: 100, w: 231, h: 155.5 },
  rows: { x: 33, y: 439, w: 367, h: 48.5, gap: 8 },
  dots: { n: 10, step: 1 / 7.6, d0: 4.2, d1: 3.3, alpha: 0.59 },
  apexRel: { x: -50, y: -74 },
  apexPull: 32, // apex (rel. rim) for a 32dp pull; seconds to apex:
  apexT: 0.52,
};

type Waypoint = [t: number, dx: number, dy: number, rot: number, scale: number];

/* Flight after the apex, relative to rim centre: [t(s since release), dx, dy, rot°, scale]
 * (measured per frame; rotation ends at 720° = exactly two turns, scale 0.80)           */
const FINISH: Waypoint[] = [
  [0.52, -50, -74, 340, 0.9],
  [0.6, -37, -68, 377, 0.87],
  [0.66, -19, -45, 427, 0.83],
  [0.72, -10, -21, 460, 0.81],
  [0.75, -9, -13, 487, 0.8],
  [0.82, -10, -16, 507, 0.8],
  [0.88, -9, -22, 519, 0.8],
  [0.95, -6, -26, 520, 0.8],
  [1.05, -7, -14, 559, 0.8],
  [1.15, -8, 3, 581, 0.8],
  [1.25, -8, 35, 609, 0.8],
  [1.32, -5, 52, 669, 0.8],
  [1.42, -1, 59, 707, 0.8],
  [1.55, 1, 60, 720, 0.8],
];
/* Real-physics shots (shot mode). Units: dp, dp/s. Gravity is the one implied by the recording
 * (apex 264dp above the start after 0.52s -> g = 2h/t^2 ~ 1950). */
const PHYS = {
  g: 1950,
  ballR: 11, // collision radius of the file (the sprite is bigger; this is the felt size)
  tube: 3.5, // rim tube radius
  rimE: 0.58, // rim bounciness
  wallE: 0.5,
  floorE: 0.42,
  v0: 120, // launch speed = v0 + vk * pull(dp)
  vk: 28,
  spin: 660, // deg/s at launch (the recording)
  /** the whole flight plays slightly slower than real time, so the arc and the drop read clearly */
  timeScale: 0.82,
  /** gentle air drag on the spin (1/s) */
  spinDrag: 0.35,
  pad: 14, // floor sits this far above the bottom of the stage
};
/** Dropping files here uploads straight away: the backboard (+ a small margin) and the rim. */
const HOOP_ZONE = { x0: 167, y0: 191, x1: 265, y1: 264 };
const T = { tintOn: 0.42, tintOff: 1.52, plusOne: 1.35, score: 1.45, row: 1.6 }; // s after release

/* ---------- 3. small helpers ---------- */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const fmtSize = (b: number) =>
  b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB";
const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** time-aware cubic Hermite through [t,x,y,rot,scale] waypoints (smooth, no overshoot ringing) */
function makeTrack(pts: number[][]) {
  const m = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dt = b[0]! - a[0]! || 1;
    return p.map((_, k) => (k ? (b[k]! - a[k]!) / dt : 0));
  });
  return (t: number): number[] => {
    if (t <= pts[0]![0]!) return pts[0]!.slice(1);
    const last = pts.length - 1;
    if (t >= pts[last]![0]!) return pts[last]!.slice(1);
    let i = 0;
    while (pts[i + 1]![0]! < t) i++;
    const p0 = pts[i]!;
    const p1 = pts[i + 1]!;
    const h = p1[0]! - p0[0]!;
    const u = (t - p0[0]!) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    return [1, 2, 3, 4].map(
      (k) => h00 * p0[k]! + h10 * h * m[i]![k]! + h01 * p1[k]! + h11 * h * m[i + 1]![k]!,
    );
  };
}

/* ---------- 4. markup ---------- */
interface Kind {
  label: string;
  color: string;
}

const fileSVG = (kind: Kind) => `<svg viewBox="0 0 46 58" width="100%" height="100%" aria-hidden="true">
  <path d="M5 0H31L46 15V53a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5Z" fill="#fff"/>
  <path d="M31 0L46 15H36a5 5 0 0 1-5-5V0Z" fill="#E4E6EC"/>
  <rect x="6.5" y="19" width="28" height="3" rx="1.5" fill="#E6E8EE"/>
  <rect x="6.5" y="26" width="33" height="3" rx="1.5" fill="#E6E8EE"/>
  <rect x="6.5" y="33" width="22" height="3" rx="1.5" fill="#E6E8EE"/>
  <rect x="6.5" y="42" width="21.5" height="11" rx="3.5" fill="${kind.color}"/>
  <text x="17.25" y="49.8" text-anchor="middle" font-size="6.6" font-weight="700" fill="#fff" font-family="inherit">${kind.label}</text></svg>`;

// net lattice: 9 top pts (rim width) -> 9 bottom pts, X pattern + two rings
const NET = (() => {
  let d = "";
  const Tp = (i: number) => 169 + i * 11.75;
  const B = (i: number) => 187.5 + i * 7.125;
  for (let i = 0; i < 8; i++) d += `M${Tp(i)} 258L${B(i + 1)} 318M${Tp(i + 1)} 258L${B(i)} 318`;
  for (const f of [0.33, 0.66]) {
    const y = 258 + 60 * f;
    const l = lerp(169, 187.5, f);
    const r = lerp(263, 244.5, f);
    d += `M${l} ${y}L${r} ${y}`;
  }
  return d;
})();

const THEME_DEFAULTS_CSS = `.hu{${Object.entries(DEFAULT_THEME)
  .map(([k, v]) => `--hu-${k}:${v}`)
  .join(";")}}`;

const CSS = `${THEME_DEFAULTS_CSS}
.hu{position:relative;width:${G.W}px;height:${G.H}px;transform-origin:0 0;background:var(--hu-bg);font-family:var(--hu-font);color:var(--hu-ink);overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}
.hu *{box-sizing:border-box}.hu>*{position:absolute}
.hu-title{left:32px;top:39px;margin:0;font-size:18.7px;line-height:1;font-weight:600;letter-spacing:-.01em}
.hu-sub{left:32px;top:62px;margin:0;font-size:10.4px;line-height:1.2;color:var(--hu-muted);transition:color .15s}
.hu-pill{right:32px;top:36.5px;height:19.5px;padding:0 8px;border-radius:10px;background:var(--hu-pill);display:flex;gap:5px;align-items:center;font-size:8px;font-weight:500;color:var(--hu-muted)}
.hu-odo{position:relative;display:inline-block;height:12px;width:6px;overflow:hidden;color:var(--hu-ink);font-weight:700;font-size:10px;line-height:12px}
.hu-odo>span{position:absolute;left:0;top:0}
.hu-dz{left:${G.dz.x}px;top:${G.dz.y}px;width:${G.dz.w}px;height:${G.dz.h}px;border-radius:10px;background:var(--hu-surface);text-align:center;transition:background .12s;cursor:pointer}
.hu-dz.on{background:var(--hu-accentSoft)}
.hu-dz>.bd{left:0;top:0;width:100%;height:100%;overflow:visible;fill:none;stroke:var(--hu-dash);stroke-width:1.5;stroke-dasharray:5.5 3.5;transition:stroke .12s;pointer-events:none}
.hu-dz.on>.bd{stroke:var(--hu-accent)}
.hu-dz>*{position:absolute}
.hu-dz svg.up{left:107.5px;top:18.3px;width:16px;height:16px;color:var(--hu-muted)}
.hu-dz b{position:absolute;left:0;right:0;top:45px;font-size:13px;font-weight:500;line-height:1.2}
.hu-dz i{position:absolute;left:0;right:0;top:64.5px;font-style:normal;font-size:9.5px;color:var(--hu-faint)}
.hu-svg{left:160px;top:195px;width:112px;height:130px;pointer-events:none;overflow:visible}
.hu-net{transform-origin:216px 258px}
.hu-dot{left:0;top:0;border-radius:50%;background:var(--hu-accent);pointer-events:none;opacity:0;will-change:transform}
.hu-file{left:0;top:0;width:${G.file.w}px;height:${G.file.h}px;cursor:grab;opacity:0;will-change:transform;touch-action:none;outline:none}
.hu-file svg{display:block;overflow:visible;filter:drop-shadow(0 2px 3px rgba(20,25,50,.10));transition:filter .12s}
.hu-file.lift{cursor:grabbing}.hu-file.lift svg{filter:drop-shadow(0 8px 8px rgba(20,25,50,.16))}
.hu-file:focus-visible svg{filter:drop-shadow(0 0 0 var(--hu-accent)) drop-shadow(0 0 3px var(--hu-accent))}
.hu-label{left:${G.rest.x - 55}px;top:457px;width:110px;text-align:center;font-size:8.5px;color:#4A4F5A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;pointer-events:none}
.hu-plus{left:257px;top:196px;font-size:20px;font-weight:800;color:var(--hu-accent);opacity:0;pointer-events:none;letter-spacing:-.02em;line-height:1}
.hu-rows{left:${G.rows.x}px;top:${G.rows.y}px;width:${G.rows.w}px}
.hu-row{position:absolute;left:0;width:100%;height:${G.rows.h}px;border-radius:14px;background:var(--hu-surface);box-shadow:0 1px 2px rgba(20,25,50,.05),0 4px 10px rgba(20,25,50,.06);opacity:0;transform:translateY(14px);transition:opacity .15s,transform .2s cubic-bezier(.2,.8,.2,1),top .25s}
.hu-row.in{opacity:1;transform:none}.hu-row.out{opacity:0;transform:translateY(8px)}
.hu-row>*{position:absolute}
.hu-row .ico{left:13px;top:12px;width:19px;height:24px}
.hu-row .nm{left:42px;top:7.5px;max-width:150px;font-size:12px;font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hu-row .sz{left:42px;top:26px;font-size:8.5px;color:var(--hu-faint)}
.hu-row .st{left:224px;top:11.5px;font-size:8.5px;color:var(--hu-faint);transition:color .15s}
.hu-row .bar{left:224px;top:21.5px;width:104px;height:3.5px;border-radius:2px;background:var(--hu-track);overflow:hidden}
.hu-row .bar>i{display:block;height:100%;width:0;background:var(--hu-accent);border-radius:2px;transition:background .15s}
.hu-row .ck{left:336px;top:15px;width:18px;height:18px;border-radius:50%;background:var(--hu-ok);color:#fff;display:grid;place-items:center;transform:scale(0);transition:transform .3s cubic-bezier(.3,1.6,.5,1)}
.hu-row .ck svg{width:10px;height:10px}
.hu-row.done .st{color:var(--hu-ok)}.hu-row.done .bar>i{background:var(--hu-ok)}.hu-row.done .ck{transform:scale(1)}
.hu-row .rm{left:354.5px;top:17.5px;width:11px;height:13px;padding:0;border:0;background:none;color:var(--hu-faint);font:inherit;font-size:13px;line-height:13px;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .12s,color .12s}
.hu-row.done:hover .rm,.hu-row.failed .rm,.hu-row .rm:focus-visible{opacity:1;pointer-events:auto}
.hu-row .rm:hover{color:var(--hu-ink)}
.hu-row.failed .st{color:#d33}
.hu.is-disabled .hu-dz,.hu.is-disabled .hu-file{cursor:not-allowed}
.hu.shot{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none' stroke='%23F15D2E' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='16' cy='16' r='9'/%3E%3Cpath d='M16 2v7M16 23v7M2 16h7M23 16h7'/%3E%3Ccircle cx='16' cy='16' r='1.6' fill='%23F15D2E'/%3E%3C/svg%3E") 16 16,crosshair}
.hu.shot.aiming{cursor:grabbing}
.hu-surface{left:10px;top:78px;right:10px;bottom:10px;border:2px dashed var(--hu-accent);border-radius:16px;background:var(--hu-accentSoft);opacity:0;transition:opacity .12s;pointer-events:none}
.hu.shot-on .hu-surface{opacity:.55}
.hu.bb-on .bb,.hu.bb-hit .bb{stroke-width:3.5}
.hu.bb-on .hu-dz{background:var(--hu-accentSoft)}
.hu.bb-on .hu-dz>.bd{stroke:var(--hu-accent)}
.hu-toast{left:50%;top:352px;transform:translate(-50%,6px);padding:7px 12px;border-radius:12px;background:var(--hu-surface);color:var(--hu-ink);font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 1px 2px rgba(20,25,50,.06),0 4px 12px rgba(20,25,50,.12);opacity:0;pointer-events:none;transition:opacity .15s,transform .2s}
.hu-toast.show{opacity:1;transform:translate(-50%,0)}
.hu-toast.ok{color:var(--hu-ok)}.hu-toast.bad{color:#d33}
.hu.calm .hu-row{transition:none}
`;
// Dark theme tokens live in tokens.css (opt-in per instance via `adaptive`).

/* ---------- 5. the component ---------- */

interface Row {
  el: HTMLElement;
  file: File | HuFileLike;
  result: unknown;
  state: "uploading" | "done" | "failed";
  dismissed?: boolean;
}

interface State {
  mode: "idle" | "hold" | "fly" | "back" | "phys" | "miss";
  x: number;
  y: number;
  rot: number;
  sc: number;
  scT: number;
  queue: (File | HuFileLike)[];
  count: number;
  held: number;
  raf: number;
  last: number;
  grab: { x: number; y: number };
  track: ((t: number) => number[]) | null;
  t0: number;
  timers: ReturnType<typeof setTimeout>[];
  pull: { x: number; y: number };
  auto: ((now: number) => void) | null;
  b0: number;
  bx: number;
  by: number;
  br: number;
  rows: Row[];
  inflight: number;
  dead: boolean;
  /** where the waiting file sits (the drop point in shot mode) */
  rest: { x: number; y: number };
  /** shot mode switch: while on, added files wait for a basket */
  shotOn: boolean;
  /** pointer position when the pull started */
  p0: { x: number; y: number };
  /** true while the keyboard / demo scripted slingshot is running (always scores) */
  scripted: boolean;
  shotMode: boolean;
  phys: Ball | null;
  /** swallow the click that follows a shot */
  noClick: boolean;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  w: number;
  t: number;
  still: number;
  /** unspent frame time (the physics always steps in fixed 1/240 s slices, so a shot plays out the same at any frame rate) */
  acc: number;
  file: File | HuFileLike;
}

export interface HoopUploadHandle {
  /** "direct" (default): upload now. "shot": the files wait at `at` for a basket. */
  addFiles(
    list: Iterable<File | HuFileLike> | ArrayLike<File>,
    opts?: { mode?: "direct" | "shot"; at?: { x: number; y: number } },
  ): void;
  shoot(delay?: number): void;
  demo(name?: string, size?: number): void;
  setTheme(t: Partial<HuTheme>): void;
  setDisabled(disabled: boolean): void;
  /**
   * The shot-mode switch. On: browsed / dropped files wait for a basket. Off: they upload straight
   * away — and anything still waiting is uploaded right away too.
   */
  setShotMode(on: boolean): void;
  /**
   * Dry-run a shot with the same physics and report the outcome — handy for tests, hints and
   * "aim assist" UIs. `pull` is the slingshot pull in dp (the file flies opposite to it).
   */
  simulateShot(pull: { x: number; y: number }, from?: { x: number; y: number }): "score" | "miss";
  root: HTMLElement;
  destroy(): void;
}

function mergeOptions(user: Partial<HoopUploadOptions>): HoopUploadOptions {
  return {
    ...DEFAULTS,
    ...user,
    theme: { ...DEFAULTS.theme, ...user.theme },
    text: { ...user.text },
    kinds: { ...DEFAULTS.kinds, ...user.kinds },
  };
}

export function createHoopUpload(
  host: HTMLElement,
  userOpts: Partial<HoopUploadOptions> = {},
): HoopUploadHandle {
  const o = mergeOptions(userOpts);
  const text: HuText = { ...DEFAULT_TEXT, ...o.text };
  const maxFiles = o.multiple ? o.maxFiles : 1;
  const reduced =
    o.reducedMotion ??
    (o.respectReducedMotion &&
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  if (!document.getElementById("hu-css")) {
    const s = document.createElement("style");
    s.id = "hu-css";
    s.textContent = CSS;
    document.head.append(s);
  }
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;width:100%;overflow:hidden";
  const root = document.createElement("div");
  root.className = "hu";
  if (o.adaptive) root.setAttribute("data-hu-adaptive", "");
  if (reduced) root.classList.add("calm");
  root.innerHTML = `
   <div class="hu-surface"></div>
   <h2 class="hu-title">${esc(text.title)}</h2><p class="hu-sub">${esc(text.subtitle)}</p>
   <div class="hu-pill"><span>${esc(text.counter)}</span><span class="hu-odo"><span>0</span></span></div>
   <div class="hu-dz" role="button" tabindex="0" aria-label="${esc(text.dropTitle)}">
     <svg class="bd"><rect x=".75" y=".75" width="229.5" height="154" rx="10"/></svg><svg class="up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M4.5 14v4.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V14"/></svg>
     <b>${esc(text.dropTitle)}</b><i>${esc(text.dropHint)}</i></div>
   <svg class="hu-svg" viewBox="160 195 112 130" fill="none" stroke-linecap="round">
     <rect class="bb" x="177" y="201" width="78" height="46" rx="1.5" stroke="var(--hu-accent)" stroke-width="2"/>
     <path d="M169 256A47 6 0 0 1 263 256" stroke="var(--hu-accent)" stroke-width="3.5"/>
     <rect x="209" y="252" width="14" height="6" rx="1" fill="#BD4B1E"/></svg>
   <div class="hu-dots"></div>
   <div class="hu-file" role="button" tabindex="0"></div><div class="hu-label"></div>
   <svg class="hu-svg" viewBox="160 195 112 130" fill="none" stroke-linecap="round">
     <g class="hu-net"><path d="${NET}" stroke="var(--hu-net)" stroke-width="1.5"/></g>
     <path d="M169 256A47 6 0 0 0 263 256" stroke="var(--hu-accent)" stroke-width="3.5"/></svg>
   <div class="hu-plus">${esc(text.plusOne)}</div>
   <div class="hu-toast" role="status" aria-live="polite"></div>
   <div class="hu-rows"></div>
   <input type="file" hidden>`;
  wrap.append(root);
  host.append(wrap);

  const $ = <E extends HTMLElement>(s: string) => root.querySelector(s) as E;
  const fileEl = $<HTMLDivElement>(".hu-file");
  const label = $<HTMLDivElement>(".hu-label");
  const dz = $<HTMLDivElement>(".hu-dz");
  const plus = $<HTMLDivElement>(".hu-plus");
  const net = root.querySelector(".hu-net") as SVGGElement;
  const rows = $<HTMLDivElement>(".hu-rows");
  const odo = $<HTMLSpanElement>(".hu-odo");
  const input = $<HTMLInputElement>("input");
  const dotsEl = $<HTMLDivElement>(".hu-dots");
  const sub = $<HTMLParagraphElement>(".hu-sub");
  const toast = $<HTMLDivElement>(".hu-toast");
  if (o.multiple) input.multiple = true;
  if (o.accept) input.setAttribute("accept", o.accept);
  setTheme(o.theme);
  root.classList.toggle("is-disabled", o.disabled);

  function setTheme(t: Partial<HuTheme>) {
    for (const k in t) {
      const v = t[k as keyof HuTheme];
      if (v !== undefined) root.style.setProperty("--hu-" + k, v);
    }
  }

  // uniform scale to container width
  let k = 1;
  let H = G.H;
  const fit = () => {
    k = wrap.clientWidth / G.W;
    root.style.transform = `scale(${k})`;
    root.style.height = H + "px";
    wrap.style.height = H * k + "px";
  };
  // stage grows when rows pile up; rows sit lower while another file waits on the shelf
  const layout = () => {
    const n = S.rows.filter((row) => !row.dismissed).length;
    const wait = S.queue.length ? 56 : 0;
    rows.style.top = G.rows.y + wait + "px";
    rows.style.transition = "top .25s";
    H = Math.max(G.H, G.rows.y + wait + n * (G.rows.h + G.rows.gap) + 24);
    fit();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(wrap);

  // dots
  const dots = [...Array(G.dots.n)].map((_, i) => {
    const d = document.createElement("div");
    d.className = "hu-dot";
    const s = lerp(G.dots.d0, G.dots.d1, i / (G.dots.n - 1));
    d.style.width = d.style.height = s + "px";
    d.style.marginLeft = d.style.marginTop = -s / 2 + "px";
    dotsEl.append(d);
    return { el: d, x: 0, y: 0, v: 0, seen: 0 };
  });

  /* ---- state ---- */
  const S: State = {
    mode: "idle",
    x: G.rest.x,
    y: G.rest.y,
    rot: 0,
    sc: 1,
    scT: 1,
    queue: [],
    count: 0,
    held: 0,
    raf: 0,
    last: 0,
    grab: { x: 0, y: 0 },
    track: null,
    t0: 0,
    timers: [],
    pull: { x: 0, y: 0 },
    auto: null,
    b0: 0,
    bx: 0,
    by: 0,
    br: 0,
    rows: [],
    inflight: 0,
    dead: false,
    rest: { x: G.rest.x, y: G.rest.y },
    shotOn: o.shotMode,
    p0: { x: 0, y: 0 },
    scripted: false,
    shotMode: false,
    phys: null,
    noClick: false,
  };
  fit();

  /** setTimeout that destroy() can cancel. */
  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      S.timers = S.timers.filter((t) => t !== id);
      if (!S.dead) fn();
    }, ms);
    S.timers.push(id);
    return id;
  };
  const after = (s: number, fn: () => void) => later(s * 1000, fn);

  const kindOf = (f: File | HuFileLike): Kind => {
    const e = ext(f.name);
    // badge text is built into markup: keep it to plain letters/digits
    const safe = e.replace(/[^a-z0-9]/g, "").slice(0, 4).toUpperCase() || "FILE";
    return { label: safe, color: o.kinds[e] || (o.theme.badge ?? DEFAULT_THEME.badge) };
  };

  function showBall() {
    const f = S.queue[0];
    if (!f || S.mode !== "idle") return;
    fileEl.innerHTML = fileSVG(kindOf(f));
    fileEl.setAttribute("aria-label", "Shoot " + f.name);
    label.textContent = f.name;
    Object.assign(S, { x: S.rest.x, y: S.rest.y, rot: 0, sc: 1, scT: 1 });
    label.style.left = `${S.rest.x - 55}px`;
    label.style.top = `${S.rest.y + 37}px`;
    paint();
    syncShotUi();
    fileEl.style.transition = "opacity .15s";
    label.style.transition = "opacity .2s .08s";
    fileEl.style.opacity = "1";
    label.style.opacity = "1";
  }
  function paint() {
    fileEl.style.transform = `translate3d(${S.x - G.file.w / 2}px,${S.y - G.file.h / 2}px,0) rotate(${S.rot}deg) scale(${S.sc})`;
  }

  /* ---- aim: parabola from ball to apex; dots sample it ---- */
  function aim(_px: number, py: number, pullLen: number) {
    const ay = G.rim.y + G.apexRel.y - clamp((pullLen - G.apexPull) * 1.5, -60, 60);
    const ax = G.rim.x + G.apexRel.x;
    return {
      ax,
      ay,
      at: G.apexT * Math.sqrt(Math.max(0.3, (py - ay) / (G.rest.y + 26.5 - (G.rim.y + G.apexRel.y)))), // dy of default launch = 446.5-182
    };
  }
  const para = (px: number, py: number, a: { ax: number; ay: number }, u: number): [number, number] => [
    px + (a.ax - px) * u,
    a.ay + (py - a.ay) * (1 - u) ** 2,
  ];

  /* ---- shot-mode UI (cursor, hint) ---- */
  const waiting = () => S.shotMode && S.queue.length > 0 && !o.disabled;
  function syncShotUi() {
    root.classList.toggle("shot", waiting());
    if (!flashTimer) {
      if (waiting()) {
        sub.textContent = text.shotHint;
        sub.style.color = "var(--hu-accent)";
      } else if (S.shotOn && !o.disabled) {
        sub.textContent = text.shotReady;
        sub.style.color = "var(--hu-accent)";
      } else {
        sub.textContent = text.subtitle;
        sub.style.color = "";
      }
    }
  }

  /* ---- shot mode ballistics ---- */
  /** launch velocity from a slingshot pull (the file flies opposite to the pull) */
  function launchVel(pull: { x: number; y: number }) {
    const len = Math.hypot(pull.x, pull.y) || 1;
    const sp = PHYS.v0 + PHYS.vk * len;
    return { vx: (-pull.x / len) * sp, vy: (-pull.y / len) * sp };
  }
  /** 10 points along the (collision-free) path the shot will take, up to the rim plane */
  function predict(x0: number, y0: number, v: { vx: number; vy: number }): [number, number][] {
    const g = PHYS.g;
    const disc = v.vy * v.vy + 2 * g * (G.rim.y - y0);
    let tEnd = Math.min(1.4, (2 * Math.abs(v.vy)) / g + 0.2);
    if (disc >= 0) {
      const tc = (-v.vy + Math.sqrt(disc)) / g;
      if (tc > 0.05) tEnd = Math.min(1.6, tc);
    }
    return Array.from({ length: G.dots.n }, (_, i) => {
      const t = (tEnd * (i + 1)) / G.dots.n;
      return [x0 + v.vx * t, y0 + v.vy * t + 0.5 * g * t * t];
    });
  }

  /**
   * Spin like a real jump shot: BACKSPIN (the top of the ball turns back toward the shooter), faster for a
   * harder throw, never faster than the recording's rate. Heading right that is counter-clockwise.
   */
  const launchSpin = (v: { vx: number; vy: number }) => {
    const speed = Math.hypot(v.vx, v.vy);
    const rate = clamp(300 + speed * 0.22, 360, PHYS.spin);
    return (v.vx >= 0 ? -1 : 1) * rate;
  };

  /** a short fading trail behind a flying file (reuses the aim dots) */
  const trail: [number, number][] = [];
  let trailClock = 0;
  function drawTrail(dt: number) {
    trailClock += dt;
    if (trailClock >= 0.03) {
      trailClock = 0;
      trail.unshift([S.x, S.y]);
      if (trail.length > G.dots.n + 1) trail.pop();
    }
    dots.forEach((d, i) => {
      const pt = trail[i + 1];
      if (!pt) {
        d.el.style.opacity = "0";
        return;
      }
      d.el.style.transform = `translate(${pt[0]}px,${pt[1]}px)`;
      d.el.style.opacity = String(0.5 * (1 - i / (G.dots.n + 1)));
    });
  }
  function clearTrail() {
    trail.length = 0;
    trailClock = 0;
    dots.forEach((d) => (d.el.style.opacity = "0"));
  }

  /* ---- loop ---- */
  function loop(now: number) {
    const dt = Math.min(0.05, (now - S.last) / 1000 || 0.016);
    S.last = now;
    let busy = false;
    S.sc += (S.scT - S.sc) * (1 - Math.exp(-dt / 0.06));
    if (S.auto) S.auto(now);
    if (S.mode === "hold") {
      busy = true;
      const pl = Math.hypot(S.pull.x, S.pull.y);
      let targets: [number, number][];
      if (S.scripted) {
        const a = aim(S.x, S.y, pl);
        targets = dots.map((_, i) => para(S.x, S.y, a, (i + 1) * G.dots.step));
      } else {
        targets = predict(S.x, S.y, launchVel(S.pull));
      }
      S.rot = clamp(-S.pull.x * 0.33, -14, 14);
      S.held += dt;
      dots.forEach((d, i) => {
        const [tx, ty] = targets[i]!;
        if (!d.seen) {
          d.x = tx;
          d.y = ty;
          d.seen = 1;
        }
        const tau = 0.1 + 0.015 * i;
        d.x += (tx - d.x) * (1 - Math.exp(-dt / tau));
        d.y += (ty - d.y) * (1 - Math.exp(-dt / tau));
        const want = pl > 6 && S.held > 0.1 + i * 0.035 ? 1 : 0;
        d.v += (want - d.v) * (1 - Math.exp(-dt / 0.08));
        d.el.style.transform = `translate(${d.x}px,${d.y}px)`;
        d.el.style.opacity = String(d.v * G.dots.alpha);
      });
    } else if (S.mode === "fly") {
      busy = true;
      const t = (now - S.t0) / 1000;
      const [x, y, r, s] = S.track!(t) as [number, number, number, number];
      Object.assign(S, { x, y, rot: r, sc: s, scT: s });
    } else if (S.mode === "phys") {
      busy = true;
      const out = stepBall(dt * PHYS.timeScale);
      const b = S.phys!;
      // draw between physics steps (b.acc is the unspent slice) so motion stays smooth at any refresh rate
      Object.assign(S, {
        x: b.x + b.vx * b.acc,
        y: b.y + b.vy * b.acc,
        rot: b.rot + b.w * b.acc,
        sc: flightScale(b.t),
        scT: flightScale(b.t),
      });
      drawTrail(dt);
      if (out === "score") {
        clearTrail();
        onScored();
      } else if (out === "miss") {
        clearTrail();
        onMissed();
      }
    }
    if (S.mode === "back") {
      busy = true;
      const u = clamp((now - S.b0) / 250, 0, 1);
      const e = 1 - (1 - u) ** 3 * Math.cos(u * 6) * (1 - u);
      S.x = lerp(S.bx, S.rest.x, e);
      S.y = lerp(S.by, S.rest.y, e);
      S.rot = lerp(S.br, 0, e);
      if (u >= 1) {
        S.mode = "idle";
      }
    }
    paint();
    S.raf = busy || S.auto || Math.abs(S.scT - S.sc) > 0.002 ? requestAnimationFrame(loop) : 0;
  }
  const kick = () => {
    if (!S.raf && !S.dead) {
      S.last = performance.now();
      S.raf = requestAnimationFrame(loop);
    }
  };

  /* ---- interaction (pointer + scripted demo share these three) ---- */
  const toStage = (e: { clientX: number; clientY: number }) => {
    const r = root.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const inHoopZone = (p: { x: number; y: number }) =>
    p.x >= HOOP_ZONE.x0 && p.x <= HOOP_ZONE.x1 && p.y >= HOOP_ZONE.y0 && p.y <= HOOP_ZONE.y1;
  const inBrowseArea = (p: { x: number; y: number }) =>
    inHoopZone(p) || (p.x >= G.dz.x && p.x <= G.dz.x + G.dz.w && p.y >= G.dz.y && p.y <= G.dz.y + G.dz.h);

  function grab(p: { x: number; y: number }) {
    if (S.mode !== "idle" || !S.queue.length) return;
    S.mode = "hold";
    S.held = 0;
    S.p0 = p;
    S.pull = { x: 0, y: 0 };
    S.scT = 1.12;
    fileEl.classList.add("lift");
    root.classList.add("aiming");
    label.style.transition = "opacity .12s";
    label.style.opacity = "0";
    dots.forEach((d) => (d.seen = 0));
    kick();
  }
  function drag(p: { x: number; y: number }) {
    if (S.mode !== "hold") return;
    let dx = p.x - S.p0.x;
    let dy = p.y - S.p0.y;
    const l = Math.hypot(dx, dy);
    const m = o.maxPull;
    if (l > m * 0.6) {
      const e = m * 0.6 + m * 0.4 * Math.tanh((l - m * 0.6) / (m * 0.4)); // rubber-band
      dx *= e / l;
      dy *= e / l;
    }
    S.pull = { x: dx, y: dy };
    S.x = S.rest.x + dx;
    S.y = S.rest.y + dy;
  }
  /** returns true when a shot was launched */
  function release(): boolean {
    if (S.mode !== "hold") return false;
    fileEl.classList.remove("lift");
    root.classList.remove("aiming");
    S.scT = 1;
    dots.forEach((d) => (d.el.style.opacity = "0"));
    const pl = Math.hypot(S.pull.x, S.pull.y);
    if (pl < o.minPull) {
      Object.assign(S, { mode: "back", b0: performance.now(), bx: S.x, by: S.y, br: S.rot });
      label.style.opacity = "1";
      kick();
      return false;
    }
    if (S.scripted) shoot(pl);
    else launchPhys();
    return true;
  }

  /* ---- shared celebration: tint, +1, net squash, sound, then the result row ---- */
  function celebrate(f: File | HuFileLike, k0: number, rowAt: number, tintOffAt: number, plusAt: number) {
    after(plusAt, () => {
      const anim = plus.animate(
        [
          { opacity: 0, transform: "translate(4px,12px) scale(.8)" },
          { opacity: 1, transform: "none", offset: 0.25 },
          { opacity: 1, transform: "none", offset: 0.65 },
          { opacity: 0, transform: "translateY(-6px)" },
        ],
        { duration: 600, easing: "ease-out" },
      );
      anim.onfinish = () => (plus.style.opacity = "0");
      net.animate(
        [
          { transform: "scale(1,1)" },
          { transform: "scale(.96,1.14)", offset: 0.4 },
          { transform: "scale(1,1)" },
        ],
        { duration: 450, easing: "ease-out" },
      );
    });
    after(tintOffAt, () => dz.classList.remove("on"));
    after(rowAt, () => {
      fileEl.style.transition = "opacity .17s";
      fileEl.style.opacity = "0";
      S.mode = "idle";
      void addRow(f);
      later(250, () => {
        if (S.queue.length) showBall();
        else syncShotUi();
      });
    });
  }

  /* ---- scripted slingshot: always scores (keyboard / demo; the recording) ---- */
  function shoot(pl: number = G.apexPull) {
    S.scripted = false;
    const f = S.queue.shift()!;
    layout();
    label.style.transition = "opacity .1s";
    label.style.opacity = "0";
    if (reduced) {
      S.mode = "idle";
      fileEl.style.opacity = "0";
      score(f);
      return;
    }
    const a = aim(S.x, S.y, pl);
    const pts: number[][] = [];
    for (let u = 0; u < 1; u += 0.2) {
      const [x, y] = para(S.x, S.y, a, u);
      pts.push([a.at * u, x, y, lerp(S.rot, 340, u), lerp(1.12, 0.9, u)]);
    }
    pts.push([a.at, a.ax, a.ay, 340, 0.9]);
    const sh = a.at - FINISH[0]![0];
    for (const [t, dx, dy, r, s] of FINISH.slice(1)) pts.push([t + sh, G.rim.x + dx, G.rim.y + dy, r, s]);
    S.track = makeTrack(pts);
    S.t0 = performance.now();
    S.mode = "fly";
    S.scT = 1.12;
    kick();
    const k0 = sh; // keep downstream events aligned with the finish sequence
    after(T.tintOn + k0, () => dz.classList.add("on"));
    after(T.score + k0, () => {
      playSound("success");
      if (o.countOnScore) setCount(++S.count);
    });
    celebrate(f, k0, T.row + k0, T.tintOff + k0, T.plusOne + k0);
  }
  function score(f: File | HuFileLike) {
    playSound("success");
    if (o.countOnScore) setCount(++S.count);
    void addRow(f);
    later(200, () => {
      showBall();
      syncShotUi();
    });
  }

  /* ---- shot mode: real physics ---- */
  const floorY = () => H - PHYS.pad;
  const flightScale = (t: number) =>
    1.12 - 0.22 * clamp(t / 0.52, 0, 1) - 0.1 * clamp((t - 0.52) / 0.23, 0, 1);

  function launchPhys() {
    const f = S.queue[0]!;
    const v = launchVel(S.pull);
    S.phys = {
      x: S.x,
      y: S.y,
      vx: v.vx,
      vy: v.vy,
      rot: S.rot,
      w: launchSpin(v),
      t: 0,
      still: 0,
      acc: 0,
      file: f,
    };
    S.noClick = true;
    later(0, () => (S.noClick = false));
    label.style.transition = "opacity .1s";
    label.style.opacity = "0";
    syncShotUi();
    if (reduced) {
      // no flight: resolve the shot instantly and show only the outcome
      let out: "score" | "miss" | null = null;
      for (let i = 0; i < 4000 && !out; i++) out = stepBall(1 / 120);
      fileEl.style.opacity = "0";
      S.mode = "idle";
      if (out === "score") score(S.queue.shift()!);
      else {
        const f = S.queue.shift()!;
        layout();
        playSound("fail");
        showMiss();
        missedFile(f);
      }
      S.phys = null;
      return;
    }
    S.mode = "phys";
    S.scT = 1.12;
    kick();
  }

  /** advance the ball by dt seconds; returns the outcome once it is decided */
  function stepBall(dt: number): "score" | "miss" | null {
    const b = S.phys!;
    const h = 1 / 240;
    const r = PHYS.ballR;
    const floor = floorY();
    b.acc += dt;
    while (b.acc >= h) {
      b.acc -= h;
      const prevY = b.y;
      b.vy += PHYS.g * h;
      b.x += b.vx * h;
      b.y += b.vy * h;
      b.rot += b.w * h;
      b.w *= 1 - PHYS.spinDrag * h;
      b.t += h;

      // walls of the dialog
      if (b.x < r) {
        b.x = r;
        b.vx = -b.vx * PHYS.wallE;
        b.w *= 0.7;
      } else if (b.x > G.W - r) {
        b.x = G.W - r;
        b.vx = -b.vx * PHYS.wallE;
        b.w *= 0.7;
      }
      // rim tube ends
      for (const cx of [G.rim.x - 47, G.rim.x + 47]) {
        const dx = b.x - cx;
        const dy = b.y - G.rim.y;
        const d = Math.hypot(dx, dy);
        const min = r + PHYS.tube;
        if (d < min && d > 1e-4) {
          const nx = dx / d;
          const ny = dy / d;
          b.x = cx + nx * min;
          b.y = G.rim.y + ny * min;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx -= (1 + PHYS.rimE) * vn * nx;
            b.vy -= (1 + PHYS.rimE) * vn * ny;
            b.w *= 0.65;
          }
        }
      }
      // through the hoop, downward, inside the rim
      if (prevY < G.rim.y && b.y >= G.rim.y && b.vy > 0 && Math.abs(b.x - G.rim.x) < 47 - 8) {
        return "score";
      }
      // floor
      if (b.y > floor - r) {
        b.y = floor - r;
        if (Math.abs(b.vy) > 90) {
          b.vy = -b.vy * PHYS.floorE;
          b.vx *= 0.8;
          b.w *= 0.6;
        } else b.vy = 0;
      }
    }
    const resting = b.y >= floor - r - 0.6 && Math.abs(b.vy) < 1 && Math.abs(b.vx) < 25;
    b.still = resting ? b.still + dt : 0;
    if (b.vy === 0 || resting) b.vx *= 0.96;
    if (b.still > 0.3 || b.t > 7) return "miss";
    return null;
  }

  function onScored() {
    const b = S.phys!;
    S.phys = null;
    const f = S.queue.shift()!;
    layout();
    playSound("success");
    // hand over to the recording's net finish: from where the ball crossed the rim, down through the
    // net to its resting place, landing exactly upright (a whole number of turns)
    const turns = b.w >= 0 ? Math.ceil((b.rot + 40) / 360) : Math.floor((b.rot - 40) / 360);
    const rotEnd = turns * 360;
    const s0 = flightScale(b.t);
    const tail = FINISH.slice(9); // [t, dx, dy, rot, scale] from the rim plane to the bottom of the net
    const t0 = tail[0]![0];
    const span = tail[tail.length - 1]![0] - t0;
    const pts: number[][] = [[0, b.x, b.y, b.rot, s0]];
    // the drop through the net plays at the recording's pace, stretched a little so it is easy to follow
    tail.forEach(([t, dx, dy], i) => {
      const u = (t - t0) / span;
      pts.push([0.05 + (t - t0) * 1.15 + i * 0.001, G.rim.x + dx, G.rim.y + dy, lerp(b.rot, rotEnd, easeInOut(u)), lerp(s0, 0.8, u)]);
    });
    S.track = makeTrack(pts);
    S.t0 = performance.now();
    S.mode = "fly";
    S.scT = s0;
    dz.classList.add("on");
    if (o.countOnScore) setCount(++S.count);
    kick();
    // the file settles in the net, stays there for a beat (~1.2 s), then disappears into the result row
    celebrate(f, 0, 1.25, 1.0, 0.12);
  }

  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  function flashToast(msg: string, kind: "ok" | "bad", ms = 2000) {
    toast.textContent = msg;
    toast.classList.remove("ok", "bad");
    toast.classList.add("show", kind);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = later(ms, () => toast.classList.remove("show"));
  }
  const showMiss = () => flashToast(text.miss, "bad", 1900);
  /** a missed shot is a failed upload: the file stays where it fell for a beat, then becomes a "Failed" row */
  function missedFile(f: File | HuFileLike) {
    o.onReject?.(f, "miss");
    fileEl.style.transition = "opacity .17s";
    fileEl.style.opacity = "0";
    S.mode = "idle";
    void addRow(f, text.missReason);
    later(250, () => {
      if (S.queue.length) showBall();
      else syncShotUi();
    });
  }
  function onMissed() {
    const f = S.queue.shift()!;
    S.phys = null;
    S.mode = "miss";
    layout();
    playSound("fail");
    showMiss();
    later(900, () => missedFile(f));
  }

  /* ---- sound: exactly two short synthesised tones, no files, no voice ---- */
  let audioCtx: AudioContext | null = null;
  function playSound(kind: "success" | "fail") {
    if (!o.sound || S.dead) return;
    try {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      audioCtx ??= new AC();
      const ctx = audioCtx;
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
      const t0 = ctx.currentTime + 0.01;
      // success: a soft rising major arpeggio (C5 E5 G5 C6) with a gentle bell-like decay
      // fail: a short low two-note "thud" that falls
      const notes =
        kind === "success"
          ? [
              { f: 523.25, at: 0, len: 0.34 },
              { f: 659.25, at: 0.075, len: 0.34 },
              { f: 783.99, at: 0.15, len: 0.36 },
              { f: 1046.5, at: 0.225, len: 0.55 },
            ]
          : [
              { f: 196, at: 0, len: 0.2 },
              { f: 147, at: 0.14, len: 0.34 },
            ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === "success" ? "sine" : "triangle";
        osc.frequency.setValueAtTime(n.f, t0 + n.at);
        const peak = kind === "success" ? 0.13 : 0.16;
        gain.gain.setValueAtTime(0.0001, t0 + n.at);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + n.at);
        osc.stop(t0 + n.at + n.len + 0.05);
      }
    } catch {
      /* audio is a nicety */
    }
  }

  function setCount(n: number) {
    // Several uploads can finish within one animation: always roll from the digit currently shown and
    // drop any digit still on its way out.
    const cur = odo.lastElementChild as HTMLElement;
    for (const stale of Array.from(odo.children)) if (stale !== cur) stale.remove();
    const nx = document.createElement("span");
    nx.textContent = String(n);
    odo.append(nx);
    const kf = (a: string, b: string): Keyframe[] => [
      { transform: `translateY(${a})`, opacity: a === "0" ? 1 : 0 },
      { transform: `translateY(${b})`, opacity: b === "0" ? 1 : 0 },
    ];
    cur.animate(kf("0", "-100%"), { duration: 250, easing: "ease-out", fill: "forwards" }).onfinish = () =>
      cur.remove();
    nx.animate(kf("100%", "0"), { duration: 250, easing: "ease-out" });
  }

  /* ---- result rows + upload ---- */
  const setBusy = (delta: number) => {
    const was = S.inflight > 0;
    S.inflight = Math.max(0, S.inflight + delta);
    const now = S.inflight > 0;
    if (was !== now) o.onBusyChange?.(now);
  };

  const simulate = (prog: (p: number) => void) =>
    new Promise<void>((res) => {
      const t0 = performance.now();
      (function f(n: number) {
        if (S.dead) return res();
        const u = clamp((n - t0) / o.uploadMs, 0, 1);
        prog(easeInOut(u));
        if (u < 1) requestAnimationFrame(f);
        else res();
      })(t0);
    });

  function relayoutRows() {
    S.rows
      .filter((row) => !row.dismissed)
      .forEach((row, i) => (row.el.style.top = i * (G.rows.h + G.rows.gap) + "px"));
    layout();
  }

  async function addRow(f: File | HuFileLike, preFail?: string) {
    const kd = kindOf(f);
    const el = document.createElement("div");
    el.className = "hu-row";
    el.innerHTML = `<div class="ico">${fileSVG(kd)}</div><div class="nm"></div><div class="sz">${fmtSize(f.size)}</div>
      <div class="st">${esc(text.uploading)}</div><div class="bar"><i></i></div>
      <div class="ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <button type="button" class="rm" aria-label="${esc(text.remove)}">×</button>`;
    (el.querySelector(".nm") as HTMLElement).textContent = f.name;
    const row: Row = { el, file: f, result: undefined, state: "uploading" };
    const n = S.rows.filter((existing) => !existing.dismissed).length;
    el.style.top = n * (G.rows.h + G.rows.gap) + "px";
    S.rows.push(row);
    rows.append(el);
    layout();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
    const bar = el.querySelector(".bar>i") as HTMLElement;
    const st = el.querySelector(".st") as HTMLElement;
    const prog = (p: number) => {
      if (!S.dead) bar.style.width = clamp(p, 0, 1) * 100 + "%";
    };

    (el.querySelector(".rm") as HTMLElement).addEventListener("click", (e) => {
      e.stopPropagation();
      removeRow(row);
    });

    if (preFail) {
      // a missed shot: never uploaded, shown as a failed row (remove it and add the file again to retry)
      row.state = "failed";
      el.classList.add("failed");
      st.textContent = text.failed;
      st.style.color = "#d33";
      st.title = preFail;
      return;
    }

    setBusy(1);
    try {
      await new Promise<void>((r) => later(100, r));
      if (S.dead) return;
      row.result = await (o.upload ? o.upload(f, prog) : simulate(prog));
      if (S.dead || !S.rows.includes(row)) return;
      prog(1);
      row.state = "done";
      // the counter counts finished uploads (never shots, never failures)
      if (!o.countOnScore) setCount(++S.count);
      flashToast(text.uploadedMsg, "ok");
      later(60, () => {
        el.classList.add("done");
        st.textContent = text.done;
      });
      o.onUploaded?.(f, row.result);
      later(4500, () => dismissRow(row));
    } catch (err) {
      if (S.dead) return;
      row.state = "failed";
      el.classList.add("failed");
      st.textContent = text.failed;
      st.style.color = "#d33";
      st.title = err instanceof Error ? err.message : "";
    } finally {
      setBusy(-1);
    }
  }

  function removeRow(row: Row) {
    const i = S.rows.indexOf(row);
    if (i === -1 || row.state === "uploading") return;
    S.rows.splice(i, 1);
    row.el.classList.add("out");
    if (row.state === "done") setCount(--S.count);
    o.onRemove?.(row.file, row.result);
    later(200, () => {
      row.el.remove();
      relayoutRows();
    });
    relayoutRows();
  }

  function dismissRow(row: Row) {
    if (row.state !== "done" || row.dismissed || !S.rows.includes(row)) return;
    row.dismissed = true;
    row.el.classList.add("out");
    later(200, () => row.el.remove());
    relayoutRows();
  }

  /* ---- validation ---- */
  const acceptTokens = o.accept
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const typeOk = (f: File | HuFileLike) => {
    if (acceptTokens.length === 0) return true;
    const name = f.name.toLowerCase();
    const mime = (f.type ?? "").toLowerCase();
    return acceptTokens.some((t) => {
      if (t.startsWith(".")) return name.endsWith(t);
      if (t.endsWith("/*")) return mime.startsWith(t.slice(0, -1));
      return mime === t;
    });
  };
  const fmtMax = (b: number) => (b >= 1e6 ? (b / 1e6).toFixed(b % 1e6 === 0 ? 0 : 1) + " MB" : Math.round(b / 1e3) + " KB");

  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  function flash(msg: string) {
    sub.textContent = msg;
    sub.style.color = "#d33";
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = later(4500, () => {
      flashTimer = null;
      syncShotUi();
    });
  }

  /* ---- public input paths ---- */
  type AddMode = { mode?: "direct" | "shot"; at?: { x: number; y: number } };
  /** Files go to the shot queue only while the switch is on; `mode` forces one or the other. */
  function addFiles(list: Iterable<File | HuFileLike> | ArrayLike<File>, opts: AddMode = {}) {
    if (o.disabled) {
      flash(text.disabled);
      return;
    }
    const incoming = Array.from(list as ArrayLike<File>);
    // rows that failed don't count: the visitor may try again
    let used = S.rows.filter((r) => r.state !== "failed").length + S.queue.length;
    const accepted: (File | HuFileLike)[] = [];
    let message = "";
    for (const f of incoming) {
      if (!typeOk(f)) {
        message ||= text.rejectType;
        o.onReject?.(f, "type");
      } else if (o.maxSize > 0 && f.size > o.maxSize) {
        message ||= text.rejectSize.replace("{max}", fmtMax(o.maxSize));
        o.onReject?.(f, "size");
      } else if (f.size <= 0) {
        message ||= text.rejectType;
        o.onReject?.(f, "type");
      } else if (used >= maxFiles) {
        message ||= text.rejectCount.replace("{n}", String(maxFiles));
        o.onReject?.(f, "count");
      } else {
        accepted.push(f);
        used++;
      }
    }
    if (message) flash(message);
    if (accepted.length === 0) return;

    if ((opts.mode ?? (S.shotOn ? "shot" : "direct")) === "direct") {
      // shot mode is off: straight to the upload, no shot
      root.classList.add("bb-hit");
      dz.classList.add("on");
      later(500, () => {
        root.classList.remove("bb-hit");
        dz.classList.remove("on");
      });
      for (const f of accepted) void addRow(f);
      return;
    }

    // shot mode: the file waits where it was dropped
    const at = opts.at ?? G.rest;
    if (S.queue.length === 0) {
      S.rest = {
        x: clamp(at.x, 40, G.W - 40),
        y: clamp(at.y, 100, Math.max(140, floorY() - 40)),
      };
    }
    S.shotMode = true;
    S.queue.push(...accepted);
    showBall();
    layout();
  }

  /** A row for a file that is already uploaded: no flight, no progress. */
  function restoreRow(f: File | HuFileLike, result: unknown) {
    const kd = kindOf(f);
    const el = document.createElement("div");
    el.className = "hu-row in done";
    el.innerHTML = `<div class="ico">${fileSVG(kd)}</div><div class="nm"></div><div class="sz">${fmtSize(f.size)}</div>
      <div class="st">${esc(text.done)}</div><div class="bar"><i style="width:100%"></i></div>
      <div class="ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <button type="button" class="rm" aria-label="${esc(text.remove)}">×</button>`;
    (el.querySelector(".nm") as HTMLElement).textContent = f.name;
    const row: Row = { el, file: f, result, state: "done" };
    el.style.top =
      S.rows.filter((existing) => !existing.dismissed).length * (G.rows.h + G.rows.gap) + "px";
    el.style.transition = "none";
    S.rows.push(row);
    rows.append(el);
    (el.querySelector(".rm") as HTMLElement).addEventListener("click", (e) => {
      e.stopPropagation();
      removeRow(row);
    });
    S.count++;
  }

  const onPointerDown = (e: PointerEvent) => {
    if (o.disabled || !waiting() || S.mode !== "idle" || S.scripted) return;
    const target = e.target as HTMLElement;
    if (target.closest(".rm")) return;
    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    grab(toStage(e));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (S.mode === "hold" && !S.scripted) drag(toStage(e));
  };
  const onPointerUp = () => {
    if (S.mode === "hold" && !S.scripted) {
      const launched = release();
      if (launched) {
        S.noClick = true;
        later(0, () => (S.noClick = false));
      }
    }
  };
  const onFileKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      autoShot();
    }
  };
  const openPicker = () => {
    if (o.disabled) {
      flash(text.disabled);
      return;
    }
    input.click();
  };
  /** clicking the backboard / drop card browses for files (they upload immediately) */
  const onRootClick = (e: MouseEvent) => {
    if (S.noClick) return;
    const t = e.target as HTMLElement;
    if (t.closest(".rm") || t.closest(".hu-file")) return;
    if (inBrowseArea(toStage(e))) openPicker();
  };
  const onDzKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };
  const onInputChange = () => {
    addFiles(input.files ?? []);
    input.value = "";
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (o.disabled) return;
    root.classList.toggle("bb-on", !S.shotOn);
    root.classList.toggle("shot-on", S.shotOn);
  };
  const clearDrag = () => {
    root.classList.remove("bb-on", "shot-on");
  };
  const onDragLeave = (e: DragEvent) => {
    if (!root.contains(e.relatedTarget as Node | null)) clearDrag();
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    clearDrag();
    const files = e.dataTransfer?.files ?? [];
    // direct upload unless shot mode is on; in shot mode the file waits where it was dropped
    addFiles(files, { at: toStage(e) });
  };

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerUp);
  root.addEventListener("click", onRootClick);
  fileEl.addEventListener("keydown", onFileKey);
  dz.addEventListener("keydown", onDzKey);
  input.addEventListener("change", onInputChange);
  root.addEventListener("dragenter", onDragOver);
  root.addEventListener("dragover", onDragOver);
  root.addEventListener("dragleave", onDragLeave);
  root.addEventListener("drop", onDrop);

  if (o.initialFiles.length > 0) {
    for (const it of o.initialFiles) restoreRow(it.file, it.result);
    (odo.firstElementChild as HTMLElement).textContent = String(S.count);
    layout();
  }

  syncShotUi();

  /** Shot mode was switched off: upload whatever is still waiting for a basket (once any throw in progress is over). */
  function flushQueue() {
    const go = () => {
      if (S.dead || S.shotOn) return;
      if (S.mode !== "idle") {
        later(120, go);
        return;
      }
      if (S.queue.length === 0) {
        syncShotUi();
        return;
      }
      const files = S.queue.splice(0);
      S.shotMode = false;
      fileEl.style.transition = "opacity .15s";
      fileEl.style.opacity = "0";
      label.style.opacity = "0";
      layout();
      for (const f of files) void addRow(f);
      syncShotUi();
    };
    go();
  }

  /* ---- scripted slingshot (keyboard / native drop / demo) ---- */
  const PULL_PATH: [number, number, number][] = [
    [0, 0, 0],
    [0.23, -1.5, 5.5],
    [0.37, -10.5, 17.5],
    [0.77, -12.5, 20],
    [0.9, -22.5, 28.5],
    [1.03, -26, 31],
    [1.3, -26, 31],
    [1.43, -22, 28.5],
    [1.57, -19, 27],
    [1.7, -18, 26.5],
    [1.95, -18, 26.5],
  ]; // t since press, dx, dy (dp)
  function autoShot(delay = 0) {
    if (S.mode !== "idle" || !S.queue.length || o.disabled) return;
    // Reduced motion: no scripted pull and no flight — go straight to the result row.
    if (reduced) {
      shoot();
      return;
    }
    const start = performance.now() + delay;
    S.scripted = true;
    S.auto = (now) => {
      const t = (now - start) / 1000;
      if (t < 0) return;
      if (S.mode === "idle" && t < 0.05) grab({ x: S.rest.x, y: S.rest.y });
      if (t >= PULL_PATH[PULL_PATH.length - 1]![0]) {
        S.auto = null;
        release();
        return;
      }
      let i = 0;
      while (PULL_PATH[i + 1]![0] < t) i++;
      const a = PULL_PATH[i]!;
      const b = PULL_PATH[i + 1]!;
      const u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
      drag({ x: S.rest.x + lerp(a[1], b[1], u), y: S.rest.y + lerp(a[2], b[2], u) });
    };
    kick();
  }
  /** replays the original recording: file fades in, hover, press, pull, release */
  function demo(name = "final_final_v7.pdf", size = 2.4e6) {
    S.queue.push({ name, size });
    later(100, showBall);
    autoShot(2000);
  }

  return {
    addFiles,
    shoot: autoShot,
    demo,
    setTheme,
    setDisabled(disabled: boolean) {
      o.disabled = disabled;
      root.classList.toggle("is-disabled", disabled);
    },
    setShotMode(on: boolean) {
      if (S.shotOn === on) return;
      S.shotOn = on;
      o.shotMode = on;
      if (!on) flushQueue();
      syncShotUi();
    },
    simulateShot(pull, from = S.rest) {
      const saved = S.phys;
      const v = launchVel(pull);
      S.phys = {
        x: from.x + pull.x,
        y: from.y + pull.y,
        vx: v.vx,
        vy: v.vy,
        rot: 0,
        w: launchSpin(v),
        t: 0,
        still: 0,
        acc: 0,
        file: { name: "sim", size: 1 },
      };
      let out: "score" | "miss" | null = null;
      for (let i = 0; i < 4000 && !out; i++) out = stepBall(1 / 120);
      S.phys = saved;
      return out ?? "miss";
    },
    root,
    destroy() {
      S.dead = true;
      S.timers.forEach(clearTimeout);
      S.timers = [];
      if (flashTimer) clearTimeout(flashTimer);
      cancelAnimationFrame(S.raf);
      S.raf = 0;
      S.auto = null;
      ro.disconnect();
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerUp);
      root.removeEventListener("click", onRootClick);
      fileEl.removeEventListener("keydown", onFileKey);
      dz.removeEventListener("keydown", onDzKey);
      void audioCtx?.close().catch(() => undefined);
      input.removeEventListener("change", onInputChange);
      root.removeEventListener("dragenter", onDragOver);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("dragleave", onDragLeave);
      root.removeEventListener("drop", onDrop);
      wrap.remove();
    },
  };
}

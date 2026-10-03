/**
 * Incremental parser for the model's streamed JSON.
 *
 * The model is constrained to emit
 *   {"reply":"…","form":{"title":…,"fields":[{…},{…}]}}
 * and we want the user to see the reply *as it is written* and each field
 * *as soon as it is complete* — without waiting for the closing brace.
 *
 * This is a small character-level state machine, not a general JSON parser:
 * it tracks string/escape state and container depth, emits decoded text for
 * the top-level "reply" string, and hands back the raw text of each complete
 * object inside form.fields. It never throws — malformed input just stops
 * producing events. The authoritative result is always the full-text
 * JSON.parse + validation done at the end (see draft.ts); this parser only
 * drives the live preview.
 */

export interface StreamParserEvents {
  onReplyDelta(text: string): void;
  onFieldObject(rawJson: string): void;
  /** Fires once, when the top-level "intent" string has been fully read. */
  onIntent?(intent: string): void;
}

interface Container {
  type: "obj" | "arr";
  /** The key this container was opened under in its parent (objects only matter). */
  key: string | null;
}

export class FormStreamParser {
  private readonly ev: StreamParserEvents;
  private buf = "";
  private i = 0;

  private stack: Container[] = [];
  private inString = false;
  private escape = false;
  private unicode: string | null = null; // collecting \uXXXX
  private stringRole: "key" | "value" = "value";
  private stringBuf = "";
  private expectingKey = false;
  private currentKey: string | null = null;
  private replyActive = false;
  private intentActive = false;
  private intentBuf = "";
  private replyText = "";
  private pendingHighSurrogate = "";
  private fieldStart = -1;
  private started = false;

  /** Hard cap so a runaway stream can't grow memory unbounded. */
  private static readonly MAX_CHARS = 200_000;

  constructor(events: StreamParserEvents) {
    this.ev = events;
  }

  get text(): string {
    return this.buf;
  }

  /** Decoded reply text emitted so far. */
  get replySoFar(): string {
    return this.replyText;
  }

  feed(chunk: string): void {
    if (this.buf.length + chunk.length > FormStreamParser.MAX_CHARS) {
      chunk = chunk.slice(0, Math.max(0, FormStreamParser.MAX_CHARS - this.buf.length));
    }
    this.buf += chunk;
    let replyOut = "";

    for (; this.i < this.buf.length; this.i++) {
      const ch = this.buf[this.i]!;

      if (!this.started) {
        // Ignore any prefix (e.g. ```json fences) until the first '{'.
        if (ch !== "{") continue;
        this.started = true;
      }

      if (this.inString) {
        replyOut += this.consumeStringChar(ch);
        continue;
      }

      switch (ch) {
        case '"':
          this.inString = true;
          this.stringBuf = "";
          this.stringRole = this.top()?.type === "obj" && this.expectingKey ? "key" : "value";
          this.replyActive =
            this.stringRole === "value" && this.stack.length === 1 && this.currentKey === "reply";
          this.intentActive =
            this.stringRole === "value" && this.stack.length === 1 && this.currentKey === "intent";
          this.intentBuf = "";
          break;
        case "{": {
          const key = this.currentKey;
          this.stack.push({ type: "obj", key });
          this.expectingKey = true;
          this.currentKey = null;
          if (this.isFieldObjectDepth()) this.fieldStart = this.i;
          break;
        }
        case "[":
          this.stack.push({ type: "arr", key: this.currentKey });
          this.expectingKey = false;
          this.currentKey = null;
          break;
        case "}": {
          if (this.isFieldObjectDepth() && this.fieldStart >= 0) {
            this.ev.onFieldObject(this.buf.slice(this.fieldStart, this.i + 1));
            this.fieldStart = -1;
          }
          this.stack.pop();
          this.expectingKey = false;
          break;
        }
        case "]":
          this.stack.pop();
          this.expectingKey = false;
          break;
        case ",":
          if (this.top()?.type === "obj") {
            this.expectingKey = true;
            this.currentKey = null;
          }
          break;
        case ":":
          this.expectingKey = false;
          break;
        default:
          break;
      }
    }

    if (replyOut) {
      this.replyText += replyOut;
      this.ev.onReplyDelta(replyOut);
    }
  }

  private top(): Container | undefined {
    return this.stack[this.stack.length - 1];
  }

  /** Root object → "form" object → "fields" array → a field object. */
  private isFieldObjectDepth(): boolean {
    return (
      this.stack.length === 4 &&
      this.stack[1]!.key === "form" &&
      this.stack[2]!.type === "arr" &&
      this.stack[2]!.key === "fields" &&
      this.stack[3]!.type === "obj"
    );
  }

  /** Returns decoded reply text produced by this character (usually "" or 1 char). */
  private consumeStringChar(ch: string): string {
    let out = "";

    if (this.unicode !== null) {
      this.unicode += ch;
      if (this.unicode.length === 4) {
        const code = parseInt(this.unicode, 16);
        this.unicode = null;
        if (!Number.isNaN(code)) out = this.emit(String.fromCharCode(code));
      }
      return out;
    }

    if (this.escape) {
      this.escape = false;
      switch (ch) {
        case "n": return this.emit("\n");
        case "t": return this.emit("\t");
        case "r": return this.emit("\r");
        case "b": return this.emit("\b");
        case "f": return this.emit("\f");
        case "u": this.unicode = ""; return "";
        default: return this.emit(ch); // \" \\ \/ and anything unexpected
      }
    }

    if (ch === "\\") {
      this.escape = true;
      return "";
    }

    if (ch === '"') {
      this.inString = false;
      if (this.stringRole === "key") this.currentKey = this.stringBuf;
      const flush = this.replyActive ? this.pendingHighSurrogate : "";
      this.pendingHighSurrogate = "";
      this.replyActive = false;
      if (this.intentActive) {
        this.intentActive = false;
        this.ev.onIntent?.(this.intentBuf);
      }
      return flush;
    }

    return this.emit(ch);
  }

  private emit(text: string): string {
    if (this.stringRole === "key") {
      this.stringBuf += text;
      return "";
    }
    if (this.intentActive) {
      this.intentBuf += text;
      return "";
    }
    if (!this.replyActive) return "";
    // Hold a lone high surrogate until its pair arrives so deltas stay valid UTF-16.
    let combined = this.pendingHighSurrogate + text;
    this.pendingHighSurrogate = "";
    const last = combined.charCodeAt(combined.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) {
      this.pendingHighSurrogate = combined.slice(-1);
      combined = combined.slice(0, -1);
    }
    return combined;
  }
}

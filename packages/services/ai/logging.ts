/** Minimal logger contract so the engine has no hard dependency on winston (and is testable). */
export interface AiLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const noopLogger: AiLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

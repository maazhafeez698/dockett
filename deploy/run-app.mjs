import { spawn } from "node:child_process";

const appRoot = "/app";
const children = new Map();
let stopping = false;
let exitCode = 0;
let forceExitTimer;

function finishIfStopped() {
  if (stopping && [...children.values()].every(({ closed }) => closed)) {
    clearTimeout(forceExitTimer);
    process.exit(exitCode);
  }
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;

  for (const { child, closed } of children.values()) {
    if (!closed) child.kill("SIGTERM");
  }

  forceExitTimer = setTimeout(() => {
    for (const { child, closed } of children.values()) {
      if (!closed) child.kill("SIGKILL");
    }
    process.exit(exitCode || 1);
  }, 10_000);

  finishIfStopped();
}

function start(name, args, cwd = appRoot) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env },
    stdio: "inherit",
  });
  const state = { child, closed: false };
  children.set(name, state);

  child.once("error", (error) => {
    process.stderr.write(`${name} failed to start: ${error.stack ?? error.message}\n`);
    stopAll(1);
  });

  child.once("close", (code, signal) => {
    state.closed = true;
    if (!stopping) {
      process.stderr.write(`${name} exited unexpectedly (code=${code}, signal=${signal})\n`);
      stopAll(code && code !== 0 ? code : 1);
    }
    finishIfStopped();
  });
}

process.once("SIGTERM", () => stopAll(0));
process.once("SIGINT", () => stopAll(0));

start("api", ["apps/api/dist/index.js"]);
start("web", [
  `${appRoot}/apps/web/node_modules/next/dist/bin/next`,
  "start",
  "--hostname",
  "0.0.0.0",
  "--port",
  "3000",
], `${appRoot}/apps/web`);

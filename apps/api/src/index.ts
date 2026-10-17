import http from "node:http";
import { logger } from "@repo/logger";
import { startUploadCleanup } from "@repo/trpc/server";
import { app as expressApplication } from "./server";

import { env } from "./env";

async function init() {
  try {
    const server = http.createServer(expressApplication);
    const PORT: number = env.PORT ? +env.PORT : 8000;
    const stopCleanup = startUploadCleanup();

    server.on("error", (err) => {
      logger.error("HTTP server error", { err });
      process.exit(1);
    });

    const shutdown = (signal: NodeJS.Signals) => {
      logger.info(`Received ${signal}; shutting down HTTP server`);
      stopCleanup();

      const timeout = setTimeout(() => {
        logger.error("HTTP server shutdown timed out");
        server.closeAllConnections();
        process.exit(1);
      }, 10_000);
      timeout.unref();

      server.close((err) => {
        clearTimeout(timeout);
        if (err) {
          logger.error("Error while closing HTTP server", { err });
          process.exitCode = 1;
          return;
        }
        process.exitCode = 0;
      });
      server.closeIdleConnections();
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));

    server.listen(PORT, () => {
      logger.info(`http server is running on PORT ${PORT}`);
    });
    // Removes abandoned / orphaned uploaded files from storage on a timer.
    server.on("close", stopCleanup);
  } catch (err) {
    logger.error(`Error creating http server`, { err });
    process.exit(1);
  }
}

init();

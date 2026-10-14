import http from "node:http";
import { logger } from "@repo/logger";
import { startUploadCleanup } from "@repo/trpc/server";
import { app as expressApplication } from "./server";

import { env } from "./env";

async function init() {
  try {
    const server = http.createServer(expressApplication);
    const PORT: number = env.PORT ? +env.PORT : 8000;
    server.listen(PORT, () => {
      logger.info(`http server is running on PORT ${PORT}`);
    });
    // Removes abandoned / orphaned uploaded files from storage on a timer.
    const stopCleanup = startUploadCleanup();
    server.on("close", stopCleanup);
  } catch (err) {
    logger.error(`Error creating http server`, { err });
    process.exit(1);
  }
}

init();

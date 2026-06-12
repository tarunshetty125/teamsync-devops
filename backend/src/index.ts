import "dotenv/config";
import { createServer } from "http";
import { config } from "./config/app.config";
import connectDatabase from "./config/database.config";
import app from "./app";
import { initializeRealtime } from "./realtime/socket-server";
import { startRetentionCleanupRunner } from "./services/retention-cleanup.service";

const startServer = async () => {
  await connectDatabase();

  const httpServer = createServer(app);
  initializeRealtime(httpServer);
  startRetentionCleanupRunner();

  httpServer.listen(config.PORT, () => {
    console.log(`Server listening on port ${config.PORT} in ${config.NODE_ENV}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

import "dotenv/config";
import connectDatabase from "../config/database.config";
import { runPendingMigrations } from "../services/migration.service";
import { migrations } from ".";
import mongoose from "mongoose";

const run = async () => {
  await connectDatabase();
  const result = await runPendingMigrations(migrations);

  console.log("Migrations completed", result);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Migration run failed", error);
  await mongoose.disconnect();
  process.exit(1);
});

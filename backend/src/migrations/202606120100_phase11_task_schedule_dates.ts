import TaskModel from "../models/task.model";
import { Migration } from "./types";

export const phase11TaskScheduleDatesMigration: Migration = {
  name: "202606120100_phase11_task_schedule_dates",
  up: async () => {
    await TaskModel.updateMany(
      {
        dueDate: { $ne: null },
        $or: [
          { startDate: null },
          { startDate: { $exists: false } },
          { endDate: null },
          { endDate: { $exists: false } },
        ],
      },
      [
        {
          $set: {
            startDate: "$createdAt",
            endDate: "$dueDate",
          },
        },
      ]
    );

    await TaskModel.updateMany(
      {
        $or: [{ dueDate: null }, { dueDate: { $exists: false } }],
      },
      {
        $set: {
          startDate: null,
          endDate: null,
        },
      }
    );

    await TaskModel.createIndexes();
  },
  down: async () => {
    // Keep scheduling data on rollback so users do not lose Gantt edits.
  },
};

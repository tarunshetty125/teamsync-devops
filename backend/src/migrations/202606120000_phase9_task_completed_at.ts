import { TaskStatusEnum } from "../enums/task.enum";
import TaskModel from "../models/task.model";
import { Migration } from "./types";

export const phase9TaskCompletedAtMigration: Migration = {
  name: "202606120000_phase9_task_completed_at",
  up: async () => {
    await TaskModel.updateMany(
      {
        status: TaskStatusEnum.DONE,
        $or: [{ completedAt: null }, { completedAt: { $exists: false } }],
      },
      [
        {
          $set: {
            completedAt: "$updatedAt",
          },
        },
      ]
    );

    await TaskModel.createIndexes();
  },
  down: async () => {
    // Preserve completedAt values so completion history is not lost on rollback.
  },
};

import { Router } from "express";
import {
  createCommentController,
  createCommentReplyController,
  deleteCommentController,
  getCommentRepliesController,
  getCommentsForTargetController,
  updateCommentController,
} from "../controllers/comment.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const commentRoutes = Router();

commentRoutes.get(
  "/workspace/:workspaceId/target/:targetType/:targetId",
  getCommentsForTargetController
);

commentRoutes.post(
  "/workspace/:workspaceId/target/:targetType/:targetId",
  writeApiRateLimiter,
  createCommentController
);

commentRoutes.get(
  "/workspace/:workspaceId/:commentId/replies",
  getCommentRepliesController
);

commentRoutes.post(
  "/workspace/:workspaceId/:commentId/reply",
  writeApiRateLimiter,
  createCommentReplyController
);

commentRoutes.put(
  "/workspace/:workspaceId/:commentId",
  writeApiRateLimiter,
  updateCommentController
);

commentRoutes.delete(
  "/workspace/:workspaceId/:commentId",
  writeApiRateLimiter,
  deleteCommentController
);

export default commentRoutes;

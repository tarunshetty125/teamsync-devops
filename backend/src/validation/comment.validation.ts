import mongoose from "mongoose";
import { z } from "zod";
import {
  CommentTargetType,
  CommentTargetTypeEnum,
} from "../enums/domain.enum";
import { objectIdSchema, paginationSchema } from "./common.validation";

const allowedNodes = new Set(["doc", "paragraph", "text", "mention", "hardBreak"]);
const allowedMarks = new Set(["bold", "italic", "link"]);

const isSafeLink = (href: unknown) => {
  if (typeof href !== "string" || href.length > 2048) {
    return false;
  }

  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateTiptapNode = (node: unknown, depth = 0): boolean => {
  if (!isPlainObject(node) || depth > 20) {
    return false;
  }

  const type = node.type;
  if (typeof type !== "string" || !allowedNodes.has(type)) {
    return false;
  }

  if (type === "text" && typeof node.text !== "string") {
    return false;
  }

  if (type === "mention") {
    const attrs = node.attrs;
    if (!isPlainObject(attrs) || typeof attrs.id !== "string") {
      return false;
    }
    if (!mongoose.Types.ObjectId.isValid(attrs.id)) {
      return false;
    }
  }

  if (Array.isArray(node.marks)) {
    const marksAreValid = node.marks.every((mark) => {
      if (!isPlainObject(mark) || typeof mark.type !== "string") {
        return false;
      }

      if (!allowedMarks.has(mark.type)) {
        return false;
      }

      if (mark.type === "link") {
        return isPlainObject(mark.attrs) && isSafeLink(mark.attrs.href);
      }

      return true;
    });

    if (!marksAreValid) {
      return false;
    }
  }

  if (node.content !== undefined) {
    if (!Array.isArray(node.content) || node.content.length > 500) {
      return false;
    }

    return node.content.every((child) => validateTiptapNode(child, depth + 1));
  }

  return true;
};

const bodyJsonSchema = z.custom<Record<string, unknown>>(
  (value) => validateTiptapNode(value),
  "Comment body is invalid"
);

export const commentIdSchema = objectIdSchema("Comment ID");
export const commentTargetIdSchema = objectIdSchema("Comment target ID");
export const commentTargetTypeSchema = z.enum(
  Object.values(CommentTargetTypeEnum) as [CommentTargetType, ...CommentTargetType[]]
);

export const commentBodySchema = z.object({
  bodyJson: bodyJsonSchema,
  plainText: z.string().trim().min(1).max(5000),
});

export const commentListQuerySchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

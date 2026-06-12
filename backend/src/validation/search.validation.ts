import { z } from "zod";
import { paginationSchema } from "./common.validation";

export const SearchResultTypeEnum = {
  PROJECT: "PROJECT",
  TASK: "TASK",
  COMMENT: "COMMENT",
  MEMBER: "MEMBER",
} as const;

export type SearchResultType =
  (typeof SearchResultTypeEnum)[keyof typeof SearchResultTypeEnum];

export const searchResultTypes = Object.values(SearchResultTypeEnum) as [
  SearchResultType,
  ...SearchResultType[]
];

const searchTypeArraySchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value
    .split(",")
    .map((type) => type.trim().toUpperCase())
    .filter(Boolean);
}, z.array(z.enum(searchResultTypes)).max(searchResultTypes.length).optional());

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  types: searchTypeArraySchema,
  limitPerType: z.coerce.number().int().min(1).max(10).default(5),
});

export const searchTypeParamSchema = z.enum(searchResultTypes);

export const searchTypeQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(2).max(100),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

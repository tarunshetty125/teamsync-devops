import path from "path";

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const fileStorageConfig = {
  LOCAL_FILE_STORAGE_DIR:
    process.env.LOCAL_FILE_STORAGE_DIR || path.resolve(process.cwd(), "uploads"),
  MAX_ATTACHMENT_BYTES: parsePositiveInteger(
    process.env.MAX_ATTACHMENT_BYTES,
    10 * 1024 * 1024
  ),
  MAX_AVATAR_BYTES: parsePositiveInteger(
    process.env.MAX_AVATAR_BYTES,
    2 * 1024 * 1024
  ),
};

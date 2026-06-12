import path from "path";
import { BadRequestException } from "./appError";

export const AllowedMimeTypes = {
  PNG: "image/png",
  JPEG: "image/jpeg",
  GIF: "image/gif",
  WEBP: "image/webp",
  PDF: "application/pdf",
} as const;

export type AllowedMimeType =
  (typeof AllowedMimeTypes)[keyof typeof AllowedMimeTypes];

const extensionByMimeType: Record<AllowedMimeType, string> = {
  [AllowedMimeTypes.PNG]: ".png",
  [AllowedMimeTypes.JPEG]: ".jpg",
  [AllowedMimeTypes.GIF]: ".gif",
  [AllowedMimeTypes.WEBP]: ".webp",
  [AllowedMimeTypes.PDF]: ".pdf",
};

export type ValidatedFile = {
  mimeType: AllowedMimeType;
  safeName: string;
  extension: string;
  kind: "image" | "pdf";
};

const detectMimeType = (buffer: Buffer): AllowedMimeType | null => {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return AllowedMimeTypes.PNG;
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return AllowedMimeTypes.JPEG;
  }

  const header = buffer.subarray(0, 12).toString("ascii");

  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) {
    return AllowedMimeTypes.GIF;
  }

  if (header.startsWith("RIFF") && header.substring(8, 12) === "WEBP") {
    return AllowedMimeTypes.WEBP;
  }

  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return AllowedMimeTypes.PDF;
  }

  return null;
};

export const sanitizeFilename = (
  originalName: string,
  extension: string
): string => {
  const normalizedName = originalName.replace(/\\/g, "/");
  const baseName = path.posix.basename(normalizedName);
  const parsed = path.parse(baseName);
  const name = (parsed.name || "file")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/[.-]+$/, "")
    .slice(0, 100);

  return `${name || "file"}${extension}`;
};

export const validateUploadedFile = ({
  buffer,
  originalName,
  maxBytes,
  avatarOnly = false,
}: {
  buffer: Buffer;
  originalName: string;
  maxBytes: number;
  avatarOnly?: boolean;
}): ValidatedFile => {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException("Uploaded file is empty");
  }

  if (buffer.length > maxBytes) {
    throw new BadRequestException("Uploaded file exceeds the size limit");
  }

  const mimeType = detectMimeType(buffer);

  if (!mimeType) {
    throw new BadRequestException("Unsupported or invalid file type");
  }

  const kind = mimeType === AllowedMimeTypes.PDF ? "pdf" : "image";

  if (avatarOnly && kind !== "image") {
    throw new BadRequestException("Avatar uploads must be image files");
  }

  const extension = extensionByMimeType[mimeType];

  return {
    mimeType,
    safeName: sanitizeFilename(originalName, extension),
    extension,
    kind,
  };
};

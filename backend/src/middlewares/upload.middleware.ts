import multer from "multer";
import { RequestHandler } from "express";
import { fileStorageConfig } from "../config/file-storage.config";
import { BadRequestException } from "../utils/appError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: fileStorageConfig.MAX_ATTACHMENT_BYTES,
    files: 1,
  },
});

export const singleFileUpload = (fieldName = "file"): RequestHandler => {
  const middleware = upload.single(fieldName);

  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError) {
        next(new BadRequestException(error.message));
        return;
      }

      next(error);
    });
  };
};

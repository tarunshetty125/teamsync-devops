import mongoose, { Document, Schema } from "mongoose";
import {
  DomainEntityType,
  DomainEntityTypeEnum,
  FileAssetStatusEnum,
  FileAssetStatusType,
  FileStorageProviderEnum,
  FileStorageProviderType,
} from "../enums/domain.enum";

export interface FileAssetDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  targetType: DomainEntityType;
  targetId: mongoose.Types.ObjectId;
  storageProvider: FileStorageProviderType;
  storageKey: string;
  originalName: string;
  safeName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  status: FileAssetStatusType;
  metadata?: Record<string, unknown>;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const fileAssetSchema = new Schema<FileAssetDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: Object.values(DomainEntityTypeEnum),
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    storageProvider: {
      type: String,
      enum: Object.values(FileStorageProviderEnum),
      required: true,
      default: FileStorageProviderEnum.LOCAL,
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    safeName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    checksum: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(FileAssetStatusEnum),
      required: true,
      default: FileAssetStatusEnum.AVAILABLE,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

fileAssetSchema.index({
  workspace: 1,
  targetType: 1,
  targetId: 1,
  status: 1,
  deletedAt: 1,
  createdAt: -1,
});
fileAssetSchema.index({ storageKey: 1 }, { unique: true });
fileAssetSchema.index({ workspace: 1, deletedAt: 1, createdAt: -1 });

const FileAssetModel = mongoose.model<FileAssetDocument>(
  "FileAsset",
  fileAssetSchema
);

export default FileAssetModel;

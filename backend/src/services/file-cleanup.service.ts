import { fileStorageConfig } from "../config/file-storage.config";
import {
  DomainEntityType,
  FileAssetStatusEnum,
} from "../enums/domain.enum";
import FileAssetModel from "../models/file-asset.model";
import { LocalStorageProvider } from "../storage/local-storage-provider";
import { ClientSession } from "mongoose";

const storageProvider = new LocalStorageProvider(
  fileStorageConfig.LOCAL_FILE_STORAGE_DIR
);

export const softDeleteFilesForTarget = async ({
  workspaceId,
  targetType,
  targetId,
  deletedBy,
  session,
  deletePhysical = true,
}: {
  workspaceId: string;
  targetType: DomainEntityType;
  targetId: string;
  deletedBy?: string | null;
  session?: ClientSession;
  deletePhysical?: boolean;
}) => {
  const files = await FileAssetModel.find({
    workspace: workspaceId,
    targetType,
    targetId,
    status: FileAssetStatusEnum.AVAILABLE,
    deletedAt: null,
  }).session(session || null);

  await Promise.all(
    files.map(async (file) => {
      await FileAssetModel.updateOne(
        { _id: file._id, deletedAt: null },
        {
          $set: {
            status: FileAssetStatusEnum.DELETED,
            deletedAt: new Date(),
            deletedBy: deletedBy || null,
          },
        }
      ).session(session || null);
      if (deletePhysical) {
        await storageProvider.delete(file.storageKey);
      }
    })
  );

  return files.map((file) => file.storageKey);
};

export const deleteStoredFiles = async (storageKeys: string[]) => {
  await Promise.all(storageKeys.map((storageKey) => storageProvider.delete(storageKey)));
};

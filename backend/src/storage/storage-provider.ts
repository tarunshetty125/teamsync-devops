export type StorageUploadInput = {
  workspaceId: string;
  targetType: string;
  targetId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  storageKey: string;
};

export type StorageUploadResult = {
  storageKey: string;
  url: string;
  sizeBytes: number;
};

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  delete(storageKey: string): Promise<void>;
  getUrl(storageKey: string): Promise<string>;
  exists(storageKey: string): Promise<boolean>;
}

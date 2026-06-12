import path from "path";
import fs from "fs/promises";
import { StorageProvider, StorageUploadInput } from "./storage-provider";

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  async upload(input: StorageUploadInput) {
    const storagePath = this.resolveStoragePath(input.storageKey);
    const storageDir = path.dirname(storagePath);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await fs.mkdir(storageDir, { recursive: true });
        await fs.writeFile(storagePath, input.bytes, { flag: "wx" });
        break;
      } catch (error) {
        if (
          attempt === 0 &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          continue;
        }

        throw error;
      }
    }

    return {
      storageKey: input.storageKey,
      url: "",
      sizeBytes: input.bytes.length,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const storagePath = this.resolveStoragePath(storageKey);

    try {
      await fs.unlink(storagePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async getUrl(storageKey: string): Promise<string> {
    return storageKey;
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.resolveStoragePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  resolveStoragePath(storageKey: string) {
    const resolvedPath = path.resolve(this.rootDir, storageKey);
    const resolvedRoot = path.resolve(this.rootDir);

    if (
      resolvedPath !== resolvedRoot &&
      !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)
    ) {
      throw new Error("Storage key resolves outside of the storage root");
    }

    return resolvedPath;
  }
}

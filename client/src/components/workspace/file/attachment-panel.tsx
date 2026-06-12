import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, ImageIcon, Loader, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Permissions } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import useWorkspaceId from "@/hooks/use-workspace-id";
import { toast } from "@/hooks/use-toast";
import { getApiAssetUrl } from "@/lib/base-url";
import {
  deleteFileAssetMutationFn,
  getFileAssetsQueryFn,
  uploadFileAssetMutationFn,
} from "@/lib/api";
import { FileAssetType, FileListResponseType, FileTargetType } from "@/types/api.type";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImage = (file: FileAssetType) => file.mimeType.startsWith("image/");
const isPdf = (file: FileAssetType) => file.mimeType === "application/pdf";

const FilePreview = ({ file }: { file: FileAssetType }) => {
  const src = getApiAssetUrl(file.previewPath);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setObjectUrl(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let nextObjectUrl: string | null = null;

    setIsLoading(true);
    setError(null);
    setObjectUrl(null);

    fetch(src, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Preview unavailable");
        }

        const blob = await response.blob();
        nextObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(nextObjectUrl);
      })
      .catch((previewError) => {
        if (controller.signal.aborted) return;

        setError(
          previewError instanceof Error
            ? previewError.message
            : "Preview unavailable"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [src]);

  if (isLoading) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        <Loader className="mr-2 h-4 w-4 animate-spin" />
        Loading preview...
      </div>
    );
  }

  if (error || !objectUrl) {
    return (
      <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 rounded-md border bg-muted/30 text-center text-sm text-muted-foreground">
        <FileText className="h-10 w-10" />
        <div>
          <p className="font-medium text-foreground">Preview unavailable</p>
          <p>This file may be demo metadata or the stored file is missing.</p>
        </div>
      </div>
    );
  }

  if (isImage(file)) {
    return (
      <img
        src={objectUrl}
        alt={file.safeName}
        className="max-h-[360px] w-full rounded-md border object-contain"
      />
    );
  }

  if (isPdf(file)) {
    return (
      <iframe
        src={objectUrl}
        title={file.safeName}
        className="h-[420px] w-full rounded-md border"
      />
    );
  }

  return null;
};

export default function AttachmentPanel({
  targetType,
  targetId,
}: {
  targetType: FileTargetType;
  targetId: string;
}) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { hasPermission, user } = useAuthContext();
  const [fileLimit, setFileLimit] = useState(20);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const queryKey = ["files", workspaceId, targetType, targetId, fileLimit];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      getFileAssetsQueryFn({
        workspaceId,
        targetType,
        targetId,
        pageNumber: 1,
        pageSize: fileLimit,
      }),
    enabled: Boolean(workspaceId && targetId),
  });

  const files = useMemo(() => data?.files || [], [data?.files]);
  const selectedFile = useMemo(
    () => files.find((file) => file._id === selectedFileId) || files[0],
    [files, selectedFileId]
  );

  const invalidateFiles = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  const uploadFile = useMutation({
    mutationFn: uploadFileAssetMutationFn,
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<FileListResponseType>(queryKey);
      const optimisticFile: FileAssetType = {
        _id: `uploading-${Date.now()}`,
        workspace: value.workspaceId,
        owner: user?._id || "",
        targetType: value.targetType,
        targetId: value.targetId,
        originalName: value.file.name,
        safeName: value.file.name,
        mimeType: value.file.type || "application/octet-stream",
        sizeBytes: value.file.size,
        checksum: "",
        status: "AVAILABLE",
        metadata: {
          kind: value.file.type === "application/pdf" ? "pdf" : "image",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        previewPath: "",
        downloadPath: "",
      };

      queryClient.setQueryData<FileListResponseType>(queryKey, (old) =>
        old
          ? {
              ...old,
              files: [optimisticFile, ...old.files],
              pagination: {
                ...old.pagination,
                totalCount: old.pagination.totalCount + 1,
              },
            }
          : old
      );

      return { previous };
    },
    onError: (error, _value, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      setSelectedFileId(data.file._id);
      toast({
        title: "File uploaded",
        description: data.file.safeName,
        variant: "success",
      });
    },
    onSettled: invalidateFiles,
  });

  const deleteFile = useMutation({
    mutationFn: deleteFileAssetMutationFn,
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<FileListResponseType>(queryKey);
      queryClient.setQueryData<FileListResponseType>(queryKey, (old) =>
        old
          ? {
              ...old,
              files: old.files.filter((file) => file._id !== value.fileId),
              pagination: {
                ...old.pagination,
                totalCount: Math.max(0, old.pagination.totalCount - 1),
              },
            }
          : old
      );
      return { previous };
    },
    onError: (error, _value, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: invalidateFiles,
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || uploadFile.isPending) return;

    uploadFile.mutate({
      workspaceId,
      targetType,
      targetId,
      file,
    });
  };

  const canUpload = hasPermission(Permissions.UPLOAD_FILE);
  const canDelete = hasPermission(Permissions.DELETE_FILE);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Files</h2>
          <p className="text-sm text-muted-foreground">
            Images and PDFs attached to this {targetType.toLowerCase()}.
          </p>
        </div>
        {canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadFile.isPending}
            >
              {uploadFile.isPending ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload
            </Button>
          </>
        )}
      </div>

      {selectedFile?.previewPath && <FilePreview file={selectedFile} />}

      {isLoading && <p className="text-sm text-muted-foreground">Loading files...</p>}
      {!isLoading && files.length === 0 && (
        <p className="text-sm text-muted-foreground">No files yet.</p>
      )}

      <div className="space-y-2">
        {files.map((file) => {
          const downloadUrl = getApiAssetUrl(file.downloadPath);
          const isOptimistic = file._id.startsWith("uploading-");

          return (
            <div
              key={file._id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => !isOptimistic && setSelectedFileId(file._id)}
                disabled={isOptimistic}
              >
                {isImage(file) ? (
                  <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {file.safeName}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatBytes(file.sizeBytes)}
                  </span>
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                {file.previewPath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFileId(file._id)}
                  >
                    Preview
                  </Button>
                )}
                {downloadUrl && (
                  <Button asChild type="button" variant="ghost" size="sm">
                    <a href={downloadUrl}>
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Download</span>
                    </a>
                  </Button>
                )}
                {canDelete && !isOptimistic && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={deleteFile.isPending}
                    onClick={() => {
                      if (window.confirm("Delete this file?")) {
                        deleteFile.mutate({ workspaceId, fileId: file._id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {data && files.length < data.pagination.totalCount && (
        <div className="flex justify-center">
          <button
            type="button"
            className="text-sm font-medium text-primary underline underline-offset-4"
            onClick={() => setFileLimit((value) => value + 20)}
          >
            Load more files
          </button>
        </div>
      )}
    </section>
  );
}

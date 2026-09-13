import { randomUUID } from "node:crypto";

export interface PresignUploadInput {
  storageKey: string;
  contentType: string;
  sizeBytes?: number;
}

export interface PresignUploadResult {
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface StoragePresigner {
  presignUpload(
    input: PresignUploadInput,
  ): Promise<PresignUploadResult>;
}

function cleanPathSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "");

  if (!cleaned) {
    throw new Error("Invalid storage path segment.");
  }

  return cleaned;
}

export function newStorageKey(
  tenantId: string,
  extension?: string,
): string {
  const tenant = cleanPathSegment(tenantId);
  const ext = extension
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return `vault/${tenant}/${randomUUID()}${ext ? `.${ext}` : ""}`;
}

/**
 * Development-only upload contract.
 *
 * Replace this implementation with an S3, Azure Blob, or GCS presigner
 * before enabling uploads in production.
 */
export const localPresigner: StoragePresigner = {
  async presignUpload(input) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Object-storage presigning is not configured.",
      );
    }

    const baseUrl =
      process.env.LOCAL_STORAGE_UPLOAD_URL ??
      "http://localhost:4000/dev-upload";

    return {
      uploadUrl:
        `${baseUrl.replace(/\/$/, "")}/${input.storageKey}`,
      method: "PUT",
      headers: {
        "content-type": input.contentType,
      },
    };
  },
};

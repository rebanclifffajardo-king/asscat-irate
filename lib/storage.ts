export type Bucket = "faculty-photos" | "avatars" | "system-assets";

/** Public URL for an object in a public bucket (null when no path). */
export function publicStorageUrl(bucket: Bucket, path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Validates an uploaded image by size, declared type AND magic bytes, so a
 * renamed script/HTML file cannot be stored as an "image".
 */
export async function validateImageFile(file: File): Promise<{ ok: true; ext: string } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "The selected file is empty." };
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, error: "Photo must be 2 MB or smaller." };
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Photo must be a JPG, PNG or WebP image." };
  }
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const isWebp =
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  if (isJpeg) return { ok: true, ext: "jpg" };
  if (isPng) return { ok: true, ext: "png" };
  if (isWebp) return { ok: true, ext: "webp" };
  return { ok: false, error: "The file content is not a valid JPG, PNG or WebP image." };
}

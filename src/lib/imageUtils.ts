/**
 * Client-side document & prescription image processing utility
 * Compresses and scales down images before uploading to Supabase Storage
 * Preserves high clarity for medical prescriptions and handwriting
 * Prevents massive payloads, high memory consumption, and statement timeouts.
 */

export interface ProcessedDocumentImage {
  dataUrl: string;
  blob: Blob;
  mimeType: string;
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Convert base64 data URL to Blob with validated MIME type and matching file extension.
 * Ensures no mismatched extensions (e.g. naming JPEG as WebP).
 */
export function dataUrlToBlob(dataUrl: string): {
  blob: Blob;
  mimeType: string;
  extension: "jpg" | "png" | "webp";
} {
  const parts = dataUrl.split(",");
  if (parts.length < 2) {
    throw new Error("بيانات الصورة غير صالحة للتحويل إلى ملف");
  }

  const mimeMatch = parts[0].match(/:(.*?);/);
  const detectedMime = mimeMatch ? mimeMatch[1] : "image/jpeg";

  // Validate exact MIME type
  let mimeType = "image/jpeg";
  let extension: "jpg" | "png" | "webp" = "jpg";

  if (detectedMime.includes("png")) {
    mimeType = "image/png";
    extension = "png";
  } else if (detectedMime.includes("webp")) {
    mimeType = "image/webp";
    extension = "webp";
  } else {
    mimeType = "image/jpeg";
    extension = "jpg";
  }

  const binaryString = atob(parts[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimeType });
  return { blob, mimeType, extension };
}

/**
 * Process and compress prescription / document image:
 * - Maximum bounds: 1200 x 1200 px (preserving aspect ratio)
 * - Compression quality: 0.8 JPEG for optimal balance of size & text legibility
 * - Enables high-precision image smoothing to protect handwritten prescriptions
 */
export async function processDocumentImage(
  fileOrDataUrl: File | string,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<ProcessedDocumentImage> {
  if (typeof window === "undefined") {
    const emptyBlob = new Blob([], { type: "image/jpeg" });
    return {
      dataUrl: typeof fileOrDataUrl === "string" ? fileOrDataUrl : "",
      blob: emptyBlob,
      mimeType: "image/jpeg",
      extension: "jpg",
      width: 0,
      height: 0,
      sizeBytes: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio and scale down if larger than maximum bounds
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d", { willReadFrequently: false });

        if (!ctx) {
          reject(new Error("تعذر إنشاء بيئة معالجة الصورة"));
          return;
        }

        // Enable high smoothing to preserve small medication text & doctor signatures
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Clean white background for transparency conversion
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const targetMime = "image/jpeg";
        const compressedDataUrl = canvas.toDataURL(targetMime, quality);
        const { blob, mimeType, extension } = dataUrlToBlob(compressedDataUrl);

        resolve({
          dataUrl: compressedDataUrl,
          blob,
          mimeType,
          extension,
          width,
          height,
          sizeBytes: blob.size,
        });
      } catch (err: any) {
        console.warn("[imageUtils] processDocumentImage error:", err);
        reject(new Error(`فشل معالجة الصورة: ${err?.message || "خطأ غير معروف"}`));
      }
    };

    img.onerror = () => {
      reject(new Error("فشل قراءة ملف الصورة المحدد. يرجى اختيار صورة صالحة."));
    };

    if (typeof fileOrDataUrl === "string") {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          img.src = result;
        } else {
          reject(new Error("تعذر قراءة بيانات الصورة من الجهاز"));
        }
      };
      reader.onerror = () => reject(new Error("تعذر قراءة ملف الصورة"));
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

/**
 * Backwards-compatible compress helper returning data URL string
 */
export async function compressImageFile(
  fileOrDataUrl: File | string,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<string> {
  // If already remote URL or SVG, keep as-is
  if (
    typeof fileOrDataUrl === "string" &&
    (fileOrDataUrl.startsWith("http://") ||
      fileOrDataUrl.startsWith("https://") ||
      fileOrDataUrl.startsWith("data:image/svg+xml"))
  ) {
    return fileOrDataUrl;
  }

  try {
    const result = await processDocumentImage(fileOrDataUrl, maxWidth, maxHeight, quality);
    return result.dataUrl;
  } catch (err) {
    console.warn("[imageUtils] compressImageFile fallback:", err);
    return typeof fileOrDataUrl === "string" ? fileOrDataUrl : "";
  }
}

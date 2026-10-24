/**
 * AKS-HCD EXIF-Preserving Client-Side Image Compressor (`src/lib/imageCompressor.ts`)
 *
 * Compresses large field photographs (> 1.2 MB) on the client before uploading to
 * `hcd-evidence-vault` over 3G/Edge networks, while splicing the original JPEG APP1 EXIF
 * GPS segment back into the compressed JPEG binary so cryptographic/geographic EXIF
 * provenance is never lost during compression.
 */

export interface ImageCompressionResult {
  file: File | Blob;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
  exifPreserved: boolean;
  compressionRatioPercent: number;
}

const COMPRESSION_THRESHOLD_BYTES = 1.2 * 1024 * 1024; // 1.2 MB
const MAX_DIMENSION_PX = 1920;
const JPEG_QUALITY = 0.84;

/**
 * Extracts raw JPEG APP1 (0xFFE1) EXIF segment bytes from an original JPEG ArrayBuffer
 * so they can be injected into a canvas-compressed JPEG output.
 */
function extractJpegApp1ExifSegment(buffer: ArrayBuffer): Uint8Array | null {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) {
      return null;
    }

    let offset = 2;
    const length = view.byteLength;

    while (offset + 4 < length) {
      const marker = view.getUint16(offset, false);
      if (marker === 0xffda || marker === 0xffd9) {
        break;
      }
      const segmentLength = view.getUint16(offset + 2, false);
      if (segmentLength < 2 || offset + 2 + segmentLength > length) {
        break;
      }

      // Check for APP1 (0xFFE1) with "Exif\0\0" magic header
      if (
        marker === 0xffe1 &&
        segmentLength >= 10 &&
        view.getUint32(offset + 4, false) === 0x45786966 &&
        view.getUint16(offset + 8, false) === 0x0000
      ) {
        return new Uint8Array(buffer.slice(offset, offset + 2 + segmentLength));
      }

      offset += 2 + segmentLength;
    }
  } catch {
    // Ignore malformed header
  }
  return null;
}

/**
 * Injects a saved APP1 EXIF segment immediately after the JPEG SOI marker (0xFFD8)
 * of a compressed JPEG ArrayBuffer.
 */
function injectJpegApp1ExifSegment(
  compressedJpegBuffer: ArrayBuffer,
  app1Segment: Uint8Array
): Blob {
  const compressedBytes = new Uint8Array(compressedJpegBuffer);
  if (compressedBytes.length < 4 || compressedBytes[0] !== 0xff || compressedBytes[1] !== 0xd8) {
    return new Blob([compressedJpegBuffer], { type: 'image/jpeg' });
  }

  const merged = new Uint8Array(compressedBytes.length + app1Segment.length);
  // 1. SOI marker (0xFF, 0xD8)
  merged[0] = 0xff;
  merged[1] = 0xd8;
  // 2. Original APP1 EXIF segment
  merged.set(app1Segment, 2);
  // 3. Rest of compressed JPEG stream
  merged.set(compressedBytes.subarray(2), 2 + app1Segment.length);

  return new Blob([merged], { type: 'image/jpeg' });
}

/**
 * Compresses large JPEG/PNG/WEBP images in browser environments while preserving original
 * JPEG EXIF GPS headers. Non-image files (PDF, MP4) or small images (< 1.2 MB) are returned untouched.
 */
export async function compressEvidenceImageBeforeUpload(
  file: File | Blob,
  fileName?: string
): Promise<ImageCompressionResult> {
  const originalSize = file.size;
  const name = (fileName || ('name' in file ? (file as File).name : 'evidence.jpg')).toLowerCase();
  const mime = (file.type || '').toLowerCase();

  const isCompressibleImage =
    mime === 'image/jpeg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp');

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !isCompressibleImage ||
    originalSize <= COMPRESSION_THRESHOLD_BYTES
  ) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
      exifPreserved: true,
      compressionRatioPercent: 0,
    };
  }

  try {
    // 1. Extract original APP1 EXIF header if source is JPEG
    let app1Segment: Uint8Array | null = null;
    if (mime === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      const headerSlice = await file.slice(0, 131072).arrayBuffer();
      app1Segment = extractJpegApp1ExifSegment(headerSlice);
    }

    // 2. Decode image and downscale onto canvas
    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageEl = new Image();
      imageEl.onload = () => resolve(imageEl);
      imageEl.onerror = (err) => reject(err);
      imageEl.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
        exifPreserved: true,
        compressionRatioPercent: 0,
      };
    }

    let targetW = srcW;
    let targetH = srcH;
    if (srcW > MAX_DIMENSION_PX || srcH > MAX_DIMENSION_PX) {
      const ratio = Math.min(MAX_DIMENSION_PX / srcW, MAX_DIMENSION_PX / srcH);
      targetW = Math.round(srcW * ratio);
      targetH = Math.round(srcH * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
        exifPreserved: true,
        compressionRatioPercent: 0,
      };
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const outputMime =
      mime === 'image/png' || mime === 'image/webp' ? mime : 'image/jpeg';

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outputMime, JPEG_QUALITY);
    });

    if (!compressedBlob || compressedBlob.size >= originalSize) {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
        exifPreserved: true,
        compressionRatioPercent: 0,
      };
    }

    let finalBlob: Blob = compressedBlob;
    let exifPreserved = false;

    if (app1Segment && outputMime === 'image/jpeg') {
      const compressedArrayBuffer = await compressedBlob.arrayBuffer();
      finalBlob = injectJpegApp1ExifSegment(compressedArrayBuffer, app1Segment);
      exifPreserved = true;
    }

    const safeFileName = fileName || ('name' in file ? (file as File).name : 'evidence.jpg');
    const outputFile =
      typeof File !== 'undefined'
        ? new File([finalBlob], safeFileName, {
            type: finalBlob.type || outputMime,
            lastModified: Date.now(),
          })
        : finalBlob;

    const savings = Math.max(
      0,
      Math.round(((originalSize - outputFile.size) / originalSize) * 100)
    );

    return {
      file: outputFile,
      originalSize,
      compressedSize: outputFile.size,
      wasCompressed: true,
      exifPreserved,
      compressionRatioPercent: savings,
    };
  } catch {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
      exifPreserved: true,
      compressionRatioPercent: 0,
    };
  }
}

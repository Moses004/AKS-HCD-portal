/**
 * AKS-HCD Binary EXIF GPS & Geotag Integrity Utility (`src/lib/exifParser.ts`)
 *
 * Responsibilities:
 * 1. Extract real GPS EXIF metadata (Latitude, Longitude, Camera Make/Model, DateTimeOriginal)
 *    from original JPEG/TIFF images without fabricating coordinates.
 * 2. Validate extracted GPS coordinates against Akwa Ibom State and LGA boundaries via `validateCoordinates`.
 * 3. Distinguish explicitly between:
 *    - GPS coordinates extracted from image EXIF metadata (`coordinateSource: 'exif_gps'`)
 *    - Coordinates entered manually by authorized staff (`coordinateSource: 'manual_entry'`)
 *    - Coordinates recorded separately for the activity (`coordinateSource: 'activity_location'`)
 *    - Images or files with no usable GPS metadata (`coordinateSource: 'none'`)
 * 4. Never automatically mark an uploaded image as EXIF-verified unless genuine EXIF GPS
 *    coordinates are extracted from the image binary and pass geographic validation.
 */

import { validateCoordinates, GeoFenceResult } from './geoFence';
import { CoordinateProvenance, ExifVerificationStatus, VerificationMedia } from '../types';

export interface ExifExtractionResult {
  hasExifGps: boolean;
  exifVerified: boolean;
  coordinateSource: CoordinateProvenance;
  exifStatus: ExifVerificationStatus;
  coordinates?: {
    lat: number;
    lng: number;
  };
  geoValidation?: GeoFenceResult;
  deviceMake?: string;
  deviceModel?: string;
  capturedAt?: string;
  message: string;
}

/**
 * Extract EXIF GPS coordinates from an image file (JPEG / TIFF APP1 segment)
 * and validate them against the portal's geographic fence for Akwa Ibom State and the target LGA.
 */
export async function extractExifGpsFromFile(
  file: File | Blob,
  lgaId?: string,
  fileName?: string
): Promise<ExifExtractionResult> {
  const name = (fileName || ('name' in file ? (file as File).name : '') || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  // Documents and videos do not carry photographic EXIF GPS IFD tags
  if (
    mime.includes('pdf') ||
    name.endsWith('.pdf') ||
    mime.startsWith('video/') ||
    name.endsWith('.mp4')
  ) {
    return {
      hasExifGps: false,
      exifVerified: false,
      coordinateSource: 'none',
      exifStatus: 'not_applicable',
      message: mime.startsWith('video/') || name.endsWith('.mp4')
        ? 'Video evidence file — EXIF photographic GPS metadata is not applicable. Activity location is recorded separately.'
        : 'PDF document — EXIF photographic GPS metadata is not applicable.',
    };
  }

  try {
    // Read up to first 128KB of file where JPEG APP1 EXIF header resides
    const slice = file.slice(0, 131072);
    const buffer = await slice.arrayBuffer();
    const parsed = parseExifFromArrayBuffer(buffer);

    if (
      parsed &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number' &&
      !isNaN(parsed.lat) &&
      !isNaN(parsed.lng)
    ) {
      const roundedLat = Number(parsed.lat.toFixed(6));
      const roundedLng = Number(parsed.lng.toFixed(6));
      const geo = validateCoordinates(roundedLat, roundedLng, lgaId);

      if (geo.status === 'VALID') {
        return {
          hasExifGps: true,
          exifVerified: true,
          coordinateSource: 'exif_gps',
          exifStatus: 'verified_exif',
          coordinates: { lat: roundedLat, lng: roundedLng },
          geoValidation: geo,
          deviceMake: parsed.make,
          deviceModel: parsed.model,
          capturedAt: parsed.dateTime,
          message: `EXIF GPS extracted (${roundedLat.toFixed(4)}°N, ${roundedLng.toFixed(4)}°E) — ${geo.message}`,
        };
      }

      if (geo.status === 'WARNING') {
        return {
          hasExifGps: true,
          exifVerified: true,
          coordinateSource: 'exif_gps',
          exifStatus: 'exif_warning',
          coordinates: { lat: roundedLat, lng: roundedLng },
          geoValidation: geo,
          deviceMake: parsed.make,
          deviceModel: parsed.model,
          capturedAt: parsed.dateTime,
          message: `EXIF GPS extracted (${roundedLat.toFixed(4)}°N, ${roundedLng.toFixed(4)}°E) within Akwa Ibom State — ${geo.message}`,
        };
      }

      return {
        hasExifGps: true,
        exifVerified: false,
        coordinateSource: 'exif_gps',
        exifStatus: 'exif_out_of_bounds',
        coordinates: { lat: roundedLat, lng: roundedLng },
        geoValidation: geo,
        deviceMake: parsed.make,
        deviceModel: parsed.model,
        capturedAt: parsed.dateTime,
        message: `EXIF GPS extracted (${roundedLat.toFixed(4)}°N, ${roundedLng.toFixed(4)}°E), but failed geographic validation: ${geo.message}`,
      };
    }

    return {
      hasExifGps: false,
      exifVerified: false,
      coordinateSource: 'none',
      exifStatus: 'no_exif_gps',
      deviceMake: parsed?.make,
      deviceModel: parsed?.model,
      capturedAt: parsed?.dateTime,
      message:
        'No usable GPS EXIF metadata embedded in this image. Activity coordinates are recorded separately; you may also record manual asset coordinates if needed.',
    };
  } catch {
    return {
      hasExifGps: false,
      exifVerified: false,
      coordinateSource: 'none',
      exifStatus: 'no_exif_gps',
      message:
        'Unable to read EXIF GPS header from image. Activity location is recorded separately.',
    };
  }
}

/**
 * Evaluate the coordinate & EXIF provenance of an existing or newly loaded VerificationMedia item
 * so the UI can accurately distinguish between EXIF GPS, manual coordinates, activity coordinates,
 * and unverified / missing GPS metadata.
 */
export function describeMediaGeotagProvenance(
  media: VerificationMedia,
  activityCoordinates?: { lat: number; lng: number },
  lgaId?: string
): {
  badgeLabel: string;
  badgeTone: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate';
  sourceLabel: string;
  validationSummary: string;
  coordinateSource: CoordinateProvenance;
  isValidatedInState: boolean;
} {
  if (media.type === 'document') {
    return {
      badgeLabel: 'Document Dossier',
      badgeTone: 'slate',
      sourceLabel: 'Document Attachment (No EXIF)',
      validationSummary: 'PDF / document verification asset.',
      coordinateSource: 'none',
      isValidatedInState: false,
    };
  }

  const coords = media.coordinates;
  const hasCoords =
    coords !== undefined &&
    coords !== null &&
    typeof coords.lat === 'number' &&
    typeof coords.lng === 'number' &&
    !isNaN(coords.lat) &&
    !isNaN(coords.lng);

  // Determine source provenance without falsely claiming EXIF when coordinates match activity defaults
  let source: CoordinateProvenance = media.coordinateSource || 'none';
  if (!media.coordinateSource) {
    if (hasCoords && media.exifVerified === true) {
      // Check if coordinates are identical to the activity coordinates and no exifStatus was recorded
      const matchesActivityExactly =
        activityCoordinates &&
        Math.abs(coords!.lat - activityCoordinates.lat) < 0.00001 &&
        Math.abs(coords!.lng - activityCoordinates.lng) < 0.00001;

      if (matchesActivityExactly && !media.exifStatus) {
        source = 'activity_location';
      } else {
        source = 'exif_gps';
      }
    } else if (hasCoords) {
      source = 'manual_entry';
    } else {
      source = 'none';
    }
  }

  if (!hasCoords || source === 'none') {
    return {
      badgeLabel: media.type === 'video' ? 'Video Clip (No GPS)' : 'No Usable EXIF GPS',
      badgeTone: 'slate',
      sourceLabel: 'No GPS Metadata in File',
      validationSummary:
        media.exifMessage ||
        (activityCoordinates
          ? `Image has no embedded EXIF GPS. Activity location (${activityCoordinates.lat.toFixed(4)}°N, ${activityCoordinates.lng.toFixed(4)}°E) is recorded separately.`
          : 'Image has no embedded EXIF GPS metadata.'),
      coordinateSource: 'none',
      isValidatedInState: false,
    };
  }

  const geo = validateCoordinates(coords!.lat, coords!.lng, lgaId);
  const isValidatedInState = geo.status === 'VALID' || geo.status === 'WARNING';

  if (source === 'exif_gps') {
    if (geo.status === 'VALID' && media.exifVerified) {
      return {
        badgeLabel: 'EXIF GPS Verified',
        badgeTone: 'emerald',
        sourceLabel: 'Extracted from Image EXIF Metadata',
        validationSummary: `${coords!.lat.toFixed(4)}°N, ${coords!.lng.toFixed(4)}°E · ${geo.message}`,
        coordinateSource: 'exif_gps',
        isValidatedInState: true,
      };
    }
    if (geo.status === 'WARNING') {
      return {
        badgeLabel: 'EXIF GPS (Perimeter Notice)',
        badgeTone: 'amber',
        sourceLabel: 'Extracted from Image EXIF Metadata',
        validationSummary: `${coords!.lat.toFixed(4)}°N, ${coords!.lng.toFixed(4)}°E · ${geo.message}`,
        coordinateSource: 'exif_gps',
        isValidatedInState: true,
      };
    }
    return {
      badgeLabel: 'EXIF GPS Out of Bounds',
      badgeTone: 'rose',
      sourceLabel: 'Extracted from Image EXIF Metadata',
      validationSummary: `${coords!.lat.toFixed(4)}°N, ${coords!.lng.toFixed(4)}°E · ${geo.message}`,
      coordinateSource: 'exif_gps',
      isValidatedInState: false,
    };
  }

  if (source === 'manual_entry') {
    return {
      badgeLabel: isValidatedInState ? 'Manual Coords (Validated)' : 'Manual Coords (Out of Bounds)',
      badgeTone: isValidatedInState ? 'blue' : 'rose',
      sourceLabel: 'Entered Manually by Officer (No EXIF)',
      validationSummary: `${coords!.lat.toFixed(4)}°N, ${coords!.lng.toFixed(4)}°E · ${geo.message}`,
      coordinateSource: 'manual_entry',
      isValidatedInState,
    };
  }

  // source === 'activity_location'
  return {
    badgeLabel: isValidatedInState ? 'Activity Location Coords' : 'Activity Coords (Out of Bounds)',
    badgeTone: isValidatedInState ? 'blue' : 'amber',
    sourceLabel: 'Recorded for Activity (Not Image EXIF)',
    validationSummary: `${coords!.lat.toFixed(4)}°N, ${coords!.lng.toFixed(4)}°E · Recorded at activity level (${geo.message})`,
    coordinateSource: 'activity_location',
    isValidatedInState,
  };
}

interface ParsedExifData {
  lat?: number;
  lng?: number;
  make?: string;
  model?: string;
  dateTime?: string;
}

/**
 * Low-level JPEG APP1 EXIF / TIFF IFD parser for extracting GPS tags
 */
export function parseExifFromArrayBuffer(buffer: ArrayBuffer): ParsedExifData | null {
  const view = new DataView(buffer);
  if (view.byteLength < 12) return null;

  // Check JPEG SOI marker (0xFFD8)
  if (view.getUint16(0, false) !== 0xffd8) {
    return null;
  }

  let offset = 2;
  const length = view.byteLength;

  while (offset + 4 < length) {
    const marker = view.getUint16(offset, false);
    offset += 2;

    // SOS (Start of Scan) or EOI (End of Image)
    if (marker === 0xffda || marker === 0xffd9) {
      break;
    }

    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > length) {
      break;
    }

    // APP1 marker (0xFFE1) with "Exif\0\0" header
    if (marker === 0xffe1 && segmentLength >= 10) {
      const exifHeader =
        view.getUint32(offset + 2, false) === 0x45786966 && // "Exif"
        view.getUint16(offset + 6, false) === 0x0000;
      if (exifHeader) {
        return parseTiffHeader(view, offset + 8, segmentLength - 8);
      }
    }

    offset += segmentLength;
  }

  return null;
}

function parseTiffHeader(view: DataView, tiffStart: number, maxLen: number): ParsedExifData | null {
  if (tiffStart + 8 > view.byteLength) return null;

  const byteOrder = view.getUint16(tiffStart, false);
  let littleEndian = false;
  if (byteOrder === 0x4949) {
    littleEndian = true; // "II" Intel
  } else if (byteOrder === 0x4d4d) {
    littleEndian = false; // "MM" Motorola
  } else {
    return null;
  }

  const magic = view.getUint16(tiffStart + 2, littleEndian);
  if (magic !== 0x002a) return null;

  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0Start = tiffStart + firstIfdOffset;
  if (ifd0Start + 2 > view.byteLength) return null;

  const result: ParsedExifData = {};
  let gpsIfdPointer: number | null = null;
  let exifSubIfdPointer: number | null = null;

  const numEntries = view.getUint16(ifd0Start, littleEndian);
  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifd0Start + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);

    // 0x010F: Make
    if (tag === 0x010f && type === 2) {
      result.make = readAsciiString(view, tiffStart, entryOffset, count, littleEndian);
    }
    // 0x0110: Model
    if (tag === 0x0110 && type === 2) {
      result.model = readAsciiString(view, tiffStart, entryOffset, count, littleEndian);
    }
    // 0x0132: DateTime
    if (tag === 0x0132 && type === 2 && !result.dateTime) {
      result.dateTime = readAsciiString(view, tiffStart, entryOffset, count, littleEndian);
    }
    // 0x8769: ExifSubIFD Pointer
    if (tag === 0x8769 && type === 4) {
      exifSubIfdPointer = view.getUint32(entryOffset + 8, littleEndian);
    }
    // 0x8825: GPS IFD Pointer
    if (tag === 0x8825 && type === 4) {
      gpsIfdPointer = view.getUint32(entryOffset + 8, littleEndian);
    }
  }

  // Read DateTimeOriginal (0x9003) from ExifSubIFD if available
  if (exifSubIfdPointer !== null) {
    const subStart = tiffStart + exifSubIfdPointer;
    if (subStart + 2 <= view.byteLength) {
      const subEntries = view.getUint16(subStart, littleEndian);
      for (let i = 0; i < subEntries; i++) {
        const entryOffset = subStart + 2 + i * 12;
        if (entryOffset + 12 > view.byteLength) break;
        const tag = view.getUint16(entryOffset, littleEndian);
        const type = view.getUint16(entryOffset + 2, littleEndian);
        const count = view.getUint32(entryOffset + 4, littleEndian);
        if (tag === 0x9003 && type === 2) {
          result.dateTime = readAsciiString(view, tiffStart, entryOffset, count, littleEndian);
        }
      }
    }
  }

  // Read GPS IFD tags if pointer exists
  if (gpsIfdPointer !== null) {
    const gpsStart = tiffStart + gpsIfdPointer;
    if (gpsStart + 2 <= view.byteLength && gpsPointerWithinBounds(gpsIfdPointer, maxLen)) {
      const gpsEntries = view.getUint16(gpsStart, littleEndian);
      let latRef = 'N';
      let lngRef = 'E';
      let latDms: [number, number, number] | null = null;
      let lngDms: [number, number, number] | null = null;

      for (let i = 0; i < gpsEntries; i++) {
        const entryOffset = gpsStart + 2 + i * 12;
        if (entryOffset + 12 > view.byteLength) break;

        const tag = view.getUint16(entryOffset, littleEndian);
        const type = view.getUint16(entryOffset + 2, littleEndian);
        const count = view.getUint32(entryOffset + 4, littleEndian);

        // 0x0001: GPSLatitudeRef ('N' or 'S')
        if (tag === 0x0001 && type === 2) {
          const ref = readAsciiString(view, tiffStart, entryOffset, count, littleEndian);
          if (ref) latRef = ref.trim().toUpperCase().charAt(0) || 'N';
        }
        // 0x0002: GPSLatitude (3 RATIONALs)
        if (tag === 0x0002 && type === 5 && count === 3) {
          latDms = readThreeRationals(view, tiffStart, entryOffset, littleEndian);
        }
        // 0x0003: GPSLongitudeRef ('E' or 'W')
        if (tag === 0x0003 && type === 2) {
          const ref = readAsciiString(view, tiffStart, entryOffset, count, littleEndian);
          if (ref) lngRef = ref.trim().toUpperCase().charAt(0) || 'E';
        }
        // 0x0004: GPSLongitude (3 RATIONALs)
        if (tag === 0x0004 && type === 5 && count === 3) {
          lngDms = readThreeRationals(view, tiffStart, entryOffset, littleEndian);
        }
      }

      if (latDms && lngDms) {
        let decimalLat = latDms[0] + latDms[1] / 60 + latDms[2] / 3600;
        let decimalLng = lngDms[0] + lngDms[1] / 60 + lngDms[2] / 3600;

        if (latRef === 'S') decimalLat = -decimalLat;
        if (lngRef === 'W') decimalLng = -decimalLng;

        if (isFinite(decimalLat) && isFinite(decimalLng) && (decimalLat !== 0 || decimalLng !== 0)) {
          result.lat = decimalLat;
          result.lng = decimalLng;
        }
      }
    }
  }

  return result;
}

function gpsPointerWithinBounds(pointer: number, maxLen: number): boolean {
  return pointer > 0 && pointer < maxLen;
}

function readAsciiString(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  count: number,
  littleEndian: boolean
): string | undefined {
  if (count <= 0 || count > 256) return undefined;
  const valueOffset =
    count <= 4 ? entryOffset + 8 : tiffStart + view.getUint32(entryOffset + 8, littleEndian);
  if (valueOffset + count > view.byteLength) return undefined;

  let str = '';
  for (let i = 0; i < count - 1; i++) {
    const ch = view.getUint8(valueOffset + i);
    if (ch === 0) break;
    if (ch >= 32 && ch <= 126) {
      str += String.fromCharCode(ch);
    }
  }
  return str.trim() || undefined;
}

function readThreeRationals(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  littleEndian: boolean
): [number, number, number] | null {
  const valueOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
  if (valueOffset + 24 > view.byteLength) return null;

  const values: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const num = view.getUint32(valueOffset + i * 8, littleEndian);
    const den = view.getUint32(valueOffset + i * 8 + 4, littleEndian);
    if (den === 0) return null;
    values[i] = num / den;
  }
  return values;
}

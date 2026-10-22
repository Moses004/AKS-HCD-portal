import assert from 'node:assert/strict';
import {
  validateMediaFile,
  validateAttendanceRegistryPdf,
  replaceVerificationAssetInList,
  removeVerificationAssetFromList,
  evaluateActivityEditPermission,
  extractCanonicalAttendanceStoragePath,
  isCanonicalStorageReference,
} from '../src/lib/mediaResolver';
import {
  extractExifGpsFromFile,
  parseExifFromArrayBuffer,
  describeMediaGeotagProvenance,
} from '../src/lib/exifParser';
import { validateCoordinates } from '../src/lib/geoFence';
import { HCDActivity, UserSession, VerificationMedia } from '../src/types';

// Helper to construct a minimal valid JPEG with APP1 EXIF GPS IFD in memory
function createJpegWithExifGps(latDeg: number, lngDeg: number, latRef = 'N', lngRef = 'E'): ArrayBuffer {
  const buf = new ArrayBuffer(256);
  const view = new DataView(buf);
  let offset = 0;

  // JPEG SOI
  view.setUint16(offset, 0xffd8, false);
  offset += 2;

  // APP1 Marker
  view.setUint16(offset, 0xffe1, false);
  offset += 2;

  const app1LengthOffset = offset;
  offset += 2;

  // "Exif\0\0"
  view.setUint32(offset, 0x45786966, false);
  offset += 4;
  view.setUint16(offset, 0x0000, false);
  offset += 2;

  const tiffStart = offset;
  // Big-endian "MM" (0x4D4D), magic 42 (0x002A), IFD0 offset 8
  view.setUint16(offset, 0x4d4d, false);
  offset += 2;
  view.setUint16(offset, 0x002a, false);
  offset += 2;
  view.setUint32(offset, 8, false);
  offset += 4;

  // IFD0 at tiffStart + 8: 1 entry (GPSInfoTag = 0x8825, type LONG=4, count=1, value=offset to GPS IFD)
  const gpsIfdOffset = 8 + 2 + 12 + 4; // 26
  view.setUint16(offset, 1, false);
  offset += 2;
  view.setUint16(offset, 0x8825, false);
  offset += 2;
  view.setUint16(offset, 4, false);
  offset += 2;
  view.setUint32(offset, 1, false);
  offset += 4;
  view.setUint32(offset, gpsIfdOffset, false);
  offset += 4;
  view.setUint32(offset, 0, false);
  offset += 4;

  // GPS IFD at tiffStart + 26: 4 entries
  view.setUint16(offset, 4, false);
  offset += 2;

  const latValuesOffset = gpsIfdOffset + 2 + 4 * 12 + 4; // 80
  const lngValuesOffset = latValuesOffset + 24; // 104

  // Entry 1: GPSLatitudeRef (0x0001), ASCII (2), count 2
  view.setUint16(offset, 0x0001, false);
  offset += 2;
  view.setUint16(offset, 2, false);
  offset += 2;
  view.setUint32(offset, 2, false);
  offset += 4;
  view.setUint8(offset, latRef.charCodeAt(0));
  view.setUint8(offset + 1, 0);
  view.setUint16(offset + 2, 0, false);
  offset += 4;

  // Entry 2: GPSLatitude (0x0002), RATIONAL (5), count 3
  view.setUint16(offset, 0x0002, false);
  offset += 2;
  view.setUint16(offset, 5, false);
  offset += 2;
  view.setUint32(offset, 3, false);
  offset += 4;
  view.setUint32(offset, latValuesOffset, false);
  offset += 4;

  // Entry 3: GPSLongitudeRef (0x0003), ASCII (2), count 2
  view.setUint16(offset, 0x0003, false);
  offset += 2;
  view.setUint16(offset, 2, false);
  offset += 2;
  view.setUint32(offset, 2, false);
  offset += 4;
  view.setUint8(offset, lngRef.charCodeAt(0));
  view.setUint8(offset + 1, 0);
  view.setUint16(offset + 2, 0, false);
  offset += 4;

  // Entry 4: GPSLongitude (0x0004), RATIONAL (5), count 3
  view.setUint16(offset, 0x0004, false);
  offset += 2;
  view.setUint16(offset, 5, false);
  offset += 2;
  view.setUint32(offset, 3, false);
  offset += 4;
  view.setUint32(offset, lngValuesOffset, false);
  offset += 4;

  // End of GPS IFD
  view.setUint32(offset, 0, false);
  offset += 4;

  // Write 3 RATIONALs for Latitude
  view.setUint32(tiffStart + latValuesOffset, Math.round(latDeg * 10000), false);
  view.setUint32(tiffStart + latValuesOffset + 4, 10000, false);
  view.setUint32(tiffStart + latValuesOffset + 8, 0, false);
  view.setUint32(tiffStart + latValuesOffset + 12, 1, false);
  view.setUint32(tiffStart + latValuesOffset + 16, 0, false);
  view.setUint32(tiffStart + latValuesOffset + 20, 1, false);

  // Write 3 RATIONALs for Longitude
  view.setUint32(tiffStart + lngValuesOffset, Math.round(lngDeg * 10000), false);
  view.setUint32(tiffStart + lngValuesOffset + 4, 10000, false);
  view.setUint32(tiffStart + lngValuesOffset + 8, 0, false);
  view.setUint32(tiffStart + lngValuesOffset + 12, 1, false);
  view.setUint32(tiffStart + lngValuesOffset + 16, 0, false);
  view.setUint32(tiffStart + lngValuesOffset + 20, 1, false);

  const endOffset = tiffStart + lngValuesOffset + 24;
  view.setUint16(app1LengthOffset, endOffset - app1LengthOffset, false);
  view.setUint16(endOffset, 0xffd9, false);

  return buf.slice(0, endOffset + 2);
}

async function runVerificationSuite() {
  console.log('=== AKS-HCD LGA Desk Workspace Draft Editing & Evidence Replacement Verification ===\n');

  const baseDraftActivity: HCDActivity = {
    id: 'act-uyo-draft-001',
    lgaId: 'uyo',
    lgaName: 'Uyo',
    title: 'Uyo Youth Technical & Solar Installation Training',
    pillar: 'vocational',
    projectDescription: 'Technical & Vocational Skills Training',
    community: 'Ikot Oku Ikono Ward 1',
    coordinates: { lat: 5.0377, lng: 7.9128 },
    beneficiariesTotal: 120,
    beneficiariesMale: 60,
    beneficiariesFemale: 60,
    youthBeneficiaries: 100,
    budgetNgn: 8500000,
    startDate: '2026-02-01',
    completionDate: '2026-03-01',
    leadOfficer: 'Moses Archibong',
    officerContact: '+234 803 000 1111',
    status: 'DRAFT',
    mediaAssets: [
      {
        id: 'asset-1',
        type: 'photo',
        url: '',
        storagePath: 'uyo/act-uyo-draft-001/1700000001-photo1.jpg',
        caption: 'Field photo 1',
        fileName: 'photo1.jpg',
        fileSize: '1.2 MB',
        exifVerified: true,
        coordinateSource: 'exif_gps',
        coordinates: { lat: 5.0377, lng: 7.9128 },
        uploadTimestamp: '2026-02-10T10:00:00Z',
      },
      {
        id: 'asset-2',
        type: 'document',
        url: '',
        storagePath: 'uyo/act-uyo-draft-001/1700000002-field_log.pdf',
        caption: 'Field log PDF',
        fileName: 'field_log.pdf',
        fileSize: '0.8 MB',
        exifVerified: false,
        coordinateSource: 'none',
        uploadTimestamp: '2026-02-10T10:05:00Z',
      },
    ],
    attendanceRegistryUrl: 'uyo/act-uyo-draft-001/1700000000-attendance.pdf',
    attendanceSheetFileName: 'Uyo_Attendance_Registry.pdf',
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-02-10T10:05:00Z',
  };

  const uyoDeskWorker: UserSession = {
    id: 'user-uyo-1',
    name: 'Uyo Desk Officer',
    email: 'uyo.desk@aks.gov.ng',
    role: 'lga_admin',
    assignedLgaId: 'uyo',
    assignedLgaName: 'Uyo',
    isAuthenticated: true,
    isPrivileged: true,
  };

  const eketDeskWorker: UserSession = {
    ...uyoDeskWorker,
    id: 'user-eket-1',
    assignedLgaId: 'eket',
    assignedLgaName: 'Eket',
  };

  // 1 & 2: Authorized LGA user can edit their own DRAFT and REJECTED_DRAFT
  const draftPerm = evaluateActivityEditPermission(baseDraftActivity, uyoDeskWorker);
  assert.equal(draftPerm.canEdit, true, 'Authorized LGA user must be able to edit own DRAFT');

  const rejectedActivity: HCDActivity = {
    ...baseDraftActivity,
    status: 'REJECTED_DRAFT',
    rejectionReason: 'Please replace blurry photo1.jpg with clearer field evidence.',
  };
  const rejectedPerm = evaluateActivityEditPermission(rejectedActivity, uyoDeskWorker);
  assert.equal(rejectedPerm.canEdit, true, 'Authorized LGA user must be able to edit own REJECTED_DRAFT');
  console.log('✓ [1 & 2] Authorized LGA user can edit own DRAFT and REJECTED_DRAFT records.');

  // 3: User assigned to another LGA cannot edit the record
  const crossLgaPerm = evaluateActivityEditPermission(baseDraftActivity, eketDeskWorker);
  assert.equal(crossLgaPerm.canEdit, false, 'Cross-LGA user must be blocked from editing');
  assert.equal(crossLgaPerm.reasonCode, 'CROSS_LGA', 'Must return CROSS_LGA reasonCode');
  assert.ok(crossLgaPerm.title.includes('Cross-LGA'), 'Must return clear cross-LGA title');
  console.log('✓ [3] User assigned to another LGA cannot edit the record.');

  // 4: PENDING_APPROVAL and PUBLISHED records remain strictly read-only
  const pendingPerm = evaluateActivityEditPermission(
    { ...baseDraftActivity, status: 'PENDING_APPROVAL' },
    uyoDeskWorker
  );
  assert.equal(pendingPerm.canEdit, false, 'PENDING_APPROVAL record must be read-only');
  assert.equal(pendingPerm.reasonCode, 'STATUS_PENDING_APPROVAL');

  const publishedPerm = evaluateActivityEditPermission(
    { ...baseDraftActivity, status: 'PUBLISHED' },
    uyoDeskWorker
  );
  assert.equal(publishedPerm.canEdit, false, 'PUBLISHED record must be read-only');
  assert.equal(publishedPerm.reasonCode, 'STATUS_PUBLISHED');
  console.log('✓ [4] Pending and Published records remain strictly read-only.');

  // 5: Replace a single photo without removing or mutating other attachments
  const replacementPhoto: VerificationMedia = {
    id: 'asset-1',
    type: 'photo',
    url: 'blob:https://temp-browser-preview/123',
    storagePath: 'uyo/act-uyo-draft-001/1700099999-photo1_replaced.jpg',
    caption: 'Replaced field photo 1',
    fileName: 'photo1_replaced.jpg',
    fileSize: '1.5 MB',
    exifVerified: true,
    coordinateSource: 'exif_gps',
    coordinates: { lat: 5.0381, lng: 7.9132 },
    uploadTimestamp: '2026-02-12T12:00:00Z',
  };

  const replaceRes = replaceVerificationAssetInList(
    baseDraftActivity.mediaAssets,
    'asset-1',
    replacementPhoto
  );
  assert.equal(replaceRes.replaced, true);
  assert.equal(
    replaceRes.supersededAsset?.storagePath,
    'uyo/act-uyo-draft-001/1700000001-photo1.jpg',
    'Must identify superseded storage path for post-persistence cleanup'
  );
  assert.equal(replaceRes.updatedAssets.length, 2, 'Must preserve total count of attachments');
  assert.equal(
    replaceRes.updatedAssets[0].storagePath,
    'uyo/act-uyo-draft-001/1700099999-photo1_replaced.jpg'
  );
  assert.equal(
    replaceRes.updatedAssets[0].url,
    '',
    'Must strip temporary blob URL and persist canonical storagePath'
  );
  assert.equal(
    replaceRes.updatedAssets[1].id,
    'asset-2',
    'Unrelated attachment (asset-2) must remain intact'
  );
  assert.equal(
    replaceRes.updatedAssets[1].storagePath,
    'uyo/act-uyo-draft-001/1700000002-field_log.pdf'
  );
  console.log('✓ [5] Single photo replacement preserves all unrelated attachments and strips temporary URLs.');

  // 6: Video or PDF attachment can be validated, added, and removed
  const validMp4 = validateMediaFile(
    new Blob([new Uint8Array(1024)], { type: 'video/mp4' }),
    'field_clip.mp4'
  );
  assert.equal(validMp4.valid, true, 'Valid MP4 under 25MB must pass validation');

  const validPdf = validateMediaFile(
    new Blob([new Uint8Array(1024)], { type: 'application/pdf' }),
    'report.pdf'
  );
  assert.equal(validPdf.valid, true, 'Valid PDF under 25MB must pass validation');

  const removeRes = removeVerificationAssetFromList(replaceRes.updatedAssets, 'asset-2');
  assert.equal(removeRes.updatedAssets.length, 1);
  assert.equal(removeRes.removedAsset?.storagePath, 'uyo/act-uyo-draft-001/1700000002-field_log.pdf');
  console.log('✓ [6] Video and PDF attachments can be validated, added, and removed.');

  // 7 & 8: Attendance registry PDF validation and rejection of invalid/oversized files
  const validRegistryPdf = validateAttendanceRegistryPdf(
    new Blob([new Uint8Array(2048)], { type: 'application/pdf' }),
    'Signed_Attendance_Roll.pdf'
  );
  assert.equal(validRegistryPdf.valid, true);

  const invalidRegistryImage = validateAttendanceRegistryPdf(
    new Blob([new Uint8Array(2048)], { type: 'image/jpeg' }),
    'photo.jpg'
  );
  assert.equal(invalidRegistryImage.valid, false, 'Attendance registry must reject non-PDF files');

  const oversizedBlob = { size: 30 * 1024 * 1024, type: 'image/jpeg' } as Blob;
  const oversizedFile = validateMediaFile(oversizedBlob, 'huge_photo.jpg');
  assert.equal(oversizedFile.valid, false, 'Files > 25MB must be rejected');

  const invalidExe = validateMediaFile(
    new Blob([new Uint8Array(1024)], { type: 'application/x-msdownload' }),
    'script.exe'
  );
  assert.equal(invalidExe.valid, false, 'Disallowed extensions must be rejected');

  assert.equal(isCanonicalStorageReference('uyo/act-uyo-draft-001/1700000000-attendance.pdf'), true);
  assert.equal(isCanonicalStorageReference('#attendance-registry-file'), false);
  assert.equal(
    extractCanonicalAttendanceStoragePath(
      'https://example.supabase.co/storage/v1/object/sign/hcd-evidence-vault/uyo/act-1/roll.pdf?token=abc'
    ),
    'uyo/act-1/roll.pdf'
  );
  console.log('✓ [7 & 8 & 9] Attendance registry PDF validation, canonical path extraction, and file size/type guards verified.');

  // 10: Geographic validation & EXIF GPS integrity
  const validGeo = validateCoordinates(5.0377, 7.9128, 'uyo');
  assert.equal(validGeo.status, 'VALID', 'Uyo coordinates must pass Akwa Ibom geofence');

  const outsideGeo = validateCoordinates(6.5244, 3.3792, 'uyo'); // Lagos
  assert.equal(outsideGeo.status, 'OUT_OF_BOUNDS', 'Coordinates outside Akwa Ibom must fail geofence');

  // Test binary EXIF GPS parser with in-Bounds Akwa Ibom coordinates
  const jpegWithValidGps = createJpegWithExifGps(5.0377, 7.9128, 'N', 'E');
  const parsedRaw = parseExifFromArrayBuffer(jpegWithValidGps);
  assert.ok(
    parsedRaw &&
      typeof parsedRaw.lat === 'number' &&
      Math.abs(parsedRaw.lat - 5.0377) < 0.001 &&
      typeof parsedRaw.lng === 'number' &&
      Math.abs(parsedRaw.lng - 7.9128) < 0.001,
    'Binary EXIF parser must extract accurate GPS coordinates'
  );

  const validJpegBlob = new Blob([jpegWithValidGps], { type: 'image/jpeg' });
  const extractedValidExif = await extractExifGpsFromFile(validJpegBlob, 'uyo', 'field_uyo.jpg');
  assert.equal(extractedValidExif.hasExifGps, true);
  assert.equal(extractedValidExif.exifVerified, true);
  assert.equal(extractedValidExif.coordinateSource, 'exif_gps');
  assert.equal(extractedValidExif.exifStatus, 'verified_exif');

  // Test binary EXIF GPS parser with out-of-bounds coordinates
  const jpegWithOutsideGps = createJpegWithExifGps(6.5244, 3.3792, 'N', 'E');
  const outsideJpegBlob = new Blob([jpegWithOutsideGps], { type: 'image/jpeg' });
  const extractedOutsideExif = await extractExifGpsFromFile(outsideJpegBlob, 'uyo', 'lagos.jpg');
  assert.equal(extractedOutsideExif.hasExifGps, true);
  assert.equal(
    extractedOutsideExif.exifVerified,
    false,
    'Out-of-bounds EXIF GPS must NOT be marked exifVerified'
  );
  assert.equal(extractedOutsideExif.exifStatus, 'exif_out_of_bounds');

  // Test file without EXIF GPS (e.g. PNG or stripped JPEG)
  const emptyPngBlob = new Blob([new Uint8Array(32)], { type: 'image/png' });
  const extractedNoExif = await extractExifGpsFromFile(emptyPngBlob, 'uyo', 'diagram.png');
  assert.equal(extractedNoExif.hasExifGps, false);
  assert.equal(
    extractedNoExif.exifVerified,
    false,
    'Image without EXIF GPS must NEVER be auto-marked exifVerified'
  );
  assert.equal(extractedNoExif.coordinateSource, 'none');

  // Verify provenance descriptions distinguish between EXIF GPS, Activity Location, Manual Entry, and No GPS
  const provExif = describeMediaGeotagProvenance(
    {
      id: 'm1',
      type: 'photo',
      url: '',
      caption: 'Photo 1',
      fileName: 'p1.jpg',
      fileSize: '1 MB',
      uploadTimestamp: '2026-02-10T10:00:00Z',
      exifVerified: true,
      coordinateSource: 'exif_gps',
      exifStatus: 'verified_exif',
      coordinates: { lat: 5.0377, lng: 7.9128 },
    },
    { lat: 5.0377, lng: 7.9128 },
    'uyo'
  );
  assert.equal(provExif.badgeLabel, 'EXIF GPS Verified');

  const provActivityLoc = describeMediaGeotagProvenance(
    {
      id: 'm2',
      type: 'photo',
      url: '',
      caption: 'Photo 2',
      fileName: 'p2.jpg',
      fileSize: '1 MB',
      uploadTimestamp: '2026-02-10T10:00:00Z',
      exifVerified: false,
      coordinateSource: 'activity_location',
      coordinates: { lat: 5.0377, lng: 7.9128 },
    },
    { lat: 5.0377, lng: 7.9128 },
    'uyo'
  );
  assert.equal(provActivityLoc.badgeLabel, 'Activity Location Coords');

  const provNone = describeMediaGeotagProvenance(
    {
      id: 'm3',
      type: 'photo',
      url: '',
      caption: 'Photo 3',
      fileName: 'p3.jpg',
      fileSize: '1 MB',
      uploadTimestamp: '2026-02-10T10:00:00Z',
      exifVerified: false,
      coordinateSource: 'none',
    },
    { lat: 5.0377, lng: 7.9128 },
    'uyo'
  );
  assert.equal(provNone.badgeLabel, 'No Usable EXIF GPS');

  console.log('✓ [10 & 11] EXIF GPS binary parser, Akwa Ibom geofence validation, and coordinate provenance distinction verified.');
  console.log('\nAll verification assertions passed!');
}

runVerificationSuite().catch((err) => {
  console.error('Verification suite failed:', err);
  process.exit(1);
});

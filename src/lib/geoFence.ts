import { ALL_31_LGAS, getLgaById } from '../data/lgas';

export interface GeoFenceResult {
  status: 'VALID' | 'WARNING' | 'OUT_OF_BOUNDS';
  message: string;
  distanceKm?: number;
}

// Bounding box for Akwa Ibom State (approximate territorial envelope)
const AKS_BOUNDS = {
  minLat: 4.45,
  maxLat: 5.55,
  minLng: 7.40,
  maxLng: 8.45,
};

// Calculate Haversine distance in kilometers between two lat/lng coordinates
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Validates whether coordinates fall within designated LGA and Akwa Ibom State perimeter
 */
export function validateCoordinates(
  lat: number,
  lng: number,
  lgaId?: string
): GeoFenceResult {
  if (isNaN(lat) || isNaN(lng)) {
    return {
      status: 'OUT_OF_BOUNDS',
      message: 'Invalid coordinate values. Coordinates must be decimal numbers.',
    };
  }

  // Check state bounding envelope
  const inState =
    lat >= AKS_BOUNDS.minLat &&
    lat <= AKS_BOUNDS.maxLat &&
    lng >= AKS_BOUNDS.minLng &&
    lng <= AKS_BOUNDS.maxLng;

  if (!inState) {
    return {
      status: 'OUT_OF_BOUNDS',
      message: `Coordinates (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E) fall outside Akwa Ibom State territory envelope.`,
    };
  }

  // Check proximity to designated LGA center
  if (lgaId) {
    const lga = getLgaById(lgaId);
    if (lga) {
      const distance = calculateDistanceKm(
        lat,
        lng,
        lga.centerCoordinates.lat,
        lga.centerCoordinates.lng
      );

      // Warning threshold: > 28km from LGA center
      if (distance > 28) {
        return {
          status: 'WARNING',
          distanceKm: distance,
          message: `Coordinates are ${distance}km from ${lga.name} council center. Verify this community is within ${lga.name} boundary.`,
        };
      }

      return {
        status: 'VALID',
        distanceKm: distance,
        message: `Verified within ${lga.name} LGA perimeter (${distance}km from council center).`,
      };
    }
  }

  return {
    status: 'VALID',
    message: 'Coordinates verified within Akwa Ibom State geographic envelope.',
  };
}

export interface ProximityDuplicateAlert {
  matchedActivityId: string;
  matchedTitle: string;
  matchedCommunity: string;
  matchedStatus: string;
  distanceMeters: number;
  sameCommunityName: boolean;
  overlappingDates: boolean;
  summary: string;
}

/**
 * Calculates precise Haversine distance in meters between two GPS coordinate pairs.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Evaluates whether a target activity in the same LGA & Strategic Pillar is within
 * a close GIS radius (default 150m) of existing activities, alerting State Executives
 * to potential duplicate project reporting.
 */
export function detectProximityDuplicates(
  target: {
    id: string;
    lgaId: string;
    pillar: string;
    community?: string;
    startDate?: string;
    completionDate?: string;
    coordinates?: { lat: number; lng: number };
  },
  allActivities: Array<{
    id: string;
    title: string;
    lgaId: string;
    pillar: string;
    community?: string;
    status: string;
    startDate?: string;
    completionDate?: string;
    coordinates?: { lat: number; lng: number };
  }>,
  radiusMeters = 150
): ProximityDuplicateAlert[] {
  if (
    !target.coordinates ||
    typeof target.coordinates.lat !== 'number' ||
    typeof target.coordinates.lng !== 'number'
  ) {
    return [];
  }

  const alerts: ProximityDuplicateAlert[] = [];
  const normTargetComm = (target.community || '').trim().toLowerCase();

  for (const candidate of allActivities) {
    if (candidate.id === target.id) continue;
    if (candidate.lgaId !== target.lgaId || candidate.pillar !== target.pillar) continue;
    if (
      !candidate.coordinates ||
      typeof candidate.coordinates.lat !== 'number' ||
      typeof candidate.coordinates.lng !== 'number'
    ) {
      continue;
    }

    const distMeters = calculateDistanceMeters(
      target.coordinates.lat,
      target.coordinates.lng,
      candidate.coordinates.lat,
      candidate.coordinates.lng
    );

    if (distMeters <= radiusMeters) {
      const sameCommunityName =
        normTargetComm.length > 0 &&
        normTargetComm === (candidate.community || '').trim().toLowerCase();

      const overlappingDates = Boolean(
        target.startDate &&
          candidate.startDate &&
          target.startDate.slice(0, 7) === candidate.startDate.slice(0, 7)
      );

      alerts.push({
        matchedActivityId: candidate.id,
        matchedTitle: candidate.title,
        matchedCommunity: candidate.community || 'Unspecified Community',
        matchedStatus: candidate.status,
        distanceMeters: distMeters,
        sameCommunityName,
        overlappingDates,
        summary:
          distMeters === 0
            ? `Identical GPS coordinates (0m) as "${candidate.title}" (${candidate.status})`
            : `Within ${distMeters}m of "${candidate.title}" in ${candidate.community || 'same ward'} (${candidate.status})`,
      });
    }
  }

  return alerts.sort((a, b) => a.distanceMeters - b.distanceMeters);
}


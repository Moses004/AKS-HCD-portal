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

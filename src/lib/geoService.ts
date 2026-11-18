import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface GeoGovernorate {
  id: string;
  name_ar: string;
  name_en?: string | null;
  is_active?: boolean;
  sort_order?: number;
  boundary?: unknown | null;
}

export interface GeoCenter {
  id: string;
  governorate_id: string;
  name_ar: string;
  name_en?: string | null;
  is_active?: boolean;
  sort_order?: number;
  boundary?: unknown | null;
}

export interface GeoArea {
  id: string;
  governorate_id: string;
  center_id: string;
  name_ar: string;
  name_en?: string | null;
  is_active?: boolean;
  sort_order?: number;
  boundary?: unknown | null;
}

export type ServiceCategoryType = 'household_shortages' | 'pharmacy' | 'ready_food';
export type DeliveryOwnerType = 'platform' | 'restaurant';
export type FulfillmentRouteType = 'restaurant_delivery' | 'driver_delivery';

export type QuoteErrorCategory =
  | 'missing_geo_data'
  | 'invalid_geo_id'
  | 'missing_gps'
  | 'invalid_gps'
  | 'gps_out_of_bounds'
  | 'outside_coverage'
  | 'no_active_tariff'
  | 'invalid_restaurant'
  | 'rpc_error';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value?: string | null): boolean {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
}

/**
 * Sanitized client-facing delivery quote result.
 * Strictly excludes internal financial split fields (`admin_commission`, `driver_net`, `driver_net_fee`).
 */
export interface CentralTariffResolution {
  covered: boolean;
  tariffId: string | null;
  customerDeliveryFee: number | null;
  baseDeliveryFee: number | null;
  isFreeDelivery: boolean;
  estimatedDeliveryMinutes: number | null;
  matchedLevel: 'area' | 'center' | 'governorate' | null;
  applicableDeliveryOwner: DeliveryOwnerType | null;
  fulfillmentRoute?: FulfillmentRouteType | null;
  errorCategory?: QuoteErrorCategory | null;
  boundaryChecked?: boolean;
  boundaryLevel?: 'area' | 'center' | 'governorate' | null;
  boundaryFailed?: boolean;
  queryFailed?: boolean;
  reason?: string;
}

export interface RestaurantScopeAndTariffResult extends CentralTariffResolution {
  hasOwnDelivery: boolean;
  inRestaurantScope: boolean;
}

export interface GpsValidationResult {
  valid: boolean;
  latitude: number | null;
  longitude: number | null;
  reason?: string;
}

export interface BoundaryCheckResult {
  checked: boolean;
  inside: boolean;
  level: 'area' | 'center' | 'governorate' | null;
  reason?: string;
}

export interface GeoAddressInput {
  governorateId?: string | null;
  centerId?: string | null;
  areaId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface GeoHierarchyValidationResult {
  valid: boolean;
  errorCategory?: QuoteErrorCategory | null;
  reason?: string;
  governorate?: GeoGovernorate;
  center?: GeoCenter;
  area?: GeoArea;
}

function getClient(client?: SupabaseClient): SupabaseClient {
  const c = client || supabase;
  if (!c) {
    throw new Error('عميل قاعدة بيانات Supabase غير مهيأ.');
  }
  return c;
}

function isMissingOptionalColumnError(
  error: { code?: string; message?: string } | null | undefined,
  columnName: string
): boolean {
  if (!error) return false;
  const msg = String(error.message || '');
  const isColErr = error.code === '42703' || error.code === 'PGRST204';
  if (!isColErr) return false;
  return new RegExp(`\\b${columnName}\\b`, 'i').test(msg);
}

function formatGeoQueryError(
  tableLabel: string,
  error: { code?: string; message?: string; details?: string }
): Error {
  const msg = String(error.message || 'خطأ غير معروف');
  const code = error.code ? ` (${error.code})` : '';

  if (error.code === '42501' || /permission denied|row-level security/i.test(msg)) {
    const err = new Error(
      `صلاحية القراءة (RLS) على جدول ${tableLabel} مرفوضة من قاعدة البيانات${code}: ${msg}`
    );
    (err as any).code = error.code || '42501';
    return err;
  }

  if (error.code === '42P01' || /relation .* does not exist/i.test(msg)) {
    const err = new Error(
      `جدول النظام الجغرافي المركزي ${tableLabel} غير موجود في قاعدة البيانات${code}: ${msg}`
    );
    (err as any).code = error.code || '42P01';
    return err;
  }

  const err = new Error(`فشل تحميل بيانات ${tableLabel} من النظام الجغرافي المركزي${code}: ${msg}`);
  (err as any).code = error.code;
  return err;
}

function sortGeoRows<T extends { name_ar?: string | null; sort_order?: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const sa = Number(a.sort_order ?? 0);
    const sb = Number(b.sort_order ?? 0);
    if (sa !== sb) return sa - sb;
    return String(a.name_ar || '').localeCompare(String(b.name_ar || ''), 'ar');
  });
}

/**
 * Validates non-zero finite GPS coordinates within Earth latitude/longitude bounds.
 * Rejects 0,0 and NaN / null / undefined to forbid fake default coordinates.
 */
export function validateGpsCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): GpsValidationResult {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return {
      valid: false,
      latitude: null,
      longitude: null,
      reason: 'إحداثيات GPS مطلوبة لإتمام الطلب وحفظ العنوان',
    };
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      valid: false,
      latitude: null,
      longitude: null,
      reason: 'إحداثيات الموقع غير صالحة',
    };
  }

  if (lat === 0 && lng === 0) {
    return {
      valid: false,
      latitude: null,
      longitude: null,
      reason: 'يجب تحديد موقع فعلي على الخريطة أو عبر GPS (الإحداثيات 0,0 غير مقبولة)',
    };
  }

  if (Math.abs(lat) < 0.0001 || Math.abs(lng) < 0.0001) {
    return {
      valid: false,
      latitude: null,
      longitude: null,
      reason: 'إحداثيات GPS غير دقيقة أو صفرية — يرجى إعادة تحديد الموقع على الخريطة',
    };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      valid: false,
      latitude: null,
      longitude: null,
      reason: 'إحداثيات GPS خارج النطاق الجغرافي الصحيح',
    };
  }

  return { valid: true, latitude: lat, longitude: lng };
}

/**
 * Normalizes Arabic text softly ONLY for initial pre-fill suggestions on legacy addresses,
 * never used as an automatic silent fallback for missing IDs during checkout.
 */
export function normalizeArabicName(input?: string | null): string {
  if (!input) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Boundary Geometry Evaluation (GeoJSON Polygon / MultiPolygon / Feature / BBox / Circle)
// ---------------------------------------------------------------------------

type LngLat = [number, number];

function parseBoundaryValue(raw: unknown): any {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    if (Array.isArray(raw) && raw.length === 0) return null;
    if (!Array.isArray(raw) && Object.keys(raw as Record<string, unknown>).length === 0) {
      return null;
    }
    return raw;
  }
  return null;
}

function toLngLatPoint(pt: any): LngLat | null {
  if (Array.isArray(pt) && pt.length >= 2) {
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    return null;
  }
  if (pt && typeof pt === 'object') {
    const latRaw = pt.lat ?? pt.latitude;
    const lngRaw = pt.lng ?? pt.lon ?? pt.longitude;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lng, lat];
  }
  return null;
}

function normalizeRing(rawRing: unknown): LngLat[] | null {
  if (!Array.isArray(rawRing) || rawRing.length < 3) return null;
  const pts: LngLat[] = [];
  for (const item of rawRing) {
    const pt = toLngLatPoint(item);
    if (!pt) return null;
    pts.push(pt);
  }
  return pts.length >= 3 ? pts : null;
}

function isPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): boolean {
  const eps = 1e-11;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= eps * eps) {
    const pxDx = px - ax;
    const pyDy = py - ay;
    return pxDx * pxDx + pyDy * pyDy <= eps * eps;
  }
  const cross = (px - ax) * dy - (py - ay) * dx;
  if (Math.abs(cross) > eps * Math.sqrt(lenSq)) return false;
  const dot = (px - ax) * dx + (py - ay) * dy;
  if (dot < -eps) return false;
  return dot <= lenSq + eps;
}

function isPointInRing(lng: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (isPointOnSegment(lng, lat, xi, yi, xj, yj)) {
      return true;
    }

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInPolygonRings(lng: number, lat: number, ringsRaw: unknown): boolean | null {
  if (!Array.isArray(ringsRaw) || ringsRaw.length === 0) return null;

  // Handle simple array of points passed directly as polygon: [[lng, lat], ...] or [{lat, lng}, ...]
  const firstPt = toLngLatPoint(ringsRaw[0]);
  if (firstPt) {
    const singleRing = normalizeRing(ringsRaw);
    if (!singleRing) return null;
    return isPointInRing(lng, lat, singleRing);
  }

  // Standard GeoJSON Polygon: [outerRing, ...holeRings]
  const outerRing = normalizeRing(ringsRaw[0]);
  if (!outerRing) return null;
  if (!isPointInRing(lng, lat, outerRing)) return false;

  for (let i = 1; i < ringsRaw.length; i += 1) {
    const hole = normalizeRing(ringsRaw[i]);
    if (hole && isPointInRing(lng, lat, hole)) {
      return false;
    }
  }
  return true;
}

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function evaluateSingleBoundaryObject(
  lat: number,
  lng: number,
  boundaryObj: any
): boolean | null {
  if (!boundaryObj) return null;

  if (Array.isArray(boundaryObj)) {
    return isPointInPolygonRings(lng, lat, boundaryObj);
  }

  if (typeof boundaryObj !== 'object') return null;

  const type = String(boundaryObj.type || '').trim().toLowerCase();

  if (type === 'feature' && boundaryObj.geometry) {
    return evaluateSingleBoundaryObject(lat, lng, boundaryObj.geometry);
  }

  if (type === 'featurecollection' && Array.isArray(boundaryObj.features)) {
    let hasAnyGeometry = false;
    for (const feature of boundaryObj.features) {
      const res = evaluateSingleBoundaryObject(lat, lng, feature);
      if (res !== null) {
        hasAnyGeometry = true;
        if (res === true) return true;
      }
    }
    return hasAnyGeometry ? false : null;
  }

  if (type === 'polygon' && Array.isArray(boundaryObj.coordinates)) {
    return isPointInPolygonRings(lng, lat, boundaryObj.coordinates);
  }

  if (type === 'multipolygon' && Array.isArray(boundaryObj.coordinates)) {
    let hasValidPoly = false;
    for (const polyCoords of boundaryObj.coordinates) {
      const res = isPointInPolygonRings(lng, lat, polyCoords);
      if (res !== null) {
        hasValidPoly = true;
        if (res === true) return true;
      }
    }
    return hasValidPoly ? false : null;
  }

  if (type === 'circle' || boundaryObj.radius_m !== undefined || boundaryObj.radiusMeters !== undefined) {
    const centerPt = toLngLatPoint(boundaryObj.center || boundaryObj.coordinates);
    const radiusM = Number(boundaryObj.radius_m ?? boundaryObj.radiusMeters ?? boundaryObj.radius);
    if (centerPt && Number.isFinite(radiusM) && radiusM > 0) {
      const dist = haversineDistanceMeters(lat, lng, centerPt[1], centerPt[0]);
      return dist <= radiusM;
    }
  }

  if (
    boundaryObj.minLat !== undefined &&
    boundaryObj.maxLat !== undefined &&
    boundaryObj.minLng !== undefined &&
    boundaryObj.maxLng !== undefined
  ) {
    return (
      lat >= Number(boundaryObj.minLat) &&
      lat <= Number(boundaryObj.maxLat) &&
      lng >= Number(boundaryObj.minLng) &&
      lng <= Number(boundaryObj.maxLng)
    );
  }

  if (
    boundaryObj.south !== undefined &&
    boundaryObj.north !== undefined &&
    boundaryObj.west !== undefined &&
    boundaryObj.east !== undefined
  ) {
    return (
      lat >= Number(boundaryObj.south) &&
      lat <= Number(boundaryObj.north) &&
      lng >= Number(boundaryObj.west) &&
      lng <= Number(boundaryObj.east)
    );
  }

  if (Array.isArray(boundaryObj.coordinates)) {
    return isPointInPolygonRings(lng, lat, boundaryObj.coordinates);
  }

  if (Array.isArray(boundaryObj.polygon)) {
    return isPointInPolygonRings(lng, lat, boundaryObj.polygon);
  }

  if (Array.isArray(boundaryObj.rings)) {
    return isPointInPolygonRings(lng, lat, boundaryObj.rings);
  }

  return null;
}

/**
 * Evaluates whether client GPS (latitude, longitude) lies inside the geographic `boundary`.
 * Priority:
 *   1) `geo_areas.boundary`
 *   2) `geo_centers.boundary` (if area has no boundary)
 *   3) `geo_governorates.boundary` (if center has no boundary)
 * If NO level has a usable boundary -> returns `{ checked: false, inside: true, level: null }`
 * so delivery relies strictly on central geo IDs and `delivery_area_tariffs` without blocking.
 * Never infers or overrides selected area/center/governorate from GPS.
 */
export function checkGpsWithinGeoBoundary(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  hierarchy: {
    area?: Pick<GeoArea, 'name_ar' | 'boundary'> | null;
    center?: Pick<GeoCenter, 'name_ar' | 'boundary'> | null;
    governorate?: Pick<GeoGovernorate, 'name_ar' | 'boundary'> | null;
  }
): BoundaryCheckResult {
  const candidates: Array<{
    level: 'area' | 'center' | 'governorate';
    labelAr: string;
    nameAr: string;
    parsed: any;
  }> = [
    {
      level: 'area',
      labelAr: 'المنطقة',
      nameAr: hierarchy.area?.name_ar || '',
      parsed: parseBoundaryValue(hierarchy.area?.boundary),
    },
    {
      level: 'center',
      labelAr: 'المركز / المدينة',
      nameAr: hierarchy.center?.name_ar || '',
      parsed: parseBoundaryValue(hierarchy.center?.boundary),
    },
    {
      level: 'governorate',
      labelAr: 'المحافظة',
      nameAr: hierarchy.governorate?.name_ar || '',
      parsed: parseBoundaryValue(hierarchy.governorate?.boundary),
    },
  ];

  const gpsCheck = validateGpsCoordinates(latitude, longitude);

  for (const candidate of candidates) {
    if (!candidate.parsed) continue;

    if (!gpsCheck.valid || gpsCheck.latitude === null || gpsCheck.longitude === null) {
      return {
        checked: true,
        inside: false,
        level: candidate.level,
        reason: gpsCheck.reason || 'إحداثيات GPS غير صالحة للتحقق من النطاق الجغرافي.',
      };
    }

    const evaluation = evaluateSingleBoundaryObject(
      gpsCheck.latitude,
      gpsCheck.longitude,
      candidate.parsed
    );

    if (evaluation === null) {
      continue;
    }

    if (evaluation) {
      return {
        checked: true,
        inside: true,
        level: candidate.level,
      };
    }

    const targetName = candidate.nameAr ? ` (${candidate.nameAr})` : '';
    return {
      checked: true,
      inside: false,
      level: candidate.level,
      reason: `إحداثيات موقعك الجغرافي (GPS) تقع خارج حدود ${candidate.labelAr}${targetName} المحددة.`,
    };
  }

  return {
    checked: false,
    inside: true,
    level: null,
  };
}

/**
 * Resolves active governorates strictly from central `geo_governorates` table.
 */
export async function getActiveGovernorates(client?: SupabaseClient): Promise<GeoGovernorate[]> {
  const db = getClient(client);
  let { data, error } = await db
    .from('geo_governorates')
    .select('*')
    .eq('is_active', true);

  if (isMissingOptionalColumnError(error, 'is_active')) {
    const fallbackRes = await db.from('geo_governorates').select('*');
    data = fallbackRes.data;
    error = fallbackRes.error;
  }

  if (error) {
    throw formatGeoQueryError('geo_governorates', error);
  }

  const normalized = ((data || []) as Array<Record<string, any>>)
    .filter((row) => row && row.id && row.name_ar && row.is_active !== false)
    .map((row) => ({
      id: String(row.id),
      name_ar: String(row.name_ar),
      name_en: row.name_en ?? null,
      is_active: row.is_active !== false,
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order) || 0,
      boundary: row.boundary ?? null,
    }));

  return sortGeoRows(normalized);
}

/**
 * Resolves active centers strictly from central `geo_centers` filtered by `governorate_id`.
 */
export async function getActiveCenters(
  governorateId: string,
  client?: SupabaseClient
): Promise<GeoCenter[]> {
  if (!governorateId) return [];
  const db = getClient(client);

  let { data, error } = await db
    .from('geo_centers')
    .select('*')
    .eq('governorate_id', governorateId)
    .eq('is_active', true);

  if (isMissingOptionalColumnError(error, 'is_active')) {
    const fallbackRes = await db
      .from('geo_centers')
      .select('*')
      .eq('governorate_id', governorateId);
    data = fallbackRes.data;
    error = fallbackRes.error;
  }

  if (error) {
    throw formatGeoQueryError('geo_centers', error);
  }

  const normalized = ((data || []) as Array<Record<string, any>>)
    .filter(
      (row) =>
        row &&
        row.id &&
        row.name_ar &&
        row.governorate_id === governorateId &&
        row.is_active !== false
    )
    .map((row) => ({
      id: String(row.id),
      governorate_id: String(row.governorate_id),
      name_ar: String(row.name_ar),
      name_en: row.name_en ?? null,
      is_active: row.is_active !== false,
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order) || 0,
      boundary: row.boundary ?? null,
    }));

  return sortGeoRows(normalized);
}

/**
 * Resolves active areas strictly from central `geo_areas` filtered by `governorate_id` and `center_id`.
 * Strictly 3-level direct hierarchy: Governorate -> Center -> Area (no `parent_area_id`).
 */
export async function getActiveAreas(
  governorateId: string,
  centerId: string,
  client?: SupabaseClient
): Promise<GeoArea[]> {
  if (!governorateId || !centerId) return [];
  const db = getClient(client);

  let { data, error } = await db
    .from('geo_areas')
    .select('*')
    .eq('governorate_id', governorateId)
    .eq('center_id', centerId)
    .eq('is_active', true);

  if (isMissingOptionalColumnError(error, 'is_active')) {
    const fallbackRes = await db
      .from('geo_areas')
      .select('*')
      .eq('governorate_id', governorateId)
      .eq('center_id', centerId);
    data = fallbackRes.data;
    error = fallbackRes.error;
  }

  if (error) {
    throw formatGeoQueryError('geo_areas', error);
  }

  const normalized = ((data || []) as Array<Record<string, any>>)
    .filter(
      (row) =>
        row &&
        row.id &&
        row.name_ar &&
        row.center_id === centerId &&
        (!row.governorate_id || row.governorate_id === governorateId) &&
        row.is_active !== false
    )
    .map((row) => ({
      id: String(row.id),
      governorate_id: String(row.governorate_id || governorateId),
      center_id: String(row.center_id),
      name_ar: String(row.name_ar),
      name_en: row.name_en ?? null,
      is_active: row.is_active !== false,
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order) || 0,
      boundary: row.boundary ?? null,
    }));

  return sortGeoRows(normalized);
}

/**
 * Validates that (governorateId, centerId, areaId) all exist in central `geo_*` tables,
 * are active (`is_active !== false`), and respect strict 3-level parent-child hierarchy:
 * center.governorate_id === governorateId AND area.center_id === centerId AND area.governorate_id === governorateId.
 */
export async function validateGeoHierarchySelection(
  governorateId?: string | null,
  centerId?: string | null,
  areaId?: string | null,
  client?: SupabaseClient
): Promise<GeoHierarchyValidationResult> {
  if (!governorateId?.trim() || !centerId?.trim() || !areaId?.trim()) {
    return {
      valid: false,
      errorCategory: 'missing_geo_data',
      reason: 'يجب تحديد المحافظة والمركز والمنطقة من النظام الجغرافي المعتمد أولاً',
    };
  }

  if (!isValidUuid(governorateId) || !isValidUuid(centerId) || !isValidUuid(areaId)) {
    return {
      valid: false,
      errorCategory: 'invalid_geo_id',
      reason: 'معرّفات المحافظة أو المركز أو المنطقة غير صالحة (UUID غير صحيح).',
    };
  }

  const db = getClient(client);

  const [govRes, centerRes, areaRes] = await Promise.all([
    db.from('geo_governorates').select('*').eq('id', governorateId).maybeSingle(),
    db.from('geo_centers').select('*').eq('id', centerId).maybeSingle(),
    db.from('geo_areas').select('*').eq('id', areaId).maybeSingle(),
  ]);

  if (govRes.error) {
    return {
      valid: false,
      errorCategory: 'rpc_error',
      reason: formatGeoQueryError('geo_governorates', govRes.error).message,
    };
  }
  if (centerRes.error) {
    return {
      valid: false,
      errorCategory: 'rpc_error',
      reason: formatGeoQueryError('geo_centers', centerRes.error).message,
    };
  }
  if (areaRes.error) {
    return {
      valid: false,
      errorCategory: 'rpc_error',
      reason: formatGeoQueryError('geo_areas', areaRes.error).message,
    };
  }

  const govRow = govRes.data as Record<string, any> | null;
  if (!govRow || !govRow.id || govRow.is_active === false) {
    return {
      valid: false,
      errorCategory: 'invalid_geo_id',
      reason: 'المحافظة المحددة غير موجودة أو غير مفعّلة في النظام الجغرافي المركزي (geo_governorates).',
    };
  }

  const centerRow = centerRes.data as Record<string, any> | null;
  if (!centerRow || !centerRow.id || centerRow.is_active === false) {
    return {
      valid: false,
      errorCategory: 'invalid_geo_id',
      reason: 'المركز / المدينة المحددة غير موجودة أو غير مفعّلة في النظام الجغرافي المركزي (geo_centers).',
    };
  }
  if (String(centerRow.governorate_id || '') !== String(govRow.id)) {
    return {
      valid: false,
      errorCategory: 'invalid_geo_id',
      reason: 'المركز المحدد لا يتبع المحافظة المختارة في النظام الجغرافي المركزي.',
    };
  }

  const areaRow = areaRes.data as Record<string, any> | null;
  if (!areaRow || !areaRow.id || areaRow.is_active === false) {
    return {
      valid: false,
      errorCategory: 'invalid_geo_id',
      reason: 'المنطقة المحددة غير موجودة أو غير مفعّلة في النظام الجغرافي المركزي (geo_areas).',
    };
  }
  if (
    String(areaRow.center_id || '') !== String(centerRow.id) ||
    (areaRow.governorate_id && String(areaRow.governorate_id) !== String(govRow.id))
  ) {
    return {
      valid: false,
      errorCategory: 'invalid_geo_id',
      reason: 'المنطقة المحددة لا تتبع المركز والمحافظة المختارين في النظام الجغرافي المركزي.',
    };
  }

  return {
    valid: true,
    governorate: {
      id: String(govRow.id),
      name_ar: String(govRow.name_ar || ''),
      name_en: govRow.name_en ?? null,
      is_active: govRow.is_active !== false,
      sort_order: Number(govRow.sort_order) || 0,
      boundary: govRow.boundary ?? null,
    },
    center: {
      id: String(centerRow.id),
      governorate_id: String(centerRow.governorate_id),
      name_ar: String(centerRow.name_ar || ''),
      name_en: centerRow.name_en ?? null,
      is_active: centerRow.is_active !== false,
      sort_order: Number(centerRow.sort_order) || 0,
      boundary: centerRow.boundary ?? null,
    },
    area: {
      id: String(areaRow.id),
      governorate_id: String(areaRow.governorate_id || govRow.id),
      center_id: String(areaRow.center_id),
      name_ar: String(areaRow.name_ar || ''),
      name_en: areaRow.name_en ?? null,
      is_active: areaRow.is_active !== false,
      sort_order: Number(areaRow.sort_order) || 0,
      boundary: areaRow.boundary ?? null,
    },
  };
}

function normalizeQuoteObject(rawData: unknown): Record<string, any> | null {
  let current: unknown = rawData;

  if (typeof current === 'string') {
    const trimmed = current.trim();
    if (!trimmed) return null;
    try {
      current = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (Array.isArray(current)) {
    current = current.length > 0 ? current[0] : null;
  }

  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    return null;
  }

  return current as Record<string, any>;
}

function classifyQuoteFailure(
  rawCode?: string | null,
  rawMessage?: string | null
): { category: QuoteErrorCategory; reason: string; boundaryFailed?: boolean; queryFailed?: boolean } {
  const code = String(rawCode || '').trim().toLowerCase();
  const msg = String(rawMessage || '').trim();
  const msgLower = msg.toLowerCase();

  if (
    code.includes('gps_out') ||
    code.includes('out_of_bound') ||
    code.includes('outside_boundary') ||
    /خارج حدود|outside.*bound|out of.*bound|polygon|boundary/i.test(msgLower)
  ) {
    return {
      category: 'gps_out_of_bounds',
      reason: msg || 'إحداثيات موقعك الجغرافي (GPS) تقع خارج حدود المنطقة المحددة.',
      boundaryFailed: true,
    };
  }

  if (
    code.includes('missing_gps') ||
    /gps.*(missing|required)|إحداثيات.*مفقودة|تحديد الموقع/i.test(msgLower)
  ) {
    return {
      category: 'missing_gps',
      reason: msg || 'إحداثيات الموقع الجغرافي (GPS) مفقودة؛ يرجى تحديد الموقع على الخريطة.',
      boundaryFailed: true,
    };
  }

  if (
    code.includes('invalid_gps') ||
    /invalid.*gps|gps.*invalid|إحداثيات.*غير صالحة/i.test(msgLower)
  ) {
    return {
      category: 'invalid_gps',
      reason: msg || 'إحداثيات الموقع الجغرافي غير صالحة؛ يرجى إعادة تثبيت الموقع.',
      boundaryFailed: true,
    };
  }

  if (
    code.includes('missing_geo') ||
    code.includes('incomplete_geo') ||
    /بيانات.*جغرافية ناقصة|يجب تحديد المحافظة والمركز والمنطقة/i.test(msgLower)
  ) {
    return {
      category: 'missing_geo_data',
      reason: msg || 'البيانات الجغرافية غير مكتملة؛ يرجى تحديد المحافظة والمركز والمنطقة.',
    };
  }

  if (
    code === '22p02' ||
    code.includes('invalid_geo') ||
    code.includes('geo_mismatch') ||
    /invalid input syntax for type uuid|معرف جغرافي|لا يتبع المحافظة|لا تتبع المركز|غير مفعّلة في geo_|غير موجودة في geo_/i.test(
      msgLower
    )
  ) {
    return {
      category: 'invalid_geo_id',
      reason: msg || 'معرّف جغرافي غير صالح أو غير متطابق؛ يرجى تصحيح العنوان المختار.',
    };
  }

  if (
    code.includes('invalid_restaurant') ||
    code.includes('restaurant_not_found') ||
    code.includes('restaurant_closed') ||
    code.includes('restaurant_inactive') ||
    /مطعم غير|المطعم غير|المطعم مغلق|restaurant.*(not found|inactive|closed)/i.test(msgLower)
  ) {
    return {
      category: 'invalid_restaurant',
      reason: msg || 'المطعم المحدد غير صالح أو غير متاح حالياً.',
    };
  }

  if (
    code.includes('no_tariff') ||
    code.includes('no_active_tariff') ||
    code.includes('tariff_not_found') ||
    code.includes('tariff_disabled') ||
    /لا توجد تسعيرة|لا توجد تعريفة|غير مسعّرة|tariff.*(missing|disabled|not found)/i.test(msgLower)
  ) {
    return {
      category: 'no_active_tariff',
      reason: msg || 'لا توجد تسعيرة توصيل مفعّلة لهذه المنطقة حالياً.',
    };
  }

  if (
    code.includes('outside_coverage') ||
    code.includes('not_covered') ||
    code.includes('uncovered') ||
    /خارج نطاق التوصيل|خارج التغطية|غير مغط|not covered|outside coverage/i.test(msgLower)
  ) {
    return {
      category: 'outside_coverage',
      reason: msg || 'المنطقة المحددة خارج نطاق التوصيل المتاح حالياً.',
    };
  }

  if (
    code === '42883' ||
    code === 'pgrst202' ||
    code === '42501' ||
    code.startsWith('pgrst') ||
    /network|fetch|timeout|connection|permission denied|function .* does not exist/i.test(msgLower)
  ) {
    return {
      category: 'rpc_error',
      reason: msg
        ? `تعذر الاتصال بخدمة التسعير المركزية: ${msg}`
        : 'تعذر الاتصال بخدمة التسعير المركزية؛ يرجى المحاولة مرة أخرى.',
      queryFailed: true,
    };
  }

  return {
    category: 'outside_coverage',
    reason: msg || 'المنطقة المحددة غير مشمولة بالتغطية أو التسعيرة حالياً.',
  };
}

function resolveOptionalMatchedLevel(
  val: unknown
): 'area' | 'center' | 'governorate' | null {
  const s = String(val || '').trim().toLowerCase();
  if (s === 'area' || s === 'center' || s === 'governorate') return s;
  return null;
}

function resolveOptionalDeliveryOwner(
  ownerVal: unknown,
  routeVal: unknown
): DeliveryOwnerType | null {
  const owner = String(ownerVal || '').trim().toLowerCase();
  if (owner === 'restaurant' || owner === 'platform') return owner;
  const route = String(routeVal || '').trim().toLowerCase();
  if (route === 'restaurant_delivery') return 'restaurant';
  if (route === 'driver_delivery') return 'platform';
  return null;
}

function resolveOptionalFulfillmentRoute(
  routeVal: unknown,
  ownerVal: unknown
): FulfillmentRouteType | null {
  const route = String(routeVal || '').trim().toLowerCase();
  if (route === 'restaurant_delivery' || route === 'driver_delivery') return route;
  const owner = String(ownerVal || '').trim().toLowerCase();
  if (owner === 'restaurant') return 'restaurant_delivery';
  if (owner === 'platform') return 'driver_delivery';
  return null;
}

/**
 * Resolves centralized delivery quote strictly via Supabase V2 RPC:
 * `public.get_delivery_quote(p_service_type, p_governorate_id, p_center_id, p_area_id, p_latitude, p_longitude, p_restaurant_id)`
 *
 * Security & correctness guarantees:
 * - Never queries `delivery_area_tariffs` directly from the client.
 * - Passes all 7 parameters in exact V2 order and types (preventing legacy 4-param overload).
 * - Validates UUIDs and real non-zero GPS coordinates before calling RPC (no fake coords).
 * - Never forwards internal `admin_commission`, `driver_net`, or `driver_net_fee` to client objects.
 * - Distinguishes RPC/connection errors from missing geo data, invalid IDs, GPS errors, missing tariffs, and uncovered areas.
 */
export async function resolveCentralTariff(params: {
  serviceType: ServiceCategoryType;
  governorateId?: string | null;
  centerId?: string | null;
  areaId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  restaurantId?: string | null;
  client?: SupabaseClient;
}): Promise<CentralTariffResolution> {
  const {
    serviceType,
    governorateId,
    centerId,
    areaId,
    latitude,
    longitude,
    restaurantId,
    client,
  } = params;

  const emptyFailure = (
    reason: string,
    errorCategory: QuoteErrorCategory,
    extra: Partial<CentralTariffResolution> = {}
  ): CentralTariffResolution => ({
    covered: false,
    tariffId: null,
    customerDeliveryFee: null,
    baseDeliveryFee: null,
    isFreeDelivery: false,
    estimatedDeliveryMinutes: null,
    matchedLevel: null,
    applicableDeliveryOwner: null,
    fulfillmentRoute: null,
    errorCategory,
    reason,
    ...extra,
  });

  if (
    serviceType !== 'household_shortages' &&
    serviceType !== 'pharmacy' &&
    serviceType !== 'ready_food'
  ) {
    return emptyFailure('نوع القسم المطلوب للتسعير غير معتمد.', 'rpc_error', {
      queryFailed: true,
    });
  }

  if (!governorateId?.trim() || !centerId?.trim() || !areaId?.trim()) {
    return emptyFailure(
      'البيانات الجغرافية للعنوان غير مكتملة؛ يرجى تحديد المحافظة والمركز والمنطقة أولاً.',
      'missing_geo_data'
    );
  }

  if (
    !isValidUuid(governorateId) ||
    !isValidUuid(centerId) ||
    !isValidUuid(areaId)
  ) {
    return emptyFailure(
      'معرّف المحافظة أو المركز أو المنطقة غير صالح؛ يرجى تعديل العنوان وإعادة الاختيار من القوائم المعتمدة.',
      'invalid_geo_id'
    );
  }

  let normalizedRestaurantId: string | null = null;
  if (serviceType === 'ready_food') {
    if (!restaurantId?.trim() || !isValidUuid(restaurantId)) {
      return emptyFailure(
        'معرّف المطعم غير صالح أو مفقود للتحقق من التغطية والتسعيرة.',
        'invalid_restaurant'
      );
    }
    normalizedRestaurantId = restaurantId.trim();
  }

  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined
  ) {
    return emptyFailure(
      'إحداثيات الموقع الجغرافي (GPS) مفقودة؛ يرجى تحديد الموقع على الخريطة أو تفعيل GPS.',
      'missing_gps',
      { boundaryFailed: true }
    );
  }

  const gpsCheck = validateGpsCoordinates(latitude, longitude);
  if (!gpsCheck.valid || gpsCheck.latitude === null || gpsCheck.longitude === null) {
    return emptyFailure(
      gpsCheck.reason || 'إحداثيات GPS غير صالحة؛ يرجى إعادة تحديد الموقع بدقة.',
      'invalid_gps',
      { boundaryFailed: true }
    );
  }

  let db: SupabaseClient;
  try {
    db = getClient(client);
  } catch (err: any) {
    return emptyFailure(
      err?.message || 'اتصال قاعدة البيانات غير متاح للتحقق من التسعيرة.',
      'rpc_error',
      { queryFailed: true }
    );
  }

  try {
    const rpcPayload = {
      p_service_type: serviceType,
      p_governorate_id: governorateId.trim(),
      p_center_id: centerId.trim(),
      p_area_id: areaId.trim(),
      p_latitude: Number(gpsCheck.latitude),
      p_longitude: Number(gpsCheck.longitude),
      p_restaurant_id: normalizedRestaurantId,
    };

    const { data: rawData, error: rpcError } = await db.rpc(
      'get_delivery_quote',
      rpcPayload
    );

    if (rpcError) {
      const classified = classifyQuoteFailure(rpcError.code, rpcError.message);
      const isActualQueryFailure =
        classified.category === 'rpc_error' ||
        (!classified.boundaryFailed &&
          classified.category !== 'invalid_geo_id' &&
          classified.category !== 'invalid_restaurant' &&
          classified.category !== 'no_active_tariff' &&
          classified.category !== 'outside_coverage');

      return emptyFailure(
        classified.category === 'rpc_error' || isActualQueryFailure
          ? `تعذر الاتصال بخدمة التسعير المركزية: ${rpcError.message}`
          : classified.reason,
        isActualQueryFailure ? 'rpc_error' : classified.category,
        {
          boundaryFailed: Boolean(classified.boundaryFailed),
          queryFailed: isActualQueryFailure || Boolean(classified.queryFailed),
        }
      );
    }

    const quoteObj = normalizeQuoteObject(rawData);
    if (!quoteObj) {
      return emptyFailure(
        'تعذر قراءة استجابة خدمة التسعير المركزية (صيغة غير صالحة).',
        'rpc_error',
        { queryFailed: true }
      );
    }

    // Determine coverage status strictly from returned JSONB boolean flags
    let isCovered = false;
    if (typeof quoteObj.covered === 'boolean') {
      isCovered = quoteObj.covered;
    } else if (typeof quoteObj.is_covered === 'boolean') {
      isCovered = quoteObj.is_covered;
    } else if (typeof quoteObj.allowed === 'boolean') {
      isCovered = quoteObj.allowed;
    } else if (typeof quoteObj.is_allowed === 'boolean') {
      isCovered = quoteObj.is_allowed;
    } else if (typeof quoteObj.serviceable === 'boolean') {
      isCovered = quoteObj.serviceable;
    } else if (typeof quoteObj.is_serviceable === 'boolean') {
      isCovered = quoteObj.is_serviceable;
    } else if (typeof quoteObj.ok === 'boolean') {
      isCovered = quoteObj.ok;
    } else if (typeof quoteObj.success === 'boolean') {
      isCovered = quoteObj.success;
    }

    const matchedLevel = resolveOptionalMatchedLevel(
      quoteObj.matched_level ?? quoteObj.scope_level ?? quoteObj.level
    );
    const applicableDeliveryOwner = resolveOptionalDeliveryOwner(
      quoteObj.delivery_owner ?? quoteObj.applicable_delivery_owner ?? quoteObj.owner,
      quoteObj.fulfillment_route
    );
    const fulfillmentRoute = resolveOptionalFulfillmentRoute(
      quoteObj.fulfillment_route,
      quoteObj.delivery_owner ?? quoteObj.applicable_delivery_owner
    );

    if (!isCovered) {
      const rawErrCode =
        quoteObj.error_code ?? quoteObj.code ?? quoteObj.reason_code ?? quoteObj.status;
      const rawErrMsg =
        quoteObj.reason ??
        quoteObj.message ??
        quoteObj.error ??
        quoteObj.error_message;
      const classified = classifyQuoteFailure(
        rawErrCode ? String(rawErrCode) : null,
        rawErrMsg ? String(rawErrMsg) : null
      );

      return emptyFailure(classified.reason, classified.category, {
        matchedLevel,
        applicableDeliveryOwner,
        fulfillmentRoute,
        boundaryChecked:
          typeof quoteObj.boundary_checked === 'boolean'
            ? quoteObj.boundary_checked
            : undefined,
        boundaryLevel: resolveOptionalMatchedLevel(quoteObj.boundary_level),
        boundaryFailed: Boolean(classified.boundaryFailed),
        queryFailed: Boolean(classified.queryFailed),
      });
    }

    const isFree = Boolean(quoteObj.is_free_delivery ?? quoteObj.free_delivery ?? false);
    const rawCustomerFee =
      quoteObj.customer_delivery_fee ?? quoteObj.delivery_fee ?? quoteObj.fee;
    const customerFee = isFree
      ? 0
      : rawCustomerFee !== null && rawCustomerFee !== undefined
      ? Number(rawCustomerFee)
      : null;

    if (customerFee === null || !Number.isFinite(customerFee) || customerFee < 0) {
      return emptyFailure(
        'تسعيرة التوصيل لهذه المنطقة غير مكتملة في النظام المركزي.',
        'no_active_tariff',
        {
          tariffId: quoteObj.tariff_id ? String(quoteObj.tariff_id) : null,
          matchedLevel,
          applicableDeliveryOwner,
          fulfillmentRoute,
        }
      );
    }

    // Use actual V2 field name `base_delivery_fee`; never read or expose `admin_commission` or `driver_net`.
    const rawBaseDeliveryFee = quoteObj.base_delivery_fee;
    const baseDeliveryFee =
      rawBaseDeliveryFee !== null &&
      rawBaseDeliveryFee !== undefined &&
      Number.isFinite(Number(rawBaseDeliveryFee))
        ? Number(rawBaseDeliveryFee)
        : customerFee;

    const rawEstMinutes = quoteObj.estimated_delivery_minutes;
    const estimatedDeliveryMinutes =
      rawEstMinutes !== null &&
      rawEstMinutes !== undefined &&
      Number.isFinite(Number(rawEstMinutes))
        ? Number(rawEstMinutes)
        : null;

    return {
      covered: true,
      tariffId: quoteObj.tariff_id ? String(quoteObj.tariff_id) : null,
      customerDeliveryFee: customerFee,
      baseDeliveryFee,
      isFreeDelivery: isFree,
      estimatedDeliveryMinutes,
      matchedLevel,
      applicableDeliveryOwner,
      fulfillmentRoute,
      errorCategory: null,
      boundaryChecked:
        typeof quoteObj.boundary_checked === 'boolean'
          ? quoteObj.boundary_checked
          : true,
      boundaryLevel: resolveOptionalMatchedLevel(quoteObj.boundary_level),
    };
  } catch (err: any) {
    return emptyFailure(
      err?.message || 'حدث خطأ أثناء الاتصال بخدمة التسعير المركزية.',
      'rpc_error',
      { queryFailed: true }
    );
  }
}

/**
 * Inspects restaurant record flags for UI display only (DB V2 RPC/triggers own actual routing).
 */
export function detectRestaurantOwnDelivery(restaurantRow: Record<string, any> | null | undefined): boolean {
  if (!restaurantRow || typeof restaurantRow !== 'object') return false;

  const booleanFlagKeys = [
    'has_own_delivery',
    'own_delivery_enabled',
    'restaurant_delivery_enabled',
    'supports_restaurant_delivery',
    'self_delivery_enabled',
    'uses_own_delivery',
  ];

  for (const key of booleanFlagKeys) {
    if (typeof restaurantRow[key] === 'boolean') {
      return restaurantRow[key];
    }
  }

  const modeVal = String(
    restaurantRow.delivery_mode ||
      restaurantRow.delivery_owner ||
      restaurantRow.delivery_scope_mode ||
      ''
  )
    .trim()
    .toLowerCase();

  if (modeVal === 'restaurant' || modeVal === 'own' || modeVal === 'restaurant_only' || modeVal === 'hybrid') {
    return true;
  }

  return false;
}

/**
 * Resolves ready-made food (`p_service_type = "ready_food"`) coverage & central quote strictly via
 * `public.get_delivery_quote` V2 (passing `p_restaurant_id`).
 * Database triggers & RPC remain the sole final authority on `restaurant_delivery` vs `driver_delivery`.
 */
export async function resolveRestaurantDeliveryScopeAndTariff(params: {
  restaurant: Record<string, any>;
  governorateId?: string | null;
  centerId?: string | null;
  areaId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  client?: SupabaseClient;
}): Promise<RestaurantScopeAndTariffResult> {
  const { restaurant, governorateId, centerId, areaId, latitude, longitude, client } = params;
  const restaurantId = String(restaurant?.id || '').trim();
  const hasOwnDeliveryFlag =
    typeof restaurant?.hasOwnDelivery === 'boolean'
      ? restaurant.hasOwnDelivery
      : detectRestaurantOwnDelivery(restaurant);

  if (!restaurantId || !isValidUuid(restaurantId)) {
    return {
      covered: false,
      hasOwnDelivery: hasOwnDeliveryFlag,
      inRestaurantScope: false,
      tariffId: null,
      customerDeliveryFee: null,
      baseDeliveryFee: null,
      isFreeDelivery: false,
      estimatedDeliveryMinutes: null,
      matchedLevel: null,
      applicableDeliveryOwner: null,
      fulfillmentRoute: null,
      errorCategory: 'invalid_restaurant',
      reason: 'بيانات المطعم غير مكتملة أو غير صالحة.',
    };
  }

  const quote = await resolveCentralTariff({
    serviceType: 'ready_food',
    governorateId,
    centerId,
    areaId,
    latitude,
    longitude,
    restaurantId,
    client,
  });

  if (!quote.covered) {
    return {
      ...quote,
      covered: false,
      hasOwnDelivery: hasOwnDeliveryFlag,
      inRestaurantScope: false,
    };
  }

  const inRestaurantScope =
    quote.applicableDeliveryOwner === 'restaurant' ||
    quote.fulfillmentRoute === 'restaurant_delivery';

  return {
    ...quote,
    hasOwnDelivery: inRestaurantScope || hasOwnDeliveryFlag,
    inRestaurantScope,
  };
}


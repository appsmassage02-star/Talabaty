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

export interface DeliveryAreaTariff {
  id: string;
  service_type: string;
  delivery_owner?: DeliveryOwnerType | string | null;
  restaurant_id?: string | null;
  scope_level?: string | null;
  governorate_id?: string | null;
  center_id?: string | null;
  area_id?: string | null;
  is_enabled: boolean;
  is_free_delivery: boolean;
  customer_delivery_fee: number | null;
  base_fee?: number | null;
  admin_commission?: number | null;
  driver_net?: number | null;
  driver_net_fee?: number | null;
  free_delivery_cost_bearer?: string | null;
  estimated_delivery_minutes?: number | null;
}

export interface CentralTariffResolution {
  covered: boolean;
  tariffId: string | null;
  customerDeliveryFee: number | null;
  baseFee: number | null;
  adminCommission: number | null;
  driverNet: number | null;
  isFreeDelivery: boolean;
  freeDeliveryCostBearer: string | null;
  estimatedDeliveryMinutes: number | null;
  matchedLevel: 'area' | 'center' | 'governorate' | null;
  applicableDeliveryOwner: DeliveryOwnerType | null;
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
      reason: 'يجب تحديد المحافظة والمركز والمنطقة من النظام الجغرافي المعتمد أولاً',
    };
  }

  const db = getClient(client);

  const [govRes, centerRes, areaRes] = await Promise.all([
    db.from('geo_governorates').select('*').eq('id', governorateId).maybeSingle(),
    db.from('geo_centers').select('*').eq('id', centerId).maybeSingle(),
    db.from('geo_areas').select('*').eq('id', areaId).maybeSingle(),
  ]);

  if (govRes.error) {
    return { valid: false, reason: formatGeoQueryError('geo_governorates', govRes.error).message };
  }
  if (centerRes.error) {
    return { valid: false, reason: formatGeoQueryError('geo_centers', centerRes.error).message };
  }
  if (areaRes.error) {
    return { valid: false, reason: formatGeoQueryError('geo_areas', areaRes.error).message };
  }

  const govRow = govRes.data as Record<string, any> | null;
  if (!govRow || !govRow.id || govRow.is_active === false) {
    return {
      valid: false,
      reason: 'المحافظة المحددة غير موجودة أو غير مفعّلة في النظام الجغرافي المركزي (geo_governorates).',
    };
  }

  const centerRow = centerRes.data as Record<string, any> | null;
  if (!centerRow || !centerRow.id || centerRow.is_active === false) {
    return {
      valid: false,
      reason: 'المركز / المدينة المحددة غير موجودة أو غير مفعّلة في النظام الجغرافي المركزي (geo_centers).',
    };
  }
  if (String(centerRow.governorate_id || '') !== String(govRow.id)) {
    return {
      valid: false,
      reason: 'المركز المحدد لا يتبع المحافظة المختارة في النظام الجغرافي المركزي.',
    };
  }

  const areaRow = areaRes.data as Record<string, any> | null;
  if (!areaRow || !areaRow.id || areaRow.is_active === false) {
    return {
      valid: false,
      reason: 'المنطقة المحددة غير موجودة أو غير مفعّلة في النظام الجغرافي المركزي (geo_areas).',
    };
  }
  if (
    String(areaRow.center_id || '') !== String(centerRow.id) ||
    (areaRow.governorate_id && String(areaRow.governorate_id) !== String(govRow.id))
  ) {
    return {
      valid: false,
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

/**
 * Picks the most specific matching tariff from `delivery_area_tariffs` rows.
 * Specificity precedence (NO `parent_area_id`):
 * 1) area_id match
 * 2) center_id match (with null area_id)
 * 3) governorate_id match (with null center_id & null area_id)
 * Within each level, prefers explicit `restaurant_id` match over generic `restaurant_id IS NULL`.
 */
function pickMostSpecificTariff(
  tariffs: DeliveryAreaTariff[],
  governorateId: string,
  centerId: string,
  areaId: string,
  restaurantId?: string | null,
  requireExactRestaurantMatch = false
): { tariff: DeliveryAreaTariff; matchedLevel: 'area' | 'center' | 'governorate' } | null {
  const rankRestaurantMatch = (t: DeliveryAreaTariff): number => {
    if (restaurantId && t.restaurant_id === restaurantId) return 2;
    if (!t.restaurant_id) return 1;
    return 0;
  };

  const eligible = tariffs.filter((t) => {
    if (t.is_enabled === false) return false;
    if (requireExactRestaurantMatch) {
      if (!restaurantId || t.restaurant_id !== restaurantId) return false;
    } else {
      if (t.restaurant_id && restaurantId && t.restaurant_id !== restaurantId) return false;
      if (t.restaurant_id && !restaurantId) return false;
    }
    if (t.governorate_id && t.governorate_id !== governorateId) return false;
    if (t.center_id && t.center_id !== centerId) return false;
    return true;
  });

  // 1) Area level
  const areaMatches = eligible
    .filter((t) => t.area_id === areaId)
    .sort((a, b) => rankRestaurantMatch(b) - rankRestaurantMatch(a));

  if (areaMatches.length > 0) {
    return { tariff: areaMatches[0], matchedLevel: 'area' };
  }

  // 2) Center level (center_id matches and area_id is null)
  const centerMatches = eligible
    .filter((t) => t.center_id === centerId && !t.area_id)
    .sort((a, b) => rankRestaurantMatch(b) - rankRestaurantMatch(a));

  if (centerMatches.length > 0) {
    return { tariff: centerMatches[0], matchedLevel: 'center' };
  }

  // 3) Governorate level (governorate_id matches and both center_id & area_id are null)
  const govMatches = eligible
    .filter((t) => t.governorate_id === governorateId && !t.center_id && !t.area_id)
    .sort((a, b) => rankRestaurantMatch(b) - rankRestaurantMatch(a));

  if (govMatches.length > 0) {
    return { tariff: govMatches[0], matchedLevel: 'governorate' };
  }

  return null;
}

/**
 * Resolves central delivery tariff from `delivery_area_tariffs` using exact `service_type` and `delivery_owner`.
 * Enforces:
 * - Active 3-level `geo_*` hierarchy validation
 * - GPS boundary containment (`geo_areas.boundary` -> `geo_centers.boundary` -> `geo_governorates.boundary`)
 * - Tariff precedence: Area -> Center -> Governorate
 * - Exposes tariff snapshot values (`tariffId`, `baseFee`, `adminCommission`, `driverNet`, `customerDeliveryFee`)
 * - Never falls back to hardcoded fees or legacy tables.
 */
export async function resolveCentralTariff(params: {
  serviceType: ServiceCategoryType;
  deliveryOwner: DeliveryOwnerType;
  restaurantId?: string | null;
  requireExactRestaurantMatch?: boolean;
  governorateId?: string | null;
  centerId?: string | null;
  areaId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  client?: SupabaseClient;
}): Promise<CentralTariffResolution> {
  const {
    serviceType,
    deliveryOwner,
    restaurantId,
    requireExactRestaurantMatch = false,
    governorateId,
    centerId,
    areaId,
    latitude,
    longitude,
    client,
  } = params;

  const emptyFailure = (
    reason: string,
    extra: Partial<CentralTariffResolution> = {}
  ): CentralTariffResolution => ({
    covered: false,
    tariffId: null,
    customerDeliveryFee: null,
    baseFee: null,
    adminCommission: null,
    driverNet: null,
    isFreeDelivery: false,
    freeDeliveryCostBearer: null,
    estimatedDeliveryMinutes: null,
    matchedLevel: null,
    applicableDeliveryOwner: deliveryOwner || null,
    reason,
    ...extra,
  });

  if (!governorateId || !centerId || !areaId) {
    return emptyFailure('يجب تحديد المحافظة والمركز والمنطقة من النظام الجغرافي المعتمد أولاً');
  }

  const db = getClient(client);
  const hierarchyCheck = await validateGeoHierarchySelection(governorateId, centerId, areaId, db);
  if (!hierarchyCheck.valid) {
    return emptyFailure(
      hierarchyCheck.reason || 'التسلسل الجغرافي للعنوان غير صحيح أو غير مفعّل',
      { boundaryFailed: true }
    );
  }

  // Enforce GPS boundary check when coordinates are supplied
  let boundaryCheck: BoundaryCheckResult = { checked: false, inside: true, level: null };
  const hasCoordArgs = 'latitude' in params || 'longitude' in params;
  if (hasCoordArgs) {
    const gpsCheck = validateGpsCoordinates(latitude, longitude);
    if (!gpsCheck.valid) {
      return emptyFailure(
        gpsCheck.reason || 'إحداثيات GPS مطلوبة للتحقق من النطاق الجغرافي.',
        { boundaryFailed: true }
      );
    }
    boundaryCheck = checkGpsWithinGeoBoundary(gpsCheck.latitude, gpsCheck.longitude, {
      area: hierarchyCheck.area,
      center: hierarchyCheck.center,
      governorate: hierarchyCheck.governorate,
    });
    if (!boundaryCheck.inside) {
      return emptyFailure(
        boundaryCheck.reason || 'موقعك الجغرافي يقع خارج حدود المنطقة المحددة.',
        {
          boundaryChecked: boundaryCheck.checked,
          boundaryLevel: boundaryCheck.level,
          boundaryFailed: true,
        }
      );
    }
  }

  let query = db
    .from('delivery_area_tariffs')
    .select('*')
    .eq('service_type', serviceType)
    .eq('delivery_owner', deliveryOwner)
    .eq('is_enabled', true);

  if (requireExactRestaurantMatch && restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }

  const { data, error } = await query;

  if (error) {
    return emptyFailure(`تعذر جلب تسعيرة التوصيل المركزية: ${error.message}`, {
      boundaryChecked: boundaryCheck.checked,
      boundaryLevel: boundaryCheck.level,
      queryFailed: true,
    });
  }

  const rows = ((data || []) as DeliveryAreaTariff[]).filter(
    (r) => r.service_type === serviceType && r.delivery_owner === deliveryOwner && r.is_enabled !== false
  );

  const picked = pickMostSpecificTariff(
    rows,
    governorateId,
    centerId,
    areaId,
    restaurantId,
    requireExactRestaurantMatch
  );

  if (!picked) {
    return emptyFailure('لا توجد تسعيرة توصيل مفعّلة لهذا النطاق الجغرافي حالياً', {
      boundaryChecked: boundaryCheck.checked,
      boundaryLevel: boundaryCheck.level,
    });
  }

  const tariff = picked.tariff;
  const isFree = Boolean(tariff.is_free_delivery);
  const fee = isFree
    ? 0
    : tariff.customer_delivery_fee !== null && tariff.customer_delivery_fee !== undefined
    ? Number(tariff.customer_delivery_fee)
    : null;

  const baseFeeRaw = tariff.base_fee !== null && tariff.base_fee !== undefined ? Number(tariff.base_fee) : null;
  const adminCommissionRaw =
    tariff.admin_commission !== null && tariff.admin_commission !== undefined
      ? Number(tariff.admin_commission)
      : null;
  const driverNetRaw =
    tariff.driver_net !== null && tariff.driver_net !== undefined
      ? Number(tariff.driver_net)
      : tariff.driver_net_fee !== null && tariff.driver_net_fee !== undefined
      ? Number(tariff.driver_net_fee)
      : null;

  if (!isFree && (fee === null || !Number.isFinite(fee) || fee < 0)) {
    return emptyFailure('تسعيرة التوصيل لهذه المنطقة غير مكتملة في النظام المركزي', {
      tariffId: tariff.id,
      matchedLevel: picked.matchedLevel,
      boundaryChecked: boundaryCheck.checked,
      boundaryLevel: boundaryCheck.level,
      applicableDeliveryOwner: (tariff.delivery_owner as DeliveryOwnerType) || deliveryOwner,
    });
  }

  return {
    covered: true,
    tariffId: tariff.id,
    customerDeliveryFee: fee,
    baseFee: baseFeeRaw !== null && Number.isFinite(baseFeeRaw) ? baseFeeRaw : fee,
    adminCommission:
      adminCommissionRaw !== null && Number.isFinite(adminCommissionRaw) ? adminCommissionRaw : 0,
    driverNet: driverNetRaw !== null && Number.isFinite(driverNetRaw) ? driverNetRaw : null,
    isFreeDelivery: isFree,
    freeDeliveryCostBearer: tariff.free_delivery_cost_bearer || null,
    estimatedDeliveryMinutes:
      tariff.estimated_delivery_minutes !== null && tariff.estimated_delivery_minutes !== undefined
        ? Number(tariff.estimated_delivery_minutes)
        : null,
    matchedLevel: picked.matchedLevel,
    applicableDeliveryOwner: (tariff.delivery_owner as DeliveryOwnerType) || deliveryOwner,
    boundaryChecked: boundaryCheck.checked,
    boundaryLevel: boundaryCheck.level,
  };
}

/**
 * Inspects restaurant record flags for UI display only (tariff resolution always queries `delivery_area_tariffs` directly).
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
 * Resolves ready-made food (`service_type = "ready_food"`) coverage & central tariff strictly from `delivery_area_tariffs`:
 * 1) Check restaurant tariff: `service_type = "ready_food"`, `delivery_owner = "restaurant"`, `restaurant_id = restaurant.id`.
 *    - If covered -> use restaurant tariff.
 * 2) Otherwise check platform tariff: `service_type = "ready_food"`, `delivery_owner = "platform"`.
 *    - If covered -> use platform tariff.
 * 3) If in neither -> block order and return "أنت خارج نطاق التوصيل".
 *
 * Forbidden: Never reads `restaurant_service_areas`, `restaurant_section_service_areas`, or `restaurant_area_delivery_fees`.
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
  const restaurantId = String(restaurant?.id || '');
  const hasOwnDeliveryFlag =
    typeof restaurant?.hasOwnDelivery === 'boolean'
      ? restaurant.hasOwnDelivery
      : detectRestaurantOwnDelivery(restaurant);

  const blocked = (
    reason: string,
    extra: Partial<RestaurantScopeAndTariffResult> = {}
  ): RestaurantScopeAndTariffResult => ({
    covered: false,
    hasOwnDelivery: hasOwnDeliveryFlag,
    inRestaurantScope: false,
    tariffId: null,
    customerDeliveryFee: null,
    baseFee: null,
    adminCommission: null,
    driverNet: null,
    isFreeDelivery: false,
    freeDeliveryCostBearer: null,
    estimatedDeliveryMinutes: null,
    matchedLevel: null,
    applicableDeliveryOwner: null,
    reason,
    ...extra,
  });

  if (!restaurantId) {
    return blocked('بيانات المطعم غير مكتملة');
  }

  if (!governorateId || !centerId || !areaId) {
    return blocked('يرجى تحديد عنوان يحتوي على المحافظة والمركز والمنطقة للتحقق من نطاق التوصيل والتسعيرة');
  }

  const db = getClient(client);
  const coordProps =
    'latitude' in params || 'longitude' in params
      ? { latitude, longitude }
      : {};

  // Step 1: Check restaurant-owned tariff in `delivery_area_tariffs`
  const restaurantTariff = await resolveCentralTariff({
    serviceType: 'ready_food',
    deliveryOwner: 'restaurant',
    restaurantId,
    requireExactRestaurantMatch: true,
    governorateId,
    centerId,
    areaId,
    ...coordProps,
    client: db,
  });

  if (restaurantTariff.boundaryFailed || restaurantTariff.queryFailed) {
    return {
      ...restaurantTariff,
      covered: false,
      hasOwnDelivery: hasOwnDeliveryFlag,
      inRestaurantScope: false,
      applicableDeliveryOwner: null,
    };
  }

  if (restaurantTariff.covered) {
    return {
      ...restaurantTariff,
      hasOwnDelivery: true,
      inRestaurantScope: true,
      applicableDeliveryOwner: 'restaurant',
    };
  }

  // Step 2: Check platform-owned tariff in `delivery_area_tariffs`
  const platformTariff = await resolveCentralTariff({
    serviceType: 'ready_food',
    deliveryOwner: 'platform',
    restaurantId,
    requireExactRestaurantMatch: false,
    governorateId,
    centerId,
    areaId,
    ...coordProps,
    client: db,
  });

  if (platformTariff.boundaryFailed || platformTariff.queryFailed) {
    return {
      ...platformTariff,
      covered: false,
      hasOwnDelivery: hasOwnDeliveryFlag,
      inRestaurantScope: false,
      applicableDeliveryOwner: null,
    };
  }

  if (platformTariff.covered) {
    return {
      ...platformTariff,
      hasOwnDelivery: hasOwnDeliveryFlag,
      inRestaurantScope: false,
      applicableDeliveryOwner: 'platform',
    };
  }

  // Step 3: Covered by neither restaurant nor platform
  return {
    ...platformTariff,
    covered: false,
    hasOwnDelivery: hasOwnDeliveryFlag,
    inRestaurantScope: false,
    applicableDeliveryOwner: null,
    reason: 'أنت خارج نطاق التوصيل',
  };
}

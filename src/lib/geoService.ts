import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface GeoGovernorate {
  id: string;
  name_ar: string;
  name_en?: string | null;
  code?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface GeoCenter {
  id: string;
  governorate_id: string;
  name_ar: string;
  name_en?: string | null;
  code?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface GeoArea {
  id: string;
  governorate_id: string;
  center_id: string;
  parent_area_id?: string | null;
  name_ar: string;
  name_en?: string | null;
  code?: string | null;
  is_active: boolean;
  sort_order: number;
}

export type ServiceCategoryType = 'household' | 'pharmacy' | 'restaurant';
export type DeliveryOwnerType = 'talabaty' | 'restaurant';

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
  free_delivery_cost_bearer?: string | null;
  estimated_delivery_minutes?: number | null;
}

export interface CentralTariffResolution {
  covered: boolean;
  tariffId: string | null;
  customerDeliveryFee: number | null;
  isFreeDelivery: boolean;
  freeDeliveryCostBearer: string | null;
  estimatedDeliveryMinutes: number | null;
  matchedLevel: 'area' | 'parent_area' | 'center' | 'governorate' | null;
  applicableDeliveryOwner: DeliveryOwnerType | null;
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

export interface GeoAddressInput {
  governorateId?: string | null;
  centerId?: string | null;
  areaId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

const SERVICE_TYPE_CANDIDATES: Record<ServiceCategoryType, string[]> = {
  household: ['household', 'household_delivery', 'delivery', 'home_delivery', 'groceries'],
  pharmacy: ['pharmacy', 'pharmacy_delivery'],
  restaurant: ['restaurant', 'restaurants', 'food', 'bite_and_bait'],
};

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

function getClient(client?: SupabaseClient): SupabaseClient {
  const c = client || supabase;
  if (!c) {
    throw new Error('عميل قاعدة بيانات Supabase غير مهيأ.');
  }
  return c;
}

/**
 * Resolves active governorates strictly from central `geo_governorates` table.
 */
export async function getActiveGovernorates(client?: SupabaseClient): Promise<GeoGovernorate[]> {
  const db = getClient(client);
  const { data, error } = await db
    .from('geo_governorates')
    .select('id, name_ar, name_en, code, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name_ar', { ascending: true });

  if (error) {
    throw new Error(`فشل تحميل المحافظات من النظام الجغرافي المركزي: ${error.message}`);
  }

  return (data || []) as GeoGovernorate[];
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
  const { data, error } = await db
    .from('geo_centers')
    .select('id, governorate_id, name_ar, name_en, code, is_active, sort_order')
    .eq('governorate_id', governorateId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name_ar', { ascending: true });

  if (error) {
    throw new Error(`فشل تحميل المراكز والمدن من النظام الجغرافي المركزي: ${error.message}`);
  }

  return (data || []) as GeoCenter[];
}

/**
 * Resolves active areas strictly from central `geo_areas` filtered by `governorate_id` and `center_id`.
 */
export async function getActiveAreas(
  governorateId: string,
  centerId: string,
  client?: SupabaseClient
): Promise<GeoArea[]> {
  if (!governorateId || !centerId) return [];
  const db = getClient(client);
  const { data, error } = await db
    .from('geo_areas')
    .select('id, governorate_id, center_id, parent_area_id, name_ar, name_en, code, is_active, sort_order')
    .eq('governorate_id', governorateId)
    .eq('center_id', centerId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name_ar', { ascending: true });

  if (error) {
    throw new Error(`فشل تحميل المناطق والأحياء من النظام الجغرافي المركزي: ${error.message}`);
  }

  return (data || []) as GeoArea[];
}

/**
 * Collects area ancestor chain (areaId -> parent_area_id -> ...) so hierarchical area tariffs/scopes match cleanly.
 */
async function resolveAreaAncestorIds(
  areaId: string | null | undefined,
  client?: SupabaseClient
): Promise<string[]> {
  if (!areaId) return [];
  const db = getClient(client);
  const chain: string[] = [];
  let currentId: string | null | undefined = areaId;
  let guard = 0;

  while (currentId && guard < 6) {
    guard += 1;
    if (chain.includes(currentId)) break;
    chain.push(currentId);

    const { data, error } = await db
      .from('geo_areas')
      .select('id, parent_area_id')
      .eq('id', currentId)
      .maybeSingle();

    if (error || !data) break;
    currentId = (data as { parent_area_id?: string | null }).parent_area_id || null;
  }

  return chain;
}

/**
 * Picks the most specific matching tariff from `delivery_area_tariffs` rows.
 * Specificity precedence:
 * 1) area_id match (exact area first, then parent_area chain)
 * 2) center_id match (with null area_id)
 * 3) governorate_id match (with null center_id & null area_id)
 * Within each level, prefers explicit `restaurant_id` match over generic `restaurant_id IS NULL`.
 */
function pickMostSpecificTariff(
  tariffs: DeliveryAreaTariff[],
  governorateId: string,
  centerId: string,
  areaChain: string[],
  restaurantId?: string | null
): { tariff: DeliveryAreaTariff; matchedLevel: 'area' | 'parent_area' | 'center' | 'governorate' } | null {
  const rankRestaurantMatch = (t: DeliveryAreaTariff): number => {
    if (restaurantId && t.restaurant_id === restaurantId) return 2;
    if (!t.restaurant_id) return 1;
    return 0;
  };

  const eligible = tariffs.filter((t) => {
    if (t.is_enabled === false) return false;
    if (t.restaurant_id && restaurantId && t.restaurant_id !== restaurantId) return false;
    if (t.restaurant_id && !restaurantId) return false;
    if (t.governorate_id && t.governorate_id !== governorateId) return false;
    return true;
  });

  // 1) Area chain (index 0 = exact area, index > 0 = parent_area)
  for (let idx = 0; idx < areaChain.length; idx += 1) {
    const targetAreaId = areaChain[idx];
    const matches = eligible
      .filter((t) => t.area_id === targetAreaId)
      .sort((a, b) => rankRestaurantMatch(b) - rankRestaurantMatch(a));

    if (matches.length > 0) {
      return {
        tariff: matches[0],
        matchedLevel: idx === 0 ? 'area' : 'parent_area',
      };
    }
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
 * Resolves central delivery tariff from `delivery_area_tariffs`.
 * Never reads or computes `admin_commission` or `driver_net_fee` on the client.
 * Never returns a hardcoded fallback delivery fee (e.g., 15) when covered tariff is missing.
 */
export async function resolveCentralTariff(params: {
  serviceType: ServiceCategoryType;
  deliveryOwner?: DeliveryOwnerType;
  restaurantId?: string | null;
  governorateId?: string | null;
  centerId?: string | null;
  areaId?: string | null;
  client?: SupabaseClient;
}): Promise<CentralTariffResolution> {
  const {
    serviceType,
    deliveryOwner,
    restaurantId,
    governorateId,
    centerId,
    areaId,
    client,
  } = params;

  if (!governorateId || !centerId || !areaId) {
    return {
      covered: false,
      tariffId: null,
      customerDeliveryFee: null,
      isFreeDelivery: false,
      freeDeliveryCostBearer: null,
      estimatedDeliveryMinutes: null,
      matchedLevel: null,
      applicableDeliveryOwner: deliveryOwner || null,
      reason: 'يجب تحديد المحافظة والمركز والمنطقة من النظام الجغرافي المعتمد أولاً',
    };
  }

  const db = getClient(client);
  const serviceCandidates = SERVICE_TYPE_CANDIDATES[serviceType];

  const { data, error } = await db
    .from('delivery_area_tariffs')
    .select(
      'id, service_type, delivery_owner, restaurant_id, scope_level, governorate_id, center_id, area_id, is_enabled, is_free_delivery, customer_delivery_fee, free_delivery_cost_bearer, estimated_delivery_minutes'
    )
    .in('service_type', serviceCandidates)
    .eq('is_enabled', true);

  if (error) {
    return {
      covered: false,
      tariffId: null,
      customerDeliveryFee: null,
      isFreeDelivery: false,
      freeDeliveryCostBearer: null,
      estimatedDeliveryMinutes: null,
      matchedLevel: null,
      applicableDeliveryOwner: deliveryOwner || null,
      reason: `تعذر جلب تسعيرة التوصيل المركزية: ${error.message}`,
    };
  }

  let rows = (data || []) as DeliveryAreaTariff[];

  if (deliveryOwner) {
    rows = rows.filter((r) => !r.delivery_owner || r.delivery_owner === deliveryOwner);
  }

  const areaChain = await resolveAreaAncestorIds(areaId, db);
  const picked = pickMostSpecificTariff(rows, governorateId, centerId, areaChain, restaurantId);

  if (!picked) {
    return {
      covered: false,
      tariffId: null,
      customerDeliveryFee: null,
      isFreeDelivery: false,
      freeDeliveryCostBearer: null,
      estimatedDeliveryMinutes: null,
      matchedLevel: null,
      applicableDeliveryOwner: deliveryOwner || null,
      reason: 'لا توجد تسعيرة توصيل مفعّلة لهذا النطاق الجغرافي حالياً',
    };
  }

  const tariff = picked.tariff;
  const isFree = Boolean(tariff.is_free_delivery);
  const fee = isFree
    ? 0
    : tariff.customer_delivery_fee !== null && tariff.customer_delivery_fee !== undefined
    ? Number(tariff.customer_delivery_fee)
    : null;

  if (!isFree && (fee === null || !Number.isFinite(fee) || fee < 0)) {
    return {
      covered: false,
      tariffId: tariff.id,
      customerDeliveryFee: null,
      isFreeDelivery: false,
      freeDeliveryCostBearer: tariff.free_delivery_cost_bearer || null,
      estimatedDeliveryMinutes: tariff.estimated_delivery_minutes ?? null,
      matchedLevel: picked.matchedLevel,
      applicableDeliveryOwner: (tariff.delivery_owner as DeliveryOwnerType) || deliveryOwner || null,
      reason: 'تسعيرة التوصيل لهذه المنطقة غير مكتملة في النظام المركزي',
    };
  }

  return {
    covered: true,
    tariffId: tariff.id,
    customerDeliveryFee: fee,
    isFreeDelivery: isFree,
    freeDeliveryCostBearer: tariff.free_delivery_cost_bearer || null,
    estimatedDeliveryMinutes:
      tariff.estimated_delivery_minutes !== null && tariff.estimated_delivery_minutes !== undefined
        ? Number(tariff.estimated_delivery_minutes)
        : null,
    matchedLevel: picked.matchedLevel,
    applicableDeliveryOwner: (tariff.delivery_owner as DeliveryOwnerType) || deliveryOwner || null,
  };
}

/**
 * Inspects authentic database restaurant fields to determine if a restaurant has its own delivery fleet enabled.
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
 * Resolves restaurant delivery scope + central tariff strictly according to Case 1 & Case 2:
 *
 * Case 1 (`hasOwnDelivery === true`):
 *  - Check `restaurant_service_areas` for this restaurant and address geo hierarchy.
 *  - Inside `restaurant_service_areas` -> restaurant delivery applies (using central tariff).
 *  - Outside `restaurant_service_areas` -> check Talabaty coverage in `delivery_area_tariffs`.
 *    - Covered -> Talabaty delivery applies.
 *    - Not covered -> blocked.
 *
 * Case 2 (`hasOwnDelivery === false`):
 *  - Do NOT treat `restaurant_service_areas` as available.
 *  - Check Talabaty coverage in `delivery_area_tariffs` for this restaurant / area.
 *    - Covered -> allowed via Talabaty.
 *    - Not covered -> blocked.
 *
 * Note: Client NEVER sets or overrides `fulfillment_route` in DB/RPC calls.
 */
export async function resolveRestaurantDeliveryScopeAndTariff(params: {
  restaurant: Record<string, any>;
  governorateId?: string | null;
  centerId?: string | null;
  areaId?: string | null;
  client?: SupabaseClient;
}): Promise<RestaurantScopeAndTariffResult> {
  const { restaurant, governorateId, centerId, areaId, client } = params;
  const restaurantId = String(restaurant?.id || '');
  const hasOwnDelivery =
    typeof restaurant?.hasOwnDelivery === 'boolean'
      ? restaurant.hasOwnDelivery
      : detectRestaurantOwnDelivery(restaurant);

  if (!restaurantId) {
    return {
      covered: false,
      hasOwnDelivery,
      inRestaurantScope: false,
      tariffId: null,
      customerDeliveryFee: null,
      isFreeDelivery: false,
      freeDeliveryCostBearer: null,
      estimatedDeliveryMinutes: null,
      matchedLevel: null,
      applicableDeliveryOwner: null,
      reason: 'بيانات المطعم غير مكتملة',
    };
  }

  if (!governorateId || !centerId || !areaId) {
    return {
      covered: false,
      hasOwnDelivery,
      inRestaurantScope: false,
      tariffId: null,
      customerDeliveryFee: null,
      isFreeDelivery: false,
      freeDeliveryCostBearer: null,
      estimatedDeliveryMinutes: null,
      matchedLevel: null,
      applicableDeliveryOwner: null,
      reason: 'يرجى تحديد عنوان يحتوي على المحافظة والمركز والمنطقة للتحقق من نطاق التوصيل والتسعيرة',
    };
  }

  const db = getClient(client);
  const areaChain = await resolveAreaAncestorIds(areaId, db);

  // Case 1: Restaurant supports own delivery -> verify `restaurant_service_areas` first
  if (hasOwnDelivery) {
    const { data: scopeRows, error: scopeErr } = await db
      .from('restaurant_service_areas')
      .select('id, governorate_id, center_id, area_id, is_active')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true);

    if (scopeErr) {
      return {
        covered: false,
        hasOwnDelivery: true,
        inRestaurantScope: false,
        tariffId: null,
        customerDeliveryFee: null,
        isFreeDelivery: false,
        freeDeliveryCostBearer: null,
        estimatedDeliveryMinutes: null,
        matchedLevel: null,
        applicableDeliveryOwner: null,
        reason: `تعذر التحقق من نطاق توصيل المطعم: ${scopeErr.message}`,
      };
    }

    const activeScopes = (scopeRows || []) as Array<{
      id: string;
      governorate_id?: string | null;
      center_id?: string | null;
      area_id?: string | null;
      is_active: boolean;
    }>;

    const matchedInRestaurantScope = activeScopes.some((s) => {
      if (s.area_id && areaChain.includes(s.area_id)) return true;
      if (!s.area_id && s.center_id && s.center_id === centerId) return true;
      if (!s.area_id && !s.center_id && s.governorate_id && s.governorate_id === governorateId) return true;
      return false;
    });

    if (matchedInRestaurantScope) {
      // Inside restaurant own-delivery scope -> resolve central tariff with restaurant owner preference
      const restaurantTariff = await resolveCentralTariff({
        serviceType: 'restaurant',
        deliveryOwner: 'restaurant',
        restaurantId,
        governorateId,
        centerId,
        areaId,
        client: db,
      });

      if (restaurantTariff.covered) {
        return {
          ...restaurantTariff,
          hasOwnDelivery: true,
          inRestaurantScope: true,
          applicableDeliveryOwner: 'restaurant',
        };
      }

      return {
        ...restaurantTariff,
        covered: false,
        hasOwnDelivery: true,
        inRestaurantScope: true,
        applicableDeliveryOwner: 'restaurant',
        reason:
          restaurantTariff.reason ||
          'العنوان داخل نطاق المطعم لكن تسعيرة التوصيل المركزية للمطعم غير مفعّلة لهذه المنطقة',
      };
    }

    // Outside restaurant scope -> verify Talabaty coverage in `delivery_area_tariffs`
    const talabatyTariff = await resolveCentralTariff({
      serviceType: 'restaurant',
      deliveryOwner: 'talabaty',
      restaurantId,
      governorateId,
      centerId,
      areaId,
      client: db,
    });

    if (talabatyTariff.covered) {
      return {
        ...talabatyTariff,
        hasOwnDelivery: true,
        inRestaurantScope: false,
        applicableDeliveryOwner: 'talabaty',
      };
    }

    return {
      ...talabatyTariff,
      covered: false,
      hasOwnDelivery: true,
      inRestaurantScope: false,
      applicableDeliveryOwner: null,
      reason: 'عنوانك خارج نطاق توصيل المطعم وخارج نطاق تغطية توصيل طلباتي لهذه المنطقة',
    };
  }

  // Case 2: Restaurant own delivery is disabled -> ignore `restaurant_service_areas`, check Talabaty coverage only
  const talabatyTariff = await resolveCentralTariff({
    serviceType: 'restaurant',
    deliveryOwner: 'talabaty',
    restaurantId,
    governorateId,
    centerId,
    areaId,
    client: db,
  });

  if (talabatyTariff.covered) {
    return {
      ...talabatyTariff,
      hasOwnDelivery: false,
      inRestaurantScope: false,
      applicableDeliveryOwner: 'talabaty',
    };
  }

  return {
    ...talabatyTariff,
    covered: false,
    hasOwnDelivery: false,
    inRestaurantScope: false,
    applicableDeliveryOwner: null,
    reason: 'هذه المنطقة غير مغطاة بتوصيل طلباتي لهذا المطعم حالياً',
  };
}

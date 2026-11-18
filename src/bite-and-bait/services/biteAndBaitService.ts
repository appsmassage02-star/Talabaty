import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type {
  Restaurant,
  MenuItem,
  MenuOptionGroup,
  MenuOptionItem,
  FoodOffer,
  FoodCustomerAddress,
  FoodOrderStatus,
  FoodDeliveryStatus,
  RestaurantCategory,
  RestaurantSectionSettings,
  GeographicVerificationResult,
  BiteBaitFoodOrder,
  BiteBaitOrderStatusHistoryItem,
  CreateBiteBaitOrderItemPayload,
  CreateBiteBaitOrderParams,
  CreateBiteBaitOrderResult,
} from '../types';
import {
  checkGpsWithinGeoBoundary,
  detectRestaurantOwnDelivery,
  isValidUuid,
  resolveCentralTariff,
  resolveRestaurantDeliveryScopeAndTariff,
  validateGeoHierarchySelection,
  validateGpsCoordinates,
  type DeliveryOwnerType,
  type FulfillmentRouteType,
  type QuoteErrorCategory,
} from '../../lib/geoService';
import { sectionSettingsService } from '../../lib/sectionSettingsService';

// Tracks in-flight Bite & Bait order submissions keyed by idempotencyKey to guard against concurrent double submits
const inFlightBiteBaitOrderKeys = new Set<string>();

export interface ServiceResult<T> {
  success: boolean;
  data: T;
  error?: string;
  errorCode?: string;
  isConfigError?: boolean;
}

export interface RestaurantFilterParams {
  searchQuery?: string;
  cuisine?: string;
  onlyOpen?: boolean;
  sortBy?: 'recommended' | 'rating' | 'prepTime' | 'deliveryFee';
}

export interface RawDbOrderStatusHistory {
  id: string;
  order_id: string;
  old_status?: string | null;
  new_status: string;
  changed_by?: string | null;
  note?: string | null;
  created_at: string;
}

const FALLBACK_RESTAURANT_IMG =
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80';
const FALLBACK_MENU_IMG =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

/**
 * Maps database restaurant_orders.status to application domain status.
 * Covers at least:
 * - pending
 * - awaiting_restaurant_confirmation
 * - accepted
 * - preparing
 * - ready
 * - assigned_to_driver
 * - picked_up
 * - on_the_way
 * - delivered
 * - rejected
 * - cancelled
 *
 * CRITICAL: Unknown statuses NEVER automatically fallback to pending.
 */
export const mapOrderStatus = (status?: string): FoodOrderStatus => {
  const norm = (status || '').trim().toLowerCase();
  switch (norm) {
    case 'pending':
    case 'awaiting_restaurant_confirmation':
    case 'pending_restaurant_confirmation':
      return 'pending_restaurant_confirmation';
    case 'accepted':
    case 'confirmed':
    case 'restaurant_accepted':
      return 'restaurant_accepted';
    case 'preparing':
      return 'preparing';
    case 'ready':
    case 'ready_for_pickup':
      return 'ready_for_pickup';
    case 'assigned_to_driver':
    case 'picked_up':
    case 'out_for_delivery':
    case 'on_the_way':
      return 'out_for_delivery';
    case 'delivered':
    case 'completed':
      return 'delivered';
    case 'rejected':
    case 'rejected_by_restaurant':
      return 'rejected_by_restaurant';
    case 'cancelled':
      return 'cancelled';
    default:
      // Unknown statuses must be distinct and never impersonate pending orders
      return 'unknown' as FoodOrderStatus;
  }
};

export const mapDeliveryStatus = (status?: string): FoodDeliveryStatus => {
  const norm = (status || '').trim().toLowerCase();
  switch (norm) {
    case 'assigned_to_driver':
    case 'driver_assigned':
      return 'driver_assigned';
    case 'picked_up':
    case 'driver_at_restaurant':
      return 'driver_at_restaurant';
    case 'out_for_delivery':
    case 'on_the_way':
      return 'on_the_way';
    case 'arrived_customer':
      return 'arrived_customer';
    case 'delivered':
    case 'completed':
      return 'completed';
    case 'pending':
    case 'awaiting_restaurant_confirmation':
    case 'accepted':
    case 'preparing':
    case 'ready':
      return 'waiting_dispatch';
    default:
      return 'waiting_dispatch';
  }
};

/**
 * Normalizes Arabic text for flexible name matching
 */
export function normalizeArabicText(text?: string | null): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-_]+/g, ' ');
}

/**
 * Bite & Bait Service Layer
 * Strictly read-only operations connecting to Supabase tables.
 * Follows strict error preservation, zero fake metrics, and on-demand menu fetching.
 */
export const biteAndBaitService = {
  // --------------------------------------------------------------------------
  // 1. Read Ready-Food Section Settings STRICTLY from `public.app_section_settings` (`ready_food`)
  // --------------------------------------------------------------------------
  async getSectionSettings(): Promise<ServiceResult<RestaurantSectionSettings | null>> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        data: null,
        error: 'الاتصال بقاعدة بيانات Supabase غير مهيأ (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
        isConfigError: true,
      };
    }

    try {
      const central = await sectionSettingsService.fetchSectionSetting('ready_food');

      if (!central.loaded) {
        return {
          success: false,
          data: null,
          error:
            central.error ||
            'تعذر قراءة إعدادات قسم الأكلات الجاهزة من الجدول المركزي (app_section_settings).',
        };
      }

      const settings: RestaurantSectionSettings = {
        id: central.section_key,
        section_enabled: central.section_enabled,
        section_visibility: central.section_visible ? 'visible' : 'hidden',
        section_visible: central.section_visible,
        delivery_enabled: central.delivery_enabled,
        disabled_display_mode: 'show_disabled',
        updated_at: central.updated_at || undefined,
        status_message: !central.section_enabled
          ? 'قسم الأكلات الجاهزة متوقف حالياً ولا يمكن بدء طلبات جديدة منه.'
          : !central.delivery_enabled
          ? 'خدمة التوصيل متوقفة مؤقتًا'
          : undefined,
      };

      return {
        success: true,
        data: settings,
      };
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: err?.message || 'استثناء غير متوقع أثناء فحص إعدادات قسم الأكلات الجاهزة.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 1.1 Verify Geographic Service Scope strictly via V2 central geo_* & get_delivery_quote (`ready_food`)
  // --------------------------------------------------------------------------
  async verifyGeographicScope(
    address?: FoodCustomerAddress | null,
    providedHouseholdId?: string,
    providedUserId?: string,
    restaurantId?: string
  ): Promise<GeographicVerificationResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        isServiceable: false,
        errorCategory: 'rpc_error',
        reason: 'قاعدة بيانات Supabase غير مهيأة للتحقق من النطاق الجغرافي.',
      };
    }

    try {
      // If address is not provided directly, attempt to resolve user's saved/default address
      let targetAddress = address;
      if (!targetAddress) {
        const addrRes = await this.getHouseholdAddresses(providedHouseholdId, providedUserId);
        const savedAddresses = addrRes.success ? addrRes.data : [];
        targetAddress = savedAddresses.find((a) => a.isDefault) || savedAddresses[0] || null;
      }

      if (!targetAddress) {
        return {
          isServiceable: false,
          errorCategory: 'missing_geo_data',
          reason: 'يرجى تحديد عنوان توصيل مكتمل (المحافظة/المركز/المنطقة + GPS) للتحقق من نطاق التوصيل.',
        };
      }

      if (!targetAddress.governorateId || !targetAddress.centerId || !targetAddress.areaId) {
        return {
          isServiceable: false,
          errorCategory: 'missing_geo_data',
          reason: 'هذا العنوان غير مكتمل في النظام الجغرافي المركزي (يجب تحديد المحافظة والمركز والمنطقة).',
        };
      }

      if (
        !isValidUuid(targetAddress.governorateId) ||
        !isValidUuid(targetAddress.centerId) ||
        !isValidUuid(targetAddress.areaId)
      ) {
        return {
          isServiceable: false,
          errorCategory: 'invalid_geo_id',
          reason: 'معرّفات المحافظة أو المركز أو المنطقة غير صالحة (UUID غير صحيح).',
        };
      }

      // GPS coordinates are strictly required; never bypass or invent default coords
      const hasMissingGps =
        targetAddress.latitude === undefined ||
        targetAddress.latitude === null ||
        targetAddress.longitude === undefined ||
        targetAddress.longitude === null;
      const gpsCheck = validateGpsCoordinates(targetAddress.latitude, targetAddress.longitude);
      if (!gpsCheck.valid || gpsCheck.latitude === null || gpsCheck.longitude === null) {
        return {
          isServiceable: false,
          errorCategory: hasMissingGps ? 'missing_gps' : 'invalid_gps',
          reason: gpsCheck.reason || 'إحداثيات GPS غير صالحة أو مفقودة على العنوان.',
        };
      }

      // If a restaurantId is specified, validate via authoritative 7-param V2 get_delivery_quote
      if (restaurantId !== undefined) {
        if (!isValidUuid(restaurantId)) {
          return {
            isServiceable: false,
            errorCategory: 'invalid_restaurant',
            reason: 'معرف المطعم غير صالح.',
          };
        }

        const quoteRes = await resolveCentralTariff({
          serviceType: 'ready_food',
          governorateId: targetAddress.governorateId,
          centerId: targetAddress.centerId,
          areaId: targetAddress.areaId,
          latitude: gpsCheck.latitude,
          longitude: gpsCheck.longitude,
          restaurantId,
          client: supabase,
        });

        return {
          isServiceable: quoteRes.covered,
          matchedLevel: quoteRes.matchedLevel || undefined,
          governorateId: targetAddress.governorateId,
          centerId: targetAddress.centerId,
          areaId: targetAddress.areaId,
          errorCategory: quoteRes.errorCategory || null,
          reason: quoteRes.covered ? undefined : quoteRes.reason,
        };
      }

      // Without a specific restaurantId, validate active geo_* hierarchy and GPS boundary cleanly
      const hierarchyCheck = await validateGeoHierarchySelection(
        targetAddress.governorateId,
        targetAddress.centerId,
        targetAddress.areaId,
        supabase
      );
      if (!hierarchyCheck.valid || !hierarchyCheck.governorate || !hierarchyCheck.center || !hierarchyCheck.area) {
        return {
          isServiceable: false,
          errorCategory: hierarchyCheck.errorCategory || 'outside_coverage',
          reason: hierarchyCheck.reason || 'التسلسل الجغرافي للعنوان غير مفعّل في النظام المركزي.',
        };
      }

      const boundaryCheck = checkGpsWithinGeoBoundary(gpsCheck.latitude, gpsCheck.longitude, {
        area: hierarchyCheck.area,
        center: hierarchyCheck.center,
        governorate: hierarchyCheck.governorate,
      });
      if (!boundaryCheck.inside) {
        return {
          isServiceable: false,
          errorCategory: 'gps_out_of_bounds',
          reason: boundaryCheck.reason || 'إحداثيات موقعك الجغرافي تقع خارج حدود المنطقة المحددة.',
          governorateId: hierarchyCheck.governorate.id,
          centerId: hierarchyCheck.center.id,
          areaId: hierarchyCheck.area.id,
        };
      }

      return {
        isServiceable: true,
        matchedLevel: 'area',
        governorateId: hierarchyCheck.governorate.id,
        centerId: hierarchyCheck.center.id,
        areaId: hierarchyCheck.area.id,
        errorCategory: null,
      };
    } catch (err: any) {
      return {
        isServiceable: false,
        errorCategory: 'rpc_error',
        reason: err?.message || 'استثناء أثناء التحقق من النطاق الجغرافي.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 1.2 Resolve Restaurant Delivery Scope & Central V2 Quote (`get_delivery_quote` for `ready_food`)
  // --------------------------------------------------------------------------
  async resolveDeliveryFee(
    restaurantId: string,
    address?: FoodCustomerAddress | null
  ): Promise<{
    fee: number | null;
    baseDeliveryFee: number | null;
    isCovered: boolean;
    isFreeDelivery: boolean;
    estimatedDeliveryMinutes: number | null;
    applicableDeliveryOwner: DeliveryOwnerType | null;
    fulfillmentRoute: FulfillmentRouteType | null;
    tariffId: string | null;
    hasOwnDelivery: boolean;
    inRestaurantScope: boolean;
    errorCategory?: QuoteErrorCategory | null;
    reason?: string;
  }> {
    const blocked = (reason: string, errorCategory: QuoteErrorCategory) => ({
      fee: null,
      baseDeliveryFee: null,
      isCovered: false,
      isFreeDelivery: false,
      estimatedDeliveryMinutes: null,
      applicableDeliveryOwner: null,
      fulfillmentRoute: null,
      tariffId: null,
      hasOwnDelivery: false,
      inRestaurantScope: false,
      errorCategory,
      reason,
    });

    if (!isSupabaseConfigured() || !supabase) {
      return blocked('قاعدة بيانات Supabase غير متصلة للتحقق من التغطية والتسعيرة.', 'rpc_error');
    }

    if (!restaurantId || !isValidUuid(restaurantId)) {
      return blocked('معرف المطعم غير محدد أو غير صالح للتحقق من التغطية.', 'invalid_restaurant');
    }

    if (!address) {
      return blocked('يرجى تحديد عنوان توصيل مكتمل للتحقق من نطاق تغطية المطعم.', 'missing_geo_data');
    }

    if (!address.governorateId || !address.centerId || !address.areaId) {
      return blocked('هذا العنوان يفتقد ربط المحافظة/المركز/المنطقة بالنظام الجغرافي المركزي.', 'missing_geo_data');
    }

    if (
      !isValidUuid(address.governorateId) ||
      !isValidUuid(address.centerId) ||
      !isValidUuid(address.areaId)
    ) {
      return blocked('معرّفات المحافظة أو المركز أو المنطقة غير صالحة (UUID غير صحيح).', 'invalid_geo_id');
    }

    const hasMissingGps =
      address.latitude === undefined ||
      address.latitude === null ||
      address.longitude === undefined ||
      address.longitude === null;
    const gpsCheck = validateGpsCoordinates(address.latitude, address.longitude);
    if (!gpsCheck.valid || gpsCheck.latitude === null || gpsCheck.longitude === null) {
      return blocked(
        gpsCheck.reason || 'إحداثيات GPS غير صالحة أو مفقودة على العنوان.',
        hasMissingGps ? 'missing_gps' : 'invalid_gps'
      );
    }

    try {
      const { data: restRow, error: restErr } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .maybeSingle();

      if (restErr) {
        return blocked(
          `تعذر التحقق من بيانات المطعم: ${restErr.message}`,
          'rpc_error'
        );
      }

      if (!restRow || restRow.is_active === false) {
        return blocked(
          'المطعم غير موجود أو غير متاح حالياً في قاعدة البيانات.',
          'invalid_restaurant'
        );
      }

      const scopeAndTariff = await resolveRestaurantDeliveryScopeAndTariff({
        restaurant: restRow,
        governorateId: address.governorateId,
        centerId: address.centerId,
        areaId: address.areaId,
        latitude: gpsCheck.latitude,
        longitude: gpsCheck.longitude,
        client: supabase,
      });

      return {
        fee: scopeAndTariff.customerDeliveryFee,
        baseDeliveryFee: scopeAndTariff.baseDeliveryFee,
        isCovered: scopeAndTariff.covered,
        isFreeDelivery: scopeAndTariff.isFreeDelivery,
        estimatedDeliveryMinutes: scopeAndTariff.estimatedDeliveryMinutes,
        applicableDeliveryOwner: scopeAndTariff.applicableDeliveryOwner,
        fulfillmentRoute: scopeAndTariff.fulfillmentRoute,
        tariffId: scopeAndTariff.tariffId,
        hasOwnDelivery: scopeAndTariff.hasOwnDelivery,
        inRestaurantScope: scopeAndTariff.inRestaurantScope,
        errorCategory: scopeAndTariff.errorCategory || null,
        reason: scopeAndTariff.reason,
      };
    } catch (err: any) {
      return blocked(
        err?.message || 'استثناء غير متوقع أثناء التحقق من تغطية وتسعيرة المطعم.',
        'rpc_error'
      );
    }
  },

  // --------------------------------------------------------------------------
  // 2. Read Categories (restaurant_categories)
  // --------------------------------------------------------------------------
  async getCategories(): Promise<ServiceResult<RestaurantCategory[]>> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        data: [],
        error: 'قاعدة بيانات Supabase غير متصلة.',
        isConfigError: true,
      };
    }

    try {
      const { data, error } = await supabase
        .from('restaurant_categories')
        .select('id, name, image_url, sort_order, is_active, created_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة تصنيفات المطاعم (restaurant_categories): ${error.message}`,
          errorCode: error.code,
        };
      }

      const categories: RestaurantCategory[] = (data || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name || '',
        image_url: cat.image_url,
        sort_order: Number(cat.sort_order) || 0,
        is_active: Boolean(cat.is_active),
        created_at: cat.created_at,
      }));

      return {
        success: true,
        data: categories,
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err?.message || 'حدث استثناء أثناء جلب تصنيفات المطاعم.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 3. Read Restaurants (restaurants, restaurant_categories, restaurant_category_links, restaurant_menu_categories)
  // Checks all parallel queries strictly and does not ignore errors
  // --------------------------------------------------------------------------
  async getRestaurants(filters: RestaurantFilterParams = {}): Promise<ServiceResult<Restaurant[]>> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        data: [],
        error: 'قاعدة بيانات Supabase غير متصلة.',
        isConfigError: true,
      };
    }

    try {
      // 3.1 Fetch active restaurants (* preserves own-delivery capability flags safely)
      const { data: rawRestaurants, error: restError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_active', true);

      if (restError) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة المطاعم (restaurants): ${restError.message}`,
          errorCode: restError.code,
        };
      }

      if (!rawRestaurants || rawRestaurants.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // 3.2 Fetch category links and categories in parallel and strictly verify all results
      const [linksRes, categoriesRes, menuCatsRes] = await Promise.all([
        supabase.from('restaurant_category_links').select('restaurant_id, category_id'),
        supabase.from('restaurant_categories').select('id, name, is_active').eq('is_active', true),
        supabase
          .from('restaurant_menu_categories')
          .select('id, restaurant_id, name, sort_order, is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      if (linksRes.error) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة روابط تصنيفات المطاعم (restaurant_category_links): ${linksRes.error.message}`,
          errorCode: linksRes.error.code,
        };
      }

      if (categoriesRes.error) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة تصنيفات المطاعم (restaurant_categories): ${categoriesRes.error.message}`,
          errorCode: categoriesRes.error.code,
        };
      }

      if (menuCatsRes.error) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة تصنيفات قوائم المطاعم (restaurant_menu_categories): ${menuCatsRes.error.message}`,
          errorCode: menuCatsRes.error.code,
        };
      }

      const catMap = new Map<string, string>();
      (categoriesRes.data || []).forEach((c: any) => {
        catMap.set(c.id, c.name);
      });

      const restCategoriesMap = new Map<string, string[]>();
      (linksRes.data || []).forEach((l: any) => {
        const catName = catMap.get(l.category_id);
        if (catName) {
          const list = restCategoriesMap.get(l.restaurant_id) || [];
          list.push(catName);
          restCategoriesMap.set(l.restaurant_id, list);
        }
      });

      const restMenuCatsMap = new Map<string, string[]>();
      (menuCatsRes.data || []).forEach((mc: any) => {
        const list = restMenuCatsMap.get(mc.restaurant_id) || [];
        list.push(mc.name);
        restMenuCatsMap.set(mc.restaurant_id, list);
      });

      // 3.3 Map DB rows to domain model WITHOUT fake ratings, prep times, distances or hardcoded delivery fees
      let mapped: Restaurant[] = rawRestaurants.map((r: any) => {
        const cuisineTypes = restCategoriesMap.get(r.id) || ['مأكولات متنوعة'];
        const menuCategories = restMenuCatsMap.get(r.id) || ['قائمة الطعام'];
        const isOpen = Boolean(r.is_open);
        const img = r.image_url || FALLBACK_RESTAURANT_IMG;
        const hasOwnDelivery = detectRestaurantOwnDelivery(r);

        return {
          id: r.id,
          name: r.name || 'مطعم',
          description: r.description || '',
          logoUrl: img,
          bannerUrl: img,
          cuisineTypes,
          rating: 0, // Zero invented ratings
          reviewsCount: 0, // Zero invented reviews
          estimatedPrepTimeMinutes: 0, // Zero invented prep time
          deliveryFee: null, // Resolved exclusively via central delivery_area_tariffs
          hasOwnDelivery,
          tariffResolved: false,
          isFreeDelivery: false,
          minOrderAmount: 0,
          isOpen,
          openingHours: isOpen ? 'مفتوح للطلب' : 'مغلق حالياً',
          address: r.address || '',
          governorate: '',
          phone: r.phone || '',
          deliveryChannel: 'direct_system',
          distanceKm: 0, // Zero invented distance
          menuCategories,
        };
      });

      // 3.4 Apply in-memory search and filter criteria
      if (filters.searchQuery?.trim()) {
        const q = filters.searchQuery.trim().toLowerCase();
        mapped = mapped.filter((r) => {
          const matchesName = r.name.toLowerCase().includes(q);
          const matchesCuisine = r.cuisineTypes.some((c) => c.toLowerCase().includes(q));
          const matchesDesc = r.description.toLowerCase().includes(q);
          return matchesName || matchesCuisine || matchesDesc;
        });
      }

      if (filters.cuisine && filters.cuisine !== 'الكل' && filters.cuisine !== 'All') {
        mapped = mapped.filter((r) => r.cuisineTypes.includes(filters.cuisine!));
      }

      if (filters.onlyOpen) {
        mapped = mapped.filter((r) => r.isOpen);
      }

      if (filters.sortBy === 'deliveryFee') {
        mapped.sort(
          (a, b) =>
            (a.deliveryFee ?? Number.MAX_SAFE_INTEGER) -
            (b.deliveryFee ?? Number.MAX_SAFE_INTEGER)
        );
      } else {
        // Open restaurants first, then by name
        mapped.sort((a, b) => {
          if (a.isOpen && !b.isOpen) return -1;
          if (!a.isOpen && b.isOpen) return 1;
          return a.name.localeCompare(b.name, 'ar');
        });
      }

      return {
        success: true,
        data: mapped,
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err?.message || 'استثناء غير متوقع أثناء استرجاع قائمة المطاعم.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 4. Read Single Restaurant by ID
  // --------------------------------------------------------------------------
  async getRestaurantById(restaurantId: string): Promise<ServiceResult<Restaurant | null>> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, data: null, error: 'قاعدة بيانات Supabase غير متصلة.', isConfigError: true };
    }

    try {
      const { data: r, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .maybeSingle();

      if (error) {
        return { success: false, data: null, error: `خطأ في قراءة المطعم: ${error.message}`, errorCode: error.code };
      }

      if (!r) {
        return { success: true, data: null };
      }

      // Fetch cuisine types and menu categories for this restaurant
      const [linksRes, menuCatsRes] = await Promise.all([
        supabase
          .from('restaurant_category_links')
          .select('category_id, restaurant_categories(name)')
          .eq('restaurant_id', restaurantId),
        supabase
          .from('restaurant_menu_categories')
          .select('name')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      if (linksRes.error) {
        return {
          success: false,
          data: null,
          error: `خطأ في قراءة روابط تصنيفات المطعم: ${linksRes.error.message}`,
          errorCode: linksRes.error.code,
        };
      }

      if (menuCatsRes.error) {
        return {
          success: false,
          data: null,
          error: `خطأ في قراءة أقسام قائمة المطعم: ${menuCatsRes.error.message}`,
          errorCode: menuCatsRes.error.code,
        };
      }

      const cuisineTypes = (linksRes.data || [])
        .map((l: any) => l.restaurant_categories?.name)
        .filter(Boolean);

      const menuCategories = (menuCatsRes.data || []).map((mc: any) => mc.name);
      const isOpen = Boolean(r.is_open);
      const img = r.image_url || FALLBACK_RESTAURANT_IMG;

      const restaurant: Restaurant = {
        id: r.id,
        name: r.name || 'مطعم',
        description: r.description || '',
        logoUrl: img,
        bannerUrl: img,
        cuisineTypes: cuisineTypes.length > 0 ? cuisineTypes : ['مأكولات متنوعة'],
        rating: 0,
        reviewsCount: 0,
        estimatedPrepTimeMinutes: 0,
        deliveryFee: null,
        hasOwnDelivery: detectRestaurantOwnDelivery(r),
        tariffResolved: false,
        isFreeDelivery: false,
        minOrderAmount: 0,
        isOpen,
        openingHours: isOpen ? 'مفتوح للطلب' : 'مغلق حالياً',
        address: r.address || '',
        governorate: '',
        phone: r.phone || '',
        deliveryChannel: 'direct_system',
        distanceKm: 0,
        menuCategories: menuCategories.length > 0 ? menuCategories : ['قائمة الطعام'],
      };

      return { success: true, data: restaurant };
    } catch (err: any) {
      return { success: false, data: null, error: err?.message || 'استثناء أثناء جلب تفاصيل المطعم.' };
    }
  },

  // --------------------------------------------------------------------------
  // 5. Read Restaurant Menu ON-DEMAND (restaurant_menu_categories, restaurant_menu_items, restaurant_item_options, restaurant_item_option_values)
  // Strictly loads only for the requested restaurant and validates options queries
  // --------------------------------------------------------------------------
  async getRestaurantMenu(restaurantId: string): Promise<ServiceResult<MenuItem[]>> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        data: [],
        error: 'قاعدة بيانات Supabase غير متصلة.',
        isConfigError: true,
      };
    }

    try {
      // 5.1 Fetch menu categories for this restaurant
      const { data: menuCats, error: catError } = await supabase
        .from('restaurant_menu_categories')
        .select('id, name, sort_order, is_active')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (catError) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة أقسام القائمة (restaurant_menu_categories): ${catError.message}`,
          errorCode: catError.code,
        };
      }

      const menuCatMap = new Map<string, string>();
      (menuCats || []).forEach((c: any) => menuCatMap.set(c.id, c.name));

      // 5.2 Fetch menu items for this restaurant
      const { data: rawItems, error: itemsError } = await supabase
        .from('restaurant_menu_items')
        .select(`
          id,
          restaurant_id,
          category_id,
          name,
          description,
          image_url,
          price,
          is_available,
          sort_order,
          created_at,
          updated_at
        `)
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true });

      if (itemsError) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة أصناف القائمة (restaurant_menu_items): ${itemsError.message}`,
          errorCode: itemsError.code,
        };
      }

      if (!rawItems || rawItems.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // 5.3 Fetch item options and values for these items
      const itemIds = rawItems.map((i: any) => i.id);

      const { data: optionsData, error: optError } = await supabase
        .from('restaurant_item_options')
        .select('id, restaurant_id, menu_item_id, name, required, min_select, max_select, sort_order')
        .eq('restaurant_id', restaurantId)
        .in('menu_item_id', itemIds)
        .order('sort_order', { ascending: true });

      if (optError) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة خيارات الأصناف (restaurant_item_options): ${optError.message}`,
          errorCode: optError.code,
        };
      }

      const optionIds = (optionsData || []).map((o: any) => o.id);
      let optionValuesData: any[] = [];

      if (optionIds.length > 0) {
        const { data: vals, error: valError } = await supabase
          .from('restaurant_item_option_values')
          .select('id, option_id, name, extra_price, is_available, sort_order')
          .in('option_id', optionIds)
          .eq('is_available', true)
          .order('sort_order', { ascending: true });

        if (valError) {
          return {
            success: false,
            data: [],
            error: `خطأ في قراءة قيم خيارات الأصناف (restaurant_item_option_values): ${valError.message}`,
            errorCode: valError.code,
          };
        }
        optionValuesData = vals || [];
      }

      // 5.4 Build options map: option_id -> MenuOptionItem[]
      const valuesByOptionId = new Map<string, MenuOptionItem[]>();
      optionValuesData.forEach((v) => {
        const list = valuesByOptionId.get(v.option_id) || [];
        list.push({
          id: v.id,
          name: v.name,
          price: Number(v.extra_price) || 0,
        });
        valuesByOptionId.set(v.option_id, list);
      });

      // 5.5 Build option groups map: menu_item_id -> MenuOptionGroup[]
      const optionGroupsByItemId = new Map<string, MenuOptionGroup[]>();
      (optionsData || []).forEach((opt: any) => {
        const optionItems = valuesByOptionId.get(opt.id) || [];
        const group: MenuOptionGroup = {
          id: opt.id,
          name: opt.name,
          isRequired: Boolean(opt.required),
          minSelection: Number(opt.min_select) || (opt.required ? 1 : 0),
          maxSelection: Number(opt.max_select) || 1,
          options: optionItems,
        };

        const list = optionGroupsByItemId.get(opt.menu_item_id) || [];
        list.push(group);
        optionGroupsByItemId.set(opt.menu_item_id, list);
      });

      // 5.6 Map to MenuItem array
      const mappedItems: MenuItem[] = rawItems.map((item: any) => {
        const categoryName = item.category_id
          ? menuCatMap.get(item.category_id) || 'أصناف متنوعة'
          : 'أصناف متنوعة';
        const optionGroups = optionGroupsByItemId.get(item.id) || [];

        return {
          id: item.id,
          restaurantId: item.restaurant_id,
          restaurantName: '',
          category: categoryName,
          name: item.name,
          description: item.description || '',
          price: Number(item.price) || 0,
          imageUrl: item.image_url || FALLBACK_MENU_IMG,
          isAvailable: Boolean(item.is_available),
          isPopular: false,
          optionGroups: optionGroups.length > 0 ? optionGroups : undefined,
          preparationTimeMinutes: 0, // Zero invented prep time
        };
      });

      return {
        success: true,
        data: mappedItems,
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err?.message || 'استثناء أثناء قراءة قائمة طعام المطعم.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 6. Read Offers (restaurant_offers)
  // Checks restaurant join error strictly
  // --------------------------------------------------------------------------
  async getOffers(restaurantId?: string): Promise<ServiceResult<FoodOffer[]>> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        data: [],
        error: 'قاعدة بيانات Supabase غير متصلة.',
        isConfigError: true,
      };
    }

    try {
      let query = supabase
        .from('restaurant_offers')
        .select(`
          id,
          restaurant_id,
          title,
          description,
          discount_type,
          discount_value,
          starts_at,
          ends_at,
          is_active,
          created_at
        `)
        .eq('is_active', true);

      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data: rawOffers, error } = await query;
      if (error) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة العروض (restaurant_offers): ${error.message}`,
          errorCode: error.code,
        };
      }

      if (!rawOffers || rawOffers.length === 0) {
        return { success: true, data: [] };
      }

      const now = Date.now();
      const validOffers = rawOffers.filter((o: any) => {
        if (!o.is_active) return false;
        if (o.starts_at && new Date(o.starts_at).getTime() > now) return false;
        if (o.ends_at && new Date(o.ends_at).getTime() < now) return false;
        return true;
      });

      if (validOffers.length === 0) {
        return { success: true, data: [] };
      }

      // Fetch restaurant names for display and strictly verify query error
      const restIds = Array.from(new Set(validOffers.map((o: any) => o.restaurant_id)));
      const { data: restList, error: restListErr } = await supabase
        .from('restaurants')
        .select('id, name, image_url')
        .in('id', restIds);

      if (restListErr) {
        return {
          success: false,
          data: [],
          error: `خطأ في استرجاع بيانات المطاعم المرتبطة بالعروض (restaurants): ${restListErr.message}`,
          errorCode: restListErr.code,
        };
      }

      const restNameMap = new Map<string, { name: string; img: string }>();
      (restList || []).forEach((r: any) => {
        restNameMap.set(r.id, { name: r.name, img: r.image_url || FALLBACK_RESTAURANT_IMG });
      });

      const offers: FoodOffer[] = validOffers.map((o: any) => {
        const restInfo = restNameMap.get(o.restaurant_id);
        const discountVal = Number(o.discount_value) || 0;
        const badge =
          o.discount_type === 'percentage'
            ? `خصم ${discountVal}%`
            : `وفر ${discountVal} ج.م`;

        return {
          id: o.id,
          title: o.title,
          description: o.description || '',
          badge,
          discountPercent: o.discount_type === 'percentage' ? discountVal : undefined,
          restaurantId: o.restaurant_id,
          restaurantName: restInfo?.name || 'مطعم',
          bannerUrl: restInfo?.img || FALLBACK_RESTAURANT_IMG,
          validUntil: o.ends_at
            ? `متاح حتى ${new Date(o.ends_at).toLocaleDateString('ar-EG')}`
            : 'ساري لفترة محدودة',
        };
      });

      return {
        success: true,
        data: offers,
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err?.message || 'استثناء أثناء قراءة عروض المطاعم.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 7. Read Restaurant Favorites (restaurant_favorites)
  // Strictly for restaurants only as noted in database schema
  // --------------------------------------------------------------------------
  async getFavoriteRestaurantIds(userId?: string): Promise<ServiceResult<string[]>> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, data: [], error: 'قاعدة بيانات Supabase غير متصلة.', isConfigError: true };
    }

    try {
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        targetUserId = session?.user?.id;
      }

      if (!targetUserId) {
        return { success: true, data: [] }; // Not logged in: no saved favorites
      }

      const { data, error } = await supabase
        .from('restaurant_favorites')
        .select('restaurant_id')
        .eq('customer_user_id', targetUserId);

      if (error) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة المفضلة (restaurant_favorites): ${error.message}`,
          errorCode: error.code,
        };
      }

      const favIds = (data || []).map((row: any) => row.restaurant_id);
      return { success: true, data: favIds };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err?.message || 'استثناء أثناء قراءة مفضلة المطاعم.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 8. Helper to resolve user's authoritative Household ID
  // Rule 3: Do NOT query profiles.household_id as it does not exist in the database.
  // Extract household strictly from household_members, falling back to households.admin_id.
  // --------------------------------------------------------------------------
  async getUserHouseholdId(userId: string): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase || !userId) return null;

    try {
      // 1. Primary: Check authoritative household_members table
      const { data: member, error: memErr } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memErr) {
        console.warn('[biteAndBaitService] household_members query error:', memErr);
      }

      if (member?.household_id) {
        return member.household_id;
      }

      // 2. Secondary fallback: Check households where the user is admin_id
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .select('id')
        .eq('admin_id', userId)
        .limit(1)
        .maybeSingle();

      if (hhErr) {
        console.warn('[biteAndBaitService] households admin query error:', hhErr);
      }

      if (hh?.id) {
        return hh.id;
      }

      return null;
    } catch (err) {
      console.warn('[biteAndBaitService] Exception resolving household ID:', err);
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // 9. Read Customer Addresses (household_addresses)
  // Preserves genuine coordinates and does NOT invent 0,0 locations
  // --------------------------------------------------------------------------
  async getHouseholdAddresses(
    providedHouseholdId?: string,
    providedUserId?: string
  ): Promise<ServiceResult<FoodCustomerAddress[]>> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        data: [],
        error: 'قاعدة بيانات Supabase غير متصلة.',
        isConfigError: true,
      };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = providedUserId || session?.user?.id;
      const householdId = providedHouseholdId || (userId ? await this.getUserHouseholdId(userId) : null);

      if (!householdId) {
        return {
          success: true,
          data: [], // No household associated with visitor
        };
      }

      const { data, error } = await supabase
        .from('household_addresses')
        .select('*')
        .eq('household_id', householdId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة عناوين المنزل (household_addresses): ${error.message}`,
          errorCode: error.code,
        };
      }

      const addresses: FoodCustomerAddress[] = (data || []).map((row: any) => {
        const gps = validateGpsCoordinates(row.latitude, row.longitude);

        return {
          id: row.id,
          label: row.address_label || 'عنوان التوصيل',
          recipientName: row.full_name || '',
          phone: row.phone || '',
          governorate: row.governorate_name || '',
          governorateId: row.governorate_id || undefined,
          markaz: row.markaz_name || '',
          centerId: row.center_id || undefined,
          area: row.area_name || undefined,
          areaId: row.area_id || undefined,
          detailedAddress: row.detailed_address || '',
          latitude: (gps.valid ? gps.latitude : undefined) as number,
          longitude: (gps.valid ? gps.longitude : undefined) as number,
          gpsAccuracyM: row.gps_accuracy_m ?? null,
          gpsSource: row.gps_source ?? null,
          gpsCapturedAt: row.gps_captured_at ?? null,
          isDefault: Boolean(row.is_default),
        };
      });

      return {
        success: true,
        data: addresses,
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err?.message || 'استثناء أثناء قراءة عناوين المنزل.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 10. Read Customer Orders (restaurant_orders, restaurant_order_items, restaurant_order_item_options, restaurant_order_status_history)
  // Strictly attaches statusHistory to orders and does not invent delivery times or GPS
  // --------------------------------------------------------------------------
  async getCustomerOrders(providedUserId?: string): Promise<ServiceResult<BiteBaitFoodOrder[]>> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        data: [],
        error: 'قاعدة بيانات Supabase غير متصلة.',
        isConfigError: true,
      };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = providedUserId || session?.user?.id;

      if (!userId) {
        return {
          success: true,
          data: [], // Guest has no stored orders
        };
      }

      const { data: dbOrders, error: ordersErr } = await supabase
        .from('restaurant_orders')
        .select(`
          *,
          restaurants (
            id,
            name,
            phone,
            address,
            image_url
          ),
          restaurant_order_items (
            id,
            order_id,
            menu_item_id,
            item_name_snapshot,
            unit_price_snapshot,
            quantity,
            discount_amount,
            line_total,
            customer_approved_price_change,
            restaurant_order_item_options (
              id,
              option_name_snapshot,
              value_name_snapshot,
              extra_price_snapshot
            )
          )
        `)
        .eq('customer_user_id', userId)
        .order('created_at', { ascending: false });

      if (ordersErr) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة طلبات المطاعم (restaurant_orders): ${ordersErr.message}`,
          errorCode: ordersErr.code,
        };
      }

      if (!dbOrders || dbOrders.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Fetch status history for all customer orders and strictly verify error
      const orderIds = dbOrders.map((o: any) => o.id);
      let historyMap = new Map<string, RawDbOrderStatusHistory[]>();

      if (orderIds.length > 0) {
        const { data: histData, error: histErr } = await supabase
          .from('restaurant_order_status_history')
          .select('id, order_id, old_status, new_status, changed_by, note, created_at')
          .in('order_id', orderIds)
          .order('created_at', { ascending: true });

        if (histErr) {
          return {
            success: false,
            data: [],
            error: `خطأ في قراءة سجل حالات الطلبات (restaurant_order_status_history): ${histErr.message}`,
            errorCode: histErr.code,
          };
        }

        if (histData) {
          histData.forEach((h: RawDbOrderStatusHistory) => {
            const list = historyMap.get(h.order_id) || [];
            list.push(h);
            historyMap.set(h.order_id, list);
          });
        }
      }

      const orders: BiteBaitFoodOrder[] = dbOrders.map((o: any) => {
        const rest = o.restaurants;
        const items = (o.restaurant_order_items || []).map((it: any) => {
          const optionsDesc = (it.restaurant_order_item_options || [])
            .map((opt: any) => `${opt.value_name_snapshot} (+${opt.extra_price_snapshot} ج.م)`)
            .join('، ');

          return {
            menuItemId: it.menu_item_id || it.id,
            name: it.item_name_snapshot || 'صنف',
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unit_price_snapshot) || 0,
            totalPrice: Number(it.line_total) || 0,
            selectedOptionsDescription: optionsDesc || undefined,
          };
        });

        // Determine cancellation status based on cancellation_reason or order status
        let cancellationStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none';
        if (o.status === 'cancelled') {
          cancellationStatus = 'approved';
        }

        // Do NOT convert missing GPS coordinates to 0,0
        const lat =
          o.delivery_latitude !== null &&
          o.delivery_latitude !== undefined &&
          !isNaN(Number(o.delivery_latitude)) &&
          Number(o.delivery_latitude) !== 0
            ? Number(o.delivery_latitude)
            : undefined;
        const lng =
          o.delivery_longitude !== null &&
          o.delivery_longitude !== undefined &&
          !isNaN(Number(o.delivery_longitude)) &&
          Number(o.delivery_longitude) !== 0
            ? Number(o.delivery_longitude)
            : undefined;

        // Map status history from restaurant_order_status_history
        const rawHistory = historyMap.get(o.id) || [];
        const statusHistory: BiteBaitOrderStatusHistoryItem[] = rawHistory.map((h) => ({
          id: h.id,
          orderId: h.order_id,
          oldStatus: h.old_status,
          newStatus: h.new_status,
          changedBy: h.changed_by,
          note: h.note,
          createdAt: h.created_at,
        }));

        return {
          id: o.id,
          restaurantId: o.restaurant_id,
          restaurantName: rest?.name || o.restaurant_name_snapshot || 'مطعم',
          restaurantPhone: rest?.phone || o.restaurant_phone_snapshot || '',
          restaurantAddress: rest?.address || '',
          customerName: o.customer_name || 'العميل',
          customerPhone: o.customer_phone || '',
          address: {
            id: o.delivery_area_id || 'addr-default',
            label: 'عنوان التوصيل',
            recipientName: o.customer_name || '',
            phone: o.customer_phone || '',
            governorate: o.delivery_governorate_name_snapshot || '',
            markaz: o.delivery_center_name_snapshot || '',
            area: o.delivery_area_name || undefined,
            detailedAddress: o.delivery_address || '',
            latitude: lat as number,
            longitude: lng as number,
            isDefault: false,
          },
          items,
          subtotal: Number(o.food_subtotal) || 0,
          discount: Number(o.discount_amount) || 0,
          deliveryFee: Number(o.customer_delivery_fee ?? o.delivery_fee) || 0,
          totalAmount: Number(o.customer_total) || 0,
          notes: o.cancellation_reason ? `سبب الإلغاء: ${o.cancellation_reason}` : undefined,
          paymentMethod: 'cash_on_delivery',
          deliveryChannel: 'direct_system',
          orderStatus: mapOrderStatus(o.status),
          deliveryStatus: mapDeliveryStatus(o.status),
          invoiceIssued: false,
          invoiceNumber: o.order_number ? `ORD-${o.order_number}` : undefined,
          createdAt: o.created_at,
          updatedAt: o.updated_at || o.created_at,
          estimatedDeliveryTime: '', // Zero invented delivery time
          rawStatus: o.status || '',
          cancellationStatus,
          cancellationReason: o.cancellation_reason || undefined,
          statusHistory,
        };
      });

      return {
        success: true,
        data: orders,
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err?.message || 'استثناء أثناء قراءة سجل الطلبات.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 11. Read Order Status History for a Single Order
  // --------------------------------------------------------------------------
  async getOrderStatusHistory(orderId: string): Promise<ServiceResult<RawDbOrderStatusHistory[]>> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        data: [],
        error: 'قاعدة بيانات Supabase غير متصلة.',
        isConfigError: true,
      };
    }

    try {
      const { data, error } = await supabase
        .from('restaurant_order_status_history')
        .select('id, order_id, old_status, new_status, changed_by, note, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) {
        return {
          success: false,
          data: [],
          error: `خطأ في قراءة سجل حالات الطلب (restaurant_order_status_history): ${error.message}`,
          errorCode: error.code,
        };
      }

      return {
        success: true,
        data: data || [],
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err?.message || 'استثناء أثناء قراءة سجل الحالات.',
      };
    }
  },

  // --------------------------------------------------------------------------
  // 12. Create Ready-Made Food Order via RPC: public.create_bite_bait_order
  // Real DB execution connecting checkout to backend V2 trigger & pricing logic.
  // --------------------------------------------------------------------------
  async createBiteBaitOrder(
    params: CreateBiteBaitOrderParams
  ): Promise<ServiceResult<CreateBiteBaitOrderResult>> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        data: { orderId: '', orderNumber: '' },
        error: 'قاعدة بيانات Supabase غير متصلة. يرجى التحقق من اتصال الإنترنت.',
        errorCode: 'rpc_error',
        isConfigError: true,
      };
    }

    const idemKey = String(params.idempotencyKey || '').trim();
    if (!idemKey) {
      return {
        success: false,
        data: { orderId: '', orderNumber: '' },
        error: 'مفتاح منع التكرار (idempotency key) مفقود.',
        errorCode: 'MISSING_IDEMPOTENCY_KEY',
      };
    }

    if (inFlightBiteBaitOrderKeys.has(idemKey)) {
      return {
        success: false,
        data: { orderId: '', orderNumber: '' },
        error: 'يوجد طلب قيد التنفيذ بالفعل بنفس المفتاح، يرجى الانتظار لحين اكتماله.',
        errorCode: 'DUPLICATE_IN_FLIGHT',
      };
    }

    inFlightBiteBaitOrderKeys.add(idemKey);

    try {
      // 0. Fresh DB verification against `public.app_section_settings` (`ready_food`) before creating order
      const sectionGuard = await sectionSettingsService.verifyOrderAllowed('ready_food');
      if (!sectionGuard.allowed) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: sectionGuard.reason,
          errorCode: 'SECTION_OR_DELIVERY_DISABLED',
        };
      }

      // 1. Mandatory Parameters & UUID Validation
      if (!params.householdId || !isValidUuid(params.householdId)) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: 'تعذر تحديد معرف الأسرة للطلب. يلزم أن يكون المستخدم عضواً في أسرة مسجلة.',
          errorCode: 'INVALID_HOUSEHOLD',
        };
      }
      if (!params.restaurantId || !isValidUuid(params.restaurantId)) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: 'معرف المطعم غير محدد أو غير صالح.',
          errorCode: 'invalid_restaurant',
        };
      }
      if (params.addressId && !isValidUuid(params.addressId)) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: 'معرف عنوان التوصيل غير صالح.',
          errorCode: 'invalid_geo_id',
        };
      }

      const hasMissingGps =
        params.deliveryLatitude === undefined ||
        params.deliveryLatitude === null ||
        params.deliveryLongitude === undefined ||
        params.deliveryLongitude === null;
      const gpsCheck = validateGpsCoordinates(params.deliveryLatitude, params.deliveryLongitude);
      if (!gpsCheck.valid || gpsCheck.latitude === null || gpsCheck.longitude === null) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error:
            gpsCheck.reason ||
            'إحداثيات الموقع الجغرافي (GPS) غير صالحة أو مفقودة. يلزم توفير إحداثيات موقع حقيقية لإرسال الطلب.',
          errorCode: hasMissingGps ? 'missing_gps' : 'invalid_gps',
        };
      }
      if (!params.items || params.items.length === 0) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: 'سلة الطلب فارغة، لا يمكن إرسال طلب بدون أصناف.',
          errorCode: 'EMPTY_CART',
        };
      }

      // 2. Verify Restaurant is Active & Open before computing quote or submitting RPC
      const { data: restaurantStatusRow, error: restaurantStatusErr } = await supabase
        .from('restaurants')
        .select('id, is_active, is_open')
        .eq('id', params.restaurantId)
        .maybeSingle();

      if (restaurantStatusErr) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: `تعذر التحقق من حالة المطعم: ${restaurantStatusErr.message}`,
          errorCode: 'rpc_error',
        };
      }

      if (!restaurantStatusRow || restaurantStatusRow.is_active === false) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: 'المطعم غير موجود أو غير متاح حالياً.',
          errorCode: 'invalid_restaurant',
        };
      }

      if (restaurantStatusRow.is_open === false) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: 'المطعم مغلق حالياً ولا يستقبل طلبات جديدة.',
          errorCode: 'restaurant_closed',
        };
      }

      // 3. Enforce central `ready_food` geo IDs, coverage & GPS boundary unconditionally via V2 get_delivery_quote
      let geoGovId = params.governorateId ? String(params.governorateId).trim() : null;
      let geoCenterId = params.centerId ? String(params.centerId).trim() : null;
      let geoAreaId = params.areaId ? String(params.areaId).trim() : null;

      if (params.addressId) {
        const { data: addrRow, error: addrErr } = await supabase
          .from('household_addresses')
          .select('id, household_id, governorate_id, center_id, area_id')
          .eq('id', params.addressId)
          .eq('household_id', params.householdId)
          .maybeSingle();

        if (addrErr) {
          return {
            success: false,
            data: { orderId: '', orderNumber: '' },
            error: `تعذر التحقق من بيانات عنوان التوصيل: ${addrErr.message}`,
            errorCode: 'rpc_error',
          };
        }

        if (!addrRow) {
          return {
            success: false,
            data: { orderId: '', orderNumber: '' },
            error: 'العنوان المحدد غير موجود أو لا ينتمي للأسرة الحالية.',
            errorCode: 'missing_geo_data',
          };
        }

        geoGovId = addrRow.governorate_id ? String(addrRow.governorate_id).trim() : null;
        geoCenterId = addrRow.center_id ? String(addrRow.center_id).trim() : null;
        geoAreaId = addrRow.area_id ? String(addrRow.area_id).trim() : null;
      }

      if (!geoGovId || !geoCenterId || !geoAreaId) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error:
            'هذا العنوان غير مكتمل في النظام الجغرافي المركزي (يجب تحديد المحافظة والمركز والمنطقة قبل إرسال الطلب).',
          errorCode: 'missing_geo_data',
        };
      }

      if (!isValidUuid(geoGovId) || !isValidUuid(geoCenterId) || !isValidUuid(geoAreaId)) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: 'معرّفات المحافظة أو المركز أو المنطقة غير صالحة (UUID غير صحيح).',
          errorCode: 'invalid_geo_id',
        };
      }

      const feeCheck = await this.resolveDeliveryFee(params.restaurantId, {
        id: params.addressId || 'checkout-address',
        label: 'عنوان التوصيل',
        recipientName: params.customerName,
        phone: params.customerPhone,
        governorate: '',
        governorateId: geoGovId,
        markaz: '',
        centerId: geoCenterId,
        areaId: geoAreaId,
        detailedAddress: params.deliveryAddress,
        latitude: gpsCheck.latitude,
        longitude: gpsCheck.longitude,
      });

      if (!feeCheck.isCovered || feeCheck.fee === null) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: feeCheck.reason || 'تعذر التحقق من تغطية التوصيل لهذا العنوان.',
          errorCode: feeCheck.errorCategory || 'outside_coverage',
        };
      }

      // 4. Prepare payload with EXACT parameter names as defined in public.create_bite_bait_order.
      // DB trigger `private.prepare_restaurant_order_v2` computes final fulfillment_route (restaurant_delivery vs driver_delivery),
      // delivery fee, admin/restaurant/driver shares, and totals authoritatively.
      const rpcPayload = {
        p_household_id: params.householdId,
        p_restaurant_id: params.restaurantId,
        p_address_id: params.addressId || null,
        p_customer_name: params.customerName.trim(),
        p_customer_phone: params.customerPhone.trim(),
        p_delivery_address: params.deliveryAddress.trim(),
        p_delivery_latitude: gpsCheck.latitude,
        p_delivery_longitude: gpsCheck.longitude,
        p_items: params.items,
        p_idempotency_key: idemKey,
      };

      const { data, error } = await supabase.rpc('create_bite_bait_order', rpcPayload);

      if (error) {
        const isDuplicateErr =
          error.code === '23505' ||
          error.message?.toLowerCase().includes('duplicate') ||
          error.message?.toLowerCase().includes('idempotency');

        return {
          success: false,
          data: { orderId: '', orderNumber: '' },
          error: isDuplicateErr
            ? 'تم إرسال هذا الطلب بالفعل مسبقاً بنفس المفتاح. يمكنك مراجعة تفاصيله في سجل طلباتك.'
            : (error.message || 'حدث خطأ أثناء تسجيل الطلب في قاعدة البيانات'),
          errorCode: error.code || 'order_creation_failed',
        };
      }

      // 5. Parse RPC response safely
      let parsed: any = data;
      if (typeof data === 'string') {
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed = parsed[0];
      }

      const isDuplicate = Boolean(
        parsed?.status === 'duplicate' ||
        parsed?.is_duplicate === true ||
        parsed?.duplicate === true
      );

      const orderId = parsed?.order_id || parsed?.id || parsed?.orderId || '';
      const orderNumber = parsed?.order_number ?? parsed?.orderNumber ?? parsed?.invoice_number ?? '';
      const totalAmount =
        Number(parsed?.total_amount ?? parsed?.customer_total ?? parsed?.total) || undefined;

      if (!orderId && !orderNumber) {
        return {
          success: false,
          data: { orderId: '', orderNumber: '', rawResponse: parsed },
          error:
            parsed?.message ||
            parsed?.error ||
            'تعذر استخراج رقم الطلب من استجابة قاعدة البيانات.',
          errorCode: 'order_creation_failed',
        };
      }

      return {
        success: true,
        data: {
          orderId: String(orderId),
          orderNumber: String(orderNumber),
          totalAmount,
          isDuplicate,
          rawResponse: parsed,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        data: { orderId: '', orderNumber: '' },
        error: err?.message || 'استثناء غير متوقع أثناء استدعاء create_bite_bait_order.',
        errorCode: 'order_creation_failed',
      };
    } finally {
      inFlightBiteBaitOrderKeys.delete(idemKey);
    }
  },
};

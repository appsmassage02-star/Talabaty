import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Restaurant,
  MenuItem,
  MenuOptionGroup,
  MenuOptionItem,
  FoodOffer,
  FoodCustomerAddress,
  FoodOrder,
  FoodOrderItem,
  FoodCartItem,
  FoodOrderStatus,
  FoodDeliveryStatus,
  RestaurantSectionSettings,
  RestaurantCategory,
  RawDbRestaurant,
  RawDbMenuItem,
  RawDbItemOption,
  RawDbItemOptionValue,
  RawDbOffer,
} from '../types/foodTypes';

export interface RestaurantFilterParams {
  searchQuery?: string;
  cuisine?: string;
  onlyOpen?: boolean;
  maxDeliveryTime?: number;
  hasDiscount?: boolean;
  minRating?: number;
  sortBy?: 'recommended' | 'rating' | 'prepTime' | 'deliveryFee';
}

export function mapDeliveryStatusToFoodStatus(status?: string): FoodOrderStatus {
  switch (status) {
    case 'pending_review':
    case 'pending':
      return 'pending_restaurant_confirmation';
    case 'accepted':
      return 'restaurant_accepted';
    case 'preparing':
      return 'preparing';
    case 'ready_for_pickup':
      return 'ready_for_pickup';
    case 'in_transit':
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'delivered':
    case 'completed':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    case 'rejected':
      return 'rejected_by_restaurant';
    default:
      return 'pending_restaurant_confirmation';
  }
}

export function mapDeliveryOrderStatus(status?: string): FoodDeliveryStatus {
  switch (status) {
    case 'accepted':
    case 'assigned':
      return 'driver_assigned';
    case 'at_restaurant':
    case 'picked_up':
      return 'driver_at_restaurant';
    case 'in_transit':
    case 'out_for_delivery':
      return 'on_the_way';
    case 'arrived':
      return 'arrived_customer';
    case 'completed':
    case 'delivered':
      return 'completed';
    default:
      return 'waiting_dispatch';
  }
}

const FALLBACK_RESTAURANT_IMG =
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80';
const FALLBACK_MENU_IMG =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

export const foodService = {
  // 1. Read Restaurant Section Settings (restaurant_section_settings)
  async getSectionSettings(): Promise<RestaurantSectionSettings | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        id: 'unconfigured',
        section_enabled: false,
        global_max_delivery_radius_km: 15,
        no_driver_timeout_minutes: 10,
        status_message: 'قاعدة بيانات Supabase غير مهيأة.',
      };
    }

    try {
      const { data, error } = await supabase
        .from('restaurant_section_settings')
        .select('id, section_enabled, global_max_delivery_radius_km, no_driver_timeout_minutes, created_at, updated_at');

      if (error) {
        console.warn('[foodService] Error reading restaurant_section_settings:', error.message);
        return {
          id: 'error',
          section_enabled: false,
          global_max_delivery_radius_km: 15,
          no_driver_timeout_minutes: 10,
          status_message: `تعذر قراءة إعدادات قسم المطاعم من قاعدة البيانات: ${error.message}`,
        };
      }

      if (!data || data.length === 0) {
        return {
          id: 'empty',
          section_enabled: false,
          global_max_delivery_radius_km: 15,
          no_driver_timeout_minutes: 10,
          status_message:
            'قسم المطاعم غير متاح حالياً: جدول إعدادات القسم (restaurant_section_settings) فارغ ولا يحتوي على سجل تهيئة.',
        };
      }

      if (data.length > 1) {
        return {
          id: 'ambiguous',
          section_enabled: false,
          global_max_delivery_radius_km: 15,
          no_driver_timeout_minutes: 10,
          status_message:
            'تعذر تفعيل قسم المطاعم لوجود أكثر من سجل في جدول إعدادات القسم دون تحديد السجل النشط.',
        };
      }

      const row = data[0];
      const isEnabled = Boolean(row.section_enabled);

      return {
        id: row.id,
        section_enabled: isEnabled,
        global_max_delivery_radius_km: Number(row.global_max_delivery_radius_km) || 15,
        no_driver_timeout_minutes: Number(row.no_driver_timeout_minutes) || 10,
        created_at: row.created_at,
        updated_at: row.updated_at,
        status_message: isEnabled
          ? undefined
          : 'قسم المطاعم متوقف حالياً من قِبل إدارة التطبيق (section_enabled = false).',
      };
    } catch (err: any) {
      console.warn('[foodService] Exception fetching restaurant_section_settings:', err);
      return {
        id: 'exception',
        section_enabled: false,
        global_max_delivery_radius_km: 15,
        no_driver_timeout_minutes: 10,
        status_message: 'حدث استثناء غير متوقع أثناء فحص إعدادات قسم المطاعم.',
      };
    }
  },

  // 2. Read Categories (restaurant_categories)
  async listCategories(): Promise<RestaurantCategory[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('restaurant_categories')
        .select('id, name, image_url, sort_order, is_active, created_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('[foodService] Error reading restaurant_categories:', error.message);
        return [];
      }

      return (data || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name || '',
        image_url: cat.image_url,
        sort_order: Number(cat.sort_order) || 0,
        is_active: Boolean(cat.is_active),
        created_at: cat.created_at,
      }));
    } catch (err) {
      console.warn('[foodService] Exception fetching restaurant_categories:', err);
      return [];
    }
  },

  // 3. Read Restaurants (restaurants, restaurant_categories, restaurant_category_links, restaurant_menu_categories)
  async listRestaurants(filters: RestaurantFilterParams = {}): Promise<Restaurant[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      // 3.1 Fetch active restaurants
      const { data: rawRestaurants, error: restError } = await supabase
        .from('restaurants')
        .select(`
          id,
          owner_user_id,
          name,
          description,
          phone,
          address,
          latitude,
          longitude,
          image_url,
          is_active,
          is_open,
          max_delivery_radius_km,
          commission_percent,
          delivery_fee,
          food_money_settlement_mode,
          created_at,
          updated_at
        `)
        .eq('is_active', true);

      if (restError) {
        console.warn('[foodService] Error reading restaurants:', restError.message);
        return [];
      }

      if (!rawRestaurants || rawRestaurants.length === 0) {
        return [];
      }

      // 3.2 Fetch category links and categories in parallel
      const [linksRes, categoriesRes, menuCatsRes] = await Promise.all([
        supabase
          .from('restaurant_category_links')
          .select('restaurant_id, category_id'),
        supabase
          .from('restaurant_categories')
          .select('id, name, is_active')
          .eq('is_active', true),
        supabase
          .from('restaurant_menu_categories')
          .select('id, restaurant_id, name, sort_order, is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

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

      // 3.3 Map DB rows to application Restaurant domain model
      let mapped: Restaurant[] = rawRestaurants.map((r: RawDbRestaurant) => {
        const cuisineTypes = restCategoriesMap.get(r.id) || ['مأكولات متنوعة'];
        const menuCategories = restMenuCatsMap.get(r.id) || ['قائمة الطعام'];
        const deliveryFee = Number(r.delivery_fee) || 15;
        const isOpen = Boolean(r.is_open);
        const img = r.image_url || FALLBACK_RESTAURANT_IMG;

        return {
          id: r.id,
          name: r.name || 'مطعم',
          description: r.description || '',
          logoUrl: img,
          bannerUrl: img,
          cuisineTypes,
          rating: 4.8,
          reviewsCount: 0,
          estimatedPrepTimeMinutes: 30,
          deliveryFee,
          minOrderAmount: 0,
          isOpen,
          openingHours: isOpen ? 'مفتوح للطلب' : 'مغلق حالياً',
          address: r.address || '',
          governorate: 'المحافظة',
          phone: r.phone || '',
          deliveryChannel: 'direct_system',
          distanceKm: 1.5,
          menuCategories,
        };
      });

      // 3.4 Apply Search & Filters
      if (filters.searchQuery?.trim()) {
        const q = filters.searchQuery.trim().toLowerCase();
        mapped = mapped.filter((r) => {
          const matchesName = r.name.toLowerCase().includes(q);
          const matchesCuisine = r.cuisineTypes.some((c) => c.toLowerCase().includes(q));
          const matchesDesc = r.description.toLowerCase().includes(q);
          return matchesName || matchesCuisine || matchesDesc;
        });
      }

      if (filters.cuisine && filters.cuisine !== 'الكل') {
        mapped = mapped.filter((r) => r.cuisineTypes.includes(filters.cuisine!));
      }

      if (filters.onlyOpen) {
        mapped = mapped.filter((r) => r.isOpen);
      }

      if (filters.maxDeliveryTime) {
        mapped = mapped.filter((r) => r.estimatedPrepTimeMinutes <= filters.maxDeliveryTime!);
      }

      if (filters.sortBy === 'rating') {
        mapped.sort((a, b) => b.rating - a.rating);
      } else if (filters.sortBy === 'deliveryFee') {
        mapped.sort((a, b) => a.deliveryFee - b.deliveryFee);
      } else {
        // Default sort: open restaurants first, then by name
        mapped.sort((a, b) => {
          if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
          return a.name.localeCompare(b.name, 'ar');
        });
      }

      return mapped;
    } catch (err) {
      console.warn('[foodService] Exception listing restaurants:', err);
      return [];
    }
  },

  // 4. Read Restaurant Details
  async getRestaurantDetails(restaurantId: string): Promise<Restaurant | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    try {
      const { data: r, error } = await supabase
        .from('restaurants')
        .select(`
          id,
          owner_user_id,
          name,
          description,
          phone,
          address,
          latitude,
          longitude,
          image_url,
          is_active,
          is_open,
          max_delivery_radius_km,
          commission_percent,
          delivery_fee,
          food_money_settlement_mode,
          created_at,
          updated_at
        `)
        .eq('id', restaurantId)
        .maybeSingle();

      if (error || !r) {
        return null;
      }

      // Fetch linked categories and menu categories
      const [linksRes, categoriesRes, menuCatsRes] = await Promise.all([
        supabase
          .from('restaurant_category_links')
          .select('category_id')
          .eq('restaurant_id', restaurantId),
        supabase
          .from('restaurant_categories')
          .select('id, name')
          .eq('is_active', true),
        supabase
          .from('restaurant_menu_categories')
          .select('name')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      const catMap = new Map<string, string>();
      (categoriesRes.data || []).forEach((c: any) => catMap.set(c.id, c.name));

      const cuisineTypes = (linksRes.data || [])
        .map((l: any) => catMap.get(l.category_id))
        .filter(Boolean) as string[];

      const menuCategories = (menuCatsRes.data || []).map((m: any) => m.name);

      const deliveryFee = Number(r.delivery_fee) || 15;
      const isOpen = Boolean(r.is_open);
      const img = r.image_url || FALLBACK_RESTAURANT_IMG;

      return {
        id: r.id,
        name: r.name || 'مطعم',
        description: r.description || '',
        logoUrl: img,
        bannerUrl: img,
        cuisineTypes: cuisineTypes.length > 0 ? cuisineTypes : ['مأكولات متنوعة'],
        rating: 4.8,
        reviewsCount: 0,
        estimatedPrepTimeMinutes: 30,
        deliveryFee,
        minOrderAmount: 0,
        isOpen,
        openingHours: isOpen ? 'مفتوح للطلب' : 'مغلق حالياً',
        address: r.address || '',
        governorate: 'المحافظة',
        phone: r.phone || '',
        deliveryChannel: 'direct_system',
        distanceKm: 1.5,
        menuCategories: menuCategories.length > 0 ? menuCategories : ['قائمة الطعام'],
      };
    } catch (err) {
      console.warn('[foodService] Exception fetching restaurant details:', err);
      return null;
    }
  },

  // 5. Read Restaurant Menu (restaurant_menu_categories, restaurant_menu_items, restaurant_item_options, restaurant_item_option_values)
  async getRestaurantMenu(restaurantId: string): Promise<MenuItem[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      // 5.1 Fetch menu categories
      const { data: menuCats } = await supabase
        .from('restaurant_menu_categories')
        .select('id, name, sort_order, is_active')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const menuCatMap = new Map<string, string>();
      (menuCats || []).forEach((c: any) => menuCatMap.set(c.id, c.name));

      // 5.2 Fetch menu items
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

      if (itemsError || !rawItems || rawItems.length === 0) {
        return [];
      }

      // 5.3 Fetch item options and values
      const itemIds = rawItems.map((i: any) => i.id);

      const { data: optionsData } = await supabase
        .from('restaurant_item_options')
        .select('id, restaurant_id, menu_item_id, name, required, min_select, max_select, sort_order')
        .eq('restaurant_id', restaurantId)
        .in('menu_item_id', itemIds)
        .order('sort_order', { ascending: true });

      const optionIds = (optionsData || []).map((o: any) => o.id);

      let optionValuesData: any[] = [];
      if (optionIds.length > 0) {
        const { data: vals } = await supabase
          .from('restaurant_item_option_values')
          .select('id, option_id, name, extra_price, is_available, sort_order')
          .in('option_id', optionIds)
          .eq('is_available', true)
          .order('sort_order', { ascending: true });

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

      // 5.5 Build option groups by menu_item_id
      const optionGroupsByItemId = new Map<string, MenuOptionGroup[]>();
      (optionsData || []).forEach((opt) => {
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

      // 5.6 Map to MenuItem objects
      return rawItems.map((item: RawDbMenuItem) => {
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
          preparationTimeMinutes: 20,
        };
      });
    } catch (err) {
      console.warn('[foodService] Exception reading restaurant menu:', err);
      return [];
    }
  },

  // 6. Read Offers (restaurant_offers)
  async getRestaurantOffers(restaurantId?: string): Promise<FoodOffer[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
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
      if (error || !rawOffers || rawOffers.length === 0) {
        return [];
      }

      const now = new Date().getTime();

      // Filter active validity window
      const validOffers = rawOffers.filter((o: RawDbOffer) => {
        if (!o.is_active) return false;
        if (o.starts_at && new Date(o.starts_at).getTime() > now) return false;
        if (o.ends_at && new Date(o.ends_at).getTime() < now) return false;
        return true;
      });

      if (validOffers.length === 0) return [];

      // Fetch restaurant names for display
      const restIds = Array.from(new Set(validOffers.map((o) => o.restaurant_id)));
      const { data: restList } = await supabase
        .from('restaurants')
        .select('id, name, image_url')
        .in('id', restIds);

      const restNameMap = new Map<string, { name: string; img: string }>();
      (restList || []).forEach((r: any) => {
        restNameMap.set(r.id, { name: r.name, img: r.image_url || FALLBACK_RESTAURANT_IMG });
      });

      return validOffers.map((o: RawDbOffer) => {
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
    } catch (err) {
      console.warn('[foodService] Exception fetching restaurant offers:', err);
      return [];
    }
  },

  // 7. Read Customer Favorites (restaurant_favorites)
  async listCustomerFavorites(): Promise<string[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return [];

      const { data, error } = await supabase
        .from('restaurant_favorites')
        .select('restaurant_id')
        .eq('customer_user_id', userId);

      if (error) {
        console.warn('[foodService] Error reading restaurant_favorites:', error.message);
        return [];
      }

      return (data || []).map((row: any) => row.restaurant_id);
    } catch (err) {
      console.warn('[foodService] Exception reading restaurant_favorites:', err);
      return [];
    }
  },

  // 8. Helper to resolve user's authoritative household ID
  async getUserHouseholdId(userId: string): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase || !userId) return null;

    try {
      // 8.1 Check profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.household_id) return profile.household_id;

      // 8.2 Check household_members table
      const { data: member } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (member?.household_id) return member.household_id;

      // 8.3 Check households where user is admin
      const { data: hh } = await supabase
        .from('households')
        .select('id')
        .eq('admin_id', userId)
        .limit(1)
        .maybeSingle();

      if (hh?.id) return hh.id;

      return null;
    } catch (err) {
      console.warn('[foodService] Error resolving household ID:', err);
      return null;
    }
  },

  // 9. Read Customer Addresses from public.household_addresses
  async listCustomerAddresses(
    providedHouseholdId?: string,
    providedUserId?: string
  ): Promise<FoodCustomerAddress[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = providedUserId || session?.user?.id;
      if (!userId) return [];

      const householdId = providedHouseholdId || (await this.getUserHouseholdId(userId));
      if (!householdId) return [];

      const { data, error } = await supabase
        .from('household_addresses')
        .select('*')
        .eq('household_id', householdId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.warn('[foodService] Error reading household_addresses:', error?.message);
        return [];
      }

      return data.map((row: any) => ({
        id: row.id,
        label: row.address_label || 'عنوان التوصيل',
        recipientName: row.full_name || '',
        phone: row.phone || '',
        governorate: row.governorate_name || '',
        markaz: row.markaz_name || '',
        detailedAddress: row.detailed_address || '',
        latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : 0,
        longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : 0,
        isDefault: Boolean(row.is_default),
      }));
    } catch (err) {
      console.warn('[foodService] Exception reading household_addresses:', err);
      return [];
    }
  },

  // 10. Add Customer Address to public.household_addresses
  async addCustomerAddress(
    address: Omit<FoodCustomerAddress, 'id'>,
    providedHouseholdId?: string,
    providedUserId?: string
  ): Promise<FoodCustomerAddress> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('قاعدة بيانات Supabase غير مهيأة');
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = providedUserId || session?.user?.id;
    const householdId = providedHouseholdId || (userId ? await this.getUserHouseholdId(userId) : null);

    if (!householdId) {
      throw new Error('تعذر حفظ العنوان: يجب تسجيل الدخول والارتباط بمنزل مسجل أولاً.');
    }

    if (address.isDefault) {
      try {
        await supabase
          .from('household_addresses')
          .update({ is_default: false })
          .eq('household_id', householdId);
      } catch (e) {
        console.warn('Could not reset other default addresses', e);
      }
    }

    const payload: any = {
      household_id: householdId,
      address_label: address.label?.trim() || 'عنوان المنزل',
      full_name: address.recipientName?.trim() || 'المستلم',
      phone: address.phone?.trim() || '',
      country: 'مصر',
      governorate_name: address.governorate?.trim() || 'القاهرة',
      markaz_name: address.markaz?.trim() || '',
      detailed_address: address.detailedAddress?.trim() || '',
      latitude: address.latitude ? Number(Number(address.latitude).toFixed(7)) : null,
      longitude: address.longitude ? Number(Number(address.longitude).toFixed(7)) : null,
      is_default: Boolean(address.isDefault),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('household_addresses')
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`فشل حفظ العنوان في قاعدة البيانات: ${error?.message || 'خطأ غير معروف'}`);
    }

    return {
      id: data.id,
      label: data.address_label || 'عنوان المنزل',
      recipientName: data.full_name || '',
      phone: data.phone || '',
      governorate: data.governorate_name || '',
      markaz: data.markaz_name || '',
      detailedAddress: data.detailed_address || '',
      latitude: Number(data.latitude) || 0,
      longitude: Number(data.longitude) || 0,
      isDefault: Boolean(data.is_default),
    };
  },

  // Resolve Restaurant Delivery Fee with Area Priority
  async resolveDeliveryFee(
    restaurantId: string,
    address?: FoodCustomerAddress,
    defaultRestaurantFee: number = 15
  ): Promise<number> {
    if (!isSupabaseConfigured() || !supabase) return defaultRestaurantFee;
    try {
      const { data: areaFees, error: areaErr } = await supabase
        .from('restaurant_area_delivery_fees')
        .select('id, restaurant_id, area_id, delivery_fee, is_active')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true);

      if (areaErr || !areaFees || areaFees.length === 0) {
        return defaultRestaurantFee;
      }

      if (!address) {
        return Number(areaFees[0].delivery_fee) || defaultRestaurantFee;
      }

      const areaIds = areaFees.map((f: any) => f.area_id);
      const { data: areas } = await supabase
        .from('food_areas')
        .select('id, name_ar, name_en')
        .in('id', areaIds);

      if (areas && areas.length > 0) {
        const matched = areas.find((a: any) => {
          const name = a.name_ar || a.name_en;
          if (!name) return false;
          return (
            (address.markaz && (address.markaz.includes(name) || name.includes(address.markaz))) ||
            (address.detailedAddress && address.detailedAddress.includes(name))
          );
        });

        if (matched) {
          const feeRow = areaFees.find((f: any) => f.area_id === matched.id);
          if (feeRow && feeRow.delivery_fee !== null && feeRow.delivery_fee !== undefined) {
            return Number(feeRow.delivery_fee);
          }
        }
      }

      return defaultRestaurantFee;
    } catch (err) {
      console.warn('[foodService] Error resolving delivery fee:', err);
      return defaultRestaurantFee;
    }
  },

  // 11. Authoritative Create Restaurant Order (public.restaurant_orders)
  async createRestaurantOrder(params: {
    restaurant: Restaurant;
    items: FoodCartItem[];
    customerName: string;
    customerPhone: string;
    address: FoodCustomerAddress;
    notes?: string;
    providedHouseholdId?: string;
    providedUserId?: string;
  }): Promise<{ success: boolean; order?: FoodOrder; message?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, message: 'الاتصال بقاعدة بيانات Supabase غير مهيأ.' };
    }

    // Step 0: Check restaurant_section_settings strictly
    const sectionSettings = await this.getSectionSettings();
    if (!sectionSettings || !sectionSettings.section_enabled) {
      return {
        success: false,
        message:
          sectionSettings?.status_message ||
          'قسم المطاعم غير متاح حالياً؛ لم يتم تفعيل إعدادات القسم في قاعدة البيانات (restaurant_section_settings).',
      };
    }

    if (!params.items || params.items.length === 0) {
      return { success: false, message: 'السلة فارغة، يرجى إضافة أصناف إلى الطلب.' };
    }

    if (!params.address?.id || !params.address.detailedAddress?.trim()) {
      return { success: false, message: 'يرجى اختيار أو إضافة عنوان توصيل صالح ومكتمل.' };
    }

    if (!params.customerPhone?.trim()) {
      return { success: false, message: 'يرجى كتابة رقم هاتف العميل للتواصل.' };
    }

    try {
      // 1. Verify User Session
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();
      const userId = params.providedUserId || session?.user?.id;
      if (!userId || sessionErr) {
        return { success: false, message: 'يجب تسجيل الدخول بحساب موثق لإتمام الطلب.' };
      }

      // 2. Resolve Authoritative Household ID
      const householdId = params.providedHouseholdId || (await this.getUserHouseholdId(userId));
      if (!householdId) {
        return {
          success: false,
          message: 'لم يتم العثور على منزل مسجل أو مرتبط بحسابك. يرجى الانضمام لمنزل أو إنشاؤه أولاً من إعدادات التطبيق.',
        };
      }

      // 3. Verify Address belongs to this Household
      const { data: dbAddr, error: addrErr } = await supabase
        .from('household_addresses')
        .select('*')
        .eq('id', params.address.id)
        .eq('household_id', householdId)
        .maybeSingle();

      if (addrErr || !dbAddr) {
        return {
          success: false,
          message: 'عنوان التوصيل المحدد غير مسجل للمنزل الحالي أو غير صالح.',
        };
      }

      // 4. Re-verify Restaurant in DB
      const { data: dbRestaurant, error: restErr } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', params.restaurant.id)
        .maybeSingle();

      if (restErr || !dbRestaurant || !dbRestaurant.is_active) {
        return { success: false, message: 'المطعم غير متاح حالياً أو تم إيقاف نشاطه.' };
      }

      if (!dbRestaurant.is_open) {
        return { success: false, message: 'المطعم مغلق حالياً ولا يستقبل طلبات جديدة.' };
      }

      // 5. Re-verify Menu Items & Option Values in DB
      const menuItemIds = params.items.map((i) => i.menuItemId);
      const { data: dbItems, error: itemsErr } = await supabase
        .from('restaurant_menu_items')
        .select('id, name, price, is_available')
        .eq('restaurant_id', params.restaurant.id)
        .in('id', menuItemIds);

      if (itemsErr || !dbItems || dbItems.length === 0) {
        return { success: false, message: 'تعذر التحقق من قائمة أصناف المطعم في قاعدة البيانات.' };
      }

      const dbItemMap = new Map(dbItems.map((it: any) => [it.id, it]));

      // Verify Option Values if selected
      const allOptionValIds = params.items.flatMap((i) => i.selectedOptions.map((o) => o.optionId));
      const dbOptionValMap = new Map<string, number>();

      if (allOptionValIds.length > 0) {
        const { data: dbOptVals } = await supabase
          .from('restaurant_item_option_values')
          .select('id, extra_price, is_available')
          .in('id', allOptionValIds);

        if (dbOptVals) {
          dbOptVals.forEach((ov: any) => {
            if (ov.is_available) {
              dbOptionValMap.set(ov.id, Number(ov.extra_price) || 0);
            }
          });
        }
      }

      // Calculate Verified Totals
      let verifiedSubtotal = 0;
      const verifiedItemsList: Array<{
        menu_item_id: string;
        item_name_snapshot: string;
        unit_price_snapshot: number;
        quantity: number;
        line_total: number;
        options_snapshot: any[];
        notes?: string;
      }> = [];

      for (const cartItem of params.items) {
        const verifiedDbItem = dbItemMap.get(cartItem.menuItemId);
        if (!verifiedDbItem) {
          return {
            success: false,
            message: `الصنف "${cartItem.name}" لم يعد موجوداً في منيو هذا المطعم.`,
          };
        }
        if (!verifiedDbItem.is_available) {
          return {
            success: false,
            message: `الصنف "${verifiedDbItem.name}" غير متوفر حالياً بالمطعم.`,
          };
        }

        const basePrice = Number(verifiedDbItem.price) || 0;
        let addOnsTotal = 0;
        const verifiedOptions = cartItem.selectedOptions.map((opt) => {
          const verifiedExtra = dbOptionValMap.get(opt.optionId) ?? opt.price;
          addOnsTotal += verifiedExtra;
          return {
            group_id: opt.groupId,
            group_name: opt.groupName,
            option_id: opt.optionId,
            option_name: opt.optionName,
            extra_price: verifiedExtra,
          };
        });

        const verifiedUnitPrice = basePrice + addOnsTotal;
        const qty = Math.max(1, Math.floor(cartItem.quantity));
        const lineTotal = verifiedUnitPrice * qty;
        verifiedSubtotal += lineTotal;

        verifiedItemsList.push({
          menu_item_id: verifiedDbItem.id,
          item_name_snapshot: verifiedDbItem.name,
          unit_price_snapshot: verifiedUnitPrice,
          quantity: qty,
          line_total: lineTotal,
          options_snapshot: verifiedOptions,
          notes: cartItem.notes,
        });
      }

      // 6. Resolve delivery fee using area fees with fallback to restaurant delivery fee
      const verifiedDeliveryFee = await this.resolveDeliveryFee(
        dbRestaurant.id,
        params.address,
        Number(dbRestaurant.delivery_fee) || 15
      );
      const verifiedTotalAmount = verifiedSubtotal + verifiedDeliveryFee;

      // 7. Authoritative Insert into public.restaurant_orders
      // Note: order_number is generated by database identity/default column, DO NOT provide it
      const orderPayload: any = {
        customer_user_id: userId,
        restaurant_id: dbRestaurant.id,
        household_id: householdId,
        delivery_address_id: dbAddr.id,
        customer_name: params.customerName?.trim() || dbAddr.full_name || 'العميل',
        customer_phone: params.customerPhone?.trim() || dbAddr.phone || '',
        status: 'pending',
        fulfillment_route:
          dbRestaurant.delivery_type === 'restaurant_delivery' ? 'restaurant_delivery' : 'driver_delivery',
        payment_method: 'cash',
        food_subtotal: verifiedSubtotal,
        discount_amount: 0,
        delivery_fee: verifiedDeliveryFee,
        customer_total: verifiedTotalAmount,
        restaurant_notes: params.notes?.trim() || null,
        delivery_notes: params.notes?.trim() || null,
        idempotency_key: crypto.randomUUID(),
      };

      const { data: createdOrder, error: orderErr } = await supabase
        .from('restaurant_orders')
        .insert(orderPayload)
        .select()
        .single();

      // RLS and Permission Handling Check (Section 5)
      if (orderErr) {
        console.error('[foodService] Error inserting restaurant_orders:', orderErr);
        if (
          orderErr.code === '42501' ||
          orderErr.message?.includes('violates row-level security policy') ||
          orderErr.message?.includes('permission denied')
        ) {
          return {
            success: false,
            message:
              'تعذر إنشاء طلب المطعم: لا تتوفر صلاحية إضافة (INSERT RLS Policy) لحساب العميل في جدول restaurant_orders ولا توجد دالة RPC مخصصة في قاعدة البيانات. يتطلب تفعيل هذا المسار إضافة سياسة RLS لـ INSERT أو دالة قاعدة بيانات مصرحة.',
          };
        }

        return {
          success: false,
          message: `فشل إنشاء الطلب في جدول restaurant_orders: ${orderErr.message}`,
        };
      }

      if (!createdOrder) {
        return {
          success: false,
          message: 'فشل إنشاء الطلب في جدول طلبات المطاعم.',
        };
      }

      // 8. Insert Order Items into public.restaurant_order_items
      const createdItems: FoodOrderItem[] = [];
      for (const it of verifiedItemsList) {
        const itemPayload = {
          order_id: createdOrder.id,
          menu_item_id: it.menu_item_id,
          item_name_snapshot: it.item_name_snapshot,
          unit_price_snapshot: it.unit_price_snapshot,
          quantity: it.quantity,
          discount_amount: 0,
          line_total: it.line_total,
          customer_approved_price_change: false,
        };

        const { data: insertedItem, error: itemErr } = await supabase
          .from('restaurant_order_items')
          .insert(itemPayload)
          .select()
          .single();

        if (itemErr) {
          console.warn('[foodService] Error inserting restaurant_order_items:', itemErr.message);
        }

        // 9. Insert Options into public.restaurant_order_item_options
        if (insertedItem && it.options_snapshot.length > 0) {
          const optionsPayload = it.options_snapshot.map((opt: any) => ({
            order_item_id: insertedItem.id,
            option_name_snapshot: opt.group_name || opt.option_name,
            value_name_snapshot: opt.option_name,
            extra_price_snapshot: Number(opt.extra_price) || 0,
          }));

          const { error: optErr } = await supabase
            .from('restaurant_order_item_options')
            .insert(optionsPayload);

          if (optErr) {
            console.warn('[foodService] Error inserting restaurant_order_item_options:', optErr.message);
          }
        }

        const optionsText = it.options_snapshot.map((o: any) => o.option_name).join('، ');
        createdItems.push({
          menuItemId: it.menu_item_id,
          name: it.item_name_snapshot,
          quantity: it.quantity,
          unitPrice: it.unit_price_snapshot,
          totalPrice: it.line_total,
          selectedOptionsDescription: optionsText || undefined,
          notes: it.notes,
        });
      }

      // 10. Record Initial Status History in public.restaurant_order_status_history
      try {
        await supabase.from('restaurant_order_status_history').insert({
          order_id: createdOrder.id,
          status: 'pending',
          changed_by_user_id: userId,
          notes: 'تم إرسال الطلب بواسطة العميل',
        });
      } catch (histErr) {
        console.warn('[foodService] Non-critical history insert error:', histErr);
      }

      // 11. Construct Domain FoodOrder Response
      const responseOrder: FoodOrder = {
        id: createdOrder.id,
        restaurantId: dbRestaurant.id,
        restaurantName: dbRestaurant.name,
        restaurantPhone: dbRestaurant.phone || '',
        restaurantAddress: dbRestaurant.address || '',
        customerName: params.customerName?.trim() || dbAddr.full_name || 'العميل',
        customerPhone: params.customerPhone?.trim() || dbAddr.phone || '',
        address: {
          id: dbAddr.id,
          label: dbAddr.address_label || 'عنوان التوصيل',
          recipientName: dbAddr.full_name || '',
          phone: dbAddr.phone || '',
          governorate: dbAddr.governorate_name || '',
          markaz: dbAddr.markaz_name || '',
          detailedAddress: dbAddr.detailed_address || '',
          latitude: Number(dbAddr.latitude) || 0,
          longitude: Number(dbAddr.longitude) || 0,
          isDefault: Boolean(dbAddr.is_default),
        },
        items: createdItems,
        subtotal: verifiedSubtotal,
        discount: 0,
        deliveryFee: verifiedDeliveryFee,
        totalAmount: verifiedTotalAmount,
        notes: params.notes,
        paymentMethod: 'cash_on_delivery',
        deliveryChannel: dbRestaurant.deliveryChannel || 'direct_system',
        orderStatus: 'pending_restaurant_confirmation',
        deliveryStatus: 'waiting_dispatch',
        invoiceIssued: false,
        invoiceNumber: createdOrder.order_number ? `ORD-${createdOrder.order_number}` : undefined,
        createdAt: createdOrder.created_at,
        updatedAt: createdOrder.updated_at || createdOrder.created_at,
        estimatedDeliveryTime: 'خلال 35-45 دقيقة',
      };

      return {
        success: true,
        order: responseOrder,
        message: 'تم إرسال طلب المطعم بنجاح!',
      };
    } catch (err: any) {
      console.error('[foodService] Exception creating restaurant order:', err);
      return {
        success: false,
        message: err.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب.',
      };
    }
  },

  // 12. Read Customer Orders directly from public.restaurant_orders
  async listCustomerOrders(
    providedHouseholdId?: string,
    providedUserId?: string
  ): Promise<FoodOrder[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = providedUserId || session?.user?.id;
      if (!userId) return [];

      const { data: dbOrders, error: ordersErr } = await supabase
        .from('restaurant_orders')
        .select(`
          *,
          restaurants (
            id,
            name,
            phone,
            address,
            image_url,
            delivery_fee
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

      if (ordersErr || !dbOrders) {
        console.warn('[foodService] Error reading restaurant_orders:', ordersErr?.message);
        return [];
      }

      return dbOrders.map((o: any) => {
        const rest = o.restaurants;
        const orderItems: FoodOrderItem[] = (o.restaurant_order_items || []).map((it: any) => {
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

        return {
          id: o.id,
          restaurantId: o.restaurant_id,
          restaurantName: rest?.name || 'مطعم',
          restaurantPhone: rest?.phone || '',
          restaurantAddress: rest?.address || '',
          customerName: o.customer_name || 'العميل',
          customerPhone: o.customer_phone || '',
          address: {
            id: o.delivery_address_id || 'addr-default',
            label: 'عنوان التوصيل',
            recipientName: o.customer_name || '',
            phone: o.customer_phone || '',
            governorate: '',
            markaz: '',
            detailedAddress: '',
            latitude: 0,
            longitude: 0,
            isDefault: false,
          },
          items: orderItems,
          subtotal: Number(o.food_subtotal) || 0,
          discount: Number(o.discount_amount) || 0,
          deliveryFee: Number(o.delivery_fee) || 0,
          totalAmount: Number(o.customer_total) || 0,
          notes: o.delivery_notes || o.restaurant_notes || undefined,
          paymentMethod: 'cash_on_delivery',
          deliveryChannel: 'direct_system',
          orderStatus: mapDeliveryStatusToFoodStatus(o.status),
          deliveryStatus: mapDeliveryOrderStatus(o.status),
          invoiceIssued: false,
          invoiceNumber: o.order_number ? `ORD-${o.order_number}` : undefined,
          createdAt: o.created_at,
          updatedAt: o.updated_at || o.created_at,
          estimatedDeliveryTime: 'خلال 35-45 دقيقة',
        };
      });
    } catch (err) {
      console.warn('[foodService] Exception reading restaurant_orders:', err);
      return [];
    }
  },

  // 13. Read Single Order Details from public.restaurant_orders
  async getOrderDetails(orderId: string): Promise<FoodOrder | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data: o, error } = await supabase
        .from('restaurant_orders')
        .select(`
          *,
          restaurants (
            id,
            name,
            phone,
            address,
            image_url,
            delivery_fee
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
        .eq('id', orderId)
        .maybeSingle();

      if (error || !o) return null;

      const rest = o.restaurants;
      const orderItems: FoodOrderItem[] = (o.restaurant_order_items || []).map((it: any) => {
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

      return {
        id: o.id,
        restaurantId: o.restaurant_id,
        restaurantName: rest?.name || 'مطعم',
        restaurantPhone: rest?.phone || '',
        restaurantAddress: rest?.address || '',
        customerName: o.customer_name || 'العميل',
        customerPhone: o.customer_phone || '',
        address: {
          id: o.delivery_address_id || 'addr-default',
          label: 'عنوان التوصيل',
          recipientName: o.customer_name || '',
          phone: o.customer_phone || '',
          governorate: '',
          markaz: '',
          detailedAddress: '',
          latitude: 0,
          longitude: 0,
          isDefault: false,
        },
        items: orderItems,
        subtotal: Number(o.food_subtotal) || 0,
        discount: Number(o.discount_amount) || 0,
        deliveryFee: Number(o.delivery_fee) || 0,
        totalAmount: Number(o.customer_total) || 0,
        notes: o.delivery_notes || o.restaurant_notes || undefined,
        paymentMethod: 'cash_on_delivery',
        deliveryChannel: 'direct_system',
        orderStatus: mapDeliveryStatusToFoodStatus(o.status),
        deliveryStatus: mapDeliveryOrderStatus(o.status),
        invoiceIssued: false,
        invoiceNumber: o.order_number ? `ORD-${o.order_number}` : undefined,
        createdAt: o.created_at,
        updatedAt: o.updated_at || o.created_at,
        estimatedDeliveryTime: 'خلال 35-45 دقيقة',
      };
    } catch (err) {
      console.warn('[foodService] Exception fetching order details:', err);
      return null;
    }
  },

  // 14. Cancel Order in public.restaurant_orders
  async cancelOrder(orderId: string, reason?: string): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, message: 'قاعدة بيانات Supabase غير مهيأة.' };
    }

    try {
      const { error } = await supabase
        .from('restaurant_orders')
        .update({
          status: 'cancelled',
          cancel_reason: reason ? `تم الإلغاء: ${reason}` : 'تم الإلغاء بواسطة العميل',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) {
        return { success: false, message: `فشل إلغاء الطلب: ${error.message}` };
      }

      return { success: true, message: 'تم إلغاء الطلب بنجاح.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'حدث خطأ أثناء إلغاء الطلب.' };
    }
  },

  // Backward Compatibility Aliases
  createMockRestaurantOrder(params: any) {
    return this.createRestaurantOrder(params);
  },
  listMockCustomerOrders(householdId?: string, userId?: string) {
    return this.listCustomerOrders(householdId, userId);
  },
  getMockOrderDetails(orderId: string) {
    return this.getOrderDetails(orderId);
  },
  async updateOrderStatusForTesting(
    orderId: string,
    newStatus: FoodOrderStatus,
    deliveryStatus?: FoodDeliveryStatus
  ): Promise<FoodOrder | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const rawStatus = newStatus === 'delivered' ? 'delivered' : newStatus === 'cancelled' ? 'cancelled' : 'pending';
      await supabase
        .from('restaurant_orders')
        .update({
          status: rawStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      return this.getOrderDetails(orderId);
    } catch {
      return null;
    }
  },
  updateMockOrderStatusForTesting(orderId: string, newStatus: FoodOrderStatus, deliveryStatus?: FoodDeliveryStatus) {
    return this.updateOrderStatusForTesting(orderId, newStatus, deliveryStatus);
  },
};

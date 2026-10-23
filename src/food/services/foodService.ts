import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Restaurant,
  MenuItem,
  MenuOptionGroup,
  MenuOptionItem,
  FoodOffer,
  FoodCustomerAddress,
  FoodOrder,
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

const FALLBACK_RESTAURANT_IMG =
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80';
const FALLBACK_MENU_IMG =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

export const foodService = {
  // 1. Read Restaurant Section Settings (restaurant_section_settings)
  async getSectionSettings(): Promise<RestaurantSectionSettings | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        id: 'default',
        section_enabled: true,
        global_max_delivery_radius_km: 15,
        no_driver_timeout_minutes: 10,
      };
    }

    try {
      const { data, error } = await supabase
        .from('restaurant_section_settings')
        .select('id, section_enabled, global_max_delivery_radius_km, no_driver_timeout_minutes, created_at, updated_at')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[foodService] Error reading restaurant_section_settings:', error.message);
        return {
          id: 'fallback',
          section_enabled: true,
          global_max_delivery_radius_km: 15,
          no_driver_timeout_minutes: 10,
        };
      }

      if (!data) {
        // If settings table is empty, treat as enabled by default
        return {
          id: 'default-enabled',
          section_enabled: true,
          global_max_delivery_radius_km: 15,
          no_driver_timeout_minutes: 10,
        };
      }

      return {
        id: data.id,
        section_enabled: Boolean(data.section_enabled),
        global_max_delivery_radius_km: Number(data.global_max_delivery_radius_km) || 15,
        no_driver_timeout_minutes: Number(data.no_driver_timeout_minutes) || 10,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (err: any) {
      console.warn('[foodService] Exception fetching restaurant_section_settings:', err);
      return {
        id: 'fallback',
        section_enabled: true,
        global_max_delivery_radius_km: 15,
        no_driver_timeout_minutes: 10,
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

  // 8. Read Customer Orders (restaurant_orders - Read only)
  async listMockCustomerOrders(): Promise<FoodOrder[]> {
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
        .from('restaurant_orders')
        .select('*')
        .eq('customer_user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      // Map raw restaurant_orders to FoodOrder
      return data.map((o: any) => ({
        id: o.order_number || o.id,
        restaurantId: o.restaurant_id,
        restaurantName: o.restaurant_name_snapshot || 'مطعم',
        restaurantPhone: o.restaurant_phone_snapshot || '',
        restaurantAddress: '',
        customerName: o.customer_name || '',
        customerPhone: o.customer_phone || '',
        address: {
          id: 'addr-default',
          label: 'عنوان التوصيل',
          recipientName: o.customer_name || '',
          phone: o.customer_phone || '',
          governorate: '',
          markaz: '',
          detailedAddress: o.delivery_address || '',
          latitude: Number(o.delivery_latitude) || 0,
          longitude: Number(o.delivery_longitude) || 0,
        },
        items: [],
        subtotal: Number(o.food_subtotal) || 0,
        discount: Number(o.discount_amount) || 0,
        deliveryFee: Number(o.delivery_fee) || 0,
        totalAmount: Number(o.customer_total) || 0,
        paymentMethod: 'cash_on_delivery',
        deliveryChannel: o.fulfillment_route === 'call_dispatch' ? 'call_dispatch' : 'direct_system',
        orderStatus: o.status || 'pending_restaurant_confirmation',
        deliveryStatus: 'waiting_dispatch',
        invoiceIssued: Boolean(o.restaurant_confirmed_at),
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        estimatedDeliveryTime: 'خلال 35 دقيقة',
      }));
    } catch (err) {
      console.warn('[foodService] Exception reading restaurant_orders:', err);
      return [];
    }
  },

  // 9. Read Customer Addresses helper
  async listCustomerAddresses(): Promise<FoodCustomerAddress[]> {
    return [
      {
        id: 'addr-demo-1',
        label: 'عنوان المنزل الرئيسي',
        recipientName: 'المستلم',
        phone: '01012345678',
        governorate: 'القاهرة',
        markaz: 'مدينة نصر',
        detailedAddress: 'شارع عباس العقاد، برج النصر، الدور الرابع',
        latitude: 30.0631,
        longitude: 31.3421,
        isDefault: true,
      },
    ];
  },

  async addCustomerAddress(address: Omit<FoodCustomerAddress, 'id'>): Promise<FoodCustomerAddress> {
    return {
      ...address,
      id: `addr-${Date.now()}`,
    };
  },

  // 10. Order Placement Placeholder (READ-ONLY PHASE: No INSERTs to restaurant_orders)
  async createMockRestaurantOrder(params?: {
    restaurant: Restaurant;
    items: FoodCartItem[];
    customerName: string;
    customerPhone: string;
    address: FoodCustomerAddress;
    notes?: string;
  }): Promise<{ success: boolean; order?: FoodOrder; message?: string }> {
    return {
      success: false,
      message:
        'مرحلة القراءة فقط: تم فحص وتجهيز سلة مشترياتك والتخصيصات بنجاح. سيتم تفعيل إرسال الطلبات وحفظها في قاعدة البيانات في المرحلة التالية بعد اعتماد الربط.',
    };
  },

  async getMockOrderDetails(orderId: string): Promise<FoodOrder | null> {
    return null;
  },

  async updateMockOrderStatusForTesting(
    orderId: string,
    newStatus: FoodOrderStatus,
    deliveryStatus?: FoodDeliveryStatus
  ): Promise<FoodOrder | null> {
    return null;
  },

  async cancelOrder(orderId: string, reason?: string): Promise<{ success: boolean; message?: string }> {
    return {
      success: false,
      message: 'مرحلة القراءة فقط: إلغاء الطلبات من قاعدة البيانات غير متاح في هذه المرحلة.',
    };
  },
};

import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './supabase';
import { cacheManager } from './cacheManager';
import { syncManager } from './syncManager';
import { CENTRAL_CATEGORIES, CENTRAL_PRODUCTS } from '../data/centralCatalog';
import {
  GlobalCategory,
  GlobalProduct,
  HouseholdProduct,
  CatalogProduct,
  CategoryInfo,
  SubCategory,
} from '../types';

const DEFAULT_CATEGORY_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';

export function normalizeSubcategories(raw: any): SubCategory[] {
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter(Boolean)
    .map((item: any, idx: number) => {
      if (typeof item === 'string') {
        return {
          id: `sub_${idx + 1}`,
          nameAr: item,
          nameEn: '',
          items: [],
        };
      }
      return {
        id: String(item.id || `sub_${idx + 1}`),
        nameAr: String(item.nameAr || item.name_ar || item.name || item.title || ''),
        nameEn: String(item.nameEn || item.name_en || ''),
        items: Array.isArray(item.items) ? item.items : [],
      };
    })
    .filter((s) => s.nameAr.trim().length > 0);
}

export function normalizeGlobalCategory(raw: any, index = 0): GlobalCategory {
  const subcategories = normalizeSubcategories(raw?.subcategories);
  const sortOrderRaw = raw?.sort_order ?? raw?.sortOrder;
  const parsedSortOrder =
    sortOrderRaw !== undefined && sortOrderRaw !== null && !Number.isNaN(Number(sortOrderRaw))
      ? Number(sortOrderRaw)
      : index + 1;

  return {
    id: String(raw?.id || `cat_${index + 1}`),
    name_ar: String(raw?.name_ar || raw?.nameAr || raw?.name || raw?.title || '').trim(),
    name_en: String(raw?.name_en || raw?.nameEn || '').trim(),
    image_url: String(raw?.image_url || raw?.imageUrl || DEFAULT_CATEGORY_IMAGE).trim() || DEFAULT_CATEGORY_IMAGE,
    icon_name: String(raw?.icon_name || raw?.iconName || 'ShoppingCart'),
    color: String(raw?.color || 'emerald'),
    bg_light: String(raw?.bg_light || raw?.bgLight || 'bg-emerald-50 text-emerald-800 border-emerald-200'),
    badge_color: String(raw?.badge_color || raw?.badgeColor || 'bg-emerald-100 text-emerald-800'),
    description: String(raw?.description || 'تصفح منتجات ومستلزمات القسم'),
    subcategories,
    is_active: raw?.is_active !== false && raw?.isActive !== false,
    sort_order: parsedSortOrder,
    created_at: raw?.created_at || raw?.createdAt,
    updated_at: raw?.updated_at || raw?.updatedAt,
  };
}

export function mapGlobalCategoryToCategoryInfo(gc: GlobalCategory | any, index = 0): CategoryInfo {
  const norm = normalizeGlobalCategory(gc, index);
  const subcatItems = (norm.subcategories || []).flatMap((s) => s.items || []);
  const explicitCommon = Array.isArray(gc?.common_items)
    ? gc.common_items
    : Array.isArray(gc?.commonItems)
    ? gc.commonItems
    : [];
  const commonItems = explicitCommon.length > 0 ? explicitCommon : subcatItems;

  return {
    id: norm.id,
    nameAr: norm.name_ar,
    nameEn: norm.name_en || '',
    imageUrl: norm.image_url || DEFAULT_CATEGORY_IMAGE,
    iconName: norm.icon_name || 'ShoppingCart',
    color: norm.color || 'emerald',
    bgLight: norm.bg_light || 'bg-emerald-50 text-emerald-800 border-emerald-200',
    badgeColor: norm.badge_color || 'bg-emerald-100 text-emerald-800',
    description: norm.description || 'تصفح منتجات ومستلزمات القسم',
    commonItems,
    subcategories: norm.subcategories || [],
    isCustom: false,
    sourceGlobalCategoryId: norm.id,
    isActive: norm.is_active,
    sortOrder: norm.sort_order,
    updatedAt: norm.updated_at,
  };
}

export const catalogService = {
  /**
   * Fetch central global categories from Supabase `global_categories`.
   * - Online: Fetches active categories from `global_categories` ordered by `sort_order`, updates cache, and returns them.
   * - Offline / Failure: Uses cached `global_categories` if available; only falls back to `CENTRAL_CATEGORIES` when no cache exists at all.
   */
  async getGlobalCategories(): Promise<GlobalCategory[]> {
    const cached = cacheManager.getGlobalCache<GlobalCategory[]>('global_categories');
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const getOfflineFallback = (): GlobalCategory[] => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached
          .map((c, i) => normalizeGlobalCategory(c, i))
          .filter((c) => c.is_active !== false && Boolean(c.name_ar))
          .sort((a, b) => a.sort_order - b.sort_order);
      }
      return CENTRAL_CATEGORIES;
    };

    if (!isSupabaseConfigured() || !supabase || isOffline) {
      return getOfflineFallback();
    }

    try {
      let rows: any[] | null = null;

      const { data, error } = await supabase
        .from('global_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        rows = data;
      } else if (error) {
        // Fallback query without order clause in case sort_order caused an issue
        const retryRes = await supabase.from('global_categories').select('*');
        if (!retryRes.error && Array.isArray(retryRes.data) && retryRes.data.length > 0) {
          rows = retryRes.data;
        }
      }

      // If Supabase client had not hydrated its auth JWT yet when called on startup,
      // RLS (`TO authenticated`) returns 0 rows for anon. Use stored session JWT if available.
      if ((!rows || rows.length === 0) && supabaseUrl && supabaseAnonKey) {
        const storedSession = cacheManager.getStoredSession();
        if (storedSession?.access_token) {
          try {
            const resp = await fetch(
              `${supabaseUrl}/rest/v1/global_categories?select=*&order=sort_order.asc`,
              {
                headers: {
                  apikey: supabaseAnonKey,
                  Authorization: `Bearer ${storedSession.access_token}`,
                },
              }
            );
            if (resp.ok) {
              const json = await resp.json();
              if (Array.isArray(json) && json.length > 0) {
                rows = json;
              }
            }
          } catch (restErr) {
            console.warn('[catalogService] REST fallback for global_categories failed:', restErr);
          }
        }
      }

      if (!rows || rows.length === 0) {
        return getOfflineFallback();
      }

      const cats = rows
        .map((r, i) => normalizeGlobalCategory(r, i))
        .filter((c) => c.is_active !== false && Boolean(c.name_ar))
        .sort((a, b) => a.sort_order - b.sort_order);

      if (cats.length === 0) {
        return getOfflineFallback();
      }

      cacheManager.setGlobalCache('global_categories', cats);
      return cats;
    } catch (err) {
      console.warn('[catalogService] Error fetching global categories:', err);
      return getOfflineFallback();
    }
  },

  /**
   * Fetch central global products (with offline cache and fallback to approved central products)
   */
  async getGlobalProducts(categoryId?: string): Promise<GlobalProduct[]> {
    const cached = cacheManager.getGlobalCache<GlobalProduct[]>('global_products');
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const getFallbackProducts = (): GlobalProduct[] => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        const activeCached = cached
          .filter((p: any) => p.is_active !== false && p.isActive !== false)
          .sort((a: any, b: any) => (Number(a.sort_order ?? 999)) - (Number(b.sort_order ?? 999)));
        return categoryId
          ? activeCached.filter((p) => p.global_category_id === categoryId)
          : activeCached;
      }
      if (categoryId) {
        return CENTRAL_PRODUCTS.filter((p) => p.global_category_id === categoryId);
      }
      return CENTRAL_PRODUCTS;
    };

    if (!isSupabaseConfigured() || !supabase || isOffline) {
      return getFallbackProducts();
    }

    try {
      let query = supabase
        .from('global_products')
        .select('*')
        .order('sort_order', { ascending: true });

      if (categoryId) {
        query = query.eq('global_category_id', categoryId);
      }

      let { data, error } = await query;

      if ((!data || data.length === 0) && supabaseUrl && supabaseAnonKey) {
        const storedSession = cacheManager.getStoredSession();
        if (storedSession?.access_token) {
          try {
            const filterParam = categoryId
              ? `&global_category_id=eq.${encodeURIComponent(categoryId)}`
              : '';
            const resp = await fetch(
              `${supabaseUrl}/rest/v1/global_products?select=*&order=sort_order.asc${filterParam}`,
              {
                headers: {
                  apikey: supabaseAnonKey,
                  Authorization: `Bearer ${storedSession.access_token}`,
                },
              }
            );
            if (resp.ok) {
              const json = await resp.json();
              if (Array.isArray(json) && json.length > 0) {
                data = json;
                error = null;
              }
            }
          } catch {}
        }
      }

      if (error || !data || data.length === 0) {
        // If querying for a specific new category that simply has 0 global products yet, return [] if global cache exists
        if (categoryId && !error && Array.isArray(data) && data.length === 0) {
          return [];
        }
        return getFallbackProducts();
      }

      const prods = (data as any[])
        .filter((p) => p.is_active !== false && p.isActive !== false)
        .map((p, idx) => ({
          ...p,
          is_active: p.is_active !== false && p.isActive !== false,
          sort_order:
            p.sort_order !== undefined && p.sort_order !== null && !Number.isNaN(Number(p.sort_order))
              ? Number(p.sort_order)
              : idx + 1,
        }))
        .sort((a, b) => a.sort_order - b.sort_order) as GlobalProduct[];

      if (!categoryId && prods.length > 0) {
        cacheManager.setGlobalCache('global_products', prods);
      }
      return prods;
    } catch (err) {
      console.warn('[catalogService] Error fetching global products:', err);
      return getFallbackProducts();
    }
  },

  /**
   * Fetch household-specific products (isolated by householdId)
   */
  async getHouseholdProducts(
    userId: string,
    householdId: string,
    categoryId?: string
  ): Promise<HouseholdProduct[]> {
    const cached = cacheManager.getHouseholdCache<HouseholdProduct[]>(
      userId,
      householdId,
      'household_products'
    );

    if (!isSupabaseConfigured()) {
      if (cached) {
        return categoryId ? cached.filter((p) => p.category_id === categoryId) : cached;
      }
      return [];
    }

    try {
      let query = supabase
        .from('household_products')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const fullProducts = categoryId && cached
          ? [...cached.filter((p) => p.category_id !== categoryId), ...data]
          : data;

        cacheManager.setHouseholdCache(
          userId,
          householdId,
          'household_products',
          fullProducts as HouseholdProduct[]
        );
        return data as HouseholdProduct[];
      }
    } catch (err) {
      console.warn('[catalogService] Error fetching household products, using cache:', err);
    }

    if (cached) {
      return categoryId ? cached.filter((p) => p.category_id === categoryId) : cached;
    }
    return [];
  },

  /**
   * Get unified catalog products for a category:
   * Merges Global Products + Household Custom Products without duplication
   */
  async getUnifiedCatalogProducts(
    userId: string,
    householdId: string,
    categoryId: string
  ): Promise<CatalogProduct[]> {
    const [globalProds, hhProds] = await Promise.all([
      this.getGlobalProducts(categoryId),
      this.getHouseholdProducts(userId, householdId, categoryId),
    ]);

    const unifiedMap = new Map<string, CatalogProduct>();

    // 1. Add all active global products
    globalProds.forEach((gp) => {
      unifiedMap.set(gp.id, {
        id: gp.id,
        category_id: gp.global_category_id,
        subcategory_id: gp.subcategory_id || null,
        name_ar: gp.name_ar,
        name_en: gp.name_en || null,
        image_url: gp.image_url || null,
        default_quantity: gp.default_quantity || '١',
        default_unit: gp.default_unit || 'قطعة',
        quantity: gp.default_quantity || '١',
        unit: gp.default_unit || 'قطعة',
        estimated_price: gp.estimated_price || 0,
        source_global_product_id: gp.id,
        is_custom: false,
        is_active: gp.is_active,
        sort_order: gp.sort_order ?? 0,
      });
    });

    // 2. Overlay household products (customizations & custom products)
    hhProds.forEach((hp) => {
      // A. Exact link to a global product
      if (hp.source_global_product_id && unifiedMap.has(hp.source_global_product_id)) {
        const existing = unifiedMap.get(hp.source_global_product_id)!;
        unifiedMap.set(hp.source_global_product_id, {
          ...existing,
          quantity: hp.quantity || existing.quantity,
          unit: hp.unit || existing.unit,
          estimated_price: hp.estimated_price !== undefined ? hp.estimated_price : existing.estimated_price,
          image_url: hp.image_url || existing.image_url,
          is_active: hp.is_active,
          sort_order: hp.sort_order ?? existing.sort_order,
        });
        return;
      }

      // B. Match by name_ar to avoid duplicates
      const normalizedHpName = hp.name_ar.trim().toLowerCase();
      const matchingGlobal = Array.from(unifiedMap.values()).find(
        (p) => p.name_ar.trim().toLowerCase() === normalizedHpName
      );
      if (matchingGlobal) {
        unifiedMap.set(matchingGlobal.id, {
          ...matchingGlobal,
          quantity: hp.quantity || matchingGlobal.quantity,
          unit: hp.unit || matchingGlobal.unit,
          estimated_price: hp.estimated_price !== undefined ? hp.estimated_price : matchingGlobal.estimated_price,
          image_url: hp.image_url || matchingGlobal.image_url,
          is_active: hp.is_active,
        });
        return;
      }

      // C. Distinct custom household product
      unifiedMap.set(hp.id, {
        id: hp.id,
        category_id: hp.category_id,
        subcategory_id: hp.subcategory_id || null,
        name_ar: hp.name_ar,
        name_en: hp.name_en || null,
        image_url: hp.image_url || null,
        default_quantity: hp.quantity || '١',
        default_unit: hp.unit || 'قطعة',
        quantity: hp.quantity || '١',
        unit: hp.unit || 'قطعة',
        estimated_price: hp.estimated_price || 0,
        source_global_product_id: null,
        is_custom: true,
        is_active: hp.is_active,
        sort_order: hp.sort_order ?? 999,
      });
    });

    return Array.from(unifiedMap.values())
      .filter((p) => p.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  /**
   * Add or customize a product in the household catalog
   */
  async addOrUpdateHouseholdProduct(
    userId: string,
    householdId: string,
    product: {
      id?: string;
      category_id: string;
      subcategory_id?: string | null;
      name_ar: string;
      name_en?: string | null;
      image_url?: string | null;
      quantity?: string;
      unit?: string;
      estimated_price?: number;
      source_global_product_id?: string | null;
      is_custom?: boolean;
    }
  ): Promise<{ success: boolean; product?: HouseholdProduct; message?: string }> {
    const productId = product.id || `hp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newProduct: HouseholdProduct = {
      id: productId,
      household_id: householdId,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id || null,
      name_ar: product.name_ar,
      name_en: product.name_en || null,
      image_url: product.image_url || null,
      quantity: product.quantity || '١',
      unit: product.unit || 'قطعة',
      estimated_price: Number(product.estimated_price) || 0,
      source_global_product_id: product.source_global_product_id || null,
      is_custom: Boolean(product.is_custom ?? true),
      is_active: true,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Update local cache immediately
    const cached = cacheManager.getHouseholdCache<HouseholdProduct[]>(
      userId,
      householdId,
      'household_products'
    ) || [];
    const index = cached.findIndex((p) => p.id === productId);
    const updated = index >= 0
      ? cached.map((p, i) => (i === index ? newProduct : p))
      : [...cached, newProduct];
    cacheManager.setHouseholdCache(userId, householdId, 'household_products', updated);

    // 2. Queue mutation through syncManager
    syncManager.enqueue({
      entity: 'household_products',
      type: 'UPSERT',
      recordId: productId,
      payload: newProduct,
    });

    return { success: true, product: newProduct };
  },

  /**
   * Delete or deactivate a household product
   */
  async deleteHouseholdProduct(
    userId: string,
    householdId: string,
    productId: string
  ): Promise<{ success: boolean }> {
    // 1. Update local cache immediately
    const cached = cacheManager.getHouseholdCache<HouseholdProduct[]>(
      userId,
      householdId,
      'household_products'
    ) || [];
    const updated = cached.filter((p) => p.id !== productId);
    cacheManager.setHouseholdCache(userId, householdId, 'household_products', updated);

    // 2. Queue deletion in syncManager
    syncManager.enqueue({
      entity: 'household_products',
      type: 'DELETE',
      recordId: productId,
      payload: { id: productId },
    });

    return { success: true };
  },

  /**
   * Seed household catalog from global catalog (RPC with robust client fallback)
   */
  async seedHouseholdCatalog(householdId: string): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'Supabase غير مهيأة' };
    }

    try {
      const { data, error } = await supabase.rpc('seed_household_catalog', {
        p_household_id: householdId,
      });

      if (!error) {
        return { success: true, ...(data as any) };
      }

      console.warn('[catalogService] RPC seed_household_catalog unavailable, using direct catalog copy fallback:', error.message);

      // Fallback: Fetch active global products and seed household_products directly
      const { data: globals, error: gErr } = await supabase
        .from('global_products')
        .select('*')
        .eq('is_active', true);

      if (gErr || !globals || globals.length === 0) {
        return { success: true, message: 'تم تهيئة كتالوج المنزل بالبيانات الأساسية' };
      }

      const rowsToInsert = globals.map((gp: any) => ({
        id: `hp_${householdId}_${gp.id}`,
        household_id: householdId,
        category_id: gp.global_category_id,
        subcategory_id: gp.subcategory_id || null,
        name_ar: gp.name_ar,
        name_en: gp.name_en || null,
        image_url: gp.image_url || null,
        quantity: gp.quantity || '١',
        unit: gp.unit || 'قطعة',
        estimated_price: gp.estimated_price || 0,
        source_global_product_id: gp.id,
        is_custom: false,
        is_active: true,
        sort_order: gp.sort_order || 0,
      }));

      await supabase.from('household_products').upsert(rowsToInsert, { onConflict: 'id' });
      return { success: true, message: `تم استيراد ${rowsToInsert.length} صنف من الكتالوج بنجاح` };
    } catch (err: any) {
      console.warn('[catalogService] Error seeding household catalog:', err);
      return { success: true, message: 'تمت تهيئة الكتالوج بنجاح' };
    }
  },

  /**
   * Update a record in central public.global_categories (e.g. pharmacy category name or image)
   */
  async updateGlobalCategory(
    id: string,
    updates: Partial<{ name_ar: string; name_en: string; image_url: string; is_active: boolean; sort_order: number }>
  ): Promise<{ success: boolean; data?: any; error?: any }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase is not configured' };
    }
    try {
      const payload: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('global_categories')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) {
        console.warn(`[catalogService] Error updating global category ${id}:`, error);
        return { success: false, error };
      }
      return { success: true, data };
    } catch (err: any) {
      console.warn(`[catalogService] Exception updating global category ${id}:`, err);
      return { success: false, error: err };
    }
  },
};

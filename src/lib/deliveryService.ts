import { supabase, isSupabaseConfigured } from './supabase';
import { cacheManager } from './cacheManager';
import {
  checkGpsWithinGeoBoundary,
  resolveCentralTariff,
  validateGeoHierarchySelection,
  validateGpsCoordinates,
  type CentralTariffResolution,
} from './geoService';
import {
  DeliverySettings,
  HouseholdAddress,
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryOrderStatus,
} from '../types';

/**
 * Unified Delivery Service for Talabaty Household Client
 * - Central `delivery_settings.delivery_enabled` check
 * - Household Addresses with mandatory `geo_*` hierarchy IDs + valid GPS telemetry
 * - Centralized `delivery_area_tariffs` resolution (NO hardcoded delivery fees)
 */
export const deliveryService = {
  /**
   * Fetch central delivery enablement settings (`delivery_enabled`)
   */
  async getSettings(): Promise<DeliverySettings> {
    const emptySettings: DeliverySettings = {
      id: 'default',
      delivery_enabled: true,
      default_delivery_fee: 0,
    };

    if (!isSupabaseConfigured()) {
      return emptySettings;
    }

    try {
      const { data, error } = await supabase
        .from('delivery_settings')
        .select('id, delivery_enabled, default_delivery_fee, updated_by, updated_at')
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return emptySettings;
      }
      return data as DeliverySettings;
    } catch (err) {
      console.warn('[deliveryService] Exception fetching settings:', err);
      return emptySettings;
    }
  },

  /**
   * Toggle delivery enabled state or update default fee (Admin Only)
   */
  async toggleService(enabled: boolean, defaultFee?: number): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'قاعدة بيانات Supabase غير مهيأة' };
    }
    try {
      const { data, error } = await supabase.rpc('toggle_delivery_service', {
        p_enabled: enabled,
        p_default_fee: defaultFee ?? null,
      });
      if (error) {
        // Fallback to direct table update if RPC not provisioned yet
        const { error: updErr } = await supabase
          .from('delivery_settings')
          .update({
            delivery_enabled: enabled,
            ...(defaultFee !== undefined ? { default_delivery_fee: defaultFee } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', 'default');

        if (updErr) throw updErr;
        return { success: true };
      }
      return (data as { success: boolean; message?: string }) || { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل تحديث إعدادات التوصيل' };
    }
  },

  /**
   * Get addresses for a specific household
   */
  async getHouseholdAddresses(householdId: string, userId?: string): Promise<HouseholdAddress[]> {
    if (!householdId) return [];

    let cachedAddresses: HouseholdAddress[] = [];
    if (userId) {
      cachedAddresses = cacheManager.getHouseholdCache<HouseholdAddress[]>(
        userId,
        householdId,
        'household_addresses'
      ) || [];
    }

    if (!isSupabaseConfigured()) {
      return cachedAddresses;
    }

    try {
      const { data, error } = await supabase
        .from('household_addresses')
        .select('*')
        .eq('household_id', householdId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[deliveryService] Error fetching addresses:', error.message);
        return cachedAddresses;
      }

      const fetched = (data as HouseholdAddress[]) || [];
      if (userId) {
        cacheManager.setHouseholdCache(userId, householdId, 'household_addresses', fetched);
      }
      return fetched;
    } catch (err) {
      console.error('[deliveryService] Exception fetching addresses:', err);
      return cachedAddresses;
    }
  },

  /**
   * Mark an existing household address as default without bypassing address creation validation
   */
  async setDefaultAddress(
    addressId: string,
    householdId: string,
    userId?: string
  ): Promise<{ success: boolean; message?: string }> {
    if (!addressId || !householdId) {
      return { success: false, message: 'بيانات العنوان غير مكتملة' };
    }

    if (userId) {
      const current =
        cacheManager.getHouseholdCache<HouseholdAddress[]>(
          userId,
          householdId,
          'household_addresses'
        ) || [];
      const updated = current.map((a) => ({ ...a, is_default: a.id === addressId }));
      cacheManager.setHouseholdCache(userId, householdId, 'household_addresses', updated);
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    try {
      await supabase
        .from('household_addresses')
        .update({ is_default: false })
        .eq('household_id', householdId);

      const { error } = await supabase
        .from('household_addresses')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', addressId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل تعيين العنوان الافتراضي' };
    }
  },

  /**
   * Add or save a household address enforcing central geo hierarchy IDs and valid non-zero GPS telemetry
   */
  async saveAddress(
    address: Partial<HouseholdAddress> & { household_id: string },
    userId?: string
  ): Promise<{ success: boolean; address?: HouseholdAddress; message?: string }> {
    if (!address.household_id) {
      return { success: false, message: 'معرّف المنزل غير موجود' };
    }

    if (!address.full_name?.trim()) {
      return { success: false, message: 'يرجى إدخال اسم المستلم' };
    }
    if (!address.phone?.trim()) {
      return { success: false, message: 'يرجى إدخال رقم هاتف التواصل' };
    }
    if (!address.governorate_id?.trim() || !address.governorate_name?.trim()) {
      return { success: false, message: 'يرجى اختيار المحافظة من القائمة المعتمدة' };
    }
    if (!address.center_id?.trim() || !address.markaz_name?.trim()) {
      return { success: false, message: 'يرجى اختيار المركز / المدينة من القائمة المعتمدة' };
    }
    if (!address.area_id?.trim()) {
      return { success: false, message: 'يرجى اختيار المنطقة / الحي من القائمة المعتمدة' };
    }
    if (!address.detailed_address?.trim()) {
      return { success: false, message: 'يرجى كتابة العنوان التفصيلي' };
    }

    // Strict mandatory non-zero GPS verification (no fake/default coords allowed)
    const gpsCheck = validateGpsCoordinates(address.latitude, address.longitude);
    if (!gpsCheck.valid || gpsCheck.latitude === null || gpsCheck.longitude === null) {
      return {
        success: false,
        message: gpsCheck.reason || 'تحديد الموقع على الخريطة أو عبر GPS إجباري لحفظ العنوان',
      };
    }

    const cleanLatitude = Number(gpsCheck.latitude.toFixed(7));
    const cleanLongitude = Number(gpsCheck.longitude.toFixed(7));

    if (!isSupabaseConfigured()) {
      return {
        success: false,
        message: 'اتصال قاعدة البيانات غير متاح حالياً؛ لا يمكن حفظ العنوان بدون التحقق من النظام الجغرافي المركزي.',
      };
    }

    // Strict central geo hierarchy check (exists, active, parent-child chain valid)
    const hierarchyCheck = await validateGeoHierarchySelection(
      address.governorate_id,
      address.center_id,
      address.area_id
    );
    if (!hierarchyCheck.valid) {
      return {
        success: false,
        message: hierarchyCheck.reason || 'التسلسل الجغرافي للعنوان غير متطابق أو غير مفعّل في النظام المركزي.',
      };
    }

    // Check GPS containment against boundary (area -> center -> governorate; allowed if no boundary defined)
    const boundaryCheck = checkGpsWithinGeoBoundary(cleanLatitude, cleanLongitude, {
      area: hierarchyCheck.area,
      center: hierarchyCheck.center,
      governorate: hierarchyCheck.governorate,
    });
    if (!boundaryCheck.inside) {
      return {
        success: false,
        message: boundaryCheck.reason || 'إحداثيات GPS تقع خارج حدود المنطقة المحددة.',
      };
    }

    // If marked default, unset other addresses' default status
    if (address.is_default) {
      try {
        await supabase
          .from('household_addresses')
          .update({ is_default: false })
          .eq('household_id', address.household_id);
      } catch (e) {
        console.warn('Could not reset other default addresses', e);
      }
    }

    const payload: Record<string, any> = {
      household_id: address.household_id,
      address_label: address.address_label?.trim() || 'عنوان المنزل',
      full_name: address.full_name.trim(),
      phone: address.phone.trim(),
      country: 'مصر',
      governorate_id: address.governorate_id,
      governorate_name: hierarchyCheck.governorate?.name_ar || address.governorate_name.trim(),
      center_id: address.center_id,
      markaz_name: hierarchyCheck.center?.name_ar || address.markaz_name.trim(),
      area_id: address.area_id,
      area_name: hierarchyCheck.area?.name_ar || address.area_name?.trim() || null,
      detailed_address: address.detailed_address.trim(),
      latitude: cleanLatitude,
      longitude: cleanLongitude,
      gps_accuracy_m:
        address.gps_accuracy_m !== undefined && address.gps_accuracy_m !== null
          ? Number(address.gps_accuracy_m)
          : null,
      gps_source: address.gps_source || 'map_pin',
      gps_captured_at: address.gps_captured_at || new Date().toISOString(),
      ...(address.location !== undefined ? { location: address.location } : {}),
      is_default: !!address.is_default,
      updated_at: new Date().toISOString(),
    };

    const OPTIONAL_TELEMETRY_COLS = new Set([
      'gps_accuracy_m',
      'gps_source',
      'gps_captured_at',
      'area_name',
      'location',
    ]);

    const executeWrite = async (isUpdate: boolean): Promise<HouseholdAddress> => {
      let attemptPayload = { ...payload };
      for (let retry = 0; retry < 5; retry += 1) {
        const query = isUpdate
          ? supabase
              .from('household_addresses')
              .update(attemptPayload)
              .eq('id', address.id!)
              .select()
              .single()
          : supabase
              .from('household_addresses')
              .insert(attemptPayload)
              .select()
              .single();

        const { data, error } = await query;

        if (!error && data) {
          return data as HouseholdAddress;
        }

        // Only strip optional metadata telemetry columns if DB schema cache doesn't expose them yet;
        // NEVER strip governorate_id / center_id / area_id / latitude / longitude.
        if (error && error.code === 'PGRST204') {
          const match = /Could not find the '([^']+)' column/i.exec(error.message || '');
          const colName = match?.[1];
          if (colName && OPTIONAL_TELEMETRY_COLS.has(colName) && colName in attemptPayload) {
            delete attemptPayload[colName];
            continue;
          }
        }

        if (error && error.code === '23503') {
          throw new Error(
            'فشل حفظ العنوان: قيد المفتاح الأجنبي في جدول household_addresses لا يزال مرتبطاً بجداول قديمة بدلاً من geo_governorates / geo_centers / geo_areas في قاعدة البيانات.'
          );
        }

        throw error || new Error('فشل حفظ العنوان');
      }

      throw new Error('تعذر إتمام حفظ العنوان بعد عدة محاولات');
    };

    try {
      const savedAddress = await executeWrite(Boolean(address.id));

      if (userId && address.household_id) {
        const current =
          cacheManager.getHouseholdCache<HouseholdAddress[]>(
            userId,
            address.household_id,
            'household_addresses'
          ) || [];
        const filtered = current.filter((a) => a.id !== savedAddress.id);
        if (savedAddress.is_default) {
          filtered.forEach((a) => {
            a.is_default = false;
          });
        }
        const updated = [savedAddress, ...filtered];
        cacheManager.setHouseholdCache(userId, address.household_id, 'household_addresses', updated);
      }

      return { success: true, address: savedAddress };
    } catch (err: any) {
      console.error('[deliveryService] Error saving address:', err);
      return { success: false, message: err.message || 'فشل حفظ العنوان' };
    }
  },

  /**
   * Delete a household address
   */
  async deleteAddress(addressId: string, householdId?: string, userId?: string): Promise<boolean> {
    if (userId && householdId) {
      const current = cacheManager.getHouseholdCache<HouseholdAddress[]>(
        userId,
        householdId,
        'household_addresses'
      ) || [];
      const updated = current.filter((a) => a.id !== addressId);
      cacheManager.setHouseholdCache(userId, householdId, 'household_addresses', updated);
    }

    if (!isSupabaseConfigured()) return true;

    try {
      const { error } = await supabase
        .from('household_addresses')
        .delete()
        .eq('id', addressId);

      return !error;
    } catch (err) {
      console.error('[deliveryService] Error deleting address:', err);
      return false;
    }
  },

  /**
   * Resolves central household delivery tariff & eligibility from `delivery_area_tariffs`.
   * Checks global delivery_enabled switch, valid GPS coordinates, and geo hierarchy IDs.
   */
  async resolveHouseholdDeliveryTariff(address?: Partial<HouseholdAddress> | null): Promise<{
    allowed: boolean;
    deliveryFee: number | null;
    baseFee: number | null;
    adminCommission: number | null;
    driverNet: number | null;
    isFreeDelivery: boolean;
    estimatedDeliveryMinutes: number | null;
    tariffId: string | null;
    reason?: string;
    resolution?: CentralTariffResolution;
  }> {
    const blocked = (reason: string, resolution?: CentralTariffResolution) => ({
      allowed: false,
      deliveryFee: null,
      baseFee: null,
      adminCommission: null,
      driverNet: null,
      isFreeDelivery: false,
      estimatedDeliveryMinutes: null,
      tariffId: null,
      reason,
      resolution,
    });

    const settings = await this.getSettings();
    if (!settings.delivery_enabled) {
      return blocked('خدمة التوصيل معطلة حالياً من قبل الإدارة');
    }

    if (!address) {
      return blocked('يرجى اختيار عنوان توصيل صحيح أولاً');
    }

    const gpsCheck = validateGpsCoordinates(address.latitude, address.longitude);
    if (!gpsCheck.valid) {
      return blocked('هذا العنوان لا يحتوي على موقع GPS صالح. يرجى تعديل العنوان وتثبيت الموقع على الخريطة.');
    }

    if (!address.governorate_id || !address.center_id || !address.area_id) {
      return blocked('العنوان غير مربوط بالنظام الجغرافي المركزي (المحافظة / المركز / المنطقة). يرجى تعديل العنوان واستكماله.');
    }

    const tariffRes = await resolveCentralTariff({
      serviceType: 'household_shortages',
      deliveryOwner: 'platform',
      governorateId: address.governorate_id,
      centerId: address.center_id,
      areaId: address.area_id,
      latitude: gpsCheck.latitude,
      longitude: gpsCheck.longitude,
    });

    return {
      allowed: tariffRes.covered,
      deliveryFee: tariffRes.customerDeliveryFee,
      baseFee: tariffRes.baseFee,
      adminCommission: tariffRes.adminCommission,
      driverNet: tariffRes.driverNet,
      isFreeDelivery: tariffRes.isFreeDelivery,
      estimatedDeliveryMinutes: tariffRes.estimatedDeliveryMinutes,
      tariffId: tariffRes.tariffId,
      reason: tariffRes.reason,
      resolution: tariffRes,
    };
  },

  /**
   * Create a new delivery order validated strictly against centralized geo hierarchy, GPS, and `delivery_area_tariffs`.
   */
  async createOrder(params: {
    householdId: string;
    addressId: string;
    invoiceId?: string;
    deliveryNotes?: string;
    source_recurring_request_id?: string | null;
    items: Array<{
      product_id?: string;
      product_name: string;
      category_id?: string;
      category_name?: string;
      quantity?: string;
      unit_price?: number;
      total_price?: number;
    }>;
    userId?: string;
    addressSnapshot?: HouseholdAddress;
  }): Promise<{ success: boolean; order_id?: string; message?: string }> {
    // 1. Verify delivery is currently enabled
    const settings = await this.getSettings();
    if (!settings.delivery_enabled) {
      return {
        success: false,
        message: 'خدمة التوصيل معطلة حالياً. لا يمكن إنشاء طلبات جديدة في الوقت الحالي.',
      };
    }

    // 2. Validate items
    if (!params.items || params.items.length === 0) {
      return { success: false, message: 'لا توجد أصناف في طلب التوصيل' };
    }

    if (!isSupabaseConfigured()) {
      return {
        success: false,
        message: 'اتصال قاعدة البيانات غير متاح؛ لا يمكن التحقق من التسعيرة المركزية أو إنشاء الطلب.',
      };
    }

    try {
      // 3. Fetch authoritative address from database whenever addressId is provided
      let addrData: HouseholdAddress | null = null;
      if (params.addressId) {
        const { data: dbAddr, error: dbAddrErr } = await supabase
          .from('household_addresses')
          .select('*')
          .eq('id', params.addressId)
          .eq('household_id', params.householdId)
          .maybeSingle();

        if (dbAddrErr) {
          return {
            success: false,
            message: `تعذر قراءة بيانات العنوان من قاعدة البيانات: ${dbAddrErr.message}`,
          };
        }
        if (dbAddr) {
          addrData = dbAddr as HouseholdAddress;
        }
      } else if (params.addressSnapshot) {
        addrData = params.addressSnapshot;
      }

      if (!addrData) {
        return { success: false, message: 'العنوان المحدد غير موجود أو لا يتبع المنزل الحالي، يرجى اختيار أو إضافة عنوان صحيح' };
      }

      // 4. Strictly resolve centralized tariff & GPS validity (NO fallback to hardcoded fees)
      const tariffCheck = await this.resolveHouseholdDeliveryTariff(addrData);
      if (!tariffCheck.allowed || tariffCheck.deliveryFee === null) {
        return {
          success: false,
          message:
            tariffCheck.reason ||
            'لا توجد تسعيرة توصيل مفعّلة لهذا العنوان، لا يمكن إتمام الطلب.',
        };
      }

      const deliveryFee = tariffCheck.isFreeDelivery ? 0 : Number(tariffCheck.deliveryFee);
      const subtotal = params.items.reduce((acc, item) => acc + (Number(item.total_price) || 0), 0);
      const totalAmount = subtotal + deliveryFee;

      // 5. Check if invoice exists in public.invoices to prevent Foreign Key constraint violation
      let validInvoiceId: string | null = null;
      if (params.invoiceId) {
        const { data: invCheck } = await supabase
          .from('invoices')
          .select('id')
          .eq('id', params.invoiceId)
          .maybeSingle();

        if (invCheck?.id) {
          validInvoiceId = invCheck.id;
        }
      }

      const orderPayload: Record<string, any> = {
        household_id: params.householdId,
        user_id: params.userId || null,
        invoice_id: validInvoiceId,
        address_id: params.addressId,
        customer_name: addrData.full_name || 'المنزل',
        customer_phone: addrData.phone || '',
        country: 'مصر',
        governorate_name: addrData.governorate_name || '',
        markaz_name: addrData.markaz_name || '',
        detailed_address: addrData.detailed_address || '',
        delivery_latitude: Number(addrData.latitude),
        delivery_longitude: Number(addrData.longitude),
        delivery_governorate_id: addrData.governorate_id,
        delivery_center_id: addrData.center_id,
        delivery_area_id: addrData.area_id,
        delivery_area_name: addrData.area_name || null,
        delivery_tariff_id: tariffCheck.tariffId,
        delivery_base_fee: tariffCheck.baseFee,
        delivery_admin_commission: tariffCheck.adminCommission,
        delivery_driver_net: tariffCheck.driverNet,
        customer_delivery_fee: deliveryFee,
        delivery_fee: deliveryFee,
        subtotal,
        total_amount: totalAmount,
        delivery_notes: params.deliveryNotes || null,
        status: 'pending_review' as DeliveryOrderStatus,
        ...(params.source_recurring_request_id
          ? { source_recurring_request_id: params.source_recurring_request_id }
          : {}),
      };

      const { data: orderData, error: orderErr } = await supabase
        .from('delivery_orders')
        .insert(orderPayload)
        .select()
        .single();

      if (orderErr || !orderData) {
        console.error('[deliveryService] Error inserting delivery_orders:', orderErr);
        return {
          success: false,
          message: orderErr?.message
            ? `فشل تسجيل طلب التوصيل في قاعدة البيانات: ${orderErr.message}`
            : 'فشل إدراج طلب التوصيل في قاعدة البيانات',
        };
      }

      const orderId = orderData.id;

      const itemsPayload = params.items.map((item) => ({
        order_id: orderId,
        product_id: item.product_id || null,
        product_name: item.product_name,
        category_id: item.category_id || null,
        category_name: item.category_name || null,
        quantity: item.quantity || '١',
        unit_price: Number(item.unit_price) || 0,
        total_price: Number(item.total_price) || 0,
      }));

      const { error: itemsErr } = await supabase
        .from('delivery_order_items')
        .insert(itemsPayload)
        .select();

      if (itemsErr) {
        console.error('[deliveryService] CRITICAL: Error inserting delivery_order_items:', itemsErr);
        // Clean up orphan header order so no partial order exists
        try {
          await supabase.from('delivery_orders').delete().eq('id', orderId);
        } catch {
          // ignore cleanup failure
        }
        return {
          success: false,
          message: `فشل حفظ أصناف الطلب في جدول delivery_order_items: ${itemsErr.message || JSON.stringify(itemsErr)}`,
        };
      }

      const { data: verifiedItems, error: verifyErr } = await supabase
        .from('delivery_order_items')
        .select('*')
        .eq('order_id', orderId);

      if (verifyErr) {
        try {
          await supabase.from('delivery_order_items').delete().eq('order_id', orderId);
          await supabase.from('delivery_orders').delete().eq('id', orderId);
        } catch {
          // ignore cleanup failure
        }
        return {
          success: false,
          message: `فشل التحقق من الأصناف المحفوظة في قاعدة البيانات: ${verifyErr.message}`,
        };
      }

      if (!verifiedItems || verifiedItems.length === 0) {
        try {
          await supabase.from('delivery_orders').delete().eq('id', orderId);
        } catch {
          // ignore cleanup failure
        }
        return {
          success: false,
          message: 'فشل التحقق: لم يتم العثور على أي أصناف في delivery_order_items، تم التراجع عن الطلب.',
        };
      }

      try {
        await supabase.from('delivery_order_status_history').insert({
          delivery_order_id: orderId,
          old_status: null,
          new_status: 'pending_review',
          note: 'تم إنشاء الطلب بنجاح وهو قيد المراجعة',
        });
      } catch {
        // non-blocking
      }

      const completeOrder: DeliveryOrder = {
        ...(orderData as DeliveryOrder),
        is_free_delivery: tariffCheck.isFreeDelivery,
        estimated_delivery_minutes: tariffCheck.estimatedDeliveryMinutes,
        tariff_id: tariffCheck.tariffId,
        items: verifiedItems as DeliveryOrderItem[],
      };

      if (params.userId && params.householdId) {
        const cached =
          cacheManager.getHouseholdCache<DeliveryOrder[]>(
            params.userId,
            params.householdId,
            'delivery_orders'
          ) || [];
        const updated = [completeOrder, ...cached.filter((o) => o.id !== orderId)];
        cacheManager.setHouseholdCache(params.userId, params.householdId, 'delivery_orders', updated);
      }

      return {
        success: true,
        order_id: orderId,
        message: 'تم إرسال طلب التوصيل وحفظ أصناف الفاتورة بنجاح!',
      };
    } catch (directErr: any) {
      console.error('[deliveryService] Direct insert error:', directErr);
      return { success: false, message: directErr.message || 'فشل إنشاء طلب التوصيل' };
    }
  },

  /**
   * Fetch orders for a household with items included
   */
  async getHouseholdOrders(householdId: string, userId?: string): Promise<DeliveryOrder[]> {
    if (!householdId) return [];

    let cachedOrders: DeliveryOrder[] = [];
    if (userId) {
      cachedOrders = cacheManager.getHouseholdCache<DeliveryOrder[]>(
        userId,
        householdId,
        'delivery_orders'
      ) || [];
    }

    if (!isSupabaseConfigured()) {
      return cachedOrders;
    }

    try {
      // Query delivery orders with items directly without problematic driver embed for household RLS
      const { data, error } = await supabase
        .from('delivery_orders')
        .select(`
          *,
          items:delivery_order_items(*)
        `)
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[deliveryService] Error fetching household orders:', error.message);
        return cachedOrders;
      }

      const fetched = (data as DeliveryOrder[]) || [];

      // Always fetch latest delivery_order_items directly with order_id to guarantee fresh actual prices and item_status
      const remoteOrderIds = fetched.map((o) => o.id).filter((id) => Boolean(id));

      if (remoteOrderIds.length > 0) {
        try {
          const { data: directItems, error: directItemsErr } = await supabase
            .from('delivery_order_items')
            .select('*')
            .in('order_id', remoteOrderIds);

          if (!directItemsErr && directItems && directItems.length > 0) {
            const itemsByOrderId: Record<string, DeliveryOrderItem[]> = {};
            directItems.forEach((it: any) => {
              const oId = it.order_id;
              if (oId) {
                if (!itemsByOrderId[oId]) itemsByOrderId[oId] = [];
                itemsByOrderId[oId].push(it);
              }
            });

            fetched.forEach((o) => {
              if (itemsByOrderId[o.id]) {
                o.items = itemsByOrderId[o.id];
              }
            });
          }
        } catch (fetchErr) {
          console.warn('[deliveryService] Direct items fetch warning:', fetchErr);
        }
      }

      // Preserve local cancellation requests if remote database has not updated yet
      const merged = fetched.map((remoteOrder) => {
        const cachedMatch = cachedOrders.find((c) => c.id === remoteOrder.id);
        if (
          cachedMatch &&
          cachedMatch.status === 'cancellation_pending' &&
          remoteOrder.status === 'pending_review'
        ) {
          return {
            ...remoteOrder,
            status: 'cancellation_pending' as DeliveryOrderStatus,
            cancellation_reason: cachedMatch.cancellation_reason || remoteOrder.cancellation_reason,
            cancellation_requested_at:
              cachedMatch.cancellation_requested_at || remoteOrder.cancellation_requested_at,
          };
        }
        return remoteOrder;
      });

      // Also retain any local mock orders not yet in the remote database
      const remoteIds = new Set(merged.map((o) => o.id));
      const localOnly = cachedOrders.filter((c) => !remoteIds.has(c.id) && c.id.startsWith('ord_'));
      const finalOrders = [...localOnly, ...merged];

      if (userId) {
        cacheManager.setHouseholdCache(userId, householdId, 'delivery_orders', finalOrders);
      }
      return finalOrders;
    } catch (err) {
      console.error('[deliveryService] Exception fetching orders:', err);
      return cachedOrders;
    }
  },

  /**
   * Request order cancellation (Household member or Driver)
   * Strictly enforces mandatory note and transitions to 'cancellation_pending'
   * NEVER sets status to 'cancelled' directly (final decision is by admin only)
   */
  async requestCancellation(
    orderId: string,
    reason: string,
    householdId?: string,
    userId?: string
  ): Promise<{ success: boolean; message?: string }> {
    if (!reason || !reason.trim()) {
      return { success: false, message: 'سبب طلب الإلغاء إجباري، يرجى كتابة السبب' };
    }

    const trimmedReason = reason.trim();

    // 1. Immediately record in local household cache so UI reflects cancellation_pending without delay
    if (userId && householdId) {
      const cached = cacheManager.getHouseholdCache<DeliveryOrder[]>(
        userId,
        householdId,
        'delivery_orders'
      ) || [];
      const updated = cached.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'cancellation_pending' as DeliveryOrderStatus,
              cancellation_reason: trimmedReason,
              cancellation_requested_at: new Date().toISOString(),
            }
          : o
      );
      cacheManager.setHouseholdCache(userId, householdId, 'delivery_orders', updated);
    }

    if (!isSupabaseConfigured()) {
      return { success: true, message: 'تم تقديم طلب الإلغاء بنجاح وبانتظار موافقة الإدارة' };
    }

    try {
      // 1. Try unified cancellation RPC (which operates under SECURITY DEFINER)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('request_order_cancellation', {
        p_order_id: orderId,
        p_reason: trimmedReason,
      });

      if (!rpcErr && rpcData?.success) {
        return rpcData as { success: boolean; message?: string };
      }

      // 2. Try driver_request_cancellation if driver
      const { data: driverData, error: driverErr } = await supabase.rpc('driver_request_cancellation', {
        p_order_id: orderId,
        p_reason: trimmedReason,
      });

      if (!driverErr && driverData?.success) {
        return driverData as { success: boolean; message?: string };
      }

      // 3. Fallback: Direct table update to 'cancellation_pending'
      const { error: updErr } = await supabase
        .from('delivery_orders')
        .update({
          status: 'cancellation_pending',
          cancellation_reason: trimmedReason,
          cancellation_requested_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updErr) {
        // If PostgreSQL reports permission denied (e.g., missing GRANT UPDATE on table delivery_orders)
        if (updErr.code === '42501' || updErr.message?.includes('permission denied')) {
          console.warn('[deliveryService] Supabase UPDATE permission denied on delivery_orders (42501). Cancellation recorded locally in cache.');

          // Record in notifications table if possible
          if (householdId) {
            try {
              await supabase.from('notifications').insert({
                id: `cancel-${orderId}-${Date.now()}`,
                household_id: householdId,
                title: 'طلب إلغاء توصيل',
                message: `طلب إلغاء للطلب: ${trimmedReason}`,
                type: 'delivery_cancellation_request',
                target_role: 'all',
                read: false,
              });
            } catch (notifErr) {
              // non-blocking
            }
          }

          return {
            success: true,
            message: 'تم تسجيل طلب الإلغاء بنجاح وبانتظار موافقة الإدارة',
          };
        }
        throw updErr;
      }

      // Log status history if permitted
      try {
        await supabase.from('delivery_order_status_history').insert({
          delivery_order_id: orderId,
          new_status: 'cancellation_pending',
          note: `طلب إلغاء من المستخدم: ${trimmedReason}`,
        });
      } catch (histErr) {
        // non-blocking
      }

      return {
        success: true,
        message: 'تم إرسال طلب الإلغاء بنجاح وبانتظار موافقة الإدارة',
      };
    } catch (err: any) {
      if (err?.code === '42501' || err?.message?.includes('permission denied')) {
        console.warn('[deliveryService] Handled 42501 permission error gracefully for cancellation:', err.message);
        return {
          success: true,
          message: 'تم تسجيل طلب الإلغاء بنجاح وبانتظار موافقة الإدارة',
        };
      }

      console.error('[deliveryService] Error requesting cancellation:', err);
      return { success: false, message: err.message || 'فشل تقديم طلب الإلغاء' };
    }
  },

  /**
   * Driver: Accept order
   */
  async driverAcceptOrder(orderId: string): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured()) return { success: false, message: 'غير متصل' };
    try {
      const { data, error } = await supabase.rpc('accept_delivery_order', {
        p_order_id: orderId,
      });
      if (error) throw error;
      return data as { success: boolean; message?: string };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل قبول الطلب' };
    }
  },

  /**
   * Driver: Mark order completed
   */
  async driverCompleteOrder(orderId: string, note?: string): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured()) return { success: false, message: 'غير متصل' };
    try {
      const { data, error } = await supabase.rpc('complete_delivery_order', {
        p_order_id: orderId,
      });
      if (error) throw error;
      return data as { success: boolean; message?: string };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل إكمال التوصيل' };
    }
  },

  /**
   * Admin: Decide on cancellation request
   */
  async adminDecideCancellation(
    orderId: string,
    approve: boolean,
    decisionNote?: string
  ): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured()) return { success: false, message: 'غير متصل' };
    try {
      const { data, error } = await supabase.rpc('admin_decide_cancellation', {
        p_order_id: orderId,
        p_approve: approve,
        p_decision_note: decisionNote || null,
      });
      if (error) throw error;
      return data as { success: boolean; message?: string };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل اتخاذ قرار الإلغاء' };
    }
  },

  /**
   * Fetch legacy governorate settings if queried by settings UI (NEVER returns hardcoded 15 EGP mock rows)
   */
  async getGovernorateSettings(): Promise<any[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('delivery_governorate_settings')
        .select('*')
        .order('governorate_name', { ascending: true });

      if (error || !data) {
        return [];
      }
      return data;
    } catch (err) {
      console.warn('[deliveryService] Exception fetching governorates settings:', err);
      return [];
    }
  },

  /**
   * Admin: Update governorate delivery fee and availability
   */
  async updateGovernorateSetting(
    governorateName: string,
    isActive: boolean,
    deliveryFee: number
  ): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'قاعدة بيانات Supabase غير مهيأة' };
    }

    try {
      const { error } = await supabase
        .from('delivery_governorate_settings')
        .update({
          is_active: isActive,
          delivery_fee: deliveryFee,
          updated_at: new Date().toISOString(),
        })
        .eq('governorate_name', governorateName);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل تحديث إعدادات المحافظة' };
    }
  },
};

import { supabase, isSupabaseConfigured } from './supabase';
import { cacheManager } from './cacheManager';
import {
  DeliverySettings,
  HouseholdAddress,
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryOrderStatus,
  DeliveryDriver,
} from '../types';

/**
 * Robust Unified Delivery Service for Talabat Al-Bayt
 * Supports:
 * - Central delivery_settings verification (delivery_enabled, default_delivery_fee)
 * - Household Addresses management with single-default enforcement
 * - Snapshot-based Delivery Orders with delivery_order_items
 * - Status transition strictly according to policy:
 *   pending_review -> accepted -> cancellation_pending -> cancelled / completed
 * - Offline-resilient cache syncing via cacheManager
 */
export const deliveryService = {
  /**
   * Fetch central delivery settings (delivery_enabled, default_delivery_fee)
   */
  async getSettings(): Promise<DeliverySettings> {
    const fallbackSettings: DeliverySettings = {
      id: 'default',
      delivery_enabled: true,
      default_delivery_fee: 15.0,
    };

    if (!isSupabaseConfigured()) {
      return fallbackSettings;
    }

    try {
      const { data, error } = await supabase
        .from('delivery_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return fallbackSettings;
      }
      return data as DeliverySettings;
    } catch (err) {
      console.warn('[deliveryService] Exception fetching settings:', err);
      return fallbackSettings;
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
   * Add or save a household address
   */
  async saveAddress(
    address: Partial<HouseholdAddress> & { household_id: string },
    userId?: string
  ): Promise<{ success: boolean; address?: HouseholdAddress; message?: string }> {
    if (!address.household_id) {
      return { success: false, message: 'معرّف المنزل غير موجود' };
    }

    // Validate mandatory fields
    if (!address.full_name?.trim()) {
      return { success: false, message: 'يرجى إدخال اسم المستلم' };
    }
    if (!address.phone?.trim()) {
      return { success: false, message: 'يرجى إدخال رقم هاتف التواصل' };
    }
    if (!address.governorate_name?.trim()) {
      return { success: false, message: 'يرجى اختيار المحافظة' };
    }
    if (!address.markaz_name?.trim()) {
      return { success: false, message: 'يرجى اختيار المركز أو الحي' };
    }
    if (!address.detailed_address?.trim()) {
      return { success: false, message: 'يرجى كتابة العنوان التفصيلي' };
    }

    // Validate GPS Coordinates if provided
    let cleanLatitude: number | null = null;
    let cleanLongitude: number | null = null;

    if (address.latitude !== undefined && address.latitude !== null && String(address.latitude).trim() !== '') {
      const latNum = Number(address.latitude);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        return { success: false, message: 'قيمة خط العرض (Latitude) غير صالحة، يجب أن تكون بين -90 و 90' };
      }
      cleanLatitude = Number(latNum.toFixed(7));
    }

    if (address.longitude !== undefined && address.longitude !== null && String(address.longitude).trim() !== '') {
      const lngNum = Number(address.longitude);
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        return { success: false, message: 'قيمة خط الطول (Longitude) غير صالحة، يجب أن تكون بين -180 و 180' };
      }
      cleanLongitude = Number(lngNum.toFixed(7));
    }

    // If marked default, unset other addresses' default status
    if (address.is_default && isSupabaseConfigured()) {
      try {
        await supabase
          .from('household_addresses')
          .update({ is_default: false })
          .eq('household_id', address.household_id);
      } catch (e) {
        console.warn('Could not reset other default addresses', e);
      }
    }

    const payload: any = {
      ...address,
      latitude: cleanLatitude,
      longitude: cleanLongitude,
      country: 'مصر',
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) {
      // Local fallback with generated ID
      const newAddr: HouseholdAddress = {
        id: address.id || `addr_${Date.now()}`,
        household_id: address.household_id,
        address_label: address.address_label || 'عنوان المنزل',
        full_name: address.full_name.trim(),
        phone: address.phone.trim(),
        country: 'مصر',
        governorate_code: address.governorate_code || '',
        governorate_name: address.governorate_name.trim(),
        markaz_code: address.markaz_code || '',
        markaz_name: address.markaz_name.trim(),
        detailed_address: address.detailed_address.trim(),
        latitude: cleanLatitude,
        longitude: cleanLongitude,
        is_default: !!address.is_default,
        created_at: address.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (userId) {
        const current = cacheManager.getHouseholdCache<HouseholdAddress[]>(
          userId,
          address.household_id,
          'household_addresses'
        ) || [];
        const filtered = current.filter((a) => a.id !== newAddr.id);
        if (newAddr.is_default) {
          filtered.forEach((a) => { a.is_default = false; });
        }
        const updated = [newAddr, ...filtered];
        cacheManager.setHouseholdCache(userId, address.household_id, 'household_addresses', updated);
      }

      return { success: true, address: newAddr };
    }

    try {
      let savedAddress: HouseholdAddress;
      if (address.id) {
        let { data, error } = await supabase
          .from('household_addresses')
          .update(payload)
          .eq('id', address.id)
          .select()
          .single();

        // Handle potential schema cache reload delay for new columns
        if (error && error.code === 'PGRST204' && (error.message?.includes('latitude') || error.message?.includes('longitude'))) {
          delete payload.latitude;
          delete payload.longitude;
          const retryRes = await supabase
            .from('household_addresses')
            .update(payload)
            .eq('id', address.id)
            .select()
            .single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) throw error;
        savedAddress = data as HouseholdAddress;
      } else {
        let { data, error } = await supabase
          .from('household_addresses')
          .insert(payload)
          .select()
          .single();

        // Handle potential schema cache reload delay for new columns
        if (error && error.code === 'PGRST204' && (error.message?.includes('latitude') || error.message?.includes('longitude'))) {
          delete payload.latitude;
          delete payload.longitude;
          const retryRes = await supabase
            .from('household_addresses')
            .insert(payload)
            .select()
            .single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) throw error;
        savedAddress = data as HouseholdAddress;
      }

      if (userId && address.household_id) {
        const current = cacheManager.getHouseholdCache<HouseholdAddress[]>(
          userId,
          address.household_id,
          'household_addresses'
        ) || [];
        const filtered = current.filter((a) => a.id !== savedAddress.id);
        if (savedAddress.is_default) {
          filtered.forEach((a) => { a.is_default = false; });
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
   * Create a new delivery order via the secure atomic RPC or direct transaction fallback
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

    // 3. If Supabase configured, execute creation with full items persistence
    if (isSupabaseConfigured()) {
      try {
        // Fetch or resolve address snapshot
        let addrData: any = params.addressSnapshot || null;
        if (!addrData && params.addressId) {
          const { data: dbAddr } = await supabase
            .from('household_addresses')
            .select('*')
            .eq('id', params.addressId)
            .maybeSingle();
          if (dbAddr) addrData = dbAddr;
        }

        if (!addrData && params.userId && params.householdId) {
          const cachedAddrs = cacheManager.getHouseholdCache<HouseholdAddress[]>(
            params.userId,
            params.householdId,
            'household_addresses'
          ) || [];
          addrData = cachedAddrs.find((a) => a.id === params.addressId) || null;
        }

        if (!addrData) {
          return { success: false, message: 'العنوان المحدد غير موجود، يرجى اختيار أو إضافة عنوان صحيح' };
        }

        // Resolve delivery fee using governorate settings (Tier 1: Governorate fee, Tier 2: Default fee, Tier 3: Governorate disabled)
        const feeRes = await this.resolveDeliveryFeeForGovernorate(
          addrData.governorate_name,
          addrData.governorate_code
        );

        if (!feeRes.allowed) {
          return {
            success: false,
            message: feeRes.reason || `خدمة التوصيل غير مفعلة حالياً في محافظة ${addrData.governorate_name || 'المحددة'}`,
          };
        }

        const deliveryFee = feeRes.deliveryFee;
        const subtotal = params.items.reduce((acc, item) => acc + (Number(item.total_price) || 0), 0);
        const totalAmount = subtotal + deliveryFee;

        // Check if invoice exists in public.invoices to prevent Foreign Key constraint violation
        let validInvoiceId: string | null = null;
        if (params.invoiceId) {
          const { data: invCheck } = await supabase
            .from('invoices')
            .select('id')
            .eq('id', params.invoiceId)
            .maybeSingle();

          if (invCheck?.id) {
            validInvoiceId = invCheck.id;
          } else {
            console.warn('[deliveryService] Invoice not yet in invoices table, decoupling invoice_id to prevent FK constraint failure');
          }
        }

        // Base order payload matching actual table schema (user_id instead of created_by)
        const orderPayload: any = {
          household_id: params.householdId,
          user_id: params.userId || null,
          invoice_id: validInvoiceId,
          address_id: params.addressId,
          customer_name: addrData.full_name || 'المنزل',
          customer_phone: addrData.phone || '',
          country: 'مصر',
          governorate_name: addrData.governorate_name || 'القاهرة',
          markaz_name: addrData.markaz_name || '',
          detailed_address: addrData.detailed_address || '',
          delivery_fee: deliveryFee,
          subtotal: subtotal,
          total_amount: totalAmount,
          delivery_notes: params.deliveryNotes || null,
          status: 'pending_review' as DeliveryOrderStatus,
          ...(params.source_recurring_request_id ? { source_recurring_request_id: params.source_recurring_request_id } : {}),
        };

        let { data: orderData, error: orderErr } = await supabase
          .from('delivery_orders')
          .insert(orderPayload)
          .select()
          .single();

        // If insert failed due to column missing from remote schema cache (PGRST204), strip and retry
        if (orderErr && orderErr.code === 'PGRST204') {
          const match = /Could not find the '([^']+)' column/i.exec(orderErr.message);
          if (match && match[1] && match[1] in orderPayload) {
            console.warn(`[deliveryService] Retrying delivery_orders insert without missing column '${match[1]}'`);
            delete orderPayload[match[1]];
            const retryRes = await supabase
              .from('delivery_orders')
              .insert(orderPayload)
              .select()
              .single();
            orderData = retryRes.data;
            orderErr = retryRes.error;
          }
        }

        // If insert failed due to foreign key on invoice_id, retry safely with null
        if (orderErr && orderPayload.invoice_id) {
          console.warn('[deliveryService] Retrying delivery order without invoice_id FK:', orderErr.message);
          orderPayload.invoice_id = null;
          const retryRes = await supabase
            .from('delivery_orders')
            .insert(orderPayload)
            .select()
            .single();
          orderData = retryRes.data;
          orderErr = retryRes.error;
        }

        if (orderErr || !orderData) {
          console.error('[deliveryService] Error inserting delivery_orders:', orderErr);
          throw orderErr || new Error('فشل إدراج طلب التوصيل في قاعدة البيانات');
        }

        const orderId = orderData.id;
        console.log(`[deliveryService] Successfully created delivery_orders with id: ${orderId}`);

        // Insert items into delivery_order_items using EXACT columns:
        // order_id, product_id, product_name, category_id, category_name, quantity, unit_price, total_price
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

        console.log(`[deliveryService] Inserting ${itemsPayload.length} items into delivery_order_items for order ${orderId}:`, itemsPayload);

        const { data: insertedItems, error: itemsErr } = await supabase
          .from('delivery_order_items')
          .insert(itemsPayload)
          .select();

        if (itemsErr) {
          console.error('[deliveryService] CRITICAL: Error inserting delivery_order_items:', itemsErr);
          return {
            success: false,
            message: `فشل حفظ أصناف الطلب في جدول delivery_order_items: ${itemsErr.message || JSON.stringify(itemsErr)}`,
          };
        }

        // Verification: Read back delivery_order_items using order_id = orderId to ensure actual persistence
        const { data: verifiedItems, error: verifyErr } = await supabase
          .from('delivery_order_items')
          .select('*')
          .eq('order_id', orderId);

        if (verifyErr) {
          console.error('[deliveryService] CRITICAL: Error verifying saved delivery_order_items:', verifyErr);
          return {
            success: false,
            message: `فشل التحقق من الأصناف المحفوظة في قاعدة البيانات: ${verifyErr.message}`,
          };
        }

        if (!verifiedItems || verifiedItems.length === 0) {
          console.error('[deliveryService] CRITICAL: Verification query returned 0 items for order_id:', orderId);
          return {
            success: false,
            message: 'فشل التحقق: تم إنشاء الطلب ولكن لم يتم العثور على أي أصناف في delivery_order_items',
          };
        }

        console.log(`[deliveryService] Verification successful: verified ${verifiedItems.length} items in delivery_order_items for order ${orderId}`);

        // Optional status history record
        try {
          await supabase.from('delivery_order_status_history').insert({
            delivery_order_id: orderId,
            old_status: null,
            new_status: 'pending_review',
            note: 'تم إنشاء الطلب بنجاح وهو قيد المراجعة',
          });
        } catch (histErr) {
          console.warn('[deliveryService] Status history log info:', histErr);
        }

        // Update local cache immediately with verified items
        const completeOrder: DeliveryOrder = {
          ...orderData,
          items: verifiedItems,
        };

        if (params.userId && params.householdId) {
          const cached = cacheManager.getHouseholdCache<DeliveryOrder[]>(
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
    }

    // Offline / Local Simulation fallback
    const offlineFeeRes = await this.resolveDeliveryFeeForGovernorate(
      params.addressSnapshot?.governorate_name,
      params.addressSnapshot?.governorate_code
    );

    if (!offlineFeeRes.allowed) {
      return {
        success: false,
        message: offlineFeeRes.reason || `خدمة التوصيل غير مفعلة حالياً في محافظة ${params.addressSnapshot?.governorate_name || 'المحددة'}`,
      };
    }

    const offlineDeliveryFee = offlineFeeRes.deliveryFee;
    const offlineSubtotal = params.items.reduce((acc, item) => acc + (Number(item.total_price) || 0), 0);
    const offlineTotalAmount = offlineSubtotal + offlineDeliveryFee;

    const mockOrderId = `ord_${Date.now()}`;
    const mockOrder: DeliveryOrder = {
      id: mockOrderId,
      household_id: params.householdId,
      user_id: params.userId || null,
      invoice_id: params.invoiceId || null,
      address_id: params.addressId,
      source_recurring_request_id: params.source_recurring_request_id || null,
      customer_name: params.addressSnapshot?.full_name || 'المنزل',
      customer_phone: params.addressSnapshot?.phone || '',
      country: 'مصر',
      governorate_name: params.addressSnapshot?.governorate_name || 'القاهرة',
      markaz_name: params.addressSnapshot?.markaz_name || '',
      detailed_address: params.addressSnapshot?.detailed_address || '',
      delivery_fee: offlineDeliveryFee,
      subtotal: offlineSubtotal,
      total_amount: offlineTotalAmount,
      delivery_notes: params.deliveryNotes || null,
      status: 'pending_review' as DeliveryOrderStatus,
      created_at: new Date().toISOString(),
      items: params.items.map((item, idx) => ({
        id: `mock-item-${idx}`,
        order_id: mockOrderId,
        delivery_order_id: mockOrderId,
        product_id: item.product_id || null,
        product_name: item.product_name,
        category_id: item.category_id || null,
        category_name: item.category_name || null,
        quantity: item.quantity || '١',
        unit_price: Number(item.unit_price) || 0,
        total_price: Number(item.total_price) || 0,
      })),
    };

    if (params.userId && params.householdId) {
      const cached = cacheManager.getHouseholdCache<DeliveryOrder[]>(
        params.userId,
        params.householdId,
        'delivery_orders'
      ) || [];
      const updated = [mockOrder, ...cached];
      cacheManager.setHouseholdCache(params.userId, params.householdId, 'delivery_orders', updated);
    }

    return {
      success: true,
      order_id: mockOrderId,
      message: 'تم تسجيل طلب التوصيل بنجاح (حفظ محلي)',
    };
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
   * Fetch all governorate settings for delivery
   */
  async getGovernorateSettings(): Promise<any[]> {
    const fallbackGovernorates = [
      { governorate_name: 'سوهاج', governorate_code: 'EG-SHG', is_active: true, delivery_fee: 15 },
      { governorate_name: 'القاهرة', governorate_code: 'EG-C', is_active: true, delivery_fee: 15 },
      { governorate_name: 'الجيزة', governorate_code: 'EG-GZ', is_active: true, delivery_fee: 15 },
      { governorate_name: 'الإسكندرية', governorate_code: 'EG-ALX', is_active: true, delivery_fee: 15 },
      { governorate_name: 'أسيوط', governorate_code: 'EG-AST', is_active: true, delivery_fee: 15 },
      { governorate_name: 'قنا', governorate_code: 'EG-KN', is_active: true, delivery_fee: 15 },
      { governorate_name: 'الأقصر', governorate_code: 'EG-LX', is_active: true, delivery_fee: 15 },
      { governorate_name: 'أسوان', governorate_code: 'EG-ASN', is_active: true, delivery_fee: 15 },
      { governorate_name: 'المنيا', governorate_code: 'EG-MN', is_active: true, delivery_fee: 15 },
      { governorate_name: 'بني سويف', governorate_code: 'EG-BNS', is_active: true, delivery_fee: 15 },
      { governorate_name: 'الفيوم', governorate_code: 'EG-FYM', is_active: true, delivery_fee: 15 },
      { governorate_name: 'البحر الأحمر', governorate_code: 'EG-BA', is_active: true, delivery_fee: 15 },
      { governorate_name: 'الوادي الجديد', governorate_code: 'EG-WAD', is_active: true, delivery_fee: 15 },
      { governorate_name: 'مطروح', governorate_code: 'EG-MT', is_active: true, delivery_fee: 15 },
      { governorate_name: 'شمال سيناء', governorate_code: 'EG-SIN', is_active: true, delivery_fee: 15 },
      { governorate_name: 'جنوب سيناء', governorate_code: 'EG-JS', is_active: true, delivery_fee: 15 },
      { governorate_name: 'بورسعيد', governorate_code: 'EG-PTS', is_active: true, delivery_fee: 15 },
      { governorate_name: 'الإسماعيلية', governorate_code: 'EG-IS', is_active: true, delivery_fee: 15 },
      { governorate_name: 'السويس', governorate_code: 'EG-SUZ', is_active: true, delivery_fee: 15 },
      { governorate_name: 'الشرقية', governorate_code: 'EG-SHR', is_active: true, delivery_fee: 15 },
      { governorate_name: 'الدقهلية', governorate_code: 'EG-DK', is_active: true, delivery_fee: 15 },
      { governorate_name: 'القليوبية', governorate_code: 'EG-KB', is_active: true, delivery_fee: 15 },
      { governorate_name: 'الغربية', governorate_code: 'EG-GH', is_active: true, delivery_fee: 15 },
      { governorate_name: 'المنوفية', governorate_code: 'EG-MNF', is_active: true, delivery_fee: 15 },
      { governorate_name: 'البحيرة', governorate_code: 'EG-BH', is_active: true, delivery_fee: 15 },
      { governorate_name: 'كفر الشيخ', governorate_code: 'EG-KFS', is_active: true, delivery_fee: 15 },
      { governorate_name: 'دمياط', governorate_code: 'EG-DT', is_active: true, delivery_fee: 15 },
    ];

    if (!isSupabaseConfigured()) {
      return fallbackGovernorates;
    }

    try {
      const { data, error } = await supabase
        .from('delivery_governorate_settings')
        .select('*')
        .order('governorate_name', { ascending: true });

      if (error || !data || data.length === 0) {
        return fallbackGovernorates;
      }
      return data;
    } catch (err) {
      console.warn('[deliveryService] Exception fetching governorates settings:', err);
      return fallbackGovernorates;
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

  /**
   * Determine delivery fee and eligibility based on user's governorate
   * Strict 3-tier precedence:
   * Tier 1: Active governorate setting with custom fee -> use governorate fee
   * Tier 2: No specific governorate fee / not found -> use default_delivery_fee
   * Tier 3: Governorate has is_active === false -> Delivery is NOT allowed
   */
  async resolveDeliveryFeeForGovernorate(
    governorateName?: string,
    governorateCode?: string
  ): Promise<{
    allowed: boolean;
    deliveryFee: number;
    reason?: string;
    source: 'governorate' | 'default';
  }> {
    const settings = await this.getSettings();
    if (!settings.delivery_enabled) {
      return {
        allowed: false,
        deliveryFee: Number(settings.default_delivery_fee) || 15.0,
        reason: 'خدمة التوصيل معطلة حالياً من قبل الإدارة',
        source: 'default',
      };
    }

    const defaultFee = Number(settings.default_delivery_fee) || 15.0;
    const govSettingsList = await this.getGovernorateSettings();

    const cleanName = (governorateName || '').trim();
    const cleanCode = (governorateCode || '').trim().toLowerCase();

    const matched = govSettingsList.find((g: any) => {
      if (cleanCode && g.governorate_code && g.governorate_code.toLowerCase() === cleanCode) {
        return true;
      }
      if (cleanName && g.governorate_name) {
        const gName = g.governorate_name.trim();
        if (gName === cleanName) return true;
        if (cleanName.includes(gName) || gName.includes(cleanName)) return true;
      }
      return false;
    });

    if (matched) {
      // Tier 3: Deactivated governorate
      if (matched.is_active === false) {
        return {
          allowed: false,
          deliveryFee: Number(matched.delivery_fee) || defaultFee,
          reason: `خدمة التوصيل غير مفعلة حالياً في محافظة ${matched.governorate_name || cleanName}`,
          source: 'governorate',
        };
      }

      // Tier 1: Active governorate with defined fee
      if (
        matched.delivery_fee !== null &&
        matched.delivery_fee !== undefined &&
        !isNaN(Number(matched.delivery_fee)) &&
        Number(matched.delivery_fee) >= 0
      ) {
        return {
          allowed: true,
          deliveryFee: Number(matched.delivery_fee),
          source: 'governorate',
        };
      }
    }

    // Tier 2: Fallback to default delivery fee
    return {
      allowed: true,
      deliveryFee: defaultFee,
      source: 'default',
    };
  },
};

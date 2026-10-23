import { supabase, isSupabaseConfigured } from './supabase';
import { cacheManager } from './cacheManager';
import { syncManager } from './syncManager';
import {
  RecurringOrder,
  RecurringOrderItem,
  RecurringOrderFrequency,
  RecurringOrderRequest,
  RecurringOrderRequestItem,
} from '../types';

export const recurringOrderService = {
  /**
   * Fetch recurring orders templates for household (daily, weekly, monthly)
   */
  async getRecurringOrders(
    userId: string,
    householdId: string
  ): Promise<RecurringOrder[]> {
    const cached = cacheManager.getHouseholdCache<RecurringOrder[]>(
      userId,
      householdId,
      'recurring_orders'
    );

    if (!isSupabaseConfigured()) {
      return cached || [];
    }

    try {
      const { data, error } = await supabase
        .from('recurring_orders')
        .select(`
          *,
          items:recurring_order_items(*)
        `)
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        cacheManager.setHouseholdCache(
          userId,
          householdId,
          'recurring_orders',
          data as RecurringOrder[]
        );
        return data as RecurringOrder[];
      }
    } catch (err) {
      console.warn('[recurringOrderService] Error fetching recurring orders, using cache:', err);
    }

    return cached || [];
  },

  /**
   * Create or update a recurring order template with snapshot items
   */
  async createRecurringOrder(
    userId: string,
    householdId: string,
    orderData: {
      name: string;
      frequency: RecurringOrderFrequency;
      items: Array<{
        product_id?: string | null;
        product_name: string;
        category_id?: string | null;
        category_name?: string | null;
        quantity: string;
        unit?: string;
        estimated_unit_price?: number;
      }>;
    }
  ): Promise<{ success: boolean; order?: RecurringOrder; message?: string }> {
    const orderId = crypto.randomUUID();
    const newItems: RecurringOrderItem[] = orderData.items.map((it) => ({
      id: crypto.randomUUID(),
      recurring_order_id: orderId,
      product_id: it.product_id || null,
      product_name_snapshot: it.product_name,
      category_id: it.category_id || null,
      category_name_snapshot: it.category_name || null,
      quantity: it.quantity || '١',
      unit: it.unit || 'قطعة',
      estimated_unit_price: Number(it.estimated_unit_price) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const newOrder: RecurringOrder = {
      id: orderId,
      household_id: householdId,
      name: orderData.name,
      frequency: orderData.frequency,
      is_active: true,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: newItems,
    };

    // 1. Update local cache
    const cached = cacheManager.getHouseholdCache<RecurringOrder[]>(
      userId,
      householdId,
      'recurring_orders'
    ) || [];
    cacheManager.setHouseholdCache(userId, householdId, 'recurring_orders', [newOrder, ...cached]);

    // 2. Queue order creation in syncManager
    syncManager.enqueue({
      entity: 'recurring_orders',
      type: 'INSERT',
      recordId: orderId,
      payload: newOrder,
    });

    // 3. Queue item insertions
    for (const it of newItems) {
      syncManager.enqueue({
        entity: 'recurring_order_items',
        type: 'INSERT',
        recordId: it.id,
        payload: it,
      });
    }

    return { success: true, order: newOrder };
  },

  /**
   * Delete a recurring order template
   */
  async deleteRecurringOrder(
    userId: string,
    householdId: string,
    orderId: string
  ): Promise<{ success: boolean }> {
    const cached = cacheManager.getHouseholdCache<RecurringOrder[]>(
      userId,
      householdId,
      'recurring_orders'
    ) || [];
    cacheManager.setHouseholdCache(
      userId,
      householdId,
      'recurring_orders',
      cached.filter((o) => o.id !== orderId)
    );

    syncManager.enqueue({
      entity: 'recurring_orders',
      type: 'DELETE',
      recordId: orderId,
      payload: { id: orderId },
    });

    return { success: true };
  },

  /**
   * Create a Temporary Order Draft from a recurring order template ("اطلب الآن")
   * This clones snapshot items into recurring_order_request_items so user can
   * modify or remove items without affecting the original template.
   */
  async createOrderDraft(
    userId: string,
    householdId: string,
    recurringOrder: RecurringOrder,
    role: 'home' | 'admin',
    notes?: string
  ): Promise<{ success: boolean; request?: RecurringOrderRequest; message?: string }> {
    const requestId = crypto.randomUUID();
    const items = recurringOrder.items || [];

    const requestItems: RecurringOrderRequestItem[] = items.map((it) => ({
      id: crypto.randomUUID(),
      request_id: requestId,
      product_id: it.product_id || null,
      product_name: it.product_name_snapshot,
      category_id: it.category_id || null,
      category_name: it.category_name_snapshot || null,
      quantity: it.quantity,
      unit: it.unit,
      unit_price: it.estimated_unit_price || 0,
      total_price: (Number(it.quantity) || 1) * (it.estimated_unit_price || 0),
      is_modified: false,
      created_at: new Date().toISOString(),
    }));

    const newRequest: RecurringOrderRequest = {
      id: requestId,
      household_id: householdId,
      recurring_order_id: recurringOrder.id,
      created_by: userId,
      created_by_role: role,
      status: role === 'admin' ? 'submitted' : 'pending_review',
      notes: notes || `طلب مشتق من: ${recurringOrder.name}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: requestItems,
    };

    // Cache update
    const cached = cacheManager.getHouseholdCache<RecurringOrderRequest[]>(
      userId,
      householdId,
      'recurring_order_requests'
    ) || [];
    cacheManager.setHouseholdCache(
      userId,
      householdId,
      'recurring_order_requests',
      [newRequest, ...cached]
    );

    // Queue in syncManager
    syncManager.enqueue({
      entity: 'recurring_order_requests',
      type: 'INSERT',
      recordId: requestId,
      payload: newRequest,
    });

    for (const ri of requestItems) {
      syncManager.enqueue({
        entity: 'recurring_order_request_items',
        type: 'INSERT',
        recordId: ri.id,
        payload: ri,
      });
    }

    return { success: true, request: newRequest };
  },

  /**
   * Fetch recurring order draft requests (pending review or submitted)
   */
  async getOrderRequests(
    userId: string,
    householdId: string
  ): Promise<RecurringOrderRequest[]> {
    const cached = cacheManager.getHouseholdCache<RecurringOrderRequest[]>(
      userId,
      householdId,
      'recurring_order_requests'
    );

    if (!isSupabaseConfigured()) {
      return cached || [];
    }

    try {
      const { data, error } = await supabase
        .from('recurring_order_requests')
        .select(`
          *,
          items:recurring_order_request_items(*)
        `)
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        cacheManager.setHouseholdCache(
          userId,
          householdId,
          'recurring_order_requests',
          data as RecurringOrderRequest[]
        );
        return data as RecurringOrderRequest[];
      }
    } catch (err) {
      console.warn('[recurringOrderService] Error fetching order requests, using cache:', err);
    }

    return cached || [];
  },

  /**
   * Update items in a draft request (change quantity, delete an item)
   */
  async updateDraftItem(
    userId: string,
    householdId: string,
    requestId: string,
    itemId: string,
    updates: { quantity?: string; unit_price?: number; is_deleted?: boolean }
  ): Promise<{ success: boolean }> {
    const cached = cacheManager.getHouseholdCache<RecurringOrderRequest[]>(
      userId,
      householdId,
      'recurring_order_requests'
    ) || [];

    const updated = cached.map((req) => {
      if (req.id !== requestId) return req;
      let reqItems = req.items || [];
      if (updates.is_deleted) {
        reqItems = reqItems.filter((it) => it.id !== itemId);
      } else {
        reqItems = reqItems.map((it) => {
          if (it.id !== itemId) return it;
          const qty = updates.quantity !== undefined ? updates.quantity : it.quantity;
          const price = updates.unit_price !== undefined ? updates.unit_price : it.unit_price;
          return {
            ...it,
            quantity: qty,
            unit_price: price,
            total_price: (Number(qty) || 1) * price,
            is_modified: true,
          };
        });
      }
      return { ...req, items: reqItems, updated_at: new Date().toISOString() };
    });

    cacheManager.setHouseholdCache(userId, householdId, 'recurring_order_requests', updated);

    if (updates.is_deleted) {
      syncManager.enqueue({
        entity: 'recurring_order_request_items',
        type: 'DELETE',
        recordId: itemId,
        payload: { id: itemId },
      });
    } else {
      syncManager.enqueue({
        entity: 'recurring_order_request_items',
        type: 'UPDATE',
        recordId: itemId,
        payload: updates,
      });
    }

    return { success: true };
  },

  /**
   * Approve draft request and convert to Delivery Order (Admin Only)
   */
  async approveAndConvertToDeliveryOrder(
    requestId: string,
    addressId: string,
    deliveryNotes?: string
  ): Promise<{ success: boolean; orderId?: string; message?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'قاعدة بيانات Supabase غير مهيأة' };
    }

    try {
      const { data, error } = await supabase.rpc('approve_recurring_order_request', {
        p_request_id: requestId,
        p_address_id: addressId,
        p_delivery_notes: deliveryNotes || null,
      });

      if (error) throw error;
      const res = data as any;
      if (!res.success) {
        return { success: false, message: res.message || 'فشل تحويل المسودة إلى طلب دليفري' };
      }

      return { success: true, orderId: res.order_id };
    } catch (err: any) {
      console.warn('[recurringOrderService] Error approving request:', err);
      return { success: false, message: err.message || 'فشل اعتماد الطلب' };
    }
  },

  /**
   * Reject / Cancel draft request
   */
  async rejectDraftRequest(
    userId: string,
    householdId: string,
    requestId: string,
    reason?: string
  ): Promise<{ success: boolean }> {
    const cached = cacheManager.getHouseholdCache<RecurringOrderRequest[]>(
      userId,
      householdId,
      'recurring_order_requests'
    ) || [];

    const updated = cached.map((req) =>
      req.id === requestId
        ? { ...req, status: 'rejected' as const, review_notes: reason, updated_at: new Date().toISOString() }
        : req
    );

    cacheManager.setHouseholdCache(userId, householdId, 'recurring_order_requests', updated);

    syncManager.enqueue({
      entity: 'recurring_order_requests',
      type: 'UPDATE',
      recordId: requestId,
      payload: { status: 'rejected', review_notes: reason },
    });

    return { success: true };
  },
};

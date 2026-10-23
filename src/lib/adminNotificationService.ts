import { supabase, isSupabaseConfigured } from './supabase';
import {
  AdminNotification,
  AdminNotificationView,
} from '../types';

export const adminNotificationService = {
  /**
   * Fetch active admin notifications for the user/household
   */
  async getActiveNotifications(
    householdId: string,
    role: 'admin' | 'home',
    governorateName?: string,
    userId?: string
  ): Promise<AdminNotification[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('is_active', true)
        .lte('start_at', now)
        .or(`end_at.is.null,end_at.gte.${now}`)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      // Fetch user's view stats to filter out exceeded display counts or dismissed
      const { data: views } = await supabase
        .from('admin_notification_views')
        .select('*')
        .eq('household_id', householdId);

      const viewsMap = new Map<string, AdminNotificationView>();
      if (views) {
        views.forEach((v) => viewsMap.set(v.notification_id, v));
      }

      // Filter by targeting and max display count
      return (data as AdminNotification[]).filter((notif) => {
        // 1. Target scope filtering
        if (notif.target_scope === 'admin' && role !== 'admin') return false;
        if (notif.target_scope === 'home' && role !== 'home') return false;
        if (notif.target_scope === 'household' && notif.target_value && notif.target_value !== householdId) return false;
        if (notif.target_scope === 'governorate' && notif.target_value && notif.target_value !== governorateName) return false;
        if (notif.target_scope === 'user' && notif.target_value && userId && notif.target_value !== userId) return false;

        // 2. View count / dismissal filtering
        const view = viewsMap.get(notif.id);
        if (view) {
          if (view.dismissed_at) return false;
          if (view.display_count >= notif.max_display_count) return false;
        }

        return true;
      });
    } catch (err) {
      console.warn('[adminNotificationService] Error fetching notifications:', err);
      return [];
    }
  },

  /**
   * Record that a notification was displayed or dismissed
   */
  async recordViewOrDismiss(
    notificationId: string,
    householdId: string,
    deviceRole: string,
    isDismiss: boolean = false
  ): Promise<void> {
    if (!isSupabaseConfigured()) return;

    try {
      // 1. Try secure RPC first
      const { error: rpcErr } = await supabase.rpc('record_admin_notification_view', {
        p_notification_id: notificationId,
        p_household_id: householdId,
        p_device_role: deviceRole,
        p_is_dismiss: isDismiss,
      });

      if (!rpcErr) return;

      // 2. Direct table fallback if RPC is not deployed yet
      const { data: existing } = await supabase
        .from('admin_notification_views')
        .select('*')
        .eq('notification_id', notificationId)
        .eq('household_id', householdId)
        .maybeSingle();

      const now = new Date().toISOString();
      if (existing) {
        await supabase
          .from('admin_notification_views')
          .update({
            display_count: isDismiss ? existing.display_count : existing.display_count + 1,
            last_displayed_at: now,
            dismissed_at: isDismiss ? now : existing.dismissed_at,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('admin_notification_views')
          .insert({
            notification_id: notificationId,
            household_id: householdId,
            device_role: deviceRole,
            display_count: 1,
            last_displayed_at: now,
            dismissed_at: isDismiss ? now : null,
          });
      }
    } catch (err) {
      console.warn('[adminNotificationService] Error recording view:', err);
    }
  },

  /**
   * System Admin: Fetch all notifications
   */
  async getAllNotifications(): Promise<AdminNotification[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as AdminNotification[]) || [];
    } catch (err) {
      console.warn('[adminNotificationService] Error fetching all notifications:', err);
      return [];
    }
  },

  /**
   * System Admin: Create or update notification
   */
  async saveNotification(
    notification: Partial<AdminNotification>
  ): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'Supabase غير مهيأة' };
    }

    try {
      const payload: any = {
        ...notification,
        id: notification.id || crypto.randomUUID(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('admin_notifications').upsert(payload);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل حفظ الإشعار' };
    }
  },

  /**
   * System Admin: Delete notification
   */
  async deleteNotification(id: string): Promise<{ success: boolean }> {
    if (!isSupabaseConfigured()) return { success: false };

    try {
      const { error } = await supabase.from('admin_notifications').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  },
};

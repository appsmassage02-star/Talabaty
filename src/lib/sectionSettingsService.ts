import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { supabase, isSupabaseConfigured } from './supabase';

export const APP_SECTION_KEYS = ['household_shortages', 'pharmacy', 'ready_food'] as const;
export type AppSectionKey = (typeof APP_SECTION_KEYS)[number];

export const DELIVERY_STOPPED_BANNER_TEXT = 'خدمة التوصيل متوقفة مؤقتًا';

export interface AppSectionSetting {
  section_key: AppSectionKey;
  section_enabled: boolean;
  section_visible: boolean;
  delivery_enabled: boolean;
  updated_at?: string | null;
  loaded: boolean;
  error?: string | null;
}

export type AppSectionSettingsMap = Record<AppSectionKey, AppSectionSetting>;

export interface OrderGuardResult {
  allowed: boolean;
  code: 'OK' | 'SECTION_DISABLED' | 'DELIVERY_DISABLED' | 'UNAVAILABLE';
  reason?: string;
  setting: AppSectionSetting;
}

export function makeFailClosedSetting(
  sectionKey: AppSectionKey,
  error?: string | null
): AppSectionSetting {
  return {
    section_key: sectionKey,
    section_enabled: false,
    section_visible: false,
    delivery_enabled: false,
    updated_at: null,
    loaded: false,
    error: error || 'تعذر التحقق من إعدادات القسم من قاعدة البيانات.',
  };
}

export function makeInitialSettingsMap(): AppSectionSettingsMap {
  return {
    household_shortages: makeFailClosedSetting('household_shortages', null),
    pharmacy: makeFailClosedSetting('pharmacy', null),
    ready_food: makeFailClosedSetting('ready_food', null),
  };
}

function parseAppSectionRow(sectionKey: AppSectionKey, row: any): AppSectionSetting {
  if (!row || typeof row !== 'object') {
    return makeFailClosedSetting(
      sectionKey,
      `بيانات القسم (${sectionKey}) غير صالحة في app_section_settings.`
    );
  }

  if (
    typeof row.section_enabled !== 'boolean' ||
    typeof row.section_visible !== 'boolean' ||
    typeof row.delivery_enabled !== 'boolean'
  ) {
    return makeFailClosedSetting(
      sectionKey,
      `حقول التفعيل أو الظهور أو التوصيل غير مكتملة للقسم (${sectionKey}) في app_section_settings.`
    );
  }

  return {
    section_key: sectionKey,
    section_enabled: row.section_enabled === true,
    section_visible: row.section_visible === true,
    delivery_enabled: row.delivery_enabled === true,
    updated_at: row.updated_at || null,
    loaded: true,
    error: null,
  };
}

type SettingsListener = (map: AppSectionSettingsMap) => void;

class SectionSettingsService {
  // Strictly in-memory reactive snapshot initialized fail-closed (NEVER persisted to localStorage)
  private currentMap: AppSectionSettingsMap = makeInitialSettingsMap();
  private listeners = new Set<SettingsListener>();
  private realtimeChannel: any = null;
  private lifecycleCleanup: (() => void) | null = null;
  private activeSubscribersCount = 0;

  private notifyListeners(): void {
    const snapshot: AppSectionSettingsMap = {
      household_shortages: { ...this.currentMap.household_shortages },
      pharmacy: { ...this.currentMap.pharmacy },
      ready_food: { ...this.currentMap.ready_food },
    };
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn('[sectionSettingsService] Listener error:', err);
      }
    });
  }

  getSnapshot(): AppSectionSettingsMap {
    return {
      household_shortages: { ...this.currentMap.household_shortages },
      pharmacy: { ...this.currentMap.pharmacy },
      ready_food: { ...this.currentMap.ready_food },
    };
  }

  /**
   * Fetch a single section setting directly from `public.app_section_settings` (never affects other sections).
   * Fails closed on any connection/query/schema error.
   */
  async fetchSectionSetting(sectionKey: AppSectionKey): Promise<AppSectionSetting> {
    if (!isSupabaseConfigured() || !supabase) {
      const fail = makeFailClosedSetting(
        sectionKey,
        'اتصال قاعدة البيانات Supabase غير مهيأ؛ تعذر التحقق من حالة القسم.'
      );
      this.currentMap = { ...this.currentMap, [sectionKey]: fail };
      this.notifyListeners();
      return fail;
    }

    try {
      const { data, error } = await supabase
        .from('app_section_settings')
        .select('section_key, section_enabled, section_visible, delivery_enabled, updated_at')
        .eq('section_key', sectionKey)
        .maybeSingle();

      if (error) {
        const fail = makeFailClosedSetting(
          sectionKey,
          `تعذر قراءة إعدادات القسم (${sectionKey}) من قاعدة البيانات: ${error.message}`
        );
        this.currentMap = { ...this.currentMap, [sectionKey]: fail };
        this.notifyListeners();
        return fail;
      }

      if (!data) {
        const fail = makeFailClosedSetting(
          sectionKey,
          `سجل القسم (${sectionKey}) غير موجود في جدول app_section_settings.`
        );
        this.currentMap = { ...this.currentMap, [sectionKey]: fail };
        this.notifyListeners();
        return fail;
      }

      const parsed = parseAppSectionRow(sectionKey, data);
      this.currentMap = { ...this.currentMap, [sectionKey]: parsed };
      this.notifyListeners();
      return parsed;
    } catch (err: any) {
      const fail = makeFailClosedSetting(
        sectionKey,
        err?.message || `خطأ غير متوقع أثناء قراءة إعدادات القسم (${sectionKey}).`
      );
      this.currentMap = { ...this.currentMap, [sectionKey]: fail };
      this.notifyListeners();
      return fail;
    }
  }

  /**
   * Fetch all three client sections from `public.app_section_settings`.
   * Evaluates each section independently so a missing/invalid row in one section
   * NEVER disables or corrupts the other two sections.
   */
  async fetchAllSectionSettings(): Promise<AppSectionSettingsMap> {
    if (!isSupabaseConfigured() || !supabase) {
      const errMsg = 'اتصال قاعدة البيانات Supabase غير مهيأ؛ تعذر قراءة إعدادات الأقسام.';
      const failMap: AppSectionSettingsMap = {
        household_shortages: makeFailClosedSetting('household_shortages', errMsg),
        pharmacy: makeFailClosedSetting('pharmacy', errMsg),
        ready_food: makeFailClosedSetting('ready_food', errMsg),
      };
      this.currentMap = failMap;
      this.notifyListeners();
      return this.getSnapshot();
    }

    try {
      const { data, error } = await supabase
        .from('app_section_settings')
        .select('section_key, section_enabled, section_visible, delivery_enabled, updated_at')
        .in('section_key', [...APP_SECTION_KEYS]);

      if (error) {
        const errMsg = `تعذر قراءة جدول app_section_settings: ${error.message}`;
        const failMap: AppSectionSettingsMap = {
          household_shortages: makeFailClosedSetting('household_shortages', errMsg),
          pharmacy: makeFailClosedSetting('pharmacy', errMsg),
          ready_food: makeFailClosedSetting('ready_food', errMsg),
        };
        this.currentMap = failMap;
        this.notifyListeners();
        return this.getSnapshot();
      }

      const rows = Array.isArray(data) ? data : [];
      const rowByKey = new Map<string, any>();
      for (const row of rows) {
        if (row && typeof row.section_key === 'string') {
          rowByKey.set(row.section_key, row);
        }
      }

      const nextMap: AppSectionSettingsMap = {
        household_shortages: rowByKey.has('household_shortages')
          ? parseAppSectionRow('household_shortages', rowByKey.get('household_shortages'))
          : makeFailClosedSetting(
              'household_shortages',
              'سجل قسم نواقص المنزل غير موجود في app_section_settings.'
            ),
        pharmacy: rowByKey.has('pharmacy')
          ? parseAppSectionRow('pharmacy', rowByKey.get('pharmacy'))
          : makeFailClosedSetting(
              'pharmacy',
              'سجل قسم الصيدلية غير موجود في app_section_settings.'
            ),
        ready_food: rowByKey.has('ready_food')
          ? parseAppSectionRow('ready_food', rowByKey.get('ready_food'))
          : makeFailClosedSetting(
              'ready_food',
              'سجل قسم الأكلات الجاهزة غير موجود في app_section_settings.'
            ),
      };

      this.currentMap = nextMap;
      this.notifyListeners();
      return this.getSnapshot();
    } catch (err: any) {
      const errMsg = err?.message || 'خطأ في الاتصال أثناء قراءة إعدادات الأقسام.';
      const failMap: AppSectionSettingsMap = {
        household_shortages: makeFailClosedSetting('household_shortages', errMsg),
        pharmacy: makeFailClosedSetting('pharmacy', errMsg),
        ready_food: makeFailClosedSetting('ready_food', errMsg),
      };
      this.currentMap = failMap;
      this.notifyListeners();
      return this.getSnapshot();
    }
  }

  /**
   * Authoritative pre-order guard: ALWAYS reads fresh state directly from `public.app_section_settings`
   * right before creating any new delivery order.
   */
  async verifyOrderAllowed(sectionKey: AppSectionKey): Promise<OrderGuardResult> {
    const setting = await this.fetchSectionSetting(sectionKey);

    if (!setting.loaded) {
      return {
        allowed: false,
        code: 'UNAVAILABLE',
        reason:
          setting.error ||
          'تعذر التحقق من حالة الخدمة من قاعدة البيانات؛ لا يمكن إنشاء طلبات جديدة حالياً.',
        setting,
      };
    }

    if (!setting.section_enabled) {
      return {
        allowed: false,
        code: 'SECTION_DISABLED',
        reason: 'هذا القسم متوقف حالياً ولا يمكن بدء طلبات جديدة منه.',
        setting,
      };
    }

    if (!setting.delivery_enabled) {
      return {
        allowed: false,
        code: 'DELIVERY_DISABLED',
        reason: DELIVERY_STOPPED_BANNER_TEXT,
        setting,
      };
    }

    return {
      allowed: true,
      code: 'OK',
      setting,
    };
  }

  private ensureSubscriptionsStarted(): void {
    if (this.lifecycleCleanup) return;

    const cleanups: Array<() => void> = [];

    if (isSupabaseConfigured() && supabase) {
      try {
        this.realtimeChannel = supabase
          .channel('app_section_settings_live')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'app_section_settings' },
            (payload: any) => {
              const affectedKey = payload?.new?.section_key || payload?.old?.section_key;
              if (
                typeof affectedKey === 'string' &&
                (APP_SECTION_KEYS as readonly string[]).includes(affectedKey)
              ) {
                this.fetchSectionSetting(affectedKey as AppSectionKey).catch(() => {});
              } else {
                this.fetchAllSectionSettings().catch(() => {});
              }
            }
          )
          .subscribe();

        cleanups.push(() => {
          if (this.realtimeChannel && supabase) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
          }
        });
      } catch (err) {
        console.warn('[sectionSettingsService] Realtime setup notice:', err);
      }
    }

    if (typeof document !== 'undefined') {
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          this.fetchAllSectionSettings().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      cleanups.push(() => document.removeEventListener('visibilitychange', handleVisibility));
    }

    if (typeof window !== 'undefined') {
      const handleRefresh = () => {
        this.fetchAllSectionSettings().catch(() => {});
      };
      window.addEventListener('focus', handleRefresh);
      window.addEventListener('online', handleRefresh);
      cleanups.push(() => {
        window.removeEventListener('focus', handleRefresh);
        window.removeEventListener('online', handleRefresh);
      });
    }

    try {
      if (Capacitor?.isNativePlatform?.()) {
        let appListenerHandle: { remove: () => Promise<void> } | null = null;
        let disposed = false;
        CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            this.fetchAllSectionSettings().catch(() => {});
          }
        })
          .then((handle) => {
            if (disposed) {
              handle.remove().catch(() => {});
            } else {
              appListenerHandle = handle;
            }
          })
          .catch(() => {});

        cleanups.push(() => {
          disposed = true;
          appListenerHandle?.remove().catch(() => {});
        });
      }
    } catch {
      // Ignore outside Capacitor runtime
    }

    this.lifecycleCleanup = () => {
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
      this.lifecycleCleanup = null;
    };
  }

  /**
   * Subscribe to live reactive updates (Realtime + foreground/focus/online/appStateChange).
   */
  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    this.activeSubscribersCount += 1;
    this.ensureSubscriptionsStarted();

    return () => {
      this.listeners.delete(listener);
      this.activeSubscribersCount = Math.max(0, this.activeSubscribersCount - 1);
      if (this.activeSubscribersCount === 0 && this.lifecycleCleanup) {
        this.lifecycleCleanup();
      }
    };
  }
}

export const sectionSettingsService = new SectionSettingsService();

/**
 * Deterministic Secure Local-State & Cache Manager for Talabat Al-Bayt
 * 
 * Strict Invariant Rules:
 * 1. Cache is CACHE ONLY — never an authority for authentication, authorization, household membership, or permissions.
 * 2. All user and household data MUST be namespaced by authenticated `userId` and `householdId`.
 * 3. User A can NEVER access or hydrate User B's cache.
 * 4. Device preferences (e.g. theme, font size) are stored under device namespaces without sensitive user data.
 * 5. On startup and logout, all legacy global un-namespaced keys are permanently purged.
 */

export const CACHE_PREFIX = "talabat";

export type HouseholdCacheKey =
  | "missing_items"
  | "invoices"
  | "archived_months"
  | "budget"
  | "permissions"
  | "notifications"
  | "categories"
  | "custom_categories"
  | "household_info"
  | "members"
  | "delivery_orders"
  | "household_addresses"
  | "household_products"
  | "recurring_orders"
  | "recurring_order_requests"
  | "admin_notifications"
  | "delivery_governorate_settings"
  | "pharmacy_orders";

export type UserCacheKey = "profile" | "preferences" | "last_household_id" | "last_role" | "session" | "pharmacy_saved_prescriptions";

export type DevicePreferenceKey = "theme_mode" | "font_size" | "simulator_mode";

export type GlobalCatalogCacheKey = "global_categories" | "global_products" | "pharmacy_config";

// Helper to construct secure household-scoped cache keys
export const buildHouseholdCacheKey = (
  userId: string,
  householdId: string,
  key: HouseholdCacheKey
): string => {
  if (!userId || !householdId) {
    throw new Error(`[CacheManager] Cannot build household cache key without userId and householdId. Got: userId=${userId}, householdId=${householdId}`);
  }
  return `${CACHE_PREFIX}:cache:${userId}:${householdId}:${key}`;
};

// Helper to construct secure user-scoped cache keys
export const buildUserCacheKey = (userId: string, key: UserCacheKey): string => {
  if (!userId) {
    throw new Error(`[CacheManager] Cannot build user cache key without userId.`);
  }
  return `${CACHE_PREFIX}:cache:${userId}:${key}`;
};

// Helper to construct device-scoped preference keys (no sensitive data)
export const buildDeviceKey = (key: DevicePreferenceKey): string => {
  return `${CACHE_PREFIX}:device:${key}`;
};

export const cacheManager = {
  /**
   * Get user-scoped cache (e.g. last_household_id, profile)
   */
  getUserCache<T>(userId: string | undefined | null, key: UserCacheKey): T | null {
    if (!userId || typeof window === "undefined") return null;
    try {
      const fullKey = buildUserCacheKey(userId, key);
      const raw = localStorage.getItem(fullKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn(`[CacheManager] Error reading user cache for key ${key}:`, e);
      return null;
    }
  },

  /**
   * Set user-scoped cache
   */
  setUserCache<T>(userId: string | undefined | null, key: UserCacheKey, value: T): void {
    if (!userId || typeof window === "undefined") return;
    try {
      const fullKey = buildUserCacheKey(userId, key);
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch (e) {
      console.warn(`[CacheManager] Error saving user cache for key ${key}:`, e);
    }
  },

  /**
   * Remove user-scoped cache
   */
  removeUserCache(userId: string | undefined | null, key: UserCacheKey): void {
    if (!userId || typeof window === "undefined") return;
    try {
      const fullKey = buildUserCacheKey(userId, key);
      localStorage.removeItem(fullKey);
    } catch (e) {
      console.warn(`[CacheManager] Error removing user cache for key ${key}:`, e);
    }
  },

  /**
   * Get cached household data only if both userId and householdId match the authorized session
   */
  getHouseholdCache<T>(userId: string | undefined | null, householdId: string | undefined | null, key: HouseholdCacheKey): T | null {
    if (!userId || !householdId || typeof window === "undefined") return null;
    try {
      const fullKey = buildHouseholdCacheKey(userId, householdId, key);
      const raw = localStorage.getItem(fullKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn(`[CacheManager] Error reading household cache for key ${key}:`, e);
      return null;
    }
  },

  /**
   * Set cached household data strictly under the user+household namespace
   */
  setHouseholdCache<T>(userId: string | undefined | null, householdId: string | undefined | null, key: HouseholdCacheKey, value: T): void {
    if (!userId || !householdId || typeof window === "undefined") return;
    try {
      const fullKey = buildHouseholdCacheKey(userId, householdId, key);
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch (e) {
      console.warn(`[CacheManager] Error saving household cache for key ${key}:`, e);
    }
  },

  /**
   * Remove a specific household cache entry
   */
  removeHouseholdCache(userId: string | undefined | null, householdId: string | undefined | null, key: HouseholdCacheKey): void {
    if (!userId || !householdId || typeof window === "undefined") return;
    try {
      const fullKey = buildHouseholdCacheKey(userId, householdId, key);
      localStorage.removeItem(fullKey);
    } catch (e) {
      console.warn(`[CacheManager] Error removing household cache for key ${key}:`, e);
    }
  },

  /**
   * Invalidate ALL cached data for a specific household under a user
   */
  invalidateHouseholdCache(userId: string | undefined | null, householdId: string | undefined | null): void {
    if (!userId || !householdId || typeof window === "undefined") return;
    try {
      const prefix = `${CACHE_PREFIX}:cache:${userId}:${householdId}:`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn(`[CacheManager] Error invalidating household cache:`, e);
    }
  },

  /**
   * Invalidate ALL caches belonging to a user (across all households)
   */
  invalidateUserCache(userId: string | undefined | null): void {
    if (!userId || typeof window === "undefined") return;
    try {
      const prefix = `${CACHE_PREFIX}:cache:${userId}:`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn(`[CacheManager] Error invalidating user cache:`, e);
    }
  },

  /**
   * Get device-level preference (e.g. theme, font-size)
   */
  getDevicePreference<T>(key: DevicePreferenceKey, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
      const fullKey = buildDeviceKey(key);
      const raw = localStorage.getItem(fullKey);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  /**
   * Set device-level preference
   */
  setDevicePreference<T>(key: DevicePreferenceKey, value: T): void {
    if (typeof window === "undefined") return;
    try {
      const fullKey = buildDeviceKey(key);
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch (e) {
      console.warn(`[CacheManager] Error saving device preference ${key}:`, e);
    }
  },

  /**
   * Get global catalog cache (e.g. global_categories, global_products)
   */
  getGlobalCache<T>(key: GlobalCatalogCacheKey): T | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}:global:${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn(`[CacheManager] Error reading global cache for key ${key}:`, e);
      return null;
    }
  },

  /**
   * Set global catalog cache
   */
  setGlobalCache<T>(key: GlobalCatalogCacheKey, value: T): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`${CACHE_PREFIX}:global:${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn(`[CacheManager] Error saving global cache for key ${key}:`, e);
    }
  },

  /**
   * Remove global catalog cache
   */
  removeGlobalCache(key: GlobalCatalogCacheKey): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`${CACHE_PREFIX}:global:${key}`);
    } catch (e) {
      console.warn(`[CacheManager] Error removing global cache for key ${key}:`, e);
    }
  },

  /**
   * Wipe all user and household caches across all users
   */
  clearAllUserAndHouseholdCaches(): void {
    if (typeof window === "undefined") return;
    try {
      const prefix = `${CACHE_PREFIX}:cache:`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn(`[CacheManager] Error clearing user caches:`, e);
    }
  },

  /**
   * CRITICAL SECURITY PURGE:
   * Scans localStorage and permanently removes all legacy un-namespaced global keys
   * (e.g., talabat_missing_items, talabat_invoices, talabat_household, talabat_auth_session)
   */
  purgeLegacyGlobalKeys(): void {
    if (typeof window === "undefined") return;
    try {
      const legacyGlobalKeys = [
        "talabat_missing_items",
        "talabat_invoices",
        "talabat_budget",
        "talabat_permissions",
        "talabat_household",
        "talabat_active_role",
        "talabat_notifications",
        "talabat_archived_months",
        "talabat_categories",
        "talabat_auth_session",
        "talabat_mock_session",
        "talabat_user_profile",
      ];

      legacyGlobalKeys.forEach((key) => {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
        }
      });

      // Also clean up any other non-namespaced keys starting with "talabat_" that are not device preferences
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("talabat_") && !k.startsWith("talabat:device:")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn(`[CacheManager] Error purging legacy global keys:`, e);
    }
  },

  /**
   * Get the active user ID from device state (used for instant offline bootstrap)
   */
  getActiveUserId(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(`${CACHE_PREFIX}:auth:active_user_id`);
    } catch {
      return null;
    }
  },

  /**
   * Set the active user ID
   */
  setActiveUserId(userId: string): void {
    if (typeof window === "undefined" || !userId) return;
    try {
      localStorage.setItem(`${CACHE_PREFIX}:auth:active_user_id`, userId);
    } catch (e) {
      console.warn("[CacheManager] Error saving active user ID:", e);
    }
  },

  /**
   * Clear active session pointer (on logout)
   */
  clearActiveSession(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`${CACHE_PREFIX}:auth:active_user_id`);
    } catch (e) {
      console.warn("[CacheManager] Error clearing active user ID:", e);
    }
  },

  /**
   * Store user session securely in user namespace
   */
  setStoredSession(userId: string, session: any): void {
    if (!userId || !session) return;
    this.setUserCache(userId, "session", session);
    this.setActiveUserId(userId);
  },

  /**
   * Retrieve stored session for active user or provided userId
   */
  getStoredSession(userId?: string): any | null {
    const targetUserId = userId || this.getActiveUserId();
    if (!targetUserId) return null;
    return this.getUserCache(targetUserId, "session");
  },
};

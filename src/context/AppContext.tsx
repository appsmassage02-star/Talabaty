import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  UserRole,
  AuthStatus,
  HouseholdStatus,
  HouseholdMember,
  PairingToken,
  AppThemeMode,
  AppFontSize,
  HouseholdInfo,
  MissingItem,
  PurchaseInvoice,
  BudgetConfig,
  AppNotification,
  CategoryId,
  CategoryInfo,
  HomePermissions,
  SupabaseProfile,
  ArchivedMonthRecord,
  SyncState,
  SyncMetrics,
  HouseholdProduct,
  GlobalProduct,
  CatalogProduct,
  RecurringOrder,
  RecurringOrderItem,
  RecurringOrderFrequency,
  RecurringOrderRequest,
  RecurringOrderRequestItem,
  DeliveryGovernorateSetting,
  AdminNotification,
  DeliveryOrder,
} from "../types";
import { CATEGORIES } from "../data/categories";
import { playUrgentAlertRing } from "../utils/audioAlert";
import {
  generateProductId,
  addOrIncrementCartItem,
  incrementCartItem,
  decrementCartItem,
} from "../utils/cartHelpers";
import { supabase, isSupabaseConfigured, dbHelpers, dbService, usernameToEmail, generateInternalHomePhoneCredentials, reconcileLegacyUserMembership, ensureAdminHouseholdAndProvisioning } from "../lib/supabase";
import { cacheManager } from "../lib/cacheManager";
import { syncManager, SyncEntity } from "../lib/syncManager";
import { catalogService, mapGlobalCategoryToCategoryInfo, normalizeSubcategories } from "../lib/catalogService";
import { recurringOrderService } from "../lib/recurringOrderService";
import { adminNotificationService } from "../lib/adminNotificationService";
import { deliveryService } from "../lib/deliveryService";
import { User, Session } from "@supabase/supabase-js";
import confetti from "canvas-confetti";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { fcmService } from "../lib/fcmService";


interface IncomingAlertState {
  active: boolean;
  timestamp: string;
  message: string;
  from: string;
}

interface AppContextType {
  // Supabase Auth & Session Persistence (Single Authoritative Source: Supabase Auth)
  authStatus: AuthStatus;
  authError: string | null;
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  supabaseUser: User | null;
  supabaseSession: Session | null;
  supabaseProfile: SupabaseProfile | null;
  isSupabaseConnected: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<{ error: any; user?: User | null }>;
  signUpWithEmail: (
    email: string,
    pass: string,
    fullName: string,
    phone?: string,
    householdName?: string
  ) => Promise<{ error: any; user?: User | null; message?: string; requiresConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<{ error: any; data?: any }>;
  signInHomePhone: (username: string, pass: string) => Promise<{ error: any; user?: User | null }>;
  signUpHomePhone: (
    username: string,
    pass: string,
    deviceName?: string,
    pairCode?: string
  ) => Promise<{ error: any; user?: User | null; message?: string }>;
  signOutSupabase: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updateUserProfile: (updates: { fullName?: string; email?: string; phone?: string }) => Promise<{ error: any }>;
  updateUserPassword: (newPassword: string) => Promise<{ error: any }>;

  // Authoritative Household & Membership
  householdStatus: HouseholdStatus;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  household: HouseholdInfo | null;
  setHousehold: React.Dispatch<React.SetStateAction<HouseholdInfo | null>>;
  householdMembers: HouseholdMember[];
  fetchHouseholdMembers: () => Promise<void>;
  activePairingToken: PairingToken | null;
  generatePairingToken: (hoursValid?: number) => Promise<{ success: boolean; token?: string; error?: string }>;
  isPaired: boolean;
  createAdminHousehold: (name: string, adminName: string, adminPhone: string) => Promise<{ success: boolean; error?: string }>;
  pairHomePhone: (qrData: string) => boolean;
  joinHouseholdByCode: (code: string, memberName?: string) => Promise<{ success: boolean; message?: string; householdName?: string }>;
  disconnectHousehold: () => Promise<void>;

  // View state
  activeTab: "categories" | "missing" | "purchases" | "budget" | "settings" | "auth" | "profile" | "archive" | "pharmacy" | "food";
  setActiveTab: (tab: "categories" | "missing" | "purchases" | "budget" | "settings" | "auth" | "profile" | "archive" | "pharmacy" | "food") => void;
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  simulatorMode: "single" | "split";
  setSimulatorMode: (mode: "single" | "split") => void;

  // Categories & Real Photos Management
  categories: CategoryInfo[];
  refreshActiveStateFromCache: () => void;
  addCategory: (cat: CategoryInfo) => void;
  updateCategory: (id: string, updated: Partial<CategoryInfo>) => void;
  deleteCategory: (id: string) => void;
  addProductToCategory: (categoryId: string, productName: string, subcategoryId?: string) => void;
  updateProductInCategory: (categoryId: string, oldName: string, newName: string, newSubcategoryId?: string) => void;
  deleteProductFromCategory: (categoryId: string, productName: string) => void;

  // Home Phone Permissions
  homePermissions: HomePermissions;
  updateHomePermissions: (perms: HomePermissions) => void;

  // Missing items / Cart Operations
  missingItems: MissingItem[];
  addMissingItem: (item: Omit<MissingItem, "id" | "addedAt" | "completed">) => void;
  updateMissingItem: (id: string, updates: Partial<Omit<MissingItem, "id" | "addedAt">>) => void;
  incrementMissingItemQuantity: (id: string) => void;
  decrementMissingItemQuantity: (id: string) => void;
  toggleItemCompletion: (id: string) => void;
  deleteMissingItem: (id: string) => void;
  clearCompletedItems: () => void;

  // Purchases & Invoices
  invoices: PurchaseInvoice[];
  addInvoice: (
    invoice: Omit<PurchaseInvoice, "id" | "invoiceNumber">,
    completeItemIds?: string[]
  ) => { success: boolean; message?: string; invoiceId?: string; invoice?: PurchaseInvoice };
  deleteInvoice: (id: string) => void;
  updateInvoice: (id: string, updates: Partial<PurchaseInvoice>) => void;

  // Fiscal Month & Archiving
  archivedMonths: ArchivedMonthRecord[];
  endCurrentFiscalMonth: (nextMonthName?: string, nextBudgetLimit?: number) => void;
  clearAllArchives: () => void;
  deleteArchivedMonth: (id: string) => void;

  // Budget
  budgetConfig: BudgetConfig;
  updateBudgetLimit: (newLimit: number) => void;
  updateCurrency: (newCurrency: string) => void;
  totalSpent: number;
  remainingBudget: number;
  spentPercentage: number;
  householdOrders: DeliveryOrder[];

  // Notifications & Urgent Ring Alerts
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationsAsRead: () => void;
  clearNotifications: () => void;
  deleteNotification: (id: string) => void;
  incomingAlert: IncomingAlertState | null;
  sendHomeAttentionAlert: () => void;
  dismissIncomingAlert: () => void;

  // Modals
  isAiModalOpen: boolean;
  setIsAiModalOpen: (open: boolean) => void;
  isAddInvoiceModalOpen: boolean;
  setIsAddInvoiceModalOpen: (open: boolean) => void;
  isEndMonthModalOpen: boolean;
  setIsEndMonthModalOpen: (open: boolean) => void;
  isQrModalOpen: boolean;
  setIsQrModalOpen: (open: boolean) => void;
  isNotificationsModalOpen: boolean;
  setIsNotificationsModalOpen: (open: boolean) => void;
  isSupabaseAuthModalOpen: boolean;
  setIsSupabaseAuthModalOpen: (open: boolean) => void;
  isAboutModalOpen: boolean;
  setIsAboutModalOpen: (open: boolean) => void;
  isRecurringOrdersModalOpen: boolean;
  setIsRecurringOrdersModalOpen: (open: boolean) => void;
  isGovernoratesModalOpen: boolean;
  setIsGovernoratesModalOpen: (open: boolean) => void;
  isAdminNotifManagerModalOpen: boolean;
  setIsAdminNotifManagerModalOpen: (open: boolean) => void;

  // Household & Global Catalog
  globalProducts: GlobalProduct[];
  householdProducts: HouseholdProduct[];
  getCatalogProductsForCategory: (categoryId: string) => CatalogProduct[];
  addOrUpdateHouseholdProduct: (prod: {
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
  }) => Promise<{ success: boolean; product?: HouseholdProduct; message?: string }>;
  deleteHouseholdProduct: (productId: string) => Promise<{ success: boolean }>;
  seedHouseholdCatalog: () => Promise<{ success: boolean; message?: string }>;

  // Recurring Orders ("طلباتي")
  recurringOrders: RecurringOrder[];
  createRecurringOrder: (orderData: {
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
  }) => Promise<{ success: boolean; order?: RecurringOrder; message?: string }>;
  deleteRecurringOrder: (orderId: string) => Promise<{ success: boolean }>;
  orderRequests: RecurringOrderRequest[];
  createOrderDraft: (
    recurringOrder: RecurringOrder,
    notes?: string
  ) => Promise<{ success: boolean; request?: RecurringOrderRequest; message?: string }>;
  updateDraftItem: (
    requestId: string,
    itemId: string,
    updates: { quantity?: string; unit_price?: number; is_deleted?: boolean }
  ) => Promise<{ success: boolean }>;
  approveDraftRequest: (
    requestId: string,
    addressId: string,
    deliveryNotes?: string
  ) => Promise<{ success: boolean; orderId?: string; message?: string }>;
  rejectDraftRequest: (requestId: string, reason?: string) => Promise<{ success: boolean }>;

  // Admin Notifications (Banners & Modals)
  adminNotifications: AdminNotification[];
  dismissAdminNotification: (notificationId: string) => Promise<void>;
  refreshAdminNotifications: () => Promise<void>;

  // Governorates Delivery Settings
  governoratesSettings: DeliveryGovernorateSetting[];
  updateGovernorateSetting: (
    governorateName: string,
    isActive: boolean,
    deliveryFee: number
  ) => Promise<{ success: boolean; message?: string }>;

  // App Theme & Display Settings
  themeMode: AppThemeMode;
  setThemeMode: (mode: AppThemeMode) => void;
  fontSize: AppFontSize;
  setFontSize: (size: AppFontSize) => void;

  // Offline, Sync & PWA state
  syncState: SyncState;
  syncMetrics: SyncMetrics;
  retryFailedSync: () => void;
  forceSyncNow: () => Promise<void>;
  isOnline: boolean;
  isServiceWorkerActive: boolean;
  swCacheVersion: string;
  isInstallable: boolean;
  promptInstallPwa: () => Promise<boolean>;
  toggleSimulatedOffline?: () => void;
  getRecordSyncStatus: (entity: SyncEntity, recordId: string) => "SYNCED" | "PENDING" | "SYNCING" | "FAILED" | "OFFLINE_CACHED";
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_HOME_PERMISSIONS: HomePermissions = {
  allowedScreens: {
    categories: true,
    missing: true,
    purchases: true,
    budget: false, // Default: budget is protected for admin
  },
  canAddMissingItem: true,
  canDeleteMissingItem: false, // Protected by default
  canEditItem: true,
  canAddInvoice: false, // Admin purchases by default
  canUseAiAssistant: true,
  canSendUrgentAlert: true,
};

const STATIC_CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

function buildCategoriesFromGlobalAndCustom(
  globalCats: any[],
  householdCustomCats?: CategoryInfo[] | null
): CategoryInfo[] {
  const baseCats = (globalCats || [])
    .map((gc, idx) => mapGlobalCategoryToCategoryInfo(gc, idx))
    .filter((c) => c.isActive !== false && Boolean(c.nameAr))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

  if (!householdCustomCats || !Array.isArray(householdCustomCats) || householdCustomCats.length === 0) {
    return baseCats;
  }

  const customMap = new Map<string, CategoryInfo>();
  householdCustomCats.forEach((hc) => {
    if (hc && hc.id) {
      customMap.set(hc.id, hc);
    }
  });

  // Merge household customizations onto matching global categories while preserving global active/sortOrder/metadata
  const merged = baseCats.map((gc) => {
    const custom = customMap.get(gc.id);
    if (!custom || !custom.isCustom) return gc;
    return {
      ...gc,
      commonItems:
        Array.isArray(custom.commonItems) && custom.commonItems.length > 0
          ? custom.commonItems
          : gc.commonItems,
      subcategories:
        Array.isArray(custom.subcategories) && custom.subcategories.length > 0
          ? custom.subcategories
          : gc.subcategories,
    };
  });

  // Append genuinely custom household categories that are not part of the global catalog or static defaults
  householdCustomCats.forEach((hc) => {
    if (!hc || !hc.id || hc.isActive === false) return;
    const alreadyInGlobal = merged.some((m) => m.id === hc.id);
    if (!alreadyInGlobal && hc.isCustom && !STATIC_CATEGORY_IDS.has(hc.id)) {
      merged.push(hc);
    }
  });

  return merged;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [householdStatus, setHouseholdStatus] = useState<HouseholdStatus>("HOUSEHOLD_NOT_FOUND");
  const [activeRole, setActiveRole] = useState<UserRole>("guest");
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [activePairingToken, setActivePairingToken] = useState<PairingToken | null>(null);
  const [activeTab, setActiveTab] = useState<
    "categories" | "missing" | "purchases" | "budget" | "settings" | "auth" | "profile" | "archive" | "flutter_code" | "pharmacy" | "food"
  >("categories");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [simulatorMode, setSimulatorMode] = useState<"single" | "split">("single");

  // Dynamic Categories (Authoritative global catalog cache, household cache, or fallback)
  const [categories, setCategories] = useState<CategoryInfo[]>(() => {
    if (typeof window === "undefined") return CATEGORIES;
    try {
      const cachedSession = cacheManager.getStoredSession();
      const cachedUid = cachedSession?.user?.id;
      const cachedHhId = cachedUid ? cacheManager.getUserCache<string>(cachedUid, "last_household_id") : null;
      const customCats =
        cachedUid && cachedHhId
          ? cacheManager.getHouseholdCache<CategoryInfo[]>(cachedUid, cachedHhId, "custom_categories")
          : null;

      const globalCached = cacheManager.getGlobalCache<any[]>("global_categories");
      if (globalCached && Array.isArray(globalCached) && globalCached.length > 0) {
        const built = buildCategoriesFromGlobalAndCustom(globalCached, customCats);
        if (built.length > 0) return built;
      }

      if (cachedUid && cachedHhId) {
        const cachedCats = cacheManager.getHouseholdCache<CategoryInfo[]>(cachedUid, cachedHhId, "categories");
        if (cachedCats && Array.isArray(cachedCats) && cachedCats.length > 0) {
          return cachedCats;
        }
      }
    } catch (e) {
      console.warn("[AppContext] Error reading initial cached categories:", e);
    }
    return CATEGORIES;
  });

  // Home Permissions (Template defaults)
  const [homePermissions, setHomePermissions] = useState<HomePermissions>(DEFAULT_HOME_PERMISSIONS);

  // User and Household Scoped Dynamic State (Clean blanks - no demo/mock data, instant cache hydration)
  const [missingItems, setMissingItems] = useState<MissingItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cachedSession = cacheManager.getStoredSession();
      if (cachedSession?.user) {
        const cachedHhId = cacheManager.getUserCache<string>(cachedSession.user.id, "last_household_id");
        if (cachedHhId) {
          const cachedMissing = cacheManager.getHouseholdCache<MissingItem[]>(cachedSession.user.id, cachedHhId, "missing_items");
          if (cachedMissing && Array.isArray(cachedMissing) && cachedMissing.length > 0) {
            return cachedMissing;
          }
        }
      }
    } catch (e) {
      console.warn("[AppContext] Error reading initial cached missing items:", e);
    }
    return [];
  });
  const missingItemsRef = useRef<MissingItem[]>(missingItems);

  useEffect(() => {
    missingItemsRef.current = missingItems;
  }, [missingItems]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [householdOrders, setHouseholdOrders] = useState<DeliveryOrder[]>(() => {
    try {
      const uid = cacheManager.getStoredSession()?.user?.id;
      const hhid = uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null;
      if (uid && hhid) {
        return cacheManager.getHouseholdCache<DeliveryOrder[]>(uid, hhid, "delivery_orders") || [];
      }
    } catch (e) {
      console.warn("[AppContext] Error reading initial cached delivery orders:", e);
    }
    return [];
  });
  const [archivedMonths, setArchivedMonths] = useState<ArchivedMonthRecord[]>([]);
  const isArchivesHydratedRef = useRef<boolean>(false);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>({
    monthlyLimit: 2500,
    currency: "ج.م",
    month: "الشهر الحالي",
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // App Theme Mode and Font Size Preferences (Scoped to Device)
  const [themeMode, setThemeMode] = useState<AppThemeMode>(() =>
    cacheManager.getDevicePreference("theme_mode", "light")
  );
  const [fontSize, setFontSize] = useState<AppFontSize>(() =>
    cacheManager.getDevicePreference("font_size", "md")
  );

  // Apply Theme to DOM
  useEffect(() => {
    if (themeMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    cacheManager.setDevicePreference("theme_mode", themeMode);
  }, [themeMode]);

  // Apply Font Size to DOM
  useEffect(() => {
    document.documentElement.setAttribute("data-font-size", fontSize);
    cacheManager.setDevicePreference("font_size", fontSize);
  }, [fontSize]);

  // Supabase Auth & Session Persistence State (Single Authoritative Source: Supabase Auth)
  const [authStatus, setAuthStatus] = useState<AuthStatus>("INITIALIZING");
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [supabaseProfile, setSupabaseProfile] = useState<SupabaseProfile | null>(null);
  const isAuthLoading =
    authStatus === "INITIALIZING" ||
    authStatus === "SESSION" ||
    authStatus === "PROFILE" ||
    authStatus === "HOUSEHOLD" ||
    authStatus === "PERMISSIONS";
  const isAuthenticated = authStatus === "READY" && Boolean(supabaseUser && supabaseSession);
  const isSupabaseConnected = isSupabaseConfigured();
  const authSequenceRef = useRef<number>(0);
  const isSigningUpRef = useRef<boolean>(false);
  const activeHydrationTokenRef = useRef<string | null>(null);

  // Offline, Authoritative Sync Engine, and PWA Install States
  const [syncState, setSyncState] = useState<SyncState>("INITIALIZING");
  const [syncMetrics, setSyncMetrics] = useState<SyncMetrics>({
    totalPending: 0,
    totalFailed: 0,
    lastSyncedAt: null,
    lastError: null,
  });

  useEffect(() => {
    const unsubscribe = syncManager.subscribeState((state, metrics) => {
      setSyncState(state);
      setSyncMetrics(metrics);
    });
    return unsubscribe;
  }, []);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isServiceWorkerActive, setIsServiceWorkerActive] = useState<boolean>(false);
  const swCacheVersion = "v1.1 (PWA Offline Engine)";
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);

  // Listen to network status, Service Worker registration, and PWA beforeinstallprompt
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncManager.reconnectRealtime();
      syncManager.triggerQueueProcessing();
      // Re-fetch global categories & catalog when connection returns
      catalogService
        .getGlobalCategories()
        .then((globalCats) => {
          if (globalCats && globalCats.length > 0) {
            const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
            const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
            const customCats =
              uid && hhid
                ? cacheManager.getHouseholdCache<CategoryInfo[]>(uid, hhid, "custom_categories")
                : null;
            const updatedCats = buildCategoriesFromGlobalAndCustom(globalCats, customCats);
            if (updatedCats.length > 0) {
              setCategories(updatedCats);
              if (uid && hhid) {
                cacheManager.setHouseholdCache(uid, hhid, "categories", updatedCats);
              }
            }
          }
        })
        .catch((err) => console.warn("[AppContext] Error syncing global categories on online:", err));
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check service worker active state
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      if (navigator.serviceWorker.controller) {
        setIsServiceWorkerActive(true);
      }
      navigator.serviceWorker.ready.then(() => {
        setIsServiceWorkerActive(true);
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [supabaseUser?.id, household?.id]);

  // Auto-detect QR Code Scan from native mobile camera or URL link (?pair=... or ?join=...)
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pairParam =
        urlParams.get("token") || urlParams.get("pair") || urlParams.get("join") || urlParams.get("code");

      if (pairParam) {
        const cleanCode = pairParam.trim().toUpperCase();
        console.log("🔗 Detected QR Code Pair Param from Camera URL:", cleanCode);

        // Clean up URL query parameters so the URL stays tidy
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // Perform instant pairing
        joinHouseholdByCode(cleanCode, "هاتف المنزل").then((res) => {
          if (res.success) {
            try {
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#10B981", "#3B82F6", "#F59E0B", "#059669"],
              });
            } catch {}
          }
        });
      }
    } catch (e) {
      console.warn("Error parsing URL pair parameters:", e);
    }
  }, []);

  const toggleSimulatedOffline = () => {
    setIsOnline((prev) => !prev);
  };

  // Save changes to isolated namespaced cache automatically (ONLY for authenticated user + verified household)
  useEffect(() => {
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", missingItems);
    }
  }, [missingItems, supabaseUser?.id, household?.id]);

  useEffect(() => {
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "invoices", invoices);
    }
  }, [invoices, supabaseUser?.id, household?.id]);

  useEffect(() => {
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "budget", budgetConfig);
    }
  }, [budgetConfig, supabaseUser?.id, household?.id]);

  useEffect(() => {
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "permissions", homePermissions);
    }
  }, [homePermissions, supabaseUser?.id, household?.id]);

  useEffect(() => {
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "household_info", household);
    }
  }, [household, supabaseUser?.id]);

  useEffect(() => {
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "notifications", notifications);
    }
  }, [notifications, supabaseUser?.id, household?.id]);

  useEffect(() => {
    if (supabaseUser?.id && household?.id && isArchivesHydratedRef.current) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "archived_months", archivedMonths);
    }
  }, [archivedMonths, supabaseUser?.id, household?.id]);

  useEffect(() => {
    const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
    const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
    if (uid && hhid && categories.length > 0) {
      const customOnly = categories.filter((c) => Boolean(c.isCustom));
      cacheManager.setHouseholdCache(uid, hhid, "custom_categories", customOnly);
      cacheManager.setHouseholdCache(uid, hhid, "categories", categories);
    }
  }, [categories, supabaseUser?.id, household?.id]);

  useEffect(() => {
    const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
    const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
    if (uid && hhid && missingItems.length > 0) {
      cacheManager.setHouseholdCache(uid, hhid, "missing_items", missingItems);
    }
  }, [missingItems, supabaseUser?.id, household?.id]);

  // Authoritative sync of global_categories from Supabase -> state & cache
  const syncGlobalCategoriesFromSupabase = useCallback(async () => {
    try {
      const globalCats = await catalogService.getGlobalCategories();
      if (!globalCats || globalCats.length === 0) return;

      const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
      const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
      const customCats =
        uid && hhid
          ? cacheManager.getHouseholdCache<CategoryInfo[]>(uid, hhid, "custom_categories")
          : null;

      const updatedCats = buildCategoriesFromGlobalAndCustom(globalCats, customCats);
      if (updatedCats.length > 0) {
        setCategories(updatedCats);
        if (uid && hhid) {
          cacheManager.setHouseholdCache(uid, hhid, "categories", updatedCats);
        }
      }
    } catch (err) {
      console.warn("[AppContext] Error syncing global categories:", err);
    }
  }, [supabaseUser?.id, household?.id]);

  const refreshActiveStateFromCache = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const user = supabaseUser || cacheManager.getStoredSession()?.user;
      const hhId = household?.id || (user ? cacheManager.getUserCache<string>(user.id, "last_household_id") : null);
      const customCats =
        user && hhId
          ? cacheManager.getHouseholdCache<CategoryInfo[]>(user.id, hhId, "custom_categories")
          : null;

      // 1. Reconcile Categories from authoritative global_categories cache first (never overwrite with static CATEGORIES)
      const globalCached = cacheManager.getGlobalCache<any[]>("global_categories");
      if (globalCached && Array.isArray(globalCached) && globalCached.length > 0) {
        const built = buildCategoriesFromGlobalAndCustom(globalCached, customCats);
        if (built.length > 0) {
          setCategories(built);
        }
      } else if (user && hhId) {
        const hhCachedCats = cacheManager.getHouseholdCache<CategoryInfo[]>(user.id, hhId, "categories");
        if (hhCachedCats && Array.isArray(hhCachedCats) && hhCachedCats.length > 0) {
          setCategories(hhCachedCats);
        }
      }

      // When online, also verify with Supabase global_categories in the background
      if (typeof navigator === "undefined" || navigator.onLine) {
        syncGlobalCategoriesFromSupabase();
      }

      // 2. Reconcile Missing Items
      if (user && hhId) {
        const cachedMissing = cacheManager.getHouseholdCache<MissingItem[]>(user.id, hhId, "missing_items");
        if (cachedMissing && Array.isArray(cachedMissing)) {
          missingItemsRef.current = cachedMissing;
          setMissingItems(cachedMissing);
        }
      }
    } catch (err) {
      console.warn("[AppContext] Error refreshing active state from cache:", err);
    }
  }, [supabaseUser, household?.id, syncGlobalCategoriesFromSupabase]);

  const promptInstallPwa = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === "accepted") {
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
    } catch (e) {
      console.warn("PWA install error:", e);
    }
    return false;
  };

  // Incoming Alert / Ringtone state
  const [incomingAlert, setIncomingAlert] = useState<IncomingAlertState | null>(null);

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isAddInvoiceModalOpen, setIsAddInvoiceModalOpen] = useState<boolean>(false);
  const [isEndMonthModalOpen, setIsEndMonthModalOpen] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState<boolean>(false);
  const [isSupabaseAuthModalOpen, setIsSupabaseAuthModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [isRecurringOrdersModalOpen, setIsRecurringOrdersModalOpen] = useState<boolean>(false);
  const [isGovernoratesModalOpen, setIsGovernoratesModalOpen] = useState<boolean>(false);
  const [isAdminNotifManagerModalOpen, setIsAdminNotifManagerModalOpen] = useState<boolean>(false);

  // Household & Global Catalog State
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>(() => {
    if (typeof window === "undefined") return [];
    return cacheManager.getGlobalCache<GlobalProduct[]>("global_products") || [];
  });
  const [householdProducts, setHouseholdProducts] = useState<HouseholdProduct[]>([]);
  // Recurring Orders Templates & Drafts State
  const [recurringOrders, setRecurringOrders] = useState<RecurringOrder[]>([]);
  const [orderRequests, setOrderRequests] = useState<RecurringOrderRequest[]>([]);
  // Admin Central Notifications
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  // Delivery Governorates Settings
  const [governoratesSettings, setGovernoratesSettings] = useState<DeliveryGovernorateSetting[]>([]);

  // Load Catalog (Global Categories + Global Products + Household Products) & Orders
  const refreshCatalogAndOrders = useCallback(async () => {
    // Always sync global categories & global products even before household resolves
    try {
      const [gCats, gProds] = await Promise.all([
        catalogService.getGlobalCategories(),
        catalogService.getGlobalProducts(),
      ]);
      if (gProds && gProds.length > 0) {
        setGlobalProducts(gProds);
      }
      if (gCats && gCats.length > 0) {
        const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
        const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
        const customCats =
          uid && hhid
            ? cacheManager.getHouseholdCache<CategoryInfo[]>(uid, hhid, "custom_categories")
            : null;
        const updatedCats = buildCategoriesFromGlobalAndCustom(gCats, customCats);
        if (updatedCats.length > 0) {
          setCategories(updatedCats);
          if (uid && hhid) {
            cacheManager.setHouseholdCache(uid, hhid, "categories", updatedCats);
          }
        }
      }
    } catch (catErr) {
      console.warn("[AppContext] Error syncing global catalog:", catErr);
    }

    if (!household?.id) return;
    const uid = supabaseUser?.id || "anonymous-user";

    try {
      // 1. Load Household Products
      const prods = await catalogService.getHouseholdProducts(uid, household.id);
      setHouseholdProducts(prods);

      // 2. Load Recurring Orders
      const orders = await recurringOrderService.getRecurringOrders(uid, household.id);
      setRecurringOrders(orders);

      // 3. Load Draft Requests
      const reqs = await recurringOrderService.getOrderRequests(uid, household.id);
      setOrderRequests(reqs);

      // 4. Load Governorates Settings
      const govs = await deliveryService.getGovernorateSettings();
      setGovernoratesSettings(govs);

      // 5. Load Active Admin Notifications
      const notifs = await adminNotificationService.getActiveNotifications(
        household.id,
        activeRole === "admin" ? "admin" : "home",
        household.adminName, // fallback or governorate
        supabaseUser?.id || cacheManager.getStoredSession()?.user?.id
      );
      setAdminNotifications(notifs);

      // 6. Load Household Delivery Orders for Central Accounting
      const dlOrders = await deliveryService.getHouseholdOrders(household.id, uid);
      setHouseholdOrders(dlOrders);
    } catch (err) {
      console.warn("[AppContext] Error refreshing catalog and orders:", err);
    }
  }, [household?.id, supabaseUser?.id, activeRole, household?.adminName]);

  useEffect(() => {
    refreshCatalogAndOrders();
  }, [refreshCatalogAndOrders]);

  // Subscribe to Realtime changes on global_categories and global_products so Admin Dashboard additions appear immediately
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("global-catalog-live-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "global_categories" },
        () => {
          syncGlobalCategoriesFromSupabase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "global_products" },
        () => {
          catalogService
            .getGlobalProducts()
            .then((gProds) => {
              if (gProds && gProds.length > 0) setGlobalProducts(gProds);
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [syncGlobalCategoriesFromSupabase]);

  // Unified Catalog Products for a Category (Global + Household Customizations, deduplicated)
  const getCatalogProductsForCategory = useCallback((categoryId: string): CatalogProduct[] => {
    const catGlobalProds = globalProducts.filter(
      (gp) => gp.global_category_id === categoryId && gp.is_active
    );
    const catHhProds = householdProducts.filter(
      (hp) => hp.category_id === categoryId && hp.is_active
    );

    const unifiedMap = new Map<string, CatalogProduct>();

    // 1. Add active global products
    catGlobalProds.forEach((gp) => {
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

    // 2. Overlay household products
    catHhProds.forEach((hp) => {
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

      const normalizedName = hp.name_ar.trim().toLowerCase();
      const matchingGlobal = Array.from(unifiedMap.values()).find(
        (p) => p.name_ar.trim().toLowerCase() === normalizedName
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

    const result = Array.from(unifiedMap.values())
      .filter((p) => p.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    // 3. Fallback: If both global & household tables are empty (unseeded development state)
    if (result.length === 0) {
      const targetCat = categories.find((c) => c.id === categoryId) || CATEGORIES.find((c) => c.id === categoryId);
      if (targetCat && targetCat.commonItems && targetCat.commonItems.length > 0) {
        let order = 1;
        return targetCat.commonItems.map((name) => {
          const matchedSub = targetCat.subcategories?.find((s) => s.items?.includes(name));
          return {
            id: `fallback-${categoryId}-${order}`,
            category_id: categoryId,
            subcategory_id: matchedSub ? matchedSub.id : null,
            name_ar: name,
            name_en: null,
            image_url: null,
            default_quantity: '١',
            default_unit: 'قطعة',
            quantity: '١',
            unit: 'قطعة',
            estimated_price: 0,
            source_global_product_id: null,
            is_custom: false,
            is_active: true,
            sort_order: order++,
          };
        });
      }
    }

    return result;
  }, [globalProducts, householdProducts, categories]);

  // Catalog Actions
  const addOrUpdateHouseholdProduct = async (prod: {
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
  }) => {
    if (!household?.id) return { success: false, message: "لا يوجد منزل نشط" };
    const uid = supabaseUser?.id || "local-user";
    const res = await catalogService.addOrUpdateHouseholdProduct(uid, household.id, prod);
    if (res.success && res.product) {
      setHouseholdProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === res.product!.id);
        if (idx >= 0) return prev.map((p, i) => (i === idx ? res.product! : p));
        return [...prev, res.product!];
      });
    }
    return res;
  };

  const deleteHouseholdProduct = async (productId: string) => {
    if (!household?.id) return { success: false };
    const uid = supabaseUser?.id || "local-user";
    const res = await catalogService.deleteHouseholdProduct(uid, household.id, productId);
    if (res.success) {
      setHouseholdProducts((prev) => prev.filter((p) => p.id !== productId));
    }
    return res;
  };

  const seedHouseholdCatalog = async () => {
    if (!household?.id) return { success: false, message: "لا يوجد منزل نشط" };
    const res = await catalogService.seedHouseholdCatalog(household.id);
    if (res.success) {
      await refreshCatalogAndOrders();
    }
    return res;
  };

  // Recurring Orders Actions
  const createRecurringOrder = async (orderData: {
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
  }) => {
    if (!household?.id) return { success: false, message: "لا يوجد منزل نشط" };
    const uid = supabaseUser?.id || "local-user";
    const res = await recurringOrderService.createRecurringOrder(uid, household.id, orderData);
    if (res.success && res.order) {
      setRecurringOrders((prev) => [res.order!, ...prev]);
    }
    return res;
  };

  const deleteRecurringOrder = async (orderId: string) => {
    if (!household?.id) return { success: false };
    const uid = supabaseUser?.id || "local-user";
    const res = await recurringOrderService.deleteRecurringOrder(uid, household.id, orderId);
    if (res.success) {
      setRecurringOrders((prev) => prev.filter((o) => o.id !== orderId));
    }
    return res;
  };

  const createOrderDraft = async (recurringOrder: RecurringOrder, notes?: string) => {
    if (!household?.id) return { success: false, message: "لا يوجد منزل نشط" };
    const uid = supabaseUser?.id || "local-user";
    const role = activeRole === "admin" ? "admin" : "home";
    const res = await recurringOrderService.createOrderDraft(uid, household.id, recurringOrder, role, notes);
    if (res.success && res.request) {
      setOrderRequests((prev) => [res.request!, ...prev]);
    }
    return res;
  };

  const updateDraftItem = async (
    requestId: string,
    itemId: string,
    updates: { quantity?: string; unit_price?: number; is_deleted?: boolean }
  ) => {
    if (!household?.id) return { success: false };
    const uid = supabaseUser?.id || "local-user";
    const res = await recurringOrderService.updateDraftItem(uid, household.id, requestId, itemId, updates);
    if (res.success) {
      setOrderRequests((prev) =>
        prev.map((req) => {
          if (req.id !== requestId) return req;
          let reqItems = req.items || [];
          if (updates.is_deleted) {
            reqItems = reqItems.filter((it) => it.id !== itemId);
          } else {
            reqItems = reqItems.map((it) => {
              if (it.id !== itemId) return it;
              const q = updates.quantity !== undefined ? updates.quantity : it.quantity;
              const p = updates.unit_price !== undefined ? updates.unit_price : it.unit_price;
              return {
                ...it,
                quantity: q,
                unit_price: p,
                total_price: (Number(q) || 1) * p,
                is_modified: true,
              };
            });
          }
          return { ...req, items: reqItems };
        })
      );
    }
    return res;
  };

  const approveDraftRequest = async (
    requestId: string,
    addressId: string,
    deliveryNotes?: string
  ) => {
    const res = await recurringOrderService.approveAndConvertToDeliveryOrder(requestId, addressId, deliveryNotes);
    if (res.success) {
      setOrderRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status: "approved" as const } : req))
      );
      // Notify components that a delivery order was created
      window.dispatchEvent(new CustomEvent("delivery-order-created"));
    }
    return res;
  };

  const rejectDraftRequest = async (requestId: string, reason?: string) => {
    if (!household?.id) return { success: false };
    const uid = supabaseUser?.id || "local-user";
    const res = await recurringOrderService.rejectDraftRequest(uid, household.id, requestId, reason);
    if (res.success) {
      setOrderRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status: "rejected" as const, review_notes: reason } : req))
      );
    }
    return res;
  };

  // Admin Notifications Actions
  const dismissAdminNotification = async (notificationId: string) => {
    if (!household?.id) return;
    setAdminNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    await adminNotificationService.recordViewOrDismiss(
      notificationId,
      household.id,
      activeRole === "admin" ? "admin" : "home",
      true
    );
  };

  const refreshAdminNotifications = async () => {
    if (!household?.id) return;
    const notifs = await adminNotificationService.getActiveNotifications(
      household.id,
      activeRole === "admin" ? "admin" : "home",
      household.adminName,
      supabaseUser?.id || cacheManager.getStoredSession()?.user?.id
    );
    setAdminNotifications(notifs);
  };

  // Governorates Actions
  const updateGovernorateSetting = async (
    governorateName: string,
    isActive: boolean,
    deliveryFee: number
  ) => {
    const res = await deliveryService.updateGovernorateSetting(governorateName, isActive, deliveryFee);
    if (res.success) {
      setGovernoratesSettings((prev) =>
        prev.map((g) =>
          g.governorate_name === governorateName
            ? { ...g, is_active: isActive, delivery_fee: deliveryFee }
            : g
        )
      );
    }
    return res;
  };

  // Fiscal Month & Invoice Archiving Methods
  const endCurrentFiscalMonth = async (nextMonthName?: string, nextBudgetLimit?: number) => {
    const currentMonthTitle = budgetConfig.month || "الشهر الحالي";
    const closingUser =
      supabaseProfile?.fullName ||
      (activeRole === "admin" ? household?.adminName || "المسؤول" : "هاتف المنزل");

    // 1. Fetch household delivery orders to separate completed vs incomplete
    let householdOrders: DeliveryOrder[] = [];
    if (household?.id) {
      try {
        householdOrders = await deliveryService.getHouseholdOrders(
          household.id,
          supabaseUser?.id
        );
      } catch (err) {
        console.warn("[endMonth] Error fetching household orders for archive:", err);
      }
    }

    // 2. Identify incomplete orders - MUST NEVER BE ARCHIVED!
    const incompleteOrders = householdOrders.filter(
      (o) =>
        o.status === "pending_review" ||
        o.status === "accepted" ||
        o.status === "shopping" ||
        o.status === "cancellation_pending"
    );
    const incompleteInvoiceIds = new Set(incompleteOrders.map((o) => o.invoice_id).filter(Boolean));

    // 3. Separate invoices: invoices linked to incomplete orders STAY ACTIVE!
    const invoicesToArchive = invoices.filter((inv) => !incompleteInvoiceIds.has(inv.id));
    const remainingActiveInvoices = invoices.filter((inv) => incompleteInvoiceIds.has(inv.id));

    // 4. Identify completed / finished orders to archive (NEVER incomplete!)
    const ordersToArchive = householdOrders.filter(
      (o) =>
        (o.status === "completed" || o.status === "cancelled") &&
        !(o.delivery_notes || "").includes("[ARCHIVED:")
    );

    // Calculate accurate archive totalSpent (Invoice Products Amount + Delivery Fees)
    const archivedOrdersByInvoiceId = new Map<string, DeliveryOrder>();
    ordersToArchive.forEach((o) => {
      if (o.invoice_id && o.status !== "cancelled") {
        archivedOrdersByInvoiceId.set(o.invoice_id, o);
      }
    });

    let archiveTotalSpent = 0;
    invoicesToArchive.forEach((inv) => {
      const linked = archivedOrdersByInvoiceId.get(inv.id);
      const purchaseAmt = Number(inv.totalPrice) || 0;
      const deliveryAmt = linked ? (Number(linked.delivery_fee) || 0) : 0;
      archiveTotalSpent += purchaseAmt + deliveryAmt;
    });

    // Plus any unlinked completed orders in archive
    ordersToArchive.forEach((o) => {
      if (o.status !== "cancelled" && (!o.invoice_id || !invoicesToArchive.some((inv) => inv.id === o.invoice_id))) {
        const purchaseAmt =
          o.actual_items_total !== undefined && o.actual_items_total !== null && o.actual_items_total > 0
            ? Number(o.actual_items_total)
            : Number(o.subtotal) || 0;
        const deliveryAmt = Number(o.delivery_fee) || 0;
        archiveTotalSpent += purchaseAmt + deliveryAmt;
      }
    });

    const newArchiveRecord: ArchivedMonthRecord = {
      id: `arch-${Date.now()}`,
      monthName: currentMonthTitle,
      archivedAt: new Date().toISOString(),
      invoicesCount: invoicesToArchive.length,
      totalSpent: archiveTotalSpent,
      remainingBudget: Math.max(0, budgetConfig.monthlyLimit - archiveTotalSpent),
      budgetLimit: budgetConfig.monthlyLimit,
      currency: budgetConfig.currency,
      closedBy: closingUser,
      invoices: invoicesToArchive,
      deliveryOrders: ordersToArchive,
    };

    // 5. Immediately update archived months in state and local cache
    isArchivesHydratedRef.current = true;
    const updatedArchives = [newArchiveRecord, ...archivedMonths];
    setArchivedMonths(updatedArchives);
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "archived_months", updatedArchives);
    }

    // 6. Update active invoices in state and local cache (retaining incomplete ones)
    setInvoices(remainingActiveInvoices);
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "invoices", remainingActiveInvoices);
    }

    // 6.b Update delivery orders in local cache to mark archived orders
    if (supabaseUser?.id && household?.id && householdOrders.length > 0) {
      const updatedOrdersCache = householdOrders.map((ord) => {
        if (ordersToArchive.some((o) => o.id === ord.id)) {
          const cleanNotes = (ord.delivery_notes || "").replace(/\[ARCHIVED:[^\]]+\]/g, "").trim();
          const archiveTag = `[ARCHIVED:${newArchiveRecord.id}:${currentMonthTitle}]`;
          return {
            ...ord,
            delivery_notes: cleanNotes ? `${cleanNotes} ${archiveTag}` : archiveTag,
          };
        }
        return ord;
      });
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "delivery_orders", updatedOrdersCache);
    }

    // 7. Update budget month & optional limit in state and cache
    const updatedMonth = nextMonthName || "الشهر القادم";
    const updatedLimit = nextBudgetLimit && nextBudgetLimit > 0 ? nextBudgetLimit : budgetConfig.monthlyLimit;
    const newBudgetConfig: BudgetConfig = {
      monthlyLimit: updatedLimit,
      currency: budgetConfig.currency,
      month: updatedMonth,
    };
    setBudgetConfig(newBudgetConfig);
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "budget", newBudgetConfig);
    }

    if (household) {
      dbHelpers.upsertBudget({
        household_id: household.id,
        monthly_limit: updatedLimit,
        currency: budgetConfig.currency,
        month: updatedMonth,
      });

      // 8. Mark all completed archived invoices in Supabase with archive tag in notes
      invoicesToArchive.forEach((inv) => {
        const cleanNotes = (inv.notes || "").replace(/\[ARCHIVED:[^\]]+\]/g, "").trim();
        const archiveTag = `[ARCHIVED:${newArchiveRecord.id}:${currentMonthTitle}]`;
        const updatedNotes = cleanNotes ? `${cleanNotes} ${archiveTag}` : archiveTag;

        syncManager.enqueueMutation(
          "invoices",
          "UPDATE",
          inv.id,
          {
            notes: updatedNotes,
            total_price: inv.totalPrice,
            products: inv.products,
          },
          supabaseUser?.id || "",
          household.id
        );

        if (isSupabaseConfigured()) {
          supabase
            .from("invoices")
            .update({ notes: updatedNotes })
            .eq("id", inv.id)
            .then(({ error }) => {
              if (error) console.warn("[endMonth] Invoice notes archive update notice:", error.message);
            });
        }
      });

      // 9. Mark completed delivery orders in Supabase with archive tag in delivery_notes
      ordersToArchive.forEach((ord) => {
        const cleanNotes = (ord.delivery_notes || "").replace(/\[ARCHIVED:[^\]]+\]/g, "").trim();
        const archiveTag = `[ARCHIVED:${newArchiveRecord.id}:${currentMonthTitle}]`;
        const updatedNotes = cleanNotes ? `${cleanNotes} ${archiveTag}` : archiveTag;

        if (isSupabaseConfigured()) {
          supabase
            .from("delivery_orders")
            .update({ delivery_notes: updatedNotes })
            .eq("id", ord.id)
            .then(({ error }) => {
              if (error) console.warn("[endMonth] Delivery order archive notes update notice:", error.message);
            });
        }
      });
    }

    // 10. Notify components to reload
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("delivery-order-created"));
      window.dispatchEvent(new CustomEvent("delivery-orders-archived"));
    }

    // 11. Send system notification
    const notif: AppNotification = {
      id: `notif-archive-${Date.now()}`,
      title: `📁 تم إغلاق وأرشفة شهر (${currentMonthTitle})`,
      message: `تم نقل ${invoicesToArchive.length} فواتير و${ordersToArchive.length} طلبات توصيل مكتملة للأرشيف. وبدء شهر (${updatedMonth}) بميزانية جديدة.`,
      type: "purchase_made",
      timestamp: new Date().toISOString(),
      targetRole: "all",
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);
  };

  const clearAllArchives = () => {
    isArchivesHydratedRef.current = true;
    setArchivedMonths([]);
    if (supabaseUser?.id && household?.id) {
      cacheManager.removeHouseholdCache(supabaseUser.id, household.id, "archived_months");
    }
  };

  const deleteArchivedMonth = (id: string) => {
    isArchivesHydratedRef.current = true;
    setArchivedMonths((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      if (supabaseUser?.id && household?.id) {
        cacheManager.setHouseholdCache(supabaseUser.id, household.id, "archived_months", updated);
      }
      return updated;
    });
  };

  // Fetch household members list from database
  const fetchHouseholdMembers = async () => {
    if (!supabase || !household?.id) return;
    try {
      const data = await dbHelpers.fetchHouseholdMembers(household.id);
      if (data) {
        const mapped: HouseholdMember[] = data.map((m: any) => ({
          id: m.id,
          householdId: m.household_id,
          userId: m.user_id,
          role: (m.role as UserRole) || "home",
          userName: m.user_name || "عضو المنزل",
          userPhone: m.user_phone || "",
          joinedAt: m.joined_at || new Date().toISOString(),
        }));
        setHouseholdMembers(mapped);
      }
    } catch (e) {
      console.warn("Could not fetch household members:", e);
    }
  };

  // Complete state reset when unauthenticated or signing out
  const resetAllUserDataState = () => {
    setHousehold(null);
    setHouseholdStatus("HOUSEHOLD_NOT_FOUND");
    setActiveRole("guest");
    setHouseholdMembers([]);
    setActivePairingToken(null);
    setMissingItems([]);
    setInvoices([]);
    setArchivedMonths([]);
    setNotifications([]);
    setSelectedCategory(null);
    setIncomingAlert(null);
    const globalCached = cacheManager.getGlobalCache<any[]>("global_categories");
    if (globalCached && Array.isArray(globalCached) && globalCached.length > 0) {
      const built = buildCategoriesFromGlobalAndCustom(globalCached, null);
      setCategories(built.length > 0 ? built : CATEGORIES);
    } else {
      setCategories(CATEGORIES);
    }
    setHomePermissions(DEFAULT_HOME_PERMISSIONS);
    setBudgetConfig({
      monthlyLimit: 2500,
      currency: "ج.م",
      month: "الشهر الحالي",
    });
    // Critical: purge all legacy un-namespaced keys
    cacheManager.purgeLegacyGlobalKeys();
  };

  // Fetch or create profile & household data tied directly to authoritative user UUID
  const syncAuthenticatedUserData = async (authUser: User, authSession: Session, seq: number) => {
    if (!supabase) return;
    setHouseholdStatus("HOUSEHOLD_LOADING");
    try {
      // 1. SESSION STAGE
      if (seq !== authSequenceRef.current) return;
      setAuthStatus("SESSION");
      setAuthError(null);
      setSupabaseSession(authSession);
      setSupabaseUser(authUser);

      // 2. PROFILE STAGE
      if (seq !== authSequenceRef.current) return;
      setAuthStatus("PROFILE");

      let profileRow: any = null;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();
        if (!error && data) {
          profileRow = data;
        }
      } catch (e) {
        console.warn("Could not query profiles:", e);
      }

      if (seq !== authSequenceRef.current) return;

      const isHomePhoneUser =
        authUser.email?.toLowerCase().endsWith("@talbat.com") ||
        authUser.email?.toLowerCase().endsWith("@talabat.com") ||
        authUser.user_metadata?.is_home_phone === true ||
        authUser.user_metadata?.role === "household_member" ||
        profileRow?.role === "household_member";

      let fullName =
        profileRow?.full_name ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        (isHomePhoneUser ? (authUser.user_metadata?.username || "هاتف المنزل") : "المسؤول");
      let phone = profileRow?.phone || authUser.user_metadata?.phone || "";

      // 3. HOUSEHOLD STAGE
      if (seq !== authSequenceRef.current) return;
      setAuthStatus("HOUSEHOLD");

      let targetHouseholdId: string | null = null;
      let memberRole: UserRole = "guest";

      if (!isHomePhoneUser) {
        // Admin flow: Ensure profiles, households, household_members, household_permissions, household_budgets, categories
        const provRes = await ensureAdminHouseholdAndProvisioning({
          userId: authUser.id,
          userEmail: authUser.email,
          fullName,
          phone,
          householdName: authUser.user_metadata?.household_name || "منزل العائلة",
          seedCategories: CATEGORIES,
        });

        if (!provRes.success || !provRes.householdId) {
          console.error("[Auth State Machine] Admin provisioning failed:", provRes.error);
          setAuthStatus("ERROR");
          setAuthError(provRes.error || "فشل تهيئة بيانات المنزل الأساسية في قاعدة البيانات");
          return;
        }

        targetHouseholdId = provRes.householdId;
        memberRole = "admin";
      } else {
        // Home Phone Member flow: Resolve membership without creating a household
        try {
          const { data: membershipRow } = await supabase
            .from("household_members")
            .select("*, households(*)")
            .eq("user_id", authUser.id)
            .maybeSingle();

          if (membershipRow && membershipRow.household_id) {
            targetHouseholdId = membershipRow.household_id;
            memberRole = (membershipRow.role as UserRole) || "household_member";
          }
        } catch (e) {
          console.warn("[Auth Sync] household_members check error:", e);
        }

        // Check offline cache if offline
        if (!targetHouseholdId) {
          const cachedLastHhId = cacheManager.getUserCache<string>(authUser.id, "last_household_id");
          if (cachedLastHhId) {
            targetHouseholdId = cachedLastHhId;
            const cachedRole = cacheManager.getUserCache<UserRole>(authUser.id, "last_role");
            if (cachedRole) memberRole = cachedRole;
          }
        }
      }

      if (seq !== authSequenceRef.current) return;

      if (!targetHouseholdId) {
        const isHomePhoneUser =
          (authUser.user_metadata as any)?.is_home_phone ||
          authUser.email?.startsWith("home_") ||
          memberRole === "household_member" ||
          memberRole === "home";

        if (isHomePhoneUser) {
          console.warn("[Auth Sync] Home Phone user has no household. Signing out to prevent orphaned session.");
          await supabase.auth.signOut().catch(() => {});
          cacheManager.clearActiveSession();
          setAuthStatus("UNAUTHENTICATED");
          setSupabaseUser(null);
          setSupabaseSession(null);
          setSupabaseProfile(null);
          setHousehold(null);
          setHouseholdStatus("UNAUTHENTICATED");
          resetAllUserDataState();
          return;
        }

        setHousehold(null);
        setHouseholdStatus("HOUSEHOLD_NOT_FOUND");
        setActiveRole("guest");
        setHouseholdMembers([]);
        setActivePairingToken(null);
        setMissingItems([]);
        setInvoices([]);
        setNotifications([]);
        setSupabaseProfile({
          id: authUser.id,
          email: authUser.email,
          fullName,
          phone,
          householdId: undefined,
          role: "guest",
        });
        if (seq !== authSequenceRef.current) return;
        setAuthStatus("READY");
        setAuthError(null);
        return;
      }

      if (seq !== authSequenceRef.current) return;

      if (targetHouseholdId) {
        let activeHouseholdId = targetHouseholdId;
        let hhInfo: HouseholdInfo | null = null;

        const { data: hhData, error: hhErr } = await supabase
          .from("households")
          .select("*")
          .eq("id", targetHouseholdId)
          .maybeSingle();

        if (seq !== authSequenceRef.current) return;

        if (hhData && !hhErr) {
          activeHouseholdId = hhData.id;
          hhInfo = {
            id: hhData.id,
            name: hhData.name,
            adminId: hhData.admin_id,
            adminName: hhData.admin_name || fullName,
            adminPhone: hhData.admin_phone || phone,
            createdAt: hhData.created_at || new Date().toISOString(),
            pairCode: hhData.pair_code,
          };
          cacheManager.setUserCache(authUser.id, "last_household_id", hhData.id);
          cacheManager.setUserCache(authUser.id, "last_role", memberRole);
          cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "household_info", hhInfo);
        } else {
          const cachedHh = cacheManager.getHouseholdCache<HouseholdInfo>(authUser.id, targetHouseholdId, "household_info");
          if (cachedHh) {
            hhInfo = cachedHh;
            activeHouseholdId = cachedHh.id;
          }
        }

        if (hhInfo) {
          if (seq !== authSequenceRef.current) return;
          // 4. PERMISSIONS STAGE: Load permissions, members, budget, items, etc.
          setAuthStatus("PERMISSIONS");

          // OFFLINE-FIRST: Immediately hydrate local cache into active state
          setHousehold(hhInfo);
          setActiveRole(memberRole);
          setHouseholdStatus("LOADED");

          const cachedMissing = cacheManager.getHouseholdCache<MissingItem[]>(authUser.id, activeHouseholdId, "missing_items");
          if (cachedMissing && cachedMissing.length > 0) {
            missingItemsRef.current = cachedMissing;
            setMissingItems(cachedMissing);
          }
          const cachedInvoices = cacheManager.getHouseholdCache<PurchaseInvoice[]>(authUser.id, activeHouseholdId, "invoices");
          if (cachedInvoices && cachedInvoices.length > 0) {
            setInvoices(cachedInvoices);
          }
          const cachedBudget = cacheManager.getHouseholdCache<BudgetConfig>(authUser.id, activeHouseholdId, "budget");
          if (cachedBudget) {
            setBudgetConfig(cachedBudget);
          }
          const cachedNotifs = cacheManager.getHouseholdCache<AppNotification[]>(authUser.id, activeHouseholdId, "notifications");
          if (cachedNotifs && cachedNotifs.length > 0) {
            setNotifications(cachedNotifs);
          }

          // Register Auth Session with SyncManager for Android Jetpack WorkManager integration
          syncManager.setAuthSession(authUser.id, activeHouseholdId, authSession?.access_token, authSession?.refresh_token);

          // 1. Register Realtime Handlers for Authoritative Multi-Device Sync
          syncManager.registerRealtimeCallback("missing_items", (eventType, record) => {
            if (eventType === "INSERT") {
              const mapped: MissingItem = {
                id: record.id,
                name: record.name,
                category: record.category,
                categoryArabic: record.category_arabic || record.categoryArabic || "عام",
                quantity: record.quantity || "١",
                urgency: record.urgency || "normal",
                notes: record.notes || "",
                addedBy: record.added_by || record.addedBy || "home",
                addedByName: record.added_by_name || record.addedByName || "",
                addedAt: record.added_at || record.addedAt || new Date().toISOString(),
                completed: Boolean(record.completed),
                completedAt: record.completed_at || record.completedAt,
              };
              setMissingItems((prev) => {
                if (prev.some((p) => p.id === mapped.id)) return prev;
                const updated = [mapped, ...prev];
                missingItemsRef.current = updated;
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "missing_items", updated);
                return updated;
              });
            } else if (eventType === "UPDATE") {
              setMissingItems((prev) => {
                const updated = prev.map((item) => {
                  if (item.id === record.id) {
                    return {
                      ...item,
                      name: record.name !== undefined ? record.name : item.name,
                      quantity: record.quantity !== undefined ? record.quantity : item.quantity,
                      urgency: record.urgency !== undefined ? record.urgency : item.urgency,
                      notes: record.notes !== undefined ? record.notes : item.notes,
                      completed: record.completed !== undefined ? Boolean(record.completed) : item.completed,
                      completedAt: record.completed_at !== undefined ? record.completed_at : item.completedAt,
                    };
                  }
                  return item;
                });
                missingItemsRef.current = updated;
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "missing_items", updated);
                return updated;
              });
            } else if (eventType === "DELETE") {
              setMissingItems((prev) => {
                const updated = prev.filter((p) => p.id !== record.id);
                missingItemsRef.current = updated;
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "missing_items", updated);
                return updated;
              });
            }
          });

          syncManager.registerRealtimeCallback("invoices", (eventType, record) => {
            if (eventType === "INSERT") {
              const mapped: PurchaseInvoice = {
                id: record.id,
                invoiceNumber: record.invoice_number || record.invoiceNumber || `INV-${Date.now()}`,
                date: record.date || new Date().toISOString(),
                category: record.category || "عام",
                categoryArabic: record.category_arabic || record.categoryArabic || "عام",
                products: record.products || [],
                totalPrice: Number(record.total_price || record.totalPrice) || 0,
                notes: record.notes || "",
                registeredBy: record.registered_by || record.registeredBy || "المسؤول",
                paymentMethod: record.payment_method || record.paymentMethod || "cash",
              };
              setInvoices((prev) => {
                if (prev.some((p) => p.id === mapped.id)) return prev;
                const updated = [mapped, ...prev];
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "invoices", updated);
                return updated;
              });
            } else if (eventType === "UPDATE") {
              setInvoices((prev) => {
                const updated = prev.map((inv) => {
                  if (inv.id === record.id) {
                    return {
                      ...inv,
                      totalPrice: record.total_price !== undefined ? Number(record.total_price) : inv.totalPrice,
                      notes: record.notes !== undefined ? record.notes : inv.notes,
                      products: record.products !== undefined ? record.products : inv.products,
                      paymentMethod: record.payment_method !== undefined ? record.payment_method : inv.paymentMethod,
                      category: record.category !== undefined ? record.category : inv.category,
                      categoryArabic: record.category_arabic !== undefined ? record.category_arabic : inv.categoryArabic,
                      date: record.date !== undefined ? record.date : inv.date,
                    };
                  }
                  return inv;
                });
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "invoices", updated);
                return updated;
              });
            } else if (eventType === "DELETE") {
              setInvoices((prev) => {
                const updated = prev.filter((p) => p.id !== record.id);
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "invoices", updated);
                return updated;
              });
            }
          });

          syncManager.registerRealtimeCallback("categories", (eventType, record) => {
            if (eventType === "INSERT" || eventType === "UPDATE") {
              const mappedCat: CategoryInfo = {
                id: record.id,
                nameAr: record.name_ar || record.nameAr || "",
                nameEn: record.name_en || record.nameEn || "",
                imageUrl: record.image_url || record.imageUrl || "",
                iconName: record.icon_name || record.iconName || "ShoppingCart",
                color: record.color || "emerald",
                bgLight: record.bg_light || record.bgLight || "bg-emerald-50 text-emerald-800 border-emerald-200",
                badgeColor: record.badge_color || record.badgeColor || "bg-emerald-100 text-emerald-800",
                description: record.description || "",
                commonItems: record.common_items || record.commonItems || [],
                subcategories: record.subcategories || [],
                isCustom: record.is_custom !== undefined ? Boolean(record.is_custom) : true,
              };
              setCategories((prev) => {
                const existingIndex = prev.findIndex((c) => c.id === mappedCat.id);
                let updated: CategoryInfo[];
                if (existingIndex >= 0) {
                  updated = [...prev];
                  updated[existingIndex] = { ...updated[existingIndex], ...mappedCat };
                } else {
                  updated = [...prev, mappedCat];
                }
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "categories", updated);
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "custom_categories", updated);
                return updated;
              });
            } else if (eventType === "DELETE") {
              setCategories((prev) => {
                const updated = prev.filter((c) => c.id !== record.id);
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "categories", updated);
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "custom_categories", updated);
                return updated;
              });
            }
          });

          syncManager.registerRealtimeCallback("household_permissions", (_eventType, record) => {
            const perms: HomePermissions = {
              allowedScreens: record.allowed_screens || DEFAULT_HOME_PERMISSIONS.allowedScreens,
              canAddMissingItem: record.can_add_missing_item ?? true,
              canDeleteMissingItem: record.can_delete_missing_item ?? false,
              canEditItem: record.can_edit_item ?? true,
              canAddInvoice: record.can_add_invoice ?? false,
              canUseAiAssistant: record.can_use_ai_assistant ?? true,
              canSendUrgentAlert: record.can_send_urgent_alert ?? true,
            };
            setHomePermissions(perms);
            cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "permissions", perms);
          });

          syncManager.registerRealtimeCallback("household_budgets", (_eventType, record) => {
            const b: BudgetConfig = {
              monthlyLimit: Number(record.monthly_limit) || 2500,
              currency: record.currency || "ج.م",
              month: record.month || "الشهر الحالي",
            };
            setBudgetConfig(b);
            cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "budget", b);
          });

          syncManager.registerRealtimeCallback("notifications", (eventType, record) => {
            if (eventType === "INSERT") {
              const notif: AppNotification = {
                id: record.id,
                title: record.title,
                message: record.message,
                type: record.type || "item_added",
                timestamp: record.created_at || new Date().toISOString(),
                targetRole: record.target_role || "all",
                read: Boolean(record.read),
              };

              setNotifications((prev) => {
                if (prev.some((p) => p.id === notif.id)) return prev;
                const updated = [notif, ...prev];
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "notifications", updated);
                return updated;
              });

              // Trigger urgent audio chime if urgent alert for this user/role
              if (notif.type === "urgent_alert" && (notif.targetRole === "all" || notif.targetRole === memberRole)) {
                playUrgentAlertRing();
                setIncomingAlert({
                  active: true,
                  timestamp: notif.timestamp,
                  message: notif.message,
                  from: "هاتف المنزل",
                });
                setTimeout(() => {
                  setIncomingAlert((p) => (p ? { ...p, active: false } : null));
                }, 8000);
              }
            } else if (eventType === "UPDATE") {
              setNotifications((prev) => {
                const updated = prev.map((n) => (n.id === record.id ? { ...n, read: Boolean(record.read) } : n));
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "notifications", updated);
                return updated;
              });
            } else if (eventType === "DELETE") {
              setNotifications((prev) => {
                const updated = prev.filter((n) => n.id !== record.id);
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "notifications", updated);
                return updated;
              });
            }
          });

          // 2. Register Realtime Handlers for Members, Household details, and Profiles
          syncManager.registerRealtimeCallback("household_members", (eventType, record) => {
            if (record.user_id === authUser.id && record.role) {
              setActiveRole(record.role as UserRole);
              cacheManager.setUserCache(authUser.id, "last_role", record.role as UserRole);
            }
            setHouseholdMembers((prev) => {
              if (eventType === "INSERT") {
                const newMember: HouseholdMember = {
                  id: record.id || `mem_${record.user_id}`,
                  householdId: record.household_id,
                  userId: record.user_id,
                  role: (record.role as UserRole) || "home",
                  userName: record.user_name || "عضو المنزل",
                  userPhone: record.user_phone || "",
                  joinedAt: record.joined_at || new Date().toISOString(),
                };
                if (prev.some((m) => m.id === newMember.id || m.userId === newMember.userId)) {
                  return prev.map((m) => (m.id === newMember.id || m.userId === newMember.userId ? { ...m, ...newMember } : m));
                }
                return [...prev, newMember];
              } else if (eventType === "UPDATE") {
                return prev.map((m) => {
                  if (m.id === record.id || m.userId === record.user_id) {
                    return {
                      ...m,
                      role: record.role !== undefined ? record.role : m.role,
                      userName: record.user_name !== undefined ? record.user_name : m.userName,
                      userPhone: record.user_phone !== undefined ? record.user_phone : m.userPhone,
                    };
                  }
                  return m;
                });
              } else if (eventType === "DELETE") {
                return prev.filter((m) => m.id !== record.id && m.userId !== record.user_id);
              }
              return prev;
            });
          });

          syncManager.registerRealtimeCallback("households", (eventType, record) => {
            if (eventType === "UPDATE") {
              setHousehold((prev) => {
                if (!prev) return prev;
                const updated: HouseholdInfo = {
                  ...prev,
                  name: record.name !== undefined ? record.name : prev.name,
                  adminName: record.admin_name !== undefined ? record.admin_name : prev.adminName,
                  adminPhone: record.admin_phone !== undefined ? record.admin_phone : prev.adminPhone,
                  pairCode: record.pair_code !== undefined ? record.pair_code : prev.pairCode,
                };
                cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "household_info", updated);
                return updated;
              });
            }
          });

          syncManager.registerRealtimeCallback("profiles", (_eventType, record) => {
            if (record.id === authUser.id) {
              setSupabaseProfile((prev) => {
                if (!prev) return prev;
                const updated = {
                  ...prev,
                  fullName: record.full_name !== undefined ? record.full_name : prev.fullName,
                  phone: record.phone !== undefined ? record.phone : prev.phone,
                  email: record.email !== undefined ? record.email : prev.email,
                };
                cacheManager.setUserCache(authUser.id, "profile", updated);
                return updated;
              });
            }
          });

          // 3. Setup Authoritative Realtime Subscriptions
          syncManager.setupRealtimeSubscriptions(authUser.id, activeHouseholdId);

          // Fetch permissions from database
          const { data: permData } = await supabase
            .from("household_permissions")
            .select("*")
            .eq("household_id", activeHouseholdId)
            .maybeSingle();

          if (permData) {
            setHomePermissions({
              allowedScreens: permData.allowed_screens || DEFAULT_HOME_PERMISSIONS.allowedScreens,
              canAddMissingItem: permData.can_add_missing_item ?? true,
              canDeleteMissingItem: permData.can_delete_missing_item ?? false,
              canEditItem: permData.can_edit_item ?? true,
              canAddInvoice: permData.can_add_invoice ?? false,
              canUseAiAssistant: permData.can_use_ai_assistant ?? true,
              canSendUrgentAlert: permData.can_send_urgent_alert ?? true,
            });
          }

          // Fetch all household members
          const { data: membersList } = await supabase
            .from("household_members")
            .select("*")
            .eq("household_id", activeHouseholdId)
            .order("joined_at", { ascending: true });

          if (membersList && membersList.length > 0) {
            setHouseholdMembers(
              membersList.map((m: any) => ({
                id: m.id || `mem_${m.user_id}`,
                householdId: m.household_id,
                userId: m.user_id,
                role: (m.role as UserRole) || "home",
                userName: m.user_name || "عضو المنزل",
                userPhone: m.user_phone || "",
                joinedAt: m.joined_at || new Date().toISOString(),
              }))
            );
          } else {
            setHouseholdMembers([
              {
                id: `mem_${hhInfo.adminId}`,
                householdId: activeHouseholdId,
                userId: hhInfo.adminId,
                role: "admin",
                userName: hhInfo.adminName || fullName || "المسؤول",
                userPhone: hhInfo.adminPhone || phone || "",
                joinedAt: hhInfo.createdAt || new Date().toISOString(),
              },
            ]);
          }

          // Fetch active pairing token if admin
          if (memberRole === "admin") {
            const { data: activeToken } = await supabase
              .from("pairing_tokens")
              .select("*")
              .eq("household_id", activeHouseholdId)
              .eq("is_used", false)
              .gt("expires_at", new Date().toISOString())
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (activeToken) {
              setActivePairingToken({
                id: activeToken.id,
                householdId: activeToken.household_id,
                token: activeToken.token,
                createdBy: activeToken.created_by,
                createdAt: activeToken.created_at,
                expiresAt: activeToken.expires_at,
                isUsed: activeToken.is_used,
              });
            }
          }

          // Fetch authoritative household data in parallel from Supabase
          const [itemsRes, invRes, budgetRes, catRes, notifRes] = await Promise.all([
            dbHelpers.fetchMissingItems(activeHouseholdId),
            dbHelpers.fetchInvoices(activeHouseholdId),
            dbHelpers.fetchBudget(activeHouseholdId),
            dbHelpers.fetchCustomCategories(activeHouseholdId),
            dbHelpers.fetchNotifications(activeHouseholdId),
          ]);

          if (seq !== authSequenceRef.current) return;

          // Reconcile Authoritative Supabase data with any local pending queue mutations
          const activeQueue = syncManager.getQueue(authUser.id, activeHouseholdId);

          // 1. Missing items:
          if (itemsRes?.success && Array.isArray(itemsRes.data)) {
            let mappedItems: MissingItem[] = itemsRes.data.map((it: any) => ({
              id: it.id,
              name: it.name,
              category: it.category,
              categoryArabic: it.category_arabic || it.categoryArabic || "عام",
              quantity: it.quantity || "١",
              urgency: (it.urgency as "high" | "normal" | "low") || "normal",
              notes: it.notes || "",
              addedBy: (it.added_by || it.addedBy || "home") as "admin" | "home",
              addedByName: it.added_by_name || it.addedByName || "",
              addedAt: it.added_at || it.addedAt || new Date().toISOString(),
              completed: Boolean(it.completed),
              completedAt: it.completed_at || it.completedAt || undefined,
            }));

            // Apply pending local INSERT operations that haven't reached the server yet
            const pendingInserts = activeQueue.filter(
              (q) => q.entity === "missing_items" && q.type === "INSERT" && (q.status === "PENDING" || q.status === "SYNCING")
            );
            for (const pi of pendingInserts) {
              const recId = pi.recordId || pi.payload.id;
              const existingIdx = mappedItems.findIndex((m) => m.id === recId);
              const insertItem: MissingItem = {
                id: recId,
                name: pi.payload.name || "",
                category: pi.payload.category || "general",
                categoryArabic: pi.payload.categoryArabic || pi.payload.category_arabic || "عام",
                quantity: pi.payload.quantity || "١",
                urgency: (pi.payload.urgency as "high" | "normal" | "low") || "normal",
                notes: pi.payload.notes || "",
                addedBy: (pi.payload.addedBy || pi.payload.added_by || "home") as "admin" | "home",
                addedByName: pi.payload.addedByName || pi.payload.added_by_name || "",
                addedAt: pi.payload.addedAt || pi.payload.added_at || new Date().toISOString(),
                completed: Boolean(pi.payload.completed),
                completedAt: pi.payload.completedAt || pi.payload.completed_at || undefined,
              };
              if (existingIdx >= 0) {
                mappedItems[existingIdx] = insertItem;
              } else {
                mappedItems.unshift(insertItem);
              }
            }

            // Apply pending local UPDATE/DELETE operations
            const pendingUpdates = activeQueue.filter(
              (q) => q.entity === "missing_items" && q.type === "UPDATE" && (q.status === "PENDING" || q.status === "SYNCING")
            );
            for (const pu of pendingUpdates) {
              mappedItems = mappedItems.map((m) => {
                if (m.id === pu.recordId) {
                  return {
                    ...m,
                    name: pu.payload.name !== undefined ? pu.payload.name : m.name,
                    quantity: pu.payload.quantity !== undefined ? pu.payload.quantity : m.quantity,
                    urgency: pu.payload.urgency !== undefined ? pu.payload.urgency : m.urgency,
                    notes: pu.payload.notes !== undefined ? pu.payload.notes : m.notes,
                    category: pu.payload.category !== undefined ? pu.payload.category : m.category,
                    categoryArabic: pu.payload.categoryArabic || pu.payload.category_arabic || m.categoryArabic,
                    completed: pu.payload.completed !== undefined ? Boolean(pu.payload.completed) : m.completed,
                    completedAt: pu.payload.completedAt || pu.payload.completed_at || m.completedAt,
                  };
                }
                return m;
              });
            }

            const pendingDeletes = activeQueue.filter(
              (q) => q.entity === "missing_items" && q.type === "DELETE" && (q.status === "PENDING" || q.status === "SYNCING")
            );
            const deleteIds = new Set(pendingDeletes.map((d) => d.recordId));
            mappedItems = mappedItems.filter((m) => !deleteIds.has(m.id));

            missingItemsRef.current = mappedItems;
            setMissingItems(mappedItems);
            cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "missing_items", mappedItems);
          } else {
            const cachedItems = cacheManager.getHouseholdCache<MissingItem[]>(authUser.id, activeHouseholdId, "missing_items");
            if (cachedItems && cachedItems.length > 0) {
              missingItemsRef.current = cachedItems;
              setMissingItems(cachedItems);
            }
          }

          // 2. Invoices:
          if (invRes?.success && Array.isArray(invRes.data)) {
            let mappedInvoices: PurchaseInvoice[] = invRes.data.map((inv: any) => ({
              id: inv.id,
              invoiceNumber: inv.invoice_number || inv.invoiceNumber,
              date: inv.date,
              category: inv.category,
              categoryArabic: inv.category_arabic || inv.categoryArabic || "عام",
              products: inv.products || [],
              totalPrice: Number(inv.total_price || inv.totalPrice) || 0,
              notes: inv.notes || "",
              registeredBy: inv.registered_by || inv.registeredBy || "المسؤول",
              paymentMethod: (inv.payment_method || inv.paymentMethod || "cash") as "cash" | "card" | "transfer",
            }));

            const pendingInvInserts = activeQueue.filter(
              (q) => q.entity === "invoices" && q.type === "INSERT" && (q.status === "PENDING" || q.status === "SYNCING")
            );
            for (const pi of pendingInvInserts) {
              if (!mappedInvoices.some((m) => m.id === pi.recordId)) {
                mappedInvoices.unshift({
                  id: pi.recordId || pi.payload.id,
                  invoiceNumber: pi.payload.invoiceNumber || pi.payload.invoice_number || `INV-${Date.now().toString().slice(-4)}`,
                  date: pi.payload.date || new Date().toISOString(),
                  category: pi.payload.category || "عام",
                  categoryArabic: pi.payload.categoryArabic || pi.payload.category_arabic || "عام",
                  products: pi.payload.products || [],
                  totalPrice: Number(pi.payload.totalPrice || pi.payload.total_price) || 0,
                  notes: pi.payload.notes || "",
                  registeredBy: pi.payload.registeredBy || pi.payload.registered_by || "المسؤول",
                  paymentMethod: (pi.payload.paymentMethod || pi.payload.payment_method || "cash") as "cash" | "card" | "transfer",
                });
              }
            }

            const pendingInvUpdates = activeQueue.filter(
              (q) => q.entity === "invoices" && q.type === "UPDATE" && (q.status === "PENDING" || q.status === "SYNCING")
            );
            for (const pu of pendingInvUpdates) {
              mappedInvoices = mappedInvoices.map((inv) => {
                if (inv.id === pu.recordId) {
                  return {
                    ...inv,
                    totalPrice: pu.payload.totalPrice !== undefined ? Number(pu.payload.totalPrice) : (pu.payload.total_price !== undefined ? Number(pu.payload.total_price) : inv.totalPrice),
                    notes: pu.payload.notes !== undefined ? pu.payload.notes : inv.notes,
                    products: pu.payload.products !== undefined ? pu.payload.products : inv.products,
                    paymentMethod: pu.payload.paymentMethod || pu.payload.payment_method || inv.paymentMethod,
                    category: pu.payload.category || inv.category,
                    categoryArabic: pu.payload.categoryArabic || pu.payload.category_arabic || inv.categoryArabic,
                    date: pu.payload.date || inv.date,
                  };
                }
                return inv;
              });
            }

            const pendingInvDeletes = activeQueue.filter(
              (q) => q.entity === "invoices" && q.type === "DELETE" && (q.status === "PENDING" || q.status === "SYNCING")
            );
            const invDeleteIds = new Set(pendingInvDeletes.map((d) => d.recordId));
            mappedInvoices = mappedInvoices.filter((inv) => !invDeleteIds.has(inv.id));

            // Load and preserve existing archived months from cache
            let currentArchives = cacheManager.getHouseholdCache<ArchivedMonthRecord[]>(authUser.id, activeHouseholdId, "archived_months") || [];
            if (!Array.isArray(currentArchives)) currentArchives = [];

            // Build set of all invoice IDs that are archived
            const archivedInvoiceIdSet = new Set<string>();
            currentArchives.forEach((arch) => {
              (arch.invoices || []).forEach((inv) => {
                archivedInvoiceIdSet.add(inv.id);
              });
            });

            // Also check if any invoices returned from Supabase contain archive tags in notes: [ARCHIVED:archId:monthName]
            const orphanedArchivedInvoices: Record<string, { monthName: string; invoices: PurchaseInvoice[] }> = {};
            mappedInvoices.forEach((inv) => {
              const match = (inv.notes || "").match(/\[ARCHIVED:([^:]+):([^\]]+)\]/);
              if (match) {
                const archId = match[1];
                const mName = match[2];
                archivedInvoiceIdSet.add(inv.id);
                if (!currentArchives.some((a) => a.id === archId)) {
                  if (!orphanedArchivedInvoices[archId]) {
                    orphanedArchivedInvoices[archId] = { monthName: mName, invoices: [] };
                  }
                  orphanedArchivedInvoices[archId].invoices.push(inv);
                }
              }
            });

            // Reconstruct any missing archive records from tagged Supabase invoices
            const reconstructedRecords: ArchivedMonthRecord[] = Object.entries(orphanedArchivedInvoices).map(
              ([archId, data]) => ({
                id: archId,
                monthName: data.monthName,
                archivedAt: new Date().toISOString(),
                invoicesCount: data.invoices.length,
                totalSpent: data.invoices.reduce((s, i) => s + (i.totalPrice || 0), 0),
                remainingBudget: 0,
                budgetLimit: 0,
                currency: "ج.م",
                invoices: data.invoices,
              })
            );

            if (reconstructedRecords.length > 0) {
              currentArchives = [...currentArchives, ...reconstructedRecords];
            }

            // Filter out ALL archived invoices from active invoices
            let activeInvoices = mappedInvoices.filter(
              (inv) => !archivedInvoiceIdSet.has(inv.id) && !(inv.notes || "").includes("[ARCHIVED:")
            );

            // Sync delivery orders actual prices to active invoices
            try {
              const ordersRes = await deliveryService.getHouseholdOrders(activeHouseholdId, authUser.id);
              if (ordersRes && ordersRes.length > 0) {
                setHouseholdOrders(ordersRes);

                // Reconcile and attach delivery orders to existing archived months if not already linked
                if (currentArchives.length > 0) {
                  currentArchives = currentArchives.map((arch) => {
                    const existingOrderIds = new Set((arch.deliveryOrders || []).map((o) => o.id));
                    const archTime = arch.archivedAt ? new Date(arch.archivedAt).getTime() : 0;
                    const archInvoiceIds = new Set((arch.invoices || []).map((i) => i.id));

                    const matchedOrders = ordersRes.filter((o) => {
                      if (existingOrderIds.has(o.id)) return false;
                      // Incomplete orders MUST NEVER BE ARCHIVED!
                      if (
                        o.status === "pending_review" ||
                        o.status === "accepted" ||
                        o.status === "shopping" ||
                        o.status === "cancellation_pending"
                      ) {
                        return false;
                      }
                      // If explicitly tagged with this archive ID
                      if ((o.delivery_notes || "").includes(arch.id)) return true;
                      // If order invoice is in this archive
                      if (o.invoice_id && archInvoiceIds.has(o.invoice_id)) return true;
                      // If order was created before this archive date
                      if (archTime > 0 && o.created_at && new Date(o.created_at).getTime() <= archTime + 5000) {
                        return true;
                      }
                      return false;
                    });

                    if (matchedOrders.length > 0) {
                      return {
                        ...arch,
                        deliveryOrders: [...(arch.deliveryOrders || []), ...matchedOrders],
                      };
                    }
                    return arch;
                  });
                }

                activeInvoices = activeInvoices.map((inv) => {
                  const matchingOrder = ordersRes.find((ord) => ord.invoice_id === inv.id);
                  if (
                    matchingOrder &&
                    matchingOrder.actual_items_total !== undefined &&
                    matchingOrder.actual_items_total !== null &&
                    matchingOrder.actual_items_total > 0 &&
                    (matchingOrder.status === "completed" || matchingOrder.status === "shopping")
                  ) {
                    // Accounting Rule: invoice.totalPrice represents PRODUCTS ONLY. Delivery fee is kept in delivery_order.
                    const targetProductsTotal = Number(matchingOrder.actual_items_total);

                    const updatedProducts = inv.products.map((p) => {
                      const matchedItem = matchingOrder.items?.find(
                        (it) => it.product_id === p.id || it.product_name === p.name
                      );
                      if (matchedItem) {
                        return {
                          ...p,
                          price:
                            matchedItem.item_status === "missing"
                              ? 0
                              : (matchedItem.actual_total_price !== undefined && matchedItem.actual_total_price !== null
                                ? Number(matchedItem.actual_total_price)
                                : Number(matchedItem.total_price) || 0),
                        };
                      }
                      return p;
                    });

                    return {
                      ...inv,
                      totalPrice: targetProductsTotal,
                      products: updatedProducts,
                    };
                  }
                  return inv;
                });
              }
            } catch (orderSyncErr) {
              console.warn("[AppContext] Delivery order sync error:", orderSyncErr);
            }

            setInvoices(activeInvoices);
            setArchivedMonths(currentArchives);
            isArchivesHydratedRef.current = true;
            cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "invoices", activeInvoices);
            cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "archived_months", currentArchives);
          } else {
            const cachedInvoices = cacheManager.getHouseholdCache<PurchaseInvoice[]>(authUser.id, activeHouseholdId, "invoices");
            if (cachedInvoices !== null && Array.isArray(cachedInvoices)) setInvoices(cachedInvoices);
            const cachedArch = cacheManager.getHouseholdCache<ArchivedMonthRecord[]>(authUser.id, activeHouseholdId, "archived_months");
            if (cachedArch !== null && Array.isArray(cachedArch)) {
              setArchivedMonths(cachedArch);
              isArchivesHydratedRef.current = true;
            }
          }

          // 3. Budget:
          if (budgetRes?.success && budgetRes.data) {
            const b = budgetRes.data;
            const cfg: BudgetConfig = {
              monthlyLimit: Number(b.monthly_limit) || 2500,
              currency: b.currency || "ج.م",
              month: b.month || "الشهر الحالي",
            };

            const pendingBudget = activeQueue.find(
              (q) => q.entity === "household_budgets" && (q.status === "PENDING" || q.status === "SYNCING")
            );
            if (pendingBudget) {
              const bp = pendingBudget.payload;
              if (bp.monthly_limit !== undefined || bp.monthlyLimit !== undefined) {
                cfg.monthlyLimit = Number(bp.monthlyLimit || bp.monthly_limit);
              }
              if (bp.currency !== undefined) cfg.currency = bp.currency;
              if (bp.month !== undefined) cfg.month = bp.month;
            }

            setBudgetConfig(cfg);
            cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "budget", cfg);
          } else {
            const cachedBudget = cacheManager.getHouseholdCache<BudgetConfig>(authUser.id, activeHouseholdId, "budget");
            if (cachedBudget) setBudgetConfig(cachedBudget);
          }

          // 4. Categories & Product Catalog (Global Central Catalog `global_categories` is authoritative):
          let finalCats: CategoryInfo[] = [];

          // Map any household custom categories from public.categories
          const householdCustomOrLegacy: CategoryInfo[] =
            catRes?.success && Array.isArray(catRes.data)
              ? catRes.data.map((c: any) => ({
                  id: c.id,
                  nameAr: c.name_ar || c.nameAr || "",
                  nameEn: c.name_en || c.nameEn || "",
                  imageUrl: c.image_url || c.imageUrl || "",
                  iconName: c.icon_name || c.iconName || "ShoppingCart",
                  color: c.color || "emerald",
                  bgLight: c.bg_light || c.bgLight || "bg-emerald-50 text-emerald-800 border-emerald-200",
                  badgeColor: c.badge_color || c.badgeColor || "bg-emerald-100 text-emerald-800",
                  description: c.description || "",
                  commonItems: c.common_items || c.commonItems || [],
                  subcategories: normalizeSubcategories(c.subcategories),
                  isCustom: c.is_custom !== undefined ? Boolean(c.is_custom) : false,
                  isActive: c.is_active !== false && c.isActive !== false,
                  sortOrder: c.sort_order ?? c.sortOrder ?? 999,
                }))
              : [];

          try {
            // First: Fetch global central categories from Supabase `global_categories`
            const globalCats = await catalogService.getGlobalCategories();
            if (globalCats && globalCats.length > 0) {
              finalCats = buildCategoriesFromGlobalAndCustom(globalCats, householdCustomOrLegacy);
            }
          } catch (gcErr) {
            console.warn("[AppContext] Note on global categories fetch:", gcErr);
          }

          // Fallback for offline / network failure when globalCats was empty:
          if (finalCats.length === 0) {
            const globalCached = cacheManager.getGlobalCache<any[]>("global_categories");
            if (globalCached && Array.isArray(globalCached) && globalCached.length > 0) {
              finalCats = buildCategoriesFromGlobalAndCustom(globalCached, householdCustomOrLegacy);
            } else {
              const cachedCats = cacheManager.getHouseholdCache<CategoryInfo[]>(authUser.id, activeHouseholdId, "categories");
              if (cachedCats && Array.isArray(cachedCats) && cachedCats.length > 0) {
                finalCats = cachedCats;
              } else if (householdCustomOrLegacy.length > 0) {
                finalCats = householdCustomOrLegacy;
              } else {
                finalCats = [...CATEGORIES];
              }
            }
          }

          // Apply pending local category operations (INSERT / UPSERT / UPDATE) from sync queue
          const pendingCatMutations = activeQueue.filter(
            (q) => q.entity === "categories" && (q.type === "INSERT" || q.type === "UPSERT" || q.type === "UPDATE") && (q.status === "PENDING" || q.status === "SYNCING")
          );
          for (const pcm of pendingCatMutations) {
            const p = pcm.payload;
            const catItem: CategoryInfo = {
              id: pcm.recordId || p.id,
              nameAr: p.name_ar || p.nameAr || "",
              nameEn: p.name_en || p.nameEn || "",
              imageUrl: p.image_url || p.imageUrl || "",
              iconName: p.icon_name || p.iconName || "ShoppingCart",
              color: p.color || "emerald",
              bgLight: p.bg_light || p.bgLight || "bg-emerald-50 text-emerald-800 border-emerald-200",
              badgeColor: p.badge_color || p.badgeColor || "bg-emerald-100 text-emerald-800",
              description: p.description || "",
              commonItems: p.common_items || p.commonItems || [],
              subcategories: normalizeSubcategories(p.subcategories),
              isCustom: p.is_custom !== undefined ? Boolean(p.is_custom) : (p.isCustom !== undefined ? Boolean(p.isCustom) : true),
            };
            const idx = finalCats.findIndex((m) => m.id === catItem.id);
            if (idx >= 0) {
              finalCats[idx] = { ...finalCats[idx], ...catItem };
            } else {
              finalCats.push(catItem);
            }
          }

          const pendingCatDeletes = activeQueue.filter(
            (q) => q.entity === "categories" && q.type === "DELETE" && (q.status === "PENDING" || q.status === "SYNCING")
          );
          const catDeleteIds = new Set(pendingCatDeletes.map((d) => d.recordId));
          finalCats = finalCats.filter((c) => !catDeleteIds.has(c.id));

          setCategories(finalCats);
          cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "categories", finalCats);
          cacheManager.setHouseholdCache(
            authUser.id,
            activeHouseholdId,
            "custom_categories",
            finalCats.filter((c) => Boolean(c.isCustom))
          );

          // 5. Notifications:
          if (notifRes?.success && Array.isArray(notifRes.data)) {
            const mappedNotifs: AppNotification[] = notifRes.data.map((n: any) => ({
              id: n.id,
              title: n.title,
              message: n.message,
              type: n.type || "item_added",
              timestamp: n.created_at || new Date().toISOString(),
              targetRole: n.target_role || "all",
              read: n.read || false,
            }));
            setNotifications(mappedNotifs);
            cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "notifications", mappedNotifs);
          } else {
            const cachedNotifs = cacheManager.getHouseholdCache<AppNotification[]>(authUser.id, activeHouseholdId, "notifications");
            if (cachedNotifs) setNotifications(cachedNotifs);
          }

          // Authoritatively commit household info, role, and mark household as ready
          setHousehold(hhInfo);
          setActiveRole(memberRole);
          setHouseholdStatus("HOUSEHOLD_FOUND");

          const authoritativeProfile: SupabaseProfile = {
            id: authUser.id,
            email: authUser.email,
            fullName,
            phone,
            householdId: activeHouseholdId,
            role: memberRole,
          };
          setSupabaseProfile(authoritativeProfile);
          cacheManager.setUserCache(authUser.id, "profile", authoritativeProfile);

          // Cache household info
          cacheManager.setHouseholdCache(authUser.id, activeHouseholdId, "household_info", hhInfo);

          // If any previous operations failed due to previous schema issues, auto-retry now that schema is aligned!
          if (activeQueue.some((q) => q.status === "FAILED")) {
            syncManager.retryFailedOperations();
          } else {
            // Trigger queue processing for any pending items
            syncManager.triggerQueueProcessing();
          }

          if (seq !== authSequenceRef.current) return;
          // 5. READY STAGE: All data, household, and permissions authoritatively ready
          setAuthStatus("READY");
          setAuthError(null);
          return;
        }
      }

      // If no valid household found in Supabase
      setHousehold(null);
      setHouseholdStatus("HOUSEHOLD_NOT_FOUND");
      setActiveRole("guest");
      setHouseholdMembers([]);
      setActivePairingToken(null);
      setMissingItems([]);
      setInvoices([]);
      setNotifications([]);

      if (seq !== authSequenceRef.current) return;
      setAuthStatus("READY");
      setAuthError(null);
    } catch (err: any) {
      console.warn("Error synchronizing authenticated user data:", err);
      setHouseholdStatus("HOUSEHOLD_ERROR");
      if (seq === authSequenceRef.current) {
        setAuthStatus("ERROR");
        setAuthError(err?.message || "فشل مزامنة بيانات المستخدم والمنزل");
      }
    }
  };

  // Initialize Supabase Auth Lifecycle (Single Authoritative Source of Identity)
  useEffect(() => {
    // Purge any stale mock session keys
    try {
      localStorage.removeItem("talabat_auth_session");
    } catch {}

    if (!supabase) {
      setAuthStatus("UNAUTHENTICATED");
      setAuthError("Supabase environment configuration is missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setSupabaseUser(null);
      setSupabaseSession(null);
      setSupabaseProfile(null);
      resetAllUserDataState();
      return;
    }

    let isMounted = true;
    const currentSeq = ++authSequenceRef.current;

    // OFFLINE-FIRST: Immediate instant bootstrap from secure local cache
    const cachedSession = cacheManager.getStoredSession();
    if (cachedSession?.user) {
      const cachedUserId = cachedSession.user.id;
      const cachedProfile = cacheManager.getUserCache(cachedUserId, "profile");
      const cachedLastHhId = cacheManager.getUserCache<string>(cachedUserId, "last_household_id");
      const cachedLastRole = cacheManager.getUserCache<UserRole>(cachedUserId, "last_role");

      setSupabaseSession(cachedSession);
      setSupabaseUser(cachedSession.user);

      if (cachedProfile) {
        setSupabaseProfile(cachedProfile);
      } else {
        setSupabaseProfile({
          id: cachedSession.user.id,
          email: cachedSession.user.email,
          fullName: cachedSession.user.user_metadata?.full_name || "المسؤول",
          phone: cachedSession.user.user_metadata?.phone || "",
          householdId: cachedLastHhId || undefined,
          role: cachedLastRole || "admin",
        });
      }

      if (cachedLastHhId) {
        const cachedHhInfo = cacheManager.getHouseholdCache<HouseholdInfo>(cachedUserId, cachedLastHhId, "household_info");
        if (cachedHhInfo) {
          setHousehold(cachedHhInfo);
          setHouseholdStatus("LOADED");
        }
        if (cachedLastRole) {
          setActiveRole(cachedLastRole);
        }
        const cachedMissing = cacheManager.getHouseholdCache<MissingItem[]>(cachedUserId, cachedLastHhId, "missing_items");
        if (cachedMissing && cachedMissing.length > 0) {
          missingItemsRef.current = cachedMissing;
          setMissingItems(cachedMissing);
        }
        const cachedInvoices = cacheManager.getHouseholdCache<PurchaseInvoice[]>(cachedUserId, cachedLastHhId, "invoices");
        if (cachedInvoices !== null && Array.isArray(cachedInvoices)) setInvoices(cachedInvoices);
        const cachedArchived = cacheManager.getHouseholdCache<ArchivedMonthRecord[]>(cachedUserId, cachedLastHhId, "archived_months");
        if (cachedArchived !== null && Array.isArray(cachedArchived)) {
          setArchivedMonths(cachedArchived);
          isArchivesHydratedRef.current = true;
        }
        const cachedBudget = cacheManager.getHouseholdCache<BudgetConfig>(cachedUserId, cachedLastHhId, "budget");
        if (cachedBudget) setBudgetConfig(cachedBudget);
        const cachedPerms = cacheManager.getHouseholdCache<HomePermissions>(cachedUserId, cachedLastHhId, "permissions");
        if (cachedPerms) setHomePermissions(cachedPerms);
        const globalCached = cacheManager.getGlobalCache<any[]>("global_categories");
        const customCached = cacheManager.getHouseholdCache<CategoryInfo[]>(cachedUserId, cachedLastHhId, "custom_categories");
        if (globalCached && Array.isArray(globalCached) && globalCached.length > 0) {
          const built = buildCategoriesFromGlobalAndCustom(globalCached, customCached);
          if (built.length > 0) setCategories(built);
        } else {
          const cachedCats = cacheManager.getHouseholdCache<CategoryInfo[]>(cachedUserId, cachedLastHhId, "categories");
          if (cachedCats && cachedCats.length > 0) {
            setCategories(cachedCats);
          }
        }
        syncManager.setAuthSession(cachedUserId, cachedLastHhId, cachedSession.access_token, cachedSession.refresh_token);
        // Valid offline data loaded: can be immediately READY
        setAuthStatus("READY");
        setAuthError(null);
      } else {
        setAuthStatus("SESSION");
      }
    }

    // 1. Authoritative initial session retrieval from Supabase Auth
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;

      const hasCachedSession = Boolean(cacheManager.getStoredSession()?.user);

      if (error) {
        console.warn("[AppContext] Error retrieving Supabase auth session on startup:", error);
        if (!hasCachedSession) {
          setAuthStatus("ERROR");
          setAuthError(error.message);
          setSupabaseUser(null);
          setSupabaseSession(null);
          setSupabaseProfile(null);
          resetAllUserDataState();
        }
      } else if (!session?.user) {
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        if (isOffline && hasCachedSession) {
          console.log("[AppContext] Offline with valid cached session. Preserving local authentication.");
          return;
        }
        activeHydrationTokenRef.current = null;
        setAuthStatus("UNAUTHENTICATED");
        setAuthError(null);
        setSupabaseUser(null);
        setSupabaseSession(null);
        setSupabaseProfile(null);
        resetAllUserDataState();
      } else {
        cacheManager.setStoredSession(session.user.id, session);
        // Avoid duplicate hydration if onAuthStateChange already started or finished for this token
        if (activeHydrationTokenRef.current === session.access_token) {
          return;
        }
        activeHydrationTokenRef.current = session.access_token;
        const syncSeq = ++authSequenceRef.current;
        syncAuthenticatedUserData(session.user, session, syncSeq);
      }
    }).catch((err: any) => {
      console.warn("[AppContext] Unexpected error during startup Supabase getSession:", err);
      const hasCachedSession = Boolean(cacheManager.getStoredSession()?.user);
      if (isMounted && !hasCachedSession) {
        setAuthStatus("ERROR");
        setAuthError(err?.message || "Failed to initialize Supabase session.");
        setSupabaseUser(null);
        setSupabaseSession(null);
        setSupabaseProfile(null);
        resetAllUserDataState();
      }
    });

    // 2. Real-time auth state changes (Single authoritative listener)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        console.log("Supabase Auth Event:", event, session?.user?.id);

        if (event === "SIGNED_OUT" || (!session?.user && typeof navigator !== "undefined" && navigator.onLine)) {
          ++authSequenceRef.current;
          activeHydrationTokenRef.current = null;
          if (event === "SIGNED_OUT") {
            cacheManager.clearActiveSession();
          }
          setAuthStatus("UNAUTHENTICATED");
          setAuthError(null);
          setSupabaseSession(null);
          setSupabaseUser(null);
          setSupabaseProfile(null);
          resetAllUserDataState();
        } else if (session?.user) {
          cacheManager.setStoredSession(session.user.id, session);
          if (isSigningUpRef.current) {
            setSupabaseSession(session);
            setSupabaseUser(session.user);
            return;
          }
          // Avoid duplicate hydration if already processed or processing for this token
          if (activeHydrationTokenRef.current === session.access_token) {
            return;
          }
          activeHydrationTokenRef.current = session.access_token;
          const eventSeq = ++authSequenceRef.current;
          syncAuthenticatedUserData(session.user, session, eventSeq);
        }
      }
    );

    // 3. Handle Native Deep Linking (Pairing & Supabase OAuth) on Android/iOS
    let appUrlListener: any = null;

    const handleIncomingAppUrl = async (urlStr: string) => {
      if (!urlStr) return;
      console.log("[AppContext] Deep link URL received:", urlStr);

      // Close native browser tab if open
      try {
        await Browser.close();
      } catch {}

      // A. Check for PAIRING deep link (Requirement 10, 11, 19)
      // Scheme: com.talabat.albayt://pair?token=... or /pair?token=...
      const isPairingLink =
        urlStr.includes("://pair") ||
        urlStr.includes("/pair?") ||
        urlStr.includes("pair?token=") ||
        urlStr.includes("token=PAIR-") ||
        (urlStr.includes("token=") && !urlStr.includes("access_token="));

      if (isPairingLink) {
        console.log("[AppContext] Handling PAIRING deep link:", urlStr);
        let pairingToken: string | null = null;
        try {
          const queryIndex = urlStr.indexOf("?");
          if (queryIndex !== -1) {
            const queryString = urlStr.slice(queryIndex + 1).split("#")[0];
            const queryParams = new URLSearchParams(queryString);
            pairingToken = queryParams.get("token") || queryParams.get("pair") || queryParams.get("code");
          }
        } catch {}
        if (!pairingToken) {
          const match = urlStr.match(/[?&](?:token|pair|code)=([^&#]+)/i);
          if (match && match[1]) {
            pairingToken = decodeURIComponent(match[1]);
          }
        }

        if (pairingToken) {
          console.log("[AppContext] Consuming pairing deep link token:", pairingToken);
          const cleanCode = pairingToken.trim().toUpperCase();
          if (typeof window !== "undefined" && window.history?.replaceState) {
            try {
              window.history.replaceState({}, document.title, window.location.pathname);
            } catch {}
          }
          joinHouseholdByCode(cleanCode, "هاتف المنزل").then((res) => {
            if (res.success) {
              try {
                confetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 },
                  colors: ["#10B981", "#3B82F6", "#F59E0B"],
                });
              } catch {}
            }
          });
          return;
        }
      }

      // B. Check for AUTH deep link (OAuth Callback)
      if (!supabase) return;
      const isAuthCallback =
        urlStr.includes("/auth/callback") ||
        urlStr.includes("access_token=") ||
        urlStr.includes("refresh_token=") ||
        (urlStr.includes("code=") && !urlStr.includes("pair"));

      if (!isAuthCallback) return;

      try {
        let code: string | null = null;
        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        let errorMsg: string | null = null;

        // Query parameters parsing (e.g. ?code=... or ?error=...)
        const queryIndex = urlStr.indexOf("?");
        if (queryIndex !== -1) {
          const queryString = urlStr.slice(queryIndex + 1).split("#")[0];
          const queryParams = new URLSearchParams(queryString);
          code = queryParams.get("code");
          errorMsg = queryParams.get("error_description") || queryParams.get("error");
        }

        // Hash parameters parsing (e.g. #access_token=...&refresh_token=...)
        const hashIndex = urlStr.indexOf("#");
        if (hashIndex !== -1) {
          const hashString = urlStr.slice(hashIndex + 1);
          const hashParams = new URLSearchParams(hashString);
          if (!code) code = hashParams.get("code");
          accessToken = hashParams.get("access_token");
          refreshToken = hashParams.get("refresh_token");
          if (!errorMsg) {
            errorMsg = hashParams.get("error_description") || hashParams.get("error");
          }
        }

        if (errorMsg) {
          console.error("[AppContext] OAuth callback returned error:", errorMsg);
          setAuthError(`فشل المصادقة عبر Google: ${errorMsg}`);
          return;
        }

        if (code) {
          console.log("[AppContext] Exchanging PKCE authorization code for Supabase session...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[AppContext] Code exchange error:", error);
            setAuthError(error.message);
          } else if (data?.session) {
            console.log("[AppContext] PKCE session exchange successful!");
          }
        } else if (accessToken && refreshToken) {
          console.log("[AppContext] Setting Supabase session from implicit OAuth tokens...");
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error("[AppContext] Set session error:", error);
            setAuthError(error.message);
          } else if (data?.session) {
            console.log("[AppContext] Implicit OAuth session established successfully!");
          }
        }
      } catch (err: any) {
        console.error("[AppContext] Error processing OAuth deep link:", err);
      }
    };

    if (Capacitor.isNativePlatform()) {
      CapApp.getLaunchUrl()
        .then((launchUrl) => {
          if (launchUrl?.url) {
            handleIncomingAppUrl(launchUrl.url);
          }
        })
        .catch((e) => {
          console.warn("[AppContext] Error checking launch URL:", e);
        });

      CapApp.addListener("appUrlOpen", (data) => {
        if (data?.url) {
          handleIncomingAppUrl(data.url);
        }
      })
        .then((listener) => {
          appUrlListener = listener;
        })
        .catch((e) => {
          console.warn("[AppContext] Error registering appUrlOpen listener:", e);
        });

      // 4. Initialize FCM Push Notifications on native device
      fcmService.init({
        onTokenReceived: (token) => {
          console.log("[AppContext] FCM Device Token received:", token);
        },
        onNotificationReceived: (payload) => {
          console.log("[AppContext] FCM Foreground notification received:", payload);
          if (payload.title || payload.body) {
            const notif: AppNotification = {
              id: payload.id || `fcm-${Date.now()}`,
              title: payload.title || "إشعار جديد",
              message: payload.body || "",
              type: (payload.data?.type as any) || "urgent_alert",
              timestamp: new Date().toISOString(),
              targetRole: "all",
              read: false,
              meta: payload.data,
            };
            setNotifications((prev) => [notif, ...prev]);
          }
        },
        onNotificationActionPerformed: (payload) => {
          console.log("[AppContext] Notification tapped by user:", payload);
          setIsNotificationsModalOpen(true);
        },
        onError: (err) => {
          console.warn("[AppContext] FCM initialization warning:", err);
        },
      });
    } else if (typeof window !== "undefined" && window.location.href) {
      const currentUrl = window.location.href;
      if (
        currentUrl.includes("token=") ||
        currentUrl.includes("code=") ||
        currentUrl.includes("access_token=")
      ) {
        handleIncomingAppUrl(currentUrl);
      }
    }

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
      if (appUrlListener?.remove) {
        appUrlListener.remove();
      }
      fcmService.destroy();
    };
  }, []);

  // Supabase Auth Operations (Directly via Supabase Auth API)
  const signInWithEmail = async (email: string, pass: string) => {
    if (!supabase) {
      setAuthStatus("UNAUTHENTICATED");
      setSupabaseSession(null);
      setSupabaseUser(null);
      setSupabaseProfile(null);
      return {
        error: new Error(
          "بيانات الاتصال بـ Supabase غير مهيأة في بيئة التطبيق (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY). يرجى تكوينها أولاً."
        ),
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      if (error) {
        activeHydrationTokenRef.current = null;
        setAuthStatus("UNAUTHENTICATED");
        setAuthError(error.message);
        setSupabaseSession(null);
        setSupabaseUser(null);
        setSupabaseProfile(null);
        return { error };
      }

      if (data.session && data.user) {
        const seq = ++authSequenceRef.current;
        activeHydrationTokenRef.current = data.session.access_token;
        await syncAuthenticatedUserData(data.user, data.session, seq);
        return { error: null, user: data.user };
      } else {
        activeHydrationTokenRef.current = null;
        setAuthStatus("UNAUTHENTICATED");
        setSupabaseSession(null);
        setSupabaseUser(null);
        setSupabaseProfile(null);
        return {
          error: new Error("لم يتم استلام جلسة مصادقة صالحة من Supabase Auth."),
        };
      }
    } catch (err: any) {
      activeHydrationTokenRef.current = null;
      setAuthStatus("ERROR");
      setAuthError(err?.message || "خطأ أثناء تسجيل الدخول");
      setSupabaseSession(null);
      setSupabaseUser(null);
      setSupabaseProfile(null);
      return { error: err };
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    fullName: string,
    phone?: string,
    householdName?: string
  ) => {
    if (!supabase) {
      setAuthStatus("UNAUTHENTICATED");
      setSupabaseSession(null);
      setSupabaseUser(null);
      setSupabaseProfile(null);
      return {
        error: new Error(
          "بيانات الاتصال بـ Supabase غير مهيأة في بيئة التطبيق (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY). يرجى تكوينها أولاً."
        ),
      };
    }

    // Requirement 8: Prevent admin accounts from using @talbat.com / @talabat.com to bypass confirmation
    const normalizedEmail = email.trim().toLowerCase();
    if (
      normalizedEmail.endsWith("@talbat.com") ||
      normalizedEmail.includes("@talbat.com") ||
      normalizedEmail.endsWith("@talabat.com") ||
      normalizedEmail.includes("@talabat.com")
    ) {
      setAuthStatus("UNAUTHENTICATED");
      const err = new Error(
        "نطاق @talbat.com مخصص حصرياً لهواتف المنزل الداخلية ولا يُسمح باستخدامه لحسابات المسؤولين. يرجى استخدام بريد إلكتروني حقيقي خاص بك."
      );
      setAuthError(err.message);
      return { error: err };
    }

    isSigningUpRef.current = true;
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: pass,
        options: {
          data: {
            full_name: fullName,
            phone,
            household_name: householdName || "منزل العائلة",
            role: "admin",
          },
        },
      });

      if (error) {
        setAuthStatus("UNAUTHENTICATED");
        setAuthError(error.message);
        setSupabaseSession(null);
        setSupabaseUser(null);
        setSupabaseProfile(null);
        return { error };
      }

      if (data.session && data.user) {
        const seq = ++authSequenceRef.current;
        activeHydrationTokenRef.current = data.session.access_token;
        await syncAuthenticatedUserData(data.user, data.session, seq);
        return { error: null, user: data.user };
      } else if (data.user && !data.session) {
        // Requirement 2 & 6: Email confirmation required! Registration is not complete without email confirmation.
        setAuthStatus("UNAUTHENTICATED");
        setAuthError(null);
        setSupabaseSession(null);
        setSupabaseUser(null);
        setSupabaseProfile(null);
        return {
          error: null,
          user: data.user,
          requiresConfirmation: true,
          message: "تم إنشاء الحساب بنجاح. يرجى تأكيد بريدك الإلكتروني لتفعيل الحساب ثم تسجيل الدخول.",
        };
      } else {
        setAuthStatus("UNAUTHENTICATED");
        setSupabaseSession(null);
        setSupabaseUser(null);
        setSupabaseProfile(null);
        return {
          error: new Error("فشل إنشاء جلسة مصادقة صالحة من Supabase Auth."),
        };
      }
    } catch (err: any) {
      setAuthStatus("ERROR");
      setAuthError(err?.message || "خطأ أثناء إنشاء الحساب");
      setSupabaseSession(null);
      setSupabaseUser(null);
      setSupabaseProfile(null);
      return { error: err };
    } finally {
      isSigningUpRef.current = false;
    }
  };

  const signInWithGoogle = async (): Promise<{ error: any; data?: any }> => {
    if (!supabase) {
      return {
        error: new Error(
          "بيانات الاتصال بـ Supabase غير مهيأة في بيئة التطبيق. يرجى تكوينها أولاً."
        ),
      };
    }

    try {
      try {
        localStorage.setItem("talabat_auth_intent_role", "admin");
      } catch {}

      const isNative = Capacitor.isNativePlatform();
      const redirectUrl = isNative
        ? "com.talabat.albayt://auth/callback"
        : `${window.location.origin}/`;

      console.log("[AppContext] Initiating Google OAuth. redirectUrl:", redirectUrl, "isNative:", isNative);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        return { error };
      }

      if (isNative && data?.url) {
        console.log("[AppContext] Opening OAuth URL via Browser plugin:", data.url);
        await Browser.open({ url: data.url, windowName: "_self" });
      }

      return { error: null, data };
    } catch (err: any) {
      console.error("[AppContext] Google OAuth initiation failed:", err);
      return { error: err };
    }
  };

  const signInHomePhone = async (
    username: string,
    pass: string
  ): Promise<{ error: any; user?: User | null }> => {
    const cleanUser = username.trim();
    if (!cleanUser) {
      return { error: new Error("يرجى إدخال اسم مستخدم صالح لهاتف المنزل") };
    }
    const internalEmail = usernameToEmail(cleanUser);
    return signInWithEmail(internalEmail, pass);
  };

  const signUpHomePhone = async (
    username: string,
    pass: string,
    deviceName = "هاتف المنزل",
    pairCode?: string
  ): Promise<{ error: any; user?: User | null; message?: string }> => {
    if (!supabase) {
      return {
        error: new Error("بيانات الاتصال بـ Supabase غير مهيأة في بيئة التطبيق."),
      };
    }

    const cleanUser = username.trim();
    if (!cleanUser) {
      return { error: new Error("يرجى إدخال اسم مستخدم صالح لهاتف المنزل") };
    }
    if (!pass || pass.length < 6) {
      return { error: new Error("كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل") };
    }

    const internalEmail = usernameToEmail(cleanUser);

    try {
      isSigningUpRef.current = true;
      setAuthStatus("INITIALIZING");
      setAuthError(null);

      const { data, error } = await supabase.auth.signUp({
        email: internalEmail,
        password: pass,
        options: {
          data: {
            username: cleanUser,
            full_name: deviceName || "هاتف المنزل",
            role: "household_member",
            is_home_phone: true,
          },
        },
      });

      if (error) {
        setAuthStatus("UNAUTHENTICATED");
        setAuthError(error.message);
        return { error };
      }

      if (data.session && data.user) {
        const seq = ++authSequenceRef.current;
        setAuthStatus("AUTHENTICATED");
        setAuthError(null);
        setSupabaseSession(data.session);
        setSupabaseUser(data.user);

        // Ensure user profile is registered with role = household_member without auto-creating household
        await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            email: data.user.email,
            full_name: deviceName || "هاتف المنزل",
            role: "household_member",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        // If pair code was provided during creation, perform immediate joining
        if (pairCode && pairCode.trim()) {
          const pairRes = await joinHouseholdByCode(pairCode.trim(), deviceName || "هاتف المنزل");
          if (!pairRes.success) {
            await syncAuthenticatedUserData(data.user, data.session, seq);
            return {
              error: null,
              user: data.user,
              message: `تم إنشاء الحساب بنجاح، لكن واجه الربط تنبيهاً: ${pairRes.message}`,
            };
          }
        } else {
          await syncAuthenticatedUserData(data.user, data.session, seq);
        }

        return { error: null, user: data.user };
      } else if (data.user && !data.session) {
        setAuthStatus("UNAUTHENTICATED");
        return {
          error: null,
          user: data.user,
          message: "تم إنشاء حساب هاتف المنزل بنجاح. يمكنك الآن تسجيل الدخول مباشرة.",
        };
      } else {
        setAuthStatus("UNAUTHENTICATED");
        return { error: new Error("فشل إنشاء جلسة مصادقة لهاتف المنزل") };
      }
    } catch (err: any) {
      setAuthStatus("ERROR");
      setAuthError(err?.message || "خطأ أثناء تسجيل هاتف المنزل");
      return { error: err };
    } finally {
      isSigningUpRef.current = false;
    }
  };

  const signOutSupabase = async () => {
    ++authSequenceRef.current;
    activeHydrationTokenRef.current = null;
    try {
      syncManager.handleUserLogout();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn("Error signing out from Supabase:", e);
    }
    setAuthStatus("UNAUTHENTICATED");
    setAuthError(null);
    setSupabaseSession(null);
    setSupabaseUser(null);
    setSupabaseProfile(null);
    resetAllUserDataState();
    setActiveTab("auth");
  };

  const resetPassword = async (email: string) => {
    if (!supabase) {
      return {
        error: new Error(
          "بيانات الاتصال بـ Supabase غير مهيأة. يرجى تكوينها أولاً."
        ),
      };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const updateUserProfile = async (updates: {
    fullName?: string;
    email?: string;
    phone?: string;
  }): Promise<{ error: any }> => {
    // 1. Update local state
    if (supabaseProfile) {
      setSupabaseProfile((prev) =>
        prev
          ? {
              ...prev,
              fullName: updates.fullName !== undefined ? updates.fullName : prev.fullName,
              email: updates.email !== undefined ? updates.email : prev.email,
              phone: updates.phone !== undefined ? updates.phone : prev.phone,
            }
          : null
      );
    }

    if (supabaseUser) {
      setSupabaseUser((prev) =>
        prev
          ? {
              ...prev,
              email: updates.email || prev.email,
              user_metadata: {
                ...prev.user_metadata,
                full_name: updates.fullName || prev.user_metadata?.full_name,
                phone: updates.phone || prev.user_metadata?.phone,
              },
            }
          : null
      );
    }

    // Also update household admin info if this is the admin
    if (household && updates.fullName) {
      setHousehold((prev) =>
        prev
          ? {
              ...prev,
              adminName: updates.fullName || prev.adminName,
              adminPhone: updates.phone || prev.adminPhone,
            }
          : null
      );
    }

    if (!supabase) {
      return { error: null };
    }

    try {
      const userUpdates: any = {
        data: {},
      };
      if (updates.fullName !== undefined) userUpdates.data.full_name = updates.fullName;
      if (updates.phone !== undefined) userUpdates.data.phone = updates.phone;
      if (updates.email && updates.email !== supabaseUser?.email) {
        userUpdates.email = updates.email;
      }

      const { data, error } = await supabase.auth.updateUser(userUpdates);
      if (error) return { error };

      // Also update profiles table if exists
      if (data?.user) {
        try {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            email: updates.email || data.user.email,
            full_name: updates.fullName,
            phone: updates.phone,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn("Could not update profiles table:", e);
        }

        // If household admin, update households table
        if (household) {
          try {
            await supabase.from("households").update({
              admin_name: updates.fullName,
              admin_phone: updates.phone,
            }).eq("id", household.id);
          } catch (e) {
            console.warn("Could not update household admin details:", e);
          }
        }
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const updateUserPassword = async (newPassword: string): Promise<{ error: any }> => {
    if (!supabase) {
      return { error: null };
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Listen for real-time delivery order changes and custom events to keep householdOrders synchronized
  useEffect(() => {
    const handleOrdersUpdate = async () => {
      if (!household?.id) return;
      const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
      try {
        const freshOrders = await deliveryService.getHouseholdOrders(household.id, uid);
        setHouseholdOrders(freshOrders);
      } catch (e) {
        console.warn("[AppContext] Error updating household orders:", e);
      }
    };

    window.addEventListener("delivery-order-created", handleOrdersUpdate);
    window.addEventListener("delivery-orders-archived", handleOrdersUpdate);

    let channel: any = null;
    if (isSupabaseConfigured() && household?.id) {
      channel = supabase
        .channel(`household-appcontext-orders-${household.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "delivery_orders",
            filter: `household_id=eq.${household.id}`,
          },
          () => {
            handleOrdersUpdate();
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener("delivery-order-created", handleOrdersUpdate);
      window.removeEventListener("delivery-orders-archived", handleOrdersUpdate);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [household?.id, supabaseUser?.id]);

  // Centralized, Pure, and Idempotent Household Spending Calculation
  // Household Spending = Products Amount (Invoices) + Delivery Fees (Delivery Orders)
  // Rule 1 (Admin Direct Purchase): Products = Invoice totalPrice, Delivery = 0 => Spending = Invoice totalPrice
  // Rule 2 (Delivery Purchase): Products = Invoice totalPrice, Delivery = Delivery Order delivery_fee => Spending = Products + Delivery Fee
  // Rule 3 (Driver Modified Prices): Products = actual_items_total, Delivery = Delivery Order delivery_fee => Spending = actual_items_total + delivery_fee
  // Prevents Double Counting: Pure derivation with Map lookup on order.invoice_id (NO cumulative accumulation).
  const totalSpent = useMemo(() => {
    const activeOrders = householdOrders.filter((o) => {
      if (o.status === "cancelled") return false;
      if ((o.delivery_notes || "").includes("[ARCHIVED:")) return false;
      return true;
    });

    const ordersByInvoiceId = new Map<string, DeliveryOrder>();
    activeOrders.forEach((o) => {
      if (o.invoice_id) {
        ordersByInvoiceId.set(o.invoice_id, o);
      }
    });

    let total = 0;

    // 1. Invoices
    invoices.forEach((inv) => {
      const linkedOrder = ordersByInvoiceId.get(inv.id);
      if (linkedOrder) {
        // Delivery purchase:
        // Purchase products amount: if driver updated actual_items_total, use it
        const purchaseAmount =
          linkedOrder.actual_items_total !== undefined &&
          linkedOrder.actual_items_total !== null &&
          linkedOrder.actual_items_total > 0 &&
          (linkedOrder.status === "completed" || linkedOrder.status === "shopping")
            ? Number(linkedOrder.actual_items_total)
            : Number(inv.totalPrice) || 0;

        const deliveryFee = Number(linkedOrder.delivery_fee) || 0;
        total += purchaseAmount + deliveryFee;
      } else {
        // Direct admin purchase: delivery fee is 0
        total += Number(inv.totalPrice) || 0;
      }
    });

    // 2. Unlinked active delivery orders (if any exist without a corresponding invoice in invoices)
    activeOrders.forEach((o) => {
      if (!o.invoice_id || !invoices.some((inv) => inv.id === o.invoice_id)) {
        const purchaseAmount =
          o.actual_items_total !== undefined &&
          o.actual_items_total !== null &&
          o.actual_items_total > 0
            ? Number(o.actual_items_total)
            : Number(o.subtotal) || 0;
        const deliveryFee = Number(o.delivery_fee) || 0;
        total += purchaseAmount + deliveryFee;
      }
    });

    return total;
  }, [invoices, householdOrders]);

  const remainingBudget = Math.max(0, budgetConfig.monthlyLimit - totalSpent);
  const spentPercentage = Math.min(100, Math.round((totalSpent / budgetConfig.monthlyLimit) * 100));

  const unreadCount = notifications.filter(
    (n) =>
      !n.read &&
      (n.targetRole === "all" ||
        n.targetRole === activeRole ||
        (n.targetRole === "home" && activeRole === "household_member"))
  ).length;

  // Category Management Methods
  const addCategory = (cat: CategoryInfo) => {
    setCategories((prev) => {
      if (prev.some((c) => c.id === cat.id)) return prev;
      const updated = [...prev, cat];
      const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
      const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
      if (uid && hhid) {
        cacheManager.setHouseholdCache(uid, hhid, "categories", updated);
        cacheManager.setHouseholdCache(uid, hhid, "custom_categories", updated);
      }
      return updated;
    });

    if (household && supabaseUser) {
      syncManager.enqueueMutation(
        "categories",
        "INSERT",
        cat.id,
        {
          id: cat.id,
          household_id: household.id,
          name_ar: cat.nameAr,
          name_en: cat.nameEn,
          image_url: cat.imageUrl,
          icon_name: cat.iconName || "ShoppingCart",
          color: cat.color,
          bg_light: cat.bgLight,
          badge_color: cat.badgeColor,
          description: cat.description,
          common_items: cat.commonItems,
          subcategories: cat.subcategories || [],
          is_custom: true,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const updateCategory = (id: string, updated: Partial<CategoryInfo>) => {
    let updatedCat: CategoryInfo | undefined;
    setCategories((prev) => {
      const updatedList = prev.map((c) => {
        if (c.id === id) {
          updatedCat = { ...c, ...updated, isCustom: true };
          return updatedCat;
        }
        return c;
      });
      const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
      const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
      if (uid && hhid) {
        cacheManager.setHouseholdCache(uid, hhid, "categories", updatedList);
        cacheManager.setHouseholdCache(uid, hhid, "custom_categories", updatedList);
      }
      return updatedList;
    });

    if (updated.nameAr) {
      setMissingItems((prev) => {
        let changed = false;
        const updatedMissing = prev.map((m) => {
          if (m.category === id) {
            changed = true;
            return { ...m, categoryArabic: updated.nameAr! };
          }
          return m;
        });
        if (changed) {
          missingItemsRef.current = updatedMissing;
          const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
          const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
          if (uid && hhid) {
            cacheManager.setHouseholdCache(uid, hhid, "missing_items", updatedMissing);
          }
        }
        return changed ? updatedMissing : prev;
      });

      if (household && supabaseUser) {
        const itemsToUpdate = missingItemsRef.current.filter((m) => m.category === id);
        for (const it of itemsToUpdate) {
          syncManager.enqueueMutation(
            "missing_items",
            "UPDATE",
            it.id,
            { category_arabic: updated.nameAr },
            supabaseUser.id,
            household.id
          );
        }
      }
    }

    if (household && supabaseUser && updatedCat) {
      syncManager.enqueueMutation(
        "categories",
        "UPSERT",
        id,
        {
          id: updatedCat.id,
          household_id: household.id,
          name_ar: updatedCat.nameAr,
          name_en: updatedCat.nameEn,
          image_url: updatedCat.imageUrl,
          icon_name: updatedCat.iconName || "ShoppingCart",
          color: updatedCat.color,
          bg_light: updatedCat.bgLight,
          badge_color: updatedCat.badgeColor,
          description: updatedCat.description,
          common_items: updatedCat.commonItems,
          subcategories: updatedCat.subcategories || [],
          is_custom: true,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
      const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
      if (uid && hhid) {
        cacheManager.setHouseholdCache(uid, hhid, "categories", updated);
        cacheManager.setHouseholdCache(uid, hhid, "custom_categories", updated);
      }
      return updated;
    });

    if (household && supabaseUser) {
      syncManager.enqueueMutation(
        "categories",
        "DELETE",
        id,
        {},
        supabaseUser.id,
        household.id
      );

      // Cascade delete missing items in this category
      const itemsToDelete = missingItemsRef.current.filter((m) => m.category === id);
      if (itemsToDelete.length > 0) {
        const remainingMissing = missingItemsRef.current.filter((m) => m.category !== id);
        missingItemsRef.current = remainingMissing;
        setMissingItems(remainingMissing);
        cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", remainingMissing);
        for (const it of itemsToDelete) {
          syncManager.enqueueMutation(
            "missing_items",
            "DELETE",
            it.id,
            {},
            supabaseUser.id,
            household.id
          );
        }
      }
    }
  };

  const addProductToCategory = (
    categoryId: string,
    productName: string,
    subcategoryId?: string
  ) => {
    const trimmed = productName.trim();
    if (!trimmed) return;
    let modifiedCategory: CategoryInfo | undefined;
    setCategories((prev) => {
      const updatedList = prev.map((cat) => {
        if (cat.id === categoryId) {
          if (cat.commonItems.includes(trimmed)) return cat;
          const newItems = [...cat.commonItems, trimmed];

          let updatedSubcategories = cat.subcategories;
          if (cat.subcategories && cat.subcategories.length > 0) {
            if (subcategoryId) {
              updatedSubcategories = cat.subcategories.map((sub) =>
                sub.id === subcategoryId
                  ? { ...sub, items: [...sub.items.filter((i) => i !== trimmed), trimmed] }
                  : sub
              );
            } else {
              updatedSubcategories = cat.subcategories.map((sub, idx) =>
                idx === 0
                  ? { ...sub, items: [...sub.items.filter((i) => i !== trimmed), trimmed] }
                  : sub
              );
            }
          }

          modifiedCategory = {
            ...cat,
            commonItems: newItems,
            subcategories: updatedSubcategories,
            isCustom: true,
          };
          return modifiedCategory;
        }
        return cat;
      });

      const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
      const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
      if (uid && hhid) {
        cacheManager.setHouseholdCache(uid, hhid, "categories", updatedList);
        cacheManager.setHouseholdCache(uid, hhid, "custom_categories", updatedList);
      }
      return updatedList;
    });

    if (household && supabaseUser && modifiedCategory) {
      syncManager.enqueueMutation(
        "categories",
        "UPSERT",
        categoryId,
        {
          id: modifiedCategory.id,
          household_id: household.id,
          name_ar: modifiedCategory.nameAr,
          name_en: modifiedCategory.nameEn,
          image_url: modifiedCategory.imageUrl,
          icon_name: modifiedCategory.iconName || "ShoppingCart",
          color: modifiedCategory.color,
          bg_light: modifiedCategory.bgLight,
          badge_color: modifiedCategory.badgeColor,
          description: modifiedCategory.description,
          common_items: modifiedCategory.commonItems,
          subcategories: modifiedCategory.subcategories || [],
          is_custom: true,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const updateProductInCategory = (
    categoryId: string,
    oldName: string,
    newName: string,
    newSubcategoryId?: string
  ) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew) return;
    let modifiedCategory: CategoryInfo | undefined;
    setCategories((prev) => {
      const updatedList = prev.map((cat) => {
        if (cat.id === categoryId) {
          const newItems = cat.commonItems.map((item) =>
            item.trim().toLowerCase() === oldName.trim().toLowerCase() ? trimmedNew : item
          );

          let updatedSubcategories = cat.subcategories;
          if (cat.subcategories && cat.subcategories.length > 0) {
            updatedSubcategories = cat.subcategories.map((sub) => {
              const hasOld = sub.items.some((i) => i.trim().toLowerCase() === oldName.trim().toLowerCase());
              if (newSubcategoryId) {
                if (sub.id === newSubcategoryId) {
                  const filtered = sub.items.filter((i) => i.trim().toLowerCase() !== oldName.trim().toLowerCase() && i.trim().toLowerCase() !== trimmedNew.toLowerCase());
                  return { ...sub, items: [...filtered, trimmedNew] };
                } else if (hasOld) {
                  return { ...sub, items: sub.items.filter((i) => i.trim().toLowerCase() !== oldName.trim().toLowerCase()) };
                }
              } else if (hasOld) {
                return {
                  ...sub,
                  items: sub.items.map((i) => (i.trim().toLowerCase() === oldName.trim().toLowerCase() ? trimmedNew : i)),
                };
              }
              return sub;
            });
          }

          modifiedCategory = {
            ...cat,
            commonItems: newItems,
            subcategories: updatedSubcategories,
            isCustom: true,
          };
          return modifiedCategory;
        }
        return cat;
      });

      const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
      const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
      if (uid && hhid) {
        cacheManager.setHouseholdCache(uid, hhid, "categories", updatedList);
        cacheManager.setHouseholdCache(uid, hhid, "custom_categories", updatedList);
      }
      return updatedList;
    });

    // Update corresponding missing items in memory and cache immediately
    setMissingItems((prev) => {
      let changed = false;
      const updatedMissing = prev.map((m) => {
        if (
          m.category === categoryId &&
          m.name.trim().toLowerCase() === oldName.trim().toLowerCase()
        ) {
          changed = true;
          return { ...m, name: trimmedNew };
        }
        return m;
      });
      if (changed) {
        missingItemsRef.current = updatedMissing;
        const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
        const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
        if (uid && hhid) {
          cacheManager.setHouseholdCache(uid, hhid, "missing_items", updatedMissing);
        }
      }
      return changed ? updatedMissing : prev;
    });

    if (household && supabaseUser) {
      const matchingItems = missingItemsRef.current.filter(
        (m) => m.category === categoryId && m.name.trim().toLowerCase() === trimmedNew.toLowerCase()
      );
      for (const mItem of matchingItems) {
        syncManager.enqueueMutation(
          "missing_items",
          "UPDATE",
          mItem.id,
          { name: trimmedNew },
          supabaseUser.id,
          household.id
        );
      }
    }

    if (household && supabaseUser && modifiedCategory) {
      syncManager.enqueueMutation(
        "categories",
        "UPSERT",
        categoryId,
        {
          id: modifiedCategory.id,
          household_id: household.id,
          name_ar: modifiedCategory.nameAr,
          name_en: modifiedCategory.nameEn,
          image_url: modifiedCategory.imageUrl,
          icon_name: modifiedCategory.iconName || "ShoppingCart",
          color: modifiedCategory.color,
          bg_light: modifiedCategory.bgLight,
          badge_color: modifiedCategory.badgeColor,
          description: modifiedCategory.description,
          common_items: modifiedCategory.commonItems,
          subcategories: modifiedCategory.subcategories || [],
          is_custom: true,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const deleteProductFromCategory = (categoryId: string, productName: string) => {
    let modifiedCategory: CategoryInfo | undefined;
    setCategories((prev) => {
      const updatedList = prev.map((cat) => {
        if (cat.id === categoryId) {
          const newItems = cat.commonItems.filter((item) => item !== productName);
          const updatedSubcategories = cat.subcategories?.map((sub) => ({
            ...sub,
            items: sub.items.filter((item) => item !== productName),
          }));

          modifiedCategory = {
            ...cat,
            commonItems: newItems,
            subcategories: updatedSubcategories,
            isCustom: true,
          };
          return modifiedCategory;
        }
        return cat;
      });

      const uid = supabaseUser?.id || cacheManager.getStoredSession()?.user?.id;
      const hhid = household?.id || (uid ? cacheManager.getUserCache<string>(uid, "last_household_id") : null);
      if (uid && hhid) {
        cacheManager.setHouseholdCache(uid, hhid, "categories", updatedList);
        cacheManager.setHouseholdCache(uid, hhid, "custom_categories", updatedList);
      }
      return updatedList;
    });

    if (household && supabaseUser && modifiedCategory) {
      syncManager.enqueueMutation(
        "categories",
        "UPSERT",
        categoryId,
        {
          id: modifiedCategory.id,
          household_id: household.id,
          name_ar: modifiedCategory.nameAr,
          name_en: modifiedCategory.nameEn,
          image_url: modifiedCategory.imageUrl,
          icon_name: modifiedCategory.iconName || "ShoppingCart",
          color: modifiedCategory.color,
          bg_light: modifiedCategory.bgLight,
          badge_color: modifiedCategory.badgeColor,
          description: modifiedCategory.description,
          common_items: modifiedCategory.commonItems,
          subcategories: modifiedCategory.subcategories || [],
          is_custom: true,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const updateHomePermissions = (perms: HomePermissions) => {
    setHomePermissions(perms);
    if (household) {
      dbHelpers.upsertPermissions({
        household_id: household.id,
        allowed_screens: perms.allowedScreens,
        can_add_missing_item: perms.canAddMissingItem,
        can_delete_missing_item: perms.canDeleteMissingItem,
        can_edit_item: perms.canEditItem,
        can_add_invoice: perms.canAddInvoice,
        can_use_ai_assistant: perms.canUseAiAssistant,
        can_send_urgent_alert: perms.canSendUrgentAlert,
      });
    }
  };

  // Urgent Attention Ring Alert
  const sendHomeAttentionAlert = () => {
    // 1. Play realistic ring chime synthesizer
    playUrgentAlertRing();

    // 2. Add push notification
    const notif: AppNotification = {
      id: `notif-urgent-${Date.now()}`,
      title: "🚨 رنين تنبيه عاجل من هاتف المنزل!",
      message:
        "تم الضغط على زر التنبيه من هاتف المنزل للفت الانتباه إلى وجود نواقص ومستلزمات جديدة في البيت!",
      type: "urgent_alert",
      timestamp: new Date().toISOString(),
      targetRole: "admin",
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    // 3. Set incoming ring alert banner for Admin
    setIncomingAlert({
      active: true,
      timestamp: new Date().toISOString(),
      message: "هاتف المنزل يرسل رنين تنبيه لوجود نواقص جديدة!",
      from: "هاتف المنزل (المطبخ)",
    });

    // Auto dismiss ringing banner after 8 seconds
    setTimeout(() => {
      setIncomingAlert((prev) => (prev ? { ...prev, active: false } : null));
    }, 8000);
  };

  const dismissIncomingAlert = () => {
    setIncomingAlert(null);
  };

  const generatePairingToken = async (
    validityMinutes = 15
  ): Promise<{ success: boolean; token?: string; error?: string }> => {
    if (!household?.id || !supabaseUser?.id) {
      return { success: false, error: "يجب تسجيل الدخول كمسؤول للمنزل لتوليد رمز ربط" };
    }
    const tokenResult = await dbHelpers.createPairingToken(household.id, supabaseUser.id, validityMinutes);
    if (!tokenResult || !tokenResult.success) {
      const errMsg = tokenResult && "error" in tokenResult ? tokenResult.error : "فشل توليد رمز الربط الموقوت في قاعدة البيانات";
      return { success: false, error: errMsg };
    }
    const tokenRecord = tokenResult.data;
    setActivePairingToken({
      id: `tok_${Date.now()}`,
      householdId: tokenRecord.household_id,
      token: tokenRecord.token,
      createdBy: supabaseUser.id,
      createdAt: new Date().toISOString(),
      expiresAt: tokenRecord.expires_at,
      isUsed: false,
    });
    return { success: true, token: tokenRecord.token };
  };

  const createAdminHousehold = async (
    name: string,
    adminName: string,
    adminPhone: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!supabase || !supabaseUser) {
      return { success: false, error: "يجب تسجيل الدخول بحساب مسؤول أولاً عبر Supabase" };
    }

    const newHhId = `hh_${crypto.randomUUID()}`;
    const cleanName = name.trim() || "منزل العائلة";
    const cleanAdminName = adminName.trim() || supabaseProfile?.fullName || "المسؤول";
    const cleanAdminPhone = adminPhone.trim() || supabaseProfile?.phone || "";

    try {
      // 1. Create household record in database
      const { error: hhErr } = await supabase.from("households").upsert({
        id: newHhId,
        name: cleanName,
        admin_id: supabaseUser.id,
        admin_name: cleanAdminName,
        admin_phone: cleanAdminPhone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (hhErr) throw hhErr;

      // 2. Create authoritative membership for admin in household_members
      await supabase.from("household_members").upsert({
        household_id: newHhId,
        user_id: supabaseUser.id,
        role: "admin",
        user_name: cleanAdminName,
        user_phone: cleanAdminPhone,
        joined_at: new Date().toISOString(),
      }, { onConflict: "household_id,user_id" });

      // 3. Upsert default permissions for this household
      await supabase.from("household_permissions").upsert({
        household_id: newHhId,
        allowed_screens: DEFAULT_HOME_PERMISSIONS.allowedScreens,
        can_add_missing_item: true,
        can_delete_missing_item: false,
        can_edit_item: true,
        can_add_invoice: false,
        can_use_ai_assistant: true,
        can_send_urgent_alert: true,
      }, { onConflict: "household_id" });

      // Upsert default household budget
      await supabase.from("household_budgets").upsert({
        household_id: newHhId,
        monthly_limit: 2500,
        currency: "ج.م",
        month: "الشهر الحالي",
        updated_at: new Date().toISOString(),
      }, { onConflict: "household_id" });

      // 4. Initialize household categories cache from active categories without cloning to public.categories
      const activeCats = categories && categories.length > 0 ? categories : CATEGORIES;
      cacheManager.setHouseholdCache(supabaseUser.id, newHhId, "categories", activeCats);
      cacheManager.setHouseholdCache(supabaseUser.id, newHhId, "custom_categories", activeCats);

      // 5. Generate first secure pairing token (15 minutes valid)
      const tokenRes = await dbHelpers.createPairingToken(newHhId, supabaseUser.id, 15);
      const tokenRec = tokenRes.success ? tokenRes.data : null;

      // 5. Update profiles table with authoritative household link
      await supabase.from("profiles").upsert({
        id: supabaseUser.id,
        household_id: newHhId,
        role: "admin",
        full_name: cleanAdminName,
        phone: cleanAdminPhone,
        updated_at: new Date().toISOString(),
      });

      const newHousehold: HouseholdInfo = {
        id: newHhId,
        name: cleanName,
        adminId: supabaseUser.id,
        adminName: cleanAdminName,
        adminPhone: cleanAdminPhone,
        createdAt: new Date().toISOString(),
        pairCode: tokenRec?.token || undefined,
      };

      setHousehold(newHousehold);
      setHouseholdStatus("HOUSEHOLD_FOUND");
      setActiveRole("admin");
      if (tokenRec) {
        setActivePairingToken({
          id: tokenRec.id || `tok_${Date.now()}`,
          householdId: tokenRec.household_id,
          token: tokenRec.token,
          createdBy: tokenRec.created_by,
          createdAt: tokenRec.created_at || new Date().toISOString(),
          expiresAt: tokenRec.expires_at,
          isUsed: tokenRec.is_used || false,
        });
      }

      await fetchHouseholdMembers();

      const notif: AppNotification = {
        id: `notif-${Date.now()}`,
        title: "🏠 تم إنشاء المنزل وتوثيقه",
        message: `تم إنشاء معرّف المنزل وتوليد رمز الاقتران المشفر بنجاح في قاعدة البيانات`,
        type: "pairing",
        timestamp: new Date().toISOString(),
        targetRole: "admin",
        read: false,
      };
      setNotifications((prev) => [notif, ...prev]);

      return { success: true };
    } catch (err: any) {
      console.error("Error creating admin household:", err);
      return { success: false, error: err?.message || "حدث خطأ أثناء إنشاء المنزل" };
    }
  };

  const joinHouseholdByCode = async (
    code: string,
    memberName?: string
  ): Promise<{ success: boolean; message?: string; householdName?: string }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: "يرجى إدخال رمز ربط صحيح" };
    }

    if (!supabase) {
      return {
        success: false,
        message: "خدمة قاعدة البيانات غير مهيأة",
      };
    }

    let activeUser = supabaseUser;
    const wasNewlyProvisioned = !supabaseUser;

    // Direct Pairing Authentication (Requirement 1, 2, 3, 4):
    // If not authenticated, provision a secure internal device identity seamlessly
    // without showing any email or password forms to the user.
    if (!activeUser) {
      console.log("[AppContext] Provisioning internal home phone device identity for direct pairing...");
      const { username, email, password } = generateInternalHomePhoneCredentials();
      const displayName = memberName?.trim() || "هاتف المنزل";

      try {
        const signUpRes = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: "household_member",
              full_name: displayName,
              username,
              is_home_phone: true,
            },
          },
        });

        if (signUpRes.error) {
          console.warn("[AppContext] SignUp note for home phone:", signUpRes.error.message);
        }

        if (signUpRes.data?.user) {
          activeUser = signUpRes.data.user;
          if (signUpRes.data.session) {
            setSupabaseSession(signUpRes.data.session);
            setSupabaseUser(signUpRes.data.user);
          }
        }

        if (!activeUser) {
          const signInRes = await supabase.auth.signInWithPassword({ email, password });
          if (signInRes.data?.user) {
            activeUser = signInRes.data.user;
            if (signInRes.data.session) {
              setSupabaseSession(signInRes.data.session);
              setSupabaseUser(signInRes.data.user);
            }
          }
        }
      } catch (authErr: any) {
        console.error("[AppContext] Error creating home phone identity:", authErr);
      }

      if (!activeUser) {
        return {
          success: false,
          message: "تعذر مصادقة الجهاز تلقائياً. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.",
        };
      }
    }

    const res = await dbHelpers.validateAndConsumePairingToken(
      cleanCode,
      activeUser.id,
      memberName || supabaseProfile?.fullName || "هاتف المنزل",
      supabaseProfile?.phone || activeUser.user_metadata?.phone || ""
    );

    if (!res.success || !res.household) {
      if (wasNewlyProvisioned && supabase) {
        await supabase.auth.signOut().catch(() => {});
        setSupabaseUser(null);
        setSupabaseSession(null);
        cacheManager.clearActiveSession();
      }
      return {
        success: false,
        message: res.message || "رمز الربط غير صالح أو منتهي الصلاحية أو غير موجود",
      };
    }

    const joinedHousehold: HouseholdInfo = {
      id: res.household.id,
      name: res.household.name,
      adminId: res.household.admin_id,
      adminName: res.household.admin_name || "المسؤول",
      adminPhone: res.household.admin_phone || "",
      createdAt: res.household.created_at || new Date().toISOString(),
      pairCode: res.household.pair_code,
    };

    // Switch active household in syncManager and run full authoritative sync
    syncManager.handleHouseholdSwitch(res.household.id);
    const effectiveSession = supabaseSession || (await supabase.auth.getSession()).data.session;
    if (effectiveSession) {
      await syncAuthenticatedUserData(activeUser, effectiveSession, ++authSequenceRef.current);
    } else {
      setHousehold(joinedHousehold);
      setHouseholdStatus("HOUSEHOLD_FOUND");
      setActiveRole("home");
      if (res.permissions) {
        setHomePermissions({
          allowedScreens: res.permissions.allowed_screens || DEFAULT_HOME_PERMISSIONS.allowedScreens,
          canAddMissingItem: res.permissions.can_add_missing_item ?? true,
          canDeleteMissingItem: res.permissions.can_delete_missing_item ?? false,
          canEditItem: res.permissions.can_edit_item ?? true,
          canAddInvoice: res.permissions.can_add_invoice ?? false,
          canUseAiAssistant: res.permissions.can_use_ai_assistant ?? true,
          canSendUrgentAlert: res.permissions.can_send_urgent_alert ?? true,
        });
      }
      await fetchHouseholdMembers();
    }

    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      title: "📱 تم الانضمام للمنزل بنجاح",
      message: `تم ربط هذا الجهاز بالمنزل (${res.household.name}) عبر التحقق الأمني المعتمد`,
      type: "pairing",
      timestamp: new Date().toISOString(),
      targetRole: "home",
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    return {
      success: true,
      householdName: res.household.name,
      message: res.message,
    };
  };

  const pairHomePhone = (qrData: string) => {
    let targetCode = qrData.trim();
    if (
      targetCode.includes("?") &&
      (targetCode.includes("token=") ||
        targetCode.includes("pair=") ||
        targetCode.includes("code=") ||
        targetCode.includes("join="))
    ) {
      try {
        const url = new URL(targetCode, window.location.origin);
        const codeFromUrl =
          url.searchParams.get("token") ||
          url.searchParams.get("pair") ||
          url.searchParams.get("join") ||
          url.searchParams.get("code");
        if (codeFromUrl) {
          targetCode = codeFromUrl;
        }
      } catch {
        const match = targetCode.match(/[?&](?:token|pair|join|code)=([^&#]+)/i);
        if (match && match[1]) {
          targetCode = decodeURIComponent(match[1]);
        }
      }
    } else if (targetCode.startsWith("{") && targetCode.endsWith("}")) {
      try {
        const parsed = JSON.parse(targetCode);
        if (parsed.token) targetCode = parsed.token;
        else if (parsed.pairCode) targetCode = parsed.pairCode;
      } catch {}
    }

    const cleanCode = targetCode.trim().toUpperCase();
    joinHouseholdByCode(cleanCode, "هاتف المنزل").then((res) => {
      if (res.success) {
        try {
          confetti({
            particleCount: 90,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#10B981", "#3B82F6", "#F59E0B"],
          });
        } catch {}
      }
    });

    return true;
  };

  const disconnectHousehold = async () => {
    syncManager.handleHouseholdSwitch(null);
    if (household?.id && supabaseUser?.id) {
      await dbHelpers.leaveHousehold(household.id, supabaseUser.id);
    }
    setHousehold(null);
    setHouseholdStatus("HOUSEHOLD_NOT_FOUND");
    setActiveRole("guest");
    setHouseholdMembers([]);
    setActivePairingToken(null);
    setMissingItems([]);
    setInvoices([]);
    setNotifications([]);
  };

  const addMissingItem = (item: Omit<MissingItem, "id" | "addedAt" | "completed">) => {
    const currentItems = missingItemsRef.current;
    const res = addOrIncrementCartItem(currentItems, item);
    missingItemsRef.current = res.updatedItems;
    setMissingItems(res.updatedItems);

    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", res.updatedItems);

      if (res.isNew) {
        syncManager.enqueueMutation(
          "missing_items",
          "INSERT",
          res.mutatedItem.id,
          {
            id: res.mutatedItem.id,
            household_id: household.id,
            product_id: res.mutatedItem.productId,
            name: res.mutatedItem.name,
            category: res.mutatedItem.category,
            category_arabic: res.mutatedItem.categoryArabic || "عام",
            categoryArabic: res.mutatedItem.categoryArabic || "عام",
            quantity: res.mutatedItem.quantity,
            urgency: res.mutatedItem.urgency,
            notes: res.mutatedItem.notes,
            added_by: res.mutatedItem.addedBy,
            addedBy: res.mutatedItem.addedBy,
            added_by_name: res.mutatedItem.addedByName,
            addedByName: res.mutatedItem.addedByName,
            added_at: res.mutatedItem.addedAt || new Date().toISOString(),
            addedAt: res.mutatedItem.addedAt || new Date().toISOString(),
            completed: false,
          },
          supabaseUser.id,
          household.id
        );
      } else {
        syncManager.enqueueMutation(
          "missing_items",
          "UPDATE",
          res.mutatedItem.id,
          {
            quantity: res.mutatedItem.quantity,
            urgency: res.mutatedItem.urgency,
            notes: res.mutatedItem.notes,
          },
          supabaseUser.id,
          household.id
        );
      }
    }

    if (activeRole === "home" || activeRole === "household_member" || item.addedBy === "home") {
      const notif: AppNotification = {
        id: `notif-${Date.now()}`,
        title: "📦 طلب نقص في المنزل!",
        message: `تمت إضافة/تحديث: ${item.name} (${item.quantity || "١"}) من قِبل ${item.addedByName}`,
        type: "item_added",
        timestamp: new Date().toISOString(),
        targetRole: "admin",
        read: false,
      };
      setNotifications((prev) => {
        const updated = [notif, ...prev];
        if (supabaseUser?.id && household?.id) {
          cacheManager.setHouseholdCache(supabaseUser.id, household.id, "notifications", updated);
        }
        return updated;
      });

      if (household && supabaseUser) {
        syncManager.enqueueMutation(
          "notifications",
          "INSERT",
          notif.id,
          {
            id: notif.id,
            household_id: household.id,
            title: notif.title,
            message: notif.message,
            type: notif.type,
            target_role: notif.targetRole,
            read: false,
          },
          supabaseUser.id,
          household.id
        );
      }
    }
  };

  const incrementMissingItemQuantity = (id: string) => {
    const currentItems = missingItemsRef.current;
    const res = incrementCartItem(currentItems, id);
    missingItemsRef.current = res.updatedItems;
    setMissingItems(res.updatedItems);

    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", res.updatedItems);

      if (res.mutatedItem) {
        syncManager.enqueueMutation(
          "missing_items",
          "UPDATE",
          id,
          {
            quantity: res.mutatedItem.quantity,
          },
          supabaseUser.id,
          household.id
        );
      }
    }
  };

  const decrementMissingItemQuantity = (id: string) => {
    const currentItems = missingItemsRef.current;
    const res = decrementCartItem(currentItems, id);
    missingItemsRef.current = res.updatedItems;
    setMissingItems(res.updatedItems);

    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", res.updatedItems);

      if (res.isDeleted) {
        syncManager.enqueueMutation(
          "missing_items",
          "DELETE",
          id,
          {},
          supabaseUser.id,
          household.id
        );
      } else if (res.mutatedItem) {
        syncManager.enqueueMutation(
          "missing_items",
          "UPDATE",
          id,
          {
            quantity: res.mutatedItem.quantity,
          },
          supabaseUser.id,
          household.id
        );
      }
    }
  };

  const updateMissingItem = (
    id: string,
    updates: Partial<Omit<MissingItem, "id" | "addedAt">>
  ) => {
    const currentItems = missingItemsRef.current;
    const updated = currentItems.map((item) => (item.id === id ? { ...item, ...updates } : item));
    missingItemsRef.current = updated;
    setMissingItems(updated);

    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", updated);

      syncManager.enqueueMutation(
        "missing_items",
        "UPDATE",
        id,
        {
          name: updates.name,
          quantity: updates.quantity,
          urgency: updates.urgency,
          notes: updates.notes,
          category: updates.category,
          category_arabic: updates.categoryArabic,
          completed: updates.completed,
          completed_at: updates.completedAt,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const toggleItemCompletion = async (id: string) => {
    const currentItems = missingItemsRef.current;
    const prevItem = currentItems.find((it) => it.id === id);
    if (!prevItem) return;

    const newCompleted = !prevItem.completed;
    const newCompletedAt = newCompleted ? new Date().toISOString() : undefined;

    const updated = currentItems.map((it) => {
      if (it.id === id) {
        return {
          ...it,
          completed: newCompleted,
          completedAt: newCompletedAt,
        };
      }
      return it;
    });
    missingItemsRef.current = updated;
    setMissingItems(updated);

    if (household?.id && supabaseUser?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", updated);
      syncManager.enqueueMutation(
        "missing_items",
        "UPDATE",
        id,
        {
          completed: newCompleted,
          completed_at: newCompletedAt,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const deleteMissingItem = async (id: string) => {
    const currentItems = missingItemsRef.current;
    const updated = currentItems.filter((it) => it.id !== id);
    missingItemsRef.current = updated;
    setMissingItems(updated);

    if (household?.id && supabaseUser?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", updated);
      syncManager.enqueueMutation(
        "missing_items",
        "DELETE",
        id,
        {},
        supabaseUser.id,
        household.id
      );
    }
  };

  const clearCompletedItems = async () => {
    const currentItems = missingItemsRef.current;
    const completedItems = currentItems.filter((it) => it.completed);
    const updated = currentItems.filter((it) => !it.completed);
    missingItemsRef.current = updated;
    setMissingItems(updated);

    if (household?.id && supabaseUser?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", updated);
      for (const it of completedItems) {
        syncManager.enqueueMutation(
          "missing_items",
          "DELETE",
          it.id,
          {},
          supabaseUser.id,
          household.id
        );
      }
    }
  };

  const addInvoice = (
    invoice: Omit<PurchaseInvoice, "id" | "invoiceNumber">,
    completeItemIds?: string[]
  ): { success: boolean; message?: string; invoiceId?: string; invoice?: PurchaseInvoice } => {
    if (!household && supabaseUser) {
      return {
        success: false,
        message: "تعذر حفظ الفاتورة لعدم توفر معرّف المنزل الحالي.",
      };
    }

    try {
      const newInvoice: PurchaseInvoice = {
        ...invoice,
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
        purchasedMissingItemIds: completeItemIds || [],
      };

      setInvoices((prev) => {
        const updated = [newInvoice, ...prev];
        if (supabaseUser?.id && household?.id) {
          cacheManager.setHouseholdCache(supabaseUser.id, household.id, "invoices", updated);
        }
        return updated;
      });

      if (household && supabaseUser) {
        syncManager.enqueueMutation(
          "invoices",
          "INSERT",
          newInvoice.id,
          {
            id: newInvoice.id,
            household_id: household.id,
            invoice_number: newInvoice.invoiceNumber,
            date: newInvoice.date,
            category: newInvoice.category,
            category_arabic: newInvoice.categoryArabic,
            products: newInvoice.products,
            total_price: newInvoice.totalPrice,
            notes: newInvoice.notes,
            registered_by: newInvoice.registeredBy,
            payment_method: newInvoice.paymentMethod,
          },
          supabaseUser.id,
          household.id
        );
      }

      if (completeItemIds && completeItemIds.length > 0) {
        const currentItems = missingItemsRef.current;
        const updated = currentItems.map((item) =>
          completeItemIds.includes(item.id)
            ? { ...item, completed: true, completedAt: new Date().toISOString() }
            : item
        );
        missingItemsRef.current = updated;
        setMissingItems(updated);

        if (supabaseUser?.id && household?.id) {
          cacheManager.setHouseholdCache(supabaseUser.id, household.id, "missing_items", updated);
        }

        if (household && supabaseUser) {
          for (const itemId of completeItemIds) {
            syncManager.enqueueMutation(
              "missing_items",
              "UPDATE",
              itemId,
              {
                completed: true,
                completed_at: new Date().toISOString(),
              },
              supabaseUser.id,
              household.id
            );
          }
        }
      }

      const updatedSpent = totalSpent + newInvoice.totalPrice;
      const newPct = (updatedSpent / budgetConfig.monthlyLimit) * 100;

      const notif: AppNotification = {
        id: `notif-${Date.now()}`,
        title: "🛒 تم إتمام عملية الشراء!",
        message: `قام المسؤول بشراء أغراض بقيمة ${newInvoice.totalPrice} ${budgetConfig.currency}. المتبقي من الميزانية: ${Math.max(0, budgetConfig.monthlyLimit - updatedSpent)} ${budgetConfig.currency}`,
        type: "purchase_made",
        timestamp: new Date().toISOString(),
        targetRole: "home",
        read: false,
      };

      const newNotifs = [notif];

      if (newPct >= 90) {
        newNotifs.push({
          id: `notif-warn-${Date.now()}`,
          title: "⚠️ تنبيه الميزانية!",
          message: `تم استهلاك ${Math.round(newPct)}% من ميزانية الشهر المحددة (${budgetConfig.monthlyLimit} ${budgetConfig.currency})`,
          type: "budget_warning",
          timestamp: new Date().toISOString(),
          targetRole: "all",
          read: false,
        });
      }

      setNotifications((prev) => [...newNotifs, ...prev]);

      if (household && supabaseUser) {
        for (const n of newNotifs) {
          syncManager.enqueueMutation(
            "notifications",
            "INSERT",
            n.id,
            {
              id: n.id,
              household_id: household.id,
              title: n.title,
              message: n.message,
              type: n.type,
              target_role: n.targetRole,
              read: n.read,
            },
            supabaseUser.id,
            household.id
          );
        }
      }

      return { success: true, invoiceId: newInvoice.id, invoice: newInvoice };
    } catch (e: any) {
      console.error("[addInvoice] Error:", e);
      return {
        success: false,
        message: e?.message || "حدث خطأ أثناء إضافة الفاتورة.",
      };
    }
  };

  const deleteInvoice = (id: string) => {
    setInvoices((prev) => {
      const updated = prev.filter((inv) => inv.id !== id);
      if (supabaseUser?.id && household?.id) {
        cacheManager.setHouseholdCache(supabaseUser.id, household.id, "invoices", updated);
      }
      return updated;
    });
    if (household && supabaseUser) {
      syncManager.enqueueMutation(
        "invoices",
        "DELETE",
        id,
        {},
        supabaseUser.id,
        household.id
      );
    }
  };

  const updateInvoice = (id: string, updates: Partial<PurchaseInvoice>) => {
    setInvoices((prev) => {
      const updated = prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv));
      if (supabaseUser?.id && household?.id) {
        cacheManager.setHouseholdCache(supabaseUser.id, household.id, "invoices", updated);
      }
      return updated;
    });
    if (household && supabaseUser) {
      syncManager.enqueueMutation(
        "invoices",
        "UPDATE",
        id,
        {
          total_price: updates.totalPrice,
          notes: updates.notes,
          products: updates.products,
          payment_method: updates.paymentMethod,
          category: updates.category,
          category_arabic: updates.categoryArabic,
          date: updates.date,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const updateBudgetLimit = (newLimit: number) => {
    setBudgetConfig((prev) => {
      const updated = { ...prev, monthlyLimit: newLimit };
      if (supabaseUser?.id && household?.id) {
        cacheManager.setHouseholdCache(supabaseUser.id, household.id, "budget", updated);
      }
      return updated;
    });
    if (household && supabaseUser) {
      syncManager.enqueueMutation(
        "household_budgets",
        "UPSERT",
        household.id,
        {
          household_id: household.id,
          monthly_limit: newLimit,
          currency: budgetConfig.currency,
          month: budgetConfig.month,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const updateCurrency = (newCurrency: string) => {
    const trimmed = newCurrency.trim();
    if (!trimmed) return;
    setBudgetConfig((prev) => {
      const updated = { ...prev, currency: trimmed };
      if (supabaseUser?.id && household?.id) {
        cacheManager.setHouseholdCache(supabaseUser.id, household.id, "budget", updated);
      }
      return updated;
    });
    if (household && supabaseUser) {
      syncManager.enqueueMutation(
        "household_budgets",
        "UPSERT",
        household.id,
        {
          household_id: household.id,
          monthly_limit: budgetConfig.monthlyLimit,
          currency: trimmed,
          month: budgetConfig.month,
        },
        supabaseUser.id,
        household.id
      );
    }
  };

  const retryFailedSync = () => {
    syncManager.retryFailedOperations();
  };

  const forceSyncNow = async () => {
    await syncManager.processQueue();
  };

  const markNotificationsAsRead = () => {
    const unreadNotifs = notifications.filter((n) => !n.read);
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      if (supabaseUser?.id && household?.id) {
        cacheManager.setHouseholdCache(supabaseUser.id, household.id, "notifications", updated);
      }
      return updated;
    });

    if (household && supabaseUser) {
      for (const n of unreadNotifs) {
        syncManager.enqueueMutation(
          "notifications",
          "UPDATE",
          n.id,
          { read: true },
          supabaseUser.id,
          household.id
        );
      }
    }
  };

  const clearNotifications = () => {
    const toDelete = [...notifications];
    setNotifications([]);
    if (supabaseUser?.id && household?.id) {
      cacheManager.setHouseholdCache(supabaseUser.id, household.id, "notifications", []);
    }
    if (household && supabaseUser) {
      for (const n of toDelete) {
        syncManager.enqueueMutation(
          "notifications",
          "DELETE",
          n.id,
          {},
          supabaseUser.id,
          household.id
        );
      }
    }
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      if (supabaseUser?.id && household?.id) {
        cacheManager.setHouseholdCache(supabaseUser.id, household.id, "notifications", updated);
      }
      return updated;
    });
    if (household && supabaseUser) {
      syncManager.enqueueMutation(
        "notifications",
        "DELETE",
        id,
        {},
        supabaseUser.id,
        household.id
      );
    }
  };

  const getRecordSyncStatus = (
    entity: SyncEntity,
    recordId: string
  ): "SYNCED" | "PENDING" | "SYNCING" | "FAILED" | "OFFLINE_CACHED" => {
    return syncManager.getRecordStatus(
      entity,
      recordId,
      supabaseUser?.id,
      household?.id
    );
  };

  return (
    <AppContext.Provider
      value={{
        authStatus,
        authError,
        isAuthLoading,
        isAuthenticated,
        supabaseUser,
        supabaseSession,
        supabaseProfile,
        isSupabaseConnected,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInHomePhone,
        signUpHomePhone,
        signOutSupabase,
        resetPassword,
        updateUserProfile,
        updateUserPassword,
        householdStatus,
        activeRole,
        setActiveRole,
        household,
        setHousehold,
        householdMembers,
        fetchHouseholdMembers,
        activePairingToken,
        generatePairingToken,
        isPaired: !!household && activeRole !== "guest",
        createAdminHousehold,
        pairHomePhone,
        joinHouseholdByCode,
        disconnectHousehold,
        activeTab,
        setActiveTab,
        selectedCategory,
        setSelectedCategory,
        simulatorMode,
        setSimulatorMode,
        categories,
        refreshActiveStateFromCache,
        addCategory,
        updateCategory,
        deleteCategory,
        addProductToCategory,
        updateProductInCategory,
        deleteProductFromCategory,
        homePermissions,
        updateHomePermissions,
        missingItems,
        addMissingItem,
        updateMissingItem,
        incrementMissingItemQuantity,
        decrementMissingItemQuantity,
        toggleItemCompletion,
        deleteMissingItem,
        clearCompletedItems,
        invoices,
        addInvoice,
        deleteInvoice,
        updateInvoice,
        archivedMonths,
        endCurrentFiscalMonth,
        clearAllArchives,
        deleteArchivedMonth,
        budgetConfig,
        updateBudgetLimit,
        updateCurrency,
        totalSpent,
        remainingBudget,
        spentPercentage,
        householdOrders,
        notifications,
        unreadCount,
        markNotificationsAsRead,
        clearNotifications,
        deleteNotification,
        incomingAlert,
        sendHomeAttentionAlert,
        dismissIncomingAlert,
        isAiModalOpen,
        setIsAiModalOpen,
        isAddInvoiceModalOpen,
        setIsAddInvoiceModalOpen,
        isEndMonthModalOpen,
        setIsEndMonthModalOpen,
        isQrModalOpen,
        setIsQrModalOpen,
        isNotificationsModalOpen,
        setIsNotificationsModalOpen,
        isSupabaseAuthModalOpen,
        setIsSupabaseAuthModalOpen,
        isAboutModalOpen,
        setIsAboutModalOpen,
        isRecurringOrdersModalOpen,
        setIsRecurringOrdersModalOpen,
        isGovernoratesModalOpen,
        setIsGovernoratesModalOpen,
        isAdminNotifManagerModalOpen,
        setIsAdminNotifManagerModalOpen,
        globalProducts,
        householdProducts,
        getCatalogProductsForCategory,
        addOrUpdateHouseholdProduct,
        deleteHouseholdProduct,
        seedHouseholdCatalog,
        recurringOrders,
        createRecurringOrder,
        deleteRecurringOrder,
        orderRequests,
        createOrderDraft,
        updateDraftItem,
        approveDraftRequest,
        rejectDraftRequest,
        adminNotifications,
        dismissAdminNotification,
        refreshAdminNotifications,
        governoratesSettings,
        updateGovernorateSetting,
        themeMode,
        setThemeMode,
        fontSize,
        setFontSize,
        syncState,
        syncMetrics,
        retryFailedSync,
        forceSyncNow,
        isOnline,
        isServiceWorkerActive,
        swCacheVersion,
        isInstallable,
        promptInstallPwa,
        toggleSimulatedOffline,
        getRecordSyncStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

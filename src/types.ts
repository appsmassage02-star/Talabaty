export type UserRole = "admin" | "home" | "guest" | "household_member";
export type AuthStatus =
  | "INITIALIZING"
  | "SESSION"
  | "PROFILE"
  | "HOUSEHOLD"
  | "PERMISSIONS"
  | "READY"
  | "UNAUTHENTICATED"
  | "ERROR";
export type HouseholdStatus = "HOUSEHOLD_LOADING" | "HOUSEHOLD_FOUND" | "HOUSEHOLD_NOT_FOUND" | "HOUSEHOLD_ERROR";
export type SyncState =
  | "INITIALIZING"
  | "ONLINE"
  | "OFFLINE"
  | "SYNCING"
  | "SYNCED"
  | "PENDING"
  | "SYNC_ERROR";

export interface SyncMetrics {
  totalPending: number;
  totalFailed: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}
export type AppThemeMode = "light" | "dark";
export type AppFontSize = "sm" | "md" | "lg" | "xl";

export interface HouseholdInfo {
  id: string;
  name: string;
  adminId?: string;
  adminName: string;
  adminPhone: string;
  createdAt: string;
  pairCode?: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: UserRole;
  userName: string;
  userPhone?: string;
  joinedAt: string;
}

export interface PairingToken {
  id: string;
  householdId: string;
  token: string;
  createdBy?: string;
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: string;
}

export type CategoryId = string;

export interface SubCategory {
  id: string;
  nameAr: string;
  nameEn?: string;
  items: string[];
}

export interface CategoryInfo {
  id: string;
  nameAr: string;
  nameEn: string;
  imageUrl: string;
  iconName?: string;
  color: string;
  bgLight: string;
  badgeColor: string;
  description: string;
  commonItems: string[];
  subcategories?: SubCategory[];
  isCustom?: boolean;
  sourceGlobalCategoryId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  updatedAt?: string;
}

export interface HomePermissions {
  allowedScreens: {
    categories: boolean;
    missing: boolean;
    purchases: boolean;
    budget: boolean;
  };
  canAddMissingItem: boolean;
  canDeleteMissingItem: boolean;
  canEditItem: boolean;
  canAddInvoice: boolean;
  canUseAiAssistant: boolean;
  canSendUrgentAlert: boolean;
}

export interface MissingItem {
  id: string;
  productId?: string;
  name: string;
  category: string;
  categoryArabic: string;
  quantity: string;
  urgency: "high" | "normal" | "low";
  notes?: string;
  addedBy: "admin" | "home";
  addedByName: string;
  addedAt: string;
  completed: boolean;
  completedAt?: string;
}

export interface InvoiceProduct {
  id: string;
  missingItemId?: string;
  name: string;
  quantity: string;
  price: number;
  category?: string;
  categoryArabic?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  category: string;
  categoryArabic: string;
  products: InvoiceProduct[];
  totalPrice: number;
  notes?: string;
  registeredBy: string;
  paymentMethod: "cash" | "card" | "transfer";
  purchasedMissingItemIds?: string[];
}

export interface BudgetConfig {
  monthlyLimit: number;
  currency: string;
  month: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "item_added" | "purchase_made" | "budget_warning" | "pairing" | "urgent_alert";
  timestamp: string;
  targetRole: "admin" | "home" | "all";
  read: boolean;
  meta?: any;
}

export interface SupabaseProfile {
  id: string;
  email?: string;
  fullName?: string;
  phone?: string;
  householdId?: string;
  role?: UserRole;
  createdAt?: string;
}

export interface ArchivedMonthRecord {
  id: string;
  monthName: string;
  archivedAt: string;
  totalSpent: number;
  budgetLimit: number;
  remainingBudget: number;
  currency: string;
  invoicesCount: number;
  invoices: PurchaseInvoice[];
  deliveryOrders?: DeliveryOrder[];
  closedBy?: string;
}

export type DeliveryOrderStatus =
  | 'pending_review'
  | 'accepted'
  | 'shopping'
  | 'cancellation_pending'
  | 'cancelled'
  | 'completed';

export interface DeliverySettings {
  id: string;
  delivery_enabled: boolean;
  default_delivery_fee: number;
  updated_by?: string | null;
  updated_at?: string;
}

export interface HouseholdAddress {
  id: string;
  household_id: string;
  address_label: string;
  full_name: string;
  phone: string;
  country: string;
  governorate_code?: string | null;
  governorate_name: string;
  markaz_code?: string | null;
  markaz_name: string;
  detailed_address: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryDriver {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryOrder {
  id: string;
  household_id: string;
  user_id?: string | null;
  invoice_id?: string | null;
  address_id?: string | null;
  source_recurring_request_id?: string | null;
  customer_name: string;
  customer_phone: string;
  country: string;
  governorate_name: string;
  markaz_name: string;
  detailed_address: string;
  delivery_fee: number;
  subtotal: number;
  total_amount: number;
  actual_items_total?: number | null;
  actual_total_amount?: number | null;
  delivery_notes?: string | null;
  status: DeliveryOrderStatus;
  assigned_driver_id?: string | null;
  cancellation_reason?: string | null;
  cancellation_requested_at?: string | null;
  cancellation_requested_by?: string | null;
  cancellation_decided_at?: string | null;
  cancellation_decided_by?: string | null;
  cancellation_decision_note?: string | null;
  accepted_at?: string | null;
  delivered_at?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: DeliveryOrderItem[];
  driver?: DeliveryDriver;
}

export interface DeliveryOrderItem {
  id: string;
  order_id: string;
  delivery_order_id?: string;
  product_id?: string | null;
  product_name: string;
  category_id?: string | null;
  category_name?: string | null;
  quantity: string;
  unit_price: number;
  total_price: number;
  item_status?: 'purchased' | 'missing' | string | null;
  actual_unit_price?: number | null;
  actual_total_price?: number | null;
  missing_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryOrderStatusHistory {
  id: string;
  delivery_order_id: string;
  old_status?: DeliveryOrderStatus | null;
  new_status: DeliveryOrderStatus;
  changed_by?: string | null;
  note?: string | null;
  created_at?: string;
}

// ------------------------------------------------------------------------------
// Global & Household Catalog Types
// ------------------------------------------------------------------------------

export interface GlobalCategory {
  id: string;
  name_ar: string;
  name_en?: string;
  image_url: string;
  icon_name?: string;
  color?: string;
  bg_light?: string;
  badge_color?: string;
  description?: string;
  subcategories?: SubCategory[];
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface GlobalProduct {
  id: string;
  global_category_id: string;
  subcategory_id?: string | null;
  name_ar: string;
  name_en?: string | null;
  image_url?: string | null;
  default_quantity?: string;
  default_unit?: string;
  estimated_price?: number;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface HouseholdProduct {
  id: string;
  household_id: string;
  category_id: string;
  subcategory_id?: string | null;
  name_ar: string;
  name_en?: string | null;
  image_url?: string | null;
  quantity: string;
  unit: string;
  estimated_price: number;
  source_global_product_id?: string | null;
  is_custom: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Unified Catalog Product for UI display, merging Global & Household Products
 */
export interface CatalogProduct {
  id: string;
  category_id: string;
  subcategory_id?: string | null;
  name_ar: string;
  name_en?: string | null;
  image_url?: string | null;
  default_quantity?: string;
  default_unit?: string;
  quantity?: string;
  unit?: string;
  estimated_price?: number;
  source_global_product_id?: string | null;
  is_custom?: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// ------------------------------------------------------------------------------
// Recurring Orders & Drafts ("طلباتي")
// ------------------------------------------------------------------------------

export type RecurringOrderFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurringOrder {
  id: string;
  household_id: string;
  name: string;
  frequency: RecurringOrderFrequency;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: RecurringOrderItem[];
}

export interface RecurringOrderItem {
  id: string;
  recurring_order_id: string;
  product_id?: string | null;
  product_name_snapshot: string;
  category_id?: string | null;
  category_name_snapshot?: string | null;
  quantity: string;
  unit: string;
  estimated_unit_price: number;
  created_at?: string;
  updated_at?: string;
}

export type RecurringOrderRequestStatus =
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface RecurringOrderRequest {
  id: string;
  household_id: string;
  recurring_order_id?: string | null;
  created_by?: string | null;
  created_by_role: 'home' | 'admin';
  reviewed_by?: string | null;
  status: RecurringOrderRequestStatus;
  notes?: string | null;
  review_notes?: string | null;
  delivery_order_id?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: RecurringOrderRequestItem[];
}

export interface RecurringOrderRequestItem {
  id: string;
  request_id: string;
  product_id?: string | null;
  product_name: string;
  category_id?: string | null;
  category_name?: string | null;
  quantity: string;
  unit: string;
  unit_price: number;
  total_price: number;
  is_modified?: boolean;
  created_at?: string;
}

// ------------------------------------------------------------------------------
// Governorate Delivery Settings
// ------------------------------------------------------------------------------

export interface DeliveryGovernorateSetting {
  governorate_name: string;
  governorate_code: string;
  is_active: boolean;
  delivery_fee: number;
  updated_by?: string | null;
  updated_at?: string;
}

// ------------------------------------------------------------------------------
// Admin Central Notifications (Banners & Modals)
// ------------------------------------------------------------------------------

export type AdminNotificationType = 'top_banner' | 'modal' | 'bottom_banner';
export type AdminNotificationTargetScope = 'all' | 'admin' | 'home' | 'household' | 'governorate' | 'user';

export interface AdminNotification {
  id: string;
  title?: string | null;
  body: string;
  type: AdminNotificationType;
  image_url?: string | null;
  icon_name?: string | null;
  action_type?: 'internal_route' | 'none';
  action_route?: string | null;
  target_scope: AdminNotificationTargetScope;
  target_value?: string | null;
  max_display_count: number;
  start_at: string;
  end_at?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AdminNotificationView {
  id: string;
  notification_id: string;
  household_id: string;
  user_id?: string | null;
  device_role?: string;
  display_count: number;
  last_displayed_at: string;
  dismissed_at?: string | null;
  created_at?: string;
}

export * from "./types/pharmacy";



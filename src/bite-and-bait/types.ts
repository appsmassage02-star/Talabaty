export type DeliveryChannel = 'direct_system' | 'call_dispatch';

export type FoodOrderStatus =
  | 'pending_restaurant_confirmation'
  | 'restaurant_accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected_by_restaurant';

export type FoodDeliveryStatus =
  | 'waiting_dispatch'
  | 'driver_assigned'
  | 'driver_at_restaurant'
  | 'on_the_way'
  | 'arrived_customer'
  | 'completed';

export interface MenuOptionItem {
  id: string;
  name: string;
  price: number;
}

export interface MenuOptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  options: MenuOptionItem[];
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  restaurantName: string;
  category: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  isAvailable: boolean;
  isPopular?: boolean;
  isOffer?: boolean;
  optionGroups?: MenuOptionGroup[];
  preparationTimeMinutes?: number;
}

export interface Restaurant {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  cuisineTypes: string[];
  rating: number;
  reviewsCount: number;
  estimatedPrepTimeMinutes: number;
  deliveryFee: number;
  minOrderAmount: number;
  isOpen: boolean;
  isBusy?: boolean;
  openingHours: string;
  address: string;
  governorate: string;
  phone: string;
  deliveryChannel: DeliveryChannel;
  distanceKm: number;
  isFeatured?: boolean;
  discountBadge?: string;
  nextOpeningTime?: string;
  menuCategories: string[];
}

export interface FoodCartSelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface FoodCartItem {
  cartItemId: string; // unique for this combination of item + selected options
  menuItemId: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  selectedOptions: FoodCartSelectedOption[];
  notes?: string;
  imageUrl: string;
  isAvailable: boolean;
  priceChanged?: boolean;
  currentActualPrice?: number;
}

export interface FoodGovernorate {
  id: string;
  name_ar: string;
  name_en?: string;
  is_active: boolean;
}

export interface FoodCenter {
  id: string;
  governorate_id: string;
  name_ar: string;
  name_en?: string;
  is_active: boolean;
}

export interface FoodArea {
  id: string;
  governorate_id: string;
  center_id: string;
  name_ar: string;
  name_en?: string;
  is_active: boolean;
}

export interface FoodCustomerAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  governorate: string;
  governorateId?: string;
  markaz: string;
  centerId?: string;
  area?: string;
  areaId?: string;
  detailedAddress: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export interface FoodOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedOptionsDescription?: string;
  notes?: string;
}

export interface FoodDriverInfo {
  name: string;
  phone: string;
  rating: number;
  vehicleType: string;
  vehiclePlate?: string;
  avatarUrl?: string;
}

export interface FoodOrder {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantPhone: string;
  restaurantAddress: string;
  customerName: string;
  customerPhone: string;
  address: FoodCustomerAddress;
  items: FoodOrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  totalAmount: number;
  notes?: string;
  paymentMethod: 'cash_on_delivery';
  deliveryChannel: DeliveryChannel;
  orderStatus: FoodOrderStatus;
  deliveryStatus: FoodDeliveryStatus;
  invoiceIssued: boolean;
  invoiceNumber?: string;
  driver?: FoodDriverInfo;
  createdAt: string;
  updatedAt: string;
  estimatedDeliveryTime: string;
  rejectionReason?: string;
}

export interface FoodOffer {
  id: string;
  title: string;
  description: string;
  badge: string;
  discountPercent?: number;
  restaurantId: string;
  restaurantName: string;
  bannerUrl: string;
  menuItemId?: string;
  validUntil: string;
}

export type SectionVisibility = 'visible' | 'hidden';
export type DisabledDisplayMode = 'show_disabled' | 'grayscale' | 'hide';

export interface RestaurantSectionSettings {
  id: string;
  section_enabled: boolean;
  section_visibility: SectionVisibility;
  disabled_display_mode: DisabledDisplayMode;
  global_max_delivery_radius_km: number;
  no_driver_timeout_minutes: number;
  created_at?: string;
  updated_at?: string;
  status_message?: string;
}

export interface RestaurantSectionServiceArea {
  id: string;
  governorate_id: string | null;
  center_id: string | null;
  area_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GeographicVerificationResult {
  isServiceable: boolean;
  reason?: string;
  matchedLevel?: 'area' | 'center' | 'governorate';
  governorateId?: string;
  centerId?: string;
  areaId?: string;
}

export interface RestaurantCategory {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

/**
 * Internal view navigation state for Bite & Bait section
 */
export type BiteBaitView =
  | 'home'
  | 'restaurants'
  | 'restaurant'
  | 'cart'
  | 'checkout'
  | 'orders'
  | 'favorites'
  | 'offers';

/**
 * Filter and sorting parameters for Bite & Bait browsing
 */
export interface BiteBaitFilterState {
  searchQuery: string;
  selectedCategory: string; // 'All' or specific category name
  onlyOpen: boolean;
  minRating: number;
  sortBy: 'recommended' | 'rating' | 'prepTime' | 'deliveryFee';
}

/**
 * Visual spice level indicator configuration
 */
export type SpiceLevel = 'Mild' | 'Medium' | 'Hot' | 'Extra Hot';

export interface SpiceConfig {
  icon: string;
  label: string;
  color: string;
  bg: string;
}

/**
 * Order cancellation lifecycle status
 */
export type OrderCancellationStatus = 'none' | 'pending' | 'approved' | 'rejected';

/**
 * Status history entry from restaurant_order_status_history
 */
export interface BiteBaitOrderStatusHistoryItem {
  id: string;
  orderId: string;
  oldStatus?: string | null;
  newStatus: string;
  changedBy?: string | null;
  note?: string | null;
  createdAt: string;
}

/**
 * Extended food order with cancellation lifecycle, rating data, and authentic database status history
 */
export interface BiteBaitFoodOrder extends FoodOrder {
  rawStatus?: string;
  cancellationStatus?: OrderCancellationStatus;
  cancellationReason?: string;
  cancellationRequestedAt?: string;
  cancellationReviewedAt?: string;
  cancellationReviewNote?: string;
  restaurantRating?: number;
  driverRating?: number;
  statusHistory?: BiteBaitOrderStatusHistoryItem[];
}

/**
 * Star-only rating submission payload (Strictly stars only, no text comments)
 */
export interface BiteBaitRatingPayload {
  orderId: string;
  restaurantId: string;
  restaurantRating: number; // 1 to 5
  driverRating: number;     // 1 to 5
}

/**
 * Complaint ticket for customer support (local simulation)
 */
export interface BiteBaitComplaintTicket {
  id: string;
  orderId: string;
  restaurantName: string;
  category: 'delay' | 'food_quality' | 'packaging' | 'driver_attitude' | 'other';
  details: string;
  status: 'pending' | 'in_review' | 'resolved';
  createdAt: string;
  responseNote?: string;
}

/**
 * Missing / damaged items report (local simulation)
 */
export interface BiteBaitMissingItemReport {
  id: string;
  orderId: string;
  restaurantName: string;
  missingItems: string[];
  notes: string;
  status: 'under_review' | 'refund_approved' | 'rejected';
  createdAt: string;
}

/**
 * Price change consent proposal (local simulation)
 */
export interface BiteBaitPriceChangeProposal {
  id?: string;
  orderId: string;
  restaurantName: string;
  originalTotal: number;
  newTotal: number;
  priceDifference: number;
  reason: string;
  createdAt?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

/**
 * Promotional slide for the top hero carousel
 */
export interface BiteBaitPromoSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaText: string;
  ctaCategory?: string;
  ctaRestaurantId?: string;
  discountTag?: string;
  backgroundColor: string;
}

/**
 * RPC create_bite_bait_order item payload
 */
export interface CreateBiteBaitOrderItemPayload {
  menu_item_id: string;
  quantity: number;
  selected_options: {
    group_id: string;
    option_id: string;
  }[];
}

/**
 * RPC create_bite_bait_order request parameters
 */
export interface CreateBiteBaitOrderParams {
  householdId: string;
  restaurantId: string;
  addressId: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  items: CreateBiteBaitOrderItemPayload[];
  idempotencyKey: string;
}

/**
 * RPC create_bite_bait_order response result
 */
export interface CreateBiteBaitOrderResult {
  orderId: string;
  orderNumber: string | number;
  totalAmount?: number;
  isDuplicate?: boolean;
  rawResponse?: any;
}

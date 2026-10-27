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
  id: string; // e.g. "FD-8024"
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

export type FoodSectionView =
  | 'home'
  | 'restaurant'
  | 'orders'
  | 'favorites'
  | 'offers';

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

export interface RestaurantCategoryLink {
  restaurant_id: string;
  category_id: string;
}

export interface RestaurantMenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface RawDbRestaurant {
  id: string;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  image_url: string | null;
  is_active: boolean;
  is_open: boolean;
  max_delivery_radius_km: number | null;
  commission_percent: number | null;
  delivery_fee: number | null;
  food_money_settlement_mode: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RawDbMenuItem {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  is_available: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface RawDbItemOption {
  id: string;
  restaurant_id: string;
  menu_item_id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
}

export interface RawDbItemOptionValue {
  id: string;
  option_id: string;
  name: string;
  extra_price: number;
  is_available: boolean;
  sort_order: number;
}

export interface RawDbOffer {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at?: string;
}


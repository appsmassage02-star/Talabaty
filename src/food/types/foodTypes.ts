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

export interface FoodCustomerAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  governorate: string;
  markaz: string;
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

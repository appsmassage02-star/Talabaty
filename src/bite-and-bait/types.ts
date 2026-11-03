import type {
  Restaurant,
  MenuItem,
  MenuOptionGroup,
  MenuOptionItem,
  FoodCartItem,
  FoodCartSelectedOption,
  FoodOrder,
  FoodOrderItem,
  FoodOrderStatus,
  FoodDeliveryStatus,
  FoodCustomerAddress,
  RestaurantCategory,
  RestaurantSectionSettings,
  GeographicVerificationResult,
} from '../food/types/foodTypes';

// Re-export original food domain types without duplication
export type {
  Restaurant,
  MenuItem,
  MenuOptionGroup,
  MenuOptionItem,
  FoodCartItem,
  FoodCartSelectedOption,
  FoodOrder,
  FoodOrderItem,
  FoodOrderStatus,
  FoodDeliveryStatus,
  FoodCustomerAddress,
  RestaurantCategory,
  RestaurantSectionSettings,
  GeographicVerificationResult,
};

/**
 * Internal view navigation state for Bite & Bait section
 */
export type BiteBaitView =
  | 'home'
  | 'restaurants'
  | 'restaurant'
  | 'cart'
  | 'checkout'
  | 'orders';

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
 * Rating submission payload
 */
export interface BiteBaitRatingPayload {
  orderId: string;
  restaurantId: string;
  rating: number; // 1 to 5
  reviewText?: string;
  itemsRatings?: Record<string, number>;
}

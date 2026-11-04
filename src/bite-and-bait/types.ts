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
  status: 'submitted' | 'under_review' | 'refund_approved';
  createdAt: string;
}

/**
 * Price change consent proposal (local simulation)
 */
export interface BiteBaitPriceChangeProposal {
  orderId: string;
  restaurantName: string;
  originalTotal: number;
  newTotal: number;
  priceDifference: number;
  reason: string;
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

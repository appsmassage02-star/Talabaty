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
  FoodOffer,
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
  FoodOffer,
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
 * Order cancellation lifecycle status
 * 'none': No cancellation requested
 * 'pending': Customer submitted cancellation request, pending restaurant/admin review
 * 'approved': Request approved by review, order marked cancelled
 * 'rejected': Request rejected by review, order continues in original status
 */
export type OrderCancellationStatus = 'none' | 'pending' | 'approved' | 'rejected';

/**
 * Extended food order with cancellation lifecycle and rating data
 */
export interface BiteBaitFoodOrder extends FoodOrder {
  cancellationStatus?: OrderCancellationStatus;
  cancellationReason?: string;
  cancellationRequestedAt?: string;
  cancellationReviewedAt?: string;
  cancellationReviewNote?: string;
  restaurantRating?: number;
  driverRating?: number;
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

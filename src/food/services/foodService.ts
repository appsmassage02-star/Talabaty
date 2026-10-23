import {
  Restaurant,
  MenuItem,
  FoodOffer,
  FoodCustomerAddress,
  FoodOrder,
  FoodOrderStatus,
  FoodDeliveryStatus,
  FoodCartItem,
} from '../types/foodTypes';
import {
  MOCK_RESTAURANTS,
  MOCK_MENU_ITEMS,
  MOCK_FOOD_OFFERS,
  MOCK_CUSTOMER_ADDRESSES,
  INITIAL_MOCK_ORDERS,
} from '../mockData/foodMockData';

// Local In-Memory Store (no localStorage database misuse)
let inMemoryRestaurants: Restaurant[] = [...MOCK_RESTAURANTS];
let inMemoryMenuItems: MenuItem[] = [...MOCK_MENU_ITEMS];
let inMemoryOffers: FoodOffer[] = [...MOCK_FOOD_OFFERS];
let inMemoryAddresses: FoodCustomerAddress[] = [...MOCK_CUSTOMER_ADDRESSES];
let inMemoryOrders: FoodOrder[] = [...INITIAL_MOCK_ORDERS];

export interface RestaurantFilterParams {
  searchQuery?: string;
  cuisine?: string;
  onlyOpen?: boolean;
  maxDeliveryTime?: number;
  hasDiscount?: boolean;
  minRating?: number;
  sortBy?: 'recommended' | 'rating' | 'prepTime' | 'deliveryFee';
}

export const foodService = {
  // 1. List Restaurants with filtering and sorting
  async listRestaurants(filters: RestaurantFilterParams = {}): Promise<Restaurant[]> {
    // Artificial minimal delay for realistic async experience
    await new Promise((resolve) => setTimeout(resolve, 80));

    let results = [...inMemoryRestaurants];

    // Search query
    if (filters.searchQuery?.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      results = results.filter((r) => {
        const matchesName = r.name.toLowerCase().includes(q) || (r.nameEn && r.nameEn.toLowerCase().includes(q));
        const matchesCuisine = r.cuisineTypes.some((c) => c.toLowerCase().includes(q));
        const matchesDescription = r.description.toLowerCase().includes(q);
        const matchesMenuItem = inMemoryMenuItems.some(
          (m) => m.restaurantId === r.id && (m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
        );
        return matchesName || matchesCuisine || matchesDescription || matchesMenuItem;
      });
    }

    // Cuisine filter
    if (filters.cuisine && filters.cuisine !== 'الكل') {
      results = results.filter((r) => r.cuisineTypes.includes(filters.cuisine!));
    }

    // Only open
    if (filters.onlyOpen) {
      results = results.filter((r) => r.isOpen);
    }

    // Max delivery prep time
    if (filters.maxDeliveryTime) {
      results = results.filter((r) => r.estimatedPrepTimeMinutes <= filters.maxDeliveryTime!);
    }

    // Has discount
    if (filters.hasDiscount) {
      results = results.filter((r) => Boolean(r.discountBadge));
    }

    // Min rating
    if (filters.minRating) {
      results = results.filter((r) => r.rating >= filters.minRating!);
    }

    // Sorting
    if (filters.sortBy === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    } else if (filters.sortBy === 'prepTime') {
      results.sort((a, b) => a.estimatedPrepTimeMinutes - b.estimatedPrepTimeMinutes);
    } else if (filters.sortBy === 'deliveryFee') {
      results.sort((a, b) => a.deliveryFee - b.deliveryFee);
    } else {
      // Default: featured first, then open status, then rating
      results.sort((a, b) => {
        if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
        if (Boolean(a.isFeatured) !== Boolean(b.isFeatured)) return a.isFeatured ? -1 : 1;
        return b.rating - a.rating;
      });
    }

    return results;
  },

  // 2. Get Restaurant Details
  async getRestaurantDetails(restaurantId: string): Promise<Restaurant | null> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const restaurant = inMemoryRestaurants.find((r) => r.id === restaurantId);
    return restaurant || null;
  },

  // 3. Get Restaurant Menu
  async getRestaurantMenu(restaurantId: string): Promise<MenuItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 60));
    return inMemoryMenuItems.filter((item) => item.restaurantId === restaurantId);
  },

  // 4. Get Offers
  async getRestaurantOffers(restaurantId?: string): Promise<FoodOffer[]> {
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (restaurantId) {
      return inMemoryOffers.filter((o) => o.restaurantId === restaurantId);
    }
    return inMemoryOffers;
  },

  // 5. Get Saved Addresses
  async listCustomerAddresses(): Promise<FoodCustomerAddress[]> {
    return [...inMemoryAddresses];
  },

  // Add Address
  async addCustomerAddress(address: Omit<FoodCustomerAddress, 'id'>): Promise<FoodCustomerAddress> {
    const newAddress: FoodCustomerAddress = {
      ...address,
      id: `addr-demo-${Date.now()}`,
    };
    if (newAddress.isDefault) {
      inMemoryAddresses = inMemoryAddresses.map((a) => ({ ...a, isDefault: false }));
    }
    inMemoryAddresses.unshift(newAddress);
    return newAddress;
  },

  // 6. Create Mock Restaurant Order (Single restaurant per order rule)
  async createMockRestaurantOrder(params: {
    restaurant: Restaurant;
    items: FoodCartItem[];
    customerName: string;
    customerPhone: string;
    address: FoodCustomerAddress;
    notes?: string;
  }): Promise<{ success: boolean; order?: FoodOrder; message?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Validate restaurant is open
    if (!params.restaurant.isOpen) {
      return {
        success: false,
        message: 'عذراً، هذا المطعم مغلق حالياً ولا يمكن إتمام الطلب منه حتى يفتح.',
      };
    }

    // Validate items belong to the restaurant
    const hasMismatchedItems = params.items.some((i) => i.restaurantId !== params.restaurant.id);
    if (hasMismatchedItems) {
      return {
        success: false,
        message: 'خطأ: لا يمكن إرسال أصناف مطاعم مختلفة في طلب واحد.',
      };
    }

    if (params.items.length === 0) {
      return {
        success: false,
        message: 'السلة فارغة لهذا المطعم.',
      };
    }

    // Calculate financials
    const subtotal = params.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    // Apply restaurant discount if applicable
    let discount = 0;
    if (params.restaurant.discountBadge?.includes('15%')) {
      discount = Math.round(subtotal * 0.15);
    } else if (params.restaurant.discountBadge?.includes('خصم')) {
      discount = 15;
    }

    const deliveryFee = params.restaurant.deliveryFee;
    const totalAmount = Math.max(0, subtotal - discount + deliveryFee);

    // Order number generator
    const orderNumber = `FD-${Math.floor(1000 + Math.random() * 9000)}`;

    const deliveryChannel = params.restaurant.deliveryChannel;

    // Direct system flow: starts at 'pending_restaurant_confirmation' waiting for system accept
    // Call dispatch flow: starts at 'pending_restaurant_confirmation' where driver will phone restaurant first
    const newOrder: FoodOrder = {
      id: orderNumber,
      restaurantId: params.restaurant.id,
      restaurantName: params.restaurant.name,
      restaurantPhone: params.restaurant.phone,
      restaurantAddress: params.restaurant.address,
      customerName: params.customerName.trim() || 'محمد أبو طالب',
      customerPhone: params.customerPhone.trim() || '01012345678',
      address: params.address,
      items: params.items.map((cartItem) => {
        const optionsDescription = cartItem.selectedOptions.map((o) => o.optionName).join('، ');
        return {
          menuItemId: cartItem.menuItemId,
          name: cartItem.name,
          quantity: cartItem.quantity,
          unitPrice: cartItem.unitPrice,
          totalPrice: cartItem.unitPrice * cartItem.quantity,
          selectedOptionsDescription: optionsDescription || undefined,
          notes: cartItem.notes,
        };
      }),
      subtotal,
      discount,
      deliveryFee,
      totalAmount,
      notes: params.notes?.trim() || undefined,
      paymentMethod: 'cash_on_delivery',
      deliveryChannel,
      orderStatus: 'pending_restaurant_confirmation',
      deliveryStatus: 'waiting_dispatch',
      invoiceIssued: false, // Invoices are not issued until restaurant accepts
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedDeliveryTime: `خلال ${params.restaurant.estimatedPrepTimeMinutes + 15} دقيقة`,
    };

    inMemoryOrders.unshift(newOrder);

    return {
      success: true,
      order: newOrder,
      message: 'تم تسجيل طلبك بنجاح وجاري المتابعة!',
    };
  },

  // 7. List Mock Customer Orders
  async listMockCustomerOrders(): Promise<FoodOrder[]> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return [...inMemoryOrders];
  },

  // 8. Get Mock Order Details
  async getMockOrderDetails(orderId: string): Promise<FoodOrder | null> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const order = inMemoryOrders.find((o) => o.id === orderId);
    return order ? { ...order } : null;
  },

  // 9. Update Mock Order Status for Testing (Testing tool for user to simulate every state)
  async updateMockOrderStatusForTesting(
    orderId: string,
    newStatus: FoodOrderStatus,
    deliveryStatus?: FoodDeliveryStatus,
    driverInfo?: FoodOrder['driver']
  ): Promise<FoodOrder | null> {
    const idx = inMemoryOrders.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;

    const current = inMemoryOrders[idx];
    const isAccepted =
      newStatus === 'restaurant_accepted' ||
      newStatus === 'preparing' ||
      newStatus === 'ready_for_pickup' ||
      newStatus === 'out_for_delivery' ||
      newStatus === 'delivered';

    const updated: FoodOrder = {
      ...current,
      orderStatus: newStatus,
      deliveryStatus: deliveryStatus || (newStatus === 'delivered' ? 'completed' : newStatus === 'out_for_delivery' ? 'on_the_way' : current.deliveryStatus),
      invoiceIssued: isAccepted ? true : current.invoiceIssued,
      invoiceNumber: isAccepted && !current.invoiceNumber ? `INV-${current.id}` : current.invoiceNumber,
      driver: driverInfo !== undefined ? driverInfo : current.driver || (newStatus === 'out_for_delivery' ? {
        name: 'كابتن محمود رضا',
        phone: '01011223344',
        rating: 4.9,
        vehicleType: 'دراجة نارية',
        vehiclePlate: 'س ط ع ٤٥٢١',
      } : undefined),
      updatedAt: new Date().toISOString(),
    };

    inMemoryOrders[idx] = updated;
    return updated;
  },

  // 10. Cancel Order (if still pending)
  async cancelOrder(orderId: string, reason: string = 'إلغاء من قِبل العميل'): Promise<{ success: boolean; message?: string }> {
    const idx = inMemoryOrders.findIndex((o) => o.id === orderId);
    if (idx === -1) {
      return { success: false, message: 'الطلب غير موجود.' };
    }

    const order = inMemoryOrders[idx];
    if (order.orderStatus === 'out_for_delivery' || order.orderStatus === 'delivered') {
      return { success: false, message: 'عذراً، لا يمكن إلغاء الطلب وهو مع المندوب أو تم توصيله.' };
    }

    inMemoryOrders[idx] = {
      ...order,
      orderStatus: 'cancelled',
      deliveryStatus: 'completed',
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
    };

    return { success: true, message: 'تم إلغاء الطلب بنجاح.' };
  },
};

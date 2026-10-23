import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Restaurant,
  MenuItem,
  FoodCartItem,
  FoodCartSelectedOption,
  FoodOrder,
  FoodSectionView,
  FoodCustomerAddress,
  FoodOrderStatus,
  FoodDeliveryStatus,
} from '../types/foodTypes';
import { foodService, RestaurantFilterParams } from '../services/foodService';

export interface FoodCartRestaurantGroup {
  restaurantId: string;
  restaurantName: string;
  restaurant?: Restaurant;
  isOpen: boolean;
  items: FoodCartItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

interface FoodContextType {
  // Navigation
  currentView: FoodSectionView;
  setCurrentView: (view: FoodSectionView) => void;
  selectedRestaurantId: string | null;
  setSelectedRestaurantId: (id: string | null) => void;
  navigateToRestaurant: (restaurantId: string) => void;
  navigateBackToFoodHome: () => void;

  // Restaurants list & data
  restaurants: Restaurant[];
  isLoadingRestaurants: boolean;
  filters: RestaurantFilterParams;
  setFilters: React.Dispatch<React.SetStateAction<RestaurantFilterParams>>;
  refreshRestaurants: () => Promise<void>;

  // Item customizer modal
  customizingItem: MenuItem | null;
  setCustomizingItem: (item: MenuItem | null) => void;

  // Cart
  cartItems: FoodCartItem[];
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
  cartRestaurantGroups: FoodCartRestaurantGroup[];
  totalCartItemCount: number;
  addToCart: (
    item: MenuItem,
    quantity: number,
    selectedOptions: FoodCartSelectedOption[],
    notes?: string
  ) => void;
  updateCartItemQuantity: (cartItemId: string, newQuantity: number) => void;
  removeCartItem: (cartItemId: string) => void;
  clearRestaurantCart: (restaurantId: string) => void;
  clearAllCart: () => void;

  // Checkout Modal
  checkoutRestaurantGroup: FoodCartRestaurantGroup | null;
  startCheckoutForRestaurant: (restaurantId: string) => void;
  closeCheckoutModal: () => void;
  submitRestaurantOrder: (params: {
    restaurant: Restaurant;
    customerName: string;
    customerPhone: string;
    address: FoodCustomerAddress;
    notes?: string;
  }) => Promise<{ success: boolean; order?: FoodOrder; message?: string }>;

  // Orders
  orders: FoodOrder[];
  isLoadingOrders: boolean;
  refreshOrders: () => Promise<void>;
  selectedOrderForDetail: FoodOrder | null;
  setSelectedOrderForDetail: (order: FoodOrder | null) => void;
  cancelOrder: (orderId: string, reason?: string) => Promise<{ success: boolean; message?: string }>;
  updateOrderStatusForTesting: (
    orderId: string,
    newStatus: FoodOrderStatus,
    deliveryStatus?: FoodDeliveryStatus
  ) => Promise<void>;

  // Customer Addresses
  addresses: FoodCustomerAddress[];
  refreshAddresses: () => Promise<void>;
  addNewAddress: (address: Omit<FoodCustomerAddress, 'id'>) => Promise<FoodCustomerAddress>;

  // Favorites
  favoriteRestaurantIds: string[];
  favoriteMenuItemIds: string[];
  toggleFavoriteRestaurant: (id: string) => void;
  toggleFavoriteMenuItem: (id: string) => void;
  isRestaurantFavorite: (id: string) => boolean;
  isMenuItemFavorite: (id: string) => boolean;
}

const FoodContext = createContext<FoodContextType | null>(null);

export const FoodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation state
  const [currentView, setCurrentView] = useState<FoodSectionView>('home');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  // Restaurants & Filters
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState<boolean>(true);
  const [filters, setFilters] = useState<RestaurantFilterParams>({
    cuisine: 'الكل',
    sortBy: 'recommended',
  });

  // Modals & Item Customization
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);
  const [checkoutRestaurantId, setCheckoutRestaurantId] = useState<string | null>(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<FoodOrder | null>(null);

  // Cart state
  const [cartItems, setCartItems] = useState<FoodCartItem[]>([]);

  // Orders state
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

  // Addresses state
  const [addresses, setAddresses] = useState<FoodCustomerAddress[]>([]);

  // Favorites state (in memory for clean reactivity)
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState<string[]>(['rest-1', 'rest-3']);
  const [favoriteMenuItemIds, setFavoriteMenuItemIds] = useState<string[]>(['item-101', 'item-301']);

  // Load restaurants
  const refreshRestaurants = useCallback(async () => {
    setIsLoadingRestaurants(true);
    try {
      const data = await foodService.listRestaurants(filters);
      setRestaurants(data);
    } finally {
      setIsLoadingRestaurants(false);
    }
  }, [filters]);

  useEffect(() => {
    refreshRestaurants();
  }, [refreshRestaurants]);

  // Load orders
  const refreshOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const data = await foodService.listMockCustomerOrders();
      setOrders(data);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  // Load addresses
  const refreshAddresses = useCallback(async () => {
    const data = await foodService.listCustomerAddresses();
    setAddresses(data);
  }, []);

  useEffect(() => {
    refreshOrders();
    refreshAddresses();
  }, [refreshOrders, refreshAddresses]);

  // Navigation helpers
  const navigateToRestaurant = useCallback((restaurantId: string) => {
    setSelectedRestaurantId(restaurantId);
    setCurrentView('restaurant');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateBackToFoodHome = useCallback(() => {
    setSelectedRestaurantId(null);
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Cart Actions
  const addToCart = useCallback(
    (item: MenuItem, quantity: number, selectedOptions: FoodCartSelectedOption[], notes?: string) => {
      // Calculate unit price = base price + add-ons
      const addOnsCost = selectedOptions.reduce((sum, opt) => sum + opt.price, 0);
      const unitPrice = item.price + addOnsCost;

      // Deterministic cart item ID based on options signature
      const optionsSig = selectedOptions
        .map((o) => `${o.groupId}:${o.optionId}`)
        .sort()
        .join('|');
      const cartItemId = `${item.id}__${optionsSig}__${notes ? notes.trim() : ''}`;

      setCartItems((prev) => {
        const existingIdx = prev.findIndex((ci) => ci.cartItemId === cartItemId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + quantity,
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              cartItemId,
              menuItemId: item.id,
              restaurantId: item.restaurantId,
              restaurantName: item.restaurantName,
              name: item.name,
              basePrice: item.price,
              unitPrice,
              quantity,
              selectedOptions,
              notes: notes?.trim() || undefined,
              imageUrl: item.imageUrl,
              isAvailable: item.isAvailable,
            },
          ];
        }
      });
    },
    []
  );

  const updateCartItemQuantity = useCallback((cartItemId: string, newQuantity: number) => {
    setCartItems((prev) => {
      if (newQuantity <= 0) {
        return prev.filter((i) => i.cartItemId !== cartItemId);
      }
      return prev.map((i) => (i.cartItemId === cartItemId ? { ...i, quantity: newQuantity } : i));
    });
  }, []);

  const removeCartItem = useCallback((cartItemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  }, []);

  // Clear items for a specific restaurant only!
  const clearRestaurantCart = useCallback((restaurantId: string) => {
    setCartItems((prev) => prev.filter((i) => i.restaurantId !== restaurantId));
  }, []);

  const clearAllCart = useCallback(() => {
    setCartItems([]);
  }, []);

  // Compute Cart Restaurant Groups (Strict grouping per restaurant)
  const cartRestaurantGroups = useMemo<FoodCartRestaurantGroup[]>(() => {
    const groupsMap = new Map<string, FoodCartItem[]>();

    cartItems.forEach((item) => {
      if (!groupsMap.has(item.restaurantId)) {
        groupsMap.set(item.restaurantId, []);
      }
      groupsMap.get(item.restaurantId)!.push(item);
    });

    const groups: FoodCartRestaurantGroup[] = [];

    groupsMap.forEach((items, restaurantId) => {
      const rest = restaurants.find((r) => r.id === restaurantId);
      const restaurantName = items[0]?.restaurantName || rest?.name || 'مطعم';
      const isOpen = rest ? rest.isOpen : true;

      const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

      let discount = 0;
      if (rest?.discountBadge?.includes('15%')) {
        discount = Math.round(subtotal * 0.15);
      } else if (rest?.discountBadge?.includes('خصم')) {
        discount = 15;
      }

      const deliveryFee = rest ? rest.deliveryFee : 15;
      const total = Math.max(0, subtotal - discount + deliveryFee);

      groups.push({
        restaurantId,
        restaurantName,
        restaurant: rest,
        isOpen,
        items,
        subtotal,
        discount,
        deliveryFee,
        total,
      });
    });

    return groups;
  }, [cartItems, restaurants]);

  const totalCartItemCount = useMemo(() => {
    return cartItems.reduce((sum, i) => sum + i.quantity, 0);
  }, [cartItems]);

  // Checkout Actions
  const startCheckoutForRestaurant = useCallback((restaurantId: string) => {
    setCheckoutRestaurantId(restaurantId);
    setIsCartDrawerOpen(false);
  }, []);

  const closeCheckoutModal = useCallback(() => {
    setCheckoutRestaurantId(null);
  }, []);

  const checkoutRestaurantGroup = useMemo(() => {
    if (!checkoutRestaurantId) return null;
    return cartRestaurantGroups.find((g) => g.restaurantId === checkoutRestaurantId) || null;
  }, [checkoutRestaurantId, cartRestaurantGroups]);

  const submitRestaurantOrder = useCallback(
    async (params: {
      restaurant: Restaurant;
      customerName: string;
      customerPhone: string;
      address: FoodCustomerAddress;
      notes?: string;
    }) => {
      const group = cartRestaurantGroups.find((g) => g.restaurantId === params.restaurant.id);
      if (!group || group.items.length === 0) {
        return { success: false, message: 'السلة فارغة لهذا المطعم' };
      }

      const result = await foodService.createMockRestaurantOrder({
        restaurant: params.restaurant,
        items: group.items,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        address: params.address,
        notes: params.notes,
      });

      if (result.success && result.order) {
        // Clear ONLY this restaurant's items from the cart!
        clearRestaurantCart(params.restaurant.id);
        // Refresh orders list
        await refreshOrders();
        // Select order for detail modal / tracker
        setSelectedOrderForDetail(result.order);
        closeCheckoutModal();
      }

      return result;
    },
    [cartRestaurantGroups, clearRestaurantCart, refreshOrders, closeCheckoutModal]
  );

  // Address Actions
  const addNewAddress = useCallback(async (address: Omit<FoodCustomerAddress, 'id'>) => {
    const created = await foodService.addCustomerAddress(address);
    setAddresses((prev) => [created, ...prev]);
    return created;
  }, []);

  // Order Actions
  const cancelOrder = useCallback(async (orderId: string, reason?: string) => {
    const res = await foodService.cancelOrder(orderId, reason);
    if (res.success) {
      await refreshOrders();
      if (selectedOrderForDetail?.id === orderId) {
        const updated = await foodService.getMockOrderDetails(orderId);
        setSelectedOrderForDetail(updated);
      }
    }
    return res;
  }, [refreshOrders, selectedOrderForDetail]);

  const updateOrderStatusForTesting = useCallback(
    async (orderId: string, newStatus: FoodOrderStatus, deliveryStatus?: FoodDeliveryStatus) => {
      const updated = await foodService.updateMockOrderStatusForTesting(orderId, newStatus, deliveryStatus);
      if (updated) {
        await refreshOrders();
        if (selectedOrderForDetail?.id === orderId) {
          setSelectedOrderForDetail(updated);
        }
      }
    },
    [refreshOrders, selectedOrderForDetail]
  );

  // Favorites
  const toggleFavoriteRestaurant = useCallback((id: string) => {
    setFavoriteRestaurantIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  }, []);

  const toggleFavoriteMenuItem = useCallback((id: string) => {
    setFavoriteMenuItemIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  }, []);

  const isRestaurantFavorite = useCallback(
    (id: string) => favoriteRestaurantIds.includes(id),
    [favoriteRestaurantIds]
  );

  const isMenuItemFavorite = useCallback(
    (id: string) => favoriteMenuItemIds.includes(id),
    [favoriteMenuItemIds]
  );

  return (
    <FoodContext.Provider
      value={{
        currentView,
        setCurrentView,
        selectedRestaurantId,
        setSelectedRestaurantId,
        navigateToRestaurant,
        navigateBackToFoodHome,
        restaurants,
        isLoadingRestaurants,
        filters,
        setFilters,
        refreshRestaurants,
        customizingItem,
        setCustomizingItem,
        cartItems,
        isCartDrawerOpen,
        setIsCartDrawerOpen,
        cartRestaurantGroups,
        totalCartItemCount,
        addToCart,
        updateCartItemQuantity,
        removeCartItem,
        clearRestaurantCart,
        clearAllCart,
        checkoutRestaurantGroup,
        startCheckoutForRestaurant,
        closeCheckoutModal,
        submitRestaurantOrder,
        orders,
        isLoadingOrders,
        refreshOrders,
        selectedOrderForDetail,
        setSelectedOrderForDetail,
        cancelOrder,
        updateOrderStatusForTesting,
        addresses,
        refreshAddresses,
        addNewAddress,
        favoriteRestaurantIds,
        favoriteMenuItemIds,
        toggleFavoriteRestaurant,
        toggleFavoriteMenuItem,
        isRestaurantFavorite,
        isMenuItemFavorite,
      }}
    >
      {children}
    </FoodContext.Provider>
  );
};

export const useFood = (): FoodContextType => {
  const context = useContext(FoodContext);
  if (!context) {
    throw new Error('useFood must be used within a FoodProvider');
  }
  return context;
};

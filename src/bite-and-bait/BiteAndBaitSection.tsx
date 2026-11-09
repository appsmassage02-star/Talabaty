import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type {
  Restaurant,
  MenuItem,
  RestaurantCategory,
  FoodCartItem,
  FoodOrder,
  FoodCustomerAddress,
  FoodCartSelectedOption,
  FoodOffer,
  BiteBaitView,
  BiteBaitRatingPayload,
  BiteBaitFoodOrder,
  BiteBaitComplaintTicket,
  BiteBaitMissingItemReport,
  BiteBaitPriceChangeProposal,
  RestaurantSectionSettings,
  CreateBiteBaitOrderItemPayload,
} from './types';
import './styles/bite-and-bait.css';

import { useApp } from '../context/AppContext';
import { biteAndBaitService } from './services/biteAndBaitService';

import {
  PREVIEW_RESTAURANTS,
  PREVIEW_FOODS,
  PREVIEW_CATEGORIES,
  PREVIEW_ORDERS,
  PREVIEW_SAVED_ADDRESSES,
} from './previewData';

import { BiteBaitHomeView } from './views/BiteBaitHomeView';
import { BiteBaitRestaurantsView } from './views/BiteBaitRestaurantsView';
import { BiteBaitRestaurantDetailView } from './views/BiteBaitRestaurantDetailView';
import { BiteBaitCartView, type RestaurantCartGroup } from './views/BiteBaitCartView';
import { BiteBaitCheckoutView } from './views/BiteBaitCheckoutView';
import { BiteBaitOrdersView } from './views/BiteBaitOrdersView';
import { BiteBaitFavoritesView } from './views/BiteBaitFavoritesView';
import { BiteBaitOffersView } from './views/BiteBaitOffersView';
import { BiteBaitProductModal } from './components/BiteBaitProductModal';
import { BiteBaitNotificationPreferencesModal } from './components/BiteBaitNotificationPreferencesModal';
import { BiteBaitEmptyState } from './components/BiteBaitEmptyState';

export interface BiteAndBaitSectionProps {
  onBackToAppHome: () => void;
  restaurants?: Restaurant[];
  foods?: MenuItem[];
  categories?: RestaurantCategory[];
  cartItems?: FoodCartItem[];
  orders?: FoodOrder[];
  savedAddresses?: FoodCustomerAddress[];
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
  onAddToCart?: (item: MenuItem) => void;
  onRemoveFromCart?: (item: MenuItem) => void;
  onUpdateCartQuantity?: (cartItemId: string, newQuantity: number) => void;
  onClearCart?: () => void;
  onSubmitOrder?: (details: {
    customerName: string;
    customerPhone: string;
    address: string;
    notes?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  onSubmitRating?: (payload: BiteBaitRatingPayload) => Promise<void>;
  isSectionDisabled?: boolean;
  disabledMessage?: string;
  forcePreviewMode?: boolean;
}

export const BiteAndBaitSection: React.FC<BiteAndBaitSectionProps> = ({
  onBackToAppHome,
  restaurants: propRestaurants = [],
  foods: propFoods = [],
  categories: propCategories = [],
  cartItems: propCartItems,
  orders: propOrders = [],
  savedAddresses: propAddresses = [],
  defaultCustomerName,
  defaultCustomerPhone,
  onAddToCart: propOnAddToCart,
  onRemoveFromCart: propOnRemoveFromCart,
  onUpdateCartQuantity: propOnUpdateCartQuantity,
  onClearCart: propOnClearCart,
  onSubmitOrder: propOnSubmitOrder,
  onSubmitRating: propOnSubmitRating,
  isSectionDisabled = false,
  disabledMessage = 'قسم المطاعم معطل، سيتم التشغيل لاحقًا.',
  forcePreviewMode = false,
}) => {
  // Global app context
  const { supabaseUser, supabaseProfile, household, isSupabaseConnected } = useApp();

  const [currentView, setCurrentView] = useState<BiteBaitView>('home');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [checkoutRestaurantId, setCheckoutRestaurantId] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [previewNotification, setPreviewNotification] = useState<string | null>(null);

  // Modals state
  const [selectedProductForModal, setSelectedProductForModal] = useState<MenuItem | null>(null);
  const [isNotificationPreferencesOpen, setIsNotificationPreferencesOpen] = useState(false);

  // --------------------------------------------------------------------------
  // Supabase Real Datasets (Read-Only)
  // --------------------------------------------------------------------------
  const [sectionSettings, setSectionSettings] = useState<RestaurantSectionSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [dbCategories, setDbCategories] = useState<RestaurantCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [dbRestaurants, setDbRestaurants] = useState<Restaurant[]>([]);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState<boolean>(true);
  const [restaurantsError, setRestaurantsError] = useState<string | null>(null);

  const [dbOffers, setDbOffers] = useState<FoodOffer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState<boolean>(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  const [dbAddresses, setDbAddresses] = useState<FoodCustomerAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState<boolean>(false);

  const [dbOrders, setDbOrders] = useState<BiteBaitFoodOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // On-demand menus cached per restaurantId: restaurantId -> MenuItem[]
  const [restaurantMenus, setRestaurantMenus] = useState<Record<string, MenuItem[]>>({});
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Favorites state:
  // Restaurant favorites are loaded from restaurant_favorites table
  // Food dish favorites are local in-memory during this stage (as per schema specifications)
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState<string[]>([]);
  const [favoriteFoodIds, setFavoriteFoodIds] = useState<string[]>([]);

  // Cart state: Loaded from localStorage key 'talabaty_food_cart_v1' without data loss
  const [localCart, setLocalCart] = useState<FoodCartItem[]>(() => {
    if (typeof window === 'undefined') return propCartItems || [];
    try {
      const saved = localStorage.getItem('talabaty_food_cart_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validated = parsed.filter(
            (item: any) =>
              item &&
              typeof item.cartItemId === 'string' &&
              typeof item.menuItemId === 'string' &&
              typeof item.restaurantId === 'string' &&
              typeof item.name === 'string' &&
              typeof item.quantity === 'number' &&
              item.quantity > 0
          );
          if (validated.length > 0) {
            return validated;
          }
        }
      }
    } catch (e) {
      console.warn('[BiteAndBait] Error reading cart from localStorage:', e);
    }
    return propCartItems || [];
  });

  // Keep localStorage in sync with localCart changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('talabaty_food_cart_v1', JSON.stringify(localCart));
      } catch (e) {
        console.warn('[BiteAndBait] Error saving cart to localStorage:', e);
      }
    }
  }, [localCart]);

  // Coordinator tickets state (local simulation for this stage)
  const [complaintTickets, setComplaintTickets] = useState<BiteBaitComplaintTicket[]>([]);
  const [missingReports, setMissingReports] = useState<BiteBaitMissingItemReport[]>([]);
  const [priceChangeProposals, setPriceChangeProposals] = useState<Record<string, BiteBaitPriceChangeProposal>>({});

  // --------------------------------------------------------------------------
  // Data Loading Handlers
  // --------------------------------------------------------------------------
  const loadSectionSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setSettingsError(null);
    const res = await biteAndBaitService.getSectionSettings();
    setIsLoadingSettings(false);
    if (res.success && res.data) {
      setSectionSettings(res.data);
    } else {
      setSettingsError(res.error || 'تعذر استرجاع إعدادات القسم');
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setCategoriesError(null);
    const res = await biteAndBaitService.getCategories();
    setIsLoadingCategories(false);
    if (res.success) {
      setDbCategories(res.data);
    } else {
      setCategoriesError(res.error || 'تعذر استرجاع تصنيفات المطاعم');
    }
  }, []);

  const loadRestaurants = useCallback(async () => {
    setIsLoadingRestaurants(true);
    setRestaurantsError(null);
    const res = await biteAndBaitService.getRestaurants();
    setIsLoadingRestaurants(false);
    if (res.success) {
      setDbRestaurants(res.data);
    } else {
      setRestaurantsError(res.error || 'تعذر استرجاع قائمة المطاعم');
    }
  }, []);

  const loadOffers = useCallback(async () => {
    setIsLoadingOffers(true);
    setOffersError(null);
    const res = await biteAndBaitService.getOffers();
    setIsLoadingOffers(false);
    if (res.success) {
      setDbOffers(res.data);
    } else {
      setOffersError(res.error || 'تعذر استرجاع العروض');
    }
  }, []);

  const loadAddresses = useCallback(async () => {
    setIsLoadingAddresses(true);
    const res = await biteAndBaitService.getHouseholdAddresses(household?.id, supabaseUser?.id);
    setIsLoadingAddresses(false);
    if (res.success) {
      setDbAddresses(res.data);
    }
  }, [household?.id, supabaseUser?.id]);

  const loadFavorites = useCallback(async () => {
    if (!supabaseUser?.id) {
      setFavoriteRestaurantIds([]);
      return;
    }
    const res = await biteAndBaitService.getFavoriteRestaurantIds(supabaseUser.id);
    if (res.success) {
      setFavoriteRestaurantIds(res.data);
    }
  }, [supabaseUser?.id]);

  const loadOrders = useCallback(async () => {
    if (!supabaseUser?.id) {
      setDbOrders([]);
      return;
    }
    setIsLoadingOrders(true);
    setOrdersError(null);
    const res = await biteAndBaitService.getCustomerOrders(supabaseUser.id);
    setIsLoadingOrders(false);
    if (res.success) {
      setDbOrders(res.data);
    } else {
      setOrdersError(res.error || 'تعذر استرجاع قائمة الطلبات');
    }
  }, [supabaseUser?.id]);

  // Load core section data on mount or when auth/household changes
  useEffect(() => {
    if (!forcePreviewMode) {
      loadSectionSettings();
      loadCategories();
      loadRestaurants();
      loadOffers();
      loadAddresses();
      loadFavorites();
      loadOrders();
    }
  }, [
    forcePreviewMode,
    loadSectionSettings,
    loadCategories,
    loadRestaurants,
    loadOffers,
    loadAddresses,
    loadFavorites,
    loadOrders,
  ]);

  // Lazy-load restaurant menu strictly on-demand when restaurant is opened
  const loadRestaurantMenu = useCallback(
    async (restaurantId: string, forceRefresh = false) => {
      if (!restaurantId) return;
      if (!forceRefresh && restaurantMenus[restaurantId]) {
        return; // Already cached
      }

      setIsLoadingMenu(true);
      setMenuError(null);
      const res = await biteAndBaitService.getRestaurantMenu(restaurantId);
      setIsLoadingMenu(false);

      if (res.success) {
        setRestaurantMenus((prev) => ({
          ...prev,
          [restaurantId]: res.data,
        }));
      } else {
        setMenuError(res.error || 'تعذر استرجاع قائمة طعام المطعم.');
      }
    },
    [restaurantMenus]
  );

  useEffect(() => {
    if (selectedRestaurantId && !forcePreviewMode) {
      loadRestaurantMenu(selectedRestaurantId);
    }
  }, [selectedRestaurantId, forcePreviewMode, loadRestaurantMenu]);

  // --------------------------------------------------------------------------
  // Active Datasets & Authenticated User Details
  // --------------------------------------------------------------------------
  const activeRestaurants = propRestaurants.length > 0
    ? propRestaurants
    : forcePreviewMode
    ? PREVIEW_RESTAURANTS
    : dbRestaurants;

  const activeCategories = propCategories.length > 0
    ? propCategories
    : forcePreviewMode
    ? PREVIEW_CATEGORIES
    : dbCategories;

  const activeAddresses = propAddresses.length > 0
    ? propAddresses
    : forcePreviewMode
    ? PREVIEW_SAVED_ADDRESSES
    : dbAddresses;

  const activeCartItems = propCartItems !== undefined ? propCartItems : localCart;

  const activeOrders = propOrders.length > 0
    ? (propOrders as BiteBaitFoodOrder[])
    : forcePreviewMode
    ? PREVIEW_ORDERS
    : dbOrders;

  // Authentic user name and phone (Zero invented identities)
  const currentCustomerName =
    defaultCustomerName ||
    supabaseProfile?.full_name ||
    household?.admin_name ||
    (supabaseUser?.email ? supabaseUser.email.split('@')[0] : 'ضيف غير مسجل');

  const currentCustomerPhone =
    defaultCustomerPhone ||
    supabaseProfile?.phone ||
    household?.admin_phone ||
    '';

  // Selected restaurant foods for detail view
  const selectedRestaurantFoods = useMemo(() => {
    if (!selectedRestaurantId) return [];
    if (forcePreviewMode) {
      return (propFoods.length > 0 ? propFoods : PREVIEW_FOODS).filter(
        (f) => f.restaurantId === selectedRestaurantId
      );
    }
    return restaurantMenus[selectedRestaurantId] || [];
  }, [selectedRestaurantId, forcePreviewMode, propFoods, restaurantMenus]);

  // Featured foods for home view
  const featuredFoods = useMemo(() => {
    if (forcePreviewMode) {
      return propFoods.length > 0 ? propFoods : PREVIEW_FOODS;
    }
    // Aggregate loaded menus
    const list: MenuItem[] = [];
    Object.keys(restaurantMenus).forEach((key) => {
      const menu = restaurantMenus[key];
      if (Array.isArray(menu)) {
        menu.forEach((item) => list.push(item));
      }
    });
    return list;
  }, [forcePreviewMode, propFoods, restaurantMenus]);

  // Show a temporary feedback toast banner
  const triggerNotification = (msg: string) => {
    setPreviewNotification(msg);
    setTimeout(() => {
      setPreviewNotification(null);
    }, 4500);
  };

  // MULTI-RESTAURANT CART: Group items strictly by restaurantId
  const restaurantGroups = useMemo<RestaurantCartGroup[]>(() => {
    const map: Record<string, RestaurantCartGroup> = {};

    activeCartItems.forEach((item) => {
      if (!map[item.restaurantId]) {
        const rest = activeRestaurants.find((r) => r.id === item.restaurantId);
        map[item.restaurantId] = {
          restaurantId: item.restaurantId,
          restaurantName: item.restaurantName || rest?.name || 'مطعم معتمد',
          restaurant: rest,
          items: [],
          subtotal: 0,
          deliveryFee: rest?.deliveryFee ?? 0,
          total: 0,
          isOpen: rest?.isOpen ?? true,
          nextOpeningTime: rest?.nextOpeningTime,
        };
      }

      map[item.restaurantId].items.push(item);
      map[item.restaurantId].subtotal += item.unitPrice * item.quantity;
    });

    // Compute totals per group
    Object.values(map).forEach((group) => {
      group.total = group.subtotal + (group.items.length > 0 ? group.deliveryFee : 0);
    });

    return Object.values(map);
  }, [activeCartItems, activeRestaurants]);

  // Overall Cart Aggregate Totals across all restaurants
  const overallSubtotal = useMemo(() => {
    return restaurantGroups.reduce((acc, g) => acc + g.subtotal, 0);
  }, [restaurantGroups]);

  const overallDelivery = useMemo(() => {
    return restaurantGroups.reduce((acc, g) => acc + (g.items.length > 0 ? g.deliveryFee : 0), 0);
  }, [restaurantGroups]);

  const overallTotal = overallSubtotal + overallDelivery;

  const cartTotalItemsCount = useMemo(() => {
    return activeCartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [activeCartItems]);

  // Fast map lookup for item quantities in cart
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    activeCartItems.forEach((item) => {
      map[item.menuItemId] = (map[item.menuItemId] || 0) + item.quantity;
    });
    return map;
  }, [activeCartItems]);

  // Selected restaurant for detail view
  const selectedRestaurant = useMemo(() => {
    return activeRestaurants.find((r) => r.id === selectedRestaurantId) || null;
  }, [activeRestaurants, selectedRestaurantId]);

  // Items designated for Checkout (filtered to the selected checkout restaurant)
  const checkoutGroup = useMemo(() => {
    if (!checkoutRestaurantId) {
      return restaurantGroups[0] || null;
    }
    return restaurantGroups.find((g) => g.restaurantId === checkoutRestaurantId) || null;
  }, [restaurantGroups, checkoutRestaurantId]);

  // Toggle favorite restaurant (In-memory feedback; restaurant favorites table is read-only this phase)
  const handleToggleFavoriteRestaurant = (restaurantId: string) => {
    setFavoriteRestaurantIds((prev) => {
      const exists = prev.includes(restaurantId);
      const updated = exists ? prev.filter((id) => id !== restaurantId) : [...prev, restaurantId];
      const rest = activeRestaurants.find((r) => r.id === restaurantId);
      const name = rest ? rest.name : 'المطعم';
      triggerNotification(
        exists
          ? `تمت إزالة ${name} من المفضلة (تعديل محلي ومؤقت في مرحلة القراءة فقط)`
          : `تمت إضافة ${name} إلى المفضلة ❤️ (تعديل محلي ومؤقت في مرحلة القراءة فقط)`
      );
      return updated;
    });
  };

  // Toggle favorite food (In-memory state strictly as specified by database schema)
  const handleToggleFavoriteFood = (foodId: string) => {
    setFavoriteFoodIds((prev) => {
      const exists = prev.includes(foodId);
      const updated = exists ? prev.filter((id) => id !== foodId) : [...prev, foodId];
      triggerNotification(
        exists
          ? 'تمت إزالة الصنف من قائمة الأطباق المفضلة (تعديل محلي ومؤقت في مرحلة القراءة فقط)'
          : 'تمت إضافة الصنف إلى قائمة الأطباق المفضلة ❤️ (تعديل محلي ومؤقت في مرحلة القراءة فقط)'
      );
      return updated;
    });
  };

  // --------------------------------------------------------------------------
  // Cart Actions (React state only)
  // --------------------------------------------------------------------------
  const handleAddToCart = (item: MenuItem, selectedOptions: FoodCartSelectedOption[] = []) => {
    if (isSectionHardDisabled) {
      triggerNotification(`القسم غير متاح للطلب حالياً: ${disabledNotice}`);
      return;
    }

    if (propOnAddToCart) {
      propOnAddToCart(item);
      return;
    }

    const rest = activeRestaurants.find((r) => r.id === item.restaurantId);
    const restName = rest ? rest.name : item.restaurantName || 'مطعم';

    // Compute extra options cost
    const optionsTotal = selectedOptions.reduce((acc, opt) => acc + opt.price, 0);
    const finalUnitPrice = item.price + optionsTotal;

    // Build unique cartItemId based on item id and options
    const optionsKey = selectedOptions
      .map((o) => `${o.groupId}:${o.optionId}`)
      .sort()
      .join('|');
    const cartItemId = optionsKey ? `${item.id}_${optionsKey}` : item.id;

    setLocalCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.cartItemId === cartItemId);
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          quantity: copy[existingIndex].quantity + 1,
        };
        return copy;
      }

      const newItem: FoodCartItem = {
        cartItemId,
        menuItemId: item.id,
        restaurantId: item.restaurantId,
        restaurantName: restName,
        name: item.name,
        basePrice: item.price,
        unitPrice: finalUnitPrice,
        quantity: 1,
        selectedOptions,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
      };

      return [...prev, newItem];
    });

    triggerNotification(`تمت إضافة "${item.name}" إلى سلة ${restName} 🛒`);
  };

  const handleRemoveFromCart = (item: MenuItem) => {
    if (propOnRemoveFromCart) {
      propOnRemoveFromCart(item);
      return;
    }

    setLocalCart((prev) => {
      const itemIndex = prev.findIndex((c) => c.menuItemId === item.id);
      if (itemIndex === -1) return prev;

      const current = prev[itemIndex];
      if (current.quantity > 1) {
        const copy = [...prev];
        copy[itemIndex] = { ...current, quantity: current.quantity - 1 };
        return copy;
      }
      return prev.filter((_, idx) => idx !== itemIndex);
    });
  };

  const handleUpdateCartQuantity = (cartItemId: string, newQuantity: number) => {
    if (propOnUpdateCartQuantity) {
      propOnUpdateCartQuantity(cartItemId, newQuantity);
      return;
    }

    setLocalCart((prev) => {
      if (newQuantity <= 0) {
        return prev.filter((item) => item.cartItemId !== cartItemId);
      }
      return prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item
      );
    });
  };

  const handleClearCart = () => {
    if (propOnClearCart) {
      propOnClearCart();
      return;
    }
    setLocalCart([]);
    triggerNotification('تم تفريغ السلة بالكامل');
  };

  const handleProceedToCheckoutRestaurant = (restaurantId: string) => {
    const group = restaurantGroups.find((g) => g.restaurantId === restaurantId);
    if (!group || group.items.length === 0) {
      triggerNotification('لا توجد عناصر لهذا المطعم في السلة.');
      return;
    }
    if (!group.isOpen) {
      triggerNotification(
        `المطعم (${group.restaurantName}) مغلق حالياً. يرجى انتظار موعد الفتح (${group.nextOpeningTime || 'لاحقاً'}) لإتمام الطلب.`
      );
      return;
    }
    setCheckoutRestaurantId(restaurantId);
    setCurrentView('checkout');
  };

  // --------------------------------------------------------------------------
  // Order Submission via Real RPC: public.create_bite_bait_order
  // --------------------------------------------------------------------------
  const handleOrderSubmit = async (details: {
    customerName: string;
    customerPhone: string;
    address: string;
    addressId: string | null;
    latitude: number;
    longitude: number;
    idempotencyKey: string;
    notes?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    if (!checkoutGroup) {
      triggerNotification('⚠️ لم يتم العثور على مجموعة أصناف المطعم المطلوب.');
      return { success: false, message: 'أصناف المطعم مفقودة.' };
    }

    if (isSubmittingOrder) {
      return { success: false, message: 'جاري تسجيل الطلب بالفعل، يرجى الانتظار...' };
    }

    setIsSubmittingOrder(true);

    try {
      // 1. Authoritative Household ID Resolution
      // Rule 3: Do NOT query profiles.household_id as it does not exist in the database.
      // Extract household from household_members using current user, falling back to households.admin_id.
      const currentUserId = supabaseUser?.id || (supabaseProfile as any)?.id || '';
      let resolvedHouseholdId = household?.id || '';

      if (currentUserId) {
        const dbHhId = await biteAndBaitService.getUserHouseholdId(currentUserId);
        if (dbHhId) {
          resolvedHouseholdId = dbHhId;
        }
      }

      if (!resolvedHouseholdId) {
        setIsSubmittingOrder(false);
        const err = 'تعذر تحديد الأسرة المرتبطة بحسابك في النظام. يلزم أن يكون المستخدم عضواً في أسرة صالحة لتسجيل الطلب.';
        triggerNotification(`⚠️ ${err}`);
        return { success: false, message: err };
      }

      // 2. Format items according to RPC specification:
      // { menu_item_id, quantity, selected_options: [{ group_id, option_id }] }
      const rpcItems: CreateBiteBaitOrderItemPayload[] = checkoutGroup.items
        .filter((item) => item.menuItemId && item.quantity > 0)
        .map((item) => ({
          menu_item_id: item.menuItemId,
          quantity: Math.max(1, Math.floor(item.quantity)),
          selected_options: (item.selectedOptions || [])
            .filter((opt) => opt.groupId && opt.optionId)
            .map((opt) => ({
              group_id: opt.groupId,
              option_id: opt.optionId,
            })),
        }));

      if (rpcItems.length === 0) {
        setIsSubmittingOrder(false);
        const err = 'لا توجد أصناف صالحة للإرسال في هذا الطلب.';
        triggerNotification(`⚠️ ${err}`);
        return { success: false, message: err };
      }

      // 3. Invoke real RPC: public.create_bite_bait_order
      const res = await biteAndBaitService.createBiteBaitOrder({
        householdId: resolvedHouseholdId,
        restaurantId: checkoutGroup.restaurantId,
        addressId: details.addressId,
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        deliveryAddress: details.address,
        deliveryLatitude: details.latitude,
        deliveryLongitude: details.longitude,
        items: rpcItems,
        idempotencyKey: details.idempotencyKey,
      });

      setIsSubmittingOrder(false);

      if (!res.success || !res.data) {
        const err = res.error || 'فشل تسجيل الطلب في قاعدة البيانات.';
        triggerNotification(`⚠️ ${err}`);
        return {
          success: false,
          message: err,
        };
      }

      // 4. On RPC Success:
      const { orderNumber, isDuplicate } = res.data;

      // Clear items of the ordered restaurant ONLY from multi-restaurant cart
      setLocalCart((prev) => prev.filter((item) => item.restaurantId !== checkoutGroup.restaurantId));

      // Refresh customer orders history from database
      await loadOrders();

      const successNotice = isDuplicate
        ? `طلب مكرر معتمد: تم فتح تفاصيل الطلب رقم #${orderNumber} بنجاح ✅`
        : `تم تأكيد وتسجيل الطلب رقم #${orderNumber} لدى مطعم ${checkoutGroup.restaurantName} بنجاح! 🚀`;

      triggerNotification(successNotice);

      // Reset checkout restaurant and navigate to orders view
      setCheckoutRestaurantId(null);
      setCurrentView('orders');

      return {
        success: true,
        message: successNotice,
      };
    } catch (err: any) {
      setIsSubmittingOrder(false);
      const errMsg = err?.message || 'حدث خطأ غير متوقع أثناء إرسال الطلب.';
      triggerNotification(`⚠️ ${errMsg}`);
      return {
        success: false,
        message: errMsg,
      };
    }
  };

  const handleRatingSubmit = async (payload: BiteBaitRatingPayload) => {
    if (propOnSubmitRating) {
      await propOnSubmitRating(payload);
      return;
    }
    triggerNotification(
      `تم استلام تقييمك (${payload.restaurantRating} نجوم للمطعم و ${payload.driverRating} نجوم للتوصيل) بنجاح محلياً ⭐`
    );
  };

  const handleRequestOrderCancellation = (orderId: string, reason: string) => {
    triggerNotification(
      `تم تقديم طلب إلغاء الطلب: "${reason}". تنبيه: مرحلة الربط الحالية مخصصة للقراءة فقط ولم يتم تعديل السجل في قاعدة البيانات.`
    );
  };

  const handleSimulateCancellationReview = (
    orderId: string,
    decision: 'approve' | 'reject',
    reviewNote?: string
  ) => {
    triggerNotification(
      decision === 'approve'
        ? `تمت الموافقة على إلغاء الطلب (${reviewNote || 'بناءً على طلب العميل'}) محلياً.`
        : `تم رفض إلغاء الطلب (${reviewNote || 'الطلب قيد التجهيز بالفعل'}) محلياً.`
    );
  };

  const handleSubmitComplaint = (ticket: Omit<BiteBaitComplaintTicket, 'id' | 'createdAt'>) => {
    const newTicket: BiteBaitComplaintTicket = {
      ...ticket,
      id: `comp_${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setComplaintTickets((prev) => [newTicket, ...prev]);
    triggerNotification(
      `تم إرسال الشكوى رقم #${newTicket.id.slice(-6)} إلى فريق منسق العمليات للمراجعة 📋`
    );
  };

  const handleSubmitMissingReport = (report: Omit<BiteBaitMissingItemReport, 'id' | 'createdAt'>) => {
    const newReport: BiteBaitMissingItemReport = {
      ...report,
      id: `rep_${Date.now()}`,
      status: 'under_review',
      createdAt: new Date().toISOString(),
    };
    setMissingReports((prev) => [newReport, ...prev]);
    triggerNotification(
      `تم تسجيل بلاغ نقص الأطباق (${report.missingItems.join('، ')}) بنجاح وجاري فحص محتويات الفاتورة مع المطعم 🔍`
    );
  };

  const handleRespondPriceChange = (orderId: string, accept: boolean) => {
    setPriceChangeProposals((prev) => {
      const prop = prev[orderId];
      if (!prop) return prev;
      return {
        ...prev,
        [orderId]: {
          ...prop,
          status: accept ? 'accepted' : 'rejected',
        },
      };
    });

    triggerNotification(
      accept
        ? 'تمت الموافقة على تعديل السعر وسيتم تحديث إجمالي الفاتورة 🟢'
        : 'تم رفض تعديل السعر، وسيتم إبلاغ المطعم لإلغاء الصنف الإضافي أو تثبيت السعر الأصلي 🔴'
    );
  };

  const handleCreatePriceChangeProposal = (proposal: BiteBaitPriceChangeProposal) => {
    setPriceChangeProposals((prev) => ({
      ...prev,
      [proposal.orderId]: {
        ...proposal,
        id: `prop_${Date.now()}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    }));
    triggerNotification(
      `ورد مقترح تغيير سعر جديد للطلب ${proposal.orderId} بمبلغ ${proposal.priceDifference} ج.م`
    );
  };

  const handleNavigateView = (view: BiteBaitView, meta?: { restaurantId?: string }) => {
    if (meta?.restaurantId) {
      setSelectedRestaurantId(meta.restaurantId);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --------------------------------------------------------------------------
  // Check Section Enabled / Disabled State (restaurant_section_settings)
  // --------------------------------------------------------------------------
  const isSectionHardDisabled =
    isSectionDisabled ||
    Boolean(settingsError) ||
    (sectionSettings ? !sectionSettings.section_enabled : false);

  const disabledNotice =
    (sectionSettings && sectionSettings.status_message) ||
    (settingsError ? `تعذر استرجاع إعدادات القسم: ${settingsError}` : disabledMessage);

  // 1. Explicit Loading State for Section Settings
  if (isLoadingSettings) {
    return (
      <div className="bite-and-bait-scope" style={{ padding: '50px 20px', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            width: '36px',
            height: '36px',
            border: '3px solid #f1f5f9',
            borderTopColor: '#f59e0b',
            borderRadius: '50%',
            animation: 'bnbSpin 1s linear infinite',
          }}
        />
        <p style={{ marginTop: '14px', fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
          جاري فحص إعدادات وتصاريح قسم بايت آند بيت من قاعدة البيانات...
        </p>
      </div>
    );
  }

  // 2. Explicit Error State with Retry Button (Section strictly disabled on error)
  if (settingsError) {
    return (
      <div className="bite-and-bait-scope" style={{ padding: '30px 20px' }}>
        <div
          style={{
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            margin: '0 auto',
            maxWidth: '540px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#991b1b', margin: '0 0 8px' }}>
            تعذر استرجاع إعدادات قسم بايت آند بيت
          </h3>
          <p style={{ fontSize: '12.5px', color: '#7f1d1d', margin: '0 0 16px', lineHeight: 1.5 }}>
            وفقاً لضوابط السلامة الصارمة، يعتبر القسم معطلاً تلقائياً عند فشل استرجاع الإعدادات من قاعدة البيانات لضمان عدم تنفيذ أي عمليات غير مصرح بها.
            <br />
            <span style={{ fontSize: '11px', color: '#b91c1c', marginTop: '6px', display: 'block' }}>
              تفاصيل الخطأ: {settingsError}
            </span>
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onBackToAppHome}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '8px 18px',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ← العودة للرئيسية
            </button>
            <button
              type="button"
              onClick={() => loadSectionSettings()}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              إعادة المحاولة 🔄
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Section Visibility: Hidden
  if (sectionSettings && sectionSettings.section_visibility === 'hidden') {
    return (
      <div className="bite-and-bait-scope" style={{ padding: '30px 20px' }}>
        <div
          style={{
            background: '#f8fafc',
            border: '1.5px solid #cbd5e1',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            margin: '0 auto',
            maxWidth: '540px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>👁️‍🗨️</div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#334155', margin: '0 0 8px' }}>
            قسم بايت آند بيت مخفي حالياً
          </h3>
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
            تم ضبط رؤية هذا القسم على (مخفي) في جدول إعدادات النظام restaurant_section_settings.
          </p>
          <button
            type="button"
            onClick={onBackToAppHome}
            style={{
              background: '#f1f5f9',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  // 4. Section Disabled Display Mode: 'hide'
  if (isSectionHardDisabled && sectionSettings?.disabled_display_mode === 'hide') {
    return (
      <div className="bite-and-bait-scope" style={{ padding: '30px 20px' }}>
        <div
          style={{
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            margin: '0 auto',
            maxWidth: '540px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#991b1b', margin: '0 0 8px' }}>
            قسم بايت آند بيت مغلق حالياً
          </h3>
          <p style={{ fontSize: '12.5px', color: '#7f1d1d', margin: '0 0 16px', lineHeight: 1.5 }}>
            {disabledNotice}
          </p>
          <button
            type="button"
            onClick={onBackToAppHome}
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  // Determine Grayscale Mode styling if configured
  const isGrayscaleMode = Boolean(
    isSectionHardDisabled && sectionSettings?.disabled_display_mode === 'grayscale'
  );

  return (
    <div
      className="bite-and-bait-scope"
      style={{
        position: 'relative',
        minHeight: '600px',
        filter: isGrayscaleMode ? 'grayscale(100%)' : 'none',
      }}
    >
      {/* Read-Only Status & Database Integration Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
          border: '1.5px solid #10b981',
          borderRadius: '16px',
          padding: '10px 16px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 10px rgba(16, 185, 129, 0.1)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🚀</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#065f46' }}>
              قسم بايت آند بيت – ربط إنشاء الطلبات بقاعدة البيانات الفعلية (RPC: create_bite_bait_order)
            </div>
            <div style={{ fontSize: '11px', color: '#047857' }}>
              يتم تسجيل وتوثيق الطلبات رسمياً في Supabase مع التحقق من عضوية الأسرة والـ GPS ومنع التكرار.
            </div>
          </div>
        </div>

        <span
          style={{
            background: '#10b981',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: '50px',
          }}
        >
          إنشاء الطلبات مفعل ✅
        </span>
      </div>

      {/* Floating Feedback Toast */}
      {previewNotification && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: '#0f172a',
            color: '#f8fafc',
            padding: '12px 22px',
            borderRadius: '14px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            border: '1.5px solid #f59e0b',
            fontSize: '13px',
            fontWeight: 800,
            maxWidth: '90vw',
            textAlign: 'center',
            animation: 'bnbSlideUp 0.25s ease',
          }}
        >
          {previewNotification}
        </div>
      )}

      {/* Section Disabled Notice if disabled in restaurant_section_settings */}
      {isSectionHardDisabled && (
        <div
          style={{
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
            borderRadius: '16px',
            padding: '14px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#991b1b',
          }}
        >
          <span style={{ fontSize: '24px' }}>🔒</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800 }}>قسم المطاعم غير متاح للطلب حالياً</div>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>{disabledNotice}</div>
          </div>
        </div>
      )}

      {/* Top Section Navigation Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onBackToAppHome}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <span>🏠</span>
            <span>العودة لأقسام البيت</span>
          </button>

          <span
            onClick={() => handleNavigateView('home')}
            style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', cursor: 'pointer' }}
          >
            🍔 بايت آند بيت (Bite & Bait)
          </span>
        </div>

        {/* View Shortcuts: Home, Restaurants, Offers, Favorites, Orders, Cart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleNavigateView('restaurants')}
            style={{
              border: 'none',
              background: currentView === 'restaurants' ? '#fef3c7' : 'transparent',
              color: currentView === 'restaurants' ? '#b45309' : '#475569',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            المطاعم
          </button>

          <button
            type="button"
            onClick={() => {
              loadOffers();
              handleNavigateView('offers');
            }}
            style={{
              border: 'none',
              background: currentView === 'offers' ? '#fef3c7' : 'transparent',
              color: currentView === 'offers' ? '#b45309' : '#475569',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            العروض 🔥
          </button>

          <button
            type="button"
            onClick={() => handleNavigateView('favorites')}
            style={{
              border: 'none',
              background: currentView === 'favorites' ? '#fef3c7' : 'transparent',
              color: currentView === 'favorites' ? '#b45309' : '#475569',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            المفضلة ({favoriteRestaurantIds.length + favoriteFoodIds.length})
          </button>

          <button
            type="button"
            onClick={() => {
              loadOrders();
              handleNavigateView('orders');
            }}
            style={{
              border: 'none',
              background: currentView === 'orders' ? '#fef3c7' : 'transparent',
              color: currentView === 'orders' ? '#b45309' : '#475569',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            طلباتي ({activeOrders.length})
          </button>

          <button
            type="button"
            onClick={() => handleNavigateView('cart')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '1.5px solid #f59e0b',
              background: '#fef3c7',
              color: '#b45309',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <span>🛒</span>
            <span>السلة</span>
            {cartTotalItemsCount > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#0f172a',
                  borderRadius: '50px',
                  padding: '1px 6px',
                  fontSize: '11px',
                }}
              >
                {cartTotalItemsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Global Section Error / Retry Banner */}
      {(restaurantsError || categoriesError) && (
        <div
          style={{
            padding: '14px 18px',
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
            borderRadius: '14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div style={{ fontSize: '13px', color: '#991b1b', fontWeight: 700 }}>
              {restaurantsError || categoriesError}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              loadRestaurants();
              loadCategories();
              loadSectionSettings();
            }}
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔄 إعادة المحاولة
          </button>
        </div>
      )}

      {/* Render Active View */}
      {currentView === 'home' && (
        isLoadingRestaurants || isLoadingCategories ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                border: '3.5px solid #f3f4f6',
                borderTopColor: '#f59e0b',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 14px',
              }}
            />
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
              جاري قراءة بيانات قسم بايت آند بيت من Supabase...
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              يتم استرجاع المطاعم النشطة والتصنيفات والإعدادات الرسمية
            </div>
          </div>
        ) : (
          <BiteBaitHomeView
            restaurants={activeRestaurants}
            featuredFoods={featuredFoods}
            categories={activeCategories}
            cartCount={cartTotalItemsCount}
            cartTotal={overallTotal}
            cartQuantities={cartQuantities}
            favoriteRestaurantIds={favoriteRestaurantIds}
            favoriteFoodIds={favoriteFoodIds}
            onToggleFavoriteRestaurant={handleToggleFavoriteRestaurant}
            onToggleFavoriteFood={handleToggleFavoriteFood}
            onNavigateView={handleNavigateView}
            onAddToCart={handleAddToCart}
            onRemoveFromCart={handleRemoveFromCart}
            onOpenItemDetails={(item) => setSelectedProductForModal(item)}
            onSelectRestaurant={(r) => {
              setSelectedRestaurantId(r.id);
              setCurrentView('restaurant');
            }}
            onOpenNotificationPreferences={() => setIsNotificationPreferencesOpen(true)}
          />
        )
      )}

      {currentView === 'restaurants' && (
        <BiteBaitRestaurantsView
          restaurants={activeRestaurants}
          favoriteRestaurantIds={favoriteRestaurantIds}
          onToggleFavorite={handleToggleFavoriteRestaurant}
          onSelectRestaurant={(r) => {
            setSelectedRestaurantId(r.id);
            setCurrentView('restaurant');
          }}
          onNavigateBack={() => setCurrentView('home')}
        />
      )}

      {currentView === 'restaurant' && (
        selectedRestaurant ? (
          <BiteBaitRestaurantDetailView
            restaurant={selectedRestaurant}
            menuItems={selectedRestaurantFoods}
            cartCount={cartTotalItemsCount}
            cartTotal={overallTotal}
            cartQuantities={cartQuantities}
            favoriteFoodIds={favoriteFoodIds}
            isRestaurantFavorite={favoriteRestaurantIds.includes(selectedRestaurant.id)}
            isLoadingMenu={isLoadingMenu}
            menuError={menuError}
            onRetryMenu={() => loadRestaurantMenu(selectedRestaurant.id, true)}
            onToggleFavoriteRestaurant={handleToggleFavoriteRestaurant}
            onToggleFavoriteFood={handleToggleFavoriteFood}
            onNavigateBack={() => setCurrentView('restaurants')}
            onOpenCart={() => setCurrentView('cart')}
            onAddToCart={handleAddToCart}
            onRemoveFromCart={handleRemoveFromCart}
            onOpenItemDetails={(item) => setSelectedProductForModal(item)}
          />
        ) : (
          <BiteBaitEmptyState
            icon="🏪"
            title="يرجى اختيار مطعم"
            description="لم يتم تحديد مطعم لعرض تفاصيله، يمكنك الرجوع لقائمة المطاعم واختيار المطعم المفضل."
            actionLabel="قائمة المطاعم 👈"
            onAction={() => setCurrentView('restaurants')}
          />
        )
      )}

      {currentView === 'cart' && (
        <BiteBaitCartView
          cartItems={activeCartItems}
          restaurantGroups={restaurantGroups}
          overallSubtotal={overallSubtotal}
          overallDelivery={overallDelivery}
          overallTotal={overallTotal}
          totalItemsCount={cartTotalItemsCount}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={(id) => handleUpdateCartQuantity(id, 0)}
          onClearCart={handleClearCart}
          onProceedToCheckoutRestaurant={handleProceedToCheckoutRestaurant}
          onContinueShopping={() => setCurrentView('home')}
        />
      )}

      {currentView === 'checkout' && (
        checkoutGroup ? (
          <BiteBaitCheckoutView
            cartItems={checkoutGroup.items}
            subtotal={checkoutGroup.subtotal}
            deliveryFee={checkoutGroup.deliveryFee}
            totalPrice={checkoutGroup.total}
            restaurantName={checkoutGroup.restaurantName}
            savedAddresses={activeAddresses}
            defaultCustomerName={currentCustomerName}
            defaultCustomerPhone={currentCustomerPhone}
            onSubmitOrder={handleOrderSubmit}
            onNavigateBackToCart={() => setCurrentView('cart')}
            isSubmitting={isSubmittingOrder}
          />
        ) : (
          <BiteBaitEmptyState
            icon="🛒"
            title="لم يتم تحديد طلب مطعم للمتابعة"
            description="يرجى الرجوع إلى السلة واختيار المطعم الذي ترغب في إتمام طلبه."
            actionLabel="الرجوع للسلة 👈"
            onAction={() => setCurrentView('cart')}
          />
        )
      )}

      {currentView === 'orders' && (
        isLoadingOrders ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid #f3f4f6',
                borderTopColor: '#f59e0b',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px',
              }}
            />
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
              جاري استرجاع طلباتك من قاعدة البيانات...
            </div>
          </div>
        ) : ordersError ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              background: '#fef2f2',
              borderRadius: '16px',
              border: '1.5px solid #fca5a5',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
              تعذر استرجاع الطلبات من قاعدة البيانات
            </div>
            <div style={{ fontSize: '12px', color: '#b91c1c', marginBottom: '14px' }}>
              {ordersError}
            </div>
            <button
              type="button"
              onClick={loadOrders}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔄 إعادة المحاولة
            </button>
          </div>
        ) : (
          <BiteBaitOrdersView
            orders={activeOrders}
            complaintTickets={complaintTickets}
            missingReports={missingReports}
            priceChangeProposals={priceChangeProposals}
            onNavigateToHome={() => setCurrentView('home')}
            onSubmitRating={handleRatingSubmit}
            onRequestCancellation={handleRequestOrderCancellation}
            onSimulateCancellationReview={handleSimulateCancellationReview}
            onSubmitComplaint={handleSubmitComplaint}
            onSubmitMissingReport={handleSubmitMissingReport}
            onRespondPriceChange={handleRespondPriceChange}
            onCreatePriceChangeProposal={handleCreatePriceChangeProposal}
          />
        )
      )}

      {currentView === 'favorites' && (
        <BiteBaitFavoritesView
          favoriteRestaurants={activeRestaurants.filter((r) =>
            favoriteRestaurantIds.includes(r.id)
          )}
          favoriteFoods={featuredFoods.filter((f) => favoriteFoodIds.includes(f.id))}
          cartQuantities={cartQuantities}
          onNavigateView={handleNavigateView}
          onSelectRestaurant={(r) => {
            setSelectedRestaurantId(r.id);
            setCurrentView('restaurant');
          }}
          onAddToCart={handleAddToCart}
          onRemoveFromCart={handleRemoveFromCart}
          onOpenDetails={(item) => setSelectedProductForModal(item)}
          onToggleFavoriteRestaurant={handleToggleFavoriteRestaurant}
          onToggleFavoriteFood={handleToggleFavoriteFood}
        />
      )}

      {currentView === 'offers' && (
        <BiteBaitOffersView
          offers={dbOffers}
          foods={featuredFoods}
          isLoadingOffers={isLoadingOffers}
          offersError={offersError}
          onRetryOffers={loadOffers}
          cartQuantities={cartQuantities}
          favoriteFoodIds={favoriteFoodIds}
          onNavigateView={handleNavigateView}
          onAddToCart={handleAddToCart}
          onRemoveFromCart={handleRemoveFromCart}
          onOpenDetails={(item) => setSelectedProductForModal(item)}
          onToggleFavoriteFood={handleToggleFavoriteFood}
        />
      )}

      {/* Product Details Customizer Modal */}
      {selectedProductForModal && (
        <BiteBaitProductModal
          item={selectedProductForModal}
          isOpen={Boolean(selectedProductForModal)}
          onClose={() => setSelectedProductForModal(null)}
          onAddToCart={(item, selectedOptions) => {
            handleAddToCart(item, selectedOptions);
            setSelectedProductForModal(null);
          }}
        />
      )}

      {/* Notification Preferences Modal */}
      {isNotificationPreferencesOpen && (
        <BiteBaitNotificationPreferencesModal
          isOpen={isNotificationPreferencesOpen}
          onClose={() => setIsNotificationPreferencesOpen(false)}
        />
      )}
    </div>
  );
};

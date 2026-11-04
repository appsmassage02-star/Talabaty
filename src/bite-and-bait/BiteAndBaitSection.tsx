import React, { useState, useMemo } from 'react';
import type {
  Restaurant,
  MenuItem,
  RestaurantCategory,
  FoodCartItem,
  FoodOrder,
  FoodCustomerAddress,
  FoodCartSelectedOption,
  BiteBaitView,
  BiteBaitRatingPayload,
} from './types';
import './styles/bite-and-bait.css';

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
  defaultCustomerName = 'محمد أحمد',
  defaultCustomerPhone = '01012345678',
  onAddToCart: propOnAddToCart,
  onRemoveFromCart: propOnRemoveFromCart,
  onUpdateCartQuantity: propOnUpdateCartQuantity,
  onClearCart: propOnClearCart,
  onSubmitOrder: propOnSubmitOrder,
  onSubmitRating: propOnSubmitRating,
  isSectionDisabled = false,
  disabledMessage = 'قسم المطاعم معطل، سيتم التشغيل لاحقًا.',
  forcePreviewMode = true,
}) => {
  const [currentView, setCurrentView] = useState<BiteBaitView>('home');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [checkoutRestaurantId, setCheckoutRestaurantId] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [previewNotification, setPreviewNotification] = useState<string | null>(null);

  // Product modal state
  const [selectedProductForModal, setSelectedProductForModal] = useState<MenuItem | null>(null);

  // Notification preferences modal state
  const [isNotificationPreferencesOpen, setIsNotificationPreferencesOpen] = useState(false);

  // Local favorites state
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState<string[]>(['rest_اصيل']);
  const [favoriteFoodIds, setFavoriteFoodIds] = useState<string[]>(['food_1', 'food_3']);

  // Local simulated multi-restaurant cart state (React state only, strictly 0 Supabase writes)
  const [localCart, setLocalCart] = useState<FoodCartItem[]>([
    // Seed initial cart with items from two restaurants to immediately demonstrate multi-restaurant cart
    {
      cartItemId: 'seed_cart_1',
      menuItemId: 'food_1',
      restaurantId: 'rest_اصيل',
      restaurantName: 'كبابجي ومطعم الأصيل',
      name: 'نصف كيلو كباب وكفتة مشوي على الفحم',
      basePrice: 340,
      unitPrice: 340,
      quantity: 1,
      selectedOptions: [],
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
    },
    {
      cartItemId: 'seed_cart_2',
      menuItemId: 'food_3',
      restaurantId: 'rest_روما',
      restaurantName: 'بيتزا وباستا فينيسيا',
      name: 'بيتزا رانش دجاج إيطالية كرانشي',
      basePrice: 195,
      unitPrice: 195,
      quantity: 1,
      selectedOptions: [],
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
    },
  ]);

  const [localOrders, setLocalOrders] = useState<FoodOrder[]>(PREVIEW_ORDERS);

  // Determine whether preview mode is active
  const isPreview = forcePreviewMode || propRestaurants.length === 0;

  // Active datasets
  const activeRestaurants = isPreview ? PREVIEW_RESTAURANTS : propRestaurants;
  const activeFoods = isPreview ? PREVIEW_FOODS : propFoods;
  const activeCategories = isPreview ? PREVIEW_CATEGORIES : propCategories;
  const activeAddresses = isPreview ? PREVIEW_SAVED_ADDRESSES : propAddresses;
  const activeCartItems = isPreview ? localCart : (propCartItems || []);
  const activeOrders = isPreview ? localOrders : propOrders;

  // Show a temporary preview toast banner
  const triggerPreviewAlert = (msg: string) => {
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
          deliveryFee: rest?.deliveryFee ?? 15,
          total: 0,
          isOpen: rest?.isOpen ?? true,
          nextOpeningTime: rest?.nextOpeningTime || 'اليوم الساعة 01:00 ظهراً',
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

  // Selected restaurant foods for detail view
  const selectedRestaurantFoods = useMemo(() => {
    if (!selectedRestaurantId) return [];
    return activeFoods.filter((f) => f.restaurantId === selectedRestaurantId);
  }, [activeFoods, selectedRestaurantId]);

  // Items designated for Checkout (filtered to the selected checkout restaurant)
  const checkoutGroup = useMemo(() => {
    if (!checkoutRestaurantId) {
      return restaurantGroups[0] || null;
    }
    return restaurantGroups.find((g) => g.restaurantId === checkoutRestaurantId) || null;
  }, [restaurantGroups, checkoutRestaurantId]);

  // Toggle favorite restaurant
  const handleToggleFavoriteRestaurant = (restaurantId: string) => {
    setFavoriteRestaurantIds((prev) => {
      const exists = prev.includes(restaurantId);
      const updated = exists ? prev.filter((id) => id !== restaurantId) : [...prev, restaurantId];
      const rest = activeRestaurants.find((r) => r.id === restaurantId);
      triggerPreviewAlert(
        exists
          ? `تمت إزالة "${rest?.name || 'المطعم'}" من المفضلة`
          : `❤️ تم حفظ "${rest?.name || 'المطعم'}" في المفضلة`
      );
      return updated;
    });
  };

  // Toggle favorite food
  const handleToggleFavoriteFood = (foodId: string) => {
    setFavoriteFoodIds((prev) => {
      const exists = prev.includes(foodId);
      const updated = exists ? prev.filter((id) => id !== foodId) : [...prev, foodId];
      const food = activeFoods.find((f) => f.id === foodId);
      triggerPreviewAlert(
        exists
          ? `تمت إزالة "${food?.name || 'الطبق'}" من المفضلة`
          : `❤️ تم حفظ "${food?.name || 'الطبق'}" في المفضلة`
      );
      return updated;
    });
  };

  // Add item without modal (standard add button)
  const handleAddToCart = (item: MenuItem) => {
    if (!item.isAvailable) {
      triggerPreviewAlert(`⚠️ الصنف "${item.name}" غير متوفر حالياً بالمطعم.`);
      return;
    }

    // If item has options, open modal for customization
    if (item.optionGroups && item.optionGroups.length > 0) {
      setSelectedProductForModal(item);
      return;
    }

    if (isPreview) {
      setLocalCart((prev) => {
        const existingIdx = prev.findIndex(
          (c) => c.menuItemId === item.id && c.selectedOptions.length === 0
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx].quantity += 1;
          return updated;
        } else {
          const newCartItem: FoodCartItem = {
            cartItemId: `cart_${item.id}_${Date.now()}`,
            menuItemId: item.id,
            restaurantId: item.restaurantId,
            restaurantName: item.restaurantName,
            name: item.name,
            basePrice: item.price,
            unitPrice: item.price,
            quantity: 1,
            selectedOptions: [],
            imageUrl: item.imageUrl,
            isAvailable: true,
          };
          return [...prev, newCartItem];
        }
      });
      triggerPreviewAlert(`تمت إضافة "${item.name}" إلى السلة`);
    } else if (propOnAddToCart) {
      propOnAddToCart(item);
    }
  };

  // Add configured item with options from modal
  const handleAddToCartWithOptions = (
    item: MenuItem,
    selectedOptions: FoodCartSelectedOption[],
    quantity: number,
    notes?: string
  ) => {
    if (!item.isAvailable) {
      triggerPreviewAlert(`⚠️ الصنف "${item.name}" غير متوفر حالياً بالمطعم.`);
      return;
    }

    let extraCost = 0;
    selectedOptions.forEach((o) => {
      extraCost += o.price || 0;
    });
    const unitPrice = item.price + extraCost;

    const newCartItem: FoodCartItem = {
      cartItemId: `cart_${item.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      menuItemId: item.id,
      restaurantId: item.restaurantId,
      restaurantName: item.restaurantName,
      name: item.name,
      basePrice: item.price,
      unitPrice: unitPrice,
      quantity: quantity,
      selectedOptions: selectedOptions,
      notes: notes,
      imageUrl: item.imageUrl,
      isAvailable: true,
    };

    setLocalCart((prev) => [...prev, newCartItem]);
    triggerPreviewAlert(`تمت إضافة ${quantity} × "${item.name}" بالخيارات المحددة للسلة`);
  };

  // Remove one quantity or item from cart
  const handleRemoveFromCart = (item: MenuItem) => {
    if (isPreview) {
      setLocalCart((prev) => {
        const existingIdx = prev.findIndex((c) => c.menuItemId === item.id);
        if (existingIdx < 0) return prev;
        const updated = [...prev];
        if (updated[existingIdx].quantity > 1) {
          updated[existingIdx].quantity -= 1;
          return updated;
        } else {
          return updated.filter((_, i) => i !== existingIdx);
        }
      });
    } else if (propOnRemoveFromCart) {
      propOnRemoveFromCart(item);
    }
  };

  // Update specific cartItem quantity
  const handleUpdateCartQuantity = (cartItemId: string, newQuantity: number) => {
    if (isPreview) {
      setLocalCart((prev) => {
        if (newQuantity <= 0) {
          return prev.filter((i) => i.cartItemId !== cartItemId);
        }
        return prev.map((i) =>
          i.cartItemId === cartItemId ? { ...i, quantity: newQuantity } : i
        );
      });
    } else if (propOnUpdateCartQuantity) {
      propOnUpdateCartQuantity(cartItemId, newQuantity);
    }
  };

  // Clear entire cart
  const handleClearCart = () => {
    if (isPreview) {
      setLocalCart([]);
      triggerPreviewAlert('تم إفراغ السلة بالكامل');
    } else if (propOnClearCart) {
      propOnClearCart();
    }
  };

  // Initiate single-restaurant checkout
  const handleProceedToCheckoutRestaurant = (restaurantId: string) => {
    const group = restaurantGroups.find((g) => g.restaurantId === restaurantId);
    if (!group) return;

    if (!group.isOpen) {
      triggerPreviewAlert(
        `🔒 المطعم "${group.restaurantName}" مغلق حالياً (${group.nextOpeningTime || 'يفتح لاحقاً'}). لا يمكن إتمام الطلب الآن.`
      );
      return;
    }

    setCheckoutRestaurantId(restaurantId);
    setCurrentView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Order Submission: ONLY removes items of the submitted restaurant!
  // Leaves items of all other restaurants safely in the cart!
  const handleOrderSubmit = async (details: {
    customerName: string;
    customerPhone: string;
    address: string;
    notes?: string;
    discount?: number;
  }) => {
    if (!checkoutGroup) return;

    setIsSubmittingOrder(true);
    try {
      if (isPreview) {
        await new Promise((resolve) => setTimeout(resolve, 600)); // Smooth UX simulation

        const targetRest = checkoutGroup.restaurant;
        const discountAmount = details.discount || 0;
        const finalAmount = Math.max(0, checkoutGroup.subtotal - discountAmount + checkoutGroup.deliveryFee);

        const simulatedOrder: FoodOrder = {
          id: `ord_sim_${Date.now()}`,
          invoiceNumber: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
          restaurantId: checkoutGroup.restaurantId,
          restaurantName: checkoutGroup.restaurantName,
          restaurantPhone: targetRest?.phone || '01012345678',
          restaurantAddress: targetRest?.address || 'القاهرة',
          customerName: details.customerName,
          customerPhone: details.customerPhone,
          address: {
            id: 'addr_temp',
            label: 'عنوان التوصيل',
            recipientName: details.customerName,
            phone: details.customerPhone,
            governorate: 'القاهرة',
            markaz: 'المعادي',
            detailedAddress: details.address,
            latitude: 30.05,
            longitude: 31.34,
          },
          items: checkoutGroup.items.map((c) => ({
            menuItemId: c.menuItemId,
            name: c.name,
            unitPrice: c.unitPrice,
            quantity: c.quantity,
            totalPrice: c.unitPrice * c.quantity,
            selectedOptionsDescription: c.selectedOptions
              .map((o) => `${o.optionName} (+${o.price}ج)`)
              .join(' • '),
          })),
          subtotal: checkoutGroup.subtotal,
          discount: discountAmount,
          deliveryFee: checkoutGroup.deliveryFee,
          totalAmount: finalAmount,
          orderStatus: 'pending_restaurant_confirmation',
          deliveryStatus: 'waiting_dispatch',
          paymentMethod: 'cash_on_delivery',
          deliveryChannel: 'direct_system',
          invoiceIssued: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDeliveryTime: '30-40 دقيقة',
        };

        // 1. Add order to localOrders
        setLocalOrders((prev) => [simulatedOrder, ...prev]);

        // 2. Remove ONLY items belonging to this ordered restaurant from localCart
        // Products of all other restaurants REMAIN IN THE CART!
        setLocalCart((prev) => prev.filter((i) => i.restaurantId !== checkoutGroup.restaurantId));

        // 3. Reset checkout restaurant target
        setCheckoutRestaurantId(null);

        triggerPreviewAlert(
          `🚀 تم تأكيد طلب "${checkoutGroup.restaurantName}" بنجاح! احتفظنا بمنتجات المطاعم الأخرى في سلتك.`
        );

        // 4. Navigate to orders view to track order progress
        setCurrentView('orders');
      } else if (propOnSubmitOrder) {
        const res = await propOnSubmitOrder(details);
        if (res && res.success) {
          setCurrentView('orders');
        }
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Submit Star Ratings (Strictly Stars, No Text Comments)
  const handleRatingSubmit = async (payload: BiteBaitRatingPayload) => {
    if (isPreview) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      setLocalOrders((prev) =>
        prev.map((o) =>
          o.id === payload.orderId
            ? {
                ...o,
                restaurantRating: payload.restaurantRating,
                driverRating: payload.driverRating,
              }
            : o
        )
      );
      triggerPreviewAlert(
        `⭐ تم تسجيل تقييم ${payload.restaurantRating} نجوم للمطعم و ${payload.driverRating} نجوم لمندوب التوصيل بنجاح!`
      );
    } else if (propOnSubmitRating) {
      await propOnSubmitRating(payload);
    }
  };

  // Cancel order in local state
  const handleCancelOrder = (orderId: string, reason: string) => {
    setLocalOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              orderStatus: 'cancelled',
              cancelReason: reason,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );
    triggerPreviewAlert(`تم تسجيل طلب إلغاء الطلب بنجاح محلياً.`);
  };

  // If section is administratively disabled
  if (isSectionDisabled) {
    return (
      <div className="bite-and-bait-scope">
        <div style={{ padding: '20px 0' }}>
          <BiteBaitEmptyState
            icon="🔒"
            title="قسم بايت آند بيت غير متاح حالياً"
            description={disabledMessage}
            actionLabel="العودة لأقسام البيت 🏠"
            onAction={onBackToAppHome}
          />
        </div>
      </div>
    );
  }

  // Handle internal navigation between section views
  const handleNavigateView = (view: BiteBaitView, meta?: { restaurantId?: string }) => {
    if (meta?.restaurantId) {
      setSelectedRestaurantId(meta.restaurantId);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bite-and-bait-scope" style={{ position: 'relative', minHeight: '600px' }}>
      {/* Prominent Preview Mode Badge */}
      {isPreview && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
            border: '1.5px solid #f59e0b',
            borderRadius: '16px',
            padding: '10px 16px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 10px rgba(245, 158, 11, 0.12)',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🧪</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400e' }}>
                وضع المعاينة البصرية والتجريبية (Bite & Bait Preview Mode)
              </div>
              <div style={{ fontSize: '11px', color: '#b45309' }}>
                جميع الوظائف، السلة متعددة المطاعم، الفلاتر والتقييم تعمل محلياً بالكامل (React State) دون أي اتصال كتابي بقاعدة بيانات Supabase.
              </div>
            </div>
          </div>

          <span
            style={{
              background: '#f59e0b',
              color: '#0f172a',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '50px',
            }}
          >
            المرحلة 1: الوظائف المحلية الكاملة
          </span>
        </div>
      )}

      {/* Floating Preview Feedback Toast */}
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
            onClick={() => handleNavigateView('offers')}
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
            onClick={() => handleNavigateView('orders')}
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

      {/* Render Active View */}
      {currentView === 'home' && (
        <BiteBaitHomeView
          restaurants={activeRestaurants}
          featuredFoods={activeFoods}
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
            defaultCustomerName={defaultCustomerName}
            defaultCustomerPhone={defaultCustomerPhone}
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
        <BiteBaitOrdersView
          orders={activeOrders}
          onNavigateToHome={() => setCurrentView('home')}
          onSubmitRating={handleRatingSubmit}
          onCancelOrder={handleCancelOrder}
        />
      )}

      {currentView === 'favorites' && (
        <BiteBaitFavoritesView
          favoriteRestaurants={activeRestaurants.filter((r) =>
            favoriteRestaurantIds.includes(r.id)
          )}
          favoriteFoods={activeFoods.filter((f) => favoriteFoodIds.includes(f.id))}
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
          foods={activeFoods}
          cartQuantities={cartQuantities}
          favoriteFoodIds={favoriteFoodIds}
          onNavigateView={handleNavigateView}
          onAddToCart={handleAddToCart}
          onRemoveFromCart={handleRemoveFromCart}
          onOpenDetails={(item) => setSelectedProductForModal(item)}
          onToggleFavoriteFood={handleToggleFavoriteFood}
        />
      )}

      {/* Product Details Modal with Options, Sizes & Addons */}
      {selectedProductForModal && (
        <BiteBaitProductModal
          item={selectedProductForModal}
          isOpen={Boolean(selectedProductForModal)}
          onClose={() => setSelectedProductForModal(null)}
          onAddToCart={handleAddToCartWithOptions}
        />
      )}

      {/* Offer Notification Preferences Modal (Local Simulation) */}
      <BiteBaitNotificationPreferencesModal
        isOpen={isNotificationPreferencesOpen}
        onClose={() => setIsNotificationPreferencesOpen(false)}
        onSave={() => {
          triggerPreviewAlert('✓ تم حفظ تفضيلات إشعارات العروض بنجاح محلياً!');
        }}
      />
    </div>
  );
};

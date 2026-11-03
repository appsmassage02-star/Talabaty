import React, { useState, useMemo } from 'react';
import type {
  Restaurant,
  MenuItem,
  RestaurantCategory,
  FoodCartItem,
  FoodOrder,
  FoodCustomerAddress,
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
import { BiteBaitCartView } from './views/BiteBaitCartView';
import { BiteBaitCheckoutView } from './views/BiteBaitCheckoutView';
import { BiteBaitOrdersView } from './views/BiteBaitOrdersView';
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
  forcePreviewMode = true, // Enabled for Stage 5 visual preview
}) => {
  const [currentView, setCurrentView] = useState<BiteBaitView>('home');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [previewNotification, setPreviewNotification] = useState<string | null>(null);

  // Local simulated cart state for visual preview testing without DB writes
  const [localCart, setLocalCart] = useState<FoodCartItem[]>([]);
  const [localOrders, setLocalOrders] = useState<FoodOrder[]>(PREVIEW_ORDERS);

  // Determine whether preview mode is active
  const isPreview = forcePreviewMode || propRestaurants.length === 0;

  // Resolved datasets
  const activeRestaurants = isPreview ? PREVIEW_RESTAURANTS : propRestaurants;
  const activeFoods = isPreview ? PREVIEW_FOODS : propFoods;
  const activeCategories = isPreview ? PREVIEW_CATEGORIES : propCategories;
  const activeAddresses = isPreview ? PREVIEW_SAVED_ADDRESSES : propAddresses;
  const activeCartItems = isPreview ? localCart : (propCartItems || []);
  const activeOrders = isPreview ? localOrders : propOrders;

  // Cart totals
  const cartSubtotal = useMemo(() => {
    return activeCartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  }, [activeCartItems]);

  const cartTotalItemsCount = useMemo(() => {
    return activeCartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [activeCartItems]);

  const selectedRestaurant = useMemo(() => {
    return activeRestaurants.find((r) => r.id === selectedRestaurantId) || null;
  }, [activeRestaurants, selectedRestaurantId]);

  const deliveryFee = selectedRestaurant?.deliveryFee || (activeCartItems.length > 0 ? 15 : 0);
  const cartTotalPrice = cartSubtotal + (activeCartItems.length > 0 ? deliveryFee : 0);

  // Fast map lookup for item quantities in cart
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    activeCartItems.forEach((item) => {
      map[item.menuItemId] = (map[item.menuItemId] || 0) + item.quantity;
    });
    return map;
  }, [activeCartItems]);

  // Selected restaurant menu items
  const selectedRestaurantFoods = useMemo(() => {
    if (!selectedRestaurantId) return [];
    return activeFoods.filter((f) => f.restaurantId === selectedRestaurantId);
  }, [activeFoods, selectedRestaurantId]);

  // Show a temporary preview toast banner
  const triggerPreviewAlert = (msg: string) => {
    setPreviewNotification(msg);
    setTimeout(() => {
      setPreviewNotification(null);
    }, 4500);
  };

  // Preview-safe cart handlers
  const handleAddToCart = (item: MenuItem) => {
    if (isPreview) {
      setLocalCart((prev) => {
        const existingIdx = prev.findIndex((c) => c.menuItemId === item.id);
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
      triggerPreviewAlert(`تمت إضافة "${item.name}" للسلة التجريبية`);
    } else if (propOnAddToCart) {
      propOnAddToCart(item);
    }
  };

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

  const handleClearCart = () => {
    if (isPreview) {
      setLocalCart([]);
      triggerPreviewAlert('تم إفراغ السلة التجريبية');
    } else if (propOnClearCart) {
      propOnClearCart();
    }
  };

  // Preview-safe order submission
  const handleOrderSubmit = async (details: {
    customerName: string;
    customerPhone: string;
    address: string;
    notes?: string;
  }) => {
    setIsSubmittingOrder(true);
    try {
      if (isPreview) {
        // Strict guard: Do NOT send to Supabase or execute network calls
        await new Promise((resolve) => setTimeout(resolve, 800)); // Smooth UX simulation
        const simulatedOrder: FoodOrder = {
          id: `ord_sim_${Date.now()}`,
          restaurantId: selectedRestaurantId || 'rest_اصيل',
          restaurantName: selectedRestaurant?.name || 'مطعم معتمد (تجريبي)',
          restaurantPhone: selectedRestaurant?.phone || '01012345678',
          restaurantAddress: selectedRestaurant?.address || 'القاهرة',
          customerName: details.customerName,
          customerPhone: details.customerPhone,
          address: {
            id: 'addr_temp',
            label: 'العنوان المحدد',
            recipientName: details.customerName,
            phone: details.customerPhone,
            governorate: 'القاهرة',
            markaz: 'المعادي',
            detailedAddress: details.address,
            latitude: 30.05,
            longitude: 31.34,
          },
          items: activeCartItems.map((c) => ({
            menuItemId: c.menuItemId,
            name: c.name,
            unitPrice: c.unitPrice,
            quantity: c.quantity,
            totalPrice: c.unitPrice * c.quantity,
          })),
          subtotal: cartSubtotal,
          discount: 0,
          deliveryFee: deliveryFee,
          totalAmount: cartTotalPrice,
          orderStatus: 'pending_restaurant_confirmation',
          deliveryStatus: 'waiting_dispatch',
          paymentMethod: 'cash_on_delivery',
          deliveryChannel: 'direct_system',
          invoiceIssued: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDeliveryTime: '30 دقيقة',
        };

        setLocalOrders((prev) => [simulatedOrder, ...prev]);
        setLocalCart([]);
        triggerPreviewAlert(
          '🔍 [وضع المعاينة]: تم اختبار مراجعة وتأكيد بيانات الطلب بنجاح! تم منع الإرسال الحقيقي إلى قاعدة البيانات.'
        );
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

  const handleRatingSubmit = async (payload: BiteBaitRatingPayload) => {
    if (isPreview) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      triggerPreviewAlert(
        `⭐ [وضع المعاينة]: تم تسجيل تقييم ${payload.rating} نجوم بنجاح دون الكتابة في قاعدة البيانات.`
      );
    } else if (propOnSubmitRating) {
      await propOnSubmitRating(payload);
    }
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
                يمكنك تجربة كافة الشاشات، الفلاتر، والسلة بأمان تام. لا يتم إرسال طلبات حقيقية أو الكتابة في Supabase.
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
            المرحلة 5: فحص الواجهات
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
            padding: '12px 20px',
            borderRadius: '14px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            border: '1.5px solid #f59e0b',
            fontSize: '12.5px',
            fontWeight: 700,
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

          <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
            🍔 بايت آند بيت (Bite & Bait)
          </span>
        </div>

        {/* View Shortcuts: Restaurants, Cart & Orders */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              border: '1px solid #f59e0b',
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
          cartTotal={cartTotalPrice}
          cartQuantities={cartQuantities}
          onNavigateView={handleNavigateView}
          onAddToCart={handleAddToCart}
          onRemoveFromCart={handleRemoveFromCart}
          onSelectRestaurant={(r) => {
            setSelectedRestaurantId(r.id);
            setCurrentView('restaurant');
          }}
        />
      )}

      {currentView === 'restaurants' && (
        <BiteBaitRestaurantsView
          restaurants={activeRestaurants}
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
            cartTotal={cartTotalPrice}
            cartQuantities={cartQuantities}
            onNavigateBack={() => setCurrentView('home')}
            onOpenCart={() => setCurrentView('cart')}
            onAddToCart={handleAddToCart}
            onRemoveFromCart={handleRemoveFromCart}
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
          subtotal={cartSubtotal}
          deliveryFee={deliveryFee}
          totalPrice={cartTotalPrice}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={(id) => handleUpdateCartQuantity(id, 0)}
          onClearCart={handleClearCart}
          onProceedToCheckout={() => setCurrentView('checkout')}
          onContinueShopping={() => setCurrentView('home')}
        />
      )}

      {currentView === 'checkout' && (
        <BiteBaitCheckoutView
          cartItems={activeCartItems}
          subtotal={cartSubtotal}
          deliveryFee={deliveryFee}
          totalPrice={cartTotalPrice}
          restaurantName={selectedRestaurant?.name || 'كبابجي ومطعم الأصيل (معاينة)'}
          savedAddresses={activeAddresses}
          defaultCustomerName={defaultCustomerName}
          defaultCustomerPhone={defaultCustomerPhone}
          onSubmitOrder={handleOrderSubmit}
          onNavigateBackToCart={() => setCurrentView('cart')}
          isSubmitting={isSubmittingOrder}
        />
      )}

      {currentView === 'orders' && (
        <BiteBaitOrdersView
          orders={activeOrders}
          onNavigateToHome={() => setCurrentView('home')}
          onSubmitRating={handleRatingSubmit}
        />
      )}
    </div>
  );
};

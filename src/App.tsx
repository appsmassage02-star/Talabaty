import React from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { Header } from "./components/Header";
import { CategoryGridView } from "./components/CategoryGridView";
import { MissingItemsView } from "./components/MissingItemsView";
import { PurchasesView } from "./components/PurchasesView";
import { BudgetView } from "./components/BudgetView";
import { SettingsView } from "./components/SettingsView";
import { InvoicesArchiveView } from "./components/InvoicesArchiveView";
import { QrCodeModal } from "./components/QrCodeModal";
import { CategoryProductsView } from "./components/CategoryProductsView";
import { AddInvoiceModal } from "./components/AddInvoiceModal";
import { SmartAiModal } from "./components/SmartAiModal";
import { NotificationsModal } from "./components/NotificationsModal";
import { SupabaseAuthModal } from "./components/SupabaseAuthModal";
import { EndMonthModal } from "./components/EndMonthModal";
import { OfflineNotificationToast } from "./components/OfflineNotificationToast";
import { AboutAppModal } from "./components/AboutAppModal";
import { AuthView } from "./components/AuthView";
import { ProfileView } from "./components/ProfileView";
import { AdminNotificationBanner } from "./components/AdminNotificationBanner";
import { RecurringOrdersModal } from "./components/RecurringOrdersModal";
import { GovernorateSettingsModal } from "./components/GovernorateSettingsModal";
import { AdminNotificationManagerModal } from "./components/AdminNotificationManagerModal";
import { PharmacySection } from "./components/pharmacy/PharmacySection";
import { FoodSection } from "./food/components/FoodSection";

import {
  LayoutGrid,
  ClipboardList,
  Receipt,
  PieChart,
  Settings,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  WifiOff,
} from "lucide-react";

const MainContent: React.FC = () => {
  const {
    authStatus,
    authError,
    isAuthLoading,
    isAuthenticated,
    signOutSupabase,
    activeTab,
    setActiveTab,
    activeRole,
    selectedCategory,
    setSelectedCategory,
    missingItems,
    homePermissions,
    isOnline,
    setIsAiModalOpen,
    isNotificationsModalOpen,
    setIsNotificationsModalOpen,
    isSupabaseAuthModalOpen,
    setIsSupabaseAuthModalOpen,
    isEndMonthModalOpen,
    setIsEndMonthModalOpen,
  } = useApp();

  // 1. Error state handling
  if (authStatus === "ERROR") {
    return (
      <div
        className="min-h-screen bg-[#F6F8FA] flex flex-col items-center justify-center font-sans text-slate-900 px-4"
        dir="rtl"
      >
        <div className="w-full max-w-md bg-white p-6 rounded-2xl border border-rose-200 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-900">تعذر استكمال المصادقة</h2>
            <p className="text-xs text-rose-700 leading-relaxed font-medium">
              {authError || "حدث خطأ غير متوقع أثناء إعداد وتوثيق بيانات المستخدم والمنزل."}
            </p>
          </div>
          <button
            onClick={() => signOutSupabase()}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            العودة لصفحة تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  // 2. Sequential auth stage loading state
  if (isAuthLoading) {
    const loadingMessage =
      authStatus === "SESSION"
        ? "جاري التحقق من جلسة المستخدم..."
        : authStatus === "PROFILE"
        ? "جاري تحميل الملف الشخصي..."
        : authStatus === "HOUSEHOLD"
        ? "جاري إعداد وربط بيانات المنزل..."
        : authStatus === "PERMISSIONS"
        ? "جاري تحميل الصلاحيات والبيانات..."
        : "جاري تهيئة التطبيق الآمن...";

    return (
      <div
        className="min-h-screen bg-[#F6F8FA] flex flex-col items-center justify-center font-sans text-slate-900"
        dir="rtl"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="text-center space-y-1.5">
            <h2 className="text-base font-bold text-slate-800">طلبات البيت</h2>
            <p className="text-xs text-slate-500 font-medium">{loadingMessage}</p>
          </div>
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const activeMissingCount = missingItems.filter((i) => !i.completed).length;

  // 2. If not authenticated, force AuthView (Login / Register)
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen bg-[#F6F8FA] flex flex-col font-sans text-slate-900 selection:bg-emerald-600 selection:text-white"
        dir="rtl"
      >
        <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-6 sm:py-10">
          <AuthView />
        </main>
        <OfflineNotificationToast />
      </div>
    );
  }

  // Determine allowed tabs based on role and permissions
  const isTabVisible = (
    tab: "categories" | "missing" | "purchases" | "budget" | "settings"
  ) => {
    if (activeRole === "admin") return true;
    if (tab === "settings") return false; // Settings is strictly Admin
    return homePermissions.allowedScreens[tab];
  };

  const isAiAllowed =
    activeRole === "admin" || homePermissions.canUseAiAssistant;

  return (
    <div
      className="min-h-screen bg-[#F6F8FA] flex flex-col font-sans text-slate-900 selection:bg-emerald-600 selection:text-white"
      dir="rtl"
    >
      {/* Global Admin Announcement Banners & Modals */}
      <AdminNotificationBanner />

      {/* Top Native App Header */}
      <Header />

      {/* Main Fullscreen Responsive Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-4 pb-28">
        {activeTab === "profile" ? (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setActiveTab("categories");
                }}
                className="flex items-center space-x-1.5 space-x-reverse text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة للرئيسية</span>
              </button>
            </div>
            <ProfileView />
          </div>
        ) : activeTab === "auth" ? (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setActiveTab("categories");
                }}
                className="flex items-center space-x-1.5 space-x-reverse text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة للرئيسية</span>
              </button>
            </div>
            <ProfileView />
          </div>
        ) : activeTab === "archive" ? (
          <div className="space-y-4 animate-in fade-in duration-150">
            <InvoicesArchiveView />
          </div>
        ) : activeTab === "pharmacy" ? (
          <div className="space-y-4 animate-in fade-in duration-150">
            <PharmacySection
              onBackToHome={() => {
                setSelectedCategory(null);
                setActiveTab("categories");
              }}
            />
          </div>
        ) : activeTab === "food" ? (
          <div className="space-y-4 animate-in fade-in duration-150">
            <FoodSection
              onBackToHome={() => {
                setSelectedCategory(null);
                setActiveTab("categories");
              }}
            />
          </div>
        ) : activeTab === "settings" ? (
          activeRole === "admin" ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              <SettingsView />
            </div>
          ) : (
            <div className="py-16 text-center space-y-3 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                صفحة الإعدادات خاصة بالمسؤول فقط
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                يرجى تسجيل الدخول كمسؤول (الأب / الأم) للوصول للإعدادات والصلاحيات.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setActiveTab("categories");
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors"
              >
                العودة للأقسام
              </button>
            </div>
          )
        ) : activeTab === "budget" ? (
          isTabVisible("budget") ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              <BudgetView />
            </div>
          ) : (
            <div className="py-16 text-center space-y-3 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                شاشة الميزانية مقيدة من قِبل المسؤول
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                تم حجب تفاصيل الميزانية عن هاتف المنزل للحفاظ على الخصوصية.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setActiveTab("categories");
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                العودة للأقسام
              </button>
            </div>
          )
        ) : activeTab === "purchases" ? (
          isTabVisible("purchases") ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              <PurchasesView />
            </div>
          ) : (
            <div className="py-16 text-center space-y-3 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                شاشة المشتريات مقيدة من قِبل المسؤول
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                تم حجب سجل المشتريات عن هاتف المنزل للحفاظ على الخصوصية.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setActiveTab("categories");
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                العودة للأقسام
              </button>
            </div>
          )
        ) : activeTab === "missing" ? (
          isTabVisible("missing") ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              <MissingItemsView />
            </div>
          ) : (
            <div className="py-16 text-center space-y-3 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                شاشة النواقص مقيدة
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                تم تقييد الوصول لقائمة النواقص.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setActiveTab("categories");
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                العودة للأقسام
              </button>
            </div>
          )
        ) : (
          /* Default: Categories Grid or Category Products Full Page */
          <div className="space-y-4 animate-in fade-in duration-150">
            {selectedCategory ? (
              <CategoryProductsView />
            ) : (
              <CategoryGridView />
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) for Gemini AI */}
      {isAiAllowed && (
        <div className="fixed bottom-18 left-4 sm:left-6 z-30 pointer-events-none">
          <button
            id="btn-fab-gemini-main"
            onClick={() => setIsAiModalOpen(true)}
            className={`pointer-events-auto flex items-center space-x-1.5 space-x-reverse px-4 py-2.5 rounded-full font-bold text-xs shadow-lg transition-all border-2 border-white cursor-pointer ${
              isOnline
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/30 hover:scale-105 active:scale-95"
                : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30 hover:scale-102 opacity-95"
            }`}
            title={
              isOnline
                ? "إضافة طلب أو نقص بالصوت أو النص عبر الذكاء الاصطناعي (Gemini)"
                : "وضع عدم الاتصال: المساعد الذكي معطل مؤقتاً لتجنب ضياع البيانات (انقر لعرض البدائل)"
            }
          >
            {isOnline ? (
              <>
                <Sparkles className="w-4 h-4 text-emerald-100" />
                <span>طلب ذكي (Gemini)</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-200" />
                <span>Gemini (Offline)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Native Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-1.5 px-2 z-40 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-around text-slate-500">
          {/* 1. Categories */}
          {isTabVisible("categories") && (
            <button
              id="nav-tab-categories"
              onClick={() => {
                setSelectedCategory(null);
                setActiveTab("categories");
              }}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "categories"
                  ? "text-emerald-700 font-black scale-105"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-bold">الأقسام</span>
            </button>
          )}

          {/* 2. Missing Items */}
          {isTabVisible("missing") && (
            <button
              id="nav-tab-missing"
              onClick={() => {
                setSelectedCategory(null);
                setActiveTab("missing");
              }}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all relative cursor-pointer ${
                activeTab === "missing"
                  ? "text-emerald-700 font-black scale-105"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <div className="relative">
                <ClipboardList className="w-5 h-5" />
                {activeMissingCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {activeMissingCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-bold">النواقص</span>
            </button>
          )}

          {/* 3. Purchases */}
          {isTabVisible("purchases") && (
            <button
              id="nav-tab-purchases"
              onClick={() => {
                setSelectedCategory(null);
                setActiveTab("purchases");
              }}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "purchases" || activeTab === "archive"
                  ? "text-emerald-700 font-black scale-105"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-bold">المشتريات</span>
            </button>
          )}

          {/* 4. Budget */}
          {isTabVisible("budget") && (
            <button
              id="nav-tab-budget"
              onClick={() => {
                setSelectedCategory(null);
                setActiveTab("budget");
              }}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "budget"
                  ? "text-emerald-700 font-black scale-105"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <PieChart className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-bold">الميزانية</span>
            </button>
          )}

          {/* 5. Settings (Admin only) */}
          {activeRole === "admin" && (
            <button
              id="nav-tab-settings"
              onClick={() => {
                setSelectedCategory(null);
                setActiveTab("settings");
              }}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "settings"
                  ? "text-emerald-700 font-black scale-105"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-bold">الإعدادات</span>
            </button>
          )}
        </div>
      </nav>

      {/* Global Modals & System Alerts */}
      <OfflineNotificationToast />
      <AboutAppModal />
      <QrCodeModal />
      <AddInvoiceModal />
      <SmartAiModal />
      <EndMonthModal
        isOpen={isEndMonthModalOpen}
        onClose={() => setIsEndMonthModalOpen(false)}
      />
      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
      />
      <SupabaseAuthModal
        isOpen={isSupabaseAuthModalOpen}
        onClose={() => setIsSupabaseAuthModalOpen(false)}
      />
      <RecurringOrdersModal />
      <GovernorateSettingsModal />
      <AdminNotificationManagerModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

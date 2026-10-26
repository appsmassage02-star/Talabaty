import React, { useEffect, useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { usePharmacy } from "../lib/usePharmacy";
import { foodService } from "../food/services/foodService";
import { RestaurantSectionSettings, GeographicVerificationResult } from "../food/types/foodTypes";
import { CATEGORY_IMAGE_PRESETS } from "../data/categories";
import {
  ChevronLeft,
  Sparkles,
  Tag,
  Plus,
  Image as ImageIcon,
  Pill,
  FileText,
  Clock,
  Ban,
  Lock,
  AlertCircle,
  UtensilsCrossed,
} from "lucide-react";

export const CategoryGridView: React.FC = () => {
  const {
    categories,
    missingItems,
    setSelectedCategory,
    setActiveTab,
    activeRole,
    refreshActiveStateFromCache,
  } = useApp();

  const { serviceSettings, activeOrders } = usePharmacy();
  const [disabledNotice, setDisabledNotice] = useState<string | null>(null);
  const actionablePharmacyOrdersCount = activeOrders.length;

  // Food section settings & geographic scope
  const [foodSettings, setFoodSettings] = useState<RestaurantSectionSettings | null>(null);
  const [foodGeoScope, setFoodGeoScope] = useState<GeographicVerificationResult | null>(null);

  useEffect(() => {
    refreshActiveStateFromCache();
  }, [refreshActiveStateFromCache]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      foodService.getSectionSettings(),
      foodService.verifyGeographicScope(),
    ])
      .then(([settings, geoRes]) => {
        if (isMounted) {
          setFoodSettings(settings);
          setFoodGeoScope(geoRes);
        }
      })
      .catch((err) => {
        console.warn("[CategoryGridView] Error loading food section settings:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Count missing items per category
  const getMissingCount = (catId: string) => {
    return missingItems.filter(
      (item) =>
        (item.category === catId || (item as any).categoryId === catId) &&
        !item.completed
    ).length;
  };

  const totalActiveMissing = missingItems.filter((i) => !i.completed).length;

  // Resolve pharmacy category strictly from central global_categories (id = 'pharmacy')
  const pharmacyCategory = useMemo(() => {
    return categories.find((c) => c.id === "pharmacy");
  }, [categories]);

  // Single central source for pharmacy image: global_categories.image_url
  const pharmacyImageUrl = pharmacyCategory?.imageUrl || "";

  // Single central source for pharmacy name: global_categories.name_ar
  const pharmacyTitle = pharmacyCategory?.nameAr || "الصيدلية";

  const pharmacyStatus = serviceSettings.status; // "active" | "disabled" | "hidden"
  const isPharmacyDisabled = pharmacyStatus === "disabled";
  const isPharmacyHidden = pharmacyStatus === "hidden";
  const pharmacyDisplayWidth = serviceSettings.displayWidth; // "full" | "half" from pharmacy_settings.display_width

  // Food Section Operational & Visibility Rules:
  // 1. If section_visibility === 'hidden' -> completely hidden (null)
  // 2. Is section enabled globally AND geographically serviceable?
  const isFoodOperational = Boolean(foodSettings?.section_enabled) && Boolean(foodGeoScope?.isServiceable);
  const isFoodSectionHidden =
    foodSettings?.section_visibility === "hidden" ||
    (!isFoodOperational && foodSettings?.disabled_display_mode === "hide");
  const isFoodDisabledDisplay = !isFoodOperational && !isFoodSectionHidden;

  const handlePharmacyClick = () => {
    if (isPharmacyDisabled) {
      setDisabledNotice(
        "خدمة الصيدلية معطلة حالياً بقرار من الإدارة لأعمال الصيانة والتحديث."
      );
      setTimeout(() => setDisabledNotice(null), 3500);
      return;
    }
    setSelectedCategory(null);
    setActiveTab("pharmacy");
  };

  const handleFoodClick = () => {
    if (isFoodDisabledDisplay) {
      setDisabledNotice("قسم المطاعم معطل، سيتم التشغيل لاحقًا.");
      setTimeout(() => setDisabledNotice(null), 3500);
      return;
    }
    setSelectedCategory(null);
    setActiveTab("food");
  };

  return (
    <div className="space-y-4 text-right">
      {/* Disabled Notification Banner */}
      {disabledNotice && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center space-x-2 space-x-reverse">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{disabledNotice}</span>
          </div>
          <button
            onClick={() => setDisabledNotice(null)}
            className="text-amber-700 hover:text-amber-900 px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider block mb-0.5">
              {activeRole === "admin" ? "لوحة المسؤول" : "هاتف المنزل"}
            </span>
            <h2 className="text-lg sm:text-xl font-bold">أقسام ومستلزمات البيت</h2>
            <p className="text-xs text-emerald-100 mt-1 max-w-md">
              اختر القسم لتصفح المنتجات بالصور الحقيقية وإضافة النواقص بنقرة واحدة
            </p>
          </div>
          <div className="text-center bg-white/20 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20">
            <span className="text-2xl font-black block leading-none">
              {totalActiveMissing}
            </span>
            <span className="text-[10px] text-emerald-100 font-bold">
              نواقص مطلوبة
            </span>
          </div>
        </div>
      </div>

      {/* 1. Main Categories Grid (Pure regular categories without pharmacy) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
        {categories
          .filter(
            (c) =>
              c.isActive !== false &&
              Boolean(c.nameAr) &&
              c.id !== "pharmacy"
          )
          .map((category) => {
            const count = getMissingCount(category.id);
            const fallbackImg =
              "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80";
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className="group bg-white rounded-2xl border border-slate-200 text-right flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer relative"
              >
                {/* Category REAL Image Container */}
                <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                  <img
                    src={category.imageUrl || fallbackImg}
                    alt={category.nameAr}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (target.src !== fallbackImg) {
                        target.src = fallbackImg;
                      }
                    }}
                  />

                  {/* Subtle gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/25 to-transparent" />

                  {/* Missing Items Badge overlay */}
                  <div className="absolute top-2 right-2">
                    {count > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-sm flex items-center space-x-1 space-x-reverse border border-white/40">
                        <span>{count} ناقص</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600/90 text-white shadow-sm border border-white/30 backdrop-blur-xs">
                        متوفر
                      </span>
                    )}
                  </div>

                  {/* Category Title on image overlay */}
                  <div className="absolute inset-x-0 bottom-0 min-h-[46px] h-11 px-2.5 py-1 text-white flex items-center justify-center bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent">
                    <h3 className="font-bold text-xs sm:text-sm text-center leading-snug drop-shadow-md line-clamp-2 w-full">
                      {category.nameAr}
                    </h3>
                  </div>
                </div>

                {/* Bottom Details & Action */}
                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between bg-white">
                  <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
                    {category.description}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-bold">
                    <span>تصفح وإضافة</span>
                    <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      {/* Dedicated Ready-Food & Restaurants Section */}
      {!isFoodSectionHidden && (
        <div className="space-y-3 pt-2">
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t-2 border-slate-200/90 w-full" />
            <span className="bg-[#F6F8FA] px-3.5 py-0.5 text-xs font-bold text-slate-500 rounded-full border border-slate-200 shadow-2xs absolute">
              قسم الأكلات الجاهزة ومطاعم التوصيل
            </span>
          </div>

          <div className="w-full">
            <button
              onClick={handleFoodClick}
              className={`group w-full bg-white rounded-2xl border-2 text-right flex flex-col sm:flex-row sm:items-stretch justify-between overflow-hidden shadow-2xs transition-all relative ${
                isFoodDisabledDisplay
                  ? "grayscale contrast-90 opacity-80 border-slate-300 cursor-not-allowed"
                  : "border-emerald-500/80 hover:border-emerald-600 hover:shadow-md cursor-pointer"
              }`}
            >
              {/* Prominent Stamp for Disabled State: «معطل، سيتم التشغيل لاحقًا» */}
              {isFoodDisabledDisplay && (
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-20">
                  <span className="px-5 py-2 rounded-2xl text-xs sm:text-sm font-black bg-rose-600 text-white shadow-2xl border-2 border-white tracking-wider flex items-center space-x-2 space-x-reverse rotate-[-4deg] animate-pulse">
                    <Ban className="w-4 h-4 text-white ml-1.5" />
                    <span>معطل، سيتم التشغيل لاحقًا</span>
                  </span>
                </div>
              )}

              <div className="relative overflow-hidden bg-slate-900 sm:w-56 sm:h-auto h-32 shrink-0">
                <img
                  src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80"
                  alt="الأكلات الجاهزة"
                  className={`w-full h-full object-cover transition-transform duration-500 ${
                    isFoodDisabledDisplay
                      ? "grayscale opacity-75"
                      : "opacity-90 group-hover:scale-105"
                  }`}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/30 to-transparent" />

                <div className="absolute top-2 right-2">
                  {isFoodDisabledDisplay ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-100 shadow-sm flex items-center space-x-1 space-x-reverse border border-slate-600">
                      <Lock className="w-2.5 h-2.5 ml-0.5" />
                      <span>غير متاح</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-amber-950 shadow-sm flex items-center space-x-1 space-x-reverse border border-white/40">
                      <Sparkles className="w-2.5 h-2.5 ml-0.5" />
                      <span>توصيل سريع</span>
                    </span>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 min-h-[46px] h-11 px-2.5 py-1 text-white flex items-center justify-center bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent">
                  <h3 className="font-bold text-xs sm:text-sm text-center leading-snug drop-shadow-md line-clamp-2 w-full">
                    الأكلات الجاهزة ومطاعم البيت
                  </h3>
                </div>
              </div>

              <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between bg-white">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-0.5">
                    <div className="flex items-center space-x-1.5 space-x-reverse text-emerald-800">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" />
                      <span>مشويات، بيتزا، شاورما، كشري، أسماك وحلويات</span>
                    </div>
                    {isFoodDisabledDisplay ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                        معطل مؤقتاً
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        دفع عند الاستلام
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {isFoodDisabledDisplay
                      ? (foodSettings?.status_message ||
                         foodGeoScope?.reason ||
                         "قسم المطاعم معطل حالياً وسيتم التشغيل لاحقاً وفق التغطية الجغرافية المعتمدة.")
                      : "تصفح قوائم أفضل المطاعم القريبة منك، واختر وجباتك المفضلة مع الإضافات الخاصة، وتابع وصول طيار التوصيل خطوة بخطوة حتى باب منزلك."}
                  </p>
                </div>

                <div
                  className={`pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold ${
                    isFoodDisabledDisplay ? "text-slate-400" : "text-emerald-700"
                  }`}
                >
                  <span>
                    {isFoodDisabledDisplay
                      ? "معطل، سيتم التشغيل لاحقًا"
                      : "تصفح المطاعم وقوائم الطعام"}
                  </span>
                  <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 2. Clear Divider Line & 3. Dedicated Pharmacy Section (Requirement 1, 2, 3) */}
      {!isPharmacyHidden && (
        <div className="space-y-3 pt-3">
          {/* Distinct Divider Line */}
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t-2 border-slate-200/90 w-full" />
            <span className="bg-[#F6F8FA] px-3.5 py-0.5 text-xs font-bold text-slate-500 rounded-full border border-slate-200 shadow-2xs absolute">
              قسم الصيدلية والخدمات الطبية
            </span>
          </div>

          {/* Pharmacy Card Container (Full Width vs Half Width) */}
          <div
            className={
              pharmacyDisplayWidth === "half" ? "w-full sm:w-1/2" : "w-full"
            }
          >
            <button
              onClick={handlePharmacyClick}
              disabled={isPharmacyDisabled}
              className={`group w-full bg-white rounded-2xl border-2 text-right flex flex-col justify-between overflow-hidden shadow-2xs transition-all relative ${
                isPharmacyDisabled
                  ? "grayscale contrast-90 opacity-80 border-slate-300 cursor-not-allowed"
                  : "border-emerald-500/80 hover:shadow-md hover:border-emerald-600 cursor-pointer"
              } ${
                pharmacyDisplayWidth === "full"
                  ? "sm:flex-row sm:items-stretch"
                  : ""
              }`}
            >
              {/* Prominent Stamp for Disabled State (Requirement 3: معطل) */}
              {isPharmacyDisabled && (
                <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-20">
                  <span className="px-5 py-2 rounded-2xl text-sm sm:text-base font-black bg-rose-600 text-white shadow-2xl border-2 border-white tracking-wider flex items-center space-x-2 space-x-reverse rotate-[-6deg] animate-pulse">
                    <Ban className="w-5 h-5 text-white" />
                    <span>معطل</span>
                  </span>
                </div>
              )}

              {/* Pharmacy Image Container */}
              <div
                className={`relative overflow-hidden bg-emerald-950 ${
                  pharmacyDisplayWidth === "full"
                    ? "sm:w-56 sm:h-auto h-32 shrink-0"
                    : "h-28 w-full"
                }`}
              >
                {pharmacyImageUrl ? (
                  <img
                    src={pharmacyImageUrl}
                    alt={pharmacyTitle}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover transition-transform duration-500 ${
                      isPharmacyDisabled
                        ? "grayscale opacity-75"
                        : "opacity-90 group-hover:scale-105"
                    }`}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-emerald-200/90 p-4 bg-gradient-to-br from-emerald-900 to-teal-950">
                    <Pill className="w-8 h-8 mb-1 text-emerald-300" />
                    <span className="text-[11px] font-bold text-emerald-100">صيدلية ورعاية صحية</span>
                  </div>
                )}

                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-900/30 to-transparent" />

                {/* Badge overlay */}
                <div className="absolute top-2 right-2">
                  {isPharmacyDisabled ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-white shadow-sm flex items-center space-x-1 space-x-reverse border border-white/40">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>الخدمة معطلة</span>
                    </span>
                  ) : actionablePharmacyOrdersCount > 0 ? (
                    <span
                      id="badge-pharmacy-active-orders"
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-md flex items-center space-x-1 space-x-reverse border border-white/50 animate-pulse"
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>{actionablePharmacyOrdersCount} {actionablePharmacyOrdersCount === 1 ? "طلب جاري" : actionablePharmacyOrdersCount === 2 ? "طلبان جاريان" : "طلبات جارية"}</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600/90 text-white shadow-sm flex items-center space-x-1 space-x-reverse border border-white/40">
                      <Pill className="w-2.5 h-2.5" />
                      <span>روشتات وأدوية</span>
                    </span>
                  )}
                </div>

                {/* Title on image overlay */}
                <div className="absolute inset-x-0 bottom-0 min-h-[46px] h-11 px-2.5 py-1 text-white flex items-center justify-center bg-gradient-to-t from-emerald-950/90 via-emerald-950/60 to-transparent">
                  <h3 className="font-bold text-xs sm:text-sm text-center leading-snug drop-shadow-md line-clamp-2 w-full">
                    {pharmacyTitle}
                  </h3>
                </div>
              </div>

              {/* Bottom/Side Details & Action */}
              <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between bg-white">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-0.5">
                    <div className="flex items-center space-x-1.5 space-x-reverse">
                      <Pill className="w-3.5 h-3.5 text-emerald-600" />
                      <span>طلب علاج بالروشتة وتوصيل فوري</span>
                    </div>
                    {actionablePharmacyOrdersCount > 0 && !isPharmacyDisabled && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                        {actionablePharmacyOrdersCount} جاري
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {isPharmacyDisabled
                      ? "الخدمة معطلة مؤقتاً لأعمال الصيانة والتحديث. لا يمكن تقديم طلبات جديدة حالياً."
                      : "ارفع صورة الروشتة أو اكتب الأدوية، ويتولى مندوب الصيدلية شراءها وتوصيلها حتى باب المنزل مع الفاتورة الرسمية."}
                  </p>
                </div>

                <div
                  className={`pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold ${
                    isPharmacyDisabled ? "text-slate-400" : "text-emerald-700"
                  }`}
                >
                  <span>
                    {isPharmacyDisabled ? "الخدمة غير متاحة" : "فتح الصيدلية"}
                  </span>
                  <ChevronLeft
                    className={`w-3.5 h-3.5 transition-transform ${
                      isPharmacyDisabled ? "" : "group-hover:-translate-x-1"
                    }`}
                  />
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

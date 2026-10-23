import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { CategoryInfo, HomePermissions } from "../types";
import { CATEGORY_IMAGE_PRESETS } from "../data/categories";

export interface CurrencyItem {
  code: string;
  symbol: string;
  nameAr: string;
  flag: string;
}

export const CURRENCY_PRESETS: CurrencyItem[] = [
  { code: "EGP", symbol: "ج.م", nameAr: "جنيه مصري", flag: "🇪🇬" },
  { code: "SAR", symbol: "ر.س", nameAr: "ريال سعودي", flag: "🇸🇦" },
  { code: "AED", symbol: "د.إ", nameAr: "درهم إماراتي", flag: "🇦🇪" },
  { code: "KWD", symbol: "د.ك", nameAr: "دينار كويتي", flag: "🇰🇼" },
  { code: "QAR", symbol: "ر.ق", nameAr: "ريال قطري", flag: "🇶🇦" },
  { code: "BHD", symbol: "د.ب", nameAr: "دينار بحريني", flag: "🇧🇭" },
  { code: "OMR", symbol: "ر.ع", nameAr: "ريال عماني", flag: "🇴🇲" },
  { code: "JOD", symbol: "د.أ", nameAr: "دينار أردني", flag: "🇯🇴" },
  { code: "IQD", symbol: "د.ع", nameAr: "دينار عراقي", flag: "🇮🇶" },
  { code: "MAD", symbol: "د.م", nameAr: "درهم مغربي", flag: "🇲🇦" },
  { code: "DZD", symbol: "د.ج", nameAr: "دينار جزائري", flag: "🇩🇿" },
  { code: "TND", symbol: "د.ت", nameAr: "دينار تونسي", flag: "🇹🇳" },
  { code: "LYD", symbol: "د.ل", nameAr: "دينار ليبي", flag: "🇱🇾" },
  { code: "SDG", symbol: "ج.س", nameAr: "جنيه سوداني", flag: "🇸🇩" },
  { code: "YER", symbol: "ر.ي", nameAr: "ريال يمني", flag: "🇾🇪" },
  { code: "LBP", symbol: "ل.ل", nameAr: "ليرة لبنانية", flag: "🇱🇧" },
  { code: "SYP", symbol: "ل.س", nameAr: "ليرة سورية", flag: "🇸🇾" },
  { code: "USD", symbol: "$", nameAr: "دولار أمريكي", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", nameAr: "يورو", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", nameAr: "جنيه إسترليني", flag: "🇬🇧" },
  { code: "TRY", symbol: "₺", nameAr: "ليرة تركية", flag: "🇹🇷" },
];

import {
  Settings,
  ShieldCheck,
  Smartphone,
  Plus,
  Image as ImageIcon,
  Check,
  Trash2,
  Edit2,
  Lock,
  Unlock,
  Sparkles,
  Save,
  CheckCircle2,
  Wallet,
  Building,
  Layers,
  Eye,
  Sliders,
  AlertTriangle,
  Database,
  Coins,
  DollarSign,
  User,
  Key,
  Shield,
  Download,
  FileCode,
  Package,
  Sun,
  Moon,
  Type,
  Unlink,
  Link2,
  QrCode,
  Info,
  MessageCircle,
  PhoneCall,
  Copy,
  ExternalLink,
  Award,
  LogOut,
  Palette,
  SlidersHorizontal,
  Upload,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  History,
  Repeat,
  MapPin,
  Bell,
  Truck,
  Pill,
  Ban,
  Columns,
  Maximize2,
  EyeOff,
} from "lucide-react";
import { ActivityLogSection } from "./ActivityLogSection";
import { usePharmacy } from "../lib/usePharmacy";
import { PharmacyStatus, PharmacyWidth } from "../types/pharmacy";
import { catalogService } from "../lib/catalogService";

export const SettingsView: React.FC = () => {
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    addProductToCategory,
    updateProductInCategory,
    deleteProductFromCategory,
    homePermissions,
    updateHomePermissions,
    household,
    setHousehold,
    disconnectHousehold,
    householdMembers,
    activePairingToken,
    generatePairingToken,
    activeRole,
    budgetConfig,
    updateBudgetLimit,
    updateCurrency,
    supabaseUser,
    isSupabaseConnected,
    setIsSupabaseAuthModalOpen,
    isAboutModalOpen,
    setIsAboutModalOpen,
    setIsQrModalOpen,
    setIsGovernoratesModalOpen,
    setIsAdminNotifManagerModalOpen,
    setIsRecurringOrdersModalOpen,
    seedHouseholdCatalog,
    themeMode,
    setThemeMode,
    fontSize,
    setFontSize,
    setActiveTab,
  } = useApp();

  const [activeTabSection, setActiveTabSection] = useState<
    "app_settings" | "activity_log" | "permissions" | "categories" | "general"
  >("app_settings");

  // Unlink Household Confirmation Modal State
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [copiedDeveloperPhone, setCopiedDeveloperPhone] = useState(false);

  // Currency customization state
  const [customCurrencyInput, setCustomCurrencyInput] = useState("");
  const [isCustomCurrencyOpen, setIsCustomCurrencyOpen] = useState(false);

  // Category & Products management search/filter state
  const [catSearchQuery, setCatSearchQuery] = useState("");
  const [selectedCatFilter, setSelectedCatFilter] = useState<string | "all">("all");
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // State for Add Category modal/form
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatNameAr, setNewCatNameAr] = useState("");
  const [newCatNameEn, setNewCatNameEn] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatImageUrl, setNewCatImageUrl] = useState(
    CATEGORY_IMAGE_PRESETS[0].url
  );
  const [newCatCustomUrl, setNewCatCustomUrl] = useState("");
  const [newCatItems, setNewCatItems] = useState("");

  // State for Editing Category Image/Details
  const [editingCategory, setEditingCategory] = useState<CategoryInfo | null>(null);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editNameAr, setEditNameAr] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Delete Category Confirmation Modal State
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryInfo | null>(null);

  // Product Inline Edit State
  const [editingProduct, setEditingProduct] = useState<{
    categoryId: string;
    oldName: string;
    newName: string;
  } | null>(null);

  // Delete Product Confirmation Modal State
  const [productToDelete, setProductToDelete] = useState<{
    categoryId: string;
    productName: string;
  } | null>(null);

  // Quick Add Product Input State (map categoryId -> input string)
  const [newProductInputs, setNewProductInputs] = useState<Record<string, string>>({});

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Pharmacy Section Central Admin Settings (public.global_categories WHERE id = 'pharmacy')
  const { serviceSettings: pharmacySettings, updateSettings: updatePharmacySettings } = usePharmacy();
  const pharmacyCategory = categories.find((c) => c.id === "pharmacy");
  const [pharmStatus, setPharmStatus] = useState<PharmacyStatus>(pharmacySettings.status);
  const [pharmWidth, setPharmWidth] = useState<PharmacyWidth>(pharmacySettings.displayWidth);
  const [pharmName, setPharmName] = useState(pharmacyCategory?.nameAr || "الصيدلية");
  const [pharmImage, setPharmImage] = useState(pharmacyCategory?.imageUrl || "");
  const [isSavingPharm, setIsSavingPharm] = useState(false);

  React.useEffect(() => {
    setPharmStatus(pharmacySettings.status);
    setPharmWidth(pharmacySettings.displayWidth);
  }, [pharmacySettings]);

  React.useEffect(() => {
    if (pharmacyCategory) {
      setPharmName(pharmacyCategory.nameAr);
      setPharmImage(pharmacyCategory.imageUrl);
    }
  }, [pharmacyCategory]);

  const handleSavePharmacyConfig = async () => {
    setIsSavingPharm(true);
    try {
      // 1. Central Pharmacy Service Settings in Supabase (public.pharmacy_settings: display_width, service_enabled, section_visible)
      const res = await updatePharmacySettings({
        status: pharmStatus,
        displayWidth: pharmWidth,
      });

      // 2. Central Category Record in public.global_categories WHERE id = 'pharmacy'
      const trimmedName = pharmName.trim() || "الصيدلية";
      const trimmedImage = pharmImage.trim() || "";

      await catalogService.updateGlobalCategory("pharmacy", {
        name_ar: trimmedName,
        image_url: trimmedImage,
      });

      // 3. Reconcile local state immediately for instant feedback
      updateCategory("pharmacy", {
        nameAr: trimmedName,
        imageUrl: trimmedImage,
      });

      if (res.success) {
        showToast("تم تحديث إعدادات الصيدلية وسجل global_categories بنجاح ✅");
      } else {
        showToast("تم حفظ الإعدادات وجارٍ المزامنة مع الخادم");
      }
    } catch {
      showToast("تعذر حفظ الإعدادات، يرجى المحاولة لاحقاً");
    } finally {
      setIsSavingPharm(false);
    }
  };

  // Handle Currency Selection
  const handleSelectCurrency = (symbol: string, nameAr?: string) => {
    const trimmed = symbol.trim();
    if (!trimmed) return;
    updateCurrency(trimmed);
    showToast(`تم تغيير العملة إلى ${nameAr ? `${nameAr} (${trimmed})` : trimmed} بنجاح`);
  };

  // Handle Custom Currency Submission
  const handleSaveCustomCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    if (customCurrencyInput.trim()) {
      handleSelectCurrency(customCurrencyInput.trim());
      setCustomCurrencyInput("");
      setIsCustomCurrencyOpen(false);
    }
  };

  // Handle Home Screen Toggle
  const handleToggleScreen = (screen: keyof HomePermissions["allowedScreens"]) => {
    const updated = {
      ...homePermissions,
      allowedScreens: {
        ...homePermissions.allowedScreens,
        [screen]: !homePermissions.allowedScreens[screen],
      },
    };
    updateHomePermissions(updated);
    showToast("تم تحديث صلاحيات شاشات هاتف المنزل");
  };

  // Handle Action Permission Toggle
  const handleToggleAction = (action: keyof Omit<HomePermissions, "allowedScreens">) => {
    const updated = {
      ...homePermissions,
      [action]: !homePermissions[action],
    };
    updateHomePermissions(updated);
    showToast("تم تحديث الصلاحيات الإجرائية لهاتف المنزل");
  };

  // Submit New Category
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNameAr.trim()) return;

    const commonItemsList = newCatItems
      .split(/[,،\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newCategory: CategoryInfo = {
      id: `custom_${Date.now()}`,
      nameAr: newCatNameAr.trim(),
      nameEn: newCatNameEn.trim() || newCatNameAr.trim(),
      imageUrl: newCatCustomUrl.trim() || newCatImageUrl,
      color: "emerald",
      bgLight: "bg-emerald-50 text-emerald-800 border-emerald-200",
      badgeColor: "bg-emerald-100 text-emerald-800",
      description: newCatDesc.trim() || "مستلزمات وأغراض إضافية للبيت",
      commonItems:
        commonItemsList.length > 0
          ? commonItemsList
          : ["منتج ١", "منتج ٢", "منتج ٣"],
      isCustom: true,
    };

    addCategory(newCategory);
    setIsAddingCategory(false);
    setNewCatNameAr("");
    setNewCatNameEn("");
    setNewCatDesc("");
    setNewCatCustomUrl("");
    setNewCatItems("");
    showToast(`تمت إضافة قسم "${newCategory.nameAr}" بنجاح!`);
  };

  // Start Edit Category
  const startEditCategory = (cat: CategoryInfo) => {
    setEditingCategory(cat);
    setEditNameAr(cat.nameAr);
    setEditNameEn(cat.nameEn || "");
    setEditDesc(cat.description || "");
    setEditImageUrl(cat.imageUrl);
  };

  // Submit Edit Category
  const handleSaveEditedCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    updateCategory(editingCategory.id, {
      nameAr: editNameAr.trim() || editingCategory.nameAr,
      nameEn: editNameEn.trim() || editingCategory.nameEn,
      description: editDesc.trim() || editingCategory.description,
      imageUrl: editImageUrl.trim() || editingCategory.imageUrl,
    });

    setEditingCategory(null);
    showToast(`تم حفظ تعديلات قسم "${editNameAr.trim() || editingCategory.nameAr}" والصورة بنجاح!`);
  };

  // Handle Category Deletion Confirmation
  const handleConfirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const catName = categoryToDelete.nameAr;
    deleteCategory(categoryToDelete.id);
    if (expandedCategoryId === categoryToDelete.id) {
      setExpandedCategoryId(null);
    }
    setCategoryToDelete(null);
    showToast(`تم حذف قسم "${catName}" وجميع منتجاته بنجاح`);
  };

  // Quick Add Product inside Category
  const handleAddProduct = (categoryId: string) => {
    const inputVal = (newProductInputs[categoryId] || "").trim();
    if (!inputVal) return;

    const targetCat = categories.find((c) => c.id === categoryId);
    if (!targetCat) return;

    if (targetCat.commonItems.some((i) => i.toLowerCase() === inputVal.toLowerCase())) {
      showToast("هذا المنتج موجود بالفعل في قائمة هذا القسم");
      return;
    }

    addProductToCategory(categoryId, inputVal);
    setNewProductInputs((prev) => ({ ...prev, [categoryId]: "" }));
    showToast(`تمت إضافة منتج "${inputVal}" إلى قسم ${targetCat.nameAr}`);
  };

  // Save Edited Product Name
  const handleSaveEditedProduct = () => {
    if (!editingProduct) return;
    const trimmedNew = editingProduct.newName.trim();
    if (!trimmedNew) {
      showToast("يرجى إدخال اسم صالح للمنتج");
      return;
    }

    updateProductInCategory(
      editingProduct.categoryId,
      editingProduct.oldName,
      trimmedNew
    );
    showToast(`تم تعديل اسم المنتج إلى "${trimmedNew}"`);
    setEditingProduct(null);
  };

  // Confirm Delete Product
  const handleConfirmDeleteProduct = () => {
    if (!productToDelete) return;
    const { categoryId, productName } = productToDelete;
    deleteProductFromCategory(categoryId, productName);
    showToast(`تم حذف منتج "${productName}" بنجاح`);
    setProductToDelete(null);
  };

  // Upload Photo File Handler (FileReader)
  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: "new" | "edit" | "pharmacy"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("يرجى اختيار ملف صورة صالح");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (mode === "new") {
        setNewCatImageUrl(dataUrl);
        setNewCatCustomUrl(dataUrl);
      } else if (mode === "pharmacy") {
        setPharmImage(dataUrl);
      } else {
        setEditImageUrl(dataUrl);
      }
      showToast("تم تحميل الصورة بنجاح");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 text-right">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-4 sm:p-5 border border-slate-700 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  إعدادات وصلاحيات النظام (Admin)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  تحكم المسؤول
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                تحديد الصلاحيات الممنوحة لهاتف المنزل، إدارة الأقسام، وتخصيص الصور
              </p>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center space-x-2 space-x-reverse mt-4 pt-3 border-t border-slate-700/60 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTabSection("app_settings")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 ${
              activeTabSection === "app_settings"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>إعدادات التطبيق</span>
          </button>

          <button
            onClick={() => setActiveTabSection("activity_log")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 ${
              activeTabSection === "activity_log"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>سجل النشاطات</span>
          </button>

          <button
            onClick={() => setActiveTabSection("permissions")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 ${
              activeTabSection === "permissions"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>صلاحيات هاتف المنزل</span>
          </button>

          <button
            onClick={() => setActiveTabSection("categories")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 ${
              activeTabSection === "categories"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>إدارة الأقسام والصور ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTabSection("general")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 ${
              activeTabSection === "general"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>الميزانية والعملة</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className="px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>الملف الشخصي والحساب</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center justify-center space-x-2 space-x-reverse animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unlink Household Confirmation Modal */}
      {isUnlinkConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                تأكيد إلغاء ارتباط المنزل
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                هل أنت متأكد من إلغاء ارتباط المنزل <strong>"{household?.name || "المنزل الحالي"}"</strong>؟ سيتم مسح بيانات الاقتران والعودة لشاشة تسجيل الدخول.
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
              <p className="font-bold flex items-center space-x-1.5 space-x-reverse">
                <Info className="w-4 h-4 text-amber-600" />
                <span>ملاحظة:</span>
              </p>
              <p className="text-[11px] text-amber-700">
                يمكنك إعادة ربط المنزل في أي وقت باستخدام رمز الربط (Pair Code) أو كود QR.
              </p>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse pt-2">
              <button
                type="button"
                onClick={() => {
                  disconnectHousehold();
                  setIsUnlinkConfirmOpen(false);
                  showToast("تم إلغاء ارتباط المنزل بنجاح");
                  setActiveTab("auth");
                }}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center space-x-1.5 space-x-reverse"
              >
                <Unlink className="w-4 h-4" />
                <span>نعم، إلغاء الارتباط</span>
              </button>
              <button
                type="button"
                onClick={() => setIsUnlinkConfirmOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 0: APP SETTINGS (إعدادات التطبيق)                       */}
      {/* ========================================================== */}
      {activeTabSection === "app_settings" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          
          {/* 1. Linked Household & Unlink Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    المنزل المرتبط بالتطبيق
                  </h3>
                  <p className="text-xs text-slate-500">
                    إدارة المنزل المقترن به هذا الهاتف وإلغاء الربط
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1.5 space-x-reverse px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>مرتبط ونشط</span>
              </span>
            </div>

            {household ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <label className="text-slate-500 font-medium block mb-1">اسم المنزل</label>
                    <input
                      type="text"
                      value={household.name}
                      onChange={(e) => {
                        setHousehold({ ...household, name: e.target.value });
                      }}
                      className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <label className="text-slate-500 font-medium block mb-1">المسؤول عن المنزل</label>
                    <p className="font-bold text-slate-800">{household.adminName || "المسؤول"}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{household.adminPhone || "غير مسجل"}</p>
                  </div>

                  {activeRole === "admin" && (
                    <div className="p-3.5 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 rounded-xl border border-emerald-200 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-emerald-950 font-bold block">ربط أجهزة المنزل الجديدة</label>
                          <span className="text-[11px] text-emerald-700">توليد رمز اقتران مؤقت (15 دقيقة) أو كود QR عبر الكاميرا</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsQrModalOpen(true)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5 space-x-reverse cursor-pointer transition-all"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>رمز QR للربط</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <label className="text-slate-500 font-medium block mb-1">معرّف المنزل (Household ID)</label>
                    <span className="font-mono text-[11px] text-slate-500 break-all">{household.id}</span>
                  </div>
                </div>

                {/* Unlink Button Action */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    هل ترغب في تغيير المنزل أو إلغاء ارتباط هذا الجهاز؟
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsUnlinkConfirmOpen(true)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 space-x-reverse shadow-2xs"
                  >
                    <Unlink className="w-4 h-4 text-rose-600" />
                    <span>إلغاء ارتباط المنزل</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-500">لا يوجد منزل مرتبط بهذا الحساب حالياً</p>
                <button
                  onClick={() => setActiveTab("auth")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  ربط أو إنشاء منزل الآن
                </button>
              </div>
            )}
          </div>

          {/* 2. Theme Mode: Dark / Light */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  مظهر التطبيق (الوضع الداكن والفاتح)
                </h3>
                <p className="text-xs text-slate-500">
                  اختر سمة الألوان المفضلة لك أثناء تصفح وإدارة التطبيق
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Light Mode Option */}
              <button
                type="button"
                onClick={() => {
                  setThemeMode("light");
                  showToast("تم تفعيل الوضع الفاتح ☀️");
                }}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center space-x-3 space-x-reverse relative ${
                  themeMode === "light"
                    ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                  <Sun className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-1.5 space-x-reverse">
                    <p className="font-bold text-slate-900 text-xs sm:text-sm">الوضع الفاتح (Light Mode)</p>
                    {themeMode === "light" && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">مفعل</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    واجهة نهارية بيضاء ومشرقة وواضحة
                  </p>
                </div>
                {themeMode === "light" && (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>

              {/* Dark Mode Option */}
              <button
                type="button"
                onClick={() => {
                  setThemeMode("dark");
                  showToast("تم تفعيل الوضع الداكن 🌙");
                }}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center space-x-3 space-x-reverse relative ${
                  themeMode === "dark"
                    ? "bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs text-white"
                    : "bg-slate-900/90 hover:bg-slate-900 text-slate-100 border-slate-800"
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-indigo-400 flex items-center justify-center shrink-0 border border-slate-700">
                  <Moon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-1.5 space-x-reverse">
                    <p className="font-bold text-white text-xs sm:text-sm">الوضع الداكن (Dark Mode)</p>
                    {themeMode === "dark" && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30">مفعل</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    واجهة ليلية مريحة للعين وتوفر استهلاك البطارية
                  </p>
                </div>
                {themeMode === "dark" && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* 3. Font Size Scaling */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Type className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  تغيير حجم خط التطبيق
                </h3>
                <p className="text-xs text-slate-500">
                  تحديد حجم نصوص وعناوين التطبيق لسهولة القراءة والراحة البصرية
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {/* Small */}
              <button
                type="button"
                onClick={() => {
                  setFontSize("sm");
                  showToast("تم ضبط الخط إلى: صغير (A-)");
                }}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  fontSize === "sm"
                    ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 font-black"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                <span className="text-xs font-bold block mb-0.5">A- صغير</span>
                <span className="text-[10px] text-slate-400">14px مدمج</span>
              </button>

              {/* Medium / Default */}
              <button
                type="button"
                onClick={() => {
                  setFontSize("md");
                  showToast("تم ضبط الخط إلى: عادي (A)");
                }}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  fontSize === "md"
                    ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 font-black"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                <span className="text-sm font-bold block mb-0.5">A عادي (قياسي)</span>
                <span className="text-[10px] text-slate-400">16px افتراضي</span>
              </button>

              {/* Large */}
              <button
                type="button"
                onClick={() => {
                  setFontSize("lg");
                  showToast("تم ضبط الخط إلى: كبير (A+)");
                }}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  fontSize === "lg"
                    ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 font-black"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                <span className="text-base font-bold block mb-0.5">A+ كبير</span>
                <span className="text-[10px] text-slate-400">18px واضح</span>
              </button>

              {/* Extra Large */}
              <button
                type="button"
                onClick={() => {
                  setFontSize("xl");
                  showToast("تم ضبط الخط إلى: ضخم (A++)");
                }}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  fontSize === "xl"
                    ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 font-black"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                <span className="text-lg font-bold block mb-0.5">A++ ضخم</span>
                <span className="text-[10px] text-slate-400">20px عريض</span>
              </button>
            </div>

            {/* Live Text Preview Box */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="text-[11px] text-slate-400 font-bold">معاينة النص بالحجم الحالي:</p>
              <p className="text-slate-800 font-semibold leading-relaxed">
                "تطبيق طلباتي: نظام إدارة وتنظيم مشتريات ونواقص وميزانية المنزل الذكي"
              </p>
            </div>
          </div>

          {/* 4. About App & Contact Developer Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-5 border border-slate-700 shadow-md space-y-4 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-14 h-14 rounded-full bg-white p-0.5 border-2 border-emerald-400 shadow-lg shrink-0 overflow-hidden">
                  <img
                    src="/app-logo.png"
                    alt="أيقونة طلباتي"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <h3 className="text-lg font-black text-white">طلباتي</h3>
                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-bold">
                      v2.5.0
                    </span>
                  </div>
                  <p className="text-xs text-emerald-300 mt-0.5">
                    نظام إدارة مشتريات ونواقص وميزانية المنزل الذكي
                  </p>
                </div>
              </div>

              {/* Action: Open About Modal */}
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 space-x-reverse shrink-0"
              >
                <Info className="w-4 h-4 text-emerald-400" />
                <span>فتح بطاقة حول التطبيق</span>
              </button>
            </div>

            {/* Developer Contact Quick Action */}
            <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 space-x-reverse text-xs text-emerald-200 font-bold">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>تواصل مباشر مع مطور التطبيق عبر واتساب:</span>
                </div>
                <span className="font-mono text-xs text-slate-300 font-bold" dir="ltr">
                  +20 114 709 0720
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <a
                  href="https://wa.me/201147090720?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D8%A8%D8%AE%D8%B5%D9%88%D8%B5%20%D8%AA%D8%B7%D8%A8%D9%8A%D9%82%20%D8%B7%D9%84%D8%A8%D8%A7%D8%AA%D9%8A"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 space-x-reverse transition-colors cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>محادثة واتساب (+201147090720)</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("+201147090720");
                    setCopiedDeveloperPhone(true);
                    setTimeout(() => setCopiedDeveloperPhone(false), 2000);
                  }}
                  className="w-full sm:w-auto px-3 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 space-x-reverse transition-colors cursor-pointer"
                >
                  {copiedDeveloperPhone ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرقم</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 0.5: ACTIVITY LOG & HOUSEHOLD TRANSPARENCY (سجل النشاطات) */}
      {/* ========================================================== */}
      {activeTabSection === "activity_log" && (
        <ActivityLogSection />
      )}

      {/* ========================================================== */}
      {/* TAB 1: HOME PHONE PERMISSIONS & ALLOWED SCREENS             */}
      {/* ========================================================== */}
      {activeTabSection === "permissions" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          
          {/* Allowed Screens Panel */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Eye className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                الصفحات والشاشات المسموح لهاتف المنزل بالدخول إليها
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              يمكنك حجب شاشات الميزانية أو المشتريات عن هاتف المطبخ/المنزل لحماية الخصوصية
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Categories Screen */}
              <div
                onClick={() => handleToggleScreen("categories")}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  homePermissions.allowedScreens.categories
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">شاشة الأقسام والمستلزمات</span>
                  <span className="text-[11px] text-slate-500">تصفح الأصناف وإضافة النواقص</span>
                </div>
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                    homePermissions.allowedScreens.categories
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {homePermissions.allowedScreens.categories ? <Check className="w-4 h-4" /> : <Lock className="w-3 h-3" />}
                </div>
              </div>

              {/* Missing Items Screen */}
              <div
                onClick={() => handleToggleScreen("missing")}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  homePermissions.allowedScreens.missing
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">شاشة قائمة النواقص</span>
                  <span className="text-[11px] text-slate-500">مشاهدة النواقص المطلوبة للبيت</span>
                </div>
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                    homePermissions.allowedScreens.missing
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {homePermissions.allowedScreens.missing ? <Check className="w-4 h-4" /> : <Lock className="w-3 h-3" />}
                </div>
              </div>

              {/* Purchases Screen */}
              <div
                onClick={() => handleToggleScreen("purchases")}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  homePermissions.allowedScreens.purchases
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">شاشة فواتير المشتريات</span>
                  <span className="text-[11px] text-slate-500">الاطلاع على عمليات الشراء السابقة</span>
                </div>
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                    homePermissions.allowedScreens.purchases
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {homePermissions.allowedScreens.purchases ? <Check className="w-4 h-4" /> : <Lock className="w-3 h-3" />}
                </div>
              </div>

              {/* Budget Screen */}
              <div
                onClick={() => handleToggleScreen("budget")}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  homePermissions.allowedScreens.budget
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">شاشة الميزانية والمصروفات</span>
                  <span className="text-[11px] text-slate-500">تفاصيل الحد المالي والاستهلاك</span>
                </div>
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                    homePermissions.allowedScreens.budget
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {homePermissions.allowedScreens.budget ? <Check className="w-4 h-4" /> : <Lock className="w-3 h-3" />}
                </div>
              </div>
            </div>
          </div>

          {/* Action Permissions Panel */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                الصلاحيات الإجرائية لهاتف المنزل
              </h3>
            </div>

            <div className="space-y-2 pt-1">
              {/* Can Add Item */}
              <div
                onClick={() => handleToggleAction("canAddMissingItem")}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    إضافة منتج أو نقص جديد
                  </span>
                  <span className="text-[11px] text-slate-500">
                    السماح لهاتف المنزل بتسجيل نواقص جديدة
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={homePermissions.canAddMissingItem}
                  readOnly
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {/* Can Edit/Complete Item */}
              <div
                onClick={() => handleToggleAction("canEditItem")}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    تعديل وتحديد اكتمال النواقص
                  </span>
                  <span className="text-[11px] text-slate-500">
                    السماح بوضع علامة (تم الشراء) على الأغراض
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={homePermissions.canEditItem}
                  readOnly
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {/* Can Delete Item */}
              <div
                onClick={() => handleToggleAction("canDeleteMissingItem")}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    حذف منتج من قائمة النواقص
                  </span>
                  <span className="text-[11px] text-slate-500">
                    السماح بحذف الأغراض نهائياً من القائمة
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={homePermissions.canDeleteMissingItem}
                  readOnly
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {/* Can Add Invoice */}
              <div
                onClick={() => handleToggleAction("canAddInvoice")}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    تسجيل فواتير ومشتريات
                  </span>
                  <span className="text-[11px] text-slate-500">
                    السماح لهاتف المنزل بإدخال فواتير وخصمها من الميزانية
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={homePermissions.canAddInvoice}
                  readOnly
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {/* Can Use AI */}
              <div
                onClick={() => handleToggleAction("canUseAiAssistant")}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    استخدام المساعد الصوتي الذكي (Gemini AI)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    السماح بإملاء الطلبات عفوياً عبر الذكاء الاصطناعي
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={homePermissions.canUseAiAssistant}
                  readOnly
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {/* Can Send Urgent Attention Alert */}
              <div
                onClick={() => handleToggleAction("canSendUrgentAlert")}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    زر رنين التنبيه العاجل للمسؤول
                  </span>
                  <span className="text-[11px] text-slate-500">
                    إرسال نغمة تنبيه صوتية فورية لهاتف المسؤول عند وجود نواقص
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={homePermissions.canSendUrgentAlert}
                  readOnly
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: CATEGORY & PRODUCT MANAGEMENT                       */}
      {/* ========================================================== */}
      {activeTabSection === "categories" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          
          {/* Header with Add Button & App Icon Info */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>إدارة الأقسام وقوائم المنتجات والصور</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تعديل وتخصيص بيانات وصور الأقسام، تعديل أسماء المنتجات أو حذفها وإضافة أصناف جديدة
                </p>
              </div>

              <button
                onClick={() => setIsAddingCategory(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-colors shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة قسم جديد</span>
              </button>
            </div>

            {/* Notice about Fixed Product Images (App Icon) */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/50 rounded-xl border border-emerald-200/80 flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-white p-1 shadow-2xs border border-emerald-200 shrink-0 flex items-center justify-center">
                <img
                  src="/app-logo.png"
                  alt="أيقونة التطبيق"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 text-[11px] leading-relaxed text-emerald-950">
                <span className="font-bold block text-emerald-900">
                  📱 صور المنتجات الافتراضية:
                </span>
                تعتمد جميع المنتجات داخل الأقسام شعار التطبيق الرسمي كصورة افتراضية موحدة وثابتة لضمان سرعة التصفح وتوحيد التصميم.
              </div>
            </div>

            {/* 🏥 Central Pharmacy Section Controls (Admin Panel) */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white rounded-2xl border-2 border-emerald-300 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
                <div className="flex items-center space-x-2.5 space-x-reverse">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                      <span>التحكم المركزي في قسم الصيدلية</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        pharmStatus === "active"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : pharmStatus === "disabled"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      }`}>
                        {pharmStatus === "active" ? "مفعل" : pharmStatus === "disabled" ? "معطل" : "مخفي"}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      التحكم في ظهور كارت الصيدلية، وحالته، وعرضه (كامل أو نصف صف)، واسمه وصورته
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePharmacyConfig}
                  disabled={isSavingPharm}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 space-x-reverse transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingPharm ? "جارٍ الحفظ..." : "حفظ إعدادات الصيدلية"}</span>
                </button>
              </div>

              {/* 1. Status Selection (3 States: مفعل / معطل / مخفي) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  1. حالة قسم الصيدلية للمستخدمين:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* مفعل */}
                  <button
                    type="button"
                    onClick={() => setPharmStatus("active")}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center space-x-2.5 space-x-reverse ${
                      pharmStatus === "active"
                        ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-white/60 hover:bg-white border-slate-200"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">مفعل (طبيعي)</span>
                      <span className="text-[10px] text-slate-500">يظهر طبيعياً بالألوان وقابل للاستخدام</span>
                    </div>
                  </button>

                  {/* معطل */}
                  <button
                    type="button"
                    onClick={() => setPharmStatus("disabled")}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center space-x-2.5 space-x-reverse ${
                      pharmStatus === "disabled"
                        ? "bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                        : "bg-white/60 hover:bg-white border-slate-200"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Ban className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">معطل (أبيض وأسود)</span>
                      <span className="text-[10px] text-slate-500">يظهر أبيض وأسود مع ختم معطل ومغلق</span>
                    </div>
                  </button>

                  {/* مخفي */}
                  <button
                    type="button"
                    onClick={() => setPharmStatus("hidden")}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center space-x-2.5 space-x-reverse ${
                      pharmStatus === "hidden"
                        ? "bg-white border-rose-500 ring-2 ring-rose-500/20 shadow-xs"
                        : "bg-white/60 hover:bg-white border-slate-200"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                      <EyeOff className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">مخفي (غير مرئي)</span>
                      <span className="text-[10px] text-slate-500">لا يظهر نهائياً ولا يظهر خطه الفاصل</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Display Width (Full Width / Half Width) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  2. حجم وعرض قسم الصيدلية:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPharmWidth("full")}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center space-x-2.5 space-x-reverse ${
                      pharmWidth === "full"
                        ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-white/60 hover:bg-white border-slate-200"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">عرض كامل الصف (Full Width)</span>
                      <span className="text-[10px] text-slate-500">يشغل العرض الكامل أسفل الأقسام</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPharmWidth("half")}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center space-x-2.5 space-x-reverse ${
                      pharmWidth === "half"
                        ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-white/60 hover:bg-white border-slate-200"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Columns className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">نصف الصف (Half Width)</span>
                      <span className="text-[10px] text-slate-500">يشغل نصف عرض الصفحة</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Name & Image (Central public.global_categories WHERE id = 'pharmacy') */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    اسم القسم (global_categories.name_ar):
                  </label>
                  <input
                    type="text"
                    value={pharmName}
                    onChange={(e) => setPharmName(e.target.value)}
                    placeholder="الصيدلية"
                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 text-right"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    يتم حفظ الاسم مباشرة في سجل global_categories (id = 'pharmacy')
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      صورة القسم (global_categories.image_url):
                    </label>
                    <label className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center space-x-1 space-x-reverse">
                      <Upload className="w-3 h-3 text-emerald-600" />
                      <span>رفع صورة حقيقية</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileUpload(e, "pharmacy")}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={pharmImage}
                    onChange={(e) => setPharmImage(e.target.value)}
                    placeholder="رابط الصورة أو اختر رفع صورة حقيقية..."
                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500 text-left placeholder:text-right"
                  />
                  {pharmImage && (
                    <div className="flex items-center space-x-2 space-x-reverse pt-1">
                      <img
                        src={pharmImage}
                        alt="معاينة صورة الصيدلية"
                        className="w-12 h-10 object-cover rounded-lg border border-slate-200 shadow-2xs"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                      <span className="text-[10px] text-slate-500">معاينة صورة الصيدلية المركزية</span>
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 block">
                    استبدال الصورة المؤقتة وحفظ الرابط المركزي في Supabase
                  </span>
                </div>
              </div>
            </div>

            {/* Search and Category Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-slate-100">
              <div className="relative w-full sm:flex-1">
                <input
                  type="text"
                  value={catSearchQuery}
                  onChange={(e) => setCatSearchQuery(e.target.value)}
                  placeholder="بحث في أسماء الأقسام أو المنتجات داخلها..."
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white text-right"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                {catSearchQuery && (
                  <button
                    onClick={() => setCatSearchQuery("")}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Filter Pill */}
              <div className="flex items-center space-x-1.5 space-x-reverse overflow-x-auto w-full sm:w-auto text-[11px] font-bold">
                <button
                  onClick={() => setSelectedCatFilter("all")}
                  className={`px-3 py-1.5 rounded-xl transition-colors shrink-0 ${
                    selectedCatFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  جميع الأقسام ({categories.length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCatFilter(c.id)}
                    className={`px-2.5 py-1.5 rounded-xl transition-colors shrink-0 truncate max-w-[130px] ${
                      selectedCatFilter === c.id
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {c.nameAr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Add Category Form Modal / Drawer */}
          {isAddingCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <form
                onSubmit={handleCreateCategory}
                className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 text-right"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5 space-x-reverse">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>إضافة قسم جديد وتخصيص صورته</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(false)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      اسم القسم بالعربي *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCatNameAr}
                      onChange={(e) => setNewCatNameAr(e.target.value)}
                      placeholder="مثال: المخبوزات والحلويات"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      اسم القسم بالإنجليزي (اختياري)
                    </label>
                    <input
                      type="text"
                      value={newCatNameEn}
                      onChange={(e) => setNewCatNameEn(e.target.value)}
                      placeholder="مثال: Bakery & Sweets"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    وصف القسم
                  </label>
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="مثال: الخبز، التوست، الكرواسون، والحلويات الشرقية"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Image Selection Controls */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>صورة القسم (اختر من المعرض أو ارفع صورة):</span>
                    </label>
                    <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center space-x-1 space-x-reverse">
                      <Upload className="w-3 h-3" />
                      <span>رفع صورة من الجهاز</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileUpload(e, "new")}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Photo Selector Presets */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                    {CATEGORY_IMAGE_PRESETS.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => {
                          setNewCatImageUrl(preset.url);
                          setNewCatCustomUrl("");
                        }}
                        className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all cursor-pointer ${
                          newCatImageUrl === preset.url && !newCatCustomUrl
                            ? "border-emerald-600 ring-2 ring-emerald-500/50 shadow-xs"
                            : "border-slate-200 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[9px] font-bold py-0.5 truncate text-center">
                          {preset.title}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <input
                      type="url"
                      value={newCatCustomUrl}
                      onChange={(e) => {
                        setNewCatCustomUrl(e.target.value);
                        if (e.target.value) setNewCatImageUrl(e.target.value);
                      }}
                      placeholder="أو ضع رابط صورة مباشر (URL)..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-left"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    المنتجات الأولية لهذا القسم (افصل بينها بفواصل):
                  </label>
                  <textarea
                    rows={2}
                    value={newCatItems}
                    onChange={(e) => setNewCatItems(e.target.value)}
                    placeholder="توست أبيض، خبز عربي، صامولي، كرواسون سادة، كيك شوكولاتة"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 space-x-reverse cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>إضافة القسم</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Edit Category Modal */}
          {editingCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <form
                onSubmit={handleSaveEditedCategory}
                className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 text-right"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                    <Edit2 className="w-4 h-4 text-emerald-600" />
                    <span>تعديل قسم: {editingCategory.nameAr}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Selected Photo Preview */}
                <div className="relative rounded-2xl overflow-hidden aspect-video border border-slate-200 bg-slate-100 shadow-2xs">
                  <img
                    src={editImageUrl}
                    alt={editNameAr}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end p-3 justify-between text-white">
                    <div>
                      <span className="text-xs sm:text-sm font-bold block">{editNameAr || "اسم القسم"}</span>
                      <span className="text-[10px] text-slate-200">{editNameEn}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-600/90 px-2 py-0.5 rounded-md font-bold backdrop-blur-xs">
                      معاينة الصورة
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      اسم القسم بالعربي *
                    </label>
                    <input
                      type="text"
                      required
                      value={editNameAr}
                      onChange={(e) => setEditNameAr(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      اسم القسم بالإنجليزي
                    </label>
                    <input
                      type="text"
                      value={editNameEn}
                      onChange={(e) => setEditNameEn(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    وصف القسم
                  </label>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Change Photo Section */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تغيير صورة القسم:</span>
                    </label>
                    <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center space-x-1 space-x-reverse">
                      <Upload className="w-3 h-3" />
                      <span>رفع من الجهاز</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileUpload(e, "edit")}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                    {CATEGORY_IMAGE_PRESETS.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setEditImageUrl(preset.url)}
                        className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                          editImageUrl === preset.url
                            ? "border-emerald-600 ring-2 ring-emerald-500/50 shadow-xs"
                            : "border-slate-200 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>

                  <div>
                    <input
                      type="url"
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="رابط مباشر للصورة (URL)..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-left"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 space-x-reverse cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ التعديلات</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Delete Category Confirmation Modal */}
          {categoryToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 text-right">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                  <Trash2 className="w-6 h-6" />
                </div>

                <div className="text-center space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900">
                    تأكيد حذف قسم "{categoryToDelete.nameAr}"
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    هل أنت متأكد من رغبتك في حذف هذا القسم؟ سيتم حذف جميع الأصناف والمنتجات المرتبطة به ({categoryToDelete.commonItems.length} منتج).
                  </p>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse pt-2">
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(null)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    إلغاء التراجع
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteCategory}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    حذف القسم نهائياً
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Product Confirmation Modal */}
          {productToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl p-5 max-w-xs w-full border border-slate-200 shadow-2xl space-y-3.5 animate-in zoom-in-95 text-right">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    حذف منتج "{productToDelete.productName}"
                  </h3>
                  <p className="text-xs text-slate-500">
                    هل ترغب في حذف هذا المنتج من قائمة الأصناف المقترحة لهذا القسم؟
                  </p>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse pt-1">
                  <button
                    type="button"
                    onClick={() => setProductToDelete(null)}
                    className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteProduct}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                  >
                    حذف المنتج
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Categories and Products List */}
          <div className="space-y-3.5">
            {categories
              .filter((cat) => {
                if (selectedCatFilter !== "all" && cat.id !== selectedCatFilter) {
                  return false;
                }
                if (!catSearchQuery.trim()) return true;
                const query = catSearchQuery.toLowerCase().trim();
                const matchName = cat.nameAr.toLowerCase().includes(query) || (cat.nameEn || "").toLowerCase().includes(query);
                const matchItems = cat.commonItems.some((item) => item.toLowerCase().includes(query));
                return matchName || matchItems;
              })
              .map((category) => {
                const isExpanded = expandedCategoryId === category.id || selectedCatFilter === category.id;
                const newProdVal = newProductInputs[category.id] || "";

                return (
                  <div
                    key={category.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:border-slate-300 transition-all"
                  >
                    {/* Category Header Row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3.5 sm:p-4 gap-3 bg-white border-b border-slate-100">
                      
                      {/* Thumbnail & Title */}
                      <div className="flex items-center space-x-3 space-x-reverse min-w-0">
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 shadow-2xs">
                          <img
                            src={category.imageUrl}
                            alt={category.nameAr}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1">
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                              {category.nameAr}
                            </h4>
                            {category.isCustom && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                قسم مخصص
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                              {category.commonItems.length} صنف
                            </span>
                          </div>
                          {category.nameEn && (
                            <span className="text-[11px] text-slate-400 block font-medium">
                              {category.nameEn}
                            </span>
                          )}
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {category.description}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons for Category */}
                      <div className="flex items-center space-x-1.5 space-x-reverse self-end sm:self-center shrink-0">
                        {/* Toggle Products Button */}
                        <button
                          onClick={() =>
                            setExpandedCategoryId(isExpanded ? null : category.id)
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer ${
                            isExpanded
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          }`}
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span>إدارة الأصناف ({category.commonItems.length})</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Edit Category & Image */}
                        <button
                          onClick={() => startEditCategory(category)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 space-x-reverse cursor-pointer"
                          title="تعديل اسم وصورة القسم"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          <span className="hidden sm:inline">تعديل القسم والصورة</span>
                        </button>

                        {/* Delete Category Button */}
                        <button
                          onClick={() => setCategoryToDelete(category)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="حذف هذا القسم بالكامل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Products Management Accordion Section */}
                    {isExpanded && (
                      <div className="p-3.5 sm:p-4 bg-slate-50/80 border-t border-slate-100 space-y-3 animate-in fade-in duration-100">
                        
                        {/* Quick Add Product Field */}
                        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                              <Plus className="w-3.5 h-3.5 text-emerald-600" />
                              <span>إضافة منتج جديد لقسم "{category.nameAr}":</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              تضاف بأيقونة التطبيق الافتراضية 📱
                            </span>
                          </div>

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAddProduct(category.id);
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={newProdVal}
                              onChange={(e) =>
                                setNewProductInputs((prev) => ({
                                  ...prev,
                                  [category.id]: e.target.value,
                                }))
                              }
                              placeholder="اكتب اسم المنتج (مثال: أرز بسمتي، جبنة كيري، سائل أطباق...)"
                              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white text-right"
                            />
                            <button
                              type="submit"
                              disabled={!newProdVal.trim()}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1 space-x-reverse shrink-0 ${
                                newProdVal.trim()
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                              }`}
                            >
                              <Plus className="w-4 h-4" />
                              <span>إضافة المنتج</span>
                            </button>
                          </form>
                        </div>

                        {/* Products List */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                            <span>قائمة المنتجات الحالية ({category.commonItems.length}):</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              يمكنك تعديل اسم المنتج أو حذفه بنقرة واحدة
                            </span>
                          </div>

                          {category.commonItems.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {category.commonItems.map((prodName, idx) => {
                                const isEditingThis =
                                  editingProduct?.categoryId === category.id &&
                                  editingProduct?.oldName === prodName;

                                return (
                                  <div
                                    key={idx}
                                    className={`bg-white p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 shadow-2xs ${
                                      isEditingThis
                                        ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40"
                                        : "border-slate-200 hover:border-slate-300"
                                    }`}
                                  >
                                    {/* Default App Logo for Product */}
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50/80 border border-emerald-100 flex items-center justify-center p-1 shrink-0">
                                      <img
                                        src="/app-logo.png"
                                        alt="أيقونة المنتج"
                                        className="w-full h-full object-contain"
                                      />
                                    </div>

                                    {/* Product Title or Inline Edit */}
                                    {isEditingThis ? (
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <input
                                          type="text"
                                          autoFocus
                                          value={editingProduct.newName}
                                          onChange={(e) =>
                                            setEditingProduct((prev) =>
                                              prev ? { ...prev, newName: e.target.value } : null
                                            )
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveEditedProduct();
                                            if (e.key === "Escape") setEditingProduct(null);
                                          }}
                                          className="w-full px-2 py-1 bg-white border border-emerald-400 rounded-lg text-xs font-bold focus:outline-none text-right"
                                        />
                                        <button
                                          type="button"
                                          onClick={handleSaveEditedProduct}
                                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                                          title="حفظ الاسم الجديد"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingProduct(null)}
                                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                                          title="إلغاء"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-xs font-bold text-slate-800 truncate flex-1 leading-snug">
                                          {prodName}
                                        </span>

                                        <div className="flex items-center space-x-1 space-x-reverse shrink-0">
                                          {/* Edit Product Name */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingProduct({
                                                categoryId: category.id,
                                                oldName: prodName,
                                                newName: prodName,
                                              })
                                            }
                                            className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                            title="تعديل اسم المنتج"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>

                                          {/* Delete Product */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setProductToDelete({
                                                categoryId: category.id,
                                                productName: prodName,
                                              })
                                            }
                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            title="حذف هذا المنتج"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-6 text-center bg-white rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                              لا توجد منتجات مسجلة في هذا القسم بعد. أضف منتجاتك أعلاه!
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 3: GENERAL SETTINGS (BUDGET & HOUSEHOLD)                */}
      {/* ========================================================== */}
      {activeTabSection === "general" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Currency Settings Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    اختيار نوع وعملة التطبيق
                  </h3>
                  <p className="text-xs text-slate-500">
                    العملة المعتمدة في حسابات الميزانية وفواتير الشراء
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black">
                العملة الحالية: {budgetConfig.currency}
              </span>
            </div>

            {/* Quick Currency Presets Grid */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                العملات الأكثر استخداماً (اضغط للاختيار المباشر):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {CURRENCY_PRESETS.map((curr) => {
                  const isSelected = budgetConfig.currency === curr.symbol;
                  return (
                    <button
                      key={curr.code}
                      type="button"
                      onClick={() => handleSelectCurrency(curr.symbol, curr.nameAr)}
                      className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center space-x-2 space-x-reverse min-w-0">
                        <span className="text-base leading-none shrink-0">{curr.flag}</span>
                        <div className="truncate">
                          <p className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-slate-900"}`}>
                            {curr.nameAr}
                          </p>
                          <span className={`text-[10px] font-mono ${isSelected ? "text-emerald-100" : "text-slate-500"}`}>
                            {curr.symbol} • {curr.code}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dropdown & Custom Currency Input */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  اختيار من القائمة الشاملة
                </label>
                <select
                  value={
                    CURRENCY_PRESETS.some((c) => c.symbol === budgetConfig.currency)
                      ? budgetConfig.currency
                      : "custom"
                  }
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setIsCustomCurrencyOpen(true);
                    } else {
                      const found = CURRENCY_PRESETS.find((c) => c.symbol === e.target.value);
                      handleSelectCurrency(e.target.value, found?.nameAr);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <optgroup label="العملات العربية والعالمية">
                    {CURRENCY_PRESETS.map((curr) => (
                      <option key={curr.code} value={curr.symbol}>
                        {curr.flag} {curr.nameAr} ({curr.symbol} - {curr.code})
                      </option>
                    ))}
                  </optgroup>
                  <option value="custom">✍️ إدخال عملة مخصصة يدوياً...</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  أو كتابة رمز عملة مخصص
                </label>
                <form onSubmit={handleSaveCustomCurrency} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="مثال: د.م أو ليرة أو USD"
                    value={customCurrencyInput}
                    onChange={(e) => setCustomCurrencyInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!customCurrencyInput.trim()}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-2xs"
                  >
                    حفظ العملة
                  </button>
                </form>
              </div>
            </div>

            {/* Live Pricing Preview Strip */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 font-medium">معاينة فورية لطريقة ظهور المبالغ:</span>
              <div className="flex items-center space-x-3 space-x-reverse font-mono font-bold text-slate-900">
                <span className="px-2 py-0.5 bg-white rounded-lg border border-slate-200">
                  فاتورة: ١٥٠ {budgetConfig.currency}
                </span>
                <span className="text-slate-300">|</span>
                <span className="px-2 py-0.5 bg-emerald-100/70 text-emerald-800 rounded-lg border border-emerald-200">
                  الميزانية: {budgetConfig.monthlyLimit.toLocaleString()} {budgetConfig.currency}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                إعدادات الميزانية الشهرية
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الحد الشهري للميزانية ({budgetConfig.currency})
                </label>
                <input
                  type="number"
                  value={budgetConfig.monthlyLimit}
                  onChange={(e) => updateBudgetLimit(Number(e.target.value) || 1000)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الشهر الحالي
                </label>
                <input
                  type="text"
                  value={budgetConfig.month}
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Database className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  ربط وحساب قاعدة بيانات Supabase
                </h3>
              </div>
              <button
                onClick={() => setIsSupabaseAuthModalOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                {supabaseUser ? "إدارة الحساب" : "تسجيل الدخول / إنشاء حساب"}
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">حالة الاتصال السحابي:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md ${
                    isSupabaseConnected
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isSupabaseConnected ? "متصل بـ Supabase" : "يعمل بالوضع المحلي / بحاجة لمفاتيح"}
                </span>
              </div>
              {supabaseUser && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-slate-600 font-medium">البريد الإلكتروني المسجل:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {supabaseUser.email}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Building className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  بيانات المنزل والاقتران المعتمدة
                </h3>
              </div>
              {activeRole === "admin" && (
                <button
                  type="button"
                  onClick={() => generatePairingToken(24)}
                  className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all"
                >
                  توليد رمز اقتران جديد
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  اسم المنزل
                </label>
                <input
                  type="text"
                  value={household?.name || ""}
                  onChange={(e) => {
                    if (household) {
                      setHousehold({ ...household, name: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  معرّف المنزل (Household ID)
                </label>
                <input
                  type="text"
                  value={household?.id || "غير متصل"}
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 font-mono"
                />
              </div>
            </div>

            {/* Active Pairing Code */}
            {activePairingToken && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Key className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold text-emerald-900 block">رمز الاقتران النشط: {activePairingToken.token}</span>
                    <span className="text-[10px] text-emerald-700">
                      صالح حتى: {new Date(activePairingToken.expiresAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activePairingToken.token);
                    showToast("تم نسخ رمز الاقتران!");
                  }}
                  className="p-1.5 bg-white border border-emerald-200 rounded-lg text-emerald-800 font-bold hover:bg-emerald-100 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Household Members List */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <div className="flex items-center space-x-1.5 space-x-reverse">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>الأجهزة وأفراد المنزل المتصلين ({householdMembers.length}):</span>
                </div>
              </div>

              {householdMembers.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 text-center">لا يوجد أعضاء متصلين حالياً</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {householdMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                          {member.role === "admin" ? "👑" : "📱"}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{member.displayName}</span>
                          <span className="text-[10px] text-slate-500">
                            {member.role === "admin" ? "مسؤول المنزل" : "هاتف / عضو"}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        {member.status === "active" ? "نشط" : "معلق"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

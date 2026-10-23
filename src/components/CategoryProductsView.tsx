import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { CatalogProduct } from "../types";
import {
  ArrowRight,
  Plus,
  Check,
  Search,
  Circle,
  Trash2,
  Edit2,
  MoreVertical,
  Layers,
  Tag,
  Clock,
  MinusCircle,
  X,
  ShoppingBag,
} from "lucide-react";

export const CategoryProductsView: React.FC = () => {
  const {
    selectedCategory,
    setSelectedCategory,
    categories,
    missingItems,
    addMissingItem,
    incrementMissingItemQuantity,
    decrementMissingItemQuantity,
    toggleItemCompletion,
    deleteMissingItem,
    activeRole,
    homePermissions,
    addProductToCategory,
    updateProductInCategory,
    deleteProductFromCategory,
    householdProducts,
    getCatalogProductsForCategory,
    addOrUpdateHouseholdProduct,
    deleteHouseholdProduct,
    refreshActiveStateFromCache,
  } = useApp();

  useEffect(() => {
    refreshActiveStateFromCache();
  }, [selectedCategory, refreshActiveStateFromCache]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "missing" | "available">("all");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | "all">("all");

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // State for "Add New Product to Category Catalog" Modal
  const [isAddCatalogProductOpen, setIsAddCatalogProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductSubcat, setNewProductSubcat] = useState("");
  const [newProductAlsoMissing, setNewProductAlsoMissing] = useState(false);

  // State for 3-dots Menu Modal / Action Sheet
  const [activeProductMenu, setActiveProductMenu] = useState<{
    product: CatalogProduct;
  } | null>(null);

  // State for Edit Product Modal
  const [productToEdit, setProductToEdit] = useState<{
    product: CatalogProduct;
    newName: string;
    subcategoryId?: string;
    newQuantity?: string;
    newUnit?: string;
    newPrice?: number;
  } | null>(null);

  // State for Delete Product Confirmation Modal
  const [productToDelete, setProductToDelete] = useState<CatalogProduct | null>(null);

  // Quick Missing Item custom form state
  const [customItemName, setCustomItemName] = useState("");
  const [customQuantity, setCustomQuantity] = useState("١");
  const [customUrgency, setCustomUrgency] = useState<"high" | "normal">("normal");

  const category = categories.find((c) => c.id === selectedCategory);

  if (!category) {
    return (
      <div className="text-center py-16 space-y-4 bg-white rounded-3xl p-8 border border-slate-200 shadow-xs text-right select-none">
        <h3 className="text-lg font-bold text-slate-800">لم يتم العثور على القسم</h3>
        <p className="text-xs text-slate-500">يرجى الرجوع واختيار قسم صالح من قائمة الأقسام.</p>
        <button
          onClick={() => setSelectedCategory(null)}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-1.5 space-x-reverse cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للأقسام</span>
        </button>
      </div>
    );
  }

  const canAdd = activeRole === "admin" || homePermissions.canAddMissingItem;
  const canDelete = activeRole === "admin" || homePermissions.canDeleteMissingItem;

  // Missing items specifically for this category
  const categoryMissingItems = missingItems.filter(
    (item) => item.category === category.id
  );
  const activeMissingForCategory = categoryMissingItems.filter((i) => !i.completed);

  // Check if item is currently in missing list
  const isItemMissing = (itemName: string) => {
    return activeMissingForCategory.some(
      (m) => m.name.toLowerCase().trim() === itemName.toLowerCase().trim()
    );
  };

  // Find missing item object for a product
  const getMissingItemForProduct = (itemName: string) => {
    return activeMissingForCategory.find(
      (m) => m.name.toLowerCase().trim() === itemName.toLowerCase().trim()
    );
  };

  // Subcategories list (default + any attached)
  const subcategories = category.subcategories || [];

  // Unified Catalog Products for this category
  const categoryProducts: CatalogProduct[] = useMemo(() => {
    return getCatalogProductsForCategory(category.id);
  }, [category.id, getCatalogProductsForCategory]);

  // Determine subcategory for a product if available
  const findSubcategoryForProduct = (prod: CatalogProduct) => {
    if (prod.subcategory_id) {
      const found = subcategories.find((s) => s.id === prod.subcategory_id);
      if (found) return found;
    }
    return subcategories.find((sub) => sub.items && sub.items.includes(prod.name_ar));
  };

  // Direct Click Handler on Product Card: Toggle Missing Status (One click adds, another click removes)
  const handleProductCardClick = (prod: CatalogProduct) => {
    if (!canAdd) {
      showToast("ليس لديك صلاحية تعديل قائمة النواقص");
      return;
    }

    const missingItem = getMissingItemForProduct(prod.name_ar);
    if (missingItem) {
      // Already in missing -> Remove it
      deleteMissingItem(missingItem.id);
      showToast(`تمت إزالة "${prod.name_ar}" من قائمة النواقص`);
    } else {
      // Not in missing -> Add it
      addMissingItem({
        name: prod.name_ar,
        category: category.id,
        categoryArabic: category.nameAr,
        quantity: prod.quantity || prod.default_quantity || "١",
        urgency: "normal",
        notes: "",
        addedBy: activeRole === "admin" ? "admin" : "home",
        addedByName: activeRole === "admin" ? "المسؤول" : "هاتف المنزل",
      });
      showToast(`تمت إضافة "${prod.name_ar}" إلى النواقص!`);
    }
  };

  // Action 1 from 3-dots Menu: Toggle Missing Status
  const handleToggleMissingFromMenu = (prod: CatalogProduct) => {
    const missingItem = getMissingItemForProduct(prod.name_ar);
    if (missingItem) {
      deleteMissingItem(missingItem.id);
      showToast(`تمت إزالة "${prod.name_ar}" من قائمة النواقص`);
    } else {
      addMissingItem({
        name: prod.name_ar,
        category: category.id,
        categoryArabic: category.nameAr,
        quantity: prod.quantity || prod.default_quantity || "١",
        urgency: "normal",
        notes: "",
        addedBy: activeRole === "admin" ? "admin" : "home",
        addedByName: activeRole === "admin" ? "المسؤول" : "هاتف المنزل",
      });
      showToast(`تمت إضافة "${prod.name_ar}" إلى قائمة النواقص`);
    }
    setActiveProductMenu(null);
  };

  // Action 2 from 3-dots Menu: Open Edit Product Modal
  const handleOpenEditFromMenu = (prod: CatalogProduct) => {
    const currentSub = findSubcategoryForProduct(prod);
    setProductToEdit({
      product: prod,
      newName: prod.name_ar,
      subcategoryId: currentSub ? currentSub.id : subcategories[0]?.id || "",
      newQuantity: prod.quantity || prod.default_quantity || "١",
      newUnit: prod.unit || prod.default_unit || "قطعة",
      newPrice: prod.estimated_price || 0,
    });
    setActiveProductMenu(null);
  };

  // Submit Edit Product
  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToEdit) return;
    const trimmed = productToEdit.newName.trim();
    if (!trimmed) {
      showToast("يرجى إدخال اسم صحيح للمنتج");
      return;
    }

    updateProductInCategory(
      category.id,
      productToEdit.product.name_ar,
      trimmed,
      productToEdit.subcategoryId
    );

    await addOrUpdateHouseholdProduct({
      id: productToEdit.product.id.startsWith("fallback-") ? undefined : productToEdit.product.id,
      category_id: category.id,
      subcategory_id: productToEdit.subcategoryId || null,
      name_ar: trimmed,
      quantity: productToEdit.newQuantity || productToEdit.product.quantity || "١",
      unit: productToEdit.newUnit || productToEdit.product.unit || "قطعة",
      estimated_price: productToEdit.newPrice !== undefined ? productToEdit.newPrice : productToEdit.product.estimated_price,
      source_global_product_id: productToEdit.product.source_global_product_id || (productToEdit.product.id.startsWith("fallback-") ? null : productToEdit.product.id),
      is_custom: productToEdit.product.is_custom,
    });

    showToast(`تم تعديل اسم المنتج إلى "${trimmed}" بنجاح!`);
    setProductToEdit(null);
  };

  // Action 3 from 3-dots Menu: Open Delete Confirmation Modal
  const handleOpenDeleteFromMenu = (prod: CatalogProduct) => {
    setProductToDelete(prod);
    setActiveProductMenu(null);
  };

  // Confirm Delete Product from Category Catalog
  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const prod = productToDelete;
    deleteProductFromCategory(category.id, prod.name_ar);

    // Also remove from household_products structured table if exists
    const matchingHouseholdProduct = householdProducts.find(
      (p) =>
        p.category_id === category.id &&
        (p.id === prod.id || p.name_ar.trim().toLowerCase() === prod.name_ar.trim().toLowerCase())
    );
    if (matchingHouseholdProduct) {
      await deleteHouseholdProduct(matchingHouseholdProduct.id);
    }

    // If also in missing, remove from active missing
    const missingObj = getMissingItemForProduct(prod.name_ar);
    if (missingObj) {
      deleteMissingItem(missingObj.id);
    }

    showToast(`تم حذف منتج "${prod.name_ar}" من قائمة القسم`);
    setProductToDelete(null);
  };

  // Handle Add New Product to Catalog
  const handleCreateCatalogProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProductName.trim();
    if (!trimmed) return;

    if (categoryProducts.some((p) => p.name_ar.toLowerCase() === trimmed.toLowerCase())) {
      showToast("هذا المنتج موجود بالفعل في قائمة هذا القسم");
      return;
    }

    addProductToCategory(
      category.id,
      trimmed,
      newProductSubcat || subcategories[0]?.id
    );

    // Also persist to household_products structured table
    await addOrUpdateHouseholdProduct({
      category_id: category.id,
      subcategory_id: newProductSubcat || subcategories[0]?.id || null,
      name_ar: trimmed,
      quantity: "١",
      unit: "قطعة",
      is_custom: true,
      source_global_product_id: null,
    });

    if (newProductAlsoMissing && canAdd) {
      addMissingItem({
        name: trimmed,
        category: category.id,
        categoryArabic: category.nameAr,
        quantity: "١",
        urgency: "normal",
        notes: "",
        addedBy: activeRole === "admin" ? "admin" : "home",
        addedByName: activeRole === "admin" ? "المسؤول" : "هاتف المنزل",
      });
    }

    showToast(`تمت إضافة منتج "${trimmed}" وحفظه في قائمة القسم بنجاح!`);
    setNewProductName("");
    setIsAddCatalogProductOpen(false);
  };

  // Add Custom Missing Item
  const handleAddCustomMissing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim() || !canAdd) return;

    addMissingItem({
      name: customItemName.trim(),
      category: category.id,
      categoryArabic: category.nameAr,
      quantity: customQuantity.trim() || "١",
      urgency: customUrgency,
      notes: "",
      addedBy: activeRole === "admin" ? "admin" : "home",
      addedByName: activeRole === "admin" ? "المسؤول" : "هاتف المنزل",
    });

    const addedName = customItemName.trim();
    setCustomItemName("");
    setCustomQuantity("١");
    showToast(`تمت إضافة "${addedName}" إلى النواقص!`);
  };

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    let list = categoryProducts;

    // Filter by Subcategory
    if (selectedSubcategoryId !== "all") {
      list = list.filter((p) => {
        if (p.subcategory_id === selectedSubcategoryId) return true;
        const targetSub = subcategories.find((s) => s.id === selectedSubcategoryId);
        if (targetSub && targetSub.items) {
          return targetSub.items.includes(p.name_ar);
        }
        return false;
      });
    }

    // Filter by Search Query (Arabic and English)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name_ar.toLowerCase().includes(q) ||
          (p.name_en && p.name_en.toLowerCase().includes(q))
      );
    }

    // Filter by Mode
    if (filterMode === "missing") {
      list = list.filter((p) => isItemMissing(p.name_ar));
    } else if (filterMode === "available") {
      list = list.filter((p) => !isItemMissing(p.name_ar));
    }

    return list;
  }, [categoryProducts, selectedSubcategoryId, subcategories, searchQuery, filterMode, activeMissingForCategory]);

  // Grouped products by subcategory when "all" is selected and no active search
  const subcategoryGroups = useMemo(() => {
    if (selectedSubcategoryId !== "all" || searchQuery.trim() || filterMode !== "all" || subcategories.length === 0) {
      return null;
    }

    const groups: { subcategory: { id: string; nameAr: string }; items: CatalogProduct[] }[] = [];
    const assignedIds = new Set<string>();

    subcategories.forEach((sub) => {
      const validItems = categoryProducts.filter((p) => {
        if (p.subcategory_id === sub.id) return true;
        if (sub.items && sub.items.includes(p.name_ar)) return true;
        return false;
      });
      if (validItems.length > 0) {
        groups.push({
          subcategory: { id: sub.id, nameAr: sub.nameAr },
          items: validItems,
        });
        validItems.forEach((i) => assignedIds.add(i.id));
      }
    });

    // Unassigned items (General)
    const unassigned = categoryProducts.filter((i) => !assignedIds.has(i.id));
    if (unassigned.length > 0) {
      groups.push({
        subcategory: { id: "general", nameAr: "أصناف أخرى عامة" },
        items: unassigned,
      });
    }

    return groups;
  }, [selectedSubcategoryId, searchQuery, filterMode, subcategories, categoryProducts]);

  // Render a Single Product Card
  const renderProductCard = (prod: CatalogProduct, idx: number) => {
    const missingItem = getMissingItemForProduct(prod.name_ar);
    const missing = !!missingItem;
    const subcat = findSubcategoryForProduct(prod);

    return (
      <div
        key={`${prod.id}-${idx}`}
        onClick={() => handleProductCardClick(prod)}
        className={`product-item p-3 rounded-2xl border text-right flex items-center justify-between gap-2.5 transition-all cursor-pointer relative overflow-hidden select-none group ${
          missing
            ? "bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs"
            : "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs text-slate-800 hover:bg-slate-50/60"
        }`}
      >
        {/* Product Image: Uses prod.image_url first with fallback to /app-logo.png */}
        <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 p-0.5 shrink-0 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform pointer-events-none overflow-hidden">
          {prod.image_url ? (
            <img
              src={prod.image_url}
              alt={prod.name_ar}
              className="w-full h-full object-cover rounded-lg pointer-events-none"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/app-logo.png";
              }}
            />
          ) : (
            <img
              src="/app-logo.png"
              alt={prod.name_ar}
              className="w-full h-full object-contain pointer-events-none p-1"
            />
          )}
        </div>

        {/* Product Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5 space-x-reverse">
            <span className="text-xs sm:text-sm font-bold truncate block text-slate-900">
              {prod.name_ar}
            </span>
            {prod.name_en && (
              <span className="text-[10px] text-slate-400 font-normal truncate hidden sm:inline">
                ({prod.name_en})
              </span>
            )}
            {prod.is_custom && (
              <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded font-medium shrink-0">
                مخصص
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-1.5 text-[10px] text-slate-500 mt-0.5">
            {subcat ? (
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium truncate max-w-[110px]">
                {subcat.nameAr}
              </span>
            ) : (
              <span>صنف رئيسي</span>
            )}

            {(prod.unit || prod.default_unit) && (
              <span className="text-slate-500 bg-slate-50 border border-slate-200/60 px-1 rounded">
                {prod.quantity || prod.default_quantity || "١"} {prod.unit || prod.default_unit}
              </span>
            )}

            {prod.estimated_price !== undefined && prod.estimated_price > 0 && (
              <span className="text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-1 rounded">
                ~{prod.estimated_price} ج.م
              </span>
            )}

            {missing ? (
              <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
                مطلوب بالنواقص
              </span>
            ) : (
              <span className="text-slate-400">
                نقرة للإضافة
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 space-x-reverse shrink-0">
          {/* If Missing: Stepper Controls */}
          {missing && missingItem && (
            <div
              className="flex items-center space-x-1 space-x-reverse bg-emerald-100/90 text-emerald-950 rounded-lg p-0.5 border border-emerald-300/80"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => decrementMissingItemQuantity(missingItem.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-emerald-800 hover:bg-emerald-200/80 transition-colors font-bold text-xs"
                title="إنقاص الكمية"
              >
                -
              </button>
              <span className="px-1 text-xs font-bold min-w-[16px] text-center">
                {missingItem.quantity || "١"}
              </span>
              <button
                type="button"
                onClick={() => incrementMissingItemQuantity(missingItem.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-emerald-800 hover:bg-emerald-200/80 transition-colors font-bold text-xs"
                title="زيادة الكمية"
              >
                +
              </button>
            </div>
          )}

          {/* Status Indicator Icon */}
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
              missing
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-700"
            }`}
          >
            {missing ? (
              <Check className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </div>

          {/* 3-dots Menu Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveProductMenu({ product: prod });
            }}
            className="w-7 h-7 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            title="خيارات المنتج (تعديل / حذف / نواقص)"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200 select-none" dir="rtl">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className="inline-flex items-center space-x-2 space-x-reverse text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          <span>العودة لجميع الأقسام</span>
        </button>

        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            onClick={() => {
              setNewProductSubcat(selectedSubcategoryId !== "all" ? selectedSubcategoryId : subcategories[0]?.id || "");
              setIsAddCatalogProductOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد للقائمة</span>
          </button>
        </div>
      </div>

      {/* Category Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden shadow-sm border border-slate-200 bg-slate-900 min-h-[150px] sm:min-h-[180px] flex flex-col justify-end text-white p-5 sm:p-6">
        <img
          src={category.imageUrl}
          alt={category.nameAr}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Rich gradient overlay for high contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/60 to-slate-900/20" />

        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {category.nameEn && (
              <span className="text-[11px] font-mono tracking-wider font-bold uppercase bg-emerald-500/80 text-white px-2.5 py-0.5 rounded-md backdrop-blur-xs border border-white/20">
                {category.nameEn}
              </span>
            )}
            {activeMissingForCategory.length > 0 && (
              <span className="text-[11px] font-bold bg-rose-600 text-white px-2.5 py-0.5 rounded-md shadow-xs border border-white/20 animate-pulse">
                {activeMissingForCategory.length} نواقص مطلوبة حالياً
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black drop-shadow-md text-white">
            {category.nameAr}
          </h1>

          <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed drop-shadow-sm">
            {category.description}
          </p>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-200 font-medium">
            <div className="flex items-center space-x-1.5 space-x-reverse bg-black/40 px-2.5 py-1 rounded-lg backdrop-blur-xs border border-white/10">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span>{categoryProducts.length} صنف محفوظ</span>
            </div>
            {subcategories.length > 0 && (
              <div className="flex items-center space-x-1.5 space-x-reverse bg-black/40 px-2.5 py-1 rounded-lg backdrop-blur-xs border border-white/10">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>{subcategories.length} تصنيفات فرعية</span>
              </div>
            )}
            <div className="flex items-center space-x-1.5 space-x-reverse bg-black/40 px-2.5 py-1 rounded-lg backdrop-blur-xs border border-white/10">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{activeMissingForCategory.length} مطلوب شراؤها</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Instant Feedback Toast */}
      {toastMessage && (
        <div className="bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-700/25 border border-emerald-400 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Check className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-mono">
            مزامنة فورية
          </span>
        </div>
      )}

      {/* Quick Add Custom Item Section */}
      {canAdd && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Plus className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-800">
                إضافة طلب سريع لقائمة النواقص في ({category.nameAr})
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setCustomUrgency(customUrgency === "high" ? "normal" : "high")
              }
              className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all flex items-center space-x-1 space-x-reverse cursor-pointer ${
                customUrgency === "high"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{customUrgency === "high" ? "🚨 طلب عاجل جداً" : "طلب عادي"}</span>
            </button>
          </div>

          <form onSubmit={handleAddCustomMissing} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              placeholder={`اكتب اسم أي صنف أو غرض تريده في ${category.nameAr}...`}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-right"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
                placeholder="الكمية"
                className="w-24 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-center focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
              />
              <button
                type="submit"
                disabled={!customItemName.trim()}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 space-x-reverse shrink-0 ${
                  customItemName.trim()
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>إضافة للنواقص</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Catalog & Subcategories Section */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
        
        {/* Header & Quick Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>قائمة المنتجات والتصنيفات الفرعية ({categoryProducts.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              انقر على المنتج <strong className="text-emerald-700">نقرة واحدة</strong> للإضافة للنواقص ونقرة أخرى للحذف، أو انقر على <strong className="text-slate-800">نقاط الخيارات (⋮)</strong> للتعديل أو الحذف.
            </p>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={() => {
                setNewProductSubcat(selectedSubcategoryId !== "all" ? selectedSubcategoryId : subcategories[0]?.id || "");
                setIsAddCatalogProductOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>إضافة منتج جديد</span>
            </button>
          </div>
        </div>

        {/* Subcategories Filter Pills Bar (اللحوم / الدواجن / الأسماك / بقوليات / ألبان / إلخ) */}
        {subcategories.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span className="flex items-center space-x-1.5 space-x-reverse">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>التصنيفات الفرعية في ({category.nameAr}):</span>
              </span>
              <span className="text-slate-400 font-normal text-[10px]">
                تصفية سريعة للأصناف
              </span>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
              <button
                onClick={() => setSelectedSubcategoryId("all")}
                className={`px-3.5 py-2 rounded-xl transition-all shrink-0 flex items-center space-x-1.5 space-x-reverse cursor-pointer ${
                  selectedSubcategoryId === "all"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>جميع الأصناف</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedSubcategoryId === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {category.commonItems.length}
                </span>
              </button>

              {subcategories.map((sub) => {
                const isSelected = selectedSubcategoryId === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubcategoryId(sub.id)}
                    className={`px-3.5 py-2 rounded-xl transition-all shrink-0 flex items-center space-x-1.5 space-x-reverse cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60"
                    }`}
                  >
                    <span>{sub.nameAr}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}>
                      {sub.items.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search & Status Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في أسماء المنتجات..."
              className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-right"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center space-x-1.5 space-x-reverse text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                filterMode === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              الكل ({filteredProducts.length})
            </button>
            <button
              onClick={() => setFilterMode("missing")}
              className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center space-x-1.5 space-x-reverse cursor-pointer ${
                filterMode === "missing"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <span>المطلوبة ({activeMissingForCategory.length})</span>
            </button>
            <button
              onClick={() => setFilterMode("available")}
              className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                filterMode === "available"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              المتوفرة
            </button>
          </div>
        </div>

        {/* Products Display: Either Grouped by Subcategory (when All is selected) or Unified Grid */}
        {subcategoryGroups && subcategoryGroups.length > 0 ? (
          <div className="space-y-6 pt-2">
            {subcategoryGroups.map((group) => (
              <div key={group.subcategory.id} className="space-y-2.5">
                {/* Subcategory Section Header */}
                <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                      {group.subcategory.nameAr}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {group.items.length} صنف
                  </span>
                </div>

                {/* Subcategory Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {group.items.map((item, idx) => renderProductCard(item, idx))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {filteredProducts.map((item, idx) => renderProductCard(item, idx))}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <p>لا توجد منتجات مطابقة للبحث أو التصنيف الفرعي المختار</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedSubcategoryId("all");
                setFilterMode("all");
              }}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition-colors text-[11px]"
            >
              إعادة ضبط الفلاتر
            </button>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* MODAL 1: 3-DOTS CONTEXT MENU (3 Clear Options)             */}
      {/* 1. Add/Remove Missing | 2. Edit Name | 3. Delete Product   */}
      {/* ========================================================== */}
      {activeProductMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 text-right">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5 space-x-reverse">
                <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                  {activeProductMenu.product.image_url ? (
                    <img
                      src={activeProductMenu.product.image_url}
                      alt={activeProductMenu.product.name_ar}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/app-logo.png";
                      }}
                    />
                  ) : (
                    <img src="/app-logo.png" alt="أيقونة" className="w-full h-full object-contain p-1" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-[200px]">
                    {activeProductMenu.product.name_ar}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    قسم: {category.nameAr}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveProductMenu(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* The 3 Required Options */}
            <div className="space-y-2">
              {/* Option 1: Add to / Remove from Missing */}
              {isItemMissing(activeProductMenu.product.name_ar) ? (
                <button
                  type="button"
                  onClick={() => handleToggleMissingFromMenu(activeProductMenu.product)}
                  className="w-full p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center space-x-2.5 space-x-reverse transition-colors cursor-pointer text-right"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
                    <MinusCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="block font-bold">١. إزالة من قائمة النواقص</span>
                    <span className="text-[10px] text-amber-700 font-normal">
                      الصنف مسجل حالياً في النواقص، انقر لإزالته
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleMissingFromMenu(activeProductMenu.product)}
                  className="w-full p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 text-xs font-bold flex items-center space-x-2.5 space-x-reverse transition-colors cursor-pointer text-right"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="block font-bold text-emerald-900">١. أضف للنواقص</span>
                    <span className="text-[10px] text-emerald-700 font-normal">
                      إدراج هذا الصنف فوراً في قائمة المشتريات والنواقص
                    </span>
                  </div>
                </button>
              )}

              {/* Option 2: Edit Product Name */}
              <button
                type="button"
                onClick={() => handleOpenEditFromMenu(activeProductMenu.product)}
                className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold flex items-center space-x-2.5 space-x-reverse transition-colors cursor-pointer text-right"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="block font-bold">٢. تعديل اسم المنتج</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    تغيير اسم الصنف أو نقله لتصنيف فرعي آخر
                  </span>
                </div>
              </button>

              {/* Option 3: Delete Product */}
              <button
                type="button"
                onClick={() => handleOpenDeleteFromMenu(activeProductMenu.product)}
                className="w-full p-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center space-x-2.5 space-x-reverse transition-colors cursor-pointer text-right"
              >
                <div className="w-8 h-8 rounded-xl bg-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="block font-bold">٣. حذف المنتج</span>
                  <span className="text-[10px] text-rose-600 font-normal">
                    حذف الصنف نهائياً من قائمة أصناف هذا القسم
                  </span>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveProductMenu(null)}
              className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: ADD NEW PRODUCT TO CATEGORY CATALOG               */}
      {/* ========================================================== */}
      {isAddCatalogProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateCatalogProduct}
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 text-right"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>إضافة منتج جديد لقسم: {category.nameAr}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCatalogProductOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Product Image Default Notice */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-white p-1 shadow-2xs border border-slate-200 shrink-0 flex items-center justify-center">
                <img src="/app-logo.png" alt="أيقونة" className="w-full h-full object-contain" />
              </div>
              <div className="text-[11px] text-slate-600 leading-tight">
                <strong className="block text-slate-900">أيقونة المنتج الافتراضية:</strong>
                تعتمد جميع المنتجات شعار التطبيق الرسمي كصورة افتراضية موحدة ومثبتة.
              </div>
            </div>

            {/* Product Name Input */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                اسم المنتج الجديد *
              </label>
              <input
                type="text"
                required
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="مثال: لحم ضاني، دجاج رومي، سمك سلمون..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            {/* Subcategory Selection */}
            {subcategories.length > 0 && (
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  التصنيف الفرعي التابع له:
                </label>
                <select
                  value={newProductSubcat}
                  onChange={(e) => setNewProductSubcat(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="">-- عام (بدون تصنيف فرعي محدد) --</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Checkbox: Also add to active missing list right away */}
            <label className="flex items-center space-x-2 space-x-reverse text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={newProductAlsoMissing}
                onChange={(e) => setNewProductAlsoMissing(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>إضافة هذا المنتج فوراً أيضاً إلى قائمة النواقص الحالية</span>
            </label>

            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddCatalogProductOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!newProductName.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 space-x-reverse cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>حفظ المنتج في القائمة</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 3: EDIT PRODUCT NAME & SUBCATEGORY                   */}
      {/* ========================================================== */}
      {productToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveProductEdit}
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 text-right"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                <span>تعديل اسم المنتج</span>
              </h3>
              <button
                type="button"
                onClick={() => setProductToEdit(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                اسم المنتج
              </label>
              <input
                type="text"
                required
                value={productToEdit.newName}
                onChange={(e) =>
                  setProductToEdit({ ...productToEdit, newName: e.target.value })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            {subcategories.length > 0 && (
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  التصنيف الفرعي
                </label>
                <select
                  value={productToEdit.subcategoryId}
                  onChange={(e) =>
                    setProductToEdit({ ...productToEdit, subcategoryId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="">-- عام --</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProductToEdit(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!productToEdit.newName.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 space-x-reverse cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>حفظ التعديل</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 4: DELETE PRODUCT CONFIRMATION                       */}
      {/* ========================================================== */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 text-right">
            <div className="flex items-center space-x-2.5 space-x-reverse text-rose-600">
              <div className="w-9 h-9 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                حذف منتج من القائمة
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف الصنف <strong className="text-rose-600 font-bold">"{productToDelete.name_ar}"</strong> نهائياً من قائمة أصناف هذا القسم؟
            </p>

            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 space-x-reverse cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

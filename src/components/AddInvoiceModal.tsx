import React, { useState, useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import { useApp } from "../context/AppContext";
import { CATEGORIES } from "../data/categories";
import { InvoiceProduct, MissingItem, HouseholdAddress } from "../types";
import {
  X,
  Plus,
  Trash2,
  Receipt,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Info,
  Check,
  Package,
  Truck,
} from "lucide-react";
import { DeliveryOrderModal } from "./DeliveryOrderModal";
import { deliveryService } from "../lib/deliveryService";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

interface DistributionCalculation {
  isValid: boolean;
  errorMessage?: string;
  distributedProducts: InvoiceProduct[];
  finalTotal: number;
  sumSpecified: number;
  remainingToDistribute: number;
  unspecifiedCount: number;
  autoDistributedPricePerItem: number;
}

export const AddInvoiceModal: React.FC = () => {
  const {
    isAddInvoiceModalOpen,
    setIsAddInvoiceModalOpen,
    missingItems,
    categories,
    addInvoice,
    budgetConfig,
    activeRole,
    household,
    supabaseUser,
  } = useApp();

  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [invoiceTitle, setInvoiceTitle] = useState<string>("");
  const [totalPriceInput, setTotalPriceInput] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash">("cash");
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState<boolean>(false);

  // Products in the current invoice
  const [products, setProducts] = useState<InvoiceProduct[]>([]);

  // Selected missing items IDs (to mark as completed)
  const [selectedMissingIds, setSelectedMissingIds] = useState<string[]>([]);

  // Active (uncompleted) missing items
  const activeMissing = useMemo(
    () => missingItems.filter((i) => !i.completed),
    [missingItems]
  );

  // Requirement 1 & 3: Group missing items by their original category
  const groupedMissingItems = useMemo(() => {
    const groupsMap = new Map<
      string,
      { categoryId: string; categoryArabic: string; items: MissingItem[] }
    >();

    for (const item of activeMissing) {
      const catKey = item.category || "other";
      if (!groupsMap.has(catKey)) {
        groupsMap.set(catKey, {
          categoryId: catKey,
          categoryArabic: item.categoryArabic || "أخرى",
          items: [],
        });
      }
      groupsMap.get(catKey)!.items.push(item);
    }

    return Array.from(groupsMap.values());
  }, [activeMissing]);

  // Requirement 8: Reset form state whenever modal is opened
  useEffect(() => {
    if (isAddInvoiceModalOpen) {
      setDate(new Date().toISOString().split("T")[0]);
      setInvoiceTitle("");
      setTotalPriceInput("");
      setProducts([]);
      setSelectedMissingIds([]);
      setFormError(null);
      setPaymentMethod("card");
    }
  }, [isAddInvoiceModalOpen]);

  // Requirement 2: Toggle missing item selection using fixed ID
  const toggleMissingSelection = (item: MissingItem) => {
    setFormError(null);
    const isSelected = selectedMissingIds.includes(item.id);

    if (isSelected) {
      // Uncheck: Remove fixed ID from selected list
      setSelectedMissingIds((prev) => prev.filter((id) => id !== item.id));
      // Requirement 2: Remove product from invoice using fixed ID, not just name
      setProducts((prev) =>
        prev.filter((p) => p.missingItemId !== item.id && p.id !== item.id)
      );
    } else {
      // Check: Add fixed ID to selected list
      setSelectedMissingIds((prev) => [...prev, item.id]);
      // Add product to invoice linked by fixed ID, preserving original category
      setProducts((prev) => {
        if (prev.some((p) => p.missingItemId === item.id || p.id === item.id)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: item.id,
            missingItemId: item.id,
            name: item.name,
            quantity: item.quantity || "١",
            price: 0,
            category: item.category,
            categoryArabic: item.categoryArabic,
          },
        ];
      });
    }
  };

  // Requirement 4: Add product manually via dropdown of existing missing items (prevent duplicates)
  const handleDropdownSelectMissingItem = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) return;

    setFormError(null);
    const item = activeMissing.find((m) => m.id === selectedId);
    if (!item) return;

    // Check if already in products
    if (products.some((p) => p.missingItemId === item.id || p.id === item.id)) {
      e.target.value = "";
      return;
    }

    // Add to products linked by missingItemId with original category
    setProducts((prev) => [
      ...prev,
      {
        id: item.id,
        missingItemId: item.id,
        name: item.name,
        quantity: item.quantity || "١",
        price: 0,
        category: item.category,
        categoryArabic: item.categoryArabic,
      },
    ]);

    // Also mark as selected
    if (!selectedMissingIds.includes(item.id)) {
      setSelectedMissingIds((prev) => [...prev, item.id]);
    }

    // Reset select to default prompt
    e.target.value = "";
  };

  // Remove a product row from the invoice
  const handleRemoveProductRow = (index: number) => {
    setFormError(null);
    const prodToRemove = products[index];
    if (prodToRemove) {
      const fixedId = prodToRemove.missingItemId || prodToRemove.id;
      // Remove from products
      setProducts((prev) => prev.filter((_, i) => i !== index));
      // Also uncheck from selected missing items
      setSelectedMissingIds((prev) =>
        prev.filter((id) => id !== fixedId && id !== prodToRemove.id)
      );
    }
  };

  // Change a product's quantity or price
  const handleProductChange = (
    index: number,
    field: "quantity" | "price",
    value: string | number
  ) => {
    setFormError(null);
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  // Requirement 6: Price distribution calculation engine
  const distributionCalc: DistributionCalculation = useMemo(() => {
    if (products.length === 0) {
      return {
        isValid: false,
        errorMessage: "يرجى إضافة صنف واحد على الأقل إلى الفاتورة",
        distributedProducts: [],
        finalTotal: 0,
        sumSpecified: 0,
        remainingToDistribute: 0,
        unspecifiedCount: 0,
        autoDistributedPricePerItem: 0,
      };
    }

    const parsedTotal = parseFloat(totalPriceInput);
    const hasEnteredTotal = !isNaN(parsedTotal) && parsedTotal > 0;

    const specified = products.filter((p) => Number(p.price) > 0);
    const unspecified = products.filter((p) => !p.price || Number(p.price) <= 0);
    const sumSpecified = specified.reduce((sum, p) => sum + Number(p.price), 0);

    // Scenario A: User entered an overall invoice total
    if (hasEnteredTotal) {
      const finalTotal = parsedTotal;

      // Rule: "إذا تجاوز مجموع الأسعار المحددة إجمالي الفاتورة، امنع إتمام العملية واعرض رسالة واضحة."
      if (sumSpecified > finalTotal) {
        return {
          isValid: false,
          errorMessage: `مجموع الأسعار المحددة (${sumSpecified.toFixed(2)} ${budgetConfig.currency}) يتجاوز إجمالي الفاتورة (${finalTotal.toFixed(2)} ${budgetConfig.currency}).`,
          distributedProducts: products,
          finalTotal,
          sumSpecified,
          remainingToDistribute: finalTotal - sumSpecified,
          unspecifiedCount: unspecified.length,
          autoDistributedPricePerItem: 0,
        };
      }

      // Rule: "إذا حُددت أسعار جميع المنتجات، يجب أن يساوي مجموعها إجمالي الفاتورة."
      if (unspecified.length === 0) {
        const diff = Math.abs(sumSpecified - finalTotal);
        if (diff > 0.05) {
          return {
            isValid: false,
            errorMessage: `مجموع أسعار المنتجات (${sumSpecified.toFixed(2)} ${budgetConfig.currency}) يجب أن يساوي إجمالي الفاتورة (${finalTotal.toFixed(2)} ${budgetConfig.currency}).`,
            distributedProducts: products,
            finalTotal,
            sumSpecified,
            remainingToDistribute: finalTotal - sumSpecified,
            unspecifiedCount: 0,
            autoDistributedPricePerItem: 0,
          };
        }

        return {
          isValid: true,
          distributedProducts: products.map((p) => ({
            ...p,
            price: Number(p.price),
          })),
          finalTotal,
          sumSpecified,
          remainingToDistribute: 0,
          unspecifiedCount: 0,
          autoDistributedPricePerItem: 0,
        };
      }

      // Rule: "إذا لم يحدد المستخدم أسعار المنتجات، وزّع الإجمالي بالتساوي على المنتجات."
      // Rule: "إذا حدد أسعار بعض المنتجات، احسب المتبقي من الإجمالي ووزعه بالتساوي على المنتجات التي بلا سعر."
      const remaining = finalTotal - sumSpecified;
      const perItem = remaining / unspecified.length;
      const roundedPerItem = Math.floor(perItem * 100) / 100;

      let remainderTracker = remaining;
      const lastUnspecifiedId = unspecified[unspecified.length - 1].id;

      const distributed = products.map((p) => {
        if (Number(p.price) > 0) {
          return { ...p, price: Number(p.price) };
        }
        if (p.id === lastUnspecifiedId) {
          const finalPrice = Math.max(0, Math.round(remainderTracker * 100) / 100);
          return { ...p, price: finalPrice };
        } else {
          remainderTracker -= roundedPerItem;
          return { ...p, price: roundedPerItem };
        }
      });

      return {
        isValid: true,
        distributedProducts: distributed,
        finalTotal,
        sumSpecified,
        remainingToDistribute: remaining,
        unspecifiedCount: unspecified.length,
        autoDistributedPricePerItem: Math.round(perItem * 100) / 100,
      };
    }

    // Scenario B: User did NOT enter overall total (Total is optional!)
    // Calculate total as the sum of specified items; unspecified items keep 0.
    return {
      isValid: true,
      distributedProducts: products.map((p) => ({
        ...p,
        price: Number(p.price) || 0,
      })),
      finalTotal: sumSpecified,
      sumSpecified,
      remainingToDistribute: 0,
      unspecifiedCount: unspecified.length,
      autoDistributedPricePerItem: 0,
    };
  }, [products, totalPriceInput, budgetConfig.currency]);

  // Handle complete purchase and save invoice
  const handleCompletePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (products.length === 0) {
      setFormError("يرجى اختيار صنف واحد على الأقل من النواقص لإضافته إلى الفاتورة.");
      return;
    }

    if (!distributionCalc.isValid) {
      setFormError(
        distributionCalc.errorMessage ||
          "يرجى التحقق من إجمالي الفاتورة وتوزيع الأسعار."
      );
      return;
    }

    const finalProducts = distributionCalc.distributedProducts;
    const finalTotal = distributionCalc.finalTotal;

    // Determine category info
    const primaryCat = finalProducts[0]?.category || "supermarket";
    const primaryCatArabic =
      finalProducts[0]?.categoryArabic ||
      categories.find((c) => c.id === primaryCat)?.nameAr ||
      CATEGORIES.find((c) => c.id === primaryCat)?.nameAr ||
      "مشتريات متنوعة";

    // Requirement 7 & 11: Save invoice with complete missing items and household_id
    const result = addInvoice(
      {
        date: date || new Date().toISOString().split("T")[0],
        category: primaryCat,
        categoryArabic: primaryCatArabic,
        products: finalProducts,
        totalPrice: finalTotal,
        notes:
          invoiceTitle.trim() ||
          `فاتورة مشتريات (${finalProducts.length} ${finalProducts.length === 1 ? "صنف" : "أصناف"})`,
        registeredBy:
          activeRole === "admin" ? "المسؤول (الأب)" : "هاتف المنزل",
        paymentMethod,
        purchasedMissingItemIds: selectedMissingIds,
      },
      selectedMissingIds
    );

    // Requirement 7: If save failed, DO NOT clear user inputs!
    if (result && !result.success) {
      setFormError(result.message || "فشل حفظ الفاتورة، يرجى إعادة المحاولة.");
      return;
    }

    // Requirement 7: Upon success ONLY, clear states and prepare blank invoice
    setProducts([]);
    setTotalPriceInput("");
    setSelectedMissingIds([]);
    setInvoiceTitle("");
    setFormError(null);

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (_) {}

    setIsAddInvoiceModalOpen(false);
  };

  // Requirement 2: Open delivery modal after validation
  const handleOpenDeliveryModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setFormError(null);

    if (products.length === 0) {
      setFormError("يرجى اختيار صنف واحد على الأقل من النواقص أو إضافة منتجات للفاتورة أولاً.");
      return;
    }

    if (!distributionCalc.isValid) {
      setFormError(
        distributionCalc.errorMessage ||
          "يرجى التحقق من إجمالي الفاتورة وتوزيع الأسعار قبل طلب التوصيل."
      );
      return;
    }

    setIsDeliveryModalOpen(true);
  };

  // Requirement 2: Confirm delivery order
  const handleConfirmDeliveryOrder = async (deliveryData: {
    addressId: string;
    deliveryNotes: string;
    deliveryFee: number;
    addressSnapshot: HouseholdAddress;
  }): Promise<{ success: boolean; message?: string }> => {
    if (!household?.id) {
      return { success: false, message: "معرّف المنزل غير متاح. يرجى التأكد من اختيار المنزل." };
    }

    const finalProducts = distributionCalc.distributedProducts;
    const finalTotal = distributionCalc.finalTotal;

    const primaryCat = finalProducts[0]?.category || "supermarket";
    const primaryCatArabic =
      finalProducts[0]?.categoryArabic ||
      categories.find((c) => c.id === primaryCat)?.nameAr ||
      CATEGORIES.find((c) => c.id === primaryCat)?.nameAr ||
      "مشتريات متنوعة";

    // 1. Create base invoice
    const invResult = addInvoice(
      {
        date: date || new Date().toISOString().split("T")[0],
        category: primaryCat,
        categoryArabic: primaryCatArabic,
        products: finalProducts,
        totalPrice: finalTotal,
        notes: deliveryData.deliveryNotes?.trim()
          ? `طلب توصيل للمنزل: ${deliveryData.deliveryNotes.trim()}`
          : (invoiceTitle.trim() || `فاتورة مشتريات مع توصيل للمنزل`),
        registeredBy:
          activeRole === "admin" ? "المسؤول (الأب)" : "هاتف المنزل",
        paymentMethod,
        purchasedMissingItemIds: selectedMissingIds,
      },
      selectedMissingIds
    );

    if (!invResult.success) {
      return { success: false, message: invResult.message || "فشل حفظ الفاتورة الأساسية" };
    }

    // Direct upsert to Supabase invoices if configured to ensure foreign key readiness
    if (isSupabaseConfigured() && invResult.invoice) {
      try {
        await supabase.from("invoices").upsert({
          id: invResult.invoice.id,
          household_id: household.id,
          invoice_number: invResult.invoice.invoiceNumber,
          date: invResult.invoice.date,
          category: invResult.invoice.category,
          category_arabic: invResult.invoice.categoryArabic,
          products: invResult.invoice.products,
          total_price: Number(invResult.invoice.totalPrice) || 0,
          notes: invResult.invoice.notes || "",
          registered_by: invResult.invoice.registeredBy || "المسؤول",
          payment_method: "cash",
        });
      } catch (upsertErr) {
        console.warn("[AddInvoiceModal] Invoice upsert notice:", upsertErr);
      }
    }

    // 2. Create delivery order linked to household and invoice
    const orderRes = await deliveryService.createOrder({
      householdId: household.id,
      addressId: deliveryData.addressId,
      addressSnapshot: deliveryData.addressSnapshot,
      invoiceId: invResult.invoiceId,
      deliveryNotes: deliveryData.deliveryNotes,
      items: finalProducts.map((p) => ({
        product_id: p.id || p.missingItemId || null,
        product_name: p.name,
        category_id: p.category || null,
        category_name: p.categoryArabic || null,
        quantity: p.quantity || "١",
        unit_price: Number(p.price) || 0,
        total_price: Number(p.price) || 0,
      })),
      userId: supabaseUser?.id,
    });

    if (!orderRes.success) {
      return { success: false, message: orderRes.message || "فشل تسجيل طلب التوصيل" };
    }

    // 3. Clean up modal state upon complete success
    setProducts([]);
    setTotalPriceInput("");
    setSelectedMissingIds([]);
    setInvoiceTitle("");
    setFormError(null);
    setIsDeliveryModalOpen(false);
    setIsAddInvoiceModalOpen(false);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (_) {}

    // Dispatch event to refresh orders in PurchasesView
    window.dispatchEvent(new CustomEvent("delivery-order-created"));

    return { success: true };
  };

  // Available missing items that haven't been added to the invoice yet
  const unselectedMissingItems = activeMissing.filter(
    (m) => !products.some((p) => p.missingItemId === m.id || p.id === m.id)
  );

  if (!isAddInvoiceModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col text-right overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-3 space-x-reverse min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                إضافة فاتورة مشتريات جديدة
              </h2>
              <p className="text-xs text-slate-500 truncate">
                تعليم النواقص المشتراة وتوزيع التكلفة على الميزانية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddInvoiceModalOpen(false)}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 transition-colors shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body (Scrollable, mobile-responsive, no horizontal overflow) */}
        <form
          onSubmit={handleCompletePurchase}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 w-full"
        >
          {/* Error Banner */}
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center space-x-2 space-x-reverse animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="flex-1">{formError}</span>
            </div>
          )}

          {/* Row 1: Date & Store Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                تاريخ الفاتورة
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                اسم المتجر / وصف الفاتورة (اختياري)
              </label>
              <input
                type="text"
                value={invoiceTitle}
                onChange={(e) => setInvoiceTitle(e.target.value)}
                placeholder="مثال: سوبرماركت، عطارة، صيدلية..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Section 1: Requirement 1 & 3: Grouped Missing Items to check */}
          <div className="bg-amber-50/70 p-3 sm:p-3.5 rounded-2xl border border-amber-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 block">
                قائمة النواقص المشتراة (مجمعة حسب أقسامها الأصلية):
              </span>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {selectedMissingIds.length} محددة
              </span>
            </div>

            {activeMissing.length === 0 ? (
              <p className="text-xs text-amber-800/80 py-1">
                لا توجد نواقص غير مكتملة حالياً في قائمة الطلبات.
              </p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5">
                {groupedMissingItems.map((group) => (
                  <div
                    key={group.categoryId}
                    className="bg-white/90 p-2.5 rounded-xl border border-amber-200/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        {group.categoryArabic}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">
                        {group.items.length} صنف
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((item) => {
                        const isSelected = selectedMissingIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleMissingSelection(item)}
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all flex items-center space-x-1.5 space-x-reverse ${
                              isSelected
                                ? "bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300"
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                                isSelected
                                  ? "bg-white text-emerald-700 border-white"
                                  : "bg-white border-slate-300"
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </span>
                            <span>{item.name}</span>
                            {item.quantity && (
                              <span
                                className={`text-[10px] ${
                                  isSelected ? "text-emerald-100" : "text-slate-400"
                                }`}
                              >
                                ({item.quantity})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Requirement 4: Add Product manually via Dropdown (no free text) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              إضافة صنف من النواقص إلى الفاتورة:
            </label>
            <div className="relative">
              <select
                onChange={handleDropdownSelectMissingItem}
                defaultValue=""
                disabled={unselectedMissingItems.length === 0}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="" disabled>
                  {unselectedMissingItems.length > 0
                    ? "-- اختر صنفاً من النواقص لإضافته للفاتورة --"
                    : activeMissing.length === 0
                    ? "لا توجد نواقص غير مكتملة حالياً"
                    : "جميع النواقص مضافة بالفعل إلى الفاتورة"}
                </option>
                {unselectedMissingItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.categoryArabic}) - الكمية: {item.quantity || "١"}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[11px] text-slate-400 block">
              يتم اختيار المنتجات حصرياً من قائمة النواقص لمنع التكرار وربطها بالقسم الأصلي.
            </span>
          </div>

          {/* Section 3: Requirement 5: Mobile-Friendly Product Rows (No overflow) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                الأصناف المضافة في الفاتورة ({products.length}):
              </label>
              {products.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setProducts([]);
                    setSelectedMissingIds([]);
                  }}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold"
                >
                  مسح الكل
                </button>
              )}
            </div>

            {products.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500 space-y-1">
                <Package className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <p className="font-semibold text-slate-700">
                  لم يتم إضافة أي صنف للفاتورة بعد
                </p>
                <p className="text-[11px] text-slate-400">
                  حدد النواقص من الأعلى أو اختر صنفاً من القائمة المنسدلة
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {products.map((prod, idx) => (
                  <div
                    key={prod.id}
                    className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200 space-y-2 w-full overflow-hidden"
                  >
                    {/* Item Name, Category Badge & Delete Button */}
                    <div className="flex items-center justify-between gap-2 w-full min-w-0">
                      <div className="flex items-center space-x-2 space-x-reverse min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                          {idx + 1}
                        </span>
                        <span
                          className="font-bold text-xs sm:text-sm text-slate-900 truncate"
                          title={prod.name}
                        >
                          {prod.name}
                        </span>
                        {prod.categoryArabic && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                            {prod.categoryArabic}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveProductRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        title="حذف من الفاتورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity & Price Inputs */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                          الكمية
                        </label>
                        <input
                          type="text"
                          value={prod.quantity}
                          onChange={(e) =>
                            handleProductChange(idx, "quantity", e.target.value)
                          }
                          placeholder="١"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 text-center"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                          السعر ({budgetConfig.currency})
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={
                            prod.price === 0 || prod.price === undefined
                              ? ""
                              : prod.price
                          }
                          onChange={(e) => {
                            const val =
                              e.target.value === ""
                                ? 0
                                : parseFloat(e.target.value);
                            handleProductChange(
                              idx,
                              "price",
                              isNaN(val) ? 0 : val
                            );
                          }}
                          placeholder="تلقائي"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Requirement 6: Total Price & Live Distribution Engine */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  إجمالي الفاتورة ({budgetConfig.currency}){" "}
                  <span className="text-slate-400 font-normal">(اختياري)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={totalPriceInput}
                  onChange={(e) => {
                    setFormError(null);
                    setTotalPriceInput(e.target.value);
                  }}
                  placeholder={
                    distributionCalc.sumSpecified > 0
                      ? `اختياري - مجموع الأصناف: ${distributionCalc.sumSpecified.toFixed(2)}`
                      : "اختياري - أدخل إجمالي الفاتورة إن وجد"
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  طريقة الدفع
                </label>
                <div className="py-2.5 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-center space-x-1.5 space-x-reverse shadow-2xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 ml-1.5 shrink-0" />
                  <span>كاش (نقداً)</span>
                </div>
              </div>
            </div>

            {/* Live Distribution Helper & Status Message */}
            {products.length > 0 && (
              <div className="text-xs rounded-xl p-3 border transition-all">
                {distributionCalc.unspecifiedCount > 0 &&
                parseFloat(totalPriceInput) > 0 &&
                distributionCalc.remainingToDistribute >= 0 ? (
                  <div className="bg-emerald-50 text-emerald-900 border-emerald-200 p-2.5 rounded-lg flex items-start space-x-2 space-x-reverse">
                    <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold">
                        توزيع تلقائي للمتبقي:
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        سيتم توزيع {distributionCalc.remainingToDistribute.toFixed(2)}{" "}
                        {budgetConfig.currency} بالتساوي على{" "}
                        {distributionCalc.unspecifiedCount} أصناف بلا سعر (
                        {distributionCalc.autoDistributedPricePerItem.toFixed(2)}{" "}
                        {budgetConfig.currency} لكل صنف).
                      </p>
                    </div>
                  </div>
                ) : distributionCalc.sumSpecified > 0 &&
                  parseFloat(totalPriceInput) > 0 &&
                  distributionCalc.sumSpecified > parseFloat(totalPriceInput) ? (
                  <div className="bg-rose-50 text-rose-800 border-rose-200 p-2.5 rounded-lg flex items-start space-x-2 space-x-reverse">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-bold">
                      مجموع الأسعار المحددة ({distributionCalc.sumSpecified.toFixed(2)}{" "}
                      {budgetConfig.currency}) يتجاوز إجمالي الفاتورة (
                      {parseFloat(totalPriceInput).toFixed(2)} {budgetConfig.currency}).
                    </span>
                  </div>
                ) : distributionCalc.unspecifiedCount === 0 &&
                  parseFloat(totalPriceInput) > 0 &&
                  Math.abs(distributionCalc.sumSpecified - parseFloat(totalPriceInput)) >
                    0.05 ? (
                  <div className="bg-amber-50 text-amber-900 border-amber-200 p-2.5 rounded-lg flex items-start space-x-2 space-x-reverse">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-semibold">
                      مجموع أسعار المنتجات ({distributionCalc.sumSpecified.toFixed(2)}{" "}
                      {budgetConfig.currency}) لا يطابق إجمالي الفاتورة (
                      {parseFloat(totalPriceInput).toFixed(2)} {budgetConfig.currency}).
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      الأصناف المحددة بسعر: {products.length - distributionCalc.unspecifiedCount} من {products.length}
                    </span>
                    <span className="font-bold font-mono">
                      مجموع محدد: {distributionCalc.sumSpecified.toFixed(2)} {budgetConfig.currency}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 5: Requirement 1 & 2: Submit Purchase and Delivery Order Buttons */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="submit"
              disabled={products.length === 0}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-1.5 space-x-reverse transition-all"
            >
              <CheckCircle className="w-4 h-4 text-emerald-200 shrink-0 ml-1.5" />
              <span>إتمام الشراء وحفظ الفاتورة</span>
            </button>

            <button
              type="button"
              onClick={handleOpenDeliveryModal}
              disabled={products.length === 0}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center justify-center space-x-1.5 space-x-reverse transition-all"
            >
              <Truck className="w-4 h-4 text-blue-200 shrink-0 ml-1.5" />
              <span>التوصيل للمنزل</span>
            </button>
          </div>
        </form>
      </div>

      {/* Requirement 2: Delivery Order Modal Flow */}
      <DeliveryOrderModal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        products={distributionCalc.distributedProducts}
        subtotal={distributionCalc.finalTotal}
        onConfirm={handleConfirmDeliveryOrder}
      />
    </div>
  );
};

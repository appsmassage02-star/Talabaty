import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  RecurringOrder,
  RecurringOrderFrequency,
  RecurringOrderRequest,
  RecurringOrderRequestItem,
} from '../types';
import {
  Repeat,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Send,
  Truck,
  X,
  Calendar,
  Layers,
  ChevronRight,
  AlertCircle,
  ShoppingBag,
  Package,
  Edit3,
} from 'lucide-react';
import { deliveryService } from '../lib/deliveryService';

export const RecurringOrdersModal: React.FC = () => {
  const {
    isRecurringOrdersModalOpen,
    setIsRecurringOrdersModalOpen,
    recurringOrders,
    createRecurringOrder,
    deleteRecurringOrder,
    orderRequests,
    createOrderDraft,
    updateDraftItem,
    approveDraftRequest,
    rejectDraftRequest,
    activeRole,
    household,
    supabaseUser,
    categories,
    householdProducts,
  } = useApp();

  // Tab: 'templates' | 'drafts'
  const [activeTab, setActiveTab] = useState<'templates' | 'drafts'>('templates');
  // Frequency filter: 'all' | 'daily' | 'weekly' | 'monthly'
  const [freqFilter, setFreqFilter] = useState<RecurringOrderFrequency | 'all'>('all');

  // New Template creation modal state
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateFreq, setNewTemplateFreq] = useState<RecurringOrderFrequency>('weekly');
  const [templateItems, setTemplateItems] = useState<
    Array<{
      product_name: string;
      category_id?: string;
      category_name?: string;
      quantity: string;
      unit: string;
      estimated_unit_price: number;
    }>
  >([]);

  // Item selector helpers inside template creation
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemQtyInput, setItemQtyInput] = useState('١');
  const [itemUnitInput, setItemUnitInput] = useState('قطعة');
  const [itemPriceInput, setItemPriceInput] = useState('0');

  // Active Draft being reviewed
  const [activeDraft, setActiveDraft] = useState<RecurringOrderRequest | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [userAddresses, setUserAddresses] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Load addresses when opening draft approval
  const handleOpenDraftReview = async (draft: RecurringOrderRequest) => {
    setActiveDraft(draft);
    if (activeRole === 'admin') {
      try {
        const addrs = await deliveryService.getHouseholdAddresses(
          household?.id || '',
          supabaseUser?.id
        );
        setUserAddresses(addrs);
        const def = addrs.find((a: any) => a.is_default);
        if (def) setSelectedAddressId(def.id);
        else if (addrs.length > 0) setSelectedAddressId(addrs[0].id);
      } catch (e) {
        console.warn('Error loading addresses:', e);
      }
    }
  };

  const filteredTemplates = useMemo(() => {
    if (freqFilter === 'all') return recurringOrders;
    return recurringOrders.filter((o) => o.frequency === freqFilter);
  }, [recurringOrders, freqFilter]);

  const pendingRequestsCount = useMemo(() => {
    return orderRequests.filter((r) => r.status === 'pending_review').length;
  }, [orderRequests]);

  if (!isRecurringOrdersModalOpen) return null;

  // Add Item to Template Form
  const handleAddItemToTemplate = () => {
    if (!itemNameInput.trim()) return;
    const cat = categories.find((c) => c.id === selectedCatId);
    setTemplateItems((prev) => [
      ...prev,
      {
        product_name: itemNameInput.trim(),
        category_id: selectedCatId || undefined,
        category_name: cat?.nameAr,
        quantity: itemQtyInput.trim() || '١',
        unit: itemUnitInput.trim() || 'قطعة',
        estimated_unit_price: Number(itemPriceInput) || 0,
      },
    ]);
    setItemNameInput('');
    setItemQtyInput('١');
    setItemPriceInput('0');
  };

  // Save New Template
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      showToast('يرجى كتابة اسم للطلب الدوري');
      return;
    }
    if (templateItems.length === 0) {
      showToast('يرجى إضافة صنف واحد على الأقل للطلب');
      return;
    }

    setIsProcessing(true);
    const res = await createRecurringOrder({
      name: newTemplateName.trim(),
      frequency: newTemplateFreq,
      items: templateItems,
    });
    setIsProcessing(false);

    if (res.success) {
      showToast('تم حفظ الطلب الدوري بنجاح!');
      setIsCreatingTemplate(false);
      setNewTemplateName('');
      setTemplateItems([]);
    } else {
      showToast(res.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  // Order Now (Instant Temporary Draft creation)
  const handleOrderNow = async (order: RecurringOrder) => {
    setIsProcessing(true);
    const res = await createOrderDraft(order);
    setIsProcessing(false);

    if (res.success && res.request) {
      showToast('تم إنشاء مسودة الطلب للمراجعة والتعديل');
      setActiveTab('drafts');
      handleOpenDraftReview(res.request);
    } else {
      showToast(res.message || 'فشل إنشاء المسودة');
    }
  };

  // Approve Draft and Convert to Delivery
  const handleApproveDraft = async () => {
    if (!activeDraft) return;
    if (!selectedAddressId) {
      showToast('يرجى اختيار عنوان التوصيل');
      return;
    }

    setIsProcessing(true);
    const res = await approveDraftRequest(activeDraft.id, selectedAddressId, deliveryNotes);
    setIsProcessing(false);

    if (res.success) {
      showToast('تم اعتماد المسودة وتحويلها إلى طلب دليفري بنجاح!');
      setActiveDraft(null);
    } else {
      showToast(res.message || 'فشل اعتماد الطلب');
    }
  };

  return (
    <div
      id="recurring-orders-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none"
      dir="rtl"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                طلباتي — الطلبات الدورية والمسودات
              </h2>
              <p className="text-xs text-slate-500">
                إدارة طلبات المنزل المتكررة (يومي، أسبوعي، شهري) وتحويلها لمسودات طلب فورية
              </p>
            </div>
          </div>
          <button
            id="close-recurring-orders-modal-btn"
            onClick={() => setIsRecurringOrdersModalOpen(false)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold text-center animate-in fade-in">
            {toastMsg}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              id="recurring-tab-templates"
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              نماذج الطلبات ({recurringOrders.length})
            </button>
            <button
              id="recurring-tab-drafts"
              onClick={() => setActiveTab('drafts')}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'drafts'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>المسودات الحالية ({orderRequests.length})</span>
              {pendingRequestsCount > 0 && (
                <span className="mr-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold">
                  {pendingRequestsCount} بانتظار الاعتماد
                </span>
              )}
            </button>
          </div>

          {activeTab === 'templates' && (
            <button
              id="btn-create-recurring-template"
              onClick={() => setIsCreatingTemplate(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center space-x-1.5 space-x-reverse cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>طلب جديد</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: TEMPLATES */}
          {activeTab === 'templates' && !isCreatingTemplate && (
            <>
              {/* Frequency Filter Chips */}
              <div className="flex items-center space-x-1.5 space-x-reverse overflow-x-auto pb-1">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'daily', label: 'يومي' },
                  { id: 'weekly', label: 'أسبوعي' },
                  { id: 'monthly', label: 'شهري' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setFreqFilter(chip.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                      freqFilter === chip.id
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                    <Repeat className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">لا توجد طلبات دورية محفوظة</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    أنشئ قوائم دورية باحتياجات المنزل (مثل مستلزمات الإفطار الأسبوعية، أو طلبات السوبرماركت الشهرية) لتطلبها بضغطة زر واحدة!
                  </p>
                  <button
                    onClick={() => setIsCreatingTemplate(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    + إنشاء أول طلب دوري
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredTemplates.map((order) => {
                    const items = order.items || [];
                    const freqLabel =
                      order.frequency === 'daily'
                        ? 'يومي'
                        : order.frequency === 'weekly'
                        ? 'أسبوعي'
                        : 'شهري';
                    return (
                      <div
                        key={order.id}
                        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1">
                                تكرار {freqLabel}
                              </span>
                              <h4 className="text-sm font-bold text-slate-800">{order.name}</h4>
                            </div>
                            <button
                              title="حذف النموذج"
                              onClick={() => deleteRecurringOrder(order.id)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="mt-2.5 space-y-1">
                            <p className="text-[11px] text-slate-500 font-semibold">
                              الأصناف المشمولة ({items.length}):
                            </p>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                              {items.map((it, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px]"
                                >
                                  {it.product_name_snapshot} ({it.quantity} {it.unit})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <button
                            id={`btn-order-now-${order.id}`}
                            onClick={() => handleOrderNow(order)}
                            disabled={isProcessing}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 space-x-reverse cursor-pointer disabled:opacity-50"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>اطلب الآن (فتح مسودة الطلب)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* CREATE NEW TEMPLATE FORM */}
          {activeTab === 'templates' && isCreatingTemplate && (
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-800">إنشاء طلب دوري جديد</h3>
                <button
                  onClick={() => setIsCreatingTemplate(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الطلب</label>
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="مثال: طلبات الفطور الأسبوعية"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التكرار</label>
                  <select
                    value={newTemplateFreq}
                    onChange={(e) => setNewTemplateFreq(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-emerald-500 cursor-pointer"
                  >
                    <option value="daily">يومي</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="monthly">شهري</option>
                  </select>
                </div>
              </div>

              {/* Add Items Box */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-700">إضافة أصناف الطلب</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="col-span-2 sm:col-span-2">
                    <input
                      type="text"
                      value={itemNameInput}
                      onChange={(e) => setItemNameInput(e.target.value)}
                      placeholder="اسم المنتج (مثال: حليب، بيض...)"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={itemQtyInput}
                      onChange={(e) => setItemQtyInput(e.target.value)}
                      placeholder="الكمية (١)"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={itemUnitInput}
                      onChange={(e) => setItemUnitInput(e.target.value)}
                      placeholder="الوحدة (كرتونة/كجم)"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddItemToTemplate}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-1 space-x-reverse"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة الصنف للقائمة</span>
                  </button>
                </div>

                {/* Items preview table */}
                {templateItems.length > 0 && (
                  <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto">
                    {templateItems.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs border border-slate-100"
                      >
                        <span className="font-semibold text-slate-800">
                          {it.product_name}
                        </span>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="text-slate-500 text-[11px]">
                            {it.quantity} {it.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setTemplateItems((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 space-x-reverse">
                <button
                  type="button"
                  onClick={() => setIsCreatingTemplate(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleSaveTemplate}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  حفظ الطلب الدوري
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TEMPORARY ORDER DRAFTS */}
          {activeTab === 'drafts' && !activeDraft && (
            <div className="space-y-3">
              {orderRequests.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-700">لا توجد مسودات طلبات حالية</h3>
                  <p className="text-xs text-slate-500">
                    عند الضغط على "اطلب الآن" من أي طلب دوري، يتم إنشاء مسودة طلب هنا لتراجعها وتعدل كمياتها دون التأثير على الطلب الأصلي!
                  </p>
                </div>
              ) : (
                orderRequests.map((draft) => {
                  const isPending = draft.status === 'pending_review';
                  const isSubmitted = draft.status === 'submitted';
                  const isApproved = draft.status === 'approved';
                  const isRejected = draft.status === 'rejected';

                  const badgeClass = isApproved
                    ? 'bg-emerald-100 text-emerald-800'
                    : isPending
                    ? 'bg-amber-100 text-amber-800'
                    : isRejected
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-blue-100 text-blue-800';

                  const statusText = isApproved
                    ? 'تم الاعتماد والتوصيل'
                    : isPending
                    ? 'بانتظار موافقة المسؤول'
                    : isRejected
                    ? 'مرفوض'
                    : 'مسودة جاهزة';

                  return (
                    <div
                      key={draft.id}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}
                            >
                              {statusText}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              بواسطة: {draft.created_by_role === 'admin' ? 'المسؤول' : 'هاتف المنزل'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 mt-1">
                            مسودة طلب ({draft.items?.length || 0} أصناف)
                          </h4>
                        </div>
                        <button
                          id={`btn-review-draft-${draft.id}`}
                          onClick={() => handleOpenDraftReview(draft)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-1 space-x-reverse"
                        >
                          <span>مراجعة وتعديل</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {draft.notes && (
                        <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                          ملاحظات: {draft.notes}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ACTIVE DRAFT REVIEW SCREEN (Modify Items without affecting template) */}
          {activeTab === 'drafts' && activeDraft && (
            <div className="space-y-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    مراجعة مسودة الطلب وتعديل الكميات
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    يمكنك تعديل أو حذف أي صنف هنا دون المساس بنموذج الطلب الدوري الأصلي
                  </p>
                </div>
                <button
                  onClick={() => setActiveDraft(null)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  العودة للقائمة
                </button>
              </div>

              {/* Items in Draft */}
              <div className="space-y-2">
                {(activeDraft.items || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{item.product_name}</span>
                      {item.is_modified && (
                        <span className="mr-2 text-[10px] text-amber-600 font-semibold">
                          (معدل)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 space-x-reverse">
                      {/* Quantity Modifier */}
                      <div className="flex items-center space-x-1.5 space-x-reverse bg-slate-100 rounded-lg p-1">
                        <button
                          onClick={() => {
                            const cur = Number(item.quantity) || 1;
                            if (cur > 1) {
                              updateDraftItem(activeDraft.id, item.id, {
                                quantity: String(cur - 1),
                              });
                            }
                          }}
                          className="w-5 h-5 rounded-md bg-white text-slate-700 flex items-center justify-center font-bold"
                        >
                          -
                        </button>
                        <span className="font-bold px-1">{item.quantity}</span>
                        <button
                          onClick={() => {
                            const cur = Number(item.quantity) || 1;
                            updateDraftItem(activeDraft.id, item.id, {
                              quantity: String(cur + 1),
                            });
                          }}
                          className="w-5 h-5 rounded-md bg-white text-slate-700 flex items-center justify-center font-bold"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-slate-500 text-[11px]">{item.unit}</span>

                      {/* Remove item from this draft only */}
                      <button
                        title="إزالة من هذه المسودة فقط"
                        onClick={() =>
                          updateDraftItem(activeDraft.id, item.id, { is_deleted: true })
                        }
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Details & Actions */}
              {activeRole === 'admin' ? (
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-800 flex items-center space-x-1.5 space-x-reverse">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>تحويل المسودة إلى طلب توصيل للمنزل</span>
                  </h4>

                  {userAddresses.length > 0 ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        عنوان التوصيل
                      </label>
                      <select
                        value={selectedAddressId}
                        onChange={(e) => setSelectedAddressId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      >
                        {userAddresses.map((addr) => (
                          <option key={addr.id} value={addr.id}>
                            {addr.label || addr.street_address} - {addr.governorate}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
                      لم يتم تسجيل عناوين توصيل مسبقًا. سيتم استخدام العنوان المسجل في الإعدادات.
                    </p>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ملاحظات للمندوب (اختياري)
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="مثال: يرجى الاتصال قبل الوصول"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => rejectDraftRequest(activeDraft.id, 'رفض بواسطة المسؤول')}
                      className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-semibold"
                    >
                      إلغاء المسودة
                    </button>
                    <button
                      id="btn-approve-and-convert-delivery"
                      onClick={handleApproveDraft}
                      disabled={isProcessing}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center space-x-1.5 space-x-reverse"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>اعتماد وطلب التوصيل الآن</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Home Phone View */
                <div className="p-3.5 bg-white rounded-xl border border-blue-200 space-y-3">
                  <p className="text-xs text-slate-600">
                    بصفتك هاتف المنزل، يمكنك إرسال المسودة للمسؤول لاعتمادها وطلب التوصيل.
                  </p>
                  <button
                    id="btn-send-draft-to-admin"
                    onClick={() => {
                      showToast('تم إرسال المسودة بنجاح إلى المسؤول للمراجعة والاعتماد');
                      setActiveDraft(null);
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 space-x-reverse cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>إرسال الطلب للمسؤول للمراجعة والاعتماد</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

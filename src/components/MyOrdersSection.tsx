import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { deliveryService } from '../lib/deliveryService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { DeliveryOrder, DeliveryOrderStatus } from '../types';
import { DELIVERY_STATUS_MAP, formatOrderId, formatDateTimeAr } from '../utils/deliveryConstants';
import {
  Truck,
  Package,
  Calendar,
  MapPin,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Ban,
  HelpCircle,
  Archive,
} from 'lucide-react';

export const MyOrdersSection: React.FC = () => {
  const { household, supabaseUser, budgetConfig, invoices, updateInvoice, archivedMonths } = useApp();

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'current' | 'active' | 'archived'>('current');

  // Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<DeliveryOrder | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  // Fetch household orders
  const loadOrders = useCallback(async () => {
    if (!household?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await deliveryService.getHouseholdOrders(household.id, supabaseUser?.id);
      setOrders(data);

      // Auto-sync actual prices back to the linked invoice if driver completed shopping or delivery
      if (data && data.length > 0) {
        data.forEach((ord) => {
          if (
            ord.invoice_id &&
            ord.actual_items_total !== undefined &&
            ord.actual_items_total !== null &&
            ord.actual_items_total > 0 &&
            (ord.status === 'completed' || ord.status === 'shopping')
          ) {
            const inv = invoices.find((i) => i.id === ord.invoice_id);
            // Accounting Rule: invoice.totalPrice represents PRODUCTS ONLY. Delivery fee stays in delivery_orders.delivery_fee.
            const targetProductsTotal = Number(ord.actual_items_total);

            if (inv && (inv.totalPrice === 0 || inv.totalPrice !== targetProductsTotal)) {
              const updatedProducts = inv.products.map((p) => {
                const matchedItem = ord.items?.find(
                  (it) => it.product_id === p.id || it.product_name === p.name
                );
                if (matchedItem) {
                  return {
                    ...p,
                    price:
                      matchedItem.item_status === 'missing'
                        ? 0
                        : (matchedItem.actual_total_price !== undefined && matchedItem.actual_total_price !== null
                          ? Number(matchedItem.actual_total_price)
                          : Number(matchedItem.total_price) || 0),
                  };
                }
                return p;
              });

              updateInvoice(ord.invoice_id, {
                totalPrice: targetProductsTotal,
                products: updatedProducts,
              });
            }
          }
        });
      }
    } catch (err) {
      console.error('Error fetching household orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [household?.id, supabaseUser?.id, invoices, updateInvoice]);

  useEffect(() => {
    loadOrders();

    // Listen to custom event when new order is created locally
    const handleOrderCreated = () => {
      loadOrders();
    };

    window.addEventListener('delivery-order-created', handleOrderCreated);
    window.addEventListener('delivery-orders-archived', handleOrderCreated);

    // Subscribe to real-time order status updates in Supabase
    let channel: any = null;
    if (isSupabaseConfigured() && household?.id) {
      channel = supabase
        .channel(`household-orders-realtime-${household.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'delivery_orders',
            filter: `household_id=eq.${household.id}`,
          },
          () => {
            loadOrders();
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener('delivery-order-created', handleOrderCreated);
      window.removeEventListener('delivery-orders-archived', handleOrderCreated);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadOrders, household?.id]);

  const toggleExpand = (id: string) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  // Open cancellation modal
  const handleOpenCancelModal = (order: DeliveryOrder) => {
    setSelectedOrderForCancel(order);
    setCancellationReason('');
    setCancelError(null);
    setIsCancelModalOpen(true);
  };

  // Submit cancellation request (changes status to cancellation_pending, NOT cancelled directly)
  const handleSubmitCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelError(null);

    if (!selectedOrderForCancel) return;

    if (!cancellationReason.trim()) {
      setCancelError('يرجى كتابة سبب طلب الإلغاء (حقل إجباري)');
      return;
    }

    setIsSubmittingCancel(true);
    try {
      const res = await deliveryService.requestCancellation(
        selectedOrderForCancel.id,
        cancellationReason.trim(),
        household?.id,
        supabaseUser?.id
      );

      if (!res.success) {
        setCancelError(res.message || 'فشل تقديم طلب الإلغاء');
        setIsSubmittingCancel(false);
        return;
      }

      setCancelSuccessMsg('تم تقديم طلب الإلغاء للإدارة بنجاح. الحالة الآن: بانتظار موافقة الإدارة على الإلغاء');
      setIsCancelModalOpen(false);
      await loadOrders();
    } catch (err: any) {
      setCancelError(err.message || 'حدث خطأ غير متوقع أثناء طلب الإلغاء');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Set of archived invoice IDs from archivedMonths
  const archivedInvoiceIds = useMemo(() => {
    const set = new Set<string>();
    (archivedMonths || []).forEach((arch) => {
      (arch.invoices || []).forEach((inv) => set.add(inv.id));
    });
    return set;
  }, [archivedMonths]);

  // Set of explicitly archived order IDs from archivedMonths
  const archivedOrderIds = useMemo(() => {
    const set = new Set<string>();
    (archivedMonths || []).forEach((arch) => {
      (arch.deliveryOrders || []).forEach((ord) => set.add(ord.id));
    });
    return set;
  }, [archivedMonths]);

  // Helper to determine if an order is archived:
  // CRITICAL: Incomplete orders are NEVER archived!
  const isOrderArchived = useCallback(
    (order: DeliveryOrder): boolean => {
      // 1. Incomplete orders MUST NEVER BE ARCHIVED!
      const isIncomplete =
        order.status === 'pending_review' ||
        order.status === 'accepted' ||
        order.status === 'shopping' ||
        order.status === 'cancellation_pending';
      if (isIncomplete) return false;

      // 2. Explicit archive tag in delivery_notes
      if ((order.delivery_notes || '').includes('[ARCHIVED:')) return true;

      // 3. Linked to an archived invoice
      if (order.invoice_id && archivedInvoiceIds.has(order.invoice_id)) return true;

      // 4. In archivedOrderIds
      if (archivedOrderIds.has(order.id)) return true;

      // 5. If we have archived months, check if order was created before/at the archive timestamp
      if (archivedMonths && archivedMonths.length > 0) {
        if (order.created_at) {
          const orderTime = new Date(order.created_at).getTime();
          const isBeforeAnyArchive = archivedMonths.some((arch) => {
            if (!arch.archivedAt) return false;
            const archTime = new Date(arch.archivedAt).getTime();
            return orderTime <= archTime + 5000;
          });
          if (isBeforeAnyArchive) return true;
        }

        // If order's invoice is no longer in active invoices list, it belongs to the archived month
        if (order.invoice_id && !invoices.some((i) => i.id === order.invoice_id)) {
          return true;
        }
      }

      return false;
    },
    [archivedInvoiceIds, archivedOrderIds, archivedMonths, invoices]
  );

  // Partition orders into current month active orders vs archived past orders
  const currentMonthOrders = useMemo(() => {
    return orders.filter((o) => !isOrderArchived(o));
  }, [orders, isOrderArchived]);

  const archivedOrders = useMemo(() => {
    return orders.filter((o) => isOrderArchived(o));
  }, [orders, isOrderArchived]);

  const activeOrdersCount = currentMonthOrders.filter(
    (o) =>
      o.status === 'pending_review' ||
      o.status === 'accepted' ||
      o.status === 'shopping' ||
      o.status === 'cancellation_pending'
  ).length;

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'active') {
      return currentMonthOrders.filter(
        (o) =>
          o.status === 'pending_review' ||
          o.status === 'accepted' ||
          o.status === 'shopping' ||
          o.status === 'cancellation_pending'
      );
    }
    if (statusFilter === 'archived') {
      return archivedOrders;
    }
    // 'current' default: all current month orders
    return currentMonthOrders;
  }, [statusFilter, currentMonthOrders, archivedOrders]);

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Action Strip */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              {statusFilter === 'archived'
                ? `أرشيف طلبات التوصيل السابقة (${archivedOrders.length})`
                : `طلبات التوصيل للمنزل (${currentMonthOrders.length})`}
            </h3>
            <p className="text-[11px] text-slate-400">
              {statusFilter === 'archived'
                ? 'سجلات طلبات التوصيل المكتملة والمؤرشفة من الشهور السابقة'
                : 'متابعة حالة طلبات التوصيل الجارية للشهر الحالي والأسعار الفعلية'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadOrders()}
          disabled={isLoading}
          className="flex items-center space-x-1 space-x-reverse px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث الطلبات</span>
        </button>
      </div>

      {/* Filter Tabs Strip */}
      {orders.length > 0 && (
        <div className="flex items-center space-x-1.5 space-x-reverse bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setStatusFilter('current')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center space-x-1 space-x-reverse ${
              statusFilter === 'current'
                ? 'bg-white text-blue-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>طلبات الشهر الحالي</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 mr-1 font-mono">
              {currentMonthOrders.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center space-x-1 space-x-reverse ${
              statusFilter === 'active'
                ? 'bg-white text-blue-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>الطلبات الجارية</span>
            {activeOrdersCount > 0 ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 mr-1 font-black font-mono">
                {activeOrdersCount}
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 mr-1 font-mono">
                0
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('archived')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center space-x-1 space-x-reverse ${
              statusFilter === 'archived'
                ? 'bg-white text-emerald-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5 ml-1 text-emerald-600" />
            <span>أرشيف التوصيل</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 mr-1 font-black font-mono">
              {archivedOrders.length}
            </span>
          </button>
        </div>
      )}

      {/* Archived Banner when viewing archived past orders */}
      {statusFilter === 'archived' && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 font-bold">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Archive className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>سجلات طلبات التوصيل المكتملة والمؤرشفة من الشهور السابقة ({archivedOrders.length} طلب)</span>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg font-mono">
            مؤرشف وموثق
          </span>
        </div>
      )}

      {/* Success Banner */}
      {cancelSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2 space-x-reverse">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{cancelSuccessMsg}</span>
        </div>
      )}

      {/* Orders List */}
      {isLoading ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-bold">جاري تحميل سجل طلبات التوصيل...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
          <Truck className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">
            {orders.length === 0
              ? 'لا توجد طلبات توصيل مسجلة للمنزل'
              : statusFilter === 'current' && archivedOrders.length > 0
              ? 'لا توجد طلبات توصيل نشطة للشهر الحالي'
              : 'لا توجد طلبات تطابق هذا التصنيف'}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {orders.length === 0
              ? 'عند إضافة فاتورة مشتريات واختيار "التوصيل للمنزل"، ستظهر جميع تفاصيل الطلب وتحديثات حالته هنا.'
              : statusFilter === 'current' && archivedOrders.length > 0
              ? `تم أرشفة طلبات الشهور السابقة بنجاح (${archivedOrders.length} طلبات مؤرشفة). يمكنك استعراضها بالضغط أدناه.`
              : 'يمكنك اختيار تصنيف آخر لعرض الطلبات السابقة أو الجارية.'}
          </p>
          {statusFilter === 'current' && archivedOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('archived')}
              className="mt-2 inline-flex items-center space-x-1.5 space-x-reverse px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <Archive className="w-4 h-4 text-emerald-600" />
              <span>عرض أرشيف طلبات التوصيل ({archivedOrders.length})</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusConfig = DELIVERY_STATUS_MAP[order.status] || DELIVERY_STATUS_MAP.pending_review;
            const isExpanded = expandedOrderId === order.id;
            const canRequestCancel =
              order.status === 'pending_review' || order.status === 'accepted';
            const hasActualPrice =
              order.actual_total_amount !== undefined &&
              order.actual_total_amount !== null &&
              order.actual_total_amount > 0;
            const isArchived = isOrderArchived(order);

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Header Card */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-start sm:items-center space-x-3 space-x-reverse min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-1.5">
                        <span className="font-mono text-xs font-black text-slate-900">
                          {formatOrderId(order.id)}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center space-x-1 space-x-reverse text-[11px] font-black px-2.5 py-0.5 rounded-full border ${statusConfig.badgeBg} ${statusConfig.badgeText} ${statusConfig.badgeBorder}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                          <span>{statusConfig.label}</span>
                        </span>

                        {/* Archived Badge */}
                        {isArchived && (
                          <span className="inline-flex items-center space-x-1 space-x-reverse text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                            <Archive className="w-3 h-3 text-emerald-600" />
                            <span>مؤرشف</span>
                          </span>
                        )}

                        {/* Rejection Note in Header if Cancelled/Rejected */}
                        {order.status === 'cancelled' && (order.cancellation_decision_note || order.cancellation_reason) && (
                          <span className="inline-flex items-center space-x-1 space-x-reverse text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg font-bold">
                            <span>سبب الرفض:</span>
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">
                              {order.cancellation_decision_note || order.cancellation_reason}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 space-x-reverse text-[11px] text-slate-500 mt-1">
                        <span className="flex items-center space-x-1 space-x-reverse">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDateTimeAr(order.created_at)}</span>
                        </span>
                        <span>•</span>
                        <span>{order.items?.length || 0} أصناف</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Expand Icon */}
                  <div className="flex items-center justify-between sm:justify-end space-x-3 space-x-reverse shrink-0">
                    <div className="text-left sm:text-right">
                      {hasActualPrice ? (
                        <>
                          <div className="text-sm font-black text-emerald-700 font-mono">
                            {order.actual_total_amount?.toFixed(2)} {budgetConfig.currency}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-bold">
                            الفعلي: {order.actual_items_total?.toFixed(2)} + شحن: {order.delivery_fee?.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-black text-blue-700 font-mono">
                            {order.total_amount?.toFixed(2)} {budgetConfig.currency}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            مشتريات: {order.subtotal?.toFixed(2)} + توصيل: {order.delivery_fee?.toFixed(2)}
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3 bg-slate-50/40 text-xs">
                    {/* Status Explanation */}
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center space-x-2 space-x-reverse text-slate-600">
                      <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>{statusConfig.description}</span>
                    </div>

                    {/* Rejection / Cancellation details if present */}
                    {(order.status === 'cancelled' || order.cancellation_reason || order.cancellation_decision_note) && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1.5">
                        <div className="font-bold flex items-center space-x-1.5 space-x-reverse text-xs text-rose-900">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 ml-1" />
                          <span>
                            {order.status === 'cancelled' ? 'سبب الرفض / الإلغاء:' : 'تفاصيل طلب الإلغاء:'}
                          </span>
                        </div>
                        <p className="text-[12px] text-rose-800 leading-relaxed font-semibold pr-5">
                          {order.cancellation_decision_note || order.cancellation_reason || 'تم رفض أو إلغاء الطلب من قبل الإدارة.'}
                        </p>
                        {order.cancellation_decision_note && order.cancellation_reason && (
                          <div className="text-[11px] text-slate-700 mt-1 pt-1.5 border-t border-rose-200/80 pr-5">
                            <strong>ملاحظة إضافية:</strong> {order.cancellation_decision_note}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Linked Purchase Invoice Snapshot */}
                    {order.invoice_id && (
                      <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-center justify-between">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-blue-900 block">
                              فاتورة المشتريات الأصلية: #{order.invoice_id}
                            </span>
                            <span className="text-[10px] text-blue-700">
                              {order.status === 'completed'
                                ? 'تم توثيق وتحديث الفاتورة بالمصروفات الفعلية وأرشفتها بنجاح'
                                : 'الفاتورة مرتبطة بهذا الطلب وتُحدث فورياً عند الشراء والتوصيل'}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                          {order.status === 'completed' ? 'موثقة ومكتملة' : 'قيد المتابعة'}
                        </span>
                      </div>
                    )}

                    {/* Delivery Address Snapshot */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center space-x-1.5 space-x-reverse text-slate-800 font-bold">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>عنوان التوصيل:</span>
                      </div>
                      <div className="text-slate-700 space-y-0.5">
                        <p className="font-bold text-slate-800">
                          {order.customer_name}{' '}
                          <span dir="ltr" className="text-slate-500 text-[11px] font-mono">
                            ({order.customer_phone})
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {order.country}، {order.governorate_name}، {order.markaz_name} - {order.detailed_address}
                        </p>
                      </div>
                    </div>

                    {/* Delivery Notes */}
                    {order.delivery_notes && (
                      <div className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-xl text-amber-900 space-y-0.5">
                        <div className="font-bold flex items-center space-x-1 space-x-reverse text-[11px]">
                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                          <span>ملاحظات التوصيل:</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          {order.delivery_notes}
                        </p>
                      </div>
                    )}

                    {/* Products Table with Real Status and Actual Price */}
                    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-100/60 border-b border-slate-200 font-bold text-slate-700 flex items-center justify-between text-[11px]">
                        <span>المنتجات المطلوبة ({order.items?.length || 0})</span>
                        <span>السعر الفعلي</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {order.items?.map((item) => {
                          const isPurchased = item.item_status === 'purchased';
                          const isMissing = item.item_status === 'missing';
                          const displayPrice = isPurchased
                            ? (item.actual_total_price ?? item.total_price)
                            : item.total_price;

                          return (
                            <div
                              key={item.id}
                              className="px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5 space-x-reverse flex-wrap gap-1">
                                  <span className="font-bold text-slate-800 block">
                                    {item.product_name}
                                  </span>
                                  {isPurchased && (
                                    <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                      تم الشراء
                                    </span>
                                  )}
                                  {isMissing && (
                                    <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                      غير متوفر {item.missing_reason ? `(${item.missing_reason})` : ''}
                                    </span>
                                  )}
                                  {order.status === 'shopping' && !isPurchased && !isMissing && (
                                    <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 animate-pulse">
                                      قيد الشراء
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  الكمية: {item.quantity || '١'} {item.category_name ? `• ${item.category_name}` : ''}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-700">
                                {isMissing ? (
                                  <span className="line-through text-slate-400">0.00 {budgetConfig.currency}</span>
                                ) : (
                                  `${displayPrice?.toFixed(2)} ${budgetConfig.currency}`
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Totals Breakdown */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                      {hasActualPrice ? (
                        <>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>إجمالي المشتريات الفعلي (التي تم شراؤها):</span>
                            <span className="font-mono font-bold text-emerald-700">
                              {order.actual_items_total?.toFixed(2)} {budgetConfig.currency}
                            </span>
                          </div>
                          {order.subtotal > 0 && order.subtotal !== order.actual_items_total && (
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>(تقدير المشتريات المبدئي):</span>
                              <span className="font-mono">
                                {order.subtotal?.toFixed(2)} {budgetConfig.currency}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-slate-600">
                            <span>تكلفة التوصيل:</span>
                            <span className="font-mono font-bold text-slate-700">
                              +{order.delivery_fee?.toFixed(2)} {budgetConfig.currency}
                            </span>
                          </div>
                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-slate-900 font-black text-sm">
                            <span>الإجمالي النهائي الفعلي:</span>
                            <span className="font-mono text-emerald-700">
                              {order.actual_total_amount?.toFixed(2)} {budgetConfig.currency}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>إجمالي المنتجات (المقدر مبدئياً):</span>
                            <span className="font-mono font-bold">
                              {order.subtotal?.toFixed(2)} {budgetConfig.currency}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>تكلفة التوصيل:</span>
                            <span className="font-mono font-bold text-emerald-700">
                              +{order.delivery_fee?.toFixed(2)} {budgetConfig.currency}
                            </span>
                          </div>
                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-slate-900 font-black text-sm">
                            <span>الإجمالي النهائي المقدر:</span>
                            <span className="font-mono text-blue-700">
                              {order.total_amount?.toFixed(2)} {budgetConfig.currency}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Cancellation Action Button */}
                    {canRequestCancel && (
                      <div className="pt-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenCancelModal(order)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 space-x-reverse"
                        >
                          <Ban className="w-3.5 h-3.5 text-rose-600 ml-1" />
                          <span>طلب إلغاء الطلب</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Requirement 4: Cancellation Request Modal */}
      {isCancelModalOpen && selectedOrderForCancel && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-5 text-right space-y-4" dir="rtl">
            <div className="flex items-start space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-slate-900">
                  طلب إلغاء طلب التوصيل ({formatOrderId(selectedOrderForCancel.id)})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  سيتم إرسال طلب الإلغاء إلى الإدارة للمراجعة وتغيير الحالة إلى "بانتظار موافقة الإدارة على الإلغاء".
                </p>
              </div>
            </div>

            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center space-x-2 space-x-reverse">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCancellation} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  سبب طلب الإلغاء <span className="text-rose-500">*</span> (إجباري)
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="يرجى كتابة سبب طلب الإلغاء بالتفصيل لتتمكن الإدارة من مراجعته..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  disabled={isSubmittingCancel}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancel || !cancellationReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 space-x-reverse"
                >
                  {isSubmittingCancel ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري إرسال الطلب...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5 ml-1" />
                      <span>تأكيد طلب الإلغاء</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

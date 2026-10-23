import React, { useState } from "react";
import { PharmacyOrder } from "../../types/pharmacy";
import { PharmacyProgressTracker } from "./PharmacyProgressTracker";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Eye,
  FileText,
  Image as ImageIcon,
  Truck,
  Ban,
  Archive,
  Phone,
  Receipt,
  Plus,
} from "lucide-react";

interface PharmacyOrdersViewProps {
  activeOrders: PharmacyOrder[];
  pastOrders: PharmacyOrder[];
  onSelectOrder: (order: PharmacyOrder) => void;
  onCancelOrder: (orderId: string, reason?: string) => Promise<void>;
  onArchiveOrder: (orderId: string) => Promise<void>;
  onAddNewOrder: () => void;
}

export const PharmacyOrdersView: React.FC<PharmacyOrdersViewProps> = ({
  activeOrders,
  pastOrders,
  onSelectOrder,
  onCancelOrder,
  onArchiveOrder,
  onAddNewOrder,
}) => {
  const [filterTab, setFilterTab] = useState<"active" | "past">("active");

  const displayedOrders = filterTab === "active" ? activeOrders : pastOrders;

  const getStatusBadge = (status: PharmacyOrder["status"]) => {
    switch (status) {
      case "pending_review":
        return {
          label: "قيد المراجعة",
          className: "bg-amber-100 text-amber-800 border-amber-200",
          icon: Clock,
        };
      case "accepted":
      case "shopping":
        return {
          label: "تم القبول وجاري التجهيز",
          className: "bg-blue-100 text-blue-800 border-blue-200",
          icon: Clock,
        };
      case "ready_for_delivery":
        return {
          label: "تم التجهيز وجاري التوصيل",
          className: "bg-teal-100 text-teal-800 border-teal-200",
          icon: Truck,
        };
      case "completed":
        return {
          label: "تم التوصيل",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200",
          icon: CheckCircle2,
        };
      case "cancelled":
        return {
          label: "تم الإلغاء",
          className: "bg-rose-100 text-rose-800 border-rose-200",
          icon: XCircle,
        };
      case "unable_to_fulfill":
        return {
          label: "تعذر التجهيز",
          className: "bg-amber-100 text-amber-800 border-amber-200",
          icon: AlertTriangle,
        };
      default:
        return {
          label: "قيد المراجعة",
          className: "bg-slate-100 text-slate-800 border-slate-200",
          icon: Clock,
        };
    }
  };

  return (
    <div className="space-y-4 text-right">
      {/* Top Filter Buttons: النشطة vs السابقة والأرشيف */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 space-x-reverse bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setFilterTab("active")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterTab === "active"
                ? "bg-white text-emerald-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            الطلبات الحالية ({activeOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("past")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterTab === "past"
                ? "bg-white text-emerald-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            السابقة والأرشيف ({pastOrders.length})
          </button>
        </div>

        <button
          type="button"
          onClick={onAddNewOrder}
          className="flex items-center space-x-1.5 space-x-reverse px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>طلب علاج جديد</span>
        </button>
      </div>

      {/* Orders List */}
      {displayedOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Truck className="w-6 h-6" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">
            {filterTab === "active"
              ? "لا توجد طلبات صيدلية نشطة حالياً"
              : "لا توجد طلبات سابقة في الأرشيف"}
          </h4>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            {filterTab === "active"
              ? "يمكنك طلب أدوية أو روشتة علاج جديدة وسيتولى المندوب شراءها وتوصيلها فوراً."
              : "الطلبات المكتملة والمؤرشفة ستظهر هنا للرجوع إليها مستقبلاً."}
          </p>
          {filterTab === "active" && (
            <button
              onClick={onAddNewOrder}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer"
            >
              إنشاء طلب صيدلية
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayedOrders.map((order) => {
            const badge = getStatusBadge(order.status);
            const BadgeIcon = badge.icon;
            const canCancel = order.status === "pending_review";
            const canArchive =
              (order.status === "completed" ||
                order.status === "cancelled" ||
                order.status === "unable_to_fulfill") &&
              !order.isArchived;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all p-4 space-y-3 text-right"
              >
                {/* Header row: Order #, Status badge, Title */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2 space-x-reverse mb-1">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center space-x-1 space-x-reverse ${badge.className}`}
                      >
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {order.title}
                    </h4>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(order.createdAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>

                {/* Pharmacy Name & Delivery Address */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                  <span className="flex items-center space-x-1 space-x-reverse">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{order.pharmacyName || "لم تحدد صيدلية (أي صيدلية قريبة)"}</span>
                  </span>

                  {order.items && order.items.length > 0 && (
                    <span className="flex items-center space-x-1 space-x-reverse">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{order.items.length} أصناف</span>
                    </span>
                  )}

                  {order.images && order.images.length > 0 && (
                    <span className="flex items-center space-x-1 space-x-reverse">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{order.images.length} صور</span>
                    </span>
                  )}

                  {order.receiptImageUrl && (
                    <span className="flex items-center space-x-1 space-x-reverse text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      <Receipt className="w-3 h-3" />
                      <span>الفاتورة مرفقة</span>
                    </span>
                  )}
                </div>

                {/* Progress Tracker (Only for Active Orders) */}
                {filterTab === "active" && (
                  <div className="pt-1">
                    <PharmacyProgressTracker status={order.status} />
                  </div>
                )}

                {/* Driver quick preview if accepted or shopping */}
                {(order.status === "accepted" ||
                  order.status === "shopping" ||
                  order.status === "ready_for_delivery") &&
                  order.driver && (
                    <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Truck className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-emerald-950">
                          المندوب: {order.driver.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({order.driver.phone})
                        </span>
                      </div>
                      <a
                        href={`tel:${order.driver.phone}`}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 space-x-reverse"
                      >
                        <Phone className="w-3 h-3" />
                        <span>اتصال</span>
                      </a>
                    </div>
                  )}

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectOrder(order)}
                    className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all flex items-center justify-center space-x-1.5 space-x-reverse cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>عرض التفاصيل الكاملة</span>
                  </button>

                  {/* Cancel button if pending_review */}
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => onSelectOrder(order)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="إلغاء الطلب"
                    >
                      <span>إلغاء</span>
                    </button>
                  )}

                  {/* Archive button if completed */}
                  {canArchive && (
                    <button
                      type="button"
                      onClick={() => onArchiveOrder(order.id)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1 space-x-reverse"
                      title="أرشفة الطلب"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>أرشفة</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

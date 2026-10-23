import React, { useState, useMemo, useCallback } from "react";
import { useApp } from "../context/AppContext";
import {
  History,
  ShoppingCart,
  PackagePlus,
  CheckCircle2,
  Clock,
  User,
  Users,
  Search,
  Filter,
  Receipt,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CreditCard,
  Banknote,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

export type ActivityFilterType = "all" | "items_added" | "purchases" | "items_completed";

export interface UnifiedActivityItem {
  id: string;
  type: "item_added" | "purchase_made" | "item_completed";
  actorName: string;
  actorRole: "admin" | "home" | "household_member" | "guest";
  actorRoleLabel: string;
  title: string;
  description: string;
  timestamp: string;
  categoryArabic?: string;
  quantity?: string;
  urgency?: "high" | "normal" | "low";
  notes?: string;
  amount?: number;
  currency?: string;
  invoiceNumber?: string;
  paymentMethod?: "cash" | "card" | "transfer";
  products?: Array<{
    id: string;
    name: string;
    quantity: string;
    price: number;
    categoryArabic?: string;
  }>;
  relatedMissingItemNames?: string[];
  isCompleted?: boolean;
}

function formatArabicTimeAgo(dateString: string): string {
  if (!dateString) return "منذ وقت غير محدد";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const now = new Date();
  const diffInSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSec < 45) return "الآن";
  if (diffInSec < 90) return "منذ دقيقة";
  if (diffInSec < 3600) return `منذ ${Math.floor(diffInSec / 60)} دقيقة`;
  if (diffInSec < 7200) return "منذ ساعة";
  if (diffInSec < 86400) return `منذ ${Math.floor(diffInSec / 3600)} ساعة`;
  if (diffInSec < 172800) return "أمس";
  if (diffInSec < 604800) return `منذ ${Math.floor(diffInSec / 86400)} أيام`;

  return date.toLocaleDateString("ar-EG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatArabicDateFull(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ActivityLogSection: React.FC = () => {
  const {
    missingItems,
    invoices,
    household,
    householdMembers,
    budgetConfig,
    supabaseUser,
    setActiveTab,
  } = useApp();

  const [filterType, setFilterType] = useState<ActivityFilterType>("all");
  const [selectedActor, setSelectedActor] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedActivityIds, setExpandedActivityIds] = useState<Record<string, boolean>>({});
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Determine canonical Admin display name
  const adminDisplayName = useMemo(() => {
    return (
      household?.adminName?.trim() ||
      supabaseUser?.user_metadata?.full_name?.trim() ||
      "المسؤول"
    );
  }, [household?.adminName, supabaseUser?.user_metadata?.full_name]);

  // Normalize any actor name to prevent splitting the same user into multiple personas
  const resolveActor = useCallback(
    (
      rawName?: string | null,
      role?: "admin" | "home" | "household_member" | string
    ): { name: string; role: "admin" | "home" | "household_member"; roleLabel: string } => {
      const cleanRaw = (rawName || "").trim();
      const isAdminRole = role === "admin";
      const isAdminAlias =
        cleanRaw === "المسؤول" ||
        cleanRaw === "المسؤول (الأب)" ||
        cleanRaw === "المسؤول عن الشراء" ||
        cleanRaw === "مسؤول المنزل" ||
        cleanRaw === "مسؤول المشتريات" ||
        cleanRaw.toLowerCase() === "admin" ||
        (adminDisplayName && cleanRaw.toLowerCase() === adminDisplayName.toLowerCase());

      if (isAdminRole || isAdminAlias || (!cleanRaw && role !== "home" && role !== "household_member")) {
        return {
          name: adminDisplayName,
          role: "admin",
          roleLabel: "مسؤول المنزل",
        };
      }

      // Check if it matches a known registered household member
      const matchingMember = householdMembers.find(
        (m) => m.userName && m.userName.trim().toLowerCase() === cleanRaw.toLowerCase()
      );
      const finalName = matchingMember?.userName || cleanRaw || "هاتف المنزل";

      return {
        name: finalName,
        role: "home",
        roleLabel: "هاتف المنزل",
      };
    },
    [adminDisplayName, householdMembers]
  );

  // Toggle detail expansion
  const toggleExpand = (id: string) => {
    setExpandedActivityIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Compile unified activity feed from missingItems and invoices
  const activities = useMemo<UnifiedActivityItem[]>(() => {
    const list: UnifiedActivityItem[] = [];

    // 1. Missing Items Added Activities
    missingItems.forEach((item) => {
      const { name: actorName, role: actorRole, roleLabel: actorRoleLabel } = resolveActor(
        item.addedByName,
        item.addedBy
      );

      list.push({
        id: `item-added-${item.id}`,
        type: "item_added",
        actorName,
        actorRole,
        actorRoleLabel,
        title: `طلب إضافة نقص: ${item.name}`,
        description: `أضاف ${actorName} صنف "${item.name}" بالكمية (${item.quantity || "١"}) لقسم ${item.categoryArabic || "المنتجات العامة"}.`,
        timestamp: item.addedAt || new Date().toISOString(),
        categoryArabic: item.categoryArabic,
        quantity: item.quantity,
        urgency: item.urgency,
        notes: item.notes,
        isCompleted: item.completed,
      });

      // If item was completed/purchased, generate a completion activity if timestamp is available
      if (item.completed && item.completedAt) {
        list.push({
          id: `item-completed-${item.id}`,
          type: "item_completed",
          actorName: adminDisplayName,
          actorRole: "admin",
          actorRoleLabel: "تم الشراء والإنجاز",
          title: `اكتمل شراء نقص: ${item.name}`,
          description: `تم إنجاز وتوفير غرض "${item.name}" للبيت وإزالته من قائمة النواقص النشطة.`,
          timestamp: item.completedAt,
          categoryArabic: item.categoryArabic,
          quantity: item.quantity,
          isCompleted: true,
        });
      }
    });

    // 2. Purchase Invoices Activities
    invoices.forEach((inv) => {
      const { name: actorName, role: actorRole, roleLabel: actorRoleLabel } = resolveActor(
        inv.registeredBy,
        "admin"
      );

      list.push({
        id: `inv-${inv.id}`,
        type: "purchase_made",
        actorName,
        actorRole,
        actorRoleLabel,
        title: `إتمام عملية شراء وفاتورة بقيمة ${inv.totalPrice} ${budgetConfig.currency}`,
        description: `قام ${actorName} بإتمام شراء وتسجيل فاتورة رقم (${inv.invoiceNumber}) بإجمالي ${inv.totalPrice} ${budgetConfig.currency} (${inv.products?.length || 0} أصناف).`,
        timestamp: inv.date || new Date().toISOString(),
        categoryArabic: inv.categoryArabic,
        amount: inv.totalPrice,
        currency: budgetConfig.currency,
        invoiceNumber: inv.invoiceNumber,
        paymentMethod: inv.paymentMethod,
        products: inv.products,
        notes: inv.notes,
      });
    });

    // Sort by timestamp
    return list.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
  }, [missingItems, invoices, budgetConfig.currency, sortOrder, resolveActor, adminDisplayName]);

  // Extract distinct actors for the filter dropdown (strictly deduplicated)
  const distinctActors = useMemo(() => {
    const list: { name: string; label: string; role: "admin" | "home" }[] = [];
    const seen = new Set<string>();

    // 1. The unified Admin
    list.push({
      name: adminDisplayName,
      label: `${adminDisplayName} (المسؤول)`,
      role: "admin",
    });
    seen.add(adminDisplayName.toLowerCase());

    // 2. Real registered household members
    householdMembers.forEach((m) => {
      const name = (m.userName || "").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({
          name,
          label: `${name} (هاتف المنزل)`,
          role: "home",
        });
      }
    });

    // 3. Other distinct non-admin actors found in activities
    activities.forEach((act) => {
      const name = (act.actorName || "").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({
          name,
          label: `${name} (فرد بالمنزل)`,
          role: "home",
        });
      }
    });

    return list;
  }, [adminDisplayName, householdMembers, activities]);

  // Filter and search
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Type Filter
      if (filterType === "items_added" && act.type !== "item_added") return false;
      if (filterType === "purchases" && act.type !== "purchase_made") return false;
      if (filterType === "items_completed" && act.type !== "item_completed") return false;

      // Actor Filter (unifies admin role matching)
      if (selectedActor !== "all") {
        const isSelectedAdmin = selectedActor.toLowerCase() === adminDisplayName.toLowerCase();
        if (isSelectedAdmin) {
          if (act.actorRole !== "admin" && act.actorName.toLowerCase() !== adminDisplayName.toLowerCase()) {
            return false;
          }
        } else if (act.actorName !== selectedActor) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inTitle = act.title.toLowerCase().includes(query);
        const inDesc = act.description.toLowerCase().includes(query);
        const inActor = act.actorName.toLowerCase().includes(query);
        const inCategory = (act.categoryArabic || "").toLowerCase().includes(query);
        const inInvoice = (act.invoiceNumber || "").toLowerCase().includes(query);
        const inProducts = act.products?.some((p) => p.name.toLowerCase().includes(query));

        if (!inTitle && !inDesc && !inActor && !inCategory && !inInvoice && !inProducts) {
          return false;
        }
      }

      return true;
    });
  }, [activities, filterType, selectedActor, searchQuery, adminDisplayName]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = activities.length;
    const itemsAddedCount = activities.filter((a) => a.type === "item_added").length;
    const purchasesCount = activities.filter((a) => a.type === "purchase_made").length;
    const totalSpent = invoices.reduce((sum, inv) => sum + (inv.totalPrice || 0), 0);

    // Count by actor
    const actorCounts: Record<string, { added: number; purchased: number }> = {};
    activities.forEach((a) => {
      if (!actorCounts[a.actorName]) {
        actorCounts[a.actorName] = { added: 0, purchased: 0 };
      }
      if (a.type === "item_added") actorCounts[a.actorName].added++;
      if (a.type === "purchase_made") actorCounts[a.actorName].purchased++;
    });

    return {
      total,
      itemsAddedCount,
      purchasesCount,
      totalSpent,
      actorCounts,
    };
  }, [activities, invoices]);

  return (
    <div className="space-y-4 text-right animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-200 dark:border-emerald-800/60 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  سجل نشاطات المنزل والشفافية
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60">
                  خاص بالمسؤول 👑
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تتبع زمني دقيق لكل من أضاف طلباً أو أتم عملية شراء لضمان الشفافية الكاملة بين أفراد المنزل
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse cursor-pointer"
              title="تغيير الترتيب الزمني"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>{sortOrder === "desc" ? "الأحدث أولاً" : "الأقدم أولاً"}</span>
            </button>
          </div>
        </div>

        {/* Transparency KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">إجمالي النشاطات</span>
            <div className="flex items-baseline space-x-1 space-x-reverse mt-0.5">
              <span className="text-lg font-black text-slate-900 dark:text-white">{stats.total}</span>
              <span className="text-[10px] text-slate-400">عملية</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50">
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">الطلبات المضافة</span>
            <div className="flex items-baseline space-x-1 space-x-reverse mt-0.5">
              <span className="text-lg font-black text-emerald-900 dark:text-emerald-300">{stats.itemsAddedCount}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">طلب</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200/80 dark:border-blue-800/50">
            <span className="text-[11px] text-blue-700 dark:text-blue-400 block font-medium">فواتير الشراء المنفذة</span>
            <div className="flex items-baseline space-x-1 space-x-reverse mt-0.5">
              <span className="text-lg font-black text-blue-900 dark:text-blue-300">{stats.purchasesCount}</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400">فاتورة</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/50">
            <span className="text-[11px] text-amber-700 dark:text-amber-400 block font-medium">إجمالي المصروفات</span>
            <div className="flex items-baseline space-x-1 space-x-reverse mt-0.5">
              <span className="text-lg font-black text-amber-900 dark:text-amber-300 font-mono">
                {stats.totalSpent.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400">{budgetConfig.currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtering & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        {/* Type Filter Buttons */}
        <div className="flex items-center space-x-2 space-x-reverse overflow-x-auto text-xs pb-1">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              filterType === "all"
                ? "bg-slate-900 text-white dark:bg-emerald-600 shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            جميع النشاطات ({activities.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterType("items_added")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 cursor-pointer ${
              filterType === "items_added"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>الطلبات المضافة ({stats.itemsAddedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType("purchases")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 cursor-pointer ${
              filterType === "purchases"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 hover:bg-blue-100"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>عمليات الشراء والفواتير ({stats.purchasesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType("items_completed")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 cursor-pointer ${
              filterType === "items_completed"
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 hover:bg-teal-100"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>النواقص المكتملة</span>
          </button>
        </div>

        {/* Search & Actor Select */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في السجل (اسم الغرض، الشخص، رقم الفاتورة...)"
              className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                مسح
              </button>
            )}
          </div>

          {/* Actor Filter Dropdown */}
          <div>
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">👥 جميع أفراد المنزل ({distinctActors.length})</option>
              {distinctActors.map((actor) => (
                <option key={actor.name} value={actor.name}>
                  {actor.role === "admin" ? "👑" : "📱"} {actor.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Timeline Feed */}
      <div className="space-y-3">
        {filteredActivities.length > 0 ? (
          filteredActivities.map((act) => {
            const isExpanded = !!expandedActivityIds[act.id];
            const isPurchase = act.type === "purchase_made";
            const isItemAdded = act.type === "item_added";
            const isItemCompleted = act.type === "item_completed";

            return (
              <div
                key={act.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden ${
                  isPurchase
                    ? "border-blue-200/90 dark:border-blue-900/60 hover:border-blue-300"
                    : isItemCompleted
                    ? "border-teal-200/90 dark:border-teal-900/60 hover:border-teal-300"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                } shadow-2xs`}
              >
                {/* Main Activity Row */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Left (Icon & Main Info) */}
                  <div className="flex items-start space-x-3 space-x-reverse flex-1 min-w-0">
                    {/* Activity Type Icon Badge */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                        isPurchase
                          ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                          : isItemCompleted
                          ? "bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800"
                          : "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      }`}
                    >
                      {isPurchase ? (
                        <ShoppingCart className="w-5 h-5" />
                      ) : isItemCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <PackagePlus className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Actor Badge & Time */}
                      <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1 mb-1">
                        <span
                          className={`inline-flex items-center space-x-1 space-x-reverse px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                            act.actorRole === "admin"
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{act.actorName}</span>
                          <span className="text-[10px] text-slate-400">({act.actorRoleLabel})</span>
                        </span>

                        <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center space-x-1 space-x-reverse">
                          <Clock className="w-3 h-3" />
                          <span>{formatArabicTimeAgo(act.timestamp)}</span>
                        </span>

                        {act.urgency === "high" && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            عاجل جداً 🔥
                          </span>
                        )}

                        {act.categoryArabic && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {act.categoryArabic}
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                        {act.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {act.description}
                      </p>
                    </div>
                  </div>

                  {/* Right Action (Price / Details button) */}
                  <div className="flex items-center space-x-2 space-x-reverse self-end sm:self-center shrink-0">
                    {act.amount !== undefined && (
                      <div className="text-left bg-blue-50/80 dark:bg-blue-950/60 px-3 py-1.5 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-medium">قيمة الفاتورة</span>
                        <span className="text-sm font-black text-blue-900 dark:text-blue-200 font-mono">
                          {act.amount} {act.currency}
                        </span>
                      </div>
                    )}

                    {/* Toggle Details Button if products or notes exist */}
                    {(act.products || act.notes || act.invoiceNumber) && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(act.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center space-x-1 space-x-reverse cursor-pointer"
                      >
                        <span>{isExpanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-100 text-xs">
                    {/* Exact Timestamp */}
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                      <span className="flex items-center space-x-1.5 space-x-reverse">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>التاريخ والتوقيت الدقيق:</span>
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {formatArabicDateFull(act.timestamp)}
                      </span>
                    </div>

                    {/* Purchase Products List */}
                    {act.products && act.products.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          الأصناف المشتراة في هذه الفاتورة ({act.products.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {act.products.map((prod, idx) => (
                            <div
                              key={idx}
                              className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                            >
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {prod.name}
                              </span>
                              <div className="flex items-center space-x-2 space-x-reverse font-mono text-slate-600 dark:text-slate-400">
                                <span>{prod.quantity || "١"}</span>
                                {prod.price > 0 && (
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                    {prod.price} {budgetConfig.currency}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Additional Notes */}
                    {act.notes && (
                      <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300">
                        <span className="font-bold block mb-0.5">ملاحظات مسجلة:</span>
                        <p>{act.notes}</p>
                      </div>
                    )}

                    {/* Payment Method Details */}
                    {act.paymentMethod && (
                      <div className="flex items-center space-x-2 space-x-reverse text-slate-600 dark:text-slate-400">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span>طريقة الدفع: </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {act.paymentMethod === "cash"
                            ? "نقداً (كاش) 💵"
                            : act.paymentMethod === "card"
                            ? "بطاقة دفع بنكية 💳"
                            : "تحويل إلكتروني 📲"}
                        </span>
                      </div>
                    )}

                    {/* Direct Shortcut to View Purchases / Invoices Tab */}
                    {isPurchase && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setActiveTab("purchases")}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 space-x-reverse cursor-pointer shadow-xs"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>عرض شاشة فواتير المشتريات</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* Empty State */
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <History className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                لا توجد نشاطات مطابقة للبحث أو الفلتر
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                يتم تسجيل أي طلب جديد يضيفه أفراد المنزل أو أي فاتورة شراء يقوم بها المسؤول تلقائياً هنا بشفافية تامة.
              </p>
            </div>
            {(filterType !== "all" || selectedActor !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilterType("all");
                  setSelectedActor("all");
                  setSearchQuery("");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إعادة ضبط جميع الفلاتر
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

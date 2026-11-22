import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { supabase } from "./src/lib/supabase";
import { cacheManager } from "./src/lib/cacheManager";
import {
  mapDbOrderToPharmacyOrder,
  pharmacyService,
} from "./src/lib/pharmacyService";
import { evaluatePharmacyCompletionNotifications } from "./src/lib/usePharmacy";
import { arePrescriptionSnapshotsEqual } from "./src/components/pharmacy/PharmacyNewOrderView";
import { PharmacyProgressTracker } from "./src/components/pharmacy/PharmacyProgressTracker";
import { PharmacyOrdersView } from "./src/components/pharmacy/PharmacyOrdersView";
import { PharmacyOrderDetailModal } from "./src/components/pharmacy/PharmacyOrderDetailModal";
import type { PharmacyOrder, PharmacyOrderStatus } from "./src/types/pharmacy";

const windowListeners: Map<string, Set<Function>> = (globalThis as any).__testWindowListeners;
const documentListeners: Map<string, Set<Function>> = (globalThis as any).__testDocumentListeners;

async function runTests() {
  console.log("Running Talabaty Pharmacy Verification Suite (10 scenarios)...");

  const USER_ID = "11111111-1111-4111-8111-111111111111";
  const HOUSEHOLD_ID = "22222222-2222-4222-8222-222222222222";
  const ORDER_ID = "33333333-3333-4333-8333-333333333333";

  let liveDbRow: any = {
    id: ORDER_ID,
    order_number: "PH-3333",
    user_id: USER_ID,
    household_id: HOUSEHOLD_ID,
    created_at: "2026-11-22T09:00:00.000Z",
    status: "pending_review",
    prescription_title: "روشتة علاج الضغط",
    customer_notes: "يرجى التأكد من تاريخ الصلاحية",
    requested_pharmacy_name: "صيدلية العزبي",
    address_text: "المنصورة - شارع الجمهورية",
    delivery_fee: 15,
    medicines_total: 0,
    grand_total: 15,
    items: [
      {
        id: "item-1",
        item_name: "كونكور 5 مجم",
        unit: "علبة",
        requested_quantity: 2,
        purchased_quantity: null,
        sort_order: 1,
        driver_note: null,
      },
    ],
    files: [
      {
        id: "file-1",
        storage_path: "https://cdn.example.com/rx-1.jpg",
        mime_type: "image/jpeg",
        file_type: "prescription",
        display_order: 1,
        driver_note: null,
      },
    ],
    delivery: [],
  };

  cacheManager.setHouseholdCache(USER_ID, HOUSEHOLD_ID, "pharmacy_orders", [
    {
      id: ORDER_ID,
      orderNumber: "PH-3333",
      title: "روشتة علاج الضغط",
      status: "pending_review",
      createdAt: "2026-11-22T09:00:00.000Z",
      deliveryAddress: "المنصورة - شارع الجمهورية",
      items: [{ id: "item-1", name: "كونكور 5 مجم", quantity: 2, unit: "علبة" }],
      images: [{ id: "file-1", url: "https://cdn.example.com/rx-1.jpg" }],
      driver: { id: "stale-drv", name: "سائق قديم مخبأ", phone: "01099999999" },
      paymentMethod: "الدفع عند الاستلام",
      isArchived: false,
    },
  ]);

  const createdChannels: any[] = [];
  const removedChannels: any[] = [];

  (supabase as any).auth = {
    getSession: async () => ({ data: { session: { user: { id: USER_ID } } } }),
  };

  (supabase as any).from = (table: string) => {
    if (table === "pharmacy_orders") {
      return {
        select: () => ({
          order: async () => ({ data: [liveDbRow], error: null }),
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => ({
              data: val === ORDER_ID ? liveDbRow : null,
              error: null,
            }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    };
  };

  (supabase as any).channel = (name: string) => {
    const handlers: Array<{ table: string; cb: Function }> = [];
    let statusCb: Function | null = null;
    const ch = {
      name,
      on: (_type: string, filter: { table: string }, cb: Function) => {
        handlers.push({ table: filter.table, cb });
        return ch;
      },
      subscribe: (cb?: Function) => {
        if (cb) statusCb = cb;
        cb?.("SUBSCRIBED");
        return ch;
      },
      emitPostgresChange: (table: string, payload: any) => {
        handlers.filter((h) => h.table === table).forEach((h) => h.cb(payload));
      },
      emitStatus: (status: string) => {
        statusCb?.(status);
      },
    };
    createdChannels.push(ch);
    return ch;
  };

  (supabase as any).removeChannel = (ch: any) => {
    removedChannels.push(ch);
  };

  const baselineOnlineListeners = windowListeners.get("online")?.size ?? 0;
  const baselineVisibilityListeners = documentListeners.get("visibilitychange")?.size ?? 0;

  // Test 1 & Test 2: Fresh DB fetch + Realtime updates + Status Labels
  const eventsReceived: any[] = [];
  const unsub = pharmacyService.subscribeToPharmacyUpdates((ev) => {
    eventsReceived.push(ev);
  });
  assert.equal(createdChannels.length, 1);
  assert.equal(windowListeners.get("online")?.size ?? 0, baselineOnlineListeners + 1);
  assert.equal(documentListeners.get("visibilitychange")?.size ?? 0, baselineVisibilityListeners + 1);

  const freshOnOpen = await pharmacyService.getOrderById(ORDER_ID, HOUSEHOLD_ID);
  assert.ok(freshOnOpen);
  assert.equal(freshOnOpen!.driver, undefined);
  assert.equal(freshOnOpen!.customerNotes, "يرجى التأكد من تاريخ الصلاحية");

  const htmlNoDriver = renderToStaticMarkup(
    <PharmacyOrderDetailModal
      order={freshOnOpen!}
      onClose={() => {}}
      onCancelOrder={async () => {}}
      onArchiveOrder={async () => {}}
      onUpdatePharmacy={async () => {}}
      pharmaciesList={["صيدلية العزبي"]}
    />
  );
  assert.ok(!htmlNoDriver.includes("مندوب التوصيل المكلف بالطلب"));
  assert.ok(htmlNoDriver.includes("يرجى التأكد من تاريخ الصلاحية"));

  const statusSequence: Array<{ status: PharmacyOrderStatus; label: string }> = [
    { status: "pending_review", label: "قيد المراجعة" },
    { status: "accepted", label: "تم القبول" },
    { status: "shopping", label: "جاري التجهيز" },
    { status: "ready_for_delivery", label: "جاري التوصيل" },
    { status: "completed", label: "تم التوصيل" },
    { status: "cancellation_requested", label: "طلب إلغاء" },
    { status: "cancelled", label: "تم الإلغاء" },
  ];

  for (const s of statusSequence) {
    const trackerHtml = renderToStaticMarkup(
      <PharmacyProgressTracker status={s.status} />
    );
    assert.ok(trackerHtml.includes(s.label), `Tracker missing ${s.label}`);

    const listHtml = renderToStaticMarkup(
      <PharmacyOrdersView
        activeOrders={[{ ...freshOnOpen!, status: s.status }]}
        pastOrders={[]}
        onSelectOrder={() => {}}
        onCancelOrder={async () => {}}
        onArchiveOrder={async () => {}}
        onAddNewOrder={() => {}}
      />
    );
    assert.ok(listHtml.includes(s.label), `OrdersView missing ${s.label}`);
  }

  // Test 3: Driver Assignment & Update + tel: link
  liveDbRow = {
    ...liveDbRow,
    status: "accepted",
    delivery: [
      {
        id: "del-1",
        assigned_driver_id: "drv-1",
        accepted_at: "2026-11-22T09:05:00.000Z",
        driver: {
          id: "drv-1",
          full_name: "أحمد محمد السائق",
          phone: "010 1234 5678",
          vehicle_type: "دراجة نارية",
        },
      },
    ],
  };

  createdChannels[0].emitPostgresChange("pharmacy_delivery_orders", {
    eventType: "UPDATE",
    new: { pharmacy_order_id: ORDER_ID, assigned_driver_id: "drv-1" },
  });
  assert.ok(eventsReceived.some((e) => e.table === "pharmacy_delivery_orders"));

  const afterDriverAssign = await pharmacyService.getOrderById(ORDER_ID, HOUSEHOLD_ID);
  assert.equal(afterDriverAssign?.driver?.name, "أحمد محمد السائق");
  assert.equal(afterDriverAssign?.driver?.phone, "010 1234 5678");

  const htmlWithDriver = renderToStaticMarkup(
    <PharmacyOrderDetailModal
      order={afterDriverAssign!}
      onClose={() => {}}
      onCancelOrder={async () => {}}
      onArchiveOrder={async () => {}}
      onUpdatePharmacy={async () => {}}
      pharmaciesList={["صيدلية العزبي"]}
    />
  );
  assert.ok(htmlWithDriver.includes("أحمد محمد السائق"));
  assert.ok(htmlWithDriver.includes("010 1234 5678"));
  assert.ok(htmlWithDriver.includes('href="tel:01012345678"'));

  liveDbRow = {
    ...liveDbRow,
    status: "ready_for_delivery",
    delivery: [
      {
        id: "del-1",
        assigned_driver_id: "drv-2",
        accepted_at: "2026-11-22T09:10:00.000Z",
        driver: {
          id: "drv-2",
          full_name: "محمود علي",
          phone: "01122334455",
          vehicle_type: "سيارة",
        },
      },
    ],
  };
  const afterDriverChange = await pharmacyService.getOrderById(ORDER_ID, HOUSEHOLD_ID);
  assert.equal(afterDriverChange?.driver?.name, "محمود علي");
  assert.equal(afterDriverChange?.driver?.phone, "01122334455");

  // Test 5: Completion Notification Deduplication
  const prevStatuses = new Map<string, PharmacyOrderStatus>([
    [ORDER_ID, "ready_for_delivery"],
    ["old-done", "completed"],
  ]);
  const alreadyNotified = new Set<string>(["old-done"]);

  const completedOrder: PharmacyOrder = {
    ...afterDriverChange!,
    status: "completed",
  };
  const historicalOrder: PharmacyOrder = {
    ...afterDriverChange!,
    id: "fresh-historical",
    orderNumber: "PH-9999",
    status: "completed",
  };

  const firstEval = evaluatePharmacyCompletionNotifications({
    orders: [completedOrder],
    previousStatuses: prevStatuses,
    alreadyNotifiedIds: alreadyNotified,
    isInitialHydration: false,
  });
  assert.equal(firstEval.notificationsToEmit.length, 1);
  assert.equal(firstEval.notificationsToEmit[0].id, ORDER_ID);
  alreadyNotified.add(ORDER_ID);

  const secondEval = evaluatePharmacyCompletionNotifications({
    orders: [completedOrder],
    previousStatuses: prevStatuses,
    alreadyNotifiedIds: alreadyNotified,
    isInitialHydration: false,
  });
  assert.equal(secondEval.notificationsToEmit.length, 0);

  const initialHistoricalEval = evaluatePharmacyCompletionNotifications({
    orders: [historicalOrder],
    previousStatuses: new Map(),
    alreadyNotifiedIds: new Set(),
    isInitialHydration: true,
  });
  assert.equal(initialHistoricalEval.notificationsToEmit.length, 0);
  assert.ok(initialHistoricalEval.newlyMarkedSilentIds.includes("fresh-historical"));

  // Test 6, 7, 8, 9: Saved Prescriptions Snapshot Equality & Image Non-Duplication
  const baseline = {
    title: "روشتة البرد",
    pharmacyName: "صيدلية العزبي",
    items: [
      { id: "1", name: "بانادول", quantity: 1, unit: "علبة" as const, notes: "بعد الأكل" },
    ],
    images: [{ id: "img-1", url: "https://cdn.example.com/rx-1.jpg", note: "واضح" }],
  };

  assert.equal(
    arePrescriptionSnapshotsEqual(baseline, {
      title: " روشتة البرد ",
      pharmacyName: "صيدلية العزبي",
      items: [{ id: "clone-1", name: "بانادول", quantity: 1, unit: "علبة", notes: "بعد الأكل" }],
      images: [{ id: "clone-img", url: "https://cdn.example.com/rx-1.jpg", note: "واضح" }],
    }),
    true
  );

  assert.equal(
    arePrescriptionSnapshotsEqual(baseline, {
      ...baseline,
      items: [{ id: "clone-1", name: "بانادول", quantity: 2, unit: "علبة", notes: "بعد الأكل" }],
    }),
    false
  );

  assert.equal(
    arePrescriptionSnapshotsEqual(baseline, {
      ...baseline,
      images: [
        ...baseline.images,
        { id: "img-2", url: "https://cdn.example.com/rx-2.jpg" },
      ],
    }),
    false
  );

  const mappedNoDupImages = mapDbOrderToPharmacyOrder({
    ...liveDbRow,
    files: [liveDbRow.files[0], { ...liveDbRow.files[0] }],
  });
  assert.equal(mappedNoDupImages.images.length, 1);

  // Test 10: Reconnect & Unsubscribe Cleanup
  const beforeOnlineCount = eventsReceived.length;
  (globalThis as any).window.dispatchEvent("online");
  assert.ok(eventsReceived.length > beforeOnlineCount);

  createdChannels[0].emitStatus("CHANNEL_ERROR");
  assert.equal(removedChannels.length, 1);

  await new Promise((r) => setTimeout(r, 1700));
  assert.equal(createdChannels.length, 2);
  assert.ok(eventsReceived.some((e) => e.table === "reconnect"));

  unsub();
  assert.equal(removedChannels.length, 2);
  assert.equal(windowListeners.get("online")?.size ?? 0, baselineOnlineListeners);
  assert.equal(documentListeners.get("visibilitychange")?.size ?? 0, baselineVisibilityListeners);

  console.log("ALL VERIFICATION ASSERTIONS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});

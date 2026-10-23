export type PharmacyUnit = "علبة" | "شريط" | "قطعة" | "أمبول";

export type PharmacyStatus = "active" | "disabled" | "hidden";
export type PharmacyWidth = "full" | "half";

export interface PharmacyConfig {
  status: PharmacyStatus;
  displayWidth: PharmacyWidth;
  nameAr: string;
  imageUrl: string;
}

export type PharmacyOrderStatus =
  | "pending_review"
  | "accepted"
  | "shopping"
  | "ready_for_delivery"
  | "completed"
  | "cancelled"
  | "unable_to_fulfill";

export interface PharmacyPrescriptionItem {
  id: string;
  name: string;
  quantity: number;
  unit: PharmacyUnit;
  notes?: string;
}

export interface PharmacyPrescriptionImage {
  id: string;
  url: string;
  note?: string; // ملاحظة صيدلي/سائق مستقلة للصورة
  uploadedAt?: string;
}

export interface PharmacyPrescription {
  id: string;
  title: string; // اسم الروشتة / العلاج
  pharmacyName?: string; // الصيدلية (اختياري)
  items: PharmacyPrescriptionItem[];
  images: PharmacyPrescriptionImage[];
  createdAt: string;
  updatedAt?: string;
  lastOrderedAt?: string;
  sourcePrescriptionId?: string;
}

export interface PharmacyDriver {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  vehicleInfo?: string;
}

export interface PharmacyOrderItem {
  id: string;
  name: string;
  quantity: number;
  purchasedQuantity?: number;
  unit: PharmacyUnit;
  notes?: string;
  isAvailable?: boolean;
}

export interface PharmacyOrder {
  id: string;
  orderNumber: string; // مثال: PH-5921
  prescriptionId?: string;
  title: string;
  pharmacyName?: string;
  status: PharmacyOrderStatus;
  createdAt: string;
  items: PharmacyOrderItem[];
  images: PharmacyPrescriptionImage[];
  deliveryAddress: string;
  customerNotes?: string;
  driver?: PharmacyDriver;
  driverNotes?: string;
  receiptImageUrl?: string;
  itemsTotal?: number; // يحسب تجريبياً فقط بعد الشراء ولا يدخله المستخدم
  deliveryFee?: number;
  finalTotal?: number;
  paymentMethod: "الدفع عند الاستلام";
  isArchived: boolean;
  cancellationReason?: string;
  unableToFulfillReason?: string;
}

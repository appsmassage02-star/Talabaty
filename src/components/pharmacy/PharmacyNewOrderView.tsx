import React, { useState, useRef, useEffect } from "react";
import {
  PharmacyPrescription,
  PharmacyPrescriptionItem,
  PharmacyPrescriptionImage,
  PharmacyUnit,
} from "../../types/pharmacy";
import {
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  Building2,
  Send,
  Save,
  X,
  Check,
  ChevronDown,
  Pill,
  MapPin,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { deliveryService } from "../../lib/deliveryService";
import { HouseholdAddress } from "../../types";
import { EGYPT_GOVERNORATES } from "../../data/egyptLocations";
import { processDocumentImage } from "../../lib/imageUtils";

interface PharmacyNewOrderViewProps {
  initialPrescription?: PharmacyPrescription | null;
  pharmaciesList: string[];
  onSavePrescription: (
    prescription: Omit<PharmacyPrescription, "id" | "createdAt">
  ) => Promise<any>;
  onCreateOrder: (params: {
    title: string;
    pharmacyName?: string;
    items: PharmacyPrescriptionItem[];
    images: PharmacyPrescriptionImage[];
    addressId?: string;
    deliveryAddress?: string;
    customerNotes?: string;
    prescriptionId?: string;
  }) => Promise<any>;
  onCancel: () => void;
  onAddPharmacy: (name: string) => Promise<string[]>;
}

const PHARMACY_UNITS: PharmacyUnit[] = ["علبة", "شريط", "قطعة", "أمبول"];

// Sample mock medical images for quick one-click testing in browser
const SAMPLE_MOCK_RX_IMAGES = [
  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=600&q=80",
];

export const PharmacyNewOrderView: React.FC<PharmacyNewOrderViewProps> = ({
  initialPrescription,
  pharmaciesList,
  onSavePrescription,
  onCreateOrder,
  onCancel,
  onAddPharmacy,
}) => {
  // Title
  const [title, setTitle] = useState(initialPrescription?.title || "");

  // Pharmacy selection
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>(
    initialPrescription?.pharmacyName || ""
  );
  const [isChangingPharmacy, setIsChangingPharmacy] = useState(
    !initialPrescription?.pharmacyName
  );
  const [customPharmacyInput, setCustomPharmacyInput] = useState("");

  // Items
  const [items, setItems] = useState<PharmacyPrescriptionItem[]>(
    initialPrescription?.items || []
  );
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState<PharmacyUnit>("علبة");
  const [itemNotes, setItemNotes] = useState("");

  // Images (Max 4)
  const [images, setImages] = useState<PharmacyPrescriptionImage[]>(
    initialPrescription?.images || []
  );

  // Address selection & Customer Notes
  const { household, supabaseUser } = useApp();
  const [householdAddresses, setHouseholdAddresses] = useState<HouseholdAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [customDeliveryAddress, setCustomDeliveryAddress] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState<string>("");

  // Inline add Sohag address state
  const [showAddAddressInline, setShowAddAddressInline] = useState(false);
  const [newAddressMarkaz, setNewAddressMarkaz] = useState("سوهاج");
  const [newAddressDetails, setNewAddressDetails] = useState("");
  const [newAddressPhone, setNewAddressPhone] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const sohagGov = EGYPT_GOVERNORATES.find((g) => g.code === "sohag");
  const sohagMarakez = sohagGov?.marakez || [
    "سوهاج",
    "أخميم",
    "طما",
    "طهطا",
    "المراغة",
    "جهينة",
    "ساقلتة",
    "المنشأة",
    "جرجا",
    "البلينا",
    "دار السلام",
  ];

  useEffect(() => {
    let isMounted = true;
    if (household?.id) {
      deliveryService.getHouseholdAddresses(household.id, supabaseUser?.id).then((addrs) => {
        if (!isMounted) return;
        setHouseholdAddresses(addrs);
        // Prefer an address in Sohag
        const sohagAddr = addrs.find((a) =>
          Boolean(
            a.governorate_name?.includes("سوهاج") ||
            a.governorate_code?.toLowerCase().includes("sohag") ||
            a.governorate_code?.toUpperCase() === "EG-SHG"
          )
        );
        const def = sohagAddr || addrs.find((a) => a.is_default) || addrs[0];
        if (def) {
          setSelectedAddressId(def.id);
          setCustomDeliveryAddress(def.detailed_address || "");
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [household?.id, supabaseUser?.id]);

  const handleCreateSohagAddress = async () => {
    if (!household?.id) {
      setErrorMessage("يجب تسجيل المنزل أولاً لإضافة عنوان توصيل");
      return;
    }
    if (!newAddressDetails.trim()) {
      setErrorMessage("يرجى إدخال تفاصيل العنوان (الشارع والحي والعمارة)");
      return;
    }
    setIsSavingAddress(true);
    setErrorMessage(null);
    try {
      const res = await deliveryService.saveAddress(
        {
          household_id: household.id,
          address_label: "عنوان المنزل",
          full_name: supabaseUser?.user_metadata?.full_name || household?.admin_name || "المنزل",
          phone:
            newAddressPhone.trim() ||
            supabaseUser?.user_metadata?.phone ||
            household?.admin_phone ||
            "01000000000",
          country: "مصر",
          governorate_code: "EG-SHG",
          governorate_name: "سوهاج",
          markaz_code: newAddressMarkaz,
          markaz_name: newAddressMarkaz,
          detailed_address: newAddressDetails.trim(),
          is_default: householdAddresses.length === 0,
        },
        supabaseUser?.id
      );

      if (res.success && res.address) {
        setHouseholdAddresses((prev) => [res.address!, ...prev]);
        setSelectedAddressId(res.address.id);
        setCustomDeliveryAddress(res.address.detailed_address || "");
        setShowAddAddressInline(false);
        setNewAddressDetails("");
        setSuccessToast("تمت إضافة عنوان التوصيل في محافظة سوهاج بنجاح!");
      } else {
        setErrorMessage(res.message || "فشل إضافة العنوان");
      }
    } catch (e: any) {
      setErrorMessage(e?.message || "حدث خطأ أثناء حفظ العنوان");
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Validation / Feedback messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hidden File Inputs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill if editing/reordering
  useEffect(() => {
    if (initialPrescription) {
      setTitle(initialPrescription.title || "");
      setSelectedPharmacy(initialPrescription.pharmacyName || "");
      setItems(initialPrescription.items || []);
      setImages(initialPrescription.images || []);
      setIsChangingPharmacy(!initialPrescription.pharmacyName);
    }
  }, [initialPrescription]);

  // Handle adding an item to the list
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = itemName.trim();
    if (!cleanName) {
      setErrorMessage("يرجى كتابة اسم الدواء أو المنتج أولاً.");
      return;
    }

    const newItem: PharmacyPrescriptionItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      quantity: Math.max(1, Number(itemQuantity) || 1),
      unit: itemUnit,
      notes: itemNotes.trim() || undefined,
    };

    setItems((prev) => [...prev, newItem]);
    setItemName("");
    setItemQuantity(1);
    setItemUnit("علبة");
    setItemNotes("");
    setErrorMessage(null);
  };

  const handleUpdateItemQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const newQty = Math.max(1, it.quantity + delta);
          return { ...it, quantity: newQty };
        }
        return it;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const [isProcessingImages, setIsProcessingImages] = useState(false);

  // Image Upload Handling (Max 4, Promise.all parallel compression)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 4) {
      setErrorMessage("يمكن إضافة 4 صور فقط للروشتة.");
      return;
    }

    const fileList: File[] = Array.from(files);
    e.target.value = "";
    setErrorMessage(null);
    setIsProcessingImages(true);

    try {
      const processedResults = await Promise.all(
        fileList.map((file) => processDocumentImage(file, 1200, 1200, 0.8))
      );

      setImages((prev) => {
        const remaining = 4 - prev.length;
        const newImgs = processedResults.slice(0, remaining).map((p, idx) => ({
          id: `img_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          url: p.dataUrl,
          uploadedAt: new Date().toISOString(),
        }));
        return [...prev, ...newImgs];
      });
    } catch (err: any) {
      console.warn("[PharmacyNewOrderView] Error compressing images:", err);
      setErrorMessage(err?.message || "فشل معالجة وضغط الصور المحددة، يرجى المحاولة مرة أخرى.");
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleUpdateImageNote = (imgId: string, note: string) => {
    setImages((prev) =>
      prev.map((im) => (im.id === imgId ? { ...im, note: note || undefined } : im))
    );
  };

  // Quick preset sample image adder (handy for testing edge cases like 4 photos)
  const handleAddSampleImage = () => {
    if (images.length >= 4) {
      setErrorMessage("يمكن إضافة 4 صور فقط للروشتة.");
      return;
    }
    const nextUrl = SAMPLE_MOCK_RX_IMAGES[images.length % SAMPLE_MOCK_RX_IMAGES.length];
    setImages((prev) => [
      ...prev,
      {
        id: `img_sample_${Date.now()}`,
        url: nextUrl,
        uploadedAt: new Date().toISOString(),
      },
    ]);
    setErrorMessage(null);
  };

  const handleDeleteImage = (imgId: string) => {
    setImages((prev) => prev.filter((im) => im.id !== imgId));
    setErrorMessage(null);
  };

  // Pharmacy Selection & Custom Input
  const handleSelectPharmacy = (name: string) => {
    setSelectedPharmacy(name);
    setIsChangingPharmacy(false);
    setCustomPharmacyInput("");
  };

  const handleAddNewCustomPharmacy = async () => {
    const clean = customPharmacyInput.trim();
    if (!clean) return;
    await onAddPharmacy(clean);
    setSelectedPharmacy(clean);
    setCustomPharmacyInput("");
    setIsChangingPharmacy(false);
  };

  // Validation before submission
  const validate = (): boolean => {
    if (images.length === 0 && items.length === 0) {
      setErrorMessage("أضف دواءً واحداً على الأقل أو صورة واحدة للروشتة.");
      return false;
    }
    if (images.length > 4) {
      setErrorMessage("يمكن إضافة 4 صور فقط للروشتة.");
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  // 1. Save locally as saved prescription
  const handleSaveOnly = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const finalTitle = title.trim() || `روشتة ${selectedPharmacy || "علاج"} (${new Date().toLocaleDateString("ar-EG")})`;
      await onSavePrescription({
        title: finalTitle,
        pharmacyName: selectedPharmacy || undefined,
        items,
        images,
      });
      setSuccessToast("تم حفظ الروشتة بنجاح في الروشتات المحفوظة");
      setTimeout(() => {
        onCancel();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err?.message || "فشل حفظ الروشتة");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Save & Send to Driver (Create Order)
  const handleSaveAndSendToDriver = async () => {
    if (!validate()) return;

    if (!selectedAddressId) {
      setErrorMessage(
        "يرجى اختيار أو إضافة عنوان توصيل لمنزلك في محافظة سوهاج أولاً لإرسال الطلب."
      );
      return;
    }

    const chosenAddr = householdAddresses.find((a) => a.id === selectedAddressId);
    if (!chosenAddr) {
      setErrorMessage(
        "العنوان المحدد غير مسجل لمنزلك، يرجى اختيار عنوان صالح أو إضافة عنوان جديد."
      );
      return;
    }

    const isSohag = Boolean(
      chosenAddr.governorate_name?.includes("سوهاج") ||
      chosenAddr.governorate_code?.toLowerCase().includes("sohag") ||
      chosenAddr.governorate_code?.toUpperCase() === "EG-SHG" ||
      chosenAddr.markaz_name?.includes("سوهاج") ||
      chosenAddr.detailed_address?.includes("سوهاج")
    );

    if (!isSohag) {
      setErrorMessage(
        `خدمة الصيدلية متاحة حالياً داخل محافظة سوهاج فقط. العنوان المحدد (${chosenAddr.governorate_name || "خارج سوهاج"}) غير مشمول بالتغطية، يرجى اختيار أو إضافة عنوان داخل سوهاج.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const finalTitle = title.trim() || `طلب روشتة ${selectedPharmacy || "علاج عاجل"}`;
      const deliveryAddressText = customDeliveryAddress.trim() ||
        `${chosenAddr.governorate_name || "سوهاج"} - ${chosenAddr.markaz_name ? chosenAddr.markaz_name + " - " : ""}${chosenAddr.detailed_address || ""}`.trim();

      // 1. Auto-save prescription to user's saved prescriptions so images and medicines are saved in DB
      let savedPrescriptionId: string | undefined = undefined;
      let orderImages = images;

      try {
        const savedRx = await onSavePrescription({
          title: finalTitle,
          pharmacyName: selectedPharmacy || undefined,
          items,
          images,
        });
        if (savedRx?.id) {
          savedPrescriptionId = savedRx.id;
          if (savedRx.images && savedRx.images.length > 0) {
            orderImages = savedRx.images;
          }
        }
      } catch (saveErr) {
        console.warn("[PharmacyNewOrderView] Auto-save prescription warning:", saveErr);
      }

      // 2. Create the delivery order and send to driver
      await onCreateOrder({
        title: finalTitle,
        pharmacyName: selectedPharmacy || undefined,
        items,
        images: orderImages,
        addressId: chosenAddr.id,
        deliveryAddress: deliveryAddressText,
        customerNotes: customerNotes.trim() || undefined,
        prescriptionId: savedPrescriptionId,
      });
      setSuccessToast("تم حفظ الروشتة وإنشاء طلب الصيدلية وإرساله للسائق بنجاح!");
    } catch (err: any) {
      const isTimeout =
        err?.code === "57014" ||
        err?.message?.toLowerCase().includes("timeout") ||
        err?.message?.toLowerCase().includes("canceling statement");

      setErrorMessage(
        isTimeout
          ? "استغرق الخادم وقتاً أطول من المتوقع لمعالجة طلب الصيدلية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة."
          : err?.message || "فشل إرسال الطلب"
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-right">
      {/* Toast Alert */}
      {successToast && (
        <div className="bg-emerald-600 text-white p-3 rounded-xl shadow-md text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-100" />
          <span>{successToast}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in shake">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-5">
        {/* Prescription Title Header */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            اسم الروشتة / العلاج <span className="text-slate-400 font-normal">(اختياري)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: روشتة كشف الصدر، علاج السكر الشهري، مسكن للأطفال..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        {/* 15 — Pharmacy Selection (Optional, change pharmacy button, list + new) */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>الصيدلية المطلوبة</span>
            </span>

            {selectedPharmacy && !isChangingPharmacy && (
              <button
                type="button"
                onClick={() => setIsChangingPharmacy(true)}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:shadow-xs transition-all"
              >
                تغيير الصيدلية
              </button>
            )}
          </div>

          {!selectedPharmacy && !isChangingPharmacy ? (
            <div className="flex items-center justify-between py-1 text-slate-500 text-xs">
              <span>لم يتم تحديد صيدلية (أي صيدلية قريبة)</span>
              <button
                type="button"
                onClick={() => setIsChangingPharmacy(true)}
                className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
              >
                تحديد صيدلية
              </button>
            </div>
          ) : !isChangingPharmacy ? (
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-bold">
              <span className="flex items-center space-x-1.5 space-x-reverse">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{selectedPharmacy}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">محددة للطلب</span>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                اختر صيدلية من المفضلة أو اكتب اسم صيدلية جديدة (الاختيار اختياري):
              </p>

              {/* Quick Pills */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPharmacy("");
                    setIsChangingPharmacy(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                    !selectedPharmacy
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                  }`}
                >
                  بدون تحديد (أي صيدلية)
                </button>
                {pharmaciesList.map((pharmacy) => (
                  <button
                    key={pharmacy}
                    type="button"
                    onClick={() => handleSelectPharmacy(pharmacy)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      selectedPharmacy === pharmacy
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    {pharmacy}
                  </button>
                ))}
              </div>

              {/* Add Custom Pharmacy Input */}
              <div className="flex items-center space-x-1.5 space-x-reverse pt-1">
                <input
                  type="text"
                  value={customPharmacyInput}
                  onChange={(e) => setCustomPharmacyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNewCustomPharmacy();
                    }
                  }}
                  placeholder="أو اكتب اسم صيدلية جديدة..."
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddNewCustomPharmacy}
                  disabled={!customPharmacyInput.trim()}
                  className="px-3 py-1.5 bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-all shrink-0"
                >
                  إضافة
                </button>
                {selectedPharmacy && (
                  <button
                    type="button"
                    onClick={() => setIsChangingPharmacy(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600"
                    title="إلغاء التغيير"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4 — Prescription Images Area (Max 4, Camera, Gallery, Preview, Counter) */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                صور الروشتة أو علب الدواء
              </span>
              <span className="text-[11px] text-slate-500">
                يمكن تصوير الروشتة أو رفعها من المعرض (الحد الأقصى 4 صور)
              </span>
            </div>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                images.length === 4
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {images.length} / 4
            </span>
          </div>

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={galleryInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            multiple
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {/* Action Buttons to Add Images */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                if (images.length >= 4) {
                  setErrorMessage("يمكن إضافة 4 صور فقط للروشتة.");
                  return;
                }
                cameraInputRef.current?.click();
              }}
              disabled={images.length >= 4}
              className="flex items-center justify-center space-x-1.5 space-x-reverse py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100/80 disabled:opacity-50 text-emerald-800 rounded-xl border border-emerald-200 font-bold text-xs transition-all shadow-2xs cursor-pointer"
            >
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>التقاط بالكاميرا</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (images.length >= 4) {
                  setErrorMessage("يمكن إضافة 4 صور فقط للروشتة.");
                  return;
                }
                galleryInputRef.current?.click();
              }}
              disabled={images.length >= 4}
              className="flex items-center justify-center space-x-1.5 space-x-reverse py-2.5 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-xl border border-slate-200 font-bold text-xs transition-all shadow-2xs cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-slate-500" />
              <span>معرض الصور</span>
            </button>

            <button
              type="button"
              onClick={handleAddSampleImage}
              disabled={images.length >= 4}
              className="col-span-2 sm:col-span-1 flex items-center justify-center space-x-1.5 space-x-reverse py-2.5 px-3 bg-teal-50 hover:bg-teal-100/80 disabled:opacity-50 text-teal-800 rounded-xl border border-teal-200 font-bold text-[11px] transition-all shadow-2xs cursor-pointer"
              title="إضافة صورة طبية تجريبية فوراً لتجربة الرفع"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>صورة تجريبية جاهزة</span>
            </button>
          </div>

          {/* Processing Indicator */}
          {isProcessingImages && (
            <div className="flex items-center space-x-2 space-x-reverse py-2 px-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
              <span>جاري تجهيز وضغط الصور بأعلى وضوح...</span>
            </div>
          )}

          {/* Images Preview Grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs flex flex-col"
                >
                  <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                    <img
                      src={img.url}
                      alt={`روشتة ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Order Number Badge */}
                    <span className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      صورة {index + 1}
                    </span>
                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-700 transition-all cursor-pointer"
                      title="حذف الصورة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Image Note Input */}
                  <div className="p-1.5 bg-slate-50 border-t border-slate-100">
                    <input
                      type="text"
                      value={img.note || ""}
                      onChange={(e) => handleUpdateImageNote(img.id, e.target.value)}
                      placeholder="ملاحظة للصورة (اختياري)..."
                      className="w-full text-[10px] text-slate-800 placeholder-slate-400 bg-white px-1.5 py-1 rounded border border-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3 — Add Medication or Product Area (Strictly NO price) */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              إضافة دواء أو منتج بالاسم
            </span>
            <span className="text-[11px] text-slate-500">
              يمكنك كتابة الأصناف المطلوبة والكميات (المستخدم لا يدخل أي أسعار)
            </span>
          </div>

          {/* Input Form for single item */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              {/* Product Name */}
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  placeholder="اسم الدواء أو المنتج (مثال: أوجمنتين 1 جم)..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Quantity */}
              <div className="sm:col-span-3 flex items-center space-x-1 space-x-reverse bg-white border border-slate-200 rounded-xl px-2 py-1">
                <button
                  type="button"
                  onClick={() => setItemQuantity((prev) => Math.max(1, prev - 1))}
                  className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={itemQuantity}
                  onChange={(e) =>
                    setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-10 text-center text-xs font-bold text-slate-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setItemQuantity((prev) => prev + 1)}
                  className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                >
                  +
                </button>
              </div>

              {/* Unit Dropdown */}
              <div className="sm:col-span-3">
                <select
                  value={itemUnit}
                  onChange={(e) => setItemUnit(e.target.value as PharmacyUnit)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
                >
                  {PHARMACY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Notes & Add Button */}
            <div className="flex items-center space-x-2 space-x-reverse pt-1">
              <input
                type="text"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="ملاحظة إضافية للجرعة أو البديل (اختياري)..."
                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-700 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 space-x-reverse cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          {/* List of Added Items */}
          {items.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-600 px-1">
                الأصناف المضافة للطلب ({items.length}):
              </div>
              <div className="divide-y divide-slate-100 bg-slate-50/70 rounded-2xl border border-slate-200 overflow-hidden">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    className="p-3 flex items-center justify-between hover:bg-white transition-colors"
                  >
                    <div className="flex items-start space-x-2 space-x-reverse">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block leading-tight">
                          {it.name}
                        </span>
                        {it.notes && (
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {it.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 space-x-reverse">
                      {/* Quantity Stepper */}
                      <div className="flex items-center space-x-1 space-x-reverse bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(it.id, -1)}
                          className="text-slate-400 hover:text-slate-700 font-bold px-1"
                        >
                          -
                        </button>
                        <span className="font-bold text-slate-800">
                          {it.quantity} {it.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(it.id, 1)}
                          className="text-slate-400 hover:text-slate-700 font-bold px-1"
                        >
                          +
                        </button>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(it.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Delivery Address & Instructions Section */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>عنوان التوصيل للمنزل</span>
            </span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              توصيل دليفري (محافظة سوهاج)
            </span>
          </div>

          {householdAddresses.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={selectedAddressId}
                  onChange={(e) => {
                    setSelectedAddressId(e.target.value);
                    const found = householdAddresses.find((a) => a.id === e.target.value);
                    if (found) {
                      setCustomDeliveryAddress(found.detailed_address || "");
                    }
                  }}
                  className="flex-1 text-xs p-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  {householdAddresses.map((addr) => {
                    const isSohag = Boolean(
                      addr.governorate_name?.includes("سوهاج") ||
                      addr.governorate_code?.toLowerCase().includes("sohag") ||
                      addr.governorate_code?.toUpperCase() === "EG-SHG" ||
                      addr.markaz_name?.includes("سوهاج")
                    );
                    return (
                      <option key={addr.id} value={addr.id}>
                        {isSohag ? "✓ [سوهاج]" : "⚠️ [خارج التغطية]"} {addr.address_label || "عنوان"} — {addr.governorate_name || "سوهاج"} ({addr.markaz_name || ""}) - {addr.detailed_address || ""}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  onClick={() => setShowAddAddressInline(!showAddAddressInline)}
                  className="px-2.5 py-2.5 bg-white hover:bg-slate-100 text-emerald-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1 space-x-reverse"
                  title="إضافة عنوان جديد في سوهاج"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>عنوان جديد</span>
                </button>
              </div>

              {/* Outside Sohag warning if selected address is outside Sohag */}
              {(() => {
                const sel = householdAddresses.find((a) => a.id === selectedAddressId);
                if (
                  sel &&
                  !sel.governorate_name?.includes("سوهاج") &&
                  !sel.governorate_code?.toLowerCase().includes("sohag") &&
                  sel.governorate_code?.toUpperCase() !== "EG-SHG" &&
                  !sel.markaz_name?.includes("سوهاج")
                ) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-[11px] font-bold flex items-center space-x-1.5 space-x-reverse">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        تنبيه: العنوان المحدد يقع في ({sel.governorate_name || "خارج سوهاج"}). خدمة الصيدلية متاحة حالياً داخل محافظة سوهاج فقط. يرجى اختيار عنوان داخل سوهاج أو النقر على "عنوان جديد".
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs space-y-1.5 text-right">
                <div className="flex items-center space-x-1.5 space-x-reverse text-amber-900 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>لا يوجد عنوان مسجل لمنزلك حتى الآن</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  تتطلب خدمة الصيدلية عنوان توصيل مسجل لمنزلك داخل محافظة سوهاج لربط الطلب بالمندوب. يرجى إضافة عنوانك أدناه.
                </p>
                {!showAddAddressInline && (
                  <button
                    type="button"
                    onClick={() => setShowAddAddressInline(true)}
                    className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 space-x-reverse cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة عنوان جديد في سوهاج الآن</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Inline Form to Add a Sohag Address */}
          {showAddAddressInline && (
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-emerald-950 flex items-center space-x-1 space-x-reverse">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>إضافة عنوان توصيل جديد في محافظة سوهاج</span>
                </span>
                {householdAddresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddAddressInline(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-right">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    المركز / الحي (محافظة سوهاج)
                  </label>
                  <select
                    value={newAddressMarkaz}
                    onChange={(e) => setNewAddressMarkaz(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    {sohagMarakez.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    رقم هاتف التواصل
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={newAddressPhone}
                    onChange={(e) => setNewAddressPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  العنوان التفصيلي (الشارع، رقم العمارة، الشقة، علامة مميزة)
                </label>
                <input
                  type="text"
                  value={newAddressDetails}
                  onChange={(e) => setNewAddressDetails(e.target.value)}
                  placeholder="مثال: شارع سيتي - برج الأطباء - الدور الرابع"
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div className="flex items-center space-x-2 space-x-reverse pt-1">
                <button
                  type="button"
                  onClick={handleCreateSohagAddress}
                  disabled={isSavingAddress}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 space-x-reverse cursor-pointer"
                >
                  {isSavingAddress ? (
                    <span>جاري الحفظ...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>حفظ العنوان واعتماده للطلب</span>
                    </>
                  )}
                </button>
                {householdAddresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddAddressInline(false)}
                    disabled={isSavingAddress}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Delivery Notes / Customer Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1 space-x-reverse">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>تعليمات وملاحظات للمندوب والصيدلية (اختياري)</span>
            </label>
            <input
              type="text"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="مثال: يرجى التأكد من تاريخ الصلاحية، أو الاتصال قبل الوصول..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 5 — Bottom Action Buttons: حفظ / حفظ وإرسال للسائق / إلغاء */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
        >
          إلغاء
        </button>

        <div className="w-full sm:w-auto flex items-center space-x-2 space-x-reverse">
          {/* حفظ في الروشتات المحفوظة */}
          <button
            type="button"
            onClick={handleSaveOnly}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 space-x-reverse px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4 text-slate-600" />
            <span>حفظ</span>
          </button>

          {/* حفظ وإرسال للسائق */}
          <button
            type="button"
            onClick={handleSaveAndSendToDriver}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 space-x-reverse px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>حفظ وإرسال للسائق</span>
          </button>
        </div>
      </div>
    </div>
  );
};

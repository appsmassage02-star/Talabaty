import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { useApp } from "../context/AppContext";
import { QrLiveScanner } from "./QrLiveScanner";
import {
  X,
  QrCode as QrIcon,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  Camera,
  Sparkles,
  Download,
  Share2,
  ExternalLink,
  Shield,
  Layers,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

export const QrCodeModal: React.FC = () => {
  const {
    isQrModalOpen,
    setIsQrModalOpen,
    household,
    activeRole,
    setActiveRole,
    pairHomePhone,
    homePermissions,
    activePairingToken,
    generatePairingToken,
  } = useApp();

  const [qrSvg, setQrSvg] = useState<string>("");
  const [qrPngUrl, setQrPngUrl] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeTabMode, setActiveTabMode] = useState<"show_qr" | "live_scan">("show_qr");
  const [pairSuccessToast, setPairSuccessToast] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  // Authoritative Temporary Pairing Token from Supabase (Dynamic 15-minute token only)
  const pairCode = activePairingToken?.token || "";
  const householdName = household?.name || "منزل العائلة";
  const householdId = household?.id || "";

  // Auto generate a pairing token if admin has household but no active token yet
  useEffect(() => {
    if (isQrModalOpen && activeRole === "admin" && household?.id && !pairCode && !isGeneratingToken) {
      setIsGeneratingToken(true);
      generatePairingToken(15).finally(() => setIsGeneratingToken(false));
    }
  }, [isQrModalOpen, activeRole, household?.id, pairCode]);

  const getPairingUrl = () => {
    if (typeof window === "undefined" || !pairCode) return "";
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?token=${encodeURIComponent(pairCode)}&hh=${encodeURIComponent(householdId)}`;
  };

  const pairingUrl = getPairingUrl();

  // Generate high-resolution SVG and PNG on load
  useEffect(() => {
    if (isQrModalOpen && pairingUrl) {
      // 1. Generate SVG for crisp vector display
      QRCode.toString(
        pairingUrl,
        {
          type: "svg",
          margin: 2,
          color: {
            dark: "#064E3B",
            light: "#FFFFFF",
          },
        },
        (err, svgString) => {
          if (!err && svgString) {
            setQrSvg(svgString);
          }
        }
      );

      // 2. Generate Data URL (PNG) for instant download
      QRCode.toDataURL(
        pairingUrl,
        {
          width: 800,
          margin: 3,
          color: {
            dark: "#064E3B",
            light: "#FFFFFF",
          },
        },
        (err, url) => {
          if (!err && url) {
            setQrPngUrl(url);
          }
        }
      );
    }
  }, [isQrModalOpen, pairingUrl]);

  if (!isQrModalOpen) return null;

  // Copy Pair Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy Direct Deep Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(pairingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Download QR Code image as PNG
  const handleDownloadPng = () => {
    if (!qrPngUrl) return;
    const a = document.createElement("a");
    a.href = qrPngUrl;
    a.download = `QR-Talabati-${pairCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Native Web Share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `انضمام إلى ${householdName} - طلباتي`,
          text: `افتح الرابط التالي أو امسح كود الـ QR للانضمام إلى (${householdName}) كـ هاتف المنزل في تطبيق طلباتي:`,
          url: pairingUrl,
        });
      } catch (err) {
        // Share dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  // Live scanner handler
  const handleScanDetected = (scannedData: string) => {
    setIsScannerOpen(false);
    setPairSuccessToast(`تم مسح الرمز بنجاح! جاري الربط بهاتف المسؤول...`);

    setTimeout(() => {
      pairHomePhone(scannedData);
      setPairSuccessToast(null);
      setIsQrModalOpen(false);
    }, 1000);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
        dir="rtl"
      >
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 text-right overflow-hidden relative animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
          {/* Close Button */}
          <button
            onClick={() => setIsQrModalOpen(false)}
            className="absolute top-5 left-5 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center space-x-3 space-x-reverse mb-4 pr-1">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
              <QrIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {activeRole === "admin"
                  ? "رمز QR الحقيقي لربط هاتف المنزل"
                  : "اقتران ومسح رمز QR للمنزل"}
              </h2>
              <p className="text-xs text-slate-500">
                {activeRole === "admin"
                  ? `امسح الرمز من كاميرا هاتف المنزل لربطه فوراً بـ (${householdName})`
                  : "امسح الرمز المعروض على هاتف المسؤول للانضمام المباشر"}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl mb-4 text-xs font-bold">
            <button
              onClick={() => setActiveTabMode("show_qr")}
              className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 space-x-reverse ${
                activeTabMode === "show_qr"
                  ? "bg-white text-slate-900 shadow-2xs font-black"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <QrIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>عرض رمز QR (هاتف المسؤول)</span>
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 space-x-reverse text-slate-700 hover:bg-white/60"
            >
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span>فتح الكاميرا للمسح 📷</span>
            </button>
          </div>

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
            {/* QR Display Card */}
            <div className="bg-gradient-to-b from-emerald-50/70 via-white to-slate-50 p-4 sm:p-5 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
              {/* Scan Ready Badge */}
              <div className="mb-3 inline-flex items-center space-x-1.5 space-x-reverse px-2.5 py-1 bg-emerald-100/90 border border-emerald-200 rounded-full text-emerald-800 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>رمز مفعل وحقيقي • جاهز للمسح عبر الكاميرا</span>
              </div>

              {/* QR Image Box */}
              <div className="relative group">
                {qrSvg ? (
                  <div
                    className="w-52 h-52 sm:w-56 sm:h-56 bg-white p-3.5 rounded-2xl shadow-md border-2 border-emerald-200/80 flex items-center justify-center transition-transform hover:scale-[1.02]"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : (
                  <div className="w-52 h-52 sm:w-56 sm:h-56 bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
                    <QrIcon className="w-12 h-12 text-slate-300" />
                  </div>
                )}
              </div>

              {/* Household Info & Token Expiration Pill */}
              <div className="mt-3.5 flex flex-col items-center justify-center gap-2">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs font-bold text-slate-800 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                    🏡 {householdName}
                  </span>
                  <span className="text-xs font-black font-mono text-emerald-800 bg-emerald-100 px-3 py-1 rounded-xl border border-emerald-200">
                    رمز الاقتران: {pairCode || "جاري التوليد..."}
                  </span>
                </div>

                {activePairingToken && (
                  <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2">
                    <span>
                      صالح لمدة 15 دقيقة (حتى {new Date(activePairingToken.expiresAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })})
                    </span>
                    {activeRole === "admin" && (
                      <button
                        onClick={async () => {
                          setIsGeneratingToken(true);
                          await generatePairingToken(15);
                          setIsGeneratingToken(false);
                        }}
                        disabled={isGeneratingToken}
                        className="text-emerald-700 hover:text-emerald-800 underline text-[10px] font-bold"
                      >
                        {isGeneratingToken ? "جاري التحديث..." : "توليد رمز جديد"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2.5 text-xs">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>كيف يعمل الربط اللحظي؟</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-slate-600 text-[11px] leading-relaxed">
                <div className="flex items-start space-x-2 space-x-reverse">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">
                    ١
                  </span>
                  <span>
                    افتح <strong>تطبيق الكاميرا المدمج</strong> في هاتف المنزل أو جوال أي فرد من العائلة.
                  </span>
                </div>
                <div className="flex items-start space-x-2 space-x-reverse">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">
                    ٢
                  </span>
                  <span>
                    وجّه الكاميرا نحو كود الـ QR أعلاه وانقر على الرابط الذي يظهر على الشاشة.
                  </span>
                </div>
                <div className="flex items-start space-x-2 space-x-reverse">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">
                    ٣
                  </span>
                  <span>
                    يتم تسجيل الدخول والاقتران كـ <strong>(هاتف المنزل)</strong> وتطبيق الصلاحيات فوراً دون كلمة مرور!
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {/* Copy Pair Code Button */}
              <button
                onClick={handleCopyCode}
                className="p-2.5 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all shadow-2xs"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-500" />
                )}
                <span>{copiedCode ? "تم نسخ الكود" : "نسخ رمز الربط"}</span>
              </button>

              {/* Copy Direct Link Button */}
              <button
                onClick={handleCopyLink}
                className="p-2.5 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all shadow-2xs"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                )}
                <span>{copiedLink ? "تم نسخ الرابط" : "نسخ رابط الاقتران"}</span>
              </button>

              {/* Download PNG for Fridge / Printing */}
              <button
                onClick={handleDownloadPng}
                className="col-span-2 sm:col-span-1 p-2.5 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex sm:flex-col items-center justify-center space-x-1.5 sm:space-x-0 sm:space-y-1 transition-all shadow-2xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>حفظ الرمز للطباعة</span>
              </button>
            </div>

            {/* Share or Instant Scanner Row */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleShare}
                className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>مشاركة كود الربط عبر واتساب</span>
              </button>

              <button
                onClick={() => setIsScannerOpen(true)}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 space-x-reverse shadow-xs"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>مسح من هذا الهاتف</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live QR Scanner Modal Overlay */}
      {isScannerOpen && (
        <QrLiveScanner
          onScan={handleScanDetected}
          onClose={() => setIsScannerOpen(false)}
          title="مسح رمز QR لربط هاتف المنزل"
          subtitle={`وجّه الكاميرا نحو كود الـ QR الخاص بمنزل (${householdName})`}
        />
      )}
    </>
  );
};

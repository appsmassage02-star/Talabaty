import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  Camera,
  X,
  Flashlight,
  Upload,
  AlertCircle,
  RefreshCw,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface QrLiveScannerProps {
  onScan: (scannedText: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const QrLiveScanner: React.FC<QrLiveScannerProps> = ({
  onScan,
  onClose,
  title = "مسح رمز QR لربط هاتف المنزل",
  subtitle = "وجّه الكاميرا نحو كود QR الظاهر على هاتف المسؤول",
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);

  // Play short pleasant success sound using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15); // A6 note
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {
      // AudioContext might be blocked until user gesture, ignore
    }
  };

  // Start Camera
  const startCamera = async () => {
    setErrorMessage(null);
    setHasPermission(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("المتصفح لا يدعم الوصول المباشر لكاميرا الهاتف، يرجى استخدام متصفح حديث مثل Chrome أو Safari");
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }

      // Check for torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        setHasTorch(!!capabilities.torch);
      }

      setHasPermission(true);
      requestScanFrame();
    } catch (err: any) {
      console.error("Camera access error:", err);
      setHasPermission(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMessage(
          "تم رفض إذن الوصول للكاميرا. يرجى السماح للتطبيق باستخدام الكاميرا من إعدادات الهاتف (أذونات التطبيق -> الكاميرا) ثم الضغط على إعادة المحاولة، أو يمكنك اختيار صورة رمز الـ QR مباشرة من المعرض."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorMessage("لم يتم العثور على كاميرا في هذا الجهاز. يمكنك اختيار صورة كود الـ QR من المعرض.");
      } else {
        setErrorMessage(err.message || "تعذر تشغيل الكاميرا حالياً. يمكنك استخدام خيار اختيار صورة الـ QR من المعرض أدناه.");
      }
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextState = !torchEnabled;
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchEnabled(nextState);
      } catch (e) {
        console.warn("Torch failed:", e);
      }
    }
  };

  // Frame scanner loop using jsQR
  const requestScanFrame = () => {
    if (!isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data && code.data.trim()) {
          // Success!
          setIsScanning(false);
          setScanSuccess(true);
          playBeep();
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([80, 40, 80]);
          }

          stopCamera();

          setTimeout(() => {
            onScan(code.data);
          }, 300);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(requestScanFrame);
  };

  // Handle uploaded QR image file fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            setScanSuccess(true);
            playBeep();
            stopCamera();
            setTimeout(() => {
              onScan(code.data);
            }, 300);
          } else {
            setErrorMessage("لم يتم العثور على رمز QR صالح في الصورة المحددة. يرجى اختيار صورة واضحة.");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700/80 max-w-md w-full overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport / Scanning Area */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[360px] bg-black flex items-center justify-center overflow-hidden">
          {/* Video Stream Element */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Hidden Canvas for Decoding */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Overlay UI */}
          {hasPermission && !scanSuccess && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              {/* Outer Dim Mask with Viewfinder */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72">
                {/* 4 Corner Markers */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />

                {/* Animated Laser Beam */}
                <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399] animate-bounce top-1/2 -translate-y-1/2" />

                {/* Subtle Grid / Target Overlay */}
                <div className="absolute inset-0 border border-emerald-400/20 rounded-2xl flex items-center justify-center">
                  <div className="w-12 h-12 border border-emerald-400/30 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-400/40" />
                  </div>
                </div>
              </div>

              <span className="mt-4 px-3 py-1 bg-slate-900/80 backdrop-blur-sm text-emerald-300 text-xs font-bold rounded-full border border-emerald-500/30">
                ضع رمز الـ QR داخل الإطار
              </span>
            </div>
          )}

          {/* Success State Overlay */}
          {scanSuccess && (
            <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/50 mb-3 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-white">تم مسح الكود بنجاح!</h4>
              <p className="text-xs text-emerald-200 mt-1">جاري إتمام الربط التلقائي بهاتف المسؤول...</p>
            </div>
          )}

          {/* Error / Permission Denied State */}
          {hasPermission === false && (
            <div className="absolute inset-0 bg-slate-900 p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">تعذر تشغيل الكاميرا</h4>
              <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                {errorMessage || "يرجى التحقق من إذن الكاميرا أو استخدام خيار رفع صورة الـ QR أدناه."}
              </p>
              <div className="flex items-center space-x-2 space-x-reverse pt-2">
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          {/* Torch toggle if supported */}
          {hasTorch ? (
            <button
              onClick={toggleTorch}
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-all ${
                torchEnabled
                  ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Flashlight className="w-4 h-4" />
              <span>{torchEnabled ? "إطفاء الكشاف" : "تشغيل الكشاف"}</span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-500">مسح لحظي بتقنية jsQR</div>
          )}

          {/* Upload QR Image from Gallery Fallback */}
          <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-all border border-slate-700">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>اختر صورة من المعرض</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

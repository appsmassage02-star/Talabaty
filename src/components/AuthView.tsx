import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { QrLiveScanner } from "./QrLiveScanner";
import {
  ShieldCheck,
  Smartphone,
  Home,
  QrCode,
  KeyRound,
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  HelpCircle,
  Hash,
  Shield,
  Layers,
  Camera,
} from "lucide-react";

export const AuthView: React.FC = () => {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInHomePhone,
    signUpHomePhone,
    resetPassword,
    joinHouseholdByCode,
    activeRole,
    setActiveRole,
    household,
    supabaseUser,
    isSupabaseConnected,
    homePermissions,
    setActiveTab,
  } = useApp();

  // Mode: "admin_login" | "admin_signup" | "member_join" | "forgot_password"
  const [authMode, setAuthMode] = useState<
    "admin_login" | "admin_signup" | "member_join" | "forgot_password"
  >("admin_login");

  // Home phone sub-mode: "register" | "login" | "quick_pair"
  const [homePhoneSubMode, setHomePhoneSubMode] = useState<"register" | "login" | "quick_pair">("register");

  // Admin form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Household Member / Home Phone fields (No email shown to user)
  const [username, setUsername] = useState("");
  const [pairCodeInput, setPairCodeInput] = useState("");
  const [memberName, setMemberName] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset errors when changing modes
  const switchMode = (
    mode: "admin_login" | "admin_signup" | "member_join" | "forgot_password"
  ) => {
    setAuthMode(mode);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Google Sign-In for Admin
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMessage(error.message || "فشل تسجيل الدخول عبر حساب Google");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ أثناء الاتصال بـ Google");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        setErrorMessage(
          error.message?.includes("Invalid login credentials")
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
            : error.message?.includes("Email not confirmed")
            ? "لم يتم تأكيد البريد الإلكتروني بعد. يرجى فتح رابط التفعيل المرسل إلى بريدك لتتمكن من تسجيل الدخول."
            : error.message || "حدث خطأ أثناء تسجيل الدخول"
        );
      } else {
        setSuccessMessage("تم التحقق بنجاح، جاري مزامنة بيانات المنزل...");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Admin Registration (Create Household)
  const handleAdminSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.endsWith("@talbat.com") || cleanEmail.endsWith("@talabat.com")) {
      setErrorMessage("لا يمكن استخدام هذا النطاق (@talbat.com) لحسابات المسؤولين. يرجى استخدام بريدك الإلكتروني الحقيقي.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("كلمة المرور يجب أن لا تقل عن 6 خانات");
      return;
    }

    setIsLoading(true);

    try {
      const res = await signUpWithEmail(
        cleanEmail,
        password,
        fullName || "المسؤول",
        phone,
        householdName || "منزل العائلة"
      );

      if (res.error) {
        setErrorMessage(res.error.message || "فشل إنشاء الحساب الجديد");
      } else if (res.requiresConfirmation) {
        // Requirement 2 & 5: Clear notice that confirmation is required before login
        setPassword("");
        setSuccessMessage(
          "تم إرسال رابط تأكيد الحساب إلى بريدك الإلكتروني بنجاح. يرجى فتح صندوق الوارد والضغط على رابط التفعيل أولاً، ثم تسجيل الدخول."
        );
      } else {
        setSuccessMessage("تم إنشاء الحساب بنجاح! جاري مزامنة بيانات المنزل...");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Home Phone Registration (Username + Password + Pairing Code / Device Name)
  const handleHomePhoneRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setErrorMessage("يرجى إدخال اسم مستخدم لهاتف المنزل (مثال: kitchen_phone أو home1)");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage("كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام");
      return;
    }
    const cleanCode = pairCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage("يرجى إدخال رمز ربط المنزل الممنوح من المسؤول أو مسح كود QR لإقران الهاتف بالمنزل");
      return;
    }

    setIsLoading(true);
    try {
      const res = await signUpHomePhone(
        cleanUser,
        password,
        memberName.trim() || cleanUser || "هاتف المنزل",
        cleanCode
      );

      if (res.error) {
        setErrorMessage(res.error.message || "فشل تسجيل هاتف المنزل");
      } else {
        setSuccessMessage(
          res.message || "تم تسجيل حساب هاتف المنزل وإقرانه بنجاح! جاري فتح الشاشات..."
        );
        setTimeout(() => {
          setActiveTab("categories");
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "حدث خطأ أثناء تسجيل هاتف المنزل");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Home Phone Login (Legacy Username + Password)
  const handleHomePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setErrorMessage("يرجى إدخال اسم مستخدم صالح لهاتف المنزل");
      return;
    }
    if (!password) {
      setErrorMessage("يرجى إدخال كلمة المرور");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signInHomePhone(cleanUser, password);
      if (error) {
        setErrorMessage(
          error.message?.includes("Invalid login credentials")
            ? "اسم المستخدم أو كلمة المرور غير صحيحة"
            : error.message || "فشل تسجيل الدخول"
        );
      } else {
        setSuccessMessage("تم تسجيل الدخول بنجاح! جاري مزامنة بيانات المنزل...");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setIsLoading(false);
    }
  };

  // Direct Pairing via Temporary Token / Code
  const handleMemberJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCode = pairCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage("يرجى إدخال رمز ربط المنزل المؤقت الممنوح من المسؤول أو مسح كود QR");
      return;
    }

    setIsLoading(true);
    try {
      const res = await joinHouseholdByCode(cleanCode, memberName.trim() || "هاتف المنزل");
      if (!res.success) {
        setErrorMessage(res.message || "رمز الربط غير صالح أو منتهي الصلاحية أو تم استخدامه مسبقاً");
      } else {
        setSuccessMessage(`تم ربط هاتف المنزل بنجاح بمنزل (${res.householdName || "المنزل"})! جاري فتح الشاشات...`);
        setTimeout(() => {
          setActiveTab("categories");
        }, 1000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "حدث خطأ أثناء إتمام عملية الاقتران");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle live camera QR scan result (Instant Direct Pairing)
  const handleScannerResult = async (scannedData: string) => {
    setIsScannerOpen(false);
    let targetCode = scannedData.trim();

    // 1. Check if URL (?token=... or ?pair=... or ?code=...)
    if (
      targetCode.includes("?") &&
      (targetCode.includes("token=") ||
        targetCode.includes("pair=") ||
        targetCode.includes("code=") ||
        targetCode.includes("join="))
    ) {
      try {
        const url = new URL(targetCode, window.location.origin);
        const code =
          url.searchParams.get("token") ||
          url.searchParams.get("pair") ||
          url.searchParams.get("join") ||
          url.searchParams.get("code");
        if (code) targetCode = code;
      } catch {
        const match = targetCode.match(/[?&](?:token|pair|join|code)=([^&#]+)/i);
        if (match && match[1]) targetCode = decodeURIComponent(match[1]);
      }
    }

    // 2. Check if JSON
    if (targetCode.startsWith("{") && targetCode.endsWith("}")) {
      try {
        const parsed = JSON.parse(targetCode);
        if (parsed.token) targetCode = parsed.token;
        else if (parsed.pairCode) targetCode = parsed.pairCode;
      } catch {}
    }

    const cleanCode = targetCode.trim().toUpperCase();
    setPairCodeInput(cleanCode);

    // If on registration tab, populate the pairing code and notify user
    if (homePhoneSubMode === "register") {
      setSuccessMessage(`تم مسح رمز الاقتران (${cleanCode}) بنجاح! أكمل اسم المستخدم وكلمة المرور لإتمام التسجيل.`);
      return;
    }

    // If on quick pair tab, auto join
    setIsLoading(true);
    try {
      const res = await joinHouseholdByCode(cleanCode, memberName.trim() || "هاتف المنزل");
      if (res.success) {
        setSuccessMessage(`تم مسح الرمز والربط بنجاح بمنزل (${res.householdName || "المنزل"})! جاري التحويل...`);
        setTimeout(() => {
          setActiveTab("categories");
        }, 1000);
      } else {
        setErrorMessage(res.message || "رمز الربط غير صالح أو تم استخدامه أو انتهت صلاحيته");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "فشلت عملية الربط التلقائي");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const { error } = await resetPassword(email);
      if (error) {
        setErrorMessage(error.message || "تعذر إرسال رابط الاستعادة");
      } else {
        setSuccessMessage(
          "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح"
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-2 sm:px-4 animate-in fade-in duration-200">
      {/* Header Banner with Circular App Logo */}
      <div className="text-center mb-7 flex flex-col items-center space-y-3">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white border-4 border-emerald-500/30 p-1 shadow-lg shadow-emerald-600/15 overflow-hidden flex items-center justify-center transition-transform hover:scale-105">
          <img
            src="/app-logo.png"
            alt="طلباتي"
            className="w-full h-full object-cover rounded-full"
          />
        </div>

        <div className="inline-flex items-center space-x-2 space-x-reverse px-3.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>تطبيق إدارة طلبات ومشتريات وميزانية المنزل الذكي</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          مرحباً بك في تطبيق طلباتي
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          اختر نوع حسابك لتسجيل الدخول كمسؤول أو الانضمام المباشر كـ هاتف المنزل
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Role Selector Cards */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            اختر نوع الوصول:
          </div>

          {/* Option 1: Admin */}
          <button
            type="button"
            onClick={() => switchMode("admin_login")}
            className={`w-full p-4 rounded-2xl border text-right transition-all flex items-start space-x-3 space-x-reverse ${
              authMode === "admin_login" ||
              authMode === "admin_signup" ||
              authMode === "forgot_password"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-600/20"
                : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                authMode === "admin_login" ||
                authMode === "admin_signup" ||
                authMode === "forgot_password"
                  ? "bg-white/20 text-white"
                  : "bg-emerald-50 text-emerald-600 border border-emerald-200"
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">مسؤول المنزل (Admin)</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    authMode === "admin_login" ||
                    authMode === "admin_signup" ||
                    authMode === "forgot_password"
                      ? "bg-white/25 text-white"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  تحكم كامل
                </span>
              </div>
              <p
                className={`text-xs mt-1 leading-relaxed ${
                  authMode === "admin_login" ||
                  authMode === "admin_signup" ||
                  authMode === "forgot_password"
                    ? "text-emerald-50"
                    : "text-slate-500"
                }`}
              >
                تسجيل الدخول بالحساب لإدارة الميزانية، تحديد الصلاحيات، وإضافة الأقسام والمصروفات.
              </p>
            </div>
          </button>

          {/* Option 2: Household Member */}
          <button
            type="button"
            onClick={() => switchMode("member_join")}
            className={`w-full p-4 rounded-2xl border text-right transition-all flex items-start space-x-3 space-x-reverse ${
              authMode === "member_join"
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 ring-2 ring-blue-600/20"
                : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                authMode === "member_join"
                  ? "bg-white/20 text-white"
                  : "bg-blue-50 text-blue-600 border border-blue-200"
              }`}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">هاتف المنزل / فرد عائلة</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    authMode === "member_join"
                      ? "bg-white/25 text-white"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  برمز الربط
                </span>
              </div>
              <p
                className={`text-xs mt-1 leading-relaxed ${
                  authMode === "member_join"
                    ? "text-blue-50"
                    : "text-slate-500"
                }`}
              >
                الانضمام السريع برمز الربط (Pair Code) للوصول للشاشات المصرح بها وإضافة النواقص فوراً.
              </p>
            </div>
          </button>
        </div>

        {/* Right Side: Interactive Forms */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm relative overflow-hidden">
            
            {/* Feedback Alerts */}
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2.5 space-x-reverse text-rose-800 text-xs animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-bold">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-2.5 space-x-reverse text-emerald-800 text-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span className="font-bold">{successMessage}</span>
              </div>
            )}

            {/* ======================================================== */}
            {/* 1. ADMIN LOGIN FORM */}
            {/* ======================================================== */}
            {authMode === "admin_login" && (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                    <LogIn className="w-5 h-5 text-emerald-600" />
                    <span>تسجيل دخول المسؤول</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    أدخل البريد الإلكتروني وكلمة المرور لإدارة حساب المنزل بالكامل
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    البريد الإلكتروني للمسؤول
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      كلمة المرور
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot_password")}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2 space-x-reverse"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>دخول لحساب المسؤول</span>
                    </>
                  )}
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-bold">أو</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {/* Google Sign-In for Admin */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-all flex items-center justify-center space-x-2 space-x-reverse"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>تسجيل الدخول عبر Google</span>
                </button>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">ليس لديك حساب مسؤول؟</span>
                  <button
                    type="button"
                    onClick={() => switchMode("admin_signup")}
                    className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 space-x-reverse"
                  >
                    <span>إنشاء منزل جديد وحساب مسؤول</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* ======================================================== */}
            {/* 2. ADMIN SIGNUP FORM (Create Household) */}
            {/* ======================================================== */}
            {authMode === "admin_signup" && (
              <form onSubmit={handleAdminSignUp} className="space-y-4">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                    <span>إنشاء منزل وحساب مسؤول جديد</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    قم بإنشاء المنزل وتعيين كود الربط لمشاركة التطبيق مع أفراد العائلة
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      اسم المنزل
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="مثال: منزل العائلة"
                        value={householdName}
                        onChange={(e) => setHouseholdName(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                      />
                      <Home className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      اسم المسؤول
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="مثال: أبو أحمد"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      رقم الجوال (اختياري)
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        placeholder="05XXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    كلمة المرور (6 خانات على الأقل)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2 space-x-reverse"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>تأكيد إنشاء الحساب والمنزل</span>
                    </>
                  )}
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-bold">أو</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {/* Google Sign-In for Admin */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-all flex items-center justify-center space-x-2 space-x-reverse"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>التسجيل والمتابعة بحساب Google</span>
                </button>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">لديك حساب مسؤول بالفعل؟</span>
                  <button
                    type="button"
                    onClick={() => switchMode("admin_login")}
                    className="font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    تسجيل الدخول
                  </button>
                </div>
              </form>
            )}

            {/* ======================================================== */}
            {/* 3. HOME PHONE / HOUSEHOLD MEMBER DEDICATED PATH */}
            {/* ======================================================== */}
            {authMode === "member_join" && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                      <Smartphone className="w-5 h-5 text-blue-600" />
                      <span>مسار هاتف المنزل (Home Phone)</span>
                    </h2>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      أفراد المنزل
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    قم بتسجيل هاتف المنزل باسم مستخدم وكلمة مرور، أو سجّل الدخول بحساب مسجل مسبقاً
                  </p>
                </div>

                {/* Submode Switcher Tabs */}
                <div className="flex rounded-xl bg-slate-100 p-1 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setHomePhoneSubMode("register");
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      homePhoneSubMode === "register"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    تسجيل هاتف جديد
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHomePhoneSubMode("login");
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      homePhoneSubMode === "login"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    دخول هاتف مسجل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHomePhoneSubMode("quick_pair");
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      homePhoneSubMode === "quick_pair"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    اقتران فوري (QR)
                  </button>
                </div>

                {/* 1. Register New Home Phone (With Username, Password & Pairing Code) */}
                {homePhoneSubMode === "register" && (
                  <form onSubmit={handleHomePhoneRegister} className="space-y-3.5">
                    {/* Instant Camera QR Scanner Quick Action */}
                    <div className="p-3 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-200/80 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 space-x-reverse">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/25 shrink-0">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900">
                            مسح كود QR لتعبئة رمز الربط
                          </h4>
                          <p className="text-[11px] text-slate-600">
                            وجّه الكاميرا نحو كود QR المعروض في هاتف المسؤول
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center space-x-1.5 space-x-reverse shrink-0 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>فتح الكاميرا</span>
                      </button>
                    </div>

                    {/* Pairing Code */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        رمز ربط المنزل (Pairing Code) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="مثال: PAIR-XXXX-XXXX"
                          value={pairCodeInput}
                          onChange={(e) => setPairCodeInput(e.target.value.toUpperCase())}
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-black font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white text-center uppercase"
                        />
                        <Hash className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        احصل على الرمز من شاشة "ربط هاتف المنزل" بهاتف المسؤول أو امسح كود QR
                      </span>
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        اسم مستخدم هاتف المنزل (Username) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="مثال: kitchen_phone أو home1"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.trim().toLowerCase())}
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white text-left font-mono"
                          dir="ltr"
                        />
                        <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        يُستخدم لتسجيل الدخول لاحقاً على هذا الهاتف في أي وقت
                      </span>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        كلمة المرور (Password) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          placeholder="•••••••• (6 خانات فأكثر)"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        احفظ كلمة المرور لاستخدامها عند الدخول مجدداً
                      </span>
                    </div>

                    {/* Device Display Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        اسم الجهاز المعروض في المنزل (اختياري)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="مثال: هاتف المطبخ أو هاتف الصالة"
                          value={memberName}
                          onChange={(e) => setMemberName(e.target.value)}
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                        <Smartphone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                      </div>
                    </div>

                    {/* Permissions Breakdown Preview */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center space-x-1.5 space-x-reverse font-bold text-slate-800">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span>صلاحيات هاتف المنزل الممنوحة:</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                        <div className="flex items-center space-x-1 space-x-reverse">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>تسجيل وتعديل النواقص</span>
                        </div>
                        <div className="flex items-center space-x-1 space-x-reverse">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>رنين التنبيه الصوتي العاجل</span>
                        </div>
                        <div className="flex items-center space-x-1 space-x-reverse">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>المساعد الذكي للمنزل</span>
                        </div>
                        <div className="flex items-center space-x-1 space-x-reverse">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>المزامنة الفورية الآمنة</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !pairCodeInput.trim() || !username.trim() || !password}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 space-x-reverse cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>تسجيل وربط هاتف المنزل الآن</span>
                        </>
                      )}
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setHomePhoneSubMode("login");
                          setErrorMessage(null);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                      >
                        لديك حساب اسم مستخدم وكلمة مرور سابقين؟ اضغط هنا للدخول
                      </button>
                    </div>
                  </form>
                )}

                {/* 2. Login Existing Home Phone (Username + Password) */}
                {homePhoneSubMode === "login" && (
                  <form onSubmit={handleHomePhoneLogin} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        اسم المستخدم لهاتف المنزل
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="مثال: kitchen_phone أو home1"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.trim().toLowerCase())}
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white text-left font-mono"
                          dir="ltr"
                        />
                        <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        كلمة المرور
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/25 transition-all flex items-center justify-center space-x-2 space-x-reverse cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          <span>دخول هاتف المنزل</span>
                        </>
                      )}
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setHomePhoneSubMode("register");
                          setErrorMessage(null);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                      >
                        تسجيل هاتف منزل جديد بحساب وكلمة مرور
                      </button>
                    </div>
                  </form>
                )}

                {/* 3. Quick Temporary Pairing (QR or Code only) */}
                {homePhoneSubMode === "quick_pair" && (
                  <form onSubmit={handleMemberJoin} className="space-y-4">
                    {/* Instant Camera QR Scanner Quick Action */}
                    <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/70 border border-blue-200/80 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/25">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          الاقتران الفوري بكاميرا الهاتف
                        </h4>
                        <p className="text-xs text-slate-600 mt-1">
                          وجّه كاميرا الهاتف نحو كود QR المعروض في هاتف المسؤول لربط الجهاز خلال ثانية واحدة
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/25 transition-all flex items-center justify-center space-x-2 space-x-reverse cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>فتح الكاميرا لمسح كود QR الآن</span>
                      </button>
                    </div>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="flex-shrink mx-3 text-xs text-slate-400 font-bold">أو الربط اليدوي برمز الاقتران</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        رمز الربط المؤقت (Pairing Code)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="مثال: PAIR-XXXX-XXXX"
                          value={pairCodeInput}
                          onChange={(e) => setPairCodeInput(e.target.value.toUpperCase())}
                          className="w-full pl-3 pr-10 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base font-black font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white text-center uppercase"
                        />
                        <Hash className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        احصل على الرمز المؤقت من شاشة "ربط هاتف المنزل" في جهاز المسؤول
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        اسم الجهاز المعروض في المنزل (اختياري)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="مثال: هاتف المطبخ أو هاتف الصالة"
                          value={memberName}
                          onChange={(e) => setMemberName(e.target.value)}
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                        <Smartphone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !pairCodeInput.trim()}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 space-x-reverse cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>ربط الجهاز بالمنزل الآن</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* 4. FORGOT PASSWORD FORM */}
            {/* ======================================================== */}
            {authMode === "forgot_password" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                    <KeyRound className="w-5 h-5 text-emerald-600" />
                    <span>استعادة كلمة المرور</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    أدخل بريدك الإلكتروني المسجل لإرسال رابط إعادة تعيين كلمة المرور
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2 space-x-reverse"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>إرسال رابط الاستعادة</span>
                    </>
                  )}
                </button>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-center text-xs">
                  <button
                    type="button"
                    onClick={() => switchMode("admin_login")}
                    className="font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    العودة لتسجيل الدخول
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Live Camera QR Scanner Overlay */}
      {isScannerOpen && (
        <QrLiveScanner
          onScan={handleScannerResult}
          onClose={() => setIsScannerOpen(false)}
          title="مسح رمز QR لربط هاتف المنزل"
          subtitle="وجّه كاميرا الهاتف نحو كود الـ QR الظاهر في هاتف المسؤول للاقتران الفوري"
        />
      )}
    </div>
  );
};

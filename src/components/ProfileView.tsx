import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save,
  KeyRound,
  Building,
  Calendar,
  Sparkles,
  QrCode,
  LogOut,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  Check,
  ShieldAlert,
  ArrowRight,
  Database,
  Key,
  Shield,
  Sliders,
} from "lucide-react";
import { HouseholdAddressesSection } from "./HouseholdAddressesSection";

export const ProfileView: React.FC = () => {
  const {
    supabaseUser,
    supabaseProfile,
    isSupabaseConnected,
    activeRole,
    setActiveRole,
    household,
    updateUserProfile,
    updateUserPassword,
    signOutSupabase,
    setIsQrModalOpen,
    setActiveTab,
    setIsSupabaseAuthModalOpen,
  } = useApp();

  // Profile Form States
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Status & Feedback States
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Synchronize initial data from Supabase Profile / Household Admin
  useEffect(() => {
    if (supabaseProfile?.fullName) {
      setFullName(supabaseProfile.fullName);
    } else if (supabaseUser?.user_metadata?.full_name) {
      setFullName(supabaseUser.user_metadata.full_name);
    } else if (household?.adminName) {
      setFullName(household.adminName);
    } else {
      setFullName(activeRole === "admin" ? "المسؤول" : "هاتف المنزل");
    }

    if (supabaseUser?.email) {
      setEmail(supabaseUser.email);
    } else if (supabaseProfile?.email) {
      setEmail(supabaseProfile.email);
    } else {
      setEmail("");
    }

    if (supabaseProfile?.phone) {
      setPhone(supabaseProfile.phone);
    } else if (supabaseUser?.user_metadata?.phone) {
      setPhone(supabaseUser.user_metadata.phone);
    } else if (household?.adminPhone) {
      setPhone(household.adminPhone);
    } else {
      setPhone("");
    }
  }, [supabaseProfile, supabaseUser, household, activeRole]);

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    if (!fullName.trim()) {
      setProfileErrorMsg("يرجى إدخال الاسم الكامل");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setProfileErrorMsg("يرجى إدخال بريد إلكتروني صحيح");
      return;
    }

    setIsSavingProfile(true);

    try {
      const res = await updateUserProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });

      if (res.error) {
        setProfileErrorMsg(res.error.message || "حدث خطأ أثناء تحديث البيانات");
      } else {
        setProfileSuccessMsg("تم حفظ وتحديث بيانات الملف الشخصي بنجاح في قاعدة البيانات!");
        setTimeout(() => setProfileSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setProfileErrorMsg(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password Change
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    if (!newPassword) {
      setPasswordErrorMsg("يرجى كتابة كلمة المرور الجديدة");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordErrorMsg("يجب أن تتكون كلمة المرور من ٦ خانات على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg("كلمات المرور غير متطابقة، يرجى التأكد وإعادة المحاولة");
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await updateUserPassword(newPassword);

      if (res.error) {
        setPasswordErrorMsg(res.error.message || "فشل تغيير كلمة المرور");
      } else {
        setPasswordSuccessMsg("تم تحديث كلمة المرور بنجاح وأمان!");
        setNewPassword("");
        setConfirmPassword("");
        setCurrentPassword("");
        setTimeout(() => setPasswordSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setPasswordErrorMsg(err.message || "حدث خطأ أثناء تعديل كلمة المرور");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formattedDate = household?.createdAt
    ? new Date(household.createdAt).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "أغسطس 2026";

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bento-card p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4 space-x-reverse">
            {/* User Avatar with Ring */}
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-1 shadow-lg shadow-emerald-500/20">
                <div className="w-full h-full rounded-[22px] bg-slate-900 flex items-center justify-center text-white font-black text-2xl sm:text-3xl border border-white/20">
                  {fullName ? fullName.charAt(0).toUpperCase() : "م"}
                </div>
              </div>
              <div
                className={`absolute -bottom-1 -left-1 px-2 py-0.5 rounded-full text-[10px] font-bold border-2 border-slate-900 flex items-center space-x-1 space-x-reverse ${
                  activeRole === "admin"
                    ? "bg-emerald-500 text-white"
                    : "bg-blue-500 text-white"
                }`}
              >
                {activeRole === "admin" ? (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    <span>المسؤول</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3 h-3" />
                    <span>هاتف المنزل</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {fullName || "المستخدم"}
                </h1>
                <span className="bg-white/10 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-white/10">
                  {supabaseUser ? "جلسة مصادقة موثقة" : "غير مسجل"}
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 flex items-center space-x-2 space-x-reverse">
                {activeRole !== "admin" || email?.endsWith("@talbat.com") ? (
                  <span>اسم المستخدم: {email ? email.replace("@talbat.com", "") : (fullName || "هاتف المنزل")}</span>
                ) : (
                  <span>{email || "لا يوجد بريد مسجل"}</span>
                )}
                <span>•</span>
                <span>{household?.name || "منزل العائلة"}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center space-x-1 space-x-reverse">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تاريخ الإنشاء: {formattedDate}</span>
                </span>
                {household && (
                  <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md text-[11px] font-bold border border-emerald-500/30 flex items-center space-x-1 space-x-reverse">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 inline ml-1" />
                    <span>المنزل متصل</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("settings")}
              className="flex items-center space-x-1.5 space-x-reverse px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition-all border border-emerald-500/30"
              title="إعدادات وصلاحيات النظام"
            >
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>إعدادات النظام</span>
            </button>
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center space-x-1.5 space-x-reverse px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>رمز QR للمنزل</span>
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className="flex items-center space-x-1.5 space-x-reverse px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30"
            >
              <ArrowRight className="w-4 h-4" />
              <span>الرئيسية</span>
            </button>
          </div>
        </div>
      </div>

      {/* Role & Connection Alert Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Role status */}
        <div className="bento-card p-4 bg-white border border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                activeRole === "admin"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              {activeRole === "admin" ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <Smartphone className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500">
                نوع وصلاحية الحساب
              </div>
              <div className="text-sm font-extrabold text-slate-900">
                {activeRole === "admin" ? "مسؤول النظام (Admin)" : "هاتف المنزل (Home Phone)"}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            موثق سحابياً
          </span>
        </div>

        {/* Card 2: Household Info */}
        <div className="bento-card p-4 bg-white border border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500">
                المنزل المرتبط
              </div>
              <div className="text-sm font-extrabold text-slate-900 truncate max-w-[150px]">
                {household?.name || "غير مرتبط بمنزل"}
              </div>
            </div>
          </div>
          <span className="text-xs font-bold bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg">
            {household ? "نشط ومرتبط" : "غير متوفر"}
          </span>
        </div>

        {/* Card 3: Cloud Database Status */}
        <div className="bento-card p-4 bg-white border border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500">
                قاعدة بيانات Supabase
              </div>
              <div className="text-sm font-extrabold text-slate-900 flex items-center space-x-1.5 space-x-reverse">
                <span
                  className={`w-2 h-2 rounded-full ${
                    supabaseUser ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                <span>{supabaseUser ? "جلسة نشطة وموثقة" : "غير متصل"}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsSupabaseAuthModalOpen(true)}
            className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-200"
          >
            {supabaseUser ? "حالة الربط" : "ربط Supabase"}
          </button>
        </div>
      </div>

      {/* Section: بيانات التواصل للمنزل */}
      <div className="bento-card p-5 sm:p-6 bg-white border border-slate-200/80 shadow-2xs">
        <HouseholdAddressesSection />
      </div>

      {/* Main Grid: Edit Info + Security */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Right Column: Personal Information Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bento-card p-6 bg-white border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <div className="flex items-center space-x-2.5 space-x-reverse">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    تعديل البيانات الشخصية
                  </h2>
                  <p className="text-xs text-slate-500">
                    تحديث الاسم والبريد ورقم الهاتف ومزامنتها مباشرة في جدول profiles
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                جدول Profiles
              </span>
            </div>

            {profileSuccessMsg && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  الاسم الكامل / اسم المسؤول
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    id="profile-fullname-input"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: أحمد عبد الله السعيد"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition-all"
                  />
                </div>
              </div>

              <div>
                {activeRole !== "admin" || email?.endsWith("@talbat.com") ? (
                  <>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      اسم المستخدم (هاتف المنزل)
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                      <input
                        id="profile-username-input"
                        type="text"
                        disabled
                        value={email ? email.replace("@talbat.com", "") : (fullName || "")}
                        className="w-full pr-10 pl-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-not-allowed"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      معرّف هاتف المنزل المعتمد لتسجيل الدخول السريع.
                    </p>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      البريد الإلكتروني (Supabase Auth Email)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                      <input
                        id="profile-email-input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      تغيير البريد يتطلب تأكيداً عبر البريد في حال تفعيل التأكيد في Supabase.
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  رقم الهاتف للتواصل والتنبيهات
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    id="profile-phone-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  اسم المنزل الحالي
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    disabled
                    value={household?.name || "منزل العائلة"}
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  id="btn-save-profile"
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ التعديلات في Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>حفظ التعديلات في الملف الشخصي</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right / Left Column: Security & Password Update (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Change Password Card */}
          <div className="bento-card p-6 bg-white border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <div className="flex items-center space-x-2.5 space-x-reverse">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5 text-slate-800" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    تغيير كلمة المرور
                  </h2>
                  <p className="text-xs text-slate-500">
                    تحديث كلمة السر وحماية الدخول
                  </p>
                </div>
              </div>
            </div>

            {passwordSuccessMsg && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccessMsg}</span>
              </div>
            )}

            {passwordErrorMsg && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    id="profile-new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/30 focus:border-slate-900 transition-all"
                  />
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

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    id="profile-confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/30 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="btn-update-password"
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-slate-900/20 transition-all disabled:opacity-50"
                >
                  {isChangingPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري تحديث كلمة المرور...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>تحديث كلمة المرور</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sign Out Card */}
          <div className="bento-card p-5 bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-extrabold text-slate-800">
                تسجيل الخروج
              </div>
              <div className="text-[11px] text-slate-500">
                إنهاء الجلسة والعودة لشاشة الدخول
              </div>
            </div>
            <button
              id="btn-profile-logout"
              onClick={async () => {
                await signOutSupabase();
                setActiveTab("auth");
              }}
              className="flex items-center space-x-1.5 space-x-reverse px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

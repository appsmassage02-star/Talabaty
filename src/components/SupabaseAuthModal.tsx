import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { isSupabaseConfigured, SUPABASE_SQL_SCHEMA } from "../lib/supabase";
import {
  UserCheck,
  LogIn,
  UserPlus,
  LogOut,
  KeyRound,
  Mail,
  Lock,
  Phone,
  Home,
  User,
  CheckCircle2,
  AlertCircle,
  Database,
  Copy,
  Check,
  Sparkles,
  X,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseAuthModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    supabaseUser,
    supabaseProfile,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOutSupabase,
    resetPassword,
    household,
    activeRole,
  } = useApp();

  const [mode, setMode] = useState<"signin" | "signup" | "reset" | "schema">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [householdName, setHouseholdName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const { error } = await signInWithEmail(email, password);
    setLoading(false);

    if (error) {
      setErrorMessage(error.message || "فشل تسجيل الدخول، يرجى التأكد من البريد الإلكتروني وكلمة المرور");
    } else {
      setSuccessMessage("تم تسجيل الدخول بنجاح! تم ربط حسابك وقاعدة بيانات منزلك.");
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMessage(error.message || "فشل تسجيل الدخول عبر Google");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ أثناء الاتصال بـ Google");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 6) {
      setErrorMessage("يجب أن تتكون كلمة المرور من ٦ خانات على الأقل");
      return;
    }

    setLoading(true);
    const { error, user } = await signUpWithEmail(
      email,
      password,
      fullName || "المسؤول",
      phoneNumber,
      householdName || "منزل العائلة"
    );
    setLoading(false);

    if (error) {
      setErrorMessage(error.message || "فشل إنشاء الحساب، يرجى المحاولة لاحقاً");
    } else {
      setSuccessMessage(
        "تم إنشاء الحساب والمنزل بنجاح في Supabase! تم تسجيل الدخول تلقائياً وتفعيل الحماية."
      );
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const { error } = await resetPassword(email);
    setLoading(false);

    if (error) {
      setErrorMessage(error.message || "حدث خطأ أثناء إرسال رابط استعادة كلمة المرور");
    } else {
      setSuccessMessage("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح.");
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 text-right flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-l from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between border-b border-emerald-800/30">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h3 className="text-base font-bold text-white">
                  حساب وقاعدة بيانات Supabase
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isConfigured
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {isConfigured ? "متصل سحابياً" : "جاهز للربط"}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                تسجيل دخول آمن وفصل بيانات المنازل (Row Level Security)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notice */}
        {!isConfigured && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-start space-x-2 space-x-reverse text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">تنبيه: </span>
              يرجى إضافة مفاتيح <code className="bg-amber-100 px-1 rounded font-mono">VITE_SUPABASE_URL</code> و{" "}
              <code className="bg-amber-100 px-1 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> في ملف البيئة لتفعيل المزامنة المباشرة مع مشروعك على Supabase.
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* If already logged in */}
          {supabaseUser ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">
                      مسجل الدخول حالياً
                    </span>
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {supabaseUser.email}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-slate-400 block">اسم المستخدم</span>
                    <span className="font-bold text-slate-800">
                      {supabaseProfile?.fullName || household?.adminName || "المسؤول"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-slate-400 block">معرف المنزل المرتبط</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {household?.id || "غير متصل بمنزل"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setMode(mode === "schema" ? "signin" : "schema")}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 space-x-reverse"
                >
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>{mode === "schema" ? "إخفاء سكربت الجداول" : "عرض كود SQL للجداول"}</span>
                </button>

                <button
                  onClick={async () => {
                    await signOutSupabase();
                    onClose();
                  }}
                  className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 space-x-reverse"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              {/* Show SQL Schema if requested */}
              {mode === "schema" && (
                <div className="p-4 bg-slate-900 rounded-2xl text-slate-200 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400">
                      مخطط الجداول لـ Supabase SQL Editor:
                    </span>
                    <button
                      onClick={handleCopySql}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1 space-x-reverse transition-colors"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>تم النسخ!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ الكود</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 bg-black/50 rounded-xl overflow-x-auto text-[10px] font-mono text-emerald-300 max-h-56 leading-relaxed">
                    {SUPABASE_SQL_SCHEMA}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            /* Authentication Tabs */
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="flex items-center p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl transition-all ${
                    mode === "signin"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl transition-all ${
                    mode === "signup"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  إنشاء حساب منزل جديد
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("schema");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-2 px-3 rounded-xl transition-all ${
                    mode === "schema"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="مخطط الجداول SQL"
                >
                  <Database className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Messages */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 space-x-reverse text-xs text-rose-700 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 space-x-reverse text-xs text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Sign In Form */}
              {mode === "signin" && (
                <form onSubmit={handleSignIn} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full pl-3 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        كلمة المرور
                      </label>
                      <button
                        type="button"
                        onClick={() => setMode("reset")}
                        className="text-[11px] text-emerald-700 hover:underline font-medium"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>تسجيل الدخول إلى Supabase</span>
                      </>
                    )}
                  </button>

                  <div className="relative flex py-1.5 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-bold">أو</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleGoogleSignIn}
                    className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-all flex items-center justify-center space-x-2 space-x-reverse"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>تسجيل الدخول عبر Google</span>
                  </button>
                </form>
              )}

              {/* Sign Up Form */}
              {mode === "signup" && (
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        اسم المسؤول (الأب / الأم)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="أبو أحمد"
                          className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                        />
                        <User className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        اسم المنزل أو العائلة
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={householdName}
                          onChange={(e) => setHouseholdName(e.target.value)}
                          placeholder="منزل العائلة"
                          className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                        />
                        <Home className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                      />
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        رقم الهاتف (اختياري)
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="0501234567"
                          className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                        />
                        <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        كلمة المرور
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="٦ خانات على الأقل"
                          className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                        />
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-50 mt-1"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>إنشاء الحساب وتفعيل المزامنة</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Reset Password Form */}
              {mode === "reset" && (
                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  <p className="text-xs text-slate-500">
                    أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور فوراً:
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full pl-3 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 space-x-reverse">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-1.5 space-x-reverse disabled:opacity-50"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>إرسال الرابط</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}

              {/* SQL Schema View */}
              {mode === "schema" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      مخطط الجداول وأمان الصفوف (RLS):
                    </span>
                    <button
                      onClick={handleCopySql}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition-colors shadow-2xs"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>تم النسخ!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ كود SQL</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3.5 bg-slate-900 rounded-2xl overflow-x-auto text-[10px] font-mono text-emerald-300 max-h-60 leading-relaxed border border-slate-800">
                    {SUPABASE_SQL_SCHEMA}
                  </pre>
                  <p className="text-[11px] text-slate-400">
                    انسخ هذا الكود والصقه في نافذة <b>SQL Editor</b> داخل لوحة تحكم مشروعك في Supabase لإنشاء كافة الجداول وتفعيل سياسات الأمان RLS بنقرة واحدة.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1.5 space-x-reverse">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>مشفر بواسطة Supabase Auth & JWT</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  X,
  MessageCircle,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Heart,
  PhoneCall,
  Info,
  Code,
  Layers,
  Award,
  Share2,
} from "lucide-react";

export const AboutAppModal: React.FC = () => {
  const { isAboutModalOpen, setIsAboutModalOpen } = useApp();
  const [copiedPhone, setCopiedPhone] = useState(false);

  if (!isAboutModalOpen) return null;

  const developerPhone = "+201147090720";
  const whatsappUrl = `https://wa.me/201147090720?text=${encodeURIComponent(
    "السلام عليكم ورحمة الله، أود الاستفسار والتواصل بخصوص تطبيق (طلباتي)..."
  )}`;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(developerPhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right animate-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Header with gradient & App Icon */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-6 sm:p-7 overflow-hidden text-center">
          {/* Subtle Background Glows */}
          <div className="absolute top-0 right-1/4 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-teal-500/20 rounded-full blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={() => setIsAboutModalOpen(false)}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer z-10"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Center App Logo with glowing frame */}
          <div className="relative inline-block mx-auto mb-3">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white p-1 shadow-xl shadow-emerald-900/40 border-2 border-emerald-400/50 flex items-center justify-center overflow-hidden transition-transform hover:scale-105">
              <img
                src="/app-logo.png"
                alt="شعار طلباتي"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <span className="absolute bottom-0 right-0 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-full border border-white shadow-xs">
              رسمي
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
            طلباتي
          </h2>
          <p className="text-xs sm:text-sm text-emerald-300 font-medium mt-1">
            نظام إدارة مشتريات ونواقص وميزانية المنزل الذكي
          </p>

          <div className="inline-flex items-center space-x-2 space-x-reverse mt-3 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/15 text-[11px] font-mono text-slate-200">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>الإصدار 2.5.0 (V2.5.0 Production)</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* About Synopsis Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2 space-x-reverse text-emerald-800 font-bold text-xs sm:text-sm">
              <Info className="w-4 h-4 text-emerald-600" />
              <span>نبذة عن فكرة التطبيق</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              تطبيق <strong>"طلباتي"</strong> هو حل رقمي عائلي متكامل يهدف إلى تسهيل وتنظيم إدارة مشتريات واحتياجات المنزل اليومية، والربط الذكي بين هاتف المنزل وهاتف المسؤول عبر أكواد QR وصلاحيات دقيقة، مع متابعة ميزانية الإنفاق الشهرية وحفظ فواتير الشراء بدقة وذكاء اصطناعي يعمل حتى بدون اتصال بالإنترنت.
            </p>
          </div>

          {/* Core Features Badges */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-2.5 space-x-reverse">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800">مزامنة فورية</p>
                <p className="text-[10px] text-slate-400">سحابية ومحلية PWA</p>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-2.5 space-x-reverse">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800">ذكاء اصطناعي</p>
                <p className="text-[10px] text-slate-400">تحليل الفواتير والنواقص</p>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-2.5 space-x-reverse">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800">حماية الميزانية</p>
                <p className="text-[10px] text-slate-400">تتبع المصروفات الشهرية</p>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-2.5 space-x-reverse">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800">صلاحيات محكمة</p>
                <p className="text-[10px] text-slate-400">بين المسؤول والمنزل</p>
              </div>
            </div>
          </div>

          {/* Contact Developer Section */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/50 rounded-2xl p-4 sm:p-5 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse text-emerald-950 font-bold text-xs sm:text-sm">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>تواصل مباشر مع مطور التطبيق</span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                دعم فني وتطوير
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              لأي استفسارات، اقتراح ميزات جديدة، أو طلب نسخ مخصصة لمنزلك أو متجرك، يسعدنا تواصلكم مباشرة عبر واتساب:
            </p>

            {/* Phone & WhatsApp Action */}
            <div className="space-y-2 pt-1">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 space-x-reverse shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all cursor-pointer group"
              >
                <MessageCircle className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>تواصل مع المطور عبر واتساب ({developerPhone})</span>
              </a>

              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-emerald-200 text-xs">
                <div className="flex items-center space-x-2 space-x-reverse font-mono font-bold text-slate-800" dir="ltr">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{developerPhone}</span>
                </div>
                <button
                  onClick={handleCopyPhone}
                  className="inline-flex items-center space-x-1 space-x-reverse px-2.5 py-1 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                >
                  {copiedPhone ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ الرقم</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center pt-1 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-center space-x-1 space-x-reverse">
            <span>تم تطوير تطبيق طلباتي بكل</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline" />
            <span>لخدمة المنازل والعائلات</span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import confetti from "canvas-confetti";
import { useApp } from "../context/AppContext";
import { CategoryId } from "../types";
import { supabase } from "../lib/supabase";
import {
  X,
  Sparkles,
  Mic,
  MicOff,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Tag,
  ArrowRight,
  HelpCircle,
  WifiOff,
  LayoutGrid,
} from "lucide-react";

interface ParsedItem {
  name: string;
  category: CategoryId;
  categoryArabic: string;
  quantity: string;
  urgency: "high" | "normal" | "low";
  notes?: string;
}

export const SmartAiModal: React.FC = () => {
  const {
    isAiModalOpen,
    setIsAiModalOpen,
    addMissingItem,
    activeRole,
    isOnline,
    setActiveTab,
  } = useApp();

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ParsedItem[] | null>(null);
  const [summaryMessage, setSummaryMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAiModalOpen) return null;

  const samplePhrases = [
    "خلص اللبن والجبنة وطماطم وبدنا كيلوين لحم مفروم",
    "خلص صابون الصحون ومسحوق الغسيل ومناديل مطبخ",
    "جيب معك شاي وسكر وزيت دوار الشمس وكيس رز بسمتي",
    "بدنا خضار طازجة: خيار وبصل وليمون وتفاح وموز",
    "خلص ورق القصدير وبطاريات الريموت ومعطر الجو",
  ];

  const handleVoiceSimulation = (phrase: string) => {
    if (!isOnline) {
      setErrorMsg("خدمة الإدخال والتحليل الذكي تتطلب اتصالاً بالإنترنت لمنع ضياع البيانات.");
      return;
    }
    setIsRecording(true);
    setInputText("");
    setTimeout(() => {
      setInputText(phrase);
      setIsRecording(false);
    }, 900);
  };

  const handleAnalyze = async (textToParse?: string) => {
    const query = textToParse || inputText;
    if (!query.trim()) return;

    if (!isOnline) {
      setErrorMsg(
        "تنبيه: أنت الآن في وضع عدم الاتصال (Offline). تم إيقاف المساعد الذكي Gemini لتجنب ضياع المدخلات. يرجى إضافة النواقص مباشرة من شاشة الأقسام."
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setExtractedItems(null);

    try {
      let data: any = null;

      // 1. Try Supabase Edge Function first (production/cloud architecture)
      if (supabase) {
        try {
          const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
            "gemini-assistant",
            {
              body: { text: query },
            }
          );
          if (!edgeError && edgeData?.success && edgeData.items?.length > 0) {
            data = edgeData;
          }
        } catch (edgeErr) {
          console.warn("Supabase Edge Function not reachable, attempting fallback:", edgeErr);
        }
      }

      // 2. Try dev server endpoint if edge function didn't return data
      if (!data) {
        try {
          const response = await fetch("/api/gemini/parse-groceries", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: query }),
          });
          if (response.ok) {
            const parsed = await response.json();
            if (parsed.success && parsed.items?.length > 0) {
              data = parsed;
            }
          }
        } catch (serverErr) {
          // Dev server unavailable
        }
      }

      // 3. Process result or use smart local Arabic engine
      if (data && data.items && data.items.length > 0) {
        setExtractedItems(data.items);
        setSummaryMessage(data.summary || "تم استخراج وتصنيف النواقص بنجاح بواسطة Gemini");
      } else {
        const offlineItems = localParseArabicGroceries(query);
        setExtractedItems(offlineItems);
        setSummaryMessage("تم التحليل محلياً بواسطة المحلل الذكي المدمج");
      }
    } catch (err: any) {
      console.warn("Analysis request failed, using smart offline parser:", err);
      const offlineItems = localParseArabicGroceries(query);
      setExtractedItems(offlineItems);
      setSummaryMessage("تم التحليل محلياً بنجاح (المحلل المدمج)");
    } finally {
      setIsLoading(false);
    }
  };

  // Local rule-based parser when completely offline
  const localParseArabicGroceries = (text: string): ParsedItem[] => {
    const dict: Record<string, { name: string; cat: CategoryId; catAr: string }> = {
      حليب: { name: "حليب طازج", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      لبن: { name: "لبن طازج", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      جبنة: { name: "جبنة بيضاء", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      بيض: { name: "طبق بيض", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      خبز: { name: "خبز مفرود", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      رز: { name: "أرز بسمتي", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      أرز: { name: "أرز بسمتي", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      سكر: { name: "سكر أبيض", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      شاي: { name: "شاي كرتون", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      زيت: { name: "زيت طبخ", cat: "supermarket", catAr: "سوبرماركت وتموين" },
      طماطم: { name: "طماطم طازجة", cat: "vegetables_fruits", catAr: "خضروات وفواكه طازجة" },
      بندورة: { name: "طماطم طازجة", cat: "vegetables_fruits", catAr: "خضروات وفواكه طازجة" },
      خيار: { name: "خيار بلدي", cat: "vegetables_fruits", catAr: "خضروات وفواكه طازجة" },
      بصل: { name: "بصل أحمر", cat: "vegetables_fruits", catAr: "خضروات وفواكه طازجة" },
      بطاطس: { name: "بطاطس طبخ", cat: "vegetables_fruits", catAr: "خضروات وفواكه طازجة" },
      ليمون: { name: "ليمون أصفر", cat: "vegetables_fruits", catAr: "خضروات وفواكه طازجة" },
      تفاح: { name: "تفاح سكري", cat: "vegetables_fruits", catAr: "خضروات وفواكه طازجة" },
      موز: { name: "موز طازج", cat: "vegetables_fruits", catAr: "خضروات وفواكه طازجة" },
      دجاج: { name: "دجاج مبرد طازج", cat: "meat_poultry", catAr: "اللحوم والدواجن والأسماك" },
      لحم: { name: "لحم طازج", cat: "meat_poultry", catAr: "اللحوم والدواجن والأسماك" },
      سمك: { name: "سمك طازج", cat: "meat_poultry", catAr: "اللحوم والدواجن والأسماك" },
      صابون: { name: "صابون سائل", cat: "cleaning", catAr: "المنظفات والمطهرات" },
      مناديل: { name: "مناديل رول مطبخ", cat: "cleaning", catAr: "المنظفات والمطهرات" },
      كلوركس: { name: "مبيض ومعقم", cat: "cleaning", catAr: "المنظفات والمطهرات" },
      فلفل: { name: "فلفل أسود", cat: "spices", catAr: "توابل وبهارات" },
      كمون: { name: "كمون مطحون", cat: "spices", catAr: "توابل وبهارات" },
      قصدير: { name: "ورق قصدير ألمنيوم", cat: "home_essentials", catAr: "مستلزمات وأدوات المنزل" },
      بطاريات: { name: "بطاريات ريموت", cat: "home_essentials", catAr: "مستلزمات وأدوات المنزل" },
    };

    const words = text.split(/[\s,،+]+/);
    const results: ParsedItem[] = [];
    const seen = new Set<string>();

    for (const w of words) {
      const clean = w.replace(/^(ال|و|وال|ب|بال)/, "");
      const match = dict[w] || dict[clean];
      if (match && !seen.has(match.name)) {
        seen.add(match.name);
        results.push({
          name: match.name,
          category: match.cat,
          categoryArabic: match.catAr,
          quantity: "حسب الحاجة",
          urgency: text.includes("خلص") || text.includes("ضروري") ? "high" : "normal",
          notes: "تمت الإضافة عبر المحلل الذكي في وضع عدم الاتصال",
        });
      }
    }

    if (results.length === 0) {
      results.push({
        name: text.slice(0, 30),
        category: "supermarket",
        categoryArabic: "سوبرماركت وتموين",
        quantity: "١",
        urgency: "normal",
        notes: "تم الإدخال في وضع عدم الاتصال",
      });
    }

    return results;
  };

  const handleConfirmAddAll = () => {
    if (!extractedItems || extractedItems.length === 0) return;

    extractedItems.forEach((item) => {
      addMissingItem({
        name: item.name,
        category: item.category as CategoryId,
        categoryArabic: item.categoryArabic,
        quantity: item.quantity || "١",
        urgency: item.urgency === "high" ? "high" : "normal",
        notes: item.notes || "عبر المساعد الذكي Gemini",
        addedBy: activeRole === "admin" ? "admin" : "home",
        addedByName: activeRole === "admin" ? "المسؤول" : "هاتف المنزل",
      });
    });

    try {
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.6 },
      });
    } catch (_) {}

    setIsAiModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[92vh] flex flex-col text-right overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h2 className="text-lg font-bold text-slate-900">
                  المساعد الذكي (Gemini API)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-600 text-white rounded-full">
                  Structured JSON
                </span>
              </div>
              <p className="text-xs text-slate-500">
                تحدث أو اكتب بطبيعتك، وسيقوم الذكاء الاصطناعي بتصنيف النواقص تلقائياً
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAiModalOpen(false)}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Offline Warning Banner */}
          {!isOnline && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-rose-500/10 border-2 border-amber-400 text-amber-950 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start space-x-2.5 space-x-reverse">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 space-x-reverse">
                    <h4 className="text-xs font-black text-amber-900">
                      وضع عدم الاتصال بالإنترنت (Offline Mode)
                    </h4>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full font-bold">
                      معطل مؤقتاً
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    خدمة الذكاء الاصطناعي <strong>Gemini API</strong> تتطلب اتصالاً بالإنترنت لتحليل الجمل العربية. تم إيقاف الإرسال السحابي مؤقتاً لحماية مدخلاتك وتفادي ضياع البيانات.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between">
                <span className="text-[11px] text-amber-900 font-bold">
                  بديل سريع: أضف النواقص مباشرة من الأقسام المحلية:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAiModalOpen(false);
                    setActiveTab("categories");
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 space-x-reverse"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>تصفح الأقسام</span>
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2.5 space-x-reverse text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Natural Language Input Box */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={!isOnline}
                placeholder={
                  isOnline
                    ? "اكتب أو انطق ما ينقص البيت عفوياً (مثال: خلص اللبن والجبنة وطماطم وبدنا كيلوين موز ومسحوق غسيل)..."
                    : "المساعد الذكي معطل في وضع Offline لتجنب ضياع البيانات. يرجى الاتصال بالإنترنت أو تصفح الأقسام."
                }
                rows={3}
                className={`w-full p-3.5 border rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none transition-all resize-none ${
                  !isOnline
                    ? "bg-slate-100 border-slate-300 opacity-70 cursor-not-allowed"
                    : "bg-slate-50 border-slate-200 focus:border-emerald-500 focus:bg-white"
                }`}
              />

              {/* Action Inside Textarea */}
              <div className="absolute bottom-2.5 left-2.5 flex items-center space-x-1.5 space-x-reverse">
                <button
                  type="button"
                  disabled={!isOnline}
                  onClick={() =>
                    handleVoiceSimulation(
                      samplePhrases[Math.floor(Math.random() * samplePhrases.length)]
                    )
                  }
                  className={`p-2 rounded-xl transition-all flex items-center space-x-1 space-x-reverse text-xs font-bold ${
                    !isOnline
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : isRecording
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  }`}
                  title={
                    isOnline
                      ? "تسجيل صوتي أو محاكاة إدخال صوتي"
                      : "غير متاح في وضع عدم الاتصال"
                  }
                >
                  <Mic className="w-4 h-4" />
                  <span className="text-[11px] hidden sm:inline">
                    {isRecording ? "جاري الاستماع..." : "إدخال صوتي"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAnalyze()}
                  disabled={!isOnline || isLoading || !inputText.trim()}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1 space-x-reverse ${
                    !isOnline
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                      : "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري التحليل...</span>
                    </>
                  ) : !isOnline ? (
                    <>
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>معطل (Offline)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تحليل الطلب</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Voice / Example Chips */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-1.5">
              {isOnline
                ? "أمثلة جاهزة لتجربة التحليل السريع:"
                : "أمثلة (تتطلب الاتصال بالإنترنت):"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {samplePhrases.map((phrase, idx) => (
                <button
                  key={idx}
                  disabled={!isOnline}
                  onClick={() => {
                    setInputText(phrase);
                    handleAnalyze(phrase);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors text-right ${
                    !isOnline
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                      : "text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border-slate-200"
                  }`}
                >
                  "{phrase}"
                </button>
              ))}
            </div>
          </div>

          {/* Extracted Structured Results */}
          {extractedItems && (
            <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center justify-between">
                <span>{summaryMessage}</span>
                <span className="bg-emerald-200/80 px-2 py-0.5 rounded-full text-[11px]">
                  {extractedItems.length} أصناف مستخرجة
                </span>
              </div>

              {/* Items Cards */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {extractedItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5 space-x-reverse">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">
                            {item.name}
                          </span>
                          {item.urgency === "high" && (
                            <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[10px] font-bold rounded">
                              عاجل
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse text-[11px] text-slate-500 mt-0.5">
                          <span className="text-emerald-700 font-medium">
                            {item.categoryArabic}
                          </span>
                          <span>•</span>
                          <span>الكمية: {item.quantity || "حسب الحاجة"}</span>
                          {item.notes && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400">{item.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirm Add Button */}
              <button
                onClick={handleConfirmAddAll}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2 space-x-reverse transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>
                  إضافة جميع الأصناف ({extractedItems.length}) إلى النواقص فوراً
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
          يعتمد على نموذج Gemini 3.7 Flash مع JSON Schema لضمان دقة التصنيف الفوري
        </div>
      </div>
    </div>
  );
};

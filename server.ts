import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Server-side Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";
const serverSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Allow large JSON payloads for compressed base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded prescription and order files statically with CORS
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  })
);

// Storage Upload Endpoint: saves compressed image file and returns public HTTP URL
app.post("/api/storage/upload", (req, res) => {
  try {
    const { path: relPath, dataUrl, contentType } = req.body;
    if (!relPath || !dataUrl) {
      return res.status(400).json({ error: "مسار الصورة أو بياناتها مفقودة" });
    }

    // Sanitize path: allow alphanumeric, underscore, dash, dot, and slash
    const cleanRelPath = String(relPath)
      .replace(/[^a-zA-Z0-9_\-\.\/]/g, "")
      .replace(/\.\./g, "");

    const targetFilePath = path.join(UPLOADS_DIR, cleanRelPath);
    const targetDir = path.dirname(targetFilePath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Extract base64 payload and write to disk
    const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const buffer = Buffer.from(base64Data, "base64");

    fs.writeFileSync(targetFilePath, buffer);

    // Resolve the authoritative public URL:
    // 1. Client passed explicit origin (from window.location.origin)
    // 2. Origin / Referer header from browser HTTP request
    // 3. x-forwarded-host + x-forwarded-proto from reverse proxy
    // 4. process.env.APP_URL
    let clientOrigin = req.body?.origin || "";
    if (!clientOrigin) {
      const headerOrigin = req.get("origin") || req.get("referer");
      if (headerOrigin) {
        try {
          const u = new URL(headerOrigin);
          clientOrigin = u.origin;
        } catch {}
      }
    }
    if (!clientOrigin && req.get("x-forwarded-host")) {
      const proto = req.get("x-forwarded-proto") || "https";
      clientOrigin = `${proto}://${req.get("x-forwarded-host")}`;
    }
    if (!clientOrigin && process.env.APP_URL) {
      clientOrigin = process.env.APP_URL.replace(/\/+$/, "");
    }
    if (
      !clientOrigin ||
      clientOrigin.includes("localhost") ||
      clientOrigin.includes("127.0.0.1")
    ) {
      if (process.env.APP_URL) {
        clientOrigin = process.env.APP_URL.replace(/\/+$/, "");
      } else if (req.get("x-forwarded-host")) {
        const proto = req.get("x-forwarded-proto") || "https";
        clientOrigin = `${proto}://${req.get("x-forwarded-host")}`;
      } else {
        const proto = req.get("x-forwarded-proto") || req.protocol || "http";
        clientOrigin = `${proto}://${req.get("host") || `localhost:${PORT}`}`;
      }
    }

    if (
      clientOrigin &&
      clientOrigin.startsWith("http://") &&
      (clientOrigin.includes(".run.app") || clientOrigin.includes("ais-"))
    ) {
      clientOrigin = clientOrigin.replace("http://", "https://");
    }

    const publicUrl = `${clientOrigin}/uploads/${cleanRelPath}`;
    const relativeUrl = `/uploads/${cleanRelPath}`;

    return res.json({
      success: true,
      url: publicUrl,
      relativeUrl,
      path: cleanRelPath,
      size: buffer.length,
      mimeType: contentType || "image/jpeg",
    });
  } catch (err: any) {
    console.error("[Storage API] Upload error:", err);
    return res.status(500).json({
      error: `تعذر حفظ الملف على الخادم: ${err?.message || "خطأ غير معروف"}`,
    });
  }
});

// Storage Remove Endpoint: cleans up files if an order fails
app.post("/api/storage/remove", (req, res) => {
  try {
    const { paths } = req.body;
    if (Array.isArray(paths)) {
      for (const p of paths) {
        const cleanRelPath = String(p)
          .replace(/[^a-zA-Z0-9_\-\.\/]/g, "")
          .replace(/\.\./g, "");
        const targetFilePath = path.join(UPLOADS_DIR, cleanRelPath);
        if (fs.existsSync(targetFilePath)) {
          fs.unlinkSync(targetFilePath);
        }
      }
    }
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: false });
  }
});

// Initialize Google Gen AI
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. Fallback parsing will be used.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Available categories mapping
const CATEGORY_MAP: Record<string, string> = {
  supermarket: "سوبرماركت",
  vegetables_fruits: "خضروات وفواكه",
  meat_poultry: "اللحوم والدواجن",
  spices: "توابل وبهارات",
  home_essentials: "مستلزمات المنزل",
  cleaning: "المنظفات",
};

// 1. API: Parse Arabic groceries using Gemini AI
app.post("/api/gemini/parse-groceries", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "النص المطلوب تحليله فارغ" });
    }

    const ai = getAiClient();

    if (!ai) {
      // Fallback smart parser if no API key is available
      const items = fallbackParseArabic(text);
      return res.json({ success: true, items, source: "rule_engine" });
    }

    const prompt = `أنت مساعد ذكي ومتخصص لتطبيق "طلبات البيت".
المستخدم أدخل جملة عفوية باللغة العربية أو اللهجة العامية عن أغراض ونواقص يحتاجها المنزل:
"${text}"

مهمتك:
1. استخراج جميع النواقص/المنتجات المذكورة بدقة.
2. تصنيف كل منتج إلى إحدى الفئات الست المحددة بالضبط:
   - "supermarket" (سوبرماركت: ألبان، أجبان، بيض، معلبات، خبز، زيت، سكر، شاي، قهوة، أرز، مكرونة)
   - "vegetables_fruits" (خضروات وفواكه: طماطم، خيار، بصل، ثوم، بطاطس، موز، تفاح، برتقال، ليمون...)
   - "meat_poultry" (اللحوم والدواجن: لحم مفروم، دجاج، فيليه، كفتة، كبدة، سمك، ريش...)
   - "spices" (توابل وبهارات: فلفل أسود، كمون، كزبرة، قرفة، كاري، حبهان، بابريكا، زعتر، زنجبيل...)
   - "home_essentials" (مستلزمات المنزل: مناديل، قصدير، أكياس قمامة، بطاريات، لمبات، ورق زبدة...)
   - "cleaning" (المنظفات: مسحوق غسيل، صابون أطباق، كلور، معطر جو، مطهر أرضيات، إسفنج...)
3. استخراج الكمية أو الوحدة المذكورة (مثل: "٢ لتر", "١ كيلو", "٣ حبات", "كرتونة"). إذا لم تُذكر كمية فحدد "حسب الحاجة".
4. تحديد درجة الأهمية: "high" (إذا ذكر خلص تماماً أو عاجل أو ضروري) أو "normal".
5. كتابة أي ملاحظات إضافية مذكورة (مثل: قليل الدسم، حجم عائلي، ماركة محددة).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "ملخص لطيف بالعربية لما تم استخراجه",
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "اسم المنتج باللغة العربية الفصحى الواضحة",
                  },
                  category: {
                    type: Type.STRING,
                    description: "معرف الفئة: supermarket, vegetables_fruits, meat_poultry, spices, home_essentials, cleaning",
                  },
                  categoryArabic: {
                    type: Type.STRING,
                    description: "اسم الفئة بالعربية",
                  },
                  quantity: {
                    type: Type.STRING,
                    description: "الكمية أو العدد، مثل: ١ كيلو، ٢ لتر، أو حسب الحاجة",
                  },
                  urgency: {
                    type: Type.STRING,
                    description: "درجة الأهمية: high, normal, low",
                  },
                  notes: {
                    type: Type.STRING,
                    description: "ملاحظات إضافية خاصة بالمنتج",
                  },
                },
                required: ["name", "category", "categoryArabic", "quantity", "urgency"],
              },
            },
          },
          required: ["summary", "items"],
        },
      },
    });

    const parsedJson = JSON.parse(response.text?.trim() || "{}");
    return res.json({
      success: true,
      summary: parsedJson.summary || "تم تحليل الطلبات بنجاح",
      items: (parsedJson.items || []).map((item: any) => ({
        ...item,
        categoryArabic: CATEGORY_MAP[item.category] || item.categoryArabic || "سوبرماركت",
      })),
      source: "gemini",
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Fallback on error
    const fallbackItems = fallbackParseArabic(req.body?.text || "");
    return res.json({
      success: true,
      summary: "تم تحليل النواقص عبر المحلل الذكي",
      items: fallbackItems,
      source: "fallback",
      errorMsg: error?.message,
    });
  }
});

// Fallback rule engine for Arabic pantry terms
function fallbackParseArabic(text: string) {
  const cleaned = text.replace(/[،,.]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const items: any[] = [];

  const dict: Record<string, { cat: string; catAr: string; name: string }> = {
    لبن: { cat: "supermarket", catAr: "سوبرماركت", name: "حليب طازج" },
    حليب: { cat: "supermarket", catAr: "سوبرماركت", name: "حليب" },
    جبنة: { cat: "supermarket", catAr: "سوبرماركت", name: "جبنة" },
    جبن: { cat: "supermarket", catAr: "سوبرماركت", name: "جبنة" },
    بيض: { cat: "supermarket", catAr: "سوبرماركت", name: "بيض طازج" },
    خبز: { cat: "supermarket", catAr: "سوبرماركت", name: "خبز" },
    زيت: { cat: "supermarket", catAr: "سوبرماركت", name: "زيت طبخ" },
    سكر: { cat: "supermarket", catAr: "سوبرماركت", name: "سكر" },
    شاي: { cat: "supermarket", catAr: "سوبرماركت", name: "شاي" },
    قهوة: { cat: "supermarket", catAr: "سوبرماركت", name: "قهوة" },
    ارز: { cat: "supermarket", catAr: "سوبرماركت", name: "أرز" },
    أرز: { cat: "supermarket", catAr: "سوبرماركت", name: "أرز" },
    رز: { cat: "supermarket", catAr: "سوبرماركت", name: "أرز" },
    مكرونة: { cat: "supermarket", catAr: "سوبرماركت", name: "مكرونة" },
    طماطم: { cat: "vegetables_fruits", catAr: "خضروات وفواكه", name: "طماطم" },
    بندورة: { cat: "vegetables_fruits", catAr: "خضروات وفواكه", name: "طماطم" },
    خيار: { cat: "vegetables_fruits", catAr: "خضروات وفواكه", name: "خيار" },
    بصل: { cat: "vegetables_fruits", catAr: "خضروات وفواكه", name: "بصل" },
    بطاطس: { cat: "vegetables_fruits", catAr: "خضروات وفواكه", name: "بطاطس" },
    موز: { cat: "vegetables_fruits", catAr: "خضروات وفواكه", name: "موز" },
    تفاح: { cat: "vegetables_fruits", catAr: "خضروات وفواكه", name: "تفاح" },
    برتقال: { cat: "vegetables_fruits", catAr: "خضروات وفواكه", name: "برتقال" },
    ليمون: { cat: "vegetables_fruits", catAr: "خضروات وفواكه", name: "ليمون" },
    لحم: { cat: "meat_poultry", catAr: "اللحوم والدواجن", name: "لحم طازج" },
    لحمة: { cat: "meat_poultry", catAr: "اللحوم والدواجن", name: "لحم" },
    دجاج: { cat: "meat_poultry", catAr: "اللحوم والدواجن", name: "دجاج" },
    فراخ: { cat: "meat_poultry", catAr: "اللحوم والدواجن", name: "دجاج طازج" },
    سمك: { cat: "meat_poultry", catAr: "اللحوم والدواجن", name: "سمك" },
    فلفل: { cat: "spices", catAr: "توابل وبهارات", name: "فلفل أسود" },
    كمون: { cat: "spices", catAr: "توابل وبهارات", name: "كمون مطحون" },
    ملح: { cat: "spices", catAr: "توابل وبهارات", name: "ملح طعام" },
    قرفة: { cat: "spices", catAr: "توابل وبهارات", name: "قرفة" },
    مناديل: { cat: "home_essentials", catAr: "مستلزمات المنزل", name: "مناديل ورقية" },
    قصدير: { cat: "home_essentials", catAr: "مستلزمات المنزل", name: "ورق ألومنيوم (قصدير)" },
    قمامة: { cat: "home_essentials", catAr: "مستلزمات المنزل", name: "أكياس قمامة" },
    صابون: { cat: "cleaning", catAr: "المنظفات", name: "صابون" },
    كلور: { cat: "cleaning", catAr: "المنظفات", name: "سائل مبيض (كلور)" },
    مسحوق: { cat: "cleaning", catAr: "المنظفات", name: "مسحوق غسيل" },
    ديتول: { cat: "cleaning", catAr: "المنظفات", name: "مطهر ومعقم" },
  };

  const detected = new Set<string>();

  for (const word of words) {
    const cleanWord = word.replace(/^(ال|و|وال|ب|بال)/, "");
    if (dict[word] && !detected.has(dict[word].name)) {
      detected.add(dict[word].name);
      items.push({
        name: dict[word].name,
        category: dict[word].cat,
        categoryArabic: dict[word].catAr,
        quantity: "حسب الحاجة",
        urgency: text.includes("خلص") || text.includes("ضروري") ? "high" : "normal",
        notes: "",
      });
    } else if (dict[cleanWord] && !detected.has(dict[cleanWord].name)) {
      detected.add(dict[cleanWord].name);
      items.push({
        name: dict[cleanWord].name,
        category: dict[cleanWord].cat,
        categoryArabic: dict[cleanWord].catAr,
        quantity: "حسب الحاجة",
        urgency: text.includes("خلص") || text.includes("ضروري") ? "high" : "normal",
        notes: "",
      });
    }
  }

  if (items.length === 0) {
    items.push({
      name: text.slice(0, 30),
      category: "supermarket",
      categoryArabic: "سوبرماركت",
      quantity: "١",
      urgency: "normal",
      notes: "إدخال يدوي",
    });
  }

  return items;
}

// 2. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "Talabat Al-Bayt API", time: new Date().toISOString() });
});

// Helper for Arabic normalization in server
function normalizeServerAr(text?: string | null): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ");
}

// 3. API: Authoritative Create Restaurant Order (public.restaurant_orders)
app.post("/api/food/create-order", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "يجب تسجيل الدخول بحساب موثق لإتمام الطلب.",
      });
    }

    // 1. Verify User from Token
    const {
      data: { user },
      error: authErr,
    } = await serverSupabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({
        success: false,
        message: "جلسة تسجيل الدخول غير صالحة أو منتهية، يرجى إعادة تسجيل الدخول.",
      });
    }
    const userId = user.id;

    const {
      restaurant,
      items,
      customerName,
      customerPhone,
      address,
      notes,
    } = req.body;

    if (!restaurant?.id) {
      return res.status(400).json({ success: false, message: "بيانات المطعم غير صالحة." });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "السلة فارغة، يرجى إضافة أصناف للطلب." });
    }
    if (!address?.id || !address.detailedAddress?.trim()) {
      return res.status(400).json({ success: false, message: "يرجى تحديد عنوان توصيل صالح ومكتمل." });
    }
    if (!customerPhone?.trim()) {
      return res.status(400).json({ success: false, message: "يرجى إدخال رقم هاتف للتواصل." });
    }

    // 2. Check restaurant_section_settings
    const { data: settingsData } = await serverSupabase
      .from("restaurant_section_settings")
      .select("*")
      .limit(1);

    const settings = settingsData?.[0];
    if (!settings || !settings.section_enabled) {
      return res.status(400).json({
        success: false,
        message: "قسم المطاعم متوقف حالياً من قِبل إدارة التطبيق (section_enabled = false).",
      });
    }
    if (settings.section_visibility === "hidden") {
      return res.status(400).json({
        success: false,
        message: "قسم المطاعم غير متاح حالياً (القسم مخفي في الإعدادات).",
      });
    }

    // 3. Verify Geographic Service Area Scope
    const { data: activeServiceAreas, error: saErr } = await serverSupabase
      .from("restaurant_section_service_areas")
      .select("id, governorate_id, center_id, area_id, is_active")
      .eq("is_active", true);

    if (saErr || !activeServiceAreas || activeServiceAreas.length === 0) {
      return res.status(400).json({
        success: false,
        message: "لا يوجد نطاق جغرافي مفعّل لقسم المطاعم في قاعدة البيانات حالياً.",
      });
    }

    // 4. Verify Restaurant in DB
    const { data: dbRestaurant, error: restErr } = await serverSupabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurant.id)
      .maybeSingle();

    if (restErr || !dbRestaurant || !dbRestaurant.is_active) {
      return res.status(400).json({
        success: false,
        message: "المطعم غير متاح حالياً أو تم إيقاف نشاطه.",
      });
    }
    if (!dbRestaurant.is_open) {
      return res.status(400).json({
        success: false,
        message: "المطعم مغلق حالياً ولا يستقبل طلبات جديدة.",
      });
    }

    // 5. Verify Menu Items & Options
    const menuItemIds = items.map((i: any) => i.menuItemId);
    const { data: dbItems, error: itemsErr } = await serverSupabase
      .from("restaurant_menu_items")
      .select("id, name, price, is_available")
      .eq("restaurant_id", dbRestaurant.id)
      .in("id", menuItemIds);

    if (itemsErr || !dbItems || dbItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "تعذر التحقق من أصناف الطلب في قائمة المطعم.",
      });
    }

    const dbItemMap = new Map(dbItems.map((it: any) => [it.id, it]));

    // Verify option values
    const allOptionValIds = items.flatMap((i: any) =>
      (i.selectedOptions || []).map((o: any) => o.optionId)
    );
    const dbOptionValMap = new Map<string, number>();

    if (allOptionValIds.length > 0) {
      const { data: dbOptVals } = await serverSupabase
        .from("restaurant_item_option_values")
        .select("id, extra_price, is_available")
        .in("id", allOptionValIds);

      if (dbOptVals) {
        dbOptVals.forEach((ov: any) => {
          if (ov.is_available) {
            dbOptionValMap.set(ov.id, Number(ov.extra_price) || 0);
          }
        });
      }
    }

    let verifiedSubtotal = 0;
    const verifiedItemsList: Array<{
      menu_item_id: string;
      item_name_snapshot: string;
      unit_price_snapshot: number;
      quantity: number;
      line_total: number;
      options_snapshot: any[];
      notes?: string;
    }> = [];

    for (const cartItem of items) {
      const verifiedDbItem = dbItemMap.get(cartItem.menuItemId);
      if (!verifiedDbItem) {
        return res.status(400).json({
          success: false,
          message: `الصنف "${cartItem.name}" لم يعد موجوداً في منيو هذا المطعم.`,
        });
      }
      if (!verifiedDbItem.is_available) {
        return res.status(400).json({
          success: false,
          message: `الصنف "${verifiedDbItem.name}" غير متوفر حالياً بالمطعم.`,
        });
      }

      const basePrice = Number(verifiedDbItem.price) || 0;
      let addOnsTotal = 0;
      const verifiedOptions = (cartItem.selectedOptions || []).map((opt: any) => {
        const verifiedExtra = dbOptionValMap.get(opt.optionId) ?? (Number(opt.price) || 0);
        addOnsTotal += verifiedExtra;
        return {
          group_id: opt.groupId,
          group_name: opt.groupName,
          option_id: opt.optionId,
          option_name: opt.optionName,
          extra_price: verifiedExtra,
        };
      });

      const verifiedUnitPrice = basePrice + addOnsTotal;
      const qty = Math.max(1, Math.floor(Number(cartItem.quantity) || 1));
      const lineTotal = verifiedUnitPrice * qty;
      verifiedSubtotal += lineTotal;

      verifiedItemsList.push({
        menu_item_id: verifiedDbItem.id,
        item_name_snapshot: verifiedDbItem.name,
        unit_price_snapshot: verifiedUnitPrice,
        quantity: qty,
        line_total: lineTotal,
        options_snapshot: verifiedOptions,
        notes: cartItem.notes,
      });
    }

    // 6. Resolve delivery fee
    let verifiedDeliveryFee = Number(dbRestaurant.delivery_fee) || 15;
    const { data: areaFees } = await serverSupabase
      .from("restaurant_area_delivery_fees")
      .select("id, area_id, delivery_fee, is_active")
      .eq("restaurant_id", dbRestaurant.id)
      .eq("is_active", true);

    if (areaFees && areaFees.length > 0 && address.markaz) {
      const areaIds = areaFees.map((f: any) => f.area_id);
      const { data: areas } = await serverSupabase
        .from("food_areas")
        .select("id, name_ar, name_en")
        .in("id", areaIds);

      if (areas && areas.length > 0) {
        const matched = areas.find((a: any) => {
          const name = a.name_ar || a.name_en;
          if (!name) return false;
          return (
            (address.markaz && address.markaz.includes(name)) ||
            (address.detailedAddress && address.detailedAddress.includes(name))
          );
        });
        if (matched) {
          const feeRow = areaFees.find((f: any) => f.area_id === matched.id);
          if (feeRow?.delivery_fee !== null && feeRow?.delivery_fee !== undefined) {
            verifiedDeliveryFee = Number(feeRow.delivery_fee);
          }
        }
      }
    }

    const verifiedTotalAmount = verifiedSubtotal + verifiedDeliveryFee;

    // 7. Calculate Fee Shares
    const commissionPercent = Number(dbRestaurant.commission_percent) || 0;
    const adminFeeShare = Number(((verifiedSubtotal * commissionPercent) / 100).toFixed(2));
    const restaurantFeeShare = Number((verifiedSubtotal - adminFeeShare).toFixed(2));
    const driverFeeShare = verifiedDeliveryFee;

    // 8. Insert into public.restaurant_orders
    const orderPayload = {
      customer_user_id: userId,
      restaurant_id: dbRestaurant.id,
      fulfillment_route:
        dbRestaurant.delivery_type === "restaurant_delivery" ? "restaurant_delivery" : "driver_delivery",
      status: "pending",
      restaurant_name_snapshot: dbRestaurant.name,
      restaurant_phone_snapshot: dbRestaurant.phone || null,
      restaurant_latitude_snapshot: Number(dbRestaurant.latitude) || 30.05,
      restaurant_longitude_snapshot: Number(dbRestaurant.longitude) || 31.34,
      customer_name: customerName?.trim() || "العميل",
      customer_phone: customerPhone?.trim() || "",
      delivery_address: address.detailedAddress || "",
      delivery_latitude: Number(address.latitude) || 30.05,
      delivery_longitude: Number(address.longitude) || 31.34,
      food_subtotal: verifiedSubtotal,
      discount_amount: 0,
      delivery_fee: verifiedDeliveryFee,
      customer_total: verifiedTotalAmount,
      commission_percent_snapshot: commissionPercent,
      driver_fee_share: driverFeeShare,
      admin_fee_share: adminFeeShare,
      restaurant_fee_share: restaurantFeeShare,
      payment_method: "cash",
      idempotency_key: crypto.randomUUID(),
      delivery_governorate_name_snapshot: address.governorate || "القاهرة",
      delivery_center_name_snapshot: address.markaz || "",
      delivery_area_name_snapshot: address.markaz || "",
    };

    const { data: createdOrder, error: orderErr } = await serverSupabase
      .from("restaurant_orders")
      .insert(orderPayload)
      .select()
      .single();

    if (orderErr || !createdOrder) {
      console.error("[Server Food API] Error inserting restaurant_orders:", orderErr);
      return res.status(500).json({
        success: false,
        message: `تعذر حفظ الطلب في قاعدة البيانات: ${orderErr?.message || "خطأ غير معروف"}`,
      });
    }

    // 9. Insert items into public.restaurant_order_items
    for (const it of verifiedItemsList) {
      const itemPayload = {
        order_id: createdOrder.id,
        menu_item_id: it.menu_item_id,
        item_name_snapshot: it.item_name_snapshot,
        unit_price_snapshot: it.unit_price_snapshot,
        quantity: it.quantity,
        discount_amount: 0,
        line_total: it.line_total,
        customer_approved_price_change: false,
      };

      const { data: insertedItem, error: itemErr } = await serverSupabase
        .from("restaurant_order_items")
        .insert(itemPayload)
        .select()
        .single();

      if (itemErr) {
        console.warn("[Server Food API] Error inserting item:", itemErr.message);
      }

      // 10. Insert options into public.restaurant_order_item_options
      if (insertedItem && it.options_snapshot.length > 0) {
        const optionsPayload = it.options_snapshot.map((opt: any) => ({
          order_item_id: insertedItem.id,
          option_name_snapshot: opt.group_name || opt.option_name,
          value_name_snapshot: opt.option_name,
          extra_price_snapshot: Number(opt.extra_price) || 0,
        }));

        const { error: optErr } = await serverSupabase
          .from("restaurant_order_item_options")
          .insert(optionsPayload);

        if (optErr) {
          console.warn("[Server Food API] Error inserting options:", optErr.message);
        }
      }
    }

    // 11. Insert initial status history into public.restaurant_order_status_history
    await serverSupabase.from("restaurant_order_status_history").insert({
      order_id: createdOrder.id,
      new_status: "pending",
      changed_by: userId,
      note: "تم إنشاء طلب المطعم بنجاح عبر تطبيق طلباتي",
    });

    return res.json({
      success: true,
      order: createdOrder,
      orderNumber: createdOrder.order_number,
      message: "تم إنشاء الطلب بنجاح",
    });
  } catch (err: any) {
    console.error("[Server Food API] Exception in create-order:", err);
    return res.status(500).json({
      success: false,
      message: `حدث استثناء غير متوقع أثناء إنشاء الطلب: ${err?.message || "خطأ غير معروف"}`,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Talabat Al-Bayt Server listening on http://localhost:${PORT}`);
  });
}

startServer();

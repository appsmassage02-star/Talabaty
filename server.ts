import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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

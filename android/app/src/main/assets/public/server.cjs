var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
var UPLOADS_DIR = import_path.default.join(process.cwd(), "uploads");
if (!import_fs.default.existsSync(UPLOADS_DIR)) {
  import_fs.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use(
  "/uploads",
  import_express.default.static(UPLOADS_DIR, {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  })
);
app.post("/api/storage/upload", (req, res) => {
  try {
    const { path: relPath, dataUrl, contentType } = req.body;
    if (!relPath || !dataUrl) {
      return res.status(400).json({ error: "\u0645\u0633\u0627\u0631 \u0627\u0644\u0635\u0648\u0631\u0629 \u0623\u0648 \u0628\u064A\u0627\u0646\u0627\u062A\u0647\u0627 \u0645\u0641\u0642\u0648\u062F\u0629" });
    }
    const cleanRelPath = String(relPath).replace(/[^a-zA-Z0-9_\-\.\/]/g, "").replace(/\.\./g, "");
    const targetFilePath = import_path.default.join(UPLOADS_DIR, cleanRelPath);
    const targetDir = import_path.default.dirname(targetFilePath);
    if (!import_fs.default.existsSync(targetDir)) {
      import_fs.default.mkdirSync(targetDir, { recursive: true });
    }
    const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const buffer = Buffer.from(base64Data, "base64");
    import_fs.default.writeFileSync(targetFilePath, buffer);
    let clientOrigin = req.body?.origin || "";
    if (!clientOrigin) {
      const headerOrigin = req.get("origin") || req.get("referer");
      if (headerOrigin) {
        try {
          const u = new URL(headerOrigin);
          clientOrigin = u.origin;
        } catch {
        }
      }
    }
    if (!clientOrigin && req.get("x-forwarded-host")) {
      const proto = req.get("x-forwarded-proto") || "https";
      clientOrigin = `${proto}://${req.get("x-forwarded-host")}`;
    }
    if (!clientOrigin && process.env.APP_URL) {
      clientOrigin = process.env.APP_URL.replace(/\/+$/, "");
    }
    if (!clientOrigin || clientOrigin.includes("localhost") || clientOrigin.includes("127.0.0.1")) {
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
    if (clientOrigin && clientOrigin.startsWith("http://") && (clientOrigin.includes(".run.app") || clientOrigin.includes("ais-"))) {
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
      mimeType: contentType || "image/jpeg"
    });
  } catch (err) {
    console.error("[Storage API] Upload error:", err);
    return res.status(500).json({
      error: `\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0645\u0644\u0641 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645: ${err?.message || "\u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641"}`
    });
  }
});
app.post("/api/storage/remove", (req, res) => {
  try {
    const { paths } = req.body;
    if (Array.isArray(paths)) {
      for (const p of paths) {
        const cleanRelPath = String(p).replace(/[^a-zA-Z0-9_\-\.\/]/g, "").replace(/\.\./g, "");
        const targetFilePath = import_path.default.join(UPLOADS_DIR, cleanRelPath);
        if (import_fs.default.existsSync(targetFilePath)) {
          import_fs.default.unlinkSync(targetFilePath);
        }
      }
    }
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: false });
  }
});
var getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. Fallback parsing will be used.");
    return null;
  }
  return new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};
var CATEGORY_MAP = {
  supermarket: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A",
  vegetables_fruits: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647",
  meat_poultry: "\u0627\u0644\u0644\u062D\u0648\u0645 \u0648\u0627\u0644\u062F\u0648\u0627\u062C\u0646",
  spices: "\u062A\u0648\u0627\u0628\u0644 \u0648\u0628\u0647\u0627\u0631\u0627\u062A",
  home_essentials: "\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0627\u0644\u0645\u0646\u0632\u0644",
  cleaning: "\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A"
};
app.post("/api/gemini/parse-groceries", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062A\u062D\u0644\u064A\u0644\u0647 \u0641\u0627\u0631\u063A" });
    }
    const ai = getAiClient();
    if (!ai) {
      const items = fallbackParseArabic(text);
      return res.json({ success: true, items, source: "rule_engine" });
    }
    const prompt = `\u0623\u0646\u062A \u0645\u0633\u0627\u0639\u062F \u0630\u0643\u064A \u0648\u0645\u062A\u062E\u0635\u0635 \u0644\u062A\u0637\u0628\u064A\u0642 "\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0628\u064A\u062A".
\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u062F\u062E\u0644 \u062C\u0645\u0644\u0629 \u0639\u0641\u0648\u064A\u0629 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0623\u0648 \u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0639\u0627\u0645\u064A\u0629 \u0639\u0646 \u0623\u063A\u0631\u0627\u0636 \u0648\u0646\u0648\u0627\u0642\u0635 \u064A\u062D\u062A\u0627\u062C\u0647\u0627 \u0627\u0644\u0645\u0646\u0632\u0644:
"${text}"

\u0645\u0647\u0645\u062A\u0643:
1. \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u062C\u0645\u064A\u0639 \u0627\u0644\u0646\u0648\u0627\u0642\u0635/\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u0645\u0630\u0643\u0648\u0631\u0629 \u0628\u062F\u0642\u0629.
2. \u062A\u0635\u0646\u064A\u0641 \u0643\u0644 \u0645\u0646\u062A\u062C \u0625\u0644\u0649 \u0625\u062D\u062F\u0649 \u0627\u0644\u0641\u0626\u0627\u062A \u0627\u0644\u0633\u062A \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0628\u0627\u0644\u0636\u0628\u0637:
   - "supermarket" (\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A: \u0623\u0644\u0628\u0627\u0646\u060C \u0623\u062C\u0628\u0627\u0646\u060C \u0628\u064A\u0636\u060C \u0645\u0639\u0644\u0628\u0627\u062A\u060C \u062E\u0628\u0632\u060C \u0632\u064A\u062A\u060C \u0633\u0643\u0631\u060C \u0634\u0627\u064A\u060C \u0642\u0647\u0648\u0629\u060C \u0623\u0631\u0632\u060C \u0645\u0643\u0631\u0648\u0646\u0629)
   - "vegetables_fruits" (\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647: \u0637\u0645\u0627\u0637\u0645\u060C \u062E\u064A\u0627\u0631\u060C \u0628\u0635\u0644\u060C \u062B\u0648\u0645\u060C \u0628\u0637\u0627\u0637\u0633\u060C \u0645\u0648\u0632\u060C \u062A\u0641\u0627\u062D\u060C \u0628\u0631\u062A\u0642\u0627\u0644\u060C \u0644\u064A\u0645\u0648\u0646...)
   - "meat_poultry" (\u0627\u0644\u0644\u062D\u0648\u0645 \u0648\u0627\u0644\u062F\u0648\u0627\u062C\u0646: \u0644\u062D\u0645 \u0645\u0641\u0631\u0648\u0645\u060C \u062F\u062C\u0627\u062C\u060C \u0641\u064A\u0644\u064A\u0647\u060C \u0643\u0641\u062A\u0629\u060C \u0643\u0628\u062F\u0629\u060C \u0633\u0645\u0643\u060C \u0631\u064A\u0634...)
   - "spices" (\u062A\u0648\u0627\u0628\u0644 \u0648\u0628\u0647\u0627\u0631\u0627\u062A: \u0641\u0644\u0641\u0644 \u0623\u0633\u0648\u062F\u060C \u0643\u0645\u0648\u0646\u060C \u0643\u0632\u0628\u0631\u0629\u060C \u0642\u0631\u0641\u0629\u060C \u0643\u0627\u0631\u064A\u060C \u062D\u0628\u0647\u0627\u0646\u060C \u0628\u0627\u0628\u0631\u064A\u0643\u0627\u060C \u0632\u0639\u062A\u0631\u060C \u0632\u0646\u062C\u0628\u064A\u0644...)
   - "home_essentials" (\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0627\u0644\u0645\u0646\u0632\u0644: \u0645\u0646\u0627\u062F\u064A\u0644\u060C \u0642\u0635\u062F\u064A\u0631\u060C \u0623\u0643\u064A\u0627\u0633 \u0642\u0645\u0627\u0645\u0629\u060C \u0628\u0637\u0627\u0631\u064A\u0627\u062A\u060C \u0644\u0645\u0628\u0627\u062A\u060C \u0648\u0631\u0642 \u0632\u0628\u062F\u0629...)
   - "cleaning" (\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A: \u0645\u0633\u062D\u0648\u0642 \u063A\u0633\u064A\u0644\u060C \u0635\u0627\u0628\u0648\u0646 \u0623\u0637\u0628\u0627\u0642\u060C \u0643\u0644\u0648\u0631\u060C \u0645\u0639\u0637\u0631 \u062C\u0648\u060C \u0645\u0637\u0647\u0631 \u0623\u0631\u0636\u064A\u0627\u062A\u060C \u0625\u0633\u0641\u0646\u062C...)
3. \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0643\u0645\u064A\u0629 \u0623\u0648 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0645\u0630\u0643\u0648\u0631\u0629 (\u0645\u062B\u0644: "\u0662 \u0644\u062A\u0631", "\u0661 \u0643\u064A\u0644\u0648", "\u0663 \u062D\u0628\u0627\u062A", "\u0643\u0631\u062A\u0648\u0646\u0629"). \u0625\u0630\u0627 \u0644\u0645 \u062A\u064F\u0630\u0643\u0631 \u0643\u0645\u064A\u0629 \u0641\u062D\u062F\u062F "\u062D\u0633\u0628 \u0627\u0644\u062D\u0627\u062C\u0629".
4. \u062A\u062D\u062F\u064A\u062F \u062F\u0631\u062C\u0629 \u0627\u0644\u0623\u0647\u0645\u064A\u0629: "high" (\u0625\u0630\u0627 \u0630\u0643\u0631 \u062E\u0644\u0635 \u062A\u0645\u0627\u0645\u0627\u064B \u0623\u0648 \u0639\u0627\u062C\u0644 \u0623\u0648 \u0636\u0631\u0648\u0631\u064A) \u0623\u0648 "normal".
5. \u0643\u062A\u0627\u0628\u0629 \u0623\u064A \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 \u0645\u0630\u0643\u0648\u0631\u0629 (\u0645\u062B\u0644: \u0642\u0644\u064A\u0644 \u0627\u0644\u062F\u0633\u0645\u060C \u062D\u062C\u0645 \u0639\u0627\u0626\u0644\u064A\u060C \u0645\u0627\u0631\u0643\u0629 \u0645\u062D\u062F\u062F\u0629).`;
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            summary: {
              type: import_genai.Type.STRING,
              description: "\u0645\u0644\u062E\u0635 \u0644\u0637\u064A\u0641 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0644\u0645\u0627 \u062A\u0645 \u0627\u0633\u062A\u062E\u0631\u0627\u062C\u0647"
            },
            items: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  name: {
                    type: import_genai.Type.STRING,
                    description: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u062D\u0649 \u0627\u0644\u0648\u0627\u0636\u062D\u0629"
                  },
                  category: {
                    type: import_genai.Type.STRING,
                    description: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0626\u0629: supermarket, vegetables_fruits, meat_poultry, spices, home_essentials, cleaning"
                  },
                  categoryArabic: {
                    type: import_genai.Type.STRING,
                    description: "\u0627\u0633\u0645 \u0627\u0644\u0641\u0626\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629"
                  },
                  quantity: {
                    type: import_genai.Type.STRING,
                    description: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0623\u0648 \u0627\u0644\u0639\u062F\u062F\u060C \u0645\u062B\u0644: \u0661 \u0643\u064A\u0644\u0648\u060C \u0662 \u0644\u062A\u0631\u060C \u0623\u0648 \u062D\u0633\u0628 \u0627\u0644\u062D\u0627\u062C\u0629"
                  },
                  urgency: {
                    type: import_genai.Type.STRING,
                    description: "\u062F\u0631\u062C\u0629 \u0627\u0644\u0623\u0647\u0645\u064A\u0629: high, normal, low"
                  },
                  notes: {
                    type: import_genai.Type.STRING,
                    description: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 \u062E\u0627\u0635\u0629 \u0628\u0627\u0644\u0645\u0646\u062A\u062C"
                  }
                },
                required: ["name", "category", "categoryArabic", "quantity", "urgency"]
              }
            }
          },
          required: ["summary", "items"]
        }
      }
    });
    const parsedJson = JSON.parse(response.text?.trim() || "{}");
    return res.json({
      success: true,
      summary: parsedJson.summary || "\u062A\u0645 \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0628\u0646\u062C\u0627\u062D",
      items: (parsedJson.items || []).map((item) => ({
        ...item,
        categoryArabic: CATEGORY_MAP[item.category] || item.categoryArabic || "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A"
      })),
      source: "gemini"
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    const fallbackItems = fallbackParseArabic(req.body?.text || "");
    return res.json({
      success: true,
      summary: "\u062A\u0645 \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0646\u0648\u0627\u0642\u0635 \u0639\u0628\u0631 \u0627\u0644\u0645\u062D\u0644\u0644 \u0627\u0644\u0630\u0643\u064A",
      items: fallbackItems,
      source: "fallback",
      errorMsg: error?.message
    });
  }
});
function fallbackParseArabic(text) {
  const cleaned = text.replace(/[،,.]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const items = [];
  const dict = {
    \u0644\u0628\u0646: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u062D\u0644\u064A\u0628 \u0637\u0627\u0632\u062C" },
    \u062D\u0644\u064A\u0628: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u062D\u0644\u064A\u0628" },
    \u062C\u0628\u0646\u0629: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u062C\u0628\u0646\u0629" },
    \u062C\u0628\u0646: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u062C\u0628\u0646\u0629" },
    \u0628\u064A\u0636: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u0628\u064A\u0636 \u0637\u0627\u0632\u062C" },
    \u062E\u0628\u0632: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u062E\u0628\u0632" },
    \u0632\u064A\u062A: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u0632\u064A\u062A \u0637\u0628\u062E" },
    \u0633\u0643\u0631: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u0633\u0643\u0631" },
    \u0634\u0627\u064A: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u0634\u0627\u064A" },
    \u0642\u0647\u0648\u0629: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u0642\u0647\u0648\u0629" },
    \u0627\u0631\u0632: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u0623\u0631\u0632" },
    \u0623\u0631\u0632: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u0623\u0631\u0632" },
    \u0631\u0632: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u0623\u0631\u0632" },
    \u0645\u0643\u0631\u0648\u0646\u0629: { cat: "supermarket", catAr: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A", name: "\u0645\u0643\u0631\u0648\u0646\u0629" },
    \u0637\u0645\u0627\u0637\u0645: { cat: "vegetables_fruits", catAr: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647", name: "\u0637\u0645\u0627\u0637\u0645" },
    \u0628\u0646\u062F\u0648\u0631\u0629: { cat: "vegetables_fruits", catAr: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647", name: "\u0637\u0645\u0627\u0637\u0645" },
    \u062E\u064A\u0627\u0631: { cat: "vegetables_fruits", catAr: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647", name: "\u062E\u064A\u0627\u0631" },
    \u0628\u0635\u0644: { cat: "vegetables_fruits", catAr: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647", name: "\u0628\u0635\u0644" },
    \u0628\u0637\u0627\u0637\u0633: { cat: "vegetables_fruits", catAr: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647", name: "\u0628\u0637\u0627\u0637\u0633" },
    \u0645\u0648\u0632: { cat: "vegetables_fruits", catAr: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647", name: "\u0645\u0648\u0632" },
    \u062A\u0641\u0627\u062D: { cat: "vegetables_fruits", catAr: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647", name: "\u062A\u0641\u0627\u062D" },
    \u0628\u0631\u062A\u0642\u0627\u0644: { cat: "vegetables_fruits", catAr: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647", name: "\u0628\u0631\u062A\u0642\u0627\u0644" },
    \u0644\u064A\u0645\u0648\u0646: { cat: "vegetables_fruits", catAr: "\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0641\u0648\u0627\u0643\u0647", name: "\u0644\u064A\u0645\u0648\u0646" },
    \u0644\u062D\u0645: { cat: "meat_poultry", catAr: "\u0627\u0644\u0644\u062D\u0648\u0645 \u0648\u0627\u0644\u062F\u0648\u0627\u062C\u0646", name: "\u0644\u062D\u0645 \u0637\u0627\u0632\u062C" },
    \u0644\u062D\u0645\u0629: { cat: "meat_poultry", catAr: "\u0627\u0644\u0644\u062D\u0648\u0645 \u0648\u0627\u0644\u062F\u0648\u0627\u062C\u0646", name: "\u0644\u062D\u0645" },
    \u062F\u062C\u0627\u062C: { cat: "meat_poultry", catAr: "\u0627\u0644\u0644\u062D\u0648\u0645 \u0648\u0627\u0644\u062F\u0648\u0627\u062C\u0646", name: "\u062F\u062C\u0627\u062C" },
    \u0641\u0631\u0627\u062E: { cat: "meat_poultry", catAr: "\u0627\u0644\u0644\u062D\u0648\u0645 \u0648\u0627\u0644\u062F\u0648\u0627\u062C\u0646", name: "\u062F\u062C\u0627\u062C \u0637\u0627\u0632\u062C" },
    \u0633\u0645\u0643: { cat: "meat_poultry", catAr: "\u0627\u0644\u0644\u062D\u0648\u0645 \u0648\u0627\u0644\u062F\u0648\u0627\u062C\u0646", name: "\u0633\u0645\u0643" },
    \u0641\u0644\u0641\u0644: { cat: "spices", catAr: "\u062A\u0648\u0627\u0628\u0644 \u0648\u0628\u0647\u0627\u0631\u0627\u062A", name: "\u0641\u0644\u0641\u0644 \u0623\u0633\u0648\u062F" },
    \u0643\u0645\u0648\u0646: { cat: "spices", catAr: "\u062A\u0648\u0627\u0628\u0644 \u0648\u0628\u0647\u0627\u0631\u0627\u062A", name: "\u0643\u0645\u0648\u0646 \u0645\u0637\u062D\u0648\u0646" },
    \u0645\u0644\u062D: { cat: "spices", catAr: "\u062A\u0648\u0627\u0628\u0644 \u0648\u0628\u0647\u0627\u0631\u0627\u062A", name: "\u0645\u0644\u062D \u0637\u0639\u0627\u0645" },
    \u0642\u0631\u0641\u0629: { cat: "spices", catAr: "\u062A\u0648\u0627\u0628\u0644 \u0648\u0628\u0647\u0627\u0631\u0627\u062A", name: "\u0642\u0631\u0641\u0629" },
    \u0645\u0646\u0627\u062F\u064A\u0644: { cat: "home_essentials", catAr: "\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0627\u0644\u0645\u0646\u0632\u0644", name: "\u0645\u0646\u0627\u062F\u064A\u0644 \u0648\u0631\u0642\u064A\u0629" },
    \u0642\u0635\u062F\u064A\u0631: { cat: "home_essentials", catAr: "\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0627\u0644\u0645\u0646\u0632\u0644", name: "\u0648\u0631\u0642 \u0623\u0644\u0648\u0645\u0646\u064A\u0648\u0645 (\u0642\u0635\u062F\u064A\u0631)" },
    \u0642\u0645\u0627\u0645\u0629: { cat: "home_essentials", catAr: "\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0627\u0644\u0645\u0646\u0632\u0644", name: "\u0623\u0643\u064A\u0627\u0633 \u0642\u0645\u0627\u0645\u0629" },
    \u0635\u0627\u0628\u0648\u0646: { cat: "cleaning", catAr: "\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A", name: "\u0635\u0627\u0628\u0648\u0646" },
    \u0643\u0644\u0648\u0631: { cat: "cleaning", catAr: "\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A", name: "\u0633\u0627\u0626\u0644 \u0645\u0628\u064A\u0636 (\u0643\u0644\u0648\u0631)" },
    \u0645\u0633\u062D\u0648\u0642: { cat: "cleaning", catAr: "\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A", name: "\u0645\u0633\u062D\u0648\u0642 \u063A\u0633\u064A\u0644" },
    \u062F\u064A\u062A\u0648\u0644: { cat: "cleaning", catAr: "\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A", name: "\u0645\u0637\u0647\u0631 \u0648\u0645\u0639\u0642\u0645" }
  };
  const detected = /* @__PURE__ */ new Set();
  for (const word of words) {
    const cleanWord = word.replace(/^(ال|و|وال|ب|بال)/, "");
    if (dict[word] && !detected.has(dict[word].name)) {
      detected.add(dict[word].name);
      items.push({
        name: dict[word].name,
        category: dict[word].cat,
        categoryArabic: dict[word].catAr,
        quantity: "\u062D\u0633\u0628 \u0627\u0644\u062D\u0627\u062C\u0629",
        urgency: text.includes("\u062E\u0644\u0635") || text.includes("\u0636\u0631\u0648\u0631\u064A") ? "high" : "normal",
        notes: ""
      });
    } else if (dict[cleanWord] && !detected.has(dict[cleanWord].name)) {
      detected.add(dict[cleanWord].name);
      items.push({
        name: dict[cleanWord].name,
        category: dict[cleanWord].cat,
        categoryArabic: dict[cleanWord].catAr,
        quantity: "\u062D\u0633\u0628 \u0627\u0644\u062D\u0627\u062C\u0629",
        urgency: text.includes("\u062E\u0644\u0635") || text.includes("\u0636\u0631\u0648\u0631\u064A") ? "high" : "normal",
        notes: ""
      });
    }
  }
  if (items.length === 0) {
    items.push({
      name: text.slice(0, 30),
      category: "supermarket",
      categoryArabic: "\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062A",
      quantity: "\u0661",
      urgency: "normal",
      notes: "\u0625\u062F\u062E\u0627\u0644 \u064A\u062F\u0648\u064A"
    });
  }
  return items;
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "Talabat Al-Bayt API", time: (/* @__PURE__ */ new Date()).toISOString() });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Talabat Al-Bayt Server listening on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map

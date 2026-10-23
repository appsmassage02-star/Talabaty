// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This serves as an authenticated/secure Supabase Edge Function for Talabat Al-Bayt Gemini Assistant.

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestPayload {
  text: string;
}

const CATEGORY_MAP: Record<string, string> = {
  supermarket: "سوبرماركت",
  vegetables_fruits: "خضروات وفواكه",
  meat_poultry: "اللحوم والدواجن",
  spices: "توابل وبهارات",
  home_essentials: "مستلزمات المنزل",
  cleaning: "المنظفات",
};

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Validate Request Method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed", success: false }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse & Validate Payload
    let body: RequestPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text } = body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "النص المطلوب تحليله فارغ", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Abuse protection: limit prompt length
    if (text.length > 1500) {
      return new Response(
        JSON.stringify({ error: "النص المدخل طويل جداً (الحد الأقصى 1500 حرف)", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Secure Server-Side Gemini API Key retrieval
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error: "لم يتم تكوين مفتاح GEMINI_API_KEY السري على Supabase Edge Functions",
          success: false,
          code: "GEMINI_KEY_NOT_CONFIGURED",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Construct Structured Prompt
    const systemPrompt = `أنت مساعد ذكي ومتخصص لتطبيق "طلبات البيت".
المستخدم أدخل جملة عفوية باللغة العربية أو اللهجة العامية عن أغراض ونواقص يحتاجها المنزل:
"${text.trim()}"

مهمتك:
1. استخراج جميع النواقص/المنتجات المذكورة بدقة.
2. تصنيف كل منتج إلى إحدى الفئات الست المحددة بالضبط:
   - "supermarket" (سوبرماركت: ألبان، أجبان، بيض، معلبات، خبز، زيت، سكر، شاي، قهوة، أرز، مكرونة)
   - "vegetables_fruits" (خضروات وفواكه: طماطم، خيار، بصل، ثوم، بطاطس، موز، تفاح، برتقال، ليمون...)
   - "meat_poultry" (اللحوم والدواجن: لحم مفروم، دجاج، فيليه، كفتة، كبدة، سمك، ريش...)
   - "spices" (توابل وبهارات: فلفل أسود، كمون، كزبرة، قرفة، كاري، حبهان، بابريكا، زعتر، زنجبيل...)
   - "home_essentials" (مستلزمات المنزل: مناديل، قصدير، أكياس قمامة، بطاريات، لمبات، ورق زبدة...)
   - "cleaning" (المنظفات: مسحوق غسيل، صابون أطباق، كلور، معطر جو، مطهر أرضيات، إسفنج...)
3. استخراج الكمية المذكورة (مثل: "٢ لتر", "١ كيلو", "٣ حبات", "كرتونة"). إذا لم تُذكر كمية فحدد "١".
4. تحديد درجة الأهمية: "high" (إذا ذكر خلص تماماً أو عاجل أو ضروري) أو "normal".
5. كتابة أي ملاحظات إضافية مذكورة.

أرجع النتيجة بصيغة JSON فقط:
{
  "summary": "ملخص باللغة العربية",
  "items": [
    {
      "name": "اسم المنتج",
      "category": "supermarket | vegetables_fruits | meat_poultry | spices | home_essentials | cleaning",
      "categoryArabic": "اسم الفئة بالعربية",
      "quantity": "الكمية",
      "urgency": "high | normal | low",
      "notes": "أي ملاحظات"
    }
  ]
}`;

    // 6. Call Google Gemini API securely from Edge Function
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: systemPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error from Edge Function:", errText);
      return new Response(
        JSON.stringify({
          error: "تعذر الاتصال بخدمة الذكاء الاصطناعي Gemini حالياً",
          success: false,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    let parsedResult = { summary: "تم تحليل النواقص بنجاح", items: [] };
    if (rawContent) {
      try {
        parsedResult = JSON.parse(rawContent);
      } catch (e) {
        console.error("Error parsing Gemini JSON output:", e);
      }
    }

    // Normalize category names
    const sanitizedItems = (parsedResult.items || []).map((item: any) => ({
      name: String(item.name || "").trim(),
      category: CATEGORY_MAP[item.category] ? item.category : "supermarket",
      categoryArabic: CATEGORY_MAP[item.category] || item.categoryArabic || "سوبرماركت",
      quantity: String(item.quantity || "١").trim(),
      urgency: item.urgency === "high" ? "high" : "normal",
      notes: String(item.notes || "").trim(),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        summary: parsedResult.summary || "تم تحليل واستخراج النواقص بنجاح",
        items: sanitizedItems,
        source: "supabase_edge_gemini",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unexpected Edge Function Exception:", err);
    return new Response(
      JSON.stringify({ error: "حدث خطأ غير متوقع أثناء معالجة الطلب", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

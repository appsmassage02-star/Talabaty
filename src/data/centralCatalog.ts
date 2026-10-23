import { GlobalCategory, GlobalProduct } from '../types';

/**
 * الكتالوج المركزي المعتمد — طلبات البيت
 * 
 * يتكون من 6 أقسام رئيسية معتمدة:
 * 1. 🛒 السوبر ماركت (supermarket)
 * 2. 🥬 الخضار والفواكه (vegetables_fruits)
 * 3. 🥩 اللحوم والدواجن (meat_poultry)
 * 4. 🌿 العطارة والتوابل (spices)
 * 5. 🏠 مستلزمات المنزل (home_essentials)
 * 6. 🧹 المنظفات (cleaning)
 * 
 * تم تجهيز البيانات وفقاً للمعايير التالية:
 * - معرّفات (IDs) ثابتة وآمنة غير عشوائية
 * - ربط كامل مع global_category_id و subcategory_id
 * - وحدات قياس قياسية موحدة من القائمة المعتمدة
 * - إزالة كاملة للتكرارات غير المنطقية
 * - جاهزة للاستيراد المباشر إلى Supabase في المرحلة اللاحقة
 */

export const CENTRAL_CATEGORIES: GlobalCategory[] = [
  {
    id: 'supermarket',
    name_ar: 'السوبر ماركت',
    name_en: 'Supermarket',
    image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    icon_name: 'ShoppingCart',
    color: 'emerald',
    bg_light: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    badge_color: 'bg-emerald-100 text-emerald-800',
    description: 'الألبان، الأجبان، البقوليات، الزيوت، الحبوب، المعلبات، والمخبوزات',
    subcategories: [
      { id: 'sm_dairy_cheese_eggs', nameAr: 'الألبان والجبن والبيض', nameEn: 'Dairy, Cheese & Eggs', items: [] },
      { id: 'sm_canned_food', nameAr: 'المعلبات', nameEn: 'Canned Food', items: [] },
      { id: 'sm_legumes_grains', nameAr: 'البقوليات والحبوب', nameEn: 'Legumes & Grains', items: [] },
      { id: 'sm_rice_pasta', nameAr: 'الأرز والمكرونة', nameEn: 'Rice & Pasta', items: [] },
      { id: 'sm_flour_bakery', nameAr: 'الدقيق والمخبوزات', nameEn: 'Flour & Bakery', items: [] },
      { id: 'sm_oils_ghee', nameAr: 'الزيوت والسمن', nameEn: 'Oils & Ghee', items: [] },
      { id: 'sm_sugar_sweeteners', nameAr: 'السكر والمحليات', nameEn: 'Sugar & Sweeteners', items: [] },
      { id: 'sm_hot_drinks', nameAr: 'الشاي والقهوة والمشروبات الساخنة', nameEn: 'Hot Drinks', items: [] },
      { id: 'sm_beverages', nameAr: 'العصائر والمشروبات', nameEn: 'Beverages & Juices', items: [] },
      { id: 'sm_biscuits_sweets', nameAr: 'البسكويت والحلويات', nameEn: 'Biscuits & Sweets', items: [] },
      { id: 'sm_chips_snacks', nameAr: 'الشيبسي والمقرمشات', nameEn: 'Chips & Snacks', items: [] },
      { id: 'sm_sauces', nameAr: 'الصوصات', nameEn: 'Sauces', items: [] },
      { id: 'sm_jams_spreads', nameAr: 'المربى والعسل', nameEn: 'Jams & Honey', items: [] },
      { id: 'sm_breakfast', nameAr: 'منتجات الإفطار', nameEn: 'Breakfast Products', items: [] },
      { id: 'sm_frozen_food', nameAr: 'الأغذية المجمدة', nameEn: 'Frozen Foods', items: [] },
      { id: 'sm_cooking_supplies', nameAr: 'مستلزمات الطبخ', nameEn: 'Cooking Supplies', items: [] },
      { id: 'sm_baby_food', nameAr: 'أغذية الأطفال', nameEn: 'Baby Food', items: [] },
    ],
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'vegetables_fruits',
    name_ar: 'الخضار والفواكه',
    name_en: 'Vegetables & Fruits',
    image_url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Apple',
    color: 'amber',
    bg_light: 'bg-amber-50 text-amber-800 border-amber-200',
    badge_color: 'bg-amber-100 text-amber-800',
    description: 'الخضروات الطازجة، الفواكه الموسمية، الحمضيات، والورقيات',
    subcategories: [
      { id: 'vf_leafy_greens', nameAr: 'الخضروات الورقية', nameEn: 'Leafy Greens', items: [] },
      { id: 'vf_basic_veg', nameAr: 'الخضروات الأساسية', nameEn: 'Basic Vegetables', items: [] },
      { id: 'vf_other_veg', nameAr: 'الخضروات الأخرى', nameEn: 'Other Vegetables', items: [] },
      { id: 'vf_citrus', nameAr: 'الحمضيات', nameEn: 'Citrus', items: [] },
      { id: 'vf_local_fruits', nameAr: 'الفواكه المحلية', nameEn: 'Local Fruits', items: [] },
      { id: 'vf_imported_fruits', nameAr: 'الفواكه المستوردة', nameEn: 'Imported Fruits', items: [] },
    ],
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'meat_poultry',
    name_ar: 'اللحوم والدواجن',
    name_en: 'Meat & Poultry',
    image_url: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Beef',
    color: 'rose',
    bg_light: 'bg-rose-50 text-rose-800 border-rose-200',
    badge_color: 'bg-rose-100 text-rose-800',
    description: 'اللحوم الحمراء، الدواجن والطيور، الأسماك البحرية، واللحوم المصنعة',
    subcategories: [
      { id: 'meat_red', nameAr: 'اللحوم الحمراء', nameEn: 'Red Meat', items: [] },
      { id: 'meat_poultry_birds', nameAr: 'الدواجن والطيور', nameEn: 'Poultry & Birds', items: [] },
      { id: 'meat_seafood', nameAr: 'الأسماك والمأكولات البحرية', nameEn: 'Fish & Seafood', items: [] },
      { id: 'meat_ready', nameAr: 'اللحوم والدواجن الجاهزة', nameEn: 'Ready Meat & Poultry', items: [] },
    ],
    is_active: true,
    sort_order: 3,
  },
  {
    id: 'spices',
    name_ar: 'العطارة والتوابل',
    name_en: 'Spices & Herbs',
    image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Flame',
    color: 'orange',
    bg_light: 'bg-orange-50 text-orange-800 border-orange-200',
    badge_color: 'bg-orange-100 text-orange-800',
    description: 'التوابل الشرقية، الأعشاب الطبيعية، الخلطات، والحبوب والبذور',
    subcategories: [
      { id: 'spices_seasoning', nameAr: 'التوابل', nameEn: 'Seasoning & Spices', items: [] },
      { id: 'spices_herbs_drinks', nameAr: 'الأعشاب والمشروبات العشبية', nameEn: 'Herbs & Herbal Drinks', items: [] },
      { id: 'spices_seeds', nameAr: 'الحبوب والبذور', nameEn: 'Seeds & Grains', items: [] },
    ],
    is_active: true,
    sort_order: 4,
  },
  {
    id: 'home_essentials',
    name_ar: 'مستلزمات المنزل',
    name_en: 'Home Supplies',
    image_url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Home',
    color: 'indigo',
    bg_light: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    badge_color: 'bg-indigo-100 text-indigo-800',
    description: 'أدوات التنظيف والغسيل، أكياس القمامة والتخزين، والرولات الورقية',
    subcategories: [
      { id: 'home_cleaning_tools', nameAr: 'التنظيف والغسيل', nameEn: 'Cleaning & Washing Tools', items: [] },
      { id: 'home_trash_storage', nameAr: 'القمامة والتخزين', nameEn: 'Trash & Food Storage', items: [] },
      { id: 'home_paper_products', nameAr: 'الورقيات', nameEn: 'Paper Products & Tissues', items: [] },
    ],
    is_active: true,
    sort_order: 5,
  },
  {
    id: 'cleaning',
    name_ar: 'المنظفات',
    name_en: 'Cleaning Supplies',
    image_url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Sparkles',
    color: 'cyan',
    bg_light: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    badge_color: 'bg-cyan-100 text-cyan-800',
    description: 'منظفات ومساحيق الغسيل، سوائل الأطباق، ومطهرات ومعقمات المنزل',
    subcategories: [
      { id: 'clean_laundry', nameAr: 'منظفات الغسيل', nameEn: 'Laundry Detergents', items: [] },
      { id: 'clean_home', nameAr: 'منظفات المنزل', nameEn: 'Household Cleaners', items: [] },
    ],
    is_active: true,
    sort_order: 6,
  },
  {
    id: 'pharmacy',
    name_ar: 'الصيدلية',
    name_en: 'Pharmacy',
    image_url: 'https://placehold.co/800x600/png?text=Pharmacy',
    icon_name: 'Pill',
    color: 'teal',
    bg_light: 'bg-teal-50 text-teal-800 border-teal-200',
    badge_color: 'bg-teal-100 text-teal-800',
    description: 'الأدوية والمستلزمات الطبية والروشتات مع التوصيل الفوري',
    subcategories: [],
    is_active: true,
    sort_order: 9999,
  },
];

// Helper to create product definition
interface RawProdDef {
  name: string;
  unit: string;
  qty?: string;
}

const rawSupermarketProducts: { subcat: string; prods: RawProdDef[] }[] = [
  {
    subcat: 'sm_dairy_cheese_eggs',
    prods: [
      { name: 'لبن', unit: 'لتر' },
      { name: 'لبن بودرة', unit: 'كيس' },
      { name: 'زبادي', unit: 'علبة' },
      { name: 'لبن رايب', unit: 'زجاجة' },
      { name: 'قشطة', unit: 'علبة' },
      { name: 'كريمة طبخ', unit: 'علبة' },
      { name: 'كريمة خفق', unit: 'علبة' },
      { name: 'جبنة بيضاء', unit: 'علبة' },
      { name: 'جبنة قريش', unit: 'كيلو' },
      { name: 'جبنة دمياطي', unit: 'كيلو' },
      { name: 'جبنة فيتا', unit: 'علبة' },
      { name: 'جبنة رومي', unit: 'طبق' },
      { name: 'جبنة شيدر', unit: 'علبة' },
      { name: 'جبنة موتزاريلا', unit: 'كيس' },
      { name: 'جبنة مثلثات', unit: 'علبة' },
      { name: 'جبنة قابلة للدهن', unit: 'برطمان' },
      { name: 'جبنة تركي', unit: 'طبق' },
      { name: 'جبنة حلوم', unit: 'علبة' },
      { name: 'بيض', unit: 'طبق' },
    ],
  },
  {
    subcat: 'sm_canned_food',
    prods: [
      { name: 'فول مدمس', unit: 'علبة' },
      { name: 'فول بالخلطة', unit: 'علبة' },
      { name: 'فول بالصلصة', unit: 'علبة' },
      { name: 'حمص معلب', unit: 'علبة' },
      { name: 'فاصوليا بيضاء معلبة', unit: 'علبة' },
      { name: 'بسلة معلبة', unit: 'علبة' },
      { name: 'ذرة حلوة', unit: 'علبة' },
      { name: 'مشروم معلب', unit: 'علبة' },
      { name: 'تونة', unit: 'علبة' },
      { name: 'سردين', unit: 'علبة' },
      { name: 'ماكريل', unit: 'علبة' },
      { name: 'أنشوجة', unit: 'علبة' },
      { name: 'طماطم معلبة', unit: 'علبة' },
      { name: 'زيتون أخضر', unit: 'برطمان' },
      { name: 'زيتون أسود', unit: 'برطمان' },
    ],
  },
  {
    subcat: 'sm_legumes_grains',
    prods: [
      { name: 'فول جاف', unit: 'كيلو' },
      { name: 'عدس أصفر', unit: 'كيلو' },
      { name: 'عدس بجبة', unit: 'كيلو' },
      { name: 'حمص جاف', unit: 'كيلو' },
      { name: 'فاصوليا بيضاء', unit: 'كيلو' },
      { name: 'لوبيا', unit: 'كيلو' },
      { name: 'بسلة جافة', unit: 'كيلو' },
      { name: 'ترمس', unit: 'كيلو' },
      { name: 'قمح', unit: 'كيلو' },
      { name: 'فريك', unit: 'كيلو' },
      { name: 'برغل', unit: 'كيلو' },
      { name: 'شعير', unit: 'كيلو' },
      { name: 'ذرة', unit: 'كيلو' },
    ],
  },
  {
    subcat: 'sm_rice_pasta',
    prods: [
      { name: 'أرز مصري', unit: 'كيلو' },
      { name: 'أرز بسمتي', unit: 'كيلو' },
      { name: 'أرز حبة طويلة', unit: 'كيلو' },
      { name: 'مكرونة قلم', unit: 'كيس' },
      { name: 'مكرونة اسباجتي', unit: 'كيس' },
      { name: 'مكرونة خواتم', unit: 'كيس' },
      { name: 'مكرونة لسان عصفور', unit: 'كيس' },
      { name: 'مكرونة شعرية', unit: 'كيس' },
      { name: 'مكرونة حلزونية', unit: 'كيس' },
      { name: 'مكرونة صدف', unit: 'كيس' },
      { name: 'مكرونة لازانيا', unit: 'علبة' },
    ],
  },
  {
    subcat: 'sm_flour_bakery',
    prods: [
      { name: 'دقيق أبيض فاخر', unit: 'كيلو' },
      { name: 'دقيق متعدد الاستخدام', unit: 'كيلو' },
      { name: 'نشا', unit: 'كيس' },
      { name: 'خميرة فورية', unit: 'كيس' },
      { name: 'بيكنج بودر', unit: 'كيس' },
      { name: 'فانيليا', unit: 'كيس' },
      { name: 'عيش بلدي', unit: 'رغيف' },
      { name: 'عيش فينو', unit: 'كيس' },
      { name: 'عيش شامي', unit: 'كيس' },
      { name: 'توست أبيض', unit: 'كيس' },
      { name: 'توست أسمر', unit: 'كيس' },
      { name: 'خبز برجر', unit: 'كيس' },
      { name: 'بقسماط', unit: 'كيس' },
    ],
  },
  {
    subcat: 'sm_oils_ghee',
    prods: [
      { name: 'زيت عباد الشمس', unit: 'زجاجة' },
      { name: 'زيت ذرة', unit: 'زجاجة' },
      { name: 'زيت زيتون', unit: 'زجاجة' },
      { name: 'زيت خليط', unit: 'زجاجة' },
      { name: 'سمن بلدي', unit: 'برطمان' },
      { name: 'سمن نباتي', unit: 'علبة' },
      { name: 'زبدة', unit: 'كيلو' },
    ],
  },
  {
    subcat: 'sm_sugar_sweeteners',
    prods: [
      { name: 'سكر أبيض', unit: 'كيلو' },
      { name: 'سكر بودرة', unit: 'كيس' },
      { name: 'سكر بني', unit: 'كيس' },
      { name: 'سكر دايت', unit: 'علبة' },
      { name: 'عسل أسود', unit: 'برطمان' },
      { name: 'عسل أبيض', unit: 'برطمان' },
      { name: 'دبس التمر', unit: 'برطمان' },
      { name: 'جلوكوز', unit: 'برطمان' },
    ],
  },
  {
    subcat: 'sm_hot_drinks',
    prods: [
      { name: 'شاي أسود', unit: 'علبة' },
      { name: 'شاي أخضر', unit: 'علبة' },
      { name: 'شاي بالنعناع', unit: 'علبة' },
      { name: 'شاي بالليمون', unit: 'علبة' },
      { name: 'شاي أعشاب', unit: 'علبة' },
      { name: 'قهوة سادة', unit: 'كيس' },
      { name: 'قهوة محوجة', unit: 'كيس' },
      { name: 'قهوة تركي', unit: 'كيس' },
      { name: 'قهوة سريعة التحضير', unit: 'برطمان' },
      { name: 'كابتشينو', unit: 'علبة' },
      { name: 'نسكافيه', unit: 'برطمان' },
      { name: 'مشروب 3 في 1', unit: 'علبة' },
      { name: 'كاكاو', unit: 'علبة' },
      { name: 'هوت شوكليت', unit: 'علبة' },
    ],
  },
  {
    subcat: 'sm_beverages',
    prods: [
      { name: 'مياه معدنية', unit: 'زجاجة' },
      { name: 'مشروب كولا', unit: 'زجاجة' },
      { name: 'مشروب برتقال غازي', unit: 'زجاجة' },
      { name: 'مشروب ليمون غازي', unit: 'زجاجة' },
      { name: 'مشروب تفاح غازي', unit: 'زجاجة' },
      { name: 'عصير برتقال', unit: 'علبة' },
      { name: 'عصير مانجو', unit: 'علبة' },
      { name: 'عصير جوافة', unit: 'علبة' },
      { name: 'عصير تفاح', unit: 'علبة' },
      { name: 'عصير فراولة', unit: 'علبة' },
      { name: 'عصير كوكتيل', unit: 'علبة' },
      { name: 'عصير قصب', unit: 'زجاجة' },
      { name: 'عصير بودرة', unit: 'كيس' },
      { name: 'مشروب طاقة', unit: 'علبة' },
    ],
  },
  {
    subcat: 'sm_biscuits_sweets',
    prods: [
      { name: 'بسكويت سادة', unit: 'علبة' },
      { name: 'بسكويت شاي', unit: 'علبة' },
      { name: 'بسكويت ويفر', unit: 'علبة' },
      { name: 'بسكويت شوكولاتة', unit: 'علبة' },
      { name: 'بسكويت بالكريمة', unit: 'علبة' },
      { name: 'بسكويت بالتمر', unit: 'علبة' },
      { name: 'بسكويت محشو', unit: 'علبة' },
      { name: 'بسكويت دايجستيف', unit: 'علبة' },
      { name: 'شوكولاتة بالحليب', unit: 'قطعة' },
      { name: 'شوكولاتة دارك', unit: 'قطعة' },
      { name: 'شوكولاتة بيضاء', unit: 'قطعة' },
      { name: 'شوكولاتة محشوة', unit: 'قطعة' },
      { name: 'بونبوني', unit: 'كيس' },
      { name: 'مصاصات', unit: 'كيس' },
      { name: 'جيلي', unit: 'علبة' },
      { name: 'مارشميلو', unit: 'كيس' },
      { name: 'لبان', unit: 'علبة' },
      { name: 'علكة', unit: 'علبة' },
    ],
  },
  {
    subcat: 'sm_chips_snacks',
    prods: [
      { name: 'شيبسي بطاطس', unit: 'كيس' },
      { name: 'شيبسي جبنة', unit: 'كيس' },
      { name: 'شيبسي كاتشب', unit: 'كيس' },
      { name: 'شيبسي شطة', unit: 'كيس' },
      { name: 'شيبسي خل وملح', unit: 'كيس' },
      { name: 'مقرمشات ذرة', unit: 'كيس' },
      { name: 'فشار', unit: 'كيس' },
      { name: 'سوداني محمص', unit: 'كيس' },
      { name: 'لب أبيض', unit: 'كيس' },
      { name: 'لب سوري', unit: 'كيس' },
      { name: 'مكسرات مشكلة', unit: 'كيس' },
      { name: 'فستق', unit: 'كيس' },
      { name: 'لوز', unit: 'كيس' },
      { name: 'كاجو', unit: 'كيس' },
    ],
  },
  {
    subcat: 'sm_sauces',
    prods: [
      { name: 'كاتشب', unit: 'زجاجة' },
      { name: 'مايونيز', unit: 'برطمان' },
      { name: 'مستردة', unit: 'برطمان' },
      { name: 'صوص باربكيو', unit: 'زجاجة' },
      { name: 'صوص حار', unit: 'زجاجة' },
      { name: 'صوص ثوم', unit: 'برطمان' },
      { name: 'صوص جبنة', unit: 'برطمان' },
      { name: 'صوص رانش', unit: 'زجاجة' },
      { name: 'صوص بيتزا', unit: 'برطمان' },
      { name: 'صوص برجر', unit: 'زجاجة' },
      { name: 'صويا صوص', unit: 'زجاجة' },
    ],
  },
  {
    subcat: 'sm_jams_spreads',
    prods: [
      { name: 'مربى فراولة', unit: 'برطمان' },
      { name: 'مربى مشمش', unit: 'برطمان' },
      { name: 'مربى تين', unit: 'برطمان' },
      { name: 'مربى توت', unit: 'برطمان' },
      { name: 'مربى برتقال', unit: 'برطمان' },
      { name: 'مربى خوخ', unit: 'برطمان' },
      { name: 'مربى مانجا', unit: 'برطمان' },
      { name: 'عسل نحل', unit: 'برطمان' },
      { name: 'طحينة', unit: 'برطمان' },
      { name: 'حلاوة طحينية', unit: 'علبة' },
    ],
  },
  {
    subcat: 'sm_breakfast',
    prods: [
      { name: 'كورن فليكس', unit: 'علبة' },
      { name: 'كورن فليكس شوكولاتة', unit: 'علبة' },
      { name: 'حبوب إفطار بالعسل', unit: 'علبة' },
      { name: 'شوفان سريع التحضير', unit: 'علبة' },
      { name: 'زبدة فول سوداني', unit: 'برطمان' },
      { name: 'كريمة شوكولاتة', unit: 'برطمان' },
    ],
  },
  {
    subcat: 'sm_frozen_food',
    prods: [
      { name: 'بسلة مجمدة', unit: 'كيس' },
      { name: 'بسلة وجزر', unit: 'كيس' },
      { name: 'فاصوليا خضراء مجمدة', unit: 'كيس' },
      { name: 'ملوخية مجمدة', unit: 'كيس' },
      { name: 'سبانخ مجمدة', unit: 'كيس' },
      { name: 'بامية مجمدة', unit: 'كيس' },
      { name: 'خضار مشكل', unit: 'كيس' },
      { name: 'بطاطس مقلية مجمدة', unit: 'كيس' },
      { name: 'بطاطس ودجز', unit: 'كيس' },
      { name: 'برجر لحم مجمد', unit: 'علبة' },
      { name: 'برجر دجاج', unit: 'علبة' },
      { name: 'كفتة مجمدة', unit: 'علبة' },
      { name: 'سجق مجمد', unit: 'علبة' },
      { name: 'شيش طاووق', unit: 'علبة' },
      { name: 'سمك فيليه مجمد', unit: 'كيس' },
      { name: 'جمبري مجمد', unit: 'كيس' },
      { name: 'عجينة بيتزا', unit: 'كيس' },
      { name: 'سمبوسة مجمدة', unit: 'علبة' },
      { name: 'رقاق مجمد', unit: 'علبة' },
      { name: 'جلاش مجمد', unit: 'علبة' },
    ],
  },
  {
    subcat: 'sm_cooking_supplies',
    prods: [
      { name: 'مرقة دجاج', unit: 'علبة' },
      { name: 'مرقة لحم', unit: 'علبة' },
      { name: 'شوربة سريعة التحضير', unit: 'كيس' },
      { name: 'خلطة بشاميل', unit: 'كيس' },
      { name: 'خلطة كيك', unit: 'علبة' },
      { name: 'خليط بان كيك', unit: 'علبة' },
      { name: 'كريم شانتيه', unit: 'كيس' },
      { name: 'جوز هند', unit: 'كيس' },
      { name: 'كاكاو خام', unit: 'كيس' },
      { name: 'جيلاتين', unit: 'كيس' },
      { name: 'ألوان طعام', unit: 'زجاجة' },
    ],
  },
  {
    subcat: 'sm_baby_food',
    prods: [
      { name: 'لبن أطفال', unit: 'علبة' },
      { name: 'حبوب أطفال بالأرز', unit: 'علبة' },
      { name: 'حبوب أطفال بالقمح', unit: 'علبة' },
      { name: 'وجبات أطفال جاهزة', unit: 'برطمان' },
      { name: 'فواكه مهروسة للأطفال', unit: 'برطمان' },
      { name: 'خضروات مهروسة للأطفال', unit: 'برطمان' },
      { name: 'بسكويت أطفال', unit: 'علبة' },
    ],
  },
];

const rawVegetableFruitProducts: { subcat: string; prods: RawProdDef[] }[] = [
  {
    subcat: 'vf_leafy_greens',
    prods: [
      { name: 'ملوخية', unit: 'كيلو' },
      { name: 'سبانخ', unit: 'كيلو' },
      { name: 'جرجير', unit: 'وحدة' },
      { name: 'بقدونس', unit: 'وحدة' },
      { name: 'كزبرة خضراء', unit: 'وحدة' },
      { name: 'شبت', unit: 'وحدة' },
      { name: 'نعناع أخضر', unit: 'وحدة' },
      { name: 'خس', unit: 'وحدة' },
      { name: 'كرنب', unit: 'وحدة' },
      { name: 'ورق عنب', unit: 'كيلو' },
      { name: 'سلق', unit: 'وحدة' },
    ],
  },
  {
    subcat: 'vf_basic_veg',
    prods: [
      { name: 'طماطم', unit: 'كيلو' },
      { name: 'بطاطس', unit: 'كيلو' },
      { name: 'بصل', unit: 'كيلو' },
      { name: 'ثوم', unit: 'كيلو' },
      { name: 'خيار', unit: 'كيلو' },
      { name: 'جزر', unit: 'كيلو' },
      { name: 'كوسة', unit: 'كيلو' },
      { name: 'باذنجان', unit: 'كيلو' },
      { name: 'فلفل', unit: 'كيلو' },
      { name: 'ليمون', unit: 'كيلو' },
    ],
  },
  {
    subcat: 'vf_other_veg',
    prods: [
      { name: 'فاصوليا خضراء', unit: 'كيلو' },
      { name: 'بسلة', unit: 'كيلو' },
      { name: 'بامية', unit: 'كيلو' },
      { name: 'قرنبيط', unit: 'وحدة' },
      { name: 'بروكلي', unit: 'وحدة' },
      { name: 'كرفس', unit: 'وحدة' },
      { name: 'كراث', unit: 'وحدة' },
      { name: 'خرشوف', unit: 'كيلو' },
      { name: 'قلقاس', unit: 'كيلو' },
      { name: 'فجل', unit: 'وحدة' },
      { name: 'بنجر', unit: 'كيلو' },
      { name: 'لفت', unit: 'كيلو' },
      { name: 'ذرة طازجة', unit: 'قطعة' },
      { name: 'مشروم طازج', unit: 'طبق' },
      { name: 'كرنب أحمر', unit: 'وحدة' },
      { name: 'كرنب بروكسل', unit: 'كيلو' },
    ],
  },
  {
    subcat: 'vf_citrus',
    prods: [
      { name: 'برتقال', unit: 'كيلو' },
      { name: 'يوسفي', unit: 'كيلو' },
      { name: 'كلمنتينا', unit: 'كيلو' },
      { name: 'جريب فروت', unit: 'كيلو' },
      { name: 'ليمون أضاليا', unit: 'كيلو' },
    ],
  },
  {
    subcat: 'vf_local_fruits',
    prods: [
      { name: 'تفاح', unit: 'كيلو' },
      { name: 'موز', unit: 'كيلو' },
      { name: 'جوافة', unit: 'كيلو' },
      { name: 'مانجا', unit: 'كيلو' },
      { name: 'رمان', unit: 'كيلو' },
      { name: 'تين', unit: 'كيلو' },
      { name: 'خوخ', unit: 'كيلو' },
      { name: 'مشمش', unit: 'كيلو' },
      { name: 'برقوق', unit: 'كيلو' },
      { name: 'كمثرى', unit: 'كيلو' },
      { name: 'بطيخ', unit: 'وحدة' },
      { name: 'شمام', unit: 'وحدة' },
      { name: 'فراولة', unit: 'كيلو' },
      { name: 'عنب', unit: 'كيلو' },
    ],
  },
  {
    subcat: 'vf_imported_fruits',
    prods: [
      { name: 'كيوي', unit: 'كيلو' },
      { name: 'أناناس', unit: 'وحدة' },
      { name: 'أفوكادو', unit: 'كيلو' },
      { name: 'جوز هند', unit: 'وحدة' },
    ],
  },
];

const rawMeatPoultryProducts: { subcat: string; prods: RawProdDef[] }[] = [
  {
    subcat: 'meat_red',
    prods: [
      { name: 'لحم بقري', unit: 'كيلو' },
      { name: 'لحم جاموسي', unit: 'كيلو' },
      { name: 'لحم ضاني', unit: 'كيلو' },
      { name: 'لحم ماعز', unit: 'كيلو' },
      { name: 'لحم مفروم', unit: 'كيلو' },
      { name: 'كبدة', unit: 'كيلو' },
      { name: 'لحمة رأس', unit: 'كيلو' },
      { name: 'موزة', unit: 'كيلو' },
      { name: 'ريش', unit: 'كيلو' },
    ],
  },
  {
    subcat: 'meat_poultry_birds',
    prods: [
      { name: 'دجاج', unit: 'كيلو' },
      { name: 'دجاجة كاملة', unit: 'وحدة' },
      { name: 'صدور دجاج', unit: 'كيلو' },
      { name: 'أوراك دجاج', unit: 'كيلو' },
      { name: 'أجنحة دجاج', unit: 'كيلو' },
      { name: 'دبوس دجاج', unit: 'كيلو' },
      { name: 'كبد وقوانص دجاج', unit: 'كيلو' },
      { name: 'كبدة دجاج', unit: 'كيلو' },
      { name: 'قوانص دجاج', unit: 'كيلو' },
      { name: 'حمام', unit: 'زوج' },
      { name: 'بط', unit: 'وحدة' },
      { name: 'أرانب', unit: 'وحدة' },
      { name: 'ديك رومي', unit: 'وحدة' },
      { name: 'سمان', unit: 'زوج' },
      { name: 'وز', unit: 'وحدة' },
    ],
  },
  {
    subcat: 'meat_seafood',
    prods: [
      { name: 'سمك بلطي', unit: 'كيلو' },
      { name: 'سمك بوري', unit: 'كيلو' },
      { name: 'سمك قاروص', unit: 'كيلو' },
      { name: 'سمك دنيس', unit: 'كيلو' },
      { name: 'سمك موسى', unit: 'كيلو' },
      { name: 'سمك مكرونة', unit: 'كيلو' },
      { name: 'سردين', unit: 'كيلو' },
      { name: 'ماكريل', unit: 'كيلو' },
      { name: 'بطارخ', unit: 'كيلو' },
      { name: 'فيليه سمك', unit: 'كيلو' },
      { name: 'جمبري', unit: 'كيلو' },
      { name: 'كاليماري', unit: 'كيلو' },
      { name: 'سبيط', unit: 'كيلو' },
      { name: 'كابوريا', unit: 'كيلو' },
      { name: 'بلح البحر', unit: 'كيلو' },
    ],
  },
  {
    subcat: 'meat_ready',
    prods: [
      { name: 'برجر لحم', unit: 'طبق' },
      { name: 'كفتة', unit: 'طبق' },
      { name: 'سجق', unit: 'كيلو' },
      { name: 'بسطرمة', unit: 'طبق' },
      { name: 'لانشون', unit: 'طبق' },
      { name: 'هوت دوج', unit: 'عبوة' },
      { name: 'شاورما لحم', unit: 'طبق' },
      { name: 'شاورما دجاج', unit: 'طبق' },
      { name: 'بانيه دجاج', unit: 'طبق' },
      { name: 'ناجتس دجاج', unit: 'علبة' },
    ],
  },
];

const rawSpicesProducts: { subcat: string; prods: RawProdDef[] }[] = [
  {
    subcat: 'spices_seasoning',
    prods: [
      { name: 'ملح', unit: 'كيس' },
      { name: 'فلفل أسود', unit: 'جرام' },
      { name: 'كمون', unit: 'جرام' },
      { name: 'كزبرة ناشفة', unit: 'جرام' },
      { name: 'شطة', unit: 'جرام' },
      { name: 'بابريكا', unit: 'جرام' },
      { name: 'كركم', unit: 'جرام' },
      { name: 'قرفة', unit: 'جرام' },
      { name: 'زنجبيل', unit: 'جرام' },
      { name: 'بهارات مشكلة', unit: 'جرام' },
      { name: 'بهارات لحمة', unit: 'جرام' },
      { name: 'بهارات فراخ', unit: 'جرام' },
      { name: 'بهارات سمك', unit: 'جرام' },
      { name: 'حبهان', unit: 'جرام' },
      { name: 'قرنفل', unit: 'جرام' },
      { name: 'ورق لورا', unit: 'كيس' },
      { name: 'جوزة الطيب', unit: 'قطعة' },
    ],
  },
  {
    subcat: 'spices_herbs_drinks',
    prods: [
      { name: 'ينسون', unit: 'جرام' },
      { name: 'نعناع مجفف', unit: 'كيس' },
      { name: 'كركديه', unit: 'جرام' },
      { name: 'شمر', unit: 'جرام' },
      { name: 'حلبة', unit: 'جرام' },
      { name: 'بردقوش', unit: 'جرام' },
      { name: 'زعتر', unit: 'جرام' },
      { name: 'روزماري', unit: 'جرام' },
      { name: 'مرمرية', unit: 'جرام' },
      { name: 'سحلب', unit: 'كيس' },
      { name: 'تمر هندي', unit: 'لفة' },
      { name: 'عرق سوس', unit: 'كيس' },
    ],
  },
  {
    subcat: 'spices_seeds',
    prods: [
      { name: 'سمسم', unit: 'جرام' },
      { name: 'حبة البركة', unit: 'جرام' },
      { name: 'بذور الكتان', unit: 'جرام' },
    ],
  },
];

const rawHomeProducts: { subcat: string; prods: RawProdDef[] }[] = [
  {
    subcat: 'home_cleaning_tools',
    prods: [
      { name: 'إسفنجة مواعين', unit: 'قطعة' },
      { name: 'سلك مواعين', unit: 'لفة' },
      { name: 'مكنسة', unit: 'قطعة' },
      { name: 'مقشة', unit: 'قطعة' },
      { name: 'ممسحة', unit: 'قطعة' },
      { name: 'جردل', unit: 'قطعة' },
      { name: 'فوط تنظيف', unit: 'عبوة' },
      { name: 'مشابك غسيل', unit: 'كيس' },
    ],
  },
  {
    subcat: 'home_trash_storage',
    prods: [
      { name: 'أكياس قمامة', unit: 'لفة' },
      { name: 'أكياس تخزين', unit: 'علبة' },
      { name: 'ورق ألومنيوم', unit: 'لفة' },
      { name: 'استرتش غذائي', unit: 'لفة' },
    ],
  },
  {
    subcat: 'home_paper_products',
    prods: [
      { name: 'مناديل ورقية', unit: 'علبة' },
      { name: 'مناديل مطبخ', unit: 'لفة' },
      { name: 'ورق تواليت', unit: 'لفة' },
      { name: 'مناديل مبللة', unit: 'عبوة' },
    ],
  },
];

const rawCleaningProducts: { subcat: string; prods: RawProdDef[] }[] = [
  {
    subcat: 'clean_laundry',
    prods: [
      { name: 'مسحوق غسيل', unit: 'كيس' },
      { name: 'سائل غسيل', unit: 'زجاجة' },
      { name: 'منعم أقمشة', unit: 'زجاجة' },
      { name: 'مبيض ملابس', unit: 'زجاجة' },
      { name: 'مزيل بقع', unit: 'زجاجة' },
    ],
  },
  {
    subcat: 'clean_home',
    prods: [
      { name: 'سائل مواعين', unit: 'زجاجة' },
      { name: 'منظف أرضيات', unit: 'زجاجة' },
      { name: 'منظف زجاج', unit: 'زجاجة' },
      { name: 'منظف متعدد الاستخدام', unit: 'زجاجة' },
      { name: 'مطهر', unit: 'زجاجة' },
      { name: 'كلور', unit: 'زجاجة' },
    ],
  },
];

// Build deterministic, static products array with sequential safe IDs
const buildCatalog = (): GlobalProduct[] => {
  const result: GlobalProduct[] = [];

  const addGroup = (
    catId: string,
    prefix: string,
    groups: { subcat: string; prods: RawProdDef[] }[]
  ) => {
    let counter = 1;
    groups.forEach((g) => {
      g.prods.forEach((p) => {
        const idNumber = String(counter).padStart(3, '0');
        result.push({
          id: `gp_${prefix}_${idNumber}`,
          global_category_id: catId,
          subcategory_id: g.subcat,
          name_ar: p.name,
          name_en: null,
          image_url: null,
          default_quantity: p.qty || '١',
          default_unit: p.unit,
          estimated_price: 0,
          is_active: true,
          sort_order: counter,
        });
        counter++;
      });
    });
  };

  addGroup('supermarket', 'sm', rawSupermarketProducts);
  addGroup('vegetables_fruits', 'vf', rawVegetableFruitProducts);
  addGroup('meat_poultry', 'meat', rawMeatPoultryProducts);
  addGroup('spices', 'spices', rawSpicesProducts);
  addGroup('home_essentials', 'home', rawHomeProducts);
  addGroup('cleaning', 'clean', rawCleaningProducts);

  return result;
};

export const CENTRAL_PRODUCTS: GlobalProduct[] = buildCatalog();

// Populate items array in CENTRAL_CATEGORIES subcategories for compatibility
CENTRAL_CATEGORIES.forEach((cat) => {
  const catProds = CENTRAL_PRODUCTS.filter((p) => p.global_category_id === cat.id);
  cat.subcategories?.forEach((sub) => {
    sub.items = catProds
      .filter((p) => p.subcategory_id === sub.id)
      .map((p) => p.name_ar);
  });
});

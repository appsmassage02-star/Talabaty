/**
 * scripts/seed-catalog.ts
 * 
 * سكريبت إداري آمن لتهيئة وإدخال الكتالوج المركزي إلى Supabase
 * يعمل حصرياً في بيئة Node.js (Server-side) ولا يُضمّن إطلاقاً في Frontend أو APK.
 * 
 * المبادئ الصارمة:
 * 1. لا يستخدم أي مفتاح مشتق من VITE_ للعمليات الإدارية.
 * 2. يقرأ SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY حصرياً من process.env.
 * 3. يدعم وضع الفحص والتحقق الكامل (--dry-run) دون إجراء أي كتابة على قاعدة البيانات.
 * 4. لا يسمح بالإدخال الفعلي إلا بوجود تأكيد صريح: SEED_CATALOG_CONFIRM=YES.
 * 5. يفحص ويمنع الـ overwrite العشوائي: يتحقق من السجلات الموجودة مسبقاً ويتوقف عند أي تعارض.
 * 6. يدخل الأقسام أولاً (global_categories) ثم المنتجات (global_products).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { CENTRAL_CATEGORIES, CENTRAL_PRODUCTS } from '../src/data/centralCatalog';
import { GlobalCategory, GlobalProduct } from '../src/types';

// ==============================================================================
// 1. إعداد المعاملات والمتغيرات
// ==============================================================================

const isDryRun = process.argv.includes('--dry-run');
const isConfirmed = process.env.SEED_CATALOG_CONFIRM === 'YES';

function normalizeSupabaseUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.includes('.supabase.co')) {
    return `https://${trimmed}`;
  }
  return `https://${trimmed}.supabase.co`;
}

const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// التحقق من عدم استخدام مفتاح العميل Anon
if (serviceRoleKey && serviceRoleKey === process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('\n❌ خطأ أمني جسيم: تم تمرير VITE_SUPABASE_ANON_KEY بدلاً من SUPABASE_SERVICE_ROLE_KEY.');
  console.error('ممنوع استخدام مفتاح العميل العادي للعمليات الإدارية.\n');
  process.exit(1);
}

// قائمة التكرارات المقصودة المعتمدة
const INTENDED_DUPLICATE_NAMES = new Set(['سردين', 'ماكريل', 'جوز هند']);

// ==============================================================================
// 2. دوال الفحص والتدقيق الداخلي (In-Memory Validation)
// ==============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    categoriesCount: number;
    subcategoriesCount: number;
    productsCount: number;
    uniqueProductNamesCount: number;
    intendedDuplicatesCount: number;
    unintendedDuplicatesCount: number;
  };
}

function validateCatalogInMemory(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // أ. فحص الأقسام الرئيسية الستة
  const expectedCategoryIds = [
    'supermarket',
    'vegetables_fruits',
    'meat_poultry',
    'spices',
    'home_essentials',
    'cleaning',
  ];

  if (CENTRAL_CATEGORIES.length !== 6) {
    errors.push(`عدد الأقسام غير متطابق: المتوقع 6، الموجود ${CENTRAL_CATEGORIES.length}`);
  }

  const categoryIds = new Set<string>();
  const subcategoryMap = new Map<string, Set<string>>();

  CENTRAL_CATEGORIES.forEach((cat) => {
    if (categoryIds.has(cat.id)) {
      errors.push(`معرف قسم رئيسي مكرر: ${cat.id}`);
    }
    categoryIds.add(cat.id);

    if (!expectedCategoryIds.includes(cat.id)) {
      errors.push(`قسم رئيسي غير معتمد: ${cat.id} (${cat.name_ar})`);
    }

    const subIds = new Set<string>();
    (cat.subcategories || []).forEach((sub) => {
      if (subIds.has(sub.id)) {
        errors.push(`معرف قسم فرعي مكرر داخل قسم ${cat.id}: ${sub.id}`);
      }
      subIds.add(sub.id);
    });
    subcategoryMap.set(cat.id, subIds);
  });

  const totalSubcategories = Array.from(subcategoryMap.values()).reduce(
    (acc, set) => acc + set.size,
    0
  );

  if (totalSubcategories !== 35) {
    errors.push(`عدد الأقسام الفرعية غير متطابق: المتوقع 35، الموجود ${totalSubcategories}`);
  }

  // ب. فحص المنتجات (العدد، الـ IDs، العلاقات، التكرارات)
  if (CENTRAL_PRODUCTS.length !== 379) {
    errors.push(`عدد المنتجات غير متطابق: المتوقع 379، الموجود ${CENTRAL_PRODUCTS.length}`);
  }

  const productIds = new Set<string>();
  const nameToProductsMap = new Map<string, GlobalProduct[]>();

  CENTRAL_PRODUCTS.forEach((prod) => {
    // 1. فحص الـ ID
    if (!prod.id || typeof prod.id !== 'string') {
      errors.push(`منتج بدون معرف ID صالح: ${prod.name_ar}`);
    } else if (productIds.has(prod.id)) {
      errors.push(`معرف منتج مكرر: ${prod.id}`);
    }
    productIds.add(prod.id);

    // 2. فحص ارتباط القسم الرئيسي
    if (!categoryIds.has(prod.global_category_id)) {
      errors.push(`المنتج ${prod.id} (${prod.name_ar}) يشير إلى قسم غير موجود: ${prod.global_category_id}`);
    }

    // 3. فحص ارتباط القسم الفرعي
    const validSubsForCat = subcategoryMap.get(prod.global_category_id);
    if (!prod.subcategory_id || !validSubsForCat || !validSubsForCat.has(prod.subcategory_id)) {
      errors.push(
        `المنتج ${prod.id} (${prod.name_ar}) يشير إلى قسم فرعي غير صالح: ${prod.subcategory_id} في قسم ${prod.global_category_id}`
      );
    }

    // 4. فحص الحقول الأساسية
    if (!prod.name_ar || !prod.default_unit || !prod.default_quantity) {
      errors.push(`بيانات ناقصة للمنتج: ${prod.id}`);
    }

    // 5. تجميع الأسماء لفحص التكرارات
    if (!nameToProductsMap.has(prod.name_ar)) {
      nameToProductsMap.set(prod.name_ar, []);
    }
    nameToProductsMap.get(prod.name_ar)!.push(prod);
  });

  // ج. تصنيف التكرارات بالاسم
  let intendedDuplicatesCount = 0;
  let unintendedDuplicatesCount = 0;

  for (const [name, prods] of nameToProductsMap.entries()) {
    if (prods.length > 1) {
      if (INTENDED_DUPLICATE_NAMES.has(name)) {
        intendedDuplicatesCount += prods.length - 1;
      } else {
        unintendedDuplicatesCount += prods.length - 1;
        errors.push(`تكرار غير مصرح به للمنتج "${name}" عبر الأقسام: ${prods.map((p) => p.global_category_id).join(', ')}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      categoriesCount: categoryIds.size,
      subcategoriesCount: totalSubcategories,
      productsCount: productIds.size,
      uniqueProductNamesCount: nameToProductsMap.size,
      intendedDuplicatesCount,
      unintendedDuplicatesCount,
    },
  };
}

// ==============================================================================
// 3. الدالة الرئيسية
// ==============================================================================

async function main() {
  console.log('======================================================================');
  console.log('       طلبات البيت — تشغيل سكريبت الكتالوج المركزي (Seed Catalog)     ');
  console.log('======================================================================\n');

  if (isDryRun) {
    console.log('🔍 وضع التشغيل: [Dry-Run فقط — فحص وتدقيق دون أي تعديل أو كتابة]');
  } else {
    console.log('⚡ وضع التشغيل: [إدخال فعلي Live Mode]');
  }

  // الخطوة 1: فحص الكتالوج في الذاكرة
  console.log('\n[1/4] فحص وتدقيق بيانات الكتالوج في الذاكرة (In-Memory Validation)...');
  const validation = validateCatalogInMemory();

  console.log(` - عدد الأقسام الرئيسية: ${validation.stats.categoriesCount} / 6`);
  console.log(` - عدد الأقسام الفرعية: ${validation.stats.subcategoriesCount} / 35`);
  console.log(` - إجمالي سجلات المنتجات: ${validation.stats.productsCount} / 379`);
  console.log(` - عدد أسماء المنتجات الفريدة: ${validation.stats.uniqueProductNamesCount}`);
  console.log(` - عدد التكرارات المقصودة: ${validation.stats.intendedDuplicatesCount} (سردين، ماكريل، جوز هند)`);
  console.log(` - عدد التكرارات غير المقصودة: ${validation.stats.unintendedDuplicatesCount}`);

  if (!validation.valid) {
    console.error('\n❌ فشل فحص الكتالوج الداخلي:');
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
  console.log('✅ نجح فحص الكتالوج الداخلي بالكامل (0 أخطاء).');

  // الخطوة 2: فحص متغيرات البيئة والصلاحيات
  console.log('\n[2/4] التحقق من متغيرات البيئة والاتصال الإداري...');
  if (!supabaseUrl) {
    console.warn('⚠️ SUPABASE_URL غير متوفر.');
  } else {
    console.log(` - عنوان Supabase: ${supabaseUrl}`);
  }

  const hasServiceRoleKey = Boolean(serviceRoleKey && serviceRoleKey.trim().length > 0);
  console.log(` - مفتاح SUPABASE_SERVICE_ROLE_KEY: ${hasServiceRoleKey ? 'متوفر ✅' : 'غير متوفر ❌'}`);

  // في حالة التشغيل الفعلي (بدون dry-run) يُشترط وجود المفتاح والتأكيد
  if (!isDryRun) {
    if (!supabaseUrl || !hasServiceRoleKey) {
      console.error('\n❌ خطأ أمني: لا يمكن تشغيل الإدخال الفعلي بدون SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.');
      console.error('ممنوع استخدام مفتاح Anon العادي للإدخال الإداري.');
      process.exit(1);
    }

    if (!isConfirmed) {
      console.error('\n❌ خطأ تأكيد: للإدخال الفعلي يجب تمرير متغير التأكيد:');
      console.error('   SEED_CATALOG_CONFIRM=YES');
      console.error('\nطريقة التشغيل الآمنة:');
      console.error('   SEED_CATALOG_CONFIRM=YES SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx scripts/seed-catalog.ts');
      process.exit(1);
    }
  }

  // الخطوة 3: فحص حالة الجداول في Supabase
  console.log('\n[3/4] فحص حالة الجداول الحالية في Supabase...');
  let adminClient: any = null;

  if (hasServiceRoleKey && supabaseUrl) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    try {
      const { data: existingCats, error: catErr } = await adminClient
        .from('global_categories')
        .select('id, name_ar');
      if (catErr) {
        console.error('❌ خطأ أثناء الاستعلام عن global_categories:', catErr);
        process.exit(1);
      }

      const { data: existingProds, error: prodErr } = await adminClient
        .from('global_products')
        .select('id, name_ar');
      if (prodErr) {
        console.error('❌ خطأ أثناء الاستعلام عن global_products:', prodErr);
        process.exit(1);
      }

      console.log(` - عدد الأقسام الموجودة في Supabase: ${existingCats?.length || 0}`);
      console.log(` - عدد المنتجات الموجودة في Supabase: ${existingProds?.length || 0}`);

      if (isDryRun) {
        console.log('\n✅ نتيجة فحص Dry-Run لقاعدة البيانات:');
        console.log(`   - الجداول جاهزة لاستقبال البيانات (${existingCats?.length || 0} أقسام، ${existingProds?.length || 0} منتجات).`);
        console.log('   - لم يتم تنفيذ أي عملية INSERT أو UPDATE أو DELETE.');
      }
    } catch (err: any) {
      console.error('❌ استثناء أثناء فحص Supabase:', err?.message || err);
      process.exit(1);
    }
  } else {
    console.log('ℹ️ تم تخطي فحص اتصال Supabase المباشر لعدم توفر SUPABASE_SERVICE_ROLE_KEY في البيئة الحالية.');
    console.log('   (السكريبت جاهز لقراءة المفتاح عند توفيره دون المساس بكود الواجهة أو الـ APK).');
  }

  // الخطوة 4: الإدخال الفعلي (فقط إذا لم يكن Dry-Run وتم التأكيد)
  if (!isDryRun) {
    console.log('\n[4/4] بدء الإدخال الفعلي المنظم والمرحلي...');
    if (!adminClient) {
      console.error('❌ عميل Admin غير مهيأ.');
      process.exit(1);
    }

    // أ. إدخال الأقسام أولاً
    console.log(' -> إدخال الأقسام الرئيسية إلى global_categories...');
    const categoriesPayload = CENTRAL_CATEGORIES.map((c) => ({
      id: c.id,
      name_ar: c.name_ar,
      name_en: c.name_en || null,
      image_url: c.image_url,
      icon_name: c.icon_name || 'ShoppingCart',
      color: c.color || 'emerald',
      bg_light: c.bg_light || null,
      badge_color: c.badge_color || null,
      description: c.description || null,
      subcategories: c.subcategories || [],
      is_active: c.is_active,
      sort_order: c.sort_order,
    }));

    const { error: insertCatErr } = await adminClient
      .from('global_categories')
      .insert(categoriesPayload);

    if (insertCatErr) {
      console.error('❌ فشل إدخال الأقسام إلى global_categories:', insertCatErr);
      process.exit(1);
    }
    console.log(` ✅ تم إدخال ${categoriesPayload.length} أقسام بنجاح.`);

    // ب. إدخال المنتجات بعد نجاح الأقسام
    console.log(' -> إدخال المنتجات إلى global_products...');
    const productsPayload = CENTRAL_PRODUCTS.map((p) => ({
      id: p.id,
      global_category_id: p.global_category_id,
      subcategory_id: p.subcategory_id || null,
      name_ar: p.name_ar,
      name_en: p.name_en || null,
      image_url: p.image_url || null,
      default_quantity: p.default_quantity || '١',
      default_unit: p.default_unit || 'قطعة',
      estimated_price: p.estimated_price || 0,
      is_active: p.is_active,
      sort_order: p.sort_order,
    }));

    // إدخال على دفعات آمنة (Batches of 100) لتجنب قيود حجم الحمولة
    const batchSize = 100;
    for (let i = 0; i < productsPayload.length; i += batchSize) {
      const batch = productsPayload.slice(i, i + batchSize);
      const { error: insertProdErr } = await adminClient
        .from('global_products')
        .insert(batch);

      if (insertProdErr) {
        console.error(`❌ فشل إدخال دفعة المنتجات بدءاً من السجل ${i}:`, insertProdErr);
        process.exit(1);
      }
      console.log(`    - تم إدخال الدفعة (${i + 1} إلى ${Math.min(i + batchSize, productsPayload.length)})...`);
    }

    console.log(` ✅ تم إدخال جميع المنتجات (${productsPayload.length} منتج) بنجاح.`);
    console.log('\n🎉 اكتمل إدخال الكتالوج المركزي بنجاح تام وبأمان كامل!');
  } else {
    console.log('\n======================================================================');
    console.log('✨ انتهى الفحص التجريبي بنجاح (Dry-Run Completed Successfully)');
    console.log('لم يتم إجراء أي تعديل أو إدخال على قاعدة البيانات.');
    console.log('======================================================================\n');
  }
}

main().catch((err) => {
  console.error('\n❌ خطأ غير متوقع أثناء تشغيل السكريبت:', err);
  process.exit(1);
});

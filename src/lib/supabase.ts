/// <reference types="vite/client" />
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Read Supabase environment variables safely
const rawSupabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  (typeof process !== "undefined" ? process.env?.VITE_SUPABASE_URL : "") ||
  "";
const rawSupabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== "undefined" ? process.env?.VITE_SUPABASE_ANON_KEY : "") ||
  "";

export const normalizeSupabaseUrl = (url: string): string => {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.includes(".supabase.co")) {
    return `https://${trimmed}`;
  }
  return `https://${trimmed}.supabase.co`;
};

export const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
export const supabaseAnonKey = rawSupabaseAnonKey.trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl !== "YOUR_SUPABASE_URL" &&
      supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY" &&
      typeof supabaseUrl === "string" &&
      supabaseUrl.startsWith("http")
  );
};

// Initialize Supabase Client with persistent authentication and PKCE
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;

export interface DbResult<T = any> {
  success: boolean;
  data?: T;
  error?: string | null;
  status?: number;
}

/**
 * Converts a raw username to a valid internal email address (username@talbat.com).
 * Home phone users only interact with Username + Password, while Supabase Auth
 * uses this internal email format seamlessly.
 */
export const usernameToEmail = (rawUsername: string): string => {
  const trimmed = (rawUsername || "").trim().toLowerCase();
  const withoutDomain = trimmed.replace(/@.*$/, "");
  const clean = withoutDomain.replace(/\s+/g, "_");

  // Pure alphanumeric with standard punctuation
  if (/^[a-z0-9_.-]+$/i.test(clean) && clean.length > 0) {
    return `${clean}@talbat.com`;
  }

  // Safe ASCII hexadecimal encoding for Unicode/Arabic characters
  const hex = Array.from(new TextEncoder().encode(clean || "home"))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `u_${hex.slice(0, 30)}@talbat.com`;
};

/**
 * Generates secure, internal credentials for Home Phone pairing without exposing emails.
 * Requirement 3: Internal identity (e.g. username@talbat.com) without showing email to user.
 */
export const generateInternalHomePhoneCredentials = () => {
  const randomBytes = new Uint8Array(6);
  crypto.getRandomValues(randomBytes);
  const entropy = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const username = `hp_${entropy}`;
  const email = `${username}@talbat.com`;
  const passBytes = new Uint8Array(16);
  crypto.getRandomValues(passBytes);
  const password = Array.from(passBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { username, email, password };
};

/**
 * Reconciles an existing/legacy user with household_members and profiles.
 * Idempotent: checks for existence before inserting, preventing duplicates
 * and never guessing or overwriting valid existing household IDs.
 */
export const reconcileLegacyUserMembership = async (
  userId: string,
  targetHouseholdId: string,
  role = "household_member",
  userName = "عضو المنزل",
  userPhone = ""
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase) return { success: false, error: "قاعدة البيانات غير مهيأة" };
  if (!userId || !targetHouseholdId) {
    return { success: false, error: "معرف المستخدم والمنزل مطلوبان" };
  }

  try {
    // 1. Check if membership already exists in household_members
    const { data: existing, error: qErr } = await supabase
      .from("household_members")
      .select("id, role, household_id")
      .eq("household_id", targetHouseholdId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing && !qErr) {
      console.log(`[Reconciliation] Backfilling missing household_members record for user ${userId} in household ${targetHouseholdId} with role ${role}`);
      const { error: insErr } = await supabase.from("household_members").upsert(
        {
          household_id: targetHouseholdId,
          user_id: userId,
          role: role,
          user_name: userName,
          user_phone: userPhone,
          joined_at: new Date().toISOString(),
        },
        { onConflict: "household_id,user_id" }
      );
      if (insErr) {
        console.warn("[Reconciliation] Could not insert household_members record:", insErr);
        return { success: false, error: insErr.message };
      }
    }

    // 2. Ensure profile exists and points to this household
    await supabase.from("profiles").upsert(
      {
        id: userId,
        household_id: targetHouseholdId,
        role: role,
        full_name: userName,
        phone: userPhone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    return { success: true };
  } catch (err: any) {
    console.error("[Reconciliation] Error in reconcileLegacyUserMembership:", err);
    return { success: false, error: err?.message };
  }
};

/**
 * Authoritatively and idempotently ensures all 5 required entities exist and are linked:
 * 1. profiles
 * 2. households
 * 3. household_members
 * 4. household_permissions
 * 5. household_budgets
 *
 * If a household already exists, it is reused and missing entities/fields are completed.
 * Fails safely with a clear error if essential record creation fails.
 */
export const ensureAdminHouseholdAndProvisioning = async (params: {
  userId: string;
  userEmail?: string;
  fullName: string;
  phone?: string;
  householdName?: string;
  seedCategories?: any[];
}): Promise<{
  success: boolean;
  householdId?: string;
  household?: any;
  error?: string;
}> => {
  if (!supabase) {
    return { success: false, error: "الاتصال بقاعدة البيانات غير متوفر" };
  }

  const { userId, userEmail, fullName, phone = "", householdName = "منزل العائلة", seedCategories } = params;

  if (!userId) {
    return { success: false, error: "معرف المستخدم مطلوب لتأكيد بيانات المنزل" };
  }

  try {
    let targetHousehold: any = null;

    // 1. Check if an existing household already belongs to this admin
    const { data: adminHh, error: adminHhErr } = await supabase
      .from("households")
      .select("*")
      .eq("admin_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!adminHhErr && adminHh) {
      targetHousehold = adminHh;
    }

    // 2. If not found by admin_id, check household_members table
    if (!targetHousehold) {
      const { data: memberRow } = await supabase
        .from("household_members")
        .select("household_id, role, households(*)")
        .eq("user_id", userId)
        .maybeSingle();

      if (memberRow?.households) {
        targetHousehold = memberRow.households;
      } else if (memberRow?.household_id) {
        const { data: hhById } = await supabase
          .from("households")
          .select("*")
          .eq("id", memberRow.household_id)
          .maybeSingle();
        if (hhById) targetHousehold = hhById;
      }
    }

    // 3. If still not found, check profiles table
    if (!targetHousehold) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("household_id")
        .eq("id", userId)
        .maybeSingle();

      if (profileRow?.household_id) {
        const { data: hhByProf } = await supabase
          .from("households")
          .select("*")
          .eq("id", profileRow.household_id)
          .maybeSingle();
        if (hhByProf) targetHousehold = hhByProf;
      }
    }

    // 4. If no household exists at all, safely create it
    if (!targetHousehold) {
      const newHouseholdId = `hh_${userId.replace(/-/g, "").substring(0, 16)}`;
      const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map((b) => (b % 36).toString(36).toUpperCase())
        .join("");
      const newPairCode = `BAYT-${randomPart}`;

      const { data: createdHh, error: createHhErr } = await supabase
        .from("households")
        .upsert(
          {
            id: newHouseholdId,
            name: householdName || "منزل العائلة",
            admin_id: userId,
            admin_name: fullName || "المسؤول",
            admin_phone: phone || "",
            pair_code: newPairCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select()
        .single();

      if (createHhErr) {
        console.error("[Provisioning] Failed to create household:", createHhErr);
        return {
          success: false,
          error: `فشل إنشاء سجل المنزل في قاعدة البيانات: ${createHhErr.message}`,
        };
      }
      targetHousehold = createdHh;
    } else {
      // Existing household: update missing details if needed
      if (!targetHousehold.admin_name || !targetHousehold.admin_phone) {
        await supabase
          .from("households")
          .update({
            admin_name: targetHousehold.admin_name || fullName,
            admin_phone: targetHousehold.admin_phone || phone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetHousehold.id);
      }
    }

    const householdId = targetHousehold.id;

    // 5. Ensure household_members record exists and is admin
    const { error: memErr } = await supabase.from("household_members").upsert(
      {
        household_id: householdId,
        user_id: userId,
        role: "admin",
        user_name: fullName || targetHousehold.admin_name || "المسؤول",
        user_phone: phone || targetHousehold.admin_phone || "",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "household_id,user_id" }
    );

    if (memErr && memErr.code !== "PGRST205") {
      console.warn("[Provisioning] Warning on household_members upsert:", memErr);
    }

    // 6. Ensure household_permissions record exists
    const { data: existingPerms } = await supabase
      .from("household_permissions")
      .select("household_id")
      .eq("household_id", householdId)
      .maybeSingle();

    if (!existingPerms) {
      const { error: permErr } = await supabase.from("household_permissions").upsert(
        {
          household_id: householdId,
          allowed_screens: { categories: true, missing: true, purchases: true, budget: false },
          can_add_missing_item: true,
          can_delete_missing_item: false,
          can_edit_item: true,
          can_add_invoice: false,
          can_use_ai_assistant: true,
          can_send_urgent_alert: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "household_id" }
      );
      if (permErr) {
        console.warn("[Provisioning] Warning on household_permissions upsert:", permErr);
      }
    }

    // 7. Ensure household_budgets record exists
    const { data: existingBudget } = await supabase
      .from("household_budgets")
      .select("household_id")
      .eq("household_id", householdId)
      .maybeSingle();

    if (!existingBudget) {
      const { error: budgetErr } = await supabase.from("household_budgets").upsert(
        {
          household_id: householdId,
          monthly_limit: 2500,
          currency: "ج.م",
          month: "الشهر الحالي",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "household_id" }
      );
      if (budgetErr) {
        console.warn("[Provisioning] Warning on household_budgets upsert:", budgetErr);
      }
    }

    // 8. Ensure profiles record exists and references the household
    const { error: profErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: userEmail,
        household_id: householdId,
        role: "admin",
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profErr) {
      console.warn("[Provisioning] Warning on profile upsert:", profErr);
    }

    // 9. Seed initial default categories to Supabase if seedCategories provided
    if (seedCategories && Array.isArray(seedCategories) && seedCategories.length > 0) {
      try {
        const { data: existingCats } = await supabase
          .from("categories")
          .select("id")
          .eq("household_id", householdId)
          .limit(1);

        if (!existingCats || existingCats.length === 0) {
          await dbService.seedDefaultCategories(householdId, seedCategories);
        }
      } catch (seedErr: any) {
        console.warn("[Provisioning] Warning on categories seeding:", seedErr?.message);
      }
    }

    return {
      success: true,
      householdId,
      household: targetHousehold,
    };
  } catch (err: any) {
    console.error("[Provisioning] Unexpected error:", err);
    return {
      success: false,
      error: err?.message || "حدث خطأ غير متوقع أثناء تهيئة بيانات المنزل",
    };
  }
};

/**
 * Centralized, hardened Database Service Layer for Talabat Al-Bayt
 * All database calls must validate parameters, execute operations, check errors,
 * and enforce verified household ownership and membership boundaries.
 */
export const dbService = {
  // --------------------------------------------------------------------------
  // Profiles
  // --------------------------------------------------------------------------
  async getProfile(userId: string): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!userId || typeof userId !== "string") {
      return { success: false, error: "معرف المستخدم غير صالح" };
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Supabase getProfile error:", error);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err: any) {
      console.error("Exception in getProfile:", err);
      return { success: false, error: err?.message || "فشل جلب الملف الشخصي" };
    }
  },

  async upsertProfile(profile: {
    id: string;
    email?: string;
    full_name?: string;
    phone?: string;
    household_id?: string | null;
    role?: string;
  }): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!profile.id) return { success: false, error: "معرف المستخدم مطلوب" };

    try {
      let res = await supabase
        .from("profiles")
        .upsert(
          {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            phone: profile.phone,
            household_id: profile.household_id,
            role: profile.role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select()
        .single();

      // If remote profiles table does not contain household_id/role columns, fallback cleanly
      if (res.error && (res.error.code === "PGRST204" || res.error.message?.includes("column"))) {
        res = await supabase
          .from("profiles")
          .upsert(
            {
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              phone: profile.phone,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )
          .select()
          .single();
      }

      if (res.error) {
        console.error("Supabase upsertProfile error:", res.error);
        return { success: false, error: res.error.message };
      }
      return { success: true, data: res.data };
    } catch (err: any) {
      console.error("Exception in upsertProfile:", err);
      return { success: false, error: err?.message || "فشل حفظ الملف الشخصي" };
    }
  },

  // --------------------------------------------------------------------------
  // Households & Members
  // --------------------------------------------------------------------------
  async getHousehold(householdId: string): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("households")
        .select("*")
        .eq("id", householdId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل جلب بيانات المنزل" };
    }
  },

  async createHousehold(payload: {
    id: string;
    name: string;
    admin_id: string;
    admin_name?: string;
    admin_phone?: string;
    pair_code?: string;
  }): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!payload.id || !payload.name || !payload.admin_id) {
      return { success: false, error: "بيانات إنشاء المنزل غير مكتملة" };
    }

    try {
      // 1. Insert household (Authoritative)
      const { data: hhData, error: hhErr } = await supabase
        .from("households")
        .upsert({
          id: payload.id,
          name: payload.name,
          admin_id: payload.admin_id,
          admin_name: payload.admin_name || "المسؤول",
          admin_phone: payload.admin_phone || "",
          pair_code: payload.pair_code || payload.id.replace("HH-", "").toUpperCase(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (hhErr) {
        console.error("Failed to insert household in Supabase:", hhErr);
        throw hhErr;
      }

      // 2. Insert creator as admin in household_members (if table exists)
      try {
        const { error: memErr } = await supabase.from("household_members").upsert(
          {
            household_id: payload.id,
            user_id: payload.admin_id,
            role: "admin",
            user_name: payload.admin_name || "المسؤول",
            user_phone: payload.admin_phone || "",
            joined_at: new Date().toISOString(),
          },
          { onConflict: "household_id,user_id" }
        );
        if (memErr && memErr.code !== "PGRST205") {
          console.warn("Could not upsert admin membership:", memErr);
        }
      } catch (e) {
        console.warn("household_members table error bypassed:", e);
      }

      // 3. Initialize default household permissions
      const { error: permErr } = await supabase.from("household_permissions").upsert(
        {
          household_id: payload.id,
          allowed_screens: { categories: true, missing: true, purchases: true, budget: false },
          can_add_missing_item: true,
          can_delete_missing_item: false,
          can_edit_item: true,
          can_add_invoice: false,
          can_use_ai_assistant: true,
          can_send_urgent_alert: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "household_id" }
      );
      if (permErr) {
        console.warn("household_permissions upsert warning:", permErr);
      }

      // 4. Initialize default budget
      const { error: bErr } = await supabase.from("household_budgets").upsert(
        {
          household_id: payload.id,
          monthly_limit: 2500,
          currency: "ج.م",
          month: "الشهر الحالي",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "household_id" }
      );
      if (bErr) {
        console.warn("household_budgets upsert warning:", bErr);
      }

      // 5. Update user profile to link to household
      try {
        let pRes = await supabase.from("profiles").upsert({
          id: payload.admin_id,
          household_id: payload.id,
          role: "admin",
          full_name: payload.admin_name || "المسؤول",
          phone: payload.admin_phone || "",
          updated_at: new Date().toISOString(),
        });
        if (pRes.error && (pRes.error.code === "PGRST204" || pRes.error.message?.includes("column"))) {
          await supabase.from("profiles").upsert({
            id: payload.admin_id,
            full_name: payload.admin_name || "المسؤول",
            phone: payload.admin_phone || "",
            updated_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn("Profile update in createHousehold:", e);
      }

      // 6. Update user metadata directly on Auth session
      try {
        await supabase.auth.updateUser({
          data: {
            household_id: payload.id,
            household_name: payload.name,
            role: "admin",
            full_name: payload.admin_name || "المسؤول",
            phone: payload.admin_phone || "",
          },
        });
      } catch (e) {
        console.warn("Could not update auth user metadata:", e);
      }

      return { success: true, data: hhData };
    } catch (err: any) {
      console.error("Error creating household:", err);
      return { success: false, error: err?.message || "فشل إنشاء وتوثيق المنزل في قاعدة البيانات" };
    }
  },

  async updateHousehold(
    householdId: string,
    updates: { name?: string; admin_name?: string; admin_phone?: string; pair_code?: string }
  ): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("households")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", householdId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل تحديث بيانات المنزل" };
    }
  },

  async getHouseholdMembers(householdId: string): Promise<DbResult<any[]>> {
    if (!supabase) return { success: false, data: [], error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, data: [], error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("household_members")
        .select("*")
        .eq("household_id", householdId)
        .order("joined_at", { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, data: [], error: err?.message || "فشل جلب قائمة الأعضاء" };
    }
  },

  async leaveHousehold(householdId: string, userId: string): Promise<DbResult<void>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!householdId || !userId) return { success: false, error: "المعرفات المطلوبة غير متوفرة" };

    try {
      const { error: delErr } = await supabase
        .from("household_members")
        .delete()
        .eq("household_id", householdId)
        .eq("user_id", userId);

      if (delErr) throw delErr;

      await supabase
        .from("profiles")
        .update({ household_id: null, role: "guest", updated_at: new Date().toISOString() })
        .eq("id", userId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل مغادرة المنزل" };
    }
  },

  // --------------------------------------------------------------------------
  // Pairing Tokens & QR Linking
  // --------------------------------------------------------------------------
  /**
   * Generates a high-entropy, short-lived, one-time pairing token for the household.
   * Requirement 8 & 9:
   * - Short-lived (default 15 minutes).
   * - One-time use.
   * - Does NOT contain household_id, household name, or sensitive data in the token string itself.
   * - Does NOT store static pair_code on households table.
   */
  async createPairingToken(
    householdId: string,
    createdByUserId: string,
    validityMinutes = 15
  ): Promise<
    | {
        success: true;
        data: {
          id?: string;
          token: string;
          expires_at: string;
          household_id: string;
          created_by?: string;
          created_at?: string;
          is_used?: boolean;
        };
      }
    | { success: false; error: string }
  > {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!householdId || !createdByUserId) {
      return { success: false, error: "معرف المنزل ومعرف المسؤول مطلوبان" };
    }

    try {
      // High-entropy 12-byte random hex (24 chars) + clean PAIR- prefix
      const randomBytes = new Uint8Array(12);
      crypto.getRandomValues(randomBytes);
      const randomPart = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
      const token = `PAIR-${randomPart}`;

      // 15 minutes default validity
      const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("pairing_tokens")
        .insert({
          household_id: householdId,
          token,
          created_by: createdByUserId,
          created_at: new Date().toISOString(),
          expires_at: expiresAt,
          is_used: false,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating pairing token in DB:", error);
        return {
          success: false,
          error: error.message || "فشل إنشاء رمز الربط المؤقت في قاعدة البيانات",
        };
      }

      return {
        success: true,
        data: { token: data.token, expires_at: data.expires_at, household_id: data.household_id },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل توليد رمز الربط المؤقت" };
    }
  },

  async validateAndConsumePairingToken(
    tokenInput: string,
    authenticatedUserId: string,
    userName = "هاتف المنزل",
    userPhone = ""
  ): Promise<{
    success: boolean;
    household?: any;
    permissions?: any;
    role?: "home" | "admin" | "member" | "household_member";
    message: string;
    error?: string;
  }> {
    if (!supabase) return { success: false, message: "خدمة قاعدة البيانات غير مهيأة" };
    const cleanToken = tokenInput.trim().toUpperCase();
    if (!cleanToken || !authenticatedUserId) {
      return { success: false, message: "يرجى إدخال رمز ربط صحيح والمصادقة أولاً" };
    }

    try {
      // 0. Attempt atomic RPC if available in remote Supabase
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("consume_pairing_token", {
          token_input: cleanToken,
          member_name: userName,
          member_phone: userPhone,
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          const { data: householdData } = await supabase
            .from("households")
            .select("*")
            .eq("id", rpcRes.household_id)
            .maybeSingle();

          const { data: permissionsData } = await supabase
            .from("household_permissions")
            .select("*")
            .eq("household_id", rpcRes.household_id)
            .maybeSingle();

          return {
            success: true,
            household: householdData || { id: rpcRes.household_id, name: rpcRes.household_name },
            permissions: permissionsData,
            role: "household_member",
            message: rpcRes.message || "تم الانضمام للمنزل بنجاح",
          };
        } else if (rpcErr && rpcErr.message && !rpcErr.message.includes("function") && !rpcErr.message.includes("does not exist")) {
          // If RPC returned a business rejection (e.g. expired or already used)
          return {
            success: false,
            message: rpcRes?.message || rpcErr.message,
            error: rpcErr.message,
          };
        }
      } catch {
        // Fallback to direct table operations if RPC not defined
      }

      let targetHouseholdId: string | null = null;
      let matchedTokenId: string | null = null;

      // 1. Strict check in pairing_tokens table (Atomic & One-time use)
      const { data: tokenRecord, error: tokenErr } = await supabase
        .from("pairing_tokens")
        .select("*")
        .eq("token", cleanToken)
        .maybeSingle();

      if (!tokenRecord) {
        return {
          success: false,
          message: "رمز الربط غير صالح أو غير موجود في النظام",
        };
      }

      if (tokenRecord.is_used) {
        return {
          success: false,
          message: "رمز الربط هذا تم استخدامه مسبقاً ولا يمكن إعادة استخدامه",
        };
      }

      if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
        return {
          success: false,
          message: "انتهت صلاحية رمز الربط هذا. يرجى طلب رمز جديد من المسؤول",
        };
      }

      targetHouseholdId = tokenRecord.household_id;
      matchedTokenId = tokenRecord.id;

      // 2. Atomically claim/consume pairing token
      const { data: consumedToken, error: consumeErr } = await supabase
        .from("pairing_tokens")
        .update({
          is_used: true,
          used_by: authenticatedUserId,
          used_at: new Date().toISOString(),
        })
        .eq("id", matchedTokenId)
        .eq("is_used", false)
        .gt("expires_at", new Date().toISOString())
        .select()
        .maybeSingle();

      if (consumeErr || !consumedToken) {
        return {
          success: false,
          message: "رمز الربط غير صالح أو تم استخدامه مسبقاً أو انتهت صلاحيته",
        };
      }

      // 3. Create authoritative membership in household_members with role = "household_member"
      // This links auth.uid() -> household_members -> household_id -> RLS
      const { error: memberErr } = await supabase.from("household_members").upsert(
        {
          household_id: targetHouseholdId,
          user_id: authenticatedUserId,
          role: "household_member",
          user_name: userName || "هاتف المنزل",
          user_phone: userPhone || "",
          joined_at: new Date().toISOString(),
        },
        { onConflict: "household_id,user_id" }
      );

      if (memberErr) {
        console.error("Could not insert household_members record:", memberErr);
        // Rollback token consumption if membership creation failed
        await supabase
          .from("pairing_tokens")
          .update({ is_used: false, used_by: null, used_at: null })
          .eq("id", matchedTokenId);

        return {
          success: false,
          message: "فشل تسجيل عضوية هاتف المنزل: " + memberErr.message,
          error: memberErr.message,
        };
      }

      // 5. Update user's profile with household_id and household_member role
      await supabase.from("profiles").upsert(
        {
          id: authenticatedUserId,
          household_id: targetHouseholdId,
          role: "household_member",
          full_name: userName,
          phone: userPhone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      // 6. Fetch authoritative household data (now authorized via RLS)
      const { data: householdData, error: hhErr } = await supabase
        .from("households")
        .select("*")
        .eq("id", targetHouseholdId)
        .maybeSingle();

      if (hhErr || !householdData) {
        return {
          success: false,
          message: "تعذر العثور على المنزل المرتبط برمز الربط في قاعدة البيانات",
          error: hhErr?.message,
        };
      }

      // 7. Fetch permissions
      const { data: permissionsData } = await supabase
        .from("household_permissions")
        .select("*")
        .eq("household_id", targetHouseholdId)
        .maybeSingle();

      return {
        success: true,
        household: householdData,
        permissions: permissionsData,
        role: "household_member",
        message: `تم ربط المنزل (${householdData.name}) بنجاح وتفعيل المزامنة الموثوقة`,
      };
    } catch (err: any) {
      console.error("Error validating pairing token:", err);
      return {
        success: false,
        message: err?.message || "حدث خطأ غير متوقع أثناء معالجة رمز الربط",
        error: err?.message,
      };
    }
  },

  // --------------------------------------------------------------------------
  // Missing Items
  // --------------------------------------------------------------------------
  async getMissingItems(householdId: string): Promise<DbResult<any[]>> {
    if (!supabase) return { success: false, data: [], error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, data: [], error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("missing_items")
        .select("*")
        .eq("household_id", householdId)
        .order("added_at", { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, data: [], error: err?.message || "فشل جلب قائمة النواقص" };
    }
  },

  async createMissingItem(item: {
    id: string;
    household_id: string;
    name: string;
    category: string;
    category_arabic: string;
    quantity?: string;
    urgency?: string;
    notes?: string;
    added_by?: string;
    added_by_name?: string;
    completed?: boolean;
  }): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!item.id || !item.household_id || !item.name?.trim()) {
      return { success: false, error: "بيانات الناقص غير مكتملة" };
    }

    try {
      const { data, error } = await supabase
        .from("missing_items")
        .insert({
          id: item.id,
          household_id: item.household_id,
          name: item.name.trim(),
          category: item.category,
          category_arabic: item.category_arabic,
          quantity: item.quantity || "١",
          urgency: item.urgency || "normal",
          notes: item.notes || "",
          added_by: item.added_by || "home",
          added_by_name: item.added_by_name || "",
          completed: item.completed || false,
          added_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error("Error creating missing item in DB:", err);
      return { success: false, error: err?.message || "فشل إضافة الناقص إلى قاعدة البيانات" };
    }
  },

  async updateMissingItem(
    id: string,
    householdId: string,
    updates: Record<string, any>
  ): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!id || !householdId) return { success: false, error: "معرف الصنف والمنزل مطلوبان" };

    try {
      const { data, error } = await supabase
        .from("missing_items")
        .update(updates)
        .eq("id", id)
        .eq("household_id", householdId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error("Error updating missing item in DB:", err);
      return { success: false, error: err?.message || "فشل تحديث الناقص في قاعدة البيانات" };
    }
  },

  async deleteMissingItem(id: string, householdId: string): Promise<DbResult<void>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!id || !householdId) return { success: false, error: "معرف الصنف والمنزل مطلوبان" };

    try {
      const { error } = await supabase
        .from("missing_items")
        .delete()
        .eq("id", id)
        .eq("household_id", householdId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error("Error deleting missing item from DB:", err);
      return { success: false, error: err?.message || "فشل حذف الصنف من قاعدة البيانات" };
    }
  },

  async clearCompletedMissingItems(householdId: string): Promise<DbResult<void>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, error: "معرف المنزل مطلوب" };

    try {
      const { error } = await supabase
        .from("missing_items")
        .delete()
        .eq("household_id", householdId)
        .eq("completed", true);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل تنظيف العناصر المكتملة" };
    }
  },

  // --------------------------------------------------------------------------
  // Invoices & Purchases
  // --------------------------------------------------------------------------
  async getInvoices(householdId: string): Promise<DbResult<any[]>> {
    if (!supabase) return { success: false, data: [], error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, data: [], error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("household_id", householdId)
        .order("date", { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, data: [], error: err?.message || "فشل جلب الفواتير" };
    }
  },

  async createInvoice(invoice: {
    id: string;
    household_id: string;
    invoice_number: string;
    date: string;
    category: string;
    category_arabic: string;
    products: any[];
    total_price: number;
    notes?: string;
    registered_by: string;
    payment_method?: string;
  }): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!invoice.id || !invoice.household_id || !invoice.invoice_number) {
      return { success: false, error: "بيانات الفاتورة غير مكتملة" };
    }

    try {
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          id: invoice.id,
          household_id: invoice.household_id,
          invoice_number: invoice.invoice_number,
          date: invoice.date,
          category: invoice.category,
          category_arabic: invoice.category_arabic,
          products: invoice.products || [],
          total_price: Number(invoice.total_price) || 0,
          notes: invoice.notes || "",
          registered_by: invoice.registered_by || "المسؤول",
          payment_method: invoice.payment_method || "cash",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error("Error creating invoice in DB:", err);
      return { success: false, error: err?.message || "فشل تسجيل الفاتورة في قاعدة البيانات" };
    }
  },

  async deleteInvoice(id: string, householdId: string): Promise<DbResult<void>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!id || !householdId) return { success: false, error: "معرف الفاتورة والمنزل مطلوبان" };

    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id)
        .eq("household_id", householdId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل حذف الفاتورة" };
    }
  },

  // --------------------------------------------------------------------------
  // Budget & Permissions
  // --------------------------------------------------------------------------
  async getBudget(householdId: string): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("household_budgets")
        .select("*")
        .eq("household_id", householdId)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل جلب الميزانية" };
    }
  },

  async upsertBudget(budget: {
    household_id: string;
    monthly_limit: number;
    currency: string;
    month: string;
  }): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!budget.household_id) return { success: false, error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("household_budgets")
        .upsert(
          {
            household_id: budget.household_id,
            monthly_limit: Number(budget.monthly_limit) || 2500,
            currency: budget.currency || "ج.م",
            month: budget.month || "الشهر الحالي",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "household_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error("Error upserting budget in DB:", err);
      return { success: false, error: err?.message || "فشل تحديث الميزانية في قاعدة البيانات" };
    }
  },

  async getPermissions(householdId: string): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("household_permissions")
        .select("*")
        .eq("household_id", householdId)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل جلب الصلاحيات" };
    }
  },

  async upsertPermissions(permissions: {
    household_id: string;
    allowed_screens?: any;
    can_add_missing_item?: boolean;
    can_delete_missing_item?: boolean;
    can_edit_item?: boolean;
    can_add_invoice?: boolean;
    can_use_ai_assistant?: boolean;
    can_send_urgent_alert?: boolean;
  }): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!permissions.household_id) return { success: false, error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("household_permissions")
        .upsert(
          {
            ...permissions,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "household_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error("Error updating permissions in DB:", err);
      return { success: false, error: err?.message || "فشل تحديث صلاحيات هاتف المنزل" };
    }
  },

  // --------------------------------------------------------------------------
  // Categories & Taxonomy
  // --------------------------------------------------------------------------
  async getCustomCategories(householdId: string): Promise<DbResult<any[]>> {
    if (!supabase) return { success: false, data: [], error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, data: [], error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("household_id", householdId);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, data: [], error: err?.message || "فشل جلب الأقسام المخصصة" };
    }
  },

  async seedDefaultCategories(householdId: string, seedCategories: any[]): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, error: "معرف المنزل مطلوب" };
    try {
      const rows = seedCategories.map((c) => ({
        id: c.id,
        household_id: householdId,
        name_ar: c.nameAr || c.name_ar,
        name_en: c.nameEn || c.name_en || "",
        image_url: c.imageUrl || c.image_url || "",
        color: c.color || "emerald",
        bg_light: c.bgLight || c.bg_light || "",
        badge_color: c.badgeColor || c.badge_color || "",
        description: c.description || "",
        common_items: c.commonItems || c.common_items || [],
        subcategories: c.subcategories || [],
        is_custom: false,
      }));

      const { data, error } = await supabase
        .from("categories")
        .upsert(rows, { onConflict: "household_id,id" });

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.warn("Notice: seedDefaultCategories had an issue (may already exist or offline):", err?.message);
      return { success: false, error: err?.message };
    }
  },

  async upsertCategory(category: {
    id: string;
    household_id: string;
    name_ar: string;
    name_en: string;
    image_url: string;
    color?: string;
    bg_light?: string;
    badge_color?: string;
    description?: string;
    common_items?: string[];
    subcategories?: any[];
    is_custom?: boolean;
  }): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!category.id || !category.household_id || !category.name_ar) {
      return { success: false, error: "بيانات القسم غير مكتملة" };
    }

    try {
      const { data, error } = await supabase
        .from("categories")
        .upsert(
          {
            id: category.id,
            household_id: category.household_id,
            name_ar: category.name_ar,
            name_en: category.name_en,
            image_url: category.image_url,
            color: category.color,
            bg_light: category.bg_light,
            badge_color: category.badge_color,
            description: category.description,
            common_items: category.common_items || [],
            subcategories: category.subcategories || [],
            is_custom: category.is_custom !== undefined ? category.is_custom : true,
          },
          { onConflict: "household_id,id" }
        )
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error("Error upserting category in DB:", err);
      return { success: false, error: err?.message || "فشل حفظ القسم في قاعدة البيانات" };
    }
  },

  async deleteCategory(id: string, householdId: string): Promise<DbResult<void>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!id || !householdId) return { success: false, error: "معرف القسم والمنزل مطلوبان" };

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id)
        .eq("household_id", householdId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل حذف القسم من قاعدة البيانات" };
    }
  },

  // --------------------------------------------------------------------------
  // Notifications & Alerts
  // --------------------------------------------------------------------------
  async getNotifications(householdId: string): Promise<DbResult<any[]>> {
    if (!supabase) return { success: false, data: [], error: "قاعدة البيانات غير متصلة" };
    if (!householdId) return { success: false, data: [], error: "معرف المنزل مطلوب" };

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, data: [], error: err?.message || "فشل جلب الإشعارات" };
    }
  },

  async insertNotification(notification: {
    id: string;
    household_id: string;
    title: string;
    message: string;
    type: string;
    target_role?: string;
    read?: boolean;
  }): Promise<DbResult<any>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!notification.household_id || !notification.title) {
      return { success: false, error: "بيانات الإشعار غير مكتملة" };
    }

    try {
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          id: notification.id || `notif-${Date.now()}`,
          household_id: notification.household_id,
          title: notification.title,
          message: notification.message || "",
          type: notification.type || "item_added",
          target_role: notification.target_role || "all",
          read: notification.read || false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error("Error inserting notification in DB:", err);
      return { success: false, error: err?.message || "فشل تسجيل الإشعار" };
    }
  },

  async markNotificationRead(id: string, householdId: string): Promise<DbResult<void>> {
    if (!supabase) return { success: false, error: "قاعدة البيانات غير متصلة" };
    if (!id || !householdId) return { success: false, error: "المعرفات مطلوبة" };

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("household_id", householdId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل تحديث حالة الإشعار" };
    }
  },
};

// Compatibility wrapper matching dbHelpers signature to ensure seamless integration
export const dbHelpers = {
  upsertHousehold: (household: any) => dbService.createHousehold(household),
  upsertPermissions: (perms: any) => dbService.upsertPermissions(perms),
  insertMissingItem: (item: any) => dbService.createMissingItem(item),
  updateMissingItem: (id: string, updates: any, householdId?: string) => {
    const hId = householdId || updates.household_id || "";
    return dbService.updateMissingItem(id, hId, updates);
  },
  deleteMissingItem: (id: string, householdId?: string) =>
    dbService.deleteMissingItem(id, householdId || ""),
  clearCompletedMissingItems: (householdId: string) =>
    dbService.clearCompletedMissingItems(householdId),
  insertInvoice: (invoice: any) => dbService.createInvoice(invoice),
  deleteInvoice: (id: string, householdId: string) => dbService.deleteInvoice(id, householdId),
  upsertCategory: (cat: any) => dbService.upsertCategory(cat),
  deleteCategory: (id: string, householdId: string) => dbService.deleteCategory(id, householdId),
  upsertBudget: (budget: any) => dbService.upsertBudget(budget),
  createPairingToken: (householdId: string, createdByUserId?: string, validityHours = 48) =>
    dbService.createPairingToken(householdId, createdByUserId || "", validityHours),
  validateAndConsumePairingToken: (
    tokenInput: string,
    authenticatedUserId: string,
    userName = "هاتف المنزل",
    userPhone = ""
  ) =>
    dbService.validateAndConsumePairingToken(
      tokenInput,
      authenticatedUserId,
      userName,
      userPhone
    ),
  leaveHousehold: (householdId: string, userId: string) =>
    dbService.leaveHousehold(householdId, userId),
  fetchHouseholdMembers: (householdId: string) =>
    dbService.getHouseholdMembers(householdId).then((r) => r.data || []),
  fetchMissingItems: (householdId: string) => dbService.getMissingItems(householdId),
  fetchInvoices: (householdId: string) => dbService.getInvoices(householdId),
  fetchBudget: (householdId: string) => dbService.getBudget(householdId),
  fetchCustomCategories: (householdId: string) => dbService.getCustomCategories(householdId),
  seedDefaultCategories: (householdId: string, seedCategories: any[]) => dbService.seedDefaultCategories(householdId, seedCategories),
  fetchNotifications: (householdId: string) => dbService.getNotifications(householdId),
  insertNotification: (notif: any) => dbService.insertNotification(notif),
};

/**
 * Authoritative SQL Definition for Supabase Database & Hardened Row Level Security (RLS)
 * Designed for direct execution in the Supabase SQL Editor.
 */
export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- TALABAT AL-BAYT (طلبات البيت) — SUPABASE DATABASE-ENFORCED SECURITY SCHEMA
-- ==============================================================================

-- 1. Tables Definition
CREATE TABLE IF NOT EXISTS public.households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_name TEXT,
  admin_phone TEXT,
  pair_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'home', -- 'admin', 'home', 'member', 'guest'
  user_name TEXT,
  user_phone TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_household_member UNIQUE (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.household_permissions (
  household_id TEXT PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  allowed_screens JSONB DEFAULT '{"categories": true, "missing": true, "purchases": true, "budget": false}'::jsonb,
  can_add_missing_item BOOLEAN DEFAULT true,
  can_delete_missing_item BOOLEAN DEFAULT false,
  can_edit_item BOOLEAN DEFAULT true,
  can_add_invoice BOOLEAN DEFAULT false,
  can_use_ai_assistant BOOLEAN DEFAULT true,
  can_send_urgent_alert BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.missing_items (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  category_arabic TEXT NOT NULL,
  quantity TEXT DEFAULT '١',
  urgency TEXT DEFAULT 'normal',
  notes TEXT,
  added_by TEXT DEFAULT 'home',
  added_by_name TEXT,
  completed BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  category_arabic TEXT NOT NULL,
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  registered_by TEXT NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  image_url TEXT NOT NULL,
  color TEXT,
  bg_light TEXT,
  badge_color TEXT,
  description TEXT,
  common_items JSONB DEFAULT '[]'::jsonb,
  subcategories JSONB DEFAULT '[]'::jsonb,
  is_custom BOOLEAN DEFAULT false,
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS public.household_budgets (
  household_id TEXT PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  monthly_limit NUMERIC DEFAULT 2500,
  currency TEXT DEFAULT 'ج.م',
  month TEXT DEFAULT 'الشهر الحالي',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  target_role TEXT DEFAULT 'all',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  household_id TEXT REFERENCES public.households(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'admin',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for Performance & Scalability
CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_hh ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_token ON public.pairing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_missing_items_hh ON public.missing_items(household_id);
CREATE INDEX IF NOT EXISTS idx_invoices_hh ON public.invoices(household_id);
CREATE INDEX IF NOT EXISTS idx_categories_hh ON public.categories(household_id);
CREATE INDEX IF NOT EXISTS idx_notifications_hh ON public.notifications(household_id);
CREATE INDEX IF NOT EXISTS idx_profiles_hh ON public.profiles(household_id);

-- 3. Security Definer Helper Functions (Avoid Recursive RLS Evaluation)
CREATE OR REPLACE FUNCTION public.is_household_member(lookup_household_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = lookup_household_id
      AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.households
    WHERE id = lookup_household_id
      AND admin_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_admin(lookup_household_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households
    WHERE id = lookup_household_id
      AND admin_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = lookup_household_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 4. Enable Row Level Security (RLS) on ALL tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Drop Legacy Insecure Policies
DROP POLICY IF EXISTS "Allow members access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow members and admins access to households" ON public.households;
DROP POLICY IF EXISTS "Allow users to view and join household members" ON public.household_members;
DROP POLICY IF EXISTS "Allow authenticated users to manage and use pairing tokens" ON public.pairing_tokens;
DROP POLICY IF EXISTS "Allow household members access to permissions" ON public.household_permissions;
DROP POLICY IF EXISTS "Allow household members full access to items" ON public.missing_items;
DROP POLICY IF EXISTS "Allow household members full access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow household members full access to categories" ON public.categories;
DROP POLICY IF EXISTS "Allow household members access to budgets" ON public.household_budgets;
DROP POLICY IF EXISTS "Allow household members access to notifications" ON public.notifications;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

DROP POLICY IF EXISTS "households_select_policy" ON public.households;
DROP POLICY IF EXISTS "households_insert_policy" ON public.households;
DROP POLICY IF EXISTS "households_update_policy" ON public.households;
DROP POLICY IF EXISTS "households_delete_policy" ON public.households;

DROP POLICY IF EXISTS "household_members_select_policy" ON public.household_members;
DROP POLICY IF EXISTS "household_members_insert_policy" ON public.household_members;
DROP POLICY IF EXISTS "household_members_update_policy" ON public.household_members;
DROP POLICY IF EXISTS "household_members_delete_policy" ON public.household_members;

DROP POLICY IF EXISTS "pairing_tokens_select_policy" ON public.pairing_tokens;
DROP POLICY IF EXISTS "pairing_tokens_insert_policy" ON public.pairing_tokens;
DROP POLICY IF EXISTS "pairing_tokens_update_policy" ON public.pairing_tokens;
DROP POLICY IF EXISTS "pairing_tokens_delete_policy" ON public.pairing_tokens;

DROP POLICY IF EXISTS "household_permissions_select_policy" ON public.household_permissions;
DROP POLICY IF EXISTS "household_permissions_insert_policy" ON public.household_permissions;
DROP POLICY IF EXISTS "household_permissions_update_policy" ON public.household_permissions;
DROP POLICY IF EXISTS "household_permissions_delete_policy" ON public.household_permissions;

DROP POLICY IF EXISTS "missing_items_select_policy" ON public.missing_items;
DROP POLICY IF EXISTS "missing_items_insert_policy" ON public.missing_items;
DROP POLICY IF EXISTS "missing_items_update_policy" ON public.missing_items;
DROP POLICY IF EXISTS "missing_items_delete_policy" ON public.missing_items;

DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;

DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

DROP POLICY IF EXISTS "household_budgets_select_policy" ON public.household_budgets;
DROP POLICY IF EXISTS "household_budgets_insert_policy" ON public.household_budgets;
DROP POLICY IF EXISTS "household_budgets_update_policy" ON public.household_budgets;
DROP POLICY IF EXISTS "household_budgets_delete_policy" ON public.household_budgets;

DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;

-- 6. Granular Row Level Security (RLS) Policies

-- PROFILES (Users own their profile; co-members can view names)
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT
USING (auth.uid() = id OR (household_id IS NOT NULL AND public.is_household_member(household_id)));

CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE
USING (auth.uid() = id);

-- HOUSEHOLDS (Admin owned; member viewable)
CREATE POLICY "households_select_policy" ON public.households FOR SELECT
USING (admin_id = auth.uid() OR public.is_household_member(id));

CREATE POLICY "households_insert_policy" ON public.households FOR INSERT
WITH CHECK (admin_id = auth.uid());

CREATE POLICY "households_update_policy" ON public.households FOR UPDATE
USING (admin_id = auth.uid() OR public.is_household_admin(id))
WITH CHECK (admin_id = auth.uid() OR public.is_household_admin(id));

CREATE POLICY "households_delete_policy" ON public.households FOR DELETE
USING (admin_id = auth.uid());

-- HOUSEHOLD MEMBERS
CREATE POLICY "household_members_select_policy" ON public.household_members FOR SELECT
USING (user_id = auth.uid() OR public.is_household_member(household_id));

CREATE POLICY "household_members_insert_policy" ON public.household_members FOR INSERT
WITH CHECK (user_id = auth.uid() OR public.is_household_admin(household_id));

CREATE POLICY "household_members_update_policy" ON public.household_members FOR UPDATE
USING (public.is_household_admin(household_id) OR (user_id = auth.uid()))
WITH CHECK (public.is_household_admin(household_id) OR (user_id = auth.uid()));

CREATE POLICY "household_members_delete_policy" ON public.household_members FOR DELETE
USING (user_id = auth.uid() OR public.is_household_admin(household_id));

-- PAIRING TOKENS (Strictly protected so pair codes of other households are never exposed)
CREATE POLICY "pairing_tokens_select_policy" ON public.pairing_tokens FOR SELECT
USING (created_by = auth.uid() OR public.is_household_admin(household_id) OR public.is_household_member(household_id));

CREATE POLICY "pairing_tokens_insert_policy" ON public.pairing_tokens FOR INSERT
WITH CHECK (created_by = auth.uid() AND public.is_household_admin(household_id));

CREATE POLICY "pairing_tokens_update_policy" ON public.pairing_tokens FOR UPDATE
USING (public.is_household_admin(household_id) OR (NOT is_used AND expires_at > NOW() AND auth.uid() IS NOT NULL))
WITH CHECK (public.is_household_admin(household_id) OR (auth.uid() IS NOT NULL));

CREATE POLICY "pairing_tokens_delete_policy" ON public.pairing_tokens FOR DELETE
USING (public.is_household_admin(household_id));

-- HOUSEHOLD PERMISSIONS
CREATE POLICY "household_permissions_select_policy" ON public.household_permissions FOR SELECT
USING (public.is_household_member(household_id));

CREATE POLICY "household_permissions_insert_policy" ON public.household_permissions FOR INSERT
WITH CHECK (public.is_household_admin(household_id));

CREATE POLICY "household_permissions_update_policy" ON public.household_permissions FOR UPDATE
USING (public.is_household_admin(household_id)) WITH CHECK (public.is_household_admin(household_id));

CREATE POLICY "household_permissions_delete_policy" ON public.household_permissions FOR DELETE
USING (public.is_household_admin(household_id));

-- MISSING ITEMS
CREATE POLICY "missing_items_select_policy" ON public.missing_items FOR SELECT
USING (public.is_household_member(household_id));

CREATE POLICY "missing_items_insert_policy" ON public.missing_items FOR INSERT
WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "missing_items_update_policy" ON public.missing_items FOR UPDATE
USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "missing_items_delete_policy" ON public.missing_items FOR DELETE
USING (public.is_household_member(household_id));

-- INVOICES
CREATE POLICY "invoices_select_policy" ON public.invoices FOR SELECT
USING (public.is_household_member(household_id));

CREATE POLICY "invoices_insert_policy" ON public.invoices FOR INSERT
WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "invoices_update_policy" ON public.invoices FOR UPDATE
USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "invoices_delete_policy" ON public.invoices FOR DELETE
USING (public.is_household_member(household_id));

-- CATEGORIES
CREATE POLICY "categories_select_policy" ON public.categories FOR SELECT
USING (public.is_household_member(household_id));

CREATE POLICY "categories_insert_policy" ON public.categories FOR INSERT
WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "categories_update_policy" ON public.categories FOR UPDATE
USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "categories_delete_policy" ON public.categories FOR DELETE
USING (public.is_household_member(household_id));

-- BUDGETS
CREATE POLICY "household_budgets_select_policy" ON public.household_budgets FOR SELECT
USING (public.is_household_member(household_id));

CREATE POLICY "household_budgets_insert_policy" ON public.household_budgets FOR INSERT
WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "household_budgets_update_policy" ON public.household_budgets FOR UPDATE
USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "household_budgets_delete_policy" ON public.household_budgets FOR DELETE
USING (public.is_household_admin(household_id));

-- NOTIFICATIONS
CREATE POLICY "notifications_select_policy" ON public.notifications FOR SELECT
USING (public.is_household_member(household_id));

CREATE POLICY "notifications_insert_policy" ON public.notifications FOR INSERT
WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "notifications_update_policy" ON public.notifications FOR UPDATE
USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "notifications_delete_policy" ON public.notifications FOR DELETE
USING (public.is_household_member(household_id));

-- ============================================================================
-- ATOMIC PAIRING RPC FUNCTION: consume_pairing_token
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consume_pairing_token(
  token_input TEXT,
  member_name TEXT DEFAULT 'هاتف المنزل',
  member_phone TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_token RECORD;
  v_household RECORD;
  v_permissions RECORD;
BEGIN
  -- 1. Ensure caller is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHENTICATED',
      'message', 'يجب توثيق هوية الجهاز أولاً قبل ربط المنزل'
    );
  END IF;

  -- 2. Normalize and check token
  token_input := UPPER(TRIM(token_input));
  IF token_input IS NULL OR token_input = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TOKEN',
      'message', 'رمز الربط المؤقت غير صالح أو فارغ'
    );
  END IF;

  -- 3. Atomically select and lock the token row FOR UPDATE
  SELECT * INTO v_token
  FROM public.pairing_tokens
  WHERE token = token_input
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'رمز الربط غير صالح أو غير موجود في النظام'
    );
  END IF;

  IF v_token.is_used THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_USED',
      'message', 'رمز الربط هذا تم استخدامه مسبقاً ولا يمكن إعادة استخدامه'
    );
  END IF;

  IF v_token.expires_at <= NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXPIRED',
      'message', 'انتهت صلاحية رمز الربط هذا. يرجى طلب رمز جديد من المسؤول'
    );
  END IF;

  -- 4. Check household exists
  SELECT * INTO v_household
  FROM public.households
  WHERE id = v_token.household_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'HOUSEHOLD_NOT_FOUND',
      'message', 'المنزل المرتبط برمز الربط لم يعد موجوداً'
    );
  END IF;

  -- 5. Insert/Update membership with role = 'household_member' (never admin)
  INSERT INTO public.household_members (household_id, user_id, role, user_name, user_phone, joined_at)
  VALUES (
    v_household.id,
    v_user_id,
    'household_member',
    COALESCE(NULLIF(TRIM(member_name), ''), 'هاتف المنزل'),
    COALESCE(member_phone, ''),
    NOW()
  )
  ON CONFLICT (household_id, user_id)
  DO UPDATE SET
    role = 'household_member',
    user_name = COALESCE(NULLIF(TRIM(member_name), ''), household_members.user_name),
    user_phone = COALESCE(member_phone, household_members.user_phone);

  -- 6. Update user profile to link household
  INSERT INTO public.profiles (id, household_id, role, full_name, phone, updated_at)
  VALUES (
    v_user_id,
    v_household.id,
    'household_member',
    COALESCE(NULLIF(TRIM(member_name), ''), 'هاتف المنزل'),
    COALESCE(member_phone, ''),
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    household_id = v_household.id,
    role = 'household_member',
    full_name = COALESCE(NULLIF(TRIM(member_name), ''), profiles.full_name),
    phone = COALESCE(member_phone, profiles.phone),
    updated_at = NOW();

  -- 7. Mark token as consumed atomically
  UPDATE public.pairing_tokens
  SET
    is_used = true,
    used_by = v_user_id,
    used_at = NOW()
  WHERE id = v_token.id;

  RETURN jsonb_build_object(
    'success', true,
    'household_id', v_household.id,
    'household_name', v_household.name,
    'message', 'تم ربط هاتف المنزل بالمنزل بنجاح وتفعيل المزامنة'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLSTATE,
    'message', 'فشلت عملية الربط: ' || SQLERRM
  );
END;
$$;

-- ==============================================================================
-- TALABAT AL-BAYT — UNIFIED DELIVERY SYSTEM EXTENSION
-- ==============================================================================

-- 1. Helper Security Functions for Delivery
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'manager')
  ) OR EXISTS (
    SELECT 1 FROM public.households
    WHERE admin_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.household_members
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$func$;

CREATE OR REPLACE FUNCTION public.is_active_driver()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_drivers
    WHERE user_id = auth.uid() AND is_active = true
  );
$func$;

CREATE OR REPLACE FUNCTION public.get_current_driver_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $func$
  SELECT id FROM public.delivery_drivers
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$func$;

CREATE OR REPLACE FUNCTION public.is_delivery_enabled()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $func$
  SELECT COALESCE(
    (SELECT delivery_enabled FROM public.delivery_settings LIMIT 1),
    true
  );
$func$;

-- 2. Delivery Tables Definition
CREATE TABLE IF NOT EXISTS public.delivery_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  default_delivery_fee NUMERIC NOT NULL DEFAULT 15.00,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.delivery_settings (id, delivery_enabled, default_delivery_fee, updated_at)
VALUES ('default', true, 15.00, NOW())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.household_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  address_label TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'مصر',
  governorate_code TEXT,
  governorate_name TEXT NOT NULL,
  markaz_code TEXT,
  markaz_name TEXT NOT NULL,
  detailed_address TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  address_id UUID REFERENCES public.household_addresses(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'مصر',
  governorate_name TEXT NOT NULL,
  markaz_name TEXT NOT NULL,
  detailed_address TEXT NOT NULL,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (
    status IN ('pending_review', 'accepted', 'cancellation_pending', 'cancelled', 'completed')
  ),
  assigned_driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  cancellation_requested_at TIMESTAMPTZ,
  cancellation_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_decided_at TIMESTAMPTZ,
  cancellation_decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_decision_note TEXT,
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  category_id TEXT,
  category_name TEXT,
  quantity TEXT DEFAULT '١',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  old_status TEXT CHECK (
    old_status IS NULL OR old_status IN ('pending_review', 'accepted', 'cancellation_pending', 'cancelled', 'completed')
  ),
  new_status TEXT NOT NULL CHECK (
    new_status IN ('pending_review', 'accepted', 'cancellation_pending', 'cancelled', 'completed')
  ),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_addresses_household ON public.household_addresses(household_id);
CREATE INDEX IF NOT EXISTS idx_drivers_user ON public.delivery_drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_active ON public.delivery_drivers(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_household ON public.delivery_orders(household_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON public.delivery_orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.delivery_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_invoice ON public.delivery_orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.delivery_order_items(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_status_history_order ON public.delivery_order_status_history(delivery_order_id);

-- 4. Enable RLS on Delivery Tables
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_status_history ENABLE ROW LEVEL SECURITY;

-- 5. Delivery Policies
DROP POLICY IF EXISTS "delivery_settings_select_policy" ON public.delivery_settings;
CREATE POLICY "delivery_settings_select_policy"
ON public.delivery_settings FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "delivery_settings_admin_policy" ON public.delivery_settings;
CREATE POLICY "delivery_settings_admin_policy"
ON public.delivery_settings FOR ALL
TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "household_addresses_select_policy" ON public.household_addresses;
CREATE POLICY "household_addresses_select_policy"
ON public.household_addresses FOR SELECT
TO authenticated USING (
  public.is_household_member(household_id) OR public.is_active_driver() OR public.is_system_admin()
);

DROP POLICY IF EXISTS "household_addresses_insert_policy" ON public.household_addresses;
CREATE POLICY "household_addresses_insert_policy"
ON public.household_addresses FOR INSERT
TO authenticated WITH CHECK (
  public.is_household_member(household_id) OR public.is_system_admin()
);

DROP POLICY IF EXISTS "household_addresses_update_policy" ON public.household_addresses;
CREATE POLICY "household_addresses_update_policy"
ON public.household_addresses FOR UPDATE
TO authenticated USING (
  public.is_household_member(household_id) OR public.is_system_admin()
) WITH CHECK (
  public.is_household_member(household_id) OR public.is_system_admin()
);

DROP POLICY IF EXISTS "household_addresses_delete_policy" ON public.household_addresses;
CREATE POLICY "household_addresses_delete_policy"
ON public.household_addresses FOR DELETE
TO authenticated USING (
  public.is_household_member(household_id) OR public.is_system_admin()
);

DROP POLICY IF EXISTS "delivery_drivers_select_policy" ON public.delivery_drivers;
CREATE POLICY "delivery_drivers_select_policy"
ON public.delivery_drivers FOR SELECT
TO authenticated USING (
  user_id = auth.uid() OR public.is_system_admin() OR public.is_active_driver()
);

DROP POLICY IF EXISTS "delivery_drivers_admin_modify_policy" ON public.delivery_drivers;
CREATE POLICY "delivery_drivers_admin_modify_policy"
ON public.delivery_drivers FOR ALL
TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "delivery_orders_select_policy" ON public.delivery_orders;
CREATE POLICY "delivery_orders_select_policy"
ON public.delivery_orders FOR SELECT
TO authenticated USING (
  public.is_household_member(household_id)
  OR assigned_driver_id = public.get_current_driver_id()
  OR (public.is_active_driver() AND status = 'pending_review')
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS "delivery_orders_insert_policy" ON public.delivery_orders;
CREATE POLICY "delivery_orders_insert_policy"
ON public.delivery_orders FOR INSERT
TO authenticated WITH CHECK (
  (public.is_household_member(household_id) AND public.is_delivery_enabled()) OR public.is_system_admin()
);

DROP POLICY IF EXISTS "delivery_orders_update_policy" ON public.delivery_orders;
CREATE POLICY "delivery_orders_update_policy"
ON public.delivery_orders FOR UPDATE
TO authenticated USING (
  public.is_system_admin()
  OR (public.is_active_driver() AND (assigned_driver_id = public.get_current_driver_id() OR status = 'pending_review'))
  OR (public.is_household_member(household_id) AND status = 'pending_review')
) WITH CHECK (
  public.is_system_admin()
  OR (public.is_active_driver() AND (assigned_driver_id = public.get_current_driver_id() OR status = 'pending_review'))
  OR (public.is_household_member(household_id) AND status = 'pending_review')
);

DROP POLICY IF EXISTS "delivery_orders_delete_policy" ON public.delivery_orders;
CREATE POLICY "delivery_orders_delete_policy"
ON public.delivery_orders FOR DELETE
TO authenticated USING (public.is_system_admin());

DROP POLICY IF EXISTS "delivery_order_items_select_policy" ON public.delivery_order_items;
CREATE POLICY "delivery_order_items_select_policy"
ON public.delivery_order_items FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = delivery_order_items.delivery_order_id
      AND (
        public.is_household_member(o.household_id)
        OR o.assigned_driver_id = public.get_current_driver_id()
        OR (public.is_active_driver() AND o.status = 'pending_review')
        OR public.is_system_admin()
      )
  )
);

DROP POLICY IF EXISTS "delivery_order_items_insert_policy" ON public.delivery_order_items;
CREATE POLICY "delivery_order_items_insert_policy"
ON public.delivery_order_items FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = delivery_order_items.delivery_order_id
      AND (public.is_household_member(o.household_id) OR public.is_system_admin())
  )
);

DROP POLICY IF EXISTS "delivery_order_items_modify_policy" ON public.delivery_order_items;
CREATE POLICY "delivery_order_items_modify_policy"
ON public.delivery_order_items FOR ALL
TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "status_history_select_policy" ON public.delivery_order_status_history;
CREATE POLICY "status_history_select_policy"
ON public.delivery_order_status_history FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = delivery_order_status_history.delivery_order_id
      AND (
        public.is_household_member(o.household_id)
        OR o.assigned_driver_id = public.get_current_driver_id()
        OR public.is_system_admin()
      )
  )
);

DROP POLICY IF EXISTS "status_history_insert_policy" ON public.delivery_order_status_history;
CREATE POLICY "status_history_insert_policy"
ON public.delivery_order_status_history FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = delivery_order_status_history.delivery_order_id
      AND (
        public.is_household_member(o.household_id)
        OR o.assigned_driver_id = public.get_current_driver_id()
        OR public.is_system_admin()
      )
  )
);

-- Explicit table permissions for authenticated and anon roles
GRANT ALL ON TABLE public.delivery_orders TO authenticated, anon;
GRANT ALL ON TABLE public.delivery_order_items TO authenticated, anon;
GRANT ALL ON TABLE public.delivery_order_status_history TO authenticated, anon;
GRANT ALL ON TABLE public.household_addresses TO authenticated, anon;
GRANT ALL ON TABLE public.delivery_settings TO authenticated, anon;
GRANT ALL ON TABLE public.delivery_drivers TO authenticated, anon;

-- Unified Security Definer function to request cancellation without permission issues
CREATE OR REPLACE FUNCTION public.request_order_cancellation(
  p_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_order RECORD;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'سبب طلب الإلغاء إجباري');
  END IF;

  SELECT * INTO v_order FROM public.delivery_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب التوصيل غير موجود');
  END IF;

  IF NOT (
    public.is_system_admin()
    OR public.is_household_member(v_order.household_id)
    OR (public.is_active_driver() AND v_order.assigned_driver_id = public.get_current_driver_id())
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'ليس لديك صلاحية لإلغاء هذا الطلب');
  END IF;

  IF v_order.status IN ('cancelled', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'message', 'لا يمكن تقديم طلب إلغاء لطلب ملغي أو مكتمل');
  END IF;

  UPDATE public.delivery_orders
  SET
    status = 'cancellation_pending',
    cancellation_reason = TRIM(p_reason),
    cancellation_requested_at = NOW(),
    cancellation_requested_by = v_uid,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.delivery_order_status_history (
    delivery_order_id,
    old_status,
    new_status,
    changed_by,
    note
  ) VALUES (
    p_order_id,
    v_order.status,
    'cancellation_pending',
    v_uid,
    'طلب إلغاء من المستخدم: ' || TRIM(p_reason)
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب الإلغاء بنجاح وبانتظار موافقة الإدارة');
END;
$func$;

GRANT EXECUTE ON FUNCTION public.request_order_cancellation(UUID, TEXT) TO authenticated, anon;

-- Unified Security Definer function for admin cancellation decision
CREATE OR REPLACE FUNCTION public.admin_decide_cancellation(
  p_order_id UUID,
  p_approve BOOLEAN,
  p_decision_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_order RECORD;
  v_new_status TEXT;
BEGIN
  IF NOT public.is_system_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'فقط مسؤولي النظام يمكنهم اتخاذ قرار الإلغاء');
  END IF;

  SELECT * INTO v_order FROM public.delivery_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
  END IF;

  IF p_approve THEN
    v_new_status := 'cancelled';
  ELSE
    v_new_status := 'pending_review';
  END IF;

  UPDATE public.delivery_orders
  SET
    status = v_new_status,
    cancellation_decision_note = p_decision_note,
    cancellation_decided_at = NOW(),
    cancellation_decided_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.delivery_order_status_history (
    delivery_order_id,
    old_status,
    new_status,
    changed_by,
    note
  ) VALUES (
    p_order_id,
    v_order.status,
    v_new_status,
    auth.uid(),
    CASE WHEN p_approve THEN 'موافقة الإدارة على الإلغاء' ELSE 'رفض الإدارة لطلب الإلغاء' END || COALESCE(': ' || p_decision_note, '')
  );

  RETURN jsonb_build_object('success', true, 'message', CASE WHEN p_approve THEN 'تمت الموافقة على الإلغاء' ELSE 'تم رفض طلب الإلغاء وإعادة الطلب للمراجعة' END);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_decide_cancellation(UUID, BOOLEAN, TEXT) TO authenticated, anon;
`;

export const DELIVERY_SQL_MIGRATION = `-- ==============================================================================
-- TALABAT AL-BAYT (طلبات البيت) — UNIFIED DELIVERY SYSTEM MIGRATION SCRIPT
-- ==============================================================================
-- Use this script in the Supabase SQL Editor to provision the unified delivery system.
` + SUPABASE_SQL_SCHEMA.substring(SUPABASE_SQL_SCHEMA.indexOf('-- ==============================================================================\n-- TALABAT AL-BAYT — UNIFIED DELIVERY SYSTEM EXTENSION'));


package com.talabat.albayt;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/**
 * Native Android Background Sync Worker for Talabat Al-Bayt
 * Executed by Android WorkManager even when WebView / App is closed.
 * Ensures 100% offline-first reliability and automatic sync on connectivity restored.
 */
public class SyncWorker extends Worker {
    private static final String TAG = "TalabatSyncWorker";
    public static final String PREFS_NAME = "talabat_sync_prefs";
    public static final String KEY_PENDING_QUEUE = "pending_queue";
    public static final String KEY_SYNCED_IDS = "synced_ids";
    public static final String KEY_SUPABASE_URL = "supabase_url";
    public static final String KEY_SUPABASE_KEY = "supabase_key";
    public static final String KEY_ACCESS_TOKEN = "access_token";
    public static final String KEY_REFRESH_TOKEN = "refresh_token";
    public static final String KEY_HOUSEHOLD_ID = "household_id";
    public static final String KEY_USER_ID = "user_id";

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Starting native background sync worker execution...");
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String supabaseUrl = prefs.getString(KEY_SUPABASE_URL, null);
        String supabaseKey = prefs.getString(KEY_SUPABASE_KEY, null);
        String accessToken = prefs.getString(KEY_ACCESS_TOKEN, null);
        String pendingQueueStr = prefs.getString(KEY_PENDING_QUEUE, "[]");

        if (supabaseUrl == null || supabaseUrl.trim().isEmpty() || supabaseKey == null || supabaseKey.trim().isEmpty()) {
            Log.w(TAG, "Supabase configuration missing in native preferences. Worker exiting cleanly.");
            return Result.success();
        }

        JSONArray pendingQueue;
        try {
            pendingQueue = new JSONArray(pendingQueueStr);
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse pending queue JSON", e);
            return Result.success();
        }

        if (pendingQueue.length() == 0) {
            Log.d(TAG, "No pending operations in native queue.");
            return Result.success();
        }

        Log.i(TAG, "Processing " + pendingQueue.length() + " pending operations in background...");

        JSONArray remainingQueue = new JSONArray();
        Set<String> newlySyncedIds = new HashSet<>();
        boolean hasNetworkError = false;

        String authBearer = (accessToken != null && !accessToken.trim().isEmpty()) ? accessToken : supabaseKey;
        String refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null);

        for (int i = 0; i < pendingQueue.length(); i++) {
            JSONObject op;
            try {
                op = pendingQueue.getJSONObject(i);
            } catch (Exception e) {
                continue;
            }

            String opId = op.optString("id", "");
            String entity = op.optString("entity", "");
            String type = op.optString("type", "");
            String recordId = op.optString("recordId", "");
            String householdId = op.optString("householdId", "");
            JSONObject payload = op.optJSONObject("payload");
            if (payload == null) {
                payload = new JSONObject();
            }

            int resultCode = 0;
            try {
                resultCode = executeRestOperation(supabaseUrl, supabaseKey, authBearer, entity, type, recordId, householdId, payload);
                if (resultCode == 401 && refreshToken != null && !refreshToken.trim().isEmpty()) {
                    Log.w(TAG, "Auth 401 received. Attempting token refresh via Supabase Auth...");
                    String newAccessToken = refreshSupabaseToken(supabaseUrl, supabaseKey, refreshToken, prefs);
                    if (newAccessToken != null && !newAccessToken.trim().isEmpty()) {
                        authBearer = newAccessToken;
                        resultCode = executeRestOperation(supabaseUrl, supabaseKey, authBearer, entity, type, recordId, householdId, payload);
                    }
                }
            } catch (java.io.IOException netEx) {
                Log.w(TAG, "Network I/O error executing op " + opId + ": " + netEx.getMessage());
                hasNetworkError = true;
                resultCode = -1;
            } catch (Exception ex) {
                Log.e(TAG, "Unexpected error executing op " + opId, ex);
                resultCode = -1;
            }

            boolean success = (resultCode >= 200 && resultCode < 300) || resultCode == 409;

            if (success) {
                Log.d(TAG, "Successfully synced operation: " + opId + " [" + entity + " " + type + "]");
                newlySyncedIds.add(opId);
            } else {
                int retryCount = op.optInt("retryCount", 0) + 1;
                try {
                    op.put("retryCount", retryCount);
                } catch (Exception ignored) {}
                remainingQueue.put(op);
            }
        }

        // Persist updated queue and newly synced IDs in SharedPreferences
        Set<String> existingSynced = new HashSet<>(prefs.getStringSet(KEY_SYNCED_IDS, new HashSet<>()));
        existingSynced.addAll(newlySyncedIds);

        prefs.edit()
                .putString(KEY_PENDING_QUEUE, remainingQueue.toString())
                .putStringSet(KEY_SYNCED_IDS, existingSynced)
                .putLong("last_native_sync_time", System.currentTimeMillis())
                .apply();

        Log.i(TAG, "Background sync finished. Synced: " + newlySyncedIds.size() + ", Remaining: " + remainingQueue.length());

        if (hasNetworkError && remainingQueue.length() > 0) {
            // Tell WorkManager to retry when network is available again
            return Result.retry();
        }

        return Result.success();
    }

    private int executeRestOperation(
            String baseUrl,
            String apiKey,
            String authBearer,
            String entity,
            String type,
            String recordId,
            String householdId,
            JSONObject payload
    ) throws Exception {
        String cleanBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String endpointUrl;
        String httpMethod;
        String preferHeader = "return=minimal";
        JSONObject bodyToSend = null;

        if ("missing_items".equals(entity)) {
            if ("INSERT".equalsIgnoreCase(type) || "UPSERT".equalsIgnoreCase(type)) {
                httpMethod = "POST";
                endpointUrl = cleanBase + "/rest/v1/missing_items?on_conflict=id";
                preferHeader = "resolution=merge-duplicates,return=minimal";

                bodyToSend = new JSONObject();
                bodyToSend.put("id", recordId);
                bodyToSend.put("household_id", householdId);
                bodyToSend.put("name", payload.optString("name", ""));
                bodyToSend.put("category", payload.optString("category", "general"));
                String catAr = payload.optString("categoryArabic", payload.optString("category_arabic", "عام"));
                bodyToSend.put("category_arabic", catAr);
                bodyToSend.put("quantity", payload.optString("quantity", "١"));
                bodyToSend.put("urgency", payload.optString("urgency", "normal"));
                bodyToSend.put("notes", payload.optString("notes", ""));
                bodyToSend.put("added_by", payload.optString("addedBy", payload.optString("added_by", "home")));
                bodyToSend.put("added_by_name", payload.optString("addedByName", payload.optString("added_by_name", "")));
                bodyToSend.put("completed", payload.optBoolean("completed", false));
                bodyToSend.put("added_at", payload.optString("addedAt", payload.optString("added_at", "")));
            } else if ("UPDATE".equalsIgnoreCase(type)) {
                httpMethod = "PATCH";
                endpointUrl = cleanBase + "/rest/v1/missing_items?id=eq." + recordId + "&household_id=eq." + householdId;
                bodyToSend = payload;
            } else if ("DELETE".equalsIgnoreCase(type)) {
                httpMethod = "DELETE";
                endpointUrl = cleanBase + "/rest/v1/missing_items?id=eq." + recordId + "&household_id=eq." + householdId;
            } else {
                return 200; // Ignore unknown
            }
        } else if ("invoices".equals(entity)) {
            if ("INSERT".equalsIgnoreCase(type) || "UPSERT".equalsIgnoreCase(type)) {
                httpMethod = "POST";
                endpointUrl = cleanBase + "/rest/v1/invoices?on_conflict=id";
                preferHeader = "resolution=merge-duplicates,return=minimal";
                bodyToSend = payload;
                bodyToSend.put("id", recordId);
                bodyToSend.put("household_id", householdId);
            } else if ("UPDATE".equalsIgnoreCase(type)) {
                httpMethod = "PATCH";
                endpointUrl = cleanBase + "/rest/v1/invoices?id=eq." + recordId + "&household_id=eq." + householdId;
                bodyToSend = payload;
            } else if ("DELETE".equalsIgnoreCase(type)) {
                httpMethod = "DELETE";
                endpointUrl = cleanBase + "/rest/v1/invoices?id=eq." + recordId + "&household_id=eq." + householdId;
            } else {
                return 200;
            }
        } else if ("categories".equals(entity)) {
            if ("INSERT".equalsIgnoreCase(type) || "UPSERT".equalsIgnoreCase(type)) {
                httpMethod = "POST";
                endpointUrl = cleanBase + "/rest/v1/categories?on_conflict=household_id,id";
                preferHeader = "resolution=merge-duplicates,return=minimal";
                bodyToSend = new JSONObject();
                bodyToSend.put("id", recordId);
                bodyToSend.put("household_id", householdId);
                bodyToSend.put("name_ar", payload.optString("nameAr", payload.optString("name_ar", "")));
                bodyToSend.put("name_en", payload.optString("nameEn", payload.optString("name_en", "")));
                bodyToSend.put("image_url", payload.optString("imageUrl", payload.optString("image_url", "")));
                bodyToSend.put("color", payload.optString("color", "emerald"));
                bodyToSend.put("bg_light", payload.optString("bgLight", payload.optString("bg_light", "")));
                bodyToSend.put("badge_color", payload.optString("badgeColor", payload.optString("badge_color", "")));
                bodyToSend.put("description", payload.optString("description", ""));
                if (payload.has("commonItems")) {
                    bodyToSend.put("common_items", payload.get("commonItems"));
                } else if (payload.has("common_items")) {
                    bodyToSend.put("common_items", payload.get("common_items"));
                } else {
                    bodyToSend.put("common_items", new JSONArray());
                }
                if (payload.has("subcategories")) {
                    bodyToSend.put("subcategories", payload.get("subcategories"));
                } else {
                    bodyToSend.put("subcategories", new JSONArray());
                }
                bodyToSend.put("is_custom", payload.optBoolean("isCustom", payload.optBoolean("is_custom", true)));
            } else if ("UPDATE".equalsIgnoreCase(type)) {
                httpMethod = "PATCH";
                endpointUrl = cleanBase + "/rest/v1/categories?id=eq." + recordId + "&household_id=eq." + householdId;
                bodyToSend = payload;
            } else if ("DELETE".equalsIgnoreCase(type)) {
                httpMethod = "DELETE";
                endpointUrl = cleanBase + "/rest/v1/categories?id=eq." + recordId + "&household_id=eq." + householdId;
            } else {
                return 200;
            }
        } else if ("notifications".equals(entity)) {
            if ("INSERT".equalsIgnoreCase(type) || "UPSERT".equalsIgnoreCase(type)) {
                httpMethod = "POST";
                endpointUrl = cleanBase + "/rest/v1/notifications?on_conflict=id";
                preferHeader = "resolution=merge-duplicates,return=minimal";
                bodyToSend = payload;
                bodyToSend.put("id", recordId);
                bodyToSend.put("household_id", householdId);
            } else {
                return 200;
            }
        } else {
            // For other entities, default to upsert on id
            httpMethod = "POST";
            endpointUrl = cleanBase + "/rest/v1/" + entity + "?on_conflict=id";
            preferHeader = "resolution=merge-duplicates,return=minimal";
            bodyToSend = payload;
            bodyToSend.put("id", recordId);
            bodyToSend.put("household_id", householdId);
        }

        URL url = new URL(endpointUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(httpMethod);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setRequestProperty("apikey", apiKey);
        conn.setRequestProperty("Authorization", "Bearer " + authBearer);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Prefer", preferHeader);

        if (bodyToSend != null && ("POST".equals(httpMethod) || "PATCH".equals(httpMethod) || "PUT".equals(httpMethod))) {
            conn.setDoOutput(true);
            byte[] bytes = bodyToSend.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
                os.flush();
            }
        }

        int responseCode = conn.getResponseCode();
        Log.d(TAG, "Supabase REST response for " + entity + " [" + httpMethod + "]: " + responseCode);

        // Read error body for debugging if error
        if (responseCode >= 400 && responseCode != 409) {
            try (InputStream errStream = conn.getErrorStream()) {
                if (errStream != null) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(errStream, StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    Log.w(TAG, "Supabase HTTP " + responseCode + " error: " + sb.toString());
                }
            } catch (Exception ignored) {}
        }

        conn.disconnect();
        return responseCode;
    }

    private String refreshSupabaseToken(String baseUrl, String apiKey, String refreshToken, SharedPreferences prefs) {
        try {
            String cleanBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
            String refreshUrl = cleanBase + "/auth/v1/token?grant_type=refresh_token";
            URL url = new URL(refreshUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("apikey", apiKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            JSONObject reqBody = new JSONObject();
            reqBody.put("refresh_token", refreshToken);
            byte[] bytes = reqBody.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
                os.flush();
            }

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                try (InputStream is = conn.getInputStream()) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    JSONObject resObj = new JSONObject(sb.toString());
                    String newAccessToken = resObj.optString("access_token", null);
                    String newRefreshToken = resObj.optString("refresh_token", null);
                    if (newAccessToken != null && !newAccessToken.isEmpty()) {
                        SharedPreferences.Editor ed = prefs.edit();
                        ed.putString(KEY_ACCESS_TOKEN, newAccessToken);
                        if (newRefreshToken != null && !newRefreshToken.isEmpty()) {
                            ed.putString(KEY_REFRESH_TOKEN, newRefreshToken);
                        }
                        ed.apply();
                        Log.i(TAG, "Successfully refreshed Supabase access token in native background sync");
                        conn.disconnect();
                        return newAccessToken;
                    }
                }
            } else {
                Log.w(TAG, "Failed to refresh Supabase token in native worker. Code: " + code);
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "Exception during native token refresh", e);
        }
        return null;
    }
}

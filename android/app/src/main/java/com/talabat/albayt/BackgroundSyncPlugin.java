package com.talabat.albayt;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import java.util.HashSet;
import java.util.Set;

/**
 * Capacitor Plugin: BackgroundSync
 * Bridges JavaScript SyncManager with Android Jetpack WorkManager.
 */
@CapacitorPlugin(name = "BackgroundSync")
public class BackgroundSyncPlugin extends Plugin {

    @PluginMethod
    public void scheduleSync(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE);

        String supabaseUrl = call.getString("supabaseUrl", "");
        String supabaseKey = call.getString("supabaseKey", "");
        String accessToken = call.getString("accessToken", "");
        String refreshToken = call.getString("refreshToken", "");
        String userId = call.getString("userId", "");
        String householdId = call.getString("householdId", "");
        JSArray queue = call.getArray("queue", new JSArray());

        SharedPreferences.Editor editor = prefs.edit();
        if (supabaseUrl != null && !supabaseUrl.isEmpty()) {
            editor.putString(SyncWorker.KEY_SUPABASE_URL, supabaseUrl);
        }
        if (supabaseKey != null && !supabaseKey.isEmpty()) {
            editor.putString(SyncWorker.KEY_SUPABASE_KEY, supabaseKey);
        }
        if (accessToken != null && !accessToken.isEmpty()) {
            editor.putString(SyncWorker.KEY_ACCESS_TOKEN, accessToken);
        }
        if (refreshToken != null && !refreshToken.isEmpty()) {
            editor.putString(SyncWorker.KEY_REFRESH_TOKEN, refreshToken);
        }
        if (userId != null && !userId.isEmpty()) {
            editor.putString(SyncWorker.KEY_USER_ID, userId);
        }
        if (householdId != null && !householdId.isEmpty()) {
            editor.putString(SyncWorker.KEY_HOUSEHOLD_ID, householdId);
        }

        if (queue != null) {
            editor.putString(SyncWorker.KEY_PENDING_QUEUE, queue.toString());
        }
        editor.apply();

        // Enqueue WorkManager background tasks
        BackgroundSyncManager.scheduleOneTimeSync(context);
        BackgroundSyncManager.schedulePeriodicSync(context);

        JSObject res = new JSObject();
        res.put("scheduled", true);
        res.put("count", queue != null ? queue.length() : 0);
        call.resolve(res);
    }

    @PluginMethod
    public void getSyncedOperations(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE);

        Set<String> syncedIds = prefs.getStringSet(SyncWorker.KEY_SYNCED_IDS, new HashSet<>());
        JSArray arr = new JSArray();
        for (String id : syncedIds) {
            arr.put(id);
        }

        JSObject res = new JSObject();
        res.put("syncedIds", arr);
        call.resolve(res);
    }

    @PluginMethod
    public void clearSyncedOperations(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putStringSet(SyncWorker.KEY_SYNCED_IDS, new HashSet<>()).apply();

        JSObject res = new JSObject();
        res.put("cleared", true);
        call.resolve(res);
    }

    @PluginMethod
    public void getNativeStatus(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE);

        String pendingQueueStr = prefs.getString(SyncWorker.KEY_PENDING_QUEUE, "[]");
        int count = 0;
        try {
            JSONArray arr = new JSONArray(pendingQueueStr);
            count = arr.length();
        } catch (Exception ignored) {}

        long lastSync = prefs.getLong("last_native_sync_time", 0);

        JSObject res = new JSObject();
        res.put("pendingCount", count);
        res.put("lastNativeSyncTime", lastSync);
        call.resolve(res);
    }
}

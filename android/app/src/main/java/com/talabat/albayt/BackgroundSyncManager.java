package com.talabat.albayt;

import android.content.Context;
import android.util.Log;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

/**
 * Helper to schedule and manage native Android background synchronization via Jetpack WorkManager.
 */
public class BackgroundSyncManager {
    private static final String TAG = "TalabatSyncMgr";
    public static final String UNIQUE_ONE_TIME_WORK = "talabat_one_time_sync";
    public static final String UNIQUE_PERIODIC_WORK = "talabat_periodic_sync";

    /**
     * Schedules an immediate background sync when network is connected.
     * Android OS triggers this automatically as soon as internet is available,
     * even if the app process has been terminated.
     */
    public static void scheduleOneTimeSync(Context context) {
        try {
            Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();

            OneTimeWorkRequest syncRequest = new OneTimeWorkRequest.Builder(SyncWorker.class)
                    .setConstraints(constraints)
                    .addTag("talabat-sync")
                    .build();

            WorkManager.getInstance(context).enqueueUniqueWork(
                    UNIQUE_ONE_TIME_WORK,
                    ExistingWorkPolicy.REPLACE,
                    syncRequest
            );
            Log.d(TAG, "Enqueued unique one-time background sync request with network constraints.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule background sync with WorkManager", e);
        }
    }

    /**
     * Schedules a periodic backup sync worker (every 15 minutes) with network constraints.
     */
    public static void schedulePeriodicSync(Context context) {
        try {
            Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();

            PeriodicWorkRequest periodicRequest = new PeriodicWorkRequest.Builder(
                    SyncWorker.class,
                    15,
                    TimeUnit.MINUTES
            )
                    .setConstraints(constraints)
                    .addTag("talabat-periodic-sync")
                    .build();

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                    UNIQUE_PERIODIC_WORK,
                    androidx.work.ExistingPeriodicWorkPolicy.KEEP,
                    periodicRequest
            );
            Log.d(TAG, "Enqueued periodic background sync request.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule periodic sync with WorkManager", e);
        }
    }
}

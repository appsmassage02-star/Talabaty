import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  Token,
  RegistrationError,
  PushNotificationSchema,
  ActionPerformed,
  Channel,
} from "@capacitor/push-notifications";

export interface FCMNotificationPayload {
  id?: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
}

export interface FCMServiceCallbacks {
  onTokenReceived?: (token: string) => void;
  onNotificationReceived?: (notification: FCMNotificationPayload) => void;
  onNotificationActionPerformed?: (action: FCMNotificationPayload) => void;
  onError?: (error: any) => void;
}

class FCMService {
  private isInitialized = false;
  private currentToken: string | null = null;
  private listeners: { remove: () => Promise<void> }[] = [];

  /**
   * Returns current cached FCM token in memory or localStorage
   */
  public getStoredToken(): string | null {
    if (this.currentToken) return this.currentToken;
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("fcm_device_token");
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Initializes FCM listeners and registers device on native Android/iOS platforms.
   * Safe to call on Web/Desktop (will gracefully no-op).
   */
  public async init(callbacks: FCMServiceCallbacks = {}): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log("[FCMService] Running on non-native platform (Web/PWA). FCM Native plugin is bypassed.");
      return false;
    }

    if (this.isInitialized) {
      console.log("[FCMService] Already initialized.");
      if (this.currentToken && callbacks.onTokenReceived) {
        callbacks.onTokenReceived(this.currentToken);
      }
      return true;
    }

    try {
      console.log("[FCMService] Checking push notification permissions...");
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === "prompt" || permStatus.receive === "prompt-with-rationale") {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== "granted") {
        console.warn("[FCMService] Push notification permission not granted. Status:", permStatus.receive);
        return false;
      }

      // Android 8.0+ Channel setup
      if (Capacitor.getPlatform() === "android") {
        try {
          const defaultChannel: Channel = {
            id: "talabati_default_channel",
            name: "إشعارات طلباتي",
            description: "قناة استقبال إشعارات طلبات وتحديثات المنزل",
            importance: 5, // High importance
            visibility: 1, // Public
            vibration: true,
            sound: "default",
          };
          await PushNotifications.createChannel(defaultChannel);
          console.log("[FCMService] Notification channel created/verified on Android.");
        } catch (channelErr) {
          console.warn("[FCMService] Warning creating notification channel:", channelErr);
        }
      }

      // 1. Registration Success Listener (FCM Device Token)
      const regListener = await PushNotifications.addListener(
        "registration",
        (token: Token) => {
          console.log("[FCMService] Device registered with FCM token:", token.value);
          this.currentToken = token.value;
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem("fcm_device_token", token.value);
            }
          } catch {}

          if (callbacks.onTokenReceived) {
            callbacks.onTokenReceived(token.value);
          }
        }
      );
      this.listeners.push(regListener);

      // 2. Registration Error Listener
      const errListener = await PushNotifications.addListener(
        "registrationError",
        (error: RegistrationError) => {
          console.error("[FCMService] FCM Registration error:", error);
          if (callbacks.onError) {
            callbacks.onError(error);
          }
        }
      );
      this.listeners.push(errListener);

      // 3. Foreground Push Notification Received Listener
      const receiveListener = await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification: PushNotificationSchema) => {
          console.log("[FCMService] Foreground push notification received:", notification);
          const payload: FCMNotificationPayload = {
            id: notification.id,
            title: notification.title || "",
            body: notification.body || "",
            data: notification.data || {},
          };

          if (callbacks.onNotificationReceived) {
            callbacks.onNotificationReceived(payload);
          }
        }
      );
      this.listeners.push(receiveListener);

      // 4. Notification Action Performed Listener (User tapped on system notification)
      const actionListener = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action: ActionPerformed) => {
          console.log("[FCMService] Notification action performed (tapped):", action);
          const notification = action.notification;
          const payload: FCMNotificationPayload = {
            id: notification.id,
            title: notification.title || "",
            body: notification.body || "",
            data: notification.data || {},
          };

          if (callbacks.onNotificationActionPerformed) {
            callbacks.onNotificationActionPerformed(payload);
          }
        }
      );
      this.listeners.push(actionListener);

      // Register device with APNs/FCM
      await PushNotifications.register();
      this.isInitialized = true;
      console.log("[FCMService] PushNotifications.register() called successfully.");
      return true;
    } catch (err) {
      console.error("[FCMService] Failed to initialize FCM:", err);
      if (callbacks.onError) {
        callbacks.onError(err);
      }
      return false;
    }
  }

  /**
   * Cleanup listeners on unmount
   */
  public async destroy(): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener.remove();
      } catch {}
    }
    this.listeners = [];
    this.isInitialized = false;
  }
}

export const fcmService = new FCMService();

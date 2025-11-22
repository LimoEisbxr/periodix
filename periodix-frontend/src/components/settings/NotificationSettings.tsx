import { useState, useEffect } from 'react';
import NotificationTimeScopeSelector from './NotificationTimeScopeSelector';
import type {
    User,
    NotificationSettings as NotificationSettingsType,
} from '../../types';
import {
    getNotificationSettings,
    updateNotificationSettings,
    subscribeToPushNotifications as apiSubscribeToPush,
    unsubscribeFromPushNotifications as apiUnsubscribeFromPush,
    getVapidPublicKey,
} from '../../api';
import {
    requestNotificationPermission,
    getNotificationPermission,
    isNotificationSupported,
    isStandalonePWA,
    isIOS,
    getiOSVersion,
    isServiceWorkerSupported,
    subscribeToPushNotifications as utilsSubscribeToPush,
    getDeviceType,
} from '../../utils/notifications';

interface NotificationSettingsProps {
    token: string;
    user: User;
    isVisible: boolean;
}

export default function NotificationSettings({
    token,
    user,
    isVisible,
}: NotificationSettingsProps) {
    type DevicePrefs = NonNullable<
        NotificationSettingsType['devicePreferences']
    >;
    interface DevicePrefEntry {
        upcomingLessonsEnabled?: boolean; // default off
        cancelledLessonsEnabled?: boolean; // default follows global
        irregularLessonsEnabled?: boolean; // default follows global
        timetableChangesEnabled?: boolean; // default follows global
        accessRequestsEnabled?: boolean; // default follows global
        absencesEnabled?: boolean; // default follows global
        [key: string]: unknown;
    }
    // Notification settings state
    const [notificationSettings, setNotificationSettings] =
        useState<NotificationSettingsType | null>(null);
    // Preserve device preferences across global disable/enable cycles
    type DevicePrefsRecord = Record<string, DevicePrefEntry>;
    const [savedDevicePrefs, setSavedDevicePrefs] =
        useState<DevicePrefsRecord | null>(null);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [notificationError, setNotificationError] = useState<string | null>(
        null
    );
    const [notificationPermission, setNotificationPermission] = useState(
        getNotificationPermission()
    );
    // Prevent rapid double toggles / race conditions when enabling/disabling
    const [toggleInFlight, setToggleInFlight] = useState(false);
    // Per-device upcoming reminder state
    const [endpoint, setEndpoint] = useState<string | null>(null);
    const [deviceToggleBusy, setDeviceToggleBusy] = useState(false);
    const [deviceToggleError, setDeviceToggleError] = useState<string | null>(
        null
    );

    // Derived notification gating (iOS / PWA constraints)
    const iosVersion = getiOSVersion();
    const iosNeedsInstall = isIOS() && !isStandalonePWA();
    // iOS < 16 can't do web push (we use 16 baseline though push really 16.4+; keep messaging simple)
    const iosTooOld = isIOS() && !!iosVersion && iosVersion < 16;

    // Track if we've attempted to request permission (persisted) to distinguish true denial vs never asked
    const [permissionAttempted, setPermissionAttempted] = useState<boolean>(
        () => {
            try {
                return (
                    localStorage.getItem('notificationPermissionAttempted') ===
                    '1'
                );
            } catch {
                return false;
            }
        }
    );

    // Whether we should show the Enable button (allow retry if we believe never actually prompted)
    const canShowPermissionButton =
        (notificationPermission === 'default' ||
            (notificationPermission === 'denied' && !permissionAttempted)) &&
        !iosNeedsInstall &&
        !iosTooOld;

    // Check if user can toggle notifications (has permission and setting is enabled)
    const canToggleNotifications =
        notificationPermission === 'granted' &&
        notificationSettings?.browserNotificationsEnabled !== undefined;

    const notificationPermissionMessage = () => {
        if (!isNotificationSupported())
            return 'Notifications not supported in this browser.';
        if (notificationPermission === 'granted')
            return 'Notifications enabled.';
        if (notificationPermission === 'denied') {
            if (isIOS()) {
                if (iosNeedsInstall) {
                    return 'Install first (Share > Add to Home Screen), then open the app and tap Enable.';
                }
                // Allow re-asking on mobile/iOS even if previously denied
                return 'Tap Enable to request notification permission again.';
            }
            // Allow re-asking on other platforms too
            return 'Click Enable to request notification permission.';
        }
        // permission === 'default'
        if (iosTooOld) return 'Update iOS (>=16) to enable push notifications.';
        if (iosNeedsInstall)
            return 'Install first (Share > Add to Home Screen), then open and tap Enable.';
        return 'Click Enable to allow notifications.';
    };

    // Load notification settings when component becomes visible
    useEffect(() => {
        if (!isVisible) return;
        loadNotificationSettings();
    }, [isVisible, token]); // eslint-disable-line react-hooks/exhaustive-deps

    // Resolve current device's push endpoint for per-device preferences
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (!isServiceWorkerSupported()) {
                    if (!cancelled) setEndpoint(null);
                    return;
                }
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (!cancelled) setEndpoint(sub?.endpoint ?? null);
            } catch {
                if (!cancelled) setEndpoint(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isVisible, notificationPermission]);

    const loadNotificationSettings = async () => {
        setNotificationLoading(true);
        setNotificationError(null);
        try {
            const data = await getNotificationSettings(token);
            setNotificationSettings(data.settings);
            try {
                localStorage.setItem(
                    'periodix:notificationSettings',
                    JSON.stringify(data.settings)
                );
            } catch {
                // ignore localStorage failures
            }
        } catch (e) {
            setNotificationError(
                e instanceof Error
                    ? e.message
                    : 'Failed to load notification settings'
            );
        } finally {
            setNotificationLoading(false);
        }
    };

    const handleUpdateNotificationSettings = async (
        updates: Partial<NotificationSettingsType>
    ) => {
        if (!notificationSettings) return;
        try {
            // Optimistic functional update avoids stale closure issues
            setNotificationSettings((prev) =>
                prev
                    ? ({ ...prev, ...updates } as NotificationSettingsType)
                    : prev
            );

            const apiPayload: Partial<NotificationSettingsType> = {};
            Object.entries(updates).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    (apiPayload as Record<string, unknown>)[key] = value;
                }
            });

            const resp = await updateNotificationSettings(token, apiPayload);
            if (resp?.settings) {
                setNotificationSettings(resp.settings);
                try {
                    localStorage.setItem(
                        'periodix:notificationSettings',
                        JSON.stringify(resp.settings)
                    );
                } catch {
                    // ignore localStorage failures
                }
            }
        } catch (e) {
            await loadNotificationSettings();
            setNotificationError(
                e instanceof Error ? e.message : 'Failed to update settings'
            );
        }
    };

    const ensurePushSubscription = async (): Promise<boolean> => {
        try {
            // Get VAPID public key from backend
            const { publicKey } = await getVapidPublicKey();

            // Subscribe to push notifications using utility
            const subscription = await utilsSubscribeToPush(publicKey);

            if (subscription) {
                await apiSubscribeToPush(token, {
                    endpoint: subscription.endpoint,
                    p256dh: btoa(
                        String.fromCharCode(
                            ...new Uint8Array(subscription.getKey('p256dh')!)
                        )
                    ),
                    auth: btoa(
                        String.fromCharCode(
                            ...new Uint8Array(subscription.getKey('auth')!)
                        )
                    ),
                    // Extra metadata to help backend segment devices and debug
                    userAgent: navigator.userAgent,
                    deviceType: getDeviceType(),
                });
                return true;
            }
            return false;
        } catch {
            return false; // Non-fatal; we'll fall back to browser notifications only
        }
    };

    const handleRequestPermission = async () => {
        setNotificationLoading(true);
        setNotificationError(null);

        try {
            // For mobile PWA, we need to be more persistent about permission requests
            const isMobilePWA =
                isStandalonePWA() && (getDeviceType() === 'mobile' || isIOS());

            // Reset permission attempted flag to allow re-asking
            setPermissionAttempted(false);
            try {
                localStorage.removeItem('notificationPermissionAttempted');
            } catch {
                // Ignore localStorage errors
            }

            // On mobile PWA, add a small delay to ensure the UI is ready
            if (isMobilePWA) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            const permission = await requestNotificationPermission();
            setNotificationPermission(permission);

            // Mark that we've attempted permission
            setPermissionAttempted(true);
            try {
                localStorage.setItem('notificationPermissionAttempted', '1');
            } catch {
                // Ignore localStorage errors
            }

            if (permission === 'granted') {
                // Enable browser notifications automatically when permission is granted
                await handleUpdateNotificationSettings({
                    browserNotificationsEnabled: true,
                });

                // Try to set up push notifications where supported.
                // iOS requires installed PWA; other platforms work in browser tabs too.
                const canAttemptPush =
                    isServiceWorkerSupported() &&
                    !iosTooOld &&
                    (!isIOS() || isStandalonePWA());
                if (canAttemptPush) {
                    try {
                        await ensurePushSubscription();
                        await handleUpdateNotificationSettings({
                            pushNotificationsEnabled: true,
                        });
                    } catch (pushError) {
                        console.warn(
                            'Push notification setup failed on mobile PWA:',
                            pushError
                        );
                        // Don't throw here, browser notifications are still working
                    }
                }
            }
        } catch (e) {
            setNotificationError(
                e instanceof Error
                    ? e.message
                    : 'Failed to request notification permission'
            );
        } finally {
            setNotificationLoading(false);
        }
    };

    // Intelligent notification toggle - single API update to avoid flicker & race
    const handleToggleNotifications = async (enabled: boolean) => {
        if (!notificationSettings || toggleInFlight) return;
        setToggleInFlight(true);
        try {
            if (enabled) {
                // If re-enabling and we previously saved device prefs, merge them back optimistically
                if (
                    savedDevicePrefs &&
                    notificationSettings.devicePreferences
                ) {
                    setNotificationSettings((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  devicePreferences: {
                                      ...savedDevicePrefs,
                                      ...prev.devicePreferences,
                                  },
                              }
                            : prev
                    );
                } else if (savedDevicePrefs) {
                    setNotificationSettings((prev) =>
                        prev
                            ? { ...prev, devicePreferences: savedDevicePrefs }
                            : prev
                    );
                }
                // Ensure permission first
                let currentPermission = notificationPermission;
                if (currentPermission !== 'granted') {
                    currentPermission = await requestNotificationPermission();
                    setNotificationPermission(currentPermission);
                    if (currentPermission !== 'granted') {
                        throw new Error('Notification permission required');
                    }
                }

                // Attempt push subscription BEFORE settings update so we can send a single update call
                let pushOK = false;
                const canAttemptPush =
                    isServiceWorkerSupported() &&
                    !iosTooOld &&
                    (!isIOS() || isStandalonePWA());
                if (canAttemptPush) {
                    pushOK = await ensurePushSubscription();
                }

                // Single merged update (optimistic inside handler)
                await handleUpdateNotificationSettings({
                    browserNotificationsEnabled: true,
                    pushNotificationsEnabled: pushOK,
                });
                // Reload from server so we reflect any server-side merging logic
                await loadNotificationSettings();
            } else {
                // DO NOT unsubscribe push subscription so that the endpoint (and stored devicePreferences) remain stable.
                // Simply mark push/browser notifications disabled; backend will skip sending while flags are false.
                // We still snapshot locally in case of unforeseen state changes.
                try {
                    if (notificationSettings?.devicePreferences) {
                        setSavedDevicePrefs(
                            notificationSettings.devicePreferences as DevicePrefsRecord
                        );
                    }
                } catch {
                    // ignore snapshot errors
                }
                // Persist master disable flags (DB row will remain; devicePreferences intentionally untouched)
                await handleUpdateNotificationSettings({
                    browserNotificationsEnabled: false,
                    pushNotificationsEnabled: false,
                });
                // Best-effort: mark current subscription inactive server-side while KEEPING endpoint & prefs.
                // We do NOT call subscription.unsubscribe() so that on re-enable the same endpoint (and its stored devicePreferences) still matches.
                try {
                    if (endpoint) {
                        await apiUnsubscribeFromPush(token, endpoint);
                    }
                } catch (unsubscribeErr) {
                    // Non-fatal; logging to console only to avoid user-facing noise
                    console.warn(
                        'Failed to mark push subscription inactive:',
                        unsubscribeErr
                    );
                }
                // After disabling, force a fresh load to reflect true persisted state
                await loadNotificationSettings();
            }
        } catch (e) {
            setNotificationError(
                e instanceof Error
                    ? e.message
                    : 'Failed to update notification settings'
            );
            await loadNotificationSettings();
        } finally {
            setToggleInFlight(false);
        }
    };

    if (!isNotificationSupported()) {
        return null; // Don't render anything if notifications aren't supported
    }

    // Remove conditional rendering since we handle visibility in parent

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">
                        Notifications
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {notificationPermission === 'granted'
                            ? isStandalonePWA()
                                ? 'Push notifications active'
                                : 'Browser notifications active'
                            : notificationPermissionMessage()}
                    </p>
                </div>

                {canShowPermissionButton ||
                notificationPermission === 'denied' ? (
                    <button
                        onClick={handleRequestPermission}
                        disabled={notificationLoading}
                        className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md disabled:opacity-60 disabled:cursor-not-allowed hover:bg-indigo-500 disabled:hover:bg-indigo-600"
                    >
                        {notificationLoading ? 'Enabling…' : 'Enable'}
                    </button>
                ) : (
                    canToggleNotifications && (
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={
                                    notificationSettings?.browserNotificationsEnabled ||
                                    false
                                }
                                onChange={(e) =>
                                    handleToggleNotifications(e.target.checked)
                                }
                                disabled={toggleInFlight || notificationLoading}
                                className="sr-only peer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    )
                )}
            </div>

            {notificationError && (
                <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {notificationError}
                </div>
            )}

            {/* Notification type preferences */}
            {notificationPermission === 'granted' &&
                notificationSettings?.browserNotificationsEnabled && (
                    <div className="space-y-3 ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700 mt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Cancelled lessons
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Get notified when lessons are cancelled
                                    (this device)
                                </p>
                                {/* Day/Week scope selector */}
                                {(() => {
                                    const ep = endpoint ?? '';
                                    const prefs: DevicePrefs =
                                        (notificationSettings?.devicePreferences ??
                                            {}) as DevicePrefs;
                                    const entry = ep
                                        ? (prefs[ep] as
                                              | DevicePrefEntry
                                              | undefined)
                                        : undefined;
                                    const globalOn =
                                        notificationSettings?.cancelledLessonsEnabled ??
                                        true;
                                    const perDevice =
                                        entry?.cancelledLessonsEnabled as
                                            | boolean
                                            | undefined;
                                    const enabled =
                                        perDevice === undefined
                                            ? globalOn
                                            : perDevice === true;
                                    return (
                                        <NotificationTimeScopeSelector
                                            name="cancelledScope"
                                            value={
                                                notificationSettings?.cancelledLessonsTimeScope
                                            }
                                            onChange={(val) =>
                                                handleUpdateNotificationSettings(
                                                    {
                                                        cancelledLessonsTimeScope:
                                                            val,
                                                    }
                                                )
                                            }
                                            disabled={!enabled}
                                        />
                                    );
                                })()}
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(() => {
                                        const ep = endpoint ?? '';
                                        const prefs: DevicePrefs =
                                            (notificationSettings?.devicePreferences ??
                                                {}) as DevicePrefs;
                                        const entry = ep
                                            ? (prefs[ep] as
                                                  | DevicePrefEntry
                                                  | undefined)
                                            : undefined;
                                        // default is global true unless explicitly disabled at device level
                                        const globalOn =
                                            notificationSettings?.cancelledLessonsEnabled ??
                                            true;
                                        const perDevice =
                                            entry?.cancelledLessonsEnabled as
                                                | boolean
                                                | undefined;
                                        return perDevice === undefined
                                            ? globalOn
                                            : perDevice === true;
                                    })()}
                                    onChange={async (e) => {
                                        setDeviceToggleError(null);
                                        setDeviceToggleBusy(true);
                                        try {
                                            let ep = endpoint;
                                            if (!ep) {
                                                const ok =
                                                    await ensurePushSubscription();
                                                if (!ok)
                                                    throw new Error(
                                                        'Push subscription required'
                                                    );
                                                const reg = await navigator
                                                    .serviceWorker.ready;
                                                const sub =
                                                    await reg.pushManager.getSubscription();
                                                ep = sub?.endpoint ?? null;
                                                setEndpoint(ep);
                                            }
                                            if (!ep)
                                                throw new Error(
                                                    'No device endpoint available'
                                                );
                                            const prefs: DevicePrefs =
                                                (notificationSettings?.devicePreferences ??
                                                    {}) as DevicePrefs;
                                            const current = (prefs[ep] ??
                                                {}) as Record<string, unknown>;
                                            const nextPrefs: DevicePrefs = {
                                                ...prefs,
                                                [ep]: {
                                                    ...current,
                                                    cancelledLessonsEnabled:
                                                        e.target.checked,
                                                } as DevicePrefEntry,
                                            };
                                            await handleUpdateNotificationSettings(
                                                { devicePreferences: nextPrefs }
                                            );
                                        } catch (err) {
                                            setDeviceToggleError(
                                                err instanceof Error
                                                    ? err.message
                                                    : 'Failed to update device setting'
                                            );
                                        } finally {
                                            setDeviceToggleBusy(false);
                                        }
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Irregular lessons
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Get notified when lesson times, rooms, or
                                    teachers change (this device)
                                </p>
                                {/* Day/Week scope selector */}
                                {(() => {
                                    const ep = endpoint ?? '';
                                    const prefs: DevicePrefs =
                                        (notificationSettings?.devicePreferences ??
                                            {}) as DevicePrefs;
                                    const entry = ep
                                        ? (prefs[ep] as
                                              | DevicePrefEntry
                                              | undefined)
                                        : undefined;
                                    const globalOn =
                                        notificationSettings?.irregularLessonsEnabled ??
                                        true;
                                    const perDevice =
                                        entry?.irregularLessonsEnabled as
                                            | boolean
                                            | undefined;
                                    const enabled =
                                        perDevice === undefined
                                            ? globalOn
                                            : perDevice === true;
                                    return (
                                        <NotificationTimeScopeSelector
                                            name="irregularScope"
                                            value={
                                                notificationSettings?.irregularLessonsTimeScope
                                            }
                                            onChange={(val) =>
                                                handleUpdateNotificationSettings(
                                                    {
                                                        irregularLessonsTimeScope:
                                                            val,
                                                    }
                                                )
                                            }
                                            disabled={!enabled}
                                        />
                                    );
                                })()}
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(() => {
                                        const ep = endpoint ?? '';
                                        const prefs: DevicePrefs =
                                            (notificationSettings?.devicePreferences ??
                                                {}) as DevicePrefs;
                                        const entry = ep
                                            ? (prefs[ep] as
                                                  | DevicePrefEntry
                                                  | undefined)
                                            : undefined;
                                        const globalOn =
                                            notificationSettings?.irregularLessonsEnabled ??
                                            true;
                                        const perDevice =
                                            entry?.irregularLessonsEnabled as
                                                | boolean
                                                | undefined;
                                        return perDevice === undefined
                                            ? globalOn
                                            : perDevice === true;
                                    })()}
                                    onChange={async (e) => {
                                        setDeviceToggleError(null);
                                        setDeviceToggleBusy(true);
                                        try {
                                            let ep = endpoint;
                                            if (!ep) {
                                                const ok =
                                                    await ensurePushSubscription();
                                                if (!ok)
                                                    throw new Error(
                                                        'Push subscription required'
                                                    );
                                                const reg = await navigator
                                                    .serviceWorker.ready;
                                                const sub =
                                                    await reg.pushManager.getSubscription();
                                                ep = sub?.endpoint ?? null;
                                                setEndpoint(ep);
                                            }
                                            if (!ep)
                                                throw new Error(
                                                    'No device endpoint available'
                                                );
                                            const prefs: DevicePrefs =
                                                (notificationSettings?.devicePreferences ??
                                                    {}) as DevicePrefs;
                                            const current = (prefs[ep] ??
                                                {}) as Record<string, unknown>;
                                            const nextPrefs: DevicePrefs = {
                                                ...prefs,
                                                [ep]: {
                                                    ...current,
                                                    irregularLessonsEnabled:
                                                        e.target.checked,
                                                } as DevicePrefEntry,
                                            };
                                            await handleUpdateNotificationSettings(
                                                { devicePreferences: nextPrefs }
                                            );
                                        } catch (err) {
                                            setDeviceToggleError(
                                                err instanceof Error
                                                    ? err.message
                                                    : 'Failed to update device setting'
                                            );
                                        } finally {
                                            setDeviceToggleBusy(false);
                                        }
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {/* Upcoming lessons (Beta) — per device toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Upcoming lessons (Beta)
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Reminder 5 minutes before your next lesson
                                    on this device; irregular changes
                                    highlighted
                                </p>
                                {!endpoint && (
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                        Enable notifications to activate
                                        per-device reminders.
                                    </p>
                                )}
                                {deviceToggleError && (
                                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                                        {deviceToggleError}
                                    </p>
                                )}
                            </div>
                            <label
                                className={`relative inline-flex items-center ${
                                    notificationPermission !== 'granted' ||
                                    !notificationSettings?.browserNotificationsEnabled
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'cursor-pointer'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={(() => {
                                        const ep = endpoint ?? '';
                                        const prefs: DevicePrefs =
                                            (notificationSettings?.devicePreferences ??
                                                {}) as DevicePrefs;
                                        const entry = ep
                                            ? (prefs[ep] as
                                                  | DevicePrefEntry
                                                  | undefined)
                                            : undefined;
                                        return !!(
                                            entry &&
                                            entry.upcomingLessonsEnabled ===
                                                true
                                        );
                                    })()}
                                    onChange={async (e) => {
                                        if (
                                            notificationPermission !==
                                                'granted' ||
                                            !notificationSettings?.browserNotificationsEnabled
                                        )
                                            return;
                                        setDeviceToggleError(null);
                                        setDeviceToggleBusy(true);
                                        try {
                                            let ep = endpoint;
                                            if (!ep) {
                                                const ok =
                                                    await ensurePushSubscription();
                                                if (!ok)
                                                    throw new Error(
                                                        'Push subscription required'
                                                    );
                                                try {
                                                    const reg = await navigator
                                                        .serviceWorker.ready;
                                                    const sub =
                                                        await reg.pushManager.getSubscription();
                                                    ep = sub?.endpoint ?? null;
                                                    setEndpoint(ep);
                                                } catch {
                                                    // ignore
                                                }
                                            }
                                            if (!ep)
                                                throw new Error(
                                                    'No device endpoint available'
                                                );

                                            const prefs: DevicePrefs =
                                                (notificationSettings?.devicePreferences ??
                                                    {}) as DevicePrefs;
                                            const current = (prefs[ep] ??
                                                {}) as Record<string, unknown>;
                                            const nextPrefs: DevicePrefs = {
                                                ...prefs,
                                                [ep]: {
                                                    ...current,
                                                    upcomingLessonsEnabled:
                                                        e.target.checked,
                                                } as DevicePrefEntry,
                                            };

                                            await handleUpdateNotificationSettings(
                                                {
                                                    devicePreferences:
                                                        nextPrefs,
                                                } as Partial<NotificationSettingsType>
                                            );
                                        } catch (err) {
                                            setDeviceToggleError(
                                                err instanceof Error
                                                    ? err.message
                                                    : 'Failed to update device setting'
                                            );
                                        } finally {
                                            setDeviceToggleBusy(false);
                                        }
                                    }}
                                    disabled={
                                        deviceToggleBusy ||
                                        notificationPermission !== 'granted' ||
                                        !notificationSettings?.browserNotificationsEnabled
                                    }
                                    className="sr-only peer"
                                />
                                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Timetable changes
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Get notified about general timetable updates
                                    (this device)
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(() => {
                                        const ep = endpoint ?? '';
                                        const prefs: DevicePrefs =
                                            (notificationSettings?.devicePreferences ??
                                                {}) as DevicePrefs;
                                        const entry = ep
                                            ? (prefs[ep] as
                                                  | DevicePrefEntry
                                                  | undefined)
                                            : undefined;
                                        const globalOn =
                                            notificationSettings?.timetableChangesEnabled ??
                                            true;
                                        const perDevice =
                                            entry?.timetableChangesEnabled as
                                                | boolean
                                                | undefined;
                                        return perDevice === undefined
                                            ? globalOn
                                            : perDevice === true;
                                    })()}
                                    onChange={async (e) => {
                                        setDeviceToggleError(null);
                                        setDeviceToggleBusy(true);
                                        try {
                                            let ep = endpoint;
                                            if (!ep) {
                                                const ok =
                                                    await ensurePushSubscription();
                                                if (!ok)
                                                    throw new Error(
                                                        'Push subscription required'
                                                    );
                                                const reg = await navigator
                                                    .serviceWorker.ready;
                                                const sub =
                                                    await reg.pushManager.getSubscription();
                                                ep = sub?.endpoint ?? null;
                                                setEndpoint(ep);
                                            }
                                            if (!ep)
                                                throw new Error(
                                                    'No device endpoint available'
                                                );
                                            const prefs: DevicePrefs =
                                                (notificationSettings?.devicePreferences ??
                                                    {}) as DevicePrefs;
                                            const current = (prefs[ep] ??
                                                {}) as Record<string, unknown>;
                                            const nextPrefs: DevicePrefs = {
                                                ...prefs,
                                                [ep]: {
                                                    ...current,
                                                    timetableChangesEnabled:
                                                        e.target.checked,
                                                } as DevicePrefEntry,
                                            };
                                            await handleUpdateNotificationSettings(
                                                { devicePreferences: nextPrefs }
                                            );
                                        } catch (err) {
                                            setDeviceToggleError(
                                                err instanceof Error
                                                    ? err.message
                                                    : 'Failed to update device setting'
                                            );
                                        } finally {
                                            setDeviceToggleBusy(false);
                                        }
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {(user.isUserManager || user.isAdmin) && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                        Access requests
                                    </h5>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Get notified when users request access
                                        (this device)
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={(() => {
                                            const ep = endpoint ?? '';
                                            const prefs: DevicePrefs =
                                                (notificationSettings?.devicePreferences ??
                                                    {}) as DevicePrefs;
                                            const entry = ep
                                                ? (prefs[ep] as
                                                      | DevicePrefEntry
                                                      | undefined)
                                                : undefined;
                                            const globalOn =
                                                notificationSettings?.accessRequestsEnabled ??
                                                true;
                                            const perDevice =
                                                entry?.accessRequestsEnabled as
                                                    | boolean
                                                    | undefined;
                                            return perDevice === undefined
                                                ? globalOn
                                                : perDevice === true;
                                        })()}
                                        onChange={async (e) => {
                                            setDeviceToggleError(null);
                                            setDeviceToggleBusy(true);
                                            try {
                                                let ep = endpoint;
                                                if (!ep) {
                                                    const ok =
                                                        await ensurePushSubscription();
                                                    if (!ok)
                                                        throw new Error(
                                                            'Push subscription required'
                                                        );
                                                    const reg = await navigator
                                                        .serviceWorker.ready;
                                                    const sub =
                                                        await reg.pushManager.getSubscription();
                                                    ep = sub?.endpoint ?? null;
                                                    setEndpoint(ep);
                                                }
                                                if (!ep)
                                                    throw new Error(
                                                        'No device endpoint available'
                                                    );
                                                const prefs: DevicePrefs =
                                                    (notificationSettings?.devicePreferences ??
                                                        {}) as DevicePrefs;
                                                const current = (prefs[ep] ??
                                                    {}) as Record<
                                                    string,
                                                    unknown
                                                >;
                                                const nextPrefs: DevicePrefs = {
                                                    ...prefs,
                                                    [ep]: {
                                                        ...current,
                                                        accessRequestsEnabled:
                                                            e.target.checked,
                                                    } as DevicePrefEntry,
                                                };
                                                await handleUpdateNotificationSettings(
                                                    {
                                                        devicePreferences:
                                                            nextPrefs,
                                                    }
                                                );
                                            } catch (err) {
                                                setDeviceToggleError(
                                                    err instanceof Error
                                                        ? err.message
                                                        : 'Failed to update device setting'
                                                );
                                            } finally {
                                                setDeviceToggleBusy(false);
                                            }
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        )}

                        {/* Absences toggle - new section */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Absences
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Get notified when absences are created or
                                    updated (this device)
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(() => {
                                        const ep = endpoint ?? '';
                                        const prefs: DevicePrefs =
                                            (notificationSettings?.devicePreferences ??
                                                {}) as DevicePrefs;
                                        const entry = ep
                                            ? (prefs[ep] as
                                                  | DevicePrefEntry
                                                  | undefined)
                                            : undefined;
                                        const globalOn =
                                            notificationSettings?.absencesEnabled ??
                                            false;
                                        const perDevice =
                                            entry?.absencesEnabled as
                                                | boolean
                                                | undefined;
                                        return perDevice === undefined
                                            ? globalOn
                                            : perDevice === true;
                                    })()}
                                    onChange={async (e) => {
                                        setDeviceToggleError(null);
                                        setDeviceToggleBusy(true);
                                        try {
                                            let ep = endpoint;
                                            if (!ep) {
                                                const ok =
                                                    await ensurePushSubscription();
                                                if (!ok)
                                                    throw new Error(
                                                        'Push subscription required'
                                                    );
                                                const reg = await navigator
                                                    .serviceWorker.ready;
                                                const sub =
                                                    await reg.pushManager.getSubscription();
                                                ep = sub?.endpoint ?? null;
                                                setEndpoint(ep);
                                            }
                                            if (!ep)
                                                throw new Error(
                                                    'No device endpoint available'
                                                );
                                            const prefs: DevicePrefs =
                                                (notificationSettings?.devicePreferences ??
                                                    {}) as DevicePrefs;
                                            const current = (prefs[ep] ??
                                                {}) as Record<string, unknown>;
                                            const nextPrefs: DevicePrefs = {
                                                ...prefs,
                                                [ep]: {
                                                    ...current,
                                                    absencesEnabled:
                                                        e.target.checked,
                                                } as DevicePrefEntry,
                                            };
                                            await handleUpdateNotificationSettings(
                                                { devicePreferences: nextPrefs }
                                            );
                                        } catch (err) {
                                            setDeviceToggleError(
                                                err instanceof Error
                                                    ? err.message
                                                    : 'Failed to update device setting'
                                            );
                                        } finally {
                                            setDeviceToggleBusy(false);
                                        }
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    </div>
                )}
        </div>
    );
}

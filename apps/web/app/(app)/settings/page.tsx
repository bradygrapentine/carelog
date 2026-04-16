"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/webPush";

// IANA timezone list (abbreviated — common zones). Full list can be sourced from
// Intl.supportedValuesOf('timeZone') at runtime but we keep this static for SSR.
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Helsinki",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
] as const;

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery();
  const utils = trpc.useUtils();
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  });

  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saved, setSaved] = useState(false);

  // Populate from server once loaded
  const [initialized, setInitialized] = useState(false);
  if (profile && !initialized) {
    setDisplayName(profile.displayName);
    setTimezone(profile.timezone);
    setInitialized(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await updateProfile.mutateAsync({ displayName, timezone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Profile</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <p className="text-sm text-[var(--color-muted)] py-2">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {/* Email — read-only */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="settings-email"
                className="text-sm font-medium text-[var(--color-ink)]"
              >
                Email
              </label>
              <Input
                id="settings-email"
                type="email"
                value={profile?.email ?? ""}
                disabled
                aria-describedby="settings-email-hint"
                className="bg-[var(--color-surface)] text-[var(--color-muted)] cursor-not-allowed"
              />
              <p
                id="settings-email-hint"
                className="text-xs text-[var(--color-muted)] mt-1"
              >
                Email cannot be changed here. Contact support to update it.
              </p>
            </div>

            {/* Display name */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="settings-display-name"
                className="text-sm font-medium text-[var(--color-ink)]"
              >
                Display name
              </label>
              <Input
                id="settings-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                placeholder="How your name appears to your team"
                aria-describedby="settings-display-name-hint"
              />
              <p
                id="settings-display-name-hint"
                className="text-xs text-[var(--color-muted)] mt-1"
              >
                Shown to other members of your care team.
              </p>
            </div>

            {/* Timezone */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="settings-timezone"
                className="text-sm font-medium text-[var(--color-ink)]"
              >
                Timezone
              </label>
              <select
                id="settings-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                aria-describedby="settings-timezone-hint"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                <option value="">— Select your timezone —</option>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <p
                id="settings-timezone-hint"
                className="text-xs text-[var(--color-muted)] mt-1"
              >
                Used to display shift times and reminders in your local time.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="submit"
                disabled={updateProfile.isPending}
                className="bg-[var(--color-primary)] text-white hover:opacity-90 focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                {updateProfile.isPending ? "Saving…" : "Save profile"}
              </Button>
              {saved && (
                <span
                  role="status"
                  className="text-sm text-[var(--color-success)]"
                >
                  Saved!
                </span>
              )}
              {updateProfile.isError && (
                <span
                  role="alert"
                  className="text-sm text-[var(--color-danger)]"
                >
                  Save failed — please try again.
                </span>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Notification Preferences Section ────────────────────────────────────────

type NotifToggleProps = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function NotifToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: NotifToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={id}
          className="text-sm font-medium text-[var(--color-ink)] cursor-pointer"
        >
          {label}
        </label>
        <p className="text-xs text-[var(--color-muted)]">{description}</p>
      </div>
      {/* Accessible toggle using a checkbox styled as a switch */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        aria-label={label}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2",
          checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-muted)]",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function NotificationsSection() {
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery();
  const utils = trpc.useUtils();
  const updateNotifications = trpc.user.updateNotifications.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  });

  const [prefs, setPrefs] = useState({
    emailDigest: true,
    emailMentions: true,
    emailShiftReminders: true,
    webPushEnabled: true,
  });
  const [initialized, setInitialized] = useState(false);
  const [webPushError, setWebPushError] = useState<string | null>(null);
  const [webPushLoading, setWebPushLoading] = useState(false);

  if (profile && !initialized) {
    setPrefs({
      emailDigest: profile.emailDigest,
      emailMentions: profile.emailMentions,
      emailShiftReminders: profile.emailShiftReminders,
      webPushEnabled: profile.webPushEnabled,
    });
    setInitialized(true);
  }

  async function handleToggle(key: keyof typeof prefs, value: boolean) {
    // Special handling for webPushEnabled
    if (key === "webPushEnabled") {
      setWebPushError(null);
      setWebPushLoading(true);

      if (value) {
        // Enable push: request permission, register SW, subscribe, then update DB
        try {
          if (typeof Notification === "undefined") {
            setWebPushError(
              "Push notifications are not supported in this browser.",
            );
            setWebPushLoading(false);
            return;
          }

          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            setWebPushError(
              "Notifications are blocked in your browser settings.",
            );
            setWebPushLoading(false);
            return;
          }

          const registration = await registerServiceWorker();
          if (!registration) {
            setWebPushError("Failed to register service worker.");
            setWebPushLoading(false);
            return;
          }

          const subscription = await subscribeToPush(registration);
          if (!subscription) {
            setWebPushError("Failed to subscribe to push notifications.");
            setWebPushLoading(false);
            return;
          }

          // Send subscription to server
          const { endpoint, keys } = subscription.toJSON();
          if (!endpoint || !keys) {
            setWebPushError("Invalid subscription data.");
            setWebPushLoading(false);
            return;
          }

          // POST to /api/push/web-subscribe
          const response = await fetch("/api/push/web-subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint,
              keys: {
                p256dh: keys.p256dh,
                auth: keys.auth,
              },
            }),
          });

          if (!response.ok) {
            setWebPushError("Failed to subscribe on server.");
            setWebPushLoading(false);
            return;
          }

          // Finally, update DB preferences
          const next = { ...prefs, [key]: value };
          setPrefs(next);
          await updateNotifications.mutateAsync({ webPushEnabled: value });
        } catch (err) {
          setWebPushError(
            err instanceof Error ? err.message : "An error occurred.",
          );
        } finally {
          setWebPushLoading(false);
        }
      } else {
        // Disable push: unsubscribe, notify server, then update DB
        try {
          const registration = await registerServiceWorker();
          if (registration) {
            const subscription =
              await registration.pushManager.getSubscription();
            if (subscription) {
              const { endpoint } = subscription.toJSON();
              if (endpoint) {
                // DELETE from /api/push/web-subscribe
                await fetch("/api/push/web-subscribe", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ endpoint }),
                });
              }
              await unsubscribeFromPush(registration);
            }
          }

          const next = { ...prefs, [key]: value };
          setPrefs(next);
          await updateNotifications.mutateAsync({ webPushEnabled: value });
        } catch (err) {
          setWebPushError(
            err instanceof Error ? err.message : "An error occurred.",
          );
        } finally {
          setWebPushLoading(false);
        }
      }
      return;
    }

    // Standard email notification toggles
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await updateNotifications.mutateAsync({ [key]: value });
  }

  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Notification preferences</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <p className="text-sm text-[var(--color-muted)] py-2">Loading…</p>
        ) : (
          <div
            role="group"
            aria-label="Notification preferences"
            className="flex flex-col divide-y divide-[var(--color-border)]"
          >
            <NotifToggle
              id="notif-digest"
              label="Weekly digest email"
              description="A summary of your care team's activity sent every Monday."
              checked={prefs.emailDigest}
              onChange={(v) => handleToggle("emailDigest", v)}
            />
            <NotifToggle
              id="notif-mentions"
              label="Mention notifications"
              description="Email when someone @-mentions you in a journal entry."
              checked={prefs.emailMentions}
              onChange={(v) => handleToggle("emailMentions", v)}
            />
            <NotifToggle
              id="notif-shifts"
              label="Shift reminders"
              description="Email reminders before your scheduled shifts."
              checked={prefs.emailShiftReminders}
              onChange={(v) => handleToggle("emailShiftReminders", v)}
            />
            <div className="flex items-start justify-between gap-4 py-2">
              <div className="flex flex-col gap-0.5">
                <label
                  htmlFor="notif-push"
                  className="text-sm font-medium text-[var(--color-ink)] cursor-pointer"
                >
                  Browser push notifications
                </label>
                <p className="text-xs text-[var(--color-muted)]">
                  Receive notifications in this browser when new entries or
                  shifts are posted.
                </p>
                {webPushError && (
                  <p
                    role="alert"
                    className="text-xs text-[var(--color-danger)] mt-1"
                  >
                    {webPushError}
                  </p>
                )}
              </div>
              <button
                id="notif-push"
                type="button"
                role="switch"
                aria-checked={prefs.webPushEnabled}
                onClick={() =>
                  handleToggle("webPushEnabled", !prefs.webPushEnabled)
                }
                disabled={webPushLoading}
                aria-label="Browser push notifications"
                className={[
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  prefs.webPushEnabled
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-muted)]",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                    prefs.webPushEnabled ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Appearance Section ──────────────────────────────────────────────────────

function AppearanceSection() {
  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Appearance</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[var(--color-ink)]">
            Color theme
          </label>
          <ThemeToggle />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Language Section ─────────────────────────────────────────────────────────

function LanguageSection() {
  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Language</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="settings-language"
            className="text-sm font-medium text-[var(--color-ink)]"
          >
            Interface language
          </label>
          <select
            id="settings-language"
            defaultValue="en"
            aria-describedby="settings-language-hint"
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            <option value="en">English</option>
          </select>
          <p
            id="settings-language-hint"
            className="text-xs text-[var(--color-muted)] mt-1"
          >
            Additional languages coming soon.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Danger Zone Section ──────────────────────────────────────────────────────

function DangerZoneSection() {
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  return (
    <Card className="shadow-sm gap-2 border-[var(--color-danger)]/30">
      <CardHeader className="-mt-4 px-4 py-3 bg-red-50 border-b border-[var(--color-danger)]/30">
        <CardTitle className="text-sm text-[var(--color-danger)]">
          Danger zone
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">
                Leave organization
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Remove yourself from the care team. You will lose access to all
                shared data.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLeaveModal(true)}
              className="shrink-0 border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-red-50 focus:ring-2 focus:ring-[var(--color-danger)] focus:ring-offset-2"
            >
              Leave
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLeaveModal(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowLeaveModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-dialog-title"
            className="w-full max-w-md rounded-2xl bg-card p-8 shadow-xl"
          >
            <h2
              id="leave-dialog-title"
              className="text-lg font-bold text-[var(--color-ink)]"
            >
              Leave this organization?
            </h2>
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              You will immediately lose access to all shared journals,
              medications, documents, and shifts. A coordinator can re-invite
              you later.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 border-[var(--color-border)] text-[var(--color-ink)] hover:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                Keep access
              </Button>
              <Button
                type="button"
                onClick={() => {
                  // Destructive action: not yet wired — requires org context.
                  // Surface a clear message rather than silently failing.
                  setShowLeaveModal(false);
                  alert(
                    "Leave organization: select your org first from the dashboard, then use the Team panel to remove yourself.",
                  );
                }}
                className="flex-1 bg-[var(--color-danger)] text-white hover:opacity-90 focus:ring-2 focus:ring-[var(--color-danger)] focus:ring-offset-2"
              >
                Yes, leave
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Settings</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Manage your profile, notifications, and account preferences.
      </p>

      <div className="mt-8 space-y-6">
        <ProfileSection />
        <NotificationsSection />
        <AppearanceSection />
        <LanguageSection />
        <DangerZoneSection />
      </div>
    </div>
  );
}

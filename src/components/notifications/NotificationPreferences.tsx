import React, { useEffect, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { UserNotificationPreferences } from "../../types/notifications";

interface FormState {
  email_opt_in: boolean;
  sms_opt_in: boolean;
  push_opt_in: boolean;
  quiet_hours_start: string | "";
  quiet_hours_end: string | "";
  preferred_language: string;
}

export const NotificationPreferences: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }
      const { data, error: prefsError } = await supabase
        .from("user_notification_preferences")
        .select("user_id,email_opt_in,sms_opt_in,push_opt_in,quiet_hours_start,quiet_hours_end,preferred_language,updated_at")
        .eq("user_id", user.id)
        .single();
      if (prefsError && prefsError.code !== "PGRST116") { // not found vs real error
        setError(prefsError.message);
      }
      const form: FormState = {
        email_opt_in: data?.email_opt_in ?? true,
        sms_opt_in: data?.sms_opt_in ?? false,
        push_opt_in: data?.push_opt_in ?? true,
        quiet_hours_start: data?.quiet_hours_start ?? "",
        quiet_hours_end: data?.quiet_hours_end ?? "",
        preferred_language: data?.preferred_language ?? "en",
      };
      if (active) {
        setPreferences(form);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleChange = (field: keyof FormState, value: any) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [field]: value });
  };

  const save = async () => {
    if (!preferences) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setSaving(false);
      return;
    }
    const resp = await fetch(`${process.env.REACT_APP_SUPABASE_FUNCTION_URL}/update-preferences/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({
        emailOptIn: preferences.email_opt_in,
        smsOptIn: preferences.sms_opt_in,
        pushOptIn: preferences.push_opt_in,
        quietHoursStart: preferences.quiet_hours_start || null,
        quietHoursEnd: preferences.quiet_hours_end || null,
        preferredLanguage: preferences.preferred_language,
      }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      setError(json.error || "Save failed");
    } else {
      setSuccess("Preferences saved");
    }
    setSaving(false);
  };

  if (loading || !preferences) return <div className="p-4">Loading preferences...</div>;

  return (
    <div className="max-w-xl p-4 space-y-4">
      <h2 className="text-xl font-semibold">Notification Preferences</h2>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {success && <div className="text-green-600 text-sm">{success}</div>}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.email_opt_in}
            onChange={(e) => handleChange("email_opt_in", e.target.checked)}
          />
          <span>Email</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.sms_opt_in}
            onChange={(e) => handleChange("sms_opt_in", e.target.checked)}
          />
          <span>SMS</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.push_opt_in}
            onChange={(e) => handleChange("push_opt_in", e.target.checked)}
          />
          <span>Push</span>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Quiet Hours Start</label>
          <input
            type="time"
            value={preferences.quiet_hours_start}
            onChange={(e) => handleChange("quiet_hours_start", e.target.value)}
            className="border px-2 py-1 w-full rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Quiet Hours End</label>
          <input
            type="time"
            value={preferences.quiet_hours_end}
            onChange={(e) => handleChange("quiet_hours_end", e.target.value)}
            className="border px-2 py-1 w-full rounded"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Preferred Language</label>
        <select
          value={preferences.preferred_language}
          onChange={(e) => handleChange("preferred_language", e.target.value)}
          className="border px-2 py-1 w-full rounded"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Preferences"}
      </button>
    </div>
  );
};

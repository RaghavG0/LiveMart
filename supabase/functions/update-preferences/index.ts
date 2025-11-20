import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "PUT") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Target user id from URL path /update-preferences/{id}
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const targetUserId = parts[parts.length - 1];
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Missing user id in path" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch caller role
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError) {
      return new Response(JSON.stringify({ error: "Profile lookup failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isAdmin = profile?.role === "admin";
    if (!(isAdmin || user.id === targetUserId)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const {
      emailOptIn,
      smsOptIn,
      pushOptIn,
      quietHoursStart,
      quietHoursEnd,
      preferredLanguage,
    } = body;

    // Basic validation
    if (preferredLanguage && typeof preferredLanguage !== "string") {
      return new Response(JSON.stringify({ error: "preferredLanguage must be string" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (emailOptIn !== undefined) updateFields.email_opt_in = !!emailOptIn;
    if (smsOptIn !== undefined) updateFields.sms_opt_in = !!smsOptIn;
    if (pushOptIn !== undefined) updateFields.push_opt_in = !!pushOptIn;
    if (quietHoursStart !== undefined) updateFields.quiet_hours_start = quietHoursStart || null;
    if (quietHoursEnd !== undefined) updateFields.quiet_hours_end = quietHoursEnd || null;
    if (preferredLanguage !== undefined) updateFields.preferred_language = preferredLanguage;

    // Upsert preferences
    const { data: upsertData, error: upsertError } = await supabase
      .from("user_notification_preferences")
      .upsert({ user_id: targetUserId, ...updateFields }, { onConflict: "user_id" })
      .select()
      .single();

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, preferences: upsertData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("update-preferences error", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

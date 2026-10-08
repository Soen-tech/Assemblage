import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendNotificationService } from "./send-notification.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { clubId, title, message, senderUserId } = req.body;

  // Retrieve credentials
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  // Sanitize URL
  let supabaseUrl = rawUrl;
  if (supabaseUrl && typeof supabaseUrl === "string") {
    supabaseUrl = supabaseUrl.trim()
      .replace(/\/rest\/v1\/?$/, "")
      .replace(/\/auth\/v1\/?$/, "")
      .replace(/\/$/, "");
  }

  const db = supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project-id")
    ? createClient(supabaseUrl, supabaseKey)
    : null;

  if (db && senderUserId) {
    try {
      // Fetch sender profile
      const { data: profile, error } = await db
        .from("profiles")
        .select("role")
        .eq("id", senderUserId)
        .maybeSingle();

      if (error || !profile) {
        console.error("[send-club-announcement API] Unauthorized user query error:", error);
        return res.status(403).json({ error: "Forbidden: Sender profile not found" });
      }

      if (profile.role !== "admin" && profile.role !== "master_admin") {
        console.warn(`[send-club-announcement API] Profile role '${profile.role}' is not authorized.`);
        return res.status(403).json({ error: "Forbidden: Only admins can send announcements" });
      }
    } catch (err: any) {
      console.error("[send-club-announcement API] Auth check exception:", err);
      return res.status(500).json({ error: "Internal Auth check failure" });
    }
  } else {
    console.warn("[send-club-announcement API] DB not initialized or senderUserId missing. Skipping authorization check (simulation mode).");
  }

  // Determine local send-notification webhook url
  const appUrl = (process.env.VITE_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");

  try {
    console.log("[send-club-announcement API] Direct invocation of sendNotificationService");
    const results = await sendNotificationService({
      userId: null,
      clubId: clubId || null,
      type: "club_announcement",
      title: title,
      message: message,
      url: "/explore-clubs"
    });

    if (results.success) {
      return res.status(200).json({ success: true, response: results });
    } else {
      console.error("[send-club-announcement API] sendNotificationService failed:", results);
      return res.status(500).json({ error: "Failed calling sendNotificationService", details: results });
    }
  } catch (err: any) {
    console.error("[send-club-announcement API] Call exception:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

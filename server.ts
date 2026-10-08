import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables prior to any SDK initialization
dotenv.config();

const app = express();
const PORT = 3000;

// Body parsing middlewares for standard JSON & urlencoded PayFast payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Retrieve credentials
const rawUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

// Sanitize URL
let supabaseUrl = rawUrl;
if (supabaseUrl && typeof supabaseUrl === "string") {
  supabaseUrl = supabaseUrl.trim()
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/auth\/v1\/?$/, "")
    .replace(/\/$/, "");
}

// Setup Supabase Client
const db = supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project-id")
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (db) {
  console.log("[Backend Server] Supabase client initialized on port 3000:", supabaseUrl);
} else {
  console.warn("[Backend Server] Supabase credentials not found or placeholder used. Running in fallback simulation mode.");
}

// 1. Health endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: db ? "supabase" : "simulation" });
});

import payfastItnHandler from "./api/payfast-itn";
import sendNotificationHandler from "./api/send-notification";
import sendClubAnnouncementHandler from "./api/send-club-announcement";
import savePromoCodeHandler from "./api/save-promo-code";
import deletePromoCodeHandler from "./api/delete-promo-code";
import validatePromoCodeHandler from "./api/validate-promo-code";
import getPromoCodesHandler from "./api/get-promo-codes";

// 2. Payfast ITN (Instant Transaction Notification) webhook receiver
app.all("/api/payfast-itn", payfastItnHandler as any);

// 3. OneSignal and DB Notification send routing
app.post("/api/send-notification", sendNotificationHandler as any);

// 4. Send Club Announcement broadcast routing
app.post("/api/send-club-announcement", sendClubAnnouncementHandler as any);

import promoValidateHandler from "./api/promo-validate";
import checkoutHandler from "./api/checkout";

// 5. Admin Promo Code Endpoints & Validation (bypass RLS using service role)
app.post("/api/admin/save-promo-code", savePromoCodeHandler as any);
app.post("/api/admin/delete-promo-code", deletePromoCodeHandler as any);
app.all("/api/admin/get-promo-codes", getPromoCodesHandler as any);
app.post("/api/validate-promo-code", validatePromoCodeHandler as any);
app.post("/api/promo/validate", promoValidateHandler as any);
app.post("/api/checkout", checkoutHandler as any);


// Vite Middleware orchestration
async function mountViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    console.log("[Backend Server] Starting in DEVELOPMENT mode. Mounting Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Backend Server] Starting in PRODUCTION mode. Serving pre-compiled static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend Server Status] Server is up and listening on http://0.0.0.0:${PORT}`);
  });
}

mountViteMiddleware();

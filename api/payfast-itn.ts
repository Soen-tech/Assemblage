import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Helper to pack Payfast metadata into descriptions
function packPayfastMetadata(description: string, payfast_price: any, payfast_quantity: any) {
  const priceNum = payfast_price !== null && payfast_price !== undefined && String(payfast_price).trim() !== "" ? parseFloat(String(payfast_price)) : null;
  const qtyNum = payfast_quantity !== null && payfast_quantity !== undefined && String(payfast_quantity).trim() !== "" ? parseInt(String(payfast_quantity)) : null;
  const cleanDesc = (description || "").replace(/\[PF_META:({.*?})\]/g, "").trim();
  if (priceNum === null && qtyNum === null) return cleanDesc;
  const metaObj: any = {};
  if (priceNum !== null && !isNaN(priceNum)) metaObj.p_p = priceNum;
  if (qtyNum !== null && !isNaN(qtyNum)) metaObj.p_q = qtyNum;
  return `${cleanDesc} [PF_META:${JSON.stringify(metaObj)}]`;
}

// Helper to unpack Payfast metadata from description
function unpackPayfastMetadata(item: any) {
  const desc = item.description || "";
  const match = desc.match(/\[PF_META:({.*?})\]/);
  let payfast_price: number | null = null;
  let payfast_quantity: number | null = null;
  let cleanDescription = desc;
  if (match && match[1]) {
    try {
      const meta = JSON.parse(match[1]);
      payfast_price = meta.p_p !== undefined ? Number(meta.p_p) : null;
      payfast_quantity = meta.p_q !== undefined ? Number(meta.p_q) : null;
      cleanDescription = desc.replace(/\[PF_META:({.*?})\]/g, "").trim();
    } catch (e) {
      console.error("[unpackPayfastMetadata] Parse error:", e);
    }
  }
  return {
    ...item,
    description: cleanDescription,
    payfast_price,
    payfast_quantity
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  console.log("[Payfast ITN Webhook] Received webhook payload raw body:", req.body);

  // Extract variables sent by Payfast (or custom parameters returned to webhook)
  const {
    m_payment_id,
    pf_payment_id,
    payment_status,
    amount_gross,
    amount_fee,
    amount_net,
    custom_str1, // userId
    custom_str2, // clubId (or other context)
    custom_str3, // itemId
    custom_str4, // itemType ('event' | 'boutique' | 'subscription' | 'club_membership')
    custom_str5, // quantity
    email_address,
    item_name,
  } = req.body;

  console.log(`[Payfast ITN Processing] status: ${payment_status}, itemType: ${custom_str4}, itemId: ${custom_str3}, userId: ${custom_str1}`);

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

  if (payment_status === "COMPLETE") {
    if (!db) {
      console.warn("[Payfast ITN Webhook] Database client not configured. Simulation mode acknowledged.");
      return res.status(200).send("OK_SIMULATED");
    }

    try {
      const userId = custom_str1;
      const clubId = custom_str2 || null;
      const itemId = custom_str3;
      const itemType = custom_str4; // 'event' | 'boutique' | 'subscription' | 'club_membership'
      const quantity = parseInt(custom_str5 || "1") || 1;
      const promo_code_id = req.body.custom_int1 ? parseInt(req.body.custom_int1) : null;

      const gross = parseFloat(amount_gross || "0");
      const fee = parseFloat(amount_fee || "0");
      const net = parseFloat(amount_net || "0");

      console.log(`[Payfast ITN Success] Payment COMPLETE. Gross: R${gross}, Fee: R${fee}, Net: R${net}`);

      // Calculations
      const platformCommission = Math.round((gross * 0.05) * 100) / 100;
      const clubPayout = Math.round((gross * 0.95) * 100) / 100;

      // Map UI item types to DB order item_types
      const mappedParamType = 
        itemType === "event" ? "event_ticket" :
        itemType === "boutique" ? "product" :
        itemType === "subscription" ? "subscription" :
        itemType === "club_membership" ? "club_membership" : "product";

      const orderPayload = {
        user_id: userId || null,
        club_id: clubId || null,
        item_type: mappedParamType,
        item_id: itemId,
        item_name: item_name || `Item ${itemId}`,
        quantity: quantity,
        unit_price: gross / quantity,
        amount_gross: gross,
        amount_fee: fee,
        amount_net: net,
        platform_commission: platformCommission,
        club_payout: clubPayout,
        status: "complete",
        payfast_payment_id: m_payment_id || `TX-WEB-${Date.now()}`,
        payfast_pf_payment_id: pf_payment_id || `PF-WEB-${Date.now()}`,
        notes: `Processed securely via Payfast Instant Transaction Notification (ITN) Webhook.`
      };

      console.log("[Payfast ITN Webhook] Persisting main Order:", orderPayload);
      const { data: order, error: orderError } = await db
        .from("orders")
        .insert([orderPayload])
        .select()
        .single();

      if (orderError) {
        console.error("[Payfast ITN Webhook] Base order insertion failure:", orderError);
        throw orderError;
      }

      console.log("[Payfast ITN Webhook] Order saved successfully:", order);

      if (promo_code_id) {
        await db.from("promo_code_redemptions").insert([{
          promo_code_id,
          order_id: order.id,
          user_id: userId || null
        }]);
        
        const { data: promoData } = await db.from("promo_codes").select("times_used").eq("id", promo_code_id).maybeSingle();
        if (promoData) {
          await db.from("promo_codes").update({ times_used: promoData.times_used + 1 }).eq("id", promo_code_id);
        }
      }

      // 3. Conditional Child Record Generation based on ItemType
      if (itemType === "event" && order) {
        // Handle physical capacity update (decrement supply)
        const { data: currentEvent } = await db.from("events").select("*").eq("id", itemId).maybeSingle();
        if (currentEvent) {
          const unpacked = unpackPayfastMetadata(currentEvent);
          if (unpacked.payfast_quantity !== null && unpacked.payfast_quantity !== undefined) {
            const newQty = Math.max(0, Number(unpacked.payfast_quantity) - quantity);
            const packed = packPayfastMetadata(unpacked.description, unpacked.payfast_price, newQty);
            await db.from("events").update({ description: packed }).eq("id", itemId);
            console.log(`[Payfast ITN Webhook] Event allocation decremented to: ${newQty}`);
          }
        }

        // Insert ticket registry entries
        const ticketsPayloads = [];
        for (let i = 0; i < quantity; i++) {
          ticketsPayloads.push({
            order_id: order.id,
            user_id: userId || null,
            event_id: itemId,
            event_name: item_name || "Club Event Ticket",
            club_id: clubId || null,
            status: "valid"
          });
        }
        await db.from("event_tickets").insert(ticketsPayloads);
        console.log(`[Payfast ITN Webhook] Registered ${quantity} active ticket entries in event_tickets.`);

        // Fire-and-forget notification to OneSignal and Supabase Feed
        const appUrl = (process.env.VITE_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
        const targetUrl = appUrl ? `${appUrl}/api/send-notification` : `http://localhost:3000/api/send-notification`;
        fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId,
            clubId: null,
            type: "ticket_confirmed",
            title: "Ticket Confirmed — PROOF",
            message: `Your ticket for ${item_name || "Club Event"} is confirmed. See you there!`,
            url: appUrl ? `${appUrl}/events` : "/events"
          })
        }).catch(err => console.warn("[payfast-itn ticket notification failure]", err));
      }

      if (itemType === "boutique" && order) {
        // Handle physical capacity update (decrement supply)
        const { data: currentBoutique } = await db.from("boutique").select("*").eq("id", itemId).maybeSingle();
        if (currentBoutique) {
          const unpacked = unpackPayfastMetadata(currentBoutique);
          if (unpacked.payfast_quantity !== null && unpacked.payfast_quantity !== undefined) {
            const newQty = Math.max(0, Number(unpacked.payfast_quantity) - quantity);
            const packed = packPayfastMetadata(unpacked.description, unpacked.payfast_price, newQty);
            await db.from("boutique").update({ description: packed }).eq("id", itemId);
            console.log(`[Payfast ITN Webhook] Boutique inventory item remaining: ${newQty}`);
          }
        }

        // Insert product item purchase detail log
        const productOrderPayload = {
          order_id: order.id,
          user_id: userId || null,
          product_id: itemId,
          product_name: item_name || "Boutique Collection Item",
          club_id: clubId || null,
          quantity: quantity,
          unit_price: gross / quantity,
          fulfilment_status: "pending",
          notes: "Processed via Payfast ITN Webhook"
        };
        await db.from("product_orders").insert([productOrderPayload]);
        console.log("[Payfast ITN Webhook] Persisted product_orders child item logs.");

        // Fire-and-forget product webhook notification call
        const appUrl = (process.env.VITE_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
        const targetUrl = appUrl ? `${appUrl}/api/send-notification` : `http://localhost:3000/api/send-notification`;
        fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId,
            clubId: null,
            type: "order_confirmed",
            title: "Order Confirmed — PROOF",
            message: `Your order for ${item_name || "Boutique Collection Item"} has been confirmed.`,
            url: appUrl ? `${appUrl}/boutique` : "/boutique"
          })
        }).catch(err => console.warn("[payfast-itn product notification failure]", err));
      }

      if (itemType === "subscription") {
        const planOption = itemId.includes("annual") ? "annual" : "monthly";
        const billingDate = new Date().toISOString().split("T")[0];
        const nextDate = new Date();
        if (planOption === "monthly") {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        const nextBillingDate = nextDate.toISOString().split("T")[0];

        const subscriptionPayload = {
          user_id: userId,
          plan: planOption,
          status: "active",
          amount: gross,
          payfast_token: pf_payment_id || `token_itn_${Date.now()}`,
          billing_date: billingDate,
          next_billing_date: nextBillingDate
        };

        await db.from("subscriptions").upsert([subscriptionPayload], { onConflict: "user_id" });
        console.log("[Payfast ITN Webhook] Updated subscriptions standing inside user registry.");
      }

      if (itemType === "club_membership") {
        const { data: memberRecord, error: memberError } = await db
          .from("club_members")
          .upsert({
            user_id: userId,
            club_id: clubId,
            role: "member",
            status: "active",
            membership_type: "paid",
            order_id: order.id,
            paid_at: new Date().toISOString(),
          }, { onConflict: "user_id,club_id" })
          .select();

        if (memberError) {
          console.error("[Payfast ITN Webhook] Club member registration failed:", memberError);
        } else {
          console.log("[Payfast ITN Webhook] Saved paid club memberships successfully:", memberRecord);
        }
      }

    } catch (e) {
      console.error("[Payfast ITN Webhook] Error during internal DB processing sequence:", e);
      // Return 200 OK to prevent PayFast from retrying a failed or partially completed transaction, which would cause duplication
      return res.status(200).send("DB Sync Error, Ignored and Not Retried");
    }
  }

  // PayFast ITN specifies returning a HTTP 200 OK with "OK" string response to acknowledge receipt
  return res.status(200).send("OK");
}

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get(key: string): string | undefined };
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = await req.json();
    const { type, data } = payload;

    // Resend webhook event types: email.sent, email.delivered, email.delivery_delayed,
    // email.complained, email.bounced, email.opened, email.clicked
    const emailId: string = data?.email_id ?? data?.id ?? "";

    if (!emailId) {
      return new Response(JSON.stringify({ error: "No email_id in payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Map Resend event type to our delivery_status
    const statusMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.delivery_delayed": "pending_retry",
      "email.complained": "complained",
      "email.bounced": "bounced",
    };

    const deliveryStatus = statusMap[type] ?? "sent";

    // 1. Record the raw webhook event
    await supabase.from("email_delivery_events").insert({
      resend_email_id: emailId,
      event_type: type,
      event_data: payload,
      received_at: new Date().toISOString(),
    });

    // 2. Update escalation_log delivery status
    const { data: logRows } = await supabase
      .from("escalation_logs")
      .select("id, retry_count")
      .eq("resend_email_id", emailId)
      .limit(1);

    if (logRows && logRows.length > 0) {
      const log = logRows[0];
      await supabase
        .from("escalation_logs")
        .update({
          delivery_status: deliveryStatus,
          delivery_updated_at: new Date().toISOString(),
          webhook_event: type,
        })
        .eq("id", log.id);

      // 3. Auto-retry on bounce or delivery_delayed (up to 3 retries)
      if ((deliveryStatus === "bounced" || deliveryStatus === "pending_retry") && log.retry_count < 3) {
        // Fetch full escalation log details for retry
        const { data: fullLog } = await supabase
          .from("escalation_logs")
          .select("*")
          .eq("id", log.id)
          .single();

        if (fullLog) {
          // Increment retry count
          await supabase
            .from("escalation_logs")
            .update({
              retry_count: log.retry_count + 1,
              last_retry_at: new Date().toISOString(),
              delivery_status: "pending_retry",
            })
            .eq("id", log.id);

          // Re-invoke the send-escalation-email function
          const retryRes = await fetch(`${SUPABASE_URL}/functions/v1/send-escalation-email`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              noticeRef: fullLog.notice_ref,
              noticeTitle: fullLog.notice_ref,
              priority: "High",
              airlineName: fullLog.airline_name,
              managerName: fullLog.email_recipient,
              managerEmail: fullLog.email_recipient,
              escalationLevel: fullLog.escalation_level,
            }),
          });

          const retryData = await retryRes.json();

          // Update with new email ID from retry
          if (retryData?.emailId) {
            await supabase
              .from("escalation_logs")
              .update({ resend_email_id: retryData.emailId })
              .eq("id", log.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, event: type, emailId }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});

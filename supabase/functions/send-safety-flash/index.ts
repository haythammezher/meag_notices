import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const { alertRef, alertTitle, severity, message, targetAirlines, broadcastId } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const severityColor =
      severity === "Critical" ? "#EF4444" :
      severity === "High" ? "#F97316" :
      severity === "Medium" ? "#EAB308" : "#3B82F6";

    const severityIcon =
      severity === "Critical" ? "🚨" :
      severity === "High" ? "⚠️" :
      severity === "Medium" ? "⚡" : "ℹ️";

    const results: Array<{ airline: string; emailId?: string; error?: string; success: boolean }> = [];

    for (const airline of targetAirlines as Array<{ name: string; iata: string; email: string }>) {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#060E1C;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060E1C;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0D1B35;border-radius:12px;border:1px solid #1E3358;overflow:hidden;max-width:600px;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0A1628,#0F2040);padding:24px 32px;border-bottom:1px solid #1E3358;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:18px;font-weight:700;color:#F59E0B;letter-spacing:0.05em;">MEAG</span>
                  <span style="font-size:12px;color:#64748B;margin-left:8px;">Safety Flash Broadcast</span>
                </td>
                <td align="right">
                  <span style="background:${severityColor}22;color:${severityColor};border:1px solid ${severityColor}44;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">${severityIcon} ${severity}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Alert banner -->
        <tr>
          <td style="background:${severityColor}18;border-bottom:2px solid ${severityColor};padding:14px 32px;">
            <p style="margin:0;font-size:15px;font-weight:700;color:${severityColor};">${severityIcon} SAFETY FLASH — IMMEDIATE ACTION REQUIRED</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 6px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;">Alert Reference</p>
            <p style="margin:0 0 20px;font-size:14px;font-weight:700;color:#F59E0B;">${alertRef}</p>
            <p style="margin:0 0 6px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;">Subject</p>
            <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#E8EDF5;">${alertTitle}</p>
            <!-- Message box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2040;border:1px solid #1E3358;border-left:4px solid ${severityColor};border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0;font-size:14px;color:#CBD5E1;line-height:1.7;">${message.replace(/\n/g, '<br>')}</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 20px;font-size:13px;color:#94A3B8;line-height:1.6;">
              This safety flash has been issued to <strong style="color:#E8EDF5;">${airline.name} (${airline.iata})</strong>. 
              Please ensure all relevant personnel are briefed immediately and acknowledge receipt via the MEAG platform.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#F59E0B;border-radius:8px;padding:12px 24px;">
                  <a href="https://meagnotic8021.builtwithrocket.new/safety-flash" style="color:#0A1628;font-size:14px;font-weight:700;text-decoration:none;">View Safety Flash →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #1E3358;">
            <p style="margin:0;font-size:11px;color:#64748B;line-height:1.5;">
              Broadcast ID: ${broadcastId} | Issued by MEAG Aviation Safety Operations<br>
              Cairo International Airport (HECA) — Ground Operations Management<br>
              For assistance contact: safety@meag-aviation.com
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: [airline.email],
            subject: `[SAFETY FLASH] ${severity} — ${alertRef} — ${alertTitle}`,
            html: htmlBody,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          results.push({ airline: airline.name, error: data?.message ?? "Resend API error", success: false });
        } else {
          results.push({ airline: airline.name, emailId: data.id, success: true });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ airline: airline.name, error: message, success: false });
      }
    }

    return new Response(JSON.stringify({ success: true, results, broadcastId }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

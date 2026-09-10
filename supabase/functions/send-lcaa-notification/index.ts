import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
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
    const { documentRef, documentTitle, documentCategory, updatedBy, changeNote, version } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const LCAA_EMAIL = Deno.env.get("LCAA_NOTIFICATION_EMAIL") ?? "lcaa@aviation.gov.lb";

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
                  <span style="font-size:12px;color:#64748B;margin-left:8px;">Aviation Notices Platform</span>
                </td>
                <td align="right">
                  <span style="background:rgba(59,130,246,0.2);color:#3B82F6;border:1px solid rgba(59,130,246,0.3);padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">DOCUMENT UPDATE</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Alert banner -->
        <tr>
          <td style="background:rgba(59,130,246,0.1);border-bottom:2px solid #3B82F6;padding:12px 32px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#3B82F6;">📋 MEAG Document Updated — LCAA Notification</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 8px;font-size:14px;color:#94A3B8;">Dear Lebanese Civil Aviation Authority,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#E8EDF5;line-height:1.6;">
              This is an official notification that a MEAG document has been updated. Please review the details below and ensure your records are updated accordingly.
            </p>
            <!-- Document card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2040;border:1px solid #1E3358;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-bottom:12px;">
                        <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Document Reference</p>
                        <p style="margin:0;font-size:14px;font-weight:700;color:#F59E0B;">${documentRef}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:12px;">
                        <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Document Title</p>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#E8EDF5;">${documentTitle}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:12px;">
                        <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Category</p>
                        <p style="margin:0;font-size:13px;color:#94A3B8;">${documentCategory}</p>
                      </td>
                    </tr>
                    ${version ? `<tr>
                      <td style="padding-bottom:12px;">
                        <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">New Version</p>
                        <p style="margin:0;font-size:13px;font-mono;color:#A855F7;font-weight:700;">${version}</p>
                      </td>
                    </tr>` : ''}
                    ${changeNote ? `<tr>
                      <td style="padding-bottom:0;">
                        <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Change Summary</p>
                        <p style="margin:0;font-size:13px;color:#E8EDF5;line-height:1.5;">${changeNote}</p>
                      </td>
                    </tr>` : ''}
                  </table>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2040;border:1px solid #1E3358;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 20px;">
                  <p style="margin:0;font-size:12px;color:#64748B;">
                    Updated by: <span style="color:#E8EDF5;font-weight:600;">${updatedBy}</span> &nbsp;|&nbsp;
                    Date: <span style="color:#E8EDF5;">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 20px;font-size:13px;color:#94A3B8;line-height:1.6;">
              This notification is sent automatically by the MEAG Aviation Notices Platform in compliance with regulatory document update requirements.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#3B82F6;border-radius:8px;padding:12px 24px;">
                  <a href="https://meagnotic8021.builtwithrocket.new/documentation-control" style="color:#fff;font-size:14px;font-weight:700;text-decoration:none;">View Document Library →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #1E3358;">
            <p style="margin:0;font-size:11px;color:#64748B;line-height:1.5;">
              This is an automated notification from the MEAG Aviation Notices Platform.<br>
              Cairo International Airport (HECA) — Ground Operations Management<br>
              For assistance contact: ops@meag-aviation.com
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [LCAA_EMAIL],
        subject: `[MEAG Document Update] ${documentRef} — ${documentTitle}`,
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message ?? "Resend API error");
    }

    return new Response(JSON.stringify({ success: true, emailId: data.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

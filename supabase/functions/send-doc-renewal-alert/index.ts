declare const Deno;

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  if (req?.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const { documentTitle, refNumber, docType, expiryDate, daysUntilExpiry, lcaaCertNumber, recipientEmails, complianceStatus } = await req?.json();

    const RESEND_API_KEY = Deno?.env?.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const urgencyColor = daysUntilExpiry <= 7 ? "#EF4444" : daysUntilExpiry <= 30 ? "#F59E0B" : "#EAB308";
    const urgencyLabel = daysUntilExpiry <= 7 ? "CRITICAL" : daysUntilExpiry <= 30 ? "URGENT" : "WARNING";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MEAG Document Renewal Alert</title>
</head>
<body style="margin:0;padding:0;background:#0A0F1E;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F1E;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#0D1526;border:1px solid rgba(255,184,0,0.2);border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#040C18,#0D1526);padding:24px 32px;border-bottom:2px solid ${urgencyColor};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="color:#FFB800;font-size:20px;font-weight:700;letter-spacing:3px;font-family:monospace;">MEAG</div>
                    <div style="color:#6B7280;font-size:11px;letter-spacing:2px;margin-top:2px;font-family:monospace;">AVIATION DOCUMENT MANAGEMENT</div>
                  </td>
                  <td align="right">
                    <span style="background:${urgencyColor};color:#fff;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:2px;">${urgencyLabel}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="color:#F9FAFB;font-size:18px;margin:0 0 8px 0;">Document Renewal Alert</h2>
              <p style="color:#9CA3AF;font-size:14px;margin:0 0 24px 0;">
                The following aviation document requires immediate attention.
              </p>

              <!-- Document Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,184,0,0.05);border:1px solid rgba(255,184,0,0.15);border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="color:#FFB800;font-size:11px;letter-spacing:2px;font-family:monospace;margin-bottom:8px;">${docType?.toUpperCase()}</div>
                    <div style="color:#F9FAFB;font-size:16px;font-weight:600;margin-bottom:4px;">${documentTitle}</div>
                    <div style="color:#6B7280;font-size:12px;font-family:monospace;">${refNumber}</div>
                  </td>
                </tr>
              </table>

              <!-- Details Grid -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:0 8px 16px 0;">
                    <div style="color:#6B7280;font-size:11px;letter-spacing:1px;margin-bottom:4px;">EXPIRY DATE</div>
                    <div style="color:#F9FAFB;font-size:14px;font-weight:600;">${expiryDate}</div>
                  </td>
                  <td width="50%" style="padding:0 0 16px 8px;">
                    <div style="color:#6B7280;font-size:11px;letter-spacing:1px;margin-bottom:4px;">DAYS REMAINING</div>
                    <div style="color:${urgencyColor};font-size:14px;font-weight:700;">${daysUntilExpiry} days</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 8px 0 0;">
                    <div style="color:#6B7280;font-size:11px;letter-spacing:1px;margin-bottom:4px;">COMPLIANCE STATUS</div>
                    <div style="color:${urgencyColor};font-size:14px;font-weight:600;">${complianceStatus}</div>
                  </td>
                  ${lcaaCertNumber ? `
                  <td width="50%" style="padding:0 0 0 8px;">
                    <div style="color:#6B7280;font-size:11px;letter-spacing:1px;margin-bottom:4px;">LCAA CERT NO.</div>
                    <div style="color:#F9FAFB;font-size:14px;font-family:monospace;">${lcaaCertNumber}</div>
                  </td>
                  ` : '<td></td>'}
                </tr>
              </table>

              <!-- Action Required -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px;">
                    <div style="color:#EF4444;font-size:12px;font-weight:700;letter-spacing:1px;margin-bottom:6px;">⚠ ACTION REQUIRED</div>
                    <div style="color:#D1D5DB;font-size:13px;line-height:1.6;">
                      Please initiate the renewal process immediately to maintain compliance. 
                      Contact the issuing authority (${docType?.includes('LCAA') ? 'LCAA' : 'relevant authority'}) to begin the renewal procedure.
                    </div>
                  </td>
                </tr>
              </table>

              <p style="color:#6B7280;font-size:12px;margin:0;">
                This is an automated alert from the MEAG Aviation Document Management System. 
                Log in to the MEAG platform to view full document details and manage renewals.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.05);">
              <div style="color:#4B5563;font-size:11px;text-align:center;letter-spacing:1px;">
                MEAG · Middle East Aviation Ground Services · Automated Compliance Alert System
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emails = Array.isArray(recipientEmails) && recipientEmails?.length > 0
      ? recipientEmails
      : ["compliance@meag.aero"];

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: emails,
        subject: `[${urgencyLabel}] Document Renewal Required: ${documentTitle} — Expires in ${daysUntilExpiry} days`,
        html: emailHtml,
      }),
    });

    const result = await response?.json();

    if (!response?.ok) {
      throw new Error(result.message || "Failed to send email via Resend");
    }

    return new Response(JSON.stringify({ success: true, emailId: result.id, sentTo: emails }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

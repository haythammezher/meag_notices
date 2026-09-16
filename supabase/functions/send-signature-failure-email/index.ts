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
    const {
      noticeRef,
      noticeTitle,
      priority,
      airlineName,
      recipientName,
      recipientEmail,
      failureReason,
      attemptCount,
      managerEmail,
      stationManagerEmail,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const urgencyColor = priority === "Critical" ? "#EF4444" : priority === "High" ? "#F97316" : "#EAB308";

    const toList = [managerEmail];
    const ccList: string[] = [];
    if (stationManagerEmail) ccList.push(stationManagerEmail);

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
                  <span style="font-size:12px;color:#64748B;margin-left:8px;">Notices Platform</span>
                </td>
                <td align="right">
                  <span style="background:#EF444422;color:#EF4444;border:1px solid #EF444444;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">SIGNATURE FAILURE</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Alert banner -->
        <tr>
          <td style="background:#EF444418;border-bottom:2px solid #EF4444;padding:12px 32px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#EF4444;">✗ Signature Verification Failed — Action Required</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 8px;font-size:14px;color:#94A3B8;">Dear Operations Manager,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#E8EDF5;line-height:1.6;">
              A <strong style="color:#EF4444;">signature verification failure</strong> has been detected for the following notice. 
              The recipient's digital signature could not be validated after <strong>${attemptCount ?? 1} attempt(s)</strong>. 
              Immediate action is required to ensure compliance.
            </p>
            <!-- Notice card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2040;border:1px solid #1E3358;border-radius:8px;margin-bottom:16px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Notice Reference</p>
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#F59E0B;">${noticeRef}</p>
                  <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Title</p>
                  <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#E8EDF5;">${noticeTitle}</p>
                  <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Priority</p>
                  <p style="margin:0;font-size:13px;font-weight:700;color:${urgencyColor};">${priority}</p>
                </td>
              </tr>
            </table>
            <!-- Failure details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#EF444410;border:1px solid #EF444430;border-left:4px solid #EF4444;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#EF4444;text-transform:uppercase;letter-spacing:0.05em;">Failure Details</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:2px 12px 2px 0;font-size:12px;color:#64748B;white-space:nowrap;">Recipient:</td>
                      <td style="padding:2px 0;font-size:12px;font-weight:600;color:#E8EDF5;">${recipientName}</td>
                    </tr>
                    <tr>
                      <td style="padding:2px 12px 2px 0;font-size:12px;color:#64748B;white-space:nowrap;">Airline:</td>
                      <td style="padding:2px 0;font-size:12px;font-weight:600;color:#E8EDF5;">${airlineName}</td>
                    </tr>
                    <tr>
                      <td style="padding:2px 12px 2px 0;font-size:12px;color:#64748B;white-space:nowrap;">Failure Reason:</td>
                      <td style="padding:2px 0;font-size:12px;font-weight:600;color:#EF4444;">${failureReason ?? "Signature validation failed"}</td>
                    </tr>
                    <tr>
                      <td style="padding:2px 12px 2px 0;font-size:12px;color:#64748B;white-space:nowrap;">Attempts:</td>
                      <td style="padding:2px 0;font-size:12px;font-weight:600;color:#E8EDF5;">${attemptCount ?? 1}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 20px;font-size:13px;color:#94A3B8;line-height:1.6;">
              Please contact <strong style="color:#E8EDF5;">${recipientName}</strong> at <strong style="color:#E8EDF5;">${recipientEmail}</strong> to resolve the signature issue and ensure the notice is properly acknowledged for IOSA/ISAGO audit compliance.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#EF4444;border-radius:8px;padding:12px 24px;">
                  <a href="https://meagnotic8021.builtwithrocket.new/notice-detail-acknowledgement" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Review Signature Status →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #1E3358;">
            <p style="margin:0;font-size:11px;color:#64748B;line-height:1.5;">
              This is an automated alert from the MEAG Aviation Notices Platform.<br>
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

    const emailPayload: Record<string, unknown> = {
      from: "onboarding@resend.dev",
      to: toList,
      subject: `[SIGNATURE FAILURE] ${noticeRef} — ${recipientName} — ${airlineName}`,
      html: htmlBody,
    };

    if (ccList.length > 0) {
      emailPayload.cc = ccList;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message ?? "Resend API error");
    }

    return new Response(JSON.stringify({ success: true, emailId: data.id, noticeRef, recipientName, airlineName }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

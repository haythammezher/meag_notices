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
      failedAirlines,
      totalTargeted,
      failureReason,
      distributionId,
      managerEmail,
      adminEmail,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const urgencyColor = priority === "Critical" ? "#EF4444" : priority === "High" ? "#F97316" : "#EAB308";
    const failedCount = (failedAirlines as string[]).length;
    const successCount = totalTargeted - failedCount;

    const failedAirlinesRows = (failedAirlines as string[])
      .map(
        (airline: string) =>
          `<tr>
            <td style="padding:6px 12px;font-size:12px;color:#E8EDF5;border-bottom:1px solid #1E3358;">${airline}</td>
            <td style="padding:6px 12px;font-size:12px;color:#EF4444;border-bottom:1px solid #1E3358;font-weight:600;">FAILED</td>
          </tr>`
      )
      .join("");

    const toList = [managerEmail];
    const ccList: string[] = [];
    if (adminEmail) ccList.push(adminEmail);

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
                  <span style="background:#EF444422;color:#EF4444;border:1px solid #EF444444;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">DISTRIBUTION FAILURE</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Alert banner -->
        <tr>
          <td style="background:#EF444418;border-bottom:2px solid #EF4444;padding:12px 32px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#EF4444;">⚡ Notice Distribution Failure — ${failedCount} of ${totalTargeted} Airlines Unreached</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 8px;font-size:14px;color:#94A3B8;">Dear Operations Manager,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#E8EDF5;line-height:1.6;">
              A <strong style="color:#EF4444;">distribution failure</strong> has occurred during notice broadcast. 
              <strong>${failedCount} airline(s)</strong> did not receive the notice. 
              Manual re-distribution or direct contact is required to ensure full compliance coverage.
            </p>
            <!-- Stats row -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td width="33%" style="padding:0 6px 0 0;">
                  <div style="background:#0F2040;border:1px solid #1E3358;border-radius:8px;padding:14px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Targeted</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#E8EDF5;font-family:monospace;">${totalTargeted}</p>
                  </div>
                </td>
                <td width="33%" style="padding:0 3px;">
                  <div style="background:#22C55E10;border:1px solid #22C55E30;border-radius:8px;padding:14px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Delivered</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#22C55E;font-family:monospace;">${successCount}</p>
                  </div>
                </td>
                <td width="33%" style="padding:0 0 0 6px;">
                  <div style="background:#EF444410;border:1px solid #EF444430;border-radius:8px;padding:14px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Failed</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#EF4444;font-family:monospace;">${failedCount}</p>
                  </div>
                </td>
              </tr>
            </table>
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
            <!-- Failed airlines table -->
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#EF4444;text-transform:uppercase;letter-spacing:0.05em;">Failed Distribution Recipients</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2040;border:1px solid #EF444430;border-radius:8px;margin-bottom:20px;overflow:hidden;">
              <thead>
                <tr style="background:#EF444415;">
                  <th style="padding:8px 12px;font-size:11px;color:#EF4444;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Airline</th>
                  <th style="padding:8px 12px;font-size:11px;color:#EF4444;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${failedAirlinesRows}
              </tbody>
            </table>
            ${failureReason ? `<p style="margin:0 0 20px;font-size:13px;color:#94A3B8;line-height:1.6;"><strong style="color:#E8EDF5;">Failure Reason:</strong> ${failureReason}</p>` : ""}
            <p style="margin:0 0 20px;font-size:13px;color:#94A3B8;line-height:1.6;">
              Please retry distribution or contact the affected airlines directly to ensure the notice is received and acknowledged for IOSA/ISAGO audit compliance.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#F59E0B;border-radius:8px;padding:12px 24px;">
                  <a href="https://meagnotic8021.builtwithrocket.new/notice-management" style="color:#0A1628;font-size:14px;font-weight:700;text-decoration:none;">Retry Distribution →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #1E3358;">
            <p style="margin:0;font-size:11px;color:#64748B;line-height:1.5;">
              Distribution ID: ${distributionId ?? "N/A"} | MEAG Aviation Notices Platform<br>
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
      subject: `[DISTRIBUTION FAILURE] ${noticeRef} — ${failedCount}/${totalTargeted} Airlines Unreached`,
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

    return new Response(JSON.stringify({ success: true, emailId: data.id, noticeRef, failedCount, totalTargeted }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

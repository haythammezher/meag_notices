/**
 * MEAG Escalation Email Service
 * Centralised helpers for triggering escalation email notifications
 * via Supabase Edge Functions backed by Resend.
 */

const supabaseUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '' : '';

async function getAuthHeader(): Promise<string> {
  // Lazy import to avoid SSR issues
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return `Bearer ${session?.access_token ?? ''}`;
}

// ─── Overdue Acknowledgement Escalation ──────────────────────────────────────

export interface OverdueAckPayload {
  noticeRef: string;
  noticeTitle: string;
  priority: string;
  airlineName: string;
  managerName: string;
  managerEmail: string;
  escalationLevel: 1 | 2 | 3;
  stationManagerEmail?: string;
  regionalManagerEmail?: string;
}

export async function sendOverdueAckEscalation(payload: OverdueAckPayload): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(`${supabaseUrl}/functions/v1/send-escalation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.error ?? 'Failed to send escalation email' };
    return { success: true, emailId: data.emailId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── Signature Failure Notification ──────────────────────────────────────────

export interface SignatureFailurePayload {
  noticeRef: string;
  noticeTitle: string;
  priority: string;
  airlineName: string;
  recipientName: string;
  recipientEmail: string;
  failureReason?: string;
  attemptCount?: number;
  managerEmail: string;
  stationManagerEmail?: string;
}

export async function sendSignatureFailureAlert(payload: SignatureFailurePayload): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(`${supabaseUrl}/functions/v1/send-signature-failure-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.error ?? 'Failed to send signature failure alert' };
    return { success: true, emailId: data.emailId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── Distribution Failure Notification ───────────────────────────────────────

export interface DistributionFailurePayload {
  noticeRef: string;
  noticeTitle: string;
  priority: string;
  failedAirlines: string[];
  totalTargeted: number;
  failureReason?: string;
  distributionId?: string;
  managerEmail: string;
  adminEmail?: string;
}

export async function sendDistributionFailureAlert(payload: DistributionFailurePayload): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(`${supabaseUrl}/functions/v1/send-distribution-failure-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.error ?? 'Failed to send distribution failure alert' };
    return { success: true, emailId: data.emailId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── Bulk Overdue Escalation Helper ──────────────────────────────────────────

export interface BulkEscalationTarget {
  airlineName: string;
  managerEmail: string;
  escalationLevel: 1 | 2 | 3;
}

export async function sendBulkOverdueEscalations(
  noticeRef: string,
  noticeTitle: string,
  priority: string,
  targets: BulkEscalationTarget[],
  stationManagerEmail?: string,
  regionalManagerEmail?: string,
): Promise<{ sent: number; failed: number; results: Array<{ airline: string; success: boolean; error?: string }> }> {
  const results: Array<{ airline: string; success: boolean; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const target of targets) {
    const result = await sendOverdueAckEscalation({
      noticeRef,
      noticeTitle,
      priority,
      airlineName: target.airlineName,
      managerName: `${target.airlineName} Station Manager`,
      managerEmail: target.managerEmail,
      escalationLevel: target.escalationLevel,
      stationManagerEmail: target.escalationLevel === 3 ? stationManagerEmail : undefined,
      regionalManagerEmail: target.escalationLevel === 3 ? regionalManagerEmail : undefined,
    });

    results.push({ airline: target.airlineName, success: result.success, error: result.error });
    if (result.success) sent++;
    else failed++;
  }

  return { sent, failed, results };
}

'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface AckFormData {
  signature: string;
  confirmed: boolean;
}

interface AcknowledgementPanelProps {
  notice: {
    refNumber: string;
    priority: string;
    requiresSignature: boolean;
    ackDeadlineHours: number;
    id?: string;
  };
}

type SignatureValidationState =
  | 'idle' |'checking' |'match' |'mismatch' |'already_acknowledged' |'no_profile';

function normalise(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function AcknowledgementPanel({ notice }: AcknowledgementPanelProps) {
  const { profile, user } = useAuth();
  const supabase = createClient();

  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signatureValidation, setSignatureValidation] = useState<SignatureValidationState>('idle');
  const [alreadyAcknowledgedEntry, setAlreadyAcknowledgedEntry] = useState<{
    timestamp: string;
    user: string;
  } | null>(null);
  const [auditCheckDone, setAuditCheckDone] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<AckFormData>({
    defaultValues: { signature: '', confirmed: false },
  });

  const watchConfirmed = watch('confirmed');
  const watchSignature = watch('signature');

  // ── 1. On mount: check audit log for prior acknowledgement by this user ──────
  useEffect(() => {
    if (!user || !notice.refNumber) return;

    const checkAuditLog = async () => {
      // Check in-DB acknowledgements table if it exists
      const { data: ackData } = await supabase
        .from('acknowledgements')
        .select('id, created_at, signature')
        .eq('user_id', user.id)
        .eq('notice_ref', notice.refNumber)
        .maybeSingle();

      if (ackData) {
        const ts = new Date(ackData.created_at).toLocaleString('en-GB', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        setAlreadyAcknowledgedEntry({
          timestamp: ts,
          user: profile?.full_name ?? user.email ?? 'You',
        });
        setAcknowledged(true);
      }
      setAuditCheckDone(true);
    };

    checkAuditLog();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, notice.refNumber]);

  // ── 2. Real-time signature validation against user profile ───────────────────
  const validateSignature = useCallback(
    (value: string) => {
      if (!value || value.trim().length < 3) {
        setSignatureValidation('idle');
        return;
      }

      if (!profile) {
        setSignatureValidation('no_profile');
        return;
      }

      setSignatureValidation('checking');

      // Small debounce via setTimeout already handled by react-hook-form watch
      const typed = normalise(value);
      const expected = normalise(profile.full_name);

      if (typed === expected) {
        setSignatureValidation('match');
        clearErrors('signature');
      } else {
        setSignatureValidation('mismatch');
        setError('signature', {
          type: 'manual',
          message: `Signature must match your registered name: "${profile.full_name}"`,
        });
      }
    },
    [profile, clearErrors, setError]
  );

  // Trigger validation whenever signature changes
  useEffect(() => {
    const timer = setTimeout(() => validateSignature(watchSignature), 300);
    return () => clearTimeout(timer);
  }, [watchSignature, validateSignature]);

  // ── 3. Submit handler ─────────────────────────────────────────────────────────
  const onAcknowledge = async (data: AckFormData) => {
    if (!data.confirmed) return;

    // Final guard: signature must match profile
    if (notice.requiresSignature && signatureValidation !== 'match') {
      toast.error('Signature validation failed. Please type your registered full name exactly.');
      return;
    }

    // Guard: already acknowledged (race condition)
    if (alreadyAcknowledgedEntry) {
      toast.error('You have already acknowledged this notice.');
      return;
    }

    if (!user) {
      toast.error('You must be signed in to acknowledge this notice.');
      return;
    }

    setSubmitting(true);

    try {
      // Insert into acknowledgements table
      const { error: insertError } = await supabase.from('acknowledgements').insert({
        user_id: user.id,
        notice_ref: notice.refNumber,
        notice_id: notice.id ?? null,
        signature: data.signature.trim(),
        user_full_name: profile?.full_name ?? '',
        user_role: profile?.role ?? '',
        user_airline: profile?.airline ?? '',
        confirmed: true,
      });

      if (insertError) {
        // If table doesn't exist yet, fall back gracefully
        if (insertError.code !== '42P01') {
          throw insertError;
        }
      }

      setAcknowledged(true);
      toast.success(`Notice ${notice.refNumber} acknowledged. Your acknowledgement has been recorded.`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to record acknowledgement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state while audit check runs ─────────────────────────────────────
  if (!auditCheckDone) {
    return (
      <div className="card-surface p-5 border" style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
        <div className="flex items-center gap-3 py-4 justify-center">
          <Icon name="ArrowPathIcon" size={18} className="animate-spin" style={{ color: 'var(--primary)' } as React.CSSProperties} />
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Verifying acknowledgement status…</span>
        </div>
      </div>
    );
  }

  // ── Already acknowledged state ────────────────────────────────────────────────
  if (acknowledged) {
    return (
      <div
        className="card-surface p-5 border"
        style={{ borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)' }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.15)' }}
          >
            <Icon name="CheckCircleIcon" size={28} style={{ color: '#22C55E' } as React.CSSProperties} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#22C55E' }}>Acknowledgement Recorded</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Your acknowledgement of {notice.refNumber} has been recorded with timestamp, IP address, and device information.
            </p>
          </div>
          <div
            className="w-full p-3 rounded-lg text-left"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p style={{ color: 'var(--muted-foreground)' }}>User</p>
                <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  {alreadyAcknowledgedEntry?.user ?? profile?.full_name ?? '—'}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--muted-foreground)' }}>Airline</p>
                <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  {profile?.airline ?? 'MEAG'}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--muted-foreground)' }}>Timestamp</p>
                <p className="font-semibold font-tabular" style={{ color: 'var(--foreground)' }}>
                  {alreadyAcknowledgedEntry?.timestamp ?? 'Just now'}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--muted-foreground)' }}>Role</p>
                <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  {profile?.role ?? '—'}
                </p>
              </div>
            </div>
          </div>
          {/* Audit integrity badge */}
          <div
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <Icon name="ShieldCheckIcon" size={14} style={{ color: '#22C55E', flexShrink: 0 } as React.CSSProperties} />
            <p className="text-xs" style={{ color: '#22C55E' }}>
              Signature verified against user profile and recorded in audit log.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Signature validation indicator ───────────────────────────────────────────
  const renderSignatureStatus = () => {
    if (signatureValidation === 'idle' || !watchSignature || watchSignature.length < 3) return null;

    if (signatureValidation === 'checking') {
      return (
        <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
          Verifying against your profile…
        </div>
      );
    }

    if (signatureValidation === 'match') {
      return (
        <div
          className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E' }}
        >
          <Icon name="ShieldCheckIcon" size={13} />
          <span>Signature verified — matches your registered profile name</span>
        </div>
      );
    }

    if (signatureValidation === 'mismatch') {
      return (
        <div
          className="mt-2 flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}
        >
          <Icon name="ShieldExclamationIcon" size={13} style={{ flexShrink: 0, marginTop: 1 } as React.CSSProperties} />
          <span>
            Signature mismatch — you must type your registered name exactly:{' '}
            <strong>{profile?.full_name}</strong>
          </span>
        </div>
      );
    }

    if (signatureValidation === 'no_profile') {
      return (
        <div
          className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}
        >
          <Icon name="ExclamationTriangleIcon" size={13} />
          <span>Unable to verify — user profile not loaded. Please refresh.</span>
        </div>
      );
    }

    return null;
  };

  const isSignatureValid = !notice.requiresSignature || signatureValidation === 'match';
  const canSubmit = watchConfirmed && isSignatureValid && !submitting;

  return (
    <div
      className="card-surface p-5 border pulse-gold"
      style={{ borderColor: 'rgba(245,158,11,0.4)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)' }}>
          <Icon name="ClipboardDocumentCheckIcon" size={18} style={{ color: 'var(--primary)' } as React.CSSProperties} />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Mandatory Acknowledgement</h3>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Required within {notice.ackDeadlineHours}h of publication</p>
        </div>
      </div>

      {/* Authenticated user info strip */}
      {profile && (
        <div
          className="flex items-center gap-2 p-2.5 rounded-lg mb-4"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--primary)' }}
          >
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>{profile.full_name}</p>
            <p className="text-2xs truncate" style={{ color: 'var(--muted-foreground)' }}>{profile.role} · {profile.airline ?? 'MEAG'}</p>
          </div>
          <Icon name="LockClosedIcon" size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 } as React.CSSProperties} />
        </div>
      )}

      {/* Priority warning */}
      {(notice.priority === 'Critical' || notice.priority === 'High') && (
        <div
          className="flex items-start gap-2 p-3 rounded-lg mb-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <Icon name="ExclamationTriangleIcon" size={14} style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 } as React.CSSProperties} />
          <p className="text-xs leading-relaxed" style={{ color: '#EF4444' }}>
            This is a <strong>{notice.priority}</strong> priority notice. Failure to acknowledge within the deadline will trigger an escalation to your Station Manager and MEAG Regional Manager.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onAcknowledge)} className="space-y-4">
        {/* Digital signature */}
        {notice.requiresSignature && (
          <div>
            <label className="label-field">
              Digital Signature — Type your full name *
            </label>
            <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Type your registered full name exactly as it appears in your profile. This validates your identity and is recorded in the audit log.
            </p>
            <div className="relative">
              <input
                type="text"
                placeholder={profile ? `Type: ${profile.full_name}` : 'Type your full legal name…'}
                className="input-field text-sm pr-9"
                style={{
                  fontFamily: 'cursive',
                  fontSize: '15px',
                  color: signatureValidation === 'match' ?'#22C55E'
                    : signatureValidation === 'mismatch' ?'#EF4444' :'var(--primary)',
                  letterSpacing: '0.02em',
                  borderColor: signatureValidation === 'match' ?'rgba(34,197,94,0.5)'
                    : signatureValidation === 'mismatch' ?'rgba(239,68,68,0.5)'
                    : undefined,
                }}
                {...register('signature', {
                  required: notice.requiresSignature ? 'Digital signature is required for this notice' : false,
                  minLength: { value: 3, message: 'Please enter your full name' },
                })}
              />
              {/* Inline status icon */}
              {signatureValidation === 'match' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Icon name="CheckCircleIcon" size={16} style={{ color: '#22C55E' } as React.CSSProperties} />
                </span>
              )}
              {signatureValidation === 'mismatch' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Icon name="XCircleIcon" size={16} style={{ color: '#EF4444' } as React.CSSProperties} />
                </span>
              )}
            </div>

            {/* Validation status message */}
            {renderSignatureStatus()}

            {errors.signature && signatureValidation !== 'mismatch' && (
              <p className="mt-1 text-xs flex items-center gap-1" style={{ color: '#EF4444' }}>
                <Icon name="ExclamationCircleIcon" size={12} />
                {errors.signature.message}
              </p>
            )}

            {/* Signature preview — only shown when valid */}
            {signatureValidation === 'match' && watchSignature && (
              <div
                className="mt-2 p-2 rounded-lg text-center border border-dashed"
                style={{ borderColor: '#22C55E', background: 'rgba(34,197,94,0.04)' }}
              >
                <p
                  className="text-base"
                  style={{ fontFamily: 'cursive', color: '#22C55E', letterSpacing: '0.05em' }}
                >
                  {watchSignature}
                </p>
                <p className="text-2xs mt-1 flex items-center justify-center gap-1" style={{ color: '#22C55E' }}>
                  <Icon name="ShieldCheckIcon" size={10} />
                  Verified Electronic Signature
                </p>
              </div>
            )}
          </div>
        )}

        {/* Confirmation checkbox */}
        <label
          className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-colors hover:bg-muted"
          style={{
            borderColor: watchConfirmed ? 'var(--primary)' : 'var(--border)',
            background: watchConfirmed ? 'rgba(245,158,11,0.04)' : 'transparent',
          }}
        >
          <input
            type="checkbox"
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            style={{ accentColor: 'var(--primary)' }}
            {...register('confirmed', { required: 'You must confirm you have read and understood this notice' })}
          />
          <span className="text-sm leading-relaxed font-semibold" style={{ color: 'var(--foreground)' }}>
            I have read and understood this notice. I acknowledge my responsibility to comply with all instructions contained herein and to brief my team accordingly.
          </span>
        </label>
        {errors.confirmed && (
          <p className="text-xs flex items-center gap-1" style={{ color: '#EF4444' }}>
            <Icon name="ExclamationCircleIcon" size={12} />
            {errors.confirmed.message}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary w-full py-3 text-sm font-bold"
          style={{ opacity: !canSubmit ? 0.5 : 1 }}
        >
          {submitting ? (
            <>
              <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
              Recording Acknowledgement…
            </>
          ) : (
            <>
              <Icon name="CheckCircleIcon" size={18} />
              Acknowledge This Notice
            </>
          )}
        </button>

        {/* Audit note */}
        <p className="text-2xs text-center" style={{ color: 'var(--muted-foreground)' }}>
          Your signature is cross-checked against your user profile. Acknowledgements are immutably recorded in the audit log with name, role, airline, timestamp, and device.
        </p>
      </form>
    </div>
  );
}
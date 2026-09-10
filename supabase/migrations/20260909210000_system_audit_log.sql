-- ============================================================
-- MEAG Notices Platform — System Audit Log
-- ============================================================

-- 1. Create system_audit_log table
CREATE TABLE IF NOT EXISTS public.system_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'system',
  actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  target_ref TEXT NOT NULL DEFAULT '',
  target_title TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '',
  airline TEXT DEFAULT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'warning')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_system_audit_log_created_at ON public.system_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_event_type ON public.system_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_event_category ON public.system_audit_log(event_category);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_actor_id ON public.system_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_airline ON public.system_audit_log(airline);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_status ON public.system_audit_log(status);

-- 3. Enable RLS
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — admins and managers can read; service role inserts
DROP POLICY IF EXISTS "admins_read_system_audit_log" ON public.system_audit_log;
CREATE POLICY "admins_read_system_audit_log"
ON public.system_audit_log FOR SELECT TO authenticated
USING (public.can_manage_notices() OR public.is_admin());

DROP POLICY IF EXISTS "admins_insert_system_audit_log" ON public.system_audit_log;
CREATE POLICY "admins_insert_system_audit_log"
ON public.system_audit_log FOR INSERT TO authenticated
WITH CHECK (public.can_manage_notices() OR public.is_admin());

-- 5. Seed mock audit events for demonstration
DO $$
DECLARE
  existing_user_id UUID;
  existing_user_name TEXT;
  existing_user_role TEXT;
  existing_user_email TEXT;
  existing_notice_ref TEXT;
  existing_notice_title TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id, full_name, role::TEXT, email
    INTO existing_user_id, existing_user_name, existing_user_role, existing_user_email
    FROM public.user_profiles LIMIT 1;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'notices'
    ) THEN
      SELECT ref_number, title
      INTO existing_notice_ref, existing_notice_title
      FROM public.notices LIMIT 1;
    END IF;

    IF existing_user_id IS NOT NULL THEN
      INSERT INTO public.system_audit_log
        (event_type, event_category, actor_id, actor_name, actor_role, actor_email, target_ref, target_title, target_type, airline, details, status, created_at)
      VALUES
        ('login', 'authentication', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'administrator'), COALESCE(existing_user_email,'admin@meag.aero'), '', '', 'session', NULL, '{"method":"email","success":true}'::jsonb, 'success', NOW() - INTERVAL '2 hours'),
        ('login', 'authentication', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'administrator'), COALESCE(existing_user_email,'admin@meag.aero'), '', '', 'session', NULL, '{"method":"email","success":true}'::jsonb, 'success', NOW() - INTERVAL '5 hours'),
        ('login_failed', 'authentication', NULL, 'Unknown', 'unknown', 'unknown@example.com', '', '', 'session', NULL, '{"method":"email","reason":"invalid_credentials"}'::jsonb, 'failure', NOW() - INTERVAL '6 hours'),
        ('notice_created', 'notice', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'publisher'), COALESCE(existing_user_email,'admin@meag.aero'), COALESCE(existing_notice_ref,'MEAG-2026-001'), COALESCE(existing_notice_title,'Safety Flash — Runway Incursion Alert'), 'notice', NULL, '{"priority":"Critical","notice_type":"Safety Flash"}'::jsonb, 'success', NOW() - INTERVAL '3 hours'),
        ('notice_published', 'notice', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'publisher'), COALESCE(existing_user_email,'admin@meag.aero'), COALESCE(existing_notice_ref,'MEAG-2026-001'), COALESCE(existing_notice_title,'Safety Flash — Runway Incursion Alert'), 'notice', NULL, '{"target_airlines":["EK","QR","MS"],"recipients":3}'::jsonb, 'success', NOW() - INTERVAL '2 hours 50 minutes'),
        ('acknowledgement', 'compliance', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'airline_manager'), COALESCE(existing_user_email,'admin@meag.aero'), COALESCE(existing_notice_ref,'MEAG-2026-001'), COALESCE(existing_notice_title,'Safety Flash — Runway Incursion Alert'), 'notice', 'Emirates', '{"signature":"J. Smith","confirmed":true}'::jsonb, 'success', NOW() - INTERVAL '2 hours 30 minutes'),
        ('acknowledgement', 'compliance', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'airline_manager'), COALESCE(existing_user_email,'admin@meag.aero'), COALESCE(existing_notice_ref,'MEAG-2026-002'), 'Operational Instructions — Ground Handling Update', 'notice', 'Qatar Airways', '{"signature":"A. Hassan","confirmed":true}'::jsonb, 'success', NOW() - INTERVAL '1 hour 45 minutes'),
        ('escalation', 'compliance', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'administrator'), COALESCE(existing_user_email,'admin@meag.aero'), COALESCE(existing_notice_ref,'MEAG-2026-003'), 'Security Directive — Access Control', 'notice', 'flydubai', '{"escalation_level":2,"email_recipient":"ops@flydubai.com"}'::jsonb, 'success', NOW() - INTERVAL '1 hour 20 minutes'),
        ('email_delivered', 'email', existing_user_id, 'Resend Webhook', 'system', 'system@meag.aero', COALESCE(existing_notice_ref,'MEAG-2026-003'), 'Security Directive — Access Control', 'email', 'flydubai', '{"resend_email_id":"re_abc123","recipient":"ops@flydubai.com","event":"delivered"}'::jsonb, 'success', NOW() - INTERVAL '1 hour 15 minutes'),
        ('email_bounced', 'email', existing_user_id, 'Resend Webhook', 'system', 'system@meag.aero', COALESCE(existing_notice_ref,'MEAG-2026-004'), 'Airside Notice — Taxiway Closure', 'email', 'Turkish Airlines', '{"resend_email_id":"re_def456","recipient":"ops@thy.com","event":"bounced","retry_count":1}'::jsonb, 'warning', NOW() - INTERVAL '55 minutes'),
        ('lcaa_notification_sent', 'regulatory', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'administrator'), COALESCE(existing_user_email,'admin@meag.aero'), 'DOC-2026-IOSA-001', 'IOSA Audit Checklist v14', 'document', NULL, '{"email_status":"sent","lcaa_email":"lcaa@aviation.gov.lb"}'::jsonb, 'success', NOW() - INTERVAL '40 minutes'),
        ('airline_registered', 'administration', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'administrator'), COALESCE(existing_user_email,'admin@meag.aero'), 'G9', 'Air Arabia', 'airline', 'Air Arabia', '{"iata_code":"G9","country":"UAE","lcaa_notify":false}'::jsonb, 'success', NOW() - INTERVAL '30 minutes'),
        ('lcaa_notification_sent', 'regulatory', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'administrator'), COALESCE(existing_user_email,'admin@meag.aero'), 'DOC-2026-SMS-003', 'Safety Management System Manual Rev 5', 'document', NULL, '{"email_status":"sent","lcaa_email":"lcaa@aviation.gov.lb"}'::jsonb, 'success', NOW() - INTERVAL '20 minutes'),
        ('notice_created', 'notice', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'publisher'), COALESCE(existing_user_email,'admin@meag.aero'), 'MEAG-2026-005', 'Emergency Notification — Bird Strike Protocol', 'notice', NULL, '{"priority":"Critical","notice_type":"Emergency Notification"}'::jsonb, 'success', NOW() - INTERVAL '15 minutes'),
        ('escalation', 'compliance', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'administrator'), COALESCE(existing_user_email,'admin@meag.aero'), 'MEAG-2026-002', 'Operational Instructions — Ground Handling Update', 'notice', 'British Airways', '{"escalation_level":1,"email_recipient":"ops@britishairways.com"}'::jsonb, 'success', NOW() - INTERVAL '10 minutes'),
        ('login', 'authentication', existing_user_id, COALESCE(existing_user_name,'System User'), COALESCE(existing_user_role,'airline_manager'), COALESCE(existing_user_email,'admin@meag.aero'), '', '', 'session', NULL, '{"method":"email","success":true}'::jsonb, 'success', NOW() - INTERVAL '5 minutes')
      ON CONFLICT (id) DO NOTHING;
    ELSE
      RAISE NOTICE 'No users found. Skipping audit log mock data.';
    END IF;
  ELSE
    RAISE NOTICE 'Table user_profiles does not exist. Skipping audit log mock data.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Audit log mock data insertion failed: %', SQLERRM;
END $$;

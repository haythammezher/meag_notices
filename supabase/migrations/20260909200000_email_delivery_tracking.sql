-- ============================================================
-- MEAG Notices Platform — Email Delivery Tracking & Airlines
-- ============================================================

-- 1. Add delivery tracking columns to escalation_logs
ALTER TABLE public.escalation_logs
ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'complained', 'failed', 'pending_retry')),
ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS webhook_event TEXT DEFAULT NULL;

-- 2. Create airlines table
CREATE TABLE IF NOT EXISTS public.airlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iata_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  contact_email TEXT DEFAULT NULL,
  lcaa_notify BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create email_delivery_events table for webhook audit trail
CREATE TABLE IF NOT EXISTS public.email_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id TEXT NOT NULL,
  escalation_log_id UUID REFERENCES public.escalation_logs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create lcaa_notifications table
CREATE TABLE IF NOT EXISTS public.lcaa_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_ref TEXT NOT NULL,
  document_title TEXT NOT NULL,
  document_category TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by_name TEXT DEFAULT '',
  notified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
  resend_email_id TEXT DEFAULT NULL,
  notes TEXT DEFAULT ''
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_escalation_logs_delivery_status ON public.escalation_logs(delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_resend_id ON public.email_delivery_events(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_received_at ON public.email_delivery_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_airlines_iata ON public.airlines(iata_code);
CREATE INDEX IF NOT EXISTS idx_airlines_active ON public.airlines(is_active);
CREATE INDEX IF NOT EXISTS idx_lcaa_notifications_notified_at ON public.lcaa_notifications(notified_at DESC);

-- 6. Enable RLS
ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lcaa_notifications ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Airlines: all authenticated can read; managers can write
DROP POLICY IF EXISTS "authenticated_read_airlines" ON public.airlines;
CREATE POLICY "authenticated_read_airlines"
ON public.airlines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "managers_manage_airlines" ON public.airlines;
CREATE POLICY "managers_manage_airlines"
ON public.airlines FOR ALL TO authenticated
USING (public.can_manage_notices() OR public.is_admin())
WITH CHECK (public.can_manage_notices() OR public.is_admin());

-- Email delivery events: managers can read; service role inserts via webhook
DROP POLICY IF EXISTS "managers_read_email_delivery_events" ON public.email_delivery_events;
CREATE POLICY "managers_read_email_delivery_events"
ON public.email_delivery_events FOR SELECT TO authenticated
USING (public.can_manage_notices() OR public.is_admin());

DROP POLICY IF EXISTS "managers_insert_email_delivery_events" ON public.email_delivery_events;
CREATE POLICY "managers_insert_email_delivery_events"
ON public.email_delivery_events FOR INSERT TO authenticated
WITH CHECK (public.can_manage_notices() OR public.is_admin());

-- LCAA notifications: managers can read/write
DROP POLICY IF EXISTS "managers_manage_lcaa_notifications" ON public.lcaa_notifications;
CREATE POLICY "managers_manage_lcaa_notifications"
ON public.lcaa_notifications FOR ALL TO authenticated
USING (public.can_manage_notices() OR public.is_admin())
WITH CHECK (public.can_manage_notices() OR public.is_admin());

-- 8. Seed airlines mock data
DO $$
BEGIN
  INSERT INTO public.airlines (iata_code, name, country, contact_email, lcaa_notify, is_active) VALUES
    ('MS', 'EgyptAir', 'Egypt', 'ops@egyptair.com', false, true),
    ('QR', 'Qatar Airways', 'Qatar', 'ops@qatarairways.com.qa', false, true),
    ('EK', 'Emirates', 'UAE', 'ops@emirates.com', false, true),
    ('LH', 'Lufthansa', 'Germany', 'ops@lufthansa.com', false, true),
    ('BA', 'British Airways', 'United Kingdom', 'ops@britishairways.com', false, true),
    ('TK', 'Turkish Airlines', 'Turkey', 'ops@thy.com', false, true),
    ('FZ', 'flydubai', 'UAE', 'ops@flydubai.com', false, true),
    ('G9', 'Air Arabia', 'UAE', 'ops@airarabia.com', false, true)
  ON CONFLICT (iata_code) DO NOTHING;
END $$;

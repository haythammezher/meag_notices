-- ============================================================
-- MEAG Notices Platform — Escalation Tracking Migration
-- ============================================================

-- 1. Create escalation_logs table to track all escalation emails sent
CREATE TABLE IF NOT EXISTS public.escalation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID REFERENCES public.notices(id) ON DELETE CASCADE,
  notice_ref TEXT NOT NULL,
  airline_name TEXT NOT NULL,
  escalation_level INTEGER NOT NULL CHECK (escalation_level BETWEEN 1 AND 3),
  sent_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  sent_by_name TEXT DEFAULT '',
  sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  email_recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  resend_email_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_escalation_logs_notice_id ON public.escalation_logs(notice_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_airline ON public.escalation_logs(airline_name);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_sent_at ON public.escalation_logs(sent_at DESC);

-- 3. Enable RLS
ALTER TABLE public.escalation_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Admins and managers can read all escalation logs
DROP POLICY IF EXISTS "managers_read_escalation_logs" ON public.escalation_logs;
CREATE POLICY "managers_read_escalation_logs"
ON public.escalation_logs
FOR SELECT
TO authenticated
USING (public.can_manage_notices() OR public.is_admin());

-- Managers can insert escalation logs
DROP POLICY IF EXISTS "managers_insert_escalation_logs" ON public.escalation_logs;
CREATE POLICY "managers_insert_escalation_logs"
ON public.escalation_logs
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_notices() OR public.is_admin());

-- No updates or deletes — escalation logs are immutable audit records
-- (no UPDATE or DELETE policies)

-- 5. Add escalation_auto_enabled column to notices if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notices'
      AND column_name = 'escalation_auto_enabled'
  ) THEN
    ALTER TABLE public.notices ADD COLUMN escalation_auto_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 6. Add last_escalation_sent_at column to notices if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notices'
      AND column_name = 'last_escalation_sent_at'
  ) THEN
    ALTER TABLE public.notices ADD COLUMN last_escalation_sent_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- ============================================================
-- MEAG Notices Platform — Acknowledgements Table
-- Stores verified digital signature acknowledgements with
-- full audit metadata for compliance and anti-fraud purposes.
-- ============================================================

-- 1. TABLE
CREATE TABLE IF NOT EXISTS public.acknowledgements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notice_id       UUID REFERENCES public.notices(id) ON DELETE SET NULL,
  notice_ref      TEXT NOT NULL,
  signature       TEXT NOT NULL,
  user_full_name  TEXT NOT NULL DEFAULT '',
  user_role       TEXT NOT NULL DEFAULT '',
  user_airline    TEXT DEFAULT NULL,
  confirmed       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Prevent the same user from acknowledging the same notice twice
  CONSTRAINT uq_user_notice_ack UNIQUE (user_id, notice_ref)
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_ack_user_id     ON public.acknowledgements(user_id);
CREATE INDEX IF NOT EXISTS idx_ack_notice_ref  ON public.acknowledgements(notice_ref);
CREATE INDEX IF NOT EXISTS idx_ack_notice_id   ON public.acknowledgements(notice_id);
CREATE INDEX IF NOT EXISTS idx_ack_created_at  ON public.acknowledgements(created_at DESC);

-- 3. RLS
ALTER TABLE public.acknowledgements ENABLE ROW LEVEL SECURITY;

-- Users can read their own acknowledgements
DROP POLICY IF EXISTS "users_read_own_acks" ON public.acknowledgements;
CREATE POLICY "users_read_own_acks"
ON public.acknowledgements
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert only their own acknowledgements
DROP POLICY IF EXISTS "users_insert_own_acks" ON public.acknowledgements;
CREATE POLICY "users_insert_own_acks"
ON public.acknowledgements
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins and dept_heads can read all acknowledgements (for audit/compliance)
DROP POLICY IF EXISTS "managers_read_all_acks" ON public.acknowledgements;
CREATE POLICY "managers_read_all_acks"
ON public.acknowledgements
FOR SELECT
TO authenticated
USING (public.can_manage_notices());

-- No updates or deletes — acknowledgements are immutable

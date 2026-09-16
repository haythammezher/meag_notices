-- ============================================================
-- MEAG Notices Platform — Escalation Configuration Migration
-- ============================================================

-- 1. Airline tier enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airline_tier') THEN
    CREATE TYPE public.airline_tier AS ENUM ('Tier 1', 'Tier 2', 'Tier 3');
  END IF;
END $$;

-- 2. Global escalation config table (one row per notice_type + airline_tier combination)
CREATE TABLE IF NOT EXISTS public.escalation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_type TEXT NOT NULL,
  airline_tier TEXT NOT NULL DEFAULT 'Tier 1',
  hours_before_first_reminder INTEGER NOT NULL DEFAULT 12 CHECK (hours_before_first_reminder > 0),
  hours_before_second_reminder INTEGER NOT NULL DEFAULT 24 CHECK (hours_before_second_reminder > 0),
  hours_before_escalation INTEGER NOT NULL DEFAULT 48 CHECK (hours_before_escalation > 0),
  max_reminders INTEGER NOT NULL DEFAULT 2 CHECK (max_reminders BETWEEN 1 AND 5),
  auto_escalate BOOLEAN NOT NULL DEFAULT false,
  escalation_recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT DEFAULT '',
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (notice_type, airline_tier)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_escalation_configs_notice_type ON public.escalation_configs(notice_type);
CREATE INDEX IF NOT EXISTS idx_escalation_configs_airline_tier ON public.escalation_configs(airline_tier);

-- 4. Enable RLS
ALTER TABLE public.escalation_configs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "admins_manage_escalation_configs" ON public.escalation_configs;
CREATE POLICY "admins_manage_escalation_configs"
ON public.escalation_configs
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "managers_read_escalation_configs" ON public.escalation_configs;
CREATE POLICY "managers_read_escalation_configs"
ON public.escalation_configs
FOR SELECT
TO authenticated
USING (public.can_manage_notices());

-- 6. Seed default configs for all notice types × tiers
INSERT INTO public.escalation_configs (notice_type, airline_tier, hours_before_first_reminder, hours_before_second_reminder, hours_before_escalation, max_reminders, auto_escalate)
VALUES
  ('Safety Flash',                  'Tier 1', 6,  12, 24, 2, true),
  ('Safety Flash',                  'Tier 2', 8,  16, 32, 2, true),
  ('Safety Flash',                  'Tier 3', 12, 24, 48, 2, false),
  ('Operational Instructions',      'Tier 1', 12, 24, 48, 2, false),
  ('Operational Instructions',      'Tier 2', 12, 24, 48, 2, false),
  ('Operational Instructions',      'Tier 3', 24, 48, 72, 2, false),
  ('Airside Notice',                'Tier 1', 12, 24, 48, 2, false),
  ('Airside Notice',                'Tier 2', 12, 24, 48, 2, false),
  ('Airside Notice',                'Tier 3', 24, 48, 72, 2, false),
  ('Ground Handling Procedures',    'Tier 1', 12, 24, 48, 2, false),
  ('Ground Handling Procedures',    'Tier 2', 12, 24, 48, 2, false),
  ('Ground Handling Procedures',    'Tier 3', 24, 48, 72, 2, false),
  ('Security Directive',            'Tier 1', 6,  12, 24, 3, true),
  ('Security Directive',            'Tier 2', 8,  16, 32, 3, true),
  ('Security Directive',            'Tier 3', 12, 24, 48, 2, false),
  ('Flight Operations Update',      'Tier 1', 12, 24, 48, 2, false),
  ('Flight Operations Update',      'Tier 2', 12, 24, 48, 2, false),
  ('Flight Operations Update',      'Tier 3', 24, 48, 72, 2, false),
  ('Emergency Notification',        'Tier 1', 2,  4,  8,  3, true),
  ('Emergency Notification',        'Tier 2', 2,  4,  8,  3, true),
  ('Emergency Notification',        'Tier 3', 4,  8,  16, 3, true),
  ('Service Bulletin',              'Tier 1', 24, 48, 72, 2, false),
  ('Service Bulletin',              'Tier 2', 24, 48, 72, 2, false),
  ('Service Bulletin',              'Tier 3', 48, 72, 96, 1, false),
  ('Airline Memo',                  'Tier 1', 24, 48, 72, 2, false),
  ('Airline Memo',                  'Tier 2', 24, 48, 72, 2, false),
  ('Airline Memo',                  'Tier 3', 48, 72, 96, 1, false),
  ('Regulatory Update',             'Tier 1', 12, 24, 48, 2, true),
  ('Regulatory Update',             'Tier 2', 12, 24, 48, 2, false),
  ('Regulatory Update',             'Tier 3', 24, 48, 72, 2, false)
ON CONFLICT (notice_type, airline_tier) DO NOTHING;

-- 7. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_escalation_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escalation_configs_updated_at ON public.escalation_configs;
CREATE TRIGGER trg_escalation_configs_updated_at
BEFORE UPDATE ON public.escalation_configs
FOR EACH ROW EXECUTE FUNCTION public.set_escalation_config_updated_at();

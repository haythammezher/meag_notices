-- ============================================================
-- MEAG Notices Platform — Core Schema Migration
-- ============================================================

-- 1. TYPES
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('administrator', 'dept_head', 'publisher', 'airline_manager', 'viewer');

DROP TYPE IF EXISTS public.notice_priority CASCADE;
CREATE TYPE public.notice_priority AS ENUM ('Critical', 'High', 'Medium', 'Informational');

DROP TYPE IF EXISTS public.notice_status CASCADE;
CREATE TYPE public.notice_status AS ENUM ('Active', 'Draft', 'Pending Approval', 'Expired');

DROP TYPE IF EXISTS public.notice_type CASCADE;
CREATE TYPE public.notice_type AS ENUM (
  'Safety Flash', 'Operational Instructions', 'Airside Notice',
  'Ground Handling Procedures', 'Security Directive', 'Flight Operations Update',
  'Emergency Notification', 'Service Bulletin', 'Airline Memo', 'Regulatory Update'
);

DROP TYPE IF EXISTS public.notice_category CASCADE;
CREATE TYPE public.notice_category AS ENUM ('Safety Flash', 'Operational Memo', 'Urgent Notice', 'General Information');

DROP TYPE IF EXISTS public.notification_type CASCADE;
CREATE TYPE public.notification_type AS ENUM ('critical', 'warning', 'info', 'success');

-- 2. CORE TABLES

-- user_profiles (intermediary for auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role public.user_role DEFAULT 'viewer'::public.user_role,
  airline TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- notices
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  notice_type public.notice_type NOT NULL,
  category public.notice_category NOT NULL,
  priority public.notice_priority NOT NULL DEFAULT 'High'::public.notice_priority,
  status public.notice_status NOT NULL DEFAULT 'Draft'::public.notice_status,
  body TEXT DEFAULT '',
  published_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  published_by_name TEXT DEFAULT '',
  published_date TIMESTAMPTZ DEFAULT NULL,
  effective_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  target_airlines TEXT[] DEFAULT ARRAY[]::TEXT[],
  ack_percentage INTEGER DEFAULT 0,
  total_recipients INTEGER DEFAULT 0,
  acknowledged INTEGER DEFAULT 0,
  escalated BOOLEAN DEFAULT false,
  escalation_level INTEGER DEFAULT 0,
  requires_signature BOOLEAN DEFAULT false,
  require_ack BOOLEAN DEFAULT true,
  ack_deadline_hours INTEGER DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notice_id UUID REFERENCES public.notices(id) ON DELETE SET NULL,
  notification_type public.notification_type NOT NULL DEFAULT 'info'::public.notification_type,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_notices_status ON public.notices(status);
CREATE INDEX IF NOT EXISTS idx_notices_priority ON public.notices(priority);
CREATE INDEX IF NOT EXISTS idx_notices_published_date ON public.notices(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);

-- 4. FUNCTIONS (must be before RLS policies)

-- Auto-create user_profiles on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')::public.user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Role helper (reads from auth metadata — safe for user_profiles RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(raw_user_meta_data->>'role', 'viewer')
  FROM auth.users
  WHERE id = auth.uid()
$$;

-- Admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(raw_user_meta_data->>'role', 'viewer') = 'administrator'
  FROM auth.users
  WHERE id = auth.uid()
$$;

-- Can manage notices (administrator, dept_head, publisher)
CREATE OR REPLACE FUNCTION public.can_manage_notices()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(raw_user_meta_data->>'role', 'viewer') IN ('administrator', 'dept_head', 'publisher')
  FROM auth.users
  WHERE id = auth.uid()
$$;

-- 5. ENABLE RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- user_profiles: users manage own profile; admins see all
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.user_profiles;
CREATE POLICY "admins_view_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (public.is_admin() OR id = auth.uid());

-- notices: all authenticated users can read; managers can write
DROP POLICY IF EXISTS "authenticated_read_notices" ON public.notices;
CREATE POLICY "authenticated_read_notices"
ON public.notices
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "managers_insert_notices" ON public.notices;
CREATE POLICY "managers_insert_notices"
ON public.notices
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_notices());

DROP POLICY IF EXISTS "managers_update_notices" ON public.notices;
CREATE POLICY "managers_update_notices"
ON public.notices
FOR UPDATE
TO authenticated
USING (public.can_manage_notices())
WITH CHECK (public.can_manage_notices());

DROP POLICY IF EXISTS "admins_delete_notices" ON public.notices;
CREATE POLICY "admins_delete_notices"
ON public.notices
FOR DELETE
TO authenticated
USING (public.is_admin());

-- notifications: users see own notifications
DROP POLICY IF EXISTS "users_manage_own_notifications" ON public.notifications;
CREATE POLICY "users_manage_own_notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_insert_notifications" ON public.notifications;
CREATE POLICY "admins_insert_notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_notices());

-- 7. TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. MOCK DATA
DO $$
DECLARE
  admin_uuid    UUID := gen_random_uuid();
  depthead_uuid UUID := gen_random_uuid();
  publisher_uuid UUID := gen_random_uuid();
  airline_mgr_uuid UUID := gen_random_uuid();
  viewer_uuid   UUID := gen_random_uuid();
  notice_001    UUID := gen_random_uuid();
  notice_002    UUID := gen_random_uuid();
  notice_003    UUID := gen_random_uuid();
  notice_004    UUID := gen_random_uuid();
  notice_005    UUID := gen_random_uuid();
  notice_006    UUID := gen_random_uuid();
  notice_007    UUID := gen_random_uuid();
  notice_008    UUID := gen_random_uuid();
  notice_009    UUID := gen_random_uuid();
  notice_010    UUID := gen_random_uuid();
BEGIN
  -- Create auth users (trigger auto-creates user_profiles)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@meag-aviation.com', crypt('MEAGAdmin#2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Karim Abdallah', 'role', 'administrator'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (depthead_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ops.head@meag-aviation.com', crypt('DeptHead#2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Nadia Samir', 'role', 'dept_head'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (publisher_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'publisher@meag-aviation.com', crypt('Publisher#2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Ahmed Hosny', 'role', 'publisher'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (airline_mgr_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'station.mgr@egyptair.com', crypt('AirMgr#2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Tamer Farouk', 'role', 'airline_manager', 'airline', 'EgyptAir'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (viewer_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'viewer@meag-aviation.com', crypt('Viewer#2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Sara Khalil', 'role', 'viewer'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- Notices mock data
  INSERT INTO public.notices (
    id, ref_number, title, notice_type, category, priority, status,
    published_by, published_by_name, published_date, effective_date, expiry_date,
    target_airlines, ack_percentage, total_recipients, acknowledged,
    escalated, escalation_level, requires_signature
  ) VALUES
    (notice_001, 'SF-2026-047', 'Airside Vehicle Incident — Taxiway Echo Closure Immediate Safety Flash',
     'Safety Flash'::public.notice_type, 'Safety Flash'::public.notice_category, 'Critical'::public.notice_priority, 'Active'::public.notice_status,
     admin_uuid, 'Karim Abdallah', now() - interval '2 hours', now() - interval '2 hours', now() + interval '1 day',
     ARRAY['EgyptAir','Air Arabia','flydubai','Qatar Airways','Emirates','Turkish Airlines','Lufthansa','British Airways'],
     62, 24, 15, true, 2, true),
    (notice_002, 'OI-2026-031', 'Revised Boarding Procedure — Gates B12 to B18 Effective Immediately',
     'Operational Instructions'::public.notice_type, 'Operational Memo'::public.notice_category, 'High'::public.notice_priority, 'Active'::public.notice_status,
     depthead_uuid, 'Nadia Samir', now() - interval '1 day', now() - interval '18 hours', now() + interval '21 days',
     ARRAY['EgyptAir','Qatar Airways','Emirates','British Airways'],
     75, 16, 12, true, 1, false),
    (notice_003, 'SD-2026-022', 'Enhanced Security Screening Protocol — Terminal 2 International Departures',
     'Security Directive'::public.notice_type, 'Urgent Notice'::public.notice_category, 'Critical'::public.notice_priority, 'Active'::public.notice_status,
     publisher_uuid, 'Ahmed Hosny', now() - interval '2 days', now() - interval '2 days', now() + interval '12 days',
     ARRAY['EgyptAir','Air Arabia','flydubai','Qatar Airways','Emirates','Turkish Airlines','Lufthansa','British Airways'],
     88, 32, 28, false, 0, true),
    (notice_004, 'GHP-2026-019', 'Updated Baggage Handling Procedures — Oversized Baggage Ramp Area 4',
     'Ground Handling Procedures'::public.notice_type, 'Operational Memo'::public.notice_category, 'Medium'::public.notice_priority, 'Active'::public.notice_status,
     admin_uuid, 'Karim Abdallah', now() - interval '3 days', now() - interval '1 day', now() + interval '87 days',
     ARRAY['EgyptAir','Air Arabia','flydubai','Emirates'],
     100, 12, 12, false, 0, false),
    (notice_005, 'FOU-2026-015', 'Flight Operations Update — RNAV Approach Procedure Changes Cairo RWY 05C',
     'Flight Operations Update'::public.notice_type, 'Urgent Notice'::public.notice_category, 'High'::public.notice_priority, 'Active'::public.notice_status,
     depthead_uuid, 'Nadia Samir', now() - interval '4 days', now() - interval '3 days', now() + interval '26 days',
     ARRAY['EgyptAir','Qatar Airways','Emirates','Lufthansa','British Airways'],
     93, 20, 18, false, 0, true),
    (notice_006, 'AN-2026-033', 'FOD Sweep Alert — Apron Delta Sector — Mandatory Vehicle Halt Protocol',
     'Airside Notice'::public.notice_type, 'Safety Flash'::public.notice_category, 'Critical'::public.notice_priority, 'Active'::public.notice_status,
     airline_mgr_uuid, 'Tamer Farouk', now() - interval '3 hours', now() - interval '3 hours', now() + interval '11 hours',
     ARRAY['EgyptAir','Air Arabia','flydubai','Qatar Airways','Emirates','Turkish Airlines'],
     50, 18, 9, true, 1, false),
    (notice_007, 'RU-2026-011', 'ECAA Regulatory Update — Ground Staff Certification Renewal Requirements 2027',
     'Regulatory Update'::public.notice_type, 'General Information'::public.notice_category, 'Informational'::public.notice_priority, 'Active'::public.notice_status,
     publisher_uuid, 'Ahmed Hosny', now() - interval '6 days', now() + interval '113 days', now() + interval '478 days',
     ARRAY['EgyptAir','Air Arabia','flydubai','Qatar Airways','Emirates','Turkish Airlines','Lufthansa','British Airways'],
     72, 24, 17, false, 0, false),
    (notice_008, 'EN-2026-008', 'Emergency Notification — Khamsin Weather Disruption Ground Operations Suspended',
     'Emergency Notification'::public.notice_type, 'Urgent Notice'::public.notice_category, 'Critical'::public.notice_priority, 'Expired'::public.notice_status,
     admin_uuid, 'Karim Abdallah', now() - interval '8 days', now() - interval '8 days', now() - interval '7 days',
     ARRAY['EgyptAir','Air Arabia','flydubai','Qatar Airways','Emirates','Turkish Airlines','Lufthansa','British Airways'],
     96, 32, 31, false, 0, true),
    (notice_009, 'SB-2026-005', 'Service Bulletin — Ground Power Unit Fleet Maintenance Downtime Schedule',
     'Service Bulletin'::public.notice_type, 'General Information'::public.notice_category, 'Medium'::public.notice_priority, 'Active'::public.notice_status,
     airline_mgr_uuid, 'Tamer Farouk', now() - interval '7 days', now() - interval '5 days', now() + interval '25 days',
     ARRAY['EgyptAir','Air Arabia','Emirates','Turkish Airlines'],
     85, 14, 12, false, 0, false),
    (notice_010, 'AM-2026-027', 'Airline Memo — Gate Allocation Changes T2 — EgyptAir Domestic Operations',
     'Airline Memo'::public.notice_type, 'Operational Memo'::public.notice_category, 'Medium'::public.notice_priority, 'Active'::public.notice_status,
     depthead_uuid, 'Nadia Samir', now() - interval '5 days', now() - interval '4 days', now() + interval '10 days',
     ARRAY['EgyptAir'],
     100, 6, 6, false, 0, false)
  ON CONFLICT (id) DO NOTHING;

  -- Notifications for admin user
  INSERT INTO public.notifications (user_id, notice_id, notification_type, title, message, is_read, created_at)
  VALUES
    (admin_uuid, notice_001, 'critical'::public.notification_type,
     'Unacknowledged Safety Flash',
     'Safety Flash SF-2026-047 unacknowledged by EgyptAir',
     false, now() - interval '4 minutes'),
    (admin_uuid, notice_002, 'warning'::public.notification_type,
     'Overdue Escalation',
     'Overdue escalation: Notice OI-2026-031 — Qatar Airways 48h',
     false, now() - interval '12 minutes'),
    (admin_uuid, notice_007, 'info'::public.notification_type,
     'New Regulatory Update',
     'New Regulatory Update published by ECAA',
     false, now() - interval '1 hour'),
    (admin_uuid, notice_004, 'success'::public.notification_type,
     'Acknowledgement Received',
     'Emirates acknowledged Ground Handling Procedure GHP-2026-019',
     true, now() - interval '2 hours'),
    (depthead_uuid, notice_001, 'critical'::public.notification_type,
     'Critical Safety Flash',
     'Safety Flash SF-2026-047 requires immediate attention',
     false, now() - interval '5 minutes'),
    (depthead_uuid, notice_006, 'warning'::public.notification_type,
     'FOD Alert Active',
     'FOD Sweep Alert on Apron Delta — vehicle halt in effect',
     false, now() - interval '3 hours'),
    (publisher_uuid, notice_003, 'success'::public.notification_type,
     'Notice Published',
     'Security Directive SD-2026-022 successfully distributed',
     true, now() - interval '2 days'),
    (airline_mgr_uuid, notice_001, 'critical'::public.notification_type,
     'Action Required',
     'Safety Flash SF-2026-047 requires your acknowledgement',
     false, now() - interval '1 hour'),
    (viewer_uuid, notice_007, 'info'::public.notification_type,
     'New Notice Available',
     'ECAA Regulatory Update RU-2026-011 has been published',
     false, now() - interval '6 days')
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;

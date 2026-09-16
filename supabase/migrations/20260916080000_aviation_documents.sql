-- ============================================================
-- MEAG Notices Platform — Aviation Documents Tracking Migration
-- ============================================================

-- 1. Document type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aviation_doc_type') THEN
    CREATE TYPE public.aviation_doc_type AS ENUM (
      'Operations Manual',
      'Safety Management System',
      'Ground Handling Manual',
      'Emergency Response Plan',
      'LCAA Certificate',
      'IATA Certification',
      'Regulatory Approval',
      'Service Bulletin',
      'Training Manual',
      'Quality Assurance Manual'
    );
  END IF;
END $$;

-- 2. Document compliance status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_compliance_status') THEN
    CREATE TYPE public.doc_compliance_status AS ENUM (
      'Compliant',
      'Expiring Soon',
      'Expired',
      'Under Review',
      'Pending Renewal',
      'Superseded'
    );
  END IF;
END $$;

-- 3. Main aviation documents table
CREATE TABLE IF NOT EXISTS public.aviation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  ref_number TEXT NOT NULL UNIQUE,
  doc_type public.aviation_doc_type NOT NULL,
  compliance_status public.doc_compliance_status NOT NULL DEFAULT 'Compliant',
  current_version TEXT NOT NULL DEFAULT 'v1.0',
  effective_date DATE NOT NULL,
  expiry_date DATE,
  lcaa_certified BOOLEAN NOT NULL DEFAULT false,
  lcaa_cert_number TEXT,
  lcaa_cert_expiry DATE,
  issuing_authority TEXT,
  description TEXT DEFAULT '',
  file_url TEXT,
  file_size TEXT,
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  uploaded_by_name TEXT DEFAULT '',
  renewal_alert_sent BOOLEAN NOT NULL DEFAULT false,
  renewal_alert_days INTEGER NOT NULL DEFAULT 30,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Document versions table
CREATE TABLE IF NOT EXISTS public.aviation_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.aviation_documents(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  change_summary TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  uploaded_by_name TEXT DEFAULT '',
  file_url TEXT,
  file_size TEXT,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Renewal alert log table
CREATE TABLE IF NOT EXISTS public.doc_renewal_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.aviation_documents(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL DEFAULT 'expiry_warning',
  days_until_expiry INTEGER,
  sent_to TEXT[] DEFAULT ARRAY[]::TEXT[],
  sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  email_status TEXT DEFAULT 'sent'
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_aviation_docs_type ON public.aviation_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_aviation_docs_status ON public.aviation_documents(compliance_status);
CREATE INDEX IF NOT EXISTS idx_aviation_docs_expiry ON public.aviation_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_aviation_docs_lcaa ON public.aviation_documents(lcaa_certified);
CREATE INDEX IF NOT EXISTS idx_aviation_doc_versions_doc_id ON public.aviation_document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_renewal_alerts_doc_id ON public.doc_renewal_alerts(document_id);

-- 7. Enable RLS
ALTER TABLE public.aviation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aviation_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_renewal_alerts ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies — aviation_documents
DROP POLICY IF EXISTS "authenticated_read_aviation_docs" ON public.aviation_documents;
CREATE POLICY "authenticated_read_aviation_docs"
ON public.aviation_documents
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "admins_manage_aviation_docs" ON public.aviation_documents;
CREATE POLICY "admins_manage_aviation_docs"
ON public.aviation_documents
FOR ALL
TO authenticated
USING (public.is_admin() OR public.can_manage_notices())
WITH CHECK (public.is_admin() OR public.can_manage_notices());

-- 9. RLS Policies — aviation_document_versions
DROP POLICY IF EXISTS "authenticated_read_doc_versions" ON public.aviation_document_versions;
CREATE POLICY "authenticated_read_doc_versions"
ON public.aviation_document_versions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "admins_manage_doc_versions" ON public.aviation_document_versions;
CREATE POLICY "admins_manage_doc_versions"
ON public.aviation_document_versions
FOR ALL
TO authenticated
USING (public.is_admin() OR public.can_manage_notices())
WITH CHECK (public.is_admin() OR public.can_manage_notices());

-- 10. RLS Policies — doc_renewal_alerts
DROP POLICY IF EXISTS "authenticated_read_renewal_alerts" ON public.doc_renewal_alerts;
CREATE POLICY "authenticated_read_renewal_alerts"
ON public.doc_renewal_alerts
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "admins_manage_renewal_alerts" ON public.doc_renewal_alerts;
CREATE POLICY "admins_manage_renewal_alerts"
ON public.doc_renewal_alerts
FOR ALL
TO authenticated
USING (public.is_admin() OR public.can_manage_notices())
WITH CHECK (public.is_admin() OR public.can_manage_notices());

-- 11. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_aviation_doc_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aviation_docs_updated_at ON public.aviation_documents;
CREATE TRIGGER trg_aviation_docs_updated_at
BEFORE UPDATE ON public.aviation_documents
FOR EACH ROW EXECUTE FUNCTION public.set_aviation_doc_updated_at();

-- 12. Auto-update compliance status based on expiry date
CREATE OR REPLACE FUNCTION public.update_doc_compliance_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL THEN
    IF NEW.expiry_date < CURRENT_DATE THEN
      NEW.compliance_status = 'Expired';
    ELSIF NEW.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
      NEW.compliance_status = 'Expiring Soon';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aviation_docs_compliance_status ON public.aviation_documents;
CREATE TRIGGER trg_aviation_docs_compliance_status
BEFORE INSERT OR UPDATE ON public.aviation_documents
FOR EACH ROW EXECUTE FUNCTION public.update_doc_compliance_status();

-- 13. Seed mock data
DO $$
DECLARE
  existing_user_id UUID;
  doc1_id UUID := gen_random_uuid();
  doc2_id UUID := gen_random_uuid();
  doc3_id UUID := gen_random_uuid();
  doc4_id UUID := gen_random_uuid();
  doc5_id UUID := gen_random_uuid();
  doc6_id UUID := gen_random_uuid();
  doc7_id UUID := gen_random_uuid();
  doc8_id UUID := gen_random_uuid();
BEGIN
  SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

  INSERT INTO public.aviation_documents (
    id, title, ref_number, doc_type, compliance_status, current_version,
    effective_date, expiry_date, lcaa_certified, lcaa_cert_number, lcaa_cert_expiry,
    issuing_authority, description, file_size, uploaded_by_name, renewal_alert_days
  ) VALUES
  (
    doc1_id,
    'MEAG Ground Handling Operations Manual',
    'MEAG-OM-GH-2026',
    'Operations Manual',
    'Compliant',
    'v5.1',
    '2026-01-01',
    '2027-01-01',
    true,
    'LCAA-GH-2026-0042',
    '2027-01-01',
    'LCAA',
    'Primary operations manual covering all ground handling procedures at MEAG-operated stations. Includes ramp, baggage, passenger, and cargo handling.',
    '14.2 MB',
    COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'),
    60
  ),
  (
    doc2_id,
    'Safety Management System Manual',
    'MEAG-SMS-2026',
    'Safety Management System',
    'Compliant',
    'v3.0',
    '2026-03-15',
    '2027-03-14',
    true,
    'LCAA-SMS-2026-0018',
    '2027-03-14',
    'LCAA / ICAO',
    'Comprehensive SMS documentation per ICAO Annex 19 and LCAA requirements. Covers hazard identification, risk assessment, and safety assurance.',
    '9.8 MB',
    COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'),
    45
  ),
  (
    doc3_id,
    'LCAA Ground Handling License Certificate',
    'MEAG-LCAA-LIC-2026',
    'LCAA Certificate',
    'Expiring Soon',
    'v1.0',
    '2024-10-01',
    '2026-10-01',
    true,
    'LCAA-GHL-2024-0007',
    '2026-10-01',
    'LCAA',
    'Official LCAA license authorizing MEAG to conduct ground handling operations at Cairo International Airport and designated stations.',
    '1.2 MB',
    COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'),
    90
  ),
  (
    doc4_id,
    'IATA Ground Operations Manual Certification',
    'MEAG-IATA-IGOM-2026',
    'IATA Certification',
    'Compliant',
    'v2.2',
    '2026-06-01',
    '2028-05-31',
    false,
    NULL,
    NULL,
    'IATA',
    'IATA IGOM compliance certification confirming MEAG adherence to IATA Ground Operations Manual standards.',
    '3.5 MB',
    COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'),
    30
  ),
  (
    doc5_id,
    'Emergency Response Plan — Airside',
    'MEAG-ERP-AS-2026',
    'Emergency Response Plan',
    'Under Review',
    'v2.4',
    '2026-02-01',
    '2027-01-31',
    true,
    'LCAA-ERP-2026-0031',
    '2027-01-31',
    'LCAA / ECAA',
    'Airside emergency response procedures covering aircraft accidents, fire, medical emergencies, and security incidents.',
    '6.7 MB',
    COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'),
    30
  ),
  (
    doc6_id,
    'Dangerous Goods Regulatory Approval',
    'MEAG-DGR-APPR-2025',
    'Regulatory Approval',
    'Expired',
    'v4.0',
    '2025-01-01',
    '2026-01-01',
    false,
    NULL,
    NULL,
    'ECAA / IATA',
    'Regulatory approval for acceptance and handling of dangerous goods per IATA DGR. EXPIRED — renewal in progress.',
    '2.1 MB',
    COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'),
    60
  ),
  (
    doc7_id,
    'Quality Assurance & Audit Manual',
    'MEAG-QA-2026',
    'Quality Assurance Manual',
    'Compliant',
    'v1.5',
    '2026-04-01',
    NULL,
    false,
    NULL,
    NULL,
    'Internal',
    'Internal quality assurance framework, audit procedures, and continuous improvement processes for all MEAG ground handling operations.',
    '4.4 MB',
    COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'),
    30
  ),
  (
    doc8_id,
    'Staff Training & Competency Manual',
    'MEAG-TRN-2026',
    'Training Manual',
    'Pending Renewal',
    'v3.1',
    '2025-09-01',
    '2026-09-30',
    true,
    'LCAA-TRN-2026-0055',
    '2026-09-30',
    'LCAA',
    'Comprehensive training requirements, competency standards, and certification procedures for all ground handling personnel.',
    '11.3 MB',
    COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'),
    45
  )
  ON CONFLICT (ref_number) DO NOTHING;

  -- Seed version history for doc1
  INSERT INTO public.aviation_document_versions (document_id, version, change_summary, uploaded_by_name, is_current)
  VALUES
    (doc1_id, 'v5.1', 'Updated pushback and towing procedures. Added A321XLR handling section.', COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'), true),
    (doc1_id, 'v5.0', 'Major revision incorporating IATA AHM 2026 updates and LCAA circular 2026-01.', COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'), false),
    (doc1_id, 'v4.3', 'Added cargo door procedures for B777F. Revised de-icing section.', COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'), false)
  ON CONFLICT (id) DO NOTHING;

  -- Seed version history for doc2
  INSERT INTO public.aviation_document_versions (document_id, version, change_summary, uploaded_by_name, is_current)
  VALUES
    (doc2_id, 'v3.0', 'Full rewrite per ICAO Annex 19 Amendment 2. New safety assurance framework.', COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'), true),
    (doc2_id, 'v2.5', 'Updated hazard register and risk matrix. Added new safety performance indicators.', COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'), false)
  ON CONFLICT (id) DO NOTHING;

  -- Seed version history for doc3
  INSERT INTO public.aviation_document_versions (document_id, version, change_summary, uploaded_by_name, is_current)
  VALUES
    (doc3_id, 'v1.0', 'Initial LCAA license issuance for ground handling operations.', COALESCE((SELECT full_name FROM public.user_profiles LIMIT 1), 'System Admin'), true)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;

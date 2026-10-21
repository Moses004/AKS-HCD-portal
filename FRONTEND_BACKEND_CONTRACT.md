# AKS-HCD Frontend-Backend Contract & Security Specification

**Platform:** Akwa Ibom State Human Capital Development (AKS-HCD)  
**Connected Supabase Project:** `Aks-HCD` (`refjawgovrmsyigtcfdl.supabase.co`)  
**Specification Version:** 2.4.0 (Production Launch Ready)  
**Authoritative Backend:** PostgreSQL 15+ / PostgREST / Supabase Auth & Storage  

---

## 1. Non-Negotiable Security Principles

1. **Database RLS is the Source of Truth:** Frontend role guards exist solely for user interface ergonomics and responsive routing. PostgreSQL Row Level Security (RLS) policies and `SECURITY DEFINER` RPCs enforce authorization boundaries.
2. **Zero Service-Role Key Exposure:** Only the public anon/publishable key (`VITE_SUPABASE_ANON_KEY`) is ever included in client bundles.
3. **Fail-Closed Role Resolution:** Administrative workspace actions are strictly blocked unless a matching row in `public.user_profiles` confirms `auth.uid() = user_id`, `active = true`, `approval_status = 'approved'`, and `role IN ('lga_admin', 'state_admin')`. Any loading, error, or unapproved state defaults strictly to `public` citizen observer.
4. **Tenant Isolation:** LGA Desk Workers are cryptographically and policy-bound to their assigned LGA (`public.aks_hcd_current_lga()`). Cross-LGA mutations fail at the database engine level.
5. **Private Evidence Vault:** The `hcd-evidence-vault` storage bucket is private (`public = false`). Access is exclusively via short-lived signed URLs (1-hour TTL) issued only to authorized personnel.
6. **No Phantom Production Data:** Legitimate empty tables render an honest empty state ("0 records recorded"). Extrapolations/forecasts default strictly to OFF. Offline caches are user-scoped and labelled.

---

## 2. Table Contracts & Column Schemas

### 2.1 `public.user_profiles`
Maintains verified government personnel roles, LGA assignments, and administrative approval lifecycles.

| Column | Type | Nullable | Default | Constraints / Semantics |
| :--- | :--- | :--- | :--- | :--- |
| `user_id` | `UUID` | No | None | Primary Key, `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `display_name` | `TEXT` | Yes | None | Official personnel full name |
| `staff_identifier`| `TEXT` | Yes | None | Official state/LGA government staff ID |
| `department` | `TEXT` | Yes | None | Directorate, Ministry, or Local Council Department |
| `role` | `TEXT` | No | `'public'` | `CHECK (role IN ('public', 'lga_admin', 'state_admin'))` |
| `lga_id` | `TEXT` | Yes | `NULL` | Assigned LGA (e.g. `'uyo'`, `'eket'`). Mandatory for `lga_admin` |
| `requested_role`| `TEXT` | Yes | None | Requested role during enrollment (`'lga_admin'` or `'state_admin'`) |
| `requested_lga_id`| `TEXT`| Yes | None | Requested LGA assignment during enrollment |
| `approval_status`| `TEXT` | No | `'pending'` | `CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'))` |
| `active` | `BOOLEAN` | No | `false` | Must be `true` and `approval_status = 'approved'` to unlock workspace |
| `approved_by` | `UUID` | Yes | `NULL` | State Super-Administrator user ID who granted access |
| `approved_at` | `TIMESTAMPTZ`| Yes | `NULL` | Timestamp of administrative review decision |
| `created_at` | `TIMESTAMPTZ`| No | `NOW()` | Audit creation timestamp |
| `updated_at` | `TIMESTAMPTZ`| No | `NOW()` | Audit last update timestamp |

### 2.2 `public.activities`
Core human capital development project initiatives, metrics, and grassroots milestone tracking.

| Column | Type | Nullable | Default | Constraints / Semantics |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` | No | None | Primary Key (`act-{lgaId}-{timestamp}`) |
| `lga_id` | `TEXT` | No | None | Valid Akwa Ibom State LGA identifier (one of 31 LGAs) |
| `lga_name` | `TEXT` | No | None | Official name of LGA (e.g. `'Uyo'`, `'Ikot Ekpene'`) |
| `pillar` | `TEXT` | No | None | HCD Pillar (`'education'`, `'health'`, `'vocational'`, `'agriculture'`, `'cross_cutting_enablers'`, `'values_ethics_social_behaviour'`) |
| `project_description` | `TEXT` | Yes | `NULL` | Operational project description (migrated from sub_category) |
| `category` | `TEXT` | Yes | `NULL` | Reporting category (`'values_ethics_social_behaviour'`, `'cross_cutting_enablers'`, or `NULL`) |
| `pillar_segment` | `TEXT` | Yes | `NULL` | Cross-cutting segment (`'gender'`, `'governance'`, `'climate_change'`, `'demography_youth_investment'`, or `NULL`) |
| `lat` | `DOUBLE PRECISION`| Yes | `NULL` | Latitude coordinate (geofenced to Akwa Ibom State envelope) |
| `lng` | `DOUBLE PRECISION`| Yes | `NULL` | Longitude coordinate (geofenced to Akwa Ibom State envelope) |
| `beneficiaries_total` | `INTEGER` | No | `0` | `CHECK (beneficiaries_total >= 0)` |
| `beneficiaries_male` | `INTEGER` | No | `0` | `CHECK (beneficiaries_male >= 0)` |
| `beneficiaries_female`| `INTEGER` | No | `0` | `CHECK (beneficiaries_female >= 0)` |
| `youth_beneficiaries`| `INTEGER` | No | `0` | `CHECK (youth_beneficiaries >= 0)` |
| `budget_ngn` | `NUMERIC` | No | `0` | `CHECK (budget_ngn >= 0)` |
| `start_date` | `DATE` | Yes | `NULL` | Project commencement date |
| `completion_date` | `DATE` | Yes | `NULL` | Target or actual completion date |
| `lead_officer` | `TEXT` | Yes | `NULL` | Field project officer full name |
| `officer_contact` | `TEXT` | Yes | `NULL` | Field officer government contact |
| `status` | `TEXT` | No | `'DRAFT'` | `CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED_DRAFT'))` |
| `overall_progress` | `INTEGER` | No | `0` | `CHECK (overall_progress >= 0 AND overall_progress <= 100)` |
| `milestones` | `JSONB` | No | `'[]'::jsonb`| Structured milestones with status, dates, and verification |
| `media_assets` | `JSONB` | No | `'[]'::jsonb`| Structured verification evidence array (storage path, lat, lng, mime) |
| `attendance_registry_url` | `TEXT` | Yes | `NULL` | Signed or vault path to physical attendance sheet scan |
| `attendance_sheet_file_name` | `TEXT` | Yes | `NULL` | Original uploaded filename of attendance document |
| `submission_notes` | `TEXT` | Yes | `NULL` | LGA Desk Officer notes submitted for review |
| `rejection_reason` | `TEXT` | Yes | `NULL` | State Executive feedback upon rejection |
| `reviewed_by` | `TEXT` | Yes | `NULL` | Name of reviewing State Executive |
| `reviewed_at` | `TIMESTAMPTZ`| Yes | `NULL` | Timestamp of state review |
| `created_by` | `UUID` | Yes | `auth.uid()` | Creator auth UUID |
| `created_at` | `TIMESTAMPTZ`| No | `NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ`| No | `NOW()` | Record modification timestamp |
| **TABLE CONSTRAINT** | `CHECK` | — | — | `CHECK (beneficiaries_male + beneficiaries_female = beneficiaries_total)` |

### 2.3 `public.audit_logs`
Immutable compliance and administrative telemetry ledger.

| Column | Type | Nullable | Default | Constraints / Semantics |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` | No | None | Primary Key (`log-{timestamp}-{random}`) |
| `timestamp` | `TIMESTAMPTZ`| No | `NOW()` | Event timestamp |
| `activity_id` | `TEXT` | Yes | `NULL` | Associated activity ID |
| `activity_title`| `TEXT` | Yes | `NULL` | Snapshot of activity title at event time |
| `lga_id` | `TEXT` | Yes | `NULL` | Target LGA council scope |
| `performed_by` | `TEXT` | No | None | Display name of actor |
| `role` | `TEXT` | No | None | Effective role of actor |
| `action` | `TEXT` | No | None | Action verb (`'CREATED_DRAFT'`, `'SUBMITTED'`, `'APPROVED'`, `'REJECTED'`, `'MODIFIED'`, `'CROSS_TENANT_VIOLATION_BLOCKED'`) |
| `notes` | `TEXT` | Yes | `NULL` | Contextual notes or security audit details |

### 2.4 `public.ptr_test_logs`
Production Telemetry Reconciliation (PTR) automated audit ledger.

| Column | Type | Nullable | Default | Constraints / Semantics |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` | No | None | Primary Key (`ptr-{timestamp}-{random}`) |
| `timestamp` | `TIMESTAMPTZ`| No | `NOW()` | Execution timestamp |
| `test_vector` | `TEXT` | No | None | Verification vector ID (e.g. `'PTR-001-ISOLATION'`, `'PTR-002-MATH'`) |
| `passed` | `BOOLEAN` | No | None | Whether the test vector passed validation |
| `summary` | `TEXT` | No | None | Human-readable outcome summary |
| `payload` | `JSONB` | No | `'{}'::jsonb`| Detailed execution parameters and assertions |
| `executed_by` | `TEXT` | Yes | `NULL` | Name or ID of administrator triggering verification |

---

## 3. Database Functions & Guarded RPC Contracts

### 3.1 `public.aks_hcd_current_role()`
```sql
CREATE OR REPLACE FUNCTION public.aks_hcd_current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_profiles 
  WHERE user_id = auth.uid() 
    AND active = true 
    AND approval_status = 'approved' 
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_role() TO anon, authenticated, service_role;
```

### 3.2 `public.aks_hcd_current_lga()`
```sql
CREATE OR REPLACE FUNCTION public.aks_hcd_current_lga()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lga_id FROM public.user_profiles 
  WHERE user_id = auth.uid() 
    AND active = true 
    AND approval_status = 'approved' 
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_lga() TO anon, authenticated, service_role;
```

### 3.3 `public.review_hcd_access_request` (RPC)
Guarded State Executive procedure to approve, reject, or suspend personnel access requests. Direct table mutations by clients to `user_profiles` are blocked by RLS.
```sql
CREATE OR REPLACE FUNCTION public.review_hcd_access_request(
  p_user_id UUID,
  p_decision TEXT,
  p_approved_role TEXT,
  p_approved_lga_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- 1. Caller Authorization Check
  SELECT role INTO v_caller_role
  FROM public.user_profiles
  WHERE user_id = auth.uid() AND active = true AND approval_status = 'approved';

  IF v_caller_role IS NULL OR v_caller_role <> 'state_admin' THEN
    RAISE EXCEPTION 'Access Denied: Only verified State Super-Administrators may review access requests.';
  END IF;

  -- 2. Validate Decision Parameters
  IF p_decision NOT IN ('approve', 'reject', 'suspend') THEN
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  -- 3. Execute Decision
  IF p_decision = 'approve' THEN
    UPDATE public.user_profiles
    SET role = COALESCE(p_approved_role, requested_role, 'public'),
        lga_id = CASE WHEN COALESCE(p_approved_role, requested_role) = 'lga_admin' THEN p_approved_lga_id ELSE NULL END,
        approval_status = 'approved',
        active = true,
        approved_by = auth.uid(),
        approved_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_decision = 'reject' THEN
    UPDATE public.user_profiles
    SET approval_status = 'rejected',
        active = false,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_decision = 'suspend' THEN
    UPDATE public.user_profiles
    SET approval_status = 'suspended',
        active = false,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'decision', p_decision);
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_hcd_access_request(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
```

### 3.4 Automatic Enrollment Trigger: `handle_new_user()`
Ensures that whenever a user registers through Supabase Auth, a safe, `pending`, inactive profile is created without granting unvetted administrative rights.
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    display_name,
    staff_identifier,
    department,
    role,
    lga_id,
    requested_role,
    requested_lga_id,
    approval_status,
    active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'staff_identifier',
    NEW.raw_user_meta_data->>'department',
    'public', -- Strictly public initially; never grant requested role immediately!
    NULL,
    COALESCE(NEW.raw_user_meta_data->>'requested_role', 'lga_admin'),
    NEW.raw_user_meta_data->>'requested_lga_id',
    'pending',
    false, -- Inactive until executive review
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 4. Storage Bucket Policies: `hcd-evidence-vault`

1. **Bucket Configuration:**
   - ID: `hcd-evidence-vault`
   - Public: `false` (Strictly private)
   - Max file size: 25 MB
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
2. **Object Path Convention:** `{lgaId}/{activityId}/{timestamp}_{filename}`
3. **Storage Access Policies:**
   - **Upload Policy:** Authenticated `state_admin` OR `lga_admin` where `(storage.foldername(name))[1] = aks_hcd_current_lga()`.
   - **Read Policy:** Authenticated `state_admin` OR `lga_admin` matching the folder's LGA prefix.
   - **Signed URL TTL:** 3600 seconds (1 hour). Frontend generates signed URLs on demand; signed URLs are never stored permanently in place of canonical storage paths.

---

## 5. Offline Queue Contract & Deduplication

1. **Queue Schema (`pending_operations` in IndexedDB):**
   - `id`: Unique operation UUID (`op-{timestamp}-{random}`)
   - `recordId`: Target activity ID
   - `operationType`: `'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_TRANSITION'`
   - `payload`: Exact mutation payload
   - `userContext`: `{ id, name, role, assignedLgaId }` (Immutable creation context)
   - `lgaId`: Council territory scope
   - `createdAt`: ISO 8601 timestamp
   - `retryCount`: Integer counter
   - `status`: `'pending' | 'processing' | 'succeeded' | 'failed'`
   - `errorDetails`: Diagnostic failure reason from database
2. **Ownership Isolation Rule:**
   - Queue items belonging to User A cannot be flushed, retried, or modified by User B.
   - On account logout or switch, private in-memory caches are purged, and pending operations remain quarantined under their original author's UID.

---

## 6. Staging Integration Verification Checklist

| Test Case | Scenario / Vector | Execution Method | Status | Verification Detail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Anonymous Public Access | Automated (`test_suite.ts`) + Browser | **PASSED** | Public visitor can access `/` and view published projects without authentication. |
| **TC-02** | Email-Substring Privilege Escalation Blocked | Automated (`test_suite.ts`) | **PASSED** | User with `state_admin@akwaibom.gov` email without approved profile fails closed to `public`. |
| **TC-03** | Pending / Inactive Profile Fail-Closed | Automated (`test_suite.ts`) | **PASSED** | `approval_status = 'pending'` or `active = false` denies access to `/lga` and `/executive`. |
| **TC-04** | LGA A vs LGA B Tenant Isolation | Automated (`test_suite.ts`) | **PASSED** | Uyo officer strictly blocked from editing Eket records (Cross-tenant violation error thrown). |
| **TC-05** | Demographic Mathematical Balance Constraint | Automated (`test_suite.ts`) | **PASSED** | `beneficiariesMale + beneficiariesFemale != beneficiariesTotal` strictly rejected. |
| **TC-06** | Published Record Immutability | Automated (`test_suite.ts`) | **PASSED** | LGA Desk Worker forbidden from altering published records without State Admin unlock. |
| **TC-07** | Private Evidence Storage Security | Automated (`test_suite.ts`) | **PASSED** | Direct public access to `hcd-evidence-vault` returns 403 Forbidden. Signed URLs work for authorized session. |
| **TC-08** | Unsupported Executable Evidence Rejection | Automated (`test_suite.ts`) | **PASSED** | `.exe`, `.js`, `.sh` files rejected; authentic PDF, JPG, PNG accepted. |
| **TC-09** | Offline Queue Owner Isolation | Automated (`test_suite.ts`) | **PASSED** | User B cannot flush or replay User A's pending operations queue. |
| **TC-10** | Empty Database vs. Server Error Distinction | Automated (`test_suite.ts`) | **PASSED** | Empty database returns `EMPTY_DATABASE` (renders honest 0 count), distinct from connection `ERROR`. |
| **TC-11** | Password Recovery URL Detection | Automated (`test_suite.ts`) | **PASSED** | Identifies `#type=recovery` or `?type=recovery` and redirects to `/reset-password`. |
| **TC-12** | Recovery Token Sanitization | Automated (`test_suite.ts`) | **PASSED** | Sensitive access tokens scrubbed from URL bar and browser history. |
| **TC-13** | Password Validation (Min 8 Chars + Confirmation) | Automated (`test_suite.ts`) | **PASSED** | Form validation blocks short or mismatched passwords before submission. |
| **TC-14** | Supabase Expired OTP Fragment Error Parsing | Automated (`test_suite.ts`) | **PASSED** | Accurately extracts `otp_expired` error descriptions and renders friendly recovery screen. |
| **TC-15** | Multi-Criteria Password Complexity Scoring | Automated (`test_suite.ts`) | **PASSED** | Enforces length, case, number, and special character evaluation dynamically. |
| **TC-16** | Live Supabase Tables Queryability (RLS Active) | Automated (`test_suite.ts`) | **PASSED** | All 4 tables (`activities`, `audit_logs`, `ptr_test_logs`, `user_profiles`) respond with active RLS enforcement. |
| **TC-17** | Live Email Recovery Link in Real Browser | Staging Manual Integration | **NOT RUN** | Requires live email inbox dispatch trigger in staging environment. |
| **TC-18** | End-to-End Database Trigger User Provisioning | Staging Migration Verification | **NOT RUN** | Requires running the `handle_new_user` SQL trigger migration in Supabase SQL editor. |

---

## 7. Required Database Migrations to Apply on Production Supabase

The following SQL migration should be applied via the Supabase Dashboard SQL Editor (`refjawgovrmsyigtcfdl`) to ensure full trigger automation and RPC alignment:

```sql
-- Migration: 20261013_auth_trigger_and_review_rpc.sql
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/refjawgovrmsyigtcfdl/sql

-- 1. Ensure columns exist on user_profiles
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS staff_identifier TEXT,
  ADD COLUMN IF NOT EXISTS requested_role TEXT,
  ADD COLUMN IF NOT EXISTS requested_lga_id TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Apply constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_profiles_approval_status') THEN
    ALTER TABLE public.user_profiles 
      ADD CONSTRAINT chk_user_profiles_approval_status 
      CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));
  END IF;
END $$;

-- 3. Install user signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    display_name,
    staff_identifier,
    department,
    role,
    lga_id,
    requested_role,
    requested_lga_id,
    approval_status,
    active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'staff_identifier',
    NEW.raw_user_meta_data->>'department',
    'public',
    NULL,
    COALESCE(NEW.raw_user_meta_data->>'requested_role', 'lga_admin'),
    NEW.raw_user_meta_data->>'requested_lga_id',
    'pending',
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Install access request review RPC
CREATE OR REPLACE FUNCTION public.review_hcd_access_request(
  p_user_id UUID,
  p_decision TEXT,
  p_approved_role TEXT,
  p_approved_lga_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.user_profiles
  WHERE user_id = auth.uid() AND active = true AND approval_status = 'approved';

  IF v_caller_role IS NULL OR v_caller_role <> 'state_admin' THEN
    RAISE EXCEPTION 'Access Denied: Only verified State Super-Administrators may review access requests.';
  END IF;

  IF p_decision = 'approve' THEN
    UPDATE public.user_profiles
    SET role = COALESCE(p_approved_role, requested_role, 'public'),
        lga_id = CASE WHEN COALESCE(p_approved_role, requested_role) = 'lga_admin' THEN p_approved_lga_id ELSE NULL END,
        approval_status = 'approved',
        active = true,
        approved_by = auth.uid(),
        approved_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_decision = 'reject' THEN
    UPDATE public.user_profiles
    SET approval_status = 'rejected',
        active = false,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_decision = 'suspend' THEN
    UPDATE public.user_profiles
    SET approval_status = 'suspended',
        active = false,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'decision', p_decision);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_hcd_access_request(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
```

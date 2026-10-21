# Akwa Ibom State Human Capital Development (AKS-HCD) Platform

> **Official Monitoring, Tracking, and Impact Analytics Portal for Akwa Ibom State's ARISE Agenda**

The **AKS-HCD Platform** is an enterprise-grade Progressive Web Application (PWA) designed to track, audit, and analyze Human Capital Development initiatives across all 31 Local Government Areas (LGAs) of Akwa Ibom State. Built with offline-first capabilities, real-time Supabase cloud synchronization, cryptographic audit logging, and geospatial intelligence.

---

## 🌟 Key Features

### 1. Multi-Tier Role-Based Architecture
- **Public Portal**: Transparent citizen dashboard featuring governor's address, verified state impact metrics, sectoral drill-downs, and interactive LGA map.
- **Field Officer Mode**: On-ground data collection with 5-stage validation wizard, offline draft storage, and automatic queueing.
- **LGA Supervisor Review**: Quality assurance desk with granular audit trails, return-for-correction capabilities, and one-click approvals.
- **Executive Council Panel**: High-level ministerial insights, comparative LGA performance charts, budget allocation vs. impact analysis, and PDF/CSV report generation.

### 2. Robust Offline-First PWA & Synchronization
- Seamless offline operation in low-connectivity rural LGAs.
- IndexedDB and localStorage persistent queues with collision handling.
- Automatic background synchronization when network connectivity restores.
- Post-Transaction Reconciliation (PTR) verification engine for data integrity.

### 3. Real-Time Cloud Persistence (Supabase)
- Pre-configured for Supabase PostgreSQL database (`https://refjawgovrmsyigtcfdl.supabase.co`).
- Automated data schemas for `activities`, `audit_logs`, and `ptr_test_logs`.
- In-app Supabase Connection & Schema Management Modal with one-click test and data seeding.

### 4. Interactive Geospatial Mapping
- Custom SVG map of Akwa Ibom State showing all 31 LGAs.
- Dynamic color-coding based on active project status and beneficiary coverage.
- Detailed modal inspection for each LGA's healthcare, education, agriculture, and skills development programs.

---

## 🚀 Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Database & Sync**: Supabase (`@supabase/supabase-js`), REST APIs
- **Icons**: Lucide React
- **PWA & Offline**: Vite PWA Plugin, Workbox Service Worker
- **Visualizations**: Custom SVG Cartography, Recharts / HTML5 Canvas trends

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/Moses004/Aks-HCD.git
   cd Aks-HCD
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Configure your Supabase credentials:
   ```env
   VITE_SUPABASE_URL="https://refjawgovrmsyigtcfdl.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-public-key-here"
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

---

## 🗄️ Database Setup (Supabase)

To enable live persistence with your Supabase database, run the following SQL script in your [Supabase SQL Editor](https://app.supabase.com):

```sql
-- 0. Function Execution Grants for Helper Functions
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aks_hcd_current_lga() TO anon, authenticated, service_role;

-- 1. AKS-HCD Activities Table
CREATE TABLE IF NOT EXISTS public.activities (
  id TEXT PRIMARY KEY,
  lga_id TEXT NOT NULL,
  lga_name TEXT NOT NULL,
  title TEXT NOT NULL,
  pillar TEXT NOT NULL,
  sub_category TEXT,
  community TEXT,
  lat DOUBLE PRECISION DEFAULT 5.0377,
  lng DOUBLE PRECISION DEFAULT 7.9128,
  beneficiaries_total INTEGER DEFAULT 0,
  beneficiaries_male INTEGER DEFAULT 0,
  beneficiaries_female INTEGER DEFAULT 0,
  youth_beneficiaries INTEGER DEFAULT 0,
  budget_ngn NUMERIC DEFAULT 0,
  start_date DATE,
  completion_date DATE,
  lead_officer TEXT,
  officer_contact TEXT,
  status TEXT DEFAULT 'DRAFT',
  overall_progress INTEGER DEFAULT 0,
  milestones JSONB DEFAULT '[]'::jsonb,
  media_assets JSONB DEFAULT '[]'::jsonb,
  submission_notes TEXT,
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Audit Trail Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  activity_id TEXT,
  activity_title TEXT,
  lga_id TEXT,
  performed_by TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  notes TEXT
);

-- 3. PTR Security & Ledger Test Runs
CREATE TABLE IF NOT EXISTS public.ptr_test_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  test_vector TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  executed_by TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptr_test_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read & write access with anon key
DROP POLICY IF EXISTS "Allow public read activities" ON public.activities;
CREATE POLICY "Allow public read activities" ON public.activities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert activities" ON public.activities;
CREATE POLICY "Allow public insert activities" ON public.activities FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update activities" ON public.activities;
CREATE POLICY "Allow public update activities" ON public.activities FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete activities" ON public.activities;
CREATE POLICY "Allow public delete activities" ON public.activities FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read audit_logs" ON public.audit_logs;
CREATE POLICY "Allow public read audit_logs" ON public.audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert audit_logs" ON public.audit_logs;
CREATE POLICY "Allow public insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read ptr_test_logs" ON public.ptr_test_logs;
CREATE POLICY "Allow public read ptr_test_logs" ON public.ptr_test_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert ptr_test_logs" ON public.ptr_test_logs;
CREATE POLICY "Allow public insert ptr_test_logs" ON public.ptr_test_logs FOR INSERT WITH CHECK (true);

-- 4. Enable Supabase Realtime for instant multi-user synchronization
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

-- 5. Supabase Storage Bucket for Field Evidence & Media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hcd-evidence-vault', 'hcd-evidence-vault', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public read evidence vault" ON storage.objects;
CREATE POLICY "Allow public read evidence vault" ON storage.objects 
FOR SELECT USING (bucket_id = 'hcd-evidence-vault');

DROP POLICY IF EXISTS "Allow public upload evidence vault" ON storage.objects;
CREATE POLICY "Allow public upload evidence vault" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'hcd-evidence-vault');
```

---

## 🏛️ Akwa Ibom State ARISE Agenda

The Human Capital Development initiatives in this portal directly support Governor Umo Eno's ARISE Agenda pillars:
- **A** - Agricultural Revolution
- **R** - Rural Development
- **I** - Infrastructural Maintenance
- **S** - Security Management
- **E** - Educational Advancement & Economic Empowerment

---

## 📄 License
Government of Akwa Ibom State & Project Contributors.

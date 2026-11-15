# AEVORA — Care That Connects Generations

AEVORA is an intelligent elderly care and family health management ecosystem connecting older adults, trusted family members, and professional caretakers in one accessible collaborative platform.

## Key Capabilities

- **Role-Based Care Ecosystem**: Dedicated workflows and permissions for Elderly Individuals, Family Members, Caretakers, and System Administrators with rate-limited auth and Care PIN verification.
- **Accessible Elderly Home Dashboard & Daily Wellness Check-In**: High-legibility typography, circular daily medication progress ring, one-tap dose confirmation (`Taken`, `Skip`, `Remind Me Later`), non-diagnostic Daily Wellness Check-In (`Mood`, `Energy 1–5`), offline snapshot caching, and an Accessible Mode toggle.
- **Smart Medication Management & Safety Intelligence**: List/Timeline/Calendar views, live search, Medication Detail drawer, duplicate medication detection, smart refill countdown predictor, medication interaction review for pharmacist/doctor consultation, and timestamped dose logs.
- **Intelligent Notification Engine & Resend Emails**: Scheduled cron sweeps (`node-cron`) for upcoming doses, configurable grace-period escalation to caretakers and family, appointment reminders, refill alerts, branded HTML email templates via Resend, and delivery/retry logging.
- **Family Care Circle & Caretaker Workspace**: Shared Family Care Calendar, role-attributed care timeline, weekly summary export, granular access permissions, caregiver shift intelligence, care notes, and structured shift handovers.
- **Multilingual AI Companion (Gemini API)**: Server-side `@google/genai` assistant grounded in live care context with persistent history, strict medical safety guardrails, voice input, and Text-to-Speech read-aloud.
- **Appointments, Emergency QR Card & Care Continuity Analytics**: Visit preparation checklists, QR Care Access card with offline fallback, transparent Care Continuity Score (0–100 with coverage % and non-medical disclaimer), CSV care report exports, and Admin Governance Console.

## Local Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
   Configure `GEMINI_API_KEY` (and optionally `RESEND_API_KEY` for live email delivery).
3. Start the full-stack development server (Express API + Vite SSR/SPA on port 3000):
   ```bash
   npm run dev
   ```
   On first boot, the SQLite database (`aevora.db`) is initialized automatically with all relational tables, indexes, and realistic demo data. To re-run seeding manually:
   ```bash
   npm run seed
   ```

## Demo Accounts

- **Elderly Individual**: `eleanor@aevora.care` / `CareCircle2026!` (Care PIN: `4829`)
- **Family Member**: `maya@aevora.care` / `CareCircle2026!`
- **Caretaker**: `david@aevora.care` / `CareCircle2026!`
- **Administrator**: `admin@aevora.care` / `AdminCare2026!`

## Production Deployment (Vercel + Managed PostgreSQL)

1. Provision a managed PostgreSQL database (Neon, Supabase, RDS, or Cloud SQL) and set `DATABASE_URL` in your production environment.
2. Run Prisma migrations against your PostgreSQL database using the included `/prisma/schema.prisma`:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```
3. Configure `GEMINI_API_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`, and `APP_URL`.
4. Build and start:
   ```bash
   npm run build
   npm start
   ```

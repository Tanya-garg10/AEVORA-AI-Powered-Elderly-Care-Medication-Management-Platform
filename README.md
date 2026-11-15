# AEVORA — AI-Powered Elderly Care & Medication Management Platform 🌿👵

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![SQLite / Prisma](https://img.shields.io/badge/SQLite_%2F_Prisma-003B57?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Google Gemini API](https://img.shields.io/badge/Google_Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)

> **AEVORA** is an intelligent, compassionate healthcare and medication adherence ecosystem designed to bridge the gap between older adults, loving families, and professional caregivers. Built with high accessibility standards, proactive safety intelligence, and AI-driven companionship.

## 🌟 Key Highlights & Features

### 1. 👵 Senior-Friendly Accessible Experience
- **High-Legibility UI**: Large tap targets, high-contrast typography, and an **Accessible Mode** toggle designed specifically for seniors.
- **One-Tap Dose Confirmation**: Mark doses easily as `Taken`, `Skip`, or `Remind Me Later`.
- **Daily Wellness Check-In**: Non-intrusive logging of mood and energy levels (1–5) to track general well-being.
- **Visual Adherence Rings**: Quick, motivating circular progress meters showing daily adherence at a glance.

### 2. 💊 Smart Medication Management & Safety Intelligence
- **Flexible Views**: View medication regimens via List, Timeline, or Calendar views.
- **Medication Detail Drawer & Tracking**: Complete dosage instructions, food interaction warnings, and refill schedules.
- **Refill Countdown Predictor**: Automatically forecasts when prescriptions need renewal.
- **Drug Interaction & Duplicate Warning**: Proactive safety detection to prevent adverse multi-drug interactions.

### 3. 🤖 Multilingual AI Companion (Powered by Google Gemini)
- Grounded conversational assistant aware of daily schedules and wellness state.
- Strictly guarded against medical diagnosis; offers helpful routines, soothing reminders, and conversational engagement.
- Integrated **Voice Input** and **Text-to-Speech (TTS)** audio playback for effortless hands-free interaction.

### 4. 👨‍👩‍👧 Family Care Circle & Caretaker Workspace
- **Collaborative Care Calendar**: Sync tasks, doctor appointments, and visits across the whole care team.
- **Caregiver Shift Management & Handovers**: Detailed care notes, vital recordings, and shift handovers between professional caretakers and family.
- **Escalation & Missed Dose Notifications**: Automated multi-channel alerts (including transactional emails via **Resend**) when critical medication is missed.

### 5. 🚨 Emergency Preparedness & Emergency QR Card
- **Emergency QR Care Access**: Instant-access digital card displaying blood type, emergency contacts, critical conditions, and active medications for first responders.
- **Offline Snapshot**: Critical information cached locally for quick offline access during emergencies.

### 6. 📊 Analytics, Reports & Admin Console
- **Care Continuity Score**: Transparent 0–100 wellness index with metrics tracking consistency over time.
- **Exportable Reports**: Generate detailed CSV summaries for doctor visits and clinical reviews.
- **Admin Governance Console**: Platform oversight, user management, and security audit logs.

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Framer Motion (`motion`), Recharts
- **Backend**: Node.js, Express.js (`tsx` runtime), Better-SQLite3 (Local Development) / Prisma ORM with PostgreSQL (Production)
- **AI / LLM**: Google Gemini API (`@google/genai`)
- **Background Tasks & Alerts**: `node-cron` for scheduling dose sweeps, Resend for transactional email delivery
- **Validation & Security**: Zod, Cookie-Parser (HTTP-only secure auth cookies), Rate-limiting & Care PIN protection

## 🚀 Getting Started

### Prerequisites

Ensure you have one of the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [Bun](https://bun.sh/)

### 1. Clone the Repository
```bash
git clone https://github.com/Tanya-garg10/AEVORA-AI-Powered-Elderly-Care-Medication-Management-Platform.git
cd AEVORA-AI-Powered-Elderly-Care-Medication-Management-Platform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Open `.env` and fill in your keys:
```env
# Google Gemini API Key (Required for AI Companion)
GEMINI_API_KEY="your-gemini-api-key"

# Application URL
APP_URL="http://localhost:3000"

# Secret used to sign session cookies
SESSION_SECRET="your-secure-random-secret"

# Resend API Key (Optional: for live email alerts)
RESEND_API_KEY=""
RESEND_FROM_EMAIL="AEVORA Care <care@notifications.aevora.health>"
```

### 4. Run the Development Server
```bash
npm run dev
```
The full-stack application will boot up at **`http://localhost:3000`**.

> 💡 **Auto-Seeding**: On first run, the local SQLite database (`aevora.db`) is automatically initialized and seeded with realistic demo data. To re-seed manually at any time, run:
> ```bash
> npm run seed
> ```

## 👥 Demo Credentials

You can test all distinct role perspectives using the seeded demo accounts:

| Role | Email | Password | Extra Note |
| :--- | :--- | :--- | :--- |
| **Elderly Member** | `eleanor@aevora.care` | `CareCircle2026!` | Care PIN: `4829` |
| **Family Member** | `maya@aevora.care` | `CareCircle2026!` | Daughter & Primary Care Contact |
| **Professional Caregiver** | `david@aevora.care` | `CareCircle2026!` | Shift Caregiver |
| **Administrator** | `admin@aevora.care` | `AdminCare2026!` | Platform Console Access |

## 📂 Project Structure

```text
aevora/
├── prisma/               # Prisma ORM schema (PostgreSQL production setup)
│   └── schema.prisma
├── public/               # Public static assets & uploads
├── src/
│   ├── assets/           # Local images & avatars
│   ├── components/       # Reusable UI components (Toast, Progress, Layouts)
│   ├── context/          # React Context providers (AuthContext, etc.)
│   ├── lib/              # API clients and utilities
│   ├── pages/            # Role-specific application pages & views
│   └── server/           # Backend server logic
│       ├── auth.ts       # Authentication, sessions & PIN verification
│       ├── companion.ts  # Gemini AI Companion integration
│       ├── db.ts         # SQLite database client & schema setup
│       ├── notifications.ts # Cron sweeps & email delivery logic
│       └── seed.ts       # Mock dataset seeding script
├── server.ts             # Express application & Vite middleware entrypoint
├── vite.config.ts        # Vite configuration
└── package.json          # Dependencies and scripts
```

## 🛡️ Medical & Safety Disclaimer

AEVORA is a wellness assistance and medication adherence support tool. It is **not** a certified medical device and does not provide clinical diagnosis or prescription alterations. All medication schedules and interactions should always be verified by a licensed healthcare professional or pharmacist.

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

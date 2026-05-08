# FinCrime Control Lab

## Project Overview
Standalone Next.js 16 app for financial crime control design tools. Two modules:
- **TypologyIQ** — Maps AML typologies to detection controls based on firm type, product, customer, and risk theme
- **PartnerControlMap** — Defines partner payment flow control ownership with RACI, data gaps, and governance

## Tech Stack
- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript 5
- Tailwind CSS 4
- PostgreSQL on Hetzner (`fincrime_lab` DB)
- Groq (llama-3.3-70b-versatile) for AI narratives only
- jsPDF + jspdf-autotable for PDF generation
- AWS SES (eu-west-2) for email
- Lucide React icons
- Framer Motion for animations

## Key Architecture Decisions
- Scoring is **deterministic** (no AI) — typology scoring uses weighted matching (firm 30pts, product 25pts, customer 20pts, risk theme 25pts)
- AI (Groq) is used **only** for generating plain-English narrative summaries, loaded asynchronously after results render
- All typology and partner flow data is in TypeScript files under `data/` (source of truth)
- PDF generation happens server-side in API routes
- Lead capture is required before PDF download (email-gated)

## Database
- Host: 89.167.95.173:5432
- Database: fincrime_lab
- User: fincrime_app
- Schema: `db/schema.sql`
- 4 tables: typologies, partner_flows, assessments, lead_capture

## Commands
- `npm run dev` — Start dev server (Turbopack)
- `npm run build` — Production build
- `npm run start` — Start production server

## Environment Variables
See `.env.local.example` for all required variables.

## Deployment
- Vercel (auto-deploy on push to main)
- Domain: fincrime.memaconsultants.com
- Region: lhr1 (London)

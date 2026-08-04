# FinCrime Control Lab

## Project Overview
Standalone Next.js 16 app: free financial-crime control design tools plus an anonymous workspace layer for formal assessments. Key modules:
- **TypologyIQ** - Maps AML typologies to detection controls based on firm type, product, customer, and risk theme
- **PartnerControlMap** - Defines partner payment flow control ownership with RACI, data gaps, and governance
- **Screening Designer / Controls Maturity / KYC Matrix / Controls Library / Control Builder / Enforcement** - the rest of the free toolkit
- **PRA Workspace** (`/assess/product-risk`) - 8-step product risk assessment journey: profile, flows, inherent risks, control mapping, gaps and operational load, residual risk vs appetite, recommendation and decision, committee pack
- **Workspace home** (`/workspace`) - My Work: open assessments, decisions required, overdue actions, recent activity

## Workspace model (no auth)
- Anonymous tenant: `workspaces` row with sha256 `token_hash`; the client keeps `{id, token}` in localStorage under `fincrime-workspace`
- API auth: `x-workspace-id` + `x-workspace-token` headers, verified by `withWorkspace()` in `lib/workspace-auth.ts`
- `WorkspaceProvider` (mounted in `app/layout.tsx`) bootstraps a workspace lazily on first save; the free tools stay fully anonymous
- Reviewers/approvers are named people records (`workspace_people`), not logins
- Repos in `lib/repo/*` scope every query by `workspace_id`; mutations write `audit_log` and, for controls, `object_versions`

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
- Scoring is **deterministic** (no AI): typology scoring uses weighted matching (firm 30pts, product 25pts, customer 20pts, risk theme 25pts)
- AI (Groq) is used **only** for generating plain-English narrative summaries, loaded asynchronously after results render
- All typology and partner flow data is in TypeScript files under `data/` (source of truth)
- PDF generation happens server-side in API routes
- Lead capture is required before PDF download (email-gated)

## Database
- Host: 89.167.95.173:5432 (prod), `postgres://localhost/fincrime_dev` for local dev (set in `.env.local`)
- Database: fincrime_lab
- User: fincrime_app
- Base schema: `db/schema.sql` (typologies, partner_flows, assessments, lead_capture)
- Workspace schema: `db/migrations/*.sql`, applied with `npm run db:migrate` (tracked in `schema_migrations`); migration 001 adds workspaces, workspace_people, products, pra_assessments, assessment_risks, assessment_controls, workspace_controls, decisions, conditions, actions, evidence, comments, object_versions, audit_log

## Commands
- `npm run dev` - Start dev server (Turbopack)
- `npm run build` - Production build
- `npm run start` - Start production server
- `npm test` - Vitest unit tests (scoring modules)
- `npm run db:migrate` - Apply db/migrations against DATABASE_URL
- `node e2e-runner.mjs --only=6` - API-only PRA lifecycle e2e against a local `next start` (needs a fresh build and a migrated local DB)

## Environment Variables
See `.env.local.example` for all required variables.

## Deployment
- Vercel (auto-deploy on push to main)
- Domain: fincrime.memaconsultants.com
- Region: lhr1 (London)

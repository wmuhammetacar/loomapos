# Phase 14 - Sales Funnel + Lead Management + CRM

## 1) CRM architecture

The CRM layer is implemented as a web-admin growth subsystem and keeps POS responsibilities separated from sales responsibilities.

- Website captures lead intent and sends CRM events.
- CRM persists leads, activities, notes, demos, notifications, email automation queue, and audit logs.
- Sales team operates through `/admin/crm` and lead detail routes.
- Conversion and onboarding signals are tracked in CRM without moving POS operations into web flows.

Core API surfaces:

- `GET/POST /api/crm/leads`
- `GET/PATCH /api/crm/leads/{leadId}`
- `POST /api/crm/leads/{leadId}/activities`
- `POST /api/crm/leads/{leadId}/notes`
- `POST /api/crm/leads/{leadId}/demo`
- `GET /api/crm/dashboard`
- `POST /api/crm/events`

## 2) lead data model

Lead entity includes required fields from the phase brief and operational extensions for sales workflows.

Required fields:

- `leadId`
- `name`
- `email`
- `phone` (optional)
- `companyName`
- `source`
- `status`
- `score`
- `assignedTo`
- `createdAt`
- `updatedAt`

Extended fields:

- `lastActivityAt`
- `tenantId`
- `conversionDate`
- `resellerId`
- `commissionEligible`
- `trialEndsAt`
- `lostReason`

Status values:

- `new`
- `contacted`
- `qualified`
- `demo_scheduled`
- `proposal_sent`
- `converted`
- `lost`

Source values:

- `contact_form`
- `demo_request`
- `pricing_cta`
- `download_attempt`
- `reseller_application`
- `newsletter_signup`
- `checkout_start`
- `manual_import`

## 3) pipeline design

Pipeline is Kanban-first and supports drag/drop stage movement.

Pipeline stages:

1. New Lead
2. Contacted
3. Qualified
4. Demo Scheduled
5. Proposal Sent
6. Converted
7. Lost

UI capabilities:

- Drag-drop between stages (`/admin/crm`)
- Search and filtering (status/source/score/text)
- Quick "next stage" action
- Lead detail deep-dive (`/admin/crm/leads/{leadId}`)
- Stage/assignment updates with audit records

## 4) scoring logic

Scoring rules are event-driven:

- `+10` pricing page visit (`pricing_page_visit`)
- `+20` demo request (`demo_requested`)
- `+15` app download attempt (`download_attempt`)
- `+30` signup started (`signup_started`)
- `+50` onboarding completed (`onboarding_completed`)

Scoring signals can come from:

- CRM event endpoint
- marketing lead/event sync
- onboarding events (first sale completion)

High score threshold:

- `>= 60` triggers `high_score` sales notification

## 5) email automation flow

Automations are queued in CRM storage and tied to trigger reasons.

Automated emails:

- `welcome` on lead creation
- `demo_confirmation` on demo request/schedule
- `follow_up` on inactivity / abandoned checkout
- `trial_expiring` when trial end is near

Abandoned checkout logic:

- Lead has `signup_started`
- No `checkout_completed`
- Age threshold exceeded
- System adds `checkout_abandoned` activity and follow-up email

## 6) dashboard structure

Sales dashboard (`/admin/crm`) includes:

- Total leads
- New leads today
- Conversion rate
- High score leads
- Abandoned checkout leads
- Pipeline distribution
- Top performing sales reps
- Source performance
- Sales notifications feed

Lead detail (`/admin/crm/leads/{leadId}`) includes:

- Contact and ownership data
- Stage/assignment actions
- Notes timeline
- Activity history
- Demo scheduling
- Audit trail

## 7) implementation checklist

- [x] Lead capture endpoints and storage
- [x] CRM pipeline stages and admin Kanban UI
- [x] Lead scoring engine
- [x] Activity tracking and chronology
- [x] Lead notes
- [x] Demo scheduling
- [x] Email automation queue
- [x] Sales notifications
- [x] Conversion tracking (lead -> converted, tenant linkage support)
- [x] Abandoned checkout detection
- [x] Reseller lead assignment fields (`resellerId`, `commissionEligible`)
- [x] Lead filters and search
- [x] Sales dashboard metrics
- [x] Audit trail for data changes

## 8) scaffold code

Primary implementation files:

- `apps/web-admin/lib/crm-types.ts`
- `apps/web-admin/lib/crm-store.ts`
- `apps/web-admin/lib/crm-service.ts`
- `apps/web-admin/app/api/crm/leads/route.ts`
- `apps/web-admin/app/api/crm/leads/[leadId]/route.ts`
- `apps/web-admin/app/api/crm/leads/[leadId]/activities/route.ts`
- `apps/web-admin/app/api/crm/leads/[leadId]/notes/route.ts`
- `apps/web-admin/app/api/crm/leads/[leadId]/demo/route.ts`
- `apps/web-admin/app/api/crm/dashboard/route.ts`
- `apps/web-admin/app/api/crm/events/route.ts`
- `apps/web-admin/components/admin/admin-crm-panels.tsx`
- `apps/web-admin/components/admin/admin-crm-detail-panel.tsx`
- `apps/web-admin/app/admin/crm/leads/[leadId]/page.tsx`

Lead capture integration points:

- `apps/web-admin/components/forms/marketing-lead-form.tsx`
- `apps/web-admin/components/forms/reseller-apply-form.tsx`
- `apps/web-admin/components/forms/checkout-form.tsx`
- `apps/web-admin/components/forms/success-panel.tsx`
- `apps/web-admin/components/forms/download-intent-form.tsx`
- `apps/web-admin/components/forms/newsletter-signup-form.tsx`


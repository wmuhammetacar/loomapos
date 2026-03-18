# Phase 12 Unified Brand and Design System Spec

## 1) Brand identity definition
- Brand name: LoomaPOS.
- Brand promise: Operational clarity and commercial confidence.
- Visual direction: premium SaaS clarity, high readability, low-noise surfaces, strong status signaling.
- Logo system:
  - Wordmark and symbol variants.
  - Monochrome rules for light and dark surfaces.
  - Minimum clear-space and minimum display size defined in shared identity model.
- Icon style:
  - 24 grid, rounded line cap, consistent stroke weight.
  - Unified semantic icon set for sales, inventory, reports, users, branches, devices, payments, settings, integrations, analytics and notifications.
- Screenshot standards:
  - Consistent frame radius, border, shadow and highlight behavior.
  - Controlled annotation style and allowed aspect ratios.
- Surface scope covered:
  - Marketing website, customer portal, reseller portal, admin dashboard, desktop POS, mobile POS, docs portal.
- Product boundary preserved:
  - Website stays informational and conversion-focused.
  - POS operations remain in desktop and mobile apps.

## 2) Design tokens
- Token source files:
  - packages/ui/src/design-tokens.ts
  - packages/ui/src/design-tokens.json
- Token families:
  - Colors: brand, UI surfaces, text, interaction states, status states.
  - Typography: H1 to H4, body, secondary body, caption, label.
  - Spacing: xs, sm, md, lg, xl, xxl with 4px baseline logic.
  - Radius: xs to xl plus pill.
  - Shadows: sm, md, lg, focus.
  - Motion: quick, base, slow.
  - Breakpoints: mobile, tablet, desktop, wide.
- Theme support:
  - Light and dark token sets implemented.
  - CSS variable mapping available through toCssVariables helper.
- Web-admin integration:
  - globals.css and tailwind.config.ts now consume shared token variables.

## 3) Component library
- Foundation components:
  - Button, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Tabs, Card.
- Data and feedback:
  - Table primitives, DataGrid, Badge, Alert, EmptyState, LoadingState, Progress, ErrorState.
- Overlay and guidance:
  - Modal, Tooltip.
- Navigation helpers:
  - Pagination, Breadcrumbs.
- State coverage:
  - Hover, focus, active, disabled, loading, empty and error patterns standardized.
- Documentation model:
  - packages/ui/src/component-catalog.ts contains usage, props, states and accessibility notes for each component.

## 4) Navigation patterns
- Pattern source:
  - apps/web-admin/components/patterns/navigation-patterns.tsx
- Public marketing pattern:
  - Features, Solutions, Pricing, Integrations, Download, Resellers, Docs.
- Portal pattern:
  - Separate customer and reseller sidebar nav sets.
  - No public marketing actions mixed inside portal sidebars.
- Mobile app navigation pattern:
  - Bottom tab model for dashboard, sales, products, reports and settings.
- Desktop task header pattern:
  - Minimal task-focused header with clear title, subtitle and scoped actions.

## 5) Dashboard patterns
- Pattern source:
  - apps/web-admin/components/patterns/dashboard-patterns.tsx
- Standardized modules:
  - KPI cards.
  - Chart panel wrappers.
  - Activity feed panel.
  - Responsive dashboard grid layout.
- Reuse target:
  - Customer portal, reseller portal and admin dashboards share the same pattern primitives.

## 6) Responsive design rules
- Breakpoint system:
  - mobile 480, tablet 768, desktop 1024, wide 1440.
- Marketing website:
  - Fully responsive and hierarchy-preserving.
- Portal and admin:
  - Sidebar-first on desktop, stacked layout on smaller screens.
- Mobile pattern rules:
  - Bottom navigation remains visible and touch-friendly.
  - Minimum target sizes retained.
- Data surfaces:
  - Tables wrap in horizontal containers.
  - DataGrid preserves filtering, sorting and pagination on smaller widths.

## 7) Accessibility rules
- Color and contrast:
  - AA baseline for text and high-contrast preference for critical operational states.
- Keyboard access:
  - Focus rings, tab flow and interactive controls are keyboard reachable.
- Semantics:
  - Breadcrumb nav labels, table headers, modal dialog semantics and alert roles standardized.
- Form clarity:
  - Required indicator, inline validation, helper and error text patterns unified.
- Component-level guidance:
  - Accessibility notes maintained in component catalog for implementation consistency.

## 8) Implementation checklist
- Completed:
  - Shared brand identity model and screenshot standards.
  - Shared token system (light and dark) with CSS variable helpers.
  - Web-admin tokenized global styles and tailwind theme alignment.
  - Core and advanced UI component set expanded.
  - Form, data table and data grid behavior standardized.
  - Navigation and dashboard pattern components added.
  - Empty, loading, progress and error state components added.
  - Desktop and mobile theme values aligned to shared visual language.
  - Mobile dark mode foundation activated.
  - Component catalog extended with usage, props and accessibility notes.
- QA gates for release:
  - Build and lint each surface after integrating new components.
  - Validate responsive behavior on mobile, tablet and desktop.
  - Validate dark mode and status contrast in real flows.
  - Validate keyboard and screen-reader behavior for core journeys.

## 9) UI component examples
- Reference files:
  - apps/web-admin/components/ui/button.tsx
  - apps/web-admin/components/ui/data-grid.tsx
  - apps/web-admin/components/ui/modal.tsx
  - apps/web-admin/components/ui/error-state.tsx
  - apps/web-admin/components/ui/progress.tsx
  - apps/web-admin/components/patterns/navigation-patterns.tsx
  - apps/web-admin/components/patterns/dashboard-patterns.tsx

Example A: Data grid usage
~~~tsx
<DataGrid
  title="Customers"
  rows={rows}
  columns={columns}
  rowKey={(row) => row.id}
  searchableKeys={["name", "email", "status"]}
  rowActions={(row) => <Button variant="outline">View {row.name}</Button>}
/>
~~~

Example B: Modal confirmation pattern
~~~tsx
<Modal>
  <ModalTrigger>Delete Integration</ModalTrigger>
  <ModalContent ariaLabel="Delete integration confirmation">
    <ModalHeader>
      <ModalTitle>Delete Integration</ModalTitle>
      <ModalDescription>This action removes sync credentials.</ModalDescription>
    </ModalHeader>
    <ModalFooter>
      <ModalClose>Cancel</ModalClose>
      <Button variant="danger">Delete</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
~~~

Example C: Dashboard KPI and chart wrappers
~~~tsx
<DashboardGrid>
  <KpiCard label="Monthly Revenue" value="TRY 1.2M" trend="+14% vs previous month" tone="success" />
  <KpiCard label="Churn Risk" value="2.1%" tone="warning" />
</DashboardGrid>
<ChartPanel title="Revenue Trend" subtitle="Last 30 days">chart component</ChartPanel>
~~~

export interface ComponentDocItem {
  name: string;
  category:
    | "inputs"
    | "navigation"
    | "feedback"
    | "data-display"
    | "overlays"
    | "layout"
    | "patterns";
  description: string;
  usage: string;
  states: string[];
  props: string[];
  accessibility: string[];
  supportedSurfaces: string[];
  example: string;
}

export const componentCatalog: ComponentDocItem[] = [
  {
    name: "Button",
    category: "inputs",
    description: "Primary and secondary actions across website, portals and apps.",
    usage: "Use one dominant action per section and keep labels action oriented.",
    states: ["default", "hover", "active", "disabled", "loading"],
    props: ["variant", "size", "loading", "leadingIcon", "trailingIcon"],
    accessibility: ["Visible focus ring", "44px minimum target", "Aria label for icon-only button"],
    supportedSurfaces: ["all"],
    example: "Use primary for Buy License and outline for secondary navigation actions."
  },
  {
    name: "Input",
    category: "inputs",
    description: "Single-line text and numeric capture with inline validation.",
    usage: "Always pair with FormField label and helper or error text.",
    states: ["default", "focus", "invalid", "disabled"],
    props: ["type", "placeholder", "value", "onChange", "invalid"],
    accessibility: ["Associated label", "Error id linkage", "Keyboard support"],
    supportedSurfaces: ["customer-portal", "reseller-portal", "admin-dashboard", "mobile-pos", "desktop-pos"],
    example: "Use in checkout, login and portal account forms."
  },
  {
    name: "Select",
    category: "inputs",
    description: "Dropdown input for finite option sets.",
    usage: "Use for plan, branch, status and filter options.",
    states: ["default", "focus", "disabled"],
    props: ["placeholder", "value", "onChange"],
    accessibility: ["Native select keyboard support", "Visible label"],
    supportedSurfaces: ["all"],
    example: "Use for branch selector in dashboards and admin screens."
  },
  {
    name: "Checkbox",
    category: "inputs",
    description: "Binary or multi-select control with optional label and description.",
    usage: "Use for consent, filters and table bulk selection.",
    states: ["unchecked", "checked", "disabled"],
    props: ["checked", "onChange", "label", "description"],
    accessibility: ["Label click target", "Keyboard toggle"],
    supportedSurfaces: ["all"],
    example: "Use in DataGrid row selection and settings toggles."
  },
  {
    name: "RadioGroup",
    category: "inputs",
    description: "Mutually exclusive selection controls.",
    usage: "Use for one-of-many choices such as billing cycle.",
    states: ["selected", "unselected", "disabled"],
    props: ["value", "onValueChange", "items"],
    accessibility: ["Fieldset semantics", "Arrow key navigation"],
    supportedSurfaces: ["customer-portal", "reseller-portal", "admin-dashboard"],
    example: "Use in plan upgrade and payout schedule forms."
  },
  {
    name: "Switch",
    category: "inputs",
    description: "Immediate on or off control for settings.",
    usage: "Use for feature toggles and notification preferences.",
    states: ["on", "off", "disabled"],
    props: ["checked", "onCheckedChange", "label"],
    accessibility: ["Role switch", "State announcement"],
    supportedSurfaces: ["customer-portal", "reseller-portal", "admin-dashboard", "desktop-pos", "mobile-pos"],
    example: "Use in security and integration settings."
  },
  {
    name: "Tabs",
    category: "navigation",
    description: "Contextual sub-navigation for dense pages.",
    usage: "Use for segmenting related content in one page.",
    states: ["active", "inactive", "disabled"],
    props: ["defaultValue", "value", "onValueChange"],
    accessibility: ["Tab roles", "Arrow key navigation"],
    supportedSurfaces: ["customer-portal", "reseller-portal", "admin-dashboard", "documentation-portal"],
    example: "Use in analytics screens to separate revenue and retention panels."
  },
  {
    name: "Card",
    category: "layout",
    description: "Surface container with consistent border, radius and shadow.",
    usage: "Use for grouped information, stats and settings modules.",
    states: ["default", "hover"],
    props: ["className", "children"],
    accessibility: ["Semantic headings for grouped content"],
    supportedSurfaces: ["all"],
    example: "Use for KPI blocks and feature summary sections."
  },
  {
    name: "Table",
    category: "data-display",
    description: "Standard table primitives with header and row styles.",
    usage: "Use for compact datasets and simple lists.",
    states: ["default", "hover", "empty"],
    props: ["TableWrapper", "TableHead", "TableBody", "TableRow"],
    accessibility: ["Header semantics", "Consistent reading order"],
    supportedSurfaces: ["customer-portal", "reseller-portal", "admin-dashboard", "desktop-pos"],
    example: "Use for invoice list and device assignment tables."
  },
  {
    name: "DataGrid",
    category: "data-display",
    description: "Sortable and filterable datasets with row actions and bulk selection.",
    usage: "Use when users need search, sorting and pagination together.",
    states: ["loading", "empty", "error", "selected"],
    props: ["columns", "rows", "rowKey", "searchableKeys", "rowActions", "pageSize"],
    accessibility: ["Header semantics", "Cell focus order", "Screen reader row summary"],
    supportedSurfaces: ["customer-portal", "reseller-portal", "admin-dashboard", "desktop-pos"],
    example: "Use for customer lists, reseller payouts and support case queues."
  },
  {
    name: "Badge",
    category: "feedback",
    description: "Compact status indicator for labels and metadata.",
    usage: "Use to show status such as active, draft or pending.",
    states: ["default", "success", "warning", "danger", "info"],
    props: ["variant"],
    accessibility: ["Text label required"],
    supportedSurfaces: ["all"],
    example: "Use in table rows to show subscription state."
  },
  {
    name: "Alert",
    category: "feedback",
    description: "Status and incident feedback cards for success, warning, error and info states.",
    usage: "Use for inline warnings and system notices.",
    states: ["static", "dismissible"],
    props: ["variant", "title", "children"],
    accessibility: ["Role alert for critical messages", "Readable color contrast"],
    supportedSurfaces: ["all"],
    example: "Use for license expiration warnings in customer portal."
  },
  {
    name: "Modal",
    category: "overlays",
    description: "Focused task confirmation and detail overlays.",
    usage: "Use for destructive confirmations and short secondary forms.",
    states: ["open", "closing"],
    props: ["open", "defaultOpen", "onOpenChange", "ariaLabel"],
    accessibility: ["Focus trap", "Escape close", "Aria modal semantics"],
    supportedSurfaces: ["customer-portal", "reseller-portal", "admin-dashboard", "desktop-pos"],
    example: "Use before deleting integrations or rotating API keys."
  },
  {
    name: "Tooltip",
    category: "overlays",
    description: "Short contextual hints for compact UI controls.",
    usage: "Use for icon-only actions or glossary hints.",
    states: ["hidden", "visible"],
    props: ["content", "side"],
    accessibility: ["Visible on focus", "Concise text"],
    supportedSurfaces: ["all"],
    example: "Use to explain commission metric labels in reseller portal."
  },
  {
    name: "Pagination",
    category: "navigation",
    description: "Page navigation control for long lists.",
    usage: "Use with DataGrid and paginated docs or blog indexes.",
    states: ["default", "active", "disabled"],
    props: ["page", "pageCount", "onPageChange"],
    accessibility: ["Aria current page", "Previous next labels"],
    supportedSurfaces: ["customer-portal", "reseller-portal", "admin-dashboard", "documentation-portal"],
    example: "Use in admin queue tables with large result sets."
  },
  {
    name: "Breadcrumbs",
    category: "navigation",
    description: "Location path pattern for hierarchical routes.",
    usage: "Use on docs, feature and solution detail pages.",
    states: ["default"],
    props: ["items"],
    accessibility: ["Aria breadcrumb navigation"],
    supportedSurfaces: ["marketing-website", "documentation-portal", "admin-dashboard"],
    example: "Use on docs article pages for category and topic context."
  },
  {
    name: "EmptyState",
    category: "feedback",
    description: "Guided state for screens with no content yet.",
    usage: "Use when first-time users need direction.",
    states: ["default"],
    props: ["title", "description", "actionLabel", "onAction"],
    accessibility: ["Action button with clear label"],
    supportedSurfaces: ["all"],
    example: "Use on integrations screen when account has no connections."
  },
  {
    name: "LoadingState",
    category: "feedback",
    description: "Spinner, progress bar and skeleton combination for asynchronous data.",
    usage: "Use while data requests are pending.",
    states: ["indeterminate"],
    props: ["title", "description", "rows"],
    accessibility: ["Readable loading message"],
    supportedSurfaces: ["all"],
    example: "Use on analytics dashboard while KPI cards load."
  },
  {
    name: "Progress",
    category: "feedback",
    description: "Linear progress indicator for long-running steps.",
    usage: "Use for uploads, synchronization and onboarding completion progress.",
    states: ["0-100"],
    props: ["value", "max", "label"],
    accessibility: ["Aria progressbar semantics", "Announced current value"],
    supportedSurfaces: ["all"],
    example: "Use during import, backup and sync processes."
  },
  {
    name: "ErrorState",
    category: "feedback",
    description: "Actionable failure block with optional retry action.",
    usage: "Use for recoverable request and integration failures.",
    states: ["default", "with-action"],
    props: ["title", "description", "actionLabel", "onAction", "details"],
    accessibility: ["Readable error message", "Retry action focusable"],
    supportedSurfaces: ["all"],
    example: "Use when payment provider sync endpoint returns server error."
  },
  {
    name: "Dashboard Patterns",
    category: "patterns",
    description: "KPI cards, chart containers and activity feed panels.",
    usage: "Use for analytics and overview pages in portal and admin.",
    states: ["default", "empty", "loading"],
    props: ["KpiCard", "ChartPanel", "ActivityFeedPanel"],
    accessibility: ["Chart summaries in text", "Readable KPI labels"],
    supportedSurfaces: ["customer-portal", "reseller-portal", "admin-dashboard"],
    example: "Use for subscription health, revenue trend and recent activity sections."
  },
  {
    name: "Navigation Patterns",
    category: "patterns",
    description: "Public top nav, portal sidebar, mobile bottom nav and desktop task header.",
    usage: "Use to preserve orientation and route consistency across surfaces.",
    states: ["default", "active"],
    props: ["marketingTopNav", "PortalSidebarPattern", "MobileBottomNavPattern", "DesktopTaskHeaderPattern"],
    accessibility: ["Visible active state", "Touch-size mobile targets"],
    supportedSurfaces: ["all"],
    example: "Use portal sidebar in customer and reseller shells with surface-specific menus."
  }
];

export const formPatterns = {
  requiredIndicator: "Append star for required labels and preserve helper text below control.",
  inlineValidation: "Show validation after blur and during submit for changed fields.",
  errorMessageStyle: "One sentence, actionable and specific to field intent.",
  successConfirmation: "Use concise inline confirmation or toast with next action.",
  placeholderRule: "Placeholder supports examples only and does not replace labels.",
  fieldSpacing: "Use md spacing token between label, control and helper text."
} as const;

export const qaChecklist = [
  "Tokens are used instead of hard-coded colors and spacing values.",
  "Component variants include hover, active, disabled and loading states where relevant.",
  "Keyboard focus order and focus ring visibility are verified.",
  "Dark mode parity is reviewed for text, surfaces and chart readability.",
  "Responsive behavior is checked on mobile, tablet, desktop and wide breakpoints.",
  "Loading, empty and error states are implemented for data surfaces.",
  "Table and grid interactions stay usable with large datasets.",
  "Screen reader labels and ARIA roles are present for interactive controls.",
  "Marketing pages keep informational role and do not expose POS operations.",
  "Portal and public navigation boundaries remain explicit and unambiguous."
] as const;

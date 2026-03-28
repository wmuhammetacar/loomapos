import { downloadArtifacts, pricingPlans, siteConfig } from "@/lib/site-content";
import { getCanonicalFeaturePathByAnySlug } from "@/lib/feature-governance";

export interface MarketingCtaItem {
  href: string;
  label: string;
  variant: "primary" | "secondary" | "outline" | "ghost";
}

export interface ScreenshotPlaceholder {
  title: string;
  description: string;
  platform: "desktop" | "mobile" | "dashboard";
}

export interface MarketingFeaturePage {
  slug: string;
  route?: string;
  clusterSlug?: string;
  locale?: string;
  legacySlugs?: string[];
  keyword: string;
  title: string;
  summary: string;
  whatItDoes: string;
  desktopFlow: string;
  mobileFlow: string;
  businessBenefits: string[];
  usageExamples: string[];
  screenshots: ScreenshotPlaceholder[];
  relatedSolutions: string[];
}

export interface SeoLandingPage {
  slug: string;
  keyword: string;
  title: string;
  description: string;
  industryFocus: string;
  painPoints: string[];
  valuePoints: string[];
  featureSlugs: string[];
  screenshots: ScreenshotPlaceholder[];
}

export interface SolutionPage {
  slug: string;
  title: string;
  description: string;
  audience: string;
  painPoints: string[];
  workflows: string[];
  featureSlugs: string[];
  testimonialPlaceholder: string;
  screenshots: ScreenshotPlaceholder[];
}

export interface AlternativePage {
  slug: string;
  competitor: string;
  title: string;
  description: string;
  strengths: string[];
  migrationAdvantages: string[];
  comparison: Array<{
    label: string;
    loomapos: string;
    competitor: string;
  }>;
}

export interface IntegrationPage {
  slug: string;
  title: string;
  category: string;
  description: string;
  capabilities: string[];
  relatedFeatureSlugs: string[];
}

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  category: "getting-started" | "installation" | "activation" | "desktop" | "mobile";
  sections: Array<{
    heading: string;
    body: string[];
  }>;
  troubleshooting: string[];
  relatedFeatureSlugs: string[];
}

export interface MarketingBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  publishedAt: string;
  readTime: string;
  relatedFeatureSlugs: string[];
  relatedDocSlugs: string[];
  sections: Array<{
    heading: string;
    body: string[];
  }>;
}

export const supportedMarketingLocales = ["tr", "en", "ar"] as const;

export const marketingPrimaryCtas: MarketingCtaItem[] = [
  { href: "/register", label: "Start Free Trial", variant: "primary" },
  { href: "/pricing", label: "Buy License", variant: "outline" },
  { href: "/download#windows", label: "Download Desktop", variant: "ghost" }
];

export const marketingSecondaryCtas: MarketingCtaItem[] = [
  { href: "/demo", label: "Request Demo", variant: "primary" },
  { href: "/download#android", label: "Download Mobile", variant: "outline" },
  { href: "/resellers", label: "Become a Reseller", variant: "ghost" }
];

export const publicHeaderNav = [
  { href: "/features", label: "Features" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/integrations", label: "Integrations" },
  { href: "/download", label: "Download" },
  { href: "/blog", label: "Blog" },
  { href: "/docs", label: "Docs" },
  { href: "/resellers", label: "Resellers" }
] as const;

export const footerNavGroups = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Homepage" },
      { href: "/features", label: "Features" },
      { href: "/solutions", label: "Solutions" },
      { href: "/pricing", label: "Pricing" },
      { href: "/alternatives", label: "Alternatives" }
    ]
  },
  {
    title: "Resources",
    links: [
      { href: "/download", label: "Download Center" },
      { href: "/docs", label: "Documentation" },
      { href: "/faq", label: "FAQ" },
      { href: "/blog", label: "Blog" },
      { href: "/demo", label: "Demo" },
      { href: "/integrations", label: "Integrations" }
    ]
  },
  {
    title: "Partners",
    links: [
      { href: "/resellers", label: "Reseller Program" },
      { href: "/resellers/apply", label: "Apply as Reseller" },
      { href: "/reseller/login", label: "Reseller Login" },
      { href: "/contact", label: "Sales Contact" }
    ]
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/security", label: "Security" },
      { href: "/status", label: "Status" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" }
    ]
  }
] as const;

export const homeStats = [
  { value: "7/24", label: "subscription, activation and onboarding access" },
  { value: "10+", label: "SEO-focused feature and solution clusters" },
  { value: "3", label: "distinct surfaces: website, customer portal, reseller portal" }
] as const;

export const trustSignals = [
  "Desktop and Mobile operational workflows remain outside the browser.",
  "Licenses, downloads and onboarding are clearly separated from store operations.",
  "Portal, reseller and public website journeys each use their own route family.",
  "Structured content and canonical routes prepare the site for long-term SEO growth."
] as const;

export const customerLogoPlaceholders = [
  "Retail chain logo placeholder",
  "Boutique logo placeholder",
  "Cafe group logo placeholder",
  "Market network logo placeholder"
] as const;

export const testimonialPlaceholders = [
  {
    quote:
      "The website clarified the product instantly, and the team moved from evaluation to activation without confusion.",
    author: "Retail Operations Manager",
    company: "Customer story placeholder"
  },
  {
    quote:
      "Partners can understand commissions, onboarding and rollout flow before the first sales call.",
    author: "Regional Reseller",
    company: "Partner story placeholder"
  }
] as const;

export const integrationHighlights = [
  {
    slug: "e-fatura",
    title: "E-Fatura / E-Arsiv",
    category: "Compliance",
    description:
      "Invoice documents are prepared in the operational layer while the website explains supported flows and onboarding expectations.",
    capabilities: [
      "Async document submission readiness",
      "Archive and status visibility",
      "Activation guidance for onboarding"
    ],
    relatedFeatureSlugs: ["e-invoice", "reports"]
  },
  {
    slug: "odeme-kuruluslari",
    title: "Payment Providers",
    category: "Payments",
    description:
      "Collect in-store or remote payments through supported providers while the website drives demos and subscription intent.",
    capabilities: [
      "Remote payment collection preparation",
      "Billing and subscription alignment",
      "Provider-specific rollout notes"
    ],
    relatedFeatureSlugs: ["online-payments", "reports"]
  },
  {
    slug: "barkod-ve-tartim",
    title: "Barcode and Scale Devices",
    category: "Hardware",
    description:
      "Operational device usage belongs in Desktop and Mobile apps; the marketing site explains hardware compatibility and rollout value.",
    capabilities: [
      "Barcode reader compatibility messaging",
      "Scale and label workflow compatibility",
      "Device rollout documentation"
    ],
    relatedFeatureSlugs: ["sales", "inventory"]
  },
  {
    slug: "yazarkasa-ve-fiscal",
    title: "Cash Register and Fiscal Devices",
    category: "Fiscal",
    description:
      "Fiscal compatibility and support scope are presented on the website, while live fiscal workflows stay inside the apps.",
    capabilities: [
      "Fiscal integration overview",
      "Technical rollout expectations",
      "Activation and compliance notes"
    ],
    relatedFeatureSlugs: ["cash-register-integrations", "e-invoice"]
  }
] satisfies IntegrationPage[];

export const marketingFeatures = [
  {
    slug: "sales",
    legacySlugs: ["sales"],
    keyword: "satis yonetimi",
    title: "Sales Management",
    summary:
      "Fast sales, barcode handling and checkout-oriented flows are explained on the website and executed in the Desktop or Mobile app.",
    whatItDoes:
      "Explains how the platform supports cashier speed, product lookup, discount logic and checkout continuity without turning the browser into a POS screen.",
    desktopFlow:
      "Desktop operators use barcode, receipt and payment peripherals directly in the installed Windows app with offline-first reliability.",
    mobileFlow:
      "Mobile teams handle assisted sales and lightweight field workflows through the operational mobile app, not the website.",
    businessBenefits: [
      "Shorter onboarding for store teams",
      "Hardware-friendly sales flow communication",
      "Clear conversion path from website to active deployment"
    ],
    usageExamples: [
      "Scan products and complete high-volume cashier sessions in the desktop app.",
      "Support store floor sales or assisted product lookup through the mobile app.",
      "Explain sales workflow readiness during evaluation before the trial starts."
    ],
    screenshots: [
      {
        title: "Desktop checkout workspace",
        description: "Receipt, barcode and product basket view placeholder.",
        platform: "desktop"
      },
      {
        title: "Mobile assisted sale",
        description: "Quick product lookup and order support placeholder.",
        platform: "mobile"
      }
    ],
    relatedSolutions: ["retail", "market", "boutique", "restaurant"]
  },
  {
    slug: "inventory",
    legacySlugs: ["inventory"],
    keyword: "stok yonetimi",
    title: "Inventory Management",
    summary:
      "Inventory visibility, stock counting and critical stock processes are sold and explained on the website, then executed in the apps.",
    whatItDoes:
      "Shows how the platform supports stock visibility, counting routines and catalog control without exposing operational stock management in the browser.",
    desktopFlow:
      "Desktop teams manage stock cards, stock movement visibility and count preparation inside the installed app.",
    mobileFlow:
      "Mobile teams perform shelf counts, warehouse checks and field verification through the mobile app.",
    businessBenefits: [
      "Reduces confusion between marketing site and inventory workspace",
      "Improves sales conversations with clear inventory value framing",
      "Supports SEO around stock management intent"
    ],
    usageExamples: [
      "Prepare stock counts for branches before deployment.",
      "Review product availability during onboarding and activation planning.",
      "Guide mobile stock counting teams with app-first setup instructions."
    ],
    screenshots: [
      {
        title: "Desktop stock cards",
        description: "Product stock and threshold visibility placeholder.",
        platform: "desktop"
      },
      {
        title: "Mobile stock counting",
        description: "Shelf count and discrepancy review placeholder.",
        platform: "mobile"
      }
    ],
    relatedSolutions: ["retail", "market", "boutique"]
  },
  {
    slug: "reports",
    legacySlugs: ["reporting"],
    keyword: "raporlar",
    title: "Reports and Insights",
    summary:
      "Explain daily sales, branch trends and performance reporting clearly while keeping the reporting actions in the apps and portals.",
    whatItDoes:
      "Positions reporting as a business outcome page with examples of daily reports, branch comparisons and management-ready summaries.",
    desktopFlow:
      "Branch and HQ teams review sales and performance views in the desktop experience.",
    mobileFlow:
      "Decision makers monitor high-level summaries on mobile without relying on the browser for operational dashboards.",
    businessBenefits: [
      "Supports search intent for reporting-focused buyers",
      "Clarifies the difference between portal metadata and app analytics use cases",
      "Strengthens trust through measurable value messaging"
    ],
    usageExamples: [
      "Compare branch-level revenue performance.",
      "Review refund trends and category movement.",
      "Prepare leadership summaries before renewals."
    ],
    screenshots: [
      {
        title: "Desktop reporting panel",
        description: "KPI trend cards and date filters placeholder.",
        platform: "dashboard"
      },
      {
        title: "Mobile executive summary",
        description: "Compact daily summary placeholder.",
        platform: "mobile"
      }
    ],
    relatedSolutions: ["retail", "restaurant", "cafe", "market"]
  },
  {
    slug: "staff-management",
    legacySlugs: ["staff"],
    keyword: "personel yonetimi",
    title: "Staff Management",
    summary:
      "Describe roles, permissions and shift readiness clearly so buyers understand how teams are governed before rollout.",
    whatItDoes:
      "Explains user roles, permission boundaries and shift readiness without turning the site into an HR or operations console.",
    desktopFlow:
      "Managers configure user access and operational permissions in the application environment.",
    mobileFlow:
      "Field users only see the tools relevant to their mobile responsibilities.",
    businessBenefits: [
      "Makes enterprise and multi-branch plans easier to justify",
      "Supports staff management keyword clusters",
      "Reinforces security and access governance trust"
    ],
    usageExamples: [
      "Define cashier versus manager access expectations during onboarding.",
      "Prepare permission rollout for multiple branches.",
      "Align portal users with operational app users."
    ],
    screenshots: [
      {
        title: "Desktop roles screen",
        description: "Role matrix and permission placeholders.",
        platform: "desktop"
      },
      {
        title: "Mobile role-aware layout",
        description: "Task-limited mobile workflow placeholder.",
        platform: "mobile"
      }
    ],
    relatedSolutions: ["retail", "market", "restaurant"]
  },
  {
    slug: "branch-management",
    legacySlugs: ["branches"],
    keyword: "sube yonetimi",
    title: "Branch Management",
    summary:
      "Show how multi-branch companies coordinate licenses, deployments and visibility without moving branch operations into the website.",
    whatItDoes:
      "Describes rollout, branch grouping and activation planning for growing businesses that need consistent deployment across locations.",
    desktopFlow:
      "HQ operations coordinate branch setup and device distribution in the desktop environment.",
    mobileFlow:
      "Regional teams monitor branch readiness and device status through mobile or portal support flows.",
    businessBenefits: [
      "Helps multi-location prospects self-qualify",
      "Supports enterprise pricing conversations",
      "Improves reseller and rollout clarity"
    ],
    usageExamples: [
      "Prepare phased branch rollout plans.",
      "Map license/device allocation by location.",
      "Support reseller-led deployments across multiple stores."
    ],
    screenshots: [
      {
        title: "Branch rollout board",
        description: "Multi-branch setup and activation placeholder.",
        platform: "dashboard"
      },
      {
        title: "Regional mobile view",
        description: "Branch readiness and device state placeholder.",
        platform: "mobile"
      }
    ],
    relatedSolutions: ["retail", "market", "restaurant"]
  },
  {
    slug: "online-payments",
    legacySlugs: ["collections"],
    keyword: "online odeme",
    title: "Online Payments",
    summary:
      "Explain remote payment collection and payment-provider readiness as a conversion feature, not a browser checkout terminal.",
    whatItDoes:
      "Shows how businesses can extend payment flexibility while keeping payment execution and transaction operations in the right app surfaces.",
    desktopFlow:
      "Desktop teams coordinate payment status and customer collection context around the transaction flow.",
    mobileFlow:
      "Mobile teams support payment follow-up and field confirmation when needed.",
    businessBenefits: [
      "Captures high-intent search around remote collection",
      "Connects pricing conversations to payment flexibility",
      "Highlights integration-readiness for commerce buyers"
    ],
    usageExamples: [
      "Offer payment links for deferred or remote collections.",
      "Coordinate paid and unpaid statuses with store teams.",
      "Match payment provider setup during onboarding."
    ],
    screenshots: [
      {
        title: "Payment status workspace",
        description: "Collection status and provider sync placeholder.",
        platform: "desktop"
      },
      {
        title: "Mobile collection follow-up",
        description: "Field payment confirmation placeholder.",
        platform: "mobile"
      }
    ],
    relatedSolutions: ["retail", "boutique", "cafe"]
  },
  {
    slug: "product-variants",
    legacySlugs: ["variants"],
    keyword: "urun varyantlari",
    title: "Product Variants",
    summary:
      "Present size, color and variant complexity in a way that helps buyers understand product control without exposing live catalog editing on the site.",
    whatItDoes:
      "Explains how product variants support real businesses with configurable items, fast lookup and cleaner reporting.",
    desktopFlow:
      "Desktop teams maintain variant-rich product catalogs in the operational app.",
    mobileFlow:
      "Mobile teams confirm variants quickly during field stock and assisted sales workflows.",
    businessBenefits: [
      "Supports boutiques and specialty retail SEO intent",
      "Strengthens catalog management positioning",
      "Improves fit for fashion and configurable inventory businesses"
    ],
    usageExamples: [
      "Manage size and color combinations for apparel.",
      "Track SKU-level movement across branches.",
      "Support quick lookup in assisted sales."
    ],
    screenshots: [
      {
        title: "Variant catalog screen",
        description: "Variant combinations and stock view placeholder.",
        platform: "desktop"
      },
      {
        title: "Mobile variant lookup",
        description: "Variant quick-search placeholder.",
        platform: "mobile"
      }
    ],
    relatedSolutions: ["boutique", "retail"]
  },
  {
    slug: "e-invoice",
    legacySlugs: ["einvoice"],
    keyword: "e-fatura entegrasyonu",
    title: "E-Invoice and E-Archive",
    summary:
      "Clarify document workflows, activation expectations and compliance-ready messaging for businesses evaluating regulated environments.",
    whatItDoes:
      "Explains how e-invoice and e-archive support fit into the product lifecycle without exposing document submission operations on the site.",
    desktopFlow:
      "Operational teams prepare and submit invoice documents inside the app stack.",
    mobileFlow:
      "Mobile teams reference document status and customer context where needed.",
    businessBenefits: [
      "Builds trust with compliance-conscious buyers",
      "Supports integration-led SEO queries",
      "Connects activation docs with feature education"
    ],
    usageExamples: [
      "Prepare onboarding for e-invoice activation.",
      "Map document support expectations by business type.",
      "Discuss compliance flows during enterprise demos."
    ],
    screenshots: [
      {
        title: "Invoice status monitor",
        description: "Document state and queue placeholder.",
        platform: "dashboard"
      },
      {
        title: "Mobile reference card",
        description: "Invoice info lookup placeholder.",
        platform: "mobile"
      }
    ],
    relatedSolutions: ["retail", "restaurant", "market"]
  },
  {
    slug: "cash-register-integrations",
    legacySlugs: ["fiscal"],
    keyword: "yazarkasa entegrasyonlari",
    title: "Cash Register Integrations",
    summary:
      "Position fiscal device compatibility as a trust and rollout feature while keeping fiscal operations in the desktop environment.",
    whatItDoes:
      "Explains supported cash register and fiscal device scenarios, rollout requirements and technical fit for regulated retail workflows.",
    desktopFlow:
      "Desktop runtime handles cash register and fiscal device communication during sales operations.",
    mobileFlow:
      "Mobile surfaces can support status awareness, but not the fiscal operation itself.",
    businessBenefits: [
      "Improves trust for regulated businesses",
      "Supports device compatibility sales conversations",
      "Creates a natural bridge to demo and rollout calls"
    ],
    usageExamples: [
      "Evaluate compatibility for fiscal devices before subscription purchase.",
      "Prepare branch rollout with supported hardware expectations.",
      "Use reseller onboarding to align technical support scope."
    ],
    screenshots: [
      {
        title: "Fiscal compatibility panel",
        description: "Supported devices and rollout placeholder.",
        platform: "dashboard"
      },
      {
        title: "Desktop fiscal flow",
        description: "Receipt and device control placeholder.",
        platform: "desktop"
      }
    ],
    relatedSolutions: ["market", "retail", "restaurant"]
  },
  {
    slug: "pricing-management",
    legacySlugs: ["dashboard"],
    keyword: "fiyat yonetimi",
    title: "Pricing Management",
    summary:
      "Explain list pricing, campaign timing and branch price consistency while keeping real pricing operations inside the apps.",
    whatItDoes:
      "Shows how businesses maintain pricing control, updates and rollout governance without confusing buyers with browser-based operational screens.",
    desktopFlow:
      "Desktop teams coordinate price list updates and branch-level rollouts through the app environment.",
    mobileFlow:
      "Mobile teams confirm pricing readiness and field visibility on supported screens.",
    businessBenefits: [
      "Supports evaluation for businesses with frequent pricing changes",
      "Adds another high-intent SEO entry point",
      "Improves enterprise positioning for controlled rollouts"
    ],
    usageExamples: [
      "Prepare a promotion rollout across multiple stores.",
      "Keep branch prices aligned with central decisions.",
      "Support seasonal updates through deployment planning."
    ],
    screenshots: [
      {
        title: "Price list manager",
        description: "Scheduled price updates placeholder.",
        platform: "desktop"
      },
      {
        title: "Branch readiness panel",
        description: "Price rollout status placeholder.",
        platform: "dashboard"
      }
    ],
    relatedSolutions: ["retail", "market", "boutique"]
  }
] satisfies MarketingFeaturePage[];

export const seoLandingPages = [
  {
    slug: "pos-programi",
    keyword: "pos programi",
    title: "POS Programi",
    description:
      "LoomaPOS, webden tanitilan ve uygulamada calisan bir POS programi olarak abonelik, lisans ve kurulum surecini netlestirir.",
    industryFocus: "Genel perakende ve cok kullanicili isletmeler",
    painPoints: [
      "Tarayicida kasa bekleyen kullanicilar hangi yuzeyin operasyon icin oldugunu karistirir.",
      "Donanim uyumlulugu ve offline gereksinimleri sade anlatilmazsa satin alma kararini zorlastirir.",
      "Abonelik, lisans ve indirme akislari daginik olursa donusum duser."
    ],
    valuePoints: [
      "Web site urunu anlatir, plani satar ve uygulamaya indirir.",
      "Desktop ve Mobile yuzeyler operasyonu gerceklestirir.",
      "Portal sadece lisans, abonelik ve indirme merkezi olarak calisir."
    ],
    featureSlugs: ["sales", "inventory", "reports"],
    screenshots: [
      {
        title: "Desktop POS overview",
        description: "Operational desktop interface placeholder.",
        platform: "desktop"
      },
      {
        title: "Mobile operations overview",
        description: "Operational mobile interface placeholder.",
        platform: "mobile"
      }
    ]
  },
  {
    slug: "satis-programi",
    keyword: "satis programi",
    title: "Satis Programi",
    description:
      "Satis programi arayan isletmeler icin hizli satis, barkod, rapor ve aktivasyon surecini anlatan donusum odakli sayfa.",
    industryFocus: "Hizli satis yapan perakende isletmeleri",
    painPoints: [
      "Kasada hiz kaybi ve donanim sorunlari satisi aksatir.",
      "Web tabanli cozumlerde cihaz ve fis surekliligi endise yaratir.",
      "Onboarding ile canli kullanim arasinda kopukluk olur."
    ],
    valuePoints: [
      "Satis akisi Windows uygulamasinda stabil calisir.",
      "Website fiyatlandirma ve demo taleplerini toplar.",
      "Kurulum docs ile aktivasyon hizlanir."
    ],
    featureSlugs: ["sales", "cash-register-integrations", "reports"],
    screenshots: [
      {
        title: "Checkout screen",
        description: "Sales-focused desktop screen placeholder.",
        platform: "desktop"
      },
      {
        title: "Shift-ready mobile helper",
        description: "Mobile support screen placeholder.",
        platform: "mobile"
      }
    ]
  },
  {
    slug: "barkodlu-satis-programi",
    keyword: "barkodlu satis programi",
    title: "Barkodlu Satis Programi",
    description:
      "Barkod okuyucu, urun bulma ve hizli satis akislarini anlatan landing page ile barkodlu satis aramalarini donusume tasir.",
    industryFocus: "Barkodla hizli satis yapan magazalar ve marketler",
    painPoints: [
      "Urun bulma ve barkod akisi yavaslarsa kasada kuyruk olusur.",
      "Uyumlu donanim beklentisi net anlatilmazsa deneme baslamaz.",
      "Farkli subelerde ayni akisin nasil kurulacagi belirsiz kalir."
    ],
    valuePoints: [
      "Barkod uyumlulugu ve hizli satis senaryolari acikca anlatilir.",
      "Kurulum ve aktivasyon akisi download hub ile desteklenir.",
      "Bayi ve rollout ekipleri icin net bir teslim modeli vardir."
    ],
    featureSlugs: ["sales", "inventory", "branch-management"],
    screenshots: [
      {
        title: "Barcode cashier flow",
        description: "Barcode scan and checkout placeholder.",
        platform: "desktop"
      },
      {
        title: "Stock lookup companion",
        description: "Mobile barcode lookup placeholder.",
        platform: "mobile"
      }
    ]
  },
  {
    slug: "perakende-pos",
    keyword: "perakende pos",
    title: "Perakende POS",
    description:
      "Perakende odakli POS landing sayfasi; cok urunlu katalog, raporlama ve cihaz rollout ihtiyaclarini anlatir.",
    industryFocus: "Genel perakende operasyonlari",
    painPoints: [
      "Perakende isletmeleri fiyat, stok ve raporu ayni anda gormek ister.",
      "Offline ve sube yayilimi karar asamasinda kritik rol oynar.",
      "Kurulum sureci karmasiklastiginda denemeden satin almaya gecis duser."
    ],
    valuePoints: [
      "Perakende odakli feature kombinasyonlari tek sayfada toplanir.",
      "Pricing ve demo akisina guclu gecis verilir.",
      "Kurulum ve aktivasyon docs ile desteklenir."
    ],
    featureSlugs: ["inventory", "reports", "branch-management"],
    screenshots: [
      {
        title: "Retail dashboard",
        description: "Branch and category visibility placeholder.",
        platform: "dashboard"
      },
      {
        title: "Retail stock operations",
        description: "Desktop retail setup placeholder.",
        platform: "desktop"
      }
    ]
  },
  {
    slug: "restoran-pos",
    keyword: "restoran pos",
    title: "Restoran POS",
    description:
      "Restoran ve yeme-icme isletmeleri icin hiz, raporlama ve cihaz uyumlulugu odakli landing page.",
    industryFocus: "Restoranlar ve servis odakli mekanlar",
    painPoints: [
      "Yemek servisi yogunlugunda hiz kaybi tolere edilemez.",
      "Odeme ve fiskal uyumluluk beklentisi yuksektir.",
      "Saha ekibi ve yonetim ayni sistemi farkli acilardan gormek ister."
    ],
    valuePoints: [
      "Hizli satis, rapor ve cihaz uyumu birlikte anlatilir.",
      "Demo talebi ile teknik uyum sorulari toplanir.",
      "Portal, lisans ve indirme merkezi olarak sade kalir."
    ],
    featureSlugs: ["sales", "cash-register-integrations", "reports"],
    screenshots: [
      {
        title: "Restaurant desktop flow",
        description: "Restaurant sale workspace placeholder.",
        platform: "desktop"
      },
      {
        title: "Service status on mobile",
        description: "Mobile summary placeholder.",
        platform: "mobile"
      }
    ]
  },
  {
    slug: "kafe-pos",
    keyword: "kafe pos",
    title: "Kafe POS",
    description:
      "Kafeler icin hizli satis, raporlama ve aktivasyon basitligini one cikararak deneme ve satin alma niyeti toplar.",
    industryFocus: "Kafeler ve hizli servis noktalar",
    painPoints: [
      "Dar ekiplerle hizli satis yapilirken kurulum kolayligi beklenir.",
      "Fiyat ve cihaz uyumlulugu erken asamada netlesmelidir.",
      "Mobil destek akislari rollout surecini etkiler."
    ],
    valuePoints: [
      "Kafe odakli satis akisi ve raporlama vurgulanir.",
      "Download ve docs linkleri kurulum hizini artirir.",
      "Buy license ve start trial CTA'lari yakin tutulur."
    ],
    featureSlugs: ["sales", "reports", "online-payments"],
    screenshots: [
      {
        title: "Cafe cashier",
        description: "Fast-service desktop placeholder.",
        platform: "desktop"
      },
      {
        title: "Mobile day summary",
        description: "Compact mobile placeholder.",
        platform: "mobile"
      }
    ]
  },
  {
    slug: "butik-pos",
    keyword: "butik pos",
    title: "Butik POS",
    description:
      "Butikler icin varyant, stok ve fiyat yonetimini one cikaran landing page; moda perakendesine ozel aramalari hedefler.",
    industryFocus: "Moda, butik ve urun varyantli magazalar",
    painPoints: [
      "Renk ve beden varyantlari olmayan sistemler is akisini yavaslatir.",
      "Promosyon ve fiyat guncellemeleri sik yasanir.",
      "Stok sayimi ve urun bulunurlugu net olmalidir."
    ],
    valuePoints: [
      "Varyant ve fiyat yonetimi acikca konumlanir.",
      "Butik odakli SEO giris sayfasi olusturur.",
      "Feature ve docs sayfalarina guclu ic link verir."
    ],
    featureSlugs: ["product-variants", "inventory", "pricing-management"],
    screenshots: [
      {
        title: "Variant-rich boutique catalog",
        description: "Boutique desktop catalog placeholder.",
        platform: "desktop"
      },
      {
        title: "Mobile variant lookup",
        description: "Mobile boutique support placeholder.",
        platform: "mobile"
      }
    ]
  },
  {
    slug: "market-pos",
    keyword: "market pos",
    title: "Market POS",
    description:
      "Marketler icin barkod, stok, fiskal uyumluluk ve cok subeli kullanim ihtiyaclarini kapsayan landing page.",
    industryFocus: "Marketler ve yogun urun hareketi olan noktalar",
    painPoints: [
      "Yuksek SKU ve hizli sirkulasyon stok gorunumunu zorlar.",
      "Cihaz uyumu ve kasada sureklilik kritik onemdedir.",
      "Sube yayilimi ve fiyat guncellemeleri merkezi yonetim ister."
    ],
    valuePoints: [
      "Market odakli uyumluluk ve stok dili kullanir.",
      "Barkod, rapor ve branch rollout birlikte anlatilir.",
      "Pricing ve demo icin yuksek niyetli CTA yerlesimi kurar."
    ],
    featureSlugs: ["sales", "inventory", "cash-register-integrations", "branch-management"],
    screenshots: [
      {
        title: "Market checkout",
        description: "High-volume cashier placeholder.",
        platform: "desktop"
      },
      {
        title: "Branch readiness",
        description: "Market branch rollout placeholder.",
        platform: "dashboard"
      }
    ]
  },
  {
    slug: "magaza-pos",
    keyword: "magaza pos",
    title: "Magaza POS",
    description:
      "Magaza operasyonlari icin satis, raporlama ve fiyat yonetimi odakli genel landing page; arama niyetini pricing ve demo akislariyla bulusturur.",
    industryFocus: "Magazalar ve tek/multi-store perakende yapilari",
    painPoints: [
      "Magazalar tek ekranda her seyi gormek ister ama operasyon ve web rolleri karisir.",
      "Stok, fiyat ve kampanya koordinasyonu zorlasir.",
      "Urun gosterimi ile satin alma akisi arasinda kopukluk olur."
    ],
    valuePoints: [
      "Magaza isletmeleri icin net feature paketi kurar.",
      "Deneme, satin alma ve indirme butonlarini yakin sunar.",
      "Docs ve onboarding ile kurulum stresini dusurur."
    ],
    featureSlugs: ["sales", "inventory", "pricing-management"],
    screenshots: [
      {
        title: "Store management workspace",
        description: "Store desktop placeholder.",
        platform: "desktop"
      },
      {
        title: "Executive summary",
        description: "Dashboard visibility placeholder.",
        platform: "dashboard"
      }
    ]
  }
] satisfies SeoLandingPage[];

export const solutionPages = [
  {
    slug: "retail",
    title: "Retail POS Solution",
    description:
      "For multi-product retail businesses that need sales speed, stock visibility and branch-ready deployment clarity.",
    audience: "Retail stores, chains and growing merchants",
    painPoints: [
      "Too many disconnected systems slow down store teams.",
      "Head office needs rollouts and reporting without browser-based operations.",
      "Teams need a clear handoff from website evaluation to app activation."
    ],
    workflows: [
      "Evaluate the product on the website and compare plans.",
      "Start the subscription or trial flow.",
      "Download the desktop app and activate it with the issued license."
    ],
    featureSlugs: ["sales", "inventory", "reports", "branch-management"],
    testimonialPlaceholder:
      "Retail customer testimonial placeholder focused on rollout speed and reporting clarity.",
    screenshots: [
      {
        title: "Retail branch control",
        description: "HQ-ready branch placeholder.",
        platform: "dashboard"
      },
      {
        title: "Retail desktop cashier",
        description: "Store workstation placeholder.",
        platform: "desktop"
      }
    ]
  },
  {
    slug: "restaurant",
    title: "Restaurant POS Solution",
    description:
      "For restaurants that need speed, device compatibility and fast onboarding without mixing the website with operational order-taking.",
    audience: "Restaurants and food service operations",
    painPoints: [
      "Peak-hour transactions demand fast device-aware execution.",
      "Operational complexity must stay out of the browser.",
      "Managers need easy reporting and onboarding guidance."
    ],
    workflows: [
      "Review restaurant-oriented capabilities on the solution page.",
      "Request a demo or compare pricing.",
      "Deploy the desktop app for in-store operations."
    ],
    featureSlugs: ["sales", "cash-register-integrations", "reports"],
    testimonialPlaceholder:
      "Restaurant testimonial placeholder around speed and fiscal readiness.",
    screenshots: [
      {
        title: "Restaurant transaction screen",
        description: "Food-service desktop placeholder.",
        platform: "desktop"
      },
      {
        title: "Restaurant mobile summary",
        description: "Manager-facing mobile placeholder.",
        platform: "mobile"
      }
    ]
  },
  {
    slug: "cafe",
    title: "Cafe POS Solution",
    description:
      "For cafes that value speed, simple onboarding and clear download-to-activation guidance.",
    audience: "Cafes and quick-service locations",
    painPoints: [
      "Lean teams need a simple setup experience.",
      "Mobile visibility supports managers during busy service hours.",
      "Fast decisions require clean trial and pricing entry points."
    ],
    workflows: [
      "Review cafe-oriented sales and payment features.",
      "Start a free trial or request a demo.",
      "Download the operational app and activate the license."
    ],
    featureSlugs: ["sales", "online-payments", "reports"],
    testimonialPlaceholder:
      "Cafe testimonial placeholder centered on quick onboarding and service speed.",
    screenshots: [
      {
        title: "Cafe workstation",
        description: "Quick service desktop placeholder.",
        platform: "desktop"
      },
      {
        title: "Cafe mobile status",
        description: "Small-team mobile placeholder.",
        platform: "mobile"
      }
    ]
  },
  {
    slug: "market",
    title: "Market POS Solution",
    description:
      "For markets handling high SKU counts, barcode-heavy sales and branch coordination across busy retail environments.",
    audience: "Markets and grocery-style operations",
    painPoints: [
      "Fast-moving inventory creates pressure on stock accuracy.",
      "Barcode-heavy checkout flows must remain stable.",
      "Branch-level consistency matters for pricing and rollout."
    ],
    workflows: [
      "Enter through SEO landing pages such as market POS.",
      "Explore inventory, barcode and fiscal features.",
      "Move into pricing, checkout and app activation."
    ],
    featureSlugs: ["sales", "inventory", "cash-register-integrations", "branch-management"],
    testimonialPlaceholder:
      "Market testimonial placeholder emphasizing barcode throughput and stock control.",
    screenshots: [
      {
        title: "High-volume checkout",
        description: "Market cashier placeholder.",
        platform: "desktop"
      },
      {
        title: "Market stock oversight",
        description: "Branch stock summary placeholder.",
        platform: "dashboard"
      }
    ]
  },
  {
    slug: "boutique",
    title: "Boutique POS Solution",
    description:
      "For boutiques that depend on variants, elegant catalog control and campaign-ready price management.",
    audience: "Boutiques and fashion-forward specialty stores",
    painPoints: [
      "Variant-heavy catalogs need better product clarity.",
      "Seasonal pricing changes must stay consistent.",
      "Store teams need fast product lookup without browser-based ops."
    ],
    workflows: [
      "Discover boutique-specific solution content from SEO pages.",
      "Review variant, inventory and pricing features.",
      "Use docs and download center for deployment readiness."
    ],
    featureSlugs: ["product-variants", "inventory", "pricing-management"],
    testimonialPlaceholder:
      "Boutique testimonial placeholder focused on variants and campaign rollouts.",
    screenshots: [
      {
        title: "Variant catalog",
        description: "Boutique catalog placeholder.",
        platform: "desktop"
      },
      {
        title: "Mobile stock helper",
        description: "Boutique mobile stock placeholder.",
        platform: "mobile"
      }
    ]
  }
] satisfies SolutionPage[];

export const alternativePages = [
  {
    slug: "benimpos",
    competitor: "BenimPOS",
    title: "LoomaPOS vs BenimPOS",
    description:
      "A comparison page designed to capture competitor intent and explain migration clarity, rollout logic and modern SaaS purchase flow.",
    strengths: [
      "Clear subscription and license flow",
      "Distinct website, portal and app separation",
      "Structured docs and download center"
    ],
    migrationAdvantages: [
      "Lower confusion between evaluation and activation",
      "Better reseller and rollout readiness",
      "Centralized pricing, docs and app download journey"
    ],
    comparison: [
      { label: "Evaluation flow", loomapos: "Structured landing pages and demo paths", competitor: "Generic competitor search intent" },
      { label: "Subscription clarity", loomapos: "Pricing and portal handoff are explicit", competitor: "Requires manual explanation" },
      { label: "Download and activation", loomapos: "Dedicated download hub and docs", competitor: "Less structured transition" }
    ]
  },
  {
    slug: "mikro-pos",
    competitor: "Mikro POS",
    title: "LoomaPOS vs Mikro POS",
    description:
      "A comparison page for buyers evaluating migration, rollout simplicity and a cleaner SaaS purchase-to-activation journey.",
    strengths: [
      "Modern subscription-first buying flow",
      "SEO-oriented feature and industry content",
      "Download center paired with activation docs"
    ],
    migrationAdvantages: [
      "Better fit for digital-first acquisition",
      "Faster self-education through docs and comparison content",
      "Easier partner onboarding for resellers"
    ],
    comparison: [
      { label: "Website experience", loomapos: "Growth-focused marketing architecture", competitor: "Traditional sales presentation" },
      { label: "Content depth", loomapos: "Feature, solution and comparison clusters", competitor: "Lower long-tail coverage" },
      { label: "Conversion path", loomapos: "Trial, pricing and download CTAs across pages", competitor: "Heavier sales dependency" }
    ]
  },
  {
    slug: "netsis-pos",
    competitor: "Netsis POS",
    title: "LoomaPOS vs Netsis POS",
    description:
      "A migration-oriented page for searchers comparing modern acquisition experience, content depth and rollout clarity.",
    strengths: [
      "Simpler path from search result to demo or trial",
      "Better public-to-portal separation",
      "Conversion instrumentation built into marketing pages"
    ],
    migrationAdvantages: [
      "SEO content directly supports buyer education",
      "Trial and download decisions happen with less friction",
      "Portal confusion is reduced for returning customers"
    ],
    comparison: [
      { label: "Search capture", loomapos: "Dedicated competitor and keyword pages", competitor: "Less focused on organic acquisition" },
      { label: "Operational separation", loomapos: "Website never acts as POS", competitor: "Harder messaging distinction" },
      { label: "Partner growth", loomapos: "Reseller journey is explicit", competitor: "Partner path is less visible" }
    ]
  }
] satisfies AlternativePage[];

export const docsPages = [
  {
    slug: "getting-started",
    title: "Getting Started with LoomaPOS",
    description:
      "Understand the website, portal and app surfaces before you begin your subscription, trial and activation journey.",
    category: "getting-started",
    sections: [
      {
        heading: "Know the three surfaces",
        body: [
          "The public website exists to explain the product, compare pricing and route you into the right next step.",
          "The customer portal is for subscription, license, billing and download visibility only.",
          "Desktop and Mobile apps handle the real store operations."
        ]
      },
      {
        heading: "Start your evaluation path",
        body: [
          "Review features and solution pages that match your business.",
          "Use pricing and demo pages when you are ready to compare plans or ask questions.",
          "Move to the download center only when you are ready to install the apps."
        ]
      }
    ],
    troubleshooting: [
      "If you expected to perform live sales on the website, switch to the desktop or mobile app path.",
      "If you already have a subscription, use the customer portal for license and download access."
    ],
    relatedFeatureSlugs: ["sales", "inventory"]
  },
  {
    slug: "installation",
    title: "Installation Guide",
    description:
      "Learn how to download the Windows, Android and iOS artifacts, review requirements and complete the installation flow.",
    category: "installation",
    sections: [
      {
        heading: "Desktop installation",
        body: [
          "Download the Windows installer from the download center or the customer portal.",
          "Review the minimum system requirements before deployment.",
          "Complete the installer flow and prepare license activation."
        ]
      },
      {
        heading: "Mobile installation",
        body: [
          "Use the Android or iOS distribution links listed on the download page.",
          "Confirm the supported OS version and connectivity expectations.",
          "Coordinate activation with your issued license where required."
        ]
      }
    ],
    troubleshooting: [
      "If the installer cannot be opened, verify OS and permission prerequisites.",
      "If you do not see the correct artifact, log into the customer portal for licensed downloads."
    ],
    relatedFeatureSlugs: ["branch-management", "sales"]
  },
  {
    slug: "license-activation",
    title: "License Activation",
    description:
      "Follow the activation sequence from purchase or trial creation to an active device in the desktop or mobile environment.",
    category: "activation",
    sections: [
      {
        heading: "Where your license comes from",
        body: [
          "After checkout, the platform issues a license and attaches it to your subscription.",
          "The customer portal becomes your visibility layer for license and download access.",
          "Activation itself happens in the installed app surfaces."
        ]
      },
      {
        heading: "Activating your device",
        body: [
          "Install the correct app first.",
          "Use the provided license information inside the app flow.",
          "Confirm that the device limit and subscription status are active."
        ]
      }
    ],
    troubleshooting: [
      "If activation fails, verify that the license is active and not expired.",
      "If you cannot find the license, return to the customer portal or checkout success page."
    ],
    relatedFeatureSlugs: ["cash-register-integrations", "branch-management"]
  },
  {
    slug: "desktop-guide",
    title: "Desktop App Guide",
    description:
      "See how the Windows desktop app fits into the website-to-activation journey and what the first operational steps look like.",
    category: "desktop",
    sections: [
      {
        heading: "Desktop app role",
        body: [
          "The desktop app is the operational heart of in-store POS workflows.",
          "The website explains the workflow, but the desktop app runs the checkout, stock and hardware integrations.",
          "The portal complements the app with subscription and license visibility."
        ]
      },
      {
        heading: "First-day setup",
        body: [
          "Install the app, activate the license and verify device readiness.",
          "Review branch, user and feature availability according to your plan.",
          "Use the docs and support routes for guided setup."
        ]
      }
    ],
    troubleshooting: [
      "If the desktop app appears unlicensed, confirm subscription state in the portal.",
      "If hardware behavior is unclear, review the relevant feature or integration page."
    ],
    relatedFeatureSlugs: ["sales", "inventory", "cash-register-integrations"]
  },
  {
    slug: "mobile-guide",
    title: "Mobile App Guide",
    description:
      "Understand how the mobile app supports field operations, stock workflows and visibility without moving those operations into the website.",
    category: "mobile",
    sections: [
      {
        heading: "Mobile app role",
        body: [
          "The mobile app supports field tasks, assisted sales and stock verification use cases.",
          "The public website introduces these workflows and routes buyers to download and docs.",
          "Operational execution remains inside the mobile runtime."
        ]
      },
      {
        heading: "Deployment basics",
        body: [
          "Install the Android or iOS build from the download center.",
          "Confirm login and license expectations for your organization.",
          "Use role-appropriate workflows for mobile teams."
        ]
      }
    ],
    troubleshooting: [
      "If the app is installed but not ready, verify account and license state.",
      "If mobile users are unsure what to use, revisit the solution and feature pages tied to their workflow."
    ],
    relatedFeatureSlugs: ["inventory", "staff-management", "online-payments"]
  }
] satisfies DocPage[];

export const marketingBlogPosts = [
  {
    slug: "pos-programi-secerken-nelere-bakilmali",
    title: "POS Programi Secerken Nelere Bakilmali?",
    excerpt:
      "Modern bir POS SaaS cozumunu degerlendirirken website, portal ve uygulama rollerini nasil ayiracaginizi anlatan rehber.",
    category: "POS Guides",
    tags: ["pos programi", "satin alma rehberi", "saas"],
    publishedAt: "2026-03-12",
    readTime: "6 min",
    relatedFeatureSlugs: ["sales", "reports"],
    relatedDocSlugs: ["getting-started", "license-activation"],
    sections: [
      {
        heading: "Web sitesi ne is yapmali?",
        body: [
          "Bir POS SaaS websitesi urunu anlatmali, planlari gostermeli ve kullaniciyi dogru uygulamaya yonlendirmelidir.",
          "Canli satis, stok veya kasa isleri tarayicida calismamali; bu ayrim guven ve netlik yaratir."
        ]
      },
      {
        heading: "Dogrulamaniz gereken noktalar",
        body: [
          "Fiyatlandirma modeli acik mi?",
          "Indirme merkezi ve lisans aktivasyon dokumani kolay bulunuyor mu?",
          "Demo, trial ve portal giris akislari birbirine karismiyor mu?"
        ]
      }
    ]
  },
  {
    slug: "perakende-icin-stok-yonetimi-ipuclari",
    title: "Perakende Icin Stok Yonetimi Ipuclari",
    excerpt:
      "Perakende isletmeleri icin stok gorunurlugu, sayim rutini ve uygulama-website ayrimini aciklayan SEO odakli makale.",
    category: "Retail Tips",
    tags: ["stok yonetimi", "perakende", "magaza"],
    publishedAt: "2026-03-10",
    readTime: "5 min",
    relatedFeatureSlugs: ["inventory", "branch-management"],
    relatedDocSlugs: ["installation", "mobile-guide"],
    sections: [
      {
        heading: "Stok gorebilirligi neden onemli?",
        body: [
          "Stok gorunurlugu fiyat, satis ve replenishment kararlarini dogrudan etkiler.",
          "Webde stok operasyonu yapmadan, bu degeri landing page'lerde netlestirmek karar surecini hizlandirir."
        ]
      },
      {
        heading: "Mobil sayim neden kritik?",
        body: [
          "Raf sayimi ve depo kontrolu mobil uygulamada yapildiginda ekipler daha hizli ilerler.",
          "Website ise bu akisin faydasini anlatan bir egitim ve donusum yuzeyi olur."
        ]
      }
    ]
  },
  {
    slug: "barkodlu-satis-sureci-nasil-hizlandirilir",
    title: "Barkodlu Satis Sureci Nasil Hizlandirilir?",
    excerpt:
      "Barkodlu satis yapan isletmeler icin donanim uyumu, yazilim akisi ve kurulum stratejisi uzerine pratik oneriler.",
    category: "POS Guides",
    tags: ["barkodlu satis", "market pos", "kasa hizi"],
    publishedAt: "2026-03-08",
    readTime: "4 min",
    relatedFeatureSlugs: ["sales", "cash-register-integrations"],
    relatedDocSlugs: ["desktop-guide", "installation"],
    sections: [
      {
        heading: "Kasa hizini etkileyen temel unsur",
        body: [
          "Cihaz uyumu ve yazilim akisi birlikte dusunulmediginde barkodlu satis deneyimi zarar gorur.",
          "Degerlendirme asamasinda bu noktalari website'de net anlatmak donusum oranini artirir."
        ]
      },
      {
        heading: "Kurulumda yapilan tipik hata",
        body: [
          "Webi operasyon yeri zannetmek ve uygulama aktivasyonunu gec anlamak ekiplerde karisiklik yaratir.",
          "Download hub ve aktivasyon dokumani bu kopuklugu kapatir."
        ]
      }
    ]
  },
  {
    slug: "reseller-kanali-ile-pos-satisi-buyutmek",
    title: "Reseller Kanali ile POS Satisi Buyutmek",
    excerpt:
      "Partner ve reseller odakli buyume stratejisinde net route mimarisi, basvuru formu ve portal ayriminin neden onemli oldugunu anlatir.",
    category: "Business Growth",
    tags: ["reseller", "partner", "bayi programi"],
    publishedAt: "2026-03-06",
    readTime: "6 min",
    relatedFeatureSlugs: ["branch-management", "reports"],
    relatedDocSlugs: ["getting-started"],
    sections: [
      {
        heading: "Partnerlar neden net bir website ister?",
        body: [
          "Reseller ekosistemi icin basvuru, demo ve portal giris akisinin net ayrismasi kritik onemdedir.",
          "Bayi adaylari once guven, sonra avantaj ve son olarak basvuru formunu gormek ister."
        ]
      },
      {
        heading: "Lead toplamak yetmez",
        body: [
          "Partner buyumesi icin komisyon, aktivasyon ve onboarding anlatimi da gerekiyor.",
          "Bu nedenle reseller landing page, form ve portal girisi tek bir dusunulmus akisin parcasi olmali."
        ]
      }
    ]
  }
] satisfies MarketingBlogPost[];

export const docsCategoriesForIndex = [
  {
    title: "Onboarding",
    description: "Start here before trial, purchase, installation and activation.",
    slugs: ["getting-started", "installation", "license-activation"]
  },
  {
    title: "Applications",
    description: "Understand the runtime roles of Desktop and Mobile apps.",
    slugs: ["desktop-guide", "mobile-guide"]
  }
] as const;

export const publicIndexableRoutes = [
  "/",
  "/features",
  "/pricing",
  "/download",
  "/integrations",
  "/solutions",
  "/alternatives",
  "/resellers",
  "/demo",
  "/docs",
  "/faq",
  "/contact",
  "/blog",
  "/about",
  "/security",
  "/status"
] as const;

export function getMarketingFeatureBySlug(slug: string) {
  return marketingFeatures.find(
    (feature) => feature.slug === slug || feature.legacySlugs?.includes(slug)
  );
}

export function getCanonicalFeatureSlug(slug: string) {
  const feature = getMarketingFeatureBySlug(slug);
  return feature?.slug ?? slug;
}

export function getSeoLandingPageBySlug(slug: string) {
  return seoLandingPages.find((page) => page.slug === slug);
}

export function getSolutionPageBySlug(slug: string) {
  return solutionPages.find((page) => page.slug === slug);
}

export function getAlternativePageBySlug(slug: string) {
  return alternativePages.find((page) => page.slug === slug);
}

export function getIntegrationPageBySlug(slug: string) {
  return integrationHighlights.find((page) => page.slug === slug);
}

export function getDocPageBySlug(slug: string) {
  return docsPages.find((page) => page.slug === slug);
}

export function getMarketingBlogPostBySlug(slug: string) {
  return marketingBlogPosts.find((page) => page.slug === slug);
}

export function getMarketingBlogCategories() {
  return Array.from(new Set(marketingBlogPosts.map((post) => post.category)));
}

export function getMarketingBlogTags() {
  return Array.from(new Set(marketingBlogPosts.flatMap((post) => post.tags))).sort();
}

export function getRelatedFeatures(slugs: string[]) {
  const resolved = slugs
    .map((slug) => marketingFeatures.find((feature) => feature.slug === slug || feature.legacySlugs?.includes(slug)))
    .filter((feature) => Boolean(feature)) as MarketingFeaturePage[];

  const seen = new Set<string>();
  return resolved.filter((feature) => {
    if (seen.has(feature.slug)) {
      return false;
    }
    seen.add(feature.slug);
    return true;
  });
}

export function getRelatedDocs(slugs: string[]) {
  return docsPages.filter((page) => slugs.includes(page.slug));
}

export function getRelatedPosts(slug: string) {
  return marketingBlogPosts.filter((post) => post.slug !== slug).slice(0, 3);
}

export function getDownloadHighlights() {
  return downloadArtifacts.map((artifact) => ({
    ...artifact,
    href:
      artifact.platform === "windows"
        ? "/download#windows"
        : artifact.platform === "android"
          ? "/download#android"
          : "/download#ios"
  }));
}

export function getPricingHighlights() {
  return pricingPlans.map((plan) => ({
    code: plan.code,
    name: plan.name,
    summary: plan.summary,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    modules: plan.modules
  }));
}

export function buildMarketingSitemapRoutes() {
  return [
    ...publicIndexableRoutes,
    ...seoLandingPages.map((page) => `/${page.slug}`),
    ...solutionPages.map((page) => `/solutions/${page.slug}`),
    ...alternativePages.map((page) => `/alternatives/${page.slug}`),
    ...marketingFeatures.map((feature) => getCanonicalFeaturePathByAnySlug(feature.slug)),
    ...integrationHighlights.map((page) => `/integrations/${page.slug}`),
    ...docsPages.map((page) => `/docs/${page.slug}`),
    ...marketingBlogPosts.map((post) => `/blog/${post.slug}`),
    "/resellers/apply"
  ];
}

export const marketingSiteConfig = {
  ...siteConfig,
  title: "LoomaPOS Growth Website",
  description:
    "LoomaPOS growth website: SEO landing pages, feature content, pricing, downloads, docs, demo flows and reseller acquisition for a premium POS SaaS platform."
} as const;

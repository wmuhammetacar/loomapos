export type FeatureSlug =
  | "sales"
  | "inventory"
  | "reporting"
  | "staff"
  | "branches"
  | "collections"
  | "variants"
  | "einvoice"
  | "fiscal"
  | "dashboard";

export type PlanCode = "starter" | "pro" | "enterprise";
export type BillingCycle = "monthly" | "yearly";

export interface NavItem {
  href: string;
  label: string;
}

export interface CtaItem extends NavItem {
  variant: "primary" | "outline" | "ghost" | "secondary";
}

export interface FeatureModule {
  slug: FeatureSlug;
  title: string;
  shortTitle: string;
  summary: string;
  painPoint: string;
  solution: string;
  desktopUseCase: string;
  mobileUseCase: string;
  screenshotLabels: string[];
  proofPoints: string[];
  integrations?: string[];
}

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  summary: string;
  monthlyPrice: number;
  yearlyPrice: number;
  branchLimit: string;
  deviceLimit: string;
  userLimit: string;
  supportLevel: string;
  resellerEligibility: string;
  highlight?: boolean;
  modules: string[];
}

export interface DownloadArtifact {
  platform: "windows" | "android" | "ios";
  title: string;
  version: string;
  releaseDate: string;
  audience: string;
  visibility: "public" | "portal";
  releaseNotes: string[];
  requirements: string[];
  installationSteps: string[];
  activationSteps: string[];
}

export interface DocsCategory {
  slug: string;
  title: string;
  description: string;
  articles: Array<{
    title: string;
    summary: string;
    href: string;
    duration: string;
  }>;
}

export interface FaqCategory {
  slug: string;
  title: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
}

export interface BlogPost {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readTime: string;
  heroLabel: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
}

export interface LegalDocument {
  slug: "terms" | "privacy" | "kvkk" | "cookies";
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
}

export const siteConfig = {
  name: "LoomaPOS",
  title: "LoomaPOS Phase 1 Web Platform",
  description:
    "LoomaPOS web platformu; tanitim, fiyatlandirma, aylik-yillik abonelik satisi, lisans dagitimi, bayi programi, dokumantasyon ve uygulama indirme merkezi olarak calisir.",
  supportEmail: "destek@loomapos.com",
  salesEmail: "satis@loomapos.com",
  phone: "+90 850 000 56 62",
  city: "Istanbul, Turkiye",
  baseUrl: "https://www.loomapos.com"
} as const;

export const mainNav: NavItem[] = [
  { href: "/features", label: "Ozellikler" },
  { href: "/pricing", label: "Fiyatlandirma" },
  { href: "/download", label: "Indir" },
  { href: "/reseller", label: "Bayi" },
  { href: "/docs", label: "Dokumantasyon" },
  { href: "/login", label: "Giris" }
];

export const globalCtas: CtaItem[] = [
  { href: "/pricing", label: "Planlari Gor", variant: "outline" },
  { href: "/download", label: "Uygulamayi Indir", variant: "ghost" },
  { href: "/reseller", label: "Bayi Ol", variant: "outline" },
  { href: "/checkout?plan=pro&cycle=monthly", label: "Lisans Satin Al", variant: "primary" }
];

export const heroActions: CtaItem[] = [
  { href: "/pricing", label: "View Pricing", variant: "primary" },
  { href: "/download", label: "Download Apps", variant: "outline" },
  { href: "/reseller", label: "Become a Reseller", variant: "ghost" }
];

export const trustStats = [
  { value: "4.800+", label: "perakende noktasi icin konumlandirilmis ticari yapi" },
  { value: "11", label: "satis odakli modulun lisans tabanli tanitimi" },
  { value: "7/24", label: "onboarding, lisans ve aktivasyon destek akisi" }
] as const;

export const sectorBlocks = [
  "Market",
  "Kirtasiye",
  "Sarkuteri",
  "Giyim",
  "Akaryakit Istasyonu",
  "Bakkal",
  "Kuruyemis",
  "Petshop"
] as const;

export const featureModules: FeatureModule[] = [
  {
    slug: "sales",
    title: "Sales Operations",
    shortTitle: "Satis Operasyonlari",
    summary: "Hizli satis, iade, iskonto ve cihaz cevresi masaustu ya da mobil uygulamada calisir.",
    painPoint:
      "Tarayici tabanli kasa ekranlari donanim entegrasyonu, offline senaryo ve saha performansinda risk yaratir.",
    solution:
      "LoomaPOS bu modulu webde satmaz; web sadece ne kazandiginizi anlatir, gercek operasyon ise Desktop ve Mobile istemcide yurutulur.",
    desktopUseCase:
      "Kasiyer masaustu uygulamasinda barkod, odeme, fis ve musteri ekranini ayni oturumda yonetir.",
    mobileUseCase:
      "Mobil uygulama saha satisi, siparis teyidi ve hizli katalog kontrolu icin operasyon yuzeyi sunar.",
    screenshotLabels: ["Desktop kasa ekrani placeholder", "Mobil hizli satis placeholder"],
    proofPoints: [
      "Offline-first runtime",
      "Barkod ve fis cevre birimi uyumu",
      "Lisans limitine gore cihaz aktivasyonu"
    ],
    integrations: ["Yazici", "Barkod okuyucu", "Musteri ekranlari"]
  },
  {
    slug: "inventory",
    title: "Inventory Management",
    shortTitle: "Stok Yonetimi",
    summary: "Stok seviyeleri, kritik esikler ve stok sayim akislari uygulama tarafinda yonetilir.",
    painPoint:
      "Gercek zamanli stok hareketlerini tarayicida islemek, saha personeli ve depo ekipleri icin daginik bir deneyim uretir.",
    solution:
      "Web katmani stok modulu icin faydayi, lisans kapsamini ve aktivasyon mantigini aciklar; hareket isleme yetkisi vermez.",
    desktopUseCase:
      "Desktop istemci urun karti, sayim, kritik stok uyarisi ve tedarik akislarini merkez subede toplar.",
    mobileUseCase:
      "Mobil istemci raf sayimi, depo turu ve saha stok dogrulamasini hizlandirir.",
    screenshotLabels: ["Desktop stok karti placeholder", "Mobil stok sayim placeholder"],
    proofPoints: ["Kritik stok esikleri", "Sube bazli gorunum", "Varyant ve birim destegi"],
    integrations: ["Barkod", "Toplu ice aktarim", "Saha sayim cihazlari"]
  },
  {
    slug: "reporting",
    title: "Reporting",
    shortTitle: "Raporlama",
    summary: "Satis, tahsilat ve kanal bazli performans raporlari uygulama tarafinda gosterilir.",
    painPoint:
      "Isletmeler raporlama sayfasinda bile operasyon yazilimi beklentisine girer; bu da web katmaninin amacini bulandirir.",
    solution:
      "Bu sayfa sadece raporlama modulu kapsamlarini, yonetici faydasini ve lisans seviyelerini satar.",
    desktopUseCase:
      "Merkez ofis desktop uygulamada gunluk rapor, kasiyer ozeti ve sube karsilastirmasi izler.",
    mobileUseCase:
      "Saha yoneticileri mobilde gun sonu performans ve cihaz durumunu hizli gorur.",
    screenshotLabels: ["Desktop rapor paneli placeholder", "Mobil ozet rapor placeholder"],
    proofPoints: ["Gunluk ve donemsel filtreler", "Sube ve personel karsilastirmasi", "PDF ve disa aktarim hazirligi"],
    integrations: ["Excel export", "Email rapor ozeti", "Yonetici bildirimleri"]
  },
  {
    slug: "staff",
    title: "Staff Management",
    shortTitle: "Personel Yonetimi",
    summary: "Kullanici, rol, vardiya ve yetki kapsamlarini lisans bazli yonetmeye hazirlar.",
    painPoint:
      "Personel erisimi ile operasyon ekrani ayni yerde oldugunda guvenlik ve egitim maliyeti artar.",
    solution:
      "Web platformu, personel modulu icin hangi planin kac kullanici destekledigini ve nasil aktive edilecegini anlatir.",
    desktopUseCase:
      "Desktop istemcide kasiyer yetkisi, sube baglantisi ve vardiya akisi uygulanir.",
    mobileUseCase:
      "Mobil istemcide saha personeli kendi rolune uygun ekranlarla sinirli operasyon gorur.",
    screenshotLabels: ["Desktop personel karti placeholder", "Mobil vardiya durumu placeholder"],
    proofPoints: ["Rol bazli yetki matrisi", "Sube bazli kullanici limiti", "Aktivasyon ve cihaz takibi"],
    integrations: ["LDAP/OIDC hazirligi", "Yetki loglari", "Vardiya raporlari"]
  },
  {
    slug: "branches",
    title: "Branch Management",
    shortTitle: "Sube Yonetimi",
    summary: "Cok subeli yapilar icin lisans limitleri, cihaz dagilimi ve rollout senaryolari tanitilir.",
    painPoint:
      "Sube acilisini web panelinden operasyonel hale getirmek, Phase 1 ticari web kuralini ihlal eder.",
    solution:
      "Bu modulde sube sayisi, devreye alma takvimi ve multi-branch lisans mantigi anlatilir; sube operasyonu webde yapilmaz.",
    desktopUseCase:
      "Merkez desktop uygulamasi sube cihazlarini, fiyat dagitimini ve terminal aktivasyonlarini toplar.",
    mobileUseCase:
      "Bolge yoneticisi mobil istemcide sube sagligi ve aktivasyon durumunu kontrol eder.",
    screenshotLabels: ["Desktop sube dagitimi placeholder", "Mobil saha kontrol placeholder"],
    proofPoints: ["Sube limiti plan bazli", "Merkezden rollout", "Cihaz aktivasyon esigi"],
    integrations: ["VPN / baglanti politikasi", "Merkez raporlama", "Bolge yonetimi"]
  },
  {
    slug: "collections",
    title: "Online Payment Collection Integration",
    shortTitle: "Online Tahsilat Entegrasyonu",
    summary: "Link ile tahsilat, uzak odeme ve tahsilat takibini operasyon uygulamalarina baglar.",
    painPoint:
      "Tahsilat baglantilari ile saha operasyonunu ayni web akisina koymak siparis ve lisans deneyimini karmasiklastirir.",
    solution:
      "Web sayfasi bu entegrasyonun gelir etkisini, desteklenen saglayicilari ve plan farklarini aciklar.",
    desktopUseCase:
      "Desktop istemcide siparis veya cari odemesi icin tahsilat linki uretilebilir.",
    mobileUseCase:
      "Mobil istemci saha tahsilati veya uzaktan odeme teyidi icin kullanilir.",
    screenshotLabels: ["Desktop tahsilat linki placeholder", "Mobil odeme onayi placeholder"],
    proofPoints: ["Uzak tahsilat linkleri", "Durum geri bildirimi", "Bakiye ve cari senaryolari"],
    integrations: ["PayTR", "Iyzico", "Stripe adapter-ready"]
  },
  {
    slug: "variants",
    title: "Variant Product Management",
    shortTitle: "Varyantli Urun Yonetimi",
    summary: "Beden, renk, lot veya paket varyantlari uygulamalarda islenir, webde ise plan avantajlari anlatilir.",
    painPoint:
      "Varyant kombinasyonlarini webde operasyonel hale getirmek karmasa yaratir ve performans hedeflerini bozar.",
    solution:
      "Bu landing page; varyant modulu, fiyat farki kurallari ve stok etkisini satis diliyle anlatir.",
    desktopUseCase:
      "Desktop uygulama renk-beden secimi, fiyat farki ve stok dusumunu tek akisla yonetir.",
    mobileUseCase:
      "Mobil ekip sahada varyant stok dogrulama ve hizli siparis teyidini kullanir.",
    screenshotLabels: ["Desktop varyant matrisi placeholder", "Mobil varyant secimi placeholder"],
    proofPoints: ["Varyant bazli fiyat farki", "Barkod esleme", "Stok ve rapor uyumu"],
    integrations: ["E-ticaret katalog esleme", "Toplu ice aktarim", "Label baski"]
  },
  {
    slug: "einvoice",
    title: "E-Invoice Integration",
    shortTitle: "E-Fatura Entegrasyonu",
    summary: "E-fatura ve e-arsiv baglantilari mevzuat uyumlu operasyon uygulamalarina hazirlanir.",
    painPoint:
      "Mevzuat uyumu gerektiren belgeler tarayici odakli MVP akislarinda kopukluk yaratabilir.",
    solution:
      "Web sitesi e-fatura modulu icin entegrasyon kapsamlarini, uygun planlari ve onboarding adimlarini listeler.",
    desktopUseCase:
      "Desktop istemci faturali satis ve cari senaryolarinda belge olusturma akisina baglanir.",
    mobileUseCase:
      "Mobil istemci belge durum takibi ve saha teyidi icin bilgi verir.",
    screenshotLabels: ["Desktop e-fatura durumu placeholder", "Mobil belge durum placeholder"],
    proofPoints: ["Entegrator hazirligi", "Belge durum takibi", "Kurulum ve aktivasyon rehberi"],
    integrations: ["Ozel entegratorlar", "Mail teslimi", "Belge arsivi"]
  },
  {
    slug: "fiscal",
    title: "Cash Register Integrations",
    shortTitle: "Yazarkasa Integrasyonlari",
    summary: "Mali cihaz, fis ve regule cevre birimleri sadece masaustu veya mobil istemcide kullanilir.",
    painPoint:
      "Mali cihaz entegrasyonlari tarayici sinirlari nedeniyle webde operasyonel olarak calistirilamaz.",
    solution:
      "Web katmani, desteklenen mali cihaz ailelerini ve devreye alma akisini satar; gercek cihaza dokunmaz.",
    desktopUseCase:
      "Desktop POS, mali cihaz emirleri ve fis baskisini sertifikali cevrelerde yurutur.",
    mobileUseCase:
      "Mobil uygulama saha terminaliyle entegre cihazlarda teyit ve durum takibi saglar.",
    screenshotLabels: ["Desktop mali cihaz placeholder", "Mobil cihaz durumu placeholder"],
    proofPoints: ["Mali cihaz uyumlulugu", "Fis ve belge akisi", "Yetkili kurulum yonlendirmesi"],
    integrations: ["Yazarkasa POS", "Fiscal printer", "Teknik servis rollout"]
  },
  {
    slug: "dashboard",
    title: "Management Dashboard",
    shortTitle: "Yonetim Paneli",
    summary: "Karar vericiler icin ozet KPI, lisans, cihaz ve isletme durumu gorunumu uygulama yuzeylerinde sunulur.",
    painPoint:
      "Dashboard kelimesi ziyaretcide tarayicida canli operasyon beklentisi dogurabilir.",
    solution:
      "Bu sayfa sadece yonetim paneli kazanclarini, lisans seviyelerini ve uygulama dagitim modelini netlestirir.",
    desktopUseCase:
      "Desktop yonetici paneli satis ozeti, sube performansi ve cihaz durumunu toplu gosterir.",
    mobileUseCase:
      "Mobil panel, saha yoneticisinin hizli KPI kontrolu icin optimize edilir.",
    screenshotLabels: ["Desktop KPI dashboard placeholder", "Mobil yonetici gorunumu placeholder"],
    proofPoints: ["KPI kartlari", "Sube-saha genel gorunum", "Lisans ve cihaz telemetrisi"],
    integrations: ["BI export", "Bildirim servisleri", "Yoneticilere email ozet"]
  }
];

export const featurePreviewGrid = [
  { title: "Sales Operations", href: "/features/sales", description: "Kasa ve odeme akislari uygulamalarda calisir." },
  { title: "Inventory Management", href: "/features/inventory", description: "Kritik stok, sayim ve urun hareketleri uygulamalarda yonetilir." },
  { title: "Reporting", href: "/features/reporting", description: "Yonetici raporlari lisansli istemcilerde izlenir." },
  { title: "Staff Management", href: "/features/staff", description: "Rol, yetki ve personel yapisi cihaz bazli aktive edilir." },
  { title: "Branch Management", href: "/features/branches", description: "Cok subeli rollout ve cihaz limiti plan bazli kurulur." },
  { title: "Online Payment Collection Integration", href: "/features/collections", description: "Uzak tahsilat entegrasyonu uygulama operasyonuna baglanir." },
  { title: "Variant Product Management", href: "/features/variants", description: "Beden, renk ve paket varyantlari uygulamalarda islenir." },
  { title: "E-Invoice Integration", href: "/features/einvoice", description: "Belge akisi ve kurulum rehberi plan bazli sunulur." },
  { title: "Cash Register Integrations", href: "/features/fiscal", description: "Mali cihaz baglantilari webde degil istemcide calisir." },
  { title: "Pricing Management", href: "/pricing", description: "Fiyat katmani webde satilir, operasyon uygulamada kullanilir." },
  { title: "Management Dashboard", href: "/features/dashboard", description: "Karar destek ekranlari masaustu ve mobilde sunulur." }
] as const;

export const pricingPlans: PlanDefinition[] = [
  {
    code: "starter",
    name: "Starter",
    summary: "Tek sube ile lisansli POS ekosistemine kontrollu gecis.",
    monthlyPrice: 1490,
    yearlyPrice: 14900,
    branchLimit: "1 sube",
    deviceLimit: "1 POS / cihaz",
    userLimit: "3 personel",
    supportLevel: "Standart onboarding + email destek",
    resellerEligibility: "Bayi yonlendirmesi desteklenir",
    modules: [
      "Sales Operations",
      "Inventory Management",
      "Reporting",
      "Download Center",
      "License Delivery"
    ]
  },
  {
    code: "pro",
    name: "Pro",
    summary: "Birden cok sube, saha ve bayi odakli perakende ekipleri icin ana ticari paket.",
    monthlyPrice: 2990,
    yearlyPrice: 29900,
    branchLimit: "5 sube",
    deviceLimit: "5 POS / cihaz",
    userLimit: "10 personel",
    supportLevel: "Oncelikli destek + aktivasyon rehberligi",
    resellerEligibility: "Bayi kanalinda onerilen plan",
    highlight: true,
    modules: [
      "Starter tum moduller",
      "Branch Management",
      "Staff Management",
      "Online Payment Collection",
      "Variant Product Management",
      "E-Invoice"
    ]
  },
  {
    code: "enterprise",
    name: "Enterprise",
    summary: "Kurumsal markalar, zincir yapilar ve ozellestirilmis rollout gereksinimleri icin.",
    monthlyPrice: 5990,
    yearlyPrice: 59900,
    branchLimit: "Sinirsiz veya sozlesmeli",
    deviceLimit: "Sinirsiz veya sozlesmeli",
    userLimit: "Sinirsiz veya sozlesmeli",
    supportLevel: "Musteri basari yoneticisi + SLA opsiyonu",
    resellerEligibility: "Kurumsal bayi ve bolge partner yapisi",
    modules: [
      "Pro tum moduller",
      "Fiscal Integrations",
      "Advanced dashboard rollout",
      "Custom onboarding",
      "OIDC / SSO hazirligi"
    ]
  }
];

export const planComparisonRows = [
  { label: "Sube limiti", starter: "1", pro: "5", enterprise: "Sozlesmeli" },
  { label: "POS / cihaz limiti", starter: "1", pro: "5", enterprise: "Sozlesmeli" },
  { label: "Kullanici limiti", starter: "3", pro: "10", enterprise: "Sozlesmeli" },
  { label: "Lisans aktivasyonu", starter: "Dahil", pro: "Dahil", enterprise: "Dahil" },
  { label: "Desktop ve Mobile indirme", starter: "Dahil", pro: "Dahil", enterprise: "Dahil" },
  { label: "Bayi kodu ile checkout", starter: "Opsiyonel", pro: "Dahil", enterprise: "Dahil" }
] as const;

export const pricingFaq = [
  {
    question: "Aylik ve yillik planlar arasindaki temel fark nedir?",
    answer:
      "Teknik kapsam aynidir; fark faturalama periyodu, yenileme tarihi ve yillik odeme avantajidir."
  },
  {
    question: "Satin alma tamamlaninca ne olur?",
    answer:
      "Musteri hesabi, tenant kaydi, abonelik, lisans kaydi ve indirme erisimi olusur; sonrasinda Desktop veya Mobile aktivasyon adimlari izlenir."
  },
  {
    question: "Web sitesi uzerinden satis veya stok islemi yapabilir miyim?",
    answer:
      "Hayir. Web katmani sadece tanitim, lisans, checkout, indirme ve portal yonetimi icindir."
  }
] as const;

export const licensingFlow = [
  "Abonelik planini secin ve aylik ya da yillik donemi belirleyin.",
  "Checkout sirasinda sirket ve fatura bilgilerini tamamlayin.",
  "Odeme onayindan sonra tenant, abonelik ve lisans anahtari olusturulsun.",
  "Desktop ya da Mobile uygulamayi indirin ve lisansinizi aktive edin.",
  "Operasyonel kullanim sadece uygulama tarafinda baslasin."
] as const;

export const ecosystemCards = [
  {
    title: "Website layer",
    body: "Tanitim, fiyatlandirma, checkout, lisans dagitimi, bayi programi, dokumantasyon ve hesap yonetimi."
  },
  {
    title: "Desktop app",
    body: "Gercek satis, iade, stok hareketi, mali cihaz ve sube operasyonu."
  },
  {
    title: "Mobile app",
    body: "Saha aktivasyonu, hizli kontrol, mobil operasyon ve cihaz bazli kullanim."
  }
] as const;

export const downloadArtifacts: DownloadArtifact[] = [
  {
    platform: "windows",
    title: "Windows Desktop App",
    version: "1.4.2",
    releaseDate: "2026-02-28",
    audience: "Kasiyer, yonetici ve merkez ofis ekipleri",
    visibility: "portal",
    releaseNotes: [
      "Yeni lisans aktivasyon sihirbazi eklendi.",
      "Cok cihazli sube rollout akislari iyilestirildi.",
      "Fiscal cihaz durum kartlari guncellendi."
    ],
    requirements: ["Windows 10 veya 11", "4 GB RAM", "500 MB bos alan", ".NET Desktop Runtime bundle"],
    installationSteps: [
      "Portaldan lisansli kurulum paketini indirin.",
      "Yonetici yetkisiyle kurulumu baslatin.",
      "Sirket hesabinizla oturum acin ve cihaz adini tanimlayin."
    ],
    activationSteps: [
      "Portalda gorunen lisans anahtarini kopyalayin.",
      "Desktop acilis ekraninda anahtari girin.",
      "Cihaz aktivasyon limitini dogrulayip kullanima gecin."
    ]
  },
  {
    platform: "android",
    title: "Android Mobile App",
    version: "1.2.9",
    releaseDate: "2026-02-24",
    audience: "Saha ekipleri, stok sayim ve yonetici mobil kullanim",
    visibility: "portal",
    releaseNotes: [
      "Saha aktivasyon kontrolu hizlandirildi.",
      "Cihaz durum kartlari sadelestirildi.",
      "Kurumsal giris rehberi eklendi."
    ],
    requirements: ["Android 10+", "2 GB RAM", "Kamera ve bildirim izinleri", "Internet baglantisi ilk aktivasyon icin gerekli"],
    installationSteps: [
      "Portal veya kurumsal MDM linki uzerinden APK/Store baglantisini acin.",
      "Kurulumu tamamlayin ve uygulamayi ilk kez acin.",
      "Sirket e-posta adresinizle oturum acin."
    ],
    activationSteps: [
      "Portalda veya e-postada yer alan lisans bilgilerini kontrol edin.",
      "Mobil cihaz kaydini onaylayin.",
      "Lisans modu ACTIVE ise operasyon ekranlari acilir."
    ]
  },
  {
    platform: "ios",
    title: "iOS Mobile App",
    version: "1.2.9",
    releaseDate: "2026-02-24",
    audience: "Yoneticiler ve saha kontrol ekipleri",
    visibility: "public",
    releaseNotes: [
      "Store teslim notlari guncellendi.",
      "Kurumsal dagitim icin TestFlight yol haritasi eklendi."
    ],
    requirements: ["iOS 17+", "Apple kurumsal veya App Store erisimi", "Bildirim izinleri"],
    installationSteps: [
      "Public bilgi sayfasindan App Store veya TestFlight yonlendirmesini takip edin.",
      "Kurumsal hesapla kurulum davetini kabul edin.",
      "Ilk acilista tenant bilgilerinizle giris yapin."
    ],
    activationSteps: [
      "Portalda iOS dagitim erisimini kontrol edin.",
      "Lisansli tenant hesabiyla giris yapin.",
      "Cihaz dogrulamasi tamamlandiginda uygulama aktif olur."
    ]
  }
];

export const supportChannels = [
  { title: "Docs", description: "Kurulum, aktivasyon, cihaz baglama ve temel setup rehberleri.", href: "/docs" },
  { title: "FAQ", description: "Fiyat, lisans, faturalama, indirme ve bayi sik sorulan sorulari.", href: "/faq" },
  { title: "Onboarding", description: "Odeme sonrasi ilk 7 gun icin adim adim aktivasyon plani.", href: "/docs" },
  { title: "Support", description: "Portal icinden destek, mail ve aktivasyon yardimi.", href: "/contact" }
] as const;

export const resellerBenefits = [
  "Recurring revenue ve komisyon bazli gelir modeli",
  "Sektor odakli satis materyalleri ve kurulum rehberleri",
  "Lisans yenileme ve cihaz aktivasyon gorunurlugu",
  "Egitim, onboarding ve saha destek baglantilari"
] as const;

export const resellerJourney = [
  "Bayi programini inceleyin ve uygunluginizi degerlendirin.",
  "Bayi basvuru formunu doldurun ve ticari referanslarinizi iletin.",
  "Onaylandiginizda reseller giris bilgileri ve referral kodu olusturulsun.",
  "Musteri checkoutlarinizi, lisanslarinizi ve komisyonlarinizi portalden takip edin."
] as const;

export const docsCategories: DocsCategory[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Ilk satin alma, tenant olusumu ve lisans mantigini hizli anlamak icin.",
    articles: [
      {
        title: "Ilk satin alma sonrasi neler olur?",
        summary: "Tenant, lisans ve indirme erisimi olusum sirasi.",
        href: "/docs",
        duration: "5 dk"
      },
      {
        title: "Plan secimi ve lisans mantigi",
        summary: "Sube, cihaz ve personel limiti nasil okunur.",
        href: "/pricing",
        duration: "4 dk"
      }
    ]
  },
  {
    slug: "install-desktop",
    title: "Install Desktop",
    description: "Windows kurulum, cihaz aktivasyonu ve minimum gereksinimler.",
    articles: [
      {
        title: "Windows istemcisi nasil kurulur?",
        summary: "Kurulum paketi, yonetici yetkisi ve ilk oturum akisi.",
        href: "/download",
        duration: "6 dk"
      },
      {
        title: "Ilk lisans aktivasyonu",
        summary: "Portal lisans ekranindan desktop aktivasyona gecis.",
        href: "/portal/licenses",
        duration: "7 dk"
      }
    ]
  },
  {
    slug: "install-mobile",
    title: "Install Mobile",
    description: "Android ve iOS dagitimi, ilk cihaz onayi ve saha kullanim hazirligi.",
    articles: [
      {
        title: "Android dagitimi ve APK/Store senaryolari",
        summary: "Kurulum varyantlari ve temel izinler.",
        href: "/download",
        duration: "5 dk"
      },
      {
        title: "iOS teslim modeli",
        summary: "App Store veya TestFlight uzerinden dagitim notlari.",
        href: "/download",
        duration: "4 dk"
      }
    ]
  },
  {
    slug: "activate-license",
    title: "Activate License",
    description: "Lisans anahtari, cihaz limiti ve aktivasyon kontrolu.",
    articles: [
      {
        title: "Lisans anahtari nasil gorulur?",
        summary: "Musteri portalinda lisans, sure ve plan bilgisi.",
        href: "/portal/licenses",
        duration: "3 dk"
      },
      {
        title: "Cihaz limiti doldugunda ne olur?",
        summary: "Ek aktivasyon veya plan yukseltme mantigi.",
        href: "/portal/devices",
        duration: "4 dk"
      }
    ]
  },
  {
    slug: "basic-setup",
    title: "Basic Setup",
    description: "Temel setup, sube ve personel yapisini uygulamalara hazirlama.",
    articles: [
      {
        title: "Sube setup rehberi",
        summary: "Cok subeli kurulum planlamasi nasil yapilir.",
        href: "/features/branches",
        duration: "5 dk"
      },
      {
        title: "Personel rollout kontrol listesi",
        summary: "Yetki matrisi ve aktivasyon planlamasi.",
        href: "/features/staff",
        duration: "5 dk"
      }
    ]
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Indirme, aktivasyon, cihaz baglama ve faturalama sorunlarinda ilk kontrol adimlari.",
    articles: [
      {
        title: "Lisans bulunamadi hatasi",
        summary: "Abonelik, tenant ve aktivasyon verilerini kontrol edin.",
        href: "/faq",
        duration: "4 dk"
      },
      {
        title: "Kurulum paketine erisemiyorum",
        summary: "Portal erisimi ve rol kontrolleri.",
        href: "/portal/downloads",
        duration: "3 dk"
      }
    ]
  }
];

export const faqCategories: FaqCategory[] = [
  {
    slug: "pricing",
    title: "Pricing",
    items: [
      {
        question: "Planlarin farki nedir?",
        answer:
          "Fark; sube, cihaz ve personel limitleri ile destek seviyesidir. Tum planlar lisans ve indirme akisini icerir."
      },
      {
        question: "Yillik odemede ne kazanirim?",
        answer:
          "Daha stabil butce planlamasi, tek yenileme tarihi ve ticari indirim avantajina sahip olursunuz."
      }
    ]
  },
  {
    slug: "licenses",
    title: "Licenses",
    items: [
      {
        question: "Lisans anahtarim nerede?",
        answer:
          "Odeme sonrasi success ekraninda ve musteri portali altindaki Licenses bolumunde gosterilir."
      },
      {
        question: "Lisans suresi dolarsa ne olur?",
        answer:
          "Portal yenileme ve faturalama bilgisini guncel tutar; operasyonel runtime davranisi Desktop ve Mobile uygulamalarda uygulanir."
      }
    ]
  },
  {
    slug: "downloads",
    title: "Downloads",
    items: [
      {
        question: "Indirmeler herkese acik mi?",
        answer:
          "Public sayfada teaser ve bilgi yer alir. Lisansli kurulum paketleri portal erisimi ile gosterilir."
      },
      {
        question: "Kurulum notlarini nerede bulurum?",
        answer:
          "Download sayfasinda release notes, minimum gereksinimler ve aktivasyon adimlari bulunur."
      }
    ]
  },
  {
    slug: "activation",
    title: "Activation",
    items: [
      {
        question: "Aktivasyon icin internet gerekli mi?",
        answer:
          "Ilk aktivasyon ve lisans dogrulamasi icin internet gerekir. Sonrasindaki runtime kurallari istemci politikasina gore devam eder."
      },
      {
        question: "Cihaz limiti nasil kontrol edilir?",
        answer:
          "Portal altindaki Devices sayfasi aktif cihaz sayisini ve plan limitini gosterir."
      }
    ]
  },
  {
    slug: "devices",
    title: "Devices",
    items: [
      {
        question: "Ek cihaz tanimlamak icin ne yapmaliyim?",
        answer:
          "Plan yukseltin veya mevcut cihaz esiklerini portal uzerinden kontrol ederek destek ekibiyle iletisime gecin."
      },
      {
        question: "Web sitesi cihaz aktivasyonu yapar mi?",
        answer:
          "Hayir. Web yalnizca cihaz metadata ve limit bilgisini gosterir; aktivasyon uygulamada yapilir."
      }
    ]
  },
  {
    slug: "billing",
    title: "Billing",
    items: [
      {
        question: "Faturalarimi nereden gorurum?",
        answer:
          "Portal > Billing bolumunde fatura numarasi, tutar, odeme durumu ve tarih bilgileri yer alir."
      },
      {
        question: "Odeme yontemleri nasil gelistirilecek?",
        answer:
          "Phase 1 yapisi mock, Iyzico, PayTR veya Stripe adaptoru ile entegre olacak sekilde kurgulanmistir."
      }
    ]
  },
  {
    slug: "reseller",
    title: "Reseller",
    items: [
      {
        question: "Kimler bayi olabilir?",
        answer:
          "Perakende yazilim saticilari, saha servis ekipleri, cihaz tedarikcileri ve bolgesel cozum ortaklari."
      },
      {
        question: "Bayi basi gelir nasil olusur?",
        answer:
          "Onayli referral kodu ile tamamlanan odemeli abonelikler uzerinden komisyon birikir."
      }
    ]
  },
  {
    slug: "einvoice",
    title: "E-Invoice",
    items: [
      {
        question: "E-fatura modulunu hangi planlar kapsar?",
        answer:
          "Pro ve Enterprise planlari e-fatura onboarding akislarini varsayilan olarak kapsar."
      }
    ]
  },
  {
    slug: "fiscal",
    title: "Fiscal Integration",
    items: [
      {
        question: "Mali cihaz entegrasyonu webde calisir mi?",
        answer:
          "Hayir. Mali cihaz entegrasyonlari yalnizca Desktop veya yetkili mobil istemcide calisir."
      }
    ]
  },
  {
    slug: "support",
    title: "Support",
    items: [
      {
        question: "Destek nasil talep edilir?",
        answer:
          "Portal baglantilari, docs, FAQ ve iletisim formu uzerinden; satis sonrasi onboarding yardimi de mevcuttur."
      }
    ]
  }
];

export const blogPosts: BlogPost[] = [
  {
    slug: "perakende-pos-secim-kriterleri",
    category: "POS best practices",
    title: "Perakende icin POS seciminde bakilmasi gereken 7 ticari kriter",
    excerpt: "Abonelik, lisans, cihaz limiti ve uygulama dagitimi ayni stratejide nasil dusunulur?",
    publishedAt: "2026-03-01",
    readTime: "6 dk",
    heroLabel: "POS best practices",
    sections: [
      {
        heading: "Web sitesi ile operasyon yazilimini ayirmak neden dogru stratejidir?",
        body: [
          "Bir SaaS ticari sitesi ile gunluk operasyon araci ayni urun degildir. Biri guven, donusum ve dagitim icin; digeri hiz, donanim uyumu ve saha verimliligi icin tasarlanir.",
          "Bu ayrim, ziyaretcinin ne satin aldigini ve ekiplerin nerede calisacagini daha ilk dakikada netlestirir."
        ]
      },
      {
        heading: "Lisans, cihaz ve sube limiti birlikte okunmalidir",
        body: [
          "Plan secerken sadece fiyat degil; sube, cihaz ve personel limitlerinin rollout takviminize uyumu da kontrol edilmelidir.",
          "Ozellikle zincir yapilarda ilk yil lisans planlamasi, sonraki operasyonel yigininizi dogrudan etkiler."
        ]
      }
    ]
  },
  {
    slug: "stok-kontrolunde-ilk-30-gun",
    category: "Stock management",
    title: "Yeni bir stok kontrol duzeninde ilk 30 gun planlamasi",
    excerpt: "Stok sayim, kritik esik ve varyant kontrolunu saha ekipleriyle birlikte ele alin.",
    publishedAt: "2026-02-25",
    readTime: "5 dk",
    heroLabel: "Stock management",
    sections: [
      {
        heading: "Ilk hafta: katalog ve cihaz dagitimi",
        body: [
          "Ilk hafta ana hedef, cihaz aktivasyonlari ve temel urun karti duzeninin dogrulanmasidir.",
          "Web portali bu surecte lisans ve indirme merkezi gorevi gorur; sayim ve giris operasyonu uygulamada kalir."
        ]
      },
      {
        heading: "Ikinci hafta: kritik stok esiklerini dogru tanimlayin",
        body: [
          "Kritik esiklerin yanlis tanimlanmasi raporlari anlamsizlastirir. Her kategori icin min stok mantigi net olmali."
        ]
      }
    ]
  },
  {
    slug: "e-fatura-gecis-yol-haritasi",
    category: "E-invoice topics",
    title: "E-fatura gecis yol haritasi: ticari site neyi anlatmali?",
    excerpt: "Mevzuat uyumu, entegrator secimi ve onboarding beklentisi tek sayfada nasil kurulur?",
    publishedAt: "2026-02-19",
    readTime: "4 dk",
    heroLabel: "E-invoice topics",
    sections: [
      {
        heading: "Pazarlama dili ile mevzuat gercegi ayni sayfada bulusmali",
        body: [
          "E-fatura sayfalari hem ticari beklenti yaratmali hem de operasyonun uygulama tarafinda oldugunu netlestirmelidir.",
          "Bu sayede ziyaretci, web sayfasinin canli belge ekranina donusmeyecegini anlayarak karar verir."
        ]
      }
    ]
  },
  {
    slug: "bayi-kanali-ile-saas-buyume",
    category: "Reseller content",
    title: "Bayi kanali ile SaaS buyume: recurring revenue modeli nasil kurulur?",
    excerpt: "Saha partnerleri icin referral kodu, abonelik yenilemesi ve lisans takibi neden kritiktir?",
    publishedAt: "2026-02-12",
    readTime: "7 dk",
    heroLabel: "Reseller content",
    sections: [
      {
        heading: "Bayi yalnizca lead getirmez, rollout hizini da artirir",
        body: [
          "Kurulum ve aktivasyon bilgisine hakim bayiler, satis sonrasi surecin de daha saglikli islemesini saglar.",
          "Bu nedenle bayi sayfasinda egitim, onboarding ve komisyon ayni mesaj catisi altinda sunulmalidir."
        ]
      }
    ]
  },
  {
    slug: "sektore-gore-pos-konumlandirma-marketler",
    category: "Industry-specific landing articles",
    title: "Marketler icin POS konumlandirmasi: hangi mesaj daha cok donusum saglar?",
    excerpt: "Market ve bakkal segmentinde hiz, cihaz uyumu ve lisans netligi nasil anlatilir?",
    publishedAt: "2026-02-05",
    readTime: "4 dk",
    heroLabel: "Industry-specific",
    sections: [
      {
        heading: "Market segmenti hiz ve sadelik ister",
        body: [
          "Bu segmentte karar vericiler, webde kasaya benzer bir demo yerine net teslim modeli gormek ister.",
          "Plan, lisans, indirme ve aktivasyon adimlari ne kadar sade olursa donusum o kadar yukselir."
        ]
      }
    ]
  }
];

export const legalDocuments: LegalDocument[] = [
  {
    slug: "terms",
    title: "Kullanim Kosullari",
    summary: "Abonelik satisi, lisans kapsami ve portal kullanimi ile ilgili genel ticari kosullar.",
    sections: [
      {
        heading: "Hizmet kapsami",
        body: [
          "LoomaPOS web platformu tanitim, fiyatlandirma, abonelik satisi, lisans dagitimi, dokumantasyon ve hesap yonetimi icin sunulur.",
          "Operasyonel POS kullanim yuzeyleri Desktop ve Mobile uygulamalarinda saglanir."
        ]
      },
      {
        heading: "Abonelik ve lisans",
        body: [
          "Satin alma sonrasi olusan lisans anahtari, secilen planin cihaz, sube ve kullanici limitlerini temsil eder.",
          "Yenileme ve faturalama donemi portal uzerinden izlenebilir."
        ]
      }
    ]
  },
  {
    slug: "privacy",
    title: "Gizlilik Politikasi",
    summary: "Musteri, bayi ve ziyaretci verilerinin hangi amaclarla saklandigi ve korundugu.",
    sections: [
      {
        heading: "Toplanan veriler",
        body: [
          "Iletisim bilgileri, sirket bilgileri, lisans ve faturalama metadata kayitlari ticari operasyon amaciyla islenir.",
          "Web katmani canli POS islemi veya urun-satis operasyon verisi tutmaz."
        ]
      },
      {
        heading: "Saklama amaci",
        body: [
          "Veriler; abonelik yonetimi, lisans teslimi, destek, onboardingle ilgili bilgilendirme ve bayi sureci icin kullanilir."
        ]
      }
    ]
  },
  {
    slug: "kvkk",
    title: "KVKK Aydinlatma Metni",
    summary: "6698 sayili kanun kapsaminda veri sorumlusu, isleme amaci ve basvuru haklari.",
    sections: [
      {
        heading: "Veri sorumlusu",
        body: [
          "LoomaPOS, ticari web platformu kapsaminda toplanan kisisel veriler icin veri sorumlusu sifatiyla hareket eder."
        ]
      },
      {
        heading: "Basvuru haklari",
        body: [
          "Ilgili kisiler; erisim, duzeltme, silme ve itiraz haklarini kanuni surecler cercevesinde kullanabilir."
        ]
      }
    ]
  },
  {
    slug: "cookies",
    title: "Cookie Politikasi",
    summary: "Ziyaretci deneyimi, olcumleme ve tercih yonetiminde kullanilan cerez politikasi.",
    sections: [
      {
        heading: "Kullanim amaci",
        body: [
          "Analitik, oturum devamligi ve donusum performansi icin sinirli sayida cerez kullanilir.",
          "Web katmani operasyonel POS eylemleri yuruttugu icin degil, ticari deneyimi iyilestirmek icin cerez kullanir."
        ]
      }
    ]
  }
];

export const portalModules = [
  { href: "/portal", label: "Genel Bakis" },
  { href: "/portal/analytics", label: "Analytics" },
  { href: "/portal/integrations", label: "Integrations" },
  { href: "/portal/subscription", label: "Subscription" },
  { href: "/portal/billing", label: "Billing" },
  { href: "/portal/licenses", label: "Licenses" },
  { href: "/portal/devices", label: "Devices" },
  { href: "/portal/downloads", label: "Downloads" },
  { href: "/portal/company", label: "Company" },
  { href: "/portal/users", label: "Users" },
  { href: "/portal/security", label: "Security" },
  { href: "/portal/support", label: "Support" },
  { href: "/portal/onboarding", label: "Onboarding" }
] as const;

export const resellerPortalModules = [
  { href: "/reseller/portal", label: "Genel Bakis" },
  { href: "/reseller/portal/analytics", label: "Analytics" },
  { href: "/reseller/portal/customers", label: "Customers" },
  { href: "/reseller/portal/referrals", label: "Referrals" },
  { href: "/reseller/portal/commissions", label: "Commissions" },
  { href: "/reseller/portal/payouts", label: "Payouts" },
  { href: "/reseller/portal/licenses", label: "Licenses" },
  { href: "/reseller/portal/assets", label: "Assets" },
  { href: "/reseller/portal/support", label: "Support" },
  { href: "/reseller/portal/settings", label: "Settings" }
] as const;

export const adminModules = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/licenses", label: "Licenses" },
  { href: "/admin/devices", label: "Devices" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/resellers", label: "Resellers" },
  { href: "/admin/support/cases", label: "Support" },
  { href: "/admin/sync", label: "Sync" },
  { href: "/admin/queues", label: "Queues" },
  { href: "/admin/dead-letter", label: "Dead Letter" },
  { href: "/admin/integrations", label: "Integrations" },
  { href: "/admin/deployments", label: "Deployments" },
  { href: "/admin/backups", label: "Backups" },
  { href: "/admin/incidents", label: "Incidents" },
  { href: "/admin/runbooks", label: "Runbooks" },
  { href: "/admin/slo", label: "SLOs" },
  { href: "/admin/releases", label: "Releases" },
  { href: "/admin/feature-flags", label: "Feature Flags" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/notices", label: "Notices" },
  { href: "/admin/security", label: "Security" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/settings", label: "Settings" }
] as const;

export const routeTree = [
  "/",
  "/features",
  "/features/sales",
  "/features/inventory",
  "/features/reporting",
  "/features/staff",
  "/features/branches",
  "/features/collections",
  "/features/variants",
  "/features/einvoice",
  "/features/fiscal",
  "/features/dashboard",
  "/pricing",
  "/download",
  "/reseller",
  "/reseller/apply",
  "/reseller/login",
  "/reseller/portal",
  "/reseller/portal/analytics",
  "/reseller/portal/overview",
  "/reseller/portal/customers",
  "/reseller/portal/referrals",
  "/reseller/portal/commissions",
  "/reseller/portal/payouts",
  "/reseller/portal/licenses",
  "/reseller/portal/assets",
  "/reseller/portal/support",
  "/reseller/portal/settings",
  "/docs",
  "/faq",
  "/blog",
  "/blog/[slug]",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/checkout",
  "/success",
  "/portal",
  "/portal/analytics",
  "/portal/integrations",
  "/portal/licenses",
  "/portal/subscription",
  "/portal/downloads",
  "/portal/billing",
  "/portal/devices",
  "/portal/company",
  "/portal/users",
  "/portal/security",
  "/portal/support",
  "/portal/onboarding",
  "/admin",
  "/admin/login",
  "/admin/overview",
  "/admin/analytics",
  "/admin/tenants",
  "/admin/tenants/[tenantId]",
  "/admin/subscriptions",
  "/admin/licenses",
  "/admin/devices",
  "/admin/payments",
  "/admin/invoices",
  "/admin/resellers",
  "/admin/resellers/[resellerId]",
  "/admin/support",
  "/admin/support/cases",
  "/admin/support/cases/[caseId]",
  "/admin/sync",
  "/admin/queues",
  "/admin/dead-letter",
  "/admin/integrations",
  "/admin/deployments",
  "/admin/backups",
  "/admin/incidents",
  "/admin/runbooks",
  "/admin/slo",
  "/admin/releases",
  "/admin/feature-flags",
  "/admin/coupons",
  "/admin/campaigns",
  "/admin/notices",
  "/admin/security",
  "/admin/audit",
  "/admin/settings",
  "/contact",
  "/about",
  "/legal/terms",
  "/legal/privacy",
  "/legal/kvkk",
  "/legal/cookies"
] as const;

export const schemaModelSummaries = [
  {
    name: "customers",
    fields: [
      "id",
      "tenant_id",
      "full_name",
      "company_name",
      "email",
      "phone",
      "status",
      "created_at"
    ]
  },
  {
    name: "subscriptions",
    fields: [
      "id",
      "tenant_id",
      "plan_code",
      "billing_cycle",
      "status",
      "current_period_start",
      "current_period_end",
      "reseller_code"
    ]
  },
  {
    name: "licenses",
    fields: [
      "id",
      "tenant_id",
      "subscription_id",
      "license_key",
      "plan_code",
      "issued_at",
      "expires_at",
      "status",
      "device_limit",
      "feature_flags"
    ]
  },
  {
    name: "billing_records",
    fields: [
      "id",
      "tenant_id",
      "subscription_id",
      "invoice_no",
      "provider",
      "payment_method",
      "amount",
      "currency",
      "status",
      "issued_at",
      "paid_at"
    ]
  },
  {
    name: "reseller_leads",
    fields: [
      "id",
      "full_name",
      "company_name",
      "city",
      "phone",
      "email",
      "website_or_social_proof",
      "experience",
      "message",
      "status",
      "referral_code",
      "created_at"
    ]
  }
] as const;

export const acceptanceChecklist = [
  "Ziyaretci urunu webde ticari olarak anlayabiliyor.",
  "Aylik ve yillik planlar karsilastirilabiliyor.",
  "Checkout sonrasi lisans anahtari ve portal erisimi olusuyor.",
  "Desktop ve Mobile indirme merkezine ulasilabiliyor.",
  "Bayi adayi form doldurup basvuru birakabiliyor.",
  "Musteri portalinda abonelik, lisans, indirme, billing ve device metadata yonetilebiliyor.",
  "Web katmaninda kasa, stok, sube veya canli POS operasyonu bulunmuyor."
] as const;

export function getFeatureBySlug(slug: string) {
  return featureModules.find((item) => item.slug === slug);
}

export function getBlogBySlug(slug: string) {
  return blogPosts.find((item) => item.slug === slug);
}

export function getLegalBySlug(slug: string) {
  return legalDocuments.find((item) => item.slug === slug);
}

export function getPlanByCode(code: string) {
  return pricingPlans.find((plan) => plan.code === code) ?? pricingPlans[1];
}

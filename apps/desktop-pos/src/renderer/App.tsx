import { FormEvent, useEffect, useMemo, useState } from "react";
import type { DesktopOnboardingState } from "./global";
import { PosWorkspace } from "./PosWorkspace";
import { useDesktopShellStore } from "./stores/desktop-shell-store";

const fmtDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("tr-TR", { hour12: false }) : "-";

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("tr-TR") : "-";

const mapShellError = (error: unknown, fallback: string) => {
  const raw = error instanceof Error ? error.message.trim() : "";
  const normalized = raw.toLowerCase();

  if (!raw) {
    return fallback;
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("econnrefused") ||
    normalized.includes("api 502") ||
    normalized.includes("api 503") ||
    normalized.includes("api 504")
  ) {
    return "Sunucuya baglanilamadi. Ag baglantisini ve API servisinin ayakta oldugunu kontrol edin.";
  }

  if (normalized.includes("api 500")) {
    return "Sunucu tarafinda beklenmeyen bir hata olustu. Biraz sonra tekrar deneyin.";
  }

  if (normalized.includes("api 401")) {
    return "E-posta veya sifre hatali. Bilgileri kontrol edip tekrar deneyin.";
  }

  if (normalized.includes("already activated") || normalized.includes("already registered")) {
    return "Bu cihaz daha once aktive edilmis. Devam etmek icin mevcut aktivasyon bilgilerini kullanin.";
  }

  if (normalized.includes("api 409")) {
    return "Aktivasyon istegi cakisiyor. Cihaz zaten aktif olabilir veya ayni islem daha once tamamlanmis olabilir.";
  }

  if (normalized.includes("device limit reached")) {
    return "Bu lisans icin cihaz limiti dolu. Yeni aktivasyon icin lisans limitini guncelleyin.";
  }

  if (
    normalized.includes("license is not active") ||
    normalized.includes("license invalid") ||
    normalized.includes("invalid license")
  ) {
    return "Lisans aktif veya gecerli olmadigi icin aktivasyon tamamlanamadi.";
  }

  if (
    normalized.includes("device activation blocked by subscription lifecycle") ||
    (normalized.includes("api 403") && normalized.includes("lifecycle"))
  ) {
    return "Abonelik durumu nedeniyle cihaz aktivasyonu su anda engelleniyor. Web portal /portal/subscription adimindan plan/lisans durumunu kontrol edin.";
  }

  if (normalized.includes("giris yapin") || normalized.includes("oturum")) {
    return "Oturum suresi doldu veya gecersiz. Lutfen tekrar giris yapin.";
  }

  if (normalized.startsWith("api")) {
    return `${fallback} (${raw})`;
  }

  return raw;
};

export function App() {
  const {
    bootstrap,
    activationContext,
    shellError,
    isBootstrapping,
    isSubmittingAuth,
    isLoadingActivation,
    isActivating,
    isSettingsOpen,
    isSavingSettings,
    authEmail,
    authPassword,
    branchName,
    branchCode,
    deviceName,
    settingsDraft,
    setShellError,
    setIsBootstrapping,
    setIsSubmittingAuth,
    setIsLoadingActivation,
    setIsActivating,
    setIsSettingsOpen,
    setIsSavingSettings,
    setAuthEmail,
    setAuthPassword,
    setBranchName,
    setBranchCode,
    setDeviceName,
    setSettingsDraft,
    hydrateFromBootstrap,
    setActivationContext,
    seedActivationForm
  } = useDesktopShellStore();

  const [onboarding, setOnboarding] = useState<DesktopOnboardingState | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [guidedSaleMode, setGuidedSaleMode] = useState(false);
  const [guidedSaleDone, setGuidedSaleDone] = useState(false);

  useEffect(() => {
    void refreshBootstrap();
  }, []);

  async function refreshBootstrap() {
    setIsBootstrapping(true);
    setShellError(null);
    try {
      const next = await window.posApi.getBootstrap();
      hydrateFromBootstrap(next);
      if (next.stage === "activation_required" && next.session) {
        await loadActivationContext(next);
      }

      if (next.stage === "ready") {
        await loadOnboardingState();
      } else {
        setOnboarding(null);
        setGuidedSaleMode(false);
        setGuidedSaleDone(false);
        setOnboardingStep(1);
      }
    } catch (error) {
      setShellError(mapShellError(error, "Desktop durumu yuklenemedi."));
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function loadOnboardingState() {
    try {
      const next = await window.posApi.getOnboardingState();
      setOnboarding(next);
      if (!next.required) {
        setGuidedSaleMode(false);
        setGuidedSaleDone(false);
        setOnboardingStep(4);
        return;
      }

      if (next.firstSaleDone) {
        setOnboardingStep(4);
        return;
      }

      if (next.demoProductCount > 0) {
        setOnboardingStep((current) => (current < 3 ? 3 : current));
      }
    } catch (error) {
      setShellError(mapShellError(error, "Onboarding durumu yuklenemedi."));
    }
  }

  async function loadActivationContext(nextBootstrap = bootstrap) {
    if (!nextBootstrap?.session) {
      return;
    }

    setIsLoadingActivation(true);
    setShellError(null);
    try {
      const context = await window.posApi.getActivationContext();
      seedActivationForm(context);
    } catch (error) {
      const message = mapShellError(error, "Aktivasyon bilgisi yuklenemedi.");
      if (message.toLowerCase().includes("giris yapin")) {
        setActivationContext(null);
        await refreshBootstrap();
        return;
      }
      setShellError(message);
    } finally {
      setIsLoadingActivation(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingAuth(true);
    setShellError(null);
    try {
      const next = await window.posApi.login({
        email: authEmail,
        password: authPassword
      });
      hydrateFromBootstrap(next);
      setAuthPassword("");
      if (next.stage === "activation_required") {
        await loadActivationContext(next);
      }
      if (next.stage === "ready") {
        await loadOnboardingState();
      }
    } catch (error) {
      setShellError(mapShellError(error, "Giris basarisiz."));
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsActivating(true);
    setShellError(null);
    try {
      const next = await window.posApi.activateDesktop({
        branchName,
        branchCode: branchCode.trim() || null,
        deviceName
      });
      hydrateFromBootstrap(next);
      setActivationContext(null);
      if (next.stage === "ready") {
        await loadOnboardingState();
      }
    } catch (error) {
      setShellError(mapShellError(error, "Aktivasyon basarisiz."));
    } finally {
      setIsActivating(false);
    }
  }

  async function handleLogout() {
    setShellError(null);
    const next = await window.posApi.logout();
    hydrateFromBootstrap(next);
    setActivationContext(null);
    setAuthPassword("");
  }

  async function handleOpenRegister() {
    setShellError(null);
    try {
      await window.posApi.openRegister();
    } catch (error) {
      setShellError(mapShellError(error, "Kayit sayfasi acilamadi."));
    }
  }

  async function openSettings() {
    const settings = await window.posApi.getDesktopSettings();
    setSettingsDraft({
      deviceName: settings.deviceName,
      printerName: settings.printerName ?? ""
    });
    setIsSettingsOpen(true);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSettings(true);
    setShellError(null);
    try {
      await window.posApi.updateDesktopSettings({
        deviceName: settingsDraft.deviceName,
        printerName: settingsDraft.printerName
      });
      setIsSettingsOpen(false);
      await refreshBootstrap();
    } catch (error) {
      setShellError(mapShellError(error, "Ayarlar kaydedilemedi."));
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function resetActivation() {
    setShellError(null);
    const next = await window.posApi.clearActivation();
    hydrateFromBootstrap(next);
    setActivationContext(null);
  }

  const onboardingStepTitle = useMemo(() => {
    if (onboardingStep === 1) {
      return "Adim 1/4 - Hos Geldiniz";
    }
    if (onboardingStep === 2) {
      return "Adim 2/4 - Demo Veri";
    }
    if (onboardingStep === 3) {
      return "Adim 3/4 - Ilk Test Satisi";
    }
    return "Adim 4/4 - Tamam";
  }, [onboardingStep]);

  async function seedDemoData() {
    setIsSeedingDemo(true);
    setShellError(null);
    try {
      const next = await window.posApi.seedOnboardingDemoData();
      setOnboarding(next);
      setOnboardingStep(3);
    } catch (error) {
      setShellError(mapShellError(error, "Demo veri yuklenemedi."));
    } finally {
      setIsSeedingDemo(false);
    }
  }

  function startGuidedSale() {
    setGuidedSaleDone(false);
    setGuidedSaleMode(true);
  }

  async function handleGuidedSaleCompleted() {
    setGuidedSaleDone(true);
    setGuidedSaleMode(false);
    await loadOnboardingState();
    setOnboardingStep(4);
  }

  async function finalizeOnboarding() {
    setIsCompletingOnboarding(true);
    setShellError(null);
    try {
      const next = await window.posApi.completeOnboarding();
      setOnboarding(next);
      await refreshBootstrap();
    } catch (error) {
      setShellError(mapShellError(error, "Onboarding tamamlanamadi."));
    } finally {
      setIsCompletingOnboarding(false);
    }
  }

  if (isBootstrapping || !bootstrap) {
    return (
      <div className="desktop-shell-screen items-center justify-center">
        <div className="desktop-shell-card max-w-xl">
          <span className="eyebrow">LOOMAPOS DESKTOP</span>
          <h1 className="mt-3 text-balance text-3xl font-bold text-slate-950">Masaustu POS hazirlaniyor</h1>
          <p className="mt-3 text-base text-slate-600">
            Lokal veritabani, aktivasyon ve oturum durumu kontrol ediliyor.
          </p>
        </div>
      </div>
    );
  }

  if (bootstrap.stage === "ready") {
    const onboardingRequired = onboarding?.required === true;
    const canFinishOnboarding = onboarding?.firstSaleDone === true || guidedSaleDone;

    const settingsModal = isSettingsOpen ? (
      <div className="shell-modal-overlay" role="presentation">
        <div className="shell-modal-card" role="dialog" aria-modal="true">
          <h2 className="text-2xl font-semibold text-slate-950">Cihaz Ayarlari</h2>
          <form className="shell-form mt-5" onSubmit={(event) => void saveSettings(event)}>
            <label>
              Cihaz adi
              <input
                value={settingsDraft.deviceName}
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    deviceName: event.target.value
                  }))
                }
                required
              />
            </label>
            <label>
              Yazici secimi
              <input
                value={settingsDraft.printerName}
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    printerName: event.target.value
                  }))
                }
                placeholder="ESC/POS printer placeholder"
              />
            </label>
            <div className="shell-metrics md:grid-cols-2">
              <div>
                <span>Versiyon</span>
                <strong>{bootstrap.settings.version}</strong>
              </div>
              <div>
                <span>Sube</span>
                <strong>{bootstrap.activation?.branchName ?? "-"}</strong>
              </div>
              <div>
                <span>Lisans</span>
                <strong>{bootstrap.license.status}</strong>
              </div>
              <div>
                <span>Senkron</span>
                <strong>
                  Bekleyen {bootstrap.sync.pending} / Hatali {bootstrap.sync.failed}
                </strong>
              </div>
            </div>
            <div className="shell-modal-actions mt-2">
              <button className="btn-secondary" type="button" onClick={() => setIsSettingsOpen(false)}>
                Kapat
              </button>
              <button className="btn-primary" type="submit" disabled={isSavingSettings}>
                {isSavingSettings ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null;

    if (onboardingRequired && guidedSaleMode) {
      return (
        <>
          <PosWorkspace
            onOpenSettings={openSettings}
            onLogout={handleLogout}
            onboardingHint="Onboarding test satisi: demo urun ekleyip gercek checkout ile satisi tamamlayin."
            onSaleCompleted={() => void handleGuidedSaleCompleted()}
          />
          {settingsModal}
        </>
      );
    }

    return (
      <>
        {onboardingRequired ? (
          <div className="desktop-shell-screen">
            <div className="desktop-shell-card max-w-2xl">
              <span className="eyebrow">ILK KURULUM</span>
              <h1 className="mt-4 text-3xl font-bold text-slate-950">{onboardingStepTitle}</h1>

              {shellError ? <div className="shell-banner danger mt-4">{shellError}</div> : null}

              {onboardingStep === 1 ? (
                <div className="shell-note-list mt-5">
                  <p>Masaustu POS, satis operasyonunun gercek calistigi ana yuzeydir.</p>
                  <p>Birkac adimda demo urunleri yukleyip ilk test satisinizi gercek checkout ile tamamlayacagiz.</p>
                  <button className="btn-primary" onClick={() => setOnboardingStep(2)}>Devam et</button>
                </div>
              ) : null}

              {onboardingStep === 2 ? (
                <div className="shell-note-list mt-5">
                  <p>Demo veri, urun arama/barkod/sepet/satis akisini hemen denemeniz icin lokal veritabanina yazilir.</p>
                  <p>Mevcut demo urun sayisi: <strong>{onboarding?.demoProductCount ?? 0}</strong></p>
                  <div className="shell-modal-actions mt-2">
                    <button className="btn-secondary" onClick={() => setOnboardingStep(1)}>Geri</button>
                    <button className="btn-primary" onClick={() => void seedDemoData()} disabled={isSeedingDemo}>
                      {isSeedingDemo ? "Yukleniyor..." : "Demo veriyi yukle"}
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => setOnboardingStep(3)}
                      disabled={(onboarding?.demoProductCount ?? 0) === 0}
                    >
                      Sonraki adim
                    </button>
                  </div>
                </div>
              ) : null}

              {onboardingStep === 3 ? (
                <div className="shell-note-list mt-5">
                  <p>Siradaki adimda gercek POS ekrani acilacak.</p>
                  <p>En az bir demo urun ekleyip odemeyi tamamlayin. Satis olusunca onboarding otomatik ilerler.</p>
                  <div className="shell-modal-actions mt-2">
                    <button className="btn-secondary" onClick={() => setOnboardingStep(2)}>Geri</button>
                    <button className="btn-primary" onClick={startGuidedSale}>Test satis ekranini ac</button>
                  </div>
                </div>
              ) : null}

              {onboardingStep === 4 ? (
                <div className="shell-note-list mt-5">
                  <p>Harika, ilk test satisiniz tamamlandi.</p>
                  <p>Onboarding bitirildiginde bir sonraki acilista dogrudan POS calisma alanina girilecektir.</p>
                  <button className="btn-primary" onClick={() => void finalizeOnboarding()} disabled={!canFinishOnboarding || isCompletingOnboarding}>
                    {isCompletingOnboarding ? "Tamamlaniyor..." : "Onboardingi bitir ve POS'a gec"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <PosWorkspace onOpenSettings={openSettings} onLogout={handleLogout} />
        )}

        {settingsModal}
      </>
    );
  }

  const showActivation = bootstrap.stage === "activation_required" && Boolean(bootstrap.session);

  return (
    <div className="desktop-shell-screen">
      <div className="desktop-shell-card wide max-w-6xl">
        <div className="shell-topline">
          <span className="eyebrow">LOOMAPOS DESKTOP</span>
          <button className="btn-secondary btn-small" onClick={() => void refreshBootstrap()}>
            Yenile
          </button>
        </div>

        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-slate-950">
          {bootstrap.stage === "login_required"
            ? "Oturum gerekli"
            : bootstrap.stage === "locked"
              ? "Cihaz kilitli"
              : "Masaustu aktivasyonu"}
        </h1>

        <p className="shell-lead mt-3 max-w-3xl">
          Web sitesi sadece ticari merkez olarak kalir. Gercek operasyon burada, lokal veritabani ve offline-first
          akista yurur.
        </p>

        <div className="shell-status-grid mt-6">
          <div className="shell-status-card">
            <span>Baglanti</span>
            <strong>{bootstrap.online ? "Online" : "Offline"}</strong>
          </div>
          <div className="shell-status-card">
            <span>Lisans</span>
            <strong>{bootstrap.license.status}</strong>
          </div>
          <div className="shell-status-card">
            <span>Cihaz</span>
            <strong>{bootstrap.settings.deviceName}</strong>
          </div>
          <div className="shell-status-card">
            <span>Son dogrulama</span>
            <strong>{fmtDateTime(bootstrap.license.lastCheckedAt)}</strong>
          </div>
        </div>

        {bootstrap.message ? <div className="shell-banner warn mt-4">{bootstrap.message}</div> : null}
        {shellError ? <div className="shell-banner danger mt-4">{shellError}</div> : null}

        <div className="shell-columns mt-6">
          <section className="shell-panel">
            <h2 className="text-2xl font-semibold text-slate-950">{showActivation ? "Aktivasyon" : "Giris"}</h2>

            {!bootstrap.session ? (
              <form className="shell-form mt-5" onSubmit={(event) => void handleLogin(event)}>
                <label>
                  E-posta
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  Sifre
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <button className="btn-primary" type="submit" disabled={isSubmittingAuth}>
                  {isSubmittingAuth ? "Giris yapiliyor..." : "Giris Yap"}
                </button>
                <div className="shell-note-list mt-4">
                  <p>Hesabiniz yoksa kayit islemini portal uzerinden tamamlayabilirsiniz.</p>
                  <button className="btn-secondary" type="button" onClick={() => void handleOpenRegister()}>
                    Kayit ol
                  </button>
                </div>
              </form>
            ) : null}

            {showActivation ? (
              <form className="shell-form mt-5" onSubmit={(event) => void handleActivate(event)}>
                <label>
                  Sube adi
                  <input
                    value={branchName}
                    onChange={(event) => setBranchName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Sube kodu
                  <input
                    value={branchCode}
                    onChange={(event) => setBranchCode(event.target.value)}
                    placeholder="OPS-MRKZ"
                  />
                </label>
                <label>
                  Cihaz adi
                  <input
                    value={deviceName}
                    onChange={(event) => setDeviceName(event.target.value)}
                    required
                  />
                </label>
                <button className="btn-primary" type="submit" disabled={isActivating || isLoadingActivation}>
                  {isActivating ? "Aktive ediliyor..." : "Cihazi Aktive Et"}
                </button>
              </form>
            ) : null}

            {bootstrap.stage === "locked" ? (
              <div className="shell-action-stack mt-5">
                <button className="btn-secondary" onClick={() => void handleLogout()}>
                  Tekrar giris yap
                </button>
                <button className="btn-danger" onClick={() => void resetActivation()}>
                  Aktivasyonu temizle
                </button>
              </div>
            ) : null}
          </section>

          <section className="shell-panel">
            <h2 className="text-2xl font-semibold text-slate-950">Hazirlik Ozeti</h2>
            <div className="shell-metrics mt-5 md:grid-cols-2">
              <div>
                <span>Sirket</span>
                <strong>{activationContext?.companyName ?? bootstrap.session?.companyName ?? "-"}</strong>
              </div>
              <div>
                <span>Kullanici</span>
                <strong>{bootstrap.session?.displayName ?? "-"}</strong>
              </div>
              <div>
                <span>Plan</span>
                <strong>{activationContext?.planCode?.toUpperCase() ?? bootstrap.activation?.planCode ?? "-"}</strong>
              </div>
              <div>
                <span>Lisans anahtari</span>
                <strong>{activationContext?.licenseKey ?? bootstrap.activation?.licenseKey ?? "-"}</strong>
              </div>
              <div>
                <span>Lisans bitisi</span>
                <strong>{fmtDate(activationContext?.expiresAt ?? bootstrap.activation?.expiresAt)}</strong>
              </div>
              <div>
                <span>Offline grace</span>
                <strong>{activationContext?.graceDays ?? bootstrap.activation?.graceDays ?? "-"} gun</strong>
              </div>
            </div>

            <div className="shell-note-list mt-5">
              <p>
                Aktivasyon tamamlandiktan sonra cihaz, tenant ve lisans snapshot bilgileri lokal SQLite veritabanina
                yazilir.
              </p>
              <p>
                Satis akisi cloud onayi beklemez; lokal kayit, receipt ve outbox olayi ayni transaction icinde
                olusturulur.
              </p>
              <p>
                Baglanti kopsa bile daha once aktive edilmis cihaz, offline grace ve lokal oturum politikasi icinde
                calismaya devam eder.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

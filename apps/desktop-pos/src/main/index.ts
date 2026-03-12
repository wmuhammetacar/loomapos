import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import { registerDesktopShellIpc } from "./ipc/desktop-shell-ipc.js";
import { registerPosIpc } from "./ipc/pos-ipc.js";
import { getDesktopBootstrapState, getDesktopRuntimeContext } from "./desktop/desktop-shell-service.js";
import { getSyncStatus, startSyncWorker } from "./sync/sync-worker.js";
import { initializeLocalDatabase } from "./storage/local-db.js";
import { getOperationalSessionSummary } from "./operations/operations-service.js";

let mainWindow: BrowserWindow | null = null;
let customerWindow: BrowserWindow | null = null;

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true
    }
  });

  const devUrl = process.env.LOOMAPOS_DESKTOP_DEV_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

const ensureCustomerWindow = () => {
  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.focus();
    return customerWindow;
  }

  customerWindow = new BrowserWindow({
    width: 720,
    height: 420,
    title: "Musteri Ekrani",
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  customerWindow.loadURL(
    toDataUrl(
      buildCustomerHtml({
        state: "ACTIVE",
        lines: [],
        total: 0
      })
    )
  );
  customerWindow.on("closed", () => {
    customerWindow = null;
  });

  return customerWindow;
};

const registerDesktopIpc = () => {
  ipcMain.handle("pos:customer-display-open", () => {
    ensureCustomerWindow();
    return { ok: true };
  });

  ipcMain.handle("pos:customer-display-update", (_event, args: CustomerDisplayPayload) => {
    const targetWindow = ensureCustomerWindow();
    targetWindow.loadURL(toDataUrl(buildCustomerHtml(args)));
    return { ok: true };
  });

  ipcMain.handle("pos:get-app-info", async () => {
    const bootstrap = await getDesktopBootstrapState(app.getVersion());
    return {
      ...(() => {
      try {
        const context = getDesktopRuntimeContext(app.getVersion());
        return {
          tenantId: context.tenantId,
          branchId: context.branchId,
          deviceId: context.deviceId,
          branchName: context.branchName,
          deviceName: context.deviceName,
          cashierName: context.cashierName,
          cashierRole: context.cashierRole,
          canManageCatalog: context.canManageCatalog,
          shift: getOperationalSessionSummary(context.tenantId, context.branchId, context.deviceId)
        };
      } catch {
        return {
          tenantId: "pending",
          branchId: "pending",
          deviceId: "pending",
          branchName: "Kurulum Bekliyor",
          deviceName: "Kurulum Bekliyor",
          cashierName: "Oturum Bekliyor",
          cashierRole: "cashier_limited",
          canManageCatalog: false,
          shift: null
        };
      }
      })(),
      sync: getSyncStatus(),
      license: bootstrap.license
    };
  });

  ipcMain.handle("pos:get-license-status", async () => {
    const bootstrap = await getDesktopBootstrapState(app.getVersion());
    return bootstrap.license;
  });
};

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath("userData"), "loomapos-local.db");
  initializeLocalDatabase(dbPath);

  registerDesktopShellIpc(app.getVersion());
  registerPosIpc({
    getContext: () => getDesktopRuntimeContext(app.getVersion())
  });
  registerDesktopIpc();
  startSyncWorker();
  initializeAutoUpdater();

  await createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

const initializeAutoUpdater = () => {
  if (process.env.LOOMAPOS_DISABLE_AUTOUPDATE === "true") {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.on("update-available", () => {
    autoUpdater.downloadUpdate().catch(() => {
      // updater should not block sales flow
    });
  });
  autoUpdater.on("error", () => {
    // updater should not block sales flow
  });

  autoUpdater.checkForUpdates().catch(() => {
    // updater should not block sales flow
  });
};

const toDataUrl = (html: string) => `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;

interface CustomerDisplayPayload {
  state?: "ACTIVE" | "THANK_YOU";
  lines: Array<{
    name: string;
    qty: number;
    lineTotal: number;
  }>;
  total: number;
}

const buildCustomerHtml = (payload: CustomerDisplayPayload) => {
  const state = payload.state ?? "ACTIVE";
  const safeLines = payload.lines.slice(0, 8);
  const lineHtml = safeLines
    .map(
      (line) =>
        `<li><span>${escapeHtml(line.name)} x${line.qty.toFixed(3)}</span><strong>${line.lineTotal.toFixed(2)} TL</strong></li>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Musteri Ekrani</title>
    <style>
      :root {
        --bg: #f8fafc;
        --text: #0f172a;
        --accent: #2563eb;
      }
      body {
        margin: 0;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.16), transparent 45%),
          radial-gradient(circle at 80% 80%, rgba(22, 163, 74, 0.14), transparent 40%),
          var(--bg);
      }
      .wrap {
        min-height: 100vh;
        padding: 24px;
        display: flex;
        flex-direction: column;
      }
      .logo {
        margin: 0;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        font-size: 30px;
        font-weight: 700;
      }
      .welcome {
        margin-top: 4px;
        font-size: 18px;
        opacity: 0.8;
      }
      .total {
        margin-top: auto;
        font-size: 78px;
        font-weight: 700;
        color: var(--accent);
        text-align: right;
      }
      .total-label {
        margin-top: auto;
        text-align: right;
        font-size: 20px;
        letter-spacing: 0.08em;
      }
      .lines {
        margin: 20px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 8px;
      }
      .lines li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 10px;
        font-size: 20px;
      }
      .thanks {
        margin: auto 0;
        font-size: 64px;
        font-weight: 800;
        text-align: center;
        color: var(--accent);
        animation: pop 240ms ease-out;
      }
      @keyframes pop {
        from { transform: scale(0.96); opacity: 0.4; }
        to { transform: scale(1); opacity: 1; }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section>
        <h1 class="logo">LoomaPOS</h1>
        <p class="welcome">HOS GELDINIZ</p>
      </section>
      ${
        state === "THANK_YOU"
          ? `<div class="thanks">TESEKKURLER</div>`
          : `
        <ul class="lines">${lineHtml || "<li><span>Sepet bos</span><strong>0.00 TL</strong></li>"}</ul>
        <p class="total-label">TOPLAM</p>
      `
      }
      <div class="total">${payload.total.toFixed(2)} TL</div>
    </main>
  </body>
</html>
`;
};

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");

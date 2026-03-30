import { ipcMain } from "electron";
import {
  activateDesktopDevice,
  clearDesktopActivation,
  getDesktopActivationContext,
  getDesktopBootstrapState,
  getDesktopSettings,
  loginDesktopUser,
  logoutDesktopUser,
  updateDesktopSettings,
  getDesktopOnboardingState,
  seedDesktopOnboardingDemo,
  completeDesktopOnboarding
} from "../desktop/desktop-shell-service.js";

export const registerDesktopShellIpc = (appVersion: string) => {
  ipcMain.handle("desktop:get-bootstrap", () => getDesktopBootstrapState(appVersion));

  ipcMain.handle(
    "desktop:login",
    (_event, args: { email?: string; password?: string }) =>
      loginDesktopUser(appVersion, {
        email: args?.email ?? "",
        password: args?.password ?? ""
      })
  );

  ipcMain.handle("desktop:logout", () => logoutDesktopUser(appVersion));

  ipcMain.handle("desktop:get-activation-context", () => getDesktopActivationContext(appVersion));

  ipcMain.handle(
    "desktop:activate",
    (_event, args: { branchName?: string; branchCode?: string | null; deviceName?: string }) =>
      activateDesktopDevice(appVersion, {
        branchName: args?.branchName ?? "",
        branchCode: args?.branchCode ?? null,
        deviceName: args?.deviceName ?? ""
      })
  );

  ipcMain.handle("desktop:clear-activation", () => clearDesktopActivation(appVersion));

  ipcMain.handle("desktop:get-settings", () => getDesktopSettings(appVersion));

  ipcMain.handle(
    "desktop:update-settings",
    (_event, args: { deviceName?: string; printerName?: string | null }) =>
      updateDesktopSettings(appVersion, args ?? {})
  );

  ipcMain.handle("desktop:get-onboarding-state", () => getDesktopOnboardingState(appVersion));

  ipcMain.handle("desktop:seed-onboarding-demo", () => seedDesktopOnboardingDemo(appVersion));

  ipcMain.handle("desktop:complete-onboarding", () => completeDesktopOnboarding(appVersion));
};

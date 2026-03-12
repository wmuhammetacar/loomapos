import { create } from "zustand";
import type {
  DesktopActivationContext,
  DesktopBootstrapState,
  DesktopSettingsSnapshot
} from "../global";

interface SettingsDraft {
  deviceName: string;
  printerName: string;
}

interface DesktopShellState {
  bootstrap: DesktopBootstrapState | null;
  activationContext: DesktopActivationContext | null;
  shellError: string | null;
  isBootstrapping: boolean;
  isSubmittingAuth: boolean;
  isLoadingActivation: boolean;
  isActivating: boolean;
  isSettingsOpen: boolean;
  isSavingSettings: boolean;
  authEmail: string;
  authPassword: string;
  branchName: string;
  branchCode: string;
  deviceName: string;
  settingsDraft: SettingsDraft;
  setBootstrap: (bootstrap: DesktopBootstrapState | null) => void;
  setActivationContext: (context: DesktopActivationContext | null) => void;
  setShellError: (message: string | null) => void;
  setIsBootstrapping: (value: boolean) => void;
  setIsSubmittingAuth: (value: boolean) => void;
  setIsLoadingActivation: (value: boolean) => void;
  setIsActivating: (value: boolean) => void;
  setIsSettingsOpen: (value: boolean) => void;
  setIsSavingSettings: (value: boolean) => void;
  setAuthEmail: (value: string) => void;
  setAuthPassword: (value: string) => void;
  setBranchName: (value: string) => void;
  setBranchCode: (value: string) => void;
  setDeviceName: (value: string) => void;
  setSettingsDraft: (next: SettingsDraft | ((current: SettingsDraft) => SettingsDraft)) => void;
  hydrateFromBootstrap: (bootstrap: DesktopBootstrapState) => void;
  seedActivationForm: (context: DesktopActivationContext) => void;
}

const defaultSettingsDraft = (): SettingsDraft => ({
  deviceName: "",
  printerName: ""
});

export const useDesktopShellStore = create<DesktopShellState>((set) => ({
  bootstrap: null,
  activationContext: null,
  shellError: null,
  isBootstrapping: true,
  isSubmittingAuth: false,
  isLoadingActivation: false,
  isActivating: false,
  isSettingsOpen: false,
  isSavingSettings: false,
  authEmail: "",
  authPassword: "",
  branchName: "",
  branchCode: "",
  deviceName: "",
  settingsDraft: defaultSettingsDraft(),
  setBootstrap: (bootstrap) => set({ bootstrap }),
  setActivationContext: (activationContext) => set({ activationContext }),
  setShellError: (shellError) => set({ shellError }),
  setIsBootstrapping: (isBootstrapping) => set({ isBootstrapping }),
  setIsSubmittingAuth: (isSubmittingAuth) => set({ isSubmittingAuth }),
  setIsLoadingActivation: (isLoadingActivation) => set({ isLoadingActivation }),
  setIsActivating: (isActivating) => set({ isActivating }),
  setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  setIsSavingSettings: (isSavingSettings) => set({ isSavingSettings }),
  setAuthEmail: (authEmail) => set({ authEmail }),
  setAuthPassword: (authPassword) => set({ authPassword }),
  setBranchName: (branchName) => set({ branchName }),
  setBranchCode: (branchCode) => set({ branchCode }),
  setDeviceName: (deviceName) => set({ deviceName }),
  setSettingsDraft: (next) =>
    set((state) => ({
      settingsDraft: typeof next === "function" ? next(state.settingsDraft) : next
    })),
  hydrateFromBootstrap: (bootstrap) =>
    set((state) => ({
      bootstrap,
      settingsDraft: {
        deviceName: bootstrap.settings.deviceName,
        printerName: bootstrap.settings.printerName ?? ""
      },
      authPassword: bootstrap.session ? state.authPassword : "",
      activationContext: bootstrap.stage === "ready" ? null : state.activationContext
    })),
  seedActivationForm: (context) =>
    set((state) => ({
      activationContext: context,
      branchName: state.branchName || context.suggestedBranchName,
      deviceName: state.deviceName || context.suggestedDeviceName
    }))
}));

import {
  getPrinterConfigLabel,
  isPrinterConfigured,
  kickCashDrawer,
  printRawReceiptText,
  PrintResult,
  ReceiptPrintModel,
  printReceipt
} from "../printer/escpos-printer.js";

export interface HardwareDiagnostics {
  printerConfigured: boolean;
  printerTarget: string | null;
  cashDrawerEnabled: boolean;
  scannerMode: "keyboard_wedge";
  customerDisplayMode: "electron_window";
}

export interface IReceiptPrinter {
  print(model: ReceiptPrintModel): Promise<void>;
  printText(receiptText: string): Promise<PrintResult>;
  getStatus(): HardwareDiagnostics;
}

export interface ICashDrawer {
  open(reason: string): Promise<{ opened: boolean; warning?: string }>;
}

export interface IBarcodeInputHandler {
  normalize(rawInput: string): string;
}

export interface ICustomerDisplayService {
  mode: "electron_window";
}

class EscPosReceiptPrinterAdapter implements IReceiptPrinter {
  async print(model: ReceiptPrintModel) {
    await printReceipt(model);
  }

  async printText(receiptText: string) {
    return printRawReceiptText(receiptText);
  }

  getStatus(): HardwareDiagnostics {
    return getHardwareDiagnostics();
  }
}

class CashDrawerAdapter implements ICashDrawer {
  async open(_reason: string) {
    return kickCashDrawer();
  }
}

class KeyboardWedgeBarcodeHandler implements IBarcodeInputHandler {
  normalize(rawInput: string) {
    return rawInput.trim();
  }
}

class ElectronCustomerDisplayService implements ICustomerDisplayService {
  mode = "electron_window" as const;
}

const receiptPrinter = new EscPosReceiptPrinterAdapter();
const cashDrawer = new CashDrawerAdapter();
const barcodeInput = new KeyboardWedgeBarcodeHandler();
const customerDisplay = new ElectronCustomerDisplayService();

export const getHardwareDiagnostics = (): HardwareDiagnostics => ({
  printerConfigured: isPrinterConfigured(),
  printerTarget: getPrinterConfigLabel(),
  cashDrawerEnabled: process.env.LOOMAPOS_CASHDRAWER_KICK === "true",
  scannerMode: "keyboard_wedge",
  customerDisplayMode: customerDisplay.mode
});

export const hardwareAdapters = {
  receiptPrinter,
  cashDrawer,
  barcodeInput,
  customerDisplay
};

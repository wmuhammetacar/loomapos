import fs from "node:fs/promises";
import net from "node:net";

export interface ReceiptLine {
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptPrintModel {
  saleId: string;
  receiptNo: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: "CASH" | "CARD";
  lines: ReceiptLine[];
}

export interface PrintResult {
  printed: boolean;
  warning?: string;
}

const ESC = "\x1B";
const GS = "\x1D";

type PrinterTarget =
  | { type: "network"; host: string; port: number }
  | { type: "device"; path: string };

export const renderReceiptText = (model: ReceiptPrintModel): string => {
  const lines: string[] = [];
  lines.push("LOOMAPOS");
  lines.push(`Fis: ${model.receiptNo}`);
  lines.push(`Tarih: ${new Date(model.createdAt).toLocaleString("tr-TR")}`);
  lines.push("--------------------------------");
  for (const line of model.lines) {
    lines.push(`${line.productName}`);
    lines.push(`${line.qty} x ${line.unitPrice.toFixed(2)} = ${line.lineTotal.toFixed(2)} TL`);
  }
  lines.push("--------------------------------");
  lines.push(`Ara Toplam : ${model.subtotal.toFixed(2)} TL`);
  lines.push(`Iskonto    : ${model.discount.toFixed(2)} TL`);
  lines.push(`Vergi      : ${model.tax.toFixed(2)} TL`);
  lines.push(`Toplam     : ${model.total.toFixed(2)} TL`);
  lines.push(`Odeme      : ${model.paymentMethod}`);
  lines.push("--------------------------------");
  lines.push("Tesekkur ederiz.");
  lines.push(`Satis Id: ${model.saleId}`);
  return lines.join("\n");
};

export const printReceipt = async (model: ReceiptPrintModel): Promise<void> => {
  const target = resolvePrinterTarget();
  if (!target) {
    return;
  }

  const receiptText = renderReceiptText(model);
  await printReceiptText(receiptText, target);

  await kickCashDrawer();
};

export const printRawReceiptText = async (receiptText: string): Promise<PrintResult> => {
  const target = resolvePrinterTarget();
  if (!target) {
    return {
      printed: false,
      warning: "Yazici bagli degil. Satis kaydi tamamlandi."
    };
  }

  await printReceiptText(receiptText, target);
  return { printed: true };
};

export const isPrinterConfigured = () => resolvePrinterTarget() !== null;

export const getPrinterConfigLabel = () => {
  const target = resolvePrinterTarget();
  if (!target) {
    return null;
  }

  return target.type === "network" ? `${target.host}:${target.port}` : target.path;
};

export const kickCashDrawer = async () => {
  if (process.env.LOOMAPOS_CASHDRAWER_KICK !== "true") {
    return {
      opened: false,
      warning: "Cash drawer trigger disabled."
    };
  }

  const target = resolvePrinterTarget();
  if (!target) {
    return {
      opened: false,
      warning: "Cash drawer trigger skipped because printer is not configured."
    };
  }

  const kick = Buffer.from(`${ESC}p\x00\x19\xFA`, "ascii");
  await writeToTarget(target, kick);
  return {
    opened: true
  };
};

const printReceiptText = async (receiptText: string, target: PrinterTarget) => {
  const command = Buffer.from(
    `${ESC}@${ESC}a\x01${receiptText}\n\n${ESC}a\x00${GS}V\x00`,
    "ascii"
  );

  await writeToTarget(target, command);
};

const resolvePrinterTarget = (): PrinterTarget | null => {
  const host = process.env.LOOMAPOS_PRINTER_HOST?.trim();
  if (host) {
    return {
      type: "network",
      host,
      port: Number(process.env.LOOMAPOS_PRINTER_PORT ?? "9100")
    };
  }

  const devicePath = process.env.LOOMAPOS_PRINTER_DEVICE_PATH?.trim();
  if (devicePath) {
    return {
      type: "device",
      path: devicePath
    };
  }

  return null;
};

const writeToTarget = async (target: PrinterTarget, buffer: Buffer) => {
  if (target.type === "network") {
    await writeToPrinter(target.host, target.port, buffer);
    return;
  }

  await writeToDevicePath(target.path, buffer);
};

const writeToPrinter = (host: string, port: number, buffer: Buffer): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(buffer);
      socket.end();
    });

    socket.on("error", reject);
    socket.on("close", () => resolve());
  });

const writeToDevicePath = async (path: string, buffer: Buffer) => {
  const handle = await fs.open(path, "w");
  try {
    await handle.write(buffer, 0, buffer.length, null);
  } finally {
    await handle.close();
  }
};

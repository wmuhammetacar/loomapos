import type { DeviceStatus } from "@prisma/client";

export function requiresNewSlot(existingDevice: { status: DeviceStatus } | null) {
  return !existingDevice || existingDevice.status !== "active";
}

export function canAllocateDeviceSlot(activeDevicesExcludingCurrent: number, maxDevices: number) {
  return activeDevicesExcludingCurrent < maxDevices;
}

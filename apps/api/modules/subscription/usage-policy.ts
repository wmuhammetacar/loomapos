export function exceedsNextPlanLimits(params: {
  usage: {
    devices: number;
    branches: number;
    staff: number;
  };
  nextLimits: {
    maxDevices: number;
    maxBranches: number;
    maxStaff: number;
  };
}) {
  return (
    params.usage.devices > params.nextLimits.maxDevices ||
    params.usage.branches > params.nextLimits.maxBranches ||
    params.usage.staff > params.nextLimits.maxStaff
  );
}


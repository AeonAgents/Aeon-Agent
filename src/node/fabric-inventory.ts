import { arch, availableParallelism, platform, totalmem } from "node:os";

/** Observations are informational; they are neither a registration nor a grant. */
export interface FabricObservation {
  platform: string;
  architecture: string;
  logicalCpus: number | null;
  memoryBytes: number | null;
}

export interface LocalFabricInventory extends FabricObservation {
  schemaVersion: 1;
  kind: "local-inventory";
  grants: [];
  remoteExecution: false;
}

function positiveInteger(value: number | null): number | null {
  return value !== null && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function fabricInventoryFrom(observation: FabricObservation): LocalFabricInventory {
  return {
    schemaVersion: 1,
    kind: "local-inventory",
    platform: observation.platform,
    architecture: observation.architecture,
    logicalCpus: positiveInteger(observation.logicalCpus),
    memoryBytes: positiveInteger(observation.memoryBytes),
    grants: [],
    remoteExecution: false,
  };
}

function observeNumber(read: () => number): number | null {
  try {
    return read();
  } catch {
    return null;
  }
}

export function localFabricInventory(): LocalFabricInventory {
  return fabricInventoryFrom({
    platform: platform(),
    architecture: arch(),
    logicalCpus: observeNumber(availableParallelism),
    memoryBytes: observeNumber(totalmem),
  });
}

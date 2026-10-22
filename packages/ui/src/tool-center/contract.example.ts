import {
  toggleHscodeToolCenterId,
  type HscodeToolCenterPreferences,
} from "./contract.js";

/** Example preference projection; tool definitions and plugin manifests stay outside this record. */
export function examplePinToolCenterItem(
  current: HscodeToolCenterPreferences,
  id: string,
): HscodeToolCenterPreferences {
  return {
    ...current,
    pinnedIds: toggleHscodeToolCenterId(current.pinnedIds, id),
  };
}

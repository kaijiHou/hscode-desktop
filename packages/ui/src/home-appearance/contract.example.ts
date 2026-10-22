import { readHomeBackground, saveHomeBackground } from "./contract.js";

/** 用户点击移除：只移除本地偏好，不删除原照片文件。 */
export function exampleRemoveHomeBackground(): void {
  if (readHomeBackground() !== null) saveHomeBackground(null);
}

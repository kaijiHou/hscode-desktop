/** 本地照片不经过 Host/Agent；写入成功后才通知订阅者，失败保留旧值。 */
export { HomeBackgroundSettings, HomeBackgroundLayer } from "./HomeBackground.js";
export {
  normalizeHomeBackground,
  readHomeBackground,
  saveHomeBackground,
  HOME_BACKGROUND_KEY,
} from "./homeBackgroundStorage.js";

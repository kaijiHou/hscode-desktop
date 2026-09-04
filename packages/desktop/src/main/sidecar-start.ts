export type SidecarStartMessage = {
  type: "start"
  hostname: string
  port: number
  password: string
  userDataPath: string
}

type SpawnableSidecar = {
  once(event: "spawn", listener: () => void): unknown
  off(event: "spawn", listener: () => void): unknown
  postMessage(message: SidecarStartMessage): void
}

export function sendSidecarStartOnSpawn(child: SpawnableSidecar, message: SidecarStartMessage) {
  const onSpawn = () => child.postMessage(message)
  child.once("spawn", onSpawn)
  return () => child.off("spawn", onSpawn)
}

export interface SwitchBotDevice {
  deviceId: string
  deviceName: string
  deviceType: string
  enableCloudService: boolean
  hubDeviceId: string
}

export interface InfraredRemoteList {
  deviceId: string
  deviceName: string
  remoteType: string
  hubDeviceId: string
}

export interface Body {
  deviceList: SwitchBotDevice[]
  infraredRemoteList: InfraredRemoteList[]
}

export interface GetDevicesResult {
  statusCode: number
  body: Body
  message: string
}

export interface DeviceStatus {
  deviceId: string
  deviceType: string
  hubDeviceId: string
  humidity: number
  temperature: number
}

export interface GetDevicesStatusResult {
  statusCode: number
  body: DeviceStatus
  message: string
}

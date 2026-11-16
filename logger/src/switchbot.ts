import axios from 'axios'
import { createHmac, randomUUID } from 'node:crypto'
import { AccountConfig } from './configuration'
import { GetDevicesResult, SwitchBotDevice } from './model/devices'
import { DeviceStatus, GetDevicesStatusResult } from './model/device-status'

const BASE_URL = 'https://api.switch-bot.com'

const DAILY_CALL_BUDGET = 9000
const DEVICE_LIST_CALLS_PER_DAY = 24

const TARGET_DEVICE_TYPES = new Set([
  'Meter',
  'MeterPlus',
  'WoMeterPlus',
  'WoIOSensor',
  'Hub 2',
  'WoHub2',
  'MeterPro',
  'MeterPro(CO2)',
  'Hub 3',
  'Outdoor Meter',
])

export interface TargetDevice {
  deviceId: string
  deviceName: string | null
}

/** Thrown on HTTP 429 / 401; carries no request headers. */
export class RateLimitError extends Error {}

export function createSignHeaders(
  token: string,
  secret: string,
  t: string,
  nonce: string
): Record<string, string> {
  const sign = createHmac('sha256', secret)
    .update(token + t + nonce)
    .digest('base64')
    .toUpperCase()
  return { Authorization: token, t, nonce, sign }
}

export function apiPrefix(account: AccountConfig): string {
  return account.secret ? '/v1.1' : '/v1.0'
}

export function buildHeaders(
  account: AccountConfig,
  now: number = Date.now(),
  nonce: string = randomUUID()
): Record<string, string> {
  return account.secret
    ? createSignHeaders(account.token, account.secret, String(now), nonce)
    : { Authorization: account.token }
}

export function isTargetDeviceType(deviceType: string): boolean {
  return TARGET_DEVICE_TYPES.has(deviceType)
}

/**
 * Resolves which devices to poll for an account.
 * @param deviceList - Result of GET /devices, or null if never fetched
 */
export function selectDevices(
  deviceList: SwitchBotDevice[] | null,
  account: AccountConfig
): TargetDevice[] {
  const nameOf = (deviceId: string) =>
    deviceList?.find((d) => d.deviceId === deviceId)?.deviceName ?? null

  if (account.devices) {
    return account.devices.map((deviceId) => ({
      deviceId,
      deviceName: nameOf(deviceId),
    }))
  }
  return (deviceList ?? [])
    .filter(
      (d) =>
        isTargetDeviceType(d.deviceType) &&
        !account.excludeDevices.includes(d.deviceId)
    )
    .map((d) => ({ deviceId: d.deviceId, deviceName: d.deviceName }))
}

export function extractReading(
  status: Partial<Pick<DeviceStatus, 'temperature' | 'humidity'>>
): { temperature: number; humidity: number } | null {
  const { temperature, humidity } = status
  if (typeof temperature !== 'number' || typeof humidity !== 'number') {
    return null
  }
  return { temperature, humidity }
}

/** Seconds between polls so that one account stays within the daily API limit. */
export function effectiveInterval(
  configured: number,
  deviceCount: number
): number {
  const minimum = Math.ceil(
    (86_400 * deviceCount) / (DAILY_CALL_BUDGET - DEVICE_LIST_CALLS_PER_DAY)
  )
  return Math.max(configured, minimum)
}

async function get<T>(account: AccountConfig, path: string): Promise<T> {
  const response = await axios.get<T>(BASE_URL + apiPrefix(account) + path, {
    headers: buildHeaders(account),
    validateStatus: () => true,
  })
  if (response.status === 429 || response.status === 401) {
    throw new RateLimitError(
      `SwitchBot API returned HTTP ${response.status} (account: ${account.name})`
    )
  }
  if (response.status !== 200) {
    throw new Error(
      `SwitchBot API returned HTTP ${response.status} for ${path} (account: ${account.name})`
    )
  }
  return response.data
}

export async function fetchDevices(
  account: AccountConfig
): Promise<SwitchBotDevice[]> {
  const result = await get<GetDevicesResult>(account, '/devices')
  return result.body.deviceList
}

export async function fetchStatus(
  account: AccountConfig,
  deviceId: string
): Promise<Partial<DeviceStatus>> {
  const result = await get<GetDevicesStatusResult>(
    account,
    `/devices/${encodeURIComponent(deviceId)}/status`
  )
  return result.body
}

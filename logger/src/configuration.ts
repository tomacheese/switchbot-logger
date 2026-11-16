import fs from 'node:fs'

export interface DatabaseConfig {
  host: string
  port: number
  username: string
  password: string
  database: string
  type: 'mysql' | 'sqlite'
}

export interface AccountConfig {
  name: string
  token: string
  secret?: string
  intervalSeconds: number
  /** 指定時は自動検出を行わず、この ID のみを対象にする */
  devices?: string[]
  excludeDevices: string[]
}

export interface NormalizedConfig {
  accounts: AccountConfig[]
  /** device_id が NULL の既存行に付与する deviceId */
  legacyDeviceId?: string
  db: DatabaseConfig
  warnings: string[]
}

export const DEFAULT_INTERVAL_SECONDS = 60

type Raw = Record<string, unknown>

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalStringArray(
  value: unknown,
  label: string
): string[] | undefined {
  if (value === undefined) return undefined
  if (
    !Array.isArray(value) ||
    value.some((v) => typeof v !== 'string' || v === '')
  ) {
    throw new Error(`${label} must be an array of non-empty strings`)
  }
  return value as string[]
}

function normalizeAccount(raw: unknown, index: number): AccountConfig {
  const label = `accounts[${index}]`
  if (!isRecord(raw)) throw new Error(`${label} must be an object`)
  if (typeof raw.name !== 'string' || raw.name === '') {
    throw new Error(`${label}.name is required`)
  }
  if (typeof raw.token !== 'string' || raw.token === '') {
    throw new Error(`${label}.token is required (account: ${raw.name})`)
  }
  if (
    raw.secret !== undefined &&
    (typeof raw.secret !== 'string' || raw.secret === '')
  ) {
    throw new Error(`${label}.secret must be a non-empty string if specified`)
  }
  const intervalSeconds = raw.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS
  if (
    typeof intervalSeconds !== 'number' ||
    !Number.isFinite(intervalSeconds) ||
    intervalSeconds <= 0
  ) {
    throw new Error(`${label}.intervalSeconds must be a positive number`)
  }
  return {
    name: raw.name,
    token: raw.token,
    secret: raw.secret as string | undefined,
    intervalSeconds,
    devices: optionalStringArray(raw.devices, `${label}.devices`),
    excludeDevices:
      optionalStringArray(raw.excludeDevices, `${label}.excludeDevices`) ?? [],
  }
}

/**
 * config.json の中身を正規化する。従来形式 { token, deviceId, db } も受け付ける。
 * エラーメッセージには token / secret の値を含めない。
 */
export function normalizeConfig(raw: unknown): NormalizedConfig {
  if (!isRecord(raw)) throw new Error('config must be an object')
  if (!isRecord(raw.db)) throw new Error('config.db is required')
  const database = raw.db as unknown as DatabaseConfig
  const warnings: string[] = []

  let accounts: AccountConfig[]
  let legacyDeviceId: string | undefined
  if (raw.accounts === undefined) {
    // 従来形式
    if (typeof raw.token !== 'string' || raw.token === '') {
      throw new Error('config.accounts or config.token is required')
    }
    if (typeof raw.deviceId !== 'string' || raw.deviceId === '') {
      throw new Error('config.deviceId is required in the legacy format')
    }
    accounts = [
      normalizeAccount(
        { name: 'default', token: raw.token, devices: [raw.deviceId] },
        0
      ),
    ]
    legacyDeviceId = raw.deviceId
  } else {
    if (!Array.isArray(raw.accounts) || raw.accounts.length === 0) {
      throw new Error('config.accounts must be a non-empty array')
    }
    accounts = raw.accounts.map((a, index) => normalizeAccount(a, index))
    if (raw.token !== undefined) {
      warnings.push('config.token is ignored because config.accounts exists')
    }
    if (raw.legacyDeviceId !== undefined) {
      if (typeof raw.legacyDeviceId !== 'string' || raw.legacyDeviceId === '') {
        throw new Error('config.legacyDeviceId must be a non-empty string')
      }
      legacyDeviceId = raw.legacyDeviceId
    }
  }

  const names = new Set<string>()
  for (const account of accounts) {
    if (names.has(account.name)) {
      throw new Error(`duplicate account name: ${account.name}`)
    }
    names.add(account.name)
  }

  return { accounts, legacyDeviceId, db: database, warnings }
}

export function getConfig(): NormalizedConfig {
  return normalizeConfig(
    JSON.parse(fs.readFileSync('./config.json').toString())
  )
}

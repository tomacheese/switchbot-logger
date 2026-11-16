import axios from 'axios'
import yargs from 'yargs'
import { backfillLegacyDeviceId } from './backfill'
import { AccountConfig, getConfig, NormalizedConfig } from './configuration'
import { DBHumidity } from './entities/humidity.entity'
import { DBTemperature } from './entities/temperature.entity'
import { SwitchBotDevice } from './model/devices'
import { AppDataSource } from './mysql'
import {
  AccountState,
  dueAccounts,
  loadValidConfig,
  pruneState,
} from './scheduler'
import {
  effectiveInterval,
  extractReading,
  fetchDevices,
  fetchStatus,
  RateLimitError,
  selectDevices,
} from './switchbot'

const TICK_MS = 10_000
const DEVICE_LIST_TTL_MS = 3_600_000

const argv = yargs.boolean('get-devices').parseSync()

interface DeviceListCache {
  list: SwitchBotDevice[]
  fetchedAt: number
}

const states = new Map<string, AccountState>()
const deviceLists = new Map<string, DeviceListCache>()
const summaries = new Map<string, string>()

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function notifyError(account: AccountConfig, error: unknown) {
  await axios
    .post('http://discord-deliver', {
      embed: {
        title: `Error (${account.name})`,
        description: messageOf(error),
        color: 0xff_00_00,
      },
    })
    .catch(() => null)
}

async function refreshDeviceList(account: AccountConfig, now: number) {
  const cached = deviceLists.get(account.name)
  if (cached && now - cached.fetchedAt < DEVICE_LIST_TTL_MS) return
  try {
    deviceLists.set(account.name, {
      list: await fetchDevices(account),
      fetchedAt: now,
    })
  } catch (error) {
    if (error instanceof RateLimitError) throw error
    console.error(
      `[${account.name}] failed to refresh device list: ${messageOf(error)}`
    )
  }
}

function logSummary(account: AccountConfig, deviceCount: number) {
  const interval = effectiveInterval(account.intervalSeconds, deviceCount)
  const summary = `${deviceCount} devices, interval ${interval}s (configured ${account.intervalSeconds}s), about ${Math.ceil((86_400 / interval) * deviceCount)} calls/day`
  if (summaries.get(account.name) === summary) return
  summaries.set(account.name, summary)
  console.log(`[${account.name}] ${summary}`)
  if (interval > account.intervalSeconds) {
    console.warn(
      `[${account.name}] intervalSeconds ${account.intervalSeconds} is below the API limit minimum for ${deviceCount} devices; using ${interval}s`
    )
  }
}

async function saveReading(
  deviceId: string,
  deviceName: string | null,
  temperature: number,
  humidity: number
) {
  await AppDataSource.transaction(async (manager) => {
    await manager.save(
      Object.assign(new DBTemperature(), {
        deviceId,
        deviceName,
        value: temperature,
      })
    )
    await manager.save(
      Object.assign(new DBHumidity(), { deviceId, deviceName, value: humidity })
    )
  })
}

async function pollAccount(account: AccountConfig, now: number) {
  await refreshDeviceList(account, now)
  const devices = selectDevices(
    deviceLists.get(account.name)?.list ?? null,
    account
  )
  states.set(account.name, { lastRunAt: now, deviceCount: devices.length })
  logSummary(account, devices.length)

  const errors: unknown[] = []
  for (const device of devices) {
    try {
      const reading = extractReading(
        await fetchStatus(account, device.deviceId)
      )
      if (reading === null) {
        console.warn(
          `[${account.name}] ${device.deviceId} has no temperature/humidity; skipped`
        )
        continue
      }
      await saveReading(
        device.deviceId,
        device.deviceName,
        reading.temperature,
        reading.humidity
      )
    } catch (error) {
      console.error(
        `[${account.name}] ${device.deviceId} failed: ${messageOf(error)}`
      )
      errors.push(error)
      if (error instanceof RateLimitError) break
    }
  }
  if (errors.length > 0) {
    await notifyError(
      account,
      `${errors.length} device(s) failed. first: ${messageOf(errors[0])}`
    )
  }
}

async function tick(current: NormalizedConfig): Promise<NormalizedConfig> {
  const loaded = loadValidConfig(getConfig, current)
  if (loaded.error) {
    console.error(
      `config.json is invalid; keeping the previous one: ${loaded.error.message}`
    )
  }
  const config = loaded.config
  pruneState(states, config.accounts)
  pruneState(deviceLists, config.accounts)
  pruneState(summaries, config.accounts)

  const now = Date.now()
  for (const account of dueAccounts(config.accounts, states, now)) {
    const previous = states.get(account.name)
    states.set(account.name, {
      lastRunAt: now,
      deviceCount: previous?.deviceCount ?? 0,
    })
    try {
      await pollAccount(account, now)
    } catch (error) {
      console.error(`[${account.name}] ${messageOf(error)}`)
      await notifyError(account, error)
    }
  }
  return config
}

async function printDevices(config: NormalizedConfig) {
  for (const account of config.accounts) {
    console.log(`[${account.name}]`)
    console.log(await fetchDevices(account))
  }
}

async function main() {
  console.log('main()')
  let config = getConfig()
  for (const warning of config.warnings) console.warn(warning)

  if (argv['get-devices']) {
    await printDevices(config)
    return
  }

  console.log('Initializing database...')
  await AppDataSource.initialize()
  console.log('Database initialized')
  await backfillLegacyDeviceId(config.legacyDeviceId)

  for (;;) {
    config = await tick(config)
    await new Promise((resolve) => setTimeout(resolve, TICK_MS))
  }
}

main()
  .catch((error) => {
    console.error(messageOf(error))
    process.exitCode = 1
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) await AppDataSource.destroy()
  })

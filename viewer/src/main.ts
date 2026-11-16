import express, { json as expressJson, Request, Response } from 'express'
import { BaseEntity, FindOptionsWhere, IsNull, Not } from 'typeorm'
import { DBHumidity } from './entities/humidity.entity'
import { DBTemperature } from './entities/temperature.entity'
import { AppDataSource } from './mysql'

const UNKNOWN_DEVICE_ID = '__unknown__'
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 10_000

type ReadingEntity = typeof DBTemperature | typeof DBHumidity

function parseLimit(value: unknown): number {
  const limit = typeof value === 'string' ? Number.parseInt(value) : Number.NaN
  if (Number.isNaN(limit)) return DEFAULT_LIMIT
  return Math.min(Math.max(limit, 1), MAX_LIMIT)
}

function deviceFilter(
  deviceId: unknown
): FindOptionsWhere<DBTemperature & DBHumidity> | undefined {
  if (typeof deviceId !== 'string' || deviceId === '') return undefined
  return deviceId === UNKNOWN_DEVICE_ID ? { deviceId: IsNull() } : { deviceId }
}

function respondUnavailable(response: Response, error: unknown) {
  console.error(error instanceof Error ? error.message : String(error))
  response.status(503).json({ error: 'database unavailable' })
}

async function listDevices() {
  const rows = await DBTemperature.createQueryBuilder('t')
    .select('t.deviceId', 'deviceId')
    .groupBy('t.deviceId')
    .getRawMany<{ deviceId: string | null }>()

  const devices: { deviceId: string; deviceName: string | null }[] = []
  let hasUnknown = false
  for (const { deviceId } of rows) {
    if (deviceId === null) {
      hasUnknown = true
      continue
    }
    const named = await DBTemperature.findOne({
      where: { deviceId, deviceName: Not(IsNull()) },
      order: { createdAt: 'DESC' },
    })
    devices.push({ deviceId, deviceName: named?.deviceName ?? null })
  }
  devices.sort((a, b) =>
    (a.deviceName ?? a.deviceId).localeCompare(b.deviceName ?? b.deviceId)
  )
  if (hasUnknown) {
    devices.push({ deviceId: UNKNOWN_DEVICE_ID, deviceName: '不明' })
  }
  return devices
}

function readingHandler(entity: ReadingEntity) {
  return async (request: Request, response: Response) => {
    try {
      const where = deviceFilter(request.query.deviceId)
      const rows = await (entity as typeof BaseEntity & ReadingEntity).find({
        where,
        order: where ? { createdAt: 'DESC', rowId: 'DESC' } : { rowId: 'DESC' },
        take: parseLimit(request.query.limit),
      })
      response.json(rows)
    } catch (error) {
      respondUnavailable(response, error)
    }
  }
}

async function main() {
  console.log('main()')

  console.log('Initializing database...')
  await AppDataSource.initialize()
  console.log('Database initialized')

  const app = express()
  app.use(expressJson())
  app.use(express.static('view'))

  app.get('/api/devices', async (_request, response) => {
    try {
      response.json(await listDevices())
    } catch (error) {
      respondUnavailable(response, error)
    }
  })
  app.get('/api/temperatures', readingHandler(DBTemperature))
  app.get('/api/humidities', readingHandler(DBHumidity))
  app.listen(80, '0.0.0.0', () => {
    console.log(`Server started.`)
  })
}

;(async () => {
  await main().catch(async (error) => {
    console.error(error)
  })
})()

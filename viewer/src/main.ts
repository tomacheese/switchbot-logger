import express, { json as expressJson } from 'express'
import { DBHumidity } from './entities/humidity.entity'
import { DBTemperature } from './entities/temperature.entity'
import { AppDataSource } from './mysql'

async function main() {
  console.log('main()')

  console.log('Initializing database...')
  await AppDataSource.initialize()
  console.log('Database initialized')

  const app = express()
  app.use(expressJson())
  app.use(express.static('view'))

  app.get('/api/temperatures', async (request, response) => {
    const limit =
      request.query.limit && typeof request.query.limit === 'string'
        ? Number.parseInt(request.query.limit)
        : 100
    const temperatures = await DBTemperature.find({
      order: {
        rowId: 'DESC',
      },
      take: limit,
    })
    response.json(temperatures)
  })
  app.get('/api/humidities', async (request, response) => {
    const limit =
      request.query.limit && typeof request.query.limit === 'string'
        ? Number.parseInt(request.query.limit)
        : 100
    const humidities = await DBHumidity.find({
      order: {
        rowId: 'DESC',
      },
      take: limit,
    })
    response.json(humidities)
  })
  app.listen(80, '0.0.0.0', () => {
    console.log(`Server started.`)
  })
}

;(async () => {
  await main().catch(async (error) => {
    console.error(error)
  })
})()

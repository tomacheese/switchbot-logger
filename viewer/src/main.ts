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

  app.get('/api/temperatures', async (_req, res) => {
    const temperatures = await DBTemperature.find()
    res.json(temperatures)
  })
  app.get('/api/humidities', async (_req, res) => {
    const humidities = await DBHumidity.find()
    res.json(humidities)
  })
  app.listen(80, '0.0.0.0', () => {
    console.log(`Server started.`)
  })
}

;(async () => {
  await main().catch(async (err) => {
    console.error(err)
  })
})()

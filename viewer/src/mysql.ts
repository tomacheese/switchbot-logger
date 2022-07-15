import { DataSource } from 'typeorm'
import { SnakeNamingStrategy } from 'typeorm-naming-strategies'
import { getConfig } from './configuration'
import { DBHumidity } from './entities/humidity.entity'
import { DBTemperature } from './entities/temperature.entity'

const config = getConfig()

export const AppDataSource = new DataSource({
  type: config.db.type,
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  namingStrategy: new SnakeNamingStrategy(),
  entities: [DBTemperature, DBHumidity],
  subscribers: [],
  migrations: [],
  timezone: '+09:00',
  supportBigNumbers: true,
  bigNumberStrings: true,
})

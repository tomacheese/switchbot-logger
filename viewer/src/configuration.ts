import fs from 'node:fs'

interface Config {
  token: string
  deviceId: string
  db: {
    host: string
    port: number
    username: string
    password: string
    database: string
    type: 'mysql' | 'sqlite'
  }
}

export function getConfig() {
  const config = JSON.parse(
    fs.readFileSync('./config.json').toString()
  ) as Config
  return config
}

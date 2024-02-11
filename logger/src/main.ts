import axios from 'axios'
import yargs from 'yargs'
import { getConfig } from './configuration'
import { DBHumidity } from './entities/humidity.entity'
import { DBTemperature } from './entities/temperature.entity'
import { GetDevicesResult, SwitchBotDevice } from './model/devices'
import { DeviceStatus, GetDevicesStatusResult } from './model/device-status'
import { AppDataSource } from './mysql'

const BASE_URL = 'https://api.switch-bot.com'

const argv = yargs.boolean('get-devices').parseSync()

async function getDevices(): Promise<SwitchBotDevice[]> {
  const config = getConfig()
  const response = await axios.get<GetDevicesResult>(
    BASE_URL + '/v1.0/devices',
    {
      headers: {
        Authorization: config.token,
      },
    }
  )
  return response.data.body.deviceList
}

async function getDeviceStatus(deviceId: string): Promise<DeviceStatus | null> {
  const config = getConfig()
  const response = await axios.get<GetDevicesStatusResult>(
    BASE_URL + '/v1.0/devices/' + deviceId + '/status',
    {
      headers: {
        Authorization: config.token,
      },
      validateStatus: () => true,
    }
  )
  if (response.status !== 200) {
    console.log('getDeviceStatus Error: ' + response.status)
    return null
  }
  return response.data.body
}

async function main() {
  console.log('main()')

  if (argv['get-devices']) {
    const devices = await getDevices()
    console.log(devices)
    return
  }

  const config = getConfig()
  const status = await getDeviceStatus(config.deviceId)
  if (status === null) {
    console.log('Device not found?')
    return
  }

  const databaseTemperature = new DBTemperature()
  databaseTemperature.value = status.temperature
  await databaseTemperature.save()

  const databaseHumidity = new DBHumidity()
  databaseHumidity.value = status.humidity
  await databaseHumidity.save()

  console.log('Database saved')
}

;(async () => {
  console.log('Initializing database...')
  await AppDataSource.initialize()
  console.log('Database initialized')

  await main()
    .catch(async (error) => {
      console.error(error)
      await axios
        .post('http://discord-deliver', {
          embed: {
            title: `Error`,
            description: `${error.message}`,
            color: 0xff_00_00,
          },
        })
        .catch(() => null)
    })
    .finally(async () => {
      await AppDataSource.destroy()
    })
})()

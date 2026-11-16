import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AccountConfig } from './configuration'
import {
  apiPrefix,
  buildHeaders,
  createSignHeaders,
  effectiveInterval,
  extractReading,
  selectDevices,
} from './switchbot'

const account = (overrides: Partial<AccountConfig> = {}): AccountConfig => ({
  name: 'a',
  token: 'DUMMY_TOKEN',
  intervalSeconds: 60,
  excludeDevices: [],
  ...overrides,
})

const list = [
  { deviceId: 'M1', deviceName: 'meter', deviceType: 'MeterPlus' },
  { deviceId: 'H1', deviceName: 'hub', deviceType: 'Hub 2' },
  { deviceId: 'C1', deviceName: 'curtain', deviceType: 'Curtain' },
  { deviceId: 'M2', deviceName: 'meter2', deviceType: 'WoIOSensor' },
].map((d) => ({ ...d, enableCloudService: true, hubDeviceId: '' }))

test('createSignHeaders matches a signature computed independently with openssl', () => {
  const headers = createSignHeaders(
    'DUMMY_TOKEN',
    'DUMMY_SECRET',
    '1700000000000',
    'nonce-1'
  )
  assert.deepEqual(headers, {
    Authorization: 'DUMMY_TOKEN',
    t: '1700000000000',
    nonce: 'nonce-1',
    sign: 'QWAFAAHEM3BNKADD2ILIEL/CNIXDGIRCV4Y+M8LJEMM=',
  })
})

test('accounts with a secret use v1.1 and sign; others use v1.0 with token only', () => {
  assert.equal(apiPrefix(account({ secret: 'S' })), '/v1.1')
  assert.equal(apiPrefix(account()), '/v1.0')
  assert.deepEqual(buildHeaders(account(), 1, 'n'), {
    Authorization: 'DUMMY_TOKEN',
  })
  assert.deepEqual(
    Object.keys(buildHeaders(account({ secret: 'S' }), 1, 'n')).sort(),
    ['Authorization', 'nonce', 'sign', 't']
  )
})

test('auto-detect picks temperature/humidity device types only', () => {
  assert.deepEqual(
    selectDevices(list, account()).map((d) => d.deviceId),
    ['M1', 'H1', 'M2']
  )
})

test('excludeDevices removes auto-detected devices', () => {
  assert.deepEqual(
    selectDevices(list, account({ excludeDevices: ['H1'] })).map(
      (d) => d.deviceId
    ),
    ['M1', 'M2']
  )
})

test('explicit devices bypass auto-detect and the type filter', () => {
  assert.deepEqual(selectDevices(list, account({ devices: ['C1', 'X9'] })), [
    { deviceId: 'C1', deviceName: 'curtain' },
    { deviceId: 'X9', deviceName: null },
  ])
})

test('without a device list, auto-detect is empty but explicit devices continue', () => {
  assert.deepEqual(selectDevices(null, account()), [])
  assert.deepEqual(selectDevices(null, account({ devices: ['M1'] })), [
    { deviceId: 'M1', deviceName: null },
  ])
})

test('extractReading requires numeric temperature and humidity', () => {
  assert.deepEqual(extractReading({ temperature: 21.5, humidity: 40 }), {
    temperature: 21.5,
    humidity: 40,
  })
  assert.equal(extractReading({ temperature: 21.5 }), null)
  assert.equal(extractReading({}), null)
})

test('effectiveInterval keeps one account under the daily limit', () => {
  assert.equal(effectiveInterval(60, 1), 60)
  assert.equal(effectiveInterval(1, 1), 10)
  assert.equal(effectiveInterval(60, 7), 68)
  assert.equal(effectiveInterval(1, 7), 68)
  assert.equal(effectiveInterval(60, 0), 60)
})

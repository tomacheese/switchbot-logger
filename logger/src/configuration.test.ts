import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeConfig } from './configuration'

const database = {
  host: 'mariadb',
  port: 3306,
  username: 'u',
  password: 'p',
  database: 'd',
  type: 'mysql',
}

test('legacy format becomes one account and legacyDeviceId', () => {
  const c = normalizeConfig({
    token: 'DUMMY_TOKEN',
    deviceId: 'DEV1',
    db: database,
  })
  assert.equal(c.accounts.length, 1)
  assert.equal(c.accounts[0].name, 'default')
  assert.deepEqual(c.accounts[0].devices, ['DEV1'])
  assert.equal(c.accounts[0].intervalSeconds, 60)
  assert.equal(c.legacyDeviceId, 'DEV1')
})

test('accounts array is normalized with defaults', () => {
  const c = normalizeConfig({
    accounts: [
      { name: 'home', token: 'T1' },
      { name: 'green', token: 'T2', secret: 'S2', intervalSeconds: 90 },
    ],
    legacyDeviceId: 'DEV1',
    db: database,
  })
  assert.equal(c.accounts.length, 2)
  assert.equal(c.accounts[0].devices, undefined)
  assert.deepEqual(c.accounts[0].excludeDevices, [])
  assert.equal(c.accounts[1].secret, 'S2')
  assert.equal(c.accounts[1].intervalSeconds, 90)
  assert.equal(c.legacyDeviceId, 'DEV1')
})

test('accounts wins over legacy token with a warning', () => {
  const c = normalizeConfig({
    accounts: [{ name: 'a', token: 'T' }],
    token: 'OLD',
    deviceId: 'X',
    db: database,
  })
  assert.equal(c.accounts[0].token, 'T')
  assert.equal(c.warnings.length, 1)
})

test('validation errors never contain the token value', () => {
  const cases: unknown[] = [
    { accounts: [], db: database },
    {
      accounts: [
        { name: 'a', token: 'SECRET_TOKEN_VALUE' },
        { name: 'a', token: 'SECRET_TOKEN_VALUE' },
      ],
      db: database,
    },
    { accounts: [{ name: 'a' }], db: database },
    {
      accounts: [
        { name: 'a', token: 'SECRET_TOKEN_VALUE', intervalSeconds: 0 },
      ],
      db: database,
    },
    {
      accounts: [{ name: 'a', token: 'SECRET_TOKEN_VALUE', devices: [1] }],
      db: database,
    },
  ]
  for (const raw of cases) {
    assert.throws(
      () => normalizeConfig(raw),
      (error: Error) => !error.message.includes('SECRET_TOKEN_VALUE')
    )
  }
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AccountConfig, normalizeConfig } from './configuration'
import {
  AccountState,
  dueAccounts,
  loadValidConfig,
  pruneState,
} from './scheduler'

const account = (name: string, intervalSeconds = 60): AccountConfig => ({
  name,
  token: 'DUMMY_TOKEN',
  intervalSeconds,
  excludeDevices: [],
})

const database = {
  host: 'h',
  port: 1,
  username: 'u',
  password: 'p',
  database: 'd',
}

test('an account without state is due on the next tick', () => {
  assert.deepEqual(dueAccounts([account('new')], new Map(), 0), [
    account('new'),
  ])
})

test('an account is due only after its interval elapsed', () => {
  const states = new Map<string, AccountState>([
    ['a', { lastRunAt: 0, deviceCount: 1 }],
  ])
  assert.deepEqual(dueAccounts([account('a')], states, 59_999), [])
  assert.deepEqual(dueAccounts([account('a')], states, 60_000), [account('a')])
})

test('the effective interval widens with the device count', () => {
  const states = new Map<string, AccountState>([
    ['g', { lastRunAt: 0, deviceCount: 7 }],
  ])
  assert.deepEqual(dueAccounts([account('g')], states, 67_999), [])
  assert.deepEqual(dueAccounts([account('g')], states, 68_000), [account('g')])
})

test('an account added to the config becomes due while existing ones wait', () => {
  const states = new Map<string, AccountState>([
    ['a', { lastRunAt: 1000, deviceCount: 1 }],
  ])
  const after = [account('a'), account('b')]
  assert.deepEqual(dueAccounts(after, states, 2000), [account('b')])
})

test('pruneState drops accounts removed from the config', () => {
  const states = new Map<string, AccountState>([
    ['a', { lastRunAt: 0, deviceCount: 1 }],
    ['gone', { lastRunAt: 0, deviceCount: 1 }],
  ])
  pruneState(states, [account('a')])
  assert.deepEqual([...states.keys()], ['a'])
})

test('loadValidConfig keeps the previous config when the new one is invalid', () => {
  const previous = normalizeConfig({
    accounts: [{ name: 'a', token: 'T' }],
    db: database,
  })
  const broken = loadValidConfig(() => {
    throw new Error('Unexpected end of JSON input')
  }, previous)
  assert.equal(broken.config, previous)
  assert.equal(broken.error?.message, 'Unexpected end of JSON input')

  const next = normalizeConfig({
    accounts: [
      { name: 'a', token: 'T' },
      { name: 'b', token: 'U' },
    ],
    db: database,
  })
  const ok = loadValidConfig(() => next, previous)
  assert.equal(ok.config, next)
  assert.equal(ok.error, undefined)
})

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'

const composeFile = path.resolve('..', 'docker-compose.yml')
const composeAvailable =
  spawnSync('docker', ['compose', 'version']).status === 0

function composeConfig(rootPassword: string, userPassword: string) {
  return spawnSync(
    'docker',
    ['compose', '-f', composeFile, 'config', '--format', 'json'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        MARIADB_ROOT_PASSWORD: rootPassword,
        MYSQL_PASSWORD: userPassword,
      },
    }
  )
}

test(
  'Compose はパスワードを必須とし phpMyAdmin を公開しない',
  { skip: !composeAvailable },
  () => {
    assert.notEqual(composeConfig('', 'test-user').status, 0)
    assert.notEqual(composeConfig('test-root', '').status, 0)

    const result = composeConfig('test-root', 'test-user')
    assert.equal(result.status, 0)
    const config = JSON.parse(result.stdout)
    assert.equal(config.services.phpmyadmin, undefined)
    assert.equal(config.services.mariadb.ports, undefined)
    assert.equal(
      config.services.mariadb.environment.MARIADB_ROOT_PASSWORD,
      'test-root'
    )
    assert.equal(
      config.services.mariadb.environment.MYSQL_PASSWORD,
      'test-user'
    )
    assert.match(
      config.services.mariadb.healthcheck.test[1],
      /\$MARIADB_ROOT_PASSWORD/
    )
  }
)

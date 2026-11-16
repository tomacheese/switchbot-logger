import { AccountConfig, NormalizedConfig } from './configuration'
import { effectiveInterval } from './switchbot'

export interface AccountState {
  lastRunAt: number
  deviceCount: number
}

export function intervalOf(
  account: AccountConfig,
  state: AccountState | undefined
): number {
  return effectiveInterval(account.intervalSeconds, state?.deviceCount ?? 0)
}

/** Accounts never run, or whose effective interval has elapsed since lastRunAt. */
export function dueAccounts(
  accounts: AccountConfig[],
  states: Map<string, AccountState>,
  now: number
): AccountConfig[] {
  return accounts.filter((account) => {
    const state = states.get(account.name)
    return (
      state === undefined ||
      now - state.lastRunAt >= intervalOf(account, state) * 1000
    )
  })
}

/** Drops state of accounts that no longer exist in the config. */
export function pruneState<T>(
  states: Map<string, T>,
  accounts: AccountConfig[]
): void {
  const names = new Set(accounts.map((a) => a.name))
  for (const name of states.keys()) {
    if (!names.has(name)) states.delete(name)
  }
}

/** Reads the config, keeping `previous` when the new content is invalid. */
export function loadValidConfig(
  read: () => NormalizedConfig,
  previous: NormalizedConfig
): { config: NormalizedConfig; error?: Error } {
  try {
    return { config: read() }
  } catch (error) {
    return {
      config: previous,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

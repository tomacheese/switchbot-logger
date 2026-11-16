import { IsNull } from 'typeorm'
import { DBHumidity } from './entities/humidity.entity'
import { DBTemperature } from './entities/temperature.entity'

/**
 * Assigns `legacyDeviceId` to rows recorded before device columns existed.
 * Idempotent: only rows whose device_id is NULL are touched.
 * Without `legacyDeviceId`, only warns when such rows exist.
 */
export async function backfillLegacyDeviceId(
  legacyDeviceId: string | undefined
): Promise<void> {
  for (const entity of [DBTemperature, DBHumidity]) {
    if (legacyDeviceId) {
      const result = await entity.update(
        { deviceId: IsNull() },
        { deviceId: legacyDeviceId }
      )
      console.log(
        `Backfilled device_id on ${result.affected ?? 0} rows (${entity.name})`
      )
      continue
    }
    const orphans = await entity.countBy({ deviceId: IsNull() })
    if (orphans > 0) {
      console.warn(
        `${orphans} rows in ${entity.name} have no device_id; set legacyDeviceId in config.json to assign them`
      )
    }
  }
}

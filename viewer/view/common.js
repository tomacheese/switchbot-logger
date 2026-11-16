const UNKNOWN_DEVICE_ID = '__unknown__'

function apiUrl(path, deviceId, params = {}) {
  const query = new URLSearchParams(params)
  if (deviceId) query.set('deviceId', deviceId)
  const text = query.toString()
  return text ? `${path}?${text}` : path
}

async function fetchDevices() {
  const devices = await fetch('/api/devices').then((response) => response.json())
  return Array.isArray(devices) ? devices : []
}

function pickDeviceId(devices, requested) {
  if (devices.some((device) => device.deviceId === requested)) return requested
  const first =
    devices.find((device) => device.deviceId !== UNKNOWN_DEVICE_ID) ??
    devices[0]
  return first ? first.deviceId : null
}

/** Renders a device selector and returns the selected deviceId (null if no data yet). */
async function setupDevicePicker() {
  const devices = await fetchDevices()
  const params = new URLSearchParams(location.search)
  const deviceId = pickDeviceId(devices, params.get('deviceId'))
  if (deviceId === null) return null

  const select = document.createElement('select')
  select.style.cssText = 'position:fixed;top:4px;right:4px;z-index:10'
  for (const device of devices) {
    const option = document.createElement('option')
    option.value = device.deviceId
    option.textContent = device.deviceName ?? device.deviceId
    select.append(option)
  }
  select.value = deviceId
  select.addEventListener('change', () => {
    params.set('deviceId', select.value)
    location.search = params.toString()
  })
  document.body.append(select)

  params.set('deviceId', deviceId)
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`)
  return deviceId
}

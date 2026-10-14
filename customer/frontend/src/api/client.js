// API_BASE_URL comes from .env at build time (see webpack.config.js); nginx and the dev server forward /api.
const API_BASE = process.env.API_BASE_URL || '/api'

export const apiUrl = (path) => `${API_BASE}${path}`

// Resolves with the JSON body; rejects when the request fails or the API answers with an error.
export async function getJson(path) {
  const response = await fetch(apiUrl(path), { credentials: 'include' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// Never rejects: resolves with whether the request succeeded and the JSON body ({} when there is none).
export async function requestJson(method, path, body) {
  const options = { method, credentials: 'include' }
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(body)
  }
  const response = await fetch(apiUrl(path), options).catch(() => null)
  return { ok: Boolean(response?.ok), result: await response?.json().catch(() => ({})) ?? {} }
}

export const postJson = (path, body) => requestJson('POST', path, body ?? {})
export const putJson = (path, body) => requestJson('PUT', path, body)
export const deleteJson = (path) => requestJson('DELETE', path)

// API_BASE_URL comes from .env at build time (see webpack.config.js); nginx and the dev server forward /api.
const API_BASE = process.env.API_BASE_URL || '/api'

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

// Calls the seller API. options.body may be a plain object (sent as JSON) or FormData (file uploads).
// Resolves with the JSON response; throws ApiError with the API's message when the request fails.
export async function api(path, options = {}) {
  const headers = new Headers(options.headers)
  let body
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body,
      credentials: 'include',
    })
  } catch {
    throw new ApiError('Could not reach the backend. Start the API server and try again.', 0)
  }

  if (response.status === 204) return undefined
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(result.message || 'Request failed. Please try again.', response.status, result.fields)
  return result
}

// The message to show for a failed request.
export const errorMessage = (error, fallback) => error instanceof Error ? error.message : fallback

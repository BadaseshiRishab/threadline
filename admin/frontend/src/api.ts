const API_BASE = process.env.API_BASE_URL || '/api'

export class ApiError extends Error {
  status: number
  fields?: string[]

  constructor(message: string, status: number, fields?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

type ApiOptions = Omit<RequestInit, 'body'> & { body?: unknown }

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  let body: BodyInit | undefined
  if (options.body instanceof FormData) body = options.body
  else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, body, credentials: 'include' })
  } catch {
    throw new ApiError('Could not reach the backend. Start the API server and try again.', 0)
  }

  if (response.status === 204) return undefined as T
  const result = await response.json().catch(() => ({})) as { message?: string; fields?: string[] } & T
  if (!response.ok) throw new ApiError(result.message || 'Request failed. Please try again.', response.status, result.fields)
  return result
}
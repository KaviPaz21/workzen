const basePath: string = import.meta.env.VITE_API_BASE_PATH ?? '/api/v1'

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${basePath}${path}`, init)
  } catch {
    throw new Error('Could not reach the WorkZen server. Check that the back end is running.')
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const detail =
      payload && typeof payload.detail === 'string' ? payload.detail : `The server returned an error (${response.status}).`
    throw new Error(detail)
  }
  return response
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function apiGet<TResponse>(path: string): Promise<TResponse> {
  const response = await request(path, { method: 'GET' })
  return (await response.json()) as TResponse
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const response = await request(path, { method: 'GET' })
  return response.blob()
}

export async function apiPost<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await request(path, jsonInit('POST', body))
  return (await response.json()) as TResponse
}

export async function apiPostForm<TResponse>(path: string, form: FormData): Promise<TResponse> {
  const response = await request(path, { method: 'POST', body: form })
  return (await response.json()) as TResponse
}

export async function apiPut<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await request(path, jsonInit('PUT', body))
  return (await response.json()) as TResponse
}

export async function apiPutForm(path: string, form: FormData): Promise<void> {
  await request(path, { method: 'PUT', body: form })
}

export async function apiDelete(path: string): Promise<void> {
  await request(path, { method: 'DELETE' })
}

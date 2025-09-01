import { apiConfig, API_CLIENT_CONFIG, buildApiUrl } from './apiConfig'

// Enhanced API client with retry logic and better error handling
export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : buildApiUrl(path)

  const fetchOptions = {
    credentials: 'include',
    timeout: API_CLIENT_CONFIG.timeout,
    headers: {
      ...API_CLIENT_CONFIG.headers,
      ...(options.headers || {})
    },
    ...options,
  }

  let lastError

  // Retry logic
  for (let attempt = 0; attempt <= API_CLIENT_CONFIG.retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), fetchOptions.timeout)

      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const text = await res.text()
      let data
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }

      if (!res.ok) {
        const message = data?.message || res.statusText || 'Request failed'
        const error = new Error(message)
        error.status = res.status
        error.data = data
        error.url = url

        // Don't retry client errors (4xx), only server errors (5xx) and network errors
        if (res.status >= 400 && res.status < 500) {
          throw error
        }

        lastError = error
        if (attempt < API_CLIENT_CONFIG.retries) {
          await new Promise(resolve => setTimeout(resolve, API_CLIENT_CONFIG.retryDelay * (attempt + 1)))
          continue
        }
        throw error
      }

      return data
    } catch (error) {
      lastError = error

      // Don't retry on abort or client errors
      if (error.name === 'AbortError' || (error.status >= 400 && error.status < 500)) {
        throw error
      }

      if (attempt < API_CLIENT_CONFIG.retries) {
        await new Promise(resolve => setTimeout(resolve, API_CLIENT_CONFIG.retryDelay * (attempt + 1)))
        continue
      }
    }
  }

  throw lastError
}

// Helper for GET requests with query parameters
export async function apiGet(path, params = {}, options = {}) {
  const queryString = new URLSearchParams(params).toString()
  const url = queryString ? `${path}?${queryString}` : path
  return apiFetch(url, { method: 'GET', ...options })
}

// Helper for POST requests
export async function apiPost(path, data = null, options = {}) {
  return apiFetch(path, {
    method: 'POST',
    body: data ? JSON.stringify(data) : null,
    ...options
  })
}

// Helper for PUT requests
export async function apiPut(path, data = null, options = {}) {
  return apiFetch(path, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : null,
    ...options
  })
}

// Helper for DELETE requests
export async function apiDelete(path, options = {}) {
  return apiFetch(path, { method: 'DELETE', ...options })
}


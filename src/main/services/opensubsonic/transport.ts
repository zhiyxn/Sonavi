import { session } from 'electron'

const MAX_RESPONSE_BYTES = 1024 * 1024

export interface TransportResponse {
  status: number
  contentType: string
  cloudflareMitigated: boolean
  body: string
}

export interface ApiTransport {
  request: (url: string, signal: AbortSignal) => Promise<TransportResponse>
}

export class ResponseLimitError extends Error {
  constructor() {
    super('response exceeded the configured size limit')
    this.name = 'ResponseLimitError'
  }
}

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let byteCount = 0
  let body = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    byteCount += value.byteLength
    if (byteCount > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new ResponseLimitError()
    }

    body += decoder.decode(value, { stream: true })
  }

  return body + decoder.decode()
}

export class ElectronSessionTransport implements ApiTransport {
  async request(url: string, signal: AbortSignal): Promise<TransportResponse> {
    const response = await session.defaultSession.fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'manual',
      referrerPolicy: 'no-referrer',
      signal
    })

    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      cloudflareMitigated: response.headers.get('cf-mitigated') === 'challenge',
      body: await readLimitedBody(response)
    }
  }
}

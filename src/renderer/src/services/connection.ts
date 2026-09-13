import type { ConnectionTestInput, ConnectionTestResult } from '../../../shared/connection'
import { ConnectionTestResultSchema } from '../../../shared/connection-schema'

export async function testConnection(input: ConnectionTestInput): Promise<ConnectionTestResult> {
  const rawResult: unknown = await window.sonavi.connection.test(input)
  return ConnectionTestResultSchema.parse(rawResult)
}

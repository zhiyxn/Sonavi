import type {
  ConnectionSuccessResult,
  ConnectionTestInput,
  ConnectionTestResult
} from '../../../shared/connection'
import {
  ConnectionTestResultSchema,
  RestoredConnectionResultSchema,
  SessionActionResultSchema
} from '../../../shared/connection-schema'

export async function testConnection(input: ConnectionTestInput): Promise<ConnectionTestResult> {
  const rawResult: unknown = await window.sonavi.connection.test(input)
  return ConnectionTestResultSchema.parse(rawResult)
}

export async function restoreConnection(): Promise<ConnectionSuccessResult | null> {
  return RestoredConnectionResultSchema.parse(await window.sonavi.connection.restore())
}

export async function disconnectConnection(sessionId: string): Promise<boolean> {
  return SessionActionResultSchema.parse(await window.sonavi.connection.disconnect(sessionId))
}

export async function forgetConnection(sessionId: string): Promise<boolean> {
  return SessionActionResultSchema.parse(await window.sonavi.connection.forget(sessionId))
}

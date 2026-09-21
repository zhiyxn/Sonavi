import type {
  ConnectionSuccessResult,
  ConnectionTestInput,
  ConnectionTestResult,
  SavedConnectionProfile
} from '../../../shared/connection'
import {
  ConnectionTestResultSchema,
  RestoredConnectionResultSchema,
  SavedConnectionProfilesSchema,
  SessionActionResultSchema
} from '../../../shared/connection-schema'

export async function testConnection(input: ConnectionTestInput): Promise<ConnectionTestResult> {
  const rawResult: unknown = await window.sonavi.connection.test(input)
  return ConnectionTestResultSchema.parse(rawResult)
}

export async function restoreConnection(): Promise<ConnectionSuccessResult | null> {
  return RestoredConnectionResultSchema.parse(await window.sonavi.connection.restore())
}

export async function listSavedConnections(): Promise<SavedConnectionProfile[]> {
  return SavedConnectionProfilesSchema.parse(await window.sonavi.connection.listSaved())
}

export async function connectSavedConnection(profileId: string): Promise<ConnectionTestResult> {
  return ConnectionTestResultSchema.parse(await window.sonavi.connection.connectSaved(profileId))
}

export async function deleteSavedConnection(profileId: string): Promise<boolean> {
  return SessionActionResultSchema.parse(await window.sonavi.connection.deleteSaved(profileId))
}

export async function disconnectConnection(sessionId: string): Promise<boolean> {
  return SessionActionResultSchema.parse(await window.sonavi.connection.disconnect(sessionId))
}

export async function forgetConnection(sessionId: string): Promise<boolean> {
  return SessionActionResultSchema.parse(await window.sonavi.connection.forget(sessionId))
}

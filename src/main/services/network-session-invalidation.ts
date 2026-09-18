export interface NetworkSessionInvalidationActions {
  cancelSearches: (sessionId: string) => void
  revokeMediaRequests: (sessionId: string) => void
  revokeMediaHandles: (sessionId: string) => void
}

export function invalidateNetworkSessionAfterSettingsUpdate(
  connectionsReset: boolean,
  sessionId: string | null,
  actions: NetworkSessionInvalidationActions
): boolean {
  if (!connectionsReset || !sessionId) return false
  actions.cancelSearches(sessionId)
  actions.revokeMediaRequests(sessionId)
  actions.revokeMediaHandles(sessionId)
  return true
}

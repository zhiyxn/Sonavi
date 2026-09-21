import { z } from 'zod'
import type {
  ConnectionSuccessResult,
  ConnectionTestInput,
  ConnectionTestResult
} from './connection'

export const ConnectionTestInputSchema = z.object({
  serverUrl: z.string().trim().min(1).max(2048),
  username: z.string().trim().min(1).max(256),
  password: z.string().min(1).max(4096),
  rememberMe: z.boolean(),
  allowInsecureHttp: z.boolean(),
  profileId: z.string().uuid().optional()
}) satisfies z.ZodType<ConnectionTestInput>

export const SavedConnectionProfileIdSchema = z.string().uuid()
export const SavedConnectionProfileSchema = z.object({
  id: SavedConnectionProfileIdSchema,
  serverUrl: z.string().url(),
  username: z.string().min(1).max(256),
  isDefault: z.boolean()
})
export const SavedConnectionProfilesSchema = z.array(SavedConnectionProfileSchema).max(20)

const ConnectionErrorCodeSchema = z.enum([
  'invalid-input',
  'insecure-http',
  'redirect',
  'network',
  'dns',
  'connection-refused',
  'timeout',
  'tls-certificate',
  'http-authentication',
  'http-forbidden',
  'server-error',
  'unexpected-content',
  'invalid-response',
  'response-too-large',
  'authentication',
  'authentication-method',
  'permission',
  'protocol-version',
  'server-response'
])

export const ConnectionTestResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    sessionId: z.string().uuid(),
    server: z.object({
      baseUrl: z.string().url(),
      protocolVersion: z.string().min(1),
      serverType: z.string().min(1).optional(),
      serverVersion: z.string().min(1).optional(),
      openSubsonic: z.boolean(),
      capabilityStatus: z.enum(['available', 'unavailable']),
      extensions: z.array(z.string().min(1)),
      musicFolders: z.array(
        z.object({
          id: z.string(),
          name: z.string()
        })
      )
    }),
    credentialPersistence: z.enum(['encrypted', 'session-only', 'not-requested']),
    profileId: SavedConnectionProfileIdSchema.optional()
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: ConnectionErrorCodeSchema,
      message: z.string().min(1),
      retryable: z.boolean()
    })
  })
]) satisfies z.ZodType<ConnectionTestResult>

export const ConnectionSuccessResultSchema =
  ConnectionTestResultSchema.options[0] satisfies z.ZodType<ConnectionSuccessResult>
export const RestoredConnectionResultSchema = ConnectionSuccessResultSchema.nullable()
export const SessionActionResultSchema = z.boolean()

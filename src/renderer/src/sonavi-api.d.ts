import type { SonaviApi } from '../../shared/application'

declare global {
  interface Window {
    sonavi: SonaviApi
  }
}

export {}

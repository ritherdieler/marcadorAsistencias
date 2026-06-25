type WorkerGlobal = typeof globalThis & {
  import?: (url: string) => Promise<unknown>
  ModuleFactory?: unknown
  document?: unknown
}

const workerGlobal = self as WorkerGlobal

if (typeof workerGlobal.document === 'undefined') {
  const documentHandler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'createElement') {
        return (tag: string) => {
          if (tag === 'canvas') return new OffscreenCanvas(1, 1)
          return {}
        }
      }
      return undefined
    },
    has() {
      return false
    },
  }
  workerGlobal.document = new Proxy({}, documentHandler) as Document
}

if (typeof workerGlobal.import !== 'function') {
  workerGlobal.import = async (url: string) => {
    const absoluteUrl = new URL(url, self.location.href).href
    const module = await import(/* @vite-ignore */ absoluteUrl)
    if (module && typeof module === 'object' && 'default' in module && module.default) {
      workerGlobal.ModuleFactory = module.default
    }
    return module
  }
}

export function mediapipeWasmBase(): string {
  return new URL('/mediapipe/wasm', self.location.origin).href.replace(/\/$/, '')
}

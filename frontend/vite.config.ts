import fs from 'node:fs/promises'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const silentClock = `{
        autoStart: true,
        startTime: 0,
        oldTime: 0,
        elapsedTime: 0,
        running: false,
        start() {
          this.startTime = performance.now();
          this.oldTime = this.startTime;
          this.elapsedTime = 0;
          this.running = true;
        },
        getElapsedTime() {
          this.getDelta();
          return this.elapsedTime;
        },
        stop() {
          this.getElapsedTime();
          this.running = false;
          this.autoStart = false;
        },
        getDelta() {
          if (this.autoStart && !this.running) {
            this.start();
            return 0;
          }
          if (!this.running) return 0;
          const newTime = performance.now();
          const diff = (newTime - this.oldTime) / 1000;
          this.oldTime = newTime;
          this.elapsedTime += diff;
          return diff;
        }
      }`

function patchFiberSource(code: string, filePath: string) {
  const path = filePath.replaceAll('\\', '/')
  let next = code
  if (path.endsWith('/react-three-fiber.esm.js')) {
    next = next
      .replace(
        'current == null ? void 0 : current.unmount();',
        `if (current) {
        const node = canvasRef.current;
        queueMicrotask(() => {
          if (node && node.isConnected) return;
          current.unmount();
        });
      }`,
      )
      .replace(
        'if (!canvas.isConnected) (_root$current = root.current) == null ? void 0 : _root$current.unmount();',
        `if (!canvas.isConnected) {
        const pending = root.current;
        queueMicrotask(() => {
          if (canvas.isConnected || pending == null) return;
          pending.unmount();
        });
      }`,
      )
  }
  if (path.includes(`${'/'}events-`) && path.endsWith('.esm.js')) {
    next = next.replace('clock: new THREE.Clock(),', `clock: ${silentClock},`)
  }
  return next
}

/**
 * React 19 rejects a root unmounted during its own commit, and Three r183 warns
 * when react-three-fiber still constructs THREE.Clock. The published bundle is
 * patched for both the dev prebundle and the production transform.
 */
function patchReactThreeFiber(): Plugin {
  return {
    name: 'patch-react-three-fiber',
    enforce: 'pre',
    config() {
      return {
        optimizeDeps: {
          rolldownOptions: {
            plugins: [
              {
                name: 'patch-r3f-rolldown',
                async load(id: string) {
                  const file = id.split('?')[0] ?? id
                  const path = file.replaceAll('\\', '/')
                  if (!path.includes('/@react-three/fiber/dist/') || !path.endsWith('.js')) return null
                  return patchFiberSource(await fs.readFile(file, 'utf8'), path)
                },
              },
            ],
          },
        },
      }
    },
    transform(code, id) {
      const path = id.split('?')[0]?.replaceAll('\\', '/') ?? ''
      if (!path.includes('/@react-three/fiber/dist/')) return null
      const next = patchFiberSource(code, path)
      return next === code ? null : next
    },
  }
}

export default defineConfig({
  plugins: [react(), patchReactThreeFiber()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})

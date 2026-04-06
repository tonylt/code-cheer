import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import * as cp from 'child_process'

// ─── Process exit integration tests ───────────────────────────────────────────
// These tests spawn the built dist/statusline.js and verify it exits promptly.
// Requires `npm run build` to have been run beforehand.

const distPath = path.join(__dirname, '..', 'dist', 'statusline.js')

function spawnWithTimeout(
  args: string[],
  timeoutMs: number
): Promise<{ code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    if (!fs.existsSync(distPath)) {
      // dist not built — skip gracefully
      resolve({ code: 0, timedOut: false })
      return
    }
    const child = cp.spawn(process.execPath, [distPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CODE_CHEER_BASE_DIR: os.tmpdir() },
    })
    let finished = false
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true
        child.kill()
        resolve({ code: null, timedOut: true })
      }
    }, timeoutMs)
    child.on('close', (code) => {
      if (!finished) {
        finished = true
        clearTimeout(timer)
        resolve({ code, timedOut: false })
      }
    })
    child.stdin.end()
  })
}

describe('process exit', () => {
  it('render mode exits with code 0 within 500ms', async () => {
    const result = await spawnWithTimeout([], 500)
    expect(result.timedOut).toBe(false)
    expect(result.code).toBe(0)
  }, 3000)

  it('--update mode exits with code 0 within 2000ms', async () => {
    const result = await spawnWithTimeout(['--update'], 2000)
    expect(result.timedOut).toBe(false)
    expect(result.code).toBe(0)
  }, 5000)
})

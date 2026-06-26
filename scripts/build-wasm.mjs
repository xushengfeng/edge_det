import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

console.log('Building WASM...')
execSync('wasm-pack build --target web --release', { cwd: root, stdio: 'inherit' })

const wasmPath = join(root, 'pkg', 'edge_det_bg.wasm')
const wasmBytes = readFileSync(wasmPath)
console.log(`WASM size: ${wasmBytes.length} bytes`)

const bytesStr = JSON.stringify(Array.from(wasmBytes))
const outPath = join(root, 'src_ts', 'wasm_bytes.ts')
writeFileSync(outPath, `export const WASM_BYTES = new Uint8Array(${bytesStr});\n`)
console.log(`Inlined WASM bytes to ${outPath}`)

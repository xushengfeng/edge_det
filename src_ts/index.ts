import {
  initSync,
  detect_borders,
  detect_borders_default,
} from '../pkg/edge_det.js'
import { WASM_BYTES } from './wasm_bytes'

export interface Border {
  x: number
  y: number
  w: number
  h: number
}

let _initialized = false

function ensureInit() {
  if (!_initialized) {
    initSync({ module: WASM_BYTES })
    _initialized = true
  }
}

export function detectBorders(
  data: Uint8Array,
  width: number,
  height: number,
  options?: { lowThreshold?: number; highThreshold?: number; minArea?: number }
): Border[] {
  ensureInit()
  const result = detect_borders(
    data,
    width,
    height,
    options?.lowThreshold ?? 20,
    options?.highThreshold ?? 60,
    options?.minArea ?? 100
  )
  const borders: Border[] = []
  for (let i = 0; i < result.length; i += 4) {
    borders.push({
      x: result[i],
      y: result[i + 1],
      w: result[i + 2],
      h: result[i + 3],
    })
  }
  return borders
}

export function detectBordersDefault(
  data: Uint8Array,
  width: number,
  height: number
): Border[] {
  ensureInit()
  const result = detect_borders_default(data, width, height)
  const borders: Border[] = []
  for (let i = 0; i < result.length; i += 4) {
    borders.push({
      x: result[i],
      y: result[i + 1],
      w: result[i + 2],
      h: result[i + 3],
    })
  }
  return borders
}

import { describe, it, expect } from 'vitest'
import * as PImage from 'pureimage'
import { detectBorders, detectBordersDefault, Border } from '../src_ts/index'

function createImage(
  w: number,
  h: number,
  draw: (ctx: PImage.Context) => void
): Uint8Array {
  const img = PImage.make(w, h, {})
  const ctx = img.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  draw(ctx)
  const buf = img.data
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = buf[i * 4]
    rgba[i * 4 + 1] = buf[i * 4 + 1]
    rgba[i * 4 + 2] = buf[i * 4 + 2]
    rgba[i * 4 + 3] = buf[i * 4 + 3]
  }
  return rgba
}

function drawRect(
  ctx: PImage.Context,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  lineWidth?: number
) {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth ?? 1
  ctx.strokeRect(x, y, w, h)
}

function fillRect(
  ctx: PImage.Context,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

function mergeBounds(borders: Border[]) {
  const m = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity }
  for (const b of borders) {
    m.x = Math.min(m.x, b.x)
    m.y = Math.min(m.y, b.y)
    m.x2 = Math.max(m.x2, b.x + b.w)
    m.y2 = Math.max(m.y2, b.y + b.h)
  }
  return m
}

function areaOf(b: Border) {
  return b.w * b.h
}

function coverage(borders: Border[], expected: { x: number; y: number; w: number; h: number }) {
  const merged = mergeBounds(borders)
  const ex = expected.x
  const ey = expected.y
  const ex2 = expected.x + expected.w
  const ey2 = expected.y + expected.h
  const iw = Math.max(0, Math.min(merged.x2, ex2) - Math.max(merged.x, ex))
  const ih = Math.max(0, Math.min(merged.y2, ey2) - Math.max(merged.y, ey))
  const inter = iw * ih
  const unionArea = (merged.x2 - merged.x) * (merged.y2 - merged.y) + expected.w * expected.h - inter
  return inter / unionArea
}

const TOL = 6

describe('detectBorders', () => {
  it('solid color → no borders', () => {
    const w = 80, h = 80
    const data = createImage(w, h, () => {})
    const borders = detectBorders(data, w, h)
    expect(borders.length).toBe(0)
  })

  it('white bg + gray filled rect (low contrast)', () => {
    const w = 200, h = 200
    const rect = { x: 30, y: 40, w: 80, h: 60 }
    const data = createImage(w, h, (ctx) => {
      fillRect(ctx, rect.x, rect.y, rect.w, rect.h, '#cccccc')
    })
    const borders = detectBorders(data, w, h, {
      lowThreshold: 8,
      highThreshold: 25,
      minArea: 20,
    })
    expect(borders.length).toBeGreaterThanOrEqual(1)
    const merged = mergeBounds(borders)
    expect(merged.x).toBeLessThanOrEqual(rect.x + TOL)
    expect(merged.y).toBeLessThanOrEqual(rect.y + TOL)
    expect(merged.x2).toBeGreaterThanOrEqual(rect.x + rect.w - TOL)
    expect(merged.y2).toBeGreaterThanOrEqual(rect.y + rect.h - TOL)
  })

  it('white bg + thin black 1px line rect', () => {
    const w = 200, h = 200
    const rect = { x: 20, y: 20, w: 100, h: 80 }
    const data = createImage(w, h, (ctx) => {
      drawRect(ctx, rect.x, rect.y, rect.w, rect.h, '#000000', 1)
    })
    const borders = detectBorders(data, w, h, {
      lowThreshold: 15,
      highThreshold: 45,
      minArea: 10,
    })
    expect(borders.length).toBeGreaterThanOrEqual(1)
    const merged = mergeBounds(borders)
    expect(merged.x).toBeLessThanOrEqual(rect.x + TOL)
    expect(merged.y).toBeLessThanOrEqual(rect.y + TOL)
    expect(merged.x2).toBeGreaterThanOrEqual(rect.x + rect.w - TOL)
    expect(merged.y2).toBeGreaterThanOrEqual(rect.y + rect.h - TOL)
  })

  it('white bg + thin black 2px line rect', () => {
    const w = 200, h = 200
    const rect = { x: 50, y: 30, w: 100, h: 120 }
    const data = createImage(w, h, (ctx) => {
      drawRect(ctx, rect.x, rect.y, rect.w, rect.h, '#000000', 2)
    })
    const borders = detectBorders(data, w, h, {
      lowThreshold: 15,
      highThreshold: 45,
      minArea: 10,
    })
    expect(borders.length).toBeGreaterThanOrEqual(1)
    const merged = mergeBounds(borders)
    expect(merged.x).toBeLessThanOrEqual(rect.x + TOL)
    expect(merged.y).toBeLessThanOrEqual(rect.y + TOL)
    expect(merged.x2).toBeGreaterThanOrEqual(rect.x + rect.w - TOL)
    expect(merged.y2).toBeGreaterThanOrEqual(rect.y + rect.h - TOL)
  })

  it('white bg + gray thin line rect (low contrast + thin)', () => {
    const w = 200, h = 200
    const rect = { x: 25, y: 25, w: 100, h: 100 }
    const data = createImage(w, h, (ctx) => {
      drawRect(ctx, rect.x, rect.y, rect.w, rect.h, '#999999', 1)
    })
    const borders = detectBorders(data, w, h, {
      lowThreshold: 5,
      highThreshold: 18,
      minArea: 10,
    })
    expect(borders.length).toBeGreaterThanOrEqual(1)
    const merged = mergeBounds(borders)
    expect(merged.x).toBeLessThanOrEqual(rect.x + TOL)
    expect(merged.y).toBeLessThanOrEqual(rect.y + TOL)
    expect(merged.x2).toBeGreaterThanOrEqual(rect.x + rect.w - TOL)
    expect(merged.y2).toBeGreaterThanOrEqual(rect.y + rect.h - TOL)
  })

  it('blue rect on gray bg (color)', () => {
    const w = 200, h = 200
    const rect = { x: 40, y: 30, w: 80, h: 60 }
    const data = createImage(w, h, (ctx) => {
      fillRect(ctx, 0, 0, w, h, '#555555')
      fillRect(ctx, rect.x, rect.y, rect.w, rect.h, '#0088ff')
    })
    const borders = detectBorders(data, w, h, {
      lowThreshold: 12,
      highThreshold: 35,
      minArea: 20,
    })
    expect(borders.length).toBeGreaterThanOrEqual(1)
    const merged = mergeBounds(borders)
    expect(merged.x).toBeLessThanOrEqual(rect.x + TOL)
    expect(merged.y).toBeLessThanOrEqual(rect.y + TOL)
    expect(merged.x2).toBeGreaterThanOrEqual(rect.x + rect.w - TOL)
    expect(merged.y2).toBeGreaterThanOrEqual(rect.y + rect.h - TOL)
  })

  it('two rects — count and area', () => {
    const w = 300, h = 300
    const r1 = { x: 20, y: 20, w: 60, h: 60 }
    const r2 = { x: 150, y: 120, w: 100, h: 80 }
    const data = createImage(w, h, (ctx) => {
      fillRect(ctx, r1.x, r1.y, r1.w, r1.h, '#cccccc')
      fillRect(ctx, r2.x, r2.y, r2.w, r2.h, '#cccccc')
    })
    const borders = detectBorders(data, w, h, {
      lowThreshold: 8,
      highThreshold: 25,
      minArea: 20,
    })
    expect(borders.length).toBe(2)
    const areas = borders.map(areaOf).sort((a, b) => a - b)
    const expectedAreas = [r1.w * r1.h, r2.w * r2.h].sort((a, b) => a - b)
    for (let i = 0; i < 2; i++) {
      expect(areas[i]).toBeGreaterThan(expectedAreas[i] * 0.5)
      expect(areas[i]).toBeLessThan(expectedAreas[i] * 2.5)
    }
  })

  it('two thin-line rects — count and area', () => {
    const w = 300, h = 300
    const r1 = { x: 20, y: 20, w: 80, h: 60 }
    const r2 = { x: 160, y: 100, w: 100, h: 80 }
    const data = createImage(w, h, (ctx) => {
      drawRect(ctx, r1.x, r1.y, r1.w, r1.h, '#000000', 2)
      drawRect(ctx, r2.x, r2.y, r2.w, r2.h, '#000000', 2)
    })
    const borders = detectBorders(data, w, h, {
      lowThreshold: 15,
      highThreshold: 45,
      minArea: 10,
    })
    expect(borders.length).toBeGreaterThanOrEqual(2)
    const sorted = [...borders].sort((a, b) => areaOf(a) - areaOf(b))
    const r1Area = r1.w * r1.h
    const r2Area = r2.w * r2.h
    expect(areaOf(sorted[sorted.length - 1])).toBeGreaterThan(r2Area * 0.3)
    expect(areaOf(sorted[sorted.length - 1])).toBeLessThan(r2Area * 3)
  })

  it('detectBordersDefault works', () => {
    const w = 200, h = 200
    const rect = { x: 30, y: 30, w: 100, h: 100 }
    const data = createImage(w, h, (ctx) => {
      fillRect(ctx, rect.x, rect.y, rect.w, rect.h, '#cccccc')
    })
    const borders = detectBordersDefault(data, w, h)
    expect(borders.length).toBeGreaterThanOrEqual(1)
  })
})

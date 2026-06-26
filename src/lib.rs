use wasm_bindgen::prelude::*;

const GAUSS: [f32; 5] = [1.0, 4.0, 6.0, 4.0, 1.0];
const GAUSS_SUM: f32 = 16.0;

fn grayscale(data: &[u8], w: usize, h: usize) -> Vec<f32> {
    let n = w * h;
    let mut g = vec![0.0f32; n];
    for i in 0..n {
        let o = i * 4;
        g[i] = 0.299 * data[o] as f32 + 0.587 * data[o + 1] as f32 + 0.114 * data[o + 2] as f32;
    }
    g
}

fn blur(img: &[f32], w: usize, h: usize) -> Vec<f32> {
    let mut tmp = vec![0.0f32; w * h];
    let mut out = vec![0.0f32; w * h];
    for y in 0..h {
        for x in 0..w {
            let mut s = 0.0f32;
            for k in 0usize..5 {
                let xx = ((x as i32) + k as i32 - 2).max(0).min(w as i32 - 1) as usize;
                s += img[y * w + xx] * GAUSS[k];
            }
            tmp[y * w + x] = s / GAUSS_SUM;
        }
    }
    for y in 0..h {
        for x in 0..w {
            let mut s = 0.0f32;
            for k in 0usize..5 {
                let yy = ((y as i32) + k as i32 - 2).max(0).min(h as i32 - 1) as usize;
                s += tmp[yy * w + x] * GAUSS[k];
            }
            out[y * w + x] = s / GAUSS_SUM;
        }
    }
    out
}

struct SobelResult {
    mag: Vec<f32>,
    dx: Vec<f32>,
    dy: Vec<f32>,
}

fn sobel(img: &[f32], w: usize, h: usize) -> SobelResult {
    let n = w * h;
    let mut mag = vec![0.0f32; n];
    let mut dx = vec![0.0f32; n];
    let mut dy = vec![0.0f32; n];
    for y in 1..h - 1 {
        for x in 1..w - 1 {
            let i = y * w + x;
            let sx = -img[i - w - 1] - 2.0 * img[i - 1] - img[i + w - 1]
                + img[i - w + 1] + 2.0 * img[i + 1] + img[i + w + 1];
            let sy = -img[i - w - 1] - 2.0 * img[i - w] - img[i - w + 1]
                + img[i + w - 1] + 2.0 * img[i + w] + img[i + w + 1];
            dx[i] = sx;
            dy[i] = sy;
            mag[i] = (sx * sx + sy * sy).sqrt();
        }
    }
    SobelResult { mag, dx, dy }
}

fn nms(result: &SobelResult, w: usize, h: usize) -> Vec<f32> {
    let mut out = vec![0.0f32; w * h];
    for y in 1..h - 1 {
        for x in 1..w - 1 {
            let i = y * w + x;
            let m = result.mag[i];
            if m < 0.5 {
                continue;
            }
            let gx = result.dx[i];
            let gy = result.dy[i];
            let abs_gx = gx.abs();
            let abs_gy = gy.abs();

            let (mut mag1, mut mag2) = (0.0f32, 0.0f32);
            if abs_gx > abs_gy {
                let t = abs_gy / abs_gx;
                if gx * gy > 0.0 {
                    mag1 = result.mag[i - w - 1] * (1.0 - t) + result.mag[i - w] * t;
                    mag2 = result.mag[i + w + 1] * (1.0 - t) + result.mag[i + w] * t;
                } else {
                    mag1 = result.mag[i - w + 1] * (1.0 - t) + result.mag[i - w] * t;
                    mag2 = result.mag[i + w - 1] * (1.0 - t) + result.mag[i + w] * t;
                }
            } else if abs_gy > 0.0 {
                let t = abs_gx / abs_gy;
                if gx * gy > 0.0 {
                    mag1 = result.mag[i - w - 1] * (1.0 - t) + result.mag[i - 1] * t;
                    mag2 = result.mag[i + w + 1] * (1.0 - t) + result.mag[i + 1] * t;
                } else {
                    mag1 = result.mag[i - w + 1] * (1.0 - t) + result.mag[i + 1] * t;
                    mag2 = result.mag[i + w - 1] * (1.0 - t) + result.mag[i - 1] * t;
                }
            }
            out[i] = if m >= mag1 && m >= mag2 { m } else { 0.0 };
        }
    }
    out
}

fn hysteresis(edges: &mut [u8], w: usize, h: usize) {
    let mut stack: Vec<(i32, i32)> = Vec::new();
    for y in 0..h {
        for x in 0..w {
            if edges[y * w + x] == 2 {
                stack.push((x as i32, y as i32));
            }
        }
    }
    while let Some((x, y)) = stack.pop() {
        for dy in -1..=1 {
            for dx in -1..=1 {
                let nx = x + dx;
                let ny = y + dy;
                if nx >= 0 && nx < w as i32 && ny >= 0 && ny < h as i32 {
                    let ni = (ny * w as i32 + nx) as usize;
                    if edges[ni] == 1 {
                        edges[ni] = 2;
                        stack.push((nx, ny));
                    }
                }
            }
        }
    }
    for e in edges.iter_mut() {
        if *e == 1 {
            *e = 0;
        }
    }
}

struct UF {
    p: Vec<usize>,
    r: Vec<u8>,
}

impl UF {
    fn new(n: usize) -> Self {
        Self {
            p: (0..n).collect(),
            r: vec![0; n],
        }
    }
    fn find(&mut self, x: usize) -> usize {
        if self.p[x] != x {
            self.p[x] = self.find(self.p[x]);
        }
        self.p[x]
    }
    fn union(&mut self, a: usize, b: usize) {
        let ra = self.find(a);
        let rb = self.find(b);
        if ra == rb {
            return;
        }
        if self.r[ra] < self.r[rb] {
            self.p[ra] = rb;
        } else if self.r[ra] > self.r[rb] {
            self.p[rb] = ra;
        } else {
            self.p[rb] = ra;
            self.r[ra] += 1;
        }
    }
}

fn bounding_boxes(edges: &[u8], w: usize, h: usize, min_area: usize) -> Vec<[i32; 4]> {
    let n = w * h;
    let mut uf = UF::new(n);
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if edges[i] == 0 {
                continue;
            }
            if x + 1 < w && edges[i + 1] != 0 {
                uf.union(i, i + 1);
            }
            if y + 1 < h && edges[i + w] != 0 {
                uf.union(i, i + w);
            }
            if x + 1 < w && y + 1 < h && edges[i + w + 1] != 0 {
                uf.union(i, i + w + 1);
            }
            if x > 0 && y + 1 < h && edges[i + w - 1] != 0 {
                uf.union(i, i + w - 1);
            }
        }
    }
    let mut x0 = vec![w as i32; n];
    let mut y0 = vec![h as i32; n];
    let mut x1 = vec![0i32; n];
    let mut y1 = vec![0i32; n];
    let mut cnt = vec![0usize; n];
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if edges[i] == 0 {
                continue;
            }
            let r = uf.find(i);
            x0[r] = x0[r].min(x as i32);
            y0[r] = y0[r].min(y as i32);
            x1[r] = x1[r].max(x as i32);
            y1[r] = y1[r].max(y as i32);
            cnt[r] += 1;
        }
    }
    let mut boxes: Vec<[i32; 4]> = Vec::new();
    for i in 0..n {
        if cnt[i] >= min_area {
            boxes.push([x0[i], y0[i], x1[i] - x0[i] + 1, y1[i] - y0[i] + 1]);
        }
    }
    boxes.sort_by(|a, b| (b[2] * b[3]).cmp(&(a[2] * a[3])));
    boxes
}

fn color_gradient(data: &[u8], w: usize, h: usize) -> SobelResult {
    let n = w * h;
    let mut r_ch = vec![0.0f32; n];
    let mut g_ch = vec![0.0f32; n];
    let mut b_ch = vec![0.0f32; n];
    for i in 0..n {
        let o = i * 4;
        r_ch[i] = data[o] as f32;
        g_ch[i] = data[o + 1] as f32;
        b_ch[i] = data[o + 2] as f32;
    }
    let rb = blur(&r_ch, w, h);
    let gb = blur(&g_ch, w, h);
    let bb = blur(&b_ch, w, h);

    let mut mag = vec![0.0f32; n];
    let mut dx = vec![0.0f32; n];
    let mut dy = vec![0.0f32; n];
    for y in 1..h - 1 {
        for x in 1..w - 1 {
            let i = y * w + x;
            let dr_x = rb[i + 1] - rb[i - 1];
            let dg_x = gb[i + 1] - gb[i - 1];
            let db_x = bb[i + 1] - bb[i - 1];
            let dr_y = rb[i + w] - rb[i - w];
            let dg_y = gb[i + w] - gb[i - w];
            let db_y = bb[i + w] - bb[i - w];
            let sx = (dr_x * dr_x + dg_x * dg_x + db_x * db_x).sqrt();
            let sy = (dr_y * dr_y + dg_y * dg_y + db_y * db_y).sqrt();
            let sign_x = if dr_x + dg_x + db_x >= 0.0 { 1.0 } else { -1.0 };
            let sign_y = if dr_y + dg_y + db_y >= 0.0 { 1.0 } else { -1.0 };
            dx[i] = sx * sign_x;
            dy[i] = sy * sign_y;
            mag[i] = (sx * sx + sy * sy).sqrt();
        }
    }
    SobelResult { mag, dx, dy }
}

fn merge_and_threshold(
    gray_sup: &[f32],
    color_sup: &[f32],
    w: usize,
    h: usize,
    lo: f32,
    hi: f32,
) -> Vec<u8> {
    let n = w * h;
    let mut out = vec![0u8; n];
    for i in 0..n {
        let v = gray_sup[i].max(color_sup[i]);
        if v >= hi {
            out[i] = 2;
        } else if v >= lo {
            out[i] = 1;
        }
    }
    out
}

#[wasm_bindgen]
pub fn detect_borders(
    data: &[u8],
    width: usize,
    height: usize,
    low_threshold: f32,
    high_threshold: f32,
    min_area: usize,
) -> Vec<f32> {
    let gray = grayscale(data, width, height);
    let blurred = blur(&gray, width, height);
    let gray_sobel = sobel(&blurred, width, height);
    let gray_sup = nms(&gray_sobel, width, height);

    let color_sobel = color_gradient(data, width, height);
    let color_sup = nms(&color_sobel, width, height);

    let mut edges = merge_and_threshold(
        &gray_sup,
        &color_sup,
        width,
        height,
        low_threshold,
        high_threshold,
    );
    hysteresis(&mut edges, width, height);

    let boxes = bounding_boxes(&edges, width, height, min_area);
    let mut out = Vec::with_capacity(boxes.len() * 4);
    for b in &boxes {
        out.push(b[0] as f32);
        out.push(b[1] as f32);
        out.push(b[2] as f32);
        out.push(b[3] as f32);
    }
    out
}

#[wasm_bindgen]
pub fn detect_borders_default(data: &[u8], width: usize, height: usize) -> Vec<f32> {
    detect_borders(data, width, height, 20.0, 60.0, 100)
}

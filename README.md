# edge_det

纯 Rust/WASM 实现的 UI 边框检测，无需 OpenCV 依赖。WASM 体积约 31KB，内嵌于 JS 文件中。

## 安装

```bash
pnpm add edge_det
```

## 使用

```ts
import { detectBorders } from 'edge_det'

const borders = detectBorders(imageData, width, height, {
  lowThreshold: 20,
  highThreshold: 60,
  minArea: 100,
})

for (const { x, y, w, h } of borders) {
  console.log(`边框位于 (${x},${y})，尺寸 ${w}x${h}`)
}
```

### API

```ts
function detectBorders(
  data: Uint8Array,     // RGBA 像素数据
  width: number,
  height: number,
  options?: {
    lowThreshold?: number   // Canny 低阈值，默认 20
    highThreshold?: number  // Canny 高阈值，默认 60
    minArea?: number        // 最小边框面积，默认 100
  }
): Border[]

function detectBordersDefault(
  data: Uint8Array,
  width: number,
  height: number
): Border[]

interface Border {
  x: number
  y: number
  w: number
  h: number
}
```

## 构建

```bash
pnpm build:wasm   # Rust → WASM + 内联为 JS
pnpm build         # 完整构建（wasm + tsc）
pnpm test          # 运行测试
```

## 算法

当前流程：

```
RGBA 输入
  ├─ 灰度通道 → 高斯模糊 → Sobel（幅值 + dx/dy）→ NMS（双线性插值）
  └─ RGB 三通道 → 逐通道模糊 → 颜色梯度（幅值 + dx/dy）→ NMS
       ↓ 取两路最大值
     滞后阈值化 → 连通域分析（Union-Find）→ 包围盒输出
```

## 改进方向

### 1. 形态学闭合
在边缘检测前做膨胀 + 腐蚀，填补边缘中的小间隙，让轮廓更连贯。

### 2. 多尺度边缘融合
在不同高斯 sigma 下运行 Canny，合并结果以同时捕获细边缘和粗边缘。

### 3. Suzuki85 轮廓追踪
用 Suzuki85 算法（即 OpenCV `findContours` 的实现）替代 Union-Find，支持轮廓层级（RETR_CCOMP）。

### 4. 自适应阈值
根据局部梯度统计动态计算每个区域的阈值，替代全局固定阈值。

### 5. 多边形轮廓输出
返回轮廓点数组而非仅包围盒，获得更精确的形状表示。

### 6. Harris 角点评分
用 Harris 角点检测对轮廓打分，过滤非矩形轮廓。

### 7. WebGPU 加速
对大图（>2MP）将 Sobel + NMS 卸载到 compute shader。

## 许可证

Apache-2.0

/**
 * A simple O generator component.
 * Generates unique, symmetric, typographic O shapes on a 32x32, 64x64 or
 * 128x128 grid, selectable via a submenu. Each O varies in size, x/y-axis
 * proportions and roundness, but stays centered so the result always reads
 * as a clean, symmetric O. Higher resolutions round out into cleaner,
 * more geometric circles.
 *
 * Two modes:
 * - list: every generated O is stacked below the button and can be downloaded as a PNG.
 * - o-mode: every generated O drifts gently inside a 150x180 container, always
 *   avoiding a reserved O-shaped area. The more O's added, the clearer the
 *   negative-space O becomes. The composition can be downloaded as a PNG.
 *
 * @version 1.0.0
 * @author Oliver Woodhouse <woodhouse.oliver@gmail.com>
 */

class OGenerator extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.gridSize = 32 // Current grid resolution, changeable via the resolution submenu
    this.displaySize = 256 // Fixed total canvas display size in px (cell size = displaySize / gridSize)
    this.count = 0 // Number of O's generated so far, at the current resolution
    this.seen = new Set() // Tracks parameter signatures to avoid exact duplicates

    // Higher resolutions get a narrower, lower power range, so the O's
    // round out into cleaner, more geometric circles as pixel count grows.
    this.resolutionConfig = {
      32: { powerMin: 2, powerMax: 6 },
      64: { powerMin: 2, powerMax: 4 },
      128: { powerMin: 1.8, powerMax: 2.5 }
    }

    // O-mode
    this.mode = 'list' // 'list' or 'o-mode'
    this.containerW = 150 // O-mode container width in logical units
    this.containerH = 180 // O-mode container height in logical units
    this.renderScale = 4 // Canvas pixels per logical unit (canvas is 600x720, also the size of the downloaded PNG)
    this.floaterSize = { min: 10, max: 24 } // Target size range of each drifting O, logical units
    this.floaters = [] // All O's placed in the container
    this.rafId = null // Current animation frame request
    this.reducedMotion = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

    // The reserved negative-space O, centered in the container. The ratio
    // (rx / ry ≈ 1.18) is measured from the reference O. Thickness is slightly
    // bolder than the reference so it still reads among the small O's.
    this.negativeO = { rx: 64, ry: 54, thickness: 6 }
  }

  /**
   * Called whenever the element is removed from the DOM.
   * Stops the O-mode animation loop.
   */
  disconnectedCallback() {
    this.stopAnimation()
  }

  /**
   * Called whenever the element is added to the DOM.
   * Renders the template and sets up event listeners.
   */
  connectedCallback() {
    this.render()
    this.setUpEventListeners()
  }

  /**
   * Renders the HTML template and styles into the shadow DOM.
   */
  render() {
    this.shadowRoot.innerHTML = `
        <style>

        :host {
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica', 'Arial', sans-serif;
  background-color: #ffffff;
}

.container {
  min-height: 100vh;
  padding: 2rem;
  background-color: #ffffff;
}

.inner {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  text-align: left;
  margin-bottom: 3rem;
}

h1 {
  font-size: 4.2rem;
  font-family: 'Coral Pixels', sans-serif;
  font-weight: 400;
  color: #000000;
  margin: 0 0 1rem 0;
  line-height: 1.4;
  padding: 0.5rem;
}

.subtitle {
  background-color: red;
  color: #ffffff;
  font-size: 1rem;
  line-height: 1.6;
  font-weight: 500;
  padding: 0.5rem;
}

.submenu {
  background: transparent;
  box-shadow: none;
  padding: 1rem 0;
  margin-bottom: 1rem;
  border-top: 1px solid #000000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.submenu-label {
  font-size: 0.9rem;
  color: #000000;
}

.res-btn,
.mode-btn {
  background: transparent;
  color: #000000;
  border: 1px solid #000000;
  font-weight: 400;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s, color 0.2s;
}

.res-btn:hover,
.mode-btn:hover {
  background: #000000;
  color: #ffffff;
}

.res-btn.active,
.mode-btn.active {
  background: blue;
  color: #ffffff;
  border-color: blue;
}

.actions {
  background: transparent;
  box-shadow: none;
  padding: 1rem 0;
  margin-bottom: 2rem;
  border-bottom: 1px solid #000000;
  display: flex;
  gap: 1rem;
}

.generate-btn {
  width: auto;
  background-color: blue;
  color: white;
  border: none;
  font-weight: 400;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s, color 0.2s;
}

.generate-btn:hover {
  background: #030c4a;
  color: #ffffff;
}

.download-all-btn {
  width: auto;
  background: #0bf273;
  color: white;
  border: none;
  font-weight: 400;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s, color 0.2s;
}

.download-all-btn:hover {
  background: #067b37;
  color: #ffffff;
}

.hidden {
  display: none;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.o-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid #000000;
  padding-bottom: 1.5rem;
}

.o-item canvas {
  border: 1px solid #000000;
  background: #ffffff;
  image-rendering: pixelated;
}

.o-label {
  font-size: 0.85rem;
  color: #000000;
  min-width: 4rem;
}

.o-download-btn {
  background: transparent;
  color: #000000;
  border: 1px solid #000000;
  font-weight: 400;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s, color 0.2s;
}

.o-download-btn:hover {
  background: #000000;
  color: #ffffff;
}

.omode-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.omode-count {
  font-size: 0.85rem;
  color: #000000;
}

.omode-canvas {
  display: block;
  width: 450px; /* 150 logical units shown at 3x */
  max-width: 100%;
  height: auto;
  aspect-ratio: 150 / 180;
  border: 1px solid #000000;
  background: #ffffff;
}

      </style>

      <div class="container">
        <div class="inner">
          <div class="header">
            <h1>O GENERATOR by O liver w OO dh O use</h1>
            <p class="subtitle">welcome to this wonderful o-generator. the o-generator generates a unique, symmetric o every time you press generate. size, x-axis and y-axis proportions and roundness vary, but each o stays centered on its grid so it always reads as a clean (sort of) symmetrical, typographic o. higher resolutions round out into cleaner, more geometric circles. <br> in LIST MODE every generated o is stacked below and can be downloaded as a png. in O-MODE all o's drift around a 150×180 container and leave an o-shaped negative space in the middle, meaning, the more o's you add, the clearer the O. By O liver w OO dh O use</p>
          </div>

          <div class="submenu" id="modeMenu">
            <span class="submenu-label">mode:</span>
            <button class="mode-btn active" data-mode="list">list</button>
            <button class="mode-btn" data-mode="o-mode">o-mode</button>
          </div>

          <div class="submenu" id="submenu">
            <span class="submenu-label">grid:</span>
            <button class="res-btn active" data-size="32">32×32</button>
            <button class="res-btn" data-size="64">64×64</button>
            <button class="res-btn" data-size="128">128×128</button>
          </div>

          <div class="actions">
            <button class="generate-btn" id="generateBtn">generate o</button>
            <button class="download-all-btn hidden" id="downloadAllBtn">download all</button>
          </div>

          <div class="results" id="results"></div>

          <div class="omode hidden" id="omode">
            <div class="omode-bar">
              <button class="download-all-btn" id="downloadOModeBtn">download image</button>
              <button class="o-download-btn" id="addTenBtn">add 10 o</button>
              <button class="o-download-btn" id="clearOModeBtn">clear</button>
              <span class="omode-count" id="omodeCount">0 o's</span>
            </div>
            <canvas id="omodeCanvas" class="omode-canvas"></canvas>
          </div>
        </div>
      </div>
        `
  }

  /**
   * Sets up event listeners for the generate, download and submenu buttons.
   */
  setUpEventListeners() {
    const generateBtn = this.shadowRoot.getElementById('generateBtn')
    const downloadAllBtn = this.shadowRoot.getElementById('downloadAllBtn')
    const resButtons = this.shadowRoot.querySelectorAll('.res-btn')
    const modeButtons = this.shadowRoot.querySelectorAll('.mode-btn')

    generateBtn.addEventListener('click', () => this.generateO())
    downloadAllBtn.addEventListener('click', () => this.downloadAll())

    resButtons.forEach(btn => {
      btn.addEventListener('click', () => this.setResolution(parseInt(btn.dataset.size), btn, resButtons))
    })

    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode, btn, modeButtons))
    })

    // O-mode controls
    const canvas = this.shadowRoot.getElementById('omodeCanvas')
    canvas.width = this.containerW * this.renderScale
    canvas.height = this.containerH * this.renderScale

    this.shadowRoot.getElementById('downloadOModeBtn').addEventListener('click', () => this.downloadOMode())
    this.shadowRoot.getElementById('clearOModeBtn').addEventListener('click', () => this.clearOMode())
    this.shadowRoot.getElementById('addTenBtn').addEventListener('click', () => {
      for (let i = 0; i < 10; i++) this.generateO()
    })
  }

  /**
   * Switches between list mode and o-mode. Each mode keeps its own content,
   * so switching back and forth does not lose anything.
   * @param {string} mode - 'list' or 'o-mode'
   * @param {HTMLElement} activeBtn - the clicked submenu button
   * @param {NodeList} allButtons - all mode buttons, for active-state toggling
   */
  setMode(mode, activeBtn, allButtons) {
    this.mode = mode
    const isOMode = mode === 'o-mode'

    allButtons.forEach(b => b.classList.remove('active'))
    activeBtn.classList.add('active')

    this.shadowRoot.getElementById('results').classList.toggle('hidden', isOMode)
    this.shadowRoot.getElementById('omode').classList.toggle('hidden', !isOMode)
    this.shadowRoot.getElementById('downloadAllBtn').classList.toggle('hidden', isOMode || this.count === 0)

    // Only animate while o-mode is visible
    if (isOMode && this.floaters.length > 0) {
      this.requestDraw()
    } else {
      this.stopAnimation()
    }
  }

  /**
   * Switches the active grid resolution. Clears previously generated O's
   * since mixing resolutions in one list would be inconsistent.
   * @param {number} size - 32, 64 or 128
   * @param {HTMLElement} activeBtn - the clicked submenu button
   * @param {NodeList} allButtons - all submenu buttons, for active-state toggling
   */
  setResolution(size, activeBtn, allButtons) {
    this.gridSize = size
    this.count = 0
    this.seen.clear()

    this.shadowRoot.getElementById('results').innerHTML = ''
    this.shadowRoot.getElementById('downloadAllBtn').classList.add('hidden')
    this.clearOMode()

    allButtons.forEach(b => b.classList.remove('active'))
    activeBtn.classList.add('active')
  }

  /**
   * Generates one new unique O. In list mode it is appended to the results
   * list, in o-mode it is placed in the container.
   */
  generateO() {
    const params = this.randomParams()
    const grid = this.buildGrid(params)

    if (this.mode === 'o-mode') {
      this.addFloater(grid)
      return
    }

    const canvas = this.drawGrid(grid)

    this.count++
    this.addResult(canvas)

    this.shadowRoot.getElementById('downloadAllBtn').classList.remove('hidden')
  }

  /**
   * Produces a random, uniqueish set of parameters for one O.
   * Retries a few times on an exact repeat, then gives up and accepts it
   * (two truly identical O's are extremely unlikely anyway).
   * @returns {Object} { scaleX, scaleY, thicknessPx, power }
   */
  randomParams() {
    const { powerMin, powerMax } = this.resolutionConfig[this.gridSize]
    let params
    let signature
    let attempts = 0

    do {
      params = {
        scaleX: this.randomBetween(0.55, 1.0), // Horizontal reach, fraction of max radius
        scaleY: this.randomBetween(0.55, 1.0), // Vertical reach, fraction of max radius
        thicknessPx: this.randomBetween(1, 4), // Ring thickness in grid cells — mostly thin like Cardinal Tech, with room for slightly bolder ones
        power: this.randomBetween(powerMin, powerMax) // Superellipse exponent: lower = rounder/more geometric
      }
      signature = Object.values(params).map(v => v.toFixed(2)).join('|')
      attempts++
    } while (this.seen.has(signature) && attempts < 20)

    this.seen.add(signature)
    return params
  }

  /**
   * Returns a random float between min and max.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  randomBetween(min, max) {
    return min + Math.random() * (max - min)
  }

  /**
   * Builds a boolean 32x32 grid representing the O ring.
   * Uses a superellipse distance from the (fixed) grid center, so the
   * result is always symmetric on both the x and y axis.
   * @param {Object} params - { scaleX, scaleY, thicknessPx, power }
   * @returns {boolean[][]} grid[y][x] = true where the O should be filled
   */
  buildGrid(params) {
    const { scaleX, scaleY, thicknessPx, power } = params
    const size = this.gridSize
    const center = (size - 1) / 2
    const margin = Math.max(2, Math.round(size / 16)) // Small margin from the grid edge, scaled with size
    const maxRadius = center - margin
    const radiusX = maxRadius * scaleX
    const radiusY = maxRadius * scaleY
    const avgRadius = (radiusX + radiusY) / 2
    const thickness = thicknessPx / avgRadius // Convert the fixed pixel thickness to a fraction of the radius

    const grid = []

    for (let y = 0; y < size; y++) {
      const row = []
      for (let x = 0; x < size; x++) {
        const dx = Math.abs(x - center) / radiusX
        const dy = Math.abs(y - center) / radiusY
        const dist = Math.pow(Math.pow(dx, power) + Math.pow(dy, power), 1 / power)
        const isRing = dist <= 1 && dist >= 1 - thickness
        row.push(isRing)
      }
      grid.push(row)
    }

    return grid
  }

  /**
   * Draws a boolean grid onto a new canvas, one block per grid cell.
   * @param {boolean[][]} grid
   * @returns {HTMLCanvasElement}
   */
  drawGrid(grid) {
    const size = this.gridSize
    const cellPx = this.displaySize / size // Keeps every resolution at the same on-screen size

    const canvas = document.createElement('canvas')
    canvas.width = size * cellPx
    canvas.height = size * cellPx

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height) // Transparent background, preserved in the exported PNG
    ctx.fillStyle = '#d1d0d0'

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (grid[y][x]) {
          ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx)
        }
      }
    }

    return canvas
  }

  /**
   * Appends a rendered O (with label and per-item download button) below
   * the previous ones, in generation order.
   * @param {HTMLCanvasElement} canvas
   */
  addResult(canvas) {
    const results = this.shadowRoot.getElementById('results')

    const item = document.createElement('div')
    item.className = 'o-item'

    const label = document.createElement('span')
    label.className = 'o-label'
    label.textContent = `o_${String(this.count).padStart(3, '0')}`

    const downloadBtn = document.createElement('button')
    downloadBtn.className = 'o-download-btn'
    downloadBtn.textContent = 'download'
    downloadBtn.addEventListener('click', () => this.downloadCanvas(canvas, label.textContent))

    item.appendChild(canvas)
    item.appendChild(label)
    item.appendChild(downloadBtn)

    results.appendChild(item)
  }

  /**
   * Triggers a PNG download of a single canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {string} name - filename without extension
   */
  downloadCanvas(canvas, name) {
    const link = document.createElement('a')
    link.download = `${name}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  /**
   * Downloads every generated O as a separate PNG file.
   * Spaced out slightly since browsers can block many simultaneous
   * downloads triggered from a single click.
   */
  downloadAll() {
    const items = this.shadowRoot.querySelectorAll('.o-item')

    items.forEach((item, i) => {
      const canvas = item.querySelector('canvas')
      const label = item.querySelector('.o-label').textContent
      setTimeout(() => this.downloadCanvas(canvas, label), i * 150)
    })
  }

  /**
   * Turns a boolean grid into a small sprite: the grid cropped to the O's
   * tight bounding box (1 canvas pixel per grid cell), plus a set of sample
   * points along the ring that is used for the collision checks.
   * @param {boolean[][]} grid
   * @returns {Object|null} { canvas, cellsW, cellsH, points } or null if the grid is empty
   */
  makeSprite(grid) {
    const size = this.gridSize
    const cells = []
    let minX = size, minY = size, maxX = -1, maxY = -1

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!grid[y][x]) continue
        cells.push([x, y])
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }

    if (cells.length === 0) return null

    const cellsW = maxX - minX + 1
    const cellsH = maxY - minY + 1

    const canvas = document.createElement('canvas')
    canvas.width = cellsW
    canvas.height = cellsH
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#a5a5a5'
    cells.forEach(([x, y]) => ctx.fillRect(x - minX, y - minY, 1, 1))

    // Evenly spaced sample points along the ring, as fractions of the sprite size (-0.5 to 0.5)
    const stride = Math.max(1, Math.ceil(cells.length / 96))
    const points = []
    for (let i = 0; i < cells.length; i += stride) {
      const [x, y] = cells[i]
      points.push({
        u: (x - minX + 0.5) / cellsW - 0.5,
        v: (y - minY + 0.5) / cellsH - 0.5
      })
    }

    return { canvas, cellsW, cellsH, points }
  }

  /**
   * Picks how many canvas pixels each grid cell should cover for a target size.
   * At 1 or above it is rounded to a whole number, so the pixels stay crisp and
   * even. Below 1 the sprite is scaled down smoothly instead.
   * @param {Object} sprite
   * @param {number} targetSize - wanted size of the O's longest side, logical units
   * @returns {number} canvas pixels per grid cell
   */
  pixelScale(sprite, targetSize) {
    const longest = Math.max(sprite.cellsW, sprite.cellsH)
    const scale = (targetSize * this.renderScale) / longest
    return scale >= 1 ? Math.max(1, Math.round(scale)) : scale
  }

  /**
   * Places a new O in the container and starts drawing it.
   * @param {boolean[][]} grid
   */
  addFloater(grid) {
    const sprite = this.makeSprite(grid)
    if (!sprite) return

    const placement = this.findPlacement(sprite)
    if (!placement) {
      this.updateOModeCount(true)
      return
    }

    this.floaters.push({
      sprite,
      ...placement,
      freqX: this.randomBetween(9.1, 4.9), // Slow drift, radians per second
      freqY: this.randomBetween(0.25, 0.7),
      phaseX: this.randomBetween(0, Math.PI * 2),
      phaseY: this.randomBetween(0, Math.PI * 2)
    })

    this.updateOModeCount()
    this.requestDraw()
  }

  /**
   * Finds a free spot for a sprite. Tries a random size first, then smaller
   * and smaller ones so the O's can fill the gaps as the container gets full.
   * If it is still crowded it accepts overlaps between O's, but never
   * anything that touches the negative-space O.
   * @param {Object} sprite
   * @returns {Object|null} { homeX, homeY, w, h, scale, ampX, ampY } or null
   */
  findPlacement(sprite) {
    const { min, max } = this.floaterSize
    const baseSize = this.randomBetween(min, max)
    const shrinkSteps = [1, 0.8, 0.62, 0.48, 0.36]

    for (const factor of shrinkSteps) {
      const scale = this.pixelScale(sprite, baseSize * factor)
      const found = this.tryPlace(sprite, scale, 60, true)
      if (found) return found
    }

    const smallest = this.pixelScale(sprite, baseSize * shrinkSteps[shrinkSteps.length - 1])
    return this.tryPlace(sprite, smallest, 200, false)
  }

  /**
   * Tries random positions for a sprite at a given scale.
   * The drift range (amp) is included in every check, so an O can never
   * drift into the negative space or out of the container.
   * @param {Object} sprite
   * @param {number} scale - canvas pixels per grid cell
   * @param {number} attempts - number of random positions to try
   * @param {boolean} avoidOverlap - also avoid the other O's
   * @returns {Object|null}
   */
  tryPlace(sprite, scale, attempts, avoidOverlap) {
    const w = (sprite.cellsW * scale) / this.renderScale
    const h = (sprite.cellsH * scale) / this.renderScale
    const ampX = this.randomBetween(1, 2.2) // How far it drifts, logical units
    const ampY = this.randomBetween(1, 2.2)

    for (let i = 0; i < attempts; i++) {
      const x = this.randomBetween(w / 2 + ampX, this.containerW - w / 2 - ampX)
      const y = this.randomBetween(h / 2 + ampY, this.containerH - h / 2 - ampY)

      if (this.intersectsNegativeO(sprite, x, y, w, h, ampX, ampY)) continue
      if (avoidOverlap && this.overlapsFloaters(x, y, w, h, ampX, ampY)) continue

      return { homeX: x, homeY: y, w, h, scale, ampX, ampY }
    }

    return null
  }

  /**
   * Checks if a point is inside the reserved O-shaped area, i.e. between the
   * outer and inner ellipse of the negative-space O.
   * @param {number} x - logical units
   * @param {number} y - logical units
   * @returns {boolean}
   */
  isInNegativeO(x, y) {
    const { rx, ry, thickness } = this.negativeO
    const dx = x - this.containerW / 2
    const dy = y - this.containerH / 2

    const inOuter = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
    const irx = rx - thickness
    const iry = ry - thickness
    const inInner = (dx * dx) / (irx * irx) + (dy * dy) / (iry * iry) < 1

    return inOuter && !inInner
  }

  /**
   * Checks if any part of a sprite's ring, anywhere in its drift range,
   * touches the negative-space O.
   * @returns {boolean}
   */
  intersectsNegativeO(sprite, x, y, w, h, ampX, ampY) {
    const offsets = [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]

    for (const p of sprite.points) {
      const px = x + p.u * w
      const py = y + p.v * h

      for (const [ox, oy] of offsets) {
        if (this.isInNegativeO(px + ox * ampX, py + oy * ampY)) return true
      }
    }

    return false
  }

  /**
   * Checks if a sprite (including its drift range) would overlap an O that
   * is already placed. Each O is treated as an ellipse.
   * @returns {boolean}
   */
  overlapsFloaters(x, y, w, h, ampX, ampY) {
    const gap = 0.5

    return this.floaters.some(f => {
      const a = w / 2 + ampX + f.w / 2 + f.ampX + gap
      const b = h / 2 + ampY + f.h / 2 + f.ampY + gap
      const dx = x - f.homeX
      const dy = y - f.homeY
      return (dx * dx) / (a * a) + (dy * dy) / (b * b) < 1
    })
  }

  /**
   * Starts the animation loop if it is not already running.
   * With reduced motion enabled the O's are drawn still instead.
   */
  requestDraw() {
    if (this.reducedMotion) {
      this.drawOMode(0)
      return
    }

    if (this.rafId !== null) return

    const step = (time) => {
      this.drawOMode(time / 1000)
      this.rafId = requestAnimationFrame(step)
    }
    this.rafId = requestAnimationFrame(step)
  }

  /**
   * Stops the animation loop.
   */
  stopAnimation() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  /**
   * Draws every O at its current drifting position. The background stays
   * transparent, so the downloaded PNG is transparent too.
   * @param {number} t - time in seconds
   */
  drawOMode(t) {
    const canvas = this.shadowRoot.getElementById('omodeCanvas')
    const ctx = canvas.getContext('2d')
    const s = this.renderScale

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingQuality = 'high'

    this.floaters.forEach(f => {
      const x = f.homeX + Math.sin(t * f.freqX + f.phaseX) * f.ampX
      const y = f.homeY + Math.sin(t * f.freqY + f.phaseY) * f.ampY
      const dw = f.sprite.cellsW * f.scale
      const dh = f.sprite.cellsH * f.scale

      ctx.imageSmoothingEnabled = f.scale < 1 // Crisp pixels when scaled up, smooth when scaled down
      ctx.drawImage(f.sprite.canvas, Math.round(x * s - dw / 2), Math.round(y * s - dh / 2), dw, dh)
    })
  }

  /**
   * Updates the O counter next to the o-mode buttons.
   * @param {boolean} full - true if the last O could not be placed
   */
  updateOModeCount(full = false) {
    const label = this.shadowRoot.getElementById('omodeCount')
    label.textContent = `${this.floaters.length} o's${full ? ' (container full)' : ''}`
  }

  /**
   * Removes every O from the container.
   */
  clearOMode() {
    this.floaters = []
    this.stopAnimation()

    const canvas = this.shadowRoot.getElementById('omodeCanvas')
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    this.updateOModeCount()
  }

  /**
   * Downloads the current o-mode composition as a transparent PNG.
   */
  downloadOMode() {
    const canvas = this.shadowRoot.getElementById('omodeCanvas')
    this.downloadCanvas(canvas, `o-mode_${String(this.floaters.length).padStart(3, '0')}`)
  }
}

// Register the custom element
customElements.define('o-generator', OGenerator)

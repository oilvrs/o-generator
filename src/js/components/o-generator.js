/**
 * A simple O generator component.
 * Generates unique, symmetric, typographic O shapes on a 32x32 grid.
 * Each O varies in size, x/y-axis proportions and roundness, but stays
 * centered so the result always reads as a clean, symmetric O.
 *
 * @version 1.0.0
 * @author Oliver Woodhouse <woodhouse.oliver@gmail.com>
 */

class OGenerator extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.gridSize = 32 // Fixed grid resolution
    this.cellPx = 6 // Display size of each grid cell in pixels
    this.count = 0 // Number of O's generated so far
    this.seen = new Set() // Tracks parameter signatures to avoid exact duplicates
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

.actions {
  background: transparent;
  box-shadow: none;
  padding: 1rem 0;
  margin-bottom: 2rem;
  border-top: 1px solid #000000;
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

      </style>

      <div class="container">
        <div class="inner">
          <div class="header">
            <h1>O GENERATOR by oliver woodhouse</h1>
            <p class="subtitle">generates a unique, symmetric o on a 32×32 grid every time you press generate. size, x-axis and y-axis proportions and roundness vary, but each o stays centered on the grid so it always reads as a clean, typographic o. every generated o is stacked below in order and can be downloaded as a png.</p>
          </div>

          <div class="actions">
            <button class="generate-btn" id="generateBtn">generate o</button>
            <button class="download-all-btn hidden" id="downloadAllBtn">download all</button>
          </div>

          <div class="results" id="results"></div>
        </div>
      </div>
        `
  }

  /**
   * Sets up event listeners for the generate and download-all buttons.
   */
  setUpEventListeners() {
    const generateBtn = this.shadowRoot.getElementById('generateBtn')
    const downloadAllBtn = this.shadowRoot.getElementById('downloadAllBtn')

    generateBtn.addEventListener('click', () => this.generateO())
    downloadAllBtn.addEventListener('click', () => this.downloadAll())
  }

  /**
   * Generates one new unique O, draws it and appends it to the results list.
   */
  generateO() {
    const params = this.randomParams()
    const grid = this.buildGrid(params)
    const canvas = this.drawGrid(grid)

    this.count++
    this.addResult(canvas)

    this.shadowRoot.getElementById('downloadAllBtn').classList.remove('hidden')
  }

  /**
   * Produces a random, uniqueish set of parameters for one O.
   * Retries a few times on an exact repeat, then gives up and accepts it
   * (two truly identical O's are extremely unlikely anyway).
   * @returns {Object} { scaleX, scaleY, thickness, power }
   */
  randomParams() {
    let params
    let signature
    let attempts = 0

    do {
      params = {
        scaleX: this.randomBetween(0.55, 1.0), // Horizontal reach, fraction of max radius
        scaleY: this.randomBetween(0.55, 1.0), // Vertical reach, fraction of max radius
        thickness: this.randomBetween(0.18, 0.42), // Ring thickness, fraction of radius
        power: this.randomBetween(2, 6) // Superellipse exponent: 2 = round, higher = squarer/typographic
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
   * @param {Object} params - { scaleX, scaleY, thickness, power }
   * @returns {boolean[][]} grid[y][x] = true where the O should be filled
   */
  buildGrid(params) {
    const { scaleX, scaleY, thickness, power } = params
    const size = this.gridSize
    const center = (size - 1) / 2
    const margin = 2 // Keep a small margin from the grid edge
    const maxRadius = center - margin
    const radiusX = maxRadius * scaleX
    const radiusY = maxRadius * scaleY

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
    const cellPx = this.cellPx

    const canvas = document.createElement('canvas')
    canvas.width = size * cellPx
    canvas.height = size * cellPx

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'

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
}

// Register the custom element
customElements.define('o-generator', OGenerator)

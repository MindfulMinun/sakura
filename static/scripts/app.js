const Sakura = {
    /** @param {File[]} files */
    fileDrop(files) {
        const file = files.find(file => file.type.startsWith('image/'))
        if (!file) {
            return alert("Be sure to drop a file your browser supports :)")
        }

        this.image.src = URL.createObjectURL(file)
        // this.loadView('loading')

        this.image.onload = () => {
            
            this.ctx.canvas.height = this.image.naturalHeight
            this.ctx.canvas.width = this.image.naturalWidth
            this.ctx.drawImage(this.image, 0, 0)

            this.loadView('editor')
        }
    },

    /** @type {{[key: string]: ((app: Sakura) => void)[]}} */
    _loadCallbacks: {},

    /** @param {string} id */
    loadView(id) {
        /** @ts-ignore @type {HTMLTemplateElement} */
        const temp = document.getElementById(`template__${id}`)
        const clone = temp.content.cloneNode(true)
        this.view.innerHTML = ''
        this.view.appendChild(clone)
        this.returnCall(id)
        return Promise.resolve(this)
    },

    view: document.getElementById('app'),

    /** @ts-ignore @type {HTMLInputElement} */
    fileElement: document.getElementById('input-file'),

    ctx: document.createElement('canvas').getContext('2d'),
    image: new Image(),

    /**
     * Calls callback after the id has loaded. May be called more than once
     * @param {string} id
     * @param {(app: Sakura) => void} cb
     */
    onload(id, cb) {
        this._loadCallbacks[id] = this._loadCallbacks[id] || []
        this._loadCallbacks[id].push(cb)
    },

    /** @param {string} id */
    returnCall(id) {
        const cbs = this._loadCallbacks[id]
        if (cbs) {
            cbs.forEach(cb => cb.call(this, this))
        }
    }
}
// @ts-ignore
globalThis['Sakura'] = Sakura

// Handle file selects
Sakura.fileElement.addEventListener('change', function () {
    if (this.files) {
        Sakura.fileDrop([...this.files])
    }
})

// Listen for file drops
window.addEventListener('drop', async ev => {
    ev.preventDefault()
    Sakura.fileDrop([...ev.dataTransfer.files])
})

// Prevent the browser from replacing the document when a file's dropped over it
document.addEventListener('dragover', ev => ev.preventDefault())

// Register load callbacks
Sakura.onload('welcome', app => {
    app.view.querySelector('.link-btn')
        .addEventListener('click', () => app.fileElement.click())
})

Sakura.onload('editor', app => {
    app.ctx.canvas.width
    /** @ts-ignore @type {HTMLDivElement} */
    const canvasBox = app.view.querySelector('.cbox')
    canvasBox.appendChild(app.ctx.canvas)
    const rect = canvasBox.getBoundingClientRect()
    const initialX = rect.width / 2 - app.ctx.canvas.width / 2
    const initialY = rect.height / 2 - app.ctx.canvas.height / 2

    canvasBox.style.setProperty('--x', `${initialX}px`)
    canvasBox.style.setProperty('--y', `${initialY}px`)

    touchManip({
        canvasBox, 
        rect,
        image: app.image
    })
})

/**
 * Adds a bunch of event listeners that are responsible for ~glitchy~ touch interactions
 * @param {{canvasBox: HTMLDivElement, rect: DOMRect, image: HTMLImageElement}} any
 */
function touchManip({canvasBox, rect, image}) {
    const SCROLL_SCALE = 480
    const PINCH_SCALE = 300
    const PADDING_BOX = 64

    // Movement event listeners
    // Mouse events fire way too often
    // getComputedStyle too expensive to call on each of these events
    // Instead, accumulate the scrolled distance and update once per frame

    const pointer = {
        isPanning: false,
        multitouch: false,
        lastX: 0,
        lastY: 0,
        lastSize: 0,
        aggregateX: 0,
        aggregateY: 0,
        aggregateScroll: 0,
        /** @param {{x: number, y: number}} a */
        onPointerMove: ({x, y}) => {
            if (pointer.isPanning) {
                pointer.aggregateX += (x - pointer.lastX)
                pointer.aggregateY += (y - pointer.lastY)
                pointer.lastX = x
                pointer.lastY = y
            }
        },
        /** @param {{x: number, y: number}} a */
        onPointerDown: ({x, y}) => {
            pointer.isPanning = true
            pointer.lastX = x
            pointer.lastY = y
        },
    }

    canvasBox.addEventListener('wheel', ev => pointer.aggregateScroll -= ev.deltaY / SCROLL_SCALE, { passive: true })
    canvasBox.addEventListener('mousemove', pointer.onPointerMove)
    canvasBox.addEventListener('touchmove', ev => {
        if (ev.targetTouches.length === 1) {
            pointer.multitouch = false
            pointer.onPointerMove({
                x: ev.targetTouches[0].clientX,
                y: ev.targetTouches[0].clientY
            })
        } else {
            const [left, right] = ev.targetTouches
            const midpoint = {
                x: (left.clientX + right.clientX) / 2,
                y: (left.clientY + right.clientY) / 2
            }
            const size = Math.hypot(right.clientX - left.clientX, right.clientY - left.clientY)
            // Ignore this touch since it's like start of the second touch 
            if (!pointer.multitouch) {
                pointer.lastX = midpoint.x
                pointer.lastY = midpoint.y
                pointer.lastSize = size
                pointer.multitouch = true
            }
            // Scale by the position
            pointer.aggregateScroll += (size - pointer.lastSize) / PINCH_SCALE
            pointer.lastSize = size
            pointer.onPointerMove(midpoint)
        }
    }, { passive: true })

    canvasBox.addEventListener('mousedown', pointer.onPointerDown)
    canvasBox.addEventListener('touchstart', ev => pointer.onPointerDown({
        x: ev.targetTouches[0].clientX,
        y: ev.targetTouches[0].clientY
    }), { passive: true })
    canvasBox.addEventListener('touchend', () => {
        pointer.isPanning = false
        pointer.multitouch = true
    })
    canvasBox.addEventListener('mouseup', () => pointer.isPanning = false)
    canvasBox.addEventListener('mouseleave', () => pointer.isPanning = false)

    requestAnimationFrame(function _rAF() {
        if (!canvasBox.isConnected) return
        requestAnimationFrame(_rAF)
        const computed = getComputedStyle(canvasBox)

        // Scroll
        const parsedScale = parseFloat(computed.getPropertyValue('--scale') || '0')
        // .1 <= scale <= 20
        const scale = Math.max(.1, Math.min(20, parsedScale + pointer.aggregateScroll))
        canvasBox.style.setProperty('--scale', '' + scale)
        
        // Position
        const parsedX = parseFloat(computed.getPropertyValue('--x') || '0px')
        const parsedY = parseFloat(computed.getPropertyValue('--y') || '0px')
        
        const x = Math.max(
            -image.width + PADDING_BOX,
            Math.min(rect.width - PADDING_BOX, parsedX + pointer.aggregateX)
        )
        const y = Math.max(
            -image.height + PADDING_BOX,
            Math.min(rect.height - PADDING_BOX, parsedY + pointer.aggregateY)
        )

        canvasBox.style.setProperty('--x', `${x}px`)
        canvasBox.style.setProperty('--y', `${y}px`)

        pointer.aggregateX = 0
        pointer.aggregateY = 0
        pointer.aggregateScroll = 0
    })
}

Sakura.loadView('welcome')

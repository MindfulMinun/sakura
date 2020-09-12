const Sakura = {
    /** @param {File[]} files */
    fileDrop(files) {
        if (Sakura.image.src !== '') return
        const file = files.find(file => file.type.startsWith('image/'))
        if (!file) {
            return alert("Be sure to drop a file your browser supports :)")
        }

        this.image.src = URL.createObjectURL(file)
        // this.loadView('loading')

        this.image.onload = () => {
            this.mirror.height = this.image.naturalHeight
            this.mirror.width = this.image.naturalWidth
            this.worker.postMessage({
                "<3": "Alone together",
                file
            })
            URL.revokeObjectURL(this.image.src)
            this.image.title = file.name
            this.loadView('editor')
        }
        this.image.onerror = () => {
            alert("Sorry, but this image is in a format I can't understand.")
            this.image.onload = () => {}
            this.image.onerror = () => {}
            this.image.src = ''
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

    // ctx: document.createElement('canvas').getContext('2d'),
    mirror: document.createElement('canvas'),
    worker: new Worker('/static/scripts/worker.js', { type: "module" }),
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
// @ts-expect-error
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

// Worker callbacks
Sakura.worker.addEventListener('message', ev => {
    switch (ev.data['<3']) {
        case "I wish I could make you mine":
            const { title, url } = ev.data
            const anchor = document.createElement('a')
            anchor.setAttribute('href', url)
            anchor.setAttribute('download', title)
            document.body.append(anchor)
            anchor.click()
            document.body.removeChild(anchor)
            break
    }
})

// Register load callbacks
Sakura.onload('welcome', app => {
    Array.from(app.view.querySelectorAll('button'))
        .forEach(
            el => el.addEventListener('click', () => app.fileElement.click())
        )
})

Sakura.onload('editor', app => {
    /** @ts-ignore @type {HTMLDivElement} */
    const canvasBox = app.view.querySelector('.cbox')
    canvasBox.appendChild(app.mirror)
    const rect = canvasBox.getBoundingClientRect()

    // Scale so the whole image can be seen at the start
    const initialScale = Math.min(
        window.innerWidth / app.image.naturalWidth,
        window.innerHeight / app.image.naturalHeight,
        1
    )
    const initialX = (rect.width / 2) - (app.image.naturalWidth * initialScale / 2)
    const initialY = (rect.height / 2) - (app.image.naturalHeight * initialScale / 2)

    const canvas = app.mirror.transferControlToOffscreen()
    app.worker.postMessage({
        '<3': "Sail across the oceans just to find a way to get closer to you",
        canvas
    }, [canvas])


    canvasBox.style.setProperty('--x', `${initialX}px`)
    canvasBox.style.setProperty('--y', `${initialY}px`)
    canvasBox.style.setProperty('--scale', `${initialScale}`)

    touchManip({
        canvasBox, 
        rect,
        image: app.image
    })

    /** @ts-ignore @type {HTMLInputElement[]} */
    const [dark, light] = app.view.querySelectorAll('input[type=color]')

    // Add event listeners
    ;[dark, light].forEach(el => {
        el.addEventListener('change', () => {
            app.worker.postMessage({
                '<3': "I miss you, I need you, I love you.",
                'colors': [parseInt(dark.value.slice(1), 16), parseInt(light.value.slice(1), 16)]
            })
        })
    })

    const downloadBtn = app.view.querySelector('button')
    downloadBtn.addEventListener('click', () => {
        app.worker.postMessage({
            '<3': "Why don't we fall in love?"
        })
    })

    if (navigator.share) {
        const shareBtn = document.createElement('button')
        shareBtn.textContent = 'Share'
        
        shareBtn.addEventListener('click', () => {
            Sakura.mirror.toBlob(blob => {
                const file = new File([blob], Sakura.image.title, { type: blob.type })
                console.log(file)
                navigator.share({
                    // @ts-expect-error -- VS doesn't know about the new Files parameter
                    files: [file],
                    text: '🌸'
                }).catch(reason => {
                    if (("" + reason).endsWith('Share canceled')) return

                    alert("Oops, your device didn't let me do that.")
                })
            })
        })

        downloadBtn.parentElement.append(shareBtn)
    }
})


/**
 * Adds a bunch of event listeners that are responsible for ~glitchy~ touch interactions
 * @param {{canvasBox: HTMLDivElement, rect: DOMRect, image: HTMLImageElement}} any
 */
function touchManip({canvasBox, rect, image}) {
    const SCROLL_SCALE = 480
    const PINCH_SCALE = 500
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
    canvasBox.addEventListener('mousemove', pointer.onPointerMove, { passive: true })
    canvasBox.addEventListener('touchmove', ev => {
        const left = ev.targetTouches[0]
        const right = ev.targetTouches[1]
        if (!right) {
            pointer.multitouch = false
            pointer.onPointerMove({
                x: left.clientX,
                y: left.clientY
            })
        } else {
            const left = ev.targetTouches[0]
            const right = ev.targetTouches[1]
            const x = (left.clientX + right.clientX) / 2
            const y = (left.clientY + right.clientY) / 2
            const size = Math.hypot(right.clientX - left.clientX, right.clientY - left.clientY)
            // Ignore this touch since it's like start of the second touch 
            if (!pointer.multitouch) {
                pointer.lastX = x
                pointer.lastY = y
                pointer.lastSize = size
                pointer.multitouch = true
            }
            // Scale by the position
            pointer.aggregateScroll += (size - pointer.lastSize) / PINCH_SCALE
            pointer.lastSize = size
            pointer.onPointerMove({x, y})
        }
    }, { passive: true })

    canvasBox.addEventListener('mousedown', pointer.onPointerDown, { passive: true })
    canvasBox.addEventListener('touchstart', ev => pointer.onPointerDown({
        x: ev.targetTouches[0].clientX,
        y: ev.targetTouches[0].clientY
    }), { passive: true })
    canvasBox.addEventListener('touchend', () => {
        pointer.isPanning = false
        pointer.multitouch = true
    }, { passive: true })
    canvasBox.addEventListener('mouseup', () => pointer.isPanning = false, { passive: true })
    canvasBox.addEventListener('mouseleave', () => pointer.isPanning = false, { passive: true })

    function update() {
        const computed = getComputedStyle(canvasBox)

        // Scroll
        const prevScale = +computed.getPropertyValue('--scale')
        // const parsedScale = +(canvasBox.dataset.scale || '')
        // .1 <= scale <= 20
        const scale = Math.max(.1, Math.min(20, prevScale + pointer.aggregateScroll))
        
        // Position
        const prevX = +computed.getPropertyValue('--x').slice(0, -2)
        const prevY = +computed.getPropertyValue('--y').slice(0, -2)
        
        const x = Math.max(
            -image.width + PADDING_BOX,
            Math.min(rect.width - PADDING_BOX, prevX + pointer.aggregateX)
        )
        const y = Math.max(
            -image.height + PADDING_BOX,
            Math.min(rect.height - PADDING_BOX, prevY + pointer.aggregateY)
        )

        canvasBox.style.setProperty('--x', `${x}px`)
        canvasBox.style.setProperty('--y', `${y}px`)
        canvasBox.style.setProperty('--scale', `${scale}`)
    
        pointer.aggregateX = 0
        pointer.aggregateY = 0
        pointer.aggregateScroll = 0

        requestAnimationFrame(update)
    }
    requestAnimationFrame(update)
}

// Load the initial view
Sakura.loadView('welcome')

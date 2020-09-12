import { imageTwoTone } from './blossom.js'

/** @type {File?} */
let file = null

/** @type {ImageBitmap?} */
let bitmap = null

/** @type {OffscreenCanvas?} */
let mirror = null

/** @type {OffscreenCanvasRenderingContext2D?} */
let ctx = null

self.addEventListener('message', async ev => {
    switch (ev.data['<3']) {
        case "Sail across the oceans just to find a way to get closer to you":
            mirror = ev.data.canvas
            ctx = mirror.getContext('2d')
            bitmap = await createImageBitmap(file)
            // Initial draw with default pinks
            draw(0xF1278C, 0xFCD0E5, mirror)
            break
        case "Alone together":
            file = ev.data.file
            break
        case "I miss you, I need you, I love you.":
            // Draw with custom colors
            const [dark, light] = ev.data.colors
            draw(dark, light, mirror)
            break
        case "Why don't we fall in love?":
            // Send over blob
            mirror.convertToBlob().then(blob => {
                log("Creating a blob")
                const url = URL.createObjectURL(blob)
                // @ts-expect-error -- VS doesn't know this is a worker :/
                self.postMessage({ 
                    '<3': "I wish I could make you mine",
                    title: file.name,
                    url
                })
            }).catch(log)
            break
        case "I can't help but smile when I'm around you":
            mirror.convertToBlob().then(blob => {
                const temp = new File([blob], file.name)
                // @ts-expect-error -- VS doesn't know this is a worker :/
                self.postMessage({
                    '<3': "You complete me",
                    file: temp
                })
            })
            break
        default:
            log(`Unknown message: ${ev.data['<3']}`)
    }
    // log(ev.data)
})

/**
 * @param {number} color1
 * @param {number} color2
 * @param {OffscreenCanvas} canv
 */
async function draw(color1, color2, canv) {
    ctx = canv.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)
    imageTwoTone(color1, color2, ctx)
}

/**
 * @param {any[]} things
 */
function log(...things) {
    if (things.length === 1 && typeof things[0] === 'string') {
        console.log(`[worker.js]: ${things[0]}`)
    } else {
        console.log('[worker.js]', ...things)
    }
}

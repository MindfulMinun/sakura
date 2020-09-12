/**
 * @param {number} color1
 * @param {number} color2
 */
export function imageTwoTone(color1, color2, ctx) {
    const dark = color1 % 0x1000000
    const light = color2 % 0x1000000
    pixelLevelFilter(ctx, (r, g, b, a) => {
        const avg = (r + g + b) / 3 / 255
        r = Math.round(lerp(
            getChannel('red', dark),
            getChannel('red', light), 
            avg
        ))
        g = Math.round(lerp(
            getChannel('green', dark),
            getChannel('green', light), 
            avg
        ))
        b = Math.round(lerp(
            getChannel('blue', dark),
            getChannel('blue', light), 
            avg
        ))
        return [r, g, b, a]
    })
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {(r: number, g: number, b: number, a: number) => [number, number, number, number]} fn
 */
function pixelLevelFilter(ctx, fn) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = fn(
            data[i + 0], // Red
            data[i + 1], // Green
            data[i + 2], // Blue
            data[i + 3]  // Alpha
        )
        data[i + 0] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = a
    }

    ctx.putImageData(imageData, 0, 0)
}

function getChannel(channel, hex) {
    switch (channel) {
        case 'red':
            return Math.floor(hex / 0x10000)
        case 'green':
            return Math.floor((hex % 0x10000) / 0x100)
        case 'blue':
            return Math.floor(hex % 0x100)
    
        default: throw Error('Invalid channel')
    }
}

/**
 * Interpolates a value given two other values and a scale of one to the other
 * @param {number} v0 The inital value (at x = 0)
 * @param {number} v1 The final value (at x = 1)
 * @param {number} x The x for the new value; the interpolation factor
 * @returns {number} The interpolated value
 * @example
 * // A random value between 5 and 10
 * lerp(5, 10, Math.random())
 * @author MindfulMinun
 * @since 2020-07-05
 */
function lerp(v0, v1, x) {
    return (1 - x) * v0 + x * v1
}

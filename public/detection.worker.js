// Web Worker — runs off the main thread
// No access to DOM, window, or React — pure computation only

let model = null
let isLoading = false

async function loadModel() {
  if (model || isLoading) return
  isLoading = true

  try {
    // Import TF.js inside the worker
    importScripts(
      "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
      "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js",
    )

    await tf.ready()
    model = await cocoSsd.load({ base: "lite_mobilenet_v2" })

    self.postMessage({ type: "MODEL_READY" })
  } catch (err) {
    self.postMessage({ type: "MODEL_ERROR", error: err.message })
  } finally {
    isLoading = false
  }
}

self.onmessage = async (e) => {
  const { type, bitmap, width, height, threshold } = e.data

  if (type === "LOAD") {
    await loadModel()
    return
  }

  if (type === "DETECT") {
    if (!model || !bitmap) return

    try {
      // Draw bitmap to offscreen canvas for TF.js to read
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext("2d")
      ctx.drawImage(bitmap, 0, 0, width, height)
      bitmap.close() // free the transferable immediately

      const predictions = await model.detect(canvas)

      const filtered = predictions
        .filter((p) => p.score >= (threshold ?? 0.6))
        .map((p) => ({
          class: p.class,
          score: p.score,
          bbox: p.bbox,
        }))

      // Clean up tensors to prevent memory leak
      tf.engine().endScope()

      self.postMessage({ type: "DETECTIONS", detections: filtered })
    } catch (err) {
      // Silently skip failed frames — don't crash the worker
      console.warn("Detection frame error:", err.message)
    }
  }
}

let model = null
let isLoading = false

async function loadModel() {
  if (model || isLoading) return
  isLoading = true

  try {
    importScripts(
      "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
    )

    await tf.ready()
    console.log("[CORVUS Worker] TF.js ready, backend:", tf.getBackend())

    importScripts(
      "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js",
    )

    model = await cocoSsd.load({ base: "lite_mobilenet_v2" })
    console.log("[CORVUS Worker] Model loaded successfully")

    self.postMessage({ type: "MODEL_READY" })
  } catch (err) {
    console.error("[CORVUS Worker] Load error:", err)
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
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext("2d")
      ctx.drawImage(bitmap, 0, 0, width, height)
      bitmap.close()

      const predictions = await model.detect(canvas)

      const filtered = predictions
        .filter((p) => p.score >= (threshold ?? 0.6))
        .map((p) => ({
          class: p.class,
          score: p.score,
          bbox: p.bbox,
        }))

      self.postMessage({ type: "DETECTIONS", detections: filtered })
    } catch (err) {
      console.error("[CORVUS Worker] Detection error:", err)
      self.postMessage({ type: "DETECTIONS", detections: [] })
    }
  }
}

self.onerror = (err) => {
  console.error("[CORVUS Worker] Uncaught error:", err)
}

// Zero-lookahead feed-forward compressor. Chrome's DynamicsCompressorNode always delays the signal by
// 6 ms for lookahead; for live guitar monitoring that delay matters more than catching the first transient.
// Gain curve, soft knee and automatic makeup gain mirror the native node so patches sound the same.
class FxCompressor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -24, minValue: -100, maxValue: 0, automationRate: 'k-rate' },
      { name: 'ratio', defaultValue: 12, minValue: 1, maxValue: 20, automationRate: 'k-rate' },
      { name: 'knee', defaultValue: 6, minValue: 0, maxValue: 40, automationRate: 'k-rate' },
      { name: 'attack', defaultValue: 0.003, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.25, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ]
  }

  constructor() {
    super()
    this.envDb = -120
  }

  static curve(inDb, threshold, ratio, knee) {
    const over = inDb - threshold
    if (2 * over < -knee) return inDb
    if (knee > 0 && 2 * Math.abs(over) <= knee) {
      const x = over + knee / 2
      return inDb + ((1 / ratio - 1) * x * x) / (2 * knee)
    }
    return threshold + over / ratio
  }

  process(inputs, outputs, params) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true

    const threshold = params.threshold[0]
    const ratio = params.ratio[0]
    const knee = params.knee[0]
    const attackCoef = Math.exp(-1 / (Math.max(params.attack[0], 0.0001) * sampleRate))
    const releaseCoef = Math.exp(-1 / (Math.max(params.release[0], 0.001) * sampleRate))
    const makeupDb = -0.6 * (FxCompressor.curve(0, threshold, ratio, knee))

    const frames = input[0].length
    const channels = input.length
    let env = this.envDb
    for (let i = 0; i < frames; i++) {
      let peak = 0
      for (let c = 0; c < channels; c++) {
        const v = Math.abs(input[c][i])
        if (v > peak) peak = v
      }
      const inDb = peak > 1e-6 ? 20 * Math.log10(peak) : -120
      const coef = inDb > env ? attackCoef : releaseCoef
      env = inDb + coef * (env - inDb)
      const gainDb = FxCompressor.curve(env, threshold, ratio, knee) - env + makeupDb
      const gain = Math.pow(10, gainDb / 20)
      for (let c = 0; c < output.length; c++) {
        const src = input[Math.min(c, channels - 1)]
        output[c][i] = src[i] * gain
      }
    }
    this.envDb = env
    return true
  }
}

registerProcessor('fx-compressor', FxCompressor)

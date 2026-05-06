export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;
  private queue: Float32Array[] = [];
  private sampleRate = 24000;
  private scheduledTime = 0;
  private lastLevel = 0;

  async init(sampleRate = 24000) {
    this.sampleRate = sampleRate;
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate,
    });
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.72;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.analyser.connect(this.audioContext.destination);

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  addPCM16(base64: string) {
    if (!this.audioContext) return;
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new DataView(buffer);
    for (let i = 0; i < binary.length; i++) {
        view.setUint8(i, binary.charCodeAt(i));
    }
    const int16Length = buffer.byteLength / 2;
    const float32Array = new Float32Array(int16Length);
    let sumSquares = 0;

    for (let i = 0; i < int16Length; i++) {
        const int16 = view.getInt16(i * 2, true);
        const sample = int16 / (int16 < 0 ? 0x8000 : 0x7FFF);
        sumSquares += sample * sample;
        float32Array[i] = sample;
    }

    this.lastLevel = Math.min(1, Math.sqrt(sumSquares / Math.max(int16Length, 1)) * 3.6);
    this.queue.push(float32Array);
    this.scheduleNext();
  }

  private scheduleNext() {
    if (!this.audioContext) return;
    
    while (this.queue.length > 0) {
      const chunk = this.queue.shift()!;
      const audioBuffer = this.audioContext.createBuffer(1, chunk.length, this.sampleRate);
      audioBuffer.getChannelData(0).set(chunk);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.analyser || this.audioContext.destination);
      
      const currentTime = this.audioContext.currentTime;
      if (this.scheduledTime < currentTime) {
        this.scheduledTime = currentTime;
      }
      
      source.start(this.scheduledTime);
      this.scheduledTime += audioBuffer.duration;
      this.source = source; // keep last source for stop()
    }
  }

  stop() {
    this.queue = [];
    if (this.source) {
      try {
        this.source.stop();
      } catch (e) {}
    }
    this.scheduledTime = 0;
    this.lastLevel = 0;
  }

  getLevel() {
    if (!this.analyser || !this.timeData) return this.lastLevel;

    this.analyser.getByteTimeDomainData(this.timeData);
    let sumSquares = 0;

    for (let i = 0; i < this.timeData.length; i++) {
      const centered = (this.timeData[i] - 128) / 128;
      sumSquares += centered * centered;
    }

    const liveLevel = Math.sqrt(sumSquares / Math.max(this.timeData.length, 1)) * 3.2;
    this.lastLevel = Math.max(Math.min(1, liveLevel), this.lastLevel * 0.82);
    return this.lastLevel;
  }

  getFrequencyBands(count = 20) {
    if (!this.analyser || !this.frequencyData) return [];

    this.analyser.getByteFrequencyData(this.frequencyData);
    const bandCount = Math.max(1, Math.min(count, this.frequencyData.length));
    const usableBins = Math.max(bandCount, Math.floor(this.frequencyData.length * 0.72));
    const binSize = Math.max(1, Math.floor(usableBins / bandCount));

    return Array.from({ length: bandCount }, (_, bandIndex) => {
      const start = bandIndex * binSize;
      const end = Math.min(start + binSize, usableBins);
      let total = 0;

      for (let i = start; i < end; i++) {
        total += this.frequencyData![i];
      }

      const average = total / Math.max(end - start, 1);
      return Math.min(1, average / 145);
    });
  }
}

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private lastLevel = 0;
  private onData: (base64: string) => void;

  constructor(onData: (base64: string) => void) {
    this.onData = onData;
  }

  async start() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000
    });
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.78;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = new Int16Array(input.length);
      let sumSquares = 0;

      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        sumSquares += s * s;
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      this.lastLevel = Math.min(1, Math.sqrt(sumSquares / Math.max(input.length, 1)) * 4.2);

      const buffer = new ArrayBuffer(output.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < output.length; i++) {
        view.setInt16(i * 2, output[i], true);
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      this.onData(btoa(binary));
    };
    
    source.connect(this.analyser);
    this.analyser.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  getLevel() {
    return this.lastLevel;
  }

  getFrequencyBands(count = 16) {
    if (!this.analyser || !this.frequencyData) return [];

    this.analyser.getByteFrequencyData(this.frequencyData);
    const bandCount = Math.max(1, Math.min(count, this.frequencyData.length));
    const binSize = Math.max(1, Math.floor(this.frequencyData.length / bandCount));

    return Array.from({ length: bandCount }, (_, bandIndex) => {
      const start = bandIndex * binSize;
      const end = Math.min(start + binSize, this.frequencyData!.length);
      let total = 0;

      for (let i = start; i < end; i++) {
        total += this.frequencyData![i];
      }

      const average = total / Math.max(end - start, 1);
      return Math.min(1, average / 160);
    });
  }

  stop() {
    if (this.processor && this.audioContext) {
      this.processor.disconnect();
    }
    if (this.analyser) {
      this.analyser.disconnect();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.audioContext?.close();
    this.audioContext = null;
    this.stream = null;
    this.processor = null;
    this.analyser = null;
    this.frequencyData = null;
    this.lastLevel = 0;
  }
}

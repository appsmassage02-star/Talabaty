// Web Audio API Ringtone & Chime Synthesizer
// Generates realistic pleasant chime & alert tones without external audio dependencies

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays an urgent melodic ringtone pattern to grab attention
 * (Simulates a cheerful high-priority chime ring: E5 -> G#5 -> B5 -> E6)
 */
export function playUrgentAlertRing(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 659.25, time: 0, duration: 0.18 },   // E5
      { freq: 830.61, time: 0.12, duration: 0.18 }, // G#5
      { freq: 987.77, time: 0.24, duration: 0.22 }, // B5
      { freq: 1318.5, time: 0.36, duration: 0.45 }, // E6
      // Second pulse
      { freq: 659.25, time: 0.70, duration: 0.18 },
      { freq: 830.61, time: 0.82, duration: 0.18 },
      { freq: 987.77, time: 0.94, duration: 0.22 },
      { freq: 1318.5, time: 1.06, duration: 0.55 },
    ];

    notes.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + time);

      // Envelope: Fast attack, exponential decay
      gain.gain.setValueAtTime(0.001, now + time);
      gain.gain.exponentialRampToValueAtTime(0.28, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + duration);
    });

    // Optional subtle vibration if supported by device
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch (e) {
    console.warn("Audio chime could not be played:", e);
  }
}

/**
 * Plays a short soft confirmation beep (e.g. item checked or added)
 */
export function playSuccessChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch (e) {
    // ignore
  }
}

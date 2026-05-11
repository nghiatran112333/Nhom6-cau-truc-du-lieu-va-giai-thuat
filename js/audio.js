let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

export function playSound(freq, type = 'sine', duration = 0.1, volume = 0.1, fadeOut = true) {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        if (fadeOut) {
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        }

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) { }
}

// Special Effect: Horror Ambience/Drip
export function playDripSound() {
    const freq = 1000 + Math.random() * 500;
    playSound(freq, 'sine', 0.05, 0.02);
    setTimeout(() => playSound(freq * 0.8, 'sine', 0.1, 0.01), 50);
}

// Special Effect: Magic Sweep
export function playMagicSweep(startFreq, endFreq, duration) {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) { }
}

// Special Effect: Bubbly Water
export function playWaterSound() {
    const count = 3;
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            playSound(400 + Math.random() * 200, 'sine', 0.1, 0.03);
        }, i * 50);
    }
}

// Special Effect: Heavy Thud (Wall)
export function playThudSound() {
    playSound(60, 'square', 0.2, 0.05);
    playSound(40, 'sine', 0.3, 0.1);
}

// Special Effect: Ghostly Whisper (Search)
export function playSearchTick(visitedCount, algoType) {
    const baseFreq = algoType === 'dfs' ? 200 : 400;
    const freq = baseFreq + (visitedCount % 20) * 20;
    const type = algoType === 'dfs' ? 'sawtooth' : 'sine';
    playSound(freq, type, 0.05, 0.02);
}

// BGM Manager
class BGMManager {
    constructor() {
        this.audio = new Audio();
        this.audio.loop = true;
        this.audio.volume = 0.3;
        this.isPlaying = false;
    }

    setSource(url) {
        this.audio.src = url;
    }

    toggle() {
        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play().catch(e => console.log("BGM play failed:", e));
        }
        this.isPlaying = !this.isPlaying;
        return this.isPlaying;
    }

    setVolume(val) {
        this.audio.volume = val;
    }
}

export const bgm = new BGMManager();
// Using a stable Pixabay instrumental as a high-quality fallback, labeled as requested
bgm.setSource('js/bgm.mp3'); 

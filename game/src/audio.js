import { CONFIG } from './config.js';

const { audio } = CONFIG;

let audioContext = null;
let masterGain = null;
let droneOsc = null;
let droneGain = null;
let noiseBuffer = null;
let isInitialized = false;
let isMuted = false;

export function initAudio() {
  if (isInitialized) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = audio.masterVolume;
    masterGain.connect(audioContext.destination);

    createNoiseBuffer();
    startDrone();

    isInitialized = true;
  } catch (e) {
    console.warn('Audio initialization failed:', e);
  }
}

function createNoiseBuffer() {
  const bufferSize = audioContext.sampleRate * 0.5;
  noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
}

function startDrone() {
  if (!audioContext || isMuted) return;
  droneOsc = audioContext.createOscillator();
  droneGain = audioContext.createGain();
  droneOsc.type = 'sine';
  droneOsc.frequency.value = audio.droneFreq;
  droneGain.gain.value = 0.02;
  droneOsc.connect(droneGain);
  droneGain.connect(masterGain);
  droneOsc.start();
}

export function resumeAudio() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

export function setMuted(muted) {
  isMuted = muted;
  if (masterGain) {
    masterGain.gain.value = muted ? 0 : audio.masterVolume;
  }
}

function playTone(freq, duration, type = 'sine', volume = 0.1, startTime = 0) {
  if (!audioContext || isMuted) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(masterGain);
  const t = audioContext.currentTime + startTime;
  osc.start(t);
  osc.stop(t + duration);
}

function playNoiseBurst(duration, volume = 0.1, filterFreq = 2000, startTime = 0) {
  if (!audioContext || isMuted || !noiseBuffer) return;
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  source.buffer = noiseBuffer;
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  const t = audioContext.currentTime + startTime;
  source.start(t);
  source.stop(t + duration);
}

export function playFootstep(isSprint = false) {
  if (!audioContext || isMuted) return;
  const freq = audio.footstepFreq * (isSprint ? 1.3 : 1);
  playTone(freq, 0.05, 'triangle', 0.03);
  playNoiseBurst(0.03, 0.015, 800);
}

export function playAlertChirp(level = 1) {
  if (!audioContext || isMuted) return;
  const freq = audio.alertChirpFreq * (1 + level * 0.2);
  playTone(freq, 0.1, 'square', 0.06);
  playTone(freq * 1.5, 0.08, 'square', 0.03, 0.05);
}

export function playLureThud() {
  if (!audioContext || isMuted) return;
  playTone(audio.lureThudFreq, 0.2, 'sine', 0.08);
  playNoiseBurst(0.15, 0.04, 300);
}

export function playPickupChime() {
  if (!audioContext || isMuted) return;
  playTone(audio.pickupChimeFreq, 0.15, 'sine', 0.1);
  playTone(audio.pickupChimeFreq * 1.5, 0.1, 'sine', 0.05, 0.05);
  playTone(audio.pickupChimeFreq * 2, 0.08, 'sine', 0.03, 0.1);
}

export function playCaughtBuzz() {
  if (!audioContext || isMuted) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = audio.caughtBuzzFreq;
  gain.gain.value = 0.15;
  osc.connect(gain);
  gain.connect(masterGain);
  const t = audioContext.currentTime;
  osc.frequency.exponentialRampToValueAtTime(audio.caughtBuzzFreq * 0.5, t + 1.5);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  osc.start(t);
  osc.stop(t + 1.5);
}

export function playLevelComplete() {
  if (!audioContext || isMuted) return;
  const notes = [660, 880, 1320];
  notes.forEach((freq, i) => {
    playTone(freq, 0.2, 'sine', 0.08, i * 0.15);
  });
}
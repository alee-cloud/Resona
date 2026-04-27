// Version 1 prototype using the Web Audio API.
// This file intentionally stays simple and beginner-friendly.

const audioFileInput = document.getElementById('audioFile');
const playPauseBtn = document.getElementById('playPauseBtn');
const effectButtons = document.querySelectorAll('.effect-btn');
const resetBtn = document.getElementById('resetBtn');
const statusText = document.getElementById('statusText');

// Audio state
let audioContext;
let audioBuffer = null;
let sourceNode = null;
let isPlaying = false;
let startTime = 0;
let pauseOffset = 0;

// Effect nodes
let lowShelfFilter;
let peakingFilter;
let highShelfFilter;
let outputGain;

// Default values used by Reset
const defaults = {
  lowShelfGain: 0,
  peakingGain: 0,
  highShelfGain: 0,
  masterGain: 1,
};

function updateStatus(message) {
  statusText.textContent = message;
}

function initAudioGraph() {
  // Create AudioContext only when needed (browser-friendly behavior).
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Build a simple chain:
  // source -> lowShelf -> peaking -> highShelf -> outputGain -> speakers
  lowShelfFilter = audioContext.createBiquadFilter();
  lowShelfFilter.type = 'lowshelf';
  lowShelfFilter.frequency.value = 220;

  peakingFilter = audioContext.createBiquadFilter();
  peakingFilter.type = 'peaking';
  peakingFilter.frequency.value = 450;
  peakingFilter.Q.value = 0.8;

  highShelfFilter = audioContext.createBiquadFilter();
  highShelfFilter.type = 'highshelf';
  highShelfFilter.frequency.value = 4200;

  outputGain = audioContext.createGain();

  // Connect fixed effect nodes once.
  lowShelfFilter.connect(peakingFilter);
  peakingFilter.connect(highShelfFilter);
  highShelfFilter.connect(outputGain);
  outputGain.connect(audioContext.destination);

  applyResetSettings();
}

function applyResetSettings() {
  lowShelfFilter.gain.value = defaults.lowShelfGain;
  peakingFilter.gain.value = defaults.peakingGain;
  highShelfFilter.gain.value = defaults.highShelfGain;
  outputGain.gain.value = defaults.masterGain;
}

function stopCurrentSource() {
  if (!sourceNode) return;

  try {
    sourceNode.stop();
  } catch {
    // Ignore stop() errors if already stopped.
  }

  sourceNode.disconnect();
  sourceNode = null;
}

function createAndStartSource(offsetSeconds) {
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(lowShelfFilter);

  // Start playback from the requested offset.
  sourceNode.start(0, offsetSeconds);
  startTime = audioContext.currentTime - offsetSeconds;
  isPlaying = true;
  playPauseBtn.textContent = 'Pause';

  sourceNode.onended = () => {
    // If the track naturally finishes, reset transport state.
    if (isPlaying) {
      isPlaying = false;
      pauseOffset = 0;
      playPauseBtn.textContent = 'Play';
      updateStatus('Playback finished. You can press Play again.');
    }
  };
}

function playAudio() {
  if (!audioBuffer) return;

  // Some browsers suspend context until user gesture.
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  createAndStartSource(pauseOffset);
}

function pauseAudio() {
  if (!isPlaying) return;

  // Save position so we can continue later.
  pauseOffset = audioContext.currentTime - startTime;
  stopCurrentSource();

  isPlaying = false;
  playPauseBtn.textContent = 'Play';
}

function setControlsEnabled(enabled) {
  playPauseBtn.disabled = !enabled;
  resetBtn.disabled = !enabled;
  effectButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function applyEffect(effectName) {
  switch (effectName) {
    case 'darker':
      // Reduce highs to make the sound less bright.
      highShelfFilter.gain.value = -8;
      peakingFilter.gain.value = -1;
      updateStatus(
        'Made darker: reduced high frequencies so the sound is smoother and less sharp.'
      );
      break;

    case 'brighter':
      // Boost highs for extra clarity/sparkle.
      highShelfFilter.gain.value = 7;
      peakingFilter.gain.value = 0;
      updateStatus(
        'Made brighter: boosted high frequencies so the sound has more top-end clarity.'
      );
      break;

    case 'warmer':
      // Add gentle low-mid body and slightly soften highs.
      peakingFilter.gain.value = 4;
      highShelfFilter.gain.value = -2;
      lowShelfFilter.gain.value = 2;
      updateStatus(
        'Made warmer: added low-mid body and softened highs for a fuller tone.'
      );
      break;

    case 'louder':
      // Increase master gain carefully (avoid aggressive jump).
      outputGain.gain.value = Math.min(outputGain.gain.value + 0.2, 1.6);
      updateStatus(
        'Made louder: increased output gain a little. Press again for a bit more level.'
      );
      break;

    default:
      break;
  }
}

// Handle file upload.
audioFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    if (!audioContext) {
      initAudioGraph();
    }

    const fileArrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(fileArrayBuffer);

    // Reset transport and effects for a clean start.
    stopCurrentSource();
    isPlaying = false;
    pauseOffset = 0;
    playPauseBtn.textContent = 'Play';
    applyResetSettings();

    setControlsEnabled(true);
    updateStatus(`Loaded: ${file.name}. Ready to play and apply tone changes.`);
  } catch (error) {
    console.error(error);
    updateStatus(
      'Could not load that audio file. Try another format (for example .wav or .mp3).'
    );
  }
});

playPauseBtn.addEventListener('click', () => {
  if (!audioBuffer) return;

  if (isPlaying) {
    pauseAudio();
    updateStatus('Paused playback. Press Play to continue from this position.');
  } else {
    playAudio();
    updateStatus('Playing audio. Try a tone button while it plays.');
  }
});

effectButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!audioBuffer) return;
    const effectName = button.dataset.effect;
    applyEffect(effectName);
  });
});

resetBtn.addEventListener('click', () => {
  if (!audioBuffer) return;

  applyResetSettings();
  updateStatus('Reset: returned filters and volume to their default values.');
});

// Version 1 prototype using the Web Audio API.
// This update uses a chatbox command flow instead of tone control buttons.

const audioFileInput = document.getElementById('audioFile');
const vocalsStatus = document.getElementById('vocalsStatus');
const playPauseBtn = document.getElementById('playPauseBtn');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatHistory = document.getElementById('chatHistory');
const chipButtons = document.querySelectorAll('.chip');

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

// Small command map for easy future extension (for example, connecting to visual dials later).
const commandMap = {
  darker: {
    match: ['darker'],
    noAudioResponse:
      'I can make it darker by reducing highs. Upload demo audio to hear the change.',
  },
  brighter: {
    match: ['brighter'],
    noAudioResponse:
      'I can make it brighter by boosting highs. Upload demo audio to hear the change.',
  },
  warmer: {
    match: ['warmer'],
    noAudioResponse:
      'I can make it warmer by adding low-mid body. Upload demo audio to hear the change.',
  },
  louder: {
    match: ['louder'],
    noAudioResponse:
      'I can make it louder with careful gain. Upload demo audio to hear the change.',
  },
  reset: {
    match: ['reset'],
    noAudioResponse:
      'I can reset all tone settings to default. Upload demo audio to hear the reset result.',
  },
};

function addMessage(role, text) {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  message.textContent = `${role === 'user' ? 'You' : 'Assistant'}: ${text}`;
  chatHistory.appendChild(message);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function initAudioGraph() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

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

  sourceNode.start(0, offsetSeconds);
  startTime = audioContext.currentTime - offsetSeconds;
  isPlaying = true;
  playPauseBtn.textContent = 'Pause';

  sourceNode.onended = () => {
    if (isPlaying) {
      isPlaying = false;
      pauseOffset = 0;
      playPauseBtn.textContent = 'Play';
      addMessage('assistant', 'Playback finished. Press Play to listen again.');
    }
  };
}

function playAudio() {
  if (!audioBuffer) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  createAndStartSource(pauseOffset);
}

function pauseAudio() {
  if (!isPlaying) return;

  pauseOffset = audioContext.currentTime - startTime;
  stopCurrentSource();
  isPlaying = false;
  playPauseBtn.textContent = 'Play';
}

function setControlsEnabled(enabled) {
  playPauseBtn.disabled = !enabled;
}

function applyEffect(effectName) {
  switch (effectName) {
    case 'darker':
      highShelfFilter.gain.value = -8;
      peakingFilter.gain.value = -1;
      return 'Applied “make it darker”: reduced high frequencies for a smoother top end.';

    case 'brighter':
      highShelfFilter.gain.value = 7;
      peakingFilter.gain.value = 0;
      return 'Applied “make it brighter”: boosted high frequencies for more clarity.';

    case 'warmer':
      peakingFilter.gain.value = 4;
      highShelfFilter.gain.value = -2;
      lowShelfFilter.gain.value = 2;
      return 'Applied “make it warmer”: added low-mid body and softened highs.';

    case 'louder':
      outputGain.gain.value = Math.min(outputGain.gain.value + 0.2, 1.6);
      return 'Applied “make it louder”: raised output gain a little (with a safety cap).';

    case 'reset':
      applyResetSettings();
      return 'Applied “reset”: returned filters and volume to default values.';

    default:
      return '';
  }
}

function commandToEffect(commandText) {
  const normalized = commandText.toLowerCase().trim();

  for (const [effectName, config] of Object.entries(commandMap)) {
    const matched = config.match.some((keyword) => normalized.includes(keyword));
    if (matched) return effectName;
  }

  return null;
}

function submitCommand(commandText) {
  addMessage('user', commandText);

  const effectName = commandToEffect(commandText);

  if (!effectName) {
    addMessage(
      'assistant',
      'I did not understand that yet. Try: make it darker, make it brighter, make it warmer, make it louder, or reset.'
    );
    return;
  }

  if (!audioBuffer) {
    addMessage('assistant', commandMap[effectName].noAudioResponse);
    return;
  }

  const response = applyEffect(effectName);
  addMessage('assistant', response);
}

// Handle file upload (still single-track for this V1).
audioFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    if (!audioContext) {
      initAudioGraph();
    }

    const fileArrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(fileArrayBuffer);

    stopCurrentSource();
    isPlaying = false;
    pauseOffset = 0;
    playPauseBtn.textContent = 'Play';
    applyResetSettings();

    setControlsEnabled(true);
    vocalsStatus.textContent = `Loaded: ${file.name}`;
    addMessage('assistant', `Loaded demo audio: ${file.name}. Press Play or send a chat command.`);
  } catch (error) {
    console.error(error);
    addMessage(
      'assistant',
      'Could not load that file. Try another format like .wav or .mp3.'
    );
  }
});

playPauseBtn.addEventListener('click', () => {
  if (!audioBuffer) return;

  if (isPlaying) {
    pauseAudio();
    addMessage('assistant', 'Paused playback. Press Play to continue from this position.');
  } else {
    playAudio();
    addMessage('assistant', 'Playing audio. You can send chat commands while it plays.');
  }
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const commandText = chatInput.value.trim();

  if (!commandText) return;

  submitCommand(commandText);
  chatInput.value = '';
});

chipButtons.forEach((chip) => {
  chip.addEventListener('click', () => {
    // Behaves like typing an example and submitting.
    const commandText = chip.dataset.command;
    chatInput.value = commandText;
    submitCommand(commandText);
    chatInput.value = '';
  });
});

// Version 1 prototype using the Web Audio API.
// This update uses a chatbox command flow instead of tone control buttons.

const audioFileInput = document.getElementById('audioFile');
const vocalsStatus = document.getElementById('vocalsStatus');
const playPauseBtn = document.getElementById('playPauseBtn');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatHistory = document.getElementById('chatHistory');
const chipButtons = document.querySelectorAll('.chip');
const trackRows = document.querySelectorAll('.track-row');
const selectedTrackDisplay = document.getElementById('selectedTrackDisplay');


// Keep sound settings sliders visually responsive (placeholder UI state only).
const settingSliders = document.querySelectorAll('.setting-slider');
settingSliders.forEach((slider) => {
  slider.title = slider.value;
  slider.addEventListener('input', () => {
    slider.title = slider.value;
  });
});
const lowsSlider = document.getElementById('lowsSlider');
const midsSlider = document.getElementById('midsSlider');
const highsSlider = document.getElementById('highsSlider');
const warmthSlider = document.getElementById('warmthSlider');
const spaceSlider = document.getElementById('spaceSlider');
const punchSlider = document.getElementById('punchSlider');
const widthSlider = document.getElementById('widthSlider');
const volumeSlider = document.getElementById('volumeSlider');
const statusByTrack = {
  Vocals: document.getElementById('vocalsStatus'),
  Guitar: document.getElementById('guitarStatus'),
  Drums: document.getElementById('drumsStatus'),
  Piano: document.getElementById('pianoStatus'),
};

// Audio state
let audioContext;
let audioBuffer = null;
let sourceNode = null;
let isPlaying = false;
let startTime = 0;
let pauseOffset = 0;
let selectedTrack = '';

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

function clampSlider(value) {
  return Math.max(0, Math.min(100, value));
}

function setSliderValue(slider, value) {
  if (!slider) return;
  slider.value = clampSlider(value);
  slider.title = slider.value;
}

function syncSlidersFromAudioState() {
  if (!audioContext) return;
  setSliderValue(lowsSlider, 50 + lowShelfFilter.gain.value * 4);
  setSliderValue(midsSlider, 50 + peakingFilter.gain.value * 4);
  setSliderValue(highsSlider, 50 + highShelfFilter.gain.value * 4);
  setSliderValue(volumeSlider, outputGain.gain.value * 50);
}

function resetAllSliders() {
  setSliderValue(lowsSlider, 50);
  setSliderValue(midsSlider, 50);
  setSliderValue(highsSlider, 50);
  setSliderValue(warmthSlider, 50);
  // Visual placeholders for future audio engine work:
  setSliderValue(spaceSlider, 50);
  setSliderValue(punchSlider, 50);
  setSliderValue(widthSlider, 50);
  setSliderValue(volumeSlider, 50);
}

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
  resetAllSliders();
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
      setSliderValue(highsSlider, Number(highsSlider.value) - 18);
      setSliderValue(warmthSlider, Number(warmthSlider.value) + 8);
      return 'Applied “make it darker”: reduced high frequencies for a smoother top end.';

    case 'brighter':
      highShelfFilter.gain.value = 7;
      peakingFilter.gain.value = 0;
      setSliderValue(highsSlider, Number(highsSlider.value) + 18);
      setSliderValue(midsSlider, Number(midsSlider.value) + 8);
      return 'Applied “make it brighter”: boosted high frequencies for more clarity.';

    case 'warmer':
      peakingFilter.gain.value = 4;
      highShelfFilter.gain.value = -2;
      lowShelfFilter.gain.value = 2;
      setSliderValue(warmthSlider, Number(warmthSlider.value) + 16);
      setSliderValue(lowsSlider, Number(lowsSlider.value) + 8);
      setSliderValue(highsSlider, Number(highsSlider.value) - 8);
      return 'Applied “make it warmer”: added low-mid body and softened highs.';

    case 'louder':
      outputGain.gain.value = Math.min(outputGain.gain.value + 0.2, 1.6);
      setSliderValue(volumeSlider, Number(volumeSlider.value) + 10);
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
    addMessage(
      'assistant',
      `${commandMap[effectName].noAudioResponse} (Target: ${selectedTrack || 'Overall mix'})`
    );
    return;
  }

  applyEffect(effectName);
  const response =
    effectName === 'reset'
      ? 'Reset tone settings'
      : selectedTrack
        ? `Applied a ${effectName} tone to ${selectedTrack}.`
        : `Applied this change to the overall mix.`;
  syncSlidersFromAudioState();
  addMessage('assistant', response);
}

async function loadAudioFile(file, trackName = 'Vocals') {
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
    if (statusByTrack[trackName]) {
      statusByTrack[trackName].textContent = `Loaded: ${file.name}`;
    } else {
      vocalsStatus.textContent = `Loaded: ${file.name}`;
    }
    addMessage('assistant', `Loaded demo audio on ${trackName}: ${file.name}. Press Play or send a chat command.`);
  } catch (error) {
    console.error(error);
    addMessage(
      'assistant',
      'Could not load that file. Try another format like .wav or .mp3.'
    );
  }
}

// Hidden file input remains as a fallback path, but main UI now uses drag-and-drop.
audioFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  await loadAudioFile(file, 'Vocals');
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

settingSliders.forEach((slider) => {
  slider.addEventListener('input', () => {
    if (!audioContext) return;
    // Functional sliders mapped to existing safe audio nodes.
    lowShelfFilter.gain.value = (Number(lowsSlider.value) - 50) / 4;
    peakingFilter.gain.value = (Number(midsSlider.value) - 50) / 4;
    highShelfFilter.gain.value = (Number(highsSlider.value) - 50) / 4;
    outputGain.gain.value = Math.max(0, Number(volumeSlider.value) / 50);
    // Warmth/Space/Punch/Width are visual placeholders for now.
  });
});

trackRows.forEach((row) => {
  row.addEventListener('click', () => {
    trackRows.forEach((item) => item.classList.remove('selected'));
    row.classList.add('selected');
    selectedTrack = row.dataset.track || '';
    selectedTrackDisplay.textContent = `Editing: ${selectedTrack || 'Overall mix'}`;
  });

  row.addEventListener('dragover', (event) => {
    event.preventDefault();
    row.classList.add('drag-over');
  });

  row.addEventListener('dragleave', () => {
    row.classList.remove('drag-over');
  });

  row.addEventListener('drop', async (event) => {
    event.preventDefault();
    row.classList.remove('drag-over');
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('audio/')) {
      addMessage('assistant', 'Please drop an audio file like .wav or .mp3.');
      return;
    }
    const trackName = row.dataset.track || 'Vocals';
    await loadAudioFile(file, trackName);
  });
});

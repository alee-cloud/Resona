// Version 2 prototype using the Web Audio API.

const audioFileInput = document.getElementById('audioFile');
const vocalsStatus = document.getElementById('vocalsStatus');
const playPauseBtn = document.getElementById('playPauseBtn');
const abToggleBtn = document.getElementById('abToggleBtn');
const abModeLabel = document.getElementById('abModeLabel');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatHistory = document.getElementById('chatHistory');
const chipButtons = document.querySelectorAll('.chip');
const trackRows = document.querySelectorAll('.track-row');
const selectedTrackDisplay = document.getElementById('selectedTrackDisplay');
const playhead = document.getElementById('playhead');
const trackList = document.querySelector('.track-list');

const lowsSlider = document.getElementById('lowsSlider');
const midsSlider = document.getElementById('midsSlider');
const highsSlider = document.getElementById('highsSlider');
const warmthSlider = document.getElementById('warmthSlider');
const spaceSlider = document.getElementById('spaceSlider');
const punchSlider = document.getElementById('punchSlider');
const widthSlider = document.getElementById('widthSlider');
const volumeSlider = document.getElementById('volumeSlider');
const settingSliders = document.querySelectorAll('.setting-slider');

const statusByTrack = {
  Vocals: document.getElementById('vocalsStatus'),
  Guitar: document.getElementById('guitarStatus'),
  Drums: document.getElementById('drumsStatus'),
  Piano: document.getElementById('pianoStatus')
};

let audioContext;
let sourceNode = null;
let isPlaying = false;
let startTime = 0;
let pauseOffset = 0;
let selectedTracks = [];
let playheadFrame = null;
let isDraggingSelection = false;
let monitoringMode = 'processed';

// basic per-track architecture (single active source for now)
const tracks = {
  Master: { name: 'Master', audioBuffer: null, sourceFileName: '' },
  Vocals: { name: 'Vocals', audioBuffer: null, sourceFileName: '' },
  Guitar: { name: 'Guitar', audioBuffer: null, sourceFileName: '' },
  Drums: { name: 'Drums', audioBuffer: null, sourceFileName: '' },
  Piano: { name: 'Piano', audioBuffer: null, sourceFileName: '' }
};

let lowShelfFilter;
let peakingFilter;
let highShelfFilter;
let outputGain;
let dryGain;

const defaults = { lowShelfGain: 0, peakingGain: 0, highShelfGain: 0, masterGain: 1 };
const RAMP_SECONDS = 0.18;

function addMessage(role, text) {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  message.textContent = `${role === 'user' ? 'You' : 'Assistant'}: ${text}`;
  chatHistory.appendChild(message);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function clampSlider(value) { return Math.max(0, Math.min(100, value)); }
function setSliderValue(slider, value) { slider.value = clampSlider(value); slider.title = slider.value; }


function refreshDialUI(slider) {
  const wrap = slider.closest('.dial-control');
  if (!wrap) return;
  const knob = wrap.querySelector('.dial-knob');
  const indicator = wrap.querySelector('.dial-indicator');
  const value = wrap.querySelector('.dial-value');
  const numeric = Number(slider.value);
  const ratio = numeric / 100;
  const angle = -135 + ratio * 270;
  knob.style.background = `conic-gradient(var(--accent) ${ratio * 270}deg, #e5e7eb 0deg)`;
  indicator.style.transform = `translateX(-50%) rotate(${angle}deg)`;
  value.textContent = String(numeric);
  knob.setAttribute('role', 'slider');
  knob.setAttribute('aria-valuemin', slider.min);
  knob.setAttribute('aria-valuemax', slider.max);
  knob.setAttribute('aria-valuenow', slider.value);
}

function nudgeDial(slider, delta) {
  setSliderValue(slider, Number(slider.value) + delta);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}

function scheduleParam(param, target) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + RAMP_SECONDS);
}

function setFilterState({ lows, mids, highs, volume }) {
  scheduleParam(lowShelfFilter.gain, lows);
  scheduleParam(peakingFilter.gain, mids);
  scheduleParam(highShelfFilter.gain, highs);
  scheduleParam(outputGain.gain, volume);
}

function activeTrackName() {
  return selectedTracks.find((t) => t !== 'Master') || 'Vocals';
}

function currentBuffer() {
  return tracks[activeTrackName()]?.audioBuffer || tracks.Vocals.audioBuffer;
}

function syncSlidersFromAudioState() {
  if (!audioContext) return;
  setSliderValue(lowsSlider, 50 + lowShelfFilter.gain.value * 4);
  setSliderValue(midsSlider, 50 + peakingFilter.gain.value * 4);
  setSliderValue(highsSlider, 50 + highShelfFilter.gain.value * 4);
  setSliderValue(volumeSlider, outputGain.gain.value * 50);
}

function updateABModeUI() {
  const isOriginal = monitoringMode === 'original';
  abModeLabel.textContent = isOriginal ? 'Monitoring: Original' : 'Monitoring: Processed';
  abToggleBtn.textContent = isOriginal ? 'Switch to Processed (B)' : 'Switch to Original (A)';
  if (!audioContext) return;
  scheduleParam(dryGain.gain, isOriginal ? 1 : 0);
}

function resetAllSliders() {
  [lowsSlider, midsSlider, highsSlider, warmthSlider, spaceSlider, punchSlider, widthSlider, volumeSlider].forEach((slider, i) => {
    setSliderValue(slider, i === 7 ? 50 : 50);
  });
}

function getSelectionTargetText() {
  if (!selectedTracks.length) return 'overall mix';
  if (selectedTracks.includes('Master')) return 'Master / overall mix';
  return selectedTracks.join(' and ');
}

function updateSelectedTrackDisplay() {
  selectedTrackDisplay.textContent = selectedTracks.length ? `Editing: ${selectedTracks.join(', ')}` : 'Editing: Overall mix';
}

function setSelectedTracks(trackNames) {
  selectedTracks = [...new Set(trackNames)];
  trackRows.forEach((item) => item.classList.toggle('selected', selectedTracks.includes(item.dataset.track || '')));
  updateSelectedTrackDisplay();
}

function updatePlayheadPosition() {
  const audioBuffer = currentBuffer();
  if (!audioBuffer || !isPlaying) return;
  const elapsed = audioContext.currentTime - startTime;
  playhead.style.left = `${Math.max(0, Math.min(1, elapsed / audioBuffer.duration)) * 100}%`;
  playheadFrame = window.requestAnimationFrame(updatePlayheadPosition);
}

function startPlayheadAnimation() { if (playheadFrame) window.cancelAnimationFrame(playheadFrame); playheadFrame = window.requestAnimationFrame(updatePlayheadPosition); }
function pausePlayheadAnimation() { if (playheadFrame) window.cancelAnimationFrame(playheadFrame); playheadFrame = null; }
function resetPlayhead() { pausePlayheadAnimation(); playhead.style.left = '0%'; }

function initAudioGraph() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  lowShelfFilter = audioContext.createBiquadFilter();
  lowShelfFilter.type = 'lowshelf'; lowShelfFilter.frequency.value = 220;
  peakingFilter = audioContext.createBiquadFilter();
  peakingFilter.type = 'peaking'; peakingFilter.frequency.value = 450; peakingFilter.Q.value = 0.8;
  highShelfFilter = audioContext.createBiquadFilter();
  highShelfFilter.type = 'highshelf'; highShelfFilter.frequency.value = 4200;
  outputGain = audioContext.createGain();
  dryGain = audioContext.createGain();

  lowShelfFilter.connect(peakingFilter);
  peakingFilter.connect(highShelfFilter);
  highShelfFilter.connect(outputGain);
  outputGain.connect(audioContext.destination);
  dryGain.connect(audioContext.destination);

  applyResetSettings();
  updateABModeUI();
}

function applyResetSettings() {
  setFilterState({ lows: defaults.lowShelfGain, mids: defaults.peakingGain, highs: defaults.highShelfGain, volume: defaults.masterGain });
  resetAllSliders();
}

function stopCurrentSource() {
  if (!sourceNode) return;
  try { sourceNode.stop(); } catch {}
  sourceNode.disconnect();
  sourceNode = null;
}

function createAndStartSource(offsetSeconds) {
  const audioBuffer = currentBuffer();
  if (!audioBuffer) return;
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(lowShelfFilter);
  sourceNode.connect(dryGain);
  sourceNode.start(0, offsetSeconds);
  startTime = audioContext.currentTime - offsetSeconds;
  isPlaying = true;
  playPauseBtn.textContent = 'Pause';
  startPlayheadAnimation();
  sourceNode.onended = () => {
    if (!isPlaying) return;
    isPlaying = false; pauseOffset = 0; playPauseBtn.textContent = 'Play'; resetPlayhead();
    addMessage('assistant', 'Playback finished. Press Play to listen again.');
  };
}

function playAudio() { if (audioContext.state === 'suspended') audioContext.resume(); createAndStartSource(pauseOffset); }
function pauseAudio() { pauseOffset = audioContext.currentTime - startTime; stopCurrentSource(); isPlaying = false; playPauseBtn.textContent = 'Play'; pausePlayheadAnimation(); }

function parseCommand(commandText) {
  const normalized = commandText.toLowerCase().trim();
  const intensity = normalized.includes('slightly') ? 0.6 : normalized.includes('a lot') || normalized.includes('much') ? 1.5 : 1;
  const rules = [
    { test: /(dark|darker|less bright)/, action: 'tone', delta: { highs: -8, mids: -1 }, response: 'darker' },
    { test: /(bright|brighter|sparkle)/, action: 'tone', delta: { highs: 7, mids: 1 }, response: 'brighter' },
    { test: /(warm|warmer)/, action: 'tone', delta: { lows: 2, mids: 4, highs: -2 }, response: 'warmer' },
    { test: /(loud|louder|volume up)/, action: 'volume', delta: 0.2, response: 'louder' },
    { test: /(reset|default)/, action: 'reset', response: 'reset' },
    { test: /(original|a\/b\s*a|compare\s*original)/, action: 'ab_original', response: 'A/original' },
    { test: /(processed|a\/b\s*b|compare\s*processed)/, action: 'ab_processed', response: 'B/processed' }
  ];
  const matched = rules.find((rule) => rule.test.test(normalized));
  if (!matched) return null;
  return { ...matched, intensity };
}

function applyParsedCommand(parsed) {
  if (parsed.action === 'reset') {
    applyResetSettings();
    return 'Applied reset to default tone settings.';
  }
  if (parsed.action === 'ab_original') {
    monitoringMode = 'original'; updateABModeUI(); return 'A/B compare set to Original (A).';
  }
  if (parsed.action === 'ab_processed') {
    monitoringMode = 'processed'; updateABModeUI(); return 'A/B compare set to Processed (B).';
  }
  if (parsed.action === 'volume') {
    const next = Math.min(outputGain.gain.value + parsed.delta * parsed.intensity, 1.6);
    scheduleParam(outputGain.gain, next);
    setSliderValue(volumeSlider, next * 50);
    return 'Applied louder adjustment with smooth ramping.';
  }
  const lows = lowShelfFilter.gain.value + (parsed.delta.lows || 0) * parsed.intensity;
  const mids = peakingFilter.gain.value + (parsed.delta.mids || 0) * parsed.intensity;
  const highs = highShelfFilter.gain.value + (parsed.delta.highs || 0) * parsed.intensity;
  setFilterState({ lows, mids, highs, volume: outputGain.gain.value });
  syncSlidersFromAudioState();
  return `Applied ${parsed.response} tone move with smooth parameter ramps.`;
}

function submitCommand(commandText) {
  addMessage('user', commandText);
  const parsed = parseCommand(commandText);
  if (!parsed) {
    addMessage('assistant', 'I did not understand that yet. Try: warmer, brighter, darker, louder, reset, original, processed.');
    return;
  }
  if (!currentBuffer() && !parsed.action.startsWith('ab_')) {
    addMessage('assistant', `I can do that after you load audio. (Target: ${getSelectionTargetText()})`);
    return;
  }
  const response = applyParsedCommand(parsed);
  addMessage('assistant', `${response} Target: ${getSelectionTargetText()}.`);
}

async function loadAudioFile(file, trackName = 'Vocals') {
  if (!file) return;
  try {
    if (!audioContext) initAudioGraph();
    const fileArrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(fileArrayBuffer);
    tracks[trackName].audioBuffer = decoded;
    tracks[trackName].sourceFileName = file.name;
    stopCurrentSource(); isPlaying = false; pauseOffset = 0; playPauseBtn.textContent = 'Play'; resetPlayhead();
    playPauseBtn.disabled = false;
    statusByTrack[trackName].textContent = `Loaded: ${file.name}`;
    addMessage('assistant', `Loaded audio on ${trackName}: ${file.name}.`);
  } catch (error) {
    console.error(error);
    addMessage('assistant', 'Could not load that file. Try .wav or .mp3.');
  }
}

audioFileInput.addEventListener('change', async (event) => loadAudioFile(event.target.files[0], 'Vocals'));
playPauseBtn.addEventListener('click', () => { if (!currentBuffer()) return; isPlaying ? pauseAudio() : playAudio(); });
abToggleBtn.addEventListener('click', () => { monitoringMode = monitoringMode === 'processed' ? 'original' : 'processed'; updateABModeUI(); addMessage('assistant', `Switched monitor to ${monitoringMode}.`); });
chatForm.addEventListener('submit', (event) => { event.preventDefault(); const text = chatInput.value.trim(); if (!text) return; submitCommand(text); chatInput.value = ''; });
chipButtons.forEach((chip) => chip.addEventListener('click', () => { const text = chip.dataset.command; submitCommand(text); }));

settingSliders.forEach((slider) => {
  const dialControl = slider.closest('.dial-control');
  const dialButton = dialControl?.querySelector('.dial-knob');
  slider.title = slider.value;
  refreshDialUI(slider);

  slider.addEventListener('input', () => {
    slider.title = slider.value;
    refreshDialUI(slider);
    if (!audioContext) return;
    setFilterState({
      lows: (Number(lowsSlider.value) - 50) / 4,
      mids: (Number(midsSlider.value) - 50) / 4,
      highs: (Number(highsSlider.value) - 50) / 4,
      volume: Math.max(0, Number(volumeSlider.value) / 50)
    });
  });

  if (dialButton) {
    dialButton.addEventListener('click', () => dialButton.focus());
    dialButton.addEventListener('wheel', (event) => {
      event.preventDefault();
      nudgeDial(slider, event.deltaY < 0 ? 1 : -1);
    }, { passive: false });
    dialButton.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); nudgeDial(slider, 1); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); nudgeDial(slider, -1); }
      if (event.key === 'PageUp') { event.preventDefault(); nudgeDial(slider, 5); }
      if (event.key === 'PageDown') { event.preventDefault(); nudgeDial(slider, -5); }
      if (event.key === 'Home') { event.preventDefault(); setSliderValue(slider, 0); slider.dispatchEvent(new Event('input', { bubbles: true })); }
      if (event.key === 'End') { event.preventDefault(); setSliderValue(slider, 100); slider.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }
});

trackList.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  const row = event.target.closest('.track-row');
  if (!row) return;
  isDraggingSelection = true;
  setSelectedTracks([row.dataset.track || '']);
  event.preventDefault();
});
trackList.addEventListener('mouseover', (event) => {
  if (!isDraggingSelection) return;
  const row = event.target.closest('.track-row');
  if (!row) return;
  const trackName = row.dataset.track || '';
  if (!selectedTracks.includes(trackName)) setSelectedTracks([...selectedTracks, trackName]);
});
window.addEventListener('mouseup', () => { isDraggingSelection = false; });

trackRows.forEach((row) => {
  row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('drag-over'); });
  row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
  row.addEventListener('drop', async (event) => {
    event.preventDefault(); row.classList.remove('drag-over');
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('audio/')) { addMessage('assistant', 'Please drop an audio file like .wav or .mp3.'); return; }
    const trackName = row.dataset.track || 'Vocals';
    await loadAudioFile(file, trackName);
  });
});

updateABModeUI();

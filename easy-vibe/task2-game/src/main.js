import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { Input } from './input.js';

const byId = (id) => document.getElementById(id);

const ui = {
  score: byId('score'),
  wave: byId('wave'),
  time: byId('time'),
  waveBar: byId('waveBar'),
  lives: byId('lives'),
  autoFire: byId('autoFire'),
  buff: byId('buff'),
  buffFill: byId('buffFill'),
  buffTime: byId('buffTime'),
  startScreen: byId('startScreen'),
  overScreen: byId('overScreen'),
  pauseScreen: byId('pauseScreen'),
  startBtn: byId('startBtn'),
  retryBtn: byId('retryBtn'),
  resumeBtn: byId('resumeBtn'),
  finalScore: byId('finalScore'),
  finalKills: byId('finalKills'),
  startBest: byId('startBest'),
  finalBest: byId('finalBest'),
  newRecord: byId('newRecord'),
};

const audio = new AudioEngine();
const input = new Input();
const game = new Game({ canvas: byId('game'), input, ui, audio });

input.onConfirm = () => {
  if (game.state === 'menu' || game.state === 'over') game.start();
};

input.onPause = () => game.togglePause();

const soundBtn = byId('soundBtn');
const syncSoundButton = () => {
  soundBtn.classList.toggle('muted', audio.muted);
  soundBtn.setAttribute('aria-pressed', String(audio.muted));
  soundBtn.setAttribute('aria-label', audio.muted ? '开启音效' : '关闭音效');
};

soundBtn.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  syncSoundButton();
});

window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

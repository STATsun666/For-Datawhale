import {
  Enemy,
  Pickup,
  Player,
  circlesOverlap,
  createExplosion,
  rand,
} from './entities.js';

const VIEW_W = 480;
const VIEW_H = 800;
const MAX_HP = 3;
const WAVE_SCORE_STEP = 1000;
const SPREAD_DURATION = 8;
const HEAVY_DROP_CHANCE = 0.5;
const SPREAD_DROP_RATE = 0.65;
const BEST_SCORE_KEY = 'neon-starfighter-best';
const STAR_TINTS = ['191, 233, 255', '158, 247, 255', '211, 190, 255', '255, 198, 226'];

const formatTime = (seconds) => {
  const total = Math.floor(seconds);
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
};

export class Game {
  constructor({ canvas, input, ui, audio }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.ui = ui;
    this.audio = audio;

    this.state = 'menu';
    this.player = new Player(VIEW_W, VIEW_H);
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.stars = this.createStars(140);
    this.meteors = [];
    this.meteorTimer = rand(3, 7);

    this.score = 0;
    this.kills = 0;
    this.hp = MAX_HP;
    this.elapsed = 0;
    this.wave = 1;
    this.spawnTimer = 0.7;
    this.spreadTimer = 0;
    this.shake = 0;
    this.damageFlash = 0;
    this.waveFlash = 0;
    this.time = 0;
    this.dpr = 1;
    this.bgGradient = null;
    this.autoFire = this.ui.autoFire.checked;
    this.best = this.readBestScore();

    this.lifeEls = [];
    for (let i = 0; i < MAX_HP; i += 1) {
      const heart = document.createElement('i');
      heart.textContent = '♥';
      this.ui.lives.appendChild(heart);
      this.lifeEls.push(heart);
    }

    this.ui.autoFire.addEventListener('change', (event) => {
      this.autoFire = event.target.checked;
    });
    this.ui.startBtn.addEventListener('click', () => this.start());
    this.ui.retryBtn.addEventListener('click', () => this.start());
    this.ui.resumeBtn.addEventListener('click', () => this.resume());

    window.addEventListener('resize', () => this.resize());
    this.ui.startBest.textContent = String(this.best);
    this.ui.finalBest.textContent = String(this.best);
    this.resize();
    this.updateLives();
    this.syncHud();

    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* ------------------------------ 状态流转 ------------------------------ */

  start() {
    this.state = 'playing';
    this.score = 0;
    this.kills = 0;
    this.hp = MAX_HP;
    this.elapsed = 0;
    this.wave = 1;
    this.spawnTimer = 0.7;
    this.spreadTimer = 0;
    this.shake = 0;
    this.damageFlash = 0;
    this.waveFlash = 1.2;
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.autoFire = this.ui.autoFire.checked;
    this.player.reset();
    this.input.reset();

    if (this.audio) this.audio.unlock();

    this.ui.startBtn.blur();
    this.ui.retryBtn.blur();
    this.ui.startScreen.classList.add('hidden');
    this.ui.overScreen.classList.add('hidden');
    this.ui.pauseScreen.classList.add('hidden');
    this.ui.newRecord.classList.add('hidden');
    this.ui.buff.classList.remove('on');

    this.updateLives();
    this.syncHud();
  }

  endGame() {
    this.state = 'over';
    if (this.audio) this.audio.explosion(1.4);

    const isRecord = this.score > this.best && this.score > 0;
    if (isRecord) {
      this.best = this.score;
      this.saveBestScore(this.best);
    }

    this.ui.finalScore.textContent = String(this.score);
    this.ui.finalKills.textContent = String(this.kills);
    this.ui.finalBest.textContent = String(this.best);
    this.ui.startBest.textContent = String(this.best);
    this.ui.newRecord.classList.toggle('hidden', !isRecord);
    this.ui.overScreen.classList.remove('hidden');
  }

  /* ------------------------------ 暂停 / 最高分 ------------------------------ */

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  pause() {
    this.state = 'paused';
    this.input.reset();
    this.ui.pauseScreen.classList.remove('hidden');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.resumeBtn.blur();
    this.ui.pauseScreen.classList.add('hidden');
  }

  readBestScore() {
    try {
      const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY));
      return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
    } catch {
      return 0;
    }
  }

  saveBestScore(value) {
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(value));
    } catch {
      // 隐私模式等场景下 localStorage 不可用，忽略即可
    }
  }

  /* ------------------------------ 主循环 ------------------------------ */

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;
    this.time += dt;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    if (this.state === 'paused') return;

    this.updateStars(dt);

    if (this.state === 'playing') {
      this.elapsed += dt;

      if (this.spreadTimer > 0) {
        this.spreadTimer = Math.max(0, this.spreadTimer - dt);
      }

      this.updatePlayer(dt);
      this.updateBullets(dt);
      this.updateSpawner(dt);
      this.updateEnemies(dt);
      this.updatePickups(dt);
      this.resolveCollisions();

      const nextWave = 1 + Math.floor(this.score / WAVE_SCORE_STEP);
      if (nextWave > this.wave) {
        this.wave = nextWave;
        this.waveFlash = 1.6;
        if (this.audio) this.audio.waveUp();
      }

      this.syncHud();
    }

    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
    this.waveFlash = Math.max(0, this.waveFlash - dt);
  }

  updatePlayer(dt) {
    this.player.update(dt, this.input.state);
    const firing = this.autoFire || this.input.state.fire;
    if (firing && this.player.canFire()) {
      this.bullets.push(...this.player.fire(this.spreadTimer > 0));
      if (this.audio) this.audio.shoot();
    }
  }

  updateBullets(dt) {
    for (const bullet of this.bullets) bullet.update(dt);
    this.bullets = this.bullets.filter(
      (bullet) => bullet.alive && bullet.x > -30 && bullet.x < VIEW_W + 30,
    );
  }

  updateSpawner(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    this.enemies.push(this.createEnemy());
    const baseInterval = Math.max(0.24, 0.85 - (this.wave - 1) * 0.075);
    this.spawnTimer = baseInterval * rand(0.7, 1.2);
  }

  createEnemy() {
    const roll = Math.random();
    let type = 'scout';
    if (roll < 0.22) type = 'dart';
    else if (this.wave >= 2 && roll > 0.82) type = 'heavy';

    return new Enemy(rand(40, VIEW_W - 40), type, this.wave);
  }

  updateEnemies(dt) {
    for (const enemy of this.enemies) {
      enemy.update(dt, VIEW_W);
      if (enemy.alive && enemy.y - enemy.radius > VIEW_H + 10) {
        enemy.alive = false;
        this.damagePlayer();
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.alive);
  }

  updatePickups(dt) {
    for (const pickup of this.pickups) {
      pickup.update(dt);
      if (!pickup.alive) continue;

      if (circlesOverlap(pickup, this.player)) {
        pickup.alive = false;
        this.applyPickup(pickup.type);
      } else if (pickup.y - pickup.radius > VIEW_H) {
        pickup.alive = false;
      }
    }
    this.pickups = this.pickups.filter((pickup) => pickup.alive);
  }

  applyPickup(type) {
    if (type === 'repair') {
      this.hp = Math.min(MAX_HP, this.hp + 1);
      this.updateLives();
      this.particles.push(...createExplosion(this.player.x, this.player.y - 10, '#5effb0', 16, 170));
    } else {
      this.spreadTimer = SPREAD_DURATION;
      this.particles.push(...createExplosion(this.player.x, this.player.y - 10, '#ffd166', 16, 170));
    }
    if (this.audio) this.audio.pickup();
  }

  resolveCollisions() {
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (!circlesOverlap(bullet, enemy)) continue;

        bullet.alive = false;
        const destroyed = enemy.hit(1);
        this.particles.push(...createExplosion(bullet.x, bullet.y, '#9df8ff', 4, 90));

        if (destroyed) {
          enemy.alive = false;
          this.kills += 1;
          this.score += enemy.score;
          this.shake = Math.max(this.shake, 6);
          this.particles.push(...createExplosion(enemy.x, enemy.y, enemy.color, 24, 280));
          if (this.audio) this.audio.explosion(enemy.type === 'heavy' ? 1.3 : 1);

          if (enemy.type === 'heavy' && Math.random() < HEAVY_DROP_CHANCE) {
            const dropType = Math.random() < SPREAD_DROP_RATE ? 'spread' : 'repair';
            this.pickups.push(new Pickup(enemy.x, enemy.y, dropType));
          }
        }
        break;
      }
    }

    if (this.state !== 'playing') return;

    if (this.player.invuln <= 0) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (circlesOverlap(this.player, enemy)) {
          enemy.alive = false;
          this.particles.push(...createExplosion(enemy.x, enemy.y, enemy.color, 18, 240));
          this.damagePlayer();
          break;
        }
      }
    }

    this.enemies = this.enemies.filter((enemy) => enemy.alive);
  }

  damagePlayer() {
    if (this.state !== 'playing') return;

    this.hp = Math.max(0, this.hp - 1);
    this.player.invuln = 1.5;
    this.shake = 14;
    this.damageFlash = 0.7;
    this.updateLives();
    this.particles.push(...createExplosion(this.player.x, this.player.y, '#5ef6ff', 14, 200));
    if (this.audio) this.audio.hurt();

    if (this.hp <= 0) {
      this.particles.push(...createExplosion(this.player.x, this.player.y, '#ff4d9d', 40, 380));
      this.endGame();
    }
  }

  updateParticles(dt) {
    const drag = Math.pow(0.15, dt);
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= drag;
      particle.vy *= drag;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  /* ------------------------------ HUD ------------------------------ */

  updateLives() {
    this.lifeEls.forEach((el, index) => {
      el.classList.toggle('on', index < this.hp);
    });
  }

  syncHud() {
    this.ui.score.textContent = String(this.score);
    this.ui.wave.textContent = String(this.wave);
    this.ui.time.textContent = formatTime(this.elapsed);

    const progress = ((this.score % WAVE_SCORE_STEP) / WAVE_SCORE_STEP) * 100;
    this.ui.waveBar.style.width = `${progress.toFixed(1)}%`;

    const buffActive = this.spreadTimer > 0;
    this.ui.buff.classList.toggle('on', buffActive);
    this.ui.buff.setAttribute('aria-hidden', String(!buffActive));
    if (buffActive) {
      this.ui.buffFill.style.width = `${((this.spreadTimer / SPREAD_DURATION) * 100).toFixed(1)}%`;
      this.ui.buffTime.textContent = `${this.spreadTimer.toFixed(1)}s`;
    }
  }

  /* ------------------------------ 绘制 ------------------------------ */

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(VIEW_W * this.dpr);
    this.canvas.height = Math.round(VIEW_H * this.dpr);
    this.bgGradient = null;
  }

  createStars(count) {
    return Array.from({ length: count }, () => ({
      x: Math.random() * VIEW_W,
      y: Math.random() * VIEW_H,
      z: rand(0.15, 1),
      tint: STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)],
      phase: rand(0, Math.PI * 2),
    }));
  }

  updateStars(dt) {
    const boost = this.state === 'playing' ? 1 : 0.35;

    for (const star of this.stars) {
      star.y += (20 + star.z * 210) * boost * dt;
      star.phase += dt * (0.8 + star.z * 1.8);
      if (star.y > VIEW_H + 8) {
        star.y = -8;
        star.x = Math.random() * VIEW_W;
      }
    }

    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0) {
      this.meteorTimer = rand(3.5, 8);
      this.meteors.push({
        x: rand(VIEW_W * 0.15, VIEW_W * 0.95),
        y: rand(-20, VIEW_H * 0.2),
        vx: rand(-90, -40),
        vy: rand(280, 430),
        life: 1,
      });
    }

    for (const meteor of this.meteors) {
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      meteor.life -= dt * 0.8;
    }
    this.meteors = this.meteors.filter(
      (meteor) => meteor.life > 0 && meteor.y < VIEW_H + 80 && meteor.x > -80,
    );
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    this.drawBackground(ctx);

    ctx.save();
    if (this.shake > 0.5) {
      ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    }
    this.drawEntities(ctx);
    ctx.restore();

    this.drawVignette(ctx);

    if (this.damageFlash > 0) {
      const alpha = Math.min(1, this.damageFlash / 0.7) * 0.55;
      const gradient = ctx.createRadialGradient(
        VIEW_W / 2,
        VIEW_H / 2,
        VIEW_W * 0.18,
        VIEW_W / 2,
        VIEW_H / 2,
        VIEW_H * 0.7,
      );
      gradient.addColorStop(0, 'rgba(255, 60, 110, 0)');
      gradient.addColorStop(1, `rgba(255, 40, 96, ${alpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    this.drawWaveBanner(ctx);
  }

  drawBackground(ctx) {
    if (!this.bgGradient) {
      const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      gradient.addColorStop(0, '#05081a');
      gradient.addColorStop(0.5, '#080d24');
      gradient.addColorStop(1, '#04060f');
      this.bgGradient = gradient;
    }
    ctx.fillStyle = this.bgGradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const t = this.time;
    const nebulaA = ctx.createRadialGradient(
      VIEW_W * 0.2 + Math.sin(t * 0.25) * 30,
      VIEW_H * 0.28,
      0,
      VIEW_W * 0.25,
      VIEW_H * 0.3,
      320,
    );
    nebulaA.addColorStop(0, 'rgba(96, 44, 200, 0.26)');
    nebulaA.addColorStop(1, 'rgba(96, 44, 200, 0)');
    ctx.fillStyle = nebulaA;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const nebulaB = ctx.createRadialGradient(
      VIEW_W * 0.85,
      VIEW_H * 0.62 + Math.cos(t * 0.2) * 40,
      0,
      VIEW_W * 0.8,
      VIEW_H * 0.62,
      300,
    );
    nebulaB.addColorStop(0, 'rgba(20, 150, 220, 0.2)');
    nebulaB.addColorStop(1, 'rgba(20, 150, 220, 0)');
    ctx.fillStyle = nebulaB;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const playing = this.state === 'playing';
    for (const star of this.stars) {
      const twinkle = 0.72 + Math.sin(star.phase) * 0.28;
      const alpha = (0.25 + star.z * 0.65) * twinkle;
      ctx.fillStyle = `rgba(${star.tint}, ${alpha.toFixed(3)})`;
      if (playing && star.z > 0.6) {
        ctx.fillRect(star.x, star.y, 1.5, 4 + star.z * 12);
      } else if (star.z > 0.72) {
        ctx.fillRect(star.x, star.y, 1.6, 7 * star.z);
      } else {
        const size = star.z * 2.2;
        ctx.fillRect(star.x, star.y, size, size);
      }
    }

    ctx.lineCap = 'round';
    for (const meteor of this.meteors) {
      const tailX = meteor.x - meteor.vx * 0.16;
      const tailY = meteor.y - meteor.vy * 0.16;
      const trail = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
      trail.addColorStop(0, `rgba(210, 252, 255, ${0.85 * meteor.life})`);
      trail.addColorStop(1, 'rgba(160, 220, 255, 0)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawEntities(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (0.4 + alpha * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const bullet of this.bullets) bullet.draw(ctx);
    for (const enemy of this.enemies) enemy.draw(ctx);
    for (const pickup of this.pickups) pickup.draw(ctx);

    if (this.state !== 'over') {
      this.player.draw(ctx);
    }
  }

  drawVignette(ctx) {
    const gradient = ctx.createRadialGradient(
      VIEW_W / 2,
      VIEW_H * 0.46,
      VIEW_H * 0.22,
      VIEW_W / 2,
      VIEW_H * 0.5,
      VIEW_H * 0.62,
    );
    gradient.addColorStop(0, 'rgba(2, 4, 12, 0)');
    gradient.addColorStop(1, 'rgba(2, 4, 12, 0.62)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawWaveBanner(ctx) {
    if (this.waveFlash <= 0) return;

    const alpha = Math.min(1, this.waveFlash / 0.7);
    const scale = 1 + (1.6 - this.waveFlash) * 0.05;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(VIEW_W / 2, VIEW_H * 0.44);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = 'rgba(94, 246, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(94, 246, 255, 0.8)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-118, -30);
    ctx.lineTo(-34, -30);
    ctx.moveTo(34, -30);
    ctx.lineTo(118, -30);
    ctx.stroke();

    ctx.font = '800 34px "Segoe UI", "PingFang SC", sans-serif';
    ctx.fillStyle = '#a9fbff';
    ctx.shadowColor = 'rgba(94, 246, 255, 0.9)';
    ctx.shadowBlur = 22;
    ctx.fillText(`WAVE ${this.wave}`, 0, 0);

    ctx.shadowBlur = 0;
    ctx.font = '600 13px "Segoe UI", "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(190, 240, 255, 0.8)';
    ctx.fillText(`第 ${this.wave} 波 · 敌机来袭`, 0, 32);
    ctx.restore();
  }
}

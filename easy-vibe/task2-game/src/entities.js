export const TAU = Math.PI * 2;

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
export const rand = (min, max) => min + Math.random() * (max - min);

export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.radius + b.radius;
  return dx * dx + dy * dy <= radius * radius;
}

/* ------------------------------ 玩家战机 ------------------------------ */

export class Player {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.radius = 15;
    this.speed = 360;
    this.fireCooldown = 0;
    this.invuln = 0;
    this.tilt = 0;
    this.reset();
  }

  reset() {
    this.x = this.width / 2;
    this.y = this.height - 96;
    this.tilt = 0;
    this.fireCooldown = 0;
    this.invuln = 1.2;
  }

  update(dt, input) {
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    if (dx !== 0 && dy !== 0) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }

    this.x = clamp(this.x + dx * this.speed * dt, this.radius + 8, this.width - this.radius - 8);
    this.y = clamp(this.y + dy * this.speed * dt, this.radius + 8, this.height - this.radius - 12);

    this.tilt += (dx * 0.3 - this.tilt) * Math.min(1, dt * 12);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
  }

  canFire() {
    return this.fireCooldown <= 0;
  }

  fire(spread = false) {
    this.fireCooldown = 0.13;
    const muzzleY = this.y - 18;

    if (spread) {
      return [
        new Bullet(this.x, muzzleY - 2, 0),
        new Bullet(this.x - 8, muzzleY, -0.26),
        new Bullet(this.x + 8, muzzleY, 0.26),
      ];
    }

    return [new Bullet(this.x - 7, muzzleY), new Bullet(this.x + 7, muzzleY)];
  }

  draw(ctx) {
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);

    // 引擎尾焰
    const flame = 0.65 + Math.random() * 0.35;
    const flameGradient = ctx.createLinearGradient(0, 10, 0, 40);
    flameGradient.addColorStop(0, 'rgba(140, 250, 255, 0.9)');
    flameGradient.addColorStop(1, 'rgba(140, 250, 255, 0)');
    ctx.fillStyle = flameGradient;
    ctx.beginPath();
    ctx.moveTo(-5, 11);
    ctx.lineTo(0, 11 + 26 * flame);
    ctx.lineTo(5, 11);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.shadowColor = 'rgba(94, 246, 255, 0.9)';
    ctx.shadowBlur = 18;

    // 机身
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(16, 8);
    ctx.lineTo(7, 14);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 14);
    ctx.lineTo(-16, 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10, 30, 58, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#6ff8ff';
    ctx.stroke();

    // 机翼灯带
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-5, 1);
    ctx.moveTo(14, 6);
    ctx.lineTo(5, 1);
    ctx.strokeStyle = 'rgba(94, 246, 255, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 座舱
    ctx.beginPath();
    ctx.ellipse(0, -8, 4.5, 9, 0, 0, TAU);
    ctx.fillStyle = 'rgba(190, 255, 255, 0.95)';
    ctx.fill();

    // 受击后的护盾环
    if (this.invuln > 0) {
      ctx.globalAlpha = 0.35 + Math.sin(this.invuln * 18) * 0.15;
      ctx.strokeStyle = 'rgba(94, 246, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 12, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/* ------------------------------ 子弹 ------------------------------ */

export class Bullet {
  constructor(x, y, angle = 0) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.radius = 3;
    this.speed = 780;
    this.vx = Math.sin(angle) * this.speed;
    this.vy = -Math.cos(angle) * this.speed;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -24) this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowColor = 'rgba(120, 250, 255, 0.9)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(94, 246, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 1.8, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d9feff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.6, 9, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/* ------------------------------ 敌机 ------------------------------ */

const ENEMY_TYPES = {
  scout: {
    color: '#ff4d9d',
    glow: 'rgba(255, 77, 157, 0.85)',
    radius: 15,
    hp: 1,
    score: 100,
    minSpeed: 115,
    maxSpeed: 165,
  },
  dart: {
    color: '#ffd166',
    glow: 'rgba(255, 209, 102, 0.9)',
    radius: 11,
    hp: 1,
    score: 200,
    minSpeed: 210,
    maxSpeed: 265,
  },
  heavy: {
    color: '#b46bff',
    glow: 'rgba(180, 107, 255, 0.9)',
    radius: 24,
    hp: 3,
    score: 350,
    minSpeed: 55,
    maxSpeed: 85,
  },
};

export class Enemy {
  constructor(x, type, wave) {
    const config = ENEMY_TYPES[type];
    this.type = type;
    this.x = x;
    this.baseX = x;
    this.y = -config.radius - 10;
    this.radius = config.radius;
    this.hp = config.hp;
    this.maxHp = this.hp;
    this.score = config.score;
    this.color = config.color;
    this.glow = config.glow;
    this.speed = rand(config.minSpeed, config.maxSpeed) * (1 + (wave - 1) * 0.07);
    this.swayAmp = type === 'scout' ? rand(16, 52) : 0;
    this.swaySpeed = rand(1.2, 2.4);
    this.age = rand(0, 10);
    this.flash = 0;
    this.alive = true;
  }

  update(dt, width) {
    this.age += dt;
    this.y += this.speed * dt;
    if (this.swayAmp) {
      this.x = this.baseX + Math.sin(this.age * this.swaySpeed) * this.swayAmp;
    }
    this.x = clamp(this.x, this.radius, width - this.radius);
    this.flash = Math.max(0, this.flash - dt * 5);
  }

  hit(damage = 1) {
    this.hp -= damage;
    this.flash = 1;
    return this.hp <= 0;
  }

  draw(ctx) {
    const color = this.flash > 0.5 ? '#ffffff' : this.color;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = this.glow;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2;

    if (this.type === 'scout') {
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(-15, -11);
      ctx.lineTo(0, -4);
      ctx.lineTo(15, -11);
      ctx.closePath();
      ctx.fillStyle = 'rgba(30, 8, 24, 0.9)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 2, 3.4, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
    } else if (this.type === 'dart') {
      ctx.beginPath();
      ctx.moveTo(0, 15);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, -16);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(40, 30, 6, 0.9)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 8);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = Math.cos(angle) * this.radius;
        const py = Math.sin(angle) * this.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(22, 10, 42, 0.94)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.save();
      ctx.rotate(this.age * 1.4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();

      if (this.maxHp > 1) {
        const barWidth = this.radius * 1.6;
        const percent = Math.max(0, this.hp / this.maxHp);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(-barWidth / 2, -this.radius - 10, barWidth, 3);
        ctx.fillStyle = color;
        ctx.fillRect(-barWidth / 2, -this.radius - 10, barWidth * percent, 3);
      }
    }

    ctx.restore();
  }
}

/* ------------------------------ 掉落道具 ------------------------------ */

const PICKUP_STYLES = {
  spread: {
    color: '#ffd166',
    glow: 'rgba(255, 209, 102, 0.9)',
  },
  repair: {
    color: '#5effb0',
    glow: 'rgba(94, 255, 176, 0.9)',
  },
};

export class Pickup {
  constructor(x, y, type) {
    this.type = type;
    this.x = x;
    this.baseX = x;
    this.y = y;
    this.radius = 13;
    this.speed = 105;
    this.age = rand(0, 10);
    this.alive = true;
  }

  update(dt) {
    this.age += dt;
    this.y += this.speed * dt;
    this.x = this.baseX + Math.sin(this.age * 2.2) * 10;
  }

  draw(ctx) {
    const style = PICKUP_STYLES[this.type];
    const pulse = 0.24 + Math.sin(this.age * 5) * 0.16;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 16;

    ctx.fillStyle = 'rgba(6, 14, 26, 0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.globalAlpha = 0.35 + pulse;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 5, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = 0.8;
    ctx.save();
    ctx.rotate(this.age * 1.8);
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 9, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.fillStyle = style.color;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    if (this.type === 'spread') {
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -7);
      ctx.moveTo(0, 6);
      ctx.lineTo(-6, -5);
      ctx.moveTo(0, 6);
      ctx.lineTo(6, -5);
      ctx.stroke();
    } else {
      ctx.fillRect(-2.5, -7, 5, 14);
      ctx.fillRect(-7, -2.5, 14, 5);
    }

    ctx.restore();
  }
}

/* ------------------------------ 爆炸粒子 ------------------------------ */

export function createExplosion(x, y, color, count = 18, power = 240) {
  const particles = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TAU;
    const speed = rand(power * 0.12, power);
    const life = rand(0.3, 0.85);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: rand(1.4, 3.6),
      color,
    });
  }
  return particles;
}

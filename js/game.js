// js/game.js

import { db, doc, updateDoc } from './firebase-config.js';
import { MANGO_LEVELS, MANGO_SKINS, RARITIES } from './items-database.js';

// Приватные данные через WeakMap (нельзя изменить через консоль)
const _state = new WeakMap();

export class GameEngine {
  constructor(app) {
    this.app = app;

    // Приватное состояние
    _state.set(this, {
      lastClickTime: 0,
      lastSecondClicks: [],
      lastSavedScore: app.userData?.score || 0,
      pendingScore: 0,
      pendingClicks: 0,
      suspiciousActivity: 0,
      isLocked: false
    });

    // КОНСТАНТЫ — не меняются
    Object.defineProperty(this, 'MIN_CLICK_INTERVAL', { value: 50, writable: false });
    Object.defineProperty(this, 'MAX_CLICKS_PER_SECOND', { value: 25, writable: false });
    Object.defineProperty(this, 'MAX_PENDING_BATCH', { value: 100, writable: false });

    this.energyInterval = null;
    this.autoClickInterval = null;
    this.saveInterval = null;
    this.isSetup = false;

    this.setup();
    this.startEnergyRegen();
    this.startAutoClick();
    this.startAutoSave();
    this.updateMangoSkin();
    this.updateLevelDisplay();
  }

  setup() {
    if (this.isSetup) return;
    this.isSetup = true;

    const mangoBtn = document.getElementById('mango-button');

    // Используем isTrusted для проверки настоящего клика
    mangoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // ВАЖНО: e.isTrusted = true только если клик от пользователя,
      // а не от скрипта (.click() из консоли)
      this.handleClick(e);
    });

    mangoBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleClick(e);
    }, { passive: false });
  }

  handleClick(e) {
    const state = _state.get(this);
    if (state.isLocked) {
      this.app.notify('Аккаунт временно заблокирован', 'error');
      return;
    }

    // АНТИЧИТ 1: Проверка isTrusted (защита от программных кликов)
    if (e && e.isTrusted === false) {
      state.suspiciousActivity++;
      console.warn('Suspicious click detected (not trusted)');
      if (state.suspiciousActivity > 5) {
        this.lockAccount();
      }
      return;
    }

    const now = Date.now();

    // АНТИЧИТ 2: Минимальный интервал между кликами
    if (now - state.lastClickTime < this.MIN_CLICK_INTERVAL) {
      return;
    }
    state.lastClickTime = now;

    // АНТИЧИТ 3: Лимит кликов в секунду (защита от автокликеров)
    state.lastSecondClicks = state.lastSecondClicks.filter(t => now - t < 1000);
    state.lastSecondClicks.push(now);

    if (state.lastSecondClicks.length > this.MAX_CLICKS_PER_SECOND) {
      state.suspiciousActivity++;
      this.app.notify('⚠️ Слишком быстро! Замедлитесь.', 'warning');
      if (state.suspiciousActivity > 10) {
        this.lockAccount();
      }
      return;
    }

    const data = this.app.userData;
    if (!data) return;

    // АНТИЧИТ 4: Проверка энергии (нельзя минусовать)
    if (data.energy < 1) {
      this.shakeButton();
      return;
    }

    // АНТИЧИТ 5: Защита от чрезмерных значений
    let clickPower = data.clickPower || 1;
    if (clickPower < 1) clickPower = 1;
    if (clickPower > 100000) clickPower = 100000; // лимит

    let multiplier = data.multiplier || 1;
    if (multiplier < 1) multiplier = 1;
    if (multiplier > 10000) multiplier = 10000;

    let clickValue = clickPower;
    let isCrit = false;

    const critChance = Math.min(0.95, Math.max(0, data.critChance || 0.05));
    if (Math.random() < critChance) {
      const critMulti = Math.min(20, Math.max(1, data.critMultiplier || 2));
      clickValue = Math.floor(clickValue * critMulti);
      isCrit = true;
    }

    clickValue = Math.floor(clickValue * multiplier);
    if (clickValue < 1) clickValue = 1;
    if (clickValue > 100000000) clickValue = 100000000; // абсолютный лимит

    // Применяем
    data.score += clickValue;
    data.energy = Math.max(0, data.energy - 1);
    data.totalClicks = (data.totalClicks || 0) + 1;

    state.pendingScore += clickValue;
    state.pendingClicks += 1;

    // Принудительное сохранение если накопилось много
    if (state.pendingClicks >= this.MAX_PENDING_BATCH) {
      this.forceSave();
    }

    this.spawnParticle(clickValue, isCrit);
    this.animateMango();
    this.checkLevel();
    this.app.updateUI();
  }

  // Блокировка аккаунта при подозрительной активности
  lockAccount() {
    const state = _state.get(this);
    state.isLocked = true;
    this.app.notify('🚫 Обнаружена подозрительная активность. Перезагрузите страницу.', 'error', 10000);
    if (this.energyInterval) clearInterval(this.energyInterval);
    if (this.autoClickInterval) clearInterval(this.autoClickInterval);
    if (this.saveInterval) clearInterval(this.saveInterval);
  }

  spawnParticle(value, isCrit) {
    const container = document.getElementById('click-particles');
    if (!container) return;

    const particle = document.createElement('div');
    particle.className = `click-particle${isCrit ? ' crit' : ''}`;
    // Используем textContent (защита от XSS)
    particle.textContent = `+${this.app.formatNumber(value)}${isCrit ? ' КРИТ!' : ''}`;

    const offsetX = (Math.random() - 0.5) * 120;
    const offsetY = (Math.random() - 0.5) * 40;

    particle.style.left = `calc(50% + ${offsetX}px)`;
    particle.style.top = `calc(50% + ${offsetY}px)`;

    container.appendChild(particle);

    setTimeout(() => {
      if (particle.parentNode) particle.remove();
    }, 1000);

    // Ограничение количества частиц на экране
    const allParticles = container.querySelectorAll('.click-particle');
    if (allParticles.length > 30) {
      for (let i = 0; i < allParticles.length - 30; i++) {
        allParticles[i].remove();
      }
    }
  }

  animateMango() {
    const btn = document.getElementById('mango-button');
    if (!btn) return;

    btn.classList.remove('clicked');
    void btn.offsetWidth;
    btn.classList.add('clicked');

    setTimeout(() => btn.classList.remove('clicked'), 150);
  }

  shakeButton() {
    const btn = document.getElementById('mango-button');
    if (!btn) return;

    btn.style.animation = 'none';
    void btn.offsetWidth;
    btn.style.animation = 'shake 0.4s ease';
    setTimeout(() => { btn.style.animation = ''; }, 400);
  }

  startEnergyRegen() {
    this.energyInterval = setInterval(() => {
      const data = this.app.userData;
      if (!data) return;

      // Защита от манипуляций
      const maxEnergy = Math.min(100000, Math.max(100, data.maxEnergy || 100));
      const regenRate = Math.min(1000, Math.max(0, data.energyRegen || 2));

      if (data.energy < maxEnergy) {
        data.energy = Math.min(maxEnergy, data.energy + regenRate);
        this.app.updateUI();
      }
    }, 1000);
  }

  startAutoClick() {
    this.autoClickInterval = setInterval(() => {
      const data = this.app.userData;
      const state = _state.get(this);
      if (!data || state.isLocked) return;

      const autoRate = Math.min(100000, Math.max(0, data.autoClickRate || 0));
      if (autoRate <= 0) return;

      const multiplier = Math.min(10000, Math.max(1, data.multiplier || 1));
      let autoValue = Math.floor(autoRate * multiplier);
      if (autoValue < 1) return;
      if (autoValue > 100000000) autoValue = 100000000;

      data.score += autoValue;
      data.totalClicks = (data.totalClicks || 0) + autoRate;

      state.pendingScore += autoValue;
      state.pendingClicks += autoRate;

      this.spawnAutoParticle(autoValue);
      this.checkLevel();
      this.app.updateUI();
    }, 1000);
  }

  spawnAutoParticle(value) {
    const container = document.getElementById('click-particles');
    if (!container) return;

    const particle = document.createElement('div');
    particle.className = 'click-particle';
    particle.textContent = `⚙️+${this.app.formatNumber(value)}`;
    particle.style.left = '50%';
    particle.style.top = '70%';
    particle.style.fontSize = '14px';
    particle.style.opacity = '0.7';

    container.appendChild(particle);
    setTimeout(() => {
      if (particle.parentNode) particle.remove();
    }, 1000);
  }

  startAutoSave() {
    this.saveInterval = setInterval(async () => {
      await this.forceSave();
    }, 3000);
  }

  async forceSave() {
    const state = _state.get(this);
    if (state.pendingScore <= 0 && state.pendingClicks <= 0) return;

    const data = this.app.userData;
    if (!data || !this.app.user) return;

    // АНТИЧИТ: проверяем что прирост разумный
    const scoreDelta = data.score - state.lastSavedScore;
    if (scoreDelta > 10000000) {
      console.warn('Suspicious score increase:', scoreDelta);
      state.suspiciousActivity++;
      if (state.suspiciousActivity > 3) {
        this.lockAccount();
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'users', this.app.user.uid), {
        score: data.score,
        energy: data.energy,
        totalClicks: data.totalClicks,
        level: data.level
      });

      if (state.pendingClicks > 0) {
        // Ограничиваем максимум 100 кликов за обновление
        const clicksToAdd = Math.min(100, state.pendingClicks);
        this.app.incrementGlobalClicks(clicksToAdd);
      }

      state.lastSavedScore = data.score;
      state.pendingScore = 0;
      state.pendingClicks = 0;
    } catch (error) {
      console.error('Save error:', error);
      // Если сервер отклонил — откатываем
      if (error.code === 'permission-denied') {
        this.app.notify('Ошибка сохранения. Перезагрузите страницу.', 'error');
        this.lockAccount();
      }
    }
  }

  checkLevel() {
    const data = this.app.userData;
    if (!data) return;

    const totalClicks = data.totalClicks || 0;
    const currentLevel = data.level || 1;

    for (let i = MANGO_LEVELS.length - 1; i >= 0; i--) {
      const levelData = MANGO_LEVELS[i];

      if (totalClicks >= levelData.requiredClicks && currentLevel < levelData.level) {
        data.level = levelData.level;
        data.score += levelData.reward;
        const state = _state.get(this);
        state.pendingScore += levelData.reward;

        this.app.notify(
          `🎉 Уровень ${levelData.level}! "${levelData.name}" — +${this.app.formatNumber(levelData.reward)} очков!`,
          'success',
          5000
        );

        this.updateLevelDisplay();
        break;
      }
    }
  }

  updateLevelDisplay() {
    const data = this.app.userData;
    if (!data) return;

    const currentLevel = data.level || 1;
    const totalClicks = data.totalClicks || 0;

    const currentLevelData = MANGO_LEVELS.find(l => l.level === currentLevel) || MANGO_LEVELS[0];
    const nextLevelData = MANGO_LEVELS.find(l => l.level === currentLevel + 1);

    const levelNameEl = document.getElementById('level-name');
    const levelBarFill = document.getElementById('level-bar-fill');
    const levelProgressText = document.getElementById('level-progress-text');

    if (!levelNameEl || !levelBarFill || !levelProgressText) return;

    levelNameEl.textContent = `${currentLevelData.name} (Ур. ${currentLevel})`;

    if (nextLevelData) {
      const progressInLevel = totalClicks - currentLevelData.requiredClicks;
      const neededForNext = nextLevelData.requiredClicks - currentLevelData.requiredClicks;
      const percentage = Math.min(100, Math.max(0, (progressInLevel / neededForNext) * 100));

      levelBarFill.style.width = `${percentage}%`;
      levelProgressText.textContent = `${this.app.formatNumber(totalClicks)} / ${this.app.formatNumber(nextLevelData.requiredClicks)}`;
    } else {
      levelBarFill.style.width = '100%';
      levelProgressText.textContent = 'МАКС!';
    }
  }

  updateMangoSkin() {
    const data = this.app.userData;
    if (!data) return;

    const equippedId = data.equippedSkin || 'mango_default';
    const skin = MANGO_SKINS.find(s => s.id === equippedId) || MANGO_SKINS[0];

    const emojiEl = document.getElementById('mango-emoji');
    if (emojiEl) emojiEl.textContent = skin.emoji;

    const container = document.getElementById('mango-container');
    if (container) {
      container.classList.toggle('mango-3d', skin.render === '3d');
    }

    const glowEl = document.getElementById('mango-glow');
    if (glowEl) {
      const rarityData = RARITIES[skin.rarity];
      if (rarityData) {
        glowEl.style.background = `radial-gradient(circle, ${rarityData.glow} 0%, transparent 70%)`;
      }
    }
  }

  destroy() {
    if (this.energyInterval) clearInterval(this.energyInterval);
    if (this.autoClickInterval) clearInterval(this.autoClickInterval);
    if (this.saveInterval) clearInterval(this.saveInterval);

    // Финальное сохранение
    this.forceSave().catch(err => console.error('Final save error:', err));

    this.isSetup = false;
  }
}
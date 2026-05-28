// js/app.js

import {
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, setDoc, updateDoc, increment, onSnapshot, serverTimestamp
} from './firebase-config.js';
import { AuthManager } from './auth.js';
import { GameEngine } from './game.js';
import { ShopManager } from './shop.js';
import { InventoryManager } from './inventory.js';
import { CraftingManager } from './crafting.js';
import { TradingManager } from './trading.js';
import { DailyManager } from './daily.js';
import { DropsManager } from './drops.js';
import { PoliciesManager } from './policies.js';
import { MusicManager } from './music.js';

class MangoClickerApp {
  constructor() {
    this.user = null;
    this.userData = null;
    this.unsubscribeUserData = null;
    this.unsubscribeGlobal = null;
    this.lastSaveTime = 0;
    this.MIN_SAVE_INTERVAL = 500; // минимум 500мс между сохранениями
    this.musicManager = null;

    this.authManager = new AuthManager(this);
    this.gameEngine = null;
    this.shopManager = null;
    this.inventoryManager = null;
    this.craftingManager = null;
    this.tradingManager = null;
    this.dailyManager = null;
    this.dropsManager = null;

    this.init();
  }

  async init() {
    this.setupNavigation();
    this.setupPanels();
    this.setupModals();
    this.setupAntiCheat();

    this.policiesManager = new PoliciesManager();
    this.musicManager = new MusicManager(this);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.user = user;
        await this.loadOrCreateUser(user);
        this.showGameScreen();
        this.startSystems();
      } else {
        this.user = null;
        this.userData = null;
        this.stopSystems();
        this.showAuthScreen();
      }
      this.hideLoader();
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
      try {
        // Финальное сохранение перед выходом
        if (this.gameEngine) await this.gameEngine.forceSave();
        this.stopSystems();
        await signOut(auth);
      } catch (e) {
        console.error('Logout error:', e);
      }
    });
  }

  // АНТИЧИТ: блокировка опасных действий в консоли
  setupAntiCheat() {
    // Замораживаем критические объекты после загрузки
    setTimeout(() => {
      // Делаем userData защищённым (но всё равно изменяемым для игры)
      // Полностью предотвратить нельзя — но логируем подозрения
      try {
        const originalSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(key, value) {
          if (key.includes('score') || key.includes('mango')) {
            console.warn('Suspicious localStorage write blocked:', key);
            return;
          }
          return originalSetItem(key, value);
        };
      } catch (e) {}
    }, 1000);

    // Детектор открытых DevTools (только предупреждение)
    let devtoolsOpen = false;
    setInterval(() => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      if ((widthThreshold || heightThreshold) && !devtoolsOpen) {
        devtoolsOpen = true;
        console.log('%cСТОЙ!', 'color:red;font-size:60px;font-weight:bold;');
        console.log('%cЭто инструмент разработчика. Не вставляйте сюда код от незнакомцев — могут украсть аккаунт!',
          'color:white;font-size:16px;');
      }
    }, 3000);
  }

  hideLoader() {
    setTimeout(() => {
      const loader = document.getElementById('loader');
      loader.classList.add('fade-out');
      setTimeout(() => loader.classList.add('hidden'), 500);
    }, 1500);
  }

  showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('hidden');
  }

  showGameScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
  }

  async loadOrCreateUser(user) {
    const userRef = doc(db, 'users', user.uid);

    try {
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        // Безопасное имя
        let safeName = 'Player';
        if (user.email) {
          safeName = this.sanitizeName(user.email.split('@')[0]);
        }

        const defaultData = {
          name: safeName,
          email: user.email || '',
          score: 0,
          totalClicks: 0,
          energy: 100,
          maxEnergy: 100,
          energyRegen: 2,
          clickPower: 1,
          autoClickRate: 0,
          multiplier: 1,
          critChance: 0.05,
          critMultiplier: 2,
          level: 1,
          inventory: [],
          equippedSkin: 'mango_default',
          equippedAccessories: [],
          equippedBackground: null,
          equippedTrail: null,
          equippedEffect: null,
          dailyStreak: 0,
          lastDaily: null,
          lastWeeklyDrop: null,
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp()
        };

        await setDoc(userRef, defaultData);
        this.userData = { ...defaultData, id: user.uid };
        this.notify('🥭 Добро пожаловать в MangoClicker!', 'success');
      } else {
        this.userData = { ...snap.data(), id: user.uid };
      }

      await updateDoc(userRef, { lastSeen: serverTimestamp() });

      // Безопасное отображение имени
      const nameEl = document.getElementById('user-name');
      if (nameEl) nameEl.textContent = this.userData.name;
    } catch (error) {
      console.error('Error loading user:', error);
      this.notify('Ошибка загрузки данных', 'error');
    }
  }

  // Санитизация имени
  sanitizeName(name) {
    if (!name || typeof name !== 'string') return 'Player';
    // Удаляем потенциально опасные символы
    let safe = name.replace(/[<>"'&\\/]/g, '');
    safe = safe.replace(/[\x00-\x1F\x7F]/g, ''); // управляющие символы
    safe = safe.trim().substring(0, 20);
    return safe || 'Player';
  }

  startSystems() {
    this.unsubscribeUserData = onSnapshot(
      doc(db, 'users', this.user.uid),
      (snap) => {
        if (snap.exists()) {
          const serverData = snap.data();

          // Берём максимальные локальные значения (защита от отката)
          const localScore = this.userData?.score || 0;
          const localEnergy = this.userData?.energy || 0;
          const localTotalClicks = this.userData?.totalClicks || 0;

          this.userData = {
            ...serverData,
            id: this.user.uid,
            score: Math.max(serverData.score || 0, localScore),
            energy: localEnergy,
            totalClicks: Math.max(serverData.totalClicks || 0, localTotalClicks)
          };

          this.updateUI();
        }
      },
      (error) => {
        console.error('User data listener error:', error);
        if (error.code === 'permission-denied') {
          this.notify('Ошибка доступа. Перезагрузите страницу.', 'error');
        }
      }
    );

    this.setupGlobalCounter();

    this.gameEngine = new GameEngine(this);
    this.shopManager = new ShopManager(this);
    this.inventoryManager = new InventoryManager(this);
    this.craftingManager = new CraftingManager(this);
    this.tradingManager = new TradingManager(this);
    this.dailyManager = new DailyManager(this);
    this.dropsManager = new DropsManager(this);
  }

  stopSystems() {
    if (this.unsubscribeUserData) {
      this.unsubscribeUserData();
      this.unsubscribeUserData = null;
    }
    if (this.unsubscribeGlobal) {
      this.unsubscribeGlobal();
      this.unsubscribeGlobal = null;
    }
    if (this.gameEngine) {
      this.gameEngine.destroy();
      this.gameEngine = null;
    }
    // ДОБАВИТЬ:
    if (this.musicManager) {
      this.musicManager.stop();
    }
  }

  async setupGlobalCounter() {
    try {
      const globalRef = doc(db, 'global', 'stats');
      const globalSnap = await getDoc(globalRef);

      if (!globalSnap.exists()) {
        await setDoc(globalRef, { totalClicks: 0 });
      }

      this.unsubscribeGlobal = onSnapshot(globalRef, (snap) => {
        if (snap.exists()) {
          const totalClicks = snap.data().totalClicks || 0;
          const el = document.getElementById('global-clicks');
          if (el) {
            el.textContent = this.formatNumber(totalClicks);
          }
        }
      });
    } catch (error) {
      console.error('Global counter error:', error);
    }
  }

  async incrementGlobalClicks(amount) {
    // ВАЛИДАЦИЯ
    if (!amount || amount <= 0) return;
    if (amount > 100) amount = 100; // лимит за раз (защита от читов)

    try {
      const globalRef = doc(db, 'global', 'stats');
      await updateDoc(globalRef, {
        totalClicks: increment(Math.floor(amount))
      });
    } catch (error) {
      console.error('Increment global error:', error);
    }
  }

  async saveUserData(updates) {
    if (!this.user) return;

    // RATE LIMITING
    const now = Date.now();
    if (now - this.lastSaveTime < this.MIN_SAVE_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, this.MIN_SAVE_INTERVAL - (now - this.lastSaveTime))
      );
    }
    this.lastSaveTime = Date.now();

    // ВАЛИДАЦИЯ обновлений перед отправкой
    const safeUpdates = this.validateUpdates(updates);

    try {
      const userRef = doc(db, 'users', this.user.uid);
      await updateDoc(userRef, safeUpdates);
    } catch (error) {
      console.error('Save user data error:', error);
      if (error.code === 'permission-denied') {
        this.notify('Серверная защита отклонила изменения!', 'error');
        throw error;
      } else {
        this.notify('Ошибка сохранения!', 'error');
      }
    }
  }

  validateUpdates(updates) {
    const safe = {};

    // Числовые поля с лимитами
    const numericLimits = {
      score: { min: 0, max: Number.MAX_SAFE_INTEGER },
      totalClicks: { min: 0, max: Number.MAX_SAFE_INTEGER },
      energy: { min: 0, max: 100000 },
      maxEnergy: { min: 100, max: 100000 },
      energyRegen: { min: 0, max: 1000 },
      clickPower: { min: 1, max: 100000 },
      autoClickRate: { min: 0, max: 100000 },
      multiplier: { min: 1, max: 10000 },
      critChance: { min: 0, max: 0.95 },
      critMultiplier: { min: 1, max: 20 },
      level: { min: 1, max: 15 },
      dailyStreak: { min: 0, max: 10000 }
    };

    for (const [key, value] of Object.entries(updates)) {
      if (numericLimits[key]) {
        const v = Number(value);
        if (!isNaN(v) && isFinite(v)) {
          safe[key] = Math.max(numericLimits[key].min, Math.min(numericLimits[key].max, v));
        }
      } else if (key === 'inventory') {
        if (Array.isArray(value) && value.length <= 500) {
          safe[key] = value.filter(item =>
            item && typeof item.id === 'string' && item.id.length < 100
          ).slice(0, 500);
        }
      } else if (key === 'equippedAccessories') {
        if (Array.isArray(value) && value.length <= 10) {
          safe[key] = value.filter(id => typeof id === 'string' && id.length < 100);
        }
      } else if (['equippedSkin', 'equippedBackground', 'equippedTrail', 'equippedEffect'].includes(key)) {
        if (value === null || (typeof value === 'string' && value.length < 100)) {
          safe[key] = value;
        }
      } else if (['lastDaily', 'lastWeeklyDrop'].includes(key)) {
        safe[key] = value;
      }
      // Запрещённые поля (name, email, createdAt) НЕ копируются
    }

    return safe;
  }

  updateUI() {
    if (!this.userData) return;

    const scoreEl = document.getElementById('score-display');
    if (scoreEl) scoreEl.textContent = this.formatNumber(this.userData.score);

    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = this.sanitizeName(this.userData.name);

    const levelEl = document.getElementById('user-level-badge');
    if (levelEl) levelEl.textContent = `Ур. ${this.userData.level || 1}`;

    const maxEnergy = this.userData.maxEnergy || 100;
    const currentEnergy = Math.max(0, this.userData.energy || 0);
    const energyPct = (currentEnergy / maxEnergy) * 100;

    const energyFill = document.getElementById('energy-bar-fill');
    if (energyFill) energyFill.style.width = `${energyPct}%`;

    const energyText = document.getElementById('energy-text');
    if (energyText) energyText.textContent = `${Math.floor(currentEnergy)}/${maxEnergy}`;

    const clickPowerEl = document.getElementById('click-power-display');
    if (clickPowerEl) {
      const power = this.userData.clickPower || 1;
      const multi = this.userData.multiplier || 1;
      const totalPower = Math.floor(power * multi);
      clickPowerEl.textContent = `+${this.formatNumber(totalPower)} за клик`;
    }

    const autoEl = document.getElementById('auto-click-display');
    if (autoEl) {
      const autoRate = this.userData.autoClickRate || 0;
      if (autoRate > 0) {
        autoEl.classList.remove('hidden');
        const multi = this.userData.multiplier || 1;
        autoEl.textContent = `⚙️ ${this.formatNumber(Math.floor(autoRate * multi))}/сек`;
      } else {
        autoEl.classList.add('hidden');
      }
    }

    const mobileNavRewards = document.getElementById('mobile-nav-rewards');
    const navRewards = document.getElementById('nav-rewards');
    if (navRewards && mobileNavRewards) {
      if (navRewards.classList.contains('has-notification')) {
        mobileNavRewards.classList.add('has-notification');
      } else {
        mobileNavRewards.classList.remove('has-notification');
      }
    }
    if (this.gameEngine) {
      this.gameEngine.updateLevelDisplay();
    }
  }

  setupNavigation() {
    // ПК навигация
    const navBtns = document.querySelectorAll('.nav-btn');
    // Мобильная навигация
    const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
  
    // Единый обработчик
    const handleNavClick = (panel, allButtons) => {
      if (panel === 'click') {
        this.closeAllPanels();
        allButtons.forEach(b => b.classList.remove('active'));
        // Активируем все кнопки click (и в ПК и в мобильной)
        document.querySelectorAll('[data-panel="click"]').forEach(b => b.classList.add('active'));
        return;
      }
  
      this.openPanel(panel);
      allButtons.forEach(b => b.classList.remove('active'));
      // Активируем все кнопки с этим panel
      document.querySelectorAll(`[data-panel="${panel}"]`).forEach(b => b.classList.add('active'));
    };
  
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        handleNavClick(panel, [...navBtns, ...mobileNavBtns]);
      });
    });
  
    mobileNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        handleNavClick(panel, [...navBtns, ...mobileNavBtns]);
      });
    });
  }

  openPanel(name) {
    this.closeAllPanels();

    const panel = document.getElementById(`panel-${name}`);
    if (!panel) return;

    panel.classList.remove('hidden');

    switch (name) {
      case 'shop': if (this.shopManager) this.shopManager.render(); break;
      case 'inventory': if (this.inventoryManager) this.inventoryManager.render(); break;
      case 'crafting': if (this.craftingManager) this.craftingManager.render(); break;
      case 'trading': if (this.tradingManager) this.tradingManager.render(); break;
      case 'rewards':
        if (this.dailyManager) this.dailyManager.render();
        if (this.dropsManager) this.dropsManager.render();
        break;
    }
  }

  closeAllPanels() {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  }

  setupPanels() {
    document.querySelectorAll('.btn-close-panel').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllPanels();
        // Снимаем активность со всех кнопок навигации
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(b => b.classList.remove('active'));
        // Активируем кнопки "Клик"
        document.querySelectorAll('[data-panel="click"]').forEach(b => b.classList.add('active'));
      });
    });
  }

  setupModals() {
    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal();
      });
    }

    // ESC для закрытия
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  }

  openModal(title, bodyHTML, footerHTML = '') {
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');
    const overlay = document.getElementById('modal-overlay');

    if (titleEl) titleEl.textContent = title; // textContent - защита от XSS
    if (bodyEl) {
      bodyEl.innerHTML = ''; // очищаем
      if (typeof bodyHTML === 'string' && bodyHTML) {
        // Парсим HTML безопасно
        const temp = document.createElement('div');
        temp.innerHTML = bodyHTML;
        // Удаляем все script теги
        temp.querySelectorAll('script').forEach(s => s.remove());
        bodyEl.appendChild(temp);
      }
    }
    if (footerEl) {
      footerEl.innerHTML = '';
      if (typeof footerHTML === 'string' && footerHTML) {
        const temp = document.createElement('div');
        temp.innerHTML = footerHTML;
        temp.querySelectorAll('script').forEach(s => s.remove());
        footerEl.appendChild(temp);
      }
    }
    if (overlay) overlay.classList.remove('hidden');
  }

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  notify(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notifications');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `notification ${type}`;

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };

    // Создаём элементы безопасно (без innerHTML)
    const iconSpan = document.createElement('span');
    iconSpan.textContent = icons[type] || 'ℹ️';

    const textSpan = document.createElement('span');
    // textContent защищает от XSS
    textSpan.textContent = String(message).substring(0, 200);

    el.appendChild(iconSpan);
    el.appendChild(textSpan);

    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => {
        if (el.parentNode) el.remove();
      }, 300);
    }, duration);

    while (container.children.length > 5) {
      container.firstChild.remove();
    }
  }

  formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) return '0';

    num = Math.floor(Number(num));
    if (!isFinite(num)) return '∞';

    if (num >= 1e15) return (num / 1e15).toFixed(1) + 'Q';
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e4) return (num / 1e3).toFixed(1) + 'K';

    return num.toLocaleString('ru-RU');
  }

  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}

window.app = new MangoClickerApp();

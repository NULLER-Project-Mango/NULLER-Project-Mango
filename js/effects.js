// js/effects.js
// Все визуальные эффекты: аксессуары, питомцы, фоны, следы, эффекты клика

import { getItemById } from './items-database.js';

export class EffectsManager {
  constructor(app) {
    this.app = app;
    this.accessoryElements = new Map(); // id -> element
    this.petElements = new Map();
    this.trailParticles = [];
    this.lastTrailTime = 0;

    this.setup();
  }

  setup() {
    // Создаём контейнеры
    this.ensureContainers();
    // Слушаем движение мыши для следа
    this.setupMouseTrail();
  }

  ensureContainers() {
    const gameArea = document.querySelector('.game-area');
    if (!gameArea) return;

    // Контейнер для аксессуаров (поверх манго)
    if (!document.getElementById('accessories-container')) {
      const container = document.createElement('div');
      container.id = 'accessories-container';
      container.className = 'accessories-container';
      gameArea.appendChild(container);
    }

    // Контейнер для питомцев
    if (!document.getElementById('pets-container')) {
      const container = document.createElement('div');
      container.id = 'pets-container';
      container.className = 'pets-container';
      gameArea.appendChild(container);
    }

    // Контейнер для следа курсора
    if (!document.getElementById('trail-container')) {
      const container = document.createElement('div');
      container.id = 'trail-container';
      container.className = 'trail-container';
      document.body.appendChild(container);
    }

    // Фон для game-area
    if (!document.getElementById('background-overlay')) {
      const bg = document.createElement('div');
      bg.id = 'background-overlay';
      bg.className = 'background-overlay';
      const mainArea = document.querySelector('.main-area');
      if (mainArea) mainArea.insertBefore(bg, mainArea.firstChild);
    }
  }

  // ===== ОБНОВИТЬ ВСЁ ВИЗУАЛЬНОЕ =====
  refresh() {
    const data = this.app.userData;
    if (!data) return;

    this.updateAccessories(data.equippedAccessories || []);
    this.updateBackground(data.equippedBackground);
    this.updateTrail(data.equippedTrail);
  }

  // ===== АКСЕССУАРЫ И ПИТОМЦЫ =====
  updateAccessories(equippedIds) {
    const accContainer = document.getElementById('accessories-container');
    const petContainer = document.getElementById('pets-container');
    if (!accContainer || !petContainer) return;

    // Очищаем
    accContainer.innerHTML = '';
    petContainer.innerHTML = '';
    this.accessoryElements.clear();
    this.petElements.clear();

    equippedIds.forEach(id => {
      const item = getItemById(id);
      if (!item) return;

      if (item.type === 'accessory') {
        this.createAccessory(item, accContainer);
      } else if (item.type === 'pet') {
        this.createPet(item, petContainer);
      }
    });
  }

  createAccessory(item, container) {
    const el = document.createElement('div');
    el.className = 'accessory-item';
    el.dataset.itemId = item.id;
    el.textContent = item.emoji;

    // Позиция в зависимости от типа аксессуара
    const positions = {
      'hat_basic':      { top: '-30%',  left: '50%', size: '60px', rotate: '0deg' },
      'glasses_cool':   { top: '20%',   left: '50%', size: '70px', rotate: '0deg' },
      'bow_tie':        { top: '85%',   left: '50%', size: '50px', rotate: '0deg' },
      'crown_bronze':   { top: '-25%',  left: '50%', size: '70px', rotate: '0deg' },
      'crown_silver':   { top: '-30%',  left: '50%', size: '80px', rotate: '0deg' },
      'crown_gold':     { top: '-35%',  left: '50%', size: '90px', rotate: '0deg' },
      'crown_diamond':  { top: '-40%',  left: '50%', size: '100px', rotate: '0deg' },
      'wings_angel':    { top: '40%',   left: '-30%', size: '120px', rotate: '0deg', dual: true },
      'wings_demon':    { top: '40%',   left: '-30%', size: '120px', rotate: '0deg', dual: true },
      'wings_dragon':   { top: '40%',   left: '-30%', size: '140px', rotate: '0deg', dual: true },
      'aura_fire':      { top: '50%',   left: '50%', size: '300px', class: 'aura-effect aura-fire' },
      'aura_ice':       { top: '50%',   left: '50%', size: '300px', class: 'aura-effect aura-ice' },
      'aura_lightning': { top: '50%',   left: '50%', size: '300px', class: 'aura-effect aura-lightning' },
      'aura_cosmic':    { top: '50%',   left: '50%', size: '350px', class: 'aura-effect aura-cosmic' },
    };

    const pos = positions[item.id] || { top: '50%', left: '50%', size: '50px' };

    el.style.position = 'absolute';
    el.style.top = pos.top;
    el.style.left = pos.left;
    el.style.fontSize = pos.size;
    el.style.transform = `translate(-50%, -50%) rotate(${pos.rotate || '0deg'})`;
    el.style.pointerEvents = 'none';
    el.style.zIndex = '5';

    if (pos.class) {
      el.className = pos.class;
      el.style.width = pos.size;
      el.style.height = pos.size;
    }

    if (pos.dual) {
      // Два крыла - левое и правое
      const leftWing = el.cloneNode(true);
      leftWing.style.left = '-30%';
      leftWing.style.transform = `translate(-50%, -50%) scaleX(-1)`;
      container.appendChild(leftWing);

      const rightWing = el.cloneNode(true);
      rightWing.style.left = '130%';
      rightWing.style.transform = `translate(-50%, -50%)`;
      container.appendChild(rightWing);

      this.accessoryElements.set(item.id, [leftWing, rightWing]);
    } else {
      container.appendChild(el);
      this.accessoryElements.set(item.id, el);
    }
  }

  createPet(item, container) {
    const el = document.createElement('div');
    el.className = 'pet-item';
    el.dataset.itemId = item.id;
    el.textContent = item.emoji;

    // Случайная стартовая позиция
    el.style.left = (10 + Math.random() * 80) + '%';
    el.style.top = (60 + Math.random() * 30) + '%';
    el.style.fontSize = '40px';

    container.appendChild(el);
    this.petElements.set(item.id, el);

    // Анимация движения питомца
    this.animatePet(el);
  }

  animatePet(petEl) {
    let posX = parseFloat(petEl.style.left);
    let posY = parseFloat(petEl.style.top);
    let velX = (Math.random() - 0.5) * 0.5;
    let velY = (Math.random() - 0.5) * 0.3;

    const animate = () => {
      if (!petEl.parentNode) return;

      posX += velX;
      posY += velY;

      // Границы
      if (posX < 5 || posX > 95) {
        velX *= -1;
        petEl.style.transform = `scaleX(${velX > 0 ? 1 : -1})`;
      }
      if (posY < 50 || posY > 90) {
        velY *= -1;
      }

      // Случайные изменения
      if (Math.random() < 0.02) {
        velX += (Math.random() - 0.5) * 0.3;
        velY += (Math.random() - 0.5) * 0.2;
        velX = Math.max(-1, Math.min(1, velX));
        velY = Math.max(-0.5, Math.min(0.5, velY));
      }

      petEl.style.left = posX + '%';
      petEl.style.top = posY + '%';

      requestAnimationFrame(animate);
    };

    animate();
  }

  // ===== ФОНЫ =====
  updateBackground(bgId) {
    const overlay = document.getElementById('background-overlay');
    if (!overlay) return;

    // Очищаем классы
    overlay.className = 'background-overlay';
    overlay.innerHTML = '';

    if (!bgId) return;

    const item = getItemById(bgId);
    if (!item) return;

    overlay.classList.add('bg-active', `bg-${bgId}`);

    // Добавляем специальные эффекты для разных фонов
    switch (bgId) {
      case 'bg_space':
      case 'bg_dimension':
      case 'bg_aurora':
        this.createStarfield(overlay);
        break;
      case 'bg_sunset':
        this.createSunset(overlay);
        break;
      case 'bg_ocean':
        this.createOcean(overlay);
        break;
      case 'bg_forest':
        this.createForest(overlay);
        break;
      case 'bg_volcano':
        this.createVolcano(overlay);
        break;
      case 'bg_neon_city':
        this.createNeonCity(overlay);
        break;
      case 'bg_heaven':
        this.createHeaven(overlay);
        break;
    }
  }

  createStarfield(container) {
    for (let i = 0; i < 100; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.animationDelay = Math.random() * 3 + 's';
      star.style.width = (Math.random() * 3 + 1) + 'px';
      star.style.height = star.style.width;
      container.appendChild(star);
    }
  }

  createSunset(container) {
    const sun = document.createElement('div');
    sun.className = 'sun';
    container.appendChild(sun);
  }

  createOcean(container) {
    for (let i = 0; i < 5; i++) {
      const wave = document.createElement('div');
      wave.className = 'wave';
      wave.style.bottom = (i * 20) + 'px';
      wave.style.animationDelay = (i * 0.5) + 's';
      container.appendChild(wave);
    }
  }

  createForest(container) {
    const emojis = ['🌳', '🌴', '🌲', '🌿', '🍃'];
    for (let i = 0; i < 15; i++) {
      const tree = document.createElement('div');
      tree.className = 'forest-element';
      tree.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      tree.style.left = Math.random() * 100 + '%';
      tree.style.top = Math.random() * 100 + '%';
      tree.style.fontSize = (Math.random() * 30 + 20) + 'px';
      tree.style.animationDelay = Math.random() * 2 + 's';
      container.appendChild(tree);
    }
  }

  createVolcano(container) {
    for (let i = 0; i < 20; i++) {
      const lava = document.createElement('div');
      lava.className = 'lava-particle';
      lava.style.left = Math.random() * 100 + '%';
      lava.style.animationDelay = Math.random() * 3 + 's';
      container.appendChild(lava);
    }
  }

  createNeonCity(container) {
    for (let i = 0; i < 10; i++) {
      const building = document.createElement('div');
      building.className = 'neon-building';
      building.style.left = (i * 10) + '%';
      building.style.height = (Math.random() * 40 + 30) + '%';
      building.style.background = `linear-gradient(180deg, transparent, hsl(${Math.random() * 360}, 100%, 50%))`;
      container.appendChild(building);
    }
  }

  createHeaven(container) {
    for (let i = 0; i < 8; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'cloud';
      cloud.textContent = '☁️';
      cloud.style.left = Math.random() * 100 + '%';
      cloud.style.top = Math.random() * 80 + '%';
      cloud.style.fontSize = (Math.random() * 40 + 40) + 'px';
      cloud.style.animationDelay = Math.random() * 5 + 's';
      container.appendChild(cloud);
    }
  }

  // ===== СЛЕД ЗА КУРСОРОМ =====
  updateTrail(trailId) {
    this.currentTrail = trailId;
  }

  setupMouseTrail() {
    document.addEventListener('mousemove', (e) => {
      if (!this.currentTrail) return;

      const now = Date.now();
      if (now - this.lastTrailTime < 50) return;
      this.lastTrailTime = now;

      this.spawnTrailParticle(e.clientX, e.clientY);
    });

    // Тачскрин
    document.addEventListener('touchmove', (e) => {
      if (!this.currentTrail || !e.touches[0]) return;

      const now = Date.now();
      if (now - this.lastTrailTime < 80) return;
      this.lastTrailTime = now;

      this.spawnTrailParticle(e.touches[0].clientX, e.touches[0].clientY);
    });
  }

  spawnTrailParticle(x, y) {
    const container = document.getElementById('trail-container');
    if (!container) return;

    const particle = document.createElement('div');
    particle.className = 'trail-particle';

    const emojis = {
      'trail_sparkle': '✨',
      'trail_hearts': '❤️',
      'trail_stars': '⭐',
      'trail_fire': '🔥',
      'trail_rainbow': ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣'][Math.floor(Math.random() * 6)],
      'trail_galaxy': ['✨', '⭐', '🌟', '💫'][Math.floor(Math.random() * 4)],
    };

    particle.textContent = emojis[this.currentTrail] || '✨';
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';

    container.appendChild(particle);

    setTimeout(() => {
      if (particle.parentNode) particle.remove();
    }, 1000);
  }

  // ===== ЭФФЕКТЫ КЛИКА =====
  spawnClickEffect(x, y, effectId) {
    if (!effectId) return;

    const container = document.getElementById('click-particles');
    if (!container) return;

    const effect = document.createElement('div');
    effect.className = 'click-effect';
    effect.style.left = x + 'px';
    effect.style.top = y + 'px';

    switch (effectId) {
      case 'effect_pop':
        effect.textContent = '💨';
        effect.classList.add('effect-pop');
        break;
      case 'effect_coins':
        for (let i = 0; i < 5; i++) {
          const coin = document.createElement('div');
          coin.className = 'click-effect effect-coin';
          coin.textContent = '🪙';
          coin.style.left = x + 'px';
          coin.style.top = y + 'px';
          coin.style.setProperty('--angle', (Math.random() * 360) + 'deg');
          container.appendChild(coin);
          setTimeout(() => coin.remove(), 1500);
        }
        return;
      case 'effect_explosion':
        effect.textContent = '💥';
        effect.classList.add('effect-explosion');
        break;
      case 'effect_portal':
        effect.textContent = '🌀';
        effect.classList.add('effect-portal');
        break;
      case 'effect_nuke':
        effect.textContent = '☢️';
        effect.classList.add('effect-nuke');
        break;
      default:
        return;
    }

    container.appendChild(effect);
    setTimeout(() => effect.remove(), 1500);
  }
}

// js/drops.js
import { MANGO_SKINS, COLLECTIBLES, RARITIES } from './items-database.js';

export class DropsManager {
  constructor(app) {
    this.app = app;
    this.timerInterval = null;
    this.isClaiming = false;
    this.dropPool = [...MANGO_SKINS, ...COLLECTIBLES].filter(i => i.price > 0);
  }

  render() {
    const section = document.getElementById('weekly-drop-section');
    if (!section) return;

    const data = this.app.userData;
    if (!data) return;

    const lastDrop = this.parseDate(data.lastWeeklyDrop);
    const now = new Date();

    let canDrop = false;
    let timeLeft = 0;

    if (!lastDrop) {
      canDrop = true;
    } else {
      const nextDrop = new Date(lastDrop.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (now >= nextDrop) {
        canDrop = true;
      } else {
        timeLeft = nextDrop - now;
      }
    }

    section.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'reward-section';

    const h3 = document.createElement('h3');
    h3.textContent = '🎰 Еженедельный дроп';
    wrapper.appendChild(h3);

    const card = document.createElement('div');
    card.className = 'weekly-drop-card';

    if (canDrop) {
      const emojiDiv = document.createElement('div');
      emojiDiv.style.cssText = 'font-size:64px;margin-bottom:16px;';
      emojiDiv.textContent = '🎁';
      card.appendChild(emojiDiv);

      const p = document.createElement('p');
      p.style.cssText = 'margin-bottom:20px;color:var(--text-secondary);font-size:15px;';
      p.textContent = 'Ваш еженедельный дроп готов! Шанс получить редкий предмет!';
      card.appendChild(p);

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.style.cssText = 'font-size:16px;padding:14px 32px;';
      btn.textContent = '🎰 Открыть дроп!';
      btn.disabled = this.isClaiming;
      btn.addEventListener('click', () => this.claimDrop(btn));
      card.appendChild(btn);
    } else {
      const emojiDiv = document.createElement('div');
      emojiDiv.style.cssText = 'font-size:48px;margin-bottom:12px;';
      emojiDiv.textContent = '⏳';
      card.appendChild(emojiDiv);

      const p = document.createElement('p');
      p.style.cssText = 'color:var(--text-secondary);font-size:14px;';
      p.textContent = 'Следующий дроп через:';
      card.appendChild(p);

      const timer = document.createElement('div');
      timer.className = 'weekly-drop-timer';
      timer.id = 'drop-timer';
      timer.textContent = this.formatTime(timeLeft);
      card.appendChild(timer);
    }

    wrapper.appendChild(card);
    section.appendChild(wrapper);

    if (!canDrop && timeLeft > 0) {
      this.startTimer(timeLeft);
    }
  }

  parseDate(d) {
    if (!d) return null;
    if (d.seconds) return new Date(d.seconds * 1000);
    if (d.toDate) return d.toDate();
    return new Date(d);
  }

  startTimer(timeLeft) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    let remaining = timeLeft;

    this.timerInterval = setInterval(() => {
      remaining -= 1000;
      if (remaining <= 0) {
        clearInterval(this.timerInterval);
        this.render();
        return;
      }
      const el = document.getElementById('drop-timer');
      if (el) el.textContent = this.formatTime(remaining);
    }, 1000);
  }

  formatTime(ms) {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((ms % (1000 * 60)) / 1000);
    return `${days}д ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getRandomDrop() {
    // Используем crypto API для лучшей случайности
    const getSecureRandom = () => {
      if (window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        return arr[0] / 4294967296;
      }
      return Math.random();
    };

    const rarityKeys = Object.keys(RARITIES);
    let roll = getSecureRandom();
    let selectedRarity = 'common';

    for (const key of rarityKeys) {
      if (roll < RARITIES[key].chance) {
        selectedRarity = key;
        break;
      }
      roll -= RARITIES[key].chance;
    }

    const eligibleItems = this.dropPool.filter(i => i.rarity === selectedRarity);
    if (eligibleItems.length === 0) {
      const commons = this.dropPool.filter(i => i.rarity === 'common');
      return commons[Math.floor(getSecureRandom() * commons.length)];
    }

    return eligibleItems[Math.floor(getSecureRandom() * eligibleItems.length)];
  }

  async claimDrop(buttonEl) {
    if (this.isClaiming) return;

    const data = this.app.userData;

    // ПРОВЕРКА: прошла ли неделя
    const lastDrop = this.parseDate(data.lastWeeklyDrop);
    if (lastDrop) {
      const nextDrop = new Date(lastDrop.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (new Date() < nextDrop) {
        this.app.notify('Дроп ещё не доступен!', 'warning');
        return;
      }
    }

    // ВАЛИДАЦИЯ: размер инвентаря
    if (data.inventory.length >= 500) {
      this.app.notify('Инвентарь переполнен!', 'error');
      return;
    }

    this.isClaiming = true;
    if (buttonEl) buttonEl.disabled = true;

    const item = this.getRandomDrop();
    if (!item) {
      this.isClaiming = false;
      if (buttonEl) buttonEl.disabled = false;
      return;
    }

    const oldInventory = JSON.parse(JSON.stringify(data.inventory));
    const oldLastDrop = data.lastWeeklyDrop;

    data.inventory.push({ id: item.id, qty: 1, acquiredAt: Date.now() });
    data.lastWeeklyDrop = new Date();

    try {
      await this.app.saveUserData({
        inventory: data.inventory,
        lastWeeklyDrop: data.lastWeeklyDrop
      });

      this.showReveal(item);
      this.render();
    } catch (error) {
      // ОТКАТ
      data.inventory = oldInventory;
      data.lastWeeklyDrop = oldLastDrop;
      this.app.notify('Ошибка получения дропа!', 'error');
    } finally {
      this.isClaiming = false;
    }
  }

  showReveal(item) {
    const rarity = RARITIES[item.rarity];
    const reveal = document.getElementById('drop-reveal');
    if (!reveal) return;

    document.getElementById('drop-glow').style.background = rarity.glow;
    document.getElementById('drop-emoji').textContent = item.emoji;
    document.getElementById('drop-name').textContent = item.name;
    const rarityEl = document.getElementById('drop-rarity');
    rarityEl.textContent = rarity.name;
    rarityEl.style.color = rarity.color;

    reveal.classList.remove('hidden');

    const claimBtn = document.getElementById('drop-claim');
    const newBtn = claimBtn.cloneNode(true);
    claimBtn.parentNode.replaceChild(newBtn, claimBtn);
    newBtn.addEventListener('click', () => {
      reveal.classList.add('hidden');
    });

    this.app.notify(`🎰 Дроп: ${item.emoji} ${item.name} (${rarity.name})!`, 'success', 5000);
  }
}
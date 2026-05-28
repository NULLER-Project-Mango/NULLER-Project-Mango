import { MANGO_SKINS, UPGRADES, COLLECTIBLES, RARITIES, getItemById, getItemMaxCount } from './items-database.js';

export class ShopManager {
  constructor(app) {
    this.app = app;
    this.currentTab = 'skins';
    this.isPurchasing = false;
    this.setupTabs();
  }

  setupTabs() {
    document.querySelectorAll('[data-shop-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-shop-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.shopTab;
        this.render();
      });
    });
  }

  getTabItems() {
    switch (this.currentTab) {
      case 'skins':       return MANGO_SKINS.filter(s => s.price > 0);
      case 'upgrades':    return UPGRADES;
      case 'auras':       return COLLECTIBLES.filter(c => c.type === 'aura');
      case 'backgrounds': return COLLECTIBLES.filter(c => c.type === 'background');
      case 'effects':     return COLLECTIBLES.filter(c => ['trail', 'effect'].includes(c.type));
      case 'other':       return COLLECTIBLES.filter(c => ['music', 'frame', 'title'].includes(c.type));
      default:            return [];
    }
  }

  render() {
    const container = document.getElementById('shop-items');
    if (!container) return;

    const items = this.getTabItems();
    const inv = this.app.userData?.inventory || [];

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-emoji">🏪</div>
          <div class="empty-state-text">В этой категории пока пусто</div>
        </div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'item-grid';

    items.forEach(item => {
      const ownedCount = inv.filter(i => i.id === item.id).reduce((sum, i) => sum + (i.qty || 1), 0);
      const owned = ownedCount > 0;
      const equipped = this.isEquipped(item);
      const rarity = RARITIES[item.rarity];
      const maxCount = getItemMaxCount(item);
      const reachedMaxCount = ownedCount >= maxCount;

      const card = document.createElement('div');
      card.className = `item-card rarity-${item.rarity} ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}`;
      card.dataset.itemId = item.id;

      const rarityBar = document.createElement('div');
      rarityBar.className = 'item-card-rarity';
      card.appendChild(rarityBar);

      if (item.render === '3d') {
        const badge = document.createElement('span');
        badge.className = 'badge-3d-indicator';
        badge.textContent = '3D';
        card.appendChild(badge);
      }

      if (owned) {
        const badge = document.createElement('span');
        badge.className = 'item-card-badge badge-owned';
        if (item.type === 'upgrade' || maxCount === Infinity) {
          badge.textContent = `✓ x${ownedCount}`;
        } else {
          badge.textContent = '✓ Куплено';
        }
        card.appendChild(badge);
      }

      if (equipped) {
        const badge = document.createElement('span');
        badge.className = 'item-card-badge badge-equipped';
        badge.textContent = '⚡ Надето';
        card.appendChild(badge);
      }

      const emoji = document.createElement('div');
      emoji.className = 'item-card-emoji';
      emoji.textContent = item.emoji;
      card.appendChild(emoji);

      const name = document.createElement('div');
      name.className = 'item-card-name';
      name.textContent = item.name;
      card.appendChild(name);

      const rarityText = document.createElement('div');
      rarityText.className = 'item-card-rarity-text';
      rarityText.textContent = rarity.name;
      card.appendChild(rarityText);

      const desc = document.createElement('div');
      desc.className = 'item-card-desc';
      desc.textContent = item.description;
      card.appendChild(desc);

      const price = document.createElement('div');
      price.className = 'item-card-price';
      if (reachedMaxCount && maxCount !== Infinity) {
        price.style.color = 'var(--success)';
        price.textContent = '✓ В инвентаре';
      } else {
        price.textContent = `🥭 ${this.app.formatNumber(item.price)}`;
      }
      card.appendChild(price);

      card.addEventListener('click', () => this.showItemDetail(item.id));
      grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
  }

  isEquipped(item) {
    const data = this.app.userData;
    if (!data) return false;
    if (item.type === 'skin')       return data.equippedSkin === item.id;
    if (item.type === 'background') return data.equippedBackground === item.id;
    if (item.type === 'trail')      return data.equippedTrail === item.id;
    if (item.type === 'effect')     return data.equippedEffect === item.id;
    if (item.type === 'aura') {
      return (data.equippedAccessories || []).includes(item.id);
    }
    return false;
  }

  showItemDetail(itemId) {
    const item = getItemById(itemId);
    if (!item) return;

    const inv = this.app.userData?.inventory || [];
    const ownedCount = inv.filter(i => i.id === itemId).reduce((sum, i) => sum + (i.qty || 1), 0);
    const owned = ownedCount > 0;
    const equipped = this.isEquipped(item);
    const rarity = RARITIES[item.rarity];
    const canAfford = (this.app.userData?.score || 0) >= item.price;
    const maxCount = getItemMaxCount(item);
    const reachedMaxCount = ownedCount >= maxCount;

    const body = document.createElement('div');
    body.style.textAlign = 'center';

    const emojiEl = document.createElement('div');
    emojiEl.style.fontSize = '80px';
    emojiEl.style.marginBottom = '16px';
    emojiEl.textContent = item.emoji;
    body.appendChild(emojiEl);

    const nameEl = document.createElement('h3');
    nameEl.style.cssText = 'font-size:22px;margin-bottom:6px;';
    nameEl.textContent = item.name;
    body.appendChild(nameEl);

    const rarityDiv = document.createElement('div');
    rarityDiv.style.cssText = `color:${rarity.color};font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px;`;
    rarityDiv.textContent = rarity.name + (item.render === '3d' ? ' • 3D' : '');
    body.appendChild(rarityDiv);

    const descEl = document.createElement('p');
    descEl.style.cssText = 'color:var(--text-secondary);font-size:14px;margin-bottom:20px;line-height:1.5;';
    descEl.textContent = item.description;
    body.appendChild(descEl);

    const bonuses = [];
    if (item.clickBonus)              bonuses.push(`💪 Сила клика: +${item.clickBonus}`);
    if (item.effect === 'clickPower') bonuses.push(`💪 Сила клика: +${item.value}`);
    if (item.effect === 'autoClick')  bonuses.push(`⚙️ Авто-клик: +${item.value}/сек`);
    if (item.effect === 'maxEnergy')  bonuses.push(`🔋 Макс. энергия: +${item.value}`);
    if (item.effect === 'energyRegen')bonuses.push(`🔌 Восст. энергии: +${item.value}/сек`);
    if (item.effect === 'multiplier') bonuses.push(`🧪 Множитель: x${item.value}`);
    if (item.effect === 'critChance') bonuses.push(`🍀 Шанс крита: +${Math.round(item.value * 100)}%`);
    if (item.effect === 'critMulti')  bonuses.push(`💥 Сила крита: +${item.value}x`);

    if (bonuses.length > 0) {
      const bonusBox = document.createElement('div');
      bonusBox.style.cssText = 'text-align:left;background:var(--bg-tertiary);padding:14px;border-radius:10px;font-size:14px;';
      bonuses.forEach(b => {
        const line = document.createElement('div');
        line.style.margin = '6px 0';
        line.textContent = b;
        bonusBox.appendChild(line);
      });
      body.appendChild(bonusBox);
    }

    if (owned) {
      const countEl = document.createElement('div');
      countEl.style.cssText = 'margin-top:10px;font-size:13px;color:var(--text-secondary);';
      if (maxCount === Infinity) {
        countEl.textContent = `В инвентаре: ${ownedCount} шт.`;
      } else if (item.type === 'upgrade') {
        countEl.textContent = item.maxCount
          ? `Куплено: ${ownedCount} / ${item.maxCount}`
          : `Куплено: ${ownedCount} раз`;
      } else {
        countEl.textContent = `В инвентаре: ${ownedCount}`;
      }
      body.appendChild(countEl);
    }

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;width:100%;';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-secondary';
    closeBtn.textContent = 'Закрыть';
    closeBtn.addEventListener('click', () => this.app.closeModal());
    footer.appendChild(closeBtn);

    if (!reachedMaxCount) {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'btn btn-primary';
      buyBtn.textContent = `Купить за 🥭 ${this.app.formatNumber(item.price)}`;
      buyBtn.disabled = !canAfford || this.isPurchasing;
      buyBtn.addEventListener('click', () => this.buyItem(item.id, buyBtn));
      footer.appendChild(buyBtn);
    }

    if (owned && item.type !== 'upgrade' &&
        ['skin', 'background', 'trail', 'effect', 'aura'].includes(item.type)) {
      const equipBtn = document.createElement('button');
      equipBtn.className = `btn ${equipped ? 'btn-danger' : 'btn-success'}`;
      equipBtn.textContent = equipped ? 'Снять' : 'Надеть';
      equipBtn.addEventListener('click', () => this.toggleEquip(item.id));
      footer.appendChild(equipBtn);
    }

    this.app.openModal(item.name, '', '');
    document.getElementById('modal-body').appendChild(body);
    document.getElementById('modal-footer').appendChild(footer);
  }

  async buyItem(itemId, buttonEl) {
    if (this.isPurchasing) {
      this.app.notify('Подождите, идёт покупка...', 'warning');
      return;
    }

    const item = getItemById(itemId);
    if (!item) { this.app.notify('Предмет не найден!', 'error'); return; }
    if (typeof item.price !== 'number' || item.price < 0) { this.app.notify('Некорректная цена!', 'error'); return; }

    const data = this.app.userData;
    if (!data) return;
    if (data.score < item.price) { this.app.notify('Недостаточно очков!', 'error'); return; }

    const ownedCount = data.inventory.filter(i => i.id === itemId).reduce((sum, i) => sum + (i.qty || 1), 0);
    const maxCount = getItemMaxCount(item);
    if (ownedCount >= maxCount) { this.app.notify('Достигнут максимум покупок!', 'warning'); return; }
    if (data.inventory.length >= 500) { this.app.notify('Инвентарь переполнен!', 'error'); return; }

    this.isPurchasing = true;
    if (buttonEl) buttonEl.disabled = true;

    const oldScore = data.score;
    const oldInventory = [...data.inventory];
    const oldStats = {
      clickPower: data.clickPower, autoClickRate: data.autoClickRate,
      maxEnergy: data.maxEnergy, energyRegen: data.energyRegen,
      multiplier: data.multiplier, critChance: data.critChance,
      critMultiplier: data.critMultiplier
    };

    data.score -= item.price;
    data.inventory.push({ id: itemId, qty: 1, acquiredAt: Date.now() });

    if (item.type === 'upgrade') this.applyUpgrade(item);

    try {
      await this.app.saveUserData({
        score: data.score, inventory: data.inventory,
        clickPower: data.clickPower, autoClickRate: data.autoClickRate,
        maxEnergy: data.maxEnergy, energyRegen: data.energyRegen,
        multiplier: data.multiplier, critChance: data.critChance,
        critMultiplier: data.critMultiplier
      });

      if (item.type === 'music' && this.app.musicManager) this.app.musicManager.refreshTrack();

      this.app.notify(`Куплено: ${item.emoji} ${item.name}!`, 'success');
      this.app.closeModal();
      this.render();
    } catch (error) {
      console.error('Buy error:', error);
      data.score = oldScore;
      data.inventory = oldInventory;
      Object.assign(data, oldStats);
      this.app.notify('Ошибка покупки!', 'error');
      this.app.updateUI();
    } finally {
      this.isPurchasing = false;
      if (buttonEl) buttonEl.disabled = false;
    }
  }

  applyUpgrade(item) {
    const data = this.app.userData;
    const safeValue = Math.max(0, Math.min(10000, item.value));
    switch (item.effect) {
      case 'clickPower':   data.clickPower    = Math.min(100000, (data.clickPower || 1) + safeValue); break;
      case 'autoClick':    data.autoClickRate  = Math.min(100000, (data.autoClickRate || 0) + safeValue); break;
      case 'maxEnergy':    data.maxEnergy      = Math.min(100000, (data.maxEnergy || 100) + safeValue); break;
      case 'energyRegen':  data.energyRegen    = Math.min(1000,   (data.energyRegen || 2) + safeValue); break;
      case 'multiplier':   if (safeValue > 0) data.multiplier = Math.min(10000, (data.multiplier || 1) * safeValue); break;
      case 'critChance':   data.critChance     = Math.min(0.95, (data.critChance || 0.05) + safeValue); break;
      case 'critMulti':    data.critMultiplier  = Math.min(20,   (data.critMultiplier || 2) + safeValue); break;
    }
  }

  async toggleEquip(itemId) {
    const item = getItemById(itemId);
    if (!item) { this.app.notify('Предмет не найден!', 'error'); return; }

    const data = this.app.userData;
    if (!data.inventory.some(i => i.id === itemId)) {
      this.app.notify('Предмет не в инвентаре!', 'error');
      return;
    }

    let isNowEquipped = false;

    const oldData = {
      equippedSkin: data.equippedSkin,
      equippedBackground: data.equippedBackground,
      equippedTrail: data.equippedTrail,
      equippedEffect: data.equippedEffect,
      equippedAccessories: [...(data.equippedAccessories || [])],
      clickPower: data.clickPower
    };

    if (item.type === 'skin') {
      const oldSkin = MANGO_SKINS.find(s => s.id === data.equippedSkin);
      if (oldSkin?.clickBonus) data.clickPower -= oldSkin.clickBonus;

      if (data.equippedSkin === itemId) {
        data.equippedSkin = 'mango_default';
      } else {
        data.equippedSkin = itemId;
        if (item.clickBonus) data.clickPower += item.clickBonus;
        isNowEquipped = true;
      }
    } else if (item.type === 'background') {
      data.equippedBackground = data.equippedBackground === itemId ? null : itemId;
      isNowEquipped = data.equippedBackground === itemId;
    } else if (item.type === 'trail') {
      data.equippedTrail = data.equippedTrail === itemId ? null : itemId;
      isNowEquipped = data.equippedTrail === itemId;
    } else if (item.type === 'effect') {
      data.equippedEffect = data.equippedEffect === itemId ? null : itemId;
      isNowEquipped = data.equippedEffect === itemId;
    } else if (item.type === 'aura') {
      const accs = data.equippedAccessories || [];
      const idx = accs.indexOf(itemId);
      if (idx >= 0) {
        accs.splice(idx, 1);
      } else {
        if (accs.length >= 5) {
          this.app.notify('Можно надеть максимум 5 аур!', 'warning');
          return;
        }
        accs.push(itemId);
        isNowEquipped = true;
      }
      data.equippedAccessories = accs;
    }

    if (data.clickPower < 1) data.clickPower = 1;

    try {
      await this.app.saveUserData({
        equippedSkin: data.equippedSkin,
        equippedBackground: data.equippedBackground,
        equippedTrail: data.equippedTrail,
        equippedEffect: data.equippedEffect,
        equippedAccessories: data.equippedAccessories,
        clickPower: data.clickPower
      });

      if (this.app.gameEngine) {
        this.app.gameEngine.updateMangoSkin();
        // Обновляем ауры в 3D
        if (this.app.gameEngine.mango3D) {
          this.app.gameEngine.mango3D.setAuras(data.equippedAccessories || []);
        }
        if (this.app.gameEngine.refreshEffects) {
          this.app.gameEngine.refreshEffects();
        }
      }

      this.app.notify(`${item.emoji} ${isNowEquipped ? 'Надето' : 'Снято'}!`, 'info');
      this.app.closeModal();
      this.render();
    } catch (error) {
      Object.assign(data, oldData);
      this.app.notify('Ошибка! Попробуйте снова.', 'error');
      if (this.app.gameEngine) this.app.gameEngine.updateMangoSkin();
    }
  }
}

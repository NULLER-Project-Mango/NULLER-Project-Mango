// js/inventory.js
import { getItemById, RARITIES } from './items-database.js';

export class InventoryManager {
  constructor(app) {
    this.app = app;
    this.currentTab = 'all';
    this.setupTabs();
  }

  setupTabs() {
    document.querySelectorAll('[data-inv-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-inv-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.invTab;
        this.render();
      });
    });
  }

  getFilteredItems() {
    const inv = this.app.userData?.inventory || [];

    // Группируем по id и считаем количество
    const grouped = {};
    inv.forEach(invItem => {
      if (!grouped[invItem.id]) {
        grouped[invItem.id] = { id: invItem.id, qty: 0 };
      }
      grouped[invItem.id].qty += invItem.qty || 1;
    });

    return Object.values(grouped).map(g => {
      const itemData = getItemById(g.id);
      return itemData ? { ...itemData, qty: g.qty } : null;
    }).filter(item => {
      if (!item) return false;
      if (this.currentTab === 'all') return true;
      if (this.currentTab === 'skins') return item.type === 'skin';
      if (this.currentTab === 'upgrades') return item.type === 'upgrade';
      if (this.currentTab === 'accessories') return ['accessory', 'pet'].includes(item.type);
      if (this.currentTab === 'other') return ['background', 'trail', 'effect', 'music', 'frame', 'title'].includes(item.type);
      return false;
    });
  }

  render() {
    const container = document.getElementById('inventory-items');
    if (!container) return;

    const items = this.getFilteredItems();

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-emoji">🎒</div>
          <div class="empty-state-text">Пока пусто. Загляните в магазин!</div>
        </div>`;
      return;
    }

    let html = '<div class="item-grid">';
    items.forEach(item => {
      const rarity = RARITIES[item.rarity];
      const equipped = this.app.shopManager ? this.app.shopManager.isEquipped(item) : false;

      html += `
        <div class="item-card rarity-${item.rarity} ${equipped ? 'equipped' : ''}"
             data-item-id="${item.id}">
          <div class="item-card-rarity"></div>
          ${item.render === '3d' ? '<span class="badge-3d-indicator">3D</span>' : ''}
          ${equipped ? '<span class="item-card-badge badge-equipped">⚡ Надето</span>' : ''}
          ${item.qty > 1 ? `<span class="item-card-qty">x${item.qty}</span>` : ''}
          <div class="item-card-emoji">${item.emoji}</div>
          <div class="item-card-name">${item.name}</div>
          <div class="item-card-rarity-text">${rarity.name}</div>
          <div class="item-card-desc">${item.description}</div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        if (this.app.shopManager) {
          this.app.shopManager.showItemDetail(card.dataset.itemId);
        }
      });
    });
  }
}
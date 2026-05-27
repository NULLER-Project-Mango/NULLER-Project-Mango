// js/trading.js
import { db, collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, runTransaction, getDoc }
  from './firebase-config.js';
import { getItemById, RARITIES } from './items-database.js';

export class TradingManager {
  constructor(app) {
    this.app = app;
    this.currentTab = 'market';
    this.isProcessing = false;
    this.setupTabs();
  }

  setupTabs() {
    document.querySelectorAll('[data-trade-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-trade-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tradeTab;
        this.render();
      });
    });
  }

  async render() {
    const container = document.getElementById('trading-content');
    if (!container) return;

    switch (this.currentTab) {
      case 'market': await this.renderMarket(container); break;
      case 'sell': this.renderSellForm(container); break;
      case 'my-offers': await this.renderMyOffers(container); break;
    }
  }

  async renderMarket(container) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">⏳</div><div class="empty-state-text">Загрузка...</div></div>';

    try {
      const q = query(collection(db, 'market'));
      const snap = await getDocs(q);

      if (snap.empty) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-emoji">💱</div>
            <div class="empty-state-text">На маркете пока нет лотов</div>
          </div>`;
        return;
      }

      container.innerHTML = '';

      snap.forEach(docSnap => {
        const listing = { id: docSnap.id, ...docSnap.data() };
        const item = getItemById(listing.itemId);
        if (!item) return;

        // ВАЛИДАЦИЯ полей
        if (typeof listing.price !== 'number' || listing.price <= 0) return;
        if (typeof listing.sellerId !== 'string') return;

        const rarity = RARITIES[item.rarity];
        const isMine = listing.sellerId === this.app.user.uid;
        const canBuy = (this.app.userData?.score || 0) >= listing.price && !isMine;

        const div = document.createElement('div');
        div.className = 'trade-listing';

        const info = document.createElement('div');
        info.className = 'trade-item-info';

        const emoji = document.createElement('div');
        emoji.className = 'trade-item-emoji';
        emoji.textContent = item.emoji;
        info.appendChild(emoji);

        const textDiv = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'trade-item-name';
        name.style.color = rarity.color;
        name.textContent = item.name;
        textDiv.appendChild(name);

        const seller = document.createElement('div');
        seller.className = 'trade-item-seller';
        // textContent защищает от XSS!
        seller.textContent = `Продавец: ${this.sanitizeName(listing.sellerName || 'Игрок')}`;
        textDiv.appendChild(seller);

        info.appendChild(textDiv);
        div.appendChild(info);

        const right = document.createElement('div');
        right.className = 'trade-right';

        const price = document.createElement('div');
        price.className = 'trade-item-price';
        price.textContent = `🥭 ${this.app.formatNumber(listing.price)}`;
        right.appendChild(price);

        if (!isMine) {
          const btn = document.createElement('button');
          btn.className = `btn btn-sm ${canBuy ? 'btn-primary' : 'btn-secondary'}`;
          btn.textContent = 'Купить';
          btn.disabled = !canBuy || this.isProcessing;
          btn.addEventListener('click', () => this.buyListing(listing.id, btn));
          right.appendChild(btn);
        } else {
          const myLabel = document.createElement('span');
          myLabel.style.cssText = 'font-size:12px;color:var(--text-muted);font-weight:600;';
          myLabel.textContent = 'Ваш лот';
          right.appendChild(myLabel);
        }

        div.appendChild(right);
        container.appendChild(div);
      });
    } catch (e) {
      console.error('Market error:', e);
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Ошибка загрузки маркета</div></div>';
    }
  }

  sanitizeName(name) {
    if (!name || typeof name !== 'string') return 'Игрок';
    return name.replace(/[<>"'&\\/]/g, '').substring(0, 30) || 'Игрок';
  }

  renderSellForm(container) {
    const inv = this.app.userData?.inventory || [];
    const sellableItems = inv.filter(i => {
      const item = getItemById(i.id);
      return item && item.type !== 'upgrade';
    });

    if (sellableItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-emoji">📦</div>
          <div class="empty-state-text">Нет предметов для продажи</div>
        </div>`;
      return;
    }

    container.innerHTML = '';

    const form = document.createElement('div');
    form.className = 'sell-form';

    const h3 = document.createElement('h3');
    h3.style.marginBottom = '20px';
    h3.textContent = '📤 Выставить предмет на продажу';
    form.appendChild(h3);

    const label1 = document.createElement('label');
    label1.textContent = 'Выберите предмет:';
    form.appendChild(label1);

    const select = document.createElement('select');
    select.id = 'sell-item-select';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Выбрать предмет --';
    select.appendChild(defaultOpt);

    sellableItems.forEach(invItem => {
      const item = getItemById(invItem.id);
      if (!item) return;
      const opt = document.createElement('option');
      opt.value = invItem.id;
      opt.textContent = `${item.emoji} ${item.name} (${invItem.qty || 1} шт.)`;
      select.appendChild(opt);
    });
    form.appendChild(select);

    const label2 = document.createElement('label');
    label2.textContent = 'Цена (в очках 🥭):';
    form.appendChild(label2);

    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'sell-price';
    input.min = 1;
    input.max = 1000000000;
    input.placeholder = 'Введите цену';
    form.appendChild(input);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-full';
    btn.textContent = '📤 Выставить на продажу';
    btn.addEventListener('click', () => this.createListing(btn));
    form.appendChild(btn);

    container.appendChild(form);
  }

  async createListing(buttonEl) {
    if (this.isProcessing) return;

    const itemId = document.getElementById('sell-item-select').value;
    const priceInput = document.getElementById('sell-price').value;

    // ВАЛИДАЦИЯ
    if (!itemId) {
      this.app.notify('Выберите предмет!', 'warning');
      return;
    }

    const item = getItemById(itemId);
    if (!item) {
      this.app.notify('Предмет не найден!', 'error');
      return;
    }

    if (item.type === 'upgrade') {
      this.app.notify('Улучшения нельзя продавать!', 'error');
      return;
    }

    const price = parseInt(priceInput);
    if (!Number.isFinite(price) || price < 1) {
      this.app.notify('Укажите корректную цену!', 'warning');
      return;
    }
    if (price > 1000000000) {
      this.app.notify('Максимальная цена: 1B', 'warning');
      return;
    }

    const data = this.app.userData;

    // ПРОВЕРКА что предмет действительно есть
    const invIdx = data.inventory.findIndex(i => i.id === itemId);
    if (invIdx < 0) {
      this.app.notify('Предмет не в инвентаре!', 'error');
      return;
    }

    // Лимит активных лотов
    try {
      const myQuery = query(collection(db, 'market'), where('sellerId', '==', this.app.user.uid));
      const mySnap = await getDocs(myQuery);
      if (mySnap.size >= 10) {
        this.app.notify('Максимум 10 активных лотов!', 'warning');
        return;
      }
    } catch (e) { console.error(e); }

    this.isProcessing = true;
    if (buttonEl) buttonEl.disabled = true;

    const oldInventory = JSON.parse(JSON.stringify(data.inventory));

    const invItem = data.inventory[invIdx];
    if ((invItem.qty || 1) <= 1) {
      data.inventory.splice(invIdx, 1);
    } else {
      data.inventory[invIdx].qty -= 1;
    }

    try {
      await addDoc(collection(db, 'market'), {
        itemId: itemId,
        price: price,
        sellerId: this.app.user.uid,
        sellerName: this.sanitizeName(data.name || 'Игрок'),
        createdAt: serverTimestamp()
      });

      await this.app.saveUserData({ inventory: data.inventory });

      this.app.notify(`${item.emoji} ${item.name} выставлено за ${this.app.formatNumber(price)} очков!`, 'success');
      this.render();
    } catch (e) {
      // ОТКАТ
      console.error('Create listing error:', e);
      data.inventory = oldInventory;
      this.app.notify('Ошибка при создании лота!', 'error');
    } finally {
      this.isProcessing = false;
      if (buttonEl) buttonEl.disabled = false;
    }
  }

  async buyListing(listingId, buttonEl) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    if (buttonEl) buttonEl.disabled = true;

    try {
      const listingRef = doc(db, 'market', listingId);

      // ВСЕ операции в одной транзакции (защита от race condition)
      await runTransaction(db, async (transaction) => {
        const listingSnap = await transaction.get(listingRef);
        if (!listingSnap.exists()) throw new Error('Listing not found');

        const listing = listingSnap.data();

        // ВАЛИДАЦИЯ
        if (typeof listing.price !== 'number' || listing.price <= 0) {
          throw new Error('Invalid listing');
        }
        if (listing.sellerId === this.app.user.uid) {
          throw new Error('Own listing');
        }

        // ВАЛИДАЦИЯ предмета
        const item = getItemById(listing.itemId);
        if (!item) throw new Error('Invalid item');

        const buyerRef = doc(db, 'users', this.app.user.uid);
        const sellerRef = doc(db, 'users', listing.sellerId);

        const buyerSnap = await transaction.get(buyerRef);
        if (!buyerSnap.exists()) throw new Error('Buyer not found');

        const buyerData = buyerSnap.data();
        if (buyerData.score < listing.price) throw new Error('Not enough score');

        // Лимит инвентаря
        const buyerInventory = [...(buyerData.inventory || [])];
        if (buyerInventory.length >= 500) throw new Error('Inventory full');

        buyerInventory.push({
          id: listing.itemId,
          qty: 1,
          acquiredAt: Date.now()
        });

        transaction.update(buyerRef, {
          score: buyerData.score - listing.price,
          inventory: buyerInventory
        });

        // Кредит продавцу
        const sellerSnap = await transaction.get(sellerRef);
        if (sellerSnap.exists()) {
          const sellerData = sellerSnap.data();
          transaction.update(sellerRef, {
            score: (sellerData.score || 0) + listing.price
          });
        }

        transaction.delete(listingRef);
      });

      this.app.notify('✅ Покупка успешна!', 'success');
      this.render();
    } catch (e) {
      console.error('Buy listing error:', e);
      const msgs = {
        'Listing not found': 'Лот уже куплен или удалён!',
        'Own listing': 'Нельзя купить свой лот!',
        'Not enough score': 'Недостаточно очков!',
        'Inventory full': 'Инвентарь переполнен!',
        'Invalid item': 'Некорректный предмет!',
        'Invalid listing': 'Некорректный лот!',
        'Buyer not found': 'Ошибка покупателя!'
      };
      this.app.notify(msgs[e.message] || 'Ошибка при покупке!', 'error');
    } finally {
      this.isProcessing = false;
      if (buttonEl) buttonEl.disabled = false;
    }
  }

  async renderMyOffers(container) {
    try {
      const q = query(collection(db, 'market'), where('sellerId', '==', this.app.user.uid));
      const snap = await getDocs(q);

      if (snap.empty) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-emoji">📋</div>
            <div class="empty-state-text">У вас нет активных лотов</div>
          </div>`;
        return;
      }

      container.innerHTML = '';

      snap.forEach(docSnap => {
        const listing = { id: docSnap.id, ...docSnap.data() };
        const item = getItemById(listing.itemId);
        if (!item) return;

        const div = document.createElement('div');
        div.className = 'trade-listing';

        const info = document.createElement('div');
        info.className = 'trade-item-info';

        const emoji = document.createElement('div');
        emoji.className = 'trade-item-emoji';
        emoji.textContent = item.emoji;
        info.appendChild(emoji);

        const textDiv = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'trade-item-name';
        name.textContent = item.name;
        textDiv.appendChild(name);
        const price = document.createElement('div');
        price.className = 'trade-item-price';
        price.textContent = `🥭 ${this.app.formatNumber(listing.price)}`;
        textDiv.appendChild(price);
        info.appendChild(textDiv);
        div.appendChild(info);

        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-danger';
        btn.textContent = 'Снять с продажи';
        btn.addEventListener('click', () => this.cancelListing(listing.id, listing.itemId, btn));
        div.appendChild(btn);

        container.appendChild(div);
      });
    } catch (e) {
      console.error('My offers error:', e);
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Ошибка загрузки</div></div>';
    }
  }

  async cancelListing(listingId, itemId, buttonEl) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    if (buttonEl) buttonEl.disabled = true;

    const data = this.app.userData;
    const oldInventory = JSON.parse(JSON.stringify(data.inventory));

    try {
      // Транзакция: удалить лот И вернуть предмет
      await runTransaction(db, async (transaction) => {
        const listingRef = doc(db, 'market', listingId);
        const listingSnap = await transaction.get(listingRef);

        if (!listingSnap.exists()) throw new Error('Listing not found');

        const listing = listingSnap.data();
        if (listing.sellerId !== this.app.user.uid) {
          throw new Error('Not your listing');
        }

        const userRef = doc(db, 'users', this.app.user.uid);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) throw new Error('User not found');

        const userData = userSnap.data();
        const inventory = [...(userData.inventory || [])];

        if (inventory.length >= 500) throw new Error('Inventory full');

        inventory.push({ id: itemId, qty: 1, acquiredAt: Date.now() });

        transaction.update(userRef, { inventory: inventory });
        transaction.delete(listingRef);
      });

      this.app.notify('Лот снят, предмет возвращён!', 'info');
      this.render();
    } catch (e) {
      console.error('Cancel listing error:', e);
      this.app.notify('Ошибка при отмене лота!', 'error');
    } finally {
      this.isProcessing = false;
      if (buttonEl) buttonEl.disabled = false;
    }
  }
}
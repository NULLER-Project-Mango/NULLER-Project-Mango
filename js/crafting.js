// js/crafting.js
import { RECIPES, getItemById, RARITIES } from './items-database.js';

export class CraftingManager {
  constructor(app) {
    this.app = app;
    this.isCrafting = false; // защита от двойного крафта
  }

  render() {
    const container = document.getElementById('crafting-recipes');
    if (!container) return;

    const inv = this.app.userData?.inventory || [];
    container.innerHTML = '';

    RECIPES.forEach(recipe => {
      const result = getItemById(recipe.result);
      if (!result) return;
      const rarity = RARITIES[result.rarity];

      const hasAllIngredients = recipe.ingredients.every(ing => {
        const totalQty = inv
          .filter(i => i.id === ing.id)
          .reduce((sum, i) => sum + (i.qty || 1), 0);
        return totalQty >= ing.qty;
      });

      const canAfford = (this.app.userData?.score || 0) >= recipe.cost;
      const canCraft = hasAllIngredients && canAfford && !this.isCrafting;

      // Создаём карточку через DOM API
      const card = document.createElement('div');
      card.className = 'recipe-card';

      const left = document.createElement('div');
      left.className = 'recipe-left';

      const header = document.createElement('div');
      header.className = 'recipe-header';

      const emojiDiv = document.createElement('div');
      emojiDiv.className = 'recipe-result-emoji';
      emojiDiv.textContent = result.emoji;
      header.appendChild(emojiDiv);

      const info = document.createElement('div');
      info.className = 'recipe-result-info';
      const h4 = document.createElement('h4');
      h4.textContent = result.name;
      info.appendChild(h4);
      const raritySpan = document.createElement('span');
      raritySpan.style.cssText = `color:${rarity.color};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;`;
      raritySpan.textContent = rarity.name;
      info.appendChild(raritySpan);
      header.appendChild(info);

      left.appendChild(header);

      const ingredients = document.createElement('div');
      ingredients.className = 'recipe-ingredients';
      recipe.ingredients.forEach(ing => {
        const ingItem = getItemById(ing.id);
        const totalQty = inv
          .filter(i => i.id === ing.id)
          .reduce((sum, i) => sum + (i.qty || 1), 0);
        const has = totalQty >= ing.qty;

        const ingDiv = document.createElement('div');
        ingDiv.className = `recipe-ingredient ${has ? 'has' : 'missing'}`;
        ingDiv.textContent = `${ingItem?.emoji || '❓'} ${ingItem?.name || ing.id} (${totalQty}/${ing.qty})`;
        ingredients.appendChild(ingDiv);
      });
      left.appendChild(ingredients);

      card.appendChild(left);

      const right = document.createElement('div');
      right.className = 'recipe-right';

      const cost = document.createElement('div');
      cost.className = 'recipe-cost';
      cost.textContent = `🥭 ${this.app.formatNumber(recipe.cost)}`;
      right.appendChild(cost);

      const btn = document.createElement('button');
      btn.className = `btn ${canCraft ? 'btn-primary' : 'btn-secondary'}`;
      btn.textContent = '🔨 Крафтить';
      btn.disabled = !canCraft;
      btn.addEventListener('click', () => this.craft(recipe.id, btn));
      right.appendChild(btn);

      card.appendChild(right);
      container.appendChild(card);
    });

    if (container.children.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-emoji">🔨</div>
          <div class="empty-state-text">Рецепты загружаются...</div>
        </div>`;
    }
  }

  async craft(recipeId, buttonEl) {
    if (this.isCrafting) {
      this.app.notify('Подождите, идёт крафт...', 'warning');
      return;
    }

    // ВАЛИДАЦИЯ: рецепт должен существовать
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) {
      this.app.notify('Рецепт не найден!', 'error');
      return;
    }

    const data = this.app.userData;

    // ВАЛИДАЦИЯ: цена
    if (typeof recipe.cost !== 'number' || recipe.cost < 0) {
      this.app.notify('Некорректная цена!', 'error');
      return;
    }

    if (data.score < recipe.cost) {
      this.app.notify('Недостаточно очков!', 'error');
      return;
    }

    // ВАЛИДАЦИЯ: размер инвентаря
    if (data.inventory.length >= 500) {
      this.app.notify('Инвентарь переполнен!', 'error');
      return;
    }

    // ПРОВЕРКА ингредиентов
    for (const ing of recipe.ingredients) {
      const totalQty = data.inventory
        .filter(i => i.id === ing.id)
        .reduce((sum, i) => sum + (i.qty || 1), 0);
      if (totalQty < ing.qty) {
        this.app.notify('Недостаточно ингредиентов!', 'error');
        return;
      }
    }

    this.isCrafting = true;
    if (buttonEl) buttonEl.disabled = true;

    // Сохраняем состояние для отката
    const oldScore = data.score;
    const oldInventory = JSON.parse(JSON.stringify(data.inventory));

    // Удаляем ингредиенты
    for (const ing of recipe.ingredients) {
      let needed = ing.qty;
      for (let i = data.inventory.length - 1; i >= 0 && needed > 0; i--) {
        if (data.inventory[i].id === ing.id) {
          const qty = data.inventory[i].qty || 1;
          if (qty <= needed) {
            needed -= qty;
            data.inventory.splice(i, 1);
          } else {
            data.inventory[i].qty -= needed;
            needed = 0;
          }
        }
      }
    }

    data.score -= recipe.cost;
    data.inventory.push({ id: recipe.result, qty: 1, acquiredAt: Date.now() });

    try {
      await this.app.saveUserData({
        score: data.score,
        inventory: data.inventory
      });

      const result = getItemById(recipe.result);
      this.app.notify(`🔨 Скрафчено: ${result?.emoji || '🥭'} ${result?.name || ''}!`, 'success');

      if (result) this.showReveal(result);
      this.render();
    } catch (error) {
      // ОТКАТ
      data.score = oldScore;
      data.inventory = oldInventory;
      this.app.notify('Ошибка крафта!', 'error');
    } finally {
      this.isCrafting = false;
      if (buttonEl) buttonEl.disabled = false;
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
  }
}
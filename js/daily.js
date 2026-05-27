// js/daily.js
export class DailyManager {
  constructor(app) {
    this.app = app;
    this.isClaiming = false; // защита от двойного клика
    this.dailyRewards = [
      { day: 1, emoji: '🥭', reward: 500,    type: 'score' },
      { day: 2, emoji: '🥭', reward: 1000,   type: 'score' },
      { day: 3, emoji: '⚡', reward: 50,     type: 'energy' },
      { day: 4, emoji: '🥭', reward: 2500,   type: 'score' },
      { day: 5, emoji: '🥭', reward: 5000,   type: 'score' },
      { day: 6, emoji: '⚡', reward: 100,    type: 'energy' },
      { day: 7, emoji: '🎁', reward: 15000,  type: 'score' },
    ];
    this.checkDailyAvailable();
  }

  checkDailyAvailable() {
    const data = this.app.userData;
    if (!data) return;

    const lastDaily = this.parseDate(data.lastDaily);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let available = false;
    if (!lastDaily) {
      available = true;
    } else {
      const lastDate = new Date(lastDaily.getFullYear(), lastDaily.getMonth(), lastDaily.getDate());
      available = today > lastDate;
    }

    const navBtn = document.getElementById('nav-rewards');
    if (navBtn) {
      if (available) navBtn.classList.add('has-notification');
      else navBtn.classList.remove('has-notification');
    }
  }

  parseDate(d) {
    if (!d) return null;
    if (d.seconds) return new Date(d.seconds * 1000);
    if (d.toDate) return d.toDate();
    return new Date(d);
  }

  render() {
    const container = document.getElementById('rewards-content');
    if (!container) return;

    const data = this.app.userData;
    const lastDaily = this.parseDate(data.lastDaily);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let canClaim = false;
    if (!lastDaily) {
      canClaim = true;
    } else {
      const lastDate = new Date(lastDaily.getFullYear(), lastDaily.getMonth(), lastDaily.getDate());
      const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays >= 1) canClaim = true;
      if (diffDays > 1) {
        data.dailyStreak = 0;
      }
    }

    const streak = Math.max(0, Math.min(10000, data.dailyStreak || 0));
    const currentDay = streak % 7;

    container.innerHTML = '';

    const section = document.createElement('div');
    section.className = 'reward-section';

    const h3 = document.createElement('h3');
    h3.textContent = `📅 Ежедневные награды `;
    const streakSpan = document.createElement('span');
    streakSpan.style.cssText = 'font-size:13px;color:var(--text-muted);font-weight:500;';
    streakSpan.textContent = `Серия: ${streak} дней`;
    h3.appendChild(streakSpan);
    section.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'daily-grid';

    this.dailyRewards.forEach((r, i) => {
      const isClaimed = i < currentDay || (!canClaim && i === currentDay);
      const isAvailable = canClaim && i === currentDay;
      const isLocked = i > currentDay || (!canClaim && i > currentDay);

      const box = document.createElement('div');
      box.className = `daily-box ${isClaimed ? 'claimed' : ''} ${isAvailable ? 'available' : ''} ${isLocked ? 'locked' : ''}`;

      const day = document.createElement('div');
      day.className = 'daily-box-day';
      day.textContent = `День ${r.day}`;
      box.appendChild(day);

      const emoji = document.createElement('div');
      emoji.className = 'daily-box-emoji';
      emoji.textContent = r.emoji;
      box.appendChild(emoji);

      const rewardEl = document.createElement('div');
      rewardEl.className = 'daily-box-reward';
      rewardEl.textContent = r.type === 'score'
        ? `+${this.app.formatNumber(r.reward)}`
        : `+${r.reward}⚡`;
      box.appendChild(rewardEl);

      if (isClaimed) {
        const check = document.createElement('div');
        check.style.cssText = 'font-size:14px;color:var(--success);margin-top:4px;';
        check.textContent = '✓';
        box.appendChild(check);
      }

      if (isAvailable) {
        box.addEventListener('click', () => this.claimDaily());
      }

      grid.appendChild(box);
    });

    section.appendChild(grid);
    container.appendChild(section);

    const dropDiv = document.createElement('div');
    dropDiv.id = 'weekly-drop-section';
    container.appendChild(dropDiv);
  }

  async claimDaily() {
    if (this.isClaiming) return;

    const data = this.app.userData;

    // ПРОВЕРКА: можно ли получить (защита от мульти-клика)
    const lastDaily = this.parseDate(data.lastDaily);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (lastDaily) {
      const lastDate = new Date(lastDaily.getFullYear(), lastDaily.getMonth(), lastDaily.getDate());
      if (today <= lastDate) {
        this.app.notify('Награда уже получена сегодня!', 'warning');
        return;
      }
    }

    this.isClaiming = true;

    const streak = Math.max(0, Math.min(10000, data.dailyStreak || 0));
    const dayIndex = streak % 7;
    const reward = this.dailyRewards[dayIndex];

    const oldScore = data.score;
    const oldEnergy = data.energy;
    const oldStreak = data.dailyStreak;
    const oldLastDaily = data.lastDaily;

    if (reward.type === 'score') {
      data.score += reward.reward;
    } else if (reward.type === 'energy') {
      data.energy = Math.min(data.maxEnergy, data.energy + reward.reward);
    }

    data.dailyStreak = streak + 1;
    data.lastDaily = new Date();

    try {
      await this.app.saveUserData({
        score: data.score,
        energy: data.energy,
        dailyStreak: data.dailyStreak,
        lastDaily: data.lastDaily
      });

      this.app.notify(
        `🎁 Награда дня ${reward.day}! ${reward.emoji} +${this.app.formatNumber(reward.reward)}${reward.type === 'energy' ? ' энергии' : ' очков'}`,
        'success',
        4000
      );
      this.checkDailyAvailable();
      this.render();
      if (this.app.dropsManager) this.app.dropsManager.render();
    } catch (error) {
      // ОТКАТ
      data.score = oldScore;
      data.energy = oldEnergy;
      data.dailyStreak = oldStreak;
      data.lastDaily = oldLastDaily;
      this.app.notify('Ошибка получения награды!', 'error');
    } finally {
      this.isClaiming = false;
    }
  }
}
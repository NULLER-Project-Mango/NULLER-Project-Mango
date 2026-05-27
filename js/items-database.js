// js/items-database.js

export const RARITIES = {
  common:    { name: 'Обычный',      color: '#9e9e9e', glow: 'rgba(158,158,158,0.4)', chance: 0.40, multiplier: 1 },
  uncommon:  { name: 'Необычный',    color: '#4caf50', glow: 'rgba(76,175,80,0.4)',   chance: 0.25, multiplier: 1.5 },
  rare:      { name: 'Редкий',       color: '#2196f3', glow: 'rgba(33,150,243,0.4)',   chance: 0.15, multiplier: 2.5 },
  epic:      { name: 'Эпический',    color: '#9c27b0', glow: 'rgba(156,39,176,0.4)',   chance: 0.10, multiplier: 5 },
  legendary: { name: 'Легендарный',  color: '#ff9800', glow: 'rgba(255,152,0,0.5)',    chance: 0.06, multiplier: 12 },
  mythic:    { name: 'Мифический',   color: '#f44336', glow: 'rgba(244,67,54,0.6)',    chance: 0.03, multiplier: 30 },
  divine:    { name: 'Божественный', color: '#ffeb3b', glow: 'rgba(255,235,59,0.7)',   chance: 0.008, multiplier: 80 },
  cosmic:    { name: 'Космический',  color: '#e040fb', glow: 'rgba(224,64,251,0.8)',   chance: 0.002, multiplier: 250 }
};

// Цены увеличены ещё в 10 раз!
export const MANGO_SKINS = [
  { id: 'mango_default',       name: 'Обычное Манго',           rarity: 'common',    price: 0,           clickBonus: 0,    type: 'skin', render: '2d', emoji: '🥭', description: 'Стандартное спелое манго' },
  { id: 'mango_green',         name: 'Зелёное Манго',           rarity: 'common',    price: 5000,        clickBonus: 1,    type: 'skin', render: '2d', emoji: '🥭', description: 'Ещё не дозрело, но уже кликабельно' },
  { id: 'mango_small',         name: 'Маленькое Манго',         rarity: 'common',    price: 7500,        clickBonus: 1,    type: 'skin', render: '2d', emoji: '🥭', description: 'Компактное и удобное' },
  { id: 'mango_round',         name: 'Круглое Манго',           rarity: 'common',    price: 10000,       clickBonus: 1,    type: 'skin', render: '2d', emoji: '🥭', description: 'Идеально круглой формы' },
  { id: 'mango_spotted',       name: 'Пятнистое Манго',         rarity: 'common',    price: 12000,       clickBonus: 2,    type: 'skin', render: '2d', emoji: '🥭', description: 'С забавными пятнышками' },

  { id: 'mango_golden_light',  name: 'Золотистое Манго',        rarity: 'uncommon',  price: 30000,       clickBonus: 3,    type: 'skin', render: '2d', emoji: '🥭', description: 'Слегка золотистый оттенок' },
  { id: 'mango_red',           name: 'Красное Манго',           rarity: 'uncommon',  price: 40000,       clickBonus: 4,    type: 'skin', render: '2d', emoji: '🥭', description: 'Редкий красный сорт' },
  { id: 'mango_striped',       name: 'Полосатое Манго',         rarity: 'uncommon',  price: 45000,       clickBonus: 4,    type: 'skin', render: '2d', emoji: '🥭', description: 'С причудливыми полосками' },
  { id: 'mango_neon_green',    name: 'Неоново-зелёное Манго',   rarity: 'uncommon',  price: 50000,       clickBonus: 5,    type: 'skin', render: '2d', emoji: '🥭', description: 'Светится зелёным' },
  { id: 'mango_tropical',      name: 'Тропическое Манго',       rarity: 'uncommon',  price: 55000,       clickBonus: 5,    type: 'skin', render: '2d', emoji: '🌴', description: 'Прямо с пальмы!' },

  { id: 'mango_crystal',       name: 'Кристальное Манго',       rarity: 'rare',      price: 150000,      clickBonus: 8,    type: 'skin', render: '3d', emoji: '💎', description: 'Сделано из чистого кристалла' },
  { id: 'mango_ice',           name: 'Ледяное Манго',           rarity: 'rare',      price: 180000,      clickBonus: 9,    type: 'skin', render: '3d', emoji: '🧊', description: 'Замороженное в вечном льду' },
  { id: 'mango_fire',          name: 'Огненное Манго',          rarity: 'rare',      price: 200000,      clickBonus: 10,   type: 'skin', render: '3d', emoji: '🔥', description: 'Горит вечным пламенем' },
  { id: 'mango_electric',      name: 'Электрическое Манго',     rarity: 'rare',      price: 220000,      clickBonus: 11,   type: 'skin', render: '3d', emoji: '⚡', description: 'Бьёт током при касании' },
  { id: 'mango_rainbow',       name: 'Радужное Манго',          rarity: 'rare',      price: 250000,      clickBonus: 12,   type: 'skin', render: '3d', emoji: '🌈', description: 'Переливается всеми цветами' },
  { id: 'mango_steampunk',     name: 'Стимпанк Манго',          rarity: 'rare',      price: 280000,      clickBonus: 13,   type: 'skin', render: '3d', emoji: '⚙️', description: 'С шестерёнками и паром' },

  { id: 'mango_diamond',       name: 'Алмазное Манго',          rarity: 'epic',      price: 800000,      clickBonus: 20,   type: 'skin', render: '3d', emoji: '💠', description: 'Огранённое как бриллиант' },
  { id: 'mango_plasma',        name: 'Плазменное Манго',        rarity: 'epic',      price: 900000,      clickBonus: 22,   type: 'skin', render: '3d', emoji: '🟣', description: 'Состоит из чистой плазмы' },
  { id: 'mango_void',          name: 'Манго Пустоты',           rarity: 'epic',      price: 1000000,     clickBonus: 25,   type: 'skin', render: '3d', emoji: '🕳️', description: 'Из глубин пустоты' },
  { id: 'mango_cyberpunk',     name: 'Киберпанк Манго',         rarity: 'epic',      price: 1100000,     clickBonus: 27,   type: 'skin', render: '3d', emoji: '🤖', description: 'Полностью кибернетизировано' },
  { id: 'mango_ancient',       name: 'Древнее Манго',           rarity: 'epic',      price: 1200000,     clickBonus: 30,   type: 'skin', render: '3d', emoji: '🏛️', description: 'Артефакт древней цивилизации' },

  { id: 'mango_golden',        name: 'Золотое Манго',           rarity: 'legendary', price: 5000000,     clickBonus: 50,   type: 'skin', render: '3d', emoji: '🌟', description: 'Из чистого золота 999 пробы' },
  { id: 'mango_galaxy',        name: 'Галактическое Манго',     rarity: 'legendary', price: 6000000,     clickBonus: 55,   type: 'skin', render: '3d', emoji: '🌌', description: 'Содержит целую галактику' },
  { id: 'mango_dragon',        name: 'Драконье Манго',          rarity: 'legendary', price: 7000000,     clickBonus: 60,   type: 'skin', render: '3d', emoji: '🐉', description: 'Выращено драконом' },
  { id: 'mango_phoenix',       name: 'Манго Феникса',           rarity: 'legendary', price: 8000000,     clickBonus: 65,   type: 'skin', render: '3d', emoji: '🔥', description: 'Возрождается из пепла' },

  { id: 'mango_celestial',     name: 'Небесное Манго',          rarity: 'mythic',    price: 25000000,    clickBonus: 120,  type: 'skin', render: '3d', emoji: '✨', description: 'Благословлено небесами' },
  { id: 'mango_quantum',       name: 'Квантовое Манго',         rarity: 'mythic',    price: 30000000,    clickBonus: 140,  type: 'skin', render: '3d', emoji: '⚛️', description: 'Существует во всех измерениях' },
  { id: 'mango_time',          name: 'Манго Времени',           rarity: 'mythic',    price: 35000000,    clickBonus: 160,  type: 'skin', render: '3d', emoji: '⏳', description: 'Управляет потоком времени' },

  { id: 'mango_divine',        name: 'Божественное Манго',      rarity: 'divine',    price: 100000000,   clickBonus: 350,  type: 'skin', render: '3d', emoji: '👑', description: 'Создано богами' },
  { id: 'mango_eternal',       name: 'Вечное Манго',            rarity: 'divine',    price: 150000000,   clickBonus: 450,  type: 'skin', render: '3d', emoji: '♾️', description: 'Существует вне времени' },

  { id: 'mango_cosmic',        name: 'Космическое Манго',       rarity: 'cosmic',    price: 500000000,   clickBonus: 1000, type: 'skin', render: '3d', emoji: '🪐', description: 'Сила всей вселенной' },
  { id: 'mango_singularity',   name: 'Манго Сингулярности',     rarity: 'cosmic',    price: 1000000000,  clickBonus: 2000, type: 'skin', render: '3d', emoji: '💫', description: 'Абсолютная сила' },
];

export const UPGRADES = [
  { id: 'click_power_1',   name: 'Крепкий палец',        rarity: 'common',    price: 10000,       effect: 'clickPower',   value: 1,    type: 'upgrade', emoji: '👆', description: '+1 к силе клика' },
  { id: 'click_power_2',   name: 'Стальной палец',       rarity: 'common',    price: 30000,       effect: 'clickPower',   value: 2,    type: 'upgrade', emoji: '💪', description: '+2 к силе клика' },
  { id: 'click_power_3',   name: 'Титановый палец',      rarity: 'uncommon',  price: 80000,       effect: 'clickPower',   value: 5,    type: 'upgrade', emoji: '🦾', description: '+5 к силе клика' },
  { id: 'click_power_4',   name: 'Алмазный палец',       rarity: 'rare',      price: 300000,      effect: 'clickPower',   value: 10,   type: 'upgrade', emoji: '💎', description: '+10 к силе клика' },
  { id: 'click_power_5',   name: 'Нейтронный палец',     rarity: 'epic',      price: 1500000,     effect: 'clickPower',   value: 25,   type: 'upgrade', emoji: '⚡', description: '+25 к силе клика' },
  { id: 'click_power_6',   name: 'Квантовый палец',      rarity: 'legendary', price: 8000000,     effect: 'clickPower',   value: 60,   type: 'upgrade', emoji: '⚛️', description: '+60 к силе клика' },
  { id: 'click_power_7',   name: 'Божественный палец',   rarity: 'mythic',    price: 40000000,    effect: 'clickPower',   value: 150,  type: 'upgrade', emoji: '✨', description: '+150 к силе клика' },
  { id: 'click_power_8',   name: 'Космический палец',    rarity: 'divine',    price: 200000000,   effect: 'clickPower',   value: 400,  type: 'upgrade', emoji: '🌌', description: '+400 к силе клика' },

  { id: 'auto_click_1',    name: 'Маленький бот',        rarity: 'common',    price: 20000,       effect: 'autoClick',    value: 1,    type: 'upgrade', emoji: '🤖', description: '1 клик/сек автоматически' },
  { id: 'auto_click_2',    name: 'Средний бот',          rarity: 'uncommon',  price: 60000,       effect: 'autoClick',    value: 3,    type: 'upgrade', emoji: '🤖', description: '3 клика/сек' },
  { id: 'auto_click_3',    name: 'Большой бот',          rarity: 'rare',      price: 250000,      effect: 'autoClick',    value: 8,    type: 'upgrade', emoji: '🤖', description: '8 кликов/сек' },
  { id: 'auto_click_4',    name: 'Мега бот',             rarity: 'epic',      price: 1200000,     effect: 'autoClick',    value: 20,   type: 'upgrade', emoji: '🤖', description: '20 кликов/сек' },
  { id: 'auto_click_5',    name: 'Ультра бот',           rarity: 'legendary', price: 6000000,     effect: 'autoClick',    value: 50,   type: 'upgrade', emoji: '🤖', description: '50 кликов/сек' },
  { id: 'auto_click_6',    name: 'Гипер бот',            rarity: 'mythic',    price: 30000000,    effect: 'autoClick',    value: 130,  type: 'upgrade', emoji: '🤖', description: '130 кликов/сек' },

  { id: 'energy_max_1',    name: 'Батарейка',            rarity: 'common',    price: 15000,       effect: 'maxEnergy',    value: 50,   type: 'upgrade', emoji: '🔋', description: '+50 макс. энергии' },
  { id: 'energy_max_2',    name: 'Аккумулятор',          rarity: 'uncommon',  price: 50000,       effect: 'maxEnergy',    value: 150,  type: 'upgrade', emoji: '🔋', description: '+150 макс. энергии' },
  { id: 'energy_max_3',    name: 'Реактор',              rarity: 'rare',      price: 200000,      effect: 'maxEnergy',    value: 400,  type: 'upgrade', emoji: '⚡', description: '+400 макс. энергии' },
  { id: 'energy_max_4',    name: 'Термоядерный реактор', rarity: 'epic',      price: 1000000,     effect: 'maxEnergy',    value: 1000, type: 'upgrade', emoji: '☢️', description: '+1000 макс. энергии' },
  { id: 'energy_regen_1',  name: 'Зарядка',              rarity: 'common',    price: 25000,       effect: 'energyRegen',  value: 1,    type: 'upgrade', emoji: '🔌', description: '+1 восст. энергии/сек' },
  { id: 'energy_regen_2',  name: 'Турбо зарядка',        rarity: 'uncommon',  price: 80000,       effect: 'energyRegen',  value: 3,    type: 'upgrade', emoji: '🔌', description: '+3 восст. энергии/сек' },
  { id: 'energy_regen_3',  name: 'Солнечная панель',     rarity: 'rare',      price: 350000,      effect: 'energyRegen',  value: 7,    type: 'upgrade', emoji: '☀️', description: '+7 восст. энергии/сек' },
  { id: 'energy_regen_4',  name: 'Звёздный генератор',   rarity: 'epic',      price: 1500000,     effect: 'energyRegen',  value: 15,   type: 'upgrade', emoji: '⭐', description: '+15 восст. энергии/сек' },

  { id: 'multi_1',         name: 'Удобрение',            rarity: 'uncommon',  price: 100000,      effect: 'multiplier',   value: 1.1,  type: 'upgrade', emoji: '🧪', description: 'x1.1 к очкам' },
  { id: 'multi_2',         name: 'Супер удобрение',      rarity: 'rare',      price: 500000,      effect: 'multiplier',   value: 1.25, type: 'upgrade', emoji: '🧪', description: 'x1.25 к очкам' },
  { id: 'multi_3',         name: 'Мега удобрение',       rarity: 'epic',      price: 2500000,     effect: 'multiplier',   value: 1.5,  type: 'upgrade', emoji: '🧪', description: 'x1.5 к очкам' },
  { id: 'multi_4',         name: 'Космическое удобрение',rarity: 'legendary', price: 12000000,    effect: 'multiplier',   value: 2.0,  type: 'upgrade', emoji: '🧪', description: 'x2 к очкам' },
  { id: 'multi_5',         name: 'Божественное удобрение',rarity: 'mythic',   price: 60000000,    effect: 'multiplier',   value: 3.0,  type: 'upgrade', emoji: '🧪', description: 'x3 к очкам' },

  { id: 'crit_chance_1',   name: 'Удача',                rarity: 'uncommon',  price: 70000,       effect: 'critChance',   value: 0.05, type: 'upgrade', emoji: '🍀', description: '+5% шанс крита' },
  { id: 'crit_chance_2',   name: 'Большая удача',        rarity: 'rare',      price: 300000,      effect: 'critChance',   value: 0.08, type: 'upgrade', emoji: '🍀', description: '+8% шанс крита' },
  { id: 'crit_chance_3',   name: 'Мега удача',           rarity: 'epic',      price: 1500000,     effect: 'critChance',   value: 0.12, type: 'upgrade', emoji: '🍀', description: '+12% шанс крита' },
  { id: 'crit_power_1',    name: 'Мощный крит',          rarity: 'rare',      price: 400000,      effect: 'critMulti',    value: 0.5,  type: 'upgrade', emoji: '💥', description: '+0.5x урон крита' },
  { id: 'crit_power_2',    name: 'Разрушительный крит',  rarity: 'epic',      price: 2000000,     effect: 'critMulti',    value: 1.0,  type: 'upgrade', emoji: '💥', description: '+1x урон крита' },
];

export const COLLECTIBLES = [
  { id: 'hat_basic',       name: 'Шляпа',                rarity: 'common',    price: 8000,        type: 'accessory', emoji: '🎩', description: 'Элегантная шляпа для манго' },
  { id: 'glasses_cool',    name: 'Крутые очки',          rarity: 'common',    price: 12000,       type: 'accessory', emoji: '😎', description: 'Стильные солнечные очки' },
  { id: 'bow_tie',         name: 'Бабочка',              rarity: 'common',    price: 10000,       type: 'accessory', emoji: '🎀', description: 'Галстук-бабочка' },
  { id: 'crown_bronze',    name: 'Бронзовая корона',     rarity: 'uncommon',  price: 50000,       type: 'accessory', emoji: '👑', description: 'Корона из бронзы' },
  { id: 'crown_silver',    name: 'Серебряная корона',    rarity: 'rare',      price: 200000,      type: 'accessory', emoji: '👑', description: 'Серебряная корона' },
  { id: 'crown_gold',      name: 'Золотая корона',       rarity: 'epic',      price: 1000000,     type: 'accessory', emoji: '👑', description: 'Золотая корона для манго' },
  { id: 'crown_diamond',   name: 'Алмазная корона',      rarity: 'legendary', price: 5000000,     type: 'accessory', emoji: '👑', description: 'Усыпана бриллиантами' },
  { id: 'wings_angel',     name: 'Крылья ангела',        rarity: 'epic',      price: 1500000,     type: 'accessory', emoji: '😇', description: 'Небесные крылья' },
  { id: 'wings_demon',     name: 'Крылья демона',        rarity: 'epic',      price: 1500000,     type: 'accessory', emoji: '😈', description: 'Тёмные крылья' },
  { id: 'wings_dragon',    name: 'Крылья дракона',       rarity: 'legendary', price: 7500000,     type: 'accessory', emoji: '🐲', description: 'Могучие крылья' },
  { id: 'aura_fire',       name: 'Огненная аура',        rarity: 'rare',      price: 300000,      type: 'accessory', emoji: '🔥', description: 'Пылающая аура' },
  { id: 'aura_ice',        name: 'Ледяная аура',         rarity: 'rare',      price: 300000,      type: 'accessory', emoji: '❄️', description: 'Морозная аура' },
  { id: 'aura_lightning',  name: 'Молниевая аура',       rarity: 'epic',      price: 800000,      type: 'accessory', emoji: '⚡', description: 'Электрическая аура' },
  { id: 'aura_cosmic',     name: 'Космическая аура',     rarity: 'mythic',    price: 20000000,    type: 'accessory', emoji: '🌌', description: 'Аура космоса' },

  { id: 'pet_cat',         name: 'Кот-помощник',         rarity: 'uncommon',  price: 60000,       type: 'pet', emoji: '🐱', description: 'Мяукает при кликах' },
  { id: 'pet_dog',         name: 'Пёс-охранник',         rarity: 'uncommon',  price: 60000,       type: 'pet', emoji: '🐶', description: 'Охраняет ваше манго' },
  { id: 'pet_parrot',      name: 'Попугай',              rarity: 'rare',      price: 250000,      type: 'pet', emoji: '🦜', description: 'Тропический друг' },
  { id: 'pet_dragon_baby', name: 'Маленький дракон',     rarity: 'epic',      price: 1200000,     type: 'pet', emoji: '🐉', description: 'Дышит огнём' },
  { id: 'pet_phoenix',     name: 'Феникс',               rarity: 'legendary', price: 5500000,     type: 'pet', emoji: '🦅', description: 'Бессмертная птица' },
  { id: 'pet_unicorn',     name: 'Единорог',             rarity: 'mythic',    price: 28000000,    type: 'pet', emoji: '🦄', description: 'Магическое существо' },

  { id: 'bg_sunset',       name: 'Закат',                rarity: 'common',    price: 20000,       type: 'background', emoji: '🌅', description: 'Тёплый закат' },
  { id: 'bg_ocean',        name: 'Океан',                rarity: 'common',    price: 20000,       type: 'background', emoji: '🌊', description: 'Морской бриз' },
  { id: 'bg_forest',       name: 'Лес',                  rarity: 'uncommon',  price: 40000,       type: 'background', emoji: '🌳', description: 'Тропический лес' },
  { id: 'bg_space',        name: 'Космос',               rarity: 'rare',      price: 150000,      type: 'background', emoji: '🚀', description: 'Открытый космос' },
  { id: 'bg_neon_city',    name: 'Неоновый город',       rarity: 'rare',      price: 200000,      type: 'background', emoji: '🌃', description: 'Киберпанк город' },
  { id: 'bg_volcano',      name: 'Вулкан',               rarity: 'epic',      price: 800000,      type: 'background', emoji: '🌋', description: 'Извергающийся вулкан' },
  { id: 'bg_aurora',       name: 'Северное сияние',      rarity: 'epic',      price: 1000000,     type: 'background', emoji: '🌌', description: 'Магическое сияние' },
  { id: 'bg_dimension',    name: 'Другое измерение',     rarity: 'legendary', price: 4500000,     type: 'background', emoji: '🕳️', description: 'Портал в другой мир' },
  { id: 'bg_heaven',       name: 'Небеса',               rarity: 'mythic',    price: 22000000,    type: 'background', emoji: '☁️', description: 'Божественные небеса' },

  { id: 'trail_sparkle',   name: 'Искры',                rarity: 'uncommon',  price: 35000,       type: 'trail', emoji: '✨', description: 'Искры при клике' },
  { id: 'trail_hearts',    name: 'Сердечки',             rarity: 'uncommon',  price: 40000,       type: 'trail', emoji: '❤️', description: 'Летящие сердечки' },
  { id: 'trail_stars',     name: 'Звёзды',               rarity: 'rare',      price: 180000,      type: 'trail', emoji: '⭐', description: 'Звёздный след' },
  { id: 'trail_fire',      name: 'Огненный след',        rarity: 'rare',      price: 220000,      type: 'trail', emoji: '🔥', description: 'Пылающий след' },
  { id: 'trail_rainbow',   name: 'Радужный след',        rarity: 'epic',      price: 900000,      type: 'trail', emoji: '🌈', description: 'Радуга за курсором' },
  { id: 'trail_galaxy',    name: 'Галактический след',   rarity: 'legendary', price: 4000000,     type: 'trail', emoji: '🌌', description: 'Космическая пыль' },

  { id: 'effect_pop',      name: 'Лопание',              rarity: 'common',    price: 15000,       type: 'effect', emoji: '💨', description: 'Эффект лопания' },
  { id: 'effect_coins',    name: 'Монетки',              rarity: 'uncommon',  price: 50000,       type: 'effect', emoji: '🪙', description: 'Летящие монетки' },
  { id: 'effect_explosion',name: 'Взрыв',                rarity: 'rare',      price: 250000,      type: 'effect', emoji: '💥', description: 'Мощный взрыв' },
  { id: 'effect_portal',   name: 'Портал',               rarity: 'epic',      price: 1100000,     type: 'effect', emoji: '🌀', description: 'Открытие портала' },
  { id: 'effect_nuke',     name: 'Ядерный взрыв',        rarity: 'legendary', price: 5500000,     type: 'effect', emoji: '☢️', description: 'Ядерный гриб' },

  { id: 'music_chill',     name: 'Чил музыка',           rarity: 'common',    price: 10000,       type: 'music', emoji: '🎵', description: 'Расслабляющая мелодия' },
  { id: 'music_epic',      name: 'Эпик музыка',          rarity: 'rare',      price: 150000,      type: 'music', emoji: '🎶', description: 'Эпическая музыка' },
  { id: 'music_retro',     name: 'Ретро музыка',         rarity: 'uncommon',  price: 45000,       type: 'music', emoji: '📻', description: '8-bit мелодия' },

  { id: 'frame_wood',      name: 'Деревянная рамка',     rarity: 'common',    price: 9000,        type: 'frame', emoji: '🪵', description: 'Простая деревянная рамка' },
  { id: 'frame_gold',      name: 'Золотая рамка',        rarity: 'rare',      price: 200000,      type: 'frame', emoji: '🖼️', description: 'Золотая рамка' },
  { id: 'frame_diamond',   name: 'Алмазная рамка',       rarity: 'epic',      price: 900000,      type: 'frame', emoji: '💎', description: 'Сияющая рамка' },
  { id: 'frame_animated',  name: 'Анимированная рамка',  rarity: 'legendary', price: 4200000,     type: 'frame', emoji: '🌟', description: 'Живая рамка' },

  { id: 'title_beginner',  name: 'Титул: Новичок',       rarity: 'common',    price: 5000,        type: 'title', emoji: '📛', description: 'Титул "Новичок"' },
  { id: 'title_clicker',   name: 'Титул: Кликер',        rarity: 'uncommon',  price: 30000,       type: 'title', emoji: '📛', description: 'Титул "Кликер"' },
  { id: 'title_master',    name: 'Титул: Мастер',        rarity: 'rare',      price: 150000,      type: 'title', emoji: '📛', description: 'Титул "Мастер"' },
  { id: 'title_legend',    name: 'Титул: Легенда',       rarity: 'epic',      price: 800000,      type: 'title', emoji: '📛', description: 'Титул "Легенда"' },
  { id: 'title_god',       name: 'Титул: Бог Манго',     rarity: 'legendary', price: 5000000,     type: 'title', emoji: '📛', description: 'Титул "Бог Манго"' },
  { id: 'title_creator',   name: 'Титул: Создатель',     rarity: 'mythic',    price: 25000000,    type: 'title', emoji: '📛', description: 'Титул "Создатель"' },
];

export const RECIPES = [
  { id: 'recipe_1',  name: 'Кристальное манго',  result: 'mango_crystal',     ingredients: [{ id: 'mango_green', qty: 3 }, { id: 'mango_round', qty: 2 }],  cost: 50000 },
  { id: 'recipe_2',  name: 'Огненное манго',     result: 'mango_fire',        ingredients: [{ id: 'mango_red', qty: 3 }, { id: 'aura_fire', qty: 1 }],      cost: 100000 },
  { id: 'recipe_3',  name: 'Ледяное манго',      result: 'mango_ice',         ingredients: [{ id: 'mango_crystal', qty: 1 }, { id: 'aura_ice', qty: 1 }],    cost: 120000 },
  { id: 'recipe_4',  name: 'Радужное манго',      result: 'mango_rainbow',     ingredients: [{ id: 'mango_fire', qty: 1 }, { id: 'mango_ice', qty: 1 }, { id: 'mango_electric', qty: 1 }], cost: 300000 },
  { id: 'recipe_5',  name: 'Алмазное манго',      result: 'mango_diamond',     ingredients: [{ id: 'mango_crystal', qty: 3 }, { id: 'crown_silver', qty: 1 }], cost: 500000 },
  { id: 'recipe_6',  name: 'Галактическое манго', result: 'mango_galaxy',      ingredients: [{ id: 'mango_diamond', qty: 1 }, { id: 'mango_void', qty: 1 }, { id: 'bg_space', qty: 1 }], cost: 2000000 },
  { id: 'recipe_7',  name: 'Драконье манго',      result: 'mango_dragon',      ingredients: [{ id: 'mango_fire', qty: 2 }, { id: 'pet_dragon_baby', qty: 1 }, { id: 'wings_dragon', qty: 1 }], cost: 3000000 },
  { id: 'recipe_8',  name: 'Манго Феникса',       result: 'mango_phoenix',     ingredients: [{ id: 'mango_dragon', qty: 1 }, { id: 'pet_phoenix', qty: 1 }], cost: 4000000 },
  { id: 'recipe_9',  name: 'Небесное манго',      result: 'mango_celestial',   ingredients: [{ id: 'mango_phoenix', qty: 1 }, { id: 'mango_galaxy', qty: 1 }, { id: 'aura_cosmic', qty: 1 }], cost: 10000000 },
  { id: 'recipe_10', name: 'Квантовое манго',     result: 'mango_quantum',     ingredients: [{ id: 'mango_celestial', qty: 1 }, { id: 'mango_cyberpunk', qty: 2 }], cost: 15000000 },
  { id: 'recipe_11', name: 'Манго Времени',       result: 'mango_time',        ingredients: [{ id: 'mango_quantum', qty: 1 }, { id: 'mango_ancient', qty: 2 }], cost: 20000000 },
  { id: 'recipe_12', name: 'Божественное манго',   result: 'mango_divine',      ingredients: [{ id: 'mango_time', qty: 1 }, { id: 'mango_celestial', qty: 1 }, { id: 'crown_diamond', qty: 1 }], cost: 50000000 },
  { id: 'recipe_13', name: 'Вечное манго',         result: 'mango_eternal',     ingredients: [{ id: 'mango_divine', qty: 2 }, { id: 'bg_heaven', qty: 1 }], cost: 80000000 },
  { id: 'recipe_14', name: 'Космическое манго',    result: 'mango_cosmic',      ingredients: [{ id: 'mango_eternal', qty: 1 }, { id: 'mango_quantum', qty: 1 }, { id: 'aura_cosmic', qty: 2 }], cost: 200000000 },
  { id: 'recipe_15', name: 'Манго Сингулярности',  result: 'mango_singularity', ingredients: [{ id: 'mango_cosmic', qty: 2 }, { id: 'mango_divine', qty: 1 }], cost: 500000000 },
  { id: 'recipe_16', name: 'Золотая корона',       result: 'crown_gold',        ingredients: [{ id: 'crown_silver', qty: 2 }, { id: 'crown_bronze', qty: 3 }], cost: 500000 },
  { id: 'recipe_17', name: 'Алмазная корона',      result: 'crown_diamond',     ingredients: [{ id: 'crown_gold', qty: 2 }], cost: 2500000 },
  { id: 'recipe_18', name: 'Крылья дракона',       result: 'wings_dragon',      ingredients: [{ id: 'wings_angel', qty: 1 }, { id: 'wings_demon', qty: 1 }, { id: 'aura_fire', qty: 2 }], cost: 3500000 },
  { id: 'recipe_19', name: 'Единорог',             result: 'pet_unicorn',       ingredients: [{ id: 'pet_phoenix', qty: 1 }, { id: 'trail_rainbow', qty: 1 }, { id: 'aura_cosmic', qty: 1 }], cost: 15000000 },
  { id: 'recipe_20', name: 'Космическая аура',     result: 'aura_cosmic',       ingredients: [{ id: 'aura_fire', qty: 1 }, { id: 'aura_ice', qty: 1 }, { id: 'aura_lightning', qty: 1 }], cost: 8000000 },
];

export const MANGO_LEVELS = [
  { level: 1,  name: 'Семечко',             requiredClicks: 0,            reward: 0 },
  { level: 2,  name: 'Росток',              requiredClicks: 500,          reward: 200 },
  { level: 3,  name: 'Саженец',             requiredClicks: 2500,         reward: 800 },
  { level: 4,  name: 'Молодое дерево',      requiredClicks: 7500,         reward: 2500 },
  { level: 5,  name: 'Цветущее дерево',     requiredClicks: 25000,        reward: 8000 },
  { level: 6,  name: 'Плодоносящее',        requiredClicks: 75000,        reward: 25000 },
  { level: 7,  name: 'Могучее дерево',       requiredClicks: 250000,       reward: 80000 },
  { level: 8,  name: 'Древнее дерево',       requiredClicks: 750000,       reward: 200000 },
  { level: 9,  name: 'Мировое дерево',       requiredClicks: 2500000,      reward: 600000 },
  { level: 10, name: 'Космическое дерево',   requiredClicks: 7500000,      reward: 1500000 },
  { level: 11, name: 'Божественное дерево',  requiredClicks: 25000000,     reward: 4000000 },
  { level: 12, name: 'Дерево Вселенной',     requiredClicks: 75000000,     reward: 10000000 },
  { level: 13, name: 'Дерево Бесконечности', requiredClicks: 250000000,    reward: 30000000 },
  { level: 14, name: 'Трансцендентное',      requiredClicks: 750000000,    reward: 100000000 },
  { level: 15, name: 'Абсолют',             requiredClicks: 2500000000,   reward: 500000000 },
];

export function getAllItems() {
  return [...MANGO_SKINS, ...UPGRADES, ...COLLECTIBLES];
}

export function getItemById(id) {
  return getAllItems().find(item => item.id === id);
}
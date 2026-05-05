const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const Database = require('better-sqlite3');
require('dotenv').config();

// ================== CONFIG ==================
const DIFFICULTY = {
  easy: { size: 4, mines: 2, name: '🍃 آسان', coin: 10 },
  normal: { size: 5, mines: 5, name: '⚙️ معمولی', coin: 25 },
  hard: { size: 6, mines: 10, name: '🔥 سخت', coin: 50 },
  expert: { size: 8, mines: 20, name: '💀 حرفه‌ای', coin: 100 }
};

// ================== LEVELING SYSTEM ==================
const LEVELS = [
  { level: 1, xp_needed: 0, name: '🌱 تازه‌کار', coin_bonus: 0 },
  { level: 2, xp_needed: 50, name: '⭐ مبتدی', coin_bonus: 5 },
  { level: 3, xp_needed: 120, name: '🔰 آشنای حرفه', coin_bonus: 10 },
  { level: 4, xp_needed: 250, name: '🎯 ماهر', coin_bonus: 15 },
  { level: 5, xp_needed: 500, name: '🔥 حرفه‌ای', coin_bonus: 25 },
  { level: 6, xp_needed: 900, name: '💎 استاد', coin_bonus: 40 },
  { level: 7, xp_needed: 1500, name: '👑 افسانه‌ای', coin_bonus: 60 },
  { level: 8, xp_needed: 2500, name: '⚡ قهرمان', coin_bonus: 85 },
  { level: 9, xp_needed: 4000, name: '🎖️ سوپراستار', coin_bonus: 120 },
  { level: 10, xp_needed: 6000, name: '🏆 خدا', coin_bonus: 200 }
];

// ================== THEMES ==================
const THEMES = {
  default: { name: 'کلاسیک', emoji: '⬜', price: 0, bg: '⬜', mine: '💣', flag: '🚩', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  neon: { name: 'نئون', emoji: '🟩', price: 200, bg: '🟩', mine: '💚', flag: '🚩', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  dark: { name: 'شب', emoji: '⬛', price: 150, bg: '⬛', mine: '💀', flag: '⚑', num: ['▪️', '❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽'] },
  gold: { name: 'طلایی', emoji: '🟨', price: 500, bg: '🟨', mine: '👑', flag: '⭐', num: ['▪️', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'] },
  candy: { name: 'شیرینی', emoji: '🩷', price: 300, bg: '🩷', mine: '🍬', flag: '🍭', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  ocean: { name: 'اقیانوسی', emoji: '💙', price: 250, bg: '💙', mine: '🐟', flag: '⚓', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  fire: { name: 'آتشی', emoji: '🧡', price: 350, bg: '🧡', mine: '🔥', flag: '⚡', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] }
};

// ================== KEEP ALIVE ==================
const app = express();
app.get('/', (req, res) => res.send('🎮 Minesweeper PRO v5.5 is alive'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🌐 Server on', PORT));

// ================== DATABASE ==================
const db = new Database('minesweeper.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    coins INTEGER DEFAULT 100,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    best_time INTEGER,
    achievements TEXT DEFAULT '[]',
    inventory TEXT DEFAULT '{}',
    best_streak INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    weekly_wins INTEGER DEFAULT 0,
    weekly_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    expert_wins INTEGER DEFAULT 0,
    name TEXT,
    theme TEXT DEFAULT 'default',
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_themes (
    user_id INTEGER,
    theme_key TEXT,
    PRIMARY KEY (user_id, theme_key)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

function getUser(userId) {
  const row = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare('INSERT INTO users (user_id, name) VALUES (?, ?)').run(userId, 'کاربر');
    return {
      userId,
      coins: 100,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      bestTime: null,
      achievements: [],
      inventory: {},
      bestStreak: 0,
      currentStreak: 0,
      weeklyWins: 0,
      weeklyScore: 0,
      totalScore: 0,
      expertWins: 0,
      name: 'کاربر',
      theme: 'default',
      xp: 0,
      level: 1
    };
  }
  return {
    userId: row.user_id,
    coins: row.coins,
    wins: row.wins,
    losses: row.losses,
    gamesPlayed: row.games_played,
    bestTime: row.best_time,
    achievements: JSON.parse(row.achievements),
    inventory: JSON.parse(row.inventory),
    bestStreak: row.best_streak,
    currentStreak: row.current_streak,
    weeklyWins: row.weekly_wins,
    weeklyScore: row.weekly_score,
    totalScore: row.total_score,
    expertWins: row.expert_wins,
    name: row.name || 'کاربر',
    theme: row.theme || 'default',
    xp: row.xp || 0,
    level: row.level || 1
  };
}

function updateUser(user) {
  db.prepare(`
    UPDATE users SET 
      coins = ?, 
      wins = ?, 
      losses = ?, 
      games_played = ?, 
      best_time = ?, 
      achievements = ?, 
      inventory = ?,
      best_streak = ?,
      current_streak = ?,
      weekly_wins = ?,
      weekly_score = ?,
      total_score = ?,
      expert_wins = ?,
      name = ?,
      theme = ?,
      xp = ?,
      level = ?
    WHERE user_id = ?
  `).run(
    user.coins,
    user.wins,
    user.losses,
    user.gamesPlayed,
    user.bestTime,
    JSON.stringify(user.achievements),
    JSON.stringify(user.inventory),
    user.bestStreak,
    user.currentStreak,
    user.weeklyWins,
    user.weeklyScore,
    user.totalScore,
    user.expertWins,
    user.name,
    user.theme,
    user.xp,
    user.level,
    user.userId
  );
}

// ================== BOT INIT ==================
const bot = new Telegraf(process.env.BOT_TOKEN);
const games = new Map();
let flagMode = new Map();

// ================== MAIN MENU BUTTONS ==================
function getMainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 شروع بازی', callback_data: 'new_game', style: 'primary' }],
        [
          { text: '🛒 فروشگاه', callback_data: 'shop_menu', style: 'success' },
          { text: '🎨 تم‌ها', callback_data: 'settings_menu', style: 'primary' },
          { text: '💰 کیف پول', callback_data: 'wallet', style: 'success' }
        ],
        [
          { text: '🏆 لیدربورد', callback_data: 'leaderboard_menu', style: 'primary' },
          { text: '🏆 دستاوردها', callback_data: 'achievements', style: 'primary' },
          { text: '📊 آمار من', callback_data: 'my_stats', style: 'primary' }
        ],
        [
          { text: '⭐ سطح من', callback_data: 'level_info', style: 'primary' },
          { text: '❓ راهنما', callback_data: 'help', style: 'danger' }
        ]
      ]
    }
  };
}

// ================== LEVELING FUNCTIONS ==================
function addXP(userId, amount) {
  const user = getUser(userId);
  user.xp += amount;
  let levelUpMsg = '';
  
  for (let i = user.level; i < LEVELS.length; i++) {
    const nextLevel = LEVELS[i];
    if (user.xp >= nextLevel.xp_needed) {
      user.level = nextLevel.level;
      levelUpMsg += `\n🎉 **سطح ${nextLevel.level}** رسیدی! ${nextLevel.name}\n💰 +${nextLevel.coin_bonus} سکه پاداش سطح!\n`;
      user.coins += nextLevel.coin_bonus;
    } else {
      break;
    }
  }
  
  updateUser(user);
  return levelUpMsg;
}

function getCurrentLevelInfo(xp) {
  let currentLevel = LEVELS[0];
  let nextLevel = LEVELS[1];
  
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp_needed) {
      currentLevel = LEVELS[i];
      if (i + 1 < LEVELS.length) {
        nextLevel = LEVELS[i + 1];
      } else {
        nextLevel = { xp_needed: xp, name: 'حداکثر', coin_bonus: 0 };
      }
      break;
    }
  }
  
  const xpNeeded = nextLevel.xp_needed - xp;
  const xpCurrent = xp - currentLevel.xp_needed;
  const xpMax = nextLevel.xp_needed - currentLevel.xp_needed;
  const progress = xpMax > 0 ? (xpCurrent / xpMax) * 100 : 100;
  
  return { currentLevel, nextLevel, xpNeeded, progress, xpCurrent, xpMax };
}

// ================== LEADERBOARD ==================
function getLeaderboard(type, stat) {
  let sql = '';
  switch(stat) {
    case 'wins':
      sql = 'SELECT user_id, wins, name FROM users ORDER BY wins DESC LIMIT 10';
      break;
    case 'streak':
      sql = 'SELECT user_id, best_streak, name FROM users ORDER BY best_streak DESC LIMIT 10';
      break;
    case 'score_all':
      sql = 'SELECT user_id, total_score, name FROM users ORDER BY total_score DESC LIMIT 10';
      break;
    case 'score_weekly':
      sql = 'SELECT user_id, weekly_score, name FROM users ORDER BY weekly_score DESC LIMIT 10';
      break;
    case 'coins':
      sql = 'SELECT user_id, coins, name FROM users ORDER BY coins DESC LIMIT 10';
      break;
    case 'level':
      sql = 'SELECT user_id, level, name FROM users ORDER BY level DESC, xp DESC LIMIT 10';
      break;
  }
  return db.prepare(sql).all();
}

function updateStreak(userId, win) {
  const user = getUser(userId);
  let newStreak = 0;
  
  if (win) {
    newStreak = (user.currentStreak || 0) + 1;
    user.currentStreak = newStreak;
    if (newStreak > (user.bestStreak || 0)) {
      user.bestStreak = newStreak;
    }
  } else {
    user.currentStreak = 0;
  }
  
  updateUser(user);
  return newStreak;
}

function resetWeeklyStats() {
  const users = db.prepare('SELECT user_id FROM users').all();
  for (const user of users) {
    db.prepare('UPDATE users SET weekly_wins = 0, weekly_score = 0 WHERE user_id = ?').run(user.user_id);
  }
  console.log('📊 Weekly stats reset');
}

function checkWeeklyReset() {
  const now = new Date();
  const lastReset = db.prepare("SELECT value FROM settings WHERE key = 'last_weekly_reset'").get();
  const lastResetDate = lastReset ? new Date(lastReset.value) : null;
  
  if (!lastResetDate || (now.getDay() === 1 && now.getDate() !== lastResetDate.getDate())) {
    resetWeeklyStats();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_weekly_reset', ?)").run(now.toISOString());
  }
}

// ================== ACHIEVEMENTS ==================
const ACHIEVEMENTS = {
  FIRST_WIN: { name: '🏆 اولین برد', desc: 'اولین بازی رو ببر', coin: 50 },
  EXPERT: { name: '🎖️ حرفه‌ای', desc: 'سطح حرفه‌ای رو ببر', coin: 200 },
  SPEEDRUN: { name: '⚡ سرعت', desc: 'زیر ۳۰ ثانیه ببر', coin: 100 },
  PERFECT: { name: '💎 کامل', desc: 'بدون اشتباه ببر', coin: 150 },
  LUCKY: { name: '🍀 خوش شانس', desc: 'با ۱ حرکت ببر', coin: 500 },
  STREAK_5: { name: '🔥 استریک ۵', desc: '۵ بار پشت سر هم ببر', coin: 100 },
  STREAK_10: { name: '⚡ استریک ۱۰', desc: '۱۰ بار پشت سر هم ببر', coin: 250 }
};

function checkAchievement(userId, type, gameData = {}) {
  const user = getUser(userId);
  if (user.achievements.includes(type)) return false;
  
  let earned = false;
  switch(type) {
    case 'FIRST_WIN': earned = user.wins === 1; break;
    case 'EXPERT': earned = gameData.difficulty === 'expert'; break;
    case 'SPEEDRUN': earned = (gameData.time || 0) < 30; break;
    case 'PERFECT': earned = gameData.moves === gameData.safeCells; break;
    case 'LUCKY': earned = gameData.moves === 1; break;
    case 'STREAK_5': earned = (user.bestStreak || 0) >= 5; break;
    case 'STREAK_10': earned = (user.bestStreak || 0) >= 10; break;
  }
  
  if (earned) {
    user.achievements.push(type);
    user.coins += ACHIEVEMENTS[type].coin;
    updateUser(user);
    return ACHIEVEMENTS[type];
  }
  return false;
}

// ================== SHOP ==================
const SHOP = {
  bomb_disabler: { name: '💣 مین‌شکن', desc: 'یه مین رو نابود کن', price: 50 },
  extra_life: { name: '❤️ جان اضافه', desc: 'یه بار میتونی اشتباه کنی', price: 75 },
  mine_detector: { name: '🔦 مین‌یاب', desc: 'یک مین رو نشون میده', price: 120 },
  smart_hint: { name: '🧠 حسگر هوشمند', desc: 'بهترین خونه امن رو پیشنهاد میده', price: 90 },
  time_freeze: { name: '⏰ فریز زمان', desc: '+۳۰ ثانیه به زمان', price: 80 },
  double_reward: { name: '🔥 جایزه دوبرابر', desc: 'برد بعدی ×۲ سکه', price: 200 },
  shield: { name: '🛡️ سپر محافظ', desc: 'یک بار مرگ رو نجات میده', price: 150 }
};

// ================== GAME CLASS ==================
class MinesweeperGame {
  constructor(size, minesCount, difficulty, userId) {
    this.size = size;
    this.totalCells = size * size;
    this.minesCount = minesCount;
    this.difficulty = difficulty;
    this.userId = userId;
    this.board = Array(this.totalCells).fill(0);
    this.revealed = Array(this.totalCells).fill(false);
    this.flags = Array(this.totalCells).fill(false);
    this.alive = true;
    this.opened = 0;
    this.startTime = Date.now();
    this.moves = 0;
    this.actualClicks = 0;
    this.flaggedCount = 0;
    this.extraLifeUsed = false;
    this.doubleRewardActive = false;
    this.shieldActive = false;
    
    this.placeMines();
    this.calculateNumbers();
  }
  
  placeMines() {
    const indices = Array.from({length: this.totalCells}, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let i = 0; i < this.minesCount; i++) {
      this.board[indices[i]] = '💣';
    }
  }
  
  calculateNumbers() {
    for (let i = 0; i < this.totalCells; i++) {
      if (this.board[i] === '💣') continue;
      let count = 0;
      const x = Math.floor(i / this.size);
      const y = i % this.size;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
            if (this.board[nx * this.size + ny] === '💣') count++;
          }
        }
      }
      this.board[i] = count;
    }
  }
  
  revealEmpty(startIdx) {
    const queue = [startIdx];
    const visited = new Set();
    while (queue.length > 0) {
      const idx = queue.shift();
      if (visited.has(idx)) continue;
      if (this.revealed[idx] || this.flags[idx]) continue;
      visited.add(idx);
      this.revealed[idx] = true;
      this.opened++;
      if (this.board[idx] !== 0) continue;
      const x = Math.floor(idx / this.size);
      const y = idx % this.size;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
            const neighborIdx = nx * this.size + ny;
            if (!this.revealed[neighborIdx] && !this.flags[neighborIdx] && this.board[neighborIdx] !== '💣') {
              queue.push(neighborIdx);
            }
          }
        }
      }
    }
  }
  
  revealAllMines() {
    for (let i = 0; i < this.totalCells; i++) {
      if (this.board[i] === '💣') this.revealed[i] = true;
    }
  }
  
  disableMine(idx) {
    if (this.board[idx] === '💣') {
      this.board[idx] = 0;
      this.minesCount--;
      this.calculateNumbers();
      return true;
    }
    return false;
  }
  
  useMineDetector() {
    for (let i = 0; i < this.totalCells; i++) {
      if (this.board[i] === '💣' && !this.revealed[i] && !this.flags[i]) {
        return i;
      }
    }
    return -1;
  }
  
  useSmartHint() {
    for (let i = 0; i < this.totalCells; i++) {
      if (!this.revealed[i] && !this.flags[i] && this.board[i] !== '💣') {
        return i;
      }
    }
    return -1;
  }
  
  freezeTime() {
    this.startTime += 30000;
  }
  
  checkWin() {
    return this.opened === this.totalCells - this.minesCount;
  }
  
  getStats() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')} | 🎯 ${this.moves} حرکت | 🚩 ${this.flaggedCount}/${this.minesCount}`;
  }
  
  getTimeInSeconds() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

// ================== RENDER GAME ==================
function renderGame(game, gameOver = false) {
  const user = getUser(game.userId);
  const theme = THEMES[user.theme] || THEMES.default;
  
  const rows = [];
  for (let i = 0; i < game.size; i++) {
    const row = [];
    for (let j = 0; j < game.size; j++) {
      const idx = i * game.size + j;
      let display = theme.bg;
      
      if (game.revealed[idx]) {
        if (game.board[idx] === '💣') display = theme.mine;
        else if (game.board[idx] === 0) display = '▪️';
        else {
          display = theme.num[game.board[idx]] || '❓';
        }
      } else if (game.flags[idx]) {
        display = theme.flag;
      }
      
      row.push(Markup.button.callback(display, `cell_${idx}`));
    }
    rows.push(row);
  }
  
  const controlRow = [];
  if (!gameOver && game.alive) {
    controlRow.push(Markup.button.callback('🔍 Auto', 'auto_reveal'));
    controlRow.push(Markup.button.callback('🚩', 'toggle_flag'));
    controlRow.push(Markup.button.callback('🧰 آیتم‌ها', 'use_items_menu'));
  }
  controlRow.push(Markup.button.callback('🔄 New', 'new_game'));
  controlRow.push(Markup.button.callback('🏠 Menu', 'main_menu'));
  rows.push(controlRow);
  
  return { reply_markup: { inline_keyboard: rows } };
}

// ================== GAME LOGIC ==================
async function handleCellClick(ctx, game, idx) {
  const userId = ctx.from.id;
  
  if (!game.alive) {
    await ctx.answerCbQuery('❌ بازی تموم شده!');
    return false;
  }
  if (game.revealed[idx]) {
    await ctx.answerCbQuery('🔓 قبلا باز شده');
    return false;
  }
  if (game.flags[idx]) {
    await ctx.answerCbQuery('🚩 پرچم داره');
    return false;
  }
  
  let user = getUser(userId);
  
  if (game.board[idx] === '💣' && user.inventory?.bomb_disabler > 0) {
    user.inventory.bomb_disabler--;
    updateUser(user);
    game.disableMine(idx);
    await ctx.answerCbQuery('💣 مین با مین‌شکن خنثی شد!');
    await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n💣 مین خنثی شد!\n${game.getStats()}`, renderGame(game, false));
    return true;
  }
  
  game.actualClicks++;
  game.moves++;
  
  if (game.board[idx] === '💣') {
    if (user.inventory?.shield > 0 && !game.shieldActive) {
      game.shieldActive = true;
      user.inventory.shield--;
      updateUser(user);
      await ctx.answerCbQuery('🛡️ سپر محافظ فعال شد! این مین رو دفع کردی!', true);
      await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n🛡️ سپر محافظ یک مین رو دفع کرد!\n${game.getStats()}`, renderGame(game, false));
      return true;
    }
    
    if (user.inventory?.extra_life > 0 && !game.extraLifeUsed) {
      game.extraLifeUsed = true;
      user.inventory.extra_life--;
      updateUser(user);
      await ctx.answerCbQuery('❤️ جان اضافه استفاده شد!');
      await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n❤️ جان اضافه فعال شد!\n${game.getStats()}`, renderGame(game, false));
      return true;
    }
    
    game.alive = false;
    game.revealAllMines();
    user.losses++;
    user.gamesPlayed++;
    updateStreak(userId, false);
    updateUser(user);
    await ctx.editMessageText(`💥 باختی! 💀\n\n${game.getStats()}\n🔥 استریک فعلی: 0`, renderGame(game, true));
    return false;
  }
  
  game.revealEmpty(idx);
  
  if (game.checkWin()) {
    game.alive = false;
    const gameTime = game.getTimeInSeconds();
    const safeCells = game.totalCells - game.minesCount;
    let coinReward = DIFFICULTY[game.difficulty].coin;

    // Double Reward
    if (user.inventory?.double_reward > 0 && !game.doubleRewardActive) {
      game.doubleRewardActive = true;
      user.inventory.double_reward--;
      coinReward *= 2;
    }

    // === استریک ===
    const newStreak = updateStreak(userId, true);

    // === XP ===
    const xpGain = 10 + (game.difficulty === 'expert' ? 30 : 0) + Math.floor(newStreak * 1.5);
    const levelUpMsg = addXP(userId, xpGain);

    // === آپدیت آمار ===
    user.coins += coinReward;
    user.wins++;
    user.gamesPlayed++;
    user.weeklyWins++;
    
    const scoreGain = 10 + (game.difficulty === 'expert' ? 30 : 0);
    user.totalScore = (user.totalScore || 0) + scoreGain;
    user.weeklyScore = (user.weeklyScore || 0) + scoreGain;
    
    if (game.difficulty === 'expert') user.expertWins++;
    if (!user.bestTime || gameTime < user.bestTime) user.bestTime = gameTime;

    updateUser(user);

    // === دستاوردها ===
    let achievementMsg = '';
    const checks = ['FIRST_WIN', 'EXPERT', 'SPEEDRUN', 'PERFECT', 'LUCKY', 'STREAK_5', 'STREAK_10'];
    for (const ach of checks) {
      const result = checkAchievement(userId, ach, { 
        difficulty: game.difficulty, 
        time: gameTime, 
        moves: game.actualClicks, 
        safeCells 
      });
      if (result) achievementMsg += `\n🏆 ${result.name} +${result.coin} سکه!`;
    }

    const finalUser = getUser(userId);

    await ctx.editMessageText(
      `🎉 **بردی!** 🎉\n\n` +
      `⏱️ زمان: ${gameTime} ثانیه\n` +
      `🎯 حرکت: ${game.actualClicks}\n` +
      `💰 +${coinReward} سکه\n` +
      `🔥 استریک: ${finalUser.currentStreak}\n` +
      `✨ +${xpGain} XP${levelUpMsg}${achievementMsg}\n\n` +
      `📊 سکه: ${finalUser.coins} | سطح: ${finalUser.level}`,
      renderGame(game, true)
    );
    return true;
  }
  
  await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n${game.getStats()}`, renderGame(game, false));
  await ctx.answerCbQuery('✅ باز شد');
  return true;
}

async function handleFlag(ctx, game, idx) {
  if (!game || !game.alive) {
    await ctx.answerCbQuery('❌ بازی فعال نیست');
    return false;
  }
  if (game.revealed[idx]) {
    await ctx.answerCbQuery('❌ باز شده رو پرچم نمیشه زد');
    return false;
  }
  game.flags[idx] = !game.flags[idx];
  game.flaggedCount += game.flags[idx] ? 1 : -1;
  await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n${game.getStats()}`, renderGame(game, false));
  await ctx.answerCbQuery(game.flags[idx] ? '🚩 پرچم زده شد' : '🔓 پرچم برداشته شد');
  return true;
}

// ================== ITEMS ACTIONS ==================
bot.action('use_items_menu', async (ctx) => {
  const user = getUser(ctx.from.id);
  const game = games.get(ctx.chat.id);
  
  if (!game || !game.alive) {
    await ctx.answerCbQuery('❌ بازی فعال نیست');
    return;
  }
  
  let msg = '🧰 **آیتم‌های موجود:**\n\n';
  const keyboardButtons = [];
  
  if (user.inventory?.mine_detector > 0) {
    msg += `🔦 مین‌یاب (${user.inventory.mine_detector} عدد)\n   یک مین رو نشون میده\n\n`;
    keyboardButtons.push([{ text: `🔦 استفاده از مین‌یاب`, callback_data: 'use_mine_detector', style: 'primary' }]);
  }
  
  if (user.inventory?.smart_hint > 0) {
    msg += `🧠 حسگر هوشمند (${user.inventory.smart_hint} عدد)\n   بهترین خونه امن رو پیشنهاد میده\n\n`;
    keyboardButtons.push([{ text: `🧠 استفاده از حسگر`, callback_data: 'use_smart_hint', style: 'primary' }]);
  }
  
  if (user.inventory?.time_freeze > 0) {
    msg += `⏰ فریز زمان (${user.inventory.time_freeze} عدد)\n   +۳۰ ثانیه به زمان\n\n`;
    keyboardButtons.push([{ text: `⏰ فریز زمان`, callback_data: 'use_time_freeze', style: 'primary' }]);
  }
  
  if (user.inventory?.double_reward > 0 && !game.doubleRewardActive) {
    msg += `🔥 جایزه دوبرابر (${user.inventory.double_reward} عدد)\n   برد بعدی ×۲ سکه\n\n`;
    keyboardButtons.push([{ text: `🔥 فعال‌سازی جایزه ×۲`, callback_data: 'use_double_reward', style: 'danger' }]);
  }
  
  if (user.inventory?.shield > 0 && !game.shieldActive) {
    msg += `🛡️ سپر محافظ (${user.inventory.shield} عدد)\n   یک بار مرگ رو نجات میده\n\n`;
    keyboardButtons.push([{ text: `🛡️ فعال‌سازی سپر`, callback_data: 'use_shield', style: 'primary' }]);
  }
  
  if (keyboardButtons.length === 0) {
    msg = '❌ هیچ آیتمی برای استفاده نداری!\nاز فروشگاه بخر.';
  }
  
  keyboardButtons.push([{ text: '🔙 برگشت به بازی', callback_data: 'back_to_game', style: 'primary' }]);
  
  await ctx.editMessageText(msg, { reply_markup: { inline_keyboard: keyboardButtons } });
});

bot.action('use_mine_detector', async (ctx) => {
  const user = getUser(ctx.from.id);
  const game = games.get(ctx.chat.id);
  
  if (!game || !game.alive) {
    await ctx.answerCbQuery('❌ بازی فعال نیست');
    return;
  }
  
  if (user.inventory?.mine_detector <= 0) {
    await ctx.answerCbQuery('❌ مین‌یاب نداری!', true);
    return;
  }
  
  const mineIdx = game.useMineDetector();
  if (mineIdx === -1) {
    await ctx.answerCbQuery('🔍 هیچ مین پنهانی پیدا نشد!', true);
    return;
  }
  
  user.inventory.mine_detector--;
  updateUser(user);
  
  const x = Math.floor(mineIdx / game.size);
  const y = mineIdx % game.size;
  
  await ctx.answerCbQuery(`🔦 مین در ردیف ${x+1}، ستون ${y+1} پیدا شد!`, true);
  await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n🔦 مین‌یاب: یک مین پیدا شد!\n${game.getStats()}`, renderGame(game, false));
});

bot.action('use_smart_hint', async (ctx) => {
  const user = getUser(ctx.from.id);
  const game = games.get(ctx.chat.id);
  
  if (!game || !game.alive) {
    await ctx.answerCbQuery('❌ بازی فعال نیست');
    return;
  }
  
  if (user.inventory?.smart_hint <= 0) {
    await ctx.answerCbQuery('❌ حسگر هوشمند نداری!', true);
    return;
  }
  
  const hintIdx = game.useSmartHint();
  if (hintIdx === -1) {
    await ctx.answerCbQuery('🧠 هیچ خونه امنی پیدا نشد!', true);
    return;
  }
  
  user.inventory.smart_hint--;
  updateUser(user);
  
  const x = Math.floor(hintIdx / game.size);
  const y = hintIdx % game.size;
  
  await ctx.answerCbQuery(`🧠 پیشنهاد: ردیف ${x+1}، ستون ${y+1} امن به نظر میرسه!`, true);
  await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n🧠 حسگر هوشمند: یه خونه امن پیدا شد!\n${game.getStats()}`, renderGame(game, false));
});

bot.action('use_time_freeze', async (ctx) => {
  const user = getUser(ctx.from.id);
  const game = games.get(ctx.chat.id);
  
  if (!game || !game.alive) {
    await ctx.answerCbQuery('❌ بازی فعال نیست');
    return;
  }
  
  if (user.inventory?.time_freeze <= 0) {
    await ctx.answerCbQuery('❌ فریز زمان نداری!', true);
    return;
  }
  
  user.inventory.time_freeze--;
  updateUser(user);
  game.freezeTime();
  
  await ctx.answerCbQuery('⏰ ۳۰ ثانیه به زمان اضافه شد!', true);
  await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n⏰ فریز زمان فعال شد! +۳۰ ثانیه\n${game.getStats()}`, renderGame(game, false));
});

bot.action('use_double_reward', async (ctx) => {
  const user = getUser(ctx.from.id);
  const game = games.get(ctx.chat.id);
  
  if (!game || !game.alive) {
    await ctx.answerCbQuery('❌ بازی فعال نیست');
    return;
  }
  
  if (user.inventory?.double_reward <= 0 || game.doubleRewardActive) {
    await ctx.answerCbQuery('❌ جایزه دوبرابر فعال نیست یا نداری!', true);
    return;
  }
  
  user.inventory.double_reward--;
  game.doubleRewardActive = true;
  updateUser(user);
  
  await ctx.answerCbQuery('🔥 جایزه دوبرابر فعال شد! برد بعدی ×۲ سکه!', true);
  await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n🔥 جایزه دوبرابر فعال شد!\n${game.getStats()}`, renderGame(game, false));
});

bot.action('use_shield', async (ctx) => {
  const user = getUser(ctx.from.id);
  const game = games.get(ctx.chat.id);
  
  if (!game || !game.alive) {
    await ctx.answerCbQuery('❌ بازی فعال نیست');
    return;
  }
  
  if (user.inventory?.shield <= 0 || game.shieldActive) {
    await ctx.answerCbQuery('❌ سپر محافظ فعال نیست یا نداری!', true);
    return;
  }
  
  user.inventory.shield--;
  game.shieldActive = true;
  updateUser(user);
  
  await ctx.answerCbQuery('🛡️ سپر محافظ فعال شد! یک بار مرگ رو نجات میده!', true);
  await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n🛡️ سپر محافظ فعال شد!\n${game.getStats()}`, renderGame(game, false));
});

bot.action('back_to_game', async (ctx) => {
  const game = games.get(ctx.chat.id);
  if (game && game.alive) {
    await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n${game.getStats()}`, renderGame(game, false));
  } else {
    await ctx.answerCbQuery('❌ بازی تموم شده');
  }
});

// ================== BOT ACTIONS ==================
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);
  if (ctx.from.first_name) {
    user.name = ctx.from.first_name;
    updateUser(user);
  }
  
  await ctx.reply(
    `🎯 به Minesweeper PRO v5.5 خوش اومدی!\n\n👤 ${user.name}\n💰 سکه: ${user.coins}\n🏆 برد: ${user.wins} | باخت: ${user.losses}\n🔥 استریک: ${user.currentStreak || 0}\n⭐ سطح ${user.level} | ${LEVELS[user.level-1]?.name || 'قهرمان'}\n🎨 تم: ${THEMES[user.theme].name}\n\n⚡ از دکمه‌های زیر استفاده کن:`,
    getMainMenu()
  );
});

bot.action('main_menu', async (ctx) => {
  const user = getUser(ctx.from.id);
  await ctx.editMessageText(
    `🎯 منوی اصلی\n\n👤 ${user.name}\n💰 سکه: ${user.coins}\n🏆 برد: ${user.wins} | باخت: ${user.losses}\n🔥 استریک: ${user.currentStreak || 0}\n⭐ سطح ${user.level} | ${LEVELS[user.level-1]?.name || 'قهرمان'}\n🎨 تم: ${THEMES[user.theme].name}`,
    getMainMenu()
  );
});

// ================== LEVEL INFO ==================
bot.action('level_info', async (ctx) => {
  const user = getUser(ctx.from.id);
  const levelInfo = getCurrentLevelInfo(user.xp);
  const progressBar = '█'.repeat(Math.floor(levelInfo.progress / 10)) + '░'.repeat(10 - Math.floor(levelInfo.progress / 10));
  
  await ctx.editMessageText(
    `⭐ **سطح ${user.level}** | ${LEVELS[user.level-1]?.name || 'قهرمان'}\n\n` +
    `📊 **پیشرفت به سطح ${levelInfo.nextLevel.level}** (${LEVELS[levelInfo.nextLevel.level-1]?.name || 'حداکثر'})\n` +
    `[${progressBar}] ${levelInfo.progress.toFixed(1)}%\n` +
    `📈 ${user.xp}/${levelInfo.nextLevel.xp_needed} XP\n` +
    `🔥 ${levelInfo.xpNeeded} XP تا سطح بعد\n\n` +
    `🏆 **پاداش سطح بعدی:**\n` +
    `💰 +${levelInfo.nextLevel.coin_bonus || 0} سکه\n\n` +
    `✨ **چگونه XP بگیریم؟**\n` +
    `• برد در هر سطح: +۱۰-۳۰ XP\n` +
    `• استریک: +استریک فعلی × 1.5 XP\n` +
    `• برد حرفه‌ای: +۳۰ XP اضافه`,
    { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } }
  );
});

// ================== SETTINGS MENU ==================
bot.action('settings_menu', async (ctx) => {
  const user = getUser(ctx.from.id);
  
  const purchasedThemes = db.prepare('SELECT theme_key FROM user_themes WHERE user_id = ?').all(user.userId);
  const purchasedKeys = purchasedThemes.map(t => t.theme_key);
  
  let msg = `🎨 تم ها\n\n💰 سکه: ${user.coins}\n🎨 تم فعلی: ${THEMES[user.theme].name}\n\n📦 تم‌های موجود:\n\n`;
  
  const keyboardButtons = [];
  
  for (const [key, theme] of Object.entries(THEMES)) {
    const isOwned = purchasedKeys.includes(key) || key === 'default';
    const isActive = user.theme === key;
    
    msg += `${isActive ? '✅' : '🔘'} ${theme.name} `;
    msg += theme.price > 0 ? `💰 ${theme.price} سکه` : '🎁 رایگان';
    msg += `\n   ${theme.emoji} ${theme.bg} ${theme.mine} ${theme.flag}\n\n`;
  }
  
  for (const [key, theme] of Object.entries(THEMES)) {
    const isOwned = purchasedKeys.includes(key) || key === 'default';
    const isActive = user.theme === key;
    
    if (!isOwned && theme.price > 0) {
      keyboardButtons.push([{ text: `🎨 خرید ${theme.name} (${theme.price}🪙)`, callback_data: `buy_theme_${key}`, style: 'success' }]);
    } else if (!isActive && key !== 'default') {
      keyboardButtons.push([{ text: `🎨 فعال‌سازی ${theme.name}`, callback_data: `activate_theme_${key}`, style: 'primary' }]);
    }
  }
  
  keyboardButtons.push([{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]);
  
  await ctx.editMessageText(msg, { reply_markup: { inline_keyboard: keyboardButtons } });
});

bot.action(/buy_theme_(.+)/, async (ctx) => {
  const themeKey = ctx.match[1];
  const theme = THEMES[themeKey];
  const user = getUser(ctx.from.id);
  
  if (!theme) {
    await ctx.answerCbQuery('❌ تم یافت نشد');
    return;
  }
  
  if (user.coins < theme.price) {
    await ctx.answerCbQuery(`❌ سکه کافی نیست! نیاز به ${theme.price} سکه داری`, true);
    return;
  }
  
  user.coins -= theme.price;
  updateUser(user);
  
  db.prepare('INSERT OR IGNORE INTO user_themes (user_id, theme_key) VALUES (?, ?)').run(user.userId, themeKey);
  
  await ctx.answerCbQuery(`✅ تم ${theme.name} خریداری شد!`, true);
  
  bot.action('settings_menu', ctx);
});

bot.action(/activate_theme_(.+)/, async (ctx) => {
  const themeKey = ctx.match[1];
  const theme = THEMES[themeKey];
  const user = getUser(ctx.from.id);
  
  if (!theme) {
    await ctx.answerCbQuery('❌ تم یافت نشد');
    return;
  }
  
  user.theme = themeKey;
  updateUser(user);
  
  await ctx.answerCbQuery(`✅ تم ${theme.name} فعال شد!`, true);
  
  bot.action('settings_menu', ctx);
});

// ================== LEADERBOARD MENU ==================
bot.action('leaderboard_menu', async (ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏆 بیشترین برد', callback_data: 'lb_wins_all', style: 'primary' }],
        [{ text: '🔥 بهترین استریک', callback_data: 'lb_streak', style: 'primary' }],
        [{ text: '⭐ بیشترین امتیاز', callback_data: 'lb_score_menu', style: 'success' }],
        [{ text: '💰 ثروتمندترین‌ها', callback_data: 'lb_coins', style: 'success' }],
        [{ text: '✨ بالاترین سطح', callback_data: 'lb_level', style: 'success' }],
        [{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]
      ]
    }
  };
  await ctx.editMessageText('🏆 لیدربورد - انتخاب کنید:', keyboard);
});

bot.action('lb_score_menu', async (ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⭐ همیشه', callback_data: 'lb_score_all', style: 'primary' }],
        [{ text: '📅 هفتگی', callback_data: 'lb_score_weekly', style: 'success' }],
        [{ text: '🔙 برگشت', callback_data: 'leaderboard_menu', style: 'primary' }]
      ]
    }
  };
  await ctx.editMessageText('⭐ انتخاب کنید:', keyboard);
});

bot.action('lb_wins_all', async (ctx) => {
  const topUsers = getLeaderboard('all_time', 'wins');
  let msg = '🏆 بیشترین برد (همیشه):\n\n';
  let rank = 1;
  for (const user of topUsers) {
    msg += `${rank}. ${user.name || 'کاربر'} — ${user.wins} برد\n`;
    rank++;
  }
  const user = getUser(ctx.from.id);
  msg += `\n📊 شما: ${user.wins} برد`;
  await ctx.editMessageText(msg, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'leaderboard_menu', style: 'primary' }]] }
  });
});

bot.action('lb_streak', async (ctx) => {
  const topUsers = getLeaderboard('all_time', 'streak');
  let msg = '🔥 بهترین استریک:\n\n';
  let rank = 1;
  for (const user of topUsers) {
    msg += `${rank}. ${user.name || 'کاربر'} — ${user.best_streak} برد متوالی\n`;
    rank++;
  }
  const user = getUser(ctx.from.id);
  msg += `\n📊 شما: ${user.bestStreak || 0} برد متوالی`;
  await ctx.editMessageText(msg, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'leaderboard_menu', style: 'primary' }]] }
  });
});

bot.action('lb_score_all', async (ctx) => {
  const topUsers = getLeaderboard('all_time', 'score_all');
  let msg = '⭐ بیشترین امتیاز (همیشه):\n\n';
  let rank = 1;
  for (const user of topUsers) {
    msg += `${rank}. ${user.name || 'کاربر'} — ${user.total_score} امتیاز\n`;
    rank++;
  }
  const user = getUser(ctx.from.id);
  msg += `\n📊 شما: ${user.totalScore || 0} امتیاز`;
  await ctx.editMessageText(msg, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'leaderboard_menu', style: 'primary' }]] }
  });
});

bot.action('lb_score_weekly', async (ctx) => {
  checkWeeklyReset();
  const topUsers = getLeaderboard('all_time', 'score_weekly');
  let msg = '📅 رتبه‌بندی هفتگی:\n\n';
  let rank = 1;
  for (const user of topUsers) {
    msg += `${rank}. ${user.name || 'کاربر'} — ${user.weekly_score} امتیاز\n`;
    rank++;
  }
  const user = getUser(ctx.from.id);
  msg += `\n📊 شما این هفته: ${user.weeklyScore || 0} امتیاز`;
  await ctx.editMessageText(msg, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'leaderboard_menu', style: 'primary' }]] }
  });
});

bot.action('lb_coins', async (ctx) => {
  const topUsers = getLeaderboard('all_time', 'coins');
  let msg = '💰 ثروتمندترین‌ها:\n\n';
  let rank = 1;
  for (const user of topUsers) {
    msg += `${rank}. ${user.name || 'کاربر'} — ${user.coins} سکه\n`;
    rank++;
  }
  const user = getUser(ctx.from.id);
  msg += `\n📊 شما: ${user.coins} سکه`;
  await ctx.editMessageText(msg, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'leaderboard_menu', style: 'primary' }]] }
  });
});

bot.action('lb_level', async (ctx) => {
  const topUsers = getLeaderboard('all_time', 'level');
  let msg = '✨ بالاترین سطح:\n\n';
  let rank = 1;
  for (const user of topUsers) {
    const levelName = LEVELS[user.level-1]?.name || 'قهرمان';
    msg += `${rank}. ${user.name || 'کاربر'} — سطح ${user.level} (${levelName})\n`;
    rank++;
  }
  const user = getUser(ctx.from.id);
  const userLevelName = LEVELS[user.level-1]?.name || 'قهرمان';
  msg += `\n📊 شما: سطح ${user.level} (${userLevelName})`;
  await ctx.editMessageText(msg, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'leaderboard_menu', style: 'primary' }]] }
  });
});

// ================== OTHER MENUS ==================
bot.action('wallet', async (ctx) => {
  const user = getUser(ctx.from.id);
  await ctx.editMessageText(`💰 کیف پول شما\n\nسکه: ${user.coins} 🪙\n\n🎮 هر برد: +${DIFFICULTY.easy.coin}-${DIFFICULTY.expert.coin} سکه\n🏆 دستاوردها: سکه اضافه میدن\n🔥 استریک فعلی: ${user.currentStreak || 0}\n⭐ سطح: ${user.level}`, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] }
  });
});

bot.action('achievements', async (ctx) => {
  const user = getUser(ctx.from.id);
  let msg = '🏆 دستاوردهای شما:\n\n';
  for (const [key, ach] of Object.entries(ACHIEVEMENTS)) {
    const earned = user.achievements.includes(key);
    msg += `${earned ? '✅' : '🔒'} ${ach.name}\n   ${ach.desc} (+${ach.coin} سکه)\n\n`;
  }
  await ctx.editMessageText(msg, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] }
  });
});

bot.action('my_stats', async (ctx) => {
  const user = getUser(ctx.from.id);
  const winRate = user.gamesPlayed > 0 ? ((user.wins / user.gamesPlayed) * 100).toFixed(1) : 0;
  const levelName = LEVELS[user.level-1]?.name || 'قهرمان';
  const nextLevelXp = LEVELS[user.level]?.xp_needed || user.xp;
  const xpToNext = nextLevelXp - user.xp;
  
  await ctx.editMessageText(
    `📊 **آمار شما**\n\n` +
    `🎮 بازی‌ها: ${user.gamesPlayed}\n` +
    `🏆 برد: ${user.wins}\n` +
    `💀 باخت: ${user.losses}\n` +
    `📈 نرخ برد: ${winRate}%\n` +
    `💰 سکه: ${user.coins}\n` +
    `⚡ بهترین زمان: ${user.bestTime || '-'} ثانیه\n` +
    `🔥 بهترین استریک: ${user.bestStreak || 0}\n` +
    `⭐ سطح: ${user.level} | ${levelName}\n` +
    `✨ XP: ${user.xp} (${xpToNext > 0 ? `${xpToNext} XP تا سطح بعد` : 'حداکثر سطح'})\n` +
    `🏅 دستاوردها: ${user.achievements.length}/${Object.keys(ACHIEVEMENTS).length}\n` +
    `🎨 تم فعلی: ${THEMES[user.theme].name}`,
    { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } }
  );
});

bot.action('help', async (ctx) => {
  await ctx.editMessageText(
    `📖 **راهنمای v5.5**\n\n` +
    `🎯 **هدف:** همه سلول‌های بدون مین رو باز کن\n\n` +
    `🕹️ **کنترل‌ها:**\n` +
    `• کلیک عادی: باز کردن سلول\n` +
    `• حالت 🚩 Flag: پرچم گذاری روی مین\n` +
    `• 🔍 Auto: باز کردن خودکار خانه‌های امن\n` +
    `• 🧰 آیتم‌ها: استفاده از آیتم‌های خریداری شده\n\n` +
    `💰 **سیستم جایزه:**\n` +
    `• برد در هر سطح: سکه میگیری\n` +
    `• دستاوردها: سکه اضافه\n` +
    `• استریک: برد متوالی جایزه داره\n` +
    `• لیدربورد: رقابت با دیگران\n\n` +
    `✨ **سیستم سطح:**\n` +
    `• با برد XP میگیری\n` +
    `• سطح بالاتر = پاداش بیشتر\n` +
    `• استریک به XP اضافه میشه (استریک × 1.5)\n\n` +
    `🎨 **تم‌ها:**\n` +
    `• از بخش تنظیمات میتونی ظاهر بازی رو عوض کنی\n` +
    `• تم‌های جدید با سکه قابل خریدن\n\n` +
    `🧰 **آیتم‌ها:**\n` +
    `• 🔦 مین‌یاب: یک مین رو نشون میده\n` +
    `• 🧠 حسگر هوشمند: بهترین خونه امن رو پیشنهاد میده\n` +
    `• ⏰ فریز زمان: +۳۰ ثانیه به زمان\n` +
    `• 🔥 جایزه دوبرابر: برد بعدی ×۲ سکه\n` +
    `• 🛡️ سپر محافظ: یک بار مرگ رو نجات میده`,
    { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } }
  );
});

bot.action('new_game', (ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🍃 آسان (۱۰ سکه)', callback_data: 'difficulty_easy', style: 'primary' }],
        [{ text: '⚙️ معمولی (۲۵ سکه)', callback_data: 'difficulty_normal', style: 'primary' }],
        [{ text: '🔥 سخت (۵۰ سکه)', callback_data: 'difficulty_hard', style: 'primary' }],
        [{ text: '💀 حرفه‌ای (۱۰۰ سکه)', callback_data: 'difficulty_expert', style: 'danger' }],
        [{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]
      ]
    }
  };
  const chatId = ctx.chat.id;
  games.delete(chatId);
  flagMode.delete(chatId);
  ctx.editMessageText('🎲 سطح سختی رو انتخاب کن:', keyboard);
  ctx.answerCbQuery();
});

Object.keys(DIFFICULTY).forEach(level => {
  bot.action(`difficulty_${level}`, (ctx) => {
    const config = DIFFICULTY[level];
    const game = new MinesweeperGame(config.size, config.mines, level, ctx.from.id);
    games.set(ctx.chat.id, game);
    ctx.editMessageText(`🎮 بازی ${config.name}\n💰 جایزه: ${config.coin} سکه\n${game.getStats()}`, renderGame(game, false));
    ctx.answerCbQuery('🎮 بازی شروع شد!');
  });
});

bot.action(/cell_(\d+)/, async (ctx) => {
  const game = games.get(ctx.chat.id);
  if (!game) { await ctx.answerCbQuery('❌ بازی فعال نیست'); return; }
  if (!game.alive) { await ctx.answerCbQuery('❌ بازی تموم شده! New Game بزن'); return; }
  const isFlag = flagMode.get(ctx.chat.id) || false;
  if (isFlag) await handleFlag(ctx, game, parseInt(ctx.match[1]));
  else await handleCellClick(ctx, game, parseInt(ctx.match[1]));
});

bot.action('toggle_flag', (ctx) => {
  const game = games.get(ctx.chat.id);
  if (!game || !game.alive) { ctx.answerCbQuery('❌ بازی فعال نیست'); return; }
  const current = flagMode.get(ctx.chat.id) || false;
  flagMode.set(ctx.chat.id, !current);
  ctx.answerCbQuery(`${!current ? '🚩' : '🔍'} حالت ${!current ? 'پرچم' : 'کلیک'} فعال شد`);
});

bot.action('auto_reveal', async (ctx) => {
  const game = games.get(ctx.chat.id);
  if (!game || !game.alive) { await ctx.answerCbQuery('❌ بازی فعال نیست'); return; }
  let changed = false;
  for (let i = 0; i < game.totalCells; i++) {
    if (!game.revealed[i] && !game.flags[i] && game.board[i] !== '💣') {
      game.revealEmpty(i);
      changed = true;
    }
  }
  if (changed) {
    if (game.checkWin()) {
      game.alive = false;
      let user = getUser(ctx.from.id);
      let coinReward = DIFFICULTY[game.difficulty].coin;
      
      if (user.inventory?.double_reward > 0 && !game.doubleRewardActive) {
        game.doubleRewardActive = true;
        user.inventory.double_reward--;
        coinReward *= 2;
      }
      
      const newStreak = updateStreak(ctx.from.id, true);
      const xpGain = 10 + (game.difficulty === 'expert' ? 30 : 0) + Math.floor(newStreak * 1.5);
      const levelUpMsg = addXP(ctx.from.id, xpGain);
      
      user.coins += coinReward;
      user.wins++;
      user.gamesPlayed++;
      updateUser(user);
      
      await ctx.editMessageText(`🎉 بردی! 🎉\n💰 +${coinReward} سکه\n✨ +${xpGain} XP${levelUpMsg}\n🔥 استریک جدید: ${newStreak}\n${game.getStats()}`, renderGame(game, true));
    } else {
      await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n${game.getStats()}`, renderGame(game, false));
    }
    await ctx.answerCbQuery('✨ خانه‌های امن باز شدن');
  } else {
    await ctx.answerCbQuery('🔍 هیچ خانۀ امنی نیست');
  }
});

// ================== SHOP MENU ==================
bot.action('shop_menu', async (ctx) => {
  const user = getUser(ctx.from.id);
  let msg = '🛒 فروشگاه آیتم‌ها:\n━━━━━━━━━━━━━━━\n\n';
  
  const shopItems = [
    { key: 'bomb_disabler', emoji: '💣', name: 'مین‌شکن', desc: 'یه مین رو نابود کن', price: 50 },
    { key: 'extra_life', emoji: '❤️', name: 'جان اضافه', desc: 'یه بار میتونی اشتباه کنی', price: 75 },
    { key: 'mine_detector', emoji: '🔦', name: 'مین‌یاب', desc: 'یک مین رو نشون میده', price: 120 },
    { key: 'smart_hint', emoji: '🧠', name: 'حسگر هوشمند', desc: 'بهترین خونه امن رو پیشنهاد میده', price: 90 },
    { key: 'time_freeze', emoji: '⏰', name: 'فریز زمان', desc: '+۳۰ ثانیه به زمان', price: 80 },
    { key: 'double_reward', emoji: '🔥', name: 'جایزه دوبرابر', desc: 'برد بعدی ×۲ سکه', price: 200 },
    { key: 'shield', emoji: '🛡️', name: 'سپر محافظ', desc: 'یک بار مرگ رو نجات میده', price: 150 }
  ];
  
  for (const item of shopItems) {
    const count = user.inventory?.[item.key] || 0;
    msg += `${item.emoji} **${item.name}**\n`;
    msg += `   📝 ${item.desc}\n`;
    msg += `   💰 ${item.price} سکه\n`;
    if (count > 0) msg += `   📦 موجودی: ${count}\n`;
    msg += `\n`;
  }
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💣 خرید مین‌شکن (۵۰)', callback_data: 'buy_bomb_disabler', style: 'success' }],
        [{ text: '❤️ خرید جان اضافه (۷۵)', callback_data: 'buy_extra_life', style: 'success' }],
        [{ text: '🔦 خرید مین‌یاب (۱۲۰)', callback_data: 'buy_mine_detector', style: 'primary' }],
        [{ text: '🧠 خرید حسگر هوشمند (۹۰)', callback_data: 'buy_smart_hint', style: 'primary' }],
        [{ text: '⏰ خرید فریز زمان (۸۰)', callback_data: 'buy_time_freeze', style: 'primary' }],
        [{ text: '🔥 خرید جایزه دوبرابر (۲۰۰)', callback_data: 'buy_double_reward', style: 'danger' }],
        [{ text: '🛡️ خرید سپر محافظ (۱۵۰)', callback_data: 'buy_shield', style: 'primary' }],
        [{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]
      ]
    }
  };
  
  await ctx.editMessageText(msg, keyboard);
});

// خرید آیتم‌ها
bot.action('buy_bomb_disabler', async (ctx) => {
  const user = getUser(ctx.from.id);
  if (user.coins >= 50) {
    user.coins -= 50;
    if (!user.inventory) user.inventory = {};
    user.inventory.bomb_disabler = (user.inventory.bomb_disabler || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('✅ مین‌شکن خریداری شد!', true);
    await ctx.editMessageText('✅ مین‌شکن به انبارت اضافه شد!', { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست!', true);
  }
});

bot.action('buy_extra_life', async (ctx) => {
  const user = getUser(ctx.from.id);
  if (user.coins >= 75) {
    user.coins -= 75;
    if (!user.inventory) user.inventory = {};
    user.inventory.extra_life = (user.inventory.extra_life || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('❤️ جان اضافه خریداری شد!', true);
    await ctx.editMessageText('✅ جان اضافه به انبارت اضافه شد!', { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست!', true);
  }
});

bot.action('buy_mine_detector', async (ctx) => {
  const user = getUser(ctx.from.id);
  if (user.coins >= 120) {
    user.coins -= 120;
    if (!user.inventory) user.inventory = {};
    user.inventory.mine_detector = (user.inventory.mine_detector || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('✅ مین‌یاب خریداری شد! 🔦', true);
    await ctx.editMessageText('✅ مین‌یاب به انبارت اضافه شد!', { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست!', true);
  }
});

bot.action('buy_smart_hint', async (ctx) => {
  const user = getUser(ctx.from.id);
  if (user.coins >= 90) {
    user.coins -= 90;
    if (!user.inventory) user.inventory = {};
    user.inventory.smart_hint = (user.inventory.smart_hint || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('✅ حسگر هوشمند خریداری شد! 🧠', true);
    await ctx.editMessageText('✅ حسگر هوشمند به انبارت اضافه شد!', { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست!', true);
  }
});

bot.action('buy_time_freeze', async (ctx) => {
  const user = getUser(ctx.from.id);
  if (user.coins >= 80) {
    user.coins -= 80;
    if (!user.inventory) user.inventory = {};
    user.inventory.time_freeze = (user.inventory.time_freeze || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('✅ فریز زمان خریداری شد! ⏰', true);
    await ctx.editMessageText('✅ فریز زمان به انبارت اضافه شد!', { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست!', true);
  }
});

bot.action('buy_double_reward', async (ctx) => {
  const user = getUser(ctx.from.id);
  if (user.coins >= 200) {
    user.coins -= 200;
    if (!user.inventory) user.inventory = {};
    user.inventory.double_reward = (user.inventory.double_reward || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('✅ جایزه دوبرابر خریداری شد! 🔥', true);
    await ctx.editMessageText('✅ جایزه دوبرابر به انبارت اضافه شد! برد بعدیت دوبرابر سکه داره!', { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست!', true);
  }
});

bot.action('buy_shield', async (ctx) => {
  const user = getUser(ctx.from.id);
  if (user.coins >= 150) {
    user.coins -= 150;
    if (!user.inventory) user.inventory = {};
    user.inventory.shield = (user.inventory.shield || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('✅ سپر محافظ خریداری شد! 🛡️', true);
    await ctx.editMessageText('✅ سپر محافظ به انبارت اضافه شد!', { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست!', true);
  }
});

// ================== CLEANUP ==================
setInterval(() => {
  const now = Date.now();
  for (let [chatId, game] of games.entries()) {
    if (now - game.startTime > 3600000) games.delete(chatId);
  }
}, 600000);

setInterval(() => {
  checkWeeklyReset();
}, 3600000);

// ================== ERROR HANDLING ==================
bot.catch((err, ctx) => {
  console.error('❌ Error:', err);
  ctx.reply('⚠️ خطایی رخ داد. لطفاً /start کنید').catch(() => {});
});

// ================== LAUNCH ==================
bot.launch()
  .then(() => console.log('🚀 Minesweeper PRO v5.5 Running!'))
  .catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

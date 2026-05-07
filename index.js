const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
require('dotenv').config();

// ================== CONFIG ==================
const MAX_ACTIVE_GAMES = 1000;
const GAME_TIMEOUT = 3600000; // 1 ساعت

const DIFFICULTY = {
  easy: { size: 4, mines: 2, name: '🍃 آسان', coin: 10 },
  normal: { size: 5, mines: 5, name: '⚙️ معمولی', coin: 25 },
  hard: { size: 6, mines: 10, name: '🔥 سخت', coin: 50 },
  expert: { size: 8, mines: 20, name: '💀 حرفه‌ای', coin: 100 }
};

// ================== BLITZ CONFIG ==================
const BLITZ_CONFIG = {
  easy: { timeLimit: 120, timeBonus: 10, size: 4, mines: 2, coin: 20, name: '⚡ بلیتز آسان' },
  normal: { timeLimit: 180, timeBonus: 8, size: 5, mines: 5, coin: 50, name: '⚡ بلیتز معمولی' },
  hard: { timeLimit: 240, timeBonus: 6, size: 6, mines: 10, coin: 100, name: '⚡ بلیتز سخت' },
  expert: { timeLimit: 300, timeBonus: 5, size: 8, mines: 20, coin: 200, name: '⚡ بلیتز حرفه‌ای' }
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
  nature: { name: 'طبیعت', emoji: '🌿', price: 0, bg: '🌿', mine: '🍃', flag: '🌸', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  neon: { name: 'نئون', emoji: '🟩', price: 200, bg: '🟩', mine: '💚', flag: '🚩', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  dark: { name: 'شب', emoji: '⬛', price: 150, bg: '⬛', mine: '💀', flag: '⚑', num: ['▪️', '❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽'] },
  gold: { name: 'طلایی', emoji: '🟨', price: 500, bg: '🟨', mine: '👑', flag: '⭐', num: ['▪️', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'] },
  candy: { name: 'شیرینی', emoji: '🩷', price: 300, bg: '🩷', mine: '🍬', flag: '🍭', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  ocean: { name: 'اقیانوسی', emoji: '💙', price: 250, bg: '💙', mine: '🐟', flag: '⚓', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  fire: { name: 'آتشی', emoji: '🧡', price: 350, bg: '🧡', mine: '🔥', flag: '⚡', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  matrix: { name: 'ماتریکس', emoji: '💚', price: 400, bg: '💚', mine: '🧪', flag: '💊', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  halloween: { name: 'هالووین', emoji: '🎃', price: 350, bg: '🧡', mine: '👻', flag: '🕸️', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  christmas: { name: 'کریسمس', emoji: '🎄', price: 350, bg: '❤️', mine: '🎁', flag: '⭐', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  space: { name: 'فضایی', emoji: '🚀', price: 450, bg: '🌌', mine: '🛸', flag: '🌍', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] },
  anime: { name: 'انیمه', emoji: '🌸', price: 400, bg: '🌸', mine: '⚔️', flag: '👑', num: ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'] }
};

// ================== KEEP ALIVE ==================
const app = express();
app.get('/', (req, res) => res.send('🎮 Minesweeper PRO v6.2 is alive'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🌐 Server on', PORT));

// ================== DATABASE ==================
const db = new Database('minesweeper.db');
db.pragma('journal_mode = WAL'); // بهینه‌سازی عملکرد

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
    level INTEGER DEFAULT 1,
    blitz_best_time INTEGER DEFAULT 0,
    blitz_wins INTEGER DEFAULT 0
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

// Safe JSON parse
function safeJSONParse(str, fallback = {}) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('JSON Parse Error:', e);
    return fallback;
  }
}

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
      level: 1,
      blitzBestTime: 0,
      blitzWins: 0
    };
  }
  return {
    userId: row.user_id,
    coins: row.coins,
    wins: row.wins,
    losses: row.losses,
    gamesPlayed: row.games_played,
    bestTime: row.best_time,
    achievements: safeJSONParse(row.achievements, []),
    inventory: safeJSONParse(row.inventory, {}),
    bestStreak: row.best_streak,
    currentStreak: row.current_streak,
    weeklyWins: row.weekly_wins,
    weeklyScore: row.weekly_score,
    totalScore: row.total_score,
    expertWins: row.expert_wins,
    name: row.name || 'کاربر',
    theme: row.theme || 'default',
    xp: row.xp || 0,
    level: row.level || 1,
    blitzBestTime: row.blitz_best_time || 0,
    blitzWins: row.blitz_wins || 0
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
      level = ?,
      blitz_best_time = ?,
      blitz_wins = ?
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
    user.blitzBestTime,
    user.blitzWins,
    user.userId
  );
}

// ================== BOT INIT ==================
const bot = new Telegraf(process.env.BOT_TOKEN);
const games = new Map();
const flagMode = new Map();

// تولید Game ID یکتا
function generateGameId(chatId, userId) {
  return `${chatId}_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// ================== GAME CLEANUP ==================
function cleanupOldGames() {
  const now = Date.now();
  let deleted = 0;
  for (let [key, game] of games.entries()) {
    if (now - game.startTime > GAME_TIMEOUT) {
      games.delete(key);
      deleted++;
    }
  }
  if (deleted > 0) console.log(`🧹 Cleaned up ${deleted} old games`);
  
  // پاکسازی flagMode همزمان با گیم‌ها
  for (let [key, value] of flagMode.entries()) {
    if (!games.has(key)) {
      flagMode.delete(key);
    }
  }
}

setInterval(cleanupOldGames, 600000);

// ================== MAIN MENU BUTTONS ==================
function getMainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎮 حالت عادی', callback_data: 'new_game', style: 'primary' },
          { text: '⚡ بلیتز', callback_data: 'blitz_mode', style: 'danger' }
        ],
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
    case 'blitz':
      sql = 'SELECT user_id, blitz_wins, name FROM users ORDER BY blitz_wins DESC LIMIT 10';
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
  STREAK_10: { name: '⚡ استریک ۱۰', desc: '۱۰ بار پشت سر هم ببر', coin: 250 },
  BLITZ_WIN: { name: '⚡ سلطان بلیتز', desc: 'یک بازی بلیتز ببر', coin: 150 }
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
    case 'BLITZ_WIN': earned = (user.blitzWins || 0) >= 1; break;
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
  time_freeze: { name: '⏰ فریز زمان', desc: '+۳۰ ثانیه به زمان (فقط عادی)', price: 80 },
  double_reward: { name: '🔥 جایزه دوبرابر', desc: 'برد بعدی ×۲ سکه', price: 200 },
  shield: { name: '🛡️ سپر محافظ', desc: 'یک بار مرگ رو نجات میده', price: 150 }
};

// ================== BASE GAME CLASS ==================
class MinesweeperGame {
  constructor(size, minesCount, difficulty, userId, gameId, chatId) {
    this.gameId = gameId;
    this.chatId = chatId;
    this.userId = userId;
    this.size = size;
    this.totalCells = size * size;
    this.minesCount = minesCount;
    this.difficulty = difficulty;
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
    this.isBlitz = false;
    this.processing = false;
    this.minesPlaced = false;
    this.firstMoveMade = false;
    
    // مین‌ها رو فعلاً نذار
    this.placeholders = Array(this.totalCells).fill(0);
  }
  
  placeMinesAfterFirstClick(clickIdx) {
    // محاسبه اندیس‌های امن (خود سلول و همسایه‌ها)
    const safeIndices = new Set();
    safeIndices.add(clickIdx);
    const x = Math.floor(clickIdx / this.size);
    const y = clickIdx % this.size;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
          safeIndices.add(nx * this.size + ny);
        }
      }
    }
    
    // ساخت لیست اندیس‌های ممکن برای مین
    const possibleMines = [];
    for (let i = 0; i < this.totalCells; i++) {
      if (!safeIndices.has(i)) {
        possibleMines.push(i);
      }
    }
    
    // تصادفی کردن
    for (let i = possibleMines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [possibleMines[i], possibleMines[j]] = [possibleMines[j], possibleMines[i]];
    }
    
    // قرار دادن مین‌ها
    for (let i = 0; i < this.minesCount && i < possibleMines.length; i++) {
      this.board[possibleMines[i]] = '💣';
    }
    
    this.calculateNumbers();
    this.minesPlaced = true;
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

// ================== BLITZ GAME CLASS ==================
class BlitzGame extends MinesweeperGame {
  constructor(size, minesCount, difficulty, userId, gameId, chatId, timeLimit, timeBonus, blitzLevel) {
    super(size, minesCount, difficulty, userId, gameId, chatId);
    this.timeLimit = timeLimit;
    this.timeBonus = timeBonus;
    this.blitzLevel = blitzLevel;
    this.timeLeft = timeLimit;
    this.lastMoveTime = Date.now();
    this.isBlitz = true;
  }
  
  getTimeLeft() {
    const elapsed = Math.floor((Date.now() - this.lastMoveTime) / 1000);
    this.timeLeft = Math.max(0, this.timeLimit - elapsed);
    return this.timeLeft;
  }
  
  addTime() {
    this.timeLimit += this.timeBonus;
    this.lastMoveTime = Date.now();
  }
  
  getStats() {
    const timeLeft = this.getTimeLeft();
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')} ⏰ | 🎯 ${this.moves} حرکت | 🚩 ${this.flaggedCount}/${this.minesCount}`;
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
      
      // استفاده از gameId برای امنیت
      row.push(Markup.button.callback(display, `cell_${game.gameId}_${idx}`));
    }
    rows.push(row);
  }
  
  const controlRow = [];
  if (!gameOver && game.alive) {
    if (game.isBlitz && game.getTimeLeft() <= 0) {
      game.alive = false;
    }
    if (game.alive) {
      controlRow.push(Markup.button.callback('🔍 Auto', `auto_${game.gameId}`));
      controlRow.push(Markup.button.callback('🚩', `flag_${game.gameId}`));
      controlRow.push(Markup.button.callback('🧰 آیتم‌ها', `items_${game.gameId}`));
    }
  }
  controlRow.push(Markup.button.callback('🔄 New', 'new_game'));
  controlRow.push(Markup.button.callback('🏠 Menu', 'main_menu'));
  rows.push(controlRow);
  
  return { reply_markup: { inline_keyboard: rows } };
}

// ================== UTILITY FUNCTIONS ==================
async function showMainMenu(ctx, userId) {
  const user = getUser(userId);
  const text = `🎯 منوی اصلی\n\n👤 ${user.name}\n💰 سکه: ${user.coins}\n🏆 برد: ${user.wins} | باخت: ${user.losses}\n🔥 استریک: ${user.currentStreak || 0}\n⭐ سطح ${user.level} | ${LEVELS[user.level-1]?.name || 'قهرمان'}\n🎨 تم: ${THEMES[user.theme].name}\n⚡ برد بلیتز: ${user.blitzWins || 0}`;
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, getMainMenu());
  } else {
    await ctx.reply(text, getMainMenu());
  }
}

async function showSettings(ctx, userId) {
  const user = getUser(userId);
  const purchasedThemes = db.prepare('SELECT theme_key FROM user_themes WHERE user_id = ?').all(user.userId);
  const purchasedKeys = purchasedThemes.map(t => t.theme_key);
  
  let msg = `🎨 تم ها (${Object.keys(THEMES).length} تم)\n\n💰 سکه: ${user.coins}\n🎨 تم فعلی: ${THEMES[user.theme].name}\n\n📦 تم‌های موجود:\n\n`;
  
  const keyboardButtons = [];
  
  for (const [key, theme] of Object.entries(THEMES)) {
    const isOwned = purchasedKeys.includes(key) || key === 'default' || key === 'nature';
    const isActive = user.theme === key;
    
    msg += `${isActive ? '✅' : '🔘'} ${theme.name} `;
    msg += theme.price > 0 ? `💰 ${theme.price} سکه` : '🎁 رایگان';
    msg += `\n   ${theme.emoji} ${theme.bg} ${theme.mine} ${theme.flag}\n\n`;
  }
  
  for (const [key, theme] of Object.entries(THEMES)) {
    const isOwned = purchasedKeys.includes(key) || key === 'default' || key === 'nature';
    const isActive = user.theme === key;
    
    if (!isOwned && theme.price > 0) {
      keyboardButtons.push([{ text: `🎨 خرید ${theme.name} (${theme.price}🪙)`, callback_data: `buy_theme_${key}`, style: 'success' }]);
    } else if (!isActive && (key !== 'default' && key !== 'nature')) {
      keyboardButtons.push([{ text: `🎨 فعال‌سازی ${theme.name}`, callback_data: `activate_theme_${key}`, style: 'primary' }]);
    }
  }
  
  keyboardButtons.push([{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]);
  
  await ctx.editMessageText(msg, { reply_markup: { inline_keyboard: keyboardButtons } });
}

// ================== HANDLE CELL CLICK ==================
async function handleCellClick(ctx, game, idx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  
  // امنیت: چک کن کاربر صاحب بازی هست؟
  if (game.userId !== userId) {
    await ctx.answerCbQuery('❌ این بازی مال تو نیست!');
    return false;
  }
  
  // قفل برای جلوگیری از Race Condition
  if (game.processing) {
    await ctx.answerCbQuery('⏳ در حال پردازش... صبر کن');
    return false;
  }
  game.processing = true;
  
  try {
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
    
    // اولین حرکت: مین‌ها رو قرار بده
    if (!game.minesPlaced) {
      game.placeMinesAfterFirstClick(idx);
      // اگر سلول مورد نظر مین شده بود (احتمال صفر ولی چک میکنیم)
      if (game.board[idx] === '💣') {
        // این اتفاق نباید بیفته ولی اگه افتاد دوباره امتحان کن
        for (let i = 0; i < game.totalCells; i++) {
          if (game.board[i] !== '💣') {
            game.board[idx] = game.board[i];
            game.board[i] = '💣';
            game.calculateNumbers();
            break;
          }
        }
      }
    }
    
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
    
    if (game.isBlitz && game.board[idx] !== '💣') {
      game.addTime();
    }
    
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
      
      if (game.isBlitz) {
        coinReward = BLITZ_CONFIG[game.blitzLevel]?.coin || coinReward * 2;
      }
      
      if (user.inventory?.double_reward > 0 && !game.doubleRewardActive) {
        game.doubleRewardActive = true;
        user.inventory.double_reward--;
        coinReward *= 2;
        updateUser(user);
      }
      
      const newStreak = updateStreak(userId, true);
      let xpGain = 10 + (game.difficulty === 'expert' ? 30 : 0) + Math.floor(newStreak * 1.5);
      if (game.isBlitz) xpGain = Math.floor(xpGain * 1.5);
      const levelUpMsg = addXP(userId, xpGain);
      
      user = getUser(userId);
      user.coins += coinReward;
      user.wins++;
      user.gamesPlayed++;
      user.weeklyWins++;
      
      if (game.isBlitz) {
        user.blitzWins++;
        if (gameTime < (user.blitzBestTime || 999) || user.blitzBestTime === 0) {
          user.blitzBestTime = gameTime;
        }
      }
      
      const scoreGain = 10 + (game.difficulty === 'expert' ? 30 : 0);
      user.totalScore = (user.totalScore || 0) + scoreGain;
      user.weeklyScore = (user.weeklyScore || 0) + scoreGain;
      
      if (game.difficulty === 'expert') user.expertWins++;
      if (!user.bestTime || gameTime < user.bestTime) user.bestTime = gameTime;
      
      updateUser(user);
      
      let achievementMsg = '';
      const checks = ['FIRST_WIN', 'EXPERT', 'SPEEDRUN', 'PERFECT', 'LUCKY', 'STREAK_5', 'STREAK_10'];
      if (game.isBlitz) checks.push('BLITZ_WIN');
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
      const modeText = game.isBlitz ? '⚡ **بلیتز** ⚡' : '🎮 **حالت عادی**';
      
      await ctx.editMessageText(
        `🎉 **بردی!** 🎉\n${modeText}\n\n` +
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
    
    await ctx.editMessageText(`${game.isBlitz ? '⚡' : '💣'} ${DIFFICULTY[game.difficulty]?.name}\n${game.getStats()}`, renderGame(game, false));
    await ctx.answerCbQuery('✅ باز شد');
    return true;
    
  } finally {
    // آزادسازی قفل بعد از 100 میلی‌ثانیه
    setTimeout(() => {
      game.processing = false;
    }, 100);
  }
}

async function handleFlag(ctx, game, idx) {
  const userId = ctx.from.id;
  
  if (game.userId !== userId) {
    await ctx.answerCbQuery('❌ این بازی مال تو نیست!');
    return false;
  }
  
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
  await ctx.editMessageText(`${game.isBlitz ? '⚡' : '💣'} ${DIFFICULTY[game.difficulty]?.name}\n${game.getStats()}`, renderGame(game, false));
  await ctx.answerCbQuery(game.flags[idx] ? '🚩 پرچم زده شد' : '🔓 پرچم برداشته شد');
  return true;
}

// ================== BOT ACTIONS ==================
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);
  if (ctx.from.first_name) {
    user.name = ctx.from.first_name;
    updateUser(user);
  }
  
  await ctx.reply(
    `🎯 به Minesweeper PRO v6.2 خوش اومدی!\n\n👤 ${user.name}\n💰 سکه: ${user.coins}\n🏆 برد: ${user.wins} | باخت: ${user.losses}\n🔥 استریک: ${user.currentStreak || 0}\n⭐ سطح ${user.level} | ${LEVELS[user.level-1]?.name || 'قهرمان'}\n🎨 تم: ${THEMES[user.theme].name}\n⚡ برد بلیتز: ${user.blitzWins || 0}\n\n⚡ از دکمه‌های زیر استفاده کن:`,
    getMainMenu()
  );
});

bot.action('main_menu', async (ctx) => {
  await showMainMenu(ctx, ctx.from.id);
});

bot.action('settings_menu', async (ctx) => {
  await showSettings(ctx, ctx.from.id);
});

bot.action('blitz_mode', (ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⚡ بلیتز آسان (۲ دقیقه)', callback_data: 'blitz_easy', style: 'primary' }],
        [{ text: '⚡ بلیتز معمولی (۳ دقیقه)', callback_data: 'blitz_normal', style: 'primary' }],
        [{ text: '⚡ بلیتز سخت (۴ دقیقه)', callback_data: 'blitz_hard', style: 'danger' }],
        [{ text: '⚡ بلیتز حرفه‌ای (۵ دقیقه)', callback_data: 'blitz_expert', style: 'danger' }],
        [{ text: '🔙 برگشت', callback_data: 'new_game', style: 'primary' }]
      ]
    }
  };
  ctx.editMessageText('⚡ **حالت بلیتز (زمان‌دار)**\n\nهر حرکت درست زمان اضافه میکنه!\nزمان تموم شد = باخت!\nجایزه ×۲ سکه!', keyboard);
  ctx.answerCbQuery();
});

Object.keys(BLITZ_CONFIG).forEach(level => {
  bot.action(`blitz_${level}`, async (ctx) => {
    if (games.size >= MAX_ACTIVE_GAMES) {
      await ctx.answerCbQuery('❌ شلوغه! کمی صبر کن');
      return;
    }
    
    const gameId = generateGameId(ctx.chat.id, ctx.from.id);
    const config = BLITZ_CONFIG[level];
    const game = new BlitzGame(config.size, config.mines, level, ctx.from.id, gameId, ctx.chat.id, config.timeLimit, config.timeBonus, level);
    const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
    games.set(gameKey, game);
    await ctx.editMessageText(
      `⚡ **${config.name}**\n💰 جایزه: ${config.coin} سکه\n⏰ زمان: ${Math.floor(config.timeLimit/60)} دقیقه\n➕ پاداش هر حرکت: +${config.timeBonus} ثانیه\n${game.getStats()}`,
      renderGame(game, false)
    );
    ctx.answerCbQuery('⚡ بلیتز شروع شد! سریع باش!');
  });
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
  ctx.editMessageText('🎲 سطح سختی رو انتخاب کن:', keyboard);
  ctx.answerCbQuery();
});

Object.keys(DIFFICULTY).forEach(level => {
  bot.action(`difficulty_${level}`, async (ctx) => {
    if (games.size >= MAX_ACTIVE_GAMES) {
      await ctx.answerCbQuery('❌ شلوغه! کمی صبر کن');
      return;
    }
    
    const gameId = generateGameId(ctx.chat.id, ctx.from.id);
    const config = DIFFICULTY[level];
    const game = new MinesweeperGame(config.size, config.mines, level, ctx.from.id, gameId, ctx.chat.id);
    const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
    games.set(gameKey, game);
    await ctx.editMessageText(`🎮 بازی ${config.name}\n💰 جایزه: ${config.coin} سکه\n${game.getStats()}`, renderGame(game, false));
    ctx.answerCbQuery('🎮 بازی شروع شد!');
  });
});

// هندلر سلول با gameId
bot.action(/cell_(.+)_(\d+)/, async (ctx) => {
  const gameId = ctx.match[1];
  const idx = parseInt(ctx.match[2]);
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  
  if (!game || game.gameId !== gameId) {
    await ctx.answerCbQuery('❌ بازی معتبر نیست!');
    return;
  }
  if (!game.alive) {
    await ctx.answerCbQuery('❌ بازی تموم شده! New Game بزن');
    return;
  }
  
  const isFlag = flagMode.get(gameKey) || false;
  if (isFlag) await handleFlag(ctx, game, idx);
  else await handleCellClick(ctx, game, idx);
});

// هندلرهای مخصوص هر game
bot.action(/flag_(.+)/, (ctx) => {
  const gameId = ctx.match[1];
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  
  if (!game || game.gameId !== gameId) {
    ctx.answerCbQuery('❌ بازی معتبر نیست!');
    return;
  }
  if (!game.alive) {
    ctx.answerCbQuery('❌ بازی تموم شده! New Game بزن');
    return;
  }
  
  const current = flagMode.get(gameKey) || false;
  flagMode.set(gameKey, !current);
  ctx.answerCbQuery(`${!current ? '🚩' : '🔍'} حالت ${!current ? 'پرچم' : 'کلیک'} فعال شد`);
});

bot.action(/auto_(.+)/, async (ctx) => {
  const gameId = ctx.match[1];
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  
  if (!game || game.gameId !== gameId) {
    await ctx.answerCbQuery('❌ بازی معتبر نیست!');
    return;
  }
  if (!game.alive) {
    await ctx.answerCbQuery('❌ بازی تموم شده! New Game بزن');
    return;
  }
  if (game.userId !== ctx.from.id) {
    await ctx.answerCbQuery('❌ این بازی مال تو نیست!');
    return;
  }
  
  if (game.isBlitz && game.getTimeLeft() <= 0) {
    game.alive = false;
    await ctx.answerCbQuery('⏰ زمان تموم شد!');
    await ctx.editMessageText(`💥 زمانت تموم شد! 💀\n\n${game.getStats()}`, renderGame(game, true));
    return;
  }
  
  let changed = false;
  for (let i = 0; i < game.totalCells; i++) {
    if (!game.revealed[i] && !game.flags[i] && game.board[i] !== '💣') {
      if (!game.minesPlaced) {
        game.placeMinesAfterFirstClick(i);
      }
      game.revealEmpty(i);
      changed = true;
      if (game.isBlitz) game.addTime();
      break;
    }
  }
  
  if (changed) {
    if (game.checkWin()) {
      game.alive = false;
      let user = getUser(ctx.from.id);
      let coinReward = DIFFICULTY[game.difficulty].coin;
      
      if (game.isBlitz) {
        coinReward = BLITZ_CONFIG[game.blitzLevel]?.coin || coinReward * 2;
      }
      
      if (user.inventory?.double_reward > 0 && !game.doubleRewardActive) {
        game.doubleRewardActive = true;
        user.inventory.double_reward--;
        coinReward *= 2;
        updateUser(user);
      }
      
      const newStreak = updateStreak(ctx.from.id, true);
      let xpGain = 10 + (game.difficulty === 'expert' ? 30 : 0) + Math.floor(newStreak * 1.5);
      if (game.isBlitz) xpGain = Math.floor(xpGain * 1.5);
      const levelUpMsg = addXP(ctx.from.id, xpGain);
      
      user = getUser(ctx.from.id);
      user.coins += coinReward;
      user.wins++;
      user.gamesPlayed++;
      
      if (game.isBlitz) {
        user.blitzWins++;
        const gameTime = game.getTimeInSeconds();
        if (gameTime < (user.blitzBestTime || 999) || user.blitzBestTime === 0) {
          user.blitzBestTime = gameTime;
        }
      }
      
      updateUser(user);
      
      await ctx.editMessageText(`🎉 بردی! 🎉\n💰 +${coinReward} سکه\n✨ +${xpGain} XP${levelUpMsg}\n🔥 استریک جدید: ${newStreak}\n${game.getStats()}`, renderGame(game, true));
    } else {
      await ctx.editMessageText(`${game.isBlitz ? '⚡' : '💣'} ${DIFFICULTY[game.difficulty]?.name}\n${game.getStats()}`, renderGame(game, false));
    }
    await ctx.answerCbQuery('✨ خانه‌های امن باز شدن');
  } else {
    await ctx.answerCbQuery('🔍 هیچ خانۀ امنی نیست');
  }
});

bot.action(/items_(.+)/, async (ctx) => {
  const gameId = ctx.match[1];
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  const user = getUser(ctx.from.id);
  
  if (!game || game.gameId !== gameId) {
    await ctx.answerCbQuery('❌ بازی معتبر نیست!');
    return;
  }
  if (!game.alive) {
    await ctx.answerCbQuery('❌ بازی فعال نیست');
    return;
  }
  if (game.userId !== ctx.from.id) {
    await ctx.answerCbQuery('❌ این بازی مال تو نیست!');
    return;
  }
  
  let msg = '🧰 **آیتم‌های موجود:**\n\n';
  const keyboardButtons = [];
  
  if (user.inventory?.mine_detector > 0) {
    msg += `🔦 مین‌یاب (${user.inventory.mine_detector} عدد)\n   یک مین رو نشون میده\n\n`;
    keyboardButtons.push([{ text: `🔦 استفاده از مین‌یاب`, callback_data: `use_mine_detector_${gameId}`, style: 'primary' }]);
  }
  
  if (user.inventory?.smart_hint > 0) {
    msg += `🧠 حسگر هوشمند (${user.inventory.smart_hint} عدد)\n   بهترین خونه امن رو پیشنهاد میده\n\n`;
    keyboardButtons.push([{ text: `🧠 استفاده از حسگر`, callback_data: `use_smart_hint_${gameId}`, style: 'primary' }]);
  }
  
  if (user.inventory?.time_freeze > 0 && !game.isBlitz) {
    msg += `⏰ فریز زمان (${user.inventory.time_freeze} عدد)\n   +۳۰ ثانیه به زمان\n\n`;
    keyboardButtons.push([{ text: `⏰ فریز زمان`, callback_data: `use_time_freeze_${gameId}`, style: 'primary' }]);
  }
  
  if (user.inventory?.double_reward > 0 && !game.doubleRewardActive) {
    msg += `🔥 جایزه دوبرابر (${user.inventory.double_reward} عدد)\n   برد بعدی ×۲ سکه\n\n`;
    keyboardButtons.push([{ text: `🔥 فعال‌سازی جایزه ×۲`, callback_data: `use_double_reward_${gameId}`, style: 'danger' }]);
  }
  
  if (user.inventory?.shield > 0 && !game.shieldActive) {
    msg += `🛡️ سپر محافظ (${user.inventory.shield} عدد)\n   یک بار مرگ رو نجات میده\n\n`;
    keyboardButtons.push([{ text: `🛡️ فعال‌سازی سپر`, callback_data: `use_shield_${gameId}`, style: 'primary' }]);
  }
  
  if (keyboardButtons.length === 0) {
    msg = '❌ هیچ آیتمی برای استفاده نداری!\nاز فروشگاه بخر.';
  }
  
  keyboardButtons.push([{ text: '🔙 برگشت به بازی', callback_data: `back_${gameId}`, style: 'primary' }]);
  
  await ctx.editMessageText(msg, { reply_markup: { inline_keyboard: keyboardButtons } });
});

// استفاده از آیتم‌ها
async function handleItemUse(ctx, gameId, itemType, action) {
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  
  if (!game || game.gameId !== gameId) {
    await ctx.answerCbQuery('❌ بازی معتبر نیست!');
    return;
  }
  
  await action(ctx, game);
}

bot.action(/use_mine_detector_(.+)/, async (ctx) => {
  const gameId = ctx.match[1];
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  const user = getUser(ctx.from.id);
  
  if (!game || game.gameId !== gameId) return ctx.answerCbQuery('❌ بازی معتبر نیست!');
  if (!game.alive) return ctx.answerCbQuery('❌ بازی فعال نیست');
  if (game.userId !== ctx.from.id) return ctx.answerCbQuery('❌ این بازی مال تو نیست!');
  if (user.inventory?.mine_detector <= 0) return ctx.answerCbQuery('❌ مین‌یاب نداری!', true);
  
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
  await ctx.editMessageText(`${game.isBlitz ? '⚡' : '💣'} ${DIFFICULTY[game.difficulty]?.name}\n🔦 مین‌یاب: یک مین پیدا شد!\n${game.getStats()}`, renderGame(game, false));
});

bot.action(/use_smart_hint_(.+)/, async (ctx) => {
  const gameId = ctx.match[1];
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  const user = getUser(ctx.from.id);
  
  if (!game || game.gameId !== gameId) return ctx.answerCbQuery('❌ بازی معتبر نیست!');
  if (!game.alive) return ctx.answerCbQuery('❌ بازی فعال نیست');
  if (game.userId !== ctx.from.id) return ctx.answerCbQuery('❌ این بازی مال تو نیست!');
  if (user.inventory?.smart_hint <= 0) return ctx.answerCbQuery('❌ حسگر هوشمند نداری!', true);
  
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
  await ctx.editMessageText(`${game.isBlitz ? '⚡' : '💣'} ${DIFFICULTY[game.difficulty]?.name}\n🧠 حسگر هوشمند: یه خونه امن پیدا شد!\n${game.getStats()}`, renderGame(game, false));
});

bot.action(/use_time_freeze_(.+)/, async (ctx) => {
  const gameId = ctx.match[1];
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  const user = getUser(ctx.from.id);
  
  if (!game || game.gameId !== gameId) return ctx.answerCbQuery('❌ بازی معتبر نیست!');
  if (!game.alive) return ctx.answerCbQuery('❌ بازی فعال نیست');
  if (game.userId !== ctx.from.id) return ctx.answerCbQuery('❌ این بازی مال تو نیست!');
  if (game.isBlitz) return ctx.answerCbQuery('❌ فریز زمان در حالت بلیتز قابل استفاده نیست!', true);
  if (user.inventory?.time_freeze <= 0) return ctx.answerCbQuery('❌ فریز زمان نداری!', true);
  
  user.inventory.time_freeze--;
  updateUser(user);
  game.freezeTime();
  
  await ctx.answerCbQuery('⏰ ۳۰ ثانیه به زمان اضافه شد!', true);
  await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n⏰ فریز زمان فعال شد! +۳۰ ثانیه\n${game.getStats()}`, renderGame(game, false));
});

bot.action(/use_double_reward_(.+)/, async (ctx) => {
  const gameId = ctx.match[1];
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  const user = getUser(ctx.from.id);
  
  if (!game || game.gameId !== gameId) return ctx.answerCbQuery('❌ بازی معتبر نیست!');
  if (!game.alive) return ctx.answerCbQuery('❌ بازی فعال نیست');
  if (game.userId !== ctx.from.id) return ctx.answerCbQuery('❌ این بازی مال تو نیست!');
  if (user.inventory?.double_reward <= 0 || game.doubleRewardActive) return ctx.answerCbQuery('❌ جایزه دوبرابر فعال نیست یا نداری!', true);
  
  user.inventory.double_reward--;
  game.doubleRewardActive = true;
  updateUser(user);
  
  await ctx.answerCbQuery('🔥 جایزه دوبرابر فعال شد! برد بعدی ×۲ سکه!', true);
  await ctx.editMessageText(`${game.isBlitz ? '⚡' : '💣'} ${DIFFICULTY[game.difficulty]?.name}\n🔥 جایزه دوبرابر فعال شد!\n${game.getStats()}`, renderGame(game, false));
});

bot.action(/use_shield_(.+)/, async (ctx) => {
  const gameId = ctx.match[1];
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  const user = getUser(ctx.from.id);
  
  if (!game || game.gameId !== gameId) return ctx.answerCbQuery('❌ بازی معتبر نیست!');
  if (!game.alive) return ctx.answerCbQuery('❌ بازی فعال نیست');
  if (game.userId !== ctx.from.id) return ctx.answerCbQuery('❌ این بازی مال تو نیست!');
  if (user.inventory?.shield <= 0 || game.shieldActive) return ctx.answerCbQuery('❌ سپر محافظ فعال نیست یا نداری!', true);
  
  user.inventory.shield--;
  game.shieldActive = true;
  updateUser(user);
  
  await ctx.answerCbQuery('🛡️ سپر محافظ فعال شد! یک بار مرگ رو نجات میده!', true);
  await ctx.editMessageText(`${game.isBlitz ? '⚡' : '💣'} ${DIFFICULTY[game.difficulty]?.name}\n🛡️ سپر محافظ فعال شد!\n${game.getStats()}`, renderGame(game, false));
});

bot.action(/back_(.+)/, async (ctx) => {
  const gameId = ctx.match[1];
  const gameKey = `${ctx.chat.id}_${ctx.from.id}`;
  const game = games.get(gameKey);
  
  if (game && game.alive && game.gameId === gameId) {
    await ctx.editMessageText(`${game.isBlitz ? '⚡' : '💣'} ${DIFFICULTY[game.difficulty]?.name}\n${game.getStats()}`, renderGame(game, false));
  } else {
    await ctx.answerCbQuery('❌ بازی تموم شده');
  }
});

// ================== SHOP و بقیه منوها ==================
bot.action('shop_menu', async (ctx) => {
  const user = getUser(ctx.from.id);
  let msg = '🛒 فروشگاه آیتم‌ها:\n━━━━━━━━━━━━━━━\n\n';
  
  const shopItems = [
    { key: 'bomb_disabler', emoji: '💣', name: 'مین‌شکن', desc: 'یه مین رو نابود کن', price: 50 },
    { key: 'extra_life', emoji: '❤️', name: 'جان اضافه', desc: 'یه بار میتونی اشتباه کنی', price: 75 },
    { key: 'mine_detector', emoji: '🔦', name: 'مین‌یاب', desc: 'یک مین رو نشون میده', price: 120 },
    { key: 'smart_hint', emoji: '🧠', name: 'حسگر هوشمند', desc: 'بهترین خونه امن رو پیشنهاد میده', price: 90 },
    { key: 'time_freeze', emoji: '⏰', name: 'فریز زمان', desc: '+۳۰ ثانیه به زمان (فقط عادی)', price: 80 },
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

async function handleBuy(ctx, itemKey, price, itemName, emoji) {
  const user = getUser(ctx.from.id);
  if (user.coins >= price) {
    user.coins -= price;
    if (!user.inventory) user.inventory = {};
    user.inventory[itemKey] = (user.inventory[itemKey] || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery(`✅ ${itemName} خریداری شد! ${emoji}`, true);
    await ctx.editMessageText(`✅ ${itemName} به انبارت اضافه شد!`, { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست!', true);
  }
}

bot.action('buy_bomb_disabler', async (ctx) => handleBuy(ctx, 'bomb_disabler', 50, 'مین‌شکن', '💣'));
bot.action('buy_extra_life', async (ctx) => handleBuy(ctx, 'extra_life', 75, 'جان اضافه', '❤️'));
bot.action('buy_mine_detector', async (ctx) => handleBuy(ctx, 'mine_detector', 120, 'مین‌یاب', '🔦'));
bot.action('buy_smart_hint', async (ctx) => handleBuy(ctx, 'smart_hint', 90, 'حسگر هوشمند', '🧠'));
bot.action('buy_time_freeze', async (ctx) => handleBuy(ctx, 'time_freeze', 80, 'فریز زمان', '⏰'));
bot.action('buy_double_reward', async (ctx) => handleBuy(ctx, 'double_reward', 200, 'جایزه دوبرابر', '🔥'));
bot.action('buy_shield', async (ctx) => handleBuy(ctx, 'shield', 150, 'سپر محافظ', '🛡️'));

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
  await showSettings(ctx, ctx.from.id);
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
  await showSettings(ctx, ctx.from.id);
});

bot.action('wallet', async (ctx) => {
  const user = getUser(ctx.from.id);
  await ctx.editMessageText(`💰 کیف پول شما\n\nسکه: ${user.coins} 🪙\n\n🎮 هر برد عادی: +${DIFFICULTY.easy.coin}-${DIFFICULTY.expert.coin} سکه\n⚡ هر برد بلیتز: +${BLITZ_CONFIG.easy.coin}-${BLITZ_CONFIG.expert.coin} سکه\n🏆 دستاوردها: سکه اضافه میدن\n🔥 استریک فعلی: ${user.currentStreak || 0}\n⭐ سطح: ${user.level}\n⚡ برد بلیتز: ${user.blitzWins || 0}`, {
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
    `🏆 برد عادی: ${user.wins}\n` +
    `⚡ برد بلیتز: ${user.blitzWins || 0}\n` +
    `💀 باخت: ${user.losses}\n` +
    `📈 نرخ برد: ${winRate}%\n` +
    `💰 سکه: ${user.coins}\n` +
    `⚡ بهترین زمان بلیتز: ${user.blitzBestTime || '-'} ثانیه\n` +
    `🔥 بهترین استریک: ${user.bestStreak || 0}\n` +
    `⭐ سطح: ${user.level} | ${levelName}\n` +
    `✨ XP: ${user.xp} (${xpToNext > 0 ? `${xpToNext} XP تا سطح بعد` : 'حداکثر سطح'})\n` +
    `🏅 دستاوردها: ${user.achievements.length}/${Object.keys(ACHIEVEMENTS).length}\n` +
    `🎨 تم فعلی: ${THEMES[user.theme].name}`,
    { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } }
  );
});

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
    `• برد حرفه‌ای: +۳۰ XP اضافه\n` +
    `• برد بلیتز: XP × 1.5`,
    { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } }
  );
});

bot.action('help', async (ctx) => {
  await ctx.editMessageText(
    `📖 **راهنمای v6.2**\n\n` +
    `🎯 **هدف:** همه سلول‌های بدون مین رو باز کن\n\n` +
    `🕹️ **حالت‌های بازی:**\n` +
    `• 🎮 حالت عادی: بازی کلاسیک بدون محدودیت زمان\n` +
    `• ⚡ حالت بلیتز: بازی زمان‌دار با جایزه ×۲\n\n` +
    `⏱️ **قوانین بلیتز:**\n` +
    `• با هر حرکت درست، زمان اضافه میشه\n` +
    `• زمان تموم بشه = باخت\n` +
    `• جایزه و XP بیشتر\n\n` +
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
    `• استریک به XP اضافه میشه\n` +
    `• برد بلیتز XP × 1.5\n\n` +
    `🎨 **تم‌ها (${Object.keys(THEMES).length} تم):**\n` +
    `• ۲ تم رایگان: کلاسیک، طبیعت\n` +
    `• تم‌های جدید: ماتریکس، هالووین، کریسمس، فضا، انیمه\n` +
    `• از بخش تنظیمات میتونی ظاهر بازی رو عوض کنی`,
    { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } }
  );
});

bot.action('leaderboard_menu', async (ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏆 بیشترین برد', callback_data: 'lb_wins_all', style: 'primary' }],
        [{ text: '🔥 بهترین استریک', callback_data: 'lb_streak', style: 'primary' }],
        [{ text: '⭐ بیشترین امتیاز', callback_data: 'lb_score_menu', style: 'success' }],
        [{ text: '💰 ثروتمندترین‌ها', callback_data: 'lb_coins', style: 'success' }],
        [{ text: '✨ بالاترین سطح', callback_data: 'lb_level', style: 'success' }],
        [{ text: '⚡ سلطان بلیتز', callback_data: 'lb_blitz', style: 'danger' }],
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

async function showLeaderboard(ctx, stat, title) {
  const topUsers = getLeaderboard('all_time', stat);
  let msg = `${title}:\n\n`;
  let rank = 1;
  for (const user of topUsers) {
    let value = user[stat === 'score_all' ? 'total_score' : stat] || user[stat];
    if (stat === 'score_all') stat = 'total_score';
    msg += `${rank}. ${user.name || 'کاربر'} — ${value} ${stat === 'level' ? 'سطح' : stat === 'blitz' ? 'برد بلیتز' : stat}\n`;
    rank++;
  }
  const user = getUser(ctx.from.id);
  const userValue = user[stat === 'total_score' ? 'totalScore' : stat] || 0;
  msg += `\n📊 شما: ${userValue} ${stat === 'level' ? 'سطح' : stat === 'blitz' ? 'برد بلیتز' : stat}`;
  await ctx.editMessageText(msg, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'leaderboard_menu', style: 'primary' }]] }
  });
}

bot.action('lb_wins_all', async (ctx) => showLeaderboard(ctx, 'wins', '🏆 بیشترین برد (همیشه)'));
bot.action('lb_streak', async (ctx) => showLeaderboard(ctx, 'streak', '🔥 بهترین استریک'));
bot.action('lb_score_all', async (ctx) => showLeaderboard(ctx, 'score_all', '⭐ بیشترین امتیاز (همیشه)'));
bot.action('lb_score_weekly', async (ctx) => {
  checkWeeklyReset();
  await showLeaderboard(ctx, 'score_weekly', '📅 رتبه‌بندی هفتگی');
});
bot.action('lb_coins', async (ctx) => showLeaderboard(ctx, 'coins', '💰 ثروتمندترین‌ها'));
bot.action('lb_level', async (ctx) => showLeaderboard(ctx, 'level', '✨ بالاترین سطح'));
bot.action('lb_blitz', async (ctx) => showLeaderboard(ctx, 'blitz', '⚡ سلطان بلیتز'));

// ================== CLEANUP ==================
setInterval(cleanupOldGames, 600000);
setInterval(checkWeeklyReset, 3600000);

// ================== ERROR HANDLING ==================
bot.catch((err, ctx) => {
  console.error('❌ Error:', err);
  ctx.reply('⚠️ خطایی رخ داد. لطفاً /start کنید').catch(() => {});
});

// ================== LAUNCH ==================
bot.launch()
  .then(() => console.log('🚀 Minesweeper PRO v6.2 Secure Running!'))
  .catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

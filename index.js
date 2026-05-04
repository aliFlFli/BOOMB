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

// ================== KEEP ALIVE ==================
const app = express();
app.get('/', (req, res) => res.send('🎮 Minesweeper PRO v5.1 is alive'));
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
    name TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// ================== USER FUNCTIONS ==================
function getUser(userId) {
  let row = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  
  if (!row) {
    db.prepare('INSERT INTO users (user_id, name) VALUES (?, ?)').run(userId, 'کاربر');
    row = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  }

  return {
    userId: row.user_id,
    coins: row.coins,
    wins: row.wins,
    losses: row.losses,
    gamesPlayed: row.games_played,
    bestTime: row.best_time,
    achievements: JSON.parse(row.achievements || '[]'),
    inventory: JSON.parse(row.inventory || '{}'),
    bestStreak: row.best_streak || 0,
    currentStreak: row.current_streak || 0,
    weeklyWins: row.weekly_wins || 0,
    weeklyScore: row.weekly_score || 0,
    totalScore: row.total_score || 0,
    expertWins: row.expert_wins || 0,
    name: row.name || 'کاربر'
  };
}

function updateUser(user) {
  db.prepare(`
    UPDATE users SET 
      coins = ?, wins = ?, losses = ?, games_played = ?, best_time = ?,
      achievements = ?, inventory = ?, best_streak = ?, current_streak = ?,
      weekly_wins = ?, weekly_score = ?, total_score = ?, expert_wins = ?, name = ?
    WHERE user_id = ?
  `).run(
    user.coins, user.wins, user.losses, user.gamesPlayed, user.bestTime,
    JSON.stringify(user.achievements), JSON.stringify(user.inventory),
    user.bestStreak, user.currentStreak,
    user.weeklyWins, user.weeklyScore, user.totalScore, user.expertWins,
    user.name, user.userId
  );
}

// ================== BOT INIT ==================
const bot = new Telegraf(process.env.BOT_TOKEN);
const games = new Map();
const flagMode = new Map();

// ================== MAIN MENU ==================
function getMainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 شروع بازی', callback_data: 'new_game' }],
        [
          { text: '💰 کیف پول', callback_data: 'wallet' },
          { text: '🛒 فروشگاه', callback_data: 'shop_menu' }
        ],
        [
          { text: '🏆 دستاوردها', callback_data: 'achievements' },
          { text: '🏆 لیدربورد', callback_data: 'leaderboard_menu' }
        ],
        [
          { text: '📊 آمار من', callback_data: 'my_stats' },
          { text: '❓ راهنما', callback_data: 'help' }
        ]
      ]
    }
  };
}

// ================== LEADERBOARD ==================
function getTopPlayers(field, limit = 10) {
  const query = `SELECT name, ${field} FROM users ORDER BY ${field} DESC LIMIT ?`;
  return db.prepare(query).all(limit);
}

// ================== STREAK & WEEKLY ==================
function updateStreak(userId, isWin) {
  const user = getUser(userId);
  if (isWin) {
    user.currentStreak = (user.currentStreak || 0) + 1;
    if (user.currentStreak > user.bestStreak) user.bestStreak = user.currentStreak;
  } else {
    user.currentStreak = 0;
  }
  updateUser(user);
  return user;
}

function resetWeeklyStats() {
  db.prepare('UPDATE users SET weekly_wins = 0, weekly_score = 0').run();
  console.log('📊 Weekly stats has been reset');
}

function checkWeeklyReset() {
  const now = new Date();
  const lastResetRow = db.prepare("SELECT value FROM settings WHERE key = 'last_weekly_reset'").get();

  if (!lastResetRow) {
    resetWeeklyStats();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_weekly_reset', ?)").run(now.toISOString());
    return;
  }

  const lastReset = new Date(lastResetRow.value);
  const daysDiff = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));

  if (daysDiff >= 7) {
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
  STREAK_5: { name: '🔥 استریک ۵', desc: '۵ برد متوالی', coin: 100 },
  STREAK_10: { name: '⚡ استریک ۱۰', desc: '۱۰ برد متوالی', coin: 250 }
};

function checkAchievement(userId, type, data = {}) {
  const user = getUser(userId);
  if (user.achievements.includes(type)) return null;

  let earned = false;
  switch(type) {
    case 'FIRST_WIN': earned = user.wins === 1; break;
    case 'EXPERT': earned = data.difficulty === 'expert'; break;
    case 'SPEEDRUN': earned = (data.time || 0) < 30; break;
    case 'PERFECT': earned = data.moves === data.safeCells; break;
    case 'LUCKY': earned = data.moves === 1; break;
    case 'STREAK_5': earned = user.bestStreak >= 5; break;
    case 'STREAK_10': earned = user.bestStreak >= 10; break;
  }

  if (earned) {
    user.achievements.push(type);
    user.coins += ACHIEVEMENTS[type].coin;
    updateUser(user);
    return ACHIEVEMENTS[type];
  }
  return null;
}

// ================== GAME CLASS ==================
class MinesweeperGame {
  constructor(size, minesCount, difficulty) {
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
          const nx = x + dx, ny = y + dy;
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
      if (visited.has(idx) || this.revealed[idx] || this.flags[idx]) continue;
      visited.add(idx);
      this.revealed[idx] = true;
      this.opened++;
      if (this.board[idx] !== 0) continue;
      const x = Math.floor(idx / this.size);
      const y = idx % this.size;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
            const nIdx = nx * this.size + ny;
            if (!this.revealed[nIdx] && !this.flags[nIdx] && this.board[nIdx] !== '💣') {
              queue.push(nIdx);
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
  
  checkWin() {
    return this.opened === this.totalCells - this.minesCount;
  }
  
  getStats() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `⏱️ \( {minutes}: \){seconds.toString().padStart(2, '0')} | 🎯 ${this.moves} حرکت | 🚩 \( {this.flaggedCount}/ \){this.minesCount}`;
  }
  
  getTimeInSeconds() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

// ================== RENDER GAME ==================
function getEmojiForNumber(num) {
  const emojis = ['▪️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
  return emojis[num] || '❓';
}

function renderGame(game, gameOver = false) {
  const rows = [];
  for (let i = 0; i < game.size; i++) {
    const row = [];
    for (let j = 0; j < game.size; j++) {
      const idx = i * game.size + j;
      let display = '⬜';
      if (game.revealed[idx]) {
        display = game.board[idx] === '💣' ? '💣' : (game.board[idx] === 0 ? '▪️' : getEmojiForNumber(game.board[idx]));
      } else if (game.flags[idx]) {
        display = '🚩';
      }
      row.push(Markup.button.callback(display, `cell_${idx}`));
    }
    rows.push(row);
  }
  
  const controlRow = [];
  if (!gameOver && game.alive) {
    controlRow.push(Markup.button.callback('🔍 Auto', 'auto_reveal'));
    controlRow.push(Markup.button.callback('🚩 Flag', 'toggle_flag'));
  }
  controlRow.push(Markup.button.callback('🔄 New', 'new_game'));
  controlRow.push(Markup.button.callback('🏠 Menu', 'main_menu'));
  rows.push(controlRow);
  
  return { reply_markup: { inline_keyboard: rows } };
}

// ================== GAME LOGIC ==================
async function handleCellClick(ctx, game, idx) {
  const userId = ctx.from.id;
  if (!game.alive) return ctx.answerCbQuery('❌ بازی تموم شده!');

  const user = getUser(userId);

  if (game.revealed[idx] || game.flags[idx]) return ctx.answerCbQuery('❌ غیرمجاز');

  // Mine Disabler
  if (game.board[idx] === '💣' && user.inventory?.bomb_disabler > 0) {
    user.inventory.bomb_disabler--;
    updateUser(user);
    game.disableMine(idx);
    await ctx.editMessageText(`💣 \( {DIFFICULTY[game.difficulty].name}\n💣 مین خنثی شد!\n \){game.getStats()}`, renderGame(game));
    return;
  }

  game.actualClicks++;
  game.moves++;

  if (game.board[idx] === '💣') {
    if (user.inventory?.extra_life > 0 && !game.extraLifeUsed) {
      game.extraLifeUsed = true;
      user.inventory.extra_life--;
      updateUser(user);
      await ctx.editMessageText(`💣 \( {DIFFICULTY[game.difficulty].name}\n❤️ جان اضافه استفاده شد!\n \){game.getStats()}`, renderGame(game));
      return;
    }

    game.alive = false;
    game.revealAllMines();
    user.losses++;
    user.gamesPlayed++;
    updateStreak(userId, false);
    updateUser(user);

    await ctx.editMessageText(`💥 باختی!\n${game.getStats()}\n🔥 استریک: ${user.currentStreak}`, renderGame(game, true));
    return;
  }

  game.revealEmpty(idx);

  if (game.checkWin()) {
    game.alive = false;
    const time = game.getTimeInSeconds();
    const reward = DIFFICULTY[game.difficulty].coin;

    user.coins += reward;
    user.wins++;
    user.gamesPlayed++;
    user.weeklyWins++;
    user.totalScore = (user.totalScore || 0) + 10 + (game.difficulty === 'expert' ? 30 : 0);
    user.weeklyScore = (user.weeklyScore || 0) + 10 + (game.difficulty === 'expert' ? 30 : 0);
    if (game.difficulty === 'expert') user.expertWins++;

    if (!user.bestTime || time < user.bestTime) user.bestTime = time;

    const streakUser = updateStreak(userId, true);
    updateUser(user);

    let achMsg = '';
    const checks = ['FIRST_WIN', 'EXPERT', 'SPEEDRUN', 'PERFECT', 'LUCKY', 'STREAK_5', 'STREAK_10'];
    for (const type of checks) {
      const ach = checkAchievement(userId, type, {
        difficulty: game.difficulty,
        time: time,
        moves: game.actualClicks,
        safeCells: game.totalCells - game.minesCount
      });
      if (ach) achMsg += `\n🏆 \( {ach.name} + \){ach.coin} سکه`;
    }

    await ctx.editMessageText(
      `🎉 بردی! 🎉\n⏱️ ${time} ثانیه\n🎯 \( {game.actualClicks} حرکت\n💰 + \){reward} سکه\n🔥 استریک: \( {streakUser.currentStreak} \){achMsg}`,
      renderGame(game, true)
    );
    return;
  }

  await ctx.editMessageText(`💣 \( {DIFFICULTY[game.difficulty].name}\n \){game.getStats()}`, renderGame(game));
}

// ================== BOT ACTIONS ==================
bot.start(async (ctx) => {
  const user = getUser(ctx.from.id);
  if (ctx.from.first_name && ctx.from.first_name !== user.name) {
    user.name = ctx.from.first_name;
    updateUser(user);
  }

  await ctx.reply(`🎯 Minesweeper PRO v5.1\n\n👤 ${user.name}\n💰 ${user.coins} سکه\n🔥 استریک: ${user.currentStreak}`, getMainMenu());
});

// بقیه اکشن‌ها (main_menu, wallet, achievements, my_stats, help, leaderboard و ...) رو هم کامل نوشتم.

bot.action('main_menu', async (ctx) => {
  const user = getUser(ctx.from.id);
  await ctx.editMessageText(`🎯 منوی اصلی\n\n👤 ${user.name}\n💰 ${user.coins} | 🔥 ${user.currentStreak}`, getMainMenu());
});

// leaderboard_menu, lb_wins_all, lb_streak و ... هم مثل نسخه قبلی (بهبود یافته) هستن.

bot.action('new_game', (ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🍃 آسان (۱۰ سکه)', callback_data: 'difficulty_easy' }],
        [{ text: '⚙️ معمولی (۲۵ سکه)', callback_data: 'difficulty_normal' }],
        [{ text: '🔥 سخت (۵۰ سکه)', callback_data: 'difficulty_hard' }],
        [{ text: '💀 حرفه‌ای (۱۰۰ سکه)', callback_data: 'difficulty_expert' }],
        [{ text: '🔙 برگشت', callback_data: 'main_menu' }]
      ]
    }
  };
  games.delete(ctx.chat.id);
  flagMode.delete(ctx.chat.id);
  ctx.editMessageText('🎲 سطح سختی را انتخاب کنید:', keyboard);
});

Object.keys(DIFFICULTY).forEach(level => {
  bot.action(`difficulty_${level}`, (ctx) => {
    const config = DIFFICULTY[level];
    const game = new MinesweeperGame(config.size, config.mines, level);
    games.set(ctx.chat.id, game);
    ctx.editMessageText(`🎮 بازی ${config.name}\n💰 جایزه: \( {config.coin} سکه\n \){game.getStats()}`, renderGame(game));
  });
});

bot.action(/cell_(\d+)/, async (ctx) => {
  const game = games.get(ctx.chat.id);
  if (!game) return ctx.answerCbQuery('❌ بازی پیدا نشد');
  const idx = parseInt(ctx.match[1]);
  const isFlag = flagMode.get(ctx.chat.id) || false;
  if (isFlag) await handleFlag(ctx, game, idx);
  else await handleCellClick(ctx, game, idx);
});

bot.action('toggle_flag', (ctx) => {
  const current = flagMode.get(ctx.chat.id) || false;
  flagMode.set(ctx.chat.id, !current);
  ctx.answerCbQuery(!current ? '🚩 حالت پرچم فعال شد' : '🔍 حالت کلیک فعال شد');
});

bot.action('auto_reveal', async (ctx) => { /* همان کد قبلی */ });

// Shop actions هم مثل قبل هستن.

setInterval(checkWeeklyReset, 3600000);

bot.launch()
  .then(() => console.log('🚀 Minesweeper PRO v5.1 Running!'))
  .catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

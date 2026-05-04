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
app.get('/', (req, res) => res.send('🎮 Minesweeper PRO v5.0 is alive'));
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
      name: 'کاربر'
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
    name: row.name || 'کاربر'
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
      name = ?
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
          { text: '💰 کیف پول', callback_data: 'wallet', style: 'success' },
          { text: '🛒 فروشگاه', callback_data: 'shop_menu', style: 'success' }
        ],
        [
          { text: '🏆 دستاوردها', callback_data: 'achievements', style: 'primary' },
          { text: '🏆 لیدربورد', callback_data: 'leaderboard_menu', style: 'primary' }
        ],
        [
          { text: '📊 آمار من', callback_data: 'my_stats', style: 'primary' },
          { text: '❓ راهنما', callback_data: 'help', style: 'danger' }
        ]
      ]
    }
  };
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
  }
  return db.prepare(sql).all();
}

function updateStreak(userId, win) {
  const user = getUser(userId);
  if (win) {
    user.currentStreak = (user.currentStreak || 0) + 1;
    if (user.currentStreak > (user.bestStreak || 0)) {
      user.bestStreak = user.currentStreak;
      if (user.bestStreak >= 5) checkAchievement(userId, 'STREAK_5', { streak: user.bestStreak });
      if (user.bestStreak >= 10) checkAchievement(userId, 'STREAK_10', { streak: user.bestStreak });
    }
  } else {
    user.currentStreak = 0;
  }
  updateUser(user);
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

function checkAchievement(userId, type, gameData) {
  const user = getUser(userId);
  if (user.achievements.includes(type)) return false;
  
  let earned = false;
  switch(type) {
    case 'FIRST_WIN': earned = user.wins === 1; break;
    case 'EXPERT': earned = gameData.difficulty === 'expert'; break;
    case 'SPEEDRUN': earned = gameData.time < 30; break;
    case 'PERFECT': earned = gameData.moves === gameData.safeCells; break;
    case 'LUCKY': earned = gameData.moves === 1; break;
    case 'STREAK_5': earned = gameData.streak >= 5; break;
    case 'STREAK_10': earned = gameData.streak >= 10; break;
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
  extra_life: { name: '❤️ جان اضافه', desc: 'یه بار میتونی اشتباه کنی', price: 75 }
};

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
        if (game.board[idx] === '💣') display = '💣';
        else if (game.board[idx] === 0) display = '▪️';
        else display = getEmojiForNumber(game.board[idx]);
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
  
  const user = getUser(userId);
  
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
    await ctx.editMessageText(`💥 باختی! 💀\n\n${game.getStats()}\n💰 سکه: ${user.coins}\n🔥 استریک شما: ${user.currentStreak || 0}`, renderGame(game, true));
    return false;
  }
  
  game.revealEmpty(idx);
  
  if (game.checkWin()) {
    game.alive = false;
    const gameTime = game.getTimeInSeconds();
    const safeCells = game.totalCells - game.minesCount;
    const coinReward = DIFFICULTY[game.difficulty].coin;
    
    user.coins += coinReward;
    user.wins++;
    user.gamesPlayed++;
    user.weeklyWins++;
    
    const scoreGain = 10 + (game.difficulty === 'expert' ? 30 : 0);
    user.totalScore = (user.totalScore || 0) + scoreGain;
    user.weeklyScore = (user.weeklyScore || 0) + scoreGain;
    
    if (game.difficulty === 'expert') user.expertWins++;
    
    if (!user.bestTime || gameTime < user.bestTime) user.bestTime = gameTime;
    
    updateStreak(userId, true);
    updateUser(user);
    
    let achievementMsg = '';
    const achievements = [];
    const checks = ['FIRST_WIN', 'EXPERT', 'SPEEDRUN', 'PERFECT', 'LUCKY'];
    for (const ach of checks) {
      const result = checkAchievement(userId, ach, { difficulty: game.difficulty, time: gameTime, moves: game.actualClicks, safeCells });
      if (result) achievements.push(result);
    }
    achievements.forEach(ach => { achievementMsg += `\n🏆 ${ach.name} +${ach.coin} سکه!`; });
    
    await ctx.editMessageText(
      `🎉 بردی! 🎉\n⏱️ زمان: ${gameTime} ثانیه\n🎯 حرکت: ${game.actualClicks}\n💰 +${coinReward} سکه\n🔥 استریک: ${user.currentStreak}${achievementMsg}\n📊 کل سکه: ${user.coins}`,
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

// ================== BOT ACTIONS ==================
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);
  if (ctx.from.first_name) {
    user.name = ctx.from.first_name;
    updateUser(user);
  }
  
  await ctx.reply(
    `🎯 به Minesweeper PRO v5.0 خوش اومدی!\n\n👤 ${user.name}\n💰 سکه: ${user.coins}\n🏆 برد: ${user.wins} | باخت: ${user.losses}\n🔥 استریک: ${user.currentStreak || 0}\n\n⚡ از دکمه‌های زیر استفاده کن:`,
    getMainMenu()
  );
});

bot.action('main_menu', async (ctx) => {
  const user = getUser(ctx.from.id);
  await ctx.editMessageText(
    `🎯 منوی اصلی\n\n👤 ${user.name}\n💰 سکه: ${user.coins}\n🏆 برد: ${user.wins} | باخت: ${user.losses}\n🔥 استریک: ${user.currentStreak || 0}`,
    getMainMenu()
  );
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

// ================== OTHER MENUS ==================
bot.action('wallet', async (ctx) => {
  const user = getUser(ctx.from.id);
  await ctx.editMessageText(`💰 کیف پول شما\n\nسکه: ${user.coins} 🪙\n\n🎮 هر برد: +${DIFFICULTY.easy.coin}-${DIFFICULTY.expert.coin} سکه\n🏆 دستاوردها: سکه اضافه میدن\n🔥 استریک: ${user.currentStreak || 0}`, {
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
  await ctx.editMessageText(
    `📊 آمار شما:\n\n🎮 بازی‌ها: ${user.gamesPlayed}\n🏆 برد: ${user.wins}\n💀 باخت: ${user.losses}\n📈 نرخ برد: ${winRate}%\n💰 سکه: ${user.coins}\n⚡ بهترین زمان: ${user.bestTime || '-'} ثانیه\n🔥 بهترین استریک: ${user.bestStreak || 0}\n🏅 دستاوردها: ${user.achievements.length}/${Object.keys(ACHIEVEMENTS).length}`,
    { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } }
  );
});

bot.action('help', async (ctx) => {
  await ctx.editMessageText(
    `📖 راهنمای v5.0:\n\n🎯 هدف: همه سلول‌های بدون مین رو باز کن\n\n🕹️ کنترل‌ها:\n• کلیک عادی: باز کردن سلول\n• حالت 🚩 Flag: پرچم گذاری روی مین\n• 🔍 Auto: باز کردن خودکار خانه‌های امن\n\n💰 سیستم جایزه:\n• برد در هر سطح: سکه میگیری\n• دستاوردها: سکه اضافه\n• استریک: برد متوالی جایزه داره\n• لیدربورد: رقابت با دیگران`,
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
    const game = new MinesweeperGame(config.size, config.mines, level);
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
      const user = getUser(ctx.from.id);
      user.coins += DIFFICULTY[game.difficulty].coin;
      user.wins++;
      user.gamesPlayed++;
      updateStreak(ctx.from.id, true);
      updateUser(user);
      await ctx.editMessageText(`🎉 بردی! 🎉\n💰 +${DIFFICULTY[game.difficulty].coin} سکه\n${game.getStats()}`, renderGame(game, true));
    } else {
      await ctx.editMessageText(`💣 ${DIFFICULTY[game.difficulty]?.name}\n${game.getStats()}`, renderGame(game, false));
    }
    await ctx.answerCbQuery('✨ خانه‌های امن باز شدن');
  } else {
    await ctx.answerCbQuery('🔍 هیچ خانۀ امنی نیست');
  }
});

bot.action('shop_menu', async (ctx) => {
  const user = getUser(ctx.from.id);
  let msg = '🛒 فروشگاه آیتم‌ها:\n\n';
  for (const [key, item] of Object.entries(SHOP)) {
    msg += `${item.name}\n   ${item.desc}\n   💰 ${item.price} سکه\n`;
    if (user.inventory?.[key]) msg += `   📦 موجودی: ${user.inventory[key]}\n`;
    msg += '\n';
  }
  await ctx.editMessageText(msg, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💣 خرید مین‌شکن (۵۰)', callback_data: 'buy_bomb_disabler', style: 'success' }],
        [{ text: '❤️ خرید جان اضافه (۷۵)', callback_data: 'buy_extra_life', style: 'success' }],
        [{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]
      ]
    }
  });
});

bot.action('buy_bomb_disabler', async (ctx) => {
  const user = getUser(ctx.from.id);
  if (user.coins >= 50) {
    user.coins -= 50;
    if (!user.inventory) user.inventory = {};
    user.inventory.bomb_disabler = (user.inventory.bomb_disabler || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('✅ مین‌شکن خریداری شد!', true);
    await ctx.editMessageText('✅ خرید انجام شد!', { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
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
    await ctx.editMessageText('✅ خرید انجام شد!', { reply_markup: { inline_keyboard: [[{ text: '🔙 برگشت', callback_data: 'main_menu', style: 'primary' }]] } });
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
  .then(() => console.log('🚀 Minesweeper PRO v5.0 Running!'))
  .catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

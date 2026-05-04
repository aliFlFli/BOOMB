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
app.get('/', (req, res) => res.send('🎮 Minesweeper PRO v4.1 is alive'));
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
    inventory TEXT DEFAULT '{}'
  )
`);

function getUser(userId) {
  const row = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare('INSERT INTO users (user_id) VALUES (?)').run(userId);
    return {
      userId,
      coins: 100,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      bestTime: null,
      achievements: [],
      inventory: {}
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
    inventory: JSON.parse(row.inventory)
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
      inventory = ?
    WHERE user_id = ?
  `).run(
    user.coins,
    user.wins,
    user.losses,
    user.gamesPlayed,
    user.bestTime,
    JSON.stringify(user.achievements),
    JSON.stringify(user.inventory),
    user.userId
  );
}

// ================== BOT INIT ==================
const bot = new Telegraf(process.env.BOT_TOKEN);
const games = new Map();
let flagMode = new Map();

// ================== PERMANENT MENU KEYBOARD ==================
function getMainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '🎮 شروع بازی' }],
        [{ text: '💰 کیف پول' }, { text: '🛒 فروشگاه' }],
        [{ text: '🏆 دستاوردها' }, { text: '📊 آمار من' }],
        [{ text: '❓ راهنما' }]
      ],
      resize_keyboard: true,
      persistent: true,
      is_persistent: true
    }
  };
}

// ================== ACHIEVEMENTS ==================
const ACHIEVEMENTS = {
  FIRST_WIN: { name: '🏆 اولین برد', desc: 'اولین بازی رو ببر', coin: 50 },
  EXPERT: { name: '🎖️ حرفه‌ای', desc: 'سطح حرفه‌ای رو ببر', coin: 200 },
  SPEEDRUN: { name: '⚡ سرعت', desc: 'زیر ۳۰ ثانیه ببر', coin: 100 },
  PERFECT: { name: '💎 کامل', desc: 'بدون اشتباه ببر', coin: 150 },
  LUCKY: { name: '🍀 خوش شانس', desc: 'با ۱ حرکت ببر', coin: 500 }
};

function checkAchievement(userId, type, gameData) {
  const user = getUser(userId);
  
  if (user.achievements.includes(type)) return false;
  
  let earned = false;
  switch(type) {
    case 'FIRST_WIN':
      earned = user.wins === 1;
      break;
    case 'EXPERT':
      earned = gameData.difficulty === 'expert';
      break;
    case 'SPEEDRUN':
      earned = gameData.time < 30;
      break;
    case 'PERFECT':
      earned = gameData.moves === gameData.safeCells;
      break;
    case 'LUCKY':
      earned = gameData.moves === 1;
      break;
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
      if (this.board[i] === '💣') {
        this.revealed[i] = true;
      }
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

// ================== RENDER ==================
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
    controlRow.push(Markup.button.callback('🛒 Shop', 'shop_menu'));
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
    await ctx.answerCbQuery('❌ بازی تموم شده! New Game بزن');
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
    await ctx.editMessageText(
      `💣 ${DIFFICULTY[game.difficulty]?.name || ''}\n💣 مین خنثی شد!\n${game.getStats()}`,
      renderGame(game, false)
    );
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
      await ctx.editMessageText(
        `💣 ${DIFFICULTY[game.difficulty]?.name || ''}\n❤️ جان اضافه فعال شد!\n${game.getStats()}`,
        renderGame(game, false)
      );
      return true;
    }
    
    game.alive = false;
    game.revealAllMines();
    
    user.losses++;
    user.gamesPlayed++;
    updateUser(user);
    
    await ctx.editMessageText(
      `💥 باختی! 💀\n\n${game.getStats()}\n💰 سکه: ${user.coins}`,
      renderGame(game, true)
    );
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
    
    if (!user.bestTime || gameTime < user.bestTime) {
      user.bestTime = gameTime;
    }
    
    updateUser(user);
    
    const achievements = [];
    const firstWin = checkAchievement(userId, 'FIRST_WIN', { difficulty: game.difficulty, time: gameTime, moves: game.actualClicks, safeCells: safeCells });
    const expertAch = checkAchievement(userId, 'EXPERT', { difficulty: game.difficulty, time: gameTime, moves: game.actualClicks, safeCells: safeCells });
    const speedAch = checkAchievement(userId, 'SPEEDRUN', { difficulty: game.difficulty, time: gameTime, moves: game.actualClicks, safeCells: safeCells });
    const perfectAch = checkAchievement(userId, 'PERFECT', { difficulty: game.difficulty, time: gameTime, moves: game.actualClicks, safeCells: safeCells });
    const luckyAch = checkAchievement(userId, 'LUCKY', { difficulty: game.difficulty, time: gameTime, moves: game.actualClicks, safeCells: safeCells });
    
    if (firstWin) achievements.push(firstWin);
    if (expertAch) achievements.push(expertAch);
    if (speedAch) achievements.push(speedAch);
    if (perfectAch) achievements.push(perfectAch);
    if (luckyAch) achievements.push(luckyAch);
    
    let achievementMsg = '';
    achievements.forEach(ach => {
      achievementMsg += `\n🏆 ${ach.name} +${ach.coin} سکه!`;
    });
    
    await ctx.editMessageText(
      `🎉 بردی! 🎉\n⏱️ زمان: ${gameTime} ثانیه\n🎯 حرکت: ${game.actualClicks}\n💰 +${coinReward} سکه${achievementMsg}\n📊 کل سکه: ${user.coins}`,
      renderGame(game, true)
    );
    return true;
  }
  
  await ctx.editMessageText(
    `💣 ${DIFFICULTY[game.difficulty]?.name || ''}\n${game.getStats()}`,
    renderGame(game, false)
  );
  await ctx.answerCbQuery('✅ باز شد');
  return true;
}

async function handleFlag(ctx, game, idx) {
  if (!game) {
    await ctx.answerCbQuery('❌ بازی فعال نیست');
    return false;
  }
  
  if (!game.alive) {
    await ctx.answerCbQuery('❌ بازی تموم شده. فقط New Game کار میکنه');
    return false;
  }
  
  if (game.revealed[idx]) {
    await ctx.answerCbQuery('❌ باز شده رو پرچم نمیشه زد');
    return false;
  }
  
  game.flags[idx] = !game.flags[idx];
  game.flaggedCount += game.flags[idx] ? 1 : -1;
  
  await ctx.editMessageText(
    `💣 ${DIFFICULTY[game.difficulty]?.name || ''}\n${game.getStats()}`,
    renderGame(game, false)
  );
  await ctx.answerCbQuery(game.flags[idx] ? '🚩 پرچم زده شد' : '🔓 پرچم برداشته شد');
  return true;
}

// ================== TEXT MESSAGE HANDLERS ==================
bot.hears('🎮 شروع بازی', (ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🍃 آسان (۱۰ سکه)', callback_data: 'difficulty_easy' }],
        [{ text: '⚙️ معمولی (۲۵ سکه)', callback_data: 'difficulty_normal' }],
        [{ text: '🔥 سخت (۵۰ سکه)', callback_data: 'difficulty_hard' }],
        [{ text: '💀 حرفه‌ای (۱۰۰ سکه)', callback_data: 'difficulty_expert' }],
        [{ text: '🔙 برگشت', callback_data: 'back_to_menu' }]
      ]
    }
  };
  
  ctx.reply('🎲 سطح سختی رو انتخاب کن:', keyboard);
});

bot.hears('💰 کیف پول', async (ctx) => {
  const user = getUser(ctx.from.id);
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 برگشت', callback_data: 'back_to_menu' }]
      ]
    }
  };
  
  await ctx.reply(
    `💰 کیف پول شما\n\nسکه: ${user.coins} 🪙\n\n🎮 هر برد: +${DIFFICULTY.easy.coin}-${DIFFICULTY.expert.coin} سکه\n🏆 دستاوردها: سکه اضافه میدن`,
    keyboard
  );
});

bot.hears('🏆 دستاوردها', async (ctx) => {
  const user = getUser(ctx.from.id);
  let msg = '🏆 دستاوردهای شما:\n\n';
  
  for (const [key, ach] of Object.entries(ACHIEVEMENTS)) {
    const earned = user.achievements.includes(key);
    msg += `${earned ? '✅' : '🔒'} ${ach.name}\n`;
    msg += `   ${ach.desc} (+${ach.coin} سکه)\n\n`;
  }
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 برگشت', callback_data: 'back_to_menu' }]
      ]
    }
  };
  
  await ctx.reply(msg, keyboard);
});

bot.hears('🛒 فروشگاه', async (ctx) => {
  const user = getUser(ctx.from.id);
  let msg = '🛒 فروشگاه آیتم‌ها:\n\n';
  
  for (const [key, item] of Object.entries(SHOP)) {
    msg += `${item.name}\n`;
    msg += `   ${item.desc}\n`;
    msg += `   💰 ${item.price} سکه\n`;
    if (user.inventory?.[key]) {
      msg += `   📦 موجودی: ${user.inventory[key]}\n`;
    }
    msg += `\n`;
  }
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💣 خرید مین‌شکن (۵۰)', callback_data: 'buy_bomb_disabler' }],
        [{ text: '❤️ خرید جان اضافه (۷۵)', callback_data: 'buy_extra_life' }],
        [{ text: '🔙 برگشت', callback_data: 'back_to_menu' }]
      ]
    }
  };
  
  await ctx.reply(msg, keyboard);
});

bot.hears('📊 آمار من', async (ctx) => {
  const user = getUser(ctx.from.id);
  const winRate = user.gamesPlayed > 0 ? ((user.wins / user.gamesPlayed) * 100).toFixed(1) : 0;
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 برگشت', callback_data: 'back_to_menu' }]
      ]
    }
  };
  
  await ctx.reply(
    `📊 آمار شما:\n\n` +
    `🎮 بازی‌ها: ${user.gamesPlayed}\n` +
    `🏆 برد: ${user.wins}\n` +
    `💀 باخت: ${user.losses}\n` +
    `📈 نرخ برد: ${winRate}%\n` +
    `💰 سکه: ${user.coins}\n` +
    `⚡ بهترین زمان: ${user.bestTime || '-'} ثانیه\n` +
    `🏅 دستاوردها: ${user.achievements.length}/${Object.keys(ACHIEVEMENTS).length}`,
    keyboard
  );
});

bot.hears('❓ راهنما', async (ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 برگشت', callback_data: 'back_to_menu' }]
      ]
    }
  };
  
  await ctx.reply(
    `📖 راهنمای بازی v4.1:\n\n` +
    `🎯 هدف: همه سلول‌های بدون مین رو باز کن\n\n` +
    `🕹️ کنترل‌ها:\n` +
    `• کلیک عادی: باز کردن سلول\n` +
    `• حالت 🚩 Flag: پرچم گذاری روی مین\n` +
    `• دکمه 🔍 Auto: باز کردن خودکار خانه‌های امن\n` +
    `• دکمه 🔄 New: بازی جدید با همون سطح\n` +
    `• دکمه 🏠 Menu: برگشت به منوی اصلی\n\n` +
    `💰 سیستم جایزه:\n` +
    `• برد در هر سطح: سکه میگیری\n` +
    `• دستاوردها: سکه اضافه\n` +
    `• فروشگاه: آیتم بخر\n` +
    `   - 💣 مین‌شکن: یه مین رو نابود کن\n` +
    `   - ❤️ جان اضافه: یه اشتباه رو ببخش`,
    keyboard
  );
});

// ================== BOT COMMANDS ==================
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);
  
  await ctx.reply(
    `🎯 به Minesweeper PRO v4.1 خوش اومدی!\n\n` +
    `👤 ${ctx.from.first_name}\n` +
    `💰 سکه: ${user.coins}\n` +
    `🏆 برد: ${user.wins} | باخت: ${user.losses}\n\n` +
    `⚡ از دکمه‌های زیر استفاده کن!`,
    getMainMenuKeyboard()
  );
});

bot.action('back_to_menu', async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);
  
  await ctx.editMessageText(
    `🎯 منوی اصلی Minesweeper PRO\n\n` +
    `👤 ${ctx.from.first_name}\n` +
    `💰 سکه: ${user.coins}\n` +
    `🏆 برد: ${user.wins} | باخت: ${user.losses}`,
    getMainMenuKeyboard()
  );
});

bot.action('main_menu', async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const user = getUser(userId);
  
  games.delete(chatId);
  flagMode.delete(chatId);
  
  await ctx.editMessageText(
    `🎯 منوی اصلی Minesweeper PRO\n\n` +
    `👤 ${ctx.from.first_name}\n` +
    `💰 سکه: ${user.coins}\n` +
    `🏆 برد: ${user.wins} | باخت: ${user.losses}`,
    getMainMenuKeyboard()
  );
});

bot.action('new_game', (ctx) => {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🍃 آسان (۱۰ سکه)', callback_data: 'difficulty_easy' }],
        [{ text: '⚙️ معمولی (۲۵ سکه)', callback_data: 'difficulty_normal' }],
        [{ text: '🔥 سخت (۵۰ سکه)', callback_data: 'difficulty_hard' }],
        [{ text: '💀 حرفه‌ای (۱۰۰ سکه)', callback_data: 'difficulty_expert' }],
        [{ text: '🔙 برگشت', callback_data: 'back_to_menu' }]
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
    
    const chatId = ctx.chat.id;
    games.set(chatId, game);
    
    ctx.editMessageText(
      `🎮 بازی ${config.name}\n💰 جایزه: ${config.coin} سکه\n${game.getStats()}`,
      renderGame(game, false)
    );
    ctx.answerCbQuery('🎮 بازی شروع شد!');
  });
});

bot.action(/cell_(\d+)/, async (ctx) => {
  const chatId = ctx.chat.id;
  const idx = parseInt(ctx.match[1]);
  const game = games.get(chatId);
  
  if (!game) {
    await ctx.answerCbQuery('❌ بازی فعال نیست. منوی اصلی شروع کن');
    return;
  }
  
  if (!game.alive) {
    await ctx.answerCbQuery('❌ بازی تموم شده! دکمه New Game رو بزن');
    return;
  }
  
  const isFlagMode = flagMode.get(chatId) || false;
  
  if (isFlagMode) {
    await handleFlag(ctx, game, idx);
  } else {
    await handleCellClick(ctx, game, idx);
  }
});

bot.action('toggle_flag', (ctx) => {
  const chatId = ctx.chat.id;
  const game = games.get(chatId);
  
  if (!game) {
    ctx.answerCbQuery('❌ بازی فعال نیست. New Game بزن');
    return;
  }
  
  if (!game.alive) {
    ctx.answerCbQuery('❌ بازی تموم شده. اول New Game بزن');
    return;
  }
  
  const current = flagMode.get(chatId) || false;
  flagMode.set(chatId, !current);
  
  ctx.answerCbQuery(`${!current ? '🚩' : '🔍'} حالت ${!current ? 'پرچم' : 'کلیک'} فعال شد`);
});

bot.action('auto_reveal', async (ctx) => {
  const chatId = ctx.chat.id;
  const game = games.get(chatId);
  
  if (!game) {
    await ctx.answerCbQuery('❌ بازی فعال نیست. New Game بزن');
    return;
  }
  
  if (!game.alive) {
    await ctx.answerCbQuery('❌ بازی تموم شده. New Game بزن');
    return;
  }
  
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
      const coinReward = DIFFICULTY[game.difficulty].coin;
      user.coins += coinReward;
      user.wins++;
      user.gamesPlayed++;
      updateUser(user);
      
      await ctx.editMessageText(
        `🎉 بردی! 🎉\n💰 +${coinReward} سکه\n${game.getStats()}`,
        renderGame(game, true)
      );
    } else {
      await ctx.editMessageText(
        `💣 ${DIFFICULTY[game.difficulty]?.name || ''}\n${game.getStats()}`,
        renderGame(game, false)
      );
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
    msg += `${item.name}\n`;
    msg += `   ${item.desc}\n`;
    msg += `   💰 ${item.price} سکه\n`;
    if (user.inventory?.[key]) {
      msg += `   📦 موجودی: ${user.inventory[key]}\n`;
    }
    msg += `\n`;
  }
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💣 خرید مین‌شکن (۵۰)', callback_data: 'buy_bomb_disabler' }],
        [{ text: '❤️ خرید جان اضافه (۷۵)', callback_data: 'buy_extra_life' }],
        [{ text: '🔙 برگشت', callback_data: 'main_menu' }]
      ]
    }
  };
  
  await ctx.editMessageText(msg, keyboard);
});

bot.action('buy_bomb_disabler', async (ctx) => {
  const user = getUser(ctx.from.id);
  const chatId = ctx.chat.id;
  
  if (user.coins >= 50) {
    user.coins -= 50;
    if (!user.inventory) user.inventory = {};
    user.inventory.bomb_disabler = (user.inventory.bomb_disabler || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('✅ مین‌شکن خریداری شد!', true);
    
    const game = games.get(chatId);
    if (game && game.alive) {
      await ctx.editMessageText(
        `💣 ${DIFFICULTY[game.difficulty]?.name || ''}\n💰 سکه: ${user.coins}\n${game.getStats()}`,
        renderGame(game, false)
      );
    } else {
      await ctx.editMessageText('✅ خرید انجام شد! به منو برگشتید', getMainMenuKeyboard());
    }
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست! بازی کن سکه جمع کن', true);
  }
});

bot.action('buy_extra_life', async (ctx) => {
  const user = getUser(ctx.from.id);
  const chatId = ctx.chat.id;
  
  if (user.coins >= 75) {
    user.coins -= 75;
    if (!user.inventory) user.inventory = {};
    user.inventory.extra_life = (user.inventory.extra_life || 0) + 1;
    updateUser(user);
    await ctx.answerCbQuery('❤️ جان اضافه خریداری شد!', true);
    
    const game = games.get(chatId);
    if (game && game.alive) {
      await ctx.editMessageText(
        `💣 ${DIFFICULTY[game.difficulty]?.name || ''}\n💰 سکه: ${user.coins}\n${game.getStats()}`,
        renderGame(game, false)
      );
    } else {
      await ctx.editMessageText('✅ خرید انجام شد! به منو برگشتید', getMainMenuKeyboard());
    }
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست! بازی کن سکه جمع کن', true);
  }
});

// ================== MEMORY CLEANUP ==================
setInterval(() => {
  const now = Date.now();
  for (let [chatId, game] of games.entries()) {
    if (now - game.startTime > 3600000) {
      games.delete(chatId);
    }
  }
}, 600000);

// ================== ERROR HANDLING ==================
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  ctx.reply('⚠️ خطایی رخ داد. لطفاً /start کنید').catch(() => {});
});

// ================== LAUNCH ==================
bot.launch()
  .then(() => console.log('🚀 Minesweeper PRO v4.1 Running!'))
  .catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

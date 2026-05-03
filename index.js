const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');
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
app.get('/', (req, res) => res.send('🎮 Minesweeper PRO is alive'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🌐 Server on', PORT));

// ================== BOT INIT ==================
const bot = new Telegraf(process.env.BOT_TOKEN);
const games = new Map();
let flagMode = new Map();

// ================== DATABASE ==================
let users = {};

try {
  users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
} catch(e) { 
  console.log('📁 New users file created'); 
}

function saveUsers() {
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
}

function getUser(userId) {
  if (!users[userId]) {
    users[userId] = {
      coins: 100,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      bestTime: null,
      achievements: [],
      inventory: {}
    };
    saveUsers();
  }
  return users[userId];
}

function addCoin(userId, amount) {
  const user = getUser(userId);
  user.coins += amount;
  saveUsers();
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
  const achievement = ACHIEVEMENTS[type];
  
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
    user.coins += achievement.coin;
    saveUsers();
    return achievement;
  }
  return false;
}

// ================== SHOP ==================
const SHOP = {
  bomb_disabler: { name: '💣 مین‌شکن', desc: 'یه مین رو نابود کن', price: 50, type: 'consumable' },
  extra_life: { name: '❤️ جان اضافه', desc: 'یه بار میتونی اشتباه کنی', price: 75, type: 'consumable' }
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
    this.flaggedCount = 0;
    this.extraLifeUsed = false;
    
    this.placeMines();
    this.calculateNumbers();
  }
  
  placeMines() {
    let placed = 0;
    while (placed < this.minesCount) {
      const idx = Math.floor(Math.random() * this.totalCells);
      if (this.board[idx] !== '💣') {
        this.board[idx] = '💣';
        placed++;
      }
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
  
  revealEmpty(idx) {
    if (this.revealed[idx] || this.flags[idx]) return;
    
    this.revealed[idx] = true;
    this.opened++;
    
    if (this.board[idx] !== 0) return;
    
    const x = Math.floor(idx / this.size);
    const y = idx % this.size;
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
          const neighborIdx = nx * this.size + ny;
          if (!this.revealed[neighborIdx] && this.board[neighborIdx] !== '💣') {
            this.revealEmpty(neighborIdx);
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
  
  return Markup.inlineKeyboard(rows);
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
  
  game.moves++;
  
  if (game.board[idx] === '💣') {
    const user = getUser(userId);
    
    if (user.inventory?.extra_life > 0 && !game.extraLifeUsed) {
      game.extraLifeUsed = true;
      user.inventory.extra_life--;
      saveUsers();
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
    saveUsers();
    
    await ctx.editMessageText(
      `💥 باختی! 💀\n\n${game.getStats()}\n💰 سکه: ${user.coins}`,
      renderGame(game, true)
    );
    return false;
  }
  
  game.revealEmpty(idx);
  
  if (game.checkWin()) {
    game.alive = false;
    const user = getUser(userId);
    const gameTime = game.getTimeInSeconds();
    
    user.wins++;
    user.gamesPlayed++;
    const coinReward = DIFFICULTY[game.difficulty].coin;
    user.coins += coinReward;
    
    if (!user.bestTime || gameTime < user.bestTime) {
      user.bestTime = gameTime;
    }
    
    saveUsers();
    
    const achievement = checkAchievement(userId, 'FIRST_WIN', { difficulty: game.difficulty, time: gameTime, moves: game.moves, safeCells: game.totalCells - game.minesCount });
    const expertAch = checkAchievement(userId, 'EXPERT', { difficulty: game.difficulty, time: gameTime, moves: game.moves, safeCells: game.totalCells - game.minesCount });
    const speedAch = checkAchievement(userId, 'SPEEDRUN', { difficulty: game.difficulty, time: gameTime, moves: game.moves, safeCells: game.totalCells - game.minesCount });
    
    let achievementMsg = '';
    if (achievement) achievementMsg += `\n\n🏆 ${achievement.name} +${achievement.coin} سکه!`;
    if (expertAch) achievementMsg += `\n🏆 ${expertAch.name} +${expertAch.coin} سکه!`;
    if (speedAch) achievementMsg += `\n🏆 ${speedAch.name} +${speedAch.coin} سکه!`;
    
    await ctx.editMessageText(
      `🎉 بردی! 🎉\n⏱️ زمان: ${gameTime} ثانیه\n🎯 حرکت: ${game.moves}\n💰 +${coinReward} سکه${achievementMsg}\n📊 کل سکه: ${user.coins}`,
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

// ================== BOT COMMANDS ==================
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🎮 شروع بازی', 'new_game')],
    [Markup.button.callback('💰 کیف پول', 'wallet')],
    [Markup.button.callback('🏆 دستاوردها', 'achievements')],
    [Markup.button.callback('🛒 فروشگاه', 'shop_menu')],
    [Markup.button.callback('📊 آمار من', 'my_stats')],
    [Markup.button.callback('❓ راهنما', 'help')]
  ]);
  
  await ctx.reply(
    `🎯 به Minesweeper PRO خوش اومدی!\n\n` +
    `👤 ${ctx.from.first_name}\n` +
    `💰 سکه: ${user.coins}\n` +
    `🏆 برد: ${user.wins} | باخت: ${user.losses}\n\n` +
    `⚡ با بردن بازی سکه بگیر و از فروشگاه آیتم بخر!`,
    keyboard
  );
});

bot.action('new_game', (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🍃 آسان (۱۰ سکه)', 'difficulty_easy')],
    [Markup.button.callback('⚙️ معمولی (۲۵ سکه)', 'difficulty_normal')],
    [Markup.button.callback('🔥 سخت (۵۰ سکه)', 'difficulty_hard')],
    [Markup.button.callback('💀 حرفه‌ای (۱۰۰ سکه)', 'difficulty_expert')],
    [Markup.button.callback('🔙 برگشت به منو', 'main_menu')]
  ]);
  
  const chatId = ctx.chat.id;
  games.delete(chatId);
  flagMode.delete(chatId);
  
  ctx.editMessageText('🎲 سطح سختی رو انتخاب کن:', keyboard);
  ctx.answerCbQuery();
});

bot.action('main_menu', async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const user = getUser(userId);
  
  games.delete(chatId);
  flagMode.delete(chatId);
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🎮 شروع بازی', 'new_game')],
    [Markup.button.callback('💰 کیف پول', 'wallet')],
    [Markup.button.callback('🏆 دستاوردها', 'achievements')],
    [Markup.button.callback('🛒 فروشگاه', 'shop_menu')],
    [Markup.button.callback('📊 آمار من', 'my_stats')],
    [Markup.button.callback('❓ راهنما', 'help')]
  ]);
  
  await ctx.editMessageText(
    `🎯 منوی اصلی Minesweeper PRO\n\n` +
    `👤 ${ctx.from.first_name}\n` +
    `💰 سکه: ${user.coins}\n` +
    `🏆 برد: ${user.wins} | باخت: ${user.losses}\n\n` +
    `⚡ با بردن بازی سکه بگیر!`,
    keyboard
  );
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
      saveUsers();
      
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

bot.action('wallet', async (ctx) => {
  const user = getUser(ctx.from.id);
  await ctx.editMessageText(
    `💰 کیف پول شما\n\n` +
    `سکه: ${user.coins} 🪙\n\n` +
    `🎮 هر برد: +${DIFFICULTY.easy.coin}-${DIFFICULTY.expert.coin} سکه\n` +
    `🏆 دستاوردها: سکه اضافه میدن`,
    Markup.inlineKeyboard([Markup.button.callback('🔙 برگشت به منو', 'main_menu')])
  );
});

bot.action('achievements', async (ctx) => {
  const user = getUser(ctx.from.id);
  let msg = '🏆 دستاوردهای شما:\n\n';
  
  for (const [key, ach] of Object.entries(ACHIEVEMENTS)) {
    const earned = user.achievements.includes(key);
    msg += `${earned ? '✅' : '🔒'} ${ach.name}\n`;
    msg += `   ${ach.desc} (+${ach.coin} سکه)\n\n`;
  }
  
  await ctx.editMessageText(msg, Markup.inlineKeyboard([Markup.button.callback('🔙 برگشت به منو', 'main_menu')]));
});

bot.action('my_stats', async (ctx) => {
  const user = getUser(ctx.from.id);
  const winRate = user.gamesPlayed > 0 ? ((user.wins / user.gamesPlayed) * 100).toFixed(1) : 0;
  
  await ctx.editMessageText(
    `📊 آمار شما:\n\n` +
    `🎮 بازی‌ها: ${user.gamesPlayed}\n` +
    `🏆 برد: ${user.wins}\n` +
    `💀 باخت: ${user.losses}\n` +
    `📈 نرخ برد: ${winRate}%\n` +
    `💰 سکه: ${user.coins}\n` +
    `⚡ بهترین زمان: ${user.bestTime || '-'} ثانیه\n` +
    `🏅 دستاوردها: ${user.achievements.length}/${Object.keys(ACHIEVEMENTS).length}`,
    Markup.inlineKeyboard([Markup.button.callback('🔙 برگشت به منو', 'main_menu')])
  );
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
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💣 خرید مین‌شکن (۵۰)', 'buy_bomb_disabler')],
    [Markup.button.callback('❤️ خرید جان اضافه (۷۵)', 'buy_extra_life')],
    [Markup.button.callback('🔙 برگشت به منو', 'main_menu')]
  ]);
  
  await ctx.editMessageText(msg, keyboard);
});

bot.action('buy_bomb_disabler', async (ctx) => {
  const user = getUser(ctx.from.id);
  const chatId = ctx.chat.id;
  
  if (user.coins >= 50) {
    user.coins -= 50;
    if (!user.inventory) user.inventory = {};
    user.inventory.bomb_disabler = (user.inventory.bomb_disabler || 0) + 1;
    saveUsers();
    await ctx.answerCbQuery('✅ مین‌شکن خریداری شد!', true);
    
    const game = games.get(chatId);
    if (game && game.alive) {
      await ctx.editMessageText(
        `💣 ${DIFFICULTY[game.difficulty]?.name || ''}\n💰 سکه: ${user.coins}\n${game.getStats()}`,
        renderGame(game, false)
      );
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
    saveUsers();
    await ctx.answerCbQuery('❤️ جان اضافه خریداری شد!', true);
    
    const game = games.get(chatId);
    if (game && game.alive) {
      await ctx.editMessageText(
        `💣 ${DIFFICULTY[game.difficulty]?.name || ''}\n💰 سکه: ${user.coins}\n${game.getStats()}`,
        renderGame(game, false)
      );
    }
  } else {
    await ctx.answerCbQuery('❌ سکه کافی نیست! بازی کن سکه جمع کن', true);
  }
});

bot.action('help', async (ctx) => {
  await ctx.editMessageText(
    `📖 راهنمای بازی:\n\n` +
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
    `• فروشگاه: آیتم بخر (مین‌شکن و جان اضافه)\n\n` +
    `💡 نکته: بعد از تموم شدن بازی، فقط دکمه New Game و Menu کار میکنن`,
    Markup.inlineKeyboard([Markup.button.callback('🔙 برگشت به منو', 'main_menu')])
  );
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
  .then(() => console.log('🚀 Minesweeper PRO v3.0 Running!'))
  .catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

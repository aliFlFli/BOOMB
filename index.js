const { Telegraf, Markup } = require('telegraf');
const express = require('express');
require('dotenv').config();

// ================== CONFIG ==================
const DIFFICULTY = {
  easy: { size: 4, mines: 2, name: '🍃 آسان' },
  normal: { size: 5, mines: 5, name: '⚙️ معمولی' },
  hard: { size: 6, mines: 10, name: '🔥 سخت' },
  expert: { size: 8, mines: 20, name: '💀 حرفه‌ای' }
};

// ================== KEEP ALIVE ==================
const app = express();
app.get('/', (req, res) => res.send('🎮 Minesweeper PRO is alive'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🌐 Server on', PORT));

// ================== BOT INIT ==================
const bot = new Telegraf(process.env.BOT_TOKEN);
const games = new Map();
const userSettings = new Map();
let flagMode = new Map();

// ================== UTILS ==================
function getEmojiForNumber(num) {
  const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
  return emojis[num] || '❓';
}

// ================== GAME CLASS ==================
class MinesweeperGame {
  constructor(size, minesCount) {
    this.size = size;
    this.totalCells = size * size;
    this.minesCount = minesCount;
    this.board = Array(this.totalCells).fill(0);
    this.revealed = Array(this.totalCells).fill(false);
    this.flags = Array(this.totalCells).fill(false);
    this.alive = true;
    this.opened = 0;
    this.startTime = Date.now();
    this.moves = 0;
    this.flaggedCount = 0;
    this.difficulty = 'normal';
    
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
}

// ================== RENDER ==================
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
  
  // کنترل پنل پایینی
  const controlRow = [];
  
  if (!gameOver) {
    controlRow.push(Markup.button.callback('🔍 Auto', 'auto_reveal'));
    controlRow.push(Markup.button.callback('🚩 Flag mode', 'toggle_flag'));
  }
  
  controlRow.push(Markup.button.callback('🔄 بازی جدید', 'new_game'));
  controlRow.push(Markup.button.callback('🏠 منو اصلی', 'main_menu'));
  
  rows.push(controlRow);
  
  return Markup.inlineKeyboard(rows);
}

// ================== GAME LOGIC ==================
async function handleCellClick(ctx, game, idx) {
  if (!game.alive) {
    await ctx.answerCbQuery('❌ بازی تمام شده! دکمه بازی جدید رو بزن');
    return false;
  }
  
  if (game.revealed[idx]) {
    await ctx.answerCbQuery('🔓 قبلاً باز شده');
    return false;
  }
  
  if (game.flags[idx]) {
    await ctx.answerCbQuery('🚩 پرچم زده شده، اول پرچم رو بردار');
    return false;
  }
  
  game.moves++;
  
  if (game.board[idx] === '💣') {
    game.alive = false;
    game.revealAllMines();
    
    await ctx.editMessageText(
      `💥 باختی! 💀\n\n${game.getStats()}`,
      renderGame(game, true)
    );
    return false;
  }
  
  game.revealEmpty(idx);
  
  if (game.checkWin()) {
    game.alive = false;
    await ctx.editMessageText(
      `🎉 بردی! عالی بود 🎉\n\n${game.getStats()}`,
      renderGame(game, true)
    );
    return true;
  }
  
  await ctx.editMessageText(
    `💣 ماین‌سوییپر ${DIFFICULTY[game.difficulty]?.name || ''}\n${game.getStats()}`,
    renderGame(game, false)
  );
  await ctx.answerCbQuery('✅ باز شد');
  return true;
}

async function handleFlag(ctx, game, idx) {
  if (!game.alive) {
    await ctx.answerCbQuery('❌ بازی تمام شده. دکمه "بازی جدید" رو بزن');
    return;
  }
  
  if (game.revealed[idx]) {
    await ctx.answerCbQuery('❌ نمیشه روی سلول باز شده پرچم زد');
    return;
  }
  
  game.flags[idx] = !game.flags[idx];
  game.flaggedCount += game.flags[idx] ? 1 : -1;
  
  await ctx.editMessageText(
    `💣 ماین‌سوییپر ${game.difficulty ? DIFFICULTY[game.difficulty]?.name : ''}\n${game.getStats()}`,
    renderGame(game, false)
  );
  await ctx.answerCbQuery(game.flags[idx] ? '🚩 پرچم زده شد' : '🔓 پرچم برداشته شد');
}

// ================== BOT COMMANDS & ACTIONS ==================
bot.start((ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🎮 شروع بازی', 'new_game')],
    [Markup.button.callback('⚙️ تنظیمات', 'settings')],
    [Markup.button.callback('❓ راهنما', 'help')]
  ]);
  
  ctx.reply(
    `🎯 به Minesweeper PRO خوش اومدی!\n\n` +
    `⚡ بازی کلاسیک ماین‌سوییپر با امکانات حرفه‌ای:\n` +
    `• حالت پرچم‌گذاری\n` +
    `• باز شدن خودکار خانه‌های صفر\n` +
    `• تایمر و آمار بازی\n` +
    `• ۴ سطح سختی\n\n` +
    `برای شروع دکمه 🎮 رو بزن!`,
    keyboard
  );
});

bot.action('new_game', (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🍃 آسان', 'difficulty_easy')],
    [Markup.button.callback('⚙️ معمولی', 'difficulty_normal')],
    [Markup.button.callback('🔥 سخت', 'difficulty_hard')],
    [Markup.button.callback('💀 حرفه‌ای', 'difficulty_expert')],
    [Markup.button.callback('🔙 برگشت به منو', 'main_menu')]
  ]);
  
  ctx.editMessageText('🎲 سطح سختی رو انتخاب کن:', keyboard);
  ctx.answerCbQuery();
});

Object.keys(DIFFICULTY).forEach(level => {
  bot.action(`difficulty_${level}`, (ctx) => {
    const config = DIFFICULTY[level];
    const game = new MinesweeperGame(config.size, config.mines);
    game.difficulty = level;
    
    const chatId = ctx.chat.id;
    games.set(chatId, game);
    
    ctx.editMessageText(
      `🎮 بازی ${config.name}\n${game.getStats()}`,
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
    await ctx.answerCbQuery('❌ بازی فعال نیست. از منوی اصلی شروع کن');
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
  
  if (!game || !game.alive) {
    ctx.answerCbQuery('❌ بازی فعال نیست');
    return;
  }
  
  const current = flagMode.get(chatId) || false;
  flagMode.set(chatId, !current);
  
  ctx.answerCbQuery(`${!current ? '🚩' : '🔍'} حالت ${!current ? 'پرچم‌گذاری' : 'کلیک عادی'} فعال شد`);
});

bot.action('auto_reveal', async (ctx) => {
  const chatId = ctx.chat.id;
  const game = games.get(chatId);
  
  if (!game || !game.alive) {
    await ctx.answerCbQuery('❌ بازی فعال نیست. بازی جدید شروع کن');
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
      await ctx.editMessageText(
        `🎉 بردی! 🎉\n${game.getStats()}`,
        renderGame(game, true)
      );
    } else {
      await ctx.editMessageText(
        `💣 ${game.getStats()}`,
        renderGame(game, false)
      );
    }
    await ctx.answerCbQuery('✨ خانه‌های امن باز شدند');
  } else {
    await ctx.answerCbQuery('🔍 هیچ خانه امنی برای باز شدن نیست');
  }
});

bot.action('main_menu', (ctx) => {
  games.delete(ctx.chat.id);
  flagMode.delete(ctx.chat.id);
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🎮 شروع بازی', 'new_game')],
    [Markup.button.callback('⚙️ تنظیمات', 'settings')],
    [Markup.button.callback('❓ راهنما', 'help')]
  ]);
  
  ctx.editMessageText(
    `🎯 منوی اصلی Minesweeper PRO\n\nبرای شروع دکمه 🎮 رو بزن!`,
    keyboard
  );
});

bot.action('settings', (ctx) => {
  ctx.editMessageText(
    '⚙️ تنظیمات:\n\n' +
    '• حالت پرچم: حین بازی دکمه 🚩 Flag mode رو بزن\n' +
    '• سطح سختی: قبل از شروع بازی انتخاب کن\n' +
    '• آمار: تایمر و تعداد حرکت‌ها زیر صفحه نشون داده میشه\n\n' +
    '🔜 تنظیمات بیشتر به زودی اضافه میشه!',
    Markup.inlineKeyboard([Markup.button.callback('🔙 برگشت', 'main_menu')])
  );
});

bot.action('help', (ctx) => {
  ctx.editMessageText(
    `📖 راهنمای بازی:\n\n` +
    `🎯 هدف: همه سلول‌هایی که مین ندارن رو باز کن\n\n` +
    `🕹️ نحوه بازی:\n` +
    `• روی سلول‌ها کلیک کن تا باز بشن\n` +
    `• دکمه 🚩 Flag mode رو بزن تا حالت پرچم فعال بشه\n` +
    `• با پرچم مین‌ها رو علامت بزن\n` +
    `• دکمه 🔍 Auto خانه‌های امن رو خودکار باز میکنه\n` +
    `• عددها تعداد مین‌های اطراف رو نشون میدن\n` +
    `• عدد ٠ یعنی همه اطراف امن هستن\n\n` +
    `🏆 برنده شدن:\n` +
    `• وقتی همه سلول‌های بدون مین رو باز کنی بردی!\n\n` +
    `💀 باختن:\n` +
    `• اگر روی مین کلیک کنی میبازی!\n\n` +
    `🔄 بعد از تموم شدن بازی:\n` +
    `• دکمه 🔄 بازی جدید برای شروع دوباره\n` +
    `• دکمه 🏠 منو اصلی برای برگشت به اول`,
    Markup.inlineKeyboard([Markup.button.callback('🔙 برگشت', 'main_menu')])
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
  .then(() => console.log('🚀 Minesweeper PRO is running!'))
  .catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

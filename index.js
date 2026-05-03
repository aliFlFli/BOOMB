const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const SIZE = 5;
const MINES = 5;

const games = {};

// ================== GAME ==================
function createGame() {
  const size = SIZE * SIZE;

  const board = Array(size).fill(0);
  const revealed = Array(size).fill(false);

  let placed = 0;
  while (placed < MINES) {
    const i = Math.floor(Math.random() * size);
    if (board[i] !== '💣') {
      board[i] = '💣';
      placed++;
    }
  }

  function count(x, y) {
    let c = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
          if (board[nx * SIZE + ny] === '💣') c++;
        }
      }
    }

    return c;
  }

  const numbers = board.map((v, i) => {
    if (v === '💣') return '💣';
    const x = Math.floor(i / SIZE);
    const y = i % SIZE;
    return count(x, y);
  });

  return {
    board,
    numbers,
    revealed,
    alive: true,
    opened: 0
  };
}

// ================== UI ==================
function render(game) {
  const rows = [];

  for (let i = 0; i < SIZE; i++) {
    const row = [];

    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;

      let text = '⬜️';

      if (game.revealed[idx]) {
        if (game.board[idx] === '💣') text = '💣';
        else text = game.numbers[idx] === 0 ? '▫️' : String(game.numbers[idx]);
      }

      row.push(
        Markup.button.callback(text, `m_${idx}`)
      );
    }

    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
}

// ================== EXPLOSION ANIMATION ==================
async function explosion(ctx, game) {
  const frames = ['💣', '💥', '🔥', '💨', '💀'];

  for (let f of frames) {
    try {
      await ctx.editMessageText(
        `💣 Minesweeper\n\n${f} انفجار!`,
        render(game)
      );
    } catch (e) {}

    await new Promise(r => setTimeout(r, 250));
  }
}

// ================== START ==================
bot.start((ctx) => {
  ctx.reply(
    `👋 خوش اومدی!

💣 Minesweeper Bot

🎮 شروع بازی:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🚀 شروع بازی', 'start')]
    ])
  );
});

// ================== START GAME ==================
bot.action('start', (ctx) => {
  const chatId = ctx.chat.id;

  const game = createGame();
  games[chatId] = game;

  ctx.answerCbQuery();
  ctx.editMessageText('💣 بازی شروع شد!', render(game));
});

// ================== CLICK ==================
bot.action(/m_(\d+)/, async (ctx) => {
  const chatId = ctx.chat.id;
  const game = games[chatId];

  if (!game || !game.alive)
    return ctx.answerCbQuery('بازی فعال نیست');

  const idx = +ctx.match[1];

  if (game.revealed[idx])
    return ctx.answerCbQuery('قبلاً باز شده');

  game.revealed[idx] = true;

  // ================== MINE ==================
  if (game.board[idx] === '💣') {
    game.alive = false;

    await explosion(ctx, game);

    return ctx.editMessageText(
      '💥 باختی! روی مین رفتی',
      render(game)
    );
  }

  game.opened++;

  // ================== WIN ==================
  if (game.opened === SIZE * SIZE - MINES) {
    game.alive = false;

    return ctx.editMessageText(
      '🎉 بردی!',
      render(game)
    );
  }

  ctx.editMessageReplyMarkup(render(game).reply_markup);
  ctx.answerCbQuery();
});

// ================== LAUNCH ==================
bot.launch()
  .then(() => console.log('💣 Minesweeper with Explosion Running'))
  .catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

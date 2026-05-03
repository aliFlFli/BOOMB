const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const SIZE = 5;
const MINES = 5;

const games = {};

// ================== GAME CREATE ==================
function createGame() {
  const size = SIZE * SIZE;

  const board = Array(size).fill(0);
  const revealed = Array(size).fill(false);
  const flagged = Array(size).fill(false);

  // mines
  let placed = 0;
  while (placed < MINES) {
    const i = Math.floor(Math.random() * size);
    if (board[i] !== '💣') {
      board[i] = '💣';
      placed++;
    }
  }

  // count mines
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
    flagged,
    alive: true,
    opened: 0
  };
}

// ================== FLOOD FILL ==================
function reveal(game, idx) {
  if (game.revealed[idx] || game.flagged[idx]) return;

  game.revealed[idx] = true;
  game.opened++;

  if (game.numbers[idx] !== 0) return;

  const x = Math.floor(idx / SIZE);
  const y = idx % SIZE;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
        reveal(game, nx * SIZE + ny);
      }
    }
  }
}

// ================== UI ==================
function render(game) {
  const rows = [];

  for (let i = 0; i < SIZE; i++) {
    const row = [];

    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;

      let text = '⬜️';

      if (game.flagged[idx]) {
        text = '🚩';
      } else if (game.revealed[idx]) {
        if (game.board[idx] === '💣') text = '💣';
        else text = game.numbers[idx] === 0 ? '▫️' : String(game.numbers[idx]);
      }

      row.push(Markup.button.callback(text, `c_${idx}`));
    }

    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
}

// ================== START ==================
bot.start((ctx) => {
  ctx.reply(
    `💣 Minesweeper Pro

🎮 شروع بازی:
`,
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
bot.action(/c_(\d+)/, (ctx) => {
  const chatId = ctx.chat.id;
  const game = games[chatId];

  if (!game || !game.alive)
    return ctx.answerCbQuery('بازی فعال نیست');

  const idx = +ctx.match[1];

  // اگر قبلاً باز شده
  if (game.revealed[idx])
    return ctx.answerCbQuery('قبلاً باز شده');

  // اگر پرچم هست
  if (game.flagged[idx])
    return ctx.answerCbQuery('پرچم دارد');

  // مین
  if (game.board[idx] === '💣') {
    game.alive = false;
    game.revealed[idx] = true;

    return ctx.editMessageText('💥 باختی!', render(game));
  }

  // باز کردن (فِلاد فیل)
  reveal(game, idx);

  // برد
  if (game.opened === SIZE * SIZE - MINES) {
    game.alive = false;
    return ctx.editMessageText('🎉 بردی!', render(game));
  }

  ctx.editMessageReplyMarkup(render(game).reply_markup);
  ctx.answerCbQuery();
});

// ================== FLAG (long press simulation) ==================
bot.action(/flag_(\d+)/, (ctx) => {
  const chatId = ctx.chat.id;
  const game = games[chatId];

  if (!game || !game.alive)
    return ctx.answerCbQuery();

  const idx = +ctx.match[1];

  game.flagged[idx] = !game.flagged[idx];

  ctx.editMessageReplyMarkup(render(game).reply_markup);
  ctx.answerCbQuery('🚩');
});

bot.launch();
console.log('💣 Minesweeper PRO Running');

// ================== START ==================
bot.start((ctx) => {
  ctx.reply(
    `👋 خوش اومدی!\n\n💣 Minesweeper Bot\n\n🎮 برای شروع بازی روی دکمه زیر بزن:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🎮 شروع بازی', 'start_game')]
    ])
  );
});

// ================== START GAME ==================
bot.action('start_game', async (ctx) => {
  const chatId = ctx.chat.id;        // بهتره از این استفاده کنی

  const game = createGame();
  games[chatId] = game;

  await ctx.answerCbQuery('بازی شروع شد ✅');

  await ctx.editMessageText(
    '💣 بازی مین‌روب شروع شد!\n\nموفق باشی!',
    {
      reply_markup: render(game).reply_markup   // ← این خیلی مهمه
    }
  );
});

// ================== CLICK ==================
bot.action(/m_(\d+)/, async (ctx) => {
  const chatId = ctx.chat.id;
  const game = games[chatId];

  if (!game || !game.alive) {
    return ctx.answerCbQuery('بازی فعال نیست');
  }

  const idx = +ctx.match[1];

  if (game.revealed[idx]) {
    return ctx.answerCbQuery('قبلاً باز شده');
  }

  game.revealed[idx] = true;

  if (game.board[idx] === '💣') {
    game.alive = false;
    return ctx.editMessageText('💥 باختی! روی مین رفتی', {
      reply_markup: render(game).reply_markup
    });
  }

  game.opened++;

  if (game.opened === SIZE * SIZE - MINES) {
    game.alive = false;
    return ctx.editMessageText('🎉 تبریک! بردی!', {
      reply_markup: render(game).reply_markup
    });
  }

  // ادامه بازی
  await ctx.editMessageReplyMarkup(render(game).reply_markup);
  ctx.answerCbQuery(game.numbers[idx] === 0 ? 'خالی' : String(game.numbers[idx]));
});

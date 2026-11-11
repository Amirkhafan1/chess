/* i18n.js — Persian / English */
(function () {
  const D = {
    fa: {
      brand: 'شطرنج غیرممکن',
      newGame: 'بازی جدید', undo: 'برگشت', hint: 'راهنمایی', flip: 'چرخاندن', draw: 'پیشنهاد تساوی', resign: 'تسلیم', copyPgn: 'کپی PGN',
      downloadPgn: 'دانلود PGN', review: 'بررسی بازی', playAgain: 'بازی دوباره', cancel: 'انصراف', start: 'شروع بازی',
      moves: 'حرکات', settings: 'تنظیمات', boardTheme: 'رنگ صفحه', showLegal: 'نمایش حرکات مجاز', autoQueen: 'ارتقای خودکار به وزیر',
      thinkTime: 'زمان فکر ربات در سطح غیرممکن', chooseLevel: 'سطح ربات', chooseColor: 'رنگ تو', timeControl: 'ساعت',
      white: 'سفید', black: 'سیاه', random: 'تصادفی', promoteTo: 'ارتقا به',
      you: 'تو', robot: 'ربات', sfName: 'Stockfish', aiName: 'ربات داخلی',
      yourTurn: 'نوبت توست', robotTurn: 'ربات در حال فکر کردن…', inCheck: 'کیش!', gameOver: 'بازی تمام شد',
      lvl1: 'مبتدی', lvl2: 'آسان', lvl3: 'متوسط', lvl4: 'پیشرفته', lvl5: 'حرفه‌ای', lvl6: 'استاد', lvl7: 'غیرممکن',
      lvl7d: 'Stockfish با تمام قدرت', lvlD1: 'برای شروع و یادگیری', lvlD2: 'اشتباه می‌کند', lvlD3: 'بازیکن باشگاهی', lvlD4: 'جدی است', lvlD5: 'سطح استادی', lvlD6: 'استاد بزرگ',
      record: 'برد/مساوی/باخت',
      badgeSF: 'Stockfish · قدرت کامل', badgeAI: 'ربات داخلی', badgeLoad: 'در حال بارگذاری ربات…',
      badgeAItip: 'فایل‌های Stockfish پیدا نشد؛ با ربات داخلی (ضعیف‌تر) بازی می‌شود. راهنمای README را ببین.',
      youWin: 'بردی! 🎉', youLose: 'باختی', drawn: 'مساوی',
      r_checkmate: 'کیش‌ومات', r_stalemate: 'پات (بن‌بست)', r_insufficient: 'مهره‌ی کافی برای مات نیست', r_repetition: 'تکرار سه‌باره‌ی وضعیت',
      r_fifty: 'قانون ۵۰ حرکت', r_time: 'تمام شدن زمان', r_resign: 'تسلیم', r_agreed: 'توافق برای تساوی',
      emojiWin: '🏆', emojiLose: '🤖', emojiDraw: '🤝',
      overWinText: 'در برابر «{lvl}» پیروز شدی. حریف قدرتمندی بودی!', overLoseText: '«{lvl}» این‌بار برنده شد. یک بازی دیگر؟', overDrawText: 'با «{lvl}» مساوی کردی.',
      confirmResign: 'مطمئنی تسلیم می‌شوی؟', yes: 'بله', no: 'نه',
      drawAccepted: 'ربات پیشنهاد تساوی را پذیرفت.', drawDeclined: 'ربات پیشنهاد تساوی را رد کرد.',
      copied: 'کپی شد ✓', hintThinking: 'در حال یافتن بهترین حرکت…', hintShown: 'فلش آبی بهترین حرکت است',
      noUndo: 'حرکتی برای برگشت نیست', engineErr: 'خطا در ربات؛ به ربات داخلی تغییر کرد.',
      openingLabel: 'گشایش', startPos: 'شروع بازی',
      footer: 'قدرت‌گرفته از <a href="https://stockfishchess.org" target="_blank" rel="noopener">Stockfish</a> (GPLv3) — اجرا کاملاً در مرورگر شما.',
      evalTitle: 'ارزیابی موتور', timeoutLose: 'زمانت تمام شد', timeoutWin: 'زمان ربات تمام شد'
    },
    en: {
      brand: 'Impossible Chess',
      newGame: 'New game', undo: 'Undo', hint: 'Hint', flip: 'Flip', draw: 'Offer draw', resign: 'Resign', copyPgn: 'Copy PGN',
      downloadPgn: 'Download PGN', review: 'Review game', playAgain: 'Play again', cancel: 'Cancel', start: 'Start game',
      moves: 'Moves', settings: 'Settings', boardTheme: 'Board theme', showLegal: 'Show legal moves', autoQueen: 'Always promote to queen',
      thinkTime: 'Robot think time at Impossible', chooseLevel: 'Robot level', chooseColor: 'Your color', timeControl: 'Clock',
      white: 'White', black: 'Black', random: 'Random', promoteTo: 'Promote to',
      you: 'You', robot: 'Robot', sfName: 'Stockfish', aiName: 'Built-in bot',
      yourTurn: 'Your move', robotTurn: 'Robot is thinking…', inCheck: 'Check!', gameOver: 'Game over',
      lvl1: 'Beginner', lvl2: 'Easy', lvl3: 'Medium', lvl4: 'Advanced', lvl5: 'Expert', lvl6: 'Master', lvl7: 'Impossible',
      lvl7d: 'Stockfish at full power', lvlD1: 'Just starting out', lvlD2: 'Makes mistakes', lvlD3: 'Club player', lvlD4: 'Serious', lvlD5: 'Master strength', lvlD6: 'Grandmaster',
      record: 'W/D/L',
      badgeSF: 'Stockfish · full power', badgeAI: 'Built-in bot', badgeLoad: 'Loading robot…',
      badgeAItip: 'Stockfish files not found — playing against the (weaker) built-in bot. See the README.',
      youWin: 'You won! 🎉', youLose: 'You lost', drawn: 'Draw',
      r_checkmate: 'Checkmate', r_stalemate: 'Stalemate', r_insufficient: 'Insufficient material', r_repetition: 'Threefold repetition',
      r_fifty: 'Fifty-move rule', r_time: 'Time out', r_resign: 'Resignation', r_agreed: 'Draw by agreement',
      emojiWin: '🏆', emojiLose: '🤖', emojiDraw: '🤝',
      overWinText: 'You beat “{lvl}”. Impressive!', overLoseText: '“{lvl}” wins this time. Another game?', overDrawText: 'You drew against “{lvl}”.',
      confirmResign: 'Really resign?', yes: 'Yes', no: 'No',
      drawAccepted: 'The robot accepted your draw offer.', drawDeclined: 'The robot declined your draw offer.',
      copied: 'Copied ✓', hintThinking: 'Finding the best move…', hintShown: 'The blue arrow is the best move',
      noUndo: 'Nothing to undo', engineErr: 'Engine error — switched to the built-in bot.',
      openingLabel: 'Opening', startPos: 'Starting position',
      footer: 'Powered by <a href="https://stockfishchess.org" target="_blank" rel="noopener">Stockfish</a> (GPLv3) — runs entirely in your browser.',
      evalTitle: 'Engine evaluation', timeoutLose: 'You ran out of time', timeoutWin: 'Robot ran out of time'
    }
  };
  let lang = 'fa';
  try {
    lang = localStorage.getItem('ic_lang') || ((navigator.language || 'en').toLowerCase().startsWith('fa') ? 'fa' : 'en');
  } catch (e) { lang = ((navigator.language || 'en').toLowerCase().startsWith('fa')) ? 'fa' : 'en'; }
  if (!D[lang]) lang = 'fa';

  const I18N = {
    get lang() { return lang; },
    t(key, vars) {
      let s = (D[lang] && D[lang][key]) || D.en[key] || key;
      if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
      return s;
    },
    setLang(l) {
      lang = l;
      try { localStorage.setItem('ic_lang', l); } catch (e) { /* ignore */ }
      I18N.apply();
    },
    apply() {
      const html = document.documentElement;
      html.lang = lang; html.dir = lang === 'fa' ? 'rtl' : 'ltr';
      document.title = lang === 'fa' ? 'شطرنج غیرممکن — با قوی‌ترین ربات شطرنج دنیا بازی کن' : 'Impossible Chess — Play the strongest chess engine in the world';
      document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = I18N.t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = I18N.t(el.dataset.i18nHtml); });
      const b = document.getElementById('btnLang'); if (b) b.textContent = lang === 'fa' ? 'EN' : 'فا';
      document.dispatchEvent(new CustomEvent('langchange'));
    }
  };
  window.I18N = I18N;
})();

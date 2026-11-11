/* تنظیمات سایت — این فایل را می‌توانی بدون دست‌زدن به بقیه‌ی کدها تغییر بدهی */
window.CHESS_CONFIG = {
  // مسیر فایل‌های Stockfish (بعد از اجرای setup-engine.py خودکار ساخته می‌شوند)
  stockfishJs: 'engine/stockfish-19-lite-single.js',
  // مدت فکر ربات در سطح «غیرممکن» (میلی‌ثانیه). کاربر هم می‌تواند از تنظیمات عوضش کند.
  impossibleMovetimeMs: 3000,
  // حداکثر زمانی که منتظر بارگذاری Stockfish می‌مانیم (میلی‌ثانیه)
  engineLoadTimeoutMs: 30000
};

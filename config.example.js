// Másold le ezt a fájlt "config.js" néven, és töltsd ki a saját adataiddal.
// A Supabase értékeket a Supabase Dashboard → Project Settings → API oldalon találod.
// APP_USER: a bejelentkezéskor beírható rövid felhasználónév.
// APP_EMAIL: a Supabase Auth felhasználó e-mail címe (Dashboard → Authentication → Users).
// Jelszót NEM kell (és nem is szabad) itt tárolni — azt a Supabase Auth ellenőrzi.
// A config.js-t a .gitignore kizárja, így nem kerül a repóba.
window.KANBAN_CONFIG = {
  SUPABASE_URL: "https://<PROJECT_REF>.supabase.co",
  SUPABASE_KEY: "<SUPABASE_PUBLISHABLE_KEY>",
  APP_USER: "<APP_USER>",
  APP_EMAIL: "<AUTH_USER_EMAIL>",
};

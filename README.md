# 📋 Kanban Board

Webalapú Kanban tábla alkalmazás feladatok vizuális kezelésére. Tisztán kliensoldali
(HTML + CSS + vanilla JS) — nincs szükség szerveroldali alkalmazásra (Node.js, Python),
az adatokat közvetlenül a [Supabase](https://supabase.com) REST API-ján keresztül kezeli.

## Funkciók

- **4 oszlopos tábla**: To Do · In Progress · Validation · Completed
- **Drag & drop**: ticketek húzhatók az oszlopok között és oszlopon belül is átrendezhetők
- **Teljes CRUD**: ticket létrehozás, szerkesztés, törlés (megerősítéssel)
- **Prioritáskezelés**: Alacsony / Közepes / Magas szint, színes jelzéssel
- **Oszlopszintű hozzáadás**: minden oszlop aljáról közvetlenül hozzáadható ticket
- **Optimista UI-frissítés**: a drag & drop és a törlés azonnal látszik; hálózati hiba
  esetén az alkalmazás visszaállítja az előző állapotot
- **Toast értesítések**: minden műveletről visszajelzés
- **Reszponzív**: vízszintesen görgethető tábla, kis képernyőn is használható
- **Dark mode**: sötét téma, kék fő színnel
- **Bejelentkezés (Supabase Auth)**: induláskor felugró ablak kér felhasználónevet
  és jelszót; a jelszót a Supabase Auth szervere ellenőrzi, az adatbázist RLS
  védi — bejelentkezés nélkül az API sem ad ki adatot. A munkamenetet a
  supabase-js kezeli (automatikus token-frissítéssel), a fejlécből ki lehet
  jelentkezni

## Fájlok

| Fájl                | Szerep                                             |
|---------------------|----------------------------------------------------|
| `index.html`        | Fő belépési pont, a teljes UI váza                 |
| `styles.css`        | Sötét téma, oszlopok, kártyák, modalok, toastok    |
| `app.js`            | Alkalmazáslogika: CRUD, drag & drop, renderelés    |
| `config.example.js` | Konfigurációs sablon (ebből készül a `config.js`)  |

## Beüzemelés

1. **Klónozd a repót**, majd készítsd el a helyi konfigurációt:

   ```bash
   git clone https://github.com/zjambor/kanban-board.git
   cd kanban-board
   cp config.example.js config.js
   ```

2. **Hozz létre egy Supabase Auth felhasználót**
   (Dashboard → Authentication → Users → *Add user*, az e-mailt jelöld megerősítettnek),
   majd **töltsd ki a `config.js`-t**:
   - `SUPABASE_URL` — a Supabase projekt URL-je (Dashboard → Project Settings → API)
   - `SUPABASE_KEY` — a *publishable* (nyilvános) API kulcs
   - `APP_USER` — a login ablakban használható rövid felhasználónév
   - `APP_EMAIL` — az Auth felhasználó e-mail címe (a felhasználónév erre képződik le)

   > Jelszó **nincs** a konfigurációban: a bejelentkezést a Supabase Auth végzi,
   > a jelszót a szerver ellenőrzi. A `config.js` és a `.env` a `.gitignore`-ban
   > szerepel; titkos (secret/service) kulcsot **soha** ne tegyél a kliensbe!

3. **Nyisd meg az `index.html`-t** böngészőben — nincs build lépés és nem kell
   szerver sem. (Opcionálisan bármilyen statikus kiszolgálóval is futtatható,
   pl. `npx serve .`)

## Adatmodell

Az alkalmazás a Supabase `public.tickets` táblát használja:

```sql
create table public.tickets (
  id          serial primary key,
  title       varchar(200) not null,
  description text default '',
  status      varchar(50)  not null default 'TODO',     -- TODO | IN_PROGRESS | VALIDATION | COMPLETED
  priority    varchar(20)  not null default 'MEDIUM',   -- LOW | MEDIUM | HIGH
  order_index integer default 0,
  created_at  timestamp default now(),
  updated_at  timestamp default now()                   -- trigger frissíti módosításkor
);
```

Az `updated_at` mezőt adatbázis-trigger frissíti minden módosításkor, a `status`
és a `priority` értékeit CHECK constraint védi.

### Jogosultságok (RLS)

A táblán RLS (Row Level Security) aktív, és a hozzáférés bejelentkezéshez kötött:

- az `anon` szerepkörtől minden jog vissza van vonva — a nyilvános API kulcs
  önmagában **semmilyen** adathoz nem fér hozzá (401);
- a CRUD policy-k az `authenticated` szerepkörre vonatkoznak, és az
  `auth.uid()`-t egy konkrét Auth felhasználóhoz kötik, így egy esetlegesen
  önregisztrált idegen fiók sem lát semmit. Saját telepítésnél írd át a
  policy-kban szereplő UUID-t a saját Auth felhasználód azonosítójára.

## Architektúra

```
Böngésző (index.html + app.js)
        │  supabase-js (CDN)
        ├──► Supabase Auth  (bejelentkezés, JWT, token-frissítés)
        ▼
Supabase REST API (PostgREST + RLS)  ──►  PostgreSQL (public.tickets)
```

- Az adatműveletek a hivatalos `@supabase/supabase-js` klienssel történnek,
  amely a Supabase REST API-ját hívja — ezért nem kell saját backend.
- A drag & drop a natív HTML5 Drag and Drop API-ra épül, könyvtárak nélkül.
- Mozgatáskor az UI azonnal frissül (optimista frissítés), a változott sorok
  státusza és `order_index`-e a háttérben íródik az adatbázisba; hiba esetén
  a tábla visszaáll és hibaüzenet jelenik meg.

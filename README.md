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
- **Bejelentkezés**: induláskor felugró ablak kér felhasználónevet és jelszót;
  a munkamenet a lap bezárásáig él, a fejlécből ki lehet jelentkezni

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

2. **Töltsd ki a `config.js`-t**:
   - `SUPABASE_URL` — a Supabase projekt URL-je (Dashboard → Project Settings → API)
   - `SUPABASE_KEY` — a *publishable* (nyilvános) API kulcs
   - `APP_USER`, `APP_PASSWORD` — az alkalmazás bejelentkezési adatai
     (ezekkel enged be a felugró login ablak)

   > A `config.js` és a `.env` a `.gitignore`-ban szerepel, így hitelesítő adat
   > nem kerül a repóba. Titkos (secret/service) kulcsot **soha** ne tegyél ide!
   >
   > **Fontos:** a bejelentkezés kliensoldali kapu — a felületet védi, de aki a
   > gépen hozzáfér a `config.js`-hez vagy a nyilvános API kulcshoz, az az adatokat
   > közvetlenül is elérheti. Valódi, többfelhasználós védelemhez Supabase Auth
   > + szigorított RLS szabályok javasoltak.

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
és a `priority` értékeit CHECK constraint védi. A táblán RLS (Row Level Security)
aktív; a demó jogosultsági szabályai a nyilvános (anon) kulccsal teljes CRUD-ot
engednek — éles használathoz szigorítsd a szabályokat (pl. bejelentkezéshez kötve).

## Architektúra

```
Böngésző (index.html + app.js)
        │  supabase-js (CDN)
        ▼
Supabase REST API (PostgREST)  ──►  PostgreSQL (public.tickets)
```

- Az adatműveletek a hivatalos `@supabase/supabase-js` klienssel történnek,
  amely a Supabase REST API-ját hívja — ezért nem kell saját backend.
- A drag & drop a natív HTML5 Drag and Drop API-ra épül, könyvtárak nélkül.
- Mozgatáskor az UI azonnal frissül (optimista frissítés), a változott sorok
  státusza és `order_index`-e a háttérben íródik az adatbázisba; hiba esetén
  a tábla visszaáll és hibaüzenet jelenik meg.

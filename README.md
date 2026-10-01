# Inl 3 - Grupparbete

Ett system för patientjournaler där varje åtkomst till en journal loggas och sparas i en blockkedja, så att det alltid går att se vem som har tittat på vad. Medicinska uppgifter lagras i en SQL-databas, medan åtkomsthändelser (vem, när, vilken patient, vilken åtgärd) loggas till en blockkedja som går att verifiera i efterhand.

Systemet har fem roller: läkare, sjuksköterska/ambulanspersonal, vårdcentral, patient och obehörig. Varje roll ser olika saker: personal kan söka upp patienter och skriva anteckningar, en patient hamnar direkt på sin egen journal och ser bara anteckningar märkta "alla", och en obehörig nekas åtkomst helt.

Projektet körs som två separata servrar (simulerar två sjukhus), som synkar sina blockkedjor med varandra via WebSocket.

## Tech Stack

- Node.js / Express
- SQLite
- React (utan bundler)
- WebSocket (realtidsuppdatering och P2P-synk mellan servrar)
- express-session

## Installation

1. Klona repot:
```bash
   git clone https://github.com/MaxWK96/Grupp-9.git
   cd Grupp-9
```

2. Installera beroenden:
```bash
   npm install
```

3. Starta servern:
```bash
   npm run dev
```
   Vänta tills terminalen visar `Tables are ready` och `Server running on port 3001`.

4. Fyll databasen med testdata (bara första gången, eller efter att `database.db` raderats):
```bash
   npm run seed
```

5. Öppna `http://localhost:3001` i webbläsaren.

### Köra två servrar samtidigt (simulerar två sjukhus)

**Windows (PowerShell):**
```powershell
$env:PORT=3001; npm run dev
```
```powershell
$env:PORT=3002; npm run dev
```

**Mac/Linux:**
```bash
PORT=3001 npm run dev
```
```bash
PORT=3002 npm run dev
```

## Testkonton

Alla lösenord är `1234`.

| Användarnamn | Roll |
|---|---|
| drsmith | Läkare |
| nursejoy | Sjuksköterska |
| clinic1 | Vårdcentral |
| johndoe | Patient |
| randomguy | Obehörig |

## Databasstruktur

Databasen är SQLite och består av fyra tabeller:

- **users** – alla som kan logga in, med roll
- **patients** – patientinformation, kopplad till en användare om patienten har ett eget konto
- **notes** – medicinska anteckningar, med en synlighetsnivå (privat/personal/alla)
- **access_logs** – lokal kopia av åtkomsthändelser, för snabb visning i journalen (den officiella, manipuleringssäkra loggen ligger i blockkedjan)

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  personal_number TEXT NOT NULL UNIQUE,
  user_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  visibility TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);
```

Databasen skapas automatiskt från detta schema första gången servern startar.

## Authors

| Namn | Ansvar |
|---|---|
| Phoenix | Backend/API (auth, routes, databas) |
| Max | Blockkedja och signering |
| Sveinung | P2P-synkronisering och WebSocket |
| Max | Frontend |

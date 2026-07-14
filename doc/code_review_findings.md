# Code Review Findings — sync_server_ts

Data: 2026-07-13

---

## 🔴 HIGH — Bug & Security

### H1 — JWT refresh token verificato con chiave errata + race condition

**File:** `src/routes/login.ts:100-115`

Il refresh token JWT è verificato con `configJson.server.secret_key` invece di `secret_key_refresh`. Il token è firmato con `secret_key_refresh` (vedi `authorization.ts:164`), quindi la verifica fallisce sempre. Inoltre, la callback asincrona di `jwt.verify` crea una race: il codice controlla `res.statusCode` prima che la callback lo imposti, procedendo a creare un nuovo token anche per token non validi.

**Fix:** Usare `secret_key_refresh` per la verifica e passare a API sincrona (try/catch) o Promise invece della callback.

---

### H2 — Placeholder SQL errato: `?` invece di `$1`

**File:** `src/repositories/authentication_repository.ts:37`

```sql
WHERE ut.token = ?
```

La libreria `pg` richiede `$1`, `$2` come placeholder. Il placeholder `?` è stile MySQL. La funzione `getUserIdFromToken` è completamente non funzionante a runtime.

**Fix:** Sostituire `?` con `$1`.

---

### H3 — `await` mancanti su `setUserClient`

**File:** `src/repositories/sync_repository.ts:179, 199`

Le chiamate a `UserRepository.getInstance().setUserClient(realm, userClient)` non hanno `await`. Il database non viene aggiornato prima che la funzione ritorni, causando race condition sullo stato `syncing`.

**Fix:** Aggiungere `await` prima di ogni chiamata.

---

### H4 — Errori di database silenziosamente inghiottiti

**File:** `src/repositories/database_repository.ts:71-74`

Il `catch` logga l'errore ma non rilancia — la funzione restituisce `undefined`. I chiamanti non distinguono tra "nessun risultato" e "errore database". L'applicazione procede con dati corrotti.

**Fix:** Rilanciare l'errore dopo averlo loggato, o restituire un oggetto errore consistente.

---

### H5 — Password hashing con SHA-512 (senza key stretching)

**File:** `src/helpers/utils.ts:9-10`

SHA-512 è un hash veloce e hardware-accelerato, attaccabile a miliardi di tentativi/secondo con GPU. Non è un password hashing function.

**Fix:** Sostituire con `bcrypt`, `crypto.scryptSync` (built-in Node), o `argon2`.

---

### H6 — Path traversal in chunk processor

**File:** `src/repositories/chunk_processor.ts:28-29`

`clientId` (da URL params) e `syncId` (da request body) usati direttamente in `path.join()` per costruire percorsi file. Un valore come `../../etc/passwd` permette scrittura/lettura file arbitrari. Combinato con `rm(..., { recursive: true, force: true })` alla linea 39, permette cancellazione directory arbitraria.

**Fix:** Validare `clientId` e `syncId` con pattern alfanumerico stretto. Usare `path.resolve()` e verificare che il risultato sia dentro `TEMP_DIR`.

---

### H7 — `Math.random()` per generazione PIN

**File:** `src/repositories/user_repository.ts:314, 324-326`

PIN generati con `Math.random()` (Xorshift128+, prevedibile). Un attaccante che osserva pochi PIN può predire i successivi, compromettendo il reset password.

**Fix:** Usare `crypto.randomInt(100000, 999999)` dal modulo `crypto` di Node.js.

---

### H8 — `sendMail` fire-and-forget + transport mai chiuso

**File:** `src/helpers/email_client.ts:43-45`

```typescript
smtpTransport.sendMail(updatedData).then(...)
```

La Promise non è attendata. La funzione ritorna immediatamente, gli errori sono silenziosi (solo `console.info` su successo). Il transport SMTP non viene mai chiuso.

**Fix:** `await smtpTransport.sendMail(updatedData)` e chiudere il transport dopo l'invio. Propagare errori al chiamante.

---

### H9 — Race condition nel locking pull sync (check-then-act)

**File:** `src/repositories/sync_repository.ts:34-45`

Due richieste pull concorrenti per lo stesso client caricano entrambe `syncing == null` dal DB, poi entrambe passano il controllo perché il DB non è stato ancora aggiornato.

**Fix:** Usare operazione atomica: `UPDATE ... SET syncing = $1 WHERE syncing IS NULL AND clientid = $2` e verificare se una riga è stata aggiornata.

---

### H10 — Information disclosure su email enumeration

**File:** `src/routes/login.ts:152-157`, `src/repositories/user_repository.ts:306-307`

`generatePin` per email non registrata lancia `throw "User not found!"` → risposta 500. Un attaccante enumera email valide osservando 200 vs 500.

**Fix:** Rispondere sempre 200 con messaggio generico "Se l'email è registrata, un PIN è stato inviato". Loggare il dettaglio lato server.

---

### H11 — N+1 query in `pull()` e `push()`

**File:** `src/repositories/sync_repository.ts:72-83, 115-124`

`pull()` esegue una query `getRowDataValue()` per ogni server change in loop seriale. Con 1000 cambiamenti → 1000 round-trip DB.
`push()` esegue `processData` + `setSyncData` per ogni change → 2000 round-trip DB per 1000 cambiamenti.

**Fix:** Usare `SELECT json FROM data WHERE rowguid = ANY($1)` per batching e multi-row `INSERT INTO ... VALUES (...), (...), (...)`.

---

## 🟡 MEDIUM

### M1 — Fallback realm "default" bypassa isolamento

**File:** `src/repositories/database_repository.ts:17-22`

Per realm sconosciuto (es. `/login/FakeRealm`), `getPool` fa fallback a `pools.get("default")!`. Se esiste un pool "default", un attaccante bypassa l'isolamento dei realm.

**Fix:** Validare il realm contro le chiavi configurate prima del fallback, o ritornare 404.

---

### M2 — Operazioni "D" (delete) non eliminano mai dal DB

**File:** `src/repositories/sync_repository.ts:232-233`

Quando `operation == "D"` e la riga esiste già in `data`, `processData` ritorna senza emettere DELETE SQL. I dati persistono per sempre.

**Fix:** Eseguire `DELETE FROM data WHERE rowguid = $1` per operazioni "D", o aggiungere una pulizia periodica.

---

### M3 — Logger stampa ogni messaggio due volte

**File:** `src/helpers/logger.ts:25`

`console.log(msg)` dentro la funzione `printf` di winston esegue per ogni log. Il messaggio viene anche scritto su file dal transport.

**Fix:** Rimuovere `console.log(msg)` dalla format function.

---

### M4 — Race condition nell'assemblaggio chunk

**File:** `src/repositories/chunk_processor.ts:59-69`

Due richieste chunk concorrenti per lo stesso `syncId` possono contare lo stesso set di file `chunk_*`, determinare entrambe di essere l'ultimo chunk, e tentare `renameSync` → fallisce con ENOENT.

**Fix:** Usare un lock file o operazione atomica per garantire che un solo request proceda all'assemblaggio.

---

### M5 — Body limit 50MB senza rate limiting

**File:** `src/main.ts:31-32`

`express.json({ limit: '50mb' })` — un singolo request può allocare 50MB+. Nessun rate limiting su login, registration, password reset, sync.

**Fix:** Ridurre il limite (es. 10-20MB) e aggiungere `express-rate-limit` per-endpoint.

---

### M6 — `lastrefresh!` — token mai scade se undefined

**File:** `src/middleware/authorization.ts:45`, `src/routes/login.ts:139`

`userToken.lastrefresh!` — se `undefined`, `NaN > 24` è `false`, quindi il token non viene mai considerato scaduto.

**Fix:** Aggiungere null check: `if (userToken.lastrefresh == null || differenceInHours > 24)`.

---

### M7 — Nessun header di sicurezza

**File:** `src/main.ts` (mancante)

Nessun middleware `helmet`. Manca `X-Content-Type-Options`, `X-Frame-Options`, etc.

**Fix:** Aggiungere `helmet` middleware.

---

### M8 — Race condition DELETE+INSERT in `generatePin`

**File:** `src/repositories/user_repository.ts:310-316`

Due richieste concorrenti possono entrambe eseguire DELETE, poi entrambe INSERT. L'ultima sovrascrive il PIN della prima.

**Fix:** Usare `INSERT ... ON CONFLICT (userid) DO UPDATE` (UPSERT) invece di DELETE + INSERT.

---

### M9 — `push()` senza transazione — dati parziali su crash

**File:** `src/repositories/sync_repository.ts:113-144`

Scritture su `data` e `sync_data` in query separate senza transazione. Crash a metà push → dati inconsistenti.

**Fix:** Avvolgere il loop push in `BEGIN ... COMMIT/ROLLBACK`.

---

### M10 — No global Express error handler

**File:** `src/main.ts` (mancante)

Express 4.x non cattura Promise rejection da async route handlers. Qualsiasi `throw` in route async crasha il processo in Node 15+.

**Fix:** Aggiungere middleware error handler globale e/o `express-async-errors`.

---

## 🟢 LOW — Code Quality & Maintainability

### L1 — `checkSimpleToken` non verifica prefisso "Bearer "

**File:** `src/middleware/authorization.ts:28-36`

Controlla solo se `authorization` è truthy, poi chiama `token.substring(7)`. Header `"Basic xyz"` estrarrebbe `" xyz"` come token.

**Fix:** Aggiungere `!token.startsWith("Bearer ")` come nella versione JWT.

---

### L2 — `throw "stringa"` invece di `throw new Error(...)`

**File:** `src/repositories/user_repository.ts:258, 262, 307`

`throw "New password is missing!"` e `throw "User not found!"` — le stringhe perdono stack trace.

**Fix:** Usare `throw new Error(...)`.

---

### L3 — `for...in` senza `hasOwnProperty` su config

**File:** `src/main.ts:54`

`for (let realm in configJson.db.realms)` itera anche proprietà prototype. Se l'oggetto config è modificato/inquinato, realm inaspettati possono apparire.

**Fix:** Usare `for (const realm of Object.keys(configJson.db.realms))`.

---

### L4 — `fs.renameSync` blocca event loop

**File:** `src/repositories/chunk_processor.ts:56, 67`

`fs.renameSync` in metodi async blocca l'event loop. Sotto carico concorrente, causa picchi di latenza.

**Fix:** Usare `await fsPromises.rename()`.

---

### L5 — CockroachDB: primary key su colonna inesistente

**File:** `database_cockroachdb_script.sql:189-195`

La tabella `users` ha colonna `userid` ma la primary key è `CONSTRAINT users_pkey PRIMARY KEY (id ASC)`. La colonna `id` non esiste.

**Fix:** Rinominare la colonna in `id` o aggiornare la primary key a `userid`.

---

### L6 — `morganStream` definito ma inutilizzato

**File:** `src/main.ts:23-25`

Variabile `morganStream` creata ma l'unico consumer (`app.use(morgan(...))`) è commentato.

---

### L7 — `FROM users` hardcoded invece di `Tables.User`

**File:** `src/repositories/user_repository.ts:156`

La query usa `FROM users` direttamente. Se il nome tabella cambia in `Tables`, questa query si rompe silenziosamente.

---

### L8 — Realm parametro tipizzato come `any`

**File:** `src/repositories/sync_repository.ts:26, 101, 154, 192, 221` e `src/repositories/user_repository.ts:254`

`realm: any` invece di `realm: string`, bypassando il type checking.

---

### L9 — `next: any` invece di `NextFunction`

**File:** `src/middleware/authorization.ts:115`

---

### L10 — Tipo di ritorno `String` (oggetto) invece di `string` (primitivo)

**File:** `src/middleware/authorization.ts:150, 160`

```typescript
function generateJWTToken(...): String
function generateRefreshJWTToken(...): String
```

---

### L11 — Import CJS/ESM misti

**File:** `src/main.ts`

Mixa `import * as cors` (ESM), `const compression = require('compression')` (CJS), `import morgan = require('morgan')` (CJS import assignment).

---

### L12 — `process.setMaxListeners(50)` senza commento

**File:** `src/main.ts:60`

Nessuna spiegazione del perché 50 è necessario. Maschera potenziali memory leak.

---

### L13 — Emoji nei log strutturati

**File:** `src/repositories/chunk_processor.ts:80`, `src/routes/sync.ts:15, 60`

Emoji (`❌`, `🔄`) in log possono causare problemi di encoding in sistemi di aggregazione (ELK, Splunk).

---

### L14 — `userid` non inizializzato in destructuring

**File:** `src/routes/login.ts:101`

```typescript
let userid, email = null;
```
Solo `email` è inizializzato a `null`; `userid` rimane `undefined`.

---

### L15 — `(req as any).userToken` e `(req as any).user` sparsi

**File:** `src/middleware/authorization.ts:50, 89, 134`, `src/routes/login.ts:56`

Proprietà custom attaccate a `Request` via `as any`. Si perde type safety.

**Fix:** Usare TypeScript declaration merging per estendere `express.Request`.

---

### L16 — Config caricato in 4 file separati

**File:** `src/main.ts:3`, `src/middleware/authorization.ts:4`, `src/helpers/email_client.ts:5`, `src/repositories/user_repository.ts:2`

Ogni file carica `config.json` indipendentemente. Un cambiamento alla struttura richiede aggiornare 4 import.

---

### L17 — `catch (error)` senza type narrowing

**File:** `src/middleware/authorization.ts:95`, `src/routes/login.ts:108`

Accesso a `error.message` su tipo `unknown` — TypeScript lo segnala come errore.

---

### L18 — Codice duplicato push/pull chunk processing

**File:** `src/routes/sync.ts:17-42` e `57-85`

Il branch `multiple` per chunk processor + progress check è identico tra push e pull handler.

---

### L19 — Nessun `/healthz` o readiness endpoint

**File:** `src/routes/base.ts`

Solo un messaggio di benvenuto. Orchestrator container e load balancer non hanno un endpoint per health check.

---

### L20 — Pool configurato senza parametri

**File:** `src/repositories/database_repository.ts:36`

`new Pool({ connectionString })` usa default: max 10 connessioni, nessun idle timeout, nessun connection timeout.

**Fix:** Aggiungere `max`, `idleTimeoutMillis`, `connectionTimeoutMillis` da config.

---

### L21 — Template email letto da disco a ogni invio

**File:** `src/helpers/email_client.ts:32`

`fs.readFileSync` + Handlebars.compile per ogni email. Le email ripetute non beneficiano di cache.

**Fix:** Cache dei template compilati in una `Map<string, TemplateDelegate>`.

---

### L22 — Trasporto SMTP creato a ogni email

**File:** `src/helpers/email_client.ts:23-29`

Nuovo transport nodemailer (TCP + TLS handshake) creato per ogni email. Aggiunge 100-500ms overhead per email.

**Fix:** Creare il transport una volta a livello di modulo.

---

### L23 — `computeTotalSize` chiamato per ogni chunk — O(n²) I/O

**File:** `src/repositories/chunk_processor.ts:64`

Ogni chunk ricevuto esegue `fsPromises.readdir` + `fsPromises.stat` per ogni file nella directory. Con N chunk: N readdir + N² stat.

**Fix:** Mantenere contatore `receivedBytes` in memoria, incrementandolo a ogni chunk scritto.

---

### L24 — Assenza validazione body request

**File:** Tutti i route handler

`req.body` è castato con `as` senza validare che il payload esista o sia ben formato. Campi mancanti causano errori criptici a valle.

**Fix:** Aggiungere validazione runtime con `zod`, `joi`, o guard manuali.

---

## Riepilogo

| Severità | Conteggio |
|----------|-----------|
| 🔴 HIGH  | 11 |
| 🟡 MEDIUM | 10 |
| 🟢 LOW    | 24 |

**Azioni prioritarie:**
1. Fix placeholder SQL (`?` → `$1`) in `authentication_repository.ts` — auth completamente rotto
2. Fix JWT refresh token — chiave sbagliata + race condition
3. Aggiungere `await` a tutte le `setUserClient` in `sync_repository.ts`
4. Rilanciare errori in `database_repository.query()` invece di inghiottirli
5. Sostituire SHA-512 con bcrypt/scrypt/argon2 in `utils.ts`
6. Sanitizzare path in `chunk_processor.ts`
7. Rimpiazzare `Math.random()` con `crypto.randomInt()` per PIN
8. Aggiungere global Express error handler
9. Batching query N+1 in `sync_repository.ts`
10. Aggiungere transazione in `push()` e UPSERT in `generatePin()`

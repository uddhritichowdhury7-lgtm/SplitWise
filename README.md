# SplitWise — Group + Personal Finance

A local full-stack expense management app with two separate workspaces:

- **Group Finance:** groups, members, shared expenses, equal splitting, balances, payment allocation records, encrypted group chat, and a rule-based SplitSmart assistant.
- **Personal Finance:** monthly income, expenses, category budgets, shopping balance, and a virtual protected-savings target.

## First-time setup (Windows)

1. Install Node.js LTS (Node 20 or newer) from https://nodejs.org/.
2. Extract this ZIP to a normal folder, for example `C:\Users\YourName\Desktop\SplitWise`.
3. Double-click **RUN_ME_FIRST.bat**.
4. Wait while it installs packages, creates the local SQLite database, generates the encryption key, and seeds demo accounts.
5. When the server says it is running, open **http://localhost:5000**.

For later runs, double-click **START_SPLITWISE.bat**.

## Demo login

- Aarav: `aarav@example.com`
- Priya: `priya@example.com`
- Rohan: `rohan@example.com`
- Password for all demo accounts: `password123`

Use one account to sign in. The other two demo accounts are available to add to a group by email.

## Project structure

- `server.js` — Express API and server startup
- `routes/personal-finance.js` — private personal-finance API
- `public/index.html`, `app.js`, `styles.css` — Group Finance workspace
- `public/personal.html`, `personal.js`, `personal.css` — Personal Finance workspace
- `prisma/schema.prisma` — SQLite data model
- `prisma/seed.js` — demo data
- `lib/crypto.js` — AES-256-GCM chat encryption

## Important implementation notes

- Savings protection is a **virtual budget reservation** inside the app. It does not freeze or transfer money in a real bank account.
- Standard payment records and allocations are stored in the app; recording an allocation does not itself transfer money.
- Live Razorpay Route checkout requires an eligible/approved Razorpay Route account, linked recipient accounts, and credentials in `.env`. It is optional and is not configured by default.
- Chat messages are encrypted at rest with AES-256-GCM. This is not end-to-end encryption.
- The SplitSmart assistant uses simple rule-based summaries; it is not an LLM.
- The database is local SQLite (`prisma/dev.db`). Keep `.env` safe and do not change `CHAT_ENCRYPTION_KEY` after saving encrypted messages, or old messages cannot be decrypted.

## Stop the server

Press `Ctrl+C` in the terminal window running the server.

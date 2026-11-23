# SplitWise — Group Expense Sharing & Personal Finance Management

A full-stack finance management web application that helps users manage shared group expenses and individual monthly finances in one platform.

## Overview

SplitWise provides two separate workspaces:

- **Group Finance:** Manage groups, record shared expenses, calculate individual shares, track balances, record payments and communicate through encrypted group chat.
- **Personal Finance:** Track income, expenses, monthly category budgets and savings targets.

The application is built using Node.js, Express, Prisma ORM and SQLite, with a browser-based frontend.

## Features

### 1. User Authentication
- User registration and login.
- Password hashing using bcrypt.
- JWT-based authentication.
- Protected API endpoints.

### 2. Group Finance
- Create expense-sharing groups.
- Add members to groups.
- Record shared expenses.
- Calculate equal expense splits.
- View member balances.
- Track who owes money and who should receive money.

### 3. Payment Management
- Record payments between group members.
- Allocate payment amounts to multiple recipients.
- Update group balances based on recorded payment allocations.
- Optional Razorpay Route integration for eligible merchant accounts.

### 4. Group Chat
- Group-based messaging.
- AES-256-GCM encryption of messages at rest.

### 5. Personal Finance
- Record monthly income.
- Track individual expenses.
- Categorize spending.
- Set monthly category budgets.
- Set savings targets.
- Calculate remaining budget and available spending amounts.

### 6. SplitSmart Assistant
- Rule-based financial summaries and assistance.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | SQLite |
| ORM | Prisma |
| Authentication | JWT |
| Password Security | bcryptjs |
| Chat Encryption | AES-256-GCM |
| Payment Integration | Razorpay Route (optional) |

## Project Structure

```text
SplitWise/
│
├── lib/
│   ├── crypto.js
│   └── money.js
│
├── middleware/
│   └── auth.js
│
├── prisma/
│   ├── schema.prisma
│   └── seed.js
│
├── public/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── personal.html
│   ├── personal.js
│   └── personal.css
│
├── routes/
│   └── personal-finance.js
│
├── scripts/
│   └── prepare-env.js
│
├── tests/
│   └── money.test.js
│
├── server.js
├── package.json
├── README.md
├── RUN_ME_FIRST.bat
└── START_SPLITWISE.bat
```

## Installation and Setup

### Prerequisites
- Node.js 20 or newer.
- npm.
- Git.

### Windows Setup

1. Clone the repository:

```bash
git clone https://github.com/uddhritichowdhury7-lgtm/SplitWise.git
```

2. Open the project folder:

```bash
cd SplitWise
```

3. Install dependencies and initialize the application:

```bash
npm install
```

4. Prepare the environment, database and demo data using the provided `RUN_ME_FIRST.bat` script.

Alternatively, after configuring the environment, run:

```bash
npx prisma db push
npx prisma generate
npm run seed
npm start
```

5. Open the application:

```text
http://localhost:5000
```

For subsequent runs on Windows, use `START_SPLITWISE.bat`.

## Demo Accounts

The database seed script provides the following demonstration accounts:

| User | Email | Password |
|---|---|---|
| Aarav | aarav@example.com | password123 |
| Priya | priya@example.com | password123 |
| Rohan | rohan@example.com | password123 |

These are demonstration credentials only. Change or remove them before any production deployment.

## Testing

Run the available automated tests:

```bash
npm test
```

## Important Notes

- Payment allocation records do not independently transfer money.
- Live Razorpay Route transfers require an eligible approved merchant account, linked recipient accounts and valid API credentials.
- Savings targets are virtual budget reservations. They do not freeze or transfer funds in a bank account.
- Group chat messages are encrypted at rest; the implementation is not end-to-end encrypted.
- SplitSmart is a rule-based assistant, not an AI language model.
- The default database is local SQLite.
- Keep environment secrets private. Never commit `.env` or production credentials.

## Future Improvements

- Automated test coverage for API endpoints.
- Production database deployment.
- Improved financial analytics and visualizations.
- Role-based group administration.
- Enhanced payment reconciliation.
- Cloud deployment and multi-device access.

## Author

**Uddhriti Chowdhury**

B.Tech — Computer Science and Engineering

South Asian University

## Repository

[GitHub — SplitWise](https://github.com/uddhritichowdhury7-lgtm/SplitWise)

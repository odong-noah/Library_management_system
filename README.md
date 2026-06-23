# Hannah Library Management System

**Hannah School of Health Sciences, Iganga**
Full-stack Library Management System — PHP + MySQL + Vanilla JS + Bootstrap 5

---

## Default Login Credentials

| Username    | Password         | Role      |
| ----------- | ---------------- | --------- |
| `librarian` | `@Hannahlib2026` | Librarian |

> **Important:** Change passwords immediately after first login via phpMyAdmin or MySQL CLI:
>
> ```sql
>
> ```

> ```
> Generate hash with: `php -r "echo password_hash('NewPassword', PASSWORD_BCRYPT);"`
> ```

---

## Requirements

- PHP 7.4+ with extensions: `mysqli`, `session`, `json`
- MySQL 5.7+ or MariaDB 10.3+
- Apache with `mod_rewrite` enabled (for .htaccess)
- XAMPP / WAMP / LAMP stack recommended

---

## Installation

### 1. Import Database

```bash
mysql -u root -p < database.sql
```

Or via phpMyAdmin → Import → select `database.sql`

### 2. Configure Database

Edit `includes/config.php`:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');      // your MySQL username
define('DB_PASS', '');          // your MySQL password
define('DB_NAME', 'hannah_library');
```

### 3. Deploy Files

Copy the entire `library-system/` folder to:

- **XAMPP:** `C:/xampp/htdocs/library-system/`
- **WAMP:** `C:/wamp64/www/library-system/`
- **Linux:** `/var/www/html/library-system/`

### 4. Access the System

Open your browser:

```
http://localhost/library-system/login.php
```

---

## File Structure

```
library-system/
├── login.php              ← Login page (public entry point)
├── index.php              ← Main app (requires login)
├── logout.php             ← Logout handler
├── database.sql           ← Full schema + seed data
├── .htaccess              ← Apache security rules
├── includes/
│   ├── config.php         ← DB config, auth guards, helpers
│   └── .htaccess          ← Blocks direct access to includes/
├── api/
│   ├── auth.php           ← Login / logout / session check
│   ├── books.php          ← Books CRUD
│   ├── members.php        ← Members CRUD
│   ├── borrowings.php     ← Issue / return / fines
│   └── reports.php        ← PDF report generator
└── assets/
    ├── css/style.css      ← Full responsive stylesheet
    └── js/app.js          ← Single-page application logic
```

---

## Features

- **Secure Login** — Session-based auth, brute-force lockout (5 attempts → 15 min lock), idle timeout (60 min)
- **Dashboard** — Live stats: books, members, loans, overdue, fines + charts
- **Books Management** — Add, edit, delete, search, filter by category/status, copy tracking
- **Member Management** — Register students/lecturers/staff, auto-ID generation, borrowing history
- **Issue Book** — Live member + book search, loan period selector, outstanding-fine check
- **Return Book** — One-click return, automatic fine calculation
- **Overdue Tracking** — Auto-updated daily, UGX 2,000/day fine rate
- **Fines & Payments** — Record cash/mobile money/bank payments, receipt numbers
- **PDF Reports** — 6 report types: All Borrowings, Active Loans, Overdue, Fines, Members, Books Inventory
- **Responsive Design** — Mobile-first, works on all screen sizes

---

## Fine Policy

- **Rate:** UGX 2,000 per overdue day
- **Auto-calculated** on every API call
- **Blocked issuing** if member has unpaid fines
- **Payment methods:** Cash, Mobile Money, Bank Transfer
- **Receipts** auto-generated (format: `RCP-YYYY-XXXXXX`)

---

## Security Features

- PHP session with `httponly`, `samesite=Strict` cookies
- Session fixation prevention (`session_regenerate_id`)
- Idle timeout (60 minutes)
- Brute-force lockout (5 attempts = 15 minute ban)
- Parameterised SQL queries (no SQL injection)
- XSS protection via `htmlspecialchars` everywhere
- `.htaccess` blocks direct access to `includes/` directory
- All API endpoints require valid session
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` headers

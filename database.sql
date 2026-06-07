-- ============================================================
-- Hannah School of Health Sciences
-- Library Management System — Full Database Schema
-- Fine Rate: UGX 2,000 per overdue day
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS hannah_library;
CREATE DATABASE hannah_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hannah_library;

-- ── categories ──────────────────────────────────────────────
CREATE TABLE categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── books ────────────────────────────────────────────────────
CREATE TABLE books (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(255) NOT NULL,
  author           VARCHAR(255) NOT NULL,
  isbn             VARCHAR(30) UNIQUE,
  category_id      INT,
  publisher        VARCHAR(255),
  publish_year     YEAR,
  edition          VARCHAR(50),
  total_copies     INT NOT NULL DEFAULT 1,
  available_copies INT NOT NULL DEFAULT 1,
  shelf_location   VARCHAR(50),
  description      TEXT,
  status           ENUM('available','unavailable','maintenance') DEFAULT 'available',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── members ──────────────────────────────────────────────────
CREATE TABLE members (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  member_id         VARCHAR(20) UNIQUE NOT NULL,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  email             VARCHAR(150) UNIQUE NOT NULL,
  phone             VARCHAR(20),
  address           TEXT,
  member_type       ENUM('student','lecturer','staff','researcher') DEFAULT 'student',
  gender            ENUM('male','female','other'),
  date_of_birth     DATE,
  registration_date DATE DEFAULT (CURRENT_DATE),
  expiry_date       DATE,
  status            ENUM('active','suspended','expired') DEFAULT 'active',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── librarians (admin users) ─────────────────────────────────
CREATE TABLE librarians (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50) UNIQUE NOT NULL,
  full_name  VARCHAR(150) NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  role       ENUM('admin','librarian') DEFAULT 'librarian',
  status     ENUM('active','inactive') DEFAULT 'active',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── borrowings ───────────────────────────────────────────────
CREATE TABLE borrowings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  borrow_code  VARCHAR(30) UNIQUE NOT NULL,
  book_id      INT NOT NULL,
  member_id    INT NOT NULL,
  issue_date   DATE NOT NULL DEFAULT (CURRENT_DATE),
  due_date     DATE NOT NULL,
  return_date  DATE DEFAULT NULL,
  days_overdue INT DEFAULT 0,
  fine_per_day DECIMAL(8,2) DEFAULT 2000.00,
  fine_amount  DECIMAL(10,2) DEFAULT 0.00,
  fine_paid    ENUM('no','yes','partial') DEFAULT 'no',
  amount_paid  DECIMAL(10,2) DEFAULT 0.00,
  status       ENUM('active','returned','overdue','lost') DEFAULT 'active',
  notes        TEXT,
  issued_by    INT,
  returned_by  INT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id)   REFERENCES books(id)      ON DELETE RESTRICT,
  FOREIGN KEY (member_id) REFERENCES members(id)    ON DELETE RESTRICT,
  FOREIGN KEY (issued_by) REFERENCES librarians(id) ON DELETE SET NULL,
  FOREIGN KEY (returned_by) REFERENCES librarians(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── fine_payments ────────────────────────────────────────────
CREATE TABLE fine_payments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  borrowing_id   INT NOT NULL,
  member_id      INT NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash','mobile_money','bank') DEFAULT 'cash',
  receipt_number VARCHAR(50),
  received_by    INT,
  notes          TEXT,
  payment_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE RESTRICT,
  FOREIGN KEY (member_id)    REFERENCES members(id)    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ── book_reservations ────────────────────────────────────────
CREATE TABLE book_reservations (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  book_id          INT NOT NULL,
  member_id        INT NOT NULL,
  reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date      DATE NOT NULL,
  status           ENUM('pending','fulfilled','cancelled','expired') DEFAULT 'pending',
  FOREIGN KEY (book_id)   REFERENCES books(id)   ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── activity_log ─────────────────────────────────────────────
CREATE TABLE activity_log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  action       VARCHAR(100) NOT NULL,
  description  TEXT,
  performed_by INT,
  ip_address   VARCHAR(45),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_action     (action),
  INDEX idx_created_at (created_at),
  INDEX idx_ip         (ip_address)
) ENGINE=InnoDB;

-- ── Performance indexes ──────────────────────────────────────
CREATE INDEX idx_books_title    ON books(title);
CREATE INDEX idx_books_author   ON books(author);
CREATE INDEX idx_books_isbn     ON books(isbn);
CREATE INDEX idx_members_mid    ON members(member_id);
CREATE INDEX idx_members_email  ON members(email);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_borrow_status  ON borrowings(status);
CREATE INDEX idx_borrow_due     ON borrowings(due_date);
CREATE INDEX idx_borrow_member  ON borrowings(member_id);
CREATE INDEX idx_borrow_book    ON borrowings(book_id);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Categories
INSERT INTO categories (name, description) VALUES
('Medical & Health Sciences','Textbooks and references for medical and health science courses'),
('Nursing','Nursing theory, practice, and clinical references'),
('Pharmacology','Drug references, pharmacology textbooks and journals'),
('Anatomy & Physiology','Human body structure and function'),
('Pathology','Study of diseases and their causes'),
('Microbiology','Microbiology and infectious diseases'),
('Public Health','Epidemiology, community health, and public health management'),
('Research Methods','Research methodology, statistics, and academic writing'),
('Information Technology','Computer science, information systems, and technology'),
('General Reference','Dictionaries, encyclopedias, and general academic resources');

-- ── Librarians ────────────────────────────────────────────────
-- Passwords are bcrypt hashes.
-- admin     → Admin@2024
-- librarian → Lib@2024
-- To set your own: run  php -r "echo password_hash('YourPassword', PASSWORD_BCRYPT);"
INSERT INTO librarians (username, full_name, email, password, role) VALUES
('admin',     'System Administrator', 'admin@hannah.ac.ug',
 '$2y$10$TKh8H1.PfFR.QsPtB5rmZuORjMCJLsX4FgqV5CrluCNfGTzHb6D2.',
 'admin'),
('librarian', 'Head Librarian',       'librarian@hannah.ac.ug',
 '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
 'librarian');

-- ── Books ─────────────────────────────────────────────────────
INSERT INTO books (title,author,isbn,category_id,publisher,publish_year,edition,total_copies,available_copies,shelf_location,description) VALUES
('Gray''s Anatomy for Students','Richard Drake','978-0-323-39304-1',4,'Elsevier',2019,'4th',3,3,'A-01','Comprehensive anatomy reference for health science students'),
('Robbins Basic Pathology','Vinay Kumar','978-0-323-35317-5',5,'Elsevier',2017,'10th',2,2,'B-03','Fundamental pathology textbook covering all major disease processes'),
('Pharmacology for Nurses','Linda Lane Lilley','978-0-323-42592-5',3,'Mosby',2019,'6th',4,4,'C-02','Comprehensive pharmacology reference for nursing practice'),
('Fundamentals of Nursing','Patricia Potter','978-0-323-39698-1',2,'Elsevier',2021,'9th',5,5,'B-01','Core nursing concepts, skills and evidence-based practice'),
('Medical Microbiology','Patrick Murray','978-0-323-29956-5',6,'Elsevier',2020,'9th',2,2,'D-04','Comprehensive microbiology reference including all major pathogens'),
('Epidemiology: An Introduction','Kenneth Rothman','978-0-19-975455-7',7,'Oxford University Press',2012,'2nd',3,3,'E-02','Introduction to epidemiological methods and research'),
('Research Methodology','C.R. Kothari','978-81-224-2488-1',8,'New Age International',2004,'2nd',4,4,'F-01','Comprehensive research methods for social sciences'),
('Database System Concepts','Abraham Silberschatz','978-0-07-352272-0',9,'McGraw-Hill',2019,'7th',2,2,'G-03','Foundational database design and management'),
('Harrison''s Principles of Internal Medicine','J. Kasper','978-0-07-180215-4',1,'McGraw-Hill',2018,'20th',2,2,'A-05','Authoritative internal medicine reference'),
('Maternal & Child Health Nursing','JoAnne Silbert-Flagg','978-1-4963-5543-0',2,'Wolters Kluwer',2018,'8th',3,3,'B-02','Maternal and child healthcare nursing practice'),
('Anatomy & Physiology','Elaine Marieb','978-0-13-422928-4',4,'Pearson',2022,'11th',3,3,'A-02','Human anatomy and physiology with clinical applications'),
('Community Health Nursing','Mary Jo Clark','978-0-13-257708-6',7,'Pearson',2019,'9th',2,2,'E-03','Principles and practice of community health nursing');

-- ── Members ───────────────────────────────────────────────────
INSERT INTO members (member_id,first_name,last_name,email,phone,member_type,gender,registration_date,expiry_date,status) VALUES
('STU-2024-001','Sarah','Nakamya','sarah.nakamya@hannah.ac.ug','0701234567','student','female','2024-01-15','2026-01-15','active'),
('STU-2024-002','John','Okello','john.okello@hannah.ac.ug','0712345678','student','male','2024-01-20','2026-01-20','active'),
('STU-2024-003','Grace','Apio','grace.apio@hannah.ac.ug','0723456789','student','female','2024-02-01','2026-02-01','active'),
('STU-2024-004','David','Tumwine','d.tumwine@hannah.ac.ug','0756789012','student','male','2024-02-10','2026-02-10','active'),
('LEC-2024-001','Dr. Peter','Ssemakula','p.ssemakula@hannah.ac.ug','0734567890','lecturer','male','2024-01-10','2027-01-10','active'),
('LEC-2024-002','Dr. Rose','Achola','r.achola@hannah.ac.ug','0745678901','lecturer','female','2024-01-12','2027-01-12','active'),
('STF-2024-001','Agnes','Nabirye','a.nabirye@hannah.ac.ug','0778901234','staff','female','2024-01-05','2026-01-05','active');

-- ── Sample Borrowings ─────────────────────────────────────────
INSERT INTO borrowings (borrow_code,book_id,member_id,issue_date,due_date,return_date,status,fine_per_day,fine_amount,fine_paid,amount_paid) VALUES
('BRW-2024-0001',3,2,'2024-10-01','2024-10-15','2024-10-14','returned',2000,0,'yes',0),
('BRW-2024-0002',4,3,'2024-10-20','2024-11-03',NULL,'overdue',2000,82000,'no',0),
('BRW-2024-0003',7,1,'2024-11-01','2024-11-15','2024-11-14','returned',2000,0,'yes',0),
('BRW-2024-0004',2,5,'2024-11-10','2024-11-24',NULL,'overdue',2000,60000,'partial',20000),
('BRW-2024-0005',1,6,'2024-11-20','2024-12-04',NULL,'active',2000,0,'no',0),
('BRW-2024-0006',5,4,'2024-11-25','2024-12-09',NULL,'active',2000,0,'no',0);

-- Adjust available copies for active/overdue loans
UPDATE books SET available_copies = available_copies - 1 WHERE id IN (4,2,1,5);

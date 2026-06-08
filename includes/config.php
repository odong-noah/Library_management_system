<?php
// ============================================================
// Hannah Library Management System — Core Config
// ============================================================

// --- Session Security ---
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_strict_mode', 1);
    ini_set('session.cookie_samesite', 'Strict');
    session_start();
}

// --- Dynamic Base Path Detection ---
// Works whether deployed at http://localhost/ or http://localhost/library-system/
define('APP_ROOT',   dirname(__DIR__));                          // absolute filesystem root of the app
define('APP_BASE',   rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/\\'));  // URL base path

// Helper: build a URL relative to the app root
function appUrl($path) {
    $base = rtrim(str_replace('\\','/', dirname(dirname($_SERVER['PHP_SELF'] ?? ''))), '/');
    return $base . '/' . ltrim($path, '/');
}

// Login page redirect (works at any depth)
function loginUrl($extra = '') {
    $base = rtrim(str_replace('\\','/', dirname(dirname($_SERVER['PHP_SELF'] ?? ''))), '/');
    return $base . '/login.php' . $extra;
}

// --- Database ---
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'hannah_library');
define('DB_PORT', 3306);

// --- App Constants ---
define('FINE_PER_DAY',     2000);   // UGX 2,000 per overdue day
define('LOAN_PERIOD_DAYS', 14);
define('CURRENCY',         'UGX');
define('SESSION_TIMEOUT',  3600);   // 1 hour idle timeout
define('SYSTEM_NAME',      'Hannah Library System');
define('INSTITUTION',      'Hannah School of Health Sciences, Iganga');
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOCKOUT_TIME',     900);    // 15 minutes lockout

// ── Auth Guard ──────────────────────────────────────────────
function requireAuth() {
    if (!isset($_SESSION['librarian_id'])) {
        if (isApiRequest()) {
            header('Content-Type: application/json');
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized. Please log in.', 'redirect' => loginUrl()]);
            exit;
        }
        header('Location: ' . loginUrl());
        exit;
    }
    // Idle timeout check
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > SESSION_TIMEOUT) {
        session_unset();
        session_destroy();
        if (isApiRequest()) {
            header('Content-Type: application/json');
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Session expired. Please log in again.', 'redirect' => loginUrl('?expired=1')]);
            exit;
        }
        header('Location: ' . loginUrl('?expired=1'));
        exit;
    }
    $_SESSION['last_activity'] = time();
}

function isApiRequest() {
    $uri    = $_SERVER['REQUEST_URI'] ?? '';
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $xr     = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    return strpos($uri, '/api/') !== false
        || strpos($accept, 'application/json') !== false
        || strtolower($xr) === 'xmlhttprequest';
}

function isLoggedIn() {
    return isset($_SESSION['librarian_id']);
}

function currentUser() {
    return [
        'id'        => $_SESSION['librarian_id'] ?? null,
        'username'  => $_SESSION['username']      ?? '',
        'full_name' => $_SESSION['full_name']     ?? '',
        'role'      => $_SESSION['role']          ?? '',
    ];
}

// ── Database ────────────────────────────────────────────────
class Database {
    private static $instance = null;
    private $conn;

    private function __construct() {
        $this->conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
        if ($this->conn->connect_error) {
            http_response_code(500);
            die(json_encode(['success' => false, 'message' => 'Database connection failed: ' . $this->conn->connect_error]));
        }
        $this->conn->set_charset('utf8mb4');
    }

    public static function getInstance() {
        if (self::$instance === null) self::$instance = new self();
        return self::$instance;
    }

    public function getConnection() { return $this->conn; }

    public function query($sql, $params = [], $types = '') {
        if (empty($params)) {
            $result = $this->conn->query($sql);
            if ($result === false) throw new Exception('Query error: ' . $this->conn->error . ' | SQL: ' . $sql);
            return $result;
        }
        $stmt = $this->conn->prepare($sql);
        if (!$stmt) throw new Exception('Prepare error: ' . $this->conn->error . ' | SQL: ' . $sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        return $stmt->get_result();
    }

    public function execute($sql, $params = [], $types = '') {
        if (empty($params)) {
            $result = $this->conn->query($sql);
            return ['success' => $result !== false, 'insert_id' => $this->conn->insert_id, 'affected_rows' => $this->conn->affected_rows];
        }
        $stmt = $this->conn->prepare($sql);
        if (!$stmt) throw new Exception('Prepare error: ' . $this->conn->error);
        $stmt->bind_param($types, ...$params);
        $result = $stmt->execute();
        return ['success' => $result, 'insert_id' => $this->conn->insert_id, 'affected_rows' => $stmt->affected_rows];
    }

    public function fetchAll($sql, $params = [], $types = '') {
        $result = $this->query($sql, $params, $types);
        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        return $rows;
    }

    public function fetchOne($sql, $params = [], $types = '') {
        $result = $this->query($sql, $params, $types);
        return $result->fetch_assoc();
    }

    public function lastInsertId() { return $this->conn->insert_id; }
    public function escape($v)     { return $this->conn->real_escape_string($v); }
}

// ── Helpers ─────────────────────────────────────────────────
function response($success, $message, $data = null) {
    header('Content-Type: application/json');
    $resp = ['success' => $success, 'message' => $message];
    if ($data !== null) $resp['data'] = $data;
    echo json_encode($resp);
    exit;
}

function sanitize($input) {
    return htmlspecialchars(strip_tags(trim((string)$input)));
}

function csrfToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function logActivity($action, $desc = '', $userId = null) {
    try {
        $db  = Database::getInstance();
        $ip  = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $uid = $userId ?? ($_SESSION['librarian_id'] ?? null);
        $db->execute(
            "INSERT INTO activity_log (action, description, performed_by, ip_address) VALUES (?,?,?,?)",
            [$action, $desc, $uid, $ip], 'ssis'
        );
    } catch (Exception $e) { /* non-fatal */ }
}

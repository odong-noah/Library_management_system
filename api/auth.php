<?php
// ============================================================
// Auth API — Login / Logout / Session Check
// ============================================================
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once '../includes/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── CORS / Method guard ──────────────────────────────────────
if ($method !== 'POST' && $action !== 'check') {
    http_response_code(405);
    response(false, 'Method not allowed');
}

try {
    $db = Database::getInstance();

    // ── CHECK SESSION ────────────────────────────────────────
    if ($action === 'check') {
        if (isLoggedIn()) {
            response(true, 'Authenticated', currentUser());
        } else {
            http_response_code(401);
            response(false, 'Not authenticated');
        }
    }

    // ── LOGIN ────────────────────────────────────────────────
    if ($action === 'login') {
        $data = json_decode(file_get_contents('php://input'), true);
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

        if (!$username || !$password) {
            response(false, 'Username and password are required');
        }

        // Brute-force lockout check via session
        $lockKey = 'login_attempts_' . md5($username);
        $lockTime = 'login_lockout_' . md5($username);

        if (isset($_SESSION[$lockTime]) && (time() - $_SESSION[$lockTime]) < LOCKOUT_TIME) {
            $remaining = LOCKOUT_TIME - (time() - $_SESSION[$lockTime]);
            response(false, "Account temporarily locked. Try again in " . ceil($remaining/60) . " minute(s).");
        }

        $librarian = $db->fetchOne(
            "SELECT id, username, full_name, email, password, role, status FROM librarians WHERE username = ? LIMIT 1",
            [$username], 's'
        );

        if (!$librarian || !password_verify($password, $librarian['password'])) {
            // Track failed attempts
            $_SESSION[$lockKey] = ($_SESSION[$lockKey] ?? 0) + 1;
            if ($_SESSION[$lockKey] >= MAX_LOGIN_ATTEMPTS) {
                $_SESSION[$lockTime] = time();
                $_SESSION[$lockKey]  = 0;
                logActivity('login_lockout', "Account locked: $username");
                response(false, 'Too many failed attempts. Account locked for 15 minutes.');
            }
            $remaining = MAX_LOGIN_ATTEMPTS - $_SESSION[$lockKey];
            response(false, "Invalid credentials. $remaining attempt(s) remaining.");
        }

        if ($librarian['status'] !== 'active') {
            response(false, 'Your account is inactive. Contact the administrator.');
        }

        // ── Successful login ────────────────────────────────
        session_regenerate_id(true);   // Prevent session fixation
        unset($_SESSION[$lockKey], $_SESSION[$lockTime]);

        $_SESSION['librarian_id']  = $librarian['id'];
        $_SESSION['username']      = $librarian['username'];
        $_SESSION['full_name']     = $librarian['full_name'];
        $_SESSION['role']          = $librarian['role'];
        $_SESSION['last_activity'] = time();
        $_SESSION['csrf_token']    = bin2hex(random_bytes(32));

        // Update last_login timestamp
        $db->execute("UPDATE librarians SET last_login = NOW() WHERE id = ?", [$librarian['id']], 'i');
        logActivity('login', "Logged in: {$librarian['username']}", $librarian['id']);

        response(true, 'Login successful', [
            'full_name' => $librarian['full_name'],
            'role'      => $librarian['role'],
            'username'  => $librarian['username'],
            'csrf_token'=> $_SESSION['csrf_token'],
        ]);
    }

    // ── LOGOUT ───────────────────────────────────────────────
    if ($action === 'logout') {
        if (isLoggedIn()) {
            logActivity('logout', "Logged out: " . ($_SESSION['username'] ?? ''));
        }
        session_unset();
        session_destroy();
        response(true, 'Logged out successfully');
    }

    response(false, 'Unknown action');

} catch (Exception $e) {
    http_response_code(500);
    response(false, 'Server error. Please try again.');
}

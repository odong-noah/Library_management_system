<?php
require_once __DIR__ . '/includes/config.php';
if (isLoggedIn()) {
    logActivity('logout', 'Logged out: ' . ($_SESSION['username'] ?? ''));
}
session_unset();
session_destroy();
// Redirect back to login in same directory
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['PHP_SELF'])), '/');
header('Location: ' . $base . '/login.php');
exit;

<?php
require_once __DIR__ . '/includes/config.php';
requireAuth();
$user      = currentUser();
$csrfToken = csrfToken();

// Detect the base URL path dynamically (e.g. "" or "/library-system")
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['PHP_SELF'])), '/');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Hannah Library System</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet"/>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <link href="<?= $scriptDir ?>/assets/css/style.css" rel="stylesheet"/>
</head>
<body>

<!-- ── SIDEBAR ── -->
<aside class="sidebar" id="sidebar">
  <div class="sidebar-brand">
    <div class="brand-icon"><i class="fa-solid fa-book-open-reader"></i></div>
    <div class="brand-text">
      <span class="brand-name">Hannah LMS</span>
      <span class="brand-sub">Library System</span>
    </div>
    <button class="sidebar-close-btn" id="sidebarCloseBtn" aria-label="Close sidebar"><i class="fa-solid fa-xmark"></i></button>
  </div>

  <nav class="sidebar-nav" aria-label="Main navigation">
    <div class="nav-section-label">MAIN</div>
    <a href="#" class="nav-item active" data-page="dashboard"><i class="fa-solid fa-chart-line"></i><span>Dashboard</span></a>
    <a href="#" class="nav-item" data-page="books"><i class="fa-solid fa-books"></i><span>Books</span><span class="nav-badge" id="badge-books">0</span></a>
    <a href="#" class="nav-item" data-page="members"><i class="fa-solid fa-users"></i><span>Members</span></a>

    <div class="nav-section-label">CIRCULATION</div>
    <a href="#" class="nav-item" data-page="issue"><i class="fa-solid fa-hand-holding-heart"></i><span>Issue Book</span></a>
    <a href="#" class="nav-item" data-page="returns"><i class="fa-solid fa-rotate-left"></i><span>Return Book</span></a>
    <a href="#" class="nav-item" data-page="borrowings"><i class="fa-solid fa-list-check"></i><span>All Borrowings</span></a>

    <div class="nav-section-label">FINANCE</div>
    <a href="#" class="nav-item" data-page="overdue"><i class="fa-solid fa-triangle-exclamation"></i><span>Overdue Books</span><span class="nav-badge danger" id="badge-overdue">0</span></a>
    <a href="#" class="nav-item" data-page="fines"><i class="fa-solid fa-coins"></i><span>Fines &amp; Payments</span></a>

    <div class="nav-section-label">REPORTS</div>
    <a href="#" class="nav-item" data-page="reports"><i class="fa-solid fa-file-pdf"></i><span>PDF Reports</span></a>
  </nav>

  <div class="sidebar-footer">
    <div class="librarian-info">
      <div class="librarian-avatar"><i class="fa-solid fa-user-tie"></i></div>
      <div style="min-width:0;flex:1">
        <div class="librarian-name"><?= htmlspecialchars($user['full_name']) ?></div>
        <div class="librarian-role"><?= htmlspecialchars(ucfirst($user['role'])) ?></div>
      </div>
      <button class="icon-btn" onclick="confirmLogout()" title="Sign Out" style="border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.5)">
        <i class="fa-solid fa-right-from-bracket"></i>
      </button>
    </div>
  </div>
</aside>

<!-- Mobile overlay -->
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<!-- ── MAIN WRAPPER ── -->
<div class="main-wrapper" id="mainWrapper">

  <!-- TOPBAR -->
  <header class="topbar">
    <div class="topbar-left">
      <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar"><i class="fa-solid fa-bars"></i></button>
      <div class="page-title" id="pageTitle">Dashboard</div>
    </div>
    <div class="topbar-right">
      <div class="topbar-search">
        <i class="fa-solid fa-search"></i>
        <input type="text" id="globalSearch" placeholder="Search books, members…" autocomplete="off" aria-label="Global search"/>
        <div class="search-dropdown" id="searchDropdown" role="listbox"></div>
      </div>
      <div class="topbar-actions">
        <button class="icon-btn" id="notifBtn" title="Notifications" aria-label="Notifications">
          <i class="fa-solid fa-bell"></i>
          <span class="notif-dot" id="notifDot"></span>
        </button>
        <div class="topbar-date d-none d-sm-flex">
          <i class="fa-regular fa-calendar"></i>
          <span id="currentDate"></span>
        </div>
        <button class="icon-btn d-none d-md-flex" onclick="confirmLogout()" title="Sign Out" aria-label="Sign out">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </div>
  </header>

  <!-- CONTENT -->
  <main class="content-area" id="contentArea" role="main"></main>
</div>

<!-- ── MODAL ── -->
<div class="modal fade" id="mainModal" tabindex="-1" aria-modal="true" role="dialog">
  <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content styled-modal">
      <div class="modal-header">
        <h5 class="modal-title" id="mainModalTitle"></h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body"  id="mainModalBody"></div>
      <div class="modal-footer" id="mainModalFooter"></div>
    </div>
  </div>
</div>

<!-- ── TOAST ── -->
<div class="toast-container position-fixed top-0 end-0 p-3" style="z-index:9999" aria-live="polite">
  <div id="lmsToast" class="toast align-items-center border-0" role="alert" aria-atomic="true">
    <div class="d-flex">
      <div class="toast-body" id="toastBody"></div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  </div>
</div>

<!-- Pass PHP data to JS -->
<script>
  window.LMS_USER    = <?= json_encode($user) ?>;
  window.CSRF        = '<?= $csrfToken ?>';
  window.BASE_PATH   = '<?= $scriptDir ?>';   // e.g. "" or "/library-system"
</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script src="<?= $scriptDir ?>/assets/js/app.js"></script>
</body>
</html>

<?php
require_once __DIR__ . '/includes/config.php';
if (isLoggedIn()) { header('Location: index.php'); exit; }
$expired   = isset($_GET['expired']);
$csrfToken = csrfToken();
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['PHP_SELF'])), '/');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Login — Hannah Library System</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet"/>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    :root{--navy:#0d1b4b;--navy-mid:#1a3a6b;--accent:#3b82f6;--gold:#f59e0b;--danger:#ef4444;--success:#22c55e;--border:#e2e8f0}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Sora',sans-serif;min-height:100vh;display:flex;background:#f0f4ff}
    .login-left{width:45%;background:linear-gradient(145deg,var(--navy) 0%,var(--navy-mid) 60%,#1e4d8c 100%);display:flex;flex-direction:column;justify-content:center;align-items:center;padding:50px 40px;position:relative;overflow:hidden}
    .login-left::before{content:'';position:absolute;top:-80px;right:-80px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.04)}
    .login-left::after{content:'';position:absolute;bottom:-100px;left:-60px;width:350px;height:350px;border-radius:50%;background:rgba(59,130,246,.08)}
    .brand-wrap{text-align:center;position:relative;z-index:1;width:100%;max-width:300px}
    .brand-icon-big{width:90px;height:90px;border-radius:22px;background:linear-gradient(135deg,var(--accent),#6366f1);display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 22px;box-shadow:0 12px 40px rgba(59,130,246,.4)}
    .brand-wrap h1{font-size:26px;font-weight:800;color:#fff;line-height:1.3}
    .brand-wrap .inst{font-size:12.5px;color:rgba(255,255,255,.6);margin-top:7px}
    .brand-divider{width:50px;height:3px;background:var(--gold);border-radius:2px;margin:22px auto}
    .feature-list{list-style:none;padding:0;text-align:left;width:100%}
    .feature-list li{display:flex;align-items:center;gap:11px;color:rgba(255,255,255,.75);font-size:12.5px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07)}
    .feature-list li:last-child{border:none}
    .feature-list li i{color:var(--gold);width:16px;text-align:center;flex-shrink:0}
    .left-footer{position:absolute;bottom:22px;color:rgba(255,255,255,.3);font-size:10px;text-align:center;padding:0 20px}
    .login-right{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 20px}
    .login-card{background:#fff;border-radius:18px;padding:44px 40px;width:100%;max-width:420px;box-shadow:0 8px 48px rgba(13,27,75,.13);border:1px solid var(--border)}
    .login-card h2{font-size:23px;font-weight:800;color:var(--navy);margin-bottom:5px}
    .login-card .sub{font-size:13px;color:#64748b;margin-bottom:28px}
    .form-group{margin-bottom:18px}
    .form-label{display:block;font-size:12.5px;font-weight:600;color:#475569;margin-bottom:7px}
    .input-wrap{position:relative}
    .input-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:14px;pointer-events:none}
    .form-input{width:100%;padding:12px 14px 12px 42px;border:1.5px solid var(--border);border-radius:10px;font-family:'Sora',sans-serif;font-size:14px;color:#0f172a;transition:all .2s;outline:none;background:#f8faff}
    .form-input:focus{border-color:var(--accent);background:#fff;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
    .form-input.error{border-color:var(--danger);background:#fff8f8}
    .toggle-pw{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0;transition:color .2s}
    .toggle-pw:hover{color:var(--navy)}
    .btn-login{width:100%;padding:13px;border:none;border-radius:10px;background:linear-gradient(135deg,var(--navy),var(--navy-mid));color:#fff;font-family:'Sora',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all .22s;margin-top:6px;display:flex;align-items:center;justify-content:center;gap:9px}
    .btn-login:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(13,27,75,.3)}
    .btn-login:disabled{opacity:.65;cursor:not-allowed}
    .alert-box{border-radius:10px;padding:12px 15px;font-size:13px;margin-bottom:18px;display:flex;align-items:flex-start;gap:9px;line-height:1.5}
    .alert-error  {background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5}
    .alert-warning{background:#fef9c3;color:#92400e;border:1px solid #fde047}
    .alert-success{background:#dcfce7;color:#15803d;border:1px solid #86efac}
    .spinner-sm{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:spin .7s linear infinite;flex-shrink:0}
    @keyframes spin{to{transform:rotate(360deg)}}
    .login-footer{text-align:center;margin-top:22px;font-size:11px;color:#94a3b8;line-height:1.6}
    .attempts-wrap{margin-bottom:14px}
    .attempts-bar{height:4px;border-radius:2px;background:#e2e8f0;margin-top:6px;overflow:hidden}
    .attempts-fill{height:100%;border-radius:2px;background:var(--danger);transition:width .4s}
    @media(max-width:768px){body{flex-direction:column}.login-left{width:100%;padding:28px 24px;min-height:auto}.feature-list{display:none}.brand-divider{margin:12px auto}.login-right{padding:20px 16px;align-items:flex-start;padding-top:28px}.login-card{padding:28px 22px;border-radius:14px}}
    @media(max-width:400px){.login-card{padding:24px 16px}.brand-icon-big{width:70px;height:70px;font-size:30px}}
  </style>
</head>
<body>

<div class="login-left">
  <div class="brand-wrap">
    <div class="brand-icon-big">&#128218;</div>
    <h1>Hannah Library<br/>Management System</h1>
    <p class="inst">Hannah School of Health Sciences, Iganga</p>
    <div class="brand-divider"></div>
    <ul class="feature-list">
      <li><i class="fa-solid fa-books"></i> Books Catalogue &amp; Inventory</li>
      <li><i class="fa-solid fa-users"></i> Member Registration &amp; Tracking</li>
      <li><i class="fa-solid fa-hand-holding-heart"></i> Book Issuing &amp; Returns</li>
      <li><i class="fa-solid fa-triangle-exclamation"></i> Overdue &amp; Fine Tracking</li>
      <li><i class="fa-solid fa-coins"></i> Fines &amp; Payments (UGX 2,000/day)</li>
      <li><i class="fa-solid fa-file-pdf"></i> PDF Report Generation</li>
      <li><i class="fa-solid fa-chart-line"></i> Real-time Dashboard &amp; Statistics</li>
    </ul>
  </div>
  <div class="left-footer">&copy; <?=date('Y')?> Hannah School of Health Sciences, Iganga</div>
</div>

<div class="login-right">
  <div class="login-card">
    <h2>Welcome Back</h2>
    <p class="sub">Sign in to access the library management system</p>

    <?php if ($expired): ?>
    <div class="alert-box alert-warning">
      <i class="fa-solid fa-clock" style="margin-top:2px;flex-shrink:0"></i>
      <span>Your session expired due to inactivity. Please sign in again.</span>
    </div>
    <?php endif; ?>

    <div id="alertBox" style="display:none" class="alert-box"></div>

    <div class="form-group">
      <label class="form-label">Username</label>
      <div class="input-wrap">
        <i class="fa-solid fa-user input-icon"></i>
        <input type="text" id="username" class="form-input" placeholder="Enter your username"
               autocomplete="off"/>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Password</label>
      <div class="input-wrap">
        <i class="fa-solid fa-lock input-icon"></i>
        <input type="password" id="password" class="form-input" placeholder="Enter your password"
               autocomplete="new-password"/>
        <button type="button" class="toggle-pw" id="togglePw" tabindex="-1" aria-label="Toggle password visibility">
          <i class="fa-solid fa-eye" id="pwIcon"></i>
        </button>
      </div>
    </div>

    <div id="attemptsWrap" class="attempts-wrap" style="display:none">
      <div style="font-size:11.5px;color:var(--danger)" id="attemptsLabel"></div>
      <div class="attempts-bar"><div class="attempts-fill" id="attemptsFill" style="width:0%"></div></div>
    </div>

    <button class="btn-login" id="loginBtn" onclick="doLogin()">
      <i class="fa-solid fa-right-to-bracket"></i> Sign In
    </button>

    <div class="login-footer">
      <i class="fa-solid fa-shield-halved"></i> Secured session &nbsp;&middot;&nbsp; Auto-logout after 60 min of inactivity<br/>
      <span style="color:#cbd5e1;font-size:10px">Unauthorised access is prohibited</span>
    </div>
  </div>
</div>

<script>
const BASE_PATH = '<?= $scriptDir ?>';
const API_AUTH  = BASE_PATH + '/api/auth.php';

let failCount = 0;
const MAX_ATTEMPTS = 5;

// ─── FIX 1: clear fields on every page load ──────────────────────────────────
window.addEventListener('load', function () {
  clearFields();
  document.getElementById('username').focus();
});

function clearFields() {
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('username').classList.remove('error');
  document.getElementById('password').classList.remove('error');
  // Also reset the show/hide toggle back to hidden state
  document.getElementById('password').type   = 'password';
  document.getElementById('pwIcon').className = 'fa-solid fa-eye';
}

// Toggle password visibility
document.getElementById('togglePw').addEventListener('click', function () {
  const inp  = document.getElementById('password');
  const icon = document.getElementById('pwIcon');
  const show = inp.type === 'password';
  inp.type        = show ? 'text' : 'password';
  icon.className  = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
});

// Enter key submits
document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function showAlert(msg, type = 'error') {
  const icons = { error:'circle-exclamation', warning:'triangle-exclamation', success:'check-circle' };
  const box   = document.getElementById('alertBox');
  box.className = 'alert-box alert-' + type;
  box.innerHTML = '<i class="fa-solid fa-' + icons[type] + '" style="margin-top:2px;flex-shrink:0"></i><span>' + msg + '</span>';
  box.style.display = 'flex';
}

function setLoading(on) {
  const btn = document.getElementById('loginBtn');
  btn.disabled  = on;
  btn.innerHTML = on
    ? '<div class="spinner-sm"></div> Signing in\u2026'
    : '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
}

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showAlert('Please enter both username and password.');
    return;
  }

  setLoading(true);
  document.getElementById('alertBox').style.display = 'none';
  document.getElementById('username').classList.remove('error');
  document.getElementById('password').classList.remove('error');

  try {
    const res  = await fetch(API_AUTH + '?action=login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      showAlert('Login successful! Redirecting\u2026', 'success');

      // ─── FIX 2: clear fields before redirecting ───────────────────────────
      clearFields();

      setTimeout(() => { window.location.href = BASE_PATH + '/index.php'; }, 600);
      return;
    }

    // Failed login — clear only the password, keep username for convenience
    failCount++;
    document.getElementById('username').classList.add('error');
    document.getElementById('password').classList.add('error');
    document.getElementById('password').value = '';
    showAlert(data.message || 'Invalid credentials.');

    if (failCount < MAX_ATTEMPTS) {
      document.getElementById('attemptsWrap').style.display = 'block';
      document.getElementById('attemptsLabel').textContent  =
        (MAX_ATTEMPTS - failCount) + ' attempt(s) remaining before lockout';
      document.getElementById('attemptsFill').style.width   =
        (failCount / MAX_ATTEMPTS * 100) + '%';
    }

  } catch (e) {
    showAlert('Network error. Please check your connection and try again.');
  } finally {
    setLoading(false);
  }
}
</script>
</body>
</html>

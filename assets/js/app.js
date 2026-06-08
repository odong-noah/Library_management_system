/* ============================================================
   Hannah Library Management System — app.js
   ============================================================ */
const BASE = window.BASE_PATH || ''; const API = { books:BASE+'/api/books.php', members:BASE+'/api/members.php', borrowings:BASE+'/api/borrowings.php', reports:BASE+'/api/reports.php' };
let charts = {}, currentPage = 'dashboard';
let selectedMemberId = null, selectedBookId = null;

/* ── CORE ─────────────────────────────────────────────────── */
async function apiFetch(endpoint, params = {}, method = 'GET', body = null) {
  const url = new URL(endpoint, location.href);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const opts = { method, headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'} };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    const data = await res.json();
    if (res.status === 401) { window.location.href = BASE + '/login.php?expired=1'; return null; }
    return data;
  } catch(e) { return { success:false, message:'Network error: '+e.message }; }
}

function toast(msg, type='success') {
  const el = document.getElementById('lmsToast');
  el.className = `toast align-items-center border-0 toast-${type}`;
  document.getElementById('toastBody').textContent = msg;
  bootstrap.Toast.getOrCreateInstance(el,{delay:3400}).show();
}

function showModal(title, body, footer='') {
  document.getElementById('mainModalTitle').innerHTML  = title;
  document.getElementById('mainModalBody').innerHTML   = body;
  document.getElementById('mainModalFooter').innerHTML = footer;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal')).show();
}
function closeModal() { bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal')).hide(); }

function setContent(html) { document.getElementById('contentArea').innerHTML = `<div class="fade-in">${html}</div>`; }
function spinner()        { return `<div class="lms-spinner"><div class="spinner-ring"></div></div>`; }

function fmtDate(d)    { return d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }
function fmtMoney(n)   { return 'UGX '+Number(n||0).toLocaleString(); }
function badge(t,c)    { return `<span class="lms-badge badge-${c}">${t}</span>`; }
function statusBadge(s){ return badge(s, s||'active'); }
function typeBadge(t)  { return badge(t, t||'student'); }
function daysUntil(d)  { return Math.ceil((new Date(d)-new Date())/86400000); }

function destroyCharts() { Object.values(charts).forEach(c=>{try{c.destroy();}catch(e){}}); charts={}; }

/* ── NAVIGATION ──────────────────────────────────────────── */
function navigate(page) {
  destroyCharts(); currentPage = page;
  const titles = {dashboard:'Dashboard',books:'Books Management',members:'Members Management',issue:'Issue Book',returns:'Return Book',borrowings:'Borrowing Records',overdue:'Overdue Books',fines:'Fines & Payments',reports:'PDF Reports'};
  document.getElementById('pageTitle').textContent = titles[page]||page;
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active', el.dataset.page===page));
  // Close sidebar on mobile after navigation
  if(window.innerWidth<991){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('show'); }
  const fn = {dashboard:renderDashboard,books:renderBooks,members:renderMembers,issue:renderIssue,returns:renderReturns,borrowings:renderBorrowings,overdue:renderOverdue,fines:renderFines,reports:renderReports}[page];
  if(fn) fn();
}

/* ── DATE ────────────────────────────────────────────────── */
function initDate() {
  const update=()=>{ document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}); };
  update(); setInterval(update,60000);
}

/* ── GLOBAL SEARCH ───────────────────────────────────────── */
let searchTimer;
function initSearch() {
  const inp = document.getElementById('globalSearch');
  const dd  = document.getElementById('searchDropdown');
  inp.addEventListener('input', ()=>{
    clearTimeout(searchTimer);
    const q = inp.value.trim();
    if(q.length<2){dd.classList.remove('show');return;}
    searchTimer = setTimeout(async()=>{
      const [bR,mR] = await Promise.all([apiFetch(API.books,{action:'search',q}),apiFetch(API.members,{action:'search',q})]);
      const books   = (bR?.data||[]).slice(0,4);
      const members = (mR?.data||[]).slice(0,3);
      if(!books.length&&!members.length){dd.classList.remove('show');return;}
      dd.innerHTML = [
        ...books.map(b=>`<div class="search-item" onclick="navigate('books');closeSearch()"><div class="search-item-icon" style="background:#dbeafe;color:#3b82f6"><i class="fa-solid fa-book"></i></div><div><div style="font-weight:600;font-size:12.5px">${esc(b.title)}</div><div style="font-size:11px;color:#888">${esc(b.author)} · ${b.available_copies} avail.</div></div></div>`),
        ...members.map(m=>`<div class="search-item" onclick="navigate('members');closeSearch()"><div class="search-item-icon" style="background:#f3e8ff;color:#8b5cf6"><i class="fa-solid fa-user"></i></div><div><div style="font-weight:600;font-size:12.5px">${esc(m.first_name)} ${esc(m.last_name)}</div><div style="font-size:11px;color:#888">${esc(m.member_id)} · ${m.member_type}</div></div></div>`)
      ].join('');
      dd.classList.add('show');
    },320);
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('.topbar-search'))closeSearch(); });
}
function closeSearch(){ document.getElementById('searchDropdown').classList.remove('show'); document.getElementById('globalSearch').value=''; }
function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

/* ── SIDEBAR ─────────────────────────────────────────────── */
function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const toggle   = document.getElementById('sidebarToggle');
  const closeBtn = document.getElementById('sidebarCloseBtn');

  const open  = ()=>{ sidebar.classList.add('open'); overlay.classList.add('show'); };
  const close = ()=>{ sidebar.classList.remove('open'); overlay.classList.remove('show'); };

  toggle.addEventListener('click',()=>{ sidebar.classList.contains('open')?close():open(); });
  if(closeBtn) closeBtn.addEventListener('click',close);
  overlay.addEventListener('click',close);

  document.querySelectorAll('.nav-item').forEach(el=>{
    el.addEventListener('click',e=>{ e.preventDefault(); const p=el.dataset.page; if(p)navigate(p); });
  });
}

/* ── LOGOUT ──────────────────────────────────────────────── */
function confirmLogout() {
  showModal('<i class="fa-solid fa-right-from-bracket me-2"></i>Confirm Logout',
    `<div style="text-align:center;padding:10px 0"><i class="fa-solid fa-shield-halved" style="font-size:38px;color:var(--navy);margin-bottom:14px;display:block"></i><p style="font-size:15px">Are you sure you want to sign out?</p></div>`,
    `<button class="btn-navy" onclick="closeModal()">Cancel</button><button class="btn-danger-sm" style="padding:9px 18px;font-size:13px" onclick="doLogout()"><i class="fa-solid fa-right-from-bracket"></i> Sign Out</button>`
  );
  return false;
}
async function doLogout() {
  await apiFetch(BASE+'/api/auth.php',{action:'logout'},'POST');
  window.location.href = BASE + '/login.php';
}

/* ── SESSION KEEPALIVE ───────────────────────────────────── */
function initKeepalive() {
  setInterval(async()=>{
    const r = await apiFetch(BASE+'/api/auth.php',{action:'check'});
    if(!r||!r.success) window.location.href=BASE+'/login.php?expired=1';
  }, 300000); // every 5 minutes
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════ */
async function renderDashboard() {
  setContent(spinner());
  const res = await apiFetch(API.borrowings,{action:'dashboard_stats'});
  if(!res?.success){ setContent(`<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>${res?.message||'Error loading dashboard'}</p></div>`); return; }
  const s = res.data;

  document.getElementById('badge-overdue').textContent = s.overdue_borrows;
  document.getElementById('badge-books').textContent   = s.total_books;
  if(s.overdue_borrows>0){ document.getElementById('notifDot').classList.add('show'); }

  const overdueAlert = s.overdue_borrows>0 ? `<div class="overdue-alert"><i class="fa-solid fa-triangle-exclamation fa-lg"></i><div><strong>${s.overdue_borrows} overdue book${s.overdue_borrows>1?'s':''}</strong> — ${fmtMoney(s.total_fines_due)} in outstanding fines.</div><a href="#" onclick="navigate('overdue')" style="margin-left:auto;color:#b91c1c;font-weight:700;font-size:12px;white-space:nowrap">View All →</a></div>` : '';

  const monthLabels = s.monthly_borrows.map(r=>r.month);
  const monthCounts = s.monthly_borrows.map(r=>r.count);

  const topBooks = (s.most_borrowed||[]).map((b,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)"><div style="width:24px;height:24px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${i+1}</div><div style="flex:1;min-width:0;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.title)}</div><div style="font-size:12px;font-weight:700;color:var(--accent)">${b.borrows}×</div></div>`).join('');

  const recentAct = (s.recent_activity||[]).map(b=>{
    const isRet=b.status==='returned', isOvd=b.status==='overdue';
    const dc=isOvd?'dot-overdue':isRet?'dot-return':'dot-issue';
    const ic=isOvd?'fa-triangle-exclamation':isRet?'fa-rotate-left':'fa-hand-holding-heart';
    const act=isOvd?'is overdue':isRet?'returned':'borrowed';
    return `<li class="activity-item"><div class="activity-dot ${dc}"><i class="fa-solid ${ic}"></i></div><div><div class="activity-text"><strong>${esc(b.first_name)} ${esc(b.last_name)}</strong> ${act} <em>${esc(b.book_title)}</em></div><div class="activity-time">${fmtDate(b.return_date||b.issue_date)} · ${esc(b.member_code)}</div></div></li>`;
  }).join('');

  setContent(`
    ${overdueAlert}
    <div class="stat-cards">
      <div class="stat-card blue"><div class="stat-card-icon"><i class="fa-solid fa-books"></i></div><div class="stat-value">${Number(s.total_books).toLocaleString()}</div><div class="stat-label">Total Books</div><div class="stat-sub">${s.available_books} copies available</div></div>
      <div class="stat-card green"><div class="stat-card-icon"><i class="fa-solid fa-users"></i></div><div class="stat-value">${Number(s.total_members).toLocaleString()}</div><div class="stat-label">Active Members</div><div class="stat-sub">${s.active_borrows} currently borrowing</div></div>
      <div class="stat-card orange"><div class="stat-card-icon"><i class="fa-solid fa-hand-holding-heart"></i></div><div class="stat-value">${Number(s.active_borrows).toLocaleString()}</div><div class="stat-label">Books on Loan</div><div class="stat-sub">${s.borrows_this_month} issued this month</div></div>
      <div class="stat-card red"><div class="stat-card-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="stat-value">${Number(s.overdue_borrows).toLocaleString()}</div><div class="stat-label">Overdue Books</div><div class="stat-sub ${s.overdue_borrows>0?'warn':''}">${fmtMoney(s.total_fines_due)} outstanding</div></div>
      <div class="stat-card purple"><div class="stat-card-icon"><i class="fa-solid fa-coins"></i></div><div class="stat-value">${fmtMoney(s.total_fines_collected).replace('UGX ','')}</div><div class="stat-label">Fines Collected</div><div class="stat-sub">Total fines collected</div></div>
      <div class="stat-card teal"><div class="stat-card-icon"><i class="fa-solid fa-rotate-left"></i></div><div class="stat-value">${Number(s.returns_this_month).toLocaleString()}</div><div class="stat-label">Returns This Month</div><div class="stat-sub">${s.borrows_this_month} issued vs ${s.returns_this_month} returned</div></div>
    </div>
    <div class="dashboard-grid">
      <div>
        <div class="lms-card"><div class="lms-card-header"><div class="lms-card-title"><i class="fa-solid fa-chart-bar"></i> Monthly Borrowing Activity</div></div><div class="lms-card-body"><div class="chart-container"><canvas id="monthlyChart"></canvas></div></div></div>
        <div class="lms-card"><div class="lms-card-header"><div class="lms-card-title"><i class="fa-solid fa-clock-rotate-left"></i> Recent Activity</div><a href="#" onclick="navigate('borrowings')" style="font-size:12px;color:var(--accent);font-weight:600;text-decoration:none">View All →</a></div><div class="lms-card-body" style="padding-top:6px"><ul class="activity-list">${recentAct||'<li class="activity-item" style="color:var(--text-muted);font-size:13px">No recent activity</li>'}</ul></div></div>
      </div>
      <div>
        <div class="lms-card"><div class="lms-card-header"><div class="lms-card-title"><i class="fa-solid fa-chart-pie"></i> Circulation Status</div></div><div class="lms-card-body"><div class="chart-container" style="height:195px"><canvas id="statusChart"></canvas></div></div></div>
        <div class="lms-card"><div class="lms-card-header"><div class="lms-card-title"><i class="fa-solid fa-trophy"></i> Most Borrowed</div></div><div class="lms-card-body" style="padding-top:4px">${topBooks||'<div class="empty-state" style="padding:20px"><p>No data yet</p></div>'}</div></div>
        <div class="lms-card"><div class="lms-card-header"><div class="lms-card-title"><i class="fa-solid fa-bolt"></i> Quick Actions</div></div><div class="lms-card-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:9px"><button class="btn-accent" style="justify-content:center;padding:11px 8px;font-size:12px" onclick="navigate('issue')"><i class="fa-solid fa-plus"></i> Issue</button><button class="btn-navy" style="justify-content:center;padding:11px 8px;font-size:12px" onclick="navigate('returns')"><i class="fa-solid fa-rotate-left"></i> Return</button><button class="btn-navy" style="justify-content:center;padding:11px 8px;font-size:12px;background:#16a34a" onclick="showAddBook()"><i class="fa-solid fa-book-medical"></i> Add Book</button><button class="btn-navy" style="justify-content:center;padding:11px 8px;font-size:12px;background:#7c3aed" onclick="showAddMember()"><i class="fa-solid fa-user-plus"></i> Add Member</button></div></div></div>
      </div>
    </div>
  `);

  setTimeout(()=>{
    const c1=document.getElementById('monthlyChart');
    if(c1) charts.monthly=new Chart(c1,{type:'bar',data:{labels:monthLabels.length?monthLabels:['No Data'],datasets:[{label:'Books Borrowed',data:monthCounts.length?monthCounts:[0],backgroundColor:'rgba(59,130,246,.18)',borderColor:'#3b82f6',borderWidth:2,borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}},x:{grid:{display:false}}}}});
    const c2=document.getElementById('statusChart');
    if(c2) charts.status=new Chart(c2,{type:'doughnut',data:{labels:['Available','On Loan','Overdue'],datasets:[{data:[s.available_books||0,s.active_borrows||0,s.overdue_borrows||0],backgroundColor:['#22c55e','#3b82f6','#ef4444'],borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{padding:14,font:{size:11}}}},cutout:'65%'}});
  },100);
}

/* ══════════════════════════════════════════════════════════
   BOOKS
══════════════════════════════════════════════════════════ */
let bookDebounce;
async function renderBooks(page=1,search='',category='',status='') {
  setContent(`<div class="page-header"><h2><i class="fa-solid fa-books" style="color:var(--accent)"></i> Books</h2></div>${spinner()}`);
  const [bR,cR]=await Promise.all([search?apiFetch(API.books,{action:'search',q:search,category,status}):apiFetch(API.books,{page,category,status}),apiFetch(API.books,{action:'categories'})]);
  const books=search?(bR?.data||[]):(bR?.data?.books||[]);
  const total=search?books.length:(bR?.data?.total||0);
  const pages=search?1:(bR?.data?.pages||1);
  const cats=(cR?.data||[]);
  const catOpts=cats.map(c=>`<option value="${c.id}" ${category==c.id?'selected':''}>${esc(c.name)}</option>`).join('');

  const rows=books.map(b=>{
    const pct=b.total_copies>0?Math.round((b.available_copies/b.total_copies)*100):0;
    return `<tr><td><div style="font-weight:600;font-size:13px">${esc(b.title)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(b.isbn)||'No ISBN'}</div></td><td style="font-size:12.5px">${esc(b.author)}</td><td><span style="font-size:12px">${esc(b.category_name||'—')}</span></td><td><div style="display:flex;align-items:center;gap:6px"><span style="font-weight:700">${b.available_copies}</span><span style="color:var(--text-muted);font-size:12px">/ ${b.total_copies}</span></div><div class="avail-bar" style="width:72px"><div class="avail-fill" style="width:${pct}%"></div></div></td><td style="font-size:12.5px">${esc(b.shelf_location||'—')}</td><td>${statusBadge(b.status)}</td><td style="white-space:nowrap"><button class="btn-outline-sm" onclick="viewBook(${b.id})"><i class="fa-solid fa-eye"></i></button> <button class="btn-warning-sm" onclick="editBook(${b.id})"><i class="fa-solid fa-pen"></i></button> <button class="btn-danger-sm" onclick="deleteBook(${b.id},'${esc(b.title).replace(/'/g,"\\'")}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
  }).join('');

  setContent(`
    <div class="page-header"><div><h2><i class="fa-solid fa-books" style="color:var(--accent)"></i> Books Management</h2><p>${total} book${total!==1?'s':''} found</p></div><button class="btn-accent" onclick="showAddBook()"><i class="fa-solid fa-plus"></i> Add New Book</button></div>
    <div class="lms-card"><div class="lms-card-body">
      <div class="search-bar-row">
        <input class="lms-input" id="bookSearch" placeholder="Search title, author, ISBN…" value="${esc(search)}" oninput="bookDebounce&&clearTimeout(bookDebounce);bookDebounce=setTimeout(()=>renderBooks(1,this.value,document.getElementById('bookCatFilter').value,document.getElementById('bookStatusFilter').value),340)"/>
        <select class="lms-select" id="bookCatFilter" onchange="renderBooks(1,document.getElementById('bookSearch').value,this.value,document.getElementById('bookStatusFilter').value)"><option value="">All Categories</option>${catOpts}</select>
        <select class="lms-select" id="bookStatusFilter" onchange="renderBooks(1,document.getElementById('bookSearch').value,document.getElementById('bookCatFilter').value,this.value)"><option value="">All Status</option><option value="available" ${status==='available'?'selected':''}>Available</option><option value="unavailable" ${status==='unavailable'?'selected':''}>Unavailable</option><option value="maintenance" ${status==='maintenance'?'selected':''}>Maintenance</option></select>
      </div>
      <div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Title / ISBN</th><th>Author</th><th>Category</th><th>Copies</th><th>Shelf</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows||`<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-book-open"></i><p>No books found</p></div></td></tr>`}</tbody></table></div>
      ${pages>1?renderPagination(page,pages,`renderBooks({PAGE},'${esc(search)}','${category}','${status}')`): ''}
    </div></div>
  `);
}

async function showAddBook() {
  const cR=await apiFetch(API.books,{action:'categories'});
  const cats=cR?.data||[];
  const catOpts=cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  showModal('<i class="fa-solid fa-book-medical me-2"></i>Add New Book',`
    <div class="row g-3">
      <div class="col-12"><div class="lms-form-group"><label class="lms-label">Book Title *</label><input class="lms-input" id="bTitle" placeholder="Full book title"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Author *</label><input class="lms-input" id="bAuthor" placeholder="Author name"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">ISBN</label><input class="lms-input" id="bISBN" placeholder="978-x-xxx-xxxxx-x"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Category</label><select class="lms-select" id="bCat"><option value="">Select Category</option>${catOpts}</select></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Publisher</label><input class="lms-input" id="bPub" placeholder="Publisher name"/></div></div>
      <div class="col-md-4"><div class="lms-form-group"><label class="lms-label">Year</label><input class="lms-input" id="bYear" type="number" placeholder="${new Date().getFullYear()}"/></div></div>
      <div class="col-md-4"><div class="lms-form-group"><label class="lms-label">Edition</label><input class="lms-input" id="bEd" placeholder="e.g. 3rd Edition"/></div></div>
      <div class="col-md-4"><div class="lms-form-group"><label class="lms-label">Total Copies *</label><input class="lms-input" id="bCopies" type="number" min="1" value="1"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Shelf Location</label><input class="lms-input" id="bShelf" placeholder="e.g. A-01"/></div></div>
      <div class="col-12"><div class="lms-form-group"><label class="lms-label">Description</label><textarea class="lms-textarea" id="bDesc" placeholder="Brief description…"></textarea></div></div>
    </div>
  `,`<button class="btn-navy" onclick="closeModal()">Cancel</button><button class="btn-accent" onclick="submitAddBook()"><i class="fa-solid fa-save"></i> Save Book</button>`);
}

async function submitAddBook() {
  const data={title:document.getElementById('bTitle').value.trim(),author:document.getElementById('bAuthor').value.trim(),isbn:document.getElementById('bISBN').value.trim(),category_id:document.getElementById('bCat').value,publisher:document.getElementById('bPub').value.trim(),publish_year:document.getElementById('bYear').value,edition:document.getElementById('bEd').value.trim(),total_copies:document.getElementById('bCopies').value,shelf_location:document.getElementById('bShelf').value.trim(),description:document.getElementById('bDesc').value.trim()};
  if(!data.title||!data.author){toast('Title and Author are required','error');return;}
  const r=await apiFetch(API.books,{action:'add'},'POST',data);
  if(r?.success){toast('Book added successfully!');closeModal();renderBooks();}else toast(r?.message||'Failed','error');
}

async function editBook(id) {
  const [bR,cR]=await Promise.all([apiFetch(API.books,{action:'get',id}),apiFetch(API.books,{action:'categories'})]);
  if(!bR?.success){toast('Book not found','error');return;}
  const b=bR.data, cats=cR?.data||[];
  const catOpts=cats.map(c=>`<option value="${c.id}" ${c.id==b.category_id?'selected':''}>${esc(c.name)}</option>`).join('');
  showModal('<i class="fa-solid fa-pen me-2"></i>Edit Book',`
    <input type="hidden" id="bEditId" value="${b.id}"/>
    <div class="row g-3">
      <div class="col-12"><div class="lms-form-group"><label class="lms-label">Title *</label><input class="lms-input" id="bEditTitle" value="${esc(b.title)}"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Author *</label><input class="lms-input" id="bEditAuthor" value="${esc(b.author)}"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">ISBN</label><input class="lms-input" id="bEditISBN" value="${esc(b.isbn||'')}"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Category</label><select class="lms-select" id="bEditCat"><option value="">Select</option>${catOpts}</select></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Publisher</label><input class="lms-input" id="bEditPub" value="${esc(b.publisher||'')}"/></div></div>
      <div class="col-md-4"><div class="lms-form-group"><label class="lms-label">Year</label><input class="lms-input" id="bEditYear" type="number" value="${b.publish_year||''}"/></div></div>
      <div class="col-md-4"><div class="lms-form-group"><label class="lms-label">Edition</label><input class="lms-input" id="bEditEd" value="${esc(b.edition||'')}"/></div></div>
      <div class="col-md-4"><div class="lms-form-group"><label class="lms-label">Copies</label><input class="lms-input" id="bEditCopies" type="number" min="1" value="${b.total_copies}"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Shelf</label><input class="lms-input" id="bEditShelf" value="${esc(b.shelf_location||'')}"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Status</label><select class="lms-select" id="bEditStatus"><option value="available" ${b.status==='available'?'selected':''}>Available</option><option value="unavailable" ${b.status==='unavailable'?'selected':''}>Unavailable</option><option value="maintenance" ${b.status==='maintenance'?'selected':''}>Maintenance</option></select></div></div>
      <div class="col-12"><div class="lms-form-group"><label class="lms-label">Description</label><textarea class="lms-textarea" id="bEditDesc">${esc(b.description||'')}</textarea></div></div>
    </div>
  `,`<button class="btn-navy" onclick="closeModal()">Cancel</button><button class="btn-accent" onclick="submitEditBook()"><i class="fa-solid fa-save"></i> Update</button>`);
}

async function submitEditBook() {
  const data={id:document.getElementById('bEditId').value,title:document.getElementById('bEditTitle').value.trim(),author:document.getElementById('bEditAuthor').value.trim(),isbn:document.getElementById('bEditISBN').value.trim(),category_id:document.getElementById('bEditCat').value,publisher:document.getElementById('bEditPub').value.trim(),publish_year:document.getElementById('bEditYear').value,edition:document.getElementById('bEditEd').value.trim(),total_copies:document.getElementById('bEditCopies').value,shelf_location:document.getElementById('bEditShelf').value.trim(),status:document.getElementById('bEditStatus').value,description:document.getElementById('bEditDesc').value.trim()};
  const r=await apiFetch(API.books,{},'PUT',data);
  if(r?.success){toast('Book updated!');closeModal();renderBooks();}else toast(r?.message||'Failed','error');
}

async function deleteBook(id,title) {
  showModal('<i class="fa-solid fa-trash me-2 text-danger"></i>Delete Book',`<div style="text-align:center;padding:10px 0"><i class="fa-solid fa-circle-exclamation" style="font-size:38px;color:var(--danger);margin-bottom:12px;display:block"></i><p style="font-size:15px">Delete <strong>"${title}"</strong>?</p><p style="font-size:12px;color:var(--text-muted);margin-top:6px">Books with active borrowings cannot be deleted.</p></div>`,
  `<button class="btn-navy" onclick="closeModal()">Cancel</button><button class="btn-danger-sm" style="padding:9px 18px;font-size:13px" onclick="confirmDeleteBook(${id})"><i class="fa-solid fa-trash"></i> Delete</button>`);
}
async function confirmDeleteBook(id){const r=await apiFetch(API.books,{id},'DELETE');if(r?.success){toast('Book deleted');closeModal();renderBooks();}else toast(r?.message||'Failed','error');}

async function viewBook(id){
  const r=await apiFetch(API.books,{action:'get',id});
  if(!r?.success){toast('Not found','error');return;}
  const b=r.data, pct=b.total_copies>0?Math.round((b.available_copies/b.total_copies)*100):0;
  showModal(`<i class="fa-solid fa-book me-2"></i>${esc(b.title)}`,`
    <div class="row g-3">
      <div class="col-md-5"><div style="background:linear-gradient(135deg,var(--navy),var(--navy-mid));border-radius:12px;padding:20px;color:#fff;text-align:center;margin-bottom:14px"><i class="fa-solid fa-book-open" style="font-size:38px;opacity:.8;margin-bottom:10px;display:block"></i><div style="font-weight:700;font-size:14px">${esc(b.title)}</div><div style="font-size:12px;opacity:.7;margin-top:4px">${esc(b.author)}</div></div>
      <div style="background:var(--bg);border-radius:10px;padding:14px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">COPY AVAILABILITY</div><div style="font-size:26px;font-weight:800;color:var(--navy)">${b.available_copies} <span style="font-size:13px;font-weight:400;color:var(--text-muted)">of ${b.total_copies}</span></div><div class="avail-bar" style="margin-top:8px"><div class="avail-fill" style="width:${pct}%"></div></div></div></div>
      <div class="col-md-7"><table style="width:100%;font-size:12.5px"><tr><td style="color:var(--text-muted);padding:5px 0;width:100px">ISBN</td><td style="font-weight:600">${esc(b.isbn||'—')}</td></tr><tr><td style="color:var(--text-muted);padding:5px 0">Category</td><td>${esc(b.category_name||'—')}</td></tr><tr><td style="color:var(--text-muted);padding:5px 0">Publisher</td><td>${esc(b.publisher||'—')}</td></tr><tr><td style="color:var(--text-muted);padding:5px 0">Year</td><td>${b.publish_year||'—'}</td></tr><tr><td style="color:var(--text-muted);padding:5px 0">Edition</td><td>${esc(b.edition||'—')}</td></tr><tr><td style="color:var(--text-muted);padding:5px 0">Shelf</td><td>${esc(b.shelf_location||'—')}</td></tr><tr><td style="color:var(--text-muted);padding:5px 0">Status</td><td>${statusBadge(b.status)}</td></tr></table>
      ${b.description?`<div style="margin-top:12px;font-size:12.5px;color:var(--text-secondary);line-height:1.6">${esc(b.description)}</div>`:''}
      </div>
    </div>
  `,`<button class="btn-navy" onclick="closeModal()">Close</button><button class="btn-accent" onclick="closeModal();editBook(${b.id})"><i class="fa-solid fa-pen"></i> Edit</button>`);
}

/* ══════════════════════════════════════════════════════════
   MEMBERS
══════════════════════════════════════════════════════════ */
let memberDebounce;
async function renderMembers(page=1,search='',type='',status=''){
  setContent(`<div class="page-header"><h2>Members</h2></div>${spinner()}`);
  const r=search?await apiFetch(API.members,{action:'search',q:search,type,status}):await apiFetch(API.members,{page,type,status});
  const members=search?(r?.data||[]):(r?.data?.members||[]);
  const total=search?members.length:(r?.data?.total||0);
  const pages=search?1:(r?.data?.pages||1);

  const rows=members.map(m=>`<tr><td><div style="display:flex;align-items:center;gap:9px"><div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-mid));display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">${m.first_name[0]}${m.last_name[0]}</div><div><div style="font-weight:600;font-size:13px">${esc(m.first_name)} ${esc(m.last_name)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(m.email)}</div></div></div></td><td><span style="font-family:'IBM Plex Mono',monospace;font-size:11.5px;background:var(--bg);padding:2px 7px;border-radius:4px">${esc(m.member_id)}</span></td><td>${typeBadge(m.member_type)}</td><td style="font-size:12.5px">${esc(m.phone||'—')}</td><td><span style="font-weight:700;color:${m.current_borrows>0?'var(--accent)':'var(--text-muted)'}">${m.current_borrows||0}</span></td><td>${statusBadge(m.status)}</td><td style="font-size:12px">${fmtDate(m.expiry_date)}</td><td style="white-space:nowrap"><button class="btn-outline-sm" onclick="viewMember(${m.id})"><i class="fa-solid fa-eye"></i></button> <button class="btn-warning-sm" onclick="editMember(${m.id})"><i class="fa-solid fa-pen"></i></button> <button class="btn-danger-sm" onclick="deleteMember(${m.id},'${esc(m.first_name)} ${esc(m.last_name)}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');

  setContent(`
    <div class="page-header"><div><h2><i class="fa-solid fa-users" style="color:var(--accent)"></i> Members Management</h2><p>${total} member${total!==1?'s':''} found</p></div><button class="btn-accent" onclick="showAddMember()"><i class="fa-solid fa-user-plus"></i> Add Member</button></div>
    <div class="lms-card"><div class="lms-card-body">
      <div class="search-bar-row">
        <input class="lms-input" id="memSearch" placeholder="Search name, ID, email…" value="${esc(search)}" oninput="memberDebounce&&clearTimeout(memberDebounce);memberDebounce=setTimeout(()=>renderMembers(1,this.value,document.getElementById('memTypeFilter').value,document.getElementById('memStatusFilter').value),340)"/>
        <select class="lms-select" id="memTypeFilter" onchange="renderMembers(1,document.getElementById('memSearch').value,this.value,document.getElementById('memStatusFilter').value)"><option value="">All Types</option><option value="student" ${type==='student'?'selected':''}>Student</option><option value="lecturer" ${type==='lecturer'?'selected':''}>Lecturer</option><option value="staff" ${type==='staff'?'selected':''}>Staff</option><option value="researcher" ${type==='researcher'?'selected':''}>Researcher</option></select>
        <select class="lms-select" id="memStatusFilter" onchange="renderMembers(1,document.getElementById('memSearch').value,document.getElementById('memTypeFilter').value,this.value)"><option value="">All Status</option><option value="active" ${status==='active'?'selected':''}>Active</option><option value="suspended" ${status==='suspended'?'selected':''}>Suspended</option><option value="expired" ${status==='expired'?'selected':''}>Expired</option></select>
      </div>
      <div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Member</th><th>Member ID</th><th>Type</th><th>Phone</th><th>Books Out</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead><tbody>${rows||`<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-users"></i><p>No members found</p></div></td></tr>`}</tbody></table></div>
      ${pages>1?renderPagination(page,pages,`renderMembers({PAGE},'${esc(search)}','${type}','${status}')`):''}
    </div></div>
  `);
}

async function showAddMember(){
  showModal('<i class="fa-solid fa-user-plus me-2"></i>Register New Member',`
    <div class="row g-3">
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">First Name *</label><input class="lms-input" id="mFirst" placeholder="First name"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Last Name *</label><input class="lms-input" id="mLast" placeholder="Last name"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Email *</label><input class="lms-input" id="mEmail" type="email" placeholder="email@hannah.ac.ug"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Phone</label><input class="lms-input" id="mPhone" placeholder="07XXXXXXXX"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Member Type *</label><select class="lms-select" id="mType"><option value="student">Student</option><option value="lecturer">Lecturer</option><option value="staff">Staff</option><option value="researcher">Researcher</option></select></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Gender</label><select class="lms-select" id="mGender"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Date of Birth</label><input class="lms-input" id="mDob" type="date"/></div></div>
      <div class="col-12"><div class="lms-form-group"><label class="lms-label">Address</label><textarea class="lms-textarea" id="mAddr" style="min-height:60px" placeholder="Physical address"></textarea></div></div>
    </div>
  `,`<button class="btn-navy" onclick="closeModal()">Cancel</button><button class="btn-accent" onclick="submitAddMember()"><i class="fa-solid fa-save"></i> Register</button>`);
}

async function submitAddMember(){
  const data={first_name:document.getElementById('mFirst').value.trim(),last_name:document.getElementById('mLast').value.trim(),email:document.getElementById('mEmail').value.trim(),phone:document.getElementById('mPhone').value.trim(),member_type:document.getElementById('mType').value,gender:document.getElementById('mGender').value,date_of_birth:document.getElementById('mDob').value,address:document.getElementById('mAddr').value.trim()};
  if(!data.first_name||!data.last_name||!data.email){toast('Name and Email are required','error');return;}
  const r=await apiFetch(API.members,{action:'add'},'POST',data);
  if(r?.success){toast(`Member registered! ID: ${r.data.member_id}`);closeModal();renderMembers();}else toast(r?.message||'Failed','error');
}

async function viewMember(id){
  const r=await apiFetch(API.members,{action:'get',id});
  if(!r?.success){toast('Not found','error');return;}
  const m=r.data;
  const hist=(m.borrow_history||[]).slice(0,6).map(b=>`<tr><td style="font-size:11.5px">${esc(b.borrow_code)}</td><td style="font-size:11.5px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.book_title)}</td><td style="font-size:11.5px">${fmtDate(b.issue_date)}</td><td style="font-size:11.5px">${fmtDate(b.due_date)}</td><td>${statusBadge(b.status)}</td><td style="font-size:11.5px;color:${b.fine_amount>0?'var(--danger)':'var(--success)'};font-weight:600">${b.fine_amount>0?fmtMoney(b.fine_amount):'—'}</td></tr>`).join('');
  showModal(`<i class="fa-solid fa-user me-2"></i>${esc(m.first_name)} ${esc(m.last_name)}`,`
    <div class="member-card-preview"><div class="member-avatar-lg"><i class="fa-solid fa-user-tie"></i></div><div><h5>${esc(m.first_name)} ${esc(m.last_name)}</h5><div>${typeBadge(m.member_type)}&nbsp;${statusBadge(m.status)}</div><small style="display:block;margin-top:8px">ID: <strong>${esc(m.member_id)}</strong></small></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;font-size:12.5px">
      <table><tr><td style="color:var(--text-muted);padding:4px 0;width:80px">Email</td><td style="font-weight:600">${esc(m.email)}</td></tr><tr><td style="color:var(--text-muted);padding:4px 0">Phone</td><td>${esc(m.phone||'—')}</td></tr><tr><td style="color:var(--text-muted);padding:4px 0">Gender</td><td>${esc(m.gender||'—')}</td></tr></table>
      <table><tr><td style="color:var(--text-muted);padding:4px 0;width:80px">Registered</td><td>${fmtDate(m.registration_date)}</td></tr><tr><td style="color:var(--text-muted);padding:4px 0">Expires</td><td>${fmtDate(m.expiry_date)}</td></tr><tr><td style="color:var(--text-muted);padding:4px 0">Address</td><td>${esc(m.address||'—')}</td></tr></table>
    </div>
    <div class="lms-card-title" style="margin-bottom:10px"><i class="fa-solid fa-history"></i> Borrowing History</div>
    <div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Code</th><th>Book</th><th>Issued</th><th>Due</th><th>Status</th><th>Fine</th></tr></thead><tbody>${hist||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:14px">No borrowing history</td></tr>'}</tbody></table></div>
  `,`<button class="btn-navy" onclick="closeModal()">Close</button><button class="btn-accent" onclick="closeModal();editMember(${m.id})"><i class="fa-solid fa-pen"></i> Edit</button>`);
}

async function editMember(id){
  const r=await apiFetch(API.members,{action:'get',id});
  if(!r?.success){toast('Not found','error');return;}
  const m=r.data;
  showModal('<i class="fa-solid fa-pen me-2"></i>Edit Member',`
    <input type="hidden" id="mEditId" value="${m.id}"/>
    <div class="row g-3">
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">First Name</label><input class="lms-input" id="mEditFirst" value="${esc(m.first_name)}"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Last Name</label><input class="lms-input" id="mEditLast" value="${esc(m.last_name)}"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Email</label><input class="lms-input" id="mEditEmail" value="${esc(m.email)}"/></div></div>
      <div class="col-md-6"><div class="lms-form-group"><label class="lms-label">Phone</label><input class="lms-input" id="mEditPhone" value="${esc(m.phone||'')}"/></div></div>
      <div class="col-md-4"><div class="lms-form-group"><label class="lms-label">Type</label><select class="lms-select" id="mEditType"><option value="student" ${m.member_type==='student'?'selected':''}>Student</option><option value="lecturer" ${m.member_type==='lecturer'?'selected':''}>Lecturer</option><option value="staff" ${m.member_type==='staff'?'selected':''}>Staff</option><option value="researcher" ${m.member_type==='researcher'?'selected':''}>Researcher</option></select></div></div>
      <div class="col-md-4"><div class="lms-form-group"><label class="lms-label">Gender</label><select class="lms-select" id="mEditGender"><option value="male" ${m.gender==='male'?'selected':''}>Male</option><option value="female" ${m.gender==='female'?'selected':''}>Female</option><option value="other" ${m.gender==='other'?'selected':''}>Other</option></select></div></div>
      <div class="col-md-4"><div class="lms-form-group"><label class="lms-label">Status</label><select class="lms-select" id="mEditStatus"><option value="active" ${m.status==='active'?'selected':''}>Active</option><option value="suspended" ${m.status==='suspended'?'selected':''}>Suspended</option><option value="expired" ${m.status==='expired'?'selected':''}>Expired</option></select></div></div>
      <div class="col-12"><div class="lms-form-group"><label class="lms-label">Address</label><textarea class="lms-textarea" id="mEditAddr" style="min-height:60px">${esc(m.address||'')}</textarea></div></div>
    </div>
  `,`<button class="btn-navy" onclick="closeModal()">Cancel</button><button class="btn-accent" onclick="submitEditMember()"><i class="fa-solid fa-save"></i> Update</button>`);
}

async function submitEditMember(){
  const data={id:document.getElementById('mEditId').value,first_name:document.getElementById('mEditFirst').value.trim(),last_name:document.getElementById('mEditLast').value.trim(),email:document.getElementById('mEditEmail').value.trim(),phone:document.getElementById('mEditPhone').value.trim(),member_type:document.getElementById('mEditType').value,gender:document.getElementById('mEditGender').value,status:document.getElementById('mEditStatus').value,address:document.getElementById('mEditAddr').value.trim()};
  const r=await apiFetch(API.members,{},'PUT',data);
  if(r?.success){toast('Member updated!');closeModal();renderMembers();}else toast(r?.message||'Failed','error');
}

async function deleteMember(id,name){
  showModal('<i class="fa-solid fa-trash me-2 text-danger"></i>Delete Member',`<div style="text-align:center;padding:10px 0"><i class="fa-solid fa-circle-exclamation" style="font-size:38px;color:var(--danger);margin-bottom:12px;display:block"></i><p style="font-size:15px">Delete <strong>${name}</strong>?</p><p style="font-size:12px;color:var(--text-muted);margin-top:6px">Members with active borrowings cannot be deleted.</p></div>`,
  `<button class="btn-navy" onclick="closeModal()">Cancel</button><button class="btn-danger-sm" style="padding:9px 18px;font-size:13px" onclick="confirmDeleteMember(${id})"><i class="fa-solid fa-trash"></i> Delete</button>`);
}
async function confirmDeleteMember(id){const r=await apiFetch(API.members,{id},'DELETE');if(r?.success){toast('Member deleted');closeModal();renderMembers();}else toast(r?.message||'Failed','error');}

/* ══════════════════════════════════════════════════════════
   ISSUE BOOK
══════════════════════════════════════════════════════════ */
async function renderIssue(){
  selectedMemberId=null; selectedBookId=null;
  setContent(`
    <div class="page-header"><div><h2><i class="fa-solid fa-hand-holding-heart" style="color:var(--accent)"></i> Issue Book</h2><p>Search for a member and book to issue</p></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      <div class="lms-card"><div class="lms-card-header"><div class="lms-card-title"><i class="fa-solid fa-user"></i> Select Member</div></div><div class="lms-card-body"><div class="lms-form-group"><label class="lms-label">Search Member (name, ID, email)</label><input class="lms-input" id="issueMemSearch" placeholder="Type to search…" oninput="searchIssueMembers(this.value)"/></div><div id="issueMemResults"></div><div id="selectedMemberCard"></div></div></div>
      <div class="lms-card"><div class="lms-card-header"><div class="lms-card-title"><i class="fa-solid fa-book"></i> Select Book</div></div><div class="lms-card-body"><div class="lms-form-group"><label class="lms-label">Search Book (title, author, ISBN)</label><input class="lms-input" id="issueBookSearch" placeholder="Type to search…" oninput="searchIssueBooks(this.value)"/></div><div id="issueBookResults"></div><div id="selectedBookCard"></div></div></div>
    </div>
    <div class="lms-card" id="issueSummaryCard" style="display:none">
      <div class="lms-card-header"><div class="lms-card-title"><i class="fa-solid fa-file-contract"></i> Issue Summary</div></div>
      <div class="lms-card-body">
        <div class="row g-3">
          <div class="col-md-4"><label class="lms-label">Loan Period (days)</label><input class="lms-input" id="issueLoanDays" type="number" min="1" max="60" value="14" oninput="updateDueDate()"/></div>
          <div class="col-md-4"><label class="lms-label">Due Date (auto-calculated)</label><input class="lms-input" id="issueDueDate" readonly style="background:var(--bg)"/></div>
          <div class="col-md-4"><label class="lms-label">Notes</label><input class="lms-input" id="issueNotes" placeholder="Optional notes…"/></div>
        </div>
        <div style="background:var(--gold-light);border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-top:14px;font-size:12.5px;color:#92400e"><i class="fa-solid fa-coins"></i> <strong>Fine Rate:</strong> UGX 2,000 per day if returned late. Member must have no outstanding fines.</div>
        <div style="margin-top:16px;text-align:right"><button class="btn-accent" style="padding:11px 26px;font-size:14px" onclick="submitIssueBook()"><i class="fa-solid fa-hand-holding-heart"></i> Confirm Issue</button></div>
      </div>
    </div>
  `);
  updateDueDate();
}

function updateDueDate(){
  const inp=document.getElementById('issueLoanDays');
  const out=document.getElementById('issueDueDate');
  if(!inp||!out) return;
  const days=parseInt(inp.value)||14;
  const due=new Date(); due.setDate(due.getDate()+days);
  out.value=fmtDate(due.toISOString().split('T')[0]);
}

let issueMemTimer, issueBookTimer;
async function searchIssueMembers(q){
  clearTimeout(issueMemTimer);
  if(q.length<2){document.getElementById('issueMemResults').innerHTML='';return;}
  issueMemTimer=setTimeout(async()=>{
    const r=await apiFetch(API.members,{action:'search',q,status:'active'});
    const members=(r?.data||[]).slice(0,5);
    document.getElementById('issueMemResults').innerHTML=members.length
      ?`<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:6px">${members.map(m=>`<div style="padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:9px;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''" onclick="selectIssueMember(${m.id},'${esc(m.first_name)}','${esc(m.last_name)}','${esc(m.member_id)}','${esc(m.member_type)}','${esc(m.phone||'')}','${esc(m.email)}')"><div style="width:32px;height:32px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0">${m.first_name[0]}${m.last_name[0]}</div><div><div style="font-weight:600;font-size:12.5px">${esc(m.first_name)} ${esc(m.last_name)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(m.member_id)} · ${m.member_type}</div></div></div>`).join('')}</div>`
      :'<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No active members found</div>';
  },300);
}

function selectIssueMember(id,first,last,mId,type,phone,email){
  selectedMemberId=id;
  document.getElementById('issueMemResults').innerHTML='';
  document.getElementById('issueMemSearch').value=`${first} ${last}`;
  document.getElementById('selectedMemberCard').innerHTML=`<div class="member-card-preview" style="margin-top:10px"><div class="member-avatar-lg"><i class="fa-solid fa-user"></i></div><div><h5>${esc(first)} ${esc(last)}</h5><small>${esc(mId)} · ${type}</small><br/><small>${esc(phone)} · ${esc(email)}</small></div><button onclick="clearIssueMember()" style="margin-left:auto;background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:6px;padding:4px 9px;cursor:pointer;font-size:11px;flex-shrink:0">✕</button></div>`;
  checkIssueReady();
}
function clearIssueMember(){selectedMemberId=null;document.getElementById('selectedMemberCard').innerHTML='';document.getElementById('issueMemSearch').value='';checkIssueReady();}

async function searchIssueBooks(q){
  clearTimeout(issueBookTimer);
  if(q.length<2){document.getElementById('issueBookResults').innerHTML='';return;}
  issueBookTimer=setTimeout(async()=>{
    const r=await apiFetch(API.books,{action:'search',q});
    const books=(r?.data||[]).filter(b=>b.available_copies>0).slice(0,5);
    document.getElementById('issueBookResults').innerHTML=books.length
      ?`<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:6px">${books.map(b=>`<div style="padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:9px;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''" onclick="selectIssueBook(${b.id},'${esc(b.title).replace(/'/g,"\\'")}','${esc(b.author).replace(/'/g,"\\'")}',${b.available_copies})"><div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--accent),#6366f1);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;flex-shrink:0"><i class="fa-solid fa-book"></i></div><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.title)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(b.author)} · ${b.available_copies} available</div></div></div>`).join('')}</div>`
      :'<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No available books found</div>';
  },300);
}

function selectIssueBook(id,title,author,copies){
  selectedBookId=id;
  document.getElementById('issueBookResults').innerHTML='';
  document.getElementById('issueBookSearch').value=title;
  document.getElementById('selectedBookCard').innerHTML=`<div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);border-radius:12px;padding:14px;color:#fff;margin-top:10px;display:flex;align-items:center;gap:11px"><div style="width:40px;height:40px;border-radius:9px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0"><i class="fa-solid fa-book"></i></div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</div><div style="font-size:11.5px;opacity:.7">${esc(author)} · ${copies} copies available</div></div><button onclick="clearIssueBook()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:6px;padding:4px 9px;cursor:pointer;font-size:11px;flex-shrink:0">✕</button></div>`;
  checkIssueReady();
}
function clearIssueBook(){selectedBookId=null;document.getElementById('selectedBookCard').innerHTML='';document.getElementById('issueBookSearch').value='';checkIssueReady();}
function checkIssueReady(){const c=document.getElementById('issueSummaryCard');if(c)c.style.display=(selectedMemberId&&selectedBookId)?'block':'none';}

async function submitIssueBook(){
  if(!selectedMemberId||!selectedBookId){toast('Please select both member and book','error');return;}
  const days=parseInt(document.getElementById('issueLoanDays').value)||14;
  const r=await apiFetch(API.borrowings,{action:'issue'},'POST',{book_id:selectedBookId,member_id:selectedMemberId,loan_days:days,notes:document.getElementById('issueNotes').value});
  if(r?.success){toast(`Book issued! Due: ${fmtDate(r.data.due_date)} · Code: ${r.data.borrow_code}`);selectedMemberId=null;selectedBookId=null;renderIssue();}
  else toast(r?.message||'Failed','error');
}

/* ══════════════════════════════════════════════════════════
   RETURNS
══════════════════════════════════════════════════════════ */
async function renderReturns(){
  setContent(spinner());
  const r=await apiFetch(API.borrowings,{action:'active'});
  const borrows=r?.data||[];

  const rows=borrows.map(b=>{
    const days=daysUntil(b.due_date);
    const dayLabel=days<0?`<span style="color:var(--danger);font-weight:700">${Math.abs(days)}d overdue</span>`:days===0?`<span style="color:var(--warning);font-weight:700">Due today</span>`:`<span style="color:var(--success)">${days}d left</span>`;
    return `<tr><td><span style="font-family:'IBM Plex Mono',monospace;font-size:11.5px">${esc(b.borrow_code)}</span></td><td><div style="font-weight:600;font-size:13px">${esc(b.book_title)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(b.author)}</div></td><td><div style="font-weight:600">${esc(b.first_name)} ${esc(b.last_name)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(b.member_code)}</div></td><td style="font-size:12px">${fmtDate(b.issue_date)}</td><td style="font-size:12px">${fmtDate(b.due_date)}<br/><small>${dayLabel}</small></td><td>${statusBadge(b.status)}</td><td><span class="fine-amount ${b.fine_amount>0?'owed':'clear'}">${b.fine_amount>0?fmtMoney(b.fine_amount):'None'}</span></td><td><button class="btn-success-sm" onclick="confirmReturn(${b.id},'${esc(b.borrow_code)}','${esc(b.book_title).replace(/'/g,"\\'")}','${esc(b.first_name)} ${esc(b.last_name)}',${b.fine_amount})"><i class="fa-solid fa-rotate-left"></i> Return</button></td></tr>`;
  }).join('');

  setContent(`
    <div class="page-header"><div><h2><i class="fa-solid fa-rotate-left" style="color:var(--accent)"></i> Return Book</h2><p>${borrows.length} books currently on loan</p></div></div>
    <div class="lms-card"><div class="lms-card-body"><div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Code</th><th>Book</th><th>Member</th><th>Issued</th><th>Due Date</th><th>Status</th><th>Fine</th><th>Action</th></tr></thead><tbody>${rows||`<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-check-circle" style="color:var(--success)"></i><p>No books currently on loan</p></div></td></tr>`}</tbody></table></div></div></div>
  `);
}

function confirmReturn(id,code,title,member,fine){
  const fineHtml=fine>0?`<div style="background:var(--danger-light);border-radius:8px;padding:12px 14px;margin-top:12px;border:1px solid #fca5a5"><div style="color:var(--danger);font-weight:700;font-size:14px"><i class="fa-solid fa-coins"></i> Fine: ${fmtMoney(fine)}</div><div style="font-size:12px;color:#7f1d1d;margin-top:3px">Overdue fine at UGX 2,000/day</div></div>`:`<div style="background:var(--success-light);border-radius:8px;padding:10px 14px;margin-top:12px;color:#15803d;font-weight:600;font-size:13px"><i class="fa-solid fa-check"></i> No fine — returned on time</div>`;
  showModal('<i class="fa-solid fa-rotate-left me-2"></i>Confirm Return',`<div style="text-align:center;padding:8px 0 4px"><i class="fa-solid fa-book-open" style="font-size:34px;color:var(--accent);margin-bottom:10px;display:block"></i><p style="font-size:15px">Return <strong>"${title}"</strong></p><p style="font-size:13px;color:var(--text-muted);margin-top:4px">Borrowed by: <strong>${member}</strong> · ${code}</p></div>${fineHtml}`,
  `<button class="btn-navy" onclick="closeModal()">Cancel</button><button class="btn-success-sm" style="padding:9px 20px;font-size:13px" onclick="submitReturn(${id})"><i class="fa-solid fa-check"></i> Confirm Return</button>`);
}

async function submitReturn(id){
  const r=await apiFetch(API.borrowings,{action:'return'},'POST',{id});
  if(r?.success){const msg=r.data.fine_amount>0?`Returned! Fine: ${fmtMoney(r.data.fine_amount)}`:'Book returned successfully!';toast(msg,r.data.fine_amount>0?'warning':'success');closeModal();renderReturns();}
  else toast(r?.message||'Failed','error');
}

/* ══════════════════════════════════════════════════════════
   ALL BORROWINGS
══════════════════════════════════════════════════════════ */
async function renderBorrowings(page=1,status=''){
  setContent(spinner());
  const r=await apiFetch(API.borrowings,{action:'history',page,status});
  const records=r?.data?.records||[], total=r?.data?.total||0, pages=r?.data?.pages||1;
  const rows=records.map(b=>`<tr><td><span style="font-family:'IBM Plex Mono',monospace;font-size:11.5px">${esc(b.borrow_code)}</span></td><td><div style="font-weight:600;font-size:13px">${esc(b.book_title)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(b.author)}</div></td><td><div style="font-weight:600">${esc(b.first_name)} ${esc(b.last_name)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(b.member_code)}</div></td><td>${typeBadge(b.member_type)}</td><td style="font-size:12px">${fmtDate(b.issue_date)}</td><td style="font-size:12px">${fmtDate(b.due_date)}</td><td style="font-size:12px">${b.return_date?fmtDate(b.return_date):'—'}</td><td>${statusBadge(b.status)}</td><td><span class="fine-amount ${b.fine_amount>0?'owed':'clear'}">${b.fine_amount>0?fmtMoney(b.fine_amount):'—'}</span></td></tr>`).join('');
  setContent(`
    <div class="page-header"><div><h2><i class="fa-solid fa-list-check" style="color:var(--accent)"></i> Borrowing Records</h2><p>${total} total records</p></div></div>
    <div class="lms-card"><div class="lms-card-header"><div class="lms-card-title"><i class="fa-solid fa-filter"></i> Filter</div><select class="lms-select" style="width:auto" onchange="renderBorrowings(1,this.value)"><option value="">All Records</option><option value="active" ${status==='active'?'selected':''}>Active</option><option value="overdue" ${status==='overdue'?'selected':''}>Overdue</option><option value="returned" ${status==='returned'?'selected':''}>Returned</option></select></div>
    <div class="lms-card-body"><div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Code</th><th>Book</th><th>Member</th><th>Type</th><th>Issued</th><th>Due</th><th>Returned</th><th>Status</th><th>Fine</th></tr></thead><tbody>${rows||`<tr><td colspan="9"><div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No records found</p></div></td></tr>`}</tbody></table></div>${pages>1?renderPagination(page,pages,`renderBorrowings({PAGE},'${status}')`):''}
    </div></div>
  `);
}

/* ══════════════════════════════════════════════════════════
   OVERDUE
══════════════════════════════════════════════════════════ */
async function renderOverdue(){
  setContent(spinner());
  const r=await apiFetch(API.borrowings,{action:'overdue'});
  const records=r?.data||[];
  const rows=records.map(b=>`<tr><td><span style="font-family:'IBM Plex Mono',monospace;font-size:11.5px">${esc(b.borrow_code)}</span></td><td><div style="font-weight:600">${esc(b.book_title)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(b.author)}</div></td><td><div style="font-weight:600">${esc(b.first_name)} ${esc(b.last_name)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(b.member_code)} · ${esc(b.phone||'')}</div></td><td style="font-size:12px">${fmtDate(b.issue_date)}</td><td style="color:var(--danger);font-weight:700;font-size:12px">${fmtDate(b.due_date)}</td><td><span style="background:var(--danger-light);color:var(--danger);font-weight:700;padding:3px 9px;border-radius:20px;font-size:11.5px">${b.days_overdue} days</span></td><td><span class="fine-amount owed">${fmtMoney(b.fine_amount)}</span></td><td><span style="color:${(b.fine_amount-b.amount_paid)>0?'var(--danger)':'var(--success)'};font-weight:700;font-size:12.5px">${fmtMoney(b.fine_amount-b.amount_paid)}</span></td><td style="white-space:nowrap"><button class="btn-success-sm" onclick="confirmReturn(${b.id},'${esc(b.borrow_code)}','${esc(b.book_title).replace(/'/g,"\\'")}','${esc(b.first_name)} ${esc(b.last_name)}',${b.fine_amount})" title="Return"><i class="fa-solid fa-rotate-left"></i></button>${(b.fine_amount-b.amount_paid)>0?` <button class="btn-warning-sm" onclick="payFineModal(${b.id},'${esc(b.first_name)} ${esc(b.last_name)}',${b.fine_amount},${b.amount_paid})" title="Pay Fine"><i class="fa-solid fa-coins"></i></button>`:''}</td></tr>`).join('');
  const tf=records.reduce((s,b)=>s+parseFloat(b.fine_amount||0),0);
  const tp=records.reduce((s,b)=>s+parseFloat(b.amount_paid||0),0);
  setContent(`
    <div class="page-header"><div><h2><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i> Overdue Books</h2><p>${records.length} books past deadline · Fine rate: UGX 2,000/day</p></div></div>
    <div class="stat-cards" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card red"><div class="stat-card-icon"><i class="fa-solid fa-clock"></i></div><div class="stat-value">${records.length}</div><div class="stat-label">Overdue Books</div></div>
      <div class="stat-card orange"><div class="stat-card-icon"><i class="fa-solid fa-coins"></i></div><div class="stat-value">${fmtMoney(tf)}</div><div class="stat-label">Total Fines</div></div>
      <div class="stat-card red"><div class="stat-card-icon"><i class="fa-solid fa-exclamation"></i></div><div class="stat-value">${fmtMoney(tf-tp)}</div><div class="stat-label">Outstanding</div></div>
    </div>
    <div class="lms-card"><div class="lms-card-body"><div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Code</th><th>Book</th><th>Member</th><th>Issued</th><th>Due Date</th><th>Days Late</th><th>Fine</th><th>Outstanding</th><th>Actions</th></tr></thead><tbody>${rows||`<tr><td colspan="9"><div class="empty-state"><i class="fa-solid fa-check-circle" style="color:var(--success)"></i><p>No overdue books!</p></div></td></tr>`}</tbody></table></div></div></div>
  `);
}

/* ══════════════════════════════════════════════════════════
   FINES
══════════════════════════════════════════════════════════ */
async function renderFines(){
  setContent(spinner());
  const r=await apiFetch(API.members,{action:'fines'});
  const records=r?.data||[];
  const rows=records.map(m=>`<tr><td><span style="font-family:'IBM Plex Mono',monospace;font-size:11.5px">${esc(m.member_id)}</span></td><td><div style="font-weight:600">${esc(m.first_name)} ${esc(m.last_name)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(m.email)}</div></td><td>${typeBadge(m.member_type)}</td><td><span class="fine-amount">${fmtMoney(m.total_fines)}</span></td><td><span class="fine-amount clear">${fmtMoney(m.total_paid)}</span></td><td><span class="fine-amount owed">${fmtMoney(m.outstanding)}</span></td><td><button class="btn-warning-sm" onclick="viewMemberFines(${m.id})"><i class="fa-solid fa-coins"></i> Pay Fine</button></td></tr>`).join('');
  const to=records.reduce((s,r)=>s+parseFloat(r.outstanding||0),0);
  const tc=records.reduce((s,r)=>s+parseFloat(r.total_paid||0),0);
  setContent(`
    <div class="page-header"><div><h2><i class="fa-solid fa-coins" style="color:var(--gold)"></i> Fines &amp; Payments</h2><p>Members with outstanding fines · Rate: UGX 2,000/day</p></div></div>
    <div class="stat-cards" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card orange"><div class="stat-card-icon"><i class="fa-solid fa-users"></i></div><div class="stat-value">${records.length}</div><div class="stat-label">Members with Fines</div></div>
      <div class="stat-card green"><div class="stat-card-icon"><i class="fa-solid fa-check"></i></div><div class="stat-value">${fmtMoney(tc)}</div><div class="stat-label">Total Collected</div></div>
      <div class="stat-card red"><div class="stat-card-icon"><i class="fa-solid fa-exclamation"></i></div><div class="stat-value">${fmtMoney(to)}</div><div class="stat-label">Outstanding</div></div>
    </div>
    <div class="lms-card"><div class="lms-card-body"><div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Member ID</th><th>Name</th><th>Type</th><th>Total Fines</th><th>Paid</th><th>Outstanding</th><th>Action</th></tr></thead><tbody>${rows||`<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-coins" style="color:var(--success)"></i><p>No outstanding fines</p></div></td></tr>`}</tbody></table></div></div></div>
  `);
}

async function viewMemberFines(memberId){
  const r=await apiFetch(API.members,{action:'get',id:memberId});
  if(!r?.success){toast('Not found','error');return;}
  const m=r.data;
  const overdues=(m.borrow_history||[]).filter(b=>b.fine_amount>0&&b.fine_paid!=='yes');
  const rows=overdues.map(b=>`<tr><td style="font-size:12px">${esc(b.borrow_code)}</td><td style="font-size:12px">${esc(b.book_title)}</td><td style="font-size:12px">${b.days_overdue||0} days</td><td style="font-weight:700;color:var(--danger)">${fmtMoney(b.fine_amount)}</td><td style="color:var(--success)">${fmtMoney(b.amount_paid)}</td><td style="font-weight:700">${fmtMoney(b.fine_amount-b.amount_paid)}</td><td><button class="btn-warning-sm" onclick="payFineModal(${b.id},'${esc(m.first_name)} ${esc(m.last_name)}',${b.fine_amount},${b.amount_paid})">Pay</button></td></tr>`).join('');
  showModal(`<i class="fa-solid fa-coins me-2"></i>Fines — ${esc(m.first_name)} ${esc(m.last_name)}`,`
    <div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Code</th><th>Book</th><th>Days Late</th><th>Fine</th><th>Paid</th><th>Outstanding</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--text-muted)">No outstanding fines</td></tr>'}</tbody></table></div>
  `,`<button class="btn-navy" onclick="closeModal()">Close</button>`);
}

function payFineModal(borrowingId,memberName,fineAmount,amountPaid){
  const outstanding=fineAmount-amountPaid;
  showModal('<i class="fa-solid fa-coins me-2"></i>Record Fine Payment',`
    <div style="background:var(--warning-light);border-radius:8px;padding:14px;margin-bottom:16px;border:1px solid #fcd34d"><div style="font-weight:700;font-size:14px">${esc(memberName)}</div><div style="font-size:13px;margin-top:4px">Outstanding: <strong>${fmtMoney(outstanding)}</strong></div></div>
    <div class="row g-3">
      <div class="col-md-6"><label class="lms-label">Amount Paying (UGX)</label><input class="lms-input" id="payAmount" type="number" min="1" max="${outstanding}" value="${outstanding}" placeholder="Amount"/></div>
      <div class="col-md-6"><label class="lms-label">Payment Method</label><select class="lms-select" id="payMethod"><option value="cash">Cash</option><option value="mobile_money">Mobile Money</option><option value="bank">Bank Transfer</option></select></div>
    </div>
  `,`<button class="btn-navy" onclick="closeModal()">Cancel</button><button class="btn-warning-sm" style="padding:9px 20px;font-size:13px" onclick="submitPayFine(${borrowingId})"><i class="fa-solid fa-coins"></i> Record Payment</button>`);
}

async function submitPayFine(borrowingId){
  const amount=parseFloat(document.getElementById('payAmount').value);
  const method=document.getElementById('payMethod').value;
  if(!amount||amount<=0){toast('Enter a valid amount','error');return;}
  const r=await apiFetch(API.borrowings,{action:'pay_fine'},'POST',{borrowing_id:borrowingId,amount,payment_method:method});
  if(r?.success){toast(`Payment recorded! Receipt: ${r.data.receipt_number}`);closeModal();renderFines();}
  else toast(r?.message||'Failed','error');
}

/* ══════════════════════════════════════════════════════════
   REPORTS
══════════════════════════════════════════════════════════ */
function renderReports(){
  setContent(`
    <div class="page-header"><div><h2><i class="fa-solid fa-file-pdf" style="color:var(--danger)"></i> PDF Reports</h2><p>Generate and download library reports</p></div></div>
    <div class="report-grid">
      ${[
        {type:'borrowings',icon:'fa-list-check',color:'#3b82f6',bg:'#dbeafe',title:'All Borrowings',desc:'Complete borrowing history including all issued, returned and overdue books.'},
        {type:'active',icon:'fa-hand-holding-heart',color:'#16a34a',bg:'#dcfce7',title:'Currently Borrowed',desc:'All books currently out on loan with member details and due dates.'},
        {type:'overdue',icon:'fa-triangle-exclamation',color:'#dc2626',bg:'#fee2e2',title:'Overdue Books',desc:'Books past return deadline with fine calculations (UGX 2,000/day).'},
        {type:'fines',icon:'fa-coins',color:'#d97706',bg:'#fef9c3',title:'Fines & Payments',desc:'Summary of all fines owed, paid and outstanding per member.'},
        {type:'members',icon:'fa-users',color:'#7c3aed',bg:'#f3e8ff',title:'Members Report',desc:'Full register of all library members with borrowing statistics.'},
        {type:'books',icon:'fa-books',color:'#0d9488',bg:'#ccfbf1',title:'Books Inventory',desc:'Complete catalogue of all books with availability and shelf location.'},
      ].map(r=>`<div class="report-card"><div class="report-card-icon" style="background:${r.bg};color:${r.color}"><i class="fa-solid ${r.icon}"></i></div><h4>${r.title}</h4><p>${r.desc}</p><div class="report-card-actions"><button class="btn-accent" onclick="window.open(BASE+'/api/reports.php?type=${r.type}','_blank')"><i class="fa-solid fa-eye"></i> Preview</button><button class="btn-navy" onclick="window.open(BASE+'/api/reports.php?type=${r.type}&print=1','_blank')"><i class="fa-solid fa-download"></i> Download PDF</button></div></div>`).join('')}
    </div>
  `);
}

/* ── PAGINATION ───────────────────────────────────────────── */
function renderPagination(current,total,callPattern){
  const range=[]; let start=Math.max(1,current-2), end=Math.min(total,current+2);
  if(end-start<4){ start=Math.max(1,end-4); }
  for(let i=start;i<=end;i++) range.push(i);
  const btn=(i)=>`<button class="page-btn ${i===current?'active':''}" onclick="${callPattern.replace('{PAGE}',i)}">${i}</button>`;
  return `<div class="lms-pagination"><button class="page-btn" onclick="${callPattern.replace('{PAGE}',Math.max(1,current-1))}" ${current===1?'disabled':''}><i class="fa-solid fa-chevron-left"></i></button>${range.map(btn).join('')}<button class="page-btn" onclick="${callPattern.replace('{PAGE}',Math.min(total,current+1))}" ${current===total?'disabled':''}><i class="fa-solid fa-chevron-right"></i></button></div>`;
}

/* ── INIT ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  initDate();
  initSearch();
  initSidebar();
  initKeepalive();
  navigate('dashboard');
});

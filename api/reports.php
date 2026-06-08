<?php
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, no-cache, must-revalidate');
require_once '../includes/config.php';
requireAuth();

$db   = Database::getInstance();
$type = $_GET['type'] ?? 'borrowings';

// Recalc fines
$today = date('Y-m-d');
$db->execute("UPDATE borrowings SET status='overdue',days_overdue=DATEDIFF(?,due_date),fine_amount=DATEDIFF(?,due_date)*? WHERE status='active' AND due_date<?",[$today,$today,FINE_PER_DAY,$today],'ssds');
$db->execute("UPDATE borrowings SET days_overdue=DATEDIFF(?,due_date),fine_amount=DATEDIFF(?,due_date)*? WHERE status='overdue'",[$today,$today,FINE_PER_DAY],'ssd');

$user = currentUser();

switch($type) {
    case 'borrowings':
        $title = 'All Borrowings Report';
        $sub   = 'Complete borrowing history';
        $data  = $db->fetchAll("SELECT b.borrow_code,bk.title,bk.author,m.first_name,m.last_name,m.member_id as member_code,m.member_type,b.issue_date,b.due_date,b.return_date,b.status,b.days_overdue,b.fine_amount,b.amount_paid FROM borrowings b JOIN books bk ON b.book_id=bk.id JOIN members m ON b.member_id=m.id ORDER BY b.created_at DESC");
        $cols  = ['Code','Book Title','Author','First Name','Last Name','Member ID','Type','Issued','Due','Returned','Status','Days Late','Fine (UGX)','Paid (UGX)'];
        break;
    case 'active':
        $title = 'Currently Borrowed Books';
        $sub   = 'Books currently out on loan';
        $data  = $db->fetchAll("SELECT b.borrow_code,bk.title,bk.author,m.first_name,m.last_name,m.member_id as member_code,m.member_type,m.phone,b.issue_date,b.due_date,b.status,DATEDIFF(b.due_date,CURDATE()) as days_remaining FROM borrowings b JOIN books bk ON b.book_id=bk.id JOIN members m ON b.member_id=m.id WHERE b.status IN ('active','overdue') ORDER BY b.due_date ASC");
        $cols  = ['Code','Book Title','Author','First Name','Last Name','Member ID','Type','Phone','Issued','Due Date','Status','Days Remaining'];
        break;
    case 'overdue':
        $title = 'Overdue Books Report';
        $sub   = 'Books past their return deadline — Fine: UGX ' . number_format(FINE_PER_DAY) . '/day';
        $data  = $db->fetchAll("SELECT b.borrow_code,bk.title,m.first_name,m.last_name,m.member_id as member_code,m.phone,m.email,b.issue_date,b.due_date,b.days_overdue,b.fine_amount,(b.fine_amount-b.amount_paid) as outstanding FROM borrowings b JOIN books bk ON b.book_id=bk.id JOIN members m ON b.member_id=m.id WHERE b.status='overdue' ORDER BY b.due_date ASC");
        $cols  = ['Code','Book Title','First Name','Last Name','Member ID','Phone','Email','Issued','Due Date','Days Late','Fine (UGX)','Outstanding (UGX)'];
        break;
    case 'fines':
        $title = 'Fines & Payments Report';
        $sub   = 'Summary of all fines and payments per member';
        $data  = $db->fetchAll("SELECT m.member_id,m.first_name,m.last_name,m.member_type,m.email,SUM(b.fine_amount) as total_fines,SUM(b.amount_paid) as total_paid,SUM(b.fine_amount-b.amount_paid) as outstanding FROM members m JOIN borrowings b ON m.id=b.member_id WHERE b.fine_amount>0 GROUP BY m.id ORDER BY outstanding DESC");
        $cols  = ['Member ID','First Name','Last Name','Type','Email','Total Fines (UGX)','Paid (UGX)','Outstanding (UGX)'];
        break;
    case 'members':
        $title = 'Members Report';
        $sub   = 'All registered library members';
        $data  = $db->fetchAll("SELECT m.member_id,m.first_name,m.last_name,m.email,m.phone,m.member_type,m.status,m.registration_date,m.expiry_date,COUNT(b.id) as total_borrows FROM members m LEFT JOIN borrowings b ON m.id=b.member_id GROUP BY m.id ORDER BY m.created_at DESC");
        $cols  = ['Member ID','First Name','Last Name','Email','Phone','Type','Status','Registered','Expires','Total Borrows'];
        break;
    case 'books':
        $title = 'Books Inventory Report';
        $sub   = 'Complete library catalogue';
        $data  = $db->fetchAll("SELECT bk.title,bk.author,bk.isbn,c.name as category,bk.publisher,bk.publish_year,bk.edition,bk.total_copies,bk.available_copies,bk.shelf_location,bk.status FROM books bk LEFT JOIN categories c ON bk.category_id=c.id ORDER BY bk.title ASC");
        $cols  = ['Title','Author','ISBN','Category','Publisher','Year','Edition','Total','Available','Shelf','Status'];
        break;
    default:
        die('Invalid report type');
}

$genDate = date('d M Y, H:i');
$total   = count($data);

// Summaries for overdue/fines
$summaryHtml = '';
if ($type === 'overdue' && $data) {
    $tf = array_sum(array_column($data,'fine_amount'));
    $os = array_sum(array_column($data,'outstanding'));
    $summaryHtml = "<div class='sum-row'><div class='sum-card r'><div class='sv'>$total</div><div class='sl'>Overdue Books</div></div><div class='sum-card o'><div class='sv'>UGX ".number_format($tf)."</div><div class='sl'>Total Fines</div></div><div class='sum-card d'><div class='sv'>UGX ".number_format($os)."</div><div class='sl'>Outstanding</div></div></div>";
}
if ($type === 'fines' && $data) {
    $tf = array_sum(array_column($data,'total_fines'));
    $tp = array_sum(array_column($data,'total_paid'));
    $os = array_sum(array_column($data,'outstanding'));
    $summaryHtml = "<div class='sum-row'><div class='sum-card o'><div class='sv'>UGX ".number_format($tf)."</div><div class='sl'>Total Fines</div></div><div class='sum-card g'><div class='sv'>UGX ".number_format($tp)."</div><div class='sl'>Collected</div></div><div class='sum-card r'><div class='sv'>UGX ".number_format($os)."</div><div class='sl'>Outstanding</div></div></div>";
}

ob_start(); ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title><?=htmlspecialchars($title)?> — Hannah Library</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1a1a2e;background:#fff}
.page{padding:20px 28px}
.hdr{background:linear-gradient(135deg,#0d1b4b,#1a3a8b);color:#fff;padding:18px 28px;display:flex;justify-content:space-between;align-items:center}
.hdr-l h1{font-size:20px;font-weight:700}.hdr-l p{font-size:10px;opacity:.75;margin-top:3px}
.hdr-r{text-align:right;font-size:9.5px;opacity:.8}
.meta{display:flex;justify-content:space-between;align-items:flex-start;margin:16px 0;padding:12px 16px;background:#f0f4ff;border-left:4px solid #1a3a8b;border-radius:0 8px 8px 0}
.meta h2{font-size:15px;font-weight:700;color:#0d1b4b}.meta p{font-size:10px;color:#555;margin-top:2px}
.meta-r{text-align:right;font-size:10px;color:#666}
.sum-row{display:flex;gap:10px;margin-bottom:14px}
.sum-card{flex:1;padding:10px 14px;border-radius:8px;text-align:center;color:#fff}
.sum-card.r{background:#dc2626}.sum-card.o{background:#d97706}.sum-card.g{background:#16a34a}.sum-card.d{background:#7c3aed}
.sv{font-size:18px;font-weight:700}.sl{font-size:9px;opacity:.85;margin-top:2px;text-transform:uppercase;letter-spacing:.4px}
table{width:100%;border-collapse:collapse;font-size:9px}
thead tr{background:#0d1b4b;color:#fff}
thead th{padding:7px 6px;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.4px;font-size:8.5px;white-space:nowrap}
tbody tr:nth-child(even){background:#f8faff}
tbody td{padding:6px 6px;border-bottom:1px solid #e8ecf4;color:#2d3748}
.b-active{background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:10px;font-size:8px;font-weight:700}
.b-overdue{background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:10px;font-size:8px;font-weight:700}
.b-returned{background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:10px;font-size:8px;font-weight:700}
.b-student{background:#f3e8ff;color:#7c3aed;padding:2px 6px;border-radius:10px;font-size:8px;font-weight:700}
.b-lecturer{background:#ffedd5;color:#ea580c;padding:2px 6px;border-radius:10px;font-size:8px;font-weight:700}
.b-staff{background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:10px;font-size:8px;font-weight:700}
.b-researcher{background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:10px;font-size:8px;font-weight:700}
.empty{text-align:center;padding:40px;color:#999;font-size:13px}
.ftr{margin-top:22px;padding-top:10px;border-top:2px solid #e8ecf4;display:flex;justify-content:space-between;font-size:9px;color:#aaa}
.print-btn{position:fixed;top:14px;right:18px;background:#0d1b4b;color:#fff;border:none;padding:9px 18px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;z-index:999;box-shadow:0 4px 14px rgba(0,0,0,.3)}
.print-btn:hover{background:#1a3a8b}
@media print{.no-print{display:none!important};body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">⬇ Save / Print PDF</button>
<div class="hdr">
  <div class="hdr-l"><h1>📚 Hannah Library System</h1><p><?=INSTITUTION?></p></div>
  <div class="hdr-r"><div>Generated: <?=$genDate?></div><div>By: <?=htmlspecialchars($user['full_name'])?></div></div>
</div>
<div class="page">
  <div class="meta">
    <div><h2><?=htmlspecialchars($title)?></h2><p><?=htmlspecialchars($sub)?></p></div>
    <div class="meta-r"><span><strong>Total Records:</strong> <?=$total?></span><br/><span><strong>Academic Year:</strong> <?=date('Y').'/'.(date('Y')+1)?></span></div>
  </div>
  <?=$summaryHtml?>
  <?php if($data): ?>
  <table>
    <thead><tr><th>#</th><?php foreach($cols as $c): ?><th><?=htmlspecialchars($c)?></th><?php endforeach; ?></tr></thead>
    <tbody>
    <?php foreach($data as $i=>$row): $vals=array_values($row); ?>
    <tr>
      <td><?=$i+1?></td>
      <?php foreach($vals as $ki=>$v): ?>
      <td><?php
        $col = strtolower($cols[$ki] ?? '');
        if(str_contains($col,'status')&&$v){echo "<span class='b-".htmlspecialchars($v)."'>".htmlspecialchars($v)."</span>";}
        elseif(str_contains($col,'type')&&$v){echo "<span class='b-".htmlspecialchars($v)."'>".htmlspecialchars($v)."</span>";}
        elseif(str_contains($col,'ugx')&&is_numeric($v)){echo $v>0?'UGX '.number_format($v):'—';}
        elseif((str_contains($col,'date')||str_contains($col,'issued')||str_contains($col,'due')||str_contains($col,'returned')||str_contains($col,'registered')||str_contains($col,'expires'))&&$v){echo date('d/m/Y',strtotime($v));}
        else{echo htmlspecialchars($v??'—');}
      ?></td>
      <?php endforeach; ?>
    </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <?php else: ?>
  <div class="empty">No records found for this report.</div>
  <?php endif; ?>
  <div class="ftr">
    <span>Hannah School of Health Sciences Library — Iganga, Uganda</span>
    <span>Fine Rate: UGX <?=number_format(FINE_PER_DAY)?>/day overdue — Generated <?=$genDate?></span>
  </div>
</div>
<script>if(new URLSearchParams(location.search).get('print')==='1')window.onload=()=>window.print();</script>
</body></html>
<?php
echo ob_get_clean();

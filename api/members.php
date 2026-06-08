<?php
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
require_once '../includes/config.php';
requireAuth();

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

function generateMemberId($type, $db) {
    $prefix = ['student'=>'STU','lecturer'=>'LEC','staff'=>'STF','researcher'=>'RES'][$type] ?? 'MEM';
    $year   = date('Y');
    $last   = $db->fetchOne("SELECT member_id FROM members WHERE member_id LIKE '{$prefix}-{$year}-%' ORDER BY id DESC LIMIT 1");
    $num    = $last ? ((int)substr($last['member_id'], -3) + 1) : 1;
    return $prefix . '-' . $year . '-' . str_pad($num, 3, '0', STR_PAD_LEFT);
}

try {
    switch ($method) {
        case 'GET':
            if ($action === 'search') {
                $q  = '%' . sanitize($_GET['q'] ?? '') . '%';
                $tp = $_GET['type']   ?? '';
                $st = $_GET['status'] ?? '';
                $sql = "SELECT * FROM members WHERE (first_name LIKE ? OR last_name LIKE ? OR member_id LIKE ? OR email LIKE ?)";
                $p = [$q,$q,$q,$q]; $t = 'ssss';
                if ($tp) { $sql .= " AND member_type=?"; $p[]=$tp; $t.='s'; }
                if ($st) { $sql .= " AND status=?";      $p[]=$st; $t.='s'; }
                $sql .= " ORDER BY first_name ASC";
                response(true, 'OK', $db->fetchAll($sql,$p,$t));
            } elseif ($action === 'get') {
                $id = (int)($_GET['id'] ?? 0);
                $m  = $db->fetchOne("SELECT * FROM members WHERE id=?",[$id],'i');
                if (!$m) response(false,'Member not found');
                $m['borrow_history'] = $db->fetchAll(
                    "SELECT b.*,bk.title as book_title,bk.author FROM borrowings b JOIN books bk ON b.book_id=bk.id WHERE b.member_id=? ORDER BY b.created_at DESC LIMIT 20",
                    [$id],'i'
                );
                response(true,'OK',$m);
            } elseif ($action === 'stats') {
                $total      = $db->fetchOne("SELECT COUNT(*) as c FROM members")['c'];
                $active     = $db->fetchOne("SELECT COUNT(*) as c FROM members WHERE status='active'")['c'];
                $with_books = $db->fetchOne("SELECT COUNT(DISTINCT member_id) as c FROM borrowings WHERE status IN ('active','overdue')")['c'];
                $fines_due  = $db->fetchOne("SELECT COALESCE(SUM(fine_amount-amount_paid),0) as c FROM borrowings WHERE fine_paid!='yes' AND fine_amount>0")['c'];
                response(true,'OK',compact('total','active','with_books','fines_due'));
            } elseif ($action === 'fines') {
                $rows = $db->fetchAll(
                    "SELECT m.id,m.member_id,m.first_name,m.last_name,m.email,m.member_type,
                     SUM(b.fine_amount) as total_fines, SUM(b.amount_paid) as total_paid,
                     SUM(b.fine_amount-b.amount_paid) as outstanding
                     FROM members m JOIN borrowings b ON m.id=b.member_id
                     WHERE b.fine_amount>0
                     GROUP BY m.id HAVING outstanding>0 ORDER BY outstanding DESC"
                );
                response(true,'OK',$rows);
            } else {
                $page  = max(1,(int)($_GET['page']??1));
                $limit = 20; $offset = ($page-1)*$limit;
                $rows  = $db->fetchAll(
                    "SELECT m.*,(SELECT COUNT(*) FROM borrowings WHERE member_id=m.id AND status IN ('active','overdue')) as current_borrows FROM members m ORDER BY m.created_at DESC LIMIT $limit OFFSET $offset"
                );
                $total = $db->fetchOne("SELECT COUNT(*) as c FROM members")['c'];
                response(true,'OK',['members'=>$rows,'total'=>$total,'page'=>$page,'pages'=>ceil($total/$limit)]);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            if ($action === 'add') {
                foreach (['first_name','last_name','email'] as $f)
                    if (empty($data[$f])) response(false,"Field '$f' is required");
                $type      = $data['member_type'] ?? 'student';
                $member_id = generateMemberId($type, $db);
                $expiry    = date('Y-m-d', strtotime(in_array($type,['lecturer','staff']) ? '+3 years' : '+2 years'));
                $res = $db->execute(
                    "INSERT INTO members (member_id,first_name,last_name,email,phone,address,member_type,gender,date_of_birth,expiry_date) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    [$member_id,sanitize($data['first_name']),sanitize($data['last_name']),sanitize($data['email']),sanitize($data['phone']??''),sanitize($data['address']??''),$type,sanitize($data['gender']??'male'),$data['date_of_birth']??null,$expiry],
                    'ssssssssss'
                );
                if ($res['success']) {
                    logActivity('add_member',"Registered: $member_id");
                    response(true,'Member registered',['id'=>$res['insert_id'],'member_id'=>$member_id]);
                }
                response(false,'Registration failed — email may already exist');
            }
            break;

        case 'PUT':
            $data = json_decode(file_get_contents('php://input'), true);
            $id   = (int)($data['id'] ?? 0);
            if (!$id) response(false,'Member ID required');
            $res = $db->execute(
                "UPDATE members SET first_name=?,last_name=?,email=?,phone=?,address=?,member_type=?,gender=?,status=? WHERE id=?",
                [sanitize($data['first_name']??''),sanitize($data['last_name']??''),sanitize($data['email']??''),sanitize($data['phone']??''),sanitize($data['address']??''),sanitize($data['member_type']??'student'),sanitize($data['gender']??'male'),sanitize($data['status']??'active'),$id],
                'ssssssssi'
            );
            if ($res['success']) logActivity('edit_member',"Edited member ID $id");
            response($res['success'],$res['success']?'Member updated':'Update failed');
            break;

        case 'DELETE':
            $id     = (int)($_GET['id']??0);
            $active = (int)$db->fetchOne("SELECT COUNT(*) as c FROM borrowings WHERE member_id=? AND status IN ('active','overdue')",[$id],'i')['c'];
            if ($active) response(false,'Cannot delete — member has active borrowings');
            $res = $db->execute("DELETE FROM members WHERE id=?",[$id],'i');
            if ($res['success']) logActivity('delete_member',"Deleted member ID $id");
            response($res['success'],$res['success']?'Member deleted':'Delete failed');
            break;
    }
} catch (Exception $e) {
    response(false,'Server error. Please try again.');
}

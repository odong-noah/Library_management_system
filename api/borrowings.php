<?php
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
require_once '../includes/config.php';
requireAuth();

$db     = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

function generateBorrowCode($db) {
    $year = date('Y');
    $last = $db->fetchOne("SELECT borrow_code FROM borrowings WHERE borrow_code LIKE 'BRW-{$year}-%' ORDER BY id DESC LIMIT 1");
    $num  = $last ? ((int)substr($last['borrow_code'], -4) + 1) : 1;
    return 'BRW-' . $year . '-' . str_pad($num, 4, '0', STR_PAD_LEFT);
}

function recalcFines($db) {
    $today = date('Y-m-d');
    // Mark newly overdue
    $db->execute(
        "UPDATE borrowings SET status='overdue', days_overdue=DATEDIFF(?,due_date), fine_amount=DATEDIFF(?,due_date)*? WHERE status='active' AND due_date < ?",
        [$today,$today,FINE_PER_DAY,$today],'ssds'
    );
    // Refresh already-overdue
    $db->execute(
        "UPDATE borrowings SET days_overdue=DATEDIFF(?,due_date), fine_amount=DATEDIFF(?,due_date)*?, fine_paid=CASE WHEN amount_paid>=(DATEDIFF(?,due_date)*?) THEN 'yes' WHEN amount_paid>0 THEN 'partial' ELSE 'no' END WHERE status='overdue'",
        [$today,$today,FINE_PER_DAY,$today,FINE_PER_DAY],'ssdsd'
    );
}

try {
    recalcFines($db);

    switch ($method) {
        case 'GET':
            if ($action === 'active') {
                $rows = $db->fetchAll(
                    "SELECT b.*,bk.title as book_title,bk.author,bk.isbn,m.first_name,m.last_name,m.member_id as member_code,m.email,m.phone,m.member_type,DATEDIFF(CURDATE(),b.due_date) as days_late FROM borrowings b JOIN books bk ON b.book_id=bk.id JOIN members m ON b.member_id=m.id WHERE b.status IN ('active','overdue') ORDER BY b.due_date ASC"
                );
                response(true,'OK',$rows);
            } elseif ($action === 'overdue') {
                $rows = $db->fetchAll(
                    "SELECT b.*,bk.title as book_title,bk.author,m.first_name,m.last_name,m.member_id as member_code,m.email,m.phone,DATEDIFF(CURDATE(),b.due_date) as days_late FROM borrowings b JOIN books bk ON b.book_id=bk.id JOIN members m ON b.member_id=m.id WHERE b.status='overdue' ORDER BY b.due_date ASC"
                );
                response(true,'OK',$rows);
            } elseif ($action === 'history') {
                $page   = max(1,(int)($_GET['page']??1));
                $limit  = 25; $offset = ($page-1)*$limit;
                $st     = $_GET['status'] ?? '';
                $sql    = "SELECT b.*,bk.title as book_title,bk.author,m.first_name,m.last_name,m.member_id as member_code,m.member_type FROM borrowings b JOIN books bk ON b.book_id=bk.id JOIN members m ON b.member_id=m.id WHERE 1=1";
                $p=[]; $t='';
                if ($st) { $sql.=" AND b.status=?"; $p[]=$st; $t.='s'; }
                $sql .= " ORDER BY b.created_at DESC LIMIT $limit OFFSET $offset";
                $rows  = $db->fetchAll($sql,$p,$t);
                $total = $db->fetchOne("SELECT COUNT(*) as c FROM borrowings")['c'];
                response(true,'OK',['records'=>$rows,'total'=>$total,'page'=>$page,'pages'=>ceil($total/$limit)]);
            } elseif ($action === 'dashboard_stats') {
                $stats = [
                    'total_books'        => $db->fetchOne("SELECT COUNT(*) as c FROM books")['c'],
                    'available_books'    => $db->fetchOne("SELECT COALESCE(SUM(available_copies),0) as c FROM books")['c'],
                    'total_members'      => $db->fetchOne("SELECT COUNT(*) as c FROM members WHERE status='active'")['c'],
                    'active_borrows'     => $db->fetchOne("SELECT COUNT(*) as c FROM borrowings WHERE status='active'")['c'],
                    'overdue_borrows'    => $db->fetchOne("SELECT COUNT(*) as c FROM borrowings WHERE status='overdue'")['c'],
                    'total_fines_due'    => $db->fetchOne("SELECT COALESCE(SUM(fine_amount-amount_paid),0) as c FROM borrowings WHERE fine_paid!='yes' AND fine_amount>0")['c'],
                    'total_fines_collected' => $db->fetchOne("SELECT COALESCE(SUM(amount_paid),0) as c FROM borrowings WHERE amount_paid>0")['c'],
                    'borrows_this_month' => $db->fetchOne("SELECT COUNT(*) as c FROM borrowings WHERE MONTH(issue_date)=MONTH(CURDATE()) AND YEAR(issue_date)=YEAR(CURDATE())")['c'],
                    'returns_this_month' => $db->fetchOne("SELECT COUNT(*) as c FROM borrowings WHERE MONTH(return_date)=MONTH(CURDATE()) AND YEAR(return_date)=YEAR(CURDATE())")['c'],
                    'most_borrowed'      => $db->fetchAll("SELECT bk.title,COUNT(*) as borrows FROM borrowings b JOIN books bk ON b.book_id=bk.id GROUP BY b.book_id ORDER BY borrows DESC LIMIT 5"),
                    'recent_activity'    => $db->fetchAll("SELECT b.*,bk.title as book_title,m.first_name,m.last_name,m.member_id as member_code FROM borrowings b JOIN books bk ON b.book_id=bk.id JOIN members m ON b.member_id=m.id ORDER BY b.created_at DESC LIMIT 8"),
                    'monthly_borrows'    => $db->fetchAll("SELECT DATE_FORMAT(issue_date,'%b %Y') as month,COUNT(*) as count FROM borrowings WHERE issue_date>=DATE_SUB(CURDATE(),INTERVAL 6 MONTH) GROUP BY YEAR(issue_date),MONTH(issue_date) ORDER BY issue_date ASC"),
                    'fine_per_day'       => FINE_PER_DAY,
                ];
                response(true,'OK',$stats);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            if ($action === 'issue') {
                $book_id   = (int)($data['book_id']   ?? 0);
                $member_id = (int)($data['member_id'] ?? 0);
                if (!$book_id || !$member_id) response(false,'Book and member are required');

                $book   = $db->fetchOne("SELECT * FROM books WHERE id=?",[$book_id],'i');
                if (!$book)                          response(false,'Book not found');
                if ($book['available_copies'] < 1)  response(false,'No copies available');

                $member = $db->fetchOne("SELECT * FROM members WHERE id=?",[$member_id],'i');
                if (!$member)                        response(false,'Member not found');
                if ($member['status'] !== 'active')  response(false,'Member account is not active');

                $existing = $db->fetchOne("SELECT id FROM borrowings WHERE book_id=? AND member_id=? AND status IN ('active','overdue')",[$book_id,$member_id],'ii');
                if ($existing) response(false,'Member already has this book on loan');

                // Outstanding fines check
                $outstanding = $db->fetchOne("SELECT COALESCE(SUM(fine_amount-amount_paid),0) as total FROM borrowings WHERE member_id=? AND fine_paid!='yes' AND fine_amount>0",[$member_id],'i');
                if ((float)$outstanding['total'] > 0) response(false,'Member has unpaid fines of UGX ' . number_format($outstanding['total']) . '. Please clear fines before issuing more books.');

                $days        = max(1,min(60,(int)($data['loan_days'] ?? LOAN_PERIOD_DAYS)));
                $issue_date  = date('Y-m-d');
                $due_date    = date('Y-m-d', strtotime("+$days days"));
                $borrow_code = generateBorrowCode($db);

                $res = $db->execute(
                    "INSERT INTO borrowings (borrow_code,book_id,member_id,issue_date,due_date,fine_per_day,notes,issued_by) VALUES (?,?,?,?,?,?,?,?)",
                    [$borrow_code,$book_id,$member_id,$issue_date,$due_date,FINE_PER_DAY,sanitize($data['notes']??''),$_SESSION['librarian_id']],
                    'siissdsi'
                );
                if (!$res['success']) response(false,'Failed to issue book');

                $db->execute("UPDATE books SET available_copies=available_copies-1 WHERE id=?",[$book_id],'i');
                logActivity('issue_book',"Issued '$borrow_code' to member ID $member_id");
                response(true,'Book issued successfully',['borrow_code'=>$borrow_code,'due_date'=>$due_date,'fine_per_day'=>FINE_PER_DAY]);
            }

            if ($action === 'return') {
                $id = (int)($data['id'] ?? 0);
                if (!$id) response(false,'Borrowing ID required');
                $borrow = $db->fetchOne("SELECT * FROM borrowings WHERE id=?",[$id],'i');
                if (!$borrow)                      response(false,'Record not found');
                if ($borrow['status']==='returned') response(false,'Book already returned');

                $today = date('Y-m-d');
                $fine  = 0; $days_overdue = 0;
                if (strtotime($today) > strtotime($borrow['due_date'])) {
                    $days_overdue = (int)((strtotime($today) - strtotime($borrow['due_date'])) / 86400);
                    $fine = $days_overdue * FINE_PER_DAY;
                }
                $fine_paid = $fine > 0 ? 'no' : 'yes';

                $db->execute(
                    "UPDATE borrowings SET status='returned',return_date=?,days_overdue=?,fine_amount=?,fine_paid=?,returned_by=? WHERE id=?",
                    [$today,$days_overdue,$fine,$fine_paid,$_SESSION['librarian_id'],$id],'sidsii'
                );
                $db->execute("UPDATE books SET available_copies=available_copies+1 WHERE id=?",[$borrow['book_id']],'i');
                logActivity('return_book',"Returned borrowing $id. Fine: $fine");
                response(true,'Book returned successfully',['fine_amount'=>$fine,'days_overdue'=>$days_overdue,'fine_per_day'=>FINE_PER_DAY]);
            }

            if ($action === 'pay_fine') {
                $bid    = (int)($data['borrowing_id'] ?? 0);
                $amount = (float)($data['amount']     ?? 0);
                if (!$bid || $amount <= 0) response(false,'Invalid payment data');

                $borrow = $db->fetchOne("SELECT * FROM borrowings WHERE id=?",[$bid],'i');
                if (!$borrow) response(false,'Borrowing not found');

                $new_paid  = (float)$borrow['amount_paid'] + $amount;
                $fine_paid = $new_paid >= (float)$borrow['fine_amount'] ? 'yes' : 'partial';
                $db->execute("UPDATE borrowings SET amount_paid=?,fine_paid=? WHERE id=?",[$new_paid,$fine_paid,$bid],'dsi');

                $receipt = 'RCP-' . date('Y') . '-' . strtoupper(substr(md5(uniqid()),0,6));
                $db->execute(
                    "INSERT INTO fine_payments (borrowing_id,member_id,amount,payment_method,receipt_number,received_by) VALUES (?,?,?,?,?,?)",
                    [$bid,$borrow['member_id'],$amount,sanitize($data['payment_method']??'cash'),$receipt,$_SESSION['librarian_id']],
                    'iidssi'
                );
                logActivity('pay_fine',"Fine payment of UGX $amount for borrowing $bid. Receipt: $receipt");
                response(true,'Payment recorded',['receipt_number'=>$receipt,'fine_paid'=>$fine_paid,'new_paid'=>$new_paid]);
            }
            break;
    }
} catch (Exception $e) {
    response(false,'Server error. Please try again.');
}

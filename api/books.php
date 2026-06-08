<?php
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
require_once '../includes/config.php';
requireAuth();

$db     = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'search') {
                $q   = '%' . sanitize($_GET['q'] ?? '') . '%';
                $cat = $_GET['category'] ?? '';
                $st  = $_GET['status']   ?? '';
                $sql = "SELECT b.*, c.name as category_name FROM books b LEFT JOIN categories c ON b.category_id=c.id WHERE (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)";
                $p   = [$q,$q,$q]; $t = 'sss';
                if ($cat) { $sql .= " AND b.category_id=?"; $p[] = $cat; $t .= 'i'; }
                if ($st)  { $sql .= " AND b.status=?";      $p[] = $st;  $t .= 's'; }
                $sql .= " ORDER BY b.title ASC";
                response(true, 'OK', $db->fetchAll($sql, $p, $t));
            } elseif ($action === 'get') {
                $id = (int)($_GET['id'] ?? 0);
                $b  = $db->fetchOne("SELECT b.*, c.name as category_name FROM books b LEFT JOIN categories c ON b.category_id=c.id WHERE b.id=?", [$id], 'i');
                if (!$b) response(false, 'Book not found');
                response(true, 'OK', $b);
            } elseif ($action === 'categories') {
                response(true, 'OK', $db->fetchAll("SELECT * FROM categories ORDER BY name ASC"));
            } elseif ($action === 'stats') {
                $total     = $db->fetchOne("SELECT COUNT(*) as c FROM books")['c'];
                $available = $db->fetchOne("SELECT COALESCE(SUM(available_copies),0) as c FROM books")['c'];
                $borrowed  = $db->fetchOne("SELECT COUNT(*) as c FROM borrowings WHERE status IN ('active','overdue')")['c'];
                $overdue   = $db->fetchOne("SELECT COUNT(*) as c FROM borrowings WHERE status='overdue'")['c'];
                response(true, 'OK', compact('total','available','borrowed','overdue'));
            } else {
                $page   = max(1,(int)($_GET['page'] ?? 1));
                $limit  = 20; $offset = ($page-1)*$limit;
                $books  = $db->fetchAll("SELECT b.*, c.name as category_name FROM books b LEFT JOIN categories c ON b.category_id=c.id ORDER BY b.created_at DESC LIMIT $limit OFFSET $offset");
                $total  = $db->fetchOne("SELECT COUNT(*) as c FROM books")['c'];
                response(true, 'OK', ['books'=>$books,'total'=>$total,'page'=>$page,'pages'=>ceil($total/$limit)]);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            if ($action === 'add') {
                if (empty($data['title']) || empty($data['author'])) response(false, 'Title and Author required');
                $copies = max(1,(int)($data['total_copies'] ?? 1));
                $res = $db->execute(
                    "INSERT INTO books (title,author,isbn,category_id,publisher,publish_year,edition,total_copies,available_copies,shelf_location,description) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    [sanitize($data['title']),sanitize($data['author']),sanitize($data['isbn']??'')?:null,(int)($data['category_id']??0)?:null,sanitize($data['publisher']??'')?:null,(int)($data['publish_year']??0)?:null,sanitize($data['edition']??'')?:null,$copies,$copies,sanitize($data['shelf_location']??'')?:null,sanitize($data['description']??'')?:null],
                    'sssisssiiss'
                );
                if ($res['success']) {
                    logActivity('add_book', "Added book: " . sanitize($data['title']));
                    response(true, 'Book added successfully', ['id'=>$res['insert_id']]);
                }
                response(false, 'Failed to add book');
            } elseif ($action === 'add_category') {
                $name = sanitize($data['name'] ?? '');
                if (!$name) response(false, 'Category name required');
                $res = $db->execute("INSERT INTO categories (name,description) VALUES (?,?)", [$name, sanitize($data['description']??'')], 'ss');
                response($res['success'], $res['success']?'Category added':'Failed', ['id'=>$res['insert_id']]);
            }
            break;

        case 'PUT':
            $data = json_decode(file_get_contents('php://input'), true);
            $id   = (int)($data['id'] ?? 0);
            if (!$id) response(false, 'Book ID required');
            $copies = max(1,(int)($data['total_copies']??1));
            $active = (int)$db->fetchOne("SELECT COUNT(*) as c FROM borrowings WHERE book_id=? AND status IN ('active','overdue')",[$id],'i')['c'];
            $avail  = max(0,$copies-$active);
            $res = $db->execute(
                "UPDATE books SET title=?,author=?,isbn=?,category_id=?,publisher=?,publish_year=?,edition=?,total_copies=?,available_copies=?,shelf_location=?,description=?,status=? WHERE id=?",
                [sanitize($data['title']??''),sanitize($data['author']??''),sanitize($data['isbn']??'')?:null,(int)($data['category_id']??0)?:null,sanitize($data['publisher']??'')?:null,(int)($data['publish_year']??0)?:null,sanitize($data['edition']??'')?:null,$copies,$avail,sanitize($data['shelf_location']??'')?:null,sanitize($data['description']??'')?:null,sanitize($data['status']??'available'),$id],
                'sssisssiisssi'
            );
            if ($res['success']) logActivity('edit_book', "Edited book ID $id");
            response($res['success'], $res['success']?'Book updated':'Update failed');
            break;

        case 'DELETE':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) response(false, 'Book ID required');
            $active = (int)$db->fetchOne("SELECT COUNT(*) as c FROM borrowings WHERE book_id=? AND status IN ('active','overdue')",[$id],'i')['c'];
            if ($active) response(false, 'Cannot delete — book has active borrowings');
            $res = $db->execute("DELETE FROM books WHERE id=?",[$id],'i');
            if ($res['success']) logActivity('delete_book',"Deleted book ID $id");
            response($res['success'], $res['success']?'Book deleted':'Delete failed');
            break;
    }
} catch (Exception $e) {
    response(false, 'Server error. Please try again.');
}

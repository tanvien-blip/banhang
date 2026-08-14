/* ==========================================================================
   TVERP — LÕI HỆ THỐNG
   Kho dữ liệu (LocalStorage), tiện ích định dạng, đánh số chứng từ tự động,
   ngữ cảnh "Đơn vị đang làm việc", thùng rác, sao lưu / khôi phục.
   ========================================================================== */
(function (W) {
'use strict';

var KEY = 'tverp.db.v2';
var T = {};

/* ------------------------------------------------------------------ TIỆN ÍCH */
T.esc = function (s) {
    return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
T.kd = function (s) {                                   // bỏ dấu tiếng Việt để tìm kiếm
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
};
T.money = function (v) {
    var n = Number(v || 0);
    return (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('vi-VN');
};
T.num = function (v, d) {
    return Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: d === undefined ? 2 : d });
};
T.pct = function (v) { return T.num(v, 1) + '%'; };

/**
 * ĐỌC SỐ TỪ Ô NHẬP — chấp nhận cả số thô lẫn chuỗi đã định dạng kiểu Việt Nam.
 *   T.so(6202480)      → 6202480
 *   T.so('6.202.480')  → 6202480
 *   T.so('12,5')       → 12.5        (dấu phẩy là dấu thập phân)
 *   T.so('-1.500')     → -1500
 *   T.so('abc')        → 0
 * Dùng thay cho Number(...) ở mọi chỗ đọc tiền / số lượng do người dùng gõ.
 */
T.so = function (v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v === null || v === undefined) return 0;
    var s = String(v).trim();
    if (!s) return 0;
    var am = s.charAt(0) === '-';
    s = s.replace(/[^\d.,]/g, '');
    var i = s.lastIndexOf(',');                     // dấu phẩy = dấu thập phân
    var nguyen = (i >= 0 ? s.slice(0, i) : s).replace(/\./g, '');   // dấu chấm = phân cách nghìn
    var le = i >= 0 ? s.slice(i + 1).replace(/[^\d]/g, '') : '';
    var n = Number((nguyen || '0') + (le ? '.' + le : ''));
    if (!isFinite(n)) n = 0;
    return am ? -n : n;
};

/** Định dạng số để ĐƯA VÀO ô nhập (không kèm đơn vị tiền). */
T.soVe = function (v, le) {
    var n = T.so(v);
    if (!n && n !== 0) return '';
    return n.toLocaleString('vi-VN', { maximumFractionDigits: le === undefined ? 0 : le });
};

T.date = function (iso) {                                // 2026-08-01 -> 01/08/2026
    if (!iso) return '';
    var p = String(iso).substr(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
};
/**
 * Đọc một ô ngày từ tệp Excel về dạng chuẩn NĂM-THÁNG-NGÀY.
 * Chấp nhận: 05/08/2026 · 5-8-2026 · 2026-08-05 · số ngày của Excel.
 * Không đọc được thì trả về chuỗi rỗng để bên gọi báo lỗi theo từng dòng.
 */
T.docNgay = function (v) {
    if (v === undefined || v === null || v === '') return '';
    if (typeof v === 'number' && v > 0) {                 // số ngày của Excel (mốc 30/12/1899)
        var d0 = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
        return d0.getUTCFullYear() + '-' + ('0' + (d0.getUTCMonth() + 1)).slice(-2) +
               '-' + ('0' + d0.getUTCDate()).slice(-2);
    }
    var s = String(v).trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s);
    if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
};
T.today = function () {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
};
T.now = function () {
    var d = new Date();
    return T.today() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
};
/** '2026-08-02 15:40' -> '02/08/2026 15:40' */
/** Hoãn gọi một hàm cho tới khi người dùng ngừng gõ — dùng cho ô tìm kiếm. */
T.tre = function (f, ms) {
    var t = null;
    return function () {
        var a = arguments, x = this;
        if (t) clearTimeout(t);
        t = setTimeout(function () { t = null; f.apply(x, a); }, ms || 250);
    };
};
T.dateTime = function (v) {
    if (!v) return '';
    var p = String(v).split(' ');
    return T.date(p[0]) + (p[1] ? ' ' + p[1] : '');
};
T.addDays = function (iso, n) {
    var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
};
T.thang = function (iso) { return iso ? Number(String(iso).substr(5, 2)) : 0; };
/* Số ngày từ ngày a đến ngày b (b − a), tính theo ngày lịch. Dùng cho lịch sao
   lưu, hạn thanh toán, hạn giao hàng — không phụ thuộc giờ trong ngày. */
T.soNgay = function (a, b) {
    a = String(a || '').substr(0, 10); b = String(b || '').substr(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return 0;
    var x = new Date(a + 'T00:00:00'), y = new Date(b + 'T00:00:00');
    return Math.round((y - x) / 86400000);
};
/* Mã định danh nội bộ. Phần đuôi KHÔNG lấy số ngẫu nhiên thuần: nhập một tệp
   hàng chục nghìn dòng sinh ra hàng nghìn bản ghi trong cùng một mili giây, số
   ngẫu nhiên sẽ trùng. Ở đây đuôi là một bộ đếm tăng dần trong từng mili giây,
   khởi điểm ngẫu nhiên để hai máy khác nhau cũng khó đụng nhau. */
var _uidLuc = 0, _uidDem = 0, UID_MOD = 46656;      // 36^3
T.uid = function (p) {
    var t = Date.now();
    if (t !== _uidLuc) { _uidLuc = t; _uidDem = Math.floor(Math.random() * UID_MOD); }
    _uidDem = (_uidDem + 1) % UID_MOD;
    return (p || 'X') + t.toString(36).toUpperCase().slice(-6) +
        ('00' + _uidDem.toString(36).toUpperCase()).slice(-3);
};
T.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
/**
 * GHÉP DỮ LIỆU MỚI VÀO BẢN GHI CŨ MÀ KHÔNG LÀM MẤT TRƯỜNG NÀO.
 * DB.update thay thế TOÀN BỘ bản ghi, nên mọi nơi cập nhật một phần đều phải
 * ghép qua đây: trường nào bản mới không nhắc tới thì giữ nguyên như cũ.
 */
T.gopGiu = function (cu, moi) {
    var o = cu ? T.clone(cu) : {}, k;
    for (k in (moi || {})) if (Object.prototype.hasOwnProperty.call(moi, k)) o[k] = moi[k];
    return o;
};
T.sum = function (arr, f) {
    var s = 0; for (var i = 0; i < arr.length; i++) s += Number(f ? f(arr[i]) : arr[i]) || 0; return s;
};
T.groupBy = function (arr, f) {
    var m = {}; arr.forEach(function (x) { var k = f(x); (m[k] = m[k] || []).push(x); }); return m;
};

/* --------------------------------------------------- ĐỌC SỐ THÀNH CHỮ TIẾNG VIỆT */
var CS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function doc3(n, day) {
    var t = Math.floor(n / 100), c = Math.floor((n % 100) / 10), d = n % 10, r = '';
    if (t > 0) { r += CS[t] + ' trăm'; if (c === 0 && d > 0) r += ' lẻ'; }
    else if (day && (c > 0 || d > 0)) { /* nhóm giữa */ }
    if (c > 1) { r += ' ' + CS[c] + ' mươi'; if (d === 1) r += ' mốt'; else if (d === 5) r += ' lăm'; else if (d > 0) r += ' ' + CS[d]; }
    else if (c === 1) { r += ' mười'; if (d === 5) r += ' lăm'; else if (d > 0) r += ' ' + CS[d]; }
    else if (d > 0) { r += ' ' + CS[d]; }
    return r.trim();
}
T.docTien = function (v) {
    var n = Math.round(Math.abs(Number(v) || 0));
    if (n === 0) return 'Không đồng';
    var don = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'], gr = [], i = 0;
    while (n > 0) { gr.push(n % 1000); n = Math.floor(n / 1000); }
    var out = [];
    for (i = gr.length - 1; i >= 0; i--) {
        if (gr[i] === 0) continue;
        out.push(doc3(gr[i], i !== gr.length - 1) + don[i]);
    }
    var s = out.join(' ').replace(/\s+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1) + ' đồng';
};

/* ------------------------------------------------------------------ KHO DỮ LIỆU */
var COLS = ['donVi', 'kho', 'khachHang', 'nhaCungCap', 'hangHoa', 'bangGia',
            'baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'bienBanGiao',
            'bienBanNghiemThu', 'deNghiTT', 'phieuThu', 'donMua', 'phieuChi',
            'nguoiDung', 'nhanVien', 'vaiTro', 'thungRac', 'nhatKy',
            'loNhap', 'phieuNhap', 'lichSuGiaVon', 'giaNoiBo', 'bangGiaBan',
            'kiemKe', 'dieuChinhKho', 'theKho',
            'nhomHang', 'dvt', 'hangSX', 'thueSuat', 'dieuKhoanTT', 'dieuKhoanGH', 'nguoiKy',
            'loaiGia', 'mauBangGia', 'tepGoc',
            'duAn', 'butToanNB', 'gopDuLieu', 'loaiHopDong', 'khoanMucChi',
            /* --- BỐN BẢNG aiDeXuat · aiNhatKy · aiBaseline · aiBoQua.
               Tính năng AI cố vấn ĐÃ ĐƯỢC GỠ khỏi phần mềm. Bốn bảng này được
               GIỮ NGUYÊN vì chúng là DỮ LIỆU đã phát sinh, không phải mã AI:
               xóa đi là xóa dữ liệu thật và làm đổi cấu trúc sao lưu. Không
               còn màn hình nào ghi vào chúng nữa.
               Mô tả gốc: (v16.0.0). Hai bảng này KHÔNG
               chứa số liệu nghiệp vụ: aiDeXuat là các đề xuất cải tiến chờ Admin
               quyết, aiNhatKy là sổ ghi thêm không xóa được. AI chỉ ĐỌC dữ liệu
               nghiệp vụ và KHÔNG ghi vào bất kỳ bảng nào — kể cả hai bảng này:
               chỉ thao tác của con người mới ghi. --- */
            'aiDeXuat', 'aiNhatKy', 'aiBaseline', 'aiBoQua',
            /* --- PHÂN HỆ GÓP VỐN CỔ ĐÔNG (v12.0.0) — ba bảng DỮ LIỆU GỐC.
               Đây là dữ liệu do con người khai, không suy ra được từ bất kỳ
               chứng từ nào đang có. Mọi số liệu tài chính khác (doanh thu, giá
               vốn, chi phí, lợi nhuận, tồn kho, công nợ) KHÔNG lưu ở đây mà
               đọc thẳng từ Business Engine mỗi lần hiển thị. --- */
            'coDong', 'dotGopVon', 'giaoDichVon'];

/* Các bảng dữ liệu đã BỎ HẲN khỏi phần mềm — nâng cấp phải dọn sạch, không để
   lại dữ liệu mồ côi trong kho dữ liệu của doanh nghiệp. */
var COLS_BO = ['bieuMau', 'dkThuVien'];

/* Danh sách bảng dữ liệu công bố cho phân hệ Sao lưu. Sao lưu phải bao trùm
   TOÀN BỘ kho dữ liệu — thêm một bảng mới vào COLS là phân hệ Sao lưu tự động
   bao gồm bảng đó, không cần khai báo lại ở nơi thứ hai. */
T.COLS_SAO_LUU = COLS;

/* ==========================================================================
   XÓA SẠCH DỮ LIỆU NGHIỆP VỤ — PHÂN LOẠI DUY NHẤT CỦA TOÀN HỆ THỐNG
   --------------------------------------------------------------------------
   VÌ SAO KHỐI NÀY TỒN TẠI. Trước đây danh sách bảng cần xóa được viết tay ngay
   trong màn hình Hệ thống. Thêm bảng mới vào COLS mà quên khai vào danh sách đó
   thì bảng mới LẶNG LẼ SỐNG SÓT — người dùng tưởng đã xóa sạch nhưng số liệu cũ
   vẫn hiện lên. Đúng lỗi này đã xảy ra với ba bảng của phân hệ Góp vốn.

   NAY MỖI BẢNG ĐƯỢC GẮN ĐÚNG MỘT LOẠI, KHAI ĐÚNG MỘT LẦN, Ở ĐÚNG MỘT CHỖ.
   Mọi chức năng xóa đều đọc từ bảng phân loại này — KHÔNG màn hình nào được
   viết tay danh sách bảng của riêng mình nữa. Hai danh sách song song là hai
   cơ hội để lệch nhau, và đó chính là cách lỗi cũ phát sinh.

   NĂM LOẠI:
     nen      — dữ liệu nền / master data. KHÔNG BAO GIỜ bị xóa.
     danhMuc  — danh mục nghiệp vụ (khách hàng, hàng hóa, kho…). Bị xóa khi
                "Xóa sạch dữ liệu nghiệp vụ"; GIỮ khi "Xóa toàn bộ chứng từ".
     chungTu  — chứng từ và giao dịch phát sinh. Cả hai chức năng đều xóa.
     danXuat  — sổ dựng lại được từ chứng từ (lịch sử giá vốn, bút toán nội bộ).
                Chứng từ mất thì sổ này thành mồ côi, nên xóa cùng chứng từ.
     soGhi    — thùng rác và nhật ký hệ thống. Chỉ "Xóa sạch nghiệp vụ" mới xóa;
                "Xóa toàn bộ chứng từ" giữ lại để còn dấu vết truy ngược.

   MASTER DATA KHÔNG BAO GIỜ BỊ XÓA — đặc biệt là coDong: danh sách cổ đông và
   tỷ lệ sở hữu là dữ liệu nền của doanh nghiệp, không phải nghiệp vụ phát sinh.

   Thêm bảng mới vào COLS mà quên khai ở đây thì bộ tự kiểm của Engine BÁO LỖI
   ngay (mục "Mọi bảng đều được phân loại"), chứ không âm thầm sống sót.
   ========================================================================== */
T.LOAI_BANG = {
    /* ---------- nen: TỔ CHỨC · NGƯỜI DÙNG · PHÂN QUYỀN ---------- */
    donVi: 'nen', nguoiDung: 'nen', nhanVien: 'nen', vaiTro: 'nen',
    /* ---------- nen: CỔ ĐÔNG LÀ MASTER DATA ----------
       Xóa sạch nghiệp vụ xong, danh sách cổ đông và tỷ lệ sở hữu phải còn
       nguyên; chỉ nghĩa vụ (dotGopVon) và giao dịch (giaoDichVon) bị xóa. */
    coDong: 'nen',
    /* ---------- nen: DANH MỤC CẤU HÌNH NỀN TẢNG ---------- */
    nhomHang: 'nen', dvt: 'nen', hangSX: 'nen', thueSuat: 'nen',
    dieuKhoanTT: 'nen', dieuKhoanGH: 'nen', nguoiKy: 'nen', loaiGia: 'nen',
    loaiHopDong: 'nen', khoanMucChi: 'nen', duAn: 'nen',
    /* ---------- nen: BẢNG GIÁ VÀ CÔNG THỨC GIÁ ----------
       Có nút "Xóa toàn bộ bảng giá" riêng nên không xóa kèm ở đây. */
    bangGia: 'nen', giaNoiBo: 'nen', mauBangGia: 'nen', tepGoc: 'nen',
    /* ---------- nen: SỔ GHI VÀ CẤU HÌNH CỦA LỚP GIÁM SÁT AI ----------
       ĐÂY LÀ DỮ LIỆU NỀN / CẤU HÌNH, KHÔNG PHẢI DỮ LIỆU NGHIỆP VỤ.

       aiBaseline — MỐC SO SÁNH TRẠNG THÁI PHẦN MỀM. Ảnh chụp cấu hình hệ thống
         tại một thời điểm: danh sách màn hình, thực đơn, phân hệ, mã băm quyền,
         SỐ ĐẾM bản ghi từng bảng, tên trường, mã băm công thức của Business
         Engine, kèm một số chỉ tiêu tổng hợp để đối chiếu. KHÔNG sao chép bản
         ghi nghiệp vụ nào, và KHÔNG báo cáo tài chính nào đọc nó — chỉ màn hình
         Trợ lý đọc để so "trước / sau khi nâng cấp phần mềm".
         Các mốc này do tính năng AI cố vấn (đã gỡ) sinh ra trước đây; nay
         không còn chức năng nào ghi thêm, dữ liệu cũ được giữ nguyên.
         => TUYỆT ĐỐI KHÔNG xóa khi "Xóa toàn bộ chứng từ" hay "Xóa sạch dữ liệu
            nghiệp vụ", và KHÔNG được sửa nội dung. Xóa mốc là mất khả năng phát
            hiện hồi quy của chính phần mềm.
       aiBoQua — quyết định của ADMIN đánh dấu một cảnh báo là không đúng.
         Không chứa một trường số tiền nào. Mã nguồn khóa cứng "không xóa lịch sử".
       aiDeXuat · aiNhatKy · gopDuLieu — sổ ghi quy trình, giữ để truy vết. */
    aiDeXuat: 'nen', aiNhatKy: 'nen', aiBaseline: 'nen', aiBoQua: 'nen',
    gopDuLieu: 'nen',

    /* ---------- danhMuc: DANH MỤC NGHIỆP VỤ ---------- */
    khachHang: 'danhMuc', nhaCungCap: 'danhMuc', hangHoa: 'danhMuc',
    kho: 'danhMuc', bangGiaBan: 'danhMuc',

    /* ---------- chungTu: CHỨNG TỪ VÀ GIAO DỊCH PHÁT SINH ---------- */
    baoGia: 'chungTu', donBan: 'chungTu', hopDong: 'chungTu', phuLuc: 'chungTu',
    phieuXuat: 'chungTu', bienBanGiao: 'chungTu', bienBanNghiemThu: 'chungTu',
    deNghiTT: 'chungTu', phieuThu: 'chungTu', donMua: 'chungTu',
    phieuChi: 'chungTu', loNhap: 'chungTu', phieuNhap: 'chungTu',
    kiemKe: 'chungTu', dieuChinhKho: 'chungTu', theKho: 'chungTu',
    /* GÓP VỐN CỔ ĐÔNG — đợt góp vốn là nghĩa vụ phát sinh; giaoDichVon chứa
       CẢ BỐN loại: Góp vốn · Rút vốn · Chia lợi nhuận · Trả lãi chậm góp,
       và cả khoản phân bổ tiền bán hàng vào nghĩa vụ (nguonTien). */
    dotGopVon: 'chungTu', giaoDichVon: 'chungTu',

    /* ---------- danXuat: SỔ DỰNG LẠI ĐƯỢC TỪ CHỨNG TỪ ---------- */
    lichSuGiaVon: 'danXuat',   /* dựng từ phiếu nhập kho */
    butToanNB: 'danXuat',      /* dựng từ đơn bán — T.dungButToanNB */

    /* ---------- soGhi: THÙNG RÁC VÀ NHẬT KÝ HỆ THỐNG ----------
       thungRac GIỮ LẠI khi "Xóa toàn bộ chứng từ" để chức năng Khôi phục còn
       dùng được. An toàn tuyệt đối về số liệu vì mọi báo cáo đều đọc qua
       DB.all(bang), mà DB.all CHỈ trả về DB.data[bang] — không bao giờ đọc
       thùng rác. Bản ghi trong thùng rác vì thế không vào số dư, công nợ, tồn
       kho, góp vốn hay kết quả kinh doanh; nó chỉ quay lại khi người dùng bấm
       Khôi phục. Muốn dọn hẳn thì dùng nút "Dọn sạch thùng rác" riêng. */
    thungRac: 'soGhi', nhatKy: 'soGhi'
};

/** Các bảng thuộc một hoặc nhiều loại, theo đúng thứ tự khai báo của COLS. */
T.bangTheoLoai = function () {
    var loai = [].slice.call(arguments);
    return COLS.filter(function (c) { return loai.indexOf(T.LOAI_BANG[c]) >= 0; });
};

/**
 * BA KHUNG NHÌN DẪN XUẤT TỪ ĐÚNG MỘT BẢNG PHÂN LOẠI.
 * Không nơi nào được viết tay danh sách bảng — chỉ gọi ba hàm dưới đây.
 */
T.bangXoaNghiepVu = function () {          /* nút "Xóa sạch dữ liệu nghiệp vụ" */
    return T.bangTheoLoai('danhMuc', 'chungTu', 'danXuat', 'soGhi');
};
T.bangXoaChungTu = function () {           /* nút "Xóa toàn bộ chứng từ"        */
    return T.bangTheoLoai('chungTu', 'danXuat');
};
/** Giữ tên cũ để mọi nơi đang gọi không phải sửa — vẫn cùng một nguồn. */
T.BANG_GIU_KHI_XOA = COLS.filter(function (c) { return T.LOAI_BANG[c] === 'nen'; });

/**
 * DỌN BỘ NHỚ ĐỆM SAU MỖI LẦN XÓA HÀNG LOẠT.
 * Các biến này là chỉ mục dựng từ chính những bảng vừa bị xóa. Để nguyên thì
 * màn hình vẽ ngay sau đó vẫn đọc chỉ mục của dữ liệu không còn tồn tại —
 * người dùng thấy số cũ và tưởng chưa xóa được. Gom về đúng một hàm để không
 * chức năng xóa nào quên dọn.
 */
T.donDemSauXoa = function () {
    T._cmHH = null;          /* chỉ mục nhận diện hàng hóa      */
    T._aliasDD = null;       /* bộ mã khác đụng độ              */
    T._maxSoNB = null;       /* số hiệu nội bộ lớn nhất         */
    T._maxSoNBSrc = null;
};

var DB = { data: null };

/* Phiên bản phần mềm — hiển thị trên màn hình Hệ thống và trên tài liệu. */
T.PHIEN_BAN = '18.10.0';

/* ==========================================================================
   CẤU HÌNH TRÌNH BÀY BIỂU MẪU — DUY NHẤT CHO TOÀN PHẦN MỀM
   Mỗi loại chứng từ chỉ có 01 biểu mẫu chuẩn. Các trị số dưới đây là bản sao
   đúng của HỆ THỐNG THIẾT KẾ TÀI LIỆU (assets/css/print.css); phần câu chữ
   riêng của từng pháp nhân (điều khoản, ghi chú cuối, chức danh ký, chữ ký,
   con dấu) lấy từ THIẾT LẬP DOANH NGHIỆP — Hệ thống ▸ Đơn vị phát hành.
   ========================================================================== */
T.MAU_CHUAN = {
    // Khối đầu trang: logo bên trái, thông tin pháp nhân ngay bên phải logo
    hienLogo: true, coLogo: 26, hienTenDonVi: true, hienDiaChi: true, hienMST: true,
    hienDienThoai: true, hienEmail: true, hienNganHang: true, hienWebsite: true,
    duongKeDau: true,
    // Chữ
    fontChu: 'Times New Roman', coChu: 13, coChuTieuDe: 18, coChuBang: 11.5,
    mauTieuDe: '#000000', mauNenBang: '#e9edf2', mauDuongKe: '#000000',
    mauNhan: '#14406e',
    // Trang
    leTren: 15, leDuoi: 16, leTrai: 20, lePhai: 15, giangDong: 1.42,
    // Nội dung
    hienDiaDanh: true, hienSoChungTu: true, hienDuAn: true, hienGhiChu: true,
    hienDieuKhoan: true, hienTienBangChu: true, hienMaGiaoDich: false,
    hienDonGia: true, hienThanhTien: true, hienThue: false,
    // Chân trang
    hienChanTrang: true, hienSoTrang: true, hienNgayIn: true,
    // Ký
    hienChucDanh: true, hienDauCongTy: false, anhDau: '', anhChuKy: '',
    // Câu chữ riêng của doanh nghiệp
    ghiChuCuoi: '', dieuKhoanMacDinh: ''
};

/**
 * Cấu hình trình bày đang áp dụng — cấu hình chuẩn của phần mềm, ghép thêm
 * phần câu chữ và nhận diện của chính pháp nhân phát hành chứng từ.
 */
T.cauHinhIn = function (cty) {
    var o = {}, k;
    for (k in T.MAU_CHUAN) if (T.MAU_CHUAN.hasOwnProperty(k)) o[k] = T.MAU_CHUAN[k];
    if (!cty) return o;
    if (cty.chuKy) o.anhChuKy = cty.chuKy;
    if (cty.conDau) { o.anhDau = cty.conDau; o.hienDauCongTy = true; }
    if (cty.dieuKhoanChung) o.dieuKhoanMacDinh = cty.dieuKhoanChung;
    if (cty.ghiChuCuoi) o.ghiChuCuoi = cty.ghiChuCuoi;
    return o;
};

function blank() {
    var o = {}; COLS.forEach(function (c) { o[c] = []; });
    o._meta = { ctyId: 'EMC', seq: {}, taoLuc: T.now(), phienBan: '2.0' };
    return o;
}

DB.load = function () {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { }
    if (raw) {
        try {
            DB.data = JSON.parse(raw);
            COLS.forEach(function (c) { if (!DB.data[c]) DB.data[c] = []; });
            if (!DB.data._meta) DB.data._meta = blank()._meta;
            if (!DB.data._meta.seq) DB.data._meta.seq = {};
            DB.nangCap();
            return DB.data;
        } catch (e) { }
    }
    return DB.nap(true);
};

/** Nạp lại toàn bộ dữ liệu gốc (dữ liệu thật của doanh nghiệp). */
DB.nap = function (im) {
    var S = W.TVERP_SEED, d = blank();
    COLS.forEach(function (c) { if (S[c]) d[c] = T.clone(S[c]); });
    d._meta.ctyId = (DB.data && DB.data._meta && DB.data._meta.ctyId) || 'EMC';
    d._meta.seq = {};
    // đặt bộ đếm số chứng từ tiếp theo
    [['baoGia', 'BG'], ['donBan', 'DB'], ['hopDong', 'HD'], ['phuLuc', 'PL'], ['phieuXuat', 'PX'],
     ['bienBanGiao', 'BB'], ['bienBanNghiemThu', 'NT'], ['deNghiTT', 'DN'],
     ['phieuThu', 'PT'], ['donMua', 'DM'], ['phieuChi', 'PC'], ['loNhap', 'NK'],
     ['phieuNhap', 'PN']].forEach(function (p) {
        d._meta.seq[p[1]] = (d[p[0]] || []).length;
    });
    d._meta.seqGD = 0;
    DB.data = d;
    T.ganMaGD();
    d.nhatKy = [{ id: T.uid('L'), luc: T.now(), ai: 'admin', viec: 'Khởi tạo dữ liệu',
                  mota: 'Nạp dữ liệu gốc: ' + d.khachHang.length + ' khách hàng, ' +
                        d.hangHoa.length + ' mã hàng, ' + d.bangGia.length + ' dòng bảng giá' }];
    DB.data = d;
    DB.nangCap();          // bổ sung quyền phân hệ mới + dựng thẻ kho ngay từ dữ liệu gốc
    DB.save();
    return d;
};

/**
 * Nâng cấp dữ liệu đã lưu từ phiên bản cũ lên phiên bản mới
 * (bổ sung Nhân viên, Vai trò, mật khẩu, người lập trên chứng từ) mà KHÔNG mất dữ liệu đã nhập.
 */
/**
 * Gộp các bảng giá kiểu cũ (mỗi bậc giá một bảng) thành PHIÊN BẢN theo hãng.
 * Một phiên bản chứa toàn bộ cột giá; giá cũ được chuyển thành cột tương ứng.
 * Bảng giá cũ nào đã theo mô hình mới (có cotGia) thì giữ nguyên.
 */
function dl_gopBangGia(d) {
    var ds = (d.bangGiaBan || []).filter(function (b) {
        return !b.cotGia || !b.cotGia.length;
    });
    if (!ds.length) return false;
    var COT = { DUAN: 'Giá dự án', DAILY: 'Giá đại lý', BANLE: 'Giá bán lẻ',
                TRUCTIEP: 'Giá bán trực tiếp', PHANPHOI: 'Giá phân phối' };
    var nhom = {};
    ds.forEach(function (b) {
        var hang = b.nhaCungCap || tenHang(b.nguon) || 'Bảng giá nội bộ';
        var k = hang + '|' + (b.tuNgay || '');
        (nhom[k] = nhom[k] || []).push(b);
    });
    var moi = [], doi = false;
    Object.keys(nhom).forEach(function (k) {
        var g = nhom[k];
        var hang = k.split('|')[0], tuNgay = k.split('|')[1];
        var bang = {}, cotGia = [], soMa = {};
        g.forEach(function (b) {
            var cot = COT[b.ma] || b.ten || 'Giá bán';
            if (cotGia.indexOf(cot) < 0) cotGia.push(cot);
            Object.keys(b.gia || {}).forEach(function (ma) {
                bang[ma] = bang[ma] || {};
                bang[ma][cot] = Number(b.gia[ma]) || 0;
                soMa[ma] = 1;
            });
        });
        var chinh = g.filter(function (b) { return b.macDinh; })[0] || g[0];
        var cotChinh = COT[chinh.ma] || cotGia[0];
        var gia = {};
        Object.keys(bang).forEach(function (ma) { gia[ma] = bang[ma][cotChinh] || 0; });
        var pb = {
            id: chinh.id, ma: hang, ten: tenPhienBan(chinh, tuNgay), moTa: chinh.moTa || '',
            nhaCungCap: hang, phienBan: 1,
            tuNgay: tuNgay, denNgay: chinh.denNgay || '',
            trangThai: chinh.trangThai || 'Đang áp dụng', macDinh: true,
            donViId: '', cotGia: cotGia, cotChinh: cotChinh, bang: bang, gia: gia,
            ck: {}, gc: {}, soMatHang: Object.keys(soMa).length,
            nguoiCapNhat: chinh.nguoiCapNhat || '', ngayCapNhat: chinh.ngayNhap || T.today(),
            nguon: chinh.nguon || '', idCu: g.map(function (b) { return b.id; }),
            /* Chiết khấu nội bộ thuộc thông tin phiên bản — gộp bảng giá đời cũ
               thì giữ nguyên cấu hình của bản chính, không làm mất mức nào. */
            chietKhauNoiBo: T.clone(chinh.chietKhauNoiBo || {})
        };
        moi.push(pb);
        // chứng từ và khách hàng đang trỏ tới bảng giá cũ → trỏ sang phiên bản mới
        var doiId = {};
        g.forEach(function (b) { if (b.id !== pb.id) doiId[b.id] = pb.id; });
        if (Object.keys(doiId).length) {
            doiThamChieuBangGia(d, doiId);
            doi = true;
        }
    });
    d.bangGiaBan = (d.bangGiaBan || []).filter(function (b) {
        return b.cotGia && b.cotGia.length;
    }).concat(moi);
    return true;

    function tenHang(nguon) {
        var m = /bảng giá\s+([A-Za-zÀ-ỹ0-9 .-]+?)(\s+quý|\s+\d|$)/i.exec(String(nguon || ''));
        return m ? m[1].trim().toUpperCase() : '';
    }
    function tenPhienBan(b, tuNgay) {
        if (b.nguon) return String(b.nguon).replace(/^bảng giá\s*/i, '').trim() || b.ten;
        var p = String(tuNgay || '').split('-');
        return p.length === 3 ? ('Bảng giá ' + p[1] + '/' + p[0]) : (b.ten || 'Phiên bản 1');
    }
}
/** Trỏ lại bangGiaId của khách hàng và chứng từ sang phiên bản mới. */
function doiThamChieuBangGia(d, doiId) {
    Object.keys(d).forEach(function (c) {
        if (!d[c] || typeof d[c].forEach !== 'function') return;
        d[c].forEach(function (r) {
            if (r && r.bangGiaId && doiId[r.bangGiaId]) r.bangGiaId = doiId[r.bangGiaId];
        });
    });
}

DB.nangCap = function () {
    var S = W.TVERP_SEED, d = DB.data, doi = false;
    if (!d.gopDuLieu) { d.gopDuLieu = []; doi = true; }

    /* v3.2: DANH MỤC LOẠI HỢP ĐỒNG.
       Mỗi loại hợp đồng mang theo toàn bộ biểu mẫu của nó. Nâng cấp chỉ NẠP BỔ
       SUNG loại chưa có; loại doanh nghiệp đã tự sửa hoặc tự thêm KHÔNG bao
       giờ bị ghi đè. */
    if (!d.loaiHopDong) { d.loaiHopDong = []; doi = true; }
    if (S && S.loaiHopDong) {
        var coLHD = {};
        d.loaiHopDong.forEach(function (x) { coLHD[x.id] = 1; });
        S.loaiHopDong.forEach(function (x) {
            if (!coLHD[x.id]) { d.loaiHopDong.push(T.clone(x)); doi = true; }
        });
    }
    /* Hợp đồng cũ chưa gắn loại → gắn theo tên loại đang ghi trên hợp đồng. */
    (d.hopDong || []).forEach(function (x) {
        if (x.loaiId) return;
        var l = d.loaiHopDong.filter(function (y) { return y.ten === x.loai; })[0] ||
                d.loaiHopDong[0];
        if (l) { x.loaiId = l.id; x.loai = l.ten; doi = true; }
    });
    /* Biên bản nghiệm thu cũ chưa gắn mẫu → mặc định nghiệm thu khối lượng. */
    (d.bienBanNghiemThu || []).forEach(function (x) {
        if (x.mauNT === undefined) { x.mauNT = 'KL'; doi = true; }
        /* ------------------------------------------------------------------
           v18.1.0 — HỒ SƠ NGHIỆM THU.
           Mỗi biên bản cũ trở thành hồ sơ của CHÍNH NÓ. Cố ý KHÔNG tự gộp hai
           biên bản cũ vào một hồ sơ: phần mềm không có căn cứ chắc chắn để
           khẳng định chúng là cùng một đợt nghiệm thu, và tự gộp nhầm sẽ làm
           sai dữ liệu đang đúng. Việc gộp phải do người dùng quyết định.
           Khối này CHỈ THÊM trường, không sửa một con số nào và chạy lại bao
           nhiêu lần cũng cho một kết quả.
           ------------------------------------------------------------------ */
        if (!x.hoSoId) { x.hoSoId = x.id; doi = true; }
        if (!x.hoSoSo) { x.hoSoSo = x.so || x.id; doi = true; }
        if (x.hoSoSo === undefined) { x.hoSoSo = x.so || x.id; doi = true; }
        if (x.dotNT === undefined) { x.dotNT = 1; doi = true; }
        if (x.phuLucId === undefined) { x.phuLucId = ''; x.phuLucSo = ''; doi = true; }
    });

    /* ----------------------------------------------------------------------
       v3.4: CUSTOMER MASTER DATA
       Chuẩn hóa danh mục khách hàng theo chuẩn ERP thương mại:
         · loại khách hàng bắt buộc (Doanh nghiệp / Cá nhân);
         · mã khách hàng do hệ thống sinh, thống nhất dạng KH000001;
         · tách bộ trường doanh nghiệp và bộ trường cá nhân;
         · gỡ dữ liệu khách hàng mồ côi trên chứng từ (khachHangId trỏ vào
           khách đã bị xóa) về đúng khách theo tên nếu tìm được.
       ---------------------------------------------------------------------- */
    var TRUONG_KH = {
        loai: 'Doanh nghiệp', mst: '', cccd: '', diaChi: '', daiDien: '',
        dienThoai: '', email: '', nguoiLienHe: '', chucVu: '', dtLienHe: '',
        emailLienHe: '', dieuKhoanTT: '', nguoiPhuTrachId: '', nguoiPhuTrach: '',
        donViId: '', bangGiaId: '', hanMucNo: 0, duAn: '', tenKhac: '',
        ghiChu: '', nguonMST: '', trangThai: 'Đang giao dịch'
    };
    (d.khachHang || []).forEach(function (x) {
        Object.keys(TRUONG_KH).forEach(function (k) {
            if (x[k] === undefined) { x[k] = TRUONG_KH[k]; doi = true; }
        });
        if (T.LOAI_KH.indexOf(x.loai) < 0) { x.loai = 'Doanh nghiệp'; doi = true; }
        var m2 = T.chuanMST(x.mst);
        if (m2 !== (x.mst || '')) { x.mst = m2; doi = true; }
        /* Cá nhân không giữ mã số thuế và người đại diện. */
        if (x.loai === 'Cá nhân') {
            if (x.mst) { x.mst = ''; doi = true; }
            if (x.daiDien) { x.daiDien = ''; doi = true; }
        }
    });
    /* Mã khách hàng: chuyển toàn bộ về đúng một dạng KH000001 do hệ thống sinh. */
    var soKH = 0, xauKH = (d.khachHang || []).some(function (x) {
        return !/^KH\d{6}$/.test(String(x.ma || ''));
    });
    if (xauKH) {
        (d.khachHang || []).slice().sort(function (a2, b2) {
            var n1 = Number((/(\d+)$/.exec(String(a2.ma || '')) || [0, 0])[1]);
            var n2 = Number((/(\d+)$/.exec(String(b2.ma || '')) || [0, 0])[1]);
            return n1 - n2;
        }).forEach(function (x) {
            soKH++;
            x.ma = 'KH' + ('000000' + soKH).slice(-6);
        });
        doi = true;
    }
    /* Chứng từ trỏ tới khách hàng đã bị xóa → nối lại theo tên nếu còn tìm được. */
    var theoTen = {};
    (d.khachHang || []).forEach(function (k) { theoTen[T.kd(k.ten || '')] = k; });
    var coKH = {};
    (d.khachHang || []).forEach(function (k) { coKH[k.id] = 1; });
    T.COLL_KH.forEach(function (c) {
        (d[c] || []).forEach(function (r) {
            if (!r.khachHangId || coKH[r.khachHangId]) return;
            var k = theoTen[T.kd(r.khachHang || '')];
            if (k) { r.khachHangId = k.id; doi = true; }
            else if (r.khachHangId) { r.khachHangId = ''; doi = true; }
        });
    });

    /* v3.1: TVERP chỉ dùng 01 BIỂU MẪU CHUẨN cho mỗi loại chứng từ.
       Thư viện biểu mẫu và Thư viện điều khoản đã bỏ hẳn: xóa sạch bảng dữ
       liệu cũ và gỡ mọi tham chiếu còn sót trên chứng từ, khách hàng, dự án
       để kho dữ liệu không còn bản ghi mồ côi.
       RIÊNG noiDungRieng — phần người dùng tự sửa điều khoản, ghi chú, diễn
       giải cho từng chứng từ — được GIỮ NGUYÊN: đó là dữ liệu nghiệp vụ của
       doanh nghiệp, không phải cấu hình biểu mẫu.
       Từ v3.3 banInRieng cũng được GIỮ NGUYÊN: đó là bản in người dùng tự sửa
       trực tiếp trên trang giấy của CHÍNH chứng từ đó. */
    COLS_BO.forEach(function (c) { if (d[c]) { delete d[c]; doi = true; } });
    Object.keys(d).forEach(function (c) {
        if (c === '_meta' || !d[c] || typeof d[c].forEach !== 'function') return;
        d[c].forEach(function (r) {
            if (!r || typeof r !== 'object') return;
            ['mauInId', 'bieuMauId', '_cauHinhMau']
                .forEach(function (k) { if (r[k] !== undefined) { delete r[k]; doi = true; } });
            /* Bản sửa tay đời cũ lưu dạng chuỗi — chuyển sang cấu trúc mới. */
            if (typeof r.banInRieng === 'string') {
                r.banInRieng = { html: r.banInRieng, luc: '', boi: '' };
                doi = true;
            }
        });
    });

    /* v3.1: ĐỀ NGHỊ THANH TOÁN chuyển sang khai SỐ TIỀN trực tiếp, không kê
       dòng hàng hóa nữa. Đề nghị cũ giữ nguyên số tiền đã lập (chuyển từ tổng
       cộng sang trường số tiền) rồi bỏ hẳn phần dòng hàng để dữ liệu sạch. */
    (d.deNghiTT || []).forEach(function (x) {
        if (x.soTien === undefined || x.soTien === null || x.soTien === '') {
            x.soTien = Number(x.tongCong) || 0; doi = true;
        }
        if (x.loaiDN === undefined) { x.loaiDN = 'Thanh toán'; doi = true; }
        if (x.hinhThuc === undefined) { x.hinhThuc = 'Chuyển khoản'; doi = true; }
        if (x.noiDungTT === undefined) { x.noiDungTT = x.lyDo || ''; doi = true; }
        if (x.nguoiDeNghi === undefined) { x.nguoiDeNghi = x.nguoiLap || ''; doi = true; }
        ['lines', 'vatPct', 'thanhTien', 'vat', 'tongCong', 'bangGiaId', 'cotGia', 'mucGia']
            .forEach(function (k) { if (x[k] !== undefined) { delete x[k]; doi = true; } });
    });
    /* v2.1: MỘT phiên bản bảng giá chứa TOÀN BỘ cột giá.
       Dữ liệu cũ tách mỗi bậc giá thành một bảng riêng → gộp lại thành phiên bản
       của từng hãng, giữ nguyên toàn bộ giá và không mất bảng giá nào. */
    if (dl_gopBangGia(d)) doi = true;

    /* v2.1: thuế suất GTGT không còn là thuộc tính của khách hàng — thuế xác định tại
       hàng hóa, dòng chi tiết chứng từ và chính sách thuế của từng chứng từ. */
    (d.khachHang || []).forEach(function (k) {
        if (k.thueSuat !== undefined) { delete k.thueSuat; doi = true; }
    });
    /* v2.0: mã vạch và mã QR của hàng hóa — dùng để nhận biết hàng trùng khi gộp */
    (d.hangHoa || []).forEach(function (h) {
        if (h.barcode === undefined) { h.barcode = ''; doi = true; }
        if (h.qrCode === undefined) { h.qrCode = ''; doi = true; }
    });
    if (!d.vaiTro.length) { d.vaiTro = T.clone(S.vaiTro); doi = true; }
    if (!d.nhanVien.length) { d.nhanVien = T.clone(S.nhanVien); doi = true; }

    d.nguoiDung.forEach(function (u) {
        if (u.matKhau === undefined) { u.matKhau = '123456'; doi = true; }
        if (u.anhDaiDien === undefined) { u.anhDaiDien = ''; doi = true; }
        if (!u.vaiTroId) {
            var r = d.vaiTro.filter(function (x) { return x.ten === u.vaiTro; })[0] ||
                    d.vaiTro.filter(function (x) { return x.ma === 'CHIXEM'; })[0];
            if (r) { u.vaiTroId = r.id; u.vaiTro = r.ten; doi = true; }
        }
        if (u.nhanVienId === undefined) {
            var nv = d.nhanVien.filter(function (x) { return x.taiKhoanId === u.id || x.hoTen === u.hoTen; })[0];
            u.nhanVienId = nv ? nv.id : ''; doi = true;
        }
    });

    // gắn Người lập cũ (nhập tay) vào đúng nhân viên trong danh mục
    ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'bienBanGiao', 'bienBanNghiemThu',
     'deNghiTT', 'donMua', 'phieuThu', 'phieuChi'].forEach(function (c) {
        (d[c] || []).forEach(function (x) {
            if (x.nguoiLapId) return;
            var nv = d.nhanVien.filter(function (n) { return n.hoTen === x.nguoiLap; })[0];
            x.nguoiLapId = nv ? nv.id : (d.nhanVien[0] || {}).id || '';
            x.nguoiLap = nv ? nv.hoTen : (x.nguoiLap || (d.nhanVien[0] || {}).hoTen || '');
            doi = true;
        });
    });
    // vai trò cũ chưa có quyền trên phân hệ mới → cấp theo phân hệ tương đương
    var THAM_CHIEU = { phuLuc: 'hopDong', bienBanGiao: 'phieuXuat',
                       bienBanNghiemThu: 'phieuXuat', deNghiTT: 'donBan', hoSo: 'donBan',
                       loNhap: 'donMua', phieuNhap: 'loNhap',
                       bangGiaBan: 'bangGia', giaNoiBo: 'bangGia', loaiGia: 'bangGiaBan',
                       giaVon: 'hangHoa', nhapLichSu: 'caiDat', saoLuu: 'caiDat',
                       khoTongQuan: 'kho', kiemKe: 'kho',
                       dieuChinhKho: 'kho', baoCaoTon: 'kho', baoCaoNXT: 'kho', theKho: 'kho',
                       nhomHang: 'hangHoa', dvt: 'hangHoa', hangSX: 'hangHoa',
                       thueSuat: 'khachHang', dieuKhoanTT: 'khachHang', dieuKhoanGH: 'dieuKhoanTT',
                       nguoiKy: 'donVi', khoanMucChi: 'phieuChi', doiChieu: 'baoCao',
                       kqKinhDoanh: 'baoCao',
                       loaiHopDong: 'hopDong', gopVon: 'phieuThu' };
    d.vaiTro.forEach(function (vt) {
        vt.quyen = vt.quyen || {};
        Object.keys(THAM_CHIEU).forEach(function (k) {
            if (vt.quyen[k]) return;
            var goc = vt.quyen[THAM_CHIEU[k]];
            if (!goc) return;
            var ap = (Q.theoMa(k) || { ap: [] }).ap, q = {};
            Object.keys(goc).forEach(function (a) { if (ap.indexOf(a) >= 0 && goc[a]) q[a] = true; });
            if (Object.keys(q).length) { vt.quyen[k] = q; doi = true; }
        });
    });

    /* ----------------------------------------------------------------------
       v4.0: DANH MỤC HÀNG HÓA LÀ MASTER DATA ĐỘC LẬP
         · tách MÃ ERP và MODEL thành hai thuộc tính riêng — Model của nhà sản
           xuất được phép trùng, Mã ERP là mã doanh nghiệp tự đặt;
         · gom Hãng về một trường duy nhất;
         · bổ sung cấu hình theo dõi tồn kho · sê-ri · lô;
         · GỠ HẲN giá bán khỏi danh mục — giá bán chỉ nằm ở Bảng giá.
       ---------------------------------------------------------------------- */
    (d.hangHoa || []).forEach(function (x) {
        if (x.model === undefined) { x.model = x.ma || ''; doi = true; }
        if (x.hang === undefined) {
            x.hang = x.nhaSanXuat || x.thuongHieu || x.xuatXu || '';
            doi = true;
        }
        if (x.theoDoiTon === undefined) { x.theoDoiTon = true; doi = true; }
        if (x.theoDoiSerial === undefined) { x.theoDoiSerial = false; doi = true; }
        if (x.theoDoiLo === undefined) { x.theoDoiLo = false; doi = true; }
        TRUONG_GIA_BO.forEach(function (k) {
            if (x[k] !== undefined) { delete x[k]; doi = true; }
        });
    });
    /* Vừa bổ sung trường Model cho danh mục → BỎ CHỈ MỤC CŨ để các bước sau tra
       được cả theo Model, không dùng lại chỉ mục dựng trước khi có trường này. */
    T._cmHH = null;

    /* v4.0: BẢNG GIÁ LƯU THEO DÒNG. Phiên bản đời cũ chỉ có chỉ mục b.bang /
       b.gia được dựng lại thành mảng dòng gốc, không mất một mã hàng nào. */
    (d.bangGiaBan || []).forEach(function (b2) {
        if (T.dungDongBangGia(b2)) { T.dungChiMucBG(b2); doi = true; }
        else if (b2.soDong === undefined) { b2.soDong = (b2.dong || []).length; doi = true; }
    });


    /* ----------------------------------------------------------------------
       v4.0: ĐIỀU KHOẢN GIAO HÀNG trở thành danh mục nền riêng — trước đây chỉ
       là chữ gõ tay trong ô "Điều khoản báo giá". Kho dữ liệu chưa có bản ghi
       nào thì khai sẵn bộ chuẩn để dùng ngay; doanh nghiệp sửa và bổ sung tùy ý.
       ---------------------------------------------------------------------- */
    if (!(d.dieuKhoanGH || []).length) {
        [{ ma: 'GH-KHO', ten: 'Giao tại kho bên bán', soNgay: 0, diaDiem: 'Kho bên bán',
           noiDung: 'Bên mua nhận hàng tại kho của Bên bán. Chi phí vận chuyển do Bên mua chịu.' },
         { ma: 'GH-CT', ten: 'Giao tại công trình', soNgay: 7, diaDiem: 'Công trình của Bên mua',
           noiDung: 'Bên bán giao hàng tại công trình của Bên mua trong vòng 07 ngày kể từ ngày ký. ' +
                    'Chi phí vận chuyển do Bên bán chịu.' },
         { ma: 'GH-10', ten: 'Giao trong 10 ngày', soNgay: 10, diaDiem: 'Theo địa chỉ Bên mua chỉ định',
           noiDung: 'Bên bán giao hàng trong vòng 10 ngày kể từ ngày Bên mua đặt hàng.' },
         { ma: 'GH-DOT', ten: 'Giao theo từng đợt', soNgay: 0, diaDiem: 'Theo tiến độ thi công',
           noiDung: 'Hàng được giao theo từng đợt phù hợp tiến độ thi công, có xác nhận của hai bên trước mỗi đợt.' }
        ].forEach(function (x) {
            x.id = T.uid('DKGH'); x.trangThai = 'Đang dùng'; x._tao = T.now();
            d.dieuKhoanGH.push(x);
        });
        doi = true;
    }

    /* ----------------------------------------------------------------------
       v4.0: LIÊN KẾT TOÀN HỆ THỐNG BẰNG ID NỘI BỘ
       Chứng từ đời cũ chỉ lưu TÊN dự án, TÊN điều khoản thanh toán và MÃ HÀNG.
       Nối lại một lần về đúng ID nội bộ của danh mục; tên vẫn giữ nguyên làm
       bản chụp để in. Không khớp được thì để trống ID, dữ liệu cũ không bị đổi.
       ---------------------------------------------------------------------- */
    (function () {
        var duAnTen = {}, dkTen = {};
        (d.duAn || []).forEach(function (x) { if (x.ten) duAnTen[T.kd(x.ten)] = x.id; });
        (d.dieuKhoanTT || []).forEach(function (x) {
            if (x.ten) dkTen[T.kd(x.ten)] = x.id;
            if (x.noiDung) dkTen[T.kd(x.noiDung)] = x.id;
        });
        ['baoGia', 'donBan', 'hopDong', 'phieuXuat', 'bienBanGiao',
         'bienBanNghiemThu', 'deNghiTT', 'phuLuc'].forEach(function (c) {
            (d[c] || []).forEach(function (r) {
                if (r.duAnId === undefined) {
                    r.duAnId = (r.duAn && duAnTen[T.kd(r.duAn)]) || '';
                    doi = true;
                }
                if (r.dieuKhoanTT !== undefined && r.dieuKhoanTTId === undefined) {
                    r.dieuKhoanTTId = dkTen[T.kd(r.dieuKhoanTT || '')] || '';
                    doi = true;
                }
            });
        });
        [['khachHang', d.khachHang], ['nhaCungCap', d.nhaCungCap]].forEach(function (x) {
            (x[1] || []).forEach(function (k) {
                if (k.dieuKhoanTTId === undefined) {
                    k.dieuKhoanTTId = dkTen[T.kd(k.dieuKhoanTT || '')] || '';
                    doi = true;
                }
            });
        });
        /* Dòng hàng của mọi chứng từ phải mang ID NỘI BỘ của mặt hàng. */
        T.COLL_CT.forEach(function (c) {
            (d[c] || []).forEach(function (r) {
                (r.lines || []).forEach(function (l) {
                    if (l.hangHoaId) return;
                    var id = T.idHH(l.maHang || l.ma || '');
                    if (id) { l.hangHoaId = id; doi = true; }
                });
            });
        });
    })();

    /* ----------------------------------------------------------------------
       v5.0: MODULE BẢNG GIÁ
         · Danh mục LOẠI GIÁ do doanh nghiệp tự khai — khai sẵn bộ chuẩn cho lần
           chạy đầu, bổ sung mọi loại giá đang có trong các phiên bản bảng giá.
         · Phiên bản bảng giá có KỲ (năm · quý · tháng) dẫn xuất từ ngày hiệu lực.
         · Phiên bản đã có bản mới hơn thay thế thì KHÓA, không sửa được số liệu.
       ---------------------------------------------------------------------- */
    if (!(d.loaiGia || []).length) {
        T.LOAI_GIA_MAC_DINH.forEach(function (x) {
            d.loaiGia.push({ id: T.uid('LG'), ma: x.ma, ten: x.ten, thuTu: x.thuTu,
                             moTa: x.moTa, trangThai: 'Đang dùng', _tao: T.now() });
        });
        doi = true;
    }
    (function () {
        var co = {};
        (d.loaiGia || []).forEach(function (x) { co[T.kd(x.ten || '')] = 1; });
        var them = [];
        (d.bangGiaBan || []).forEach(function (b) {
            (b.cotGia || []).forEach(function (c) {
                var k = T.kd(c || '');
                if (!k || co[k]) return;
                co[k] = 1; them.push(c);
            });
        });
        them.forEach(function (c, i) {
            d.loaiGia.push({ id: T.uid('LG'), ma: 'LG' + ('00' + (d.loaiGia.length + 1)).slice(-2),
                ten: c, thuTu: 50 + i, moTa: 'Đọc được từ bảng giá của nhà cung cấp',
                trangThai: 'Đang dùng', _tao: T.now() });
            doi = true;
        });
    })();
    (d.bangGiaBan || []).forEach(function (b) {
        if (b.nam === undefined) { T.ganKyBangGia(b); doi = true; }
        if (b.khoa === undefined) { b.khoa = false; doi = true; }
        if (b.tepGocId === undefined) { b.tepGocId = ''; doi = true; }
        if (b.hangSX === undefined) { b.hangSX = b.nhaCungCap || ''; doi = true; }
    });

    /* ----------------------------------------------------------------------
       v5.1: ĐỀ NGHỊ THANH TOÁN — CĂN CỨ NGHIỆM THU
       Đề nghị thanh toán được lập trên căn cứ Biên bản nghiệm thu (BBNT) hoặc
       Biên bản nghiệm thu giá trị (BBNTGT). Chứng từ đời cũ chưa có trường này
       thì để trống — số liệu đã khai trên chứng từ KHÔNG bị thay đổi. Tìm được
       đúng biên bản của cùng hợp đồng / đơn bán thì nối lại liên kết.
       ---------------------------------------------------------------------- */
    (function () {
        var ds = d.deNghiTT || [];
        if (!ds.length) return;
        var theoHD = {}, theoDB = {};
        (d.bienBanNghiemThu || []).forEach(function (b) {
            if (b.trangThai === 'Đã hủy') return;
            if (b.hopDongId) (theoHD[b.hopDongId] = theoHD[b.hopDongId] || []).push(b);
            if (b.donBanId) (theoDB[b.donBanId] = theoDB[b.donBanId] || []).push(b);
        });
        function chonBB(r) {
            var ds2 = (r.hopDongId && theoHD[r.hopDongId]) ||
                      (r.donBanId && theoDB[r.donBanId]) || [];
            if (!ds2.length) return null;
            var gt = ds2.filter(function (b) { return b.mauNT === 'GT'; });
            var d2 = (gt.length ? gt : ds2).slice().sort(function (a, b) {
                return String(b.ngay || '').localeCompare(String(a.ngay || '')) ||
                       String(a.id).localeCompare(String(b.id));
            });
            return d2[0] || null;
        }
        ds.forEach(function (r) {
            if (r.loaiCanCu === undefined || r.bienBanNTId === undefined) {
                var bb = chonBB(r);
                r.loaiCanCu = bb ? (bb.mauNT === 'GT' ? 'BBNTGT' : 'BBNT') : '';
                r.bienBanNTId = bb ? bb.id : '';
                r.bienBanNTSo = bb ? (bb.so || '') : '';
                doi = true;
            }
            /* Liên kết trỏ tới biên bản không còn tồn tại thì gỡ, không để mồ côi. */
            if (r.bienBanNTId && !DB.get('bienBanNghiemThu', r.bienBanNTId)) {
                r.loaiCanCu = ''; r.bienBanNTId = ''; r.bienBanNTSo = ''; doi = true;
            }
        });
    })();

    // gán Mã giao dịch cho các chứng từ chưa có, theo đúng chuỗi liên kết sẵn có
    if (T.ganMaGD()) doi = true;

    // BẢNG GIÁ THEO CÔNG TY: dữ liệu cũ dùng bậc PP / ĐL / BL → đổi sang mã bậc giá mới
    var DOI_BAC = { PP: 'DUAN', DL: 'DAILY', BL: 'BANLE' };
    (d.khachHang || []).forEach(function (k) {
        if (DOI_BAC[k.mucGia]) { k.mucGia = DOI_BAC[k.mucGia]; doi = true; }
        /* KHÔNG xóa chính sách giá riêng của khách: đây là dữ liệu do người dùng
           khai. Chỉ bỏ tham chiếu tới bảng giá không còn tồn tại. */
        if (k.bangGiaId && !DB.get('bangGiaBan', k.bangGiaId)) { k.bangGiaId = ''; doi = true; }
    });
    (d.bangGiaBan || []).forEach(function (b) {
        /* KIẾN TRÚC V1.0 — chỉ đơn vị nguồn xây dựng bảng giá, bảng giá dùng chung
           cho cả nhóm. Dữ liệu cũ gắn bảng giá vào từng công ty phát hành được
           chuẩn hóa về phạm vi dùng chung. */
        if (b.donViId) { b.donViId = ''; doi = true; }
        else if (b.donViId === undefined) { b.donViId = ''; doi = true; }
        if (DOI_BAC[b.ma]) { b.ma = DOI_BAC[b.ma]; doi = true; }
    });


    /* ----------------------------------------------------------------------
       ĐÁNH DẤU ĐẦU VÀO ĐÃ DÙNG KHI ĐÓNG BĂNG GIÁ VỐN.
       Engine chỉ tính lại giá nội bộ khi đơn vị phát hành hoặc phiên bản bảng
       giá của chứng từ khác với lúc đóng băng. Dòng dữ liệu cũ chưa mang hai
       mốc này nên được ghi đúng bằng đơn vị và phiên bản của chính chứng từ —
       KHÔNG một con số nào thay đổi, chỉ bổ sung dấu vết để quy tắc có hiệu lực
       cả trên dữ liệu đã có.
       ---------------------------------------------------------------------- */
    ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat',
     'bienBanGiao', 'bienBanNghiemThu'].forEach(function (c) {
        (d[c] || []).forEach(function (r) {
            (r.lines || []).forEach(function (l) {
                if (l.giaVon === undefined || l.giaVon === '') return;
                if (l.donViGiaVon === undefined) { l.donViGiaVon = r.donVi || ''; doi = true; }
                if (l.bangGiaGiaVon === undefined) { l.bangGiaGiaVon = r.bangGiaId || ''; doi = true; }
                if (l.cotGiaVon === undefined) { l.cotGiaVon = r.cotGia || ''; doi = true; }
                /* Mô hình cũ cho phép sửa tay giá vốn nội bộ ngay trên dòng hàng.
                   Kiến trúc mới: giá vốn nội bộ do Engine tính ngầm, người dùng
                   không nhập ở đâu cả. Riêng dòng nạp từ DỮ LIỆU LỊCH SỬ vẫn phải
                   được bảo vệ tuyệt đối nên chuyển thành cờ khóa giá vốn. */
                if (l.giaVonSuaTay !== undefined) {
                    if (l.nguonGiaVon === 'Lịch sử') l.giaVonKhoa = true;
                    delete l.giaVonSuaTay; doi = true;
                }
            });
        });
    });

    /* HỒ SƠ TỐI THIỂU CỦA MẶT HÀNG — Nhóm hàng và Hãng là hai trường mô tả bắt
       buộc. Dữ liệu cũ thiếu thì điền mặc định để mặt hàng nào cũng đủ hồ sơ;
       người dùng sửa lại lúc nào cũng được. */
    (d.hangHoa || []).forEach(function (h) {
        if (!String(h.nhom || '').trim()) { h.nhom = T.NHOM_MAC_DINH; doi = true; }
        if (!String(h.hang || h.nhaSanXuat || '').trim()) {
            h.hang = T.HANG_MAC_DINH; h.nhaSanXuat = h.hang;
            if (!h.thuongHieu) h.thuongHieu = h.hang;
            doi = true;
        }
    });

    // PHÂN HỆ KHO: hàng hóa cần có Thương hiệu / Nhà sản xuất để lọc trong báo cáo kho
    (d.hangHoa || []).forEach(function (h) {
        if (h.thuongHieu === undefined) { h.thuongHieu = h.xuatXu || ''; doi = true; }
        if (h.nhaSanXuat === undefined) { h.nhaSanXuat = h.xuatXu || ''; doi = true; }
    });
    /* ----------------------------------------------------------------------
       LÔ NHẬP CHUYỂN SANG VÒNG ĐỜI HAI BƯỚC.
       Hai trạng thái nháp đời cũ mang tên theo việc phân bổ chi phí; nay đặt
       tên theo đúng việc người dùng đang làm — kiểm tra rồi mới nhập kho.
       Lô đã vào sổ được KHÓA lại; lô còn nháp được mở để sửa, xóa, nhập lại.
       ---------------------------------------------------------------------- */
    (d.loNhap || []).forEach(function (lo) {
        var moi = T.TT_LO_CU[lo.trangThai];
        if (moi) { lo.trangThai = moi; doi = true; }
        if (!lo.trangThai) { lo.trangThai = 'Chờ kiểm tra'; doi = true; }
        var daVaoSo = T.TT_LO_DA_VAO_SO.indexOf(lo.trangThai) >= 0;
        if (!!lo.khoa !== daVaoSo) { lo.khoa = daVaoSo; doi = true; }
    });

    /* ---- v1.1: LÔ NHẬP KHÔNG TỰ CỘNG TỒN — sinh Phiếu nhập kho cho các lô cũ ---- */
    d.phieuNhap = d.phieuNhap || [];
    /* TRẠNG THÁI ĐƠN MUA PHẢI KHỚP THỰC TẾ KHO.
       Dữ liệu đời cũ đánh "Đã nhận hàng" ngay lúc lưu phiếu, trong khi lô nhập
       chưa hề vào kho — công nợ phải trả tăng lên cho số hàng chưa nhận. Nay
       chỉ đơn mua nào THẬT SỰ có hàng vào kho mới mang trạng thái đó. */
    (d.donMua || []).forEach(function (dm) {
        if (dm.trangThai !== 'Đã nhận hàng') return;
        var co = (d.loNhap || []).some(function (lo) {
            if (lo.donMuaId !== dm.id && dm.loNhapId !== lo.id) return false;
            return T.TT_LO_DA_VAO_SO.indexOf(lo.trangThai) >= 0;
        });
        if (!co) { dm.trangThai = 'Đã đặt hàng'; doi = true; }
    });
    var seqPN = d._meta.seq.PN || 0;
    (d.loNhap || []).forEach(function (lo) {
        /* CHỈ lô ĐÃ VÀO SỔ mới được sinh phiếu nhập. Lô còn nháp tuyệt đối
           không được đụng tới — đó là toàn bộ ý nghĩa của bước một. */
        if (T.TT_LO_DA_VAO_SO.indexOf(lo.trangThai) < 0) return;
        if (lo.phieuNhapId && DB.get('phieuNhap', lo.phieuNhapId)) return;
        if (DB.all('phieuNhap').filter(function (x) {
                return x.loNhapId === lo.id && x.trangThai !== 'Đã hủy'; }).length) return;
        var tonDau = lo.trangThai === 'Tồn đầu kỳ' || lo.loai === 'Tồn đầu kỳ';
        seqPN++;
        var pn = {
            id: T.uid('PN'), so: 'PNK-' + (new Date().getFullYear()) + ('00' + seqPN).slice(-3),
            ngay: lo.ngayNhapKho || lo.ngay, nguon: tonDau ? 'Tồn đầu kỳ' : 'Lô nhập',
            loNhapId: lo.id, loNhapSo: lo.so,
            nhaCungCapId: lo.nhaCungCapId || '', nhaCungCap: lo.nhaCungCap || '',
            khoId: lo.khoId || '', nguoiLapId: lo.nguoiLapId || '', nguoiLap: lo.nguoiLap || '',
            ghiChu: tonDau ? 'Tồn đầu kỳ chuyển sang' :
                ('Nhập kho theo lô ' + lo.so + (lo.soHoaDon ? ' — hóa đơn ' + lo.soHoaDon : '')),
            lines: (lo.lines || []).map(function (l) {
                return { hangHoaId: T.idDong(l), maHang: l.maHang, tenHang: l.tenHang, dvt: l.dvt,
                         soLuong: Number(l.soLuong) || 0, giaVon: Number(l.giaVonLo) || 0,
                         thanhTien: Math.round((Number(l.soLuong) || 0) * (Number(l.giaVonLo) || 0)) };
            }),
            trangThai: 'Đã ghi sổ', _tao: T.now()
        };
        pn.tongTien = T.sum(pn.lines, function (l) { return l.thanhTien; });
        d.phieuNhap.push(pn);
        lo.phieuNhapId = pn.id; lo.phieuNhapSo = pn.so;
        doi = true;
    });
    d._meta.seq.PN = seqPN;

    /* ---- v1.1: BẢNG GIÁ do doanh nghiệp tự khai báo — bỏ bậc giá cố định.
       Chỉ khai lần đầu cho hồ sơ CHƯA HỀ có trường này; khách đã được người dùng
       chọn chính sách giá (kể cả chọn "theo mặc định của công ty" = rỗng) thì
       giữ nguyên, không bao giờ gán đè. ---- */
    (d.khachHang || []).forEach(function (k) {
        if (k.bangGiaId !== undefined) return;
        var bg = T.bangGiaMacDinh(k.donViId || d._meta.ctyId, k.mucGia);
        k.bangGiaId = bg ? bg.id : ''; doi = true;
    });
    (d.phieuXuat || []).forEach(function (px) {
        if (!px.nguon) { px.nguon = px.donBanId ? 'Đơn bán' : 'Điều chỉnh'; doi = true; }
    });

    /* ---- v1.1: quy cách chuyển hẳn về danh mục Hàng hóa ---- */
    (d.hangHoa || []).forEach(function (h) {
        if (!h.quyCach && h.plId) {
            var pl = DB.get('bangGia', h.plId);
            if (pl && pl.quyCach) { h.quyCach = pl.quyCach; doi = true; }
        }
    });

    /* ==================================================================
       v2.6: MÃ HÀNG VÀ MODEL LÀ MỘT
       Nghiệp vụ thực tế của doanh nghiệp: mã hàng chính là model của nhà sản
       xuất. Vì vậy hệ thống chỉ còn MỘT trường duy nhất — "Mã hàng (Model)"
       (h.ma). Trường model cũ bị gỡ bỏ hoàn toàn.

       Dữ liệu cũ được hợp nhất tự động và KHÔNG mất mát:
         • Mặt hàng chưa có mã  → lấy luôn model làm mã hàng.
         • Mặt hàng đã có mã và model khác mã → model cũ được giữ lại trong
           danh sách MÃ KHÁC (h.maKhac) để các tệp bảng giá cũ vẫn đối chiếu
           được. Đây KHÔNG phải một trường nghiệp vụ thứ hai: người dùng không
           nhập, không sửa, chỉ dùng để nhận diện khi nhập tệp.
       Mọi tham chiếu maHang trên chứng từ, kho, bảng giá giữ nguyên nên không
       có bản ghi nào bị đứt liên kết.
       ================================================================== */
    /* Từ v4.0 MODEL trở lại là một thuộc tính master độc lập với MÃ ERP, nên
       bước hợp nhất của v2.6 chỉ còn giữ lại phần khởi tạo danh sách mã khác. */
    (d.hangHoa || []).forEach(function (h) {
        if (h.maKhac === undefined) { h.maKhac = []; doi = true; }
    });
    /* Danh mục bảng giá gốc của nhà cung cấp cũng chỉ còn một trường mã */
    (d.bangGia || []).forEach(function (p) {
        if (p.model === undefined) return;
        if (!String(p.ma || '').trim()) p.ma = String(p.model || '').trim();
        delete p.model; doi = true;
    });
    /* Dòng bảng giá cũ cũng chỉ còn một mã hàng duy nhất */
    (d.bangGiaBan || []).forEach(function (b) {
        (b.hang || b.lines || []).forEach(function (x) {
            if (x.model === undefined) return;
            if (!String(x.maHang || x.ma || '').trim() && x.model) {
                if (x.maHang !== undefined) x.maHang = x.model; else x.ma = x.model;
            }
            delete x.model; doi = true;
        });
    });

    /* ---- v1.6: thông số kỹ thuật của hàng hóa, chiết khấu và ghi chú của bảng giá ---- */
    (d.hangHoa || []).forEach(function (h) {
        if (h.thongSo === undefined) { h.thongSo = ''; doi = true; }
    });
    (d.bangGiaBan || []).forEach(function (b) {
        if (!b.ck) { b.ck = {}; doi = true; }
        if (!b.gc) { b.gc = {}; doi = true; }
        // Bảng giá nhiều loại giá: bảng giá cũ quy về một loại giá tên "Giá bán"
        if (!b.cotGia || !b.cotGia.length) { b.cotGia = ['Giá bán']; doi = true; }
        if (!b.cotChinh) { b.cotChinh = b.cotGia[0]; doi = true; }
        if (!b.bang) {
            b.bang = {};
            Object.keys(b.gia || {}).forEach(function (m) {
                var o = {}; o[b.cotChinh] = b.gia[m]; b.bang[m] = o;
            });
            doi = true;
        }
        // v1.6.2: hồ sơ phiên bản bảng giá
        if (b.nhaCungCap === undefined) { b.nhaCungCap = ''; doi = true; }
        if (b.nguoiCapNhat === undefined) {
            b.nguoiCapNhat = b._nguoiTao || DB.user().hoTen || ''; doi = true;
        }
        if (b.ngayNhap === undefined) { b.ngayNhap = b.tuNgay || T.today(); doi = true; }
        if (!b.phienBan) { b.phienBan = 1; doi = true; }
    });
    // v1.6.2: chính sách giá của từng đơn vị phát hành — quản trị tự cấu hình
    (d.donVi || []).forEach(function (dv) {
        if (!dv.chinhSachGia) {
            dv.chinhSachGia = { cotGia: '', ckLoai: '%', ckMuc: 0, lamTron: 0, cachTron: 'gan' };
            doi = true;
        }
        // v1.7: hồ sơ pháp lý đầy đủ của công ty — chữ ký và con dấu riêng
        if (dv.chuKy === undefined) { dv.chuKy = ''; doi = true; }
        if (dv.conDau === undefined) { dv.conDau = ''; doi = true; }
    });
    // v1.7: cấu hình kiến trúc đa công ty
    if (!d._meta.daCongTy) {
        var nguon = (d.donVi || []).filter(function (x) { return x.laDonViKho; })[0] ||
                    (d.donVi || [])[0] || {};
        d._meta.daCongTy = {
            ctyNguonId: nguon.id || '',        // công ty nhập khẩu, sở hữu kho và giá vốn
            cotGiaGoc: 'Giá phân phối',        // cột giá làm giá gốc nội bộ — quản trị đổi được
            batButToan: true                   // tự sinh bút toán quản trị nội bộ
        };
        doi = true;
    }
    if (!d.duAn) { d.duAn = []; doi = true; }
    if (!d.butToanNB) { d.butToanNB = []; doi = true; }

    /* ----------------------------------------------------------------------
       PHÂN HỆ CHI PHÍ — KHOẢN MỤC CHI VÀ PHIẾU CHI
       Chi phí trước đây không tồn tại trong báo cáo lãi lỗ: phiếu chi chỉ là
       dòng tiền. Nâng cấp này dựng danh mục Khoản mục chi và xếp mỗi phiếu chi
       cũ vào đúng khoản mục, để Engine biết khoản nào là CHI PHÍ và khoản nào
       chỉ là thanh toán tiền hàng (tiền đó đã nằm trong giá vốn).
       ---------------------------------------------------------------------- */
    /* ĐƠN MUA HÀNG KHÔNG CÓ GIÁ VỐN BÁN VÀ KHÔNG CÓ LÃI GỘP. Bản cũ từng đóng
       băng giá vốn bán lên đơn mua rồi lấy tiền hàng trừ đi ra "lãi gộp" — hai
       con số vô nghĩa trên một chứng từ mua. Dọn hẳn để không lọt vào báo cáo. */
    (d.donMua || []).forEach(function (r) {
        if (r.tongGiaVon !== undefined) { delete r.tongGiaVon; doi = true; }
        if (r.laiGop !== undefined) { delete r.laiGop; doi = true; }
        (r.lines || []).forEach(function (l) {
            ['giaVon', 'giaVonGoc', 'nguonGiaVon', 'ngayGiaVon', 'donViGiaVon',
             'bangGiaGiaVon', 'cotGiaVon'].forEach(function (k) {
                if (l[k] !== undefined) { delete l[k]; doi = true; }
            });
        });
    });

    /* ĐÓNG BĂNG GIÁ VỐN GỐC CHO MỌI CHỨNG TỪ BÁN HÀNG ĐỜI CŨ. Trước đây chỉ đơn
       bán được đóng băng nên hợp đồng, phiếu xuất, biên bản nghiệm thu lập
       thẳng phải hỏi lại giá vốn bình quân của hôm nay — số của chứng từ đã
       phát hành trôi theo thời gian. Lấy đúng giá vốn tại NGÀY LẬP chứng từ. */
    ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat',
     'bienBanGiao', 'bienBanNghiemThu'].forEach(function (c) {
        (d[c] || []).forEach(function (r) {
            (r.lines || []).forEach(function (l) {
                if (l.giaVonGoc !== undefined && Number(l.giaVonGoc) > 0) return;
                var g = T.giaVonGoc(l, r.ngay);
                if (g > 0 || l.giaVonGoc === undefined) { l.giaVonGoc = g; doi = true; }
            });
        });
    });

    if (!d.khoanMucChi) { d.khoanMucChi = []; doi = true; }
    (function () {
        var coMa = {};
        d.khoanMucChi.forEach(function (k) { if (k.ma) coMa[String(k.ma).toUpperCase()] = k; });
        T.KHOAN_MUC_CHI_GOC.forEach(function (g) {
            var cu = coMa[g.ma];
            if (cu) {
                /* Giữ nguyên tên người dùng đã sửa; chỉ bù thuộc tính còn thiếu. */
                if (cu.vaoChiPhi === undefined) { cu.vaoChiPhi = g.vaoChiPhi; doi = true; }
                if (cu.giamCongNo === undefined) { cu.giamCongNo = g.giamCongNo; doi = true; }
                /* v18.1.0 — bù nhóm trên báo cáo KQHĐKD, giữ nguyên nếu đã khai. */
                if (cu.nhomBC === undefined) { cu.nhomBC = g.nhomBC || 'khac'; doi = true; }
                if (cu.laiVay === undefined) { cu.laiVay = !!g.laiVay; doi = true; }
                if (!cu.trangThai) { cu.trangThai = 'Đang dùng'; doi = true; }
                return;
            }
            d.khoanMucChi.push({ id: T.uid('KM'), ma: g.ma, ten: g.ten, vaoChiPhi: g.vaoChiPhi,
                                 giamCongNo: g.giamCongNo, nhomBC: g.nhomBC || 'khac',
                                 laiVay: !!g.laiVay,
                                 moTa: g.moTa || '',
                                 trangThai: 'Đang dùng', _tao: T.now(), _nguoiTao: 'Hệ thống' });
            doi = true;
        });
    })();
    (function () {
        var theoMa = {};
        (d.khoanMucChi || []).forEach(function (k) { theoMa[String(k.ma).toUpperCase()] = k; });
        var tienHang = theoMa.CP01;
        (d.phieuChi || []).forEach(function (p) {
            if (p.duAnId === undefined) { p.duAnId = ''; p.duAn = p.duAn || ''; doi = true; }
            if (p.khoanMucId) return;
            /* CHỈ XẾP KHOẢN MỤC KHI CHẮC CHẮN. Phiếu chi gắn đúng một đơn mua
               hàng là thanh toán tiền hàng — điều này không phải suy đoán.
               Mọi phiếu chi còn lại ĐỂ NGUYÊN chưa phân loại: đoán bừa theo lý
               do ghi tay sẽ xếp nhầm một khoản trả tiền hàng thành chi phí và
               tính hai lần đúng khoản tiền đã nằm trong giá vốn. Bộ Đối chiếu
               nêu tên từng phiếu để người dùng khai cho đúng. */
            if (!p.donMuaId || !tienHang) return;
            p.khoanMucId = tienHang.id; p.khoanMuc = tienHang.ten; doi = true;
        });
    })();

    /* ----------------------------------------------------------------------
       PHÂN HỆ GÓP VỐN CỔ ĐÔNG (v12.0.0) — KHỞI TẠO DỮ LIỆU GỐC.
       Khối này CHỈ THÊM, không đụng tới bất kỳ bảng nào đang có. Chạy lại bao
       nhiêu lần cũng cho đúng một kết quả: đã có cổ đông thì không tạo thêm,
       đã sửa tỷ lệ thì không ghi đè.
       ---------------------------------------------------------------------- */
    (function khoiTaoVonCoDong() {
        if (!d.aiDeXuat)    { d.aiDeXuat = [];    doi = true; }
        if (!d.aiBaseline)  { d.aiBaseline = [];  doi = true; }
        if (!d.aiNhatKy)    { d.aiNhatKy = [];    doi = true; }
        if (!d.aiBoQua)     { d.aiBoQua = [];     doi = true; }
        if (!d.coDong)      { d.coDong = [];      doi = true; }
        if (!d.dotGopVon)   { d.dotGopVon = [];   doi = true; }
        if (!d.giaoDichVon) { d.giaoDichVon = []; doi = true; }

        /* Cấu hình — lãi suất chậm góp, quy định khấu trừ, và TRƯỜNG DỰ PHÒNG
           "tienVay". Phiên bản này chưa triển khai chức năng vay nên tienVay
           luôn bằng 0 và KHÔNG hiển thị trên giao diện; Engine vẫn giữ đủ chỗ
           để sau này bật lên mà không phải sửa lại kiến trúc. */
        var c = d._meta.vonCoDong;
        if (!c) { c = d._meta.vonCoDong = {}; doi = true; }
        if (!(Number(c.laiSuat) >= 0))    { c.laiSuat = 8;      doi = true; }
        if (c.khauTruLai === undefined)   { c.khauTruLai = true; doi = true; }
        if (!(Number(c.tienVay) >= 0))    { c.tienVay = 0;      doi = true; }

        /* Ba cổ đông mặc định 40% · 40% · 20% — KHÔNG ghi cứng ở bất cứ đâu
           trong Engine, chỉ là bản ghi khởi tạo. Người dùng đổi tên, đổi tỷ lệ,
           thêm hoặc ngừng cổ đông lúc nào cũng được; toàn bộ lịch sử tỷ lệ được
           giữ lại trong chính bản ghi cổ đông. */
        if (!d.coDong.length) {
            /* MỐC TỶ LỆ ĐẦU TIÊN PHẢI CÓ HIỆU LỰC TỪ TRƯỚC MỌI CHỨNG TỪ ĐANG CÓ.
               Lấy ngày tạo kho dữ liệu (thường là hôm nay) sẽ khiến mọi phép tra
               tỷ lệ ở ngày cũ rơi ra ngoài lịch sử — đúng cái làm sai dữ liệu cũ
               mà luồng đổi tỷ lệ phải tránh. */
            var som = '';
            ['donBan', 'baoGia', 'hopDong', 'phieuXuat', 'phieuNhap', 'donMua', 'loNhap',
             'phieuThu', 'phieuChi'].forEach(function (c) {
                (d[c] || []).forEach(function (x) {
                    var v = String(x.ngay || '').substr(0, 10);
                    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && (!som || v < som)) som = v;
                });
            });
            var ngay = som ? T.addDays(som, -1) : (d._meta.taoLuc || T.now()).substr(0, 10);
            [['CD01', 'Cổ đông 1', 40], ['CD02', 'Cổ đông 2', 40], ['CD03', 'Cổ đông 3', 20]]
            .forEach(function (x) {
                d.coDong.push({
                    id: T.uid('CD'), ma: x[0], ten: x[1], tyLe: x[2],
                    dienThoai: '', email: '', ngayHieuLuc: ngay,
                    trangThai: 'Đang tham gia', ghiChu: '',
                    lichSuTyLe: [{ tuNgay: ngay, tyLe: x[2], lyDo: 'Tỷ lệ khởi tạo',
                                   ai: 'Hệ thống', luc: T.now() }],
                    _tao: T.now(), _nguoiTao: 'Hệ thống'
                });
            });
            doi = true;
        }

        /* Bù trường còn thiếu cho dữ liệu cũ — không ghi đè giá trị đã có. */
        d.coDong.forEach(function (cd) {
            if (!cd.lichSuTyLe || !cd.lichSuTyLe.length) {
                cd.lichSuTyLe = [{ tuNgay: cd.ngayHieuLuc || T.today(), tyLe: Number(cd.tyLe) || 0,
                                   lyDo: 'Tỷ lệ khởi tạo', ai: 'Hệ thống', luc: T.now() }];
                doi = true;
            }
            if (!cd.trangThai) { cd.trangThai = 'Đang tham gia'; doi = true; }
        });
        d.dotGopVon.forEach(function (dt) {
            if (!dt.phanBo) { dt.phanBo = []; doi = true; }
            if (!dt.trangThai) { dt.trangThai = 'Đang mở'; doi = true; }
        });
        d.giaoDichVon.forEach(function (g) {
            if (!g.trangThai) { g.trangThai = 'Đã ghi sổ'; doi = true; }
        });
    })();

    /* ----------------------------------------------------------------------
       MỌI ĐƠN VỊ HÀNG TỒN KHO ĐỀU PHẢI CÓ CHỨNG TỪ ĐỨNG SAU.
       Dữ liệu chuyển từ Excel sang có tồn kho nhưng không có phiếu nhập nào —
       trước đây thẻ kho tự chèn một dòng "số dư đầu" để bù cho khớp. Cái bù đó
       làm phép đối chiếu Tổng nhập − Tổng xuất = Tồn kho luôn đúng một cách giả
       tạo: sổ tự soi gương chính mình, sai đến mấy cũng không phát hiện được.
       Nâng cấp này chuyển phần bù vô hình đó thành PHIẾU NHẬP KHO THẬT, nguồn
       "Tồn đầu kỳ", để mọi đơn vị hàng trong kho đều truy được về một chứng từ.
       ---------------------------------------------------------------------- */
    (function tonDauKyThanhChungTu() {
        var ps = {};
        function cong(id, sl) { if (id) ps[id] = (ps[id] || 0) + sl; }
        (d.phieuNhap || []).forEach(function (pn) {
            if (pn.trangThai !== 'Đã ghi sổ') return;
            (pn.lines || []).forEach(function (l) { cong(T.idDong(l), Number(l.soLuong) || 0); });
        });
        (d.phieuXuat || []).forEach(function (px) {
            if (px.trangThai === 'Nháp' || px.trangThai === 'Đã hủy') return;
            (px.lines || []).forEach(function (l) { cong(T.idDong(l), -(Number(l.soLuong) || 0)); });
        });
        (d.dieuChinhKho || []).forEach(function (dc) {
            if (dc.trangThai !== 'Đã duyệt') return;
            (dc.lines || []).forEach(function (l) { cong(T.idDong(l), Number(l.chenh) || 0); });
        });

        d.phieuNhap = d.phieuNhap || [];
        var cu = d.phieuNhap.filter(function (x) { return x.nguon === 'Tồn đầu kỳ' && x.tuChuyenDoi; })[0];

        /* CHÊNH LỆCH LÀ PHẦN CÒN THIẾU SAU KHI ĐÃ TRỪ CHÍNH PHIẾU BÙ NÀY.
           ps ở trên đã cộng cả dòng của phiếu bù cũ, nên chenh là phần cần THÊM
           vào phiếu bù — không phải toàn bộ nội dung mới của nó. Bản trước lấy
           danh sách chênh lệch rồi THAY THẾ cả phiếu: chỉ cần một mặt hàng lệch
           là 65 dòng còn lại bị xóa trắng, sổ kho nhảy qua nhảy lại giữa hai lần
           mở phần mềm. Nay chỉ GỘP phần chênh vào phiếu đang có. */
        var chenhTheoMa = {};
        (d.hangHoa || []).forEach(function (h) {
            var chenh = (Number(h.ton) || 0) - (ps[h.id] || 0);
            if (Math.abs(chenh) < 0.001) return;
            chenhTheoMa[h.id] = { chenh: chenh, h: h };
        });
        if (!Object.keys(chenhTheoMa).length) return;   // đã cân — không đụng gì

        var lines = [];
        (cu ? (cu.lines || []) : []).forEach(function (l) {
            var id = T.idDong(l), c = chenhTheoMa[id];
            var sl = (Number(l.soLuong) || 0) + (c ? c.chenh : 0);
            if (c) delete chenhTheoMa[id];
            if (Math.abs(sl) < 0.001) return;            // đã hết phần bù cho mã này
            var gv = Number(l.giaVon) || 0;
            lines.push(T.gopGiu(l, { soLuong: sl, giaVon: gv, thanhTien: Math.round(sl * gv) }));
        });
        Object.keys(chenhTheoMa).forEach(function (id) {
            var c = chenhTheoMa[id], h = c.h;
            var gv = Number(h.giaVonBQ === undefined ? h.giaVon : h.giaVonBQ) || 0;
            lines.push({ hangHoaId: h.id, maHang: h.ma, model: h.model || '', tenHang: h.ten,
                         dvt: h.dvt || 'Cái', soLuong: c.chenh, giaVon: gv,
                         thanhTien: Math.round(c.chenh * gv) });
        });
        if (!lines.length) {
            /* Không còn đơn vị hàng nào cần bù — gỡ hẳn phiếu bù cho sổ sạch. */
            if (cu) { d.phieuNhap = d.phieuNhap.filter(function (x) { return x.id !== cu.id; }); doi = true; }
            return;
        }

        /* Ghi trước ngày của chứng từ sớm nhất để mọi phát sinh về sau đều có tồn.
           PHẢI BỎ CHÍNH PHIẾU BÙ RA khi tìm ngày sớm nhất, nếu không mỗi lần mở
           phần mềm ngày của nó lại lùi thêm một ngày. */
        var ngay = cu && cu.ngay;
        if (!ngay) {
            var som = '';
            ['phieuNhap', 'phieuXuat', 'donBan', 'baoGia'].forEach(function (c) {
                (d[c] || []).forEach(function (x) {
                    if (cu && x.id === cu.id) return;
                    if (x.ngay && (!som || x.ngay < som)) som = x.ngay;
                });
            });
            ngay = T.addDays(som || T.today(), -1);
        }

        var rec = { id: (cu && cu.id) || T.uid('PN'), so: (cu && cu.so) || 'PN-TONDAU-001',
                    ngay: ngay, nguon: 'Tồn đầu kỳ', loNhapId: '', loNhapSo: '',
                    nhaCungCapId: '', nhaCungCap: '(tồn đầu kỳ chuyển đổi)',
                    khoId: (T.khoChinh() || {}).id || '',
                    nguoiLapId: '', nguoiLap: 'Hệ thống', tuChuyenDoi: true,
                    ghiChu: 'Tồn kho có sẵn khi bắt đầu dùng phần mềm — dựng thành chứng từ để mọi ' +
                            'đơn vị hàng trong kho đều truy được về một phiếu nhập.',
                    lines: lines, tongTien: T.sum(lines, function (l) { return l.thanhTien; }),
                    trangThai: 'Đã ghi sổ' };
        if (cu) {
            for (var i = 0; i < d.phieuNhap.length; i++)
                if (d.phieuNhap[i].id === cu.id) { d.phieuNhap[i] = rec; break; }
        } else d.phieuNhap.unshift(rec);
        doi = true;
    })();

    // PHÂN HỆ KHO: dựng lại thẻ kho từ chứng từ gốc (sổ dẫn xuất, luôn khớp tồn thực tế)
    T.dungTheKho(); doi = true;

    T.dungButToanNB();
    /* _meta.phienBan là DẤU MỐC CẤU TRÚC DỮ LIỆU, không phải phiên bản phần mềm.
       Kiến trúc v2.8 đánh khóa hàng hóa bằng ID nội bộ nên nâng dấu mốc lên 2.8. */
    if (d._meta.phienBan !== '2.8') { d._meta.phienBan = '2.8'; doi = true; }
    if (doi) DB.save();
};

/**
 * Rà soát toàn bộ chứng từ, gán Mã giao dịch cho chứng từ chưa có:
 * mỗi báo giá / đơn bán lập trực tiếp mở một giao dịch mới, các chứng từ dẫn xuất kế thừa mã đó.
 */
T.ganMaGD = function () {
    var doi = false, d = DB.data;
    d._meta.seqGD = d._meta.seqGD || 0;

    (d.baoGia || []).forEach(function (b) { if (!b.maGD) { b.maGD = DB.maGDMoi(); doi = true; } });
    (d.donBan || []).forEach(function (x) {
        if (x.maGD) return;
        var bg = x.baoGiaId ? DB.get('baoGia', x.baoGiaId) : null;
        x.maGD = (bg && bg.maGD) || DB.maGDMoi(); doi = true;
    });
    ['hopDong', 'phieuXuat', 'phieuThu', 'bienBanGiao', 'bienBanNghiemThu', 'deNghiTT'].forEach(function (c) {
        (d[c] || []).forEach(function (x) {
            if (x.maGD) return;
            var db = x.donBanId ? DB.get('donBan', x.donBanId) : null;
            x.maGD = (db && db.maGD) || T.layMaGD(c, x) || DB.maGDMoi(); doi = true;
        });
    });
    (d.phuLuc || []).forEach(function (x) {
        if (x.maGD) return;
        var hd = x.hopDongId ? DB.get('hopDong', x.hopDongId) : null;
        x.maGD = (hd && hd.maGD) || DB.maGDMoi(); doi = true;
    });

    /* ==================================================================
       v2.8: LIÊN KẾT BẰNG ID NỘI BỘ, KHÔNG LIÊN KẾT BẰNG MODEL
       Model là mã kỹ thuật của nhà sản xuất và ĐƯỢC PHÉP TRÙNG, nên không
       thể dùng làm khóa. Bước nâng cấp này gắn ID nội bộ của hàng hóa vào
       mọi dòng chứng từ, mọi bảng giá và mọi sổ kho. Model vẫn được giữ
       nguyên trên từng dòng để in lại chứng từ cũ đúng như đã phát hành.
       ================================================================== */
    if (T.capSoNoiBo(d)) doi = true;
    if (chuyenSangIdNoiBo(d)) doi = true;

    /* ----------------------------------------------------------------------
       CHIẾT KHẤU NỘI BỘ VỀ ĐÚNG THÔNG TIN CỦA TỪNG PHIÊN BẢN BẢNG GIÁ
       Hai mô hình cũ đều được quy về MỘT cấu trúc duy nhất:
         · Bảng giaNoiBo ở cấp hệ thống (công thức có hiệu lực từ / đến).
         · Chính sách chinhSachNoiBo trong phiên bản (cột tham chiếu · kiểu tính
           · giá trị · ghi đè theo mặt hàng).
       Kiến trúc mới: mỗi phiên bản bảng giá chỉ giữ MỘT bảng phần trăm
       chietKhauNoiBo = { donViId: % }, khai một lần cho cả phiên bản, không khai
       theo mặt hàng. Quy đổi giữ đúng ý nghĩa số học của mức giảm phần trăm;
       các cấu hình cũ không quy được về phần trăm được LƯU TRỮ nguyên trạng để
       tra cứu, không bị áp sai và không bị mất.
       ---------------------------------------------------------------------- */
    (function () {
        var ds = d.bangGiaBan || [];
        var conCu = (d.giaNoiBo || []).length;
        var canChuyen = ds.some(function (b) {
            return b.chietKhauNoiBo === undefined || b.chinhSachNoiBo !== undefined;
        });
        if (!ds.length) return;                 // chưa có nơi để chuyển vào — giữ nguyên dữ liệu cũ
        if (!canChuyen && !conCu) return;
        /* Bảng cũ còn dữ liệu thì MỌI phiên bản đều phải đi qua vòng quy đổi —
           kể cả phiên bản đã có chietKhauNoiBo — nếu không, dòng dọn bảng cũ ở
           cuối sẽ xóa trắng cấu hình chưa kịp chuyển. */
        var epChuyen = !!conCu;

        var luuTru = [];

        /* Quy đổi MỘT cấu hình cũ thành phần trăm chiết khấu nội bộ.
           Trả về null nếu cấu hình đó không diễn đạt được bằng phần trăm. */
        function phanTramTu(c) {
            if (!c) return null;
            var gt = Number(c.giaTri) || 0;
            /* Mô hình chính sách của phiên bản (kiểu tính). */
            if (c.kieuTinh) {
                if (c.kieuTinh === 'giamPhanTram') return Math.abs(gt);
                if (c.kieuTinh === 'bangThamChieu') return 0;
                if (c.kieuTinh === 'tangPhanTram') return 0;   // tăng giá nội bộ: không còn trong mô hình mới
                return null;                                    // giảm tiền · tăng tiền · giá cố định
            }
            /* Mô hình công thức ở cấp hệ thống (loai). */
            if (c.loai === 'phanTram') return gt < 0 ? Math.abs(gt) : 0;
            if (c.loai === 'bangBQ') return 0;
            return null;
        }

        /* Công thức cũ ở cấp hệ thống CÓ HIỆU LỰC tại ngày bắt đầu của phiên bản. */
        function congThucTai(donViId, ngay) {
            var kq = null;
            (d.giaNoiBo || []).forEach(function (g) {
                if (g.donViId !== donViId) return;
                if (g.trangThai === 'Ngừng áp dụng') return;
                if (g.hieuLucTu && g.hieuLucTu > ngay) return;
                if (g.hieuLucDen && g.hieuLucDen < ngay) return;
                if (!kq || (g.hieuLucTu || '') > (kq.hieuLucTu || '')) kq = g;
            });
            return kq;
        }

        var nguonId = (d._meta.daCongTy || {}).ctyNguonId ||
                      ((d.donVi || []).filter(function (x) { return x.laDonViKho; })[0] || {}).id || '';
        var coDV = {};
        (d.donVi || []).forEach(function (x) { coDV[x.id] = 1; });

        ds.forEach(function (b) {
            if (!epChuyen && b.chietKhauNoiBo !== undefined && b.chinhSachNoiBo === undefined) return;
            var ra = T.clone(b.chietKhauNoiBo || {});
            /* 1. Chính sách đã nằm trong phiên bản (mô hình trước đó). */
            (b.chinhSachNoiBo || []).forEach(function (c) {
                if (!c || !c.donViId || !coDV[c.donViId] || c.donViId === nguonId) return;
                var pt = phanTramTu(c);
                if (pt === null) { luuTru.push({ bangGiaId: b.id, bangGiaTen: b.ten || '',
                                                 donViId: c.donViId, cauHinh: T.clone(c) }); return; }
                if (pt > 0) ra[c.donViId] = Math.min(100, Math.round(pt * 100) / 100);
                /* Ghi đè theo từng mặt hàng KHÔNG còn trong mô hình mới — lưu trữ
                   lại nguyên trạng thay vì xóa lặng lẽ. */
                if (c.ghiDe && Object.keys(c.ghiDe).length)
                    luuTru.push({ bangGiaId: b.id, bangGiaTen: b.ten || '',
                                  donViId: c.donViId, ghiDe: T.clone(c.ghiDe) });
            });
            /* 2. Công thức cũ ở cấp hệ thống. Mức đã khai sẵn trong phiên bản được
                  giữ nguyên (người dùng khai gần đây hơn), nhưng vẫn phải duyệt
                  hết bản ghi cũ để cái nào không quy đổi được thì LƯU TRỮ lại. */
            if (conCu) {
                var ngay = b.tuNgay || T.today();
                (d.donVi || []).forEach(function (dv) {
                    if (dv.id === nguonId) return;
                    var c = congThucTai(dv.id, ngay);
                    if (!c) return;
                    var pt = phanTramTu(c);
                    if (pt === null) { luuTru.push({ bangGiaId: b.id, bangGiaTen: b.ten || '',
                                                     donViId: dv.id, cauHinh: T.clone(c) }); return; }
                    if (pt > 0 && ra[dv.id] === undefined)
                        ra[dv.id] = Math.min(100, Math.round(pt * 100) / 100);
                    if (c.ghiDe && Object.keys(c.ghiDe).length)
                        luuTru.push({ bangGiaId: b.id, bangGiaTen: b.ten || '',
                                      donViId: dv.id, ghiDe: T.clone(c.ghiDe) });
                });
            }
            b.chietKhauNoiBo = ra;
            if (b.chinhSachNoiBo !== undefined) delete b.chinhSachNoiBo;
            doi = true;
        });

        if (luuTru.length) {
            d._meta.giaNoiBoLuuTru = (d._meta.giaNoiBoLuuTru || []).concat(luuTru);
            doi = true;
        }
        /* Cấu hình đã nằm trong thông tin phiên bản — KHÔNG lưu ở cấp hệ thống nữa. */
        if ((d.giaNoiBo || []).length) { d.giaNoiBo = []; doi = true; }
    })();

    /* ----------------------------------------------------------------------
       v6.0: CHUẨN HÓA MASTER DATA HÀNG HÓA
       · MÃ HÀNG do hệ thống tự sinh theo MỘT quy tắc thống nhất: HH-<số nội bộ>.
       · MODEL là trường bắt buộc, giữ đúng mã của nhà sản xuất.
       · Mã cũ của doanh nghiệp KHÔNG bị mất: chuyển thành Model (nếu chưa có)
         và luôn được ghi vào MÃ KHÁC nên mọi cách tra cứu, mọi tệp Excel cũ và
         mọi chứng từ đã phát hành vẫn tìm đúng mặt hàng.
       · Chứng từ đã phát hành GIỮ NGUYÊN mã đã in — đó là bản chụp pháp lý.
         Liên kết dữ liệu đi bằng ID nội bộ nên không có gì bị đứt.
       ---------------------------------------------------------------------- */
    (function () {
        var ds = d.hangHoa || [];
        if (!ds.length) return;
        T.capSoNoiBo(d);
        var i, x, maCu;
        for (i = 0; i < ds.length; i++) {
            x = ds[i];
            maCu = String(x.ma || '').trim();
            /* Model bắt buộc — mã cũ của doanh nghiệp chính là Model đang dùng.
               KHÔNG bao giờ chép mã do hệ thống sinh (HH-…) sang Model: Model
               phải là mã của nhà sản xuất, không phải mã nội bộ. */
            if (!String(x.model || '').trim() && maCu && !T.maHangChuan(maCu)) {
                x.model = maCu; doi = true;
            }
            /* Chỉ bỏ qua khi mã ĐÚNG là mã của chính số hiệu nội bộ này. Mã đúng
               dạng nhưng lệch số hiệu vẫn phải cấp lại — nếu không, một doanh
               nghiệp vốn đặt mã dạng HH-100234 sẽ đụng mã với mặt hàng khác. */
            if (maCu === T.maHangTuSo(x.maNoiBo)) continue;
            if (maCu && !T.maHangChuan(maCu)) {
                x.maKhac = T.maKhacTu(
                    (Array.isArray(x.maKhac) ? x.maKhac : String(x.maKhac || '').split(/[,;|\n]/))
                        .concat([maCu]), x.model);
            }
            x.ma = T.maHangTuSo(x.maNoiBo);
            doi = true;
        }
        /* Không mặt hàng nào được dùng chung Mã hàng — cấp lại số nội bộ mới cho
           bản ghi trùng (chỉ xảy ra với dữ liệu khôi phục từ bản sao lưu cũ). */
        var da = {};
        for (i = 0; i < ds.length; i++) {
            x = ds[i];
            var k = T.kd(x.ma || '');
            if (!k || da[k]) { x.maNoiBo = T.soNoiBoMoi(d); x.ma = T.maHangTuSo(x.maNoiBo); doi = true; k = T.kd(x.ma); }
            da[k] = 1;
        }
        if (doi) T._cmHH = null;
    })();

    return doi;
};

/* Bản đồ tra cứu dùng riêng cho bước nâng cấp — chỉ mục chung chưa dựng được
   vì dữ liệu đang trong quá trình chuyển đổi. */
function bandoHH(d) {
    var theoId = {}, theoMa = {}, theoBo = {}, theoTen = {};
    (d.hangHoa || []).forEach(function (h) {
        theoId[String(h.id)] = h;
        var a = T.kd(h.ma || '');
        if (a) { if (theoMa[a] === undefined) theoMa[a] = h; else if (theoMa[a] !== h) theoMa[a] = 'nhieu'; }
        /* MODEL của nhà sản xuất cũng là một cách gọi mặt hàng: chứng từ đời cũ
           in mã của hãng chứ không in mã nội bộ, nên phải tra được cả Model thì
           bước nối lại ID mới không bỏ sót dòng nào. */
        var md = T.kd(h.model || '');
        if (md) { if (theoMa[md] === undefined) theoMa[md] = h; else if (theoMa[md] !== h) theoMa[md] = 'nhieu'; }
        var b = T.khoaHH(h); if (b && !theoBo[b]) theoBo[b] = h;
        var c = T.kd(h.ten || ''); if (c && !theoTen[c]) theoTen[c] = h;
        (h.maKhac || []).forEach(function (k) {
            var kk = T.kd(k || ''); if (!kk || theoMa[kk] !== undefined) return;
            theoMa[kk] = h;
        });
    });
    return { id: theoId, ma: theoMa, bo: theoBo, ten: theoTen };
}
function chuyenSangIdNoiBo(d) {
    var bd = bandoHH(d), doi = false;
    /* Tìm đúng mặt hàng của một dòng cũ: ưu tiên bộ ba Model + Tên + Thông số,
       vì nhiều mặt hàng có thể dùng chung một Model. */
    function tim(l) {
        if (!l) return null;
        if (l.hangHoaId && bd.id[String(l.hangHoaId)]) return bd.id[String(l.hangHoaId)];
        var k = T.khoaHH({ ma: l.maHang || l.ma, ten: l.tenHang || l.ten, thongSo: l.thongSo });
        if (k && bd.bo[k]) return bd.bo[k];
        var m = bd.ma[T.kd(l.maHang || l.ma || '')];
        if (m && m !== 'nhieu') return m;
        var t = bd.ten[T.kd(l.tenHang || l.ten || '')];
        return t || null;
    }
    ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'phieuNhap', 'donMua', 'loNhap',
     'bienBanGiao', 'bienBanNghiemThu', 'kiemKe', 'dieuChinhKho', 'butToanNB'].forEach(function (c) {
        (d[c] || []).forEach(function (r) {
            (r.lines || r.hang || []).forEach(function (l) {
                if (l.hangHoaId && bd.id[String(l.hangHoaId)]) return;
                var h = tim(l);
                if (!h) return;
                l.hangHoaId = h.id; doi = true;
                if (!l.maHang) l.maHang = h.ma;
            });
        });
    });
    /* Sổ kho và lịch sử giá vốn */
    ['theKho', 'lichSuGiaVon'].forEach(function (c) {
        (d[c] || []).forEach(function (x) {
            if (x.hangHoaId && bd.id[String(x.hangHoaId)]) return;
            var h = tim(x);
            if (h) { x.hangHoaId = h.id; doi = true; }
        });
    });
    /* Bảng giá: mọi bảng tra đổi khóa từ Model sang ID nội bộ */
    (d.bangGiaBan || []).forEach(function (b) {
        ['bang', 'gia', 'ck', 'gc'].forEach(function (f) {
            var o = b[f];
            if (!o || typeof o !== 'object') return;
            var moi = {}, co = false;
            Object.keys(o).forEach(function (k) {
                if (bd.id[k]) { moi[k] = o[k]; return; }       // đã là ID nội bộ
                var h = bd.ma[T.kd(k)];
                if (h && h !== 'nhieu') { moi[h.id] = o[k]; co = true; return; }
                var t = bd.ten[T.kd(k)];
                if (t) { moi[t.id] = o[k]; co = true; return; }
                moi[k] = o[k];                                  // không tra được thì giữ nguyên
            });
            if (co) { b[f] = moi; doi = true; }
        });
    });
    /* Giá nội bộ ghi đè theo mặt hàng — cả dữ liệu cũ ở cấp hệ thống lẫn chính
       sách đã nằm trong từng phiên bản bảng giá. */
    function doiKhoaGhiDe(g) {
        var o = g && g.ghiDe;
        if (!o || typeof o !== 'object') return;
        var moi = {}, co = false;
        Object.keys(o).forEach(function (k) {
            if (bd.id[k]) { moi[k] = o[k]; return; }
            var h = bd.ma[T.kd(k)];
            if (h && h !== 'nhieu') { moi[h.id] = o[k]; co = true; return; }
            var t = bd.ten[T.kd(k)];
            if (t) { moi[t.id] = o[k]; co = true; return; }
            moi[k] = o[k];
        });
        if (co) { g.ghiDe = moi; doi = true; }
    }
    (d.giaNoiBo || []).forEach(doiKhoaGhiDe);
    (d.bangGiaBan || []).forEach(function (b) {
        (b.chinhSachNoiBo || []).forEach(doiKhoaGhiDe);   // dữ liệu đời cũ, sẽ được quy đổi khi nâng cấp
    });
    if (doi) T._cmHH = null;
    return doi;
}

/**
 * Ghi dữ liệu xuống bộ nhớ trình duyệt.
 * Biểu mẫu tải lên từ tệp doanh nghiệp có thể rất nặng (ảnh, logo, con dấu).
 * Khi bộ nhớ đầy, hệ thống tự dọn phần ít quan trọng nhất rồi ghi lại:
 *   nhật ký hệ thống.
 * Dữ liệu nghiệp vụ KHÔNG bao giờ bị dọn.
 */
/* --------------------------------------------------------------- GHI GỘP
   Nhập bảng giá hàng chục nghìn dòng sẽ gọi DB.insert rất nhiều lần. Mỗi lần
   ghi xuống localStorage phải tuần tự hóa toàn bộ cơ sở dữ liệu, nên phải gom
   lại và chỉ ghi MỘT lần khi xong. */
DB._gop = 0; DB._canGhi = false;
DB.gopGhi = function () { DB._gop++; };
DB.xongGopGhi = function () {
    if (DB._gop > 0) DB._gop--;
    if (DB._gop > 0) return true;
    if (!DB._canGhi) return true;
    DB._canGhi = false;
    return DB.save();
};
DB.save = function () {
    if (DB._gop > 0) { DB._canGhi = true; return true; }
    function ghi() {
        localStorage.setItem(KEY, JSON.stringify(DB.data));
        return true;
    }
    try { return ghi(); } catch (e) { /* bộ nhớ đầy — dọn bớt rồi ghi lại */ }

    var buoc = [
        function () {                                  // 1. rút gọn nhật ký hệ thống
            if (!DB.data.nhatKy || DB.data.nhatKy.length <= 200) return false;
            DB.data.nhatKy = DB.data.nhatKy.slice(0, 200);
            return true;
        },
        function () {   // 2. bỏ nội dung TỆP GỐC cũ — bản lưu để đối chiếu, không phải số liệu
            var ds = (DB.data.tepGoc || []).filter(function (t) { return t.duLieu; });
            if (!ds.length) return false;
            ds.sort(function (a, b) {
                var x = String(a.luc || ''), y = String(b.luc || '');
                return x < y ? -1 : x > y ? 1 : 0;
            });
            var bo = ds.slice(0, Math.max(1, Math.ceil(ds.length / 2)));
            bo.forEach(function (t) { t.duLieu = ''; t.daBoNoiDung = true; });
            DB._donTepGoc = (DB._donTepGoc || 0) + bo.length;
            return true;
        },
        function () {   // 3. bỏ nốt toàn bộ nội dung tệp gốc còn lại
            var ds = (DB.data.tepGoc || []).filter(function (t) { return t.duLieu; });
            if (!ds.length) return false;
            ds.forEach(function (t) { t.duLieu = ''; t.daBoNoiDung = true; });
            DB._donTepGoc = (DB._donTepGoc || 0) + ds.length;
            return true;
        }
    ];
    for (var i = 0; i < buoc.length; i++) {
        if (!buoc[i]()) continue;
        try {
            var ok = ghi();
            if (W.UI) W.UI.toast('info', 'Đã dọn bớt dữ liệu phụ để lưu được',
                (DB._donTepGoc
                    ? 'Bộ nhớ trình duyệt gần đầy nên hệ thống bỏ nội dung ' + DB._donTepGoc +
                      ' tệp Excel gốc đã lưu (chỉ là bản để đối chiếu). '
                    : 'Bộ nhớ trình duyệt gần đầy nên hệ thống rút gọn nhật ký hệ thống. ') +
                'Toàn bộ dữ liệu nghiệp vụ vẫn giữ nguyên.', 9000);
            DB._donTepGoc = 0;
            return ok;
        } catch (e2) { /* thử bước dọn tiếp theo */ }
    }
    if (W.UI) W.UI.toast('err', 'Không lưu được dữ liệu',
        'Bộ nhớ trình duyệt đã đầy. Hãy sao lưu rồi dọn bớt dữ liệu cũ.');
    return false;
};

DB.all = function (c) { return DB.data[c] || []; };
DB.get = function (c, id) {
    var a = DB.all(c);
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
};
DB.where = function (c, f) { return DB.all(c).filter(f); };

/**
 * SNAPSHOT PHÁP LÝ KHÁCH HÀNG — đóng băng đúng một lần khi chứng từ được lập.
 * Về sau khách hàng đổi tên, đổi địa chỉ, đổi người đại diện thì chứng từ CŨ
 * vẫn in đúng thông tin lúc phát hành; chứng từ MỚI lấy thông tin mới.
 * Đổi sang khách hàng khác trên chính chứng từ đó thì chụp lại bản mới.
 */
function chupKHChungTu(c, o, cu) {
    if (!T.COLL_KH || T.COLL_KH.indexOf(c) < 0) return;
    if (!o || !o.khachHangId) { if (o) delete o.khSnap; return; }
    if (cu && cu.khSnap && cu.khSnap.khachHangId === o.khachHangId) {
        o.khSnap = o.khSnap || cu.khSnap;     // đã đóng băng thì giữ nguyên
        return;
    }
    var kh = DB.get('khachHang', o.khachHangId);
    if (kh) o.khSnap = T.chupKH(kh);
}
DB.chupKHChungTu = chupKHChungTu;

/**
 * SNAPSHOT LOGO ĐƠN VỊ PHÁT HÀNH — chụp mã phiên bản logo đúng lúc phát hành.
 * Đơn vị đổi logo về sau thì chứng từ CŨ vẫn in đúng logo lúc ký; chứng từ MỚI
 * dùng logo mới. Không chép cả dữ liệu ảnh vào chứng từ — chỉ chép mã phiên
 * bản, ảnh nằm một chỗ trong kho ảnh của đơn vị.
 */
function chupLogoChungTu(c, o, cu) {
    if (!T.COLL_CT || T.COLL_CT.indexOf(c) < 0) return;
    if (!o) return;
    if (cu && cu.logoId) { o.logoId = o.logoId || cu.logoId; return; }
    if (o.logoId) return;
    o.logoId = T.logoHienHanh(o.donVi || o.donViId || DB.data._meta.ctyId);
}
DB.chupLogoChungTu = chupLogoChungTu;

DB.insert = function (c, o) {
    /* CHỐNG TRỪ TIỀN HAI LẦN (v18.6.0 — Logic 1). Cổng chặn nằm ở đây, tại
       Engine, nên mọi đường ghi phiếu chi — biểu mẫu, nhập tệp, thao tác hàng
       loạt, hay một màn hình viết sau này — đều đi qua đúng một luật. */
    if (c === 'phieuChi' && T.chanChiTrung && T.chanChiTrung(o, null)) return null;
    o.id = o.id || T.uid(c.substr(0, 2).toUpperCase());
    chupKHChungTu(c, o, null);
    chupLogoChungTu(c, o, null);
    /* ID nội bộ của hàng hóa là khóa của TOÀN BỘ hệ thống — bảng giá, thẻ kho,
       mọi dòng chứng từ đều trỏ vào đây — nên tuyệt đối không được trùng. */
    if (c === 'hangHoa') {
        var cm = T.chiMucHangHoa();
        while (cm.id[String(o.id)]) o.id = T.uid('HA');
    }
    o._tao = T.now(); o._nguoiTao = DB.user().taiKhoan;
    DB.data[c].unshift(o);
    if (c === 'hangHoa' && T._cmHH) { T._cmHH.n = DB.data[c].length; T.themChiMucHH(T._cmHH, o); }
    DB.log('Thêm mới', c, o);
    DB.dongBoNB(c);
    DB.save(); return o;
};
/* Bút toán quản trị nội bộ là SỔ DẪN XUẤT — dựng lại ngay khi đơn bán thay đổi
   nên luôn đồng bộ với chứng từ gốc, không cần thao tác của người dùng. */
DB.dongBoNB = function (c) {
    if (c === 'donBan' && T.dungButToanNB) T.dungButToanNB();
};
DB.update = function (c, id, o) {
    var a = DB.all(c);
    for (var i = 0; i < a.length; i++) if (a[i].id === id) {
        if (c === 'phieuChi' && T.chanChiTrung && T.chanChiTrung(o, a[i])) return null;
        chupKHChungTu(c, o, a[i]);
        chupLogoChungTu(c, o, a[i]);
        if (c === 'donVi') T.doiLogoDonVi(a[i], o);
        o.id = id; o._tao = a[i]._tao; o._sua = T.now(); o._nguoiSua = DB.user().taiKhoan;
        a[i] = o;
        /* CHỈ MỤC NHẬN DIỆN PHẢI THEO KỊP DANH MỤC. Sửa một mặt hàng thay hẳn
           bản ghi cũ bằng bản ghi mới nhưng SỐ LƯỢNG không đổi, nên bộ nhớ đệm
           chỉ mục vẫn tưởng mình còn đúng. Để nguyên thì đổi Tên hàng xong nhập
           tệp sẽ không nhận ra mặt hàng cũ và TỰ TẠO một bản ghi trùng. */
        if (c === 'hangHoa') T._cmHH = null;
        DB.log('Cập nhật', c, o); DB.dongBoNB(c); DB.save(); return o;
    }
    return null;
};
DB.remove = function (c, id) {
    var a = DB.all(c);
    for (var i = 0; i < a.length; i++) if (a[i].id === id) {
        var x = a.splice(i, 1)[0];
        DB.data.thungRac.unshift({ id: T.uid('R'), bang: c, luc: T.now(),
            ai: DB.user().taiKhoan, ten: x.so || x.ten || x.ma || x.id, ban: x });
        if (c === 'hangHoa') T._cmHH = null;
        DB.log('Xóa', c, x); DB.dongBoNB(c); DB.save(); return x;
    }
    return null;
};
DB.restore = function (rid) {
    var t = DB.data.thungRac, i;
    for (i = 0; i < t.length; i++) if (t[i].id === rid) {
        var r = t.splice(i, 1)[0];
        DB.data[r.bang].unshift(r.ban);
        if (r.bang === 'hangHoa') T._cmHH = null;
        DB.log('Khôi phục', r.bang, r.ban); DB.save(); return r.ban;
    }
    return null;
};

var TEN_BANG = {
    khachHang: 'Khách hàng', nhaCungCap: 'Nhà cung cấp', hangHoa: 'Hàng hóa', bangGia: 'Bảng giá',
    kho: 'Kho', baoGia: 'Báo giá', donBan: 'Đơn bán hàng', hopDong: 'Hợp đồng',
    loaiHopDong: 'Loại hợp đồng',
    phieuXuat: 'Phiếu xuất kho', phieuThu: 'Phiếu thu', phieuChi: 'Phiếu chi',
    donMua: 'Đơn mua hàng', nguoiDung: 'Người dùng', donVi: 'Đơn vị phát hành',
    loNhap: 'Lô nhập khẩu', kiemKe: 'Phiếu kiểm kê', dieuChinhKho: 'Điều chỉnh tồn kho',
    theKho: 'Thẻ kho', duAn: 'Dự án', butToanNB: 'Bút toán quản trị nội bộ',
    nhomHang: 'Nhóm hàng', dvt: 'Đơn vị tính', hangSX: 'Hãng sản xuất',
    thueSuat: 'Thuế suất', dieuKhoanTT: 'Điều khoản thanh toán',
    dieuKhoanGH: 'Điều khoản giao hàng', nguoiKy: 'Người ký',
    loaiGia: 'Loại giá', mauBangGia: 'Cấu trúc tệp bảng giá', tepGoc: 'Tệp gốc đã nhập',
    bangGiaBan: 'Bảng giá', giaNoiBo: 'Giá nội bộ', phieuNhap: 'Phiếu nhập kho',
    phuLuc: 'Phụ lục hợp đồng', bienBanGiao: 'Biên bản giao hàng',
    bienBanNghiemThu: 'Biên bản nghiệm thu', deNghiTT: 'Đề nghị thanh toán',
    nhanVien: 'Nhân viên', vaiTro: 'Vai trò', lichSuGiaVon: 'Lịch sử giá vốn',
    gopDuLieu: 'Gộp dữ liệu', nhatKy: 'Nhật ký hệ thống',
    saoLuu: 'Sao lưu dữ liệu', thungRac: 'Thùng rác', khoanMucChi: 'Khoản mục chi',
    coDong: 'Cổ đông', dotGopVon: 'Đợt góp vốn', giaoDichVon: 'Giao dịch vốn',
    aiDeXuat: 'Đề xuất của AI cố vấn', aiNhatKy: 'Nhật ký AI cố vấn',
    aiBaseline: 'Mốc so sánh hệ thống',
    aiBoQua: 'Đánh dấu bỏ qua cảnh báo'
};
T.tenBang = function (c) { return TEN_BANG[c] || c; };

DB.log = function (viec, c, o) {
    if (!DB.data.nhatKy) DB.data.nhatKy = [];
    DB.data.nhatKy.unshift({
        id: T.uid('L'), luc: T.now(), ai: DB.user().taiKhoan, viec: viec,
        bang: T.tenBang(c), mota: (o && (o.so || o.ten || o.ma)) || ''
    });
    if (DB.data.nhatKy.length > 400) DB.data.nhatKy.length = 400;
};

/* ------------------------------------------------ ĐƠN VỊ ĐANG LÀM VIỆC */
DB.cty = function () {
    return DB.get('donVi', DB.data._meta.ctyId) || DB.all('donVi')[0];
};
DB.setCty = function (id) {
    DB.data._meta.ctyId = id;
    DB.log('Chuyển đơn vị làm việc', 'donVi', DB.get('donVi', id));
    DB.save();
};

/* ==========================================================================
   NHẬN DIỆN ĐƠN VỊ PHÁT HÀNH — LOGO, CHỮ KÝ, CON DẤU
   --------------------------------------------------------------------------
   Ảnh nhận diện được TẢI THẲNG VÀO TVERP và lưu trong kho dữ liệu dưới dạng
   dữ liệu ảnh (data URL). Phần mềm KHÔNG dùng đường dẫn Internet và KHÔNG dùng
   đường dẫn tệp trên máy — bản in, Word, Excel, PDF luôn lấy ảnh từ chính dữ
   liệu của TVERP nên không bao giờ mất ảnh.

   ĐỔI LOGO KHÔNG LÀM ĐỔI CHỨNG TỪ CŨ: mỗi lần đổi, logo cũ được giữ lại trong
   kho ảnh của đơn vị theo đúng mã phiên bản (anhKho[logoId]). Chứng từ chụp mã
   phiên bản logo lúc phát hành, nên in lại lúc nào cũng ra đúng logo lúc ký;
   chứng từ mới dùng logo mới.
   ========================================================================== */
T.TRUONG_ANH_DV = ['logo', 'chuKy', 'conDau'];

/** Ảnh đã tải lên là dữ liệu ảnh nhúng, không phải đường dẫn. */
T.laAnhTai = function (v) { return /^data:image\//i.test(String(v || '')); };

/**
 * Giữ lịch sử logo khi đơn vị đổi nhận diện.
 * cu = bản ghi trước khi sửa, o = bản ghi sắp ghi đè.
 */
T.doiLogoDonVi = function (cu, o) {
    if (!cu || !o) return o;
    o.anhKho = T.clone(cu.anhKho || {});
    if (String(o.logo || '') === String(cu.logo || '')) {
        o.logoId = cu.logoId || o.logoId || '';
        return o;
    }
    if (cu.logo) o.anhKho[cu.logoId || ('LG-' + cu.id)] = cu.logo;   // giữ logo cũ
    o.logoId = o.logo ? T.uid('LG') : '';
    T.donKhoAnh(o);
    return o;
};

/**
 * DỌN KHO ẢNH CỦA MỘT ĐƠN VỊ.
 * Chỉ giữ những phiên bản logo còn được ÍT NHẤT MỘT chứng từ tham chiếu. Phiên
 * bản không còn chứng từ nào dùng thì bỏ đi để kho dữ liệu không phình vô hạn —
 * việc này KHÔNG làm đổi bất kỳ chứng từ nào.
 */
T.donKhoAnh = function (dv) {
    if (!dv || !dv.anhKho) return dv;
    var dung = {};
    (T.COLL_CT || []).forEach(function (c) {
        DB.all(c).forEach(function (r) {
            if (r.logoId && (r.donVi === dv.id || r.donViId === dv.id)) dung[r.logoId] = 1;
        });
    });
    Object.keys(dv.anhKho).forEach(function (k) { if (!dung[k]) delete dv.anhKho[k]; });
    return dv;
};

/**
 * CHUYỂN LOGO ĐỜI CŨ VÀO TVERP.
 * Bản cài đặt cũ lưu logo bằng ĐƯỜNG DẪN TỆP. Lần chạy đầu sau khi nâng cấp,
 * hệ thống đọc ảnh và ghi thẳng vào kho dữ liệu để từ nay ảnh nằm trong phần
 * mềm, không phụ thuộc tệp bên ngoài.
 */
T.chuyenLogoTep = function (xong) {
    var ds = DB.all('donVi').filter(function (d) { return d.logo && !T.laAnhTai(d.logo); });
    if (!ds.length || typeof fetch !== 'function') { if (xong) xong(0); return; }
    var con = ds.length, n = 0;
    ds.forEach(function (d) {
        function het() { if (!--con) { if (n) DB.save(); if (xong) xong(n); } }
        fetch(d.logo)
            .then(function (rp) { return rp.ok ? rp.blob() : null; })
            .then(function (bl) {
                if (!bl) return null;
                return new Promise(function (ok) {
                    var fr = new FileReader();
                    fr.onload = function (e) { ok(String(e.target.result)); };
                    fr.onerror = function () { ok(null); };
                    fr.readAsDataURL(bl);
                });
            })
            .then(function (u) {
                if (u) { d.logo = u; d.logoId = d.logoId || T.uid('LG'); d.anhKho = d.anhKho || {}; n++; }
                het();
            })
            .catch(het);
    });
};

/** Mã phiên bản logo hiện hành của một đơn vị — chứng từ chụp lại lúc phát hành. */
T.logoHienHanh = function (donViId) {
    var d = DB.get('donVi', donViId);
    return d ? (d.logoId || '') : '';
};

/**
 * ĐƠN VỊ PHÁT HÀNH ĐỂ IN MỘT CHỨNG TỪ.
 * Trả về bản sao có đúng logo của thời điểm phát hành chứng từ.
 */
T.ctyChungTu = function (r) {
    /* Không bao giờ trả rỗng: chưa khai đơn vị phát hành nào thì trả một bản ghi
       trống để bản in vẫn dựng được, không làm trắng màn hình. */
    var d = DB.get('donVi', r && (r.donVi || r.donViId)) || DB.cty() ||
            { id: '', ma: '', ten: '', tat: '', mst: '', diaChi: '', logo: '' };
    var lid = r && r.logoId;
    if (!lid || lid === d.logoId) return d;
    var cu = (d.anhKho || {})[lid];
    if (!cu) return d;
    var b = T.clone(d); b.logo = cu; b._logoCu = true;
    return b;
};

/* ------------------------------------------------ NGƯỜI DÙNG ĐANG ĐĂNG NHẬP */
DB._user = null;
DB.user = function () {
    if (DB._user) return DB._user;
    var u = DB.all('nguoiDung')[0];
    return u || { id: '', taiKhoan: 'admin', hoTen: 'Quản trị', vaiTro: '', vaiTroId: '', nhanVienId: '' };
};

/* ------------------------------------------------ ĐÁNH SỐ CHỨNG TỪ TỰ ĐỘNG */
var TIEN_TO = { BG: 'BG', DB: 'DB', HD: 'HĐ', PL: 'PLHĐ', PX: 'PXK', BB: 'BBGH',
                NT: 'BBNT', DN: 'DNTT', PT: 'PT', PC: 'PC', DM: 'DMH', NK: 'NK',
                KK: 'PKK', DC: 'PDC' };
DB.soMoi = function (loai) {
    var m = DB.data._meta;
    m.seq[loai] = (m.seq[loai] || 0) + 1;
    var n = ('00' + m.seq[loai]).slice(-3);
    var nam = new Date().getFullYear();
    var tt = DB.cty().tienTo || 'EMC';
    if (loai === 'HD') return m.seq[loai] + '/' + nam + '/HĐKT-' + tt;
    if (loai === 'PL') return m.seq[loai] + '/' + nam + '/PLHĐ-' + tt;
    if (loai === 'DM') return 'DMH-' + nam + n;
    if (loai === 'NK') return 'NK-' + nam + n;   // lô nhập khẩu dùng chung toàn nhóm, không gắn đơn vị
    // chứng từ kho dùng chung toàn nhóm — chỉ có 01 kho nên không gắn tiền tố đơn vị
    if (loai === 'KK') return 'PKK-' + nam + n;
    if (loai === 'DC') return 'PDC-' + nam + n;
    if (loai === 'PN') return 'PNK-' + nam + n;
    return TIEN_TO[loai] + tt + '-' + nam + n;
};
/**
 * Số hợp đồng lấy TIỀN TỐ theo đúng loại hợp đồng khai trong danh mục —
 * thêm loại mới trong danh mục là số hợp đồng tự chạy theo tiền tố của loại đó,
 * không phải sửa mã nguồn.
 */
DB.soHopDong = function (L) {
    var m = DB.data._meta;
    m.seq.HD = (m.seq.HD || 0) + 1;
    var tt = DB.cty().tienTo || 'EMC';
    var to = (L && L.tienTo) || 'HĐKT';
    return m.seq.HD + '/' + new Date().getFullYear() + '/' + to + '-' + tt;
};

/* ==========================================================================
   CUSTOMER MASTER DATA — DỮ LIỆU NỀN VỀ KHÁCH HÀNG
   --------------------------------------------------------------------------
   Danh mục Khách hàng là DỮ LIỆU GỐC của toàn hệ thống. Mọi phân hệ — báo
   giá, đơn bán hàng, hợp đồng, phụ lục, phiếu xuất kho, biên bản giao hàng,
   biên bản nghiệm thu, đề nghị thanh toán, phiếu thu, công nợ, báo cáo, trang
   chủ — CHỈ được liên kết bằng Customer ID nội bộ (trường khachHangId), tuyệt
   đối không phân hệ nào tự khai một bộ dữ liệu khách hàng riêng.

   Chứng từ vẫn giữ trường "khachHang" (tên) và "khSnap" (bản chụp pháp lý)
   nhưng đó là BẢN CHỤP TẠI THỜI ĐIỂM PHÁT HÀNH, không phải nguồn dữ liệu:
   sửa danh mục là mọi chứng từ MỚI đổi theo, chứng từ CŨ giữ nguyên.
   ========================================================================== */
T.LOAI_KH = ['Doanh nghiệp', 'Cá nhân'];
T.laDoanhNghiep = function (kh) { return (kh && kh.loai) !== 'Cá nhân'; };

/** Mã khách hàng do HỆ THỐNG tự sinh — người dùng không được nhập. */
DB.maKHMoi = function () {
    var n = 0;
    DB.all('khachHang').forEach(function (x) {
        var m = /^KH(\d+)$/.exec(String(x.ma || ''));
        if (m) n = Math.max(n, Number(m[1]));
    });
    return 'KH' + ('000000' + (n + 1)).slice(-6);
};

/* Các trường pháp lý được đóng băng vào chứng từ khi phát hành. */
T.TRUONG_SNAP = ['ma', 'loai', 'ten', 'mst', 'cccd', 'diaChi', 'daiDien',
                 'dienThoai', 'email', 'nguoiLienHe', 'chucVu',
                 'dtLienHe', 'emailLienHe'];
/**
 * SNAPSHOT PHÁP LÝ — bản chụp thông tin khách hàng tại thời điểm phát hành
 * chứng từ. Khách hàng đổi tên, đổi địa chỉ, đổi người đại diện về sau thì
 * chứng từ cũ vẫn in đúng thông tin lúc ký; chứng từ mới lấy thông tin mới.
 */
T.chupKH = function (kh) {
    if (!kh || !kh.id) return null;
    var o = { khachHangId: kh.id, luc: new Date().toISOString() };
    /* Chụp ĐỦ mọi trường, kể cả trường đang để trống: nếu bỏ trống không chụp
       thì về sau khách hàng khai thêm địa chỉ, người đại diện… chứng từ cũ sẽ
       hiện thông tin mới — đúng điều tuyệt đối không được xảy ra. */
    T.TRUONG_SNAP.forEach(function (k) { o[k] = kh[k] === undefined ? '' : kh[k]; });
    return o;
};
/**
 * Thông tin khách hàng dùng để IN một chứng từ.
 * Có bản chụp pháp lý thì in đúng bản chụp; chưa có (chứng từ nháp, dữ liệu
 * cũ) thì lấy từ Customer Master Data theo Customer ID.
 */
T.khChungTu = function (r) {
    if (!r) return {};
    var goc = DB.get('khachHang', r.khachHangId) || {};
    if (r.khSnap && r.khSnap.ten) {
        var o = T.clone(goc);
        /* Bản chụp đè lên TOÀN BỘ trường pháp lý, kể cả trường lúc ký để trống. */
        T.TRUONG_SNAP.forEach(function (k) {
            o[k] = r.khSnap[k] === undefined ? '' : r.khSnap[k];
        });
        o.id = r.khachHangId || goc.id || '';
        o._chup = true;
        return o;
    }
    if (!goc.id && r.khachHang) return { ten: r.khachHang, _mocoi: true };
    return goc;
};
/** Chứng từ đã phát hành có khác với dữ liệu khách hàng hiện nay không. */
T.snapLech = function (r) {
    if (!r || !r.khSnap) return [];
    var kh = DB.get('khachHang', r.khachHangId);
    if (!kh) return [];
    return T.TRUONG_SNAP.filter(function (k) {
        return r.khSnap[k] !== undefined && (r.khSnap[k] || '') !== (kh[k] || '');
    });
};

/** Chuẩn hóa mã số thuế: bỏ mọi ký tự không phải chữ số, giữ dạng 10 hoặc 13 số. */
T.chuanMST = function (v) {
    var s = String(v === undefined || v === null ? '' : v).replace(/[^0-9]/g, '');
    return s;
};
T.mstHopLe = function (v) {
    var s = T.chuanMST(v);
    return s.length === 10 || s.length === 13;
};
/** Mã số thuế in ra: 13 số hiển thị dạng 0123456789-001. */
T.mstHien = function (v) {
    var s = T.chuanMST(v);
    return s.length === 13 ? s.slice(0, 10) + '-' + s.slice(10) : s;
};

/**
 * KIỂM TRA TRÙNG KHÁCH HÀNG.
 *   Doanh nghiệp — theo MÃ SỐ THUẾ.
 *   Cá nhân      — theo CCCD, hoặc theo HỌ TÊN + ĐIỆN THOẠI.
 * Trả về bản ghi đã có (nếu trùng) hoặc null.
 */
T.trungKH = function (o, boId) {
    var ds = DB.all('khachHang').filter(function (x) { return x.id !== boId; });
    if (T.laDoanhNghiep(o)) {
        var mst = T.chuanMST(o.mst);
        if (!mst) return null;
        return ds.filter(function (x) { return T.chuanMST(x.mst) === mst; })[0] || null;
    }
    var cc = String(o.cccd || '').replace(/\s/g, '');
    if (cc) {
        var t1 = ds.filter(function (x) { return String(x.cccd || '').replace(/\s/g, '') === cc; })[0];
        if (t1) return t1;
    }
    var ten = T.kd(o.ten || ''), dt = String(o.dienThoai || '').replace(/[^0-9]/g, '');
    if (!ten || !dt) return null;
    return ds.filter(function (x) {
        return T.kd(x.ten || '') === ten &&
               String(x.dienThoai || '').replace(/[^0-9]/g, '') === dt;
    })[0] || null;
};

/** Các chứng từ đang trỏ tới một khách hàng — dùng khi xóa và khi rà toàn vẹn. */
T.COLL_KH = ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'bienBanGiao',
             'bienBanNghiemThu', 'deNghiTT', 'phieuThu', 'hoSo'];
/** Mọi chứng từ có biểu mẫu in mang logo đơn vị phát hành. */
T.COLL_CT = ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'bienBanGiao',
             'bienBanNghiemThu', 'deNghiTT', 'phieuThu', 'phieuChi', 'donMua',
             'loNhap', 'phieuNhap', 'kiemKe', 'dieuChinhKho'];
/** Chứng từ có khachHangId trỏ tới khách hàng KHÔNG còn tồn tại (dữ liệu mồ côi). */
T.chungTuMoCoi = function () {
    var co = {};
    DB.all('khachHang').forEach(function (k) { co[k.id] = 1; });
    var ra = [];
    T.COLL_KH.forEach(function (c) {
        DB.all(c).forEach(function (r) {
            if (r.khachHangId && !co[r.khachHangId])
                ra.push({ coll: c, id: r.id, so: r.so || '', khachHangId: r.khachHangId });
        });
    });
    return ra;
};

/* ------------------------------------------------ NGHIỆP VỤ DÙNG CHUNG */
/** Đơn giá theo mức giá của khách hàng (PP / ĐL / BL). */
/** Số mã hàng chưa có giá trên bất kỳ bảng giá nào đang áp dụng. */
W.soMaChuaCoGia = function () {
    var bgs = DB.all('bangGiaBan').filter(function (b) { return b.trangThai === 'Đang áp dụng'; });
    /* Tra theo ID NỘI BỘ — hai mặt hàng cùng Model vẫn giữ đúng giá riêng. */
    return DB.all('hangHoa').filter(function (x) {
        return !bgs.some(function (b) { return (T.traBang(b.gia, x) || 0) > 0; });
    }).length;
};
T.tenMuc = function (m) {
    for (var i = 0; i < T.BAC_GIA.length; i++) if (T.BAC_GIA[i].v === m) return T.BAC_GIA[i].t;
    return m === 'PP' ? 'Giá dự án' : m === 'DL' ? 'Giá đại lý' : 'Giá bán lẻ';   // dữ liệu cũ
};

/** Tính tổng chứng từ từ mảng dòng hàng. */
T.tinhTong = function (lines, vatPct) {
    var tt = 0;
    (lines || []).forEach(function (l) {
        tt += (Number(l.soLuong) || 0) * (Number(l.donGia) || 0) * (1 - (Number(l.ckPhanTram) || 0) / 100);
    });
    tt = Math.round(tt);
    var vat = Math.round(tt * (Number(vatPct === undefined ? 10 : vatPct)) / 100);
    return { thanhTien: tt, vat: vat, tongCong: tt + vat };
};

/** Công nợ của một khách hàng: phải thu = tổng đơn bán đã xác nhận - đã thu. */
/* T.congNoKH ĐƯỢC ĐỊNH NGHĨA MỘT LẦN DUY NHẤT ở khối "LỚP DÙNG CHUNG" cuối tệp —
   bản ở đó nhận thêm bộ lọc kỳ và tính cả phần quá hạn. Không định nghĩa lại ở
   đây để hệ thống không có hai cách tính công nợ. */

/**
 * Một phiếu nhập hàng CÓ LÀM PHÁT SINH CÔNG NỢ PHẢI TRẢ hay chưa.
 * Công nợ chỉ phát sinh khi HÀNG ĐÃ THẬT SỰ VÀO KHO. Đơn mới đặt, hàng chưa
 * nhận thì chưa nợ nhà cung cấp đồng nào — cộng vào công nợ ngay lúc bấm Lưu
 * là BƯỚC MỘT đã làm đổi số liệu, trái với luồng nhập kho hai bước.
 */
T.donMuaPhatSinhCongNo = function (dm) {
    if (!dm || dm.trangThai === 'Nháp' || dm.trangThai === 'Đã hủy') return false;
    var lo = dm.loNhapId ? DB.get('loNhap', dm.loNhapId) : null;
    /* Có lô nhập thì căn cứ DUY NHẤT là phiếu nhập kho còn hiệu lực của lô đó —
       một nguồn sự thật, không đọc trạng thái ghi tay ở nơi khác. */
    if (lo) return !!T.phieuNhapCuaLo(lo);
    /* Chứng từ cũ không có lô nhập thì giữ nguyên căn cứ trạng thái. */
    return dm.trangThai === 'Đã nhận hàng';
};

/* T.congNoNCC cũng chỉ có MỘT bản, ở khối "LỚP DÙNG CHUNG" cuối tệp. Nguyên tắc
   giữ nguyên: chỉ phiếu chi TRẢ TIỀN HÀNG mới làm giảm công nợ phải trả — phiếu
   chi lương, thuê văn phòng, công tác phí không phải thanh toán cho đơn mua. */

/** Lọc chứng từ theo đơn vị đang làm việc (nếu bật). */
T.theoCty = function (arr) {
    if (!DB.data._meta.locTheoCty) return arr;
    var id = DB.data._meta.ctyId;
    return arr.filter(function (x) { return !x.donVi || x.donVi === id; });
};

/** Hồ sơ liên quan của một chuỗi chứng từ (xuyên suốt quy trình). */
T.hoSo = function (loai, id) {
    var out = { baoGia: null, donBan: null, hopDong: null, phuLuc: [], phieuXuat: [],
                bienBanGiao: [], bienBanNghiemThu: [], deNghiTT: [], phieuThu: [] };
    var db = null;
    function theoDonBan(c, dbId) {
        return DB.all(c).filter(function (x) { return x.donBanId === dbId; });
    }
    if (loai === 'donBan') db = DB.get('donBan', id);
    else if (loai === 'baoGia') {
        out.baoGia = DB.get('baoGia', id);
        db = DB.all('donBan').filter(function (d) { return d.baoGiaId === id; })[0] || null;
    } else if (loai === 'hopDong') {
        var hd = DB.get('hopDong', id); out.hopDong = hd;
        db = hd ? DB.get('donBan', hd.donBanId) : null;
    } else {
        var x = DB.get(loai, id);
        db = x ? DB.get('donBan', x.donBanId) : null;
    }
    if (db) {
        out.donBan = db;
        if (!out.baoGia && db.baoGiaId) out.baoGia = DB.get('baoGia', db.baoGiaId);
        if (!out.hopDong) out.hopDong = DB.all('hopDong').filter(function (h) { return h.donBanId === db.id; })[0] || null;
        out.phuLuc = out.hopDong ? DB.all('phuLuc').filter(function (p) { return p.hopDongId === out.hopDong.id; }) : [];
        out.phieuXuat = theoDonBan('phieuXuat', db.id);
        out.bienBanGiao = theoDonBan('bienBanGiao', db.id);
        out.bienBanNghiemThu = theoDonBan('bienBanNghiemThu', db.id);
        out.deNghiTT = theoDonBan('deNghiTT', db.id);
        out.phieuThu = theoDonBan('phieuThu', db.id);
    }
    return out;
};


/* ==========================================================================
   MÃ GIAO DỊCH — sợi chỉ xuyên suốt nối toàn bộ chứng từ của một thương vụ
   ========================================================================== */
/** Thứ tự các bước trong quy trình bán hàng (bước tùy chọn vẫn nằm đúng vị trí). */
T.CHUOI = [
    { k: 'baoGia',           t: 'Báo giá',              i: 'bi-file-earmark-text',   bat: true },
    { k: 'donBan',           t: 'Đơn bán hàng',         i: 'bi-cart-check',          bat: true },
    { k: 'hopDong',          t: 'Hợp đồng',             i: 'bi-file-earmark-ruled',  bat: false },
    { k: 'phuLuc',           t: 'Phụ lục hợp đồng',     i: 'bi-file-earmark-plus',   bat: false },
    { k: 'phieuXuat',        t: 'Phiếu xuất kho',       i: 'bi-box-arrow-right',     bat: false },
    { k: 'bienBanGiao',      t: 'Biên bản giao hàng',   i: 'bi-clipboard-check',     bat: false },
    { k: 'bienBanNghiemThu', t: 'Biên bản nghiệm thu',  i: 'bi-patch-check',         bat: false },
    { k: 'deNghiTT',         t: 'Đề nghị thanh toán',   i: 'bi-receipt',             bat: false },
    { k: 'phieuThu',         t: 'Phiếu thu',            i: 'bi-cash-coin',           bat: false }
];
T.LOAI_CT = T.CHUOI.map(function (x) { return x.k; });

/** Sinh mã giao dịch mới: GD-2026-0001 */
DB.maGDMoi = function () {
    var m = DB.data._meta;
    m.seqGD = (m.seqGD || 0) + 1;
    return 'GD-' + new Date().getFullYear() + '-' + ('000' + m.seqGD).slice(-4);
};

/** Toàn bộ chứng từ thuộc một mã giao dịch, sắp theo đúng thứ tự quy trình. */
T.chuoiGD = function (maGD) {
    var out = [];
    if (!maGD) return out;
    T.CHUOI.forEach(function (b) {
        DB.all(b.k).forEach(function (x) {
            if (x.maGD === maGD) out.push({ buoc: b, ct: x });
        });
    });
    return out;
};

/** Mã giao dịch của một chứng từ; nếu chưa có thì suy ra từ chứng từ gốc. */
T.layMaGD = function (loai, r) {
    /* MÃ CỦA CHỨNG TỪ CHA THẮNG. Chứng từ con lập rời rồi mới gắn vào đơn bán
       thì đã mang sẵn một mã giao dịch riêng — giữ nguyên mã cũ là để hai chứng
       từ của CÙNG một thương vụ mang hai mã khác nhau, và Business Engine sẽ
       ghi nhận doanh thu hai lần cho một khoản tiền. */
    var nguon = ['donBanId', 'hopDongId', 'baoGiaId', 'phieuXuatId', 'bienBanGiaoId'];
    for (var i = 0; i < nguon.length; i++) {
        var k = nguon[i], c = k.replace('Id', '');
        if (r && r[k]) {
            var g = DB.get(c, r[k]);
            if (g && g.maGD) return g.maGD;
        }
    }
    return (r && r.maGD) || '';
};


/* ==========================================================================
   MÔ HÌNH GIÁ VỐN — GIÁ NỘI BỘ — GIÁ BÁN
   --------------------------------------------------------------------------
   Nguyên tắc: MỘT kho duy nhất của Tản Viên · MỘT tồn kho · MỘT giá vốn bình
   quân gia quyền di động. EMC / AA / Thái Phong mua nội bộ từ Tản Viên theo
   công thức cấu hình, nên giá vốn của mỗi pháp nhân khác nhau.
   ========================================================================== */

/**
 * ĐƠN VỊ SỞ HỮU KHO — CÔNG TY NGUỒN (Tản Viên).
 * Chỉ còn MỘT cách xác định trong toàn hệ thống: cấu hình kiến trúc đa công ty
 * (T.cauHinhDaCongTy().ctyNguonId), tự suy ra từ cờ laDonViKho của đơn vị.
 * Hằng số dưới đây chỉ là giá trị dự phòng khi chưa có dữ liệu đơn vị nào.
 */
T.DON_VI_KHO_MAC_DINH = 'TANVIEN';
Object.defineProperty(T, 'DON_VI_KHO', {
    get: function () {
        var id = '';
        try { id = T.cauHinhDaCongTy().ctyNguonId; } catch (e) { id = ''; }
        return id || T.DON_VI_KHO_MAC_DINH;
    }
});

/** Kho vật lý duy nhất của cả nhóm. */
T.khoChinh = function () {
    return DB.all('kho').filter(function (k) { return k.laKhoChinh; })[0] || DB.all('kho')[0] || null;
};

/* ---------------------------------------------- CÁC KHOẢN CHI PHÍ NHẬP KHẨU */
T.LOAI_CHI_PHI = [
    { k: 'muaHang',    t: 'Giá mua hàng (tiền hàng)',   tuTinh: true },
    { k: 'thueNK',     t: 'Thuế nhập khẩu' },
    { k: 'thueKhac',   t: 'Thuế khác' },
    { k: 'vatNK',      t: 'VAT hàng nhập khẩu', khongVaoGiaVon: true },
    { k: 'logistics',  t: 'Chi phí logistics' },
    { k: 'vanTaiQT',   t: 'Cước vận chuyển quốc tế' },
    { k: 'vanTaiND',   t: 'Vận chuyển nội địa về kho' },
    { k: 'thongQuan',  t: 'Phí thông quan — hải quan' },
    { k: 'baoHiem',    t: 'Bảo hiểm hàng hóa' },
    { k: 'kiemDinh',   t: 'Phí kiểm định — kiểm tra chất lượng' },
    { k: 'nangHa',     t: 'Nâng hạ container — lưu kho bãi' },
    { k: 'khac',       t: 'Chi phí khác' }
];
/** VAT nhập khẩu được khấu trừ nên KHÔNG cộng vào giá vốn. */
T.chiPhiVaoGiaVon = function (k) {
    var c = T.LOAI_CHI_PHI.filter(function (x) { return x.k === k; })[0];
    return !!c && !c.khongVaoGiaVon && !c.tuTinh;
};

T.CACH_PHAN_BO = [
    { k: 'giaTri',  t: 'Theo giá trị tiền hàng của từng dòng' },
    { k: 'soLuong', t: 'Theo số lượng của từng dòng' }
];

/**
 * Phân bổ toàn bộ chi phí của một lô nhập vào từng dòng hàng.
 * Trả về chính lô đó với các dòng đã có: tienHang, chiPhiPhanBo, giaVonLo.
 */
T.phanBoChiPhi = function (lo) {
    var lines = lo.lines || [], cp = lo.chiPhi || [];
    var tongTienHang = 0, tongSL = 0;
    lines.forEach(function (l) {
        l.tienHang = Math.round((Number(l.soLuong) || 0) * (Number(l.donGia) || 0));
        tongTienHang += l.tienHang;
        tongSL += Number(l.soLuong) || 0;
    });
    var tongCP = 0;
    cp.forEach(function (c) {
        if (T.chiPhiVaoGiaVon(c.loai)) tongCP += Number(c.soTien) || 0;
    });
    var cachPB = lo.cachPhanBo || 'giaTri';
    var conLai = tongCP;
    lines.forEach(function (l, i) {
        var ty;
        if (cachPB === 'soLuong') ty = tongSL ? (Number(l.soLuong) || 0) / tongSL : 0;
        else ty = tongTienHang ? l.tienHang / tongTienHang : 0;
        var pb = (i === lines.length - 1) ? conLai : Math.round(tongCP * ty);
        conLai -= pb;
        l.chiPhiPhanBo = pb;
        var sl = Number(l.soLuong) || 0;
        l.giaVonLo = sl ? Math.round((l.tienHang + pb) / sl) : 0;
    });
    lo.tongTienHang = tongTienHang;
    lo.tongChiPhi = tongCP;
    lo.tongVatNK = T.sum(cp.filter(function (c) { return c.loai === 'vatNK'; }), function (c) { return c.soTien; });
    lo.tongGiaVon = tongTienHang + tongCP;
    lo.daPhanBo = true;
    return lo;
};

/* ------------------------------------------------------ PHIẾU NHẬP KHO
   Kho chỉ phản ánh dữ liệu từ chứng từ: tồn kho CHỈ thay đổi khi ghi sổ một
   Phiếu nhập kho. Phiếu nhập kho không lập tay, luôn sinh từ chứng từ nguồn:
   Lô nhập · Trả hàng · Điều chỉnh · Tồn đầu kỳ.                                */
T.NGUON_NHAP = ['Lô nhập', 'Trả hàng', 'Điều chỉnh', 'Tồn đầu kỳ'];

/* ==========================================================================
   VÒNG ĐỜI CỦA MỘT LÔ NHẬP — HAI BƯỚC, KHÔNG TẮT
   --------------------------------------------------------------------------
   BƯỚC 1 — LẬP LÔ. Nhập tay hoặc nhập từ Excel chỉ tạo ra một LÔ NHẬP nháp.
       Trong hai trạng thái "Chờ kiểm tra" và "Chờ nhập kho", lô nhập KHÔNG
       chạm vào bất kỳ số liệu nào của doanh nghiệp:
         · không sinh phiếu nhập kho     · không tăng tồn kho
         · không tính giá vốn            · không ghi lịch sử giá vốn
         · không vào Dashboard           · không vào báo cáo
       Người dùng được kiểm tra, sửa, xóa, nhập lại bao nhiêu lần cũng được.

   BƯỚC 2 — NHẬP KHO. Chỉ khi người dùng bấm NHẬP KHO, Business Engine mới
       sinh đúng MỘT phiếu nhập kho, cộng tồn đúng MỘT lần, tính giá vốn đúng
       MỘT lần, ghi lịch sử, rồi KHÓA lô lại.

   Danh sách này là nguồn duy nhất; màn hình chỉ đọc lại, không tự khai.
   ========================================================================== */
T.TT_LO = ['Chờ kiểm tra', 'Chờ nhập kho', 'Đã nhập kho', 'Tồn đầu kỳ', 'Đã hủy'];
/* Hai trạng thái NHÁP — lô chưa được phép chạm vào số liệu nào. */
T.TT_LO_NHAP_NHAP = ['Chờ kiểm tra', 'Chờ nhập kho'];
/* Hai trạng thái ĐÃ VÀO SỔ — lô đã sinh phiếu nhập, đã cộng tồn, đã khóa. */
T.TT_LO_DA_VAO_SO = ['Đã nhập kho', 'Tồn đầu kỳ'];
/* Tên cũ của hai trạng thái nháp, giữ để đọc được dữ liệu đời trước. */
T.TT_LO_CU = { 'Chờ phân bổ': 'Chờ kiểm tra', 'Đã phân bổ chi phí': 'Chờ nhập kho' };

/** Lô nhập này đã vào sổ kho hay chưa. */
T.loDaVaoSo = function (lo) {
    return !!lo && T.TT_LO_DA_VAO_SO.indexOf(lo.trangThai) >= 0;
};
/** Lô nhập này còn là bản nháp — được sửa, xóa, nhập lại thoải mái. */
T.loConNhap = function (lo) {
    return !!lo && !T.loDaVaoSo(lo) && lo.trangThai !== 'Đã hủy';
};
/** Phiếu nhập kho đang có hiệu lực của một lô (bỏ qua phiếu đã hủy). */
T.phieuNhapCuaLo = function (lo) {
    if (!lo) return null;
    var pn = lo.phieuNhapId ? DB.get('phieuNhap', lo.phieuNhapId) : null;
    if (pn && pn.trangThai !== 'Đã hủy') return pn;
    return DB.all('phieuNhap').filter(function (x) {
        return x.loNhapId === lo.id && x.trangThai !== 'Đã hủy';
    })[0] || null;
};
T.NGUON_XUAT = ['Đơn bán', 'Xuất nội bộ', 'Trả nhà cung cấp', 'Điều chỉnh'];

/* ==========================================================================
   NHẬP KHO = ĐÃ THANH TOÁN NHÀ CUNG CẤP            (v18.6.0 — Logic 1)
   --------------------------------------------------------------------------
   QUY ƯỚC NGHIỆP VỤ CỦA TVERP: hàng đã nhập kho nghĩa là đã trả đủ 100% cho
   nhà cung cấp. Vì vậy khi phiếu nhập kho được ghi sổ:
       tồn kho ↑ · giá trị hàng tồn ↑ · tiền thực tế ↓ · công nợ NCC = 0
   Người dùng KHÔNG phải lập thêm phiếu chi cho khoản đó.

   KHÔNG HỒI TỐ. Dấu thanh toán chỉ được đóng lên các phiếu nhập ghi sổ TỪ
   THỜI ĐIỂM CẬP NHẬT trở đi. Phiếu nhập cũ không có dấu này nên mọi con số
   lịch sử — tiền, công nợ, phiếu chi cũ — giữ nguyên tuyệt đối. Nếu không
   làm vậy, một khoản đã có phiếu chi trước đây sẽ bị trừ tiền lần thứ hai.

   CHỐNG TRỪ TIỀN HAI LẦN: một khoản mua chỉ được ảnh hưởng tới tiền MỘT LẦN.
   Phiếu nhập đã mang dấu thanh toán thì mọi phiếu chi lập cho chính đơn mua
   đó đều bị chặn ngay tại Engine (T.chiTrungNhapKho).
   ========================================================================== */

/** Giá trị một phiếu nhập kho — dùng đúng giá vốn đã phân bổ của từng dòng. */
T.giaTriPhieuNhap = function (pn) {
    return T.sum((pn && pn.lines) || [], function (l) {
        return (Number(l.soLuong) || 0) * (Number(l.giaVon) || 0);
    });
};

/**
 * SỐ TIỀN THỰC SỰ PHẢI TRẢ NHÀ CUNG CẤP cho một phiếu nhập kho.
 * Giá vốn của phiếu KHÔNG dùng được làm số tiền trả: nó đã loại thuế GTGT và
 * đã cộng thêm chi phí nhập (vận chuyển, bốc xếp) trả cho bên thứ ba. Số nợ
 * nhà cung cấp nằm ở TỔNG CỘNG CỦA ĐƠN MUA. Chỉ dùng con số đó khi đơn mua
 * sinh đúng MỘT phiếu nhập — nhiều phiếu thì không tự chia, quay về giá trị
 * của chính phiếu để không bao giờ trả vượt.
 */
T.soTienTraNCC = function (pn, dm) {
    if (!pn) return 0;
    dm = dm || T.donMuaCuaPhieuNhap(pn);
    if (!dm) return T.giaTriPhieuNhap(pn);
    var ids = {}; T.loCuaDonMua(dm).forEach(function (l) { ids[l.id] = 1; });
    var ds = DB.all('phieuNhap').filter(function (x) {
        return ids[x.loNhapId] && x.trangThai === 'Đã ghi sổ'; });
    if (ds.length > 1) return T.giaTriPhieuNhap(pn);
    return Number(dm.tongCong) || T.giaTriPhieuNhap(pn);
};

/** Phiếu nhập đã mang dấu "nhập kho là đã trả tiền" hay chưa. */
T.nhapDaTra = function (pn) {
    return !!(pn && pn.daThanhToan === true && pn.trangThai === 'Đã ghi sổ');
};

/**
 * Tổng tiền đã trả nhà cung cấp THÔNG QUA NGHIỆP VỤ NHẬP KHO.
 * Chỉ tính các phiếu nhập mang dấu thanh toán — tức là phiếu ghi sổ từ khi
 * quy ước này có hiệu lực. Phiếu cũ không có dấu nên không bị tính lại.
 */
T.tienTraNhapKho = function (den, loc) {
    loc = loc || {};
    return T.sum(DB.all('phieuNhap').filter(function (p) {
        if (!T.nhapDaTra(p)) return false;
        if (den && String(p.ngay || '') > den) return false;
        if (loc.tuNgay && String(p.ngay || '') < loc.tuNgay) return false;
        if (loc.donViId && p.donVi && p.donVi !== loc.donViId) return false;
        if (loc.nhaCungCapId && p.nhaCungCapId !== loc.nhaCungCapId) return false;
        return true;
    }), function (p) { return Number(p.soTienThanhToan) || T.giaTriPhieuNhap(p); });
};

/** Các lô nhập gắn với một đơn mua — đọc cả hai chiều liên kết. */
T.loCuaDonMua = function (dm) {
    if (!dm) return [];
    return DB.all('loNhap').filter(function (l) {
        return l.donMuaId === dm.id || dm.loNhapId === l.id;
    });
};

/** Phiếu chi ĐÃ GHI SỔ đang trả tiền cho chính đơn mua này. */
T.chiCuaDonMua = function (dm, boQuaId) {
    if (!dm) return [];
    return DB.all('phieuChi').filter(function (p) {
        return p.donMuaId === dm.id && p.trangThai === 'Đã ghi sổ' && p.id !== boQuaId;
    });
};

/** Đơn mua gốc của một phiếu nhập kho (qua lô nhập). */
T.donMuaCuaPhieuNhap = function (pn) {
    if (!pn) return null;
    var lo = pn.loNhapId ? DB.get('loNhap', pn.loNhapId) : null;
    return lo && lo.donMuaId ? DB.get('donMua', lo.donMuaId) : null;
};

/** Câu thông báo DUY NHẤT khi phát hiện chi lần thứ hai — không viết lại ở nơi khác. */
T.TB_CHI_TRUNG = 'Khoản mua hàng này đã được ghi nhận thanh toán từ phiếu nhập kho. ' +
                 'Không thể ghi nhận chi lần thứ hai.';

/**
 * PHÁT HIỆN TRẢ TIỀN HAI LẦN.
 * Trả về phiếu nhập đã thanh toán cho chính đơn mua mà phiếu chi này đang trỏ
 * tới; null nghĩa là không trùng.
 */
T.chiTrungNhapKho = function (p) {
    if (!p || !p.donMuaId) return null;
    var dm = DB.get('donMua', p.donMuaId);
    if (!dm) return null;
    var ids = {}; T.loCuaDonMua(dm).forEach(function (l) { ids[l.id] = 1; });
    var pn = DB.all('phieuNhap').filter(function (x) {
        return ids[x.loNhapId] && T.nhapDaTra(x) && x.id !== p._boQuaPN;
    })[0];
    return pn || null;
};

/**
 * CỔNG CHẶN CHI HAI LẦN — đặt ngay tại Engine (DB.insert / DB.update), không
 * đặt ở màn hình. Màn hình nào cũng có thể quên gọi; Engine thì không đường
 * nào lọt. Trả về phiếu nhập trùng nếu phải chặn, null nếu cho ghi.
 */
T.chanChiTrung = function (p, cu) {
    if (!p || !p.donMuaId) return null;
    /* Sửa một phiếu chi CŨ vẫn trỏ đúng đơn mua cũ thì không chặn — chứng từ
       lịch sử phải sửa được. Chỉ chặn khi phiếu chi MỚI trỏ vào một khoản mua
       đã trả tiền qua nhập kho. */
    if (cu && String(cu.donMuaId || '') === String(p.donMuaId || '')) return null;
    var pn = T.chiTrungNhapKho(p);
    if (!pn) return null;
    if (W.UI) UI.khongThe('Lập phiếu chi', T.TB_CHI_TRUNG,
        'Phiếu nhập kho ' + (pn.so || '') + ' ngày ' + T.date(pn.ngay) + ' đã trừ ' +
        T.money(Number(pn.soTienThanhToan) || T.giaTriPhieuNhap(pn)) + ' đ cho khoản mua này. ' +
        'Muốn ghi chi bằng phiếu chi thì phải thu hồi phiếu nhập kho đó trước.');
    return pn;
};

/**
 * Ghi sổ một phiếu nhập kho: cộng tồn và tính lại GIÁ VỐN BÌNH QUÂN GIA QUYỀN DI ĐỘNG.
 *   BQ mới = (tồn cũ × BQ cũ + SL nhập × giá vốn nhập) / (tồn cũ + SL nhập)
 * Lịch sử giá vốn được ghi thêm, KHÔNG ghi đè.
 */
T.ghiSoPhieuNhap = function (pn) {
    /* CHẶN GHI SỔ HAI LẦN NGAY TẠI ENGINE.
       Trước đây mọi lớp bảo vệ đều nằm ở màn hình: gọi lại hàm này trên một
       phiếu đã ghi sổ là cộng tồn thêm một lần nữa và đẻ thêm một dòng lịch sử
       giá vốn. Bảo vệ ở màn hình thì mọi đường gọi mới đều phải nhớ tự bảo vệ —
       bảo vệ ở đây thì không đường nào lọt. */
    if (!pn) return null;
    if (pn.trangThai === 'Đã ghi sổ') {
        if (W.UI) UI.toast('warn', 'Phiếu nhập đã ghi sổ rồi',
            'Phiếu ' + (pn.so || '') + ' đã cộng tồn kho và tính giá vốn. ' +
            'Hệ thống dừng lại để không ghi hai lần.', 8000);
        return pn;
    }
    (pn.lines || []).forEach(function (l) {
        var hh = T.hh(l);                       // theo ID nội bộ, không theo Model
        if (!hh) return;
        var tonCu = Number(hh.ton) || 0;
        var bqCu = Number(hh.giaVonBQ === undefined ? hh.giaVon : hh.giaVonBQ) || 0;
        var slNhap = Number(l.soLuong) || 0;
        var giaLo = Number(l.giaVon) || 0;
        var tonMoi = tonCu + slNhap;
        var bqMoi = tonMoi > 0 ? Math.round((Math.max(0, tonCu) * bqCu + slNhap * giaLo) / (Math.max(0, tonCu) + slNhap)) : giaLo;
        hh.ton = tonMoi;
        hh.giaVonBQ = bqMoi;
        hh.giaVon = bqMoi;                    // giữ tương thích với màn hình cũ
        DB.data.lichSuGiaVon.unshift({
            id: T.uid('GV'), luc: T.now(), ngay: pn.ngay, loId: pn.loNhapId || '', loSo: pn.loNhapSo || pn.so,
            phieuNhapId: pn.id, phieuNhapSo: pn.so,
            hangHoaId: hh.id, maHang: hh.ma, tenHang: hh.ten,
            tonCu: tonCu, bqCu: bqCu, slNhap: slNhap, giaVonLo: giaLo,
            tonMoi: tonMoi, bqMoi: bqMoi, ai: DB.user().taiKhoan
        });
    });
    pn.trangThai = 'Đã ghi sổ';
    /* NHẬP KHO LÀ ĐÃ TRẢ TIỀN (v18.6.0). Đóng dấu ngay lúc ghi sổ, kèm số tiền
       và ngày, để tiền thực tế và công nợ nhà cung cấp cùng đọc một nguồn.
       Chỉ đóng dấu cho phiếu ghi sổ từ bây giờ — phiếu cũ giữ nguyên. */
    if (pn.daThanhToan === undefined) {
        /* CHIỀU NGƯỢC LẠI CỦA CHỐNG TRỪ HAI LẦN: khoản mua này đã có phiếu chi
           ghi sổ thì tiền đã ra một lần rồi — KHÔNG đóng dấu nữa. Không sửa,
           không xóa phiếu chi đó; chỉ ghi rõ lý do để người dùng đối chiếu. */
        var dmPN = T.donMuaCuaPhieuNhap(pn);
        var pcCu = dmPN ? T.chiCuaDonMua(dmPN) : [];
        if (pcCu.length) {
            pn.daThanhToan = false;
            pn.nguonThanhToan = 'Đã thanh toán bằng phiếu chi ' +
                pcCu.map(function (x) { return x.so; }).join(', ') +
                ' — không ghi nhận thanh toán lần thứ hai từ phiếu nhập kho';
        } else {
            pn.daThanhToan = true;
            pn.ngayThanhToan = pn.ngay;
            pn.soTienThanhToan = T.soTienTraNCC(pn, dmPN);
            pn.nguonThanhToan = 'Nhập kho — quy ước đã trả đủ cho nhà cung cấp';
        }
    }
    DB.log('Ghi sổ phiếu nhập kho', 'phieuNhap', pn);
    T.dungTheKho();                       // ghi ngay vào thẻ kho — cập nhật tức thời
    DB.save();
    return pn;
};

/**
 * Sinh Phiếu nhập kho từ một lô nhập đã phân bổ chi phí, rồi ghi sổ ngay.
 * Trạng thái lô do hệ thống tự chuyển, người dùng không sửa tay được.
 */
T.nhapKho = function (lo) {
    if (!lo) return null;
    /* MỘT LÔ NHẬP CHỈ ĐƯỢC SINH ĐÚNG MỘT PHIẾU NHẬP KHO.
       Engine tự kiểm, không trông vào màn hình: bấm hai lần, hai thẻ trình
       duyệt cùng mở, hay một đường gọi mới quên kiểm tra — đều bị chặn ở đây. */
    var pnCu = T.phieuNhapCuaLo(lo);
    if (pnCu) {
        if (W.UI) UI.toast('warn', 'Lô nhập đã vào sổ kho rồi',
            'Lô ' + (lo.so || '') + ' đã sinh phiếu nhập ' + (pnCu.so || '') +
            '. Hệ thống dừng lại để không ghi tồn kho và giá vốn hai lần.', 9000);
        return pnCu;
    }
    if (!(lo.lines || []).length) {
        if (W.UI) UI.khongThe('Nhập kho', 'Lô nhập ' + (lo.so || '') + ' không có dòng hàng nào.',
            'Thêm dòng hàng vào lô rồi mới nhập kho được.');
        return null;
    }
    if (!lo.daPhanBo) T.phanBoChiPhi(lo);
    var tonDau = lo.loai === 'Tồn đầu kỳ' || lo.trangThai === 'Tồn đầu kỳ';
    var pn = {
        /* Ngày ghi sổ là NGÀY CỦA LÔ NHẬP, không phải ngày bấm nút. Lấy ngày hôm
           nay sẽ làm giá vốn lịch sử của những chứng từ trước đó đọc sai. */
        so: DB.soMoi('PN'), ngay: lo.ngay || T.today(),
        nguon: tonDau ? 'Tồn đầu kỳ' : 'Lô nhập',
        loNhapId: lo.id, loNhapSo: lo.so,
        nhaCungCapId: lo.nhaCungCapId || '', nhaCungCap: lo.nhaCungCap || '',
        khoId: (T.khoChinh() || {}).id || '',
        nguoiLapId: lo.nguoiLapId || '', nguoiLap: lo.nguoiLap || '',
        ghiChu: 'Nhập kho theo lô ' + lo.so + (lo.soHoaDon ? ' — hóa đơn ' + lo.soHoaDon : ''),
        lines: (lo.lines || []).map(function (l) {
            return { hangHoaId: T.idDong(l), maHang: l.maHang, tenHang: l.tenHang, dvt: l.dvt,
                     soLuong: Number(l.soLuong) || 0, giaVon: Number(l.giaVonLo) || 0,
                     thanhTien: Math.round((Number(l.soLuong) || 0) * (Number(l.giaVonLo) || 0)) };
        }),
        trangThai: 'Nháp'
    };
    pn.tongTien = T.sum(pn.lines, function (l) { return l.thanhTien; });
    var rec = DB.insert('phieuNhap', pn);
    T.ghiSoPhieuNhap(rec);
    lo.trangThai = tonDau ? 'Tồn đầu kỳ' : 'Đã nhập kho';
    lo.ngayNhapKho = rec.ngay;
    lo.phieuNhapId = rec.id; lo.phieuNhapSo = rec.so;
    /* KHÓA LÔ. Số liệu đã vào sổ kho, vào giá vốn, vào Dashboard và báo cáo —
       sửa lô lúc này là sửa một chứng từ đã phát hành. Muốn sửa thì phải thu
       hồi phiếu nhập trước, Engine sẽ trả tồn và giá vốn về nguyên trạng. */
    lo.khoa = true;
    // hệ thống tự chuyển trạng thái đơn mua gốc — người dùng không sửa tay
    var dm = lo.donMuaId ? DB.get('donMua', lo.donMuaId) : null;
    if (dm && dm.trangThai !== 'Đã nhận hàng') {
        dm.trangThai = 'Đã nhận hàng';
        DB.log('Nhận hàng', 'donMua', dm);
    }
    DB.log('Nhập kho', 'loNhap', lo);
    DB.save();
    return rec;
};

/* --------------------------------------------------------------------------
   THU HỒI MỘT PHIẾU NHẬP KHO ĐÃ GHI SỔ
   Trả tồn kho VÀ giá vốn bình quân về đúng trạng thái trước khi ghi phiếu.
   Nguyên tắc: phiếu nhập sau phải thu hồi trước (nhập sau — thu hồi trước).
   Hệ thống KHÔNG suy đoán số liệu: giá vốn bình quân được đặt lại đúng bằng
   giá trị đã ghi trong lịch sử giá vốn của chính phiếu đó.
   -------------------------------------------------------------------------- */

/** Dòng lịch sử giá vốn của một mặt hàng, mới nhất đứng trước. */
function lsGiaVonCua(hangHoaId) {
    return DB.all('lichSuGiaVon').filter(function (x) {
        return String(x.hangHoaId || '') === String(hangHoaId || '');
    });
}

/**
 * Kiểm tra một phiếu nhập kho có thu hồi được không.
 * Trả về { duoc, loi[] } — loi là danh sách lý do đọc được cho người dùng.
 */
/**
 * GỘP CÁC DÒNG CỦA MỘT PHIẾU THEO MẶT HÀNG.
 * Một mặt hàng có thể nằm trên NHIỀU dòng của cùng một phiếu; mọi phép kiểm tra
 * và hoàn tác đều phải làm trên TỔNG số lượng của mặt hàng đó, không làm từng
 * dòng — nếu không, kiểm tra tồn kho sẽ lọt và tồn có thể bị âm.
 */
function gomDongPhieu(pn) {
    var m = {}, ds = [];
    (pn.lines || []).forEach(function (l) {
        var id = T.idDong(l);
        if (!m[id]) { m[id] = { id: id, dong: l, soLuong: 0 }; ds.push(m[id]); }
        m[id].soLuong += Number(l.soLuong) || 0;
    });
    return ds;
}
/**
 * Dòng lịch sử giá vốn CỦA CHÍNH PHIẾU NÀY cho một mặt hàng, cũ nhất đứng cuối.
 * T.ghiSoPhieuNhap ghi mỗi dòng bằng unshift nên phần tử CUỐI mới là lần ghi
 * đầu tiên — chỉ số bqCu của lần ghi đầu tiên mới là giá vốn trước khi nhập.
 */
function dongGocCua(id, pnId) {
    var ls = lsGiaVonCua(id).filter(function (x) { return x.phieuNhapId === pnId; });
    return ls.length ? ls[ls.length - 1] : null;
}

T.kiemTraThuHoiNhap = function (pn) {
    var loi = [];
    if (!pn) return { duoc: false, loi: ['Không tìm thấy phiếu nhập kho.'] };
    if (pn.trangThai !== 'Đã ghi sổ')
        return { duoc: false, loi: ['Phiếu đang ở trạng thái “' + (pn.trangThai || '') + '” — chỉ thu hồi được phiếu đã ghi sổ.'] };
    gomDongPhieu(pn).forEach(function (g) {
        var l = g.dong, hh = T.hh(l);
        var ten = (l.maHang || '') + ' — ' + (l.tenHang || '');
        if (!hh) { loi.push(ten + ': mặt hàng không còn trong danh mục.'); return; }
        if ((Number(hh.ton) || 0) < g.soLuong)
            loi.push(ten + ': tồn kho hiện còn ' + T.num(hh.ton || 0) + ' — ít hơn số lượng đã nhập ' +
                     T.num(g.soLuong) + ', hàng đã xuất bán nên không thu hồi được.');
        var ls = lsGiaVonCua(g.id);
        if (ls.length && ls[0].phieuNhapId && ls[0].phieuNhapId !== pn.id)
            loi.push(ten + ': đã có lần nhập kho sau phiếu này (' + (ls[0].phieuNhapSo || '') +
                     ') — hãy thu hồi phiếu nhập sau trước.');
        /* Không còn dòng lịch sử của chính phiếu này (lịch sử giá vốn đã được
           dựng lại) thì KHÔNG xác định được giá vốn trước khi nhập. Từ chối thu
           hồi còn hơn hoàn tác tồn kho mà để giá vốn sai. */
        if (!dongGocCua(g.id, pn.id))
            loi.push(ten + ': lịch sử giá vốn của phiếu này không còn nên không xác định được ' +
                     'giá vốn trước khi nhập. Hãy dùng Phiếu điều chỉnh tồn kho.');
    });
    return { duoc: !loi.length, loi: loi };
};

/**
 * Thu hồi phiếu nhập kho: trừ lại tồn, trả giá vốn bình quân về trước khi nhập,
 * xóa dòng lịch sử giá vốn của phiếu, dựng lại thẻ kho.
 * Trả về true nếu đã thu hồi.
 */
T.thuHoiNhapKho = function (pn) {
    var kt = T.kiemTraThuHoiNhap(pn);
    if (!kt.duoc) return false;
    gomDongPhieu(pn).forEach(function (g) {
        var hh = T.hh(g.dong);
        if (!hh) return;
        hh.ton = (Number(hh.ton) || 0) - g.soLuong;
        var dong = dongGocCua(g.id, pn.id);
        if (dong) {
            /* Đặt lại đúng giá vốn bình quân trước lần nhập này — không tính lại,
               không làm tròn thêm lần nữa. */
            hh.giaVonBQ = Number(dong.bqCu) || 0;
            hh.giaVon = hh.giaVonBQ;
        }
    });
    /* Gỡ toàn bộ dòng lịch sử giá vốn của phiếu — lịch sử phải khớp với thực tế. */
    DB.data.lichSuGiaVon = (DB.data.lichSuGiaVon || []).filter(function (x) {
        return x.phieuNhapId !== pn.id;
    });
    pn.trangThai = 'Đã hủy';
    var lo = pn.loNhapId ? DB.get('loNhap', pn.loNhapId) : null;
    if (lo) {
        /* ==============================================================
           CHI PHÍ BỔ SUNG PHẢI HÒA VỀ MỘT ĐƯỜNG DUY NHẤT.
           "Bổ sung chi phí" vừa nướng số tiền vào lines[].giaVonLo của lô,
           vừa để lại một khoản {boSung:true} trong lo.chiPhi. Thu hồi rồi
           nhập kho lại thì phiếu mới đã mang giá vốn CÓ SẴN khoản đó, mà
           "Tính lại giá vốn" vẫn đọc lo.chiPhi và cộng thêm một lần nữa —
           giá vốn đội lên đúng bằng khoản bổ sung.
           Nay khi lô trở về nháp, khoản bổ sung được hạ xuống thành CHI PHÍ
           THƯỜNG của lô rồi phân bổ lại từ đầu: tiền không mất, và cả hai
           đường (ghi sổ và tính lại) đều chỉ tính nó đúng MỘT lần.
           ============================================================== */
        var coBoSung = (lo.chiPhi || []).some(function (c) { return c.boSung; });
        if (coBoSung) {
            (lo.chiPhi || []).forEach(function (c) { delete c.boSung; });
            (lo.lines || []).forEach(function (l) { l.chiPhiPhanBo = 0; l.giaVonLo = 0; });
            lo.daPhanBo = false;
            T.phanBoChiPhi(lo);
            DB.data.lichSuGiaVon = (DB.data.lichSuGiaVon || []).filter(function (x) {
                return !(x.boSung && x.loId === lo.id);
            });
        }
        /* Trả lô về bản nháp và MỞ KHÓA — tồn kho, giá vốn, lịch sử giá vốn đã
           được trả về nguyên trạng nên lô lại được sửa, xóa, nhập lại. */
        lo.trangThai = 'Chờ nhập kho';
        lo.khoa = false;
        lo.phieuNhapId = ''; lo.phieuNhapSo = ''; lo.ngayNhapKho = '';
        var dm = lo.donMuaId ? DB.get('donMua', lo.donMuaId) : null;
        if (dm && dm.trangThai === 'Đã nhận hàng') {
            dm.trangThai = 'Đã đặt hàng';
            DB.log('Thu hồi nhập kho', 'donMua', dm);
        }
    }
    DB.log('Thu hồi phiếu nhập kho', 'phieuNhap', pn);
    T.dungTheKho();
    DB.save();
    return true;
};

/**
 * Bổ sung chi phí cho một lô ĐÃ nhập kho.
 * Nguyên tắc kế toán: chứng từ đã hoàn thành không sửa; chi phí phát sinh thêm
 * chỉ được phân bổ vào PHẦN TỒN KHO CÒN LẠI của chính các mã hàng thuộc lô đó.
 * Trả về danh sách dòng đã điều chỉnh để hiển thị cho người dùng.
 */
T.boSungChiPhi = function (lo, khoan) {
    var them = Number(khoan.soTien) || 0;
    if (!them) return [];
    /* MỘT LUẬT DUY NHẤT CHO CẢ HAI ĐƯỜNG. T.phanBoChiPhi loại thuế GTGT hàng
       nhập khẩu ra khỏi giá vốn vì đó là thuế được khấu trừ, không phải chi phí
       mua hàng. Đường bổ sung chi phí sau khi nhập kho phải theo đúng luật đó,
       nếu không cùng một khoản tiền lại làm đội giá vốn ở đường này. */
    if (!T.chiPhiVaoGiaVon(khoan.loai)) return [];
    lo.chiPhi = lo.chiPhi || [];
    lo.chiPhi.push({ loai: khoan.loai, ten: khoan.ten, soTien: them, boSung: true, ngay: T.today() });

    // tỷ trọng phân bổ giữ đúng cách phân bổ của lô
    var cach = lo.cachPhanBo || 'giaTri';
    var lines = lo.lines || [];
    var tongTH = T.sum(lines, function (l) { return Number(l.tienHang) || 0; });
    var tongSL = T.sum(lines, function (l) { return Number(l.soLuong) || 0; });
    var conLai = them, kq = [];
    lines.forEach(function (l, i) {
        var ty = cach === 'soLuong'
            ? (tongSL ? (Number(l.soLuong) || 0) / tongSL : 0)
            : (tongTH ? (Number(l.tienHang) || 0) / tongTH : 0);
        var pb = (i === lines.length - 1) ? conLai : Math.round(them * ty);
        conLai -= pb;
        if (!pb) return;
        var hh = T.hh(l);
        if (!hh) return;
        var ton = Number(hh.ton) || 0;
        var bqCu = Number(hh.giaVonBQ === undefined ? hh.giaVon : hh.giaVonBQ) || 0;
        if (ton <= 0) {                       // đã bán hết: không hồi tố chứng từ đã phát hành
            kq.push({ maHang: l.maHang, tenHang: l.tenHang, ton: 0, chiPhi: pb,
                      bqCu: bqCu, bqMoi: bqCu, boQua: true });
            return;
        }
        var bqMoi = Math.round(bqCu + pb / ton);
        hh.giaVonBQ = bqMoi; hh.giaVon = bqMoi;
        l.chiPhiPhanBo = (Number(l.chiPhiPhanBo) || 0) + pb;
        l.giaVonLo = (Number(l.soLuong) || 0)
            ? Math.round(((Number(l.tienHang) || 0) + l.chiPhiPhanBo) / (Number(l.soLuong) || 1)) : 0;
        DB.data.lichSuGiaVon.unshift({
            id: T.uid('GV'), luc: T.now(), ngay: T.today(), loId: lo.id, loSo: lo.so,
            hangHoaId: hh.id, maHang: hh.ma, tenHang: hh.ten, boSung: true,
            tonCu: ton, bqCu: bqCu, slNhap: 0, giaVonLo: bqMoi, tonMoi: ton, bqMoi: bqMoi,
            ai: DB.user().taiKhoan,
            dienGiai: 'Bổ sung chi phí ' + khoan.ten + ' — phân bổ ' + T.money(pb) + ' đ vào ' + T.num(ton) + ' tồn còn lại'
        });
        kq.push({ maHang: l.maHang, tenHang: l.tenHang, ton: ton, chiPhi: pb, bqCu: bqCu, bqMoi: bqMoi });
    });
    lo.tongChiPhi = (Number(lo.tongChiPhi) || 0) + them;
    lo.tongGiaVon = (Number(lo.tongTienHang) || 0) + lo.tongChiPhi;
    DB.log('Bổ sung chi phí', 'loNhap', lo);
    T.dungTheKho();
    DB.save();
    return kq;
};

/**
 * Giá vốn bình quân của một mã hàng.
 * Không truyền ngày → giá vốn hiện tại.
 * Có truyền ngày → tra LỊCH SỬ giá vốn để lấy đúng giá vốn tại thời điểm đó
 * (phục vụ mở lại chứng từ của các năm trước).
 */
T.giaVonBQ = function (hang, ngay) {
    var id = T.idHH(hang);
    var hh = id ? T.hh(id) : null;
    var htai = hh ? (Number(hh.giaVonBQ === undefined ? hh.giaVon : hh.giaVonBQ) || 0) : 0;
    if (!ngay || ngay >= T.today()) return htai;
    var ls = DB.all('lichSuGiaVon').filter(function (x) {
        return T.idHH(x) === id && x.ngay <= ngay;
    });
    if (!ls.length) return htai;
    ls.sort(function (a, b) { return a.ngay < b.ngay ? 1 : (a.ngay > b.ngay ? -1 : (a.luc < b.luc ? 1 : -1)); });
    return Number(ls[0].bqMoi) || htai;
};

/**
 * TÍNH LẠI TOÀN BỘ GIÁ VỐN BÌNH QUÂN từ đầu, phát lại mọi lô nhập theo thứ tự ngày.
 * Dùng sau khi nhập dữ liệu lịch sử từ Excel để bảo đảm tính liên tục nhiều năm.
 * Chứng từ bán hàng KHÔNG bị đụng tới — giá vốn trên chứng từ đã đóng băng.
 */
/**
 * PHÁT LẠI SỔ KHO — HÀM THUẦN ĐỌC, KHÔNG GHI MỘT BYTE NÀO.
 *
 * Đây là BỘ MÁY DUY NHẤT dựng lại tồn kho và giá vốn bình quân gia quyền từ
 * chứng từ gốc. Hai đường dùng chung đúng bộ máy này:
 *     · T.tinhLaiGiaVon()      — phát lại toàn bộ rồi GHI ĐÈ vào kho dữ liệu
 *     · T.tonKhoTaiNgay(ngay)  — phát lại tới một mốc rồi ĐỌC kết quả
 * Nhờ vậy báo cáo lịch sử và sổ hiện hành không bao giờ là hai hệ thống tính
 * toán song song: cùng một dòng lệnh, chỉ khác mốc dừng.
 *
 * moc — chuỗi 'YYYY-MM-DD'. Bỏ trống nghĩa là phát lại tới hết dữ liệu.
 * Trả về { ton, bq, ls, sk, coCT } — chỉ số liệu, không đụng DB.
 */
T.chayLaiKho = function (moc) {
    moc = String(moc || '');
    var ton = {}, bq = {}, coCT = {};
    DB.all('hangHoa').forEach(function (h) { ton[h.id] = 0; bq[h.id] = 0; });
    function o(id) { if (ton[id] === undefined) { ton[id] = 0; bq[id] = 0; } }
    /* Khóa sắp xếp của một chứng từ: thời điểm lập rồi tới số hiệu rồi tới id.
       Ba mảnh này cộng lại là duy nhất và không đổi giữa các lần chạy. */
    function khoaTT(x) {
        return String(x._tao || '') + '|' + String(x.so || '') + '|' + String(x.id || '');
    }

    /* ---- 1. GOM MỌI CHỨNG TỪ LÀM ĐỔI TỒN VỀ MỘT DÒNG THỜI GIAN ---- */
    var sk = [];
    DB.all('phieuNhap').forEach(function (pn) {
        if (pn.trangThai !== 'Đã ghi sổ') return;
        if (moc && String(pn.ngay || '') > moc) return;
        (pn.lines || []).forEach(function (l) {
            var id = T.idDong(l); if (!id) return;
            sk.push({ ngay: pn.ngay || '', thu: 1, k: khoaTT(pn), loai: 'nhap', id: id,
                      maHang: l.maHang, tenHang: l.tenHang,
                      sl: Number(l.soLuong) || 0, gia: Number(l.giaVon) || 0,
                      pn: pn, loId: pn.loNhapId || '', loSo: pn.loNhapSo || '' });
        });
    });
    DB.all('phieuXuat').forEach(function (px) {
        if (px.trangThai === 'Nháp' || px.trangThai === 'Đã hủy') return;
        if (moc && String(px.ngay || '') > moc) return;
        (px.lines || []).forEach(function (l) {
            var id = T.idDong(l); if (!id) return;
            sk.push({ ngay: px.ngay || '', thu: 3, k: khoaTT(px), loai: 'xuat', id: id,
                      sl: -(Number(l.soLuong) || 0), px: px });
        });
    });
    DB.all('dieuChinhKho').forEach(function (dc) {
        if (dc.trangThai !== 'Đã duyệt') return;
        if (moc && String(dc.ngay || '') > moc) return;
        (dc.lines || []).forEach(function (l) {
            var id = T.idDong(l); if (!id) return;
            var ch = Number(l.chenh) || 0; if (!ch) return;
            sk.push({ ngay: dc.ngay || '', thu: 2, k: khoaTT(dc), loai: 'dieuChinh', id: id,
                      sl: ch, gia: Number(l.giaVon) || 0, dc: dc });
        });
    });
    /* Chi phí bổ sung sau khi nhập kho — áp lại đúng ngày phát sinh. */
    DB.all('loNhap').forEach(function (lo) {
        if (!T.loDaVaoSo(lo)) return;
        (lo.chiPhi || []).forEach(function (c) {
            if (!c.boSung || !T.chiPhiVaoGiaVon(c.loai)) return;
            if (moc && String(c.ngay || lo.ngay || '') > moc) return;
            sk.push({ ngay: c.ngay || lo.ngay || '', thu: 4, k: khoaTT(lo) + '|' + (c.ten || ''),
                      loai: 'boSung', lo: lo, khoan: c });
        });
    });
    /* THỨ TỰ PHÁT LẠI PHẢI TUYỆT ĐỐI XÁC ĐỊNH.
       DB.insert chèn lên ĐẦU mảng nên hai chứng từ CÙNG NGÀY sẽ được đọc theo
       thứ tự ngược với thứ tự lập. Sắp xếp chỉ theo ngày rồi theo loại là chưa
       đủ: bình quân gia quyền phụ thuộc thứ tự, và lịch sử giá vốn dựng lại sẽ
       lệch với đường ghi sổ, khiến điều kiện thu hồi phiếu nhập đọc sai — người
       dùng không thu hồi được đúng phiếu vừa lập. Khóa phụ dưới đây đưa thứ tự
       về ĐÚNG thứ tự lập chứng từ. */
    sk.sort(function (a, b) {
        if (a.ngay !== b.ngay) return a.ngay < b.ngay ? -1 : 1;
        if (a.thu !== b.thu) return a.thu - b.thu;
        return a.k < b.k ? -1 : (a.k > b.k ? 1 : 0);
    });

    /* ---- 2. CHẠY LẠI TỪ ĐẦU, DỰNG LỊCH SỬ GIÁ VỐN MỚI ---- */
    var ls = [];
    sk.forEach(function (x) {
        if (x.loai === 'boSung') {
            /* Chi phí bổ sung rải đều lên phần TỒN CÒN LẠI của chính lô đó. */
            var dsL = (x.lo.lines || []).filter(function (l) {
                var id = T.idDong(l); return id && ton[id] > 0; });
            var cach = x.lo.cachPhanBo || 'giaTri';
            var tongTH = T.sum(dsL, function (l) { return Number(l.tienHang) || 0; });
            var tongSL = T.sum(dsL, function (l) { return Number(l.soLuong) || 0; });
            var them = Number(x.khoan.soTien) || 0, conLai = them;
            dsL.forEach(function (l, i2) {
                var id = T.idDong(l);
                var ty = cach === 'soLuong'
                    ? (tongSL ? (Number(l.soLuong) || 0) / tongSL : 0)
                    : (tongTH ? (Number(l.tienHang) || 0) / tongTH : 0);
                var pb = (i2 === dsL.length - 1) ? conLai : Math.round(them * ty);
                conLai -= pb;
                if (!pb || !ton[id]) return;
                var bqCu2 = bq[id];
                coCT[id] = true;
                bq[id] = Math.round(bqCu2 + pb / ton[id]);
                ls.push({ id: T.uid('GV'), luc: x.lo._tao || (x.ngay + ' 00:00'), ngay: x.ngay,
                          loId: x.lo.id, loSo: x.lo.so, hangHoaId: id,
                          maHang: l.maHang, tenHang: l.tenHang,
                          tonCu: ton[id], bqCu: bqCu2, slNhap: 0, giaVonLo: 0,
                          tonMoi: ton[id], bqMoi: bq[id], boSung: true, ai: 'tính lại',
                          dienGiai: 'Chi phí bổ sung: ' + (x.khoan.ten || '') });
            });
            return;
        }
        o(x.id);
        coCT[x.id] = true;
        var tonCu = ton[x.id], bqCu = bq[x.id];
        if (x.loai === 'nhap' || (x.loai === 'dieuChinh' && x.sl > 0)) {
            var sl = x.sl, giaLo = Number(x.gia) || bqCu;
            var tonMoi = tonCu + sl;
            /* Bình quân gia quyền di động — đúng công thức của đường ghi sổ. */
            bq[x.id] = tonMoi > 0
                ? Math.round((Math.max(0, tonCu) * bqCu + sl * giaLo) / (Math.max(0, tonCu) + sl))
                : giaLo;
            ton[x.id] = tonMoi;
            if (x.loai === 'nhap')
                ls.push({ id: T.uid('GV'), luc: x.pn._tao || (x.ngay + ' 00:00'), ngay: x.ngay,
                          loId: x.loId, loSo: x.loSo,
                          phieuNhapId: x.pn.id, phieuNhapSo: x.pn.so, hangHoaId: x.id,
                          maHang: x.maHang, tenHang: x.tenHang,
                          tonCu: tonCu, bqCu: bqCu, slNhap: sl, giaVonLo: giaLo,
                          tonMoi: tonMoi, bqMoi: bq[x.id], ai: 'tính lại' });
        } else {
            /* Xuất kho và điều chỉnh giảm chỉ làm đổi tồn, không đổi bình quân. */
            ton[x.id] = tonCu + x.sl;
        }
    });

    return { ton: ton, bq: bq, ls: ls, sk: sk, coCT: coCT };
};

/**
 * TÍNH LẠI GIÁ VỐN — XÓA SẠCH, ĐỌC LẠI, TÍNH TỪ ĐẦU, GHI ĐÈ.
 * Phần tính toán nằm trọn trong T.chayLaiKho; hàm này chỉ làm việc GHI.
 */
T.tinhLaiGiaVon = function () {
    var kq = T.chayLaiKho('');
    var ton = kq.ton, bq = kq.bq, ls = kq.ls, sk = kq.sk, coCT = kq.coCT;
    /* ---- 3. GHI ĐÈ. Không cộng dồn, không giữ lại phần cũ. ----
       TỒN KHO luôn ghi đè: tồn phải bằng đúng những gì chứng từ nói, không hơn.
       GIÁ VỐN chỉ ghi đè cho mặt hàng CÓ chứng từ trong dòng thời gian. Mặt hàng
       chưa từng nhập xuất lần nào thì đơn giá vốn hiện có là đơn giá tham chiếu
       khai trong Danh mục — xóa nó về 0 là làm MẤT dữ liệu gốc, và mọi lần bán
       sau đó sẽ ghi giá vốn 0, thổi lãi gộp lên 100%. Bình quân gia quyền khi
       không có phát sinh thì mang nguyên sang kỳ sau, đó mới đúng công thức. */
    var soGiuNguyen = 0;
    DB.all('hangHoa').forEach(function (h) {
        h.ton = ton[h.id] || 0;
        if (coCT[h.id]) {
            h.giaVonBQ = bq[h.id] || 0;
            h.giaVon = h.giaVonBQ;
        } else if (Number(h.giaVonBQ === undefined ? h.giaVon : h.giaVonBQ) || 0) {
            soGiuNguyen++;
        }
    });
    /* MẢNG LỊCH SỬ GIÁ VỐN PHẢI XẾP MỚI NHẤT LÊN ĐẦU, và "mới nhất" ở đây là
       theo ĐÚNG thứ tự phát lại — không phải theo ngày rồi thôi. Hai phiếu nhập
       cùng ngày có cùng mốc thời gian tới phút, sắp theo ngày sẽ để chúng nguyên
       thứ tự tăng dần, tức là ngược. T.kiemTraThuHoiNhap đọc ls[0] để biết đã có
       lần nhập nào SAU phiếu này chưa; đọc nhầm thì người dùng không thu hồi
       được đúng phiếu vừa lập. Dòng thời gian đã sắp tăng dần rồi nên đảo lại là
       đủ, và luôn khớp tuyệt đối với đường ghi sổ. */
    ls.reverse();
    DB.data.lichSuGiaVon = ls;
    var soLo = DB.all('loNhap').filter(function (l) { return T.loDaVaoSo(l); }).length;
    DB.log('Tính lại giá vốn', 'hangHoa', { ten: soLo + ' lô nhập' });
    T.dungTheKho();                       // tồn kho thay đổi → dựng lại thẻ kho
    DB.save();
    return { soLo: soLo, soDong: ls.length, soChungTu: sk.length, soGiuNguyen: soGiuNguyen,
             soMa: Object.keys(coCT).length };
};


/* ==========================================================================
   CHIẾT KHẤU NỘI BỘ — KHAI NGAY TRONG THÔNG TIN CỦA PHIÊN BẢN BẢNG GIÁ
   --------------------------------------------------------------------------
   TRIẾT LÝ
     · Đơn vị nguồn (Tản Viên) là nơi DUY NHẤT quản lý giá vốn gốc, xây dựng
       bảng giá và khai chiết khấu nội bộ. AA · EMC · Thái Phong chỉ SỬ DỤNG.
     · Toàn hệ thống chỉ có MỘT bảng giá dùng chung. Mỗi phiên bản bảng giá là
       một gói dữ liệu hoàn chỉnh: toàn bộ loại giá (Giá PPP · Đại lý · Bán lẻ ·
       …) VÀ chiết khấu nội bộ của mọi đơn vị phát hành nằm cùng phiên bản đó.
     · Chiết khấu nội bộ khai MỘT LẦN cho cả phiên bản, KHÔNG khai theo từng
       mặt hàng. Danh sách công ty lấy động từ danh mục Đơn vị phát hành.
     · Sao chép / tạo phiên bản mới thì chiết khấu nội bộ được sao theo, sửa lại
       được; phiên bản cũ giữ nguyên, không bao giờ bị sửa ngược.

   CẤU TRÚC DỮ LIỆU (nằm trong bản ghi bangGiaBan)
       b.chietKhauNoiBo = { '<donViId>': <phần trăm>, ... }
     Ví dụ: { AA: 5, EMC: 8, THAIPHONG: 0 }

   CÔNG THỨC DUY NHẤT CỦA BUSINESS ENGINE
       Giá vốn nội bộ của đơn vị phát hành
         = Giá theo LOẠI GIÁ đang chọn của phiên bản × (1 − chiết khấu nội bộ)
     Đơn vị nguồn phát hành thì không có giao dịch nội bộ: giá vốn = giá vốn gốc.
     Toàn bộ tính ngầm: không hiển thị trên giao diện, không yêu cầu nhập.
   ========================================================================== */

/** Bảng chiết khấu nội bộ của một phiên bản bảng giá — luôn trả về object. */
T.chietKhauNoiBoCua = function (b) {
    if (typeof b === 'string') b = DB.get('bangGiaBan', b);
    return (b && b.chietKhauNoiBo) || {};
};
/** Chiết khấu nội bộ (%) của MỘT đơn vị trong MỘT phiên bản bảng giá. */
T.chietKhauNoiBo = function (b, donViId) {
    if (!donViId || T.laCtyNguon(donViId)) return 0;
    var v = Number(T.chietKhauNoiBoCua(b)[donViId]);
    if (!isFinite(v)) return 0;
    return Math.min(100, Math.max(0, v));
};
/** Diễn giải chiết khấu nội bộ thành câu tiếng Việt. */
T.dienGiaiNoiBo = function (b, donViId) {
    if (donViId && T.laCtyNguon(donViId)) return 'Đơn vị nguồn — giá vốn gốc, không chiết khấu nội bộ';
    var ck = T.chietKhauNoiBo(b, donViId);
    return ck ? ('Chiết khấu nội bộ ' + T.num(ck, 2) + '% trên loại giá đang chọn')
              : 'Không chiết khấu nội bộ — giá vốn nội bộ bằng đúng giá của loại giá đang chọn';
};

/**
 * LOẠI GIÁ DÙNG LÀM CĂN CỨ TÍNH GIÁ VỐN NỘI BỘ.
 * Là loại giá NGƯỜI DÙNG ĐANG CHỌN trên chứng từ (Giá PPP · Đại lý · Bán lẻ…).
 * Chứng từ chưa chọn thì lấy cột giá chính của phiên bản để Engine luôn có căn cứ.
 */
T.cotGiaNoiBo = function (b, cotGia) {
    if (typeof b === 'string') b = DB.get('bangGiaBan', b);
    var ds = (b && b.cotGia) || [];
    if (cotGia && ds.indexOf(cotGia) >= 0) return cotGia;
    return (b && b.cotChinh) || ds[0] || '';
};

/**
 * GIÁ THEO LOẠI GIÁ của một mặt hàng trong một phiên bản bảng giá.
 * Phiên bản không có giá cho mặt hàng đó thì trả về 0 — người gọi tự quyết định
 * phương án dự phòng, Engine không âm thầm thay bằng con số khác.
 */
T.giaTheoLoai = function (b, hang, cotGia) {
    if (typeof b === 'string') b = DB.get('bangGiaBan', b);
    if (!b) return 0;
    var cot = T.cotGiaNoiBo(b, cotGia);
    var o = T.traBang(b.bang, hang);
    if (o && Number(o[cot]) > 0) return Math.round(Number(o[cot]));
    var g = T.traBang(b.gia, hang);
    if (cot === (b.cotChinh || '') && Number(g) > 0) return Math.round(Number(g));
    return 0;
};

/**
 * PHIÊN BẢN BẢNG GIÁ DÙNG ĐỂ TÍNH GIÁ VỐN NỘI BỘ.
 * Chứng từ có khai bảng giá thì dùng ĐÚNG phiên bản đã khai — chứng từ cũ giữ
 * nguyên phiên bản cũ. Không khai thì lấy phiên bản còn hiệu lực tại ngày chứng
 * từ có chứa mặt hàng đó.
 */
T.phienBanTinhGia = function (hang, bangGiaId, ngay) {
    var b = bangGiaId ? DB.get('bangGiaBan', bangGiaId) : null;
    if (b) return b;
    return T.bangGiaChoHang(hang, ngay);
};

/**
 * GIÁ VỐN NỘI BỘ của một mặt hàng cho một đơn vị phát hành.
 *   Giá của loại giá đang chọn × (1 − chiết khấu nội bộ của đơn vị)
 * Phiên bản không có giá cho mặt hàng đó thì lấy GIÁ VỐN GỐC — nhóm không bao
 * giờ bán dưới giá vốn chỉ vì bảng giá còn thiếu dòng.
 */
T.giaNoiBo = function (hang, donViId, ngay, bangGiaId, cotGia) {
    var goc = T.giaVonBQ(hang, ngay);
    if (!donViId || T.laCtyNguon(donViId)) return goc;
    var b = T.phienBanTinhGia(hang, bangGiaId, ngay);
    if (!b) return goc;
    var gia = T.giaTheoLoai(b, hang, cotGia);
    if (!(gia > 0)) return goc;
    var ck = T.chietKhauNoiBo(b, donViId);
    return Math.max(0, Math.round(gia * (1 - ck / 100)));
};

/**
 * LƯU CHIẾT KHẤU NỘI BỘ VÀO ĐÚNG MỘT PHIÊN BẢN BẢNG GIÁ.
 * Chỉ ghi vào phiên bản được chỉ định — mọi phiên bản khác, kể cả phiên bản
 * trước đó của cùng mã bảng giá, KHÔNG bị đụng tới.
 * Trả về số đơn vị thực sự có thay đổi (0 = không ghi gì).
 */
T.luuChietKhauNoiBo = function (bangGiaId, bang) {
    var b = DB.get('bangGiaBan', bangGiaId);
    if (!b) return 0;
    var cu = T.chietKhauNoiBoCua(b);
    var moi = T.chuanChietKhauNoiBo(bang);
    var doi = 0;
    var khoa = {};
    Object.keys(cu).forEach(function (k) { khoa[k] = 1; });
    Object.keys(moi).forEach(function (k) { khoa[k] = 1; });
    Object.keys(khoa).forEach(function (k) {
        if (Number(cu[k] || 0) !== Number(moi[k] || 0)) doi++;
    });
    if (!doi) return 0;
    var o = T.clone(b);
    o.chietKhauNoiBo = moi;
    DB.update('bangGiaBan', b.id, o);
    return doi;
};
/**
 * Chuẩn hóa bảng chiết khấu: chỉ giữ đơn vị CÒN TỒN TẠI và KHÔNG phải đơn vị
 * nguồn, phần trăm nằm trong [0, 100]. Không lưu mức 0 để dữ liệu không phình
 * và để "chưa khai" với "khai bằng 0" cho cùng một kết quả.
 */
T.chuanChietKhauNoiBo = function (bang) {
    var ra = {};
    var co = {};
    DB.all('donVi').forEach(function (d) { co[d.id] = 1; });
    Object.keys(bang || {}).forEach(function (k) {
        if (!co[k] || T.laCtyNguon(k)) return;
        var v = Number(bang[k]);
        if (!isFinite(v) || v <= 0) return;
        ra[k] = Math.min(100, Math.round(v * 100) / 100);
    });
    return ra;
};

/**
 * KẾ THỪA CHIẾT KHẤU NỘI BỘ KHI TẠO PHIÊN BẢN BẢNG GIÁ MỚI.
 * Phiên bản mới của cùng một mã bảng giá bắt đầu từ chiết khấu của phiên bản
 * LIỀN TRƯỚC theo ngày hiệu lực — người dùng KHÔNG phải khai lại. Đây là BẢN SAO
 * ĐỘC LẬP: sửa ở phiên bản mới không đụng tới phiên bản cũ.
 */
T.keThuaChietKhauNoiBo = function (o, boSungVao) {
    if (!o) return o;
    if (o.chietKhauNoiBo && Object.keys(o.chietKhauNoiBo).length) return o;
    var goc = boSungVao ? (DB.get('bangGiaBan', boSungVao.id || boSungVao) || boSungVao) : null;
    if (!goc) {
        var tuNgay = o.tuNgay || T.today();
        var ds = DB.all('bangGiaBan').filter(function (b) {
            return b.id !== o.id && (b.tuNgay || '') <= tuNgay &&
                   (o.ma ? b.ma === o.ma
                         : (o.nhaCungCap && b.nhaCungCap === o.nhaCungCap));
        }).sort(function (a, b) {
            if ((a.tuNgay || '') !== (b.tuNgay || '')) return (a.tuNgay || '') < (b.tuNgay || '') ? 1 : -1;
            return (Number(b.phienBan) || 1) - (Number(a.phienBan) || 1);
        });
        goc = ds[0] || null;
    }
    o.chietKhauNoiBo = goc ? T.clone(goc.chietKhauNoiBo || {}) : {};
    return o;
};

/**
 * CẤU HÌNH GIÁ NỘI BỘ ĐỜI CŨ ĐÃ LƯU TRỮ.
 * Những cấu hình không diễn đạt được bằng phần trăm chiết khấu (giá cố định,
 * cộng/trừ số tiền) và các mức ghi đè theo từng mặt hàng được giữ nguyên trạng
 * để tra cứu — không bị áp sai vào mô hình mới và cũng không bị mất.
 */
T.luuTruGiaNoiBo = function () {
    return ((DB.data && DB.data._meta && DB.data._meta.giaNoiBoLuuTru) || []).map(function (x) {
        var dv = DB.get('donVi', x.donViId) || {};
        var b = DB.get('bangGiaBan', x.bangGiaId);
        return {
            bangGiaId: x.bangGiaId || '',
            bangGia: (b && b.ten) || x.bangGiaTen || '(phiên bản đã xóa)',
            donVi: dv.tat || x.donViId || '—',
            loai: x.ghiDe ? 'Ghi đè theo mặt hàng' : 'Công thức không quy được về %',
            soMa: x.ghiDe ? Object.keys(x.ghiDe).length : 0,
            moTa: x.ghiDe
                ? (Object.keys(x.ghiDe).length + ' mã hàng có giá nội bộ riêng')
                : ((x.cauHinh && (x.cauHinh.moTa || x.cauHinh.loai || x.cauHinh.kieuTinh)) || '—')
        };
    });
};

/** Toàn bộ phiên bản bảng giá có khai chiết khấu cho một đơn vị — lịch sử đầy đủ. */
T.lichSuChietKhauNoiBo = function (donViId) {
    return DB.all('bangGiaBan')
        .filter(function (b) { return Number(T.chietKhauNoiBoCua(b)[donViId]) > 0; })
        .map(function (b) {
            return { bangGiaId: b.id, maBangGia: b.ma, tenBangGia: b.ten,
                     phienBan: Number(b.phienBan) || 1, tuNgay: b.tuNgay,
                     denNgay: b.denNgay || '', trangThai: b.trangThai,
                     donViId: donViId, chietKhau: T.chietKhauNoiBo(b, donViId) };
        })
        .sort(function (a, b) {
            if ((a.tuNgay || '') !== (b.tuNgay || '')) return (a.tuNgay || '') < (b.tuNgay || '') ? 1 : -1;
            return b.phienBan - a.phienBan;
        });
};

/* ------------------------------------------------------ CHỈ MỤC HÀNG HÓA
   Tra cứu hàng hóa theo Mã hàng (Model) · mã khác · tên trong thời gian không
   đổi. Cần cho việc nhập bảng giá hàng chục nghìn dòng: không quét lại danh
   mục mỗi dòng. */

/* Chuẩn hóa danh sách MÃ KHÁC: nhận chuỗi ngăn cách bởi dấu phẩy / chấm phẩy
   hoặc mảng, bỏ trùng, bỏ chính Mã hàng (Model) để không tự trỏ về mình. */
T.maKhacTu = function (v, ma) {
    var a = Array.isArray(v) ? v : String(v || '').split(/[,;|\n]/);
    var c = T.kd(ma || ''), th = {}, kq = [];
    a.forEach(function (x) {
        var t = String(x || '').trim(); if (!t) return;
        var k = T.kd(t); if (!k || k === c || th[k]) return;
        th[k] = 1; kq.push(t);
    });
    return kq;
};
/* ==========================================================================
   KIẾN TRÚC DỮ LIỆU HÀNG HÓA
   --------------------------------------------------------------------------
   1. ID NỘI BỘ (h.id) là KHÓA DUY NHẤT của một mặt hàng. Toàn bộ phần mềm —
      bảng giá, báo giá, đơn bán, đơn mua, hợp đồng, kho, phiếu nhập, phiếu
      xuất, kiểm kê, điều chỉnh, giá vốn, công nợ, kế toán, báo cáo — đều liên
      kết bằng ID này. Người dùng không cần quan tâm tới nó.
   2. MODEL (h.ma) chỉ là mã kỹ thuật của nhà sản xuất. Model ĐƯỢC PHÉP TRÙNG.
      Hai mặt hàng cùng Model nhưng khác tên hàng hoặc khác thông số kỹ thuật
      là HAI SẢN PHẨM KHÁC NHAU, mỗi sản phẩm một ID nội bộ riêng.
   3. TÊN HÀNG và THÔNG SỐ KỸ THUẬT là phần mô tả để phân biệt các mặt hàng
      dùng chung một Model.
   Không nơi nào trong phần mềm được coi Model là khóa.
   ========================================================================== */

/** Số hiệu nội bộ hiển thị cho người dùng đối chiếu — sinh một lần, không đổi. */
T.SO_NOI_BO_DAU = 100001;
/**
 * Số hiệu nội bộ ĐÃ TỪNG CẤP — kể cả của mặt hàng đang nằm trong Thùng rác.
 * Số đã cấp không bao giờ được cấp lại: khôi phục một mặt hàng đã xóa mà số cũ
 * đã bị dùng lại thì hệ thống sẽ có hai mặt hàng chung một Mã hàng.
 */
function mocSoNoiBo(d) {
    var lon = T.SO_NOI_BO_DAU - 1, i;
    var ds = (d || DB.data).hangHoa || [];
    for (i = 0; i < ds.length; i++) if (Number(ds[i].maNoiBo) > lon) lon = Number(ds[i].maNoiBo);
    var tr = (d || DB.data).thungRac || [];
    for (i = 0; i < tr.length; i++) {
        if (tr[i].bang !== 'hangHoa' || !tr[i].ban) continue;
        if (Number(tr[i].ban.maNoiBo) > lon) lon = Number(tr[i].ban.maNoiBo);
    }
    return lon;
}
T.capSoNoiBo = function (d) {
    var ds = (d || DB.data).hangHoa || [];
    var lon = mocSoNoiBo(d), doi = false, i;
    for (i = 0; i < ds.length; i++) {
        if (!Number(ds[i].maNoiBo)) { ds[i].maNoiBo = ++lon; doi = true; }
    }
    T._maxSoNB = lon; T._maxSoNBSrc = ds;
    return doi;
};

/**
 * Số hiệu nội bộ kế tiếp cho MỘT mặt hàng sắp thêm.
 * Số lớn nhất được giữ sẵn nên nhập một tệp hàng chục nghìn dòng cũng không
 * phải quét lại toàn bộ danh mục sau mỗi lần thêm.
 */
T.soNoiBoMoi = function (d) {
    var ds = (d || DB.data).hangHoa || [];
    if (T._maxSoNB === undefined || T._maxSoNBSrc !== ds) {
        T._maxSoNB = mocSoNoiBo(d); T._maxSoNBSrc = ds;
    }
    return ++T._maxSoNB;
};

/**
 * Chuẩn hóa MỌI cách gọi tên một mặt hàng về ĐÚNG ID NỘI BỘ.
 * Nhận: bản ghi hàng hóa · id nội bộ · số hiệu nội bộ · dòng chứng từ.
 * Nhận cả Model — nhưng CHỈ để đọc lại dữ liệu đời cũ chưa có ID; dữ liệu mới
 * luôn ghi ID nên đường này không bao giờ dùng tới trong vận hành bình thường.
 */
/* ==========================================================================
   MASTER DATA HÀNG HÓA
   --------------------------------------------------------------------------
   Danh mục Hàng hóa là DỮ LIỆU NỀN ĐỘC LẬP. Nó chỉ giữ các thuộc tính NHẬN
   DẠNG và CẤU HÌNH THEO DÕI của mặt hàng. Nó KHÔNG giữ giá bán, không giữ giá
   vốn, không giữ chính sách giá:
     · Giá bán      — Danh mục → Bảng giá (bangGiaBan).
     · Giá vốn      — sổ giá vốn bình quân, do phiếu nhập và chi phí lô sinh ra.
     · Tồn kho      — thẻ kho, do phiếu nhập / phiếu xuất / điều chỉnh sinh ra.
   Hai trường ton và giaVonBQ vẫn nằm trên bản ghi nhưng chỉ là BẢN ĐỆM của sổ
   dẫn xuất, không phải thuộc tính master — người dùng không bao giờ nhập tay,
   và bộ rà soát toàn vẹn luôn đối chiếu chúng với sổ gốc.
   ========================================================================== */
T.TRUONG_MASTER_HH = [
    'id',            // khóa chính nội bộ — toàn hệ thống chỉ liên kết bằng trường này
    'maNoiBo',       // số hiệu nội bộ hiển thị
    'ma',            // MÃ ERP của doanh nghiệp
    'model',         // MODEL của nhà sản xuất — được phép trùng
    'maKhac',        // các mã cũ / mã hãng dùng để đối chiếu khi nhập tệp
    'ten',           // tên hàng
    'hang',          // hãng sản xuất
    'nhom',          // loại thiết bị
    'dvt',           // đơn vị tính
    'thongSo',       // thông số kỹ thuật
    'quyCach',       // quy cách đóng gói
    'xuatXu', 'thuongHieu', 'barcode', 'qrCode', 'anh', 'ghiChu',
    'theoDoiTon',    // theo dõi tồn kho
    'theoDoiSerial', // theo dõi số sê-ri
    'theoDoiLo',     // theo dõi lô
    'tonToiThieu',   // định mức cảnh báo
    'trangThai'
];
/* Sổ dẫn xuất — có mặt trên bản ghi để tra nhanh nhưng KHÔNG phải master data. */
T.TRUONG_DAN_XUAT_HH = ['ton', 'tonDau', 'giaVon', 'giaVonBQ', 'plId', 'tuDongTao'];
/* Trường giá bán của bản cũ — đã bỏ hẳn, giá bán chỉ nằm ở Bảng giá. */
var TRUONG_GIA_BO = ['giaPP', 'giaDL', 'giaBL'];
T.TRUONG_GIA_BO_HH = TRUONG_GIA_BO;

T.idHH = function (x) {
    if (x === null || x === undefined || x === '') return '';
    if (typeof x === 'object') {
        if (x.hangHoaId) return String(x.hangHoaId);
        if (x.ten !== undefined && x.ma !== undefined && x.id) return String(x.id);   // bản ghi hàng hóa
        if (x.maHang) return T.idHH(x.maHang);
        if (x.ma) return T.idHH(x.ma);
        return '';
    }
    var k = String(x);
    var m = T.chiMucHangHoa();
    if (m.id[k]) return k;                                    // đã là ID nội bộ
    if (m.soNoiBo[k]) return m.soNoiBo[k].id;                 // số hiệu nội bộ
    var c = m.ma[T.kd(k)];                                     // Mã ERP
    if (c && c !== 'nhieu') return c.id;
    var d = m.model[T.kd(k)];                                  // Model nhà sản xuất
    if (d && d !== 'nhieu') return d.id;
    var q = m.khac[T.kd(k)];
    if (q && q !== 'nhieu') return q.id;
    return '';
};
/** Bản ghi hàng hóa của một ID nội bộ, một dòng chứng từ hay một Model. */
T.hh = function (x) {
    var id = T.idHH(x);
    return id ? (T.chiMucHangHoa().id[id] || null) : null;
};

/**
 * TRA MỘT BẢNG ÁNH XẠ THEO HÀNG HÓA — bảng giá, bảng chiết khấu, bảng ghi chú,
 * bảng ghi đè giá nội bộ.
 *
 * Khóa CHUẨN của mọi bảng là ID nội bộ. Nhưng bảng do bản cũ để lại, do tệp
 * sao lưu cũ khôi phục về, hay do một quy trình nhập bên ngoài ghi vào, có thể
 * còn đánh theo số hiệu nội bộ hoặc theo Model. Hàm này vẫn tra ra được những
 * bảng đó, và LUÔN ưu tiên ID: nếu bảng đã có khóa ID thì khóa cũ không bao giờ
 * được dùng đến, nên hàng hóa trùng Model vẫn giữ đúng giá riêng của mình.
 */
/**
 * NGỪNG HIỆU LỰC LIÊN KẾT GIÁ CỦA MỘT MẶT HÀNG BỊ XÓA.
 *
 * Phiên bản bảng giá là hồ sơ đã phát hành của nhà cung cấp: xóa một mặt hàng
 * KHÔNG được xóa dòng giá trong hồ sơ đó. Ở đây chỉ ghi lại rằng liên kết tới
 * danh mục không còn hiệu lực — số liệu giá giữ nguyên để tra lịch sử, và tên
 * mặt hàng lúc bị xóa được lưu kèm để báo cáo cũ vẫn đọc được.
 */
T.ngungLienKetGia = function (ds, rec) {
    if (!rec) return 0;
    var n = 0;
    (ds || []).forEach(function (b) {
        var co = (b.bang && b.bang[rec.id] !== undefined) ||
                 (b.gia && b.gia[rec.id] !== undefined);
        if (!co) return;
        b.ngungLienKet = b.ngungLienKet || {};
        /* Chụp lại đủ cả MÃ HÀNG nội bộ lẫn MODEL của nhà sản xuất: Mã hàng là
           mã hệ thống, còn Model mới là mã người dùng nhận ra khi đọc lịch sử. */
        b.ngungLienKet[rec.id] = {
            ngay: T.today(), ma: rec.ma || '', model: rec.model || '', ten: rec.ten || '',
            maNoiBo: rec.maNoiBo || '', thongSo: rec.thongSo || ''
        };
        n++;
    });
    return n;
};

/**
 * Mặt hàng ứng với một khóa của phiên bản bảng giá.
 * Mặt hàng còn trong danh mục thì trả về chính bản ghi gốc. Mặt hàng đã bị xóa
 * khỏi danh mục thì trả về BẢN CHỤP lưu lúc ngừng liên kết, để lịch sử giá và
 * báo cáo cũ vẫn đọc được tên hàng — dữ liệu giá không bị mất.
 */
T.hhTuBangGia = function (b, id) {
    var hh = T.hh(id);
    if (hh) return hh;
    var n = b && b.ngungLienKet && b.ngungLienKet[String(id)];
    if (!n) return null;
    return { id: String(id), ma: n.ma || '', ten: n.ten || '', maNoiBo: n.maNoiBo || '',
             thongSo: n.thongSo || '', dvt: '', daNgungLienKet: true, ngungTu: n.ngay || '' };
};

/** Mặt hàng này còn hiệu lực trong một phiên bản bảng giá hay không. */
T.conHieuLucGia = function (b, hang) {
    if (!b || !b.ngungLienKet) return true;
    var id = T.idHH(hang) || hang;
    return !b.ngungLienKet[id];
};

T.traBang = function (map, hang) {
    if (!map) return undefined;
    var id = T.idHH(hang);
    if (id && map[id] !== undefined) return map[id];
    var hh = id ? T.chiMucHangHoa().id[id] : null;
    if (hh) {
        if (hh.maNoiBo !== undefined && map[hh.maNoiBo] !== undefined) return map[hh.maNoiBo];
        if (hh.ma && map[hh.ma] !== undefined) return map[hh.ma];
    }
    var k = (hang && typeof hang === 'object') ? (hang.maHang || hang.ma || '') : hang;
    if (k !== undefined && k !== null && k !== '' && map[k] !== undefined) return map[k];
    return undefined;
};
/** ID nội bộ của một dòng chứng từ — ưu tiên tuyệt đối trường hangHoaId. */
T.idDong = function (l) {
    if (!l) return '';
    if (l.hangHoaId) return String(l.hangHoaId);
    return T.idHH(l.maHang || '');
};
/** Gắn ID nội bộ cho một dòng chứng từ và chép lại Model để in đúng lịch sử. */
T.ganIdDong = function (l, hh, nhan) {
    if (!l) return l;
    if (!hh) hh = T.hh(l);
    if (!hh) return l;
    l.hangHoaId = hh.id;
    if (!l.maHang) l.maHang = hh.ma;
    /* GIỮ NGUYÊN CÁCH GHI GỐC (v18.5.0 — mục 4).
       Nhận ra mặt hàng nhờ Model gốc thì cách ghi của nguồn (có hậu tố, có
       ngoặc, có quy cách) vẫn phải còn nguyên trên chứng từ: báo giá và biên
       bản in ra đúng thứ nhà cung cấp / khách hàng đang dùng. Model chuẩn nằm
       ở Danh mục, truy bằng hangHoaId — không cần ghi đè lên dòng. */
    if (nhan && nhan.bienThe) {
        if (!l.modelNhap) l.modelNhap = String(l.model || l.maHang || '').trim();
        if (!l.bienThe) l.bienThe = nhan.bienThe;
        if (!l.modelGoc) l.modelGoc = nhan.modelGoc || hh.model || '';
    }
    /* NHẬN DIỆN ĐƯỢC LÀ LẤY LUÔN TOÀN BỘ DỮ LIỆU LIÊN QUAN của mặt hàng — người
       dùng không phải khai lại thứ Danh mục đã có. Tồn kho, giá vốn và bảng giá
       đi theo ID nội bộ nên tự đúng; ở đây chỉ điền các trường mô tả mà dòng
       chứng từ còn trống, KHÔNG ghi đè thứ người dùng đã tự nhập. */
    if (!l.model) l.model = hh.model || hh.ma || '';
    if (!l.tenHang) l.tenHang = hh.ten || '';
    if (!l.dvt) l.dvt = hh.dvt || 'Cái';
    if (!l.nhom) l.nhom = hh.nhom || '';
    if (!l.hang) l.hang = hh.hang || hh.nhaSanXuat || '';
    if (!l.thongSo) l.thongSo = hh.thongSo || '';
    return l;
};

T._cmHH = null;
T.themChiMucHH = function (m, x) {
    if (!m || !x) return;
    m.id[String(x.id)] = x;
    if (x.maNoiBo) m.soNoiBo[String(x.maNoiBo)] = x;
    /* Model được phép trùng: chỉ mục theo Model chỉ dùng để GỢI Ý khi nhập tệp
       và để đọc dữ liệu đời cũ. Trùng thì đánh dấu để không ai tra nhầm. */
    var a = T.kd(x.ma || '');
    if (a) { if (m.ma[a] === undefined) m.ma[a] = x; else if (m.ma[a] !== x) m.ma[a] = 'nhieu'; }
    /* MODEL của nhà sản xuất — được phép trùng, nên trùng thì đánh dấu nhập
       nhằng chứ không bao giờ đoán bừa một mặt hàng. */
    var md = T.kd(x.model || '');
    if (md) {
        if (m.model[md] === undefined) m.model[md] = x; else if (m.model[md] !== x) m.model[md] = 'nhieu';
        if (m.modelDs) (m.modelDs[md] = m.modelDs[md] || []).push(x);
    }
    /* MÃ HÀNG NỘI BỘ KHÔNG PHẢI DỮ LIỆU NHẬN DIỆN. Nó chỉ là khóa hệ thống —
       người dùng không nhập, không phải nhớ, và tệp của nhà cung cấp không bao
       giờ có nó. Vì vậy mã nội bộ KHÔNG được đưa vào chỉ mục nhận diện theo
       Model: nhận diện nghiệp vụ chỉ đi bằng Model + Tên hàng. */
    /* Khóa nhận diện thật khi nhập tệp: Model + Tên hàng + Thông số kỹ thuật */
    var kd3 = T.khoaHH(x);
    if (kd3 && !m.bo[kd3]) m.bo[kd3] = x;
    /* Mã khác: mã cũ / model cũ của mặt hàng — chỉ dùng để nhận diện khi nhập
       tệp bảng giá cũ. Một mã khác trỏ tới nhiều mặt hàng thì đánh dấu NHẬP
       NHẰNG để bộ nhập báo cho người dùng chọn, không tự đoán. */
    (x.maKhac || []).forEach(function (k) {
        var kk = T.kd(k || ''); if (!kk) return;
        /* MÃ KHÁC ĐỂ RIÊNG, KHÔNG TRỘN VÀO CHỈ MỤC MODEL. Mã khác là mã cũ của
           doanh nghiệp hoặc mã hãng đời trước; nếu trộn chung, một mã khác của
           mặt hàng B trùng Model của mặt hàng A sẽ làm bộ nhận diện tưởng có
           hai ứng viên và hỏi người dùng, trong khi Model + Tên hàng đã đủ rõ. */
        if (m.khacDs && (m.khacDs[kk] || []).indexOf(x) < 0)
            (m.khacDs[kk] = m.khacDs[kk] || []).push(x);
        if (m.ma[kk]) return;
        if (m.khac[kk] === undefined) m.khac[kk] = x;
        else if (m.khac[kk] !== x) m.khac[kk] = 'nhieu';
    });
    var c = T.kd(x.ten || '');
    if (c) {
        if (!m.ten[c]) m.ten[c] = x;
        /* Danh sách ĐẦY ĐỦ các mặt hàng cùng tên — cần để biết khi nào Tên hàng
           còn mơ hồ và phải hỏi người dùng, thay vì lặng lẽ lấy bản ghi đầu. */
        if (m.tenDs && (m.tenDs[c] || []).indexOf(x) < 0)
            (m.tenDs[c] = m.tenDs[c] || []).push(x);
    }
};
/**
 * KHÓA NHẬN DIỆN MỘT MẶT HÀNG khi đối chiếu với tệp Excel:
 *   Model + Tên hàng + Cấu hình (thông số kỹ thuật · quy cách)
 * Model được phép trùng, nên chỉ khi CẢ BA cùng khớp mới chắc chắn là cùng một
 * mặt hàng. Khác cấu hình — khác số loop, khác công suất, khác dung lượng — là
 * hai mặt hàng độc lập, mỗi mặt hàng một ID nội bộ riêng.
 */
T.khoaHH = function (x) {
    if (!x) return '';
    function g(v) { return T.kd(String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim()); }
    /* Mã nhận diện: ưu tiên Model của nhà sản xuất, chưa có thì lấy Mã ERP. */
    var ma = g(x.model || x.ma || x.maHang || '');
    var ten = g(x.ten || x.tenHang || '');
    /* Cấu hình của mặt hàng: thông số kỹ thuật là chính, chưa khai thông số thì
       lấy quy cách. Tệp bảng giá của hãng ghi cấu hình ở cột "Quy cách", danh
       mục hàng hóa ghi ở cột "Thông số kỹ thuật" — cùng một ý nghĩa nghiệp vụ. */
    /* Thông số kỹ thuật do người gõ tay nên "24VDC" và "24V DC" là MỘT cấu hình.
       Bỏ hẳn khoảng trắng ở thành phần này để một tệp nhập không tách cùng một
       mặt hàng thành hai bản ghi chỉ vì cách gõ. */
    var ts = (g(x.thongSo) || g(x.quyCach)).replace(/\s+/g, '').substr(0, 120);
    if (!ma && !ten) return '';
    return ma + '|' + ten + '|' + ts;
};
T.chiMucHangHoa = function () {
    var ds = DB.all('hangHoa');
    if (T._cmHH && T._cmHH.src === ds && T._cmHH.n === ds.length) return T._cmHH;
    var m = { src: ds, n: ds.length, id: {}, soNoiBo: {}, ma: {}, model: {}, khac: {}, ten: {}, bo: {},
              /* Danh sách ĐẦY ĐỦ các mặt hàng dùng chung một Model — tra bằng
                 chỉ mục thay vì quét lại toàn bộ danh mục ở mỗi dòng nhập tệp. */
              modelDs: {}, khacDs: {}, tenDs: {} };
    for (var i = 0; i < ds.length; i++) T.themChiMucHH(m, ds[i]);
    T._cmHH = m;
    return m;
};

/* ==========================================================================
   CỬA DUY NHẤT SINH MÃ HÀNG VÀ TẠO MẶT HÀNG
   --------------------------------------------------------------------------
   MÃ HÀNG là mã nội bộ của doanh nghiệp, do HỆ THỐNG TỰ SINH theo MỘT quy tắc
   thống nhất cho toàn phần mềm. Người dùng KHÔNG nhập tay Mã hàng ở bất kỳ đâu.
   MODEL là mã của NHÀ SẢN XUẤT, do người dùng nhập, BẮT BUỘC, và ĐƯỢC PHÉP
   TRÙNG giữa các mặt hàng khác tên · khác thông số · khác cấu hình.

   Mọi phân hệ — Bảng giá, Nhập hàng, Báo giá, Đơn bán, Hợp đồng, nhập Excel,
   nhập dữ liệu lịch sử — đều phải tạo mặt hàng qua T.taoHangHoa(). Không phân
   hệ nào được tự dựng bản ghi hàng hóa và tự đặt mã.
   ========================================================================== */

/* Giá trị mặc định của hai trường mô tả bắt buộc trong hồ sơ tối thiểu. */
T.NHOM_MAC_DINH = 'Thiết bị khác';
T.HANG_MAC_DINH = 'Chưa xác định';

/** Tiền tố Mã hàng nội bộ — dùng chung cho toàn hệ thống. */
T.TIEN_TO_MA_HANG = 'HH-';

/** Mã hàng nội bộ của một số hiệu nội bộ — quy tắc DUY NHẤT của phần mềm. */
T.maHangTuSo = function (soNoiBo) {
    return T.TIEN_TO_MA_HANG + String(soNoiBo || '');
};
/** Mã hàng có đúng quy tắc của hệ thống hay không. */
T.maHangChuan = function (ma) {
    return /^HH-\d{6,}$/.test(String(ma || '').trim());
};

/**
 * KIỂM TRA DỮ LIỆU BẮT BUỘC CỦA MỘT MẶT HÀNG.
 * Trả về chuỗi lỗi đọc được, hoặc '' nếu hợp lệ.
 */
T.soatMatHang = function (o) {
    if (!o) return 'Thiếu dữ liệu mặt hàng.';
    if (!String(o.model || '').trim())
        return 'Model là trường bắt buộc — nhập đúng Model của nhà sản xuất.';
    if (!String(o.ten || '').trim())
        return 'Tên hàng hóa là trường bắt buộc.';
    return '';
};

/**
 * TẠO MỘT MẶT HÀNG MỚI TRONG DANH MỤC — CỬA DUY NHẤT CỦA TOÀN HỆ THỐNG.
 * Tự cấp Số hiệu nội bộ và Mã hàng theo quy tắc thống nhất; giữ nguyên Model,
 * Tên hàng, Thông số kỹ thuật và Đơn vị tính do người dùng khai.
 * Mặt hàng đã có (trùng Model + Tên + Thông số) thì trả về đúng bản ghi cũ,
 * KHÔNG bao giờ tạo bản ghi thứ hai cho cùng một mặt hàng.
 * Trả về bản ghi hàng hóa, hoặc null nếu dữ liệu chưa đủ.
 */
T.taoHangHoa = function (o) {
    if (T.soatMatHang(o)) return null;
    var da = T.chiMucHangHoa().bo[T.khoaHH(o)];
    if (da) return da;                                  // đã có — dùng lại, không nhân đôi
    var r = {}, k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k];
    r.model = String(o.model || '').trim();
    r.ten = String(o.ten || '').trim();
    r.dvt = String(o.dvt || '').trim() || 'Cái';
    r.thongSo = String(o.thongSo || '').trim();
    r.quyCach = String(o.quyCach || '').trim();
    /* Mã cũ / mã của hãng ghi vào MÃ KHÁC để tra cứu và đối chiếu tệp, KHÔNG
       bao giờ trở thành Mã hàng. */
    r.maKhac = T.maKhacTu(o.maKhac, r.model);
    r.hang = String(o.hang || o.nhaSanXuat || '').trim();
    r.nhaSanXuat = r.hang; r.thuongHieu = o.thuongHieu || r.hang;
    /* SÁU TRƯỜNG TỐI THIỂU của một mặt hàng: Mã hàng nội bộ · Model · Tên hàng ·
       Đơn vị tính · Nhóm hàng · Hãng. Nhóm hàng và Hãng chưa khai thì điền mặc
       định để mặt hàng nào cũng đủ hồ sơ, người dùng sửa lại sau lúc nào cũng
       được — không vì thiếu hai trường mô tả mà chặn cả luồng nhập tệp. */
    r.nhom = String(o.nhom || '').trim() || T.NHOM_MAC_DINH;
    if (!r.hang) { r.hang = T.HANG_MAC_DINH; r.nhaSanXuat = r.hang; r.thuongHieu = r.hang; }
    r.xuatXu = o.xuatXu || ''; r.anh = o.anh || ''; r.ghiChu = o.ghiChu || '';
    r.barcode = o.barcode || ''; r.qrCode = o.qrCode || '';
    r.theoDoiTon = o.theoDoiTon === undefined ? true : !!o.theoDoiTon;
    r.theoDoiSerial = !!o.theoDoiSerial;
    r.theoDoiLo = !!o.theoDoiLo;
    r.tonToiThieu = Number(o.tonToiThieu) || 0;
    r.trangThai = o.trangThai || 'Đang kinh doanh';
    r.ton = Number(o.ton) || 0; r.tonDau = Number(o.tonDau) || 0;
    r.giaVon = Number(o.giaVon) || 0; r.giaVonBQ = Number(o.giaVonBQ) || 0;
    r.plId = o.plId || '';
    /* SỐ HIỆU NỘI BỘ và MÃ HÀNG do hệ thống cấp — cấp trước khi thêm để chỉ mục
       hàng hóa cập nhật ngay trong lần thêm đó. */
    r.maNoiBo = T.soNoiBoMoi();
    r.ma = T.maHangTuSo(r.maNoiBo);
    delete r.id;
    delete r.giaPP; delete r.giaDL; delete r.giaBL;
    return DB.insert('hangHoa', r);
};

/* ==========================================================================
   MODEL GỐC VÀ BIẾN THỂ                                  (v18.5.0 — mục 4)
   --------------------------------------------------------------------------
   Cùng một mặt hàng được ghi khác nhau ở mỗi nguồn:

       Danh mục   JB-QBL-A104E
       Nhập hàng  JB-QBL-A104E (2loop)
       Bảng giá   JB-QBL-A104E 2L
       Báo giá    JB-QBL-A104E - 2L

   Cả bốn phải trỏ về CÙNG MỘT mặt hàng, và cách ghi gốc của từng nguồn phải
   được giữ nguyên trên chính chứng từ của nguồn đó.

   CÁCH LÀM — KHÔNG ĐOÁN MỘT CHỮ NÀO:
   Phần mềm KHÔNG tự nghĩ ra quy tắc cắt hậu tố (cắt theo dấu gạch, theo số,
   theo chữ...) vì mọi quy tắc như vậy đều sai với một Model nào đó: cắt
   "JB-QBL-A220E100" ở dấu gạch sẽ ra "JB-QBL" — vô nghĩa.

   Thay vào đó, MODEL GỐC LUÔN LÀ MỘT MODEL ĐÃ CÓ THẬT TRONG DANH MỤC.
   Một chuỗi được coi là "Model gốc + biến thể" khi và chỉ khi:
       · phần đầu của chuỗi đúng bằng Model của một mặt hàng đang có; VÀ
       · phần còn lại bắt đầu bằng một dấu ngăn cách thật ( khoảng trắng,
         gạch ngang, ngoặc, gạch chéo, dấu chấm, dấu phẩy ).
   Khi có nhiều Model là phần đầu, lấy Model DÀI NHẤT — đó là cách duy nhất
   không cướp mất một mặt hàng cụ thể hơn.

   Nhờ vậy hệ thống không bao giờ bịa ra một "model gốc" không tồn tại, và
   một mặt hàng mới hoàn toàn vẫn được nhận ra là mới.
   ========================================================================== */

/** Ký tự được coi là ranh giới giữa Model gốc và phần biến thể. */
T.NGAN_BIEN_THE = [' ', '-', '(', '[', '/', '.', ',', '+', '_'];

/**
 * Tách một chuỗi Model thành { goc, bienThe, hh }.
 * hh là mặt hàng mang Model gốc đó — luôn là mặt hàng CÓ THẬT trong Danh mục.
 * Không tách được thì trả về null (chuỗi này không phải biến thể của hàng nào).
 */
T.tachBienThe = function (chuoi) {
    var s = String(chuoi || '').trim();
    if (!s) return null;
    var m = T.chiMucHangHoa();
    var ks = T.kd(s);
    var tot = null;
    /* Duyệt theo Model đã có — số Model luôn nhỏ hơn nhiều so với số phép thử
       cắt chuỗi, và cách này bảo đảm gốc luôn là Model có thật. */
    Object.keys(m.modelDs || {}).forEach(function (kg) {
        if (!kg || kg.length < 3) return;              /* Model quá ngắn: không dùng làm gốc */
        if (ks === kg) return;                          /* trùng khít đã có nhánh riêng xử lý */
        if (ks.indexOf(kg) !== 0) return;               /* không phải phần đầu */
        var duoi = s.substr(kg.length);                 /* cắt trên chuỗi GỐC để giữ nguyên văn */
        if (!duoi) return;
        if (T.NGAN_BIEN_THE.indexOf(duoi.charAt(0)) < 0) return;  /* phải có ranh giới thật */
        if (!tot || kg.length > tot.kg.length) tot = { kg: kg, duoi: duoi };
    });
    if (!tot) return null;
    var ds = m.modelDs[tot.kg] || [];
    return { goc: (ds[0] && ds[0].model) || tot.kg,
             bienThe: tot.duoi.replace(/^[\s\-_+.,\/]+/, '').replace(/[()\[\]]/g, '').trim(),
             nguyenVan: s, ds: ds, hh: ds.length === 1 ? ds[0] : null };
};

/**
 * NHẬN DIỆN THEO MODEL GỐC — trả về đúng ba kết luận, không bao giờ trả rỗng
 * một cách mập mờ:
 *   { hh }            → chắc chắn là mặt hàng này
 *   { nhieu: [...] }  → có ứng viên nhưng CHƯA ĐỦ CĂN CỨ, phải hỏi người dùng
 *   null              → không liên quan tới mặt hàng nào đang có
 */
T.theoModelGoc = function (o) {
    var t = T.tachBienThe((o && (o.model || o.ma || o.maHang)) || '');
    if (!t) return null;
    var kten = T.kd(String((o && (o.ten || o.tenHang)) || ''));
    /* Model gốc trỏ tới ĐÚNG MỘT mặt hàng → đúng yêu cầu: khác hậu tố vẫn là
       cùng một mặt hàng, không được đẻ thêm bản ghi mới. */
    if (t.ds.length === 1) {
        var h = t.ds[0];
        if (!kten || T.kd(h.ten || '') === kten)
            return { hh: h, theo: 'Model gốc + biến thể', bienThe: t.bienThe, goc: t.goc };
        /* Tên hàng khác hẳn → có thể là mặt hàng khác thật. KHÔNG tự quyết. */
        return { hh: null, nhieu: t.ds, theo: 'Model gốc trùng nhưng Tên hàng khác',
                 bienThe: t.bienThe, goc: t.goc };
    }
    /* Nhiều mặt hàng cùng Model gốc → thu hẹp bằng Tên hàng nếu có. */
    if (kten) {
        var loc = t.ds.filter(function (h2) { return T.kd(h2.ten || '') === kten; });
        if (loc.length === 1)
            return { hh: loc[0], theo: 'Model gốc + Tên hàng', bienThe: t.bienThe, goc: t.goc };
        if (loc.length > 1)
            return { hh: null, nhieu: loc, theo: 'Model gốc + Tên hàng', bienThe: t.bienThe, goc: t.goc };
    }
    return { hh: null, nhieu: t.ds, theo: 'Model gốc', bienThe: t.bienThe, goc: t.goc };
};

/**
 * ALIAS ĐỤNG ĐỘ — một chuỗi Mã khác trỏ tới nhiều mặt hàng, hoặc trùng đúng
 * Model thật của một mặt hàng khác. Trong hai trường hợp đó, alias KHÔNG được
 * dùng để kết luận; nó chỉ được dùng để đưa ra danh sách ứng viên.
 */
T.aliasDungDo = function () {
    if (T._aliasDD && T._aliasDD.n === DB.all('hangHoa').length) return T._aliasDD;
    var theoAlias = {}, theoModel = {};
    DB.all('hangHoa').forEach(function (h) {
        var km = T.kd(h.model || '');
        if (km) (theoModel[km] = theoModel[km] || []).push(h.id);
        (h.maKhac || []).forEach(function (a) {
            var k = T.kd(a);
            if (k) (theoAlias[k] = theoAlias[k] || []).push(h.id);
        });
    });
    var xau = {};
    Object.keys(theoAlias).forEach(function (k) {
        var nhieuHang = theoAlias[k].length > 1;
        var laModelCuaHangKhac = !!theoModel[k] &&
            theoModel[k].some(function (id) { return theoAlias[k].indexOf(id) < 0; });
        if (nhieuHang || laModelCuaHangKhac)
            xau[k] = { hang: theoAlias[k], nhieuHang: nhieuHang,
                       laModelCua: theoModel[k] || [], lyDo: nhieuHang
                           ? 'Một mã khác đang trỏ tới ' + theoAlias[k].length + ' mặt hàng'
                           : 'Mã khác này chính là Model thật của một mặt hàng khác' };
    });
    T._aliasDD = { n: DB.all('hangHoa').length, xau: xau,
                   so: Object.keys(xau).length };
    return T._aliasDD;
};
T.aliasAnToan = function (chuoi) {
    var k = T.kd(chuoi || '');
    return !!k && !T.aliasDungDo().xau[k];
};

/**
 * NHẬN DIỆN MỘT MẶT HÀNG — CHỈ THEO MODEL + TÊN HÀNG.
 * --------------------------------------------------------------------------
 * Đây là bộ nhận diện nghiệp vụ DUY NHẤT của toàn hệ thống, dùng chung cho mọi
 * luồng nhập liệu và mọi bộ nhập tệp Excel, để cùng một dữ liệu luôn cho ra
 * cùng một kết luận.
 *
 * QUY TẮC:
 *   · Căn cứ nhận diện là MODEL của nhà sản xuất và TÊN HÀNG. Mã hàng nội bộ
 *     (HH-xxxxxx) CHỈ là khóa hệ thống — KHÔNG BAO GIỜ dùng làm dữ liệu nhận
 *     diện khi nhập tệp; người dùng không phải biết và không phải ghi nhớ nó.
 *   · Mã cũ của doanh nghiệp và mã của hãng (Mã khác) là các cách viết khác của
 *     chính Model nên vẫn tra ra đúng mặt hàng.
 *   · Thông số kỹ thuật chỉ dùng để TÁCH khi Model + Tên hàng còn trùng nhau.
 *
 * Trả về { hh, theo, nhieu }:
 *   · hh    — mặt hàng tìm được, null nếu chưa có trong Danh mục.
 *   · theo  — căn cứ nhận diện, để hiển thị cho người dùng.
 *   · nhieu — mảng các mặt hàng còn trùng khi KHÔNG tách được. Chỉ trường hợp
 *             này mới phải hỏi người dùng; ngoài ra tuyệt đối không hỏi.
 */
T.timMatHang = function (o, tuyChon) {
    var m = T.chiMucHangHoa();
    var model = String((o && (o.model || o.ma || o.maHang)) || '').trim();
    var ten = String((o && (o.ten || o.tenHang)) || '').trim();
    var kmodel = T.kd(model), kten = T.kd(ten);
    var kts = T.kd(String((o && (o.thongSo || o.quyCach)) || ''));

    function tach(ds, theo) {
        if (!ds.length) return null;
        if (ds.length === 1) return { hh: ds[0], theo: theo, nhieu: null };
        /* Còn trùng thì thử tách bằng Thông số kỹ thuật / Quy cách. */
        if (kts) {
            var ds2 = ds.filter(function (h) {
                return T.kd(String(h.thongSo || h.quyCach || '')) === kts;
            });
            if (ds2.length === 1)
                return { hh: ds2[0], theo: theo + ' + Thông số kỹ thuật', nhieu: null };
            if (ds2.length > 1) ds = ds2;
        }
        return { hh: null, theo: theo, nhieu: ds };
    }

    /* 1. Khớp đủ Model + Tên hàng + Thông số → chắc chắn cùng một mặt hàng. */
    var kb = T.khoaHH(o);
    if (kb && m.bo[kb])
        return { hh: m.bo[kb], theo: 'Model + Tên hàng + Thông số kỹ thuật', nhieu: null };

    /* MODEL THẬT trước, MÃ KHÁC chỉ khi Model thật không ra gì. Mã khác là mã
       cũ / mã hãng đời trước; để chúng đứng ngang hàng với Model sẽ đẻ ra ứng
       viên giả và làm hệ thống hỏi người dùng trong khi dữ liệu đã đủ rõ. */
    var cung = kmodel ? (m.modelDs[kmodel] || []) : [];
    /* ALIAS ĐỤNG ĐỘ KHÔNG ĐƯỢC DÙNG ĐỂ KẾT LUẬN (v18.5.0).
       Một chuỗi Mã khác trỏ tới nhiều mặt hàng, hoặc chính là Model thật của
       một mặt hàng khác, thì dùng nó để chốt là gắn nhầm hàng. Những chuỗi như
       vậy chỉ còn giá trị đưa ra ứng viên để hỏi người dùng. */
    var khacThoRaw = kmodel ? ((m.khacDs && m.khacDs[kmodel]) || []) : [];
    var aliasXau = kmodel && !T.aliasAnToan(kmodel);
    var cungKhac = aliasXau ? [] : khacThoRaw;

    /* 2. MODEL + TÊN HÀNG — căn cứ nghiệp vụ chính. */
    if (kmodel && kten) {
        var kq = null;
        if (cung.length)
            kq = tach(cung.filter(function (h) { return T.kd(h.ten || '') === kten; }),
                      'Model + Tên hàng');
        if (!kq && cungKhac.length)
            kq = tach(cungKhac.filter(function (h) { return T.kd(h.ten || '') === kten; }),
                      'Mã khác + Tên hàng');
        if (kq) return kq;
    }

    /* 3. Tệp chỉ có Model, không có Tên hàng. */
    if (kmodel && !kten) {
        var kq2 = (cung.length ? tach(cung, 'Model') : null) ||
                  (cungKhac.length ? tach(cungKhac, 'Mã khác') : null);
        if (kq2) return kq2;
    }

    /* 4. Tệp chỉ có Tên hàng, không có Model. */
    if (!kmodel && kten) {
        var kq3 = tach((m.tenDs[kten] || []).slice(), 'Tên hàng');
        if (kq3) return kq3;
    }

    /* 5. NHẬN THEO MÃ khi nơi gọi CHỈ GẮN GIÁ, không tạo mặt hàng.
          Tệp bảng giá của hãng thường viết tên hàng khác hẳn tên trong Danh mục
          (viết tắt, tiếng Anh, thêm hậu tố). Model trỏ tới ĐÚNG MỘT mặt hàng thì
          vẫn là mặt hàng đó. Luồng có thể TẠO mặt hàng không dùng đường này —
          ở đó, tên khác nghĩa là mặt hàng khác. */
    if ((tuyChon && tuyChon.nhanTheoMa) && kmodel) {
        if (cung.length === 1) return { hh: cung[0], theo: 'Model', nhieu: null };
        if (!cung.length && cungKhac.length === 1)
            return { hh: cungKhac[0], theo: 'Mã khác', nhieu: null };
    }

    /* 6. MODEL GỐC + BIẾN THỂ — "ABC (2loop)", "ABC 2L", "ABC-2L" đều phải về
          đúng mặt hàng ABC. Gốc luôn là một Model CÓ THẬT trong Danh mục nên
          bước này không bịa ra mặt hàng nào. */
    var mg = T.theoModelGoc(o);
    if (mg && mg.hh) return { hh: mg.hh, theo: mg.theo, nhieu: null,
                              bienThe: mg.bienThe, modelGoc: mg.goc };
    if (mg && mg.nhieu && mg.nhieu.length)
        return { hh: null, theo: mg.theo, nhieu: mg.nhieu,
                 bienThe: mg.bienThe, modelGoc: mg.goc };

    /* 7. ALIAS ĐỤNG ĐỘ — không đủ căn cứ để chốt, nhưng cũng KHÔNG được im
          lặng coi là hàng mới. Đưa ra ứng viên để người dùng quyết định. */
    if (aliasXau && khacThoRaw.length)
        return { hh: null, theo: 'Mã khác trùng nhiều mặt hàng — cần xác minh',
                 nhieu: khacThoRaw.slice() };

    return { hh: null, theo: '', nhieu: null };
};

/**
 * TRA KHÓA HỆ THỐNG — KHÔNG PHẢI NHẬN DIỆN NGHIỆP VỤ.
 *
 * Mã hàng nội bộ (HH-100001…) do phần mềm tự sinh. Tệp của nhà cung cấp không
 * bao giờ có nó và người dùng không phải nhớ nó, nên nó KHÔNG tham gia bộ nhận
 * diện nghiệp vụ — việc đó chỉ đi bằng Model + Tên hàng.
 *
 * Nhưng khi một dòng mang đúng khóa ấy — tệp vừa kết xuất từ chính phần mềm rồi
 * nhập lại, hoặc dữ liệu nội bộ chuyển giữa hai máy — thì tra khóa ra bản ghi là
 * việc của khóa, không phải đoán. Nếu bỏ qua, Business Engine sẽ coi đó là mặt
 * hàng chưa có và TỰ TẠO một bản ghi mới mang Model là "HH-100001": vừa sai dữ
 * liệu, vừa sinh hàng trùng — đúng điều phải tránh.
 */
T.theoMaNoiBo = function (o) {
    if (!o) return null;
    var m = T.chiMucHangHoa();
    /* Số hiệu nội bộ TRẦN (100001) chỉ được chấp nhận từ ĐÚNG trường maNoiBo do
       phần mềm ghi ra. Một con số trần trong cột mã của tệp nhà cung cấp là mã
       của hãng, không phải khóa của phần mềm — nhận nhầm là gắn sai mặt hàng. */
    var sn = String(o.maNoiBo === undefined || o.maNoiBo === null ? '' : o.maNoiBo).trim();
    if (sn && m.soNoiBo[sn]) return m.soNoiBo[sn];
    var ds = [o.ma, o.maHang, o.model], i, v, h;
    for (i = 0; i < ds.length; i++) {
        v = String(ds[i] === undefined || ds[i] === null ? '' : ds[i]).trim();
        if (!v || !T.maHangChuan(v)) continue;               // không đúng dạng khóa hệ thống
        h = m.ma[T.kd(v)];
        if (h && h !== 'nhieu') return h;
    }
    return null;
};

/**
 * CỬA DUY NHẤT ĐỂ TÌM MẶT HÀNG KHI NHẬP TỆP.
 * Thứ tự đúng theo nghiệp vụ:
 *   1. Dòng mang khóa hệ thống của chính phần mềm → tra khóa, xong.
 *   2. Còn lại: nhận diện nghiệp vụ bằng Model + Tên hàng (+ Thông số kỹ thuật).
 * Trả về cùng dạng { hh, theo, nhieu } nên mọi nơi gọi đều dùng như nhau.
 */
T.nhanDienHangHoa = function (o, tuyChon) {
    var k = T.theoMaNoiBo(o);
    if (k) return { hh: k, theo: 'Mã hàng nội bộ (khóa hệ thống)', nhieu: null };
    return T.timMatHang(o, tuyChon);
};

/* ---------------------------------------------------------- BẢNG GIÁ BÁN */
/** Các bảng giá bán còn hiệu lực tại một ngày. */
T.bangGiaHieuLuc = function (ngay) {
    ngay = ngay || T.today();
    var ds = DB.all('bangGiaBan').filter(function (b) {
        return b.trangThai === 'Đang áp dụng' &&
            (!b.tuNgay || b.tuNgay <= ngay) && (!b.denNgay || b.denNgay >= ngay);
    });
    /* Một bảng giá có nhiều PHIÊN BẢN: tại một ngày chỉ lấy phiên bản mới nhất
       còn hiệu lực của mỗi mã bảng giá. Toàn bộ phiên bản cũ vẫn được giữ trong
       cơ sở dữ liệu để tra lịch sử và để chứng từ cũ giữ nguyên giá. */
    var m = {};
    ds.forEach(function (b) {
        /* Mô hình mới: mỗi NHÀ CUNG CẤP / HÃNG chỉ có một phiên bản còn hiệu lực
           tại một thời điểm. Các phiên bản của cùng một hãng dùng chung mã bảng
           giá (hệ thống tự đặt theo tên hãng khi nhập tệp). */
        var k = b.ma || b.nhaCungCap || b.id;
        var cu = m[k];
        if (!cu) { m[k] = b; return; }
        var a = (b.tuNgay || '') + '|' + ('000' + (Number(b.phienBan) || 1)).slice(-4);
        var c = (cu.tuNgay || '') + '|' + ('000' + (Number(cu.phienBan) || 1)).slice(-4);
        if (a > c) m[k] = b;
    });
    return Object.keys(m).map(function (k) { return m[k]; });
};
/** Phiên bản bảng giá có hiệu lực tại một ngày, theo mã bảng giá. */
T.phienBanHieuLuc = function (maBangGia, ngay) {
    return T.bangGiaHieuLuc(ngay).filter(function (b) { return b.ma === maBangGia; })[0] || null;
};
/** Toàn bộ lịch sử giá của một mặt hàng theo mọi phiên bản bảng giá. */
T.lichSuGiaBan = function (hang) {
    var ds = [];
    var idH = T.idHH(hang);
    var maH = T.kd(typeof hang === 'object' ? (hang.ma || hang.maHang || '') : hang);
    DB.all('bangGiaBan').forEach(function (b) {
        var o = T.traBang(b.bang, hang);
        var g = T.traBang(b.gia, hang);
        /* Phiên bản nhập trước khi mặt hàng được khai vào Danh mục thì dòng chưa
           liên kết — vẫn tra được lịch sử giá theo MÃ HÀNG ghi trong tệp. */
        if (!o && g === undefined && maH) {
            var gom = {};
            T.dongBangGia(b).forEach(function (d) {
                if (d.hangHoaId ? d.hangHoaId !== idH : T.kd(d.ma || '') !== maH) return;
                Object.keys(d.gia || {}).forEach(function (c) {
                    var v2 = Number(d.gia[c]) || 0;
                    if (v2 > (gom[c] || 0)) gom[c] = v2;
                });
            });
            if (Object.keys(gom).length) o = gom;
        }
        if (!o && g === undefined) return;
        var cot = (b.cotGia && b.cotGia.length) ? b.cotGia : ['Giá bán'];
        cot.forEach(function (c) {
            var v = o ? Number(o[c]) : (c === (b.cotChinh || cot[0]) ? Number(g) : 0);
            if (!(v > 0)) return;
            ds.push({ bangGiaId: b.id, maBangGia: b.ma, tenBangGia: b.ten,
                      phienBan: Number(b.phienBan) || 1, tuNgay: b.tuNgay, denNgay: b.denNgay || '',
                      nhaCungCap: b.nhaCungCap || '', loaiGia: c, gia: Math.round(v),
                      trangThai: b.trangThai });
        });
    });
    return ds.sort(function (a, b) {
        if (a.tuNgay !== b.tuNgay) return a.tuNgay < b.tuNgay ? -1 : 1;
        return (a.phienBan - b.phienBan) || (a.loaiGia < b.loaiGia ? -1 : 1);
    });
};
/** Đơn giá bán của một mã hàng theo một bảng giá, tại một ngày. */
T.giaBan = function (hang, bangGiaId, ngay) {
    var b = DB.get('bangGiaBan', bangGiaId);
    if (!b) return 0;
    var g = T.traBang(b.gia, hang);
    return g === undefined ? 0 : Math.round(Number(g) || 0);
};

/* ---------------------------------------- CHÍNH SÁCH GIÁ THEO ĐƠN VỊ PHÁT HÀNH
   Mỗi đơn vị phát hành tự cấu hình: dùng cột giá nào của bảng giá, chiết khấu
   mặc định bao nhiêu (% hoặc số tiền) và quy tắc làm tròn. Không lập trình cố
   định bất kỳ cột giá hay mức chiết khấu nào — quản trị đổi lúc nào cũng được.
   -------------------------------------------------------------------------- */
/* Bậc giá của khách hàng ứng với CỘT GIÁ nào trong phiên bản bảng giá.
   Mô hình mới: mỗi phiên bản chứa toàn bộ cột giá, không tách thành nhiều bảng. */
/* ==========================================================================
   DANH MỤC LOẠI GIÁ — DO DOANH NGHIỆP TỰ KHAI
   --------------------------------------------------------------------------
   Loại giá KHÔNG cắm cứng trong chương trình. Doanh nghiệp tự thêm bao nhiêu
   loại giá cũng được (Giá phân phối · Giá đại lý · Giá bán lẻ · Giá dự án ·
   Giá đặc biệt · Giá xuất khẩu · Giá công trình trọng điểm…) mà không phải sửa
   một dòng mã nguồn nào. Bộ dưới đây chỉ là bộ KHAI SẴN cho lần chạy đầu.
   ========================================================================== */
T.LOAI_GIA_MAC_DINH = [
    { ma: 'PP', ten: 'Giá phân phối', thuTu: 1, moTa: 'Giá bán cho nhà phân phối' },
    { ma: 'DL', ten: 'Giá đại lý', thuTu: 2, moTa: 'Giá bán cho đại lý' },
    { ma: 'BL', ten: 'Giá bán lẻ', thuTu: 3, moTa: 'Giá bán lẻ đến người dùng cuối' },
    { ma: 'DA', ten: 'Giá dự án', thuTu: 4, moTa: 'Giá áp dụng cho dự án, công trình' },
    { ma: 'DB', ten: 'Giá đặc biệt', thuTu: 5, moTa: 'Giá thỏa thuận riêng theo từng thương vụ' }
];

/** Danh mục Loại giá đang dùng, đã sắp thứ tự. */
T.dsLoaiGia = function () {
    return DB.all('loaiGia')
        .filter(function (x) { return x.trangThai !== 'Ngừng dùng'; })
        .slice()
        .sort(function (a, b) { return (Number(a.thuTu) || 99) - (Number(b.thuTu) || 99); });
};
/** Tên các loại giá đang khai trong danh mục. */
T.tenLoaiGia = function () {
    return T.dsLoaiGia().map(function (x) { return x.ten; });
};
/** Một tên loại giá đã có trong danh mục chưa. */
T.loaiGiaTheoTen = function (ten) {
    var k = T.kd(ten || '');
    if (!k) return null;
    return DB.all('loaiGia').filter(function (x) { return T.kd(x.ten) === k; })[0] || null;
};
/**
 * GHI NHẬN LOẠI GIÁ MỚI ĐỌC ĐƯỢC TỪ TỆP.
 * Tệp của nhà cung cấp có cột giá chưa có trong danh mục thì hệ thống tự khai
 * bổ sung — người dùng không phải khai trước rồi mới nhập được tệp.
 */
T.themLoaiGiaTuTep = function (ds) {
    var them = [];
    (ds || []).forEach(function (ten) {
        var t = String(ten || '').trim();
        if (!t || T.loaiGiaTheoTen(t)) return;
        var n = DB.all('loaiGia').length;
        DB.data.loaiGia.push({
            id: T.uid('LG'), ma: 'LG' + ('00' + (n + 1)).slice(-2), ten: t,
            thuTu: 50 + n, moTa: 'Tự khai khi nhập tệp bảng giá',
            trangThai: 'Đang dùng', _tao: T.now()
        });
        them.push(t);
    });
    return them;
};

/* Bộ cột giá chuẩn — GIỮ LẠI CHO TƯƠNG THÍCH, nguồn thật là danh mục Loại giá. */
T.COT_CHUAN = ['Giá phân phối', 'Giá đại lý', 'Giá bán lẻ', 'Giá dự án', 'Giá đặc biệt'];
T.COT_THEO_BAC = {
    DUAN: 'Giá dự án', DAILY: 'Giá đại lý', BANLE: 'Giá bán lẻ',
    TRUCTIEP: 'Giá bán trực tiếp', PHANPHOI: 'Giá phân phối', DACBIET: 'Giá đặc biệt'
};
/**
 * CÁC MỨC GIÁ (CỘT GIÁ) MÀ MỘT PHIÊN BẢN BẢNG GIÁ ĐANG CÓ.
 * Phiên bản bảng giá chỉ xác định nhà cung cấp, số phiên bản, ngày hiệu lực,
 * danh mục hàng hóa và CÁC CỘT GIÁ hiện có — không tự quyết mức giá nào được
 * dùng khi lập chứng từ.
 */
/* ==========================================================================
   BẢNG GIÁ — MỘT DÒNG EXCEL LÀ MỘT DÒNG TVERP
   --------------------------------------------------------------------------
   Bảng giá là HỒ SƠ KINH DOANH của doanh nghiệp, không phải danh mục. Vì vậy
   dữ liệu gốc của một phiên bản bảng giá là MẢNG DÒNG b.dong[]: mỗi dòng của
   tệp Excel thành đúng một dòng ở đây, giữ nguyên thứ tự và giữ nguyên số
   dòng — không gộp, không nhân đôi, không loại bỏ, không sửa, không tự sinh.

   Model KHÔNG phải khóa: hai dòng cùng Model nhưng khác tên hàng hoặc khác
   thông số là hai mặt hàng khác nhau, và cả hai đều được giữ.

   Hai bảng b.bang và b.gia chỉ là CHỈ MỤC TRA NHANH dựng lại từ b.dong để
   lập chứng từ, không phải nguồn dữ liệu.
   ========================================================================== */
T.DONG_BG_TRUONG = ['hangHoaId', 'ma', 'model', 'ten', 'dvt', 'thongSo',
                    'nhom', 'hang', 'ghiChu', 'gia', 'dongExcel'];

/** Mảng dòng gốc của một phiên bản bảng giá. */
T.dongBangGia = function (b) { return (b && b.dong) || []; };

/**
 * Dựng lại b.dong cho phiên bản đời cũ chỉ có chỉ mục b.bang / b.gia.
 * Mỗi khóa của chỉ mục thành đúng một dòng — dữ liệu cũ không mất mát.
 */
T.dungDongBangGia = function (b) {
    if (!b || b.dong) return false;
    var ds = [], da = {}, i = 0;
    var bang = b.bang || {}, gia = b.gia || {}, gc = b.gc || {};
    function them(k) {
        if (da[k]) return;
        da[k] = 1; i++;
        /* Khóa của bảng giá đời cũ có thể là ID nội bộ, số hiệu nội bộ, Mã ERP
           hoặc Model. Nối lại về ĐÚNG ID NỘI BỘ của mặt hàng — từ đây bảng giá
           chỉ còn liên kết bằng ID, không liên kết bằng mã hay tên. */
        var hh = DB.get('hangHoa', T.idHH(k));
        var g = {};
        var o = bang[k];
        if (o) Object.keys(o).forEach(function (c) { if (Number(o[c]) > 0) g[c] = Number(o[c]); });
        if (!Object.keys(g).length && Number(gia[k]) > 0) g[b.cotChinh || 'Giá bán'] = Number(gia[k]);
        ds.push({
            /* Chưa tra ra mặt hàng thì ĐỂ TRỐNG liên kết — dòng vẫn được giữ
               nguyên trong bảng giá nhưng không được vào chỉ mục tra giá. */
            hangHoaId: hh ? hh.id : '',
            ma: hh ? (hh.ma || '') : String(k === undefined ? '' : k),
            model: hh ? (hh.model || hh.ma || '') : '',
            ten: hh ? (hh.ten || '') : ((b.ngungLienKet || {})[k] || {}).ten || '',
            dvt: hh ? (hh.dvt || '') : '', thongSo: hh ? (hh.thongSo || '') : '',
            nhom: hh ? (hh.nhom || '') : '', hang: hh ? (hh.hang || hh.nhaSanXuat || '') : '',
            ghiChu: gc[k] || '', gia: g, dongExcel: i
        });
    }
    Object.keys(bang).forEach(them);
    Object.keys(gia).forEach(them);
    b.dong = ds;
    return true;
};

/**
 * Dựng lại CHỈ MỤC TRA NHANH từ mảng dòng gốc.
 * Nhiều dòng cùng trỏ về một mặt hàng thì chỉ mục ghép theo TỪNG CỘT GIÁ, dòng
 * sau bổ sung cột mà dòng trước chưa có — chỉ mục không bao giờ làm mất giá.
 * Mảng dòng gốc vẫn giữ nguyên đủ số dòng.
 */
T.dungChiMucBG = function (b) {
    if (!b) return b;
    var bang = {}, gia = {}, gc = {};
    var cot = {};
    (b.dong || []).forEach(function (d) {
        var k = d.hangHoaId;
        if (!k) return;
        bang[k] = bang[k] || {};
        Object.keys(d.gia || {}).forEach(function (c) {
            /* Nhiều dòng cùng trỏ về một mặt hàng: DÒNG ĐẦU GIỮ GIÁ, dòng sau chỉ
               bổ sung cột mà dòng trước chưa có — chỉ mục không bao giờ làm mất
               giá và cũng không âm thầm đổi giá khi nhập bổ sung. */
            if (!(Number(d.gia[c]) > 0)) return;
            cot[c] = 1;
            if (!(Number(bang[k][c]) > 0)) bang[k][c] = Number(d.gia[c]);
        });
        if (d.ghiChu) gc[k] = d.ghiChu;
    });
    var dsCot = (b.cotGia || []).filter(function (c) { return c; });
    Object.keys(cot).forEach(function (c) { if (dsCot.indexOf(c) < 0) dsCot.push(c); });
    var chinh = (b.cotChinh && dsCot.indexOf(b.cotChinh) >= 0) ? b.cotChinh : dsCot[0] || '';
    Object.keys(bang).forEach(function (k) {
        if (Number(bang[k][chinh]) > 0) gia[k] = Number(bang[k][chinh]);
    });
    b.bang = bang; b.gia = gia; b.gc = gc;
    b.cotGia = dsCot; b.cotChinh = chinh;
    b.soDong = (b.dong || []).length;
    b.soMatHang = Object.keys(bang).length;
    return b;
};

T.cotGiaCua = function (b) {
    if (!b) return [];
    var ds = (b.cotGia || []).filter(function (c) { return c; });
    if (ds.length) return ds;
    /* Phiên bản đời cũ chưa khai cột giá: đọc thẳng từ dữ liệu giá đang lưu. */
    var co = {}, bang = b.bang || {}, k;
    for (k in bang) {
        var o = bang[k]; if (!o) continue;
        for (var c in o) if (Number(o[c]) > 0) co[c] = 1;
    }
    ds = Object.keys(co);
    if (!ds.length && b.gia && Object.keys(b.gia).length) ds = [b.cotChinh || 'Giá bán'];
    return ds;
};

/** Mức giá GỢI Ý cho một chứng từ — chỉ để chọn sẵn, người dùng vẫn đổi được. */
T.mucGiaGoiY = function (b, kh, donViId) {
    var ds = T.cotGiaCua(b);
    if (!ds.length) return '';
    if (ds.length === 1) return ds[0];
    if (kh) { var c = T.cotGiaKhach(kh, donViId, b); if (ds.indexOf(c) >= 0) return c; }
    var cs = T.chinhSachGia(donViId);
    if (cs.cotGia && ds.indexOf(cs.cotGia) >= 0) return cs.cotGia;
    if (b.cotChinh && ds.indexOf(b.cotChinh) >= 0) return b.cotChinh;
    return '';
};

/** Cột giá áp dụng cho một khách hàng: bậc giá của khách trước, sau đó chính sách của công ty. */
T.cotGiaKhach = function (kh, donViId, b) {
    var ds = (b && b.cotGia) || [];
    var c = kh && kh.mucGia ? T.COT_THEO_BAC[kh.mucGia] : '';
    if (c && (!ds.length || ds.indexOf(c) >= 0)) return c;
    var cs = T.chinhSachGia(donViId);
    if (cs.cotGia && (!ds.length || ds.indexOf(cs.cotGia) >= 0)) return cs.cotGia;
    return (b && b.cotChinh) || ds[0] || '';
};
T.chinhSachGia = function (donViId) {
    var d = DB.get('donVi', donViId) || {};
    var c = d.chinhSachGia || {};
    return {
        cotGia: c.cotGia || '',                    // để trống = dùng cột giá mặc định của bảng giá
        ckLoai: c.ckLoai === 'đ' ? 'đ' : '%',
        ckMuc: Number(c.ckMuc) || 0,
        lamTron: Number(c.lamTron) || 0,
        cachTron: c.cachTron || 'gan'
    };
};
/** Giá của một mã hàng theo đúng một cột giá của bảng giá. */
T.giaTheoCot = function (b, hang, cot) {
    var maHang = T.idHH(hang) || hang;
    if (!b) return 0;
    var o = T.traBang(b.bang, hang);
    if (cot && o && Number(o[cot]) > 0) return Math.round(Number(o[cot]));
    if (!cot && o && b.cotChinh && Number(o[b.cotChinh]) > 0) return Math.round(Number(o[b.cotChinh]));
    var g = T.traBang(b.gia, hang);
    return g === undefined ? 0 : Math.round(Number(g) || 0);
};
/**
 * ĐƠN GIÁ BÁN KHI LẬP CHỨNG TỪ
 * Lấy đúng cột giá theo cấu hình của đơn vị phát hành, áp chiết khấu mặc định
 * và quy tắc làm tròn. Trả về { goc, gia, ck, ckLoai, cot }.
 */
T.donGiaChungTu = function (hang, bangGiaId, donViId, ngay, khId, mucGia) {
    var maHang = T.idHH(hang) || hang;
    var b = DB.get('bangGiaBan', bangGiaId);
    var cs = T.chinhSachGia(donViId);
    // Không chỉ định phiên bản thì ERP tự tìm phiên bản còn hiệu lực có mã hàng này
    if (!b) b = T.bangGiaChoHang(maHang, ngay, donViId);
    if (!b) return { goc: 0, gia: 0, ck: cs.ckMuc, ckLoai: cs.ckLoai, cot: '' };
    var ds = T.cotGiaCua(b);
    var kh = khId ? DB.get('khachHang', khId) : null;
    /* MỨC GIÁ ÁP DỤNG do người dùng chọn trên chứng từ là ưu tiên số một.
       Phiên bản bảng giá chỉ nói CÓ NHỮNG CỘT GIÁ NÀO; chọn mức nào là quyền
       của người lập chứng từ, hệ thống không tự quyết thay. */
    var cot = (mucGia && ds.indexOf(mucGia) >= 0) ? mucGia
            : kh ? T.cotGiaKhach(kh, donViId, b)
                 : ((cs.cotGia && ds.indexOf(cs.cotGia) >= 0) ? cs.cotGia : (b.cotChinh || ds[0] || ''));
    var goc = T.giaTheoCot(b, maHang, cot);
    if (!goc) return { goc: 0, gia: 0, ck: cs.ckMuc, ckLoai: cs.ckLoai, cot: cot };
    var giam = cs.ckLoai === 'đ' ? cs.ckMuc : Math.round(goc * cs.ckMuc / 100);
    var g = Math.max(0, goc - giam);
    if (cs.lamTron > 0) {
        var q = g / cs.lamTron;
        g = (cs.cachTron === 'len' ? Math.ceil(q)
           : cs.cachTron === 'xuong' ? Math.floor(q) : Math.round(q)) * cs.lamTron;
    }
    return { goc: goc, gia: g, ck: cs.ckMuc, ckLoai: cs.ckLoai, cot: cot, bangGiaId: b.id };
};
/** Bảng giá mặc định của một khách hàng (có kiểm tra hiệu lực theo ngày chứng từ). */
/**
 * BẢNG GIÁ CỦA MỘT CÔNG TY — mỗi công ty có bảng giá riêng của mình.
 * EMC: Giá dự án / Giá đại lý / Giá bán lẻ
 * AA: Giá dự án / Giá bán lẻ
 * Tản Viên: Giá bán trực tiếp / Giá đại lý
 * Thái Phong: Giá bán lẻ
 */
/* ==========================================================================
   KỲ HIỆU LỰC · KHÓA PHIÊN BẢN · CẤU TRÚC TỆP · TỆP GỐC
   Bộ hàm nền của Module Bảng giá.
   ========================================================================== */
/** Kỳ của một phiên bản: năm · quý · tháng. Lấy theo ngày bắt đầu hiệu lực. */
T.kyBangGia = function (b) {
    var n = String((b && (b.tuNgay || b.ngayNhap)) || '').substr(0, 10);
    if (!/^\d{4}-\d{2}/.test(n)) return { nam: 0, quy: 0, thang: 0, nhan: '' };
    var nam = Number(n.substr(0, 4)), thang = Number(n.substr(5, 2));
    var quy = Math.ceil(thang / 3);
    return { nam: nam, quy: quy, thang: thang,
             nhan: 'Quý ' + ['', 'I', 'II', 'III', 'IV'][quy] + '/' + nam };
};
/** Nhãn kỳ để hiển thị và lọc: "2026 · Quý II · Tháng 05". */
T.nhanKyBangGia = function (b) {
    var k = T.kyBangGia(b);
    if (!k.nam) return '';
    return k.nam + ' · Quý ' + ['', 'I', 'II', 'III', 'IV'][k.quy] +
           ' · Tháng ' + ('0' + k.thang).slice(-2);
};
/** Gán lại các trường kỳ cho một phiên bản (dẫn xuất từ ngày hiệu lực). */
T.ganKyBangGia = function (b) {
    var k = T.kyBangGia(b);
    b.nam = k.nam; b.quy = k.quy; b.thang = k.thang;
    return b;
};

/**
 * PHIÊN BẢN ĐÃ CHỐT thì KHÔNG ĐƯỢC SỬA DỮ LIỆU.
 * Một phiên bản bị khóa khi: người dùng chốt tay (b.khoa = true), hoặc đã có
 * phiên bản mới hơn của cùng bảng giá thay thế nó. Phiên bản khóa vẫn tra cứu,
 * so sánh và khôi phục được — chỉ không sửa được số liệu.
 */
T.phienBanBiKhoa = function (b) {
    if (!b) return false;
    if (b.khoa) return true;
    /* Chỉ khóa khi có phiên bản THẬT SỰ THAY THẾ: số phiên bản lớn hơn VÀ ngày
       hiệu lực không sớm hơn. Nhập bổ sung một kỳ cũ vào hệ thống KHÔNG được
       khóa mất phiên bản đang áp dụng. */
    return DB.all('bangGiaBan').some(function (x) {
        return x.id !== b.id && x.ma === b.ma &&
               (Number(x.phienBan) || 1) > (Number(b.phienBan) || 1) &&
               String(x.tuNgay || '') >= String(b.tuNgay || '');
    });
};
/** Lý do một phiên bản bị khóa — hiển thị cho người dùng. */
T.lyDoKhoaPhienBan = function (b) {
    if (!b) return '';
    if (b.khoa) return 'Phiên bản đã được chốt, không sửa được số liệu.';
    var sau = DB.all('bangGiaBan').filter(function (x) {
        return x.id !== b.id && x.ma === b.ma &&
               (Number(x.phienBan) || 1) > (Number(b.phienBan) || 1) &&
               String(x.tuNgay || '') >= String(b.tuNgay || '');
    }).sort(function (a, c) { return (Number(c.phienBan) || 1) - (Number(a.phienBan) || 1); })[0];
    if (sau) return 'Đã có phiên bản ' + (sau.phienBan || '') + ' (' + (sau.ten || '') +
                    ') thay thế. Phiên bản cũ là hồ sơ đã phát hành, không sửa được.';
    return '';
};

/* --------------------------------------------------------- CẤU TRÚC TỆP */
/**
 * CHỮ KÝ CẤU TRÚC TỆP — dãy tiêu đề cột đã chuẩn hóa.
 * Hai tệp cùng chữ ký là cùng một khuôn mẫu, dù khác số dòng và khác giá.
 */
T.chuKyCauTruc = function (tenCot) {
    return (tenCot || []).map(function (x) {
        return T.kd(String(x === undefined || x === null ? '' : x)).replace(/\s+/g, ' ').trim();
    }).join('|');
};
/** Hồ sơ cấu trúc tệp đã ghi nhớ — tra theo chữ ký trước, sau đó theo nhà cung cấp. */
T.mauCauTruc = function (chuKy, nhaCungCap, loai) {
    /* loai = 'bangGia' (mặc định) hoặc 'nhapHang': hai luồng nhập tệp khác nhau
       có cấu trúc cột khác nhau nên hồ sơ ghi nhớ phải tách riêng, không luồng
       nào lấy nhầm khuôn của luồng kia. */
    loai = loai || 'bangGia';
    var ds = DB.all('mauBangGia').filter(function (m) {
        return (m.loai || 'bangGia') === loai;
    });
    var k = T.kd(nhaCungCap || '');
    function moiNhat(a) {
        return a.slice().sort(function (x, y) {
            var p = String(x.lanCuoi || ''), q = String(y.lanCuoi || '');
            return p < q ? 1 : p > q ? -1 : 0;
        })[0] || null;
    }
    /* Đúng hãng và đúng cấu trúc → chắc chắn nhất. */
    if (k) {
        var t = moiNhat(ds.filter(function (m) {
            return m.chuKy === chuKy && T.kd(m.nhaCungCap || '') === k; }));
        if (t) return t;
    }
    /* Chưa biết hãng: dùng hồ sơ mới nhất có cùng cấu trúc tệp. */
    var t2 = moiNhat(ds.filter(function (m) { return m.chuKy === chuKy; }));
    if (t2) return t2;
    if (!k) return null;
    return moiNhat(ds.filter(function (m) { return T.kd(m.nhaCungCap || '') === k; }));
};
/** Ghi nhớ cấu trúc tệp của một nhà cung cấp sau khi nhập thành công. */
T.ghiNhoCauTruc = function (o) {
    /* Khóa hồ sơ là LOẠI TỆP + CHỮ KÝ CỘT + NHÀ CUNG CẤP: hai hãng dùng chung
       khuôn tiêu đề vẫn có hồ sơ riêng, không hãng nào ghi đè hãng nào; và tệp
       bảng giá không bao giờ lấy nhầm khuôn của tệp nhập hàng. */
    var loai = o.loai || 'bangGia';
    var kn = T.kd(o.nhaCungCap || '');
    var cu = DB.all('mauBangGia').filter(function (m) {
        return (m.loai || 'bangGia') === loai &&
               m.chuKy === o.chuKy && T.kd(m.nhaCungCap || '') === kn;
    })[0];
    if (cu) {
        cu.nhaCungCap = o.nhaCungCap || cu.nhaCungCap;
        cu.anhXa = o.anhXa; cu.cotGiaJ = o.cotGiaJ; cu.tenCot = o.tenCot;
        cu.dongTieuDe = o.dongTieuDe; cu.caoTieuDe = o.caoTieuDe; cu.sheet = o.sheet;
        cu.soLanDung = (Number(cu.soLanDung) || 0) + 1;
        cu.lanCuoi = T.now(); cu.tepCuoi = o.tepCuoi || cu.tepCuoi;
        return cu;
    }
    var m = {
        id: T.uid('MB'), loai: loai, chuKy: o.chuKy, nhaCungCap: o.nhaCungCap || '',
        tenCot: o.tenCot || [], anhXa: o.anhXa, cotGiaJ: o.cotGiaJ,
        dongTieuDe: o.dongTieuDe, caoTieuDe: o.caoTieuDe, sheet: o.sheet || '',
        tepCuoi: o.tepCuoi || '', soLanDung: 1, lanCuoi: T.now(), _tao: T.now()
    };
    DB.data.mauBangGia.push(m);
    return m;
};

/* ------------------------------------------------------------- TỆP GỐC */
/* Dung lượng tối đa của một tệp gốc được lưu trong kho dữ liệu. Tệp lớn hơn
   vẫn nhập bình thường, chỉ không giữ lại bản gốc — có báo rõ cho người dùng. */
/* Base64 phình khoảng 4/3 lần, mà localStorage của trình duyệt thường chỉ ~5 MB
   cho cả kho dữ liệu. Giữ ngưỡng nhỏ để lưu tệp gốc KHÔNG BAO GIỜ làm nghẽn việc
   lưu số liệu nghiệp vụ. Tệp lớn hơn vẫn nhập bình thường, chỉ không giữ bản gốc. */
T.CO_TEP_GOC = 1.2 * 1024 * 1024;

/** Lưu tệp Excel gốc của một lần nhập. Trả về bản ghi tệp hoặc null. */
T.luuTepGoc = function (o) {
    if (!o || !o.duLieu) return null;
    var r = {
        id: T.uid('TG'), bangGiaBanId: o.bangGiaBanId || '',
        ten: o.ten || 'BangGia.xlsx', mime: o.mime ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        kichThuoc: Number(o.kichThuoc) || 0, duLieu: o.duLieu,
        nguoiNhap: o.nguoiNhap || (DB.user().hoTen || DB.user().taiKhoan || ''),
        luc: o.luc || T.now(), phienBan: o.phienBan || '', ghiChu: o.ghiChu || '',
        soDong: Number(o.soDong) || 0, _tao: T.now()
    };
    DB.data.tepGoc.push(r);
    return r;
};
/** Tệp gốc của một phiên bản bảng giá. */
T.tepGocCua = function (bangGiaBanId) {
    var ds = DB.all('tepGoc').filter(function (t) { return t.bangGiaBanId === bangGiaBanId; });
    /* Cùng thời điểm thì bản ghi thêm sau đứng trước — thứ tự luôn ổn định. */
    return ds.slice().sort(function (a, b) {
        var x = String(a.luc || ''), y = String(b.luc || '');
        if (x !== y) return x < y ? 1 : -1;
        return ds.indexOf(b) - ds.indexOf(a);
    })[0] || null;
};

/** Các hãng / nhà cung cấp đang có phiên bản bảng giá. */
T.dsNhaCungCapGia = function () {
    var m = {};
    DB.all('bangGiaBan').forEach(function (b) {
        var n = b.nhaCungCap || b.ma || '';
        if (n) m[n] = 1;
    });
    return Object.keys(m).sort();
};
/** Toàn bộ phiên bản của một hãng, mới nhất trước. */
T.phienBanCuaHang = function (nhaCungCap) {
    return DB.all('bangGiaBan').filter(function (b) {
        return (b.nhaCungCap || b.ma || '') === nhaCungCap;
    }).sort(function (a, b) {
        var x = (b.tuNgay || '') + ('000' + (Number(b.phienBan) || 1)).slice(-4);
        var y = (a.tuNgay || '') + ('000' + (Number(a.phienBan) || 1)).slice(-4);
        return x < y ? -1 : x > y ? 1 : 0;
    });
};
/** Phiên bản còn hiệu lực của một hãng tại ngày chứng từ. */
T.phienBanHang = function (nhaCungCap, ngay) {
    ngay = ngay || T.today();
    var ds = T.phienBanCuaHang(nhaCungCap).filter(function (b) {
        return b.trangThai === 'Đang áp dụng' &&
            (!b.tuNgay || b.tuNgay <= ngay) && (!b.denNgay || b.denNgay >= ngay);
    });
    return ds[0] || null;
};
/**
 * Phiên bản bảng giá dùng cho MỘT mã hàng tại ngày chứng từ.
 * ERP tự tìm, người dùng không phải chọn bảng giá nào.
 */
T.bangGiaChoHang = function (hang, ngay) {
    var ds = T.bangGiaHieuLuc(ngay);
    for (var i = 0; i < ds.length; i++) {
        var b = ds[i];
        if (T.traBang(b.bang, hang) !== undefined || T.traBang(b.gia, hang) !== undefined) return b;
    }
    return null;
};
/**
 * KIẾN TRÚC V1.0 — bảng giá do đơn vị nguồn xây dựng và dùng chung cho cả nhóm.
 * Mọi đơn vị phát hành đều nhìn thấy cùng một tập bảng giá; tham số donViId giữ
 * lại để không phá chữ ký hàm nhưng không còn chia tách dữ liệu theo công ty.
 */
T.bangGiaCuaDonVi = function (donViId, ngay) {
    return T.bangGiaHieuLuc(ngay);
};

/** Các bậc giá đang có trong hệ thống — dùng cho danh mục khách hàng. */
T.BAC_GIA = [
    { v: 'DUAN',     t: 'Giá dự án' },
    { v: 'DAILY',    t: 'Giá đại lý' },
    { v: 'BANLE',    t: 'Giá bán lẻ' },
    { v: 'TRUCTIEP', t: 'Giá bán trực tiếp' }
];

/**
 * Chọn bảng giá mặc định cho một chứng từ:
 *   đơn vị phát hành + bậc giá của khách hàng → đúng một bảng giá.
 * Không có bảng đúng bậc thì lấy bảng mặc định của công ty đó.
 */
T.bangGiaMacDinh = function (donViId, mucGia, ngay) {
    var ds = T.bangGiaCuaDonVi(donViId, ngay);
    if (!ds.length) return null;
    var i;
    for (i = 0; i < ds.length; i++) if (ds[i].macDinh) return ds[i];
    // Mô hình cũ có bảng giá riêng theo bậc giá — vẫn nhận ra để không phá dữ liệu cũ
    for (i = 0; i < ds.length; i++) if (mucGia && ds[i].ma === mucGia) return ds[i];
    return ds[0];
};

/**
 * Bảng giá phù hợp cho một khách hàng khi phát hành từ một công ty.
 * Ưu tiên bảng giá đã khai báo riêng cho khách hàng, nếu bảng đó thuộc đúng
 * công ty phát hành và còn hiệu lực; nếu không thì lấy bảng mặc định của công ty.
 */
T.bangGiaCuaKhach = function (khId, donViId, ngay) {
    var kh = DB.get('khachHang', khId) || {};
    var dv = donViId || DB.data._meta.ctyId;
    if (kh.bangGiaId) {
        var ds = T.bangGiaCuaDonVi(dv, ngay);
        for (var i = 0; i < ds.length; i++) if (ds[i].id === kh.bangGiaId) return ds[i];
    }
    return T.bangGiaMacDinh(dv, kh.mucGia, ngay);
};

/* ==========================================================================
   ██  BUSINESS RULE ENGINE — BỘ QUY TẮC NGHIỆP VỤ DUY NHẤT CỦA TVERP  ██
   --------------------------------------------------------------------------
   TRIẾT LÝ: "Người dùng chỉ làm nghiệp vụ. Engine tự hiểu nghiệp vụ."

   MÔ HÌNH DOANH NGHIỆP
     · TẢN VIÊN là CÔNG TY NGUỒN: nhập khẩu, mua hàng, giữ kho, sở hữu GIÁ VỐN
       GỐC và xây dựng TOÀN BỘ bảng giá của nhóm.
     · AA · EMC · THÁI PHONG là ĐƠN VỊ PHÁT HÀNH chứng từ và kinh doanh. Không
       quản lý giá vốn nhập khẩu, không có bảng giá riêng.
     · MỘT hệ thống kho dùng chung. MỘT giá vốn gốc. MỘT bộ bảng giá.

   ĐƠN VỊ PHÁT HÀNH LÀ THAM SỐ ĐIỀU KHIỂN ENGINE, không phải dữ liệu hiển thị.
     · Đơn vị phát hành = Tản Viên  → bán trực tiếp.
     · Đơn vị phát hành ≠ Tản Viên  → Engine TỰ SUY LUẬN rằng Tản Viên đang bán
       nội bộ sang đơn vị phát hành, rồi tự tính hai lớp lợi nhuận.

   TOÀN BỘ SUY LUẬN NỘI BỘ CHẠY NGẦM. Engine tuyệt đối KHÔNG sinh báo giá nội
   bộ, đơn hàng nội bộ, hợp đồng nội bộ, phiếu bán nội bộ, phiếu nhập nội bộ,
   công nợ nội bộ, phiếu chuyển kho, chứng từ trung gian, menu nội bộ hay màn
   hình nội bộ. Người dùng chỉ thao tác trên MỘT bộ chứng từ duy nhất.

   MỌI PHÂN HỆ ĐỀU HỎI ENGINE NÀY. Không phân hệ nào được tự trả lời các câu
   hỏi nghiệp vụ dưới đây bằng công thức riêng:
     · Giá vốn gốc của một mặt hàng là bao nhiêu?      → T.giaVonGoc
     · Giá bán nội bộ từ Tản Viên sang đơn vị nào đó?  → T.giaBanNoiBo
     · Giá vốn mà đơn vị phát hành phải chịu?          → T.giaVonDonVi
     · Đơn giá bán áp cho khách hàng này?              → T.donGiaChungTu
     · Lợi nhuận của một chứng từ, của từng công ty?   → T.suyLuanChungTu
     · Giá trị tồn kho?                                → T.giaTriTonKho
   ========================================================================== */

/**
 * GIÁ VỐN GỐC — giá nhập khẩu / giá mua thực tế của Tản Viên.
 * CHỈ phát sinh từ: Nhập hàng → Phiếu nhập kho → Kho → Engine giá vốn.
 * Không nhập tay, không sửa trực tiếp, không phát sinh từ phân hệ nào khác.
 */
T.giaVonGoc = function (hang, ngay) { return T.giaVonBQ(hang, ngay); };

/**
 * GIÁ BÁN NỘI BỘ — giá Tản Viên bán sang một đơn vị phát hành, tại một ngày.
 * Đơn vị phát hành CHÍNH LÀ Tản Viên thì không có giao dịch nội bộ nào, giá
 * bán nội bộ bằng đúng giá vốn gốc.
 * Chính sách giá nội bộ nằm TRONG chính phiên bản bảng giá đang áp dụng, có
 * ghi đè theo từng mặt hàng. Truyền bangGiaId để lấy đúng chính sách của phiên
 * bản mà chứng từ đang dùng — chứng từ cũ giữ nguyên chính sách của bản cũ.
 */
T.giaBanNoiBo = function (hang, donViId, ngay, bangGiaId, cotGia) {
    if (!donViId || T.laCtyNguon(donViId)) return T.giaVonGoc(hang, ngay);
    return T.giaNoiBo(hang, donViId, ngay, bangGiaId, cotGia);
};

/**
 * GIÁ VỐN CỦA ĐƠN VỊ PHÁT HÀNH.
 * Theo đúng nguyên tắc kiến trúc: giá vốn của đơn vị phát hành BẰNG giá bán
 * nội bộ mà Tản Viên bán sang. Tản Viên phát hành thì giá vốn là giá vốn gốc.
 */
T.giaVonDonVi = function (hang, donViId, ngay, bangGiaId, cotGia) {
    return T.giaBanNoiBo(hang, donViId, ngay, bangGiaId, cotGia);
};


/**
 * SUY LUẬN NGHIỆP VỤ CHO MỘT CHỨNG TỪ CÓ DÒNG HÀNG.
 * Đây là đầu vào duy nhất của mọi báo cáo lợi nhuận trong hệ thống.
 *
 * Đầu vào : chứng từ bất kỳ có { donVi, ngay, lines[] }.
 * Đầu ra  : {
 *   donViId, ctyNguonId, laNguon, nguonHang,
 *   dong: [{ hangHoaId, soLuong, donGia, ck, doanhThu,
 *            giaVonGoc, giaBanNoiBo, giaVonDonVi,
 *            loiNhuanNguon, loiNhuanPhatHanh }],
 *   tong: { doanhThu, giaVonGoc, doanhThuNoiBo, giaVonDonVi,
 *           loiNhuanNguon, loiNhuanPhatHanh, loiNhuanNhom }
 * }
 *
 * Quy tắc:
 *   · Tản Viên phát hành → không có giao dịch nội bộ. Toàn bộ lợi nhuận là
 *     của Tản Viên; lợi nhuận đơn vị phát hành bằng 0 vì chính là Tản Viên.
 *   · Đơn vị khác phát hành → Tản Viên bán nội bộ ở giá bán nội bộ:
 *       Lợi nhuận Tản Viên       = Doanh thu nội bộ − Giá vốn gốc
 *       Giá vốn đơn vị phát hành = Doanh thu nội bộ
 *       Lợi nhuận đơn vị phát hành = Doanh thu bán khách − Giá vốn đơn vị
 *       Lợi nhuận nhóm            = Doanh thu bán khách − Giá vốn gốc
 *     (Lợi nhuận nhóm luôn tự khử phần luân chuyển nội bộ.)
 *   · GIÁ VỐN NỘI BỘ ĐÃ ĐÓNG BĂNG trên dòng hàng luôn được dùng lại nguyên vẹn,
 *     kể cả khi bằng 0 — chứng từ đã phát hành không đổi số theo bảng giá hôm nay.
 */
T.suyLuanChungTu = function (r) {
    var cf = T.cauHinhDaCongTy();
    var dvId = (r && r.donVi) || '';
    var ngay = (r && r.ngay) || T.today();
    var bgId = (r && r.bangGiaId) || '';
    var cotGia = (r && r.cotGia) || '';
    var laNguon = !dvId || T.laCtyNguon(dvId);
    var dong = [], tong = { doanhThu: 0, giaVonGoc: 0, doanhThuNoiBo: 0, giaVonDonVi: 0,
                            loiNhuanNguon: 0, loiNhuanPhatHanh: 0, loiNhuanNhom: 0 };
    ((r && r.lines) || []).forEach(function (l) {
        var sl = Number(l.soLuong) || 0;
        var dg = Number(l.donGia) || 0;
        var ck = Number(l.ckPhanTram) || 0;
        var dt = Math.round(sl * dg * (1 - ck / 100));
        /* GIÁ VỐN GỐC — luôn là giá vốn của kho, không bao giờ là giá nội bộ. */
        var goc = Number(l.giaVonGoc);
        if (!(goc > 0)) goc = T.giaVonGoc(l, ngay);
        /* GIÁ VỐN NỘI BỘ — số đã đóng băng khi lập chứng từ; chưa có thì hỏi
           Engine theo ĐÚNG phiên bản bảng giá và ĐÚNG loại giá của chứng từ.
           Người dùng KHÔNG nhập giá vốn nội bộ ở bất kỳ đâu; sửa giá bán khách
           cũng KHÔNG làm thay đổi con số này. */
        var daDong = l.giaVon !== undefined && l.giaVon !== '' && l.giaVon !== null &&
                     isFinite(Number(l.giaVon));
        var nb = laNguon ? goc
               : (daDong ? Number(l.giaVon)
                         : T.giaBanNoiBo(l, dvId, ngay, bgId, cotGia));
        var gvGoc = Math.round(sl * goc);
        var dtNB = laNguon ? 0 : Math.round(sl * nb);
        var gvDV = laNguon ? gvGoc : dtNB;
        var lnNguon = laNguon ? (dt - gvGoc) : (dtNB - gvGoc);
        var lnPH = laNguon ? 0 : (dt - gvDV);
        dong.push({ hangHoaId: T.idDong(l), maHang: l.maHang, tenHang: l.tenHang,
                    dvt: l.dvt, soLuong: sl, donGia: dg, ck: ck, doanhThu: dt,
                    giaVonGoc: goc, giaBanNoiBo: laNguon ? goc : nb, giaVonDonVi: laNguon ? goc : nb,
                    loiNhuanNguon: lnNguon, loiNhuanPhatHanh: lnPH });
        tong.doanhThu += dt; tong.giaVonGoc += gvGoc;
        tong.doanhThuNoiBo += dtNB; tong.giaVonDonVi += gvDV;
        tong.loiNhuanNguon += lnNguon; tong.loiNhuanPhatHanh += lnPH;
    });
    tong.loiNhuanNhom = tong.doanhThu - tong.giaVonGoc;
    return { donViId: dvId, ctyNguonId: cf.ctyNguonId, laNguon: laNguon,
             nguonHang: 'Kho chung', ngay: ngay, dong: dong, tong: tong };
};

/**
 * GIÁ TRỊ TỒN KHO — một cách tính duy nhất cho toàn hệ thống.
 * Tồn kho là tài sản của nhóm nên luôn định giá theo GIÁ VỐN GỐC, không bao
 * giờ theo giá nội bộ của một đơn vị phát hành nào.
 */
T.giaTriTonKho = function (ds) {
    return T.sum(ds || DB.all('hangHoa'), function (h) {
        return (Number(h.ton) || 0) * T.giaVonGoc(h);
    });
};


/* ==========================================================================
   BUSINESS ENGINE KẾT QUẢ KINH DOANH
   DOANH THU · GIÁ VỐN · CHI PHÍ · LỢI NHUẬN
   --------------------------------------------------------------------------
   MỘT DỮ LIỆU CHỈ ĐƯỢC SINH RA MỘT LẦN. Toàn bộ doanh thu, giá vốn, chi phí và
   lợi nhuận hình thành TỰ ĐỘNG từ chứng từ gốc. Không ô nào cho gõ tay, không
   phân hệ nào tính lại theo cách riêng: mọi nơi trong phần mềm — Dashboard,
   báo cáo, đối chiếu — đều gọi đúng những hàm dưới đây.

   ---- VÌ SAO PHẢI CHỌN MỘT CHỨNG TỪ GHI NHẬN DOANH THU ----
   Một thương vụ đi qua tám chứng từ:
       Báo giá → Đơn bán hàng → Hợp đồng → Phiếu xuất kho → Biên bản nghiệm thu
       → Biên bản nghiệm thu giá trị → Đề nghị thanh toán → Phiếu thu
   Tám chứng từ mang CÙNG MỘT khoản tiền. Cộng cả tám là nhân tám lần doanh thu.
   Vì vậy Engine ghi nhận doanh thu ĐÚNG MỘT LẦN cho MỘT GIAO DỊCH (mã giao
   dịch), lấy chứng từ có giá trị pháp lý cao nhất đang có trong giao dịch đó:

       Đơn bán hàng → chưa có thì Hợp đồng → chưa có nữa thì Phiếu xuất kho

   · BÁO GIÁ là lời chào giá, khách chưa đặt — chưa phải doanh thu.
   · BIÊN BẢN NGHIỆM THU · BBNT GIÁ TRỊ · ĐỀ NGHỊ THANH TOÁN là chứng cứ của
     chính khoản doanh thu đã ghi nhận, không phải doanh thu mới.
   · PHIẾU THU là dòng tiền về, không phải doanh thu.
   · Hàng đã xuất kho mà chưa có đơn bán hay hợp đồng thì PHIẾU XUẤT KHO chính
     là chứng từ ghi nhận — không để hàng ra khỏi kho mà doanh thu bằng không.

   ---- DOANH THU LUÔN TRƯỚC THUẾ GTGT ----
   Thuế GTGT đầu ra là khoản thu hộ Nhà nước, không phải doanh thu của doanh
   nghiệp. Toàn hệ thống dùng MỘT cơ sở duy nhất là số tiền hàng trước thuế.
   ========================================================================== */

/** Trạng thái KHÔNG được tính vào kết quả kinh doanh. */
T.TT_KHONG_TINH = ['Nháp', 'Đã hủy'];
T.tinhVaoKetQua = function (r) {
    return !!r && T.TT_KHONG_TINH.indexOf(r.trangThai) < 0;
};

/** Thang ưu tiên ghi nhận doanh thu trong MỘT giao dịch — trên trước, dưới sau. */
T.THANG_DOANH_THU = [
    { coll: 'donBan',    t: 'Đơn bán hàng' },
    { coll: 'hopDong',   t: 'Hợp đồng' },
    { coll: 'phieuXuat', t: 'Phiếu xuất kho' }
];

/**
 * CHỨNG TỪ LÀM TĂNG GIÁ TRỊ CỦA MỘT GIAO DỊCH ĐÃ CÓ.
 * Phụ lục "Bổ sung hàng hóa" thêm hàng vào hợp đồng đã ký — đó là doanh thu
 * MỚI, không phải bản sao của hợp đồng. Vì vậy phụ lục KHÔNG tham gia thang ưu
 * tiên (không thay thế hợp đồng) mà được CỘNG THÊM.
 * Các loại phụ lục còn lại chỉ sửa điều khoản, gia hạn hoặc điều chỉnh giá trị
 * trên chính dòng hàng của hợp đồng nên không mang doanh thu riêng.
 */
T.PHU_LUC_TANG_DOANH_THU = ['Bổ sung hàng hóa'];

/**
 * KHÓA GIAO DỊCH của một chứng từ — hai chứng từ cùng khóa là CÙNG MỘT khoản
 * tiền. Ưu tiên mã giao dịch; chứng từ đời cũ chưa có mã thì lần theo liên kết
 * cha; không còn gì nữa thì tự nó là một giao dịch riêng.
 */
T.khoaGiaoDich = function (coll, r) {
    if (!r) return '';
    if (r.maGD) return 'GD:' + r.maGD;
    if (r.donBanId) return 'donBan:' + r.donBanId;
    if (r.hopDongId) return 'hopDong:' + r.hopDongId;
    if (r.baoGiaId) return 'baoGia:' + r.baoGiaId;
    return coll + ':' + r.id;
};

/**
 * DOANH THU CỦA MỘT CHỨNG TỪ — trước thuế GTGT, đã trừ chiết khấu từng dòng.
 * Tính lại từ dòng hàng, không tin số tổng đã lưu: số tổng có thể là bản ghi
 * đời cũ hoặc đã lệch sau khi sửa dòng.
 */
T.doanhThuChungTu = function (r) {
    return T.sum((r && r.lines) || [], function (l) {
        return Math.round((Number(l.soLuong) || 0) * (Number(l.donGia) || 0) *
                          (1 - (Number(l.ckPhanTram) || 0) / 100));
    });
};

/**
 * CHỌN CHỨNG TỪ GHI NHẬN DOANH THU.
 * Trả về mảng { coll, ten, r, khoa } — mỗi giao dịch đúng MỘT phần tử.
 * loc = { tuNgay, denNgay, donViId, duAnId, khachHangId }
 */
T.chungTuDoanhThu = function (loc) {
    loc = loc || {};
    var theoKhoa = {}, thuTu = {};
    T.THANG_DOANH_THU.forEach(function (x, i) { thuTu[x.coll] = i; });

    /* CHẶN THEO NGÀY NGAY TỪ LÚC GOM ỨNG VIÊN, KHÔNG PHẢI Ở BƯỚC LỌC CUỐI.
       Chuỗi chứng từ có bậc: Đơn bán thắng Hợp đồng, Hợp đồng thắng Phiếu xuất.
       Nếu để bậc giải xong rồi mới lọc ngày thì một chứng từ bậc CAO lập năm sau
       sẽ hất chứng từ bậc thấp của năm trước ra khỏi danh sách, rồi chính nó lại
       bị lọc ngày loại đi — doanh thu của năm cũ biến mất chỉ vì năm sau phát
       sinh thêm giấy tờ. Báo cáo lịch sử phải phản ánh đúng những gì đã tồn tại
       đến hết ngày chốt, nên ứng viên phải bị chặn ngày TRƯỚC khi xét bậc.
       Không khai kỳ thì mọi thứ chạy y như cũ. */
    function trongMoc(r) {
        if (loc.tuNgay && String(r.ngay || '') < loc.tuNgay) return false;
        if (loc.denNgay && String(r.ngay || '') > loc.denNgay) return false;
        return true;
    }
    T.THANG_DOANH_THU.forEach(function (bac) {
        DB.all(bac.coll).forEach(function (r) {
            if (!T.tinhVaoKetQua(r)) return;
            if (!trongMoc(r)) return;
            var k = T.khoaGiaoDich(bac.coll, r);
            var cu = theoKhoa[k];
            /* Bậc cao hơn thắng. Cùng bậc (giao dịch có hai đơn bán do dữ liệu
               đời cũ chưa nối mã) thì giữ cả hai bằng cách tách khóa. */
            if (!cu) { theoKhoa[k] = { coll: bac.coll, ten: bac.t, r: r, khoa: k }; return; }
            if (cu.coll === bac.coll) { theoKhoa[k + '#' + r.id] = { coll: bac.coll, ten: bac.t, r: r, khoa: k + '#' + r.id }; return; }
            if (thuTu[bac.coll] < thuTu[cu.coll]) theoKhoa[k] = { coll: bac.coll, ten: bac.t, r: r, khoa: k };
        });
    });

    var ra = Object.keys(theoKhoa).map(function (k) { return theoKhoa[k]; });

    /* PHỤ LỤC BỔ SUNG HÀNG HÓA — cộng thêm, không thay thế chứng từ chính. */
    DB.all('phuLuc').forEach(function (r) {
        if (!T.tinhVaoKetQua(r)) return;
        if (!trongMoc(r)) return;
        if (T.PHU_LUC_TANG_DOANH_THU.indexOf(String(r.loai || '')) < 0) return;
        if (!(r.lines || []).length) return;
        ra.push({ coll: 'phuLuc', ten: 'Phụ lục hợp đồng', r: r, khoa: 'phuLuc:' + r.id });
    });

    return ra.filter(function (x) { return T.hopLoc(x.r, loc); })
        .sort(function (a, b) { return String(a.r.ngay) < String(b.r.ngay) ? 1 : -1; });
};

/** Một bản ghi có lọt qua bộ lọc kỳ · đơn vị · dự án · khách hàng hay không. */
T.hopLoc = function (r, loc) {
    if (!r) return false;
    loc = loc || {};
    if (loc.tuNgay && String(r.ngay || '') < loc.tuNgay) return false;
    if (loc.denNgay && String(r.ngay || '') > loc.denNgay) return false;
    if (loc.donViId && r.donVi !== loc.donViId) return false;
    if (loc.duAnId && r.duAnId !== loc.duAnId) return false;
    if (loc.khachHangId && r.khachHangId !== loc.khachHangId) return false;
    if (loc.nguoiLapId && r.nguoiLapId !== loc.nguoiLapId) return false;
    return true;
};

/* ==========================================================================
   KHOẢN MỤC CHI — DANH MỤC NỀN CỦA PHÂN HỆ CHI PHÍ
   Hai thuộc tính quyết định toàn bộ cách Engine đọc một phiếu chi:
     · vaoChiPhi     — khoản này có phải CHI PHÍ trong báo cáo lãi lỗ hay không.
     · giamCongNo    — khoản này có làm giảm CÔNG NỢ PHẢI TRẢ nhà cung cấp không.
   Tiền hàng và chi phí nhập khẩu ĐÃ NẰM TRONG GIÁ VỐN từ lúc nhập kho; đưa
   thêm một lần nữa vào Chi phí là tính hai lần đúng một khoản tiền.
   ========================================================================== */
T.KHOAN_MUC_CHI_GOC = [
    { ma: 'CP01', ten: 'Thanh toán tiền hàng nhà cung cấp', vaoChiPhi: false, giamCongNo: true,
      nhomBC: 'khong',
      moTa: 'Đã nằm trong giá vốn từ lúc nhập kho — không tính lại vào chi phí.' },
    { ma: 'CP02', ten: 'Chi phí nhập hàng đã phân bổ vào giá vốn', vaoChiPhi: false, giamCongNo: true,
      nhomBC: 'khong',
      moTa: 'Thuế nhập khẩu, logistics, vận tải, thông quan… đã vào giá vốn của lô nhập.' },
    { ma: 'CP03', ten: 'Chi phí công trình / dự án', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'banHang',
      moTa: 'Nhân công, lắp đặt, thuê thiết bị tại công trình. Gắn Dự án để tính lãi lỗ dự án.' },
    { ma: 'CP04', ten: 'Vận chuyển giao hàng cho khách', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'banHang', moTa: '' },
    { ma: 'CP05', ten: 'Lương và các khoản theo lương', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'quanLy', moTa: '' },
    { ma: 'CP06', ten: 'Thuê văn phòng, kho bãi', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'quanLy', moTa: '' },
    { ma: 'CP07', ten: 'Điện, nước, viễn thông', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'quanLy', moTa: '' },
    { ma: 'CP08', ten: 'Công tác phí', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'quanLy', moTa: '' },
    { ma: 'CP09', ten: 'Tiếp khách, giao dịch', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'banHang', moTa: '' },
    { ma: 'CP10', ten: 'Thuế, phí, lệ phí', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'thue',
      moTa: 'VAT, thuế môn bài, phí, lệ phí và các loại thuế KHÁC thuế TNDN. ' +
            'Lên chỉ tiêu mã số 26 — KHÔNG lên mã số 51. Thuế TNDN dùng CP13.' },
    { ma: 'CP11', ten: 'Chi phí tài chính, lãi vay', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'taiChinh', laiVay: true, moTa: 'Trong đó phần lãi vay hiện lên chỉ tiêu mã số 23.' },
    { ma: 'CP12', ten: 'Chi phí khác', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'khac', moTa: '' },
    /* v18.6.0 — Logic 3. THUẾ TNDN PHẢI ĐỨNG RIÊNG MỘT KHOẢN MỤC.
       Trước đây mọi khoản thuế, phí, lệ phí dùng chung CP10 nên báo cáo
       không có cách nào biết khoản nào là thuế thu nhập doanh nghiệp. */
    { ma: 'CP13', ten: 'Thuế thu nhập doanh nghiệp', vaoChiPhi: true, giamCongNo: false,
      nhomBC: 'thueTNDN',
      moTa: 'CHỈ dùng cho thuế TNDN. Đây là khoản mục duy nhất lên chỉ tiêu mã số 51 ' +
            'của Báo cáo kết quả hoạt động kinh doanh. VAT, thuế môn bài, phí, lệ phí ' +
            'và các loại thuế khác dùng CP10.' }
];

/**
 * NHÓM CHI PHÍ TRÊN BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH (v18.1.0).
 * Đây là KHAI BÁO, không phải suy đoán: mỗi khoản mục chi tự nói mình thuộc
 * dòng nào của báo cáo. Người dùng đổi được trong danh mục Khoản mục chi.
 */
T.NHOM_CHI_BC = [
    { k: 'banHang',  t: 'Chi phí bán hàng' },
    { k: 'quanLy',   t: 'Chi phí quản lý' },
    { k: 'taiChinh', t: 'Chi phí tài chính' },
    /* v18.6.0 — Logic 3. Hai nhóm thuế TÁCH HẲN nhau: chỉ nhóm thueTNDN mới
       lên mã số 51; nhóm thue (VAT · môn bài · phí · lệ phí · thuế khác) lên
       chi phí quản lý mã số 26 nên không khoản nào biến mất khỏi báo cáo. */
    { k: 'thue',     t: 'Thuế, phí, lệ phí khác (không phải thuế TNDN)' },
    { k: 'thueTNDN', t: 'Thuế thu nhập doanh nghiệp (mã số 51)' },
    { k: 'khac',     t: 'Chi phí khác' },
    { k: 'khong',    t: 'Không tính vào chi phí (đã nằm trong giá vốn)' }
];
T.nhomChiBC = function (p) {
    var km = T.khoanMucCua(p);
    if (!km) return '';                       /* chưa khai — KHÔNG đoán */
    if (km.nhomBC) return km.nhomBC;
    var g = null;
    T.KHOAN_MUC_CHI_GOC.forEach(function (x) {
        if (String(x.ma).toUpperCase() === String(km.ma || '').toUpperCase()) g = x; });
    return g ? g.nhomBC : (km.vaoChiPhi === false ? 'khong' : 'khac');
};

/** Khoản mục chi của một phiếu chi — chưa khai thì suy theo liên kết đơn mua. */
T.khoanMucCua = function (p) {
    if (!p) return null;
    var km = p.khoanMucId ? DB.get('khoanMucChi', p.khoanMucId) : null;
    if (km) return km;
    var ten = String(p.khoanMuc || '').trim();
    if (ten) {
        var k = T.kd(ten);
        var tim = DB.all('khoanMucChi').filter(function (x) { return T.kd(x.ten || '') === k; })[0];
        if (tim) return tim;
    }
    return null;
};
/**
 * Phiếu chi này có tính vào CHI PHÍ của báo cáo lãi lỗ hay không.
 *
 * CHƯA KHAI KHOẢN MỤC THÌ KHÔNG ĐOÁN. Đoán sai theo hướng "coi là chi phí" sẽ
 * cộng thêm một lần nữa đúng khoản tiền hàng đã nằm trong giá vốn — lợi nhuận
 * bị hụt mà không ai biết. Vì vậy phiếu chi chưa phân loại KHÔNG vào chi phí,
 * và bộ Đối chiếu nêu tên từng phiếu để người dùng khai cho đúng.
 */
T.chiVaoChiPhi = function (p) {
    var km = T.khoanMucCua(p);
    if (km) return km.vaoChiPhi !== false;
    return false;
};
/**
 * Phiếu chi này có làm giảm CÔNG NỢ PHẢI TRẢ nhà cung cấp hay không.
 * Chưa khai khoản mục: chỉ phiếu gắn đúng một đơn mua hàng mới chắc chắn là
 * thanh toán công nợ; ngoài ra không suy đoán.
 */
T.chiGiamCongNo = function (p) {
    var km = T.khoanMucCua(p);
    if (km) return km.giamCongNo !== false;
    return !!p.donMuaId;
};
/** Phiếu chi đã ghi sổ nhưng chưa khai khoản mục — Engine không tính vào đâu cả. */
T.chiChuaPhanLoai = function (loc) {
    loc = loc || {};
    return DB.all('phieuChi').filter(function (p) {
        if (p.trangThai !== 'Đã ghi sổ') return false;
        if (loc.tuNgay && String(p.ngay || '') < loc.tuNgay) return false;
        if (loc.denNgay && String(p.ngay || '') > loc.denNgay) return false;
        if (loc.donViId && p.donVi !== loc.donViId) return false;
        return !T.khoanMucCua(p);
    });
};

/**
 * CHI PHÍ TRONG KỲ — lấy từ PHIẾU CHI, nguồn dữ liệu duy nhất.
 * Trả về { tong, soPhieu, ds[], theoKhoanMuc[] }.
 */
T.chiPhiKy = function (loc) {
    loc = loc || {};
    var ds = DB.all('phieuChi').filter(function (p) {
        if (p.trangThai !== 'Đã ghi sổ') return false;
        if (loc.tuNgay && String(p.ngay || '') < loc.tuNgay) return false;
        if (loc.denNgay && String(p.ngay || '') > loc.denNgay) return false;
        if (loc.donViId && p.donVi !== loc.donViId) return false;
        if (loc.duAnId && p.duAnId !== loc.duAnId) return false;
        if (loc.nguoiLapId && p.nguoiLapId !== loc.nguoiLapId) return false;
        return T.chiVaoChiPhi(p);
    });
    var theo = {};
    ds.forEach(function (p) {
        var km = T.khoanMucCua(p);
        var ten = (km && km.ten) || String(p.khoanMuc || '').trim() || 'Chưa phân loại';
        if (!theo[ten]) theo[ten] = { ten: ten, soTien: 0, soPhieu: 0 };
        theo[ten].soTien += Number(p.soTien) || 0;
        theo[ten].soPhieu++;
    });
    return {
        tong: T.sum(ds, function (p) { return Number(p.soTien) || 0; }),
        soPhieu: ds.length, ds: ds,
        theoKhoanMuc: Object.keys(theo).map(function (k) { return theo[k]; })
            .sort(function (a, b) { return b.soTien - a.soTien; })
    };
};

/**
 * KẾT QUẢ KINH DOANH — CỬA DUY NHẤT của toàn phần mềm.
 *
 *      Doanh thu − Giá vốn − Chi phí = Lợi nhuận
 *
 * GIÁ VỐN hiểu theo ĐÚNG đơn vị phát hành, Engine tự biết, người dùng không
 * phải chọn cách tính:
 *   · Tản Viên (công ty nguồn) — giá vốn thật của kho.
 *   · EMC · AA · Thái Phong    — giá vốn nội bộ đã đóng băng trên chứng từ.
 *   · Toàn nhóm (không lọc đơn vị) — giá vốn thật của kho, phần luân chuyển
 *     nội bộ tự khử, không tính hai lần.
 */
T.ketQuaKinhDoanh = function (loc) {
    loc = loc || {};
    var ct = T.chungTuDoanhThu(loc);
    var theoDonVi = !!loc.donViId;
    var doanhThu = 0, giaVon = 0, giaVonGoc = 0, doanhThuNoiBo = 0, soLuong = 0;
    var chiTiet = [];
    ct.forEach(function (x) {
        var sl = T.suyLuanChungTu(x.r);
        var dt = sl.tong.doanhThu;
        var gvDV = sl.tong.giaVonDonVi;
        var gvG = sl.tong.giaVonGoc;
        doanhThu += dt; giaVonGoc += gvG;
        giaVon += theoDonVi ? gvDV : gvG;
        doanhThuNoiBo += sl.tong.doanhThuNoiBo;
        soLuong += T.sum(x.r.lines || [], function (l) { return Number(l.soLuong) || 0; });
        chiTiet.push({ coll: x.coll, ten: x.ten, r: x.r, doanhThu: dt,
                       giaVon: theoDonVi ? gvDV : gvG, giaVonGoc: gvG,
                       loiNhuanGop: dt - (theoDonVi ? gvDV : gvG) });
    });
    /* ------------------------------------------------------------------
       TẦNG NỘI BỘ CỦA CÔNG TY NGUỒN.
       Tản Viên nhập hàng, giữ kho và bán nội bộ cho EMC · AA · Thái Phong.
       Không có chứng từ bán nội bộ nào được lập — nhưng phần chênh lệch giữa
       GIÁ NỘI BỘ và GIÁ VỐN KHO là lợi nhuận có thật của Tản Viên. Bỏ qua nó
       thì tổng lợi nhuận bốn công ty không bao giờ bằng lợi nhuận toàn nhóm.
       ------------------------------------------------------------------ */
    var laNguon = theoDonVi && T.laCtyNguon(loc.donViId);
    var dtNoiBo = 0, gvNoiBo = 0, chiTietNoiBo = [];
    if (laNguon) {
        var locKhac = {}; Object.keys(loc).forEach(function (k) { locKhac[k] = loc[k]; });
        delete locKhac.donViId;
        T.chungTuDoanhThu(locKhac).forEach(function (x) {
            if (!x.r.donVi || T.laCtyNguon(x.r.donVi)) return;   // chỉ chứng từ của đơn vị khác
            var sl = T.suyLuanChungTu(x.r);
            dtNoiBo += sl.tong.doanhThuNoiBo;
            gvNoiBo += sl.tong.giaVonGoc;
            /* GIỮ LẠI TỪNG CHỨNG TỪ CỦA TẦNG NỘI BỘ.
               Không có danh sách này thì mọi phép tách nhỏ theo tháng hay theo
               năm đều thiếu đúng phần doanh thu nội bộ, và tổng các tháng không
               bao giờ bằng con số của cả kỳ. Đây là bổ sung thuần: không một
               phép cộng nào của Engine bị đổi. */
            chiTietNoiBo.push({ coll: x.coll, ten: x.ten, r: x.r,
                                doanhThu: sl.tong.doanhThuNoiBo,
                                giaVon: sl.tong.giaVonGoc, giaVonGoc: sl.tong.giaVonGoc });
        });
    }

    var cp = T.chiPhiKy(loc);
    var doanhThuKhach = doanhThu, giaVonKhach = giaVon;
    doanhThu += dtNoiBo; giaVon += gvNoiBo;
    var loiNhuanGop = doanhThu - giaVon;
    var loiNhuan = loiNhuanGop - cp.tong;
    return {
        loc: loc, theoDonVi: theoDonVi, laCtyNguon: !!laNguon,
        doanhThu: doanhThu, giaVon: giaVon, giaVonGoc: giaVonGoc,
        doanhThuKhach: doanhThuKhach, giaVonKhach: giaVonKhach,
        doanhThuNoiBo: laNguon ? dtNoiBo : doanhThuNoiBo,
        giaVonNoiBo: gvNoiBo, loiNhuanNoiBo: dtNoiBo - gvNoiBo,
        soLuong: soLuong,
        chiPhi: cp.tong, chiPhiChiTiet: cp,
        loiNhuanGop: loiNhuanGop, loiNhuan: loiNhuan,
        bienLoiNhuan: doanhThu ? Math.round(loiNhuan / doanhThu * 1000) / 10 : 0,
        bienLoiNhuanGop: doanhThu ? Math.round(loiNhuanGop / doanhThu * 1000) / 10 : 0,
        soChungTu: ct.length, chiTiet: chiTiet, chiTietNoiBo: chiTietNoiBo
    };
};

/**
 * KẾT QUẢ KINH DOANH CỦA TỪNG ĐƠN VỊ PHÁT HÀNH.
 * Bỏ qua bộ lọc đơn vị của người gọi — bảng này luôn liệt kê đủ bốn công ty.
 */
T.ketQuaTungDonVi = function (loc) {
    loc = loc || {};
    return DB.all('donVi').map(function (dv) {
        var o = {}; Object.keys(loc).forEach(function (k) { o[k] = loc[k]; });
        o.donViId = dv.id;
        var kq = T.ketQuaKinhDoanh(o);
        kq.donVi = dv; kq.ten = dv.tat || dv.ten;
        return kq;
    }).filter(function (k) { return k.doanhThu || k.chiPhi || k.soChungTu; });
};

/**
 * KẾT QUẢ KINH DOANH CỦA TỪNG DỰ ÁN — MỘT LẦN QUÉT DUY NHẤT.
 * Gọi T.ketQuaKinhDoanh cho từng dự án sẽ dựng lại toàn bộ thang doanh thu mỗi
 * lần: hai mươi tám dự án là hai mươi tám lần quét sạch mọi chứng từ để lấy ra
 * vài dòng. Ở đây quét MỘT lần rồi chia về từng dự án.
 */
T.ketQuaTungDuAn = function (loc) {
    /* MỘT LẦN QUÉT DUY NHẤT cho mọi dự án — xem chú thích phía trên. */
    loc = loc || {};
    var theoDonVi = !!loc.donViId;
    var lc = {}; Object.keys(loc).forEach(function (k) { lc[k] = loc[k]; });
    delete lc.duAnId;

    var m = {};
    function o(id, ten) {
        if (!m[id]) m[id] = { duAnId: id, ten: ten, doanhThu: 0, giaVon: 0, giaVonGoc: 0,
                              chiPhi: 0, soChungTu: 0, soLuong: 0 };
        return m[id];
    }
    T.chungTuDoanhThu(lc).forEach(function (x) {
        var id = x.r.duAnId; if (!id) return;
        var da = DB.get('duAn', id); if (!da) return;
        var sl = T.suyLuanChungTu(x.r);
        var t = o(id, da.ten || da.ma);
        t.duAn = da;
        t.doanhThu += sl.tong.doanhThu;
        t.giaVonGoc += sl.tong.giaVonGoc;
        t.giaVon += theoDonVi ? sl.tong.giaVonDonVi : sl.tong.giaVonGoc;
        t.soChungTu++;
        t.soLuong += T.sum(x.r.lines || [], function (l) { return Number(l.soLuong) || 0; });
    });
    T.chiPhiKy(lc).ds.forEach(function (p) {
        var id = p.duAnId; if (!id) return;
        var da = DB.get('duAn', id); if (!da) return;
        var t = o(id, da.ten || da.ma);
        t.duAn = da;
        t.chiPhi += Number(p.soTien) || 0;
    });
    return Object.keys(m).map(function (k) {
        var t = m[k];
        t.loiNhuanGop = t.doanhThu - t.giaVon;
        t.loiNhuan = t.loiNhuanGop - t.chiPhi;
        t.bienLoiNhuan = t.doanhThu ? Math.round(t.loiNhuan / t.doanhThu * 1000) / 10 : 0;
        t.bienLoiNhuanGop = t.doanhThu ? Math.round(t.loiNhuanGop / t.doanhThu * 1000) / 10 : 0;
        return t;
    }).sort(function (a, b) { return b.loiNhuan - a.loiNhuan; });
};

/** Lợi nhuận theo MẶT HÀNG — gộp từ chính các chứng từ ghi nhận doanh thu. */
T.loiNhuanTheoMatHang = function (loc) {
    var theo = {};
    T.chungTuDoanhThu(loc).forEach(function (x) {
        var sl = T.suyLuanChungTu(x.r);
        var theoDV = !!(loc && loc.donViId);
        sl.dong.forEach(function (d) {
            var id = d.hangHoaId || d.maHang || d.tenHang;
            if (!id) return;
            if (!theo[id]) {
                var hh = DB.get('hangHoa', d.hangHoaId);
                theo[id] = { hangHoaId: d.hangHoaId, ma: (hh && hh.ma) || d.maHang,
                             model: (hh && hh.model) || d.maHang, ten: (hh && hh.ten) || d.tenHang,
                             dvt: d.dvt, soLuong: 0, doanhThu: 0, giaVon: 0, loiNhuan: 0 };
            }
            var t = theo[id];
            var gv = Math.round(d.soLuong * (theoDV ? d.giaVonDonVi : d.giaVonGoc));
            t.soLuong += d.soLuong; t.doanhThu += d.doanhThu; t.giaVon += gv;
            t.loiNhuan = t.doanhThu - t.giaVon;
        });
    });
    return Object.keys(theo).map(function (k) { return theo[k]; })
        .sort(function (a, b) { return b.loiNhuan - a.loiNhuan; });
};

/** Lợi nhuận theo KHÁCH HÀNG. */
T.loiNhuanTheoKhach = function (loc) {
    var theo = {}, theoDV = !!(loc && loc.donViId);
    T.chungTuDoanhThu(loc).forEach(function (x) {
        var id = x.r.khachHangId || '';
        var kh = id ? DB.get('khachHang', id) : null;
        var ten = (kh && kh.ten) || x.r.khachHang || 'Chưa gắn khách hàng';
        var k = id || ('#' + ten);
        if (!theo[k]) theo[k] = { khachHangId: id, ten: ten, soChungTu: 0,
                                  doanhThu: 0, giaVon: 0, loiNhuan: 0 };
        var sl = T.suyLuanChungTu(x.r);
        theo[k].soChungTu++;
        theo[k].doanhThu += sl.tong.doanhThu;
        theo[k].giaVon += theoDV ? sl.tong.giaVonDonVi : sl.tong.giaVonGoc;
        theo[k].loiNhuan = theo[k].doanhThu - theo[k].giaVon;
    });
    return Object.keys(theo).map(function (k) { return theo[k]; })
        .sort(function (a, b) { return b.loiNhuan - a.loiNhuan; });
};

/** Doanh thu theo THÁNG trong kỳ — dùng cho biểu đồ điều hành. */


/* ==========================================================================
   ĐỐI CHIẾU TỰ ĐỘNG
   Engine tự kiểm hai đẳng thức bắt buộc và báo ngay khi lệch. Không để một
   sai số nào tồn tại im lặng trong sổ sách.
       Tổng nhập − Tổng xuất = Tồn kho
       Doanh thu − Giá vốn − Chi phí = Lợi nhuận
   ========================================================================== */
T.doiChieuSo = function (loc) {
    loc = loc || {};
    var loi = [], canhBao = [];

    /* ------------------------------------------------------------------
       ĐẲNG THỨC 1 — TỔNG NHẬP − TỔNG XUẤT = TỒN KHO.
       Thẻ kho là sổ DẪN XUẤT và tự chèn một dòng "số dư đầu" để luôn khớp
       với tồn của danh mục — đối chiếu thẻ kho với danh mục là tự soi gương,
       không bao giờ lệch. Ở đây dựng lại số phát sinh TỪ CHÍNH CHỨNG TỪ GỐC
       (phiếu nhập đã ghi sổ · phiếu xuất · điều chỉnh tồn đã duyệt) rồi mới
       đem so với tồn của danh mục. Đây là phép kiểm THẬT.
       ------------------------------------------------------------------ */
    var nhap = 0, xuat = 0, psGoc = {}, dauKy = {};
    (DB.all('phieuNhap') || []).forEach(function (pn) {
        if (pn.trangThai !== 'Đã ghi sổ') return;
        (pn.lines || []).forEach(function (l) {
            var id = T.idDong(l); if (!id) return;
            var sl = Number(l.soLuong) || 0;
            nhap += sl;
            psGoc[id] = (psGoc[id] || 0) + sl;
            if (pn.nguon === 'Tồn đầu kỳ') dauKy[id] = (dauKy[id] || 0) + sl;
        });
    });
    (DB.all('phieuXuat') || []).forEach(function (px) {
        if (px.trangThai === 'Nháp' || px.trangThai === 'Đã hủy') return;
        (px.lines || []).forEach(function (l) {
            var id = T.idDong(l); if (!id) return;
            var sl = Number(l.soLuong) || 0;
            xuat += sl;
            psGoc[id] = (psGoc[id] || 0) - sl;
        });
    });
    (DB.all('dieuChinhKho') || []).forEach(function (dc) {
        if (dc.trangThai !== 'Đã duyệt') return;
        (dc.lines || []).forEach(function (l) {
            var id = T.idDong(l); if (!id) return;
            var ch = Number(l.chenh) || 0; if (!ch) return;
            if (ch > 0) nhap += ch; else xuat += -ch;
            psGoc[id] = (psGoc[id] || 0) + ch;
        });
    });

    var tonSo = T.sum(DB.all('hangHoa'), function (h) { return Number(h.ton) || 0; });
    var lechMH = [];
    DB.all('hangHoa').forEach(function (h) {
        var ps = psGoc[h.id] || 0;
        var ton = Number(h.ton) || 0;
        if (Math.abs(ps - ton) > 0.001)
            lechMH.push({ ma: h.ma, model: h.model, ten: h.ten, soSo: ps, ton: ton });
    });
    var lechKho = Math.round((nhap - xuat - tonSo) * 1000) / 1000;
    if (Math.abs(lechKho) > 0.001)
        loi.push({ ten: 'Tồn kho không khớp chứng từ nhập xuất',
                   moTa: 'Cộng từ chứng từ gốc: nhập ' + T.num(nhap, 2) + ' − xuất ' + T.num(xuat, 2) +
                         ' = ' + T.num(nhap - xuat, 2) + ', trong khi tồn của Danh mục hàng hóa là ' +
                         T.num(tonSo, 2) + '. Lệch ' + T.num(lechKho, 2) + '.',
                   huong: 'Vào Giá vốn & tồn kho → Tính lại toàn bộ giá vốn bình quân để dựng lại tồn ' +
                          'từ chứng từ gốc. Nếu vẫn lệch thì có tồn đầu kỳ chưa được nhập bằng phiếu ' +
                          'nhập kho nguồn "Tồn đầu kỳ".',
                   ds: lechMH.slice(0, 20) });
    else if (lechMH.length)
        loi.push({ ten: 'Tồn kho từng mặt hàng không khớp chứng từ nhập xuất',
                   moTa: lechMH.length + ' mặt hàng có tồn khác với số cộng từ chứng từ gốc, ' +
                         'dù tổng toàn kho vẫn cân.',
                   huong: 'Vào Giá vốn & tồn kho → Tính lại toàn bộ giá vốn bình quân.',
                   ds: lechMH.slice(0, 20) });

    /* ------------------------------------------------------------------
       ĐẲNG THỨC 2 — DOANH THU − GIÁ VỐN − CHI PHÍ = LỢI NHUẬN.
       Lấy chính công thức của Engine ra trừ lại là tự soi gương. Phép kiểm
       THẬT ở đây là: TỔNG kết quả của bốn công ty phải đúng bằng kết quả
       toàn nhóm. Hai con số này đi bằng hai đường tính khác nhau — một đường
       qua giá vốn nội bộ từng đơn vị cộng tầng nội bộ của công ty nguồn, một
       đường qua giá vốn thật của kho — nên lệch là có thật.
       ------------------------------------------------------------------ */
    var kq = T.ketQuaKinhDoanh(loc);
    var locNhom = {}; Object.keys(loc).forEach(function (k) { locNhom[k] = loc[k]; });
    delete locNhom.donViId;
    var nhomKQ = T.ketQuaKinhDoanh(locNhom);
    var tongDV = { doanhThu: 0, giaVon: 0, chiPhi: 0, loiNhuan: 0 };
    T.ketQuaTungDonVi(locNhom).forEach(function (k) {
        tongDV.doanhThu += k.doanhThu; tongDV.giaVon += k.giaVon;
        tongDV.chiPhi += k.chiPhi; tongDV.loiNhuan += k.loiNhuan;
    });
    var lechLN = Math.round(nhomKQ.loiNhuan - tongDV.loiNhuan);
    if (Math.abs(lechLN) > 4)
        loi.push({ ten: 'Tổng lợi nhuận các công ty không bằng lợi nhuận toàn nhóm',
                   moTa: 'Toàn nhóm ' + T.money(nhomKQ.loiNhuan) + ' đ, cộng từng công ty ' +
                         T.money(tongDV.loiNhuan) + ' đ, lệch ' + T.money(lechLN) + ' đ. ' +
                         'Thường do chứng từ hoặc phiếu chi chưa khai Đơn vị phát hành.',
                   huong: 'Kiểm tra các chứng từ và phiếu chi còn để trống Công ty thực hiện.' });

    var moCoiDV = DB.all('phieuChi').filter(function (p) {
        return p.trangThai === 'Đã ghi sổ' && !p.donVi && T.chiVaoChiPhi(p); }).length;
    if (moCoiDV)
        canhBao.push({ ten: 'Phiếu chi chưa khai Đơn vị phát hành',
                       moTa: moCoiDV + ' phiếu chi tính vào chi phí nhưng chưa gắn công ty nào — ' +
                             'chỉ vào được báo cáo toàn nhóm, không vào báo cáo từng công ty.',
                       huong: 'Mở từng phiếu chi và chọn Công ty thực hiện.' });

    /* ------------------------------------------------------------------
       DOANH THU KHÔNG ĐƯỢC GHI NHẬN HAI LẦN.
       So sánh theo mã giao dịch KHÔNG bắt được trường hợp nguy hiểm nhất là
       hai chứng từ của cùng một thương vụ mang HAI mã giao dịch khác nhau.
       Ở đây soi theo LIÊN KẾT CHA: một hợp đồng hay phiếu xuất trỏ về một đơn
       bán đã được ghi nhận mà lại tự ghi nhận thêm lần nữa là tính hai lần.
       ------------------------------------------------------------------ */
    var ct = T.chungTuDoanhThu(loc);
    var daGhi = {}, trung = [];
    ct.forEach(function (x) { daGhi[x.coll + ':' + x.r.id] = x; });
    ct.forEach(function (x) {
        if (x.coll === 'phuLuc') return;                 // phụ lục là phần cộng thêm, đúng thiết kế
        var cha = (x.r.donBanId && daGhi['donBan:' + x.r.donBanId]) ||
                  (x.r.hopDongId && daGhi['hopDong:' + x.r.hopDongId]);
        if (cha && cha !== x) trung.push({ con: x, cha: cha });
    });
    if (trung.length)
        loi.push({ ten: 'Một thương vụ được ghi nhận doanh thu nhiều lần',
                   moTa: trung.length + ' chứng từ vừa tự ghi nhận doanh thu vừa trỏ về một chứng từ ' +
                         'khác cũng đã được ghi nhận — cùng một khoản tiền bị tính hai lần.',
                   huong: 'Mở chứng từ con và đặt lại Mã giao dịch cho khớp chứng từ cha, ' +
                          'hoặc hủy chứng từ thừa.',
                   ds: trung.slice(0, 20).map(function (x) {
                       return { ma: x.con.r.so, ten: x.con.ten, model: 'thuộc ' + x.cha.r.so }; }) });

    var daGap = {}, trungGD = [];
    ct.forEach(function (x) {
        var k = x.r.maGD; if (!k || x.coll === 'phuLuc') return;
        if (daGap[k]) trungGD.push(x); else daGap[k] = x;
    });
    if (trungGD.length && !trung.length)
        loi.push({ ten: 'Nhiều chứng từ cùng mã giao dịch cùng được ghi nhận',
                   moTa: trungGD.length + ' chứng từ trùng mã giao dịch với chứng từ khác.',
                   huong: 'Chứng từ sao chép phải được cấp mã giao dịch mới. Kiểm tra lại các chứng từ này.',
                   ds: trungGD.slice(0, 20).map(function (x) {
                       return { ma: x.r.so, ten: x.ten, model: x.r.maGD }; }) });

    /* ------------------------------------------------------------------
       HÀNG RA KHỎI KHO MÀ KHÔNG MANG THEO DOANH THU.
       Phiếu xuất nằm ở bậc cuối của thang nên bao giờ cũng có mặt; điều đáng
       lo là phiếu xuất KHÔNG mang tiền và cũng không thuộc chứng từ nào có
       tiền — hàng đi mà sổ sách không ghi nhận đồng doanh thu nào.
       ------------------------------------------------------------------ */
    var xuatKhongTien = DB.all('phieuXuat').filter(function (px) {
        if (!T.tinhVaoKetQua(px)) return false;
        if (!T.hopLoc(px, loc)) return false;
        if (T.doanhThuChungTu(px) > 0) return false;
        var cha = (px.donBanId && DB.get('donBan', px.donBanId)) ||
                  (px.hopDongId && DB.get('hopDong', px.hopDongId));
        if (cha && T.tinhVaoKetQua(cha) && T.doanhThuChungTu(cha) > 0) return false;
        return T.sum(px.lines || [], function (l) { return Number(l.soLuong) || 0; }) > 0;
    });
    if (xuatKhongTien.length)
        canhBao.push({ ten: 'Hàng đã xuất kho nhưng không ghi nhận doanh thu',
                       moTa: xuatKhongTien.length + ' phiếu xuất có hàng ra khỏi kho mà đơn giá bằng 0 ' +
                             'và cũng không thuộc đơn bán hay hợp đồng nào có giá trị.',
                       huong: 'Điền đơn giá trên phiếu xuất, hoặc gắn phiếu xuất vào đúng đơn bán hàng.',
                       ds: xuatKhongTien.slice(0, 20).map(function (r) {
                           return { ma: r.so, ten: r.khachHang }; }) });

    /* ------------------------------------------------------------------
       LIÊN KẾT MỘT CHIỀU: LÔ NHẬP → PHIẾU NHẬP KHO.
       Mỗi lô đã vào sổ phải có ĐÚNG MỘT phiếu nhập còn hiệu lực. Hai phiếu là
       tồn kho và giá vốn đã bị ghi hai lần; không phiếu nào là lô đã đánh dấu
       vào sổ nhưng kho chưa hề nhận hàng.
       ------------------------------------------------------------------ */
    var loHai = [], loThieu = [], loNhapSai = [];
    DB.all('loNhap').forEach(function (lo) {
        var ds = DB.all('phieuNhap').filter(function (x) {
            return x.loNhapId === lo.id && x.trangThai !== 'Đã hủy'; });
        if (T.loDaVaoSo(lo)) {
            if (ds.length > 1) loHai.push({ ma: lo.so, ten: lo.nhaCungCap,
                model: ds.length + ' phiếu nhập' });
            else if (!ds.length) loThieu.push({ ma: lo.so, ten: lo.nhaCungCap });
        } else if (ds.length) {
            loNhapSai.push({ ma: lo.so, ten: lo.nhaCungCap, model: ds[0].so });
        }
    });
    if (loHai.length)
        loi.push({ ten: 'Một lô nhập sinh nhiều phiếu nhập kho',
                   moTa: loHai.length + ' lô nhập có hơn một phiếu nhập kho còn hiệu lực — ' +
                         'tồn kho và giá vốn của những lô này đã được ghi nhiều lần.',
                   huong: 'Mở Phiếu nhập kho, hủy các phiếu thừa; Engine sẽ trả tồn kho và giá vốn ' +
                          'về đúng một lần ghi.', ds: loHai.slice(0, 20) });
    if (loThieu.length)
        loi.push({ ten: 'Lô đánh dấu đã nhập kho nhưng không có phiếu nhập kho',
                   moTa: loThieu.length + ' lô ở trạng thái đã vào sổ mà kho chưa nhận hàng — ' +
                         'tồn kho đang thiếu đúng phần hàng của những lô này.',
                   huong: 'Mở lô, thu hồi trạng thái rồi bấm Nhập kho lại để Engine ghi đúng một lần.',
                   ds: loThieu.slice(0, 20) });
    if (loNhapSai.length)
        loi.push({ ten: 'Lô còn nháp nhưng đã có phiếu nhập kho',
                   moTa: loNhapSai.length + ' lô đang ở trạng thái nháp mà kho đã nhận hàng — ' +
                         'bước một đã chạm vào số liệu, trái với quy trình hai bước.',
                   huong: 'Hủy phiếu nhập kho của những lô này, kiểm tra lại lô rồi bấm Nhập kho.',
                   ds: loNhapSai.slice(0, 20) });

    /* ------------------------------------------------------------------
       PHIẾU CHI CHƯA KHAI KHOẢN MỤC — Engine không tính vào đâu cả, nên số
       chi phí đang thiếu đúng bằng tổng những phiếu này.
       ------------------------------------------------------------------ */
    var chuaKM = T.chiChuaPhanLoai(loc);
    if (chuaKM.length)
        canhBao.push({ ten: 'Phiếu chi chưa khai Khoản mục chi',
                       moTa: chuaKM.length + ' phiếu chi đã ghi sổ, tổng ' +
                             T.money(T.sum(chuaKM, function (p) { return Number(p.soTien) || 0; })) +
                             ' đ, chưa được phân loại nên CHƯA vào chi phí. Phần mềm không đoán thay ' +
                             'người dùng: đoán nhầm một khoản trả tiền hàng thành chi phí là tính hai ' +
                             'lần đúng khoản tiền đã nằm trong giá vốn.',
                       huong: 'Mở từng phiếu chi và chọn Khoản mục chi. Trả tiền hàng thì chọn ' +
                              '"Thanh toán tiền hàng nhà cung cấp"; chi phí thật thì chọn đúng khoản mục.',
                       ds: chuaKM.slice(0, 20).map(function (p) {
                           return { ma: p.so, ten: p.nhaCungCap }; }) });

    return { dat: !loi.length, loi: loi, canhBao: canhBao, kq: kq,
             nhom: { toanNhom: nhomKQ.loiNhuan, tongDonVi: tongDV.loiNhuan, lech: lechLN },
             kho: { nhap: nhap, xuat: xuat, ton: tonSo, lech: lechKho, lechMatHang: lechMH.length } };
};

/* ==========================================================================
   KIẾN TRÚC ĐA CÔNG TY — GIÁ GỐC NỘI BỘ VÀ BÚT TOÁN QUẢN TRỊ NỘI BỘ
   TVERP là MỘT hệ thống, MỘT cơ sở dữ liệu, MỘT kho trung tâm. Các công ty
   chỉ khác nhau ở biểu mẫu, thông tin pháp lý, người ký, con dấu, doanh thu
   và lợi nhuận. Toàn bộ nghiệp vụ quản trị nội bộ do hệ thống tự xử lý trong
   nền: không sinh chứng từ nội bộ, không sinh công nợ nội bộ, không sinh kho
   nội bộ và không phát sinh thao tác cho người dùng.
   ========================================================================== */
/** Cấu hình kiến trúc đa công ty (quản trị tự đổi được, không sửa chương trình). */
T.cauHinhDaCongTy = function () {
    var c = (DB.data && DB.data._meta && DB.data._meta.daCongTy) || {};
    return {
        ctyNguonId: c.ctyNguonId || ((DB.all('donVi').filter(function (x) { return x.laDonViKho; })[0] || {}).id || ''),
        cotGiaGoc: c.cotGiaGoc || 'Giá phân phối',
        batButToan: c.batButToan !== false
    };
};
/**
 * CHẾ ĐỘ HỆ THỐNG do Admin đặt: 'tuDong' · 'pre' · 'vanHanh'.
 * Đặt ở đây, cạnh các cấu hình cấp hệ thống khác, để KHỐI AI không phải đụng
 * trực tiếp vào DB.data — khối AI giữ đúng cam kết CHỈ ĐỌC QUA HÀM.
 */
/**
 * HAI CHẾ ĐỘ VẬN HÀNH CỦA HỆ THỐNG (v18.1.0).
 * Mặc định là PRE_OPERATION. AI KHÔNG được tự đổi; chỉ ADMIN đổi được.
 */
T.CHE_DO = { pre: 'PRE_OPERATION', live: 'LIVE_OPERATION' };
T.cheDoDat = function () {
    var v = (DB.data && DB.data._meta && DB.data._meta.cheDoHeThong) || '';
    /* Nhận cả giá trị cũ của 18.0.0 để không phá dữ liệu đã lưu. */
    if (v === T.CHE_DO.live || v === 'vanHanh') return T.CHE_DO.live;
    return T.CHE_DO.pre;
};
T.laVanHanhThat = function () { return T.cheDoDat() === T.CHE_DO.live; };

/** Công ty nguồn — nhập khẩu, sở hữu kho trung tâm và giá vốn (Tản Viên). */
T.ctyNguon = function () { return DB.get('donVi', T.cauHinhDaCongTy().ctyNguonId) || null; };
T.laCtyNguon = function (donViId) { return !!donViId && donViId === T.cauHinhDaCongTy().ctyNguonId; };

/**
 * BÚT TOÁN QUẢN TRỊ NỘI BỘ — SỔ DẪN XUẤT.
 * Dựng lại toàn bộ từ đơn bán hàng đã xác nhận nên LUÔN đồng bộ với chứng từ
 * gốc: sửa chứng từ thì bút toán tự cập nhật, hủy chứng từ thì bút toán tự mất.
 * Chỉ sinh cho đơn bán của công ty KHÁC công ty nguồn.
 */
T.BT_BO_QUA = ['Nháp', 'Đã hủy'];
T.dungButToanNB = function () {
    var d = DB.data; if (!d) return [];
    var cf = T.cauHinhDaCongTy();
    var bt = [];
    if (!cf.batButToan || !cf.ctyNguonId) { d.butToanNB = bt; return bt; }
    (d.donBan || []).forEach(function (db) {
        if (T.BT_BO_QUA.indexOf(db.trangThai) >= 0) return;
        if (!db.donVi || T.laCtyNguon(db.donVi)) return;   // Tản Viên bán thì ghi nhận trực tiếp
        /* TOÀN BỘ SỐ LIỆU LẤY TỪ BUSINESS RULE ENGINE — không tính lại ở đây,
           nên báo cáo quản trị và báo cáo pháp nhân không bao giờ lệch nhau. */
        var sl = T.suyLuanChungTu(db);
        var lines = sl.dong.map(function (x) {
            return {
                hangHoaId: x.hangHoaId, maHang: x.maHang, tenHang: x.tenHang, dvt: x.dvt,
                soLuong: x.soLuong,
                giaBanNoiBo: x.giaBanNoiBo, giaVon: x.giaVonGoc,
                giaBanKhach: x.soLuong ? Math.round(x.doanhThu / x.soLuong) : 0,
                tvDoanhThu: Math.round(x.soLuong * x.giaBanNoiBo),
                tvGiaVon: Math.round(x.soLuong * x.giaVonGoc),
                cbDoanhThu: x.doanhThu
            };
        });
        bt.push({
            id: 'BT-' + db.id, donBanId: db.id, donBanSo: db.so, ngay: db.ngay,
            khachHangId: db.khachHangId, khachHang: db.khachHang,
            ctyBanId: db.donVi, ctyNguonId: cf.ctyNguonId,
            lines: lines,
            tvDoanhThu: sl.tong.doanhThuNoiBo, tvGiaVon: sl.tong.giaVonGoc,
            tvLoiNhuan: sl.tong.loiNhuanNguon,
            cbDoanhThu: sl.tong.doanhThu, cbGiaMua: sl.tong.giaVonDonVi,
            cbLoiNhuan: sl.tong.loiNhuanPhatHanh,
            loiNhuanNhom: sl.tong.loiNhuanNhom,
            trangThai: db.trangThai, tuDong: true
        });
    });
    d.butToanNB = bt;
    return bt;
};
/**
 * ĐÓNG BĂNG GIÁ VỐN GỐC trên từng dòng hàng tại thời điểm lập chứng từ.
 * Giá vốn gốc là căn cứ tính lợi nhuận của công ty nguồn; nhập hàng về sau làm
 * đổi giá vốn bình quân cũng KHÔNG làm thay đổi lợi nhuận của chứng từ đã lập.
 */
T.dongBangGiaGocNB = function (o) {
    if (!o) return o;
    (o.lines || []).forEach(function (l) {
        if (l.giaVonGoc === undefined || !(Number(l.giaVonGoc) > 0))
            l.giaVonGoc = T.giaVonGoc(l, o.ngay);
    });
    return o;
};
/** Bút toán quản trị của một đơn bán (nếu có). */
T.butToanCua = function (donBanId) {
    return DB.all('butToanNB').filter(function (b) { return b.donBanId === donBanId; })[0] || null;
};
/**
 * DOANH THU · GIÁ VỐN · LỢI NHUẬN THEO CÔNG TY (quản trị nội bộ).
 *   ds        — danh sách đơn bán đã lọc theo kỳ
 *   goDT      — true: loại trừ doanh thu nội bộ khi tính toàn hệ thống
 * Trả về { theoCty: { donViId: {dt, gv, ln} }, toanHT: {...} }
 */
T.quanTriDoanhThu = function (ds, goDTNoiBo) {
    var cf = T.cauHinhDaCongTy();
    var m = {};
    function o(id) {
        if (!m[id]) m[id] = { donViId: id, dt: 0, gv: 0, ln: 0, dtNoiBo: 0, gvNoiBo: 0 };
        return m[id];
    }
    DB.all('donVi').forEach(function (d) { o(d.id); });
    (ds || []).forEach(function (db) {
        if (T.BT_BO_QUA.indexOf(db.trangThai) >= 0) return;
        /* MỘT NGUỒN SỐ LIỆU DUY NHẤT — Business Rule Engine. */
        var s2 = T.suyLuanChungTu(db);
        if (s2.laNguon) {
            var c = o(db.donVi || cf.ctyNguonId);
            c.dt += s2.tong.doanhThu; c.gv += s2.tong.giaVonGoc; c.ln += s2.tong.loiNhuanNguon;
            return;
        }
        // Đơn vị phát hành: doanh thu bán khách, giá vốn là giá mua nội bộ
        var a = o(db.donVi);
        a.dt += s2.tong.doanhThu; a.gv += s2.tong.giaVonDonVi; a.ln += s2.tong.loiNhuanPhatHanh;
        // Công ty nguồn: doanh thu nội bộ, giá vốn gốc
        var b = o(cf.ctyNguonId);
        b.dt += s2.tong.doanhThuNoiBo; b.gv += s2.tong.giaVonGoc; b.ln += s2.tong.loiNhuanNguon;
        b.dtNoiBo += s2.tong.doanhThuNoiBo; b.gvNoiBo += s2.tong.giaVonGoc;
    });
    var tong = { donViId: '', dt: 0, gv: 0, ln: 0, dtNoiBo: 0, gvNoiBo: 0 };
    Object.keys(m).forEach(function (k) {
        tong.dt += m[k].dt; tong.gv += m[k].gv; tong.ln += m[k].ln;
        tong.dtNoiBo += m[k].dtNoiBo; tong.gvNoiBo += m[k].gvNoiBo;
    });
    if (goDTNoiBo) {
        /* Loại trừ luân chuyển nội bộ: doanh thu nội bộ của công ty nguồn chính
           là giá vốn của đơn vị phát hành, khử đi thì còn đúng lợi nhuận nhóm. */
        tong.dt -= tong.dtNoiBo;
        tong.gv -= tong.dtNoiBo;
    }
    return { theoCty: m, toanHT: tong };
};

/* ---------------------------------------- GIÁ VỐN THEO ĐƠN VỊ PHÁT HÀNH */
/**
 * Giá vốn của một mã hàng theo ĐƠN VỊ PHÁT HÀNH chứng từ, tại một ngày.
 *   - Tản Viên (đơn vị giữ kho)  → giá vốn bình quân gia quyền di động.
 *   - EMC / AA / Thái Phong      → giá nội bộ do Engine tính giá sinh ra.
 * Có truyền ngày → lấy đúng dữ liệu có hiệu lực tại thời điểm đó.
 */
T.giaVonTheoDonVi = function (maHang, donViId, ngay, bangGiaId, cotGia) {
    /* LỚP MỎNG CỦA BUSINESS RULE ENGINE — giữ tên gọi cũ cho các phân hệ đang
       dùng, nhưng câu trả lời chỉ đến từ một chỗ duy nhất. */
    return T.giaVonDonVi(maHang, donViId, ngay, bangGiaId, cotGia);
};

/* ------------------------------------------- LÃI GỘP TÍNH TRÊN CHỨNG TỪ */
/** Tổng giá vốn đã đóng băng trên một chứng từ. */
T.giaVonChungTu = function (r) {
    return T.sum(r.lines || [], function (l) {
        return (Number(l.soLuong) || 0) * (Number(l.giaVon) || 0);
    });
};
/**
 * Đóng dấu giá vốn vào từng dòng theo đơn vị phát hành — chỉ làm khi dòng chưa
 * có giá vốn. Giá nội bộ lấy theo ĐÚNG phiên bản bảng giá của chứng từ.
 * Dòng mang cờ l.giaVonKhoa (giá vốn lịch sử) KHÔNG BAO GIỜ bị Engine tính lại.
 */
T.dongBangGiaVon = function (r, batBuoc) {
    var dv = r.donVi || '';
    var bg = r.bangGiaId || '';
    var cot = r.cotGia || '';
    (r.lines || []).forEach(function (l) {
        /* GIÁ VỐN LỊCH SỬ — số liệu của những năm chưa quản lý bằng phần mềm,
           không tái lập được từ lô nhập. Engine KHÔNG BAO GIỜ tính lại. */
        if (l.giaVonKhoa) return;
        /* ĐÃ ĐÓNG BĂNG — chỉ giữ nguyên khi vẫn ĐÚNG đơn vị phát hành, ĐÚNG
           phiên bản bảng giá và ĐÚNG loại giá đã dùng lúc đóng băng. Người dùng
           đổi một trong ba đầu vào đó rồi lưu lại thì giá vốn nội bộ PHẢI được
           Engine tính lại, nếu không lợi nhuận hai tầng sẽ sai lặng lẽ.
           Sửa GIÁ BÁN KHÁCH không nằm trong ba đầu vào này nên không bao giờ
           làm thay đổi giá vốn nội bộ. */
        var giu = !batBuoc && l.giaVon !== undefined && l.giaVon !== '' &&
                  (l.donViGiaVon === undefined || l.donViGiaVon === dv) &&
                  /* Mốc rỗng nghĩa là chứng từ chưa từng chốt phiên bản / loại giá.
                     Biểu mẫu tự điền một bảng giá mặc định KHÔNG phải là người
                     dùng đổi phiên bản, nên không được coi là căn cứ tính lại giá
                     vốn của một chứng từ đã phát hành. */
                  (!l.bangGiaGiaVon || !bg || l.bangGiaGiaVon === bg) &&
                  (!l.cotGiaVon || !cot || l.cotGiaVon === cot);
        if (giu) return;
        l.giaVon = T.giaVonTheoDonVi(T.idDong(l) || l.maHang, dv, r.ngay, bg, cot);
        l.nguonGiaVon = T.laCtyNguon(dv) ? 'Bình quân' : 'Nội bộ';
        l.ngayGiaVon = r.ngay;
        l.donViGiaVon = dv;
        l.bangGiaGiaVon = bg;
        l.cotGiaVon = cot;
        /* CHIẾT KHẤU NỘI BỘ ĐÃ ÁP — chụp lại đúng mức phần trăm của phiên bản
           bảng giá tại thời điểm lập. Con số giá vốn nội bộ đã đủ để tính lợi
           nhuận, nhưng phải giữ cả căn cứ thì chứng từ cũ mới tự giải thích
           được vì sao ra con số đó, kể cả khi bảng giá về sau đổi chiết khấu. */
        l.ckNoiBo = T.laCtyNguon(dv) ? 0
                  : T.chietKhauNoiBo(T.phienBanTinhGia(l, bg, r.ngay), dv);
    });
    r.tongGiaVon = T.giaVonChungTu(r);
    r.laiGop = (Number(r.thanhTien) || 0) - r.tongGiaVon;
    return r;
};

/* ------------------------------------ KẾT QUẢ KINH DOANH THEO PHÁP NHÂN */
T.ketQuaTheoDonVi = function (donViId, tu, den) {
    /* MỘT BỘ MÁY DUY NHẤT. Trước đây hàm này tự cộng doanh thu từ đơn bán và tự
       lấy giá vốn đã đóng băng — một cách tính thứ hai song song với Business
       Engine, nên hai tab của cùng màn hình Báo cáo ra hai con số lãi gộp khác
       nhau. Nay chỉ còn là lớp bọc mỏng quanh Engine, cộng thêm phần TIỀN
       (đã thu · phải thu) vốn không thuộc kết quả kinh doanh. */
    var loc = {};
    if (tu) loc.tuNgay = tu;
    if (den) loc.denNgay = den;
    if (donViId) loc.donViId = donViId;
    var kq = T.ketQuaKinhDoanh(loc);

    function trongKy(x) {
        return (!tu || x.ngay >= tu) && (!den || x.ngay <= den) &&
            (!donViId || x.donVi === donViId);
    }
    /* Phải thu là số TIỀN khách còn nợ nên tính trên TỔNG CỘNG đã gồm thuế —
       phiếu thu thu cả thuế. Đây là dòng tiền, không phải doanh thu. */
    var db = DB.all('donBan').filter(function (d) {
        return trongKy(d) && T.tinhVaoKetQua(d);
    });
    var tongCong = T.sum(db, function (d) { return Number(d.tongCong) || 0; });
    var thu = T.sum(DB.all('phieuThu').filter(function (p) {
        return trongKy(p) && p.trangThai === 'Đã ghi sổ'; }), function (p) { return p.soTien; });

    return {
        donViId: donViId,
        ten: donViId ? (DB.get('donVi', donViId) || {}).tat : 'Toàn nhóm',
        soDon: kq.soChungTu, soLuong: kq.soLuong,
        doanhThu: kq.doanhThu, giaVon: kq.giaVon,
        chiPhi: kq.chiPhi, loiNhuan: kq.loiNhuan,
        laiGop: kq.loiNhuanGop, tySuat: kq.bienLoiNhuanGop,
        bienLoiNhuan: kq.bienLoiNhuan,
        phaiThu: tongCong - thu, daThu: thu, tongCong: tongCong
    };
};

/**
 * GIÁ NHẬP GẦN NHẤT của một mã hàng — lấy từ lô nhập mới nhất đã nhập kho.
 * Trả về { donGia, giaVonLo, ngay, loSo, nhaCungCap } hoặc null nếu chưa từng nhập.
 */
T.giaNhapGanNhat = function (hang) {
    var id = T.idHH(hang);
    if (!id) return null;
    function trung(x) { return T.idDong(x) === id; }
    var ds = DB.all('loNhap').filter(function (l) {
        return (l.trangThai === 'Đã nhập kho' || l.trangThai === 'Tồn đầu kỳ') &&
            (l.lines || []).some(trung);
    }).slice().sort(function (a, b) { return a.ngay < b.ngay ? 1 : -1; });
    if (!ds.length) return null;
    var lo = ds[0];
    var d = (lo.lines || []).filter(trung)[0] || {};
    return { donGia: Number(d.donGia) || 0, giaVonLo: Number(d.giaVonLo) || 0,
             soLuong: Number(d.soLuong) || 0, ngay: lo.ngay, loSo: lo.so,
             nhaCungCap: lo.nhaCungCap || '', loai: lo.loai || '' };
};

/** Giá bán của một mã hàng trên TẤT CẢ các bảng giá đang áp dụng. */
T.giaMoiBangGia = function (maHang, ngay) {
    return T.bangGiaHieuLuc(ngay).map(function (b) {
        return { id: b.id, ten: b.ten, gia: T.giaBan(maHang, b.id, ngay) };
    });
};

/** Giá trị tồn kho theo giá vốn bình quân — chỉ có MỘT kho, thuộc Tản Viên. */
T.tonKhoNhom = function () {
    var hh = DB.all('hangHoa');
    return {
        soMa: hh.length,
        soLuong: T.sum(hh, function (x) { return x.ton; }),
        giaTri: T.giaTriTonKho(hh)
    };
};

/* ==========================================================================
   PHÂN HỆ KHO — 01 KHO VẬT LÝ DUY NHẤT (thuộc Tản Viên)
   Thẻ kho là sổ DẪN XUẤT: dựng lại từ Lô nhập + Phiếu xuất + Điều chỉnh.
   Không có kho riêng theo công ty, không có chuyển kho nội bộ.
   ========================================================================== */
T.LOAI_TK = [
    { k: 'dauKy',     t: 'Số dư đầu',    i: 'bi-database',          dau: 1 },
    { k: 'tonDau',    t: 'Tồn đầu kỳ',   i: 'bi-database-fill-add', dau: 1 },
    { k: 'nhap',      t: 'Nhập hàng',    i: 'bi-box-arrow-in-down' },
    { k: 'xuat',      t: 'Xuất hàng',    i: 'bi-box-arrow-right' },
    { k: 'kiemKe',    t: 'Kiểm kê',      i: 'bi-clipboard-data' },
    { k: 'dieuChinh', t: 'Điều chỉnh',   i: 'bi-sliders2' }
];
T.tenLoaiTK = function (k) {
    for (var i = 0; i < T.LOAI_TK.length; i++) if (T.LOAI_TK[i].k === k) return T.LOAI_TK[i].t;
    return k;
};
/** Thứ tự phát sinh trong cùng một ngày: nhập trước, rồi xuất, rồi điều chỉnh. */
var _HANG_TK = { dauKy: 0, tonDau: 1, nhap: 2, xuat: 3, kiemKe: 4, dieuChinh: 5 };

/**
 * DỰNG LẠI TOÀN BỘ THẺ KHO từ chứng từ gốc.
 * Nguồn phát sinh:
 *   - Lô nhập đã nhập kho / tồn đầu kỳ          → nhập  (+)
 *   - Phiếu xuất kho đã xuất                    → xuất  (−)
 *   - Phiếu điều chỉnh tồn kho đã duyệt         → điều chỉnh (±)
 * Nếu tồn cuối theo thẻ kho lệch với tồn đang lưu ở danh mục hàng hóa, hệ thống
 * ghi một dòng "Số dư đầu (dữ liệu chuyển đổi)" để sổ kho luôn khớp tồn thực tế.
 */
T.dungTheKho = function () {
    var d = DB.data, sk = [];
    /* Thẻ kho đánh theo ID NỘI BỘ: nhiều mặt hàng có thể dùng chung một Model,
       đánh theo Model sẽ cộng dồn tồn của các mặt hàng khác nhau vào một dòng. */
    var hhMap = {};
    (d.hangHoa || []).forEach(function (h) { hhMap[h.id] = h; });

    function them(o) { sk.push(o); }

    (d.phieuNhap || []).forEach(function (pn) {
        if (pn.trangThai !== 'Đã ghi sổ') return;
        (pn.lines || []).forEach(function (l) {
            them({ ngay: pn.ngay, loai: pn.nguon === 'Tồn đầu kỳ' ? 'tonDau' : 'nhap',
                ctLoai: 'phieuNhap', ctId: pn.id, ctSo: pn.so, ctRoute: 'phieu-nhap',
                hangHoaId: T.idDong(l), maHang: l.maHang, tenHang: l.tenHang, dvt: l.dvt,
                sl: Number(l.soLuong) || 0,
                donGia: Number(l.giaVon) || 0, doiTac: pn.nhaCungCap || '',
                ai: pn.nguoiLap || pn._nguoiTao || '',
                dienGiai: pn.ghiChu || ('Nhập kho — nguồn ' + (pn.nguon || '')) });
        });
    });

    (d.phieuXuat || []).forEach(function (px) {
        if (px.trangThai === 'Nháp' || px.trangThai === 'Đã hủy') return;
        (px.lines || []).forEach(function (l) {
            them({ ngay: px.ngay, loai: 'xuat', ctLoai: 'phieuXuat', ctId: px.id, ctSo: px.so,
                ctRoute: 'phieu-xuat', hangHoaId: T.idDong(l),
                maHang: l.maHang, tenHang: l.tenHang, dvt: l.dvt,
                /* KHO LÀ TÀI SẢN CỦA NHÓM — giá trị xuất kho luôn tính theo GIÁ
                   VỐN GỐC, không bao giờ theo giá nội bộ của đơn vị phát hành,
                   nếu không báo cáo Nhập - Xuất - Tồn sẽ bị thổi theo chính sách
                   giá nội bộ của từng công ty. */
                sl: -(Number(l.soLuong) || 0),
                donGia: Number(l.giaVonGoc) > 0 ? Number(l.giaVonGoc) : T.giaVonGoc(l, px.ngay),
                doiTac: px.khachHang || '', donVi: px.donVi, maGD: px.maGD,
                ai: px.nguoiLap || px._nguoiTao || '',
                dienGiai: px.lyDo || ('Xuất bán cho ' + (px.khachHang || '')) });
        });
    });

    (d.dieuChinhKho || []).forEach(function (dc) {
        if (dc.trangThai !== 'Đã duyệt') return;
        (dc.lines || []).forEach(function (l) {
            var ch = Number(l.chenh) || 0;
            if (!ch) return;
            them({ ngay: dc.ngay, loai: dc.kiemKeId ? 'kiemKe' : 'dieuChinh',
                ctLoai: 'dieuChinhKho', ctId: dc.id, ctSo: dc.so, ctRoute: 'dieu-chinh-ton',
                hangHoaId: T.idDong(l), maHang: l.maHang, tenHang: l.tenHang, dvt: l.dvt, sl: ch,
                donGia: Number(l.giaVon) || 0, ai: dc.nguoiDuyet || dc.nguoiThucHien || '',
                dienGiai: (dc.lyDo || 'Điều chỉnh tồn kho') + (l.ghiChu ? ' — ' + l.ghiChu : '') });
        });
    });

    // số dư đầu để sổ kho khớp với tồn hiện tại trong danh mục hàng hóa
    var ngayDau = '2000-01-01';
    sk.forEach(function (x) { if (x.ngay && x.ngay < ngayDau) ngayDau = x.ngay; });
    ngayDau = T.addDays(sk.length ? sk.reduce(function (a, b) { return a.ngay < b.ngay ? a : b; }).ngay : T.today(), -1);
    var ps = {};
    sk.forEach(function (x) { ps[x.hangHoaId] = (ps[x.hangHoaId] || 0) + x.sl; });
    Object.keys(hhMap).forEach(function (id) {
        var h = hhMap[id];
        var chenh = (Number(h.ton) || 0) - (ps[id] || 0);
        if (!chenh) return;
        them({ ngay: ngayDau, loai: 'dauKy', ctLoai: '', ctId: '', ctSo: '—',
            hangHoaId: id, maHang: h.ma,
            tenHang: h.ten, dvt: h.dvt, sl: chenh,
            donGia: Number(h.giaVonBQ === undefined ? h.giaVon : h.giaVonBQ) || 0,
            ai: 'hệ thống', dienGiai: 'Số dư đầu (dữ liệu chuyển đổi từ Excel)' });
    });

    sk.sort(function (a, b) {
        if (a.ngay !== b.ngay) return a.ngay < b.ngay ? -1 : 1;
        var ha = _HANG_TK[a.loai] || 9, hb = _HANG_TK[b.loai] || 9;
        if (ha !== hb) return ha - hb;
        return (a.ctSo || '') < (b.ctSo || '') ? -1 : 1;
    });

    var ton = {};
    sk.forEach(function (x, i) {
        ton[x.hangHoaId] = (ton[x.hangHoaId] || 0) + x.sl;
        x.id = 'TK' + ('0000' + (i + 1)).slice(-5);
        x.tonSau = ton[x.hangHoaId];
        x.giaTri = Math.round(Math.abs(x.sl) * (Number(x.donGia) || 0));
        x.nhap = x.sl > 0 ? x.sl : 0;
        x.xuat = x.sl < 0 ? -x.sl : 0;
    });
    d.theKho = sk;
    return sk;
};

/** Toàn bộ thẻ kho (tự dựng lại nếu chưa có). */
T.theKho = function () {
    if (!DB.data.theKho || !DB.data.theKho.length) T.dungTheKho();
    return DB.data.theKho;
};
/** Thẻ kho của một mặt hàng, mới nhất trước — đối chiếu bằng ID NỘI BỘ. */
T.theKhoCuaMa = function (hang) {
    var id = T.idHH(hang);
    if (!id) return [];
    return T.theKho().filter(function (x) { return T.idDong(x) === id; })
        .slice().reverse();
};
/** Tồn kho của một mã hàng tại một ngày (cuối ngày đó). */
T.tonTaiNgay = function (hang, ngay) {
    var id = T.idHH(hang);
    if (!id) return 0;
    return T.sum(T.theKho().filter(function (x) {
        return (x.hangHoaId || T.idHH(x.maHang)) === id && (!ngay || x.ngay <= ngay);
    }), function (x) { return x.sl; });
};

/**
 * BÁO CÁO NHẬP - XUẤT - TỒN theo khoảng thời gian.
 * Trả về mảng theo từng mã hàng: tồn đầu, nhập trong kỳ, xuất trong kỳ, tồn cuối
 * (cả số lượng và giá trị).
 */
T.nxt = function (tu, den) {
    var sk = T.theKho(), m = {};
    /* Sổ nhập-xuất-tồn đánh theo ID NỘI BỘ của hàng hóa. */
    function o(id) {
        var ma = id;
        if (!m[ma]) {
            var h = T.hh(id) || {};
            m[ma] = { id: h.id || id, ma: h.ma || id, maNoiBo: h.maNoiBo || '',
                ten: h.ten || id, dvt: h.dvt || '', nhomHang: h.nhom || '',
                thongSo: h.thongSo || '',
                thuongHieu: h.thuongHieu || h.hang || '', nhaSX: h.nhaSanXuat || h.xuatXu || '',
                bq: T.giaVonBQ(id),
                slDau: 0, gtDau: 0, slNhap: 0, gtNhap: 0, slXuat: 0, gtXuat: 0, slCuoi: 0, gtCuoi: 0,
                soLanNhap: 0, soLanXuat: 0, ngayCuoi: '' };
        }
        return m[ma];
    }
    sk.forEach(function (x) {
        var r = o(x.hangHoaId || T.idHH(x.maHang));
        if (tu && x.ngay < tu) { r.slDau += x.sl; r.gtDau += x.sl * (Number(x.donGia) || 0); return; }
        if (den && x.ngay > den) return;
        if (x.sl > 0) { r.slNhap += x.sl; r.gtNhap += x.giaTri; r.soLanNhap++; }
        else if (x.sl < 0) { r.slXuat += -x.sl; r.gtXuat += x.giaTri; r.soLanXuat++; }
        if (x.ngay > r.ngayCuoi) r.ngayCuoi = x.ngay;
    });
    // các mã chưa phát sinh trong kỳ vẫn phải có mặt để đối chiếu tồn
    DB.all('hangHoa').forEach(function (h) { o(h.id); });
    return Object.keys(m).map(function (k) {
        var r = m[k];
        r.gtDau = Math.round(r.gtDau);
        r.slCuoi = r.slDau + r.slNhap - r.slXuat;
        r.gtCuoi = Math.round(r.slCuoi * r.bq);
        return r;
    });
};

/** Ghi nhận xuất kho cho một phiếu xuất: trừ tồn và dựng lại thẻ kho. */
T.ghiXuatKho = function (px) {
    (px.lines || []).forEach(function (l) {
        var hh = T.hh(l);
        if (hh) hh.ton = (Number(hh.ton) || 0) - (Number(l.soLuong) || 0);
    });
    T.dungTheKho(); DB.save();
    return px;
};

/** Duyệt một phiếu điều chỉnh tồn kho: cộng/trừ tồn theo chênh lệch rồi dựng lại thẻ kho. */
T.ghiDieuChinh = function (dc) {
    (dc.lines || []).forEach(function (l) {
        var hh = T.hh(l);
        if (hh) hh.ton = (Number(hh.ton) || 0) + (Number(l.chenh) || 0);
    });
    dc.trangThai = 'Đã duyệt';
    dc.ngayDuyet = T.today();
    T.dungTheKho();
    DB.log('Duyệt điều chỉnh tồn kho', 'dieuChinhKho', dc);
    DB.save();
    return dc;
};

/** Cảnh báo tồn: hàng sắp hết / tồn nhiều / lâu không phát sinh. */
T.canhBaoKho = function (soNgayIm) {
    soNgayIm = soNgayIm || 120;
    var moc = T.addDays(T.today(), -soNgayIm);
    var nxt = T.nxt('', ''), sapHet = [], tonNhieu = [], im = [];
    nxt.forEach(function (r) {
        var h = T.hh(r.id || r.ma) || {};
        var dm = Number(h.tonToiThieu) || 0;
        r.tonToiThieu = dm;
        r.ton = Number(h.ton) || 0;
        r.giaTriTon = Math.round(r.ton * r.bq);
        if (r.ton <= (dm || 5)) sapHet.push(r);
        if (r.ton > 0 && (!r.ngayCuoi || r.ngayCuoi < moc)) im.push(r);
        tonNhieu.push(r);
    });
    tonNhieu.sort(function (a, b) { return b.giaTriTon - a.giaTriTon; });
    sapHet.sort(function (a, b) { return a.ton - b.ton; });
    im.sort(function (a, b) { return (a.ngayCuoi || '') < (b.ngayCuoi || '') ? -1 : 1; });
    return { sapHet: sapHet, tonNhieu: tonNhieu.slice(0, 20), im: im, moc: moc, soNgayIm: soNgayIm };
};

/* ------------------------------------------------ MÀU NHÃN TRẠNG THÁI */
var MAU = {
    'Nháp': 'n', 'Đã gửi KH': 'c', 'Đã duyệt': 'b', 'Đã chốt': 'g', 'Từ chối': 'r', 'Hết hiệu lực': 'n',
    'Đã xác nhận': 'b', 'Đang giao': 'c', 'Hoàn thành': 'g', 'Đã hủy': 'r',
    'Đã ký': 'b', 'Đang thực hiện': 'c', 'Đã thanh lý': 'g',
    'Đã xuất kho': 'g', 'Chờ xuất': 'y',
    'Đã giao hàng': 'g', 'Chờ giao': 'y', 'Đã nghiệm thu': 'g', 'Chờ nghiệm thu': 'y',
    'Đã gửi': 'c', 'Đã duyệt chi': 'g', 'Chờ duyệt': 'y',
    'Đã ghi sổ': 'g', 'Chưa ghi sổ': 'y',
    'Đã đặt hàng': 'c', 'Đã nhận hàng': 'g',
    'Chờ kiểm tra': 'y', 'Chờ nhập kho': 'c', 'Đã nhập kho': 'g', 'Tồn đầu kỳ': 'b',
    'Chờ phân bổ': 'y', 'Đã phân bổ chi phí': 'c',
    'Chờ nhập': 'y', 'Đã kiểm tra': 'c',
    'Đang hiệu lực': 'g', 'Chưa hiệu lực': 'y', 'Hết hiệu lực': 'n', 'Đã thay thế': 'n', 'Ngừng áp dụng': 'r',
    'Đang giao dịch': 'g', 'Ngừng giao dịch': 'n', 'Đang kinh doanh': 'g', 'Ngừng kinh doanh': 'n',
    'Đang dùng': 'g', 'Hoạt động': 'g', 'Khóa': 'r', 'Đang áp dụng': 'g',
    'Còn hàng': 'g', 'Sắp hết': 'y', 'Hết hàng': 'r', 'Âm kho': 'r',
    'Quá hạn': 'r', 'Trong hạn': 'g', 'Đã thanh toán': 'g', 'Còn nợ': 'y'
};
/* Badge trạng thái LUÔN có biểu tượng — một hàm duy nhất cho cả phần mềm, nên
   không màn hình nào lỡ dùng kiểu cũ. Muốn badge trơn thì gọi T.pillTron. */
T.pillTron = function (tt) {
    return '<span class="pill ' + (MAU[tt] || 'n') + '">' + T.esc(tt) + '</span>';
};
T.pill = function (tt) { return T.pillIco(tt); };

/* Biểu tượng đi kèm trạng thái — người dùng nhận ra tình trạng bằng hình dạng
   chứ không chỉ bằng màu, nên nhìn lướt qua cũng thấy và người khó phân biệt
   màu vẫn đọc được. */
var ICO_TT = {
    'Nháp': 'bi-pencil', 'Chờ kiểm tra': 'bi-hourglass-split', 'Chờ nhập kho': 'bi-clipboard-check',
    'Đã nhập kho': 'bi-check-circle-fill', 'Tồn đầu kỳ': 'bi-archive-fill',
    'Đã hủy': 'bi-x-circle-fill', 'Đã ghi sổ': 'bi-check-circle-fill', 'Chưa ghi sổ': 'bi-hourglass-split',
    'Đã đặt hàng': 'bi-cart', 'Đã nhận hàng': 'bi-check-circle-fill',
    'Đã gửi KH': 'bi-send', 'Đã chốt': 'bi-check-circle-fill', 'Từ chối': 'bi-x-circle-fill',
    'Đã duyệt': 'bi-patch-check-fill', 'Chờ duyệt': 'bi-hourglass-split',
    'Đã xuất kho': 'bi-box-arrow-right', 'Chờ xuất': 'bi-hourglass-split',
    'Đã giao hàng': 'bi-truck', 'Chờ giao': 'bi-hourglass-split',
    'Đã nghiệm thu': 'bi-patch-check-fill', 'Chờ nghiệm thu': 'bi-hourglass-split',
    'Đã thanh toán': 'bi-cash-coin', 'Còn nợ': 'bi-exclamation-circle',
    'Quá hạn': 'bi-exclamation-triangle-fill', 'Trong hạn': 'bi-check-circle',
    'Hoàn thành': 'bi-check-circle-fill', 'Đang thực hiện': 'bi-arrow-repeat',
    'Đang dùng': 'bi-check-circle', 'Ngừng dùng': 'bi-slash-circle',
    'Hoạt động': 'bi-check-circle', 'Khóa': 'bi-lock-fill',
    'Còn hàng': 'bi-boxes', 'Sắp hết': 'bi-exclamation-triangle', 'Hết hàng': 'bi-x-octagon',
    'Âm kho': 'bi-x-octagon-fill'
};
T.icoTrangThai = function (tt) { return ICO_TT[tt] || ''; };
/** Badge trạng thái CÓ BIỂU TƯỢNG — dùng cho mọi màn hình danh sách. */
T.pillIco = function (tt) {
    tt = String(tt === undefined || tt === null ? '' : tt);
    if (!tt) return '<span class="muted">—</span>';
    var i = ICO_TT[tt];
    return '<span class="pill ' + (MAU[tt] || 'n') + '">' +
        (i ? '<i class="bi ' + i + '"></i> ' : '') + T.esc(tt) + '</span>';
};

/* ==========================================================================
   PHÂN QUYỀN — Người dùng → Vai trò → Quyền
   Mỗi vai trò được cấp quyền chi tiết theo TỪNG PHÂN HỆ × TỪNG HÀNH ĐỘNG.
   ========================================================================== */
var Q = {};

Q.HANH_DONG = [
    { k: 'xem',       t: 'Xem',                mo: 'Mở màn hình và xem dữ liệu' },
    { k: 'them',      t: 'Thêm',               mo: 'Tạo bản ghi / chứng từ mới' },
    { k: 'sua',       t: 'Sửa',                mo: 'Sửa bản ghi đã có' },
    { k: 'xoa',       t: 'Xóa',                mo: 'Xóa bản ghi (đưa vào Thùng rác)' },
    { k: 'duyet',     t: 'Duyệt',              mo: 'Duyệt / ghi sổ chứng từ' },
    { k: 'khoa',      t: 'Khóa chứng từ',      mo: 'Khóa hoặc mở khóa chứng từ, chứng từ đã khóa không sửa/xóa được' },
    { k: 'in',        t: 'In',                 mo: 'Mở màn hình xem trước bản in' },
    { k: 'pdf',       t: 'Xuất PDF',           mo: 'Kết xuất bản in ra tệp PDF' },
    { k: 'excelXuat', t: 'Xuất Excel',         mo: 'Kết xuất danh sách ra tệp .xlsx' },
    { k: 'excelNhap', t: 'Nhập Excel',         mo: 'Nạp dữ liệu từ tệp Excel vào phần mềm' },
    { k: 'giaVon',    t: 'Xem giá vốn',        mo: 'Nhìn thấy cột giá vốn và giá trị tồn theo giá vốn' },
    { k: 'loiNhuan',  t: 'Xem lợi nhuận',      mo: 'Nhìn thấy lãi gộp và tỷ suất lợi nhuận' },
    { k: 'baoCao',    t: 'Xem báo cáo',        mo: 'Chạy và kết xuất các nhóm báo cáo' },
    { k: 'quanTri',   t: 'Quản trị hệ thống',  mo: 'Cấu hình hệ thống, phân quyền, sao lưu, xóa dữ liệu' }
];

var _DM = ['xem', 'them', 'sua', 'xoa', 'in', 'pdf', 'excelXuat', 'excelNhap', 'giaVon'];
var _BAN = ['xem', 'them', 'sua', 'xoa', 'duyet', 'khoa', 'in', 'pdf', 'excelXuat', 'excelNhap', 'giaVon', 'loiNhuan'];
var _MUA = ['xem', 'them', 'sua', 'xoa', 'duyet', 'khoa', 'in', 'pdf', 'excelXuat', 'excelNhap', 'giaVon'];
var _TIEN = ['xem', 'them', 'sua', 'xoa', 'duyet', 'khoa', 'in', 'pdf', 'excelXuat', 'excelNhap'];

Q.PHAN_HE = [
    { k: 'khachHang',  t: 'Khách hàng',        nhom: 'Danh mục',        route: 'khach-hang',   ap: _DM },
    { k: 'nhaCungCap', t: 'Nhà cung cấp',      nhom: 'Danh mục',        route: 'nha-cung-cap', ap: _DM },
    { k: 'hangHoa',    t: 'Hàng hóa',          nhom: 'Danh mục',        route: 'hang-hoa',     ap: _DM },
    { k: 'duAn',       t: 'Dự án',             nhom: 'Danh mục',        route: 'du-an',        ap: _DM },
    { k: 'nhomHang',   t: 'Nhóm hàng',         nhom: 'Danh mục',        route: 'nhom-hang',    ap: _DM },
    { k: 'hangSX',     t: 'Hãng sản xuất',     nhom: 'Danh mục',        route: 'hang-sx',      ap: _DM },
    { k: 'bangGiaBan', t: 'Bảng giá',          nhom: 'Danh mục',        route: 'bang-gia',     ap: _DM },
    { k: 'loaiGia',    t: 'Loại giá',           nhom: 'Danh mục',        route: 'loai-gia',     ap: _DM },
    { k: 'dvt',        t: 'Đơn vị tính',       nhom: 'Hệ thống',        route: 'dvt',          ap: _DM },
    { k: 'thueSuat',   t: 'Thuế suất GTGT',    nhom: 'Hệ thống',        route: 'thue-suat',    ap: _DM },
    { k: 'dieuKhoanTT', t: 'Điều khoản thanh toán', nhom: 'Hệ thống',   route: 'dieu-khoan-tt', ap: _DM },
    { k: 'dieuKhoanGH', t: 'Điều khoản giao hàng', nhom: 'Hệ thống',   route: 'dieu-khoan-gh', ap: _DM },
    { k: 'nguoiKy',    t: 'Người ký',          nhom: 'Hệ thống',        route: 'nguoi-ky',     ap: _DM },
    { k: 'khoanMucChi', t: 'Khoản mục chi',   nhom: 'Danh mục',        route: 'khoan-muc-chi', ap: _DM },
    { k: 'loaiHopDong', t: 'Loại hợp đồng',    nhom: 'Hệ thống',        route: 'loai-hop-dong', ap: _DM },
    { k: 'giaNoiBo',   t: 'Đối chiếu giá nội bộ', nhom: 'Giá vốn',      route: 'gia-noi-bo', ap: ['xem', 'them', 'sua', 'xoa', 'excelXuat', 'giaVon'] },
    { k: 'giaVon',     t: 'Giá vốn hàng hóa',  nhom: 'Giá vốn',         route: 'gia-von',    ap: ['xem', 'sua', 'excelXuat', 'giaVon'] },
    { k: 'kho',        t: 'Thông tin kho',     nhom: 'Hệ thống',        route: 'kho',          ap: ['xem', 'sua', 'in', 'excelXuat'] },
    { k: 'khoTongQuan', t: 'Tổng quan kho',    nhom: 'Kho',             route: 'kho-tong-quan', ap: ['xem', 'baoCao', 'excelXuat', 'giaVon'] },
    { k: 'phieuNhap',  t: 'Phiếu nhập kho',    nhom: 'Kho',             route: 'phieu-nhap',   ap: ['xem', 'sua', 'xoa', 'in', 'pdf', 'excelXuat', 'giaVon'] },
    { k: 'kiemKe',     t: 'Kiểm kê kho',       nhom: 'Kho',             route: 'kiem-ke',      ap: ['xem', 'them', 'sua', 'xoa', 'duyet', 'in', 'pdf', 'excelXuat', 'excelNhap'] },
    { k: 'dieuChinhKho', t: 'Điều chỉnh tồn kho', nhom: 'Kho',          route: 'dieu-chinh-ton', ap: ['xem', 'them', 'sua', 'xoa', 'duyet', 'in', 'pdf', 'excelXuat', 'giaVon'] },
    { k: 'baoCaoTon',  t: 'Báo cáo tồn kho',   nhom: 'Kho',             route: 'bao-cao-ton',  ap: ['xem', 'baoCao', 'in', 'pdf', 'excelXuat', 'giaVon'] },
    { k: 'baoCaoNXT',  t: 'Báo cáo Nhập - Xuất - Tồn', nhom: 'Kho',     route: 'bao-cao-nxt',  ap: ['xem', 'baoCao', 'in', 'pdf', 'excelXuat', 'giaVon'] },
    { k: 'theKho',     t: 'Lịch sử giao dịch kho', nhom: 'Kho',         route: 'the-kho',      ap: ['xem', 'in', 'pdf', 'excelXuat', 'giaVon'] },
    { k: 'baoGia',     t: 'Báo giá',           nhom: 'Bán hàng',        route: 'bao-gia',      ap: _BAN },
    { k: 'donBan',     t: 'Đơn bán hàng',      nhom: 'Bán hàng',        route: 'don-ban',      ap: _BAN },
    { k: 'hopDong',    t: 'Hợp đồng',          nhom: 'Bán hàng',        route: 'hop-dong',     ap: _BAN },
    { k: 'phuLuc',     t: 'Phụ lục hợp đồng',  nhom: 'Bán hàng',        route: 'phu-luc',      ap: _BAN },
    { k: 'phieuXuat',  t: 'Phiếu xuất kho',    nhom: 'Kho',             route: 'phieu-xuat',   ap: _BAN },
    { k: 'bienBanGiao', t: 'Biên bản giao hàng', nhom: 'Bán hàng',      route: 'bien-ban-giao', ap: _BAN },
    { k: 'bienBanNghiemThu', t: 'Biên bản nghiệm thu', nhom: 'Bán hàng', route: 'nghiem-thu',  ap: _BAN },
    { k: 'deNghiTT',   t: 'Đề nghị thanh toán', nhom: 'Bán hàng',       route: 'de-nghi-tt',   ap: _BAN },
    { k: 'hoSo',       t: 'Hồ sơ đơn hàng',    nhom: 'Bán hàng',        route: 'ho-so',        ap: ['xem'] },
    { k: 'donMua',     t: 'Đơn mua hàng',      nhom: 'Mua hàng & Nhập khẩu', route: 'don-mua', ap: _MUA },
    { k: 'loNhap',     t: 'Lô nhập hàng',      nhom: 'Mua hàng & Nhập khẩu', route: 'lo-nhap', ap: _MUA },
    { k: 'phieuThu',   t: 'Phiếu thu',         nhom: 'Thu chi & Công nợ', route: 'phieu-thu',  ap: _TIEN },
    { k: 'phieuChi',   t: 'Phiếu chi',         nhom: 'Thu chi & Công nợ', route: 'phieu-chi',  ap: _TIEN },
    { k: 'congNo',     t: 'Công nợ',           nhom: 'Thu chi & Công nợ', route: 'cong-no',    ap: ['xem', 'in', 'pdf', 'excelXuat'] },
    { k: 'gopVon',     t: 'Góp vốn cổ đông',   nhom: 'Thu chi & Công nợ', route: 'gop-von',
      ap: ['xem', 'them', 'sua', 'xoa', 'duyet', 'in', 'pdf', 'excelXuat', 'loiNhuan'] },
    { k: 'baoCao',     t: 'Báo cáo tổng hợp',  nhom: 'Báo cáo',         route: 'bao-cao',      ap: ['xem', 'baoCao', 'in', 'pdf', 'excelXuat', 'giaVon', 'loiNhuan'] },
    { k: 'kqKinhDoanh', t: 'Kết quả hoạt động kinh doanh', nhom: 'Báo cáo',
      route: 'kq-kinh-doanh', ap: ['xem', 'baoCao', 'in', 'pdf', 'excelXuat', 'giaVon', 'loiNhuan'] },
    { k: 'doiChieu',   t: 'Đối chiếu số liệu', nhom: 'Báo cáo',        route: 'doi-chieu',    ap: ['xem', 'baoCao', 'giaVon', 'loiNhuan'] },
    { k: 'nhanVien',   t: 'Nhân viên',         nhom: 'Hệ thống',        route: 'nhan-vien',    ap: ['xem', 'them', 'sua', 'xoa', 'excelXuat', 'excelNhap'] },
    { k: 'nguoiDung',  t: 'Người dùng',        nhom: 'Hệ thống',        route: 'nguoi-dung',   ap: ['xem', 'them', 'sua', 'xoa', 'quanTri'] },
    { k: 'vaiTro',     t: 'Vai trò & phân quyền', nhom: 'Hệ thống',     route: 'vai-tro',      ap: ['xem', 'them', 'sua', 'xoa', 'quanTri'] },
    { k: 'donVi',      t: 'Đơn vị phát hành',  nhom: 'Hệ thống',        route: 'don-vi',       ap: ['xem', 'them', 'sua', 'xoa', 'quanTri'] },
    { k: 'nhatKy',     t: 'Nhật ký hệ thống',  nhom: 'Hệ thống',        route: 'nhat-ky',      ap: ['xem', 'xoa'] },
    { k: 'thungRac',   t: 'Thùng rác',         nhom: 'Hệ thống',        route: 'thung-rac',    ap: ['xem', 'xoa', 'quanTri'] },
    { k: 'gopDuLieu',  t: 'Gộp dữ liệu trùng', nhom: 'Hệ thống',        route: 'gop-du-lieu',  ap: ['xem', 'sua', 'quanTri'] },
    { k: 'caiDat',     t: 'Cài đặt & Sao lưu', nhom: 'Hệ thống',        route: 'cai-dat',      ap: ['xem', 'quanTri'] },
    { k: 'saoLuu',     t: 'Sao lưu & khôi phục dữ liệu', nhom: 'Hệ thống', route: 'sao-luu',   ap: ['xem', 'quanTri'] },
    { k: 'nhapLichSu', t: 'Nhập dữ liệu lịch sử', nhom: 'Hệ thống',     route: 'nhap-lich-su', ap: ['xem', 'quanTri', 'excelNhap'] }
];

var _byRoute = {}, _byMod = {};
Q.PHAN_HE.forEach(function (p) { _byRoute[p.route] = p; _byMod[p.k] = p; });
/* Màn hình NHẬP HÀNG gộp cả Đơn mua hàng và Lô nhập hàng thành một phân hệ duy
   nhất trên giao diện; quyền vẫn tính theo phân hệ Đơn mua hàng đã khai. */
_byRoute['nhap-hang'] = _byMod.donMua;
Q.theoRoute = function (r) { return _byRoute[r]; };
Q.theoMa = function (k) { return _byMod[k]; };
Q.tenHanhDong = function (a) {
    for (var i = 0; i < Q.HANH_DONG.length; i++) if (Q.HANH_DONG[i].k === a) return Q.HANH_DONG[i].t;
    return a;
};

/** Vai trò của người đang đăng nhập. */
Q.vaiTro = function () {
    var u = DB.user();
    return DB.get('vaiTro', u.vaiTroId) || { ten: u.vaiTro || '—', quyen: {} };
};

/** Người dùng hiện tại có quyền <hanhDong> trên <phanHe> hay không. */
Q.co = function (phanHe, hanhDong) {
    var p = _byMod[phanHe];
    if (p && p.ap.indexOf(hanhDong) < 0) return false;      // hành động không áp dụng cho phân hệ này
    var q = (Q.vaiTro().quyen || {})[phanHe];
    return !!(q && q[hanhDong]);
};
/** Có bất kỳ quyền quản trị hệ thống nào không. */
Q.laQuanTri = function () {
    var q = Q.vaiTro().quyen || {}, k;
    for (k in q) if (q[k] && q[k].quanTri) return true;
    return false;
};
/** Được phép chọn Người lập khác mình trên chứng từ. */
Q.doiNguoiLap = function (phanHe) {
    return Q.laQuanTri() || Q.co(phanHe, 'duyet');
};
/** Đếm số quyền đang bật của một vai trò. */
Q.demQuyen = function (vt) {
    var n = 0, q = vt.quyen || {}, k, a;
    for (k in q) for (a in q[k]) if (q[k][a]) n++;
    return n;
};
/** Nhân viên gắn với người đang đăng nhập. */
Q.nhanVienCuaToi = function () {
    var u = DB.user();
    return DB.get('nhanVien', u.nhanVienId) ||
        DB.all('nhanVien').filter(function (n) { return n.taiKhoanId === u.id; })[0] ||
        DB.all('nhanVien').filter(function (n) { return n.trangThai === 'Đang làm việc'; })[0] || null;
};

/* ==========================================================================
   CHỨNG TỪ KẾ TOÁN THEO CHẾ ĐỘ KẾ TOÁN DOANH NGHIỆP
   --------------------------------------------------------------------------
   Phiếu thu, phiếu chi, phiếu nhập kho và phiếu xuất kho là bốn chứng từ kế
   toán bắt buộc. Chúng có mẫu số riêng, có phần định khoản Nợ / Có, có quyển
   số và có số chứng từ gốc kèm theo — giống cách các phần mềm kế toán thông
   dụng in ra. Phần khai báo dưới đây là nơi duy nhất giữ các quy ước đó;
   biểu mẫu chỉ việc hỏi lại, không tự đặt số hiệu tài khoản.
   ========================================================================== */
T.MAU_SO_KT = {
    phieuThu:  { ma: '01 - TT', ten: 'Phiếu thu' },
    phieuChi:  { ma: '02 - TT', ten: 'Phiếu chi' },
    phieuNhap: { ma: '01 - VT', ten: 'Phiếu nhập kho' },
    phieuXuat: { ma: '02 - VT', ten: 'Phiếu xuất kho' }
};
/** Câu trích dẫn văn bản ban hành, in ở góc phải trên của chứng từ kế toán. */
T.VAN_BAN_KT = 'Ban hành theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính';

/** Chứng từ này có phải chứng từ kế toán in theo mẫu quy định hay không. */
T.laChungTuKT = function (key) { return !!T.MAU_SO_KT[key]; };

/**
 * Định khoản mặc định của một chứng từ kế toán — trả về { no, co }.
 * Người dùng khai riêng trên chứng từ (tkNo / tkCo) thì lấy đúng bản khai đó.
 * Chưa khai thì suy ra theo nghiệp vụ và theo hình thức thanh toán:
 *   Phiếu thu  : Nợ 1111 tiền mặt · 1121 tiền gửi   / Có 131 phải thu khách hàng
 *   Phiếu chi  : Nợ 331 phải trả người bán          / Có 1111 · 1121
 *   Nhập kho   : Nợ 156 hàng hóa                    / Có 331 phải trả người bán
 *   Xuất kho   : Nợ 632 giá vốn hàng bán            / Có 156 hàng hóa
 */
T.dinhKhoan = function (key, r) {
    r = r || {};
    var tienMat = String(r.hinhThuc || '').indexOf('Tiền mặt') === 0;
    var tkTien = tienMat ? '1111' : '1121';
    var m = { phieuThu:  { no: tkTien, co: '131' },
              phieuChi:  { no: '331',  co: tkTien },
              phieuNhap: { no: '156',  co: '331' },
              phieuXuat: { no: '632',  co: '156' } }[key] || { no: '', co: '' };
    return { no: r.tkNo || m.no, co: r.tkCo || m.co };
};

/**
 * Quyển số của chứng từ — kế toán đóng chứng từ theo quyển, mỗi quyển một năm.
 * Người dùng khai riêng thì giữ nguyên, chưa khai thì lấy năm của ngày lập.
 */
T.quyenSo = function (r) {
    if (r && r.quyenSo) return String(r.quyenSo);
    var ng = String((r && r.ngay) || '');
    return ng.length >= 4 ? ng.substr(0, 4) : '';
};

/** Số chứng từ gốc kèm theo — khai trên chứng từ, chưa khai thì để trống điền tay. */
T.chungTuGocKem = function (r) {
    var v = r && r.soChungTuGoc;
    return (v === undefined || v === null || v === '') ? '' : String(v);
};

/* ==========================================================================
   ĐỀ NGHỊ THANH TOÁN / ĐỀ NGHỊ TẠM ỨNG
   --------------------------------------------------------------------------
   Số tiền đề nghị là số NGƯỜI LẬP TỰ KHAI. Phần mềm KHÔNG tự lấy toàn bộ giá
   trị hợp đồng, KHÔNG tự lấy toàn bộ công nợ. Giá trị hợp đồng, số đã thanh
   toán và số còn phải trả chỉ dùng làm CĂN CỨ ĐỐI CHIẾU in trên chứng từ và
   hiển thị trên màn hình nhập liệu để người lập cân nhắc.
   ========================================================================== */
T.LOAI_DE_NGHI = ['Thanh toán', 'Tạm ứng'];
T.HINH_THUC_TT = ['Chuyển khoản', 'Tiền mặt'];

/** Số tiền đề nghị của một đề nghị thanh toán / tạm ứng. */
T.soTienDeNghi = function (r) {
    if (!r) return 0;
    var v = r.soTien;
    if (v === undefined || v === null || v === '') return 0;
    return Number(v) || 0;
};

/**
 * Căn cứ đối chiếu của một đề nghị: giá trị hợp đồng (hoặc đơn hàng), số đã
 * thanh toán qua các phiếu thu đã ghi sổ, và số còn phải thanh toán.
 * Chỉ để ĐỐI CHIẾU — không bao giờ được dùng làm số tiền đề nghị.
 */
T.canCuDeNghi = function (r) {
    r = r || {};
    var goc = (r.hopDongId && DB.get('hopDong', r.hopDongId)) ||
              (r.donBanId && DB.get('donBan', r.donBanId)) || null;
    var giaTri = goc ? (Number(goc.tongCong) || Number(goc.giaTri) || 0) : 0;
    var daTra = 0;
    if (r.donBanId || r.hopDongId) {
        DB.all('phieuThu').forEach(function (p) {
            if (p.trangThai !== 'Đã ghi sổ') return;
            if ((r.donBanId && p.donBanId === r.donBanId) ||
                (r.hopDongId && p.hopDongId === r.hopDongId)) daTra += Number(p.soTien) || 0;
        });
    }
    return { giaTri: giaTri, daTra: daTra, conLai: Math.max(0, giaTri - daTra) };
};

/* ==========================================================================
   LOẠI HỢP ĐỒNG — DANH MỤC MỞ RỘNG
   --------------------------------------------------------------------------
   Loại hợp đồng KHÔNG viết cứng trong chương trình. Mỗi loại là một bản ghi
   của danh mục "Loại hợp đồng", mang theo TOÀN BỘ biểu mẫu của nó: tiêu đề,
   trích yếu, tiền tố số hợp đồng, bố cục (có bảng hàng hóa hay không, có giá
   trị hợp đồng hay không), các căn cứ pháp lý, câu mở đầu, nhãn hai bên, bộ
   điều — khoản — điểm và các mẫu biên bản nghiệm thu đi kèm.
   Thêm một loại hợp đồng mới chỉ là thêm một bản ghi trong danh mục; chương
   trình tự hỗ trợ ngay, không phải sửa mã nguồn.
   ========================================================================== */

/** Các mẫu biên bản nghiệm thu của hệ thống. */
T.MAU_NGHIEM_THU = [
    { k: 'KL', t: 'Biên bản nghiệm thu lắp đặt hoàn thành (khối lượng)' },
    { k: 'GT', t: 'Biên bản nghiệm thu giá trị thanh toán' }
];
T.tenMauNT = function (k) {
    for (var i = 0; i < T.MAU_NGHIEM_THU.length; i++)
        if (T.MAU_NGHIEM_THU[i].k === k) return T.MAU_NGHIEM_THU[i].t;
    return k || '';
};

/* ==========================================================================
   HỒ SƠ NGHIỆM THU — MỘT HỒ SƠ, HAI BIÊN BẢN  (v18.1.0)
   --------------------------------------------------------------------------
   Trước đây người dùng phải CHỌN MỘT trong hai mẫu và mất mẫu còn lại. Nay:

       01 HỒ SƠ NGHIỆM THU
          ├── A. BBNT KHỐI LƯỢNG   (mauNT = 'KL')
          └── B. BBNT GIÁ TRỊ      (mauNT = 'GT')

   Hai biên bản DÙNG CHUNG: công trình · khách hàng · hợp đồng · phụ lục ·
   đợt nghiệm thu · danh sách công việc · dữ liệu nguồn · mã hồ sơ.

   KHÔNG nhân đôi dữ liệu nguồn: bản giá trị KHÔNG tự khai lại khối lượng mà
   ĐỌC THẲNG khối lượng đã nghiệm thu ở bản khối lượng của cùng hồ sơ. Nhờ vậy
   giá trị không bao giờ tính độc lập với khối lượng.

   Cách làm này MỞ RỘNG bảng bienBanNghiemThu đang có (thêm hoSoId / hoSoSo /
   dotNT), KHÔNG tạo bảng mới và KHÔNG đụng vào số liệu cũ.
   ========================================================================== */

/** Hai bản của một hồ sơ nghiệm thu. */
T.BAN_NT = [
    { k: 'KL', t: 'BBNT KHỐI LƯỢNG', mo: 'Nghiệm thu khối lượng lắp đặt hoàn thành' },
    { k: 'GT', t: 'BBNT GIÁ TRỊ',    mo: 'Nghiệm thu giá trị đề nghị thanh toán' }
];

/** Mọi biên bản thuộc một hồ sơ. */
T.banCuaHoSo = function (hoSoId) {
    if (!hoSoId) return [];
    return DB.all('bienBanNghiemThu').filter(function (b) {
        return (b.hoSoId || b.id) === hoSoId && b.trangThai !== 'Đã hủy';
    });
};

/**
 * DÒNG KHỐI LƯỢNG của một biên bản.
 * Mỗi dòng trả về đủ sáu thông tin mà biên bản khối lượng phải có:
 *   nội dung công việc · đơn vị · số lượng theo báo giá/hợp đồng ·
 *   khối lượng nghiệm thu đợt này · phần đã thực hiện (lũy kế các đợt trước) ·
 *   phần còn lại.
 */
T.dongKhoiLuongNT = function (bb) {
    if (!bb) return [];
    /* Chứng từ gốc để lấy SỐ LƯỢNG THEO HỢP ĐỒNG / BÁO GIÁ. */
    var goc = (bb.hopDongId && DB.get('hopDong', bb.hopDongId)) ||
              (bb.donBanId && DB.get('donBan', bb.donBanId)) || null;
    var theoGoc = {};
    ((goc && goc.lines) || []).forEach(function (l) {
        var id = T.idDong(l) || T.kd(l.tenHang || '');
        if (!id) return;
        theoGoc[id] = (theoGoc[id] || 0) + (Number(l.soLuong) || 0);
    });
    /* Lũy kế các đợt nghiệm thu TRƯỚC của cùng hợp đồng / đơn bán. */
    var truoc = {};
    DB.all('bienBanNghiemThu').forEach(function (x) {
        if (x.id === bb.id || x.trangThai === 'Đã hủy') return;
        if ((x.mauNT || 'KL') !== 'KL') return;      /* chỉ đếm bản khối lượng */
        var cungGoc = (bb.hopDongId && x.hopDongId === bb.hopDongId) ||
                      (!bb.hopDongId && bb.donBanId && x.donBanId === bb.donBanId);
        if (!cungGoc) return;
        if (String(x.ngay || '') > String(bb.ngay || '')) return;
        if (String(x.ngay || '') === String(bb.ngay || '') && String(x.id) >= String(bb.id)) return;
        (x.lines || []).forEach(function (l) {
            var id = T.idDong(l) || T.kd(l.tenHang || '');
            if (!id) return;
            var kl = l.soLuongNT === undefined ? (Number(l.soLuong) || 0) : (Number(l.soLuongNT) || 0);
            truoc[id] = (truoc[id] || 0) + kl;
        });
    });
    return (bb.lines || []).map(function (l) {
        var id = T.idDong(l) || T.kd(l.tenHang || '');
        var theoHD = theoGoc[id] === undefined ? (Number(l.soLuong) || 0) : theoGoc[id];
        var klNT = l.soLuongNT === undefined ? (Number(l.soLuong) || 0) : (Number(l.soLuongNT) || 0);
        var daLam = truoc[id] || 0;
        return {
            hangHoaId: T.idDong(l), maHang: l.maHang || '',
            noiDung: l.tenHang || l.noiDung || '',
            dvt: l.dvt || '',
            theoHopDong: theoHD,
            khoiLuongNT: klNT,
            daThucHien: daLam,
            luyKe: daLam + klNT,
            conLai: Math.max(0, theoHD - daLam - klNT),
            donGia: Number(l.donGia) || 0,
            ckPhanTram: Number(l.ckPhanTram) || 0
        };
    });
};

/**
 * DÒNG GIÁ TRỊ — LẤY TỪ CHÍNH KHỐI LƯỢNG ĐÃ NGHIỆM THU.
 * Đây là chỗ bảo đảm "không được tính giá trị độc lập với khối lượng".
 */
T.dongGiaTriNT = function (bbKL, bbGT) {
    var kl = T.dongKhoiLuongNT(bbKL || bbGT);
    /* Điều chỉnh (nếu có) khai trên chính bản giá trị, theo từng dòng. */
    var dc = {};
    ((bbGT && bbGT.lines) || []).forEach(function (l) {
        var id = T.idDong(l) || T.kd(l.tenHang || '');
        if (id && Number(l.dieuChinh)) dc[id] = Number(l.dieuChinh) || 0;
    });
    return kl.map(function (d) {
        var id = d.hangHoaId || T.kd(d.noiDung);
        var tien = Math.round(d.khoiLuongNT * d.donGia * (1 - d.ckPhanTram / 100));
        var chinh = dc[id] || 0;
        return {
            noiDung: d.noiDung, maHang: d.maHang, dvt: d.dvt,
            khoiLuongNT: d.khoiLuongNT, donGia: d.donGia, ckPhanTram: d.ckPhanTram,
            thanhTien: tien,
            dieuChinh: chinh,
            giaTriNghiemThu: tien + chinh
        };
    });
};

/**
 * MỘT HỒ SƠ NGHIỆM THU ĐẦY ĐỦ.
 * Trả về cả hai bản, phần dữ liệu dùng chung, và hai bảng dòng đã tính sẵn.
 * Hàm này CHỈ ĐỌC — không tạo, không sửa bản ghi nào.
 */
T.hoSoNT = function (hoSoId) {
    var ds = T.banCuaHoSo(hoSoId);
    if (!ds.length) return null;
    var kl = ds.filter(function (b) { return (b.mauNT || 'KL') === 'KL'; })[0] || null;
    var gt = ds.filter(function (b) { return b.mauNT === 'GT'; })[0] || null;
    var goc = kl || gt;
    var dongKL = T.dongKhoiLuongNT(kl || gt);
    var dongGT = T.dongGiaTriNT(kl, gt);
    var giaTri = T.sum(dongGT, function (d) { return d.giaTriNghiemThu; });
    var vatPct = Number((gt || goc).vatPct) || 0;
    return {
        hoSoId: hoSoId,
        hoSoSo: goc.hoSoSo || goc.so || hoSoId,
        /* DÙNG CHUNG — khai một lần, hai bản cùng đọc */
        chung: {
            khachHangId: goc.khachHangId || '', khachHang: goc.khachHang || '',
            duAnId: goc.duAnId || '', duAn: goc.duAn || '',
            hopDongId: goc.hopDongId || '', hopDongSo: goc.hopDongSo || '',
            phuLucId: goc.phuLucId || '', phuLucSo: goc.phuLucSo || '',
            donBanId: goc.donBanId || '', donBanSo: goc.donBanSo || '',
            bienBanGiaoId: goc.bienBanGiaoId || '', bienBanGiaoSo: goc.bienBanGiaoSo || '',
            dotNT: goc.dotNT || 1, ngay: goc.ngay || '', donVi: goc.donVi || ''
        },
        kl: kl, gt: gt,
        coKL: !!kl, coGT: !!gt, duBo: !!(kl && gt),
        dongKL: dongKL, dongGT: dongGT,
        tongKhoiLuong: T.sum(dongKL, function (d) { return d.khoiLuongNT; }),
        giaTriNghiemThu: giaTri,
        vatPct: vatPct,
        vat: Math.round(giaTri * vatPct / 100),
        giaTriDeNghiTT: Math.round(giaTri * (1 + vatPct / 100)),
        thieu: !kl ? 'Chưa có BBNT KHỐI LƯỢNG' : (!gt ? 'Chưa có BBNT GIÁ TRỊ' : '')
    };
};

/** Danh sách hồ sơ nghiệm thu của đơn vị / kỳ đang xem. */
T.dsHoSoNT = function (loc) {
    loc = loc || {};
    var theo = {};
    DB.all('bienBanNghiemThu').forEach(function (b) {
        if (b.trangThai === 'Đã hủy') return;
        if (loc.donViId && b.donVi && b.donVi !== loc.donViId) return;
        var n = String(b.ngay || '').substr(0, 10);
        if (loc.tuNgay && n && n < loc.tuNgay) return;
        if (loc.denNgay && n && n > loc.denNgay) return;
        theo[b.hoSoId || b.id] = 1;
    });
    return Object.keys(theo).map(function (k) { return T.hoSoNT(k); })
        .filter(Boolean)
        .sort(function (a, b) {
            return String(b.chung.ngay || '').localeCompare(String(a.chung.ngay || '')); });
};

/** Danh sách loại hợp đồng còn dùng được, theo thứ tự khai báo. */
T.loaiHDDungDuoc = function () {
    return DB.all('loaiHopDong').filter(function (x) { return x.trangThai !== 'Ngừng dùng'; });
};

/** Loại hợp đồng của một hợp đồng — theo id, rồi theo tên, cuối cùng là loại đầu tiên. */
T.loaiHDCua = function (r) {
    var ds = DB.all('loaiHopDong');
    var i;
    if (r && r.loaiId) for (i = 0; i < ds.length; i++) if (ds[i].id === r.loaiId) return ds[i];
    if (r && r.loai) for (i = 0; i < ds.length; i++) if (ds[i].ten === r.loai) return ds[i];
    return T.loaiHDDungDuoc()[0] || null;
};

/** Mẫu biên bản nghiệm thu dùng được cho một hợp đồng. */
T.mauNTCua = function (hd) {
    var l = T.loaiHDCua(hd);
    var ds = (l && l.mauNghiemThu && l.mauNghiemThu.length) ? l.mauNghiemThu : ['KL'];
    return ds.filter(function (k) { return !!T.tenMauNT(k); });
};

/**
 * Thay các trường ghép trong câu chữ của biểu mẫu hợp đồng bằng dữ liệu thật.
 * Nhờ vậy điều khoản khai trong danh mục vẫn tự lấy được số liệu của chứng từ.
 */
T.ghepHD = function (s, r, cty, kh) {
    if (!s) return '';
    r = r || {}; cty = cty || {}; kh = kh || {};
    var tong = Number(r.tongCong) || Number(r.giaTri) || 0;
    var map = {
        CTY: cty.ten || '', CTY_DC: cty.diaChi || '', CTY_MST: cty.mst || '',
        CTY_TK: cty.nganHang || '', CTY_DT: cty.dienThoai || '',
        KH: r.khachHang || kh.ten || '', KH_DC: kh.diaChi || '', KH_MST: kh.mst || '',
        SO: r.so || '', NGAY: T.date(r.ngay) || '', DU_AN: r.duAn || '',
        GIA_TRI: T.money(tong), BANG_CHU: T.docTien(tong),
        VAT: String(r.vatPct === undefined ? 10 : r.vatPct),
        BAO_HANH: String(r.baoHanh || 12),
        HIEU_LUC: T.date(r.ngayKetThuc) || '',
        BAO_GIA: r.baoGiaSo || '', DON_HANG: r.donBanSo || ''
    };
    return String(s).replace(/\{([A-Z_]+)\}/g, function (m, k) {
        return map[k] === undefined ? m : map[k];
    });
};

/* ==========================================================================
   BUSINESS ENGINE — GÓP VỐN CỔ ĐÔNG                          (thêm ở v12.0.0)
   --------------------------------------------------------------------------
   NGUYÊN TẮC BẤT DI BẤT DỊCH CỦA KHỐI NÀY

   1. CHỈ THÊM, KHÔNG SỬA. Không một dòng nào của Business Engine đang có bị
      thay đổi. Thuật toán giá vốn bình quân gia quyền di động giữ nguyên tuyệt
      đối; phân hệ vốn KHÔNG chuyển sang FIFO, KHÔNG liên kết chứng từ bán với
      từng lô nhập, KHÔNG đụng vào T.tinhLaiGiaVon hay T.ghiSoPhieuNhap.

   2. CHỈ LƯU DỮ LIỆU GỐC. Ba bảng coDong · dotGopVon · giaoDichVon lưu đúng
      những gì con người khai và không suy ra được từ đâu: ai là cổ đông, tỷ lệ
      bao nhiêu, đợt góp nào, ngày nào góp bao nhiêu tiền.
      Mọi số liệu tài chính khác — doanh thu, giá vốn, chi phí, lợi nhuận, tồn
      kho, công nợ — TUYỆT ĐỐI không lưu lại ở đây. Mỗi lần cần là gọi thẳng
      T.ketQuaKinhDoanh · T.giaTriTonKho · T.congNoNCC. Một lần gọi mất khoảng
      một phần mười mili giây nên gọi mỗi lần vẽ màn hình vẫn rẻ hơn nhiều so
      với việc giữ một bản sao có nguy cơ lệch với sổ.

   3. VỐN THEO QUỸ QUAY VÒNG CỦA TOÀN HỆ THỐNG, KHÔNG THEO TỪNG LÔ.
      TVERP tính giá vốn bình quân gia quyền: một đơn vị hàng trong kho không
      còn nhớ nó đến từ lô nào, và dòng xuất kho không mang mã lô ở bất cứ đâu.
      Vì vậy phân hệ vốn theo dõi ở mức QUỸ VỐN QUAY VÒNG TOÀN HỆ THỐNG:
          Vốn đã huy động → mua hàng → hàng nằm trong kho → bán → vốn quay về.
      Đó là con số Engine đọc được chính xác, không phải giả định.

   4. ĐẲNG THỨC QUỸ VỐN

          Quỹ khả dụng = Đã góp − Đã rút + Tiền vay − Vốn đang nằm trong kho

      Giải thích: toàn bộ tiền bỏ ra mua hàng từ trước tới nay = giá vốn hàng
      ĐÃ BÁN cộng giá trị hàng CÒN TỒN. Phần đã bán thì vốn đã quay về quỹ, nên
      hai vế triệt tiêu, chỉ còn phần đang nằm trong kho là chưa quay về.
      "Tổng giá vốn đã thu hồi" vẫn được tính và hiển thị như một chỉ tiêu theo
      dõi, nhưng KHÔNG cộng vào công thức trên — cộng vào là tính hai lần.

   5. TIỀN VAY là TRƯỜNG DỰ PHÒNG. Phiên bản này chưa có chức năng vay nên luôn
      bằng 0 và không hiển thị trên giao diện. Engine giữ nguyên chỗ của nó
      trong mọi công thức để sau này bật lên là chạy, không phải sửa kiến trúc.

   6. LÃI CHẬM GÓP là số liệu thanh toán NỘI BỘ giữa các cổ đông. Nó KHÔNG đi
      vào T.ketQuaKinhDoanh, không vào Báo cáo, không vào Trang chủ, không làm
      đổi một con số nào của phân hệ cũ.
   ========================================================================== */

/* Trạng thái riêng của phân hệ vốn — đăng ký thêm vào đúng bảng màu và bảng
   biểu tượng dùng chung, để nhãn trạng thái ở đây giống hệt phần còn lại của
   phần mềm. Chỉ THÊM khóa mới, không sửa khóa nào đang có. */
MAU['Đang tham gia'] = 'g';   ICO_TT['Đang tham gia'] = 'bi-person-check-fill';
MAU['Đã rút'] = 'n';          ICO_TT['Đã rút'] = 'bi-person-dash';
MAU['Đang mở'] = 'c';         ICO_TT['Đang mở'] = 'bi-hourglass-split';
MAU['Đã đủ'] = 'g';           ICO_TT['Đã đủ'] = 'bi-check-circle-fill';
MAU['Đã đóng'] = 'b';         ICO_TT['Đã đóng'] = 'bi-lock-fill';
MAU['Thiếu'] = 'r';           ICO_TT['Thiếu'] = 'bi-exclamation-triangle-fill';
MAU['Quá hạn góp'] = 'r';     ICO_TT['Quá hạn góp'] = 'bi-exclamation-triangle-fill';
MAU['Góp vốn'] = 'g';         ICO_TT['Góp vốn'] = 'bi-arrow-down-circle-fill';
MAU['Rút vốn'] = 'r';         ICO_TT['Rút vốn'] = 'bi-arrow-up-circle-fill';
MAU['Chia lợi nhuận'] = 'b';  ICO_TT['Chia lợi nhuận'] = 'bi-pie-chart-fill';
MAU['Trả lãi chậm góp'] = 'c'; ICO_TT['Trả lãi chậm góp'] = 'bi-percent';
MAU['Đang huy động'] = 'c';   ICO_TT['Đang huy động'] = 'bi-hourglass-split';

T.VON_TT_CD  = ['Đang tham gia', 'Đã rút'];
/* v18.4.0 — "Đang huy động" thay cho "Đang mở" theo đúng bốn trạng thái quy định.
   Giá trị cũ "Đang mở" vẫn được nhận để KHÔNG làm hỏng dữ liệu đã lưu. */
T.VON_TT_DOT = ['Đang huy động', 'Đã đủ', 'Đã đóng', 'Đã hủy'];
T.VON_TT_DOT_CU = 'Đang mở';
T.VON_LOAI_GD = ['Góp vốn', 'Rút vốn', 'Chia lợi nhuận', 'Trả lãi chậm góp'];
T.VON_TT_GD  = ['Nháp', 'Đã ghi sổ', 'Đã hủy'];
T.VON_HINH_THUC = ['Chuyển khoản', 'Tiền mặt', 'Bù trừ công nợ'];
/* Nguồn của một khoản tiền thực hiện nghĩa vụ góp vốn. Phân biệt nguồn là bắt
   buộc: tiền bán hàng KHÔNG phải tiền cá nhân cổ đông bỏ ra. */
T.VON_NGUON = ['Cổ đông nộp', 'Tiền bán hàng của công ty'];

/** Cấu hình phân hệ vốn — tự bù giá trị mặc định, không bao giờ trả về rỗng. */
T.cauHinhVon = function () {
    var m = DB.data._meta;
    var c = m.vonCoDong = m.vonCoDong || {};
    if (!(Number(c.laiSuat) >= 0)) c.laiSuat = 8;
    if (c.khauTruLai === undefined) c.khauTruLai = true;
    if (!(Number(c.tienVay) >= 0)) c.tienVay = 0;   /* dự phòng — luôn 0 ở bản này */
    return c;
};

/** Đơn vị mà cổ đông góp vốn vào — đơn vị nguồn (chủ sở hữu kho và hàng hóa). */
T.donViVon = function () { return T.ctyNguon() || DB.all('donVi')[0] || null; };

/** Số hiệu chứng từ của phân hệ vốn. Dùng bộ đếm riêng, không đụng DB.soMoi. */
T.soVonMoi = function (loai) {
    var m = DB.data._meta;
    m.seq = m.seq || {};
    var k = 'VON_' + loai;
    m.seq[k] = (m.seq[k] || 0) + 1;
    return (loai === 'DOT' ? 'ĐGV-' : 'GDV-') + T.today().substr(0, 4) +
           ('00' + m.seq[k]).slice(-3);
};

/* ------------------------------------------------------- CỔ ĐÔNG VÀ TỶ LỆ */

/**
 * Tỷ lệ sở hữu của một cổ đông TẠI MỘT NGÀY.
 * Đổi tỷ lệ về sau KHÔNG làm sai dữ liệu cũ: mỗi lần đổi ghi thêm một mốc vào
 * lichSuTyLe, và mọi phép tính đều tra tỷ lệ đúng theo ngày của nghiệp vụ.
 */
T.tyLeCoDong = function (cd, ngay) {
    if (!cd) return 0;
    var moc = (cd.lichSuTyLe || []).slice().sort(function (a, b) {
        return String(a.tuNgay) < String(b.tuNgay) ? -1 : (String(a.tuNgay) > String(b.tuNgay) ? 1 : 0);
    });
    if (!moc.length) return Number(cd.tyLe) || 0;
    var ds = moc.filter(function (x) { return !ngay || String(x.tuNgay || '') <= ngay; });
    /* Hỏi tỷ lệ ở ngày TRƯỚC cả mốc đầu tiên thì trả về TỶ LỆ KHỞI TẠO.
       Rơi về cd.tyLe (tỷ lệ hiện hành) sẽ làm mọi số liệu cũ đọc theo tỷ lệ mới —
       đúng cái mà yêu cầu "đổi tỷ lệ không làm sai dữ liệu cũ" cấm. */
    if (!ds.length) return Number(moc[0].tyLe) || 0;
    return Number(ds[ds.length - 1].tyLe) || 0;
};

/** Ghi thêm một mốc tỷ lệ. KHÔNG sửa mốc cũ — lịch sử là bất biến. */
T.doiTyLeCoDong = function (cd, tyLe, tuNgay, lyDo) {
    if (!cd) return null;
    cd.lichSuTyLe = cd.lichSuTyLe || [];
    var moc = { tuNgay: tuNgay || T.today(), tyLe: Number(tyLe) || 0,
                lyDo: lyDo || '', ai: DB.user().taiKhoan, luc: T.now() };
    cd.lichSuTyLe.push(moc);
    cd.tyLe = moc.tyLe;                       /* tỷ lệ hiện hành, tiện tra nhanh */
    return moc;
};

/** Danh sách cổ đông ĐANG THAM GIA kèm tỷ lệ tại một ngày. */
T.dsCoDongTaiNgay = function (ngay) {
    return DB.all('coDong')
        .filter(function (cd) { return cd.trangThai !== 'Đã rút'; })
        .map(function (cd) { return { cd: cd, id: cd.id, ten: cd.ten, tyLe: T.tyLeCoDong(cd, ngay) }; })
        .filter(function (x) { return x.tyLe > 0; });
};

/** Tổng tỷ lệ sở hữu tại một ngày — dùng để đối chiếu phải bằng 100%. */
T.tongTyLe = function (ngay) {
    return T.sum(T.dsCoDongTaiNgay(ngay), function (x) { return x.tyLe; });
};

/**
 * Chia một số tiền theo tỷ lệ. Dòng cuối nhận phần dư nên TỔNG CHIA RA LUÔN
 * BẰNG ĐÚNG SỐ TIỀN ĐẦU VÀO, không thất thoát một đồng nào vì làm tròn.
 * Nếu tổng tỷ lệ bằng 0 thì trả về toàn số 0 — Engine không tự bịa tỷ lệ.
 */
T.chiaTheoTyLe = function (tong, ds) {
    tong = Math.round(Number(tong) || 0);
    /* Tỷ lệ âm không có nghĩa trong sở hữu — quy về 0 để không sinh ra một
       khoản phải góp âm. */
    function ty(x) { return Math.max(0, Number(x.tyLe) || 0); }
    var tt = T.sum(ds, ty);
    var con = tong;
    return (ds || []).map(function (x, i) {
        var v = (!tt) ? 0
              : (i === ds.length - 1 ? con : Math.round(tong * ty(x) / tt));
        con -= v;
        return { coDongId: x.id, ten: x.ten, tyLe: Number(x.tyLe) || 0, soTien: v };
    });
};

/* ------------------------------------------------------ GIAO DỊCH VỐN */

/**
 * CỬA DUY NHẤT ĐỂ GHI MỘT GIAO DỊCH VỐN.
 * Bài học của luồng nhập kho hai bước: chốt cửa phải nằm trong Engine, không
 * trông vào màn hình. Bấm hai lần, mở hai thẻ trình duyệt, hay một đường gọi mới
 * quên kiểm tra — đều bị chặn ở đây.
 * Trả về bản ghi đã ghi, hoặc null kèm lý do trong kq.loi.
 */
T.ghiGiaoDichVon = function (o) {
    var loi = [];
    o = o || {};
    var st = Math.round(Number(o.soTien) || 0);
    if (T.VON_LOAI_GD.indexOf(o.loai) < 0) loi.push('Loại giao dịch vốn không hợp lệ.');
    if (!DB.get('coDong', o.coDongId)) loi.push('Không tìm thấy cổ đông của giao dịch.');
    if (o.dotId && !DB.get('dotGopVon', o.dotId)) loi.push('Không tìm thấy đợt góp vốn của giao dịch.');
    if (st <= 0) loi.push('Số tiền phải lớn hơn 0.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(o.ngay || ''))) loi.push('Ngày giao dịch không hợp lệ.');
    /* RÚT VỐN LUÔN ĐI QUA CỬA KIỂM TRA QUỸ — không có đường vòng nào. */
    if (o.loai === 'Rút vốn' && !loi.length) {
        var kt = T.kiemTraRutVon(o.coDongId, st, o.ngay);
        if (!kt.duoc) loi = loi.concat(kt.loi);
    }
    /* TIỀN BÁN HÀNG KHÔNG MẶC NHIÊN LÀ TIỀN GÓP VỐN (v18.10.0).
       Giao dịch góp vốn dùng nguồn "Tiền bán hàng của công ty" chỉ được ghi
       khi TỪNG đợt nhận phân bổ có bật cơ chế "cho phép dùng tiền công ty".
       Cửa này nằm trong Engine nên mọi đường gọi — màn hình phân bổ, ghi tay,
       hay mã gọi thẳng — đều bị chặn như nhau. Dữ liệu đã ghi từ trước không
       bị đụng tới: cửa chỉ xét giao dịch MỚI. */
    if (o.loai === 'Góp vốn' && o.nguonTien === 'Tiền bán hàng của công ty' && !loi.length) {
        var dsDotPB = {};
        if (o.dotId) dsDotPB[o.dotId] = 1;
        (o.phanBo || []).forEach(function (p) { if (p.dotId) dsDotPB[p.dotId] = 1; });
        var dotIds = Object.keys(dsDotPB);
        if (!dotIds.length)
            loi.push('Tiền bán hàng của công ty không được ghi thành góp vốn chung chung — ' +
                'phải gắn vào một đợt góp vốn có áp dụng cơ chế cho phép dùng tiền công ty.');
        dotIds.forEach(function (id) {
            var dPB = DB.get('dotGopVon', id);
            if (dPB && !T.dotChoPhepTienCongTy(dPB))
                loi.push('Đợt ' + dPB.so + ' KHÔNG áp dụng cơ chế dùng tiền công ty — ' +
                    'không được phân bổ tiền bán hàng vào nghĩa vụ của đợt này. ' +
                    'Nếu đợt có chủ trương cho phép, mở Sửa đợt và bật cơ chế trước.');
        });
    }
    if (loi.length) return { rec: null, loi: loi };
    var rec = DB.insert('giaoDichVon', T.gopGiu(o, {
        so: String(o.so || '').trim() || T.soVonMoi('GD'),
        soTien: st, trangThai: o.trangThai || 'Đã ghi sổ'
    }));
    DB.save();
    return { rec: rec, loi: [] };
};

/** Lọc giao dịch vốn đã ghi sổ. Giao dịch Nháp và Đã hủy không tính vào đâu cả. */
T.gdVon = function (f) {
    return DB.all('giaoDichVon').filter(function (g) {
        return g.trangThai === 'Đã ghi sổ' && (!f || f(g));
    });
};

T.tongGdVon = function (loai, f) {
    return T.sum(T.gdVon(function (g) {
        return g.loai === loai && (!f || f(g));
    }), function (g) { return Number(g.soTien) || 0; });
};

/* -------------------------------------------------- ĐỢT GÓP VỐN */

/**
 * CƠ CHẾ "CHO PHÉP DÙNG TIỀN CÔNG TY" GẮN VỚI TỪNG ĐỢT        (v18.10.0)
 * ----------------------------------------------------------------------
 * Tiền bán hàng KHÔNG mặc nhiên là tiền góp vốn. Chỉ khi một đợt góp vốn
 * có chủ trương/cơ chế cho phép dùng tiền công ty (bật ngay trên bản ghi
 * đợt, trường choPhepTienCongTy) thì tiền của công ty mới được phân bổ
 * vào nghĩa vụ của đợt đó. Đợt cũ chưa có trường này = KHÔNG áp dụng —
 * dữ liệu lịch sử đã ghi trước cơ chế không bị đụng tới, chỉ giao dịch
 * MỚI đi qua cửa kiểm tra.
 */
T.dotChoPhepTienCongTy = function (d) { return !!(d && d.choPhepTienCongTy); };

/** Các đợt còn hiệu lực (không hủy) có áp dụng cơ chế dùng tiền công ty. */
T.dsDotChoPhepTienCongTy = function () {
    return DB.all('dotGopVon').filter(function (d) {
        return d.trangThai !== 'Đã hủy' && T.dotChoPhepTienCongTy(d);
    });
};

/**
 * Dựng bảng phân bổ của một đợt: giá trị cần huy động chia theo tỷ lệ cổ đông
 * TẠI NGÀY TẠO ĐỢT. Nghĩa vụ góp đã chốt thì không đổi nữa dù về sau tỷ lệ có
 * thay đổi — đó là lý do bảng phân bổ được ghi vào chính bản ghi đợt.
 */
T.taoPhanBoDot = function (dot) {
    var ds = T.dsCoDongTaiNgay(dot.ngay || T.today());
    /* GIỮ NGUYÊN LỊCH SỬ CHUYỂN NGHĨA VỤ (v18.4.0).
       Chia lại tỷ lệ chỉ được phép tính lại phần NGHĨA VỤ MỚI. Các khoản đã
       nhận từ đợt trước và đã chuyển sang đợt sau là dấu vết của việc đã xảy
       ra — dựng lại bảng phân bổ mà xóa chúng là làm mất lịch sử. */
    var cu = {};
    (dot.phanBo || []).forEach(function (p) { cu[p.coDongId] = p; });
    var moi = T.chiaTheoTyLe(dot.giaTriHuyDong, ds).map(function (x) {
        var c = cu[x.coDongId];
        var o = { coDongId: x.coDongId, ten: x.ten, tyLe: x.tyLe, phaiGop: x.soTien };
        if (c && c.nhan && c.nhan.length) o.nhan = c.nhan;
        if (c && c.chuyen && c.chuyen.length) o.chuyen = c.chuyen;
        delete cu[x.coDongId];
        return o;
    });
    /* Cổ đông không còn trong danh sách chia mới nhưng ĐANG có nghĩa vụ chuyển
       đợt thì vẫn phải giữ lại dòng của họ, với nghĩa vụ mới bằng 0. */
    Object.keys(cu).forEach(function (id) {
        var c = cu[id];
        if ((c.nhan && c.nhan.length) || (c.chuyen && c.chuyen.length))
            moi.push({ coDongId: c.coDongId, ten: c.ten, tyLe: 0, phaiGop: 0,
                       nhan: c.nhan, chuyen: c.chuyen });
    });
    dot.phanBo = moi;
    return dot.phanBo;
};

/* ==========================================================================
   NGHĨA VỤ GÓP VỐN — MÔ HÌNH ĐẦY ĐỦ                      (v18.4.0 — Phần III→V)
   --------------------------------------------------------------------------
   BA KHÁI NIỆM KHÔNG ĐƯỢC TRỘN LẪN:

     1. NGHĨA VỤ PHẢI GÓP      — số tiền cổ đông có trách nhiệm thực hiện.
     2. TIỀN THỰC TẾ ĐÃ GÓP    — tiền đã vào công ty (của cổ đông hoặc từ
                                  nguồn tiền bán hàng được quyết định dùng).
     3. ĐÃ PHÂN BỔ VÀO NGHĨA VỤ — phần tiền ở (2) đã được gán vào một nghĩa vụ
                                  cụ thể của một đợt cụ thể.

     CÒN THIẾU = TỔNG NGHĨA VỤ ĐƯỢC GÁN − TỔNG ĐÃ PHÂN BỔ VÀO NGHĨA VỤ

   Một khoản tiền nằm ở (2) nhưng chưa được phân bổ thì KHÔNG làm giảm số còn
   thiếu của bất kỳ đợt nào — vì chưa ai nói nó thuộc nghĩa vụ nào.

   --------------------------------------------------------------------------
   NGHĨA VỤ CỦA MỘT ĐỢT GỒM HAI PHẦN, LƯU RIÊNG, KHÔNG BAO GIỜ CỘNG GỘP:

     · NGHĨA VỤ MỚI   — phần đợt này tự phát sinh, chia theo tỷ lệ sở hữu tại
                        ngày tạo đợt (pb.phaiGop).
     · NGHĨA VỤ NHẬN  — phần còn thiếu của các đợt TRƯỚC được chuyển sang
                        (pb.nhan[]). Một đợt có thể nhận từ NHIỀU đợt cũ.

   Đợt nguồn ghi lại phần đã đẩy đi trong pb.chuyen[] và KHÔNG bị xóa lịch sử.

   CHỐNG TÍNH TRÙNG — quy tắc sống còn:
     Tổng nghĩa vụ của TOÀN HỆ THỐNG = Σ (nghĩa vụ MỚI của mọi đợt chưa hủy).
     Phần chuyển đợt chỉ DỜI CHỖ một nghĩa vụ đã tồn tại, tuyệt đối không sinh
     thêm nghĩa vụ. Vì vậy mọi con số tổng hợp toàn hệ thống chỉ được cộng
     "nghĩa vụ mới", còn "nghĩa vụ nhận" chỉ dùng khi nhìn RIÊNG một đợt.

   --------------------------------------------------------------------------
   LÃI CHẬM GÓP — ĐỒNG HỒ ĐI THEO NGHĨA VỤ, KHÔNG ĐI THEO ĐỢT

   Mỗi nghĩa vụ được tách thành các LÁT (lát nghĩa vụ mới, và mỗi lần nhận
   chuyển là một lát riêng). Mỗi lát mang theo hạn góp và lãi suất CỦA NƠI NÓ
   PHÁT SINH. Chuyển một khoản thiếu sang đợt sau KHÔNG xóa được lãi đã và
   đang chạy của khoản đó — nếu không, chỉ cần chuyển đợt liên tục là thoát
   sạch lãi. Điều này được nói rõ trên giao diện và trong báo cáo.

   Tiền phân bổ vào một đợt sẽ trừ dần các lát theo THỨ TỰ HẠN GÓP SỚM NHẤT
   TRƯỚC — dập khoản nợ cũ nhất trước, có lợi cho cổ đông và cho kết quả xác
   định, không phụ thuộc thứ tự nhập liệu.
   ========================================================================== */

/** Chuẩn hóa trạng thái đợt: nhận cả giá trị cũ "Đang mở". */
T.ttDot = function (dot) {
    var t = (dot && dot.trangThai) || 'Đang huy động';
    return t === T.VON_TT_DOT_CU ? 'Đang huy động' : t;
};
T.dotConHieuLuc = function (dot) { return !!dot && T.ttDot(dot) !== 'Đã hủy'; };

/** Dòng phân bổ của một cổ đông trong một đợt (tạo rỗng nếu chưa có). */
T.pbCua = function (dot, coDongId) {
    var ds = (dot && dot.phanBo) || [];
    for (var i = 0; i < ds.length; i++) if (ds[i].coDongId === coDongId) return ds[i];
    return null;
};

/**
 * CÁC LÁT NGHĨA VỤ của một cổ đông trong một đợt, tính tới một ngày.
 * Mỗi lát: { nguon, dotGocId, dotGocSo, soTien, hanGop, laiSuat, ngayVao }
 *   nguon = 'moi'   → nghĩa vụ mới của chính đợt này
 *   nguon = 'nhan'  → nhận chuyển từ một đợt trước
 * Phần ĐÃ CHUYỂN ĐI được trừ khỏi lát 'moi' (và trừ tiếp sang các lát nhận nếu
 * còn thiếu chỗ) — vì nghĩa vụ đó nay do đợt khác gánh.
 */
T.latNghiaVu = function (dot, coDongId, denNgay) {
    denNgay = denNgay || T.today();
    var pb = T.pbCua(dot, coDongId);
    if (!pb || !T.dotConHieuLuc(dot)) return [];
    var lsDot = (dot.laiSuat === undefined || dot.laiSuat === null || dot.laiSuat === '')
        ? (Number(T.cauHinhVon().laiSuat) || 0) : (Number(dot.laiSuat) || 0);
    var lat = [];
    var moi = Math.max(0, Number(pb.phaiGop) || 0);
    if (moi > 0)
        lat.push({ nguon: 'moi', dotGocId: dot.id, dotGocSo: dot.so,
                   soTien: moi, hanGop: dot.hanGop || dot.ngay || '',
                   laiSuat: lsDot, ngayVao: dot.ngay || '' });
    (pb.nhan || []).forEach(function (n) {
        if (String(n.ngay || '') > denNgay) return;      /* chưa tới ngày chuyển */
        var st = Math.max(0, Number(n.soTien) || 0);
        if (st <= 0) return;
        lat.push({ nguon: 'nhan', dotGocId: n.tuDotId, dotGocSo: n.tuDotSo,
                   soTien: st,
                   /* Đồng hồ lãi giữ nguyên của nơi khoản thiếu phát sinh. */
                   hanGop: n.hanGopGoc || '', laiSuat: Number(n.laiSuatGoc) || 0,
                   ngayVao: n.ngay || '', ghiChu: n.ghiChu || '' });
    });
    /* Trừ phần đã chuyển đi — theo thứ tự hạn góp muộn nhất trước, để phần nợ
       cũ nhất ở lại đúng chỗ của nó cho tới khi thật sự được chuyển. */
    var diTong = T.sum((pb.chuyen || []).filter(function (c) {
        return String(c.ngay || '') <= denNgay;
    }), function (c) { return Number(c.soTien) || 0; });
    if (diTong > 0) {
        var thuTu = lat.slice().sort(function (a, b) {
            return String(b.hanGop) < String(a.hanGop) ? -1 : 1;
        });
        thuTu.forEach(function (l) {
            if (diTong <= 0) return;
            var tru = Math.min(diTong, l.soTien);
            l.soTien -= tru; diTong -= tru;
        });
    }
    return lat.filter(function (l) { return l.soTien > 0; })
              .sort(function (a, b) {
                  return String(a.hanGop) < String(b.hanGop) ? -1 : 1;
              });
};

/**
 * CÁC LẦN TIỀN ĐƯỢC PHÂN BỔ vào một đợt cho một cổ đông, tới một ngày.
 * Đọc được CẢ HAI dạng dữ liệu:
 *   · dạng mới: gd.phanBo = [{dotId, soTien}] — một khoản chia cho nhiều nghĩa vụ;
 *   · dạng cũ : gd.dotId — cả khoản thuộc đúng một đợt.
 * Nhờ vậy dữ liệu đã lưu từ trước vẫn đọc đúng, không phải sửa một bản ghi nào.
 */
T.tienVaoDot = function (dotId, coDongId, denNgay) {
    denNgay = denNgay || T.today();
    var ra = [];
    T.gdVon(function (g) {
        return g.loai === 'Góp vốn' && g.coDongId === coDongId &&
               String(g.ngay || '') <= denNgay;
    }).forEach(function (g) {
        if (g.phanBo && g.phanBo.length) {
            g.phanBo.forEach(function (p) {
                if (p.dotId !== dotId) return;
                var st = Number(p.soTien) || 0;
                if (st > 0) ra.push({ gd: g, ngay: g.ngay, soTien: st,
                                      nguonTien: g.nguonTien || 'Cổ đông nộp',
                                      chungTuSo: g.chungTuSo || g.so || '' });
            });
        } else if (g.dotId === dotId) {
            var st2 = Number(g.soTien) || 0;
            if (st2 > 0) ra.push({ gd: g, ngay: g.ngay, soTien: st2,
                                   nguonTien: g.nguonTien || 'Cổ đông nộp',
                                   chungTuSo: g.chungTuSo || g.so || '' });
        }
    });
    return ra.sort(function (a, b) { return a.ngay < b.ngay ? -1 : (a.ngay > b.ngay ? 1 : 0); });
};

/**
 * LÃI CHẬM GÓP CHI TIẾT — từng lát nghĩa vụ, từng khoảng thời gian.
 * Trả về { lai, dong[], latKetThuc[] } trong đó mỗi dòng là MỘT khoảng thời
 * gian có số dư thiếu KHÔNG ĐỔI, đủ để in ra bảng diễn giải:
 *   { dotSo, nguon, dotGocSo, thieu, tuNgay, denNgay, soNgay, laiSuat, lai,
 *     lyDoKetThuc, chungTuGiam }
 */
T.laiChiTiet = function (dot, coDongId, denNgay) {
    denNgay = denNgay || T.today();
    var kq = { lai: 0, dong: [], lat: [] };
    if (!dot || !T.dotConHieuLuc(dot)) return kq;
    var lat = T.latNghiaVu(dot, coDongId, denNgay);
    if (!lat.length) return kq;

    /* Tiền phân bổ vào đợt này, dập lát có hạn góp sớm nhất trước. */
    var tien = T.tienVaoDot(dot.id, coDongId, denNgay);
    var con = lat.map(function (l) {
        return { l: l, con: l.soTien, giam: [] };
    });
    tien.forEach(function (t) {
        var conLai = t.soTien;
        for (var i = 0; i < con.length && conLai > 0; i++) {
            if (con[i].con <= 0) continue;
            var tru = Math.min(conLai, con[i].con);
            con[i].con -= tru; conLai -= tru;
            con[i].giam.push({ ngay: t.ngay, soTien: tru,
                               nguonTien: t.nguonTien, chungTuSo: t.chungTuSo });
        }
    });

    con.forEach(function (c) {
        var l = c.l;
        var ls = Number(l.laiSuat) || 0;
        var moc = l.hanGop || '';
        kq.lat.push({ nguon: l.nguon, dotGocSo: l.dotGocSo, nghiaVu: l.soTien,
                      conThieu: c.con, hanGop: moc, laiSuat: ls });
        if (!moc || !(ls > 0) || denNgay <= moc) return;
        /* Dựng mốc thời gian: bắt đầu từ hạn góp, cắt tại mỗi lần giảm nợ. */
        var thieu = l.soTien;
        /* Phần trả TRƯỚC hoặc ĐÚNG hạn không phát sinh lãi. */
        c.giam.forEach(function (g) { if (g.ngay <= moc) thieu -= g.soTien; });
        thieu = Math.max(0, thieu);
        var tu = moc;
        var sau = c.giam.filter(function (g) { return g.ngay > moc; });
        function doan(a, b, sd, lyDo, ct) {
            if (sd <= 0 || b <= a) return;
            var n = T.soNgay(a, b);
            if (n <= 0) return;
            var tienLai = Math.round(sd * ls / 100 * n / 365);
            kq.lai += tienLai;
            kq.dong.push({
                dotSo: dot.so, dotId: dot.id, coDongId: coDongId,
                nguon: l.nguon, dotGocSo: l.dotGocSo,
                noiDung: l.nguon === 'moi'
                    ? 'Thiếu nghĩa vụ mới của đợt ' + dot.so
                    : 'Thiếu nghĩa vụ nhận từ đợt ' + l.dotGocSo,
                thieu: sd, tuNgay: a, denNgay: b, soNgay: n,
                laiSuat: ls, lai: tienLai,
                congThuc: T.money(sd) + ' × ' + T.num(ls, 2) + '% × ' + n + '/365',
                lyDoKetThuc: lyDo, chungTuGiam: ct || ''
            });
        }
        sau.forEach(function (g) {
            doan(tu, g.ngay, thieu, 'Được ghi nhận ' + T.money(g.soTien) + ' đ (' +
                 g.nguonTien + ')', g.chungTuSo);
            thieu = Math.max(0, thieu - g.soTien);
            if (g.ngay > tu) tu = g.ngay;
        });
        doan(tu, denNgay, thieu, 'Tới ngày chốt', '');
    });
    kq.dong.sort(function (a, b) { return a.tuNgay < b.tuNgay ? -1 : 1; });
    return kq;
};

/* LỚP TƯƠNG THÍCH — mọi nơi đang gọi T.laiChamGop giữ nguyên cách gọi và giữ
   nguyên hình dạng kết quả cũ { lai, doan, laiSuat, moc }. */
T.laiChamGop = function (dot, coDongId, denNgay) {
    var ct = T.laiChiTiet(dot, coDongId, denNgay);
    var ls = 0, moc = '';
    if (ct.lat.length) { ls = ct.lat[0].laiSuat; moc = ct.lat[0].hanGop; }
    return { lai: ct.lai, laiSuat: ls, moc: moc,
             doan: ct.dong.map(function (d) {
                 return { tu: d.tuNgay, den: d.denNgay, thieu: d.thieu,
                          soNgay: d.soNgay, lai: d.lai };
             }) };
};

/** Lãi chậm góp ĐÃ THANH TOÁN của một cổ đông (tùy chọn theo đợt). */
T.laiDaTra = function (coDongId, denNgay, dotId) {
    denNgay = denNgay || T.today();
    return T.sum(T.gdVon(function (g) {
        return g.loai === 'Trả lãi chậm góp' && g.coDongId === coDongId &&
               String(g.ngay || '') <= denNgay && (!dotId || g.dotId === dotId);
    }), function (g) { return Number(g.soTien) || 0; });
};

/* -------------------------------------------------- CHUYỂN NGHĨA VỤ SANG ĐỢT SAU */

/**
 * CHUYỂN PHẦN CÒN THIẾU CỦA MỘT ĐỢT SANG MỘT ĐỢT SAU.
 * Ghi hai chiều: đợt nguồn giữ lại dấu vết đã chuyển đi, đợt nhận ghi rõ nhận
 * từ đâu — nên nhìn từ phía nào cũng truy ngược được, và không bên nào bị xóa
 * lịch sử. Chỉ chuyển được đúng phần CÒN THIẾU THẬT tại ngày chuyển.
 */
T.chuyenNghiaVu = function (o) {
    o = o || {};
    var kq = { so: 0, tong: 0, dong: [], loi: [] };
    var nguon = DB.get('dotGopVon', o.tuDotId);
    var nhan = DB.get('dotGopVon', o.denDotId);
    var ngay = /^\d{4}-\d{2}-\d{2}$/.test(String(o.ngay || '')) ? o.ngay : T.today();
    if (!nguon) kq.loi.push('Không tìm thấy đợt nguồn.');
    if (!nhan) kq.loi.push('Không tìm thấy đợt nhận.');
    if (nguon && nhan && nguon.id === nhan.id) kq.loi.push('Đợt nguồn và đợt nhận là một.');
    if (nguon && !T.dotConHieuLuc(nguon)) kq.loi.push('Đợt nguồn đã hủy — không còn nghĩa vụ để chuyển.');
    if (nhan && !T.dotConHieuLuc(nhan)) kq.loi.push('Đợt nhận đã hủy.');
    if (nhan && T.ttDot(nhan) === 'Đã đóng') kq.loi.push('Đợt nhận đã đóng — mở lại trước khi nhận.');
    if (nguon && nhan && String(nhan.ngay || '') < String(nguon.ngay || ''))
        kq.loi.push('Chỉ được chuyển sang đợt lập SAU đợt nguồn.');
    if (kq.loi.length) return kq;

    var k = T.tinhDot(nguon, ngay);
    var chon = o.coDongIds && o.coDongIds.length ? o.coDongIds : null;
    var nguoi = o.nguoi || (DB.user() ? (DB.user().hoTen || DB.user().taiKhoan) : '');

    k.theoCoDong.forEach(function (c) {
        if (chon && chon.indexOf(c.coDongId) < 0) return;
        var muon = o.soTien && chon && chon.length === 1
            ? Math.min(Number(o.soTien) || 0, c.thieu) : c.thieu;
        muon = Math.round(muon);
        if (muon <= 0) return;
        var pbN = T.pbCua(nguon, c.coDongId);
        if (!pbN) return;
        pbN.chuyen = pbN.chuyen || [];
        pbN.chuyen.push({ denDotId: nhan.id, denDotSo: nhan.so, soTien: muon,
                          ngay: ngay, nguoi: nguoi, ghiChu: o.ghiChu || '' });
        var pbD = T.pbCua(nhan, c.coDongId);
        if (!pbD) {
            pbD = { coDongId: c.coDongId, ten: c.ten, tyLe: 0, phaiGop: 0 };
            nhan.phanBo = nhan.phanBo || [];
            nhan.phanBo.push(pbD);
        }
        pbD.nhan = pbD.nhan || [];
        /* Mang theo đồng hồ lãi của chính khoản thiếu — chuyển đợt không xóa lãi. */
        pbD.nhan.push({ tuDotId: nguon.id, tuDotSo: nguon.so, soTien: muon,
                        ngay: ngay, nguoi: nguoi, ghiChu: o.ghiChu || '',
                        hanGopGoc: nguon.hanGop || nguon.ngay || '',
                        laiSuatGoc: (nguon.laiSuat === undefined || nguon.laiSuat === null ||
                                     nguon.laiSuat === '')
                            ? (Number(T.cauHinhVon().laiSuat) || 0) : (Number(nguon.laiSuat) || 0) });
        kq.so++; kq.tong += muon;
        kq.dong.push({ coDongId: c.coDongId, ten: c.ten, soTien: muon });
    });
    if (!kq.so) { kq.loi.push('Đợt nguồn không còn khoản thiếu nào để chuyển.'); return kq; }
    DB.log('Chuyển nghĩa vụ góp vốn', 'dotGopVon',
           { id: nguon.id, so: nguon.so + ' → ' + nhan.so, soTien: kq.tong });
    DB.save();
    return kq;
};

/* -------------------------------------------------- TÍNH MỘT ĐỢT */

/**
 * TOÀN CẢNH MỘT ĐỢT — tách bạch nghĩa vụ mới, nghĩa vụ nhận, đã chuyển đi,
 * tiền góp trực tiếp, tiền bán hàng phân bổ, còn thiếu, đã vượt và lãi.
 * Không lưu lại — tính tại chỗ mỗi lần đọc, nên không bao giờ lệch với chứng từ.
 */
T.tinhDot = function (dot, denNgay) {
    denNgay = denNgay || T.today();
    var out = { dot: dot, nghiaVuMoi: 0, nhan: 0, chuyenDi: 0, phaiGop: 0,
                daGop: 0, gopTrucTiep: 0, tienBanHang: 0, thieu: 0, vuot: 0,
                lai: 0, laiDaTra: 0, tyLeHoanThanh: 0, quaHan: false, theoCoDong: [] };
    if (!dot) return out;
    out.quaHan = !!(dot.hanGop && denNgay > dot.hanGop);
    var huy = !T.dotConHieuLuc(dot);
    (dot.phanBo || []).forEach(function (pb) {
        var cd = DB.get('coDong', pb.coDongId);
        var moi = Math.max(0, Number(pb.phaiGop) || 0);
        var nhan = T.sum((pb.nhan || []).filter(function (n) {
            return String(n.ngay || '') <= denNgay; }), function (n) { return Number(n.soTien) || 0; });
        var di = T.sum((pb.chuyen || []).filter(function (c) {
            return String(c.ngay || '') <= denNgay; }), function (c) { return Number(c.soTien) || 0; });
        var phai = Math.max(0, moi + nhan - di);

        var tien = T.tienVaoDot(dot.id, pb.coDongId, denNgay);
        var tt = T.sum(tien.filter(function (t) {
            return t.nguonTien !== 'Tiền bán hàng của công ty'; }), function (t) { return t.soTien; });
        var bh = T.sum(tien.filter(function (t) {
            return t.nguonTien === 'Tiền bán hàng của công ty'; }), function (t) { return t.soTien; });
        var da = tt + bh;
        var thieu = Math.max(0, phai - da);
        var vuot = Math.max(0, da - phai);
        var lai = huy ? { lai: 0, dong: [] } : T.laiChiTiet(dot, pb.coDongId, denNgay);
        var laiTra = T.laiDaTra(pb.coDongId, denNgay, dot.id);

        out.nghiaVuMoi += moi; out.nhan += nhan; out.chuyenDi += di;
        out.phaiGop += phai; out.daGop += da; out.gopTrucTiep += tt;
        out.tienBanHang += bh; out.thieu += thieu; out.vuot += vuot;
        out.lai += lai.lai; out.laiDaTra += laiTra;
        out.theoCoDong.push({
            coDongId: pb.coDongId, ten: (cd && cd.ten) || pb.ten || '(đã xóa)',
            tyLe: Number(pb.tyLe) || 0,
            nghiaVuMoi: moi, nhan: nhan, dsNhan: (pb.nhan || []).slice(),
            chuyenDi: di, dsChuyen: (pb.chuyen || []).slice(),
            phaiGop: phai, gopTrucTiep: tt, tienBanHang: bh, daGop: da,
            thieu: thieu, vuot: vuot, lai: lai.lai, dongLai: lai.dong,
            laiDaTra: laiTra, laiConLai: Math.max(0, lai.lai - laiTra),
            dsTien: tien,
            trangThai: huy ? 'Đã hủy'
                : (thieu <= 0 ? 'Đã đủ' : (out.quaHan ? 'Quá hạn góp' : 'Thiếu'))
        });
    });
    /* Tiến độ không bao giờ vượt 100%; phần vượt hiển thị riêng — đúng mục XIV. */
    out.tyLeHoanThanh = out.phaiGop
        ? Math.min(100, Math.round(out.daGop / out.phaiGop * 1000) / 10) : (out.daGop > 0 ? 100 : 0);
    out.laiConLai = Math.max(0, out.lai - out.laiDaTra);
    return out;
};

/**
 * TỔNG HỢP TOÀN PHÂN HỆ — bảy con số tách bạch của mục XV.
 * Điểm mấu chốt chống tính trùng: "nghĩa vụ đang hoạt động" chỉ cộng NGHĨA VỤ
 * MỚI của các đợt chưa hủy, KHÔNG cộng phần nhận chuyển (vì phần đó đã nằm
 * trong nghĩa vụ mới của đợt sinh ra nó).
 */
T.tongHopVon = function (denNgay) {
    denNgay = denNgay || T.today();
    var ds = DB.all('dotGopVon');
    var o = { nghiaVuHoatDong: 0, daThucHien: 0, conThieu: 0, lai: 0, laiDaTra: 0,
              nghiaVuLichSu: 0, daChuyenSangDotKhac: 0, nghiaVuDaHuy: 0,
              vuot: 0, soDot: 0, ds: [] };
    ds.forEach(function (d) {
        var k = T.tinhDot(d, denNgay);
        o.nghiaVuLichSu += k.nghiaVuMoi;
        if (!T.dotConHieuLuc(d)) { o.nghiaVuDaHuy += k.nghiaVuMoi; o.ds.push(k); return; }
        o.soDot++;
        o.nghiaVuHoatDong += k.nghiaVuMoi;
        o.daThucHien += k.daGop;
        o.conThieu += k.thieu;
        o.vuot += k.vuot;
        o.lai += k.lai;
        o.laiDaTra += k.laiDaTra;
        o.daChuyenSangDotKhac += k.chuyenDi;
        o.ds.push(k);
    });
    o.laiConLai = Math.max(0, o.lai - o.laiDaTra);
    return o;
};

/** Giữ nguyên tên và hình dạng cũ cho mọi nơi đang gọi. */
T.tinhMoiDot = function (denNgay) {
    var t = T.tongHopVon(denNgay);
    var ds = t.ds.filter(function (k) { return T.dotConHieuLuc(k.dot); });
    return { phaiGop: T.sum(ds, function (k) { return k.phaiGop; }),
             daGop: t.daThucHien, thieu: t.conThieu, lai: t.lai,
             soDot: ds.length, ds: ds, tongHop: t };
};

/* ==========================================================================
   PHÂN BỔ TIỀN VÀO NGHĨA VỤ GÓP VỐN                     (v18.4.0 — Phần VI·VII)
   --------------------------------------------------------------------------
   Hai nguồn tiền, một cơ chế duy nhất:

     · CỔ ĐÔNG NỘP TIỀN         — tiền cá nhân cổ đông bỏ ra.
     · TIỀN BÁN HÀNG CỦA CÔNG TY — công ty quyết định dùng nguồn tiền bán hàng
                                   để thực hiện nghĩa vụ góp vốn.

   Hai nguồn này KHÔNG được trộn: tiền bán hàng không phải tiền cá nhân cổ đông,
   nên mọi báo cáo đều tách riêng hai cột. Việc dùng tiền bán hàng KHÔNG sinh
   thêm một đồng doanh thu nào — doanh thu vẫn nằm nguyên ở nghiệp vụ bán hàng;
   đây chỉ là quyết định SỬ DỤNG NGUỒN TIỀN đã có.

   BỐN NGUYÊN TẮC PHÂN BỔ (giữ nguyên từ 18.3.0, nay áp cho cả hai nguồn):
     1. Chia theo TỶ LỆ SỞ HỮU tại ngày phân bổ.
     2. Chặn trần đúng ở SỐ CÒN THIẾU THẬT của từng người.
     3. Phần dôi ra ĐỂ NGUYÊN — không chuyển sang cổ đông khác.
     4. Rải vào từng đợt người đó còn thiếu, ưu tiên HẠN GÓP SỚM NHẤT.
   ========================================================================== */

/** Các đợt một cổ đông còn thiếu, sắp theo hạn góp sớm nhất trước. */
T.dotConThieuCua = function (coDongId, denNgay, dotId) {
    denNgay = denNgay || T.today();
    var ra = [];
    DB.all('dotGopVon').forEach(function (d) {
        if (!T.dotConHieuLuc(d)) return;
        if (dotId && d.id !== dotId) return;
        if (String(d.ngay || '') > denNgay) return;
        var k = T.tinhDot(d, denNgay);
        var c = k.theoCoDong.filter(function (x) { return x.coDongId === coDongId; })[0];
        if (!c || c.thieu <= 0) return;
        ra.push({ dot: d, dotId: d.id, dotSo: d.so, hanGop: d.hanGop || d.ngay || '',
                  thieu: c.thieu });
    });
    return ra.sort(function (a, b) { return a.hanGop < b.hanGop ? -1 : 1; });
};

/**
 * LẬP KẾ HOẠCH PHÂN BỔ MỘT SỐ TIỀN CỦA CÔNG TY.
 * CHỈ TÍNH — không ghi gì vào dữ liệu. Người dùng xem xong mới quyết định.
 */
T.phanBoTienGop = function (o) {
    o = o || {};
    var ngay = /^\d{4}-\d{2}-\d{2}$/.test(String(o.ngay || '')) ? o.ngay : T.today();
    var soTien = Math.max(0, Math.round(Number(o.soTien) || 0));
    var out = { ngay: ngay, soTien: soTien, nguonTien: o.nguonTien || 'Tiền bán hàng của công ty',
                chungTuSo: o.chungTuSo || '', dong: [], theoCoDong: [],
                tongThieu: 0, tongPhanBo: 0, chuaPhanBo: 0, tongTyLe: 0,
                canhBao: [], loi: [] };
    if (soTien <= 0) { out.loi.push('Số tiền phân bổ phải lớn hơn 0.'); return out; }

    /* CƠ CHẾ GẮN VỚI TỪNG ĐỢT (v18.10.0): tiền của công ty chỉ được phân bổ
       vào đợt có bật "cho phép dùng tiền công ty". Không có đợt như vậy thì
       tiền bán hàng vẫn là tiền bán hàng — kế hoạch trả về lỗi, không tính. */
    var laTienCongTy = out.nguonTien === 'Tiền bán hàng của công ty';
    if (laTienCongTy) {
        if (o.dotId) {
            var dChon = DB.get('dotGopVon', o.dotId);
            if (dChon && !T.dotChoPhepTienCongTy(dChon)) {
                out.loi.push('Đợt ' + dChon.so + ' không áp dụng cơ chế cho phép dùng tiền công ty — ' +
                    'không được phân bổ tiền bán hàng vào đợt này.');
                return out;
            }
        }
        if (!T.dsDotChoPhepTienCongTy().length) {
            out.loi.push('Không có đợt góp vốn nào áp dụng cơ chế "cho phép dùng tiền công ty". ' +
                'Tiền bán hàng không mặc nhiên là tiền góp vốn — chỉ phân bổ được khi đợt góp vốn ' +
                'có chủ trương cho phép (bật khi tạo hoặc sửa đợt).');
            return out;
        }
    }

    var dsCd = DB.all('coDong').filter(function (c) { return c.trangThai !== 'Đã rút'; });
    var tyLe = {};
    dsCd.forEach(function (c) {
        tyLe[c.id] = Number(T.tyLeCoDong(c, ngay)) || 0;
        out.tongTyLe += tyLe[c.id];
    });
    if (out.tongTyLe <= 0) {
        out.loi.push('Chưa khai tỷ lệ sở hữu nào có hiệu lực đến ngày ' + T.date(ngay) +
                     ' — chưa đủ dữ liệu để chia theo tỷ lệ.');
        return out;
    }
    if (Math.abs(out.tongTyLe - 100) > 0.01)
        out.canhBao.push('Tổng tỷ lệ sở hữu tại ngày ' + T.date(ngay) + ' là ' +
            T.num(out.tongTyLe, 2) + '%, không bằng 100%. Phần chênh sẽ nằm ở mục chưa phân bổ.');

    dsCd.forEach(function (c) {
        var phan = Math.round(soTien * tyLe[c.id] / 100);
        var ds = T.dotConThieuCua(c.id, ngay, o.dotId || '');
        /* Tiền công ty chỉ rải vào các đợt CÓ áp dụng cơ chế — đợt không áp
           dụng vẫn còn thiếu thì phần thiếu đó là việc của tiền cổ đông nộp. */
        if (laTienCongTy)
            ds = ds.filter(function (x) { return T.dotChoPhepTienCongTy(x.dot); });
        var thieuTong = T.sum(ds, function (x) { return x.thieu; });
        out.tongThieu += thieuTong;
        var con = Math.min(phan, thieuTong);          /* NGUYÊN TẮC 2 */
        var daChia = 0;
        ds.forEach(function (x) {                     /* NGUYÊN TẮC 4 */
            if (con <= 0) return;
            var g = Math.min(con, x.thieu);
            con -= g; daChia += g;
            out.dong.push({ coDongId: c.id, ten: c.ten, tyLe: tyLe[c.id],
                            dotId: x.dotId, dotSo: x.dotSo, hanGop: x.hanGop,
                            thieuTruoc: x.thieu, phanBo: g, thieuSau: x.thieu - g });
        });
        out.tongPhanBo += daChia;
        out.theoCoDong.push({
            coDongId: c.id, ten: c.ten, tyLe: tyLe[c.id],
            phanTheoTyLe: phan, thieu: thieuTong, phanBo: daChia,
            thua: phan - daChia,                      /* NGUYÊN TẮC 3 */
            lyDo: thieuTong <= 0
                ? (laTienCongTy
                    ? 'Không còn nghĩa vụ thiếu ở các đợt CÓ áp dụng cơ chế tiền công ty — không nhận phân bổ.'
                    : 'Đã thực hiện đủ nghĩa vụ — không nhận phân bổ.')
                : (phan > thieuTong
                    ? 'Phần theo tỷ lệ lớn hơn số còn thiếu nên chỉ lấy đúng số còn thiếu. ' +
                      'Phần dôi ra KHÔNG chuyển cho cổ đông khác.'
                    : 'Phân bổ đúng phần theo tỷ lệ.')
        });
    });

    out.chuaPhanBo = soTien - out.tongPhanBo;
    var du = out.theoCoDong.filter(function (x) { return x.thua > 0; });
    if (du.length)
        out.canhBao.push('Có ' + du.length + ' cổ đông có phần dôi ra sau khi đã bù đủ nghĩa vụ (' +
            du.map(function (x) { return x.ten + ' ' + T.money(x.thua) + ' đ'; }).join(' · ') +
            '). Theo quy định, phần này KHÔNG được chuyển sang cổ đông khác.');
    var tien = T.tienThucTe(ngay);
    if (soTien > tien)
        out.canhBao.push('Số tiền phân bổ (' + T.money(soTien) + ' đ) lớn hơn tiền thực tế đang có ' +
            'đến ngày ' + T.date(ngay) + ' (' + T.money(tien) + ' đ). Hãy kiểm tra lại nguồn tiền.');
    return out;
};

/**
 * GHI SỔ KẾ HOẠCH PHÂN BỔ — chỉ khi người dùng đã xác nhận.
 * Mỗi cổ đông một giao dịch "Góp vốn", bên trong mang bảng phân bổ chi tiết
 * vào từng đợt, nên một khoản tiền chia cho nhiều nghĩa vụ vẫn truy được.
 */
T.ghiPhanBoTienGop = function (ke, o) {
    o = o || {};
    var kq = { rec: [], loi: [] };
    if (!ke || !ke.dong || !ke.dong.length) { kq.loi.push('Không có dòng phân bổ nào để ghi.'); return kq; }
    if (ke.loi && ke.loi.length) { kq.loi = ke.loi.slice(); return kq; }
    var theoCd = {};
    ke.dong.forEach(function (d) {
        if (d.phanBo <= 0) return;
        (theoCd[d.coDongId] = theoCd[d.coDongId] || { ten: d.ten, tyLe: d.tyLe, pb: [] })
            .pb.push({ dotId: d.dotId, dotSo: d.dotSo, soTien: d.phanBo });
    });
    Object.keys(theoCd).forEach(function (id) {
        var x = theoCd[id];
        var tong = T.sum(x.pb, function (p) { return p.soTien; });
        var r = T.ghiGiaoDichVon({
            loai: 'Góp vốn', coDongId: id, dotId: x.pb[0].dotId,
            ngay: ke.ngay, soTien: tong,
            hinhThuc: o.hinhThuc || 'Chuyển khoản',
            nguonTien: ke.nguonTien || 'Tiền bán hàng của công ty',
            chungTuLoai: o.chungTuLoai || '', chungTuId: o.chungTuId || '',
            chungTuSo: ke.chungTuSo || o.chungTuSo || '',
            tyLeApDung: x.tyLe,
            phanBo: x.pb,
            ghiChu: (o.ghiChu ? o.ghiChu + ' — ' : '') +
                'Phân bổ theo tỷ lệ sở hữu ' + T.num(x.tyLe, 2) + '% tại ngày ' + T.date(ke.ngay) +
                ', chặn trần ở số còn thiếu, rải vào ' + x.pb.length + ' đợt'
        });
        if (r.rec) kq.rec.push(r.rec); else kq.loi = kq.loi.concat(r.loi);
    });
    return kq;
};

/**
 * GHI MỘT LẦN CỔ ĐÔNG NỘP TIỀN, kèm phân bổ vào một hoặc nhiều nghĩa vụ.
 * Không mặc định "tiền nộp thuộc đợt đang mở" — người dùng chỉ định rõ, hoặc
 * để hệ thống rải theo hạn góp sớm nhất trước bằng cách bật tuDongRai.
 */
T.ghiTienGopCoDong = function (o) {
    o = o || {};
    var st = Math.round(Number(o.soTien) || 0);
    var ngay = /^\d{4}-\d{2}-\d{2}$/.test(String(o.ngay || '')) ? o.ngay : T.today();
    var pb = (o.phanBo || []).filter(function (p) { return (Number(p.soTien) || 0) > 0; })
        .map(function (p) {
            var d = DB.get('dotGopVon', p.dotId);
            return { dotId: p.dotId, dotSo: (d && d.so) || p.dotSo || '',
                     soTien: Math.round(Number(p.soTien) || 0) };
        });
    if (!pb.length && o.tuDongRai) {
        var con = st;
        T.dotConThieuCua(o.coDongId, ngay, '').forEach(function (x) {
            if (con <= 0) return;
            var g = Math.min(con, x.thieu); con -= g;
            pb.push({ dotId: x.dotId, dotSo: x.dotSo, soTien: g });
        });
    }
    var tongPB = T.sum(pb, function (p) { return p.soTien; });
    if (tongPB > st)
        return { rec: null, loi: ['Tổng phân bổ (' + T.money(tongPB) +
                 ' đ) lớn hơn số tiền nộp (' + T.money(st) + ' đ).'] };
    return T.ghiGiaoDichVon({
        loai: 'Góp vốn', coDongId: o.coDongId,
        dotId: pb.length ? pb[0].dotId : (o.dotId || ''),
        ngay: ngay, soTien: st,
        hinhThuc: o.hinhThuc || 'Chuyển khoản',
        nguonTien: 'Cổ đông nộp',
        chungTuSo: o.chungTuSo || '', taiKhoan: o.taiKhoan || '',
        phanBo: pb, ghiChu: o.ghiChu || ''
    });
};

/* ==========================================================================
   BÁO CÁO DÒNG TIỀN CỔ ĐÔNG                            (v18.4.0 — Phần XVI→XXI)
   --------------------------------------------------------------------------
   Trả về đủ tám phần của báo cáo, mỗi con số đều dựng lại từ chứng từ gốc và
   đều kèm đường truy ngược. KHÔNG có con số tổng nào được nhập tay.

   Điều quan trọng nhất: LÃI CHẬM GÓP KHÔNG BAO GIỜ CHỈ LÀ MỘT CON SỐ. Phần VI
   của báo cáo liệt kê TỪNG KHOẢNG THỜI GIAN của TỪNG LÁT NGHĨA VỤ, với số dư
   thiếu thật của khoảng đó, ngày bắt đầu, ngày kết thúc, số ngày, lãi suất,
   công thức và lý do khoảng đó kết thúc.
   ========================================================================== */
T.dongTienCoDong = function (coDongId, loc) {
    loc = loc || {};
    var cd = DB.get('coDong', coDongId);
    var den = loc.denNgay || T.today();
    var tu = loc.tuNgay || '';
    var r = {
        coDong: cd, tuNgay: tu, denNgay: den,
        donVi: T.donViVon(),
        tyLe: cd ? T.tyLeCoDong(cd, den) : 0,
        /* PHẦN II */ tong: {
            nghiaVuMoi: 0, nghiaVuNhan: 0, nghiaVuChuyenDi: 0, tongNghiaVu: 0,
            gopTrucTiep: 0, tienBanHang: 0, daThucHien: 0, conThieu: 0, vuot: 0,
            laiPhatSinh: 0, laiDaTra: 0, laiConPhaiTra: 0 },
        /* PHẦN III */ lanGop: [],
        /* PHẦN IV  */ nhanChuyen: [],
        /* PHẦN V   */ tienBanHang: [],
        /* PHẦN VI  */ chiTietLai: [],
        /* PHẦN VII */ laiTheoDot: [],
        /* PHẦN VIII*/ theoDot: [],
        kiemTra: { khop: true, lech: 0, moTa: '' }
    };
    if (!cd) { r.kiemTra.khop = false; r.kiemTra.moTa = 'Không tìm thấy cổ đông.'; return r; }

    var trongKy = function (ng) { return (!tu || ng >= tu) && (!den || ng <= den); };

    DB.all('dotGopVon').forEach(function (d) {
        if (String(d.ngay || '') > den) return;
        var k = T.tinhDot(d, den);
        var c = k.theoCoDong.filter(function (x) { return x.coDongId === coDongId; })[0];
        if (!c) return;
        var huy = !T.dotConHieuLuc(d);

        r.theoDot.push({
            dotId: d.id, dotSo: d.so, lyDo: d.lyDo || '', ngay: d.ngay,
            hanGop: d.hanGop || '', laiSuat: d.laiSuat, trangThai: T.ttDot(d),
            nghiaVuMoi: c.nghiaVuMoi, nhan: c.nhan, chuyenDi: c.chuyenDi,
            phaiGop: c.phaiGop, gopTrucTiep: c.gopTrucTiep, tienBanHang: c.tienBanHang,
            daGop: c.daGop, thieu: c.thieu, vuot: c.vuot,
            lai: c.lai, laiDaTra: c.laiDaTra, laiConLai: c.laiConLai,
            tienDo: c.phaiGop ? Math.min(100, Math.round(c.daGop / c.phaiGop * 1000) / 10)
                              : (c.daGop > 0 ? 100 : 0)
        });

        if (!huy) {
            r.tong.nghiaVuMoi += c.nghiaVuMoi;
            r.tong.nghiaVuNhan += c.nhan;
            r.tong.nghiaVuChuyenDi += c.chuyenDi;
            r.tong.gopTrucTiep += c.gopTrucTiep;
            r.tong.tienBanHang += c.tienBanHang;
            r.tong.daThucHien += c.daGop;
            r.tong.conThieu += c.thieu;
            r.tong.vuot += c.vuot;
            r.tong.laiPhatSinh += c.lai;
            r.tong.laiDaTra += c.laiDaTra;
        }

        /* PHẦN IV — nghĩa vụ nhận từ các đợt trước */
        (c.dsNhan || []).forEach(function (n) {
            if (!trongKy(String(n.ngay || ''))) return;
            r.nhanChuyen.push({ ngay: n.ngay, tuDotSo: n.tuDotSo, denDotSo: d.so,
                soTien: n.soTien, hanGopGoc: n.hanGopGoc, laiSuatGoc: n.laiSuatGoc,
                nguoi: n.nguoi || '', ghiChu: n.ghiChu || '' });
        });

        /* PHẦN III và V — từng lần tiền được phân bổ vào nghĩa vụ */
        (c.dsTien || []).forEach(function (t) {
            if (!trongKy(String(t.ngay || ''))) return;
            var dong = { ngay: t.ngay, dotSo: d.so, dotId: d.id, soTien: t.soTien,
                nguonTien: t.nguonTien, hinhThuc: (t.gd && t.gd.hinhThuc) || '',
                chungTuSo: t.chungTuSo || (t.gd && t.gd.so) || '',
                gdSo: (t.gd && t.gd.so) || '',
                tyLeApDung: (t.gd && t.gd.tyLeApDung) || null,
                dienGiai: (t.gd && t.gd.ghiChu) || '' };
            if (t.nguonTien === 'Tiền bán hàng của công ty') r.tienBanHang.push(dong);
            else r.lanGop.push(dong);
        });

        /* PHẦN VI — từng khoảng thời gian của từng lát nghĩa vụ */
        (c.dongLai || []).forEach(function (x) {
            if (den && x.tuNgay > den) return;
            r.chiTietLai.push(x);
        });
        if (c.lai || c.laiDaTra)
            r.laiTheoDot.push({ dotSo: d.so, lai: c.lai, daTra: c.laiDaTra,
                                conLai: c.laiConLai });
    });

    r.tong.tongNghiaVu = r.tong.nghiaVuMoi + r.tong.nghiaVuNhan - r.tong.nghiaVuChuyenDi;
    r.tong.laiConPhaiTra = Math.max(0, r.tong.laiPhatSinh - r.tong.laiDaTra);
    r.lanGop.sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });
    r.tienBanHang.sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });
    r.chiTietLai.sort(function (a, b) { return a.tuNgay < b.tuNgay ? -1 : 1; });

    /* --- MỤC XX: TỔNG LÃI PHẢI KHỚP TUYỆT ĐỐI ------------------------------
       Cộng lãi theo ba đường độc lập. Lệch thì BÁO LỖI và chỉ rõ số lệch —
       không tự sửa số cho khớp, không âm thầm làm tròn. */
    var theoKhoang = T.sum(r.chiTietLai, function (x) { return x.lai; });
    var theoDot = T.sum(r.laiTheoDot, function (x) { return x.lai; });
    var theoTong = r.tong.laiPhatSinh;
    var lech = Math.max(Math.abs(theoKhoang - theoDot), Math.abs(theoDot - theoTong));
    r.kiemTra = {
        khop: lech === 0, lech: lech,
        theoKhoangThoiGian: theoKhoang, theoDot: theoDot, theoTongHop: theoTong,
        moTa: lech === 0
            ? 'Tổng lãi theo từng khoảng thời gian = theo từng đợt = tổng hợp. Khớp tuyệt đối.'
            : 'LỆCH ' + T.money(lech) + ' đ giữa ba cách cộng lãi. Cần rà soát, ' +
              'phần mềm KHÔNG tự sửa số để làm cho khớp.'
    };
    return r;
};

/** Báo cáo cho TOÀN BỘ cổ đông — dùng chung một lõi, không tính lại kiểu khác. */
T.dongTienMoiCoDong = function (loc) {
    var ds = DB.all('coDong').map(function (c) { return T.dongTienCoDong(c.id, loc); });
    var t = { nghiaVuMoi: 0, nghiaVuNhan: 0, nghiaVuChuyenDi: 0, tongNghiaVu: 0,
              gopTrucTiep: 0, tienBanHang: 0, daThucHien: 0, conThieu: 0, vuot: 0,
              laiPhatSinh: 0, laiDaTra: 0, laiConPhaiTra: 0 };
    ds.forEach(function (r) {
        Object.keys(t).forEach(function (k) { t[k] += r.tong[k] || 0; });
    });
    return { ds: ds, tong: t,
             khop: ds.every(function (r) { return r.kiemTra.khop; }),
             lech: ds.filter(function (r) { return !r.kiemTra.khop; })
                     .map(function (r) { return { coDong: r.coDong.ten, lech: r.kiemTra.lech }; }) };
};

/* ==========================================================================
   DỮ LIỆU CẦN XÁC MINH                                    (v18.5.0 — mục 3·13)
   --------------------------------------------------------------------------
   Có những chỗ phần mềm NHÌN THẤY là bất thường nhưng KHÔNG ĐƯỢC TỰ SỬA, vì
   sửa đúng hay sai phụ thuộc vào việc thực tế đã xảy ra thế nào — mà điều đó
   chỉ con người biết.

   Ví dụ rõ nhất: một đơn mua đã được chi tiền nhưng chưa nối với lô nhập nào.
   Hai khả năng dẫn tới hai cách xử lý ngược nhau:
       · hàng CHƯA về  → khoản chi là TIỀN ỨNG TRƯỚC, số liệu hiện tại đang đúng;
       · hàng ĐÃ về    → phải có lô nhập và phiếu nhập, và khoản chi là TRẢ NỢ.
   Không có chứng từ nào trong dữ liệu phân biệt được hai khả năng đó, nên
   phần mềm GIỮ NGUYÊN SỐ LIỆU và đánh dấu để người dùng xác minh.

   Nguyên tắc của cả khối này: PHÁT HIỆN · NÊU BẰNG CHỨNG · ĐỀ XUẤT —
   TUYỆT ĐỐI KHÔNG tự đổi số tiền, không tự nối chứng từ khi chưa chắc chắn.
   ========================================================================== */
T.canXacMinh = function (loc) {
    loc = loc || {};
    var ra = [];
    function them(o) { ra.push(o); }

    /* ---- 1. ĐƠN MUA ĐÃ CHI TIỀN NHƯNG CHƯA NỐI LÔ NHẬP ------------------- */
    DB.all('phieuChi').forEach(function (p) {
        if (p.trangThai !== 'Đã ghi sổ' || !p.donMuaId) return;
        var dm = DB.get('donMua', p.donMuaId);
        if (!dm) return;
        var lo = DB.all('loNhap').filter(function (l) {
            return l.donMuaId === dm.id || dm.loNhapId === l.id;
        });
        if (lo.length) return;
        them({ ma: 'MUA_CHI_CHUA_NHAP|' + dm.id, nhom: 'Mua hàng', mucDo: 'cao',
            tieuDe: 'Đã chi tiền cho đơn mua nhưng đơn mua chưa nối với lô nhập nào',
            moTa: 'Phiếu chi ' + p.so + ' đã chi ' + T.money(p.soTien) + ' đ cho đơn mua ' +
                  dm.so + ' (tổng ' + T.money(dm.tongCong) + ' đ), nhưng đơn mua này chưa có ' +
                  'lô nhập nào. Phần mềm đang ghi nhận khoản chi là TIỀN ỨNG TRƯỚC.',
            chungCu: ['Phiếu chi ' + p.so + ' ngày ' + T.date(p.ngay) + ' — ' + T.money(p.soTien) + ' đ',
                      'Đơn mua ' + dm.so + ' — trạng thái ' + dm.trangThai,
                      'Số lô nhập gắn với đơn mua này: 0'],
            cauHoi: 'Hàng của đơn mua ' + dm.so + ' đã về kho chưa?',
            deXuat: 'Nếu hàng ĐÃ VỀ: lập lô nhập cho đơn mua này rồi bấm Nhập kho — công nợ ' +
                    'phải trả sẽ tự phát sinh và khoản chi thành trả nợ. Nếu hàng CHƯA VỀ: ' +
                    'số liệu hiện tại đang đúng, không phải sửa gì.',
            route: 'nhap-hang', banGhi: [{ coll: 'donMua', id: dm.id, so: dm.so },
                                          { coll: 'phieuChi', id: p.id, so: p.so }] });
    });

    /* ---- 2. LÔ NHẬP KHÔNG NỐI ĐƠN MUA ------------------------------------ */
    DB.all('loNhap').forEach(function (l) {
        if (l.donMuaId && DB.get('donMua', l.donMuaId)) return;
        if (String(l.loai || '') === 'Tồn đầu kỳ' || String(l.trangThai || '') === 'Tồn đầu kỳ') return;
        var ncc = DB.get('nhaCungCap', l.nhaCungCapId) || {};
        them({ ma: 'LO_KHONG_DON|' + l.id, nhom: 'Mua hàng', mucDo: 'vua',
            tieuDe: 'Lô nhập chưa xác định được nhập theo đơn mua nào',
            moTa: 'Lô ' + l.so + ' ngày ' + T.date(l.ngay) + ' của nhà cung cấp ' +
                  (ncc.ten || '(chưa rõ)') + ' gồm ' + (l.lines || []).length +
                  ' mặt hàng, chưa gắn với đơn mua nào.',
            chungCu: ['Lô nhập ' + l.so + ' — trạng thái ' + (l.trangThai || ''),
                      'Số mặt hàng: ' + (l.lines || []).length,
                      'Đã đối chiếu danh sách hàng và số lượng với toàn bộ đơn mua: KHÔNG có đơn nào khớp'],
            cauHoi: 'Lô ' + l.so + ' thuộc đơn mua nào?',
            deXuat: 'Mở lô nhập và chọn đơn mua nguồn. Nếu lô này không phát sinh từ đơn mua ' +
                    '(mua thẳng, hàng mẫu, hàng biếu) thì ghi rõ vào ghi chú của lô.',
            route: 'lo-nhap', banGhi: [{ coll: 'loNhap', id: l.id, so: l.so }] });
    });

    /* ---- 3. HAI LÔ NHẬP GIỐNG HỆT NHAU ----------------------------------- */
    (function () {
        var theo = {};
        DB.all('loNhap').forEach(function (l) {
            var k = String(l.nhaCungCapId || '') + '|' +
                (l.lines || []).map(function (x) {
                    return x.hangHoaId + 'x' + (Number(x.soLuong) || 0); }).sort().join(';');
            if (k.length < 5) return;
            (theo[k] = theo[k] || []).push(l);
        });
        Object.keys(theo).forEach(function (k) {
            var ds = theo[k];
            if (ds.length < 2) return;
            them({ ma: 'LO_TRUNG|' + ds.map(function (x) { return x.id; }).join(','),
                nhom: 'Mua hàng', mucDo: 'cao',
                tieuDe: 'Có ' + ds.length + ' lô nhập trùng khít nhau',
                moTa: ds.map(function (x) { return x.so + ' (' + T.date(x.ngay) + ')'; }).join(' · ') +
                      ' có cùng nhà cung cấp, cùng danh sách hàng và cùng số lượng.',
                chungCu: ds.map(function (x) {
                    return 'Lô ' + x.so + ' — ' + (x.lines || []).length + ' mặt hàng — ' +
                           (x.trangThai || ''); }),
                cauHoi: 'Đây là hai lần nhập thật, hay một lô bị lập trùng?',
                deXuat: 'Nếu là lô lập trùng thì hủy lô thừa TRƯỚC KHI nhập kho. ' +
                        'Nếu là hai lần nhập thật thì bổ sung số hóa đơn / ghi chú để phân biệt. ' +
                        'Phần mềm KHÔNG tự xóa lô nào.',
                route: 'lo-nhap',
                banGhi: ds.map(function (x) { return { coll: 'loNhap', id: x.id, so: x.so }; }) });
        });
    })();

    /* ---- 4. MÃ KHÁC ĐỤNG ĐỘ ---------------------------------------------- */
    (function () {
        var dd = T.aliasDungDo();
        Object.keys(dd.xau).forEach(function (k) {
            var x = dd.xau[k];
            var ten = x.hang.map(function (id) {
                var h = DB.get('hangHoa', id); return h ? (h.ma + ' ' + h.model) : id; });
            them({ ma: 'ALIAS_DUNG_DO|' + k, nhom: 'Hàng hóa', mucDo: 'cao',
                tieuDe: 'Mã khác "' + k.toUpperCase() + '" không dùng để nhận diện được',
                moTa: x.lyDo + '. Phần mềm đã NGỪNG dùng mã này để kết luận; ' +
                      'khi gặp lại nó sẽ hỏi người dùng thay vì gắn bừa.',
                chungCu: ten.concat(x.laModelCua.length
                    ? ['Đây còn là Model thật của: ' + x.laModelCua.map(function (id) {
                        var h = DB.get('hangHoa', id); return h ? h.ma + ' ' + h.model : id; }).join(' · ')]
                    : []),
                cauHoi: 'Mã khác này thuộc về mặt hàng nào?',
                deXuat: 'Mở Danh mục Hàng hóa, giữ mã khác này ở ĐÚNG MỘT mặt hàng và bỏ khỏi ' +
                        'các mặt hàng còn lại. Phần mềm KHÔNG tự xóa mã khác của ai.',
                route: 'hang-hoa',
                banGhi: x.hang.map(function (id) {
                    var h = DB.get('hangHoa', id);
                    return { coll: 'hangHoa', id: id, so: h ? h.ma : id }; }) });
        });
    })();

    /* ---- 5. TÊN HÀNG TRÙNG NHAU NHƯNG KHÁC MODEL -------------------------- */
    (function () {
        var theoTen = {};
        DB.all('hangHoa').forEach(function (h) {
            var k = T.kd(h.ten || ''); if (!k) return;
            (theoTen[k] = theoTen[k] || []).push(h);
        });
        var ds = Object.keys(theoTen).filter(function (k) { return theoTen[k].length > 1; });
        if (!ds.length) return;
        them({ ma: 'TEN_TRUNG', nhom: 'Hàng hóa', mucDo: 'thap',
            tieuDe: 'Có ' + ds.length + ' tên hàng đang dùng cho nhiều Model khác nhau',
            moTa: 'Khi một tệp chỉ có Tên hàng mà không có Model, phần mềm sẽ ra nhiều ứng viên ' +
                  'và phải hỏi. Đây không phải lỗi số liệu.',
            chungCu: ds.slice(0, 5).map(function (k) {
                return theoTen[k].map(function (h) { return h.ma + ' — ' + h.model; }).join(' · '); }),
            cauHoi: 'Có nên đặt tên phân biệt hơn cho các mặt hàng này không?',
            deXuat: 'Bổ sung cấu hình vào tên hàng để phân biệt. Không bắt buộc.',
            route: 'hang-hoa', banGhi: [] });
    })();

    /* ---- 6. BẤT THƯỜNG – CẦN XỬ LÝ RIÊNG  (v18.6.0 — Logic 1, không hồi tố) --
       Quy ước "nhập kho là đã trả tiền" CHỈ áp dụng cho nghiệp vụ mới. Dữ liệu
       cũ giữ nguyên tuyệt đối: không tạo lại phiếu chi, không xóa công nợ,
       không sửa số tiền. Những khoản cũ không khớp quy ước mới thì đưa vào đây
       để người dùng tự quyết — phần mềm KHÔNG tự xử lý. */
    (function () {
        DB.all('phieuNhap').forEach(function (pn) {
            if (pn.trangThai !== 'Đã ghi sổ') return;
            if (pn.daThanhToan !== undefined) return;      // phiếu theo logic mới
            var dm = T.donMuaCuaPhieuNhap(pn);
            if (!dm) return;
            var pc = T.chiCuaDonMua(dm);
            var daTra = T.sum(pc, function (x) { return Number(x.soTien) || 0; });
            var phai = Number(dm.tongCong) || 0;
            if (pc.length && daTra >= phai) return;         // cũ nhưng đã trả đủ — bình thường
            them({ ma: 'NHAP_CU_CHUA_DU_TIEN|' + pn.id,
                nhom: 'BẤT THƯỜNG – CẦN XỬ LÝ RIÊNG', mucDo: 'vua',
                tieuDe: 'Phiếu nhập kho cũ chưa ghi nhận đủ tiền trả nhà cung cấp',
                moTa: 'Phiếu nhập ' + pn.so + ' ngày ' + T.date(pn.ngay) + ' được ghi sổ TRƯỚC khi ' +
                      'áp dụng quy ước "nhập kho là đã trả tiền", nên phần mềm KHÔNG đóng dấu ' +
                      'thanh toán và KHÔNG trừ tiền cho khoản này. Đơn mua ' + dm.so + ' phải trả ' +
                      T.money(phai) + ' đ, mới có phiếu chi ' + T.money(daTra) + ' đ.',
                chungCu: ['Phiếu nhập ' + pn.so + ' — đã ghi sổ, không có dấu thanh toán (dữ liệu cũ)',
                          'Đơn mua ' + dm.so + ' — tổng ' + T.money(phai) + ' đ',
                          'Phiếu chi đã ghi sổ cho đơn mua này: ' +
                              (pc.length ? pc.map(function (x) { return x.so; }).join(', ') : 'không có') +
                              ' — ' + T.money(daTra) + ' đ'],
                cauHoi: 'Khoản mua của đơn ' + dm.so + ' thực tế đã trả tiền cho nhà cung cấp chưa?',
                deXuat: 'Nếu ĐÃ TRẢ mà chưa có chứng từ: lập phiếu chi cho đơn mua này theo đúng ' +
                        'ngày trả thật. Nếu CHƯA TRẢ: số liệu hiện tại đang đúng, công nợ đang treo ' +
                        'là đúng thực tế. Phần mềm KHÔNG tự tạo, KHÔNG tự xóa, KHÔNG tự sửa số tiền ' +
                        'của bất kỳ chứng từ cũ nào.',
                route: 'nhap-hang',
                banGhi: [{ coll: 'phieuNhap', id: pn.id, so: pn.so },
                         { coll: 'donMua', id: dm.id, so: dm.so }] });
        });
    })();

    var thu = { cao: 0, vua: 1, thap: 2 };
    ra.sort(function (a, b) { return (thu[a.mucDo] || 3) - (thu[b.mucDo] || 3); });
    return { so: ra.length, ds: ra,
             cao: ra.filter(function (x) { return x.mucDo === 'cao'; }).length,
             vua: ra.filter(function (x) { return x.mucDo === 'vua'; }).length,
             thap: ra.filter(function (x) { return x.mucDo === 'thap'; }).length };
};

/* ------------------------------------------------------------ QUỸ VỐN */

/** Tổng vốn cổ đông đã thực góp (mọi đợt, kể cả góp ngoài đợt). */
/**
 * TỔNG NGHĨA VỤ ĐÃ ĐƯỢC THỰC HIỆN — gồm cả tiền cổ đông nộp và tiền bán hàng
 * của công ty được phân bổ vào nghĩa vụ. Đây là con số dùng để biết cổ đông
 * còn thiếu bao nhiêu, KHÔNG phải con số dòng tiền.
 */
T.vonDaGop = function (den, coDongId) {
    return T.tongGdVon('Góp vốn', function (g) {
        return (!den || String(g.ngay || '') <= den) && (!coDongId || g.coDongId === coDongId);
    });
};

/* ==========================================================================
   BA CHỈ TIÊU KHÔNG ĐƯỢC GỘP                          (v18.6.0 — Logic 2)
   --------------------------------------------------------------------------
   1. CỔ ĐÔNG ĐÃ THỰC GÓP          — T.vonCoDongNop
      Tiền cá nhân cổ đông thực sự chuyển vào công ty. ĐÂY là dòng tiền vào.
   2. TIỀN CÔNG TY ĐÃ PHÂN BỔ VÀO NGHĨA VỤ — T.vonPhanBoBanHang
      Tiền bán hàng công ty đã thu, nay được dùng để thực hiện nghĩa vụ góp
      vốn. KHÔNG phải tiền mới, KHÔNG phải tiền cá nhân cổ đông bỏ ra.
   3. CÒN PHẢI GÓP = nghĩa vụ − (1) − (2).

   VÌ SAO PHẢI TÁCH: khoản tiền bán hàng đã được ghi nhận một lần ở phiếu thu.
   Nếu lại cộng nó vào "vốn cổ đông đã góp" khi tính tiền thực tế thì cùng một
   đồng bị đếm hai lần — tiền của công ty tự nhiên gấp đôi.
   ========================================================================== */
T.vonCoDongNop = function (den, coDongId) {
    return T.tongGdVon('Góp vốn', function (g) {
        return (!den || String(g.ngay || '') <= den) &&
               (!coDongId || g.coDongId === coDongId) &&
               g.nguonTien !== 'Tiền bán hàng của công ty';
    });
};
T.vonPhanBoBanHang = function (den, coDongId) {
    return T.tongGdVon('Góp vốn', function (g) {
        return (!den || String(g.ngay || '') <= den) &&
               (!coDongId || g.coDongId === coDongId) &&
               g.nguonTien === 'Tiền bán hàng của công ty';
    });
};
T.vonDaRut = function (den, coDongId) {
    return T.tongGdVon('Rút vốn', function (g) {
        return (!den || String(g.ngay || '') <= den) && (!coDongId || g.coDongId === coDongId);
    });
};
T.loiNhuanDaChia = function (den, coDongId) {
    return T.tongGdVon('Chia lợi nhuận', function (g) {
        return (!den || String(g.ngay || '') <= den) && (!coDongId || g.coDongId === coDongId);
    });
};

/**
 * TỔNG GIÁ VỐN ĐÃ THU HỒI TỪ HOẠT ĐỘNG BÁN HÀNG.
 * Đọc thẳng Engine giá vốn hiện tại, không tính lại, không giả định gì thêm:
 * đây chính là giá vốn kho thực tế của toàn bộ hàng đã bán trong kỳ.
 */
T.vonDaThuHoi = function (loc) {
    return T.ketQuaKinhDoanh(loc || {}).giaVonGoc;
};

/** Vốn đang nằm trong hàng tồn kho — phần vốn CHƯA quay về quỹ. */
T.vonDangQuayVong = function () { return T.giaTriTonKho(); };

/**
 * NHU CẦU VỐN ĐÃ CAM KẾT — số tiền hệ thống đang phải dành sẵn cho việc nhập
 * hàng. Luồng nhập kho hai bước của v11 làm việc này rất tự nhiên:
 *   · Lô còn nháp (Chờ kiểm tra · Chờ nhập kho) = đã cam kết mua, hàng chưa về.
 *   · Công nợ phải trả nhà cung cấp = hàng đã về, tiền chưa trả.
 * Cả hai đều đọc thẳng từ chứng từ gốc, không có bản sao nào.
 */
T.nhuCauVon = function () {
    var dsLo = DB.all('loNhap').filter(function (lo) { return T.loConNhap(lo); });
    var loChuaNhap = T.sum(dsLo, function (lo) {
        return Number(lo.tongGiaVon) || Number(lo.tongTienHang) || 0;
    });
    var dsNcc = [];
    DB.all('nhaCungCap').forEach(function (n) {
        var cn = T.congNoNCC(n.id);
        if (cn.conLai > 0) dsNcc.push({ id: n.id, ten: n.ten, soTien: cn.conLai });
    });
    var noNCC = T.sum(dsNcc, function (x) { return x.soTien; });
    return { loChuaNhap: loChuaNhap, noNCC: noNCC, tong: loChuaNhap + noNCC,
             dsLo: dsLo, dsNcc: dsNcc };
};

/**
 * QUỸ VỐN — trái tim của phân hệ.
 *
 *     Khả dụng = Đã góp − Đã rút + Tiền vay − Vốn đang nằm trong kho
 *
 * KHÔNG cộng "đã thu hồi" vào đây: tiền bỏ ra mua hàng từ trước tới nay bằng
 * đúng (giá vốn hàng đã bán + giá trị hàng còn tồn); phần đã bán thì vốn đã
 * quay về nên tự triệt tiêu, chỉ còn phần tồn kho là chưa về. Cộng thêm lần nữa
 * là tính hai lần đúng số tiền đó.
 *
 * Lợi nhuận KHÔNG cộng vào quỹ vốn, và chi phí KHÔNG làm giảm quỹ vốn — đúng
 * như quy định của phân hệ: quỹ vốn là VỐN, không phải kết quả kinh doanh.
 */
T.quyVon = function (loc) {
    /* LỚP MỎNG TRÊN T.quyVonKy — giữ nguyên tên và hình dạng cũ để mọi nơi đang
       gọi không phải sửa, nhưng con số thì lấy từ đúng một bộ máy.

       KHÁC BIỆT CỐT LÕI SO VỚI BẢN TRƯỚC: "khả dụng" nay là TIỀN THỰC TẾ, không
       phải một hiệu số suy ra. Quỹ ban đầu bằng 0; tiền chỉ có khi cổ đông thật
       sự nộp hoặc khách hàng thật sự trả. Tiền đã chi ra mua hàng không còn nằm
       trong tiền mặt nữa — phần vốn đó đang ở dạng hàng và được theo dõi riêng.
       Nhờ vậy không đồng nào bị đếm hai lần. */
    var q = T.quyVonKy(loc);
    var nhuCau = T.nhuCauVon();
    var tien = q.tienThucTe.cuoiKy;
    return {
        daGop: q.daGop.cuoiKy, daRut: q.daRut.cuoiKy, tienVay: q.tienVay,
        daHuyDong: q.daGop.cuoiKy - q.daRut.cuoiKy,
        daThuHoi: q.daThuHoi,
        dangQuayVong: q.vonTrongHang.cuoiKy,
        tienThucTe: tien,
        conPhaiThuHoi: q.vonTrongHang.cuoiKy + nhuCau.loChuaNhap,
        khaDung: tien,
        quyQuayVong: q.quyQuayVong.cuoiKy,
        nhuCau: nhuCau,
        sauCamKet: tien - nhuCau.tong,
        canHuyDongThem: tien - nhuCau.tong < 0 ? nhuCau.tong - tien : 0,
        ky: q
    };
};


/**
 * KIỂM TRA RÚT VỐN.
 * Không có nhu cầu nhập hàng thì cho rút. Đang có nhu cầu mà quỹ không đủ thì
 * DỪNG, nêu rõ lý do bằng con số, không ghi một dòng dữ liệu nào.
 */
T.kiemTraRutVon = function (coDongId, soTien, ngay) {
    var loi = [];
    soTien = Math.round(Number(soTien) || 0);
    var cd = DB.get('coDong', coDongId);
    var quy = T.quyVon();
    if (!cd) loi.push('Chưa chọn cổ đông hoặc cổ đông không còn trong danh sách.');
    if (soTien <= 0) loi.push('Số tiền rút phải lớn hơn 0.');
    if (cd) {
        /* v18.6.0 — Logic 2. Cổ đông chỉ rút được TIỀN CHÍNH MÌNH ĐÃ BỎ RA.
           Phần nghĩa vụ được thực hiện bằng tiền bán hàng của công ty không
           phải tiền cá nhân cổ đông nên không nằm trong số rút được. */
        var rong = T.vonCoDongNop(ngay, cd.id) - T.vonDaRut(ngay, cd.id);
        if (soTien > rong)
            loi.push('Cổ đông ' + cd.ten + ' hiện chỉ còn ' + T.money(rong) +
                     ' đ đã thực góp bằng tiền cá nhân (chưa rút), không rút được ' +
                     T.money(soTien) + ' đ. Phần nghĩa vụ được thực hiện bằng tiền bán hàng ' +
                     'của công ty không phải tiền cá nhân của cổ đông.');
    }
    if (soTien > 0 && quy.khaDung - soTien < quy.nhuCau.tong) {
        loi.push('Quỹ vốn khả dụng còn ' + T.money(quy.khaDung) + ' đ, trong khi nhu cầu vốn ' +
                 'đã cam kết cho nhập hàng là ' + T.money(quy.nhuCau.tong) + ' đ (lô chưa nhập kho ' +
                 T.money(quy.nhuCau.loChuaNhap) + ' đ · nợ nhà cung cấp ' +
                 T.money(quy.nhuCau.noNCC) + ' đ). Rút ' + T.money(soTien) +
                 ' đ sẽ thiếu ' + T.money(quy.nhuCau.tong - (quy.khaDung - soTien)) + ' đ.');
    }
    return { duoc: !loi.length, loi: loi, quy: quy };
};

/* ---------------------------------------------------------- LỢI NHUẬN */

/**
 * LỢI NHUẬN ĐEM CHIA — đọc thẳng Business Engine, phạm vi ĐƠN VỊ NGUỒN
 * (Tản Viên), là pháp nhân mà cổ đông góp vốn vào và là chủ sở hữu kho hàng.
 * Không tính lại một phép tính nào; chỉ gọi đúng một cửa T.ketQuaKinhDoanh.
 */
T.locVon = function (loc) {
    var o = {};
    Object.keys(loc || {}).forEach(function (k) { o[k] = loc[k]; });
    o.donViId = (T.donViVon() || {}).id || '';
    return o;
};

/**
 * PHÂN CHIA LỢI NHUẬN theo tỷ lệ sở hữu.
 * Lỗ thì KHÔNG chia: chuyển sang "Lợi nhuận chờ bù" và không đụng tới quỹ vốn.
 */
T.chiaLoiNhuan = function (loc, denNgay) {
    /* Giữ tên cũ, ủy quyền cho bản theo kỳ. daChia của bản này là ĐÃ CHIA TRONG
       KỲ — trước đây lấy nhầm số cộng dồn từ trước tới nay. */
    var o = {};
    Object.keys(loc || {}).forEach(function (k) { o[k] = loc[k]; });
    if (denNgay && !o.denNgay) o.denNgay = denNgay;
    var r = T.chiaLoiNhuanKy(o);
    r.daChia = r.daChiaTrongKy;
    r.theoCoDong.forEach(function (x) { x.daNhan = x.daNhanTrongKy; });
    return r;
};


/* ------------------------------------------------- TỔNG QUAN VÀ ĐỐI CHIẾU */

/** Chín chỉ tiêu của tab Tổng quan — không ô nào cho nhập tay. */
T.tongQuanVon = function (loc) {
    var q = T.quyVonKy(loc);
    var ln = T.chiaLoiNhuanKy(loc);
    return {
        tongPhaiGop: q.nghiaVu.cuoiKy, daGop: q.daGop.cuoiKy, conThieu: q.conThieu.cuoiKy,
        /* Ba chỉ tiêu tách bạch (v18.6.0 — Logic 2). */
        coDongNop: q.coDongNop.cuoiKy, phanBoBanHang: q.phanBoBanHang.cuoiKy,
        tongLaiChamGop: q.lai.cuoiKy,
        quyKhaDung: q.tienThucTe.cuoiKy, dangQuayVong: q.vonTrongHang.cuoiKy,
        conPhaiThuHoi: q.vonTrongHang.cuoiKy + T.nhuCauVon().loChuaNhap,
        loiNhuanChuaChia: ln.chuaChia, loiNhuanDaChia: ln.daChiaTrongKy,
        loiNhuanChoBu: ln.choBu,
        quy: T.quyVon(loc), dot: T.tinhMoiDot(q.ky.den), ln: ln, ky: q
    };
};


/**
 * ĐỐI CHIẾU RIÊNG CỦA PHÂN HỆ VỐN.
 * Cố ý KHÔNG chèn vào T.doiChieuSo để không đụng một dòng nào của Engine đang
 * có. Màn hình Góp vốn tự gọi hàm này và hiển thị kết quả ngay tại tab Tổng quan.
 */
T.doiChieuVon = function (loc) { return T.doiChieuVonKy(loc); };


/**
 * BỐI CẢNH DÙNG CHUNG khi phải dựng sổ vốn cho NHIỀU cổ đông một lượt.
 * Không có nó thì mỗi cổ đông lại chạy lại toàn bộ các đợt và toàn bộ phép chia
 * lợi nhuận — 50 cổ đông với 30 đợt là 1.500 lần chạy thừa. Đây KHÔNG phải bản
 * sao dữ liệu: nó sống đúng một lần vẽ màn hình rồi bị bỏ, không ghi vào đâu cả.
 */
T.boiCanhVon = function (loc) { return T.boiCanhVonKy(loc); };


/**
 * SỔ VỐN CỦA MỘT CỔ ĐÔNG — dùng cho tab Báo cáo.
 * Toàn bộ số liệu lấy trực tiếp từ ba bảng dữ liệu gốc và từ Business Engine,
 * không có bảng tính trung gian nào.
 * Tham số bc (tùy chọn) là bối cảnh dùng chung của T.boiCanhVon — truyền vào khi
 * dựng sổ cho cả danh sách để khỏi tính lại phần chung cho từng người.
 */
T.soVonCoDong = function (cd, loc, bc) {
    /* Lớp mỏng giữ đúng tên trường cũ, số liệu lấy từ bản theo kỳ. */
    var k = T.soVonCoDongKy(cd, loc, bc);
    return {
        coDong: k.coDong, ky: k.ky, tyLe: k.tyLe,
        phaiGop: k.nghiaVu.cuoiKy, daGop: k.daGop.cuoiKy, daGopTheoDot: k.daGop.cuoiKy,
        coDongNop: k.coDongNop.cuoiKy, phanBoBanHang: k.phanBoBanHang.cuoiKy,
        thieu: k.conPhaiGop, lai: k.lai.cuoiKy, daRut: k.daRut.cuoiKy,
        vonRong: k.vonRong, dangQuayVong: k.vonTrongHang, daThuHoi: k.daThuHoi,
        duocChia: k.duocChia, khauTru: k.khauTru, thucNhan: k.thucNhan,
        daNhan: k.daNhanTrongKy, daNhanLuyKe: k.daNhanLuyKe,
        conPhaiTra: k.conDuocNhan, nhatKy: k.nhatKy, ky3: k
    };
};


/* ==========================================================================
   BUSINESS ENGINE — BÁO CÁO THEO KỲ VÀ TIỀN THỰC TẾ            (thêm ở v13.0.0)
   --------------------------------------------------------------------------
   BA ĐIỀU KHỐI NÀY BẢO ĐẢM

   1. BÁO CÁO LỊCH SỬ ĐÚNG THỜI ĐIỂM.
      Mọi chỉ tiêu đều tách được thành ĐẦU KỲ · PHÁT SINH TRONG KỲ · CUỐI KỲ.
      Số đầu kỳ là lũy kế tới hết ngày liền trước ngày bắt đầu; số cuối kỳ là
      lũy kế tới hết ngày kết thúc. Giao dịch phát sinh SAU ngày kết thúc không
      có đường nào lọt vào con số của kỳ.

   2. TIỀN THỰC TẾ KHÁC NGHĨA VỤ GÓP VỐN.
      Quỹ ban đầu bằng 0. Tạo một đợt góp vốn chỉ xác lập CẦN HUY ĐỘNG BAO
      NHIÊU — không sinh ra một đồng nào trong quỹ. Tiền chỉ có khi cổ đông
      thật sự nộp, và mỗi đồng chỉ được đếm đúng một lần:

          Tiền thực tế = Cổ đông thực góp − Rút vốn − Lợi nhuận đã chi trả
                       + Tiền bán hàng đã thu (Phiếu thu)
                       − Tiền đã chi ra      (Phiếu chi)

      Tiền đã dùng mua hàng nằm ở vế Phiếu chi nên đã bị trừ khỏi tiền thực tế;
      phần vốn đó đang ở dạng HÀNG và được theo dõi riêng bằng giá trị tồn kho.
      Hai vế không bao giờ cộng chồng lên nhau.

          Quỹ vốn quay vòng = Tiền thực tế + Giá vốn đang nằm trong hàng

   3. MỘT BỘ MÁY DUY NHẤT.
      Không có phép tính nào ở đây tự dựng lại doanh thu, giá vốn hay tồn kho.
      Doanh thu · giá vốn · chi phí · lợi nhuận gọi T.ketQuaKinhDoanh.
      Tồn kho theo thời điểm gọi T.chayLaiKho — chính bộ máy mà T.tinhLaiGiaVon
      dùng để ghi sổ. Tiền gọi thẳng Phiếu thu và Phiếu chi.
   ========================================================================== */

/**
 * Chuẩn hóa một kỳ báo cáo.
 * truoc = ngày liền trước ngày bắt đầu — mốc chốt của SỐ ĐẦU KỲ.
 * Không khai Từ ngày thì kỳ tính từ lúc khai sinh dữ liệu, đầu kỳ bằng 0.
 */
T.kyBaoCao = function (loc) {
    loc = loc || {};
    var tu = String(loc.tuNgay || '');
    var den = String(loc.denNgay || '') || T.today();
    return {
        tu: tu, den: den,
        truoc: tu ? T.addDays(tu, -1) : '',
        coDauKy: !!tu,
        nhan: tu ? (T.date(tu) + ' → ' + T.date(den)) : ('Từ đầu đến ' + T.date(den))
    };
};

/** Bản sao bộ lọc, chốt lũy kế tới một ngày (bỏ mốc bắt đầu). */
T.locLuyKe = function (loc, den) {
    var o = {};
    Object.keys(loc || {}).forEach(function (k) { o[k] = loc[k]; });
    delete o.tuNgay;
    if (den) o.denNgay = den; else delete o.denNgay;
    return o;
};

/** Ba con số của một chỉ tiêu: đầu kỳ · trong kỳ · cuối kỳ. */
function baKy(dauKy, cuoiKy) {
    return { dauKy: dauKy, trongKy: cuoiKy - dauKy, cuoiKy: cuoiKy };
}
T.baKy = baKy;

/* ------------------------------------------------------- GIÁ VỐN TRONG HÀNG */

/**
 * TỒN KHO VÀ GIÁ TRỊ TỒN KHO TẠI MỘT NGÀY BẤT KỲ TRONG QUÁ KHỨ.
 * Phát lại đúng bộ máy của T.tinhLaiGiaVon tới mốc đó rồi đọc kết quả — không
 * ghi gì, không suy ngược từ số hiện tại. Vì vậy tồn kho ngày 31/12/2025 giữ
 * nguyên dù sau đó phát sinh bao nhiêu chứng từ của năm 2026.
 */
T.tonKhoTaiNgay = function (den) {
    den = String(den || '');
    /* Không khai mốc, hoặc mốc từ hôm nay trở đi → chính là sổ hiện hành. */
    if (!den || den >= T.today()) {
        var ton0 = {}, bq0 = {}, sl0 = 0;
        DB.all('hangHoa').forEach(function (h) {
            ton0[h.id] = Number(h.ton) || 0;
            bq0[h.id] = T.giaVonGoc(h);
            sl0 += ton0[h.id];
        });
        return { ngay: den || T.today(), ton: ton0, bq: bq0,
                 soLuong: sl0, giaTri: T.giaTriTonKho(), song: true };
    }
    var kq = T.chayLaiKho(den);
    var gt = 0, sl = 0, soMa = 0;
    Object.keys(kq.ton).forEach(function (id) {
        var t = Number(kq.ton[id]) || 0;
        if (!t) return;
        soMa++; sl += t;
        gt += t * (Number(kq.bq[id]) || 0);
    });
    return { ngay: den, ton: kq.ton, bq: kq.bq, soLuong: sl, soMa: soMa,
             giaTri: Math.round(gt), song: false };
};

/** Giá trị tồn kho tại một ngày — con số duy nhất, dùng cho mọi báo cáo kỳ. */
T.giaTriTonKhoTaiNgay = function (den) { return T.tonKhoTaiNgay(den).giaTri; };

/* --------------------------------------------------------------- TIỀN THỰC TẾ */

/** Tổng phiếu thu ĐÃ GHI SỔ tới một ngày (tiền thật đã về). */
T.tienDaThu = function (den, loc) {
    return T.sum(DB.all('phieuThu').filter(function (p) {
        if (p.trangThai !== 'Đã ghi sổ') return false;
        if (den && String(p.ngay || '') > den) return false;
        if (loc && loc.donViId && p.donVi !== loc.donViId) return false;
        return true;
    }), function (p) { return Number(p.soTien) || 0; });
};

/** Tổng phiếu chi ĐÃ GHI SỔ tới một ngày (tiền thật đã ra). */
T.tienDaChi = function (den, loc) {
    return T.sum(DB.all('phieuChi').filter(function (p) {
        if (p.trangThai !== 'Đã ghi sổ') return false;
        if (den && String(p.ngay || '') > den) return false;
        if (loc && loc.donViId && p.donVi !== loc.donViId) return false;
        return true;
    }), function (p) { return Number(p.soTien) || 0; });
};

/**
 * TIỀN THỰC TẾ ĐANG CÓ tại một ngày. Quỹ ban đầu bằng 0.
 * Mỗi đồng đúng một lần: tiền cổ đông nộp vào, tiền khách trả về, trừ tiền đã
 * chi ra (kể cả tiền mua hàng), trừ tiền đã rút và tiền đã chia lợi nhuận.
 */
T.tienThucTe = function (den) {
    /* v18.6.0 — HAI SỬA ĐỔI, MỖI SỬA ĐỔI MỘT LÝ DO RÕ RÀNG:
       1. Dùng T.vonCoDongNop thay cho T.vonDaGop. Tiền bán hàng được phân bổ
          vào nghĩa vụ góp vốn KHÔNG phải tiền mới chảy vào công ty — nó đã
          nằm trong tiền đã thu từ phiếu thu. Cộng cả hai là ghi nhận KÉP.
       2. Trừ tiền đã trả nhà cung cấp qua nghiệp vụ nhập kho, vì hàng đã nhập
          kho nghĩa là đã trả đủ. Chỉ tính phiếu nhập mang dấu thanh toán nên
          dữ liệu lịch sử không bị trừ hai lần. */
    return T.vonCoDongNop(den) - T.vonDaRut(den) - T.loiNhuanDaChia(den)
         + T.tienDaThu(den) - T.tienDaChi(den) - T.tienTraNhapKho(den);
};

/* ------------------------------------------------------- GÓP VỐN THEO KỲ */

/**
 * Một loại giao dịch vốn, tách ba: đầu kỳ · trong kỳ · cuối kỳ.
 * "Trong kỳ" là hiệu của hai mốc lũy kế nên không bao giờ lẫn giao dịch của kỳ
 * khác — đây chính là chỗ mà bản trước lấy nhầm số cộng dồn.
 */
T.gdVonKy = function (loai, loc, coDongId, nguon) {
    var k = T.kyBaoCao(loc);
    /* nguon (v18.6.0 — Logic 2): 'coDong' chỉ lấy tiền cổ đông thực bỏ ra,
       'banHang' chỉ lấy tiền bán hàng của công ty được phân bổ vào nghĩa vụ,
       bỏ trống thì lấy cả hai (tổng nghĩa vụ đã thực hiện). */
    var f = function (den) {
        return T.tongGdVon(loai, function (g) {
            if (nguon === 'coDong' && g.nguonTien === 'Tiền bán hàng của công ty') return false;
            if (nguon === 'banHang' && g.nguonTien !== 'Tiền bán hàng của công ty') return false;
            return (!den || String(g.ngay || '') <= den) &&
                   (!coDongId || g.coDongId === coDongId);
        });
    };
    return baKy(k.coDauKy ? f(k.truoc) : 0, f(k.den));
};

/** Nghĩa vụ phải góp — chỉ tính các đợt đã tạo tới hết ngày chốt. */
T.nghiaVuGopKy = function (loc, coDongId) {
    var k = T.kyBaoCao(loc);
    function f(den) {
        if (!den) return 0;
        return T.sum(DB.all('dotGopVon').filter(function (d) {
            return d.trangThai !== 'Đã hủy' && String(d.ngay || '') <= den;
        }), function (d) {
            return T.sum((d.phanBo || []).filter(function (x) {
                return !coDongId || x.coDongId === coDongId;
            }), function (x) { return Number(x.phaiGop) || 0; });
        });
    }
    return baKy(k.coDauKy ? f(k.truoc) : 0, f(k.den));
};

/** Lãi chậm góp tách theo kỳ: lũy kế tới hai mốc rồi lấy hiệu. */
T.laiChamGopKy = function (loc, coDongId) {
    var k = T.kyBaoCao(loc);
    function f(den) {
        if (!den) return 0;
        return T.sum(DB.all('dotGopVon').filter(function (d) {
            return d.trangThai !== 'Đã hủy' && String(d.ngay || '') <= den;
        }), function (d) {
            return T.sum((d.phanBo || []).filter(function (x) {
                return !coDongId || x.coDongId === coDongId;
            }), function (x) { return T.laiChamGop(d, x.coDongId, den).lai; });
        });
    }
    return baKy(k.coDauKy ? f(k.truoc) : 0, f(k.den));
};

/* --------------------------------------------------------------- QUỸ VỐN */

/**
 * QUỸ VỐN THEO KỲ — bức tranh đầy đủ, tách bạch tám trạng thái mà nghiệp vụ
 * đòi hỏi. Không con số nào ở đây được lưu lại; tất cả tính tại chỗ từ chứng từ.
 */
T.quyVonKy = function (loc) {
    var k = T.kyBaoCao(loc);
    var c = T.cauHinhVon();
    var gop = T.gdVonKy('Góp vốn', loc);
    /* BA CHỈ TIÊU TÁCH BẠCH (v18.6.0 — Logic 2). "gop" là TỔNG NGHĨA VỤ ĐÃ
       THỰC HIỆN, không phải tiền cổ đông bỏ ra. Hai con số dưới đây mới nói
       đúng nguồn tiền, và tổng của chúng đúng bằng "gop". */
    var gopCD = T.gdVonKy('Góp vốn', loc, null, 'coDong');
    var gopBH = T.gdVonKy('Góp vốn', loc, null, 'banHang');
    var rut = T.gdVonKy('Rút vốn', loc);
    var chia = T.gdVonKy('Chia lợi nhuận', loc);
    var nv = T.nghiaVuGopKy(loc);
    var lai = T.laiChamGopKy(loc);

    var thuD = k.coDauKy ? T.tienDaThu(k.truoc) : 0, thuC = T.tienDaThu(k.den);
    var chiD = k.coDauKy ? T.tienDaChi(k.truoc) : 0, chiC = T.tienDaChi(k.den);
    var thu = baKy(thuD, thuC), chi = baKy(chiD, chiC);

    var tienD = k.coDauKy ? T.tienThucTe(k.truoc) : 0;
    var tienC = T.tienThucTe(k.den);
    var tien = baKy(tienD, tienC);

    var hangD = k.coDauKy ? T.giaTriTonKhoTaiNgay(k.truoc) : 0;
    var hangC = T.giaTriTonKhoTaiNgay(k.den);
    var hang = baKy(hangD, hangC);

    /* Giá vốn đã thu hồi qua bán hàng — lấy thẳng kết quả kinh doanh của kỳ. */
    var thuHoi = T.ketQuaKinhDoanh(T.locVon(loc)).giaVon;

    var tienVay = Number(c.tienVay) || 0;      /* dự phòng — bản này luôn 0 */

    return {
        ky: k,
        nghiaVu: nv,                 /* 1. Nghĩa vụ phải góp                */
        daGop: gop,                  /* 2. Nghĩa vụ ĐÃ THỰC HIỆN (cả hai nguồn) */
        coDongNop: gopCD,            /* 2a. Cổ đông đã THỰC GÓP bằng tiền cá nhân */
        phanBoBanHang: gopBH,        /* 2b. Tiền công ty đã PHÂN BỔ vào nghĩa vụ  */
        conThieu: baKy(Math.max(0, nv.dauKy - gop.dauKy),
                       Math.max(0, nv.cuoiKy - gop.cuoiKy)),  /* 3. Còn phải góp */
        lai: lai,                    /* 4. Lãi chậm góp                     */
        daRut: rut,
        daChia: chia,
        tienThu: thu, tienChi: chi,
        tienThucTe: tien,            /* 5. Tiền thực tế đang có             */
        vonTrongHang: hang,          /* 6. Giá vốn đang nằm trong hàng hóa  */
        daThuHoi: thuHoi,            /* 7. Tiền bán hàng đã thu hồi về      */
        tienVay: tienVay,
        quyQuayVong: baKy(tien.dauKy + hang.dauKy + tienVay,
                          tien.cuoiKy + hang.cuoiKy + tienVay)  /* 8. Quỹ quay vòng */
    };
};

/* ------------------------------------------------------------- LỢI NHUẬN KỲ */

/**
 * LỢI NHUẬN VÀ PHÂN CHIA THEO ĐÚNG KỲ.
 * "Đã chia trong kỳ" chỉ gồm các giao dịch chia lợi nhuận có ngày nằm trong kỳ.
 * Khoản chia của năm trước không bao giờ lọt vào con số của năm sau.
 */
T.chiaLoiNhuanKy = function (loc) {
    var k = T.kyBaoCao(loc);
    var c = T.cauHinhVon();
    var kq = T.ketQuaKinhDoanh(T.locVon(loc));
    var lai = kq.loiNhuan;
    var choBu = lai < 0 ? -lai : 0;
    var deChia = lai > 0 ? lai : 0;          /* lỗ thì phần được chia bằng 0 */

    var chia = T.gdVonKy('Chia lợi nhuận', loc);
    var ds = T.dsCoDongTaiNgay(k.den);
    var pb = T.chiaTheoTyLe(deChia, ds);
    var laiKy = {};
    ds.forEach(function (x) { laiKy[x.id] = T.laiChamGopKy(loc, x.id); });

    var theoCoDong = pb.map(function (x) {
        var lk = laiKy[x.coDongId] || baKy(0, 0);
        var tru = c.khauTruLai ? Math.min(lk.cuoiKy, x.soTien) : 0;
        var nhan = T.gdVonKy('Chia lợi nhuận', loc, x.coDongId);
        return {
            coDongId: x.coDongId, ten: x.ten, tyLe: x.tyLe,
            duocChia: x.soTien,
            laiChamGop: lk.cuoiKy, laiChamGopKy: lk.trongKy,
            khauTru: tru, thucNhan: x.soTien - tru,
            daNhanTrongKy: nhan.trongKy, daNhanLuyKe: nhan.cuoiKy,
            conPhaiTra: Math.max(0, x.soTien - tru - nhan.trongKy)
        };
    });

    return {
        ky: k, kq: kq,
        loiNhuan: lai,                 /* 1. Lợi nhuận phát sinh trong kỳ    */
        deChia: deChia,                /* 2. Lợi nhuận được phép chia trong kỳ */
        daChiaTrongKy: chia.trongKy,   /* 3. Lợi nhuận đã chia trong kỳ      */
        daChiaLuyKe: chia.cuoiKy,
        daChiaDauKy: chia.dauKy,
        chuaChia: Math.max(0, deChia - chia.trongKy),  /* 4. Còn chưa chia   */
        choBu: choBu,
        khauTruLai: !!c.khauTruLai,
        theoCoDong: theoCoDong
    };
};

/* -------------------------------------------------- SỔ VỐN CỔ ĐÔNG THEO KỲ */

/** Bối cảnh dùng chung khi dựng sổ cho nhiều cổ đông trong cùng một kỳ. */
T.boiCanhVonKy = function (loc) {
    var k = T.kyBaoCao(loc);
    var quy = T.quyVonKy(loc);
    return {
        ky: k, quy: quy, ln: T.chiaLoiNhuanKy(loc),
        tongRong: quy.daGop.cuoiKy - quy.daRut.cuoiKy
    };
};

/**
 * SỔ VỐN CỦA MỘT CỔ ĐÔNG TRONG MỘT KỲ — mọi cột đều truy được về nguồn.
 */
T.soVonCoDongKy = function (cd, loc, bc) {
    bc = bc || T.boiCanhVonKy(loc);
    var k = bc.ky;
    var nv = T.nghiaVuGopKy(loc, cd.id);
    var gop = T.gdVonKy('Góp vốn', loc, cd.id);
    /* BA CHỈ TIÊU TÁCH BẠCH (v18.6.0 — Logic 2) cho từng cổ đông. */
    var gopCD = T.gdVonKy('Góp vốn', loc, cd.id, 'coDong');
    var gopBH = T.gdVonKy('Góp vốn', loc, cd.id, 'banHang');
    var rut = T.gdVonKy('Rút vốn', loc, cd.id);
    var lai = T.laiChamGopKy(loc, cd.id);
    var nhan = T.gdVonKy('Chia lợi nhuận', loc, cd.id);
    var pc = bc.ln.theoCoDong.filter(function (x) { return x.coDongId === cd.id; })[0] ||
             { duocChia: 0, khauTru: 0, thucNhan: 0 };
    var rong = gop.cuoiKy - rut.cuoiKy;
    var phanHang = bc.tongRong
        ? Math.round(bc.quy.vonTrongHang.cuoiKy * rong / bc.tongRong) : 0;
    var phanThuHoi = bc.tongRong
        ? Math.round(bc.quy.daThuHoi * rong / bc.tongRong) : 0;
    return {
        coDong: cd, ky: k, tyLe: T.tyLeCoDong(cd, k.den),
        nghiaVu: nv, daGop: gop, coDongNop: gopCD, phanBoBanHang: gopBH,
        daRut: rut, lai: lai,
        conPhaiGop: Math.max(0, nv.cuoiKy - gop.cuoiKy),
        vonRong: rong,
        daThuHoi: phanThuHoi,
        vonTrongHang: phanHang,
        duocChia: pc.duocChia, khauTru: pc.khauTru, thucNhan: pc.thucNhan,
        daNhanTrongKy: nhan.trongKy, daNhanLuyKe: nhan.cuoiKy,
        conDuocNhan: Math.max(0, pc.thucNhan - nhan.trongKy),
        nhatKy: DB.all('giaoDichVon').filter(function (g) {
            if (g.coDongId !== cd.id || g.trangThai === 'Đã hủy') return false;
            var n = String(g.ngay || '');
            if (k.tu && n < k.tu) return false;
            return n <= k.den;
        }).sort(function (a, b) { return a.ngay < b.ngay ? 1 : -1; })
    };
};

/**
 * BÁO CÁO TỔNG HỢP CỦA MỘT KỲ — phần A (kết quả kinh doanh Tản Viên) và phần B
 * (từng cổ đông). Đây là cửa duy nhất mà màn hình Báo cáo gọi.
 */
T.baoCaoVonKy = function (loc) {
    var bc = T.boiCanhVonKy(loc);
    var kq = bc.ln.kq;
    return {
        ky: bc.ky, quy: bc.quy, ln: bc.ln, kq: kq,
        donVi: T.donViVon(),
        A: [
            { ct: 'Doanh thu ' + ((T.donViVon() || {}).tat || 'Tản Viên'), gt: kq.doanhThu,
              nguon: 'Chuỗi chứng từ bán hàng — T.ketQuaKinhDoanh' },
            { ct: 'Giá vốn hàng hóa', gt: kq.giaVon,
              nguon: 'Giá vốn bình quân gia quyền đóng băng trên chứng từ' },
            { ct: 'Lợi nhuận gộp', gt: kq.loiNhuanGop, nguon: 'Doanh thu − Giá vốn' },
            { ct: 'Chi phí trong kỳ', gt: kq.chiPhi,
              nguon: 'Phiếu chi đã ghi sổ có khoản mục tính vào chi phí' },
            { ct: 'Lợi nhuận sau chi phí', gt: kq.loiNhuan, nguon: 'Lợi nhuận gộp − Chi phí' },
            { ct: 'Lợi nhuận được phép phân phối', gt: bc.ln.deChia,
              nguon: 'Lợi nhuận sau chi phí, âm thì bằng 0' },
            { ct: 'Lợi nhuận đã chia trong kỳ', gt: bc.ln.daChiaTrongKy,
              nguon: 'Giao dịch chia lợi nhuận có ngày trong kỳ' },
            { ct: 'Lợi nhuận chưa chia', gt: bc.ln.chuaChia,
              nguon: 'Được phép phân phối − Đã chia trong kỳ' }
        ],
        B: DB.all('coDong').map(function (cd) { return T.soVonCoDongKy(cd, loc, bc); })
    };
};

/* ------------------------------------------------------ ĐỐI CHIẾU HAI CHIỀU */

/**
 * ĐỐI CHIẾU TÍNH NHẤT QUÁN CỦA MỘT KỲ — mười hai phép kiểm của quy trình.
 * Mỗi phép nêu rõ con số hai vế để người dùng truy ngược được về nguồn.
 */
T.doiChieuVonKy = function (loc) {
    var loi = [], canhBao = [];
    var k = T.kyBaoCao(loc);
    var bc = T.boiCanhVonKy(loc);
    var q = bc.quy, ln = bc.ln, kq = ln.kq;

    function bat(dk, ten, moTa, huong) {
        if (!dk) loi.push({ ten: ten, moTa: moTa, huong: huong || '' });
    }
    function nhac(dk, ten, moTa, huong) {
        if (!dk) canhBao.push({ ten: ten, moTa: moTa, huong: huong || '' });
    }

    /* 1-2. Doanh thu và giá vốn của báo cáo phải bằng đúng Engine. */
    var lai2 = T.ketQuaKinhDoanh(T.locVon(loc));
    bat(lai2.doanhThu === kq.doanhThu, 'Doanh thu báo cáo không khớp Business Engine',
        T.money(kq.doanhThu) + ' đ · Engine ' + T.money(lai2.doanhThu) + ' đ');
    bat(lai2.giaVon === kq.giaVon, 'Giá vốn báo cáo không khớp Business Engine',
        T.money(kq.giaVon) + ' đ · Engine ' + T.money(lai2.giaVon) + ' đ');

    /* 3. Tồn kho cuối kỳ phải bằng phát lại sổ kho tới ngày chốt. */
    var tk = T.tonKhoTaiNgay(k.den);
    bat(q.vonTrongHang.cuoiKy === tk.giaTri, 'Giá trị tồn kho cuối kỳ không khớp sổ kho',
        T.money(q.vonTrongHang.cuoiKy) + ' đ · sổ kho ' + T.money(tk.giaTri) + ' đ');

    /* 4. Chi phí phải bằng tổng phiếu chi hợp lệ của kỳ. */
    var cp = T.chiPhiKy(T.locVon(loc));
    bat(cp.tong === kq.chiPhi, 'Chi phí báo cáo không khớp dữ liệu Phiếu chi',
        T.money(kq.chiPhi) + ' đ · phiếu chi ' + T.money(cp.tong) + ' đ');

    /* 5. Đẳng thức lợi nhuận. */
    bat(kq.loiNhuan === kq.doanhThu - kq.giaVon - kq.chiPhi,
        'Đẳng thức lợi nhuận sai',
        'Lợi nhuận ' + T.money(kq.loiNhuan) + ' ≠ Doanh thu − Giá vốn − Chi phí');

    /* 6. Tổng chia không vượt phần được phép phân phối. */
    var tongChia = T.sum(ln.theoCoDong, function (x) { return x.duocChia; });
    bat(tongChia <= ln.deChia, 'Tổng lợi nhuận chia vượt phần được phép phân phối',
        T.money(tongChia) + ' đ > ' + T.money(ln.deChia) + ' đ');
    bat(ln.deChia >= 0 && tongChia >= 0, 'Có khoản chia lợi nhuận âm',
        'Được phép phân phối ' + T.money(ln.deChia) + ' đ');

    /* 7. Tổng tỷ lệ sở hữu. */
    var tt = T.tongTyLe(k.den);
    nhac(Math.abs(tt - 100) < 0.001, 'Tổng tỷ lệ sở hữu không bằng 100%',
        'Hiện là ' + T.num(tt, 2) + '%', 'Mở thẻ Danh sách cổ đông và chỉnh lại tỷ lệ.');

    /* 8. Tổng thực góp bằng tổng giao dịch góp vốn thật. */
    var gopThat = T.sum(T.gdVon(function (g) {
        return g.loai === 'Góp vốn' && String(g.ngay || '') <= k.den;
    }), function (g) { return Number(g.soTien) || 0; });
    bat(q.daGop.cuoiKy === gopThat, 'Tổng thực góp không khớp giao dịch góp vốn',
        T.money(q.daGop.cuoiKy) + ' đ · giao dịch ' + T.money(gopThat) + ' đ');

    /* 9. Còn phải góp không âm. */
    bat(q.conThieu.cuoiKy >= 0, 'Số còn phải góp bị âm',
        T.money(q.conThieu.cuoiKy) + ' đ');

    /* 10. Tổng đã nhận bằng tổng giao dịch chi lợi nhuận thật. */
    var nhanThat = T.sum(T.gdVon(function (g) {
        return g.loai === 'Chia lợi nhuận' && String(g.ngay || '') <= k.den;
    }), function (g) { return Number(g.soTien) || 0; });
    bat(q.daChia.cuoiKy === nhanThat, 'Tổng lợi nhuận đã nhận không khớp giao dịch chi trả',
        T.money(q.daChia.cuoiKy) + ' đ · giao dịch ' + T.money(nhanThat) + ' đ');

    /* 11. Không tính trùng tiền: đẳng thức quỹ quay vòng. */
    var mong = q.tienThucTe.cuoiKy + q.vonTrongHang.cuoiKy + q.tienVay;
    bat(q.quyQuayVong.cuoiKy === mong, 'Đẳng thức quỹ vốn quay vòng sai',
        T.money(q.quyQuayVong.cuoiKy) + ' đ ≠ tiền thực tế ' + T.money(q.tienThucTe.cuoiKy) +
        ' đ + vốn trong hàng ' + T.money(q.vonTrongHang.cuoiKy) + ' đ');
    /* v18.6.0 — đẳng thức tiền thực tế đổi theo đúng hai logic đã duyệt:
       · Logic 2: chỉ CỔ ĐÔNG THỰC GÓP mới là tiền mới chảy vào (tiền bán hàng
         phân bổ vào nghĩa vụ đã nằm trong q.tienThu, cộng nữa là đếm hai lần);
       · Logic 1: trừ thêm tiền đã trả nhà cung cấp qua nghiệp vụ nhập kho. */
    var traNhapKho = T.tienTraNhapKho(k.den, { donViId: (loc || {}).donViId || '' });
    var mongTien = q.coDongNop.cuoiKy - q.daRut.cuoiKy - q.daChia.cuoiKy
                 + q.tienThu.cuoiKy - q.tienChi.cuoiKy - traNhapKho;
    bat(q.tienThucTe.cuoiKy === mongTien, 'Đẳng thức tiền thực tế sai',
        T.money(q.tienThucTe.cuoiKy) + ' đ ≠ ' + T.money(mongTien) + ' đ');

    /* v18.6.0 — Logic 2: ba chỉ tiêu phải cộng lại đúng bằng tổng nghĩa vụ đã
       thực hiện. Lệch nghĩa là có giao dịch góp vốn bị đếm hai lần hoặc rơi
       ra ngoài cả hai nguồn. */
    bat(q.coDongNop.cuoiKy + q.phanBoBanHang.cuoiKy === q.daGop.cuoiKy,
        'Ba chỉ tiêu góp vốn không cộng đúng',
        'Cổ đông thực góp ' + T.money(q.coDongNop.cuoiKy) + ' đ + tiền công ty phân bổ ' +
        T.money(q.phanBoBanHang.cuoiKy) + ' đ ≠ nghĩa vụ đã thực hiện ' +
        T.money(q.daGop.cuoiKy) + ' đ');

    /* 12. Đầu kỳ + trong kỳ = cuối kỳ, cho mọi chỉ tiêu tách ba. */
    [['Nghĩa vụ phải góp', q.nghiaVu], ['Đã thực góp', q.daGop],
     ['Cổ đông đã thực góp', q.coDongNop], ['Tiền công ty đã phân bổ', q.phanBoBanHang],
     ['Đã rút', q.daRut],
     ['Đã chia lợi nhuận', q.daChia], ['Tiền thực tế', q.tienThucTe],
     ['Vốn trong hàng', q.vonTrongHang], ['Quỹ quay vòng', q.quyQuayVong]
    ].forEach(function (x) {
        bat(x[1].dauKy + x[1].trongKy === x[1].cuoiKy,
            'Đầu kỳ cộng trong kỳ không bằng cuối kỳ — ' + x[0],
            T.money(x[1].dauKy) + ' + ' + T.money(x[1].trongKy) + ' ≠ ' + T.money(x[1].cuoiKy));
    });

    /* 13. LIÊN KẾT VÀ DỮ LIỆU GỐC — giữ nguyên các phép kiểm đã có từ trước,
       không được rơi mất khi chuyển sang đối chiếu theo kỳ. */
    DB.all('dotGopVon').forEach(function (d) {
        if (d.trangThai === 'Đã hủy') return;
        var tongPB = T.sum(d.phanBo || [], function (x) { return Number(x.phaiGop) || 0; });
        var can = Math.round(Number(d.giaTriHuyDong) || 0);
        bat(Math.abs(tongPB - can) === 0, 'Phân bổ đợt góp vốn không khớp giá trị cần huy động',
            'Đợt ' + (d.so || '') + ': cần huy động ' + T.money(can) +
            ' đ nhưng tổng phải góp của các cổ đông là ' + T.money(tongPB) + ' đ.',
            'Mở đợt và bấm “Chia lại theo tỷ lệ”.');
    });
    DB.all('giaoDichVon').forEach(function (g) {
        if (g.trangThai === 'Đã hủy') return;
        bat(!!DB.get('coDong', g.coDongId), 'Giao dịch vốn mồ côi — không tìm thấy cổ đông',
            'Giao dịch ' + (g.so || g.id) + ' ngày ' + T.date(g.ngay) + '.',
            'Gắn lại cổ đông cho giao dịch hoặc xóa giao dịch.');
        bat(!g.dotId || !!DB.get('dotGopVon', g.dotId),
            'Giao dịch vốn mồ côi — không tìm thấy đợt góp vốn',
            'Giao dịch ' + (g.so || g.id) + ' ngày ' + T.date(g.ngay) + '.',
            'Gắn lại đợt góp vốn cho giao dịch hoặc xóa giao dịch.');
    });
    DB.all('coDong').forEach(function (cd) {
        /* Ở đây cố ý dùng T.vonDaGop (tổng nghĩa vụ đã thực hiện), không dùng
           T.vonCoDongNop: đây là phép kiểm tra sổ sách, không phải cổng chặn. */
        var gopCD = T.vonDaGop(k.den, cd.id), rutCD = T.vonDaRut(k.den, cd.id);
        bat(rutCD <= gopCD, 'Rút vốn nhiều hơn đã góp',
            'Cổ đông ' + cd.ten + ' đã góp ' + T.money(gopCD) + ' đ nhưng đã rút ' +
            T.money(rutCD) + ' đ.', 'Kiểm tra lại các giao dịch rút vốn của cổ đông này.');
    });
    T.tinhMoiDot(k.den).ds.forEach(function (d) {
        d.theoCoDong.forEach(function (x) {
            nhac(x.daGop <= x.phaiGop, 'Góp nhiều hơn nghĩa vụ của đợt',
                'Đợt ' + (d.dot.so || '') + ' · ' + x.ten + ': phải góp ' + T.money(x.phaiGop) +
                ' đ, đã góp ' + T.money(x.daGop) + ' đ.',
                'Kiểm tra lại giao dịch góp vốn hoặc điều chỉnh giá trị cần huy động.');
        });
    });

    /* Cảnh báo nghiệp vụ — không phải lỗi tính toán. */
    nhac(q.tienThucTe.cuoiKy >= 0, 'Tiền thực tế đang âm',
        'Tiền thực tế cuối kỳ ' + T.money(q.tienThucTe.cuoiKy) + ' đ. ' +
        'Chi ra nhiều hơn số đã thực góp cộng tiền bán hàng thu về.',
        'Ghi nhận đủ các lần cổ đông đã thực góp, hoặc kiểm tra lại Phiếu thu · Phiếu chi.');

    return { dat: !loi.length, loi: loi, canhBao: canhBao, quy: q, ln: ln, ky: k };
};

/* ==========================================================================
   TỔNG HỢP KẾT QUẢ KINH DOANH THEO THÁNG / THEO NĂM        (thêm ở v14.0.0)
   --------------------------------------------------------------------------
   KHÔNG CÓ MỘT PHÉP TÍNH RIÊNG NÀO Ở ĐÂY.

   Bảng và biểu đồ theo tháng / theo năm được dựng bằng cách gọi ĐÚNG MỘT LẦN
   T.ketQuaKinhDoanh cho cả kỳ — chính con số mà KPI đang hiển thị — rồi rải
   từng chứng từ mà Engine ĐÃ CHỌN vào ô tháng hoặc ô năm theo ngày của nó.

   Vì sao phải làm như vậy thay vì gọi Engine riêng cho từng tháng:
     · Chuỗi chứng từ bán hàng có BẬC (Đơn bán thắng Hợp đồng thắng Phiếu xuất).
       Gọi riêng từng tháng thì một giao dịch có đơn bán tháng 3 và hợp đồng
       tháng 5 sẽ được tính ở CẢ HAI tháng — cộng mười hai tháng lại là đếm hai
       lần. Giải bậc một lần cho cả kỳ rồi mới rải mới đúng.
     · Tầng doanh thu nội bộ của công ty nguồn không nằm trong chứng từ của
       chính nó. Bỏ tầng này ra là tổng các tháng thiếu đúng phần nội bộ.

   Hệ quả: TỔNG CÁC Ô LUÔN BẰNG ĐÚNG KPI, không phải nhờ khớp may mà nhờ cùng
   một tập chứng từ.
   ========================================================================== */

/** Các năm CÓ DỮ LIỆU — lấy động từ chứng từ, không khai cứng năm nào. */
T.cacNamCoDuLieu = function (loc) {
    var co = {}, dv = loc && loc.donViId;
    function quet(c) {
        DB.all(c).forEach(function (r) {
            if (dv && r.donVi && r.donVi !== dv) return;
            var n = String(r.ngay || '').substr(0, 4);
            if (/^\d{4}$/.test(n)) co[n] = 1;
        });
    }
    ['donBan', 'hopDong', 'phieuXuat', 'phuLuc', 'phieuChi', 'phieuThu',
     'phieuNhap', 'baoGia'].forEach(quet);
    return Object.keys(co).sort();
};

/**
 * KẾT QUẢ KINH DOANH TÁCH THEO THÁNG HOẶC THEO NĂM.
 *
 * loc   — bộ lọc chuẩn của Engine (tuNgay · denNgay · donViId · …)
 * buoc  — 'thang' hoặc 'nam'
 * khung — (tùy chọn) danh sách khóa ô phải hiện đủ, kể cả ô không có số liệu.
 *         Ví dụ đủ 12 tháng của một năm: ['2026-01', … , '2026-12'].
 *
 * Trả về { ds, tong } — ds là các ô theo thứ tự thời gian, tong là tổng cộng
 * và LUÔN bằng đúng T.ketQuaKinhDoanh(loc).
 */
T.ketQuaTheoKy = function (loc, buoc, khung) {
    loc = loc || {};
    buoc = buoc === 'nam' ? 'nam' : 'thang';
    var kq = T.ketQuaKinhDoanh(loc);          /* MỘT LẦN GỌI DUY NHẤT */
    var cat = buoc === 'nam' ? 4 : 7;         /* 'YYYY' hoặc 'YYYY-MM' */
    var o = {}, thuTu = [];

    function o1(k) {
        if (!o[k]) {
            o[k] = { khoa: k, nhan: buoc === 'nam' ? ('Năm ' + k)
                        : ('Tháng ' + k.substr(5, 2) + '/' + k.substr(0, 4)),
                     doanhThu: 0, giaVon: 0, chiPhi: 0, loiNhuan: 0,
                     bienLoiNhuan: 0, soChungTu: 0 };
            thuTu.push(k);
        }
        return o[k];
    }
    (khung || []).forEach(o1);

    function rai(ds) {
        (ds || []).forEach(function (x) {
            var k = String((x.r && x.r.ngay) || '').substr(0, cat);
            if (!k) return;
            var c = o1(k);
            c.doanhThu += x.doanhThu; c.giaVon += x.giaVon; c.soChungTu++;
        });
    }
    rai(kq.chiTiet);
    rai(kq.chiTietNoiBo);                     /* tầng nội bộ của công ty nguồn */
    ((kq.chiPhiChiTiet || {}).ds || []).forEach(function (p) {
        var k = String(p.ngay || '').substr(0, cat);
        if (!k) return;
        o1(k).chiPhi += Number(p.soTien) || 0;
    });

    thuTu.sort();
    var ds = thuTu.map(function (k) {
        var c = o[k];
        c.loiNhuan = c.doanhThu - c.giaVon - c.chiPhi;
        c.bienLoiNhuan = c.doanhThu ? Math.round(c.loiNhuan / c.doanhThu * 1000) / 10 : 0;
        return c;
    });
    return {
        ds: ds, buoc: buoc, kq: kq,
        tong: {
            nhan: 'TỔNG CỘNG',
            doanhThu: kq.doanhThu, giaVon: kq.giaVon, chiPhi: kq.chiPhi,
            loiNhuan: kq.loiNhuan, bienLoiNhuan: kq.bienLoiNhuan,
            soChungTu: kq.soChungTu
        }
    };
};

/** Khung đủ 12 tháng của một năm — ô không có số liệu vẫn hiện với giá trị 0. */
T.khungThangCuaNam = function (nam, denThang) {
    var ra = [], n = Math.max(1, Math.min(12, Number(denThang) || 12));
    for (var i = 1; i <= n; i++) ra.push(nam + '-' + ('0' + i).slice(-2));
    return ra;
};

/**
 * Giữ nguyên tên hàm cũ để mọi nơi đang gọi không phải sửa, nhưng số liệu nay
 * lấy từ T.ketQuaTheoKy. Bản trước tự cộng chứng từ và BỎ SÓT tầng doanh thu
 * nội bộ, nên tổng các tháng lệch với KPI đúng bằng phần nội bộ.
 */
T.doanhThuTheoThang = function (loc, soThang) {
    var n = soThang || 12;
    var den = (loc && loc.denNgay) || T.today();
    var d = new Date(den + 'T00:00:00');
    var khung = [];
    for (var i = n - 1; i >= 0; i--) {
        var x = new Date(d.getFullYear(), d.getMonth() - i, 1);
        khung.push(x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2));
    }
    var kq = T.ketQuaTheoKy(loc, 'thang', khung);
    var giu = {};
    khung.forEach(function (k) { giu[k] = 1; });
    return kq.ds.filter(function (c) { return giu[c.khoa]; }).map(function (c) {
        return { thang: c.khoa,
                 nhan: c.khoa.substr(5, 2) + '/' + c.khoa.substr(0, 4),
                 doanhThu: c.doanhThu, giaVon: c.giaVon, chiPhi: c.chiPhi,
                 loiNhuan: c.loiNhuan, bienLoiNhuan: c.bienLoiNhuan };
    });
};

/* ==========================================================================
   LỚP DÙNG CHUNG CỦA TOÀN HỆ THỐNG — KỲ BÁO CÁO · CÔNG NỢ · DÒNG TIỀN
   --------------------------------------------------------------------------
   Đây là nơi DUY NHẤT định nghĩa một "kỳ báo cáo" là gì, một khoản "phải thu"
   là gì, "tiền vào - tiền ra" của một kỳ là gì. Trang chủ, Báo cáo tổng hợp,
   phân hệ Góp vốn và Trợ lý quản trị đều gọi đúng những hàm dưới đây, nên bốn
   nơi không bao giờ ra bốn con số khác nhau cho cùng một câu hỏi.

   Toàn bộ hàm ở khối này là THUẦN ĐỌC: không ghi, không sửa, không tạo dữ
   liệu. Mọi con số đều dựng lại từ chứng từ gốc tại thời điểm gọi.
   ========================================================================== */

/* ------------------------------------------------------------- KỲ BÁO CÁO */

/** Các kỳ chọn sẵn — dùng chung cho Trang chủ và Báo cáo tổng hợp. */
T.KY_CHON_SAN = [
    { k: 'thang',      t: 'Tháng này' },
    { k: 'thangTruoc', t: 'Tháng trước' },
    { k: 'quy',        t: 'Quý này' },
    { k: 'quyTruoc',   t: 'Quý trước' },
    { k: 'nam',        t: 'Năm nay' },
    { k: 'namTruoc',   t: 'Năm trước' },
    { k: 'thang12',    t: '12 tháng gần nhất' },
    { k: 'tatCa',      t: 'Toàn bộ' }
];

function _ngay(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) +
           '-' + ('0' + d.getDate()).slice(-2);
}

/**
 * GIẢI MỘT MÃ KỲ THÀNH KHOẢNG THỜI GIAN CỤ THỂ.
 *   'thang' · 'thangTruoc' · 'quy' · 'quyTruoc' · 'nam' · 'namTruoc'
 *   'thang12' · 'tatCa' · 'nam:YYYY' · 'tuyChon' (kèm {tuNgay, denNgay})
 * Trả về { k, tuNgay, denNgay, nhan, buoc } — buoc là 'thang' hoặc 'nam',
 * quyết định bảng lịch sử gom theo tháng hay theo năm.
 */
T.kyChon = function (k, tuyChon) {
    k = String(k || 'nam');
    var hn = T.today(), n = new Date(hn + 'T00:00:00');
    var y = n.getFullYear(), m = n.getMonth(), r;
    var mn = /^nam:(\d{4})$/.exec(k);
    if (mn) {
        r = { tuNgay: mn[1] + '-01-01', denNgay: mn[1] + '-12-31',
              nhan: 'Năm ' + mn[1], buoc: 'thang' };
    } else if (k === 'tuyChon') {
        var a = String((tuyChon && tuyChon.tuNgay) || '');
        var b = String((tuyChon && tuyChon.denNgay) || '') || hn;
        var soThang = a ? (Number(b.substr(0, 4)) * 12 + Number(b.substr(5, 2)) -
                           Number(a.substr(0, 4)) * 12 - Number(a.substr(5, 2)) + 1) : 999;
        r = { tuNgay: a, denNgay: b, buoc: soThang > 24 ? 'nam' : 'thang',
              nhan: a ? (T.date(a) + ' → ' + T.date(b)) : ('đến ' + T.date(b)) };
    } else if (k === 'thang') {
        r = { tuNgay: _ngay(new Date(y, m, 1)), denNgay: hn,
              nhan: 'tháng ' + ('0' + (m + 1)).slice(-2) + '/' + y, buoc: 'thang' };
    } else if (k === 'thangTruoc') {
        r = { tuNgay: _ngay(new Date(y, m - 1, 1)), denNgay: _ngay(new Date(y, m, 0)),
              nhan: 'tháng trước', buoc: 'thang' };
    } else if (k === 'quy') {
        r = { tuNgay: _ngay(new Date(y, Math.floor(m / 3) * 3, 1)), denNgay: hn,
              nhan: 'quý ' + (Math.floor(m / 3) + 1) + '/' + y, buoc: 'thang' };
    } else if (k === 'quyTruoc') {
        var q0 = Math.floor(m / 3) * 3 - 3;
        r = { tuNgay: _ngay(new Date(y, q0, 1)), denNgay: _ngay(new Date(y, q0 + 3, 0)),
              nhan: 'quý trước', buoc: 'thang' };
    } else if (k === 'nam') {
        r = { tuNgay: y + '-01-01', denNgay: hn, nhan: 'năm ' + y, buoc: 'thang' };
    } else if (k === 'namTruoc') {
        r = { tuNgay: (y - 1) + '-01-01', denNgay: (y - 1) + '-12-31',
              nhan: 'năm ' + (y - 1), buoc: 'thang' };
    } else if (k === 'thang12') {
        r = { tuNgay: _ngay(new Date(y, m - 11, 1)), denNgay: hn,
              nhan: '12 tháng gần nhất', buoc: 'thang' };
    } else {
        r = { tuNgay: '', denNgay: '', nhan: 'toàn bộ', buoc: 'nam' };
    }
    r.k = k;
    return r;
};

/**
 * KHUNG Ô CỦA MỘT KỲ — danh sách khóa năm hoặc khóa tháng phải hiện đủ, kể cả
 * ô chưa có số liệu (hiện 0). Suy ra từ chính khoảng thời gian nên bảng, biểu
 * đồ và chỉ tiêu không bao giờ lệch kỳ nhau.
 */
T.khungKy = function (ky, loc) {
    if (!ky) return [];
    if (ky.buoc === 'nam') {
        var ns = T.cacNamCoDuLieu(loc);
        if (!ky.tuNgay && !ky.denNgay) return ns;
        return ns.filter(function (y) {
            return (!ky.tuNgay || y >= ky.tuNgay.substr(0, 4)) &&
                   (!ky.denNgay || y <= ky.denNgay.substr(0, 4));
        });
    }
    if (!ky.tuNgay || !ky.denNgay) return [];
    var ra = [], d = new Date(ky.tuNgay.substr(0, 7) + '-01T00:00:00');
    var h = new Date(ky.denNgay.substr(0, 7) + '-01T00:00:00');
    var an = 0;
    while (d <= h && an++ < 600) {
        ra.push(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2));
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return ra;
};

/** Kỳ liền trước, cùng độ dài — dùng để so sánh tăng/giảm. Không có mốc đầu thì không so. */
T.kyLienTruoc = function (ky) {
    if (!ky || !ky.tuNgay || !ky.denNgay) return null;
    var so = T.soNgay(ky.tuNgay, ky.denNgay) + 1;
    var den = T.addDays(ky.tuNgay, -1);
    return { k: 'tuyChon', tuNgay: T.addDays(den, -(so - 1)), denNgay: den,
             buoc: ky.buoc, nhan: 'kỳ liền trước' };
};

/* --------------------------------------------------- HẠN THANH TOÁN · CÔNG NỢ */

/**
 * SỐ NGÀY ĐƯỢC NỢ của một chứng từ — lấy từ Điều khoản thanh toán đã khai
 * trên chính chứng từ, thiếu thì lấy của đối tượng. KHÔNG ghi cứng con số nào.
 */
T.dieuKhoanCua = function (r, dt) {
    if (r && r.dieuKhoanTTId) {
        var a = DB.get('dieuKhoanTT', r.dieuKhoanTTId);
        if (a) return a;
    }
    if (dt && dt.dieuKhoanTTId) {
        var b = DB.get('dieuKhoanTT', dt.dieuKhoanTTId);
        if (b) return b;
    }
    return null;
};
T.soNgayNo = function (r, dt) {
    var dk = T.dieuKhoanCua(r, dt);
    return dk ? (Number(dk.soNgay) || 0) : 0;
};

/**
 * Hạn thanh toán = ngày giao (hoặc ngày chứng từ) + số ngày được nợ.
 * CHƯA KHAI ĐIỀU KHOẢN THANH TOÁN THÌ TRẢ VỀ RỖNG, KHÔNG TỰ SUY LÀ "ĐẾN HẠN
 * NGAY". Coi mọi chứng từ chưa khai điều khoản là quá hạn sẽ tạo ra một con số
 * quá hạn khổng lồ nhưng vô nghĩa. Phần chưa khai được báo riêng để người dùng
 * bổ sung điều khoản, không bị trộn vào nợ quá hạn.
 */
T.hanThanhToan = function (r, dt) {
    var g = String((r && (r.ngayGiao || r.ngay)) || '').substr(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) return '';
    if (!T.dieuKhoanCua(r, dt)) return '';
    return T.addDays(g, T.soNgayNo(r, dt));
};

/**
 * PHÂN BỔ TIỀN ĐÃ THANH TOÁN CHO TỪNG CHỨNG TỪ, chứng từ cũ trước.
 * Không có bảng đối chiếu từng phiếu - từng đơn trong dữ liệu, nên phần còn nợ
 * được xác định theo nguyên tắc trả dần từ chứng từ sớm nhất. Đây là cách suy
 * luận, không phải dữ liệu bịa: tổng còn nợ luôn đúng bằng phát sinh trừ đã
 * thanh toán, chỉ có việc CHIA phần còn nợ về từng chứng từ là suy ra.
 */
function raiThanhToan(ct, tien) {
    var con = Number(tien) || 0;
    return ct.slice().sort(function (a, b) {
        return String(a.ngay || '') < String(b.ngay || '') ? -1 : 1;
    }).map(function (x) {
        var pt = Number(x.soTien) || 0;
        var tra = Math.min(con, pt);
        con -= tra;
        return { r: x.r, ngay: x.ngay, han: x.han, soTien: pt,
                 daTra: tra, conLai: pt - tra };
    });
}

/**
 * Tách phần còn nợ thành ba nhóm: ĐÃ QUÁ HẠN · CÒN TRONG HẠN · CHƯA KHAI HẠN.
 * Nhóm thứ ba không phải là nợ tốt cũng không phải nợ xấu — nó là dữ liệu còn
 * thiếu điều khoản thanh toán, và được báo riêng để người dùng bổ sung.
 */
function tinhQuaHan(ds, moc) {
    var quaHan = 0, trongHan = 0, chuaKhai = 0, hanSom = '';
    ds.forEach(function (x) {
        if (x.conLai <= 0) return;
        if (!x.han) { chuaKhai += x.conLai; return; }
        if (x.han < moc) {
            quaHan += x.conLai;
            if (!hanSom || x.han < hanSom) hanSom = x.han;
        } else trongHan += x.conLai;
    });
    return { quaHan: quaHan, trongHan: trongHan, chuaKhaiHan: chuaKhai, hanSom: hanSom,
             soNgayQuaHan: hanSom ? T.soNgay(hanSom, moc) : 0 };
}

/** Công nợ phải thu của MỘT khách hàng, chốt tại một ngày nếu có loc.denNgay. */
T.congNoKH = function (khId, loc) {
    var den = (loc && loc.denNgay) || '', dv = (loc && loc.donViId) || '';
    var daId = (loc && loc.duAnId) || '';
    var kh = DB.get('khachHang', khId) || null;
    var db = DB.where('donBan', function (d) {
        return d.khachHangId === khId && d.trangThai !== 'Nháp' && d.trangThai !== 'Đã hủy' &&
               (!den || String(d.ngay || '') <= den) && (!dv || d.donVi === dv) &&
               (!daId || d.duAnId === daId);
    });
    var pt = DB.where('phieuThu', function (p) {
        return p.khachHangId === khId && p.trangThai === 'Đã ghi sổ' &&
               (!den || String(p.ngay || '') <= den) && (!dv || p.donVi === dv) &&
               (!daId || p.duAnId === daId);
    });
    var ps = T.sum(db, function (d) { return Number(d.tongCong) || 0; });
    var tt = T.sum(pt, function (p) { return Number(p.soTien) || 0; });
    var moc = den || T.today();
    var ds = raiThanhToan(db.map(function (d) {
        return { r: d, ngay: d.ngay, han: T.hanThanhToan(d, kh), soTien: d.tongCong };
    }), tt);
    var h = tinhQuaHan(ds, moc);
    return { phatSinh: ps, daThu: tt, conLai: ps - tt, soDon: db.length, soPhieu: pt.length,
             quaHan: h.quaHan, trongHan: h.trongHan, chuaKhaiHan: h.chuaKhaiHan,
             hanSomNhat: h.hanSom, soNgayQuaHan: h.soNgayQuaHan,
             traTruoc: Math.max(0, tt - ps), chiTiet: ds };
};

/** Công nợ phải trả của MỘT nhà cung cấp, chốt tại một ngày nếu có loc.denNgay. */
T.congNoNCC = function (nccId, loc) {
    var den = (loc && loc.denNgay) || '', dv = (loc && loc.donViId) || '';
    var daId2 = (loc && loc.duAnId) || '';
    var ncc = DB.get('nhaCungCap', nccId) || null;
    var dm = DB.where('donMua', function (d) {
        return d.nhaCungCapId === nccId && T.donMuaPhatSinhCongNo(d) &&
               (!den || String(d.ngay || '') <= den) && (!dv || !d.donVi || d.donVi === dv) &&
               (!daId2 || d.duAnId === daId2);
    });
    /* CHỈ phiếu chi TRẢ TIỀN HÀNG mới làm giảm công nợ phải trả. */
    var pc = DB.where('phieuChi', function (p) {
        return p.nhaCungCapId === nccId && p.trangThai === 'Đã ghi sổ' && T.chiGiamCongNo(p) &&
               (!den || String(p.ngay || '') <= den) && (!dv || p.donVi === dv) &&
               (!daId2 || p.duAnId === daId2);
    });
    var ps = T.sum(dm, function (d) { return Number(d.tongCong) || 0; });
    /* v18.6.0 — HÀNG ĐÃ NHẬP KHO LÀ ĐÃ TRẢ TIỀN. Khoản trả qua nghiệp vụ nhập
       kho cũng làm giảm công nợ phải trả, đúng bằng giá trị phiếu nhập. Chỉ
       tính phiếu nhập mang dấu thanh toán nên không đụng tới dữ liệu cũ. */
    var traNK = T.tienTraNhapKho(den, { nhaCungCapId: nccId, donViId: dv });
    var tt = T.sum(pc, function (p) { return Number(p.soTien) || 0; }) + traNK;
    var moc = den || T.today();
    var ds = raiThanhToan(dm.map(function (d) {
        return { r: d, ngay: d.ngay, han: T.hanThanhToan(d, ncc), soTien: d.tongCong };
    }), tt);
    var h = tinhQuaHan(ds, moc);
    return { phatSinh: ps, daTra: tt, traQuaNhapKho: traNK,
             conLai: ps - tt, soDon: dm.length, soPhieu: pc.length,
             quaHan: h.quaHan, trongHan: h.trongHan, chuaKhaiHan: h.chuaKhaiHan,
             hanSomNhat: h.hanSom, soNgayQuaHan: h.soNgayQuaHan,
             traTruoc: Math.max(0, tt - ps), chiTiet: ds };
};

/** TỔNG HỢP CÔNG NỢ PHẢI THU toàn bộ khách hàng, chốt tại ngày cuối kỳ. */
T.congNoPhaiThu = function (loc) {
    var ds = [];
    DB.all('khachHang').forEach(function (c) {
        var n = T.congNoKH(c.id, loc);
        if (!n.phatSinh && !n.daThu) return;
        ds.push({ id: c.id, ma: c.ma, ten: c.ten, loai: c.loai || '',
                  hanMucNo: Number(c.hanMucNo) || 0,
                  phatSinh: n.phatSinh, daThu: n.daThu, conLai: n.conLai,
                  quaHan: n.quaHan, trongHan: n.trongHan, chuaKhaiHan: n.chuaKhaiHan,
                  traTruoc: n.traTruoc,
                  soNgayQuaHan: n.soNgayQuaHan, hanSomNhat: n.hanSomNhat,
                  soDon: n.soDon, soPhieu: n.soPhieu,
                  vuotHanMuc: (Number(c.hanMucNo) || 0) > 0 && n.conLai > (Number(c.hanMucNo) || 0) });
    });
    ds.sort(function (a, b) { return b.conLai - a.conLai; });
    function c1(k) { return T.sum(ds, function (x) { return x[k]; }); }
    return { ds: ds, phatSinh: c1('phatSinh'), daThu: c1('daThu'),
             conLai: c1('conLai'), quaHan: c1('quaHan'), trongHan: c1('trongHan'),
             chuaKhaiHan: c1('chuaKhaiHan'), khachTraTruoc: c1('traTruoc'),
             conPhaiThu: T.sum(ds, function (x) { return Math.max(0, x.conLai); }),
             soDoiTuong: ds.filter(function (x) { return x.conLai > 0; }).length,
             soQuaHan: ds.filter(function (x) { return x.quaHan > 0; }).length };
};

/** TỔNG HỢP CÔNG NỢ PHẢI TRẢ toàn bộ nhà cung cấp, chốt tại ngày cuối kỳ. */
T.congNoPhaiTra = function (loc) {
    var ds = [];
    DB.all('nhaCungCap').forEach(function (c) {
        var n = T.congNoNCC(c.id, loc);
        if (!n.phatSinh && !n.daTra) return;
        ds.push({ id: c.id, ma: c.ma, ten: c.ten,
                  phatSinh: n.phatSinh, daTra: n.daTra, conLai: n.conLai,
                  quaHan: n.quaHan, trongHan: n.trongHan, chuaKhaiHan: n.chuaKhaiHan,
                  traTruoc: n.traTruoc,
                  soNgayQuaHan: n.soNgayQuaHan, hanSomNhat: n.hanSomNhat,
                  soDon: n.soDon, soPhieu: n.soPhieu });
    });
    ds.sort(function (a, b) { return b.conLai - a.conLai; });
    function c2(k) { return T.sum(ds, function (x) { return x[k]; }); }
    /* Trả cho nhà cung cấp NHIỀU HƠN phần hàng đã về kho không phải là "công nợ
       âm" — đó là TIỀN ỨNG TRƯỚC. Tách riêng để không có con số âm vô nghĩa. */
    return { ds: ds, phatSinh: c2('phatSinh'), daTra: c2('daTra'),
             conLai: c2('conLai'), quaHan: c2('quaHan'), trongHan: c2('trongHan'),
             chuaKhaiHan: c2('chuaKhaiHan'), ungTruoc: c2('traTruoc'),
             conPhaiTra: T.sum(ds, function (x) { return Math.max(0, x.conLai); }),
             soDoiTuong: ds.filter(function (x) { return x.conLai > 0; }).length,
             soQuaHan: ds.filter(function (x) { return x.quaHan > 0; }).length };
};

/* --------------------------------------------------------------- DÒNG TIỀN */

/**
 * DÒNG TIỀN THỰC TẾ CỦA MỘT KỲ: tồn đầu kỳ · tiền vào · tiền ra · tồn cuối kỳ.
 * Chỉ đếm TIỀN THẬT (phiếu thu, phiếu chi đã ghi sổ và giao dịch vốn) — không
 * lẫn doanh thu ghi nhận, không lẫn công nợ. Tiền vào gồm cả tiền cổ đông góp;
 * tiền ra gồm cả tiền rút vốn và lợi nhuận đã chi trả, đúng như tiền thực tế.
 */
T.dongTienKy = function (loc) {
    var k = T.kyBaoCao(loc);
    var dv = (loc || {}).donViId || '';
    var dvVon = (T.donViVon() || {}).id || '';
    /* Quỹ vốn cổ đông là quỹ của ĐƠN VỊ VỐN. Xem dòng tiền của cả nhóm hoặc của
       chính đơn vị vốn thì có phần góp/rút/chia; xem của một công ty phát hành
       khác thì chỉ có tiền thu - tiền chi của công ty đó. */
    var coVon = !dv || dv === dvVon;
    var daId = (loc || {}).duAnId || '';
    function ds(coll, tu, den) {
        return DB.all(coll).filter(function (p) {
            return p.trangThai === 'Đã ghi sổ' &&
                   (!tu || String(p.ngay || '') >= tu) && (!den || String(p.ngay || '') <= den) &&
                   (!dv || p.donVi === dv) && (!daId || p.duAnId === daId);
        });
    }
    function von(den) {
        if (!coVon) return 0;
        /* v18.6.0 — Logic 2. BÁO CÁO DÒNG TIỀN CHỈ ĐẾM TIỀN THẬT CHẢY VÀO.
           Tiền bán hàng của công ty được phân bổ vào nghĩa vụ góp vốn đã nằm
           trong phiếu thu rồi; cộng nó thêm một lần ở đây là tạo ra một dòng
           tiền không có thật. Vì vậy dùng T.vonCoDongNop, không dùng T.vonDaGop. */
        return T.vonCoDongNop(den) - T.vonDaRut(den) - T.loiNhuanDaChia(den);
    }
    /* v18.6.0 — Logic 1. Tiền trả nhà cung cấp qua nghiệp vụ nhập kho cũng là
       tiền thật đi ra, phải nằm trong dòng tiền; nếu không thì "tiền cuối kỳ"
       của báo cáo này và T.tienThucTe sẽ lệch nhau đúng bằng khoản đó. */
    function traNK(den) {
        if (!den) return 0;
        return T.tienTraNhapKho(den, { donViId: dv });
    }
    /* Số dư được dựng từ CHÍNH những dòng tiền đang hiển thị, nên đầu kỳ cộng
       phát sinh luôn bằng cuối kỳ — đúng theo cấu tạo, không phải trùng hợp. */
    function luyKe(den) {
        if (!den) return 0;
        return T.tienDaThu(den, loc) - T.tienDaChi(den, loc) - traNK(den) + von(den);
    }
    var dsThu = ds('phieuThu', k.tu, k.den), dsChi = ds('phieuChi', k.tu, k.den);
    var thu = T.sum(dsThu, function (p) { return Number(p.soTien) || 0; });
    var chi = T.sum(dsChi, function (p) { return Number(p.soTien) || 0; });
    var truoc = k.coDauKy ? k.truoc : '';
    var gop = coVon ? T.vonCoDongNop(k.den) - (truoc ? T.vonCoDongNop(truoc) : 0) : 0;
    var pbBH = coVon ? T.vonPhanBoBanHang(k.den) - (truoc ? T.vonPhanBoBanHang(truoc) : 0) : 0;
    var rut = coVon ? T.vonDaRut(k.den) - (truoc ? T.vonDaRut(truoc) : 0) : 0;
    var chia = coVon ? T.loiNhuanDaChia(k.den) - (truoc ? T.loiNhuanDaChia(truoc) : 0) : 0;
    var chiNK = traNK(k.den) - (truoc ? traNK(truoc) : 0);
    var dauKy = truoc ? luyKe(truoc) : 0;
    return { ky: k, coVon: coVon, dauKy: dauKy, cuoiKy: luyKe(k.den),
             thu: thu, chi: chi, chiNhapKho: chiNK, thuanKinhDoanh: thu - chi - chiNK,
             gopVon: gop, phanBoBanHang: pbBH, rutVon: rut, chiaLoiNhuan: chia,
             thuan: (thu - chi - chiNK) + gop - rut - chia,
             soPhieuThu: dsThu.length, soPhieuChi: dsChi.length,
             dsThu: dsThu, dsChi: dsChi };
};

/* ---------------------------------------------- TỔNG HỢP MỘT KỲ — MỘT NGUỒN */

/**
 * ẢNH CHỤP TOÀN CẢNH CỦA MỘT KỲ — dùng chung cho Trang chủ, Báo cáo tổng hợp
 * và Trợ lý quản trị. Gọi hàm này thay vì tự ghép các mảnh lại, vì mỗi nơi tự
 * ghép là mỗi nơi có cơ hội ghép sai.
 */
T.tongHopKy = function (loc) {
    loc = loc || {};
    var kq = T.ketQuaKinhDoanh(loc);
    var k = T.kyBaoCao(loc);
    var pThu = T.congNoPhaiThu(loc), pTra = T.congNoPhaiTra(loc);
    var ton = T.tonKhoTaiNgay(k.den);
    var dt = T.dongTienKy(loc);
    return {
        ky: k, loc: loc, kq: kq,
        doanhThu: kq.doanhThu, giaVon: kq.giaVon, chiPhi: kq.chiPhi,
        loiNhuanGop: kq.loiNhuanGop, loiNhuan: kq.loiNhuan,
        bienLoiNhuan: kq.bienLoiNhuan, bienLoiNhuanGop: kq.bienLoiNhuanGop,
        tonKho: ton, giaTriTonKho: ton.giaTri,
        phaiThu: pThu, phaiTra: pTra, dongTien: dt
    };
};

/* ==========================================================================
   LỚP PHÂN TÍCH QUẢN TRỊ — NGUỒN DỮ LIỆU CỦA TRỢ LÝ
   --------------------------------------------------------------------------
   Trợ lý quản trị KHÔNG tự đọc bảng dữ liệu và KHÔNG tự cộng lại con số nào.
   Mọi phân tích, so sánh và cảnh báo đều dựng từ các hàm dưới đây, mà bản thân
   chúng lại chỉ gọi Business Engine. Nhờ vậy câu trả lời của trợ lý luôn khớp
   tuyệt đối với Trang chủ và Báo cáo — không thể có chuyện "trợ lý nói một
   đằng, báo cáo nói một nẻo".

   TOÀN BỘ KHỐI NÀY LÀ THUẦN ĐỌC. Trợ lý không có đường nào để sửa hay xóa dữ
   liệu nghiệp vụ.
   ========================================================================== */

/* --------------------------------------------------------------- DẤU VẾT */

/**
 * DẤU VẾT CỦA MỘT BẢN GHI — ai tạo, lúc nào, ai sửa lần cuối, lúc nào.
 * Các trường này do chính DB.insert / DB.update ghi tự động cho MỌI bảng, nên
 * không có bản ghi nào nằm ngoài vòng theo dõi. Hàm chỉ ĐỌC lại, không ghi.
 */
T.dauVet = function (r) {
    r = r || {};
    return {
        nguoiTao: r._nguoiTao || r.nguoiLap || '',
        lucTao: r._tao || '',
        nguoiSua: r._nguoiSua || '',
        lucSua: r._sua || '',
        daSua: !!r._sua,
        trangThai: r.trangThai || '',
        nguoiLap: r.nguoiLap || '',
        ngay: r.ngay || ''
    };
};

/**
 * SỔ DẤU VẾT của một hoặc nhiều bảng trong một kỳ — mỗi dòng là một bản ghi
 * kèm đầy đủ nguồn gốc. Đây là chỗ trả lời câu "con số này ở đâu ra".
 */
T.soDauVet = function (cacBang, loc) {
    loc = loc || {};
    var ra = [];
    (cacBang || []).forEach(function (c) {
        DB.all(c).forEach(function (r) {
            var n = String(r.ngay || r._tao || '').substr(0, 10);
            if (loc.tuNgay && n && n < loc.tuNgay) return;
            if (loc.denNgay && n && n > loc.denNgay) return;
            if (loc.donViId && r.donVi && r.donVi !== loc.donViId) return;
            var d = T.dauVet(r);
            ra.push({ bang: T.tenBang(c), coll: c, id: r.id,
                      so: r.so || r.ma || r.id, ngay: r.ngay || '',
                      noiDung: r.ten || r.khachHang || r.nhaCungCap || r.lyDo || r.noiDung || '',
                      duAn: r.duAn || '', donVi: r.donVi || '',
                      soTien: Number(r.tongCong || r.soTien || 0) || 0,
                      trangThai: d.trangThai, nguoiLap: d.nguoiLap,
                      nguoiTao: d.nguoiTao, lucTao: d.lucTao,
                      nguoiSua: d.nguoiSua, lucSua: d.lucSua,
                      daSua: d.daSua ? 'Đã sửa' : '' });
        });
    });
    ra.sort(function (a, b) {
        var x = a.lucTao || a.ngay, y = b.lucTao || b.ngay;
        return x < y ? 1 : -1;
    });
    return ra;
};

/** Mức tăng/giảm giữa hai con số, kèm nhãn đọc được. */
T.soSanh = function (nay, truoc) {
    var lech = (Number(nay) || 0) - (Number(truoc) || 0);
    var pct = truoc ? Math.round(lech / Math.abs(truoc) * 1000) / 10 : null;
    return { nay: Number(nay) || 0, truoc: Number(truoc) || 0, lech: lech, pct: pct,
             tang: lech > 0, giam: lech < 0 };
};

/**
 * BỘ SỐ PHÂN TÍCH CỦA MỘT KỲ — ảnh chụp kỳ này, kỳ liền trước, và các bảng xếp
 * hạng cần cho việc tư vấn. Một lần gọi dùng cho cả màn hình trợ lý.
 */
T.phanTichKy = function (loc) {
    loc = loc || {};
    var th = T.tongHopKy(loc);
    var ky = { tuNgay: loc.tuNgay || '', denNgay: loc.denNgay || '', buoc: 'thang' };
    var truoc = T.kyLienTruoc(ky);
    var locTruoc = null, thTruoc = null;
    if (truoc) {
        locTruoc = T.locLuyKe(loc, truoc.denNgay);
        locTruoc.tuNgay = truoc.tuNgay;
        thTruoc = T.tongHopKy(locTruoc);
    }
    var locNhom = {};
    Object.keys(loc).forEach(function (k) { if (k !== 'donViId') locNhom[k] = loc[k]; });
    return {
        loc: loc, th: th, thTruoc: thTruoc, kyTruoc: truoc,
        soSanh: thTruoc ? {
            doanhThu: T.soSanh(th.doanhThu, thTruoc.doanhThu),
            giaVon: T.soSanh(th.giaVon, thTruoc.giaVon),
            chiPhi: T.soSanh(th.chiPhi, thTruoc.chiPhi),
            loiNhuan: T.soSanh(th.loiNhuan, thTruoc.loiNhuan),
            bienLoiNhuan: T.soSanh(th.bienLoiNhuan, thTruoc.bienLoiNhuan),
            phaiThu: T.soSanh(th.phaiThu.conPhaiThu, thTruoc.phaiThu.conPhaiThu),
            tonKho: T.soSanh(th.giaTriTonKho, thTruoc.giaTriTonKho)
        } : null,
        theoCty: T.ketQuaTungDonVi(locNhom),
        theoDuAn: T.ketQuaTungDuAn(locNhom),
        theoMatHang: T.loiNhuanTheoMatHang(loc),
        theoKhach: T.loiNhuanTheoKhach(loc),
        theoKy: T.ketQuaTheoKy(loc, 'thang', T.khungKy(T.kyChon('tuyChon', ky), loc)),
        khoanMuc: (th.kq.chiPhiChiTiet || {}).theoKhoanMuc || []
    };
};

/** Hàng tồn lâu: lần xuất gần nhất cách ngày chốt bao nhiêu ngày. */
T.tonLau = function (den) {
    den = den || T.today();
    var t = T.tonKhoTaiNgay(den), cuoi = {};
    T.theKho().forEach(function (x) {
        if (String(x.ngay || '') > den) return;
        if (x.loai !== 'xuat' && x.sl >= 0) return;
        var id = x.hangHoaId || T.idHH(x.maHang);
        if (!cuoi[id] || x.ngay > cuoi[id]) cuoi[id] = x.ngay;
    });
    var ra = [];
    DB.all('hangHoa').forEach(function (h) {
        var sl = Number((t.ton || {})[h.id]) || 0;
        if (sl <= 0) return;
        var bq = Number((t.bq || {})[h.id]) || 0;
        ra.push({ id: h.id, ma: h.ma, ten: h.ten, nhom: h.nhom || '', ton: sl,
                  giaTri: Math.round(sl * bq), xuatCuoi: cuoi[h.id] || '',
                  soNgay: cuoi[h.id] ? T.soNgay(cuoi[h.id], den) : null });
    });
    ra.sort(function (a, b) {
        var x = a.soNgay === null ? 1e9 : a.soNgay, y = b.soNgay === null ? 1e9 : b.soNgay;
        return y - x || b.giaTri - a.giaTri;
    });
    return ra;
};

/**
 * CẢNH BÁO QUẢN TRỊ — mỗi cảnh báo nêu rõ con số, nguồn gốc và việc nên làm.
 * KHÔNG cảnh báo suông: cái gì không đủ dữ liệu để kết luận thì nói là chưa đủ
 * dữ liệu, không đoán.
 */
T.canhBaoQuanTri = function (loc) {
    var pt = T.phanTichKy(loc), th = pt.th, ra = [];
    function them(muc, ten, so, moTa, viec, route) {
        ra.push({ muc: muc, ten: ten, so: so, moTa: moTa, viec: viec, route: route || '' });
    }
    /* 1. Lỗ */
    if (th.loiNhuan < 0)
        them('loi', 'Kỳ này đang lỗ', T.money(th.loiNhuan) + ' đ',
             'Doanh thu ' + T.money(th.doanhThu) + ' đ, giá vốn ' + T.money(th.giaVon) +
             ' đ, chi phí ' + T.money(th.chiPhi) + ' đ.',
             'Rà lại giá bán và chi phí trong kỳ.', 'bao-cao');
    /* 2. Biên lợi nhuận giảm */
    if (pt.soSanh && pt.soSanh.bienLoiNhuan.lech < 0 && th.doanhThu)
        them('canh', 'Biên lợi nhuận giảm so với kỳ trước',
             T.num(pt.soSanh.bienLoiNhuan.lech, 1) + ' điểm phần trăm',
             'Kỳ này ' + T.num(th.bienLoiNhuan, 1) + '%, kỳ trước ' +
             T.num(pt.thTruoc.bienLoiNhuan, 1) + '%.',
             'Xem Lãi gộp theo mặt hàng để tìm nhóm hàng kéo biên xuống.', 'bao-cao');
    /* 3. Chi phí tăng nhanh hơn doanh thu */
    if (pt.soSanh && pt.soSanh.chiPhi.pct !== null && pt.soSanh.doanhThu.pct !== null &&
        pt.soSanh.chiPhi.pct > 0 && pt.soSanh.chiPhi.pct > pt.soSanh.doanhThu.pct + 10)
        them('canh', 'Chi phí tăng nhanh hơn doanh thu',
             'Chi phí ' + T.num(pt.soSanh.chiPhi.pct, 1) + '% · doanh thu ' +
             T.num(pt.soSanh.doanhThu.pct, 1) + '%',
             'So với kỳ liền trước cùng độ dài.',
             'Xem Chi phí theo khoản mục để biết khoản nào tăng.', 'bao-cao');
    /* 4. Nợ quá hạn */
    if (th.phaiThu.quaHan > 0)
        them('loi', 'Có công nợ quá hạn', T.money(th.phaiThu.quaHan) + ' đ',
             th.phaiThu.soQuaHan + ' khách hàng đã quá hạn thanh toán.',
             'Mở Công nợ để đối chiếu và đôn đốc thu hồi.', 'cong-no');
    /* 5. Chưa khai điều khoản thanh toán */
    if (th.phaiThu.chuaKhaiHan > 0)
        them('canh', 'Chưa khai Điều khoản thanh toán',
             T.money(th.phaiThu.chuaKhaiHan) + ' đ',
             'Phần công nợ này chưa xác định được hạn nên không biết đã quá hạn hay chưa.',
             'Khai Điều khoản thanh toán trên chứng từ hoặc trên hồ sơ khách hàng.', 'khach-hang');
    /* 6. Vượt hạn mức nợ */
    var vuot = th.phaiThu.ds.filter(function (x) { return x.vuotHanMuc; });
    if (vuot.length)
        them('canh', 'Khách hàng vượt hạn mức công nợ', vuot.length + ' khách hàng',
             vuot.slice(0, 3).map(function (x) { return x.ten; }).join(' · '),
             'Xem lại hạn mức hoặc tạm dừng bán chịu.', 'cong-no');
    /* 7. Tiền thực tế âm */
    if (th.dongTien.cuoiKy < 0)
        them('loi', 'Tiền thực tế đang âm', T.money(th.dongTien.cuoiKy) + ' đ',
             'Tiền đã chi ra nhiều hơn tiền đã thu về tính tới ngày ' + T.date(th.ky.den) + '.',
             'Đẩy nhanh thu hồi công nợ hoặc ghi nhận nguồn vốn thực tế đã đưa vào.', 'gop-von');
    /* 8. Dòng tiền có nguy cơ thiếu: tiền hiện có không đủ phần còn phải trả */
    if (th.phaiTra.conPhaiTra > 0 && th.dongTien.cuoiKy < th.phaiTra.conPhaiTra)
        them('canh', 'Tiền hiện có thấp hơn phần còn phải trả',
             'Thiếu ' + T.money(th.phaiTra.conPhaiTra - th.dongTien.cuoiKy) + ' đ',
             'Còn phải trả ' + T.money(th.phaiTra.conPhaiTra) + ' đ, tiền thực tế ' +
             T.money(th.dongTien.cuoiKy) + ' đ.',
             'Cân đối lịch trả nhà cung cấp với lịch thu tiền khách hàng.', 'cong-no');
    /* 9. Tồn kho lâu ngày */
    var lau = T.tonLau(th.ky.den).filter(function (x) { return x.soNgay === null || x.soNgay >= 180; });
    if (lau.length)
        them('canh', 'Hàng tồn lâu không có giao dịch xuất', lau.length + ' mã hàng',
             'Giá trị ' + T.money(T.sum(lau, function (x) { return x.giaTri; })) + ' đ nằm ở nhóm ' +
             'chưa xuất trong 180 ngày gần nhất hoặc chưa từng xuất.',
             'Rà lại nhu cầu, cân nhắc luân chuyển hoặc điều chỉnh giá bán.', 'bao-cao-ton');
    /* 10. Âm kho */
    var am = [];
    Object.keys(th.tonKho.ton || {}).forEach(function (id) {
        if ((Number(th.tonKho.ton[id]) || 0) < 0) am.push(id);
    });
    if (am.length)
        them('loi', 'Có mã hàng âm kho', am.length + ' mã hàng',
             'Tồn kho không thể âm — thường do xuất trước khi ghi sổ phiếu nhập.',
             'Mở Đối chiếu số liệu để tìm chứng từ gây lệch.', 'doi-chieu');
    /* 11. Chi phí chưa phân loại */
    var chuaKM = T.chiChuaPhanLoai(loc);
    if (chuaKM.length)
        them('canh', 'Phiếu chi chưa khai khoản mục', chuaKM.length + ' phiếu',
             'Những phiếu này KHÔNG được tính vào chi phí, nên lợi nhuận đang cao hơn thực tế.',
             'Khai khoản mục cho từng phiếu chi.', 'phieu-chi');
    /* 12. Dự án lỗ */
    var daLo = pt.theoDuAn.filter(function (d) { return d.loiNhuan < 0; });
    if (daLo.length)
        them('canh', 'Có dự án đang lỗ', daLo.length + ' dự án',
             daLo.slice(0, 3).map(function (d) {
                 return d.ten + ' (' + T.money(d.loiNhuan) + ' đ)'; }).join(' · '),
             'Xem Lãi lỗ theo dự án để tìm nguyên nhân.', 'bao-cao');
    var thuTu = { loi: 0, canh: 1, tin: 2 };
    ra.sort(function (a, b) { return thuTu[a.muc] - thuTu[b.muc]; });
    return ra;
};

/* ==========================================================================
   BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH — QUẢN TRỊ NỘI BỘ  (v18.1.0)
   --------------------------------------------------------------------------
   ĐÂY LÀ BÁO CÁO QUẢN TRỊ, PHỤC VỤ ĐIỀU HÀNH. KHÔNG phải báo cáo kế toán pháp
   định, không dùng để lập sổ kế toán, không dùng để kê khai thuế.

   Mọi con số đọc thẳng từ Business Engine đang có (T.tongHopKy →
   T.ketQuaKinhDoanh / T.chiPhiKy). KHÔNG có công thức riêng cho báo cáo này,
   KHÔNG lấy số kế toán bên ngoài, KHÔNG hard-code.

   CHỐNG CỘNG TRÙNG: doanh thu chỉ lấy MỘT bậc trên thang chứng từ
   (Đơn bán → Hợp đồng → Phiếu xuất kho), đúng như Engine vẫn làm. Báo giá,
   nghiệm thu, đề nghị thanh toán và phiếu thu KHÔNG bao giờ được cộng vào
   doanh thu.
   ========================================================================== */

/**
 * MƯỜI BẢY CHỈ TIÊU của báo cáo kết quả hoạt động kinh doanh, trình bày theo
 * đúng tư duy kế toán: có MÃ SỐ, có THUYẾT MINH, có KỲ NÀY và KỲ TRƯỚC.
 *
 * Vẫn là BÁO CÁO QUẢN TRỊ NỘI BỘ — mã số dùng để người đọc quen với biểu mẫu
 * kế toán dễ đối chiếu, KHÔNG có nghĩa đây là báo cáo tài chính pháp định.
 */
T.CHI_TIEU_KQKD = [
    { k: 'doanhThu',      ms: '01', t: 'Doanh thu bán hàng và cung cấp dịch vụ',
      dam: false, truyVet: 'doanhThu',
      tm: 'Chuỗi chứng từ bán hàng, chỉ lấy MỘT bậc: Đơn bán → Hợp đồng → Phiếu xuất kho. Số trước thuế GTGT.' },
    { k: 'giamTru',       ms: '02', t: 'Các khoản giảm trừ doanh thu',
      dam: false, truyVet: '', chuaCo: true,
      tm: 'Phần mềm chưa có chứng từ hàng bán trả lại / giảm giá hàng bán.' },
    { k: 'doanhThuThuan', ms: '10', t: 'Doanh thu thuần về bán hàng và cung cấp dịch vụ',
      dam: true, truyVet: 'doanhThu', ct: 'Mã số 10 = Mã số 01 − Mã số 02' },
    { k: 'giaVon',        ms: '11', t: 'Giá vốn hàng bán',
      dam: false, truyVet: 'giaVon',
      tm: 'Bình quân gia quyền di động, đã đóng băng trên chứng từ tại thời điểm ghi nhận.' },
    { k: 'loiNhuanGop',   ms: '20', t: 'Lợi nhuận gộp về bán hàng và cung cấp dịch vụ',
      dam: true, truyVet: 'loiNhuan', ct: 'Mã số 20 = Mã số 10 − Mã số 11' },
    { k: 'dtTaiChinh',    ms: '21', t: 'Doanh thu hoạt động tài chính',
      dam: false, truyVet: '', chuaCo: true,
      tm: 'Phần mềm chưa có chứng từ lãi tiền gửi / chênh lệch tỷ giá.' },
    { k: 'cpTaiChinh',    ms: '22', t: 'Chi phí tài chính',
      dam: false, truyVet: 'chiPhi',
      tm: 'Phiếu chi có khoản mục thuộc nhóm chi phí tài chính.' },
    { k: 'cpLaiVay',      ms: '23', t: '— Trong đó: Chi phí lãi vay',
      dam: false, truyVet: 'chiPhi', con: true,
      tm: 'Phần lãi vay nằm trong mã số 22. Tiền vay hiện chưa phát sinh nên thường bằng 0.' },
    { k: 'cpBanHang',     ms: '25', t: 'Chi phí bán hàng',
      dam: false, truyVet: 'chiPhi',
      tm: 'Chi phí công trình / dự án, vận chuyển giao hàng, tiếp khách giao dịch.' },
    { k: 'cpQuanLy',      ms: '26', t: 'Chi phí quản lý doanh nghiệp',
      dam: false, truyVet: 'chiPhi',
      tm: 'Lương, thuê văn phòng, điện nước viễn thông, công tác phí, và các khoản ' +
          'VAT · thuế môn bài · phí · lệ phí (mọi loại thuế KHÁC thuế TNDN).' },
    { k: 'lnThuan',       ms: '30', t: 'Lợi nhuận thuần từ hoạt động kinh doanh',
      dam: true, truyVet: 'loiNhuan',
      ct: 'Mã số 30 = Mã số 20 + Mã số 21 − Mã số 22 − Mã số 25 − Mã số 26' },
    { k: 'thuNhapKhac',   ms: '31', t: 'Thu nhập khác',
      dam: false, truyVet: '', chuaCo: true,
      tm: 'Phần mềm chưa có chứng từ thu nhập khác.' },
    { k: 'cpKhac',        ms: '32', t: 'Chi phí khác',
      dam: false, truyVet: 'chiPhi',
      tm: 'Phiếu chi có khoản mục thuộc nhóm chi phí khác.' },
    { k: 'lnKhac',        ms: '40', t: 'Lợi nhuận khác',
      dam: true, truyVet: '', ct: 'Mã số 40 = Mã số 31 − Mã số 32' },
    { k: 'lnTruocThue',   ms: '50', t: 'Tổng lợi nhuận kế toán trước thuế',
      dam: true, truyVet: 'loiNhuan', ct: 'Mã số 50 = Mã số 30 + Mã số 40' },
    { k: 'thueTNDN',      ms: '51', t: 'Chi phí thuế thu nhập doanh nghiệp',
      dam: false, truyVet: 'chiPhi',
      tm: 'CHỈ gồm thuế thu nhập doanh nghiệp — phiếu chi có khoản mục thuộc nhóm ' +
          '"Thuế thu nhập doanh nghiệp" (khoản mục gốc CP13). VAT, thuế môn bài, phí, ' +
          'lệ phí và mọi loại thuế khác KHÔNG nằm ở đây; chúng lên chi phí quản lý mã số 26.' },
    { k: 'lnSauThue',     ms: '60', t: 'Lợi nhuận sau thuế thu nhập doanh nghiệp',
      dam: true, truyVet: 'loiNhuan', ct: 'Mã số 60 = Mã số 50 − Mã số 51' }
];

/** Tách chi phí của kỳ theo nhóm trình bày trên báo cáo. */
T.chiTheoNhomBC = function (loc) {
    var cp = T.chiPhiKy(loc);
    var o = { banHang: 0, quanLy: 0, taiChinh: 0, laiVay: 0, thue: 0, thueTNDN: 0,
              khac: 0, chuaKhai: 0, tong: cp.tong };
    var ct = { banHang: [], quanLy: [], taiChinh: [], laiVay: [], thue: [], thueTNDN: [],
               khac: [], chuaKhai: [] };
    (cp.ds || []).forEach(function (p) {
        var n = T.nhomChiBC(p) || 'chuaKhai';
        if (o[n] === undefined) n = 'khac';
        o[n] += Number(p.soTien) || 0;
        ct[n].push(p);
        /* Lãi vay là MỘT PHẦN của chi phí tài chính, không cộng thêm lần nữa. */
        var km = T.khoanMucCua(p);
        if (km && km.laiVay) { o.laiVay += Number(p.soTien) || 0; ct.laiVay.push(p); }
    });
    o.chiTiet = ct;
    o.soPhieu = cp.soPhieu;
    return o;
};

/**
 * BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH của một kỳ, kèm kỳ liền trước.
 * Trả về đủ năm cột cho từng chỉ tiêu: kỳ này · kỳ trước · chênh lệch · % ·
 * tỷ trọng trên doanh thu thuần.
 */
T.baoCaoKQKD = function (loc) {
    loc = loc || {};
    function motKy(l) {
        var th = T.tongHopKy(l);
        var cp = T.chiTheoNhomBC(l);
        var o = {};
        /* --- Mã số 01, 02, 10 --- */
        o.doanhThu = th.doanhThu;
        /* Phần mềm hiện CHƯA có chứng từ giảm trừ doanh thu (hàng bán trả lại,
           giảm giá hàng bán). KHÔNG bịa số: để 0 và nói rõ. */
        o.giamTru = 0;
        o.doanhThuThuan = o.doanhThu - o.giamTru;
        /* --- Mã số 11, 20 --- */
        o.giaVon = th.giaVon;
        o.loiNhuanGop = o.doanhThuThuan - o.giaVon;
        /* --- Mã số 21, 22, 23, 25, 26 --- */
        o.dtTaiChinh = 0;                 /* chưa có chứng từ doanh thu tài chính */
        o.cpTaiChinh = cp.taiChinh;
        o.cpLaiVay = cp.laiVay;           /* nằm TRONG mã số 22, không cộng thêm */
        o.cpBanHang = cp.banHang;
        /* v18.6.0 — Logic 3. VAT, thuế môn bài, phí và lệ phí là chi phí quản lý
           doanh nghiệp, KHÔNG phải thuế TNDN. Gộp vào mã số 26 để không khoản
           nào biến mất và tổng lợi nhuận sau thuế không đổi. */
        o.cpQuanLy = cp.quanLy + cp.thue;
        o.thuePhiLePhi = cp.thue;      /* nằm TRONG mã số 26, không cộng thêm */
        /* --- Mã số 30 --- */
        o.lnThuan = o.loiNhuanGop + o.dtTaiChinh - o.cpTaiChinh -
                    o.cpBanHang - o.cpQuanLy;
        /* --- Mã số 31, 32, 40 --- */
        o.thuNhapKhac = 0;                /* chưa có chứng từ thu nhập khác */
        o.cpKhac = cp.khac;               /* phiếu chưa khai khoản mục KHÔNG được tính */
        o.lnKhac = o.thuNhapKhac - o.cpKhac;
        /* --- Mã số 50, 51, 60 --- */
        o.lnTruocThue = o.lnThuan + o.lnKhac;
        /* v18.6.0 — Logic 3. Mã số 51 CHỈ nhận thuế thu nhập doanh nghiệp. */
        o.thueTNDN = cp.thueTNDN;
        o.lnSauThue = o.lnTruocThue - o.thueTNDN;
        o._cp = cp; o._th = th;
        return o;
    }
    var ky = T.kyChon(loc.ky || 'nam', loc);
    var l1 = {};
    if (loc.tuNgay) l1.tuNgay = loc.tuNgay;
    if (loc.denNgay) l1.denNgay = loc.denNgay;
    ['donViId', 'duAnId', 'khachHangId', 'nhomHangId'].forEach(function (k) {
        if (loc[k]) l1[k] = loc[k]; });
    var nay = motKy(l1);

    /* Kỳ liền trước cùng độ dài — dùng đúng hàm kỳ của Engine. */
    var truoc = null, kyTruoc = null;
    if (l1.tuNgay && l1.denNgay) {
        kyTruoc = T.kyLienTruoc({ tuNgay: l1.tuNgay, denNgay: l1.denNgay });
        if (kyTruoc) {
            var l2 = T.clone(l1);
            l2.tuNgay = kyTruoc.tuNgay; l2.denNgay = kyTruoc.denNgay;
            truoc = motKy(l2);
        }
    }
    var mau = nay.doanhThuThuan || 0;
    var dong = T.CHI_TIEU_KQKD.map(function (c) {
        var a = Number(nay[c.k]) || 0;
        var b = truoc ? (Number(truoc[c.k]) || 0) : null;
        var lech = truoc ? a - b : null;
        var pct = (truoc && b) ? Math.round((a - b) / Math.abs(b) * 1000) / 10 : null;
        return {
            k: c.k, ms: c.ms, stt: c.ms, ten: c.t, dam: c.dam, con: !!c.con,
            truyVet: c.truyVet,
            thuyetMinh: c.tm || c.ct || '',
            congThuc: c.ct || '',
            kyNay: a, kyTruoc: b, lech: lech, pct: pct,
            tyTrong: mau ? Math.round(a / mau * 1000) / 10 : null,
            chuaCo: !!c.chuaCo
        };
    });
    return {
        ky: ky, kyTruoc: kyTruoc, loc: l1,
        dong: dong, nay: nay, truoc: truoc,
        chuaKhaiKhoanMuc: nay._cp.chuaKhai,
        soPhieuChi: nay._cp.soPhieu,
        ghiChu: 'Báo cáo QUẢN TRỊ NỘI BỘ phục vụ điều hành. Không phải báo cáo kế toán ' +
                'pháp định, không dùng để lập sổ kế toán hay kê khai thuế.',
        chuaCoChungTu: ['Các khoản giảm trừ doanh thu', 'Doanh thu hoạt động tài chính',
                        'Thu nhập khác'],
        /* Thông tin đầu báo cáo — phải in ra đúng công ty đang chọn. */
        donVi: (function () {
            var d = l1.donViId ? DB.get('donVi', l1.donViId) : null;
            return d ? { id: d.id, ten: d.ten, tat: d.tat || '', diaChi: d.diaChi || '',
                         mst: d.mst || '' }
                     : { id: '', ten: 'TỔNG HỢP NHIỀU CÔNG TY', tat: 'TỔNG HỢP',
                         diaChi: '', mst: '' };
        })(),
        laTongHop: !l1.donViId,
        donViTinh: 'VNĐ',
        ngayLap: T.today()
    };
};

/**
 * BỨC TRANH TỔNG QUAN DOANH NGHIỆP — mười chỉ tiêu điều hành.
 * Mỗi chỉ tiêu ghi rõ BẢN CHẤT của nó để không ai đọc nhầm: tiền thực có KHÔNG
 * phải lợi nhuận, vốn góp KHÔNG phải doanh thu, tiền trả nhà cung cấp KHÔNG
 * phải chi phí nếu khoản đó đã nằm trong giá vốn.
 */
T.tongQuanDoanhNghiep = function (loc) {
    loc = loc || {};
    var th = T.tongHopKy(loc);
    var bc = T.baoCaoKQKD(loc);
    var von = 0, laVon = false;
    try {
        var dv = T.donViVon();
        laVon = !loc.donViId || (dv && loc.donViId === dv.id);
        if (laVon) {
            var q = T.quyVonKy(loc);
            /* v18.6.0 — Logic 2. Chỉ tiêu này gọi là "Vốn góp thực tế" nên phải
               lấy đúng TIỀN CỔ ĐÔNG BỎ RA, không lấy tổng nghĩa vụ đã thực hiện.
               coDongNop là một chỉ tiêu ba kỳ (đầu kỳ · phát sinh · cuối kỳ). */
            von = (q && q.coDongNop && q.coDongNop.cuoiKy !== undefined) ? q.coDongNop.cuoiKy : 0;
        }
    } catch (e) { von = 0; }
    function m(k, t, gt, banChat, truyVet) {
        return { k: k, ten: t, giaTri: gt, banChat: banChat, truyVet: truyVet || '' };
    }
    return {
        ky: bc.ky,
        muc: [
            m('doanhThu', 'Doanh thu', th.doanhThu,
              'Giá trị hàng đã bán theo chứng từ, TRƯỚC thuế GTGT. Không phải tiền đã thu.',
              'doanhThu'),
            m('giaVon', 'Giá vốn', th.giaVon,
              'Giá vốn bình quân gia quyền đã đóng băng trên chứng từ khi ghi nhận.', 'giaVon'),
            m('loiNhuanGop', 'Lợi nhuận gộp', bc.nay.loiNhuanGop,
              'Doanh thu thuần trừ giá vốn. Chưa trừ chi phí bán hàng và quản lý.', 'loiNhuan'),
            m('chiPhi', 'Chi phí', th.chiPhi,
              'CHỈ gồm phiếu chi đã khai khoản mục được đánh dấu tính vào chi phí. ' +
              'Tiền trả nhà cung cấp KHÔNG tính lại vì đã nằm trong giá vốn.', 'chiPhi'),
            m('loiNhuan', 'Lợi nhuận', th.loiNhuan,
              'Doanh thu − giá vốn − chi phí. KHÔNG phải tiền còn trong két.', 'loiNhuan'),
            m('tienThucCo', 'Tiền thực có', th.dongTien.cuoiKy,
              'Tiền thật đã thu trừ tiền thật đã chi. ĐÂY KHÔNG PHẢI LỢI NHUẬN.', 'dongTien'),
            m('phaiThu', 'Phải thu', th.phaiThu.conPhaiThu,
              'Tiền hàng khách còn nợ, chốt tại ngày cuối kỳ.', 'phaiThu'),
            m('phaiTra', 'Phải trả', th.phaiTra.conPhaiTra,
              'Tiền còn nợ nhà cung cấp cho phần hàng ĐÃ VÀO KHO.', 'phaiTra'),
            m('tonKho', 'Tồn kho', th.giaTriTonKho,
              'Giá trị hàng còn trong kho tại ngày chốt kỳ.', 'tonKho'),
            m('vonGop', 'Vốn góp thực tế', von,
              laVon ? 'Tiền cá nhân cổ đông đã thực nộp vào công ty. ĐÂY KHÔNG PHẢI DOANH THU. ' +
                      'Phần nghĩa vụ được thực hiện bằng tiền bán hàng của công ty KHÔNG tính ở đây.'
                    : 'Chỉ áp dụng cho công ty cổ phần có phân hệ góp vốn.', 'gopVon')
        ],
        laDonViVon: laVon,
        luuY: 'Báo cáo quản trị. Tiền thực có ≠ lợi nhuận. Vốn góp ≠ doanh thu. ' +
              'Tiền thanh toán nhà cung cấp ≠ chi phí khi khoản đó đã vào giá vốn.'
    };
};

/**
 * KỊCH BẢN GIẢ ĐỊNH — "nếu doanh thu giảm X% thì dòng tiền thế nào".
 * Chỉ suy diễn từ số liệu thật của kỳ đang xem, KHÔNG ghi gì vào dữ liệu.
 */
T.kichBanDoanhThu = function (loc, pct) {
    var th = T.tongHopKy(loc);
    var p = (Number(pct) || 0) / 100;
    var dtMoi = Math.round(th.doanhThu * (1 - p));
    /* Giá vốn co theo doanh thu (bán ít thì xuất ít); chi phí giữ nguyên vì
       phần lớn chi phí trong kỳ không co theo sản lượng. Đây là GIẢ ĐỊNH, được
       nói rõ để người đọc tự cân nhắc. */
    var gvMoi = th.doanhThu ? Math.round(th.giaVon * dtMoi / th.doanhThu) : 0;
    var lnMoi = dtMoi - gvMoi - th.chiPhi;
    var tienMoi = Math.round(th.dongTien.cuoiKy - (th.doanhThu - dtMoi));
    return { pct: Number(pct) || 0,
             doanhThu: dtMoi, giaVon: gvMoi, chiPhi: th.chiPhi, loiNhuan: lnMoi,
             bienLoiNhuan: dtMoi ? Math.round(lnMoi / dtMoi * 1000) / 10 : 0,
             tienUocTinh: tienMoi, goc: th,
             giaDinh: 'Giá vốn co theo doanh thu, chi phí trong kỳ giữ nguyên, ' +
                      'phần doanh thu hụt coi như hụt tiền về tương ứng.' };
};

/* ==========================================================================
   KIỂM TOÁN TÍNH TOÀN VẸN CỦA DỮ LIỆU
   --------------------------------------------------------------------------
   Bộ này KHÔNG sửa gì. Nó chỉ đi soi và chỉ ra chỗ hỏng để người dùng tự xử
   lý: số không hợp lệ, tham chiếu treo, số chứng từ trùng, ngày sai, đơn vị
   sai. Nguyên tắc đã chốt: PHÁT HIỆN THÌ BÁO, KHÔNG TỰ VÁ DỮ LIỆU.
   ========================================================================== */

/** Một giá trị có phải số dùng được không (không NaN, không vô cực). */
T.soHopLe = function (v) {
    if (v === undefined || v === null || v === '') return true;   /* để trống là hợp lệ */
    var n = Number(v);
    return typeof n === 'number' && isFinite(n);
};

T.kiemToanDuLieu = function (loc) {
    loc = loc || {};
    var loi = [], canhBao = [];
    function bat(ds, ten, moTa, huong) {
        if (!ds.length) return;
        loi.push({ ten: ten, so: ds.length, moTa: moTa, huong: huong || '',
                   viDu: ds.slice(0, 5) });
    }
    function nhac(ds, ten, moTa, huong) {
        if (!ds.length) return;
        canhBao.push({ ten: ten, so: ds.length, moTa: moTa, huong: huong || '',
                       viDu: ds.slice(0, 5) });
    }
    function trongKy(r) {
        var n = String(r.ngay || '').substr(0, 10);
        if (loc.tuNgay && n && n < loc.tuNgay) return false;
        if (loc.denNgay && n && n > loc.denNgay) return false;
        if (loc.donViId && r.donVi && r.donVi !== loc.donViId) return false;
        return true;
    }
    var CT = ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'donMua',
              'loNhap', 'phieuNhap', 'phieuThu', 'phieuChi'];
    var SO_TIEN = ['thanhTien', 'vat', 'tongCong', 'soTien', 'soLuong', 'donGia', 'giaVon'];

    /* 1. Số không hợp lệ (NaN, Infinity) trong các trường tiền và số lượng */
    var xauSo = [];
    CT.forEach(function (c) {
        DB.all(c).forEach(function (r) {
            if (!trongKy(r)) return;
            var hong = SO_TIEN.filter(function (k) { return !T.soHopLe(r[k]); });
            (r.lines || []).forEach(function (l) {
                SO_TIEN.forEach(function (k) { if (!T.soHopLe(l[k])) hong.push('dòng.' + k); });
            });
            if (hong.length)
                xauSo.push(T.tenBang(c) + ' ' + (r.so || r.id) + ' — ' + hong.join(', '));
        });
    });
    bat(xauSo, 'Có giá trị số không hợp lệ',
        'Trường tiền hoặc số lượng chứa giá trị không phải số (NaN). Mọi phép cộng đi qua đó đều sai.',
        'Mở chứng từ, nhập lại giá trị đúng rồi lưu.');

    /* 2. Ngày không hợp lệ hoặc ở tương lai */
    var xauNgay = [], tuongLai = [];
    CT.forEach(function (c) {
        DB.all(c).forEach(function (r) {
            if (loc.donViId && r.donVi && r.donVi !== loc.donViId) return;
            var n = String(r.ngay || '');
            if (!n) { xauNgay.push(T.tenBang(c) + ' ' + (r.so || r.id) + ' — chưa có ngày'); return; }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(n)) {
                xauNgay.push(T.tenBang(c) + ' ' + (r.so || r.id) + ' — ngày "' + n + '"'); return;
            }
            if (n > T.today()) tuongLai.push(T.tenBang(c) + ' ' + (r.so || r.id) + ' — ' + T.date(n));
        });
    });
    bat(xauNgay, 'Chứng từ thiếu ngày hoặc ngày sai định dạng',
        'Không có ngày thì chứng từ không rơi vào kỳ nào, số liệu báo cáo sẽ thiếu.',
        'Khai lại ngày trên chứng từ.');
    nhac(tuongLai, 'Chứng từ có ngày ở tương lai',
        'Ngày lớn hơn ngày hôm nay. Có thể gõ nhầm năm.',
        'Kiểm tra lại ngày chứng từ.');

    /* 3. Số chứng từ trùng trong cùng một bảng */
    CT.forEach(function (c) {
        var d = {}, trung = [];
        DB.all(c).forEach(function (r) {
            var k = String(r.so || '').trim();
            if (!k) return;
            if (d[k]) trung.push(T.tenBang(c) + ' — số ' + k); else d[k] = 1;
        });
        nhac(trung, 'Số chứng từ trùng trong ' + T.tenBang(c),
            'Hai bản ghi cùng mang một số chứng từ. Dễ nhầm khi đối chiếu.',
            'Đổi số của một trong hai chứng từ, hoặc dùng Gộp dữ liệu trùng.');
    });

    /* 4. Tham chiếu treo — trỏ tới bản ghi không còn tồn tại */
    var treo = [];
    function soi(c, truong, bangDich) {
        DB.all(c).forEach(function (r) {
            if (!trongKy(r)) return;
            var id = r[truong];
            if (id && !DB.get(bangDich, id))
                treo.push(T.tenBang(c) + ' ' + (r.so || r.id) + ' → ' +
                          T.tenBang(bangDich) + ' không còn');
        });
    }
    soi('donBan', 'khachHangId', 'khachHang');
    soi('hopDong', 'khachHangId', 'khachHang');
    soi('baoGia', 'khachHangId', 'khachHang');
    soi('phieuThu', 'khachHangId', 'khachHang');
    soi('donMua', 'nhaCungCapId', 'nhaCungCap');
    soi('loNhap', 'nhaCungCapId', 'nhaCungCap');
    bat(treo, 'Chứng từ trỏ tới bản ghi đã không còn',
        'Liên kết bằng ID nội bộ nhưng bản ghi đích đã bị xóa. Báo cáo theo đối tượng sẽ hụt.',
        'Khôi phục bản ghi từ Thùng rác hoặc gán lại đối tượng cho chứng từ.');

    /* 5. Dòng hàng không gắn được mã hàng nội bộ */
    var mocHang = [];
    ['donBan', 'hopDong', 'phieuXuat', 'baoGia'].forEach(function (c) {
        DB.all(c).forEach(function (r) {
            if (!trongKy(r)) return;
            var n = (r.lines || []).filter(function (l) { return !T.idDong(l); }).length;
            if (n) mocHang.push(T.tenBang(c) + ' ' + (r.so || r.id) + ' — ' + n + ' dòng');
        });
    });
    bat(mocHang, 'Dòng hàng không gắn được mã hàng trong Danh mục',
        'Dòng chỉ có tên hàng gõ tay, không nối được vào Danh mục hàng hóa nên không vào được ' +
        'báo cáo theo mặt hàng và không lấy được giá vốn.',
        'Mở chứng từ, chọn lại mặt hàng từ Danh mục.');

    /* 6. Đơn vị phát hành không tồn tại */
    var saiDV = [];
    CT.forEach(function (c) {
        DB.all(c).forEach(function (r) {
            if (r.donVi && !DB.get('donVi', r.donVi))
                saiDV.push(T.tenBang(c) + ' ' + (r.so || r.id) + ' — đơn vị "' + r.donVi + '"');
        });
    });
    bat(saiDV, 'Chứng từ gắn đơn vị phát hành không tồn tại',
        'Chứng từ sẽ không hiện ở bất kỳ công ty nào khi lọc theo đơn vị.',
        'Gán lại đơn vị phát hành cho chứng từ.');

    /* 7. Số âm ở chỗ không được phép âm */
    var am = [];
    ['donBan', 'hopDong', 'baoGia'].forEach(function (c) {
        DB.all(c).forEach(function (r) {
            if (!trongKy(r)) return;
            if ((Number(r.tongCong) || 0) < 0)
                am.push(T.tenBang(c) + ' ' + (r.so || r.id) + ' — tổng cộng âm');
        });
    });
    DB.all('phieuThu').concat(DB.all('phieuChi')).forEach(function (r) {
        if (!trongKy(r)) return;
        if ((Number(r.soTien) || 0) < 0) am.push('Phiếu ' + (r.so || r.id) + ' — số tiền âm');
    });
    bat(am, 'Có chứng từ mang giá trị âm',
        'Đơn bán, hợp đồng, phiếu thu và phiếu chi không thể mang số tiền âm.',
        'Sửa lại giá trị, hoặc lập chứng từ điều chỉnh riêng thay vì ghi số âm.');

    /* 8. Tồn kho âm tại ngày chốt */
    var t = T.tonKhoTaiNgay(loc.denNgay || T.today()), amKho = [];
    Object.keys(t.ton || {}).forEach(function (id) {
        if ((Number(t.ton[id]) || 0) < 0) {
            var h = T.hh(id) || {};
            amKho.push((h.ma || id) + ' — tồn ' + T.num(t.ton[id], 0));
        }
    });
    bat(amKho, 'Có mã hàng âm kho',
        'Tồn kho không thể âm. Thường do xuất kho trước khi ghi sổ phiếu nhập.',
        'Rà lại thứ tự nhập - xuất của các mã này trong Thẻ kho.');

    /* 9. Phiếu chi đã ghi sổ nhưng chưa khai khoản mục */
    var chuaKM = T.chiChuaPhanLoai(loc);
    nhac(chuaKM.map(function (p) { return 'Phiếu chi ' + (p.so || p.id); }),
        'Phiếu chi chưa khai khoản mục',
        'Những phiếu này KHÔNG được tính vào chi phí, nên lợi nhuận đang cao hơn thực tế.',
        'Khai khoản mục cho từng phiếu chi.');

    /* 10. DỮ LIỆU CẦN NGƯỜI XÁC MINH (v18.5.0).
       Đây KHÔNG phải lỗi số liệu — đây là những chỗ phần mềm nhìn thấy bất
       thường nhưng không được tự sửa vì đúng/sai phụ thuộc việc thực tế đã xảy
       ra thế nào. Đưa vào cảnh báo để người dùng nhìn thấy, kèm câu hỏi cụ thể
       và đề xuất; phần mềm không tự đổi một con số nào. */
    var xm = T.canXacMinh(loc);
    xm.ds.forEach(function (x) {
        if (!(x.chungCu || []).length) return;
        canhBao.push({ ten: x.tieuDe, so: x.chungCu.length, moTa: x.moTa,
                       huong: (x.cauHoi ? x.cauHoi + ' ' : '') + x.deXuat,
                       viDu: x.chungCu.slice(0, 5),
                       /* Cờ này để lớp AI nói đúng bản chất: đây là việc CẦN
                          XÁC MINH, chưa chắc đã là lỗi. */
                       canXacMinh: true, cauHoi: x.cauHoi || '' });
    });

    return { dat: loi.length === 0, loi: loi, canhBao: canhBao,
             soLoi: loi.length, soCanhBao: canhBao.length,
             canXacMinh: xm };
};

/* ==========================================================================
   TRUY VẾT MỘT CHỈ TIÊU VỀ ĐÚNG TẬP CHỨNG TỪ GỐC
   --------------------------------------------------------------------------
   Không có con số nào trong báo cáo mà không truy được về chứng từ đã sinh ra
   nó. Hàm này trả về: giá trị, tên hàm Business Engine đã tính, mô tả nguồn số
   liệu, và danh sách chứng từ cấu thành. Màn hình Kết quả hoạt động kinh doanh
   dùng nó cho nút "Truy vết nguồn".

   Đây là hàm NGHIỆP VỤ, chỉ đọc, không liên quan tới AI. Trước đây nó nằm nhờ
   trong khối AI cố vấn; khi gỡ AI thì nó được giữ nguyên nội dung và chuyển về
   đúng chỗ của mình trong Business Engine.
   ========================================================================== */
T.truyVetChiTieu = function (chiTieu, loc) {
    loc = loc || {};
    var th = T.tongHopKy(loc);
    var B = {
        doanhThu: function () {
            return { gt: th.doanhThu, ham: 'T.ketQuaKinhDoanh → T.chungTuDoanhThu',
                nguon: 'Chuỗi chứng từ bán hàng: Đơn bán → Hợp đồng → Phiếu xuất kho, ' +
                       'mỗi giao dịch chỉ lấy MỘT bậc, cộng thêm phụ lục bổ sung hàng hóa. Số trước thuế GTGT.',
                ct: (th.kq.chiTiet || []).concat(th.kq.chiTietNoiBo || []).map(function (x) {
                    return { loai: x.ten, so: (x.r || {}).so, ngay: (x.r || {}).ngay, gt: x.doanhThu }; }) };
        },
        giaVon: function () {
            return { gt: th.giaVon, ham: 'T.ketQuaKinhDoanh → giá vốn đóng băng trên chứng từ',
                nguon: 'Giá vốn bình quân gia quyền di động, đã đóng băng trên từng dòng chứng từ ' +
                       'tại thời điểm ghi nhận. Đổi bảng giá về sau không sửa ngược quá khứ.',
                ct: (th.kq.chiTiet || []).map(function (x) {
                    return { loai: x.ten, so: (x.r || {}).so, ngay: (x.r || {}).ngay, gt: x.giaVon }; }) };
        },
        chiPhi: function () {
            var cp = th.kq.chiPhiChiTiet || { ds: [] };
            return { gt: th.chiPhi, ham: 'T.chiPhiKy',
                nguon: 'Phiếu chi ĐÃ GHI SỔ và có khoản mục được đánh dấu tính vào chi phí. ' +
                       'Phiếu chi chưa khai khoản mục KHÔNG được tính.',
                ct: (cp.ds || []).map(function (p) {
                    return { loai: 'Phiếu chi', so: p.so, ngay: p.ngay, gt: p.soTien }; }) };
        },
        loiNhuan: function () {
            return { gt: th.loiNhuan, ham: 'T.ketQuaKinhDoanh',
                nguon: 'Doanh thu − Giá vốn − Chi phí. Không có công thức nào khác trong phần mềm.',
                ct: [{ loai: 'Doanh thu', so: '', ngay: '', gt: th.doanhThu },
                     { loai: 'Giá vốn', so: '', ngay: '', gt: -th.giaVon },
                     { loai: 'Chi phí', so: '', ngay: '', gt: -th.chiPhi }] };
        },
        tonKho: function () {
            return { gt: th.giaTriTonKho, ham: 'T.tonKhoTaiNgay → T.chayLaiKho',
                nguon: 'Phát lại toàn bộ sổ kho (nhập − xuất) tới ngày chốt kỳ rồi nhân với ' +
                       'giá vốn bình quân tại đúng thời điểm đó.',
                ct: [{ loai: 'Số mã còn tồn', so: '', ngay: th.ky.den,
                       gt: th.tonKho.soMa || 0 }] };
        },
        phaiThu: function () {
            return { gt: th.phaiThu.conPhaiThu, ham: 'T.congNoPhaiThu → T.congNoKH',
                nguon: 'Tổng đơn bán đã chốt trừ tổng phiếu thu đã ghi sổ, chốt tại ngày cuối kỳ.',
                ct: th.phaiThu.ds.slice(0, 50).map(function (x) {
                    return { loai: 'Khách hàng', so: x.ma, ngay: '', gt: x.conLai }; }) };
        },
        phaiTra: function () {
            return { gt: th.phaiTra.conPhaiTra, ham: 'T.congNoPhaiTra → T.congNoNCC',
                nguon: 'Đơn mua có hàng ĐÃ VÀO KHO trừ phiếu chi trả tiền hàng đã ghi sổ.',
                ct: th.phaiTra.ds.slice(0, 50).map(function (x) {
                    return { loai: 'Nhà cung cấp', so: x.ma, ngay: '', gt: x.conLai }; }) };
        },
        dongTien: function () {
            var d = th.dongTien;
            return { gt: d.cuoiKy, ham: 'T.dongTienKy',
                nguon: 'Tiền thực tế đầu kỳ cộng phiếu thu trừ phiếu chi, trừ tiền trả nhà ' +
                       'cung cấp qua nghiệp vụ nhập kho, cộng tiền CỔ ĐÔNG THỰC GÓP, trừ rút vốn ' +
                       'trừ lợi nhuận đã chia. Tiền bán hàng được phân bổ vào nghĩa vụ góp vốn ' +
                       'KHÔNG cộng thêm lần nữa. Chỉ đếm tiền thật, không đếm công nợ.',
                ct: [{ loai: 'Đầu kỳ', so: '', ngay: th.ky.truoc, gt: d.dauKy },
                     { loai: 'Tiền vào', so: d.soPhieuThu + ' phiếu', ngay: '', gt: d.thu },
                     { loai: 'Tiền ra', so: d.soPhieuChi + ' phiếu', ngay: '', gt: -d.chi },
                     { loai: 'Trả NCC qua nhập kho', so: '', ngay: '', gt: -d.chiNhapKho }] };
        }
    };
    if (!B[chiTieu]) return null;
    var r = B[chiTieu]();
    r.chiTieu = chiTieu; r.ky = th.ky;
    return r;
};

W.T = T; W.DB = DB; W.Q = Q;
})(window);

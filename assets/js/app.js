/* ==========================================================================
   TVERP — KHUNG ỨNG DỤNG
   Đăng nhập, thanh điều hướng, bộ định tuyến một trang, phím tắt.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, S = W.SCREEN = W.SCREEN || {};

/* --------------------------------------------------------------- THỰC ĐƠN */
/* Thứ tự menu bám đúng trình tự nghiệp vụ thực tế của doanh nghiệp:
   Trang chủ → Danh mục → Mua hàng & Nhập khẩu → Kho → Giá vốn → Bán hàng
   → Thu chi & Công nợ → Báo cáo → Hệ thống.
   Mỗi nghiệp vụ chỉ xuất hiện ở ĐÚNG MỘT nhóm, không lặp lại. */
var MENU = [
    { t: 'Trang chủ', i: 'bi-speedometer2', r: 'trang-chu' },

    { sec: 'Danh mục' },
    { t: 'Khách hàng', i: 'bi-people-fill', r: 'khach-hang', c: 'khachHang' },
    { t: 'Nhà cung cấp', i: 'bi-truck', r: 'nha-cung-cap', c: 'nhaCungCap' },
    { t: 'Hàng hóa', i: 'bi-box-seam-fill', r: 'hang-hoa', c: 'hangHoa' },
    { t: 'Nhóm hàng', i: 'bi-collection-fill', r: 'nhom-hang', c: 'nhomHang' },
    { t: 'Hãng sản xuất', i: 'bi-award-fill', r: 'hang-sx', c: 'hangSX' },
    { t: 'Bảng giá', i: 'bi-tags-fill', r: 'bang-gia', c: 'bangGiaBan' },

    /* MUA HÀNG — CHỈ MỘT PHÂN HỆ DUY NHẤT: NHẬP HÀNG.
       Đơn mua hàng và Lô nhập hàng đã gộp vào đây; toàn bộ nghiệp vụ phía sau
       (phiếu nhập kho, tồn kho, giá vốn, công nợ) do hệ thống tự xử lý. */
    { sec: 'Mua hàng' },
    { t: 'Nhập hàng', i: 'bi-box-arrow-in-down', r: 'nhap-hang', c: 'donMua' },

    /* KHO — SIDEBAR CHỈ GIỮ MỘT MỤC CẤP CAO.
       Tám màn hình của phân hệ Kho điều hướng bằng THANH CHỨC NĂNG HÀNG NGANG
       ngay trong phân hệ (W.TAB_KHO — có trên cả tám màn hình). Bảy màn hình
       con chuyển xuống MENU_KHO: không hiện trên thanh dọc để tránh hai menu
       cùng một chức năng, nhưng vẫn tìm được bằng ô tìm nhanh (Ctrl+K) và mọi
       route #/... giữ nguyên. */
    { sec: 'Kho' },
    { t: 'Kho', i: 'bi-clipboard2-data-fill', r: 'kho-tong-quan', nhomKho: true },

    { sec: 'Giá vốn' },
    { t: 'Giá vốn hàng hóa', i: 'bi-currency-exchange', r: 'gia-von' },

    { sec: 'Bán hàng' },
    { t: 'Báo giá', i: 'bi-file-earmark-text-fill', r: 'bao-gia', c: 'baoGia' },
    { t: 'Đơn bán hàng', i: 'bi-cart-check-fill', r: 'don-ban', c: 'donBan' },
    { t: 'Hợp đồng', i: 'bi-file-earmark-ruled-fill', r: 'hop-dong', c: 'hopDong' },
    { t: 'Phụ lục hợp đồng', i: 'bi-file-earmark-plus-fill', r: 'phu-luc', c: 'phuLuc' },
    { t: 'Biên bản giao hàng', i: 'bi-clipboard-check-fill', r: 'bien-ban-giao', c: 'bienBanGiao' },
    { t: 'Biên bản nghiệm thu', i: 'bi-patch-check-fill', r: 'nghiem-thu', c: 'bienBanNghiemThu' },
    { t: 'Đề nghị thanh toán', i: 'bi-receipt', r: 'de-nghi-tt', c: 'deNghiTT' },

    { sec: 'Thu chi & Công nợ' },
    { t: 'Phiếu thu', i: 'bi-cash-coin', r: 'phieu-thu', c: 'phieuThu' },
    { t: 'Phiếu chi', i: 'bi-cash-stack', r: 'phieu-chi', c: 'phieuChi' },
    { t: 'Công nợ', i: 'bi-journal-bookmark-fill', r: 'cong-no' },
    { t: 'Góp vốn cổ đông', i: 'bi-piggy-bank-fill', r: 'gop-von', c: 'coDong' },

    { sec: 'Báo cáo' },
    { t: 'Kết quả hoạt động kinh doanh', i: 'bi-graph-up-arrow', r: 'kq-kinh-doanh' },
    { t: 'Báo cáo tổng hợp', i: 'bi-bar-chart-line-fill', r: 'bao-cao' },

    { sec: 'Hệ thống' },
    { t: 'Người dùng', i: 'bi-person-badge-fill', r: 'nguoi-dung', c: 'nguoiDung' },
    { t: 'Phân quyền', i: 'bi-shield-lock-fill', r: 'vai-tro', c: 'vaiTro' },
    { t: 'Đơn vị phát hành', i: 'bi-buildings-fill', r: 'don-vi', c: 'donVi' },
    { t: 'Nhân viên', i: 'bi-person-vcard-fill', r: 'nhan-vien', c: 'nhanVien' },
    { t: 'Cài đặt', i: 'bi-gear-fill', r: 'cai-dat' }
];

/* Màn hình khai báo nền và tiện ích quản trị KHÔNG đặt trên thanh điều hướng
   (tránh menu dư) — mở từ màn hình Cài đặt hoặc gõ tên vào ô tìm nhanh.
   Chức năng giữ nguyên, chỉ khác vị trí hiển thị. */
/* Bảy màn hình con của phân hệ Kho — điều hướng bằng thanh hàng ngang trong
   phân hệ, KHÔNG hiện trên thanh dọc; vẫn tìm nhanh được và route giữ nguyên. */
var MENU_KHO = [
    { t: 'Phiếu nhập kho', i: 'bi-box-arrow-in-down-left', r: 'phieu-nhap', c: 'phieuNhap' },
    { t: 'Phiếu xuất kho', i: 'bi-box-arrow-right', r: 'phieu-xuat', c: 'phieuXuat' },
    { t: 'Kiểm kê kho', i: 'bi-clipboard-data', r: 'kiem-ke', c: 'kiemKe' },
    { t: 'Điều chỉnh tồn kho', i: 'bi-sliders2', r: 'dieu-chinh-ton', c: 'dieuChinhKho' },
    { t: 'Báo cáo tồn kho', i: 'bi-boxes', r: 'bao-cao-ton' },
    { t: 'Báo cáo Nhập - Xuất - Tồn', i: 'bi-arrow-left-right', r: 'bao-cao-nxt' },
    { t: 'Lịch sử giao dịch kho', i: 'bi-clock-history', r: 'the-kho' }
];
W.MENU_KHO = MENU_KHO;

var MENU_PHU = [
    { t: 'Đối chiếu giá nội bộ', i: 'bi-sliders', r: 'gia-noi-bo' },
    { t: 'Dự án', i: 'bi-building-fill-gear', r: 'du-an' },
    { t: 'Đơn vị tính', i: 'bi-rulers', r: 'dvt' },
    { t: 'Thuế suất GTGT', i: 'bi-percent', r: 'thue-suat' },
    { t: 'Loại giá', i: 'bi-tags-fill', r: 'loai-gia' },
    { t: 'Điều khoản thanh toán', i: 'bi-file-text-fill', r: 'dieu-khoan-tt' },
    { t: 'Điều khoản giao hàng', i: 'bi-truck-front-fill', r: 'dieu-khoan-gh' },
    { t: 'Loại hợp đồng', i: 'bi-file-earmark-ruled-fill', r: 'loai-hop-dong' },
    { t: 'Người ký', i: 'bi-pen-fill', r: 'nguoi-ky' },
    { t: 'Khoản mục chi', i: 'bi-list-columns-reverse', r: 'khoan-muc-chi' },
    { t: 'Đối chiếu số liệu', i: 'bi-shield-check', r: 'doi-chieu' },
    { t: 'Thông tin kho', i: 'bi-building', r: 'kho' },
    { t: 'Hồ sơ đơn hàng', i: 'bi-diagram-3-fill', r: 'ho-so' },
    { t: 'Nhật ký hệ thống', i: 'bi-clock-history', r: 'nhat-ky' },
    { t: 'Thùng rác', i: 'bi-trash3-fill', r: 'thung-rac' },
    { t: 'Nhập dữ liệu lịch sử', i: 'bi-database-up', r: 'nhap-lich-su' },
    { t: 'Sao lưu & khôi phục dữ liệu', i: 'bi-shield-lock-fill', r: 'sao-luu' }
];
W.MENU = MENU;
W.MENU_PHU = MENU_PHU;

var TIEU_DE = {};
MENU.forEach(function (m) { if (m.r) TIEU_DE[m.r] = m.t; });
MENU_KHO.forEach(function (m) { TIEU_DE[m.r] = m.t; });
MENU_PHU.forEach(function (m) { TIEU_DE[m.r] = m.t; });

function veMenu(cur, loc) {
    var h = '', k = T.kd(loc || ''), cho = [];
    MENU.forEach(function (m) {
        if (m.sec) { cho.push(m); return; }
        var ph = W.Q.theoRoute(m.r);
        if (ph && !W.Q.co(ph.k, 'xem')) return;              // không có quyền xem thì ẩn khỏi menu
        cho.push(m);
    });
    // bỏ tiêu đề nhóm rỗng
    var loaiBo = [];
    cho.forEach(function (m, i) {
        if (!m.sec) return;
        var con = false;
        for (var j = i + 1; j < cho.length && !cho[j].sec; j++) con = true;
        if (!con) loaiBo.push(m);
    });
    cho = cho.filter(function (m) { return loaiBo.indexOf(m) < 0; });
    // khi đang tìm nhanh thì tìm cả các màn hình KHÔNG nằm trên thanh điều hướng:
    // bảy màn hình con của phân hệ Kho và các màn hình khai báo nền
    if (k) {
        var themKho = MENU_KHO.filter(function (m) {
            var p = W.Q.theoRoute(m.r);
            return !p || W.Q.co(p.k, 'xem');
        });
        if (themKho.length) cho = cho.concat([{ sec: 'Kho — chức năng chi tiết' }]).concat(themKho);
        var themPhu = MENU_PHU.filter(function (m) {
            var p = W.Q.theoRoute(m.r);
            return !p || W.Q.co(p.k, 'xem');
        });
        if (themPhu.length) cho = cho.concat([{ sec: 'Khai báo nền & quản trị' }]).concat(themPhu);
    }
    /* Đang đứng ở một màn hình con của Kho thì mục "Kho" trên thanh dọc vẫn
       sáng — người dùng luôn biết mình đang trong phân hệ nào. */
    var trongKho = MENU_KHO.some(function (m) { return m.r === cur; });
    cho.forEach(function (m) {
        if (m.sec) { if (!k) h += '<div class="nav-sec">' + m.sec + '</div>'; return; }
        if (k && T.kd(m.t).indexOf(k) < 0) return;
        var n = m.c ? DB.all(m.c).length : 0;
        var sang = m.r === cur || (m.nhomKho && trongKho);
        h += '<a class="nav-link' + (sang ? ' active' : '') + '" href="#/' + m.r + '" title="' + T.esc(m.t) + '">' +
             '<i class="bi ' + m.i + '"></i><span>' + T.esc(m.t) + '</span>' +
             (m.c ? '<span class="cnt">' + T.num(n, 0) + '</span>' : '') + '</a>';
    });
    if (k && !h) h = '<div class="nav-sec">Không có chức năng phù hợp</div>';
    document.getElementById('nav').innerHTML = h;
}

/* --------------------------------------------------------------- ĐƯỜNG DẪN */
function veCrumb(parts) {
    var h = '<i class="bi bi-house-door"></i><a href="#/trang-chu">Trang chủ</a>';
    (parts || []).forEach(function (p, i) {
        h += '<i class="bi bi-chevron-right"></i>' + (i === parts.length - 1 ? '<b>' + T.esc(p) + '</b>' : T.esc(p));
    });
    document.getElementById('crumb').innerHTML = h;
}
W.crumb = veCrumb;

/* --------------------------------------------------------------- BADGE CÔNG TY */
function veBadge() {
    var c = DB.cty();
    // Sidebar: tên đơn vị đang làm việc — đổi công ty là đổi ngay, không phải đăng nhập lại
    var sb = document.getElementById('sbDonViTen');
    if (sb) {
        sb.innerHTML = (c.logo ? '<img src="' + c.logo + '" alt="">'
                               : '<span class="ini">' + T.esc(c.tat.substr(0, 2).toUpperCase()) + '</span>') +
            '<span class="ellip">' + T.esc(c.ten) + '</span>';
        var box = document.getElementById('sbDonVi');
        if (box) box.title = 'Đơn vị đang làm việc: ' + c.ten + ' — bấm để chuyển sang công ty khác';
    }
    document.getElementById('ctyBadge').innerHTML =
        (c.logo ? '<img src="' + c.logo + '" alt="">' : '<span class="ini">' + T.esc(c.tat.substr(0, 2).toUpperCase()) + '</span>') +
        '<span class="tx"><b>' + T.esc(c.tat) + '</b><span>' + T.esc(c.ten) + '</span></span>' +
        '<i class="bi bi-arrow-left-right" style="font-size:12px;color:var(--brand)"></i>';
    document.getElementById('ctyBadge').title = 'Đơn vị đang làm việc: ' + c.ten + ' — bấm để chuyển';
}
W.veBadge = veBadge;

/* --------------------------------------------------------------- ĐỊNH TUYẾN */
function route() {
    var r = (location.hash || '#/trang-chu').replace('#/', '').split('?')[0] || 'trang-chu';
    var fn = S[r];
    var ws = document.getElementById('ws');
    var ph = W.Q.theoRoute(r);
    if (ph && !W.Q.co(ph.k, 'xem')) {
        ws.innerHTML = '<div class="page"><div class="empty" style="padding-top:80px">' +
            '<i class="bi bi-shield-lock"></i><b>Không có quyền truy cập</b>' +
            'Vai trò <b>' + T.esc(W.Q.vaiTro().ten) + '</b> không được phép xem phân hệ <b>' + T.esc(ph.t) + '</b>.<br>' +
            'Liên hệ quản trị hệ thống để được cấp quyền.</div></div>';
        veCrumb([ph.t, 'Không có quyền']);
        veMenu(r, document.getElementById('timMenu').value);
        veBadge();
        return;
    }
    if (!fn) {
        ws.innerHTML = '<div class="page"><div class="empty" style="padding-top:90px">' +
            '<i class="bi bi-cone-striped"></i><b>Chức năng chưa được cài đặt</b>' +
            'Mã màn hình: ' + T.esc(r) + '</div></div>';
        veCrumb(['Không tìm thấy']);
    } else {
        ws.scrollTop = 0;
        try { fn(ws); } catch (e) {
            ws.innerHTML = '<div class="page"><div class="note r"><i class="bi bi-bug"></i><div><b>Lỗi khi mở màn hình</b><br>' +
                T.esc(e.message) + '</div></div></div>';
            console.error(e);
        }
    }
    /* HỆ MÀU NHẬN DIỆN NÚT ÁP CHO MỌI MÀN HÌNH, KHÔNG TRỪ MÀN HÌNH NÀO.
       Đặt ở bộ định tuyến thay vì trông vào từng màn hình tự gọi: màn hình mới
       viết sau này cũng tự có màu đúng nhóm nghiệp vụ mà không phải nhớ gì. */
    UI.mauNut(ws);
    UI.theoDoiCuon(ws);
    veMenu(r, document.getElementById('timMenu').value);
    veBadge();
    var m = document.querySelector('.nav-link.active');
    if (m) m.scrollIntoView({ block: 'nearest' });
}
W.route = route;
W.go = function (r) {
    if (location.hash === '#/' + r) route(); else location.hash = '#/' + r;
};

/* --------------------------------------------------------------- KHỞI ĐỘNG */
function vaoApp() {
    document.getElementById('manHinhDangNhap').style.display = 'none';
    document.getElementById('shell').classList.remove('hide');
    if (!location.hash) location.hash = '#/trang-chu';
    route();
    /* Bản cài đặt cũ còn logo lưu bằng đường dẫn tệp → đưa hẳn ảnh vào TVERP. */
    if (T.chuyenLogoTep) T.chuyenLogoTep(function (n) {
        if (n) { W.veBadge && W.veBadge(); route(); }
    });
    /* SAO LƯU TỰ ĐỘNG THEO LỊCH — kiểm tra ngay khi vào phần mềm, sau đó kiểm
       lại mỗi giờ để phiên làm việc kéo dài qua ngày vẫn được sao lưu đúng hạn.
       Người dùng chỉ cấu hình một lần, các lần sau hệ thống tự thực hiện. */
    if (T.batLichSaoLuu) T.batLichSaoLuu();
}

/* GHI NHỚ TÊN ĐĂNG NHẬP — chỉ lưu tên đăng nhập trên chính máy này.
   Không lưu mật khẩu, không tự động đăng nhập.                               */
var KHOA_NHO = 'tverp.tenDangNhap';
(function nhoTen() {
    var t = '';
    try { t = localStorage.getItem(KHOA_NHO) || ''; } catch (e) { }
    var oT = document.getElementById('uTen'), oN = document.getElementById('uNho');
    if (t && oT) { oT.value = t; if (oN) oN.checked = true; }
    if (t) { var oM = document.getElementById('uMk'); if (oM) { oM.value = ''; oM.focus(); } }
})();
document.getElementById('uQuen').onclick = function () {
    UI.modal({
        size: 'sm', title: 'Quên mật khẩu',
        body: '<div class="note b"><i class="bi bi-shield-lock"></i><div>' +
            'Vì lý do an toàn, phần mềm không tự gửi lại mật khẩu. ' +
            'Hãy đề nghị <b>Quản trị hệ thống</b> vào <b>Hệ thống → Người dùng</b>, chọn tài khoản của anh/chị ' +
            'rồi bấm <b>Đặt lại mật khẩu</b>. Hệ thống cấp một mật khẩu tạm và bắt buộc đổi ngay ở lần ' +
            'đăng nhập kế tiếp.</div></div>',
        buttons: [{ text: 'Đã hiểu', cls: 'primary', click: function (h) { h.close(); } }]
    });
};

document.getElementById('fLogin').onsubmit = function (e) {
    e.preventDefault();
    var u = document.getElementById('uTen').value.trim(), p = document.getElementById('uMk').value;
    var nd = DB.all('nguoiDung').filter(function (x) { return x.taiKhoan === u; })[0];
    if (!nd || p !== (nd.matKhau || '123456')) {
        UI.toast('err', 'Đăng nhập không thành công', 'Tài khoản hoặc mật khẩu chưa đúng.');
        return;
    }
    if (nd.trangThai === 'Khóa') {
        UI.toast('err', 'Tài khoản đã bị khóa', 'Liên hệ quản trị hệ thống để mở khóa.');
        return;
    }
    DB._user = nd;
    try {
        var nho = document.getElementById('uNho');
        if (nho && nho.checked) localStorage.setItem(KHOA_NHO, u);
        else localStorage.removeItem(KHOA_NHO);
    } catch (e2) { }
    document.getElementById('uMk').value = '';        // không giữ mật khẩu trên màn hình
    nd.lanCuoi = T.now(); DB.save();
    W.veNguoiDung();
    UI.toast('ok', 'Xin chào ' + nd.hoTen, 'Vai trò: ' + W.Q.vaiTro().ten);
    vaoApp();
    // Quản trị vừa đặt lại mật khẩu → bắt buộc người dùng đổi ngay
    if (nd.batDoiMatKhau) {
        setTimeout(function () {
            UI.toast('warn', 'Cần đổi mật khẩu',
                'Mật khẩu của anh/chị vừa được quản trị đặt lại — hãy đổi sang mật khẩu riêng.', 7000);
            if (W.doiMatKhau) W.doiMatKhau(true);
        }, 700);
    }
};

document.getElementById('btnRail').onclick = function () {
    document.body.classList.toggle('rail');
    try { localStorage.setItem('tverp.rail', document.body.classList.contains('rail') ? '1' : '0'); } catch (e) { }
};
document.getElementById('timMenu').oninput = function () {
    veMenu((location.hash || '').replace('#/', ''), this.value);
};
document.getElementById('sbDonVi').onclick = function () { W.chonDonVi(); };
document.getElementById('ctyBadge').onclick = function () { W.chonDonVi(); };
document.getElementById('userChip').onclick = function (e) {
    e.stopPropagation();
    W.menuTaiKhoan();
};
document.getElementById('btnHelp').onclick = function () { W.huongDan(); };

/** Đưa người dùng tới khu vực chọn Đơn vị đang làm việc ở Trang chủ. */
W.chonDonVi = function () {
    W.go('trang-chu');
    setTimeout(function () {
        var p = document.querySelector('.cty-picker');
        if (p) {
            p.scrollIntoView({ behavior: 'smooth', block: 'center' });
            p.style.outline = '2px dashed var(--brand)'; p.style.outlineOffset = '5px';
            setTimeout(function () { p.style.outline = ''; }, 1600);
        }
    }, 120);
};

W.huongDan = function () {
    UI.modal({
        size: 'lg', title: 'Hướng dẫn nhanh',
        body:
        '<div class="note b mb12"><i class="bi bi-info-circle"></i><div><b>Phần mềm Quản lý Bán hàng nội bộ</b> của nhóm EMC • AA • Thái Phong • Tản Viên. ' +
        'Dữ liệu lưu ngay trên máy, đóng trình duyệt mở lại vẫn còn.</div></div>' +
        '<div class="grid2">' +
        '<div class="card"><div class="card-h"><i class="bi bi-diagram-3"></i> Quy trình nghiệp vụ xuyên suốt</div><div class="card-b small">' +
        '<b>Bán hàng:</b> Khách hàng → Báo giá → Đơn bán hàng → Hợp đồng <i>(nếu cần)</i> → ' +
        'Phiếu xuất kho → Biên bản giao hàng → Nghiệm thu → Đề nghị thanh toán → Phiếu thu → Công nợ.<br><br>' +
        '<b>Mua hàng &amp; Kho:</b> Đơn mua hàng → Lô nhập hàng → Phân bổ chi phí → Nhập kho ' +
        '<i>(chỉ bước này mới làm tăng tồn)</i> → Giá vốn bình quân → Bảng giá bán.<br><br>' +
        'Ở mỗi chứng từ có nút <b>“Tạo chứng từ tiếp theo”</b> để chuyển tiếp, và <b>“Hồ sơ liên quan”</b> ' +
        'để xem toàn bộ chuỗi theo Mã giao dịch.' +
        '</div></div>' +
        '<div class="card"><div class="card-h"><i class="bi bi-keyboard"></i> Phím tắt</div><div class="card-b small">' +
        '<div class="row mb8"><kbd>Ctrl</kbd>+<kbd>K</kbd> <span class="muted">Tìm nhanh chức năng</span></div>' +
        '<div class="row mb8"><kbd>Ctrl</kbd>+<kbd>N</kbd> <span class="muted">Thêm mới trên màn hình hiện tại</span></div>' +
        '<div class="row mb8"><kbd>Ctrl</kbd>+<kbd>S</kbd> <span class="muted">Lưu khi đang mở phiếu</span></div>' +
        '<div class="row mb8"><kbd>Ctrl</kbd>+<kbd>↵</kbd> <span class="muted">Lưu ngay khi đang gõ trong ô</span></div>' +
        '<div class="row mb8"><kbd>Ctrl</kbd>+<kbd>P</kbd> <span class="muted">In chứng từ đang chọn</span></div>' +
        '<div class="row mb8"><kbd>Esc</kbd> <span class="muted">Đóng cửa sổ đang mở</span></div>' +
        '<div class="row"><kbd>F1</kbd> <span class="muted">Mở hướng dẫn này</span></div>' +
        '</div></div>' +
        '<div class="card"><div class="card-h"><i class="bi bi-buildings"></i> Đơn vị đang làm việc</div><div class="card-b small">' +
        'Tại <b>Trang chủ</b> chọn 1 trong 4 công ty. Toàn bộ chứng từ tạo mới, số chứng từ, logo và biểu mẫu in ' +
        'sẽ tự đổi theo công ty đó. Góc trên bên phải luôn hiển thị công ty đang thao tác.' +
        '</div></div>' +
        '<div class="card"><div class="card-h"><i class="bi bi-database"></i> Dữ liệu</div><div class="card-b small">' +
        'Bốn công ty dùng chung <b>một cơ sở dữ liệu, một kho, một tồn kho</b>. ' +
        'Doanh thu, giá vốn, lợi nhuận và công nợ được tách riêng theo từng công ty. ' +
        'Vào <b>Hệ thống → Cài đặt &amp; Sao lưu</b> để sao lưu hoặc khôi phục dữ liệu.' +
        '</div></div>' +
        '</div>',
        buttons: [{ text: 'Đã hiểu', cls: 'primary', click: function (h) { h.close(); } }]
    });
};

document.addEventListener('keydown', function (e) {
    if (e.key === 'F1') { e.preventDefault(); W.huongDan(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); document.getElementById('timMenu').focus(); document.getElementById('timMenu').select();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        var b = document.querySelector('[data-them]');
        if (b) { e.preventDefault(); b.click(); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        var s = document.querySelector('.modal-bg:last-of-type [data-mb]:last-child');
        if (s) { e.preventDefault(); s.click(); }
    }
    // Ctrl + Enter cũng lưu — tay đang gõ trong ô nhập không phải rời chuột
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var s2 = document.querySelector('.modal-bg:last-of-type [data-mb]:last-child');
        if (s2) { e.preventDefault(); s2.click(); }
    }
    // Ctrl + P: in chứng từ đang chọn trên danh sách
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        var bi = document.querySelector('[data-in]:not([disabled])');
        if (bi && !document.querySelector('.modal-bg')) { e.preventDefault(); bi.click(); }
    }
});

W.addEventListener('hashchange', route);

/* --------------------------------------------------------------- CHẠY */
DB.load();
try { if (localStorage.getItem('tverp.rail') === '1') document.body.classList.add('rail'); } catch (e) { }
DB._user = DB.all('nguoiDung')[0] || null;
W.veNguoiDung();
veMenu('trang-chu', '');
veBadge();
document.getElementById('uTen').focus();

})(window);

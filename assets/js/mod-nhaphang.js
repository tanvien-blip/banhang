/* ==========================================================================
   TVERP — MODULE NHẬP HÀNG
   --------------------------------------------------------------------------
   MỘT PHÂN HỆ DUY NHẤT cho toàn bộ việc mua hàng đầu vào. Người dùng chỉ làm:

        Tạo mới (hoặc Nhập Excel) → Chọn Nhà cung cấp
        → Nhập danh sách hàng hóa → Lưu

   Sau khi Lưu, hệ thống TỰ LÀM phần còn lại, người dùng không phải thao tác
   thêm bước nào:
        · sinh Phiếu nhập kho
        · cập nhật Tồn kho
        · cập nhật Giá vốn bình quân gia quyền di động
        · cập nhật Công nợ nhà cung cấp

   Bên trong, hệ thống vẫn ghi đủ ba lớp chứng từ của một ERP thương mại
   (Phiếu nhập hàng → Lô nhập → Phiếu nhập kho) để mọi phân hệ khác — Kho,
   Giá vốn, Công nợ, Báo cáo — đọc được đúng như trước. Người dùng KHÔNG phải
   biết và KHÔNG phải thao tác với ba lớp đó.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;

var MOD = 'donMua';                     // dùng chung quyền với phân hệ Mua hàng
var LOAI_NH = ['Mua trong nước', 'Nhập khẩu'];

function nvId() { return (Q.nhanVienCuaToi() || {}).id || ''; }
function nvTen() { return (Q.nhanVienCuaToi() || {}).hoTen || ''; }

/* --------------------------------------------------- TRA CỨU CHỨNG TỪ CON */
/** Lô nhập của một phiếu nhập hàng. */
function loCua(dm) {
    if (!dm) return null;
    if (dm.loNhapId) {
        var l = DB.get('loNhap', dm.loNhapId);
        if (l) return l;
    }
    /* Dữ liệu cũ có thể còn nhiều lô trỏ về một phiếu — lấy lô MỚI NHẤT để không
       bỏ sót, phần dư được dọn khi xóa phiếu. */
    return W.cacLoCuaPhieu(dm).slice(-1)[0] || null;
}
/** Mọi lô nhập đang trỏ về một phiếu nhập hàng — dùng để dọn sạch khi xóa. */
W.cacLoCuaPhieu = function (dm) {
    if (!dm || !dm.id) return [];
    var ds = DB.all('loNhap').filter(function (x) { return x.donMuaId === dm.id; });
    if (dm.loNhapId && !ds.some(function (x) { return x.id === dm.loNhapId; })) {
        var l = DB.get('loNhap', dm.loNhapId);
        if (l) ds.push(l);
    }
    return ds;
};
/** Mọi phiếu nhập kho sinh ra từ một phiếu nhập hàng. */
W.cacPhieuNhapCuaPhieu = function (dm) {
    var ids = {};
    W.cacLoCuaPhieu(dm).forEach(function (l) { ids[l.id] = 1; });
    return DB.all('phieuNhap').filter(function (p) { return ids[p.loNhapId]; });
};
/** Phiếu nhập kho của một phiếu nhập hàng. */
function pnCua(dm) {
    var lo = loCua(dm);
    if (!lo) return null;
    if (lo.phieuNhapId) {
        var p = DB.get('phieuNhap', lo.phieuNhapId);
        if (p && p.trangThai !== 'Đã hủy') return p;
    }
    return DB.all('phieuNhap').filter(function (p) {
        return p.loNhapId === lo.id && p.trangThai !== 'Đã hủy';
    })[0] || null;
}
function daNhapKho(dm) { var p = pnCua(dm); return !!(p && p.trangThai === 'Đã ghi sổ'); }
W.loNhapCuaPhieu = loCua;
W.phieuNhapKhoCuaPhieu = pnCua;

function tienHang(dm) {
    return T.sum(dm.lines || [], function (l) {
        return Math.round((Number(l.soLuong) || 0) * (Number(l.donGia) || 0) *
                          (1 - (Number(l.ckPhanTram) || 0) / 100));
    });
}
function chiPhiVaoGV(ds) {
    return T.sum((ds || []).filter(function (c) { return T.chiPhiVaoGiaVon(c.loai); }),
                 function (c) { return Number(c.soTien) || 0; });
}

/* ==========================================================================
   MÀN HÌNH NHẬP HÀNG
   ========================================================================== */
S['nhap-hang'] = function (host) {
    var qThem = Q.co(MOD, 'them'), qSua = Q.co(MOD, 'sua'), qXoa = Q.co(MOD, 'xoa'),
        qIn = Q.co(MOD, 'in');
    var g;

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Nhập hàng</h2>' +
        '<div class="sub">Quy trình hai bước — lập phiếu trước, kiểm tra xong mới nhập kho</div></div></div>' +
        '<div class="note b mb12"><i class="bi bi-1-circle-fill"></i><div>' +
        '<b>Bước 1 — Lập phiếu.</b> Nhập tay hoặc nhập từ tệp Excel rồi bấm Lưu. Lúc này ' +
        'phần mềm <b>chưa chạm vào số liệu nào</b>: chưa sinh phiếu nhập kho, chưa tăng tồn kho, ' +
        'chưa tính giá vốn, chưa vào Dashboard và báo cáo. Kiểm tra, sửa, xóa, nhập lại thoải mái.<br>' +
        '<b>Bước 2 — Nhập kho.</b> Chọn phiếu rồi bấm <b>Nhập kho</b>. Phần mềm xem trước đúng những ' +
        'gì sắp ghi, xác nhận xong mới sinh phiếu nhập kho, cộng tồn kho, tính giá vốn bình quân, ' +
        'ghi công nợ nhà cung cấp — rồi khóa phiếu lại.</div></div>' +
        '<div id="nhKpi" class="grid4 mb12"></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Mua hàng', 'Nhập hàng']);

    function rows() {
        return T.theoCty(DB.all('donMua')).map(function (d0) {
            var d = T.clone(d0);
            var lo = loCua(d0), pn = pnCua(d0);
            d._tienHang = tienHang(d0);
            d._chiPhi = lo ? chiPhiVaoGV(lo.chiPhi) : 0;
            d._giaVon = lo ? (Number(lo.tongGiaVon) || (d._tienHang + d._chiPhi)) : d._tienHang;
            d._soMa = (d0.lines || []).length;
            d._soLuong = T.sum(d0.lines || [], function (l) { return Number(l.soLuong) || 0; });
            d._pnSo = pn ? pn.so : '';
            d._pnId = pn ? pn.id : '';
            d._daNhap = !!(pn && pn.trangThai === 'Đã ghi sổ');
            d._loSo = lo ? lo.so : '';
            d._loId = lo ? lo.id : '';
            d._ttLo = lo ? (lo.trangThai || 'Chờ kiểm tra') : 'Chờ kiểm tra';
            d._khoa = !!(lo && lo.khoa);
            return d;
        });
    }
    function thuc(r) { return r ? DB.get('donMua', r.id) : null; }
    function chon() { return thuc(g.selected()); }

    var tb = '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Nhập hàng mới</button>' +
        '<button class="btn" data-xl><i class="bi bi-file-earmark-excel"></i> Nhập từ tệp Excel</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-xem disabled><i class="bi bi-eye"></i> Xem</button>' +
        '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
        '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn ok-solid" data-nhapkho disabled title="Ghi tồn kho và tính giá vốn cho phiếu đang chọn"><i class="bi bi-box-arrow-in-down"></i> Nhập kho</button>' +
        '<button class="btn warn" data-thuhoi disabled title="Trả tồn kho và giá vốn về trước khi nhập"><i class="bi bi-arrow-counterclockwise"></i> Thu hồi nhập kho</button>' +
        '<button class="btn" data-pnk disabled><i class="bi bi-box-arrow-in-down-left"></i> Xem phiếu nhập kho</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-mau><i class="bi bi-file-earmark-arrow-down"></i> Tải tệp mẫu</button>' +
        '<button class="btn" data-xuat><i class="bi bi-file-earmark-spreadsheet"></i> Xuất dữ liệu Excel</button>' +
        '<button class="btn" data-lam><i class="bi bi-arrow-clockwise"></i> Làm mới</button>';

    g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: 20, height: 'calc(100vh - 430px)', toolbar: tb,
        sortK: 'ngay', sortD: -1, chon: true,
        search: ['so', 'nhaCungCap', 'soHoaDon', 'ghiChu'],
        emptyTitle: 'Chưa có phiếu nhập hàng nào',
        emptyText: 'Bấm “Nhập hàng mới” để khai tay, hoặc “Nhập từ tệp Excel” để đưa tệp của nhà cung cấp vào.',
        cols: [
            { k: 'so', t: 'Số phiếu', w: 142, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày nhập', w: 104, fmt: 'date' },
            { k: 'nhaCungCap', t: 'Nhà cung cấp', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v || '—') + '</span>' +
                    (r.soHoaDon ? '<div class="small muted">Hóa đơn ' + T.esc(r.soHoaDon) + '</div>' : ''); } },
            { k: 'loai', t: 'Loại', w: 130, r: function (v) { return T.pill(v || 'Mua trong nước'); } },
            { k: '_soMa', t: 'Số mã', w: 74, cls: 'num' },
            { k: '_soLuong', t: 'Tổng SL', w: 92, cls: 'num', r: function (v) { return T.num(v, 2); } },
            { k: '_tienHang', t: 'Tiền hàng', w: 140, cls: 'num', total: true, fmt: 'money' },
            { k: '_chiPhi', t: 'Chi phí vào giá vốn', w: 152, cls: 'num', total: true,
              r: function (v) { return v ? '<span class="pos">' + T.money(v) + '</span>' : '<span class="muted">0</span>'; } },
            { k: 'tongCong', t: 'Phải trả NCC', w: 152, cls: 'num', total: true,
              r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: '_pnSo', t: 'Phiếu nhập kho', w: 158, cls: 'mono', r: function (v, r) {
                return v ? '<span class="link" onclick="event.stopPropagation();W.moChungTu(\'phieuNhap\',\'' +
                            T.esc(r._pnId) + '\')">' + T.esc(v) + '</span>'
                         : '<span class="muted ellip" title="Chưa nhập kho">—</span>'; } },
            { k: '_ttLo', t: 'Trạng thái kho', w: 168, r: function (v, r) {
                return T.pillIco(v) + (r._khoa
                    ? ' <i class="bi bi-lock-fill" title="Đã vào sổ kho — khóa dữ liệu" style="color:var(--ok)"></i>'
                    : ''); } },
            { k: 'trangThai', t: 'Trạng thái mua hàng', w: 168, r: function (v) {
                return T.pillIco(v || 'Đã đặt hàng'); } }
        ],
        filters: [
            { k: '_ttLo', t: 'Trạng thái kho', w: 180, opts: T.TT_LO },
            { k: 'loai', t: 'Loại nhập hàng', w: 170, opts: LOAI_NH },
            { k: 'nhaCungCapId', t: 'Nhà cung cấp', w: 210,
              opts: DB.all('nhaCungCap').map(function (n) { return { v: n.id, t: n.ten }; }) }
        ],
        actions: function () {
            return UI.btn('xem', 'bi-eye', 'Xem phiếu nhập hàng') +
                   (qSua ? UI.btn('sua', 'bi-pencil', 'Sửa') : '');
        }, actionsW: 84,
        onAction: function (a, r) { a === 'sua' ? moSua(thuc(r)) : form(thuc(r), true); },
        onSelect: UI.chonToolbar(host, ['xem', 'sua', 'xoa', 'nhapkho', 'thuhoi', 'pnk']),
        onOpen: function (r) { form(thuc(r), true); }
    });
    UI.apQuyen(host, MOD);
    veKpi();

    function veKpi() {
        var e = host.querySelector('#nhKpi'); if (!e) return;
        var ds = rows();
        var daNhap = ds.filter(function (x) { return x._daNhap; });
        function kp(t, v, c) {
            return '<div class="kpi ' + (c || '') + '"><div class="kpi-t">' + t + '</div>' +
                   '<div class="kpi-v">' + v + '</div></div>';
        }
        e.innerHTML =
            kp('Phiếu nhập hàng', T.num(ds.length)) +
            kp('Chờ nhập kho', T.num(ds.length - daNhap.length), 'y') +
            kp('Đã vào kho', T.num(daNhap.length), 'g') +
            kp('Tổng tiền hàng', T.money(T.sum(ds, function (x) { return x._tienHang; })) + ' đ', 'b') +
            kp('Chi phí vào giá vốn', T.money(T.sum(ds, function (x) { return x._chiPhi; })) + ' đ', 'c');
    }
    function lamMoi() { g.reload(rows()); veKpi(); W.route(); }

    var qs = function (x) { return host.querySelector(x); };
    /* UI.apQuyen GỠ HẲN khỏi màn hình những nút mà vai trò không được dùng, nên
       mọi nút đều phải nối sự kiện có kiểm tra tồn tại — thiếu bước này thì vai
       trò Kế toán, Thủ kho hay Chỉ xem sẽ không mở được màn hình. */
    function noi(sel, fn) { var b = qs(sel); if (b) b.onclick = fn; }
    noi('[data-them]', function () {
        if (!qThem) return UI.thieuQuyen(MOD, 'them');
        form(null);
    });
    noi('[data-xl]', function () {
        if (!qThem) return UI.thieuQuyen(MOD, 'them');
        W.nhapHangTuExcel(function (nhap) { form(nhap); });
    });
    noi('[data-xem]', function () { var r = chon(); if (r) form(r, true); });
    noi('[data-sua]', function () { var r = chon(); if (r) moSua(r); });
    noi('[data-pnk]', function () {
        var r = chon(); if (!r) return;
        var pn = pnCua(r);
        if (!pn) return UI.khongThe('Xem phiếu nhập kho',
            'Phiếu nhập hàng ' + r.so + ' chưa được nhập kho.',
            'Kiểm tra lại dòng hàng và chi phí rồi bấm “Nhập kho” — hệ thống sẽ sinh phiếu nhập kho ngay.');
        W.moChungTu('phieuNhap', pn.id);
    });
    noi('[data-nhapkho]', function () { var r = chon(); if (r) nhapKho(r); });
    noi('[data-thuhoi]', function () { var r = chon(); if (r) thuHoi(r, lamMoi); });
    noi('[data-xoa]', function () { var r = chon(); if (r) xoa(r); });
    noi('[data-lam]', function () {
        g.q = ''; g.f = {}; lamMoi(); UI.toast('info', 'Đã làm mới danh sách');
    });
    noi('[data-mau]', function () { W.tepMauNhapHang(); });
    noi('[data-xuat]', function () {
        UI.xuatExcel('DanhSach_NhapHang', 'Nhập hàng', xlCols(), g.allRows);
    });

    function xlCols() {
        return [{ t: 'Số phiếu', k: 'so', w: 18 }, { t: 'Ngày nhập', k: 'ngay', w: 12 },
                { t: 'Loại', k: 'loai', w: 16 }, { t: 'Nhà cung cấp', k: 'nhaCungCap', w: 28 },
                { t: 'Số hóa đơn', k: 'soHoaDon', w: 18 }, { t: 'Số mã', k: '_soMa', w: 8 },
                { t: 'Tổng số lượng', k: '_soLuong', w: 14 },
                { t: 'Tiền hàng', k: '_tienHang', w: 18 },
                { t: 'Chi phí vào giá vốn', k: '_chiPhi', w: 18 },
                { t: 'Tổng giá vốn', k: '_giaVon', w: 18 },
                { t: 'Thuế GTGT', k: 'vat', w: 16 },
                { t: 'Phải trả NCC', k: 'tongCong', w: 18 },
                { t: 'Phiếu nhập kho', k: '_pnSo', w: 18 },
                { t: 'Người lập', k: 'nguoiLap', w: 20 },
                { t: 'Trạng thái', k: 'trangThai', w: 16 }];
    }

    /* ------------------------------------------------------- SỬA / THU HỒI */
    function moSua(r) {
        if (!qSua) return UI.thieuQuyen(MOD, 'sua');
        if (!r) return;
        if (r.khoa) { UI.daKhoa(r); return form(r, true); }
        if (!daNhapKho(r)) return form(r);
        var pn = pnCua(r);
        var kt = T.kiemTraThuHoiNhap(pn);
        if (!kt.duoc) return UI.khongThe('Sửa phiếu nhập hàng',
            'Phiếu ' + r.so + ' đã vào kho và không thu hồi lại được:',
            kt.loi.join(' ') + ' Hãy lập Phiếu điều chỉnh tồn kho nếu cần chỉnh số liệu.');
        UI.confirm({
            title: 'Sửa phiếu nhập hàng đã vào kho', icon: 'bi-pencil-fill',
            message: 'Phiếu <b>' + T.esc(r.so) + '</b> đã sinh phiếu nhập kho <b>' + T.esc(pn.so) + '</b>.',
            note: 'Tồn kho và giá vốn <b>chỉ thay đổi khi anh bấm Lưu</b>: lúc đó hệ thống thu hồi phiếu ' +
                  'nhập kho cũ, trả tồn kho và giá vốn về đúng như trước khi nhập, rồi đưa lô về ' +
                  '<b>“Chờ nhập kho”</b>. Sửa xong anh <b>bấm “Nhập kho” một lần nữa</b> thì hàng mới ' +
                  'vào kho theo số liệu mới. Bấm Hủy giữa chừng thì mọi số liệu vẫn nguyên như bây giờ. ' +
                  '<b>Không có dữ liệu nào bị mất.</b>',
            okText: 'Mở phiếu để sửa', okIcon: 'bi-pencil',
            ok: function () { form(DB.get('donMua', r.id)); }
        });
    }

    /* ======================================================================
       BƯỚC HAI — NHẬP KHO.
       Đây là lúc DUY NHẤT số liệu của doanh nghiệp thay đổi. Người dùng nhìn
       thấy trước chính xác cái gì sắp xảy ra, rồi mới xác nhận.
       ====================================================================== */
    function nhapKho(r) {
        if (!qSua) return UI.thieuQuyen(MOD, 'sua');
        var lo = loCua(r);
        if (!lo) return UI.khongThe('Nhập kho',
            'Phiếu nhập hàng ' + r.so + ' chưa có lô nhập.',
            'Mở phiếu, kiểm tra dòng hàng rồi bấm Lưu trước.');
        var pnCo = T.phieuNhapCuaLo(lo);
        if (pnCo) return UI.khongThe('Nhập kho',
            'Phiếu nhập hàng ' + r.so + ' đã vào kho rồi — phiếu nhập kho ' + pnCo.so + '.',
            'Muốn sửa thì bấm “Thu hồi nhập kho” trước; hệ thống sẽ trả tồn kho và giá vốn về nguyên trạng.');
        if (!(lo.lines || []).length) return UI.khongThe('Nhập kho',
            'Lô nhập ' + lo.so + ' không có dòng hàng nào.', 'Mở phiếu và thêm dòng hàng trước.');

        /* Tính thử trên BẢN SAO để xem trước — không chạm vào dữ liệu thật. */
        var thu = T.phanBoChiPhi(T.clone(lo));
        var dong = (thu.lines || []).map(function (l) {
            var hh = T.hh(l);
            return { ma: (hh && hh.ma) || l.maHang, model: (hh && hh.model) || l.model || l.maHang,
                     ten: l.tenHang, dvt: l.dvt, sl: Number(l.soLuong) || 0,
                     tonCu: hh ? (Number(hh.ton) || 0) : 0,
                     bqCu: hh ? T.giaVonBQ(hh) : 0,
                     giaLo: Number(l.giaVonLo) || 0 };
        });
        dong.forEach(function (d) {
            d.tonMoi = d.tonCu + d.sl;
            d.bqMoi = d.tonMoi > 0
                ? Math.round((Math.max(0, d.tonCu) * d.bqCu + d.sl * d.giaLo) /
                             (Math.max(0, d.tonCu) + d.sl))
                : d.giaLo;
        });

        UI.modal({
            size: 'lg', title: 'Nhập kho — phiếu ' + r.so,
            sub: 'Xem trước đúng những gì sắp được ghi vào sổ',
            body: '<div class="note y mb12"><i class="bi bi-exclamation-triangle-fill"></i><div>' +
                '<b>Đây là bước làm thay đổi số liệu.</b> Xác nhận xong hệ thống sẽ sinh phiếu nhập kho, ' +
                'cộng tồn kho, tính lại giá vốn bình quân, ghi lịch sử giá vốn và cập nhật Dashboard cùng ' +
                'toàn bộ báo cáo — rồi <b>khóa lô nhập</b> lại. Muốn sửa sau đó phải Thu hồi nhập kho.</div></div>' +
                '<dl class="kv mb12">' +
                '<dt>Lô nhập</dt><dd><b>' + T.esc(lo.so) + '</b> · ' + T.date(lo.ngay) + '</dd>' +
                '<dt>Nhà cung cấp</dt><dd>' + T.esc(lo.nhaCungCap || '—') + '</dd>' +
                '<dt>Tiền hàng</dt><dd>' + T.money(thu.tongTienHang) + ' đ</dd>' +
                '<dt>Chi phí vào giá vốn</dt><dd>' + T.money(thu.tongChiPhi) + ' đ</dd>' +
                '<dt>Tổng giá vốn ghi sổ</dt><dd><b>' + T.money(thu.tongGiaVon) + ' đ</b></dd>' +
                '</dl>' +
                '<div class="tbl-wrap" style="max-height:38vh"><table class="tbl"><thead><tr>' +
                '<th style="width:140px">Model</th><th>Tên hàng</th>' +
                '<th class="num" style="width:88px">SL nhập</th>' +
                '<th class="num" style="width:96px">Tồn hiện tại</th>' +
                '<th class="num" style="width:96px">Tồn sau nhập</th>' +
                '<th class="num" style="width:118px">Giá vốn BQ cũ</th>' +
                '<th class="num" style="width:118px">Giá vốn BQ mới</th></tr></thead><tbody>' +
                dong.map(function (d) {
                    return '<tr><td class="mono">' + T.esc(d.model || '') + '</td>' +
                        '<td><span class="ellip">' + T.esc(d.ten || '') + '</span></td>' +
                        '<td class="num">' + T.num(d.sl, 2) + '</td>' +
                        '<td class="num muted">' + T.num(d.tonCu, 2) + '</td>' +
                        '<td class="num b pos">' + T.num(d.tonMoi, 2) + '</td>' +
                        '<td class="num muted">' + T.money(d.bqCu) + '</td>' +
                        '<td class="num b">' + T.money(d.bqMoi) + '</td></tr>';
                }).join('') + '</tbody></table></div>',
            buttons: [
                { text: 'Để sau', icon: 'bi-x-lg', click: function (h) { h.close(); } },
                { text: 'Nhập kho', cls: 'ok-solid', icon: 'bi-box-arrow-in-down', click: function (h) {
                    var pn = T.nhapKho(DB.get('loNhap', lo.id));
                    if (!pn) { h.close(); lamMoi(); return; }
                    /* Đơn mua chuyển sang "Đã nhận hàng" do chính Engine làm. */
                    h.close(); lamMoi();
                    var cn = T.congNoNCC(lo.nhaCungCapId);
                    UI.toast('ok', 'Đã nhập kho phiếu ' + r.so,
                        'Phiếu nhập kho ' + pn.so + ' · ' + dong.length + ' mặt hàng vào kho · ' +
                        'tổng giá vốn ' + T.money(thu.tongGiaVon) + ' đ · công nợ ' +
                        T.esc(lo.nhaCungCap || '') + ' còn ' + T.money(cn.conLai) + ' đ' +
                        /* NHẬP KHO LÀ ĐÃ TRẢ TIỀN (v18.6.0) — nói thẳng để người
                           dùng không đi lập thêm một phiếu chi cho cùng khoản. */
                        (T.nhapDaTra(pn)
                            ? ' · đã ghi nhận thanh toán ' +
                              T.money(Number(pn.soTienThanhToan) || T.giaTriPhieuNhap(pn)) +
                              ' đ — KHÔNG cần lập phiếu chi cho khoản này'
                            : ''), 11000);
                } }
            ]
        });
    }

    function thuHoi(r, sauKhi) {
        if (!qSua) return UI.thieuQuyen(MOD, 'sua');
        var pn = pnCua(r);
        if (!pn) return UI.khongThe('Thu hồi nhập kho',
            'Phiếu nhập hàng ' + r.so + ' chưa được nhập kho.', 'Không có gì để thu hồi.');
        var kt = T.kiemTraThuHoiNhap(pn);
        if (!kt.duoc) return UI.khongThe('Thu hồi nhập kho',
            'Không thu hồi được phiếu nhập kho ' + pn.so + ':', kt.loi.join(' '));
        UI.confirm({
            title: 'Thu hồi nhập kho', danger: true, icon: 'bi-arrow-counterclockwise',
            message: 'Thu hồi phiếu nhập kho <b>' + T.esc(pn.so) + '</b> của phiếu nhập hàng <b>' + T.esc(r.so) + '</b>?',
            note: 'Tồn kho giảm lại đúng số lượng đã nhập; <b>giá vốn bình quân trở lại đúng giá trị ' +
                  'trước khi nhập</b>. Phiếu nhập hàng vẫn còn nguyên để sửa hoặc nhập kho lại.',
            okText: 'Thu hồi', okIcon: 'bi-arrow-counterclockwise',
            ok: function () {
                if (!T.thuHoiNhapKho(pn))
                    return UI.toast('err', 'Không thu hồi được', 'Số liệu kho đã thay đổi, hãy làm mới danh sách.');
                if (sauKhi) sauKhi();
                UI.toast('ok', 'Đã thu hồi nhập kho', pn.so + ' — tồn kho và giá vốn đã trở lại như trước.');
            }
        });
    }

    function xoa(r) {
        if (!qXoa) return UI.thieuQuyen(MOD, 'xoa');
        if (r.khoa) return UI.daKhoa(r);
        var pn = pnCua(r);
        /* Đã chi tiền cho phiếu này thì không xóa — công nợ và phiếu chi phải
           khớp nhau tuyệt đối. */
        var pc = DB.all('phieuChi').filter(function (x) { return x.donMuaId === r.id; });
        if (pc.length) return UI.khongThe('Xóa phiếu nhập hàng',
            'Phiếu ' + r.so + ' đã có ' + pc.length + ' phiếu chi trả nhà cung cấp: ' +
            pc.map(function (x) { return x.so; }).join(', ') + '.',
            'Xóa hoặc hủy các phiếu chi đó trước, rồi mới xóa phiếu nhập hàng — ' +
            'để công nợ nhà cung cấp luôn khớp với chứng từ.');
        if (pn && pn.trangThai === 'Đã ghi sổ') {
            var kt = T.kiemTraThuHoiNhap(pn);
            if (!kt.duoc) return UI.khongThe('Xóa phiếu nhập hàng',
                'Phiếu ' + r.so + ' đã vào kho và không thu hồi lại được:',
                kt.loi.join(' ') + ' Không xóa được phiếu này để bảo toàn số liệu kho.');
        }
        UI.confirm({
            title: 'Xóa phiếu nhập hàng', danger: true,
            message: 'Xóa phiếu nhập hàng <b>' + T.esc(r.so) + '</b>?',
            note: (pn ? 'Hệ thống <b>thu hồi phiếu nhập kho ' + T.esc(pn.so) + '</b> trước: tồn kho và giá vốn ' +
                        'trở lại đúng như trước khi nhập. ' : '') +
                  'Phiếu nhập hàng và lô nhập đi kèm được chuyển vào <b>Thùng rác</b>, khôi phục được.',
            okText: 'Xóa phiếu', okIcon: 'bi-trash',
            ok: function () {
                if (pn && pn.trangThai === 'Đã ghi sổ' && !T.thuHoiNhapKho(pn))
                    return UI.toast('err', 'Không thu hồi được phiếu nhập kho', 'Chưa xóa gì cả.');
                /* DỌN SẠCH cả chuỗi: mọi phiếu nhập kho và mọi lô nhập đang trỏ
                   về phiếu này, không để lại bản ghi mồ côi nào. */
                W.cacPhieuNhapCuaPhieu(r).forEach(function (p2) {
                    if (p2.trangThai === 'Đã ghi sổ' && p2.id !== (pn && pn.id)) T.thuHoiNhapKho(p2);
                    DB.remove('phieuNhap', p2.id);
                });
                W.cacLoCuaPhieu(r).forEach(function (l2) { DB.remove('loNhap', l2.id); });
                DB.remove('donMua', r.id);
                T.dungTheKho(); DB.save();
                g.selId = null; lamMoi();
                UI.toast('ok', 'Đã xóa phiếu nhập hàng', r.so + ' — xem lại trong Thùng rác nếu cần khôi phục.');
            }
        });
    }

    /* ==================================================================
       BIỂU MẪU NHẬP HÀNG
       ================================================================== */
    function form(rec, ro) {
        var moi = !rec || !rec.id;
        if (!ro) {
            if (moi && !qThem) return UI.thieuQuyen(MOD, 'them');
            if (!moi && !qSua) ro = true;
        }
        var r = rec ? T.clone(rec) : mauTrong();
        var lo = rec && rec.id ? loCua(rec) : null;
        var lines = r.lines || [];
        var chiPhi = r.chiPhi || (lo ? T.clone(lo.chiPhi || []) : []);
        var cachPB = r.cachPhanBo || (lo ? lo.cachPhanBo : '') || 'giaTri';
        var LE = null;

        UI.modal({
            size: 'full', dismiss: false,
            title: (ro ? 'Xem phiếu nhập hàng'
                       : moi ? 'Nhập hàng — phiếu mới' : 'Sửa phiếu nhập hàng') +
                   (!moi && r.so ? ' — ' + r.so : ''),
            sub: 'Đơn vị nhập: ' + DB.cty().ten +
                 (ro ? '' : ' · Bấm Lưu chỉ tạo lô nhập để kiểm tra — hàng chỉ vào kho khi bấm “Nhập kho”'),
            body: '<div id="nhHead"></div>' +
                  '<div class="card mt12"><div class="card-h"><i class="bi bi-list-ul"></i> Danh sách hàng hóa nhập về' +
                  '<span class="spacer"></span><span class="small muted">Đơn giá là GIÁ MUA của nhà cung cấp</span></div>' +
                  '<div class="card-b"><div id="nhLines"></div></div></div>' +
                  '<div class="card mt12"><div class="card-h"><i class="bi bi-cash-stack"></i> Chi phí nhập hàng ' +
                  '<span class="small muted">(không bắt buộc — vận chuyển, thuế nhập khẩu, thông quan…)</span>' +
                  '<span class="spacer"></span><span class="small muted" id="nhCPTong"></span></div>' +
                  '<div class="card-b"><div id="nhChiPhi"></div></div></div>' +
                  '<div class="row mt12" style="align-items:flex-start">' +
                  '<div class="fld" style="width:200px"><label>Thuế suất GTGT (%)</label>' +
                  '<input class="tyle" data-f="vatPct" value="' + T.esc(T.soVe(r.vatPct === undefined ? 10 : r.vatPct, 2)) + '"' +
                  (ro ? ' disabled' : '') + '></div>' +
                  '<div style="flex:1"></div><div id="nhTong"></div></div>',
            buttons: ro
                ? [{ text: 'Đóng', click: function (h) { h.close(); } }]
                    .concat(qIn && rec && rec.id ? [{ text: 'Xem trước khi in', icon: 'bi-printer',
                        click: function () { W.inChungTu('donMua', rec); } }] : [])
                    .concat(qSua && rec && rec.id ? [{ text: 'Sửa', cls: 'primary', icon: 'bi-pencil',
                        click: function (h) { h.close(); moSua(DB.get('donMua', rec.id)); } }] : [])
                : [{ text: 'Hủy', icon: 'bi-x-lg', click: function (h) {
                        UI.confirm({ title: 'Hủy thao tác', message: 'Bỏ qua các thay đổi chưa lưu?',
                            okText: 'Bỏ qua', ok: function () { h.close(); } });
                    } },
                   { text: 'Lưu', cls: 'primary', icon: 'bi-check-lg', click: function (h) { luu(h); } }],
            onOpen: function (h) {
                h.q('#nhHead').innerHTML = khoiDau(r, ro);
                UI.numInput(h.el);
                h._md = W.bindMD(h.el, function () {
                    return { donViId: (h.q('[data-f="donVi"]') || {}).value || r.donVi || DB.data._meta.ctyId,
                             ngay: (h.q('[data-f="ngay"]') || {}).value || T.today() };
                });
                W.bindNguoiLap(h, r, MOD, ro);
                LE = h._LE = new W.LineEditor(h.q('#nhLines'), lines, {
                    readonly: ro, giaMua: true,
                    /* Phiếu nhập hàng KHÔNG hiển thị Mã hàng nội bộ — cột hiển
                       thị là Model của nhà sản xuất. Mã hàng vẫn được hệ thống
                       tự sinh và liên kết ngầm bên dưới (tồn kho, giá vốn…). */
                    cotModel: true,
                    donVi: function () {
                        var e = h.q('[data-f="donVi"]');
                        return (e && e.value) || r.donVi || DB.data._meta.ctyId;
                    },
                    ngay: function () { var e = h.q('[data-f="ngay"]'); return e ? e.value : T.today(); },
                    onChange: function () { veTong(h); }
                });
                veChiPhi(h);
                veTong(h);
                var oV = h.q('[data-f="vatPct"]');
                if (oV) { oV.oninput = function () { veTong(h); }; oV.onchange = function () { veTong(h); }; }
                if (ro) h.el.querySelectorAll('input,select,textarea,button[data-pk],[data-add],[data-pick],[data-clear]')
                    .forEach(function (e) { e.disabled = true; });
            }
        });

        function mauTrong() {
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId,
                     loai: 'Mua trong nước', nhaCungCapId: '', nhaCungCap: '', soHoaDon: '',
                     khoId: (T.khoChinh() || {}).id || '',
                     nguoiLapId: nvId(), nguoiLap: nvTen(),
                     lines: [], chiPhi: [], cachPhanBo: 'giaTri',
                     vatPct: 10, trangThai: 'Nháp', ghiChu: '' };
        }

        function khoiDau(r, ro) {
            return '<div class="grid4">' +
                '<div class="fld"><label>Số phiếu nhập hàng</label>' +
                '<input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"' +
                (ro ? ' disabled' : '') + '></div>' +
                '<div class="fld req"><label>Ngày nhập hàng</label>' +
                '<input type="date" data-f="ngay" value="' + T.esc(r.ngay || T.today()) + '"' + (ro ? ' disabled' : '') + '></div>' +
                '<div class="fld"><label>Công ty nhập</label><select data-f="donVi"' + (ro ? ' disabled' : '') + '>' +
                opt(DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat + ' — ' + d.ten }; }),
                    r.donVi || DB.data._meta.ctyId) + '</select></div>' +
                '<div class="fld"><label>Loại nhập hàng</label><select data-f="loai"' + (ro ? ' disabled' : '') + '>' +
                opt(LOAI_NH, r.loai || 'Mua trong nước') + '</select></div>' +
                W.oMD('nhaCungCap', { f: 'nhaCungCapId', fTen: 'nhaCungCap', gt: r.nhaCungCapId,
                                      gtTen: r.nhaCungCap, rong: true, req: true, ro: ro }) +
                '<div class="fld"><label>Số hóa đơn nhà cung cấp</label>' +
                '<input data-f="soHoaDon" value="' + T.esc(r.soHoaDon || '') + '"' + (ro ? ' disabled' : '') + '></div>' +
                W.oMD('kho', { f: 'khoId', gt: r.khoId || (T.khoChinh() || {}).id || '', nhan: 'Kho nhập', ro: ro }) +
                W.oNguoiLap(r, MOD) +
                '<div class="fld"><label>Cách phân bổ chi phí vào giá vốn</label>' +
                '<select data-f="cachPhanBo"' + (ro ? ' disabled' : '') + '>' +
                opt(T.CACH_PHAN_BO.map(function (x) { return { v: x.k, t: x.t }; }), cachPB) + '</select></div>' +
                '<div class="fld span2"><label>Ghi chú</label>' +
                '<input data-f="ghiChu" value="' + T.esc(r.ghiChu || '') + '"' + (ro ? ' disabled' : '') + '></div>' +
                '</div>';
        }

        /* --------------------------------------------------- CHI PHÍ NHẬP */
        function veChiPhi(h) {
            var e = h.q('#nhChiPhi'); if (!e) return;
            var ds = T.LOAI_CHI_PHI.filter(function (x) { return !x.tuTinh; });
            e.innerHTML =
                (ro ? '' : '<div class="row mb8"><button type="button" class="btn sm primary" data-cpadd>' +
                 '<i class="bi bi-plus-lg"></i> Thêm khoản chi phí</button>' +
                 '<span class="small muted"><i class="bi bi-info-circle"></i> VAT hàng nhập khẩu được khấu trừ nên ' +
                 '<b>không</b> cộng vào giá vốn</span></div>') +
                (chiPhi.length
                    ? '<div class="tablewrap" style="max-height:210px"><table class="lines-tb"><thead><tr>' +
                      '<th style="width:44px" class="ctr">TT</th><th style="width:280px">Loại chi phí</th>' +
                      '<th>Diễn giải</th><th class="num" style="width:150px">Số tiền</th>' +
                      '<th class="num" style="width:140px">Vào giá vốn</th>' + (ro ? '' : '<th style="width:36px"></th>') +
                      '</tr></thead><tbody>' +
                      chiPhi.map(function (c, i) {
                          return '<tr data-ci="' + i + '"><td class="ctr muted">' + (i + 1) + '</td>' +
                              '<td><select data-cp="loai"' + (ro ? ' disabled' : '') + '>' +
                              opt(ds.map(function (x) { return { v: x.k, t: x.t }; }), c.loai || 'khac') + '</select></td>' +
                              '<td><input data-cp="ten" value="' + T.esc(c.ten || '') + '"' + (ro ? ' disabled' : '') + '></td>' +
                              '<td><input class="num tien" data-cp="soTien" value="' + T.esc(T.soVe(c.soTien)) + '"' +
                              (ro ? ' disabled' : '') + '></td>' +
                              '<td class="num ' + (T.chiPhiVaoGiaVon(c.loai) ? 'pos' : 'muted') + '">' +
                              (T.chiPhiVaoGiaVon(c.loai) ? 'Có' : 'Không') + '</td>' +
                              (ro ? '' : '<td class="ctr"><button type="button" class="line-del" data-cpdel title="Xóa khoản"><i class="bi bi-x-lg"></i></button></td>') +
                              '</tr>';
                      }).join('') + '</tbody></table></div>'
                    : '<div class="empty" style="padding:18px"><i class="bi bi-cash-stack"></i>' +
                      '<b>Chưa khai khoản chi phí nào</b>Không bắt buộc — bỏ trống thì giá vốn bằng đúng giá mua.</div>');
            var a = e.querySelector('[data-cpadd]');
            if (a) a.onclick = function () {
                chiPhi.push({ loai: 'vanTaiND', ten: '', soTien: 0 });
                veChiPhi(h); veTong(h);
            };
            e.querySelectorAll('tbody tr[data-ci]').forEach(function (tr) {
                var i = Number(tr.getAttribute('data-ci'));
                tr.querySelectorAll('[data-cp]').forEach(function (inp) {
                    var k = inp.getAttribute('data-cp');
                    var xl = function () {
                        chiPhi[i][k] = k === 'soTien' ? T.so(inp.value) : inp.value;
                        if (k === 'loai') veChiPhi(h);
                        veTong(h);
                    };
                    inp.oninput = xl; inp.onchange = xl;
                });
                var d = tr.querySelector('[data-cpdel]');
                if (d) d.onclick = function () { chiPhi.splice(i, 1); veChiPhi(h); veTong(h); };
            });
            UI.numInput(e);
        }

        function veTong(h) {
            var th = T.sum(lines, function (l) {
                return Math.round((Number(l.soLuong) || 0) * (Number(l.donGia) || 0) *
                                  (1 - (Number(l.ckPhanTram) || 0) / 100));
            });
            var cpGV = chiPhiVaoGV(chiPhi);
            var cpKhac = T.sum(chiPhi, function (c) { return Number(c.soTien) || 0; }) - cpGV;
            var oV = h.q('[data-f="vatPct"]');
            var vp = oV ? (T.so(oV.value) || 0) : 10;
            var vat = Math.round(th * vp / 100);
            var e = h.q('#nhCPTong');
            if (e) e.innerHTML = 'Vào giá vốn: <b>' + T.money(cpGV) + ' đ</b>' +
                (cpKhac ? ' · Không vào giá vốn: <b>' + T.money(cpKhac) + ' đ</b>' : '');
            var o = h.q('#nhTong');
            if (o) o.innerHTML = '<div class="tong-box"><table>' +
                '<tr><td>Tiền hàng:</td><td>' + T.money(th) + ' đ</td></tr>' +
                '<tr><td>Chi phí vào giá vốn:</td><td>' + T.money(cpGV) + ' đ</td></tr>' +
                '<tr><td><b>Tổng giá vốn lô hàng:</b></td><td><b>' + T.money(th + cpGV) + ' đ</b></td></tr>' +
                '<tr><td>Thuế GTGT (' + T.num(vp, 2) + '%):</td><td>' + T.money(vat) + ' đ</td></tr>' +
                '<tr class="big"><td>PHẢI TRẢ NHÀ CUNG CẤP:</td><td>' + T.money(th + vat) + ' đ</td></tr>' +
                '<tr><td colspan="2" class="small muted" style="text-align:right;font-style:italic">' +
                T.docTien(th + vat) + '</td></tr></table></div>';
        }

        /* ------------------------------------------------------------ LƯU */
        function luu(h) {
            if (!UI.validate(h.el, [{ k: 'ngay' }, { k: 'nhaCungCapId', msg: 'Phải chọn nhà cung cấp' },
                                    { k: 'nguoiLapId', msg: 'Phải chọn người lập' }])) return;
            if (!lines.length)
                return UI.toast('err', 'Chưa có hàng hóa', 'Phiếu nhập hàng phải có ít nhất một dòng hàng hóa.');
            /* PHIẾU NHẬP HÀNG KHÔNG SINH MÃ HÀNG. Mặt hàng chưa có trong Danh mục
               sẽ đi qua cửa "Tạo mới mặt hàng" ở bước ghi — Danh mục Hàng hóa mới
               là nơi duy nhất sinh Mã hàng nội bộ. */
            var xau = lines.filter(function (l) {
                return (!l.maHang && !l.model && !l.tenHang) || !(Number(l.soLuong) > 0);
            });
            if (xau.length)
                return UI.toast('err', 'Dòng hàng chưa hợp lệ',
                    'Có ' + xau.length + ' dòng thiếu tên hàng hoặc số lượng ≤ 0. Hãy sửa lại rồi lưu.');
            var v = UI.read(h.el);
            var ncc = DB.get('nhaCungCap', v.nhaCungCapId);
            if (!ncc) return UI.toast('err', 'Nhà cung cấp không hợp lệ', 'Chọn lại nhà cung cấp trong danh mục.');
            var kho = DB.get('kho', v.khoId) || T.khoChinh() || {};
            var vp = T.so(v.vatPct) || 0;

            /* KHÔNG SINH DỮ LIỆU TRÙNG — cùng nhà cung cấp và cùng số hóa đơn là
               cùng một lần nhập hàng. Nhập lại tệp lần thứ hai sẽ cộng tồn kho
               hai lần và làm sai giá vốn bình quân, nên phải chặn ngay tại đây. */
            var soHD = String(v.soHoaDon || '').trim();
            if (soHD) {
                var trung = DB.all('donMua').filter(function (x) {
                    return x.id !== (rec && rec.id) && x.nhaCungCapId === ncc.id &&
                           T.kd(String(x.soHoaDon || '').trim()) === T.kd(soHD);
                })[0];
                if (trung) return UI.khongThe('Lưu phiếu nhập hàng',
                    'Hóa đơn ' + soHD + ' của ' + ncc.ten + ' đã được nhập ở phiếu ' + trung.so + '.',
                    'Mỗi hóa đơn của nhà cung cấp chỉ được nhập MỘT lần — nhập lại sẽ cộng tồn kho ' +
                    'hai lần và làm sai giá vốn bình quân. Mở phiếu ' + trung.so + ' để sửa, ' +
                    'hoặc khai đúng số hóa đơn của lần nhập này.');
            }

            /* CHỐT CỬA AN TOÀN — phiếu đang có phiếu nhập kho còn hiệu lực thì
               phải THU HỒI trước khi ghi lại, nếu không tồn kho sẽ bị cộng hai
               lần. Ở ĐÂY CHỈ KIỂM TRA điều kiện; việc thu hồi thật sự nằm ngay
               trước lúc ghi, sau khi người dùng đã qua cửa "Tạo mới mặt hàng" —
               bỏ ngang giữa chừng thì tồn kho và giá vốn vẫn nguyên vẹn. */
            var pnCu = (rec && rec.id) ? pnCua(DB.get('donMua', rec.id)) : null;
            if (pnCu && pnCu.trangThai === 'Đã ghi sổ') {
                var kt2 = T.kiemTraThuHoiNhap(pnCu);
                if (!kt2.duoc) return UI.khongThe('Lưu phiếu nhập hàng',
                    'Phiếu nhập kho ' + pnCu.so + ' không thu hồi lại được nên không ghi đè được số liệu cũ:',
                    kt2.loi.join(' ') + ' Hãy lập Phiếu điều chỉnh tồn kho nếu cần chỉnh số liệu.');
            }
            /* NHẬP HÀNG KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI DANH MỤC HÀNG HÓA.
               Mặt hàng chưa có trong Danh mục thì hệ thống DỪNG LẠI và hỏi, chứ
               không âm thầm khai thêm Model mới. Mặt hàng đã có thì liên kết
               bằng Mã hàng nội bộ và không đụng gì tới bản ghi gốc. */
            W.dongBoHangHoa(lines, function () { ghi(v, ncc, kho, vp, h); }, null,
                { xacNhan: true, nguon: 'Phiếu nhập hàng' });
        }

        /** Tiền hàng của một dòng — đơn giá gốc trừ chiết khấu, tính MỘT LẦN. */
        function tienDong(l) {
            return Math.round((Number(l.soLuong) || 0) * (Number(l.donGia) || 0) *
                              (1 - (Number(l.ckPhanTram) || 0) / 100));
        }
        /** Đơn giá thực trả cho một đơn vị — dùng để tính giá vốn của lô. */
        function giaThuc(l) {
            var sl = Number(l.soLuong) || 0;
            return sl ? Math.round(tienDong(l) / sl) : 0;
        }

        function ghi(v, ncc, kho, vp, h) {
            /* Thu hồi phiếu nhập kho cũ NGAY TRƯỚC KHI GHI — mọi bước có thể bị
               người dùng bỏ ngang đều đã qua, nên tồn kho chỉ động đúng một lần
               và không bao giờ bị hoàn tác treo lơ lửng. */
            var pnCu2 = (rec && rec.id) ? pnCua(DB.get('donMua', rec.id)) : null;
            if (pnCu2 && pnCu2.trangThai === 'Đã ghi sổ' && !T.thuHoiNhapKho(pnCu2))
                return UI.toast('err', 'Không thu hồi được phiếu nhập kho cũ',
                    'Chưa ghi gì cả. Hãy làm mới danh sách rồi thử lại.');
            var th = T.sum(lines, tienDong);
            var vat = Math.round(th * vp / 100);
            /* ĐƠN GIÁ LƯU LÀ ĐƠN GIÁ GỐC, chiết khấu giữ riêng ở ckPhanTram —
               mở ra sửa rồi lưu lại bao nhiêu lần cũng KHÔNG bị trừ chiết khấu
               chồng lên nhau. Mọi nơi tính tiền đều dùng đúng một công thức. */
            var dsDong = lines.map(function (l) {
                var hh = T.hh(l) || T.nhanDienHangHoa({ ma: l.maHang, model: l.model || l.maHang, ten: l.tenHang }).hh;
                return { hangHoaId: (hh && hh.id) || l.hangHoaId || '',
                         maHang: (hh && hh.ma) || l.maHang, tenHang: l.tenHang, dvt: l.dvt,
                         model: (hh && hh.model) || l.model || '', thongSo: l.thongSo || '',
                         soLuong: Number(l.soLuong) || 0,
                         donGia: Number(l.donGia) || 0,
                         ckPhanTram: Number(l.ckPhanTram) || 0,
                         thanhTien: tienDong(l),
                         ghiChu: l.ghiChu || '' };
            });
            var o = {
                so: v.so || DB.soMoi('DM'), ngay: v.ngay, donVi: v.donVi || DB.data._meta.ctyId,
                loai: v.loai || 'Mua trong nước',
                nhaCungCapId: ncc.id, nhaCungCap: ncc.ten, soHoaDon: v.soHoaDon || '',
                khoId: kho.id || '', ngayNhan: v.ngay,
                nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId),
                cachPhanBo: v.cachPhanBo || 'giaTri',
                chiPhi: T.clone(chiPhi),
                lines: dsDong, vatPct: vp,
                thanhTien: th, vat: vat, tongCong: th + vat,
                /* BƯỚC MỘT KHÔNG ĐỘNG VÀO SỐ LIỆU NÀO. Đơn mua chỉ ở "Đã đặt
                   hàng" cho tới khi hàng thật sự vào kho — để "Đã nhận hàng"
                   ngay lúc lưu là công nợ phải trả tăng lên trong khi hàng chưa
                   hề nhập kho. Engine tự chuyển trạng thái khi bấm NHẬP KHO. */
                trangThai: (rec && rec.trangThai === 'Đã nhận hàng')
                    ? 'Đã nhận hàng' : 'Đã đặt hàng',
                ghiChu: v.ghiChu || ''
            };
            var dm = (rec && rec.id) ? (DB.update('donMua', rec.id, T.gopGiu(DB.get('donMua', rec.id), o)) ||
                                        DB.get('donMua', rec.id))
                                     : DB.insert('donMua', o);

            /* --- LÔ NHẬP: bản ghi kỹ thuật để tính giá vốn, người dùng không thấy --- */
            var lo0 = loCua(dm);
            var loO = {
                so: (lo0 && lo0.so) || DB.soMoi('NK'), ngay: dm.ngay,
                loai: dm.loai === 'Nhập khẩu' ? 'Nhập khẩu' : 'Mua trong nước',
                nhaCungCapId: dm.nhaCungCapId, nhaCungCap: dm.nhaCungCap,
                soHoaDon: dm.soHoaDon || '', ngoaiTe: 'VND', tyGia: 1,
                donMuaId: dm.id, donMuaSo: dm.so, khoId: dm.khoId,
                nguoiLapId: dm.nguoiLapId, nguoiLap: dm.nguoiLap,
                cachPhanBo: dm.cachPhanBo || 'giaTri',
                chiPhi: T.clone(chiPhi), daPhanBo: false,
                trangThai: (lo0 && T.loDaVaoSo(lo0)) ? lo0.trangThai : 'Chờ kiểm tra',
                khoa: !!(lo0 && lo0.khoa),
                ghiChu: 'Nhập hàng theo phiếu ' + dm.so,
                /* Lô nhập dùng ĐƠN GIÁ THỰC TRẢ (đã trừ chiết khấu) vì đó mới là
                   số tiền cấu thành giá vốn. */
                lines: dm.lines.map(function (l) {
                    return { hangHoaId: l.hangHoaId, maHang: l.maHang, tenHang: l.tenHang, dvt: l.dvt,
                             soLuong: Number(l.soLuong) || 0, donGia: giaThuc(l) };
                })
            };
            var lo = lo0 ? (DB.update('loNhap', lo0.id, T.gopGiu(lo0, loO)) || DB.get('loNhap', lo0.id))
                         : DB.insert('loNhap', loO);
            dm.loNhapId = lo.id; dm.loNhapSo = lo.so;

            /* ==================================================================
               BƯỚC MỘT DỪNG Ở ĐÂY.
               Chỉ phân bổ chi phí để người dùng nhìn thấy trước giá vốn dự kiến
               — đó là phép tính trên chính lô, KHÔNG chạm vào kho, không chạm
               vào giá vốn hàng hóa, không sinh phiếu nhập, không vào Dashboard,
               không vào báo cáo. Hàng chỉ vào kho khi người dùng bấm NHẬP KHO.
               ================================================================== */
            T.phanBoChiPhi(lo);
            if (!T.loDaVaoSo(lo)) lo.trangThai = 'Chờ nhập kho';
            DB.save();

            h.close(); lamMoi();
            UI.toast('ok', 'Đã lưu phiếu nhập hàng ' + dm.so,
                dm.lines.length + ' mặt hàng · giá vốn dự kiến ' + T.money(lo.tongGiaVon) + ' đ. ' +
                'HÀNG CHƯA VÀO KHO — kiểm tra lại rồi bấm “Nhập kho” để ghi tồn kho và giá vốn.', 9000);
        }
    }
    W.FORM_CT = W.FORM_CT || {};
    /* Mọi đường mở phiếu từ nơi khác (hồ sơ, bản in, liên kết) đều đi qua đây.
       Muốn SỬA thì phải qua moSua() để kiểm tra khóa chứng từ và điều kiện thu
       hồi nhập kho — không có cửa sau nào mở thẳng biểu mẫu sửa. */
    W.FORM_CT.donMua = function (rec, ro) {
        var live = rec && rec.id ? DB.get('donMua', rec.id) : null;
        if (ro === false) return live ? moSua(live) : form(rec);
        return form(live || rec, true);
    };
    W.__nhapHangForm = form;
    return g;
};

/* ==========================================================================
   NHẬP HÀNG TỪ TỆP EXCEL — KHÔNG CẦN CẤU HÌNH
   --------------------------------------------------------------------------
   Nguyên tắc: ĐƯA TỆP EXCEL CỦA DOANH NGHIỆP VÀO LÀ NHẬP ĐƯỢC.
     · Không bắt doanh nghiệp sửa tệp cho khớp mẫu của TVERP.
     · Không hỏi ánh xạ cột nếu hệ thống tự nhận diện được.
     · Thiếu trường không bắt buộc thì để trống hoặc lấy giá trị mặc định.
     · Chỉ hiển thị NHỮNG DÒNG CÓ LỖI, kèm số dòng · lỗi gì · cách xử lý.
   Tệp chỉ cần có: Mã hàng HOẶC Tên hàng · Số lượng · Đơn giá HOẶC Thành tiền.
   ========================================================================== */
var NHAN_COT = {
    ma:      ['ma hang', 'ma hh', 'ma vat tu', 'ma sp', 'ma san pham', 'model', 'ma model',
              'mahang', 'ma', 'code', 'item code', 'part no', 'part number', 'ma hang hoa',
              'ma thiet bi', 'ky hieu', 'p/n', 'pn'],
    ten:     ['ten hang', 'ten hang hoa', 'ten vat tu', 'ten san pham', 'ten thiet bi', 'dien giai',
              'noi dung', 'mo ta', 'description', 'item name', 'ten', 'ten hh', 'danh muc hang hoa',
              'ten hang hoa dich vu', 'ten hang hoa, dich vu'],
    dvt:     ['dvt', 'don vi', 'don vi tinh', 'dv tinh', 'unit', 'uom', 'don vi tinh (dvt)'],
    soLuong: ['so luong', 'sl', 'quantity', 'qty', 'so luong nhap', 'sl nhap', 'khoi luong',
              'so luong (sl)', 'sluong'],
    donGia:  ['don gia', 'gia', 'unit price', 'price', 'gia mua', 'don gia mua', 'gia nhap',
              'don gia nhap', 'don gia (vnd)', 'don gia vnd', 'dgia'],
    thanhTien: ['thanh tien', 'tong tien', 'amount', 'total', 'tri gia', 'gia tri', 'thanh tien (vnd)',
              'thanh tien vnd', 'tong cong', 'tt'],
    ck:      ['ck', 'chiet khau', 'ck (%)', 'chiet khau (%)', 'discount', '% ck', 'ty le ck'],
    ghiChu:  ['ghi chu', 'note', 'notes', 'remark', 'dien giai them', 'ghichu']
};
/* Cột KHÔNG BAO GIỜ nhận là mã hàng / tên hàng — tránh nhận nhầm cột STT. */
var COT_BO = ['stt', 'tt', 'so tt', 'no', 'no.', 'thu tu', 'số tt'];

function kdc(x) { return W.kdTieuDe ? W.kdTieuDe(x) : String(x || '').toLowerCase().trim(); }

/** Tiêu đề <t> có thuộc nhóm nhãn <ds> không — khớp cả tuyệt đối và một phần. */
function hopNhan(t, ds) {
    var k = kdc(t);
    if (!k) return 0;
    for (var i = 0; i < ds.length; i++) {
        if (k === ds[i]) return 2;                       // khớp tuyệt đối
    }
    for (i = 0; i < ds.length; i++) {
        if (ds[i].length >= 4 && k.indexOf(ds[i]) >= 0) return 1;   // khớp một phần
    }
    return 0;
}

/**
 * TỰ NHẬN DIỆN CỘT của một tệp nhập hàng.
 * Trả về { anhXa, thieu[], laCot[] } — anhXa[k] = chỉ số cột, -1 là chưa có.
 */
W.nhanDienCotNhapHang = function (t) {
    var C = { ma: -1, ten: -1, dvt: -1, soLuong: -1, donGia: -1, thanhTien: -1, ck: -1, ghiChu: -1 };
    var j, k, diem = {};
    Object.keys(C).forEach(function (x) { diem[x] = 0; });
    /* 1) Khớp theo tiêu đề, ưu tiên khớp tuyệt đối hơn khớp một phần. */
    for (j = 0; j < (t.soCot || 0); j++) {
        var ten = (t.ten || [])[j] || '';
        if (!ten) continue;
        if (COT_BO.indexOf(kdc(ten)) >= 0) continue;
        for (k in NHAN_COT) {
            if (!Object.prototype.hasOwnProperty.call(NHAN_COT, k)) continue;
            var d = hopNhan(ten, NHAN_COT[k]);
            if (d > diem[k]) { diem[k] = d; C[k] = j; }
        }
    }
    /* Một cột chỉ giữ đúng MỘT vai trò — vai trò nào khớp mạnh hơn thì giữ. */
    var dung = {};
    ['ma', 'ten', 'dvt', 'soLuong', 'donGia', 'thanhTien', 'ck', 'ghiChu'].forEach(function (k2) {
        if (C[k2] < 0) return;
        var cu = dung[C[k2]];
        if (cu === undefined) { dung[C[k2]] = k2; return; }
        if (diem[k2] > diem[cu]) { C[cu] = -1; dung[C[k2]] = k2; }
        else C[k2] = -1;
    });
    /* 2) Bổ khuyết bằng nội dung dữ liệu: cột số chưa có vai trò được đoán theo
          quan hệ Thành tiền ≈ Số lượng × Đơn giá — không cần người dùng khai. */
    if (C.soLuong < 0 || C.donGia < 0 || C.thanhTien < 0) doanCotSo(t, C);
    /* 3) Không có cột mã nhưng có cột chữ chưa dùng → coi là tên hàng. */
    if (C.ma < 0 && C.ten < 0) {
        for (j = 0; j < (t.soCot || 0); j++) {
            if (daDung(C, j)) continue;
            if (COT_BO.indexOf(kdc((t.ten || [])[j] || '')) >= 0) continue;
            if (kieuCot(t, j) === 'chu') { C.ten = j; break; }
        }
    }
    var thieu = W.thieuCotNhapHang(C);
    return { anhXa: C, thieu: thieu, du: !thieu.length };
};

/**
 * ĐIỀU KIỆN TỐI THIỂU ĐỂ CHO PHÉP IMPORT.
 * Nhận diện được (Model hoặc Mã hàng hoặc Tên hàng) + Số lượng +
 * (Đơn giá hoặc Thành tiền) là đủ. Đơn vị tính thiếu thì hệ thống tự điền,
 * không chặn người dùng vì một cột không mang số liệu tiền.
 */
W.thieuCotNhapHang = function (C) {
    var thieu = [];
    if (!C || ((C.ma < 0 || C.ma === undefined) && (C.ten < 0 || C.ten === undefined)))
        thieu.push('Model hoặc Tên hàng');
    if (!C || !(C.soLuong >= 0)) thieu.push('Số lượng');
    if (!C || (!(C.donGia >= 0) && !(C.thanhTien >= 0))) thieu.push('Đơn giá hoặc Thành tiền');
    return thieu;
};
W.duCotNhapHang = function (C) { return !W.thieuCotNhapHang(C).length; };

function daDung(C, j) {
    var k;
    for (k in C) if (C[k] === j) return true;
    return false;
}
/** Kiểu dữ liệu chủ đạo của một cột: 'so' · 'chu' · 'trong'. */
function kieuCot(t, j) {
    var co = 0, so = 0;
    for (var i = t.hdr + t.cao; i < Math.min(t.hdr + t.cao + 60, t.soDong); i++) {
        var v = t.L[i] ? t.L[i][j] : '';
        if (v === '' || v === undefined || v === null) continue;
        co++;
        if (typeof v === 'number' || /^[\d.,\s]+$/.test(String(v).trim())) so++;
    }
    if (!co) return 'trong';
    return so / co > 0.7 ? 'so' : 'chu';
}
/** Trung bình giá trị số của một cột. */
function cotSo(t, j) {
    var ds = [];
    for (var i = t.hdr + t.cao; i < Math.min(t.hdr + t.cao + 60, t.soDong); i++) {
        var v = t.L[i] ? t.L[i][j] : '';
        if (v === '' || v === undefined || v === null) continue;
        var n = T.so(v);
        if (n > 0) ds.push(n);
    }
    return ds;
}
/**
 * ĐOÁN BỘ BA SỐ LƯỢNG · ĐƠN GIÁ · THÀNH TIỀN theo quan hệ số học.
 * Tệp không ghi rõ tiêu đề vẫn nhận đúng: bộ ba nào thỏa Thành tiền ≈ SL × ĐG
 * trên phần lớn số dòng thì đó chính là ba cột cần tìm.
 */
var TOI_DA_COT_SO = 12;                 // trần cột số đưa vào phép thử bộ ba
function doanCotSo(t, C) {
    var ds = [], j;
    for (j = 0; j < (t.soCot || 0); j++) {
        if (COT_BO.indexOf(kdc((t.ten || [])[j] || '')) >= 0) continue;
        if (kieuCot(t, j) === 'so') ds.push(j);
    }
    /* Tệp dạng ma trận có hàng trăm cột số. Phép thử bộ ba là ba vòng lồng nhau
       nên phải CHẶN TRẦN số cột đưa vào, nếu không trình duyệt sẽ đứng hình.
       Giữ lại những cột có nhiều dữ liệu nhất — đó mới là cột nghiệp vụ. */
    if (ds.length > TOI_DA_COT_SO) {
        ds = ds.map(function (j2) { return { j: j2, n: cotSo(t, j2).length }; })
               .sort(function (x, y) { return y.n - x.n || x.j - y.j; })
               .slice(0, TOI_DA_COT_SO)
               .map(function (x) { return x.j; })
               .sort(function (x, y) { return x - y; });
    }
    if (ds.length < 2) {
        /* Chỉ có một cột số: nếu còn thiếu Số lượng thì đó là Số lượng. */
        if (ds.length === 1 && C.soLuong < 0 && !daDung(C, ds[0])) C.soLuong = ds[0];
        return;
    }
    var tot = null;
    for (var a = 0; a < ds.length; a++)
        for (var b = 0; b < ds.length; b++)
            for (var c = 0; c < ds.length; c++) {
                if (a === b || b === c || a === c) continue;
                var diem = 0, dem = 0;
                for (var i = t.hdr + t.cao; i < Math.min(t.hdr + t.cao + 60, t.soDong); i++) {
                    var sl = T.so(t.L[i] ? t.L[i][ds[a]] : 0),
                        dg = T.so(t.L[i] ? t.L[i][ds[b]] : 0),
                        tt = T.so(t.L[i] ? t.L[i][ds[c]] : 0);
                    if (!(sl > 0) || !(dg > 0) || !(tt > 0)) continue;
                    dem++;
                    if (Math.abs(sl * dg - tt) <= Math.max(1, tt * 0.01)) diem++;
                }
                if (dem >= 2 && diem / dem > 0.7 && (!tot || diem > tot.diem))
                    tot = { sl: ds[a], dg: ds[b], tt: ds[c], diem: diem };
            }
    if (tot) {
        if (C.soLuong < 0) C.soLuong = tot.sl;
        if (C.donGia < 0) C.donGia = tot.dg;
        if (C.thanhTien < 0) C.thanhTien = tot.tt;
        return;
    }
    /* Không tìm được bộ ba: cột số nhỏ nhất là Số lượng, cột lớn nhất là Thành tiền. */
    var tb = ds.map(function (j2) {
        var v = cotSo(t, j2);
        return { j: j2, tb: v.length ? T.sum(v) / v.length : 0 };
    }).filter(function (x) { return x.tb > 0; })
      .sort(function (x, y) { return x.tb - y.tb || x.j - y.j; });
    if (!tb.length) return;
    if (C.soLuong < 0 && !daDung(C, tb[0].j)) C.soLuong = tb[0].j;
    if (C.donGia < 0 && tb.length > 1 && !daDung(C, tb[1].j)) C.donGia = tb[1].j;
    if (C.thanhTien < 0 && tb.length > 2 && !daDung(C, tb[tb.length - 1].j))
        C.thanhTien = tb[tb.length - 1].j;
}

/** Đọc các dòng hàng từ lưới thô theo ánh xạ cột đã nhận diện. */
var TU_TONG = ['tong', 'tong cong', 'cong', 'cong tien', 'tong tien', 'tong so',
               'thanh tien', 'tong gia tri', 'cong khoan muc', 'total', 'sub total',
               'subtotal', 'grand total', 'sum'];

W.docDongNhapHang = function (t, C) {
    var ds = [], loi = [], boQua = 0;
    /* Giá trị THÔ của ô — số phải giữ nguyên kiểu số. Đưa số qua String rồi
       T.so() sẽ hiểu dấu chấm là phân cách nghìn: 10.5 thành 105, 1234.56 thành
       123456. Chữ mới cắt khoảng trắng. */
    function tho(i, j) {
        if (j < 0) return '';
        var v = t.L[i] ? t.L[i][j] : '';
        return v === undefined || v === null ? '' : v;
    }
    function chu(i, j) {
        var v = tho(i, j);
        return v === '' ? '' : String(v).trim();
    }
    function so(i, j) { var v = tho(i, j); return v === '' ? 0 : T.so(v); }
    var d0 = Number(t.dongDau) || 0;
    for (var i = t.hdr + t.cao; i < t.soDong; i++) {
        var ma = chu(i, C.ma), ten = chu(i, C.ten);
        var sl = so(i, C.soLuong), dg = so(i, C.donGia), tt = so(i, C.thanhTien);
        var dongExcel = d0 + i + 1;                        // số dòng đúng như trong Excel
        /* Dòng trống hoàn toàn — bỏ qua, không coi là lỗi. */
        if (!ma && !ten && !sl && !dg && !tt) continue;
        /* DÒNG TỔNG CỘNG của tệp: không có mã hàng, không có số lượng, không có
           đơn giá, và phần chữ đúng là một cụm từ tổng cộng. Đối chiếu TRỌN CỤM
           chứ không so đầu chuỗi — nếu không, mặt hàng thật như “Tổng đài báo
           cháy” hay “Công tắc dòng chảy” sẽ bị bỏ lặng lẽ. */
        var chuTong = kdc(ten || ma);
        if (!ma && !sl && !dg && TU_TONG.indexOf(chuTong) >= 0) { boQua++; continue; }
        var l = { maHang: ma, tenHang: ten, dvt: chu(i, C.dvt) || '',
                  soLuong: sl, donGia: dg, thanhTien: tt,
                  ckPhanTram: C.ck >= 0 ? (so(i, C.ck) || 0) : 0,
                  ghiChu: chu(i, C.ghiChu) || '', _dong: dongExcel };
        /* Thiếu đơn giá mà có thành tiền → tự suy ra, không chặn nhập. */
        if (!(l.donGia > 0) && l.thanhTien > 0 && l.soLuong > 0)
            l.donGia = Math.round(l.thanhTien / l.soLuong);
        /* Thiếu số lượng mà có thành tiền và đơn giá → tự suy ra. */
        if (!(l.soLuong > 0) && l.thanhTien > 0 && l.donGia > 0)
            l.soLuong = Math.round(l.thanhTien / l.donGia * 100) / 100;

        var vd = [];
        if (!ma && !ten) vd.push({ loi: 'Không có Model và cũng không có tên hàng',
                                   xuLy: 'Ghi Model hoặc tên hàng vào dòng này trong tệp Excel rồi nhập lại.' });
        if (!(l.soLuong > 0)) vd.push({ loi: 'Số lượng trống hoặc không lớn hơn 0',
                                        xuLy: 'Ghi số lượng nhập của dòng này. Nếu đây là dòng ghi chú thì xóa khỏi tệp.' });
        if (!(l.donGia > 0)) vd.push({ loi: 'Không có đơn giá và cũng không có thành tiền',
                                       xuLy: 'Ghi đơn giá mua, hoặc ghi thành tiền để hệ thống tự tính đơn giá.' });
        if (vd.length) {
            loi.push({ dong: dongExcel, ma: ma, ten: ten,
                       loi: vd.map(function (x) { return x.loi; }).join('; '),
                       xuLy: vd.map(function (x) { return x.xuLy; }).join(' ') });
            continue;
        }
        if (!l.dvt) l.dvt = 'Cái';                         // giá trị mặc định, không chặn nhập
        if (l.ckPhanTram < 0 || l.ckPhanTram > 100) l.ckPhanTram = 0;
        ds.push(l);
    }
    return { dong: ds, loi: loi, boQua: boQua };
};

/**
 * ĐỌC LƯỚI VÀ TÌM DÒNG TIÊU ĐỀ CHO TỆP NHẬP HÀNG.
 * Bộ tìm tiêu đề dùng chung nhận diện theo từ khóa tiếng Việt. Tệp của nhà cung
 * cấp nước ngoài (Item Code · Description · Qty · Unit Price · Amount) không có
 * từ khóa nào nên phải tìm theo CẤU TRÚC: dòng nào toàn chữ, ngay dưới là các
 * dòng có số — dòng đó chính là tiêu đề. Nhờ vậy tệp tiếng Anh, tệp tiêu đề lạ
 * vẫn nhập được mà doanh nghiệp không phải sửa tệp.
 */
W.luoiNhapHang = function (buf) {
    var t = W.luoiTuTep(buf);
    if (t.hdr >= 0) return t;
    var tot = -1, diem = -1;
    var het = Math.min(t.soDong, 30);
    for (var i = 0; i < het; i++) {
        var chu = 0, so = 0, j;
        for (j = 0; j < t.soCot; j++) {
            var v = t.L[i][j];
            if (v === '' || v === undefined || v === null) continue;
            if (typeof v === 'number' || /^[\d.,\s]+$/.test(String(v).trim())) so++;
            else chu++;
        }
        if (chu < 2 || so > 1) continue;
        /* Dòng ngay dưới phải có dữ liệu thật thì đây mới là tiêu đề. */
        var duoi = 0;
        for (j = 0; j < t.soCot; j++) {
            var v2 = t.L[i + 1] ? t.L[i + 1][j] : '';
            if (v2 !== '' && v2 !== undefined && v2 !== null) duoi++;
        }
        if (duoi < 2) continue;
        if (chu > diem) { diem = chu; tot = i; }
    }
    if (tot < 0) return t;
    t.hdr = tot; t.cao = 1;
    t.ten = [];
    for (var j2 = 0; j2 < t.soCot; j2++) {
        var v3 = t.L[tot][j2];
        t.ten.push(v3 === undefined || v3 === null ? '' : String(v3).trim().replace(/\s+/g, ' '));
    }
    return t;
};

/** Chọn tệp Excel, tự phân tích và mở màn hình xem trước. */
W.nhapHangTuExcel = function (xong) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx,.xlsm,.xls';
    inp.onchange = function () {
        var f = inp.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function (e) {
            var t;
            try { t = W.luoiNhapHang(e.target.result); }
            catch (err) {
                return UI.toast('err', 'Không đọc được tệp',
                    String(err.message || err) + ' — kiểm tra lại tệp rồi thử lại.', 8000);
            }
            if (t.hdr < 0)
                return UI.toast('err', 'Không tìm thấy bảng dữ liệu trong tệp',
                    'Tệp cần có một dòng tiêu đề (Model · Tên hàng · Số lượng · Đơn giá…) rồi đến các dòng hàng.', 9000);
            /* CẤU HÌNH ÁNH XẠ ĐÃ NHỚ — tệp có cùng cấu trúc cột thì nhận ngay
               theo lần chỉnh trước, không hỏi lại lần nào nữa. */
            var chuKy = T.chuKyCauTruc(t.ten || []);
            var mau = T.mauCauTruc(chuKy, '', 'nhapHang');
            if (mau && mau.anhXa) {
                var Cm = T.clone(mau.anhXa);
                if (W.duCotNhapHang(Cm))
                    return xemTruoc(t, Cm, f.name, xong, { chuKy: chuKy, daNho: true });
            }
            var nd = W.nhanDienCotNhapHang(t);
            if (nd.du) return xemTruoc(t, nd.anhXa, f.name, xong, { chuKy: chuKy });
            /* Chỉ hỏi ĐÚNG những cột hệ thống chưa xác định được — hỏi MỘT LẦN,
               lần sau tệp cùng cấu trúc sẽ tự nhận. */
            hoiCotThieu(t, nd, function (C) {
                xemTruoc(t, C, f.name, xong, { chuKy: chuKy });
            });
        };
        fr.readAsArrayBuffer(f);
    };
    inp.click();
};

function hoiCotThieu(t, nd, tiep) {
    var C = nd.anhXa;
    var can = [];
    if (C.ma < 0 && C.ten < 0) can.push({ k: 'ten', t: 'Model hoặc Tên hàng' });
    if (C.soLuong < 0) can.push({ k: 'soLuong', t: 'Số lượng' });
    if (C.donGia < 0 && C.thanhTien < 0) can.push({ k: 'donGia', t: 'Đơn giá hoặc Thành tiền' });
    var cot = [];
    for (var j = 0; j < t.soCot; j++) {
        if (kieuCot(t, j) === 'trong') continue;
        var tenCot = W.tenCotExcel((Number(t.cotDau) || 0) + j);
        cot.push({ j: j, ten: (t.ten || [])[j] || ('Cột ' + tenCot),
                   viDu: viDu(t, j), cot: tenCot });
    }
    UI.modal({
        size: 'lg', dismiss: false,
        title: 'Còn ' + can.length + ' thông tin bắt buộc chưa xác định được',
        sub: 'Hệ thống đã tự nhận diện phần còn lại của tệp — chỉ cần chỉ đúng những cột dưới đây',
        body: '<div class="note r mb12"><i class="bi bi-exclamation-triangle-fill"></i><div>' +
              'Tệp <b>' + T.esc(t.tenSheet || '') + '</b> chưa xác định được: <b>' +
              T.esc(can.map(function (x) { return x.t; }).join(' · ')) + '</b>. ' +
              'Chọn đúng cột tương ứng rồi bấm Tiếp tục.</div></div>' +
              '<div class="tbl-wrap" style="max-height:44vh"><table class="tbl"><thead><tr>' +
              '<th style="width:250px">Thông tin cần</th><th>Lấy từ cột nào trong tệp?</th>' +
              '</tr></thead><tbody>' +
              can.map(function (x) {
                  return '<tr><td><b>' + T.esc(x.t) + '</b></td><td>' +
                      '<select data-can="' + x.k + '"><option value="-1">— Chọn cột —</option>' +
                      cot.map(function (c) {
                          return '<option value="' + c.j + '">' + T.esc(c.cot + ' · ' + c.ten) +
                                 (c.viDu ? ' (VD: ' + T.esc(c.viDu) + ')' : '') + '</option>';
                      }).join('') + '</select></td></tr>';
              }).join('') + '</tbody></table></div>',
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } },
            { text: 'Tiếp tục', cls: 'primary', icon: 'bi-arrow-right', click: function (h) {
                var thieu = [];
                h.el.querySelectorAll('[data-can]').forEach(function (s) {
                    var j2 = Number(s.value);
                    if (!(j2 >= 0)) { thieu.push(s.getAttribute('data-can')); return; }
                    C[s.getAttribute('data-can')] = j2;
                });
                if (thieu.length)
                    return UI.toast('err', 'Chưa chọn đủ cột', 'Hãy chọn cột cho tất cả các mục còn thiếu.');
                h.close(); tiep(C);
            } }
        ]
    });
}
function viDu(t, j) {
    for (var i = t.hdr + t.cao; i < Math.min(t.hdr + t.cao + 8, t.soDong); i++) {
        var v = t.L[i] ? t.L[i][j] : '';
        if (v !== '' && v !== undefined && v !== null) return String(v).substr(0, 26);
    }
    return '';
}

/* ------------------------------------------- XEM TRƯỚC VÀ ĐƯA VÀO PHIẾU */
function xemTruoc(t, C, tenTep, xong, cfg) {
    cfg = cfg || {};
    var kq = W.docDongNhapHang(t, C);
    var ds = kq.dong, loi = kq.loi;
    /* Tổng hiển thị phải tính ĐÚNG NHƯ trên phiếu nhập hàng — có trừ chiết khấu. */
    function tienDongXT(l) {
        return Math.round((Number(l.soLuong) || 0) * (Number(l.donGia) || 0) *
                          (1 - (Number(l.ckPhanTram) || 0) / 100));
    }
    var tong = T.sum(ds, tienDongXT);
    function nhanCot(k) {
        return C[k] >= 0
            ? (W.tenCotExcel((Number(t.cotDau) || 0) + C[k]) + ' · ' + ((t.ten || [])[C[k]] || ''))
            : '';
    }
    var chip = [['ma', 'Model'], ['ten', 'Tên hàng'], ['dvt', 'ĐVT'], ['soLuong', 'Số lượng'],
                ['donGia', 'Đơn giá'], ['thanhTien', 'Thành tiền'], ['ck', 'Chiết khấu'],
                ['ghiChu', 'Ghi chú']]
        .filter(function (x) { return C[x[0]] >= 0; })
        .map(function (x) {
            return '<span class="nd-chip"><b>' + T.esc(x[1]) + '</b> ← ' + T.esc(nhanCot(x[0])) + '</span>';
        }).join('');

    UI.modal({
        size: 'full', dismiss: false,
        title: 'Nhập hàng từ tệp Excel',
        sub: (tenTep || '') + ' · trang ' + (t.tenSheet || '') +
             ' · đọc được ' + T.num(ds.length) + ' dòng hàng' +
             (loi.length ? ' · ' + T.num(loi.length) + ' dòng có lỗi' : '') +
             (kq.boQua ? ' · bỏ qua ' + T.num(kq.boQua) + ' dòng tổng cộng' : ''),
        body: '<div class="note ' + (loi.length ? 'y' : 'g') + ' mb12">' +
              '<i class="bi bi-' + (loi.length ? 'exclamation-triangle-fill' : 'check-circle-fill') + '"></i><div>' +
              (loi.length
                ? '<b>' + T.num(ds.length) + ' dòng hợp lệ</b> sẽ được đưa vào phiếu nhập hàng. ' +
                  '<b>' + T.num(loi.length) + ' dòng có lỗi</b> được liệt kê bên dưới — sửa trong tệp Excel rồi nhập lại nếu cần.'
                : '<b>Tệp đọc được đầy đủ.</b> ' + T.num(ds.length) + ' dòng hàng, tổng tiền hàng <b>' +
                  T.money(tong) + ' đ</b>. Bấm <b>Đưa vào phiếu nhập hàng</b> rồi chọn nhà cung cấp và lưu.') +
              '<div class="mt8">' + chip + '</div>' +
              '<div class="mt8 small">' +
              (cfg.daNho ? '<i class="bi bi-bookmark-check-fill"></i> Nhận theo <b>cấu hình ánh xạ đã nhớ</b> ' +
                           'của tệp cùng cấu trúc — không phải khai lại. '
                         : '<i class="bi bi-magic"></i> Hệ thống tự nhận diện cột từ tiêu đề và dữ liệu của tệp. ') +
              '<button type="button" class="btn sm" id="nhSuaCot"><i class="bi bi-sliders"></i> ' +
              'Chỉnh lại cột</button></div></div>' +
              (loi.length
                ? '<div class="card mb12"><div class="card-h"><i class="bi bi-x-octagon-fill"></i> ' +
                  'Các dòng có lỗi (' + T.num(loi.length) + ')</div>' +
                  '<div class="tbl-wrap" style="max-height:30vh"><table class="tbl"><thead><tr>' +
                  '<th style="width:80px">Dòng</th><th style="width:180px">Mã / Tên trong tệp</th>' +
                  '<th style="width:320px">Lỗi gì</th><th>Cách xử lý</th></tr></thead><tbody>' +
                  loi.slice(0, 300).map(function (x) {
                      return '<tr><td class="ctr mono"><b>' + x.dong + '</b></td>' +
                          '<td class="ellip">' + T.esc(x.ma || x.ten || '—') + '</td>' +
                          '<td class="neg">' + T.esc(x.loi) + '</td>' +
                          '<td class="small">' + T.esc(x.xuLy) + '</td></tr>';
                  }).join('') + '</tbody></table></div>' +
                  (loi.length > 300 ? '<div class="card-b small muted">… và ' + (loi.length - 300) + ' dòng lỗi khác</div>' : '') +
                  '</div>'
                : '') +
              '<div class="card"><div class="card-h"><i class="bi bi-list-check"></i> Dữ liệu sẽ đưa vào phiếu' +
              '<span class="spacer"></span><span class="small muted">Tổng tiền hàng ' + T.money(tong) + ' đ</span></div>' +
              '<div class="tbl-wrap" style="max-height:38vh"><table class="tbl"><thead><tr>' +
              '<th style="width:60px">TT</th><th>Tên hàng hóa</th><th style="width:170px">Model</th>' +
              '<th style="width:70px">ĐVT</th><th class="num" style="width:96px">Số lượng</th>' +
              '<th class="num" style="width:130px">Đơn giá</th><th class="num" style="width:140px">Thành tiền</th>' +
              '</tr></thead><tbody>' +
              ds.slice(0, 500).map(function (l, i) {
                  return '<tr><td class="ctr muted">' + (i + 1) + '</td>' +
                      '<td><span class="ellip">' + T.esc(l.tenHang || '') + '</span></td>' +
                      '<td class="mono">' + T.esc(l.maHang || '—') + '</td>' +
                      '<td class="ctr">' + T.esc(l.dvt) + '</td>' +
                      '<td class="num">' + T.num(l.soLuong, 2) + '</td>' +
                      '<td class="num">' + T.money(l.donGia) + '</td>' +
                      '<td class="num b">' + T.money(tienDongXT(l)) + '</td></tr>';
              }).join('') + '</tbody></table></div>' +
              (ds.length > 500 ? '<div class="card-b small muted">Bảng chỉ hiện 500 dòng đầu — khi nhập sẽ lấy đủ ' +
                                 T.num(ds.length) + ' dòng.</div>' : '') +
              '</div>',
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } },
            { text: 'Đưa vào phiếu nhập hàng', cls: 'primary', icon: 'bi-box-arrow-in-down',
              click: function (h) {
                  if (!ds.length)
                      return UI.toast('err', 'Không có dòng hàng hợp lệ',
                          'Tệp không đọc được dòng nào đủ mã/tên hàng, số lượng và đơn giá. Sửa tệp rồi nhập lại.', 8000);
                  /* Cảnh báo sớm nếu đúng tệp này đã được nhập trước đó — tránh
                     cộng tồn kho hai lần vì nhập nhầm lại cùng một tệp. */
                  var daCo = DB.all('donMua').filter(function (x) {
                      return String(x.ghiChu || '').indexOf('Nhập từ tệp ' + (tenTep || '')) === 0 &&
                             Math.abs((Number(x.thanhTien) || 0) - tong) < 1000;
                  })[0];
                  if (daCo && !cfg.boQuaTrung) {
                      return UI.confirm({
                          title: 'Tệp này đã được nhập trước đó', danger: true, icon: 'bi-files',
                          message: 'Tệp <b>' + T.esc(tenTep || '') + '</b> đã nhập ở phiếu <b>' +
                                   T.esc(daCo.so) + '</b> với cùng tổng tiền hàng.',
                          note: 'Nhập lại sẽ <b>cộng tồn kho hai lần</b> và làm sai giá vốn bình quân. ' +
                                'Chỉ tiếp tục nếu đây thật sự là một lần nhập hàng khác.',
                          okText: 'Vẫn tiếp tục nhập', okIcon: 'bi-exclamation-triangle',
                          ok: function () { cfg.boQuaTrung = true; h.el.querySelector('.modal-f .primary').click(); }
                      });
                  }
                  /* GHI NHỚ CẤU HÌNH ÁNH XẠ khi người dùng ĐỒNG Ý dùng cách đọc
                     này — bấm Hủy thì không ghi nhớ gì, lần sau không bị áp một
                     khuôn sai. */
                  if (cfg.chuKy) {
                      T.ghiNhoCauTruc({ loai: 'nhapHang', chuKy: cfg.chuKy, nhaCungCap: '',
                                        tenCot: (t.ten || []).slice(), anhXa: T.clone(C),
                                        dongTieuDe: t.hdr, caoTieuDe: t.cao,
                                        sheet: t.tenSheet || '', tepCuoi: tenTep || '' });
                      DB.save();
                  }
                  h.close();
                  xong({
                      so: '', ngay: T.today(), donVi: DB.data._meta.ctyId,
                      loai: 'Mua trong nước', nhaCungCapId: '', nhaCungCap: '', soHoaDon: '',
                      khoId: (T.khoChinh() || {}).id || '',
                      nguoiLapId: nvId(), nguoiLap: nvTen(),
                      cachPhanBo: 'giaTri', chiPhi: [], vatPct: 10,
                      trangThai: 'Nháp',
                      ghiChu: 'Nhập từ tệp ' + (tenTep || ''),
                      /* Nhận diện bằng bộ dùng chung của hệ thống: Model + Tên
                         hàng + Thông số. Nhận ra thì liên kết ngay với Mã hàng
                         hiện có; chưa có thì để trống, cửa "Tạo mới mặt hàng"
                         ở bước Lưu sẽ xử lý — tệp KHÔNG sinh mã. */
                      lines: ds.map(function (l) {
                          var kq = T.nhanDienHangHoa({ ma: l.maHang, model: l.maHang, ten: l.tenHang });
                          var hh = kq.hh;
                          return { hangHoaId: hh ? hh.id : '',
                                   maHang: hh ? hh.ma : '',
                                   model: l.maHang || (hh ? hh.model : ''),
                                   tenHang: l.tenHang || (hh ? hh.ten : ''),
                                   dvt: l.dvt || (hh ? hh.dvt : '') || 'Cái',
                                   soLuong: l.soLuong, donGia: l.donGia,
                                   ckPhanTram: l.ckPhanTram || 0, ghiChu: l.ghiChu || '' };
                      })
                  });
                  UI.toast('ok', 'Đã đọc xong tệp',
                      T.num(ds.length) + ' dòng hàng đã vào phiếu. Chọn nhà cung cấp rồi bấm Lưu.', 6000);
              } }
        ],
        onOpen: function (h) {
            var nut = h.q('#nhSuaCot');
            if (nut) nut.onclick = function () {
                h.close();
                /* Bấm Hủy ở màn chỉnh cột thì QUAY LẠI đúng màn xem trước, không
                   vứt bỏ tệp đã đọc. */
                W.anhXaCotNhapHang(t, C, function (C2) {
                    xemTruoc(t, C2, tenTep, xong, { chuKy: cfg.chuKy });
                }, function () {
                    xemTruoc(t, C, tenTep, xong, cfg);
                });
            };
        }
    });
}

/* ==========================================================================
   CHỈNH LẠI ÁNH XẠ CỘT — MỘT LẦN, RỒI HỆ THỐNG NHỚ
   Không bắt người dùng khai từng cột: bảng đã điền sẵn kết quả tự nhận diện,
   chỉ sửa chỗ nào sai. Lưu xong lần sau tệp cùng cấu trúc tự nhận.
   ========================================================================== */
W.anhXaCotNhapHang = function (t, C0, tiep, quayLai) {
    var C = T.clone(C0 || {});
    var VAI = [['ma', 'Model'], ['ten', 'Tên hàng hóa'], ['dvt', 'Đơn vị tính'],
               ['soLuong', 'Số lượng'], ['donGia', 'Đơn giá'], ['thanhTien', 'Thành tiền'],
               ['ck', 'Chiết khấu (%)'], ['ghiChu', 'Ghi chú']];
    var cot = [];
    for (var j = 0; j < t.soCot; j++) {
        if (kieuCot(t, j) === 'trong') continue;
        cot.push({ j: j, ten: (t.ten || [])[j] || ('Cột ' + W.tenCotExcel((Number(t.cotDau) || 0) + j)),
                   viDu: viDu(t, j), cot: W.tenCotExcel((Number(t.cotDau) || 0) + j) });
    }
    UI.modal({
        size: 'lg', dismiss: false,
        title: 'Cấu hình cột của tệp nhập hàng',
        sub: 'Đã điền sẵn kết quả tự nhận diện — chỉ sửa chỗ nào chưa đúng. Lưu xong lần sau tự nhận.',
        body: '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
              'Chỉ cần có <b>Mã hàng · Model hoặc Tên hàng</b>, <b>Số lượng</b> và ' +
              '<b>Đơn giá hoặc Thành tiền</b> là nhập được. Đơn vị tính thiếu thì hệ thống tự điền.' +
              '</div></div>' +
              '<div class="tbl-wrap" style="max-height:46vh"><table class="tbl"><thead><tr>' +
              '<th style="width:230px">Thông tin</th><th>Lấy từ cột nào trong tệp?</th>' +
              '</tr></thead><tbody>' +
              VAI.map(function (x) {
                  return '<tr><td><b>' + T.esc(x[1]) + '</b></td><td>' +
                      '<select data-vai="' + x[0] + '"><option value="-1">— Không có —</option>' +
                      cot.map(function (c) {
                          return '<option value="' + c.j + '"' + (C[x[0]] === c.j ? ' selected' : '') + '>' +
                              T.esc(c.cot + ' · ' + c.ten) +
                              (c.viDu ? ' (VD: ' + T.esc(c.viDu) + ')' : '') + '</option>';
                      }).join('') + '</select></td></tr>';
              }).join('') + '</tbody></table></div>',
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); if (quayLai) quayLai(); } },
            { text: 'Lưu cấu hình và xem lại', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                var moi = {}, dung = {}, trung = false;
                h.el.querySelectorAll('[data-vai]').forEach(function (e) {
                    var v = Number(e.value);
                    moi[e.getAttribute('data-vai')] = v >= 0 ? v : -1;
                    if (v >= 0) { if (dung[v]) trung = true; dung[v] = 1; }
                });
                if (trung) return UI.toast('err', 'Một cột được gán cho hai thông tin',
                    'Mỗi cột của tệp chỉ được dùng cho một thông tin. Chọn lại rồi lưu.', 7000);
                var thieu = W.thieuCotNhapHang(moi);
                if (thieu.length) return UI.toast('err', 'Còn thiếu thông tin bắt buộc',
                    'Chưa chọn cột cho: ' + thieu.join(' · ') + '.', 7000);
                h.close(); tiep(moi);
            } }
        ]
    });
};

/* ==========================================================================
   TỆP MẪU NHẬP HÀNG
   ========================================================================== */
W.tepMauNhapHang = function () {
    W.tepMauNhap({
        ten: 'Nhập hàng', file: 'NhapHang',
        cols: [
            { t: 'Model', k: 'ma', w: 20, bat: true },
            { t: 'Tên hàng hóa', k: 'ten', w: 42 },
            { t: 'ĐVT', k: 'dvt', w: 10 },
            { t: 'Số lượng', k: 'sl', w: 12, bat: true },
            { t: 'Đơn giá', k: 'dg', w: 16, bat: true },
            { t: 'Thành tiền', k: 'tt', w: 18 },
            { t: 'Ghi chú', k: 'gc', w: 30 }
        ],
        mau: [
            { ma: 'SJ-SD-01', ten: 'Đầu báo khói quang điện', dvt: 'Cái', sl: 100, dg: 185000, tt: 18500000, gc: '' },
            { ma: 'SJ-HD-02', ten: 'Đầu báo nhiệt gia tăng', dvt: 'Cái', sl: 50, dg: 165000, tt: 8250000, gc: '' }
        ]
    });
};

})(window);

/* ==========================================================================
   TVERP — DANH MỤC
   Khách hàng · Nhà cung cấp · Hàng hóa · Bảng giá · Kho hàng
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, S = W.SCREEN = W.SCREEN || {};

/* ==========================================================================
   BỘ KHUNG MÀN HÌNH DANH MỤC (dùng chung cho mọi danh mục)
   ========================================================================== */
W.CRUD = function (host, cfg) {
    var g, Q = W.Q, mod = cfg.mod || cfg.coll;
    var qThem = Q.co(mod, 'them'), qSua = Q.co(mod, 'sua'), qXoa = Q.co(mod, 'xoa');
    host.innerHTML =
        '<div class="page">' +
          '<div class="page-head"><div><h2>' + T.esc(cfg.title) + '</h2>' +
          '<div class="sub">' + cfg.sub + '</div></div>' +
          '<div class="spacer"></div>' + (cfg.headExtra || '') + '</div>' +
          (cfg.banner || '') +
          '<div id="gh"></div>' +
        '</div>';
    W.crumb(cfg.crumb || [cfg.title]);

    var tb =
        '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Thêm mới</button>' +
        '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
        '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
        (cfg.copy === false ? '' : '<button class="btn" data-chep disabled><i class="bi bi-files"></i> Sao chép</button>') +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-mau><i class="bi bi-file-earmark-arrow-down"></i> Tải tệp mẫu</button>' +
        '<button class="btn" data-nhap><i class="bi bi-upload"></i> Nhập Excel</button>' +
        '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
        '<button class="btn" data-in title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel"><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo danh sách</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-lam><i class="bi bi-arrow-clockwise"></i> Làm mới</button>' +
        (cfg.tbExtra || '');

    g = new UI.Grid({
        mount: '#gh', rows: cfg.rows(), cols: cfg.cols, filters: cfg.filters, search: cfg.search,
        luoi: cfg.coll,
        pageSize: cfg.pageSize || DB.data._meta.pageSize || 25, sortK: cfg.sortK,
        height: cfg.height || (cfg.banner ? 'calc(100vh - 356px)' : 'calc(100vh - 302px)'),
        toolbar: tb, emptyTitle: cfg.emptyTitle, emptyText: cfg.emptyText, chon: true,
        actions: cfg.actions || function (r) {
            return UI.btn('xem', 'bi-eye', 'Xem chi tiết') +
                   (qSua ? UI.btn('sua', 'bi-pencil', 'Sửa') : '') +
                   (qXoa ? UI.btn('xoa', 'bi-trash', 'Xóa', 'danger') : '');
        },
        onAction: function (a, r) {
            if (a === 'sua') form(r);
            else if (a === 'xoa') xoa(r);
            else if (a === 'xem') (cfg.xem || form)(r, true);
            else if (cfg.onAction) cfg.onAction(a, r, g);
        },
        onSelect: UI.chonToolbar(host, ['sua', 'xoa', 'chep', 'xem'].concat(cfg.nutChon || []),
                                 cfg.onSelect),
        onOpen: function (r) { (cfg.xem || form)(r, true); }
    });
    W.__grid = g;
    UI.apQuyen(host, mod);
    W.hangLoat(host, g, {
        mod: mod, coll: cfg.coll, dt: cfg.title, file: cfg.file, excel: cfg.excel,
        trangThai: cfg.trangThaiDS, suaTruong: cfg.suaHangLoat, rows: cfg.rows,
        email: cfg.coll === 'khachHang' || cfg.coll === 'nhaCungCap'
    });

    function bind() {
        var q = function (s) { return host.querySelector(s); };
        if (q('[data-them]')) q('[data-them]').onclick = function () { form(null); };
        if (q('[data-sua]')) q('[data-sua]').onclick = function () { var r = g.selected(); if (r) form(r); };
        if (q('[data-xoa]')) q('[data-xoa]').onclick = function () { var r = g.selected(); if (r) xoa(r); };
        if (q('[data-chep]')) q('[data-chep]').onclick = function () {
            var r = g.selected(); if (!r) return;
            var c = T.clone(r); delete c.id;
            /* Mã hàng và số hiệu nội bộ do hệ thống cấp — bản sao nhận mã mới,
               không bao giờ chép lại mã của bản gốc. */
            if (cfg.coll === 'hangHoa') { c.ma = ''; c.maNoiBo = ''; }
            else if (c.ma) c.ma = c.ma + '-C';
            if (c.so) c.so = '';
            form(c, false, true);
        };
        q('[data-lam]').onclick = function () {
            g.q = ''; g.f = {}; g.page = 1; g.reload(cfg.rows());
            UI.toast('info', 'Đã làm mới danh sách', T.num(cfg.rows().length, 0) + ' bản ghi');
        };
        if (q('[data-xuat]')) q('[data-xuat]').onclick = function () {
            UI.xuatExcel(cfg.file || 'DanhSach', cfg.title, cfg.excel, g.allRows);
        };
        if (q('[data-in]')) q('[data-in]').onclick = function () { inDanhSach(); };
        /* Cột nhập khai riêng (nhapCot) — tệp mẫu tự sinh theo đúng cấu trúc dữ liệu
           hiện tại của phân hệ; nếu chưa khai thì dùng lại cột xuất dữ liệu. */
        function cotNhapDM() { return cfg.nhapCot ? cfg.nhapCot() : cfg.excel; }
        function mauNhapDM() {
            var ds = g.allRows.slice(0, 3);
            return cfg.nhapMau ? ds.map(cfg.nhapMau) : ds;
        }
        if (q('[data-mau]')) q('[data-mau]').onclick = function () {
            W.tepMauNhap({ ten: cfg.title, file: cfg.file || 'DanhSach',
                           cols: cotNhapDM(), mau: mauNhapDM() });
        };
        if (q('[data-nhap]')) q('[data-nhap]').onclick = function () {
            W.nhapDuLieu({
                ten: cfg.title, file: cfg.file || 'DanhSach', cols: cotNhapDM(),
                mau: mauNhapDM(),
                kiemTra: function (r, i, da) {
                    // Cách khai mới: nhapDong(kt, r, daGap) → bản ghi, lỗi nằm trong kt.loi
                    if (cfg.nhapDong) {
                        var kt = W.KT(r), ob = null;
                        try { ob = cfg.nhapDong(kt, r, da, i); }
                        catch (e) {
                            kt.them('', 'không đọc được dòng: ' + (e.message || e),
                                'Kiểm tra lại các ô của dòng này rồi bấm Kiểm tra dữ liệu.');
                        }
                        /* Cảnh báo phải được đưa lên màn hình xem trước để người
                           dùng biết dòng nào sẽ tạo mới, dòng nào cập nhật lại
                           mặt hàng đã có — trước đây cảnh báo bị bỏ mất. */
                        return { o: kt.co() ? null : ob, loi: kt.loi, canhBao: kt.canhBao };
                    }
                    var o = null, loi = [];
                    try { o = cfg.fromExcel ? cfg.fromExcel(r) : null; }
                    catch (e) { loi.push('không đọc được: ' + (e.message || e)); }
                    if (!o) { if (!loi.length) loi.push('thiếu dữ liệu bắt buộc'); return { o: null, loi: loi }; }
                    if (cfg.kiemDong) loi = loi.concat(cfg.kiemDong(o, da) || []);
                    /* Mã là khóa nghiệp vụ của khách hàng, nhà cung cấp, kho…
                       nên trùng mã là lỗi. Riêng HÀNG HÓA thì Mã hàng chính là
                       Model của nhà sản xuất và ĐƯỢC PHÉP TRÙNG — danh mục nào
                       khai maTrungDuoc thì bỏ hẳn phép kiểm này. */
                    if (o.ma && !cfg.maTrungDuoc) {
                        if (da[o.ma]) loi.push('trùng mã "' + o.ma + '" với dòng trước trong tệp');
                        else if (DB.all(cfg.coll).some(function (x) { return x.ma === o.ma; }))
                            loi.push('mã "' + o.ma + '" đã có trong danh mục');
                        da[o.ma] = 1;
                    }
                    return { o: o, loi: loi };
                },
                ghi: cfg.ghiDong || function (o) { DB.insert(cfg.coll, o); },
                xong: function () { g.reload(cfg.rows()); W.route(); }
            });
        };
        (cfg.bind || function () { })(host, g);
    }

    function inDanhSach() {
        W.inBaoCao({
            tieu: cfg.printTitle || ('DANH SÁCH ' + cfg.title.toUpperCase()),
            phu: cfg.sub || '',
            thoiDiem: T.today(),
            dieuKien: [
                { t: 'Điều kiện lọc', v: moTaLoc() },
                { t: 'Sắp xếp theo', v: g.sortK ? (tenCot(g.sortK) + (g.sortD < 0 ? ' (giảm dần)' : ' (tăng dần)')) : 'Mặc định' }
            ],
            cols: (cfg.excel || []).filter(function (c) { return !c.an; }),
            rows: g.allRows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'ĐẠI DIỆN ĐƠN VỊ'
        });
    }
    function moTaLoc() {
        var ds = [];
        if (g.q) ds.push('từ khóa "' + g.q + '"');
        Object.keys(g.f || {}).forEach(function (k) {
            if (g.f[k] === '' || g.f[k] === undefined) return;
            ds.push(tenCot(k) + ' = ' + g.f[k]);
        });
        return ds.length ? ds.join(' · ') : 'Không lọc — in toàn bộ danh sách';
    }
    function tenCot(k) {
        var c = (cfg.cols || []).filter(function (x) { return x.k === k; })[0] ||
                (cfg.filters || []).filter(function (x) { return x.k === k; })[0];
        return c ? c.t : k;
    }

    /* Xóa theo CHUẨN CHUNG: nút luôn bấm được, hệ thống tự rà soát liên kết dữ
       liệu rồi hoặc xóa, hoặc nêu rõ phân hệ nào đang dùng và cần làm gì. */
    function xoa(r) {
        UI.xoaChuan({
            coll: cfg.coll, rec: r, mod: mod,
            ten: cfg.ten ? cfg.ten(r) : (r.ten || r.ma || r.so),
            truocKhi: cfg.beforeDelete,
            sauKhi: function () { g.selId = null; g.reload(cfg.rows()); W.route(); }
        });
    }

    function form(rec, readonly, isCopy) {
        var moi = !rec || !rec.id;
        if (!readonly) {
            if (moi && !qThem) return UI.thieuQuyen(mod, 'them');
            if (moi && cfg.beforeAdd && !cfg.beforeAdd()) return;
            if (!moi && !qSua) { readonly = true; }
        }
        UI.modal({
            size: cfg.formSize || 'lg',
            title: readonly ? (cfg.title + ' — Xem chi tiết') : (moi ? 'Thêm mới ' + cfg.title.toLowerCase() : 'Sửa ' + cfg.title.toLowerCase()),
            sub: readonly ? '' : (moi ? 'Nhập thông tin rồi bấm Lưu' : (rec.ma || rec.ten || '')),
            body: cfg.form(rec || {}, moi, readonly),
            buttons: readonly ? ([{ text: 'Đóng', click: function (h) { h.close(); } }].concat(
                qSua ? [{ text: 'Sửa bản ghi này', cls: 'primary', icon: 'bi-pencil',
                          click: function (h) { h.close(); form(rec); } }] : [])
            ) : [
                { text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } },
                { text: 'Lưu', cls: 'primary', icon: 'bi-check-lg', click: function (h) { luu(h, rec, moi, isCopy); } }
            ],
            onOpen: function (h) {
                UI.numInput(h.el);
                /* Ô chọn Master Data dùng chung trong biểu mẫu danh mục. */
                if (W.bindMD) h._md = W.bindMD(h.el, {});
                if (cfg.onForm) cfg.onForm(h, rec || {}, moi, readonly);
                if (readonly) h.el.querySelectorAll('input,select,textarea').forEach(function (e) { e.disabled = true; });
            }
        });
    }

    function luu(h, rec, moi, isCopy) {
        if (!UI.validate(h.el, cfg.rules)) return;
        var v = UI.read(h.el);
        var o = cfg.toObj(v, rec || {}, h);
        /* truocLuu — chốt nghiệp vụ riêng của từng danh mục (ví dụ kiểm tra
           trùng khách hàng). Trả về false là DỪNG, danh mục tự xử lý tiếp. */
        if (cfg.truocLuu && cfg.truocLuu(o, rec, h) === false) return;
        if (cfg.check) { var msg = cfg.check(o, rec); if (msg) { UI.toast('err', 'Không lưu được', msg); return; } }
        if (moi || isCopy) DB.insert(cfg.coll, o); else DB.update(cfg.coll, rec.id, o);
        h.close();
        g.reload(cfg.rows()); W.route();
        UI.toast('ok', moi ? 'Đã thêm mới' : 'Đã cập nhật', cfg.ten ? cfg.ten(o) : (o.ten || o.ma || ''));
    }

    bind();
    W.__form = form;
    return g;
};

/* ==========================================================================
   KHÁCH HÀNG — Customer Master Data
   Màn hình và toàn bộ nghiệp vụ khách hàng nằm ở tệp riêng mod-khachhang.js
   vì đây là dữ liệu nền của cả hệ thống: hai bộ trường doanh nghiệp / cá nhân,
   tra cứu mã số thuế trực tuyến, nhập hàng loạt và kiểm tra trùng.
   ========================================================================== */

function kpiMini(l, v, u, c) {
    return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div><div class="vl" style="font-size:17px">' +
        v + (u ? ' <span style="font-size:12px;font-weight:400">' + u + '</span>' : '') + '</div></div>';
}
function opt(arr, cur) {
    return arr.map(function (x) {
        var v = typeof x === 'object' ? x.v : x, t = typeof x === 'object' ? x.t : x;
        return '<option value="' + T.esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + T.esc(t) + '</option>';
    }).join('');
}
W.opt = opt;
function nextMa(coll, pre) {
    var n = 0;
    DB.all(coll).forEach(function (x) {
        var m = /(\d+)$/.exec(x.ma || '');
        if (m) n = Math.max(n, Number(m[1]));
    });
    return pre + ('000' + (n + 1)).slice(-4);
}
W.nextMa = nextMa;

/* ==========================================================================
   NHÀ CUNG CẤP
   ========================================================================== */
S['nha-cung-cap'] = function (host) {
    W.CRUD(host, {
        title: 'Nhà cung cấp', coll: 'nhaCungCap', file: 'DanhSach_NhaCungCap',
        trangThaiDS: ['Đang giao dịch', 'Ngừng giao dịch'],
        suaHangLoat: [
            { k: 'trangThai', t: 'Trạng thái', type: 'select', opts: ['Đang giao dịch', 'Ngừng giao dịch'] },
            { k: 'nhomHang', t: 'Nhóm hàng cung cấp', type: 'text' },
            { k: 'dieuKhoanTT', t: 'Điều khoản thanh toán', type: 'text' }
        ],
        sub: 'Đối tác cung cấp hàng hóa đầu vào', crumb: ['Danh mục', 'Nhà cung cấp'],
        search: ['ma', 'ten', 'nhomHang', 'dienThoai'],
        rows: function () { return DB.all('nhaCungCap'); },
        cols: [
            { k: 'ma', t: 'Mã NCC', w: 100, cls: 'mono' },
            { k: 'ten', t: 'Tên nhà cung cấp', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'nhomHang', t: 'Nhóm hàng cung cấp' },
            { k: 'dienThoai', t: 'Điện thoại', w: 120 },
            { k: 'dieuKhoanTT', t: 'Điều khoản TT', w: 160 },
            { k: 'mst', t: 'Mã số thuế', w: 128, cls: 'mono',
              r: function (v) { return v ? T.esc(v) : '<span class="muted">—</span>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 130, r: function (v) { return T.pill(v); } }
        ],
        filters: [{ k: 'trangThai', t: 'Trạng thái', opts: ['Đang giao dịch', 'Ngừng giao dịch'] }],
        excel: [
            { t: 'Mã NCC', k: 'ma' }, { t: 'Tên nhà cung cấp', k: 'ten', w: 40 }, { t: 'Mã số thuế', k: 'mst' },
            { t: 'Địa chỉ', k: 'diaChi', w: 34 }, { t: 'Điện thoại', k: 'dienThoai' }, { t: 'Thư điện tử', k: 'email' },
            { t: 'Nhóm hàng', k: 'nhomHang', w: 22 }, { t: 'Điều khoản TT', k: 'dieuKhoanTT', w: 22 },
            { t: 'Trạng thái', k: 'trangThai' }
        ],
        nhapCot: function () {
            return [
                { t: 'Mã nhà cung cấp', k: 'ma', w: 16, req: true, kieu: 'Chữ',
                  mo: 'Mã dùng để đối chiếu khi nhập lô hàng nhập khẩu' },
                { t: 'Tên nhà cung cấp', k: 'ten', w: 46, req: true, kieu: 'Chữ' },
                { t: 'Địa chỉ', k: 'diaChi', w: 40, kieu: 'Chữ' },
                { t: 'Mã số thuế', k: 'mst', w: 16, kieu: 'Chữ' },
                { t: 'Người liên hệ', k: 'nguoiLienHe', w: 22, kieu: 'Chữ' },
                { t: 'Điện thoại', k: 'dienThoai', w: 16, kieu: 'Chữ' },
                { t: 'Email', k: 'email', w: 24, kieu: 'Chữ' },
                { t: 'Ghi chú', k: 'ghiChu', w: 30, kieu: 'Chữ' }
            ];
        },
        nhapMau: function (r) {
            return { ma: r.ma, ten: r.ten, diaChi: r.diaChi || '', mst: r.mst || '',
                     nguoiLienHe: r.nguoiLienHe || '', dienThoai: r.dienThoai || '',
                     email: r.email || '', ghiChu: r.ghiChu || '' };
        },
        nhapDong: function (kt, r, da, i) {
            var ma = kt.chu('Mã nhà cung cấp', { req: true });
            var ten = kt.chu('Tên nhà cung cấp', { req: true });
            kt.trung('Mã nhà cung cấp', ma, da, 'nhaCungCap', 'ma', 'nhà cung cấp');
            if (ma) da[T.kd(ma)] = i + 2;
            return { ma: ma, ten: ten, loai: 'Doanh nghiệp',
                diaChi: kt.chu('Địa chỉ'), mst: kt.chu('Mã số thuế'),
                nguoiLienHe: kt.chu('Người liên hệ'), dienThoai: kt.chu('Điện thoại'),
                email: kt.chu('Email'), ghiChu: kt.chu('Ghi chú'),
                nhomHang: '', dieuKhoanTT: '', trangThai: 'Đang giao dịch' };
        },
        fromExcel: function (r) {
            if (!r['Tên nhà cung cấp']) return null;
            return { ma: r['Mã NCC'] || nextMa('nhaCungCap', 'NCC'), ten: r['Tên nhà cung cấp'], loai: 'Doanh nghiệp',
                mst: String(r['Mã số thuế'] || ''), diaChi: r['Địa chỉ'] || '', dienThoai: String(r['Điện thoại'] || ''),
                email: r['Email'] || '', nguoiLienHe: '', nhomHang: r['Nhóm hàng'] || '',
                dieuKhoanTT: r['Điều khoản TT'] || '', ghiChu: '', trangThai: r['Trạng thái'] || 'Đang giao dịch' };
        },
        rules: [{ k: 'ma' }, { k: 'ten' }],
        form: function (r) {
            return '<div class="grid2">' +
            '<div class="fld req"><label>Mã nhà cung cấp</label><input data-f="ma" value="' + T.esc(r.ma || nextMa('nhaCungCap', 'NCC')) + '"></div>' +
            '<div class="fld"><label>Mã số thuế</label><input data-f="mst" value="' + T.esc(r.mst || '') + '"></div>' +
            '<div class="fld req span2"><label>Tên nhà cung cấp</label><input data-f="ten" value="' + T.esc(r.ten || '') + '"></div>' +
            '<div class="fld span2"><label>Địa chỉ</label><input data-f="diaChi" value="' + T.esc(r.diaChi || '') + '"></div>' +
            '<div class="fld"><label>Điện thoại</label><input data-f="dienThoai" value="' + T.esc(r.dienThoai || '') + '"></div>' +
            '<div class="fld"><label>Thư điện tử</label><input data-f="email" value="' + T.esc(r.email || '') + '"></div>' +
            '<div class="fld"><label>Người liên hệ</label><input data-f="nguoiLienHe" value="' + T.esc(r.nguoiLienHe || '') + '"></div>' +
            '<div class="fld"><label>Nhóm hàng cung cấp</label><input data-f="nhomHang" value="' + T.esc(r.nhomHang || '') + '"></div>' +
            W.oMD('dieuKhoanTT', { f: 'dieuKhoanTTId', fTen: 'dieuKhoanTT', gt: r.dieuKhoanTTId,
                                   gtTen: r.dieuKhoanTT, nhan: 'Điều khoản thanh toán', tuDo: true }) +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(['Đang giao dịch', 'Ngừng giao dịch'], r.trangThai) + '</select></div>' +
            '<div class="fld span2"><label>Ghi chú</label><textarea data-f="ghiChu" rows="2">' + T.esc(r.ghiChu || '') + '</textarea></div>' +
            '</div>';
        },
        toObj: function (v) { return v; },
        ten: function (r) { return r.ten; }
    });
};

/* ==========================================================================
   HÀNG HÓA
   ========================================================================== */
var NHOM_HANG = ['Tủ trung tâm báo cháy', 'Đầu báo cháy', 'Nút nhấn báo cháy', 'Chuông - còi - đèn',
                 'Module địa chỉ', 'Nguồn - ắc quy', 'Phụ kiện - công cụ', 'Thiết bị khác'];

/* ---------- Hàng hóa: khối giá chỉ-đọc (do hệ thống giá vốn / bảng giá quản lý) ---------- */
/* ---------- Hàng hóa: chọn ảnh, thu nhỏ còn 320 điểm ảnh rồi lưu kèm bản ghi ---------- */
function ganAnh(h) {
    var chon = h.q('#hhChon'), bo = h.q('#hhBo'), file = h.q('#hhFile'),
        xem = h.q('#hhXem'), o = h.q('[data-f="anh"]');
    if (!chon) return;
    chon.onclick = function () { file.click(); };
    bo.onclick = function () { o.value = ''; xem.innerHTML = '<i class="bi bi-image"></i>'; };
    file.onchange = function () {
        var f = file.files && file.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) return UI.toast('err', 'Tệp không phải hình ảnh');
        var fr = new FileReader();
        fr.onload = function () {
            var im = new Image();
            im.onload = function () {
                var C = 320, k = Math.min(1, C / Math.max(im.width, im.height));
                var cv = document.createElement('canvas');
                cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
                cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
                var d = cv.toDataURL('image/jpeg', 0.82);
                o.value = d; xem.innerHTML = '<img src="' + d + '" alt="">';
                UI.toast('ok', 'Đã chọn ảnh', 'Bấm Lưu để ghi lại cùng hàng hóa.');
            };
            im.src = fr.result;
        };
        fr.readAsDataURL(f);
    };
}

S['hang-hoa'] = function (host) {
    W.CRUD(host, {
        title: 'Hàng hóa', coll: 'hangHoa', file: 'DanhSach_HangHoa',
        trangThaiDS: ['Đang kinh doanh', 'Ngừng kinh doanh'],
        suaHangLoat: [
            { k: 'nhom', t: 'Nhóm hàng', type: 'select', opts: NHOM_HANG },
            { k: 'dvt', t: 'Đơn vị tính', type: 'select', opts: ['Bộ', 'Cái', 'Tủ', 'Chiếc', 'Mét', 'Cuộn', 'Hộp'] },
            { k: 'xuatXu', t: 'Xuất xứ / hãng', type: 'text' },
            { k: 'trangThai', t: 'Trạng thái', type: 'select', opts: ['Đang kinh doanh', 'Ngừng kinh doanh'] }
        ],
        sub: 'Master Data hàng hóa — dữ liệu nền độc lập, không sinh ra từ bảng giá',
        crumb: ['Danh mục', 'Hàng hóa'],
        banner: '<div class="note b mb12"><i class="bi bi-diagram-3-fill"></i><div>' +
                '<b>Danh mục Hàng hóa là dữ liệu nền độc lập.</b> Chỉ quản lý thuộc tính nhận dạng ' +
                '(Mã ERP · Model · Tên hàng · Hãng · Loại thiết bị · ĐVT · Thông số kỹ thuật) và ' +
                'cấu hình theo dõi (tồn kho · sê-ri · lô).<br>' +
                'Danh mục <b>không quản lý giá bán, giá vốn và chính sách giá</b>: giá bán khai tại ' +
                '<b>Danh mục → Bảng giá</b>; giá vốn và tồn kho do sổ kho sinh ra, xem tại ' +
                '<b>Kho</b> và <b>Giá vốn</b>. Nhập bảng giá <b>không bao giờ tạo hay sửa</b> ' +
                'mặt hàng trong danh mục này.</div></div>',
        search: ['maNoiBo', 'ma', 'model', 'maKhac', 'ten', 'nhom', 'hang', 'dvt', 'thongSo'],
        rows: function () {
            return DB.all('hangHoa').map(function (h) {
                var o = h;                                   // giữ nguyên tham chiếu để sửa/xóa vẫn đúng id
                return o;
            });
        },
        cols: [
            { k: '_anh', t: '', w: 46, sort: false, cls: 'ctr', r: function (v, r) {
                return r.anh ? '<img src="' + r.anh + '" class="hh-anh" alt="">'
                             : '<span class="hh-anh trong"><i class="bi bi-image"></i></span>'; } },
            { k: 'maNoiBo', t: 'Số nội bộ', w: 92, cls: 'mono ctr',
              r: function (v) { return v ? T.esc(v) : '<span class="muted">—</span>'; } },
            { k: 'ma', t: 'Mã hàng', w: 140, cls: 'mono',
              r: function (v) { return v ? '<b>' + T.esc(v) + '</b>' : '<span class="muted">—</span>'; } },
            { k: 'model', t: 'Model', w: 150, cls: 'mono',
              r: function (v, r) {
                  /* Model là mã của nhà sản xuất, KHÔNG phải khóa — được phép
                     trùng. Hiện dấu hiệu để người dùng biết còn mặt hàng khác
                     dùng chung Model này. */
                  if (!v) return '<span class="muted">—</span>';
                  var n = DB.all('hangHoa').filter(function (x) {
                      return T.kd(x.model || x.ma) === T.kd(v); }).length;
                  return T.esc(v) + (n > 1
                      ? ' <span class="pill n" title="Còn ' + (n - 1) +
                        ' mặt hàng khác dùng chung Model này — phân biệt bằng tên hàng và thông số kỹ thuật">' +
                        'dùng chung ' + n + '</span>' : '');
              } },
            { k: 'ten', t: 'Tên hàng hóa', r: function (v, r) {
                return '<span class="ellip" title="' + T.esc(v) + '">' + T.esc(v) + '</span>' +
                    '<div class="small muted">' + T.esc(r.nhom) +
                    (r.nhaSanXuat ? ' · ' + T.esc(r.nhaSanXuat) : '') + '</div>'; } },
            /* Mã khác: các mã cũ / mã hãng của cùng mặt hàng, chỉ dùng để NHẬN DIỆN
               khi nhập tệp bảng giá cũ — không phải một trường mã thứ hai. */
            { k: 'maKhac', t: 'Mã khác', w: 132, cls: 'mono',
              r: function (v) { return (v && v.length) ? T.esc(v.join(', ')) : '<span class="muted">—</span>'; } },
            { k: 'dvt', t: 'ĐVT', w: 54, cls: 'ctr' },
            { k: 'hang', t: 'Hãng', w: 140,
              r: function (v, r) { return T.esc(v || r.nhaSanXuat || r.xuatXu || '—'); } },
            { k: 'thongSo', t: 'Thông số kỹ thuật',
              r: function (v, r) {
                  var t = v || r.quyCach || '';
                  return t ? '<span class="ellip" title="' + T.esc(t) + '">' + T.esc(t) + '</span>'
                           : '<span class="muted">—</span>'; } },
            { k: '_td', t: 'Theo dõi', w: 150, sort: false, r: function (v, r) {
                var ds = [];
                if (r.theoDoiTon !== false) ds.push('<span class="pill b">Tồn kho</span>');
                if (r.theoDoiSerial) ds.push('<span class="pill g">Sê-ri</span>');
                if (r.theoDoiLo) ds.push('<span class="pill y">Lô</span>');
                return ds.join(' ') || '<span class="muted">—</span>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 150, r: function (v) { return T.pill(v); } }
        ],
        filters: [
            { k: 'nhom', t: 'Loại thiết bị', w: 190, opts: NHOM_HANG },
            { k: 'dvt', t: 'Đơn vị tính', w: 120, opts: W.dsDVT ? W.dsDVT() : ['Bộ', 'Cái', 'Tủ'] },
            { k: 'hang', t: 'Hãng', w: 160,
              opts: Array.from(new Set(DB.all('hangHoa').map(function (h) { return h.hang || h.nhaSanXuat || ''; }).filter(Boolean))) },
            { k: 'trangThai', t: 'Trạng thái', w: 170, opts: ['Đang kinh doanh', 'Ngừng kinh doanh'] }
        ],
        excel: [
            { t: 'Số nội bộ', k: 'maNoiBo', w: 12 },
            { t: 'Mã hàng', k: 'ma', w: 20 }, { t: 'Model', k: 'model', w: 20 },
            { t: 'Tên hàng hóa', k: 'ten', w: 52 }, { t: 'ĐVT', k: 'dvt', w: 8 },
            { t: 'Mã khác', k: 'maKhac', w: 18,
              v: function (r) { return (r.maKhac && r.maKhac.join) ? r.maKhac.join(', ') : (r.maKhac || ''); } },
            { t: 'Loại thiết bị', k: 'nhom', w: 22 },
            { t: 'Hãng', k: 'hang', w: 18, v: function (r) { return r.hang || r.nhaSanXuat || ''; } },
            { t: 'Quy cách', k: 'quyCach', w: 34 }, { t: 'Thông số kỹ thuật', k: 'thongSo', w: 40 },
            { t: 'Theo dõi tồn kho', k: '_tdt', w: 16, v: function (r) { return r.theoDoiTon === false ? 'Không' : 'Có'; } },
            { t: 'Theo dõi sê-ri', k: '_tds', w: 15, v: function (r) { return r.theoDoiSerial ? 'Có' : 'Không'; } },
            { t: 'Theo dõi lô', k: '_tdl', w: 13, v: function (r) { return r.theoDoiLo ? 'Có' : 'Không'; } },
            { t: 'Tồn tối thiểu', k: 'tonToiThieu', w: 12 },
            { t: 'Ghi chú', k: 'ghiChu', w: 20 }, { t: 'Trạng thái', k: 'trangThai', w: 16 }],
        nhapCot: function () {
            return [
                /* KHÔNG CÓ CỘT MÃ HÀNG. Mã hàng do hệ thống tự sinh khi ghi vào
                   Danh mục; tệp của doanh nghiệp chỉ khai Model của nhà sản xuất
                   và các mã cũ dùng để đối chiếu. */
                { t: 'Model', k: 'model', w: 20, req: true, kieu: 'Chữ',
                  tenKhac: ['Mã hàng (Model)', 'Mã hiệu', 'Model của nhà sản xuất', 'Mã hàng', 'Mã ERP'],
                  mo: 'BẮT BUỘC — Model của nhà sản xuất. ĐƯỢC PHÉP TRÙNG, phân biệt bằng tên hàng và thông số' },
                { t: 'Tên hàng', k: 'ten', w: 50, req: true, kieu: 'Chữ' },
                { t: 'Mã khác', k: 'maKhac', w: 24, kieu: 'Chữ',
                  tenKhac: ['Mã cũ', 'Mã của hãng'],
                  mo: 'Mã cũ hoặc mã của hãng, nhiều mã cách nhau bởi dấu phẩy — chỉ dùng để tra cứu' },
                { t: 'Loại thiết bị', k: 'nhom', w: 24, kieu: 'Chữ',
                  mo: 'Khai tại Danh mục → Nhóm hàng. Để trống lấy loại mặc định' },
                { t: 'Hãng', k: 'hang', w: 22, kieu: 'Chữ',
                  mo: 'Khai tại Danh mục → Hãng sản xuất' },
                { t: 'Đơn vị tính', k: 'dvt', w: 12, kieu: 'Chữ', mo: 'Bộ · Cái · Chiếc · Mét · Cuộn · Hộp…' },
                { t: 'Quy cách', k: 'quyCach', w: 34, kieu: 'Chữ' },
                { t: 'Thông số kỹ thuật', k: 'thongSo', w: 40, kieu: 'Chữ' },
                { t: 'Theo dõi tồn kho', k: 'theoDoiTon', w: 16, kieu: 'Chữ', mo: 'Có hoặc Không. Để trống là Có' },
                { t: 'Theo dõi sê-ri', k: 'theoDoiSerial', w: 15, kieu: 'Chữ', mo: 'Có hoặc Không. Để trống là Không' },
                { t: 'Theo dõi lô', k: 'theoDoiLo', w: 13, kieu: 'Chữ', mo: 'Có hoặc Không. Để trống là Không' },
                { t: 'Ghi chú', k: 'ghiChu', w: 26, kieu: 'Chữ' },
                { t: 'Trạng thái', k: 'trangThai', w: 18, kieu: 'Chữ',
                  mo: 'Đang kinh doanh hoặc Ngừng kinh doanh. Để trống lấy Đang kinh doanh' }
            ];
        },
        nhapMau: function (r) {
            return { model: r.model || r.ma, ten: r.ten,
                     maKhac: (r.maKhac || []).join(', '), nhom: r.nhom || '',
                     hang: r.hang || r.nhaSanXuat || '',
                     dvt: r.dvt || '', quyCach: r.quyCach || '', thongSo: r.thongSo || '',
                     theoDoiTon: r.theoDoiTon === false ? 'Không' : 'Có',
                     theoDoiSerial: r.theoDoiSerial ? 'Có' : 'Không',
                     theoDoiLo: r.theoDoiLo ? 'Có' : 'Không',
                     ghiChu: r.ghiChu || '', trangThai: r.trangThai || 'Đang kinh doanh' };
        },
        nhapDong: function (kt, r, da, i) {
            /* MODEL là trường bắt buộc — không có Model thì không xác định được
               mặt hàng theo mã của nhà sản xuất. MÃ HÀNG không đọc từ tệp. */
            var model = kt.chu('Model', { req: true });
            var ten = kt.chu('Tên hàng', { req: true });
            function co(nhan, mac) {
                var v = T.kd(kt.chu(nhan) || '').toLowerCase();
                if (!v) return mac;
                return v.indexOf('khong') < 0 && v !== '0' && v !== 'no';
            }
            var ts0 = kt.chu('Thông số kỹ thuật');
            var qc0 = kt.chu('Quy cách');
            /* MODEL ĐƯỢC PHÉP TRÙNG — không bao giờ báo lỗi vì Model lặp lại.
               Mỗi dòng của tệp là MỘT mặt hàng độc lập; chỉ khi trùng CẢ Model,
               Tên hàng và Cấu hình mới đúng là khai hai lần cùng một mặt hàng,
               và cả lúc đó cũng chỉ CẢNH BÁO chứ không chặn dòng. */
            var kbo = T.khoaHH({ model: model, ten: ten, thongSo: ts0, quyCach: qc0 });
            if (kbo) {
                if (da[kbo])
                    kt.canh('Tên hàng', 'mặt hàng này trùng hoàn toàn với dòng ' + da[kbo] + ' của tệp',
                        'Cùng Mã hàng (Model), cùng Tên hàng và cùng Cấu hình. Hệ thống ghi vào ' +
                        'đúng một mặt hàng, không tạo hai bản ghi.');
                else if (T.chiMucHangHoa().bo[kbo])
                    kt.canh('Tên hàng', 'mặt hàng này đã có trong Danh mục Hàng hóa',
                        'Trùng cả Mã hàng (Model), Tên hàng và Cấu hình nên hệ thống cập nhật lại ' +
                        'mặt hàng đã có, không tạo thêm bản ghi mới.');
                else da[kbo] = i + 2;
            }
            /* v18.5.0 — TỆP KHÔNG KHAI NHÓM THÌ ĐỂ NHÓM MẶC ĐỊNH, KHÔNG LẤY
               NHÓM ĐẦU TIÊN trong danh sách. Lấy nhóm đầu tiên khiến hàng rơi
               vào một nhóm hoàn toàn không liên quan (hiện là nhóm đầu bảng
               chữ cái) mà người dùng không hề biết. */
            var nhom = kt.o('Loại thiết bị')
                ? kt.chon('Loại thiết bị', W.dsNhomHang(), { mac: T.NHOM_MAC_DINH })
                : T.NHOM_MAC_DINH;
            /* Hồ sơ tối thiểu phải đủ Nhóm hàng và Hãng — tệp không khai thì điền
               mặc định, người dùng sửa lại lúc nào cũng được. Không vì hai trường
               mô tả mà chặn cả tệp. */
            var hang = kt.o('Hãng') ? (kt.chon('Hãng', W.dsHangSX(), { mac: '' }) || T.HANG_MAC_DINH)
                                    : T.HANG_MAC_DINH;
            nhom = nhom || T.NHOM_MAC_DINH;
            return { model: model, ten: ten, nhom: nhom, hang: hang,
                nhaSanXuat: hang, thuongHieu: hang,
                dvt: kt.dvt('Đơn vị tính', 'Cái'),
                quyCach: qc0, thongSo: ts0,
                theoDoiTon: co('Theo dõi tồn kho', true),
                theoDoiSerial: co('Theo dõi sê-ri', false),
                theoDoiLo: co('Theo dõi lô', false),
                ghiChu: kt.chu('Ghi chú'),
                trangThai: kt.o('Trạng thái')
                    ? kt.chon('Trạng thái', ['Đang kinh doanh', 'Ngừng kinh doanh'], { mac: 'Đang kinh doanh' })
                    : 'Đang kinh doanh',
                maKhac: T.maKhacTu(kt.chu('Mã khác'), model), xuatXu: '', anh: '',
                giaVon: 0, giaVonBQ: 0, ton: 0, tonDau: 0, tonToiThieu: 0, plId: '' };
        },
        maTrungDuoc: true,          // tệp không khai Mã hàng; Model được phép trùng
        /* GHI TỪNG DÒNG ĐỘC LẬP.
           Mỗi dòng của tệp là một mặt hàng riêng, nhận một ID nội bộ riêng, giữ
           nguyên Model kể cả khi Model đã có ở mặt hàng khác. Chỉ khi dòng trùng
           HOÀN TOÀN Model + Tên hàng + Cấu hình với một mặt hàng đã có thì mới
           cập nhật lại mặt hàng đó thay vì tạo bản ghi thứ hai. */
        ghiDong: function (o) {
            var k = T.khoaHH(o);
            var da = k ? T.chiMucHangHoa().bo[k] : null;
            if (da) {
                /* Đúng mặt hàng đã có — cập nhật thuộc tính, GIỮ NGUYÊN Mã hàng
                   và số hiệu nội bộ đã cấp. */
                var ban = T.clone(da);
                ['model', 'ten', 'dvt', 'nhom', 'hang', 'nhaSanXuat', 'thuongHieu',
                 'quyCach', 'thongSo', 'ghiChu', 'trangThai'].forEach(function (f) {
                    if (o[f] !== undefined && o[f] !== '') ban[f] = o[f];
                });
                if ((o.maKhac || []).length)
                    ban.maKhac = T.maKhacTu((ban.maKhac || []).concat(o.maKhac), ban.model);
                ['theoDoiTon', 'theoDoiSerial', 'theoDoiLo'].forEach(function (f) {
                    if (o[f] !== undefined) ban[f] = o[f];
                });
                return DB.update('hangHoa', da.id, ban);
            }
            /* CỬA DUY NHẤT — Mã hàng và số hiệu nội bộ do T.taoHangHoa cấp. */
            return T.taoHangHoa(o);
        },
        /* HỒ SƠ TỐI THIỂU CỦA MỘT MẶT HÀNG: Mã hàng nội bộ (hệ thống tự sinh) ·
           Model · Tên hàng · Đơn vị tính · Nhóm hàng · Hãng. */
        rules: [{ k: 'ten' },
                { k: 'model', msg: 'Model là trường bắt buộc — nhập đúng Model của nhà sản xuất' },
                { k: 'dvt', msg: 'Đơn vị tính là trường bắt buộc' },
                { k: 'nhom', msg: 'Nhóm hàng là trường bắt buộc' },
                { k: 'hang', msg: 'Hãng là trường bắt buộc' }],
        formSize: 'lg',
        form: function (r) {
            function ck(f, nhan, mo, mac) {
                var b = r[f] === undefined ? mac : r[f];
                return '<label class="chk" style="display:flex;gap:8px;align-items:flex-start">' +
                    '<input type="checkbox" data-f="' + f + '"' + (b ? ' checked' : '') + '>' +
                    '<span><b>' + nhan + '</b><div class="small muted">' + mo + '</div></span></label>';
            }
            return '<div class="grid2">' +
            /* MÃ HÀNG do hệ thống tự sinh theo quy tắc thống nhất của toàn phần
               mềm — người dùng KHÔNG nhập tay, nên ô này luôn khóa. */
            '<div class="fld"><label>Mã hàng (mã nội bộ)</label>' +
                '<input value="' + T.esc(r.ma || '') + '" disabled placeholder="Hệ thống tự sinh khi lưu">' +
                '<div class="small muted" style="margin-top:2px">Do <b>hệ thống tự sinh</b> theo quy tắc ' +
                'thống nhất <b>' + T.esc(T.TIEN_TO_MA_HANG) + 'số nội bộ</b>. Toàn bộ phân hệ dùng chung mã này.</div></div>' +
            '<div class="fld req"><label>Model (mã nhà sản xuất)</label>' +
                '<input data-f="model" value="' + T.esc(r.model || '') + '" placeholder="Nhập đúng Model của nhà sản xuất">' +
                '<div class="small muted" style="margin-top:2px"><b>Bắt buộc</b> và <b>được phép trùng</b> — ' +
                'phân biệt bằng tên hàng và thông số kỹ thuật. Model KHÔNG phải khóa liên kết.</div></div>' +
            (r.id ? '<div class="fld"><label>Số hiệu nội bộ</label>' +
                '<input value="' + T.esc(r.maNoiBo || '') + '" disabled>' +
                '<div class="small muted" style="margin-top:2px">Số hiệu duy nhất do hệ thống cấp — ' +
                'Mã hàng được sinh ra từ số này.</div></div>' : '') +
            '<div class="fld"><label>Đơn vị tính</label><select data-f="dvt">' + opt(W.dsDVT(), r.dvt || 'Cái') + '</select></div>' +
            '<div class="fld req span2"><label>Tên hàng hóa</label><input data-f="ten" value="' + T.esc(r.ten || '') + '"></div>' +
            '<div class="fld"><label>Hãng</label><select data-f="hang">' +
                opt(W.dsHangSX(), r.hang || r.nhaSanXuat || r.xuatXu || '') + '</select></div>' +
            '<div class="fld"><label>Loại thiết bị</label><select data-f="nhom">' + opt(W.dsNhomHang(), r.nhom) + '</select></div>' +
            '<div class="fld span2"><label>Thông số kỹ thuật</label><textarea data-f="thongSo" rows="2">' + T.esc(r.thongSo || '') + '</textarea></div>' +
            '<div class="fld span2"><label>Quy cách đóng gói</label><textarea data-f="quyCach" rows="2">' + T.esc(r.quyCach || '') + '</textarea></div>' +
            '<div class="fld span2"><label>Mã khác (mã cũ · mã hãng)</label><input data-f="maKhac" value="' +
                T.esc((r.maKhac || []).join(', ')) + '" placeholder="Nhiều mã cách nhau bởi dấu phẩy"></div>' +
            '<div class="fld"><label>Mã vạch</label><input data-f="barcode" value="' + T.esc(r.barcode || '') +
                '" placeholder="Mã vạch in trên bao bì"></div>' +
            '<div class="fld"><label>Mã QR</label><input data-f="qrCode" value="' + T.esc(r.qrCode || '') +
                '" placeholder="Nội dung mã QR của nhà sản xuất"></div>' +
            '<div class="fld span2"><label>Hình ảnh sản phẩm</label>' +
                '<div class="anh-box"><div class="xem" id="hhXem">' +
                (r.anh ? '<img src="' + r.anh + '" alt="">' : '<i class="bi bi-image"></i>') + '</div>' +
                '<div class="thao-tac"><input type="file" id="hhFile" accept="image/*" style="display:none">' +
                '<button type="button" class="btn sm" id="hhChon"><i class="bi bi-upload"></i> Chọn ảnh</button>' +
                '<button type="button" class="btn sm danger" id="hhBo"><i class="bi bi-x-lg"></i> Bỏ ảnh</button>' +
                '<div class="small muted">Ảnh được thu nhỏ còn 320 điểm ảnh và lưu kèm hàng hóa</div></div>' +
                '<input type="hidden" data-f="anh" value="' + T.esc(r.anh || '') + '"></div></div>' +
            '</div>' +
            '<div class="card mt12"><div class="card-h"><i class="bi bi-box-seam"></i> Cấu hình theo dõi</div>' +
            '<div class="card-b"><div class="grid3">' +
            ck('theoDoiTon', 'Theo dõi tồn kho', 'Mặt hàng có nhập kho, xuất kho và tính tồn', true) +
            ck('theoDoiSerial', 'Theo dõi số sê-ri', 'Ghi số sê-ri từng đơn vị khi nhập và khi xuất', false) +
            ck('theoDoiLo', 'Theo dõi lô', 'Ghi số lô và hạn dùng khi nhập và khi xuất', false) +
            '</div>' +
            '<div class="fld mt12" style="max-width:280px"><label>Tồn tối thiểu (định mức cảnh báo)</label>' +
            '<input class="tien" data-f="tonToiThieu" value="' + T.esc(T.soVe(r.tonToiThieu || 0)) + '"></div>' +
            '</div></div>' +
            '<div class="grid2 mt12">' +
            '<div class="fld span2"><label>Ghi chú</label><input data-f="ghiChu" value="' + T.esc(r.ghiChu || '') + '"></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(['Đang kinh doanh', 'Ngừng kinh doanh'], r.trangThai) + '</select></div>' +
            '</div>' +
            '<div class="note b mt12"><i class="bi bi-diagram-3-fill"></i><div>' +
            '<b>Danh mục hàng hóa là dữ liệu gốc của toàn hệ thống.</b> Chỉ ở đây mới sinh ra ' +
            '<b>Mã hàng</b> — và Mã hàng do <b>hệ thống tự sinh</b>, người dùng không nhập tay. ' +
            'Mọi phân hệ đều dùng chung đúng Mã hàng này.<br>' +
            'Danh mục <b>không quản lý giá</b>: giá bán khai tại <b>Danh mục → Bảng giá</b>; ' +
            'giá vốn và tồn kho do sổ kho sinh ra, xem tại <b>Kho</b> và <b>Giá vốn</b>.</div></div>';
        },
        toObj: function (v, r) {
            /* MÃ HÀNG KHÔNG BAO GIỜ ĐẾN TỪ BIỂU MẪU. Sửa mặt hàng thì giữ nguyên
               mã cũ; thêm mới thì hệ thống cấp mã ngay trước khi ghi. */
            v.model = String(v.model || '').trim();
            v.ma = (r && r.ma) ? r.ma : '';
            if (!v.ma) {
                v.maNoiBo = (r && r.maNoiBo) || T.soNoiBoMoi();
                v.ma = T.maHangTuSo(v.maNoiBo);
            } else if (r && r.maNoiBo) v.maNoiBo = r.maNoiBo;
            // Mã khác nhập dạng chuỗi ngăn cách bởi dấu phẩy — lưu thành mảng
            v.maKhac = T.maKhacTu(v.maKhac, v.model);
            // Hãng ghi cả vào hai trường cũ để báo cáo đời trước vẫn đọc được
            v.nhaSanXuat = v.hang; v.thuongHieu = v.hang;
            v.xuatXu = r.xuatXu || '';
            v.theoDoiTon = !!v.theoDoiTon;
            v.theoDoiSerial = !!v.theoDoiSerial;
            v.theoDoiLo = !!v.theoDoiLo;
            /* SỔ DẪN XUẤT — Danh mục không quản lý, chỉ mang theo bản đệm hiện có:
               tồn kho do thẻ kho sinh ra, giá vốn do sổ giá vốn bình quân sinh ra. */
            v.ton = r.ton === undefined ? 0 : r.ton;
            v.tonDau = r.tonDau === undefined ? v.ton : r.tonDau;
            v.plId = r.plId || '';
            v.giaVon = r.giaVon || 0; v.giaVonBQ = r.giaVonBQ === undefined ? v.giaVon : r.giaVonBQ;
            /* Chốt chặn kiến trúc: danh mục KHÔNG được mang trường giá bán. */
            (T.TRUONG_GIA_BO_HH || []).forEach(function (k) { delete v[k]; });
            return v;
        },
        onForm: function (h, r) { ganAnh(h); },
        check: function (o, r) {
            /* MODEL ĐƯỢC PHÉP TRÙNG. Model chỉ là mã kỹ thuật của nhà sản xuất;
               hai mặt hàng cùng Model nhưng khác tên hàng hoặc khác thông số kỹ
               thuật là HAI SẢN PHẨM KHÁC NHAU. Chỉ chặn khi trùng CẢ BA: Model,
               tên hàng và thông số kỹ thuật — lúc đó mới đúng là khai hai lần
               cùng một mặt hàng. */
            var k = T.khoaHH(o);
            var d = DB.all('hangHoa').filter(function (x) {
                return T.khoaHH(x) === k && (!r || x.id !== r.id); });
            return d.length
                ? 'Mặt hàng này đã có trong danh mục: trùng cả Model, Tên hàng và ' +
                  'Thông số kỹ thuật (Mã hàng ' + (d[0].ma || d[0].maNoiBo || d[0].id) + ').'
                : '';
        },
        ten: function (r) { return r.ma + ' — ' + r.ten; }
    });
};

/* ==========================================================================
   KHO HÀNG
   ========================================================================== */
S['kho'] = function (host) {
    W.CRUD(host, {
        title: 'Kho hàng', coll: 'kho', file: 'DanhSach_Kho', copy: false,
        banner: '<div class="note y mb12"><i class="bi bi-info-circle"></i><div>' +
            '<b>Mô hình một kho:</b> cả nhóm chỉ có <b>01 kho vật lý duy nhất thuộc Công ty Tản Viên</b> — ' +
            'đơn vị nhập khẩu trực tiếp. EMC, AA, Thái Phong không có kho riêng; mọi công ty bán hàng đều xuất ' +
            'từ kho này. Hệ thống <b>không</b> có chức năng chuyển kho nội bộ và <b>không</b> tách tồn kho theo công ty.<br>' +
            'Màn hình này chỉ để <b>sửa thông tin kho</b> (địa chỉ, thủ kho, liên hệ) — không tạo thêm kho mới.</div></div>',
        trangThaiDS: ['Đang dùng', 'Ngừng dùng'],
        suaHangLoat: [{ k: 'thuKho', t: 'Thủ kho', type: 'text' },
                      { k: 'trangThai', t: 'Trạng thái', type: 'select', opts: ['Đang dùng', 'Ngừng dùng'] }],
        // Nguyên tắc một kho: không cho thêm kho thứ hai, không cho xóa kho đang giữ tồn
        beforeAdd: function () {
            if (DB.all('kho').length >= 1) {
                UI.toast('warn', 'Hệ thống chỉ dùng 01 kho',
                    'Mô hình đã chốt: một kho vật lý duy nhất thuộc Tản Viên. Hãy sửa thông tin kho hiện có thay vì tạo kho mới.');
                return false;
            }
            return true;
        },
        sub: 'Thông tin kho vật tư duy nhất của doanh nghiệp', crumb: ['Kho', 'Danh mục kho'],
        search: ['ma', 'ten', 'diaChi'],
        rows: function () {
            return DB.all('kho').map(function (k) {
                k._px = DB.all('phieuXuat').filter(function (p) { return p.khoId === k.id; }).length;
                return k;
            });
        },
        cols: [
            { k: 'ma', t: 'Mã kho', w: 110, cls: 'mono' },
            { k: 'ten', t: 'Tên kho', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'diaChi', t: 'Địa chỉ' },
            { k: 'thuKho', t: 'Thủ kho', w: 170 },
            { k: '_px', t: 'Số phiếu xuất', w: 130, cls: 'num', fmt: 'num' },
            { k: 'trangThai', t: 'Trạng thái', w: 120, r: function (v) { return T.pill(v); } }
        ],
        excel: [{ t: 'Mã kho', k: 'ma' }, { t: 'Tên kho', k: 'ten', w: 26 }, { t: 'Địa chỉ', k: 'diaChi', w: 40 },
                { t: 'Thủ kho', k: 'thuKho', w: 22 }, { t: 'Điện thoại', k: 'dienThoai' }, { t: 'Trạng thái', k: 'trangThai' }],
        fromExcel: function (r) {
            if (!r['Tên kho']) return null;
            return { ma: r['Mã kho'] || nextMa('kho', 'KHO'), ten: r['Tên kho'], diaChi: r['Địa chỉ'] || '',
                thuKho: r['Thủ kho'] || '', dienThoai: String(r['Điện thoại'] || ''), ghiChu: '',
                trangThai: r['Trạng thái'] || 'Đang dùng' };
        },
        rules: [{ k: 'ma' }, { k: 'ten' }],
        formSize: 'md',
        form: function (r) {
            return '<div class="grid2">' +
            '<div class="fld req"><label>Mã kho</label><input data-f="ma" value="' + T.esc(r.ma || '') + '"></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(['Đang dùng', 'Ngừng dùng'], r.trangThai) + '</select></div>' +
            '<div class="fld req span2"><label>Tên kho</label><input data-f="ten" value="' + T.esc(r.ten || '') + '"></div>' +
            '<div class="fld span2"><label>Địa chỉ</label><input data-f="diaChi" value="' + T.esc(r.diaChi || '') + '"></div>' +
            '<div class="fld"><label>Thủ kho</label><input data-f="thuKho" value="' + T.esc(r.thuKho || '') + '"></div>' +
            '<div class="fld"><label>Điện thoại</label><input data-f="dienThoai" value="' + T.esc(r.dienThoai || '') + '"></div>' +
            '<div class="fld span2"><label>Ghi chú</label><textarea data-f="ghiChu" rows="2">' + T.esc(r.ghiChu || '') + '</textarea></div>' +
            '</div>';
        },
        toObj: function (v, r) {
            /* KIẾN TRÚC V1.0 — toàn hệ thống chỉ có 01 hệ thống kho dùng chung.
               Cờ kho chính và đơn vị quản lý do hệ thống giữ, biểu mẫu không khai
               báo nên phải bảo toàn — mất cờ này là mất kho chính của cả nhóm. */
            v.laKhoChinh = r.laKhoChinh || false;
            v.donViId = r.donViId || '';
            return v;
        },
        ten: function (r) { return r.ten; }
    });
};

})(window);

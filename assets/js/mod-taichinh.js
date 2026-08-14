/* ==========================================================================
   TVERP — THU CHI & CÔNG NỢ
   Phiếu thu · Phiếu chi · Sổ công nợ khách hàng / nhà cung cấp
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;

var HT = ['Chuyển khoản', 'Tiền mặt', 'Bù trừ công nợ', 'Séc'];

/* ==========================================================================
   PHIẾU THU
   ========================================================================== */
S['phieu-thu'] = function (host) {
    VoucherScreen(host, {
        title: 'Thu tiền', dt: 'Phiếu thu', key: 'phieuThu', seq: 'PT', file: 'DanhSach_PhieuThu',
        sub: 'Bước 5 — thu tiền khách hàng, ghi sổ làm giảm công nợ phải thu',
        crumb: ['Thu chi & Công nợ', 'Thu tiền'],
        doiTac: 'khachHang', doiTacLb: 'Khách hàng nộp tiền', chungTuGoc: 'donBan', ctLb: 'Đơn bán hàng',
        nguoiLb: ['Người nộp tiền', 'Người thu tiền'], nguoiK: ['nguoiNop', 'nguoiThu'],
        soTienLb: 'Số tiền thu'
    });
};

/* ==========================================================================
   PHIẾU CHI
   ========================================================================== */
S['phieu-chi'] = function (host) {
    VoucherScreen(host, {
        title: 'Chi tiền', dt: 'Phiếu chi', key: 'phieuChi', seq: 'PC', file: 'DanhSach_PhieuChi',
        sub: 'Chi trả nhà cung cấp — ghi sổ làm giảm công nợ phải trả',
        crumb: ['Thu chi & Công nợ', 'Chi tiền'],
        doiTac: 'nhaCungCap', doiTacLb: 'Nhà cung cấp nhận tiền', chungTuGoc: 'donMua', ctLb: 'Đơn mua hàng',
        nguoiLb: ['Người nhận tiền', 'Người chi tiền'], nguoiK: ['nguoiNhan', 'nguoiChi'],
        soTienLb: 'Số tiền chi'
    });
};

function VoucherScreen(host, cfg) {
    var thu = cfg.key === 'phieuThu';
    var Q = W.Q, mod = cfg.key;
    var qThem = Q.co(mod, 'them'), qSua = Q.co(mod, 'sua'), qXoa = Q.co(mod, 'xoa'),
        qDuyet = Q.co(mod, 'duyet'), qKhoa = Q.co(mod, 'khoa'), qIn = Q.co(mod, 'in');
    var dtId = thu ? 'khachHangId' : 'nhaCungCapId', dtTen = thu ? 'khachHang' : 'nhaCungCap';
    var ctId = thu ? 'donBanId' : 'donMuaId', ctSo = thu ? 'donBanSo' : 'donMuaSo';
    var g;

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>' + cfg.title + '</h2>' +
        '<div class="sub">' + cfg.sub + '</div></div><div class="spacer"></div>' +
        '<div class="row" id="kpiRow"></div></div><div id="gh"></div></div>';
    W.crumb(cfg.crumb);

    function rows() { return T.theoCty(DB.all(cfg.key)); }

    var tb = '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Lập ' + cfg.dt + '</button>' +
        '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
        '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn ok" data-ghi disabled><i class="bi bi-check2-square"></i> Ghi sổ</button>' +
        '<button class="btn" data-huyghi disabled><i class="bi bi-arrow-counterclockwise"></i> Bỏ ghi sổ</button>' +
        '<button class="btn" data-khoa disabled><i class="bi bi-lock"></i> Khóa / Mở khóa</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-mau><i class="bi bi-file-earmark-arrow-down"></i> Tải mẫu Excel</button>' +
        '<button class="btn" data-nhap><i class="bi bi-upload"></i> Nhập Excel</button>' +
        '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
        '<button class="btn" data-lam><i class="bi bi-arrow-clockwise"></i> Làm mới</button>';

    g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: DB.data._meta.pageSize || 20, height: 'calc(100vh - 342px)', toolbar: tb,
        sortK: 'ngay', sortD: -1, chon: true, search: ['so', dtTen, 'lyDo', ctSo],
        emptyTitle: 'Chưa có ' + cfg.dt.toLowerCase() + ' nào',
        cols: [
            { k: 'so', t: 'Số phiếu', w: 148, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày', w: 106, fmt: 'date' },
            { k: 'donVi', t: 'ĐVPH', w: 82, r: function (v) { var d = DB.get('donVi', v); return d ? T.esc(d.tat) : v; } },
            { k: dtTen, t: thu ? 'Khách hàng' : 'Nhà cung cấp', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    '<div class="small muted ellip">' + T.esc(r.lyDo || '') + '</div>'; } },
            { k: ctSo, t: cfg.ctLb, w: 148, cls: 'mono', r: function (v, r) {
                return v ? '<span class="link" onclick="event.stopPropagation();W.moChungTu(\'' + cfg.chungTuGoc + '\',\'' + r[ctId] + '\')">' + T.esc(v) + '</span>'
                         : '<span class="muted">—</span>'; } }
        ].concat(thu ? [] : [
            /* Phiếu chi mang thêm hai chiều quản trị: KHOẢN MỤC CHI quyết định
               khoản đó có vào báo cáo lãi lỗ hay không, DỰ ÁN cho phép tính lãi
               lỗ của từng công trình. */
            { k: 'khoanMuc', t: 'Khoản mục chi', w: 220, r: function (v, r) {
                var km = T.khoanMucCua(r);
                if (!km) return '<span class="muted">chưa phân loại</span>';
                return '<span class="ellip">' + T.esc(km.ten) + '</span>' +
                    (km.vaoChiPhi === false
                        ? '<div class="small muted">không tính vào chi phí</div>' : '');
            } },
            { k: 'duAn', t: 'Dự án', w: 180, r: function (v, r) {
                var d = r.duAnId ? DB.get('duAn', r.duAnId) : null;
                var t = (d && d.ten) || v || '';
                return t ? '<span class="ellip">' + T.esc(t) + '</span>' : '<span class="muted">—</span>';
            } }
        ]).concat([
            { k: 'nguoiLap', t: 'Người lập', w: 146 },
            { k: 'hinhThuc', t: 'Hình thức', w: 132 },
            { k: 'soTien', t: cfg.soTienLb, w: 156, cls: 'num', total: true,
              r: function (v) { return '<b class="' + (thu ? 'pos' : 'neg') + '">' + T.money(v) + '</b>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 136, r: function (v, r) {
                return T.pill(v) + (r.khoa ? ' <i class="bi bi-lock-fill" title="Phiếu đã khóa" style="color:var(--err)"></i>' : ''); } }
        ]),
        filters: [
            { k: 'trangThai', t: 'Trạng thái', opts: ['Đã ghi sổ', 'Chưa ghi sổ'] },
            { k: 'nguoiLapId', t: 'Người lập', w: 170, opts: DB.all('nhanVien').map(function (n) { return { v: n.id, t: n.hoTen }; }) },
            { k: 'hinhThuc', t: 'Hình thức', w: 170, opts: HT },
            { k: 'ngay', t: 'Từ ngày', type: 'date', w: 140, test: function (x, v) { return x.ngay >= v; } }
        ],
        actions: function () {
            return UI.btn('xem', 'bi-eye', 'Xem phiếu') +
                   (qSua ? UI.btn('sua', 'bi-pencil', 'Sửa') : '') +
                   (qXoa ? UI.btn('xoa', 'bi-trash', 'Xóa', 'danger') : '');
        }, actionsW: 110,
        onAction: function (a, r) {
            if (a === 'sua') form(r); else if (a === 'xem') form(r, true);
            else if (a === 'xoa') xoa(r);
        },
        onSelect: UI.chonToolbar(host, ['sua', 'xoa', 'ghi', 'huyghi', 'khoa', 'in'], function (r) {
            var bk = host.querySelector('[data-khoa]');
            if (bk) bk.innerHTML = (r && r.khoa)
                ? '<i class="bi bi-unlock"></i> Mở khóa' : '<i class="bi bi-lock"></i> Khóa phiếu';
        }),
        onOpen: function (r) { form(r, true); }
    });

    /* Phiếu chi nhập từ tệp mà không khai khoản mục thì xếp vào "Chi phí khác" —
       không để một phiếu chi nào rơi ra ngoài phân loại. */
    function mucKhac() {
        var ds = DB.all('khoanMucChi');
        return ds.filter(function (k) { return String(k.ma).toUpperCase() === 'CP12'; })[0] ||
               ds.filter(function (k) { return T.kd(k.ten || '').indexOf('chi phi khac') >= 0; })[0] || null;
    }

    function cotNhapPhieu() {
        return [
            { t: 'Số phiếu', k: 'so', w: 18, kieu: 'Chữ', mo: 'Để trống thì phần mềm tự cấp số' },
            { t: 'Ngày', k: 'ngay', w: 12, req: true, kieu: 'Ngày' },
            { t: 'Mã ' + (thu ? 'khách hàng' : 'nhà cung cấp'), k: 'doiTacMa', w: 16, kieu: 'Chữ',
              mo: 'Có mã thì tra theo mã. Chưa có mã cũng được — điền tên ở cột bên cạnh.' },
            { t: (thu ? 'Khách hàng' : 'Đối tượng chi'), k: 'doiTacTen', w: 30, kieu: 'Chữ',
              mo: 'Chưa có trong danh mục thì hệ thống TỰ TẠO, không cần khai trước.' },
            { t: cfg.soTienLb, k: 'soTien', w: 18, req: true, kieu: 'Số' },
            { t: 'Hình thức', k: 'hinhThuc', w: 18, kieu: 'Chữ', mo: HT.join(' · ') },
            { t: 'Nội dung', k: 'lyDo', w: 44, kieu: 'Chữ' }
        ].concat(thu ? [] : [
            { t: 'Khoản mục chi', k: 'khoanMuc', w: 30, kieu: 'Chữ',
              mo: 'Chưa có trong danh mục thì hệ thống TỰ TẠO. Để trống thì xếp vào "Chi phí khác".' },
            { t: 'Dự án / công trình', k: 'duAn', w: 30, kieu: 'Chữ',
              mo: 'Chưa có thì hệ thống tự tạo. Điền để tính được lãi lỗ theo dự án.' }
        ]);
    }
    function nhapPhieu() {
        if (!qThem) return UI.thieuQuyen(mod, 'them');
        W.nhapExcel({
            ten: cfg.title, file: cfg.file, cols: cotNhapPhieu(),
            mau: g.allRows.slice(0, 3).map(function (r) {
                var d = DB.get(cfg.doiTac, r[dtId]) || {};
                return { so: r.so, ngay: T.date(r.ngay), doiTacMa: d.ma || '', doiTacTen: d.ten || '',
                         soTien: r.soTien, hinhThuc: r.hinhThuc, lyDo: r.lyDo,
                         khoanMuc: r.khoanMuc || '', duAn: r.duAn || '' };
            }),
            kiemTra: function (r) {
                var loi = [], o = {};
                o.so = String(r['Số phiếu'] || '').trim();
                o.ngay = T.docNgay(r['Ngày']);
                if (!o.ngay) loi.push('ngày không hợp lệ');
                /* NHẬP TỆP KHÔNG HỎI. Đối tượng chi, khoản mục và dự án chưa có
                   trong danh mục thì Business Engine tự tạo ở bước ghi — người
                   dùng không phải khai trước, không phải trả lời hộp thoại nào.
                   Ở bước kiểm tra chỉ ghi lại ý định, chưa chạm vào cơ sở dữ liệu. */
                var lbMa = 'Mã ' + (thu ? 'khách hàng' : 'nhà cung cấp');
                var lbTen = thu ? 'Khách hàng' : 'Đối tượng chi';
                var ma = String(r[lbMa] || '').trim();
                var ten = String(r[lbTen] || '').trim();
                var dt = ma ? DB.all(cfg.doiTac).filter(function (x) { return T.kd(x.ma) === T.kd(ma); })[0] : null;
                if (!dt && ten) dt = W.mdTheoTen(cfg.doiTac, ten);
                if (!dt && !ma && !ten)
                    loi.push('thiếu cả mã lẫn tên ' + (thu ? 'khách hàng' : 'đối tượng chi'));
                o.doiTacId = dt ? dt.id : '';
                o.doiTacTen = dt ? dt.ten : ten;
                o.doiTacMa = ma;
                o.soTien = T.so(r[cfg.soTienLb]);
                if (!(o.soTien > 0)) loi.push('số tiền phải lớn hơn 0');
                o.hinhThuc = String(r['Hình thức'] || '').trim() || 'Chuyển khoản';
                if (HT.indexOf(o.hinhThuc) < 0) loi.push('hình thức phải là một trong: ' + HT.join(', '));
                o.lyDo = String(r['Nội dung'] || '').trim();
                if (!thu) {
                    o.khoanMuc = String(r['Khoản mục chi'] || '').trim();
                    o.duAn = String(r['Dự án / công trình'] || '').trim();
                }
                return { o: o, loi: loi };
            },
            ghi: function (o) {
                /* TỰ TẠO, KHÔNG HỎI — đúng nguyên tắc của phân hệ nhập tệp. */
                var dt = o.doiTacId ? DB.get(cfg.doiTac, o.doiTacId)
                                    : W.taoNhanhMD(cfg.doiTac, o.doiTacTen,
                                        o.doiTacMa ? { ma: o.doiTacMa } : null);
                var rec = { so: o.so || DB.soMoi(cfg.seq), ngay: o.ngay, donVi: DB.data._meta.ctyId,
                    soTien: o.soTien, hinhThuc: o.hinhThuc, lyDo: o.lyDo,
                    nguoiLapId: (W.Q.nhanVienCuaToi() || {}).id || '',
                    nguoiLap: (W.Q.nhanVienCuaToi() || {}).hoTen || '',
                    trangThai: 'Chưa ghi sổ', khoa: false, ghiChu: 'Nhập từ Excel' };
                rec[dtId] = dt ? dt.id : ''; rec[dtTen] = dt ? dt.ten : (o.doiTacTen || '');
                rec[ctId] = ''; rec[ctSo] = '';
                rec[cfg.nguoiK[0]] = rec[dtTen]; rec[cfg.nguoiK[1]] = rec.nguoiLap;
                if (!thu) {
                    var km = W.taoNhanhMD('khoanMucChi', o.khoanMuc) || mucKhac();
                    rec.khoanMucId = km ? km.id : ''; rec.khoanMuc = km ? km.ten : (o.khoanMuc || '');
                    var da = W.taoNhanhMD('duAn', o.duAn);
                    rec.duAnId = da ? da.id : ''; rec.duAn = da ? da.ten : (o.duAn || '');
                }
                rec.maGD = DB.maGDMoi();
                DB.insert(cfg.key, rec);
            },
            xong: function () { g.reload(rows()); kpi(); W.route(); }
        });
    }

    function kpi() {
        var all = rows(), gs = all.filter(function (x) { return x.trangThai === 'Đã ghi sổ'; });
        host.querySelector('#kpiRow').innerHTML =
            '<div class="kpi st" style="min-width:180px"><div class="lb">Tổng ' + (thu ? 'đã thu' : 'đã chi') + '</div>' +
            '<div class="vl" style="font-size:19px">' + T.money(T.sum(gs, function (x) { return x.soTien; })) + '</div>' +
            '<div class="ft">' + gs.length + ' phiếu đã ghi sổ / ' + all.length + ' phiếu</div></div>';
    }
    kpi();

    UI.apQuyen(host, mod);
    W.hangLoat(host, g, {
        mod: mod, coll: cfg.key, dt: cfg.dt, file: cfg.file, rows: rows,
        excel: [{ t: 'Số phiếu', k: 'so', w: 18 }, { t: 'Ngày', k: 'ngay', w: 12 },
                { t: thu ? 'Khách hàng' : 'Nhà cung cấp', k: dtTen, w: 40 },
                { t: 'Lý do', k: 'lyDo', w: 40 }, { t: 'Hình thức', k: 'hinhThuc', w: 16 },
                { t: 'Số tiền', k: 'soTien', w: 18 }, { t: 'Người lập', k: 'nguoiLap', w: 22 },
                { t: 'Trạng thái', k: 'trangThai', w: 14 }],
        duyetTT: 'Đã ghi sổ', huyDuyetTT: 'Chưa ghi sổ',
        inCT: true, nguoiLap: true,
        suaTruong: [
            { k: 'ngay', t: 'Ngày lập phiếu', type: 'date' },
            { k: 'hinhThuc', t: 'Hình thức thanh toán', type: 'select', opts: HT },
            { k: 'trangThai', t: 'Trạng thái', type: 'select', opts: ['Đã ghi sổ', 'Chưa ghi sổ'] },
            { k: 'ghiChu', t: 'Ghi chú', type: 'text' }
        ],
        sauKhiDoi: kpi
    });
    var qs = function (sel) { return host.querySelector(sel); };
    if (qs('[data-them]')) qs('[data-them]').onclick = function () { form(null); };
    if (qs('[data-sua]')) qs('[data-sua]').onclick = function () { var r = g.selected(); if (r) form(r); };
    if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () { var r = g.selected(); if (r) xoa(r); };
    if (qs('[data-mau]')) qs('[data-mau]').onclick = function () {
        W.tepMau({ ten: cfg.title, file: 'Mau_' + cfg.file, cols: cotNhapPhieu(cfg, thu, dtTen),
                   mau: g.allRows.slice(0, 3).map(function (r) {
                       var d = DB.get(cfg.doiTac, r[dtId]) || {};
                       return { so: r.so, ngay: T.date(r.ngay), doiTacMa: d.ma || '',
                                soTien: r.soTien, hinhThuc: r.hinhThuc, lyDo: r.lyDo }; }) });
    };
    if (qs('[data-nhap]')) qs('[data-nhap]').onclick = function () { nhapPhieu(); };
    if (qs('[data-khoa]')) qs('[data-khoa]').onclick = function () {
        var r = g.selected(); if (!r) return;
        var mo = !!r.khoa;
        UI.confirm({
            title: mo ? 'Mở khóa phiếu' : 'Khóa phiếu', icon: mo ? 'bi-unlock' : 'bi-lock-fill',
            message: (mo ? 'Mở khóa' : 'Khóa') + ' phiếu <b>' + T.esc(r.so) + '</b>?',
            note: mo ? 'Sau khi mở khóa, phiếu có thể sửa và xóa như bình thường.'
                     : 'Phiếu đã khóa <b>không sửa, không xóa, không bỏ ghi sổ</b> được.',
            okText: mo ? 'Mở khóa' : 'Khóa', okIcon: mo ? 'bi-unlock' : 'bi-lock',
            ok: function () {
                r.khoa = !mo; DB.log(mo ? 'Mở khóa' : 'Khóa chứng từ', cfg.key, r); DB.save();
                g.reload(rows()); W.route(); UI.toast('ok', mo ? 'Đã mở khóa' : 'Đã khóa phiếu', r.so);
            }
        });
    };
    qs('[data-lam]').onclick = function () { g.q = ''; g.f = {}; g.reload(rows()); kpi(); UI.toast('info', 'Đã làm mới'); };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel(cfg.file, cfg.title, [
            { t: 'Số phiếu', k: 'so', w: 18 }, { t: 'Ngày', k: 'ngay', w: 12 },
            { t: thu ? 'Khách hàng' : 'Nhà cung cấp', k: dtTen, w: 40 },
            { t: cfg.ctLb, k: ctSo, w: 18 }, { t: 'Lý do', k: 'lyDo', w: 40 },
            { t: 'Hình thức', k: 'hinhThuc', w: 16 }, { t: 'Số tiền', k: 'soTien', w: 18 },
            { t: 'Trạng thái', k: 'trangThai', w: 14 }
        ], g.allRows);
    };
    if (qs('[data-ghi]')) qs('[data-ghi]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (r.khoa) return UI.khongThe('Ghi sổ ' + cfg.dt.toLowerCase(),
            'Phiếu ' + r.so + ' đang bị khóa.', 'Bấm “Mở khóa” rồi ghi sổ lại.');
        if (r.trangThai === 'Đã ghi sổ') return UI.khongThe('Ghi sổ ' + cfg.dt.toLowerCase(),
            'Phiếu ' + r.so + ' đã ghi sổ rồi.',
            'Dùng “Bỏ ghi sổ” nếu cần ghi lại.');
        UI.confirm({ title: 'Ghi sổ ' + cfg.dt.toLowerCase(), message: 'Ghi sổ phiếu <b>' + T.esc(r.so) + '</b> — ' + T.money(r.soTien) + ' đ?',
            note: 'Sau khi ghi sổ, công nợ ' + (thu ? 'phải thu' : 'phải trả') + ' sẽ giảm tương ứng.',
            okText: 'Ghi sổ', okIcon: 'bi-check2-square',
            ok: function () { r.trangThai = 'Đã ghi sổ'; DB.log('Ghi sổ', cfg.key, r); DB.save(); g.reload(rows()); kpi(); W.route(); UI.toast('ok', 'Đã ghi sổ', r.so); } });
    };
    if (qs('[data-huyghi]')) qs('[data-huyghi]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (r.khoa) return UI.khongThe('Bỏ ghi sổ',
            'Phiếu ' + r.so + ' đang bị khóa.', 'Bấm “Mở khóa” rồi bỏ ghi sổ lại.');
        if (r.trangThai !== 'Đã ghi sổ') return UI.khongThe('Bỏ ghi sổ',
            'Phiếu ' + r.so + ' chưa ghi sổ nên không có gì để bỏ.',
            'Chỉ phiếu ở trạng thái “Đã ghi sổ” mới bỏ ghi sổ được.');
        UI.confirm({ title: 'Bỏ ghi sổ', danger: true, message: 'Bỏ ghi sổ phiếu <b>' + T.esc(r.so) + '</b>?',
            okText: 'Bỏ ghi sổ', ok: function () { r.trangThai = 'Chưa ghi sổ'; DB.save(); g.reload(rows()); kpi(); W.route(); UI.toast('warn', 'Đã bỏ ghi sổ', r.so); } });
    };

    function xoa(r) {
        UI.xoaChuan({
            coll: cfg.key, rec: r, mod: mod, ten: cfg.dt + ' ' + r.so,
            sauKhi: function () { g.selId = null; g.reload(rows()); kpi(); W.route(); }
        });
    }

    function form(rec, ro) {
        var moi = !rec || !rec.id;
        if (!ro) {
            if (moi && !qThem) return UI.thieuQuyen(mod, 'them');
            if (!moi && !qSua) ro = true;
            if (!moi && rec && rec.khoa) { UI.daKhoa(rec); ro = true; }
        }
        rec = rec ? T.clone(rec) : {
            so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, soTien: 0, hinhThuc: 'Chuyển khoản',
            lyDo: '', trangThai: 'Đã ghi sổ', ghiChu: ''
        };
        rec[dtId] = rec[dtId] || ''; rec[ctId] = rec[ctId] || '';
        var dsCT = [];

        UI.modal({
            size: 'lg', title: (ro ? 'Xem ' : moi ? 'Lập ' : 'Sửa ') + cfg.dt + (rec.so ? ' — ' + rec.so : ''),
            sub: 'Đơn vị phát hành: ' + DB.cty().ten,
            body: '<div class="grid2">' +
                '<div class="fld"><label>Số phiếu</label><input data-f="so" value="' + T.esc(rec.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
                '<div class="fld req"><label>Ngày lập phiếu</label><input type="date" data-f="ngay" value="' + T.esc(rec.ngay) + '"></div>' +
                /* ĐỐI TƯỢNG CHI / THU LÀ COMBOBOX ĐẦY ĐỦ: gõ trực tiếp · tìm kiếm ·
                   chọn từ danh sách · chưa có thì tạo ngay tại chỗ. Không bắt
                   người dùng rời chứng từ đi khai danh mục trước. */
                W.oMD(cfg.doiTac, { f: 'dtId', fTen: 'dtTen', nhan: cfg.doiTacLb,
                                    gt: rec[dtId], gtTen: rec[dtTen], rong: true, req: true, tuDo: true,
                                    onChon: function (r, v) { if (W.__vcDoiTac) W.__vcDoiTac(v); } }) +
                (thu ? '' :
                 W.oMD('khoanMucChi', { f: 'khoanMucId', fTen: 'khoanMuc', nhan: 'Khoản mục chi',
                                        gt: rec.khoanMucId, gtTen: rec.khoanMuc, rong: true, tuDo: true,
                                        onChon: function () { if (W.__vcKhoanMuc) W.__vcKhoanMuc(); } }) +
                 W.oMD('duAn', { f: 'duAnId', fTen: 'duAn', nhan: 'Dự án / công trình',
                                 gt: rec.duAnId, gtTen: rec.duAn, rong: true, tuDo: true })) +
                (thu ? '' : '<div class="fld span2" id="kmInfo"></div>') +
                '<div class="fld span2"><label>' + cfg.ctLb + ' liên quan</label><select data-f="ctId" id="selCT"></select>' +
                '<div class="small muted mt8" id="ctInfo"></div></div>' +
                '<div class="fld req"><label>' + cfg.soTienLb + ' (đ)</label><input class="num-in num" data-f="soTien" value="' + T.esc(rec.soTien || 0) + '" style="font-size:16px;font-weight:700"></div>' +
                '<div class="fld"><label>Hình thức thanh toán</label><select data-f="hinhThuc">' + opt(HT, rec.hinhThuc) + '</select></div>' +
                '<div class="fld span2"><label>Lý do / nội dung</label><input data-f="lyDo" value="' + T.esc(rec.lyDo || '') + '"></div>' +
                '<div class="fld"><label>' + cfg.nguoiLb[0] + '</label><input data-f="ng1" value="' + T.esc(rec[cfg.nguoiK[0]] || '') + '"></div>' +
                '<div class="fld"><label>' + cfg.nguoiLb[1] + '</label><input data-f="ng2" value="' + T.esc(rec[cfg.nguoiK[1]] || DB.user().hoTen) + '"></div>' +
                W.oNguoiLap(rec, cfg.key) +
                '<div class="fld"><label>Công ty thực hiện</label><select data-f="donVi">' +
                    opt(DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat + ' — ' + d.ten }; }), rec.donVi || DB.data._meta.ctyId) + '</select></div>' +
                '<div class="fld"><label>Trạng thái</label>' +
                '<input value="' + T.esc(rec.trangThai || 'Chưa ghi sổ') + '" readonly ' +
                'title="Trạng thái nghiệp vụ do hệ thống tự chuyển khi bấm Ghi sổ / Bỏ ghi sổ">' +
                '<input type="hidden" data-f="trangThai" value="' + T.esc(rec.trangThai || 'Chưa ghi sổ') + '">' +
                '<div class="small muted" style="margin-top:2px">Hệ thống tự chuyển khi bấm Ghi sổ</div></div>' +
                '<div class="fld span2"><label>Ghi chú</label><textarea data-f="ghiChu" rows="2">' + T.esc(rec.ghiChu || '') + '</textarea></div>' +
                '</div>' +
                /* Phần định khoản in ra trên chứng từ kế toán. Để trống thì phần
                   mềm tự điền theo nghiệp vụ và hình thức thanh toán. */
                '<div class="mt12"><div class="small muted mb8"><b>Phần kế toán</b> — in trên phiếu theo mẫu ' +
                    T.esc((T.MAU_SO_KT[cfg.key] || {}).ma || '') + '. Để trống thì phần mềm tự điền.</div>' +
                '<div class="grid4">' +
                '<div class="fld"><label>Quyển số</label><input data-f="quyenSo" value="' + T.esc(rec.quyenSo || '') + '" placeholder="' + T.esc(T.quyenSo(rec)) + '"></div>' +
                '<div class="fld"><label>Tài khoản Nợ</label><input data-f="tkNo" value="' + T.esc(rec.tkNo || '') + '" placeholder="' + T.esc(T.dinhKhoan(cfg.key, rec).no) + '"></div>' +
                '<div class="fld"><label>Tài khoản Có</label><input data-f="tkCo" value="' + T.esc(rec.tkCo || '') + '" placeholder="' + T.esc(T.dinhKhoan(cfg.key, rec).co) + '"></div>' +
                '<div class="fld"><label>Số chứng từ gốc kèm theo</label><input class="num-in num" data-f="soChungTuGoc" value="' + T.esc(rec.soChungTuGoc || '') + '" placeholder="0"></div>' +
                '</div></div>' +
                '<div id="noBox" class="mt12"></div>',
            buttons: ro ? [
                { text: 'Đóng', click: function (h) { h.close(); } },
                { text: 'Xuất PDF', icon: 'bi-file-earmark-pdf', click: function () { W.xuatPDF(cfg.key, rec); } },
                { text: 'Xuất Word', icon: 'bi-file-earmark-word', click: function () { W.xuatWordChungTu(cfg.key, rec); } },
                { text: 'Xuất Excel (Biểu mẫu)', icon: 'bi-file-earmark-spreadsheet',
                  click: function () { W.xuatExcelMauChungTu(cfg.key, rec); } },
                { text: 'Sửa', icon: 'bi-pencil', click: function (h) { h.close(); form(rec); } },
                { text: 'Xem trước khi in', cls: 'primary', icon: 'bi-printer',
                  click: function () { W.inChungTu(cfg.key, rec); } }
            ] : [
                { text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } },
                { text: 'Lưu và xem trước', icon: 'bi-printer', click: function (h) { luu(h, rec, moi, true); } },
                { text: 'Lưu', cls: 'primary', icon: 'bi-check-lg', click: function (h) { luu(h, rec, moi); } }
            ],
            onOpen: function (h) {
                UI.numInput(h.el);
                h._md = W.bindMD(h.el);
                /* Đổi đối tượng thì nạp lại danh sách chứng từ gốc và bảng công nợ;
                   đổi khoản mục thì vẽ lại lời giải thích khoản chi đó. */
                W.__vcDoiTac = function (v) { napCT(h, v, rec); };
                W.__vcKhoanMuc = function () { veKhoanMuc(h); };
                W.bindNguoiLap(h, rec, cfg.key, ro);
                napCT(h, rec[dtId], rec);
                if (!thu) veKhoanMuc(h);
                h.q('#selCT').onchange = function () { chonCT(h, rec); };
                if (ro) {
                    h.el.querySelectorAll('input,select,textarea').forEach(function (e) { e.disabled = true; });
                    h.el.querySelectorAll('[data-mdcb]').forEach(function (e) { e.style.pointerEvents = 'none'; });
                }
            },
            onClose: function () { W.__vcDoiTac = null; W.__vcKhoanMuc = null; }
        });

        function napCT(h, dtid, rec) {
            dsCT = DB.all(cfg.chungTuGoc).filter(function (d) {
                return d[dtId] === dtid && d.trangThai !== 'Nháp' && d.trangThai !== 'Đã hủy';
            });
            h.q('#selCT').innerHTML = '<option value="">— Không gắn chứng từ —</option>' +
                dsCT.map(function (d) {
                    var da = T.sum(DB.all(cfg.key).filter(function (p) { return p[ctId] === d.id && p.trangThai === 'Đã ghi sổ' && p.id !== rec.id; }), function (p) { return p.soTien; });
                    return '<option value="' + d.id + '"' + (rec[ctId] === d.id ? ' selected' : '') + '>' +
                        T.esc(d.so) + ' — ' + T.date(d.ngay) + ' — ' + T.money(d.tongCong) + ' đ (còn ' + T.money(d.tongCong - da) + ')</option>';
                }).join('');
            chonCT(h, rec);
            noBox(h, dtid);
        }
        function chonCT(h, rec) {
            var id = h.q('#selCT').value;
            var d = DB.get(cfg.chungTuGoc, id);
            if (!d) { h.q('#ctInfo').innerHTML = ''; return; }
            var da = T.sum(DB.all(cfg.key).filter(function (p) { return p[ctId] === d.id && p.trangThai === 'Đã ghi sổ' && p.id !== rec.id; }), function (p) { return p.soTien; });
            var con = d.tongCong - da;
            h.q('#ctInfo').innerHTML = 'Giá trị chứng từ <b>' + T.money(d.tongCong) + '</b> đ · đã ' + (thu ? 'thu' : 'chi') +
                ' <b>' + T.money(da) + '</b> đ · còn lại <b class="' + (con > 0 ? 'neg' : 'pos') + '">' + T.money(con) + '</b> đ ' +
                '<span class="link" id="lnkDu">(điền số còn lại)</span>';
            var l = h.q('#lnkDu');
            if (l) l.onclick = function () {
                h.q('[data-f="soTien"]').value = Number(Math.max(0, con)).toLocaleString('vi-VN');
                if (!h.q('[data-f="lyDo"]').value) h.q('[data-f="lyDo"]').value = (thu ? 'Thanh toán' : 'Chi trả') + ' chứng từ ' + d.so;
            };
        }
        /* Nói rõ ngay trên biểu mẫu khoản chi này có vào báo cáo lãi lỗ hay không —
           người lập phiếu biết mình đang ghi cái gì, không phải đoán. */
        function veKhoanMuc(h) {
            var o = h.q('#kmInfo'); if (!o) return;
            var id = (h.q('[data-f="khoanMucId"]') || {}).value || '';
            var km = id ? DB.get('khoanMucChi', id) : null;
            if (!km) {
                o.innerHTML = '<div class="note b"><i class="bi bi-info-circle"></i><div>' +
                    'Chưa chọn khoản mục chi. Gõ tên khoản mục vào ô trên — chưa có trong danh mục thì ' +
                    'bấm <b>Tạo mới</b> ngay tại đây.</div></div>';
                return;
            }
            var vao = km.vaoChiPhi !== false, no = !!km.giamCongNo;
            o.innerHTML = '<div class="note ' + (vao ? 'b' : 'y') + '"><i class="bi bi-' +
                (vao ? 'graph-down-arrow' : 'shield-check') + '"></i><div>' +
                (vao ? '<b>Tính vào Chi phí</b> của báo cáo lãi lỗ.'
                     : '<b>Không tính vào Chi phí.</b> Khoản này đã nằm trong giá vốn hàng hóa từ lúc nhập kho — ' +
                       'tính thêm một lần nữa là tính hai lần cùng một khoản tiền.') +
                '<br>' + (no ? 'Làm <b>giảm công nợ phải trả</b> nhà cung cấp.'
                             : 'Không làm giảm công nợ phải trả nhà cung cấp.') +
                /* v18.6.0 — Logic 3. Nói thẳng khoản này lên chỉ tiêu nào của
                   Báo cáo kết quả hoạt động kinh doanh, để không ai phải đoán. */
                (function () {
                    var n = T.nhomChiBC({ khoanMucId: km.id });
                    if (!vao) return '';
                    if (n === 'thueTNDN') return '<br>Lên chỉ tiêu <b>mã số 51 — Chi phí thuế ' +
                        'thu nhập doanh nghiệp</b>.';
                    if (n === 'thue') return '<br>Lên chỉ tiêu <b>mã số 26 — Chi phí quản lý ' +
                        'doanh nghiệp</b>. Đây KHÔNG phải thuế TNDN nên không vào mã số 51.';
                    var t = T.NHOM_CHI_BC.filter(function (x) { return x.k === n; })[0];
                    return t ? '<br>Trình bày ở nhóm <b>' + T.esc(t.t) + '</b> của báo cáo KQHĐKD.' : '';
                })() +
                (km.moTa ? '<br><span class="muted">' + T.esc(km.moTa) + '</span>' : '') +
                '</div></div>';
        }

        function noBox(h, dtid) {
            if (!dtid) { h.q('#noBox').innerHTML = ''; return; }
            var n = thu ? T.congNoKH(dtid) : T.congNoNCC(dtid);
            h.q('#noBox').innerHTML = '<div class="note ' + (n.conLai > 0 ? 'y' : 'g') + '"><i class="bi bi-journal-bookmark"></i><div>' +
                'Công nợ hiện tại: phát sinh <b>' + T.money(n.phatSinh) + '</b> đ · đã ' + (thu ? 'thu' : 'trả') + ' <b>' +
                T.money(thu ? n.daThu : n.daTra) + '</b> đ · <b>còn lại ' + T.money(n.conLai) + ' đ</b></div></div>';
        }

        function luu(h, rec, moi, thenPrint) {
            /* TỰ TẠO KHI CHƯA CÓ — người dùng gõ thẳng tên vào ô chọn rồi bấm Lưu,
               không phải rời chứng từ đi khai danh mục rồi quay lại.
               NHƯNG CHỈ TẠO SAU KHI CẢ BIỂU MẪU ĐÃ HỢP LỆ. Tạo trước lúc kiểm
               tra sẽ để lại rác trong danh mục mỗi lần người dùng bấm Lưu hụt
               hoặc bấm Hủy — chữ đang gõ dở cũng thành một nhà cung cấp thật. */
            function chuDangGo(truong) {
                var a = h._md && h._md[truong];
                var s2 = (a && a.combo && a.combo.tuKhoa && a.combo.tuKhoa()) || '';
                return String(s2).trim();
            }
            function tenDaGo(truong, truongTen, v0) {
                return String((v0 && v0[truongTen]) || '').trim() || chuDangGo(truong);
            }
            var vt = UI.read(h.el);
            var tenDT = tenDaGo('dtId', 'dtTen', vt);
            if (!UI.validate(h.el, [
                    { k: 'dtId', test: function (v) { return !!v || tenDT.length >= 2; },
                      msg: 'Phải chọn hoặc gõ tên ' + cfg.doiTacLb.toLowerCase() },
                    { k: 'ngay' },
                    { k: 'nguoiLapId', msg: 'Phải chọn người lập' },
                    { k: 'soTien', test: function (v) { return Number(String(v).replace(/[^\d]/g, '')) > 0; },
                      msg: 'Số tiền phải lớn hơn 0' }])) return;

            /* Từ đây trở đi chắc chắn phiếu sẽ được lưu — mới tạo danh mục. */
            var v0 = vt;
            if (!v0.dtId && tenDT.length >= 2) {
                var rDT = W.taoNhanhMD(cfg.doiTac, tenDT);
                if (!rDT) return UI.khongThe('Lưu ' + cfg.dt.toLowerCase(),
                    'Chưa có "' + tenDT + '" trong danh mục ' + cfg.doiTacLb.toLowerCase() + '.',
                    'Vai trò hiện tại không được phép thêm mới danh mục này. ' +
                    'Chọn một đối tượng đã có, hoặc đề nghị quản trị cấp quyền thêm mới.');
                v0.dtId = rDT.id;
            }
            if (!thu && !v0.khoanMucId) {
                var tenKM = tenDaGo('khoanMucId', 'khoanMuc', v0);
                if (tenKM.length >= 2) v0.khoanMucId = (W.taoNhanhMD('khoanMucChi', tenKM) || {}).id || '';
            }
            if (!thu && !v0.duAnId) {
                var tenDA = tenDaGo('duAnId', 'duAn', v0);
                if (tenDA.length >= 2) v0.duAnId = (W.taoNhanhMD('duAn', tenDA) || {}).id || '';
            }
            var oId = h.q('[data-f="dtId"]'); if (oId) oId.value = v0.dtId || '';
            var oKm = h.q('[data-f="khoanMucId"]'); if (oKm) oKm.value = v0.khoanMucId || '';
            var oDa = h.q('[data-f="duAnId"]'); if (oDa) oDa.value = v0.duAnId || '';
            var v = UI.read(h.el);
            var dt = DB.get(cfg.doiTac, v.dtId);
            var ct = DB.get(cfg.chungTuGoc, v.ctId);
            var o = { so: rec.so || DB.soMoi(cfg.seq), ngay: v.ngay, donVi: v.donVi,
                soTien: v.soTien, hinhThuc: v.hinhThuc, lyDo: v.lyDo, trangThai: v.trangThai, ghiChu: v.ghiChu };
            o.nguoiLapId = v.nguoiLapId; o.nguoiLap = W.tenNguoiLap(v.nguoiLapId);
            o[dtId] = v.dtId; o[dtTen] = dt ? dt.ten : (v.dtTen || '');
            if (!thu) {
                var km = v.khoanMucId ? DB.get('khoanMucChi', v.khoanMucId) : null;
                o.khoanMucId = v.khoanMucId || '';
                o.khoanMuc = km ? km.ten : (v.khoanMuc || '');
                var da = v.duAnId ? DB.get('duAn', v.duAnId) : null;
                o.duAnId = v.duAnId || '';
                o.duAn = da ? da.ten : (v.duAn || '');
            }
            /* Khóa và mã giao dịch là thuộc tính của chính phiếu, không nằm trên
               biểu mẫu — phải mang sang bản ghi mới, nếu không sửa phiếu là mất. */
            o.khoa = rec.khoa || false;
            o.maGD = rec.maGD || DB.maGDMoi();
            o[ctId] = v.ctId || ''; o[ctSo] = ct ? ct.so : '';
            o[cfg.nguoiK[0]] = v.ng1; o[cfg.nguoiK[1]] = v.ng2;
            o.quyenSo = v.quyenSo || ''; o.tkNo = v.tkNo || ''; o.tkCo = v.tkCo || '';
            o.soChungTuGoc = v.soChungTuGoc === '' || v.soChungTuGoc === undefined ? '' : v.soChungTuGoc;
            /* CHỐNG TRỪ TIỀN HAI LẦN (v18.6.0 — Logic 1). Engine đã chặn ở
               DB.insert / DB.update và tự hiện thông báo; ở đây chỉ cần kiểm
               trước để GIỮ BIỂU MẪU LẠI cho người dùng sửa — không đóng cửa sổ,
               không báo "đã lưu" cho một phiếu chưa hề được ghi. */
            if (!thu && T.chanChiTrung && T.chanChiTrung(o, moi ? null : rec)) return;
            var luuXong;
            if (moi) luuXong = DB.insert(cfg.key, o); else luuXong = DB.update(cfg.key, rec.id, o) || o;
            if (!luuXong) return;
            h.close(); g.reload(rows()); kpi(); W.route();
            UI.toast('ok', moi ? 'Đã lập ' + cfg.dt.toLowerCase() : 'Đã cập nhật', o.so + ' — ' + T.money(o.soTien) + ' đ');
            // Quay lại đúng màn hình xem trước của chính chứng từ vừa sửa
            if (W.__sauLuu) { var f = W.__sauLuu; W.__sauLuu = null; setTimeout(function () { f(luuXong); }, 120); }
            else if (thenPrint) setTimeout(function () { W.inChungTu(cfg.key, o); }, 250);
        }
    }
    W.__docForm = form;
    W.__voucherForm = form;
    W.__voucherScreen = VoucherScreen;
    W.FORM_CT = W.FORM_CT || {};
    W.FORM_CT[cfg.key] = form;                    // dùng cho nút "Chỉnh sửa" ở cửa sổ xem trước
}

/* --------- Lập phiếu thu nhanh từ đơn bán --------- */
W.taoPhieuThu = function (db, done) {
    var da = T.sum(DB.all('phieuThu').filter(function (p) { return p.donBanId === db.id && p.trangThai === 'Đã ghi sổ'; }), function (p) { return p.soTien; });
    var con = db.tongCong - da;
    UI.modal({
        size: 'md', title: 'Lập phiếu thu cho đơn hàng ' + db.so,
        sub: db.khachHang,
        body: '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>Giá trị đơn hàng <b>' + T.money(db.tongCong) +
            '</b> đ · đã thu <b>' + T.money(da) + '</b> đ · <b>còn phải thu ' + T.money(con) + ' đ</b></div></div>' +
            '<div class="grid2">' +
            '<div class="fld req"><label>Ngày thu</label><input type="date" data-f="ngay" value="' + T.today() + '"></div>' +
            '<div class="fld"><label>Hình thức</label><select data-f="hinhThuc">' + opt(HT, 'Chuyển khoản') + '</select></div>' +
            '<div class="fld req span2"><label>Số tiền thu (đ)</label>' +
            '<input class="num-in num" data-f="soTien" value="' + Number(Math.max(0, con)).toLocaleString('vi-VN') + '" style="font-size:18px;font-weight:700"></div>' +
            '<div class="row span2" style="grid-column:span 2">' +
            '<button class="btn sm" data-ty="30">30%</button><button class="btn sm" data-ty="50">50%</button>' +
            '<button class="btn sm" data-ty="70">70%</button><button class="btn sm" data-ty="100">Toàn bộ còn lại</button></div>' +
            '<div class="fld span2"><label>Lý do</label><input data-f="lyDo" value="Thanh toán đơn hàng ' + T.esc(db.so) + '"></div>' +
            '<div class="fld"><label>Người nộp</label><input data-f="nguoiNop" value="' + T.esc(db.khachHang) + '"></div>' +
            '<div class="fld"><label>Người thu</label><input data-f="nguoiThu" value="' + T.esc(DB.user().hoTen) + '"></div>' +
            '</div>',
        buttons: [
            { text: 'Hủy', click: function (h) {
                    h.close();
                    if (W.__huyLuu) { var f = W.__huyLuu; W.__huyLuu = null; W.__sauLuu = null; f(); }
                } },
            { text: 'Lập phiếu thu', cls: 'primary', icon: 'bi-cash-coin', click: function (h) {
                var v = UI.read(h.el);
                if (!(v.soTien > 0)) { UI.toast('err', 'Số tiền phải lớn hơn 0'); return; }
                var o = { so: DB.soMoi('PT'), ngay: v.ngay, donVi: db.donVi, khachHangId: db.khachHangId,
                    khachHang: db.khachHang, donBanId: db.id, donBanSo: db.so, soTien: v.soTien,
                    hinhThuc: v.hinhThuc, lyDo: v.lyDo, nguoiNop: v.nguoiNop, nguoiThu: v.nguoiThu,
                    nguoiLapId: (W.Q.nhanVienCuaToi() || {}).id || '',
                    nguoiLap: (W.Q.nhanVienCuaToi() || {}).hoTen || '',
                    /* Phiếu thu thuộc đúng thương vụ của đơn bán — gán mã giao
                       dịch ngay lúc tạo, đúng bằng mã T.ganMaGD sẽ gán sau. */
                    maGD: db.maGD || '',
                    trangThai: 'Đã ghi sổ', ghiChu: '' };
                DB.insert('phieuThu', o);
                h.close(); if (done) done(); W.route();
                UI.toast('ok', 'Đã lập phiếu thu ' + o.so, T.money(o.soTien) + ' đ');
                setTimeout(function () { W.moChungTu('phieuThu', o.id); }, 400);
            } }
        ],
        onOpen: function (h) {
            UI.numInput(h.el);
            h.el.querySelectorAll('[data-ty]').forEach(function (b) {
                b.onclick = function () {
                    var p = Number(b.getAttribute('data-ty'));
                    var s = p === 100 ? con : Math.round(db.tongCong * p / 100);
                    h.q('[data-f="soTien"]').value = Number(Math.max(0, s)).toLocaleString('vi-VN');
                };
            });
        }
    });
};

/* ==========================================================================
   CÔNG NỢ
   ========================================================================== */
S['cong-no'] = function (host) {
    var tab = 'kh';
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Công nợ</h2>' +
        '<div class="sub">Sổ theo dõi công nợ phải thu khách hàng và phải trả nhà cung cấp — tính trực tiếp từ chứng từ gốc</div></div></div>' +
        '<div class="tabs"><div class="tab on" data-tab="kh"><i class="bi bi-people"></i> Công nợ phải thu (Khách hàng)</div>' +
        '<div class="tab" data-tab="ncc"><i class="bi bi-truck"></i> Công nợ phải trả (Nhà cung cấp)</div></div>' +
        '<div id="kpi" class="kpis"></div><div id="gh"></div></div>';
    W.crumb(['Thu chi & Công nợ', 'Công nợ']);

    function ve() {
        var rows, cols, kpis;
        if (tab === 'kh') {
            rows = DB.all('khachHang').map(function (c) {
                var n = T.congNoKH(c.id);
                return { id: c.id, ma: c.ma, ten: c.ten, loai: c.loai, duAn: c.duAn,
                    soDon: n.soDon, phatSinh: n.phatSinh, daThu: n.daThu, conLai: n.conLai,
                    hanMuc: c.hanMucNo, tt: n.conLai <= 0 ? 'Đã thanh toán' : (c.hanMucNo && n.conLai > c.hanMucNo ? 'Quá hạn mức' : 'Còn nợ') };
            }).filter(function (r) { return r.soDon > 0 || r.conLai !== 0; });
            cols = [
                { k: 'ma', t: 'Mã KH', w: 92, cls: 'mono' },
                { k: 'ten', t: 'Khách hàng', r: function (v, r) {
                    return '<b>' + T.esc(v) + '</b>' + (r.duAn ? '<div class="small muted ellip">' + T.esc(r.duAn) + '</div>' : ''); } },
                { k: 'soDon', t: 'Số đơn', w: 82, cls: 'num', fmt: 'num' },
                { k: 'phatSinh', t: 'Phát sinh', w: 152, cls: 'num', fmt: 'money', total: true },
                { k: 'daThu', t: 'Đã thu', w: 152, cls: 'num', total: true, r: function (v) { return '<span class="pos">' + T.money(v) + '</span>'; } },
                { k: 'conLai', t: 'Còn phải thu', w: 156, cls: 'num', total: true,
                  r: function (v) { return v > 0 ? '<b class="neg">' + T.money(v) + '</b>' : '<span class="muted">0</span>'; } },
                { k: 'tt', t: 'Tình trạng', w: 140, r: function (v) { return T.pill(v === 'Quá hạn mức' ? 'Quá hạn' : v); } }
            ];
        } else {
            rows = DB.all('nhaCungCap').map(function (c) {
                var n = T.congNoNCC(c.id);
                return { id: c.id, ma: c.ma, ten: c.ten, loai: c.nhomHang, soDon: n.soDon,
                    phatSinh: n.phatSinh, daThu: n.daTra, conLai: n.conLai,
                    tt: n.conLai <= 0 ? 'Đã thanh toán' : 'Còn nợ' };
            });
            cols = [
                { k: 'ma', t: 'Mã NCC', w: 108, cls: 'mono' },
                { k: 'ten', t: 'Nhà cung cấp', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
                { k: 'soDon', t: 'Số đơn mua', w: 110, cls: 'num', fmt: 'num' },
                { k: 'phatSinh', t: 'Phát sinh', w: 152, cls: 'num', fmt: 'money', total: true },
                { k: 'daThu', t: 'Đã trả', w: 152, cls: 'num', total: true, r: function (v) { return '<span class="pos">' + T.money(v) + '</span>'; } },
                { k: 'conLai', t: 'Còn phải trả', w: 156, cls: 'num', total: true,
                  r: function (v) { return v > 0 ? '<b class="neg">' + T.money(v) + '</b>' : '<span class="muted">0</span>'; } },
                { k: 'tt', t: 'Tình trạng', w: 140, r: function (v) { return T.pill(v); } }
            ];
        }
        var ps = T.sum(rows, function (r) { return r.phatSinh; }),
            dt = T.sum(rows, function (r) { return r.daThu; }),
            cl = T.sum(rows, function (r) { return r.conLai; });
        host.querySelector('#kpi').innerHTML =
            k('Số đối tượng', T.num(rows.length, 0), '', '') +
            k('Tổng phát sinh', T.money(ps), 'đ', '') +
            k(tab === 'kh' ? 'Đã thu' : 'Đã trả', T.money(dt), 'đ', 'g') +
            k(tab === 'kh' ? 'Còn phải thu' : 'Còn phải trả', T.money(cl), 'đ', cl > 0 ? 'r' : 'g') +
            k('Tỷ lệ thu hồi', ps ? T.num(dt / ps * 100, 1) + '%' : '0%', '', 'c') +
            k('Số còn nợ', T.num(rows.filter(function (r) { return r.conLai > 0; }).length, 0), 'đối tượng', 'y');

        new UI.Grid({
            mount: '#gh', rows: rows, pageSize: 20, height: 'calc(100vh - 400px)', sortK: 'conLai', sortD: -1,
            search: ['ma', 'ten', 'duAn'],
            toolbar: '<button class="btn" data-ct disabled><i class="bi bi-list-columns"></i> Xem chi tiết công nợ</button>' +
                '<span class="tb-sep"></span>' +
                '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
                '<button class="btn primary" data-in title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel"><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>',
            filters: [{ k: 'tt', t: 'Tình trạng', w: 170, opts: ['Còn nợ', 'Đã thanh toán', 'Quá hạn mức'] }],
            cols: cols,
            actions: function () { return UI.btn('ct', 'bi-list-columns', 'Xem chi tiết'); }, actionsW: 50,
            onAction: function (a, r) { if (a === 'ct') chiTiet(r); },
            onSelect: UI.chonToolbar(host, ['ct']),
            onOpen: function (r) { chiTiet(r); }
        });
        var g = W.__grid;
        host.querySelector('[data-ct]').onclick = function () {
            var s = document.querySelector('#gh tbody tr.sel');
            if (s) chiTiet(rows.filter(function (r) { return r.id === s.getAttribute('data-id'); })[0]);
        };
        host.querySelector('[data-xuat]').onclick = function () {
            UI.xuatExcel('CongNo_' + (tab === 'kh' ? 'KhachHang' : 'NhaCungCap'), 'Công nợ',
                cols.map(function (c) { return { t: c.t, k: c.k, w: 20 }; }), rows);
        };
        host.querySelector('[data-in]').onclick = function () { inCongNo(rows, cols); };
    }
    function k(l, v, u, c) {
        return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div>' +
            '<div class="vl">' + v + '</div><div class="ft">' + (u || '&nbsp;') + '</div></div>';
    }

    function chiTiet(r) {
        if (!r) return;
        var la = tab === 'kh';
        var don = la ? DB.all('donBan').filter(function (d) { return d.khachHangId === r.id && d.trangThai !== 'Nháp' && d.trangThai !== 'Đã hủy'; })
                     : DB.all('donMua').filter(function (d) {
                           return d.nhaCungCapId === r.id && T.donMuaPhatSinhCongNo(d); });
        /* Sổ chi tiết phải khớp với chính con số công nợ in ở đầu cửa sổ. Phiếu
           chi lương, thuê văn phòng, công tác phí… không phải thanh toán cho đơn
           mua hàng nên T.congNoNCC không trừ vào công nợ — sổ chi tiết cũng
           không được liệt kê, nếu không hai con số trong cùng một cửa sổ đá nhau. */
        var phieu = la ? DB.all('phieuThu').filter(function (p) { return p.khachHangId === r.id; })
                       : DB.all('phieuChi').filter(function (p) {
                             return p.nhaCungCapId === r.id && T.chiGiamCongNo(p); });
        var sk = [];
        don.forEach(function (d) { sk.push({ ngay: d.ngay, so: d.so, nd: la ? 'Bán hàng' : 'Mua hàng', no: d.tongCong, co: 0, id: d.id, k: la ? 'donBan' : 'donMua' }); });
        phieu.forEach(function (p) { sk.push({ ngay: p.ngay, so: p.so, nd: (la ? 'Thu tiền' : 'Chi tiền') + ' — ' + p.hinhThuc, no: 0, co: p.trangThai === 'Đã ghi sổ' ? p.soTien : 0, id: p.id, k: la ? 'phieuThu' : 'phieuChi' }); });
        /* NHẬP KHO LÀ ĐÃ TRẢ TIỀN (v18.6.0). Khoản này đã trừ vào công nợ ở
           T.congNoNCC nên sổ chi tiết BẮT BUỘC phải liệt kê, nếu không hai con
           số trong cùng một cửa sổ lại đá nhau. */
        if (!la) DB.all('phieuNhap').filter(function (p) {
            return T.nhapDaTra(p) && p.nhaCungCapId === r.id;
        }).forEach(function (p) {
            sk.push({ ngay: p.ngay, so: p.so, nd: 'Thanh toán qua nhập kho', no: 0,
                      co: Number(p.soTienThanhToan) || T.giaTriPhieuNhap(p),
                      id: p.id, k: 'phieuNhap' });
        });
        sk.sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });
        var luy = 0;
        UI.modal({
            size: 'xl', title: 'Sổ chi tiết công nợ — ' + r.ten,
            sub: (la ? 'Phải thu' : 'Phải trả') + ': ' + T.money(r.conLai) + ' đ',
            body: '<div class="grid4 mb12">' +
                kp('Số chứng từ', don.length + ' ' + (la ? 'đơn bán' : 'đơn mua')) +
                kp('Phát sinh', T.money(r.phatSinh) + ' đ') +
                kp(la ? 'Đã thu' : 'Đã trả', T.money(r.daThu) + ' đ', 'g') +
                kp('Còn lại', T.money(r.conLai) + ' đ', r.conLai > 0 ? 'r' : 'g') + '</div>' +
                '<div class="tablewrap" style="max-height:420px"><table class="grid"><thead><tr>' +
                '<th style="width:44px">TT</th><th style="width:104px">Ngày</th><th style="width:160px">Số chứng từ</th>' +
                '<th>Nội dung</th><th class="num" style="width:150px">Phát sinh</th>' +
                '<th class="num" style="width:150px">' + (la ? 'Thu' : 'Trả') + '</th>' +
                '<th class="num" style="width:160px">Lũy kế còn lại</th></tr></thead><tbody>' +
                (sk.length ? sk.map(function (x, i) {
                    luy += x.no - x.co;
                    return '<tr><td class="ctr muted">' + (i + 1) + '</td><td>' + T.date(x.ngay) + '</td>' +
                        '<td class="mono"><span class="link" onclick="W.moChungTu(\'' + x.k + '\',\'' + x.id + '\')">' + T.esc(x.so) + '</span></td>' +
                        '<td>' + T.esc(x.nd) + '</td><td class="num">' + (x.no ? T.money(x.no) : '') + '</td>' +
                        '<td class="num pos">' + (x.co ? T.money(x.co) : '') + '</td>' +
                        '<td class="num b">' + T.money(luy) + '</td></tr>';
                }).join('') : '<tr><td colspan="7"><div class="empty"><i class="bi bi-inbox"></i><b>Chưa phát sinh công nợ</b></div></td></tr>') +
                '</tbody></table></div>',
            buttons: [
                { text: 'Đóng', click: function (h) { h.close(); } },
                { text: 'In sổ chi tiết', icon: 'bi-printer', click: function () { inSoChiTiet(r, sk, la); } },
                (la && r.conLai > 0 ? { text: 'Lập phiếu thu', cls: 'primary', icon: 'bi-cash-coin', click: function (h) {
                    h.close();
                    var d = don.filter(function (x) { return x.tongCong > 0; })[0];
                    if (d) W.taoPhieuThu(d, function () { W.go('phieu-thu'); });
                    else UI.toast('warn', 'Khách hàng chưa có đơn bán');
                } } : { text: 'Đóng cửa sổ', click: function (h) { h.close(); } })
            ]
        });
    }
    function kp(l, v, c) {
        return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div><div class="vl" style="font-size:17px">' + v + '</div></div>';
    }

    function inCongNo(rows, cols) {
        W.inBaoCao({
            tieu: 'BẢNG TỔNG HỢP CÔNG NỢ ' + (tab === 'kh' ? 'PHẢI THU' : 'PHẢI TRẢ'),
            thoiDiem: T.today(),
            dieuKien: [
                { t: 'Đối tượng', v: tab === 'kh' ? 'Khách hàng' : 'Nhà cung cấp' },
                { t: 'Phạm vi', v: DB.data._meta.locTheoCty ? DB.cty().ten : 'Toàn bộ đơn vị' }
            ],
            cols: cols.map(function (c) {
                return { t: c.t, k: c.k, tong: ['soDon', 'phatSinh', 'daThu', 'daTra', 'conLai'].indexOf(c.k) >= 0,
                         tongLa: c.k === 'soDon' ? 'num' : '' };
            }),
            rows: rows, kyTrai: 'KẾ TOÁN', kyPhai: 'GIÁM ĐỐC'
        });
    }

    function inSoChiTiet(r, sk, la) {
        var luy = 0;
        var ds = sk.map(function (x) {
            luy += x.no - x.co;
            return { ngay: T.date(x.ngay), so: x.so, nd: x.nd,
                     no: x.no || 0, co: x.co || 0, luy: luy };
        });
        W.inBaoCao({
            tieu: 'SỔ CHI TIẾT CÔNG NỢ', phu: r.ten, land: false, thoiDiem: T.today(),
            dieuKien: [
                { t: 'Đối tượng', v: r.ten },
                { t: 'Loại công nợ', v: la ? 'Phải thu khách hàng' : 'Phải trả nhà cung cấp' }
            ],
            cols: [
                { t: 'Ngày', k: 'ngay', w: 20, cls: 'c' },
                { t: 'Số chứng từ', k: 'so', w: 32 },
                { t: 'Nội dung', k: 'nd' },
                { t: 'Phát sinh', k: 'no', w: 27, cls: 'n', tong: true,
                  r: function (v) { return v ? T.money(v) : ''; } },
                { t: la ? 'Đã thu' : 'Đã trả', k: 'co', w: 27, cls: 'n', tong: true,
                  r: function (v) { return v ? T.money(v) : ''; } },
                { t: 'Lũy kế còn lại', k: 'luy', w: 28, cls: 'n',
                  r: function (v) { return T.money(v); } }
            ],
            rows: ds, tienChu: 'Số dư cuối kỳ bằng chữ: ' + T.docTien(luy),
            kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'KẾ TOÁN TRƯỞNG'
        });
    }


    host.querySelectorAll('[data-tab]').forEach(function (t) {
        t.onclick = function () {
            host.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.remove('on'); });
            t.classList.add('on'); tab = t.getAttribute('data-tab'); ve();
        };
    });
    ve();
};

})(window);

/* ==========================================================================
   MODULE BẢNG GIÁ  (PRICE MANAGEMENT)
   --------------------------------------------------------------------------
   Triết lý: PHẦN MỀM THÍCH NGHI VỚI DOANH NGHIỆP.
   Doanh nghiệp không phải sửa tệp Excel để hợp với phần mềm; phần mềm tự đọc
   đúng tệp mà doanh nghiệp đang dùng.

   Người dùng chỉ làm ba việc:
       Chọn tệp Excel  →  Xem trước  →  Nhập
   Không cấu hình. Không ánh xạ tay. Không phải hiểu cấu trúc dữ liệu.

   Nội dung tệp này:
       1. Màn hình Bảng giá — danh sách phiên bản theo hãng · năm · quý · tháng
       2. Nhập bảng giá không cần cấu hình (Zero Configuration)
       3. Hỏi lại CHỈ những cột hệ thống chưa xác định được
       4. Mở / sửa một phiên bản — phiên bản đã chốt thì không sửa được
       5. Danh mục Loại giá do doanh nghiệp tự khai
       6. Tệp Excel gốc của từng lần nhập — tải lại bất cứ lúc nào
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {};

var MOD = 'bangGiaBan';
function opt(a, c) { return W.opt(a, c); }
function txt(v) { return v === undefined || v === null ? '' : String(v); }

/* ==========================================================================
   0. TIỆN ÍCH CHUNG CỦA MODULE
   ========================================================================== */
/** Nhà cung cấp / hãng phát hành một phiên bản. */
function hangCua(b) { return b.nhaCungCap || b.hangSX || b.ma || ''; }
/** Số dòng gốc của phiên bản — đúng bằng số dòng của tệp Excel. */
function soDong(b) { return (b && b.dong) ? b.dong.length : 0; }
/** Số mặt hàng đã liên kết được với Danh mục Hàng hóa. */
function soMatHang(b) {
    var m = {};
    (b && b.dong || []).forEach(function (d) { if (d.hangHoaId) m[d.hangHoaId] = 1; });
    return Object.keys(m).length;
}
/** Số dòng chưa liên kết được với Danh mục Hàng hóa. */
function soChuaLienKet(b) {
    return (b && b.dong || []).filter(function (d) { return !d.hangHoaId; }).length;
}
/** Tình trạng hiệu lực tại một ngày. */
function tinhTrang(b, ngay) {
    var n = ngay || T.today();
    if (b.trangThai !== 'Đang áp dụng') return 'Ngừng áp dụng';
    if (b.tuNgay && b.tuNgay > n) return 'Chưa hiệu lực';
    if (b.denNgay && b.denNgay < n) return 'Hết hiệu lực';
    return 'Đang hiệu lực';
}
/** Số phiên bản kế tiếp của một bảng giá. */
function phienBanKe(maBangGia) {
    var n = 0;
    DB.all('bangGiaBan').forEach(function (b) {
        if (b.ma !== maBangGia) return;
        n = Math.max(n, Number(b.phienBan) || 1);
    });
    return n + 1;
}
/** Mã bảng giá chuẩn hóa từ tên hãng — các phiên bản của một hãng dùng chung mã. */
function maTuHang(hang) {
    var k = T.kd(hang || 'BANG GIA').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'BG-' + k.toUpperCase();
}
/** Đóng hiệu lực các phiên bản cũ khi có phiên bản mới của cùng bảng giá. */
function dongPhienBanCu(maBangGia, tuNgay, trongId) {
    if (!maBangGia || !tuNgay) return 0;
    var n = 0;
    DB.all('bangGiaBan').forEach(function (b) {
        if (b.id === trongId || b.ma !== maBangGia) return;
        if (b.trangThai !== 'Đang áp dụng') return;
        /* TẠI MỘT THỜI ĐIỂM CHỈ CÓ ĐÚNG MỘT PHIÊN BẢN ĐANG HIỆU LỰC.
           Phiên bản cũ hơn thì đóng lại ngày hôm trước; phiên bản CÙNG NGÀY hiệu
           lực thì bị thay thế hẳn — nếu không, hai phiên bản cùng phủ một ngày
           và hệ thống phải đoán, đúng thứ kiến trúc này cấm. */
        if (b.tuNgay === tuNgay) { b.trangThai = 'Ngừng áp dụng'; n++; return; }
        if (b.tuNgay && b.tuNgay > tuNgay) return;   // phiên bản của kỳ sau: giữ nguyên
        if (b.denNgay && b.denNgay < tuNgay) return;
        b.denNgay = T.addDays(tuNgay, -1);
        n++;
    });
    return n;
}
W.hangCuaPhienBan = hangCua;
W.soDongBangGia = soDong;
W.soMatHangPhienBan = soMatHang;

/* ==========================================================================
   1. MÀN HÌNH BẢNG GIÁ
   ========================================================================== */
S['bang-gia'] = function (host) {
    var qThem = Q.co(MOD, 'them'), qSua = Q.co(MOD, 'sua'), qXoa = Q.co(MOD, 'xoa');
    var g;

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Bảng giá</h2>' +
        '<div class="sub">Mỗi lần nhà cung cấp phát hành báo giá mới là <b>một phiên bản</b> — ' +
        'phiên bản cũ không bao giờ bị ghi đè</div></div>' +
        '<div class="page-act">' +
        (qThem ? '<button class="btn primary lg" data-nhap><i class="bi bi-file-earmark-excel"></i> ' +
                 'Nhập bảng giá từ Excel</button>' : '') +
        '</div></div>' +
        '<div class="kpis mb12" id="bgKpi"></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Danh mục', 'Bảng giá']);

    function rows() {
        /* Chốt trước tập phiên bản BỊ KHÓA để không phải quét lại cả bảng cho
           từng dòng — danh sách hàng chục phiên bản vẫn mở tức thì. */
        var ds0 = DB.all('bangGiaBan');
        var caoNhat = {};
        ds0.forEach(function (x) {
            var m2 = x.ma || x.id, p2 = Number(x.phienBan) || 1;
            if (!caoNhat[m2] || p2 > caoNhat[m2].pb) caoNhat[m2] = { pb: p2, tu: String(x.tuNgay || '') };
        });
        return ds0.map(function (b0) {
            /* KHÔNG gắn trường tạm lên bản ghi thật — chỉ dựng một bản chụp để vẽ. */
            var b = T.clone(b0);
            b.__goc = b0.id;
            var k = T.kyBangGia(b);
            b._ncc = hangCua(b);
            b._nam = k.nam || '';
            b._quy = k.quy ? 'Quý ' + ['', 'I', 'II', 'III', 'IV'][k.quy] : '';
            b._thang = k.thang ? 'Tháng ' + ('0' + k.thang).slice(-2) : '';
            b._soDong = b.soDong !== undefined ? Number(b.soDong) : soDong(b);
            b._soMH = b.soMatHang !== undefined ? Number(b.soMatHang) : soMatHang(b);
            b._chuaLK = Math.max(0, b._soDong - b._soMH);
            b._hl = tinhTrang(b);
            var c0 = caoNhat[b.ma || b.id] || { pb: 0, tu: '' };
            b._khoa = !!b.khoa || (c0.pb > (Number(b.phienBan) || 1) &&
                                   c0.tu >= String(b.tuNgay || ''));
            b._mucGia = (b.cotGia || []).length;
            return b;
        });
    }
    /** Bản ghi THẬT trong kho dữ liệu ứng với dòng đang chọn trên lưới. */
    function thuc(r) { return (r && DB.get('bangGiaBan', r.id)) || r; }

    function veKpi(ds) {
        var maBG = {};
        ds.forEach(function (b) { maBG[b.ma || b.id] = 1; });
        var hl = ds.filter(function (b) { return b._hl === 'Đang hiệu lực'; });
        var mh = {};
        hl.forEach(function (b) { Object.keys(b.bang || {}).forEach(function (k2) { mh[k2] = 1; }); });
        /* Thẻ số liệu CHỈ ĐỂ ĐỌC — dùng lớp "st" để không hiện con trỏ bấm được. */
        function kp(l, v, m, c) {
            return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div>' +
                '<div class="vl">' + v + '</div><div class="ft">' + m + '</div></div>';
        }
        host.querySelector('#bgKpi').innerHTML =
            kp('Bảng giá', T.num(Object.keys(maBG).length, 0), 'theo nhà cung cấp / hãng') +
            kp('Phiên bản', T.num(ds.length, 0), 'toàn bộ lịch sử, không ghi đè', 'c') +
            kp('Đang hiệu lực', T.num(hl.length, 0), 'phiên bản áp dụng cho chứng từ mới', 'g') +
            kp('Mặt hàng có giá', T.num(Object.keys(mh).length, 0), 'trong các phiên bản đang hiệu lực', 'b') +
            kp('Loại giá', T.num(T.dsLoaiGia().length, 0), 'doanh nghiệp tự khai, không giới hạn', 'y');
    }

    var tb =
        (qThem ? '<button class="btn primary" data-nhap2><i class="bi bi-upload"></i> Nhập bảng giá</button>' : '') +
        '<button class="btn" data-mo disabled><i class="bi bi-table"></i> Mở bảng giá</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-ss><i class="bi bi-arrow-left-right"></i> So sánh phiên bản</button>' +
        '<button class="btn" data-ls><i class="bi bi-graph-up"></i> Lịch sử giá</button>' +
        '<button class="btn" data-tep disabled><i class="bi bi-file-earmark-arrow-down"></i> Tệp gốc</button>' +
        '<span class="tb-sep"></span>' +
        (qSua ? '<button class="btn" data-md disabled><i class="bi bi-star"></i> Đặt mặc định</button>' +
                '<button class="btn" data-tt disabled><i class="bi bi-toggle-on"></i> Kích hoạt / Ngừng</button>' +
                '<button class="btn" data-chot disabled><i class="bi bi-lock"></i> Chốt phiên bản</button>' +
                '<button class="btn" data-kp disabled><i class="bi bi-arrow-counterclockwise"></i> Khôi phục</button>' : '') +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-loai><i class="bi bi-tags"></i> Loại giá</button>' +
        '<button class="btn" data-cs><i class="bi bi-sliders"></i> Chính sách giá</button>' +
        '<button class="btn" data-mau><i class="bi bi-diagram-2"></i> Cấu trúc tệp đã nhớ</button>' +
        '<span class="tb-sep"></span>' +
        (qSua ? '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa thông tin</button>' : '') +
        (qXoa ? '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' : '') +
        '<button class="btn" data-xuat><i class="bi bi-file-earmark-excel"></i> Xuất danh sách</button>' +
        '<button class="btn" data-lam><i class="bi bi-arrow-clockwise"></i> Làm mới</button>';

    var ds0 = rows();
    var dsNam = Array.from(new Set(ds0.map(function (b) { return b._nam; }).filter(Boolean)))
                     .sort(function (a, b) { return b - a; });

    g = new UI.Grid({
        mount: '#gh', rows: ds0, pageSize: 20, height: 'calc(100vh - 400px)', toolbar: tb,
        chon: true, luoi: 'bangGiaBan',
        search: ['ten', 'ma', 'nhaCungCap', 'moTa', 'nguoiCapNhat', 'nguonTep'],
        cols: [
            { k: '_ncc', t: 'Nhà cung cấp / Hãng', w: 190, r: function (v, r) {
                return '<b>' + T.esc(v) + '</b>' +
                    (r.macDinh ? ' <i class="bi bi-star-fill" title="Bảng giá mặc định" style="color:var(--warn)"></i>' : '') +
                    (r._khoa ? ' <i class="bi bi-lock-fill" title="Phiên bản đã chốt — không sửa được số liệu" style="color:var(--ink-3)"></i>' : ''); } },
            { k: 'ten', t: 'Tên phiên bản', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    '<div class="small muted ellip">' + T.esc(r.ma || '') +
                    (r.nguonTep ? ' · ' + T.esc(r.nguonTep) : '') + '</div>'; } },
            { k: 'phienBan', t: 'Phiên bản', w: 90, cls: 'ctr', r: function (v) {
                return '<span class="pill n">v' + (Number(v) || 1) + '</span>'; } },
            { k: '_nam', t: 'Năm', w: 74, cls: 'ctr' },
            { k: '_quy', t: 'Quý', w: 80, cls: 'ctr' },
            { k: '_thang', t: 'Tháng', w: 92, cls: 'ctr' },
            { k: 'tuNgay', t: 'Hiệu lực từ', w: 106, fmt: 'date' },
            { k: 'denNgay', t: 'Đến ngày', w: 106, fmt: 'date', r: function (v) {
                return v ? T.date(v) : '<span class="muted">không giới hạn</span>'; } },
            { k: '_soDong', t: 'Số dòng', w: 88, cls: 'num', fmt: 'num' },
            { k: '_soMH', t: 'Mặt hàng', w: 96, cls: 'num', r: function (v, r) {
                return T.num(v, 0) + (r._chuaLK
                    ? '<div class="small warn">' + T.num(r._chuaLK, 0) + ' chưa liên kết</div>' : ''); } },
            { k: '_mucGia', t: 'Loại giá', w: 90, cls: 'ctr', r: function (v, r) {
                return v ? '<span class="pill b" title="' + T.esc((r.cotGia || []).join(' · ')) + '">' +
                    v + ' loại</span>' : '<span class="pill y">chưa có</span>'; } },
            { k: '_hl', t: 'Tình trạng', w: 128, r: function (v) { return T.pill(v); } }
        ],
        filters: [
            { k: '_ncc', t: 'Nhà cung cấp', w: 200, opts: T.dsNhaCungCapGia() },
            { k: '_nam', t: 'Năm', w: 110, opts: dsNam },
            { k: '_quy', t: 'Quý', w: 110, opts: ['Quý I', 'Quý II', 'Quý III', 'Quý IV'] },
            { k: '_hl', t: 'Tình trạng', w: 160,
              opts: ['Đang hiệu lực', 'Chưa hiệu lực', 'Hết hiệu lực', 'Ngừng áp dụng'] }
        ],
        sortK: 'tuNgay', sortD: -1,
        actions: function () { return UI.btn('mo', 'bi-table', 'Mở bảng giá'); }, actionsW: 66,
        onAction: function (a, r) { if (a === 'mo') moPhienBan(r, lai); },
        onSelect: UI.chonToolbar(host, ['mo', 'sua', 'xoa', 'md', 'tt', 'chot', 'kp', 'tep']),
        onOpen: function (r) { moPhienBan(r, lai); }
    });
    veKpi(ds0);
    UI.apQuyen(host, MOD);
    W.hangLoat(host, g, {
        mod: MOD, coll: 'bangGiaBan', dt: 'Phiên bản bảng giá', file: 'DanhSach_BangGia',
        rows: rows, excel: xlCot(), trangThai: ['Đang áp dụng', 'Ngừng áp dụng'],
        email: false, inCT: false
    });

    function lai() { var d = rows(); g.reload(d); veKpi(d); }
    function chon() { return thuc(g.selected()); }
    function q(x) { return host.querySelector(x); }
    function nut(s2, f) { var e = q(s2); if (e) e.onclick = f; }

    nut('[data-nhap]', function () { W.nhapBangGiaMoi(lai); });
    nut('[data-nhap2]', function () { W.nhapBangGiaMoi(lai); });
    nut('[data-mo]', function () { var r = chon(); if (r) moPhienBan(r, lai); });
    nut('[data-sua]', function () { var r = chon(); if (r) formPhienBan(r, lai); });
    nut('[data-ss]', function () { W.soSanhBangGia(chon()); });
    nut('[data-ls]', function () { W.lichSuGiaHang(); });
    nut('[data-tep]', function () { var r = chon(); if (r) W.tepGocPhienBan(r); });
    nut('[data-loai]', function () { W.go('loai-gia'); });
    nut('[data-cs]', function () { W.chinhSachGiaDonVi(lai); });
    nut('[data-mau]', function () { W.xemCauTrucDaNho(); });
    nut('[data-lam]', function () { g.q = ''; g.f = {}; lai(); UI.toast('info', 'Đã làm mới'); });
    nut('[data-xuat]', function () { UI.xuatExcel('DanhSach_BangGia', 'Danh sách bảng giá', xlCot(), g.allRows); });
    nut('[data-xoa]', function () {
        var r = chon(); if (!r) return;
        UI.xoaChuan({ coll: 'bangGiaBan', mod: MOD, rec: r, ten: r.ten, sauKhi: lai });
    });
    nut('[data-md]', function () {
        var r = chon(); if (!r) return;
        UI.confirm({
            title: 'Đặt làm bảng giá mặc định', icon: 'bi-star-fill',
            message: 'Đặt <b>' + T.esc(r.ten) + '</b> làm phiên bản mặc định của ' +
                     '<b>' + T.esc(hangCua(r)) + '</b>?',
            note: 'Chứng từ lập mới sẽ lấy phiên bản này khi chưa chỉ định bảng giá riêng. ' +
                  'Các phiên bản khác của cùng hãng sẽ thôi làm mặc định.',
            okText: 'Đặt mặc định', okIcon: 'bi-star',
            ok: function () {
                DB.all('bangGiaBan').forEach(function (b) {
                    if (b.ma === r.ma) b.macDinh = (b.id === r.id);
                });
                DB.log('Cập nhật', 'bangGiaBan', r); DB.save(); lai();
                UI.toast('ok', 'Đã đặt bảng giá mặc định', r.ten);
            }
        });
    });
    nut('[data-tt]', function () {
        var r = chon(); if (!r) return;
        var bat = r.trangThai !== 'Đang áp dụng';
        UI.confirm({
            title: bat ? 'Kích hoạt phiên bản' : 'Ngừng sử dụng phiên bản',
            icon: bat ? 'bi-toggle-on' : 'bi-toggle-off', danger: !bat,
            message: (bat ? 'Kích hoạt lại ' : 'Ngừng sử dụng ') + '<b>' + T.esc(r.ten) + '</b>?',
            note: bat ? 'Phiên bản sẽ được dùng cho chứng từ lập mới trong khoảng hiệu lực của nó.'
                      : 'Số liệu giữ nguyên và vẫn tra cứu được; chỉ thôi áp dụng cho chứng từ lập mới.',
            okText: bat ? 'Kích hoạt' : 'Ngừng sử dụng',
            ok: function () {
                var o = T.clone(r);
                o.trangThai = bat ? 'Đang áp dụng' : 'Ngừng áp dụng';
                DB.update('bangGiaBan', r.id, o); lai();
                UI.toast('ok', bat ? 'Đã kích hoạt' : 'Đã ngừng sử dụng', r.ten);
            }
        });
    });
    nut('[data-chot]', function () {
        var r = chon(); if (!r) return;
        if (r.khoa) {
            UI.confirm({
                title: 'Mở chốt phiên bản', icon: 'bi-unlock',
                message: 'Mở chốt <b>' + T.esc(r.ten) + '</b> để sửa lại số liệu?',
                note: 'Chỉ nên mở chốt khi phát hiện sai sót trong chính phiên bản này. ' +
                      'Chứng từ đã phát hành giữ nguyên đơn giá đã lưu.',
                okText: 'Mở chốt',
                ok: function () {
                    var o = T.clone(r); o.khoa = false;
                    DB.update('bangGiaBan', r.id, o); lai();
                    UI.toast('ok', 'Đã mở chốt phiên bản', r.ten);
                }
            });
            return;
        }
        UI.confirm({
            title: 'Chốt phiên bản', icon: 'bi-lock-fill',
            message: 'Chốt <b>' + T.esc(r.ten) + '</b>?',
            note: 'Sau khi chốt, số liệu của phiên bản KHÔNG sửa được nữa — đây là hồ sơ giá ' +
                  'đã phát hành. Vẫn tra cứu, so sánh, khôi phục và nhập phiên bản mới bình thường.',
            okText: 'Chốt phiên bản', okIcon: 'bi-lock',
            ok: function () {
                var o = T.clone(r); o.khoa = true;
                DB.update('bangGiaBan', r.id, o); lai();
                UI.toast('ok', 'Đã chốt phiên bản', r.ten);
            }
        });
    });
    nut('[data-kp]', function () { var r = chon(); if (r) khoiPhucPhienBan(r, lai); });

    function xlCot() {
        return [{ t: 'Nhà cung cấp', k: '_ncc', w: 26 }, { t: 'Mã bảng giá', k: 'ma', w: 20 },
                { t: 'Tên phiên bản', k: 'ten', w: 36 }, { t: 'Phiên bản', k: 'phienBan', w: 10 },
                { t: 'Năm', k: '_nam', w: 8 }, { t: 'Quý', k: '_quy', w: 10 },
                { t: 'Tháng', k: '_thang', w: 12 },
                { t: 'Hiệu lực từ', k: 'tuNgay', w: 14 }, { t: 'Đến ngày', k: 'denNgay', w: 14 },
                { t: 'Số dòng', k: '_soDong', w: 12 }, { t: 'Số mặt hàng', k: '_soMH', w: 14 },
                { t: 'Số loại giá', k: '_mucGia', w: 12 },
                { t: 'Tình trạng', k: '_hl', w: 16 },
                { t: 'Người cập nhật', k: 'nguoiCapNhat', w: 22 },
                { t: 'Tệp gốc', k: 'nguonTep', w: 30 }];
    }
};

/* ==========================================================================
   2. NHẬP BẢNG GIÁ — KHÔNG CẦN CẤU HÌNH
   --------------------------------------------------------------------------
   Chọn tệp → hệ thống tự đọc, tự nhận diện, tự nhớ cấu trúc → xem trước → nhập.
   Bảng ánh xạ chỉ hiện khi còn cột chưa xác định, và chỉ hỏi đúng cột đó.
   ========================================================================== */
W.nhapBangGiaMoi = function (sauKhi, boSungVao) {
    if (!Q.co(MOD, boSungVao ? 'sua' : 'them'))
        return UI.thieuQuyen(MOD, boSungVao ? 'sua' : 'them');
    W.chonTepBangGiaKemGoc(function (kq, tenTep) {
        kq.nhaCungCap = W.doanNhaCungCap(kq, tenTep);
        var mau = W.apMauCauTruc(kq);            // cấu trúc đã nhớ của hãng này
        if (mau && mau.nhaCungCap && !kq.nhaCungCap) kq.nhaCungCap = mau.nhaCungCap;
        var cham = W.chamNhanDien(kq);
        if (cham.du) return xemTruocVaNhap(kq, tenTep, mau, sauKhi, boSungVao);
        /* Chỉ hỏi đúng những gì hệ thống chưa xác định được. */
        W.hoiCotChuaRo(kq, cham, function () {
            xemTruocVaNhap(kq, tenTep, mau, sauKhi, boSungVao);
        });
    }, function (err) {
        UI.toast('err', 'Không đọc được tệp bảng giá',
            String(err.message || err) + ' — kiểm tra lại tệp rồi thử lại.', 8000);
    });
};

/* ------------------------------------------- 2A. HỎI CÁC CỘT CHƯA XÁC ĐỊNH */
var VAI_COT = [
    { k: 'bo', t: '— Không dùng cột này —' },
    { k: 'gia', t: 'Một loại giá' },
    { k: 'ma', t: 'Mã hàng / Model' },
    { k: 'ten', t: 'Tên hàng' },
    { k: 'ma2', t: 'Mã khác (mã cũ, mã của hãng)' },
    { k: 'dvt', t: 'Đơn vị tính' },
    { k: 'thongSo', t: 'Thông số kỹ thuật' },
    { k: 'nhom', t: 'Nhóm hàng / Loại thiết bị' },
    { k: 'xuatXu', t: 'Hãng · xuất xứ' },
    { k: 'ghiChu', t: 'Ghi chú' }
];

W.hoiCotChuaRo = function (kq, cham, xong) {
    var la = cham.laCot, thieu = cham.thieu;
    UI.modal({
        size: 'lg', dismiss: false,
        title: 'Còn ' + (la.length ? la.length + ' cột chưa rõ' : 'thiếu thông tin bắt buộc'),
        sub: 'Hệ thống đã tự nhận diện phần còn lại của tệp — chỉ cần trả lời đúng những mục dưới đây',
        body:
          (thieu.length
            ? '<div class="note r mb12"><i class="bi bi-exclamation-triangle-fill"></i><div>' +
              'Tệp chưa xác định được: <b>' + T.esc(thieu.join(' · ')) + '</b>. ' +
              'Chọn đúng cột tương ứng bên dưới rồi tiếp tục.</div></div>'
            : '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
              'Những cột dưới đây có dữ liệu nhưng hệ thống chưa biết là gì. ' +
              'Chọn ý nghĩa hoặc để <b>Không dùng cột này</b>. ' +
              'Lần sau nhập tệp cùng cấu trúc, hệ thống sẽ nhớ và không hỏi lại.</div></div>') +
          '<div class="tbl-wrap" style="max-height:46vh"><table class="tbl">' +
          '<thead><tr><th style="width:70px">Cột</th><th style="width:240px">Tiêu đề trong tệp</th>' +
          '<th style="width:210px">Dữ liệu mẫu</th><th>Cột này là gì?</th></tr></thead><tbody>' +
          la.map(function (c) {
              return '<tr><td class="ctr mono">' + c.cot + '</td>' +
                  '<td><b>' + T.esc(c.ten) + '</b></td>' +
                  '<td class="small muted ellip">' + T.esc(c.viDu) + '</td>' +
                  '<td><select data-vai="' + c.j + '">' +
                  VAI_COT.map(function (v) {
                      var chon = (v.k === 'gia' && c.laSo) ? ' selected' : '';
                      return '<option value="' + v.k + '"' + chon + '>' + T.esc(v.t) + '</option>';
                  }).join('') + '</select></td></tr>';
          }).join('') + '</tbody></table></div>' +
          (thieu.length ? khoiChonThieu(kq) : ''),
        buttons: [
            { text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } },
            { text: 'Tiếp tục', cls: 'primary', icon: 'bi-arrow-right', click: function (h) {
                var C = kq.anhXa, cg = (kq.cotGiaJ || []).slice();
                h.el.querySelectorAll('[data-thieu]').forEach(function (e) {
                    var k = e.getAttribute('data-thieu'), v = Number(e.value);
                    if (v >= 0) C[k] = v;
                });
                h.el.querySelectorAll('[data-vai]').forEach(function (e) {
                    var j = Number(e.getAttribute('data-vai')), v = e.value;
                    if (v === 'bo') return;
                    if (v === 'gia') {
                        var ten = String((kq.tho.ten || [])[j] || ('Giá ' + (cg.length + 1))).trim();
                        if (!cg.some(function (c) { return c.j === j; })) cg.push({ j: j, t: ten });
                        return;
                    }
                    C[v] = j;
                });
                kq.anhXa = C; kq.cotGiaJ = cg;
                W.docDongBangGia(kq);
                var lai = W.chamNhanDien(kq);
                if (lai.thieu.length)
                    return UI.toast('err', 'Vẫn thiếu ' + lai.thieu.join(' · '),
                        'Phải chỉ ra cột Mã hàng hoặc Tên hàng và ít nhất một cột giá.');
                if (!kq.dong.length)
                    return UI.toast('err', 'Không đọc được dòng nào',
                        'Kiểm tra lại các cột vừa chọn.');
                h.close(); xong();
            } }
        ]
    });

    function khoiChonThieu(kq2) {
        var t = kq2.tho;
        function oCot(cur) {
            var h2 = '<option value="-1">— Chưa chọn —</option>';
            for (var j = 0; j < t.soCot; j++) {
                h2 += '<option value="' + j + '"' + (Number(cur) === j ? ' selected' : '') + '>' +
                    T.esc(W.tenCotExcel(j) + '. ' + (String(t.ten[j] || '').trim() || '(không tiêu đề)') +
                          '  —  ' + W.viDuCotBangGia(t, j)) + '</option>';
            }
            return h2;
        }
        return '<div class="grid2 mt12">' +
            '<div class="fld req"><label>Cột Mã hàng (Model)</label>' +
                '<select data-thieu="ma">' + oCot(kq2.anhXa.ma) + '</select></div>' +
            '<div class="fld"><label>Cột Tên hàng</label>' +
                '<select data-thieu="ten">' + oCot(kq2.anhXa.ten) + '</select></div>' +
            '</div>';
    }
};

/* ---------------------------------------------- 2B. XEM TRƯỚC VÀ NHẬP */
function xemTruocVaNhap(kq, tenTep, mau, sauKhi, boSungVao) {
    var ky = T.kyBangGia({ tuNgay: T.today() });
    var ncc = kq.nhaCungCap || '';
    var maBG = boSungVao ? boSungVao.ma : maTuHang(ncc || tenTep);
    var v = boSungVao ? {
        nhaCungCap: hangCua(boSungVao), ma: boSungVao.ma, ten: boSungVao.ten,
        tuNgay: boSungVao.tuNgay, denNgay: boSungVao.denNgay || '',
        donViId: '', ghiChu: boSungVao.moTa || ''
    } : {
        nhaCungCap: ncc, ma: maBG,
        ten: 'Bảng giá ' + (ncc ? ncc + ' ' : '') + ky.nhan,
        tuNgay: T.today(), denNgay: '', donViId: '', ghiChu: ''
    };
    var cham = W.chamNhanDien(kq);
    var GH = 60;                                    // số dòng vẽ ra trong bản xem trước

    UI.modal({
        size: 'full', dismiss: false,
        title: boSungVao ? 'Nhập bổ sung vào phiên bản đang mở' : 'Xem trước và nhập bảng giá',
        sub: T.esc(tenTep) + ' — trang tính ' + T.esc(kq.sheet) + ' · đọc được ' +
             T.num(kq.dong.length, 0) + ' dòng',
        body:
          '<div id="bgTom"></div>' +
          '<div class="card mt12"><div class="card-h"><i class="bi bi-info-circle"></i> Thông tin phiên bản' +
          '<span class="spacer"></span>' +
          '<span class="small muted">Hệ thống điền sẵn — sửa lại nếu cần</span></div>' +
          '<div class="card-b"><div class="grid4">' +
          '<div class="fld req"><label>Nhà cung cấp / Hãng</label>' +
              '<input data-f="nhaCungCap" list="bgNcc" value="' + T.esc(v.nhaCungCap) + '"' +
              (boSungVao ? ' disabled' : '') + '>' +
              '<datalist id="bgNcc">' + T.dsNhaCungCapGia().concat(
                  DB.all('nhaCungCap').map(function (n) { return n.ten; })).map(function (x) {
                  return '<option value="' + T.esc(x) + '">'; }).join('') + '</datalist></div>' +
          '<div class="fld req span2" style="grid-column:span 2"><label>Tên phiên bản</label>' +
              '<input data-f="ten" value="' + T.esc(v.ten) + '"' + (boSungVao ? ' disabled' : '') + '></div>' +
          '<div class="fld"><label>Mã bảng giá</label>' +
              '<input data-f="ma" value="' + T.esc(v.ma) + '" ' + (boSungVao ? 'disabled' : '') + '>' +
              '<div class="small muted">Các phiên bản của cùng hãng dùng chung mã</div></div>' +
          '<div class="fld req"><label>Hiệu lực từ</label>' +
              '<input type="date" data-f="tuNgay" value="' + T.esc(v.tuNgay) + '"' +
              (boSungVao ? ' disabled title="Nhập bổ sung không đổi hiệu lực của phiên bản"' : '') +
              '></div>' +
          '<div class="fld"><label>Đến ngày</label>' +
              '<input type="date" data-f="denNgay" value="' + T.esc(v.denNgay) + '"' +
              (boSungVao ? ' disabled title="Nhập bổ sung không đổi hiệu lực của phiên bản"' : '') +
              '></div>' +
          /* KIẾN TRÚC V1.0 — Bảng giá do đơn vị nguồn xây dựng và dùng chung cho
             cả nhóm. Không có bảng giá riêng theo công ty phát hành. */
          '<div class="fld"><label>Phạm vi áp dụng</label>' +
              '<input value="Dùng chung toàn nhóm" readonly ' +
              'style="background:var(--bg-2)" title="Bảng giá do đơn vị nguồn xây dựng, ' +
              'áp dụng cho mọi đơn vị phát hành"></div>' +
          '<div class="fld"><label>Kỳ</label><input id="bgKy" value="" readonly ' +
              'style="background:var(--bg-2)"></div>' +
          '<div class="fld span4" style="grid-column:span 4"><label>Ghi chú</label>' +
              '<input data-f="ghiChu" value="' + T.esc(v.ghiChu) + '" ' +
              'placeholder="Ví dụ: báo giá tháng 8 của hãng, áp dụng cho dự án miền Bắc"></div>' +
          '</div></div></div>' +
          /* Chiết khấu nội bộ là một phần THÔNG TIN của phiên bản: khai ngay khi
             nhập bảng giá, không phải mở thêm màn hình nào. Nhập bổ sung thì
             giữ nguyên mức của phiên bản đang có. */
          (boSungVao ? '' : '<div id="bgCKNB"></div>') +
          '<div id="bgXem" class="mt12"></div>',
        buttons: [
            { text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } },
            { text: 'Xem cấu trúc tệp', icon: 'bi-diagram-2', click: function (h) {
                W.anhXaCotBangGia(kq, function () { veTom(h); veXem(h); });
            } },
            { text: boSungVao ? 'Nhập bổ sung' : 'Nhập bảng giá', cls: 'primary',
              icon: 'bi-database-add', click: function (h) { ghi(h); } }
        ],
        onOpen: function (h) {
            UI.numInput(h.el);
            veTom(h); veXem(h); veKy(h); veCKNhap(h);
            var oT = h.q('[data-f="tuNgay"]');
            if (oT) oT.onchange = function () { veKy(h); veCKNhap(h); };
            var oN = h.q('[data-f="nhaCungCap"]');
            if (oN && !boSungVao) oN.onchange = function () {
                var m2 = h.q('[data-f="ma"]');
                if (m2 && !m2.dataset.tay) m2.value = maTuHang(oN.value);
                veCKNhap(h);
            };
            var oM = h.q('[data-f="ma"]');
            if (oM) oM.oninput = function () { oM.dataset.tay = '1'; };
        }
    });

    function veKy(h) {
        var t = (h.q('[data-f="tuNgay"]') || {}).value || T.today();
        var e = h.q('#bgKy');
        if (e) e.value = T.nhanKyBangGia({ tuNgay: t });
    }

    function veTom(h) {
        var C = kq.anhXa, co = [];
        function chip(nhan, ok2, mo) {
            return '<span class="nd-chip ' + (ok2 ? 'ok' : 'no') + '">' +
                '<i class="bi ' + (ok2 ? 'bi-check-circle-fill' : 'bi-dash-circle') + '"></i> ' +
                T.esc(nhan) + (mo ? ' <b>' + T.esc(mo) + '</b>' : '') + '</span>';
        }
        co.push(chip('Mã hàng', C.ma >= 0, C.ma >= 0 ? W.tenCotExcel(C.ma) : ''));
        co.push(chip('Tên hàng', C.ten >= 0, C.ten >= 0 ? W.tenCotExcel(C.ten) : ''));
        co.push(chip('Đơn vị tính', C.dvt >= 0, C.dvt >= 0 ? W.tenCotExcel(C.dvt) : ''));
        co.push(chip('Thông số kỹ thuật', C.thongSo >= 0, C.thongSo >= 0 ? W.tenCotExcel(C.thongSo) : ''));
        co.push(chip('Mã khác', C.ma2 >= 0, C.ma2 >= 0 ? W.tenCotExcel(C.ma2) : ''));
        co.push(chip('Ghi chú', C.ghiChu >= 0, C.ghiChu >= 0 ? W.tenCotExcel(C.ghiChu) : ''));
        co.push(chip('Loại giá', (kq.cotGia || []).length > 0, (kq.cotGia || []).length + ' loại'));
        co.push(chip('Hình ảnh', kq.soAnh > 0, kq.soAnh ? kq.soAnh + ' ảnh' : 'không có'));
        h.q('#bgTom').innerHTML =
            '<div class="note ' + (mau ? 'g' : 'b') + '"><i class="bi ' +
            (mau ? 'bi-lightning-charge-fill' : 'bi-magic') + '"></i><div>' +
            (mau
              ? '<b>Đã nhận ra cấu trúc tệp của ' + T.esc(mau.nhaCungCap || 'nhà cung cấp này') + '.</b> ' +
                'Lần nhập thứ ' + ((Number(mau.soLanDung) || 0) + 1) + ' — hệ thống dùng lại đúng ' +
                'cách đọc của những lần trước, không hỏi lại.'
              : '<b>Hệ thống đã tự đọc và nhận diện tệp.</b> Cấu trúc tệp này sẽ được ghi nhớ, ' +
                'lần sau nhập tệp của cùng nhà cung cấp sẽ nhận diện ngay.') +
            '<div class="mt8">' + co.join('') + '</div>' +
            '<div class="small muted mt8">Các mức giá đọc được: <b>' +
            T.esc((kq.cotGia || []).join(' · ') || 'chưa có') + '</b></div>' +
            '</div></div>';
    }

    function veXem(h) {
        var ds = kq.dong, xem = ds.slice(0, GH);
        var lk = 0, chua = 0;
        /* Tra danh mục MỘT LẦN cho mỗi lần đọc tệp. Bấm "Xem cấu trúc tệp" rồi
           quay lại thì chỉ tra lại khi mảng dòng thật sự được dựng lại. */
        if (kq._daTra !== ds) {
            ds.forEach(function (d) {
                var hh = W.timHangHoaLinhHoat(d.ma, d.maPhu, d.ten, d.thongSo, kq.coCot.ma);
                d._hh = hh.hh || null;
            });
            kq._daTra = ds;
        }
        ds.forEach(function (d) { if (d._hh) lk++; else chua++; });
        h.q('#bgXem').innerHTML =
            '<div class="card"><div class="card-h"><i class="bi bi-eye"></i> Xem trước dữ liệu sẽ nhập' +
            '<span class="spacer"></span><span class="small muted">' +
            (ds.length > GH ? 'hiển thị ' + GH + ' dòng đầu trong tổng số ' + T.num(ds.length, 0) + ' dòng'
                            : T.num(ds.length, 0) + ' dòng') + '</span></div>' +
            '<div class="card-b">' +
            '<div class="row mb8" style="gap:18px">' +
            kpiNho('Tổng số dòng', T.num(ds.length, 0), 'mỗi dòng Excel là một dòng bảng giá') +
            kpiNho('Liên kết danh mục', T.num(lk, 0), 'đã tra ra mặt hàng trong Danh mục', 'g') +
            kpiNho('Chưa liên kết', T.num(chua, 0), 'vẫn được ghi, nối lại sau', chua ? 'y' : '') +
            kpiNho('Loại giá', T.num((kq.cotGia || []).length, 0), 'cột giá đọc được từ tệp', 'b') +
            '</div>' +
            '<div class="tbl-wrap" style="max-height:40vh"><table class="tbl"><thead><tr>' +
            '<th style="width:58px" class="ctr">Dòng</th>' +
            '<th style="width:150px">Mã hàng</th><th>Tên hàng</th>' +
            '<th style="width:64px" class="ctr">ĐVT</th>' +
            kq.cotGia.map(function (c) {
                return '<th style="width:120px" class="num">' + T.esc(c) + '</th>'; }).join('') +
            '<th style="width:150px">Danh mục</th></tr></thead><tbody>' +
            xem.map(function (d) {
                return '<tr><td class="ctr muted">' + d.dongExcel + '</td>' +
                    '<td class="mono">' + T.esc(d.ma) + '</td>' +
                    '<td><span class="ellip">' + T.esc(d.ten) + '</span>' +
                    (d.thongSo ? '<div class="small muted ellip">' + T.esc(d.thongSo) + '</div>' : '') + '</td>' +
                    '<td class="ctr">' + T.esc(d.dvt) + '</td>' +
                    kq.cotGia.map(function (c) {
                        return '<td class="num">' + (d.gia[c] ? T.money(d.gia[c]) : '<span class="muted">—</span>') + '</td>';
                    }).join('') +
                    '<td>' + (d._hh
                        ? '<span class="pill g" title="' + T.esc(d._hh.ten) + '">đã liên kết</span>'
                        : '<span class="pill y">chưa có</span>') + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            (chua ? '<div class="note y mt8"><i class="bi bi-info-circle"></i><div>' +
                T.num(chua, 0) + ' dòng chưa có mặt hàng tương ứng trong Danh mục Hàng hóa. ' +
                '<b>Các dòng này vẫn được ghi đủ vào bảng giá</b> — khai mặt hàng trong Danh mục ' +
                'rồi bấm <b>Nối lại danh mục</b> ở phiên bản là liên kết ngay, không phải nhập lại tệp.' +
                '</div></div>' : '') +
            '</div></div>';
    }

    function kpiNho(l, v2, m, c) {
        return '<div class="kpi st ' + (c || '') + '" style="flex:1"><div class="lb">' + l + '</div>' +
            '<div class="vl" style="font-size:19px">' + v2 + '</div>' +
            '<div class="mo">' + m + '</div></div>';
    }

    /* Chiết khấu nội bộ kế thừa phụ thuộc MÃ BẢNG GIÁ và NGÀY HIỆU LỰC — đổi hãng
       hay đổi ngày là phải nạp lại, nếu không phiên bản mới sẽ mang chiết khấu
       của hãng khác. Mức người dùng đã tự gõ được giữ nguyên. */
    function veCKNhap(h) {
        var o = h.q('#bgCKNB');
        if (!o) return;
        var daGo = W.docChietKhauNoiBo(o);
        var maNay = (h.q('[data-f="ma"]') || {}).value || '';
        var tuNay = (h.q('[data-f="tuNgay"]') || {}).value || T.today();
        var nccNay = (h.q('[data-f="nhaCungCap"]') || {}).value || '';
        var tam = { ma: maNay, nhaCungCap: nccNay, tuNgay: tuNay };
        if (Object.keys(daGo).length) tam.chietKhauNoiBo = daGo;
        T.keThuaChietKhauNoiBo(tam);
        o.innerHTML = W.oChietKhauNoiBo(tam);
        UI.numInput(o);
    }

    function ghi(h) {
        if (!UI.validate(h.el, [{ k: 'nhaCungCap' }, { k: 'ten' }, { k: 'tuNgay' }])) return;
        /* KHÔNG BAO GIỜ ghi một phiên bản rỗng: phiên bản rỗng sẽ đóng hiệu lực và
           khóa mất phiên bản đang dùng của hãng đó. */
        if (!kq.dong.length)
            return UI.khongThe('Nhập bảng giá',
                'Không đọc được dòng dữ liệu nào từ tệp này.',
                'Bấm "Xem cấu trúc tệp" để chỉ lại cột Mã hàng, Tên hàng và các cột giá, ' +
                'hoặc kiểm tra lại tệp Excel.');
        var f = UI.read(h.el);
        var nguoi = (W.Q.nhanVienCuaToi() || {}).hoTen || DB.user().hoTen || DB.user().taiKhoan || '';

        /* Loại giá đọc từ tệp mà danh mục chưa có → tự khai bổ sung. */
        var moiLG = T.themLoaiGiaTuTep(kq.cotGia);

        var dsDong = kq.dong.map(function (d, i) {
            var hh = d._hh || null;
            return {
                hangHoaId: hh ? hh.id : '',
                ma: d.ma || (hh ? hh.ma : ''),
                model: hh ? (hh.model || hh.ma || '') : (d.ma || ''),
                ten: d.ten || (hh ? hh.ten : ''),
                dvt: d.dvt || (hh ? hh.dvt : ''),
                thongSo: d.thongSo || '', nhom: d.nhom || '', hang: d.xuatXu || '',
                maPhu: d.maPhu || '', anh: d.anh || '',
                ghiChu: d.ghiChu || '', gia: d.gia, dongExcel: d.dongExcel || (i + 1)
            };
        });

        var rec;
        if (boSungVao) {
            /* NHẬP BỔ SUNG — nối thêm dòng vào chính phiên bản đang mở. */
            rec = DB.get('bangGiaBan', boSungVao.id) || boSungVao;
            if (T.phienBanBiKhoa(rec))
                return UI.khongThe('Nhập bổ sung', T.lyDoKhoaPhienBan(rec),
                    'Mở chốt phiên bản hoặc nhập thành một phiên bản mới.');
            rec.dong = T.dongBangGia(rec).concat(dsDong);
            var cot = (rec.cotGia || []).slice();
            kq.cotGia.forEach(function (c) { if (cot.indexOf(c) < 0) cot.push(c); });
            rec.cotGia = cot;
            rec.nguoiCapNhat = nguoi; rec.capNhatLuc = T.now();
            rec.nguonTep = tenTep;
            T.dungChiMucBG(rec);
            T.ganKyBangGia(rec);
            DB.log('Cập nhật', 'bangGiaBan', rec); DB.save();
        } else {
            var maBG2 = String(f.ma || '').trim() || maTuHang(f.nhaCungCap);
            var o = {
                ma: maBG2, ten: String(f.ten).trim(), nhaCungCap: String(f.nhaCungCap).trim(),
                hangSX: String(f.nhaCungCap).trim(),
                moTa: f.ghiChu || '', ghiChu: f.ghiChu || '', moTaBac: '',
                donViId: '', tuNgay: f.tuNgay, denNgay: f.denNgay || '',
                trangThai: 'Đang áp dụng', macDinh: false, khoa: false,
                phienBan: phienBanKe(maBG2),
                dong: dsDong, cotGia: kq.cotGia.slice(), cotChinh: kq.cotGia[0] || '',
                ck: {}, ngungLienKet: {},
                nguoiCapNhat: nguoi, capNhatLuc: T.now(), ngayNhap: T.today(),
                nguonTep: tenTep, tepGocId: ''
            };
            T.dungChiMucBG(o);
            T.ganKyBangGia(o);
            /* Chiết khấu nội bộ: lấy đúng mức người dùng vừa khai trên biểu mẫu;
               không khai thì kế thừa BẢN SAO ĐỘC LẬP của phiên bản liền trước —
               sửa ở phiên bản mới không đụng tới phiên bản cũ. */
            o.chietKhauNoiBo = T.chuanChietKhauNoiBo(W.docChietKhauNoiBo(h.el));
            T.keThuaChietKhauNoiBo(o);
            /* Phiên bản đầu tiên của một hãng thì đặt luôn làm mặc định. */
            o.macDinh = !DB.all('bangGiaBan').some(function (b) { return b.ma === maBG2 && b.macDinh; });
            rec = DB.insert('bangGiaBan', o);
            dongPhienBanCu(maBG2, o.tuNgay, rec.id);
        }

        /* Lưu TỆP EXCEL GỐC của lần nhập này. */
        var tg = null;
        if (kq.goc && kq.goc.duLieu) {
            tg = T.luuTepGoc({
                bangGiaBanId: rec.id, ten: kq.goc.ten, mime: kq.goc.mime,
                kichThuoc: kq.goc.kichThuoc, duLieu: kq.goc.duLieu,
                nguoiNhap: nguoi, phienBan: 'v' + (rec.phienBan || 1),
                ghiChu: f.ghiChu || '', soDong: dsDong.length
            });
            if (tg) rec.tepGocId = tg.id;
        }
        var luuDuoc = DB.save();
        if (tg && !luuDuoc) {
            /* Không lưu nổi vì bộ nhớ đầy → bỏ nội dung tệp gốc, giữ bằng được
               số liệu bảng giá và nói thật với người dùng. */
            tg.duLieu = ''; tg.daBoNoiDung = true; tg = null;
            DB.save();
        }

        /* GHI NHỚ CẤU TRÚC TỆP của nhà cung cấp này cho lần sau. */
        T.ghiNhoCauTruc({
            chuKy: kq.chuKy || T.chuKyCauTruc((kq.tho || {}).ten || []),
            nhaCungCap: String(f.nhaCungCap).trim(), tenCot: (kq.tho || {}).ten || [],
            anhXa: T.clone(kq.anhXa), cotGiaJ: T.clone(kq.cotGiaJ),
            dongTieuDe: kq.dongTieuDe, caoTieuDe: kq.caoTieuDe,
            sheet: kq.sheet, tepCuoi: tenTep
        });
        DB.save();

        h.close();
        UI.toast('ok',
            boSungVao ? 'Đã nhập bổ sung ' + T.num(dsDong.length, 0) + ' dòng'
                      : 'Đã nhập bảng giá ' + rec.ten,
            T.num(dsDong.length, 0) + ' dòng · ' + kq.cotGia.length + ' loại giá' +
            (moiLG.length ? ' · thêm loại giá mới: ' + moiLG.join(', ') : '') +
            (tg ? ' · đã lưu tệp gốc' : (kq.goc && kq.goc.quaLon
                 ? ' · tệp gốc quá lớn nên không lưu lại' : '')), 8000);
        if (sauKhi) sauKhi(rec);
    }
}
W.xemTruocVaNhapBangGia = xemTruocVaNhap;

/* ==========================================================================
   3. MỞ MỘT PHIÊN BẢN BẢNG GIÁ
   Phiên bản đã chốt hoặc đã bị phiên bản mới thay thế → CHỈ XEM.
   ========================================================================== */
function moPhienBan(b, sauKhi) {
    if (!Q.co(MOD, 'xem')) return UI.thieuQuyen(MOD, 'xem');
    b = DB.get('bangGiaBan', b.id) || b;
    var khoa = T.phienBanBiKhoa(b) || !Q.co(MOD, 'sua');
    /* Phiên bản mang ĐÚNG loại giá của chính nó. Phiên bản chưa có loại giá nào
       thì hiển thị gợi ý để khai, nhưng chỉ ghi vào dữ liệu khi người dùng chủ
       động thêm loại giá — không tự ép cột nào. */
    var cot = (b.cotGia || []).filter(function (c) { return c; });
    var cotGoc = cot.slice();
    if (!cot.length) cot = T.tenLoaiGia().slice(0, 1);
    var trang = 1, cuon = 100, tim = '', loc = '';
    var sua = {};                       // hangHoaId|cột → giá mới (chỉ khi mở khóa)

    var m = UI.modal({
        size: 'full', dismiss: false,
        title: b.ten,
        sub: hangCua(b) + ' · phiên bản ' + (b.phienBan || 1) + ' · ' + T.nhanKyBangGia(b) +
             ' · hiệu lực từ ' + T.date(b.tuNgay) + (b.denNgay ? ' đến ' + T.date(b.denNgay) : ''),
        body: '<div id="pbCKNB"></div><div id="pbBao"></div><div id="pbThanh"></div><div id="pbBang"></div>',
        buttons: [
            { text: 'Đóng', icon: 'bi-x-lg', click: function (h) { h.close(); } },
            { text: 'Xuất bảng giá', icon: 'bi-printer', click: function () { inPhienBan(b); } }
        ].concat(khoa ? [] : [
            { text: 'Lưu bảng giá', cls: 'primary', icon: 'bi-check-lg', click: function (h) { luu(h); } }
        ]),
        onOpen: function (h) { ve(h); }
    });

    /* Chiết khấu nội bộ thuộc THÔNG TIN của phiên bản — khai tại "Sửa hồ sơ
       phiên bản". Ở đây chỉ nhắc lại để người dùng thấy ngay gói dữ liệu đầy đủ
       của phiên bản đang mở, không tạo thêm một nơi khai thứ hai. */
    function veCKNB(h) {
        var o = h.q('#pbCKNB');
        if (!o) return;
        o.innerHTML = '<div class="note b"><i class="bi bi-diagram-3"></i><div>' +
            '<b>Chiết khấu nội bộ của phiên bản này:</b> ' + T.esc(W.tomTatCKNB(b)) +
            ' · Sửa tại <b>Bảng giá → Sửa hồ sơ phiên bản</b>.</div></div>';
    }

    function dsDong() {
        var ds = T.dongBangGia(b);
        /* Đánh số thứ tự MỘT LẦN — tệp mười nghìn dòng vẫn mở tức thì, không
           dò tuyến tính từng dòng khi vẽ bảng. */
        for (var i2 = 0; i2 < ds.length; i2++) ds[i2]._i = i2;
        var k = T.kd(tim);
        if (k) ds = ds.filter(function (d) {
            return T.kd(d.ma).indexOf(k) >= 0 || T.kd(d.ten).indexOf(k) >= 0 ||
                   T.kd(d.model || '').indexOf(k) >= 0 || T.kd(d.thongSo || '').indexOf(k) >= 0;
        });
        if (loc === 'chua') ds = ds.filter(function (d) { return !d.hangHoaId; });
        else if (loc === 'lk') ds = ds.filter(function (d) { return !!d.hangHoaId; });
        else if (loc === 'khong') ds = ds.filter(function (d) {
            return !cot.some(function (c) { return Number(d.gia[c]) > 0; }); });
        return ds;
    }

    function ve(h, giuThanh) {
        var ds = dsDong();
        var tong = ds.length, soTrang = Math.max(1, Math.ceil(tong / cuon));
        if (trang > soTrang) trang = soTrang;
        var xem = ds.slice((trang - 1) * cuon, trang * cuon);
        var chua = soChuaLienKet(b);
        veCKNB(h);

        h.q('#pbBao').innerHTML = khoa
            ? '<div class="note y"><i class="bi bi-lock-fill"></i><div><b>Phiên bản chỉ xem.</b> ' +
              T.esc(T.lyDoKhoaPhienBan(b) || 'Không có quyền sửa bảng giá.') +
              ' Muốn đổi giá thì <b>nhập một phiên bản mới</b> hoặc mở chốt phiên bản này.</div></div>'
            : '<div class="note b"><i class="bi bi-pencil-square"></i><div>Sửa giá trực tiếp vào ô rồi bấm ' +
              '<b>Lưu bảng giá</b>. Mỗi dòng của tệp là <b>một dòng riêng</b> — không gộp, không loại bỏ.' +
              '</div></div>';

        if (!giuThanh) h.q('#pbThanh').innerHTML =
            '<div class="row mt12 mb8" style="flex-wrap:wrap;gap:8px">' +
            '<input id="pbTim" class="inp-tim" placeholder="Tìm mã hàng · model · tên hàng · thông số…" ' +
                'value="' + T.esc(tim) + '" style="min-width:320px">' +
            '<select id="pbLoc" style="width:210px">' +
                '<option value="">Tất cả ' + T.num(soDong(b), 0) + ' dòng</option>' +
                '<option value="lk"' + (loc === 'lk' ? ' selected' : '') + '>Đã liên kết danh mục</option>' +
                '<option value="chua"' + (loc === 'chua' ? ' selected' : '') + '>Chưa liên kết danh mục</option>' +
                '<option value="khong"' + (loc === 'khong' ? ' selected' : '') + '>Chưa có giá</option>' +
            '</select>' +
            '<select id="pbCuon" style="width:150px">' +
                [50, 100, 200, 500].map(function (n) {
                    return '<option value="' + n + '"' + (cuon === n ? ' selected' : '') + '>' + n + ' dòng/trang</option>';
                }).join('') + '</select>' +
            '<span class="spacer"></span>' +
            (chua ? '<button class="btn sm" id="pbNoi"><i class="bi bi-link-45deg"></i> Nối lại danh mục (' +
                T.num(chua, 0) + ')</button>' : '') +
            (khoa ? '' : '<button class="btn sm" id="pbThemLG"><i class="bi bi-plus-lg"></i> Thêm loại giá</button>' +
                '<button class="btn sm" id="pbBoSung"><i class="bi bi-file-earmark-plus"></i> Nhập bổ sung</button>') +
            '<button class="btn sm" id="pbTepGoc"><i class="bi bi-file-earmark-arrow-down"></i> Tệp gốc</button>' +
            '</div>';

        h.q('#pbBang').innerHTML =
            '<div class="tbl-wrap" style="max-height:calc(100vh - 400px)"><table class="tbl"><thead><tr>' +
            '<th style="width:58px" class="ctr">Dòng</th>' +
            '<th style="width:150px">Mã hàng</th><th>Tên hàng</th>' +
            '<th style="width:62px" class="ctr">ĐVT</th>' +
            cot.map(function (c) { return '<th style="width:132px" class="num">' + T.esc(c) + '</th>'; }).join('') +
            '<th style="width:130px">Danh mục</th></tr></thead><tbody>' +
            (xem.length ? xem.map(function (d, i) {
                var stt = (trang - 1) * cuon + i;
                return '<tr><td class="ctr muted">' + (d.dongExcel || (stt + 1)) + '</td>' +
                    '<td class="mono">' + T.esc(d.ma) + '</td>' +
                    '<td><span class="ellip">' + T.esc(d.ten) + '</span>' +
                    (d.thongSo ? '<div class="small muted ellip">' + T.esc(d.thongSo) + '</div>' : '') + '</td>' +
                    '<td class="ctr">' + T.esc(d.dvt) + '</td>' +
                    cot.map(function (c) {
                        var gt = d.gia[c];
                        return '<td>' + (khoa
                            ? '<div class="num">' + (gt ? T.money(gt) : '<span class="muted">—</span>') + '</div>'
                            : '<input class="num tien" data-g="' + T.esc(d.dongExcel) + '" ' +
                              'data-i="' + T.esc(String(d._i)) + '" ' +
                              'data-c="' + T.esc(c) + '" value="' + T.esc(gt ? T.soVe(gt) : '') + '">') +
                            '</td>';
                    }).join('') +
                    '<td>' + (d.hangHoaId && DB.get('hangHoa', d.hangHoaId)
                        ? '<span class="pill g">đã liên kết</span>'
                        : '<span class="pill y">chưa có</span>') + '</td></tr>';
            }).join('') : '<tr><td colspan="' + (5 + cot.length) + '"><div class="trong">' +
                'Không có dòng nào khớp điều kiện lọc.</div></td></tr>') +
            '</tbody></table></div>' +
            '<div class="row mt8"><span class="small muted">Hiển thị ' +
                T.num(xem.length, 0) + ' / ' + T.num(tong, 0) + ' dòng</span>' +
            '<span class="spacer"></span>' +
            '<button class="btn sm" id="pbTruoc"' + (trang <= 1 ? ' disabled' : '') + '>‹ Trang trước</button>' +
            '<span class="small" style="padding:0 10px">Trang <b>' + trang + '</b> / ' + soTrang + '</span>' +
            '<button class="btn sm" id="pbSau"' + (trang >= soTrang ? ' disabled' : '') + '>Trang sau ›</button>' +
            '</div>';

        UI.numInput(h.el);
        if (giuThanh) { ganTrang(h); return; }
        var oT = h.q('#pbTim');
        /* Gõ tìm kiếm chỉ vẽ lại BẢNG, giữ nguyên thanh công cụ — không mất con
           trỏ và không mất ký tự đang gõ. */
        if (oT) oT.oninput = T.tre(function () { tim = oT.value; trang = 1; ve(h, true); }, 250);
        h.q('#pbLoc').onchange = function () { loc = this.value; trang = 1; ve(h, true); };
        h.q('#pbCuon').onchange = function () { cuon = Number(this.value); trang = 1; ve(h, true); };
        ganTrang(h);
        if (h.q('#pbNoi')) h.q('#pbNoi').onclick = function () { noiLaiDanhMuc(b, function () { ve(h); if (sauKhi) sauKhi(); }); };
        if (h.q('#pbThemLG')) h.q('#pbThemLG').onclick = function () { themLoaiGiaVaoPB(h); };
        if (h.q('#pbBoSung')) h.q('#pbBoSung').onclick = function () {
            W.nhapBangGiaMoi(function () {
                b = DB.get('bangGiaBan', b.id) || b;
                /* Nhập bổ sung có thể thêm loại giá mới vào chính phiên bản này —
                   phải nạp lại danh sách cột, nếu không lần "Lưu bảng giá" sau sẽ
                   ghi đè bằng danh sách cũ và xóa mất loại giá vừa nhập. */
                cot = (b.cotGia || []).filter(function (c) { return c; });
                cotGoc = cot.slice();
                if (!cot.length) cot = T.tenLoaiGia().slice(0, 1);
                ve(h); if (sauKhi) sauKhi();
            }, b);
        };
        h.q('#pbTepGoc').onclick = function () { W.tepGocPhienBan(b); };
    }

    function ganTrang(h) {
        var ds2 = dsDong();
        var soTrang2 = Math.max(1, Math.ceil(ds2.length / cuon));
        var t1 = h.q('#pbTruoc'), t2 = h.q('#pbSau');
        if (t1) t1.onclick = function () { if (trang > 1) { trang--; ve(h, true); } };
        if (t2) t2.onclick = function () { if (trang < soTrang2) { trang++; ve(h, true); } };
        if (!khoa) h.el.querySelectorAll('[data-g]').forEach(function (e) {
            e.onchange = function () {
                sua[e.getAttribute('data-i') + '|' + e.getAttribute('data-c')] = T.so(e.value);
            };
        });
    }

    function themLoaiGiaVaoPB(h) {
        var con = T.tenLoaiGia().filter(function (c) { return cot.indexOf(c) < 0; });
        if (!con.length) return UI.toast('info', 'Phiên bản đã có đủ loại giá của danh mục',
            'Thêm loại giá mới tại Danh mục → Loại giá.');
        UI.modal({
            size: 'sm', title: 'Thêm loại giá vào phiên bản',
            body: '<div class="fld"><label>Loại giá</label><select id="lgChon">' +
                  opt(con, con[0]) + '</select></div>' +
                  '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>' +
                  'Loại giá được thêm vào <b>chính phiên bản này</b>, giá để trống cho tới khi anh khai. ' +
                  'Các phiên bản khác không đổi.</div></div>',
            buttons: [
                { text: 'Hủy', click: function (x) { x.close(); } },
                { text: 'Thêm', cls: 'primary', icon: 'bi-plus-lg', click: function (x) {
                    var c = x.q('#lgChon').value;
                    if (cot.indexOf(c) < 0) cot.push(c);
                    if (cotGoc.indexOf(c) < 0) { /* đánh dấu có thay đổi thật */ }
                    x.close(); ve(h);
                    UI.toast('ok', 'Đã thêm loại giá "' + c + '" vào phiên bản',
                        'Khai giá rồi bấm Lưu bảng giá.');
                } }
            ]
        });
    }

    function luu(h) {
        var ds = T.dongBangGia(b), n = 0;
        Object.keys(sua).forEach(function (k) {
            var p = k.split('|'), i = Number(p[0]), c = p.slice(1).join('|');
            var d = ds[i]; if (!d) return;
            var g = Number(sua[k]) || 0;
            if (g > 0) { if (d.gia[c] !== g) { d.gia[c] = g; n++; } }
            else if (d.gia[c] !== undefined) { delete d.gia[c]; n++; }
        });
        var o = T.clone(b);
        o.dong = ds;
        /* Chỉ ghi lại danh sách loại giá khi thật sự có thay đổi do người dùng
           chủ động thêm — mở ra rồi lưu KHÔNG làm phiên bản mọc thêm loại giá. */
        o.cotGia = (cot.length !== cotGoc.length ||
                    cot.some(function (c, i2) { return c !== cotGoc[i2]; }))
            ? cot.slice() : cotGoc.slice();
        o.nguoiCapNhat = (W.Q.nhanVienCuaToi() || {}).hoTen || DB.user().hoTen || '';
        o.capNhatLuc = T.now();
        T.dungChiMucBG(o);
        T.ganKyBangGia(o);
        DB.update('bangGiaBan', b.id, o);
        b = DB.get('bangGiaBan', b.id);
        sua = {};
        h.close();
        UI.toast('ok', 'Đã lưu bảng giá', n + ' ô giá được cập nhật.');
        if (sauKhi) sauKhi();
    }
}
W.moPhienBanBangGia = moPhienBan;

/* --------------------------------------------- NỐI LẠI DANH MỤC HÀNG HÓA */
function noiLaiDanhMuc(b, sauKhi) {
    var ds = T.dongBangGia(b);
    var chua = ds.filter(function (d) { return !d.hangHoaId; });
    if (!chua.length) return UI.toast('ok', 'Mọi dòng đều đã liên kết danh mục');
    var noi = [];
    chua.forEach(function (d) {
        var kq = W.timHangHoaLinhHoat(d.ma, d.maPhu || '', d.ten, d.thongSo, !!d.ma);
        if (kq.hh) noi.push({ d: d, hh: kq.hh, theo: kq.theo });
    });
    /* Dòng không tra ra mặt hàng nào — cho TẠO MỚI ngay từ Bảng giá, qua đúng
       cửa "Tạo mới mặt hàng" của Danh mục. Bảng giá KHÔNG tự sinh Mã hàng. */
    var conLai = chua.filter(function (d) {
        return !noi.some(function (x) { return x.d === d; });
    });
    function ghiLien(nhan) {
        noi.forEach(function (x) {
            x.d.hangHoaId = x.hh.id;
            x.d.ma = x.hh.ma;
            if (!x.d.model) x.d.model = x.hh.model || '';
        });
        var o = T.clone(b); o.dong = ds;
        T.dungChiMucBG(o);
        DB.update('bangGiaBan', b.id, o);
        UI.toast('ok', nhan || ('Đã nối ' + noi.length + ' dòng vào Danh mục Hàng hóa'));
        if (sauKhi) sauKhi();
    }
    function taoConLai() {
        if (!conLai.length) return;
        if (!Q.co('hangHoa', 'them')) return UI.thieuQuyen('hangHoa', 'them');
        /* GHI NGAY phần đã nối được. Người dùng bỏ ngang cửa "Tạo mới mặt hàng"
           thì công nối lại vẫn được giữ, không mất trắng. */
        if (noi.length) ghiLien('Đã nối ' + noi.length + ' dòng vào Danh mục Hàng hóa');
        /* Dựng dòng tạm mang đúng dữ liệu của bảng giá rồi đưa qua cửa chung.
           Cửa đó sinh Mã hàng, lưu vào Danh mục và gán ID ngược lại cho dòng. */
        var tam = conLai.map(function (d) {
            return { _d: d, model: d.model || d.ma || '', maHang: d.model || d.ma || '',
                     tenHang: d.ten || '', dvt: d.dvt || '', thongSo: d.thongSo || '',
                     hang: d.hang || '' };
        });
        W.dongBoHangHoa(tam, function () {
            tam.forEach(function (t) {
                if (!t.hangHoaId) return;
                t._d.hangHoaId = t.hangHoaId;
                t._d.ma = t.maHang; t._d.model = t.model || t._d.model;
                noi.push({ d: t._d, hh: DB.get('hangHoa', t.hangHoaId), theo: 'Tạo mới' });
            });
            ghiLien('Đã nối và tạo mới mặt hàng cho ' +
                    noi.filter(function (x) { return x.hh; }).length + ' dòng bảng giá');
        }, function () {
            /* Bỏ ngang: phần đã nối ở trên vẫn giữ nguyên. */
            if (sauKhi) sauKhi();
        });
    }

    if (!noi.length) {
        return UI.confirm({
            title: 'Nối lại danh mục hàng hóa', icon: 'bi-link-45deg',
            message: T.num(chua.length, 0) + ' dòng chưa liên kết đều <b>chưa có trong Danh mục Hàng hóa</b>.',
            note: 'Bảng giá chỉ quản lý giá, không sinh Mã hàng. Chọn <b>Tạo mới mặt hàng</b> để ' +
                  'Danh mục Hàng hóa khai các mặt hàng này và cấp Mã hàng nội bộ, sau đó bảng giá ' +
                  'tự liên kết ngay.',
            okText: 'Tạo mới mặt hàng', okIcon: 'bi-plus-circle',
            ok: taoConLai
        });
    }
    UI.confirm({
        title: 'Nối lại danh mục hàng hóa', icon: 'bi-link-45deg',
        message: 'Nối <b>' + T.num(noi.length, 0) + '</b> / ' + T.num(chua.length, 0) +
                 ' dòng chưa liên kết vào đúng mặt hàng trong Danh mục?',
        note: 'Chỉ gán liên kết bằng ID nội bộ. Không sửa giá, không thêm và không xóa dòng nào.' +
              (conLai.length ? '<br>Còn <b>' + T.num(conLai.length, 0) + '</b> dòng chưa có trong Danh mục — ' +
                               'chọn <b>Tạo mới mặt hàng</b> để Danh mục khai và cấp Mã hàng cho chúng.' : ''),
        okText: 'Nối lại', okIcon: 'bi-link',
        phuText: conLai.length ? 'Nối lại và tạo mới mặt hàng' : '',
        phuIcon: 'bi-plus-circle',
        phu: conLai.length ? taoConLai : null,
        ok: function () { ghiLien(); }
    });
}
W.noiLaiDanhMucBangGia = noiLaiDanhMuc;

/* ==========================================================================
   4. THÔNG TIN PHIÊN BẢN · KHÔI PHỤC
   ========================================================================== */
/* ==========================================================================
   CHIẾT KHẤU NỘI BỘ — KHAI NGAY TRONG THÔNG TIN CỦA PHIÊN BẢN BẢNG GIÁ
   --------------------------------------------------------------------------
   Danh sách công ty lấy ĐỘNG từ danh mục Đơn vị phát hành, không cắm cứng.
   Khai MỘT LẦN cho cả phiên bản, không khai theo từng mặt hàng.
   Không tạo menu mới, không tạo module mới — chỉ là một khối trong biểu mẫu
   hồ sơ phiên bản và trong biểu mẫu nhập bảng giá.
   ========================================================================== */
/** Các đơn vị phát hành phải khai chiết khấu nội bộ (trừ đơn vị nguồn). */
function dsDonViCKNB() {
    return DB.all('donVi').filter(function (d) { return !T.laCtyNguon(d.id); });
}
/** Khối nhập chiết khấu nội bộ — dùng chung cho mọi biểu mẫu phiên bản. */
W.oChietKhauNoiBo = function (rec) {
    var ck = T.chietKhauNoiBoCua(rec);
    var dvs = dsDonViCKNB();
    var nguon = DB.get('donVi', T.cauHinhDaCongTy().ctyNguonId) || {};
    if (!dvs.length) return '';
    return '<div class="card mt12"><div class="card-h">' +
        '<i class="bi bi-diagram-3"></i> Chiết khấu nội bộ của phiên bản này</div>' +
        '<div class="card-b">' +
        '<div class="note b mb8"><i class="bi bi-info-circle"></i><div>' +
        T.esc(nguon.tat || 'Đơn vị nguồn') + ' bán nội bộ cho các công ty theo mức chiết khấu dưới đây, ' +
        'tính trên <b>đúng loại giá đang chọn</b> của chứng từ. Khai <b>một lần cho cả phiên bản</b>, ' +
        'không khai theo từng mặt hàng. Tạo phiên bản mới thì mức này được sao chép theo và sửa lại được; ' +
        'phiên bản cũ giữ nguyên.</div></div>' +
        '<div class="grid4">' + dvs.map(function (d) {
            return '<div class="fld"><label>' + T.esc(d.tat) + ' (%)</label>' +
                '<input class="num tyle" data-ck="' + T.esc(d.id) + '" value="' +
                T.esc(Number(ck[d.id]) > 0 ? T.soVe(ck[d.id], 2) : '0') + '"></div>';
        }).join('') + '</div></div></div>';
};
/** Đọc khối chiết khấu nội bộ từ một biểu mẫu đang mở. */
W.docChietKhauNoiBo = function (el) {
    var ra = {};
    (el ? el.querySelectorAll('[data-ck]') : []).forEach(function (e) {
        var v = T.so(e.value);
        if (v > 0) ra[e.getAttribute('data-ck')] = v;
    });
    return ra;
};
/** Câu tóm tắt chiết khấu nội bộ của một phiên bản. */
W.tomTatCKNB = function (b) {
    var ck = T.chietKhauNoiBoCua(b);
    var ds = dsDonViCKNB().map(function (d) {
        return d.tat + ' ' + T.num(Number(ck[d.id]) || 0, 2) + '%';
    });
    return ds.length ? ds.join(' · ') : 'chưa khai đơn vị phát hành nào';
};

function formPhienBan(rec, sauKhi) {
    if (!Q.co(MOD, 'sua')) return UI.thieuQuyen(MOD, 'sua');
    var r = rec || {};
    UI.modal({
        size: 'md', dismiss: false,
        title: 'Thông tin phiên bản bảng giá',
        sub: 'Sửa hồ sơ phiên bản — không đụng tới số liệu giá',
        body: '<div class="grid2">' +
            '<div class="fld req"><label>Nhà cung cấp / Hãng</label>' +
                '<input data-f="nhaCungCap" value="' + T.esc(r.nhaCungCap || '') + '"></div>' +
            '<div class="fld"><label>Mã bảng giá</label>' +
                '<input data-f="ma" value="' + T.esc(r.ma || '') + '"></div>' +
            '<div class="fld req span2" style="grid-column:span 2"><label>Tên phiên bản</label>' +
                '<input data-f="ten" value="' + T.esc(r.ten || '') + '"></div>' +
            '<div class="fld req"><label>Hiệu lực từ</label>' +
                '<input type="date" data-f="tuNgay" value="' + T.esc(r.tuNgay || T.today()) + '"></div>' +
            '<div class="fld"><label>Đến ngày</label>' +
                '<input type="date" data-f="denNgay" value="' + T.esc(r.denNgay || '') + '"></div>' +
            '<div class="fld"><label>Phạm vi áp dụng</label>' +
                '<input value="Dùng chung toàn nhóm" readonly ' +
                'style="background:var(--bg-2)" title="Bảng giá do đơn vị nguồn xây dựng, ' +
                'áp dụng cho mọi đơn vị phát hành"></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' +
                opt(['Đang áp dụng', 'Ngừng áp dụng'], r.trangThai || 'Đang áp dụng') + '</select></div>' +
            '<div class="fld span2" style="grid-column:span 2"><label>Ghi chú</label>' +
                '<input data-f="moTa" value="' + T.esc(r.moTa || '') + '"></div>' +
            '</div>' +
            W.oChietKhauNoiBo(r) +
            '<div class="note b mt12"><i class="bi bi-shield-check"></i><div>' +
            'Số dòng, giá và lịch sử của phiên bản <b>không thay đổi</b> khi sửa hồ sơ này.</div></div>',
        onOpen: function (h) { UI.numInput(h.el); },
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } },
            { text: 'Lưu', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                if (!UI.validate(h.el, [{ k: 'nhaCungCap' }, { k: 'ten' }, { k: 'tuNgay' }])) return;
                var v = UI.read(h.el);
                var o = T.clone(r);
                o.donViId = '';   /* bảng giá luôn dùng chung toàn nhóm */
                ['nhaCungCap', 'ma', 'ten', 'tuNgay', 'denNgay', 'trangThai', 'moTa']
                    .forEach(function (k) { o[k] = v[k]; });
                o.ma = String(o.ma || '').trim() || maTuHang(o.nhaCungCap);
                o.hangSX = o.nhaCungCap;
                /* Chiết khấu nội bộ CHỈ thuộc phiên bản đang sửa. */
                o.chietKhauNoiBo = T.chuanChietKhauNoiBo(W.docChietKhauNoiBo(h.el));
                o.nguoiCapNhat = (W.Q.nhanVienCuaToi() || {}).hoTen || DB.user().hoTen || '';
                o.capNhatLuc = T.now();
                T.ganKyBangGia(o);
                DB.update('bangGiaBan', r.id, o);
                h.close(); UI.toast('ok', 'Đã cập nhật phiên bản', o.ten);
                if (sauKhi) sauKhi();
            } }
        ]
    });
}
W.suaHoSoPhienBanGia = formPhienBan;

function khoiPhucPhienBan(b, sauKhi) {
    if (!Q.co(MOD, 'them')) return UI.thieuQuyen(MOD, 'them');
    UI.confirm({
        title: 'Khôi phục phiên bản bảng giá', icon: 'bi-arrow-counterclockwise',
        message: 'Khôi phục giá của <b>' + T.esc(b.ten) + '</b> (phiên bản ' + (b.phienBan || 1) + ')?',
        note: 'Hệ thống tạo một <b>phiên bản mới</b> sao chép nguyên toàn bộ dòng và giá của phiên bản ' +
              'này. Phiên bản gốc <b>vẫn nằm nguyên trong lịch sử</b>, không bị sửa và không bị xóa.',
        okText: 'Tạo phiên bản khôi phục', okIcon: 'bi-clock-history',
        ok: function () {
            var nguoi = (W.Q.nhanVienCuaToi() || {}).hoTen || DB.user().hoTen || '';
            var o = T.clone(b);
            delete o.id; delete o._tao; delete o._sua; delete o._nguoiTao; delete o._nguoiSua;
            o.ten = b.ten + ' (khôi phục ' + T.date(T.today()) + ')';
            o.phienBan = phienBanKe(b.ma);
            o.tuNgay = T.today(); o.denNgay = '';
            o.trangThai = 'Đang áp dụng'; o.macDinh = false; o.khoa = false;
            o.khoiPhucTu = b.id; o.tepGocId = '';
            o.nguoiCapNhat = nguoi; o.capNhatLuc = T.now(); o.ngayNhap = T.today();
            o.dong = T.clone(T.dongBangGia(b));
            /* Khôi phục nguyên trạng: chính sách giá nội bộ cũng thuộc gói dữ
               liệu của phiên bản nên được sao lại đầy đủ. */
            o.chietKhauNoiBo = T.clone(b.chietKhauNoiBo || {});
            T.dungChiMucBG(o);
            T.ganKyBangGia(o);
            var rec = DB.insert('bangGiaBan', o);
            dongPhienBanCu(b.ma, o.tuNgay, rec.id);
            DB.save();
            UI.toast('ok', 'Đã tạo phiên bản khôi phục',
                rec.ten + ' — ' + T.num(soDong(rec), 0) + ' dòng.');
            if (sauKhi) sauKhi();
        }
    });
}
W.khoiPhucPhienBanGia = khoiPhucPhienBan;

/* ==========================================================================
   5. TỆP EXCEL GỐC
   ========================================================================== */
W.tepGocPhienBan = function (b) {
    var ds = DB.all('tepGoc').filter(function (t) { return t.bangGiaBanId === b.id; });
    ds = ds.slice().sort(function (x, y) {
        var p = String(x.luc || ''), q = String(y.luc || '');
        if (p !== q) return p < q ? 1 : -1;
        return ds.indexOf(y) - ds.indexOf(x);
    });
    UI.modal({
        size: 'lg', title: 'Tệp Excel gốc đã nhập',
        sub: b.ten + ' — ' + hangCua(b),
        body: ds.length
          ? '<div class="note g mb12"><i class="bi bi-archive-fill"></i><div>' +
            'Mỗi lần nhập, TVERP giữ nguyên <b>tệp Excel gốc</b> của nhà cung cấp cùng người nhập, ' +
            'thời điểm và ghi chú. Tải lại bất cứ lúc nào để đối chiếu.</div></div>' +
            '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
            '<th>Tên tệp</th><th style="width:110px">Phiên bản</th>' +
            '<th style="width:110px" class="num">Số dòng</th>' +
            '<th style="width:110px" class="num">Dung lượng</th>' +
            '<th style="width:170px">Người nhập</th><th style="width:150px">Thời điểm</th>' +
            '<th style="width:120px" class="ctr">Tải về</th></tr></thead><tbody>' +
            ds.map(function (t) {
                return '<tr><td><b>' + T.esc(t.ten) + '</b>' +
                    (t.ghiChu ? '<div class="small muted ellip">' + T.esc(t.ghiChu) + '</div>' : '') + '</td>' +
                    '<td class="ctr">' + T.esc(t.phienBan || '') + '</td>' +
                    '<td class="num">' + T.num(t.soDong || 0, 0) + '</td>' +
                    '<td class="num">' + (t.kichThuoc ? (t.kichThuoc / 1024).toFixed(0) + ' KB' : '—') + '</td>' +
                    '<td>' + T.esc(t.nguoiNhap || '') + '</td>' +
                    '<td class="small">' + T.dateTime(t.luc) + '</td>' +
                    '<td class="ctr"><button class="btn sm primary" data-tai="' + t.id + '">' +
                    '<i class="bi bi-download"></i> Tải</button></td></tr>';
            }).join('') + '</tbody></table></div>'
          : '<div class="note y"><i class="bi bi-info-circle"></i><div>' +
            'Phiên bản này chưa có tệp gốc được lưu. Tệp gốc được lưu tự động từ ' +
            '<b>phiên bản 5.0.0</b> trở đi, hoặc khi tệp nhỏ hơn ' +
            (T.CO_TEP_GOC / 1048576).toFixed(0) + ' MB.</div></div>',
        buttons: [{ text: 'Đóng', cls: 'primary', click: function (h) { h.close(); } }],
        onOpen: function (h) {
            h.el.querySelectorAll('[data-tai]').forEach(function (nut) {
                nut.onclick = function () { taiTepGoc(nut.getAttribute('data-tai')); };
            });
        }
    });
};

function taiTepGoc(id) {
    var t = DB.get('tepGoc', id);
    if (!t || !t.duLieu) return UI.toast('err', 'Không tìm thấy nội dung tệp gốc');
    try {
        var bin = atob(t.duLieu), n = bin.length, u = new Uint8Array(n), i;
        for (i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
        var blob = new Blob([u], { type: t.mime || 'application/octet-stream' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = t.ten || 'BangGia.xlsx';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
        UI.toast('ok', 'Đang tải tệp gốc', t.ten);
    } catch (e) {
        UI.toast('err', 'Không tải được tệp gốc', String(e.message || e));
    }
}
W.taiTepGocBangGia = taiTepGoc;

/* ==========================================================================
   6. CẤU TRÚC TỆP ĐÃ GHI NHỚ
   ========================================================================== */
W.xemCauTrucDaNho = function () {
    var goc = DB.all('mauBangGia');
    var ds = goc.slice().sort(function (a, b) {
        var p = String(a.lanCuoi || ''), q = String(b.lanCuoi || '');
        if (p !== q) return p < q ? 1 : -1;
        return goc.indexOf(b) - goc.indexOf(a);
    });
    UI.modal({
        size: 'xl', title: 'Cấu trúc tệp bảng giá đã ghi nhớ',
        sub: 'TVERP tự nhớ khuôn mẫu tệp của từng nhà cung cấp — lần nhập sau không phải cấu hình lại',
        body: '<div class="note b mb12"><i class="bi bi-lightning-charge-fill"></i><div>' +
            'Sau lần nhập đầu tiên, hệ thống ghi nhớ cách đọc tệp của mỗi nhà cung cấp: cột nào là ' +
            'mã hàng, cột nào là tên hàng, những cột nào là giá và tên loại giá tương ứng. ' +
            'Lần sau chỉ cần chọn tệp là nhập được ngay.</div></div>' +
            (ds.length
              ? '<div class="tbl-wrap" style="max-height:56vh"><table class="tbl"><thead><tr>' +
                '<th style="width:200px">Nhà cung cấp</th><th>Các cột của tệp</th>' +
                '<th style="width:220px">Loại giá</th>' +
                '<th style="width:100px" class="num">Đã dùng</th>' +
                '<th style="width:150px">Lần cuối</th>' +
                '<th style="width:90px" class="ctr">Quên</th></tr></thead><tbody>' +
                ds.map(function (m) {
                    return '<tr><td><b>' + T.esc(m.nhaCungCap || '(chưa rõ)') + '</b>' +
                        (m.tepCuoi ? '<div class="small muted ellip">' + T.esc(m.tepCuoi) + '</div>' : '') + '</td>' +
                        '<td class="small"><span class="ellip">' +
                            T.esc((m.tenCot || []).filter(Boolean).join(' · ')) + '</span></td>' +
                        '<td class="small">' + T.esc((m.cotGiaJ || []).map(function (c) { return c.t; }).join(' · ')) + '</td>' +
                        '<td class="num">' + T.num(m.soLanDung || 1, 0) + ' lần</td>' +
                        '<td class="small">' + T.dateTime(m.lanCuoi) + '</td>' +
                        '<td class="ctr"><button class="btn sm danger" data-quen="' + m.id + '">' +
                        '<i class="bi bi-x-lg"></i></button></td></tr>';
                }).join('') + '</tbody></table></div>'
              : '<div class="trong"><i class="bi bi-diagram-2"></i><b>Chưa ghi nhớ cấu trúc tệp nào</b>' +
                'Nhập một tệp bảng giá là hệ thống tự ghi nhớ.</div>'),
        buttons: [{ text: 'Đóng', cls: 'primary', click: function (h) { h.close(); } }],
        onOpen: function (h) {
            h.el.querySelectorAll('[data-quen]').forEach(function (nut) {
                nut.onclick = function () {
                    var id = nut.getAttribute('data-quen');
                    var m = DB.get('mauBangGia', id);
                    UI.confirm({
                        title: 'Quên cấu trúc tệp', danger: true,
                        message: 'Quên cách đọc tệp của <b>' + T.esc((m || {}).nhaCungCap || '') + '</b>?',
                        note: 'Lần nhập sau hệ thống sẽ tự nhận diện lại từ đầu. Dữ liệu bảng giá đã nhập không đổi.',
                        okText: 'Quên cấu trúc',
                        ok: function () {
                            var a = DB.all('mauBangGia');
                            for (var i = 0; i < a.length; i++) if (a[i].id === id) { a.splice(i, 1); break; }
                            DB.save(); h.close(); W.xemCauTrucDaNho();
                            UI.toast('ok', 'Đã quên cấu trúc tệp');
                        }
                    });
                };
            });
        }
    });
};

/* ==========================================================================
   7. DANH MỤC LOẠI GIÁ — DOANH NGHIỆP TỰ KHAI, KHÔNG GIỚI HẠN
   ========================================================================== */
S['loai-gia'] = function (host) {
    W.DanhMucNen(host, {
        coll: 'loaiGia', mod: 'loaiGia', title: 'Loại giá',
        sub: 'Các mức giá doanh nghiệp đang dùng — thêm bao nhiêu loại cũng được, không phải sửa phần mềm',
        dungO: 'Dùng ở Bảng giá, ô "Mức giá áp dụng" trên Báo giá · Đơn bán hàng · Hợp đồng, ' +
               'chính sách giá của từng công ty và popup chọn hàng hóa.',
        cot: [
            { k: 'ma', t: 'Mã', w: 100, req: true },
            { k: 'ten', t: 'Tên loại giá', w: 260, req: true, rong: true },
            { k: 'thuTu', t: 'Thứ tự hiển thị', w: 140, type: 'so' },
            { k: 'moTa', t: 'Diễn giải', w: 420, rong: true }
        ],
        dangDung: function (r) {
            var n = 0;
            DB.all('bangGiaBan').forEach(function (b) {
                if ((b.cotGia || []).some(function (c) { return T.kd(c) === T.kd(r.ten); })) n++;
            });
            return n;
        }
    });
};

/* ==========================================================================
   8. XUẤT BIỂU MẪU BẢNG GIÁ
   ========================================================================== */
function inPhienBan(b) {
    var cot = (b.cotGia || []).slice();
    var ds = T.dongBangGia(b);
    var cols = [{ t: 'STT', k: '_stt', w: 6, ctr: true },
                { t: 'Mã hàng', k: 'ma', w: 18 },
                { t: 'Tên hàng hóa', k: 'ten', w: 44 },
                { t: 'ĐVT', k: 'dvt', w: 8, ctr: true }]
        .concat(cot.map(function (c) { return { t: c, k: 'g_' + T.kd(c).replace(/\W+/g, '_'), w: 15, tien: true }; }))
        .concat([{ t: 'Ghi chú', k: 'ghiChu', w: 24 }]);
    var rows = ds.map(function (d, i) {
        var o = { _stt: i + 1, ma: d.ma, ten: d.ten, dvt: d.dvt, ghiChu: d.ghiChu || '' };
        cot.forEach(function (c) { o['g_' + T.kd(c).replace(/\W+/g, '_')] = d.gia[c] || 0; });
        return o;
    });
    W.inBaoCao({
        ten: 'BangGia_' + T.kd(hangCua(b)).replace(/\W+/g, '_'),
        tieu: 'BẢNG GIÁ ' + String(hangCua(b)).toUpperCase(),
        phu: b.ten + ' — phiên bản ' + (b.phienBan || 1) + ' · ' + T.nhanKyBangGia(b) +
             ' · hiệu lực từ ' + T.date(b.tuNgay) + (b.denNgay ? ' đến ' + T.date(b.denNgay) : ''),
        cols: cols, rows: rows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'GIÁM ĐỐC'
    });
}
W.inPhienBanBangGia = inPhienBan;

})(window);

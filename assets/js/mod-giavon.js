/* ==========================================================================
   TVERP — GIÁ VỐN · GIÁ NỘI BỘ · GIÁ BÁN
   Lô nhập khẩu (phân bổ chi phí → giá vốn bình quân di động)
   Engine tính giá nội bộ (lưu CÔNG THỨC, không lưu giá cố định)
   Bảng giá bán không giới hạn số lượng
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;

function nvId() { return (Q.nhanVienCuaToi() || {}).id || ''; }
function nvTen() { return (Q.nhanVienCuaToi() || {}).hoTen || ''; }

/* ==========================================================================
   1. LÔ NHẬP KHẨU
   ========================================================================== */
/* Trạng thái lô nhập do Business Engine công bố — màn hình chỉ đọc lại. */
var TT_LO = T.TT_LO;

S['lo-nhap'] = function (host) {
    var mod = 'loNhap';
    var qThem = Q.co(mod, 'them'), qSua = Q.co(mod, 'sua'), qXoa = Q.co(mod, 'xoa'),
        qDuyet = Q.co(mod, 'duyet'), qIn = Q.co(mod, 'in');
    var g;

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Lô nhập khẩu</h2>' +
        '<div class="sub">Mỗi lần nhập là một lô độc lập — giá vốn riêng theo tỷ giá và chi phí thực tế của lô đó. ' +
        'Không ghi đè lịch sử.</div></div></div>' +
        '<div class="note b mb12"><i class="bi bi-diagram-2"></i><div>' +
        '<b>Quy trình:</b> Đơn mua → <b>Lô nhập</b> (khai hàng hóa + giá mua) → khai <b>Chi phí</b> → ' +
        '<b>Phân bổ chi phí</b> → <b>Tính giá vốn</b> → bấm <b>Nhập kho</b> để hệ thống ' +
        '<b>sinh Phiếu nhập kho</b> → tồn kho và <b>giá vốn bình quân gia quyền di động</b> cập nhật. ' +
        'Bản thân lô nhập <b>không</b> làm thay đổi tồn kho. ' +
        'VAT hàng nhập khẩu được khấu trừ nên <b>không</b> cộng vào giá vốn.<br>' +
        'Sau khi đã nhập kho vẫn <b>bổ sung chi phí</b> được: chi phí bổ sung chỉ phân bổ vào ' +
        '<b>phần tồn kho còn lại</b>, không sửa các chứng từ đã hoàn thành.</div></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Mua hàng', 'Lô nhập khẩu']);

    function rows() { return DB.all('loNhap'); }

    var tb = '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Lập lô nhập</button>' +
        '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
        '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-pb disabled><i class="bi bi-calculator"></i> Phân bổ chi phí</button>' +
        '<button class="btn ok" data-nhap2 disabled><i class="bi bi-box-arrow-in-down"></i> Nhập kho</button>' +
        '<button class="btn" data-bosung disabled><i class="bi bi-plus-circle"></i> Bổ sung chi phí</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-mau><i class="bi bi-file-earmark-arrow-down"></i> Tải tệp mẫu</button>' +
        '<button class="btn" data-nhapxl><i class="bi bi-upload"></i> Nhập Excel</button>' +
        '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
        '<button class="btn" data-lam><i class="bi bi-arrow-clockwise"></i> Làm mới</button>';

    g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: 20, height: 'calc(100vh - 390px)', toolbar: tb,
        sortK: 'ngay', sortD: -1, chon: true, search: ['so', 'nhaCungCap', 'soHoaDon', 'ghiChu'],
        emptyTitle: 'Chưa có lô nhập nào',
        cols: [
            { k: 'so', t: 'Số lô', w: 132, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày nhập', w: 104, fmt: 'date' },
            { k: 'loai', t: 'Loại', w: 122, r: function (v) {
                return '<span class="pill ' + (v === 'Tồn đầu kỳ' ? 'b' : 'c') + '">' + T.esc(v) + '</span>'; } },
            { k: 'nhaCungCap', t: 'Nhà cung cấp', w: 150 },
            { k: 'soHoaDon', t: 'Số hóa đơn thương mại', w: 140, cls: 'mono' },
            { k: '_sl', t: 'Số mã', w: 76, cls: 'num', sortVal: function (r) { return (r.lines || []).length; },
              r: function (v, r) { return (r.lines || []).length; } },
            { k: 'tongTienHang', t: 'Tiền hàng', w: 142, cls: 'num', fmt: 'money', total: true },
            { k: 'tongChiPhi', t: 'Chi phí vào giá vốn', w: 158, cls: 'num', total: true,
              r: function (v) { return v ? '<span class="pos">' + T.money(v) + '</span>' : '<span class="muted">0</span>'; } },
            { k: 'tongGiaVon', t: 'Tổng giá vốn lô', w: 158, cls: 'num', total: true,
              r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: 'phieuNhapSo', t: 'Phiếu nhập kho', w: 138, cls: 'mono',
              r: function (v) { return v ? '<b>' + T.esc(v) + '</b>' : '<span class="muted">chưa nhập kho</span>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 158, r: function (v) { return T.pill(v); } }
        ],
        filters: [
            { k: 'trangThai', t: 'Trạng thái', w: 180, opts: TT_LO },
            { k: 'loai', t: 'Loại lô', w: 160, opts: ['Nhập khẩu', 'Mua trong nước', 'Tồn đầu kỳ'] }
        ],
        actions: function (r) {
            return UI.btn('xem', 'bi-eye', 'Xem lô nhập') +
                (qSua && r.trangThai !== 'Đã nhập kho' && r.trangThai !== 'Tồn đầu kỳ' ? UI.btn('sua', 'bi-pencil', 'Sửa') : '');
        }, actionsW: 84,
        onAction: function (a, r) {
            if (a === 'sua') form(r); else form(r, true);
        },
        onSelect: UI.chonToolbar(host, ['sua', 'xoa', 'pb', 'nhap2', 'bosung']),
        onOpen: function (r) { form(r, true); }
    });
    UI.apQuyen(host, mod);
    W.hangLoat(host, g, {
        mod: mod, coll: 'loNhap', dt: 'Lô nhập', file: 'DanhSach_LoNhapKhau', rows: rows,
        excel: xlCols(), email: false, inCT: false,
        suaTruong: [{ k: 'ngay', t: 'Ngày nhập', type: 'date' },
                    { k: 'cachPhanBo', t: 'Cách phân bổ chi phí', type: 'select',
                      opts: T.CACH_PHAN_BO.map(function (x) { return { v: x.k, t: x.t }; }) },
                    { k: 'ghiChu', t: 'Ghi chú', type: 'text' }]
    });

    function xlCols() {
        return [{ t: 'Số lô', k: 'so', w: 16 }, { t: 'Ngày', k: 'ngay', w: 12 },
                { t: 'Loại', k: 'loai', w: 14 }, { t: 'Nhà cung cấp', k: 'nhaCungCap', w: 22 },
                { t: 'Số hóa đơn thương mại', k: 'soHoaDon', w: 18 }, { t: 'Ngoại tệ', k: 'ngoaiTe', w: 10 },
                { t: 'Tỷ giá', k: 'tyGia', w: 12 }, { t: 'Tiền hàng', k: 'tongTienHang', w: 18 },
                { t: 'Chi phí vào giá vốn', k: 'tongChiPhi', w: 18 }, { t: 'VAT nhập khẩu', k: 'tongVatNK', w: 16 },
                { t: 'Tổng giá vốn lô', k: 'tongGiaVon', w: 18 }, { t: 'Trạng thái', k: 'trangThai', w: 18 }];
    }

    var qs = function (x) { return host.querySelector(x); };
    if (qs('[data-them]')) qs('[data-them]').onclick = function () { form(null); };
    /* Engine là nơi duy nhất biết một lô đã vào sổ hay chưa. */
    function daNhapKho(r) { return T.loDaVaoSo(r); }
    if (qs('[data-sua]')) qs('[data-sua]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (daNhapKho(r)) return UI.khongThe('Sửa lô nhập',
            'Lô ' + r.so + ' đã nhập kho — tồn kho và giá vốn bình quân đã ghi nhận theo lô này.',
            'Lập phiếu điều chỉnh tồn kho nếu cần chỉnh số liệu, hoặc hủy phiếu nhập kho của lô trước.');
        form(r);
    };
    if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () {
        var r = g.selected(); if (!r) return;
        UI.xoaChuan({ coll: 'loNhap', rec: r, mod: mod, ten: 'Lô nhập ' + r.so,
            sauKhi: function () { g.selId = null; g.reload(rows()); W.route(); } });
    };
    qs('[data-lam]').onclick = function () { g.q = ''; g.f = {}; g.reload(rows()); UI.toast('info', 'Đã làm mới'); };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel('DanhSach_LoNhapKhau', 'Lô nhập khẩu', xlCols(), g.allRows);
    };
    if (qs('[data-pb]')) qs('[data-pb]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (daNhapKho(r)) return UI.khongThe('Phân bổ chi phí',
            'Lô ' + r.so + ' đã nhập kho nên giá vốn đã chốt.',
            'Dùng “Bổ sung chi phí” để phân bổ thêm chi phí vào phần tồn kho còn lại.');
        phanBo(r);
    };
    if (qs('[data-nhap2]')) qs('[data-nhap2]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (daNhapKho(r)) return UI.khongThe('Nhập kho',
            'Lô ' + r.so + ' đã nhập kho rồi.',
            'Mỗi lô chỉ nhập kho một lần; xem phiếu nhập kho đã sinh tại Kho → Phiếu nhập kho.');
        if (!r.daPhanBo) return UI.khongThe('Nhập kho',
            'Lô ' + r.so + ' chưa phân bổ chi phí nên chưa có giá vốn.',
            'Bấm “Phân bổ chi phí” để tính giá vốn của lô trước khi nhập kho.');
        nhapKho(r);
    };
    if (qs('[data-mau]')) qs('[data-mau]').onclick = function () {
        W.tepMauNhap({ ten: 'Lô nhập hàng', file: 'LoNhap', cols: cotNhapLo(), mau: dongMauLo() });
    };
    if (qs('[data-nhapxl]')) qs('[data-nhapxl]').onclick = function () { nhapLoExcel(g); };
    if (qs('[data-bosung]')) qs('[data-bosung]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (!daNhapKho(r)) return UI.khongThe('Bổ sung chi phí',
            'Lô ' + r.so + ' chưa nhập kho.',
            'Chi phí bổ sung chỉ phân bổ vào phần tồn kho còn lại nên chỉ dùng sau khi lô đã nhập kho. ' +
            'Trước đó hãy khai chi phí ngay trong lô rồi bấm “Phân bổ chi phí”.');
        boSung(r);
    };

    /* ------------------------------------------------ PHÂN BỔ CHI PHÍ */
    function phanBo(r) {
        if (!Q.co(mod, 'sua')) return UI.thieuQuyen(mod, 'sua');
        var tmp = T.clone(r);
        T.phanBoChiPhi(tmp);
        UI.modal({
            size: 'xl', title: 'Phân bổ chi phí mua hàng — lô ' + r.so,
            sub: 'Cách phân bổ: ' + (T.CACH_PHAN_BO.filter(function (x) { return x.k === (r.cachPhanBo || 'giaTri'); })[0] || {}).t,
            body: '<div class="grid4 mb12">' +
                kp('Tiền hàng', T.money(tmp.tongTienHang) + ' đ') +
                kp('Chi phí cộng vào giá vốn', T.money(tmp.tongChiPhi) + ' đ', 'c') +
                kp('VAT nhập khẩu (không vào giá vốn)', T.money(tmp.tongVatNK) + ' đ', 'y') +
                kp('Tổng giá vốn lô', T.money(tmp.tongGiaVon) + ' đ', 'g') + '</div>' +
                '<div class="fld mb12" style="max-width:400px"><label>Cách phân bổ chi phí</label>' +
                '<select id="cachPB">' + opt(T.CACH_PHAN_BO.map(function (x) { return { v: x.k, t: x.t }; }), r.cachPhanBo || 'giaTri') + '</select></div>' +
                '<div id="bangPB"></div>',
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Lưu kết quả phân bổ', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                    r.cachPhanBo = h.q('#cachPB').value;
                    T.phanBoChiPhi(r);
                    r.trangThai = 'Chờ nhập kho';
                    DB.log('Phân bổ chi phí', 'loNhap', r); DB.save();
                    h.close(); g.reload(rows()); W.route();
                    UI.toast('ok', 'Đã phân bổ chi phí — lô sẵn sàng nhập kho',
                        'Giá vốn dự kiến của từng mã hàng đã tính xong. ' +
                        'HÀNG CHƯA VÀO KHO — bấm “Nhập kho” để ghi tồn kho và giá vốn.', 8000);
                } }
            ],
            onOpen: function (h) {
                function ve() {
                    var t2 = T.clone(r); t2.cachPhanBo = h.q('#cachPB').value;
                    T.phanBoChiPhi(t2);
                    h.q('#bangPB').innerHTML =
                        '<div class="card"><div class="card-h"><i class="bi bi-calculator"></i> Giá vốn từng mã hàng sau phân bổ</div>' +
                        '<div class="tablewrap" style="max-height:380px"><table class="grid"><thead><tr>' +
                        '<th style="width:44px">TT</th><th style="width:150px">Mã hàng</th><th>Tên hàng hóa</th>' +
                        '<th class="num" style="width:88px">SL</th><th class="num" style="width:126px">Đơn giá mua</th>' +
                        '<th class="num" style="width:136px">Tiền hàng</th><th class="num" style="width:140px">Chi phí phân bổ</th>' +
                        '<th class="num" style="width:140px">Giá vốn lô / đơn vị</th>' +
                        '<th class="num" style="width:130px">So với BQ hiện tại</th></tr></thead><tbody>' +
                        t2.lines.map(function (l, i) {
                            var bq = T.giaVonBQ(l);
                            var ch = bq ? (l.giaVonLo - bq) / bq * 100 : 0;
                            return '<tr><td class="ctr muted">' + (i + 1) + '</td><td class="mono">' + T.esc(l.maHang) + '</td>' +
                                '<td><span class="ellip">' + T.esc(l.tenHang) + '</span></td>' +
                                '<td class="num">' + T.num(l.soLuong) + '</td>' +
                                '<td class="num">' + T.money(l.donGia) + '</td>' +
                                '<td class="num">' + T.money(l.tienHang) + '</td>' +
                                '<td class="num pos">' + T.money(l.chiPhiPhanBo) + '</td>' +
                                '<td class="num b">' + T.money(l.giaVonLo) + '</td>' +
                                '<td class="num ' + (ch > 0 ? 'neg' : 'pos') + '">' +
                                (bq ? (ch > 0 ? '+' : '') + T.num(ch, 1) + '%' : '—') + '</td></tr>';
                        }).join('') + '</tbody><tfoot><tr><td colspan="5">TỔNG CỘNG</td>' +
                        '<td class="num">' + T.money(t2.tongTienHang) + '</td>' +
                        '<td class="num">' + T.money(t2.tongChiPhi) + '</td>' +
                        '<td class="num">' + T.money(t2.tongGiaVon) + '</td><td></td></tr></tfoot></table></div></div>';
                }
                h.q('#cachPB').onchange = ve;
                ve();
            }
        });
    }

    /* ------------------------------------------------ NHẬP KHO */
    function nhapKho(r) {
        if (!Q.co(mod, 'duyet')) return UI.thieuQuyen(mod, 'duyet');
        if (!r.daPhanBo) return UI.toast('warn', 'Chưa phân bổ chi phí', 'Hãy bấm “Phân bổ chi phí” trước.');
        var xt = (r.lines || []).map(function (l) {
            var hh = T.hh(l) || {};
            var tonCu = Number(hh.ton) || 0, bqCu = T.giaVonBQ(l);
            var sl = Number(l.soLuong) || 0, giaLo = Number(l.giaVonLo) || 0;
            var tonMoi = tonCu + sl;
            var bqMoi = tonMoi > 0 ? Math.round((Math.max(0, tonCu) * bqCu + sl * giaLo) / (Math.max(0, tonCu) + sl)) : giaLo;
            return { ma: l.maHang, ten: l.tenHang, tonCu: tonCu, bqCu: bqCu, sl: sl,
                     giaLo: giaLo, tonMoi: tonMoi, bqMoi: bqMoi };
        });
        UI.modal({
            size: 'xl', title: 'Nhập kho lô ' + r.so,
            sub: 'Kho ' + ((T.khoChinh() || {}).ten || '') + ' — kho vật lý duy nhất của cả nhóm',
            body: '<div class="note y mb12"><i class="bi bi-exclamation-triangle"></i><div>' +
                'Hệ thống sẽ <b>sinh một Phiếu nhập kho</b> cho lô này. Chính phiếu nhập kho làm <b>tồn kho tăng</b> ' +
                'và <b>giá vốn bình quân gia quyền di động</b> được tính lại theo công thức:<br>' +
                '<code>BQ mới = (Tồn cũ × BQ cũ + SL nhập × Giá vốn lô) ÷ (Tồn cũ + SL nhập)</code><br>' +
                'Giá nội bộ của EMC / AA / Thái Phong sẽ <b>tự tính lại</b> theo công thức đã cấu hình. ' +
                '<b>Các chứng từ đã phát hành không thay đổi</b> vì giá vốn đã được đóng băng.</div></div>' +
                '<div class="tablewrap" style="max-height:400px"><table class="grid"><thead><tr>' +
                '<th style="width:150px">Mã hàng</th><th>Tên hàng hóa</th>' +
                '<th class="num" style="width:90px">Tồn cũ</th><th class="num" style="width:126px">BQ cũ</th>' +
                '<th class="num" style="width:90px">SL nhập</th><th class="num" style="width:126px">Giá vốn lô</th>' +
                '<th class="num" style="width:90px">Tồn mới</th><th class="num" style="width:136px">BQ mới</th>' +
                '<th class="num" style="width:110px">Chênh lệch</th></tr></thead><tbody>' +
                xt.map(function (x) {
                    var ch = x.bqCu ? (x.bqMoi - x.bqCu) / x.bqCu * 100 : 0;
                    return '<tr><td class="mono">' + T.esc(x.ma) + '</td><td><span class="ellip">' + T.esc(x.ten) + '</span></td>' +
                        '<td class="num">' + T.num(x.tonCu) + '</td><td class="num">' + T.money(x.bqCu) + '</td>' +
                        '<td class="num pos">+' + T.num(x.sl) + '</td><td class="num">' + T.money(x.giaLo) + '</td>' +
                        '<td class="num b">' + T.num(x.tonMoi) + '</td><td class="num b">' + T.money(x.bqMoi) + '</td>' +
                        '<td class="num ' + (ch > 0 ? 'neg' : 'pos') + '">' + (x.bqCu ? (ch > 0 ? '+' : '') + T.num(ch, 2) + '%' : '—') + '</td></tr>';
                }).join('') + '</tbody></table></div>',
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Sinh phiếu nhập kho', cls: 'ok-solid', icon: 'bi-box-arrow-in-down', click: function (h) {
                    var pn = T.nhapKho(r);
                    /* Engine từ chối thì đã tự báo lý do — màn hình chỉ đóng lại,
                       tuyệt đối không đọc tiếp trên kết quả rỗng. */
                    if (!pn) { h.close(); g.reload(rows()); return; }
                    h.close(); g.reload(rows()); W.route();
                    UI.toast('ok', 'Đã sinh phiếu nhập kho ' + pn.so,
                        xt.length + ' mã hàng — tồn kho và giá vốn bình quân đã cập nhật theo phiếu này.');
                } }
            ]
        });
    }

    /* ------------------------------------------------ BỔ SUNG CHI PHÍ SAU KHI NHẬP KHO */
    function boSung(r) {
        if (!Q.co(mod, 'sua')) return UI.thieuQuyen(mod, 'sua');
        if (r.trangThai !== 'Đã nhập kho' && r.trangThai !== 'Tồn đầu kỳ')
            return UI.toast('warn', 'Chưa thực hiện được',
                'Lô ' + r.so + ' chưa nhập kho. Hãy phân bổ chi phí và nhập kho trước, ' +
                'sau đó mới bổ sung được chi phí phát sinh thêm.');
        UI.modal({
            size: 'lg', title: 'Bổ sung chi phí cho lô ' + r.so,
            sub: 'Chi phí phát sinh sau khi hàng đã nhập kho',
            body: '<div class="note y mb12"><i class="bi bi-exclamation-triangle"></i><div>' +
                '<b>Nguyên tắc kế toán:</b> chứng từ đã hoàn thành <b>không sửa lại</b>. ' +
                'Chi phí bổ sung chỉ được phân bổ vào <b>phần tồn kho còn lại</b> của các mã hàng thuộc lô này ' +
                '— các mã đã bán hết sẽ bị bỏ qua, báo giá / đơn bán / phiếu xuất đã phát hành giữ nguyên giá vốn.</div></div>' +
                '<div class="grid2">' +
                '<div class="fld req"><label>Khoản mục chi phí</label><select data-f="loai">' +
                    opt(T.LOAI_CHI_PHI.filter(function (c) { return T.chiPhiVaoGiaVon(c.k); })
                        .map(function (c) { return { v: c.k, t: c.t }; }), 'khac') + '</select></div>' +
                '<div class="fld req"><label>Số tiền (đ)</label><input class="tien" data-f="soTien" value="0"></div>' +
                '<div class="fld span2"><label>Diễn giải</label>' +
                    '<input data-f="ghiChu" placeholder="VD: Phí lưu kho bãi phát sinh thêm theo hóa đơn ngày…"></div>' +
                '</div><div id="bsXem" class="mt12"></div>',
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Ghi nhận và tính lại giá vốn', cls: 'primary', icon: 'bi-calculator', click: function (h) {
                    var v = UI.read(h.el);
                    var st = T.so(v.soTien);
                    if (!(st > 0)) return UI.toast('err', 'Chưa nhập số tiền', 'Số tiền chi phí bổ sung phải lớn hơn 0.');
                    var ten = (T.LOAI_CHI_PHI.filter(function (c) { return c.k === v.loai; })[0] || {}).t || 'Chi phí khác';
                    var kq = T.boSungChiPhi(r, { loai: v.loai, ten: ten + (v.ghiChu ? ' — ' + v.ghiChu : ''), soTien: st });
                    h.close(); g.reload(rows()); W.route();
                    var boQua = kq.filter(function (x) { return x.boQua; }).length;
                    UI.toast('ok', 'Đã bổ sung chi phí ' + T.money(st) + ' đ',
                        'Đã tính lại giá vốn cho ' + (kq.length - boQua) + ' mã còn tồn' +
                        (boQua ? ' — ' + boQua + ' mã đã bán hết nên không hồi tố.' : '.'));
                } }
            ],
            onOpen: function (h) {
                UI.numInput(h.el);
                function ve() {
                    var st = T.so(h.q('[data-f="soTien"]').value);
                    var cach = r.cachPhanBo || 'giaTri';
                    var lines = r.lines || [];
                    var tongTH = T.sum(lines, function (l) { return Number(l.tienHang) || 0; });
                    var tongSL = T.sum(lines, function (l) { return Number(l.soLuong) || 0; });
                    var conLai = st;
                    h.q('#bsXem').innerHTML =
                        '<div class="card"><div class="card-h"><i class="bi bi-calculator"></i> Dự kiến ảnh hưởng tới giá vốn</div>' +
                        '<div class="tablewrap" style="max-height:300px"><table class="grid"><thead><tr>' +
                        '<th style="width:140px">Mã hàng</th><th>Tên hàng hóa</th>' +
                        '<th class="num" style="width:90px">Tồn còn lại</th>' +
                        '<th class="num" style="width:126px">Chi phí phân bổ</th>' +
                        '<th class="num" style="width:126px">Giá vốn hiện tại</th>' +
                        '<th class="num" style="width:126px">Giá vốn sau</th></tr></thead><tbody>' +
                        lines.map(function (l, i) {
                            var ty = cach === 'soLuong' ? (tongSL ? (Number(l.soLuong) || 0) / tongSL : 0)
                                                        : (tongTH ? (Number(l.tienHang) || 0) / tongTH : 0);
                            var pb = (i === lines.length - 1) ? conLai : Math.round(st * ty);
                            conLai -= pb;
                            var hh = T.hh(l) || {};
                            var ton = Number(hh.ton) || 0;
                            var bq = T.giaVonBQ(l);
                            var moi = ton > 0 ? Math.round(bq + pb / ton) : bq;
                            return '<tr><td class="mono">' + T.esc(l.maHang) + '</td>' +
                                '<td><span class="ellip">' + T.esc(l.tenHang) + '</span></td>' +
                                '<td class="num' + (ton > 0 ? '' : ' muted') + '">' + T.num(ton) + '</td>' +
                                '<td class="num pos">' + T.money(pb) + '</td>' +
                                '<td class="num">' + T.money(bq) + '</td>' +
                                (ton > 0 ? '<td class="num b">' + T.money(moi) + '</td>'
                                         : '<td class="num"><span class="pill y">đã bán hết — bỏ qua</span></td>') +
                                '</tr>';
                        }).join('') + '</tbody></table></div></div>';
                }
                h.q('[data-f="soTien"]').addEventListener('input', ve);
                h.q('[data-f="loai"]').onchange = ve;
                ve();
            }
        });
    }

    /* ------------------------------------------------ IN BẢNG TÍNH GIÁ VỐN */
    function inLo(r) {
        var cty = DB.get('donVi', 'TANVIEN') || DB.cty();
        var DDS = W.DDS, CH = T.cauHinhIn(cty);
        W.__C = CH;
        var RG = W.rongVungIn ? W.rongVungIn(true) : 267;
        var h = '<div class="print-sheet landscape"' + W.kieuMau(CH) + '>' + DDS.dauTrang(cty, CH) +
            DDS.tieuDe({ eyebrow: 'Hồ sơ nhập khẩu', tieu: 'BẢNG TÍNH GIÁ VỐN LÔ NHẬP KHẨU',
                so: r.so, ngay: T.date(r.ngay),
                ref: [r.soHoaDon ? 'Hóa đơn thương mại ' + r.soHoaDon : '',
                      (r.ngoaiTe && r.ngoaiTe !== 'VND')
                          ? 'Tỷ giá 1 ' + r.ngoaiTe + ' = ' + T.num(r.tyGia * 1000, 0) + ' đ' : ''] }) +
            DDS.bang({ rong: RG, rows: r.lines || [], cot: [
                { k: 'stt', t: 'STT', v: function (l, i) { return String(i + 1); } },
                { k: 'ma', t: 'Mã hàng', v: function (l) { return l.maHang || ''; } },
                { k: 'ten', t: 'Tên hàng hóa', v: function (l) { return l.tenHang || ''; } },
                { k: 'dvt', t: 'ĐVT', v: function (l) { return l.dvt || ''; } },
                { k: 'sl', t: 'SL', v: function (l) { return T.num(l.soLuong); } },
                { k: 'gia', t: 'Đơn giá mua', v: function (l) { return T.money(l.donGia); } },
                { k: 'tien', t: 'Tiền hàng', v: function (l) { return T.money(l.tienHang); } },
                { k: 'tien', t: 'Chi phí phân bổ', v: function (l) { return T.money(l.chiPhiPhanBo); } },
                { k: 'tien', t: 'Giá vốn / đơn vị', v: function (l) { return T.money(l.giaVonLo); } }
            ] }) +
            DDS.tong([
                { k: 'Tổng tiền hàng', v: T.money(r.tongTienHang) },
                { k: 'Tổng chi phí nhập khẩu', v: T.money(r.tongChiPhi) },
                { k: 'TỔNG CỘNG GIÁ VỐN LÔ', v: T.money(r.tongGiaVon) + ' đồng', chinh: true }
            ]) +
            DDS.bangChu(r.tongGiaVon, 'Bằng chữ:') +
            '<div class="pr-muc">Chi tiết chi phí nhập khẩu</div>' +
            DDS.bang({ rong: Math.round(RG * 0.55), rows: r.chiPhi || [], cot: [
                { k: 'stt', t: 'STT', v: function (c, i) { return String(i + 1); } },
                { k: 'ten', t: 'Khoản mục chi phí', v: function (c) { return c.ten || ''; } },
                { k: 'tien', t: 'Số tiền', v: function (c) { return T.money(c.soTien); } },
                { k: 'ma', t: 'Vào giá vốn',
                  v: function (c) { return T.chiPhiVaoGiaVon(c.loai) ? 'Có' : 'Không'; } }
            ] }) +
            DDS.ky([
                { r: 'NGƯỜI LẬP', d: '(Ký, ghi rõ họ tên)' },
                { r: 'KẾ TOÁN TRƯỞNG', d: '(Ký, ghi rõ họ tên)' },
                { r: 'GIÁM ĐỐC', d: '(Ký, đóng dấu)',
                  dau: cty.conDau, ky: cty.chuKy }
            ]) +
            DDS.chanTrang(cty, CH, r.so || '') + '</div>';
        W.__C = null;
        UI.print(h, 'Bảng tính giá vốn lô ' + r.so);
    }

    /* ------------------------------------------------ FORM LÔ NHẬP */
    function form(rec, ro) {
        var moi = !rec || !rec.id;
        if (!ro) {
            if (moi && !qThem) return UI.thieuQuyen(mod, 'them');
            if (!moi && !qSua) ro = true;
            if (!moi && rec && (rec.trangThai === 'Đã nhập kho' || rec.trangThai === 'Tồn đầu kỳ')) {
                UI.toast('info', 'Lô đã nhập kho', 'Chỉ xem, không sửa được để không làm sai giá vốn.');
                ro = true;
            }
        }
        rec = rec ? T.clone(rec) : {
            so: '', ngay: T.today(), loai: 'Nhập khẩu',
            nhaCungCapId: (DB.all('nhaCungCap')[0] || {}).id || '', nhaCungCap: (DB.all('nhaCungCap')[0] || {}).ten || '',
            khoId: (T.khoChinh() || {}).id, soHoaDon: '', soHopDong: '', packingList: '', vanDon: '',
            ngoaiTe: 'CNY', tyGia: 25.5,
            nguoiLapId: nvId(), nguoiLap: nvTen(), cachPhanBo: 'giaTri',
            lines: [], chiPhi: [], trangThai: 'Chờ kiểm tra', ghiChu: ''
        };
        var lines = rec.lines || [], cp = rec.chiPhi || [], LE = null;

        UI.modal({
            size: 'full', dismiss: false,
            title: (ro ? 'Xem ' : moi ? 'Lập ' : 'Sửa ') + 'lô nhập' + (rec.so ? ' — ' + rec.so : ''),
            sub: 'Kho nhận: ' + ((T.khoChinh() || {}).ten || '') + ' (kho duy nhất của nhóm)',
            body:
                '<div class="grid4">' +
                '<div class="fld"><label>Số lô</label><input data-f="so" value="' + T.esc(rec.so) + '" placeholder="Tự sinh khi lưu"></div>' +
                '<div class="fld req"><label>Ngày nhập</label><input type="date" data-f="ngay" value="' + T.esc(rec.ngay) + '"></div>' +
                '<div class="fld"><label>Loại lô</label><select data-f="loai">' +
                    opt(['Nhập khẩu', 'Mua trong nước', 'Tồn đầu kỳ'], rec.loai) + '</select></div>' +
                '<div class="fld"><label>Trạng thái</label>' +
                '<input value="' + T.esc(rec.trangThai || 'Chờ kiểm tra') + '" readonly ' +
                'title="Trạng thái nghiệp vụ do hệ thống tự chuyển: ' + T.TT_LO.slice(0, 3).join(' → ') + '">' +
                '<input type="hidden" data-f="trangThai" value="' + T.esc(rec.trangThai || 'Chờ kiểm tra') + '">' +
                '<div class="small muted" style="margin-top:2px">Hệ thống tự chuyển khi phân bổ chi phí và khi nhập kho</div></div>' +
                W.oMD('nhaCungCap', { f: 'nhaCungCapId', fTen: 'nhaCungCap', gt: rec.nhaCungCapId,
                                      gtTen: rec.nhaCungCap, rong: true, req: true }) +
                '<div class="fld"><label>Invoice (số hóa đơn thương mại)</label><input data-f="soHoaDon" value="' + T.esc(rec.soHoaDon) + '"></div>' +
                '<div class="fld"><label>Số hợp đồng</label><input data-f="soHopDong" value="' + T.esc(rec.soHopDong || '') + '"></div>' +
                '<div class="fld"><label>Packing List</label><input data-f="packingList" value="' + T.esc(rec.packingList || '') + '"></div>' +
                '<div class="fld"><label>Vận đơn</label><input data-f="vanDon" value="' + T.esc(rec.vanDon || '') + '"></div>' +
                W.oNguoiLap(rec, 'loNhap') +
                '<div class="fld"><label>Ngoại tệ</label><select data-f="ngoaiTe">' +
                    opt(['VND', 'USD', 'CNY', 'EUR'], rec.ngoaiTe) + '</select></div>' +
                '<div class="fld"><label>Tỷ giá (nghìn đồng / 1 ngoại tệ)</label>' +
                    '<input class="num sl" data-f="tyGia" value="' + T.esc(rec.tyGia) + '"></div>' +
                '<div class="fld"><label>Cách phân bổ chi phí</label><select data-f="cachPhanBo">' +
                    opt(T.CACH_PHAN_BO.map(function (x) { return { v: x.k, t: x.t }; }), rec.cachPhanBo) + '</select></div>' +
                '<div class="fld"><label>Ghi chú</label><input data-f="ghiChu" value="' + T.esc(rec.ghiChu) + '"></div>' +
                '</div>' +
                '<div class="card mt12"><div class="card-h"><i class="bi bi-box-seam"></i> Hàng hóa nhập về</div>' +
                '<div class="card-b"><div id="dfLines"></div></div></div>' +
                '<div class="card mt12"><div class="card-h"><i class="bi bi-cash-stack"></i> Chi phí nhập khẩu' +
                '<span class="spacer"></span><span class="small muted">VAT hàng nhập khẩu được khấu trừ — không cộng vào giá vốn</span></div>' +
                '<div class="card-b"><div id="dfCP"></div></div></div>' +
                '<div id="dfTong" class="mt12"></div>',
            buttons: ro ? [
                { text: 'Đóng', click: function (h) { h.close(); } },
                { text: 'Xem trước khi in', cls: 'primary', icon: 'bi-printer', click: function () { inLo(rec); } }
            ] : [
                { text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } },
                { text: 'Lưu lô nhập', cls: 'primary', icon: 'bi-check-lg', click: function (h) { luu(h); } }
            ],
            onOpen: function (h) {
                if (W.bindMD) h._md = W.bindMD(h.el, { giaMua: true });
                W.bindNguoiLap(h, rec, 'loNhap', ro);
                LE = new W.LineEditor(h.q('#dfLines'), lines, {
                    readonly: ro, giaMua: true,
                    onChange: function () { veCP(h); }
                });
                veCP(h);
                if (ro) h.el.querySelectorAll('input,select,textarea').forEach(function (e) { e.disabled = true; });
            }
        });

        function veCP(h) {
            var ro2 = ro;
            h.q('#dfCP').innerHTML =
                (ro2 ? '' : '<div class="row mb8"><button type="button" class="btn sm primary" id="cpAdd">' +
                    '<i class="bi bi-plus-lg"></i> Thêm khoản chi phí</button>' +
                    '<button type="button" class="btn sm" id="cpDu"><i class="bi bi-list-check"></i> Thêm đủ 9 khoản chuẩn</button></div>') +
                '<div class="tablewrap" style="max-height:260px"><table class="lines-tb"><thead><tr>' +
                '<th style="width:36px" class="ctr">TT</th><th style="width:280px">Khoản mục</th><th>Diễn giải</th>' +
                '<th style="width:160px">Số tiền (đ)</th><th style="width:110px">Vào giá vốn</th>' +
                (ro2 ? '' : '<th style="width:36px"></th>') + '</tr></thead><tbody>' +
                (cp.length ? cp.map(function (c, i) {
                    return '<tr data-ci="' + i + '"><td class="ctr muted">' + (i + 1) + '</td>' +
                        '<td><select data-c="loai"' + (ro2 ? ' disabled' : '') + '>' +
                            opt(T.LOAI_CHI_PHI.filter(function (x) { return !x.tuTinh; })
                                .map(function (x) { return { v: x.k, t: x.t }; }), c.loai) + '</select></td>' +
                        '<td><input data-c="ten" value="' + T.esc(c.ten) + '"' + (ro2 ? ' disabled' : '') + '></td>' +
                        '<td><input class="num tien" data-c="soTien" value="' + T.esc(T.soVe(c.soTien)) + '"' + (ro2 ? ' disabled' : '') + '></td>' +
                        '<td class="ctr">' + (T.chiPhiVaoGiaVon(c.loai) ? '<span class="pill g">Có</span>' : '<span class="pill n">Không</span>') + '</td>' +
                        (ro2 ? '' : '<td class="ctr"><button type="button" class="line-del" data-cdel><i class="bi bi-x-lg"></i></button></td>') +
                        '</tr>';
                }).join('') : '<tr><td colspan="' + (ro2 ? 5 : 6) + '"><div class="empty" style="padding:20px">' +
                    '<i class="bi bi-cash-stack"></i><b>Chưa khai chi phí nào</b>Bấm “Thêm đủ 9 khoản chuẩn” để khai nhanh.</div></td></tr>') +
                '</tbody></table></div>';

            if (!ro2) {
                h.q('#cpAdd').onclick = function () {
                    cp.push({ loai: 'vanTaiQT', ten: 'Cước vận chuyển quốc tế', soTien: 0, ghiChu: '' });
                    veCP(h);
                };
                h.q('#cpDu').onclick = function () {
                    T.LOAI_CHI_PHI.forEach(function (x) {
                        if (x.tuTinh) return;
                        if (cp.filter(function (c) { return c.loai === x.k; }).length) return;
                        cp.push({ loai: x.k, ten: x.t, soTien: 0, ghiChu: '' });
                    });
                    veCP(h);
                    UI.toast('info', 'Đã thêm đủ khoản mục chi phí', 'Nhập số tiền cho từng khoản.');
                };
                h.el.querySelectorAll('[data-ci]').forEach(function (tr) {
                    var i = Number(tr.getAttribute('data-ci'));
                    tr.querySelectorAll('[data-c]').forEach(function (inp) {
                        var k = inp.getAttribute('data-c');
                        inp.onchange = function () {
                            cp[i][k] = k === 'soTien' ? Number(inp.value) || 0 : inp.value;
                            if (k === 'loai') {
                                var d = T.LOAI_CHI_PHI.filter(function (x) { return x.k === inp.value; })[0];
                                cp[i].ten = d ? d.t : '';
                            }
                            veCP(h);
                        };
                        inp.oninput = function () { if (k === 'soTien') { cp[i].soTien = Number(inp.value) || 0; tong(h); } };
                    });
                    var d = tr.querySelector('[data-cdel]');
                    if (d) d.onclick = function () { cp.splice(i, 1); veCP(h); };
                });
            }
            tong(h);
        }

        function tong(h) {
            var t = T.clone({ lines: lines, chiPhi: cp, cachPhanBo: h.q('[data-f="cachPhanBo"]') ? h.q('[data-f="cachPhanBo"]').value : 'giaTri' });
            T.phanBoChiPhi(t);
            h.q('#dfTong').innerHTML = '<div class="grid4">' +
                kp('Tiền hàng', T.money(t.tongTienHang) + ' đ') +
                kp('Chi phí cộng vào giá vốn', T.money(t.tongChiPhi) + ' đ', 'c') +
                kp('VAT nhập khẩu (khấu trừ)', T.money(t.tongVatNK) + ' đ', 'y') +
                kp('TỔNG GIÁ VỐN LÔ', T.money(t.tongGiaVon) + ' đ', 'g') + '</div>';
        }

        function luu(h) {
            if (!UI.validate(h.el, [{ k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' }])) return;
            if (!lines.length) return UI.toast('err', 'Chưa có dòng hàng', 'Lô nhập phải có ít nhất một mã hàng.');
            var v = UI.read(h.el);
            var ncc = DB.get('nhaCungCap', v.nhaCungCapId);
            var o = {
                so: v.so || DB.soMoi('NK'), ngay: v.ngay, loai: v.loai,
                nhaCungCapId: v.nhaCungCapId, nhaCungCap: ncc ? ncc.ten : '',
                khoId: (T.khoChinh() || {}).id, soHoaDon: v.soHoaDon,
                soHopDong: v.soHopDong || '', packingList: v.packingList || '', vanDon: v.vanDon || '',
                ngoaiTe: v.ngoaiTe, tyGia: Number(v.tyGia) || 1,
                nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId),
                cachPhanBo: v.cachPhanBo, lines: lines, chiPhi: cp,
                trangThai: v.trangThai, ghiChu: v.ghiChu,
                daPhanBo: false, ngayNhapKho: rec.ngayNhapKho || ''
            };
            T.phanBoChiPhi(o);
            if (o.trangThai === 'Chờ kiểm tra' && o.tongChiPhi > 0) o.trangThai = 'Chờ nhập kho';
            // Mã hàng chưa có trong Danh mục Hàng hóa được tự tạo ngay, dùng được toàn hệ thống
            W.dongBoHangHoa(lines, function () {
                if (moi) DB.insert('loNhap', o); else DB.update('loNhap', rec.id, o);
                h.close(); g.reload(rows()); W.route();
                UI.toast('ok', moi ? 'Đã lập lô nhập ' + o.so : 'Đã cập nhật lô ' + o.so,
                    'Tổng giá vốn lô: ' + T.money(o.tongGiaVon) + ' đ. Bấm “Nhập kho” để cộng tồn.');
            });
        }
    }
};

/* ==========================================================================
   NHẬP LÔ HÀNG TỪ EXCEL
   Mỗi dòng Excel là MỘT DÒNG HÀNG. Các dòng cùng "Số lô" gộp thành một lô.
   Sau khi nhập, hệ thống CHỈ sinh Lô nhập hàng — KHÔNG tự động nhập kho.
   Quy trình tiếp tục: khai chi phí → Phân bổ chi phí → Nhập kho.
   ========================================================================== */
var LOAI_TIEN = ['VND', 'USD', 'CNY', 'EUR'];

function cotNhapLo() {
    return [
        { t: 'Số lô', k: 'so', w: 18, kieu: 'Chữ',
          mo: 'Các dòng cùng số lô gộp thành một lô. Để trống thì hệ thống tự sinh số, ' +
              'các dòng trống số cùng ngày và cùng nhà cung cấp được gộp làm một lô' },
        { t: 'Ngày nhập', k: 'ngay', w: 12, req: true, kieu: 'Ngày' },
        { t: 'Mã nhà cung cấp', k: 'nccMa', w: 18, req: true, kieu: 'Chữ',
          mo: 'Mã đã khai trong Danh mục Nhà cung cấp' },
        { t: 'Số hợp đồng', k: 'soHopDong', w: 20, kieu: 'Chữ' },
        { t: 'Invoice', k: 'soHoaDon', w: 18, kieu: 'Chữ', mo: 'Số hóa đơn thương mại' },
        { t: 'Packing List', k: 'packingList', w: 18, kieu: 'Chữ' },
        { t: 'Vận đơn', k: 'vanDon', w: 18, kieu: 'Chữ' },
        { t: 'Loại tiền', k: 'ngoaiTe', w: 12, kieu: 'Chữ', mo: LOAI_TIEN.join(' · ') + '. Để trống lấy VND' },
        { t: 'Tỷ giá', k: 'tyGia', w: 12, kieu: 'Số', mo: 'Để trống lấy 1' },
        { t: 'Ghi chú', k: 'ghiChu', w: 30, kieu: 'Chữ' },
        { t: 'Mã hàng', k: 'maHang', w: 20, req: true, kieu: 'Chữ', mo: 'Mã đã khai trong Danh mục Hàng hóa' },
        { t: 'Tên hàng', k: 'tenHang', w: 42, kieu: 'Chữ', mo: 'Để trống thì lấy theo Danh mục Hàng hóa' },
        { t: 'Đơn vị tính', k: 'dvt', w: 12, kieu: 'Chữ', mo: 'Để trống thì lấy theo Danh mục Hàng hóa' },
        { t: 'Số lượng', k: 'soLuong', w: 12, req: true, kieu: 'Số' },
        { t: 'Đơn giá', k: 'donGia', w: 16, req: true, kieu: 'Số', mo: 'Đơn giá mua quy ra đồng Việt Nam' },
        { t: 'Thành tiền', k: 'tienHang', w: 18, kieu: 'Số',
          mo: 'Không bắt buộc. Có ghi thì hệ thống đối chiếu với số lượng × đơn giá' }
    ];
}
function dongMauLo() {
    var r = DB.all('loNhap').filter(function (x) { return (x.lines || []).length; })[0];
    if (!r) return [];
    var ncc = DB.get('nhaCungCap', r.nhaCungCapId) || {};
    return (r.lines || []).slice(0, 3).map(function (l) {
        var sl = Number(l.soLuong) || 0, dg = Number(l.donGia) || 0;
        return {
            'Số lô': r.so, 'Ngày nhập': T.date(r.ngay), 'Mã nhà cung cấp': ncc.ma || '',
            'Số hợp đồng': r.soHopDong || '', 'Invoice': r.soHoaDon || '',
            'Packing List': r.packingList || '', 'Vận đơn': r.vanDon || '',
            'Loại tiền': r.ngoaiTe || 'VND', 'Tỷ giá': Number(r.tyGia) || 1, 'Ghi chú': r.ghiChu || '',
            'Mã hàng': l.maHang, 'Tên hàng': l.tenHang || '', 'Đơn vị tính': l.dvt || '',
            'Số lượng': sl, 'Đơn giá': dg, 'Thành tiền': Math.round(sl * dg)
        };
    });
}

function nhapLoExcel(g) {
    if (!W.Q.co('loNhap', 'them')) return UI.thieuQuyen('loNhap', 'them');
    var gom = {};
    W.nhapDuLieu({
        ten: 'Lô nhập hàng', file: 'LoNhap', cols: cotNhapLo(), mau: dongMauLo(),
        nhomNhan: 'lô nhập hàng', nhomCot: 'Số lô',
        nhomTheo: function (o) { return o.khoaGom; },
        /* Danh mục hàng hóa là dữ liệu gốc — lô nhập cũng phải hỏi trước khi tạo. */
        truocGhi: W.chanTaoHangHoa({
            nhanTao: 'Tạo mới hàng hóa và nhập lô',
            nhanBoQua: 'Bỏ qua dòng có hàng chưa có, vẫn nhập lô',
            nhanHuy: 'Hủy nhập',
            moTaBoQua: 'không ghi gì cả, không lô nhập nào được tạo'
        }),
        kiemTra: function (r) {
            var kt = W.KT(r), o = {};
            o.so = kt.chu('Số lô');
            o.ngay = kt.ngay('Ngày nhập', { req: true });
            var ncc = kt.tra('Mã nhà cung cấp', 'nhaCungCap', 'Nhà cung cấp', { req: true });
            o.nhaCungCapId = ncc ? ncc.id : ''; o.nhaCungCap = ncc ? ncc.ten : '';
            o.nccMa = kt.o('Mã nhà cung cấp');
            o.soHopDong = kt.chu('Số hợp đồng');
            o.soHoaDon = kt.chu('Invoice');
            o.packingList = kt.chu('Packing List');
            o.vanDon = kt.chu('Vận đơn');
            o.ngoaiTe = kt.o('Loại tiền') ? kt.chon('Loại tiền', LOAI_TIEN, { mac: 'VND' }) : 'VND';
            o.tyGia = kt.o('Tỷ giá') === '' ? 1 : kt.so('Tỷ giá', { min: 0.0001, mo: 'tỷ giá phải lớn hơn 0' });
            if (!o.tyGia) o.tyGia = 1;
            o.ghiChu = kt.chu('Ghi chú');

            // Mã hàng chưa có trong danh mục thì hệ thống tự tạo mới khi xác nhận nhập
            var kq = W.hangHoaChoDong(kt, { ma: 'Mã hàng', ten: 'Tên hàng', dvt: 'Đơn vị tính' });
            var hh = kq ? (kq.hh || kq.moi) : null;
            o.hhKq = kq;
            o.maHang = kt.o('Mã hàng');
            o.tenHang = kt.chu('Tên hàng') || (hh ? hh.ten : '');
            o.dvt = kt.o('Đơn vị tính') ? kt.dvt('Đơn vị tính', '') : (hh ? hh.dvt : '');
            o.soLuong = kt.so('Số lượng', { req: true, min: 0.0001, mo: 'số lượng phải lớn hơn 0' });
            o.donGia = kt.tien('Đơn giá', { req: true });

            var tt = kt.o('Thành tiền');
            if (tt !== '') {
                var khai = kt.tien('Thành tiền');
                var tinh = Math.round(o.soLuong * o.donGia);
                if (Math.abs(khai - tinh) > 1)
                    kt.them('Thành tiền',
                        'thành tiền ' + T.money(khai) + ' lệch với số lượng × đơn giá = ' + T.money(tinh),
                        'Sửa lại Số lượng, Đơn giá hoặc Thành tiền cho khớp, hoặc để trống cột ' +
                        'Thành tiền để hệ thống tự tính.');
            }
            o.khoaGom = o.so ? T.kd(o.so) : ('#' + o.ngay + '|' + T.kd(o.nccMa || ''));
            return { o: kt.co() ? null : o, loi: kt.loi, canhBao: kt.canhBao };
        },
        ghi: function (o) {
            var hh = W.chotHangHoa(o.hhKq);        // tạo mã hàng mới nếu chưa có
            if (hh && !o.dvt) o.dvt = hh.dvt || '';
            if (!gom[o.khoaGom]) gom[o.khoaGom] = { head: o, lines: [] };
            /* Liên kết bằng CHÍNH bản ghi vừa nhận diện hoặc vừa tạo — xem chú
               thích cùng nội dung ở phân hệ chứng từ. */
            var dong = {
                hangHoaId: (hh && hh.id) || T.idDong(o),
                maHang: (hh && hh.ma) || o.maHang, tenHang: o.tenHang, dvt: o.dvt,
                soLuong: o.soLuong, donGia: o.donGia,
                tienHang: Math.round(o.soLuong * o.donGia),
                chiPhiPhanBo: 0, giaVonLo: o.donGia, ghiChu: ''
            };
            if (hh) T.ganIdDong(dong, hh);
            gom[o.khoaGom].lines.push(dong);
        },
        xong: function () {
            var n = 0;
            Object.keys(gom).forEach(function (khoa) {
                var x = gom[khoa], hd = x.head;
                var o = {
                    so: hd.so || DB.soMoi('NK'), ngay: hd.ngay, loai: 'Nhập khẩu',
                    nhaCungCapId: hd.nhaCungCapId, nhaCungCap: hd.nhaCungCap,
                    khoId: (T.khoChinh() || {}).id,
                    soHopDong: hd.soHopDong, soHoaDon: hd.soHoaDon,
                    packingList: hd.packingList, vanDon: hd.vanDon,
                    ngoaiTe: hd.ngoaiTe, tyGia: hd.tyGia,
                    nguoiLapId: nvId(), nguoiLap: nvTen(), cachPhanBo: 'giaTri',
                    lines: x.lines, chiPhi: [],
                    // Nhập từ Excel CHỈ sinh lô nhập — chưa nhập kho, chưa cộng tồn
                    trangThai: 'Chờ kiểm tra', daPhanBo: false, ngayNhapKho: '',
                    ghiChu: hd.ghiChu
                };
                T.phanBoChiPhi(o);
                DB.insert('loNhap', o); n++;
            });
            gom = {};
            g.reload(DB.all('loNhap')); W.route();
            if (n) UI.toast('ok', 'Đã tạo ' + n + ' lô nhập hàng',
                'Lô đang ở trạng thái “Chờ kiểm tra” — hệ thống KHÔNG tự động nhập kho. ' +
                'Tiếp tục: khai chi phí → Phân bổ chi phí → Nhập kho.', 7000);
        }
    });
}

function kp(l, v, c) {
    return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div><div class="vl" style="font-size:17px">' + v + '</div></div>';
}

/* ==========================================================================
   2. ĐỐI CHIẾU GIÁ NỘI BỘ — ĐỌC TỪ CHÍNH SÁCH CỦA PHIÊN BẢN BẢNG GIÁ
   --------------------------------------------------------------------------
   PRICE POLICY ENGINE V2.0: chính sách giá nội bộ KHÔNG còn lưu ở cấp hệ thống.
   Mỗi phiên bản bảng giá là một gói dữ liệu hoàn chỉnh, chứa cả các loại giá lẫn
   chính sách giá nội bộ của từng đơn vị phát hành. Màn hình này chỉ ĐỐI CHIẾU —
   muốn sửa mức chiết khấu thì mở hồ sơ của đúng phiên bản bảng giá.
   ========================================================================== */
S['gia-noi-bo'] = function (host) {
    var mod = 'giaNoiBo';
    var qSua = Q.co(mod, 'sua') && Q.co('bangGiaBan', 'sua');
    var dvs = DB.all('donVi');
    var bgId = '';
    var cotGia = '';

    function dsPhienBan() {
        return DB.all('bangGiaBan').slice().sort(function (a, b) {
            if ((a.trangThai === 'Đang áp dụng') !== (b.trangThai === 'Đang áp dụng'))
                return a.trangThai === 'Đang áp dụng' ? -1 : 1;
            if ((a.tuNgay || '') !== (b.tuNgay || '')) return (a.tuNgay || '') < (b.tuNgay || '') ? 1 : -1;
            return (Number(b.phienBan) || 1) - (Number(a.phienBan) || 1);
        });
    }

    function ve() {
        var pbs = dsPhienBan();
        if (!bgId || !DB.get('bangGiaBan', bgId)) bgId = (pbs[0] || {}).id || '';
        var bg = DB.get('bangGiaBan', bgId) || null;
        cotGia = T.cotGiaNoiBo(bg, cotGia);
        var nguon = DB.get('donVi', T.cauHinhDaCongTy().ctyNguonId) || {};

        host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Đối chiếu giá nội bộ theo phiên bản bảng giá</h2>' +
            '<div class="sub">Hệ thống <b>không lưu giá vốn nội bộ cố định</b>. Chiết khấu nội bộ khai ' +
            'trong <b>thông tin của chính phiên bản bảng giá</b>; Business Engine tự tính giá vốn nội bộ ' +
            'trên đúng loại giá đang chọn — người dùng không phải nhập.</div></div></div>' +

            '<div class="note b mb12"><i class="bi bi-diagram-3"></i><div><b>Luồng tính giá:</b> ' +
            'Nhập hàng → Phiếu nhập kho → Kho chung → Giá vốn gốc → <b>Phiên bản bảng giá</b> ' +
            '(Giá PPP · Đại lý · Bán lẻ · …) → <b>Chiết khấu nội bộ của chính phiên bản đó</b> → ' +
            'Đơn vị phát hành → Business Engine → giá vốn ghi trên chứng từ → lợi nhuận từng pháp nhân. ' +
            T.esc(nguon.tat || 'Đơn vị nguồn') + ' là đơn vị duy nhất xây dựng bảng giá và chiết khấu nội bộ.' +
            '</div></div>' +

            '<div class="row mb12" style="gap:10px;flex-wrap:wrap">' +
            '<div class="fld" style="min-width:420px;margin:0"><label>Phiên bản bảng giá đối chiếu</label>' +
            '<select id="nbPB">' + (pbs.length ? pbs.map(function (b) {
                return '<option value="' + T.esc(b.id) + '"' + (b.id === bgId ? ' selected' : '') + '>' +
                    T.esc(b.ten) + ' — phiên bản ' + (b.phienBan || 1) +
                    ' · hiệu lực từ ' + T.date(b.tuNgay) +
                    (b.trangThai === 'Đang áp dụng' ? '' : ' · ' + T.esc(b.trangThai)) + '</option>';
            }).join('') : '<option value="">— Chưa có bảng giá nào —</option>') + '</select></div>' +
            '<div class="fld" style="min-width:220px;margin:0"><label>Loại giá đối chiếu</label>' +
            '<select id="nbCot">' + ((bg && bg.cotGia || []).length
                ? (bg.cotGia || []).map(function (c) {
                    return '<option value="' + T.esc(c) + '"' + (c === cotGia ? ' selected' : '') + '>' +
                        T.esc(c) + '</option>'; }).join('')
                : '<option value="">— Phiên bản chưa có loại giá —</option>') + '</select></div>' +
            '<span class="spacer"></span>' +
            (bg ? '<button class="btn primary" id="btnMoPB"' + (qSua ? '' : ' disabled') + '>' +
                  '<i class="bi bi-sliders"></i> Sửa chiết khấu nội bộ của phiên bản</button>' : '') +
            '</div>' +

            '<div class="grid4 mb12" id="ctyBox"></div>' +

            '<div class="card"><div class="card-h"><i class="bi bi-table"></i> Bảng đối chiếu giá nội bộ theo từng đơn vị' +
            '<span class="spacer"></span>' +
            '<button class="btn sm primary" id="btnBcao" title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel"><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>' +
            '<button class="btn sm" id="btnXuat" title="Xuất nguyên dữ liệu bảng đối chiếu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
            '</div><div id="ghDoi"></div></div>' +
            (function () {
                var lt = T.luuTruGiaNoiBo();
                if (!lt.length) return '';
                return '<div class="card mt12"><div class="card-h"><i class="bi bi-archive"></i> ' +
                    'Cấu hình giá nội bộ đời cũ đã lưu trữ (' + lt.length + ')</div>' +
                    '<div class="note y" style="margin:10px"><i class="bi bi-info-circle"></i><div>' +
                    'Các cấu hình dưới đây <b>không diễn đạt được bằng phần trăm chiết khấu</b> nên ' +
                    'không chuyển sang mô hình mới. Dữ liệu được giữ nguyên trạng để tra cứu; ' +
                    'khai lại bằng mức chiết khấu nội bộ của phiên bản bảng giá nếu còn cần.</div></div>' +
                    '<div class="tbl-wrap" style="max-height:220px;margin:0 10px 10px"><table class="tbl"><thead><tr>' +
                    '<th style="width:220px">Phiên bản bảng giá</th><th style="width:120px">Đơn vị</th>' +
                    '<th style="width:220px">Loại cấu hình</th><th>Nội dung</th></tr></thead><tbody>' +
                    lt.map(function (x) {
                        return '<tr><td>' + T.esc(x.bangGia) + '</td><td>' + T.esc(x.donVi) + '</td>' +
                            '<td>' + T.esc(x.loai) + '</td><td>' + T.esc(x.moTa) + '</td></tr>';
                    }).join('') + '</tbody></table></div></div>';
            })() + '</div>';
        W.crumb(['Danh mục', 'Đối chiếu giá nội bộ']);

        host.querySelector('#nbPB').onchange = function () { bgId = this.value; cotGia = ''; ve(); };
        if (host.querySelector('#nbCot'))
            host.querySelector('#nbCot').onchange = function () { cotGia = this.value; ve(); };
        if (host.querySelector('#btnMoPB')) host.querySelector('#btnMoPB').onclick = function () {
            if (!qSua) return UI.thieuQuyen('bangGiaBan', 'sua');
            W.suaHoSoPhienBanGia(bg, function () { ve(); });
        };

        host.querySelector('#ctyBox').innerHTML = dvs.map(function (d) {
            var laNguon = T.laCtyNguon(d.id);
            var ck = laNguon ? 0 : T.chietKhauNoiBo(bg, d.id);
            return '<div class="card"><div class="card-h">' +
                (d.logo ? '<img src="' + d.logo + '" style="width:22px;height:22px;object-fit:contain">' : '<i class="bi bi-building"></i>') +
                ' ' + T.esc(d.tat) + (laNguon ? '<span class="spacer"></span><span class="pill b">Đơn vị nguồn — sở hữu kho và giá vốn</span>' : '') +
                '</div><div class="card-b">' +
                '<div class="small muted mb8">' + T.esc(d.ten) + '</div>' +
                '<div class="note ' + (laNguon ? 'g' : (ck ? 'b' : 'y')) + '"><i class="bi bi-calculator"></i><div><b>' +
                T.esc(T.dienGiaiNoiBo(bg, d.id)) + '</b></div></div>' +
                (laNguon
                    ? '<div class="small muted mt8">Đơn vị nguồn nhập khẩu trực tiếp nên dùng đúng giá vốn gốc, không chiết khấu.</div>'
                    : '<div class="small muted mt8">Khai trong phiên bản “' + T.esc((bg || {}).ten || '') + '”' +
                      ' · ' + T.lichSuChietKhauNoiBo(d.id).length + ' phiên bản có chiết khấu nội bộ</div>') +
                '</div></div>';
        }).join('');

        /* Đối chiếu trên đúng các mặt hàng của phiên bản đang chọn. */
        var hh = [];
        if (bg) {
            var th = {};
            T.dongBangGia(bg).forEach(function (x) {
                if (!x.hangHoaId || th[x.hangHoaId]) return;
                var h2 = DB.get('hangHoa', x.hangHoaId);
                if (h2) { th[x.hangHoaId] = 1; hh.push(h2); }
            });
        }
        if (!hh.length) hh = DB.all('hangHoa').filter(function (x) { return T.giaVonBQ(x) > 0; });

        /* Đối chiếu theo ĐÚNG loại giá đang chọn — cùng căn cứ với Business Engine. */
        var rows = hh.map(function (x) {
            var o = { id: x.id, ma: x.ma, ten: x.ten, dvt: x.dvt, ton: x.ton,
                      bq: T.giaVonGoc(x), gia: T.giaTheoLoai(bg, x.id, cotGia) };
            dvs.forEach(function (d) {
                o['g_' + d.id] = T.giaNoiBo(x.id, d.id, T.today(), (bg || {}).id, cotGia);
            });
            return o;
        });
        var cols = [
            { k: 'ma', t: 'Mã hàng', w: 158, cls: 'mono' },
            { k: 'ten', t: 'Tên hàng hóa', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
            { k: 'ton', t: 'Tồn kho', w: 90, cls: 'num', fmt: 'num' },
            { k: 'bq', t: 'Giá vốn gốc', w: 140, cls: 'num', r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: 'gia', t: cotGia || 'Loại giá', w: 140, cls: 'num', r: function (v) { return T.money(v); } }
        ].concat(dvs.map(function (d) {
            return { k: 'g_' + d.id, t: 'Giá vốn nội bộ ' + d.tat, w: 160, cls: 'num',
                r: function (v) { return T.money(v); } };
        }));

        new UI.Grid({
            mount: '#ghDoi', rows: rows, pageSize: 25, height: 'calc(100vh - 520px)',
            toolbar: false, search: ['ma', 'ten'], cols: cols, actions: false
        });

        host.querySelector('#btnBcao').onclick = function () {
            W.inBaoCao({
                tieu: 'BÁO CÁO ĐỐI CHIẾU GIÁ NỘI BỘ THEO ĐƠN VỊ',
                phu: 'Theo chiết khấu nội bộ của phiên bản bảng giá "' + ((bg || {}).ten || '—') +
                     '" · loại giá ' + (cotGia || '—'),
                thoiDiem: T.today(), file: 'BaoCao_DoiChieuGiaNoiBo',
                dieuKien: [{ t: 'Phiên bản bảng giá', v: (bg || {}).ten || '—' },
                           { t: 'Loại giá đối chiếu', v: cotGia || '—' }].concat(
                    dvs.filter(function (d) { return !T.laCtyNguon(d.id); }).map(function (d) {
                        return { t: 'Chiết khấu nội bộ ' + d.tat, v: T.num(T.chietKhauNoiBo(bg, d.id), 2) + '%' };
                    })),
                cols: cols.map(function (c) {
                    return { t: c.t, k: c.k, w: 26,
                             cls: c.cls === 'num' ? 'n' : (c.cls || ''),
                             r: c.cls === 'num' ? function (v) { return T.money(v); } : null };
                }),
                rows: rows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'GIÁM ĐỐC'
            });
        };
        host.querySelector('#btnXuat').onclick = function () {
            UI.xuatExcel('DoiChieuGiaNoiBo', 'Giá nội bộ',
                cols.map(function (c) { return { t: c.t, k: c.k, w: 20 }; }), rows);
        };
    }

    ve();
};

/* Toàn bộ Module Bảng giá (màn hình, phiên bản, import, loại giá, tệp gốc)
   nằm ở mod-modulegia.js. Tệp này chỉ còn Giá vốn, Giá nội bộ và Lô nhập hàng. */

/* ==========================================================================
   4. GIÁ VỐN & TỒN KHO — theo dõi bình quân di động
   ========================================================================== */
S['gia-von'] = function (host) {
    var tab = 'hienTai';
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Giá vốn &amp; tồn kho</h2>' +
        '<div class="sub">Một kho duy nhất — một tồn kho — một giá vốn bình quân gia quyền di động cho cả nhóm</div></div></div>' +
        '<div class="tabs"><div class="tab on" data-tb="hienTai"><i class="bi bi-boxes"></i> Giá vốn hiện tại</div>' +
        '<div class="tab" data-tb="lichSu"><i class="bi bi-clock-history"></i> Lịch sử biến động giá vốn</div></div>' +
        '<div id="kpi" class="kpis"></div><div id="gh"></div></div>';
    W.crumb(['Danh mục', 'Giá vốn & tồn kho']);

    function ve() {
        var tk = T.tonKhoNhom();
        var kho = T.khoChinh() || {};
        host.querySelector('#kpi').innerHTML =
            kp2('Kho vật lý', kho.ten || '—', 'thuộc ' + ((DB.get('donVi', kho.donViId) || {}).tat || 'Tản Viên')) +
            kp2('Số mã hàng', T.num(tk.soMa, 0), 'trong danh mục') +
            kp2('Tổng số lượng tồn', T.num(tk.soLuong, 0), '', 'c') +
            kp2('Giá trị tồn kho', T.money(tk.giaTri) + ' đ', 'theo giá vốn bình quân', 'g') +
            kp2('Lô đã nhập kho', T.num(DB.all('loNhap').filter(function (l) {
                return l.trangThai === 'Đã nhập kho' || l.trangThai === 'Tồn đầu kỳ'; }).length, 0), '') +
            kp2('Lần đổi giá vốn', T.num(DB.all('lichSuGiaVon').length, 0), 'đã ghi lịch sử', 'y');

        if (tab === 'hienTai') {
            var dvs = DB.all('donVi');
            var rows = DB.all('hangHoa').map(function (x) {
                var o = { id: x.id, ma: x.ma, ten: x.ten, dvt: x.dvt, nhom: x.nhom,
                    ton: x.ton, bq: T.giaVonBQ(x) };
                o.giaTri = Math.round((Number(x.ton) || 0) * o.bq);
                dvs.forEach(function (d) { o['g_' + d.id] = T.giaVonTheoDonVi(x.id, d.id); });
                return o;
            });
            new UI.Grid({
                mount: '#gh', rows: rows, pageSize: 25, height: 'calc(100vh - 420px)',
                search: ['ma', 'ten', 'nhom'], sortK: 'giaTri', sortD: -1,
                toolbar: '<button class="btn primary" data-bcao title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel"><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>' +
                    '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
                    '<button class="btn ok" data-tinhlai><i class="bi bi-arrow-repeat"></i> Tính lại giá vốn từ lịch sử lô nhập</button>' +
                    '<span class="tb-sep"></span><span class="small muted">Giá vốn từng đơn vị = kết quả của Engine tính giá</span>',
                filters: [{ k: 'nhom', t: 'Nhóm hàng', w: 200,
                    opts: Array.from(new Set(DB.all('hangHoa').map(function (x) { return x.nhom; }))) },
                    { k: '_t', t: 'Tình trạng tồn', w: 160, opts: [{ v: 'con', t: 'Còn hàng' }, { v: 'het', t: 'Hết / âm' }],
                      test: function (x, v) { return v === 'con' ? x.ton > 0 : x.ton <= 0; } }],
                cols: [
                    { k: 'ma', t: 'Mã hàng', w: 158, cls: 'mono' },
                    { k: 'ten', t: 'Tên hàng hóa', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
                    { k: 'ton', t: 'Tồn kho', w: 92, cls: 'num', fmt: 'num', total: true },
                    { k: 'bq', t: 'Giá vốn BQ', w: 138, cls: 'num', r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
                    { k: 'giaTri', t: 'Giá trị tồn', w: 150, cls: 'num', fmt: 'money', total: true }
                ].concat(dvs.map(function (d) {
                    return { k: 'g_' + d.id, t: 'Giá vốn ' + d.tat, w: 132, cls: 'num', fmt: 'money' };
                })),
                actions: false
            });
            host.querySelector('[data-tinhlai]').onclick = function () {
                UI.confirm({
                    title: 'Tính lại toàn bộ giá vốn bình quân', icon: 'bi-arrow-repeat',
                    message: 'Phát lại toàn bộ lô nhập theo thứ tự ngày để tính lại giá vốn bình quân?',
                    note: 'Dùng sau khi <b>nhập dữ liệu lịch sử</b> từ Excel để bảo đảm tính liên tục nhiều năm. ' +
                          '<b>Chứng từ bán hàng đã phát hành không bị đụng tới</b> — giá vốn trên đó đã đóng băng.',
                    okText: 'Tính lại', okIcon: 'bi-arrow-repeat',
                    ok: function () {
                        var kq = T.tinhLaiGiaVon();
                        ve(); W.route();
                        UI.toast('ok', 'Đã tính lại giá vốn',
                            kq.soLo + ' lô · ' + kq.soMa + ' mã hàng · ' + kq.soDong + ' dòng lịch sử.');
                    }
                });
            };
            host.querySelector('[data-bcao]').onclick = function () {
                W.inBaoCao({
                    tieu: 'BÁO CÁO GIÁ VỐN HÀNG HÓA',
                    phu: 'Giá vốn bình quân gia quyền di động và giá nội bộ từng công ty',
                    thoiDiem: T.today(), file: 'BaoCao_GiaVonHangHoa',
                    dieuKien: [{ t: 'Phạm vi', v: 'Toàn bộ hàng hóa trong kho' }],
                    cols: [
                        { t: 'Mã hàng', k: 'ma', w: 28 }, { t: 'Tên hàng hóa', k: 'ten' },
                        { t: 'Tồn kho', k: 'ton', w: 18, cls: 'n', tong: true, tongLa: 'num',
                          r: function (v) { return T.num(v); } },
                        { t: 'Giá vốn bình quân', k: 'bq', w: 26, cls: 'n',
                          r: function (v) { return T.money(v); } },
                        { t: 'Giá trị tồn', k: 'giaTri', w: 28, cls: 'n', tong: true,
                          r: function (v) { return T.money(v); } }
                    ].concat(dvs.map(function (d) {
                        return { t: 'Giá vốn ' + d.tat, k: 'g_' + d.id, w: 26, cls: 'n',
                                 r: function (v) { return T.money(v); } };
                    })),
                    rows: rows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'KẾ TOÁN TRƯỞNG'
                });
            };
            host.querySelector('[data-xuat]').onclick = function () {
                UI.xuatExcel('GiaVon_TonKho', 'Giá vốn tồn kho',
                    [{ t: 'Mã hàng', k: 'ma', w: 20 }, { t: 'Tên hàng hóa', k: 'ten', w: 50 },
                     { t: 'Tồn kho', k: 'ton', w: 12 }, { t: 'Giá vốn BQ', k: 'bq', w: 16 },
                     { t: 'Giá trị tồn', k: 'giaTri', w: 18 }]
                     .concat(dvs.map(function (d) { return { t: 'Giá vốn ' + d.tat, k: 'g_' + d.id, w: 16 }; })), rows);
            };
        } else {
            new UI.Grid({
                mount: '#gh', rows: DB.all('lichSuGiaVon'), pageSize: 30, height: 'calc(100vh - 420px)',
                search: ['maHang', 'tenHang', 'loSo'], toolbar: false,
                emptyTitle: 'Chưa có biến động giá vốn',
                emptyText: 'Lịch sử được ghi mỗi khi nhập kho một lô hàng mới.',
                cols: [
                    { k: 'luc', t: 'Thời điểm', w: 150, cls: 'mono' },
                    { k: 'loSo', t: 'Lô nhập', w: 130, cls: 'mono' },
                    { k: 'maHang', t: 'Mã hàng', w: 158, cls: 'mono' },
                    { k: 'tenHang', t: 'Tên hàng hóa', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
                    { k: 'tonCu', t: 'Tồn cũ', w: 90, cls: 'num', fmt: 'num' },
                    { k: 'bqCu', t: 'BQ cũ', w: 130, cls: 'num', fmt: 'money' },
                    { k: 'slNhap', t: 'SL nhập', w: 90, cls: 'num', r: function (v) { return '<span class="pos">+' + T.num(v) + '</span>'; } },
                    { k: 'giaVonLo', t: 'Giá vốn lô', w: 130, cls: 'num', fmt: 'money' },
                    { k: 'tonMoi', t: 'Tồn mới', w: 92, cls: 'num', fmt: 'num' },
                    { k: 'bqMoi', t: 'BQ mới', w: 136, cls: 'num', r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
                    { k: '_ch', t: 'Chênh lệch', w: 116, cls: 'num', sort: false, r: function (v, r) {
                        if (!r.bqCu) return '<span class="muted">—</span>';
                        var c = (r.bqMoi - r.bqCu) / r.bqCu * 100;
                        return '<span class="' + (c > 0 ? 'neg' : 'pos') + '">' + (c > 0 ? '+' : '') + T.num(c, 2) + '%</span>'; } }
                ],
                actions: false
            });
        }
    }
    function kp2(l, v, ft, c) {
        return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div>' +
            '<div class="vl" style="font-size:17px">' + v + '</div><div class="ft">' + (ft || '&nbsp;') + '</div></div>';
    }
    host.querySelectorAll('[data-tb]').forEach(function (t) {
        t.onclick = function () {
            host.querySelectorAll('[data-tb]').forEach(function (x) { x.classList.remove('on'); });
            t.classList.add('on'); tab = t.getAttribute('data-tb'); ve();
        };
    });
    ve();
};

})(window);

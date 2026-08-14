/* ==========================================================================
   TVERP — PHÂN HỆ KHO
   01 kho vật lý duy nhất (Công ty CP Công nghệ PCCC Tản Viên).
   EMC / AA / Thái Phong không có kho riêng — mọi hàng bán ra đều xuất từ kho này.
   Không có chuyển kho nội bộ. Không nhập liệu trùng.
   Màn hình: Tổng quan · Phiếu nhập kho · Phiếu xuất kho · Kiểm kê · Điều chỉnh tồn
             · Báo cáo tồn · Báo cáo Nhập-Xuất-Tồn · Lịch sử giao dịch kho
   Không nhập kho trực tiếp: Phiếu nhập và Phiếu xuất đều sinh từ chứng từ nguồn.
   Kho KHÔNG tạo nghiệp vụ bán hàng, KHÔNG tạo chứng từ trùng phân hệ Bán hàng.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;

function nvTen() { return (Q.nhanVienCuaToi() || {}).hoTen || DB.user().hoTen || ''; }
function nvId() { return (Q.nhanVienCuaToi() || {}).id || ''; }
function khoTen() { return (T.khoChinh() || {}).ten || 'Kho Tản Viên'; }
function khoId() { return (T.khoChinh() || {}).id || ''; }
function kp(l, v, ft, c) {
    return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div>' +
        '<div class="vl" style="font-size:17px">' + v + '</div><div class="ft">' + (ft || '&nbsp;') + '</div></div>';
}
/** Dải nút điều hướng nhanh giữa các màn hình của phân hệ Kho. */
var TAB_KHO = [
    { r: 'kho-tong-quan',  t: 'Tổng quan kho',  i: 'bi-clipboard2-data-fill', m: 'khoTongQuan' },
    { r: 'phieu-nhap',     t: 'Phiếu nhập kho', i: 'bi-box-arrow-in-down-left', m: 'phieuNhap' },
    { r: 'phieu-xuat',     t: 'Phiếu xuất kho', i: 'bi-box-arrow-right',   m: 'phieuXuat' },
    { r: 'kiem-ke',        t: 'Kiểm kê kho',    i: 'bi-clipboard-data',    m: 'kiemKe' },
    { r: 'dieu-chinh-ton', t: 'Điều chỉnh tồn kho', i: 'bi-sliders2',      m: 'dieuChinhKho' },
    { r: 'bao-cao-ton',    t: 'Báo cáo tồn kho', i: 'bi-boxes',            m: 'baoCaoTon' },
    { r: 'bao-cao-nxt',    t: 'Nhập - Xuất - Tồn', i: 'bi-arrow-left-right', m: 'baoCaoNXT' },
    { r: 'the-kho',        t: 'Lịch sử giao dịch', i: 'bi-clock-history',  m: 'theKho' }
];
W.TAB_KHO = TAB_KHO;
W.tabKho = function (cur) { return tabKho(cur); };
W.bindTabKho = function (host) { bindTab(host); };
function tabKho(cur) {
    return '<div class="tabs mb12">' + TAB_KHO.filter(function (x) { return Q.co(x.m, 'xem'); })
        .map(function (x) {
            return '<div class="tab' + (x.r === cur ? ' on' : '') + '" data-nav="' + x.r + '">' +
                '<i class="bi ' + x.i + '"></i> ' + x.t + '</div>';
        }).join('') + '</div>';
}
function bindTab(host) {
    host.querySelectorAll('[data-nav]').forEach(function (t) {
        t.onclick = function () { W.go(t.getAttribute('data-nav')); };
    });
}
/** Băng thông tin kho — nhắc lại nguyên tắc một kho duy nhất. */
function bangKho() {
    var k = T.khoChinh() || {};
    var dv = DB.get('donVi', k.donViId) || {};
    return '<div class="note b mb12"><i class="bi bi-building-fill"></i><div>' +
        '<b>' + T.esc(k.ten || 'Kho Tản Viên') + '</b> — ' + T.esc(k.diaChi || '') +
        '<br>Kho thuộc <b>' + T.esc(dv.ten || 'Công ty CP Công nghệ PCCC Tản Viên') + '</b>. ' +
        'Toàn hệ thống chỉ có <b>01 kho vật lý duy nhất</b>: EMC, AA và Thái Phong không có kho riêng, ' +
        'mọi hàng bán ra dù chứng từ do công ty nào phát hành cũng <b>xuất từ kho này</b>. ' +
        'Không có chức năng chuyển kho nội bộ.</div></div>';
}
/** Danh sách lựa chọn dùng cho bộ lọc theo thuộc tính hàng hóa. */
function duyNhat(f) {
    var s = {};
    DB.all('hangHoa').forEach(function (h) { var v = f(h); if (v) s[v] = 1; });
    return Object.keys(s).sort();
}
function thuongHieu(h) { return h.thuongHieu || h.xuatXu || ''; }
function nhaSX(h) { return h.nhaSanXuat || h.xuatXu || ''; }

/* ==========================================================================
   1. TỔNG QUAN KHO
   ========================================================================== */
S['kho-tong-quan'] = function (host) {
    var mod = 'khoTongQuan';
    var f = { nhom: '', th: '', nsx: '', tu: '', den: '' };
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Tổng quan kho</h2>' +
        '<div class="sub">Một kho — một tồn kho — một giá vốn bình quân cho toàn nhóm 4 công ty</div></div></div>' +
        tabKho('kho-tong-quan') + bangKho() +
        '<div class="card mb12"><div class="card-h"><i class="bi bi-funnel"></i> Lọc nhanh' +
        '<span class="spacer"></span>' +
        '<button class="btn sm primary" id="tqBcao" title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel">' +
        '<i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo tổng quan kho</button></div>' +
        '<div class="card-b"><div class="grid5">' +
        '<div class="fld"><label>Nhóm hàng</label><select data-f="nhom"><option value="">— Tất cả —</option>' +
        duyNhat(function (h) { return h.nhom; }).map(function (x) { return '<option>' + T.esc(x) + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld"><label>Nhà sản xuất</label><select data-f="nsx"><option value="">— Tất cả —</option>' +
        duyNhat(nhaSX).map(function (x) { return '<option>' + T.esc(x) + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld"><label>Thương hiệu</label><select data-f="th"><option value="">— Tất cả —</option>' +
        duyNhat(thuongHieu).map(function (x) { return '<option>' + T.esc(x) + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld"><label>Từ ngày</label><input type="date" data-f="tu"></div>' +
        '<div class="fld"><label>Đến ngày</label><input type="date" data-f="den"></div>' +
        '</div></div></div>' +
        '<div id="kpi" class="kpis mb12"></div><div id="bx"></div></div>';
    W.crumb(['Kho', 'Tổng quan kho']);
    host.querySelector('#tqBcao').onclick = function () {
        var hh = DB.all('hangHoa').filter(locHH).map(function (h) {
            var bq = T.giaVonBQ(h);
            return { ma: h.ma, ten: h.ten, dvt: h.dvt, nhom: h.nhom,
                     nsx: h.nhaSanXuat || h.xuatXu || '', ton: Number(h.ton) || 0,
                     bq: bq, giaTri: Math.round((Number(h.ton) || 0) * bq) };
        });
        W.inBaoCao({
            tieu: 'BÁO CÁO TỔNG QUAN KHO', phu: khoTen(),
            tu: f.tu, den: f.den, thoiDiem: T.today(), file: 'BaoCao_TongQuanKho',
            cty: DB.get('donVi', (T.khoChinh() || {}).donViId) || DB.cty(),
            dieuKien: [
                { t: 'Kho', v: khoTen() },
                { t: 'Nhóm hàng', v: f.nhom || 'Tất cả nhóm hàng' },
                { t: 'Nhà sản xuất', v: f.nsx || 'Tất cả' },
                { t: 'Thương hiệu', v: f.th || 'Tất cả' }
            ],
            cols: [
                { t: 'Mã hàng', k: 'ma', w: 28 }, { t: 'Tên hàng hóa', k: 'ten' },
                { t: 'ĐVT', k: 'dvt', w: 14, cls: 'c' }, { t: 'Nhóm hàng', k: 'nhom', w: 32 },
                { t: 'Nhà sản xuất', k: 'nsx', w: 26 },
                { t: 'Tồn kho', k: 'ton', w: 20, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return T.num(v); } },
                { t: 'Giá vốn bình quân', k: 'bq', w: 28, cls: 'n', an: !Q.co(mod, 'giaVon'),
                  r: function (v) { return T.money(v); } },
                { t: 'Giá trị tồn', k: 'giaTri', w: 30, cls: 'n', tong: true, an: !Q.co(mod, 'giaVon'),
                  r: function (v) { return T.money(v); } }
            ],
            rows: hh, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'THỦ KHO'
        });
    };
    bindTab(host);

    host.querySelectorAll('[data-f]').forEach(function (e) {
        e.onchange = function () { f[e.getAttribute('data-f')] = e.value; ve(); };
    });

    function locHH(h) {
        if (f.nhom && h.nhom !== f.nhom) return false;
        if (f.th && thuongHieu(h) !== f.th) return false;
        if (f.nsx && nhaSX(h) !== f.nsx) return false;
        return true;
    }

    function ve() {
        var hh = DB.all('hangHoa').filter(locHH);
        var ma = {}; hh.forEach(function (h) { ma[h.id] = h; });
        var soLuong = T.sum(hh, function (h) { return h.ton; });
        var giaTri = T.sum(hh, function (h) { return (Number(h.ton) || 0) * T.giaVonBQ(h); });
        var bqTB = soLuong ? Math.round(giaTri / soLuong) : 0;

        var sk = T.theKho().filter(function (x) {
            return ma[x.hangHoaId || T.idHH(x.maHang)] &&
                   (!f.tu || x.ngay >= f.tu) && (!f.den || x.ngay <= f.den);
        });
        var slN = T.sum(sk, function (x) { return x.nhap; }), gtN = T.sum(sk.filter(function (x) { return x.sl > 0; }), function (x) { return x.giaTri; });
        var slX = T.sum(sk, function (x) { return x.xuat; }), gtX = T.sum(sk.filter(function (x) { return x.sl < 0; }), function (x) { return x.giaTri; });

        var cb = T.canhBaoKho();
        /* Cảnh báo kho lọc theo ID NỘI BỘ của mặt hàng. */
        function trongLoc(r) { return !!ma[r.id || T.idHH(r)]; }
        var sapHet = cb.sapHet.filter(trongLoc);
        var im = cb.im.filter(trongLoc);
        var nhieu = cb.tonNhieu.filter(trongLoc);

        host.querySelector('#kpi').innerHTML =
            kp('Tổng số mã hàng', T.num(hh.length, 0), 'đang theo dõi trong kho') +
            kp('Tổng số lượng tồn', T.num(soLuong, 0), 'đơn vị hàng hóa', 'c') +
            kp('Tổng giá trị tồn kho', T.money(giaTri) + ' đ', 'theo giá vốn bình quân', 'g') +
            kp('Giá vốn bình quân', T.money(bqTB) + ' đ', 'bình quân gia quyền toàn kho', 'b') +
            kp('Hàng sắp hết', T.num(sapHet.length, 0) + ' mã', 'tồn ≤ định mức tối thiểu', sapHet.length ? 'r' : '') +
            kp('Hàng lâu chưa phát sinh', T.num(im.length, 0) + ' mã', 'không nhập/xuất từ ' + T.date(cb.moc), im.length ? 'y' : '');

        var kyN = (f.tu || f.den) ? ('kỳ ' + (f.tu ? T.date(f.tu) : '…') + ' → ' + (f.den ? T.date(f.den) : '…')) : 'toàn bộ lịch sử';

        host.querySelector('#bx').innerHTML =
            '<div class="grid2 mb12">' +
            '<div class="card"><div class="card-h"><i class="bi bi-box-arrow-in-down"></i> Nhập kho — ' + kyN + '</div>' +
            '<div class="card-b"><div class="grid2">' +
            kp('Số lượng nhập', T.num(slN, 0), '', 'g') + kp('Giá trị nhập', T.money(gtN) + ' đ', '', 'g') +
            '</div></div></div>' +
            '<div class="card"><div class="card-h"><i class="bi bi-box-arrow-right"></i> Xuất kho — ' + kyN + '</div>' +
            '<div class="card-b"><div class="grid2">' +
            kp('Số lượng xuất', T.num(slX, 0), '', 'c') + kp('Giá trị xuất (giá vốn)', T.money(gtX) + ' đ', '', 'c') +
            '</div></div></div></div>' +
            '<div class="grid3">' +
            box('Hàng sắp hết', 'bi-exclamation-triangle-fill', sapHet.slice(0, 12), function (r) {
                return '<td class="num ' + (r.ton <= 0 ? 'neg' : '') + '"><b>' + T.num(r.ton) + '</b></td>' +
                       '<td class="num muted small">ĐM ' + T.num(r.tonToiThieu) + '</td>'; },
                'Tồn', 'Định mức', 'Không có mã nào dưới định mức') +
            box('Hàng tồn nhiều (giá trị lớn nhất)', 'bi-boxes', nhieu.slice(0, 12), function (r) {
                return '<td class="num">' + T.num(r.ton) + '</td>' +
                       '<td class="num"><b>' + T.money(r.giaTriTon) + '</b></td>'; },
                'Tồn', 'Giá trị tồn', 'Chưa có tồn kho') +
            box('Hàng lâu chưa phát sinh', 'bi-hourglass-split', im.slice(0, 12), function (r) {
                return '<td class="num">' + T.num(r.ton) + '</td>' +
                       '<td class="ctr small muted">' + (r.ngayCuoi ? T.date(r.ngayCuoi) : 'chưa từng') + '</td>'; },
                'Tồn', 'Lần cuối', 'Mọi mã đều có phát sinh gần đây') +
            '</div>';

        host.querySelectorAll('[data-ma]').forEach(function (a) {
            a.onclick = function (e) {
                e.preventDefault();
                W.theKhoCuaMa(a.getAttribute('data-ma'));
            };
        });
    }

    function box(tieu, icon, rows, cot, h1, h2, rong) {
        return '<div class="card"><div class="card-h"><i class="bi ' + icon + '"></i> ' + tieu +
            '<span class="spacer"></span><span class="pill n">' + rows.length + '</span></div>' +
            '<div class="tablewrap" style="max-height:300px">' +
            (rows.length ? '<table class="grid"><thead><tr><th>Mã hàng</th>' +
                '<th class="num" style="width:78px">' + h1 + '</th><th class="num" style="width:110px">' + h2 + '</th></tr></thead><tbody>' +
                rows.map(function (r) {
                    return '<tr><td><a href="#" data-ma="' + T.esc(r.ma) + '" class="lnk mono" title="' + T.esc(r.ten) + '">' +
                        T.esc(r.ma) + '</a><div class="small muted ellip">' + T.esc(r.ten) + '</div></td>' + cot(r) + '</tr>';
                }).join('') + '</tbody></table>'
                : '<div class="empty" style="padding:26px"><i class="bi bi-check2-circle"></i>' + rong + '</div>') +
            '</div></div>';
    }
    ve();
};



/* ==========================================================================
   2. KIỂM KÊ KHO
   ========================================================================== */
var TT_KK = ['Nháp', 'Đang kiểm kê', 'Đã hoàn tất', 'Đã hủy'];

S['kiem-ke'] = function (host) {
    var mod = 'kiemKe';
    var qThem = Q.co(mod, 'them'), qSua = Q.co(mod, 'sua'), qXoa = Q.co(mod, 'xoa'),
        qDuyet = Q.co(mod, 'duyet'), qIn = Q.co(mod, 'in');
    var g;

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Kiểm kê kho</h2>' +
        '<div class="sub">Đếm thực tế tại ' + T.esc(khoTen()) + ' — so sánh với tồn hệ thống — sinh phiếu điều chỉnh khi lệch</div></div></div>' +
        tabKho('kiem-ke') +
        '<div class="note b mb12"><i class="bi bi-diagram-2"></i><div><b>Quy trình:</b> Tạo phiếu kiểm kê → ' +
        'chọn phạm vi hàng hóa (hệ thống tự lấy <b>tồn hệ thống</b> tại ngày kiểm kê) → nhập <b>số lượng thực tế</b> → ' +
        'hệ thống tính <b>chênh lệch</b> → bấm <b>Sinh phiếu điều chỉnh tồn kho</b>. ' +
        'Toàn bộ các lần kiểm kê đều được lưu lịch sử, không xóa được sau khi đã hoàn tất.</div></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Kho', 'Kiểm kê kho']);
    bindTab(host);

    function rows() {
        return DB.all('kiemKe').map(function (k) {
            var o = T.clone(k);
            o._soMa = (k.lines || []).length;
            o._lech = (k.lines || []).filter(function (l) { return Number(l.chenh); }).length;
            o._gt = T.sum(k.lines || [], function (l) { return (Number(l.chenh) || 0) * (Number(l.giaVon) || 0); });
            return o;
        });
    }

    var tb = (qThem ? '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Tạo phiếu kiểm kê</button>' : '') +
        '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Nhập số thực tế</button>' +
        '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn ok" data-dc disabled><i class="bi bi-sliders2"></i> Sinh phiếu điều chỉnh</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>';

    g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: 20, height: 'calc(100vh - 430px)', toolbar: tb,
        sortK: 'ngay', sortD: -1, chon: true, search: ['so', 'lyDo', 'nguoiKiem', 'ghiChu'],
        emptyTitle: 'Chưa có phiếu kiểm kê nào',
        emptyText: 'Bấm “Tạo phiếu kiểm kê” để bắt đầu một đợt kiểm kê kho.',
        cols: [
            { k: 'so', t: 'Số phiếu', w: 140, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày kiểm kê', w: 116, fmt: 'date' },
            { k: 'lyDo', t: 'Nội dung / lý do kiểm kê', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
            { k: 'nguoiKiem', t: 'Người kiểm kê', w: 170 },
            { k: '_soMa', t: 'Số mã', w: 78, cls: 'num', fmt: 'num' },
            { k: '_lech', t: 'Số mã lệch', w: 104, cls: 'num',
              r: function (v) { return v ? '<span class="neg"><b>' + T.num(v) + '</b></span>' : '<span class="pos">0</span>'; } },
            { k: '_gt', t: 'Giá trị chênh lệch', w: 158, cls: 'num', total: true,
              r: function (v) { return '<span class="' + (v < 0 ? 'neg' : v > 0 ? 'pos' : 'muted') + '">' + T.money(v) + '</span>'; } },
            { k: 'dieuChinhSo', t: 'Phiếu điều chỉnh', w: 150, cls: 'mono',
              r: function (v) { return v ? '<span class="pill g">' + T.esc(v) + '</span>' : '<span class="muted">—</span>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 140, r: function (v) { return T.pill(v); } }
        ],
        filters: [{ k: 'trangThai', t: 'Trạng thái', w: 180, opts: TT_KK }],
        actions: function (r) {
            return UI.btn('xem', 'bi-eye', 'Xem phiếu kiểm kê') +
                (qSua && r.trangThai !== 'Đã hoàn tất' ? UI.btn('sua', 'bi-pencil', 'Nhập số thực tế') : '');
        }, actionsW: 84,
        onAction: function (a, r) {
            var rec = DB.get('kiemKe', r.id);
            if (a === 'sua') form(rec); else if (a === 'xem') form(rec, true); else if (a === 'in') inKK(rec);
        },
        onSelect: UI.chonToolbar(host, ['sua', 'xoa', 'dc', 'in']),
        onOpen: function (r) { form(DB.get('kiemKe', r.id), true); }
    });
    UI.apQuyen(host, mod);
    W.hangLoat(host, g, {
        mod: mod, coll: 'kiemKe', dt: 'Phiếu kiểm kê', file: 'DanhSach_KiemKe', rows: rows,
        excel: xlCols(), email: false, inCT: false,
        suaTruong: [{ k: 'ngay', t: 'Ngày kiểm kê', type: 'date' },
                    { k: 'nguoiKiem', t: 'Người kiểm kê', type: 'text' },
                    { k: 'ghiChu', t: 'Ghi chú', type: 'text' }]
    });

    /* --------------------------------------------- NHẬP HÀNG TRẢ LẠI
       Khách trả hàng: chọn đúng phiếu xuất đã giao, không nhập tay lại dòng hàng.
       Hệ thống sinh phiếu nhập kho nguồn "Trả hàng" theo đúng giá vốn đã xuất. */
    function nhapTraHang() {
        if (!Q.co(mod, 'sua')) return UI.thieuQuyen(mod, 'sua');
        var ds = DB.all('phieuXuat').filter(function (p) { return p.trangThai === 'Đã xuất kho'; });
        if (!ds.length) return UI.toast('warn', 'Chưa thực hiện được',
            'Chưa có phiếu xuất kho nào đã xuất — không có hàng để nhận trả lại.');
        UI.modal({
            size: 'lg', title: 'Lập phiếu nhập hàng trả lại',
            sub: 'Chọn phiếu xuất kho gốc — hệ thống lấy lại đúng dòng hàng và giá vốn đã xuất',
            body: '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
                'Không nhập tay lại dòng hàng. Chọn phiếu xuất đã giao, nhập số lượng khách trả lại của từng dòng ' +
                '(để 0 nếu dòng đó không trả). Phiếu nhập sinh ra có nguồn <b>Trả hàng</b> và làm tăng tồn kho theo ' +
                'đúng giá vốn tại thời điểm xuất — không làm sai giá vốn bình quân.</div></div>' +
                '<div class="fld mb12"><label>Phiếu xuất kho gốc</label><select id="pxGoc">' +
                ds.map(function (p) {
                    return '<option value="' + T.esc(p.id) + '">' + T.esc(p.so) + ' — ' + T.date(p.ngay) +
                        ' — ' + T.esc(p.khachHang || '') + '</option>';
                }).join('') + '</select></div>' +
                '<div class="fld mb12"><label>Ngày nhận hàng trả lại</label>' +
                '<input type="date" id="traNgay" value="' + T.today() + '"></div>' +
                '<div class="fld mb12"><label>Lý do trả hàng</label>' +
                '<input id="traLyDo" placeholder="VD: Khách trả lại do thừa so với nhu cầu thực tế"></div>' +
                '<div id="traBang"></div>',
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Ghi sổ phiếu nhập trả lại', cls: 'primary', icon: 'bi-box-arrow-in-down-left',
                  click: function (h) {
                    var px = DB.get('phieuXuat', h.q('#pxGoc').value);
                    if (!px) return UI.toast('err', 'Chưa chọn phiếu xuất gốc');
                    var ngay = h.q('#traNgay').value;
                    if (!ngay) return UI.toast('err', 'Chưa chọn ngày', 'Phải ghi rõ ngày nhận hàng trả lại.');
                    var lines = [];
                    h.el.querySelectorAll('[data-tra-sl]').forEach(function (i) {
                        var sl = T.so(i.value);
                        if (!(sl > 0)) return;
                        var l = (px.lines || [])[Number(i.getAttribute('data-tra-sl'))];
                        if (!l) return;
                        if (sl > (Number(l.soLuong) || 0)) { lines = null; return; }
                        /* HÀNG TRẢ VỀ KHO NHẬP LẠI THEO GIÁ VỐN GỐC.
                           Dòng phiếu xuất của AA · EMC · Thái Phong mang giá vốn
                           NỘI BỘ (đã cộng lãi của Tản Viên); lấy con số đó nhập
                           lại kho sẽ thổi phồng giá vốn bình quân của cả nhóm. */
                        var gvTra = Number(l.giaVonGoc) > 0 ? Number(l.giaVonGoc) : T.giaVonGoc(l);
                        if (lines) lines.push({ hangHoaId: T.idDong(l),
                            maHang: l.maHang, tenHang: l.tenHang, dvt: l.dvt, soLuong: sl,
                            giaVon: gvTra,
                            thanhTien: Math.round(sl * gvTra) });
                    });
                    if (lines === null) return UI.toast('err', 'Số lượng trả vượt quá số đã xuất',
                        'Số lượng trả lại của mỗi dòng không được lớn hơn số lượng đã xuất trên phiếu gốc.');
                    if (!lines.length) return UI.toast('err', 'Chưa nhập số lượng trả lại',
                        'Hãy nhập số lượng trả lại cho ít nhất một dòng hàng.');
                    var pn = DB.insert('phieuNhap', {
                        so: DB.soMoi('PN'), ngay: ngay, nguon: 'Trả hàng',
                        loNhapId: '', loNhapSo: px.so,
                        nhaCungCapId: '', nhaCungCap: px.khachHang || '',
                        khoId: khoId(), nguoiLapId: nvId(), nguoiLap: nvTen(),
                        ghiChu: 'Nhận hàng trả lại theo phiếu xuất ' + px.so +
                                (h.q('#traLyDo').value ? ' — ' + h.q('#traLyDo').value : ''),
                        lines: lines, tongTien: T.sum(lines, function (l) { return l.thanhTien; }),
                        trangThai: 'Nháp', maGD: px.maGD || ''
                    });
                    T.ghiSoPhieuNhap(pn);
                    h.close(); g.reload(rows()); W.route();
                    UI.toast('ok', 'Đã ghi sổ phiếu nhập ' + pn.so,
                        lines.length + ' dòng hàng trả lại — tồn kho đã tăng đúng giá vốn đã xuất.');
                } }
            ],
            onOpen: function (h) {
                function ve() {
                    var px = DB.get('phieuXuat', h.q('#pxGoc').value) || {};
                    h.q('#traBang').innerHTML =
                        '<div class="card"><div class="card-h"><i class="bi bi-list-ul"></i> Dòng hàng của phiếu ' +
                        T.esc(px.so || '') + '</div><div class="tablewrap" style="max-height:300px">' +
                        '<table class="grid"><thead><tr><th style="width:140px">Mã hàng</th><th>Tên hàng hóa</th>' +
                        '<th class="num" style="width:96px">Đã xuất</th>' +
                        '<th class="num" style="width:130px">Giá vốn đã xuất</th>' +
                        '<th style="width:130px">Số lượng trả lại</th></tr></thead><tbody>' +
                        (px.lines || []).map(function (l, i) {
                            return '<tr><td class="mono">' + T.esc(l.maHang) + '</td>' +
                                '<td><span class="ellip">' + T.esc(l.tenHang) + '</span></td>' +
                                '<td class="num">' + T.num(l.soLuong) + '</td>' +
                                '<td class="num">' + T.money(l.giaVon || T.giaVonBQ(l)) + '</td>' +
                                '<td><input class="num sl" data-tra-sl="' + i + '" value="0"></td></tr>';
                        }).join('') + '</tbody></table></div></div>';
                    UI.numInput(h.el);
                }
                h.q('#pxGoc').onchange = ve;
                ve();
            }
        });
    }

    function xlCols() {
        return [{ t: 'Số phiếu', k: 'so', w: 18 }, { t: 'Ngày kiểm kê', k: 'ngay', w: 14 },
                { t: 'Nội dung', k: 'lyDo', w: 34 }, { t: 'Người kiểm kê', k: 'nguoiKiem', w: 22 },
                { t: 'Số mã', k: '_soMa', w: 10 }, { t: 'Số mã lệch', k: '_lech', w: 12 },
                { t: 'Giá trị chênh lệch', k: '_gt', w: 20 },
                { t: 'Phiếu điều chỉnh', k: 'dieuChinhSo', w: 18 }, { t: 'Trạng thái', k: 'trangThai', w: 16 }];
    }

    var qs = function (x) { return host.querySelector(x); };
    if (qs('[data-them]')) qs('[data-them]').onclick = function () { form(null); };
    if (qs('[data-sua]')) qs('[data-sua]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (r.trangThai === 'Đã hoàn tất') return UI.khongThe('Sửa phiếu kiểm kê',
            'Phiếu kiểm kê ' + r.so + ' đã hoàn tất nên thuộc lịch sử kiểm kê kho.',
            'Lập một biên bản kiểm kê mới nếu cần điều chỉnh số liệu.');
        form(DB.get('kiemKe', r.id));
    };
    if (qs('[data-dc]')) qs('[data-dc]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (!r._lech) return UI.khongThe('Sinh phiếu điều chỉnh tồn kho',
            'Phiếu kiểm kê ' + r.so + ' không có mã hàng nào lệch giữa tồn sổ và tồn thực tế.',
            'Chỉ phiếu kiểm kê có chênh lệch mới sinh được phiếu điều chỉnh tồn kho.');
        sinhDieuChinh(DB.get('kiemKe', r.id));
    };
    if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () {
        var r = g.selected(); if (!r) return;
        UI.xoaChuan({ coll: 'kiemKe', rec: r, mod: mod, ten: 'Phiếu kiểm kê ' + r.so,
            sauKhi: function () { g.selId = null; g.reload(rows()); W.route(); } });
    };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel('DanhSach_KiemKe', 'Kiểm kê kho', xlCols(), g.allRows);
    };

    /* ------------------------------------------------ PHIẾU KIỂM KÊ */
    function form(r, chiXem) {
        var moi = !r;
        if (moi && !qThem) return UI.thieuQuyen(mod, 'them');
        if (!moi && !chiXem && !qSua) return UI.thieuQuyen(mod, 'sua');
        r = r ? T.clone(r) : {
            so: DB.soMoi('KK'), ngay: T.today(), khoId: khoId(), kho: khoTen(),
            lyDo: 'Kiểm kê định kỳ', nguoiKiemId: nvId(), nguoiKiem: nvTen(),
            thanhVien: '', trangThai: 'Nháp', ghiChu: '', lines: [], dieuChinhId: '', dieuChinhSo: ''
        };
        var lines = T.clone(r.lines || []);

        UI.modal({
            size: 'full', title: (moi ? 'Tạo phiếu kiểm kê' : (chiXem ? 'Phiếu kiểm kê ' : 'Nhập số thực tế — phiếu ') + r.so),
            sub: khoTen() + ' — chỉ có 01 kho vật lý duy nhất',
            body:
            '<div class="grid4 mb12">' +
            '<div class="fld"><label>Số phiếu</label><input data-f="so" value="' + T.esc(r.so) + '" readonly></div>' +
            '<div class="fld"><label>Ngày kiểm kê <b class="req">*</b></label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            '<div class="fld"><label>Kho kiểm kê</label><input value="' + T.esc(khoTen()) + '" readonly></div>' +
            '<div class="fld"><label>Trạng thái</label><input value="' + T.esc(r.trangThai) + '" readonly></div>' +
            '</div>' +
            '<div class="grid3 mb12">' +
            '<div class="fld"><label>Nội dung / lý do kiểm kê <b class="req">*</b></label><input data-f="lyDo" value="' + T.esc(r.lyDo) + '"></div>' +
            '<div class="fld"><label>Người kiểm kê <b class="req">*</b></label><div id="cbNV"></div></div>' +
            '<div class="fld"><label>Thành viên tham gia</label><input data-f="thanhVien" value="' + T.esc(r.thanhVien || '') + '" placeholder="Ghi rõ họ tên các thành viên ban kiểm kê"></div>' +
            '</div>' +
            '<div class="card mb12"><div class="card-h"><i class="bi bi-clipboard-data"></i> Bảng kiểm kê' +
            '<span class="spacer"></span>' +
            (chiXem ? '' :
            '<button class="btn sm" data-nap-all><i class="bi bi-list-check"></i> Nạp toàn bộ hàng hóa</button>' +
            '<button class="btn sm" data-nap-ton><i class="bi bi-box-seam"></i> Chỉ nạp mã đang có tồn</button>' +
            '<button class="btn sm" data-nap-nhom><i class="bi bi-funnel"></i> Nạp theo nhóm hàng</button>' +
            '<button class="btn sm danger" data-xoa-all><i class="bi bi-x-lg"></i> Xóa hết dòng</button>') +
            '</div><div class="tablewrap" style="max-height:calc(100vh - 520px)"><div id="bangKK"></div></div></div>' +
            '<div class="grid4" id="tongKK"></div>' +
            '<div class="fld mt12"><label>Ghi chú</label><input data-f="ghiChu" value="' + T.esc(r.ghiChu || '') + '"></div>',
            buttons: chiXem
                ? [{ text: 'Đóng', click: function (h) { h.close(); } }]
                    .concat(qIn && r.id ? [{ text: 'Xem trước khi in', cls: 'primary', icon: 'bi-printer',
                        click: function () { inKK(DB.get('kiemKe', r.id) || r); } }] : [])
                : [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Lưu phiếu kiểm kê', cls: 'primary', icon: 'bi-check-lg', click: function (h) { luu(h, false); } },
                { text: 'Lưu & sinh phiếu điều chỉnh', cls: 'ok', icon: 'bi-sliders2', click: function (h) { luu(h, true); } }
            ],
            onOpen: function (h) {
                UI.combo('#cbNV', {
                    items: DB.all('nhanVien').filter(function (n) { return n.trangThai !== 'Khóa'; })
                        .map(function (n) { return { v: n.id, t: n.hoTen, s: n.chucVu || '' }; }),
                    value: r.nguoiKiemId, placeholder: '— Chọn nhân viên —',
                    onChange: function (v) {
                        r.nguoiKiemId = v;
                        r.nguoiKiem = (DB.get('nhanVien', v) || {}).hoTen || '';
                    }
                });
                if (!chiXem) {
                    h.q('[data-nap-all]').onclick = function () { nap(DB.all('hangHoa')); };
                    h.q('[data-nap-ton]').onclick = function () { nap(DB.all('hangHoa').filter(function (x) { return (Number(x.ton) || 0) !== 0; })); };
                    h.q('[data-nap-nhom]').onclick = function () { chonNhom(); };
                    h.q('[data-xoa-all]').onclick = function () {
                        UI.confirm({ title: 'Xóa toàn bộ dòng kiểm kê', message: 'Xóa hết ' + lines.length + ' dòng đang có trên bảng kiểm kê?',
                            okText: 'Xóa hết', ok: function () { lines = []; veBang(h); } });
                    };
                }
                veBang(h);

                function chonNhom() {
                    var nhs = duyNhat(function (x) { return x.nhom; });
                    UI.modal({
                        size: 'md', title: 'Nạp hàng hóa theo nhóm',
                        body: '<div class="fld"><label>Nhóm hàng</label><select id="nh">' +
                            nhs.map(function (x) { return '<option>' + T.esc(x) + '</option>'; }).join('') + '</select></div>',
                        buttons: [{ text: 'Hủy', click: function (x) { x.close(); } },
                            { text: 'Nạp', cls: 'primary', click: function (x) {
                                var n = x.q('#nh').value; x.close();
                                nap(DB.all('hangHoa').filter(function (y) { return y.nhom === n; }));
                            } }]
                    });
                }
                function nap(hh) {
                    var co = {}; lines.forEach(function (l) { co[T.idDong(l)] = 1; });
                    var them = 0;
                    hh.forEach(function (x) {
                        if (co[x.id]) return;
                        var ht = T.tonTaiNgay(x.id, h.q('[data-f="ngay"]').value || T.today());
                        lines.push({ hangHoaId: x.id, maHang: x.ma, tenHang: x.ten, dvt: x.dvt,
                            tonHT: ht, thucTe: ht, chenh: 0, giaVon: T.giaVonBQ(x), ghiChu: '' });
                        them++;
                    });
                    veBang(h);
                    UI.toast('ok', 'Đã nạp ' + them + ' mã hàng', 'Số lượng thực tế mặc định bằng tồn hệ thống — sửa lại theo số đếm thực tế.');
                }
            }
        });

        function veBang(h) {
            var ro = chiXem ? ' readonly' : '';
            h.q('#bangKK').innerHTML = !lines.length
                ? '<div class="empty" style="padding:36px"><i class="bi bi-clipboard"></i><b>Chưa có dòng kiểm kê</b>Bấm “Nạp toàn bộ hàng hóa” hoặc “Chỉ nạp mã đang có tồn”.</div>'
                : '<table class="grid lines-tb"><thead><tr>' +
                '<th style="width:42px">TT</th><th style="width:150px">Mã hàng</th><th>Tên hàng hóa</th>' +
                '<th style="width:70px">ĐVT</th><th class="num" style="width:104px">Tồn hệ thống</th>' +
                '<th class="num" style="width:112px">Thực tế đếm</th><th class="num" style="width:104px">Chênh lệch</th>' +
                '<th class="num" style="width:126px">Giá vốn BQ</th><th class="num" style="width:140px">Giá trị lệch</th>' +
                '<th style="width:170px">Ghi chú</th>' + (chiXem ? '' : '<th style="width:42px"></th>') + '</tr></thead><tbody>' +
                lines.map(function (l, i) {
                    var ch = (Number(l.thucTe) || 0) - (Number(l.tonHT) || 0);
                    l.chenh = ch;
                    return '<tr data-i="' + i + '"><td class="ctr muted">' + (i + 1) + '</td>' +
                        '<td class="mono">' + T.esc(l.maHang) + '</td>' +
                        '<td><span class="ellip">' + T.esc(l.tenHang) + '</span></td>' +
                        '<td>' + T.esc(l.dvt || '') + '</td>' +
                        '<td class="num">' + T.num(l.tonHT) + '</td>' +
                        '<td class="num"><input class="num sl" data-l="thucTe" value="' + T.esc(T.soVe(l.thucTe, 2)) + '"' + ro + '></td>' +
                        '<td class="num ' + (ch < 0 ? 'neg' : ch > 0 ? 'pos' : 'muted') + '"><b>' + (ch > 0 ? '+' : '') + T.num(ch) + '</b></td>' +
                        '<td class="num">' + T.money(l.giaVon) + '</td>' +
                        '<td class="num ' + (ch < 0 ? 'neg' : ch > 0 ? 'pos' : 'muted') + '">' + T.money(ch * (Number(l.giaVon) || 0)) + '</td>' +
                        '<td><input data-l="ghiChu" value="' + T.esc(l.ghiChu || '') + '"' + ro + '></td>' +
                        (chiXem ? '' : '<td class="ctr"><button class="btn btn-ico sm danger" data-del title="Bỏ dòng"><i class="bi bi-x-lg"></i></button></td>') +
                        '</tr>';
                }).join('') + '</tbody></table>';

            h.q('#bangKK').querySelectorAll('tr[data-i]').forEach(function (tr) {
                var i = Number(tr.getAttribute('data-i'));
                tr.querySelectorAll('[data-l]').forEach(function (inp) {
                    inp.oninput = function () {
                        var k = inp.getAttribute('data-l');
                        lines[i][k] = k === 'thucTe' ? T.so(inp.value) : inp.value;
                        if (k === 'thucTe') { lines[i].chenh = lines[i].thucTe - (Number(lines[i].tonHT) || 0); veTongKK(h); }
                    };
                    inp.onblur = function () { if (inp.getAttribute('data-l') === 'thucTe') veBang(h); };
                });
                var d = tr.querySelector('[data-del]');
                if (d) d.onclick = function () { lines.splice(i, 1); veBang(h); };
            });
            veTongKK(h);
        }
        function veTongKK(h) {
            var lech = lines.filter(function (l) { return Number(l.chenh); });
            var thua = lines.filter(function (l) { return Number(l.chenh) > 0; });
            var thieu = lines.filter(function (l) { return Number(l.chenh) < 0; });
            var gt = T.sum(lines, function (l) { return (Number(l.chenh) || 0) * (Number(l.giaVon) || 0); });
            h.q('#tongKK').innerHTML =
                kp('Số mã kiểm kê', T.num(lines.length, 0)) +
                kp('Thừa so với sổ', T.num(thua.length, 0) + ' mã', T.num(T.sum(thua, function (l) { return l.chenh; }), 0) + ' đơn vị', thua.length ? 'g' : '') +
                kp('Thiếu so với sổ', T.num(thieu.length, 0) + ' mã', T.num(T.sum(thieu, function (l) { return l.chenh; }), 0) + ' đơn vị', thieu.length ? 'r' : '') +
                kp('Giá trị chênh lệch', T.money(gt) + ' đ', lech.length + ' mã lệch', gt < 0 ? 'r' : gt > 0 ? 'g' : '');
        }

        function luu(h, sinhDC) {
            var v = UI.read(h.el);
            if (!v.ngay) return UI.toast('err', 'Thiếu thông tin', 'Chưa chọn ngày kiểm kê.');
            if (!v.lyDo) return UI.toast('err', 'Thiếu thông tin', 'Chưa ghi nội dung / lý do kiểm kê.');
            if (!r.nguoiKiemId) return UI.toast('err', 'Thiếu thông tin', 'Chưa chọn người kiểm kê.');
            if (!lines.length) return UI.toast('err', 'Chưa có dòng kiểm kê', 'Hãy nạp danh sách hàng hóa cần kiểm kê.');
            lines.forEach(function (l) { l.chenh = (Number(l.thucTe) || 0) - (Number(l.tonHT) || 0); });
            var o = {
                so: r.so, ngay: v.ngay, khoId: khoId(), kho: khoTen(), lyDo: v.lyDo,
                nguoiKiemId: r.nguoiKiemId, nguoiKiem: r.nguoiKiem, thanhVien: v.thanhVien || '',
                trangThai: lines.some(function (l) { return l.chenh; }) ? 'Đang kiểm kê' : 'Đã hoàn tất',
                ghiChu: v.ghiChu || '', lines: lines,
                dieuChinhId: r.dieuChinhId || '', dieuChinhSo: r.dieuChinhSo || ''
            };
            var rec = moi ? DB.insert('kiemKe', o) : DB.update('kiemKe', r.id, o);
            h.close(); g.reload(rows()); W.route();
            UI.toast('ok', moi ? 'Đã tạo phiếu kiểm kê' : 'Đã lưu phiếu kiểm kê', rec.so + ' — ' + lines.length + ' mã hàng.');
            if (sinhDC) setTimeout(function () { sinhDieuChinh(DB.get('kiemKe', rec.id)); }, 350);
        }
    }

    /* --------------------------------- SINH PHIẾU ĐIỀU CHỈNH TỪ KIỂM KÊ */
    function sinhDieuChinh(kk) {
        if (!Q.co('dieuChinhKho', 'them')) return UI.thieuQuyen('dieuChinhKho', 'them');
        if (kk.dieuChinhId && DB.get('dieuChinhKho', kk.dieuChinhId))
            return UI.toast('warn', 'Đã sinh phiếu điều chỉnh', 'Phiếu ' + kk.dieuChinhSo + ' đã được lập từ đợt kiểm kê này.');
        var lech = (kk.lines || []).filter(function (l) { return Number(l.chenh); });
        if (!lech.length) return UI.toast('info', 'Không có chênh lệch', 'Tồn thực tế khớp hoàn toàn với tồn hệ thống.');
        var gt = T.sum(lech, function (l) { return (Number(l.chenh) || 0) * (Number(l.giaVon) || 0); });
        UI.confirm({
            title: 'Sinh phiếu điều chỉnh tồn kho', icon: 'bi-sliders2',
            message: 'Lập phiếu điều chỉnh tồn kho cho <b>' + lech.length + ' mã hàng</b> chênh lệch của đợt kiểm kê <b>' + T.esc(kk.so) + '</b>?',
            note: 'Giá trị chênh lệch: <b>' + T.money(gt) + ' đ</b>. Phiếu điều chỉnh được tạo ở trạng thái ' +
                  '<b>Chờ duyệt</b> — tồn kho chỉ thay đổi sau khi có người duyệt. ' +
                  'Lịch sử kiểm kê và điều chỉnh <b>không được phép xóa</b>.',
            okText: 'Sinh phiếu điều chỉnh', okIcon: 'bi-sliders2',
            ok: function () {
                var o = {
                    so: DB.soMoi('DC'), ngay: kk.ngay, khoId: khoId(), kho: khoTen(),
                    nguyenNhan: 'Sai lệch kiểm kê', lyDo: 'Điều chỉnh theo biên bản kiểm kê ' + kk.so,
                    kiemKeId: kk.id, kiemKeSo: kk.so,
                    nguoiThucHienId: nvId(), nguoiThucHien: nvTen(),
                    nguoiDuyetId: '', nguoiDuyet: '', ngayDuyet: '',
                    trangThai: 'Chờ duyệt', ghiChu: '',
                    lines: lech.map(function (l) {
                        return { hangHoaId: T.idDong(l), maHang: l.maHang, tenHang: l.tenHang, dvt: l.dvt,
                            tonHT: l.tonHT, thucTe: l.thucTe, chenh: l.chenh,
                            giaVon: l.giaVon, ghiChu: l.ghiChu || '' };
                    })
                };
                var dc = DB.insert('dieuChinhKho', o);
                var k2 = DB.get('kiemKe', kk.id);
                k2.dieuChinhId = dc.id; k2.dieuChinhSo = dc.so; k2.trangThai = 'Đã hoàn tất';
                DB.save(); g.reload(rows()); W.route();
                UI.toast('ok', 'Đã sinh phiếu điều chỉnh ' + dc.so, 'Chuyển sang màn hình Điều chỉnh tồn kho để duyệt.');
                setTimeout(function () { W.go('dieu-chinh-ton'); }, 700);
            }
        });
    }

    /* ------------------------------------------------ IN BIÊN BẢN KIỂM KÊ */
    function inKK(r) {
        if (!qIn) return UI.thieuQuyen(mod, 'in');
        var cty = DB.get('donVi', (T.khoChinh() || {}).donViId) || DB.cty();
        var gt = T.sum(r.lines || [], function (l) { return (Number(l.chenh) || 0) * (Number(l.giaVon) || 0); });
        /* Dùng đúng cấu hình MẪU IN của doanh nghiệp như mọi chứng từ khác:
           phông chữ, cỡ chữ, căn lề, màu nhận diện đều thống nhất. */
        var DDS = W.DDS, CH = T.cauHinhIn(cty);
        W.__C = CH;
        var RG = W.rongVungIn ? W.rongVungIn(true) : 267;
        var h = DDS.dauTrang(cty, CH) +
            DDS.tieuDe({ eyebrow: 'Chứng từ kho', tieu: 'BIÊN BẢN KIỂM KÊ KHO',
                         so: r.so, ngay: T.date(r.ngay) }) +
            DDS.cacBen([
                DDS.the({ nhan: 'Đơn vị kiểm kê', ten: cty.ten, dong: [
                    { k: 'Kho kiểm kê', v: r.kho || khoTen() },
                    { k: 'Nội dung', v: r.lyDo || '' }
                ] }),
                DDS.the({ nhan: 'Ban kiểm kê', ten: '', dong: [
                    { k: 'Người kiểm kê', v: r.nguoiKiem || '' },
                    { k: 'Thành viên', v: r.thanhVien || '' },
                    { k: 'Ngày kiểm kê', v: T.date(r.ngay) }
                ] })
            ]) +
            DDS.bang({ rong: RG, rows: r.lines || [], cot: [
                { k: 'stt', t: 'TT', v: function (l, i) { return String(i + 1); } },
                { k: 'ma', t: 'Mã hàng', v: function (l) { return l.maHang || ''; } },
                { k: 'ten', t: 'Tên hàng hóa', v: function (l) { return l.tenHang || ''; } },
                { k: 'dvt', t: 'ĐVT', v: function (l) { return l.dvt || ''; } },
                { k: 'sl', t: 'Tồn sổ', v: function (l) { return T.num(l.tonHT); } },
                { k: 'sl', t: 'Thực tế', v: function (l) { return T.num(l.thucTe); } },
                { k: 'sl', t: 'Chênh lệch',
                  v: function (l) { return (l.chenh > 0 ? '+' : '') + T.num(l.chenh); } },
                { k: 'gia', t: 'Giá vốn', v: function (l) { return T.money(l.giaVon); } },
                { k: 'tien', t: 'Giá trị lệch',
                  v: function (l) { return T.money((Number(l.chenh) || 0) * (Number(l.giaVon) || 0)); } }
            ] }) +
            DDS.tong([{ k: 'TỔNG CỘNG GIÁ TRỊ CHÊNH LỆCH', v: T.money(gt) + ' đồng', chinh: true }]) +
            DDS.bangChu(Math.abs(gt), 'Bằng chữ:') +
            '<div class="pr-note">Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.' +
            (r.ghiChu ? ' Ghi chú: ' + T.esc(r.ghiChu) : '') + '</div>' +
            DDS.ky([
                { r: 'NGƯỜI KIỂM KÊ', d: '(Ký, ghi rõ họ tên)', t: r.nguoiKiem || '' },
                { r: 'THỦ KHO', d: '(Ký, ghi rõ họ tên)' },
                { r: 'KẾ TOÁN', d: '(Ký, ghi rõ họ tên)' },
                { r: 'GIÁM ĐỐC', d: '(Ký, đóng dấu)' }
            ]) +
            DDS.chanTrang(cty, CH, r.so || '');
        W.__C = null;
        UI.print('<div class="print-sheet landscape"' + W.kieuMau(CH) + '>' + h + '</div>',
                 'Biên bản kiểm kê ' + r.so);
    }
};

/* ==========================================================================
   3. ĐIỀU CHỈNH TỒN KHO
   ========================================================================== */
var NGUYEN_NHAN = ['Sai lệch kiểm kê', 'Hàng hỏng', 'Hàng mất', 'Điều chỉnh kỹ thuật'];
var TT_DC = ['Chờ duyệt', 'Đã duyệt', 'Từ chối'];

S['dieu-chinh-ton'] = function (host) {
    var mod = 'dieuChinhKho';
    var qThem = Q.co(mod, 'them'), qSua = Q.co(mod, 'sua'), qXoa = Q.co(mod, 'xoa'),
        qDuyet = Q.co(mod, 'duyet'), qIn = Q.co(mod, 'in');
    var g;

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Điều chỉnh tồn kho</h2>' +
        '<div class="sub">Mọi thay đổi tồn kho ngoài nhập / xuất đều phải qua phiếu điều chỉnh có lý do và người duyệt</div></div></div>' +
        tabKho('dieu-chinh-ton') +
        '<div class="note r mb12"><i class="bi bi-shield-lock-fill"></i><div>' +
        '<b>Nguyên tắc truy vết:</b> mỗi phiếu bắt buộc ghi rõ <b>lý do</b>, <b>người thực hiện</b>, ' +
        '<b>người duyệt</b> và <b>thời gian</b>. Phiếu <b>đã duyệt không được xóa</b> — nếu sai phải lập phiếu điều chỉnh ngược lại. ' +
        'Toàn bộ thao tác được ghi vào Nhật ký hệ thống.</div></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Kho', 'Điều chỉnh tồn kho']);
    bindTab(host);

    function rows() {
        return DB.all('dieuChinhKho').map(function (d) {
            var o = T.clone(d);
            o._soMa = (d.lines || []).length;
            o._sl = T.sum(d.lines || [], function (l) { return Number(l.chenh) || 0; });
            o._gt = T.sum(d.lines || [], function (l) { return (Number(l.chenh) || 0) * (Number(l.giaVon) || 0); });
            return o;
        });
    }

    var tb = (qThem ? '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Lập phiếu điều chỉnh</button>' : '') +
        '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
        '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn ok" data-duyet disabled><i class="bi bi-check2-circle"></i> Duyệt &amp; áp dụng vào tồn kho</button>' +
        '<button class="btn danger" data-tuchoi disabled><i class="bi bi-x-circle"></i> Từ chối</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>';

    g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: 20, height: 'calc(100vh - 430px)', toolbar: tb,
        sortK: 'ngay', sortD: -1, chon: true, search: ['so', 'lyDo', 'nguyenNhan', 'nguoiThucHien', 'kiemKeSo'],
        emptyTitle: 'Chưa có phiếu điều chỉnh tồn kho',
        emptyText: 'Phiếu điều chỉnh phát sinh từ kiểm kê hoặc do người dùng lập trực tiếp.',
        cols: [
            { k: 'so', t: 'Số phiếu', w: 140, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày', w: 100, fmt: 'date' },
            { k: 'nguyenNhan', t: 'Nguyên nhân', w: 168, r: function (v) {
                return '<span class="pill ' + (v === 'Hàng mất' ? 'r' : v === 'Hàng hỏng' ? 'y' : 'c') + '">' + T.esc(v || '') + '</span>'; } },
            { k: 'lyDo', t: 'Lý do chi tiết', r: function (v) { return '<span class="ellip">' + T.esc(v || '') + '</span>'; } },
            { k: 'kiemKeSo', t: 'Từ kiểm kê', w: 128, cls: 'mono',
              r: function (v) { return v ? T.esc(v) : '<span class="muted">—</span>'; } },
            { k: '_soMa', t: 'Số mã', w: 74, cls: 'num', fmt: 'num' },
            { k: '_sl', t: 'SL điều chỉnh', w: 118, cls: 'num', total: true,
              r: function (v) { return '<span class="' + (v < 0 ? 'neg' : 'pos') + '">' + (v > 0 ? '+' : '') + T.num(v) + '</span>'; } },
            { k: '_gt', t: 'Giá trị điều chỉnh', w: 158, cls: 'num', total: true, an: !Q.co(mod, 'giaVon'),
              r: function (v) { return '<span class="' + (v < 0 ? 'neg' : 'pos') + '">' + T.money(v) + '</span>'; } },
            { k: 'nguoiThucHien', t: 'Người thực hiện', w: 150 },
            { k: 'nguoiDuyet', t: 'Người duyệt', w: 150, r: function (v) { return v ? T.esc(v) : '<span class="muted">chưa duyệt</span>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 128, r: function (v) { return T.pill(v); } }
        ],
        filters: [
            { k: 'trangThai', t: 'Trạng thái', w: 160, opts: TT_DC },
            { k: 'nguyenNhan', t: 'Nguyên nhân', w: 190, opts: NGUYEN_NHAN }
        ],
        actions: function (r) {
            return UI.btn('xem', 'bi-eye', 'Xem phiếu điều chỉnh') +
                (qSua && r.trangThai === 'Chờ duyệt' ? UI.btn('sua', 'bi-pencil', 'Sửa') : '') +
                (qDuyet && r.trangThai === 'Chờ duyệt' ? UI.btn('duyet', 'bi-check2-circle', 'Duyệt') : '');
        }, actionsW: 110,
        onAction: function (a, r) {
            var rec = DB.get('dieuChinhKho', r.id);
            if (a === 'sua') form(rec); else if (a === 'xem') form(rec, true);
            else if (a === 'duyet') duyet(rec); else if (a === 'in') inDC(rec);
        },
        onSelect: UI.chonToolbar(host, ['sua', 'xoa', 'duyet', 'tuchoi', 'in']),
        onOpen: function (r) { form(DB.get('dieuChinhKho', r.id), true); }
    });
    UI.apQuyen(host, mod);
    W.hangLoat(host, g, {
        mod: mod, coll: 'dieuChinhKho', dt: 'Phiếu điều chỉnh', file: 'DanhSach_DieuChinhTonKho', rows: rows,
        excel: xlCols(), email: false, inCT: false,
        suaTruong: [{ k: 'ngay', t: 'Ngày', type: 'date' },
                    { k: 'nguyenNhan', t: 'Nguyên nhân', type: 'select', opts: NGUYEN_NHAN.map(function (x) { return { v: x, t: x }; }) },
                    { k: 'ghiChu', t: 'Ghi chú', type: 'text' }]
    });

    function xlCols() {
        return [{ t: 'Số phiếu', k: 'so', w: 18 }, { t: 'Ngày', k: 'ngay', w: 12 },
                { t: 'Nguyên nhân', k: 'nguyenNhan', w: 20 }, { t: 'Lý do chi tiết', k: 'lyDo', w: 40 },
                { t: 'Từ kiểm kê', k: 'kiemKeSo', w: 16 }, { t: 'Số mã', k: '_soMa', w: 10 },
                { t: 'SL điều chỉnh', k: '_sl', w: 14 }, { t: 'Giá trị điều chỉnh', k: '_gt', w: 20 },
                { t: 'Người thực hiện', k: 'nguoiThucHien', w: 20 }, { t: 'Người duyệt', k: 'nguoiDuyet', w: 20 },
                { t: 'Ngày duyệt', k: 'ngayDuyet', w: 14 }, { t: 'Trạng thái', k: 'trangThai', w: 14 }];
    }

    var qs = function (x) { return host.querySelector(x); };
    if (qs('[data-them]')) qs('[data-them]').onclick = function () { form(null); };
    function chuaDuyet(r, viec) {
        if (r.trangThai === 'Chờ duyệt') return true;
        UI.khongThe(viec, 'Phiếu điều chỉnh ' + r.so + ' đang ở trạng thái “' + r.trangThai + '”.',
            r.trangThai === 'Đã duyệt'
                ? 'Phiếu đã duyệt đã tác động vào tồn kho — lập phiếu điều chỉnh ngược lại để hoàn tác.'
                : 'Chỉ phiếu ở trạng thái “Chờ duyệt” mới thực hiện được thao tác này.');
        return false;
    }
    if (qs('[data-sua]')) qs('[data-sua]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (!chuaDuyet(r, 'Sửa phiếu điều chỉnh')) return;
        form(DB.get('dieuChinhKho', r.id));
    };
    if (qs('[data-duyet]')) qs('[data-duyet]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (!chuaDuyet(r, 'Duyệt phiếu điều chỉnh')) return;
        duyet(DB.get('dieuChinhKho', r.id));
    };
    if (qs('[data-tuchoi]')) qs('[data-tuchoi]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (!chuaDuyet(r, 'Từ chối phiếu điều chỉnh')) return;
        tuChoi(DB.get('dieuChinhKho', r.id));
    };
    if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () {
        var r = g.selected(); if (!r) return;
        UI.xoaChuan({ coll: 'dieuChinhKho', rec: r, mod: mod, ten: 'Phiếu điều chỉnh ' + r.so,
            sauKhi: function () { g.selId = null; g.reload(rows()); W.route(); } });
    };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel('DanhSach_DieuChinhTonKho', 'Điều chỉnh tồn kho', xlCols(), g.allRows);
    };

    /* ------------------------------------------------ DUYỆT / TỪ CHỐI */
    function duyet(r) {
        if (!qDuyet) return UI.thieuQuyen(mod, 'duyet');
        if (r.trangThai !== 'Chờ duyệt') return UI.toast('warn', 'Không hợp lệ', 'Phiếu này không ở trạng thái Chờ duyệt.');
        var gt = T.sum(r.lines || [], function (l) { return (Number(l.chenh) || 0) * (Number(l.giaVon) || 0); });
        UI.modal({
            size: 'lg', title: 'Duyệt phiếu điều chỉnh tồn kho ' + r.so,
            sub: 'Sau khi duyệt, tồn kho sẽ thay đổi ngay và ghi vào thẻ kho',
            body: '<div class="note y mb12"><i class="bi bi-exclamation-triangle"></i><div>' +
                'Phiếu này sẽ thay đổi tồn kho của <b>' + (r.lines || []).length + ' mã hàng</b>, ' +
                'giá trị <b>' + T.money(gt) + ' đ</b>. <b>Sau khi duyệt không được phép xóa.</b></div></div>' +
                '<div class="grid2 mb12">' +
                '<div class="fld"><label>Người duyệt <b class="req">*</b></label><div id="cbD"></div></div>' +
                '<div class="fld"><label>Thời gian duyệt</label><input value="' + T.now() + '" readonly></div>' +
                '</div>' +
                '<div class="fld mb12"><label>Ý kiến của người duyệt</label><input data-f="yKien" placeholder="Ghi chú khi duyệt (không bắt buộc)"></div>' +
                '<div class="tablewrap" style="max-height:300px"><table class="grid"><thead><tr>' +
                '<th style="width:140px">Mã hàng</th><th>Tên hàng hóa</th>' +
                '<th class="num" style="width:90px">Tồn hiện tại</th><th class="num" style="width:96px">Điều chỉnh</th>' +
                '<th class="num" style="width:96px">Tồn sau duyệt</th></tr></thead><tbody>' +
                (r.lines || []).map(function (l) {
                    var hh = T.hh(l) || {};
                    var t0 = Number(hh.ton) || 0, ch = Number(l.chenh) || 0;
                    return '<tr><td class="mono">' + T.esc(l.maHang) + '</td>' +
                        '<td><span class="ellip">' + T.esc(l.tenHang) + '</span></td>' +
                        '<td class="num">' + T.num(t0) + '</td>' +
                        '<td class="num ' + (ch < 0 ? 'neg' : 'pos') + '"><b>' + (ch > 0 ? '+' : '') + T.num(ch) + '</b></td>' +
                        '<td class="num"><b>' + T.num(t0 + ch) + '</b></td></tr>';
                }).join('') + '</tbody></table></div>',
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Duyệt & áp dụng vào tồn kho', cls: 'ok', icon: 'bi-check2-circle', click: function (h) {
                    if (!r.nguoiDuyetId) return UI.toast('err', 'Thiếu người duyệt', 'Bắt buộc phải ghi rõ người duyệt.');
                    r.yKienDuyet = h.q('[data-f="yKien"]').value || '';
                    r.gioDuyet = T.now();
                    T.ghiDieuChinh(r);
                    h.close(); g.reload(rows()); W.route();
                    UI.toast('ok', 'Đã duyệt phiếu ' + r.so, 'Tồn kho đã cập nhật và ghi vào thẻ kho.');
                } }
            ],
            onOpen: function (h) {
                UI.combo('#cbD', {
                    items: DB.all('nhanVien').filter(function (n) { return n.trangThai !== 'Khóa'; })
                        .map(function (n) { return { v: n.id, t: n.hoTen, s: n.chucVu || '' }; }),
                    value: nvId(), placeholder: '— Chọn người duyệt —',
                    onChange: function (v) { r.nguoiDuyetId = v; r.nguoiDuyet = (DB.get('nhanVien', v) || {}).hoTen || ''; }
                });
                r.nguoiDuyetId = nvId(); r.nguoiDuyet = nvTen();
            }
        });
    }
    function tuChoi(r) {
        if (!qDuyet) return UI.thieuQuyen(mod, 'duyet');
        UI.confirm({
            title: 'Từ chối phiếu điều chỉnh', icon: 'bi-x-circle', danger: true,
            message: 'Từ chối phiếu <b>' + T.esc(r.so) + '</b>?',
            note: 'Tồn kho <b>không</b> thay đổi. Phiếu vẫn được lưu để truy vết.',
            okText: 'Từ chối', ok: function () {
                r.trangThai = 'Từ chối'; r.nguoiDuyetId = nvId(); r.nguoiDuyet = nvTen(); r.ngayDuyet = T.today();
                DB.log('Từ chối điều chỉnh tồn kho', 'dieuChinhKho', r); DB.save();
                g.reload(rows()); W.route(); UI.toast('ok', 'Đã từ chối phiếu ' + r.so);
            }
        });
    }

    /* ------------------------------------------------ PHIẾU ĐIỀU CHỈNH */
    function form(r, chiXem) {
        var moi = !r;
        if (moi && !qThem) return UI.thieuQuyen(mod, 'them');
        if (!moi && !chiXem) {
            if (!qSua) return UI.thieuQuyen(mod, 'sua');
            if (r.trangThai === 'Đã duyệt')
                return UI.toast('err', 'Không sửa được', 'Phiếu đã duyệt — hãy lập phiếu điều chỉnh ngược lại nếu sai.');
        }
        r = r ? T.clone(r) : {
            so: DB.soMoi('DC'), ngay: T.today(), khoId: khoId(), kho: khoTen(),
            nguyenNhan: 'Điều chỉnh kỹ thuật', lyDo: '', kiemKeId: '', kiemKeSo: '',
            nguoiThucHienId: nvId(), nguoiThucHien: nvTen(),
            nguoiDuyetId: '', nguoiDuyet: '', ngayDuyet: '',
            trangThai: 'Chờ duyệt', ghiChu: '', lines: []
        };
        var lines = T.clone(r.lines || []);

        UI.modal({
            size: 'full', title: (moi ? 'Lập phiếu điều chỉnh tồn kho' : (chiXem ? 'Phiếu điều chỉnh ' : 'Sửa phiếu điều chỉnh ') + r.so),
            sub: khoTen() + (r.kiemKeSo ? ' — sinh từ biên bản kiểm kê ' + r.kiemKeSo : ''),
            body:
            '<div class="grid4 mb12">' +
            '<div class="fld"><label>Số phiếu</label><input data-f="so" value="' + T.esc(r.so) + '" readonly></div>' +
            '<div class="fld"><label>Ngày điều chỉnh <b class="req">*</b></label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            '<div class="fld"><label>Nguyên nhân <b class="req">*</b></label><select data-f="nguyenNhan">' +
                opt(NGUYEN_NHAN.map(function (x) { return { v: x, t: x }; }), r.nguyenNhan) + '</select></div>' +
            '<div class="fld"><label>Kho</label><input value="' + T.esc(khoTen()) + '" readonly></div>' +
            '</div>' +
            '<div class="grid3 mb12">' +
            '<div class="fld" style="grid-column:span 2"><label>Lý do chi tiết <b class="req">*</b></label>' +
            '<input data-f="lyDo" value="' + T.esc(r.lyDo || '') + '" placeholder="Bắt buộc ghi rõ lý do điều chỉnh"></div>' +
            '<div class="fld"><label>Người thực hiện <b class="req">*</b></label><div id="cbTH"></div></div>' +
            '</div>' +
            '<div class="card mb12"><div class="card-h"><i class="bi bi-sliders2"></i> Chi tiết điều chỉnh' +
            '<span class="spacer"></span>' +
            (chiXem ? '' : '<button class="btn sm primary" data-add><i class="bi bi-plus-lg"></i> Thêm mã hàng</button>') +
            '</div><div class="tablewrap" style="max-height:calc(100vh - 520px)"><div id="bangDC"></div></div></div>' +
            '<div class="grid4" id="tongDC"></div>' +
            '<div class="fld mt12"><label>Ghi chú</label><input data-f="ghiChu" value="' + T.esc(r.ghiChu || '') + '"></div>',
            buttons: chiXem
                ? [{ text: 'Đóng', click: function (h) { h.close(); } }]
                    .concat(qIn && r.id ? [{ text: 'Xem trước khi in', cls: 'primary', icon: 'bi-printer',
                        click: function () { inDC(DB.get('dieuChinhKho', r.id) || r); } }] : [])
                : [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Lưu phiếu (chờ duyệt)', cls: 'primary', icon: 'bi-check-lg', click: function (h) { luu(h); } }
            ],
            onOpen: function (h) {
                UI.combo('#cbTH', {
                    items: DB.all('nhanVien').filter(function (n) { return n.trangThai !== 'Khóa'; })
                        .map(function (n) { return { v: n.id, t: n.hoTen, s: n.chucVu || '' }; }),
                    value: r.nguoiThucHienId, placeholder: '— Chọn nhân viên —',
                    onChange: function (v) { r.nguoiThucHienId = v; r.nguoiThucHien = (DB.get('nhanVien', v) || {}).hoTen || ''; }
                });
                if (!chiXem) h.q('[data-add]').onclick = function () { themMa(h); };
                veBang(h);
            }
        });

        function themMa(h) {
            var co = {}; lines.forEach(function (l) { co[T.idDong(l)] = 1; });
            UI.modal({
                size: 'lg', title: 'Chọn mã hàng cần điều chỉnh',
                body: '<div class="fld mb12"><label>Hàng hóa</label><div id="cbHH"></div></div>' +
                    '<div id="ttHH" class="note b"><i class="bi bi-info-circle"></i><div>Chọn một mã hàng để xem tồn hiện tại.</div></div>',
                buttons: [{ text: 'Hủy', click: function (x) { x.close(); } },
                    { text: 'Thêm vào phiếu', cls: 'primary', icon: 'bi-plus-lg', click: function (x) {
                        if (!x._ma) return UI.toast('err', 'Chưa chọn hàng hóa');
                        var hh = DB.get('hangHoa', x._ma);
                        if (!hh) return;
                        if (co[hh.id]) return UI.toast('warn', 'Đã có trong phiếu', hh.ma + ' đã nằm trong danh sách điều chỉnh.');
                        var t0 = Number(hh.ton) || 0;
                        lines.push({ hangHoaId: hh.id, maHang: hh.ma, tenHang: hh.ten, dvt: hh.dvt, tonHT: t0,
                            thucTe: t0, chenh: 0, giaVon: T.giaVonBQ(hh), ghiChu: '' });
                        x.close(); veBang(h);
                    } }],
                onOpen: function (x) {
                    UI.combo('#cbHH', {
                        items: DB.all('hangHoa').map(function (y) {
                            return { v: y.id, t: y.ma + ' — ' + y.ten,
                                     s: [y.model, y.nhom, y.hang].filter(Boolean).join(' · ') }; }),
                        placeholder: '— Gõ mã, model hoặc tên hàng —',
                        onChange: function (v) {
                            x._ma = v;
                            var hh = DB.get('hangHoa', v) || {};
                            x.q('#ttHH').innerHTML = '<i class="bi bi-box-seam"></i><div><b>' + T.esc(hh.ten || '') + '</b><br>' +
                                'Tồn hiện tại: <b>' + T.num(hh.ton) + '</b> ' + T.esc(hh.dvt || '') +
                                ' &nbsp;•&nbsp; Giá vốn bình quân: <b>' + T.money(T.giaVonBQ(v)) + ' đ</b></div>';
                        }
                    });
                }
            });
        }

        function veBang(h) {
            var ro = chiXem ? ' readonly' : '';
            h.q('#bangDC').innerHTML = !lines.length
                ? '<div class="empty" style="padding:36px"><i class="bi bi-sliders2"></i><b>Chưa có mã hàng nào</b>Bấm “Thêm mã hàng” để chọn hàng cần điều chỉnh.</div>'
                : '<table class="grid lines-tb"><thead><tr>' +
                '<th style="width:42px">TT</th><th style="width:150px">Mã hàng</th><th>Tên hàng hóa</th>' +
                '<th style="width:70px">ĐVT</th><th class="num" style="width:104px">Tồn hiện tại</th>' +
                '<th class="num" style="width:118px">Tồn sau điều chỉnh</th><th class="num" style="width:104px">Chênh lệch</th>' +
                '<th class="num" style="width:126px">Giá vốn BQ</th><th class="num" style="width:140px">Giá trị</th>' +
                '<th style="width:180px">Ghi chú dòng</th>' + (chiXem ? '' : '<th style="width:42px"></th>') + '</tr></thead><tbody>' +
                lines.map(function (l, i) {
                    var ch = (Number(l.thucTe) || 0) - (Number(l.tonHT) || 0);
                    l.chenh = ch;
                    return '<tr data-i="' + i + '"><td class="ctr muted">' + (i + 1) + '</td>' +
                        '<td class="mono">' + T.esc(l.maHang) + '</td>' +
                        '<td><span class="ellip">' + T.esc(l.tenHang) + '</span></td>' +
                        '<td>' + T.esc(l.dvt || '') + '</td>' +
                        '<td class="num">' + T.num(l.tonHT) + '</td>' +
                        '<td class="num"><input class="num sl" data-l="thucTe" value="' + T.esc(T.soVe(l.thucTe, 2)) + '"' + ro + '></td>' +
                        '<td class="num ' + (ch < 0 ? 'neg' : ch > 0 ? 'pos' : 'muted') + '"><b>' + (ch > 0 ? '+' : '') + T.num(ch) + '</b></td>' +
                        '<td class="num">' + T.money(l.giaVon) + '</td>' +
                        '<td class="num ' + (ch < 0 ? 'neg' : ch > 0 ? 'pos' : 'muted') + '">' + T.money(ch * (Number(l.giaVon) || 0)) + '</td>' +
                        '<td><input data-l="ghiChu" value="' + T.esc(l.ghiChu || '') + '"' + ro + ' placeholder="Vd: vỡ vỏ, mất trong vận chuyển"></td>' +
                        (chiXem ? '' : '<td class="ctr"><button class="btn btn-ico sm danger" data-del title="Bỏ dòng"><i class="bi bi-x-lg"></i></button></td>') +
                        '</tr>';
                }).join('') + '</tbody></table>';

            h.q('#bangDC').querySelectorAll('tr[data-i]').forEach(function (tr) {
                var i = Number(tr.getAttribute('data-i'));
                tr.querySelectorAll('[data-l]').forEach(function (inp) {
                    inp.oninput = function () {
                        var k = inp.getAttribute('data-l');
                        lines[i][k] = k === 'thucTe' ? T.so(inp.value) : inp.value;
                    };
                    inp.onblur = function () { if (inp.getAttribute('data-l') === 'thucTe') veBang(h); };
                });
                var d = tr.querySelector('[data-del]');
                if (d) d.onclick = function () { lines.splice(i, 1); veBang(h); };
            });
            veTongDC(h);
        }
        function veTongDC(h) {
            var tang = lines.filter(function (l) { return Number(l.chenh) > 0; });
            var giam = lines.filter(function (l) { return Number(l.chenh) < 0; });
            var gt = T.sum(lines, function (l) { return (Number(l.chenh) || 0) * (Number(l.giaVon) || 0); });
            h.q('#tongDC').innerHTML =
                kp('Số mã điều chỉnh', T.num(lines.length, 0)) +
                kp('Tăng tồn', '+' + T.num(T.sum(tang, function (l) { return l.chenh; }), 0), tang.length + ' mã', tang.length ? 'g' : '') +
                kp('Giảm tồn', T.num(T.sum(giam, function (l) { return l.chenh; }), 0), giam.length + ' mã', giam.length ? 'r' : '') +
                kp('Giá trị điều chỉnh', T.money(gt) + ' đ', 'theo giá vốn bình quân', gt < 0 ? 'r' : gt > 0 ? 'g' : '');
        }

        function luu(h) {
            var v = UI.read(h.el);
            if (!v.ngay) return UI.toast('err', 'Thiếu thông tin', 'Chưa chọn ngày điều chỉnh.');
            if (!v.lyDo) return UI.toast('err', 'Bắt buộc ghi lý do', 'Mọi phiếu điều chỉnh tồn kho đều phải ghi rõ lý do.');
            if (!r.nguoiThucHienId) return UI.toast('err', 'Thiếu người thực hiện', 'Bắt buộc phải ghi rõ người thực hiện.');
            if (!lines.length) return UI.toast('err', 'Chưa có mã hàng', 'Hãy thêm ít nhất một mã hàng cần điều chỉnh.');
            lines.forEach(function (l) { l.chenh = (Number(l.thucTe) || 0) - (Number(l.tonHT) || 0); });
            if (!lines.some(function (l) { return l.chenh; }))
                return UI.toast('warn', 'Không có chênh lệch', 'Tất cả các dòng đều bằng tồn hiện tại — không cần điều chỉnh.');
            var o = {
                so: r.so, ngay: v.ngay, khoId: khoId(), kho: khoTen(),
                nguyenNhan: v.nguyenNhan, lyDo: v.lyDo,
                kiemKeId: r.kiemKeId || '', kiemKeSo: r.kiemKeSo || '',
                nguoiThucHienId: r.nguoiThucHienId, nguoiThucHien: r.nguoiThucHien,
                nguoiDuyetId: r.nguoiDuyetId || '', nguoiDuyet: r.nguoiDuyet || '', ngayDuyet: r.ngayDuyet || '',
                trangThai: 'Chờ duyệt', ghiChu: v.ghiChu || '',
                lines: lines.filter(function (l) { return Number(l.chenh); })
            };
            var rec = moi ? DB.insert('dieuChinhKho', o) : DB.update('dieuChinhKho', r.id, o);
            h.close(); g.reload(rows()); W.route();
            UI.toast('ok', moi ? 'Đã lập phiếu điều chỉnh' : 'Đã lưu phiếu điều chỉnh',
                rec.so + ' — chờ duyệt, tồn kho chưa thay đổi.');
        }
    }

    /* ------------------------------------------------ IN PHIẾU ĐIỀU CHỈNH */
    function inDC(r) {
        if (!qIn) return UI.thieuQuyen(mod, 'in');
        var cty = DB.get('donVi', (T.khoChinh() || {}).donViId) || DB.cty();
        var gt = T.sum(r.lines || [], function (l) { return (Number(l.chenh) || 0) * (Number(l.giaVon) || 0); });
        /* Dùng đúng cấu hình MẪU IN của doanh nghiệp như mọi chứng từ khác:
           phông chữ, cỡ chữ, căn lề, màu nhận diện đều thống nhất. */
        var DDS = W.DDS, CH = T.cauHinhIn(cty);
        W.__C = CH;
        var RG = W.rongVungIn ? W.rongVungIn(true) : 267;
        var h = DDS.dauTrang(cty, CH) +
            DDS.tieuDe({ eyebrow: 'Chứng từ kho', tieu: 'PHIẾU ĐIỀU CHỈNH TỒN KHO',
                         so: r.so, ngay: T.date(r.ngay),
                         ref: [r.kiemKeSo ? 'Theo biên bản kiểm kê ' + r.kiemKeSo : ''] }) +
            DDS.cacBen([
                DDS.the({ nhan: 'Đơn vị điều chỉnh', ten: cty.ten, dong: [
                    { k: 'Kho', v: r.kho || khoTen() },
                    { k: 'Nguyên nhân', v: r.nguyenNhan || '' },
                    { k: 'Lý do chi tiết', v: r.lyDo || '' }
                ] }),
                DDS.the({ nhan: 'Trách nhiệm', ten: '', dong: [
                    { k: 'Người thực hiện', v: r.nguoiThucHien || '' },
                    { k: 'Người duyệt', v: r.nguoiDuyet || 'chưa duyệt' },
                    { k: 'Ngày duyệt', v: r.ngayDuyet ? T.date(r.ngayDuyet) : '' }
                ] })
            ]) +
            DDS.bang({ rong: RG, rows: r.lines || [], cot: [
                { k: 'stt', t: 'TT', v: function (l, i) { return String(i + 1); } },
                { k: 'ma', t: 'Mã hàng', v: function (l) { return l.maHang || ''; } },
                { k: 'ten', t: 'Tên hàng hóa', v: function (l) { return l.tenHang || ''; },
                  h: function (l) {
                      return T.esc(l.tenHang || '') +
                          (l.ghiChu ? '<div class="p">' + T.esc(l.ghiChu) + '</div>' : '');
                  } },
                { k: 'dvt', t: 'ĐVT', v: function (l) { return l.dvt || ''; } },
                { k: 'sl', t: 'Tồn trước', v: function (l) { return T.num(l.tonHT); } },
                { k: 'sl', t: 'Tồn sau', v: function (l) { return T.num(l.thucTe); } },
                { k: 'sl', t: 'Chênh lệch',
                  v: function (l) { return (l.chenh > 0 ? '+' : '') + T.num(l.chenh); } },
                { k: 'gia', t: 'Giá vốn', v: function (l) { return T.money(l.giaVon); } },
                { k: 'tien', t: 'Giá trị',
                  v: function (l) { return T.money((Number(l.chenh) || 0) * (Number(l.giaVon) || 0)); } }
            ] }) +
            DDS.tong([{ k: 'TỔNG CỘNG GIÁ TRỊ ĐIỀU CHỈNH', v: T.money(gt) + ' đồng', chinh: true }]) +
            DDS.bangChu(Math.abs(gt), 'Bằng chữ:') +
            (r.ghiChu ? '<div class="pr-note">Ghi chú: ' + T.esc(r.ghiChu) + '</div>' : '') +
            DDS.ky([
                { r: 'NGƯỜI THỰC HIỆN', d: '(Ký, ghi rõ họ tên)', t: r.nguoiThucHien || '' },
                { r: 'THỦ KHO', d: '(Ký, ghi rõ họ tên)' },
                { r: 'KẾ TOÁN TRƯỞNG', d: '(Ký, ghi rõ họ tên)' },
                { r: 'NGƯỜI DUYỆT', d: '(Ký, đóng dấu)', t: r.nguoiDuyet || '' }
            ]) +
            DDS.chanTrang(cty, CH, r.so || '');
        W.__C = null;
        UI.print('<div class="print-sheet landscape"' + W.kieuMau(CH) + '>' + h + '</div>',
                 'Phiếu điều chỉnh tồn kho ' + r.so);
    }
};

/* ==========================================================================
   4. BÁO CÁO TỒN KHO
   ========================================================================== */
S['bao-cao-ton'] = function (host) {
    var mod = 'baoCaoTon';
    var qGV = Q.co(mod, 'giaVon');
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Báo cáo tồn kho</h2>' +
        '<div class="sub">Tồn kho hiện tại của ' + T.esc(khoTen()) + ' theo giá vốn bình quân gia quyền di động</div></div></div>' +
        tabKho('bao-cao-ton') +
        '<div id="kpi" class="kpis mb12"></div><div id="gh"></div></div>';
    W.crumb(['Kho', 'Báo cáo tồn kho']);
    bindTab(host);

    function rows() {
        return DB.all('hangHoa').map(function (h) {
            var bq = T.giaVonBQ(h);
            return { id: h.id, ma: h.ma, ten: h.ten, dvt: h.dvt, nhom: h.nhom || '',
                thuongHieu: thuongHieu(h), nhaSX: nhaSX(h),
                ncc: h.nhaCungCap || h.nccTen || '',
                ton: Number(h.ton) || 0, bq: bq,
                giaTri: Math.round((Number(h.ton) || 0) * bq) };
        });
    }
    var all = rows();
    host.querySelector('#kpi').innerHTML =
        kp('Số mã hàng', T.num(all.length, 0), 'trong danh mục') +
        kp('Số mã còn tồn', T.num(all.filter(function (x) { return x.ton > 0; }).length, 0), '', 'c') +
        kp('Tổng số lượng tồn', T.num(T.sum(all, function (x) { return x.ton; }), 0), '') +
        kp('Tổng giá trị tồn kho', T.money(T.sum(all, function (x) { return x.giaTri; })) + ' đ', 'theo giá vốn bình quân', 'g');

    var g = new UI.Grid({
        mount: '#gh', rows: all, pageSize: 25, height: 'calc(100vh - 440px)',
        search: ['ma', 'ten', 'nhom', 'thuongHieu', 'nhaSX', 'ncc'], sortK: 'giaTri', sortD: -1,
        toolbar: '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
            '<button class="btn primary" data-in title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel"><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>' +
            '<span class="tb-sep"></span><span class="small muted">Bấm vào một dòng rồi chọn <b>Thẻ kho</b> để xem toàn bộ lịch sử của mã hàng đó</span>',
        filters: [
            { k: 'nhom', t: 'Nhóm hàng', w: 190, opts: duyNhat(function (h) { return h.nhom; }) },
            { k: 'thuongHieu', t: 'Thương hiệu', w: 170, opts: duyNhat(thuongHieu) },
            { k: 'nhaSX', t: 'Nhà sản xuất', w: 170, opts: duyNhat(nhaSX) },
            { k: '_t', t: 'Tình trạng', w: 150, opts: [{ v: 'con', t: 'Còn tồn' }, { v: 'het', t: 'Hết hàng' }, { v: 'am', t: 'Tồn âm' }],
              test: function (x, v) { return v === 'con' ? x.ton > 0 : v === 'het' ? x.ton === 0 : x.ton < 0; } }
        ],
        cols: [
            { k: 'ma', t: 'Mã hàng', w: 158, cls: 'mono' },
            { k: 'ten', t: 'Tên hàng hóa', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
            { k: 'dvt', t: 'ĐVT', w: 76 },
            { k: 'nhom', t: 'Nhóm hàng', w: 160 },
            { k: 'thuongHieu', t: 'Thương hiệu', w: 130 },
            { k: 'ton', t: 'Tồn hiện tại', w: 110, cls: 'num', total: true,
              r: function (v) { return '<b class="' + (v < 0 ? 'neg' : v === 0 ? 'muted' : '') + '">' + T.num(v) + '</b>'; } },
            { k: 'bq', t: 'Giá vốn bình quân', w: 156, cls: 'num', fmt: 'money', an: !qGV },
            { k: 'giaTri', t: 'Giá trị tồn kho', w: 158, cls: 'num', fmt: 'money', total: true, an: !qGV }
        ],
        actions: function () { return UI.btn('the', 'bi-clock-history', 'Xem thẻ kho của mã hàng này'); }, actionsW: 60,
        onAction: function (a, r) { W.theKhoCuaMa(r.ma); },
        onOpen: function (r) { W.theKhoCuaMa(r.ma); }
    });
    UI.apQuyen(host, mod);

    var qs = function (x) { return host.querySelector(x); };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel('BaoCao_TonKho', 'Tồn kho', [
            { t: 'Mã hàng', k: 'ma', w: 20 }, { t: 'Tên hàng hóa', k: 'ten', w: 50 },
            { t: 'ĐVT', k: 'dvt', w: 10 }, { t: 'Nhóm hàng', k: 'nhom', w: 22 },
            { t: 'Thương hiệu', k: 'thuongHieu', w: 18 }, { t: 'Nhà sản xuất', k: 'nhaSX', w: 20 },
            { t: 'Tồn hiện tại', k: 'ton', w: 14 }, { t: 'Giá vốn bình quân', k: 'bq', w: 18 },
            { t: 'Giá trị tồn kho', k: 'giaTri', w: 20 }], g.allRows);
    };
    if (qs('[data-in]')) qs('[data-in]').onclick = function () {
        W.inBaoCao({
            tieu: 'BÁO CÁO TỒN KHO', phu: khoTen(), thoiDiem: T.today(),
            cty: DB.get('donVi', (T.khoChinh() || {}).donViId) || DB.cty(),
            dieuKien: [
                { t: 'Kho', v: khoTen() },
                { t: 'Nhóm hàng', v: (g.f || {}).nhom || 'Tất cả nhóm hàng' },
                { t: 'Nhà sản xuất', v: (g.f || {}).nhaSX || 'Tất cả' },
                { t: 'Thương hiệu', v: (g.f || {}).thuongHieu || 'Tất cả' },
                { t: 'Từ khóa tìm kiếm', v: g.q || '' }
            ],
            cols: [
                { t: 'Mã hàng', k: 'ma', w: 30 }, { t: 'Tên hàng hóa', k: 'ten' },
                { t: 'ĐVT', k: 'dvt', w: 14, cls: 'c' }, { t: 'Nhóm hàng', k: 'nhom', w: 34 },
                { t: 'Tồn', k: 'ton', w: 20, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return T.num(v); } },
                { t: 'Giá vốn bình quân', k: 'bq', w: 28, cls: 'n', an: !qGV,
                  r: function (v) { return T.money(v); } },
                { t: 'Giá trị tồn', k: 'giaTri', w: 30, cls: 'n', tong: true, an: !qGV,
                  r: function (v) { return T.money(v); } }
            ],
            rows: g.allRows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'THỦ KHO'
        });
    };
};

/* ==========================================================================
   5. BÁO CÁO NHẬP - XUẤT - TỒN
   ========================================================================== */
S['bao-cao-nxt'] = function (host) {
    var mod = 'baoCaoNXT';
    var qGV = Q.co(mod, 'giaVon');
    var nam = new Date().getFullYear();
    var f = { tu: nam + '-01-01', den: T.today(), nhom: '', th: '' };

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Báo cáo Nhập - Xuất - Tồn</h2>' +
        '<div class="sub">Tồn đầu kỳ · Nhập trong kỳ · Xuất trong kỳ · Tồn cuối kỳ — cả số lượng và giá trị</div></div></div>' +
        tabKho('bao-cao-nxt') +
        '<div class="card mb12"><div class="card-h"><i class="bi bi-calendar-range"></i> Kỳ báo cáo</div>' +
        '<div class="card-b"><div class="grid5">' +
        '<div class="fld"><label>Từ ngày</label><input type="date" data-f="tu" value="' + f.tu + '"></div>' +
        '<div class="fld"><label>Đến ngày</label><input type="date" data-f="den" value="' + f.den + '"></div>' +
        '<div class="fld"><label>Nhóm hàng</label><select data-f="nhom"><option value="">— Tất cả —</option>' +
        duyNhat(function (h) { return h.nhom; }).map(function (x) { return '<option>' + T.esc(x) + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld"><label>Thương hiệu</label><select data-f="th"><option value="">— Tất cả —</option>' +
        duyNhat(thuongHieu).map(function (x) { return '<option>' + T.esc(x) + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld"><label>&nbsp;</label><div class="row">' +
        '<button class="btn primary" data-loc><i class="bi bi-search"></i> Xem báo cáo</button>' +
        '<button class="btn" data-thang><i class="bi bi-calendar-month"></i> Tháng này</button>' +
        '</div></div></div></div></div>' +
        '<div id="kpi" class="kpis mb12"></div><div id="gh"></div></div>';
    W.crumb(['Kho', 'Báo cáo Nhập - Xuất - Tồn']);
    bindTab(host);

    var g = null;
    function doc() {
        host.querySelectorAll('[data-f]').forEach(function (e) { f[e.getAttribute('data-f')] = e.value; });
    }
    function duLieu() {
        return T.nxt(f.tu, f.den).filter(function (r) {
            if (f.nhom && r.nhomHang !== f.nhom) return false;
            if (f.th && r.thuongHieu !== f.th) return false;
            return true;
        });
    }
    function ve() {
        var d = duLieu();
        host.querySelector('#kpi').innerHTML =
            kp('Kỳ báo cáo', T.date(f.tu) + ' → ' + T.date(f.den), d.length + ' mã hàng') +
            kp('Tồn đầu kỳ', T.num(T.sum(d, function (r) { return r.slDau; }), 0), T.money(T.sum(d, function (r) { return r.gtDau; })) + ' đ') +
            kp('Nhập trong kỳ', '+' + T.num(T.sum(d, function (r) { return r.slNhap; }), 0), T.money(T.sum(d, function (r) { return r.gtNhap; })) + ' đ', 'g') +
            kp('Xuất trong kỳ', '−' + T.num(T.sum(d, function (r) { return r.slXuat; }), 0), T.money(T.sum(d, function (r) { return r.gtXuat; })) + ' đ', 'c') +
            kp('Tồn cuối kỳ', T.num(T.sum(d, function (r) { return r.slCuoi; }), 0), T.money(T.sum(d, function (r) { return r.gtCuoi; })) + ' đ', 'b');

        var cols = [
            { k: 'ma', t: 'Mã hàng', w: 150, cls: 'mono' },
            { k: 'ten', t: 'Tên hàng hóa', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
            { k: 'dvt', t: 'ĐVT', w: 66 },
            { k: 'slDau', t: 'Tồn đầu — SL', w: 108, cls: 'num', fmt: 'num', total: true },
            { k: 'gtDau', t: 'Tồn đầu — Giá trị', w: 138, cls: 'num', fmt: 'money', total: true, an: !qGV },
            { k: 'slNhap', t: 'Nhập — SL', w: 100, cls: 'num', total: true,
              r: function (v) { return v ? '<span class="pos">+' + T.num(v) + '</span>' : '<span class="muted">0</span>'; } },
            { k: 'gtNhap', t: 'Nhập — Giá trị', w: 136, cls: 'num', fmt: 'money', total: true, an: !qGV },
            { k: 'slXuat', t: 'Xuất — SL', w: 100, cls: 'num', total: true,
              r: function (v) { return v ? '<span class="neg">−' + T.num(v) + '</span>' : '<span class="muted">0</span>'; } },
            { k: 'gtXuat', t: 'Xuất — Giá trị', w: 136, cls: 'num', fmt: 'money', total: true, an: !qGV },
            { k: 'slCuoi', t: 'Tồn cuối — SL', w: 112, cls: 'num', total: true,
              r: function (v) { return '<b>' + T.num(v) + '</b>'; } },
            { k: 'gtCuoi', t: 'Tồn cuối — Giá trị', w: 144, cls: 'num', fmt: 'money', total: true, an: !qGV }
        ];
        g = new UI.Grid({
            mount: '#gh', rows: d, pageSize: 25, height: 'calc(100vh - 470px)',
            search: ['ma', 'ten', 'nhomHang'], sortK: 'gtCuoi', sortD: -1,
            toolbar: '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
                '<button class="btn primary" data-in title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel"><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>' +
                '<span class="tb-sep"></span>' +
                '<label class="chk"><input type="checkbox" data-ps> <span>Chỉ hiện mã có phát sinh trong kỳ</span></label>',
            cols: cols,
            actions: function () { return UI.btn('the', 'bi-clock-history', 'Xem thẻ kho'); }, actionsW: 60,
            onAction: function (a, r) { W.theKhoCuaMa(r.ma); },
            onOpen: function (r) { W.theKhoCuaMa(r.ma); }
        });
        var ps = host.querySelector('[data-ps]');
        if (ps) ps.onchange = function () {
            g.reload(ps.checked ? d.filter(function (r) { return r.slNhap || r.slXuat; }) : d);
        };
        var bx = host.querySelector('[data-xuat]');
        if (bx) bx.onclick = function () {
            UI.xuatExcel('BaoCao_NhapXuatTon_' + f.tu + '_' + f.den, 'Nhập - Xuất - Tồn', [
                { t: 'Mã hàng', k: 'ma', w: 20 }, { t: 'Tên hàng hóa', k: 'ten', w: 48 },
                { t: 'ĐVT', k: 'dvt', w: 9 }, { t: 'Nhóm hàng', k: 'nhomHang', w: 20 },
                { t: 'Tồn đầu — SL', k: 'slDau', w: 13 }, { t: 'Tồn đầu — Giá trị', k: 'gtDau', w: 18 },
                { t: 'Nhập — SL', k: 'slNhap', w: 12 }, { t: 'Nhập — Giá trị', k: 'gtNhap', w: 18 },
                { t: 'Xuất — SL', k: 'slXuat', w: 12 }, { t: 'Xuất — Giá trị', k: 'gtXuat', w: 18 },
                { t: 'Tồn cuối — SL', k: 'slCuoi', w: 13 }, { t: 'Tồn cuối — Giá trị', k: 'gtCuoi', w: 18 }
            ], g.allRows);
        };
        var bi = host.querySelector('[data-in]');
        if (bi) bi.onclick = function () { inNXT(g.allRows); };
        UI.apQuyen(host, mod);
    }
    function inNXT(d) {
        W.inBaoCao({
            tieu: 'BÁO CÁO NHẬP - XUẤT - TỒN', phu: khoTen(), tu: f.tu, den: f.den,
            cty: DB.get('donVi', (T.khoChinh() || {}).donViId) || DB.cty(),
            dieuKien: [
                { t: 'Kho', v: khoTen() },
                { t: 'Nhóm hàng', v: f.nhom || 'Tất cả nhóm hàng' },
                { t: 'Thương hiệu', v: f.th || 'Tất cả' }
            ],
            cols: [
                { t: 'Mã hàng', k: 'ma', w: 28 }, { t: 'Tên hàng hóa', k: 'ten' },
                { t: 'ĐVT', k: 'dvt', w: 12, cls: 'c' },
                { t: 'Tồn đầu — SL', k: 'slDau', w: 16, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return T.num(v); } },
                { t: 'Tồn đầu — Giá trị', k: 'gtDau', w: 24, cls: 'n', tong: true, an: !qGV,
                  r: function (v) { return T.money(v); } },
                { t: 'Nhập — SL', k: 'slNhap', w: 16, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return T.num(v); } },
                { t: 'Nhập — Giá trị', k: 'gtNhap', w: 24, cls: 'n', tong: true, an: !qGV,
                  r: function (v) { return T.money(v); } },
                { t: 'Xuất — SL', k: 'slXuat', w: 16, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return T.num(v); } },
                { t: 'Xuất — Giá trị', k: 'gtXuat', w: 24, cls: 'n', tong: true, an: !qGV,
                  r: function (v) { return T.money(v); } },
                { t: 'Tồn cuối — SL', k: 'slCuoi', w: 16, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return T.num(v); } },
                { t: 'Tồn cuối — Giá trị', k: 'gtCuoi', w: 24, cls: 'n', tong: true, an: !qGV,
                  r: function (v) { return T.money(v); } }
            ],
            rows: d, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'KẾ TOÁN TRƯỞNG'
        });
    }
    host.querySelector('[data-loc]').onclick = function () { doc(); ve(); UI.toast('ok', 'Đã cập nhật báo cáo', T.date(f.tu) + ' → ' + T.date(f.den)); };
    host.querySelector('[data-thang]').onclick = function () {
        var d = new Date(), t1 = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-01';
        host.querySelector('[data-f="tu"]').value = t1;
        host.querySelector('[data-f="den"]').value = T.today();
        doc(); ve();
    };
    ve();
};

/* ==========================================================================
   6. LỊCH SỬ GIAO DỊCH KHO (THẺ KHO)
   ========================================================================== */
S['the-kho'] = function (host) {
    var mod = 'theKho';
    var qGV = Q.co(mod, 'giaVon');
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Lịch sử giao dịch kho</h2>' +
        '<div class="sub">Toàn bộ nhập · xuất · kiểm kê · điều chỉnh của ' + T.esc(khoTen()) + ' — bấm vào số chứng từ để mở chi tiết</div></div></div>' +
        tabKho('the-kho') +
        '<div class="note b mb12"><i class="bi bi-link-45deg"></i><div>' +
        'Thẻ kho được dựng trực tiếp từ chứng từ gốc: <b>Lô nhập khẩu</b>, <b>Phiếu xuất kho</b>, ' +
        '<b>Phiếu điều chỉnh tồn kho</b> (kể cả phiếu sinh từ kiểm kê). ' +
        'Mọi thay đổi ở các phân hệ Nhập khẩu · Mua hàng · Bán hàng đều <b>cập nhật tức thời</b> vào đây.</div></div>' +
        '<div id="kpi" class="kpis mb12"></div><div id="gh"></div></div>';
    W.crumb(['Kho', 'Lịch sử giao dịch kho']);
    bindTab(host);

    var sk = T.theKho().slice().reverse();
    host.querySelector('#kpi').innerHTML =
        kp('Tổng số giao dịch kho', T.num(sk.length, 0), 'dòng thẻ kho') +
        kp('Lần nhập', T.num(sk.filter(function (x) { return x.sl > 0 && x.loai !== 'dauKy'; }).length, 0), '', 'g') +
        kp('Lần xuất', T.num(sk.filter(function (x) { return x.loai === 'xuat'; }).length, 0), '', 'c') +
        kp('Điều chỉnh / kiểm kê', T.num(sk.filter(function (x) { return x.loai === 'dieuChinh' || x.loai === 'kiemKe'; }).length, 0), '', 'y');

    var g = new UI.Grid({
        mount: '#gh', rows: sk, pageSize: 30, height: 'calc(100vh - 470px)',
        search: ['maHang', 'tenHang', 'ctSo', 'dienGiai', 'doiTac', 'ai'], sortK: 'ngay', sortD: -1,
        toolbar: '<button class="btn primary" data-bcao title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel"><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>' +
            '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
            '<button class="btn" data-the disabled><i class="bi bi-card-list"></i> Thẻ kho của mã hàng</button>' +
            '<span class="tb-sep"></span><span class="small muted">Bấm số chứng từ để mở đúng chứng từ phát sinh</span>',
        filters: [
            { k: 'loai', t: 'Loại giao dịch', w: 180, opts: T.LOAI_TK.map(function (x) { return { v: x.k, t: x.t }; }) },
            { k: '_tu', t: 'Khoảng thời gian', w: 180,
              opts: [{ v: '30', t: '30 ngày gần nhất' }, { v: '90', t: '90 ngày gần nhất' }, { v: '365', t: '1 năm gần nhất' }],
              test: function (x, v) { return x.ngay >= T.addDays(T.today(), -Number(v)); } }
        ],
        cols: [
            { k: 'ngay', t: 'Thời gian', w: 108, fmt: 'date' },
            { k: 'loai', t: 'Loại', w: 130, r: function (v) {
                var c = v === 'xuat' ? 'c' : v === 'dieuChinh' ? 'y' : v === 'kiemKe' ? 'b' : v === 'dauKy' ? 'n' : 'g';
                return '<span class="pill ' + c + '">' + T.esc(T.tenLoaiTK(v)) + '</span>'; } },
            { k: 'ctSo', t: 'Chứng từ phát sinh', w: 150, cls: 'mono', r: function (v, r) {
                if (!r.ctId) return '<span class="muted">' + T.esc(v || '—') + '</span>';
                return '<a href="#" class="lnk" data-ct="' + T.esc(r.ctLoai) + '|' + T.esc(r.ctId) + '">' + T.esc(v) + '</a>'; } },
            { k: 'maHang', t: 'Mã hàng', w: 150, cls: 'mono' },
            { k: 'tenHang', t: 'Tên hàng hóa', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
            { k: 'nhap', t: 'Nhập', w: 88, cls: 'num', total: true,
              r: function (v) { return v ? '<span class="pos"><b>+' + T.num(v) + '</b></span>' : '<span class="muted">—</span>'; } },
            { k: 'xuat', t: 'Xuất', w: 88, cls: 'num', total: true,
              r: function (v) { return v ? '<span class="neg"><b>−' + T.num(v) + '</b></span>' : '<span class="muted">—</span>'; } },
            { k: 'tonSau', t: 'Tồn sau GD', w: 106, cls: 'num', r: function (v) { return '<b>' + T.num(v) + '</b>'; } },
            { k: 'donGia', t: 'Giá vốn tại thời điểm', w: 168, cls: 'num', fmt: 'money', an: !qGV },
            { k: 'giaTri', t: 'Giá trị', w: 140, cls: 'num', fmt: 'money', total: true, an: !qGV },
            { k: 'ai', t: 'Người thực hiện', w: 150, r: function (v) { return v ? T.esc(v) : '<span class="muted">—</span>'; } },
            { k: 'dienGiai', t: 'Diễn giải', w: 260, r: function (v) { return '<span class="ellip small">' + T.esc(v || '') + '</span>'; } }
        ],
        actions: function () { return UI.btn('the', 'bi-card-list', 'Thẻ kho của mã hàng này'); }, actionsW: 60,
        onAction: function (a, r) { W.theKhoCuaMa(r.maHang); },
        onSelect: UI.chonToolbar(host, ['the']),
        onOpen: function (r) { W.theKhoCuaMa(r.maHang); },
        afterRender: function (root) { noiCT(root); }
    });
    noiCT(host);
    UI.apQuyen(host, mod);

    function noiCT(root) {
        (root || host).querySelectorAll('[data-ct]').forEach(function (a) {
            a.onclick = function (e) {
                e.preventDefault(); e.stopPropagation();
                var p = a.getAttribute('data-ct').split('|');
                moChungTuKho(p[0], p[1]);
            };
        });
    }
    var qs = function (x) { return host.querySelector(x); };
    if (qs('[data-the]')) qs('[data-the]').onclick = function () { var r = g.selected(); if (r) W.theKhoCuaMa(r.maHang); };
    if (qs('[data-bcao]')) qs('[data-bcao]').onclick = function () {
        W.inBaoCao({
            tieu: 'BÁO CÁO LỊCH SỬ GIAO DỊCH KHO', phu: khoTen(), thoiDiem: T.today(),
            cty: DB.get('donVi', (T.khoChinh() || {}).donViId) || DB.cty(),
            file: 'BaoCao_LichSuGiaoDichKho',
            dieuKien: [
                { t: 'Kho', v: khoTen() },
                { t: 'Loại giao dịch', v: (g.f || {}).loai ? T.tenLoaiTK((g.f || {}).loai) : 'Tất cả loại' },
                { t: 'Từ khóa tìm kiếm', v: g.q || '' }
            ],
            cols: [
                { t: 'Ngày', k: 'ngay', w: 20, cls: 'c', r: function (v) { return T.date(v); } },
                { t: 'Loại giao dịch', k: 'loai', w: 24, r: function (v) { return T.esc(T.tenLoaiTK(v)); } },
                { t: 'Chứng từ', k: 'ctSo', w: 26, r: function (v) { return T.esc(v || '—'); } },
                { t: 'Mã hàng', k: 'maHang', w: 26 },
                { t: 'Tên hàng hóa', k: 'tenHang' },
                { t: 'Nhập', k: 'nhap', w: 16, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return v ? T.num(v) : ''; } },
                { t: 'Xuất', k: 'xuat', w: 16, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return v ? T.num(v) : ''; } },
                { t: 'Tồn sau', k: 'tonSau', w: 18, cls: 'n', r: function (v) { return T.num(v); } },
                { t: 'Giá vốn', k: 'donGia', w: 24, cls: 'n', an: !qGV, r: function (v) { return T.money(v); } },
                { t: 'Giá trị', k: 'giaTri', w: 26, cls: 'n', tong: true, an: !qGV,
                  r: function (v) { return T.money(v); } },
                { t: 'Diễn giải', k: 'dienGiai' }
            ],
            rows: g.allRows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'THỦ KHO'
        });
    };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel('LichSu_GiaoDichKho', 'Thẻ kho', [
            { t: 'Ngày', k: 'ngay', w: 12 }, { t: 'Loại', k: 'loai', w: 14 },
            { t: 'Chứng từ', k: 'ctSo', w: 18 }, { t: 'Mã hàng', k: 'maHang', w: 20 },
            { t: 'Tên hàng hóa', k: 'tenHang', w: 44 }, { t: 'Nhập', k: 'nhap', w: 12 },
            { t: 'Xuất', k: 'xuat', w: 12 }, { t: 'Tồn sau GD', k: 'tonSau', w: 13 },
            { t: 'Giá vốn tại thời điểm', k: 'donGia', w: 20 }, { t: 'Giá trị', k: 'giaTri', w: 18 },
            { t: 'Người thực hiện', k: 'ai', w: 20 }, { t: 'Diễn giải', k: 'dienGiai', w: 46 }], g.allRows);
    };
};

/** Mở đúng chứng từ đã sinh ra một dòng thẻ kho. */
function moChungTuKho(loai, id) {
    if (loai === 'phieuXuat') return W.moChungTu('phieuXuat', id);
    if (loai === 'loNhap') { W.go('lo-nhap'); return UI.toast('info', 'Đã mở danh sách lô nhập', 'Chọn lô để xem bảng tính giá vốn.'); }
    if (loai === 'dieuChinhKho') { W.go('dieu-chinh-ton'); return UI.toast('info', 'Đã mở danh sách điều chỉnh tồn kho'); }
    UI.toast('warn', 'Không có chứng từ gốc', 'Dòng số dư đầu do chuyển đổi dữ liệu, không gắn với chứng từ.');
}

/* ==========================================================================
   THẺ KHO CỦA MỘT MÃ HÀNG — popup dùng chung toàn hệ thống
   ========================================================================== */
W.theKhoCuaMa = function (ma) {
    var hh = T.hh(ma);
    if (!hh) return UI.toast('err', 'Không tìm thấy mã hàng', ma);
    var ls = T.theKhoCuaMa(ma);
    var qGV = Q.co('theKho', 'giaVon');
    var nhap = T.sum(ls, function (x) { return x.nhap; }), xuat = T.sum(ls, function (x) { return x.xuat; });

    UI.modal({
        size: 'full', title: 'Thẻ kho — ' + ma,
        sub: hh.ten + ' · ' + (hh.dvt || '') + ' · ' + khoTen(),
        body:
        '<div class="grid5 mb12">' +
        kp('Tồn hiện tại', T.num(hh.ton, 0) + ' ' + T.esc(hh.dvt || ''), '', hh.ton > 0 ? 'g' : 'r') +
        kp('Giá vốn bình quân', qGV ? T.money(T.giaVonBQ(ma)) + ' đ' : '••••', 'bình quân gia quyền di động', 'b') +
        kp('Giá trị tồn', qGV ? T.money((Number(hh.ton) || 0) * T.giaVonBQ(ma)) + ' đ' : '••••', '', 'g') +
        kp('Tổng đã nhập', '+' + T.num(nhap, 0), ls.filter(function (x) { return x.sl > 0; }).length + ' lượt') +
        kp('Tổng đã xuất', '−' + T.num(xuat, 0), ls.filter(function (x) { return x.sl < 0; }).length + ' lượt', 'c') +
        '</div>' +
        '<div class="card"><div class="card-h"><i class="bi bi-clock-history"></i> Toàn bộ lịch sử phát sinh — mới nhất trước' +
        '<span class="spacer"></span><button class="btn sm" data-xl title="Xuất nguyên dữ liệu thẻ kho"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
        '<button class="btn sm" data-pr><i class="bi bi-printer"></i> In thẻ kho</button></div>' +
        '<div class="tablewrap" style="max-height:calc(100vh - 340px)">' +
        (ls.length ? '<table class="grid"><thead><tr>' +
            '<th style="width:104px">Thời gian</th><th style="width:126px">Loại</th>' +
            '<th style="width:150px">Chứng từ</th><th class="num" style="width:84px">Nhập</th>' +
            '<th class="num" style="width:84px">Xuất</th><th class="num" style="width:100px">Tồn sau</th>' +
            (qGV ? '<th class="num" style="width:140px">Giá vốn tại thời điểm</th><th class="num" style="width:130px">Giá trị</th>' : '') +
            '<th style="width:150px">Người thực hiện</th><th>Diễn giải</th></tr></thead><tbody>' +
            ls.map(function (x) {
                var c = x.loai === 'xuat' ? 'c' : x.loai === 'dieuChinh' ? 'y' : x.loai === 'kiemKe' ? 'b' : x.loai === 'dauKy' ? 'n' : 'g';
                return '<tr><td>' + T.date(x.ngay) + '</td>' +
                    '<td><span class="pill ' + c + '">' + T.esc(T.tenLoaiTK(x.loai)) + '</span></td>' +
                    '<td class="mono">' + (x.ctId ? '<a href="#" class="lnk" data-ct="' + T.esc(x.ctLoai) + '|' + T.esc(x.ctId) + '">' + T.esc(x.ctSo) + '</a>'
                        : '<span class="muted">' + T.esc(x.ctSo || '—') + '</span>') + '</td>' +
                    '<td class="num">' + (x.nhap ? '<span class="pos"><b>+' + T.num(x.nhap) + '</b></span>' : '<span class="muted">—</span>') + '</td>' +
                    '<td class="num">' + (x.xuat ? '<span class="neg"><b>−' + T.num(x.xuat) + '</b></span>' : '<span class="muted">—</span>') + '</td>' +
                    '<td class="num"><b>' + T.num(x.tonSau) + '</b></td>' +
                    (qGV ? '<td class="num">' + T.money(x.donGia) + '</td><td class="num">' + T.money(x.giaTri) + '</td>' : '') +
                    '<td>' + T.esc(x.ai || '—') + '</td>' +
                    '<td><span class="ellip small">' + T.esc(x.dienGiai || '') + '</span></td></tr>';
            }).join('') + '</tbody></table>'
            : '<div class="empty" style="padding:46px"><i class="bi bi-inbox"></i><b>Mã hàng chưa có phát sinh kho</b>Chưa từng nhập, xuất hay điều chỉnh.</div>') +
        '</div></div>',
        buttons: [{ text: 'Đóng', click: function (h) { h.close(); } }],
        onOpen: function (h) {
            h.el.querySelectorAll('[data-ct]').forEach(function (a) {
                a.onclick = function (e) {
                    e.preventDefault();
                    var p = a.getAttribute('data-ct').split('|');
                    h.close(); setTimeout(function () { moChungTuKho(p[0], p[1]); }, 200);
                };
            });
            h.q('[data-xl]').onclick = function () {
                UI.xuatExcel('TheKho_' + ma, 'Thẻ kho ' + ma, [
                    { t: 'Ngày', k: 'ngay', w: 12 }, { t: 'Loại', k: 'loai', w: 14 },
                    { t: 'Chứng từ', k: 'ctSo', w: 18 }, { t: 'Nhập', k: 'nhap', w: 12 },
                    { t: 'Xuất', k: 'xuat', w: 12 }, { t: 'Tồn sau', k: 'tonSau', w: 12 },
                    { t: 'Giá vốn', k: 'donGia', w: 18 }, { t: 'Giá trị', k: 'giaTri', w: 18 },
                    { t: 'Người thực hiện', k: 'ai', w: 20 }, { t: 'Diễn giải', k: 'dienGiai', w: 46 }], ls);
            };
            h.q('[data-pr]').onclick = function () { inThe(); };
        }
    });

    function inThe() {
        W.inBaoCao({
            tieu: 'THẺ KHO', phu: hh.ten + ' — mã ' + ma, thoiDiem: T.today(),
            cty: DB.get('donVi', (T.khoChinh() || {}).donViId) || DB.cty(),
            dieuKien: [
                { t: 'Kho', v: khoTen() },
                { t: 'Mã hàng', v: ma },
                { t: 'Đơn vị tính', v: hh.dvt || '' },
                { t: 'Tồn hiện tại', v: T.num(hh.ton) },
                { t: 'Giá vốn bình quân', v: T.money(T.giaVonBQ(ma)) + ' đ' }
            ],
            cols: [
                { t: 'Ngày', k: 'ngay', w: 20, cls: 'c', r: function (v) { return T.date(v); } },
                { t: 'Loại giao dịch', k: 'loai', w: 26, r: function (v) { return T.esc(T.tenLoaiTK(v)); } },
                { t: 'Chứng từ', k: 'ctSo', w: 30, r: function (v) { return T.esc(v || '—'); } },
                { t: 'Nhập', k: 'nhap', w: 18, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return v ? T.num(v) : ''; } },
                { t: 'Xuất', k: 'xuat', w: 18, cls: 'n', tong: true, tongLa: 'num',
                  r: function (v) { return v ? T.num(v) : ''; } },
                { t: 'Tồn sau', k: 'tonSau', w: 20, cls: 'n', r: function (v) { return T.num(v); } },
                { t: 'Giá vốn', k: 'donGia', w: 26, cls: 'n', r: function (v) { return T.money(v); } },
                { t: 'Giá trị', k: 'giaTri', w: 28, cls: 'n', tong: true, r: function (v) { return T.money(v); } },
                { t: 'Diễn giải', k: 'dienGiai' }
            ],
            rows: ls.slice().reverse(), kyTrai: 'NGƯỜI LẬP THẺ', kyPhai: 'THỦ KHO'
        });
    }
};


/* ==========================================================================
   PHIẾU NHẬP KHO
   Không lập tay. Sinh từ chứng từ nguồn: Lô nhập · Trả hàng · Điều chỉnh · Tồn đầu kỳ.
   Ghi sổ phiếu nhập là thời điểm DUY NHẤT tồn kho tăng và giá vốn bình quân đổi.
   ========================================================================== */
S['phieu-nhap'] = function (host) {
    var mod = 'phieuNhap';
    var qIn = Q.co(mod, 'in'), qXoa = Q.co(mod, 'xoa'), g;

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Phiếu nhập kho</h2>' +
        '<div class="sub">Chứng từ ghi tăng tồn kho — sinh tự động từ chứng từ nguồn, không lập tay.</div></div></div>' +
        tabKho('phieu-nhap') +
        '<div class="note b mb12"><i class="bi bi-diagram-2"></i><div>' +
        '<b>Không nhập kho trực tiếp.</b> Phiếu nhập kho chỉ sinh từ: <b>Lô nhập</b> (Mua hàng &amp; Nhập khẩu → ' +
        'Lô nhập hàng → <i>Nhập kho</i>), <b>Trả hàng</b>, <b>Điều chỉnh</b> tồn kho và <b>Tồn đầu kỳ</b>. ' +
        'Kho chỉ phản ánh dữ liệu từ chứng từ.</div></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Kho', 'Phiếu nhập kho']);
    bindTab(host);

    function rows() {
        return DB.all('phieuNhap').map(function (p) {
            p._sl = T.sum(p.lines || [], function (l) { return Number(l.soLuong) || 0; });
            p._ma = (p.lines || []).length;
            return p;
        });
    }

    var tb = '<button class="btn primary" data-veNguon><i class="bi bi-box-arrow-in-down"></i> Lập từ Lô nhập hàng</button>' +
        '<button class="btn" data-tra><i class="bi bi-arrow-return-left"></i> Lập phiếu nhập hàng trả lại</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-xem disabled><i class="bi bi-eye"></i> Xem chứng từ</button>' +
        '<button class="btn danger" data-huy disabled><i class="bi bi-x-circle"></i> Hủy phiếu</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
        '<button class="btn" data-lam><i class="bi bi-arrow-clockwise"></i> Làm mới</button>';

    g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: 20, height: 'calc(100vh - 440px)', toolbar: tb,
        sortK: 'ngay', sortD: -1, chon: true, search: ['so', 'loNhapSo', 'nhaCungCap', 'ghiChu'],
        emptyTitle: 'Chưa có phiếu nhập kho nào',
        emptyText: 'Phiếu nhập kho sinh ra khi bấm “Nhập kho” trên một lô nhập hàng đã phân bổ chi phí.',
        cols: [
            { k: 'so', t: 'Số phiếu', w: 128, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày nhập', w: 106, fmt: 'date' },
            { k: 'nguon', t: 'Nguồn nhập', w: 132, r: function (v) {
                return '<span class="pill ' + (v === 'Tồn đầu kỳ' ? 'b' : v === 'Trả hàng' ? 'y' : 'c') + '">' +
                    T.esc(v || '') + '</span>'; } },
            { k: 'loNhapSo', t: 'Chứng từ nguồn', w: 132, cls: 'mono',
              r: function (v, r) { return v ? '<a class="lnk" data-ma="' + T.esc(r.id) + '">' + T.esc(v) + '</a>'
                                            : '<span class="muted">—</span>'; } },
            { k: 'nhaCungCap', t: 'Nhà cung cấp', w: 180,
              r: function (v) { return v ? T.esc(v) : '<span class="muted">—</span>'; } },
            { k: '_ma', t: 'Số mã', w: 78, cls: 'num', fmt: 'num' },
            { k: '_sl', t: 'Tổng số lượng', w: 120, cls: 'num', fmt: 'num', total: true },
            { k: 'tongTien', t: 'Giá trị nhập kho', w: 158, cls: 'num', total: true,
              an: !Q.co(mod, 'giaVon'), r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 128, r: function (v) { return T.pill(v); } }
        ],
        filters: [
            { k: 'nguon', t: 'Nguồn nhập', w: 170, opts: T.NGUON_NHAP },
            { k: 'trangThai', t: 'Trạng thái', w: 150, opts: ['Đã ghi sổ', 'Đã hủy'] }
        ],
        actions: function () {
            return UI.btn('xem', 'bi-eye', 'Xem chứng từ') + (qIn ? UI.btn('in', 'bi-printer', 'In') : '');
        }, actionsW: 84,
        onAction: function (a, r) { a === 'in' ? W.inChungTu('phieuNhap', r) : xemPhieu(r); },
        onSelect: UI.chonToolbar(host, ['xem', 'huy', 'in']),
        onOpen: function (r) { xemPhieu(r); },
        afterRender: function (body) {
            body.querySelectorAll('[data-ma]').forEach(function (a) {
                a.onclick = function (e) {
                    e.stopPropagation();
                    var r = DB.get('phieuNhap', a.getAttribute('data-ma'));
                    if (r && r.loNhapId) W.go('lo-nhap');
                };
            });
        }
    });
    UI.apQuyen(host, mod);

    var qs = function (x) { return host.querySelector(x); };
    qs('[data-veNguon]').onclick = function () { W.go('lo-nhap'); };
    if (qs('[data-tra]')) qs('[data-tra]').onclick = function () { nhapTraHang(); };
    qs('[data-xem]').onclick = function () { var r = g.selected(); if (r) xemPhieu(r); };
    qs('[data-lam]').onclick = function () { g.q = ''; g.f = {}; g.reload(rows()); UI.toast('info', 'Đã làm mới'); };
    W.hangLoat(host, g, {
        mod: mod, coll: 'phieuNhap', dt: 'Phiếu nhập kho', file: 'DanhSach_PhieuNhapKho',
        rows: rows, excel: xlCols(), email: false, inCT: true
    });
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel('DanhSach_PhieuNhapKho', 'Phiếu nhập kho', xlCols(), g.allRows);
    };
    if (qs('[data-huy]')) qs('[data-huy]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (r.trangThai !== 'Đã ghi sổ')
            return UI.khongThe('Hủy phiếu nhập kho',
                'Phiếu ' + r.so + ' đang ở trạng thái “' + r.trangThai + '”.',
                'Chỉ phiếu nhập kho ở trạng thái “Đã ghi sổ” mới hủy được.');
        /* MỘT ĐƯỜNG THU HỒI DUY NHẤT CHO CẢ HỆ THỐNG.
           Bản trước tự trừ tồn ngay tại đây mà KHÔNG trả lại giá vốn bình quân
           và KHÔNG xóa dòng lịch sử giá vốn của phiếu — trái hẳn với lời hứa in
           ngay trên hộp thoại, và làm hỏng phép kiểm thu hồi của những phiếu
           nhập sau đó. Nay đi đúng cửa T.thuHoiNhapKho như mọi nơi khác. */
        var kt = T.kiemTraThuHoiNhap(r);
        if (!kt.duoc) return UI.khongThe('Hủy phiếu nhập kho',
            'Không thu hồi được phiếu nhập kho ' + r.so + ':', kt.loi.join(' '));
        UI.confirm({
            title: 'Hủy phiếu nhập kho', danger: true,
            message: 'Hủy phiếu <b>' + T.esc(r.so) + '</b>?',
            note: 'Tồn kho giảm lại đúng số lượng của phiếu, <b>giá vốn bình quân trở lại đúng giá trị ' +
                  'trước khi ghi phiếu</b>, dòng lịch sử giá vốn của phiếu được xóa. Lô nhập trở lại bản ' +
                  'nháp để sửa hoặc nhập kho lại. Chứng từ bán hàng đã phát hành <b>không</b> thay đổi ' +
                  'vì giá vốn đã đóng băng.',
            okText: 'Hủy phiếu', okIcon: 'bi-x-circle',
            ok: function () {
                if (!T.thuHoiNhapKho(r))
                    return UI.toast('err', 'Không hủy được phiếu',
                        'Số liệu kho đã thay đổi, hãy làm mới danh sách rồi thử lại.');
                g.reload(rows()); W.route();
                UI.toast('ok', 'Đã hủy phiếu nhập kho',
                    r.so + ' — tồn kho và giá vốn đã trở lại như trước.');
            }
        });
    };

    function xlCols() {
        return [{ t: 'Số phiếu', k: 'so', w: 16 }, { t: 'Ngày nhập', k: 'ngay', w: 12 },
                { t: 'Nguồn nhập', k: 'nguon', w: 16 }, { t: 'Chứng từ nguồn', k: 'loNhapSo', w: 16 },
                { t: 'Nhà cung cấp', k: 'nhaCungCap', w: 26 }, { t: 'Số mã', k: '_ma', w: 8 },
                { t: 'Tổng số lượng', k: '_sl', w: 14 }, { t: 'Giá trị nhập kho', k: 'tongTien', w: 18 },
                { t: 'Diễn giải', k: 'ghiChu', w: 40 }, { t: 'Trạng thái', k: 'trangThai', w: 14 }];
    }

    W.FORM_CT = W.FORM_CT || {};
    W.FORM_CT.phieuNhap = function (rec) { xemPhieu(rec); };

    function xemPhieu(r) {
        UI.modal({
            size: 'xl', title: 'Phiếu nhập kho — ' + r.so,
            sub: 'Nguồn: ' + (r.nguon || '') + (r.loNhapSo ? ' · Chứng từ nguồn ' + r.loNhapSo : '') +
                 ' · Ngày ' + T.date(r.ngay),
            body: '<div class="grid4 mb12">' +
                kp('Số mã hàng', T.num((r.lines || []).length, 0)) +
                kp('Tổng số lượng', T.num(T.sum(r.lines || [], function (l) { return Number(l.soLuong) || 0; }))) +
                kp('Giá trị nhập kho', T.money(r.tongTien) + ' đ', 'g') +
                kp('Trạng thái', T.esc(r.trangThai)) + '</div>' +
                '<div class="tablewrap" style="max-height:420px"><table class="grid"><thead><tr>' +
                '<th style="width:44px">TT</th><th style="width:150px">Mã hàng</th><th>Tên hàng hóa</th>' +
                '<th style="width:64px">ĐVT</th><th class="num" style="width:96px">Số lượng</th>' +
                '<th class="num" style="width:132px">Giá vốn nhập</th>' +
                '<th class="num" style="width:142px">Thành tiền</th></tr></thead><tbody>' +
                (r.lines || []).map(function (l, i) {
                    return '<tr><td class="ctr muted">' + (i + 1) + '</td><td class="mono">' + T.esc(l.maHang) + '</td>' +
                        '<td><span class="ellip">' + T.esc(l.tenHang) + '</span></td>' +
                        '<td class="ctr">' + T.esc(l.dvt || '') + '</td>' +
                        '<td class="num">' + T.num(l.soLuong) + '</td>' +
                        '<td class="num">' + T.money(l.giaVon) + '</td>' +
                        '<td class="num b">' + T.money(l.thanhTien) + '</td></tr>';
                }).join('') + '</tbody></table></div>' +
                (r.ghiChu ? '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>' + T.esc(r.ghiChu) + '</div></div>' : ''),
            buttons: [{ text: 'Đóng', click: function (h) { h.close(); } }]
                .concat(r.loNhapId ? [{ text: 'Mở lô nhập nguồn', icon: 'bi-box-arrow-up-right',
                    click: function (h) { h.close(); W.go('lo-nhap'); } }] : [])
                .concat(qIn ? [{ text: 'Xem trước khi in', cls: 'primary', icon: 'bi-printer',
                    click: function () { W.inChungTu('phieuNhap', r); } }] : [])
        });
    }
};

})(window);

/* ==========================================================================
   DANH MỤC NỀN (MASTER DATA)
   Nhóm hàng · Đơn vị tính · Hãng sản xuất · Thuế suất · Điều khoản thanh toán
   · Người ký.
   Nguyên tắc: Danh mục CHỈ chứa dữ liệu nền, KHÔNG chứa số liệu phát sinh
   (không công nợ, không tồn kho, không doanh thu). Mọi phân hệ dùng lại đúng
   một nguồn này — không khai trùng ở nhiều nơi.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {};

/* ------------------------------- DANH SÁCH LỰA CHỌN LẤY TỪ DANH MỤC NỀN
   Mọi ô chọn Nhóm hàng / ĐVT / Hãng / Thuế suất / Điều khoản trong toàn hệ
   thống đều gọi các hàm này — sửa danh mục nền là toàn hệ thống đổi theo.
   ------------------------------------------------------------------------- */
function dung(coll) {
    return DB.all(coll).filter(function (x) { return x.trangThai !== 'Ngừng dùng'; });
}
W.dsNhomHang = function () {
    var ds = dung('nhomHang').map(function (x) { return x.ten; });
    return ds.length ? ds : Array.from(new Set(DB.all('hangHoa').map(function (h) { return h.nhom; }).filter(Boolean)));
};
W.dsDVT = function () {
    var ds = dung('dvt').map(function (x) { return x.ma; });
    return ds.length ? ds : ['Bộ', 'Cái', 'Tủ', 'Chiếc', 'Mét', 'Cuộn', 'Hộp'];
};
W.dsHangSX = function () {
    var ds = dung('hangSX').map(function (x) { return x.ten; });
    return ds.length ? ds : Array.from(new Set(DB.all('hangHoa').map(function (h) { return h.nhaSanXuat; }).filter(Boolean)));
};
W.dsThueSuat = function () {
    var ds = dung('thueSuat');
    return ds.length ? ds.map(function (x) { return { v: x.giaTri, t: x.ten }; })
                     : [{ v: 0, t: 'Không chịu thuế' }, { v: 5, t: 'Thuế GTGT 5%' },
                        { v: 8, t: 'Thuế GTGT 8%' }, { v: 10, t: 'Thuế GTGT 10%' }];
};
W.dsDieuKhoanTT = function () {
    return dung('dieuKhoanTT').map(function (x) { return { v: x.id, t: x.ten, noiDung: x.noiDung }; });
};
W.dsDieuKhoanGH = function () {
    return dung('dieuKhoanGH').map(function (x) { return { v: x.id, t: x.ten, noiDung: x.noiDung }; });
};
/** Người ký ở một vị trí trên biểu mẫu của một công ty. */
W.nguoiKyCua = function (donViId, viTri) {
    var ds = dung('nguoiKy').filter(function (x) {
        return x.donViId === donViId && (!viTri || x.viTri === viTri);
    });
    return ds[0] || null;
};

/* ---------------------------------------------------------------- KHUNG CHUNG */
/**
 * Màn hình danh mục nền dạng danh sách đơn giản.
 * cfg: { coll, mod, title, sub, cot: [{k,t,w,type,opts,req,r}], dungO: 'mô tả nơi dùng' }
 */
function DanhMucNen(host, cfg) {
    var g, mod = cfg.mod || 'danhMucNen';
    var qThem = Q.co(mod, 'them'), qSua = Q.co(mod, 'sua'), qXoa = Q.co(mod, 'xoa');

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>' + T.esc(cfg.title) + '</h2>' +
        '<div class="sub">' + cfg.sub + '</div></div></div>' +
        '<div class="note b mb12"><i class="bi bi-link-45deg"></i><div>' +
        '<b>Dữ liệu nền dùng chung.</b> ' + cfg.dungO +
        ' Sửa ở đây là toàn hệ thống đổi theo — không khai lại ở từng chứng từ.</div></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Danh mục', cfg.title]);

    function rows() { return DB.all(cfg.coll); }

    var tb = (qThem ? '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Thêm mới</button>' : '') +
        '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
        '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-mau><i class="bi bi-file-earmark-arrow-down"></i> Tải tệp mẫu</button>' +
        '<button class="btn" data-nhap><i class="bi bi-upload"></i> Nhập Excel</button>' +
        '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-lam><i class="bi bi-arrow-clockwise"></i> Làm mới</button>';

    g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: 25, height: 'calc(100vh - 366px)', toolbar: tb, chon: true,
        luoi: cfg.coll, search: cfg.cot.map(function (c) { return c.k; }),
        cols: cfg.cot.map(function (c) {
            return { k: c.k, t: c.t, w: c.w,
                r: c.r || (c.type === 'bool' ? function (v) {
                    return T.pill(v === false ? 'Không' : 'Có'); } : undefined),
                cls: c.type === 'so' || c.type === 'tyle' ? 'num' : '',
                fmt: c.type === 'tyle' ? undefined : (c.type === 'so' ? 'num' : undefined) };
        }).concat([{ k: 'trangThai', t: 'Trạng thái', w: 128, r: function (v) { return T.pill(v || 'Đang dùng'); } }]),
        filters: [{ k: 'trangThai', t: 'Trạng thái', w: 150, opts: ['Đang dùng', 'Ngừng dùng'] }],
        actions: function () {
            return UI.btn('sua', 'bi-pencil', 'Sửa') + (qXoa ? UI.btn('xoa', 'bi-trash', 'Xóa', 'danger') : '');
        }, actionsW: 84,
        onAction: function (a, r) { if (a === 'sua') form(r); else xoa(r); },
        onSelect: UI.chonToolbar(host, ['sua', 'xoa']),
        onOpen: function (r) { form(r); }
    });
    UI.apQuyen(host, mod);
    W.hangLoat(host, g, {
        mod: mod, coll: cfg.coll, dt: cfg.title, file: 'DanhMuc_' + cfg.coll, rows: rows,
        excel: xl(), trangThai: ['Đang dùng', 'Ngừng dùng'], email: false, inCT: false,
        suaTruong: [{ k: 'trangThai', t: 'Trạng thái', type: 'select',
                      opts: [{ v: 'Đang dùng', t: 'Đang dùng' }, { v: 'Ngừng dùng', t: 'Ngừng dùng' }] }]
    });

    function xl() {
        return cfg.cot.map(function (c) { return { t: c.t, k: c.k, w: c.w ? Math.round(c.w / 7) : 20 }; })
            .concat([{ t: 'Trạng thái', k: 'trangThai', w: 14 }]);
    }

    var qs = function (x) { return host.querySelector(x); };
    if (qs('[data-them]')) qs('[data-them]').onclick = function () { form(null); };
    if (qs('[data-sua]')) qs('[data-sua]').onclick = function () { var r = g.selected(); if (r) form(r); };
    if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () { var r = g.selected(); if (r) xoa(r); };
    qs('[data-lam]').onclick = function () { g.q = ''; g.f = {}; g.reload(rows()); UI.toast('info', 'Đã làm mới'); };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel('DanhMuc_' + cfg.coll, cfg.title, xl(), g.allRows);
    };
    if (qs('[data-mau]')) qs('[data-mau]').onclick = function () {
        W.tepMau({ ten: cfg.title, file: 'Mau_' + cfg.coll, cols: xl(), mau: g.allRows.slice(0, 3) });
    };
    if (qs('[data-nhap]')) qs('[data-nhap]').onclick = function () {
        W.nhapExcel({
            ten: cfg.title, file: 'Mau_' + cfg.coll, cols: xl(), mau: g.allRows.slice(0, 3),
            kiemTra: function (r, i, da) {
                var o = {}, loi = [];
                cfg.cot.forEach(function (c) {
                    var v = r[c.t];
                    if (c.req && (v === undefined || String(v).trim() === '')) loi.push('thiếu "' + c.t + '"');
                    o[c.k] = c.type === 'bool' ? (T.kd(String(v === undefined ? '' : v)) !== 'khong')
                           : (c.type === 'so' || c.type === 'tyle' ? T.so(v)
                           : String(v === undefined ? '' : v).trim());
                });
                o.trangThai = r['Trạng thái'] || 'Đang dùng';
                var khoa = cfg.cot[0].k;
                if (o[khoa] && da[o[khoa]]) loi.push('trùng "' + cfg.cot[0].t + '" với dòng trước trong tệp');
                if (o[khoa] && DB.all(cfg.coll).some(function (x) { return x[khoa] === o[khoa]; }))
                    loi.push('"' + cfg.cot[0].t + '" đã có trong danh mục');
                if (o[khoa]) da[o[khoa]] = 1;
                return { o: o, loi: loi };
            },
            ghi: function (o) { DB.insert(cfg.coll, o); },
            xong: function () { g.reload(rows()); W.route(); }
        });
    };

    function form(r) {
        var moi = !r;
        if (moi && !qThem) return UI.thieuQuyen(mod, 'them');
        if (!moi && !qSua) return UI.thieuQuyen(mod, 'sua');
        UI.modal({
            size: 'md', title: (moi ? 'Thêm ' : 'Sửa ') + cfg.title.toLowerCase(),
            body: '<div class="grid2">' + cfg.cot.map(function (c) {
                var v = r ? (r[c.k] === undefined ? '' : r[c.k]) : (c.mac === undefined ? '' : c.mac);
                if (c.type === 'bool')
                    return '<div class="fld' + (c.rong ? ' span2' : '') + '"><label>' + T.esc(c.t) + '</label>' +
                        '<select data-f="' + c.k + '">' +
                        W.opt(['Có', 'Không'], (r ? (r[c.k] === false ? 'Không' : 'Có')
                                                 : (c.mac === false ? 'Không' : 'Có'))) + '</select>' +
                        (c.mo ? '<div class="small muted mt4">' + c.mo + '</div>' : '') + '</div>';
                if (c.type === 'select')
                    return '<div class="fld' + (c.rong ? ' span2' : '') + (c.req ? ' req' : '') + '"><label>' + T.esc(c.t) + '</label>' +
                        '<select data-f="' + c.k + '">' + W.opt(c.opts || [], v) + '</select></div>';
                var cls = c.type === 'so' ? 'tien' : c.type === 'tyle' ? 'tyle' : '';
                return '<div class="fld' + (c.rong ? ' span2' : '') + (c.req ? ' req' : '') + '"><label>' + T.esc(c.t) + '</label>' +
                    '<input class="' + cls + '" data-f="' + c.k + '" value="' + T.esc(cls ? T.soVe(v, c.type === 'tyle' ? 2 : 0) : v) + '"></div>';
            }).join('') +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' +
                W.opt(['Đang dùng', 'Ngừng dùng'], (r && r.trangThai) || 'Đang dùng') + '</select></div>' +
            '</div>',
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Lưu', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                    if (!UI.validate(h.el, cfg.cot.filter(function (c) { return c.req; })
                        .map(function (c) { return { k: c.k }; }))) return;
                    var v = UI.read(h.el);
                    /* Ô Có / Không trả về chuỗi — quy về đúng kiểu luận lý để
                       Business Engine đọc thẳng, không phải dịch lại ở mỗi nơi. */
                    cfg.cot.forEach(function (c) {
                        if (c.type === 'bool') v[c.k] = (v[c.k] !== 'Không');
                    });
                    var khoa = cfg.cot[0].k;
                    if (DB.all(cfg.coll).some(function (x) { return x[khoa] === v[khoa] && (!r || x.id !== r.id); }))
                        return UI.toast('err', 'Trùng dữ liệu', cfg.cot[0].t + ' "' + v[khoa] + '" đã tồn tại.');
                    if (moi) DB.insert(cfg.coll, v); else DB.update(cfg.coll, r.id, v);
                    h.close(); g.reload(rows()); W.route();
                    UI.toast('ok', moi ? 'Đã thêm' : 'Đã cập nhật', String(v[khoa] || ''));
                } }
            ]
        });
    }
    /* Xóa theo CHUẨN CHUNG của toàn hệ thống — xem mod-xoa.js. */
    function xoa(r) {
        UI.xoaChuan({
            coll: cfg.coll, rec: r, mod: mod, ten: String(r[cfg.cot[0].k] || ''),
            sauKhi: function () { g.selId = null; g.reload(rows()); W.route(); }
        });
    }
}
W.DanhMucNen = DanhMucNen;

/* ================================================================ NHÓM HÀNG */
/* Dự án — danh mục dùng chung của toàn hệ thống, không nhân bản theo công ty. */
S['du-an'] = function (host) {
    DanhMucNen(host, {
        coll: 'duAn', mod: 'duAn', title: 'Dự án',
        sub: 'Danh mục dự án / công trình dùng chung cho mọi công ty trong nhóm',
        dungO: 'Dùng ở Báo giá, Đơn bán hàng, Hợp đồng, Biên bản giao hàng và báo cáo theo dự án.',
        cot: [
            { k: 'ma', t: 'Mã dự án', w: 140, req: true },
            { k: 'ten', t: 'Tên dự án / công trình', w: 380, req: true, rong: true },
            { k: 'diaDiem', t: 'Địa điểm', w: 280, rong: true },
            { k: 'chuDauTu', t: 'Chủ đầu tư', w: 260, rong: true },
            { k: 'ghiChu', t: 'Ghi chú', w: 260, rong: true }
        ],
        dangDung: function (r) {
            /* Đếm theo ID NỘI BỘ; chứng từ đời cũ chỉ có tên thì đối chiếu bù. */
            var n = 0;
            ['baoGia', 'donBan', 'hopDong', 'phieuXuat', 'bienBanGiao',
             'bienBanNghiemThu', 'deNghiTT'].forEach(function (c) {
                n += DB.all(c).filter(function (x) {
                    return x.duAnId === r.id || (!x.duAnId && x.duAn && T.kd(x.duAn) === T.kd(r.ten));
                }).length;
            });
            return n;
        }
    });
};

/* ==========================================================================
   KHOẢN MỤC CHI — DANH MỤC NỀN CỦA PHÂN HỆ CHI PHÍ
   Hai cột luận lý quyết định cách Business Engine đọc mọi phiếu chi. Khai sai
   là báo cáo lãi lỗ sai ngay, nên màn hình nói rõ ý nghĩa của từng cột.
   ========================================================================== */
S['khoan-muc-chi'] = function (host) {
    DanhMucNen(host, {
        coll: 'khoanMucChi', mod: 'khoanMucChi', title: 'Khoản mục chi',
        sub: 'Phân loại chi phí cho Phiếu chi — quyết định khoản nào vào báo cáo lãi lỗ',
        dungO: 'Dùng ở Phiếu chi, báo cáo Lãi lỗ, Chi phí theo khoản mục và Dashboard.',
        cot: [
            { k: 'ma', t: 'Mã khoản mục', w: 140, req: true },
            { k: 'ten', t: 'Tên khoản mục chi', w: 360, req: true, rong: true },
            { k: 'vaoChiPhi', t: 'Tính vào chi phí', w: 150, type: 'bool', mac: true,
              mo: 'Chọn <b>Không</b> cho tiền hàng và chi phí nhập khẩu — những khoản đó đã nằm trong giá vốn, ' +
                  'tính thêm một lần nữa là tính hai lần cùng một khoản tiền.' },
            { k: 'giamCongNo', t: 'Giảm công nợ phải trả', w: 170, type: 'bool', mac: false,
              mo: 'Chọn <b>Có</b> khi khoản chi là thanh toán cho nhà cung cấp. Lương, thuê văn phòng, ' +
                  'công tác phí… không phải công nợ mua hàng.' },
            /* v18.6.0 — Logic 3. Nhóm trình bày trên Báo cáo kết quả hoạt động
               kinh doanh phải KHAI ĐƯỢC, không để phần mềm đoán. Đây cũng là nơi
               duy nhất quyết định khoản nào lên mã số 51 (thuế TNDN). */
            { k: 'nhomBC', t: 'Nhóm trên báo cáo KQHĐKD', w: 260, type: 'select',
              opts: T.NHOM_CHI_BC.map(function (x) { return { v: x.k, t: x.t }; }),
              r: function (v) {
                  var n = T.NHOM_CHI_BC.filter(function (x) { return x.k === v; })[0];
                  return n ? T.esc(n.t) : '<span class="muted">chưa khai</span>';
              },
              mo: 'Chỉ nhóm <b>Thuế thu nhập doanh nghiệp</b> mới lên chỉ tiêu mã số 51. ' +
                  'VAT, thuế môn bài, phí và lệ phí chọn <b>Thuế, phí, lệ phí khác</b> — ' +
                  'các khoản đó lên chi phí quản lý mã số 26.' },
            { k: 'moTa', t: 'Diễn giải', w: 320, rong: true }
        ],
        dangDung: function (r) {
            return DB.all('phieuChi').filter(function (p) { return p.khoanMucId === r.id; }).length;
        }
    });
};

S['nhom-hang'] = function (host) {
    DanhMucNen(host, {
        coll: 'nhomHang', mod: 'nhomHang', title: 'Nhóm hàng',
        sub: 'Phân loại hàng hóa dùng cho lọc, báo cáo và bảng giá',
        dungO: 'Dùng ở Danh mục Hàng hóa, báo cáo tồn kho, báo cáo doanh thu theo nhóm.',
        cot: [
            { k: 'ma', t: 'Mã nhóm', w: 130, req: true },
            { k: 'ten', t: 'Tên nhóm hàng', w: 320, req: true, rong: true },
            { k: 'ghiChu', t: 'Ghi chú', w: 300, rong: true }
        ],
        dangDung: function (r) {
            return DB.all('hangHoa').filter(function (x) { return x.nhom === r.ten; }).length;
        }
    });
};

/* ================================================================ ĐƠN VỊ TÍNH */
S['dvt'] = function (host) {
    DanhMucNen(host, {
        coll: 'dvt', mod: 'dvt', title: 'Đơn vị tính',
        sub: 'Đơn vị đo của hàng hóa trên mọi chứng từ',
        dungO: 'Dùng ở Danh mục Hàng hóa và mọi dòng hàng trên chứng từ.',
        cot: [
            { k: 'ma', t: 'Ký hiệu', w: 120, req: true },
            { k: 'ten', t: 'Tên đầy đủ', w: 260, req: true, rong: true }
        ],
        dangDung: function (r) {
            return DB.all('hangHoa').filter(function (x) { return x.dvt === r.ma; }).length;
        }
    });
};

/* ================================================================ HÃNG SẢN XUẤT */
S['hang-sx'] = function (host) {
    DanhMucNen(host, {
        coll: 'hangSX', mod: 'hangSX', title: 'Hãng sản xuất',
        sub: 'Nhà sản xuất / thương hiệu của hàng hóa',
        dungO: 'Dùng ở Danh mục Hàng hóa và bộ lọc của báo cáo kho.',
        cot: [
            { k: 'ma', t: 'Mã hãng', w: 130, req: true },
            { k: 'ten', t: 'Tên hãng sản xuất', w: 280, req: true, rong: true },
            { k: 'xuatXu', t: 'Xuất xứ', w: 170 },
            { k: 'website', t: 'Trang thông tin', w: 240 }
        ],
        dangDung: function (r) {
            return DB.all('hangHoa').filter(function (x) { return x.nhaSanXuat === r.ten; }).length;
        }
    });
};

/* ================================================================ THUẾ SUẤT */
S['thue-suat'] = function (host) {
    DanhMucNen(host, {
        coll: 'thueSuat', mod: 'thueSuat', title: 'Thuế suất GTGT',
        sub: 'Các mức thuế giá trị gia tăng đang áp dụng theo quy định',
        dungO: 'Dùng ở Danh mục Khách hàng và ô Thuế GTGT trên mọi chứng từ bán hàng.',
        cot: [
            { k: 'ma', t: 'Mã', w: 110, req: true },
            { k: 'ten', t: 'Tên mức thuế', w: 260, req: true, rong: true },
            { k: 'giaTri', t: 'Thuế suất (%)', w: 140, type: 'tyle', req: true,
              r: function (v) { return T.num(v, 2) + '%'; } },
            { k: 'ghiChu', t: 'Căn cứ áp dụng', w: 320, rong: true }
        ]
    });
};

/* ==================================================== ĐIỀU KHOẢN THANH TOÁN */
S['dieu-khoan-tt'] = function (host) {
    DanhMucNen(host, {
        coll: 'dieuKhoanTT', mod: 'dieuKhoanTT', title: 'Điều khoản thanh toán',
        sub: 'Các điều khoản thanh toán chuẩn dùng trên báo giá và hợp đồng',
        dungO: 'Dùng ở Báo giá, Hợp đồng và Đề nghị thanh toán.',
        cot: [
            { k: 'ma', t: 'Mã', w: 120, req: true },
            { k: 'ten', t: 'Tên điều khoản', w: 280, req: true, rong: true },
            { k: 'soNgay', t: 'Số ngày nợ', w: 130, type: 'so' },
            { k: 'noiDung', t: 'Nội dung ghi trên chứng từ', w: 420, rong: true }
        ]
    });
};

/* ==================================================== ĐIỀU KHOẢN GIAO HÀNG */
S['dieu-khoan-gh'] = function (host) {
    DanhMucNen(host, {
        coll: 'dieuKhoanGH', mod: 'dieuKhoanGH', title: 'Điều khoản giao hàng',
        sub: 'Các điều khoản giao hàng chuẩn dùng trên báo giá, đơn hàng và hợp đồng',
        dungO: 'Dùng ở Báo giá, Đơn bán hàng, Hợp đồng và Biên bản giao hàng.',
        cot: [
            { k: 'ma', t: 'Mã', w: 120, req: true },
            { k: 'ten', t: 'Tên điều khoản', w: 280, req: true, rong: true },
            { k: 'soNgay', t: 'Số ngày giao', w: 130, type: 'so' },
            { k: 'diaDiem', t: 'Địa điểm giao', w: 220, rong: true },
            { k: 'noiDung', t: 'Nội dung ghi trên chứng từ', w: 420, rong: true }
        ]
    });
};

/* ================================================================ NGƯỜI KÝ */
S['nguoi-ky'] = function (host) {
    DanhMucNen(host, {
        coll: 'nguoiKy', mod: 'nguoiKy', title: 'Người ký',
        sub: 'Người đại diện ký trên biểu mẫu của từng công ty',
        dungO: 'Dùng ở khối chữ ký của toàn bộ biểu mẫu in.',
        cot: [
            { k: 'hoTen', t: 'Họ và tên', w: 220, req: true },
            { k: 'chucVu', t: 'Chức vụ', w: 200, req: true },
            { k: 'donViId', t: 'Công ty', w: 160, type: 'select',
              opts: DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat }; }),
              r: function (v) { return T.esc((DB.get('donVi', v) || {}).tat || v || ''); } },
            { k: 'viTri', t: 'Vị trí ký trên biểu mẫu', w: 220, type: 'select',
              opts: [{ v: 'daiDien', t: 'Đại diện đơn vị' }, { v: 'ketToan', t: 'Kế toán trưởng' },
                     { v: 'thuKho', t: 'Thủ kho' }, { v: 'nguoiLap', t: 'Người lập biểu' }] }
        ]
    });
};

/* ==========================================================================
   LOẠI HỢP ĐỒNG — DANH MỤC MỞ RỘNG
   --------------------------------------------------------------------------
   Mỗi loại hợp đồng mang theo TOÀN BỘ biểu mẫu của nó: tiêu đề, trích yếu,
   tiền tố số hợp đồng, bố cục, căn cứ pháp lý, câu mở đầu, nhãn hai bên, bộ
   điều — khoản — điểm và các mẫu biên bản nghiệm thu đi kèm.
   Thêm loại hợp đồng mới chỉ là thêm một bản ghi ở đây, không sửa mã nguồn.
   ========================================================================== */
/* Vai trò của một điều — nối điều của biểu mẫu với ô tương ứng trong cửa sổ
   "Sửa nội dung" để người lập hợp đồng viết lại được nội dung của chính điều đó. */
var VAI_DIEU = [
    { v: '', t: '— Không (chỉ in theo biểu mẫu) —' },
    { v: 'phamVi', t: 'Phạm vi công việc' },
    { v: 'thanhToan', t: 'Điều khoản thanh toán' },
    { v: 'baoHanh', t: 'Điều khoản bảo hành' },
    { v: 'phat', t: 'Điều khoản phạt' }
];
function tenVaiDieu(v) {
    var x = VAI_DIEU.filter(function (o) { return o.v === v; })[0];
    return x ? x.t : v;
}
S['loai-hop-dong'] = function (host) {
    var mod = 'loaiHopDong', g;
    var qThem = Q.co(mod, 'them'), qSua = Q.co(mod, 'sua'), qXoa = Q.co(mod, 'xoa');

    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Loại hợp đồng</h2>' +
        '<div class="sub">Mỗi loại hợp đồng là một biểu mẫu riêng — tiêu đề, trích yếu, bố cục và ' +
        'toàn bộ điều khoản đều khai ở đây</div></div></div>' +
        '<div class="note b mb12"><i class="bi bi-link-45deg"></i><div>' +
        '<b>Danh mục mở rộng.</b> Loại hợp đồng <b>không viết cứng trong chương trình</b>. Thêm một ' +
        'loại mới ở đây là hệ thống tự hỗ trợ ngay: hộp thoại chuyển tiếp chứng từ, biểu mẫu in, ' +
        'điều khoản và mẫu biên bản nghiệm thu đều lấy theo bản ghi này.</div></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Danh mục', 'Loại hợp đồng']);

    function rows() { return DB.all('loaiHopDong'); }
    function soDieu(r) { return (r.dieu || []).length; }
    function tenNT(r) {
        return (r.mauNghiemThu || []).map(function (k) {
            return k === 'GT' ? 'Giá trị thanh toán' : 'Khối lượng'; }).join(' · ');
    }

    var tb = (qThem ? '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Thêm loại hợp đồng</button>' : '') +
        '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
        '<button class="btn" data-chep disabled><i class="bi bi-files"></i> Nhân bản</button>' +
        '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
        '<button class="btn" data-lam><i class="bi bi-arrow-clockwise"></i> Làm mới</button>';

    g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: 25, height: 'calc(100vh - 366px)', toolbar: tb, chon: true,
        luoi: 'loaiHopDong', search: ['ma', 'ten', 'tieuDe', 'vv'],
        cols: [
            { k: 'ma', t: 'Mã', w: 100, cls: 'mono' },
            { k: 'ten', t: 'Tên loại hợp đồng', w: 210, r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'tieuDe', t: 'Tiêu đề in trên biểu mẫu', w: 230 },
            { k: 'vv', t: 'Trích yếu (V/v)', r: function (v) { return '<span class="ellip">' + T.esc(v || '') + '</span>'; } },
            { k: 'tienTo', t: 'Tiền tố số HĐ', w: 118, cls: 'mono ctr' },
            { k: '_bang', t: 'Bảng hàng hóa', w: 128, cls: 'ctr', sort: false,
              r: function (v, r) { return r.coBangHang ? T.pill('Có') : '<span class="muted">Không</span>'; } },
            { k: '_dieu', t: 'Số điều', w: 92, cls: 'num', sort: false,
              r: function (v, r) { return String(soDieu(r)); } },
            { k: '_nt', t: 'Mẫu nghiệm thu', w: 200, sort: false,
              r: function (v, r) { return T.esc(tenNT(r)); } },
            { k: 'trangThai', t: 'Trạng thái', w: 124, r: function (v) { return T.pill(v || 'Đang dùng'); } }
        ],
        filters: [{ k: 'trangThai', t: 'Trạng thái', w: 150, opts: ['Đang dùng', 'Ngừng dùng'] }],
        actions: function () {
            return UI.btn('sua', 'bi-pencil', 'Sửa') + (qXoa ? UI.btn('xoa', 'bi-trash', 'Xóa', 'danger') : '');
        }, actionsW: 84,
        onAction: function (a, r) { if (a === 'sua') form(r); else xoa(r); },
        onSelect: UI.chonToolbar(host, ['sua', 'chep', 'xoa']),
        onOpen: function (r) { form(r); }
    });
    UI.apQuyen(host, mod);
    /* Thanh chức năng hàng loạt — chuẩn chung của mọi màn hình có ô tích chọn. */
    W.hangLoat(host, g, {
        mod: mod, coll: 'loaiHopDong', dt: 'Loại hợp đồng', file: 'DanhMuc_LoaiHopDong',
        rows: rows, email: false, inCT: false,
        excel: [
            { t: 'Mã', k: 'ma', w: 14 }, { t: 'Tên loại hợp đồng', k: 'ten', w: 30 },
            { t: 'Tiêu đề', k: 'tieuDe', w: 32 }, { t: 'Trích yếu', k: 'vv', w: 42 },
            { t: 'Tiền tố số HĐ', k: 'tienTo', w: 16 },
            { t: 'Số điều', k: '_d', w: 10, v: function (r) { return soDieu(r); } },
            { t: 'Trạng thái', k: 'trangThai', w: 14 }
        ],
        trangThai: ['Đang dùng', 'Ngừng dùng'],
        suaTruong: [{ k: 'trangThai', t: 'Trạng thái', type: 'select',
                      opts: [{ v: 'Đang dùng', t: 'Đang dùng' }, { v: 'Ngừng dùng', t: 'Ngừng dùng' }] }]
    });

    var qs = function (x) { return host.querySelector(x); };
    if (qs('[data-them]')) qs('[data-them]').onclick = function () { form(null); };
    if (qs('[data-sua]')) qs('[data-sua]').onclick = function () { var r = g.selected(); if (r) form(r); };
    if (qs('[data-chep]')) qs('[data-chep]').onclick = function () {
        var r = g.selected(); if (!r) return;
        var c = T.clone(r); delete c.id; c.heThong = false;
        c.ma = (c.ma || 'HD') + '2'; c.ten = c.ten + ' (bản sao)';
        form(c, true);
    };
    if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () { var r = g.selected(); if (r) xoa(r); };
    qs('[data-lam]').onclick = function () { g.q = ''; g.f = {}; g.reload(rows()); UI.toast('info', 'Đã làm mới'); };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel('DanhMuc_LoaiHopDong', 'Loại hợp đồng', [
            { t: 'Mã', k: 'ma', w: 14 }, { t: 'Tên loại hợp đồng', k: 'ten', w: 30 },
            { t: 'Tiêu đề', k: 'tieuDe', w: 32 }, { t: 'Trích yếu', k: 'vv', w: 42 },
            { t: 'Tiền tố số HĐ', k: 'tienTo', w: 16 },
            { t: 'Số điều', k: '_d', w: 10, v: function (r) { return soDieu(r); } },
            { t: 'Trạng thái', k: 'trangThai', w: 14 }
        ], g.allRows);
    };

    function xoa(r) {
        if (r.heThong) return UI.khongThe('Xóa loại hợp đồng',
            'Đây là loại hợp đồng gốc của phần mềm.',
            'Loại gốc chỉ được chuyển sang “Ngừng dùng”, không xóa.');
        UI.xoaChuan({ coll: 'loaiHopDong', rec: r, mod: mod, ten: r.ten,
            sauKhi: function () { g.selId = null; g.reload(rows()); W.route(); } });
    }

    /* ------------------------------------------------ BIỂU MẪU KHAI LOẠI HĐ */
    function form(rec, laChep) {
        var moi = !rec || !rec.id;
        if (!moi && !qSua) return UI.thieuQuyen(mod, 'sua');
        if (moi && !qThem) return UI.thieuQuyen(mod, 'them');
        var r = rec ? T.clone(rec) : {
            ma: '', ten: '', tieuDe: 'HỢP ĐỒNG', vv: '', tienTo: 'HĐ', boPhan: '',
            kieuDieu: 'hoa', coBangHang: true, coGiaTri: true,
            nhanA: 'BÊN MUA', nhanB: 'BÊN BÁN',
            canCu: [], moDau: 'Hôm nay, tại Văn phòng làm việc của {CTY}, chúng tôi gồm có:',
            chot: 'Hai bên nhất trí cùng thỏa thuận Hợp đồng với các nội dung cụ thể như sau:',
            dieu: [], mauNghiemThu: ['KL'], trangThai: 'Đang dùng'
        };
        var dieu = T.clone(r.dieu || []);

        UI.modal({
            size: 'full', dismiss: false,
            title: (moi ? 'Thêm loại hợp đồng' : 'Sửa loại hợp đồng') + (r.ten ? ' — ' + r.ten : ''),
            sub: 'Toàn bộ biểu mẫu của loại hợp đồng này khai ngay tại đây',
            body:
            '<div class="grid4">' +
            '<div class="fld req"><label>Mã loại</label><input data-f="ma" value="' + T.esc(r.ma || '') + '"></div>' +
            '<div class="fld req span2"><label>Tên loại hợp đồng</label><input data-f="ten" value="' + T.esc(r.ten || '') + '"></div>' +
            '<div class="fld"><label>Tiền tố số hợp đồng</label><input data-f="tienTo" value="' + T.esc(r.tienTo || '') + '" placeholder="HĐKT"></div>' +
            '<div class="fld span2 req"><label>Tiêu đề in trên biểu mẫu</label><input data-f="tieuDe" value="' + T.esc(r.tieuDe || '') + '"></div>' +
            '<div class="fld span2"><label>Trích yếu (V/v…)</label><input data-f="vv" value="' + T.esc(r.vv || '') + '"></div>' +
            '<div class="fld"><label>Bộ phận (dưới tên đơn vị)</label><input data-f="boPhan" value="' + T.esc(r.boPhan || '') + '" placeholder="BP KINH DOANH"></div>' +
            '<div class="fld"><label>Kiểu đề mục</label><select data-f="kieuDieu">' +
                W.opt([{ v: 'hoa', t: 'Điều 1: TÊN ĐIỀU IN HOA' }, { v: 'thuong', t: 'Điều 1: Tên điều chữ thường' }], r.kieuDieu || 'hoa') + '</select></div>' +
            '<div class="fld"><label>Nhãn bên mua</label><input data-f="nhanA" value="' + T.esc(r.nhanA || '') + '"></div>' +
            '<div class="fld"><label>Nhãn bên bán</label><input data-f="nhanB" value="' + T.esc(r.nhanB || '') + '"></div>' +
            '<div class="fld"><label class="chk"><input type="checkbox" data-f="coBangHang"' + (r.coBangHang !== false ? ' checked' : '') + '> In bảng hàng hóa</label></div>' +
            '<div class="fld"><label class="chk"><input type="checkbox" data-f="coGiaTri"' + (r.coGiaTri !== false ? ' checked' : '') + '> In giá trị hợp đồng và bằng chữ</label></div>' +
            '<div class="fld span2"><label>Mẫu biên bản nghiệm thu đi kèm</label><div class="row" style="gap:14px">' +
                T.MAU_NGHIEM_THU.map(function (m) {
                    return '<label class="chk"><input type="checkbox" data-nt="' + m.k + '"' +
                        ((r.mauNghiemThu || []).indexOf(m.k) >= 0 ? ' checked' : '') + '> ' + T.esc(m.t) + '</label>';
                }).join('') + '</div></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' +
                W.opt(['Đang dùng', 'Ngừng dùng'], r.trangThai || 'Đang dùng') + '</select></div>' +
            '<div class="fld span4"><label>Các căn cứ pháp lý — mỗi dòng một căn cứ</label>' +
                '<textarea data-f="canCu" rows="3">' + T.esc((r.canCu || []).join('\n')) + '</textarea></div>' +
            '<div class="fld span2"><label>Câu mở đầu</label><input data-f="moDau" value="' + T.esc(r.moDau || '') + '"></div>' +
            '<div class="fld span2"><label>Câu chốt trước phần điều khoản</label><input data-f="chot" value="' + T.esc(r.chot || '') + '"></div>' +
            '</div>' +
            '<div class="note b mt12"><i class="bi bi-braces"></i><div>Trường ghép dùng được trong câu chữ: ' +
            '<b>{CTY}</b> tên công ty · <b>{KH}</b> khách hàng · <b>{SO}</b> số hợp đồng · <b>{NGAY}</b> ngày ký · ' +
            '<b>{DU_AN}</b> dự án · <b>{GIA_TRI}</b> giá trị · <b>{BANG_CHU}</b> bằng chữ · <b>{VAT}</b> thuế suất · ' +
            '<b>{BAO_HANH}</b> số tháng bảo hành · <b>{HIEU_LUC}</b> ngày hết hiệu lực.</div></div>' +
            '<div class="card mt12"><div class="card-h"><i class="bi bi-list-ol"></i> Bộ điều khoản của loại hợp đồng' +
            '<span class="spacer"></span><button class="btn sm" id="lhdThem"><i class="bi bi-plus-lg"></i> Thêm điều</button></div>' +
            '<div class="card-b"><div id="lhdDS"></div></div></div>',
            buttons: [
                { text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } },
                { text: 'Lưu loại hợp đồng', cls: 'primary', icon: 'bi-check-lg', click: function (h) { luu(h); } }
            ],
            onOpen: function (h) {
                veDieu(h);
                h.q('#lhdThem').onclick = function () {
                    dieu.push({ ten: 'ĐIỀU KHOẢN MỚI', p: [], y: [], khoan: [] }); veDieu(h);
                };
            }
        });

        function veDieu(h) {
            var o = h.q('#lhdDS');
            if (!dieu.length) {
                o.innerHTML = '<div class="trong">Chưa khai điều khoản nào. Bấm <b>Thêm điều</b> để bắt đầu.</div>';
                return;
            }
            o.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
                '<th style="width:64px" class="ctr">Điều</th><th>Tên điều</th>' +
                '<th style="width:170px" class="ctr">Vai trò</th>' +
                '<th style="width:110px" class="ctr">Bảng hàng</th>' +
                '<th style="width:96px" class="num">Số dòng</th>' +
                '<th style="width:96px" class="num">Số khoản</th>' +
                '<th style="width:186px" class="ctr">Thao tác</th></tr></thead><tbody>' +
                dieu.map(function (d, i) {
                    return '<tr><td class="ctr"><b>' + (i + 1) + '</b></td>' +
                        '<td>' + T.esc(d.ten || '') + '</td>' +
                        '<td class="ctr">' + (d.vai
                            ? '<span class="pill b">' + T.esc(tenVaiDieu(d.vai)) + '</span>' : '—') + '</td>' +
                        '<td class="ctr">' + (d.bangHang ? '<span class="pill g">Có</span>' : '—') + '</td>' +
                        '<td class="num">' + ((d.p || []).length + (d.y || []).length) + '</td>' +
                        '<td class="num">' + ((d.khoan || []).length) + '</td>' +
                        '<td class="ctr">' +
                        UI.btn('sd', 'bi-pencil', 'Sửa') + UI.btn('len', 'bi-arrow-up', 'Lên') +
                        UI.btn('xu', 'bi-arrow-down', 'Xuống') + UI.btn('xd', 'bi-trash', 'Xóa', 'danger') +
                        '</td></tr>';
                }).join('') + '</tbody></table></div>';
            o.querySelectorAll('tbody tr').forEach(function (tr, i) {
                tr.querySelectorAll('[data-a]').forEach(function (b) {
                    b.onclick = function () {
                        var a = b.getAttribute('data-a');
                        if (a === 'sd') return suaDieu(h, i);
                        if (a === 'len' && i > 0) { var t = dieu[i - 1]; dieu[i - 1] = dieu[i]; dieu[i] = t; }
                        if (a === 'xu' && i < dieu.length - 1) { var u = dieu[i + 1]; dieu[i + 1] = dieu[i]; dieu[i] = u; }
                        if (a === 'xd') dieu.splice(i, 1);
                        veDieu(h);
                    };
                });
            });
        }

        function suaDieu(hCha, i) {
            var d = T.clone(dieu[i]);
            var kh = T.clone(d.khoan || []);
            UI.modal({
                size: 'lg', title: 'Điều ' + (i + 1),
                sub: 'Khai tên điều, các đoạn văn, các gạch đầu dòng và các khoản con',
                body: '<div class="grid2">' +
                '<div class="fld span2 req"><label>Tên điều</label><input data-f="ten" value="' + T.esc(d.ten || '') + '"></div>' +
                '<div class="fld span2"><label>Vai trò của điều</label><select data-f="vai">' +
                    W.opt(VAI_DIEU, d.vai || '') + '</select>' +
                    '<div class="small muted">Điều có vai trò thì người lập hợp đồng được viết lại nội dung ' +
                    'ngay ở cửa sổ “Sửa nội dung” của chính hợp đồng đó.</div></div>' +
                '<div class="fld"><label class="chk"><input type="checkbox" data-f="bangHang"' + (d.bangHang ? ' checked' : '') + '> In bảng hàng hóa trong điều này</label></div>' +
                '<div class="fld"><label class="chk"><input type="checkbox" data-f="giaTri"' + (d.giaTri ? ' checked' : '') + '> In giá trị hợp đồng và bằng chữ</label></div>' +
                '<div class="fld span2"><label>Đoạn văn — mỗi dòng một đoạn, không có gạch đầu dòng</label>' +
                    '<textarea data-f="p" rows="3">' + T.esc((d.p || []).join('\n')) + '</textarea></div>' +
                '<div class="fld span2"><label>Gạch đầu dòng — mỗi dòng một ý</label>' +
                    '<textarea data-f="y" rows="6">' + T.esc((d.y || []).join('\n')) + '</textarea></div>' +
                '</div>' +
                '<div class="card mt12"><div class="card-h"><i class="bi bi-diagram-2"></i> Khoản con' +
                '<span class="spacer"></span><button class="btn sm" id="khThem"><i class="bi bi-plus-lg"></i> Thêm khoản</button></div>' +
                '<div class="card-b"><div id="khDS"></div></div></div>',
                buttons: [
                    { text: 'Hủy', click: function (h) { h.close(); } },
                    { text: 'Xong', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                        var v = UI.read(h.el);
                        docKhoan(h);
                        dieu[i] = { ten: v.ten, vai: v.vai || '',
                            bangHang: !!v.bangHang, giaTri: !!v.giaTri,
                            p: dong(v.p), y: dong(v.y), khoan: kh };
                        h.close(); veDieu(hCha);
                    } }
                ],
                onOpen: function (h) {
                    veKhoan(h);
                    h.q('#khThem').onclick = function () {
                        docKhoan(h); kh.push({ so: '', ten: '', y: [], diem: [] }); veKhoan(h);
                    };
                }
            });
            function docKhoan(h) {
                h.el.querySelectorAll('[data-k]').forEach(function (e) {
                    var j = Number(e.getAttribute('data-k')), f = e.getAttribute('data-kf');
                    if (!kh[j]) return;
                    if (f === 'y' || f === 'diem') kh[j][f] = dong(e.value);
                    else kh[j][f] = e.value;
                });
            }
            function veKhoan(h) {
                var o = h.q('#khDS');
                if (!kh.length) { o.innerHTML = '<div class="trong">Điều này không có khoản con.</div>'; return; }
                o.innerHTML = kh.map(function (k, j) {
                    return '<div class="grid4" style="border:1px solid var(--line);border-radius:6px;padding:9px;margin-bottom:8px">' +
                    '<div class="fld"><label>Số khoản</label><input data-k="' + j + '" data-kf="so" value="' + T.esc(k.so || '') + '" placeholder="2.1"></div>' +
                    '<div class="fld span2"><label>Tên khoản</label><input data-k="' + j + '" data-kf="ten" value="' + T.esc(k.ten || '') + '"></div>' +
                    '<div class="fld"><label>&nbsp;</label><button class="btn danger" data-xk="' + j + '"><i class="bi bi-trash"></i> Xóa khoản</button></div>' +
                    '<div class="fld span4"><label>Gạch đầu dòng — mỗi dòng một ý</label>' +
                        '<textarea data-k="' + j + '" data-kf="y" rows="3">' + T.esc((k.y || []).join('\n')) + '</textarea></div>' +
                    '<div class="fld span4"><label>Điểm (dấu +) — mỗi dòng một điểm</label>' +
                        '<textarea data-k="' + j + '" data-kf="diem" rows="2">' + T.esc((k.diem || []).join('\n')) + '</textarea></div>' +
                    '</div>';
                }).join('');
                o.querySelectorAll('[data-xk]').forEach(function (b) {
                    b.onclick = function () { docKhoan(h); kh.splice(Number(b.getAttribute('data-xk')), 1); veKhoan(h); };
                });
            }
        }

        function dong(v) {
            return String(v || '').split('\n').map(function (x) { return x.trim(); })
                .filter(function (x) { return !!x; });
        }

        function luu(h) {
            if (!UI.validate(h.el, [{ k: 'ma' }, { k: 'ten' }, { k: 'tieuDe' }])) return;
            var v = UI.read(h.el);
            var nt = [];
            h.el.querySelectorAll('[data-nt]').forEach(function (e) {
                if (e.checked) nt.push(e.getAttribute('data-nt'));
            });
            if (!nt.length) nt = ['KL'];
            var o = T.clone(r);
            o.ma = String(v.ma).trim(); o.ten = String(v.ten).trim();
            o.tieuDe = String(v.tieuDe).trim(); o.vv = String(v.vv || '').trim();
            o.tienTo = String(v.tienTo || '').trim(); o.boPhan = String(v.boPhan || '').trim();
            o.kieuDieu = v.kieuDieu; o.coBangHang = !!v.coBangHang; o.coGiaTri = !!v.coGiaTri;
            o.nhanA = v.nhanA; o.nhanB = v.nhanB;
            o.canCu = dong(v.canCu); o.moDau = v.moDau; o.chot = v.chot;
            o.mauNghiemThu = nt; o.trangThai = v.trangThai; o.dieu = dieu;
            var trung = DB.all('loaiHopDong').filter(function (x) {
                return x.ma === o.ma && x.id !== (r.id || ''); });
            if (trung.length) return UI.toast('err', 'Trùng mã loại hợp đồng', 'Mã "' + o.ma + '" đã có.');
            var rec;
            if (moi || laChep) { delete o.id; rec = DB.insert('loaiHopDong', o); }
            else rec = DB.update('loaiHopDong', r.id, o) || o;
            DB.log(moi ? 'Thêm loại hợp đồng' : 'Sửa loại hợp đồng', 'loaiHopDong', rec);
            DB.save(); h.close(); g.reload(rows()); W.route();
            UI.toast('ok', moi ? 'Đã thêm loại hợp đồng' : 'Đã cập nhật loại hợp đồng', o.ten);
        }
    }
};

})(window);

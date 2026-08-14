/* ==========================================================================
   TVERP — CHỨNG TỪ BÁN HÀNG & MUA HÀNG
   Báo giá → Đơn bán hàng → Hợp đồng → Phiếu xuất kho · Đơn mua hàng
   Hồ sơ đơn hàng (liên kết xuyên suốt)
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;


/* ==========================================================================
   THUẾ SUẤT GTGT — COMBOBOX (chọn nhanh 0% / 8% / 10% hoặc gõ mức khác)
   ========================================================================== */
W.THUE_GOI_Y = [
    { v: 0,  t: 'Không thuế (0%)' },
    { v: 5,  t: 'Thuế GTGT 5%' },
    { v: 8,  t: 'Thuế GTGT 8%' },
    { v: 10, t: 'Thuế GTGT 10%' }
];
W.oThueSuat = function (vat, ro) {
    var id = 'dsThue';
    return '<div class="combo-num">' +
        '<input id="dfVat" class="num tyle" list="' + id + '" ' +
        'value="' + (vat === undefined || vat === '' ? 10 : vat) + '"' + (ro ? ' disabled' : '') +
        ' title="Chọn mức có sẵn hoặc gõ trực tiếp tỷ lệ khác"><span class="pc">%</span>' +
        '<datalist id="' + id + '">' +
        W.THUE_GOI_Y.map(function (x) { return '<option value="' + x.v + '" label="' + x.t + '">'; }).join('') +
        '</datalist></div>' +
        '<div class="small muted" style="margin-top:2px">Chọn 0 / 5 / 8 / 10 hoặc gõ mức khác</div>';
};
W.docThueSuat = function (h) {
    var e = h.q ? h.q('#dfVat') : h.querySelector('#dfVat');
    if (!e) return 10;
    var v = T.so(e.value);                       // chấp nhận cả "12,5" và "12.5"
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    return v;
};
W.bindThueSuat = function (h, onDoi) {
    var e = h.q('#dfVat');
    if (!e) return;
    function ap() {
        var v = W.docThueSuat(h);
        h._giuThue = true;                       // người dùng đã tự đặt thuế trên chứng từ này
        if (onDoi) onDoi(v);
    }
    e.oninput = ap; e.onchange = ap;
};
W.tinhLaiTong = function (h) {
    var box = h.q('#dfTong');
    if (box && h._lines) {
        var t = T.tinhTong(h._lines, W.docThueSuat(h));
        box.innerHTML = '<div class="totals"><table>' +
            '<tr><td>Cộng tiền hàng:</td><td>' + T.money(t.thanhTien) + ' đ</td></tr>' +
            '<tr><td>Thuế GTGT (' + W.docThueSuat(h) + '%):</td><td>' + T.money(t.vat) + ' đ</td></tr>' +
            '<tr class="big"><td>TỔNG CỘNG:</td><td>' + T.money(t.tongCong) + ' đ</td></tr>' +
            '<tr><td colspan="2" class="small muted" style="text-align:right;font-style:italic">' +
            T.docTien(t.tongCong) + '</td></tr></table></div>';
    }
};

/* ==========================================================================
   BỘ SOẠN DÒNG HÀNG
   ========================================================================== */
function LineEditor(host, lines, o) {
    var LE = this;
    LE.lines = lines || [];
    LE.o = o || {};
    LE.host = host;
    LE.draw();
}
LineEditor.prototype.draw = function () {
    var LE = this, ro = LE.o.readonly;
    /* Cột riêng chèn ngay sau cột Số lượng — ví dụ "Khối lượng nghiệm thu"
       của Biên bản nghiệm thu. Mỗi cột khai { k, t, w, so } (so = ô số). */
    var them = LE.o.cotThem || [];
    /* cotModel: PHIẾU NHẬP HÀNG không hiển thị Mã hàng nội bộ — cột hiển thị
       là MODEL của nhà sản xuất, đứng sau Tên hàng. Mã hàng vẫn được hệ thống
       tự sinh và liên kết ngầm bên dưới (hangHoaId) cho tồn kho, giá vốn,
       báo cáo — người dùng không phải nhìn hay nhập mã. */
    var theoModel = !!LE.o.cotModel;
    var thThem = them.map(function (c) {
        return '<th style="width:' + (c.w || 96) + 'px">' + T.esc(c.t) + '</th>';
    }).join('');
    var h = '<div class="row mb8">' +
        (ro ? '' :
        '<button type="button" class="btn sm primary" data-add><i class="bi bi-plus-lg"></i> Thêm dòng</button>' +
        '<button type="button" class="btn sm info-line" data-pick><i class="bi bi-card-checklist"></i> Chọn nhiều hàng hóa</button>' +
        '<button type="button" class="btn sm danger" data-clear><i class="bi bi-x-circle"></i> Xóa hết dòng</button>' +
        '<span class="small muted"><i class="bi bi-info-circle"></i> Bấm vào ô <b>' +
        (theoModel ? 'Model' : 'Mã hàng') + '</b> hoặc ' +
        '<b>Tên hàng</b> để mở danh mục — không phải gõ tay</span>') +
        '<span class="muted small" style="margin-left:auto">' + LE.lines.length + ' dòng hàng</span></div>' +
        '<div class="tablewrap" style="max-height:340px;border-radius:4px;border-top:1px solid var(--line)">' +
        '<table class="lines-tb"><thead><tr>' +
        '<th style="width:36px" class="ctr">TT</th>' +
        (theoModel
            ? '<th>Tên hàng hóa</th><th style="width:170px">Model</th>'
            : '<th style="width:170px">Mã hàng</th><th>Tên hàng hóa</th>') +
        '<th style="width:62px">ĐVT</th><th style="width:86px">Số lượng</th>' + thThem + '<th style="width:126px">Đơn giá</th>' +
        '<th style="width:62px">CK %</th><th style="width:136px">Thành tiền</th>' + (ro ? '' : '<th style="width:36px"></th>') +
        '</tr></thead><tbody>';
    if (!LE.lines.length) {
        h += '<tr><td colspan="' + ((ro ? 8 : 9) + them.length) + '"><div class="empty" style="padding:26px">' +
             '<i class="bi bi-list-ul"></i><b>Chưa có dòng hàng nào</b>Bấm “Thêm dòng” hoặc “Chọn nhiều hàng hóa”.</div></td></tr>';
    }
    LE.lines.forEach(function (l, i) {
        var tt = (Number(l.soLuong) || 0) * (Number(l.donGia) || 0) * (1 - (Number(l.ckPhanTram) || 0) / 100);
        /* MÃ HÀNG / MODEL VÀ TÊN HÀNG KHÔNG GÕ TAY — bấm vào là mở Popup chọn
           hàng hóa của Danh mục. Chọn xong hệ thống tự điền dữ liệu liên quan. */
        var hh0 = l.hangHoaId ? DB.get('hangHoa', l.hangHoaId) : null;
        var moHinh = l.model || (hh0 && hh0.model) || '';
        var oMa = '<td>' + (ro
                ? '<span class="mono small">' + T.esc(l.maHang) + '</span>'
                : '<button type="button" class="md-o mono" data-pk="ma" title="Bấm để chọn hàng hóa từ danh mục">' +
                  '<span class="t' + (l.maHang ? '' : ' ph') + '">' + T.esc(l.maHang || 'Chọn…') + '</span>' +
                  '<i class="bi bi-search"></i></button>') + '</td>';
        var oModel = '<td>' + (ro
                ? '<span class="mono small">' + T.esc(moHinh) + '</span>'
                : '<button type="button" class="md-o mono" data-pk="ma" title="Bấm để chọn hàng hóa từ danh mục">' +
                  '<span class="t' + (moHinh ? '' : ' ph') + '">' + T.esc(moHinh || 'Chọn…') + '</span>' +
                  '<i class="bi bi-search"></i></button>') + '</td>';
        var oTen = '<td>' + (ro
                ? '<span class="ellip">' + T.esc(l.tenHang) + '</span>'
                : '<button type="button" class="md-o" data-pk="ten" title="Bấm để chọn hàng hóa từ danh mục">' +
                  '<span class="t' + (l.tenHang ? '' : ' ph') + '">' +
                  T.esc(l.tenHang || 'Bấm để chọn hàng hóa…') + '</span>' +
                  '<i class="bi bi-chevron-down"></i></button>') +
                (!theoModel && hh0 && hh0.model && hh0.model !== l.maHang
                    ? '<div class="small muted ellip">Model ' + T.esc(hh0.model) + '</div>' : '') + '</td>';
        h += '<tr data-i="' + i + '">' +
            '<td class="ctr muted">' + (i + 1) + '</td>' +
            (theoModel ? oTen + oModel : oMa + oTen) +
            '<td><input data-l="dvt" value="' + T.esc(l.dvt) + '" ' + (ro ? 'disabled' : '') + ' style="text-align:center"></td>' +
            '<td><input class="num sl" data-l="soLuong" value="' + T.esc(T.soVe(l.soLuong, 2)) + '" ' + (ro ? 'disabled' : '') + '></td>' +
            them.map(function (c) {
                return '<td><input class="' + (c.so ? 'num sl' : '') + '" data-l="' + c.k + '" value="' +
                    T.esc(c.so ? T.soVe(l[c.k] === undefined || l[c.k] === '' ? l.soLuong : l[c.k], 2)
                               : (l[c.k] || '')) + '" ' + (ro ? 'disabled' : '') + '></td>';
            }).join('') +
            '<td><input class="num tien" data-l="donGia" value="' + T.esc(T.soVe(l.donGia)) + '" ' + (ro ? 'disabled' : '') + '></td>' +
            '<td><input class="num tyle" data-l="ckPhanTram" value="' + T.esc(T.soVe(l.ckPhanTram || 0, 2)) + '" ' + (ro ? 'disabled' : '') + '></td>' +
            '<td class="num b" data-tt>' + T.money(tt) + '</td>' +
            (ro ? '' : '<td class="ctr"><button type="button" class="line-del" data-del title="Xóa dòng"><i class="bi bi-x-lg"></i></button></td>') +
            '</tr>';
    });
    h += '</tbody></table></div>';
    LE.host.innerHTML = h;
    LE.bind();
    if (LE.o.onChange) LE.o.onChange(LE.lines);
};
LineEditor.prototype.bind = function () {
    var LE = this, host = LE.host;
    var soThem = {};
    (LE.o.cotThem || []).forEach(function (c) { if (c.so) soThem[c.k] = 1; });
    /* "Thêm dòng" cũng mở Popup chọn hàng hóa — chứng từ không bao giờ bắt
       người dùng gõ tay Mã hàng / Model / Tên hàng. */
    var a = host.querySelector('[data-add]');
    if (a) a.onclick = function () { LE.pick(); };
    var p = host.querySelector('[data-pick]');
    if (p) p.onclick = function () { LE.pick(); };
    var c = host.querySelector('[data-clear]');
    if (c) c.onclick = function () {
        if (!LE.lines.length) return;
        UI.confirm({ title: 'Xóa toàn bộ dòng hàng', danger: true, message: 'Xóa hết <b>' + LE.lines.length + '</b> dòng hàng của chứng từ này?',
            okText: 'Xóa hết', ok: function () { LE.lines.length = 0; LE.draw(); UI.toast('ok', 'Đã xóa toàn bộ dòng hàng'); } });
    };
    host.querySelectorAll('tbody tr[data-i]').forEach(function (tr) {
        var i = Number(tr.getAttribute('data-i'));
        tr.querySelectorAll('[data-l]').forEach(function (inp) {
            var k = inp.getAttribute('data-l');
            inp.oninput = function () {
                LE.lines[i][k] = (k === 'soLuong' || k === 'donGia' || k === 'ckPhanTram' || soThem[k])
                    ? T.so(inp.value) : inp.value;
                if (k === 'donGia') {
                    var l0 = LE.lines[i];
                    l0.suaTay = true;                                 // giá do người dùng tự nhập
                    var bgNow = LE.o.bangGia ? LE.o.bangGia() : '';
                    var dvNow = LE.o.donVi ? LE.o.donVi() : DB.data._meta.ctyId;
                    l0.giaBangGia = bgNow ? T.donGiaChungTu(l0, bgNow, dvNow,
                        LE.o.ngay ? LE.o.ngay() : T.today(), null,
                        LE.o.cotGia ? LE.o.cotGia() : '').gia : 0;   // giá gốc của bảng giá, để ghi nhật ký
                }
                var tt = (Number(LE.lines[i].soLuong) || 0) * (Number(LE.lines[i].donGia) || 0) * (1 - (Number(LE.lines[i].ckPhanTram) || 0) / 100);
                tr.querySelector('[data-tt]').textContent = T.money(tt);
                if (LE.o.onChange) LE.o.onChange(LE.lines);
            };
        });
        /* Ô Mã hàng / Tên hàng: bấm là mở Popup chọn hàng hóa cho ĐÚNG dòng này. */
        tr.querySelectorAll('[data-pk]').forEach(function (b) {
            b.onclick = function () { LE.chonCho(i); };
        });
        var d = tr.querySelector('[data-del]');
        if (d) d.onclick = function () { LE.lines.splice(i, 1); LE.draw(); };
    });
};
/** Ngữ cảnh giá của chứng từ — dùng để dựng cột giá của Popup chọn hàng hóa. */
LineEditor.prototype.ctx = function () {
    var LE = this;
    return {
        giaMua: !!LE.o.giaMua,
        bangGiaId: LE.o.bangGia ? LE.o.bangGia() : '',
        cotGia: LE.o.cotGia ? LE.o.cotGia() : '',
        donViId: LE.o.donVi ? LE.o.donVi() : (DB.data._meta || {}).ctyId,
        ngay: LE.o.ngay ? LE.o.ngay() : T.today()
    };
};
/** Điền một mặt hàng vào một dòng — liên kết bằng ID nội bộ, giá lấy theo bảng giá. */
LineEditor.prototype.datHang = function (i, hh) {
    var LE = this, l = LE.lines[i];
    if (!l || !hh) return;
    l.hangHoaId = hh.id;
    l.maHang = hh.ma; l.tenHang = hh.ten; l.dvt = hh.dvt;
    l.model = hh.model || hh.ma; l.thongSo = hh.thongSo || '';
    if (!l.suaTay) l.donGia = LE.o.giaMua ? T.giaVonBQ(hh) : LE.donGiaBan(hh);
};
/** Popup chọn hàng hóa cho MỘT dòng — thay mặt hàng của đúng dòng đó. */
LineEditor.prototype.chonCho = function (i) {
    var LE = this, l = LE.lines[i];
    if (!l) return;
    W.popupMD('hangHoa', {
        ctx: LE.ctx(), tim: l.maHang || '',
        tieu: 'Chọn hàng hóa cho dòng ' + (i + 1),
        sub: LE.o.giaMua ? 'Đơn giá tự nạp theo giá vốn bình quân hiện tại'
                         : 'Tìm theo mã hàng · model · tên hàng · thông số kỹ thuật · hãng · loại thiết bị',
        onChon: function (hh) {
            l.suaTay = false;
            LE.datHang(i, hh);
            LE.draw();
        }
    });
};
/** Đơn giá bán của một mã hàng theo bảng giá của chứng từ (có xét ngày chứng từ). */
LineEditor.prototype.donGiaBan = function (hh) {
    var LE = this;
    var bgId = LE.o.bangGia ? LE.o.bangGia() : '';
    var ngay = LE.o.ngay ? LE.o.ngay() : T.today();
    /* Giá bán CHỈ lấy từ Bảng giá, và chỉ khi người dùng đã chọn MỨC GIÁ ÁP
       DỤNG. Chưa chọn mức giá thì để đơn giá trống cho người dùng quyết định —
       hệ thống không tự lấy một cột giá nào. */
    if (!bgId) return 0;
    var cot = LE.o.cotGia ? LE.o.cotGia() : '';
    if (!cot) return 0;
    var dv = LE.o.donVi ? LE.o.donVi() : DB.data._meta.ctyId;
    return T.donGiaChungTu(hh, bgId, dv, ngay, null, cot).gia;
};

/**
 * POPUP CHỌN NHIỀU HÀNG HÓA — dùng chung Bộ chọn Master Data.
 * Tìm theo mã hàng · model · tên hàng · một phần tên · thông số kỹ thuật · hãng
 * · loại thiết bị. Bảng hiện đủ Mã hàng · Model · Tên hàng · ĐVT · Tồn kho và
 * TOÀN BỘ mức giá của bảng giá đang áp dụng.
 */
LineEditor.prototype.pick = function (tim) {
    var LE = this, giaMua = !!LE.o.giaMua;
    var bgId = LE.o.bangGia ? LE.o.bangGia() : '';
    var tenBG = (DB.get('bangGiaBan', bgId) || {}).ten || 'chưa chọn bảng giá';
    W.popupMD('hangHoa', {
        nhieu: true, tim: tim || '', ctx: LE.ctx(),
        tieu: 'Chọn hàng hóa đưa vào chứng từ',
        sub: giaMua ? 'Đơn giá tự nạp theo giá vốn bình quân hiện tại'
                    : 'Đơn giá tự nạp theo bảng giá: ' + tenBG,
        onChon: function (ds) {
            var n = 0;
            ds.forEach(function (hh) {
                /* Gộp theo ID NỘI BỘ, không gộp theo Model: hai mặt hàng cùng
                   Model là hai dòng hàng riêng trên chứng từ. */
                var ex = LE.lines.filter(function (l) { return T.idDong(l) === hh.id; })[0];
                if (ex) { ex.soLuong = (Number(ex.soLuong) || 0) + 1; return; }
                LE.lines.push({ hangHoaId: hh.id, maHang: hh.ma, tenHang: hh.ten,
                                model: hh.model || hh.ma, thongSo: hh.thongSo || '',
                                dvt: hh.dvt, soLuong: 1,
                                donGia: giaMua ? T.giaVonBQ(hh) : LE.donGiaBan(hh), ckPhanTram: 0 });
                n++;
            });
            LE.draw();
            UI.toast('ok', 'Đã thêm ' + (n || ds.length) + ' mặt hàng vào chứng từ');
        }
    });
};
W.LineEditor = LineEditor;

/* ==========================================================================
   KHỐI TỔNG TIỀN
   ========================================================================== */
function veTong(host, lines, vatPct) {
    var t = T.tinhTong(lines, vatPct);
    host.innerHTML = '<div class="totals"><table><tr><td>Cộng tiền hàng:</td><td>' + T.money(t.thanhTien) + ' đ</td></tr>' +
        '<tr><td>Thuế GTGT (' + vatPct + '%):</td><td>' + T.money(t.vat) + ' đ</td></tr>' +
        '<tr class="big"><td>TỔNG CỘNG:</td><td>' + T.money(t.tongCong) + ' đ</td></tr>' +
        '<tr><td colspan="2" class="small muted" style="text-align:right;font-style:italic">' + T.docTien(t.tongCong) + '</td></tr></table></div>';
    return t;
}

/* ==========================================================================
   NHẬP CHỨNG TỪ TỪ EXCEL — dùng chung cho mọi loại chứng từ
   Mỗi dòng Excel là MỘT DÒNG HÀNG. Các dòng cùng "Số chứng từ" gộp thành
   một chứng từ. Kiểm tra từng dòng, dòng lỗi bị bỏ qua và báo rõ lý do.
   ========================================================================== */
function doiTacCua(cfg) {
    return cfg.doiTac || { coll: 'khachHang', idF: 'khachHangId', tenF: 'khachHang', nhan: 'Khách hàng' };
}
/* Nhãn cột đầu chứng từ theo từng loại — tệp mẫu tự sinh theo đúng cấu trúc này. */
var NHAN_CT = {
    baoGia:  { so: 'Số báo giá',   ngay: 'Ngày báo giá' },
    donBan:  { so: 'Số đơn',       ngay: 'Ngày' },
    hopDong: { so: 'Số hợp đồng',  ngay: 'Ngày ký' }
};
function nhanCua(cfg) {
    return NHAN_CT[cfg.key] || { so: 'Số chứng từ', ngay: 'Ngày' };
}
/* Cột riêng ở phần thông tin chung của từng loại chứng từ. */
function cotRieng(cfg) {
    if (cfg.key === 'baoGia') return [
        { t: 'Người liên hệ', k: 'nguoiLienHe', w: 22, kieu: 'Chữ',
          mo: 'Để trống thì lấy người liên hệ đã khai ở Danh mục Khách hàng' },
        { t: 'Điều khoản thanh toán', k: 'dieuKhoanTT', w: 40, kieu: 'Chữ' }
    ];
    if (cfg.key === 'donBan') return [
        { t: 'Điều khoản thanh toán', k: 'dieuKhoanTT', w: 40, kieu: 'Chữ' }
    ];
    if (cfg.key === 'hopDong') return [
        { t: 'Giá trị hợp đồng', k: 'giaTri', w: 20, kieu: 'Số',
          mo: 'Để đối chiếu. Để trống thì hệ thống lấy tổng cộng tính từ các dòng hàng' },
        { t: 'Thời gian thực hiện (ngày)', k: 'soNgayTH', w: 22, kieu: 'Số',
          mo: 'Số ngày kể từ ngày ký. Để trống lấy 90 ngày' },
        { t: 'Điều khoản thanh toán', k: 'dieuKhoanTT', w: 40, kieu: 'Chữ' }
    ];
    return [];
}
function cotNhap(cfg) {
    var dt = doiTacCua(cfg), n = nhanCua(cfg);
    return [
        { t: n.so, k: 'so', w: 20, kieu: 'Chữ',
          mo: 'Các dòng cùng số được gộp thành một chứng từ. Để trống thì hệ thống tự sinh số, ' +
              'các dòng trống số cùng ngày và cùng đối tác được gộp làm một chứng từ' },
        { t: n.ngay, k: 'ngay', w: 12, req: true, kieu: 'Ngày' },
        { t: 'Đơn vị phát hành', k: 'donVi', w: 16, kieu: 'Chữ',
          mo: 'Tên viết tắt của công ty phát hành, để trống thì lấy đơn vị đang làm việc' },
        { t: 'Mã ' + dt.nhan.toLowerCase(), k: 'doiTacMa', w: 16, req: true, kieu: 'Chữ',
          mo: 'Mã đã khai trong Danh mục ' + dt.nhan },
        { t: 'Dự án', k: 'duAn', w: 26, kieu: 'Chữ' }
    ].concat(cotRieng(cfg)).concat([
        { t: 'Mã hàng', k: 'maHang', w: 20, req: true, kieu: 'Chữ', mo: 'Mã đã khai trong Danh mục Hàng hóa' },
        { t: 'Tên hàng', k: 'tenHang', w: 42, kieu: 'Chữ', mo: 'Để trống thì lấy theo Danh mục Hàng hóa' },
        { t: 'Đơn vị tính', k: 'dvt', w: 12, kieu: 'Chữ', mo: 'Để trống thì lấy theo Danh mục Hàng hóa' },
        { t: 'Số lượng', k: 'soLuong', w: 12, req: true, kieu: 'Số' },
        { t: 'Đơn giá', k: 'donGia', w: 16, req: true, kieu: 'Số' },
        { t: 'Chiết khấu %', k: 'ckPhanTram', w: 13, kieu: 'Số' },
        { t: 'Thuế GTGT (%)', k: 'vatPct', w: 14, kieu: 'Số', mo: 'Để trống thì lấy 10%' },
        { t: 'Thành tiền', k: 'thanhTien', w: 18, kieu: 'Số',
          mo: 'Không bắt buộc. Có ghi thì hệ thống đối chiếu với số lượng × đơn giá − chiết khấu' },
        { t: 'Ghi chú', k: 'ghiChu', w: 26, kieu: 'Chữ' }
    ]);
}
function dongMau(cfg) {
    var dt = doiTacCua(cfg), n = nhanCua(cfg);
    var r = (cfg.rows() || []).filter(function (x) { return (x.lines || []).length; })[0];
    if (!r) return [];
    var dtRec = DB.get(dt.coll, r[dt.idF]) || {};
    return (r.lines || []).slice(0, 3).map(function (l) {
        var sl = Number(l.soLuong) || 0, dg = Number(l.donGia) || 0, ck = Number(l.ckPhanTram) || 0;
        var o = {};
        o[n.so] = r.so;
        o[n.ngay] = T.date(r.ngay);
        o['Đơn vị phát hành'] = (DB.get('donVi', r.donVi) || {}).tat || '';
        o['Mã ' + dt.nhan.toLowerCase()] = dtRec.ma || '';
        o['Dự án'] = r.duAn || '';
        if (cfg.key === 'baoGia') {
            o['Người liên hệ'] = r.nguoiLienHe || dtRec.nguoiLienHe || '';
            o['Điều khoản thanh toán'] = r.dieuKhoanTT || r.dieuKhoan || '';
        } else if (cfg.key === 'donBan') {
            o['Điều khoản thanh toán'] = r.dieuKhoanTT || '';
        } else if (cfg.key === 'hopDong') {
            o['Giá trị hợp đồng'] = Number(r.tongCong) || 0;
            o['Thời gian thực hiện (ngày)'] = 90;
            o['Điều khoản thanh toán'] = r.dieuKhoanTT || '';
        }
        o['Mã hàng'] = l.maHang; o['Tên hàng'] = l.tenHang || ''; o['Đơn vị tính'] = l.dvt || '';
        o['Số lượng'] = sl; o['Đơn giá'] = dg; o['Chiết khấu %'] = ck;
        o['Thuế GTGT (%)'] = r.vatPct === undefined ? 10 : r.vatPct;
        o['Thành tiền'] = Math.round(sl * dg * (1 - ck / 100));
        o['Ghi chú'] = r.ghiChu || '';
        return o;
    });
}

function nhapCT(cfg, g) {
    if (!W.Q.co(cfg.key, 'them')) return UI.thieuQuyen(cfg.key, 'them');
    var dt = doiTacCua(cfg), nh = nhanCua(cfg);
    var gom = {};                       // khóa gộp → { head, lines[] }
    W.nhapDuLieu({
        ten: cfg.title, file: cfg.file || cfg.key, cols: cotNhap(cfg), mau: dongMau(cfg),
        nhomNhan: cfg.dt.toLowerCase(), nhomCot: nh.so,
        nhomTheo: function (o) { return o.khoaGom; },
        /* DANH MỤC HÀNG HÓA LÀ DỮ LIỆU GỐC: chứng từ cũng không được tự sinh ra
           mặt hàng. Dòng nào có mặt hàng chưa nằm trong danh mục thì hỏi người
           dùng trước, không tự tạo và cũng không tự bỏ qua. */
        truocGhi: cfg.taoHangHoa ? W.chanTaoHangHoa({
            nhanTao: 'Tạo mới hàng hóa và nhập chứng từ',
            nhanBoQua: 'Bỏ qua dòng có hàng chưa có, vẫn nhập chứng từ',
            nhanHuy: 'Hủy nhập',
            moTaBoQua: 'không ghi gì cả, không chứng từ nào được tạo'
        }) : null,
        kiemTra: function (r) {
            var kt = W.KT(r), o = {};

            /* --- thông tin chung --- */
            o.so = kt.chu(nh.so);
            o.ngay = kt.ngay(nh.ngay, { req: true });
            var tat = kt.o('Đơn vị phát hành');
            var dv = tat ? kt.tra('Đơn vị phát hành', 'donVi', 'Đơn vị phát hành') : DB.cty();
            o.donVi = dv ? dv.id : '';
            var rec = kt.tra('Mã ' + dt.nhan.toLowerCase(), dt.coll, dt.nhan, { req: true });
            o.doiTacId = rec ? rec.id : ''; o.doiTacTen = rec ? rec.ten : '';
            o.doiTacMa = kt.o('Mã ' + dt.nhan.toLowerCase());
            o.duAn = kt.chu('Dự án');

            /* --- trường riêng của từng loại chứng từ --- */
            if (cfg.key === 'baoGia')
                o.nguoiLienHe = kt.chu('Người liên hệ') || (rec ? rec.nguoiLienHe || '' : '');
            if (cfg.key === 'baoGia' || cfg.key === 'donBan' || cfg.key === 'hopDong')
                o.dieuKhoanTT = kt.chu('Điều khoản thanh toán');
            if (cfg.key === 'hopDong') {
                o.giaTriKhai = kt.tien('Giá trị hợp đồng');
                o.soNgayTH = kt.so('Thời gian thực hiện (ngày)', { min: 1, mac: 90 });
                if (!o.soNgayTH) o.soNgayTH = 90;
            }

            /* --- dòng hàng --- */
            var hh, kq = null;
            if (cfg.taoHangHoa) {          // đơn mua · báo giá · đơn bán: mã hàng mới được tự tạo khi xác nhận
                kq = W.hangHoaChoDong(kt, { ma: 'Mã hàng', ten: 'Tên hàng', dvt: 'Đơn vị tính' });
                hh = kq ? (kq.hh || kq.moi) : null;
                o.hhKq = kq;
            } else {
                hh = kt.tra('Mã hàng', 'hangHoa', 'Hàng hóa', { req: true });
            }
            o.maHang = kt.o('Mã hàng');
            o.tenHang = kt.chu('Tên hàng') || (hh ? hh.ten : '');
            o.dvt = kt.o('Đơn vị tính') ? kt.dvt('Đơn vị tính', '') : (hh ? hh.dvt : '');
            o.soLuong = kt.so('Số lượng', { req: true, min: 0.0001, mo: 'số lượng phải lớn hơn 0' });
            o.donGia = kt.tien('Đơn giá', { req: true });
            o.ckPhanTram = kt.pct('Chiết khấu %');
            o.vatPct = kt.o('Thuế GTGT (%)') === '' ? 10 : kt.pct('Thuế GTGT (%)');
            o.ghiChu = kt.chu('Ghi chú');

            /* --- đối chiếu thành tiền nếu người dùng có ghi --- */
            var tt = kt.o('Thành tiền');
            if (tt !== '') {
                var khai = kt.tien('Thành tiền');
                var tinh = Math.round(o.soLuong * o.donGia * (1 - o.ckPhanTram / 100));
                if (Math.abs(khai - tinh) > 1)
                    kt.them('Thành tiền',
                        'thành tiền ' + T.money(khai) + ' lệch với số lượng × đơn giá − chiết khấu = ' + T.money(tinh),
                        'Sửa lại Số lượng, Đơn giá, Chiết khấu % hoặc Thành tiền cho khớp, ' +
                        'hoặc để trống cột Thành tiền để hệ thống tự tính.');
            }

            /* Khóa gộp: theo số chứng từ; nếu để trống thì gộp theo ngày và đối tác. */
            o.khoaGom = o.so ? T.kd(o.so) : ('#' + o.ngay + '|' + T.kd(o.doiTacMa || ''));
            return { o: kt.co() ? null : o, loi: kt.loi, canhBao: kt.canhBao };
        },
        ghi: function (o) {
            /* Liên kết bằng CHÍNH bản ghi vừa nhận diện hoặc vừa tạo. Suy lại
               ID từ chuỗi Mã hàng là sai: một Model dùng chung nhiều mặt hàng
               thì chỉ mục đánh dấu "nhiều" và trả về rỗng — dòng chứng từ mất
               liên kết dù hệ thống đã biết chắc là mặt hàng nào. */
            var hhm = o.hhKq ? W.chotHangHoa(o.hhKq) : null;
            if (hhm && !o.dvt) o.dvt = hhm.dvt || '';
            if (!gom[o.khoaGom]) gom[o.khoaGom] = { head: o, lines: [] };
            var dong = {
                hangHoaId: (hhm && hhm.id) || T.idDong(o),
                maHang: (hhm && hhm.ma) || o.maHang, tenHang: o.tenHang, dvt: o.dvt,
                soLuong: o.soLuong, donGia: o.donGia, ckPhanTram: o.ckPhanTram
            };
            if (hhm) T.ganIdDong(dong, hhm);
            gom[o.khoaGom].lines.push(dong);
        },
        xong: function () {
            var n = 0, lech = [];
            Object.keys(gom).forEach(function (khoa) {
                var x = gom[khoa], hd = x.head;
                var o = cfg.blank();
                o.so = hd.so || DB.soMoi(cfg.seq);
                o.ngay = hd.ngay; o.donVi = hd.donVi;
                o[dt.idF] = hd.doiTacId; o[dt.tenF] = hd.doiTacTen;
                if (o.duAn !== undefined) o.duAn = hd.duAn;
                if (hd.nguoiLienHe) o.nguoiLienHe = hd.nguoiLienHe;
                if (hd.dieuKhoanTT) {
                    if (o.dieuKhoanTT !== undefined) o.dieuKhoanTT = hd.dieuKhoanTT;
                    else o.dieuKhoan = hd.dieuKhoanTT;
                }
                o.ghiChu = hd.ghiChu; o.vatPct = hd.vatPct; o.lines = x.lines;
                var t = T.tinhTong(o.lines, o.vatPct);
                o.thanhTien = t.thanhTien; o.vat = t.vat; o.tongCong = t.tongCong;
                if (o.giaTri !== undefined) o.giaTri = t.tongCong;
                if (cfg.key === 'hopDong') {
                    if (hd.soNgayTH) o.ngayKetThuc = T.addDays(o.ngay, hd.soNgayTH);
                    o.ngayHieuLuc = o.ngay;
                    if (hd.giaTriKhai && Math.abs(hd.giaTriKhai - t.tongCong) > 1)
                        lech.push(o.so);
                }
                o.maGD = DB.maGDMoi();
                T.dongBangGiaVon(o);
                DB.insert(cfg.key, o); n++;
            });
            gom = {};
            g.reload(cfg.rows()); W.route();
            if (n) UI.toast('ok', 'Đã tạo ' + n + ' ' + cfg.dt.toLowerCase(),
                'Chứng từ đã liên kết với danh mục, bảng giá, công nợ và báo cáo.' +
                (lech.length ? ' Lưu ý: giá trị khai trong tệp lệch với tổng tính từ dòng hàng ở ' +
                    lech.join(', ') + ' — hệ thống lấy tổng tính từ dòng hàng.' : ''), 6000);
        }
    });
}

/* ==========================================================================
   CHIẾT KHẤU NỘI BỘ TRÊN CHỨNG TỪ BÁN HÀNG
   Giá phân phối của công ty nguồn là giá gốc nội bộ của các công ty còn lại.
   Chiết khấu nội bộ khai theo TỪNG CHỨNG TỪ, không làm thay đổi Bảng giá.
   Công ty thực hiện là công ty nguồn thì không có giá mua nội bộ.
   ========================================================================== */
/* KHÔNG CÒN THAO TÁC NỘI BỘ NÀO TRÊN GIAO DIỆN.
   Giá bán nội bộ từ Tản Viên sang đơn vị phát hành do Business Rule Engine tự
   suy luận theo chính sách giá nội bộ đã khai, không phải khai lại trên từng
   chứng từ. Giữ lại hàm rỗng để mọi nơi gọi cũ không hỏng. */
W.noiChietKhauNoiBo = function () { };

/* ==========================================================================
   KHUNG MÀN HÌNH CHỨNG TỪ
   ========================================================================== */
function DocScreen(host, cfg) {
    var g, Q = W.Q, mod = cfg.key;
    var qThem = Q.co(mod, 'them'), qSua = Q.co(mod, 'sua'), qXoa = Q.co(mod, 'xoa'),
        qDuyet = Q.co(mod, 'duyet'), qKhoa = Q.co(mod, 'khoa'), qIn = Q.co(mod, 'in');
    host.innerHTML =
        '<div class="page">' +
          '<div class="page-head"><div><h2>' + T.esc(cfg.title) + '</h2><div class="sub">' + cfg.sub + '</div></div>' +
          '<div class="spacer"></div>' + (cfg.headExtra || '') + '</div>' +
          (cfg.tabKho && W.tabKho ? W.tabKho(cfg.tabKho) : '') +
          (cfg.banner || '') + '<div id="gh"></div></div>';
    W.crumb(cfg.crumb);
    if (cfg.tabKho && W.bindTabKho) W.bindTabKho(host);

    var tb = (cfg.khongLapTay
            ? '<button class="btn primary" data-veNguon><i class="bi bi-arrow-left-circle"></i> ' + cfg.khongLapTay.nut + '</button>'
            : '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Lập ' + cfg.dt + '</button>') +
        '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
        '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
        '<button class="btn" data-chep disabled><i class="bi bi-files"></i> Sao chép</button>' +
        '<span class="tb-sep"></span>' +
        '<button class="btn" data-hoso disabled><i class="bi bi-diagram-3"></i> Hồ sơ liên quan</button>' +
        (cfg.duyet ? '<button class="btn ok" data-duyet disabled><i class="bi bi-check2-circle"></i> Duyệt</button>' : '') +
        '<button class="btn" data-khoa disabled><i class="bi bi-lock"></i> Khóa / Mở khóa</button>' +
        '<button class="btn ok" data-next disabled><i class="bi bi-arrow-right-circle"></i> Tạo chứng từ tiếp theo</button>' +
        '<span class="tb-sep"></span>' +
        (cfg.khongLapTay ? '' :
            '<button class="btn" data-mau><i class="bi bi-file-earmark-arrow-down"></i> Tải mẫu Excel</button>' +
            '<button class="btn" data-nhap><i class="bi bi-upload"></i> Nhập Excel</button>') +
        '<button class="btn" data-xuat title="Xuất nguyên dữ liệu của bảng đang xem ra tệp Excel — không áp dụng biểu mẫu, phục vụ xử lý dữ liệu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
        '<button class="btn" data-lam><i class="bi bi-arrow-clockwise"></i> Làm mới</button>';

    g = new UI.Grid({
        mount: '#gh', rows: cfg.rows(), cols: cfg.cols, filters: cfg.filters, search: cfg.search,
        pageSize: DB.data._meta.pageSize || 20,
        height: cfg.banner ? 'calc(100vh - 412px)' : 'calc(100vh - 342px)', toolbar: tb,
        sortK: 'ngay', sortD: -1, chon: true,
        emptyTitle: 'Chưa có ' + cfg.dt.toLowerCase() + ' nào',
        emptyText: 'Bấm “Lập ' + cfg.dt + '” để tạo chứng từ đầu tiên.',
        actions: function () {
            /* Nút trên dòng luôn hiện và luôn bấm được — chứng từ đã khóa thì hệ
               thống giải thích khi bấm, không tắt nút. */
            return UI.btn('xem', 'bi-eye', 'Xem chứng từ') +
                (qSua ? UI.btn('sua', 'bi-pencil', 'Sửa') : '') +
                (qXoa ? UI.btn('xoa', 'bi-trash', 'Xóa', 'danger') : '');
        }, actionsW: 110,
        onAction: function (a, r) {
            if (a === 'sua') form(r); else if (a === 'xem') form(r, true);
            else if (a === 'xoa') xoa(r);
        },
        /* Thanh công cụ chỉ phụ thuộc việc ĐÃ CHỌN DÒNG hay chưa. Ràng buộc nghiệp
           vụ (đã khóa, đã duyệt…) được kiểm tra và giải thích khi bấm. */
        onSelect: UI.chonToolbar(host, ['sua', 'xoa', 'chep', 'hoso', 'next', 'duyet', 'khoa', 'in'],
            function (r) {
                var bk = host.querySelector('[data-khoa]');
                if (bk) bk.innerHTML = (r && r.khoa)
                    ? '<i class="bi bi-unlock"></i> Mở khóa'
                    : '<i class="bi bi-lock"></i> Khóa / Mở khóa';
            }),
        onOpen: function (r) { form(r, true); }
    });

    UI.apQuyen(host, mod);
    W.hangLoat(host, g, {
        mod: mod, coll: cfg.key, dt: cfg.dt, file: cfg.file, excel: cfg.excel, rows: cfg.rows,
        trangThai: cfg.khoaTrangThai ? null : cfg.trangThaiDS,
        duyetTT: cfg.duyet && cfg.duyet.tt, huyDuyetTT: cfg.stFirst,
        inCT: true, nguoiLap: true,
        suaTruong: [
            { k: 'ngay', t: 'Ngày chứng từ', type: 'date' },
            { k: 'duAn', t: 'Dự án / công trình', type: 'text' },
            { k: 'donVi', t: 'Đơn vị phát hành', type: 'select',
              opts: DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat }; }) },
            { k: 'ghiChu', t: 'Ghi chú', type: 'text' }
        ].concat(cfg.khoaTrangThai ? []
            : [{ k: 'trangThai', t: 'Trạng thái', type: 'select', opts: cfg.trangThaiDS || [] }])
    });
    var qs = function (sel) { return host.querySelector(sel); };
    if (qs('[data-veNguon]')) qs('[data-veNguon]').onclick = function () { W.go(cfg.khongLapTay.route); };
    if (qs('[data-them]')) qs('[data-them]').onclick = function () { form(null); };
    if (qs('[data-sua]')) qs('[data-sua]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (r.khoa) return UI.khongThe('Sửa ' + cfg.dt.toLowerCase(),
            'Chứng từ ' + r.so + ' đang bị khóa.',
            'Bấm “Mở khóa” trên thanh công cụ rồi sửa lại.');
        form(r);
    };
    if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () { var r = g.selected(); if (r) xoa(r); };
    qs('[data-hoso]').onclick = function () { var r = g.selected(); if (r) W.xemHoSo(cfg.key, r.id); };
    if (qs('[data-mau]')) qs('[data-mau]').onclick = function () {
        W.tepMauNhap({ ten: cfg.title, file: cfg.file || cfg.key,
                       cols: cotNhap(cfg), mau: dongMau(cfg) });
    };
    if (qs('[data-nhap]')) qs('[data-nhap]').onclick = function () { nhapCT(cfg, g); };
    if (qs('[data-duyet]')) qs('[data-duyet]').onclick = function () {
        var r = g.selected(); if (!r) return;
        if (r.khoa) return UI.khongThe('Duyệt ' + cfg.dt.toLowerCase(),
            'Chứng từ ' + r.so + ' đang bị khóa nên không thay đổi trạng thái được.',
            'Bấm “Mở khóa” trên thanh công cụ rồi duyệt lại.');
        if (cfg.duyet && r.trangThai === cfg.duyet.tt)
            return UI.khongThe('Duyệt ' + cfg.dt.toLowerCase(),
                'Chứng từ ' + r.so + ' đã ở trạng thái “' + cfg.duyet.tt + '”.',
                'Chứng từ này đã được duyệt rồi, không cần duyệt lại.');
        UI.confirm({
            title: 'Duyệt ' + cfg.dt.toLowerCase(), icon: 'bi-check2-circle',
            message: 'Duyệt chứng từ <b>' + T.esc(r.so) + '</b> — ' + T.money(r.tongCong) + ' đ?',
            note: 'Trạng thái sẽ chuyển sang <b>' + cfg.duyet.tt + '</b>.',
            okText: 'Duyệt', okIcon: 'bi-check2-circle',
            ok: function () {
                r.trangThai = cfg.duyet.tt; r._duyetBoi = DB.user().hoTen; r._duyetLuc = T.now();
                DB.log('Duyệt', cfg.key, r); DB.save(); g.reload(cfg.rows()); W.route();
                UI.toast('ok', 'Đã duyệt ' + cfg.dt.toLowerCase(), r.so);
            }
        });
    };
    if (qs('[data-khoa]')) qs('[data-khoa]').onclick = function () {
        var r = g.selected(); if (!r) return;
        var mo = !!r.khoa;
        UI.confirm({
            title: mo ? 'Mở khóa chứng từ' : 'Khóa chứng từ', icon: mo ? 'bi-unlock' : 'bi-lock-fill',
            message: (mo ? 'Mở khóa' : 'Khóa') + ' chứng từ <b>' + T.esc(r.so) + '</b>?',
            note: mo ? 'Sau khi mở khóa, chứng từ có thể sửa và xóa như bình thường.'
                     : 'Chứng từ đã khóa <b>không sửa và không xóa được</b> cho tới khi được mở khóa.',
            okText: mo ? 'Mở khóa' : 'Khóa', okIcon: mo ? 'bi-unlock' : 'bi-lock',
            ok: function () {
                r.khoa = !mo; r._khoaBoi = DB.user().hoTen; r._khoaLuc = T.now();
                DB.log(mo ? 'Mở khóa' : 'Khóa chứng từ', cfg.key, r); DB.save();
                g.reload(cfg.rows()); W.route();
                UI.toast('ok', mo ? 'Đã mở khóa' : 'Đã khóa chứng từ', r.so);
            }
        });
    };
    if (qs('[data-chep]')) qs('[data-chep]').onclick = function () {
        var r = g.selected(); if (!r) return;
        var c = T.clone(r); delete c.id; c.so = ''; c.ngay = T.today(); c.khoa = false;
        /* BẢN SAO LÀ MỘT THƯƠNG VỤ KHÁC. Giữ lại mã giao dịch của bản gốc thì
           Business Engine thấy hai chứng từ cùng một giao dịch và ghi nhận
           doanh thu hai lần. Cắt luôn cả các liên kết cha để bản sao đứng độc
           lập, người dùng gắn lại đúng chứng từ nguồn nếu cần. */
        c.maGD = '';
        ['baoGiaId', 'baoGiaSo', 'donBanId', 'donBanSo', 'hopDongId', 'hopDongSo',
         'phuLucId', 'phuLucSo', 'phieuXuatId', 'phieuXuatSo',
         'bienBanGiaoId', 'bienBanGiaoSo', 'bienBanNTId', 'bienBanNTSo'].forEach(function (k) {
            if (c[k] !== undefined) c[k] = '';
        });
        c.trangThai = cfg.stFirst; form(c, false, true);
    };
    qs('[data-lam]').onclick = function () {
        g.q = ''; g.f = {}; g.reload(cfg.rows()); UI.toast('info', 'Đã làm mới danh sách');
    };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        UI.xuatExcel(cfg.file, cfg.title, cfg.excel, g.allRows);
    };
    if (qs('[data-next]')) qs('[data-next]').onclick = function () {
        var r = g.selected();
        if (r) W.buocTiep(r, function () { g.reload(cfg.rows()); W.route(); }, cfg.key);
    };

    /* Xóa theo CHUẨN CHUNG — xem mod-xoa.js. */
    function xoa(r) {
        UI.xoaChuan({
            coll: cfg.key, rec: r, mod: mod, ten: cfg.dt + ' ' + r.so,
            sauKhi: function () { g.selId = null; g.reload(cfg.rows()); W.route(); }
        });
    }

    function form(rec, ro, isCopy) {
        var moi = !rec || !rec.id;
        if (!ro) {
            if (moi && !qThem) return UI.thieuQuyen(mod, 'them');
            if (!moi && !qSua) ro = true;
            if (!moi && rec && rec.khoa) { UI.daKhoa(rec); ro = true; }
        }
        rec = rec ? T.clone(rec) : cfg.blank();
        var lines = rec.lines || [];
        var LE = null, mucGia = rec.mucGia || 'BANLE', vat = rec.vatPct === undefined ? 10 : rec.vatPct;
        var bangGiaId = rec.bangGiaId || '';

        UI.modal({
            size: 'full', dismiss: false,
            title: (ro ? 'Xem ' : moi ? 'Lập ' : 'Sửa ') + cfg.dt + (rec.so ? ' — ' + rec.so : ''),
            sub: 'Đơn vị phát hành: ' + DB.cty().ten,
            body: '<div id="dfHead"></div>' +
                  /* Chứng từ khai KHÔNG có dòng hàng hóa — ví dụ Đề nghị thanh
                     toán / tạm ứng: số tiền do người lập tự khai, không kê hàng. */
                  (cfg.khongDongHang ? '' :
                  '<div class="card mt12"><div class="card-h"><i class="bi bi-list-ul"></i> Chi tiết hàng hóa' +
                  '<span class="spacer"></span><span class="small muted" id="mucLb"></span></div>' +
                  '<div class="card-b"><div id="dfLines"></div>' +
                  '<div class="row mt12" style="align-items:flex-start">' +
                  '<div class="fld" style="width:190px"><label>Thuế suất GTGT (%)</label>' +
                  W.oThueSuat(vat, ro) + '</div>' +
                  '<div style="flex:1"></div><div id="dfTong"></div></div>' +
                  '</div></div>') +
                  (rec.id ? '<div id="dfHoSo" class="mt12"></div>' : ''),
            buttons: ro ? ([{ text: 'Đóng', click: function (h) { h.close(); } }]
                .concat(rec.id ? [{ text: 'Tạo chứng từ tiếp theo', icon: 'bi-arrow-right-circle', click: function (h) {
                        h.close(); W.buocTiep(rec, function () { W.route(); }, cfg.key); } }] : [])
                .concat(qIn ? [{ text: 'Xuất PDF', icon: 'bi-file-earmark-pdf',
                        click: function () { W.xuatPDF(cfg.key, rec); } }] : [])
                .concat(qIn ? [{ text: 'Xuất Word', icon: 'bi-file-earmark-word',
                        click: function () { W.xuatWordChungTu(cfg.key, rec); } }] : [])
                .concat(W.Q.co(mod, 'excelXuat') ? [{ text: 'Xuất Excel (Biểu mẫu)', icon: 'bi-file-earmark-spreadsheet',
                        click: function () { W.xuatExcelMauChungTu(cfg.key, rec); } }] : [])
                .concat(qSua && !rec.khoa ? [{ text: 'Sửa', icon: 'bi-pencil',
                        click: function (h) { h.close(); form(rec); } }] : [])
                .concat(qIn ? [{ text: 'Xem trước khi in', cls: 'primary', icon: 'bi-printer',
                        click: function () { W.inChungTu(cfg.key, rec); } }] : [])
            ) : [
                { text: 'Hủy', icon: 'bi-x-lg', click: function (h) {
                    UI.confirm({ title: 'Hủy thao tác', message: 'Bỏ qua các thay đổi chưa lưu?', okText: 'Bỏ qua',
                        ok: function () {
                            h.close();
                            if (W.__huyLuu) { var f = W.__huyLuu; W.__huyLuu = null; W.__sauLuu = null; f(); }
                        } }); } },
                { text: 'Lưu và xem trước', icon: 'bi-printer', click: function (h) { luu(h, rec, moi, isCopy, lines, true); } },
                { text: 'Lưu', cls: 'primary', icon: 'bi-check-lg', click: function (h) { luu(h, rec, moi, isCopy, lines); } }
            ].filter(function (b) { return b.text !== 'Lưu và xem trước' || qIn; }),
            onOpen: function (h) {
                h.q('#dfHead').innerHTML = cfg.head(rec, moi, ro);
                UI.numInput(h.el);
                /* Nối toàn bộ ô chọn Master Data của phần đầu chứng từ — dropdown,
                   gõ từ khóa, popup chọn đầy đủ và tạo mới ngay tại chứng từ. */
                h._md = W.bindMD(h.el, function () {
                    return { bangGiaId: bangGiaId, donViId: (h.q('[data-f="donVi"]') || {}).value ||
                                 rec.donVi || DB.data._meta.ctyId,
                             cotGia: (h.q('[data-f="cotGia"]') || {}).value || '',
                             ngay: (h.q('[data-f="ngay"]') || {}).value || T.today() };
                });
                if (cfg.onHead) cfg.onHead(h, rec,
                    function (m) { mucGia = m; capNhatMuc(h, m, lines, LE); }, moi, ro,
                    // đặt bảng giá bán đang áp dụng cho chứng từ (dùng ở màn Báo giá / Đơn bán)
                    function (id, veLai) {
                        bangGiaId = id || '';
                        if (veLai !== false) capNhatMuc(h, mucGia, lines, LE);
                    });
                if (!cfg.khongDongHang) {
                    LE = h._LE = new LineEditor(h.q('#dfLines'), lines, {
                        readonly: ro, cotThem: cfg.cotDongThem || null,
                        mucGia: function () { return mucGia; },
                        bangGia: function () { return bangGiaId; },
                        cotGia: function () {
                            var e = h.q('[data-f="cotGia"]');
                            return e ? e.value : (rec.cotGia || '');
                        },
                        donVi: function () {
                            var e = h.q('[data-f="donVi"]');
                            return (e && e.value) || rec.donVi || DB.data._meta.ctyId;
                        },
                        ngay: function () { var e = h.q('[data-f="ngay"]'); return e ? e.value : T.today(); },
                        onChange: function (ls) { veTong(h.q('#dfTong'), ls, W.docThueSuat(h)); }
                    });
                    W.bindThueSuat(h, function (v) { veTong(h.q('#dfTong'), lines, v); });
                    veTong(h.q('#dfTong'), lines, vat);
                    capNhatMuc(h, mucGia, lines, LE, true);
                }
                if (rec.id && h.q('#dfHoSo')) h.q('#dfHoSo').innerHTML = W.hoSoBox(cfg.key, rec.id);
                if (ro) h.el.querySelectorAll('input,select,textarea').forEach(function (e) { e.disabled = true; });
                h._lines = lines;
            }
        });

        function capNhatMuc(h, m, ls, le, first) {
            var lb = h.q('#mucLb');
            var bg = DB.get('bangGiaBan', bangGiaId);
            if (lb) lb.innerHTML = 'Bảng giá áp dụng: <b>' + T.esc(bg ? bg.ten : 'chưa chọn') + '</b>';
            if (first || !le) return;
            /* Chưa chọn mức giá thì không tự lấy đơn giá của bất kỳ cột nào. */
            var oMG = h.q('[data-f="cotGia"]');
            if (oMG && !oMG.value) { le.draw(); return; }
            var n = 0, giu = 0;
            ls.forEach(function (l) {
                /* Giá nội bộ KHÔNG xử lý ở đây. Đổi đơn vị phát hành hay đổi phiên
                   bản bảng giá thì T.dongBangGiaVon tự nhận ra và tính lại khi lưu
                   (dòng có mang theo donViGiaVon / bangGiaGiaVon) — một quy tắc duy
                   nhất trong Engine, không viết xử lý riêng cho từng màn hình. */
                /* ĐƠN GIÁ NGƯỜI DÙNG TỰ NHẬP LÀ BẤT KHẢ XÂM PHẠM — đổi bảng giá,
                   đổi khách hàng hay đổi ngày đều KHÔNG ghi đè dòng đã sửa tay. */
                if (l.suaTay) { giu++; return; }
                var hh = T.hh(l);
                if (hh) { var g = le.donGiaBan(hh); if (g) { l.donGia = g; n++; } }
            });
            le.draw();
            if (n || giu) UI.toast('info', 'Đã cập nhật đơn giá',
                n + ' dòng lấy theo ' + (bg ? bg.ten : 'bảng giá đang chọn') +
                (giu ? ' — giữ nguyên ' + giu + ' dòng anh đã tự nhập giá.' : '.'));
        }

        function luu(h, rec, moi, isCopy, lines, thenPrint) {
            if (!UI.validate(h.el, cfg.rules)) return;
            if (!cfg.khongDongHang) {
                if (!lines.length) { UI.toast('err', 'Chưa có dòng hàng', 'Chứng từ phải có ít nhất một dòng hàng hóa.'); return; }
                var bad = lines.filter(function (l) { return !l.maHang || !(Number(l.soLuong) > 0); });
                if (bad.length) { UI.toast('err', 'Dòng hàng chưa hợp lệ', 'Có ' + bad.length + ' dòng thiếu mã hàng hoặc số lượng ≤ 0.'); return; }
            }
            var v = UI.read(h.el);
            var o = cfg.toObj(v, rec, h);
            /* Phần người dùng tự viết (noiDungRieng) và bản in tự sửa trực tiếp
               (banInRieng) là DỮ LIỆU RIÊNG của chứng từ chứ không phải trường
               nhập liệu — luôn mang theo khi lưu để không bị mất. */
            ['noiDungRieng', 'banInRieng'].forEach(function (k) {
                if (o[k] === undefined && rec[k] !== undefined) o[k] = rec[k];
            });
            /* PHIÊN BẢN BẢNG GIÁ ĐÃ CHỐT là dữ liệu của chứng từ, không phải ô nhập
               liệu của mọi biểu mẫu. Biểu mẫu nào không khai thì phải mang theo giá
               trị cũ, nếu không lần lưu sau Engine sẽ tính lại giá vốn của một
               chứng từ đã phát hành. */
            ['bangGiaId', 'cotGia', 'mucGia'].forEach(function (k) {
                if (o[k] === undefined && rec[k] !== undefined) o[k] = rec[k];
            });
            if (cfg.khongDongHang) {
                if (cfg.truocLuu && cfg.truocLuu(o, h) === false) return;
            } else {
                var vatPct = W.docThueSuat(h);
                var t = T.tinhTong(lines, vatPct);
                o.lines = lines; o.vatPct = vatPct;
                o.thanhTien = t.thanhTien; o.vat = t.vat; o.tongCong = t.tongCong;
            }
            o.donVi = o.donVi || rec.donVi || DB.data._meta.ctyId;
            if (o.giaTri !== undefined) o.giaTri = o.tongCong;
            if (!o.so) o.so = cfg.soMoi ? cfg.soMoi(o) : DB.soMoi(cfg.seq);
            /* Chứng từ cha quyết định mã giao dịch. Người dùng gắn chứng từ này
               vào một đơn bán khác thì mã phải đi theo, nếu không cùng một khoản
               tiền sẽ được ghi nhận doanh thu hai lần ở hai giao dịch. */
            o.maGD = T.layMaGD(cfg.key, o) || rec.maGD || DB.maGDMoi();
            o.khoa = rec.khoa || false;
            if (!cfg.khongDongHang && cfg.key !== 'donMua') {
                // ĐÓNG BĂNG GIÁ VỐN: dòng nào đã có giá vốn thì giữ nguyên tuyệt đối
                T.dongBangGiaVon(o);
                /* ĐÓNG BĂNG GIÁ VỐN GỐC CỦA KHO trên MỌI chứng từ bán hàng.
                   Trước đây chỉ đơn bán được đóng băng, nên hợp đồng và phiếu
                   xuất lập thẳng phải hỏi lại giá vốn bình quân của HÔM NAY —
                   chứng từ đã phát hành đổi số theo thời gian. */
                T.dongBangGiaGocNB(o);
                // NHẬT KÝ: ghi lại các dòng có đơn giá nhập tay khác giá của bảng giá
                ghiNhatKyGiaTay(cfg, o);
            }
            // Đơn mua hàng: mã hàng chưa có trong Danh mục Hàng hóa được tự tạo ngay
            function ghiXong() {
                var luuXong;
                if (moi || isCopy) luuXong = DB.insert(cfg.key, o); else luuXong = DB.update(cfg.key, rec.id, o) || o;
                h.close(); g.reload(cfg.rows()); W.route();
                /* CHỈ BÁO KHI ĐÃ GHI XONG — dữ liệu chưa hợp lệ thì đã dừng ở
                   trên và không có bản ghi nào được tạo, nên thông báo thành
                   công luôn phản ánh đúng thực tế trong kho dữ liệu. */
                UI.toast('ok', 'Lưu thành công',
                    (moi ? 'Đã lập ' : 'Đã cập nhật ') + cfg.dt.toLowerCase() + ' ' + (o.so || '') + ' — ' +
                    T.money(cfg.khongDongHang ? (o.soTien || 0) : o.tongCong) + ' đ');
                // Quay lại đúng màn hình xem trước của chính chứng từ vừa sửa
                if (W.__sauLuu) { var f = W.__sauLuu; W.__sauLuu = null; setTimeout(function () { f(luuXong); }, 120); }
                else if (thenPrint) setTimeout(function () { W.inChungTu(cfg.key, o); }, 250);
            }
            /* Sửa số liệu trong khi chứng từ đang in theo BẢN SỬA TAY: bản in
               sẽ không tự cập nhật theo số liệu mới, nên phải hỏi rõ. */
            function tiep() {
                if (cfg.taoHangHoa && W.dongBoHangHoa) W.dongBoHangHoa(lines, ghiXong);
                else ghiXong();
            }
            if (!moi && rec.banInRieng && rec.banInRieng.html) {
                UI.confirm({ title: 'Chứng từ đang dùng bản in đã sửa tay',
                    icon: 'bi-pencil-fill',
                    message: 'Bản in của chứng từ <b>' + T.esc(rec.so || '') + '</b> đã được sửa tay ' +
                             'trực tiếp trên trang giấy. Số liệu vừa sửa <b>không tự cập nhật</b> vào bản in đó.',
                    note: 'Chọn <b>Giữ bản đã sửa tay</b> nếu bản in vẫn đúng ý; chọn ' +
                          '<b>Dựng lại theo biểu mẫu chuẩn</b> để bản in lấy lại số liệu mới.',
                    okText: 'Giữ bản đã sửa tay', okIcon: 'bi-pin-angle',
                    phuText: 'Dựng lại theo biểu mẫu chuẩn', phuIcon: 'bi-arrow-counterclockwise',
                    phu: function () { delete o.banInRieng; tiep(); },
                    ok: tiep });
                return;
            }
            tiep();
        }
    }
    W.__docForm = form;
    W.FORM_CT = W.FORM_CT || {};
    W.FORM_CT[cfg.key] = form;                    // dùng cho nút "Chỉnh sửa" ở cửa sổ xem trước
    return g;
}
W.DocScreen = DocScreen;

/* ==========================================================================
   MỞ MỘT CHỨNG TỪ Ở CHẾ ĐỘ CHỈNH SỬA — dùng chung toàn hệ thống
   Không tạo chứng từ mới, không tải lại màn hình. Lưu xong gọi <xong>,
   bấm Hủy gọi <huy> để cửa sổ xem trước hiện lại nguyên trạng.
   ========================================================================== */
W.suaChungTu = function (key, id, xong, huy) {
    var r = DB.get(key, id);
    if (!r) return UI.toast('err', 'Không tìm thấy chứng từ');
    if (r.khoa) return UI.daKhoa(r);
    if (!W.Q.co(key, 'sua')) return UI.thieuQuyen(key, 'sua');

    W.__sauLuu = xong || null;
    W.__huyLuu = huy || null;

    function mo() {
        var f = (W.FORM_CT || {})[key];
        if (!f) { W.__sauLuu = null; W.__huyLuu = null;
                  return UI.toast('err', 'Chưa mở được màn hình chỉnh sửa'); }
        f(DB.get(key, id), false);
        // Người dùng đóng biểu mẫu mà KHÔNG lưu (bấm Hủy, dấu ×, phím Esc)
        // → trả lại cửa sổ xem trước đúng như trước khi sửa.
        setTimeout(function () {
            var canh = setInterval(function () {
                if (document.querySelector('.modal-bg:not(.an-tam)')) return;   // biểu mẫu còn mở
                clearInterval(canh);
                if (W.__sauLuu) {                                  // chưa lưu → coi như hủy
                    W.__sauLuu = null;
                    var g = W.__huyLuu; W.__huyLuu = null;
                    if (g) g();
                }
            }, 250);
        }, 400);
    }
    var route = W.ROUTE_CT[key];
    if (route && location.hash !== '#/' + route) { W.go(route); setTimeout(mo, 200); }
    else mo();
};

/* ==========================================================================
   BỘ ĐIỀU PHỐI GIÁ TRÊN CHỨNG TỪ BÁN HÀNG
   Đúng thứ tự nghiệp vụ:
        Đơn vị phát hành → Bảng giá áp dụng → Khách hàng → Hàng hóa → Đơn giá
   • Đổi ĐƠN VỊ  → danh sách bảng giá chỉ còn bảng của công ty đó
   • Đổi BẢNG GIÁ → dòng CHƯA sửa tay tự cập nhật đơn giá; dòng ĐÃ sửa tay thì hỏi
   • Chọn KHÁCH  → tự chọn bảng giá đúng bậc giá của khách trong công ty đang phát hành
   ========================================================================== */
/* ==========================================================================
   MỨC GIÁ ÁP DỤNG
   --------------------------------------------------------------------------
   PHIÊN BẢN BẢNG GIÁ và MỨC GIÁ ÁP DỤNG là hai khái niệm độc lập:

     • Phiên bản bảng giá  — nhà cung cấp, số phiên bản, ngày hiệu lực, danh
                             mục hàng hóa và CÁC CỘT GIÁ đang có.
     • Mức giá áp dụng     — người lập chứng từ chọn lấy cột giá nào: giá phân
                             phối, giá đại lý, giá bán lẻ, giá dự án, giá đặc
                             biệt hay bất kỳ cột giá nào khác của phiên bản.

   Chọn phiên bản bảng giá KHÔNG tự sinh ra đơn giá. Chỉ khi người dùng đã chọn
   mức giá thì hệ thống mới lấy đúng cột giá đó đưa vào Đơn giá.
   ========================================================================== */
/** Ô chọn Mức giá áp dụng — đặt ngay cạnh ô Bảng giá áp dụng trên mọi chứng từ. */
W.oMucGia = function (r) {
    return '<div class="fld"><label>Mức giá áp dụng <b class="req">*</b></label>' +
        '<select data-f="cotGia"></select>' +
        '<div class="small muted" id="mgGhiChu" style="margin-top:2px"></div></div>';
};

/**
 * Dựng lại danh sách Mức giá áp dụng theo phiên bản bảng giá đang chọn.
 * Trả về mức giá đang được chọn ('' nghĩa là người dùng CHƯA chọn).
 */
function napMucGia(h, bangGiaId, chon) {
    var sel = h.q('[data-f="cotGia"]');
    if (!sel) return '';
    var b = DB.get('bangGiaBan', bangGiaId);
    var ds = T.cotGiaCua(b);
    var giu = chon !== undefined && chon !== null ? chon : sel.value;
    if (giu && ds.indexOf(giu) < 0) giu = '';
    /* Phiên bản chỉ có ĐÚNG MỘT cột giá thì không có gì để chọn — lấy luôn.
       Có từ hai cột giá trở lên thì người dùng phải tự quyết, hệ thống KHÔNG
       chọn thay và cũng không tự lấy đơn giá. */
    if (!giu && ds.length === 1) giu = ds[0];

    sel.innerHTML = ds.length
        ? ((ds.length > 1 ? '<option value="">— Chọn mức giá áp dụng —</option>' : '') +
           ds.map(function (c) {
               return '<option value="' + T.esc(c) + '"' + (c === giu ? ' selected' : '') + '>' +
                   T.esc(c) + '</option>';
           }).join(''))
        : '<option value="">— Phiên bản này chưa có cột giá nào —</option>';
    sel.value = giu;

    var gc = h.q('#mgGhiChu');
    if (gc) {
        var goiY = T.mucGiaGoiY(b, DB.get('khachHang', h._khId || ''), h.q('[data-f="donVi"]')
            ? h.q('[data-f="donVi"]').value : DB.data._meta.ctyId);
        gc.innerHTML = !ds.length
            ? '<span class="neg">Phiên bản bảng giá này chưa có cột giá nào.</span>'
            : giu
                ? 'Đơn giá lấy theo cột <b>' + T.esc(giu) + '</b> của phiên bản đang chọn.'
                : '<span class="neg">Chưa chọn mức giá nên chưa lấy được đơn giá.</span>' +
                  (goiY ? ' Gợi ý theo bậc giá của khách: <b>' + T.esc(goiY) + '</b>.' : '');
    }
    return giu;
}
W.napMucGia = napMucGia;

/**
 * Đổi Mức giá áp dụng khi chứng từ ĐÃ CÓ dòng hàng — hỏi rõ ba lựa chọn:
 *   • Chỉ áp dụng cho các dòng thêm mới
 *   • Cập nhật toàn bộ đơn giá hiện có
 *   • Hủy thay đổi
 * Hệ thống không bao giờ tự ghi đè đơn giá đang có trên chứng từ.
 */
W.hoiApMucGia = function (h, cu, moi, soDong, cb) {
    var xong = false;
    var m = UI.modal({
        size: 'sm', dismiss: false,
        title: 'Đổi mức giá áp dụng',
        sub: (cu ? 'Từ "' + cu + '" sang "' + moi + '"' : 'Chọn mức giá "' + moi + '"'),
        body: '<div style="font-size:14.5px">Chứng từ đang có <b>' + T.num(soDong, 0) +
              '</b> dòng hàng với đơn giá lấy theo mức giá' + (cu ? ' <b>' + T.esc(cu) + '</b>' : ' cũ') +
              '.<br><br>Anh muốn áp dụng mức giá <b>' + T.esc(moi) + '</b> như thế nào?</div>' +
              '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>' +
              'Chọn <b>Chỉ áp dụng cho dòng thêm mới</b> nếu các dòng đang có đã chốt giá với khách.' +
              '</div></div>',
        buttons: [
            { text: 'Hủy thay đổi', cls: 'danger', icon: 'bi-arrow-counterclockwise', click: function (x) {
                xong = true; x.close(); if (cb.huy) cb.huy(); } },
            { text: 'Chỉ áp dụng cho dòng thêm mới', cls: 'ok', icon: 'bi-plus-circle', click: function (x) {
                xong = true; x.close(); if (cb.moi) cb.moi(); } },
            { text: 'Cập nhật toàn bộ đơn giá', cls: 'primary', icon: 'bi-arrow-repeat', click: function (x) {
                xong = true; x.close(); if (cb.tatCa) cb.tatCa(); } }
        ],
        onOpen: function (x) {
            /* Đóng cửa sổ bằng nút X cũng phải là HỦY THAY ĐỔI, không được coi
               như đã đồng ý đổi mức giá. */
            var cu0 = x.close;
            x.close = function () { cu0(); if (!xong) { xong = true; if (cb.huy) cb.huy(); } };
        }
    });
    return m;
};

/** Dựng lại danh sách lựa chọn của ô "Bảng giá áp dụng" theo công ty phát hành. */
function napBangGia(h, donViId, chon) {
    var sel = h.q('[data-f="bangGiaId"]');
    if (!sel) return null;
    var ngay = h.q('[data-f="ngay"]') ? h.q('[data-f="ngay"]').value : T.today();
    var ds = T.bangGiaCuaDonVi(donViId, ngay);
    var giu = chon || sel.value;
    var co = ds.some(function (b) { return b.id === giu; });
    if (!co) {
        // Người dùng đã CHỌN THỦ CÔNG một phiên bản thì luôn ưu tiên giữ phiên bản đó,
        // kể cả phiên bản cũ không còn hiệu lực tại ngày chứng từ.
        var bTay = h._bgTay && giu ? DB.get('bangGiaBan', giu) : null;
        if (bTay && (!bTay.donViId || bTay.donViId === donViId)) {
            ds = ds.concat([bTay]);
            co = true;
        } else {
            var md = T.bangGiaMacDinh(donViId, h._bacGia, ngay);
            giu = md ? md.id : (ds[0] ? ds[0].id : '');
        }
    }
    sel.innerHTML = ds.length
        ? ds.map(function (b) {
            var hl = T.bangGiaHieuLuc(ngay).some(function (x) { return x.id === b.id; });
            return '<option value="' + T.esc(b.id) + '"' + (b.id === giu ? ' selected' : '') + '>' +
                T.esc(b.ten) + (b.phienBan ? ' (phiên bản ' + b.phienBan + ')' : '') +
                (b.macDinh ? ' — mặc định' : '') +
                (hl ? '' : ' — ngoài hiệu lực, chọn thủ công') + '</option>';
        }).join('')
        : '<option value="">— Công ty này chưa có bảng giá —</option>';
    sel.value = giu;
    var gt = h.q('#bgGhiChu');
    if (gt) {
        var b = DB.get('bangGiaBan', giu);
        gt.innerHTML = b
            ? 'Hiệu lực từ <b>' + T.date(b.tuNgay) + '</b>' + (b.denNgay ? ' đến <b>' + T.date(b.denNgay) + '</b>' : '') +
              ' · <b>' + T.num(Object.keys(b.gia || {}).length, 0) + '</b> mã hàng có giá'
            : '<span class="neg">Công ty này chưa có bảng giá — bấm <b>Tạo bảng giá mới</b> ngay trên chứng từ này.</span>';
    }
    return giu;
}

/**
 * Áp bảng giá mới lên các dòng hàng.
 * Dòng nào người dùng đã tự sửa đơn giá (l.suaTay) thì hỏi trước khi ghi đè.
 */
function apBangGia(h, LE, bangGiaId, ngay, imLang, mucGia) {
    if (!LE) return;
    var ls = LE.lines || [];
    if (!ls.length) return;
    if (mucGia === undefined && h && h.q('[data-f="cotGia"]')) mucGia = h.q('[data-f="cotGia"]').value;
    /* Chưa chọn mức giá thì KHÔNG tự lấy đơn giá — giữ nguyên những gì đang có. */
    if (!mucGia) { LE.draw(); return; }
    var tuDong = [], daSua = [];
    ls.forEach(function (l) { (l.suaTay ? daSua : tuDong).push(l); });

    function ghi(ds) {
        var n = 0;
        var dvAp = (LE.o && LE.o.donVi) ? LE.o.donVi() : DB.data._meta.ctyId;
        ds.forEach(function (l) {
            var g = T.donGiaChungTu(l, bangGiaId, dvAp, ngay, null, mucGia).gia;
            if (g && g !== l.donGia) { l.donGia = g; l.suaTay = false; n++; }
        });
        return n;
    }
    var n1 = ghi(tuDong);
    var b = DB.get('bangGiaBan', bangGiaId) || {};

    if (!daSua.length) {
        LE.draw();
        if (n1 && !imLang) UI.toast('ok', 'Đã áp bảng giá ' + (b.ten || ''), n1 + ' dòng được cập nhật đơn giá.');
        return;
    }
    // có dòng đã sửa tay → hỏi ý người dùng
    UI.modal({
        size: 'sm', title: 'Có ' + daSua.length + ' dòng đã sửa đơn giá thủ công',
        body: '<div style="font-size:14.5px">Bảng giá vừa đổi sang <b>' + T.esc(b.ten || '') + '</b>.<br><br>' +
              'Anh muốn xử lý các dòng đã tự sửa giá như thế nào?</div>' +
              '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>' +
              (n1 ? '<b>' + n1 + ' dòng</b> chưa sửa tay đã được cập nhật theo bảng giá mới. ' : '') +
              'Còn lại <b>' + daSua.length + ' dòng</b> đang giữ giá anh nhập.</div></div>',
        buttons: [
            { text: 'Giữ nguyên giá đã chỉnh', icon: 'bi-pin-angle', click: function (x) {
                x.close(); LE.draw();
                UI.toast('info', 'Đã giữ giá thủ công', daSua.length + ' dòng giữ nguyên đơn giá anh nhập.');
            } },
            { text: 'Cập nhật lại theo bảng giá', cls: 'primary', icon: 'bi-arrow-repeat', click: function (x) {
                var n2 = ghi(daSua);
                x.close(); LE.draw();
                UI.toast('ok', 'Đã cập nhật theo bảng giá', (n1 + n2) + ' dòng lấy đơn giá từ ' + (b.ten || '') + '.');
            } }
        ]
    });
}

/**
 * Nối toàn bộ chuỗi giá cho một chứng từ bán hàng.
 * Gọi một lần trong onHead là đủ — tự lo Đơn vị → Bảng giá → Khách → Đơn giá.
 */
W.noiGiaChungTu = function (h, r, setMuc, setBangGia, mod, ro) {
    var selDV = h.q('[data-f="donVi"]');
    var selBG = h.q('[data-f="bangGiaId"]');
    var selMG = h.q('[data-f="cotGia"]');
    var oNgay = h.q('[data-f="ngay"]');
    function ngayCT() { return oNgay ? oNgay.value : T.today(); }
    function mgHienTai() { return selMG ? selMG.value : ''; }

    /* Đổi PHIÊN BẢN bảng giá → dựng lại danh sách mức giá của phiên bản đó.
       Mức giá cũ còn trong phiên bản mới thì giữ; không còn thì để người dùng
       chọn lại, tuyệt đối không tự thay bằng một cột giá khác. */
    function doiPhienBan(id, imLang) {
        var cu = mgHienTai();
        var moi = napMucGia(h, id, cu);
        h._mgCu = moi;
        if (cu && !moi && !imLang)
            UI.toast('warn', 'Phiên bản bảng giá mới không có mức giá "' + cu + '"',
                'Chọn lại Mức giá áp dụng để hệ thống lấy đơn giá.');
        apBangGia(h, h._LE, id, ngayCT(), imLang, moi);
    }

    // 1) ĐƠN VỊ PHÁT HÀNH đổi → nạp lại danh sách bảng giá của đúng công ty đó
    if (selDV && !ro) selDV.onchange = function () {
        var dv = selDV.value;
        var id = napBangGia(h, dv, null);
        setBangGia(id, false);
        doiPhienBan(id);
        UI.toast('info', 'Đã đổi đơn vị phát hành',
            'Bảng giá và số chứng từ nay theo ' + ((DB.get('donVi', dv) || {}).tat || '') + '.');
    };

    // 2) BẢNG GIÁ đổi → nạp lại mức giá rồi áp đơn giá lên dòng hàng.
    //    Người dùng tự chọn phiên bản thì ƯU TIÊN lựa chọn đó, hệ thống không đổi lại.
    if (selBG && !ro) selBG.onchange = function () {
        var id = this.value;
        h._bgTay = true;
        setBangGia(id, false);
        napBangGia(h, selDV ? selDV.value : DB.data._meta.ctyId, id);
        doiPhienBan(id);
    };

    /* 3) MỨC GIÁ đổi khi chứng từ ĐÃ CÓ dòng hàng → hỏi rõ ba lựa chọn, không
          tự ý ghi đè đơn giá người dùng đang có trên chứng từ. */
    if (selMG && !ro) selMG.onchange = function () {
        var moi = this.value, cu = h._mgCu || '';
        h._mgCu = moi;
        napMucGia(h, selBG ? selBG.value : '', moi);
        var ls = (h._LE && h._LE.lines) || [];
        if (!moi) return;
        if (!ls.length) {                                   // chưa có dòng nào → không phải hỏi
            apBangGia(h, h._LE, selBG ? selBG.value : '', ngayCT(), true, moi);
            return;
        }
        W.hoiApMucGia(h, cu, moi, ls.length, {
            moi: function () {
                UI.toast('info', 'Chỉ áp dụng cho dòng thêm mới',
                    'Đơn giá của ' + ls.length + ' dòng đang có được giữ nguyên.');
            },
            tatCa: function () {
                var dv = selDV ? selDV.value : DB.data._meta.ctyId;
                var n = 0;
                ls.forEach(function (l) {
                    var g = T.donGiaChungTu(l, selBG ? selBG.value : '', dv, ngayCT(), null, moi).gia;
                    if (g) { l.donGia = g; l.suaTay = false; n++; }
                });
                h._LE.draw();
                UI.toast('ok', 'Đã cập nhật toàn bộ đơn giá',
                    n + ' dòng lấy theo mức giá "' + moi + '".');
            },
            huy: function () {
                h._mgCu = cu;
                napMucGia(h, selBG ? selBG.value : '', cu);
                UI.toast('info', 'Đã hủy thay đổi', 'Mức giá áp dụng giữ nguyên' +
                    (cu ? ' là "' + cu + '"' : '') + '.');
            }
        });
    };

    // 2b) NGÀY CHỨNG TỪ đổi → tự tìm đúng phiên bản bảng giá có hiệu lực theo ngày đó.
    //     Ngày chứng từ không bị khóa: gõ tay hay chọn lịch, năm trước hay năm sau đều được.
    if (oNgay && !ro) oNgay.onchange = function () {
        if (h._bgTay) return;                       // đã chọn thủ công thì giữ nguyên
        var dv = selDV ? selDV.value : DB.data._meta.ctyId;
        var cu = selBG ? selBG.value : '';
        var id = napBangGia(h, dv, null);
        if (id && id !== cu) {
            setBangGia(id, false);
            doiPhienBan(id);
            var b = DB.get('bangGiaBan', id) || {};
            UI.toast('info', 'Đã lấy bảng giá theo ngày chứng từ',
                (b.ten || '') + ' — hiệu lực từ ' + T.date(b.tuNgay) +
                (b.denNgay ? ' đến ' + T.date(b.denNgay) : '') + '.', 6000);
        }
    };

    // 3) KHÁCH HÀNG đổi → tự chọn bảng giá đã khai cho khách trong công ty này
    comboKH(h, r, function (m, kh) {
        h._bacGia = m;
        if (h.q('[data-f="mucGia"]')) h.q('[data-f="mucGia"]').value = m;
        if (h.q('[data-f="khachHangId"]')) h.q('[data-f="khachHangId"]').value = h._cbKH.get();
        setMuc(m);
        var dv = selDV ? selDV.value : DB.data._meta.ctyId;
        var b = T.bangGiaCuaKhach(kh ? kh.id : '', dv, ngayCT());
        h._khId = kh ? kh.id : '';
        if (b && selBG && selBG.value !== b.id) {
            napBangGia(h, dv, b.id);
            setBangGia(b.id, false);
            doiPhienBan(b.id);
            UI.toast('info', 'Đã chọn bảng giá theo khách hàng', b.ten);
        } else {
            napMucGia(h, selBG ? selBG.value : '', mgHienTai());   // cập nhật dòng gợi ý
        }
        /* CHÍNH SÁCH GIÁ CỦA KHÁCH HÀNG — chứng từ chưa có dòng nào và người
           lập chưa chọn mức giá thì lấy đúng mức giá đã khai cho khách trong
           hồ sơ khách hàng / chính sách giá của công ty. KHÔNG cắm cứng một cột
           giá nào trong chương trình, và người lập vẫn đổi được ngay trên
           chứng từ. */
        apChinhSachGiaKhach(h, kh);
    }, ro, function () { W.tinhLaiTong(h); });

    W.bindNguoiLap(h, r, mod, ro);

    function apChinhSachGiaKhach(h2, kh2) {
        if (!selMG || ro) return;
        var ls = (h2._LE && h2._LE.lines) || [];
        if (ls.length || selMG.value) return;             // đã có dòng hoặc đã chọn thì không đụng
        var b2 = DB.get('bangGiaBan', selBG ? selBG.value : '');
        var dv2 = selDV ? selDV.value : DB.data._meta.ctyId;
        var goi = T.mucGiaGoiY(b2, kh2, dv2);
        if (!goi) return;
        h2._mgCu = napMucGia(h2, selBG ? selBG.value : '', goi);
        apBangGia(h2, h2._LE, selBG ? selBG.value : '', ngayCT(), true, goi);
        UI.toast('info', 'Đã lấy mức giá theo chính sách giá của khách hàng',
            '"' + goi + '" — anh đổi lại ngay trên chứng từ nếu cần.', 5000);
    }

    // 4) TẠO BẢNG GIÁ MỚI ngay tại chứng từ khi công ty chưa có bảng giá phù hợp
    var nutBG = h.q('#bgNhanh');
    if (nutBG) {
        if (ro) nutBG.style.display = 'none';
        else nutBG.onclick = function () {
            themBangGiaNhanh(selDV ? selDV.value : DB.data._meta.ctyId, function (b) {
                napBangGia(h, b.donViId, b.id);
                setBangGia(b.id, false);
                doiPhienBan(b.id);
            });
        };
    }

    /* Khởi tạo: giữ nguyên bảng giá VÀ mức giá đã lưu trên chứng từ cũ.
       Chứng từ mới thì mức giá để trống — người lập phải tự chọn, trừ khi phiên
       bản bảng giá chỉ có đúng một cột giá (lúc đó không có gì để chọn). */
    /* CHỨNG TỪ ĐÃ LƯU CHỐT PHIÊN BẢN NÀO THÌ GIỮ NGUYÊN PHIÊN BẢN ĐÓ — kể cả khi
       phiên bản đã hết hiệu lực vì bảng giá ra bản mới. Đổi ngầm sang phiên bản
       khác sẽ làm Engine tính lại giá nội bộ của một chứng từ đã phát hành. */
    if (r.id && r.bangGiaId) h._bgTay = true;
    var id0 = napBangGia(h, r.donVi || DB.data._meta.ctyId, r.bangGiaId || null);
    setBangGia(id0, false);
    h._khId = r.khachHangId || '';
    h._mgCu = napMucGia(h, id0, r.cotGia || '');
};

/**
 * Ghi nhật ký khi người dùng nhập tay đơn giá khác với giá của bảng giá đang áp dụng.
 * Đơn giá nhập tay CHỈ áp dụng cho chứng từ hiện tại, KHÔNG cập nhật ngược lại bảng giá.
 */
function ghiNhatKyGiaTay(cfg, o) {
    var bg = DB.get('bangGiaBan', o.bangGiaId);
    var ds = (o.lines || []).filter(function (l) {
        if (!l.suaTay) return false;
        var goc = bg ? T.donGiaChungTu(l, bg.id, o.donVi, o.ngay, null, o.cotGia).gia
                     : (Number(l.giaBangGia) || 0);
        l.giaBangGia = goc;
        return goc !== (Number(l.donGia) || 0);
    });
    if (!ds.length) return;
    DB.data.nhatKy.unshift({
        id: T.uid('L'), luc: T.now(), ai: DB.user().taiKhoan,
        viec: 'Sửa đơn giá thủ công', bang: T.tenBang(cfg.key),
        mota: cfg.dt + ' ' + o.so + ' — ' + ds.length + ' dòng nhập tay đơn giá' +
              (bg ? ' khác bảng giá "' + bg.ten + '"' : '') + ': ' +
              ds.map(function (l) {
                  return l.maHang + ' ' + T.money(l.giaBangGia) + ' → ' + T.money(l.donGia);
              }).join('; ') + '. Chỉ áp dụng cho chứng từ này, không cập nhật lại bảng giá.'
    });
    DB.save();
}

/* ==========================================================================
   TẠO NHANH BẢNG GIÁ NGAY TRÊN CHỨNG TỪ
   Chưa có bảng giá phù hợp thì tạo ngay, không phải thoát chứng từ.
   ========================================================================== */
/** Mã bảng giá chưa ai dùng — mã trùng sẽ làm một bảng giá biến mất khỏi tra giá. */
function maBangGiaMoi() {
    var co = {};
    DB.all('bangGiaBan').forEach(function (b) { co[T.kd(b.ma || '')] = 1; });
    var i = DB.all('bangGiaBan').length + 1;
    while (co[T.kd('BG' + i)]) i++;
    return 'BG' + i;
}
function themBangGiaNhanh(donViId, xong) {
    if (!W.Q.co('bangGiaBan', 'them')) return UI.thieuQuyen('bangGiaBan', 'them');
    var nguon = DB.all('bangGiaBan').filter(function (b) { return b.trangThai === 'Đang áp dụng'; });
    UI.modal({
        size: 'md', title: 'Tạo bảng giá mới',
        sub: 'Lưu xong bảng giá có ngay trong Danh mục → Bảng giá và được chọn luôn cho chứng từ này',
        body: '<div class="grid2">' +
            '<div class="fld req"><label>Mã bảng giá</label><input data-f="ma" value="' +
                T.esc(maBangGiaMoi()) + '"></div>' +
            /* PRICE POLICY ENGINE V2.0 — bảng giá do đơn vị nguồn xây dựng và
               dùng chung cho cả nhóm, không khai riêng theo công ty phát hành. */
            '<div class="fld"><label>Phạm vi áp dụng</label>' +
                '<input value="Dùng chung toàn nhóm" readonly style="background:var(--bg-2)"></div>' +
            '<div class="fld req span2"><label>Tên bảng giá</label><input data-f="ten" autofocus ' +
                'placeholder="VD: Giá đại lý, Giá phân phối, Giá dự án, Giá VIP, Giá khách hàng…"></div>' +
            '<div class="fld span2"><label>Diễn giải</label><input data-f="moTa"></div>' +
            '<div class="fld req"><label>Hiệu lực từ ngày</label><input type="date" data-f="tuNgay" value="' +
                T.today() + '"></div>' +
            '<div class="fld"><label>Sao chép giá từ bảng giá có sẵn</label><select data-f="nguonId">' +
                '<option value="">— Để trống, nhập giá sau —</option>' +
                W.opt(nguon.map(function (b) { return { v: b.id, t: b.ten }; }), '') + '</select></div>' +
            '<div class="fld"><label>Hệ số nhân khi sao chép (%)</label>' +
                '<input class="tyle" data-f="heSo" value="100"></div>' +
            '</div>' +
            '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>Bảng giá do doanh nghiệp tự đặt tên, ' +
            'không giới hạn số lượng. Đơn giá trên chứng từ vẫn sửa tay được và <b>không</b> ghi ngược lại bảng giá.</div></div>',
        buttons: [
            { text: 'Hủy', click: function (x) { x.close(); } },
            { text: 'Lưu và chọn luôn', cls: 'primary', icon: 'bi-check-lg', click: function (x) {
                if (!UI.validate(x.el, [{ k: 'ma' }, { k: 'ten' }, { k: 'tuNgay' }])) return;
                var v = UI.read(x.el);
                var maM = String(v.ma || '').trim() || maBangGiaMoi();
                if (DB.all('bangGiaBan').some(function (b) { return T.kd(b.ma || '') === T.kd(maM); }))
                    return UI.toast('err', 'Trùng mã bảng giá',
                        'Mã ' + maM + ' đã có. Đặt mã khác để hệ thống không lấy nhầm bảng giá.');
                /* Bảng giá tạo nhanh cũng phải đúng cấu trúc của Module Bảng giá:
                   nguồn dữ liệu là MẢNG DÒNG, chỉ mục tra giá do hệ thống dựng. */
                var ng = DB.get('bangGiaBan', v.nguonId);
                var hs = (T.so(v.heSo) || 100) / 100;
                var cot = ng ? (ng.cotGia || []).slice() : T.tenLoaiGia().slice(0, 1);
                if (!cot.length) cot = ['Giá bán'];
                var dong = [];
                if (ng) T.dongBangGia(ng).forEach(function (d) {
                    var g = {};
                    Object.keys(d.gia || {}).forEach(function (c) {
                        if (Number(d.gia[c]) > 0) g[c] = Math.round(Number(d.gia[c]) * hs);
                    });
                    dong.push({ hangHoaId: d.hangHoaId, ma: d.ma, model: d.model, ten: d.ten,
                        dvt: d.dvt, thongSo: d.thongSo, nhom: d.nhom, hang: d.hang,
                        ghiChu: d.ghiChu, gia: g, dongExcel: dong.length + 1 });
                });
                var o = {
                    ma: maM, ten: String(v.ten).trim(),
                    /* Bảng giá tự lập trong nội bộ do đơn vị nguồn đứng tên. */
                    nhaCungCap: (DB.get('donVi', T.cauHinhDaCongTy().ctyNguonId) || {}).tat || 'Nội bộ',
                    hangSX: (DB.get('donVi', T.cauHinhDaCongTy().ctyNguonId) || {}).tat || 'Nội bộ',
                    moTa: v.moTa || '', ghiChu: v.moTa || '',
                    donViId: '', tuNgay: v.tuNgay, denNgay: '',
                    trangThai: 'Đang áp dụng', macDinh: false, khoa: false, phienBan: 1,
                    dong: dong, cotGia: cot, cotChinh: cot[0], ck: {}, ngungLienKet: {},
                    nguoiCapNhat: (W.Q.nhanVienCuaToi() || {}).hoTen || DB.user().hoTen || '',
                    capNhatLuc: T.now(), ngayNhap: T.today(), nguonTep: '', tepGocId: ''
                };
                T.dungChiMucBG(o); T.ganKyBangGia(o);
                T.keThuaChietKhauNoiBo(o, ng);
                var b = DB.insert('bangGiaBan', o);
                x.close();
                UI.toast('ok', 'Đã tạo bảng giá',
                    b.ten + ' — ' + T.num(dong.length, 0) + ' dòng giá.');
                if (xong) xong(b);
            } }
        ],
        onOpen: function (x) { UI.numInput(x.el); }
    });
}

/* ==========================================================================
   TẠO NHANH HÀNG HÓA NGAY TRONG BẢNG CHỌN HÀNG
   Lưu xong là có ngay trong Danh mục Hàng hóa và trong các bảng giá đã khai.
   ========================================================================== */
function themHangNhanh(xong, oCtx) {
    if (!W.Q.co('hangHoa', 'them')) return UI.thieuQuyen('hangHoa', 'them');
    oCtx = oCtx || {};
    var goi = String(oCtx.tuKhoa || '').trim();
    var nhoms = W.dsNhomHang ? W.dsNhomHang() : [];
    var dvts = W.dsDVT ? W.dsDVT() : ['Bộ', 'Cái'];
    var hangs = W.dsHangSX ? W.dsHangSX() : [];
    /* Giá bán khai ngay tại đây được ghi thành MỘT DÒNG BẢNG GIÁ liên kết bằng
       ID nội bộ — đúng kiến trúc "Danh mục hàng hóa không quản lý giá". */
    var bg = W.bangGiaChonHang ? W.bangGiaChonHang(oCtx) : null;
    var mucs = bg ? T.cotGiaCua(bg) : [];
    UI.modal({
        size: 'lg', title: 'Tạo mới mặt hàng',
        sub: 'Mặt hàng được ghi vào Danh mục Hàng hóa rồi tự liên kết ngay với chứng từ đang lập',
        body: '<div class="note b mb12"><i class="bi bi-diagram-3-fill"></i><div>' +
            'Mặt hàng này <b>chưa có trong Danh mục Hàng hóa</b>. Xác nhận thì hệ thống ' +
            '<b>tự sinh Mã hàng nội bộ</b>, lưu vào Danh mục và giữ nguyên Model · Tên hàng · ' +
            'Thông số kỹ thuật · Đơn vị tính anh khai ở đây. Chứng từ sẽ liên kết ngay với Mã hàng đó.' +
            '</div></div>' +
            '<div class="grid2">' +
            '<div class="fld req"><label>Model của nhà sản xuất</label><input data-f="model" autofocus value="' +
                T.esc(goi && !/\s/.test(goi) ? goi : '') + '" placeholder="Nhập đúng Model của hãng"></div>' +
            '<div class="fld"><label>Mã hàng nội bộ</label>' +
                '<input value="" disabled placeholder="Hệ thống tự sinh khi lưu"></div>' +
            '<div class="fld req span2" style="grid-column:span 2"><label>Tên hàng hóa</label>' +
                '<input data-f="ten" value="' + T.esc(goi && /\s/.test(goi) ? goi : '') + '"></div>' +
            '<div class="fld"><label>Hãng</label><input data-f="hang" list="hhNhanhHang">' +
                '<datalist id="hhNhanhHang">' + hangs.map(function (x) {
                    return '<option value="' + T.esc(x) + '">'; }).join('') + '</datalist></div>' +
            '<div class="fld"><label>Loại thiết bị (nhóm hàng)</label><input data-f="nhom" list="hhNhanhNhom">' +
                '<datalist id="hhNhanhNhom">' + nhoms.map(function (x) {
                    return '<option value="' + T.esc(x) + '">'; }).join('') + '</datalist></div>' +
            '<div class="fld"><label>Đơn vị tính</label><select data-f="dvt">' +
                W.opt(dvts, dvts[0] || 'Cái') + '</select></div>' +
            '<div class="fld"><label>Xuất xứ</label><input data-f="xuatXu"></div>' +
            '<div class="fld span2" style="grid-column:span 2"><label>Thông số kỹ thuật</label>' +
                '<input data-f="thongSo"></div>' +
            '</div>' +
            '<div class="card mt12"><div class="card-h"><i class="bi bi-eye"></i> Cấu hình theo dõi</div>' +
            '<div class="card-b"><div class="row" style="gap:22px">' +
            '<label class="chk"><input type="checkbox" data-f="theoDoiTon" checked> Theo dõi tồn kho</label>' +
            '<label class="chk"><input type="checkbox" data-f="theoDoiSerial"> Theo dõi số Serial</label>' +
            '<label class="chk"><input type="checkbox" data-f="theoDoiLo"> Theo dõi số Lô</label>' +
            '</div></div></div>' +
            (mucs.length ? '<div class="card mt12"><div class="card-h"><i class="bi bi-tags"></i> Giá bán ghi vào bảng giá: ' +
                T.esc(bg.ten) + '</div><div class="card-b"><div class="grid2">' +
                mucs.map(function (m) {
                    return '<div class="fld"><label>' + T.esc(m) + '</label>' +
                        '<input class="tien" data-muc="' + T.esc(m) + '" placeholder="0"></div>';
                }).join('') + '</div>' +
                '<div class="note b"><i class="bi bi-info-circle"></i><div>Giá khai ở đây được ghi thành ' +
                '<b>một dòng của bảng giá</b>, liên kết bằng ID nội bộ. Bỏ trống cũng lưu được — ' +
                'khi đó hàng hiện “chưa có giá” cho tới khi anh khai giá trong Bảng giá bán.</div></div>' +
                '</div></div>' : '') +
            '<div class="note y mt12"><i class="bi bi-lock"></i><div><b>Giá vốn không nhập ở đây.</b> ' +
            'Giá vốn chỉ hình thành khi hàng được nhập kho qua <b>Lô nhập hàng</b> và phân bổ chi phí.</div></div>',
        buttons: [
            { text: 'Hủy', click: function (x) { x.close(); } },
            { text: 'Lưu và chọn luôn', cls: 'primary', icon: 'bi-check-lg', click: function (x) {
                var v = UI.read(x.el);
                var o = { model: String(v.model || '').trim(), ten: String(v.ten || '').trim(),
                    dvt: v.dvt, nhom: v.nhom || '', hang: v.hang || '',
                    xuatXu: v.xuatXu || '', thongSo: v.thongSo || '', quyCach: '', maKhac: [], anh: '',
                    theoDoiTon: !!v.theoDoiTon, theoDoiSerial: !!v.theoDoiSerial, theoDoiLo: !!v.theoDoiLo,
                    tonToiThieu: 0, ghiChu: 'Tạo mới từ chứng từ', trangThai: 'Đang kinh doanh' };
                var eLoi = T.soatMatHang(o);
                if (eLoi) return UI.toast('err', 'Chưa đủ dữ liệu', eLoi);
                /* Đã có đúng mặt hàng này thì dùng lại, tuyệt đối không tạo bản
                   ghi thứ hai cho cùng một mặt hàng. */
                var trung = T.chiMucHangHoa().bo[T.khoaHH(o)];
                if (trung) return UI.toast('err', 'Mặt hàng đã có trong danh mục',
                    trung.ma + ' — ' + trung.ten + '. Chọn mặt hàng đó thay vì tạo mới.');
                /* CỬA DUY NHẤT SINH MÃ HÀNG — Danh mục Hàng hóa. */
                var rec = T.taoHangHoa(o);
                if (!rec) return UI.toast('err', 'Không tạo được mặt hàng',
                    'Kiểm tra lại Model và Tên hàng hóa.');
                var gia = {}, coGia = false;
                x.el.querySelectorAll('[data-muc]').forEach(function (i) {
                    var g = T.so(i.value);
                    if (g > 0) { gia[i.getAttribute('data-muc')] = Math.round(g); coGia = true; }
                });
                if (coGia && bg && T.phienBanBiKhoa(DB.get('bangGiaBan', bg.id) || bg)) {
                    /* Phiên bản đã chốt là HỒ SƠ GIÁ ĐÃ PHÁT HÀNH — chứng từ không
                       được ghi thêm dòng giá vào đó. */
                    UI.toast('warn', 'Không ghi giá vào phiên bản đã chốt',
                        'Mặt hàng đã được tạo trong Danh mục. Giá bán khai tại ' +
                        'Danh mục → Bảng giá bằng một phiên bản mới.', 8000);
                    coGia = false;
                }
                if (coGia && bg) {
                    var b2 = DB.get('bangGiaBan', bg.id);
                    b2.dong = T.dongBangGia(b2).concat([{
                        hangHoaId: rec.id, ma: rec.ma, model: rec.model, ten: rec.ten,
                        dvt: rec.dvt, thongSo: rec.thongSo, nhom: rec.nhom, hang: rec.hang,
                        ghiChu: 'Thêm nhanh từ chứng từ', gia: gia, dongExcel: 0
                    }]);
                    T.dungChiMucBG(b2);
                    DB.update('bangGiaBan', b2.id, b2);
                }
                x.close();
                UI.toast('ok', 'Đã tạo mặt hàng — Mã hàng ' + rec.ma,
                    rec.ten + ' · Model ' + rec.model +
                    (coGia ? ' — đã ghi giá vào bảng giá ' + bg.ten + '.' : ' — chưa có giá bán.'));
                if (xong) xong(rec);
            } }
        ],
        onOpen: function (x) { UI.numInput(x.el); }
    });
}
/* Đăng ký vào Bộ chọn Master Data dùng chung. */
W.themHangHoaNhanh = function (o, xong) { themHangNhanh(xong, o || {}); };

/* ---------------------------------------------------- Ô chọn khách hàng dùng chung */
function comboKH(h, rec, onMuc, ro, onThue) {
    function moTaKH(c) {
        var b = DB.get('bangGiaBan', c.bangGiaId);
        return c.ma + (c.duAn ? ' · ' + c.duAn : '') +
               ' · ' + (b ? b.ten : 'Theo bảng giá mặc định của công ty');
    }
    var items = DB.all('khachHang').map(function (c) {
        return { v: c.id, t: c.ten, s: moTaKH(c) };
    });
    var host = h.q('#cbKH');
    if (!host) return;
    var cb = UI.combo(host, {
        items: items, value: rec.khachHangId || '', placeholder: '— Chọn khách hàng —',
        onChange: function (v) {
            var c = DB.get('khachHang', v);
            host.setAttribute('data-val', v);
            if (h.q('#khTen')) h.q('#khTen').value = c ? c.ten : '';
            if (h.q('#khDiaChi')) h.q('#khDiaChi').value = c ? (c.diaChi || '') : '';
            /* Dự án của khách hàng: chọn sẵn đúng bản ghi trong Danh mục Dự án
               (liên kết bằng ID nội bộ), không chép chữ sang chứng từ. */
            if (c && c.duAn) W.mdDatTheoTen(h._md, 'duAn', c.duAn.split(';')[0].trim());
            if (c && c.dieuKhoanTT) W.mdDatTheoTen(h._md, 'dieuKhoanTT', c.dieuKhoanTT);
            // Bớt gõ tay: tự điền người nhận hàng theo người liên hệ đã khai trong danh mục
            var nn = h.q('[data-f="nguoiNhan"]');
            if (nn && c && c.nguoiLienHe && !nn.value) nn.value = c.nguoiLienHe;
            if (onMuc && c) onMuc(c.bangGiaId || c.mucGia, c);
        }
    });
    host.setAttribute('data-val', rec.khachHangId || '');
    host.setAttribute('data-fk', 'khachHangId');
    h._cbKH = cb;
    if (ro) host.style.pointerEvents = 'none';

    var nut = h.q('#khNhanh');
    if (nut) {
        if (ro) nut.style.display = 'none';
        else nut.onclick = function () {
            themKhachNhanh(h, function (o) {
                cb.nap(DB.all('khachHang').map(function (c) {
                    return { v: c.id, t: c.ten, s: moTaKH(c) };
                }));
                cb.set(o.id);
            });
        };
    }
}

function headKH(rec, lbl) {
    return '<div class="fld req span2"><label>' + (lbl || 'Khách hàng') +
        '<button type="button" class="lnk-nut" id="khNhanh" title="Thêm khách hàng mới ngay tại đây">' +
        '<i class="bi bi-person-plus-fill"></i> Thêm khách mới</button></label>' +
        '<div id="cbKH" class="combo"></div></div>';
}

/* ==========================================================================
   TẠO NHANH KHÁCH HÀNG NGAY TRÊN CHỨNG TỪ
   Lưu xong là có ngay trong Danh mục Khách hàng, không phải thoát chứng từ.
   ========================================================================== */
function themKhachNhanh(h, xong, oCtx) {
    if (!W.Q.co('khachHang', 'them')) return UI.thieuQuyen('khachHang', 'them');
    /* Người dùng đang gõ tên khách trong ô chọn thì mang luôn sang biểu mẫu — không
       bắt gõ lại từ đầu. */
    var goiKH = String((oCtx || {}).tuKhoa || '').trim();
    UI.modal({
        size: 'lg', title: 'Thêm nhanh khách hàng',
        sub: 'Ghi thẳng vào Customer Master Data — lưu xong có ngay trong Danh mục Khách hàng',
        body: '<div class="note b mb12"><i class="bi bi-diagram-3-fill"></i><div>' +
            'Khách hàng tạo ở đây là <b>một hồ sơ trong Danh mục Khách hàng</b>, không phải dữ liệu ' +
            'riêng của chứng từ. Toàn bộ chứng từ và báo cáo sau này đều liên kết tới hồ sơ này ' +
            'bằng mã khách hàng nội bộ.</div></div>' +
            '<div class="grid2">' +
            '<div class="fld"><label>Mã khách hàng</label>' +
                '<input data-f="ma" value="' + T.esc(DB.maKHMoi()) + '" readonly ' +
                'style="background:#eef1f5;font-family:Consolas,monospace">' +
                '<div class="small muted">Hệ thống tự sinh</div></div>' +
            '<div class="fld req"><label>Loại khách hàng</label>' +
                '<div class="row" id="nkLoai" style="gap:16px;padding-top:5px">' +
                T.LOAI_KH.map(function (x) {
                    return '<label class="chk"><input type="radio" name="nkL" value="' + x + '"' +
                        (x === 'Doanh nghiệp' ? ' checked' : '') + '> ' + x + '</label>';
                }).join('') + '</div>' +
                '<input type="hidden" data-f="loai" value="Doanh nghiệp"></div>' +
            '<div class="fld" id="nkOMST"><label>Mã số thuế</label>' +
                '<div class="row" style="gap:6px">' +
                '<input data-f="mst" id="khMST" style="flex:1;font-family:Consolas,monospace" ' +
                'placeholder="10 hoặc 13 chữ số">' +
                '<button type="button" class="btn primary" id="khTra" style="flex:0 0 auto">' +
                '<i class="bi bi-search"></i> Tra cứu</button></div>' +
                '<div class="small muted" id="khTraKQ">Tra cứu trực tuyến để tự điền tên, địa chỉ, ' +
                'người đại diện, điện thoại, email</div></div>' +
            '<div class="fld" id="nkOCCCD" hidden><label>Số căn cước công dân</label>' +
                '<input data-f="cccd" placeholder="Không bắt buộc"></div>' +
            '<div class="fld req span2"><label>Tên khách hàng</label>' +
                '<input data-f="ten" autofocus value="' + T.esc(goiKH) + '"></div>' +
            '<div class="fld span2"><label>Địa chỉ</label><input data-f="diaChi"></div>' +
            '<div class="fld" id="nkODD"><label>Người đại diện theo pháp luật</label>' +
                '<input data-f="daiDien"></div>' +
            '<div class="fld"><label>Điện thoại</label><input data-f="dienThoai"></div>' +
            '<div class="fld"><label>Email</label><input data-f="email"></div>' +
            '<div class="fld" id="nkOLH"><label>Người liên hệ</label><input data-f="nguoiLienHe"></div>' +
            '<div class="fld"><label>Chính sách giá</label><select data-f="bangGiaId">' +
                '<option value="">— Theo bảng giá mặc định của công ty phát hành —</option>' +
                W.opt(DB.all('bangGiaBan').map(function (b) {
                    var d = DB.get('donVi', b.donViId);
                    return { v: b.id, t: b.ten + (d ? ' — ' + d.tat : '') };
                }), '') + '</select></div>' +
            '<div class="fld"><label>Hạn mức công nợ (đ)</label>' +
                '<input class="tien" data-f="hanMucNo" value="0"></div>' +
            W.oMD('duAn', { f: 'duAnId', fTen: 'duAn', rong: true, nhan: 'Dự án / công trình', tuDo: true }) +
            '</div>',
        buttons: [
            { text: 'Hủy', click: function (x) { x.close(); } },
            { text: 'Lưu và chọn luôn', cls: 'primary', icon: 'bi-check-lg', click: function (x) { luu(x); } }
        ],
        onOpen: function (x) {
            UI.numInput(x.el);
            if (W.bindMD) x._md = W.bindMD(x.el, {});
            x.el.querySelectorAll('#nkLoai input').forEach(function (e) {
                e.onchange = function () {
                    var dn = e.value !== 'Cá nhân';
                    x.q('[data-f="loai"]').value = e.value;
                    x.q('#nkOMST').hidden = !dn;
                    x.q('#nkODD').hidden = !dn;
                    x.q('#nkOLH').hidden = !dn;
                    x.q('#nkOCCCD').hidden = dn;
                };
            });
            if (W.bindTraCuuMST) W.bindTraCuuMST(x);
        }
    });

    function luu(x) {
        var v = UI.read(x.el);
        var dn = v.loai !== 'Cá nhân';
        if (!String(v.ten || '').trim())
            return UI.toast('err', 'Thiếu tên khách hàng', 'Bắt buộc nhập tên khách hàng.');
        var mst = dn ? T.chuanMST(v.mst) : '';
        if (mst && !T.mstHopLe(mst))
            return UI.toast('err', 'Mã số thuế chưa hợp lệ', 'Mã số thuế phải gồm 10 hoặc 13 chữ số.');
        var o = {
            ma: DB.maKHMoi(), ten: String(v.ten).trim(), loai: v.loai,
            mst: mst, cccd: dn ? '' : String(v.cccd || '').trim(),
            diaChi: v.diaChi || '', daiDien: dn ? (v.daiDien || '') : '',
            dienThoai: v.dienThoai || '', email: v.email || '',
            nguoiLienHe: dn ? (v.nguoiLienHe || '') : '', chucVu: '', dtLienHe: '', emailLienHe: '',
            bangGiaId: v.bangGiaId || '', dieuKhoanTT: '', hanMucNo: T.so(v.hanMucNo),
            nguoiPhuTrachId: '', nguoiPhuTrach: '', donViId: '',
            duAnId: v.duAnId || '', duAn: v.duAn || '', tenKhac: '',
            mucGia: 'BANLE', soLanGiaoDich: 0, nguonMST: '',
            ghiChu: 'Tạo nhanh từ chứng từ', trangThai: 'Đang giao dịch'
        };
        /* KHÔNG TẠO HỒ SƠ TRÙNG — doanh nghiệp xét theo mã số thuế, cá nhân xét
           theo căn cước hoặc họ tên kèm điện thoại. */
        var cu = T.trungKH(o, null);
        if (cu) {
            x.close();
            return W.hoiTrungKhachHang(cu, o,
                function (k) { UI.toast('info', 'Dùng hồ sơ đã có', k.ma + ' — ' + k.ten);
                               if (xong) xong(k); },
                function (k) {
                    var m = T.clone(k);
                    Object.keys(o).forEach(function (f) {
                        if (f === 'ma' || f === 'soLanGiaoDich' || f === 'ghiChu') return;
                        if (o[f] !== '' && o[f] !== 0 && o[f] !== undefined) m[f] = o[f];
                    });
                    DB.update('khachHang', k.id, m); DB.save();
                    UI.toast('ok', 'Đã đồng bộ vào hồ sơ đã có', m.ma + ' — ' + m.ten);
                    if (xong) xong(m);
                });
        }
        var rec = DB.insert('khachHang', o);
        x.close();
        UI.toast('ok', 'Đã thêm khách hàng', rec.ten + ' — đã có trong Danh mục Khách hàng.');
        if (xong) xong(rec);
    }
}
/* Đăng ký vào Bộ chọn Master Data dùng chung. */
W.themKhachHangNhanh = function (o, xong) { themKhachNhanh(null, xong, o || {}); };


/* ---------------------------------------------------- Ô "NGƯỜI LẬP" DÙNG CHUNG
   Lấy từ Danh mục Nhân viên. Mặc định là nhân viên gắn với tài khoản đang đăng nhập.
   Chỉ vai trò có quyền Duyệt hoặc Quản trị hệ thống mới được chọn nhân viên khác.
   ------------------------------------------------------------------------- */
W.oNguoiLap = function (r, mod) {
    var duocDoi = W.Q.doiNguoiLap(mod);
    return '<div class="fld req"><label>Người lập</label>' +
        '<div id="cbNL" class="combo"></div>' +
        '<input type="hidden" data-f="nguoiLapId" value="' + T.esc(r.nguoiLapId || '') + '">' +
        (duocDoi ? '' : '<div class="small muted" style="margin-top:2px">Lấy theo tài khoản đang đăng nhập</div>') +
        '</div>';
};
W.bindNguoiLap = function (h, r, mod, ro) {
    var host = h.q('#cbNL');
    if (!host) return;
    var duocDoi = W.Q.doiNguoiLap(mod) && !ro;
    var ds = DB.all('nhanVien').filter(function (n) {
        return n.trangThai === 'Đang làm việc' || n.id === r.nguoiLapId;
    });
    var toi = W.Q.nhanVienCuaToi();
    var val = r.nguoiLapId || (toi ? toi.id : (ds[0] || {}).id) || '';
    var cb = UI.combo(host, {
        items: ds.map(function (n) {
            return { v: n.id, t: n.hoTen, s: n.ma + ' · ' + n.chucVu + (n.phongBan ? ' · ' + n.phongBan : '') +
                (n.trangThai !== 'Đang làm việc' ? ' · ĐÃ NGỪNG' : '') };
        }),
        value: val, placeholder: '— Chọn nhân viên —',
        onChange: function (v) { h.q('[data-f="nguoiLapId"]').value = v; }
    });
    h.q('[data-f="nguoiLapId"]').value = val;
    host.setAttribute('data-fk', 'nguoiLapId');
    h._cbNL = cb;
    if (!duocDoi) {
        host.style.pointerEvents = 'none';
        host.style.background = '#f2f5f8';
    }
};
/** Tên nhân viên lập từ id (dùng khi lưu và khi in). */
W.tenNguoiLap = function (id) {
    var n = DB.get('nhanVien', id);
    return n ? n.hoTen : '';
};

/* ==========================================================================
   1. BÁO GIÁ
   ========================================================================== */
var TT_BG = ['Nháp', 'Đã gửi KH', 'Đã duyệt', 'Đã chốt', 'Từ chối', 'Hết hiệu lực'];
S['bao-gia'] = function (host) {
    DocScreen(host, {
        title: 'Báo giá', dt: 'Báo giá', key: 'baoGia', seq: 'BG', file: 'DanhSach_BaoGia',
        taoHangHoa: true,          // mặt hàng chưa có được Danh mục khai bổ sung; chứng từ không tự sinh Mã hàng
        sub: 'Bước 1 của quy trình — chốt báo giá để chuyển sang Đơn bán hàng',
        crumb: ['Bán hàng', 'Báo giá'], stFirst: 'Nháp', duyet: { tt: 'Đã duyệt' }, trangThaiDS: TT_BG,
        rows: function () { return T.theoCty(DB.all('baoGia')); },
        search: ['so', 'khachHang', 'duAn', 'nguoiLap'],
        cols: [
            { k: 'so', t: 'Số báo giá', w: 148, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày lập', w: 104, fmt: 'date' },
            { k: 'donVi', t: 'Đơn vị PH', w: 92, r: function (v) { var d = DB.get('donVi', v); return d ? T.esc(d.tat) : v; } },
            { k: 'khachHang', t: 'Khách hàng', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' + (r.duAn ? '<div class="small muted">' + T.esc(r.duAn) + '</div>' : ''); } },
            { k: 'nguoiLap', t: 'Người lập', w: 148 },
            { k: '_sl', t: 'Số dòng', w: 78, cls: 'num', sortVal: function (r) { return (r.lines || []).length; },
              r: function (v, r) { return (r.lines || []).length; } },
            { k: 'thanhTien', t: 'Tiền hàng', w: 132, cls: 'num', fmt: 'money' },
            { k: 'tongCong', t: 'Tổng cộng', w: 142, cls: 'num', total: true, r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 132, r: function (v, r) {
                return T.pill(v) + (r.khoa ? ' <i class="bi bi-lock-fill" title="Chứng từ đã khóa" style="color:var(--err)"></i>' : ''); } },
            { k: '_db', t: 'Đơn bán', w: 140, sort: false, r: function (v, r) {
                var d = DB.all('donBan').filter(function (x) { return x.baoGiaId === r.id; })[0];
                return d ? '<span class="link mono small" onclick="event.stopPropagation();W.moChungTu(\'donBan\',\'' + d.id + '\')">' + T.esc(d.so) + '</span>'
                         : '<span class="muted small">—</span>'; } }
        ],
        filters: [
            { k: 'trangThai', t: 'Trạng thái', opts: TT_BG },
            { k: 'donVi', t: 'Đơn vị phát hành', w: 180, opts: DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat }; }) },
            { k: 'nguoiLapId', t: 'Người lập', w: 175, opts: DB.all('nhanVien').map(function (n) { return { v: n.id, t: n.hoTen }; }) },
            { k: 'ngay', t: 'Từ ngày', type: 'date', w: 140, test: function (x, v) { return x.ngay >= v; } }
        ],
        excel: [
            { t: 'Số báo giá', k: 'so', w: 18 }, { t: 'Ngày', k: 'ngay', w: 12 }, { t: 'Đơn vị PH', k: 'donVi', w: 12 },
            { t: 'Khách hàng', k: 'khachHang', w: 42 }, { t: 'Dự án', k: 'duAn', w: 26 },
            { t: 'Tiền hàng', k: 'thanhTien', w: 16 }, { t: 'VAT', k: 'vat', w: 14 },
            { t: 'Tổng cộng', k: 'tongCong', w: 18 }, { t: 'Trạng thái', k: 'trangThai', w: 14 },
            { t: 'Người lập', k: 'nguoiLap', w: 20 }
        ],
        blank: function () {
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, khachHangId: '', khachHang: '',
                duAn: '', nguoiLapId: (W.Q.nhanVienCuaToi() || {}).id || '', nguoiLap: (W.Q.nhanVienCuaToi() || {}).hoTen || '',
                nguoiLienHe: '',
                hieuLuc: 30, mucGia: 'BANLE', bangGiaId: '', lines: [], vatPct: 10,
                dieuKhoan: 'Giá đã bao gồm VAT 10%. Giao hàng trong 7-10 ngày kể từ ngày đặt hàng.',
                trangThai: 'Nháp', ghiChu: '' };
        },
        rules: [{ k: 'khachHangId' }, { k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' }],
        head: function (r, moi, ro) {
            return '<div class="grid4">' +
            '<div class="fld"><label>Số báo giá</label><input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
            '<div class="fld req"><label>Ngày lập</label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            '<div class="fld"><label>Công ty thực hiện</label><select data-f="donVi">' +
                opt(DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat + ' — ' + d.ten }; }), r.donVi || DB.data._meta.ctyId) + '</select></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(TT_BG, r.trangThai) + '</select></div>' +
            headKH(r) +
            '<div class="fld"><label>Bảng giá áp dụng <b class="req">*</b>' +
                '<button type="button" class="lnk-nut" id="bgNhanh" title="Tạo bảng giá mới ngay tại chứng từ">' +
                '<i class="bi bi-tags-fill"></i> Tạo bảng giá mới</button></label>' +
                '<select data-f="bangGiaId"></select>' +
                '<div class="small muted" id="bgGhiChu" style="margin-top:2px"></div></div>' +
            W.oMucGia(r) +
            '<div class="fld"><label>Hiệu lực (ngày)</label><input class="sl" data-f="hieuLuc" value="' + T.esc(r.hieuLuc || 30) + '"></div>' +
            '<input type="hidden" data-f="mucGia" value="' + T.esc(r.mucGia || 'BANLE') + '">' +
            W.oMD('duAn', { f: 'duAnId', fTen: 'duAn', gt: r.duAnId, gtTen: r.duAn, rong: true,
                            nhan: 'Dự án / công trình', tuDo: true }) +
            W.oNguoiLap(r, 'baoGia') +
            '<div class="fld"><label>&nbsp;</label><input type="hidden" data-f="khachHangId" value="' + T.esc(r.khachHangId || '') + '"><div class="small muted">Ngày hết hiệu lực tự tính theo số ngày</div></div>' +
            W.oMD('dieuKhoanTT', { f: 'dieuKhoanTTId', fTen: 'dieuKhoanTT', gt: r.dieuKhoanTTId,
                                   gtTen: r.dieuKhoanTT, rong: true, nhan: 'Điều khoản thanh toán', tuDo: true }) +
            W.oMD('dieuKhoanGH', { f: 'dieuKhoanGHId', fTen: 'dieuKhoanGH', gt: r.dieuKhoanGHId,
                                   gtTen: r.dieuKhoanGH, rong: true, nhan: 'Điều khoản giao hàng', tuDo: true }) +
            '<div class="fld span4" style="grid-column:span 4"><label>Điều khoản báo giá</label><textarea data-f="dieuKhoan" rows="2">' + T.esc(r.dieuKhoan || '') + '</textarea></div>' +
            '</div>';
        },
        onHead: function (h, r, setMuc, moi, ro, setBangGia) {
            h._bacGia = r.mucGia || 'BANLE';
            W.noiGiaChungTu(h, r, setMuc, setBangGia, 'baoGia', ro);
        },
        toObj: function (v, r, h) {
            var kh = DB.get('khachHang', h._cbKH.get());
            return { so: v.so, ngay: v.ngay, donVi: v.donVi, khachHangId: kh ? kh.id : '',
                khachHang: kh ? kh.ten : '', duAnId: v.duAnId || '', duAn: v.duAn, bangGiaId: v.bangGiaId,
                cotGia: v.cotGia || '',
                dieuKhoanTTId: v.dieuKhoanTTId || '', dieuKhoanTT: v.dieuKhoanTT || '',
                dieuKhoanGHId: v.dieuKhoanGHId || '', dieuKhoanGH: v.dieuKhoanGH || '',
                nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId), hieuLuc: Number(v.hieuLuc) || 30,
                mucGia: v.mucGia, dieuKhoan: v.dieuKhoan, trangThai: v.trangThai, ghiChu: r.ghiChu || '' };
        },
        next: {
            label: 'Tạo Đơn bán hàng',
            can: function (r) {
                return r.trangThai === 'Đã chốt' && !DB.all('donBan').filter(function (x) { return x.baoGiaId === r.id; }).length;
            },
            run: function (r, done) {
                UI.confirm({
                    title: 'Tạo Đơn bán hàng từ báo giá', icon: 'bi-arrow-right-circle-fill',
                    message: 'Tạo <b>Đơn bán hàng</b> từ báo giá <b>' + T.esc(r.so) + '</b> — ' + T.money(r.tongCong) + ' đ?',
                    note: 'Toàn bộ ' + (r.lines || []).length + ' dòng hàng và đơn giá sẽ được sao chép sang đơn bán.',
                    okText: 'Tạo đơn bán', okIcon: 'bi-cart-check',
                    ok: function () {
                        var o = {
                            so: DB.soMoi('DB'), ngay: T.today(), donVi: r.donVi, khachHangId: r.khachHangId,
                            khachHang: r.khachHang, duAn: r.duAn, baoGiaId: r.id, baoGiaSo: r.so,
                            nguoiLapId: r.nguoiLapId, nguoiLap: r.nguoiLap,
                            ngayGiao: T.addDays(T.today(), 7), mucGia: r.mucGia,
                            bangGiaId: r.bangGiaId || '', cotGia: r.cotGia || '',
                            diaDiemGiao: 'Kho công trình', dieuKhoanTT: 'Thanh toán 50% khi đặt hàng, 50% sau giao hàng',
                            lines: T.clone(r.lines), vatPct: r.vatPct === undefined ? 10 : r.vatPct,
                            thanhTien: r.thanhTien, vat: r.vat, tongCong: r.tongCong,
                            /* MÃ GIAO DỊCH KẾ THỪA NGAY LÚC TẠO.
                               Đơn bán và báo giá là CÙNG MỘT khoản tiền. Engine
                               nhận ra điều đó qua mã giao dịch; thiếu mã thì tới
                               lượt hợp đồng hay phiếu xuất lập tiếp từ đơn bán
                               này sẽ mang một khóa giao dịch khác và doanh thu
                               của cùng một thương vụ bị cộng hai lần cho tới khi
                               tải lại trang. Đây đúng là mã mà T.ganMaGD sẽ gán
                               ở lần nạp sau — gán ngay để số liệu đúng tức thì. */
                            maGD: r.maGD || '',
                            trangThai: 'Đã xác nhận', ghiChu: 'Lập từ báo giá ' + r.so
                        };
                        DB.insert('donBan', o);
                        done();
                        UI.toast('ok', 'Đã tạo đơn bán ' + o.so, 'Mở màn hình Đơn bán hàng để xem.');
                        setTimeout(function () { W.moChungTu('donBan', o.id); }, 400);
                    }
                });
            }
        }
    });
};

/* ==========================================================================
   2. ĐƠN BÁN HÀNG
   ========================================================================== */
var TT_DB = ['Nháp', 'Đã xác nhận', 'Đang giao', 'Hoàn thành', 'Đã hủy'];
S['don-ban'] = function (host) {
    DocScreen(host, {
        title: 'Đơn bán hàng', dt: 'Đơn bán', key: 'donBan', seq: 'DB', file: 'DanhSach_DonBanHang',
        taoHangHoa: true,          // mặt hàng chưa có được Danh mục khai bổ sung; chứng từ không tự sinh Mã hàng
        sub: 'Bước 2 — từ đơn bán có thể lập Hợp đồng, Phiếu xuất kho và Phiếu thu',
        crumb: ['Bán hàng', 'Đơn bán hàng'], stFirst: 'Nháp', duyet: { tt: 'Đã xác nhận' }, trangThaiDS: TT_DB,
        rows: function () {
            return T.theoCty(DB.all('donBan')).map(function (d) {
                var thu = T.sum(DB.all('phieuThu').filter(function (p) { return p.donBanId === d.id && p.trangThai === 'Đã ghi sổ'; }), function (p) { return p.soTien; });
                d._daThu = thu; d._conNo = d.tongCong - thu;
                return d;
            });
        },
        search: ['so', 'khachHang', 'duAn', 'baoGiaSo'],
        cols: [
            { k: 'so', t: 'Số đơn', w: 144, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày', w: 100, fmt: 'date' },
            { k: 'donVi', t: 'ĐVPH', w: 82, r: function (v) { var d = DB.get('donVi', v); return d ? T.esc(d.tat) : v; } },
            { k: 'khachHang', t: 'Khách hàng', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    (r.baoGiaSo ? '<div class="small muted">Từ báo giá ' + T.esc(r.baoGiaSo) + '</div>' : ''); } },
            { k: 'nguoiLap', t: 'Người lập', w: 148 },
            { k: 'ngayGiao', t: 'Ngày giao', w: 106, fmt: 'date' },
            { k: 'tongCong', t: 'Tổng cộng', w: 142, cls: 'num', total: true, r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: '_daThu', t: 'Đã thu', w: 130, cls: 'num', total: true, r: function (v) { return v ? '<span class="pos">' + T.money(v) + '</span>' : '<span class="muted">0</span>'; } },
            { k: '_conNo', t: 'Còn nợ', w: 130, cls: 'num', total: true, r: function (v) { return v > 0 ? '<b class="neg">' + T.money(v) + '</b>' : '<span class="pill g">đủ</span>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 132, r: function (v, r) {
                return T.pill(v) + (r.khoa ? ' <i class="bi bi-lock-fill" title="Chứng từ đã khóa" style="color:var(--err)"></i>' : ''); } }
        ],
        filters: [
            { k: 'trangThai', t: 'Trạng thái', opts: TT_DB },
            { k: 'donVi', t: 'Đơn vị phát hành', w: 180, opts: DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat }; }) },
            { k: '_conNo', t: 'Công nợ', w: 150, opts: [{ v: 'no', t: 'Còn nợ' }, { v: 'du', t: 'Đã thu đủ' }],
              test: function (x, v) { return v === 'no' ? x._conNo > 0 : x._conNo <= 0; } },
            { k: 'nguoiLapId', t: 'Người lập', w: 175, opts: DB.all('nhanVien').map(function (n) { return { v: n.id, t: n.hoTen }; }) }
        ],
        excel: [
            { t: 'Số đơn', k: 'so', w: 18 }, { t: 'Ngày', k: 'ngay', w: 12 }, { t: 'Khách hàng', k: 'khachHang', w: 42 },
            { t: 'Dự án', k: 'duAn', w: 24 }, { t: 'Báo giá gốc', k: 'baoGiaSo', w: 18 },
            { t: 'Tiền hàng', k: 'thanhTien', w: 16 }, { t: 'VAT', k: 'vat', w: 14 }, { t: 'Tổng cộng', k: 'tongCong', w: 18 },
            { t: 'Đã thu', k: '_daThu', w: 16 }, { t: 'Còn nợ', k: '_conNo', w: 16 }, { t: 'Trạng thái', k: 'trangThai', w: 14 }
        ],
        blank: function () {
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, khachHangId: '', khachHang: '', duAn: '',
                baoGiaId: '', baoGiaSo: '',
                nguoiLapId: (W.Q.nhanVienCuaToi() || {}).id || '', nguoiLap: (W.Q.nhanVienCuaToi() || {}).hoTen || '',
                ngayGiao: T.addDays(T.today(), 7),
                mucGia: 'BANLE', diaDiemGiao: '', dieuKhoanTT: 'Thanh toán 100% sau khi giao hàng',
                lines: [], vatPct: 10, trangThai: 'Nháp', ghiChu: '' };
        },
        rules: [{ k: 'khachHangId' }, { k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' }],
        head: function (r) {
            return '<div class="grid4">' +
            '<div class="fld"><label>Số đơn hàng</label><input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
            '<div class="fld req"><label>Ngày đặt hàng</label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            '<div class="fld"><label>Công ty thực hiện</label><select data-f="donVi">' +
                opt(DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat + ' — ' + d.ten }; }), r.donVi || DB.data._meta.ctyId) + '</select></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(TT_DB, r.trangThai) + '</select></div>' +
            headKH(r) +
            '<div class="fld"><label>Bảng giá áp dụng <b class="req">*</b>' +
                '<button type="button" class="lnk-nut" id="bgNhanh" title="Tạo bảng giá mới ngay tại chứng từ">' +
                '<i class="bi bi-tags-fill"></i> Tạo bảng giá mới</button></label>' +
                '<select data-f="bangGiaId"></select>' +
                '<div class="small muted" id="bgGhiChu" style="margin-top:2px"></div></div>' +
            W.oMucGia(r) +
            '<input type="hidden" data-f="mucGia" value="' + T.esc(r.mucGia || 'BANLE') + '">' +
            '<div class="fld"><label>Ngày giao hàng</label><input type="date" data-f="ngayGiao" value="' + T.esc(r.ngayGiao || '') + '"></div>' +
            W.oMD('duAn', { f: 'duAnId', fTen: 'duAn', gt: r.duAnId, gtTen: r.duAn, rong: true,
                            nhan: 'Dự án / công trình', tuDo: true }) +
            '<div class="fld"><label>Địa điểm giao</label><input data-f="diaDiemGiao" value="' + T.esc(r.diaDiemGiao || '') + '"></div>' +
            W.oNguoiLap(r, 'donBan') +
            W.oMD('dieuKhoanTT', { f: 'dieuKhoanTTId', fTen: 'dieuKhoanTT', gt: r.dieuKhoanTTId,
                                   gtTen: r.dieuKhoanTT, rong: true, nhan: 'Điều khoản thanh toán', tuDo: true }) +
            W.oMD('dieuKhoanGH', { f: 'dieuKhoanGHId', fTen: 'dieuKhoanGH', gt: r.dieuKhoanGHId,
                                   gtTen: r.dieuKhoanGH, rong: true, nhan: 'Điều khoản giao hàng', tuDo: true }) +
            '<div class="fld span2"><label>Báo giá gốc</label><input data-f="baoGiaSo" value="' + T.esc(r.baoGiaSo || '') + '" disabled placeholder="(lập trực tiếp)"></div>' +
            '<input type="hidden" data-f="khachHangId" value="' + T.esc(r.khachHangId || '') + '">' +
            '</div>';
        },
        onHead: function (h, r, setMuc, moi, ro, setBangGia) {
            h._bacGia = r.mucGia || 'BANLE';
            W.noiGiaChungTu(h, r, setMuc, setBangGia, 'donBan', ro);
        },
        toObj: function (v, r, h) {
            var kh = DB.get('khachHang', h._cbKH.get());
            return { so: v.so, ngay: v.ngay, donVi: v.donVi, khachHangId: kh ? kh.id : '', khachHang: kh ? kh.ten : '',
                duAnId: v.duAnId || '', duAn: v.duAn, bangGiaId: v.bangGiaId, cotGia: v.cotGia || '',
                baoGiaId: r.baoGiaId || '', baoGiaSo: r.baoGiaSo || '',
                nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId), ngayGiao: v.ngayGiao, mucGia: v.mucGia, diaDiemGiao: v.diaDiemGiao,
                dieuKhoanTTId: v.dieuKhoanTTId || '', dieuKhoanTT: v.dieuKhoanTT,
                dieuKhoanGHId: v.dieuKhoanGHId || '', dieuKhoanGH: v.dieuKhoanGH || '',
                trangThai: v.trangThai, ghiChu: r.ghiChu || '' };
        },
        next: {
            label: 'Bước tiếp theo',
            can: function () { return true; },
            run: function (r, done) { W.buocTiep(r, done); }
        }
    });
};

/* --------- Popup "bước tiếp theo" của đơn bán --------- */
W.buocTiep = function (db, done) {
    var hs = T.hoSo('donBan', db.id);
    var coHD = !!hs.hopDong, soPX = hs.phieuXuat.length;
    var daThu = T.sum(hs.phieuThu, function (p) { return p.soTien; });
    UI.modal({
        size: 'md', title: 'Bước tiếp theo cho đơn hàng ' + db.so,
        sub: db.khachHang + ' — ' + T.money(db.tongCong) + ' đ',
        body: '<div class="row" style="flex-direction:column;align-items:stretch;gap:9px">' +
            btnStep('hd', 'bi-file-earmark-ruled', 'Lập Hợp đồng',
                coHD ? 'Đã có hợp đồng ' + hs.hopDong.so
                     : 'Chọn loại hợp đồng rồi sinh hợp đồng từ đơn hàng này', coHD) +
            btnStep('px', 'bi-box-arrow-right', 'Lập Phiếu xuất kho',
                soPX ? 'Đã có ' + soPX + ' phiếu xuất — có thể lập thêm' : 'Xuất hàng cho khách theo đơn', false) +
            btnStep('pt', 'bi-cash-coin', 'Lập Phiếu thu tiền',
                daThu >= db.tongCong ? 'Đơn hàng đã thu đủ' : 'Còn phải thu ' + T.money(db.tongCong - daThu) + ' đ',
                daThu >= db.tongCong) +
            btnStep('hs', 'bi-diagram-3', 'Xem hồ sơ liên quan', 'Toàn bộ chuỗi chứng từ của đơn hàng', false) +
            '</div>',
        buttons: [{ text: 'Đóng', click: function (h) { h.close(); } }],
        onOpen: function (h) {
            h.el.querySelectorAll('[data-step]').forEach(function (b) {
                b.onclick = function () {
                    var k = b.getAttribute('data-step');
                    h.close();
                    if (k === 'hd') W.taoHopDong(db, done);
                    else if (k === 'px') W.taoPhieuXuat(db, done);
                    else if (k === 'pt') W.taoPhieuThu(db, done);
                    else W.xemHoSo('donBan', db.id);
                };
            });
        }
    });
};
function btnStep(k, ico, t, s, off) {
    return '<button class="btn" data-step="' + k + '" ' + (off ? 'disabled' : '') +
        ' style="height:auto;padding:11px 13px;justify-content:flex-start;text-align:left">' +
        '<i class="bi ' + ico + '" style="font-size:21px;color:var(--brand)"></i>' +
        '<span><b style="display:block;font-size:14px">' + t + '</b>' +
        '<small class="muted">' + T.esc(s) + '</small></span></button>';
}

/**
 * Lập hợp đồng từ một đơn bán hàng.
 * Phần mềm KHÔNG tự chọn một loại hợp đồng mặc định — luôn hỏi người dùng
 * chọn loại trong DANH MỤC LOẠI HỢP ĐỒNG, rồi dùng đúng biểu mẫu của loại đó.
 */
W.taoHopDong = function (db, done) {
    W.chonLoaiHopDong(function (L) {
        var cty = DB.get('donVi', db.donVi) || DB.cty();
        var o = {
            so: DB.soHopDong(L), ngay: T.today(), donVi: db.donVi, khachHangId: db.khachHangId,
            khachHang: db.khachHang, duAn: db.duAn, donBanId: db.id, donBanSo: db.so,
            baoGiaId: db.baoGiaId || '', baoGiaSo: db.baoGiaSo || '',
            loaiId: L.id, loai: L.ten, giaTri: db.tongCong, ngayHieuLuc: T.today(),
            ngayKetThuc: T.addDays(T.today(), 90),
            dieuKhoanTT: 'Tạm ứng 30%, thanh toán 60% sau giao hàng, giữ lại 10% bảo hành 12 tháng',
            baoHanh: 12, nguoiKy: cty.daiDien, nguoiLapId: db.nguoiLapId, nguoiLap: db.nguoiLap,
            trangThai: 'Đã ký', lines: T.clone(db.lines), maGD: db.maGD || '',
            /* Kế thừa đúng phiên bản bảng giá và cột giá của đơn bán — hợp đồng
               không được tự chọn lại phiên bản khác. */
            bangGiaId: db.bangGiaId || '', cotGia: db.cotGia || '', mucGia: db.mucGia || '',
            vatPct: db.vatPct, thanhTien: db.thanhTien, vat: db.vat, tongCong: db.tongCong,
            ghiChu: 'Lập từ đơn bán ' + db.so
        };
        T.dongBangGiaGocNB(o); T.dongBangGiaVon(o);
        DB.insert('hopDong', o); if (done) done(); W.route();
        UI.toast('ok', 'Đã lập ' + L.ten.toLowerCase() + ' ' + o.so, T.money(o.tongCong) + ' đ');
        setTimeout(function () { W.moChungTu('hopDong', o.id); }, 400);
    });
};

W.taoPhieuXuat = function (db, done) {
    var hd = DB.all('hopDong').filter(function (h) { return h.donBanId === db.id; })[0];
    /* Phiếu xuất kế thừa ĐÚNG phiên bản bảng giá của đơn bán để Engine không tính
       lại giá vốn theo phiên bản khác và theo ngày hôm nay. */
    var o = {
        so: DB.soMoi('PX'), ngay: T.today(), donVi: db.donVi, khoId: (T.khoChinh() || {}).id,
        khachHangId: db.khachHangId, khachHang: db.khachHang, duAn: db.duAn,
        donBanId: db.id, donBanSo: db.so, hopDongId: hd ? hd.id : '', hopDongSo: hd ? hd.so : '',
        nguoiNhan: 'Đại diện bên mua', nguoiGiao: DB.user().hoTen,
        nguoiLapId: db.nguoiLapId, nguoiLap: db.nguoiLap, lyDo: 'Xuất bán theo đơn hàng ' + db.so,
        bangGiaId: db.bangGiaId || '', cotGia: db.cotGia || '',
        phuongTien: 'Xe tải 1.25T', lines: T.clone(db.lines), vatPct: db.vatPct,
        /* MÃ GIAO DỊCH KẾ THỪA NGAY LÚC TẠO — xem giải thích ở chỗ tạo đơn bán
           từ báo giá. Phiếu xuất và đơn bán là CÙNG MỘT thương vụ; thiếu mã
           giao dịch thì Engine coi đây là hai giao dịch khác nhau và doanh thu
           bị cộng hai lần cho tới lần tải trang kế tiếp. */
        maGD: db.maGD || '',
        thanhTien: db.thanhTien, vat: db.vat, tongCong: db.tongCong, trangThai: 'Đã xuất kho', ghiChu: ''
    };
    // đóng băng giá vốn tại thời điểm xuất trước khi ghi sổ kho
    T.dongBangGiaVon(o);
    DB.insert('phieuXuat', o);
    // trừ tồn của kho duy nhất + ghi thẻ kho (mọi công ty đều xuất từ Kho Tản Viên)
    T.ghiXuatKho(o);
    if (done) done(); W.route();
    UI.toast('ok', 'Đã lập phiếu xuất ' + o.so, 'Tồn kho đã được trừ và ghi vào thẻ kho.');
    setTimeout(function () { W.moChungTu('phieuXuat', o.id); }, 400);
};

/* ==========================================================================
   3. HỢP ĐỒNG
   ========================================================================== */
var TT_HD = ['Nháp', 'Đã ký', 'Đang thực hiện', 'Đã thanh lý', 'Đã hủy'];
S['hop-dong'] = function (host) {
    DocScreen(host, {
        title: 'Hợp đồng', dt: 'Hợp đồng', key: 'hopDong', seq: 'HD', file: 'DanhSach_HopDong',
        taoHangHoa: true,          // mặt hàng chưa có được Danh mục khai bổ sung; chứng từ không tự sinh Mã hàng
        sub: 'Bước 3 — hợp đồng gắn với đơn bán hàng; mỗi loại hợp đồng một biểu mẫu riêng',
        crumb: ['Bán hàng', 'Hợp đồng'], stFirst: 'Nháp', duyet: { tt: 'Đã ký' }, trangThaiDS: TT_HD,
        rows: function () { return T.theoCty(DB.all('hopDong')); },
        search: ['so', 'khachHang', 'duAn', 'donBanSo'],
        /* Số hợp đồng chạy theo TIỀN TỐ của loại hợp đồng trong danh mục. */
        soMoi: function (o) { return DB.soHopDong(DB.get('loaiHopDong', o.loaiId)); },
        cols: [
            { k: 'so', t: 'Số hợp đồng', w: 168, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày ký', w: 102, fmt: 'date' },
            { k: 'khachHang', t: 'Bên mua', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' + (r.duAn ? '<div class="small muted">' + T.esc(r.duAn) + '</div>' : ''); } },
            { k: 'loai', t: 'Loại HĐ', w: 152 },
            { k: 'ngayKetThuc', t: 'Hiệu lực đến', w: 120, fmt: 'date' },
            { k: 'baoHanh', t: 'BH (tháng)', w: 100, cls: 'num' },
            { k: 'tongCong', t: 'Giá trị HĐ', w: 150, cls: 'num', total: true, r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 132, r: function (v) { return T.pill(v); } }
        ],
        filters: [
            { k: 'trangThai', t: 'Trạng thái', opts: TT_HD },
            { k: 'loai', t: 'Loại hợp đồng', w: 200,
              opts: T.loaiHDDungDuoc().map(function (L) { return L.ten; }) }
        ],
        excel: [
            { t: 'Số hợp đồng', k: 'so', w: 22 }, { t: 'Ngày ký', k: 'ngay', w: 12 }, { t: 'Bên mua', k: 'khachHang', w: 42 },
            { t: 'Dự án', k: 'duAn', w: 24 }, { t: 'Đơn bán', k: 'donBanSo', w: 18 }, { t: 'Loại HĐ', k: 'loai', w: 20 },
            { t: 'Giá trị', k: 'tongCong', w: 18 }, { t: 'Hiệu lực đến', k: 'ngayKetThuc', w: 14 },
            { t: 'Bảo hành (tháng)', k: 'baoHanh', w: 14 }, { t: 'Trạng thái', k: 'trangThai', w: 16 }
        ],
        blank: function () {
            var c = DB.cty();
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, khachHangId: '', khachHang: '', duAn: '',
                donBanId: '', donBanSo: '',
                loaiId: (T.loaiHDDungDuoc()[0] || {}).id || '',
                loai: (T.loaiHDDungDuoc()[0] || {}).ten || '', ngayHieuLuc: T.today(),
                nguoiLapId: (W.Q.nhanVienCuaToi() || {}).id || '', nguoiLap: (W.Q.nhanVienCuaToi() || {}).hoTen || '',
                ngayKetThuc: T.addDays(T.today(), 90), baoHanh: 12, nguoiKy: c.daiDien,
                dieuKhoanTT: 'Tạm ứng 30%, thanh toán 60% sau giao hàng, giữ lại 10% bảo hành 12 tháng',
                lines: [], vatPct: 10, trangThai: 'Nháp', ghiChu: '' };
        },
        rules: [{ k: 'khachHangId' }, { k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' },
                { k: 'loaiId', msg: 'Phải chọn loại hợp đồng' }],
        head: function (r) {
            return '<div class="grid4">' +
            '<div class="fld"><label>Số hợp đồng</label><input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
            '<div class="fld req"><label>Ngày ký</label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            '<div class="fld"><label>Công ty thực hiện</label><select data-f="donVi">' +
                opt(DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat + ' — ' + d.ten }; }), r.donVi || DB.data._meta.ctyId) + '</select></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(TT_HD, r.trangThai) + '</select></div>' +
            headKH(r, 'Bên mua (Bên A)') +
            '<div class="fld req"><label>Loại hợp đồng</label><select data-f="loaiId">' +
                opt(T.loaiHDDungDuoc().map(function (L) { return { v: L.id, t: L.ten }; }),
                    r.loaiId || (T.loaiHDCua(r) || {}).id || '') + '</select></div>' +
            '<div class="fld"><label>Đơn bán gắn kèm</label><input data-f="donBanSo" value="' + T.esc(r.donBanSo || '') + '" disabled placeholder="(lập trực tiếp)"></div>' +
            W.oMD('duAn', { f: 'duAnId', fTen: 'duAn', gt: r.duAnId, gtTen: r.duAn, rong: true,
                            nhan: 'Dự án / công trình', tuDo: true }) +
            '<div class="fld"><label>Hiệu lực từ</label><input type="date" data-f="ngayHieuLuc" value="' + T.esc(r.ngayHieuLuc || '') + '"></div>' +
            '<div class="fld"><label>Hiệu lực đến</label><input type="date" data-f="ngayKetThuc" value="' + T.esc(r.ngayKetThuc || '') + '"></div>' +
            '<div class="fld"><label>Bảo hành (tháng)</label><input class="sl" data-f="baoHanh" value="' + T.esc(r.baoHanh || 12) + '"></div>' +
            '<div class="fld"><label>Người ký (Bên B)</label><input data-f="nguoiKy" value="' + T.esc(r.nguoiKy || '') + '"></div>' +
            W.oNguoiLap(r, 'hopDong') +
            W.oMD('dieuKhoanTT', { f: 'dieuKhoanTTId', fTen: 'dieuKhoanTT', gt: r.dieuKhoanTTId,
                                   gtTen: r.dieuKhoanTT, rong: true, nhan: 'Điều khoản thanh toán', tuDo: true }) +
            W.oMD('dieuKhoanGH', { f: 'dieuKhoanGHId', fTen: 'dieuKhoanGH', gt: r.dieuKhoanGHId,
                                   gtTen: r.dieuKhoanGH, rong: true, nhan: 'Điều khoản giao hàng', tuDo: true }) +
            '<input type="hidden" data-f="khachHangId" value="' + T.esc(r.khachHangId || '') + '">' +
            '</div>';
        },
        onHead: function (h, r, setMuc, moi, ro) { comboKH(h, r, null, ro); W.bindNguoiLap(h, r, 'hopDong', ro); },
        toObj: function (v, r, h) {
            var kh = DB.get('khachHang', h._cbKH.get());
            return { so: v.so, ngay: v.ngay, donVi: v.donVi, khachHangId: kh ? kh.id : '', khachHang: kh ? kh.ten : '',
                duAnId: v.duAnId || '', duAn: v.duAn, donBanId: r.donBanId || '', donBanSo: r.donBanSo || '',
                baoGiaId: r.baoGiaId || '', baoGiaSo: r.baoGiaSo || '',
                loaiId: v.loaiId, loai: ((DB.get('loaiHopDong', v.loaiId) || {}).ten) || r.loai || '',
                ngayHieuLuc: v.ngayHieuLuc, ngayKetThuc: v.ngayKetThuc, baoHanh: Number(v.baoHanh) || 0,
                nguoiKy: v.nguoiKy, dieuKhoanTTId: v.dieuKhoanTTId || '', dieuKhoanTT: v.dieuKhoanTT,
                dieuKhoanGHId: v.dieuKhoanGHId || '', dieuKhoanGH: v.dieuKhoanGH || '', trangThai: v.trangThai,
                nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId),
                giaTri: 0, ghiChu: r.ghiChu || '' };
        },
        next: {
            label: 'Lập Phiếu xuất kho',
            can: function (r) { return !!r.donBanId; },
            run: function (r, done) {
                var db = DB.get('donBan', r.donBanId);
                if (!db) { UI.toast('warn', 'Hợp đồng chưa gắn đơn bán'); return; }
                W.taoPhieuXuat(db, done);
            }
        }
    });
};

/* ==========================================================================
   4. PHIẾU XUẤT KHO
   ========================================================================== */
var TT_PX = ['Chờ xuất', 'Đã xuất kho', 'Đã hủy'];
S['phieu-xuat'] = function (host) {
    DocScreen(host, {
        title: 'Phiếu xuất kho', dt: 'Phiếu xuất', key: 'phieuXuat', seq: 'PX', file: 'DanhSach_PhieuXuatKho',
        sub: 'Chứng từ ghi giảm tồn kho — sinh từ chứng từ nguồn, không lập tay',
        crumb: ['Kho', 'Phiếu xuất kho'], stFirst: 'Chờ xuất', duyet: { tt: 'Đã xuất kho' }, trangThaiDS: TT_PX,
        tabKho: 'phieu-xuat', khoaTrangThai: true,
        // NGUYÊN TẮC: không nhập tay lại dữ liệu — phiếu xuất luôn sinh từ chứng từ nguồn
        khongLapTay: { nut: 'Lập phiếu xuất từ Đơn bán hàng', route: 'don-ban' },
        banner: '<div class="note b mb12"><i class="bi bi-info-circle-fill"></i><div>' +
            '<b>Không xuất kho trực tiếp.</b> Phiếu xuất kho chỉ sinh từ chứng từ nguồn: <b>Đơn bán</b> ' +
            '(mở Đơn bán hàng hoặc Hợp đồng rồi bấm <b>Tạo chứng từ tiếp theo → Phiếu xuất kho</b>), ' +
            '<b>Xuất nội bộ</b>, <b>Trả nhà cung cấp</b> và <b>Điều chỉnh</b>. Hệ thống kế thừa toàn bộ ' +
            'khách hàng, dòng hàng, số lượng và đơn giá, đóng băng giá vốn, trừ tồn kho và ghi vào thẻ kho.</div></div>',
        rows: function () { return T.theoCty(DB.all('phieuXuat')); },
        search: ['so', 'khachHang', 'donBanSo', 'duAn'],
        cols: [
            { k: 'so', t: 'Số phiếu', w: 154, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày xuất', w: 106, fmt: 'date' },
            { k: 'nguon', t: 'Nguồn xuất', w: 140, r: function (v) {
                return '<span class="pill ' + (v === 'Đơn bán' ? 'c' : v === 'Điều chỉnh' ? 'n' : 'y') + '">' +
                    T.esc(v || 'Đơn bán') + '</span>'; } },
            { k: 'khachHang', t: 'Người nhận / khách hàng', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    (r.donBanSo ? '<div class="small muted">Đơn ' + T.esc(r.donBanSo) + (r.hopDongSo ? ' · HĐ ' + T.esc(r.hopDongSo) : '') + '</div>' : ''); } },
            { k: '_sl', t: 'Số dòng', w: 78, cls: 'num', sortVal: function (r) { return (r.lines || []).length; },
              r: function (v, r) { return (r.lines || []).length; } },
            { k: 'tongCong', t: 'Giá trị xuất', w: 148, cls: 'num', total: true, r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 128, r: function (v) { return T.pill(v); } }
        ],
        filters: [
            { k: 'nguon', t: 'Nguồn xuất', w: 170, opts: T.NGUON_XUAT },
            { k: 'trangThai', t: 'Trạng thái', opts: TT_PX },
            { k: 'donVi', t: 'Đơn vị phát hành', w: 180,
              opts: DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat }; }) }
        ],
        excel: [
            { t: 'Số phiếu', k: 'so', w: 20 }, { t: 'Ngày', k: 'ngay', w: 12 },
            { t: 'Nguồn xuất', k: 'nguon', w: 16 },
            { t: 'Kho', k: 'khoId', w: 20, v: function (r) { var k = DB.get('kho', r.khoId); return k ? k.ten : ''; } },
            { t: 'Khách hàng', k: 'khachHang', w: 42 }, { t: 'Đơn bán', k: 'donBanSo', w: 18 },
            { t: 'Hợp đồng', k: 'hopDongSo', w: 20 }, { t: 'Giá trị', k: 'tongCong', w: 18 },
            { t: 'Người giao', k: 'nguoiGiao', w: 20 }, { t: 'Trạng thái', k: 'trangThai', w: 16 }
        ],
        blank: function () {
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, khoId: (T.khoChinh() || {}).id,
                khachHangId: '', khachHang: '', duAn: '', donBanId: '', donBanSo: '', hopDongId: '', hopDongSo: '',
                nguoiNhan: '', nguoiGiao: DB.user().hoTen, nguon: 'Đơn bán',
                nguoiLapId: (W.Q.nhanVienCuaToi() || {}).id || '', nguoiLap: (W.Q.nhanVienCuaToi() || {}).hoTen || '',
                lyDo: 'Xuất bán hàng', phuongTien: '',
                lines: [], vatPct: 10, trangThai: 'Chờ xuất', ghiChu: '' };
        },
        rules: [{ k: 'khachHangId' }, { k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' }],
        head: function (r) {
            return '<div class="grid4">' +
            '<div class="fld"><label>Số phiếu xuất</label><input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
            '<div class="fld req"><label>Ngày xuất</label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            // toàn hệ thống chỉ có 01 kho — không bắt người dùng chọn lại
            W.oMD('kho', { f: 'khoId', gt: r.khoId || (T.khoChinh() || {}).id || '', nhan: 'Kho xuất' }) +
            '<div class="fld"><label>Nguồn xuất</label><select data-f="nguon">' +
                opt(T.NGUON_XUAT, r.nguon || 'Đơn bán') + '</select></div>' +
            '<div class="fld"><label>Trạng thái</label>' +
                '<input value="' + T.esc(r.trangThai || 'Chờ xuất') + '" readonly ' +
                'title="Trạng thái nghiệp vụ do hệ thống tự chuyển khi duyệt phiếu xuất">' +
                '<input type="hidden" data-f="trangThai" value="' + T.esc(r.trangThai || 'Chờ xuất') + '">' +
                '<div class="small muted" style="margin-top:2px">Hệ thống tự chuyển khi duyệt phiếu</div></div>' +
            headKH(r, 'Khách hàng nhận hàng') +
            '<div class="fld"><label>Người nhận hàng</label><input data-f="nguoiNhan" value="' + T.esc(r.nguoiNhan || '') + '"></div>' +
            W.oMD('nhanVien', { f: 'nguoiGiaoId', fTen: 'nguoiGiao', gt: r.nguoiGiaoId, gtTen: r.nguoiGiao,
                                nhan: 'Người giao hàng', tuDo: true }) +
            W.oNguoiLap(r, 'phieuXuat') +
            W.oMD('duAn', { f: 'duAnId', fTen: 'duAn', gt: r.duAnId, gtTen: r.duAn, rong: true,
                            nhan: 'Dự án / công trình', tuDo: true }) +
            '<div class="fld"><label>Đơn bán</label><input data-f="donBanSo" value="' + T.esc(r.donBanSo || '') + '" disabled placeholder="(xuất trực tiếp)"></div>' +
            '<div class="fld"><label>Hợp đồng</label><input data-f="hopDongSo" value="' + T.esc(r.hopDongSo || '') + '" disabled></div>' +
            '<div class="fld span2"><label>Lý do xuất kho</label><input data-f="lyDo" value="' + T.esc(r.lyDo || '') + '"></div>' +
            '<div class="fld span2"><label>Phương tiện vận chuyển</label><input data-f="phuongTien" value="' + T.esc(r.phuongTien || '') + '"></div>' +
            '<input type="hidden" data-f="khachHangId" value="' + T.esc(r.khachHangId || '') + '">' +
            '</div>';
        },
        onHead: function (h, r, setMuc, moi, ro) { comboKH(h, r, function (m) { setMuc(m); }, ro); W.bindNguoiLap(h, r, 'phieuXuat', ro); },
        toObj: function (v, r, h) {
            var kh = DB.get('khachHang', h._cbKH.get());
            return { so: v.so, ngay: v.ngay, donVi: r.donVi || DB.data._meta.ctyId, khoId: v.khoId,
                khachHangId: kh ? kh.id : '', khachHang: kh ? kh.ten : '',
                duAnId: v.duAnId || '', duAn: v.duAn,
                donBanId: r.donBanId || '', donBanSo: r.donBanSo || '', hopDongId: r.hopDongId || '',
                hopDongSo: r.hopDongSo || '', nguon: v.nguon || r.nguon || 'Đơn bán',
                nguoiNhan: v.nguoiNhan, nguoiGiaoId: v.nguoiGiaoId || '', nguoiGiao: v.nguoiGiao,
                nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId),
                lyDo: v.lyDo, phuongTien: v.phuongTien, trangThai: v.trangThai, ghiChu: r.ghiChu || '' };
        },
        next: {
            label: 'Lập Phiếu thu',
            can: function (r) { return !!r.donBanId; },
            run: function (r, done) {
                var db = DB.get('donBan', r.donBanId);
                if (!db) { UI.toast('warn', 'Phiếu xuất chưa gắn đơn bán'); return; }
                W.taoPhieuThu(db, done);
            }
        }
    });
};

/* ==========================================================================
   5. ĐƠN MUA HÀNG
   ========================================================================== */
var TT_DM = ['Nháp', 'Đã đặt hàng', 'Đã nhận hàng', 'Đã hủy'];
S['don-mua'] = function (host) {
    DocScreen(host, {
        title: 'Đơn mua hàng', dt: 'Đơn mua', key: 'donMua', seq: 'DM', file: 'DanhSach_DonMuaHang',
        taoHangHoa: true,          // mặt hàng chưa có được Danh mục khai bổ sung; chứng từ không tự sinh Mã hàng
        sub: 'Mua hàng đầu vào từ nhà cung cấp — nhận hàng làm tăng tồn kho',
        crumb: ['Mua hàng', 'Đơn mua hàng'], stFirst: 'Nháp', duyet: { tt: 'Đã đặt hàng' }, trangThaiDS: TT_DM,
        khoaTrangThai: true,
        doiTac: { coll: 'nhaCungCap', idF: 'nhaCungCapId', tenF: 'nhaCungCap', nhan: 'Nhà cung cấp' },
        rows: function () { return T.theoCty(DB.all('donMua')); },
        search: ['so', 'nhaCungCap'],
        cols: [
            { k: 'so', t: 'Số đơn mua', w: 148, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày đặt', w: 106, fmt: 'date' },
            { k: 'nhaCungCap', t: 'Nhà cung cấp' },
            { k: 'khoId', t: 'Kho nhập', w: 150, r: function (v) { var k = DB.get('kho', v); return k ? T.esc(k.ten) : '—'; } },
            { k: 'ngayNhan', t: 'Ngày nhận', w: 112, fmt: 'date' },
            { k: 'tongCong', t: 'Tổng cộng', w: 150, cls: 'num', total: true, r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 132, r: function (v) { return T.pill(v); } }
        ],
        filters: [{ k: 'trangThai', t: 'Trạng thái', opts: TT_DM }],
        excel: [
            { t: 'Số đơn mua', k: 'so', w: 18 }, { t: 'Ngày', k: 'ngay', w: 12 }, { t: 'Nhà cung cấp', k: 'nhaCungCap', w: 26 },
            { t: 'Tiền hàng', k: 'thanhTien', w: 16 }, { t: 'VAT', k: 'vat', w: 14 }, { t: 'Tổng cộng', k: 'tongCong', w: 18 },
            { t: 'Trạng thái', k: 'trangThai', w: 16 }
        ],
        blank: function () {
            var ncc = DB.all('nhaCungCap')[0] || {};
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, nhaCungCapId: ncc.id || '',
                nhaCungCap: ncc.ten || '', khoId: (T.khoChinh() || {}).id,
                nguoiLapId: (W.Q.nhanVienCuaToi() || {}).id || '', nguoiLap: (W.Q.nhanVienCuaToi() || {}).hoTen || '',
                ngayNhan: T.addDays(T.today(), 10), lines: [], vatPct: 10, trangThai: 'Nháp', ghiChu: '' };
        },
        rules: [{ k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' }],
        head: function (r) {
            return '<div class="grid4">' +
            '<div class="fld"><label>Số đơn mua</label><input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
            '<div class="fld req"><label>Ngày đặt hàng</label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            '<div class="fld"><label>Ngày nhận dự kiến</label><input type="date" data-f="ngayNhan" value="' + T.esc(r.ngayNhan || '') + '"></div>' +
            '<div class="fld"><label>Trạng thái</label>' +
            '<input value="' + T.esc(r.trangThai || 'Nháp') + '" readonly ' +
            'title="Trạng thái nghiệp vụ do hệ thống tự chuyển: Nháp → Đã đặt hàng → Đã nhận hàng">' +
            '<input type="hidden" data-f="trangThai" value="' + T.esc(r.trangThai || 'Nháp') + '">' +
            '<div class="small muted" style="margin-top:2px">Hệ thống tự chuyển khi duyệt đơn và khi hàng về nhập kho</div></div>' +
            W.oMD('nhaCungCap', { f: 'nhaCungCapId', fTen: 'nhaCungCap', gt: r.nhaCungCapId,
                                  gtTen: r.nhaCungCap, rong: true, req: true }) +
            W.oMD('kho', { f: 'khoId', gt: r.khoId || (T.khoChinh() || {}).id || '', nhan: 'Kho nhập' }) +
            W.oNguoiLap(r, 'donMua') +
            '</div>';
        },
        onHead: function (h, r, setMuc, moi, ro) { W.bindNguoiLap(h, r, 'donMua', ro); },
        toObj: function (v, r) {
            var n = DB.get('nhaCungCap', v.nhaCungCapId);
            return { so: v.so, ngay: v.ngay, donVi: r.donVi || DB.data._meta.ctyId, nhaCungCapId: v.nhaCungCapId,
                nhaCungCap: n ? n.ten : '', khoId: v.khoId,
                nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId), ngayNhan: v.ngayNhan,
                trangThai: v.trangThai, ghiChu: r.ghiChu || '' };
        },
        next: {
            /* MỘT PHÂN HỆ NHẬP HÀNG DUY NHẤT.
               Trước đây màn hình này lập thêm một lô nhập thứ hai cho cùng một
               phiếu, sinh dữ liệu trùng và hai đường tính giá vốn khác nhau.
               Nay mọi việc nhập hàng đều làm tại phân hệ Nhập hàng: mở đúng
               phiếu đó, không tạo thêm bản ghi nào. */
            label: 'Mở tại phân hệ Nhập hàng',
            can: function (r) { return !!r.id; },
            run: function (r, done) {
                if (done) done();
                W.moChungTu('donMua', r.id);
            }
        }
    });
};

/* ==========================================================================
   MỞ NHANH MỘT CHỨNG TỪ TỪ MÀN HÌNH KHÁC
   ========================================================================== */
var ROUTE_OF = W.ROUTE_CT = {
    baoGia: 'bao-gia', donBan: 'don-ban', hopDong: 'hop-dong', phuLuc: 'phu-luc',
    phieuXuat: 'phieu-xuat', bienBanGiao: 'bien-ban-giao', bienBanNghiemThu: 'nghiem-thu',
    deNghiTT: 'de-nghi-tt', phieuThu: 'phieu-thu', phieuChi: 'phieu-chi',
    /* Đơn mua hàng và Lô nhập hàng chỉ còn MỘT màn hình duy nhất: Nhập hàng.
       Mọi liên kết cũ trong hệ thống đều mở đúng màn hình mới này. */
    donMua: 'nhap-hang', loNhap: 'nhap-hang', phieuNhap: 'phieu-nhap'
};
W.moChungTu = function (key, id) {
    W.go(ROUTE_OF[key]);
    setTimeout(function () {
        var r = DB.get(key, id);
        if (!r) return;
        /* Ưu tiên biểu mẫu ĐÚNG LOẠI chứng từ. Màn hình nào không dựng bằng
           DocScreen (Phiếu nhập kho, Nhập hàng…) chỉ khai FORM_CT của chính nó;
           nếu chỉ dùng W.__docForm thì hoặc không mở được gì, hoặc mở nhầm biểu
           mẫu của màn hình vừa xem trước đó. */
        var f = (W.FORM_CT || {})[key] || W.__docForm;
        if (f) f(r, true);
    }, 160);
};

/**
 * MỞ BIỂU MẪU LẬP CHỨNG TỪ VỚI DỮ LIỆU ĐÃ ĐIỀN SẴN — CHƯA GHI VÀO KHO DỮ LIỆU.
 * Dùng cho các bước kế thừa: chứng từ chỉ được ghi khi người lập bấm Lưu và dữ
 * liệu hợp lệ. Nhờ vậy không bao giờ có chuyện “giao diện báo lỗi nhưng chứng
 * từ đã nằm trong danh sách”.
 */
W.moFormChungTu = function (key, nhap) {
    W.go(ROUTE_OF[key]);
    setTimeout(function () {
        /* CHỈ mở biểu mẫu ĐÚNG LOẠI chứng từ. Tuyệt đối không lùi về
           W.__docForm: biến đó giữ biểu mẫu của màn hình vừa dựng gần nhất, mở
           nhầm ra là ghi dữ liệu sang phân hệ khác. */
        var f = (W.FORM_CT || {})[key];
        if (f) return f(nhap, false);
        UI.toast('warn', 'Chưa mở được biểu mẫu',
            'Hãy vào đúng màn hình ' + T.tenBang(key) + ' rồi lập chứng từ tại đó.');
    }, 200);
};

/* ==========================================================================
   HỒ SƠ LIÊN QUAN
   ========================================================================== */
W.hoSoBox = function (key, id) {
    var hs = T.hoSo(key, id);
    function it(ico, ten, o, k) {
        if (!o) return '<div class="flow-step" style="opacity:.42"><div class="fs-l"><i class="bi ' + ico + '"></i> ' + ten +
            '</div><div class="fs-m">chưa có</div></div>';
        return '<div class="flow-step" onclick="W.moChungTu(\'' + k + '\',\'' + o.id + '\')" title="Bấm để mở">' +
            '<div class="fs-l"><i class="bi ' + ico + '"></i> ' + ten + '</div>' +
            '<div class="fs-v" style="font-size:13px">' + T.esc(o.so) + '</div>' +
            '<div class="fs-m">' + T.date(o.ngay) + ' · ' + T.money(o.tongCong || o.soTien || 0) + ' đ</div></div>';
    }
    var px = hs.phieuXuat[0], pt = hs.phieuThu[0];
    return '<div class="card"><div class="card-h"><i class="bi bi-diagram-3"></i> Hồ sơ liên quan — chuỗi chứng từ' +
        '<span class="spacer"></span><span class="small muted">Bấm vào từng thẻ để mở chứng từ</span></div>' +
        '<div class="card-b"><div class="flow">' +
        it('bi-file-earmark-text', 'Báo giá', hs.baoGia, 'baoGia') +
        it('bi-cart-check', 'Đơn bán', hs.donBan, 'donBan') +
        it('bi-file-earmark-ruled', 'Hợp đồng', hs.hopDong, 'hopDong') +
        it('bi-box-arrow-right', 'Phiếu xuất' + (hs.phieuXuat.length > 1 ? ' (' + hs.phieuXuat.length + ')' : ''), px, 'phieuXuat') +
        it('bi-cash-coin', 'Phiếu thu' + (hs.phieuThu.length > 1 ? ' (' + hs.phieuThu.length + ')' : ''), pt, 'phieuThu') +
        '</div></div></div>';
};
W.xemHoSo = function (key, id) {
    var hs = T.hoSo(key, id);
    var db = hs.donBan;
    var thu = T.sum(hs.phieuThu, function (p) { return p.soTien; });
    UI.modal({
        size: 'lg', title: 'Hồ sơ đơn hàng' + (db ? ' — ' + db.so : ''),
        sub: db ? db.khachHang : '',
        body: W.hoSoBox(key, id) +
            (db ? '<div class="grid4 mt12">' +
                kpi2('Giá trị đơn hàng', T.money(db.tongCong) + ' đ') +
                kpi2('Đã thu', T.money(thu) + ' đ', 'g') +
                kpi2('Còn phải thu', T.money(db.tongCong - thu) + ' đ', db.tongCong - thu > 0 ? 'r' : 'g') +
                kpi2('Số phiếu xuất', hs.phieuXuat.length + ' phiếu') +
                '</div>' : '<div class="note y mt12"><i class="bi bi-info-circle"></i><div>Chứng từ này chưa gắn với đơn bán hàng nên chưa dựng được hồ sơ đầy đủ.</div></div>') +
            (hs.phieuThu.length ? '<div class="card mt12"><div class="card-h"><i class="bi bi-cash-coin"></i> Các phiếu thu của đơn hàng</div>' +
                '<div class="tablewrap"><table class="grid"><thead><tr><th>Số phiếu</th><th>Ngày</th><th>Hình thức</th><th class="num">Số tiền</th><th>Trạng thái</th></tr></thead><tbody>' +
                hs.phieuThu.map(function (p) {
                    return '<tr><td class="mono"><span class="link" onclick="W.moChungTu(\'phieuThu\',\'' + p.id + '\')">' + T.esc(p.so) + '</span></td>' +
                        '<td>' + T.date(p.ngay) + '</td><td>' + T.esc(p.hinhThuc) + '</td>' +
                        '<td class="num b">' + T.money(p.soTien) + '</td><td>' + T.pill(p.trangThai) + '</td></tr>';
                }).join('') + '</tbody></table></div></div>' : ''),
        buttons: [{ text: 'Đóng', cls: 'primary', click: function (h) { h.close(); } }]
    });
};
function kpi2(l, v, c) {
    return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div><div class="vl" style="font-size:17px">' + v + '</div></div>';
}

/* ==========================================================================
   MÀN HÌNH HỒ SƠ ĐƠN HÀNG
   ========================================================================== */
S['ho-so'] = function (host) {
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Hồ sơ đơn hàng</h2>' +
        '<div class="sub">Theo dõi toàn bộ chuỗi chứng từ của từng đơn hàng: Báo giá → Đơn bán → Hợp đồng → Phiếu xuất → Phiếu thu</div></div></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Bán hàng', 'Hồ sơ đơn hàng']);
    var rows = T.theoCty(DB.all('donBan')).map(function (d) {
        var hs = T.hoSo('donBan', d.id);
        d._bg = hs.baoGia ? hs.baoGia.so : ''; d._hd = hs.hopDong ? hs.hopDong.so : '';
        d._px = hs.phieuXuat.length; d._pt = hs.phieuThu.length;
        d._thu = T.sum(hs.phieuThu, function (p) { return p.soTien; });
        d._buoc = (hs.baoGia ? 1 : 0) + 1 + (hs.hopDong ? 1 : 0) + (hs.phieuXuat.length ? 1 : 0) + (hs.phieuThu.length ? 1 : 0);
        return d;
    });
    new UI.Grid({
        mount: '#gh', rows: rows, pageSize: 20, height: 'calc(100vh - 230px)', sortK: 'ngay', sortD: -1,
        search: ['so', 'khachHang', 'duAn'],
        toolbar: '<button class="btn primary" data-mo disabled><i class="bi bi-diagram-3"></i> Xem hồ sơ đầy đủ</button>' +
                 '<span class="tb-sep"></span><span class="small muted">Bấm đúp vào một dòng để mở hồ sơ</span>',
        filters: [{ k: '_buoc', t: 'Mức hoàn thiện', w: 190,
            opts: [{ v: 'du', t: 'Đủ 5 bước' }, { v: 'thieu', t: 'Còn thiếu bước' }],
            test: function (x, v) { return v === 'du' ? x._buoc >= 5 : x._buoc < 5; } }],
        cols: [
            { k: 'so', t: 'Đơn bán', w: 146, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày', w: 100, fmt: 'date' },
            { k: 'khachHang', t: 'Khách hàng', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
            { k: '_bg', t: 'Báo giá', w: 140, cls: 'mono', r: function (v) { return v ? T.esc(v) : '<span class="muted">—</span>'; } },
            { k: '_hd', t: 'Hợp đồng', w: 156, cls: 'mono', r: function (v) { return v ? T.esc(v) : '<span class="muted">—</span>'; } },
            { k: '_px', t: 'P.Xuất', w: 78, cls: 'num ctr', r: function (v) { return v ? '<span class="pill g">' + v + '</span>' : '<span class="pill n">0</span>'; } },
            { k: '_pt', t: 'P.Thu', w: 78, cls: 'num ctr', r: function (v) { return v ? '<span class="pill g">' + v + '</span>' : '<span class="pill n">0</span>'; } },
            { k: 'tongCong', t: 'Giá trị', w: 140, cls: 'num', total: true, fmt: 'money' },
            { k: '_thu', t: 'Đã thu', w: 132, cls: 'num', total: true, fmt: 'money' },
            { k: '_buoc', t: 'Tiến độ hồ sơ', w: 158, r: function (v) {
                return '<div class="bar-track" title="' + v + '/5 bước"><div class="bar-fill' + (v >= 5 ? ' g' : '') + '" style="width:' + (v * 20) + '%"></div></div>' +
                    '<div class="small muted ctr">' + v + '/5 bước</div>'; } }
        ],
        onSelect: UI.chonToolbar(host, ['mo']),
        onOpen: function (r) { W.xemHoSo('donBan', r.id); },
        onAction: function () { }
    });
    var g = W.__grid;
    host.querySelector('[data-mo]').onclick = function () {
        var sel = document.querySelector('#gh tbody tr.sel');
        if (sel) W.xemHoSo('donBan', sel.getAttribute('data-id'));
    };
};

})(window);

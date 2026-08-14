/* ==========================================================================
   TVERP — QUY TRÌNH LIÊN HOÀN
   "Tạo chứng từ tiếp theo" trên mọi chứng từ + Lịch sử giao dịch theo Mã giao dịch.
   Mọi chứng từ trong cùng một thương vụ dùng CHUNG một Mã giao dịch (GD-2026-0001),
   cho phép xem xuôi và xem ngược toàn bộ lịch sử.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q;

/* ==========================================================================
   BẢN ĐỒ BƯỚC TIẾP THEO CỦA TỪNG LOẠI CHỨNG TỪ
   ========================================================================== */
var BUOC = {
    baoGia: [
        { k: 'donBan',      t: 'Tạo Đơn bán hàng',      i: 'bi-cart-check-fill',        mo: 'Chuyển báo giá đã chốt thành đơn bán hàng' },
        { k: 'hopDong',     t: 'Tạo Hợp đồng',          i: 'bi-file-earmark-ruled-fill', mo: 'Ký hợp đồng kinh tế (bước tùy chọn)' },
        { k: 'phieuXuat',   t: 'Tạo Phiếu xuất kho',    i: 'bi-box-arrow-right',        mo: 'Xuất thẳng hàng không qua đơn bán' },
        { k: 'bienBanGiao', t: 'Tạo Biên bản giao hàng', i: 'bi-clipboard-check-fill',  mo: 'Giao hàng trực tiếp cho khách' }
    ],
    donBan: [
        { k: 'hopDong',     t: 'Tạo Hợp đồng',          i: 'bi-file-earmark-ruled-fill', mo: 'Bước tùy chọn — không bắt buộc mọi đơn đều có hợp đồng' },
        { k: 'phieuXuat',   t: 'Tạo Phiếu xuất kho',    i: 'bi-box-arrow-right',        mo: 'Xuất hàng khỏi kho, trừ tồn tự động' },
        { k: 'bienBanGiao', t: 'Tạo Biên bản giao hàng', i: 'bi-clipboard-check-fill',  mo: 'Bàn giao hàng hóa cho khách' },
        { k: 'deNghiTT',    t: 'Tạo Đề nghị thanh toán', i: 'bi-receipt',               mo: 'Đề nghị khách thanh toán theo đợt' },
        { k: 'phieuThu',    t: 'Lập Phiếu thu tiền',    i: 'bi-cash-coin',              mo: 'Ghi nhận tiền khách đã trả' }
    ],
    hopDong: [
        { k: 'phuLuc',      t: 'Tạo Phụ lục hợp đồng',  i: 'bi-file-earmark-plus-fill', mo: 'Điều chỉnh, gia hạn hoặc bổ sung hàng hóa' },
        { k: 'phieuXuat',   t: 'Tạo Phiếu xuất kho',    i: 'bi-box-arrow-right',        mo: 'Xuất hàng theo hợp đồng' },
        { k: 'bienBanGiao', t: 'Tạo Biên bản giao hàng', i: 'bi-clipboard-check-fill',  mo: 'Bàn giao hàng hóa' },
        { k: 'bienBanNghiemThu', t: 'Tạo Biên bản nghiệm thu', i: 'bi-patch-check-fill', mo: 'Nghiệm thu khối lượng, chất lượng' },
        { k: 'deNghiTT',    t: 'Tạo Đề nghị thanh toán', i: 'bi-receipt',               mo: 'Đề nghị thanh toán theo đợt' }
    ],
    phuLuc: [
        { k: 'phieuXuat',   t: 'Tạo Phiếu xuất kho',    i: 'bi-box-arrow-right',        mo: 'Xuất phần hàng bổ sung theo phụ lục' },
        { k: 'bienBanGiao', t: 'Tạo Biên bản giao hàng', i: 'bi-clipboard-check-fill',  mo: 'Bàn giao phần hàng bổ sung' }
    ],
    phieuXuat: [
        { k: 'bienBanGiao', t: 'Tạo Biên bản giao hàng', i: 'bi-clipboard-check-fill',  mo: 'Sinh ngay biên bản giao hàng từ phiếu xuất' },
        { k: 'phieuThu',    t: 'Lập Phiếu thu tiền',    i: 'bi-cash-coin',              mo: 'Thu tiền sau khi giao hàng' }
    ],
    bienBanGiao: [
        { k: 'bienBanNghiemThu', t: 'Tạo Biên bản nghiệm thu', i: 'bi-patch-check-fill', mo: 'Bước tùy chọn — nghiệm thu sau bàn giao' },
        { k: 'deNghiTT',    t: 'Tạo Đề nghị thanh toán', i: 'bi-receipt',               mo: 'Bước tùy chọn — đề nghị thanh toán' },
        { k: 'phieuThu',    t: 'Lập Phiếu thu tiền',    i: 'bi-cash-coin',              mo: 'Thu tiền của đơn hàng' }
    ],
    bienBanNghiemThu: [
        { k: 'deNghiTT',    t: 'Tạo Đề nghị thanh toán', i: 'bi-receipt',               mo: 'Đề nghị thanh toán sau nghiệm thu' },
        { k: 'phieuThu',    t: 'Lập Phiếu thu tiền',    i: 'bi-cash-coin',              mo: 'Thu tiền của đơn hàng' }
    ],
    deNghiTT: [
        { k: 'phieuThu',    t: 'Lập Phiếu thu tiền',    i: 'bi-cash-coin',              mo: 'Ghi nhận tiền khách đã thanh toán' }
    ],
    phieuThu: []
};

/* ==========================================================================
   TẠO CHỨNG TỪ TIẾP THEO — kế thừa TOÀN BỘ dữ liệu chứng từ trước
   ========================================================================== */
function nvId() { return (Q.nhanVienCuaToi() || {}).id || ''; }
function nvTen() { return (Q.nhanVienCuaToi() || {}).hoTen || ''; }

/** Gom toàn bộ dữ liệu kế thừa được từ một chứng từ bất kỳ. */
W.keThua = function (loai, r) {
    var kh = DB.get('khachHang', r.khachHangId) || {};
    var maGD = T.layMaGD(loai, r);
    var chuoi = T.chuoiGD(maGD);
    function tim(k) {
        for (var i = 0; i < chuoi.length; i++) if (chuoi[i].buoc.k === k) return chuoi[i].ct;
        return null;
    }
    var bg = tim('baoGia'), db = tim('donBan'), hd = tim('hopDong'),
        px = tim('phieuXuat'), bb = tim('bienBanGiao');
    if (loai === 'phieuXuat') px = r;
    if (loai === 'bienBanGiao') bb = r;
    return {
        maGD: maGD,
        donVi: r.donVi || DB.data._meta.ctyId,
        khachHangId: r.khachHangId, khachHang: r.khachHang,
        diaChiKH: kh.diaChi || '',
        duAn: r.duAn || '',
        diaDiemGiao: r.diaDiemGiao || (db && db.diaDiemGiao) || kh.diaChi || '',
        nguoiNhan: r.nguoiNhan || kh.nguoiLienHe || 'Đại diện bên mua',
        nguoiGiao: r.nguoiGiao || nvTen(),
        phuongTien: r.phuongTien || '',
        mucGia: r.mucGia || kh.mucGia || 'BL',
        /* PHIÊN BẢN BẢNG GIÁ ĐÃ CHỐT đi theo cả chuỗi chứng từ: Engine luôn tính
           giá nội bộ theo đúng phiên bản đã dùng từ đầu chuỗi. */
        bangGiaId: r.bangGiaId || (db && db.bangGiaId) || (bg && bg.bangGiaId) || '',
        cotGia: r.cotGia || (db && db.cotGia) || (bg && bg.cotGia) || '',
        dieuKhoanTT: r.dieuKhoanTT || (db && db.dieuKhoanTT) || (hd && hd.dieuKhoanTT) || '',
        dieuKhoan: r.dieuKhoan || (bg && bg.dieuKhoan) || '',
        baoGiaId: bg ? bg.id : '', baoGiaSo: bg ? bg.so : '',
        donBanId: db ? db.id : '', donBanSo: db ? db.so : '',
        hopDongId: hd ? hd.id : '', hopDongSo: hd ? hd.so : '',
        phieuXuatId: px ? px.id : '', phieuXuatSo: px ? px.so : '',
        bienBanGiaoId: bb ? bb.id : '', bienBanGiaoSo: bb ? bb.so : '',
        lines: T.clone(r.lines || []),
        vatPct: r.vatPct === undefined ? 10 : r.vatPct,
        thanhTien: r.thanhTien || 0, vat: r.vat || 0, tongCong: r.tongCong || 0,
        nguoiLapId: r.nguoiLapId || nvId(), nguoiLap: r.nguoiLap || nvTen(),
        ghiChu: r.ghiChu || ''
    };
};

var TEN_CT = {
    baoGia: 'Báo giá', donBan: 'Đơn bán hàng', hopDong: 'Hợp đồng', phuLuc: 'Phụ lục hợp đồng',
    phieuXuat: 'Phiếu xuất kho', bienBanGiao: 'Biên bản giao hàng',
    bienBanNghiemThu: 'Biên bản nghiệm thu', deNghiTT: 'Đề nghị thanh toán', phieuThu: 'Phiếu thu'
};

/** Sinh chứng từ tiếp theo loại <dich> từ chứng từ <r> (loại <loai>). */
W.taoTiep = function (loai, r, dich, done) {
    if (!Q.co(dich, 'them')) return UI.thieuQuyen(dich, 'them');
    var n = W.keThua(loai, r);
    if (!n.maGD) {
        n.maGD = DB.maGDMoi();
        r.maGD = n.maGD; DB.save();
    }
    if (dich === 'phieuThu') {
        var db = n.donBanId ? DB.get('donBan', n.donBanId) : null;
        if (!db) return UI.toast('warn', 'Chưa có đơn bán', 'Hãy tạo Đơn bán hàng trước khi thu tiền.');
        return W.taoPhieuThu(db, done);
    }

    /* HỢP ĐỒNG: phần mềm KHÔNG tự chọn một loại mặc định. Người dùng phải chọn
       loại hợp đồng trong danh mục; mỗi loại có biểu mẫu, điều khoản và quy
       trình riêng. */
    if (dich === 'hopDong') return W.chonLoaiHopDong(function (L) { tao({ loaiHD: L }); });

    /* BIÊN BẢN NGHIỆM THU: mẫu biên bản phải khớp với loại hợp đồng. Loại nào
       có nhiều hơn một mẫu thì hỏi người dùng chọn đúng mẫu cần lập. */
    if (dich === 'bienBanNghiemThu') {
        var hdNT = (loai === 'hopDong') ? r
            : (n.hopDongId ? DB.get('hopDong', n.hopDongId) : null);
        var dsNT = T.mauNTCua(hdNT);
        if (dsNT.length > 1) return W.chonMauNghiemThu(hdNT, function (k) { tao({ mauNT: k }); });
        return tao({ mauNT: dsNT[0] || 'KL' });
    }

    return tao({});

    function tao(chon) {
    UI.confirm({
        title: 'Tạo ' + TEN_CT[dich], icon: 'bi-arrow-right-circle-fill',
        message: 'Tạo <b>' + TEN_CT[dich] + '</b> kế thừa từ ' + TEN_CT[loai].toLowerCase() + ' <b>' + T.esc(r.so) + '</b>?',
        note: 'Tự động lấy sang: đơn vị phát hành, khách hàng, công trình/dự án, địa chỉ giao hàng, ' +
              '<b>' + n.lines.length + ' dòng hàng hóa</b> (số lượng · đơn giá), thuế GTGT <b>' + n.vatPct + '%</b>, ' +
              'điều khoản, người lập và ghi chú.<br>Mã giao dịch: <b>' + T.esc(n.maGD) + '</b>. ' +
              'Anh chỉ cần kiểm tra rồi bấm Lưu.',
        okText: 'Tạo ' + TEN_CT[dich].toLowerCase(), okIcon: 'bi-check-lg',
        ok: function () {
            var o = dungChungTu(dich, loai, r, n, chon || {});
            /* ĐỀ NGHỊ THANH TOÁN: mở biểu mẫu đã điền sẵn, CHƯA ghi vào kho dữ
               liệu. Số tiền đề nghị do người lập tự khai nên chứng từ chỉ được
               ghi khi bấm Lưu và dữ liệu hợp lệ — không bao giờ có chuyện giao
               diện báo lỗi mà chứng từ đã nằm trong danh sách. */
            if (dich === 'deNghiTT') {
                if (done) done();
                W.route();
                UI.toast('info', 'Lập đề nghị thanh toán',
                    'Đã lấy sẵn thông tin từ ' + TEN_CT[loai].toLowerCase() + ' ' + T.esc(r.so) +
                    '. Kiểm tra rồi bấm Lưu — chứng từ chỉ được ghi khi anh bấm Lưu.');
                return W.moFormChungTu('deNghiTT', o);
            }
            /* GIÁ VỐN DO ENGINE QUYẾT ĐỊNH, KHÔNG DO MÀN HÌNH.
               Dòng hàng kế thừa mang theo giá vốn đã đóng băng cùng hai mốc đầu
               vào (đơn vị phát hành · phiên bản bảng giá). T.dongBangGiaVon giữ
               nguyên nếu hai mốc đó không đổi, và tự tính lại nếu chứng từ mới do
               đơn vị khác phát hành hoặc dùng phiên bản bảng giá khác. Nhờ vậy
               mọi đường tạo chứng từ tiếp theo đều cho cùng một kết quả. */
            T.dongBangGiaGocNB(o);
            T.dongBangGiaVon(o);
            DB.insert(dich, o);
            if (dich === 'phieuXuat') truTon(o);
            if (done) done();
            W.route();
            UI.toast('ok', 'Đã tạo ' + TEN_CT[dich].toLowerCase() + ' ' + o.so,
                n.lines.length + ' dòng hàng đã kế thừa · ' + T.money(o.tongCong || 0) + ' đ');
            setTimeout(function () { W.moChungTu(dich, o.id); }, 400);
        }
    });
    }
};

/* ==========================================================================
   CHỌN LOẠI HỢP ĐỒNG
   Danh sách lấy thẳng từ DANH MỤC LOẠI HỢP ĐỒNG nên thêm loại mới trong danh
   mục là hộp thoại này có ngay, không phải sửa mã nguồn.
   ========================================================================== */
W.chonLoaiHopDong = function (xong) {
    var ds = T.loaiHDDungDuoc();
    if (!ds.length) return UI.khongThe('Tạo hợp đồng',
        'Danh mục Loại hợp đồng đang trống.',
        'Vào Danh mục → Loại hợp đồng để khai ít nhất một loại hợp đồng.');
    var chon = ds[0].id;
    UI.modal({
        size: 'md', title: 'Chọn loại hợp đồng', dismiss: false,
        sub: 'Mỗi loại hợp đồng có biểu mẫu, điều khoản và quy trình riêng',
        body: '<div class="note b mb12"><i class="bi bi-info-circle-fill"></i><div>' +
            'Hệ thống <b>không tự chọn thay</b>. Chọn đúng loại hợp đồng cần lập — biểu mẫu in, ' +
            'bộ điều khoản và mẫu biên bản nghiệm thu sẽ theo đúng loại đã chọn.</div></div>' +
            '<div class="row" style="flex-direction:column;align-items:stretch;gap:9px">' +
            ds.map(function (L) {
                return '<button class="btn" data-lhd="' + T.esc(L.id) + '"' +
                    ' style="height:auto;padding:11px 13px;justify-content:flex-start;text-align:left">' +
                    '<i class="bi bi-file-earmark-ruled-fill" style="font-size:21px;color:var(--brand)"></i>' +
                    '<span><b style="display:block;font-size:14px">' + T.esc(L.ten) + '</b>' +
                    '<small class="muted">' + T.esc(L.vv || L.tieuDe || '') +
                    ' · ' + ((L.dieu || []).length) + ' điều · nghiệm thu: ' +
                    T.esc((L.mauNghiemThu || []).map(T.tenMauNT).join(' · ') || 'không') +
                    '</small></span></button>';
            }).join('') + '</div>',
        buttons: [{ text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } }],
        onOpen: function (h) {
            h.el.querySelectorAll('[data-lhd]').forEach(function (b) {
                b.onclick = function () {
                    chon = b.getAttribute('data-lhd');
                    h.close();
                    setTimeout(function () { xong(DB.get('loaiHopDong', chon)); }, 60);
                };
            });
        }
    });
};

/* ---------------------------------------- CHỌN MẪU BIÊN BẢN NGHIỆM THU */
W.chonMauNghiemThu = function (hd, xong) {
    var ds = T.mauNTCua(hd);
    var L = T.loaiHDCua(hd);
    UI.modal({
        size: 'md', title: 'Chọn mẫu biên bản nghiệm thu', dismiss: false,
        sub: L ? 'Theo ' + L.ten + (hd && hd.so ? ' — ' + hd.so : '') : '',
        body: '<div class="note b mb12"><i class="bi bi-info-circle-fill"></i><div>' +
            'Biên bản nghiệm thu phải <b>đúng mẫu của loại hợp đồng</b>. Chọn mẫu cần lập.</div></div>' +
            '<div class="row" style="flex-direction:column;align-items:stretch;gap:9px">' +
            ds.map(function (k) {
                return '<button class="btn" data-mnt="' + k + '"' +
                    ' style="height:auto;padding:11px 13px;justify-content:flex-start;text-align:left">' +
                    '<i class="bi bi-patch-check-fill" style="font-size:21px;color:var(--brand)"></i>' +
                    '<span><b style="display:block;font-size:14px">' + T.esc(T.tenMauNT(k)) + '</b>' +
                    '<small class="muted">' + (k === 'GT'
                        ? 'Có đơn giá, thành tiền và dòng cộng đã bao gồm thuế'
                        : 'Chỉ khối lượng theo báo giá và khối lượng nghiệm thu') +
                    '</small></span></button>';
            }).join('') + '</div>',
        buttons: [{ text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } }],
        onOpen: function (h) {
            h.el.querySelectorAll('[data-mnt]').forEach(function (b) {
                b.onclick = function () {
                    var k = b.getAttribute('data-mnt');
                    h.close(); setTimeout(function () { xong(k); }, 60);
                };
            });
        }
    });
};

/* TRỪ TỒN KHO CHỈ CÓ MỘT CỬA: T.ghiXuatKho. Nó trừ tồn, dựng lại thẻ kho rồi
   ghi dữ liệu — thiếu bước dựng thẻ kho thì sổ kho lệch với tồn kho. */
function truTon(px) { T.ghiXuatKho(px); }

function chung(n, loai, r) {
    return {
        maGD: n.maGD, ngay: T.today(), donVi: n.donVi,
        khachHangId: n.khachHangId, khachHang: n.khachHang, duAn: n.duAn,
        baoGiaId: n.baoGiaId, baoGiaSo: n.baoGiaSo,
        donBanId: n.donBanId, donBanSo: n.donBanSo,
        hopDongId: n.hopDongId, hopDongSo: n.hopDongSo,
        /* Phiên bản bảng giá đã chốt của chuỗi — Engine tính giá nội bộ theo
           đúng phiên bản này, không tự chọn lại phiên bản khác. */
        bangGiaId: n.bangGiaId || '', cotGia: n.cotGia || '',
        lines: n.lines, vatPct: n.vatPct, thanhTien: n.thanhTien, vat: n.vat, tongCong: n.tongCong,
        nguoiLapId: n.nguoiLapId, nguoiLap: n.nguoiLap,
        ghiChu: 'Lập từ ' + TEN_CT[loai].toLowerCase() + ' ' + r.so
    };
}

function dungChungTu(dich, loai, r, n, chon) {
    chon = chon || {};
    var o = chung(n, loai, r);
    var cty = DB.get('donVi', n.donVi) || DB.cty();
    if (dich === 'donBan') {
        o.so = DB.soMoi('DB'); o.ngayGiao = T.addDays(T.today(), 7); o.mucGia = n.mucGia;
        o.diaDiemGiao = n.diaDiemGiao;
        o.dieuKhoanTT = n.dieuKhoanTT || 'Thanh toán 100% sau khi giao hàng';
        o.baoGiaId = loai === 'baoGia' ? r.id : n.baoGiaId;
        o.baoGiaSo = loai === 'baoGia' ? r.so : n.baoGiaSo;
        o.trangThai = 'Đã xác nhận';
    } else if (dich === 'hopDong') {
        var L = chon.loaiHD || T.loaiHDDungDuoc()[0] || {};
        o.so = DB.soHopDong(L); o.loaiId = L.id || ''; o.loai = L.ten || 'Hợp đồng';
        o.donBanId = n.donBanId; o.donBanSo = n.donBanSo;
        o.baoGiaId = loai === 'baoGia' ? r.id : n.baoGiaId;
        o.baoGiaSo = loai === 'baoGia' ? r.so : n.baoGiaSo;
        o.ngayHieuLuc = T.today(); o.ngayKetThuc = T.addDays(T.today(), 90);
        o.dieuKhoanTT = n.dieuKhoanTT || 'Tạm ứng 30%, thanh toán 60% sau giao hàng, giữ lại 10% bảo hành 12 tháng';
        o.baoHanh = 12; o.nguoiKy = cty.daiDien; o.giaTri = n.tongCong; o.trangThai = 'Đã ký';
    } else if (dich === 'phuLuc') {
        o.so = DB.soMoi('PL');
        o.hopDongId = loai === 'hopDong' ? r.id : n.hopDongId;
        o.hopDongSo = loai === 'hopDong' ? r.so : n.hopDongSo;
        o.loai = 'Bổ sung hàng hóa';
        o.noiDung = 'Bổ sung hàng hóa cho hợp đồng ' + (o.hopDongSo || '');
        o.trangThai = 'Nháp';
    } else if (dich === 'phieuXuat') {
        o.so = DB.soMoi('PX'); o.khoId = (T.khoChinh() || {}).id;
        o.nguoiNhan = n.nguoiNhan; o.nguoiGiao = n.nguoiGiao; o.phuongTien = n.phuongTien;
        o.lyDo = 'Xuất bán theo ' + TEN_CT[loai].toLowerCase() + ' ' + r.so;
        o.trangThai = 'Đã xuất kho';
    } else if (dich === 'bienBanGiao') {
        o.so = DB.soMoi('BB');
        o.phieuXuatId = loai === 'phieuXuat' ? r.id : n.phieuXuatId;
        o.phieuXuatSo = loai === 'phieuXuat' ? r.so : n.phieuXuatSo;
        o.diaDiemGiao = n.diaDiemGiao; o.nguoiNhan = n.nguoiNhan; o.nguoiGiao = n.nguoiGiao;
        o.phuongTien = n.phuongTien; o.trangThai = 'Đã giao hàng';
    } else if (dich === 'bienBanNghiemThu') {
        o.so = DB.soMoi('NT');
        o.mauNT = chon.mauNT || 'KL';
        o.hopDongId = loai === 'hopDong' ? r.id : n.hopDongId;
        o.hopDongSo = loai === 'hopDong' ? r.so : n.hopDongSo;
        o.bienBanGiaoId = loai === 'bienBanGiao' ? r.id : n.bienBanGiaoId;
        o.bienBanGiaoSo = loai === 'bienBanGiao' ? r.so : n.bienBanGiaoSo;
        o.thanhPhanA = 'Đại diện chủ đầu tư'; o.thanhPhanB = n.nguoiLap;
        o.ketLuan = 'Hàng hóa đúng chủng loại, đủ số lượng, đạt yêu cầu kỹ thuật. Hai bên đồng ý nghiệm thu.';
        o.trangThai = 'Đã nghiệm thu';
    } else if (dich === 'deNghiTT') {
        /* Số chứng từ để TRỐNG — đề nghị thanh toán chỉ được cấp số và ghi vào
           kho dữ liệu khi người lập bấm Lưu và dữ liệu đã hợp lệ. */
        o.so = '';
        var daThu = n.donBanId ? T.sum(DB.all('phieuThu').filter(function (p) {
            return p.donBanId === n.donBanId && p.trangThai === 'Đã ghi sổ'; }), function (p) { return p.soTien; }) : 0;
        /* Đề nghị thanh toán là chứng từ đề nghị SỐ TIỀN: không kê dòng hàng,
           không tự lấy toàn bộ giá trị hợp đồng, không tự lấy toàn bộ công nợ.
           Số tiền để 0 cho người lập tự khai. */
        delete o.lines; delete o.vatPct; delete o.thanhTien; delete o.vat; delete o.tongCong;
        /* Không kê dòng hàng thì cũng không chốt phiên bản bảng giá — giữ lại chỉ
           tạo trường thừa và bị bước nâng cấp dữ liệu dọn đi ở lần tải sau. */
        delete o.bangGiaId; delete o.cotGia; delete o.mucGia;
        o.loaiDN = 'Thanh toán';
        o.dot = daThu > 0 ? 'Đợt 2' : 'Đợt 1';
        o.hanTT = T.addDays(T.today(), 15);
        o.soTien = 0;
        o.noiDungTT = 'Thanh toán giá trị hàng hóa đã bàn giao theo ' + (n.hopDongSo || n.donBanSo || r.so);
        o.lyDo = ''; o.hoSoKem = ''; o.hinhThuc = 'Chuyển khoản';
        o.nguoiDeNghi = n.nguoiLap;
        o.trangThai = 'Chờ duyệt';
        /* CĂN CỨ NGHIỆM THU — BBNT hoặc BBNTGT.
           Lập thẳng từ một biên bản nghiệm thu thì lấy TOÀN BỘ dữ liệu của
           chính biên bản đó; lập từ chứng từ khác thì tìm biên bản phù hợp. */
        o.loaiCanCu = ''; o.bienBanNTId = ''; o.bienBanNTSo = '';
        if (loai === 'bienBanNghiemThu') W.apBienBanVaoDeNghi(o, r);
        else {
            var bbC = W.bienBanChoDeNghi(n);
            if (bbC) { o.loaiCanCu = W.loaiCanCuCua(bbC); o.bienBanNTId = bbC.id; o.bienBanNTSo = bbC.so || ''; }
        }
    }
    return o;
}

/* ==========================================================================
   POPUP "TẠO CHỨNG TỪ TIẾP THEO"
   ========================================================================== */
W.buocTiep = function (r, done, loai) {
    loai = loai || doanLoai(r);
    var ds = BUOC[loai] || [];
    var maGD = T.layMaGD(loai, r);
    var chuoi = T.chuoiGD(maGD);
    function daCo(k) { return chuoi.filter(function (x) { return x.buoc.k === k; }).length; }

    UI.modal({
        size: 'lg', title: 'Tạo chứng từ tiếp theo — ' + (r.so || ''),
        sub: (r.khachHang || '') + (maGD ? '   ·   Mã giao dịch ' + maGD : ''),
        body:
            lichSuHTML(maGD, r) +
            '<div class="card mt12"><div class="card-h"><i class="bi bi-arrow-right-circle"></i> Bước tiếp theo có thể tạo' +
            '<span class="spacer"></span><span class="small muted">Toàn bộ dữ liệu được kế thừa tự động</span></div>' +
            '<div class="card-b"><div class="grid2" id="dsBuoc">' +
            (ds.length ? ds.map(function (b) {
                var n = daCo(b.k), cam = !Q.co(b.k, 'them');
                return '<button class="btn buoc-btn" data-di="' + b.k + '"' + (cam ? ' disabled' : '') + '>' +
                    '<i class="bi ' + b.i + '"></i>' +
                    '<span><b>' + b.t + '</b><small>' + (cam ? 'Không có quyền tạo' : T.esc(b.mo)) +
                    (n ? ' · <span class="pill g">đã có ' + n + '</span>' : '') + '</small></span></button>';
            }).join('') : '<div class="muted">Đây là bước cuối của quy trình.</div>') +
            '</div></div></div>',
        buttons: [{ text: 'Đóng', cls: 'primary', click: function (h) { h.close(); } }],
        onOpen: function (h) {
            h.el.querySelectorAll('[data-di]').forEach(function (b) {
                b.onclick = function () {
                    var dich = b.getAttribute('data-di');
                    h.close();
                    W.taoTiep(loai, r, dich, done);
                };
            });
            h.el.querySelectorAll('[data-mo]').forEach(function (b) {
                b.onclick = function () {
                    h.close();
                    W.moChungTu(b.getAttribute('data-mo'), b.getAttribute('data-id'));
                };
            });
        }
    });
};

function doanLoai(r) {
    var ks = T.LOAI_CT;
    for (var i = 0; i < ks.length; i++) {
        if (DB.get(ks[i], r.id)) return ks[i];
    }
    return 'donBan';
}

/* ==========================================================================
   LỊCH SỬ GIAO DỊCH
   ========================================================================== */
function lichSuHTML(maGD, hienTai) {
    var chuoi = T.chuoiGD(maGD);
    if (!maGD) {
        return '<div class="note y"><i class="bi bi-info-circle"></i><div>Chứng từ chưa gắn mã giao dịch — ' +
            'mã sẽ được sinh khi tạo chứng từ tiếp theo.</div></div>';
    }
    var buocCo = {};
    chuoi.forEach(function (x) { (buocCo[x.buoc.k] = buocCo[x.buoc.k] || []).push(x.ct); });
    var h = '<div class="card"><div class="card-h"><i class="bi bi-clock-history"></i> Lịch sử giao dịch' +
        '<span class="spacer"></span><span class="pill b mono">' + T.esc(maGD) + '</span>' +
        '<span class="small muted" style="margin-left:8px">' + chuoi.length + ' chứng từ</span></div>' +
        '<div class="card-b"><div class="flow">';
    T.CHUOI.forEach(function (b) {
        var ds = buocCo[b.k] || [];
        if (!ds.length) {
            h += '<div class="flow-step trong"><div class="fs-l"><i class="bi ' + b.i + '"></i> ' + b.t + '</div>' +
                 '<div class="fs-m">' + (b.bat ? 'chưa có' : 'chưa có · tùy chọn') + '</div></div>';
            return;
        }
        ds.forEach(function (ct) {
            var la = hienTai && ct.id === hienTai.id;
            h += '<div class="flow-step co' + (la ? ' hientai' : '') + '" data-mo="' + b.k + '" data-id="' + ct.id + '" ' +
                'onclick="W.moChungTu(\'' + b.k + '\',\'' + ct.id + '\')" title="Bấm để mở chứng từ">' +
                '<div class="fs-l"><i class="bi ' + b.i + '"></i> ' + b.t + (la ? ' <span class="pill b">đang xem</span>' : '') + '</div>' +
                '<div class="fs-v" style="font-size:13px">' + T.esc(ct.so) + '</div>' +
                '<div class="fs-m">' + T.date(ct.ngay) + ' · ' + T.money(ct.tongCong || ct.soTien || 0) + ' đ</div>' +
                '<div class="fs-m">' + T.pill(ct.trangThai) + '</div></div>';
        });
    });
    h += '</div></div></div>';
    return h;
}

/** Khối "Lịch sử giao dịch" nhúng trong cửa sổ chứng từ. */
W.hoSoBox = function (loai, id) {
    var r = DB.get(loai, id);
    return lichSuHTML(T.layMaGD(loai, r), r);
};

/** Cửa sổ xem toàn bộ hồ sơ của một giao dịch. */
W.xemHoSo = function (loai, id) {
    var r = DB.get(loai, id);
    if (!r) return;
    var maGD = T.layMaGD(loai, r);
    var chuoi = T.chuoiGD(maGD);
    var db = null;
    chuoi.forEach(function (x) { if (x.buoc.k === 'donBan') db = x.ct; });
    var thu = T.sum(chuoi.filter(function (x) { return x.buoc.k === 'phieuThu' && x.ct.trangThai === 'Đã ghi sổ'; }),
        function (x) { return x.ct.soTien; });
    var giaTri = db ? db.tongCong : (r.tongCong || 0);

    UI.modal({
        size: 'xl', title: 'Hồ sơ giao dịch ' + (maGD || ''),
        sub: (r.khachHang || '') + (r.duAn ? ' — ' + r.duAn : ''),
        body: lichSuHTML(maGD, r) +
            '<div class="grid4 mt12">' +
            kp('Số chứng từ trong giao dịch', T.num(chuoi.length, 0)) +
            kp('Giá trị đơn hàng', T.money(giaTri) + ' đ') +
            kp('Đã thu', T.money(thu) + ' đ', 'g') +
            kp('Còn phải thu', T.money(giaTri - thu) + ' đ', giaTri - thu > 0 ? 'r' : 'g') +
            '</div>' +
            '<div class="card mt12"><div class="card-h"><i class="bi bi-list-ul"></i> Chi tiết các chứng từ</div>' +
            '<div class="tablewrap" style="max-height:340px"><table class="grid"><thead><tr>' +
            '<th style="width:190px">Loại chứng từ</th><th style="width:170px">Số</th><th style="width:104px">Ngày</th>' +
            '<th>Người lập</th><th class="num" style="width:150px">Giá trị</th><th style="width:150px">Trạng thái</th>' +
            '<th style="width:56px"></th></tr></thead><tbody>' +
            (chuoi.length ? chuoi.map(function (x) {
                return '<tr class="clickable" onclick="W.moChungTu(\'' + x.buoc.k + '\',\'' + x.ct.id + '\')">' +
                    '<td><i class="bi ' + x.buoc.i + '"></i> ' + x.buoc.t + '</td>' +
                    '<td class="mono"><b>' + T.esc(x.ct.so) + '</b></td>' +
                    '<td>' + T.date(x.ct.ngay) + '</td>' +
                    '<td>' + T.esc(x.ct.nguoiLap || '') + '</td>' +
                    '<td class="num">' + T.money(x.ct.tongCong || x.ct.soTien || 0) + '</td>' +
                    '<td>' + T.pill(x.ct.trangThai) + '</td>' +
                    '<td class="ctr"><i class="bi bi-box-arrow-up-right" style="color:var(--brand)"></i></td></tr>';
            }).join('') : '<tr><td colspan="7"><div class="empty"><i class="bi bi-inbox"></i><b>Chưa có chứng từ</b></div></td></tr>') +
            '</tbody></table></div></div>',
        buttons: [
            { text: 'Đóng', click: function (h) { h.close(); } },
            { text: 'Tạo chứng từ tiếp theo', cls: 'primary', icon: 'bi-arrow-right-circle',
              click: function (h) { h.close(); W.buocTiep(r, function () { W.route(); }, loai); } }
        ]
    });
};
function kp(l, v, c) {
    return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div><div class="vl" style="font-size:17px">' + v + '</div></div>';
}

/* ==========================================================================
   MÀN HÌNH HỒ SƠ ĐƠN HÀNG — theo Mã giao dịch
   ========================================================================== */
W.SCREEN['ho-so'] = function (host) {
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Hồ sơ đơn hàng</h2>' +
        '<div class="sub">Mỗi thương vụ là một <b>Mã giao dịch</b> nối toàn bộ chuỗi chứng từ: ' +
        'Báo giá → Đơn bán → Hợp đồng → Phụ lục → Phiếu xuất → Biên bản giao hàng → Nghiệm thu → Đề nghị thanh toán → Phiếu thu</div></div></div>' +
        '<div id="gh"></div></div>';
    W.crumb(['Bán hàng', 'Hồ sơ đơn hàng']);

    // gom theo mã giao dịch
    var m = {};
    T.CHUOI.forEach(function (b) {
        T.theoCty(DB.all(b.k)).forEach(function (x) {
            if (!x.maGD) return;
            var g = m[x.maGD] = m[x.maGD] || { id: x.maGD, maGD: x.maGD, khachHang: x.khachHang, duAn: x.duAn,
                ngay: x.ngay, soCT: 0, buoc: {}, giaTri: 0, daThu: 0, nguoiLap: x.nguoiLap, donVi: x.donVi };
            g.soCT++;
            g.buoc[b.k] = (g.buoc[b.k] || 0) + 1;
            if (x.ngay < g.ngay) g.ngay = x.ngay;
            if (b.k === 'donBan') { g.giaTri = x.tongCong; g.khachHang = x.khachHang; g.duAn = x.duAn; g.nguoiLap = x.nguoiLap; }
            if (b.k === 'baoGia' && !g.giaTri) { g.giaTri = x.tongCong; }
            if (b.k === 'phieuThu' && x.trangThai === 'Đã ghi sổ') g.daThu += x.soTien;
        });
    });
    var rows = Object.keys(m).map(function (k) {
        var g = m[k];
        g.conNo = g.giaTri - g.daThu;
        g.tienDo = Object.keys(g.buoc).length;
        return g;
    });

    function ico(g, k, b) {
        return g.buoc[k] ? '<i class="bi ' + b.i + '" title="' + b.t + ': ' + g.buoc[k] + ' chứng từ" style="color:var(--ok)"></i>'
                         : '<i class="bi ' + b.i + '" title="' + b.t + ': chưa có" style="color:#d6dde6"></i>';
    }

    new UI.Grid({
        mount: '#gh', rows: rows, pageSize: 20, height: 'calc(100vh - 270px)', sortK: 'ngay', sortD: -1,
        search: ['maGD', 'khachHang', 'duAn', 'nguoiLap'], chon: true,
        toolbar: '<button class="btn primary" data-mo disabled><i class="bi bi-diagram-3"></i> Xem hồ sơ đầy đủ</button>' +
                 '<span class="tb-sep"></span><span class="small muted">Bấm đúp một dòng để mở lịch sử giao dịch</span>',
        filters: [{ k: 'tienDo', t: 'Mức hoàn thiện', w: 200,
            opts: [{ v: 'du', t: 'Từ 5 bước trở lên' }, { v: 'thieu', t: 'Dưới 5 bước' }],
            test: function (x, v) { return v === 'du' ? x.tienDo >= 5 : x.tienDo < 5; } }],
        cols: [
            { k: 'maGD', t: 'Mã giao dịch', w: 148, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Bắt đầu', w: 100, fmt: 'date' },
            { k: 'khachHang', t: 'Khách hàng', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    (r.duAn ? '<div class="small muted ellip">' + T.esc(r.duAn) + '</div>' : ''); } },
            { k: '_chuoi', t: 'Chuỗi chứng từ', w: 230, sort: false, r: function (v, r) {
                return '<div class="chuoi-ico">' + T.CHUOI.map(function (b) { return ico(r, b.k, b); }).join('') + '</div>'; } },
            { k: 'soCT', t: 'Số CT', w: 76, cls: 'num', fmt: 'num' },
            { k: 'nguoiLap', t: 'Người lập', w: 140 },
            { k: 'giaTri', t: 'Giá trị', w: 142, cls: 'num', total: true, fmt: 'money' },
            { k: 'daThu', t: 'Đã thu', w: 138, cls: 'num', total: true, fmt: 'money' },
            { k: 'conNo', t: 'Còn nợ', w: 138, cls: 'num', total: true, r: function (v) {
                return v > 0 ? '<b class="neg">' + T.money(v) + '</b>' : '<span class="pill g">đủ</span>'; } },
            { k: 'tienDo', t: 'Tiến độ', w: 130, r: function (v) {
                return '<div class="bar-track" title="' + v + '/9 bước"><div class="bar-fill' + (v >= 5 ? ' g' : '') +
                    '" style="width:' + Math.round(v / 9 * 100) + '%"></div></div>' +
                    '<div class="small muted ctr">' + v + '/9 bước</div>'; } }
        ],
        onSelect: UI.chonToolbar(host, ['mo']),
        onOpen: function (r) { moTheoMaGD(r.maGD); }
    });
    host.querySelector('[data-mo]').onclick = function () {
        var sel = document.querySelector('#gh tbody tr.sel');
        if (sel) moTheoMaGD(sel.getAttribute('data-id'));
    };
    function moTheoMaGD(maGD) {
        var c = T.chuoiGD(maGD);
        if (!c.length) return;
        W.xemHoSo(c[0].buoc.k, c[0].ct.id);
    }
};

})(window);

/* ==========================================================================
   TVERP — DANH MỤC KHÁCH HÀNG  (CUSTOMER MASTER DATA)
   --------------------------------------------------------------------------
   Danh mục Khách hàng là DỮ LIỆU NỀN của toàn bộ phần mềm. Mọi phân hệ chỉ
   liên kết bằng Customer ID nội bộ; không phân hệ nào tự khai một bộ dữ liệu
   khách hàng riêng.

   Tệp này gồm bốn phần:
     1. Dịch vụ TRA CỨU MÃ SỐ THUẾ trực tuyến (có xử lý mất mạng và API lỗi).
     2. Màn hình Danh mục Khách hàng theo hai bộ trường: Doanh nghiệp · Cá nhân.
     3. Biểu mẫu khai khách hàng, kiểm tra trùng và snapshot pháp lý.
     4. NHẬP HÀNG LOẠT MÃ SỐ THUẾ từ Excel kèm bảng đối chiếu kết quả.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {};

/* ==========================================================================
   1. TRA CỨU MÃ SỐ THUẾ TRỰC TUYẾN
   --------------------------------------------------------------------------
   Chỉ lấy đúng các thông tin phục vụ bán hàng và ký hợp đồng:
       tên doanh nghiệp · địa chỉ · người đại diện · điện thoại · email.
   KHÔNG lấy ngành nghề, ngày thành lập, tình trạng hoạt động và mọi thông tin
   không dùng cho nghiệp vụ.
   Danh sách nguồn tra cứu khai ở đây, doanh nghiệp tự thêm nguồn khác được.
   ========================================================================== */
W.NGUON_MST = [
    { ma: 'vietqr', ten: 'VietQR — Cổng thông tin doanh nghiệp',
      url: function (mst) { return 'https://api.vietqr.io/v2/business/' + mst; },
      doc: function (j) {
          var d = (j && (j.data || j)) || {};
          if (!d.name && !d.shortName) return null;
          return { ten: d.name || d.shortName || '', diaChi: d.address || '',
                   daiDien: d.representative || d.owner || '',
                   dienThoai: d.phone || '', email: d.email || '' };
      } },
    { ma: 'ttdn', ten: 'Thông tin doanh nghiệp',
      url: function (mst) { return 'https://thongtindoanhnghiep.co/api/company/' + mst; },
      doc: function (j) {
          var d = j || {};
          if (!d.Title && !d.TitleEn) return null;
          return { ten: d.Title || d.TitleEn || '',
                   diaChi: d.DiaChiCongTy || d.ChuSoHuu || '',
                   daiDien: d.ChuSoHuu || '', dienThoai: d.Tel || '', email: d.Email || '' };
      } }
];
/* Chỉ giữ đúng năm trường nghiệp vụ — chốt chặn cuối cùng cho quy định
   "không lấy ngành nghề, ngày thành lập, tình trạng hoạt động". */
var TRUONG_TRA = ['ten', 'diaChi', 'daiDien', 'dienThoai', 'email'];
function locTruong(o) {
    var r = {};
    TRUONG_TRA.forEach(function (k) { r[k] = String((o && o[k]) || '').trim(); });
    return r;
}
W.TRUONG_TRA_MST = TRUONG_TRA;

var HET_GIO = 12000;                       // mỗi nguồn chờ tối đa 12 giây

/**
 * Tra cứu một mã số thuế.
 * xong({ ok, mst, data:{ten,diaChi,daiDien,dienThoai,email}, nguon, loi, matMang })
 * KHÔNG bao giờ ném lỗi — mọi trục trặc đều trả về qua tham số xong().
 */
W.traCuuMST = function (mst, xong) {
    var so = T.chuanMST(mst);
    if (!T.mstHopLe(so))
        return xong({ ok: false, mst: so, loi: 'Mã số thuế phải gồm 10 hoặc 13 chữ số' });
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
        return xong({ ok: false, mst: so, matMang: true,
                      loi: 'Máy tính đang không có kết nối Internet' });
    var ds = W.NGUON_MST.slice(), i = 0, loi = '';
    (function thu() {
        if (i >= ds.length)
            return xong({ ok: false, mst: so,
                          loi: loi || 'Không tìm thấy doanh nghiệp có mã số thuế này' });
        var ng = ds[i++];
        var xong1 = false;
        var het = setTimeout(function () {
            if (xong1) return;
            xong1 = true; loi = loi || 'Dịch vụ ' + ng.ten + ' không phản hồi'; thu();
        }, HET_GIO);
        function tra(e) {
            if (xong1) return;
            xong1 = true; clearTimeout(het);
            loi = loi || e; thu();
        }
        try {
            W.fetch(ng.url(so), { method: 'GET', headers: { Accept: 'application/json' } })
                .then(function (rp) {
                    if (!rp || !rp.ok) return tra('Dịch vụ ' + ng.ten + ' trả về lỗi ' +
                                                  ((rp && rp.status) || ''));
                    return rp.json().then(function (j) {
                        if (xong1) return;
                        var d = null;
                        try { d = ng.doc(j); } catch (e2) { d = null; }
                        if (!d || !d.ten) return tra('Không tìm thấy doanh nghiệp trên ' + ng.ten);
                        xong1 = true; clearTimeout(het);
                        xong({ ok: true, mst: so, data: locTruong(d), nguon: ng.ten });
                    });
                })['catch'](function (e3) {
                    tra('Không kết nối được ' + ng.ten + ' (' + (e3 && e3.message ? e3.message : 'lỗi mạng') + ')');
                });
        } catch (e4) { tra('Không gọi được dịch vụ ' + ng.ten); }
    })();
};

/**
 * Tra cứu NHIỀU mã số thuế, chạy song song có giới hạn để không nghẽn mạng.
 * moiDong(i, kq) gọi sau từng dòng; xong() gọi khi hết danh sách.
 * Một vài dòng lỗi KHÔNG làm dừng cả mẻ.
 */
W.traCuuNhieuMST = function (ds, moiDong, xong, soLuong) {
    var n = ds.length, xongSo = 0, chay = 0, i = 0;
    var toiDa = soLuong || 5;
    if (!n) return xong();
    (function bom() {
        while (chay < toiDa && i < n) {
            (function (k) {
                chay++;
                W.traCuuMST(ds[k], function (kq) {
                    chay--; xongSo++;
                    try { moiDong(k, kq); } catch (e) { /* một dòng lỗi không dừng cả mẻ */ }
                    if (xongSo >= n) return xong();
                    bom();
                });
            })(i++);
        }
    })();
};

/* ==========================================================================
   2. BIỂU MẪU KHÁCH HÀNG
   ========================================================================== */
function dsNhanVien() {
    return DB.all('nhanVien').map(function (n) { return { v: n.id, t: n.hoTen }; });
}
function dsDonVi() {
    return DB.all('donVi').map(function (d) { return { v: d.id, t: d.ten }; });
}
function dsBangGia() {
    return DB.all('bangGiaBan').map(function (b) {
        var d = DB.get('donVi', b.donViId);
        return { v: b.id, t: b.ten + (d ? ' — ' + d.tat : '') };
    });
}

/** Biểu mẫu khai khách hàng — đổi Loại khách hàng là đổi luôn bộ trường. */
function formKH(r) {
    r = r || {};
    var moi = !r.id;
    var loai = r.loai || 'Doanh nghiệp';
    return '' +
    '<div class="note b mb12"><i class="bi bi-diagram-3-fill"></i><div>' +
    '<b>Dữ liệu nền dùng chung toàn hệ thống.</b> Báo giá, đơn bán hàng, hợp đồng, phụ lục, ' +
    'phiếu xuất kho, biên bản giao hàng, biên bản nghiệm thu, đề nghị thanh toán, phiếu thu, ' +
    'công nợ và báo cáo đều lấy khách hàng từ đây bằng <b>mã khách hàng nội bộ</b> — ' +
    'không phân hệ nào khai riêng.</div></div>' +

    '<div class="grid2">' +
    '<div class="fld"><label>Mã khách hàng</label>' +
        '<input data-f="ma" value="' + T.esc(r.ma || DB.maKHMoi()) + '" readonly ' +
        'style="background:#eef1f5;font-family:Consolas,monospace">' +
        '<div class="small muted">Hệ thống tự sinh, không nhập tay</div></div>' +
    '<div class="fld req"><label>Loại khách hàng</label>' +
        '<div class="row" id="khLoai" style="gap:16px;padding-top:5px">' +
        T.LOAI_KH.map(function (x) {
            return '<label class="chk"><input type="radio" name="khLoai" value="' + x + '"' +
                (loai === x ? ' checked' : '') + (moi ? '' : '') + '> ' + x + '</label>';
        }).join('') + '</div>' +
        '<input type="hidden" data-f="loai" value="' + T.esc(loai) + '"></div>' +
    '</div>' +

    /* ------------------------------------------------ KHỐI DOANH NGHIỆP */
    '<div id="khDN" class="mt12">' +
      '<div class="grid2">' +
      '<div class="fld"><label>Mã số thuế</label>' +
          '<div class="row" style="gap:6px">' +
          '<input data-f="mst" id="khMST" value="' + T.esc(r.mst || '') + '" ' +
          'placeholder="10 hoặc 13 chữ số" style="flex:1;font-family:Consolas,monospace">' +
          '<button type="button" class="btn primary" id="khTra" style="flex:0 0 auto">' +
          '<i class="bi bi-search"></i> Tra cứu</button></div>' +
          '<div class="small muted" id="khTraKQ">Tra cứu trực tuyến để tự điền tên, địa chỉ, ' +
          'người đại diện, điện thoại, email</div></div>' +
      '<div class="fld"><label>Điện thoại công ty</label>' +
          '<input data-f="dienThoai" value="' + T.esc(r.dienThoai || '') + '"></div>' +
      '<div class="fld req span2"><label>Tên doanh nghiệp</label>' +
          '<input data-f="ten" value="' + T.esc(r.ten || '') + '"></div>' +
      '<div class="fld span2"><label>Địa chỉ trụ sở</label>' +
          '<input data-f="diaChi" value="' + T.esc(r.diaChi || '') + '"></div>' +
      '<div class="fld"><label>Người đại diện theo pháp luật</label>' +
          '<input data-f="daiDien" value="' + T.esc(r.daiDien || '') + '"></div>' +
      '<div class="fld"><label>Email công ty</label>' +
          '<input data-f="email" value="' + T.esc(r.email || '') + '"></div>' +
      '</div>' +
      '<div class="card mt12"><div class="card-h"><i class="bi bi-person-lines-fill"></i> Người liên hệ</div>' +
      '<div class="card-b"><div class="grid2">' +
      '<div class="fld"><label>Người liên hệ</label>' +
          '<input data-f="nguoiLienHe" value="' + T.esc(r.nguoiLienHe || '') + '"></div>' +
      '<div class="fld"><label>Chức vụ</label>' +
          '<input data-f="chucVu" value="' + T.esc(r.chucVu || '') + '"></div>' +
      '<div class="fld"><label>Điện thoại người liên hệ</label>' +
          '<input data-f="dtLienHe" value="' + T.esc(r.dtLienHe || '') + '"></div>' +
      '<div class="fld"><label>Email người liên hệ</label>' +
          '<input data-f="emailLienHe" value="' + T.esc(r.emailLienHe || '') + '"></div>' +
      '</div></div></div>' +
    '</div>' +

    /* ------------------------------------------------------ KHỐI CÁ NHÂN */
    '<div id="khCN" class="mt12"><div class="grid2">' +
      '<div class="fld req span2"><label>Họ và tên</label>' +
          '<input data-f="tenCN" value="' + T.esc(r.ten || '') + '"></div>' +
      '<div class="fld"><label>Số căn cước công dân</label>' +
          '<input data-f="cccd" value="' + T.esc(r.cccd || '') + '" placeholder="Không bắt buộc"></div>' +
      '<div class="fld"><label>Điện thoại</label>' +
          '<input data-f="dienThoaiCN" value="' + T.esc(r.dienThoai || '') + '"></div>' +
      '<div class="fld span2"><label>Địa chỉ</label>' +
          '<input data-f="diaChiCN" value="' + T.esc(r.diaChi || '') + '"></div>' +
      '<div class="fld span2"><label>Email</label>' +
          '<input data-f="emailCN" value="' + T.esc(r.email || '') + '"></div>' +
    '</div></div>' +

    /* ------------------------------------------- CHÍNH SÁCH BÁN HÀNG */
    '<div class="card mt12"><div class="card-h"><i class="bi bi-cash-coin"></i> Chính sách bán hàng</div>' +
    '<div class="card-b"><div class="grid2">' +
    '<div class="fld" id="khCSG"><label>Chính sách giá</label><select data-f="bangGiaId">' +
        '<option value="">— Theo bảng giá mặc định của công ty phát hành —</option>' +
        W.opt(dsBangGia(), r.bangGiaId || '') + '</select></div>' +
    W.oMD('dieuKhoanTT', { f: 'dieuKhoanTTId', fTen: 'dieuKhoanTT', gt: r.dieuKhoanTTId,
                           gtTen: r.dieuKhoanTT, nhan: 'Điều khoản thanh toán', tuDo: true }) +
    '<div class="fld"><label>Hạn mức công nợ (đ)</label>' +
        '<input class="tien num" data-f="hanMucNo" value="' + T.esc(T.soVe(r.hanMucNo || 0)) + '"></div>' +
    W.oMD('nhanVien', { f: 'nguoiPhuTrachId', fTen: 'nguoiPhuTrach', gt: r.nguoiPhuTrachId,
                        gtTen: r.nguoiPhuTrach, nhan: 'Người phụ trách',
                        trong: '— Chưa phân công —' }) +
    '<div class="fld"><label>Công ty phát hành</label><select data-f="donViId">' +
        '<option value="">— Mọi công ty trong nhóm —</option>' +
        W.opt(dsDonVi(), r.donViId || '') + '</select></div>' +
    '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' +
        W.opt(['Đang giao dịch', 'Ngừng giao dịch'], r.trangThai || 'Đang giao dịch') + '</select></div>' +
    '<div class="fld span2"><label>Dự án / công trình</label>' +
        '<input data-f="duAn" value="' + T.esc(r.duAn || '') + '" placeholder="Ngăn cách bằng dấu ;"></div>' +
    '<div class="fld span2"><label>Ghi chú</label>' +
        '<textarea data-f="ghiChu" rows="2">' + T.esc(r.ghiChu || '') + '</textarea></div>' +
    '</div></div></div>' +
    (r.id ? '<div class="note b mt12"><i class="bi bi-graph-up"></i><div>' +
        'Công nợ, doanh số và lịch sử giao dịch của khách hàng này xem tại ' +
        '<b>Thu chi &amp; Công nợ → Công nợ</b> và <b>Báo cáo tổng hợp</b>. ' +
        'Danh mục chỉ giữ dữ liệu nền, không chứa số liệu phát sinh.</div></div>' : '');
}

/** Bật đúng bộ trường theo loại khách hàng đang chọn. */
function apLoai(h, loai) {
    var dn = loai !== 'Cá nhân';
    h.q('#khDN').hidden = !dn;
    h.q('#khCN').hidden = dn;
    var o = h.q('[data-f="loai"]');
    if (o) o.value = loai;
    /* Ô bắt buộc phải theo đúng khối đang hiện, nếu không sẽ báo thiếu ô đang ẩn. */
    h.el.querySelectorAll('#khDN [data-f="ten"]').forEach(function (e) { e.disabled = !dn; });
    h.el.querySelectorAll('#khCN [data-f="tenCN"]').forEach(function (e) { e.disabled = dn; });
}

/** Đọc biểu mẫu thành bản ghi Customer Master Data. */
function docKH(v, r) {
    r = r || {};
    var dn = v.loai !== 'Cá nhân';
    return {
        ma: v.ma || r.ma || DB.maKHMoi(),
        loai: v.loai,
        ten: String((dn ? v.ten : v.tenCN) || '').trim(),
        mst: dn ? T.chuanMST(v.mst) : '',
        cccd: dn ? '' : String(v.cccd || '').trim(),
        diaChi: String((dn ? v.diaChi : v.diaChiCN) || '').trim(),
        daiDien: dn ? String(v.daiDien || '').trim() : '',
        dienThoai: String((dn ? v.dienThoai : v.dienThoaiCN) || '').trim(),
        email: String((dn ? v.email : v.emailCN) || '').trim(),
        nguoiLienHe: dn ? String(v.nguoiLienHe || '').trim() : '',
        chucVu: dn ? String(v.chucVu || '').trim() : '',
        dtLienHe: dn ? String(v.dtLienHe || '').trim() : '',
        emailLienHe: dn ? String(v.emailLienHe || '').trim() : '',
        bangGiaId: dn ? (v.bangGiaId || '') : (v.bangGiaId || ''),
        dieuKhoanTTId: v.dieuKhoanTTId || '', dieuKhoanTT: v.dieuKhoanTT || '',
        hanMucNo: T.so(v.hanMucNo),
        nguoiPhuTrachId: v.nguoiPhuTrachId || '',
        nguoiPhuTrach: (DB.get('nhanVien', v.nguoiPhuTrachId) || {}).hoTen || '',
        donViId: v.donViId || '',
        duAn: v.duAn || '', ghiChu: v.ghiChu || '',
        trangThai: v.trangThai || 'Đang giao dịch',
        tenKhac: r.tenKhac || '', mucGia: r.mucGia || 'BL',
        soLanGiaoDich: r.soLanGiaoDich || 0,
        nguonMST: r.nguonMST || ''
    };
}
W.docKhachHang = docKH;

/* ------------------------------------------------- NÚT TRA CỨU TRÊN BIỂU MẪU */
function bindTraCuu(h) {
    var b = h.q('#khTra'), o = h.q('#khMST'), kq = h.q('#khTraKQ');
    if (!b) return;
    b.onclick = function () {
        var so = T.chuanMST(o.value);
        if (!T.mstHopLe(so)) {
            kq.innerHTML = '<span style="color:var(--err)">Mã số thuế phải gồm 10 hoặc 13 chữ số.</span>';
            return UI.toast('err', 'Mã số thuế chưa hợp lệ', 'Nhập 10 hoặc 13 chữ số.');
        }
        o.value = so;
        b.disabled = true;
        kq.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang tra cứu trực tuyến…';
        W.traCuuMST(so, function (kt) {
            b.disabled = false;
            if (!kt.ok) {
                kq.innerHTML = '<span style="color:var(--err)"><i class="bi bi-x-circle"></i> ' +
                    T.esc(kt.loi) + '</span> — vẫn nhập tay được bình thường.';
                return UI.toast(kt.matMang ? 'warn' : 'err',
                    kt.matMang ? 'Không có kết nối Internet' : 'Không tra cứu được',
                    T.esc(kt.loi) + '. Anh vẫn khai tay các ô bên dưới như bình thường.', 6000);
            }
            var d = kt.data;
            function dat(f, val) {
                var e = h.q('[data-f="' + f + '"]');
                if (e && val) e.value = val;
            }
            dat('ten', d.ten); dat('diaChi', d.diaChi); dat('daiDien', d.daiDien);
            dat('dienThoai', d.dienThoai); dat('email', d.email);
            kq.innerHTML = '<span style="color:var(--ok)"><i class="bi bi-check-circle-fill"></i> ' +
                'Đã lấy thông tin từ ' + T.esc(kt.nguon) + '</span> — kiểm tra và sửa lại trước khi lưu.';
            UI.toast('ok', 'Đã tra cứu xong', 'Nguồn: ' + kt.nguon +
                '. Anh kiểm tra và sửa lại nếu cần rồi bấm Lưu.');
        });
    };
    o.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); b.click(); } };
}
/* Dùng chung cho cả biểu mẫu danh mục và ô "Thêm nhanh khách hàng" trên chứng từ. */
W.bindTraCuuMST = bindTraCuu;

/* ------------------------------------------------------- KIỂM TRA TRÙNG */
/**
 * Đã có khách hàng trùng thì KHÔNG tạo bản ghi thứ hai — hỏi người dùng:
 *   Mở hồ sơ · Đồng bộ (cập nhật vào hồ sơ cũ) · Hủy.
 */
function hoiTrung(cu, o, moTruoc, dongBo) {
    var lyDo = T.laDoanhNghiep(o)
        ? 'Mã số thuế <b>' + T.esc(T.mstHien(o.mst)) + '</b> đã có trong danh mục.'
        : (o.cccd ? 'Số căn cước <b>' + T.esc(o.cccd) + '</b> đã có trong danh mục.'
                  : 'Đã có khách hàng cùng <b>họ tên và số điện thoại</b> trong danh mục.');
    UI.modal({
        size: 'md', title: 'Khách hàng đã tồn tại', dismiss: false,
        sub: 'Hệ thống không tạo hồ sơ trùng — chọn cách xử lý',
        body: '<div class="note y mb12"><i class="bi bi-exclamation-triangle-fill"></i><div>' +
            lyDo + '</div></div>' +
            '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:170px">Thông tin</th>' +
            '<th>Hồ sơ đã có</th><th>Dữ liệu đang khai</th></tr></thead><tbody>' +
            [['Mã khách hàng', cu.ma, o.ma],
             ['Tên', cu.ten, o.ten],
             ['Mã số thuế', T.mstHien(cu.mst), T.mstHien(o.mst)],
             ['Địa chỉ', cu.diaChi, o.diaChi],
             ['Người đại diện', cu.daiDien, o.daiDien],
             ['Điện thoại', cu.dienThoai, o.dienThoai],
             ['Email', cu.email, o.email]].map(function (x) {
                var khac = String(x[1] || '') !== String(x[2] || '');
                return '<tr><td><b>' + T.esc(x[0]) + '</b></td><td>' +
                    (x[1] ? T.esc(x[1]) : '<span class="muted">—</span>') + '</td><td' +
                    (khac ? ' style="background:#fff8e1"' : '') + '>' +
                    (x[2] ? T.esc(x[2]) : '<span class="muted">—</span>') + '</td></tr>';
            }).join('') + '</tbody></table></div>',
        buttons: [
            { text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } },
            { text: 'Mở hồ sơ đã có', icon: 'bi-folder2-open',
              click: function (h) { h.close(); moTruoc(cu); } },
            { text: 'Đồng bộ vào hồ sơ đã có', cls: 'primary', icon: 'bi-arrow-repeat',
              click: function (h) { h.close(); dongBo(cu); } }
        ]
    });
}
W.hoiTrungKhachHang = hoiTrung;

/* ==========================================================================
   3. MÀN HÌNH DANH MỤC KHÁCH HÀNG
   ========================================================================== */
S['khach-hang'] = function (host) {
    var g = W.CRUD(host, {
        title: 'Khách hàng', coll: 'khachHang', file: 'DanhSach_KhachHang',
        trangThaiDS: ['Đang giao dịch', 'Ngừng giao dịch'],
        copy: false,
        suaHangLoat: [
            { k: 'bangGiaId', t: 'Chính sách giá', type: 'select', opts: dsBangGia() },
            { k: 'dieuKhoanTT', t: 'Điều khoản thanh toán', type: 'text' },
            { k: 'nguoiPhuTrachId', t: 'Người phụ trách', type: 'select', opts: dsNhanVien() },
            { k: 'donViId', t: 'Công ty phát hành', type: 'select', opts: dsDonVi() },
            { k: 'trangThai', t: 'Trạng thái', type: 'select',
              opts: ['Đang giao dịch', 'Ngừng giao dịch'] }
        ],
        sub: 'Customer Master Data — dữ liệu nền dùng chung cho toàn bộ phần mềm',
        crumb: ['Danh mục', 'Khách hàng'],
        banner: '<div class="note b mb12"><i class="bi bi-diagram-3-fill"></i><div>' +
            '<b>Đây là dữ liệu gốc về khách hàng.</b> Mọi chứng từ và báo cáo đều liên kết ' +
            'tới đây bằng mã khách hàng nội bộ. Sửa ở đây là toàn hệ thống đổi theo — ' +
            'riêng chứng từ ĐÃ PHÁT HÀNH vẫn giữ nguyên thông tin lúc ký (bản chụp pháp lý).' +
            '</div></div>',
        tbExtra: '<button class="btn primary" data-nhapMST title="Nhập Excel danh sách mã số thuế, hệ thống tự tra cứu và điền thông tin">' +
                 '<i class="bi bi-cloud-download"></i> Nhập hàng loạt theo mã số thuế</button>',
        rows: function () { return DB.all('khachHang'); },
        search: ['ma', 'ten', 'tenKhac', 'duAn', 'dienThoai', 'mst', 'cccd', 'nguoiLienHe'],
        sortK: null,
        cols: [
            { k: 'ma', t: 'Mã KH', w: 104, cls: 'mono' },
            { k: 'ten', t: 'Tên khách hàng', r: function (v, r) {
                return '<b>' + T.esc(v) + '</b>' +
                    (r.duAn ? '<div class="small muted ellip">Dự án: ' + T.esc(r.duAn) + '</div>' : ''); } },
            { k: 'loai', t: 'Loại', w: 118, r: function (v) {
                return v === 'Cá nhân' ? '<span class="pill n">Cá nhân</span>'
                                       : '<span class="pill b">Doanh nghiệp</span>'; } },
            { k: 'mst', t: 'Mã số thuế', w: 132, cls: 'mono',
              r: function (v, r) {
                  return v ? T.esc(T.mstHien(v))
                           : (r.cccd ? '<span class="small muted">CCCD ' + T.esc(r.cccd) + '</span>'
                                     : '<span class="muted">—</span>'); } },
            { k: 'daiDien', t: 'Người đại diện', w: 150,
              r: function (v) { return v ? T.esc(v) : '<span class="muted">—</span>'; } },
            { k: 'dienThoai', t: 'Điện thoại', w: 112 },
            { k: 'bangGiaId', t: 'Chính sách giá', w: 156, r: function (v) {
                var b = DB.get('bangGiaBan', v);
                return b ? '<span class="pill b">' + T.esc(b.ten) + '</span>'
                         : '<span class="pill n">Theo mặc định công ty</span>'; } },
            { k: 'nguoiPhuTrach', t: 'Người phụ trách', w: 140,
              r: function (v) { return v ? T.esc(v) : '<span class="muted">—</span>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 128, r: function (v) { return T.pill(v); } }
        ],
        filters: [
            { k: 'loai', t: 'Loại khách hàng', opts: T.LOAI_KH },
            { k: 'bangGiaId', t: 'Chính sách giá', w: 175, opts: dsBangGia() },
            { k: 'nguoiPhuTrachId', t: 'Người phụ trách', w: 170, opts: dsNhanVien() },
            { k: 'trangThai', t: 'Trạng thái', opts: ['Đang giao dịch', 'Ngừng giao dịch'] }
        ],
        excel: [
            { t: 'Mã KH', k: 'ma', w: 14 }, { t: 'Loại khách hàng', k: 'loai', w: 16 },
            { t: 'Tên khách hàng', k: 'ten', w: 46 },
            { t: 'Mã số thuế', k: 'mst', w: 16 }, { t: 'CCCD', k: 'cccd', w: 16 },
            { t: 'Địa chỉ', k: 'diaChi', w: 40 },
            { t: 'Người đại diện', k: 'daiDien', w: 24 },
            { t: 'Điện thoại', k: 'dienThoai', w: 15 }, { t: 'Email', k: 'email', w: 24 },
            { t: 'Người liên hệ', k: 'nguoiLienHe', w: 22 }, { t: 'Chức vụ', k: 'chucVu', w: 18 },
            { t: 'Điện thoại người liên hệ', k: 'dtLienHe', w: 18 },
            { t: 'Email người liên hệ', k: 'emailLienHe', w: 24 },
            { t: 'Chính sách giá', k: '_bg', w: 24,
              v: function (r) { return (DB.get('bangGiaBan', r.bangGiaId) || {}).ten || ''; } },
            { t: 'Điều khoản thanh toán', k: 'dieuKhoanTT', w: 34 },
            { t: 'Hạn mức công nợ', k: 'hanMucNo', w: 18 },
            { t: 'Người phụ trách', k: 'nguoiPhuTrach', w: 22 },
            { t: 'Công ty phát hành', k: '_dv', w: 26,
              v: function (r) { return (DB.get('donVi', r.donViId) || {}).ten || ''; } },
            { t: 'Dự án', k: 'duAn', w: 30 }, { t: 'Ghi chú', k: 'ghiChu', w: 30 },
            { t: 'Trạng thái', k: 'trangThai', w: 16 }
        ],
        nhapCot: function () {
            return [
                { t: 'Mã số thuế', k: 'mst', w: 16, kieu: 'Chữ',
                  mo: 'Khách hàng doanh nghiệp. Để trống nếu là khách hàng cá nhân' },
                { t: 'Loại khách hàng', k: 'loai', w: 16, kieu: 'Chữ',
                  mo: 'Doanh nghiệp hoặc Cá nhân. Để trống thì hiểu là Doanh nghiệp' },
                { t: 'Tên khách hàng', k: 'ten', w: 46, kieu: 'Chữ',
                  mo: 'Để trống thì hệ thống tra cứu trực tuyến theo mã số thuế' },
                { t: 'Địa chỉ', k: 'diaChi', w: 40, kieu: 'Chữ' },
                { t: 'Người đại diện', k: 'daiDien', w: 24, kieu: 'Chữ' },
                { t: 'Điện thoại', k: 'dienThoai', w: 16, kieu: 'Chữ' },
                { t: 'Email', k: 'email', w: 24, kieu: 'Chữ' },
                { t: 'Người liên hệ', k: 'nguoiLienHe', w: 22, kieu: 'Chữ' },
                { t: 'CCCD', k: 'cccd', w: 16, kieu: 'Chữ', mo: 'Chỉ dùng cho khách hàng cá nhân' },
                { t: 'Ghi chú', k: 'ghiChu', w: 30, kieu: 'Chữ' }
            ];
        },
        nhapMau: function (r) {
            return { mst: r.mst || '', loai: r.loai || '', ten: r.ten, diaChi: r.diaChi || '',
                     daiDien: r.daiDien || '', dienThoai: r.dienThoai || '', email: r.email || '',
                     nguoiLienHe: r.nguoiLienHe || '', cccd: r.cccd || '', ghiChu: r.ghiChu || '' };
        },
        nhapDong: function (kt, r, da, i) {
            var loai = kt.chu('Loại khách hàng') || 'Doanh nghiệp';
            if (T.LOAI_KH.indexOf(loai) < 0) loai = 'Doanh nghiệp';
            var mst = T.chuanMST(kt.chu('Mã số thuế'));
            var ten = kt.chu('Tên khách hàng');
            if (loai === 'Doanh nghiệp' && !mst && !ten)
                kt.them('Mã số thuế', 'thiếu cả mã số thuế và tên khách hàng',
                        'Khai ít nhất một trong hai để hệ thống nhận diện được khách hàng.');
            if (loai === 'Cá nhân' && !ten)
                kt.them('Tên khách hàng', 'khách hàng cá nhân bắt buộc có họ và tên');
            if (mst && !T.mstHopLe(mst))
                kt.them('Mã số thuế', 'phải gồm 10 hoặc 13 chữ số', 'Đang khai: ' + mst);
            if (mst) {
                if (da[mst]) kt.them('Mã số thuế', 'trùng với dòng ' + da[mst] + ' trong tệp');
                else da[mst] = i + 2;
                if (DB.all('khachHang').some(function (x) { return T.chuanMST(x.mst) === mst; }))
                    kt.canhBao.push('Mã số thuế ' + mst + ' đã có trong danh mục — sẽ cập nhật hồ sơ cũ');
            }
            return {
                ma: '', loai: loai, ten: ten, mst: loai === 'Doanh nghiệp' ? mst : '',
                cccd: loai === 'Cá nhân' ? kt.chu('CCCD') : '',
                diaChi: kt.chu('Địa chỉ'), daiDien: loai === 'Doanh nghiệp' ? kt.chu('Người đại diện') : '',
                dienThoai: kt.chu('Điện thoại'), email: kt.chu('Email'),
                nguoiLienHe: loai === 'Doanh nghiệp' ? kt.chu('Người liên hệ') : '',
                chucVu: '', dtLienHe: '', emailLienHe: '',
                ghiChu: kt.chu('Ghi chú'), bangGiaId: '', dieuKhoanTT: '',
                nguoiPhuTrachId: '', nguoiPhuTrach: '', donViId: '',
                duAn: '', tenKhac: '', mucGia: 'BANLE', hanMucNo: 0,
                soLanGiaoDich: 0, nguonMST: '', trangThai: 'Đang giao dịch'
            };
        },
        rules: [],
        form: formKH,
        formSize: 'full',
        onForm: function (h, r) {
            apLoai(h, (r && r.loai) || 'Doanh nghiệp');
            h.el.querySelectorAll('#khLoai input').forEach(function (e) {
                e.onchange = function () { apLoai(h, e.value); };
            });
            bindTraCuu(h);
        },
        toObj: function (v, r) { return docKH(v, r); },
        truocLuu: function (o, r, h, tiep) {
            if (!o.ten) {
                UI.toast('err', 'Chưa nhập tên khách hàng',
                    o.loai === 'Cá nhân' ? 'Khách hàng cá nhân bắt buộc có họ và tên.'
                                         : 'Khách hàng doanh nghiệp bắt buộc có tên doanh nghiệp.');
                return false;
            }
            if (o.mst && !T.mstHopLe(o.mst)) {
                UI.toast('err', 'Mã số thuế chưa hợp lệ', 'Mã số thuế phải gồm 10 hoặc 13 chữ số.');
                return false;
            }
            var cu = T.trungKH(o, r && r.id);
            if (!cu) return true;
            h.close();
            hoiTrung(cu, o, function (x) { W.__form(x); },
                function (x) {
                    var m = T.clone(x);
                    Object.keys(o).forEach(function (k) {
                        if (k === 'ma' || k === 'soLanGiaoDich') return;
                        if (o[k] !== '' && o[k] !== 0 && o[k] !== undefined) m[k] = o[k];
                    });
                    DB.update('khachHang', x.id, m); DB.save();
                    W.route();
                    UI.toast('ok', 'Đã đồng bộ vào hồ sơ đã có', m.ma + ' — ' + m.ten);
                });
            return false;
        },
        check: function (o, r) {
            var d = DB.all('khachHang').filter(function (x) {
                return x.ma === o.ma && (!r || x.id !== r.id); });
            return d.length ? 'Mã khách hàng "' + o.ma + '" đã tồn tại.' : '';
        },
        ten: function (r) { return r.ten; }
    });
    var b = host.querySelector('[data-nhapMST]');
    if (b) b.onclick = function () { W.nhapKhachHangMST(g); };
    if (!Q.co('khachHang', 'them') && b) b.disabled = true;
};

/* ==========================================================================
   4. NHẬP HÀNG LOẠT THEO MÃ SỐ THUẾ
   --------------------------------------------------------------------------
   Nhận tệp Excel chỉ có cột Mã số thuế, hoặc tệp đầy đủ thông tin.
   Dữ liệu có sẵn trong Excel được ƯU TIÊN; ô nào trống thì hệ thống tra cứu
   trực tuyến để bổ sung. Một vài dòng lỗi KHÔNG làm dừng cả mẻ.
   ========================================================================== */
var COT_MST = ['mã số thuế', 'ma so thue', 'mst', 'tax code', 'taxcode', 'mã sô thuế'];
var COT_MAP = {
    ten: ['tên khách hàng', 'tên doanh nghiệp', 'tên công ty', 'ten khach hang', 'tên', 'name'],
    diaChi: ['địa chỉ', 'địa chỉ trụ sở', 'dia chi', 'address'],
    daiDien: ['người đại diện', 'người đại diện theo pháp luật', 'đại diện', 'nguoi dai dien'],
    dienThoai: ['điện thoại', 'số điện thoại', 'dien thoai', 'phone', 'điện thoại công ty'],
    email: ['email', 'thư điện tử', 'e-mail', 'email công ty'],
    nguoiLienHe: ['người liên hệ', 'nguoi lien he', 'liên hệ'],
    chucVu: ['chức vụ', 'chuc vu'],
    dtLienHe: ['điện thoại người liên hệ', 'đt người liên hệ'],
    emailLienHe: ['email người liên hệ'],
    ghiChu: ['ghi chú', 'ghi chu', 'note']
};
function tenCot(s) { return T.kd(String(s || '')).toLowerCase().replace(/\s+/g, ' ').trim(); }
function doDong(r) {
    var o = { mst: '', ten: '', diaChi: '', daiDien: '', dienThoai: '', email: '',
              nguoiLienHe: '', chucVu: '', dtLienHe: '', emailLienHe: '', ghiChu: '' };
    Object.keys(r).forEach(function (k) {
        var n = tenCot(k), v = String(r[k] === undefined || r[k] === null ? '' : r[k]).trim();
        if (!v) return;
        if (COT_MST.map(tenCot).indexOf(n) >= 0) { o.mst = T.chuanMST(v); return; }
        Object.keys(COT_MAP).forEach(function (f) {
            if (o[f]) return;
            if (COT_MAP[f].map(tenCot).indexOf(n) >= 0) o[f] = v;
        });
    });
    /* Tệp chỉ có MỘT cột không tiêu đề chuẩn nhưng toàn số → coi là cột mã số thuế. */
    if (!o.mst) {
        var ks = Object.keys(r);
        if (ks.length === 1) {
            var v1 = T.chuanMST(r[ks[0]]);
            if (T.mstHopLe(v1)) o.mst = v1;
        }
    }
    return o;
}
W.docDongMST = doDong;

var TT = {
    moi:  { t: 'Thành công', ico: '🟢', cls: 'g', mo: 'Tạo khách hàng mới' },
    daCo: { t: 'Đã tồn tại', ico: '🟡', cls: 'y', mo: 'Cập nhật hồ sơ đã có' },
    hong: { t: 'Không tìm thấy', ico: '🔴', cls: 'r', mo: 'Bỏ qua hoặc sửa lại tệp' }
};

W.nhapKhachHangMST = function (grid) {
    if (!Q.co('khachHang', 'them')) return UI.thieuQuyen('khachHang', 'them');
    var ds = [];              // [{ dong, mst, excel{}, tra{}, kq{}, tt, loi, lam }]
    var h = null, dangChay = false, dungLai = false;

    h = UI.modal({
        size: 'full', dismiss: false,
        title: 'Nhập hàng loạt khách hàng theo mã số thuế',
        sub: 'Tệp chỉ cần cột Mã số thuế — hệ thống tự tra cứu trực tuyến và điền thông tin',
        body:
          '<div class="note b mb12"><i class="bi bi-info-circle-fill"></i><div>' +
          'Tệp Excel có thể <b>chỉ có một cột Mã số thuế</b>, hoặc <b>đầy đủ thông tin</b>. ' +
          'Ô nào đã có trong tệp thì <b>ưu tiên dùng dữ liệu của tệp</b>; ô nào trống thì hệ thống ' +
          'tra cứu trực tuyến để bổ sung. Vài dòng lỗi <b>không làm dừng</b> cả mẻ nhập.</div></div>' +
          '<div class="row mb12">' +
          '<button class="btn" id="nkMau"><i class="bi bi-file-earmark-arrow-down"></i> Tải tệp mẫu</button>' +
          '<button class="btn primary" id="nkChon"><i class="bi bi-upload"></i> Chọn tệp Excel</button>' +
          '<button class="btn" id="nkTra" disabled><i class="bi bi-cloud-download"></i> Tra cứu trực tuyến</button>' +
          '<button class="btn" id="nkDung" hidden><i class="bi bi-stop-circle"></i> Dừng tra cứu</button>' +
          '<span class="tb-sep"></span>' +
          '<button class="btn" id="nkChonTat" disabled><i class="bi bi-check2-square"></i> Chọn tất cả</button>' +
          '<button class="btn" id="nkBoTat" disabled><i class="bi bi-square"></i> Bỏ chọn tất cả</button>' +
          '<button class="btn" id="nkLoi" disabled><i class="bi bi-file-earmark-excel"></i> Xuất danh sách lỗi</button>' +
          '<span class="spacer"></span><span id="nkTep" class="small muted"></span></div>' +
          '<div id="nkTien" hidden class="note b mb12"><i class="bi bi-hourglass-split"></i>' +
          '<div><b id="nkTienT">Đang tra cứu…</b><div class="nk-thanh"><i id="nkThanh"></i></div></div></div>' +
          '<div id="nkTong" class="row mb8"></div>' +
          '<div id="nkBang" class="tbl-wrap" style="max-height:calc(100vh - 430px)">' +
          '<div class="trong">Chưa chọn tệp. Bấm <b>Chọn tệp Excel</b> để bắt đầu.</div></div>',
        buttons: [
            { text: 'Đóng', icon: 'bi-x-lg', click: function (x) { dungLai = true; x.close(); } },
            { text: 'Ghi vào danh mục', cls: 'primary', icon: 'bi-database-add',
              click: function () { ghi(); } }
        ],
        onOpen: function (x) { h = x; bind(); ve(); }
    });

    function q(id) { return h.q('#' + id); }

    function bind() {
        q('nkMau').onclick = function () {
            W.tepMauNhap({
                ten: 'Khách hàng theo mã số thuế', file: 'Mau_NhapKhachHang_MST',
                cols: [
                    { t: 'Mã số thuế', k: 'mst', w: 16, kieu: 'Chữ',
                      mo: 'Bắt buộc với khách hàng doanh nghiệp. 10 hoặc 13 chữ số' },
                    { t: 'Tên khách hàng', k: 'ten', w: 46, kieu: 'Chữ',
                      mo: 'Để trống thì hệ thống tra cứu trực tuyến' },
                    { t: 'Địa chỉ', k: 'diaChi', w: 40, kieu: 'Chữ' },
                    { t: 'Người đại diện', k: 'daiDien', w: 24, kieu: 'Chữ' },
                    { t: 'Điện thoại', k: 'dienThoai', w: 16, kieu: 'Chữ' },
                    { t: 'Email', k: 'email', w: 24, kieu: 'Chữ' },
                    { t: 'Người liên hệ', k: 'nguoiLienHe', w: 22, kieu: 'Chữ' },
                    { t: 'Ghi chú', k: 'ghiChu', w: 30, kieu: 'Chữ' }
                ],
                mau: [{ mst: '0101245689', ten: '', diaChi: '', daiDien: '', dienThoai: '',
                        email: '', nguoiLienHe: '', ghiChu: '' }]
            });
        };
        q('nkChon').onclick = function () {
            UI.nhapExcel({ done: function (rows, ten) { nap(rows, ten); } });
        };
        q('nkTra').onclick = function () { traTatCa(); };
        q('nkDung').onclick = function () { dungLai = true; };
        q('nkChonTat').onclick = function () { chonHet(true); };
        q('nkBoTat').onclick = function () { chonHet(false); };
        q('nkLoi').onclick = function () { xuatLoi(); };
    }

    function chonHet(v) {
        ds.forEach(function (d) { if (d.tt !== 'hong') d.lam = v; });
        ve();
    }

    /* ------------------------------------------------------ đọc tệp Excel */
    function nap(rows, tenTep) {
        ds = [];
        var daMST = {};
        (rows || []).forEach(function (r, i) {
            var o = doDong(r);
            var d = { dong: i + 2, mst: o.mst, excel: o, tra: null, loi: '', lam: true };
            if (!o.mst && !o.ten) { d.tt = 'hong'; d.loi = 'Dòng trống — không có mã số thuế và tên'; }
            else if (o.mst && !T.mstHopLe(o.mst)) {
                d.tt = 'hong'; d.loi = 'Mã số thuế "' + o.mst + '" không hợp lệ (phải 10 hoặc 13 chữ số)';
            } else if (o.mst && daMST[o.mst]) {
                d.tt = 'hong'; d.loi = 'Trùng mã số thuế với dòng ' + daMST[o.mst] + ' trong tệp';
            } else {
                if (o.mst) daMST[o.mst] = d.dong;
                var cu = o.mst
                    ? DB.all('khachHang').filter(function (x) { return T.chuanMST(x.mst) === o.mst; })[0]
                    : null;
                d.cu = cu || null;
                d.tt = cu ? 'daCo' : 'moi';
            }
            if (d.tt === 'hong') d.lam = false;
            ds.push(d);
        });
        q('nkTep').textContent = (tenTep || '') + ' — ' + ds.length + ' dòng';
        ['nkTra', 'nkChonTat', 'nkBoTat', 'nkLoi'].forEach(function (k) { q(k).disabled = !ds.length; });
        ve();
        if (!ds.length) return UI.toast('warn', 'Tệp không có dữ liệu');
        var thieu = ds.filter(canTra).length;
        UI.toast('ok', 'Đã đọc ' + ds.length + ' dòng',
            thieu ? (thieu + ' dòng còn thiếu thông tin — bấm “Tra cứu trực tuyến” để bổ sung.')
                  : 'Tệp đã đủ thông tin, có thể ghi thẳng vào danh mục.');
    }

    /* Dòng cần tra cứu: có MST hợp lệ và còn ô nghiệp vụ nào trống. */
    function canTra(d) {
        if (d.tt === 'hong' || !d.mst) return false;
        return W.TRUONG_TRA_MST.some(function (k) { return !hop(d)[k]; });
    }
    /* Dữ liệu cuối cùng: ưu tiên Excel, thiếu thì lấy kết quả tra cứu. */
    function hop(d) {
        var o = {};
        W.TRUONG_TRA_MST.forEach(function (k) {
            o[k] = d.excel[k] || (d.tra && d.tra[k]) || '';
        });
        return o;
    }

    /* -------------------------------------------------- tra cứu trực tuyến */
    function traTatCa() {
        var can = ds.filter(canTra);
        if (!can.length) return UI.toast('info', 'Không có dòng nào cần tra cứu',
            'Tệp đã đủ thông tin cho toàn bộ các dòng hợp lệ.');
        dangChay = true; dungLai = false;
        q('nkTra').disabled = true; q('nkChon').disabled = true;
        q('nkDung').hidden = false; q('nkTien').hidden = false;
        var xong = 0;
        var nhipTong = 0;
        function tien() {
            q('nkTienT').textContent = 'Đang tra cứu trực tuyến — ' + xong + ' / ' + can.length + ' mã số thuế';
            q('nkThanh').style.width = Math.round(xong / can.length * 100) + '%';
            /* Bảng đếm trạng thái chỉ vẽ lại theo nhịp, không vẽ sau từng dòng. */
            if (++nhipTong % 25 === 0 || xong >= can.length) veTong();
        }
        tien();
        var i = 0, chay = 0, toiDa = 5;
        function bom() {
            if (dungLai) return ketThuc();
            while (chay < toiDa && i < can.length) {
                (function (d) {
                    chay++;
                    W.traCuuMST(d.mst, function (kt) {
                        chay--; xong++;
                        if (kt.ok) { d.tra = kt.data; d.nguon = kt.nguon; d.loi = ''; d.nhac = ''; }
                        else if (hop(d).ten) {
                            /* Tệp Excel đã có tên → dòng vẫn dùng được bình thường,
                               chỉ ghi chú là không bổ sung được phần còn thiếu. */
                            d.nhac = kt.loi; d.loi = '';
                        } else {
                            /* Không tra được và tệp cũng không có tên → đánh dấu đỏ,
                               bỏ chọn dòng này nhưng KHÔNG dừng cả mẻ nhập. */
                            d.loi = kt.loi; d.tt = 'hong'; d.lam = false;
                        }
                        tien(); veLaiDong(d);
                        if (xong >= can.length || dungLai) return ketThuc();
                        bom();
                    });
                })(can[i++]);
            }
        }
        var daKetThuc = false;
        function ketThuc() {
            if (daKetThuc || chay > 0) return;
            daKetThuc = true; dangChay = false;
            q('nkTra').disabled = false; q('nkChon').disabled = false;
            q('nkDung').hidden = true; q('nkTien').hidden = true;
            ve();
            var ok = can.filter(function (d) { return d.tra; }).length;
            UI.toast(ok ? 'ok' : 'warn', 'Tra cứu xong',
                'Lấy được thông tin ' + ok + ' / ' + can.length + ' mã số thuế. ' +
                (ok < can.length ? 'Các dòng còn lại vẫn khai tay được bình thường.' : ''));
        }
        bom();
    }

    /* --------------------------------------------------------- bảng đối chiếu */
    function ve() { veTong(); veThan(); }
    function veTong() {
        var d = { moi: 0, daCo: 0, hong: 0 };
        ds.forEach(function (x) { d[x.tt] = (d[x.tt] || 0) + 1; });
        q('nkTong').innerHTML = ds.length
            ? Object.keys(TT).map(function (k) {
                return '<span class="pill ' + TT[k].cls + '" style="font-size:13px">' +
                    TT[k].ico + ' ' + TT[k].t + ': <b>' + d[k] + '</b></span>';
            }).join(' ') +
            ' <span class="small muted">· Đã chọn xử lý: <b>' +
            ds.filter(function (x) { return x.lam; }).length + '</b> dòng</span>'
            : '';
    }
    /* Nội dung một dòng của bảng đối chiếu. Tách riêng để khi tra cứu xong một
       mã số thuế chỉ vẽ lại ĐÚNG dòng đó — tệp 1000 dòng vẫn mượt, không dựng
       lại cả bảng sau mỗi lần tra cứu. */
    function oDong(d, i) {
        var v = hop(d), t = TT[d.tt];
        return '<td class="ctr">' + (d.tt === 'hong' ? '' :
                '<input type="checkbox" data-nk="' + i + '"' + (d.lam ? ' checked' : '') + '>') + '</td>' +
            '<td class="ctr muted">' + d.dong + '</td>' +
            '<td class="mono">' + T.esc(T.mstHien(d.mst)) + '</td>' +
            '<td><b>' + T.esc(v.ten || '') + '</b>' +
                (d.nguon ? '<div class="small muted">Nguồn: ' + T.esc(d.nguon) + '</div>' : '') + '</td>' +
            '<td class="small">' + T.esc(v.diaChi || '') + '</td>' +
            '<td class="small">' + T.esc(v.daiDien || '') + '</td>' +
            '<td class="small">' + T.esc(v.dienThoai || '') + '</td>' +
            '<td class="small">' + T.esc(v.email || '') + '</td>' +
            '<td><span class="pill ' + t.cls + '">' + t.ico + ' ' + t.t + '</span>' +
                '<div class="small"><b>Xử lý: ' +
                    T.esc(d.tt === 'hong' ? 'Bỏ qua' : (d.lam ? t.mo : 'Bỏ qua')) + '</b></div>' +
                (d.tt === 'daCo' && d.cu ? '<div class="small muted">' + T.esc(d.cu.ma) + ' — ' +
                    T.esc(d.cu.ten) + '</div>' : '') +
                (d.loi ? '<div class="small" style="color:var(--err)">' + T.esc(d.loi) + '</div>' : '') +
                (d.nhac ? '<div class="small muted">' + T.esc(d.nhac) +
                    ' — dùng dữ liệu trong tệp</div>' : '') +
            '</td>';
    }
    function bindDong(tr, i) {
        var c = tr.querySelector('[data-nk]');
        if (!c) return;
        c.onchange = function () {
            ds[i].lam = c.checked;
            veTong(); veLaiDong(ds[i]);
        };
    }
    function veLaiDong(d) {
        var i = ds.indexOf(d);
        if (i < 0) return;
        var tr = q('nkBang').querySelector('tr[data-r="' + i + '"]');
        if (!tr) return;
        tr.className = d.tt === 'hong' ? 'nk-hong' : '';
        tr.innerHTML = oDong(d, i);
        bindDong(tr, i);
    }
    function veThan() {
        var o = q('nkBang');
        if (!ds.length) {
            o.innerHTML = '<div class="trong">Chưa chọn tệp. Bấm <b>Chọn tệp Excel</b> để bắt đầu.</div>';
            return;
        }
        o.innerHTML = '<table class="tbl nk-tb"><thead><tr>' +
            '<th style="width:38px" class="ctr"><input type="checkbox" id="nkAll"></th>' +
            '<th style="width:52px" class="ctr">Dòng</th>' +
            '<th style="width:126px">Mã số thuế</th><th>Tên doanh nghiệp</th>' +
            '<th style="width:230px">Địa chỉ</th><th style="width:150px">Người đại diện</th>' +
            '<th style="width:112px">Điện thoại</th><th style="width:170px">Email</th>' +
            '<th style="width:230px">Trạng thái</th></tr></thead><tbody>' +
            ds.map(function (d, i) {
                return '<tr data-r="' + i + '" class="' + (d.tt === 'hong' ? 'nk-hong' : '') + '">' +
                    oDong(d, i) + '</tr>';
            }).join('') + '</tbody></table>';
        o.querySelectorAll('tbody tr[data-r]').forEach(function (tr) {
            bindDong(tr, Number(tr.getAttribute('data-r')));
        });
        var all = o.querySelector('#nkAll');
        if (all) all.onchange = function () { chonHet(all.checked); };
    }

    /* ------------------------------------------------------ xuất danh sách lỗi */
    function xuatLoi() {
        var loi = ds.filter(function (d) { return d.tt === 'hong' || d.loi || d.nhac; });
        if (!loi.length) return UI.toast('info', 'Không có dòng lỗi nào');
        UI.xuatExcel('Loi_NhapKhachHang', 'Dòng lỗi khi nhập khách hàng', [
            { t: 'Dòng trong tệp', k: 'dong', w: 14 },
            { t: 'Mã số thuế', k: 'mst', w: 18 },
            { t: 'Tên khách hàng', k: 'ten', w: 42 },
            { t: 'Lý do', k: 'loi', w: 60 }
        ], loi.map(function (d) {
            return { dong: d.dong, mst: d.mst, ten: hop(d).ten || d.excel.ten || '',
                     loi: d.loi || d.nhac || 'Không tra cứu được thông tin' };
        }));
    }

    /* --------------------------------------------------------- ghi vào danh mục */
    function ghi() {
        if (dangChay) return UI.toast('warn', 'Đang tra cứu', 'Chờ tra cứu xong hoặc bấm Dừng tra cứu.');
        var lam = ds.filter(function (d) { return d.lam && d.tt !== 'hong'; });
        if (!lam.length) return UI.toast('warn', 'Chưa chọn dòng nào để ghi');
        var moi = 0, sua = 0, bo = 0;
        /* Ghi cả mẻ trong MỘT lần lưu — nếu để mỗi bản ghi tự lưu thì mẻ 1000
           khách hàng phải tuần tự hóa toàn bộ kho dữ liệu 1000 lần. */
        DB.gopGhi();
        lam.forEach(function (d) {
            var v = hop(d);
            if (!v.ten) { bo++; return; }
            if (d.tt === 'daCo' && d.cu) {
                var m = T.clone(d.cu);
                ['ten', 'diaChi', 'daiDien', 'dienThoai', 'email'].forEach(function (k) {
                    if (v[k]) m[k] = v[k];
                });
                ['nguoiLienHe', 'chucVu', 'dtLienHe', 'emailLienHe', 'ghiChu'].forEach(function (k) {
                    if (d.excel[k]) m[k] = d.excel[k];
                });
                m.mst = d.mst;
                if (d.nguon) m.nguonMST = d.nguon;
                DB.update('khachHang', d.cu.id, m);
                sua++;
                return;
            }
            DB.insert('khachHang', {
                ma: DB.maKHMoi(), loai: 'Doanh nghiệp', ten: v.ten, mst: d.mst, cccd: '',
                diaChi: v.diaChi, daiDien: v.daiDien, dienThoai: v.dienThoai, email: v.email,
                nguoiLienHe: d.excel.nguoiLienHe || '', chucVu: d.excel.chucVu || '',
                dtLienHe: d.excel.dtLienHe || '', emailLienHe: d.excel.emailLienHe || '',
                bangGiaId: '', dieuKhoanTT: '', hanMucNo: 0,
                nguoiPhuTrachId: '', nguoiPhuTrach: '', donViId: '',
                duAn: '', tenKhac: '', mucGia: 'BANLE', soLanGiaoDich: 0,
                nguonMST: d.nguon || '', ghiChu: d.excel.ghiChu || '',
                trangThai: 'Đang giao dịch'
            });
            moi++;
        });
        DB.log('them', 'khachHang', '', 'Nhập hàng loạt theo mã số thuế: thêm ' + moi + ', cập nhật ' + sua);
        DB.xongGopGhi();
        DB.save();
        h.close();
        if (grid) grid.reload(DB.all('khachHang'));
        W.route();
        UI.toast('ok', 'Đã ghi vào Danh mục Khách hàng',
            'Thêm mới ' + moi + ' · cập nhật ' + sua + (bo ? ' · bỏ qua ' + bo + ' dòng thiếu tên' : ''));
    }
};

})(window);

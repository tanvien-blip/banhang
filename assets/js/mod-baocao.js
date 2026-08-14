/* ==========================================================================
   TVERP — BIỂU MẪU IN & BÁO CÁO
   --------------------------------------------------------------------------
   Tệp này KHÔNG tự viết bố cục. Mọi khối trình bày — đầu trang doanh nghiệp,
   tiêu đề ba bậc, khối thông tin các bên, bảng hàng hóa có bề rộng cột tính
   theo nội dung, khối tổng cộng, tiền bằng chữ, điều khoản, khối chữ ký và
   chân trang — đều lấy từ HỆ THỐNG THIẾT KẾ TÀI LIỆU (assets/js/mod-tailieu.js
   và assets/css/print.css).

   Ở đây chỉ khai NỘI DUNG NGHIỆP VỤ của từng loại chứng từ: chứng từ nào có
   những bên nào, những điều khoản nào, những ô ký nào. Muốn đổi diện mạo của
   toàn bộ hồ sơ thì sửa hệ thống thiết kế, không sửa tệp này.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;

var DDS = W.DDS;

/* Tên biểu mẫu — tra một chỗ, dùng cho cả bản in, tên tệp xuất và tiêu đề cửa sổ. */
var TIEU_DE_IN = {
    baoGia: 'BÁO GIÁ KIÊM XÁC NHẬN ĐƠN HÀNG', donBan: 'ĐƠN ĐẶT HÀNG',
    hopDong: 'HỢP ĐỒNG KINH TẾ', phuLuc: 'PHỤ LỤC HỢP ĐỒNG',
    phieuXuat: 'PHIẾU XUẤT KHO', bienBanGiao: 'BIÊN BẢN GIAO HÀNG',
    bienBanNghiemThu: 'BIÊN BẢN NGHIỆM THU', deNghiTT: 'ĐỀ NGHỊ THANH TOÁN',
    donMua: 'ĐƠN ĐẶT HÀNG (MUA VÀO)', phieuThu: 'PHIẾU THU', phieuChi: 'PHIẾU CHI',
    phieuNhap: 'PHIẾU NHẬP KHO'
};
W.TIEU_DE_IN = TIEU_DE_IN;

/* Dòng dẫn nhỏ phía trên tên biểu mẫu — cho người đọc biết ngay đang cầm loại
   hồ sơ nào trong bộ hồ sơ giao dịch. */
var NHOM_IN = {
    baoGia: 'Hồ sơ chào giá', donBan: 'Hồ sơ bán hàng', donMua: 'Hồ sơ mua hàng',
    hopDong: 'Văn bản thỏa thuận', phuLuc: 'Văn bản thỏa thuận',
    phieuXuat: 'Chứng từ kho', phieuNhap: 'Chứng từ kho',
    bienBanGiao: 'Hồ sơ giao nhận', bienBanNghiemThu: 'Hồ sơ nghiệm thu',
    deNghiTT: 'Hồ sơ thanh toán', phieuThu: 'Chứng từ quỹ', phieuChi: 'Chứng từ quỹ'
};
W.NHOM_IN = NHOM_IN;

/* ---------------------------------------------------------------- TIỆN ÍCH */
function ngayVN(iso) {
    if (!iso) return '';
    var p = String(iso).substr(0, 10).split('-');
    return 'Ngày ' + p[2] + ' tháng ' + p[1] + ' năm ' + p[0];
}
function diaDanh(cty) {
    var d = (cty.diaChi || '').trim();
    var m = /TP\s+(.+)$/i.exec(d) || /Thành phố\s+(.+)$/i.exec(d) || /,\s*([^,]+)$/.exec(d);
    return (m ? m[1] : 'Hà Nội').trim();
}
/* MÃ HÀNG in trên biểu mẫu — tra bản ghi hàng hóa bằng ID NỘI BỘ của dòng
   chứng từ, không tra bằng chuỗi mã (Model được phép trùng). */
function model(l) {
    var hh = DB.get('hangHoa', T.idDong(l));
    return (hh && hh.ma) || l.maHang || '';
}
function dongTien(l) {
    return (Number(l.soLuong) || 0) * (Number(l.donGia) || 0) * (1 - (Number(l.ckPhanTram) || 0) / 100);
}
function ts(r) { return r.vatPct === undefined ? 10 : Number(r.vatPct); }

/**
 * Nội dung của một chứng từ. Ưu tiên phần người dùng đã SỬA NỘI DUNG riêng
 * cho chính chứng từ đó (nút "Sửa nội dung" trên thanh xem trước), rồi mới
 * đến dữ liệu gốc của chứng từ. Không còn thư viện điều khoản: điều khoản
 * dùng chung khai ở Thiết lập doanh nghiệp (Hệ thống ▸ Đơn vị phát hành).
 */
/* --------------------------------------------------------------------------
   MẪU MẶC ĐỊNH DO NGƯỜI DÙNG LƯU
   Người dùng sửa nội dung / khung đường viền của một biểu mẫu rồi bấm
   "Lưu thành mẫu mặc định" thì phần sửa được ghi vào _meta.mauMacDinh và
   TỰ ĐỘNG áp dụng cho mọi lần xem trước / in / xuất sau của loại chứng từ
   ấy (chứng từ nào người dùng đã sửa riêng thì bản riêng vẫn ưu tiên).
   Nằm trong CSDL nên còn nguyên sau khi đóng phần mềm và có mặt trong gói
   sao lưu — không phải thiết lập tạm của phiên làm việc.
   -------------------------------------------------------------------------- */
W.mauMacDinh = function (key) {
    var m = DB.data && DB.data._meta && DB.data._meta.mauMacDinh;
    return (m && m[key]) || null;
};
W.luuMauMacDinh = function (key, phan, giaTri) {
    if (!DB.data._meta.mauMacDinh) DB.data._meta.mauMacDinh = {};
    var m = DB.data._meta.mauMacDinh[key] || (DB.data._meta.mauMacDinh[key] = {});
    if (giaTri === null || giaTri === undefined) delete m[phan];
    else m[phan] = giaTri;
    m.luc = new Date().toISOString();
    m.boi = (DB.user() || {}).hoTen || '';
    if (!m.noiDung && !m.vien) delete DB.data._meta.mauMacDinh[key];
    DB.save();
};
/** Nội dung mặc định của LOẠI chứng từ do người dùng đã lưu. */
function ndMau(key, truong) {
    var m = W.mauMacDinh(key);
    var x = m && m.noiDung;
    var v = (x && x[truong]) || '';
    return typeof v === 'string' ? v : '';
}
function noi(r, truong) {
    if (r && r.noiDungRieng && r.noiDungRieng[truong]) return r.noiDungRieng[truong];
    if (r && r[truong]) return r[truong];
    /* chưa có nội dung riêng và chứng từ không có dữ liệu trường này →
       dùng nội dung MẶC ĐỊNH của loại chứng từ nếu người dùng đã lưu */
    return ndMau(W.__KEY, truong) || '';
}
W.noiDungChungTu = noi;
/**
 * Nội dung NGƯỜI DÙNG TỰ VIẾT ở cửa sổ "Sửa nội dung" — chỉ đọc trong
 * noiDungRieng, KHÔNG lấy các trường nghiệp vụ cùng tên của chứng từ.
 * Dùng cho hợp đồng: trường baoHanh của hợp đồng là SỐ THÁNG bảo hành,
 * dieuKhoanTT là câu tóm tắt trên màn hình — không được lấy nhầm hai trường
 * này rồi thay mất cả điều khoản của biểu mẫu.
 */
function noiSua(r, truong) {
    var s = (r && r.noiDungRieng && r.noiDungRieng[truong]) || '';
    if (typeof s === 'string' && s) return s;
    /* chưa sửa riêng → dùng nội dung mặc định của loại chứng từ (nếu có) */
    return ndMau(W.__KEY, truong);
}

/** Cấu hình biểu mẫu chuẩn đang áp dụng. */
function C(k) {
    var c = W.__C;
    if (!c || c[k] === undefined) return T.MAU_CHUAN ? T.MAU_CHUAN[k] !== false : true;
    return c[k] !== false;
}
/** Tổng cộng của một chứng từ — số tiền cuối cùng phải thanh toán. */
function tongChungTu(r) {
    var v = r.tongCong;
    if (v === undefined || v === null || v === '') v = r.thanhTien;
    return Number(v) || 0;
}
/** Bề rộng vùng in của biểu mẫu đang dựng, tính bằng milimét. */
function rongIn(ngang) {
    var c = W.__C || {};
    if (c.leTrai !== undefined && c.lePhai !== undefined) {
        var kho = (c.huong === 'Ngang' || c.huong === 'ngang' || ngang) ? 297 : 210;
        return Math.max(90, kho - Number(c.leTrai) - Number(c.lePhai));
    }
    return ngang ? 267 : 175;
}
W.rongVungIn = rongIn;

/* ==========================================================================
   BẢNG HÀNG HÓA
   Ba biến thể dùng chung một bộ dựng: có cột tiền (chào giá, bán hàng, mua
   hàng, hợp đồng, thanh toán), không cột tiền (xuất kho, giao nhận, nghiệm
   thu) và bảng nhập kho (giá vốn). Bề rộng cột tính theo nội dung thật của
   chính chứng từ đang in.
   ========================================================================== */
function cotSTT() {
    return { k: 'stt', t: 'STT', v: function (l, i) { return String(i + 1); } };
}
function cotDVT() { return { k: 'dvt', t: 'ĐVT', v: function (l) { return l.dvt || ''; } }; }
function cotSL() { return { k: 'sl', t: 'SL', v: function (l) { return T.num(l.soLuong); } }; }

/* ==========================================================================
   BẢNG HÀNG HÓA CỦA BIỂU MẪU GIAO DỊCH
   Dựng đúng bộ cột trên tệp biểu mẫu doanh nghiệp đang dùng.
   ========================================================================== */

/* ==========================================================================
   BÁO GIÁ — DỰNG THEO ĐÚNG TỆP BIỂU MẪU BÁO GIÁ CỦA DOANH NGHIỆP
   --------------------------------------------------------------------------
   Đầu trang và tên biểu mẫu GIỮ NGUYÊN như đang có. Phần thân dựng lại theo
   đúng tệp mẫu: khối thông tin khách hàng bên trái — thông tin báo giá bên
   phải, câu "Kính gửi", bảng chín cột, ba dòng tổng cộng, khối ghi chú và
   tên đơn vị phát hành ở cuối.

   MỌI SỐ LIỆU LẤY TỪ CHÍNH BẢN GHI BÁO GIÁ. Không một con số hàng hóa nào
   viết cứng ở đây; sửa báo giá trong phần mềm là bản in đổi theo ngay.
   ========================================================================== */

/** Model của nhà sản xuất — khác mã nội bộ HH-xxxxxx do phần mềm tự sinh. */
function modelNSX(l) {
    var hh = DB.get('hangHoa', T.idDong(l)) || {};
    return hh.model || l.model || l.maHang || hh.ma || '';
}

/** Nguồn gốc / xuất xứ khai trong danh mục hàng hóa. */
function xuatXuHang(l) {
    var hh = DB.get('hangHoa', T.idDong(l)) || {};
    /* Ưu tiên xuất xứ khai ngay trên dòng báo giá (người lập có thể ghi riêng
       cho lần báo giá này), sau đó mới tới khai báo trong danh mục hàng hóa. */
    return l.xuatXu || hh.xuatXu || hh.nhaSanXuat || hh.thuongHieu ||
           hh.hang || hh.hangSX || '';
}

/**
 * Bảng hàng hóa của BÁO GIÁ — đúng thứ tự cột của tệp biểu mẫu:
 * TT · Nội dung · Model · Nguồn Gốc/Xuất xứ · Đ.vị · SL · Đơn giá ·
 * Thành tiền · Ghi chú, kèm ba dòng tổng cộng nằm ngay trong bảng.
 *
 * Thành tiền từng dòng và ba dòng tổng đều do Business Engine tính
 * (T.tinhTong) — bản in không có phép tính riêng nào, nên không thể lệch với
 * số liệu đang lưu trong phần mềm.
 */
function bangBaoGia(r) {
    var lines = r.lines || [];
    var t = T.tinhTong(lines, ts(r));
    /* Chín cột trên khổ A4 dọc là bố cục chật nhất của cả hệ thống biểu mẫu.
       Vì vậy bảng này khai rõ ngưỡng của từng cột thay vì dùng ngưỡng chung:
         • Tiêu đề cột dài được phép trải hai dòng (dauDong: 2) nên cột không
           phải rộng bằng cả dòng tiêu đề.
         • Cột Model hạ khỏi diện "kín" (kin: false): mã dài tự xuống dòng
           trong ô, không bắt cả bảng nới ra rồi bóp cột khác.
         • Cột Nội dung là cột giãn — mọi bề rộng còn dư dồn hết về đây, nên
           tên hàng dài luôn có chỗ và bảng luôn kín đúng bề ngang vùng in.
         • hep: true — đệm ô 1,2mm mỗi bên, bù lại gần 15mm cho phần chữ. */
    return DDS.bang({
        cot: [
            { k: 'stt', t: 'TT', min: 8, max: 11,
              v: function (l, i) { return String(i + 1); } },
            { k: 'ten', t: 'Nội dung', min: 30, max: 96,
              v: function (l) { return l.tenHang || ''; } },
            { k: 'ma', t: 'Model', cls: 'mdl', clsDau: 'c mdl', kin: false,
              min: 17, max: 36, v: function (l) { return modelNSX(l); } },
            { k: 'chu', t: 'Nguồn Gốc/Xuất xứ', dauDong: 2, min: 18, max: 30,
              v: function (l) { return xuatXuHang(l); } },
            { k: 'dvt', t: 'Đ.vị', min: 10, max: 15,
              v: function (l) { return l.dvt || ''; } },
            { k: 'sl', t: 'SL', min: 11, max: 20,
              v: function (l) { return T.num(l.soLuong); } },
            { k: 'gia', t: 'Đơn giá', dauDong: 2, min: 19, max: 31,
              v: function (l) { return T.money(l.donGia); } },
            { k: 'tien', t: 'Thành tiền', dauDong: 2, min: 21, max: 40,
              v: function (l) { return T.money(dongTien(l)); } },
            { k: 'gc', t: 'Ghi chú', dauDong: 2, min: 13, max: 24,
              v: function (l) { return l.ghiChu || ''; } }
        ],
        rows: lines, rong: rongIn(), cotTien: 7, hep: true,
        tongBang: [
            { ky: '*', ten: 'Tổng giá trị trước thuế', v: T.money(t.thanhTien) },
            { ky: '**', ten: 'Thuế VAT ( ' + T.num(ts(r), 0) + '%)', v: T.money(t.vat) },
            { ky: '***', ten: 'Tổng giá trị sau thuế', v: T.money(t.tongCong), chinh: true }
        ]
    });
}

/**
 * Khối thông tin của BÁO GIÁ: bên trái là khách hàng, bên phải là số báo giá,
 * người lập và ngày. Khách hàng lấy từ bản chụp pháp lý của chứng từ.
 */
function thongTinBaoGia(r, kh) {
    return DDS.khungBen({
        nhan: 'Tên khách hàng:', ten: r.khachHang || '',
        dong: [
            { k: 'Địa chỉ', v: kh.diaChi || '',
              k2: 'Số báo giá', v2: (r.so && C('hienSoChungTu')) ? r.so : '' },
            { k: 'Mã số thuế', v: kh.mst || '',
              k2: 'Người lập', v2: r.nguoiLap || '' },
            { k: 'Điện thoại', v: kh.dienThoai || '',
              k2: 'Ngày', v2: r.ngay ? T.date(r.ngay) : '' }
        ]
    });
}

/* Bảy điều khoản cố định của tệp biểu mẫu báo giá. Đây là VĂN BẢN CỦA BIỂU
   MẪU, không phải dữ liệu nghiệp vụ, nên nằm cùng chỗ với biểu mẫu. */
var GHI_CHU_BAO_GIA = [
    'Đơn giá trên đã bao gồm thuế VAT, chi phí kiểm định phương tiện PCCC.',
    'Đơn giá trên chưa bao gồm chi phí vận chuyển (giao hàng tại kho)',
    'Thời gian giao hàng toàn quốc: 3-7 ngày làm việc (kể từ ngày bên bán nhận ' +
        'được tiền tạm ứng, thanh toán)',
    'Hình thức thanh toán: <b>Bên mua sẽ thanh toán toàn bộ tiền hàng khi có ' +
        'thông báo giao hàng.</b>',
    'Hồ sơ chất lượng bao gồm: CO, CQ (bản sao), giấy kiểm định phương tiện PCCC ' +
        'sao y, biên bản giao hàng, hóa đơn VAT hợp lệ.',
    'Bảo hành: 12 tháng theo tiêu chuẩn nhà sản xuất đối với thiết bị báo cháy.',
    'Báo giá này có hiệu lực 15 ngày kể từ ngày báo giá.'
];

function ghiChuBaoGia(r) {
    var h = '<div class="pr-bgnote"><div class="tt">Ghi chú:</div><ol>' +
        GHI_CHU_BAO_GIA.map(function (x) { return '<li>' + x + '</li>'; }).join('') +
        '</ol>';
    /* Nội dung người dùng khai RIÊNG cho chính báo giá này bằng chức năng
       "Sửa nội dung chứng từ" vẫn phải in ra — bỏ đi là làm mất thông tin đã
       nhập trong phần mềm. Hai khối này đứng riêng BÊN DƯỚI, không chen vào và
       không sửa một chữ nào của bảy điều khoản chuẩn ở trên. */
    var dk = noi(r, 'dieuKhoan');
    if (dk) h += '<div class="rieng">' + T.esc(dk) + '</div>';
    var rieng = noi(r, 'ghiChu');
    if (rieng) h += '<div class="rieng">' + T.esc(rieng) + '</div>';
    return h + '</div>';
}

/** Tên đơn vị phát hành ở cuối báo giá — lấy từ đơn vị phát hành chứng từ. */
function chanBaoGia(cty) {
    return '<div class="pr-bgcty">' + T.esc((cty.ten || '').toUpperCase()) + '</div>';
}

/**
 * Bảng hàng hóa của ĐƠN ĐẶT HÀNG — đúng biểu mẫu doanh nghiệp:
 * STT · TÊN THIẾT BỊ · MODEL · SỐ LƯỢNG · ĐƠN GIÁ · THÀNH TIỀN · GHI CHÚ,
 * kèm ba dòng tổng cộng nằm ngay trong bảng: trước thuế · VAT · sau thuế.
 */
function bangHangDN(r) {
    var dg = C('hienDonGia'), tt = C('hienThanhTien');
    var cot = [
        cotSTT(),
        { k: 'ten', t: 'Tên thiết bị', v: function (l) { return l.tenHang || ''; } },
        { k: 'ma', t: 'Model', v: function (l) { return model(l); } },
        { k: 'sl', t: 'Số lượng', v: function (l) { return T.num(l.soLuong); } }
    ];
    if (dg) cot.push({ k: 'gia', t: 'Đơn giá', v: function (l) { return T.money(l.donGia); } });
    if (tt) cot.push({ k: 'tien', t: 'Thành tiền', v: function (l) { return T.money(dongTien(l)); } });
    var iTien = cot.length - 1;
    cot.push({ k: 'gc', t: 'Ghi chú', min: 16, max: 26,
               v: function (l) { return l.ghiChu || ''; } });

    var o = { cot: cot, rows: r.lines || [], rong: rongIn() };
    if (tt) {
        o.cotTien = iTien;
        o.tongBang = [
            { ky: '*', ten: 'Tổng giá trị trước thuế', v: T.money(r.thanhTien) },
            { ky: '**', ten: 'Thuế giá trị gia tăng ' + T.num(ts(r), 1) + '%', v: T.money(r.vat) },
            { ky: '***', ten: 'Tổng giá trị sau thuế', v: T.money(tongChungTu(r)), chinh: true }
        ];
    }
    return DDS.bang(o);
}

/**
 * Bảng hàng hóa của BIÊN BẢN GIAO HÀNG — đúng biểu mẫu doanh nghiệp:
 * Stt · Danh mục · Model · Thương hiệu / Xuất xứ · Đơn vị · Số lượng · Ghi chú.
 */
function bangGiaoDN(r) {
    return DDS.bang({
        cot: [
            cotSTT(),
            { k: 'ten', t: 'Danh mục', v: function (l) { return l.tenHang || ''; } },
            { k: 'ma', t: 'Model', v: function (l) { return model(l); } },
            { k: 'chu', t: 'Thương hiệu / Xuất xứ', dauDong: 2, min: 27, max: 34,
              v: function (l) { var hh = T.hh(l) || {}; return hh.hangSX || hh.xuatXu || ''; } },
            cotDVT(),
            { k: 'sl', t: 'Số lượng', v: function (l) { return T.num(l.soLuong); } },
            { k: 'gc', t: 'Ghi chú', v: function (l) { return l.ghiChu || ''; } }
        ],
        rows: r.lines || [], rong: rongIn()
    });
}

/** Bảng hàng hóa CÓ cột tiền. */
function bangTien(r) {
    var dg = C('hienDonGia'), tt = C('hienThanhTien'), th = C('hienThue');
    var cot = [
        cotSTT(),
        { k: 'ten', t: 'Tên thiết bị', v: function (l) { return l.tenHang || ''; } },
        { k: 'ma', t: 'Mã hiệu', v: function (l) { return model(l); } },
        cotDVT(), cotSL()
    ];
    if (dg) cot.push({ k: 'gia', t: 'Đơn giá', v: function (l) { return T.money(l.donGia); } });
    if (tt) cot.push({ k: 'tien', t: 'Thành tiền', v: function (l) { return T.money(dongTien(l)); } });

    var h = DDS.bang({ cot: cot, rows: r.lines || [], rong: rongIn() });
    if (!tt) return h;

    var tong = tongChungTu(r);
    /* Khối tổng cộng là một khối riêng, canh phải, không phải dòng cuối bảng.
       Mặc định biểu mẫu KHÔNG tách thuế: chỉ một dòng TỔNG CỘNG cho gọn và cân
       đối. Hệ thống vẫn lưu và xử lý thuế đầy đủ theo nghiệp vụ; mẫu nào bắt
       buộc thể hiện VAT thì bật lại trong cấu hình biểu mẫu chuẩn. */
    h += DDS.tong(th
        ? [{ k: 'Tổng giá trị trước thuế', v: T.money(r.thanhTien) },
           { k: 'Thuế giá trị gia tăng ' + T.num(ts(r), 1) + '%', v: T.money(r.vat) },
           { k: 'TỔNG CỘNG', v: T.money(tong) + ' đồng', chinh: true }]
        : [{ k: 'TỔNG CỘNG', v: T.money(tong) + ' đồng', chinh: true }]);
    if (C('hienTienBangChu')) h += DDS.bangChu(tong, 'Bằng chữ:');
    return h;
}

/** Bảng hàng hóa KHÔNG cột tiền. */
function bangKhongTien(r) {
    return DDS.bang({
        cot: [
            cotSTT(),
            { k: 'ten', t: 'Tên hàng hóa', v: function (l) { return l.tenHang || ''; } },
            { k: 'ma', t: 'Mã hiệu', v: function (l) { return model(l); } },
            cotDVT(), cotSL(),
            { k: 'gc', t: 'Ghi chú', v: function (l) { return l.ghiChu || ''; } }
        ],
        rows: r.lines || [], rong: rongIn()
    });
}

/** Bảng dòng hàng của Phiếu nhập kho — cột giá vốn nhập kho. */
function bangNhapKho(r) {
    var dg = C('hienDonGia'), tt = C('hienThanhTien');
    var cot = [
        cotSTT(),
        { k: 'ma', t: 'Mã hàng', v: function (l) { return l.maHang || ''; } },
        { k: 'ten', t: 'Tên hàng hóa', v: function (l) { return l.tenHang || ''; } },
        cotDVT(), cotSL()
    ];
    if (dg) cot.push({ k: 'gia', t: 'Giá vốn', v: function (l) { return T.money(l.giaVon); } });
    if (tt) cot.push({ k: 'tien', t: 'Thành tiền', v: function (l) { return T.money(l.thanhTien); } });
    var h = DDS.bang({ cot: cot, rows: r.lines || [], rong: rongIn() });
    if (tt) h += DDS.tong([{ k: 'TỔNG CỘNG', v: T.money(r.tongTien) + ' đồng', chinh: true }]);
    return h;
}

/* ==========================================================================
   KHỐI THÔNG TIN CÁC BÊN
   ========================================================================== */
function benBan(cty) {
    return DDS.benChuan('Bên bán', {
        ten: cty.ten, diaChi: cty.diaChi, mst: cty.mst, dienThoai: cty.dienThoai,
        nganHang: cty.nganHang, daiDien: cty.daiDien, chucVu: cty.chucVu
    });
}
function benMua(kh, r, nhan, giu) {
    return DDS.benChuan(nhan || 'Bên mua', {
        ten: (r && r.khachHang) || kh.ten || '', diaChi: kh.diaChi, mst: kh.mst,
        dienThoai: kh.dienThoai, daiDien: kh.nguoiLienHe, chucVu: kh.chucVu, giu: giu
    });
}
function benNCC(ncc, r) {
    return DDS.benChuan('Nhà cung cấp', {
        ten: (r && r.nhaCungCap) || ncc.ten || '', diaChi: ncc.diaChi, mst: ncc.mst,
        dienThoai: ncc.dienThoai, daiDien: ncc.nguoiLienHe, chucVu: ncc.chucVu
    });
}

/* ==========================================================================
   CÁC DÒNG PHỤ ẨN / HIỆN THEO MẪU
   ========================================================================== */
function dongNguoiLap(r) {
    return r.nguoiLap
        ? '<div class="pr-note">Người lập chứng từ: ' + T.esc(r.nguoiLap) + '</div>' : '';
}
function dongMaGD(r) {
    if (!C('hienMaGiaoDich') || !r.maGD) return '';
    return '<div class="pr-note">Mã giao dịch: ' + T.esc(r.maGD) + '</div>';
}
function dongDuAn(r, nhan) {
    if (!C('hienDuAn') || !r.duAn) return '';
    return '<div class="pr-l"><b>' + (nhan || 'Công trình / dự án') + ':</b> ' + T.esc(r.duAn) + '</div>';
}
function dongGhiChu(r) {
    var v = noi(r, 'ghiChu');
    if (!C('hienGhiChu') || !v) return '';
    return '<div class="pr-note"><b>Ghi chú:</b> ' + T.esc(v) + '</div>';
}

/* ==========================================================================
   ĐIỀU KHOẢN CỦA BỘ HỒ SƠ BÁN HÀNG
   Báo giá và Đơn đặt hàng dùng CHUNG bộ điều khoản này nên hai biểu mẫu đồng
   bộ tuyệt đối về bố cục, chỉ khác câu chữ nghiệp vụ. Điều khoản riêng của
   doanh nghiệp khai ở Thiết lập doanh nghiệp (Hệ thống ▸ Đơn vị phát hành)
   hoặc nhập thẳng trên chính chứng từ; không có phân hệ thư viện riêng.
   ========================================================================== */
function dieuKhoanBanHang(r, cty, loai) {
    var c = W.__C || {};
    var rieng = noi(r, 'dieuKhoan') || c.dieuKhoanMacDinh || '';
    var tt = noi(r, 'dieuKhoanTT');
    var dat = loai === 'donBan';
    var giao = [];
    if (dat) {
        giao.push(r.ngayGiao
            ? '<b>Thời gian giao hàng:</b> ' + T.esc(T.date(r.ngayGiao)) + '.'
            : '<b>Thời gian giao hàng:</b> 3-7 ngày làm việc kể từ ngày hai bên chốt đơn hàng.');
        giao.push(r.diaDiemGiao
            ? '<b>Địa điểm giao hàng:</b> ' + T.esc(r.diaDiemGiao) + '.'
            : '<b>Địa điểm giao hàng:</b> theo thỏa thuận của hai bên.');
    } else {
        giao.push('<b>Thời gian giao hàng toàn quốc: 3-7 ngày làm việc</b> (kể từ khi Bên bán nhận được tạm ứng, thanh toán).');
        giao.push('<b>Địa điểm giao hàng:</b> hàng giao tại kho của Bên bán.');
    }

    return DDS.mucDieu(2, 'CHI PHÍ - HỒ SƠ - GIAO NHẬN - BẢO HÀNH') +
        DDS.gach([
            rieng ? T.esc(rieng) : '',
            'Đơn giá trên đã bao gồm thuế giá trị gia tăng ' + T.num(ts(r), 1) + '%.',
            'Đơn giá trên đã bao gồm chi phí kiểm định, chưa bao gồm chi phí vận chuyển.'
        ].concat(giao).concat([
            '<b>Hồ sơ chất lượng bao gồm:</b> CO, CQ (bản sao), giấy kiểm định phương tiện ' +
                'phòng cháy chữa cháy (bản sao), biên bản giao hàng, hóa đơn giá trị gia tăng hợp lệ.',
            '<b>Bảo hành:</b> ' + (r.baoHanh || 12) + ' tháng theo tiêu chuẩn nhà sản xuất.'
        ])) +
        DDS.mucDieu(3, 'ĐIỀU KHOẢN THANH TOÁN') +
        DDS.gach([
            tt ? T.esc(tt)
               : (dat ? '<b>Bên mua thanh toán theo tiến độ hai bên đã thỏa thuận</b>, thanh toán hết giá trị đơn hàng trước khi nhận đủ hàng.'
                      : '<b>Bên mua có trách nhiệm thanh toán 100% giá trị đơn hàng cho Bên bán khi có thông báo giao hàng.</b>'),
            'Hình thức thanh toán: tiền mặt hoặc chuyển khoản.'
        ]) +
        '<div class="pr-tk">Đơn vị thụ hưởng: <b>' + T.esc(cty.ten) + '</b></div>' +
        (cty.nganHang ? '<div class="pr-tk">Tài khoản: <b>' + T.esc(cty.nganHang) + '</b></div>' : '') +
        DDS.mucDieu(4, 'ĐIỀU KHOẢN CHUNG') +
        '<div class="pr-l">' +
        (dat
            ? 'Đơn đặt hàng này là một bộ phận không thể tách rời của thỏa thuận giữa hai bên; '
            : 'Xác nhận đơn hàng và thông báo nhận hàng (nếu có) này là một bộ phận không thể tách rời ' +
              'của hợp đồng nguyên tắc số: được ký bản gốc hay qua Fax, Email đều có giá trị pháp lý ' +
              'như nhau để cùng thực hiện. ') +
        'Hai bên cam kết thực hiện đúng các nội dung đã thỏa thuận; việc phát sinh ngoài văn bản này ' +
        'được hai bên bàn bạc giải quyết trên tinh thần hợp tác.' +
        (dat ? ' Đơn đặt hàng được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.' : '') +
        '</div>';
}


/* ==========================================================================
   BIỂU MẪU HỢP ĐỒNG — DỰNG THEO LOẠI HỢP ĐỒNG TRONG DANH MỤC
   --------------------------------------------------------------------------
   Dựng lại ĐÚNG tệp hợp đồng doanh nghiệp đang dùng:
     tên đơn vị · bộ phận · số hợp đồng bên trái — quốc hiệu, tiêu ngữ và địa
     danh, ngày tháng bên phải → tên hợp đồng in hoa giữa trang kèm trích yếu
     → các căn cứ pháp lý → câu mở đầu → khối BÊN MUA và BÊN BÁN → câu chốt →
     bộ điều — khoản — điểm → khối ký hai bên.
   Tiêu đề, trích yếu, căn cứ, nhãn hai bên và toàn bộ điều khoản lấy từ bản
   ghi "Loại hợp đồng" nên thêm loại mới trong danh mục là in được ngay.
   ========================================================================== */

/** Một bên của hợp đồng — các dòng nhãn : giá trị theo đúng mẫu giấy. */
function benHopDong(nhan, ten, dong, chu) {
    var d = (dong || []).filter(function (x) { return x && x.k; });
    return '<div class="pr-hdben">' +
        '<div class="n">' + T.esc(nhan) + (ten ? ': <b>' + T.esc(ten) + '</b>' : ':') + '</div>' +
        d.map(function (x) {
            return '<div class="r"><span class="k">' + T.esc(x.k) + '</span>' +
                '<span class="v">' + T.esc(x.v || '') + '</span>' +
                (x.k2 ? '<span class="k2">' + T.esc(x.k2) + '</span>' +
                        '<span class="v2">' + T.esc(x.v2 || '') + '</span>' : '') + '</div>';
        }).join('') +
        (chu ? '<div class="c">(Sau đây gọi tắt là ' + T.esc(chu) + ')</div>' : '') +
        '</div>';
}

/** Dựng toàn bộ thân biểu mẫu hợp đồng. */
/* Một đoạn văn người dùng tự viết — mỗi dòng xuống dòng là một đoạn in riêng. */
function doanNguoiDung(s) {
    return String(s || '').split(/\r?\n/).filter(function (x) { return x.trim(); })
        .map(function (x) { return '<div class="pr-l">' + T.esc(x.trim()) + '</div>'; }).join('');
}
function dongGiaTriHD(tong) {
    return '<div class="pr-l"><b>Giá trị hợp đồng:</b> Tổng giá trị hợp đồng đã bao gồm thuế ' +
        'giá trị gia tăng là: <b>' + T.money(tong) + ' đồng</b> (Số tiền bằng chữ: <i>' +
        T.esc(T.docTien(tong)) + '</i>).</div>';
}
/* Vai trò của điều  →  trường "Sửa nội dung" tương ứng. */
var VAI_ND = { phamVi: 'phamVi', thanhToan: 'dieuKhoanTT', baoHanh: 'baoHanh', phat: 'phat' };
/* Loại hợp đồng cũ chưa khai vai trò thì suy ra theo tên điều. */
function vaiTheoTen(ten) {
    var s = T.kd(ten || '');
    if (s.indexOf('pham vi') >= 0) return 'phamVi';
    if (s.indexOf('thanh toan') >= 0) return 'thanhToan';
    if (s.indexOf('bao hanh') >= 0) return 'baoHanh';
    if (s.indexOf('phat hop dong') >= 0) return 'phat';
    return '';
}

function hopDongHTML(r, cty, kh, CH) {
    var L = T.loaiHDCua(r) || {};
    function g(s) { return T.ghepHD(s, r, cty, kh); }
    var tong = tongChungTu(r) || Number(r.giaTri) || 0;

    /* --- Đầu trang: đơn vị · bộ phận · số hợp đồng | quốc hiệu · ngày tháng --- */
    var h = '<table class="pr-cv pr-hddau"><colgroup><col style="width:40%"><col></colgroup><tbody>' +
        '<tr><td><div class="dv">' + T.esc(cty.ten) + '</div>' +
        (L.boPhan ? '<div class="bp">' + T.esc(L.boPhan) + '</div>' : '') +
        '<div class="o">-----------------------</div>' +
        ((r.so && C('hienSoChungTu')) ? '<div class="so">Số: ' + T.esc(r.so) + '</div>' : '') + '</td>' +
        '<td><div class="qh">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>' +
        '<div class="tn">Độc lập – Tự do – Hạnh phúc</div>' +
        '<div class="o">------o0o------</div>' +
        '<div class="ng">' + T.esc(diaDanh(cty)) + ', ' + T.esc(ngayVN(r.ngay).toLowerCase()) + '</div>' +
        '</td></tr></tbody></table>';

    /* --- Tên hợp đồng và trích yếu --- */
    h += '<div class="pr-tieu2"><h1>' + T.esc(L.tieuDe || 'HỢP ĐỒNG') + '</h1>' +
        (L.vv ? '<div class="vv">(' + T.esc(g(L.vv)) + ')</div>' : '') + '</div>';

    /* --- Căn cứ pháp lý --- */
    if ((L.canCu || []).length)
        h += DDS.gach((L.canCu || []).map(function (x) { return T.esc(g(x)); }));

    /* --- Câu mở đầu --- */
    if (L.moDau) h += '<div class="pr-l">' + T.esc(g(L.moDau)) + '</div>';

    /* --- Hai bên --- */
    h += benHopDong(L.nhanA || 'BÊN MUA', r.khachHang || kh.ten || '', [
            { k: 'Đại diện', v: kh.nguoiLienHe || '', k2: 'Chức vụ', v2: kh.chucVu || '' },
            { k: 'Địa chỉ', v: kh.diaChi || '' },
            { k: 'Điện thoại', v: kh.dienThoai || '', k2: 'Mã số thuế', v2: kh.mst || '' },
            { k: 'Tài khoản', v: kh.nganHang || '' }
        ], 'Bên A') +
        benHopDong(L.nhanB || 'BÊN BÁN', cty.ten, [
            { k: 'Đại diện', v: cty.daiDien || '', k2: 'Chức vụ', v2: cty.chucVu || '' },
            { k: 'Địa chỉ', v: cty.diaChi || '' },
            { k: 'Điện thoại', v: cty.dienThoai || '', k2: 'Mã số thuế', v2: cty.mst || '' },
            { k: 'Tài khoản', v: cty.nganHang || '' }
        ], 'Bên B');
    if (r.duAn) h += '<div class="pr-l"><b>Công trình / dự án:</b> ' + T.esc(r.duAn) + '</div>';
    if (L.chot) h += '<div class="pr-l">' + T.esc(g(L.chot)) + '</div>';
    /* Đoạn dẫn nhập người dùng tự viết cho riêng hợp đồng này. */
    if (noiSua(r, 'noiDung')) h += doanNguoiDung(noiSua(r, 'noiDung'));

    /* --- Bộ điều — khoản — điểm --- */
    var hoa = (L.kieuDieu || 'hoa') === 'hoa';
    (L.dieu || []).forEach(function (d, i) {
        var ten = g(d.ten || '');
        h += '<div class="pr-hdmuc' + (hoa ? ' hoa' : '') + '">Điều ' + (i + 1) + ': ' +
             T.esc(hoa ? ten.toUpperCase() : ten) + '</div>';
        /* NGƯỜI DÙNG SỬA TRỰC TIẾP: điều nào được khai vai trò (phạm vi công
           việc, thanh toán, bảo hành, phạt) và người lập đã viết lại nội dung
           thì in đúng nội dung đã viết, thay cho câu chữ mặc định của loại. */
        var vt = VAI_ND[d.vai || vaiTheoTen(d.ten)];
        var sua = vt ? noiSua(r, vt) : '';
        if (sua) {
            h += doanNguoiDung(sua);
            if (d.bangHang && L.coBangHang !== false && (r.lines || []).length) h += bangHangDN(r);
            if (d.giaTri && L.coGiaTri !== false) h += dongGiaTriHD(tong);
            return;
        }
        (d.p || []).forEach(function (x) { h += '<div class="pr-l">' + T.esc(g(x)) + '</div>'; });
        if ((d.y || []).length)
            h += DDS.gach((d.y || []).map(function (x) { return T.esc(g(x)); }));
        /* Bảng hàng hóa và giá trị hợp đồng chỉ in ở điều được khai. */
        if (d.bangHang && L.coBangHang !== false && (r.lines || []).length)
            h += bangHangDN(r);
        if (d.giaTri && L.coGiaTri !== false) h += dongGiaTriHD(tong);
        (d.khoan || []).forEach(function (k) {
            if (k.so || k.ten)
                h += '<div class="pr-hdkhoan">' + T.esc(((k.so || '') + ' ' + g(k.ten || '')).trim()) + '</div>';
            if ((k.y || []).length)
                h += DDS.gach((k.y || []).map(function (x) { return T.esc(g(x)); }));
            if ((k.diem || []).length)
                h += '<div class="pr-hddiem">' + (k.diem || []).map(function (x) {
                    return '<div>' + T.esc(g(x)) + '</div>'; }).join('') + '</div>';
        });
    });

    /* --- Nội dung người dùng tự viết thêm cho riêng hợp đồng này --- */
    var soDieu = (L.dieu || []).length;
    [{ v: noiSua(r, 'dieuKhoan'), t: 'Điều khoản bổ sung' },
     { v: noiSua(r, 'khac'), t: 'Điều khoản khác' }].forEach(function (x) {
        if (!x.v) return;
        soDieu++;
        h += '<div class="pr-hdmuc' + (hoa ? ' hoa' : '') + '">Điều ' + soDieu + ': ' +
             T.esc(hoa ? x.t.toUpperCase() : x.t) + '</div>' + doanNguoiDung(x.v);
    });
    h += dongGhiChu(r) + dongMaGD(r) +
        DDS.kyDN('ĐẠI DIỆN BÊN A', 'ĐẠI DIỆN BÊN B', kyDonVi(cty));
    h += (CH.hienChanTrang === false ? '' : DDS.chanTrang(cty, CH, r.so || '')) + '</div>';
    return h;
}


/* ==========================================================================
   BIÊN BẢN NGHIỆM THU — HAI MẪU CỦA DOANH NGHIỆP
   --------------------------------------------------------------------------
   Mẫu được chọn theo LOẠI HỢP ĐỒNG của hợp đồng gốc; chứng từ nào chưa gắn
   hợp đồng thì dùng mẫu ghi trên chính biên bản.
   ========================================================================== */
function nghiemThuHTML(r, cty, kh, CH) {
    var laGT = (r.mauNT || 'KL') === 'GT';
    var tong = tongChungTu(r);

    /* --- Quốc hiệu, tiêu ngữ và dòng địa danh — ngày tháng --- */
    var h = '<div class="pr-ntdau">' +
        '<div class="qh">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>' +
        '<div class="tn">Độc lập – Tự do – Hạnh phúc</div>' +
        '<div class="o">…***…</div></div>' +
        '<div class="pr-ngay">' + T.esc(diaDanh(cty)) + ', ' +
        T.esc(ngayVN(r.ngay).toLowerCase()) + '.</div>' +
        DDS.tieuDeDN({
            tieu: laGT ? 'BIÊN BẢN NGHIỆM THU GIÁ TRỊ THANH TOÁN'
                       : 'BIÊN BẢN NGHIỆM THU LẮP ĐẶT HOÀN THÀNH',
            so: (r.so && C('hienSoChungTu')) ? r.so : ''
        });

    /* --- Căn cứ --- */
    h += DDS.gach([
        'Căn cứ công việc thi công hoàn thành tại hiện trường.',
        r.hopDongSo ? 'Căn cứ hợp đồng số ' + T.esc(r.hopDongSo) + '.' : '',
        r.bienBanGiaoSo ? 'Căn cứ biên bản giao hàng số ' + T.esc(r.bienBanGiaoSo) + '.' : '',
        r.duAn ? 'Công trình: ' + T.esc(r.duAn) + '.' : ''
    ]);
    h += '<div class="pr-l">Hôm nay, ' + T.esc(ngayVN(r.ngay).toLowerCase()) +
         ', tại công trình bên A, chúng tôi gồm:</div>';

    /* --- Thành phần hai bên --- */
    function ben(nhan, ten, ds) {
        return '<div class="pr-ntben"><div class="n">' + T.esc(nhan) +
            (ten ? ': <b>' + T.esc(ten) + '</b>' : ':') + '</div>' +
            ds.map(function (x) {
                return '<div class="r"><span class="k">Ông / Bà</span>' +
                    '<span class="v">' + T.esc(x.t || '') + '</span>' +
                    '<span class="k2">Chức vụ</span>' +
                    '<span class="v2">' + T.esc(x.c || '') + '</span></div>';
            }).join('') + '</div>';
    }
    h += ben('ĐẠI DIỆN BÊN A', r.khachHang || kh.ten || '',
             [{ t: r.thanhPhanA || kh.nguoiLienHe || '', c: kh.chucVu || '' }, { t: '', c: '' }]) +
         ben('ĐẠI DIỆN BÊN B', cty.ten,
             [{ t: r.thanhPhanB || cty.daiDien || '', c: cty.chucVu || '' }, { t: '', c: '' }]);
    h += noiSua(r, 'noiDung') ? doanNguoiDung(noiSua(r, 'noiDung'))
        : ('<div class="pr-l">Hai bên tiến hành kiểm tra khối lượng ' +
           (laGT ? 'và giá trị ' : '') + 'thực tế làm tại hiện trường và đi đến thống nhất ' +
           'nội dung như sau:</div>');

    /* --- 1. Khối lượng đã thực hiện --- */
    h += '<div class="pr-muc2">1. Khối lượng đã thực hiện:</div>' +
         (laGT ? bangNTGiaTri(r) : bangNTKhoiLuong(r));
    if (laGT && C('hienTienBangChu'))
        h += '<div class="pr-chu"><b>Bằng chữ:</b> ' + T.esc(T.docTien(tong)) + '</div>';

    /* --- 2. Kết luận --- */
    h += '<div class="pr-muc2">2. Kết luận:</div>' +
        doanNguoiDung(noi(r, 'ketLuan') || r.ketLuan ||
            (laGT ? 'Bên A đồng ý xác nhận khối lượng và giá trị nêu trên, để làm cơ sở cho Bên B thanh toán.'
                  : 'Bên A đồng ý xác nhận khối lượng nêu trên đưa vào sử dụng và làm cơ sở thanh toán.')) +
        '<div class="pr-l">Biên bản được lập thành 04 (bốn) bản có giá trị như nhau. ' +
        'Mỗi bên giữ 02 (hai) bản./.</div>' +
        dongGhiChu(r) + dongMaGD(r) +
        DDS.kyDN('ĐẠI DIỆN BÊN A', 'ĐẠI DIỆN BÊN B', kyDonVi(cty));
    h += (CH.hienChanTrang === false ? '' : DDS.chanTrang(cty, CH, r.so || '')) + '</div>';
    return h;
}

/** Bảng khối lượng của biên bản nghiệm thu lắp đặt hoàn thành. */
function bangNTKhoiLuong(r) {
    return DDS.bang({
        cot: [
            cotSTT(),
            { k: 'ten', t: 'Nội dung công việc', v: function (l) { return l.tenHang || ''; } },
            cotDVT(),
            { k: 'sl', t: 'Số lượng theo báo giá', dauDong: 2, min: 26,
              v: function (l) { return T.num(l.soLuong); } },
            { k: 'sl', t: 'Khối lượng nghiệm thu', dauDong: 2, min: 26,
              v: function (l) { return T.num(l.soLuongNT === undefined ? l.soLuong : l.soLuongNT); } }
        ],
        rows: r.lines || [], rong: rongIn()
    });
}

/** Bảng khối lượng và giá trị của biên bản nghiệm thu giá trị thanh toán. */
function bangNTGiaTri(r) {
    var cot = [
        cotSTT(),
        { k: 'ten', t: 'Nội dung công việc', v: function (l) { return l.tenHang || ''; } },
        cotDVT(),
        { k: 'sl', t: 'Số lượng', v: function (l) { return T.num(l.soLuong); } },
        { k: 'gia', t: 'Đơn giá', v: function (l) { return T.money(l.donGia); } },
        { k: 'tien', t: 'Thành tiền', v: function (l) { return T.money(dongTien(l)); } }
    ];
    var iTien = cot.length - 1;
    cot.push({ k: 'gc', t: 'Ghi chú', min: 16, max: 26,
               v: function (l) { return l.ghiChu || ''; } });
    return DDS.bang({
        cot: cot, rows: r.lines || [], rong: rongIn(), cotTien: iTien,
        tongBang: [{ ky: '*', ten: 'Cộng đã bao gồm thuế giá trị gia tăng',
                     v: T.money(tongChungTu(r)), chinh: true }]
    });
}

/* ==========================================================================
   KHỐI CHỮ KÝ
   Chức danh, người ký và công ty ký đều lấy từ cấu hình mẫu và từ hồ sơ đơn
   vị — biểu mẫu không in cứng tên bất kỳ ai.
   ========================================================================== */
function kyHaiBen(trai, phai, cty, dTrai) {
    var c = W.__C || {};
    return DDS.ky([
        { r: trai, d: dTrai || '(Ký, ghi rõ họ tên)' },
        { r: phai, d: '(Ký, ghi rõ họ tên, đóng dấu)',
          dau: c.hienDauCongTy !== false ? (cty.conDau || c.anhDau) : '',
          ky: cty.chuKy || c.anhChuKy }
    ]);
}

/**
 * Bỏ động từ mở đầu trùng lặp của Nội dung thanh toán.
 * Câu công văn đã có sẵn "kính đề nghị Quý … thanh toán"; nội dung người lập
 * gõ thường bắt đầu bằng chính động từ đó nên phải cắt để câu không lặp.
 */
function boDongTu(v) {
    var t = String(v || '').trim();
    if (!t) return '';
    t = t.replace(/^(thanh\s*toán|tạm\s*ứng|đề\s*nghị\s*thanh\s*toán|đề\s*nghị\s*tạm\s*ứng)\s+/i, '');
    return t.replace(/\s*\.\s*$/, '');
}

/**
 * Chữ ký, con dấu và tên người ký của ĐƠN VỊ PHÁT HÀNH — dùng cho ô ký bên
 * phải của các biểu mẫu giao dịch. Người ký lấy từ danh mục Người ký của
 * chính pháp nhân; chưa khai thì lấy người đại diện trong hồ sơ đơn vị.
 * Biểu mẫu không in cứng tên bất kỳ ai.
 */
function kyDonVi(cty) {
    var c = W.__C || {};
    return {
        dau: c.hienDauCongTy !== false ? (cty.conDau || c.anhDau) : '',
        ky: cty.chuKy || c.anhChuKy
    };
}

/* ==========================================================================
   KHUNG BÁO CÁO CHUẨN — dùng chung cho MỌI báo cáo và danh sách in ra
   Không in dữ liệu thô: mọi báo cáo đều có đầu trang doanh nghiệp, tiêu đề,
   khối điều kiện lọc, bảng dữ liệu, dòng tổng cộng, khối chữ ký, chân trang
   và đánh số trang — cùng một ngôn ngữ thiết kế với chứng từ.
   ========================================================================== */
W.dungBaoCao = function (o) {
    var cty = o.cty || DB.cty();
    var CH = T.cauHinhIn(cty);
    W.__C = CH;
    var cols = (o.cols || []).filter(function (c) { return !c.an; });
    var rows = o.rows || [];
    var gioiHan = o.gioiHan || 1000;
    var hienThi = rows.slice(0, gioiHan);
    var ngang = o.land !== false;
    var nv = (W.Q && W.Q.nhanVienCuaToi && W.Q.nhanVienCuaToi()) || {};
    var nguoiLap = o.nguoiLap || nv.hoTen || DB.user().hoTen || '';
    var dk = (o.dieuKien || []).filter(function (x) {
        return x && x.v !== '' && x.v !== undefined && x.v !== null;
    });

    var h = '<div class="print-sheet' + (ngang ? ' landscape' : '') + '"' + W.kieuMau(CH) + '>' +
        DDS.dauTrang(cty, CH) +
        DDS.tieuDe({ eyebrow: 'Báo cáo quản trị', tieu: String(o.tieu || '').toUpperCase(),
                     phu: o.phu || '' });

    /* Khối điều kiện lọc — báo cáo phải nói rõ đang lọc theo điều kiện nào */
    h += '<div class="pr-meta">' +
        (o.tu || o.den
            ? '<div><b>Kỳ báo cáo:</b> ' +
              (o.tu ? 'từ ngày ' + T.date(o.tu) : 'từ đầu') +
              (o.den ? ' đến ngày ' + T.date(o.den) : ' đến nay') + '</div>'
            : '<div><b>Thời điểm:</b> ' + T.date(o.thoiDiem || T.today()) + '</div>') +
        dk.map(function (x) {
            return '<div><b>' + T.esc(x.t) + ':</b> ' + T.esc(x.v) + '</div>';
        }).join('') +
        '<div><b>Số dòng dữ liệu:</b> ' + T.num(rows.length, 0) + '</div>' +
        '<div><b>Người lập biểu:</b> ' + T.esc(nguoiLap) + '</div>' +
        '<div><b>Ngày in:</b> ' + T.date(T.today()) + '</div>' +
        '</div>';

    /* Bảng dữ liệu — cùng bộ dựng với bảng hàng hóa của chứng từ */
    function oCua(c, r) {
        var v = c.v ? c.v(r) : r[c.k];
        if (typeof v === 'number') return T.money(v);
        return v === undefined || v === null ? '' : String(v);
    }
    var soCot = cols.map(function (c) {
        if (c.cls === 'n' || c.tong) return true;
        for (var i = 0; i < Math.min(rows.length, 30); i++) {
            var v = c.v ? c.v(rows[i]) : rows[i][c.k];
            if (v !== undefined && v !== null && v !== '') return typeof v === 'number';
        }
        return false;
    });
    var cot = [{ k: 'stt', t: 'TT', v: function (r, i) { return String(i + 1); } }];
    cols.forEach(function (c, j) {
        var w = c.w ? Number(c.w) : 0;
        cot.push({
            /* Bề rộng báo cáo khai là mức TỐI THIỂU: cột vẫn được nở thêm vừa
               đủ cho nội dung thật, nhưng phần giấy dư thì dồn cho cột chữ dài
               chứ không chia đều — nhờ vậy không có cột nào phình ra vô lý và
               cũng không có cột nào bị bóp làm gãy chữ. */
            k: soCot[j] ? 'tien' : (w ? 'chu' : 'mota'),
            t: c.t,
            cls: c.cls || (soCot[j] ? 'n' : (w && w <= 22 ? 'c' : '')),
            min: w || undefined,
            max: w ? Math.max(Math.round(w * 1.6), w + 14) : (soCot[j] ? undefined : 999),
            gian: !w && !soCot[j],
            v: function (r) { return oCua(c, r); },
            h: c.r ? function (r) {
                var v = c.v ? c.v(r) : r[c.k];
                return c.r(v, r);
            } : null
        });
    });

    /* Dòng tổng cộng của báo cáo cộng thẳng dưới đúng cột số liệu của nó */
    var coTong = cols.some(function (c) { return c.tong; });
    var tfoot = '';
    if (coTong) {
        tfoot = '<tr class="sum"><td class="c"></td>' + cols.map(function (c, j) {
            if (!c.tong) return '<td class="' + (cot[j + 1].cls || '') + '">' +
                                 (j === 0 ? 'TỔNG CỘNG' : '') + '</td>';
            var t = T.sum(rows, function (r) { return Number(c.v ? c.v(r) : r[c.k]) || 0; });
            return '<td class="n">' + (c.tongLa === 'num' ? T.num(t, 0) : T.money(t)) + '</td>';
        }).join('') + '</tr>';
    }
    h += DDS.bang({ cot: cot, rows: hienThi, rong: rongIn(ngang), tfoot: tfoot });

    if (rows.length > gioiHan)
        h += '<div class="pr-note">Bản in giới hạn ' + T.num(gioiHan, 0) + ' dòng đầu trên tổng số ' +
             T.num(rows.length, 0) + ' dòng. Dùng chức năng Xuất Excel để lấy đầy đủ dữ liệu.</div>';
    if (o.ghiChu) h += '<div class="pr-note">' + o.ghiChu + '</div>';
    if (o.tienChu) h += '<div class="pr-words">' + o.tienChu + '</div>';

    h += DDS.ky([
        { r: o.kyTrai || 'NGƯỜI LẬP BIỂU', d: '(Ký, ghi rõ họ tên)' },
        { r: o.kyPhai || 'GIÁM ĐỐC', d: '(Ký, ghi rõ họ tên, đóng dấu)',
          dau: cty.conDau, ky: cty.chuKy }
    ]) + DDS.chanTrang(cty, CH, String(o.tieu || '')) + '</div>';
    W.__C = null;
    return h;
};

/* --------------------------------------------------------------------------
   XUẤT EXCEL THEO ĐÚNG MẪU BÁO CÁO
   Khác hẳn "Xuất dữ liệu Excel": bản này giữ nguyên bố cục của mẫu báo cáo —
   tiêu đề đơn vị, tên báo cáo, điều kiện lọc, kỳ báo cáo, người lập, ngày in,
   bảng dữ liệu, dòng tổng cộng và khối chữ ký.
   -------------------------------------------------------------------------- */
W.excelBaoCao = function (o) {
    if (!W.XLSX) return UI.toast('err', 'Thiếu thư viện Excel');
    var X = W.XLSX;
    var cty = o.cty || DB.cty();
    var cols = (o.cols || []).filter(function (c) { return !c.an; });
    var rows = o.rows || [];
    var nv = (W.Q && W.Q.nhanVienCuaToi && W.Q.nhanVienCuaToi()) || {};
    var nguoiLap = o.nguoiLap || nv.hoTen || DB.user().hoTen || '';
    var soCot = cols.length + 1;
    var A = [], merges = [];
    function dong(v) { A.push(v); return A.length - 1; }
    function gop(r, c1, c2) { merges.push({ s: { r: r, c: c1 }, e: { r: r, c: c2 } }); }

    /* ---- Tiêu đề đơn vị phát hành ---- */
    gop(dong([cty.ten || '']), 0, soCot - 1);
    gop(dong(['Địa chỉ: ' + (cty.diaChi || '')]), 0, soCot - 1);
    gop(dong([[cty.mst ? 'MST: ' + cty.mst : '', cty.dienThoai ? 'ĐT: ' + cty.dienThoai : '',
               cty.email ? 'Thư điện tử: ' + cty.email : ''].filter(Boolean).join('  •  ')]), 0, soCot - 1);
    if (cty.nganHang) gop(dong(['Tài khoản: ' + cty.nganHang]), 0, soCot - 1);
    dong([]);

    /* ---- Tên báo cáo ---- */
    gop(dong([String(o.tieu || '').toUpperCase()]), 0, soCot - 1);
    if (o.phu) gop(dong([o.phu]), 0, soCot - 1);
    dong([]);

    /* ---- Điều kiện lọc ---- */
    var dk = [];
    if (o.tu || o.den) {
        dk.push(['Kỳ báo cáo', (o.tu ? 'Từ ngày ' + T.date(o.tu) : 'Từ đầu') +
                               (o.den ? ' đến ngày ' + T.date(o.den) : ' đến nay')]);
    } else {
        dk.push(['Thời điểm', T.date(o.thoiDiem || T.today())]);
    }
    (o.dieuKien || []).forEach(function (x) {
        if (!x || x.v === '' || x.v === undefined || x.v === null) return;
        dk.push([x.t, String(x.v)]);
    });
    dk.push(['Số dòng dữ liệu', rows.length]);
    dk.push(['Người lập biểu', nguoiLap]);
    dk.push(['Ngày in', T.date(T.today())]);
    dk.forEach(function (x) {
        var r = dong([x[0] + ':', x[1]]);
        if (soCot > 2) gop(r, 1, soCot - 1);
    });
    dong([]);

    /* ---- Bảng dữ liệu ---- */
    var rTieu = dong(['TT'].concat(cols.map(function (c) { return c.t; })));
    var soCotSo = {};
    rows.forEach(function (r, i) {
        A.push([i + 1].concat(cols.map(function (c, j) {
            var v = c.v ? c.v(r) : r[c.k];
            if (typeof v === 'number') { soCotSo[j + 1] = true; return v; }
            var n = T.so(v);
            if (v !== '' && v !== undefined && v !== null && !isNaN(n) && /^[\d.,\-\s]+$/.test(String(v))) {
                soCotSo[j + 1] = true; return n;
            }
            return v === undefined || v === null ? '' : String(v);
        })));
    });
    var rTong = -1;
    if (cols.some(function (c) { return c.tong; })) {
        rTong = dong(['TỔNG CỘNG'].concat(cols.map(function (c) {
            if (!c.tong) return '';
            return T.sum(rows, function (r) { return Number(c.v ? c.v(r) : r[c.k]) || 0; });
        })));
    }
    dong([]);

    /* ---- Khối chữ ký ---- */
    var giua = Math.max(1, Math.floor(soCot / 2));
    var d1 = []; d1[0] = o.kyTrai || 'NGƯỜI LẬP BIỂU'; d1[giua] = o.kyPhai || 'GIÁM ĐỐC'; A.push(d1);
    var d2 = []; d2[0] = '(Ký, ghi rõ họ tên)'; d2[giua] = '(Ký, ghi rõ họ tên, đóng dấu)'; A.push(d2);
    A.push([]); A.push([]);
    /* Không in sẵn tên người ký — chỗ ký để trống cho người ký tự ghi rõ họ tên. */
    A.push([]);

    var ws = X.utils.aoa_to_sheet(A);
    ws['!merges'] = merges;
    ws['!cols'] = [{ wch: 6 }].concat(cols.map(function (c) { return { wch: c.wx || (c.w ? Math.round(c.w * 1.1) : 20) }; }));

    function dinhDang(r) {
        Object.keys(soCotSo).forEach(function (j) {
            var a = X.utils.encode_cell({ r: r, c: Number(j) });
            if (ws[a] && typeof ws[a].v === 'number') ws[a].z = '#,##0';
        });
    }
    for (var r0 = rTieu + 1; r0 < rTieu + 1 + rows.length; r0++) dinhDang(r0);
    if (rTong >= 0) dinhDang(rTong);

    var wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, (o.sheet || 'Bao cao').substr(0, 30));
    var ten = (o.file || ('BaoCao_' + T.kd(o.tieu || '').replace(/[^a-zA-Z0-9]+/g, '_'))).substr(0, 80);
    X.writeFile(wb, ten + '.xlsx');
    UI.toast('ok', 'Đã xuất Excel theo mẫu báo cáo', ten + '.xlsx — ' + rows.length + ' dòng dữ liệu.');
};

/* --------------------------------------------------------------------------
   XUẤT DỮ LIỆU EXCEL (RAW) CỦA BÁO CÁO
   -------------------------------------------------------------------------- */
W.duLieuExcelBaoCao = function (o) {
    if (!W.XLSX) return UI.toast('err', 'Thiếu thư viện Excel');
    var X = W.XLSX;
    var cols = (o.cols || []).filter(function (c) { return !c.an; });
    var rows = o.rows || [];
    var A = [cols.map(function (c) { return c.t; })];
    rows.forEach(function (r) {
        A.push(cols.map(function (c) {
            var v = c.v ? c.v(r) : r[c.k];
            if (v === undefined || v === null) return '';
            return v;                                  // giữ nguyên kiểu dữ liệu gốc
        }));
    });
    var ws = X.utils.aoa_to_sheet(A);
    ws['!cols'] = cols.map(function (c) { return { wch: c.wx || (c.w ? Math.round(c.w * 1.1) : 18) }; });
    var wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, (o.sheet || 'Du lieu').substr(0, 30));
    var ten = 'DuLieu_' + T.kd(o.tieu || 'BaoCao').replace(/[^a-zA-Z0-9]+/g, '_');
    X.writeFile(wb, ten.substr(0, 80) + '.xlsx');
    UI.toast('ok', 'Đã xuất dữ liệu Excel', ten + '.xlsx — ' + rows.length +
        ' dòng dữ liệu thô, giữ nguyên cấu trúc bảng, không áp biểu mẫu.');
};

/**
 * In một báo cáo theo khung chuẩn. Thanh công cụ thống nhất toàn hệ thống:
 * Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel.
 */
W.inBaoCao = function (o) {
    function banDayDu() {
        var d = {}; Object.keys(o).forEach(function (k) { d[k] = o[k]; });
        d.gioiHan = Math.max((o.rows || []).length, 1);
        return W.dungBaoCao(d);
    }
    var ten = 'BaoCao_' + T.kd(o.tieu || 'BaoCao').replace(/[^a-zA-Z0-9]+/g, '_');
    UI.print(W.dungBaoCao(o), o.tieu || 'Báo cáo', {
        tenTep: ten,
        word: function () {
            if (!W.xuatWordTuBanIn) return UI.toast('err', 'Chưa nạp bộ xuất Word');
            W.xuatWordTuBanIn(banDayDu(), ten);
        },
        excelMau: function () {
            if (!W.xuatExcelBieuMauTuBanIn) return W.excelBaoCao(o);
            W.xuatExcelBieuMauTuBanIn(banDayDu(), ten);
        },
        duLieu: function () { W.duLieuExcelBaoCao(o); }
    });
};

/* ==========================================================================
   BỐN CHỨNG TỪ KẾ TOÁN — PHIẾU THU · PHIẾU CHI · PHIẾU NHẬP KHO · PHIẾU XUẤT KHO
   --------------------------------------------------------------------------
   Bốn chứng từ này không trình bày như văn bản thương mại. Kế toán viên nào
   cũng quen với thể thức của chúng, và các phần mềm kế toán thông dụng đều in
   đúng thể thức đó: khối đơn vị góc trái, khối mẫu số góc phải, tên phiếu ở
   giữa, dòng ngày tháng, khối Quyển số — Số — Nợ — Có canh phải, các dòng khai
   báo có đường chấm điền tay, tiền bằng chữ, số chứng từ gốc kèm theo và khối
   chữ ký đủ chức danh.
   ========================================================================== */
function ngayTrong(iso) {
    if (!iso) return 'Ngày ..... tháng ..... năm .....';
    var p = String(iso).substr(0, 10).split('-');
    return 'Ngày ' + p[2] + ' tháng ' + p[1] + ' năm ' + p[0];
}

/** Bảng hàng hóa theo thể thức chứng từ kho của chế độ kế toán. */
function bangKhoKT(r, thuc) {
    var dg = C('hienDonGia'), tt = C('hienThanhTien');
    function sl(l) { return Number(l.soLuong) || 0; }
    function slThuc(l) {
        return l.soLuongThuc === undefined || l.soLuongThuc === null || l.soLuongThuc === ''
            ? sl(l) : Number(l.soLuongThuc) || 0;
    }
    function don(l) {
        return l.giaVon === undefined || l.giaVon === null || l.giaVon === ''
            ? (Number(l.donGia) || 0) : (Number(l.giaVon) || 0);
    }
    var cot = [
        cotSTT(),
        /* Chứng từ kho của chế độ kế toán có tới tám cột trên khổ A4 dọc. Tiêu
           đề cột dài giữ nguyên chữ theo mẫu quy định nhưng được phép trải
           trên nhiều dòng, nhờ vậy cột nào cũng còn đủ chỗ cho dữ liệu thật. */
        { k: 'ten', dauDong: 6,
          t: 'Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sản phẩm, hàng hóa',
          v: function (l) { return l.tenHang || ''; } },
        { k: 'ma', t: 'Mã số', v: function (l) { return model(l); } },
        { k: 'dvt', t: 'Đơn vị tính', dauDong: 3, v: function (l) { return l.dvt || ''; } }
    ];
    /* Cột số lượng tách làm hai bậc "Theo chứng từ" / "Thực nhập — thực xuất"
       đúng thể thức mẫu KHI VÀ CHỈ KHI chứng từ thật sự có hai con số khác
       nhau. Chứng từ chỉ có một con số thì in một cột — in cùng một số ra hai
       cột không cho người đọc thêm thông tin nào mà lại lấy mất chỗ của cột
       tên hàng. */
    var haiSo = false;
    (r.lines || []).forEach(function (l) { if (slThuc(l) !== sl(l)) haiSo = true; });
    if (haiSo) {
        cot.push({ k: 'sl', t: 'Theo chứng từ', nhom: 'Số lượng', dauDong: 3,
                   v: function (l) { return T.num(sl(l)); } });
        cot.push({ k: 'sl', t: thuc.charAt(0).toUpperCase() + thuc.slice(1),
                   nhom: 'Số lượng', dauDong: 2,
                   v: function (l) { return T.num(slThuc(l)); } });
    } else {
        cot.push({ k: 'sl', t: 'Số lượng', dauDong: 2, v: function (l) { return T.num(sl(l)); } });
    }
    var chu = haiSo ? ['A', 'B', 'C', 'D', '1', '2', '3', '4']
                    : ['A', 'B', 'C', 'D', '1', '2', '3'];
    if (dg) cot.push({ k: 'gia', t: 'Đơn giá', v: function (l) { return T.money(don(l)); } });
    if (tt) cot.push({ k: 'tien', t: 'Thành tiền',
        v: function (l) { return T.money(Math.round(slThuc(l) * don(l))); } });

    var rows = r.lines || [];
    var tong = T.sum(rows, function (l) { return Math.round(slThuc(l) * don(l)); });
    var tfoot = '<tr class="sum"><td class="c"></td><td>Cộng</td><td class="c"></td>' +
        '<td class="c"></td>' +
        (haiSo ? '<td class="n">' + T.num(T.sum(rows, sl)) + '</td>' : '') +
        '<td class="n">' + T.num(T.sum(rows, slThuc)) + '</td>' +
        (dg ? '<td class="n">x</td>' : '') +
        (tt ? '<td class="n">' + T.money(tong) + '</td>' : '') + '</tr>';
    return { html: DDS.bang({ cot: cot, rows: rows, rong: rongIn(),
                              dauPhu: chu.slice(0, cot.length), tfoot: tfoot }),
             tong: tong, coTien: tt };
}

/** Dựng một trong bốn chứng từ kế toán. Trả về chuỗi rỗng nếu không phải. */
function chungTuKeToan(key, r, cty, kh, ncc, kho, CH) {
    var ms = T.MAU_SO_KT[key];
    if (!ms) return '';
    var dk = T.dinhKhoan(key, r);
    var so = C('hienSoChungTu') ? (r.so || '') : '';
    var h = DDS.dauKeToan(cty, CH, {
        mauSo: ms.ma, vanBan: T.VAN_BAN_KT,
        boPhan: kho ? kho.ten : (r.boPhan || '')
    });

    /* ---------------- PHIẾU THU · PHIẾU CHI (mẫu 01-TT · 02-TT) ---------------- */
    if (key === 'phieuThu' || key === 'phieuChi') {
        var thu = key === 'phieuThu';
        var dt = thu ? kh : ncc;
        var nguoi = thu ? (r.nguoiNop || r.khachHang || '') : (r.nguoiNhan || r.nhaCungCap || '');
        var donViDT = (thu ? r.khachHang : r.nhaCungCap) || '';
        var soTien = Number(r.soTien) || 0;
        h += DDS.tieuDeKeToan({
                tieu: ms.ten.toUpperCase(), ngay: ngayTrong(r.ngay),
                dinhDanh: [
                    { k: 'Quyển số', v: T.quyenSo(r) },
                    { k: 'Số', v: so },
                    { k: 'Nợ', v: dk.no },
                    { k: 'Có', v: dk.co }
                ]
            }) +
            DDS.dongKeToan([
                { k: thu ? 'Họ và tên người nộp tiền' : 'Họ và tên người nhận tiền',
                  v: nguoi, dam: true },
                /* Người nộp / nhận tiền thường chính là đối tác. Chỉ in thêm
                   dòng đơn vị khi đó là hai tên khác nhau, không in lặp. */
                donViDT && donViDT !== nguoi
                    ? { k: thu ? 'Đơn vị nộp tiền' : 'Đơn vị nhận tiền', v: donViDT } : null,
                { k: 'Địa chỉ', v: dt.diaChi || '' },
                { k: thu ? 'Lý do nộp' : 'Lý do chi', v: noi(r, 'lyDo') || r.lyDo || '' },
                { k: 'Hình thức thanh toán', v: r.hinhThuc || '' },
                { k: 'Chứng từ liên quan', v: (thu ? r.donBanSo : r.donMuaSo) || '' },
                { k: 'Số tiền', v: T.money(soTien), sau: 'đồng', dam: true },
                { k: 'Viết bằng chữ', v: T.docTien(soTien) },
                { k: 'Kèm theo', v: T.chungTuGocKem(r), sau: 'chứng từ gốc' }
            ]) +
            dongGhiChu(r) + dongMaGD(r) +
            DDS.kyKeToan([
                { r: 'GIÁM ĐỐC', d: '(Ký, họ tên, đóng dấu)',
                  dau: CH.hienDauCongTy !== false ? (cty.conDau || CH.anhDau) : '',
                  ky: cty.chuKy || CH.anhChuKy,
                  t: C('hienChucDanh') ? (cty.daiDien || '') : '' },
                { r: 'KẾ TOÁN TRƯỞNG', d: '(Ký, họ tên)' },
                { r: thu ? 'NGƯỜI NỘP TIỀN' : 'NGƯỜI NHẬN TIỀN', d: '(Ký, họ tên)', t: nguoi },
                { r: 'NGƯỜI LẬP PHIẾU', d: '(Ký, họ tên)' },
                { r: 'THỦ QUỸ', d: '(Ký, họ tên)',
                  t: (thu ? r.nguoiThu : r.nguoiChi) || '' }
            ], ngayTrong(r.ngay)) +
            DDS.dongKeToan([
                { k: 'Đã nhận đủ số tiền (viết bằng chữ)', v: T.docTien(soTien) },
                { k: 'Tỷ giá ngoại tệ', v: r.tyGia && Number(r.tyGia) !== 1 ? T.num(r.tyGia) : '' },
                { k: 'Số tiền quy đổi',
                  v: r.tyGia && Number(r.tyGia) !== 1 ? T.money(Math.round(soTien * Number(r.tyGia))) : '' }
            ]);
        return h;
    }

    /* ---------------- PHIẾU NHẬP KHO (mẫu 01-VT) ---------------- */
    if (key === 'phieuNhap') {
        var bn = bangKhoKT(r, 'thực nhập');
        h += DDS.tieuDeKeToan({
                tieu: 'PHIẾU NHẬP KHO', ngay: ngayTrong(r.ngay),
                dinhDanh: [
                    { k: 'Số', v: so },
                    { k: 'Nợ', v: dk.no },
                    { k: 'Có', v: dk.co }
                ]
            }) +
            DDS.dongKeToan([
                { k: 'Họ và tên người giao', v: r.nguoiGiao || r.nhaCungCap || '', dam: true },
                { k: 'Theo chứng từ', v: [r.loNhapSo ? 'Lô nhập số ' + r.loNhapSo : '',
                                          r.donMuaSo ? 'Đơn mua hàng số ' + r.donMuaSo : '',
                                          r.soHoaDon ? 'Hóa đơn số ' + r.soHoaDon : '']
                                        .filter(Boolean).join(' · ') },
                { k: 'Nhập tại kho', v: kho ? kho.ten : '' },
                { k: 'Địa điểm', v: (kho && kho.diaChi) || '' },
                { k: 'Diễn giải', v: r.nguon || noi(r, 'ghiChu') || '' }
            ]) +
            bn.html +
            DDS.dongKeToan([
                bn.coTien ? { k: 'Tổng số tiền (viết bằng chữ)',
                              v: T.docTien(r.tongTien === undefined ? bn.tong : r.tongTien) } : null,
                { k: 'Số chứng từ gốc kèm theo', v: T.chungTuGocKem(r) }
            ]) +
            dongMaGD(r) +
            DDS.kyKeToan([
                { r: 'NGƯỜI LẬP PHIẾU', d: '(Ký, họ tên)' },
                { r: 'NGƯỜI GIAO HÀNG', d: '(Ký, họ tên)', t: r.nguoiGiao || '' },
                { r: 'THỦ KHO', d: '(Ký, họ tên)', t: r.thuKho || '' },
                { r: 'KẾ TOÁN TRƯỞNG', d: '(Hoặc bộ phận có nhu cầu nhập)' }
            ], ngayTrong(r.ngay));
        return h;
    }

    /* ---------------- PHIẾU XUẤT KHO (mẫu 02-VT) ---------------- */
    var bx = bangKhoKT(r, 'thực xuất');
    h += DDS.tieuDeKeToan({
            tieu: 'PHIẾU XUẤT KHO', ngay: ngayTrong(r.ngay),
            dinhDanh: [
                { k: 'Số', v: so },
                { k: 'Nợ', v: dk.no },
                { k: 'Có', v: dk.co }
            ]
        }) +
        DDS.dongKeToan([
            { k: 'Họ và tên người nhận hàng', v: r.nguoiNhan || r.khachHang || '', dam: true },
            { k: 'Địa chỉ (bộ phận)', v: r.diaDiemGiao || kh.diaChi || '' },
            { k: 'Lý do xuất kho', v: r.lyDo || '' },
            { k: 'Theo chứng từ', v: [r.donBanSo ? 'Đơn hàng số ' + r.donBanSo : '',
                                      r.hopDongSo ? 'Hợp đồng số ' + r.hopDongSo : '']
                                    .filter(Boolean).join(' · ') },
            { k: 'Xuất tại kho (ngăn lô)', v: kho ? kho.ten : '' },
            { k: 'Địa điểm', v: (kho && kho.diaChi) || '' }
        ]) +
        bx.html +
        DDS.dongKeToan([
            bx.coTien ? { k: 'Tổng số tiền (viết bằng chữ)', v: T.docTien(bx.tong) } : null,
            { k: 'Số chứng từ gốc kèm theo', v: T.chungTuGocKem(r) }
        ]) +
        dongGhiChu(r) + dongMaGD(r) +
        DDS.kyKeToan([
            { r: 'NGƯỜI LẬP PHIẾU', d: '(Ký, họ tên)' },
            { r: 'NGƯỜI NHẬN HÀNG', d: '(Ký, họ tên)', t: r.nguoiNhan || '' },
            { r: 'THỦ KHO', d: '(Ký, họ tên)', t: r.nguoiGiao || '' },
            { r: 'KẾ TOÁN TRƯỞNG', d: '(Ký, họ tên)' },
            { r: 'GIÁM ĐỐC', d: '(Ký, họ tên, đóng dấu)',
              dau: CH.hienDauCongTy !== false ? (cty.conDau || CH.anhDau) : '',
              ky: cty.chuKy || CH.anhChuKy,
              t: C('hienChucDanh') ? (cty.daiDien || '') : '' }
        ], ngayTrong(r.ngay));
    return h;
}

/* ==========================================================================
   DỰNG HTML TỪNG LOẠI CHỨNG TỪ
   Mọi biểu mẫu đi qua đúng một trình tự: đầu trang doanh nghiệp → địa danh
   ngày tháng → tiêu đề ba bậc → khối thông tin các bên → nội dung nghiệp vụ
   → bảng hàng hóa → khối tổng cộng → tiền bằng chữ → điều khoản → khối chữ
   ký → chân trang.
   ========================================================================== */
W.inChungTuHTML = function (key, r) {
    /* BẢN ĐÃ SỬA TRỰC TIẾP TRÊN BẢN IN được ưu tiên tuyệt đối: xem trước, in,
       PDF, Word và Excel đều đọc đúng một bản này nên không thể lệch nhau.
       Bản sửa nằm trong CHÍNH chứng từ — biểu mẫu chuẩn không hề thay đổi. */
    if (r && r.banInRieng && r.banInRieng.html) return r.banInRieng.html;
    var html = W.inChungTuMauChuan(key, r);
    /* Người dùng đã LƯU MẪU MẶC ĐỊNH cho loại chứng từ này (khung đường viền
       theo vùng) → áp lên biểu mẫu chuẩn trước khi hiển thị / in / xuất. */
    var m = W.mauMacDinh ? W.mauMacDinh(key) : null;
    if (m && m.vien && W.apVienLenHTML) html = W.apVienLenHTML(html, m.vien);
    return html;
};

/** Dựng bản in theo ĐÚNG biểu mẫu chuẩn, bỏ qua phần người dùng sửa tay. */
W.inChungTuMauChuan = function (key, r) {
    /* loại chứng từ đang dựng — để bộ đọc nội dung lấy đúng mẫu mặc định */
    W.__KEY = key;
    /* Logo lấy đúng phiên bản lúc phát hành — đổi logo không đổi chứng từ cũ. */
    var cty = T.ctyChungTu(r);
    /* Thông tin khách hàng lấy từ CUSTOMER MASTER DATA theo Customer ID; chứng
       từ đã phát hành thì in đúng BẢN CHỤP PHÁP LÝ lúc ký (T.khChungTu).
       Tên in ra cũng lấy từ đó, KHÔNG lấy chuỗi rời rạc lưu trên chứng từ. */
    var kh = T.khChungTu(r);
    if (kh.ten && r.khachHang !== kh.ten) { r = T.clone(r); r.khachHang = kh.ten; }
    var ncc = DB.get('nhaCungCap', r.nhaCungCapId) || {};
    var kho = DB.get('kho', r.khoId);

    /* --- Biểu mẫu chuẩn DUY NHẤT của loại chứng từ này --- */
    var CH = T.cauHinhIn(cty);
    W.__C = CH;

    /* Bốn chứng từ kế toán — phiếu thu, phiếu chi, phiếu nhập kho, phiếu xuất
       kho — in theo đúng thể thức của chế độ kế toán doanh nghiệp (Thông tư
       200/2014/TT-BTC), không dùng bố cục văn bản thương mại. */
    if (T.laChungTuKT(key)) {
        var hkt = '<div class="print-sheet"' + W.kieuMau(CH) + '>' +
            chungTuKeToan(key, r, cty, kh, ncc, kho, CH);
        if (CH.ghiChuCuoi) hkt += '<div class="pr-note">' + T.esc(CH.ghiChuCuoi) + '</div>';
        hkt += (CH.hienChanTrang === false ? '' : DDS.chanTrang(cty, CH, r.so || '')) + '</div>';
        W.__C = null; W.__KEY = null;
        return hkt;
    }

    /* Bốn biểu mẫu giao dịch — Báo giá · Đơn đặt hàng · Biên bản giao hàng ·
       Đề nghị thanh toán (tạm ứng) — dựng lại ĐÚNG tệp biểu mẫu doanh nghiệp
       đang dùng: đầu trang khung kẻ ô có ô logo bên trái, dòng địa danh —
       ngày tháng canh phải, rồi tên biểu mẫu in hoa giữa trang. */
    var GIAO_DICH = { baoGia: 1, donBan: 1, bienBanGiao: 1, deNghiTT: 1 };
    var dd = CH.hienDiaDanh === false ? ''
        : (GIAO_DICH[key]
            ? DDS.dongNgay(diaDanh(cty), r.ngay)
            : '<div class="pr-diadanh">' + T.esc(diaDanh(cty)) + ', ' +
              ngayVN(r.ngay).toLowerCase() + '</div>');
    var h = '<div class="print-sheet"' + W.kieuMau(CH) + '>' +
        (GIAO_DICH[key] ? DDS.dauDN(cty, CH) : DDS.dauTrang(cty, CH)) + dd;

    function tieu(o) {
        o = o || {};
        return DDS.tieuDe({
            eyebrow: NHOM_IN[key] || '',
            tieu: o.tieu || TIEU_DE_IN[key] || 'CHỨNG TỪ',
            html: o.html,
            so: (r.so && C('hienSoChungTu')) ? r.so : '',
            ngay: r.ngay ? T.date(r.ngay) : '',
            ref: o.ref || [], phu: o.phu || ''
        });
    }

    /* ==================================================================
       BÁO GIÁ KIÊM XÁC NHẬN ĐƠN HÀNG  ·  ĐƠN ĐẶT HÀNG
       Dựng lại ĐÚNG tệp biểu mẫu doanh nghiệp đang dùng:
         đầu trang khung kẻ ô → địa danh, ngày tháng → tên biểu mẫu hai dòng
         → khung BÊN MUA → câu dẫn → ĐIỀU 1 bảng hàng hóa kèm ba dòng tổng
         cộng có nền nhấn và dòng Bằng chữ → ĐIỀU 2 · 3 · 4 → dòng lưu ý →
         ĐẠI DIỆN BÊN BÁN — ĐẠI DIỆN BÊN MUA.
       Đơn đặt hàng dùng CHUNG bộ khối này, chỉ khác tên biểu mẫu và câu dẫn.
       ================================================================== */
    /* ------------------------------------------------------------------
       BÁO GIÁ — dựng theo đúng tệp biểu mẫu báo giá của doanh nghiệp.
       Đầu trang và tên biểu mẫu giữ nguyên; chỉ phần thân theo tệp mẫu.
       ------------------------------------------------------------------ */
    if (key === 'baoGia') {
        h += DDS.tieuDeDN({ tieu: 'BÁO GIÁ', dong2: 'KIÊM XÁC NHẬN ĐƠN HÀNG',
                            so: (r.so && C('hienSoChungTu')) ? r.so : '' }) +
            thongTinBaoGia(r, kh) +
            '<div class="pr-kg"><i>Kính gửi : Quý Khách hàng</i></div>' +
            bangBaoGia(r) +
            (C('hienTienBangChu')
                ? '<div class="pr-chu"><b>Bằng chữ:</b> ' +
                  T.esc(T.docTien(T.tinhTong(r.lines || [], ts(r)).tongCong)) + '</div>'
                : '') +
            ghiChuBaoGia(r) +
            dongMaGD(r) +
            chanBaoGia(cty);
    }

    else if (key === 'donBan') {
        h += DDS.tieuDeDN({ tieu: 'ĐƠN ĐẶT HÀNG',
                            so: (r.so && C('hienSoChungTu')) ? r.so : '' }) +
            DDS.khungBen({
                nhan: 'BÊN MUA:', ten: r.khachHang || '',
                dong: [
                    { k: 'Địa chỉ', v: kh.diaChi || '' },
                    { k: 'Điện thoại', v: kh.dienThoai || '', k2: 'MST', v2: kh.mst || '' },
                    { k: 'Đại diện', v: kh.nguoiLienHe || '', k2: 'Chức vụ', v2: kh.chucVu || '' },
                    (r.duAn || r.baoGiaSo)
                        ? { k: 'Công trình / dự án', v: r.duAn || '',
                            k2: 'Theo báo giá số', v2: r.baoGiaSo || '' }
                        : { k: 'Người lập', v: r.nguoiLap || '' }
                ]
            }) +
            '<div class="pr-l">Hai bên thỏa thuận đồng ý xác lập và thực hiện ' +
            'đơn đặt hàng với các điều khoản sau:</div>' +
            DDS.mucDieu(1, 'HÀNG HÓA - SỐ LƯỢNG - GIÁ CẢ') +
            bangHangDN(r) +
            (C('hienTienBangChu')
                ? '<div class="pr-chu"><b>Bằng chữ:</b> ' +
                  T.esc(T.docTien(tongChungTu(r))) + '</div>'
                : '');
        if (C('hienDieuKhoan')) h += dieuKhoanBanHang(r, cty, key);
        h += dongGhiChu(r) +
            dongMaGD(r) +
            DDS.kyDN('ĐẠI DIỆN BÊN MUA', 'ĐẠI DIỆN BÊN BÁN', kyDonVi(cty));
    }

    /* ==================================================================
       BIÊN BẢN GIAO HÀNG KIÊM PHIẾU XUẤT KHO
       Dựng lại ĐÚNG tệp biểu mẫu doanh nghiệp đang dùng: khối Bên A (Bên
       giao) — Bên B (Bên nhận) là các dòng khai báo, bảng hàng hóa không có
       cột tiền, khối Ghi chú gạch đầu dòng, rồi hai ô ký.
       ================================================================== */
    else if (key === 'bienBanGiao') {
        h += DDS.tieuDeDN({ tieu: 'BIÊN BẢN GIAO HÀNG KIÊM PHIẾU XUẤT KHO',
                            so: (r.so && C('hienSoChungTu')) ? r.so : '',
                            mau: CH.mauNhan || '' }) +
            DDS.khungBen({
                nhan: 'BÊN A (BÊN GIAO):', ten: cty.ten,
                dong: [
                    { k: 'Địa chỉ', v: cty.diaChi || '' },
                    { k: 'Người giao', v: r.nguoiGiao || '',
                      k2: 'Chức vụ', v2: r.chucVuGiao || '' }
                ]
            }) +
            DDS.khungBen({
                nhan: 'BÊN B (BÊN NHẬN):', ten: r.khachHang || '',
                dong: [
                    { k: 'Địa chỉ', v: r.diaDiemGiao || kh.diaChi || '' },
                    { k: 'Người nhận', v: r.nguoiNhan || kh.nguoiLienHe || '',
                      k2: 'Chức vụ', v2: kh.chucVu || '' },
                    r.duAn ? { k: 'Dự án', v: r.duAn } : null,
                    { k: r.donBanSo ? 'Thuộc đơn hàng số' : 'Người lập',
                      v: r.donBanSo || r.nguoiLap || '' }
                ]
            }) +
            '<div class="pr-l"><i>Hai bên cùng nhau đồng ý ký vào biên bản giao nhận hàng hóa với nội dung và chủng loại như sau:</i></div>' +
            bangGiaoDN(r) +
            '<div class="pr-muc2">Ghi chú:</div>' +
            DDS.gach([
                'Sản phẩm được bàn giao là hàng mới 100% đúng model, số lượng hàng đầy đủ.',
                'Sản phẩm không được bảo hành trong các trường hợp cháy, nổ, rơi, vỡ.',
                'Giấy tờ kèm theo: phiếu xuất kho, giấy kiểm định phương tiện phòng cháy chữa cháy.',
                'Sản phẩm được bảo hành ' + (r.baoHanh || 12) + ' tháng theo tiêu chuẩn nhà sản xuất.',
                r.phuongTien ? 'Phương tiện vận chuyển: ' + T.esc(r.phuongTien) + '.' : '',
                T.esc(noi(r, 'ghiChu')) || '',
                'Biên bản này được làm thành 02 bản, mỗi bên lưu 01 bản có giá trị như nhau.'
            ]) +
            dongMaGD(r) +
            DDS.kyDN('ĐẠI DIỆN BÊN GIAO', 'ĐẠI DIỆN BÊN NHẬN', { dPhai: '( Ký, họ tên )' });
    }

    /* ==================================================================
       HỢP ĐỒNG — DỰNG THEO ĐÚNG LOẠI HỢP ĐỒNG TRONG DANH MỤC
       Toàn bộ tiêu đề, trích yếu, căn cứ pháp lý, nhãn hai bên và bộ điều —
       khoản — điểm đều lấy từ bản ghi "Loại hợp đồng", không viết cứng ở đây.
       Thêm một loại hợp đồng mới trong danh mục là in được ngay.
       ================================================================== */
    else if (key === 'hopDong') {
        h = '<div class="print-sheet"' + W.kieuMau(CH) + '>' + hopDongHTML(r, cty, kh, CH);
    }

    /* ---------- PHỤ LỤC HỢP ĐỒNG ---------- */
    else if (key === 'phuLuc') {
        h += tieu({ ref: [r.hopDongSo ? 'Của hợp đồng số ' + r.hopDongSo : ''] }) +
            '<div class="pr-l">Căn cứ Bộ luật Dân sự và Luật Thương mại hiện hành; căn cứ nhu cầu và khả ' +
            'năng của hai bên, hôm nay ' + ngayVN(r.ngay).toLowerCase() + ', chúng tôi gồm:</div>' +
            DDS.cacBen([
                DDS.benChuan('Bên A — Bên bán', {
                    ten: cty.ten, diaChi: cty.diaChi, mst: cty.mst, dienThoai: cty.dienThoai,
                    nganHang: cty.nganHang, daiDien: cty.daiDien, chucVu: cty.chucVu }),
                DDS.benChuan('Bên B — Bên mua', {
                    ten: r.khachHang, diaChi: kh.diaChi, mst: kh.mst, dienThoai: kh.dienThoai,
                    daiDien: kh.nguoiLienHe, chucVu: kh.chucVu })
            ]) +
            dongDuAn(r) +
            DDS.dieu(1, 'NỘI DUNG ĐIỀU CHỈNH',
                '<div>Loại điều chỉnh: <b>' + T.esc(r.loai || '') + '</b></div>' +
                (r.noiDung ? '<div>' + T.esc(r.noiDung) + '</div>' : '') +
                bangTien(r)) +
            DDS.dieu(2, 'GIÁ TRỊ VÀ PHƯƠNG THỨC THANH TOÁN', DDS.ds([
                'Tổng giá trị: <b>' + T.money(tongChungTu(r)) + ' đồng</b> (đã bao gồm thuế giá trị gia tăng ' +
                    T.num(ts(r), 1) + '%).',
                'Bằng chữ: <i>' + T.esc(T.docTien(tongChungTu(r))) + '</i>',
                'Phương thức thanh toán: ' + T.esc(noi(r, 'dieuKhoanTT') || 'theo thỏa thuận của hai bên'),
                'Đơn vị thụ hưởng: <b>' + T.esc(cty.ten) + '</b> — Tài khoản: <b>' +
                    T.esc(cty.nganHang || '') + '</b>'
            ])) +
            DDS.dieu(3, 'HIỆU LỰC', DDS.ds([
                'Phụ lục này là bộ phận không tách rời của hợp đồng ' + T.esc(r.hopDongSo || '') + '.',
                'Văn bản được lập thành 04 bản có giá trị pháp lý như nhau, mỗi bên giữ 02 bản.'
            ])) +
            dongGhiChu(r) + dongNguoiLap(r) + dongMaGD(r) +
            kyHaiBen('ĐẠI DIỆN BÊN B', 'ĐẠI DIỆN BÊN A', cty, '(Ký, ghi rõ họ tên, đóng dấu)');
    }

    /* ---------- PHIẾU XUẤT KHO ---------- */
    else if (key === 'phieuXuat') {
        h += tieu({ ref: [r.donBanSo ? 'Theo đơn hàng số ' + r.donBanSo : '',
                          r.hopDongSo ? 'Hợp đồng ' + r.hopDongSo : ''] }) +
            DDS.cacBen([
                DDS.the({ nhan: 'Bên xuất', ten: cty.ten, dong: [
                    { k: 'Xuất tại kho', v: kho ? kho.ten + (kho.diaChi ? ' — ' + kho.diaChi : '') : '' },
                    { k: 'Lý do xuất', v: r.lyDo || '' },
                    { k: 'Phương tiện', v: r.phuongTien || '' }
                ] }),
                DDS.the({ nhan: 'Bên nhận', ten: r.khachHang || '', dong: [
                    { k: 'Người nhận', v: r.nguoiNhan || r.khachHang || '' },
                    { k: 'Địa điểm giao', v: r.diaDiemGiao || '' },
                    { k: 'Công trình', v: r.duAn || '' }
                ] })
            ]) +
            bangKhongTien(r) +
            DDS.tong([
                { k: 'Tổng số dòng hàng', v: T.num((r.lines || []).length, 0) },
                { k: 'TỔNG SỐ LƯỢNG',
                  v: T.num(T.sum(r.lines || [], function (l) { return Number(l.soLuong) || 0; })),
                  chinh: true }
            ]) +
            dongGhiChu(r) + dongNguoiLap(r) + dongMaGD(r) +
            DDS.ky([
                { r: 'NGƯỜI NHẬN', d: '(Ký, họ tên)' },
                { r: 'THỦ KHO', d: '(Ký, họ tên)' },
                { r: 'NGƯỜI LẬP PHIẾU', d: '(Ký, họ tên)' },
                { r: 'GIÁM ĐỐC', d: '(Ký, đóng dấu)' }
            ]);
    }

    /* ---------- PHIẾU NHẬP KHO ---------- */
    else if (key === 'phieuNhap') {
        h += tieu({ ref: [r.loNhapSo ? 'Theo lô nhập số ' + r.loNhapSo : ''] }) +
            DDS.cacBen([
                DDS.the({ nhan: 'Bên nhập', ten: cty.ten, dong: [
                    { k: 'Nhập vào kho', v: kho ? kho.ten + (kho.diaChi ? ' — ' + kho.diaChi : '') : '' },
                    { k: 'Nguồn nhập', v: r.nguon || '' },
                    { k: 'Diễn giải', v: r.ghiChu || '' }
                ] }),
                r.nhaCungCap ? DDS.the({ nhan: 'Bên giao', ten: r.nhaCungCap, dong: [
                    { k: 'Địa chỉ', v: ncc.diaChi || '' },
                    { k: 'Mã số thuế', v: ncc.mst || '' },
                    { k: 'Điện thoại', v: ncc.dienThoai || '' }
                ] }) : ''
            ]) +
            bangNhapKho(r) +
            (C('hienThanhTien') && C('hienTienBangChu') ? DDS.bangChu(r.tongTien, 'Bằng chữ:') : '') +
            dongNguoiLap(r) +
            DDS.ky([
                { r: 'NGƯỜI GIAO', d: '(Ký, họ tên)' },
                { r: 'THỦ KHO', d: '(Ký, họ tên)' },
                { r: 'NGƯỜI LẬP PHIẾU', d: '(Ký, họ tên)' },
                { r: 'KẾ TOÁN TRƯỞNG', d: '(Ký, họ tên)' }
            ]);
    }

    /* ==================================================================
       BIÊN BẢN NGHIỆM THU — DỰNG THEO ĐÚNG MẪU DOANH NGHIỆP
       Hai mẫu, chọn theo loại hợp đồng:
         KL — Biên bản nghiệm thu lắp đặt hoàn thành (chỉ khối lượng)
         GT — Biên bản nghiệm thu giá trị thanh toán (có đơn giá, thành tiền)
       Thể thức: quốc hiệu — tiêu ngữ giữa trang, địa danh ngày tháng canh
       phải, tên biên bản in hoa, căn cứ, thành phần hai bên, bảng khối lượng,
       kết luận và khối ký hai bên.
       ================================================================== */
    else if (key === 'bienBanNghiemThu') {
        h = '<div class="print-sheet"' + W.kieuMau(CH) + '>' + nghiemThuHTML(r, cty, kh, CH);
    }

    /* ==================================================================
       ĐỀ NGHỊ THANH TOÁN / ĐỀ NGHỊ TẠM ỨNG
       Dựng lại ĐÚNG công văn doanh nghiệp đang dùng: thể thức văn bản hành
       chính Việt Nam — tên đơn vị và số công văn bên trái, quốc hiệu và tiêu
       ngữ bên phải, tên văn bản in hoa giữa trang, dòng Kính gửi, phần căn cứ
       và nội dung đề nghị, số tiền bằng số và bằng chữ, tài khoản thụ hưởng,
       lời cảm ơn, rồi khối ký của đơn vị phát hành.
       Số tiền do người lập TỰ KHAI: hệ thống KHÔNG tự lấy toàn bộ giá trị hợp
       đồng và KHÔNG tự lấy toàn bộ công nợ.
       ================================================================== */
    else if (key === 'deNghiTT') {
        var tamUng = (r.loaiDN || '') === 'Tạm ứng';
        var soTien = T.soTienDeNghi(r);
        var cc = T.canCuDeNghi(r);
        var ben = r.khachHang || '';
        var canCu = [];
        if (r.hopDongSo) canCu.push('Căn cứ hợp đồng số ' + T.esc(r.hopDongSo));
        if (r.donBanSo) canCu.push('Căn cứ đơn đặt hàng số ' + T.esc(r.donBanSo));
        if (r.baoGiaSo) canCu.push('Căn cứ báo giá số ' + T.esc(r.baoGiaSo));
        if (r.duAn) canCu.push('Công trình / dự án: ' + T.esc(r.duAn));
        if (!canCu.length) canCu.push('Căn cứ thỏa thuận đã ký giữa hai bên');

        h = '<div class="print-sheet"' + W.kieuMau(CH) + '>' +
            DDS.dauCongVan(cty, (r.so && C('hienSoChungTu')) ? r.so : '') +
            DDS.tieuDeDN({ tieu: tamUng ? 'ĐỀ NGHỊ TẠM ỨNG' : 'ĐỀ NGHỊ THANH TOÁN' }) +
            '<div class="pr-kg"><span class="k">Kính gửi:</span> <b>' +
                T.esc(r.kinhGui || ben || ('Ban Giám đốc ' + (cty.ten || ''))) + '</b></div>' +
            '<div class="pr-cvthan">' +
            canCu.map(function (x) { return '<div class="can">' + x + '</div>'; }).join('') +
            '<div>Công ty chúng tôi kính đề nghị Quý <b>' + T.esc(ben || 'Quý khách hàng') +
                '</b> ' + (tamUng ? 'tạm ứng ' : 'thanh toán ') +
                T.esc(boDongTu(noi(r, 'noiDungTT')) ||
                    (tamUng ? 'theo kế hoạch đã được phê duyệt'
                            : 'giá trị đơn hàng theo hồ sơ kèm theo')) +
                ' tương đương số tiền như sau: <b>' + T.money(soTien) + ' VNĐ</b></div>' +
            (C('hienTienBangChu')
                ? '<div class="chu"><b>Số tiền (bằng chữ):</b> ' +
                  T.esc(T.docTien(soTien)) + '.</div>'
                : '') +
            (noi(r, 'lyDo') ? '<div><b>Lý do:</b> ' + T.esc(noi(r, 'lyDo')) + '</div>' : '') +
            (noi(r, 'hoSoKem')
                ? '<div><b>Hồ sơ kèm theo:</b> ' + T.esc(noi(r, 'hoSoKem')) + '</div>' : '') +
            (r.dot ? '<div><b>Đợt thanh toán:</b> ' + T.esc(r.dot) +
                (r.hanTT ? ' — Hạn thanh toán: ' + T.esc(T.date(r.hanTT)) : '') + '</div>' : '') +
            '<div class="dam" style="margin-top:2mm">Số tiền xin chuyển về:</div>' +
            '<div class="tk">' +
            '<div>Đơn vị thụ hưởng: <b>' + T.esc(r.thuHuong || cty.ten) + '</b></div>' +
            '<div>Tài khoản số: <b>' + T.esc(r.taiKhoanNH || cty.nganHang || '') + '</b></div>' +
            '<div>Hình thức thanh toán: ' + T.esc(r.hinhThuc || 'Chuyển khoản') + '</div>' +
            '</div>' +
            /* Giá trị hợp đồng, số đã thanh toán và số còn phải trả chỉ in làm
               CĂN CỨ ĐỐI CHIẾU — không bao giờ là số tiền đề nghị. */
            (cc.giaTri
                ? '<div class="chu" style="margin-top:2mm">Căn cứ đối chiếu: giá trị hợp đồng / đơn hàng ' +
                  T.money(cc.giaTri) + ' đồng · đã thanh toán ' + T.money(cc.daTra) +
                  ' đồng · còn phải thanh toán ' + T.money(cc.conLai) + ' đồng.</div>'
                : '') +
            dongGhiChu(r) +
            '<div style="margin-top:2mm">Xin trân trọng cảm ơn!</div>' +
            '</div>' +
            '<div class="pr-cvphai"><div class="pr-cvky">' +
            '<div class="ng">' + T.esc(diaDanh(cty)) + ', ' +
                T.esc(ngayVN(r.ngay).toLowerCase()) + '</div>' +
            '<div class="dv">' + T.esc(cty.ten) + '</div>' +
            '<div class="h">' +
            (CH.hienDauCongTy !== false && (cty.conDau || CH.anhDau)
                ? '<img class="dau" src="' + (cty.conDau || CH.anhDau) + '">' : '') +
            (cty.chuKy || CH.anhChuKy
                ? '<img class="ky" src="' + (cty.chuKy || CH.anhChuKy) + '">' : '') +
            '</div></div></div>' +
            dongMaGD(r);
    }

    /* ---------- PHIẾU THU / PHIẾU CHI ---------- */
    else if (key === 'phieuThu' || key === 'phieuChi') {
        var thu = key === 'phieuThu';
        h += tieu({}) +
            DDS.cacBen([
                DDS.the({ nhan: thu ? 'Người nộp tiền' : 'Người nhận tiền',
                    ten: T.esc(thu ? (r.nguoiNop || r.khachHang || '') : (r.nguoiNhan || r.nhaCungCap || '')),
                    dong: [
                        { k: 'Đơn vị', v: (thu ? r.khachHang : r.nhaCungCap) || '' },
                        { k: 'Hình thức', v: r.hinhThuc || '' },
                        { k: 'Địa chỉ', v: (thu ? kh.diaChi : ncc.diaChi) || '' }
                    ] }),
                DDS.the({ nhan: thu ? 'Lý do nộp' : 'Lý do chi', ten: '',
                    dong: [
                        { k: 'Nội dung', v: r.lyDo || '', giu: true },
                        { k: 'Chứng từ gốc', v: (thu ? r.donBanSo : r.donMuaSo) || '' },
                        { k: 'Tài khoản', v: cty.nganHang || '' }
                    ] })
            ]) +
            DDS.tong([{ k: 'SỐ TIỀN', v: T.money(r.soTien) + ' đồng', chinh: true }]) +
            DDS.bangChu(r.soTien, 'Bằng chữ:') +
            dongGhiChu(r) + dongNguoiLap(r) + dongMaGD(r) +
            DDS.ky([
                { r: 'GIÁM ĐỐC', d: '(Ký, họ tên)' },
                { r: 'KẾ TOÁN', d: '(Ký, họ tên)' },
                { r: thu ? 'NGƯỜI NỘP' : 'NGƯỜI NHẬN', d: '(Ký, họ tên)' },
                { r: 'THỦ QUỸ', d: '(Ký, họ tên)' }
            ]);
    }

    /* ---------- ĐƠN MUA HÀNG (gửi nhà cung cấp) ---------- */
    else {
        h += tieu({}) +
            DDS.cacBen([benNCC(ncc, r),
                DDS.the({ nhan: 'Bên mua', ten: cty.ten, dong: [
                    { k: 'Địa chỉ', v: cty.diaChi || '' },
                    { k: 'Mã số thuế', v: cty.mst || '' },
                    { k: 'Ngày nhận hàng', v: r.ngayNhan ? T.date(r.ngayNhan) : '' },
                    { k: 'Địa điểm nhận', v: r.diaDiemGiao || '' }
                ] })]) +
            dongDuAn(r) +
            bangTien(r) +
            (noi(r, 'dieuKhoanTT')
                ? DDS.dieu(1, 'ĐIỀU KHOẢN THANH TOÁN', DDS.ds([
                      T.esc(noi(r, 'dieuKhoanTT')),
                      'Đơn vị thụ hưởng: <b>' + T.esc(cty.ten) + '</b>' +
                      (cty.nganHang ? ' — Tài khoản: <b>' + T.esc(cty.nganHang) + '</b>' : '')
                  ]))
                : '') +
            dongGhiChu(r) + dongNguoiLap(r) + dongMaGD(r) +
            kyHaiBen('ĐẠI DIỆN NHÀ CUNG CẤP', 'ĐẠI DIỆN ĐƠN VỊ', cty);
    }

    if (CH.ghiChuCuoi) h += '<div class="pr-note">' + T.esc(CH.ghiChuCuoi) + '</div>';
    h += (CH.hienChanTrang === false ? '' : DDS.chanTrang(cty, CH, r.so || '')) + '</div>';
    W.__C = null; W.__KEY = null;
    return h;
};


/** Thuộc tính style dựng từ cấu hình mẫu — quyết định phông chữ, cỡ chữ, lề, màu. */
var KHO_MM = { A5: [148, 210], A4: [210, 297], Letter: [216, 279], Legal: [216, 356], A3: [297, 420] };
W.kieuMau = function (C) {
    if (!C) return '';
    var s = [];
    // Khổ giấy và hướng giấy của biểu mẫu chuẩn
    if (C.khoGiay && KHO_MM[C.khoGiay]) {
        var k = KHO_MM[C.khoGiay];
        var ngang = (C.huong === 'Ngang' || C.huong === 'ngang');
        s.push('width:' + (ngang ? k[1] : k[0]) + 'mm');
        s.push('min-height:' + (ngang ? k[0] : k[1]) + 'mm');
    }
    if (C.tyLeIn && Number(C.tyLeIn) !== 100)
        s.push('zoom:' + (Number(C.tyLeIn) / 100));
    if (C.fontChu) s.push('font-family:\'' + C.fontChu + '\',Times,serif');
    if (C.coChu) s.push('font-size:' + C.coChu + 'pt');
    if (C.giangDong) s.push('line-height:' + C.giangDong);
    if (C.leTren !== undefined) s.push('padding:' + C.leTren + 'mm ' + C.lePhai + 'mm ' +
                                       C.leDuoi + 'mm ' + C.leTrai + 'mm');
    if (C.mauNenBang) s.push('--pr-nen-bang:' + C.mauNenBang);
    if (C.mauDuongKe) s.push('--pr-ke:' + C.mauDuongKe);
    if (C.coChuBang) s.push('--pr-co-bang:' + C.coChuBang + 'pt');
    if (C.coChuTieuDe) s.push('--pr-co-tieu:' + C.coChuTieuDe + 'pt');
    if (C.mauTieuDe) s.push('--pr-mau-tieu:' + C.mauTieuDe);
    if (C.mauNhan) s.push('--pr-nhan:' + C.mauNhan);
    return s.length ? ' style="' + s.join(';') + '"' : '';
};

/* ==========================================================================
   SỬA NỘI DUNG CHỨNG TỪ
   --------------------------------------------------------------------------
   TVERP chỉ có 01 biểu mẫu chuẩn cho mỗi loại chứng từ, nhưng CÂU CHỮ trên
   từng chứng từ vẫn phải sửa được: điều khoản, ghi chú, nội dung diễn giải,
   các đoạn viết riêng cho từng khách hàng hoặc từng dự án.
   Phần sửa được lưu vào chính chứng từ (trường noiDungRieng) nên biểu mẫu
   chuẩn của phần mềm và các chứng từ khác không hề thay đổi.
   ========================================================================== */
var O_NOI_DUNG = {
    dieuKhoan:   { t: 'Điều khoản riêng của chứng từ', d: 'Chèn vào đầu điều khoản Chi phí — Hồ sơ — Giao nhận — Bảo hành', r: 3 },
    dieuKhoanTT: { t: 'Điều khoản thanh toán', d: 'Thay cho câu thanh toán mặc định của biểu mẫu', r: 3 },
    baoHanh:     { t: 'Điều khoản bảo hành', d: 'Thay cho câu bảo hành mặc định', r: 2 },
    phamVi:      { t: 'Phạm vi công việc', d: 'Thay cho nội dung điều Phạm vi cung cấp của loại hợp đồng', r: 3 },
    phat:        { t: 'Điều khoản phạt', d: 'Thay cho nội dung điều Phạt hợp đồng', r: 3 },
    khac:        { t: 'Điều khoản khác', d: 'In thành một điều riêng ở cuối hợp đồng', r: 3 },
    noiDung:     { t: 'Nội dung diễn giải', d: 'Đoạn diễn giải nghiệp vụ in trên chứng từ', r: 3 },
    noiDungTT:   { t: 'Nội dung thanh toán', d: 'Nội dung đề nghị thanh toán / tạm ứng', r: 2 },
    lyDo:        { t: 'Lý do / căn cứ', d: 'Lý do lập chứng từ', r: 2 },
    hoSoKem:     { t: 'Hồ sơ kèm theo', d: 'Danh sách hồ sơ, chứng từ gốc kèm theo', r: 2 },
    ketLuan:     { t: 'Kết luận', d: 'Kết luận nghiệm thu', r: 2 },
    ghiChu:      { t: 'Ghi chú', d: 'In ở cuối chứng từ', r: 2 }
};
var TRUONG_ND = {
    baoGia:           ['dieuKhoan', 'dieuKhoanTT', 'baoHanh', 'ghiChu'],
    donBan:           ['dieuKhoan', 'dieuKhoanTT', 'baoHanh', 'ghiChu'],
    /* Hợp đồng KHÔNG khóa nội dung: toàn bộ các điều quan trọng đều sửa được
       ngay trên chứng từ, phần sửa chỉ áp dụng cho chính hợp đồng đó. */
    hopDong:          ['noiDung', 'phamVi', 'dieuKhoanTT', 'baoHanh', 'phat',
                       'dieuKhoan', 'khac', 'ghiChu'],
    phuLuc:           ['noiDung', 'dieuKhoanTT', 'ghiChu'],
    bienBanGiao:      ['noiDung', 'ghiChu'],
    bienBanNghiemThu: ['noiDung', 'ketLuan', 'ghiChu'],
    deNghiTT:         ['noiDungTT', 'lyDo', 'hoSoKem', 'ghiChu'],
    phieuThu:         ['lyDo', 'ghiChu'],
    phieuChi:         ['lyDo', 'ghiChu'],
    phieuXuat:        ['lyDo', 'ghiChu'],
    phieuNhap:        ['ghiChu'],
    donMua:           ['dieuKhoanTT', 'ghiChu'],
    kiemKe:           ['ghiChu'],
    dieuChinhKho:     ['lyDo', 'ghiChu']
};
W.TRUONG_NOI_DUNG = TRUONG_ND;

/**
 * Mở cửa sổ SỬA NỘI DUNG của một chứng từ.
 * key  — loại chứng từ; rec — bản ghi; xong(rec) — gọi lại sau khi lưu.
 */
W.suaNoiDungChungTu = function (key, rec, xong) {
    var ds = TRUONG_ND[key] || ['ghiChu'];
    var cu = (rec && rec.noiDungRieng) || {};
    var mmd = W.mauMacDinh(key);
    var coMauND = !!(mmd && mmd.noiDung);
    var body = '<div class="note b mb12"><i class="bi bi-info-circle-fill"></i><div>' +
        '<b>Lưu nội dung</b> — chỉ áp dụng cho chứng từ <b>' + T.esc(rec.so || '') + '</b>. ' +
        '<b>Lưu thành mẫu mặc định</b> — từ nay mọi ' +
        T.esc((TIEU_DE_IN[key] || 'chứng từ').toLowerCase()) +
        ' chưa sửa riêng đều tự động in theo nội dung này, kể cả sau khi đóng phần mềm.' +
        (coMauND ? '<br><i class="bi bi-bookmark-star"></i> Loại chứng từ này <b>đang có mẫu nội dung mặc định</b> do ' +
            T.esc(mmd.boi || 'người dùng') + ' lưu.' : '') +
        '<br>Để trống ô nào thì in theo đúng câu chữ chuẩn của biểu mẫu.</div></div>' +
        '<div class="grid1">';
    ds.forEach(function (k) {
        var o = O_NOI_DUNG[k] || { t: k, d: '', r: 2 };
        var macDinh = rec[k] ? String(rec[k]) : ndMau(key, k);
        var giaTri = cu[k] || (coMauND && mmd.noiDung[k]) || '';
        body += '<div class="fld"><label>' + T.esc(o.t) + '</label>' +
            '<textarea data-f="' + k + '" rows="' + o.r + '" placeholder="' +
            T.esc(macDinh) + '">' + T.esc(giaTri) + '</textarea>' +
            (o.d ? '<div class="small muted">' + T.esc(o.d) + '</div>' : '') + '</div>';
    });
    body += '</div>';

    function docO(h) {
        var v = UI.read(h.el), nd = {}, co = false;
        ds.forEach(function (k) {
            var t = String(v[k] === undefined ? '' : v[k]).trim();
            if (t) { nd[k] = t; co = true; }
        });
        return co ? nd : null;
    }

    UI.modal({
        size: 'lg', title: 'Sửa nội dung — ' + (TIEU_DE_IN[key] || 'chứng từ') + ' ' + (rec.so || ''),
        sub: 'Điều khoản · ghi chú · nội dung diễn giải — lưu riêng cho chứng từ này hoặc thành mẫu mặc định',
        body: body,
        buttons: [
            { text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } },
            { text: 'Khôi phục nội dung mặc định', icon: 'bi-arrow-counterclockwise',
              click: function (h) {
                  var o = T.clone(DB.get(key, rec.id) || rec);
                  delete o.noiDungRieng;
                  DB.update(key, rec.id, o);
                  DB.log('Khôi phục nội dung mặc định của chứng từ', key, o);
                  DB.save(); h.close();
                  UI.toast('ok', 'Đã khôi phục nội dung mặc định', o.so || '');
                  if (xong) xong(o);
              } }
        ].concat(coMauND ? [
            { text: 'Bỏ mẫu mặc định', icon: 'bi-bookmark-x',
              click: function (h) {
                  UI.confirm({ title: 'Bỏ mẫu nội dung mặc định', danger: true,
                      message: 'Các ' + T.esc((TIEU_DE_IN[key] || 'chứng từ').toLowerCase()) +
                               ' chưa sửa riêng sẽ in lại theo câu chữ chuẩn của biểu mẫu?',
                      okText: 'Bỏ mẫu', ok: function () {
                          W.luuMauMacDinh(key, 'noiDung', null);
                          DB.log('Bỏ mẫu nội dung mặc định', key, { so: rec.so });
                          h.close();
                          UI.toast('ok', 'Đã bỏ mẫu nội dung mặc định của loại chứng từ này');
                          if (xong) xong(DB.get(key, rec.id) || rec);
                      } });
              } }
        ] : []).concat([
            { text: 'Lưu thành mẫu mặc định', icon: 'bi-bookmark-star',
              click: function (h) {
                  var nd = docO(h);
                  if (!nd) return UI.toast('warn', 'Chưa nhập nội dung nào để lưu làm mẫu mặc định');
                  W.luuMauMacDinh(key, 'noiDung', nd);
                  DB.log('Lưu mẫu nội dung mặc định', key, { so: rec.so });
                  h.close();
                  UI.toast('ok', 'Đã lưu thành mẫu mặc định',
                      'Từ nay mọi ' + (TIEU_DE_IN[key] || 'chứng từ').toLowerCase() +
                      ' chưa sửa riêng đều tự động dùng nội dung này.');
                  if (xong) xong(DB.get(key, rec.id) || rec);
              } },
            { text: 'Lưu nội dung', cls: 'primary', icon: 'bi-check-lg',
              click: function (h) {
                  var nd = docO(h);
                  var o = T.clone(DB.get(key, rec.id) || rec);
                  if (nd) o.noiDungRieng = nd; else delete o.noiDungRieng;
                  DB.update(key, rec.id, o);
                  DB.log('Sửa nội dung chứng từ', key, o);
                  DB.save(); h.close();
                  UI.toast('ok', 'Đã lưu nội dung riêng của chứng từ',
                      (o.so || '') + ' — biểu mẫu chuẩn không thay đổi.');
                  if (xong) xong(o);
              } }
        ])
    });
};

/**
 * Mở cửa sổ XEM TRƯỚC một chứng từ, kèm đủ: Quay lại · Chỉnh sửa · Sửa nội dung ·
 * In · Xuất PDF · Xuất Word · Xuất Excel · Đóng.
 * Bấm Chỉnh sửa sẽ mở đúng chứng từ này ở chế độ sửa; lưu xong quay lại ngay
 * màn hình xem trước với nội dung đã cập nhật.
 */
W.inChungTu = function (key, r) {
    var id = r.id;
    // Xem trước mở TOÀN MÀN HÌNH: đóng hẳn cửa sổ chứng từ đang xem để không bị che,
    // đóng xem trước sẽ mở lại đúng chứng từ đó với dữ liệu mới nhất.
    document.querySelectorAll('.modal-bg').forEach(function (m) { m.remove(); });
    function moiNhat() { return T.clone(DB.get(key, id) || r); }
    var tieuIn = (TIEU_DE_IN[key] || '') + ' ' + (r.so || '');
    var qSua = id && W.Q.co(key, 'sua') && !moiNhat().khoa;
    function ghiSuaTay(html, xong) {
        var rec = DB.get(key, id);
        if (!rec) return;
        var o = T.clone(rec);
        o.banInRieng = { html: html, luc: new Date().toISOString(),
                         boi: (DB.user() || {}).hoTen || '' };
        DB.update(key, id, o);
        DB.log('sua', key, id, 'Sửa trực tiếp trên bản in ' + (o.so || ''));
        DB.save();
        if (xong) xong();
    }
    function boSuaTay() {
        var rec = DB.get(key, id);
        if (!rec) return;
        UI.confirm({ title: 'Khôi phục theo biểu mẫu chuẩn', danger: true,
            message: 'Bỏ bản in đã sửa tay của chứng từ <b>' + T.esc(rec.so || '') +
                     '</b> và dựng lại từ dữ liệu?',
            okText: 'Khôi phục', ok: function () {
                var o = T.clone(rec); delete o.banInRieng;
                DB.update(key, id, o); DB.save();
                UI.toast('ok', 'Đã khôi phục theo biểu mẫu chuẩn');
                setTimeout(function () { W.inChungTu(key, DB.get(key, id)); }, 120);
            } });
    }
    UI.print(W.inChungTuHTML(key, moiNhat()), tieuIn,
        {
            // dựng lại biểu mẫu chuẩn từ dữ liệu mới nhất sau khi sửa
            veLai: function () { return W.inChungTuHTML(key, moiNhat()); },
            /* SỬA TRỰC TIẾP TRÊN BẢN IN — không mở popup, không mở cửa sổ phía
               sau: chính trang giấy đang xem chuyển sang chế độ soạn thảo. */
            suaTrucTiep: qSua ? function () {
                W.batCheDoSua({
                    tieu: tieuIn,
                    key: key,
                    luu: ghiSuaTay,
                    goc: function () { return W.inChungTuMauChuan(key, moiNhat()); },
                    thoat: function () { setTimeout(function () { W.inChungTu(key, DB.get(key, id) || r); }, 60); }
                });
            } : null,
            daSuaTay: function () { return !!(moiNhat().banInRieng || {}).html; },
            boSuaTay: boSuaTay,
            /* Sửa điều khoản · ghi chú · nội dung diễn giải cho RIÊNG chứng từ
               đang xem. Biểu mẫu chuẩn của phần mềm không hề thay đổi. */
            suaNoiDung: (id && W.Q.co(key, 'sua') && !moiNhat().khoa)
                ? function (veLai) {
                      W.suaNoiDungChungTu(key, DB.get(key, id) || r, function () { veLai(); });
                  }
                : null,
            // mở chế độ chỉnh sửa nếu vai trò có quyền sửa và chứng từ chưa khóa
            sua: (id && W.Q.co(key, 'sua') && !moiNhat().khoa)
                ? function (xong, huy) { W.suaChungTu(key, id, xong, huy); }
                : null,
            quayLai: function () {
                var route = (W.ROUTE_CT || {})[key];
                if (route) W.go(route);
            },
            // Đóng xem trước → quay lại ĐÚNG chứng từ đang xem, không phải mở lại
            dongLai: function () {
                var f = (W.FORM_CT || {})[key];
                var rec = DB.get(key, id);
                if (f && rec) setTimeout(function () { f(rec, true); }, 60);
            }
        });
};

/**
 * XUẤT PDF — mở màn hình xem trước rồi gọi luôn hộp thoại in của trình duyệt;
 * người dùng chọn máy in “Lưu thành PDF” (Microsoft Print to PDF / Save as PDF).
 * Bản Offline .EXE sau này sẽ ghi thẳng ra tệp .pdf, không cần bước chọn này.
 */
W.xuatPDF = function (key, r) {
    W.inChungTu(key, r);
    setTimeout(function () {
        var b = document.getElementById('prPdf');
        if (b) b.click();
    }, 500);
};

/* ==========================================================================
   XUẤT EXCEL THEO BIỂU MẪU
   Khác với “Excel dữ liệu” (mỗi chứng từ một dòng): bản này giữ nguyên
   BỐ CỤC VĂN BẢN của biểu mẫu — tiêu đề đơn vị, tiêu đề chứng từ, khối thông
   tin đối tác, bảng hàng hóa, dòng tổng, tiền bằng chữ và khối ký — để mở
   bằng Excel là in được ngay, không phải dựng lại.
   ========================================================================== */
W.excelBieuMau = function (key, r) {
    if (!W.XLSX) return UI.toast('err', 'Thiếu thư viện Excel');
    /* Logo lấy đúng phiên bản lúc phát hành — đổi logo không đổi chứng từ cũ. */
    var cty = T.ctyChungTu(r);
    var kh = T.khChungTu(r);
    if (kh.ten && r.khachHang !== kh.ten) { r = T.clone(r); r.khachHang = kh.ten; }
    var ncc = DB.get('nhaCungCap', r.nhaCungCapId) || {};
    var ben = r.nhaCungCapId ? ncc : kh;
    var lines = r.lines || [];
    var coTien = key !== 'phieuXuat' && key !== 'bienBanGiao' && key !== 'bienBanNghiemThu';
    var A = [];
    function dong() { A.push(Array.prototype.slice.call(arguments)); }

    /* --- Tiêu đề đơn vị phát hành --- */
    dong(cty.ten);
    dong('Địa chỉ: ' + (cty.diaChi || ''));
    dong('Mã số thuế: ' + (cty.mst || '') + '     Điện thoại: ' + (cty.dienThoai || ''));
    dong(cty.nganHang ? 'Tài khoản: ' + cty.nganHang : '');
    dong('');
    /* --- Tiêu đề chứng từ --- */
    dong(TIEU_DE_IN[key] || 'CHỨNG TỪ');
    dong('Số: ' + (r.so || '') + '          Ngày ' + T.date(r.ngay));
    dong('');
    /* --- Thông tin đối tác --- */
    if (ben.ten) {
        dong(r.nhaCungCapId ? 'NHÀ CUNG CẤP' : 'KHÁCH HÀNG');
        dong('Tên đơn vị:', ben.ten);
        if (ben.diaChi) dong('Địa chỉ:', ben.diaChi);
        if (ben.mst) dong('Mã số thuế:', ben.mst);
        if (ben.nguoiLienHe) dong('Người liên hệ:', ben.nguoiLienHe);
        if (ben.dienThoai) dong('Điện thoại:', ben.dienThoai);
        dong('');
    }
    if (r.duAn) { dong('Dự án / công trình:', r.duAn); dong(''); }

    /* --- Bảng hàng hóa --- */
    var tieu = coTien
        ? ['TT', 'Mã hàng', 'Tên hàng hóa', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền']
        : ['TT', 'Mã hàng', 'Tên hàng hóa', 'ĐVT', 'Số lượng', 'Ghi chú'];
    dong.apply(null, tieu);
    var hangDau = A.length;
    lines.forEach(function (l, i) {
        var sl = Number(l.soLuong) || 0, dg = Number(l.donGia) || 0;
        var tt = Math.round(sl * dg * (1 - (Number(l.ckPhanTram) || 0) / 100));
        if (coTien) dong(i + 1, l.maHang, l.tenHang, l.dvt, sl, dg, tt);
        else dong(i + 1, l.maHang, l.tenHang, l.dvt, sl, l.ghiChu || '');
    });
    var hangCuoi = A.length - 1;

    /* --- Dòng tổng + tiền bằng chữ --- */
    if (coTien) {
        dong('', '', '', '', '', 'Cộng tiền hàng', Number(r.thanhTien) || 0);
        dong('', '', '', '', '', 'Thuế GTGT ' + T.num(r.vatPct === undefined ? 10 : r.vatPct, 1) + '%',
             Number(r.vat) || 0);
        dong('', '', '', '', '', 'TỔNG CỘNG THANH TOÁN', Number(r.tongCong) || 0);
        dong('');
        dong('Bằng chữ: ' + T.docTien(r.tongCong));
    }
    dong('');
    if (r.ghiChu) { dong('Ghi chú: ' + r.ghiChu); dong(''); }

    /* --- Khối ký --- */
    dong('');
    dong('NGƯỜI LẬP BIỂU', '', '', '', '', 'ĐẠI DIỆN ĐƠN VỊ');
    dong('(Ký, ghi rõ họ tên)', '', '', '', '', '(Ký tên, đóng dấu)');
    dong(''); dong(''); dong('');
    /* Không in sẵn tên người ký — chỗ ký để trống cho người ký tự ghi rõ họ tên. */
    dong('');

    /* --- Dựng tệp --- */
    var C = coTien ? 6 : 5;
    var ws = W.XLSX.utils.aoa_to_sheet(A);
    ws['!cols'] = coTien
        ? [{ wch: 5 }, { wch: 20 }, { wch: 48 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 18 }]
        : [{ wch: 5 }, { wch: 20 }, { wch: 52 }, { wch: 8 }, { wch: 10 }, { wch: 24 }];
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: C } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: C } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: C } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: C } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: C } }
    ];
    for (var i = hangDau; i <= hangCuoi + (coTien ? 3 : 0); i++) {
        [4, 5, 6].forEach(function (c) {
            var a = W.XLSX.utils.encode_cell({ r: i, c: c });
            if (ws[a] && typeof ws[a].v === 'number') ws[a].z = '#,##0';
        });
    }
    var wb = W.XLSX.utils.book_new();
    W.XLSX.utils.book_append_sheet(wb, ws, 'Bieu mau');
    var TEN_TEP = {
        baoGia: 'BaoGia', donBan: 'DonBanHang', hopDong: 'HopDongKinhTe', phuLuc: 'PhuLucHopDong',
        phieuXuat: 'PhieuXuatKho', bienBanGiao: 'BienBanGiaoHang', bienBanNghiemThu: 'BienBanNghiemThu',
        deNghiTT: 'DeNghiThanhToan', donMua: 'DonMuaHang', phieuThu: 'PhieuThu', phieuChi: 'PhieuChi'
    };
    var ten = (TEN_TEP[key] || 'ChungTu') + '_' + String(r.so || '').replace(/[\/\\ ]/g, '-');
    W.XLSX.writeFile(wb, ten + '.xlsx');
    UI.toast('ok', 'Đã xuất Excel theo biểu mẫu',
        'Tệp giữ nguyên bố cục văn bản — mở bằng Excel là in được ngay.');
};

/* ==========================================================================
   BÁO CÁO
   ========================================================================== */
var BC = [
    { k: 'dt-thang', t: 'Doanh thu theo tháng', i: 'bi-calendar3' },
    { k: 'dt-kh', t: 'Doanh thu theo khách hàng', i: 'bi-people' },
    { k: 'dt-hang', t: 'Doanh thu theo mặt hàng', i: 'bi-box-seam' },
    { k: 'ton-kho', t: 'Tồn kho & giá trị tồn', i: 'bi-boxes' },
    { k: 'cong-no', t: 'Tổng hợp công nợ', i: 'bi-journal-bookmark' },
    { k: 'dong-tien', t: 'Dòng tiền thu chi', i: 'bi-cash-stack' },
    { k: 'nhat-ky-bh', t: 'Nhật ký bán hàng', i: 'bi-list-check' },
    { k: 'nhan-vien', t: 'Hiệu quả nhân viên', i: 'bi-person-badge' },
    { k: 'lai-lo', t: 'Báo cáo lãi lỗ', i: 'bi-clipboard2-data-fill', quyen: 'loiNhuan' },
    { k: 'chi-phi', t: 'Chi phí theo khoản mục', i: 'bi-list-columns-reverse' },
    { k: 'lai-lo-da', t: 'Lãi lỗ theo dự án', i: 'bi-building-fill-gear', quyen: 'loiNhuan' },
    { k: 'loi-nhuan', t: 'Lãi gộp theo mặt hàng', i: 'bi-cash-coin', quyen: 'loiNhuan' },
    { k: 'theo-cty', t: 'Kết quả theo công ty', i: 'bi-buildings', quyen: 'loiNhuan' },
    { k: 'hop-nhat', t: 'Hợp nhất toàn nhóm', i: 'bi-diagram-2', quyen: 'loiNhuan' },
    { k: 'quan-tri', t: 'Doanh thu · lợi nhuận quản trị', i: 'bi-diagram-3-fill', quyen: 'loiNhuan' },
    { k: 'gia-von', t: 'Giá vốn theo mặt hàng', i: 'bi-tags', quyen: 'giaVon' },
    { k: 'nxt', t: 'Nhập - Xuất - Tồn', i: 'bi-arrow-left-right' },
    { k: 'phai-tra', t: 'Công nợ phải trả', i: 'bi-journal-arrow-up' },
    { k: 'theo-ncc', t: 'Mua hàng theo nhà cung cấp', i: 'bi-truck' },
    { k: 'thu-chi', t: 'Sổ thu - chi chi tiết', i: 'bi-journal-text' },
    { k: 'kq-ky', t: 'Kết quả theo tháng · quý · năm', i: 'bi-calendar-range' },
    { k: 'gop-von', t: 'Góp vốn cổ đông (Tản Viên)', i: 'bi-people-fill', quyen: 'loiNhuan' },
    { k: 'ln-co-dong', t: 'Lợi nhuận cổ đông (Tản Viên)', i: 'bi-pie-chart-fill', quyen: 'loiNhuan' },
    { k: 'truy-vet', t: 'Truy vết một mặt hàng', i: 'bi-search-heart' },
    { k: 'dau-vet', t: 'Dấu vết chứng từ', i: 'bi-clock-history' }
];


/* ==========================================================================
   TRUY VẾT MỘT MẶT HÀNG
   Một mã hàng → lô nhập → giá vốn → giá nội bộ → báo giá → đơn bán →
   phiếu xuất → biên bản giao hàng → khách hàng → lợi nhuận.
   ========================================================================== */
/**
 * Dữ liệu bảng của báo cáo truy vết — dùng cho Xuất báo cáo và Xuất dữ liệu Excel.
 * Mỗi dòng là một mắt xích trong chuỗi: lô nhập → giá vốn → giá nội bộ → báo giá →
 * đơn bán → phiếu xuất → biên bản giao hàng.
 */
function duLieuTruyVet(ma) {
    var hh = T.hh(ma) || {};
    /* TRUY VẾT ĐỐI CHIẾU BẰNG ID NỘI BỘ — mã hàng trên chứng từ chỉ là bản chụp. */
    var idHH = hh.id || T.idHH(ma);
    function coHang(l) { return T.idDong(l) === idHH; }
    var rows = [];
    function dong(buoc, loai, r, sl, dg) {
        rows.push({
            buoc: buoc, loai: loai, so: r.so || '', ngay: r.ngay || '',
            donVi: (DB.get('donVi', r.donVi) || {}).tat || '',
            doiTac: r.khachHang || r.nhaCungCap || '',
            soLuong: sl || 0, donGia: dg || 0,
            thanhTien: Math.round((sl || 0) * (dg || 0)),
            trangThai: r.trangThai || ''
        });
    }
    function d1(r) {
        return (r.lines || []).filter(coHang)[0] || {};
    }
    DB.all('loNhap').filter(function (l) {
        return (l.trangThai === 'Đã nhập kho' || l.trangThai === 'Tồn đầu kỳ') &&
               (l.lines || []).some(coHang);
    }).forEach(function (l) {
        var x = d1(l); dong(1, 'Lô nhập hàng', l, x.soLuong, x.giaVonLo);
    });
    DB.all('phieuNhap').filter(function (p) {
        return p.trangThai === 'Đã ghi sổ' && (p.lines || []).some(coHang);
    }).forEach(function (p) { var x = d1(p); dong(2, 'Phiếu nhập kho', p, x.soLuong, x.giaVon); });
    DB.all('baoGia').filter(function (r) { return (r.lines || []).some(coHang); })
        .forEach(function (r) { var x = d1(r); dong(3, 'Báo giá', r, x.soLuong, x.donGia); });
    DB.all('donBan').filter(function (r) { return (r.lines || []).some(coHang); })
        .forEach(function (r) { var x = d1(r); dong(4, 'Đơn bán hàng', r, x.soLuong, x.donGia); });
    DB.all('hopDong').filter(function (r) { return (r.lines || []).some(coHang); })
        .forEach(function (r) { var x = d1(r); dong(5, 'Hợp đồng', r, x.soLuong, x.donGia); });
    DB.all('phieuXuat').filter(function (r) { return (r.lines || []).some(coHang); })
        .forEach(function (r) { var x = d1(r); dong(6, 'Phiếu xuất kho', r, x.soLuong, x.donGia); });
    DB.all('bienBanGiao').filter(function (r) { return (r.lines || []).some(coHang); })
        .forEach(function (r) { var x = d1(r); dong(7, 'Biên bản giao hàng', r, x.soLuong, x.donGia); });
    rows.sort(function (a, b) { return a.buoc - b.buoc || (a.ngay < b.ngay ? -1 : 1); });
    return {
        ten: 'Truy vết mặt hàng ' + ma + ' — ' + (hh.ten || ''),
        cols: [
            { t: 'Bước', k: 'buoc' }, { t: 'Loại chứng từ', k: 'loai' }, { t: 'Số chứng từ', k: 'so' },
            { t: 'Ngày', k: 'ngay' }, { t: 'Đơn vị', k: 'donVi' }, { t: 'Đối tác', k: 'doiTac' },
            { t: 'Số lượng', k: 'soLuong' }, { t: 'Đơn giá', k: 'donGia' },
            { t: 'Thành tiền', k: 'thanhTien', tong: true }, { t: 'Trạng thái', k: 'trangThai' }
        ],
        rows: rows
    };
}

function veTruyVet(box, ma) {
    if (!box) return;
    if (!ma) { box.innerHTML = ''; return; }
    var hh = T.hh(ma);
    if (!hh) { box.innerHTML = ''; return; }
    var qGV = W.Q.co('baoCao', 'giaVon'), qLN = W.Q.co('baoCao', 'loiNhuan');
    var bq = T.giaVonBQ(ma);
    /* Đối chiếu bằng ID NỘI BỘ trên toàn bộ chuỗi truy vết. */
    function coHang(l) { return T.idDong(l) === hh.id; }

    /* --- 1. Lô nhập --- */
    var los = DB.all('loNhap').filter(function (l) {
        return (l.trangThai === 'Đã nhập kho' || l.trangThai === 'Tồn đầu kỳ') &&
               (l.lines || []).some(coHang);
    }).slice().sort(function (a, c) { return a.ngay < c.ngay ? 1 : -1; });

    /* --- 2. Giá nội bộ từng công ty --- */
    var dvs = DB.all('donVi');

    /* --- 3. Chứng từ bán hàng có mặt hàng này --- */
    function coMa(r) { return (r.lines || []).some(coHang); }
    function dong(r) { return (r.lines || []).filter(coHang)[0] || {}; }
    var bgs = DB.all('baoGia').filter(coMa);
    var dbs = DB.all('donBan').filter(coMa);
    var pxs = DB.all('phieuXuat').filter(coMa);
    var bbs = DB.all('bienBanGiao').filter(coMa);

    /* --- 4. Lợi nhuận của riêng mặt hàng này --- */
    var slBan = 0, dt = 0, gv = 0;
    dbs.forEach(function (d) {
        if (d.trangThai === 'Nháp' || d.trangThai === 'Đã hủy') return;
        var l = dong(d);
        var sl = Number(l.soLuong) || 0;
        slBan += sl;
        dt += Math.round(sl * (Number(l.donGia) || 0) * (1 - (Number(l.ckPhanTram) || 0) / 100));
        gv += Math.round(sl * (Number(l.giaVon) || 0));
    });

    function buoc(so, tieu, icon, noi) {
        return '<div class="tv-buoc"><div class="tv-so">' + so + '</div>' +
            '<div class="tv-than"><div class="tv-tieu"><i class="bi ' + icon + '"></i> ' + tieu + '</div>' +
            '<div class="tv-noi">' + noi + '</div></div></div>';
    }
    function bang(cot, rows, rong) {
        if (!rows.length) return '<div class="muted small">' + (rong || 'Chưa phát sinh') + '</div>';
        return '<div class="tablewrap" style="max-height:230px"><table class="grid"><thead><tr>' +
            cot.map(function (c) { return '<th' + (c.n ? ' class="num"' : '') +
                (c.w ? ' style="width:' + c.w + 'px"' : '') + '>' + c.t + '</th>'; }).join('') +
            '</tr></thead><tbody>' + rows.map(function (r) {
                return '<tr>' + cot.map(function (c) {
                    return '<td' + (c.n ? ' class="num"' : '') + '>' + c.r(r) + '</td>';
                }).join('') + '</tr>';
            }).join('') + '</tbody></table></div>';
    }

    /* MỘT phiên bản và MỘT loại giá cho cả phần diễn giải lẫn con số — nếu không,
       màn hình truy vết sẽ nêu chiết khấu của phiên bản này mà tính tiền theo
       phiên bản khác. */
    var bgTV = T.phienBanTinhGia(ma, '', T.today());
    var cotTV = T.cotGiaNoiBo(bgTV, '');

    box.innerHTML =
        '<div class="grid4 mb12">' +
        kpi2('Mặt hàng', T.esc(hh.ma), T.esc(hh.ten)) +
        kpi2('Tồn kho hiện tại', T.num(hh.ton, 0) + ' ' + T.esc(hh.dvt || ''), '', hh.ton > 0 ? 'g' : 'r') +
        (qGV ? kpi2('Giá vốn bình quân', T.money(bq) + ' đ', 'bình quân gia quyền di động', 'b') : '') +
        (qLN ? kpi2('Lãi gộp lũy kế', T.money(dt - gv) + ' đ', 'từ ' + T.num(slBan, 0) + ' đơn vị đã bán',
                    dt - gv >= 0 ? 'g' : 'r') : '') +
        '</div>' +
        '<div class="card"><div class="card-h"><i class="bi bi-diagram-3-fill"></i> ' +
        'Chuỗi truy vết đầy đủ — ' + T.esc(hh.ma) + '</div><div class="card-b tv-ds">' +

        buoc(1, 'Lô nhập hàng', 'bi-box-arrow-in-down',
            bang([{ t: 'Số lô', w: 120, r: function (l) { return '<span class="mono">' + T.esc(l.so) + '</span>'; } },
                  { t: 'Ngày nhập', w: 100, r: function (l) { return T.date(l.ngay); } },
                  { t: 'Nhà cung cấp', r: function (l) { return T.esc(l.nhaCungCap || ''); } },
                  { t: 'SL nhập', w: 90, n: true, r: function (l) { return T.num(dongLo(l).soLuong); } },
                  { t: 'Đơn giá mua', w: 130, n: true, r: function (l) { return qGV ? T.money(dongLo(l).donGia) : '••••'; } },
                  { t: 'Giá vốn lô', w: 130, n: true, r: function (l) { return qGV ? '<b>' + T.money(dongLo(l).giaVonLo) + '</b>' : '••••'; } }],
                 los, 'Mặt hàng chưa từng được nhập kho')) +

        buoc(2, 'Giá vốn bình quân di động', 'bi-currency-exchange',
            qGV ? '<b style="font-size:16px;color:var(--brand)">' + T.money(bq) + ' đ</b>' +
                  ' <span class="muted small">— hình thành từ giá nhập + thuế + logistics + vận chuyển + ' +
                  'thông quan + chi phí phân bổ của các lô trên</span>'
                : '<span class="muted">Vai trò hiện tại không được xem giá vốn</span>') +

        buoc(3, 'Giá vốn nội bộ của các công ty phát hành', 'bi-shuffle',
            qGV ? bang([{ t: 'Công ty', w: 150, r: function (d) { return '<b>' + T.esc(d.tat) + '</b>'; } },
                        { t: 'Chiết khấu nội bộ của phiên bản bảng giá', r: function (d) {
                            return T.esc(T.dienGiaiNoiBo(bgTV, d.id)); } },
                        { t: 'Giá vốn nội bộ theo ' + T.esc(cotTV || 'loại giá chính'), w: 170, n: true,
                          r: function (d) {
                            return '<b>' + T.money(T.giaVonTheoDonVi(ma, d.id, T.today(),
                                                   (bgTV || {}).id || '', cotTV)) + '</b>'; } }], dvs)
                : '<span class="muted">Vai trò hiện tại không được xem giá vốn</span>') +

        buoc(4, 'Báo giá', 'bi-file-earmark-text',
            bang([{ t: 'Số báo giá', w: 150, r: function (r) { return lk('baoGia', r); } },
                  { t: 'Ngày', w: 100, r: function (r) { return T.date(r.ngay); } },
                  { t: 'Đơn vị', w: 90, r: function (r) { return T.esc((DB.get('donVi', r.donVi) || {}).tat || ''); } },
                  { t: 'Khách hàng', r: function (r) { return T.esc(r.khachHang || ''); } },
                  { t: 'SL', w: 70, n: true, r: function (r) { return T.num(dong(r).soLuong); } },
                  { t: 'Đơn giá', w: 130, n: true, r: function (r) { return T.money(dong(r).donGia); } },
                  { t: 'Trạng thái', w: 120, r: function (r) { return T.pill(r.trangThai); } }], bgs)) +

        buoc(5, 'Đơn bán hàng', 'bi-cart-check',
            bang([{ t: 'Số đơn', w: 150, r: function (r) { return lk('donBan', r); } },
                  { t: 'Ngày', w: 100, r: function (r) { return T.date(r.ngay); } },
                  { t: 'Đơn vị', w: 90, r: function (r) { return T.esc((DB.get('donVi', r.donVi) || {}).tat || ''); } },
                  { t: 'Khách hàng', r: function (r) { return T.esc(r.khachHang || ''); } },
                  { t: 'SL', w: 70, n: true, r: function (r) { return T.num(dong(r).soLuong); } },
                  { t: 'Đơn giá', w: 130, n: true, r: function (r) { return T.money(dong(r).donGia); } },
                  { t: 'Giá vốn đóng băng', w: 150, n: true, r: function (r) {
                      return qGV ? T.money(dong(r).giaVon) : '••••'; } },
                  { t: 'Lãi gộp dòng', w: 140, n: true, r: function (r) {
                      if (!qLN) return '••••';
                      var l = dong(r), sl = Number(l.soLuong) || 0;
                      var v = Math.round(sl * ((Number(l.donGia) || 0) * (1 - (Number(l.ckPhanTram) || 0) / 100) - (Number(l.giaVon) || 0)));
                      return '<b class="' + (v < 0 ? 'neg' : 'pos') + '">' + T.money(v) + '</b>'; } }], dbs)) +

        buoc(6, 'Phiếu xuất kho', 'bi-box-arrow-right',
            bang([{ t: 'Số phiếu', w: 150, r: function (r) { return lk('phieuXuat', r); } },
                  { t: 'Ngày xuất', w: 100, r: function (r) { return T.date(r.ngay); } },
                  { t: 'Khách hàng', r: function (r) { return T.esc(r.khachHang || ''); } },
                  { t: 'SL xuất', w: 90, n: true, r: function (r) { return T.num(dong(r).soLuong); } },
                  { t: 'Trạng thái', w: 130, r: function (r) { return T.pill(r.trangThai); } }], pxs)) +

        buoc(7, 'Biên bản giao hàng', 'bi-clipboard-check',
            bang([{ t: 'Số biên bản', w: 150, r: function (r) { return lk('bienBanGiao', r); } },
                  { t: 'Ngày giao', w: 100, r: function (r) { return T.date(r.ngay); } },
                  { t: 'Khách hàng', r: function (r) { return T.esc(r.khachHang || ''); } },
                  { t: 'SL giao', w: 90, n: true, r: function (r) { return T.num(dong(r).soLuong); } }], bbs)) +

        buoc(8, 'Kết quả — khách hàng và lợi nhuận', 'bi-graph-up-arrow',
            '<div class="grid4">' +
            kpi2('Số lượng đã bán', T.num(slBan, 0) + ' ' + T.esc(hh.dvt || ''), '') +
            kpi2('Doanh thu', T.money(dt) + ' đ', '', 'b') +
            (qGV ? kpi2('Giá vốn hàng bán', T.money(gv) + ' đ', 'đã đóng băng trên chứng từ', 'c') : '') +
            (qLN ? kpi2('Lợi nhuận gộp', T.money(dt - gv) + ' đ',
                        dt ? 'tỷ suất ' + T.num((dt - gv) / dt * 100, 1) + '%' : '', dt - gv >= 0 ? 'g' : 'r') : '') +
            '</div>' +
            '<div class="mt12"><b>Khách hàng đã mua:</b> ' +
            (dbs.length ? Array.from(new Set(dbs.map(function (d) { return d.khachHang; })))
                .map(function (x) { return '<span class="pill n">' + T.esc(x) + '</span>'; }).join(' ')
                : '<span class="muted">chưa có</span>') + '</div>') +

        '</div></div>';

    box.querySelectorAll('[data-mo]').forEach(function (a) {
        a.onclick = function (e) {
            e.preventDefault();
            var p = a.getAttribute('data-mo').split('|');
            W.moChungTu(p[0], p[1]);
        };
    });

    function dongLo(l) { return (l.lines || []).filter(function (x) { return x.maHang === ma; })[0] || {}; }
    function lk(k, r) {
        return '<a href="#" class="lnk mono" data-mo="' + k + '|' + T.esc(r.id) + '">' + T.esc(r.so) + '</a>';
    }
    function kpi2(l, v, ft, c) {
        return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div>' +
            '<div class="vl" style="font-size:16px">' + v + '</div>' +
            '<div class="ft">' + (ft || '&nbsp;') + '</div></div>';
    }
}

/** Danh sách dự án có thật trên chứng từ — lấy động, không khai cứng. */
function dsDuAn() {
    var co = {};
    ['baoGia', 'donBan', 'hopDong', 'phieuXuat', 'phieuChi', 'phieuThu'].forEach(function (c) {
        DB.all(c).forEach(function (r) { if (r.duAnId) co[r.duAnId] = 1; });
    });
    return Object.keys(co).map(function (id) {
        var d = DB.get('duAn', id);
        return { id: id, ten: (d && (d.ten || d.ma)) || id };
    }).sort(function (a, b) { return a.ten < b.ten ? -1 : 1; });
}
/** Nhóm hàng có thật trong danh mục hàng hóa. */
function dsNhomHang() {
    var co = {};
    DB.all('hangHoa').forEach(function (h) { if (h.nhom) co[h.nhom] = 1; });
    return Object.keys(co).sort();
}

S['bao-cao'] = function (host) {
    var cur = 'dt-thang';
    /* Kỳ mặc định là NĂM NAY, giải bằng chính T.kyChon của Business Engine —
       không ghi cứng ngày tháng nào trong màn hình báo cáo. */
    var kyMD = T.kyChon('nam');
    var tu = kyMD.tuNgay, den = kyMD.denNgay;
    var dv = '', nv = '', da = '', kh = '', ncc = '', nhom = '', kho = '', buoc = 'thang';
    var qGV = W.Q.co('baoCao', 'giaVon'), qLN = W.Q.co('baoCao', 'loiNhuan');

    host.innerHTML = '<div class="page">' +
        '<div class="page-head"><div><h2>Báo cáo</h2><div class="sub">Số liệu tính trực tiếp từ chứng từ — tách riêng từng công ty, có báo cáo hợp nhất và truy vết</div></div></div>' +
        '<div class="tabs" id="bcTabs">' + BC.filter(function (b) {
            return !b.quyen || W.Q.co('baoCao', b.quyen);
        }).map(function (b, i) {
            return '<div class="tab' + (i === 0 ? ' on' : '') + '" data-bc="' + b.k + '"><i class="bi ' + b.i + '"></i> ' + b.t + '</div>';
        }).join('') + '</div>' +
        '<div class="toolbar" style="border-radius:4px">' +
        '<div class="fld" style="min-width:210px"><label>Kỳ báo cáo</label><select id="fKy">' +
        '<option value="">— Khai tay Từ ngày / Đến ngày —</option>' +
        T.KY_CHON_SAN.map(function (x) {
            return '<option value="' + x.k + '"' + (x.k === 'nam' ? ' selected' : '') + '>' + T.esc(x.t) + '</option>';
        }).join('') +
        T.cacNamCoDuLieu({}).slice().reverse().map(function (n) {
            return '<option value="nam:' + n + '">Năm ' + n + '</option>';
        }).join('') +
        '</select></div>' +
        '<div class="fld"><label>Từ ngày</label><input type="date" id="fTu" value="' + tu + '"></div>' +
        '<div class="fld"><label>Đến ngày</label><input type="date" id="fDen" value="' + den + '"></div>' +
        '<div class="fld" style="min-width:200px"><label>Công ty</label><select id="fDv">' +
        '<option value="">— Toàn hệ thống —</option>' +
        DB.all('donVi').map(function (d) { return '<option value="' + d.id + '">' + T.esc(d.tat + ' — ' + d.ten) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="fld" style="min-width:230px"><label>Doanh thu nội bộ</label><select id="fNoiBo">' +
        '<option value="0">Bao gồm doanh thu nội bộ</option>' +
        '<option value="1">Loại trừ doanh thu nội bộ</option>' +
        '</select></div>' +
        '<div class="fld" style="min-width:190px"><label>Người lập</label><select id="fNV"><option value="">— Tất cả nhân viên —</option>' +
        DB.all('nhanVien').map(function (n) { return '<option value="' + n.id + '">' + T.esc(n.hoTen) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="fld" style="min-width:190px"><label>Dự án / công trình</label><select id="fDA">' +
        '<option value="">— Tất cả dự án —</option>' +
        dsDuAn().map(function (x) { return '<option value="' + T.esc(x.id) + '">' + T.esc(x.ten) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="fld" style="min-width:200px"><label>Khách hàng</label><select id="fKH">' +
        '<option value="">— Tất cả khách hàng —</option>' +
        DB.all('khachHang').map(function (c) { return '<option value="' + c.id + '">' + T.esc(c.ten) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="fld" style="min-width:200px"><label>Nhà cung cấp</label><select id="fNCC">' +
        '<option value="">— Tất cả nhà cung cấp —</option>' +
        DB.all('nhaCungCap').map(function (c) { return '<option value="' + c.id + '">' + T.esc(c.ten) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="fld" style="min-width:170px"><label>Nhóm hàng</label><select id="fNhom">' +
        '<option value="">— Tất cả nhóm —</option>' +
        dsNhomHang().map(function (x) { return '<option value="' + T.esc(x) + '">' + T.esc(x) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="fld" style="min-width:160px"><label>Kho</label><select id="fKho">' +
        '<option value="">— Tất cả kho —</option>' +
        DB.all('kho').map(function (c) { return '<option value="' + c.id + '">' + T.esc(c.ten) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="fld" style="min-width:150px"><label>Gom theo</label><select id="fBuoc">' +
        '<option value="thang">Tháng</option><option value="quy">Quý</option><option value="nam">Năm</option>' +
        '</select></div>' +
        '<div class="fld"><label>&nbsp;</label><button class="btn primary" id="btnXem"><i class="bi bi-search"></i> Xem báo cáo</button></div>' +
        '<div class="fld"><label>&nbsp;</label><button class="btn" id="btnXuat" title="Xuất nguyên dữ liệu của bảng — không áp dụng biểu mẫu"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button></div>' +
        '<div class="fld"><label>&nbsp;</label><button class="btn primary" id="btnIn" title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel"><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button></div>' +
        '</div><div id="bcBody" style="margin-top:12px"></div></div>';
    W.crumb(['Phân tích', 'Báo cáo']);

    var duLieu = { cols: [], rows: [], ten: '' };
    var goNoiBo = false;              // loại trừ doanh thu nội bộ khi xem toàn hệ thống

    function loc(arr, kNgay) {
        return arr.filter(function (x) {
            var n = x[kNgay || 'ngay'];
            return n >= tu && n <= den && (!dv || x.donVi === dv) && (!nv || x.nguoiLapId === nv) &&
                   (!da || x.duAnId === da) && (!kh || x.khachHangId === kh) &&
                   (!ncc || x.nhaCungCapId === ncc) && (!kho || !x.khoId || x.khoId === kho);
        });
    }
    /** Một mặt hàng có nằm trong bộ lọc Nhóm hàng đang chọn hay không. */
    function hopNhom(hangHoaId) {
        if (!nhom) return true;
        var h = T.hh(hangHoaId);
        return !!h && h.nhom === nhom;
    }
    /** Mô tả bộ lọc đang áp — in kèm mọi bản xuất để đọc lại là biết số ở đâu ra. */
    function moTaLoc() {
        var ra = [{ t: 'Đơn vị phát hành', v: dv ? (DB.get('donVi', dv) || {}).ten || dv : 'Toàn hệ thống' }];
        if (nv) ra.push({ t: 'Người lập', v: (DB.get('nhanVien', nv) || {}).hoTen || nv });
        if (da) ra.push({ t: 'Dự án / công trình', v: (DB.get('duAn', da) || {}).ten || da });
        if (kh) ra.push({ t: 'Khách hàng', v: (DB.get('khachHang', kh) || {}).ten || kh });
        if (ncc) ra.push({ t: 'Nhà cung cấp', v: (DB.get('nhaCungCap', ncc) || {}).ten || ncc });
        if (nhom) ra.push({ t: 'Nhóm hàng', v: nhom });
        if (kho) ra.push({ t: 'Kho', v: (DB.get('kho', kho) || {}).ten || kho });
        if (cur === 'quan-tri') ra.push({ t: 'Doanh thu nội bộ', v: goNoiBo ? 'Loại trừ' : 'Bao gồm' });
        if (cur === 'kq-ky') ra.push({ t: 'Gom theo', v: buoc === 'nam' ? 'Năm' : (buoc === 'quy' ? 'Quý' : 'Tháng') });
        return ra;
    }

    /* Bộ lọc gửi thẳng cho Business Engine — báo cáo không tự lọc theo cách riêng. */
    function locEngine() {
        var o = {};
        if (tu) o.tuNgay = tu;
        if (den) o.denNgay = den;
        if (dv) o.donViId = dv;
        /* Bộ lọc Người lập phải áp cho CẢ doanh thu lẫn tiền đã thu, nếu không
           cột chênh lệch sẽ so doanh thu toàn công ty với tiền của một người. */
        if (nv) o.nguoiLapId = nv;
        if (da) o.duAnId = da;
        if (kh) o.khachHangId = kh;
        return o;
    }

    function ve() {
        tu = host.querySelector('#fTu').value; den = host.querySelector('#fDen').value;
        dv = host.querySelector('#fDv').value; nv = host.querySelector('#fNV').value;
        da = host.querySelector('#fDA').value; kh = host.querySelector('#fKH').value;
        ncc = host.querySelector('#fNCC').value; nhom = host.querySelector('#fNhom').value;
        kho = host.querySelector('#fKho').value; buoc = host.querySelector('#fBuoc').value;
        goNoiBo = host.querySelector('#fNoiBo').value === '1';
        var b = host.querySelector('#bcBody');
        var db = loc(DB.all('donBan')).filter(function (d) { return d.trangThai !== 'Nháp' && d.trangThai !== 'Đã hủy'; });

        if (cur === 'dt-thang') {
            /* MỘT CƠ SỞ DOANH THU DUY NHẤT cho toàn phần mềm: chứng từ ghi nhận
               do Business Engine chọn, số tiền TRƯỚC thuế GTGT. Trước đây màn
               hình này cộng tongCong (đã gồm thuế) còn Trang chủ cộng tiền hàng
               trước thuế — hai nơi không bao giờ khớp nhau. */
            var ctT = T.chungTuDoanhThu(locEngine());
            var m = {}, sd = {};
            ctT.forEach(function (x) {
                var k = String(x.r.ngay).substr(0, 7);
                m[k] = (m[k] || 0) + T.suyLuanChungTu(x.r).tong.doanhThu;
                sd[k] = (sd[k] || 0) + 1;
            });
            var pt = {}; loc(DB.all('phieuThu')).filter(function (p) { return p.trangThai === 'Đã ghi sổ'; })
                .forEach(function (p) { var k = p.ngay.substr(0, 7); pt[k] = (pt[k] || 0) + p.soTien; });
            var ks = Object.keys(m).concat(Object.keys(pt)).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
            duLieu = { ten: 'Doanh thu theo tháng',
                cols: [{ t: 'Tháng', k: 'thang' }, { t: 'Số chứng từ', k: 'soDon' }, { t: 'Doanh thu', k: 'doanhThu' },
                       { t: 'Đã thu', k: 'daThu' }, { t: 'Chênh lệch', k: 'chenh' }],
                rows: ks.map(function (k) {
                    return { thang: 'Tháng ' + Number(k.substr(5)) + '/' + k.substr(0, 4), soDon: sd[k] || 0,
                        doanhThu: m[k] || 0, daThu: pt[k] || 0, chenh: (m[k] || 0) - (pt[k] || 0) };
                }) };
            var tongDT = T.sum(duLieu.rows, function (r) { return r.doanhThu; });
            b.innerHTML = kpiBox([
                ['Tổng doanh thu', T.money(tongDT) + ' đ', ''],
                ['Tổng đã thu', T.money(T.sum(duLieu.rows, function (r) { return r.daThu; })) + ' đ', 'g'],
                ['Chênh lệch', T.money(T.sum(duLieu.rows, function (r) { return r.chenh; })) + ' đ', 'r'],
                ['Số chứng từ ghi nhận', T.num(ctT.length, 0), 'c'],
                ['BQ / chứng từ', T.money(ctT.length ? tongDT / ctT.length : 0) + ' đ', ''],
                ['Số tháng', duLieu.rows.length, '']
            ]) +
            '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
            'Doanh thu tính <b>trước thuế GTGT</b> và ghi nhận <b>đúng một lần cho mỗi giao dịch</b>. ' +
            'Cột "Đã thu" là tiền thực nhận theo phiếu thu (đã gồm thuế) nên chênh lệch giữa hai cột là ' +
            'bình thường, không phải sai số.</div></div>' +
            chartBox('Doanh thu theo tháng', duLieu.rows.map(function (r) { return { l: r.thang, v: r.doanhThu }; })) +
                tableBox(duLieu, ['doanhThu', 'daThu', 'chenh']);
        }

        else if (cur === 'dt-kh') {
            /* Cùng cơ sở doanh thu với mọi nơi khác: chứng từ ghi nhận do Engine
               chọn, số tiền TRƯỚC thuế. Trước đây tab này cộng tongCong đã gồm
               thuế nên lệch hẳn với tab bên cạnh. */
            var dsKH = T.loiNhuanTheoKhach(locEngine());
            var tong = T.sum(dsKH, function (r) { return r.doanhThu; });
            duLieu = { ten: 'Doanh thu theo khách hàng',
                cols: [{ t: 'Khách hàng', k: 'ten' }, { t: 'Số chứng từ', k: 'soDon' },
                       { t: 'Doanh thu', k: 'doanhThu' }, { t: 'Giá vốn', k: 'giaVon' },
                       { t: 'Lợi nhuận', k: 'loiNhuan' }, { t: 'Đã thu', k: 'daThu' },
                       { t: 'Còn nợ', k: 'conNo' }, { t: 'Tỷ trọng %', k: 'tyTrong', tong: false }],
                rows: dsKH.map(function (r) {
                    var n = r.khachHangId ? T.congNoKH(r.khachHangId) : { daThu: 0, conLai: 0 };
                    return { ten: r.ten, soDon: r.soChungTu, doanhThu: r.doanhThu,
                             giaVon: r.giaVon, loiNhuan: r.loiNhuan,
                             daThu: n.daThu, conNo: n.conLai,
                             tyTrong: tong ? Math.round(r.doanhThu / tong * 1000) / 10 : 0 };
                }) };
            b.innerHTML = kpiBox([
                ['Số khách phát sinh', T.num(duLieu.rows.length, 0), 'c'],
                ['Tổng doanh thu', T.money(tong) + ' đ', ''],
                ['Tổng lợi nhuận', T.money(T.sum(dsKH, function (r) { return r.loiNhuan; })) + ' đ', 'g'],
                ['Khách lớn nhất', duLieu.rows[0] ? String(duLieu.rows[0].ten).substr(0, 22) : '—', ''],
                ['Top 5 chiếm', T.num(tong ? T.sum(duLieu.rows.slice(0, 5), function (r) { return r.doanhThu; }) / tong * 100 : 0, 1) + '%', 'y'],
                ['Còn phải thu', T.money(T.sum(duLieu.rows, function (r) { return r.conNo; })) + ' đ', 'r']
            ]) +
            '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
            'Doanh thu tính <b>trước thuế GTGT</b>; cột "Đã thu" và "Còn nợ" là số tiền thực tế ' +
            '(đã gồm thuế) nên hai bên không bằng nhau — đó là bình thường.</div></div>' +
            chartBox('Top 10 khách hàng theo doanh thu',
                duLieu.rows.slice(0, 10).map(function (r) { return { l: String(r.ten).substr(0, 26), v: r.doanhThu }; })) +
                tableBox(duLieu, ['doanhThu', 'giaVon', 'loiNhuan', 'daThu', 'conNo']);
        }

        else if (cur === 'dt-hang') {
            /* Cùng một bộ máy với Dashboard và báo cáo lãi lỗ — không tự cộng lại. */
            var arr = T.loiNhuanTheoMatHang(locEngine()).map(function (r) {
                return { ma: r.model || r.ma, maNoiBo: r.ma, ten: r.ten, dvt: r.dvt, sl: r.soLuong,
                         dt: r.doanhThu, von: r.giaVon, lai: r.loiNhuan,
                         ty: r.doanhThu ? Math.round(r.loiNhuan / r.doanhThu * 1000) / 10 : 0 };
            }).sort(function (a, b2) { return b2.dt - a.dt; });
            duLieu = { ten: 'Doanh thu theo mặt hàng',
                cols: [{ t: 'Model', k: 'ma' }, { t: 'Mã nội bộ', k: 'maNoiBo' },
                       { t: 'Tên hàng hóa', k: 'ten' }, { t: 'ĐVT', k: 'dvt' },
                       { t: 'Số lượng bán', k: 'sl' }, { t: 'Doanh thu', k: 'dt' },
                       { t: 'Giá vốn', k: 'von' }, { t: 'Lợi nhuận', k: 'lai' },
                       { t: 'Tỷ suất %', k: 'ty', tong: false }],
                rows: arr };
            b.innerHTML = kpiBox([
                ['Số mã hàng bán ra', T.num(arr.length, 0), 'c'],
                ['Tổng số lượng', T.num(T.sum(arr, function (r) { return r.sl; }), 0), ''],
                ['Tổng doanh thu', T.money(T.sum(arr, function (r) { return r.dt; })) + ' đ', ''],
                ['Tổng giá vốn', T.money(T.sum(arr, function (r) { return r.von; })) + ' đ', 'y'],
                ['Tổng lợi nhuận', T.money(T.sum(arr, function (r) { return r.lai; })) + ' đ', 'g'],
                ['Mã chưa bán', T.num(DB.all('hangHoa').length - arr.length, 0), 'y']
            ]) + chartBox('Top 10 mặt hàng theo doanh thu',
                arr.slice(0, 10).map(function (r) { return { l: r.ma, v: r.dt }; })) +
                tableBox(duLieu, ['dt', 'von', 'lai']);
        }

        else if (cur === 'ton-kho') {
            /* Tồn kho CHỐT TẠI NGÀY CUỐI KỲ, không lấy số hiện hành — xem báo cáo
               của một kỳ đã qua thì tồn kho cũng phải là tồn kho của kỳ đó. */
            var tTK = T.tonKhoTaiNgay(den);
            var xuatTheoMa = {};
            loc(DB.all('phieuXuat')).forEach(function (p) {
                (p.lines || []).forEach(function (l) {
                    var id = T.idDong(l);
                    xuatTheoMa[id] = (xuatTheoMa[id] || 0) + (Number(l.soLuong) || 0);
                });
            });
            var hh = DB.all('hangHoa').filter(function (x) { return hopNhom(x.id); }).map(function (x) {
                var ton = Number((tTK.ton || {})[x.id]) || 0;
                /* GIÁ VỐN GỐC — một cách định giá tồn kho duy nhất cho toàn hệ thống. */
                var gv = Number((tTK.bq || {})[x.id]) || T.giaVonGoc(x);
                return { ma: x.ma, ten: x.ten, dvt: x.dvt, nhom: x.nhom, ton: ton,
                    xuat: xuatTheoMa[x.id] || 0,
                    giaVon: gv, giaTri: Math.round(ton * gv),
                    tt: ton < 0 ? 'Âm kho' : ton === 0 ? 'Hết hàng' : ton < 10 ? 'Sắp hết' : 'Còn hàng' };
            });
            duLieu = { ten: 'Tồn kho và giá trị tồn — chốt ngày ' + T.date(den),
                cols: [{ t: 'Mã hàng', k: 'ma' }, { t: 'Tên hàng hóa', k: 'ten' }, { t: 'ĐVT', k: 'dvt' },
                       { t: 'Nhóm hàng', k: 'nhom' }, { t: 'Xuất trong kỳ', k: 'xuat', tong: true },
                       { t: 'Tồn cuối kỳ', k: 'ton', tong: true },
                       { t: 'Giá vốn', k: 'giaVon', an: !qGV }, { t: 'Giá trị tồn', k: 'giaTri', an: !qGV },
                       { t: 'Tình trạng', k: 'tt' }].filter(function (c) { return !c.an; }),
                rows: hh.sort(function (a, b2) { return b2.giaTri - a.giaTri; }) };
            var gn = T.groupBy(hh, function (x) { return x.nhom; });
            b.innerHTML = kpiBox([
                ['Số mã hàng', T.num(hh.length, 0), 'c'],
                ['Tổng tồn', T.num(T.sum(hh, function (x) { return x.ton; }), 0), ''],
                ['Giá trị tồn kho', T.money(T.sum(hh, function (x) { return x.giaTri; })) + ' đ', 'g'],
                ['Hết hàng', T.num(hh.filter(function (x) { return x.ton === 0; }).length, 0) + ' mã', 'y'],
                ['Âm kho', T.num(hh.filter(function (x) { return x.ton < 0; }).length, 0) + ' mã', 'r'],
                ['Chưa có giá', T.num(W.soMaChuaCoGia(), 0) + ' mã', 'y']
            ]) + chartBox('Giá trị tồn theo nhóm hàng',
                Object.keys(gn).map(function (k) { return { l: k, v: T.sum(gn[k], function (x) { return x.giaTri; }) }; })
                    .sort(function (a, b2) { return b2.v - a.v; })) +
                tableBox(duLieu, ['giaTri']);
        }

        else if (cur === 'cong-no') {
            var cnT = T.congNoPhaiThu(locEngine());
            var rs = cnT.ds.filter(function (r) {
                return r.phatSinh > 0 && (!kh || r.id === kh);
            }).map(function (r) {
                return { ma: r.ma, ten: r.ten, soDon: r.soDon, phatSinh: r.phatSinh, daThu: r.daThu,
                    conLai: r.conLai, quaHan: r.quaHan, chuaKhaiHan: r.chuaKhaiHan,
                    traTruoc: r.traTruoc, soNgayQuaHan: r.soNgayQuaHan,
                    hanMucNo: r.hanMucNo, vuotHanMuc: r.vuotHanMuc ? 'Vượt hạn mức' : '',
                    tt: r.conLai <= 0 ? 'Đã thanh toán' : (r.quaHan > 0 ? 'Quá hạn' : 'Còn nợ') };
            });
            duLieu = { ten: 'Tổng hợp công nợ phải thu — chốt ngày ' + T.date(den),
                cols: [{ t: 'Mã KH', k: 'ma' }, { t: 'Khách hàng', k: 'ten' }, { t: 'Số đơn', k: 'soDon', tong: true },
                       { t: 'Phát sinh', k: 'phatSinh', tong: true }, { t: 'Đã thu', k: 'daThu', tong: true },
                       { t: 'Còn phải thu', k: 'conLai', tong: true },
                       { t: 'Trong đó quá hạn', k: 'quaHan', tong: true },
                       { t: 'Chưa khai hạn TT', k: 'chuaKhaiHan', tong: true },
                       { t: 'Khách trả trước', k: 'traTruoc', tong: true },
                       { t: 'Số ngày quá hạn', k: 'soNgayQuaHan' },
                       { t: 'Hạn mức nợ', k: 'hanMucNo' }, { t: 'Cảnh báo', k: 'vuotHanMuc' },
                       { t: 'Tình trạng', k: 'tt' }], rows: rs };
            var tps = T.sum(rs, function (r) { return r.phatSinh; }), tdt = T.sum(rs, function (r) { return r.daThu; });
            b.innerHTML = kpiBox([
                ['Đối tượng công nợ', T.num(rs.length, 0), 'c'],
                ['Tổng phát sinh', T.money(tps) + ' đ', ''],
                ['Đã thu', T.money(tdt) + ' đ', 'g'],
                ['Còn phải thu', T.money(tps - tdt) + ' đ', 'r'],
                ['Tỷ lệ thu hồi', (tps ? T.num(tdt / tps * 100, 1) : 0) + '%', 'y'],
                ['Nợ quá hạn', T.money(T.sum(rs, function (r) { return r.quaHan; })) + ' đ',
                 T.sum(rs, function (r) { return r.quaHan; }) > 0 ? 'r' : 'g'],
                ['Chưa khai hạn TT', T.money(T.sum(rs, function (r) { return r.chuaKhaiHan; })) + ' đ', 'y'],
                ['Khách còn nợ', T.num(rs.filter(function (r) { return r.conLai > 0; }).length, 0), 'y']
            ]) + chartBox('Top 10 khách hàng còn nợ',
                rs.filter(function (r) { return r.conLai > 0; }).slice(0, 10).map(function (r) { return { l: r.ten.substr(0, 26), v: r.conLai }; })) +
                tableBox(duLieu, ['phatSinh', 'daThu', 'conLai', 'quaHan', 'chuaKhaiHan', 'traTruoc']);
        }

        else if (cur === 'dong-tien') {
            var thu = loc(DB.all('phieuThu')).filter(function (p) { return p.trangThai === 'Đã ghi sổ'; });
            var chi = loc(DB.all('phieuChi')).filter(function (p) { return p.trangThai === 'Đã ghi sổ'; });
            var mm = {};
            thu.forEach(function (p) { var k = p.ngay.substr(0, 7); mm[k] = mm[k] || { thu: 0, chi: 0 }; mm[k].thu += p.soTien; });
            chi.forEach(function (p) { var k = p.ngay.substr(0, 7); mm[k] = mm[k] || { thu: 0, chi: 0 }; mm[k].chi += p.soTien; });
            var kk = Object.keys(mm).sort();
            duLieu = { ten: 'Dòng tiền thu chi',
                cols: [{ t: 'Tháng', k: 'thang' }, { t: 'Tiền thu', k: 'thu' }, { t: 'Tiền chi', k: 'chi' }, { t: 'Chênh lệch', k: 'chenh' }],
                rows: kk.map(function (k) {
                    return { thang: 'Tháng ' + Number(k.substr(5)) + '/' + k.substr(0, 4),
                        thu: mm[k].thu, chi: mm[k].chi, chenh: mm[k].thu - mm[k].chi };
                }) };
            var tt = T.sum(thu, function (p) { return p.soTien; }), tc = T.sum(chi, function (p) { return p.soTien; });
            b.innerHTML = kpiBox([
                ['Số phiếu thu', T.num(thu.length, 0), 'c'],
                ['Tổng tiền thu', T.money(tt) + ' đ', 'g'],
                ['Số phiếu chi', T.num(chi.length, 0), 'c'],
                ['Tổng tiền chi', T.money(tc) + ' đ', 'r'],
                ['Chênh lệch', T.money(tt - tc) + ' đ', tt - tc >= 0 ? 'g' : 'r'],
                ['BQ thu / phiếu', T.money(thu.length ? tt / thu.length : 0) + ' đ', '']
            ]) + chartBox('Tiền thu theo tháng', duLieu.rows.map(function (r) { return { l: r.thang, v: r.thu }; })) +
                tableBox(duLieu, ['thu', 'chi', 'chenh']);
        }

        else if (cur === 'theo-cty') {
            /* MỘT BỘ MÁY DUY NHẤT. Trước đây màn hình này cộng lãi gộp của từng
               đơn vị, trong đó giá vốn của EMC · AA · Thái Phong là GIÁ NỘI BỘ —
               phần chênh lệch mà Tản Viên hưởng khi bán nội bộ không được ai
               ghi nhận, nên "lợi nhuận nhóm" luôn thiếu. Engine tính đủ hai tầng
               nên tổng bốn công ty đúng bằng lợi nhuận toàn nhóm. */
            var lc3 = locEngine(); delete lc3.donViId;
            var ds3 = DB.all('donVi').map(function (x) {
                var o = {}; Object.keys(lc3).forEach(function (k) { o[k] = lc3[k]; });
                o.donViId = x.id;
                var k = T.ketQuaKinhDoanh(o);
                var cn = T.ketQuaTheoDonVi(x.id, tu, den);
                return { id: x.id, ten: x.tat, tenDayDu: x.ten,
                         soDon: k.soChungTu, soLuong: k.soLuong,
                         doanhThu: k.doanhThu, giaVon: k.giaVon, chiPhi: k.chiPhi,
                         laiGop: k.loiNhuanGop, loiNhuan: k.loiNhuan,
                         tySuat: k.bienLoiNhuan, daThu: cn.daThu, phaiThu: cn.phaiThu,
                         dtNoiBo: k.laCtyNguon ? k.doanhThuNoiBo : 0 };
            });
            duLieu = { ten: 'Kết quả kinh doanh theo từng công ty',
                cols: [{ t: 'Công ty', k: 'ten' }, { t: 'Tên đầy đủ', k: 'tenDayDu' },
                       { t: 'Số chứng từ', k: 'soDon' }, { t: 'Số lượng bán', k: 'soLuong' },
                       { t: 'Doanh thu', k: 'doanhThu' }, { t: 'Giá vốn', k: 'giaVon' },
                       { t: 'Lợi nhuận gộp', k: 'laiGop' }, { t: 'Chi phí', k: 'chiPhi' },
                       { t: 'Lợi nhuận', k: 'loiNhuan' }, { t: 'Biên lợi nhuận %', k: 'tySuat', tong: false },
                       { t: 'Đã thu', k: 'daThu' }, { t: 'Công nợ phải thu', k: 'phaiThu' }],
                rows: ds3 };
            var nhom3 = T.ketQuaKinhDoanh(lc3);
            var tk3 = T.tonKhoNhom();
            b.innerHTML =
                '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
                'Giá vốn lấy <b>đúng con số đã đóng băng trên từng chứng từ</b> tại thời điểm lập — ' +
                'Tản Viên dùng giá vốn thật của kho, EMC / AA / Thái Phong dùng giá nội bộ. ' +
                'Tản Viên còn có <b>tầng lợi nhuận bán nội bộ</b> cho ba công ty còn lại, nên ' +
                '<b>tổng lợi nhuận bốn công ty đúng bằng lợi nhuận toàn nhóm</b>. ' +
                'Tồn kho chỉ có một, thuộc Tản Viên, nên không phân bổ cho từng công ty.</div></div>' +
                kpiBox([
                ['Doanh thu toàn nhóm', T.money(nhom3.doanhThu) + ' đ', ''],
                ['Giá vốn toàn nhóm', T.money(nhom3.giaVon) + ' đ', 'c'],
                ['Chi phí toàn nhóm', T.money(nhom3.chiPhi) + ' đ', 'y'],
                ['Lợi nhuận toàn nhóm', T.money(nhom3.loiNhuan) + ' đ', 'g'],
                ['Tổng lợi nhuận 4 công ty',
                 T.money(T.sum(ds3, function (r) { return r.loiNhuan; })) + ' đ', 'g'],
                ['Giá trị tồn kho (Tản Viên)', T.money(tk3.giaTri) + ' đ', '']
            ]) + chartBox('Doanh thu theo công ty',
                ds3.filter(function (r) { return r.doanhThu > 0; })
                   .map(function (r) { return { l: r.ten, v: r.doanhThu }; })) +
                chartBox('Lợi nhuận theo công ty',
                ds3.filter(function (r) { return r.loiNhuan > 0; })
                   .map(function (r) { return { l: r.ten, v: r.loiNhuan }; })) +
                tableBox(duLieu, ['doanhThu', 'giaVon', 'laiGop', 'chiPhi', 'loiNhuan', 'daThu', 'phaiThu']);
        }

        else if (cur === 'hop-nhat') {
            var dvs2 = DB.all('donVi');
            var kqs = dvs2.map(function (x) { var k = T.ketQuaTheoDonVi(x.id, tu, den); k.ten = x.tat; return k; });
            var tong2 = T.ketQuaTheoDonVi('', tu, den);
            var tk4 = T.tonKhoNhom();
            var chiTiet = [
                { ct: 'Doanh thu thuần (trước thuế GTGT)', v: tong2.doanhThu },
                { ct: 'Giá vốn hàng bán', v: -tong2.giaVon },
                { ct: 'LỢI NHUẬN GỘP', v: tong2.laiGop, dam: true },
                { ct: 'Chi phí', v: -tong2.chiPhi },
                { ct: 'LỢI NHUẬN', v: tong2.loiNhuan, dam: true },
                { ct: 'Tiền đã thu về', v: tong2.daThu },
                { ct: 'Công nợ phải thu còn lại', v: tong2.phaiThu },
                { ct: 'Giá trị tồn kho theo giá vốn bình quân', v: tk4.giaTri }
            ];
            duLieu = { ten: 'Báo cáo hợp nhất toàn nhóm công ty',
                cols: [{ t: 'Công ty', k: 'ten' }, { t: 'Số chứng từ', k: 'soDon' },
                       { t: 'Doanh thu', k: 'doanhThu' }, { t: 'Giá vốn', k: 'giaVon' },
                       { t: 'Lợi nhuận gộp', k: 'laiGop' }, { t: 'Chi phí', k: 'chiPhi' },
                       { t: 'Lợi nhuận', k: 'loiNhuan' }, { t: 'Biên lợi nhuận %', k: 'bienLoiNhuan', tong: false },
                       { t: 'Công nợ phải thu', k: 'phaiThu' }],
                rows: kqs };
            b.innerHTML = kpiBox([
                ['Tổng doanh thu', T.money(tong2.doanhThu) + ' đ', ''],
                ['Tổng giá vốn', T.money(tong2.giaVon) + ' đ', 'c'],
                ['Tổng chi phí', T.money(tong2.chiPhi) + ' đ', 'y'],
                ['Tổng lợi nhuận', T.money(tong2.loiNhuan) + ' đ', 'g'],
                ['Biên lợi nhuận', T.num(tong2.bienLoiNhuan, 1) + '%', 'y'],
                ['Tổng công nợ phải thu', T.money(tong2.phaiThu) + ' đ', 'r']
            ]) +
                '<div class="card mb12"><div class="card-h"><i class="bi bi-file-earmark-bar-graph"></i> ' +
                'Kết quả hợp nhất toàn nhóm (4 pháp nhân — một cơ sở dữ liệu, một kho, một tồn kho)</div>' +
                '<div class="tablewrap"><table class="grid"><thead><tr><th>Chỉ tiêu</th>' +
                '<th class="num" style="width:220px">Số tiền (đ)</th></tr></thead><tbody>' +
                chiTiet.map(function (x) {
                    return '<tr' + (x.dam ? ' style="background:var(--brand-light)"' : '') + '>' +
                        '<td>' + (x.dam ? '<b>' + x.ct + '</b>' : x.ct) + '</td>' +
                        '<td class="num ' + (x.v < 0 ? 'neg' : '') + '">' + (x.dam ? '<b>' : '') +
                        T.money(x.v) + (x.dam ? '</b>' : '') + '</td></tr>';
                }).join('') + '</tbody></table></div></div>' +
                chartBox('Tỷ trọng doanh thu các công ty',
                    kqs.filter(function (r) { return r.doanhThu > 0; })
                       .map(function (r) { return { l: r.ten, v: r.doanhThu }; })) +
                tableBox(duLieu, ['doanhThu', 'giaVon', 'laiGop', 'phaiThu']);
        }

        else if (cur === 'quan-tri') {
            /* BÁO CÁO QUẢN TRỊ ĐA CÔNG TY
               Doanh thu và lợi nhuận của từng công ty tính từ BÚT TOÁN QUẢN TRỊ NỘI BỘ
               do hệ thống tự sinh: công ty bán mua nội bộ theo giá phân phối của công
               ty nguồn (trừ chiết khấu nội bộ nếu có), công ty nguồn ghi doanh thu nội
               bộ và giá vốn nhập khẩu. Không có chứng từ nội bộ, không có công nợ nội bộ. */
            var dbQT = loc(DB.all('donBan')).filter(function (d) {
                return T.BT_BO_QUA.indexOf(d.trangThai) < 0;
            });
            var qt = T.quanTriDoanhThu(dbQT, goNoiBo);
            var nguonQT = T.ctyNguon() || {};
            var dsQT = DB.all('donVi').map(function (x) {
                var o = qt.theoCty[x.id] || { dt: 0, gv: 0, ln: 0, dtNoiBo: 0 };
                return { donViId: x.id, ten: x.tat, tenDayDu: x.ten,
                    vaiTro: T.laCtyNguon(x.id) ? 'Nhập khẩu · sở hữu kho' : 'Công ty bán hàng',
                    doanhThu: o.dt, giaVon: o.gv, loiNhuan: o.ln,
                    dtNoiBo: o.dtNoiBo || 0,
                    tySuat: o.dt ? Math.round(o.ln / o.dt * 1000) / 10 : 0 };
            /* Lọc theo ID NỘI BỘ của đơn vị, không lọc theo tên viết tắt. */
            }).filter(function (r) { return !dv || r.donViId === dv; });
            duLieu = { ten: 'Doanh thu và lợi nhuận quản trị theo công ty' + (goNoiBo ? ' (loại trừ doanh thu nội bộ)' : ''),
                cols: [{ t: 'Công ty', k: 'ten' }, { t: 'Tên đầy đủ', k: 'tenDayDu' },
                       { t: 'Vai trò', k: 'vaiTro' },
                       { t: 'Doanh thu', k: 'doanhThu' }, { t: 'Giá vốn / giá mua', k: 'giaVon' },
                       { t: 'Lợi nhuận', k: 'loiNhuan' }, { t: 'Tỷ suất %', k: 'tySuat', tong: false },
                       { t: 'Trong đó doanh thu nội bộ', k: 'dtNoiBo' }],
                rows: dsQT };
            var soBT = DB.all('butToanNB').filter(function (x) {
                return x.ngay >= tu && x.ngay <= den; }).length;
            b.innerHTML =
                '<div class="note b mb12"><i class="bi bi-diagram-3"></i><div>' +
                '<b>Nghiệp vụ quản trị nội bộ do hệ thống tự xử lý trong nền.</b> ' +
                'Khi công ty thực hiện là ' + DB.all('donVi').filter(function (x) { return !T.laCtyNguon(x.id); })
                    .map(function (x) { return T.esc(x.tat); }).join(' · ') +
                ', hệ thống tự sinh bút toán quản trị: công ty bán mua nội bộ theo <b>' +
                T.esc(T.cauHinhDaCongTy().cotGiaGoc) + '</b> của ' + T.esc(nguonQT.tat || '') +
                ' (trừ chiết khấu nội bộ khai trên chứng từ). ' +
                'Không sinh chứng từ nội bộ, không sinh công nợ nội bộ, không sinh kho nội bộ và ' +
                'người dùng không phải thao tác gì thêm.</div></div>' +
                kpiBox([
                    ['Doanh thu ' + (goNoiBo ? 'ngoài nhóm' : 'toàn hệ thống'), T.money(qt.toanHT.dt) + ' đ', ''],
                    ['Giá vốn', T.money(qt.toanHT.gv) + ' đ', 'c'],
                    ['Lợi nhuận', T.money(qt.toanHT.dt - qt.toanHT.gv) + ' đ', 'g'],
                    ['Doanh thu nội bộ', T.money(qt.toanHT.dtNoiBo) + ' đ', 'y'],
                    ['Số bút toán tự sinh', T.num(soBT, 0), 'c'],
                    ['Chế độ xem', goNoiBo ? 'Loại trừ nội bộ' : 'Bao gồm nội bộ', '']
                ]) +
                chartBox('Doanh thu theo công ty', dsQT.filter(function (r) { return r.doanhThu > 0; })
                    .map(function (r) { return { l: r.ten, v: r.doanhThu }; })) +
                chartBox('Lợi nhuận theo công ty', dsQT.filter(function (r) { return r.loiNhuan !== 0; })
                    .map(function (r) { return { l: r.ten, v: r.loiNhuan }; })) +
                tableBox(duLieu, ['doanhThu', 'giaVon', 'loiNhuan', 'dtNoiBo']);
        }

        /* ============================ GIÁ VỐN THEO MẶT HÀNG ============================
           Đọc thẳng danh mục hàng hóa và bộ máy giá vốn bình quân gia quyền hiện
           có — báo cáo KHÔNG tự tính lại giá vốn theo cách riêng. */
        else if (cur === 'gia-von') {
            var tGV = T.tonKhoTaiNgay(den);          /* MỘT lần phát lại sổ kho */
            var dsGV = DB.all('hangHoa').filter(function (h) { return hopNhom(h.id); })
                .map(function (h) {
                    var t = tGV;
                    var sl = Number((t.ton || {})[h.id]) || 0;
                    var bq = Number((t.bq || {})[h.id]) || 0;
                    return { ma: h.ma, model: h.model || h.ma, ten: h.ten, dvt: h.dvt || '',
                             nhom: h.nhom || '', hangSX: h.hangSX || h.thuongHieu || '',
                             xuatXu: h.xuatXu || '', trangThai: h.trangThai || '',
                             ton: sl, bq: bq, giaTri: Math.round(sl * bq) };
                }).filter(function (r) { return r.ton || r.bq; });
            dsGV.sort(function (a, b2) { return b2.giaTri - a.giaTri; });
            duLieu = { ten: 'Giá vốn bình quân gia quyền theo mặt hàng — chốt ngày ' + T.date(den),
                cols: [{ t: 'Mã hàng', k: 'ma' }, { t: 'Model', k: 'model' }, { t: 'Tên hàng hóa', k: 'ten' },
                       { t: 'ĐVT', k: 'dvt' }, { t: 'Nhóm hàng', k: 'nhom' }, { t: 'Hãng sản xuất', k: 'hangSX' },
                       { t: 'Xuất xứ', k: 'xuatXu' }, { t: 'Tồn', k: 'ton', tong: true },
                       { t: 'Giá vốn bình quân', k: 'bq' }, { t: 'Giá trị tồn', k: 'giaTri', tong: true }],
                rows: dsGV };
            b.innerHTML = kpiBox([
                ['Số mã còn theo dõi', T.num(dsGV.length, 0), ''],
                ['Tổng số lượng tồn', T.num(T.sum(dsGV, function (r) { return r.ton; }), 0), ''],
                ['Tổng giá trị tồn', T.money(T.sum(dsGV, function (r) { return r.giaTri; })) + ' đ', 'b']
            ]) +
            '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>Giá vốn là <b>bình quân gia ' +
            'quyền di động</b> theo đúng bộ máy đang chạy của phần mềm, chốt tại ngày ' + T.date(den) +
            '. Không dùng FIFO, không gắn giá vốn với từng lô bán.</div></div>' +
            tableBox(duLieu, ['bq', 'giaTri']);
        }

        /* ============================ NHẬP - XUẤT - TỒN ============================
           Gọi đúng T.nxt của Business Engine — cùng bộ máy với màn hình Kho. */
        else if (cur === 'nxt') {
            var dsNXT = T.nxt(tu, den).filter(function (r) { return !nhom || r.nhomHang === nhom; });
            duLieu = { ten: 'Nhập - Xuất - Tồn từ ' + T.date(tu) + ' đến ' + T.date(den),
                cols: [{ t: 'Mã hàng', k: 'ma' }, { t: 'Tên hàng hóa', k: 'ten' }, { t: 'ĐVT', k: 'dvt' },
                       { t: 'Nhóm hàng', k: 'nhomHang' },
                       { t: 'Tồn đầu — SL', k: 'slDau', tong: true }, { t: 'Tồn đầu — Giá trị', k: 'gtDau', tong: true },
                       { t: 'Nhập — SL', k: 'slNhap', tong: true }, { t: 'Nhập — Giá trị', k: 'gtNhap', tong: true },
                       { t: 'Xuất — SL', k: 'slXuat', tong: true }, { t: 'Xuất — Giá trị', k: 'gtXuat', tong: true },
                       { t: 'Tồn cuối — SL', k: 'slCuoi', tong: true }, { t: 'Tồn cuối — Giá trị', k: 'gtCuoi', tong: true }],
                rows: dsNXT };
            b.innerHTML = kpiBox([
                ['Tồn đầu kỳ', T.money(T.sum(dsNXT, function (r) { return r.gtDau; })) + ' đ', ''],
                ['Nhập trong kỳ', T.money(T.sum(dsNXT, function (r) { return r.gtNhap; })) + ' đ', 'g'],
                ['Xuất trong kỳ', T.money(T.sum(dsNXT, function (r) { return r.gtXuat; })) + ' đ', 'c'],
                ['Tồn cuối kỳ', T.money(T.sum(dsNXT, function (r) { return r.gtCuoi; })) + ' đ', 'b']
            ]) + tableBox(duLieu, ['gtDau', 'gtNhap', 'gtXuat', 'gtCuoi']);
        }

        /* ============================ CÔNG NỢ PHẢI TRẢ ============================ */
        else if (cur === 'phai-tra') {
            var pt2 = T.congNoPhaiTra(locEngine());
            var dsPT = pt2.ds.filter(function (r) { return !ncc || r.id === ncc; });
            duLieu = { ten: 'Công nợ phải trả nhà cung cấp — chốt ngày ' + T.date(den),
                cols: [{ t: 'Mã NCC', k: 'ma' }, { t: 'Nhà cung cấp', k: 'ten' },
                       { t: 'Số đơn mua', k: 'soDon' }, { t: 'Giá trị hàng đã về kho', k: 'phatSinh', tong: true },
                       { t: 'Đã trả', k: 'daTra', tong: true }, { t: 'Còn phải trả', k: 'conLai', tong: true },
                       { t: 'Trong đó quá hạn', k: 'quaHan', tong: true },
                       { t: 'Chưa khai hạn', k: 'chuaKhaiHan', tong: true },
                       { t: 'Đã ứng trước', k: 'traTruoc', tong: true },
                       { t: 'Số ngày quá hạn', k: 'soNgayQuaHan' }],
                rows: dsPT };
            b.innerHTML = kpiBox([
                ['Giá trị hàng đã về kho', T.money(T.sum(dsPT, function (r) { return r.phatSinh; })) + ' đ', ''],
                ['Đã trả nhà cung cấp', T.money(T.sum(dsPT, function (r) { return r.daTra; })) + ' đ', 'g'],
                ['Còn phải trả', T.money(T.sum(dsPT, function (r) { return Math.max(0, r.conLai); })) + ' đ', 'y'],
                ['Đã ứng trước cho NCC', T.money(T.sum(dsPT, function (r) { return r.traTruoc; })) + ' đ', 'b']
            ]) +
            '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>Công nợ phải trả chỉ phát sinh ' +
            'khi <b>hàng đã thật sự vào kho</b>. Trả tiền nhiều hơn phần hàng đã về là <b>ứng trước</b>, ' +
            'không phải công nợ âm. Chỉ phiếu chi trả tiền hàng mới làm giảm công nợ.</div></div>' +
            tableBox(duLieu, ['phatSinh', 'daTra', 'conLai', 'quaHan', 'chuaKhaiHan', 'traTruoc']);
        }

        /* ======================= MUA HÀNG THEO NHÀ CUNG CẤP ======================= */
        else if (cur === 'theo-ncc') {
            var mua = {};
            loc(DB.all('donMua')).forEach(function (d) {
                if (!T.donMuaPhatSinhCongNo(d)) return;
                var id = d.nhaCungCapId || '—';
                if (!mua[id]) {
                    var n = DB.get('nhaCungCap', id) || {};
                    mua[id] = { id: id, ma: n.ma || '', ten: n.ten || d.nhaCungCap || '(không xác định)',
                                soDon: 0, giaTri: 0, daTra: 0, conLai: 0, lanCuoi: '' };
                }
                mua[id].soDon++;
                mua[id].giaTri += Number(d.tongCong) || 0;
                if (String(d.ngay || '') > mua[id].lanCuoi) mua[id].lanCuoi = d.ngay;
            });
            var dsNCC = Object.keys(mua).map(function (id) {
                var n = T.congNoNCC(id, locEngine());
                mua[id].daTra = n.daTra; mua[id].conLai = Math.max(0, n.conLai);
                return mua[id];
            }).filter(function (r) { return !ncc || r.id === ncc; });
            dsNCC.sort(function (a, b2) { return b2.giaTri - a.giaTri; });
            duLieu = { ten: 'Mua hàng theo nhà cung cấp từ ' + T.date(tu) + ' đến ' + T.date(den),
                cols: [{ t: 'Mã NCC', k: 'ma' }, { t: 'Nhà cung cấp', k: 'ten' },
                       { t: 'Số đơn mua', k: 'soDon', tong: true },
                       { t: 'Giá trị mua trong kỳ', k: 'giaTri', tong: true },
                       { t: 'Đã trả (lũy kế)', k: 'daTra', tong: true },
                       { t: 'Còn phải trả (lũy kế)', k: 'conLai', tong: true },
                       { t: 'Lần mua gần nhất', k: 'lanCuoi' }],
                rows: dsNCC };
            b.innerHTML = kpiBox([
                ['Số nhà cung cấp', T.num(dsNCC.length, 0), ''],
                ['Giá trị mua trong kỳ', T.money(T.sum(dsNCC, function (r) { return r.giaTri; })) + ' đ', 'b'],
                ['Còn phải trả', T.money(T.sum(dsNCC, function (r) { return r.conLai; })) + ' đ', 'y']
            ]) + chartBox('Giá trị mua theo nhà cung cấp',
                dsNCC.slice(0, 12).map(function (r) { return { l: r.ten, v: r.giaTri }; })) +
            tableBox(duLieu, ['giaTri', 'daTra', 'conLai']);
        }

        /* ============================ SỔ THU - CHI CHI TIẾT ============================
           Mỗi dòng truy được: đối tượng → chứng từ → đơn hàng/dự án → số tiền →
           ngày → trạng thái → người lập. */
        else if (cur === 'thu-chi') {
            var sTC = [];
            loc(DB.all('phieuThu')).forEach(function (p) {
                if (p.trangThai !== 'Đã ghi sổ') return;
                sTC.push({ ngay: p.ngay, loai: 'Thu', so: p.so,
                    doiTuong: p.khachHang || (DB.get('khachHang', p.khachHangId) || {}).ten || '',
                    noiDung: p.lyDo || p.noiDung || '', duAn: p.duAn || '',
                    chungTu: p.donBanSo || p.hopDongSo || p.deNghiTTSo || '',
                    thu: Number(p.soTien) || 0, chi: 0,
                    hinhThuc: p.hinhThuc || '', trangThai: p.trangThai,
                    nguoiLap: p.nguoiLap || p._nguoiTao || '' });
            });
            loc(DB.all('phieuChi')).forEach(function (p) {
                if (p.trangThai !== 'Đã ghi sổ') return;
                sTC.push({ ngay: p.ngay, loai: 'Chi', so: p.so,
                    doiTuong: p.nhaCungCap || p.doiTuong ||
                        (DB.get('nhaCungCap', p.nhaCungCapId) || {}).ten || '',
                    noiDung: p.lyDo || p.noiDung || '', duAn: p.duAn || '',
                    chungTu: p.donMuaSo || p.khoanMuc || '',
                    thu: 0, chi: Number(p.soTien) || 0,
                    hinhThuc: p.hinhThuc || '', trangThai: p.trangThai,
                    nguoiLap: p.nguoiLap || p._nguoiTao || '' });
            });
            sTC.sort(function (a, b2) { return String(a.ngay) < String(b2.ngay) ? -1 : 1; });
            var luy = 0;
            sTC.forEach(function (r) { luy += r.thu - r.chi; r.luyKe = luy; });
            duLieu = { ten: 'Sổ thu - chi chi tiết từ ' + T.date(tu) + ' đến ' + T.date(den),
                cols: [{ t: 'Ngày', k: 'ngay' }, { t: 'Loại', k: 'loai' }, { t: 'Số chứng từ', k: 'so' },
                       { t: 'Đối tượng', k: 'doiTuong' }, { t: 'Nội dung', k: 'noiDung' },
                       { t: 'Dự án', k: 'duAn' }, { t: 'Chứng từ gốc', k: 'chungTu' },
                       { t: 'Tiền vào', k: 'thu', tong: true }, { t: 'Tiền ra', k: 'chi', tong: true },
                       { t: 'Lũy kế trong kỳ', k: 'luyKe' },
                       { t: 'Hình thức', k: 'hinhThuc' }, { t: 'Trạng thái', k: 'trangThai' },
                       { t: 'Người lập', k: 'nguoiLap' }],
                rows: sTC };
            var dtk = T.dongTienKy(locEngine());
            b.innerHTML = kpiBox([
                ['Tiền thực tế đầu kỳ', T.money(dtk.dauKy) + ' đ', ''],
                ['Tiền vào trong kỳ', T.money(dtk.thu) + ' đ', 'g'],
                ['Tiền ra trong kỳ', T.money(dtk.chi) + ' đ', 'c'],
                /* v18.6.0 — Logic 1: hàng đã nhập kho là đã trả tiền, khoản này
                   không có phiếu chi nên phải hiện riêng, nếu không "đầu kỳ + phát
                   sinh" sẽ không ra "cuối kỳ". */
                ['Trả NCC qua nhập kho', T.money(dtk.chiNhapKho) + ' đ', 'c'],
                ['Tiền thực tế cuối kỳ', T.money(dtk.cuoiKy) + ' đ', dtk.cuoiKy >= 0 ? 'b' : 'r']
            ]) + tableBox(duLieu, ['thu', 'chi', 'luyKe']);
        }

        /* ================= KẾT QUẢ THEO THÁNG · QUÝ · NĂM ================= */
        else if (cur === 'kq-ky') {
            var bq = buoc === 'nam' ? 'nam' : 'thang';
            var kyR = T.kyChon('tuyChon', { tuNgay: tu, denNgay: den });
            kyR.buoc = bq;
            var kk = T.ketQuaTheoKy(locEngine(), bq, T.khungKy(kyR, locEngine()));
            var dsK = kk.ds;
            if (buoc === 'quy') {
                var gom = {}, tt = [];
                dsK.forEach(function (m) {
                    var q = m.khoa.substr(0, 4) + '-Q' + (Math.floor((Number(m.khoa.substr(5, 2)) - 1) / 3) + 1);
                    if (!gom[q]) { gom[q] = { khoa: q, nhan: 'Quý ' + q.substr(6) + '/' + q.substr(0, 4),
                        doanhThu: 0, giaVon: 0, chiPhi: 0, loiNhuan: 0, soChungTu: 0 }; tt.push(gom[q]); }
                    gom[q].doanhThu += m.doanhThu; gom[q].giaVon += m.giaVon;
                    gom[q].chiPhi += m.chiPhi; gom[q].loiNhuan += m.loiNhuan;
                    gom[q].soChungTu += m.soChungTu;
                });
                tt.forEach(function (x) {
                    x.bienLoiNhuan = x.doanhThu ? Math.round(x.loiNhuan / x.doanhThu * 1000) / 10 : 0; });
                dsK = tt;
            }
            duLieu = { ten: 'Kết quả kinh doanh theo ' +
                    (buoc === 'nam' ? 'năm' : (buoc === 'quy' ? 'quý' : 'tháng')) +
                    ' từ ' + T.date(tu) + ' đến ' + T.date(den),
                cols: [{ t: buoc === 'nam' ? 'Năm' : (buoc === 'quy' ? 'Quý' : 'Tháng'), k: 'nhan' },
                       { t: 'Số chứng từ', k: 'soChungTu', tong: true },
                       { t: 'Doanh thu', k: 'doanhThu', tong: true },
                       { t: 'Giá vốn', k: 'giaVon', tong: true },
                       { t: 'Chi phí', k: 'chiPhi', tong: true },
                       { t: 'Lợi nhuận', k: 'loiNhuan', tong: true },
                       { t: 'Biên lợi nhuận %', k: 'bienLoiNhuan', tong: false }],
                rows: dsK };
            b.innerHTML = kpiBox([
                ['Doanh thu', T.money(kk.tong.doanhThu) + ' đ', ''],
                ['Giá vốn', T.money(kk.tong.giaVon) + ' đ', 'c'],
                ['Chi phí', T.money(kk.tong.chiPhi) + ' đ', 'y'],
                ['Lợi nhuận', T.money(kk.tong.loiNhuan) + ' đ', kk.tong.loiNhuan >= 0 ? 'g' : 'r']
            ]) + chartBox('Doanh thu theo kỳ',
                dsK.map(function (m) { return { l: m.nhan, v: m.doanhThu }; })) +
            tableBox(duLieu, ['doanhThu', 'giaVon', 'chiPhi', 'loiNhuan']);
        }

        /* ================= GÓP VỐN CỔ ĐÔNG — CHỈ TẢN VIÊN ================= */
        else if (cur === 'gop-von' || cur === 'ln-co-dong') {
            var dvVon = T.donViVon() || {};
            var locV = { tuNgay: tu, denNgay: den };
            var bcV = T.baoCaoVonKy(locV);
            var dsCD = (bcV.B || []).map(function (c) {
                return { ten: (c.coDong || {}).ten || '', tyLe: c.tyLe,
                         phaiGop: c.nghiaVu.cuoiKy, daGop: c.daGop.cuoiKy,
                         conPhaiGop: c.conPhaiGop, laiChamGop: c.lai.cuoiKy,
                         daThuHoi: c.daThuHoi, dangQuayVong: c.vonTrongHang,
                         duocChia: c.duocChia, daNhan: c.daNhanTrongKy,
                         conDuocNhan: c.conDuocNhan };
            });
            function gtA(ten) {
                var x = (bcV.A || []).filter(function (r) { return r.ct.indexOf(ten) === 0; })[0];
                return x ? x.gt : 0;
            }
            var tenBC = (cur === 'gop-von' ? 'Góp vốn cổ đông ' : 'Lợi nhuận cổ đông ') +
                dvVon.tat + ' từ ' + T.date(tu) + ' đến ' + T.date(den);
            duLieu = { ten: tenBC,
                cols: cur === 'gop-von'
                    ? [{ t: 'Cổ đông', k: 'ten' }, { t: 'Tỷ lệ sở hữu %', k: 'tyLe', tong: false },
                       { t: 'Tổng phải góp', k: 'phaiGop', tong: true },
                       { t: 'Đã góp', k: 'daGop', tong: true },
                       { t: 'Còn phải góp', k: 'conPhaiGop', tong: true },
                       { t: 'Lãi chậm góp', k: 'laiChamGop', tong: true },
                       { t: 'Đã thu hồi vốn', k: 'daThuHoi', tong: true },
                       { t: 'Vốn đang quay vòng', k: 'dangQuayVong', tong: true }]
                    : [{ t: 'Cổ đông', k: 'ten' }, { t: 'Tỷ lệ sở hữu %', k: 'tyLe', tong: false },
                       { t: 'Lợi nhuận được chia', k: 'duocChia', tong: true },
                       { t: 'Lợi nhuận đã nhận', k: 'daNhan', tong: true },
                       { t: 'Còn được nhận', k: 'conDuocNhan', tong: true }],
                rows: dsCD };
            b.innerHTML =
                '<div class="note b mb12"><i class="bi bi-shield-lock"></i><div><b>Góp vốn, thu hồi vốn, ' +
                'lãi chậm góp và phân chia lợi nhuận cổ đông CHỈ áp dụng cho ' + T.esc(dvVon.ten || dvVon.tat) +
                '.</b> Lợi nhuận của các công ty khác trong nhóm không được đưa vào đây. ' +
                'Bộ lọc Công ty ở trên không tác động tới báo cáo này.</div></div>' +
                kpiBox(cur === 'gop-von'
                    ? [['Tổng phải góp', T.money(T.sum(dsCD, function (r) { return r.phaiGop; })) + ' đ', ''],
                       ['Đã góp', T.money(T.sum(dsCD, function (r) { return r.daGop; })) + ' đ', 'g'],
                       ['Còn phải góp', T.money(T.sum(dsCD, function (r) { return r.conPhaiGop; })) + ' đ', 'y'],
                       ['Lãi chậm góp', T.money(T.sum(dsCD, function (r) { return r.laiChamGop; })) + ' đ', 'r']]
                    : [['Lợi nhuận sau chi phí', T.money(gtA('Lợi nhuận sau chi phí')) + ' đ',
                        gtA('Lợi nhuận sau chi phí') >= 0 ? 'g' : 'r'],
                       ['Được phép phân phối', T.money(gtA('Lợi nhuận được phép phân phối')) + ' đ', 'b'],
                       ['Đã chia trong kỳ', T.money(gtA('Lợi nhuận đã chia trong kỳ')) + ' đ', ''],
                       ['Còn chưa chia', T.money(gtA('Lợi nhuận chưa chia')) + ' đ', 'y']]) +
                tableBox(duLieu, cur === 'gop-von'
                    ? ['phaiGop', 'daGop', 'conPhaiGop', 'laiChamGop', 'daThuHoi', 'dangQuayVong']
                    : ['duocChia', 'daNhan', 'conDuocNhan']);
        }

        /* ============================ DẤU VẾT CHỨNG TỪ ============================
           Ai tạo · lúc nào · ai sửa lần cuối · lúc nào · trạng thái, cho mọi
           chứng từ trong kỳ. Không có con số nào trong báo cáo mà không truy
           ngược được về một dòng ở đây. */
        else if (cur === 'dau-vet') {
            var BANG = ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'donMua',
                        'loNhap', 'phieuNhap', 'phieuThu', 'phieuChi', 'giaoDichVon'];
            var dsDV = T.soDauVet(BANG, locEngine()).filter(function (r) {
                return (!da || (DB.get(r.coll, r.id) || {}).duAnId === da) &&
                       (!kh || (DB.get(r.coll, r.id) || {}).khachHangId === kh) &&
                       (!ncc || (DB.get(r.coll, r.id) || {}).nhaCungCapId === ncc);
            });
            duLieu = { ten: 'Dấu vết chứng từ từ ' + T.date(tu) + ' đến ' + T.date(den),
                cols: [{ t: 'Loại chứng từ', k: 'bang' }, { t: 'Số chứng từ', k: 'so' },
                       { t: 'Ngày', k: 'ngay' }, { t: 'Nội dung / đối tượng', k: 'noiDung' },
                       { t: 'Dự án', k: 'duAn' }, { t: 'Đơn vị', k: 'donVi' },
                       { t: 'Số tiền', k: 'soTien', tong: true },
                       { t: 'Trạng thái', k: 'trangThai' },
                       { t: 'Người lập', k: 'nguoiLap' },
                       { t: 'Người tạo', k: 'nguoiTao' }, { t: 'Thời điểm tạo', k: 'lucTao' },
                       { t: 'Người sửa cuối', k: 'nguoiSua' }, { t: 'Thời điểm sửa', k: 'lucSua' },
                       { t: 'Đã sửa', k: 'daSua' }],
                rows: dsDV };
            var daSua = dsDV.filter(function (r) { return r.daSua; });
            b.innerHTML = kpiBox([
                ['Số chứng từ trong kỳ', T.num(dsDV.length, 0), ''],
                ['Đã bị sửa sau khi tạo', T.num(daSua.length, 0), daSua.length ? 'y' : 'g'],
                ['Chưa ghi nhận người tạo', T.num(dsDV.filter(function (r) {
                    return !r.nguoiTao; }).length, 0), 'c']
            ]) +
            '<div class="note b mb12"><i class="bi bi-shield-check"></i><div>Người tạo và người sửa ' +
            'được ghi <b>tự động khi lưu</b> cho mọi bảng dữ liệu — không phải khai tay, không sửa được ' +
            'từ giao diện. Chứng từ tạo trước khi phần mềm có cơ chế này sẽ để trống ô Người tạo.</div></div>' +
            tableBox(duLieu, ['soTien']);
        }

        else if (cur === 'truy-vet') {
            b.innerHTML =
                '<div class="card mb12"><div class="card-h"><i class="bi bi-search-heart"></i> ' +
                'Chọn mặt hàng cần truy vết</div><div class="card-b">' +
                '<div class="fld" style="max-width:520px"><label>Mã hàng / tên hàng hóa</label>' +
                '<div id="tvHH"></div></div>' +
                '<div class="note b"><i class="bi bi-diagram-3"></i><div>Hệ thống dựng lại toàn bộ chuỗi: ' +
                '<b>Lô nhập → Giá vốn → Giá nội bộ từng công ty → Báo giá → Đơn bán → Phiếu xuất → ' +
                'Biên bản giao hàng → Khách hàng → Lợi nhuận</b>.</div></div>' +
                '</div></div><div id="tvKQ"></div>';
            UI.combo('#tvHH', {
                items: DB.all('hangHoa').map(function (x) {
                    return { v: x.ma, t: x.ma + ' — ' + x.ten, s: x.nhom || '' }; }),
                value: b._ma || '', placeholder: '— Gõ mã hoặc tên hàng để truy vết —',
                onChange: function (v) { b._ma = v; veTruyVet(b.querySelector('#tvKQ'), v); }
            });
            if (b._ma) veTruyVet(b.querySelector('#tvKQ'), b._ma);
            duLieu = b._ma ? duLieuTruyVet(b._ma) : { ten: 'Truy vết một mặt hàng', cols: [], rows: [] };
        }

        else if (cur === 'nhan-vien') {
            var ds = DB.all('nhanVien').map(function (n) {
                var d = W.hieuQuaNhanVien(n.id, tu, den);
                return { ma: n.ma, hoTen: n.hoTen, chucVu: n.chucVu, phongBan: n.phongBan,
                    soBG: d.soBG, bgChot: d.bgChot,
                    tyLe: d.soBG ? Math.round(d.bgChot / d.soBG * 1000) / 10 : 0,
                    soDB: d.soDB, doanhSo: d.doanhSo, soHD: d.soHD, giaTriHD: d.giaTriHD,
                    daThu: d.daThu, conNo: d.doanhSo - d.daThu };
            }).sort(function (a, b2) { return b2.doanhSo - a.doanhSo; });
            duLieu = { ten: 'Hiệu quả làm việc theo nhân viên',
                cols: [{ t: 'Mã NV', k: 'ma' }, { t: 'Họ và tên', k: 'hoTen' }, { t: 'Chức vụ', k: 'chucVu' },
                       { t: 'Số báo giá', k: 'soBG' }, { t: 'Đã chốt', k: 'bgChot' }, { t: 'Tỷ lệ chốt %', k: 'tyLe', tong: false },
                       { t: 'Số đơn bán', k: 'soDB' }, { t: 'Doanh số', k: 'doanhSo' },
                       { t: 'Số hợp đồng', k: 'soHD' }, { t: 'Giá trị hợp đồng', k: 'giaTriHD' },
                       { t: 'Đã thu', k: 'daThu' }, { t: 'Còn phải thu', k: 'conNo' }],
                rows: ds };
            b.innerHTML = kpiBox([
                ['Số nhân viên', T.num(ds.length, 0), 'c'],
                ['Tổng doanh số', T.money(T.sum(ds, function (r) { return r.doanhSo; })) + ' đ', 'g'],
                ['Nhân viên dẫn đầu', ds[0] ? ds[0].hoTen : '—', ''],
                ['Doanh số dẫn đầu', T.money(ds[0] ? ds[0].doanhSo : 0) + ' đ', ''],
                ['Tổng báo giá', T.num(T.sum(ds, function (r) { return r.soBG; }), 0), ''],
                ['Tỷ lệ chốt bình quân', (function () {
                    var a = T.sum(ds, function (r) { return r.soBG; }), c = T.sum(ds, function (r) { return r.bgChot; });
                    return a ? T.num(c / a * 100, 1) + '%' : '0%'; })(), 'y']
            ]) + chartBox('Doanh số theo nhân viên',
                ds.filter(function (r) { return r.doanhSo > 0; }).map(function (r) { return { l: r.hoTen, v: r.doanhSo }; })) +
                tableBox(duLieu, ['doanhSo', 'giaTriHD', 'daThu', 'conNo']);
        }

        else if (cur === 'lai-lo') {
            /* BÁO CÁO LÃI LỖ — cửa duy nhất trả lời "kỳ này lãi bao nhiêu".
               Toàn bộ số do Business Engine cấp, báo cáo không tự cộng lại. */
            var kqL = T.ketQuaKinhDoanh(locEngine());
            var dsCty = T.ketQuaTungDonVi(locEngine());
            duLieu = { ten: 'Báo cáo lãi lỗ',
                cols: [{ t: 'Chỉ tiêu', k: 'ten' }, { t: 'Số tiền', k: 'soTien' },
                       { t: 'Tỷ lệ trên doanh thu %', k: 'ty', tong: false }],
                rows: [
                    { ten: 'Doanh thu (trước thuế GTGT)', soTien: kqL.doanhThu, ty: kqL.doanhThu ? 100 : 0 },
                    { ten: 'Giá vốn hàng bán', soTien: -kqL.giaVon,
                      ty: kqL.doanhThu ? -Math.round(kqL.giaVon / kqL.doanhThu * 1000) / 10 : 0 },
                    { ten: 'LỢI NHUẬN GỘP', soTien: kqL.loiNhuanGop, ty: kqL.bienLoiNhuanGop },
                    { ten: 'Chi phí', soTien: -kqL.chiPhi,
                      ty: kqL.doanhThu ? -Math.round(kqL.chiPhi / kqL.doanhThu * 1000) / 10 : 0 },
                    { ten: 'LỢI NHUẬN', soTien: kqL.loiNhuan, ty: kqL.bienLoiNhuan }
                ].concat(kqL.chiPhiChiTiet.theoKhoanMuc.map(function (k) {
                    return { ten: '     · ' + k.ten, soTien: -k.soTien,
                             ty: kqL.doanhThu ? -Math.round(k.soTien / kqL.doanhThu * 1000) / 10 : 0 };
                })) };
            b.innerHTML = kpiBox([
                ['Doanh thu', T.money(kqL.doanhThu) + ' đ', ''],
                ['Giá vốn', T.money(kqL.giaVon) + ' đ', 'c'],
                ['Chi phí', T.money(kqL.chiPhi) + ' đ', 'y'],
                ['Lợi nhuận', T.money(kqL.loiNhuan) + ' đ', kqL.loiNhuan >= 0 ? 'g' : 'r'],
                ['Biên lợi nhuận', T.num(kqL.bienLoiNhuan, 1) + '%', kqL.bienLoiNhuan >= 0 ? 'g' : 'r'],
                ['Chứng từ ghi nhận', T.num(kqL.soChungTu, 0), '']
            ]) +
            '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
            '<b>Doanh thu ghi nhận đúng một lần cho mỗi giao dịch.</b> Một thương vụ đi qua báo giá → đơn bán ' +
            '→ hợp đồng → phiếu xuất → nghiệm thu → đề nghị thanh toán → phiếu thu; hệ thống lấy chứng từ có ' +
            'giá trị pháp lý cao nhất đang có (đơn bán → hợp đồng → phiếu xuất) làm căn cứ, không cộng dồn các ' +
            'chứng từ còn lại. Doanh thu luôn tính trước thuế GTGT.<br>' +
            '<b>Giá vốn</b> ' + (dv ? (T.laCtyNguon(dv)
                ? 'của đơn vị nguồn là giá vốn thật của kho.'
                : 'của đơn vị phát hành là giá nội bộ đã đóng băng trên từng chứng từ.')
                : 'toàn nhóm là giá vốn thật của kho — phần luân chuyển nội bộ tự khử.') +
            '<br><b>Chi phí</b> lấy từ Phiếu chi, chỉ những khoản mục được khai là tính vào chi phí. ' +
            'Tiền hàng và chi phí nhập khẩu đã nằm trong giá vốn nên không tính lại.</div></div>' +
            tableBox(duLieu, ['soTien']) +
            /* Đang lọc một công ty thì bảng "theo công ty" là thừa và gây hiểu
               nhầm — tổng của nó không khớp với con số ở đầu màn hình. */
            (!dv && dsCty.length > 1 ? bangTheoChieu('Kết quả theo công ty', dsCty) : '');
        }

        else if (cur === 'lai-lo-da') {
            var dsDA = T.ketQuaTungDuAn(locEngine());
            duLieu = { ten: 'Lãi lỗ theo dự án',
                cols: [{ t: 'Dự án / công trình', k: 'ten' }, { t: 'Doanh thu', k: 'doanhThu' },
                       { t: 'Giá vốn', k: 'giaVon' }, { t: 'Chi phí', k: 'chiPhi' },
                       { t: 'Lợi nhuận', k: 'loiNhuan' }, { t: 'Biên lợi nhuận %', k: 'bien', tong: false }],
                rows: dsDA.map(function (r) {
                    return { ten: r.ten, doanhThu: r.doanhThu, giaVon: r.giaVon,
                             chiPhi: r.chiPhi, loiNhuan: r.loiNhuan, bien: r.bienLoiNhuan };
                }) };
            b.innerHTML = kpiBox([
                ['Số dự án có phát sinh', T.num(dsDA.length, 0), ''],
                ['Tổng doanh thu', T.money(T.sum(dsDA, function (r) { return r.doanhThu; })) + ' đ', ''],
                ['Tổng giá vốn', T.money(T.sum(dsDA, function (r) { return r.giaVon; })) + ' đ', 'c'],
                ['Tổng chi phí', T.money(T.sum(dsDA, function (r) { return r.chiPhi; })) + ' đ', 'y'],
                ['Tổng lợi nhuận', T.money(T.sum(dsDA, function (r) { return r.loiNhuan; })) + ' đ', 'g'],
                ['Dự án lỗ', T.num(dsDA.filter(function (r) { return r.loiNhuan < 0; }).length, 0), 'r']
            ]) +
            '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
            'Một dự án gộp <b>chứng từ bán hàng</b> và <b>phiếu chi</b> cùng gắn dự án đó. ' +
            'Muốn chi phí công trình vào đúng dự án thì khi lập Phiếu chi phải chọn Dự án.</div></div>' +
            chartBox('Lợi nhuận theo dự án',
                dsDA.slice(0, 12).map(function (r) { return { l: r.ten, v: r.loiNhuan }; })) +
            tableBox(duLieu, ['doanhThu', 'giaVon', 'chiPhi', 'loiNhuan']);
        }

        else if (cur === 'chi-phi') {
            var cpL = T.chiPhiKy(locEngine());
            var tongCP = cpL.tong || 1;
            duLieu = { ten: 'Chi phí theo khoản mục',
                cols: [{ t: 'Khoản mục chi', k: 'ten' }, { t: 'Số phiếu', k: 'soPhieu' },
                       { t: 'Số tiền', k: 'soTien' }, { t: 'Tỷ trọng %', k: 'tyTrong', tong: false }],
                rows: cpL.theoKhoanMuc.map(function (k) {
                    return { ten: k.ten, soPhieu: k.soPhieu, soTien: k.soTien,
                             tyTrong: Math.round(k.soTien / tongCP * 1000) / 10 };
                }) };
            /* Khoản đã nằm trong giá vốn — nêu riêng để thấy rõ là KHÔNG tính hai lần. */
            var daVaoGV = DB.all('phieuChi').filter(function (p) {
                if (p.trangThai !== 'Đã ghi sổ') return false;
                if (tu && p.ngay < tu) return false;
                if (den && p.ngay > den) return false;
                if (dv && p.donVi !== dv) return false;
                return !T.chiVaoChiPhi(p);
            });
            b.innerHTML = kpiBox([
                ['Tổng chi phí', T.money(cpL.tong) + ' đ', 'y'],
                ['Số phiếu chi', T.num(cpL.soPhieu, 0), ''],
                ['Số khoản mục', T.num(cpL.theoKhoanMuc.length, 0), 'c'],
                ['Khoản mục lớn nhất', cpL.theoKhoanMuc.length ? cpL.theoKhoanMuc[0].ten : '—', ''],
                ['Chi trả tiền hàng (đã trong giá vốn)',
                 T.money(T.sum(daVaoGV, function (p) { return p.soTien; })) + ' đ', 'g'],
                ['Số phiếu không tính vào chi phí', T.num(daVaoGV.length, 0), '']
            ]) +
            '<div class="note g mb12"><i class="bi bi-shield-check"></i><div>' +
            '<b>Không tính hai lần một khoản tiền.</b> ' + daVaoGV.length + ' phiếu chi trả tiền hàng và chi phí ' +
            'nhập khẩu — tổng <b>' + T.money(T.sum(daVaoGV, function (p) { return p.soTien; })) + '</b> đ — ' +
            'đã nằm trong giá vốn hàng hóa từ lúc nhập kho nên KHÔNG được cộng thêm vào chi phí.</div></div>' +
            chartBox('Cơ cấu chi phí theo khoản mục',
                cpL.theoKhoanMuc.map(function (k) { return { l: k.ten, v: k.soTien }; })) +
            tableBox(duLieu, ['soTien']);
        }

        else if (cur === 'loi-nhuan') {
            var mh2 = {};
            db.forEach(function (d) {
                (d.lines || []).forEach(function (l) {
                    var k = T.idDong(l) || l.maHang;
                    if (!mh2[k]) mh2[k] = { ma: l.maHang, ten: l.tenHang, dvt: l.dvt, sl: 0, dt: 0, von: 0 };
                    var sl = Number(l.soLuong) || 0;
                    // giá vốn ĐÃ ĐÓNG BĂNG trên chứng từ, không lấy giá vốn hiện tại
                    var gv = l.giaVon !== undefined ? Number(l.giaVon)
                        : T.giaVonTheoDonVi(T.idDong(l) || l.maHang, d.donVi, d.ngay,
                                            d.bangGiaId || '', d.cotGia || '');
                    mh2[k].sl += sl;
                    mh2[k].dt += sl * (Number(l.donGia) || 0) * (1 - (Number(l.ckPhanTram) || 0) / 100);
                    mh2[k].von += sl * (gv || 0);
                });
            });
            var arr2 = Object.keys(mh2).map(function (k) {
                var x = mh2[k];
                x.lai = Math.round(x.dt - x.von);
                x.tySuat = x.dt ? Math.round(x.lai / x.dt * 1000) / 10 : 0;
                x.dt = Math.round(x.dt); x.von = Math.round(x.von);
                return x;
            }).sort(function (a, b2) { return b2.lai - a.lai; });
            duLieu = { ten: 'Lãi gộp theo mặt hàng',
                cols: [{ t: 'Mã hàng', k: 'ma' }, { t: 'Tên hàng hóa', k: 'ten' }, { t: 'ĐVT', k: 'dvt' },
                       { t: 'Số lượng bán', k: 'sl' }, { t: 'Doanh thu', k: 'dt' }, { t: 'Giá vốn', k: 'von' },
                       { t: 'Lãi gộp', k: 'lai' }, { t: 'Tỷ suất %', k: 'tySuat', tong: false }],
                rows: arr2 };
            var tdt2 = T.sum(arr2, function (r) { return r.dt; }), tvon = T.sum(arr2, function (r) { return r.von; });
            b.innerHTML = '<div class="note y mb12"><i class="bi bi-shield-lock"></i><div>Báo cáo này chứa <b>giá vốn và lợi nhuận</b> — ' +
                'chỉ vai trò được cấp quyền <i>Xem lợi nhuận</i> mới nhìn thấy.</div></div>' +
                kpiBox([
                ['Doanh thu', T.money(tdt2) + ' đ', ''],
                ['Giá vốn', T.money(tvon) + ' đ', 'c'],
                ['Lãi gộp', T.money(tdt2 - tvon) + ' đ', 'g'],
                ['Tỷ suất lãi gộp', tdt2 ? T.num((tdt2 - tvon) / tdt2 * 100, 1) + '%' : '0%', 'y'],
                ['Mặt hàng lãi nhất', arr2[0] ? arr2[0].ma : '—', ''],
                ['Số mã hàng', T.num(arr2.length, 0), '']
            ]) + chartBox('Top 10 mặt hàng theo lãi gộp',
                arr2.slice(0, 10).map(function (r) { return { l: r.ma, v: r.lai }; })) +
                tableBox(duLieu, ['dt', 'von', 'lai']);
        }

        else if (cur === 'nhat-ky-bh') {
            var rows = [];
            db.forEach(function (d) {
                (d.lines || []).forEach(function (l) {
                    rows.push({ ngay: d.ngay, so: d.so, kh: d.khachHang, ma: l.maHang, ten: l.tenHang,
                        dvt: l.dvt, sl: l.soLuong, dg: l.donGia,
                        tt: Math.round((Number(l.soLuong) || 0) * (Number(l.donGia) || 0) * (1 - (Number(l.ckPhanTram) || 0) / 100)) });
                });
            });
            rows.sort(function (a, b2) { return a.ngay < b2.ngay ? 1 : -1; });
            duLieu = { ten: 'Nhật ký bán hàng chi tiết',
                cols: [{ t: 'Ngày', k: 'ngay' }, { t: 'Số đơn', k: 'so' }, { t: 'Khách hàng', k: 'kh' },
                       { t: 'Mã hàng', k: 'ma' }, { t: 'Tên hàng', k: 'ten' }, { t: 'ĐVT', k: 'dvt' },
                       { t: 'SL', k: 'sl' }, { t: 'Đơn giá', k: 'dg' }, { t: 'Thành tiền', k: 'tt' }],
                rows: rows };
            b.innerHTML = kpiBox([
                ['Số chứng từ', T.num(db.length, 0), 'c'],
                ['Số dòng hàng', T.num(rows.length, 0), ''],
                ['Tổng tiền hàng', T.money(T.sum(rows, function (r) { return r.tt; })) + ' đ', 'g'],
                ['Khách hàng', T.num(Object.keys(T.groupBy(db, function (d) { return d.khachHangId; })).length, 0), ''],
                ['Mã hàng', T.num(Object.keys(T.groupBy(rows, function (r) { return r.ma; })).length, 0), ''],
                ['Kỳ báo cáo', T.date(tu) + ' → ' + T.date(den), '']
            ]) + tableBox(duLieu, ['tt']);
        }
    }

    /** Bảng kết quả kinh doanh của một chiều phân tích (công ty · dự án). */
    function bangTheoChieu(tieu, ds) {
        return '<div class="card mt12"><div class="card-h"><i class="bi bi-buildings-fill"></i> ' +
            T.esc(tieu) + '</div><div class="tablewrap" style="border:none">' +
            '<table class="grid" style="width:100%"><thead><tr><th>Tên</th>' +
            '<th class="num">Doanh thu</th><th class="num">Giá vốn</th><th class="num">Chi phí</th>' +
            '<th class="num">Lợi nhuận</th><th class="num" style="width:90px">Biên %</th></tr></thead><tbody>' +
            ds.map(function (r) {
                return '<tr><td>' + T.esc(r.ten) + '</td>' +
                    '<td class="num b">' + T.money(r.doanhThu) + '</td>' +
                    '<td class="num">' + T.money(r.giaVon) + '</td>' +
                    '<td class="num">' + T.money(r.chiPhi) + '</td>' +
                    '<td class="num b ' + (r.loiNhuan >= 0 ? 'pos' : 'neg') + '">' + T.money(r.loiNhuan) + '</td>' +
                    '<td class="num">' + T.num(r.bienLoiNhuan, 1) + '</td></tr>';
            }).join('') + '</tbody></table></div></div>';
    }

    function kpiBox(arr) {
        return '<div class="kpis">' + arr.map(function (a) {
            return '<div class="kpi st ' + (a[2] || '') + '"><div class="lb">' + a[0] + '</div>' +
                '<div class="vl" style="font-size:18px">' + a[1] + '</div></div>';
        }).join('') + '</div>';
    }
    function chartBox(ten, data) {
        if (!data.length) return '';
        var mx = Math.max.apply(null, data.map(function (d) { return d.v; })) || 1;
        return '<div class="card mb12"><div class="card-h"><i class="bi bi-bar-chart"></i> ' + T.esc(ten) + '</div>' +
            '<div class="card-b"><div class="bars">' + data.map(function (d) {
                return '<div class="bar-row"><div class="ellip" title="' + T.esc(d.l) + '">' + T.esc(d.l) + '</div>' +
                    '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(1, d.v / mx * 100) + '%"></div></div>' +
                    '<div class="bar-val">' + T.money(d.v) + '</div></div>';
            }).join('') + '</div></div></div>';
    }
    function tableBox(d, moneyKeys) {
        var mk = moneyKeys || [];
        return '<div class="card"><div class="card-h"><i class="bi bi-table"></i> ' + T.esc(d.ten) +
            '<span class="spacer"></span><span class="small muted">' + T.num(d.rows.length, 0) + ' dòng</span></div>' +
            '<div class="tablewrap" style="max-height:460px;border:none"><table class="grid"><thead><tr><th style="width:44px">TT</th>' +
            d.cols.map(function (c) { return '<th' + (mk.indexOf(c.k) >= 0 ? ' class="num"' : '') + '>' + T.esc(c.t) + '</th>'; }).join('') +
            '</tr></thead><tbody>' +
            (d.rows.length ? d.rows.slice(0, 800).map(function (r, i) {
                return '<tr><td class="ctr muted small">' + (i + 1) + '</td>' + d.cols.map(function (c) {
                    var v = r[c.k];
                    if (mk.indexOf(c.k) >= 0) return '<td class="num' + (v < 0 ? ' neg' : '') + '">' + T.money(v) + '</td>';
                    if (c.k === 'tt' && typeof v === 'string') return '<td>' + T.pill(v) + '</td>';
                    if (typeof v === 'number') return '<td class="num">' + T.num(v) + '</td>';
                    if (c.k === 'ngay') return '<td>' + T.date(v) + '</td>';
                    return '<td><span class="ellip">' + T.esc(v) + '</span></td>';
                }).join('') + '</tr>';
            }).join('') : '<tr><td colspan="' + (d.cols.length + 1) + '"><div class="empty"><i class="bi bi-inbox"></i><b>Không có số liệu trong kỳ</b>Hãy mở rộng khoảng thời gian.</div></td></tr>') +
            '</tbody>' +
            (d.rows.length && mk.length ? '<tfoot><tr><td></td>' + d.cols.map(function (c) {
                return mk.indexOf(c.k) >= 0 ? '<td class="num">' + T.money(T.sum(d.rows, function (r) { return r[c.k]; })) + '</td>' :
                    '<td>' + (c.k === d.cols[0].k ? 'TỔNG CỘNG' : '') + '</td>';
            }).join('') + '</tr></tfoot>' : '') +
            '</table></div>' + (d.rows.length > 800 ? '<div class="card-b small muted">Chỉ hiển thị 800 dòng đầu — xuất Excel để xem đầy đủ.</div>' : '') + '</div>';
    }

    host.querySelectorAll('[data-bc]').forEach(function (t) {
        t.onclick = function () {
            host.querySelectorAll('[data-bc]').forEach(function (x) { x.classList.remove('on'); });
            t.classList.add('on'); cur = t.getAttribute('data-bc'); ve();
        };
    });
    host.querySelector('#btnXem').onclick = function () { ve(); UI.toast('ok', 'Đã cập nhật báo cáo', duLieu.ten); };
    /* MỌI ô lọc đều dựng lại báo cáo — trước đây ô "Doanh thu nội bộ" bị bỏ sót
       nên đổi ô đó xong màn hình vẫn giữ số cũ cho tới khi bấm Xem báo cáo. */
    ['#fTu', '#fDen', '#fDv', '#fNV', '#fNoiBo', '#fDA', '#fKH', '#fNCC', '#fNhom', '#fKho', '#fBuoc']
        .forEach(function (id) {
            var e = host.querySelector(id); if (e) e.onchange = function () { ve(); };
        });
    /* Chọn kỳ báo cáo là hai ô ngày tự điền theo đúng T.kyChon của Business Engine. */
    var oKy = host.querySelector('#fKy');
    if (oKy) oKy.onchange = function () {
        if (!oKy.value) return;
        var k = T.kyChon(oKy.value);
        host.querySelector('#fTu').value = k.tuNgay || (T.cacNamCoDuLieu({})[0] || T.today().substr(0, 4)) + '-01-01';
        host.querySelector('#fDen').value = k.denNgay || T.today();
        ve();
    };
    /* Một cột có phải cột tiền/số cộng được hay không — xét bằng chính dữ liệu
       đang có, không đoán theo tên cột. */
    function coTien(k) {
        var r = duLieu.rows || [];
        for (var i = 0; i < r.length; i++) {
            var v = r[i][k];
            if (v === undefined || v === null || v === '') continue;
            return typeof v === 'number';
        }
        return false;
    }
    host.querySelector('#btnXuat').onclick = function () {
        if (!duLieu || !duLieu.rows || !duLieu.rows.length)
            return UI.toast('warn', 'Chưa có dữ liệu', 'Hãy chọn điều kiện lọc để báo cáo có dữ liệu trước khi xuất.');
        UI.xuatExcel('BaoCao_' + cur, duLieu.ten, duLieu.cols.map(function (c) { return { t: c.t, k: c.k, w: 20 }; }), duLieu.rows);
    };
    host.querySelector('#btnIn').onclick = function () {
        if (!duLieu || !duLieu.rows || !duLieu.rows.length)
            return UI.toast('warn', 'Chưa có dữ liệu', 'Hãy chọn điều kiện lọc để báo cáo có dữ liệu trước khi xuất.');
        W.inBaoCao({
            tieu: duLieu.ten, tu: tu, den: den,
            dieuKien: moTaLoc(),
            /* Bản in và bản Excel biểu mẫu phải có dòng TỔNG CỘNG y như trên màn
               hình. Cột nào là tiền thì mặc định có tổng, trừ khi đã khai rõ. */
            cols: duLieu.cols.map(function (c) {
                return { t: c.t, k: c.k,
                         tong: c.tong !== undefined ? c.tong : coTien(c.k) };
            }),
            rows: duLieu.rows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'GIÁM ĐỐC'
        });
    };
    ve();
};

/* ==========================================================================
   ĐỐI CHIẾU SỐ LIỆU TỰ ĐỘNG
   --------------------------------------------------------------------------
   Business Engine tự kiểm hai đẳng thức bắt buộc của một hệ thống quản trị:

        Tổng nhập − Tổng xuất = Tồn kho
        Doanh thu − Giá vốn − Chi phí = Lợi nhuận

   Sai một đồng cũng phải hiện ra, kèm đúng chỗ sai và đúng cách xử lý. Không
   để một sai số nào nằm im trong sổ sách chờ đến lúc quyết toán mới lộ.
   ========================================================================== */
S['doi-chieu'] = function (host) {
    var dv = '', tu = '', den = '';

    host.innerHTML = '<div class="page">' +
        '<div class="page-head"><div><h2>Đối chiếu số liệu</h2>' +
        '<div class="sub">Business Engine tự kiểm tra tính nhất quán của toàn bộ sổ sách và báo ngay khi lệch</div>' +
        '</div></div>' +
        '<div class="toolbar" style="border-radius:4px">' +
        '<div class="fld"><label>Từ ngày</label><input type="date" id="dcTu"></div>' +
        '<div class="fld"><label>Đến ngày</label><input type="date" id="dcDen"></div>' +
        '<div class="fld" style="min-width:220px"><label>Công ty</label><select id="dcDv">' +
        '<option value="">— Toàn nhóm —</option>' +
        DB.all('donVi').map(function (d) {
            return '<option value="' + d.id + '">' + T.esc(d.tat + ' — ' + d.ten) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="fld"><label>&nbsp;</label><button class="btn primary" id="dcXem">' +
        '<i class="bi bi-shield-check"></i> Đối chiếu lại</button></div>' +
        '</div><div id="dcBody" style="margin-top:12px"></div></div>';
    W.crumb(['Phân tích', 'Đối chiếu số liệu']);

    host.querySelector('#dcXem').onclick = ve;
    host.querySelector('#dcDv').onchange = ve;
    ve();

    function ve() {
        tu = host.querySelector('#dcTu').value;
        den = host.querySelector('#dcDen').value;
        dv = host.querySelector('#dcDv').value;
        var loc = {};
        if (tu) loc.tuNgay = tu;
        if (den) loc.denNgay = den;
        if (dv) loc.donViId = dv;

        var d = T.doiChieuSo(loc);
        var kt = T.kiemToanDuLieu(loc);
        var kq = d.kq;
        var h = '';

        /* ---------- KIỂM TOÁN TÍNH TOÀN VẸN ---------- */
        function khoiKT(ds, mau, ico) {
            return ds.map(function (x) {
                return '<div class="note ' + mau + ' mb8"><i class="bi ' + ico + '"></i><div>' +
                    '<b>' + T.esc(x.ten) + ' — ' + x.so + ' trường hợp</b><br>' + T.esc(x.moTa) +
                    '<br><span class="small">Ví dụ: ' + T.esc(x.viDu.join(' · ')) +
                    (x.so > x.viDu.length ? ' … và ' + (x.so - x.viDu.length) + ' trường hợp nữa' : '') +
                    '</span><br><span class="small">Nên làm: ' + T.esc(x.huong) + '</span></div></div>';
            }).join('');
        }
        var htmlKT = '<div class="card mb12"><div class="card-h"><i class="bi bi-clipboard2-check"></i> ' +
            'Kiểm toán tính toàn vẹn của dữ liệu<span class="spacer"></span>' +
            '<span class="small muted">' + kt.soLoi + ' lỗi · ' + kt.soCanhBao + ' cảnh báo</span></div>' +
            '<div class="card-b">' +
            (kt.soLoi || kt.soCanhBao
                ? khoiKT(kt.loi, 'r', 'bi-x-octagon-fill') + khoiKT(kt.canhBao, 'y', 'bi-exclamation-triangle-fill') +
                  '<div class="small muted">Phần mềm <b>chỉ báo, không tự sửa</b> dữ liệu gốc. ' +
                  'Mỗi mục nêu rõ nên mở màn hình nào để xử lý.</div>'
                : '<div class="note g"><i class="bi bi-check-circle-fill"></i><div>' +
                  '<b>Dữ liệu toàn vẹn.</b> Không có giá trị NaN, không có ngày sai, không có tham chiếu ' +
                  'treo, không có số chứng từ trùng, không có tồn kho âm, không có số tiền âm bất hợp lý.' +
                  '</div></div>') +
            '</div></div>';

        /* ---------- DỮ LIỆU CẦN NGƯỜI XÁC MINH (v18.5.0) ----------
           Tách riêng khỏi lỗi số liệu: đây là những chỗ phần mềm KHÔNG được tự
           sửa vì đúng/sai phụ thuộc việc thực tế đã xảy ra thế nào. Mỗi mục nêu
           bằng chứng, một câu hỏi cụ thể và đề xuất xử lý. */
        var xm = kt.canXacMinh || { so: 0, ds: [] };
        var htmlXM = xm.so ? '<div class="card mb12"><div class="card-h">' +
            '<i class="bi bi-patch-question"></i> Dữ liệu cần anh xác minh' +
            '<span class="spacer"></span><span class="small muted">' + xm.so + ' mục · ' +
            xm.cao + ' cần xử lý sớm</span></div><div class="card-b">' +
            '<div class="note b mb8"><i class="bi bi-info-circle"></i><div>' +
            'Những mục dưới đây <b>phần mềm cố ý KHÔNG tự sửa</b>. Sửa đúng hay sai phụ thuộc ' +
            'vào việc thực tế đã xảy ra thế nào — chỉ anh mới biết. Số liệu hiện tại được ' +
            '<b>giữ nguyên</b>.</div></div>' +
            xm.ds.map(function (x) {
                var mau = x.mucDo === 'cao' ? 'y' : (x.mucDo === 'vua' ? 'b' : '');
                return '<div class="note ' + mau + ' mb8"><i class="bi bi-patch-question"></i><div>' +
                    '<b>' + T.esc(x.tieuDe) + '</b> <span class="small muted">· ' +
                    T.esc(x.nhom) + '</span><br>' + T.esc(x.moTa) +
                    ((x.chungCu || []).length ? '<br><span class="small"><b>Bằng chứng:</b> ' +
                        x.chungCu.map(T.esc).join(' · ') + '</span>' : '') +
                    (x.cauHoi ? '<br><span class="small"><b>Câu hỏi:</b> ' + T.esc(x.cauHoi) +
                        '</span>' : '') +
                    '<br><span class="small"><b>Nên làm:</b> ' + T.esc(x.deXuat) + '</span>' +
                    (x.route ? ' <a href="#/' + x.route + '">Mở màn hình</a>' : '') +
                    '</div></div>';
            }).join('') + '</div></div>' : '';

        /* ---------- KẾT LUẬN ---------- */
        h += '<div class="note ' + (d.loi.length ? 'r' : d.canhBao.length ? 'y' : 'g') + ' mb12">' +
            '<i class="bi bi-' + (d.loi.length ? 'x-octagon-fill' :
                                  d.canhBao.length ? 'exclamation-triangle-fill' : 'shield-fill-check') + '"></i><div>' +
            (d.loi.length
                ? '<b>Số liệu KHÔNG cân — có ' + d.loi.length + ' điểm sai.</b> Xử lý xong mới dùng được báo cáo.'
                : d.canhBao.length
                    ? '<b>Hai đẳng thức đều đúng.</b> Còn ' + d.canhBao.length +
                      ' điểm nên rà lại để số liệu chính xác hơn.'
                    : '<b>Số liệu cân tuyệt đối.</b> Hai đẳng thức bắt buộc đều đúng, không có bản ghi nào ' +
                      'đứng ngoài sổ.') + '</div></div>';

        /* ---------- ĐẲNG THỨC 1: KHO ---------- */
        h += '<div class="card mb12"><div class="card-h"><i class="bi bi-boxes"></i> ' +
            'Đẳng thức 1 — Tổng nhập − Tổng xuất = Tồn kho' +
            '<span class="spacer"></span>' + (Math.abs(d.kho.lech) < 0.001
                ? '<span class="pill g">cân</span>' : '<span class="pill r">lệch</span>') +
            '</div><div class="card-b">' +
            '<div class="tablewrap" style="border:none"><table class="grid" style="width:100%">' +
            '<tbody>' +
            dong('Tổng số lượng nhập kho', T.num(d.kho.nhap, 2), '') +
            dong('Tổng số lượng xuất kho', '− ' + T.num(d.kho.xuat, 2), '') +
            dong('<b>Còn lại theo sổ kho</b>', '<b>' + T.num(d.kho.nhap - d.kho.xuat, 2) + '</b>', 'b') +
            dong('Tồn kho theo Danh mục hàng hóa', T.num(d.kho.ton, 2), '') +
            dong('<b>Chênh lệch</b>', '<b class="' + (Math.abs(d.kho.lech) < 0.001 ? 'pos' : 'neg') + '">' +
                 T.num(d.kho.lech, 2) + '</b>', 'b') +
            '</tbody></table></div>' +
            (d.kho.lechMatHang
                ? '<div class="small muted mt8">' + d.kho.lechMatHang + ' mặt hàng lệch giữa sổ kho và tồn danh mục.</div>'
                : '<div class="small muted mt8">Từng mặt hàng đều khớp giữa sổ kho và tồn danh mục.</div>') +
            '</div></div>';

        /* ---------- ĐẲNG THỨC 2: LÃI LỖ ---------- */
        var lech = kq.doanhThu - kq.giaVon - kq.chiPhi - kq.loiNhuan;
        h += '<div class="card mb12"><div class="card-h"><i class="bi bi-cash-coin"></i> ' +
            'Đẳng thức 2 — Doanh thu − Giá vốn − Chi phí = Lợi nhuận' +
            '<span class="spacer"></span>' + (Math.round(lech) === 0
                ? '<span class="pill g">cân</span>' : '<span class="pill r">lệch</span>') +
            '</div><div class="card-b">' +
            '<div class="tablewrap" style="border:none"><table class="grid" style="width:100%">' +
            '<tbody>' +
            dong('Doanh thu (trước thuế GTGT) — ' + kq.soChungTu + ' chứng từ ghi nhận',
                 T.money(kq.doanhThu) + ' đ', '') +
            dong('Giá vốn hàng bán', '− ' + T.money(kq.giaVon) + ' đ', '') +
            dong('<b>Lợi nhuận gộp</b>', '<b>' + T.money(kq.loiNhuanGop) + ' đ</b>', 'b') +
            dong('Chi phí — ' + kq.chiPhiChiTiet.soPhieu + ' phiếu chi tính vào chi phí',
                 '− ' + T.money(kq.chiPhi) + ' đ', '') +
            dong('<b>Lợi nhuận</b>', '<b class="' + (kq.loiNhuan >= 0 ? 'pos' : 'neg') + '">' +
                 T.money(kq.loiNhuan) + ' đ</b>', 'b') +
            dong('<b>Chênh lệch của đẳng thức</b>', '<b class="' + (Math.round(lech) === 0 ? 'pos' : 'neg') + '">' +
                 T.money(lech) + ' đ</b>', 'b') +
            '</tbody></table></div></div></div>';

        /* ---------- ĐIỂM SAI ---------- */
        if (d.loi.length) h += khung('bi-x-octagon-fill', 'r', 'Điểm sai phải xử lý ngay', d.loi);
        if (d.canhBao.length) h += khung('bi-exclamation-triangle-fill', 'y', 'Điểm nên rà lại', d.canhBao);

        /* ---------- RÀ SOÁT LIÊN KẾT DỮ LIỆU ---------- */
        var tv = T.raSoatToanVen();
        h += '<div class="card"><div class="card-h"><i class="bi bi-link-45deg"></i> ' +
            'Liên kết dữ liệu và khóa ngoại<span class="spacer"></span>' +
            (tv.tong ? '<span class="pill r">' + tv.tong + ' bản ghi mồ côi</span>'
                     : '<span class="pill g">không có bản ghi mồ côi</span>') +
            '</div><div class="card-b">' +
            (tv.tong
                ? '<div class="tablewrap" style="border:none"><table class="grid" style="width:100%">' +
                  '<thead><tr><th>Phân hệ</th><th>Điểm hỏng</th><th class="num" style="width:100px">Số bản ghi</th>' +
                  '<th>Ví dụ</th></tr></thead><tbody>' +
                  tv.loi.map(function (x) {
                      return '<tr><td>' + T.esc(x.phanHe) + '</td><td>' + T.esc(x.truong) + '</td>' +
                          '<td class="num b">' + T.num(x.so, 0) + '</td>' +
                          '<td class="small muted">' + T.esc((x.viDu || []).join(' · ')) + '</td></tr>';
                  }).join('') + '</tbody></table></div>'
                : '<div class="note g"><i class="bi bi-check-circle-fill"></i><div>' +
                  'Mọi chứng từ, dòng hàng, bảng giá và sổ kho đều trỏ tới bản ghi có thật. ' +
                  'Không có dữ liệu mồ côi, không có khóa liên kết hỏng.</div></div>') +
            '</div></div>';

        h += htmlXM + htmlKT;
        host.querySelector('#dcBody').innerHTML = h;
    }

    function dong(nhan, gt, cls) {
        return '<tr class="' + (cls || '') + '"><td>' + nhan + '</td>' +
            '<td class="num" style="width:220px">' + gt + '</td></tr>';
    }
    function khung(ico, mau, tieu, ds) {
        return '<div class="card mb12"><div class="card-h"><i class="bi ' + ico + '"></i> ' +
            T.esc(tieu) + '<span class="spacer"></span><span class="small muted">' + ds.length + ' điểm</span>' +
            '</div><div class="card-b">' + ds.map(function (x) {
                return '<div class="note ' + mau + ' mb8"><i class="bi ' + ico + '"></i><div>' +
                    '<b>' + T.esc(x.ten) + '</b><br>' + T.esc(x.moTa) +
                    '<br><span class="small muted">Cách xử lý: ' + T.esc(x.huong) + '</span>' +
                    ((x.ds && x.ds.length)
                        ? '<div class="small mt4">' + x.ds.map(function (y) {
                            return T.esc([y.ma, y.model, y.ten].filter(Boolean).join(' · ')); }).join('<br>') + '</div>'
                        : '') +
                    '</div></div>';
            }).join('') + '</div></div>';
    }
};

/* ==========================================================================
   BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH — QUẢN TRỊ NỘI BỘ  (v18.1.0)
   --------------------------------------------------------------------------
   Màn hình này KHÔNG có công thức riêng. Mọi con số gọi thẳng T.baoCaoKQKD và
   T.tongQuanDoanhNghiep của Business Engine — cùng nguồn với Trang chủ, Báo
   cáo tổng hợp.

   Đây là BÁO CÁO QUẢN TRỊ phục vụ điều hành. Không phải báo cáo kế toán pháp
   định, không dùng để lập sổ kế toán, không dùng để kê khai thuế.
   ========================================================================== */
S['kq-kinh-doanh'] = function (host) {
    var kyHT = 'nam', tuyChon = { tuNgay: '', denNgay: '' };
    var loc2 = { duAnId: '', khachHangId: '', nhomHangId: '' };
    /* MẶC ĐỊNH: một công ty được chọn = một bộ báo cáo độc lập.
       Chỉ khi người dùng CHỦ ĐỘNG bật mới tổng hợp nhiều công ty. */
    var tongHopNhieuCty = false;
    W.crumb(['Báo cáo', 'Kết quả hoạt động kinh doanh']);
    host.innerHTML = '<div class="page" id="kqPage"></div>';
    ve();

    function locHT() {
        var cty = DB.cty(), k = T.kyChon(kyHT, tuyChon);
        var o = { ky: kyHT };
        if (k.tuNgay) o.tuNgay = k.tuNgay;
        if (k.denNgay) o.denNgay = k.denNgay;
        /* CÔNG TY ĐANG CHỌN QUYẾT ĐỊNH TOÀN BỘ NGUỒN DỮ LIỆU. Không có đường
           nào bỏ qua bộ lọc này trừ khi người dùng tự bật chế độ tổng hợp. */
        if (!tongHopNhieuCty && cty && cty.id) o.donViId = cty.id;
        if (loc2.duAnId) o.duAnId = loc2.duAnId;
        if (loc2.khachHangId) o.khachHangId = loc2.khachHangId;
        if (loc2.nhomHangId) o.nhomHangId = loc2.nhomHangId;
        return o;
    }

    function ve() {
        var cty = DB.cty(), loc = locHT(), k = T.kyChon(kyHT, tuyChon);
        var bc = T.baoCaoKQKD(loc);
        var tq = T.tongQuanDoanhNghiep(loc);
        var h = '';

        h += '<div class="page-head"><div><h2>Báo cáo kết quả hoạt động kinh doanh</h2>' +
            '<div class="sub">Báo cáo QUẢN TRỊ NỘI BỘ phục vụ điều hành doanh nghiệp. ' +
            'Không phải báo cáo tài chính pháp định, không dùng để lập sổ kế toán hay kê khai thuế. ' +
            'Mọi con số đọc thẳng từ Business Engine — cùng nguồn với Trang chủ và Báo cáo tổng hợp.' +
            '</div></div><div class="spacer"></div><div class="row">' +
            '<button class="btn primary" id="kqXem"><i class="bi bi-eye"></i> Xem trước · In · ' +
            'PDF · Excel</button>' +
            '<button class="btn" id="kqXls"><i class="bi bi-file-earmark-excel"></i> ' +
            'Xuất dữ liệu Excel</button>' +
            '</div></div>';

        /* ------------------------------ BỘ LỌC ------------------------------ */
        h += '<div class="card mb12"><div class="card-h"><i class="bi bi-funnel"></i> ' +
            'Phạm vi báo cáo<span class="spacer"></span><span class="small muted">' +
            (tongHopNhieuCty ? 'ĐANG TỔNG HỢP NHIỀU CÔNG TY'
                             : 'Đơn vị đang làm việc: <b>' + T.esc(cty.tat || cty.ten) + '</b>') +
            '</span></div><div class="card-b"><div class="row" style="gap:6px">' +
            T.KY_CHON_SAN.map(function (x) {
                return '<button class="btn sm' + (x.k === kyHT ? ' primary' : '') +
                    '" data-kqk="' + x.k + '">' + T.esc(x.t) + '</button>';
            }).join('') +
            '<span class="tb-sep"></span>' +
            '<input type="date" class="sm" id="kqTu" value="' + T.esc(k.tuNgay || '') + '">' +
            '<input type="date" class="sm" id="kqDen" value="' + T.esc(k.denNgay || T.today()) + '">' +
            '<button class="btn sm" id="kqAp"><i class="bi bi-check2"></i> Áp dụng</button>' +
            '</div><div class="row" style="gap:6px;margin-top:8px">' +
            oLoc('kqDuAn', 'Dự án', DB.all('duAn'), loc2.duAnId) +
            oLoc('kqKH', 'Khách hàng', DB.all('khachHang'), loc2.khachHangId) +
            oLoc('kqNhom', 'Nhóm hàng', DB.all('nhomHang'), loc2.nhomHangId) +
            '</div>' +
            '<div class="row" style="gap:6px;margin-top:8px">' +
            '<label class="small" style="align-self:center;display:flex;gap:6px;align-items:center">' +
            '<input type="checkbox" id="kqTong"' + (tongHopNhieuCty ? ' checked' : '') + '> ' +
            '<b>TỔNG HỢP NHIỀU CÔNG TY</b></label>' +
            '<span class="small muted">Mặc định TẮT — mỗi công ty là một bộ báo cáo độc lập. ' +
            'Bật ô này thì số liệu của các công ty mới được cộng chung.</span>' +
            '</div>' +
            '<div class="small muted" style="margin-top:8px">Kỳ này: <b>' + T.esc(k.nhan) +
            '</b>' + (bc.kyTruoc ? ' — so với kỳ liền trước ' + T.date(bc.kyTruoc.tuNgay) + ' → ' +
                T.date(bc.kyTruoc.denNgay) : ' — không có kỳ liền trước để so sánh') +
            '.</div></div></div>';

        if (tongHopNhieuCty)
            h += '<div class="note y mb12"><i class="bi bi-exclamation-triangle"></i><div>' +
                '<b>ĐÂY LÀ SỐ LIỆU TỔNG HỢP NHIỀU CÔNG TY.</b> Không phải báo cáo của riêng ' +
                'công ty nào. Giao dịch nội bộ giữa các công ty trong nhóm đã được Engine loại ' +
                'trừ, nên tổng ở đây KHÔNG bằng phép cộng số học của từng công ty.</div></div>';

        /* --------------------- BẢNG KẾT QUẢ KINH DOANH ---------------------- */
        h += '<div class="card mb12"><div class="card-b" id="kqBang">' + bangKQKD(bc) + '</div></div>';

        /* ----------------- BỨC TRANH TỔNG QUAN DOANH NGHIỆP ----------------- */
        h += '<div class="card mb12"><div class="card-h"><i class="bi bi-clipboard-data"></i> ' +
            'Bức tranh tổng quan doanh nghiệp</div><div class="card-b">' +
            '<div class="tablewrap"><table class="grid"><thead><tr>' +
            '<th style="width:190px">Chỉ tiêu</th><th class="num" style="width:170px">Giá trị</th>' +
            '<th>Bản chất của con số này</th><th style="width:120px">Nguồn</th>' +
            '</tr></thead><tbody>' +
            tq.muc.map(function (m) {
                return '<tr><td><b>' + T.esc(m.ten) + '</b></td>' +
                    '<td class="num"><b class="' + (m.giaTri >= 0 ? '' : 'neg') + '">' +
                    T.money(m.giaTri) + '</b></td>' +
                    '<td><span class="small">' + T.esc(m.banChat) + '</span></td>' +
                    '<td>' + (m.truyVet
                        ? '<button class="btn sm" data-kqtv="' + m.truyVet + '" ' +
                          'data-kqten="' + T.esc(m.ten) + '"><i class="bi bi-search"></i> Xem nguồn</button>'
                        : '<span class="muted small">—</span>') + '</td></tr>';
            }).join('') +
            '</tbody></table></div>' +
            '<div class="note y" style="margin-top:10px"><i class="bi bi-exclamation-triangle"></i>' +
            '<div>' + T.esc(tq.luuY) + '</div></div>' +
            '</div></div>';

        host.querySelector('#kqPage').innerHTML = h;
        gan();
    }

    /**
     * BẢNG KẾT QUẢ HOẠT ĐỘNG KINH DOANH — dùng chung cho màn hình và bản in.
     * Có đầu báo cáo đúng công ty đang chọn, kỳ báo cáo, đơn vị tính; bảng có
     * MÃ SỐ · CHỈ TIÊU · THUYẾT MINH · KỲ NÀY · KỲ TRƯỚC.
     */
    function bangKQKD(bc, choIn) {
        var d = bc.donVi;
        var dau = '<div class="kq-dau">' +
            '<div class="kq-cty"><b>' + T.esc(d.ten) + '</b>' +
            (d.diaChi ? '<div class="small">' + T.esc(d.diaChi) + '</div>' : '') +
            (d.mst ? '<div class="small">Mã số thuế: ' + T.esc(d.mst) + '</div>' : '') +
            '</div>' +
            '<div class="kq-tieu"><h3>BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH</h3>' +
            '<div>Kỳ báo cáo: từ ngày <b>' + T.date(bc.ky.tuNgay) + '</b> đến ngày <b>' +
            T.date(bc.ky.denNgay) + '</b></div>' +
            '<div class="small">Đơn vị tính: ' + T.esc(bc.donViTinh) + '</div></div></div>';
        var bang = '<div class="tablewrap"><table class="grid kq-bang"><thead><tr>' +
            '<th style="width:62px">Mã số</th>' +
            '<th>Chỉ tiêu</th>' +
            '<th style="width:250px">Thuyết minh</th>' +
            '<th class="num" style="width:160px">Kỳ này</th>' +
            '<th class="num" style="width:160px">Kỳ trước</th>' +
            (choIn ? '' : '<th style="width:118px">Nguồn</th>') +
            '</tr></thead><tbody>' +
            bc.dong.map(function (x) {
                return '<tr' + (x.dam ? ' class="kq-dam"' : '') + '>' +
                    '<td class="mono">' + T.esc(x.ms) + '</td>' +
                    '<td' + (x.con ? ' style="padding-left:22px"' : '') + '>' + T.esc(x.ten) +
                    (x.chuaCo ? ' <span class="small muted">— chưa có chứng từ loại này</span>' : '') +
                    '</td>' +
                    '<td><span class="small">' + T.esc(x.thuyetMinh || '') + '</span></td>' +
                    '<td class="num">' + T.money(x.kyNay) + '</td>' +
                    '<td class="num">' + (x.kyTruoc === null ? '—' : T.money(x.kyTruoc)) + '</td>' +
                    (choIn ? '' : '<td>' + (x.truyVet
                        ? '<button class="btn sm" data-kqtv="' + x.truyVet + '" ' +
                          'data-kqten="' + T.esc(x.ten) + '"><i class="bi bi-search"></i> Xem nguồn</button>'
                        : '<span class="muted small">—</span>') + '</td>') +
                    '</tr>';
            }).join('') +
            '</tbody></table></div>';
        var ghi = '<div class="note b" style="margin-top:10px"><i class="bi bi-info-circle"></i>' +
            '<div><b>Chống cộng trùng.</b> Doanh thu chỉ lấy MỘT bậc trên thang chứng từ ' +
            '(Đơn bán → Hợp đồng → Phiếu xuất kho). Báo giá, biên bản nghiệm thu, đề nghị thanh ' +
            'toán và phiếu thu <b>không bao giờ</b> được cộng vào doanh thu. Góp vốn và tiền vay ' +
            'KHÔNG phải doanh thu; tiền trả nhà cung cấp KHÔNG tính lại thành chi phí khi khoản ' +
            'đó đã nằm trong giá vốn.' +
            (bc.chuaKhaiKhoanMuc ? '<br><b>Lưu ý:</b> có ' + T.money(bc.chuaKhaiKhoanMuc) +
                ' đ phiếu chi chưa khai khoản mục nên CHƯA được tính vào chi phí.' : '') +
            '</div></div>';
        var ky = choIn
            ? '<div class="kq-ky"><div><div class="small">Ngày lập: ' + T.date(bc.ngayLap) +
              '</div></div><div class="kq-chuky">' +
              '<div><b>NGƯỜI LẬP BIỂU</b><div class="small">(Ký, họ tên)</div></div>' +
              '<div><b>KẾ TOÁN TRƯỞNG</b><div class="small">(Ký, họ tên)</div></div>' +
              '<div><b>GIÁM ĐỐC</b><div class="small">(Ký, họ tên, đóng dấu)</div></div>' +
              '</div></div>'
            : '';
        return dau + bang + (choIn ? '' : ghi) + ky;
    }

    function oLoc(id, nhan, ds, gt) {
        return '<label class="small muted" style="align-self:center">' + T.esc(nhan) + '</label>' +
            '<select class="sm" id="' + id + '"><option value="">— Tất cả —</option>' +
            ds.map(function (x) {
                return '<option value="' + T.esc(x.id) + '"' + (x.id === gt ? ' selected' : '') +
                    '>' + T.esc(x.ten) + '</option>';
            }).join('') + '</select>';
    }

    function gan() {
        host.querySelectorAll('[data-kqk]').forEach(function (b) {
            b.onclick = function () { kyHT = b.getAttribute('data-kqk'); ve(); };
        });
        var ap = host.querySelector('#kqAp');
        if (ap) ap.onclick = function () {
            var tu = host.querySelector('#kqTu').value, den = host.querySelector('#kqDen').value;
            if (!tu || !den) return UI.toast('warn', 'Khoảng thời gian không hợp lệ',
                'Khai đủ Từ ngày và Đến ngày.');
            kyHT = 'tuyChon'; tuyChon = { tuNgay: tu, denNgay: den }; ve();
        };
        [['kqDuAn', 'duAnId'], ['kqKH', 'khachHangId'], ['kqNhom', 'nhomHangId']]
            .forEach(function (b) {
                var e = host.querySelector('#' + b[0]);
                if (e) e.onchange = function () { loc2[b[1]] = e.value; ve(); };
            });
        /* TRUY VẾT: từ một chỉ tiêu mở thẳng ra công thức và chứng từ nguồn. */
        host.querySelectorAll('[data-kqtv]').forEach(function (b) {
            b.onclick = function () {
                moTruyVet(b.getAttribute('data-kqtv'), b.getAttribute('data-kqten'));
            };
        });
        var tg = host.querySelector('#kqTong');
        if (tg) tg.onchange = function () { tongHopNhieuCty = tg.checked; ve(); };

        /* XEM TRƯỚC → IN · PDF · WORD · EXCEL. Bản in luôn mang đúng công ty
           đang chọn, vì nó dựng lại từ chính bc.donVi của kỳ đang xem. */
        var xem = host.querySelector('#kqXem');
        if (xem) xem.onclick = function () {
            var bc = T.baoCaoKQKD(locHT());
            UI.print('<div class="kq-in">' + bangKQKD(bc, true) + '</div>',
                'Báo cáo kết quả hoạt động kinh doanh — ' + (bc.donVi.tat || bc.donVi.ten),
                { duLieu: true });
        };
        var xls = host.querySelector('#kqXls');
        if (xls) xls.onclick = function () {
            var bc = T.baoCaoKQKD(locHT());
            var ten = 'KQHDKD_' + (bc.donVi.tat || bc.donVi.id || 'TONGHOP') + '_' +
                      (bc.ky.tuNgay || '') + '_' + (bc.ky.denNgay || '');
            UI.xuatExcel(ten, 'KQHĐKD',
                [{ t: 'Mã số', w: 8 }, { t: 'Chỉ tiêu', w: 52 }, { t: 'Thuyết minh', w: 60 },
                 { t: 'Kỳ này', w: 18 }, { t: 'Kỳ trước', w: 18 },
                 { t: 'Chênh lệch', w: 18 }, { t: '%', w: 10 }],
                [['CÔNG TY', bc.donVi.ten, '', '', '', '', ''],
                 ['KỲ BÁO CÁO', T.date(bc.ky.tuNgay) + ' → ' + T.date(bc.ky.denNgay),
                  'Đơn vị tính: ' + bc.donViTinh, '', '', '', '']]
                .concat(bc.dong.map(function (d) {
                    return [d.ms, d.ten, d.thuyetMinh, d.kyNay, d.kyTruoc, d.lech, d.pct];
                })));
        };
    }

    /**
     * TRUY VẾT MỘT CHỈ TIÊU — công thức, hàm tính và đúng tập chứng từ nguồn.
     * Không có con số nào trong báo cáo mà không truy được về chứng từ.
     */
    function moTruyVet(k, ten) {
        var loc = locHT();
        var t = T.truyVetChiTieu(k, loc);
        if (!t) return UI.toast('warn', 'Chưa truy vết được chỉ tiêu này', '');
        var ct = (t.ct || []).slice(0, 200);
        UI.modal({
            title: 'Truy vết nguồn: ' + (ten || k),
            sub: 'Giá trị ' + T.money(t.gt) + ' đ — kỳ đang xem',
            size: 'lg',
            body: '<div class="note b mb8"><i class="bi bi-signpost-split"></i><div>' +
                  '<b>Hàm tính:</b> ' + T.esc(t.ham) + '<br>' +
                  '<b>Nguồn số liệu:</b> ' + T.esc(t.nguon) + '</div></div>' +
                  (ct.length
                    ? '<div class="tablewrap" style="max-height:52vh"><table class="grid">' +
                      '<thead><tr><th>Loại chứng từ</th><th>Số</th><th>Ngày</th>' +
                      '<th class="num">Giá trị</th></tr></thead><tbody>' +
                      ct.map(function (x) {
                          return '<tr><td>' + T.esc(x.loai || '') + '</td>' +
                              '<td class="mono">' + T.esc(x.so || '') + '</td>' +
                              '<td>' + (x.ngay ? T.date(x.ngay) : '') + '</td>' +
                              '<td class="num">' + T.money(x.gt) + '</td></tr>';
                      }).join('') + '</tbody></table></div>' +
                      ((t.ct || []).length > 200
                        ? '<div class="small muted" style="margin-top:6px">Hiển thị 200 dòng đầu ' +
                          'trong tổng số ' + (t.ct || []).length + ' chứng từ.</div>' : '')
                    : '<div class="note y"><i class="bi bi-info-circle"></i><div>' +
                      'Chỉ tiêu này không gắn tới danh sách chứng từ rời — xem phần công thức ' +
                      'ở trên để biết nó được suy ra từ đâu.</div></div>'),
            buttons: [{ text: 'Đóng', click: function (m) { m.close(); } }]
        });
    }
};

})(window);

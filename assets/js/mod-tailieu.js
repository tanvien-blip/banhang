/* ==========================================================================
   TVERP — HỆ THỐNG THIẾT KẾ TÀI LIỆU (DOCUMENT DESIGN SYSTEM)
   --------------------------------------------------------------------------
   Toàn bộ biểu mẫu của phần mềm — chứng từ, biên bản, hợp đồng, phiếu kho,
   phiếu quỹ, danh sách và báo cáo — đều dựng từ đúng các khối khai báo trong
   tệp này. Không màn hình nào tự viết lại đầu trang, tiêu đề, bảng hàng hóa,
   khối tổng cộng hay khối chữ ký của riêng mình.

   Nhờ vậy:
     • Mọi biểu mẫu có cùng một ngôn ngữ thiết kế, sửa một chỗ là đổi tất cả.
     • Bề rộng cột được TÍNH THEO NỘI DUNG THẬT của từng chứng từ nên không
       bao giờ có cột quá rộng, cột quá hẹp, chữ sát mép hay bảng tràn trang.
     • Bản in, bản PDF, bản Word và bản Excel đều sinh ra từ cùng một cấu
       trúc nên luôn giống nhau.

   Bố cục tệp:
     1. Đo chữ            — đo bề rộng thật của chuỗi theo đúng phông đang in.
     2. Bộ cột chuẩn      — mỗi loại cột có ngưỡng hẹp nhất / rộng nhất riêng.
     3. Bộ chia bề rộng   — thuật toán phân bổ bề rộng cột theo nội dung.
     4. Các khối dựng sẵn — đầu trang, tiêu đề, khối các bên, bảng, tổng cộng,
                            tiền bằng chữ, điều khoản, chữ ký, chân trang.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI;
var DDS = W.DDS = {};

/* ==========================================================================
   1. ĐO CHỮ
   Bề rộng cột chỉ đúng khi biết chuỗi dài bao nhiêu milimét trên giấy. Ta đo
   trực tiếp bằng bộ đo của trình duyệt với đúng phông và đúng cỡ chữ sẽ in;
   nếu môi trường không có bộ đo thì dùng bảng hệ số đã hiệu chuẩn cho
   Times New Roman để ước lượng.
   ========================================================================== */
var _ctx = null, _coCtx = false;
function boDo() {
    if (_coCtx) return _ctx;
    _coCtx = true;
    try {
        var cv = document.createElement('canvas');
        _ctx = cv.getContext ? cv.getContext('2d') : null;
    } catch (e) { _ctx = null; }
    return _ctx;
}
/* Hệ số bề rộng trung bình theo em của Times New Roman — dùng khi không đo được. */
function uocLuong(s, pt, dam) {
    var n = 0, i, c;
    for (i = 0; i < s.length; i++) {
        c = s.charCodeAt(i);
        if (c === 32) n += 0.25;
        else if (c >= 48 && c <= 57) n += 0.5;                    // chữ số
        else if (c >= 65 && c <= 90) n += 0.68;                   // chữ hoa
        else if ('.,:;\'`|!i lIjt'.indexOf(s[i]) >= 0) n += 0.28;  // chữ hẹp
        else if ('mwMW'.indexOf(s[i]) >= 0) n += 0.86;             // chữ rộng
        else n += 0.47;
    }
    return n * pt * 0.35278 * (dam ? 1.04 : 1);
}
/** Bề rộng của một chuỗi, tính bằng milimét, theo đúng phông và cỡ chữ in. */
function doChu(s, pt, dam, font) {
    s = String(s === undefined || s === null ? '' : s);
    if (!s) return 0;
    var c = boDo();
    if (!c) return uocLuong(s, pt, dam);
    try {
        c.font = (dam ? 'bold ' : '') + pt + 'pt "' + (font || 'Times New Roman') + '", Times, serif';
        var px = c.measureText(s).width;
        if (!px) return uocLuong(s, pt, dam);
        return px * 25.4 / 96;
    } catch (e) { return uocLuong(s, pt, dam); }
}
DDS.doChu = doChu;

/* ==========================================================================
   2. BỘ CỘT CHUẨN
   Mỗi loại cột được khai một lần cho toàn hệ thống: cách căn chữ, ngưỡng hẹp
   nhất để chữ không bị bóp, ngưỡng rộng nhất để cột không nuốt chỗ của cột
   khác, và cột nào được phép giãn ra chiếm phần còn lại của trang.
   ========================================================================== */
var COT = {
    stt:  { cls: 'stt',   min:  9, max: 13, kin: true },
    /* Mã hàng (Model) là một khối không thể tách: trình duyệt sẽ ngắt dòng
       ngay sau dấu gạch nối nếu cột hẹp, làm mã hàng gãy làm đôi trên bản in.
       Vì vậy cột mã luôn là cột KÍN — bề rộng luôn đủ chứa mã dài nhất. */
    ma:   { cls: 'c ma',  min: 20, max: 40, kin: true },
    ten:  { cls: 'ten',   min: 44, max: 78, gian: true },
    mota: { cls: 'ten',   min: 34, max: 78, gian: true },
    dvt:  { cls: 'c',     min: 11, max: 18, kin: true },
    sl:   { cls: 'n',     min: 13, max: 22, kin: true, so: true },
    gia:  { cls: 'n',     min: 22, max: 33, kin: true, so: true },
    tien: { cls: 'n',     min: 25, max: 38, kin: true, so: true },
    pt:   { cls: 'n',     min: 13, max: 20, kin: true, so: true },
    ngay: { cls: 'c',     min: 19, max: 26, kin: true },
    ma2:  { cls: 'c ma',  min: 17, max: 36, kin: true },
    chu:  { cls: '',      min: 20, max: 70 },
    gc:   { cls: '',      min: 20, max: 46 }
};
DDS.COT = COT;

/* Đệm trong ô: 2mm mỗi bên + 0,8mm dự phòng cho sai số làm tròn của trình duyệt. */
var DEM_O_THUONG = 4.8, DEM_DAU_THUONG = 4.6;
/* Bảng CHẬT: dùng cho biểu mẫu nhiều cột (báo giá chín cột). Đệm 1,2mm mỗi
   bên — chín cột tiết kiệm được gần 15mm bề ngang, đủ để không cột nào phải
   co xuống dưới mức đọc được. Bảng thường vẫn giữ nguyên đệm 2mm. */
var DEM_O_HEP = 3.2, DEM_DAU_HEP = 3.0;
var PT_O = 11.5, PT_DAU = 10.5;

/* ==========================================================================
   3. BỘ CHIA BỀ RỘNG CỘT
   Cách làm:
     • Đo nhu cầu thật của từng cột = max(bề rộng tiêu đề cột, bề rộng ô dài
       nhất) rồi cộng đệm.
     • Cột "kín" (số thứ tự, đơn vị tính, số lượng, đơn giá, thành tiền) không
       được phép xuống dòng → nhu cầu của nó là ngưỡng cứng.
     • Cột giãn (tên hàng) luôn được giữ ít nhất bề rộng tối thiểu, phần dư
       của trang dồn hết cho nó nên bảng luôn kín trang, không lệch.
     • Nếu tổng nhu cầu vượt trang, các cột co lại theo tỷ lệ phần vượt trên
       mức tối thiểu — cột nào đang thừa nhiều thì nhường nhiều.
   Trả về danh sách phần trăm để bảng luôn vừa đúng 100% bề ngang vùng in,
   dù mẫu in có đổi khổ giấy hay tỷ lệ in.
   ========================================================================== */
DDS.doRong = function (cot, rows, rongMm, hep) {
    var n = cot.length;
    var rong = Number(rongMm) || 175;
    var i, c, k;
    var min = [], max = [], can = [], gian = [], kin = [], dau = [];
    var DEM_O = hep ? DEM_O_HEP : DEM_O_THUONG;
    var DEM_DAU = hep ? DEM_DAU_HEP : DEM_DAU_THUONG;

    for (i = 0; i < n; i++) {
        c = cot[i];
        k = COT[c.k] || COT.chu;
        /* Từng biểu mẫu được phép siết thêm ngưỡng của riêng nó khi cột đó có
           nội dung đặc thù; không khai thì dùng ngưỡng chuẩn của loại cột. */
        var kMin = c.min !== undefined ? c.min : k.min;
        var kMax = c.max !== undefined ? c.max : k.max;
        var kGian = c.gian !== undefined ? !!c.gian : !!k.gian;
        /* Cột "kín" không được xuống dòng nên nhu cầu của nó là ngưỡng cứng.
           Biểu mẫu nhiều cột được phép hạ một cột kín xuống thành cột thường
           (khai kin: false) để nội dung dài tự xuống dòng thay vì bắt cả bảng
           phải nới ra — bảng chín cột của báo giá dùng đúng cơ chế này cho
           cột Model. */
        var kKin = c.kin !== undefined ? !!c.kin : !!k.kin;
        /* Tiêu đề cột in HOA và giãn chữ nên phải đo đúng chuỗi sẽ hiện lên
           giấy, không đo chuỗi khai trong mã — nếu không cột sẽ hụt và tiêu đề
           bị cắt mất chữ cuối. */
        var tDau = String(c.t || '').toUpperCase();
        var rDau = doChu(tDau, PT_DAU, true) + DEM_DAU + tDau.length * 0.06;
        /* Chứng từ kế toán có những tiêu đề cột rất dài mà thể thức mẫu quy
           định phải giữ nguyên chữ ("Tên, nhãn hiệu, quy cách, phẩm chất vật
           tư, dụng cụ, sản phẩm, hàng hóa"). Cột khai dauDong = n cho phép
           tiêu đề trải trên n dòng, nên nhu cầu bề rộng của nó chia cho n —
           nhưng không bao giờ hẹp hơn từ dài nhất, để không có từ nào gãy. */
        if (c.dauDong > 1) {
            var tuD = 0;
            tDau.split(/\s+/).forEach(function (t2) {
                var w2 = doChu(t2, PT_DAU, true) + DEM_DAU;
                if (w2 > tuD) tuD = w2;
            });
            tuD *= 1.06;                    // dự phòng sai số đo và giãn chữ
            rDau = Math.max(tuD, (rDau - DEM_DAU) / c.dauDong + DEM_DAU);
        }
        var rO = 0;
        for (var j = 0; j < rows.length; j++) {
            var v = c.v ? c.v(rows[j], j) : '';
            var w = doChu(v, PT_O, false) + DEM_O;
            if (w > rO) rO = w;
        }
        /* Những chuỗi KHÔNG nằm trong danh sách dòng nhưng vẫn phải in vào
           cột này — điển hình là ba dòng tổng cộng nằm trong chân bảng. Tổng
           bao giờ cũng dài hơn từng dòng, nếu không đo thì cột Thành tiền sẽ
           hụt đúng ở dòng quan trọng nhất của biểu mẫu. */
        if (c.them && c.them.length)
            for (var jt = 0; jt < c.them.length; jt++) {
                var wt = doChu(c.them[jt], PT_O, true) + DEM_O;
                if (wt > rO) rO = wt;
            }
        gian[i] = kGian;
        kin[i] = kKin;
        dau[i] = rDau;
        // Cột chữ dài được phép xuống dòng nên không lấy trọn nhu cầu
        if (!kKin && rO > kMax) rO = kMax;
        min[i] = Math.max(kMin, rDau, kKin ? rO : 0);
        max[i] = Math.max(min[i], kMax);
        can[i] = Math.min(Math.max(rDau, rO, min[i]), max[i]);
    }

    // Bề rộng dành sẵn cho các cột giãn — không cho cột khác lấn vào
    var giuGian = 0, coGian = false;
    for (i = 0; i < n; i++) if (gian[i]) { giuGian += min[i]; coGian = true; }

    var w = [];
    if (coGian) {
        var quy = rong - giuGian;                       // phần chia cho cột cố định
        var tongMin = 0, tongCan = 0;
        for (i = 0; i < n; i++) if (!gian[i]) { tongMin += min[i]; tongCan += can[i]; }
        if (tongCan <= quy) {
            for (i = 0; i < n; i++) w[i] = gian[i] ? 0 : can[i];
        } else if (tongMin <= quy) {                    // co phần thừa theo tỷ lệ
            var du = quy - tongMin, muon = tongCan - tongMin;
            for (i = 0; i < n; i++)
                w[i] = gian[i] ? 0 : min[i] + (muon > 0 ? (can[i] - min[i]) / muon * du : 0);
        } else {                                        // trang quá hẹp: co đều tất cả
            var he = quy / tongMin;
            for (i = 0; i < n; i++) w[i] = gian[i] ? 0 : min[i] * Math.max(0.55, he);
        }
        // Phần còn lại của trang chia cho các cột giãn theo tỷ lệ nhu cầu
        var conLai = rong, tongGian = 0, soGian = 0;
        for (i = 0; i < n; i++) if (!gian[i]) conLai -= w[i];
        for (i = 0; i < n; i++) if (gian[i]) { tongGian += can[i]; soGian++; }
        for (i = 0; i < n; i++)
            if (gian[i]) w[i] = tongGian > 0 ? conLai * (can[i] / tongGian) : conLai / soGian;

        /* Chứng từ ít chữ (ví dụ phiếu xuất kho, tên hàng ngắn, ghi chú để
           trống) sẽ dư chỗ. Không để một cột phình ra quá rộng trông mất cân
           đối: cột giãn dừng ở ngưỡng rộng nhất của nó, phần dư chia tiếp cho
           các cột còn đang chật theo đúng khoảng còn nới được của từng cột. */
        var du = 0;
        for (i = 0; i < n; i++) if (gian[i] && w[i] > max[i]) { du += w[i] - max[i]; w[i] = max[i]; }
        while (du > 0.05) {
            var noiDuoc = 0;
            for (i = 0; i < n; i++) noiDuoc += Math.max(0, max[i] - w[i]);
            if (noiDuoc <= 0.05) {                       // hết chỗ nới: trả về cột giãn
                for (i = 0; i < n; i++) if (gian[i]) { w[i] += du; du = 0; break; }
                if (du > 0.05) { w[n - 1] += du; du = 0; }
                break;
            }
            var chia = Math.min(du, noiDuoc);
            for (i = 0; i < n; i++) w[i] += Math.max(0, max[i] - w[i]) / noiDuoc * chia;
            du -= chia;
        }
    } else {
        var tm = 0, tc = 0;
        for (i = 0; i < n; i++) { tm += min[i]; tc += can[i]; }
        if (tc <= rong) {
            var thua = rong - tc, tongNoi = 0;
            for (i = 0; i < n; i++) tongNoi += Math.max(0, max[i] - can[i]);
            for (i = 0; i < n; i++)
                w[i] = can[i] + (tongNoi > 0 ? Math.max(0, max[i] - can[i]) / tongNoi * thua : thua / n);
        } else if (tm <= rong) {
            var d2 = rong - tm, m2 = tc - tm;
            for (i = 0; i < n; i++) w[i] = min[i] + (m2 > 0 ? (can[i] - min[i]) / m2 * d2 : 0);
        } else {
            var h2 = rong / tm;
            for (i = 0; i < n; i++) w[i] = min[i] * h2;
        }
    }

    // Quy ra phần trăm để bảng luôn vừa đúng bề ngang vùng in
    var tong = 0;
    for (i = 0; i < n; i++) tong += w[i];
    var pc = [], da = 0;
    for (i = 0; i < n; i++) {
        var p = i === n - 1 ? Math.max(1, 100 - da) : Math.round(w[i] / tong * 10000) / 100;
        pc.push(p); da += p;
    }

    /* HỆ SỐ CO CHỮ CHO BẢNG QUÁ RỘNG.
       Báo cáo nhiều cột số (công nợ, sổ thu - chi…) có tổng nhu cầu tối thiểu
       vượt bề ngang trang giấy: các cột bị co dưới ngưỡng trong khi chữ số và
       tiêu đề cột KHÔNG được xuống dòng → chữ của cột này ĐÈ lên cột kia cả ở
       bản xem trước lẫn bản in. Cách xử lý đúng thể thức: giữ nguyên bố cục,
       co cỡ chữ của riêng bảng đó vừa đủ để nội dung không tràn ô.
       he = 1 nghĩa là không phải co — mọi biểu mẫu bình thường giữ nguyên. */
    var he = 1;
    for (i = 0; i < n; i++) {
        // ô dữ liệu của cột kín (số liệu) không được xuống dòng
        if (kin[i]) {
            var canO = min[i] - DEM_O, coO = w[i] - DEM_O;
            if (canO > 0.5 && coO < canO) he = Math.min(he, Math.max(0.55, coO / canO));
        }
        // tiêu đề cột nào cũng không được xuống dòng (trừ cột khai dauDong)
        var canD = dau[i] - DEM_DAU, coD = w[i] - DEM_DAU;
        if (canD > 0.5 && coD < canD) he = Math.min(he, Math.max(0.55, coD / canD));
    }

    return { mm: w, pc: pc, min: min, can: can, he: he };
};

/* ==========================================================================
   4. CÁC KHỐI DỰNG SẴN
   ========================================================================== */
function esc(v) { return T.esc(v === undefined || v === null ? '' : v); }
function co(C, k, macDinh) {
    if (!C || C[k] === undefined) return macDinh === undefined ? true : macDinh;
    return C[k] !== false;
}

/* ==========================================================================
   4.0 BỘ KHỐI CỦA BIỂU MẪU GIAO DỊCH — DỰNG THEO ĐÚNG BIỂU MẪU GIẤY
   --------------------------------------------------------------------------
   Bốn biểu mẫu Báo giá · Đơn đặt hàng · Biên bản giao hàng · Đề nghị thanh
   toán dựng lại ĐÚNG bố cục tệp biểu mẫu doanh nghiệp đang dùng:
     • Đầu trang là một KHUNG KẺ Ô: ô logo bên trái chiếm trọn chiều cao, các
       dòng thông tin pháp nhân xếp ngay bên phải logo — tên công ty, địa chỉ,
       điện thoại, website, mã số thuế, thư điện tử, người đại diện, chức vụ
       và tài khoản ngân hàng.
     • Khối bên đối tác cũng là một khung kẻ ô, mỗi dòng một nhãn, dòng chưa
       có dữ liệu vẫn in để điền tay trên bản giấy.
     • Đề mục đánh số kiểu "ĐIỀU 1: TÊN ĐIỀU" in hoa đậm, gạch chân.
     • Ba dòng tổng cộng nằm NGAY TRONG bảng hàng hóa, có nền nhấn.
   ========================================================================== */

/** Đầu trang doanh nghiệp dạng KHUNG KẺ Ô — đúng biểu mẫu giấy. */
DDS.dauDN = function (cty, C) {
    cty = cty || DB.cty();
    C = C || W.__C || {};
    var d = [];                       // mỗi phần tử: [tráiHTML, phảiHTML|null]
    if (co(C, 'hienDiaChi') && cty.diaChi)
        d.push(['<b>Địa chỉ:</b> ' + esc(cty.diaChi), null]);
    var dt = co(C, 'hienDienThoai') && cty.dienThoai
        ? '<b>Điện thoại:</b> ' + esc(cty.dienThoai) : '';
    var web = co(C, 'hienWebsite') && cty.website
        ? '<b>Website:</b> ' + esc(cty.website) : '';
    if (dt || web) d.push([dt, web]);
    var mst = co(C, 'hienMST') && cty.mst ? '<b>MST: ' + esc(cty.mst) + '</b>' : '';
    var em = co(C, 'hienEmail') && cty.email ? '<b>Email:</b> ' + esc(cty.email) : '';
    if (mst || em) d.push([mst, em]);
    var dai = cty.daiDien ? '<b>Đại diện:</b> ' + esc(cty.daiDien) : '';
    var chuc = cty.chucVu ? '<i><b>Chức vụ:</b> ' + esc(cty.chucVu) + '</i>' : '';
    if (dai || chuc) d.push([dai, chuc]);
    if (co(C, 'hienNganHang') && cty.nganHang)
        d.push(['<b>Tài khoản:</b> ' + esc(cty.nganHang), null]);

    var soDong = 1 + d.length;        // dòng tên công ty + các dòng thông tin
    var rongLogo = C.coLogo ? Number(C.coLogo) : 26;
    var h = '<table class="pr-dnk"><colgroup>' +
        '<col style="width:' + rongLogo + 'mm"><col><col style="width:38%">' +
        '</colgroup><tbody>' +
        '<tr><td class="lg" rowspan="' + soDong + '">' +
        (co(C, 'hienLogo') && cty.logo ? '<img src="' + cty.logo + '">' : '') + '</td>' +
        '<td class="nm" colspan="2">' +
        (co(C, 'hienTenDonVi') ? esc(cty.ten) : '') + '</td></tr>';
    d.forEach(function (x) {
        /* Chỉ tách hai ô khi CẢ HAI bên có nội dung; nếu không thì trải hết bề
           ngang để đầu trang không còn ô trống lửng. */
        h += (x[1] === null || !x[0] || !x[1])
            ? '<tr><td class="ln" colspan="2">' + (x[0] || x[1]) + '</td></tr>'
            : '<tr><td class="ln">' + x[0] + '</td><td class="ln">' + x[1] + '</td></tr>';
    });
    return h + '</tbody></table>';
};

/**
 * Tiêu đề biểu mẫu giao dịch — in hoa đậm, canh giữa, được phép hai dòng.
 * o = { tieu, dong2, mau }
 */
DDS.tieuDeDN = function (o) {
    o = o || {};
    return '<div class="pr-tieu2"' + (o.mau ? ' style="color:' + o.mau + '"' : '') + '>' +
        '<h1>' + esc(o.tieu) + (o.dong2 ? '<br>' + esc(o.dong2) : '') + '</h1>' +
        (o.so ? '<div class="so">Số: ' + esc(o.so) + '</div>' : '') + '</div>';
};

/** Dòng địa danh — ngày tháng năm, canh phải, in nghiêng. */
DDS.dongNgay = function (diaDanh, iso) {
    var p = String(iso || '').substr(0, 10).split('-');
    var ng = p.length === 3 && p[0]
        ? 'ngày ' + p[2] + ' tháng ' + p[1] + ' năm ' + p[0]
        : 'ngày ..... tháng ..... năm .....';
    return '<div class="pr-ngay">' + esc(diaDanh || '') + ', ' + ng + '</div>';
};

/**
 * Khối thông tin một bên dạng KHUNG KẺ Ô.
 * o = { nhan, ten, dong: [{k, v} | {k, v, k2, v2}] }
 * Dòng chưa có dữ liệu vẫn in để người nhận điền tay trên bản giấy.
 */
DDS.khungBen = function (o) {
    o = o || {};
    var h = '<table class="pr-khung"><tbody>' +
        '<tr><td class="h" colspan="2">' + esc(o.nhan) +
        (o.ten ? ' <b>' + esc(o.ten) + '</b>' : '') + '</td></tr>';
    (o.dong || []).forEach(function (x) {
        if (!x) return;
        if (x.k2 === undefined)
            h += '<tr><td colspan="2">' + esc(x.k) + ': ' + esc(x.v || '') + '</td></tr>';
        else
            h += '<tr><td>' + esc(x.k) + ': ' + esc(x.v || '') + '</td>' +
                 '<td>' + esc(x.k2) + ': ' + esc(x.v2 || '') + '</td></tr>';
    });
    return h + '</tbody></table>';
};

/**
 * Đầu trang CÔNG VĂN theo thể thức văn bản hành chính Việt Nam:
 * bên trái là tên đơn vị ban hành và số công văn, bên phải là quốc hiệu và
 * tiêu ngữ. Dùng cho Đề nghị thanh toán / Đề nghị tạm ứng — đúng biểu mẫu
 * doanh nghiệp đang dùng.
 */
DDS.dauCongVan = function (cty, so) {
    cty = cty || DB.cty();
    return '<table class="pr-cv"><colgroup><col style="width:45%"><col></colgroup><tbody>' +
        '<tr><td><div class="dv">' + esc(cty.ten) + '</div>' +
        '<div class="o">-----o0o------</div>' +
        (so ? '<div class="so">Số: ' + esc(so) + '</div>' : '') + '</td>' +
        '<td><div class="qh">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>' +
        '<div class="tn">Độc lập - Tự do - Hạnh phúc</div>' +
        '<div class="o">--------o0o--------</div></td></tr>' +
        '</tbody></table>';
};

/** Đề mục "ĐIỀU n: TÊN ĐIỀU" — in hoa đậm, gạch chân, đúng biểu mẫu giấy. */
DDS.mucDieu = function (so, ten) {
    return '<div class="pr-muc">ĐIỀU ' + so + ': ' + esc(ten) + '</div>';
};

/** Danh sách gạch đầu dòng của biểu mẫu giao dịch — gạch ngang, treo lề. */
DDS.gach = function (items) {
    var d = (items || []).filter(Boolean);
    if (!d.length) return '';
    return '<div class="pr-gach">' + d.map(function (x) {
        return '<div>' + x + '</div>';
    }).join('') + '</div>';
};

/**
 * Khối chữ ký hai bên của biểu mẫu giao dịch — chức danh in hoa đậm, lời dặn
 * ký in nghiêng, chừa đủ chỗ ký tay; con dấu và chữ ký của đơn vị phát hành
 * in đè lên ô bên phải nếu doanh nghiệp đã khai ảnh.
 * KHÔNG in sẵn tên người ký: mọi biểu mẫu để trống chỗ ký cho người ký tự
 * ghi rõ họ tên trên bản giấy.
 * o = { dau, ky, dTrai, dPhai }
 */
DDS.kyDN = function (trai, phai, o) {
    o = o || {};
    return '<div class="pr-kydn">' +
        '<div><div class="r">' + esc(trai) + '</div>' +
        '<div class="d">' + esc(o.dTrai || '( Ký, họ tên )') + '</div>' +
        '<div class="h"></div></div>' +
        '<div class="p"><div class="r">' + esc(phai) + '</div>' +
        '<div class="d">' + esc(o.dPhai || '( Ký, họ tên, đóng dấu )') + '</div>' +
        '<div class="h">' +
        (o.dau ? '<img class="dau" src="' + o.dau + '">' : '') +
        (o.ky ? '<img class="ky" src="' + o.ky + '">' : '') + '</div></div>' +
        '</div>';
};

/* ------------------------------------------------------------ 4.1 ĐẦU TRANG
   Ba vùng: dấu hiệu · danh xưng · liên hệ. Thông tin liên hệ tách hẳn sang
   cột phải, mỗi mục một dòng, nên dù doanh nghiệp khai đủ mã số thuế, điện
   thoại, thư điện tử, trang thông tin và tài khoản ngân hàng thì đầu trang
   vẫn cân, không dồn chữ và không đẩy tên doanh nghiệp xuống dòng.          */
DDS.dauTrang = function (cty, C) {
    cty = cty || DB.cty();
    C = C || W.__C || {};
    var lh = [];
    if (co(C, 'hienMST') && cty.mst)
        lh.push('<div><span class="k">MST</span> <b>' + esc(cty.mst) + '</b></div>');
    if (co(C, 'hienDienThoai') && cty.dienThoai)
        lh.push('<div><span class="k">ĐT</span> ' + esc(cty.dienThoai) + '</div>');
    if (co(C, 'hienEmail') && cty.email)
        lh.push('<div><span class="k">Email</span> ' + esc(cty.email) + '</div>');
    if (co(C, 'hienWebsite') && cty.website)
        lh.push('<div><span class="k">Web</span> ' + esc(cty.website) + '</div>');
    if (co(C, 'hienNganHang') && cty.nganHang)
        lh.push('<div><span class="k">TK</span> ' + esc(cty.nganHang) + '</div>');

    var rong = C.coLogo ? Number(C.coLogo) : 26;
    return '<div class="pr-head"' + (co(C, 'duongKeDau') ? '' : ' style="border-bottom:none"') + '>' +
        (co(C, 'hienLogo')
            ? '<div class="lg" style="width:' + rong + 'mm;flex:0 0 ' + rong + 'mm">' +
              (cty.logo ? '<img src="' + cty.logo + '">' : '') + '</div>'
            : '') +
        '<div class="co">' +
        (co(C, 'hienTenDonVi') ? '<div class="nm">' + esc(cty.ten) + '</div>' : '') +
        (co(C, 'hienDiaChi') && cty.diaChi ? '<div class="ln">' + esc(cty.diaChi) + '</div>' : '') +
        (cty.nganhNghe ? '<div class="ln">' + esc(cty.nganhNghe) + '</div>' : '') +
        '</div>' +
        (lh.length ? '<div class="lh">' + lh.join('') + '</div>' : '') +
        '</div>';
};

/* ----------------------------------------------------------- 4.2 TIÊU ĐỀ
   o = { eyebrow, tieu, so, ngay, ref[], gach }
   Ba bậc: dòng dẫn nhỏ in hoa thưa chữ → tên biểu mẫu → dòng định danh.    */
DDS.tieuDe = function (o) {
    o = o || {};
    var dinhDanh = [];
    if (o.so) dinhDanh.push('Số: ' + esc(o.so));
    if (o.ngay) dinhDanh.push(esc(o.ngay));
    (o.ref || []).forEach(function (x) { if (x) dinhDanh.push(esc(x)); });
    return '<div class="pr-title">' +
        (o.eyebrow ? '<div class="eb">' + esc(o.eyebrow) + '</div>' : '') +
        '<h1>' + (o.html || esc(o.tieu)) + '</h1>' +
        (o.gach === false ? '' : '<div class="gc"></div>') +
        (dinhDanh.length ? '<div class="no">' + dinhDanh.join(' &nbsp;·&nbsp; ') + '</div>' : '') +
        (o.phu ? '<div class="dt">' + esc(o.phu) + '</div>' : '') +
        '</div>';
};

/* -------------------------------------------------------- 4.3 KHỐI CÁC BÊN
   Mỗi bên là một thẻ: nhãn vai trò, tên đơn vị, rồi danh sách nhãn — giá trị
   thẳng cột. Hai thẻ đặt cạnh nhau đọc song song được; một thẻ thì chiếm hết
   bề ngang. Ô nào doanh nghiệp chưa khai thì để trống chờ điền tay, không in
   dòng chấm dài làm rối trang.                                              */
DDS.the = function (o) {
    o = o || {};
    /* Chỉ in những dòng thật sự có dữ liệu. Ô trống không được để lại nhãn cụt
       lơ lửng trên giấy; dòng nào bắt buộc phải chừa chỗ điền tay thì khai
       giu: true. */
    var d = (o.dong || []).filter(function (x) {
        return x && x.k && (x.giu || (x.v !== undefined && x.v !== null && String(x.v).trim() !== ''));
    });
    return '<div class="pr-card">' +
        (o.nhan ? '<div class="cl">' + esc(o.nhan) + '</div>' : '') +
        (o.ten ? '<div class="cn">' + esc(o.ten) + '</div>' : '') +
        (d.length ? '<div class="pr-dl">' + d.map(function (x) {
            /* Dấu hai chấm nằm trong nhãn và có một khoảng trắng thật giữa hai
               ô: trên giấy nhãn thẳng cột, còn khi xuất Word / Excel thì đọc
               liền mạch thành "Địa chỉ: …" chứ không dính chữ. */
            return '<div><span class="k">' + esc(x.k) + ':</span> ' +
                   '<span class="v">' + (x.html ? x.v : esc(x.v || '')) + '</span></div>';
        }).join('') + '</div>' : '') +
        '</div>';
};
DDS.cacBen = function (ds) {
    return '<div class="pr-ben">' + ds.filter(Boolean).join('') + '</div>';
};
/** Khối thông tin một pháp nhân — dùng chung cho bên bán, bên mua, nhà cung cấp. */
/**
 * Khối thông tin một pháp nhân.
 * o.giu = true — luôn in đủ các dòng bắt buộc (địa chỉ, mã số thuế, điện thoại,
 * đại diện) kể cả khi chưa có dữ liệu, để hai thẻ cạnh nhau cân bằng và người
 * nhận điền tay được ngay trên bản in. Dùng cho khối khách hàng của bộ hồ sơ
 * giao dịch, nơi hồ sơ khách thường chưa khai đủ.
 */
DDS.benChuan = function (nhan, o) {
    o = o || {};
    var buoc = { 'Địa chỉ': 1, 'Mã số thuế': 1, 'Điện thoại': 1, 'Đại diện': 1 };
    return DDS.the({
        nhan: nhan, ten: o.ten,
        dong: [
            { k: 'Địa chỉ', v: o.diaChi },
            { k: 'Mã số thuế', v: o.mst },
            { k: 'Điện thoại', v: o.dienThoai },
            { k: 'Tài khoản', v: o.nganHang },
            { k: 'Đại diện', v: o.daiDien },
            { k: 'Chức vụ', v: o.chucVu }
        ].filter(function (x) { return x.v || (o.giu && buoc[x.k]); })
         .map(function (x) { return o.giu && buoc[x.k] ? { k: x.k, v: x.v, giu: true } : x; })
    });
};

/* ------------------------------------------------------------- 4.4 BẢNG
   o = { cot:[{k, t, v(row,i), h(row,i), cls}], rows, rong, tong:[{k,v,manh}] }
   Bề rộng cột tính theo nội dung thật; tiêu đề cột không bao giờ gãy dòng;
   ô số không bao giờ xuống dòng; bảng luôn vừa đúng bề ngang vùng in.       */
DDS.bang = function (o) {
    var cot = o.cot || [], rows = o.rows || [];
    /* Cột Thành tiền phải đủ rộng cho CẢ ba dòng tổng cộng ở chân bảng, không
       chỉ cho các dòng hàng hóa — tổng luôn là con số dài nhất của biểu mẫu.
       Bản sao dưới đây chỉ dùng để ĐO bề rộng, không đổi cách dựng ô. */
    var cotDo = cot;
    if (o.tongBang && o.tongBang.length) {
        var iTd = o.cotTien === undefined ? cot.length - 1 : o.cotTien;
        if (cot[iTd]) {
            cotDo = cot.slice();
            var cD = {}, kk;
            for (kk in cot[iTd]) if (Object.prototype.hasOwnProperty.call(cot[iTd], kk)) cD[kk] = cot[iTd][kk];
            cD.them = o.tongBang.map(function (x) {
                return String(x && x.v !== undefined && x.v !== null ? x.v : '');
            });
            cotDo[iTd] = cD;
        }
    }
    /* o.hep = bảng nhiều cột, đệm ô hẹp lại. Bề rộng cột phải được tính bằng
       ĐÚNG mức đệm mà tệp định kiểu sẽ áp dụng, nếu không cột sẽ hụt. */
    var kq = DDS.doRong(cotDo, rows, o.rong, o.hep);
    /* Một ô tiêu đề cột. */
    function oDau(c, them) {
        var k = COT[c.k] || COT.chu;
        return '<th class="' + (c.clsDau || (k.cls === 'ten' || k.cls === 'stt' ? 'c' : k.cls) || '') +
               (c.dauDong > 1 ? ' xuong' : '') + '"' + (them || '') + '>' + esc(c.t) + '</th>';
    }
    /* Tiêu đề hai bậc — các cột liền nhau khai cùng một `nhom` được gộp lại
       dưới một tiêu đề chung ở bậc trên (thể thức "Số lượng" gồm "Theo chứng
       từ" và "Thực nhập" của chứng từ kho). Cột không thuộc nhóm nào thì ô
       tiêu đề của nó cao trọn hai bậc. */
    var coNhom = false, ii;
    for (ii = 0; ii < cot.length; ii++) if (cot[ii].nhom) { coNhom = true; break; }
    var hDau;
    if (coNhom) {
        var d1 = '', d2 = '';
        for (ii = 0; ii < cot.length;) {
            if (cot[ii].nhom) {
                var jj = ii;
                while (jj < cot.length && cot[jj].nhom === cot[ii].nhom) jj++;
                d1 += '<th class="c" colspan="' + (jj - ii) + '">' + esc(cot[ii].nhom) + '</th>';
                for (var qq = ii; qq < jj; qq++) d2 += oDau(cot[qq]);
                ii = jj;
            } else {
                d1 += oDau(cot[ii], ' rowspan="2"');
                ii++;
            }
        }
        hDau = '<tr>' + d1 + '</tr><tr>' + d2 + '</tr>';
    } else {
        hDau = '<tr>' + cot.map(function (c) { return oDau(c); }).join('') + '</tr>';
    }
    /* Bảng quá rộng so với trang: co cỡ chữ của RIÊNG bảng này theo hệ số đã
       tính ở bộ chia bề rộng, để chữ số và tiêu đề cột không tràn sang cột
       bên cạnh. Bảng bình thường (he = 1) giữ nguyên, không đổi gì. */
    var coChu = '';
    if (kq.he < 0.995) {
        coChu = ' style="--pr-co-bang:' + (Math.round(PT_O * kq.he * 10) / 10) +
                'pt;--d-chu-bang:' + (Math.round(PT_O * kq.he * 10) / 10) +
                'pt;--pr-co-bang-dau:' + (Math.round(PT_DAU * kq.he * 10) / 10) +
                'pt;--d-chu-dau:' + (Math.round(PT_DAU * kq.he * 10) / 10) + 'pt"';
    }
    var h = '<table class="pr-tb' + (o.hep ? ' hep' : '') + '"' + coChu + '><colgroup>' +
        kq.pc.map(function (p) { return '<col style="width:' + p + '%">'; }).join('') +
        '</colgroup><thead>' + hDau +
        /* Hàng ký hiệu cột A · B · C · 1 · 2 · 3 — thể thức bắt buộc của chứng
           từ kế toán, giúp đối chiếu với hướng dẫn ghi chép của từng mẫu. */
        (o.dauPhu && o.dauPhu.length
            ? '<tr class="kyhieu">' + cot.map(function (c, i) {
                  var k = COT[c.k] || COT.chu;
                  return '<th class="' + (k.cls === 'ten' || k.cls === 'stt' ? 'c' : (k.cls || '')) +
                         '">' + esc(o.dauPhu[i] === undefined ? '' : o.dauPhu[i]) + '</th>';
              }).join('') + '</tr>'
            : '') +
        '</thead><tbody>';
    rows.forEach(function (r, i) {
        h += '<tr>' + cot.map(function (c) {
            var k = COT[c.k] || COT.chu;
            var noi = c.h ? c.h(r, i) : esc(c.v ? c.v(r, i) : '');
            return '<td class="' + (c.cls || k.cls || '') + '">' + noi + '</td>';
        }).join('') + '</tr>';
    });
    h += '</tbody>';
    /* Ba dòng tổng cộng NẰM NGAY TRONG bảng, đúng biểu mẫu giấy của doanh
       nghiệp: ký hiệu * · ** · *** ở cột số thứ tự, tên chỉ tiêu trải giữa
       bảng, số tiền thẳng cột Thành tiền, nền nhấn để mắt bắt ngay.
       o.tongBang = [{ ky, ten, v, chinh }] · o.cotTien = chỉ số cột Thành tiền */
    if (o.tongBang && o.tongBang.length) {
        var iT = o.cotTien === undefined ? cot.length - 1 : o.cotTien;
        var span = Math.max(1, iT - 1);
        var duoi = cot.length - iT - 1;
        h += '<tfoot>' + o.tongBang.map(function (x) {
            return '<tr class="tt' + (x.chinh ? ' g' : '') + '">' +
                '<td class="c">' + esc(x.ky || '') + '</td>' +
                '<td class="c t" colspan="' + span + '">' + esc(x.ten) + '</td>' +
                '<td class="n">' + esc(x.v) + '</td>' +
                (duoi > 0 ? '<td colspan="' + duoi + '"></td>' : '') + '</tr>';
        }).join('') + '</tfoot>';
    } else if (o.tong && o.tong.length) {
        h += '<tfoot>' + o.tong.map(function (x) {
            return '<tr class="sum"><td colspan="' + (cot.length - 1) + '" class="n">' + esc(x.k) +
                   '</td><td class="n">' + esc(x.v) + '</td></tr>';
        }).join('') + '</tfoot>';
    } else if (o.tfoot) {
        /* Bảng dữ liệu của báo cáo cộng thẳng dưới đúng cột của nó — đọc báo
           cáo là thấy ngay con số nào thuộc chỉ tiêu nào. */
        h += '<tfoot>' + o.tfoot + '</tfoot>';
    }
    return h + '</table>';
};

/* ------------------------------------------------------- 4.5 KHỐI TỔNG CỘNG
   Không phải một dòng cuối bảng như bảng tính. Là một khối riêng canh phải,
   các dòng phụ mảnh, dòng tổng có dải nhận diện phía trên và cỡ chữ lớn hơn
   nên mắt bắt được số phải thanh toán trong chưa đầy một giây.              */
DDS.tong = function (ds) {
    ds = (ds || []).filter(Boolean);
    if (!ds.length) return '';
    /* Ô trống bên trái giữ cho khối luôn nằm sát mép phải của bảng hàng hóa,
       kể cả khi xuất sang Word và Excel. */
    return '<div class="pr-tong"><div class="pr-sp"></div><div class="b">' + ds.map(function (x) {
        return '<div class="r' + (x.chinh ? ' g' : '') + '">' +
            '<span class="k">' + esc(x.k) + '</span> ' +
            '<span class="v">' + esc(x.v) + '</span></div>';
    }).join('') + '</div></div>';
};

/** Tiền bằng chữ — dải riêng, in nghiêng, có vạch nhận diện bên trái. */
DDS.bangChu = function (soTien, nhan) {
    return '<div class="pr-words"><b>' + esc(nhan || 'Số tiền bằng chữ:') + '</b> ' +
        esc(T.docTien(soTien)) + '</div>';
};

/* ---------------------------------------------------------- 4.6 ĐIỀU KHOẢN
   Đánh số điều thống nhất trên mọi văn bản: "ĐIỀU n: TÊN ĐIỀU" gạch chân
   mảnh, nội dung thụt vào đúng một nhịp, gạch đầu dòng treo lề.             */
DDS.dieu = function (so, ten, noiDung) {
    return '<div class="pr-dieu"><div class="h">Điều ' + so + ': ' + esc(ten) + '</div>' +
        '<div class="b">' + (noiDung || '') + '</div></div>';
};
DDS.ds = function (items) {
    var d = (items || []).filter(Boolean);
    if (!d.length) return '';
    return '<ul class="pr-ds">' + d.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
};
DDS.dong = function (noi) { return '<div class="pr-l">' + noi + '</div>'; };

/* ------------------------------------------------------------- 4.7 CHỮ KÝ
   Danh sách ô ký do từng biểu mẫu quyết định. Mỗi ô: chức danh · lời dặn ký ·
   chỗ trống để ký · họ tên (nếu đã biết) · chức vụ. Không biểu mẫu nào in
   cứng tên người ký: tên lấy từ hồ sơ đơn vị hoặc từ chính chứng từ, chưa có
   thì để trống cho người ký tự điền.                                        */
DDS.ky = function (ds) {
    ds = (ds || []).filter(Boolean);
    if (!ds.length) return '';
    return '<div class="pr-sign">' + ds.map(function (x) {
        var anh = '';
        if (x.dau) anh += '<img src="' + x.dau + '" style="max-height:24mm;position:absolute;' +
                          'left:50%;top:0;transform:translateX(-50%);opacity:.9">';
        if (x.ky) anh += '<img src="' + x.ky + '" style="max-height:16mm;position:relative">';
        return '<div' + (anh ? ' style="position:relative"' : '') + '>' +
            '<div class="r">' + esc(x.r) + '</div>' +
            '<div class="d">' + esc(x.d || '(Ký, ghi rõ họ tên)') + '</div>' +
            '<div class="h">' + anh + '</div>' +
            /* KHÔNG in sẵn tên người ký trên bất kỳ biểu mẫu nào — chỗ ký để
               trống cho người ký tự ghi rõ họ tên trên bản giấy. */
            '</div>';
    }).join('') + '</div>';
};

/* ==========================================================================
   4.8 KHỐI CHỨNG TỪ KẾ TOÁN
   --------------------------------------------------------------------------
   Bốn chứng từ kế toán bắt buộc — phiếu thu, phiếu chi, phiếu nhập kho, phiếu
   xuất kho — không trình bày như văn bản thương mại. Chúng có thể thức riêng
   mà kế toán viên nào cũng thuộc lòng, và các phần mềm kế toán thông dụng đều
   in đúng thể thức đó:

       Đơn vị · Địa chỉ · Bộ phận  ······················  Mẫu số 01 - TT
                                                          (Ban hành theo …)

                              PHIẾU THU
                     Ngày … tháng … năm …                 Quyển số: …
                                                          Số: …
                                                          Nợ: …
                                                          Có: …
       Họ và tên người nộp tiền: ………………………………………………
       Địa chỉ: ……………………………………………………………………
       Lý do nộp: …………………………………………………………………
       Số tiền: ……………  (Viết bằng chữ): …………………………
       Kèm theo: ……… chứng từ gốc.

                                        Ngày … tháng … năm …
       Giám đốc  ·  Kế toán trưởng  ·  Người nộp tiền  ·  Người lập phiếu  ·  Thủ quỹ

   Bốn khối dưới đây dựng đúng thể thức ấy. Chúng nằm trong hệ thống thiết kế
   nên vẫn ăn theo phông chữ, cỡ chữ, lề và khổ giấy của mẫu đang áp dụng.
   ========================================================================== */

/**
 * Đầu trang chứng từ kế toán: khối đơn vị bên trái, khối mẫu số bên phải.
 * o = { mauSo, vanBan, boPhan }
 */
DDS.dauKeToan = function (cty, C, o) {
    cty = cty || DB.cty();
    C = C || W.__C || {};
    o = o || {};
    var trai = [];
    trai.push('<div><span class="k">Đơn vị:</span> <b>' + esc(cty.ten) + '</b></div>');
    if (co(C, 'hienDiaChi') && cty.diaChi)
        trai.push('<div><span class="k">Địa chỉ:</span> ' + esc(cty.diaChi) + '</div>');
    if (co(C, 'hienMST') && cty.mst)
        trai.push('<div><span class="k">Mã số thuế:</span> ' + esc(cty.mst) + '</div>');
    if (o.boPhan) trai.push('<div><span class="k">Bộ phận:</span> ' + esc(o.boPhan) + '</div>');

    var logo = (co(C, 'hienLogo') && cty.logo)
        ? '<div class="lg"><img src="' + cty.logo + '"></div>' : '';
    return '<div class="pr-ktdau">' +
        '<div class="dv">' + logo + '<div class="tt">' + trai.join('') + '</div></div>' +
        '<div class="ms">' +
            (o.mauSo ? '<div class="m">Mẫu số ' + esc(o.mauSo) + '</div>' : '') +
            (o.vanBan ? '<div class="v">(' + esc(o.vanBan) + ')</div>' : '') +
        '</div></div>';
};

/**
 * Tiêu đề chứng từ kế toán: tên phiếu ở giữa, dòng ngày tháng ngay dưới, khối
 * định danh (Quyển số · Số · Nợ · Có) canh phải cùng hàng với dòng ngày tháng.
 * o = { tieu, ngay:'Ngày … tháng … năm …', dinhDanh:[{k,v}] }
 */
DDS.tieuDeKeToan = function (o) {
    o = o || {};
    var dd = (o.dinhDanh || []).filter(function (x) { return x && x.k; });
    return '<div class="pr-kttieu">' +
        '<h1>' + esc(o.tieu) + '</h1>' +
        (o.ngay ? '<div class="ng">' + esc(o.ngay) + '</div>' : '') +
        (dd.length ? '<div class="dd">' + dd.map(function (x) {
            return '<div><span class="k">' + esc(x.k) + ':</span>' +
                   '<span class="v">' + esc(x.v === undefined || x.v === null ? '' : x.v) + '</span></div>';
        }).join('') + '</div>' : '') +
        '</div>';
};

/**
 * Các dòng khai báo của chứng từ kế toán — mỗi dòng là "Nhãn: giá trị" với
 * đường chấm chạy hết bề ngang để người ký điền tay được phần còn trống.
 * ds = [{ k, v, sau, html, dam }] · dòng nào không có giá trị vẫn in để điền tay.
 */
DDS.dongKeToan = function (ds) {
    var d = (ds || []).filter(Boolean);
    if (!d.length) return '';
    return '<div class="pr-ktdong">' + d.map(function (x) {
        var v = x.v === undefined || x.v === null ? '' : x.v;
        return '<div class="r"><span class="k">' + esc(x.k) + ':</span>' +
            '<span class="v' + (x.dam ? ' b' : '') + '">' + (x.html ? v : esc(v)) + '</span>' +
            /* Đơn vị đo đặt SAU đường chấm — "Kèm theo: …… chứng từ gốc" đọc
               đúng như biểu mẫu giấy, và phần còn trống vẫn điền tay được. */
            (x.sau ? '<span class="s">' + esc(x.sau) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
};

/**
 * Khối chữ ký của chứng từ kế toán: dòng địa danh — ngày tháng canh phải ở
 * trên, rồi các ô ký chia đều. Chức danh in hoa đậm, lời dặn ký in nghiêng,
 * chừa đúng một khoảng trống để ký tay.
 * ds = [{ r, d, t, cv, dau, ky }]
 */
DDS.kyKeToan = function (ds, dongNgay) {
    ds = (ds || []).filter(Boolean);
    if (!ds.length) return '';
    return '<div class="pr-ktky">' +
        (dongNgay ? '<div class="ng">' + esc(dongNgay) + '</div>' : '') +
        DDS.ky(ds) + '</div>';
};

/* --------------------------------------------------------- 4.9 CHÂN TRANG */
DDS.chanTrang = function (cty, C, ma) {
    cty = cty || DB.cty();
    C = C || W.__C || {};
    var trai = esc(cty.tat || cty.ten);
    if (co(C, 'hienWebsite') && cty.website) trai += ' &nbsp;·&nbsp; ' + esc(cty.website);
    return '<div class="pr-foot">' +
        '<div>' + trai + '</div>' +
        '<div>' + (ma ? esc(ma) : '') + '</div>' +
        '<div>' + (co(C, 'hienNgayIn') ? 'In ngày ' + T.date(T.today()) : '') + '</div>' +
        '</div>';
};

/* ==========================================================================
   5. THAY BỘ DỰNG CŨ CỦA GIAO DIỆN
   Mọi lối gọi cũ trong hệ thống (UI.prHead / UI.prFoot / UI.prSign) từ nay
   đi qua đúng hệ thống thiết kế này, nên không còn màn hình nào in ra một
   đầu trang hay khối ký khác kiểu.
   ========================================================================== */
/* --------------------------------------------------------------------------
   KHO ẢNH NHÚNG
   Logo, con dấu và chữ ký mẫu của doanh nghiệp có thể là tệp nằm trong thư mục
   cài đặt. Tệp Word và Excel chỉ nhúng được ảnh dạng dữ liệu, nên ngay khi mở
   phần mềm ta chuyển sẵn các ảnh này thành dữ liệu và giữ trong bộ nhớ. Nhờ
   vậy mọi bản xuất ra đều giữ đủ logo và con dấu, không bao giờ mất.
   -------------------------------------------------------------------------- */
W.ANH_DATA = W.ANH_DATA || {};
DDS.napAnh = function () {
    if (!W.DB || !DB.all) return;
    var ds = [];
    try {
        DB.all('donVi').forEach(function (d) {
            [d.logo, d.conDau, d.chuKy].forEach(function (s) {
                if (s && String(s).indexOf('data:') !== 0 && ds.indexOf(s) < 0) ds.push(s);
            });
        });
    } catch (e) { return; }
    ds.forEach(function (src) {
        if (W.ANH_DATA[src]) return;
        var im = new Image();
        im.onload = function () {
            try {
                var to = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight));
                var cv = document.createElement('canvas');
                cv.width = Math.max(1, Math.round(im.naturalWidth * to));
                cv.height = Math.max(1, Math.round(im.naturalHeight * to));
                cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
                W.ANH_DATA[src] = cv.toDataURL('image/png');
            } catch (e) { /* ảnh khác nguồn: bỏ qua, bản in trên màn hình vẫn đủ */ }
        };
        im.src = src;
    });
};
if (W.addEventListener) {
    W.addEventListener('load', function () { setTimeout(DDS.napAnh, 200); });
    setTimeout(DDS.napAnh, 1200);
}

UI.prHead = function (cty, C) { return DDS.dauTrang(cty, C); };
UI.prFoot = function (cty, C, ma) { return DDS.chanTrang(cty, C, ma); };
UI.prSign = function (trai, phai, cty) {
    cty = cty || DB.cty();
    return DDS.ky([
        { r: trai || 'NGƯỜI LẬP BIỂU', d: '(Ký, ghi rõ họ tên)' },
        { r: phai || 'ĐẠI DIỆN ĐƠN VỊ', d: '(Ký, ghi rõ họ tên, đóng dấu)',
          dau: cty.conDau, ky: cty.chuKy }
    ]);
};

})(window);

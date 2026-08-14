/* ==========================================================================
   TVERP — ĐỌC TRỰC TIẾP TỆP BẢNG GIÁ CỦA DOANH NGHIỆP
   Doanh nghiệp KHÔNG phải chuyển đổi sang mẫu Excel của phần mềm. Bộ đọc này
   nhận đúng tệp bảng giá đang dùng: có logo, ô gộp, tiêu đề nhiều dòng, chân
   trang, hình ảnh, thông số kỹ thuật nhiều dòng và nhiều cột giá.
   Hệ thống tự nhận diện vùng dữ liệu rồi đọc: mã hàng · tên hàng · model ·
   đơn vị tính · thông số kỹ thuật · hình ảnh · toàn bộ các cột giá.
   Tên cột giá lấy đúng theo tiêu đề trong tệp, không giới hạn số lượng.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI;

/* ------------------------------------------------- NHẬN DẠNG TÊN CỘT */
/* MÃ HÀNG VÀ MODEL LÀ MỘT. Mọi tên cột dưới đây đều trỏ về CÙNG một trường
   "Mã hàng (Model)". Tệp của doanh nghiệp ghi cột nào cũng đọc được, không phải
   sửa lại tiêu đề, không phải thêm cột Mã hàng riêng. */
/* Tên cột chỉ MODEL của nhà sản xuất — đây chính là Mã hàng, được ưu tiên
   cao nhất khi tệp có nhiều cột mã. */
var MA_MODEL = ['model', 'ma hieu', 'ky hieu', 'mahieu', 'model no', 'model no', 'p n',
                'part no', 'part number', 'item model'];
/* Tên cột mã chung — dùng làm Mã hàng khi tệp không có cột Model. */
var MA_CHUNG = ['ma hang', 'ma hh', 'ma san pham', 'ma sp', 'ma vat tu', 'ma vt', 'ma',
                'code', 'ma so', 'item code', 'sku'];
/* Các cột "mã" KHÔNG phải mã hàng — không được nhận nhầm. */
var MA_LOAI_TRU = ['ma vach', 'ma qr', 'ma so thue', 'ma kh', 'ma khach', 'ma ncc',
                   'ma nhom', 'ma kho', 'ma don vi', 'ma cty', 'ma cong ty'];
var NHAN = {
    stt:     ['stt', 'tt', 'so tt', 'thu tu'],
    ma:      MA_MODEL.concat(MA_CHUNG),
    ten:     ['ten hang', 'ten hang hoa', 'ten san pham', 'ten thiet bi', 'ten vat tu', 'ten',
              'dien giai', 'mo ta', 'noi dung', 'ten goi'],
    ma2:     MA_CHUNG,
    dvt:     ['dvt', 'don vi', 'don vi tinh', 'dv tinh', 'unit'],
    thongSo: ['thong so', 'thong so ky thuat', 'dac tinh ky thuat', 'quy cach', 'quy cach ky thuat',
              'dac tinh', 'tinh nang', 'tskt', 'specification'],
    hinh:    ['hinh anh', 'hinh', 'anh', 'image', 'photo', 'hinh minh hoa'],
    ghiChu:  ['ghi chu', 'note', 'remark', 'chu thich'],
    xuatXu:  ['xuat xu', 'hang san xuat', 'nha san xuat', 'thuong hieu', 'hang', 'origin'],
    nhom:    ['nhom hang', 'nhom', 'chung loai', 'loai']
};
/* Từ khóa nhận biết đây là dòng tiêu đề của bảng. */
var TU_TIEU_DE = ['ma', 'ten', 'dvt', 'don vi', 'gia', 'model', 'thong so', 'quy cach', 'stt',
                  'hinh', 'ghi chu', 'don gia', 'ma hieu'];

function kd(x) { return T.kd(String(x === undefined || x === null ? '' : x)).replace(/\s+/g, ' ').trim(); }
function thuoc(t, ds) {
    var k = kd(t);
    if (!k) return false;
    for (var i = 0; i < ds.length; i++) {
        if (k === ds[i]) return true;
        if (k.indexOf(ds[i]) === 0 && k.length - ds[i].length <= 12) return true;
    }
    return false;
}
/* Cột giá phải chứa TỪ "giá" đứng riêng — "Diễn giải", "Giai đoạn" không phải
   cột giá dù chuỗi không dấu có chứa "gia". */
function laGia(t) {
    var k = kd(t);
    var tu = k.split(' ');
    if (tu.indexOf('gia') >= 0 || tu.indexOf('gia.') >= 0) return true;
    if (k.indexOf('price') >= 0) return true;
    return /(^|\s)gia(\/|\s|$)/.test(k);
}
function laGiaVon(t) {
    var k = kd(t);
    return k.indexOf('gia von') >= 0 || k.indexOf('gia mua') >= 0 || k.indexOf('gia nhap') >= 0;
}
function soDuoc(v) {
    if (typeof v === 'number') return isFinite(v);
    var t = String(v === undefined || v === null ? '' : v).trim();
    if (!t || !/^-?[\d.,\s]+$/.test(t)) return false;
    return !isNaN(T.so(t));
}

/* ==========================================================================
   1. DỰNG LƯỚI Ô — ĐỔ GIÁ TRỊ CỦA Ô GỘP RA TOÀN VÙNG GỘP
   ========================================================================== */
function dungLuoi(ws) {
    var X = W.XLSX;
    var r = X.utils.decode_range(ws['!ref'] || 'A1');
    var soDong = r.e.r - r.s.r + 1, soCot = r.e.c - r.s.c + 1;
    var L = [];
    var i, j;
    for (i = 0; i < soDong; i++) {
        L.push(new Array(soCot));
        for (j = 0; j < soCot; j++) {
            var c = ws[X.utils.encode_cell({ r: r.s.r + i, c: r.s.c + j })];
            L[i][j] = c ? (c.v === undefined ? '' : c.v) : '';
        }
    }
    // Ô gộp: giá trị của ô trái trên được đổ ra toàn bộ vùng gộp
    (ws['!merges'] || []).forEach(function (m) {
        var v = L[m.s.r - r.s.r] ? L[m.s.r - r.s.r][m.s.c - r.s.c] : '';
        if (v === '' || v === undefined) return;
        for (i = m.s.r - r.s.r; i <= m.e.r - r.s.r; i++)
            for (j = m.s.c - r.s.c; j <= m.e.c - r.s.c; j++)
                if (L[i] && (L[i][j] === '' || L[i][j] === undefined)) L[i][j] = v;
    });
    return { L: L, soDong: soDong, soCot: soCot, dongDau: r.s.r, cotDau: r.s.c };
}

/* ==========================================================================
   2. TỰ NHẬN DIỆN VÙNG DỮ LIỆU
   Bỏ qua logo, tiêu đề văn bản, tiêu đề nhiều dòng và chân trang.
   ========================================================================== */
function timTieuDe(L, soDong, soCot) {
    var tot = -1, diem = 0;
    var het = Math.min(soDong, 40);
    for (var i = 0; i < het; i++) {
        var d = 0, oCo = 0;
        for (var j = 0; j < soCot; j++) {
            var t = kd(L[i][j]);
            if (!t) continue;
            oCo++;
            for (var k = 0; k < TU_TIEU_DE.length; k++)
                if (t === TU_TIEU_DE[k] || t.indexOf(TU_TIEU_DE[k]) >= 0) { d++; break; }
        }
        // Dòng tiêu đề: nhiều ô có chữ và phần lớn là từ khóa tiêu đề, không phải số
        var soO = 0;
        for (j = 0; j < soCot; j++) if (soDuoc(L[i][j]) && String(L[i][j]).trim() !== '') soO++;
        if (d >= 2 && oCo >= 3 && soO <= 1 && d > diem) { diem = d; tot = i; }
    }
    return tot;
}
/** Ghép tiêu đề nhiều dòng thành một tên cột cho mỗi cột. */
function ghepTieuDe(L, hdr, soHang, soCot) {
    var i, j;
    // Đếm số cột mà mỗi đoạn chữ xuất hiện — đoạn trùm nhiều cột là TIÊU ĐỀ NHÓM
    // (ví dụ "GIÁ BÁN (VNĐ)" gộp ngang trên các cột giá), không phải tên cột.
    var dem = {};                                     // đoạn chữ → số CỘT mà nó xuất hiện
    for (j = 0; j < soCot; j++) {
        var daCot = {};
        for (i = hdr; i < hdr + soHang; i++) {
            var t0 = String(L[i] && L[i][j] !== undefined ? L[i][j] : '').trim().replace(/\s+/g, ' ');
            if (!t0 || daCot[t0]) continue;
            daCot[t0] = 1;
            dem[t0] = (dem[t0] || 0) + 1;
        }
    }
    var ten = [];
    for (j = 0; j < soCot; j++) {
        var ds = [], het = [];
        for (i = hdr; i < hdr + soHang; i++) {
            var t = String(L[i] && L[i][j] !== undefined ? L[i][j] : '').trim().replace(/\s+/g, ' ');
            if (!t || het.indexOf(t) >= 0) continue;
            het.push(t);
            if (dem[t] > 1) continue;                 // tiêu đề nhóm — bỏ qua
            ds.push(t);
        }
        // Cột chỉ có tiêu đề nhóm (không có tiêu đề con) thì vẫn lấy tiêu đề nhóm
        if (!ds.length && het.length) ds = [het[het.length - 1]];
        ten.push(ds.join(' ').trim());
    }
    return ten;
}
/** Số dòng của khối tiêu đề: tính đến dòng đầu tiên có dữ liệu thật. */
function caoTieuDe(L, hdr, soDong, soCot) {
    for (var i = hdr + 1; i < Math.min(hdr + 5, soDong); i++) {
        var soO = 0, chu = 0;
        for (var j = 0; j < soCot; j++) {
            var v = L[i][j];
            if (v === '' || v === undefined) continue;
            if (soDuoc(v)) soO++; else chu++;
        }
        if (soO >= 1 && chu >= 1) return i - hdr;      // đã là dòng dữ liệu
    }
    return 1;
}

/* ==========================================================================
   3. ĐỌC HÌNH ẢNH NHÚNG TRONG TỆP EXCEL
   Ảnh neo vào dòng nào thì gắn cho mặt hàng ở dòng đó.
   ========================================================================== */
function docAnh(buf) {
    var anh = {};                                    // chỉ số dòng (0-based) → data URL
    try {
        var u8 = (buf instanceof Uint8Array) ? buf : new Uint8Array(buf);
        var z = W.XLSX.CFB.read(u8, { type: 'array' });
        function lay(ten) {
            var f = W.XLSX.CFB.find(z, ten) || W.XLSX.CFB.find(z, '/' + ten) ||
                    W.XLSX.CFB.find(z, ten.replace(/^\//, ''));
            if (!f) {
                // tra thẳng trong danh sách tệp của gói zip
                var goi = z.FullPaths || [], i;
                var can = ten.replace(/^\//, '').toLowerCase();
                for (i = 0; i < goi.length; i++) {
                    var p = String(goi[i]).replace(/^\//, '').toLowerCase();
                    if (p === can || p.slice(-can.length) === can) { f = z.FileIndex[i]; break; }
                }
            }
            return f && f.content ? f.content : null;
        }
        function chuoi(u8) {
            var s = '', i;
            for (i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
            try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
        }
        function b64(u8) {
            var s = '', i;
            for (i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
            return btoa(s);
        }
        var dr = lay('xl/drawings/drawing1.xml');
        if (!dr) return anh;
        var rel = lay('xl/drawings/_rels/drawing1.xml.rels');
        var map = {};
        if (rel) {
            var xr = chuoi(rel);
            // Thuộc tính Id và Target có thể đứng theo thứ tự bất kỳ
            (xr.match(/<Relationship[^>]*>/g) || []).forEach(function (n) {
                var id = /Id="([^"]+)"/.exec(n), tg = /Target="([^"]+)"/.exec(n);
                if (id && tg) map[id[1]] = tg[1].replace(/^\.\.\//, '').replace(/^\//, '');
            });
        }
        var xd = chuoi(dr);
        // Tiền tố không gian tên có thể là xdr:, a: hoặc không có — nhận mọi kiểu
        var kh = xd.split(/<(?:[A-Za-z0-9]+:)?(?:two|one)CellAnchor/);
        kh.forEach(function (k) {
            var mr = /<(?:[A-Za-z0-9]+:)?from>[\s\S]*?<(?:[A-Za-z0-9]+:)?row>(\d+)<\/(?:[A-Za-z0-9]+:)?row>/.exec(k);
            var mi = /r:embed="([^"]+)"/.exec(k);
            if (!mr || !mi) return;
            var tep = map[mi[1]];
            if (!tep) return;
            var noi = lay('xl/' + tep) || lay(tep) ||
                      lay('xl/media/' + tep.split('/').pop());
            if (!noi) return;
            var duoi = (tep.split('.').pop() || 'png').toLowerCase();
            var mime = duoi === 'jpg' || duoi === 'jpeg' ? 'image/jpeg'
                     : duoi === 'gif' ? 'image/gif' : duoi === 'bmp' ? 'image/bmp' : 'image/png';
            anh[Number(mr[1])] = 'data:' + mime + ';base64,' + b64(noi);
        });
    } catch (e) { /* tệp không có ảnh — bỏ qua */ }
    return anh;
}

/* ==========================================================================
   4. ĐỌC TOÀN BỘ TỆP BẢNG GIÁ
   Trả về { cot, cotGia, dong, thongTin } — dong là mảng bản ghi đã chuẩn hóa.
   ========================================================================== */
W.docTepBangGia = function (buf, tenTep) {
    var X = W.XLSX;
    var wb = X.read(new Uint8Array(buf), { type: 'array', cellDates: false });
    // Chọn trang có nhiều dữ liệu nhất
    var ws = null, tenSheet = '', diem = -1;
    wb.SheetNames.forEach(function (n) {
        var s = wb.Sheets[n];
        if (!s || !s['!ref']) return;
        var r = X.utils.decode_range(s['!ref']);
        var d = (r.e.r - r.s.r + 1) * (r.e.c - r.s.c + 1);
        if (d > diem) { diem = d; ws = s; tenSheet = n; }
    });
    if (!ws) throw new Error('Tệp không có dữ liệu');

    var g = dungLuoi(ws);
    var L = g.L, soDong = g.soDong, soCot = g.soCot;
    var hdr = timTieuDe(L, soDong, soCot);
    if (hdr < 0) throw new Error('Không tìm thấy dòng tiêu đề của bảng giá trong tệp');
    var cao = caoTieuDe(L, hdr, soDong, soCot);
    var ten = ghepTieuDe(L, hdr, cao, soCot);

    /* --- phân loại cột --- */
    var C = { stt: -1, ma: -1, ten: -1, ma2: -1, dvt: -1, thongSo: -1, hinh: -1,
              ghiChu: -1, xuatXu: -1, nhom: -1 };
    var cotGia = [];                                  // { j, t } — cột giá theo đúng tiêu đề tệp
    var i, j;

    /* --- 1) Cột MÃ HÀNG (MODEL) được chọn TRƯỚC và ưu tiên theo thứ hạng:
       cột Model đứng trước cột "Mã hàng" chung, bất kể thứ tự cột trong tệp.
       Tệp có cả hai cột thì cột Model là Mã hàng chính, cột còn lại thành
       MÃ KHÁC dùng để đối chiếu — KHÔNG sinh ra hai trường dữ liệu độc lập. */
    var dsMa = [];
    for (j = 0; j < soCot; j++) {
        var tm = ten[j];
        if (!tm) continue;
        if (laGia(tm) && !laGiaVon(tm)) continue;
        if (thuoc(tm, MA_LOAI_TRU)) continue;
        if (thuoc(tm, MA_MODEL)) dsMa.push({ j: j, uu: 0 });
        else if (thuoc(tm, MA_CHUNG)) dsMa.push({ j: j, uu: 1 });
    }
    dsMa.sort(function (a, b) { return a.uu - b.uu || a.j - b.j; });
    if (dsMa.length) C.ma = dsMa[0].j;
    if (dsMa.length > 1) C.ma2 = dsMa[1].j;

    /* --- 2) Các cột còn lại: cột giá và cột thông tin. Thứ tự cột trong tệp
       không ảnh hưởng — mỗi cột tự nhận dạng theo tiêu đề của chính nó. */
    for (j = 0; j < soCot; j++) {
        var t = ten[j];
        if (!t) continue;
        if (j === C.ma || j === C.ma2) continue;
        if (laGia(t) && !laGiaVon(t)) { cotGia.push({ j: j, t: t.replace(/\s+/g, ' ').trim() }); continue; }
        var xong = false;
        Object.keys(C).forEach(function (k) {
            if (xong || C[k] >= 0 || k === 'ma' || k === 'ma2') return;
            if (thuoc(t, NHAN[k])) { C[k] = j; xong = true; }
        });
    }
    /* Cột số chưa được phân loại và nằm sau cột tên → coi là một cột giá */
    if (!cotGia.length) {
        for (j = 0; j < soCot; j++) {
            if (j === C.stt || j === C.ma || j === C.ten || j === C.ma2 || j === C.dvt ||
                j === C.thongSo || j === C.hinh || j === C.ghiChu) continue;
            var so = 0, tong = 0;
            for (i = hdr + cao; i < Math.min(hdr + cao + 30, soDong); i++) {
                var v = L[i][j];
                if (v === '' || v === undefined) continue;
                tong++; if (soDuoc(v) && T.so(v) > 0) so++;
            }
            if (tong >= 2 && so / tong > 0.7)
                cotGia.push({ j: j, t: (ten[j] || ('Giá ' + (cotGia.length + 1))).trim() });
        }
    }
    if (C.ma < 0 && C.ten < 0) throw new Error('Tệp không có cột Mã hàng hoặc Tên hàng');
    if (!cotGia.length) throw new Error('Tệp không có cột giá nào');

    /* Tên cột giá trùng nhau thì thêm số thứ tự cho phân biệt */
    var da = {};
    cotGia.forEach(function (c) {
        var g0 = c.t;
        if (da[kd(g0)]) { c.t = g0 + ' (' + (++da[kd(g0)]) + ')'; } else da[kd(g0)] = 1;
    });

    /* --- ảnh nhúng theo dòng --- */
    var anh = C.hinh >= 0 || true ? docAnh(buf) : {};

    /* Giữ nguyên lưới thô để người dùng ánh xạ lại cột mà không phải đọc lại tệp. */
    var tho = { L: L, hdr: hdr, cao: cao, soDong: soDong, soCot: soCot,
                ten: ten, dongDau: g.dongDau, anh: anh, sheet: tenSheet };
    var kq = {
        tenTep: tenTep || '', sheet: tenSheet, tho: tho,
        anhXa: C, cotGiaJ: cotGia,
        cotGia: cotGia.map(function (c) { return c.t; }),
        coCot: { ma: C.ma >= 0, ten: C.ten >= 0, maPhu: C.ma2 >= 0, dvt: C.dvt >= 0,
                 thongSo: C.thongSo >= 0, hinh: Object.keys(anh).length > 0, ghiChu: C.ghiChu >= 0 },
        soAnh: Object.keys(anh).length,
        dongTieuDe: g.dongDau + hdr + 1, caoTieuDe: cao,
        dong: []
    };
    W.docDongBangGia(kq);
    return kq;
};

/**
 * ĐỌC LẠI CÁC DÒNG THEO ĐÚNG ÁNH XẠ CỘT ĐANG KHAI.
 * Gọi lại được bất cứ lúc nào sau khi người dùng đổi ánh xạ, không phải mở lại
 * tệp. MỘT DÒNG EXCEL LÀ MỘT DÒNG BẢNG GIÁ — chỉ bỏ đúng dòng chân bảng
 * (Tổng cộng · Ghi chú · Người lập) và dòng trống hoàn toàn.
 */
W.docDongBangGia = function (kq) {
    var t = kq.tho, C = kq.anhXa, cotGia = kq.cotGiaJ;
    var L = t.L, i;
    var dong = [];
    for (i = t.hdr + t.cao; i < t.soDong; i++) {
        var ma = C.ma >= 0 ? String(L[i][C.ma] === undefined ? '' : L[i][C.ma]).trim() : '';
        var tn = C.ten >= 0 ? String(L[i][C.ten] === undefined ? '' : L[i][C.ten]).trim() : '';
        if (!ma && !tn) continue;
        var kt = kd(ma + ' ' + tn);
        if (/^(tong|tong cong|cong|ghi chu|nguoi lap|luu y|dieu kien|chu thich|note)/.test(kt)) continue;
        var coGia = false, gia = {};
        cotGia.forEach(function (c) {
            var v = L[i][c.j];
            if (v === '' || v === undefined) return;
            if (!soDuoc(v)) return;
            var n = typeof v === 'number' ? v : T.so(v);
            if (n > 0) { gia[c.t] = Math.round(n); coGia = true; }
        });
        if (!coGia && !ma) continue;                 // dòng nhóm / phân cách
        dong.push({
            ma: ma, ten: tn,
            maPhu: C.ma2 >= 0 ? String(L[i][C.ma2] || '').trim() : '',
            dvt: C.dvt >= 0 ? String(L[i][C.dvt] || '').trim() : '',
            thongSo: C.thongSo >= 0 ? String(L[i][C.thongSo] || '').trim() : '',
            nhom: C.nhom >= 0 ? String(L[i][C.nhom] || '').trim() : '',
            xuatXu: C.xuatXu >= 0 ? String(L[i][C.xuatXu] || '').trim() : '',
            ghiChu: C.ghiChu >= 0 ? String(L[i][C.ghiChu] || '').trim() : '',
            anh: t.anh[t.dongDau + i] || '',
            gia: gia,
            dongExcel: t.dongDau + i + 1
        });
    }
    kq.dong = dong;
    kq.cotGia = cotGia.map(function (c) { return c.t; });
    kq.coCot = { ma: C.ma >= 0, ten: C.ten >= 0, maPhu: C.ma2 >= 0, dvt: C.dvt >= 0,
                 thongSo: C.thongSo >= 0, hinh: kq.soAnh > 0, ghiChu: C.ghiChu >= 0 };
    return kq;
};

/* ==========================================================================
   ÁNH XẠ CỘT LINH HOẠT KHI NHẬP BẢNG GIÁ
   --------------------------------------------------------------------------
   Tệp của doanh nghiệp KHÔNG phải theo mẫu cố định. Hệ thống tự nhận dạng cột,
   rồi mở bảng ánh xạ để người dùng chỉnh lại: cột nào là mã hàng, cột nào là
   tên hàng, cột nào là giá và tên loại giá là gì. Đổi ánh xạ là đọc lại ngay.
   ========================================================================== */
var TRUONG_AX = [
    { k: 'ma', t: 'Mã hàng (Model)', mo: 'Dùng để nhận diện mặt hàng trong danh mục' },
    { k: 'ten', t: 'Tên hàng', mo: 'Nhận diện khi tệp không có cột mã' },
    { k: 'ma2', t: 'Mã khác', mo: 'Mã cũ / mã hãng của cùng mặt hàng' },
    { k: 'dvt', t: 'Đơn vị tính' },
    { k: 'thongSo', t: 'Thông số kỹ thuật' },
    { k: 'nhom', t: 'Nhóm hàng' },
    { k: 'xuatXu', t: 'Hãng · xuất xứ' },
    { k: 'ghiChu', t: 'Ghi chú' }
];
W.anhXaCotBangGia = function (kq, xong) {
    /* Không giữ được lưới thô (dữ liệu đã ánh xạ sẵn từ nguồn khác) thì bỏ qua
       bước ánh xạ, dùng thẳng kết quả đang có. */
    if (!kq || !kq.tho) { xong(kq); return; }
    var t = kq.tho;
    var dsCot = [];
    for (var j = 0; j < t.soCot; j++) {
        var nh = String(t.ten[j] || '').replace(/\s+/g, ' ').trim();
        var vd = '';
        for (var i2 = t.hdr + t.cao; i2 < Math.min(t.hdr + t.cao + 6, t.soDong); i2++) {
            var v = t.L[i2][j];
            if (v !== '' && v !== undefined) { vd = String(v).substr(0, 30); break; }
        }
        dsCot.push({ j: j, ten: nh, viDu: vd, cot: colTen(j) });
    }
    function oChon(cur) {
        return '<option value="-1">— Không dùng —</option>' + dsCot.map(function (c) {
            return '<option value="' + c.j + '"' + (Number(cur) === c.j ? ' selected' : '') + '>' +
                T.esc(c.cot + '. ' + (c.ten || '(không tiêu đề)') +
                      (c.viDu ? '  —  ' + c.viDu : '')) + '</option>';
        }).join('');
    }
    var giaJ = {};
    (kq.cotGiaJ || []).forEach(function (c) { giaJ[c.j] = c.t; });

    UI.modal({
        size: 'full', dismiss: false,
        title: 'Ánh xạ cột của tệp bảng giá — ' + (kq.tenTep || ''),
        sub: 'Tệp không cần theo mẫu cố định. Hệ thống đã tự nhận dạng, anh chỉnh lại nếu chưa đúng.',
        body:
          '<div class="note b mb12"><i class="bi bi-columns-gap"></i><div>' +
          'Trang tính <b>' + T.esc(kq.sheet) + '</b> · dòng tiêu đề <b>' + kq.dongTieuDe + '</b> · ' +
          '<b>' + t.soCot + '</b> cột · <b>' + T.num(kq.dong.length, 0) + '</b> dòng dữ liệu đọc được. ' +
          'Mỗi dòng của tệp sẽ thành <b>đúng một dòng bảng giá</b> — không gộp, không loại bỏ.' +
          '</div></div>' +
          '<div class="grid2">' +
          '<div><div class="card"><div class="card-h"><i class="bi bi-tag"></i> Cột thông tin</div>' +
          '<div class="card-b">' + TRUONG_AX.map(function (f) {
              return '<div class="fld"><label>' + T.esc(f.t) + '</label>' +
                  '<select data-ax="' + f.k + '">' + oChon(kq.anhXa[f.k]) + '</select>' +
                  (f.mo ? '<div class="small muted">' + T.esc(f.mo) + '</div>' : '') + '</div>';
          }).join('') + '</div></div></div>' +
          '<div><div class="card"><div class="card-h"><i class="bi bi-cash-stack"></i> Cột giá' +
          '<span class="spacer"></span><span class="small muted">Tích cột nào là cột giá và đặt tên loại giá</span>' +
          '</div><div class="card-b"><div class="tbl-wrap" style="max-height:420px">' +
          '<table class="tbl"><thead><tr><th style="width:44px" class="ctr">Dùng</th>' +
          '<th style="width:150px">Cột trong tệp</th><th>Tên loại giá trong TVERP</th>' +
          '<th style="width:140px">Dữ liệu mẫu</th></tr></thead><tbody>' +
          dsCot.map(function (c) {
              return '<tr><td class="ctr"><input type="checkbox" data-gj="' + c.j + '"' +
                  (giaJ[c.j] !== undefined ? ' checked' : '') + '></td>' +
                  '<td class="mono small">' + T.esc(c.cot + '. ' + (c.ten || '(không tiêu đề)')) + '</td>' +
                  '<td><input data-gt="' + c.j + '" value="' +
                      T.esc(giaJ[c.j] !== undefined ? giaJ[c.j] : (c.ten || '')) + '"></td>' +
                  '<td class="small muted">' + T.esc(c.viDu) + '</td></tr>';
          }).join('') + '</tbody></table></div></div></div></div>' +
          '</div>' +
          '<div id="axXem" class="mt12"></div>',
        buttons: [
            { text: 'Hủy', icon: 'bi-x-lg', click: function (h) { h.close(); } },
            { text: 'Xem lại theo ánh xạ', icon: 'bi-arrow-repeat', click: function (h) { doc(h); } },
            { text: 'Dùng ánh xạ này', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                if (!doc(h)) return;
                h.close(); xong(kq);
            } }
        ],
        onOpen: function (h) { xem(h); }
    });

    function doc(h) {
        var C = {};
        Object.keys(kq.anhXa).forEach(function (k) { C[k] = -1; });
        TRUONG_AX.forEach(function (f) {
            var e = h.q('[data-ax="' + f.k + '"]');
            C[f.k] = e ? Number(e.value) : -1;
        });
        var cg = [];
        h.el.querySelectorAll('[data-gj]').forEach(function (c) {
            if (!c.checked) return;
            var j2 = Number(c.getAttribute('data-gj'));
            var ten = String((h.q('[data-gt="' + j2 + '"]') || {}).value || '').trim() ||
                      ('Giá ' + (cg.length + 1));
            cg.push({ j: j2, t: ten });
        });
        if (C.ma < 0 && C.ten < 0) {
            UI.toast('err', 'Chưa chọn cột nhận diện',
                'Phải chọn ít nhất một trong hai: Mã hàng (Model) hoặc Tên hàng.');
            return false;
        }
        if (!cg.length) {
            UI.toast('err', 'Chưa chọn cột giá nào', 'Tích ít nhất một cột làm cột giá.');
            return false;
        }
        var da = {};
        cg.forEach(function (c) {
            if (da[kd(c.t)]) c.t = c.t + ' (' + (++da[kd(c.t)]) + ')'; else da[kd(c.t)] = 1;
        });
        kq.anhXa = C; kq.cotGiaJ = cg;
        W.docDongBangGia(kq);
        xem(h);
        return true;
    }
    function xem(h) {
        var ds = kq.dong.slice(0, 8);
        h.q('#axXem').innerHTML =
            '<div class="card"><div class="card-h"><i class="bi bi-eye"></i> Xem trước ' +
            T.num(kq.dong.length, 0) + ' dòng đọc được (hiện 8 dòng đầu)</div><div class="card-b">' +
            (ds.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
            '<th style="width:60px" class="ctr">Dòng</th><th style="width:150px">Mã hàng</th>' +
            '<th>Tên hàng</th><th style="width:70px">ĐVT</th>' +
            kq.cotGia.map(function (c) { return '<th style="width:120px" class="num">' + T.esc(c) + '</th>'; }).join('') +
            '</tr></thead><tbody>' + ds.map(function (d) {
                return '<tr><td class="ctr muted">' + d.dongExcel + '</td>' +
                    '<td class="mono">' + T.esc(d.ma) + '</td><td>' + T.esc(d.ten) + '</td>' +
                    '<td>' + T.esc(d.dvt) + '</td>' +
                    kq.cotGia.map(function (c) {
                        return '<td class="num">' + (d.gia[c] ? T.money(d.gia[c]) : '') + '</td>';
                    }).join('') + '</tr>';
            }).join('') + '</tbody></table></div>'
            : '<div class="trong">Ánh xạ hiện tại không đọc được dòng nào.</div>') +
            '</div></div>';
    }
};
function colTen(i) {
    var s2 = '';
    i++;
    while (i > 0) { var r = (i - 1) % 26; s2 = String.fromCharCode(65 + r) + s2; i = Math.floor((i - 1) / 26); }
    return s2;
}

/** Chọn tệp bảng giá của doanh nghiệp rồi đọc trực tiếp. */
W.chonTepBangGia = function (xong, loi) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx,.xlsm,.xls';
    inp.onchange = function () {
        var f = inp.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function (e) {
            try { xong(W.docTepBangGia(e.target.result, f.name), f.name); }
            catch (err) {
                if (loi) loi(err);
                else UI.toast('err', 'Không đọc được tệp bảng giá', String(err.message || err), 7000);
            }
        };
        fr.readAsArrayBuffer(f);
    };
    inp.click();
};

/* ==========================================================================
   4B. IMPORT KHÔNG CẦN CẤU HÌNH (ZERO CONFIGURATION)
   --------------------------------------------------------------------------
   Người dùng chỉ: chọn tệp → xem trước → nhập. Hệ thống tự đọc, tự nhận diện
   cột, tự nhớ cấu trúc tệp của từng nhà cung cấp. Bảng ánh xạ CHỈ hiện khi còn
   cột chưa xác định được — và cũng chỉ hỏi đúng những cột đó.
   ========================================================================== */

/** Chọn tệp và giữ luôn bản gốc để lưu vào kho dữ liệu. */
W.chonTepBangGiaKemGoc = function (xong, loi) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx,.xlsm,.xls';
    inp.onchange = function () {
        var f = inp.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function (e) {
            var buf = e.target.result;
            var kq;
            try { kq = W.docTepBangGia(buf, f.name); }
            catch (err) {
                if (loi) loi(err);
                else UI.toast('err', 'Không đọc được tệp bảng giá', String(err.message || err), 7000);
                return;
            }
            kq.goc = { ten: f.name, mime: f.type || '', kichThuoc: f.size,
                       duLieu: f.size <= T.CO_TEP_GOC ? W.bufSangBase64(buf) : '',
                       quaLon: f.size > T.CO_TEP_GOC };
            xong(kq, f.name);
        };
        fr.readAsArrayBuffer(f);
    };
    inp.click();
};

/** Chuyển nội dung nhị phân của tệp sang chuỗi base64 để lưu trong kho dữ liệu. */
W.bufSangBase64 = function (buf) {
    var u = new Uint8Array(buf), s2 = '', i, n = u.length, B = 0x8000;
    for (i = 0; i < n; i += B) s2 += String.fromCharCode.apply(null, u.subarray(i, i + B));
    return btoa(s2);
};

/**
 * ÁP HỒ SƠ CẤU TRÚC ĐÃ GHI NHỚ.
 * Tệp của cùng một nhà cung cấp lần sau được nhận diện y như lần trước, kể cả
 * khi bộ tự nhận dạng và người dùng từng chỉnh khác nhau.
 */
W.apMauCauTruc = function (kq) {
    var chuKy = T.chuKyCauTruc((kq.tho || {}).ten || []);
    kq.chuKy = chuKy;
    var m = T.mauCauTruc(chuKy, kq.nhaCungCap);
    if (!m || m.chuKy !== chuKy) return null;      // chỉ áp khi ĐÚNG cấu trúc tệp
    var C = {};
    Object.keys(kq.anhXa).forEach(function (k) { C[k] = -1; });
    Object.keys(m.anhXa || {}).forEach(function (k) { C[k] = Number(m.anhXa[k]); });
    kq.anhXa = C;
    kq.cotGiaJ = (m.cotGiaJ || []).map(function (c) { return { j: Number(c.j), t: c.t }; });
    W.docDongBangGia(kq);
    kq.theoMau = m;
    return m;
};

/**
 * CHẤM ĐIỂM NHẬN DIỆN.
 * Trả về { du, thieu[], laCot[], soCotLa } — "du" là đã nhận diện đủ để nhập
 * thẳng, không cần hỏi người dùng câu nào.
 */
W.chamNhanDien = function (kq) {
    var t = kq.tho || {}, C = kq.anhXa || {};
    var dung = {};
    Object.keys(C).forEach(function (k) { if (C[k] >= 0) dung[C[k]] = k; });
    (kq.cotGiaJ || []).forEach(function (c) { dung[c.j] = 'gia'; });

    var la = [], thieu = [];
    for (var j = 0; j < (t.soCot || 0); j++) {
        if (dung[j] !== undefined) continue;
        var nh = String((t.ten || [])[j] || '').replace(/\s+/g, ' ').trim();
        var coDuLieu = false, soO = 0, oSo = 0;
        for (var i = t.hdr + t.cao; i < Math.min(t.hdr + t.cao + 40, t.soDong); i++) {
            var v = t.L[i][j];
            if (v === '' || v === undefined || v === null) continue;
            coDuLieu = true; soO++;
            if (typeof v === 'number' || /^[\d.,\s]+$/.test(String(v))) oSo++;
        }
        if (!coDuLieu) continue;                    // cột rỗng — không phải hỏi
        if (!nh) continue;                          // không có tiêu đề, không có gì để hỏi
        la.push({ j: j, ten: nh, cot: colTen(j), laSo: soO > 0 && oSo / soO > 0.7,
                  viDu: viDuCot(t, j) });
    }
    if (C.ma < 0 && C.ten < 0) thieu.push('Mã hàng hoặc Tên hàng');
    if (!(kq.cotGiaJ || []).length) thieu.push('Cột giá');
    return { du: !thieu.length && !la.length, thieu: thieu, laCot: la, soCotLa: la.length };
};

function viDuCot(t, j) {
    for (var i = t.hdr + t.cao; i < Math.min(t.hdr + t.cao + 8, t.soDong); i++) {
        var v = t.L[i][j];
        if (v !== '' && v !== undefined && v !== null) return String(v).substr(0, 40);
    }
    return '';
}
W.viDuCotBangGia = viDuCot;
W.tenCotExcel = colTen;

/* ==========================================================================
   BỘ ĐỌC BẢNG TÍNH DÙNG CHUNG
   Trả về LƯỚI THÔ của tệp Excel kèm dòng tiêu đề đã tự tìm được. Mọi module
   cần đọc tệp của doanh nghiệp (bảng giá, nhập hàng…) dùng chung bộ này nên
   hành vi nhận diện là NHƯ NHAU, không có hai cách hiểu khác nhau.
   Trả về { L, soDong, soCot, hdr, cao, ten[], tenSheet }.
   ========================================================================== */
W.luoiTuTep = function (buf) {
    var X = W.XLSX;
    var wb = X.read(new Uint8Array(buf), { type: 'array', cellDates: false });
    var ws = null, tenSheet = '', diem = -1;
    wb.SheetNames.forEach(function (n) {
        var s = wb.Sheets[n];
        if (!s || !s['!ref']) return;
        var r = X.utils.decode_range(s['!ref']);
        var d = (r.e.r - r.s.r + 1) * (r.e.c - r.s.c + 1);
        if (d > diem) { diem = d; ws = s; tenSheet = n; }
    });
    if (!ws) throw new Error('Tệp không có dữ liệu');
    var g = dungLuoi(ws);
    var hdr = timTieuDe(g.L, g.soDong, g.soCot);
    var cao = hdr >= 0 ? caoTieuDe(g.L, hdr, g.soDong, g.soCot) : 0;
    var ten = hdr >= 0 ? ghepTieuDe(g.L, hdr, cao, g.soCot) : [];
    return { L: g.L, soDong: g.soDong, soCot: g.soCot, hdr: hdr, cao: cao,
             ten: ten, tenSheet: tenSheet,
             /* Vị trí thật của lưới trong tệp — để báo đúng SỐ DÒNG và TÊN CỘT
                của Excel cho người dùng khi bảng không bắt đầu từ ô A1. */
             dongDau: g.dongDau, cotDau: g.cotDau };
};
/** Chuẩn hóa một chuỗi để so khớp tiêu đề — dùng chung toàn hệ thống. */
W.kdTieuDe = kd;
/** Giá trị của ô có đọc được thành số hay không. */
W.oLaSo = soDuoc;

/** Đoán nhà cung cấp / hãng từ nội dung tệp và tên tệp. */
W.doanNhaCungCap = function (kq, tenTep) {
    var t = kq.tho || {};
    /* 1) Tên hãng thường nằm ở dòng đầu của tệp báo giá. */
    var dsNCC = DB.all('nhaCungCap').map(function (n) { return n.ten; })
        .concat(T.dsNhaCungCapGia())
        .concat(DB.all('hangSX').map(function (h) { return h.ten; }));
    var i, j, k;
    for (i = 0; i < Math.min(t.hdr === undefined ? 6 : t.hdr, 8); i++) {
        for (j = 0; j < (t.soCot || 0); j++) {
            var v = String((t.L[i] || [])[j] || '').trim();
            if (!v) continue;
            for (k = 0; k < dsNCC.length; k++) {
                if (dsNCC[k] && T.kd(v).indexOf(T.kd(dsNCC[k])) >= 0) return dsNCC[k];
            }
        }
    }
    /* 2) Tên tệp: BangGia_Sanjiang_2026Q2.xlsx */
    var tn = T.kd(String(tenTep || ''));
    for (k = 0; k < dsNCC.length; k++) {
        if (dsNCC[k] && tn.indexOf(T.kd(dsNCC[k])) >= 0) return dsNCC[k];
    }
    /* 3) Hồ sơ cấu trúc đã ghi nhớ. */
    var m = T.mauCauTruc(T.chuKyCauTruc(t.ten || []), '');
    return (m && m.nhaCungCap) || '';
};

/* ==========================================================================
   5. CHÍNH SÁCH GIÁ THEO ĐƠN VỊ PHÁT HÀNH
   Quản trị tự cấu hình, đổi lúc nào cũng được, không phải sửa chương trình.
   ========================================================================== */
var LAM_TRON = [
    { v: '0', t: 'Không làm tròn' }, { v: '100', t: 'Đến 100 đ' },
    { v: '1000', t: 'Đến 1.000 đ' }, { v: '10000', t: 'Đến 10.000 đ' },
    { v: '100000', t: 'Đến 100.000 đ' }
];
W.chinhSachGiaDonVi = function (xong) {
    if (!W.Q.co('bangGiaBan', 'sua')) return UI.thieuQuyen('bangGiaBan', 'sua');
    var dvs = DB.all('donVi');
    /* Loại giá lấy từ DANH MỤC LOẠI GIÁ do doanh nghiệp tự khai, cộng thêm mọi
       loại giá đang có trên các phiên bản bảng giá — không cắm cứng danh sách. */
    var ds = {};
    T.tenLoaiGia().forEach(function (c) { ds[c] = 1; });
    DB.all('bangGiaBan').forEach(function (b) {
        (b.cotGia || []).forEach(function (c) { ds[c] = 1; });
    });
    var loaiGia = Object.keys(ds);

    UI.modal({
        size: 'xl', dismiss: false,
        title: 'Chính sách giá theo đơn vị phát hành',
        sub: 'Mỗi công ty tự chọn cột giá, mức chiết khấu mặc định và quy tắc làm tròn — ' +
             'đổi lúc nào cũng được, không phải sửa chương trình',
        body:
            '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
            'Khi lập <b>Báo giá · Đơn bán hàng · Hợp đồng</b>, sau khi chọn đơn vị phát hành hệ thống tự lấy ' +
            'phiên bản bảng giá đang có hiệu lực, lấy đúng <b>cột giá</b> theo cấu hình dưới đây, áp ' +
            '<b>chiết khấu mặc định</b> rồi <b>làm tròn</b> để ra đơn giá bán.<br>' +
            'Người dùng vẫn sửa được đơn giá ngay trên chứng từ; sửa trên chứng từ <b>không</b> làm thay đổi ' +
            'bảng giá và <b>không</b> làm thay đổi cấu hình này.</div></div>' +
            '<div class="tablewrap"><table class="grid"><thead><tr>' +
            '<th style="width:70px">Mã</th><th>Đơn vị phát hành</th>' +
            '<th style="width:230px">Cột giá mặc định</th>' +
            '<th style="width:150px">Chiết khấu mặc định</th>' +
            '<th style="width:96px">Loại</th>' +
            '<th style="width:180px">Làm tròn</th>' +
            '<th style="width:150px">Cách làm tròn</th></tr></thead><tbody>' +
            dvs.map(function (d) {
                var c = T.chinhSachGia(d.id);
                return '<tr><td class="mono">' + T.esc(d.tat || '') + '</td>' +
                    '<td><span class="ellip">' + T.esc(d.ten) + '</span></td>' +
                    '<td><select data-cs="cotGia" data-dv="' + d.id + '">' +
                        '<option value="">Cột mặc định của bảng giá</option>' +
                        loaiGia.map(function (x) {
                            return '<option' + (x === c.cotGia ? ' selected' : '') + '>' + T.esc(x) + '</option>';
                        }).join('') + '</select></td>' +
                    '<td><input class="num" data-cs="ckMuc" data-dv="' + d.id + '" value="' +
                        T.esc(T.soVe(c.ckMuc)) + '"></td>' +
                    '<td><select data-cs="ckLoai" data-dv="' + d.id + '">' +
                        '<option value="%"' + (c.ckLoai !== 'đ' ? ' selected' : '') + '>%</option>' +
                        '<option value="đ"' + (c.ckLoai === 'đ' ? ' selected' : '') + '>đ</option>' +
                        '</select></td>' +
                    '<td><select data-cs="lamTron" data-dv="' + d.id + '">' +
                        LAM_TRON.map(function (x) {
                            return '<option value="' + x.v + '"' +
                                (String(c.lamTron) === x.v ? ' selected' : '') + '>' + x.t + '</option>';
                        }).join('') + '</select></td>' +
                    '<td><select data-cs="cachTron" data-dv="' + d.id + '">' +
                        ['gan', 'len', 'xuong'].map(function (x) {
                            var n = x === 'gan' ? 'Gần nhất' : x === 'len' ? 'Làm tròn lên' : 'Làm tròn xuống';
                            return '<option value="' + x + '"' + (c.cachTron === x ? ' selected' : '') +
                                '>' + n + '</option>';
                        }).join('') + '</select></td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<div id="csThu" class="mt12"></div>',
        buttons: [
            { text: 'Đóng', click: function (h) { h.close(); } },
            { text: 'Lưu chính sách giá', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                var m = {};
                h.el.querySelectorAll('[data-cs]').forEach(function (e) {
                    var id = e.getAttribute('data-dv'), k = e.getAttribute('data-cs');
                    m[id] = m[id] || {};
                    m[id][k] = k === 'ckMuc' ? T.so(e.value) : e.value;
                });
                Object.keys(m).forEach(function (id) {
                    var d = DB.get('donVi', id); if (!d) return;
                    d.chinhSachGia = {
                        cotGia: m[id].cotGia || '', ckLoai: m[id].ckLoai === 'đ' ? 'đ' : '%',
                        ckMuc: Number(m[id].ckMuc) || 0, lamTron: Number(m[id].lamTron) || 0,
                        cachTron: m[id].cachTron || 'gan'
                    };
                    DB.log('Cập nhật', 'donVi', d);
                });
                DB.save(); h.close();
                if (xong) xong();
                UI.toast('ok', 'Đã lưu chính sách giá',
                    'Áp dụng ngay cho các chứng từ lập sau. Chứng từ đã lưu giữ nguyên đơn giá cũ.', 6000);
            } }
        ],
        onOpen: function (h) {
            UI.numInput(h.el);
            function thu() {
                var ma = (DB.all('hangHoa')[0] || {}).ma || '';
                h.q('#csThu').innerHTML = '<div class="card"><div class="card-h">' +
                    '<i class="bi bi-calculator"></i> Thử nghiệm nhanh trên mã hàng ' + T.esc(ma) + '</div>' +
                    '<div class="tablewrap" style="border:none"><table class="grid"><thead><tr>' +
                    '<th>Đơn vị phát hành</th><th>Bảng giá áp dụng</th><th>Cột giá</th>' +
                    '<th class="num">Giá gốc</th><th class="num">Chiết khấu</th>' +
                    '<th class="num">Đơn giá bán</th></tr></thead><tbody>' +
                    dvs.map(function (d) {
                        var b = T.bangGiaMacDinh(d.id, '', T.today());
                        if (!b) return '<tr><td>' + T.esc(d.tat) + '</td>' +
                            '<td colspan="5" class="muted">Chưa có bảng giá đang hiệu lực</td></tr>';
                        var r = T.donGiaChungTu(ma, b.id, d.id, T.today());
                        return '<tr><td>' + T.esc(d.tat) + '</td><td>' + T.esc(b.ten) + '</td>' +
                            '<td>' + T.esc(r.cot || '—') + '</td>' +
                            '<td class="num">' + T.money(r.goc) + '</td>' +
                            '<td class="num">' + (r.ck ? T.soVe(r.ck) + ' ' + r.ckLoai : '—') + '</td>' +
                            '<td class="num b">' + T.money(r.gia) + '</td></tr>';
                    }).join('') + '</tbody></table></div></div>';
            }
            thu();
        }
    });
};

/* ==========================================================================
   6. SO SÁNH HAI PHIÊN BẢN BẢNG GIÁ
   ========================================================================== */
W.soSanhBangGia = function (bDau) {
    var ds = DB.all('bangGiaBan');
    if (ds.length < 2) return UI.toast('warn', 'Cần ít nhất hai bảng giá để so sánh');
    var idCu = (bDau && ds.filter(function (x) { return x.id !== bDau.id; })[0] || ds[1]).id;
    var idMoi = (bDau || ds[0]).id;

    UI.modal({
        size: 'full', dismiss: false,
        title: 'So sánh hai phiên bản bảng giá',
        sub: 'Xem nhanh mặt hàng nào đổi giá sau mỗi lần cập nhật bảng giá',
        body:
            '<div class="row mb12" style="align-items:flex-end;gap:12px;flex-wrap:wrap">' +
            '<div class="fld" style="min-width:280px"><label>Phiên bản cũ</label>' +
            '<select id="ssCu">' + ds.map(function (b) {
                return '<option value="' + b.id + '"' + (b.id === idCu ? ' selected' : '') + '>' +
                    T.esc(nhanBG(b)) + '</option>'; }).join('') + '</select></div>' +
            '<div class="fld" style="min-width:280px"><label>Phiên bản mới</label>' +
            '<select id="ssMoi">' + ds.map(function (b) {
                return '<option value="' + b.id + '"' + (b.id === idMoi ? ' selected' : '') + '>' +
                    T.esc(nhanBG(b)) + '</option>'; }).join('') + '</select></div>' +
            '<div class="fld" style="min-width:200px"><label>Loại giá so sánh</label>' +
            '<select id="ssCot"></select></div>' +
            '<div class="fld" style="min-width:180px"><label>Hiển thị</label>' +
            '<select id="ssLoc">' +
            '<option value="doi">Chỉ mặt hàng đổi giá</option>' +
            '<option value="tat">Tất cả mặt hàng</option>' +
            '<option value="tang">Chỉ mặt hàng tăng giá</option>' +
            '<option value="giam">Chỉ mặt hàng giảm giá</option>' +
            '<option value="moi">Chỉ mặt hàng mới có giá</option>' +
            '</select></div>' +
            '<div class="fld" style="flex:1;min-width:220px"><label>Tìm mã hoặc tên hàng</label>' +
            '<input type="search" id="ssTim" placeholder="Gõ để lọc…"></div>' +
            '</div>' +
            '<div id="ssKpi"></div><div id="ssBang"></div>',
        buttons: [
            { text: 'Đóng', click: function (h) { h.close(); } },
            { text: 'Xuất báo cáo so sánh', cls: 'primary', icon: 'bi-file-earmark-bar-graph',
              click: function (h) { h.__in(); } }
        ],
        onOpen: function (h) {
            function veCot() {
                var a = DB.get('bangGiaBan', h.q('#ssCu').value) || {};
                var b = DB.get('bangGiaBan', h.q('#ssMoi').value) || {};
                var ds2 = {};
                (a.cotGia || []).forEach(function (c) { ds2[c] = 1; });
                (b.cotGia || []).forEach(function (c) { ds2[c] = 1; });
                var ks = Object.keys(ds2);
                var cu = h.q('#ssCot').value;
                h.q('#ssCot').innerHTML = ks.map(function (c) {
                    return '<option' + (c === cu ? ' selected' : '') + '>' + T.esc(c) + '</option>';
                }).join('');
            }
            function ve() {
                var a = DB.get('bangGiaBan', h.q('#ssCu').value);
                var b = DB.get('bangGiaBan', h.q('#ssMoi').value);
                var cot = h.q('#ssCot').value;
                var loc = h.q('#ssLoc').value;
                var tim = T.kd(h.q('#ssTim').value || '');
                var rows = W.duLieuSoSanh(a, b, cot).filter(function (r) {
                    if (tim && T.kd(r.ma).indexOf(tim) < 0 && T.kd(r.ten).indexOf(tim) < 0) return false;
                    if (loc === 'doi') return r.chenh !== 0;
                    if (loc === 'tang') return r.chenh > 0;
                    if (loc === 'giam') return r.chenh < 0;
                    if (loc === 'moi') return r.cu === 0 && r.moi > 0;
                    return true;
                });
                var tang = rows.filter(function (r) { return r.chenh > 0; }).length;
                var giam = rows.filter(function (r) { return r.chenh < 0; }).length;
                var moi = rows.filter(function (r) { return r.cu === 0 && r.moi > 0; }).length;
                var bo = rows.filter(function (r) { return r.cu > 0 && r.moi === 0; }).length;
                h.q('#ssKpi').innerHTML = '<div class="grid4 mb12">' +
                    the('Số mặt hàng hiển thị', T.num(rows.length, 0), '') +
                    the('Tăng giá', T.num(tang, 0), tang ? 'r' : '') +
                    the('Giảm giá', T.num(giam, 0), giam ? 'g' : '') +
                    the('Mới có giá / bỏ giá', T.num(moi, 0) + ' / ' + T.num(bo, 0), 'y') +
                    '</div>';
                h.q('#ssBang').innerHTML = '<div class="tablewrap" style="max-height:calc(100vh - 400px)">' +
                    '<table class="grid"><thead><tr><th style="width:44px">TT</th>' +
                    '<th style="width:160px">Mã hàng</th><th>Tên hàng</th>' +
                    '<th style="width:62px" class="ctr">ĐVT</th>' +
                    '<th class="num" style="width:130px">Giá cũ</th>' +
                    '<th class="num" style="width:130px">Giá mới</th>' +
                    '<th class="num" style="width:130px">Chênh lệch</th>' +
                    '<th class="num" style="width:110px">Tỷ lệ</th>' +
                    '<th style="width:120px">Tình trạng</th></tr></thead><tbody>' +
                    (rows.length ? rows.map(function (r, i) {
                        return '<tr><td class="ctr muted">' + (i + 1) + '</td>' +
                            '<td class="mono">' + T.esc(r.ma) + '</td>' +
                            '<td><span class="ellip">' + T.esc(r.ten) + '</span>' +
                                (r.ngungLienKet ? ' <span class="pill y" title="Mặt hàng đã bị xóa khỏi danh mục — dòng giá vẫn được giữ trong lịch sử">không còn hiệu lực</span>' : '') + '</td>' +
                            '<td class="ctr">' + T.esc(r.dvt) + '</td>' +
                            '<td class="num">' + (r.cu ? T.money(r.cu) : '—') + '</td>' +
                            '<td class="num">' + (r.moi ? T.money(r.moi) : '—') + '</td>' +
                            '<td class="num ' + (r.chenh > 0 ? 'neg' : r.chenh < 0 ? 'pos' : 'muted') + '">' +
                                (r.chenh ? (r.chenh > 0 ? '+' : '') + T.money(r.chenh) : '—') + '</td>' +
                            '<td class="num ' + (r.chenh > 0 ? 'neg' : r.chenh < 0 ? 'pos' : 'muted') + '">' +
                                (r.tyLe === null ? '—' : (r.tyLe > 0 ? '+' : '') + T.num(r.tyLe, 1) + '%') + '</td>' +
                            '<td>' + pillTT(r) + '</td></tr>';
                    }).join('')
                    : '<tr><td colspan="9"><div class="empty" style="padding:28px">' +
                      '<i class="bi bi-check2-circle"></i><b>Không có mặt hàng nào khớp điều kiện</b>' +
                      'Đổi bộ lọc hoặc chọn phiên bản khác.</div></td></tr>') +
                    '</tbody></table></div>';
                h.__in = function () {
                    W.inBaoCao({
                        tieu: 'BÁO CÁO SO SÁNH PHIÊN BẢN BẢNG GIÁ',
                        phu: nhanBG(a) + '  →  ' + nhanBG(b),
                        thoiDiem: T.today(),
                        dieuKien: [
                            { t: 'Phiên bản cũ', v: nhanBG(a) },
                            { t: 'Phiên bản mới', v: nhanBG(b) },
                            { t: 'Loại giá so sánh', v: cot },
                            { t: 'Điều kiện hiển thị', v: h.q('#ssLoc').options[h.q('#ssLoc').selectedIndex].textContent },
                            { t: 'Tăng giá / Giảm giá', v: T.num(tang, 0) + ' / ' + T.num(giam, 0) }
                        ],
                        cols: [
                            { t: 'Mã hàng', k: 'ma', w: 28 }, { t: 'Tên hàng', k: 'ten', w: 66 },
                            { t: 'ĐVT', k: 'dvt', w: 12, cls: 'c' },
                            { t: 'Giá cũ', k: 'cu', w: 24, tong: true },
                            { t: 'Giá mới', k: 'moi', w: 24, tong: true },
                            { t: 'Chênh lệch', k: 'chenh', w: 24, tong: true },
                            { t: 'Tỷ lệ', k: 'tyLe', w: 18,
                              r: function (v) { return v === null ? '—' : (v > 0 ? '+' : '') + T.num(v, 1) + '%'; } },
                            { t: 'Tình trạng', k: 'tt', w: 22 }
                        ],
                        rows: rows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'GIÁM ĐỐC'
                    });
                };
            }
            h.q('#ssCu').onchange = function () { veCot(); ve(); };
            h.q('#ssMoi').onchange = function () { veCot(); ve(); };
            h.q('#ssCot').onchange = ve;
            h.q('#ssLoc').onchange = ve;
            h.q('#ssTim').oninput = ve;
            veCot(); ve();
        }
    });

    function the(l, v, c) {
        return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div><div class="vl">' + v + '</div></div>';
    }
    function pillTT(r) {
        if (r.cu === 0 && r.moi > 0) return '<span class="pill b">Mới có giá</span>';
        if (r.cu > 0 && r.moi === 0) return '<span class="pill n">Bỏ giá</span>';
        if (r.chenh > 0) return '<span class="pill r">Tăng giá</span>';
        if (r.chenh < 0) return '<span class="pill g">Giảm giá</span>';
        return '<span class="pill n">Giữ nguyên</span>';
    }
};
function nhanBG(b) {
    if (!b) return '';
    return b.ma + ' — ' + b.ten + (b.phienBan ? ' (phiên bản ' + b.phienBan + ')' : '') +
        ' · hiệu lực ' + T.date(b.tuNgay);
}
W.nhanBangGia = nhanBG;

/** Dữ liệu so sánh hai bảng giá theo một loại giá. */
W.duLieuSoSanh = function (a, b, cot) {
    if (!a || !b) return [];
    /* SO SÁNH TRÊN MẢNG DÒNG GỐC — đối chiếu bằng ID NỘI BỘ khi dòng đã liên kết
       danh mục, và bằng Mã hàng của tệp khi dòng chưa liên kết. Nhờ vậy so sánh
       được cả những phiên bản mà mặt hàng chưa kịp khai vào Danh mục Hàng hóa. */
    function gom(b2) {
        var m = {};
        T.dongBangGia(b2).forEach(function (d) {
            /* Dòng chưa liên kết vẫn quy về ID nội bộ nếu mã tra ra được — nhờ vậy
               một mặt hàng không bị đếm thành hai dòng khi phiên bản này đã nối
               danh mục còn phiên bản kia thì chưa. */
            var k = d.hangHoaId || T.idHH(d.ma || '') ||
                    ('#' + (T.kd(d.ma || '') || T.kd(d.ten || '') || 'khong-ma'));
            if (!m[k]) m[k] = { k: k, hangHoaId: d.hangHoaId || (k.charAt(0) === '#' ? '' : k),
                                ma: d.ma || '', ten: d.ten || '', dvt: d.dvt || '',
                                thongSo: d.thongSo || '', gia: 0 };
            var g = Number((d.gia || {})[cot]) || 0;
            /* Cùng quy tắc với chỉ mục tra giá: DÒNG ĐẦU GIỮ GIÁ — so sánh phiên
               bản và đơn giá trên chứng từ luôn nói cùng một con số. */
            if (g > 0 && !(m[k].gia > 0)) m[k].gia = g;
            if (!m[k].ten && d.ten) m[k].ten = d.ten;
        });
        return m;
    }
    var A = gom(a), B = gom(b), khoa = {};
    Object.keys(A).forEach(function (k) { khoa[k] = 1; });
    Object.keys(B).forEach(function (k) { khoa[k] = 1; });
    return Object.keys(khoa).map(function (k) {
        var x = B[k] || A[k] || {};
        /* Mặt hàng đã bị xóa khỏi danh mục vẫn đọc được tên từ bản chụp lưu lúc
           ngừng liên kết — lịch sử giá không bao giờ bị mất. */
        var hh = (x.hangHoaId && (T.hhTuBangGia(b, x.hangHoaId) || T.hhTuBangGia(a, x.hangHoaId))) || {};
        var cu = (A[k] || {}).gia || 0;
        var moi = (B[k] || {}).gia || 0;
        var ch = moi - cu;
        return {
            id: x.hangHoaId || k, maNoiBo: hh.maNoiBo || '',
            thongSo: x.thongSo || hh.thongSo || '',
            ngungLienKet: !!hh.daNgungLienKet,
            ma: x.ma || hh.ma || '', ten: x.ten || hh.ten || '', dvt: x.dvt || hh.dvt || '',
            lienKet: !!x.hangHoaId,
            cu: cu, moi: moi, chenh: ch,
            tyLe: cu > 0 ? ch / cu * 100 : (moi > 0 ? null : 0),
            tt: cu === 0 && moi > 0 ? 'Mới có giá' : cu > 0 && moi === 0 ? 'Bỏ giá'
              : ch > 0 ? 'Tăng giá' : ch < 0 ? 'Giảm giá' : 'Giữ nguyên'
        };
    }).sort(function (x, y) { return Math.abs(y.chenh) - Math.abs(x.chenh); });
};

/* ==========================================================================
   7. NHẬN DIỆN HÀNG HÓA KHI NHẬP BẢNG GIÁ
   Tệp bảng giá của nhà sản xuất thường KHÔNG có Mã hàng. Hệ thống tự thích
   nghi: nhận diện theo Mã hàng → Model → Tên hàng. Không tìm thấy thì tự tạo
   mới trong Danh mục Hàng hóa, mã hàng tự sinh từ Model.
   ========================================================================== */
/** Tìm hàng hóa linh hoạt: mã → model → tên. Trả về { hh, theo }. */
/**
 * Nhận diện mặt hàng khi nhập bảng giá.
 * MÃ HÀNG VÀ MODEL LÀ MỘT nên chỉ đối chiếu theo đúng một trường "Mã hàng
 * (Model)". Mã phụ (cột mã còn lại của tệp) và mã cũ của mặt hàng chỉ dùng để
 * cứu những tệp đời trước; tên hàng là phương án cuối cùng.
 *   → { hh, theo }             — đã nhận diện được
 *   → { hh: null, nhapNhang }  — một mã trỏ tới nhiều mặt hàng, phải để người
 *                                dùng chọn, hệ thống KHÔNG tự đoán
 */
W.timHangHoaLinhHoat = function (ma, maPhu, ten, thongSo, coCotMa) {
    /* BỘ NHẬN DIỆN DÙNG CHUNG CỦA TOÀN HỆ THỐNG — T.timMatHang.
       Mọi phân hệ dùng đúng một bộ nên cùng một dữ liệu luôn cho ra cùng một
       kết luận: Model + Tên hàng + Thông số kỹ thuật.
       Ở đây chỉ bổ sung phần riêng của tệp bảng giá: tệp của hãng thường có
       thêm một cột MÃ PHỤ (mã cũ, mã của hãng) nên phải thử cả mã phụ. */
    /* Bảng giá CHỈ GẮN GIÁ, không tạo mặt hàng — nên được phép nhận theo mã khi
       mã trỏ tới đúng một mặt hàng, kể cả khi hãng viết tên hàng khác. */
    var tc = { nhanTheoMa: true };
    var kq = T.nhanDienHangHoa({ ma: ma, model: ma, ten: ten, thongSo: thongSo }, tc);
    if (kq.hh) return kq;
    if (maPhu) {
        var kq2 = T.nhanDienHangHoa({ ma: maPhu, model: maPhu, ten: ten, thongSo: thongSo }, tc);
        if (kq2.hh) return kq2;
    }
    /* Tệp KHÔNG có cột mã: nhận theo Tên hàng khi tên trỏ tới đúng một mặt hàng. */
    if (coCotMa === false && ten) {
        var t = T.chiMucHangHoa().ten[T.kd(String(ten).trim())];
        if (t) return { hh: t, theo: 'Tên hàng' };
    }
    return { hh: null, theo: '' };
};
/**
 * Sinh mã hàng khi tệp không có cột Mã hàng.
 * Ưu tiên lấy Model; trùng thì thêm hậu tố -01, -02… Không bao giờ báo lỗi
 * vì thiếu mã hàng.
 */
W.maTuModel = function (model, ten, daDung) {
    daDung = daDung || {};
    var goc = String(model || '').trim();
    if (!goc) {
        // Không có model thì dựng mã từ tên hàng: lấy chữ cái đầu của các từ
        var t = T.kd(String(ten || '')).replace(/[^a-z0-9\s]/g, ' ').trim();
        goc = t ? t.split(/\s+/).slice(0, 4).map(function (w) {
            return w.substr(0, 3).toUpperCase(); }).join('-') : 'HH';
    }
    goc = goc.replace(/\s+/g, '-').replace(/[^0-9A-Za-z\-_.\/]/g, '').substr(0, 40);
    if (!goc) goc = 'HH';
    /* Mã sinh ra không được trùng mã nào đang có, kể cả mã đang dùng chung cho
       nhiều mặt hàng — lúc đó chỉ mục ghi 'nhieu' chứ không ghi bản ghi. */
    function ban(m) {
        var k = T.kd(m);
        var cm = T.chiMucHangHoa();
        return !!cm.ma[k] || !!cm.khac[k] || !!daDung[k];
    }
    if (!ban(goc)) return goc;
    for (var i = 1; i < 1000; i++) {
        var m = goc + '-' + ('0' + i).slice(-2);
        if (!ban(m)) return m;
    }
    return goc + '-' + T.uid('X').substr(0, 6);
};
/**
 * Đối chiếu một dòng bảng giá với Danh mục Hàng hóa.
 * c = { ma, ten, model, dvt, thongSo, hang, nhom } — tên cột trong tệp.
 * Trả về { hh, moi, theo, ma } và ghi cảnh báo (không phải lỗi) vào kt.
 */
/**
 * NHẬN DIỆN MẶT HÀNG CHO MỘT DÒNG BẢNG GIÁ.
 *
 * KIẾN TRÚC: Danh mục Hàng hóa là Master Data độc lập — nhập bảng giá TUYỆT
 * ĐỐI KHÔNG tạo mới và KHÔNG sửa mặt hàng nào. Vì vậy hàm này chỉ TRA, không
 * bao giờ dựng bản ghi hàng hóa.
 *
 * Dòng không tra ra mặt hàng nào vẫn được GIỮ NGUYÊN trong bảng giá (một dòng
 * Excel là một dòng TVERP); nó chỉ chưa liên kết với danh mục nên chưa tham gia
 * vào việc lấy giá khi lập chứng từ. Người dùng tạo mặt hàng trong Danh mục
 * Hàng hóa rồi bấm "Nối lại danh mục" là dòng đó liên kết ngay.
 */
W.hangHoaChoDongBangGia = function (kt, c, daDung) {
    var ma = c.ma ? kt.o(c.ma) : '';
    var maPhu = c.maPhu ? kt.o(c.maPhu) : '';
    var ten = c.ten ? kt.o(c.ten) : '';
    if (!ma && !maPhu && !ten) {
        kt.them(c.ten || c.ma || 'Tên hàng',
            'dòng không có Mã hàng lẫn Tên hàng nên không nhận diện được mặt hàng',
            'Ghi ít nhất một trong hai cột: Mã hàng (Model) hoặc Tên hàng.', 'khongNhanDien');
        return null;
    }
    var ts = c.thongSo ? kt.o(c.thongSo) : '';
    var kq = W.timHangHoaLinhHoat(ma, maPhu, ten, ts, !!(c.ma || c.maPhu));
    if (kq.hh) {
        return { hh: kq.hh, theo: kq.theo, ma: ma || kq.hh.ma,
                 hangHoaId: kq.hh.id, maPhu: maPhu, ten: ten, thongSo: ts };
    }
    /* CHƯA CÓ TRONG DANH MỤC — giữ nguyên dòng, chỉ ghi chú là chưa liên kết. */
    kt.canh(c.ma || 'Mã hàng (Model)',
        'mặt hàng chưa có trong Danh mục Hàng hóa — dòng vẫn được ghi vào bảng giá',
        'Nhập bảng giá không tạo mặt hàng mới. Vào Danh mục → Hàng hóa khai mặt hàng ' +
        'rồi bấm "Nối lại danh mục" ở bảng giá để liên kết.', 'chuaLienKet');
    return { hh: null, theo: 'Chưa liên kết', ma: ma || maPhu || '',
             hangHoaId: '', maPhu: maPhu, ten: ten, thongSo: ts };
};

/* ==========================================================================
   7B. HỎI TRƯỚC KHI TẠO HÀNG HÓA TỪ BẢNG GIÁ
   --------------------------------------------------------------------------
   Danh mục hàng hóa là DỮ LIỆU GỐC của hệ thống. Bảng giá chỉ tham chiếu tới
   danh mục bằng ID nội bộ và tuyệt đối không được tự sinh ra danh mục.

   Tệp bảng giá có mặt hàng chưa nằm trong danh mục thì hệ thống dừng lại,
   liệt kê đúng những mặt hàng đó và để người dùng quyết định — không tự tạo,
   cũng không tự bỏ qua.
   ========================================================================== */
/**
 * Chặn cửa: bộ nhập nào có thể sinh ra hàng hóa mới thì khai truocGhi bằng hàm
 * này. Mọi dòng có mặt hàng chưa nằm trong danh mục đều phải qua xác nhận.
 * o = { nhanTao, nhanBoQua, nhanHuy, moTaBoQua }
 */
W.chanTaoHangHoa = function (o) {
    o = o || {};
    return function (ds, tiep) {
        var chuaCo = ds.filter(function (d) { return d.o && d.o.hhKq && d.o.hhKq.moi; });
        var daCo = ds.filter(function (d) { return !(d.o && d.o.hhKq && d.o.hhKq.moi); });
        if (!chuaCo.length) return tiep(ds);
        W.hoiHangChuaCoTrongDanhMuc(chuaCo, daCo, {
            taoMoi: function () { tiep(ds); },
            boQua: function () { tiep(daCo); },
            huy: function () { }
        }, o);
    };
};

W.hoiHangChuaCoTrongDanhMuc = function (chuaCo, daCo, cb, o) {
    o = o || {};
    var xong = false;
    function bang() {
        var n = Math.min(chuaCo.length, 200);
        var h = '<div class="tablewrap" style="max-height:300px"><table class="grid">' +
            '<thead><tr><th style="width:52px">Dòng</th><th style="width:170px">Model (nhà sản xuất)</th>' +
            '<th>Tên hàng</th><th style="width:70px" class="ctr">ĐVT</th>' +
            '<th style="width:210px">Thông số kỹ thuật</th></tr></thead><tbody>';
        for (var i = 0; i < n; i++) {
            var d = chuaCo[i], m = (d.o && d.o.hhKq && d.o.hhKq.moi) || {};
            h += '<tr><td class="ctr mono">' + T.esc(d.dong) + '</td>' +
                 /* Bản ghi sắp tạo KHÔNG mang Mã hàng — Mã hàng do Danh mục sinh
                    ra ở bước ghi. Ở đây hiện MODEL của nhà sản xuất. */
                 '<td class="mono">' + T.esc(m.model || m.ma || '') + '</td>' +
                 '<td><span class="ellip">' + T.esc(m.ten || '') + '</span></td>' +
                 '<td class="ctr">' + T.esc(m.dvt || '') + '</td>' +
                 '<td><span class="ellip">' + T.esc(m.thongSo || '') + '</span></td></tr>';
        }
        h += '</tbody></table></div>';
        if (chuaCo.length > n)
            h += '<div class="small muted mt8">Hiển thị ' + T.num(n, 0) + ' trên tổng số ' +
                 T.num(chuaCo.length, 0) + ' mặt hàng chưa có.</div>';
        return h;
    }
    /* Lựa chọn của người dùng được ghi lại TRƯỚC khi đóng cửa sổ, rồi mới chạy
       khi cửa sổ đóng hẳn. Nhờ vậy đóng bằng nút X (không chọn gì) mặc định là
       HỦY IMPORT, còn bấm một nút thì chạy đúng lựa chọn của nút đó. */
    var daChon = null;
    function goi(f) { daChon = f; }
    function chay() { if (xong) return; xong = true; (daChon || cb.huy || function () { })(); }

    UI.modal({
        size: 'lg', dismiss: false,
        title: 'Có mặt hàng chưa có trong Danh mục Hàng hóa',
        sub: 'Danh mục hàng hóa là dữ liệu gốc — bảng giá không tự tạo hàng hóa',
        body: '<div class="note y mb12"><i class="bi bi-exclamation-triangle-fill"></i><div>' +
              'Tệp bảng giá có <b>' + T.num(chuaCo.length, 0) + ' mặt hàng chưa có trong Danh mục ' +
              'Hàng hóa</b>' + (daCo.length ? ' và <b>' + T.num(daCo.length, 0) +
              ' mặt hàng đã có</b>' : '') + '. Hệ thống <b>không tự tạo</b> và cũng ' +
              '<b>không tự bỏ qua</b> — anh chọn cách xử lý bên dưới.</div></div>' +
              bang() +
              '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>' +
              '<b>' + T.esc(o.nhanTao || 'Tạo mới hàng hóa và cập nhật giá') + '</b> — thêm ' +
              T.num(chuaCo.length, 0) + ' mặt hàng vào Danh mục Hàng hóa (mỗi mặt hàng một ID nội ' +
              'bộ riêng, giữ nguyên Model) rồi ghi đủ ' +
              T.num(chuaCo.length + daCo.length, 0) + ' dòng.<br>' +
              '<b>' + T.esc(o.nhanBoQua || 'Chỉ cập nhật bảng giá, bỏ qua hàng chưa có') +
              '</b> — danh mục giữ nguyên, chỉ ghi ' + T.num(daCo.length, 0) +
              ' dòng của mặt hàng đã có; ' + T.num(chuaCo.length, 0) + ' dòng còn lại bỏ qua.<br>' +
              '<b>' + T.esc(o.nhanHuy || 'Hủy import') + '</b> — ' +
              (o.moTaBoQua || 'không ghi gì cả, phiên bản bảng giá không được tạo') + '.' +
              '</div></div>',
        buttons: [
            { text: o.nhanHuy || 'Hủy import', icon: 'bi-x-circle', click: function (h) {
                goi(cb.huy); h.close(); } },
            { text: o.nhanBoQua || 'Chỉ cập nhật bảng giá, bỏ qua hàng chưa có', icon: 'bi-funnel',
              click: function (h) { goi(cb.boQua); h.close(); } },
            { text: o.nhanTao || 'Tạo mới hàng hóa và cập nhật giá', cls: 'primary',
              icon: 'bi-plus-square', click: function (h) { goi(cb.taoMoi); h.close(); } }
        ],
        onOpen: function (h) {
            /* Đóng bằng nút X mà chưa chọn gì thì mặc định là HỦY IMPORT —
               không được ngầm hiểu là đã đồng ý. */
            var cu = h.close;
            h.close = function () { cu(); chay(); };
        }
    });
};

/* ==========================================================================
   8. LỊCH SỬ GIÁ CỦA MỘT MẶT HÀNG
   Mỗi mặt hàng tồn tại nhiều mức giá qua các phiên bản bảng giá. Không ghi đè,
   không mất lịch sử.
   ========================================================================== */
W.lichSuGiaHang = function (maHang) {
    var ds = DB.all('hangHoa');
    var ma = maHang || (ds[0] || {}).ma || '';

    UI.modal({
        size: 'xl', dismiss: false,
        title: 'Lịch sử giá của mặt hàng',
        sub: 'Mọi phiên bản bảng giá đều được giữ lại — không ghi đè, không mất lịch sử',
        body:
            '<div class="row mb12" style="align-items:flex-end;gap:12px;flex-wrap:wrap">' +
            '<div class="fld" style="flex:1;min-width:320px"><label>Chọn mặt hàng</label>' +
            '<select id="lsMa">' + ds.map(function (x) {
                return '<option value="' + T.esc(x.ma) + '"' + (x.ma === ma ? ' selected' : '') + '>' +
                    T.esc(x.ma + ' — ' + x.ten) + '</option>';
            }).join('') + '</select></div>' +
            '<div class="fld" style="min-width:200px"><label>Loại giá</label>' +
            '<select id="lsCot"><option value="">— Tất cả loại giá —</option></select></div>' +
            '</div><div id="lsBang"></div>',
        buttons: [
            { text: 'Đóng', click: function (h) { h.close(); } },
            { text: 'Xuất báo cáo lịch sử giá', cls: 'primary', icon: 'bi-file-earmark-bar-graph',
              click: function (h) { h.__in(); } }
        ],
        onOpen: function (h) {
            function ve() {
                var m = h.q('#lsMa').value;
                var hh = DB.all('hangHoa').filter(function (x) { return x.ma === m; })[0] || {};
                var all = T.lichSuGiaBan(m);
                var cots = [];
                all.forEach(function (x) { if (cots.indexOf(x.loaiGia) < 0) cots.push(x.loaiGia); });
                var cu = h.q('#lsCot').value;
                h.q('#lsCot').innerHTML = '<option value="">— Tất cả loại giá —</option>' +
                    cots.map(function (c) {
                        return '<option' + (c === cu ? ' selected' : '') + '>' + T.esc(c) + '</option>';
                    }).join('');
                var loc = h.q('#lsCot').value;
                var rows = all.filter(function (x) { return !loc || x.loaiGia === loc; });
                // chênh lệch so với mức giá liền trước của cùng loại giá
                var truoc = {};
                rows.forEach(function (x) {
                    var t = truoc[x.loaiGia];
                    x.chenh = t === undefined ? 0 : x.gia - t;
                    x.tyLe = t ? x.chenh / t * 100 : null;
                    truoc[x.loaiGia] = x.gia;
                });
                h.q('#lsBang').innerHTML =
                    '<div class="note b mb12"><i class="bi bi-clock-history"></i><div>' +
                    '<b>' + T.esc(hh.ma || m) + '</b> — ' + T.esc(hh.ten || '') +
                    ((hh.maKhac || []).length ? ' · Mã cũ <b>' + T.esc((hh.maKhac || []).join(', ')) + '</b>' : '') +
                    ' · <b>' + T.num(rows.length, 0) + '</b> mức giá qua <b>' +
                    T.num(Object.keys(rows.reduce(function (a, x) {
                        a[x.bangGiaId] = 1; return a; }, {})).length, 0) + '</b> phiên bản bảng giá.' +
                    '</div></div>' +
                    '<div class="tablewrap" style="max-height:calc(100vh - 360px)">' +
                    '<table class="grid"><thead><tr>' +
                    '<th style="width:44px">TT</th><th style="width:150px">Bảng giá</th>' +
                    '<th style="width:90px" class="ctr">Phiên bản</th>' +
                    '<th style="width:120px">Hiệu lực từ</th><th style="width:120px">Đến ngày</th>' +
                    '<th style="width:150px">Nhà sản xuất</th>' +
                    '<th style="width:170px">Loại giá</th>' +
                    '<th class="num" style="width:140px">Giá</th>' +
                    '<th class="num" style="width:130px">Chênh lệch</th>' +
                    '<th class="num" style="width:100px">Tỷ lệ</th></tr></thead><tbody>' +
                    (rows.length ? rows.map(function (x, i) {
                        return '<tr><td class="ctr muted">' + (i + 1) + '</td>' +
                            '<td><span class="ellip">' + T.esc(x.tenBangGia) + '</span></td>' +
                            '<td class="ctr"><span class="pill c">v' + x.phienBan + '</span></td>' +
                            '<td>' + T.date(x.tuNgay) + '</td>' +
                            '<td>' + (x.denNgay ? T.date(x.denNgay) : '<span class="muted">không giới hạn</span>') + '</td>' +
                            '<td><span class="ellip">' + T.esc(x.nhaCungCap || '—') + '</span></td>' +
                            '<td>' + T.esc(x.loaiGia) + '</td>' +
                            '<td class="num b">' + T.money(x.gia) + '</td>' +
                            '<td class="num ' + (x.chenh > 0 ? 'neg' : x.chenh < 0 ? 'pos' : 'muted') + '">' +
                                (x.chenh ? (x.chenh > 0 ? '+' : '') + T.money(x.chenh) : '—') + '</td>' +
                            '<td class="num ' + (x.chenh > 0 ? 'neg' : x.chenh < 0 ? 'pos' : 'muted') + '">' +
                                (x.tyLe === null || !x.tyLe ? '—' : (x.tyLe > 0 ? '+' : '') + T.num(x.tyLe, 1) + '%') +
                            '</td></tr>';
                    }).join('')
                    : '<tr><td colspan="10"><div class="empty" style="padding:26px">' +
                      '<i class="bi bi-clock-history"></i><b>Mặt hàng này chưa có giá ở bảng giá nào</b>' +
                      'Nhập bảng giá từ Excel hoặc nhập giá trực tiếp trên màn hình Bảng giá.</div></td></tr>') +
                    '</tbody></table></div>';
                h.__in = function () {
                    W.inBaoCao({
                        tieu: 'LỊCH SỬ GIÁ BÁN — ' + (hh.ma || m),
                        phu: hh.ten || '',
                        thoiDiem: T.today(),
                        dieuKien: [
                            { t: 'Mã hàng', v: hh.ma || m },
                            { t: 'Mã cũ', v: (hh.maKhac || []).join(', ') || '—' },
                            { t: 'Loại giá', v: loc || 'Tất cả loại giá' },
                            { t: 'Số mức giá', v: T.num(rows.length, 0) }
                        ],
                        cols: [
                            { t: 'Bảng giá', k: 'tenBangGia', w: 50 },
                            { t: 'Phiên bản', k: 'phienBan', w: 18, cls: 'c' },
                            { t: 'Hiệu lực từ', k: 'tuNgay', w: 24, r: function (v) { return T.date(v); } },
                            { t: 'Đến ngày', k: 'denNgay', w: 24,
                              r: function (v) { return v ? T.date(v) : 'không giới hạn'; } },
                            { t: 'Nhà sản xuất', k: 'nhaCungCap', w: 28 },
                            { t: 'Loại giá', k: 'loaiGia', w: 30 },
                            { t: 'Giá', k: 'gia', w: 26, tong: true },
                            { t: 'Chênh lệch', k: 'chenh', w: 26, tong: true },
                            { t: 'Tỷ lệ', k: 'tyLe', w: 18,
                              r: function (v) { return v === null || !v ? '—' : (v > 0 ? '+' : '') + T.num(v, 1) + '%'; } }
                        ],
                        rows: rows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'GIÁM ĐỐC'
                    });
                };
            }
            h.q('#lsMa').onchange = ve;
            h.q('#lsCot').onchange = ve;
            ve();
        }
    });
};

})(window);

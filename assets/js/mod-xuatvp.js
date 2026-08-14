/* ==========================================================================
   TVERP — XUẤT WORD VÀ EXCEL THEO ĐÚNG BIỂU MẪU
   Word, Excel biểu mẫu và PDF đều sinh ra từ CÙNG MỘT bản in của biểu mẫu đã
   cấu hình trong "Biểu mẫu chứng từ" / khung "Biểu mẫu báo cáo".
   Nhờ vậy ba định dạng luôn thống nhất về bố cục, định dạng và nhận diện
   thương hiệu; không có định dạng nào xuất ra dữ liệu thô.

   Gồm ba phần:
     1. Bộ đóng gói tệp .zip (Word và Excel đều là tệp nén OOXML).
     2. Bộ phân tích bản in HTML thành cấu trúc khối, đọc đúng phông chữ, cỡ
        chữ, màu, đường kẻ, ô gộp và bề rộng cột như đang hiển thị.
     3. Bộ sinh tệp Word (.docx) và Excel (.xlsx) từ cấu trúc đó.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI;

/* ==========================================================================
   1. ĐÓNG GÓI TỆP ZIP (phương thức lưu trữ, không nén)
   ========================================================================== */
var BANG_CRC = (function () {
    var b = new Int32Array(256), i, j, c;
    for (i = 0; i < 256; i++) {
        c = i;
        for (j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        b[i] = c;
    }
    return b;
})();
function crc32(u8) {
    var c = -1, i;
    for (i = 0; i < u8.length; i++) c = BANG_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}
function chuoiSangByte(s) {
    if (W.TextEncoder) return new TextEncoder().encode(s);
    var u = [], i, c;
    for (i = 0; i < s.length; i++) {
        c = s.charCodeAt(i);
        if (c < 128) u.push(c);
        else if (c < 2048) u.push(192 | (c >> 6), 128 | (c & 63));
        else u.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return new Uint8Array(u);
}
function b64SangByte(b64) {
    /* Ảnh hỏng hoặc chuỗi không hợp lệ thì bỏ qua, không làm hỏng cả tệp xuất ra. */
    var s;
    try { s = atob(String(b64 || '').replace(/\s/g, '')); }
    catch (e) { return null; }
    var u = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
}
function Zip() { this.ds = []; }
Zip.prototype.them = function (ten, noi) {
    this.ds.push({ ten: ten, du: typeof noi === 'string' ? chuoiSangByte(noi) : noi });
};
Zip.prototype.tao = function (kieu) {
    var ds = this.ds, phan = [], muc = [], vt = 0, i;
    function u16(n) { return [n & 255, (n >> 8) & 255]; }
    function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; }
    for (i = 0; i < ds.length; i++) {
        var f = ds[i], ten = chuoiSangByte(f.ten), c = crc32(f.du), n = f.du.length;
        var dau = [].concat([0x50, 0x4B, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0),
                            u32(c), u32(n), u32(n), u16(ten.length), u16(0));
        phan.push(new Uint8Array(dau), ten, f.du);
        muc.push({ ten: ten, crc: c, n: n, vt: vt });
        vt += dau.length + ten.length + n;
    }
    var tt = [], ttLen = 0;
    for (i = 0; i < muc.length; i++) {
        var m = muc[i];
        var d = [].concat([0x50, 0x4B, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
                          u32(m.crc), u32(m.n), u32(m.n), u16(m.ten.length),
                          u16(0), u16(0), u16(0), u16(0), u32(0), u32(m.vt));
        tt.push(new Uint8Array(d), m.ten);
        ttLen += d.length + m.ten.length;
    }
    var cuoi = new Uint8Array([].concat([0x50, 0x4B, 0x05, 0x06], u16(0), u16(0),
                              u16(muc.length), u16(muc.length), u32(ttLen), u32(vt), u16(0)));
    var tong = vt + ttLen + cuoi.length, out = new Uint8Array(tong), p = 0;
    function ghi(a) { out.set(a, p); p += a.length; }
    phan.forEach(ghi); tt.forEach(ghi); ghi(cuoi);
    return kieu ? new Blob([out], { type: kieu }) : out;
};
function taiVe(blob, ten) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ten;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
}

/* ==========================================================================
   2. PHÂN TÍCH BẢN IN HTML
   ========================================================================== */
var PX_MM = 25.4 / 96;
function px2mm(px) { return Math.round(Number(px) * PX_MM * 100) / 100; }
function px2pt(px) { return Math.round(Number(px) * 0.75 * 10) / 10; }
function mau(c) {
    if (!c) return '';
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    if (!m) return '';
    function h(x) { return ('0' + Number(x).toString(16)).slice(-2); }
    return (h(m[1]) + h(m[2]) + h(m[3])).toUpperCase();
}
function trong(c) { return !c || /rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(c); }

/**
 * Ảnh trên bản in có thể là ảnh nhúng (data:) hoặc ảnh nằm trong thư mục cài
 * đặt (logo, con dấu, chữ ký mẫu). Tệp Word và Excel chỉ nhúng được ảnh dạng
 * dữ liệu, nên ảnh dạng đường dẫn được vẽ lại qua khung ảnh rồi lấy dữ liệu —
 * nhờ vậy xuất ra tệp KHÔNG BAO GIỜ mất logo hay con dấu.
 */
function anhSangDuLieu(img) {
    var src = img.getAttribute('src') || '';
    if (!src || src.indexOf('data:') === 0) return src;
    var kho = W.ANH_DATA || {};
    if (kho[src]) return kho[src];
    try {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) return src;
        var to = Math.min(1, 900 / Math.max(w, h));           // không nhúng ảnh quá lớn
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w * to));
        cv.height = Math.max(1, Math.round(h * to));
        var c = cv.getContext('2d');
        c.drawImage(img, 0, 0, cv.width, cv.height);
        return cv.toDataURL('image/png');
    } catch (e) { return src; }
}

function kieuChu(el) {
    var s = getComputedStyle(el);
    return {
        font: (s.fontFamily || '').split(',')[0].replace(/["']/g, '').trim() || 'Times New Roman',
        co: px2pt(parseFloat(s.fontSize) || 13),
        dam: (Number(s.fontWeight) >= 600 || s.fontWeight === 'bold'),
        ngh: s.fontStyle === 'italic',
        gach: (s.textDecorationLine || s.textDecoration || '').indexOf('underline') >= 0,
        mau: mau(s.color) || '000000'
    };
}
/**
 * Chữ do CSS sinh ra bằng ::before / ::after (dấu hai chấm sau nhãn, gạch đầu
 * dòng "- ", dấu "+ "…). Bản in hiển thị các ký tự này nên tệp Word và Excel
 * cũng phải có — nếu bỏ qua thì nhãn mất dấu ":", các dòng gạch đầu mất "-".
 */
function chuGia(el, cho) {
    try {
        var c = getComputedStyle(el, cho).content;
        if (!c || c === 'none' || c === 'normal') return '';
        var ra = '', m, re = /"((?:[^"\\]|\\.)*)"/g;
        while ((m = re.exec(c))) ra += m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        return ra;
    } catch (e) { return ''; }
}
/** Phần tử là Ô của một dòng xếp ngang (flex) — trên giấy nó đứng CẠNH ô khác. */
function trongDongNgang(n) {
    var p = n.parentElement;
    if (!p) return false;
    var d = getComputedStyle(p).display;
    if (d !== 'flex' && d !== 'inline-flex') return false;
    return (getComputedStyle(p).flexDirection || 'row').indexOf('row') === 0;
}
/** Gom các đoạn chữ trong một phần tử thành danh sách "run" có định dạng. */
function docRun(el) {
    var runs = [];
    (function di(n) {
        if (n.nodeType === 3) {
            var t = n.nodeValue.replace(/\s+/g, ' ');
            if (!t.trim()) { if (runs.length && t === ' ') runs.push({ t: ' ', k: kieuChu(n.parentElement) }); return; }
            runs.push({ t: t, k: kieuChu(n.parentElement) });
            return;
        }
        if (n.nodeType !== 1) return;
        if (n.tagName === 'BR') { runs.push({ br: true }); return; }
        if (n.tagName === 'IMG') {
            runs.push({ anh: anhSangDuLieu(n), rong: px2mm(n.getBoundingClientRect().width),
                        cao: px2mm(n.getBoundingClientRect().height) });
            return;
        }
        /* Phần tử con dạng khối (div, p, h1…) phải xuống dòng — TRỪ các ô của
           một dòng xếp ngang (flex): trên giấy chúng đứng cạnh nhau nên khi
           đọc gộp vào một đoạn thì nối bằng dấu cách, không xuống dòng. */
        if (n !== el && khoiRieng(n) && runs.length && !runs[runs.length - 1].br) {
            if (trongDongNgang(n)) {
                var cuoi = runs[runs.length - 1];
                if (!cuoi.br && (!cuoi.t || !/\s$/.test(cuoi.t))) runs.push({ t: ' ', k: kieuChu(n) });
            } else runs.push({ br: true });
        }
        var truoc = chuGia(n, '::before');
        if (truoc) runs.push({ t: truoc, k: kieuChu(n) });
        Array.prototype.forEach.call(n.childNodes, di);
        var sau = chuGia(n, '::after');
        if (sau) runs.push({ t: sau, k: kieuChu(n) });
    })(el);
    while (runs.length && runs[runs.length - 1].br) runs.pop();
    return runs;
}
/** Phần tử có tự xuống dòng trên bản in hay không. */
function khoiRieng(n) {
    if (/^(DIV|P|H1|H2|H3|H4|H5|H6|LI|TR|SECTION|HEADER|FOOTER|BLOCKQUOTE)$/.test(n.tagName)) return true;
    var d = getComputedStyle(n).display;
    return d === 'block' || d === 'flex' || d === 'grid' || d === 'list-item' || d === 'table';
}
function canLe(el) {
    var a = getComputedStyle(el).textAlign;
    return a === 'center' ? 'center' : a === 'right' || a === 'end' ? 'right'
         : a === 'justify' ? 'both' : 'left';
}
function doan(el, truocRuns) {
    var s = getComputedStyle(el);
    var runs = docRun(el);
    if (truocRuns && truocRuns.length) runs = truocRuns.concat(runs);
    return {
        loai: 'doan', runs: runs, can: canLe(el),
        truoc: px2pt(parseFloat(s.marginTop) || 0), sau: px2pt(parseFloat(s.marginBottom) || 0),
        thut: px2mm(parseFloat(s.paddingLeft) || 0)
    };
}
function vien(el) {
    var s = getComputedStyle(el);
    var w = parseFloat(s.borderTopWidth) || 0;
    return { co: w > 0 && s.borderTopStyle !== 'none', mau: mau(s.borderTopColor) || '000000',
             day: Math.max(2, Math.round(w * 8)) };
}
/**
 * Đường viền BỐN CẠNH của một phần tử — giữ cả kiểu nét (liền / chấm / gạch).
 * Dùng cho các ô của khối xếp ngang: đường chấm dưới ô giá trị của phiếu thu,
 * phiếu chi… phải theo sang tệp Word và Excel.
 */
function vien4(el) {
    var s = getComputedStyle(el);
    function mot(canh) {
        var w = parseFloat(s['border' + canh + 'Width']) || 0;
        var st = s['border' + canh + 'Style'] || 'none';
        if (!w || st === 'none' || st === 'hidden') return null;
        return { day: Math.max(2, Math.round(w * 8)),
                 kieu: st === 'dotted' ? 'dotted' : st === 'dashed' ? 'dashed' : 'single',
                 mau: mau(s['border' + canh + 'Color']) || '000000' };
    }
    var t = mot('Top'), d = mot('Bottom'), tr = mot('Left'), ph = mot('Right');
    if (!t && !d && !tr && !ph) return null;
    return { tren: t, duoi: d, trai: tr, phai: ph };
}
function docBang(tb) {
    var rows = [], cot = [];
    var trs = tb.querySelectorAll('tr');
    // bề rộng cột lấy theo dòng có nhiều ô nhất, đúng như đang hiển thị
    var chuan = null, max = 0;
    Array.prototype.forEach.call(trs, function (tr) {
        var n = 0;
        Array.prototype.forEach.call(tr.children, function (td) { n += (td.colSpan || 1); });
        if (n > max) { max = n; chuan = tr; }
    });
    if (chuan) Array.prototype.forEach.call(chuan.children, function (td) {
        var w = td.getBoundingClientRect().width / (td.colSpan || 1);
        for (var i = 0; i < (td.colSpan || 1); i++) cot.push(px2mm(w));
    });
    /* Ô gộp DỌC (rowspan — ví dụ ô logo của đầu trang khung kẻ ô) chiếm chỗ ở
       các dòng bên dưới: nếu không chèn Ô NỐI TIẾP giữ chỗ thì các ô của những
       dòng đó bị dạt sang trái, ăn nhầm bề rộng cột — "Đại diện" chui vào cột
       logo. Bộ đọc dưới đây giữ chỗ đúng như lưới của trình duyệt. */
    var giuDoc = {};                     // cột lưới đang bị ô rowspan chiếm
    Array.prototype.forEach.call(trs, function (tr) {
        var o = [], vt = 0;
        function giuCho() {
            while (giuDoc[vt]) {
                giuDoc[vt]--;
                o.push({ tiep: true, colspan: 1, rowspan: 1 });
                vt++;
            }
        }
        giuCho();
        Array.prototype.forEach.call(tr.children, function (td) {
            var s = getComputedStyle(td);
            var kdl = [];
            Array.prototype.forEach.call(td.children, function (c) {
                if (c.tagName === 'DIV' || c.tagName === 'P') kdl.push(doan(c));
            });
            var cs = td.colSpan || 1, rs = td.rowSpan || 1;
            o.push({
                runs: kdl.length ? null : docRun(td), khoi: kdl.length ? kdl : null,
                colspan: cs, rowspan: rs,
                can: canLe(td), doc: s.verticalAlign === 'middle' ? 'center' : 'top',
                nen: trong(s.backgroundColor) ? '' : mau(s.backgroundColor),
                vien: vien(td), cao: px2pt(td.getBoundingClientRect().height),
                so: /^[\d.,\s\-+%]+$/.test((td.textContent || '').trim()) && (td.textContent || '').trim() !== ''
            });
            if (rs > 1) for (var g = 0; g < cs; g++) giuDoc[vt + g] = rs - 1;
            vt += cs;
            giuCho();
        });
        rows.push({ o: o, tieu: tr.parentNode && tr.parentNode.tagName === 'THEAD',
                    tong: (tr.className || '').indexOf('sum') >= 0 ||
                          (tr.parentNode && tr.parentNode.tagName === 'TFOOT') });
    });
    /* Đệm trong ô đúng như đang hiển thị — tệp Word đặt lề ô theo số đo này
       nên bề rộng chữ trong ô khớp bản in, con số không bị gãy làm đôi. */
    var dem = { trai: 2, phai: 2 };
    var td0 = tb.querySelector('td, th');
    if (td0) {
        var st0 = getComputedStyle(td0);
        dem = { trai: Math.max(0.5, px2mm(parseFloat(st0.paddingLeft) || 0)),
                phai: Math.max(0.5, px2mm(parseFloat(st0.paddingRight) || 0)) };
    }
    return { loai: 'bang', cot: cot, rows: rows, dem: dem,
             vien: trs.length ? vien(trs[0].children[0] || tb) : { co: true, mau: '000000', day: 8 } };
}

/**
 * Phân tích bản in thành cấu trúc dùng chung cho Word và Excel.
 *
 * MỘT RENDER ENGINE DUY NHẤT: tham số nhận THẲNG khối DOM đang hiển thị trên
 * màn hình xem trước (WYSIWYG tuyệt đối — Word, Excel, PDF và bản in đọc đúng
 * một cây DOM, đúng một bộ CSS, đúng các kiểu người dùng vừa sửa trực tiếp).
 * Vẫn nhận được chuỗi HTML cho các trường hợp in hàng loạt chưa hiển thị: khi
 * đó chuỗi được dựng vào đúng khung .print-area nên vẫn ra cùng kết quả.
 *
 * Trả về { than: [khối], chan: [khối], land, le, rongMm }
 */
function phanTich(html) {
    var host, tam = false;
    if (html && html.nodeType === 1) {
        host = html;
    } else {
        host = document.createElement('div');
        host.setAttribute('style', 'position:fixed;left:-20000px;top:0;visibility:hidden;');
        host.className = 'print-area';
        host.innerHTML = html;
        document.body.appendChild(host);
        tam = true;
    }
    var kq = { than: [], chan: [], land: false, le: { tren: 15, duoi: 16, trai: 20, phai: 15 }, rongMm: 175 };
    var gocTrai = 0;                       // mép trái vùng nội dung của trang đang đọc (px)
    try {
        // In hàng loạt: bản in có nhiều trang chứng từ — xuất hết, mỗi trang một khổ giấy
        var ds = host.querySelectorAll('.print-sheet');
        if (!ds.length) ds = host.querySelectorAll('.pr-page');
        var to = Array.prototype.slice.call(ds);
        if (!to.length && host.firstElementChild) to = [host.firstElementChild];
        if (!to.length) return kq;

        var sheet = to[0];
        kq.land = /landscape|land/.test(sheet.className);
        var ss = getComputedStyle(sheet);
        kq.le = { tren: px2mm(parseFloat(ss.paddingTop)), duoi: px2mm(parseFloat(ss.paddingBottom)),
                  trai: px2mm(parseFloat(ss.paddingLeft)), phai: px2mm(parseFloat(ss.paddingRight)) };
        kq.rongMm = px2mm(sheet.clientWidth - parseFloat(ss.paddingLeft) - parseFloat(ss.paddingRight));

        to.forEach(function (sh, iSheet) {
            if (iSheet) kq.than.push({ loai: 'ngat' });
            var sr = sh.getBoundingClientRect();
            gocTrai = sr.left + parseFloat(getComputedStyle(sh).paddingLeft || 0);
            Array.prototype.forEach.call(sh.children, function (el) {
                var cl = el.className || '';
                // mốc sang trang chỉ hiện trên màn hình, không xuất ra tệp
                if (cl.indexOf('pr-ranh') >= 0) return;
                // chân trang chỉ lấy một lần — mọi trang đều dùng chung một chân trang
                if (cl.indexOf('pr-foot') >= 0) {
                    if (!kq.chan.length) kq.chan = kq.chan.concat(khoiTu(el));
                    return;
                }
                kq.than = kq.than.concat(khoiTu(el));
            });
        });
    } finally { if (tam) document.body.removeChild(host); }
    return kq;

    /** Khoảng cách từ mép trái vùng nội dung đến mép trái phần tử (mm). */
    function lech(el) {
        try {
            var x = el.getBoundingClientRect().left - gocTrai;
            return x > 1 ? px2mm(x) : 0;
        } catch (e) { return 0; }
    }
    /** Phần tử là khối XẾP NGANG (flex theo hàng) có từ 2 ô trở lên. */
    function laDongNgang(el) {
        if (el.nodeType !== 1) return false;
        var s = getComputedStyle(el);
        if (s.display !== 'flex' && s.display !== 'inline-flex') return false;
        if ((s.flexDirection || 'row').indexOf('row') !== 0) return false;
        var n = 0;
        Array.prototype.forEach.call(el.children, function (c) { if (c.nodeType === 1) n++; });
        return n >= 2;
    }
    function khoiTu(el) {
        var cl = el.className || '';
        if (cl.indexOf('page-break') >= 0) return [{ loai: 'ngat' }];
        if (el.tagName === 'TABLE') {
            var bb = docBang(el);
            bb.trai = lech(el);
            return [bb];
        }
        /* Các khối xếp ngang trên bản in — đầu trang ba vùng, khối thông tin
           các bên, khối tổng cộng canh phải, khối chữ ký, chân trang, và MỌI
           dòng "nhãn — giá trị" dàn ngang bằng flex (phiếu thu, phiếu chi,
           khối các bên của hợp đồng…) — phải giữ đúng bố cục khi xuất
           Word / Excel, nên chuyển thành bảng không đường kẻ với đúng số cột
           và đúng bề rộng đang hiển thị. */
        if (cl.indexOf('pr-kydn') >= 0 || cl.indexOf('pr-head') >= 0 || cl.indexOf('pr-sign') >= 0 ||
            cl.indexOf('pr-2c') >= 0 || cl.indexOf('pr-foot') >= 0 ||
            cl.indexOf('pr-ben') >= 0 || cl.indexOf('pr-tong') >= 0 ||
            cl.indexOf('pr-ktdau') >= 0 || laDongNgang(el)) return [bangNgang(el)];
        var tb = el.querySelector && el.querySelector('table');
        if (tb) {
            var ra = [];
            Array.prototype.forEach.call(el.children, function (c) { ra = ra.concat(khoiTu(c)); });
            return ra.length ? ra : [docBang(tb)];
        }
        // khối chứa nhiều đoạn con
        /* Tiêu đề (h1…h4) cũng là một đoạn riêng. Nếu không kể vào đây thì khối
           nào vừa có tiêu đề vừa có đoạn con — ví dụ khối tiêu đề chứng từ kế
           toán — sẽ bị bỏ mất chính dòng tên biểu mẫu khi xuất Word / Excel. */
        var conBlock = Array.prototype.filter.call(el.children, function (c) {
            return c.tagName === 'DIV' || c.tagName === 'P' || c.tagName === 'UL' ||
                   c.tagName === 'OL' || /^H[1-4]$/.test(c.tagName);
        });
        if (conBlock.length && cl.indexOf('pr-title') < 0) {
            var r2 = [];
            conBlock.forEach(function (c) { r2 = r2.concat(khoiTu(c)); });
            return r2;
        }
        /* Danh sách đánh số (ol) phải giữ đúng số thứ tự "1. 2. 3." như trên
           bản in; danh sách chấm đầu dòng (ul) giữ dấu gạch. Nếu chính phần tử
           li đã tự sinh dấu bằng CSS ::before thì thôi, không thêm nữa. */
        if (el.tagName === 'UL' || el.tagName === 'OL') {
            var laOL = el.tagName === 'OL';
            return Array.prototype.map.call(el.children, function (li, i) {
                var dauDong = chuGia(li, '::before') ? ''
                    : (laOL ? (i + 1) + '. '
                            : (getComputedStyle(li).listStyleType === 'none' ? '' : '- '));
                return doan(li, dauDong ? [{ t: dauDong, k: kieuChu(li) }] : null);
            });
        }
        var t = (el.textContent || '').trim();
        if (!t && !el.querySelector('img')) return [{ loai: 'doan', runs: [], can: 'left', truoc: 0, sau: 0, thut: 0 }];
        return [doan(el)];
    }
    /**
     * Khối xếp ngang (đầu trang, khối chữ ký, dòng nhãn — giá trị) → bảng
     * không đường kẻ. Ô nào bên trong lại là một khối xếp ngang nữa (ví dụ
     * vùng "logo + thông tin pháp nhân" của đầu trang kế toán) thì TRẢI PHẲNG
     * thành nhiều cột — giữ đúng bố cục cạnh nhau như trên giấy.
     */
    function bangNgang(el) {
        var con = [];
        (function trai(ph) {
            Array.prototype.forEach.call(ph.children, function (c) {
                if (c.nodeType !== 1) return;
                if (laDongNgang(c) && c.className.indexOf('pr-sign') < 0) trai(c);
                else con.push(c);
            });
        })(el);
        if (!con.length) con = [el];
        var cot = con.map(function (c) { return px2mm(c.getBoundingClientRect().width); });
        /* Ô "nhãn" khai white-space:nowrap có bề rộng vừa khít chữ. Word đo
           chữ chênh trình duyệt chút ít là nhãn gãy dòng ("Số tiền:" thành
           hai dòng) — nới thêm chút đỉnh cho các ô này, lấy từ ô rộng nhất
           (ô giá trị co giãn) nên tổng bề rộng không đổi. */
        var noi = 0;
        con.forEach(function (c, i) {
            if (getComputedStyle(c).whiteSpace === 'nowrap' && (c.textContent || '').trim()) {
                var them = Math.min(3, cot[i] * 0.06 + 1);
                cot[i] += them; noi += them;
            }
        });
        if (noi > 0) {
            var iMax = -1;
            cot.forEach(function (w, i) {
                if (getComputedStyle(con[i]).whiteSpace !== 'nowrap' &&
                    (iMax < 0 || w > cot[iMax])) iMax = i;
            });
            if (iMax >= 0) cot[iMax] = Math.max(6, cot[iMax] - noi);
        }
        var o = con.map(function (c) {
            var kdl = [];
            Array.prototype.forEach.call(c.children, function (x) {
                if (x.tagName === 'DIV' || x.tagName === 'P' || /^H[1-4]$/.test(x.tagName))
                    kdl.push(doan(x));
            });
            if (!kdl.length) kdl = [doan(c)];
            return { khoi: kdl, colspan: 1, rowspan: 1, can: canLe(c), doc: 'top',
                     nen: '', vien: { co: false }, vien4: vien4(c), cao: 0, so: false,
                     giuDong: getComputedStyle(c).whiteSpace === 'nowrap' };
        });
        return { loai: 'bang', cot: cot, khongVien: true, trai: lech(el),
                 rows: [{ o: o, tieu: false, tong: false }], vien: { co: false } };
    }
}
W.phanTichBanIn = phanTich;

/* ==========================================================================
   3. SINH TỆP WORD (.docx)
   ========================================================================== */
function tw(mm) { return Math.round(Number(mm) * 1440 / 25.4); }
function xmlEsc(s) {
    return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/ /g, ' ');
}
function docxRun(r, anh) {
    if (r.br) return '<w:r><w:br/></w:r>';
    if (r.anh) {
        var id = anh.them(r.anh);
        if (!id) return '';
        var cx = Math.round((r.rong || 26) * 36000), cy = Math.round((r.cao || 20) * 36000);
        return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
            '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id.n + '" name="Anh' + id.n + '"/>' +
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
            '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:nvPicPr><pic:cNvPr id="' + id.n + '" name="Anh' + id.n + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
            '<pic:blipFill><a:blip r:embed="' + id.rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
            '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }
    var k = r.k || {};
    var pr = '<w:rPr>' +
        '<w:rFonts w:ascii="' + xmlEsc(k.font) + '" w:hAnsi="' + xmlEsc(k.font) + '" w:cs="' + xmlEsc(k.font) + '"/>' +
        (k.dam ? '<w:b/>' : '') + (k.ngh ? '<w:i/>' : '') + (k.gach ? '<w:u w:val="single"/>' : '') +
        '<w:color w:val="' + (k.mau || '000000') + '"/>' +
        '<w:sz w:val="' + Math.round((k.co || 13) * 2) + '"/><w:szCs w:val="' + Math.round((k.co || 13) * 2) + '"/>' +
        '</w:rPr>';
    return '<w:r>' + pr + '<w:t xml:space="preserve">' + xmlEsc(r.t) + '</w:t></w:r>';
}
function docxDoan(d, anh, themPr) {
    var pr = '<w:pPr>' +
        (d.can && d.can !== 'left' ? '<w:jc w:val="' + d.can + '"/>' : '') +
        '<w:spacing w:before="' + Math.round((d.truoc || 0) * 20) + '" w:after="' +
            Math.round((d.sau || 0) * 20) + '" w:line="264" w:lineRule="auto"/>' +
        (d.thut ? '<w:ind w:left="' + tw(d.thut) + '"/>' : '') +
        (themPr || '') + '</w:pPr>';
    return '<w:p>' + pr + (d.runs || []).map(function (r) { return docxRun(r, anh); }).join('') + '</w:p>';
}
/** Đường viền bốn cạnh của MỘT Ô — dùng cho ô có viền riêng (đường chấm dưới
    ô giá trị của chứng từ kế toán…). */
function docxVien4(v4) {
    if (!v4) return '';
    function canh(ten, v) {
        if (!v) return '';
        return '<w:' + ten + ' w:val="' + (v.kieu === 'dotted' ? 'dotted' : v.kieu === 'dashed' ? 'dashed' : 'single') +
               '" w:sz="' + (v.day || 4) + '" w:space="0" w:color="' + (v.mau || '000000') + '"/>';
    }
    var noi = canh('top', v4.tren) + canh('left', v4.trai) + canh('bottom', v4.duoi) + canh('right', v4.phai);
    return noi ? '<w:tcBorders>' + noi + '</w:tcBorders>' : '';
}
function docxBang(b, anh, rongMm) {
    var tong = b.cot.reduce(function (a, c) { return a + c; }, 0) || rongMm;
    var choTrai = Math.max(0, Math.min(b.trai || 0, rongMm - 10));
    var heSo = tong > 0 ? Math.min(1, (rongMm - choTrai) / tong) : 1;
    var cot = b.cot.map(function (c) { return tw(c * heSo); });
    var kv = b.vien && b.vien.co && !b.khongVien;
    var vienXml = kv
        ? '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (x) {
              return '<w:' + x + ' w:val="single" w:sz="' + (b.vien.day || 8) + '" w:space="0" w:color="' +
                     (b.vien.mau || '000000') + '"/>';
          }).join('') + '</w:tblBorders>'
        : '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (x) {
              return '<w:' + x + ' w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
          }).join('') + '</w:tblBorders>';
    /* Lề trong ô đặt ĐÚNG bằng phần đệm của bản in (bề rộng cột đã đo gồm cả
       đệm). Nếu để lề mặc định của Word (1,9mm mỗi bên) thì phần chữ hẹp hơn
       bản in gần 4mm mỗi ô — cột số sẽ thiếu chỗ và con số bị gãy làm đôi. */
    var demT = b.khongVien ? 0 : ((b.dem && b.dem.trai) || 1.6);
    var demP = b.khongVien ? 0 : ((b.dem && b.dem.phai) || 1.6);
    var marXml = '<w:tblCellMar>' +
        '<w:top w:w="20" w:type="dxa"/><w:left w:w="' + tw(demT) + '" w:type="dxa"/>' +
        '<w:bottom w:w="20" w:type="dxa"/><w:right w:w="' + tw(demP) + '" w:type="dxa"/>' +
        '</w:tblCellMar>';
    /* Khối canh phải (ô "Quyển số / Số / Nợ / Có", khối tổng cộng…) giữ đúng
       vị trí bằng thụt lề trái của bảng. */
    var indXml = choTrai > 0.5 ? '<w:tblInd w:w="' + tw(choTrai) + '" w:type="dxa"/>' : '';
    var h = '<w:tbl><w:tblPr><w:tblW w:w="' + cot.reduce(function (a, c) { return a + c; }, 0) +
            '" w:type="dxa"/>' + indXml + '<w:tblLayout w:type="fixed"/>' + vienXml + marXml + '</w:tblPr>' +
            '<w:tblGrid>' + cot.map(function (c) { return '<w:gridCol w:w="' + c + '"/>'; }).join('') + '</w:tblGrid>';
    b.rows.forEach(function (r) {
        h += '<w:tr>' + (r.tieu ? '<w:trPr><w:tblHeader/></w:trPr>' : '');
        var vt = 0;
        r.o.forEach(function (o) {
            var w = 0;
            for (var i = 0; i < o.colspan; i++) w += cot[vt + i] || 0;
            vt += o.colspan;
            /* Ô nối tiếp của một ô gộp dọc ở dòng trên */
            if (o.tiep) {
                h += '<w:tc><w:tcPr><w:tcW w:w="' + (w || 1000) + '" w:type="dxa"/>' +
                     '<w:vMerge/></w:tcPr><w:p/></w:tc>';
                return;
            }
            var pr = '<w:tcPr><w:tcW w:w="' + (w || 1000) + '" w:type="dxa"/>' +
                (o.colspan > 1 ? '<w:gridSpan w:val="' + o.colspan + '"/>' : '') +
                (o.rowspan > 1 ? '<w:vMerge w:val="restart"/>' : '') +
                docxVien4(o.vien4) +
                (o.nen ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.nen + '"/>' : '') +
                /* Ô số và ô nhãn một dòng không được gãy chữ làm đôi */
                (o.so || o.giuDong ? '<w:noWrap/>' : '') +
                (o.doc === 'center' ? '<w:vAlign w:val="center"/>' : '') + '</w:tcPr>';
            var noi = o.khoi
                ? o.khoi.map(function (d) { return docxDoan(d, anh); }).join('')
                : docxDoan({ runs: o.runs || [], can: o.can, truoc: 0, sau: 0 }, anh);
            h += '<w:tc>' + pr + (noi || '<w:p/>') + '</w:tc>';
        });
        h += '</w:tr>';
    });
    /* Đoạn đệm sau bảng: bảng có đường kẻ giữ một dòng trống như cũ; các khối
       xếp ngang (nhãn — giá trị) dùng đoạn đệm THẬT MẢNH để các dòng liền
       nhau đúng như trên bản in, không hở khoảng trắng lớn. */
    var demSau = b.khongVien
        ? '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="40" w:lineRule="exact"/>' +
          '<w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>'
        : '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>';
    return h + '</w:tbl>' + demSau;
}

/** Xuất một bản in HTML ra tệp Word (.docx) đúng biểu mẫu. */
W.xuatWordTuBanIn = function (html, tenTep) {
    var p = phanTich(html);
    var media = [], soAnh = 0, dsAnh = {};
    var anh = { them: function (src) {
        if (!src || src.indexOf('data:') !== 0) return null;
        if (dsAnh[src]) return dsAnh[src];
        var m = /^data:([^;]+);base64,(.*)$/.exec(src);
        if (!m) return null;
        var du = b64SangByte(m[2]);
        if (!du || !du.length) return null;
        soAnh++;
        var duoi = m[1].indexOf('png') >= 0 ? 'png' : m[1].indexOf('gif') >= 0 ? 'gif' : 'jpeg';
        var ten = 'image' + soAnh + '.' + duoi;
        media.push({ ten: ten, du: du, kieu: duoi });
        var o = { n: 100 + soAnh, rid: 'rIdImg' + soAnh, ten: ten };
        dsAnh[src] = o;
        return o;
    } };

    var than = p.than.map(function (b) {
        if (b.loai === 'ngat') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        if (b.loai === 'bang') return docxBang(b, anh, p.rongMm);
        return docxDoan(b, anh);
    }).join('');

    var chan = p.chan.map(function (b) {
        if (b.loai === 'bang') return docxBang(b, anh, p.rongMm);
        return docxDoan(b, anh);
    }).join('') +
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>' +
    '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="555555"/></w:rPr><w:t xml:space="preserve">Trang </w:t></w:r>' +
    '<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>' +
    '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="555555"/></w:rPr><w:t xml:space="preserve"> / </w:t></w:r>' +
    '<w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p>';

    var rongTrang = p.land ? 297 : 210, caoTrang = p.land ? 210 : 297;
    var sect = '<w:sectPr><w:footerReference w:type="default" r:id="rIdFoot"/>' +
        '<w:pgSz w:w="' + tw(rongTrang) + '" w:h="' + tw(caoTrang) + '"' + (p.land ? ' w:orient="landscape"' : '') + '/>' +
        '<w:pgMar w:top="' + tw(p.le.tren) + '" w:right="' + tw(p.le.phai) + '" w:bottom="' + tw(p.le.duoi) +
        '" w:left="' + tw(p.le.trai) + '" w:header="708" w:footer="566" w:gutter="0"/></w:sectPr>';

    var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    var z = new Zip();
    z.them('[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
        '<Default Extension="gif" ContentType="image/gif"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
        '</Types>');
    z.them('_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>');
    z.them('word/_rels/document.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '<Relationship Id="rIdFoot" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
        media.map(function (m, i) {
            return '<Relationship Id="rIdImg' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + m.ten + '"/>';
        }).join('') + '</Relationships>');
    z.them('word/styles.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:styles ' + NS + '><w:docDefaults><w:rPrDefault><w:rPr>' +
        '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
        '<w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:rPrDefault>' +
        '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
        '</w:docDefaults></w:styles>');
    z.them('word/footer1.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '>' + chan + '</w:ftr>');
    z.them('word/document.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document ' + NS + '><w:body>' + than + sect + '</w:body></w:document>');
    media.forEach(function (m) { z.them('word/media/' + m.ten, m.du); });

    taiVe(z.tao('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          (tenTep || 'BieuMau') + '.docx');
    UI.toast('ok', 'Đã xuất Word theo biểu mẫu', (tenTep || '') + '.docx');
};

/* ==========================================================================
   4. SINH TỆP EXCEL BIỂU MẪU (.xlsx)
   ========================================================================== */
function colTen(i) {
    var s = '';
    i++;
    while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
    return s;
}
function KhoBut() {
    this.font = []; this.fill = []; this.border = []; this.xf = [];
    this.mFont = {}; this.mFill = {}; this.mBorder = {}; this.mXf = {};
    this.font.push('<font><sz val="13"/><color rgb="FF000000"/><name val="Times New Roman"/></font>');
    this.mFont['mac-dinh'] = 0;
    this.fill.push('<fill><patternFill patternType="none"/></fill>');
    this.fill.push('<fill><patternFill patternType="gray125"/></fill>');
    this.mFill['khong'] = 0;
    this.border.push('<border><left/><right/><top/><bottom/><diagonal/></border>');
    this.mBorder['khong'] = 0;
    this.xf.push('<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>');
    this.mXf['0|0|0|left|top|0|0'] = 0;
}
KhoBut.prototype.iFont = function (k) {
    var key = [k.font, k.co, k.dam, k.ngh, k.gach, k.mau].join('|');
    if (this.mFont[key] !== undefined) return this.mFont[key];
    this.font.push('<font><sz val="' + (k.co || 13) + '"/><color rgb="FF' + (k.mau || '000000') + '"/>' +
        '<name val="' + xmlEsc(k.font || 'Times New Roman') + '"/>' +
        (k.dam ? '<b/>' : '') + (k.ngh ? '<i/>' : '') + (k.gach ? '<u/>' : '') + '</font>');
    return (this.mFont[key] = this.font.length - 1);
};
KhoBut.prototype.iFill = function (nen) {
    if (!nen) return 0;
    if (this.mFill[nen] !== undefined) return this.mFill[nen];
    this.fill.push('<fill><patternFill patternType="solid"><fgColor rgb="FF' + nen + '"/>' +
                   '<bgColor indexed="64"/></patternFill></fill>');
    return (this.mFill[nen] = this.fill.length - 1);
};
KhoBut.prototype.iBorder = function (v) {
    if (!v || !v.co) return 0;
    var key = 'v' + (v.mau || '000000') + (v.day || 8);
    if (this.mBorder[key] !== undefined) return this.mBorder[key];
    var s = (v.day || 8) >= 12 ? 'medium' : 'thin';
    var c = '<color rgb="FF' + (v.mau || '000000') + '"/>';
    this.border.push('<border><left style="' + s + '">' + c + '</left><right style="' + s + '">' + c +
        '</right><top style="' + s + '">' + c + '</top><bottom style="' + s + '">' + c +
        '</bottom><diagonal/></border>');
    return (this.mBorder[key] = this.border.length - 1);
};
/** Đường viền theo TỪNG CẠNH (giữ nét chấm / gạch) cho các ô của khối xếp ngang. */
KhoBut.prototype.iBorder4 = function (v4) {
    if (!v4) return 0;
    function kieu(v) {
        if (!v) return '';
        if (v.kieu === 'dotted') return 'dotted';
        if (v.kieu === 'dashed') return 'dashed';
        return (v.day || 4) >= 12 ? 'medium' : 'thin';
    }
    function canh(ten, v) {
        if (!v) return '<' + ten + '/>';
        return '<' + ten + ' style="' + kieu(v) + '"><color rgb="FF' + (v.mau || '000000') + '"/></' + ten + '>';
    }
    var key = 'v4' + ['tren', 'duoi', 'trai', 'phai'].map(function (k) {
        var v = v4[k]; return v ? (v.kieu || 's') + (v.day || 4) + (v.mau || '') : '-';
    }).join('|');
    if (this.mBorder[key] !== undefined) return this.mBorder[key];
    this.border.push('<border>' + canh('left', v4.trai) + canh('right', v4.phai) +
        canh('top', v4.tren) + canh('bottom', v4.duoi) + '<diagonal/></border>');
    return (this.mBorder[key] = this.border.length - 1);
};
/* Word gọi căn đều hai bên là "both", Excel gọi là "justify". Ghi thẳng giá
   trị của Word vào tệp Excel sẽ làm hỏng bảng định dạng và Excel không mở
   được tệp. Vì vậy luôn chuyển tên trước khi ghi. */
var CAN_EXCEL = { both: 'justify', justify: 'justify', center: 'center',
                  right: 'right', left: 'left', start: 'left', end: 'right' };
KhoBut.prototype.iXf = function (fo, fi, bo, can, doc, wrap, numFmt) {
    can = CAN_EXCEL[can] || 'left';
    var key = [fo, fi, bo, can, doc, wrap ? 1 : 0, numFmt || 0].join('|');
    if (this.mXf[key] !== undefined) return this.mXf[key];
    this.xf.push('<xf numFmtId="' + (numFmt || 0) + '" fontId="' + fo + '" fillId="' + fi +
        '" borderId="' + bo + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"' +
        (numFmt ? ' applyNumberFormat="1"' : '') + '>' +
        '<alignment horizontal="' + can + '" vertical="' + (doc === 'center' ? 'center' : 'top') + '"' +
        (wrap ? ' wrapText="1"' : '') + '/></xf>');
    return (this.mXf[key] = this.xf.length - 1);
};

/** Xuất một bản in HTML ra tệp Excel (.xlsx) giữ đúng biểu mẫu. */
W.xuatExcelBieuMauTuBanIn = function (html, tenTep) {
    var p = phanTich(html);
    var kb = new KhoBut();
    var o = [], gop = [], caoDong = [], dsAnhXls = [];

    /* ------------------------------------------------------------------
       LƯỚI CỘT HỢP NHẤT
       Trang giấy có nhiều khối bề rộng khác nhau: đầu trang khung kẻ ô,
       bảng hàng hóa chín cột, ô "Quyển số / Số" canh phải… Excel chỉ có MỘT
       lưới cột chung, nên gom mọi mép cột của mọi khối thành một bộ mốc; mỗi
       ô của từng khối chiếm đúng dải cột của nó (gộp ô) — bố cục, bề rộng và
       vị trí các khối giữ đúng như bản in, các khối không làm lệch nhau nữa.
       ------------------------------------------------------------------ */
    var moc = [0, Math.max(10, p.rongMm)];
    function themMoc(x) {
        if (!(x > 0)) return;
        for (var i = 0; i < moc.length; i++) if (Math.abs(moc[i] - x) < 1.2) return;
        moc.push(x);
    }
    p.than.concat(p.chan).forEach(function (b) {
        if (b.loai !== 'bang') return;
        var x = b.trai || 0;
        themMoc(x);
        b.cot.forEach(function (w) { x += w; themMoc(x); });
    });
    moc.sort(function (a, b2) { return a - b2; });
    var nCot = Math.max(1, moc.length - 1);
    function timCot(x) {
        var tot = 0, lech = 1e9;
        for (var i = 0; i < moc.length; i++) {
            var d = Math.abs(moc[i] - x);
            if (d < lech) { lech = d; tot = i; }
        }
        return tot;
    }
    var rongCot = [];
    for (var ic = 0; ic < nCot; ic++)
        rongCot[ic] = Math.max(2, Math.round((moc[ic + 1] - moc[ic]) / 2.05));

    function chuoi(runs) {
        return (runs || []).map(function (r) { return r.br ? '\n' : (r.anh ? '' : r.t); })
            .join('').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim();
    }
    function kieuDau(runs) {
        for (var i = 0; i < (runs || []).length; i++) if (runs[i].k) return runs[i].k;
        return { font: 'Times New Roman', co: 13, mau: '000000' };
    }
    /* Ảnh trên bản in (logo, con dấu, chữ ký) neo vào đúng ô Excel đang dựng. */
    function nhatAnh(runs, r, c) {
        (runs || []).forEach(function (x) {
            if (x.anh && x.anh.indexOf('data:') === 0)
                dsAnhXls.push({ r: r, c: c, src: x.anh, rong: x.rong || 24, cao: x.cao || 16 });
        });
    }
    function nhatAnhO(x, r, c) {
        if (x.khoi) x.khoi.forEach(function (d) { nhatAnh(d.runs, r, c); });
        else nhatAnh(x.runs, r, c);
    }
    function themDoan(d, cao) {
        var k = kieuDau(d.runs);
        var t = chuoi(d.runs);
        var xf = kb.iXf(kb.iFont(k), 0, 0, d.can || 'left', 'top', true, 0);
        nhatAnh(d.runs, o.length, 0);
        // mỗi dòng văn bản là một dòng Excel để giữ đúng bố cục bản in
        t.split('\n').forEach(function (dg) {
            o.push([{ v: dg, s: xf }]);
            if (nCot > 1) gop.push({ r: o.length - 1, c1: 0, c2: nCot - 1 });
            if (cao) caoDong.push({ r: o.length - 1, h: cao });
        });
        if (!t && d.runs && d.runs.some(function (x) { return x.anh; })) o.push([]);
    }
    function themBang(b) {
        b.rows.forEach(function (r) {
            var dong = [];                             // dựng theo chỉ số cột lưới
            var x = b.trai || 0;
            var iCell = 0;
            r.o.forEach(function (x2) {
                var w = 0;
                for (var i = 0; i < x2.colspan; i++) w += b.cot[iCell + i] || 0;
                iCell += x2.colspan;
                var c1 = timCot(x), c2 = Math.max(c1 + 1, timCot(x + w));
                x += w;
                /* Ô nối tiếp của ô gộp dọc: chỉ giữ chỗ, vùng gộp đã khai ở dòng đầu */
                if (x2.tiep) return;
                if (c1 >= c2) return;
                var k = x2.khoi ? kieuDau(x2.khoi[0] && x2.khoi[0].runs) : kieuDau(x2.runs);
                var t = x2.khoi ? x2.khoi.map(function (d) { return chuoi(d.runs); }).filter(Boolean).join('\n')
                               : chuoi(x2.runs);
                var so = x2.so && t !== '' && !isNaN(T.so(t));
                var bo = b.khongVien ? kb.iBorder4(x2.vien4) : kb.iBorder(x2.vien);
                var xf = kb.iXf(kb.iFont(k), kb.iFill(x2.nen), bo,
                                x2.can || 'left', x2.doc, true, so ? 164 : 0);
                nhatAnhO(x2, o.length, c1);
                dong[c1] = so ? { v: T.so(t), n: true, s: xf } : { v: t, s: xf };
                for (var ci = c1 + 1; ci < c2; ci++) dong[ci] = { v: '', s: xf };
                if (c2 - c1 > 1 || x2.rowspan > 1)
                    gop.push({ r: o.length, c1: c1, c2: c2 - 1, r2: o.length + (x2.rowspan || 1) - 1 });
            });
            o.push(dong);
            if (r.o[0] && !r.o[0].tiep && r.o[0].cao > 14)
                caoDong.push({ r: o.length - 1, h: Math.min(60, r.o[0].cao) });
        });
        if (!b.khongVien) o.push([]);
    }

    p.than.forEach(function (b) {
        if (b.loai === 'ngat') { o.push([]); return; }
        if (b.loai === 'bang') { themBang(b); return; }
        themDoan(b);
    });
    if (p.chan.length) {
        o.push([]);
        p.chan.forEach(function (b) { if (b.loai === 'bang') themBang(b); else themDoan(b); });
    }
    var soCot = nCot;

    /* ---- sheet XML ---- */
    var haiSo = '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>';
    var sd = '';
    o.forEach(function (dong, r) {
        var cao = caoDong.filter(function (x) { return x.r === r; })[0];
        var oXml = '';
        (dong || []).forEach(function (c, i) {
            if (!c) return;
            var ref = colTen(i) + (r + 1);
            if (c.n) oXml += '<c r="' + ref + '" s="' + c.s + '"><v>' + c.v + '</v></c>';
            else if (c.v === '' || c.v === undefined) oXml += '<c r="' + ref + '" s="' + c.s + '"/>';
            else oXml += '<c r="' + ref + '" s="' + c.s + '" t="inlineStr"><is><t xml:space="preserve">' +
                         xmlEsc(c.v) + '</t></is></c>';
        });
        sd += '<row r="' + (r + 1) + '"' + (cao ? ' ht="' + cao.h + '" customHeight="1"' : '') + '>' + oXml + '</row>';
    });
    var soDong = o.length, soCotHet = Math.max(soCot, 1);
    var vungIn = 'A1:' + colTen(soCotHet - 1) + soDong;
    var gopXml = gop.length
        ? '<mergeCells count="' + gop.length + '">' + gop.map(function (g) {
              return '<mergeCell ref="' + colTen(g.c1) + (g.r + 1) + ':' + colTen(g.c2) + ((g.r2 || g.r) + 1) + '"/>';
          }).join('') + '</mergeCells>' : '';
    var colsXml = rongCot.length
        ? '<cols>' + rongCot.map(function (w, i) {
              return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (w || 12) + '" customWidth="1"/>';
          }).join('') + '</cols>' : '';

    /* ---- Ảnh nhúng (logo, con dấu, chữ ký) — vẽ qua phần drawing của Excel ---- */
    var mediaXls = [], neo = [];
    dsAnhXls.forEach(function (a) {
        var m = /^data:([^;]+);base64,(.*)$/.exec(a.src);
        if (!m) return;
        var du = b64SangByte(m[2]);
        if (!du || !du.length) return;
        var duoi = m[1].indexOf('png') >= 0 ? 'png' : m[1].indexOf('gif') >= 0 ? 'gif' : 'jpeg';
        mediaXls.push({ ten: 'image' + (mediaXls.length + 1) + '.' + duoi, du: du });
        neo.push({ r: a.r, c: a.c, rid: 'rIdA' + mediaXls.length,
                   cx: Math.max(1, Math.round(a.rong * 36000)), cy: Math.max(1, Math.round(a.cao * 36000)) });
    });
    var coAnh = neo.length > 0;

    var z = new Zip();
    z.them('[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
        '<Default Extension="gif" ContentType="image/gif"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        (coAnh ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '') +
        '</Types>');
    z.them('_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>');
    z.them('xl/_rels/workbook.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>');
    z.them('xl/workbook.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Bieu mau" sheetId="1" r:id="rId1"/></sheets>' +
        '<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">' +
        "'Bieu mau'!$A$1:$" + colTen(soCotHet - 1) + '$' + soDong + '</definedName></definedNames>' +
        '</workbook>');
    z.them('xl/styles.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + haiSo +
        '<fonts count="' + kb.font.length + '">' + kb.font.join('') + '</fonts>' +
        '<fills count="' + kb.fill.length + '">' + kb.fill.join('') + '</fills>' +
        '<borders count="' + kb.border.length + '">' + kb.border.join('') + '</borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="' + kb.xf.length + '">' + kb.xf.join('') + '</cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>');
    z.them('xl/worksheets/sheet1.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
        (coAnh ? ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' : '') + '>' +
        '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
        '<dimension ref="' + vungIn + '"/>' +
        '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' +
        '<sheetFormatPr defaultRowHeight="15"/>' + colsXml +
        '<sheetData>' + sd + '</sheetData>' + gopXml +
        '<printOptions horizontalCentered="1"/>' +
        '<pageMargins left="' + (p.le.trai / 25.4).toFixed(2) + '" right="' + (p.le.phai / 25.4).toFixed(2) +
        '" top="' + (p.le.tren / 25.4).toFixed(2) + '" bottom="' + (p.le.duoi / 25.4).toFixed(2) +
        '" header="0.3" footer="0.3"/>' +
        '<pageSetup paperSize="9" orientation="' + (p.land ? 'landscape' : 'portrait') +
        '" fitToWidth="1" fitToHeight="0"/>' +
        '<headerFooter><oddFooter>&amp;CTrang &amp;P / &amp;N</oddFooter></headerFooter>' +
        (coAnh ? '<drawing r:id="rIdDr"/>' : '') +
        '</worksheet>');
    if (coAnh) {
        z.them('xl/worksheets/_rels/sheet1.xml.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rIdDr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
            '</Relationships>');
        z.them('xl/drawings/drawing1.xml',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
            'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            neo.map(function (a, i) {
                return '<xdr:oneCellAnchor>' +
                    '<xdr:from><xdr:col>' + a.c + '</xdr:col><xdr:colOff>19050</xdr:colOff>' +
                    '<xdr:row>' + a.r + '</xdr:row><xdr:rowOff>19050</xdr:rowOff></xdr:from>' +
                    '<xdr:ext cx="' + a.cx + '" cy="' + a.cy + '"/>' +
                    '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + (i + 2) + '" name="Anh' + (i + 1) + '"/>' +
                    '<xdr:cNvPicPr/></xdr:nvPicPr>' +
                    '<xdr:blipFill><a:blip r:embed="' + a.rid + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
                    '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + a.cx + '" cy="' + a.cy + '"/></a:xfrm>' +
                    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>' +
                    '<xdr:clientData/></xdr:oneCellAnchor>';
            }).join('') + '</xdr:wsDr>');
        z.them('xl/drawings/_rels/drawing1.xml.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            neo.map(function (a, i) {
                return '<Relationship Id="' + a.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + mediaXls[i].ten + '"/>';
            }).join('') + '</Relationships>');
        mediaXls.forEach(function (m) { z.them('xl/media/' + m.ten, m.du); });
    }

    taiVe(z.tao('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
          (tenTep || 'BieuMau') + '.xlsx');
    UI.toast('ok', 'Đã xuất Excel theo biểu mẫu', (tenTep || '') + '.xlsx — giữ nguyên bố cục, ô gộp, ' +
        'đường kẻ, phông chữ, màu sắc, vùng in và khổ giấy.');
};

/* ==========================================================================
   5. CỬA NGÕ DÙNG CHUNG
   ========================================================================== */
/** Xuất Word cho một chứng từ theo đúng mẫu in đang chọn. */
W.xuatWordChungTu = function (key, r) {
    var x = T.clone(r);
    var html = W.inChungTuHTML(key, x);
    var ten = ((W.TIEU_DE_IN || {})[key] || 'ChungTu') + '_' + (r.so || '');
    W.xuatWordTuBanIn(html, T.kd(ten).replace(/[^a-zA-Z0-9]+/g, '_'));
};
/** Xuất Excel biểu mẫu cho một chứng từ theo đúng mẫu in đang chọn. */
W.xuatExcelMauChungTu = function (key, r) {
    var x = T.clone(r);
    var html = W.inChungTuHTML(key, x);
    var ten = ((W.TIEU_DE_IN || {})[key] || 'ChungTu') + '_' + (r.so || '');
    W.xuatExcelBieuMauTuBanIn(html, T.kd(ten).replace(/[^a-zA-Z0-9]+/g, '_'));
};

/* Thay bộ xuất Excel biểu mẫu cũ (chỉ đổ chữ, không định dạng) bằng bộ mới,
   để mọi lối gọi trong hệ thống đều cho ra tệp đúng biểu mẫu doanh nghiệp. */
W.excelBieuMau = function (key, r) { W.xuatExcelMauChungTu(key, r); };

})(window);
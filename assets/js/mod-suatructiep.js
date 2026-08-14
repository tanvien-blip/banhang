/* ==========================================================================
   SỬA TRỰC TIẾP TRÊN BẢN IN  (EDIT MODE)
   --------------------------------------------------------------------------
   Bấm "Sửa chứng từ" ở thanh xem trước là chính bản in đang xem chuyển sang
   chế độ soạn thảo — KHÔNG mở popup, KHÔNG mở cửa sổ phía sau, KHÔNG sửa qua
   ô textarea. Người dùng gõ thẳng lên trang giấy đang nhìn thấy, giống
   Microsoft Word Online / Google Docs.

   NGUYÊN TẮC
     1. WYSIWYG  — soạn thảo ngay trên đúng khối DOM mà bản in, PDF, Word và
                   Excel dùng. Không có bản dựng thứ hai.
     2. Không đụng biểu mẫu — bản đã sửa lưu trong CHÍNH chứng từ đó
                   (trường banInRieng). Biểu mẫu chuẩn, loại hợp đồng trong
                   danh mục và các chứng từ khác không hề thay đổi.
     3. Quay lại được — luôn có "Khôi phục theo biểu mẫu chuẩn" để bỏ toàn bộ
                   phần sửa tay và dựng lại từ dữ liệu.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI;

/* Trạng thái chế độ sửa đang mở (mỗi lúc chỉ có một). */
var CD = null;

/* --------------------------------------------------------------------------
   CÁC VÙNG CỦA MỘT BẢN IN — dùng cho bảng điều khiển đường viền.
   Người dùng bật / tắt khung theo TỪNG VÙNG, không phải tất cả hoặc không gì.
   -------------------------------------------------------------------------- */
var VUNG = [
    { k: 'dau',  t: 'Đầu trang',
      mo: 'Khối tên đơn vị, logo, quốc hiệu ở đầu trang',
      sel: '.pr-head, table.pr-dnk, table.pr-cv, .pr-ntdau, .pr-ktdau' },
    { k: 'ben',  t: 'Khối thông tin các bên',
      mo: 'Khối Bên mua — Bên bán, Bên A — Bên B',
      sel: '.pr-card, table.pr-khung, .pr-hdben, .pr-ntben, .pr-ben, .pr-dl' },
    { k: 'bang', t: 'Bảng dữ liệu',
      mo: 'Bảng hàng hóa, bảng khối lượng, bảng số tiền',
      sel: 'table.pr-tb, table.pr-sotien' },
    { k: 'noi',  t: 'Điều khoản và nội dung mô tả',
      mo: 'Các điều, khoản, điểm, đoạn văn, gạch đầu dòng',
      sel: '.pr-muc, .pr-muc2, .pr-l, .pr-gach, .pr-hdmuc, .pr-hdkhoan, ' +
           '.pr-hddiem, .pr-dieu, .pr-chu, .pr-luuy, .pr-note, .pr-cvthan' },
    { k: 'ky',   t: 'Khối chữ ký',
      mo: 'Ô ký của hai bên ở cuối văn bản',
      sel: '.pr-kydn, .pr-sign, .pr-cvky, .pr-ktky' },
    { k: 'chan', t: 'Chân trang',
      mo: 'Dòng chân trang: tên đơn vị, số chứng từ, ngày in',
      sel: '.pr-foot' }
];
W.VUNG_KHUNG = VUNG;

/* ==========================================================================
   RANH GIỚI TRANG GIẤY TRÊN BẢN XEM TRƯỚC
   --------------------------------------------------------------------------
   Bản xem trước phải cho thấy ĐÚNG chỗ sang trang của bản in và tệp PDF.
   Hàm dưới đây chạy đúng cách trình duyệt ngắt trang: đi lần lượt từng khối
   của trang giấy (bảng thì đi từng dòng), khối nào không lọt nốt trang hiện
   tại thì đẩy trọn sang trang sau — giống hệt quy tắc "không cắt đôi khối"
   đang khai trong tệp print.css.
   ========================================================================== */
var CAO_A4 = 297;      /* mm */

function mmSangPx(mm) { return mm * 96 / 25.4; }

/**
 * Các khối nguyên vẹn theo thứ tự in — bảng dài được tách thành từng dòng.
 * Bảng có dòng tiêu đề (thead) thì tiêu đề LẶP LẠI ở đầu mỗi trang; dòng
 * tổng (tfoot) chỉ in MỘT LẦN ở cuối bảng (đúng như print.css đang khai) —
 * chiều cao dòng tiêu đề được đo sẵn ở đây.
 */
function donVi(to) {
    var ds = [];
    Array.prototype.forEach.call(to.children, function (el) {
        if (el.classList && (el.classList.contains('pr-foot') ||
                             el.classList.contains('pr-ranh'))) return;
        var tb = el.tagName === 'TABLE' ? el : null;
        if (!tb && el.children.length === 1 && el.firstElementChild.tagName === 'TABLE')
            tb = el.firstElementChild;
        if (tb && tb.rows.length > 3) {
            var dau = tb.querySelector('thead');
            var caoDau = dau ? dau.getBoundingClientRect().height : 0;
            var caoChan = tb.tFoot ? tb.tFoot.getBoundingClientRect().height : 0;
            Array.prototype.forEach.call(tb.tBodies, function (tbo) {
                Array.prototype.forEach.call(tbo.rows, function (tr) {
                    ds.push({ el: tr, bang: tb, caoDau: caoDau, caoChan: caoChan });
                });
            });
            Array.prototype.forEach.call(tb.tFoot ? tb.tFoot.rows : [], function (tr) {
                ds.push({ el: tr, bang: tb, caoDau: caoDau, chan: true });
            });
            return;
        }
        ds.push({ el: el });
    });
    return ds;
}

/**
 * Tính các mốc sang trang của một trang giấy.
 * Trả về mảng vị trí (px, tính từ mép trên khối nội dung) và số trang.
 */
W.mocSangTrang = function (to) {
    var cs = getComputedStyle(to);
    var padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
    var caoTrang = mmSangPx(CAO_A4) - padT - padB;
    if (to.classList.contains('landscape')) caoTrang = mmSangPx(210) - padT - padB;
    var goc = to.getBoundingClientRect().top + padT;
    var ds = donVi(to), moc = [], batDau = 0;
    ds.forEach(function (u) {
        var r = u.el.getBoundingClientRect();
        var tren = r.top - goc, duoi = r.bottom - goc;
        /* Dòng tổng (tfoot) chỉ in MỘT LẦN ở cuối bảng (print.css đặt tfoot
           là table-row-group) nên KHÔNG còn giữ chỗ ở cuối mỗi trang nữa —
           trần trang là trọn chiều cao vùng in. */
        var tran = batDau + caoTrang;
        if (duoi <= tran + 0.5) return;                     // còn lọt trang hiện tại
        if (tren > batDau + 0.5) {                          // đẩy trọn khối sang trang sau
            moc.push(tren);
            batDau = tren - (u.bang ? (u.caoDau || 0) : 0); // trang sau lặp lại dòng tiêu đề
        } else {                                            // khối cao hơn cả một trang
            moc.push(tran);
            batDau = tran;
        }
    });
    return { moc: moc, soTrang: moc.length + 1, caoTrang: caoTrang, padT: padT };
};

/** Vẽ đường ranh giới trang lên bản xem trước (chỉ hiện trên màn hình). */
W.veRanhTrang = function () {
    var tong = 0;
    cacTo().forEach(function (to) {
        Array.prototype.forEach.call(to.querySelectorAll('.pr-ranh'), function (e) { e.remove(); });
        if (getComputedStyle(to).position === 'static') to.style.position = 'relative';
        var kq = W.mocSangTrang(to);
        kq.moc.forEach(function (y, i) {
            var d = document.createElement('div');
            d.className = 'pr-ranh';
            d.setAttribute('contenteditable', 'false');
            d.style.top = (kq.padT + y) + 'px';
            d.innerHTML = '<span>Hết trang ' + (i + 1) + '</span>';
            to.appendChild(d);
        });
        tong += kq.soTrang;
    });
    return tong;
};
/** Tổng số trang giấy của bản in đang xem. */
W.soTrangXemTruoc = function () {
    return cacTo().reduce(function (a, t) { return a + W.mocSangTrang(t).soTrang; }, 0);
};

/* --------------------------------------------------------------------------
   TIỆN ÍCH
   -------------------------------------------------------------------------- */
function cacTo() {
    var a = document.getElementById('prArea');
    return a ? Array.prototype.slice.call(a.querySelectorAll('.print-sheet, .pr-page')) : [];
}
/** Phần tử đang có con trỏ soạn thảo. */
function oHienTai() {
    var s = window.getSelection();
    if (!s || !s.rangeCount) return null;
    var n = s.getRangeAt(0).startContainer;
    return n.nodeType === 1 ? n : n.parentElement;
}
function len(el, sel) {
    if (!el) return null;
    var e = el.closest ? el.closest(sel) : null;
    return (e && document.getElementById('prArea') &&
            document.getElementById('prArea').contains(e)) ? e : null;
}
function oBang() { return len(oHienTai(), 'td, th'); }
function bangHienTai() { return len(oHienTai(), 'table'); }

/** Khối văn bản đang đứng — dùng cho nút bật/tắt khung của vùng đang chọn. */
function khoiHienTai() {
    var e = oHienTai();
    if (!e) return null;
    var o = len(e, 'td, th');
    if (o) return o;
    var tb = len(e, 'table');
    if (tb) return tb;
    var to = len(e, '.print-sheet, .pr-page');
    if (!to) return null;
    var cur = e;
    while (cur && cur !== to) {
        if (cur.parentElement === to) return cur;
        cur = cur.parentElement;
    }
    return e === to ? null : e;
}

/* --------------------------------------------------------------------------
   ĐƯỜNG VIỀN — đặt bằng kiểu nội tuyến nên theo bản in sang PDF, Word, Excel.
   -------------------------------------------------------------------------- */
var CANH = { tren: 'Top', duoi: 'Bottom', trai: 'Left', phai: 'Right' };

function datVien(el, co, canh) {
    if (!el) return;
    var ds = [el];
    if (el.tagName === 'TABLE')
        ds = ds.concat(Array.prototype.slice.call(el.querySelectorAll('th, td')));
    ds.forEach(function (e) {
        if (!canh) {
            if (co) {
                e.style.border = '0.28mm solid #000';
                e.style.borderTopStyle = 'solid'; e.style.borderBottomStyle = 'solid';
                e.style.borderLeftStyle = 'solid'; e.style.borderRightStyle = 'solid';
            } else {
                e.style.border = 'none';
                e.style.borderTopStyle = 'none'; e.style.borderBottomStyle = 'none';
                e.style.borderLeftStyle = 'none'; e.style.borderRightStyle = 'none';
            }
            return;
        }
        var p = CANH[canh];
        if (co) {
            e.style['border' + p + 'Width'] = '0.28mm';
            e.style['border' + p + 'Style'] = 'solid';
            e.style['border' + p + 'Color'] = '#000';
        } else {
            e.style['border' + p + 'Style'] = 'none';
            e.style['border' + p + 'Width'] = '0';
        }
    });
}
/** Vùng này đang có khung hay không (xét theo bản đang hiển thị thật). */
function dangCoVien(el) {
    if (!el) return false;
    var e = el.tagName === 'TABLE' ? (el.querySelector('td, th') || el) : el;
    var cs = getComputedStyle(e);
    return ['Top', 'Bottom', 'Left', 'Right'].some(function (p) {
        return cs['border' + p + 'Style'] !== 'none' &&
               parseFloat(cs['border' + p + 'Width']) > 0;
    });
}
/** Trạng thái khung của một vùng chuẩn trên bản in đang mở. */
W.trangThaiVung = function (k) {
    var v = VUNG.filter(function (x) { return x.k === k; })[0];
    if (!v) return null;
    var ds = [];
    cacTo().forEach(function (t) {
        ds = ds.concat(Array.prototype.slice.call(t.querySelectorAll(v.sel)));
    });
    if (!ds.length) return null;
    return dangCoVien(ds[0]);
};
/** Bật / tắt khung cho cả một vùng chuẩn của bản in. */
W.datKhungVung = function (k, co) {
    var v = VUNG.filter(function (x) { return x.k === k; })[0];
    if (!v) return 0;
    var n = 0;
    cacTo().forEach(function (t) {
        Array.prototype.forEach.call(t.querySelectorAll(v.sel), function (e) {
            datVien(e, co); n++;
        });
    });
    return n;
};

/**
 * ÁP CẤU HÌNH KHUNG ĐƯỜNG VIỀN (mẫu mặc định người dùng đã lưu) LÊN MỘT BẢN
 * IN dạng chuỗi HTML — dùng khi dựng biểu mẫu chuẩn cho chứng từ MỚI: mẫu đã
 * lưu tự động có mặt ở bản xem trước, bản in, PDF, Word và Excel.
 * cfg = { dau: true/false, ben: ..., bang: ..., noi: ..., ky: ..., chan: ... }
 * Vùng nào không khai trong cfg thì giữ nguyên như biểu mẫu chuẩn.
 */
W.apVienLenHTML = function (html, cfg) {
    if (!cfg) return html;
    try {
        var kho = document.createElement('div');
        kho.innerHTML = html;
        VUNG.forEach(function (v) {
            if (cfg[v.k] === undefined) return;
            Array.prototype.forEach.call(kho.querySelectorAll(v.sel), function (e) {
                datVien(e, !!cfg[v.k]);
            });
        });
        return kho.innerHTML;
    } catch (e) { return html; }
};
/** Trạng thái khung hiện tại của TẤT CẢ các vùng trên bản in đang mở. */
W.trangThaiMoiVung = function () {
    var cfg = {}, co = false;
    VUNG.forEach(function (v) {
        var t = W.trangThaiVung(v.k);
        if (t === null) return;
        cfg[v.k] = !!t; co = true;
    });
    return co ? cfg : null;
};

/* --------------------------------------------------------------------------
   THAO TÁC BẢNG — chèn / xóa dòng, cột; gộp và tách ô, giống Microsoft Word.
   -------------------------------------------------------------------------- */
function chiSoCot(o) {
    var tr = o.parentElement, i = 0;
    for (var k = 0; k < tr.cells.length; k++) {
        if (tr.cells[k] === o) return i;
        i += tr.cells[k].colSpan || 1;
    }
    return i;
}
function oTaiCot(tr, c) {
    var i = 0;
    for (var k = 0; k < tr.cells.length; k++) {
        var w = tr.cells[k].colSpan || 1;
        if (c >= i && c < i + w) return tr.cells[k];
        i += w;
    }
    return null;
}
var BANG = {
    dongTren: function (o) { themDong(o, true); },
    dongDuoi: function (o) { themDong(o, false); },
    cotTrai: function (o) { themCot(o, true); },
    cotPhai: function (o) { themCot(o, false); },
    xoaDong: function (o) {
        var tr = o.parentElement;
        if (tr.parentElement.rows.length <= 1) return 'Bảng phải còn ít nhất một dòng';
        tr.parentElement.removeChild(tr);
    },
    xoaCot: function (o) {
        var tb = o.closest('table'), c = chiSoCot(o);
        var soCot = soCotCua(tb);
        if (soCot <= 1) return 'Bảng phải còn ít nhất một cột';
        Array.prototype.forEach.call(tb.rows, function (tr) {
            var x = oTaiCot(tr, c);
            if (!x) return;
            if ((x.colSpan || 1) > 1) x.colSpan = x.colSpan - 1;
            else if (x.parentElement) x.parentElement.removeChild(x);
        });
        var cg = tb.querySelector('colgroup');
        if (cg && cg.children[c]) cg.removeChild(cg.children[c]);
    },
    gopPhai: function (o) {
        var ke = o.nextElementSibling;
        if (!ke) return 'Ô cuối dòng không gộp sang phải được';
        o.colSpan = (o.colSpan || 1) + (ke.colSpan || 1);
        if (ke.textContent.trim()) o.innerHTML = o.innerHTML + ' ' + ke.innerHTML;
        ke.parentElement.removeChild(ke);
    },
    gopDuoi: function (o) {
        var tr = o.parentElement, sau = tr.nextElementSibling;
        if (!sau) return 'Dòng cuối không gộp xuống dưới được';
        var x = oTaiCot(sau, chiSoCot(o));
        if (!x) return 'Không tìm được ô tương ứng ở dòng dưới';
        o.rowSpan = (o.rowSpan || 1) + (x.rowSpan || 1);
        if (x.textContent.trim()) o.innerHTML = o.innerHTML + ' ' + x.innerHTML;
        x.parentElement.removeChild(x);
    },
    tach: function (o) {
        if ((o.colSpan || 1) > 1) {
            var moi = document.createElement(o.tagName);
            moi.className = o.className;
            moi.innerHTML = '<br>';
            o.colSpan = o.colSpan - 1;
            o.parentElement.insertBefore(moi, o.nextSibling);
            return;
        }
        if ((o.rowSpan || 1) > 1) {
            var tr = o.parentElement.nextElementSibling;
            if (!tr) return 'Không tách được ô này';
            var m2 = document.createElement(o.tagName);
            m2.className = o.className; m2.innerHTML = '<br>';
            var c = chiSoCot(o), truoc = null, i = 0;
            for (var k = 0; k < tr.cells.length; k++) {
                if (i >= c) { truoc = tr.cells[k]; break; }
                i += tr.cells[k].colSpan || 1;
            }
            tr.insertBefore(m2, truoc);
            o.rowSpan = o.rowSpan - 1;
            return;
        }
        return 'Ô này chưa gộp nên không tách được';
    }
};
function soCotCua(tb) {
    var n = 0, tr = tb.rows[0];
    if (!tr) return 0;
    for (var k = 0; k < tr.cells.length; k++) n += tr.cells[k].colSpan || 1;
    return n;
}
function themDong(o, tren) {
    var tr = o.parentElement;
    var moi = tr.cloneNode(true);
    Array.prototype.forEach.call(moi.cells, function (c) {
        c.innerHTML = '<br>';
        c.removeAttribute('rowspan');
    });
    tr.parentElement.insertBefore(moi, tren ? tr : tr.nextSibling);
}
function themCot(o, trai) {
    var tb = o.closest('table'), c = chiSoCot(o);
    Array.prototype.forEach.call(tb.rows, function (tr) {
        var x = oTaiCot(tr, c);
        var moi = document.createElement(x ? x.tagName : 'td');
        if (x) moi.className = x.className;
        moi.innerHTML = '<br>';
        if (x) tr.insertBefore(moi, trai ? x : x.nextSibling);
        else tr.appendChild(moi);
    });
    var cg = tb.querySelector('colgroup');
    if (cg) {
        var col = document.createElement('col');
        var goc = cg.children[c];
        if (goc) cg.insertBefore(col, trai ? goc : goc.nextSibling);
        else cg.appendChild(col);
    }
}
W.thaoTacBang = function (lenh) {
    var o = oBang();
    if (!o) return UI.toast('warn', 'Chưa chọn ô trong bảng',
        'Bấm con trỏ vào một ô của bảng rồi thực hiện lại.');
    var f = BANG[lenh];
    if (!f) return;
    var loi = f(o);
    if (loi) return UI.toast('warn', 'Không thực hiện được', loi);
    danhDau();
    UI.toast('ok', 'Đã cập nhật bảng');
};

/* --------------------------------------------------------------------------
   ĐỊNH DẠNG CHỮ
   -------------------------------------------------------------------------- */
W.dinhDangBanIn = function (lenh, giaTri) {
    try { document.execCommand(lenh, false, giaTri === undefined ? null : giaTri); }
    catch (e) { /* trình duyệt không hỗ trợ thì bỏ qua, không làm hỏng bản in */ }
    danhDau();
};
var hen = null;
function danhDau() {
    if (CD) CD.doi = true;
    /* Sửa nội dung là bố cục đổi — vẽ lại mốc sang trang cho đúng bản in. */
    if (hen) clearTimeout(hen);
    hen = setTimeout(function () { hen = null; W.veRanhTrang(); }, 400);
}

/* --------------------------------------------------------------------------
   BẬT / TẮT CHẾ ĐỘ SỬA
   -------------------------------------------------------------------------- */
/**
 * o = {
 *   tieu   — tên chứng từ hiện trên thanh công cụ
 *   luu(html, xong)  — ghi bản đã sửa vào chính chứng từ
 *   goc()            — dựng lại bản in chuẩn từ dữ liệu (bỏ phần sửa tay)
 *   daSua()          — chứng từ này đang dùng bản sửa tay hay chưa
 *   thoat()          — vẽ lại thanh xem trước bình thường
 * }
 */
W.batCheDoSua = function (o) {
    var area = document.getElementById('prArea');
    var bar = document.querySelector('.print-bar');
    if (!area || !bar) return;
    if (CD) return;

    CD = { o: o, barHTML: bar.innerHTML, goc: area.innerHTML, doi: false };

    bar.classList.add('sua');
    bar.innerHTML = thanhCongCu(o);
    area.classList.add('dang-sua');
    cacTo().forEach(function (t) {
        t.setAttribute('contenteditable', 'true');
        t.setAttribute('spellcheck', 'false');
    });
    area.addEventListener('input', danhDau);
    /* Chặn Enter tạo <div> lồng nhau — dùng đoạn văn phẳng như Word. */
    try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (e) {}

    bind(bar, o);
    var to = cacTo()[0];
    if (to) { to.focus(); UI.toast('info', 'Đang sửa trực tiếp trên bản in',
        'Gõ thẳng lên trang giấy. Bảng biểu bấm vào ô rồi dùng nhóm nút “Bảng”.', 5000); }
};

W.dangSuaBanIn = function () { return !!CD; };

function tatCheDoSua(khoiPhuc) {
    if (!CD) return;
    var area = document.getElementById('prArea');
    var bar = document.querySelector('.print-bar');
    cacTo().forEach(function (t) { t.removeAttribute('contenteditable'); });
    if (area) {
        area.classList.remove('dang-sua');
        area.removeEventListener('input', danhDau);
        if (khoiPhuc) area.innerHTML = CD.goc;
    }
    if (bar) { bar.classList.remove('sua'); bar.innerHTML = CD.barHTML; }
    var o = CD.o;
    CD = null;
    if (o && o.thoat) o.thoat();
}
W.tatCheDoSua = tatCheDoSua;

/** Toàn bộ các trang giấy đang hiển thị, dạng HTML — chính là bản sẽ in. */
function banDaSua() {
    return cacTo().map(function (t) {
        var c = t.cloneNode(true);
        c.removeAttribute('contenteditable');
        c.removeAttribute('spellcheck');
        c.style.position = '';
        if (!c.getAttribute('style')) c.removeAttribute('style');
        /* Mốc sang trang chỉ là chỉ báo trên màn hình — không lưu vào bản in. */
        Array.prototype.forEach.call(c.querySelectorAll('.pr-ranh'), function (e) { e.remove(); });
        return c.outerHTML;
    }).join('');
}
W.banInDangXem = banDaSua;

/* --------------------------------------------------------------------------
   THANH CÔNG CỤ CỦA CHẾ ĐỘ SỬA
   -------------------------------------------------------------------------- */
function nut(id, ico, nhan, title) {
    return '<button class="btn sm" id="' + id + '" title="' + T.esc(title || nhan) + '">' +
           '<i class="bi ' + ico + '"></i>' + (nhan ? ' ' + T.esc(nhan) : '') + '</button>';
}
function thanhCongCu(o) {
    return '<div class="pr-sua-h">' +
        '<b><i class="bi bi-pencil-fill"></i> Đang sửa trực tiếp — ' + T.esc(o.tieu || '') + '</b>' +
        '<span class="spacer"></span>' +
        nut('edGoc', 'bi-arrow-counterclockwise', 'Khôi phục biểu mẫu chuẩn',
            'Bỏ toàn bộ phần sửa tay, dựng lại bản in từ dữ liệu chứng từ') +
        nut('edHuy', 'bi-x-lg', 'Hủy', 'Bỏ các thay đổi chưa lưu và quay lại xem trước') +
        '<button class="btn sm primary" id="edLuu" title="Lưu bản đã sửa vào chính chứng từ này">' +
        '<i class="bi bi-check-lg"></i> Lưu</button>' +
        '</div>' +
        '<div class="pr-sua-t">' +
        '<span class="nh">Chữ</span>' +
        nut('edB', 'bi-type-bold', '', 'Đậm (Ctrl+B)') +
        nut('edI', 'bi-type-italic', '', 'Nghiêng (Ctrl+I)') +
        nut('edU', 'bi-type-underline', '', 'Gạch chân (Ctrl+U)') +
        '<select id="edCo" title="Cỡ chữ">' +
        ['', '10pt', '11pt', '11.5pt', '12pt', '13pt', '14pt', '16pt', '18pt', '20pt']
            .map(function (x) { return '<option value="' + x + '">' + (x || 'Cỡ chữ') + '</option>'; }).join('') +
        '</select>' +
        '<span class="tb-sep"></span><span class="nh">Căn</span>' +
        nut('edL', 'bi-text-left', '', 'Căn trái') +
        nut('edC', 'bi-text-center', '', 'Căn giữa') +
        nut('edR', 'bi-text-right', '', 'Căn phải') +
        nut('edJ', 'bi-justify', '', 'Căn đều hai bên') +
        '<span class="tb-sep"></span><span class="nh">Bảng</span>' +
        nut('edRT', 'bi-arrow-bar-up', '', 'Chèn dòng phía trên') +
        nut('edRB', 'bi-arrow-bar-down', '', 'Chèn dòng phía dưới') +
        nut('edCL', 'bi-arrow-bar-left', '', 'Chèn cột bên trái') +
        nut('edCR', 'bi-arrow-bar-right', '', 'Chèn cột bên phải') +
        nut('edRD', 'bi-dash-square', '', 'Xóa dòng đang đứng') +
        nut('edCD', 'bi-x-square', '', 'Xóa cột đang đứng') +
        nut('edMR', 'bi-arrows-collapse-vertical', '', 'Gộp với ô bên phải') +
        nut('edMD', 'bi-arrows-collapse', '', 'Gộp với ô bên dưới') +
        nut('edSP', 'bi-arrows-expand', '', 'Tách ô đã gộp') +
        '<span class="tb-sep"></span><span class="nh">Khung</span>' +
        nut('edVOn', 'bi-square', '', 'Hiện khung cho vùng đang chọn') +
        nut('edVOff', 'bi-square-half', '', 'Ẩn khung của vùng đang chọn') +
        nut('edVung', 'bi-border-all', 'Đường viền theo vùng…',
            'Chọn vùng nào có khung, vùng nào không') +
        '</div>' +
        '<div class="pr-vung" id="edPanel" hidden></div>';
}

function bind(bar, o) {
    function q(id) { return document.getElementById(id); }
    q('edHuy').onclick = function () {
        if (!CD.doi) return tatCheDoSua(true);
        UI.confirm({ title: 'Bỏ các thay đổi chưa lưu',
            message: 'Bỏ toàn bộ phần vừa sửa trên bản in và quay lại xem trước?',
            okText: 'Bỏ thay đổi', ok: function () { tatCheDoSua(true); } });
    };
    q('edLuu').onclick = function () {
        var html = banDaSua();
        o.luu(html, function () {
            CD.doi = false;
            tatCheDoSua(false);
            UI.toast('ok', 'Đã lưu bản in đã sửa',
                'Bản sửa chỉ áp dụng cho chứng từ này. Biểu mẫu chuẩn không thay đổi.');
        });
    };
    q('edGoc').onclick = function () {
        UI.confirm({ title: 'Khôi phục theo biểu mẫu chuẩn', danger: true,
            message: 'Bỏ toàn bộ phần đã sửa tay và dựng lại bản in từ dữ liệu chứng từ?',
            okText: 'Khôi phục', ok: function () {
                var area = document.getElementById('prArea');
                if (area) area.innerHTML = o.goc();
                cacTo().forEach(function (t) { t.setAttribute('contenteditable', 'true'); });
                CD.doi = true;
                UI.toast('ok', 'Đã dựng lại theo biểu mẫu chuẩn', 'Bấm Lưu để ghi lại.');
            } });
    };
    var LENH = { edB: 'bold', edI: 'italic', edU: 'underline',
                 edL: 'justifyLeft', edC: 'justifyCenter', edR: 'justifyRight', edJ: 'justifyFull' };
    Object.keys(LENH).forEach(function (id) {
        q(id).onmousedown = function (e) { e.preventDefault(); };
        q(id).onclick = function () { W.dinhDangBanIn(LENH[id]); };
    });
    q('edCo').onchange = function () {
        var v = this.value;
        if (!v) return;
        datCoChu(v);
        this.value = '';
    };
    var TB = { edRT: 'dongTren', edRB: 'dongDuoi', edCL: 'cotTrai', edCR: 'cotPhai',
               edRD: 'xoaDong', edCD: 'xoaCot', edMR: 'gopPhai', edMD: 'gopDuoi', edSP: 'tach' };
    Object.keys(TB).forEach(function (id) {
        q(id).onmousedown = function (e) { e.preventDefault(); };
        q(id).onclick = function () { W.thaoTacBang(TB[id]); };
    });
    q('edVOn').onmousedown = q('edVOff').onmousedown = function (e) { e.preventDefault(); };
    q('edVOn').onclick = function () { vienVungChon(true); };
    q('edVOff').onclick = function () { vienVungChon(false); };
    q('edVung').onclick = function () { moBangKhung(); };
}

/** Cỡ chữ đặt bằng kiểu nội tuyến để giữ đúng đơn vị pt của biểu mẫu. */
function datCoChu(co) {
    var s = window.getSelection();
    if (!s || !s.rangeCount || s.isCollapsed) {
        var k = khoiHienTai();
        if (!k) return UI.toast('warn', 'Chưa chọn đoạn cần đổi cỡ chữ');
        k.style.fontSize = co;
        danhDau();
        return;
    }
    var r = s.getRangeAt(0);
    var sp = document.createElement('span');
    sp.style.fontSize = co;
    try { r.surroundContents(sp); }
    catch (e) { sp.appendChild(r.extractContents()); r.insertNode(sp); }
    danhDau();
}

function vienVungChon(co) {
    var k = khoiHienTai();
    if (!k) return UI.toast('warn', 'Chưa chọn vùng',
        'Bấm con trỏ vào đoạn văn, ô bảng hoặc bảng cần đổi đường viền.');
    datVien(k, co);
    danhDau();
    UI.toast('ok', co ? 'Đã hiện khung cho vùng đang chọn' : 'Đã ẩn khung của vùng đang chọn');
}

/* --------------------------------------------------------------------------
   BẢNG ĐIỀU KHIỂN ĐƯỜNG VIỀN THEO VÙNG
   Mở ngay dưới thanh công cụ — KHÔNG phải popup, không che bản in.
   -------------------------------------------------------------------------- */
function moBangKhung() {
    var p = document.getElementById('edPanel');
    if (!p) return;
    if (!p.hidden) { p.hidden = true; return; }
    var keyCT = CD && CD.o && CD.o.key;
    var coMauVien = keyCT && W.mauMacDinh && W.mauMacDinh(keyCT) && W.mauMacDinh(keyCT).vien;
    p.innerHTML =
        '<div class="tt"><i class="bi bi-border-all"></i> Chọn vùng nào có khung trên bản in này' +
        '<span class="spacer"></span>' +
        '<button class="btn sm" id="vgBang">Chỉ bảng dữ liệu có khung</button>' +
        '<button class="btn sm" id="vgHet">Ẩn mọi đường viền</button>' +
        (keyCT ? '<button class="btn sm primary" id="vgMau" title="Từ nay mọi chứng từ cùng loại tự động in theo đúng cấu hình khung này"><i class="bi bi-bookmark-star"></i> Lưu thành mẫu mặc định</button>' : '') +
        (coMauVien ? '<button class="btn sm" id="vgBoMau" title="Bỏ mẫu khung mặc định của loại chứng từ này, quay về biểu mẫu chuẩn"><i class="bi bi-bookmark-x"></i> Bỏ mẫu mặc định</button>' : '') +
        '<button class="btn sm" id="vgDong"><i class="bi bi-x-lg"></i> Đóng</button></div>' +
        '<div class="ds">' + VUNG.map(function (v) {
            var tt = W.trangThaiVung(v.k);
            if (tt === null) return '';
            return '<label class="ck" data-vung="' + v.k + '">' +
                '<input type="checkbox" ' + (tt ? 'checked' : '') + '>' +
                '<span><b>' + T.esc(v.t) + '</b><small>' + T.esc(v.mo) + '</small></span></label>';
        }).join('') + '</div>' +
        '<div class="ct">Đường viền đặt ở đây đi theo bản in sang <b>PDF · Word · Excel</b>. ' +
        'Bấm <b>Lưu</b> thì chỉ áp dụng cho chứng từ này; bấm <b>Lưu thành mẫu mặc định</b> ' +
        'thì mọi chứng từ cùng loại từ nay tự động in theo khung này' +
        (coMauVien ? ' — <b>loại chứng từ này đang có mẫu khung mặc định</b>' : '') + '.</div>';
    p.hidden = false;
    p.querySelectorAll('[data-vung] input').forEach(function (c) {
        c.onchange = function () {
            var k = c.closest('[data-vung]').getAttribute('data-vung');
            W.datKhungVung(k, c.checked);
            danhDau();
        };
    });
    document.getElementById('vgDong').onclick = function () { p.hidden = true; };
    var nMau = document.getElementById('vgMau');
    if (nMau) nMau.onclick = function () {
        var cfg = W.trangThaiMoiVung();
        if (!cfg) return UI.toast('warn', 'Không đọc được cấu hình khung của bản in này');
        W.luuMauMacDinh(keyCT, 'vien', cfg);
        UI.toast('ok', 'Đã lưu thành mẫu khung mặc định',
            'Từ nay mọi chứng từ cùng loại tự động in theo đúng cấu hình khung này, ' +
            'kể cả sau khi đóng phần mềm.');
        moBangKhung(); moBangKhung();      // vẽ lại bảng để hiện trạng thái mẫu
    };
    var nBo = document.getElementById('vgBoMau');
    if (nBo) nBo.onclick = function () {
        UI.confirm({ title: 'Bỏ mẫu khung mặc định', danger: true,
            message: 'Các chứng từ cùng loại sẽ in lại theo khung của biểu mẫu chuẩn?',
            okText: 'Bỏ mẫu', ok: function () {
                W.luuMauMacDinh(keyCT, 'vien', null);
                UI.toast('ok', 'Đã bỏ mẫu khung mặc định của loại chứng từ này');
                moBangKhung(); moBangKhung();
            } });
    };
    document.getElementById('vgHet').onclick = function () {
        VUNG.forEach(function (v) { W.datKhungVung(v.k, false); });
        capNhatTich(p, function () { return false; });
        danhDau();
        UI.toast('ok', 'Đã ẩn toàn bộ đường viền');
    };
    document.getElementById('vgBang').onclick = function () {
        VUNG.forEach(function (v) { W.datKhungVung(v.k, v.k === 'bang'); });
        capNhatTich(p, function (k) { return k === 'bang'; });
        danhDau();
        UI.toast('ok', 'Chỉ bảng dữ liệu còn đường viền');
    };
}
function capNhatTich(p, f) {
    p.querySelectorAll('[data-vung]').forEach(function (l) {
        l.querySelector('input').checked = f(l.getAttribute('data-vung'));
    });
}

})(window);

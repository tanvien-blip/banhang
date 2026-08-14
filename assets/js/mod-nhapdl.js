/* ==========================================================================
   TVERP — NHẬP DỮ LIỆU LỊCH SỬ TỪ EXCEL
   Một bộ máy dùng chung cho MỌI phân hệ, đúng bảy bước:
     1. Tải tệp mẫu  2. Nhập dữ liệu vào Excel  3. Tải tệp lên hệ thống
     4. Kiểm tra dữ liệu  5. Xem trước  6. Sửa lỗi ngay trên màn hình
     7. Xác nhận nhập
   Tệp mẫu TỰ SINH theo khai báo cột hiện tại của phân hệ — đổi cấu trúc dữ
   liệu thì tệp mẫu tự đổi theo, không dùng tệp mẫu cố định.
   Lỗi báo rõ: dòng lỗi · cột lỗi · nội dung lỗi · hướng xử lý, và xuất được
   ra Excel. Có lỗi KHÔNG dừng toàn bộ quá trình: dòng đúng vẫn ghi bình thường.
   ========================================================================== */
(function (W) {
'use strict';

/* Số dòng tối đa VẼ RA trong bảng xem trước của trình nhập. Kiểm tra dữ liệu vẫn
   chạy trên toàn bộ số dòng của tệp — hằng số này chỉ giới hạn phần hiển thị. */
var GIOI_HAN_XEM = 300;
var T = W.T, DB = W.DB, UI = W.UI;

/* ==========================================================================
   1. BỘ KIỂM TRA DỮ LIỆU DÙNG CHUNG
   Mỗi lỗi gồm: cột lỗi (c) · nội dung lỗi (v) · hướng xử lý (x).
   ========================================================================== */
function KT(r) {
    if (!(this instanceof KT)) return new KT(r);
    this.r = r || {};
    this.loi = [];
}
/* Tham số thứ tư "ma" là MÃ LOẠI LỖI (tùy chọn) — dùng để thống kê kết quả
   nhập theo đúng nhóm: khong-nhan-dien · trung-du-lieu … Không hiển thị cho
   người dùng, chỉ để đếm. */
KT.prototype.them = function (cot, noiDung, huong, ma) {
    this.loi.push({ c: cot || '', v: noiDung, x: huong || '', ma: ma || '' });
    return this;
};
KT.prototype.co = function () { return this.loi.length > 0; };
/** Cảnh báo — dòng vẫn hợp lệ, chỉ cần người dùng xác nhận trước khi lưu. */
KT.prototype.canh = function (cot, noiDung, huong, ma) {
    this.canhBao = this.canhBao || [];
    this.canhBao.push({ c: cot || '', v: noiDung, x: huong || '', ma: ma || '' });
    return this;
};
/** Đọc ô thô của một cột, đã cắt khoảng trắng thừa. */
KT.prototype.o = function (cot) {
    var v = this.r[cot];
    return v === undefined || v === null ? '' : String(v).trim();
};
/** Chuỗi văn bản. o = { req, mac, max } */
KT.prototype.chu = function (cot, o) {
    o = o || {};
    var v = this.o(cot);
    if (!v) {
        if (o.req) this.them(cot, 'thiếu ' + cot.toLowerCase(),
            'Nhập giá trị cho cột "' + cot + '" rồi kiểm tra lại.');
        return o.mac === undefined ? '' : o.mac;
    }
    if (o.max && v.length > o.max) {
        this.them(cot, cot.toLowerCase() + ' dài quá ' + o.max + ' ký tự',
            'Rút ngắn nội dung cột "' + cot + '" xuống tối đa ' + o.max + ' ký tự.');
        return v.substr(0, o.max);
    }
    return v;
};
/** Số. o = { req, min, max, mac, nguyen, mo } */
KT.prototype.so = function (cot, o) {
    o = o || {};
    // Ô số của Excel giữ nguyên giá trị gốc, kể cả phần thập phân (tỷ giá, số lượng lẻ)
    var goc = this.r[cot];
    if (typeof goc === 'number' && isFinite(goc)) return this.kiemMien(cot, goc, o);
    var t = this.o(cot);
    if (t === '') {
        if (o.req) this.them(cot, 'thiếu ' + cot.toLowerCase(),
            'Nhập số vào cột "' + cot + '", ví dụ 1000000 hoặc 1.000.000.');
        return o.mac === undefined ? 0 : o.mac;
    }
    if (!/^-?[\d.,\s]+$/.test(t)) {
        this.them(cot, cot.toLowerCase() + ' "' + t + '" không phải là số',
            'Chỉ nhập chữ số, không ghi chữ "đ", "VNĐ" hay ký tự khác. Ví dụ 1000000 hoặc 1.000.000.');
        return 0;
    }
    var n = T.so(t);
    if (isNaN(n)) {
        this.them(cot, cot.toLowerCase() + ' "' + t + '" không đọc được',
            'Nhập lại số ở cột "' + cot + '", ví dụ 1000000 hoặc 1.000.000.');
        return 0;
    }
    return this.kiemMien(cot, n, o);
};
/** Kiểm tra khoảng giá trị và yêu cầu số nguyên. */
KT.prototype.kiemMien = function (cot, n, o) {
    o = o || {};
    if (o.nguyen && Math.round(n) !== n) {
        this.them(cot, cot.toLowerCase() + ' phải là số nguyên',
            'Bỏ phần thập phân ở cột "' + cot + '".');
        n = Math.round(n);
    }
    if (o.min !== undefined && n < o.min) {
        this.them(cot, o.mo || (cot.toLowerCase() + ' phải lớn hơn hoặc bằng ' + T.num(o.min, 0)),
            'Sửa cột "' + cot + '" thành giá trị từ ' + T.num(o.min, 0) +
            (o.max !== undefined ? ' đến ' + T.num(o.max, 0) : ' trở lên') + '.');
    } else if (o.max !== undefined && n > o.max) {
        this.them(cot, o.mo || (cot.toLowerCase() + ' phải nhỏ hơn hoặc bằng ' + T.num(o.max, 0)),
            'Sửa cột "' + cot + '" thành giá trị không quá ' + T.num(o.max, 0) + '.');
    }
    return n;
};
/** Số tiền — không âm. */
KT.prototype.tien = function (cot, o) {
    o = o || {};
    if (o.min === undefined) o.min = 0;
    if (o.mo === undefined && o.min === 0) o.mo = cot.toLowerCase() + ' không được âm';
    return this.so(cot, o);
};
/** Tỷ lệ phần trăm 0 – 100. */
KT.prototype.pct = function (cot, o) {
    o = o || {};
    if (o.min === undefined) o.min = 0;
    if (o.max === undefined) o.max = 100;
    if (o.mo === undefined) o.mo = cot.toLowerCase() + ' phải trong khoảng 0 – 100';
    return this.so(cot, o);
};
/** Ngày tháng — nhận 05/08/2026, 2026-08-05 và ô ngày của Excel. */
KT.prototype.ngay = function (cot, o) {
    o = o || {};
    var t = this.o(cot);
    if (t === '' && this.r[cot] === undefined) {
        if (o.req) this.them(cot, 'thiếu ' + cot.toLowerCase(),
            'Nhập ngày dạng NGÀY/THÁNG/NĂM vào cột "' + cot + '", ví dụ 05/08/2026.');
        return o.mac === undefined ? '' : o.mac;
    }
    var d = T.docNgay(this.r[cot]);
    if (!d) {
        if (t === '' && !o.req) return o.mac === undefined ? '' : o.mac;
        this.them(cot, cot.toLowerCase() + ' "' + t + '" không hợp lệ',
            'Nhập ngày dạng NGÀY/THÁNG/NĂM, ví dụ 05/08/2026.');
        return o.mac === undefined ? '' : o.mac;
    }
    return d;
};
/** Giá trị phải nằm trong danh sách cho phép. */
KT.prototype.chon = function (cot, ds, o) {
    o = o || {};
    var v = this.o(cot);
    if (!v) {
        if (o.req) this.them(cot, 'thiếu ' + cot.toLowerCase(),
            'Chọn một trong các giá trị: ' + ds.join(' · ') + '.');
        return o.mac === undefined ? '' : o.mac;
    }
    var hop = ds.filter(function (x) { return T.kd(x) === T.kd(v); })[0];
    if (!hop) {
        this.them(cot, cot.toLowerCase() + ' "' + v + '" không hợp lệ',
            'Chỉ nhận các giá trị: ' + ds.join(' · ') + '.');
        return o.mac === undefined ? '' : o.mac;
    }
    return hop;
};
/**
 * Đối chiếu với một danh mục của hệ thống. Tìm theo mã trước, sau đó theo tên.
 * Trả về bản ghi tìm được hoặc null.
 *   coll  — tên danh mục (khachHang, nhaCungCap, hangHoa, donVi…)
 *   nhan  — tên hiển thị của danh mục để viết câu hướng dẫn
 */
KT.prototype.tra = function (cot, coll, nhan, o) {
    o = o || {};
    var v = this.o(cot);
    if (!v) {
        if (o.req) this.them(cot, 'thiếu ' + cot.toLowerCase(),
            'Nhập mã đã khai trong Danh mục ' + nhan + ' vào cột "' + cot + '".');
        return null;
    }
    var kd = T.kd(v);
    var ds = DB.all(coll);
    var rec = ds.filter(function (x) { return T.kd(x.ma || '') === kd; })[0];
    if (!rec) rec = ds.filter(function (x) { return T.kd(x.tat || '') === kd; })[0];
    if (!rec) rec = ds.filter(function (x) { return T.kd(x.ten || '') === kd; })[0];
    if (!rec) {
        this.them(cot, 'không tìm thấy ' + nhan.toLowerCase() + ' "' + v + '"',
            'Khai báo "' + v + '" trong Danh mục ' + nhan + ' trước, hoặc sửa lại đúng mã đã có.');
        return null;
    }
    return rec;
};
/** Đơn vị tính: nhận cả đơn vị chưa khai, chỉ nhắc nhở khi để trống. */
KT.prototype.dvt = function (cot, mac) {
    var v = this.o(cot);
    if (!v) return mac || '';
    var ds = W.dsDVT ? W.dsDVT() : [];
    var hop = ds.filter(function (x) { return T.kd(x) === T.kd(v); })[0];
    if (!hop && ds.length) {
        this.them(cot, 'đơn vị tính "' + v + '" chưa có trong danh mục',
            'Khai đơn vị tính "' + v + '" tại Hệ thống → Cài đặt → Đơn vị tính, hoặc dùng: ' +
            ds.slice(0, 8).join(' · ') + '.');
        return v;
    }
    return hop || v;
};
/** Kiểm tra trùng: trong chính tệp đang nhập và trong dữ liệu đã có. */
KT.prototype.trung = function (cot, khoa, daGap, coll, truong, nhan) {
    if (!khoa) return;
    var kd = T.kd(khoa);
    if (daGap[kd]) {
        this.them(cot, 'trùng ' + cot.toLowerCase() + ' "' + khoa + '" với dòng ' + daGap[kd] + ' trong tệp',
            'Mỗi ' + (nhan || 'bản ghi') + ' chỉ được khai một lần — xóa dòng thừa hoặc đổi ' +
            cot.toLowerCase() + '.', 'trung');
        return;
    }
    if (coll && DB.all(coll).some(function (x) { return T.kd(x[truong || 'ma'] || '') === kd; })) {
        this.them(cot, cot.toLowerCase() + ' "' + khoa + '" đã có trong hệ thống',
            'Hệ thống không tạo dữ liệu trùng — đổi ' + cot.toLowerCase() +
            ' hoặc bỏ dòng này nếu đã nhập rồi.', 'trung');
    }
};
W.KT = KT;

/** Chuẩn hóa lỗi kiểu chuỗi cũ về dạng { c, v, x }. */
function chuanLoi(ds) {
    return (ds || []).map(function (x) {
        if (x && typeof x === 'object') return { c: x.c || '', v: x.v || '', x: x.x || '', ma: x.ma || '' };
        return { c: '', v: String(x), ma: '',
                 x: 'Sửa lại dòng này trong bảng xem trước rồi bấm Kiểm tra dữ liệu.' };
    });
}

/* ==========================================================================
   2. TỆP MẪU EXCEL — TỰ SINH THEO CẤU TRÚC DỮ LIỆU HIỆN TẠI
   ========================================================================== */
W.tepMauNhap = function (cfg) {
    W.tepMau({ ten: cfg.ten, file: cfg.file ? ('Mau_' + cfg.file) : 'TepMau',
               cols: (cfg.cols || []).filter(function (c) { return !c.an; }), mau: cfg.mau });
};

/* ==========================================================================
   3. TRÌNH NHẬP DỮ LIỆU — BẢY BƯỚC
   ========================================================================== */
var BUOC = ['Tải tệp mẫu', 'Nhập vào Excel', 'Tải tệp lên', 'Kiểm tra dữ liệu',
            'Xem trước', 'Sửa lỗi', 'Xác nhận nhập'];

W.nhapDuLieu = function (cfg) {
    var cols = (cfg.cols || []).filter(function (c) { return !c.an; });
    var duLieu = [];          // [{ dong, r (ô thô), o (bản ghi), loi[] }]
    var tenTep = '';
    var buoc = 1;
    var h = null;

    UI.modal({
        size: 'full', dismiss: false,
        title: 'Nhập dữ liệu từ Excel — ' + (cfg.ten || ''),
        sub: 'Tải tệp mẫu → nhập dữ liệu → tải lên → kiểm tra → xem trước → sửa lỗi ngay trên màn hình → xác nhận nhập',
        body:
          '<div id="ndBuoc" class="nd-buoc"></div>' +
          '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
          'Tệp Excel cần có dòng tiêu đề đúng các cột: <b>' +
          cols.map(function (c) { return T.esc(c.t); }).join(' · ') + '</b>.<br>' +
          'Tệp mẫu do phần mềm <b>tự sinh theo cấu trúc dữ liệu hiện tại</b> và kèm trang ' +
          '<i>Hướng dẫn</i> giải thích từng cột.' +
          (cfg.nhomTheo ? '<br>Các dòng có cùng <b>' + T.esc(cfg.nhomCot || 'số chứng từ') +
              '</b> được gộp thành một ' + T.esc(cfg.nhomNhan || 'chứng từ') + '.' : '') +
          '</div></div>' +
          '<div class="row mb12 nd-thanh">' +
          '<button class="btn" id="ndMau"><i class="bi bi-file-earmark-arrow-down"></i> Tải tệp mẫu Excel</button>' +
          '<button class="btn primary" id="ndChon"><i class="bi bi-upload"></i> Nhập dữ liệu từ Excel</button>' +
          '<button class="btn" id="ndKiem" disabled><i class="bi bi-shield-check"></i> Kiểm tra dữ liệu</button>' +
          '<button class="btn" id="ndXem" disabled><i class="bi bi-table"></i> Xem trước dữ liệu</button>' +
          '<button class="btn" id="ndLoi" disabled><i class="bi bi-filetype-xlsx"></i> Xuất danh sách lỗi</button>' +
          '<span class="spacer"></span>' +
          '<span class="muted small" id="ndTen">Chưa chọn tệp</span></div>' +
          '<div id="ndTong"></div><div id="ndBang"></div>',
        buttons: [
            { text: 'Đóng', icon: 'bi-x-lg', click: function (x) { x.close(); } },
            { text: 'Xác nhận nhập', cls: 'primary', icon: 'bi-database-add',
              click: function (x) { xacNhan(x); } }
        ],
        onOpen: function (x) {
            h = x;
            veBuoc();
            h.q('#ndMau').onclick = function () {
                W.tepMauNhap({ ten: cfg.ten, file: cfg.file, cols: cols, mau: cfg.mau });
                buoc = 2; veBuoc();
            };
            function nap(rows, ten) {
                tenTep = ten;
                duLieu = rows.map(function (r, i) {
                    var o = {};
                    /* TIÊU ĐỀ CŨ VẪN ĐỌC ĐƯỢC. Mỗi cột khai thêm "tenKhac" là danh
                       sách tiêu đề tương đương của các tệp mẫu đời trước — doanh
                       nghiệp không phải sửa lại tệp đã có khi phần mềm nâng cấp. */
                    cols.forEach(function (c) {
                        var v = r[c.t];
                        if ((v === undefined || v === '') && c.tenKhac) {
                            for (var j = 0; j < c.tenKhac.length; j++) {
                                var v2 = r[c.tenKhac[j]];
                                if (v2 !== undefined && v2 !== '') { v = v2; break; }
                            }
                        }
                        o[c.t] = v;
                    });
                    // Dữ liệu kèm theo không hiển thị thành cột (hình ảnh, nhóm hàng…)
                    Object.keys(r).forEach(function (k) { if (k.indexOf('__') === 0) o[k] = r[k]; });
                    return { dong: i + 2, r: o, o: null, loi: [] };
                });
                buoc = 3; kiemTraTatCa(); buoc = 5; ve();
            }
            h.q('#ndChon').onclick = function () {
                UI.nhapExcel({ done: function (rows, ten) { nap(rows, ten); } });
            };
            // Tệp đã chọn từ trước (bảng giá đọc tiêu đề cột trước khi mở trình nhập)
            if (cfg.dongDau && cfg.dongDau.length) nap(cfg.dongDau, cfg.tenTep || 'Tệp đã chọn');
            h.q('#ndKiem').onclick = function () {
                if (!duLieu.length) return UI.toast('warn', 'Chưa có dữ liệu', 'Bấm “Nhập dữ liệu từ Excel” để tải tệp lên.');
                kiemTraTatCa(); ve();
                var n = hong().length;
                if (n) UI.toast('warn', 'Còn ' + n + ' dòng có lỗi',
                    'Sửa trực tiếp trong bảng xem trước bên dưới — không phải quay lại Excel.');
                else UI.toast('ok', 'Dữ liệu hợp lệ', 'Toàn bộ ' + duLieu.length + ' dòng đều đạt, bấm “Xác nhận nhập”.');
            };
            h.q('#ndXem').onclick = function () { buoc = 5; ve(); };
            h.q('#ndLoi').onclick = function () { xuatLoi(); };
        }
    });

    /* ------------------------------------------------------- kiểm tra */
    function kiemTraTatCa() {
        var da = {};
        duLieu.forEach(function (d, i) {
            var kq;
            try { kq = cfg.kiemTra(d.r, i, da); }
            catch (e) { kq = { o: null, loi: [{ c: '', v: 'không đọc được dòng: ' + (e.message || e),
                x: 'Kiểm tra lại các ô của dòng này trong bảng xem trước.' }] }; }
            d.o = kq.o;
            d.loi = chuanLoi(kq.loi);
            d.canh = chuanLoi(kq.canhBao);
        });
    }
    function tot() { return duLieu.filter(function (d) { return !d.loi.length; }); }
    function hong() { return duLieu.filter(function (d) { return d.loi.length; }); }
    function canh() { return duLieu.filter(function (d) { return !d.loi.length && (d.canh || []).length; }); }

    /* ------------------------------------------------------- hiển thị */
    function veBuoc() {
        if (!h) return;
        h.q('#ndBuoc').innerHTML = BUOC.map(function (t, i) {
            var n = i + 1;
            return '<span class="nd-b ' + (n < buoc ? 'xong' : n === buoc ? 'nay' : '') + '">' +
                '<i>' + n + '</i>' + T.esc(t) + '</span>';
        }).join('');
    }
    function ve() {
        if (!h) return;
        veBuoc();
        var ok = tot().length, ho = hong().length, nc = canh().length;
        h.q('#ndTen').textContent = tenTep
            ? tenTep + ' — đọc được ' + T.num(duLieu.length, 0) + ' dòng' : 'Chưa chọn tệp';
        ['ndKiem', 'ndXem'].forEach(function (k) { h.q('#' + k).disabled = !duLieu.length; });
        h.q('#ndLoi').disabled = !ho && !nc;
        var bg = Array.prototype.filter.call(h.el.querySelectorAll('.modal-f button'), function (b) {
                     return b.textContent.indexOf('Xác nhận nhập') >= 0; })[0];
        if (bg) bg.disabled = !ok;

        var nhom = 0;
        if (cfg.nhomTheo) {
            var s = {};
            tot().forEach(function (d) { s[cfg.nhomTheo(d.o)] = 1; });
            nhom = Object.keys(s).length;
        }
        h.q('#ndTong').innerHTML = duLieu.length ? '<div class="grid4 mb12">' +
            the('Tổng số dòng đọc được', T.num(duLieu.length, 0), '') +
            the('Dòng hợp lệ — sẽ ghi', T.num(ok, 0), ok ? 'g' : '') +
            the('Dòng có lỗi — bỏ qua', T.num(ho, 0), ho ? 'r' : '') +
            (cfg.nhomTheo
                ? the('Số ' + (cfg.nhomNhan || 'chứng từ') + ' sẽ sinh', T.num(nhom, 0), 'g')
                : the('Dòng cần xác nhận', T.num(nc, 0), nc ? 'y' : '')) +
            '</div>' : '';

        // Khối tóm tắt riêng của phân hệ (bảng giá: đã nhận diện · hàng mới · cập nhật giá)
        if (cfg.themTong) {
            var ht = cfg.themTong(duLieu);
            if (ht) h.q('#ndTong').innerHTML += ht;
        }
        h.q('#ndBang').innerHTML = duLieu.length ? bangXemTruoc() : '';
        if (duLieu.length) gan();
    }
    function the(l, v, c) {
        return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div><div class="vl">' + v + '</div></div>';
    }
    function coLoi(d, cot) {
        return d.loi.some(function (x) { return x.c === cot; });
    }
    function coCanh(d, cot) {
        return (d.canh || []).some(function (x) { return x.c === cot; });
    }
    function bangXemTruoc() {
        return '<div class="card"><div class="card-h"><i class="bi bi-pencil-square"></i> ' +
            'Xem trước và sửa dữ liệu' +
            '<span class="spacer"></span>' +
            '<span class="small muted">Sửa trực tiếp vào ô bên dưới rồi bấm ' +
            '<b>Kiểm tra dữ liệu</b> — không phải quay lại tệp Excel</span></div>' +
            '<div class="tablewrap" style="max-height:calc(100vh - 430px);border:none">' +
            '<table class="grid nd-bang"><thead><tr>' +
            '<th style="width:74px">Dòng</th><th style="width:128px">Trạng thái</th>' +
            cols.map(function (c) {
                return '<th style="min-width:' + Math.max(90, (c.w || 16) * 7) + 'px">' + T.esc(c.t) +
                    (c.req ? ' <span class="neg">*</span>' : '') + '</th>';
            }).join('') +
            '<th style="min-width:280px">Lỗi và hướng xử lý</th></tr></thead><tbody>' +
            dongXem().map(function (z) {
                var d = z[0], i = z[1];
                return veDongXem(d, i);
            }).join('') + '</tbody></table></div>' + ghiChuCatBot() + '</div>';
    }
    /* Tệp bảng giá của nhà sản xuất có thể tới hàng chục nghìn dòng. Kiểm tra vẫn
       chạy trên TOÀN BỘ dữ liệu; chỉ giới hạn số dòng VẼ RA để trình duyệt không
       phải dựng hàng trăm nghìn ô nhập. Dòng có lỗi và cảnh báo luôn được ưu tiên. */
    function dongXem() {
        var i, ds = [];
        if (duLieu.length <= GIOI_HAN_XEM) {
            for (i = 0; i < duLieu.length; i++) ds.push([duLieu[i], i]);
            return ds;
        }
        for (i = 0; i < duLieu.length && ds.length < GIOI_HAN_XEM; i++)
            if (duLieu[i].loi.length || (duLieu[i].canh || []).length) ds.push([duLieu[i], i]);
        for (i = 0; i < duLieu.length && ds.length < GIOI_HAN_XEM; i++)
            if (!duLieu[i].loi.length && !(duLieu[i].canh || []).length) ds.push([duLieu[i], i]);
        return ds.sort(function (a, b) { return a[1] - b[1]; });
    }
    function ghiChuCatBot() {
        if (duLieu.length <= GIOI_HAN_XEM) return '';
        return '<div class="note b" style="margin:10px 12px 12px"><i class="bi bi-info-circle"></i><div>' +
            'Tệp có <b>' + T.num(duLieu.length, 0) + '</b> dòng. Hệ thống <b>kiểm tra toàn bộ</b> nhưng chỉ ' +
            'hiển thị <b>' + T.num(GIOI_HAN_XEM, 0) + '</b> dòng (ưu tiên dòng có lỗi và cảnh báo) để màn hình ' +
            'không bị nặng. Bấm <b>Xác nhận nhập</b> là toàn bộ số dòng đều được ghi.</div></div>';
    }
    function veDongXem(d, i) {
        return '<tr class="' + (d.loi.length ? 'nd-hong' : 'nd-tot') + '">' +
                    '<td class="ctr mono">' + d.dong + '</td>' +
                    '<td>' + (d.loi.length
                        ? '<span class="pill r"><i class="bi bi-exclamation-triangle-fill"></i> Có lỗi</span>'
                        : (d.canh && d.canh.length
                            ? '<span class="pill y"><i class="bi bi-info-circle-fill"></i> Cần xác nhận</span>'
                            : '<span class="pill g"><i class="bi bi-check2"></i> Hợp lệ</span>')) + '</td>' +
                    cols.map(function (c) {
                        var v = d.r[c.t];
                        return '<td class="' + (coLoi(d, c.t) ? 'nd-o-hong' : coCanh(d, c.t) ? 'nd-o-canh' : '') + '">' +
                            '<input class="nd-o" data-d="' + i + '" data-c="' + T.esc(c.t) + '" value="' +
                            T.esc(v === undefined || v === null ? '' : String(v)) + '"></td>';
                    }).join('') +
                    '<td class="small">' + (
                        d.loi.map(function (x) {
                            return '<div class="nd-loi"><b class="neg">' +
                                (x.c ? T.esc(x.c) + ': ' : '') + T.esc(x.v) + '</b>' +
                                (x.x ? '<span class="muted"> → ' + T.esc(x.x) + '</span>' : '') + '</div>';
                        }).join('') +
                        (d.canh || []).map(function (x) {
                            return '<div class="nd-loi"><b class="warn">' +
                                (x.c ? T.esc(x.c) + ': ' : '') + T.esc(x.v) + '</b>' +
                                (x.x ? '<span class="muted"> → ' + T.esc(x.x) + '</span>' : '') + '</div>';
                        }).join('') ||
                        '<span class="muted">—</span>') + '</td></tr>';
    }
    function gan() {
        h.el.querySelectorAll('.nd-o').forEach(function (e) {
            e.onchange = function () {
                var d = duLieu[Number(e.getAttribute('data-d'))];
                d.r[e.getAttribute('data-c')] = e.value;
                buoc = 6;
                kiemTraTatCa();
                ve();
            };
        });
    }

    /* ------------------------------------------------------ xuất lỗi */
    function xuatLoi() {
        var ds = [];
        duLieu.forEach(function (d) {
            d.loi.forEach(function (x) {
                ds.push({ dong: d.dong, loai: 'Lỗi', cot: x.c || '(cả dòng)', noi: x.v, huong: x.x,
                          gt: x.c ? String(d.r[x.c] === undefined ? '' : d.r[x.c]) : '' });
            });
            (d.canh || []).forEach(function (x) {
                ds.push({ dong: d.dong, loai: 'Cảnh báo', cot: x.c || '(cả dòng)', noi: x.v, huong: x.x,
                          gt: x.c ? String(d.r[x.c] === undefined ? '' : d.r[x.c]) : '' });
            });
        });
        UI.xuatExcel('DanhSachLoi_' + (cfg.file || 'NhapDuLieu'), 'Danh sách lỗi',
            [{ t: 'Dòng Excel', k: 'dong', w: 12 }, { t: 'Loại', k: 'loai', w: 12 },
             { t: 'Cột lỗi', k: 'cot', w: 24 },
             { t: 'Giá trị đang nhập', k: 'gt', w: 28 },
             { t: 'Nội dung lỗi', k: 'noi', w: 52 }, { t: 'Hướng xử lý', k: 'huong', w: 64 }], ds);
    }

    /* --------------------------------------------------- xác nhận nhập */
    function xacNhan(x) {
        var ok = tot();
        if (!ok.length) return UI.toast('warn', 'Không có dòng hợp lệ nào để ghi',
            'Sửa các dòng đang báo lỗi rồi bấm “Kiểm tra dữ liệu”.');
        var ho = hong().length;
        UI.confirm({
            title: 'Xác nhận nhập dữ liệu',
            message: 'Ghi <b>' + T.num(ok.length, 0) + '</b> dòng hợp lệ vào ' + (cfg.ten || 'hệ thống') +
                (cfg.nhomNhan ? ' và sinh ' + (cfg.nhomNhan) + ' tương ứng' : '') + '.' +
                (canh().length ? '<br><b>' + T.num(canh().length, 0) + '</b> dòng có cảnh báo cần xem lại ' +
                    '(mặt hàng chưa có trong Danh mục Hàng hóa, hoặc trùng mã nhưng khác tên).' : '') +
                (ho ? '<br>' + T.num(ho, 0) + ' dòng đang có lỗi sẽ được bỏ qua, không làm dừng quá trình nhập.' : ''),
            okText: 'Xác nhận nhập',
            ok: function () {
                /* Bộ nhập nào cần HỎI THÊM trước khi ghi (ví dụ nhập bảng giá
                   gặp mặt hàng chưa có trong Danh mục Hàng hóa) thì khai
                   truocGhi. Hàm này nhận danh sách dòng hợp lệ và gọi lại tiep()
                   với danh sách ĐÃ ĐƯỢC NGƯỜI DÙNG QUYẾT; không gọi tiep()
                   nghĩa là người dùng hủy, không ghi gì cả. */
                if (cfg.truocGhi) cfg.truocGhi(ok, ghiTatCa);
                else ghiTatCa(ok);
            }
        });

        function ghiTatCa(ds) {
            var n = 0, sai = 0;
            ds = ds || [];
            if (cfg.batDau) cfg.batDau();
            /* Gom toàn bộ lần ghi lại, chỉ lưu xuống một lần khi xong — tệp
               hàng chục nghìn dòng vẫn nhập được trong vài giây. */
            DB.gopGhi();
            try {
                ds.forEach(function (d) {
                    try { cfg.ghi(d.o); n++; } catch (e) { sai++; }
                });
            } finally { DB.xongGopGhi(); }
            buoc = 7;
            x.close();
            if (cfg.xong) cfg.xong();
            UI.toast('ok', 'Đã nhập ' + T.num(n, 0) + ' dòng dữ liệu',
                (cfg.nhomNhan ? 'Dữ liệu đã liên kết đầy đủ với danh mục, kho, giá vốn, công nợ và báo cáo. ' : '') +
                (ho ? ho + ' dòng lỗi đã được bỏ qua.' : 'Toàn bộ dòng đều hợp lệ.') +
                (sai ? ' ' + sai + ' dòng không ghi được.' : ''), 6000);
        }
    }
};

/* ==========================================================================
   4. TỰ ĐỘNG TẠO HÀNG HÓA MỚI
   Khi đọc dữ liệu, mã hàng đã có thì liên kết với hàng hóa hiện có và KHÔNG
   tạo mới; mã hàng chưa có thì hệ thống tự khai vào Danh mục Hàng hóa ngay,
   người dùng không phải vào Danh mục khai trước.
   Không tạo trùng mã. Trùng mã nhưng khác tên thì cảnh báo để xác nhận.
   ========================================================================== */
/** Tìm hàng hóa theo mã (không phân biệt hoa thường và dấu). */
W.timHangHoa = function (ma) {
    if (!ma) return null;
    var kd = T.kd(String(ma).trim());
    if (!kd) return null;
    var m = T.chiMucHangHoa();                    // tra theo chỉ mục — nhập tệp lớn vẫn nhanh
    /* Model ĐƯỢC PHÉP TRÙNG: một Model trỏ tới nhiều mặt hàng thì KHÔNG đoán
       bừa lấy một mặt hàng nào — trả về rỗng để nơi gọi hỏi thêm tên hàng và
       cấu hình, hoặc tạo mặt hàng mới. */
    var h = m.ma[kd];
    if (h && h !== 'nhieu') return h;
    /* Mã cũ / mã hãng của cùng mặt hàng: chỉ nhận khi trỏ tới DUY NHẤT một
       mặt hàng — trỏ tới nhiều mặt hàng thì trả về rỗng để người dùng chọn. */
    var k = m.khac[kd];
    return (k && k !== 'nhieu') ? k : null;
};
/**
 * Khung một bản ghi hàng hóa SẼ được tạo.
 * KHÔNG mang trường Mã hàng: Mã hàng chỉ do Danh mục Hàng hóa sinh ra khi
 * T.taoHangHoa được gọi. Mã đọc từ tệp là MODEL của nhà sản xuất.
 */
W.khungHangHoa = function (o) {
    var model = String(o.model || o.ma || '').trim();
    return {
        model: model, ten: String(o.ten || '').trim(),
        dvt: o.dvt || '', nhom: o.nhom || '', hang: o.nhaSanXuat || o.hang || '',
        nhaSanXuat: o.nhaSanXuat || o.hang || '', thuongHieu: o.nhaSanXuat || o.hang || '',
        quyCach: o.quyCach || '', thongSo: o.thongSo || '',
        ghiChu: o.ghiChu || '', maKhac: T.maKhacTu(o.maKhac, model), xuatXu: '', anh: '',
        theoDoiTon: true, theoDoiSerial: false, theoDoiLo: false,
        giaVon: 0, giaVonBQ: 0, ton: 0, tonDau: 0, tonToiThieu: 0, plId: '',
        trangThai: 'Đang kinh doanh', tuDongTao: true
    };
};
/**
 * Đối chiếu mã hàng cho một dòng đang nhập.
 * Trả về { hh, moi } — hh là hàng hóa đã có, moi là bản ghi sẽ tạo khi xác nhận.
 * Ghi cảnh báo (không phải lỗi) vào kt để người dùng biết trước khi lưu.
 */
W.hangHoaChoDong = function (kt, c) {
    var ma = kt.o(c.ma);
    if (!ma) {
        kt.them(c.ma, 'thiếu mã hàng',
            'Nhập mã hàng vào cột "' + c.ma + '". Mã chưa có trong danh mục sẽ được hệ thống tự tạo mới.');
        return null;
    }
    var ten = c.ten ? kt.o(c.ten) : '';
    var ts = c.thongSo ? kt.o(c.thongSo) : '';
    var qc = c.quyCach ? kt.o(c.quyCach) : '';
    /* NHẬN DIỆN DÙNG CHUNG — Model + Tên hàng + Thông số kỹ thuật.
       Xác định đúng mặt hàng thì dùng ngay Mã hàng hiện có, không hỏi lại. */
    var kq = T.nhanDienHangHoa({ ma: ma, model: ma, ten: ten, thongSo: ts, quyCach: qc });
    if (kq.hh) return { hh: kq.hh, moi: null };

    /* CÒN NHIỀU MẶT HÀNG KHỚP → TUYỆT ĐỐI KHÔNG TẠO MỚI.
       Danh mục đã có đúng những mặt hàng này; tạo thêm một bản ghi nữa là sinh
       dữ liệu trùng. Màn hình xem trước tệp không có hộp thoại chọn, nên báo rõ
       để người dùng ghi thêm Thông số kỹ thuật — chỉ một cột là tách được. */
    if (kq.nhieu && kq.nhieu.length > 1) {
        kt.them(c.thongSo || c.ten || c.ma,
            'Model "' + ma + '"' + (ten ? ' và tên hàng "' + ten + '"' : '') +
            ' đang khớp ' + kq.nhieu.length + ' mặt hàng trong Danh mục: ' +
            kq.nhieu.slice(0, 4).map(function (h) {
                return h.ma + (h.thongSo ? ' (' + h.thongSo + ')' : '');
            }).join(' · ') + (kq.nhieu.length > 4 ? '…' : ''),
            'Ghi thêm cột Thông số kỹ thuật đúng cấu hình để hệ thống nhận đúng một mặt hàng. ' +
            'Không nên để hệ thống tạo mặt hàng mới — Danh mục đã có sẵn.');
        return null;
    }

    if (!ten) {
        kt.them(c.ten || c.ma, 'Model "' + ma + '" chưa xác định được mặt hàng nào và dòng này chưa có tên hàng',
            'Ghi thêm Tên hàng (và Thông số kỹ thuật nếu có) để hệ thống nhận đúng mặt hàng, ' +
            'hoặc khai mặt hàng trong Danh mục Hàng hóa trước.');
        return null;
    }

    /* Chưa có trong danh mục → sẽ TẠO MẶT HÀNG MỚI, giữ nguyên Model của hãng.
       Mã hàng do Danh mục sinh ra ở bước ghi, không sinh trong chứng từ. */
    var moi = W.khungHangHoa({
        model: ma, ten: ten,
        dvt: c.dvt ? kt.o(c.dvt) : '', nhom: c.nhom ? kt.o(c.nhom) : '',
        nhaSanXuat: c.nhaSanXuat ? kt.o(c.nhaSanXuat) : '',
        quyCach: qc, thongSo: ts,
        ghiChu: c.ghiChu ? kt.o(c.ghiChu) : ''
    });
    kt.canh(c.ma, 'mặt hàng chưa có trong Danh mục Hàng hóa — sẽ tạo mới, giữ nguyên Model "' + ma + '"',
        'Danh mục sẽ tự sinh Mã hàng nội bộ cho mặt hàng này. Không phải sửa tệp Excel.');
    return { hh: null, moi: moi };
};
/** Gọi ở bước ghi: tạo hàng hóa nếu chưa có, không bao giờ tạo hai bản ghi. */
W.chotHangHoa = function (x) {
    if (!x) return null;
    if (x.hh) return x.hh;
    if (!x.moi) return null;
    /* CỬA DUY NHẤT — Danh mục Hàng hóa cấp Mã hàng. T.taoHangHoa tự trả về bản
       ghi cũ nếu mặt hàng đã có (trùng Model + Tên hàng + Thông số kỹ thuật). */
    return T.taoHangHoa(x.moi);
};
/* ==========================================================================
   CỬA "TẠO MỚI MẶT HÀNG" DÙNG CHUNG CHO MỌI PHÂN HỆ
   --------------------------------------------------------------------------
   Bảng giá · Nhập hàng · Báo giá · Đơn bán hàng · Hợp đồng — mọi chứng từ có
   dòng hàng đều đi qua đây trước khi lưu.

     · Dòng nào NHẬN DIỆN ĐƯỢC mặt hàng (Model + Tên hàng + Thông số kỹ thuật)
       thì liên kết ngay với Mã hàng hiện có. KHÔNG hỏi lại, không hiện popup.
     · Dòng nào CHƯA CÓ trong Danh mục thì hệ thống dừng lại một lần duy nhất,
       liệt kê đúng những mặt hàng đó và hỏi "Tạo mới mặt hàng".
     · Người dùng xác nhận: Danh mục Hàng hóa sinh Mã hàng nội bộ, lưu mặt hàng,
       giữ nguyên Model · Tên hàng · Thông số kỹ thuật · Đơn vị tính. Sau đó tự
       quay lại chứng từ và liên kết ngay từng dòng với Mã hàng vừa tạo.

   Chứng từ KHÔNG BAO GIỜ tự sinh Mã hàng.
   ========================================================================== */
/**
 * ĐỐI CHIẾU DÒNG CHỨNG TỪ VỚI DANH MỤC HÀNG HÓA.
 *
 * tuyChon.xacNhan === true  → KHÔNG tự khai mặt hàng mới vào Danh mục.
 *   Hệ thống dừng lại, liệt kê những Model chưa có và chờ người dùng xác nhận.
 *   Phân hệ Nhập hàng bật cờ này: một đơn nhập hàng KHÔNG được phép âm thầm làm
 *   thay đổi Danh mục Hàng hóa của toàn hệ thống.
 * Bỏ trống thì luồng chạy y như cũ — các đường nhập danh mục và bảng giá không
 * bị đổi hành vi.
 */
W.dongBoHangHoa = function (lines, xong, huy, tuyChon) {
    tuyChon = tuyChon || {};
    function boNgang() { if (huy) huy(); }
    var ds = (lines || []).filter(function (l) {
        return String(l.maHang || l.model || l.tenHang || '').trim();
    });
    var chuaCo = [], theoKhoa = {};
    var moHo = [], theoKhoaMH = {};
    ds.forEach(function (l) {
        /* Dòng đã mang ID nội bộ và ID đó còn thật thì không phải đối chiếu lại. */
        if (l.hangHoaId && T.chiMucHangHoa().id[l.hangHoaId]) return;
        var o = { model: l.model || l.maHang || '', ten: l.tenHang || '',
                  thongSo: l.thongSo || '', quyCach: l.quyCach || '' };
        var kq = T.nhanDienHangHoa(o);
        /* NHẬN RA ĐÚNG MỘT MẶT HÀNG → liên kết ngay, lấy luôn toàn bộ dữ liệu
           liên quan, KHÔNG hỏi người dùng. */
        if (kq.hh) {
            /* Nhận ra qua Model gốc thì GIỮ NGUYÊN cách ghi của nguồn trên dòng. */
            T.ganIdDong(l, kq.hh, kq);
            l.maHang = kq.hh.ma; l._nhanDien = kq.theo;
            if (kq.bienThe) l._bienThe = kq.bienThe;
            return;
        }
        /* CÒN KHỚP NHIỀU BẢN GHI → đây là trường hợp DUY NHẤT phải hỏi. */
        if (kq.nhieu && kq.nhieu.length > 1) {
            /* KHÓA GỘP PHẢI MANG CẢ THÔNG SỐ KỸ THUẬT. Hai dòng cùng Model và
               cùng Tên hàng nhưng khác cấu hình là hai mặt hàng khác nhau và có
               hai danh sách ứng viên khác nhau — gộp chung sẽ áp lựa chọn của
               dòng này lên dòng kia. */
            var km = T.khoaHH(o) || T.kd((o.model || '') + '|' + (o.ten || ''));
            if (!theoKhoaMH[km]) {
                theoKhoaMH[km] = { khoa: km, o: o, ds: kq.nhieu, dong: [] };
                moHo.push(theoKhoaMH[km]);
            }
            theoKhoaMH[km].dong.push(l);
            return;
        }
        var k = T.khoaHH(o) || T.kd(o.model + '|' + o.ten);
        if (!theoKhoa[k]) {
            theoKhoa[k] = { khoa: k, dong: [],
                o: W.khungHangHoa({ model: o.model, ten: o.ten, dvt: l.dvt,
                                    thongSo: o.thongSo, quyCach: o.quyCach,
                                    nhaSanXuat: l.hang || '', ghiChu: '' }) };
            chuaCo.push(theoKhoa[k]);
        }
        theoKhoa[k].dong.push(l);
    });

    /* GỘP DÒNG KHÔNG KHAI CẤU HÌNH VÀO ĐÚNG MẶT HÀNG SẼ TẠO.
       Trong cùng một tệp, một dòng để trống Thông số kỹ thuật mà lại có đúng
       MỘT nhóm khác cùng Model + Tên hàng thì đó là cùng một mặt hàng — người
       nhập chỉ bỏ trống ô cấu hình. Không gộp thì hệ thống tạo hai bản ghi cùng
       Model, cùng Tên hàng, và mọi lần nhập sau đều phải hỏi lại. */
    (function gopDongTrongCauHinh() {
        if (chuaCo.length < 2) return;
        var theoTen = {};
        chuaCo.forEach(function (x) {
            var kt2 = T.kd(String(x.o.model || '') + '|' + String(x.o.ten || ''));
            (theoTen[kt2] = theoTen[kt2] || []).push(x);
        });
        var bo = [];
        Object.keys(theoTen).forEach(function (k) {
            var nhom = theoTen[k];
            if (nhom.length !== 2) return;
            var trong = nhom.filter(function (x) {
                return !String(x.o.thongSo || x.o.quyCach || '').trim();
            });
            if (trong.length !== 1) return;
            var giu = nhom.filter(function (x) { return x !== trong[0]; })[0];
            trong[0].dong.forEach(function (l) { giu.dong.push(l); });
            bo.push(trong[0]);
        });
        if (bo.length) chuaCo = chuaCo.filter(function (x) { return bo.indexOf(x) < 0; });
    })();

    /* Hỏi phần MƠ HỒ trước, xong mới xử lý phần chưa có — mỗi thứ đúng một lần. */
    if (moHo.length) return chonMatHangMoHo(moHo, function () {
        tiepPhanChuaCo();
    }, boNgang);
    return tiepPhanChuaCo();

    function tiepPhanChuaCo() {
    if (!chuaCo.length) return xong(0);

    /* Mặt hàng chưa có Tên hàng thì không đủ dữ liệu để khai vào Danh mục. */
    var thieuTen = chuaCo.filter(function (x) { return !String(x.o.ten || '').trim(); });
    if (thieuTen.length) {
        UI.khongThe('Tạo mới mặt hàng',
            'Có ' + thieuTen.length + ' mặt hàng chưa có Tên hàng hóa.',
            'Mỗi mặt hàng phải có Tên hàng hóa thì Danh mục mới khai được. ' +
            'Bổ sung tên hàng rồi lưu lại.');
        return boNgang();
    }
    /* TỰ TẠO KHI DỮ LIỆU ĐÃ ĐỦ — không hỏi cho có.
       Mọi mặt hàng đều đã có Model và Tên hàng thì hệ thống khai thẳng vào Danh
       mục và liên kết ngay, người dùng không phải xác nhận thêm một bước nào.
       Chỉ dừng lại hỏi khi tệp thiếu Model — thứ hệ thống KHÔNG được tự bịa. */
    /* v18.5.0 — KHÔNG BAO GIỜ TẠO MẶT HÀNG MÀ KHÔNG HỎI.
       Trước đây, chỉ cần đủ Model và Tên hàng là hệ thống tự khai thẳng vào
       Danh mục. Cộng với việc bộ nhận diện chưa hiểu biến thể cách ghi, một tệp
       của nhà cung cấp ghi khác cách sẽ lặng lẽ đẻ ra mặt hàng trùng, kéo theo
       tách tồn kho và mất liên kết giá. Nay mọi luồng đều dừng lại hỏi; nơi gọi
       muốn giữ hành vi cũ phải nói rõ bằng tuyChon.tuTao. */
    if (chuaCo.every(function (x) { return String(x.o.model || '').trim(); }) && tuyChon.tuTao) {
        var nTuTao = 0;
        chuaCo.forEach(function (x) {
            var hh = T.taoHangHoa(x.o);
            if (!hh) return;
            nTuTao++;
            x.dong.forEach(function (l) { T.ganIdDong(l, hh); l.maHang = hh.ma; l._nhanDien = 'Tạo mới'; });
        });
        DB.save();
        if (nTuTao) UI.toast('ok', 'Đã tự khai ' + nTuTao + ' mặt hàng vào Danh mục',
            'Mã hàng do hệ thống sinh, Model giữ đúng của nhà sản xuất; ' +
            'các dòng chứng từ đã được liên kết ngay.', 7000);
        return xong(nTuTao);
    }
    /* Mặt hàng THIẾU MODEL luôn xếp lên đầu để chắc chắn nằm trong phần hiển
       thị được và người dùng khai được Model cho chúng. */
    chuaCo.sort(function (a2, b2) {
        return (String(a2.o.model || '').trim() ? 1 : 0) - (String(b2.o.model || '').trim() ? 1 : 0);
    });
    var thieuModel = chuaCo.filter(function (x) { return !String(x.o.model || '').trim(); }).length;
    var GIOI_HAN = 300;
    if (thieuModel > GIOI_HAN) {
        UI.khongThe('Tạo mới mặt hàng',
            'Có ' + T.num(thieuModel, 0) + ' mặt hàng chưa có Model — nhiều hơn số mặt hàng khai tay được ' +
            'trong một lần (' + GIOI_HAN + ').',
            'Bổ sung cột Model của nhà sản xuất vào tệp rồi nhập lại, hoặc chia nhỏ tệp. ' +
            'Model là trường bắt buộc của Danh mục Hàng hóa.');
        return boNgang();
    }

    UI.modal({
        size: 'lg', dismiss: false,
        title: tuyChon.xacNhan ? 'Cần kiểm tra và xác nhận Danh mục hàng hóa' : 'Tạo mới mặt hàng',
        sub: (tuyChon.nguon ? tuyChon.nguon + ' — ' : '') +
             'Có ' + chuaCo.length + ' mặt hàng chưa có trong Danh mục Hàng hóa',
        body: (tuyChon.xacNhan
            ? '<div class="note y mb12"><i class="bi bi-shield-exclamation"></i><div>' +
              '<b>Hệ thống ĐÃ DỪNG LẠI, chưa ghi gì vào Danh mục Hàng hóa.</b> ' +
              'Một đơn nhập hàng không được phép tự làm thay đổi Danh mục của toàn hệ thống. ' +
              'Hãy kiểm tra kỹ Model bên dưới: nếu đây chỉ là <b>cách viết khác</b> của một mặt hàng ' +
              'đã có, bấm <b>Hủy — quay lại</b> và sửa dòng chứng từ cho khớp Model chuẩn, ' +
              'đừng tạo thêm bản ghi thứ hai.<br>' +
              '<b>Mặt hàng đã có trong Danh mục KHÔNG bị đụng tới</b> — Mã hàng nội bộ và Model chuẩn ' +
              'giữ nguyên tuyệt đối.</div></div>'
            : '') +
            '<div class="note b mb12"><i class="bi bi-diagram-3-fill"></i><div>' +
            '<b>Danh mục Hàng hóa là dữ liệu gốc của toàn hệ thống.</b> Chứng từ không tự sinh Mã hàng.<br>' +
            'Xác nhận thì hệ thống lưu các mặt hàng dưới đây vào Danh mục, <b>tự sinh Mã hàng nội bộ</b>, ' +
            'giữ nguyên Model · Tên hàng · Thông số kỹ thuật · Đơn vị tính, rồi <b>tự quay lại chứng từ ' +
            'và liên kết ngay</b> với Mã hàng vừa tạo.</div></div>' +
            (thieuModel ? '<div class="note y mb12"><i class="bi bi-pencil-fill"></i><div>' +
                '<b>' + thieuModel + ' mặt hàng chưa có Model.</b> Model là trường bắt buộc — ' +
                'nhập đúng Model của nhà sản xuất vào ô Model bên dưới rồi mới tạo được.' +
                '</div></div>' : '') +
            '<div class="tbl-wrap" style="max-height:46vh"><table class="tbl"><thead><tr>' +
            '<th style="width:56px">TT</th><th style="width:230px">Model (nhà sản xuất)</th>' +
            '<th>Tên hàng hóa</th><th style="width:80px">ĐVT</th>' +
            '<th style="width:220px">Thông số kỹ thuật</th><th style="width:74px">Số dòng</th>' +
            '</tr></thead><tbody>' +
            chuaCo.slice(0, GIOI_HAN).map(function (x, i) {
                return '<tr><td class="ctr muted">' + (i + 1) + '</td>' +
                    '<td><input class="mono" data-md="' + i + '" value="' + T.esc(x.o.model) +
                        '" placeholder="Nhập Model của nhà sản xuất"></td>' +
                    '<td><span class="ellip">' + T.esc(x.o.ten) + '</span></td>' +
                    '<td class="ctr">' + T.esc(x.o.dvt || 'Cái') + '</td>' +
                    '<td class="small muted ellip">' + T.esc(x.o.thongSo || x.o.quyCach || '—') + '</td>' +
                    '<td class="ctr">' + x.dong.length + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            (chuaCo.length > GIOI_HAN ? '<div class="small muted mt8">… và ' + (chuaCo.length - GIOI_HAN) +
                                   ' mặt hàng khác chỉ hiện khi tệp nhỏ hơn</div>' : ''),
        buttons: [
            { text: 'Hủy — quay lại chứng từ', click: function (h) { h.close(); boNgang(); } },
            { text: 'Tạo mới ' + chuaCo.length + ' mặt hàng', cls: 'primary', icon: 'bi-plus-circle',
              click: function (h) {
                  /* Lấy lại Model người dùng vừa khai trong hộp thoại. */
                  h.el.querySelectorAll('[data-md]').forEach(function (e) {
                      var x = chuaCo[Number(e.getAttribute('data-md'))];
                      if (x) x.o.model = String(e.value || '').trim();
                  });
                  var con = chuaCo.filter(function (x) { return T.soatMatHang(x.o); });
                  if (con.length) return UI.toast('err', 'Còn ' + con.length + ' mặt hàng thiếu Model',
                      'Model là trường bắt buộc — nhập đúng Model của nhà sản xuất cho từng mặt hàng.');
                  var n = 0, ten = [];
                  chuaCo.forEach(function (x) {
                      var rec = T.taoHangHoa(x.o);
                      if (!rec) return;
                      n++; if (ten.length < 5) ten.push(rec.ma);
                      /* TỰ ĐỘNG QUAY LẠI CHỨNG TỪ VÀ LIÊN KẾT NGAY. */
                      x.dong.forEach(function (l) {
                          T.ganIdDong(l, rec);
                          l.maHang = rec.ma; l.model = rec.model;
                          if (!l.tenHang) l.tenHang = rec.ten;
                          if (!l.dvt) l.dvt = rec.dvt;
                      });
                  });
                  DB.save();
                  h.close();
                  if (n) UI.toast('ok', 'Đã tạo ' + n + ' mặt hàng trong Danh mục Hàng hóa',
                      'Mã hàng: ' + ten.join(', ') + (n > 5 ? '…' : '') +
                      ' — chứng từ đã liên kết ngay với các mã này.', 7000);
                  xong(n);
              } }
        ]
    });
    }
};

/* ==========================================================================
   CHỌN ĐÚNG MẶT HÀNG KHI MODEL + TÊN HÀNG CÒN KHỚP NHIỀU BẢN GHI
   --------------------------------------------------------------------------
   Đây là TRƯỜNG HỢP DUY NHẤT hệ thống hỏi người dùng khi nhập tệp. Ngoài ra,
   nhận ra thì liên kết ngay, chưa có thì tự tạo — không hỏi.
   ========================================================================== */
function chonMatHangMoHo(moHo, xong, huy) {
    var tong = moHo.reduce(function (s2, x) { return s2 + x.dong.length; }, 0);
    UI.modal({
        size: 'lg', dismiss: false,
        title: 'Chọn đúng mặt hàng',
        sub: moHo.length + ' trường hợp còn khớp nhiều mặt hàng trong Danh mục · ' +
             tong + ' dòng chứng từ',
        body: '<div class="note y mb12"><i class="bi bi-question-circle-fill"></i><div>' +
              'Danh mục đang có <b>nhiều mặt hàng cùng Model và cùng Tên hàng</b> nên hệ thống ' +
              'không tự kết luận được. Chọn đúng mặt hàng cho từng trường hợp dưới đây. ' +
              'Các dòng khác của tệp đã được nhận diện và liên kết xong.</div></div>' +
              '<div class="tbl-wrap" style="max-height:52vh"><table class="tbl"><thead><tr>' +
              '<th style="width:210px">Dữ liệu trong tệp</th><th style="width:70px" class="ctr">Số dòng</th>' +
              '<th>Chọn mặt hàng trong Danh mục</th></tr></thead><tbody>' +
              moHo.map(function (x, i) {
                  return '<tr><td><b>' + T.esc(x.o.model || '—') + '</b>' +
                      '<div class="small muted ellip">' + T.esc(x.o.ten || '') + '</div>' +
                      (x.o.thongSo ? '<div class="small muted ellip">' + T.esc(x.o.thongSo) + '</div>' : '') +
                      '</td><td class="ctr">' + x.dong.length + '</td>' +
                      '<td><select data-mh="' + i + '">' +
                      x.ds.map(function (h, j) {
                          return '<option value="' + j + '">' + T.esc(h.ma) + ' · ' + T.esc(h.ten) +
                              (h.thongSo ? ' · ' + T.esc(String(h.thongSo).substr(0, 60)) : '') +
                              (h.dvt ? ' (' + T.esc(h.dvt) + ')' : '') + '</option>';
                      }).join('') + '</select></td></tr>';
              }).join('') + '</tbody></table></div>',
        buttons: [
            { text: 'Hủy — quay lại chứng từ', icon: 'bi-arrow-left', click: function (h) {
                h.close(); if (huy) huy();
            } },
            { text: 'Dùng mặt hàng đã chọn', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                h.el.querySelectorAll('[data-mh]').forEach(function (e) {
                    var x = moHo[Number(e.getAttribute('data-mh'))];
                    var hh = x && x.ds[Number(e.value)];
                    if (!hh) return;
                    x.dong.forEach(function (l) {
                        T.ganIdDong(l, hh); l.maHang = hh.ma; l._nhanDien = 'Người dùng chọn';
                    });
                });
                h.close();
                UI.toast('ok', 'Đã liên kết ' + tong + ' dòng theo lựa chọn của anh');
                xong();
            } }
        ]
    });
}

/* Giữ tên gọi cũ để mọi phân hệ đang dùng đều được nâng cấp theo. */
W.nhapExcel = function (cfg) { W.nhapDuLieu(cfg); };

})(window);

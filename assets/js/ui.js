/* ==========================================================================
   TVERP — THƯ VIỆN GIAO DIỆN
   Thông báo, cửa sổ popup, hộp xác nhận, bảng dữ liệu (tìm - lọc - sắp xếp -
   phân trang - chọn dòng), combobox tìm kiếm, nhập/xuất Excel, xem trước & in.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = {};

/* =============================================================== THÔNG BÁO */
var ICO = { ok: 'bi-check-circle-fill', err: 'bi-x-circle-fill', warn: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
UI.toast = function (kieu, tieu, mota, ms) {
    var box = document.getElementById('toasts');
    var d = document.createElement('div');
    d.className = 'toast ' + kieu;
    d.innerHTML = '<i class="bi ' + (ICO[kieu] || ICO.info) + '"></i><div><b>' + T.esc(tieu) + '</b>' +
        (mota ? '<small>' + T.esc(mota) + '</small>' : '') + '</div>';
    box.appendChild(d);
    setTimeout(function () {
        d.classList.add('out');
        setTimeout(function () { d.remove(); }, 220);
    }, ms || 3200);
};

/* =============================================================== POPUP */
var zStack = [];

/* Nút trên hộp thoại không có thuộc tính data-* để tra, nên suy màu theo chính
   chữ trên nút. Cùng một việc thì cùng một màu, dù hộp thoại nào gọi ra. */
var CHU_MAU = [
    /* ĐỎ — phá dữ liệu. Xét trước tiên để "Xóa hàng loạt" không rơi vào nhóm khác. */
    { cls: 'danger', tu: ['xoa', 'huy', 'huy duyet', 'huy phieu', 'huy chung tu', 'don sach',
                          'bo ghi so', 'go bo', 'thu hoi', 'khoi phuc', 'dat lai mat khau',
                          'ngung ap dung', 'nap lai du lieu goc'] },
    /* XANH LÁ — ghi nhận, chốt sổ. */
    { cls: 'ok-solid', tu: ['nhap kho', 'xac nhan', 'ghi so', 'duyet', 'hoan thanh', 'chot',
                            'luu va', 'khoi phuc du lieu', 'sao luu ngay', 'dong y'] },
    { cls: 'ok', tu: ['luu', 'khoa', 'mo khoa', 'nghiem thu', 'giao hang', 'thanh ly',
                      'phan bo chi phi', 'ap dung'] },
    /* CAM — rà soát, tính lại, làm mới, chờ xử lý. */
    { cls: 'warn', tu: ['tinh lai', 'kiem tra', 'doi chieu', 'ra soat', 'chinh lai', 'bo loc',
                        'lam moi', 'bo sung', 'gop du lieu', 'gop cac ban ghi', 'gop chung tu',
                        'dong bo', 'doi trang thai', 'gan lai',
                        'sua hang loat'] },
    /* TÍM — đọc số. */
    { cls: 'report', tu: ['bao cao', 'phan tich', 'thong ke', 'truy vet', 'bang dieu hanh'] },
    /* XANH DƯƠNG — tạo mới, xem, xuất nhập tệp. */
    { cls: 'primary', tu: ['them moi', 'them ', 'lap ', 'tao moi', 'tao '] },
    { cls: 'ok', tu: ['dat mac dinh', 'kich hoat'] },
    { cls: 'info-line', tu: ['xem', 'in ', 'in hang loat', 'xuat', 'nhap tu tep', 'nhap excel',
                             'nhap tep', 'tai tep', 'tai mau', 'tai ve', 'pdf', 'excel', 'word',
                             'sua', 'sao chep', 'chon', 'chon tat ca', 'bo chon', 'ho so', 'gui',
                             'mo danh sach', 'chi tiet', 'dong',
                             /* Nút mở một màn hình khác — vẫn là việc xem. */
                             'mo ', 'so sanh', 'lich su', 'tep goc', 'loai gia', 'chinh sach gia',
                             'tai ban', 'the kho cua',
                             'du an', 'don vi tinh', 'thue suat', 'dieu khoan', 'loai hop dong',
                             'nguoi ky', 'thong tin kho', 'nhat ky', 'thung rac', 'khoan muc'] }
];
/* Khớp theo RANH GIỚI TỪ, không theo chuỗi con. "Xóa" không được khớp vào giữa
   một chữ khác, và "áp dụng" trong "Chỉ áp dụng cho dòng thêm mới" không được
   kéo cả câu về màu xanh lá. Bộ nhớ đệm giữ lại regex đã dựng. */
var RE_CHU = {};
function reTu(tu) {
    if (!RE_CHU[tu])
        RE_CHU[tu] = new RegExp('(^|[^a-z0-9])' + tu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                                '([^a-z0-9]|$)');
    return RE_CHU[tu];
}
function mauTheoChu(t) {
    var k = W.T ? W.T.kd(String(t || '')) : String(t || '').toLowerCase();
    k = k.replace(/\s+/g, ' ').trim();
    if (!k) return '';
    for (var i = 0; i < CHU_MAU.length; i++)
        for (var j = 0; j < CHU_MAU[i].tu.length; j++) {
            var tu = (W.T ? W.T.kd(CHU_MAU[i].tu[j]) : CHU_MAU[i].tu[j]).trim();
            if (tu && reTu(tu).test(k)) return CHU_MAU[i].cls;
        }
    return '';
}
UI.mauTheoChu = mauTheoChu;

UI.modal = function (o) {
    var bg = document.createElement('div');
    bg.className = 'modal-bg';
    var btns = (o.buttons || []).map(function (b, i) {
        return '<button class="btn ' + (b.cls || mauTheoChu(b.text)) + '" data-mb="' + i + '">' +
            (b.icon ? '<i class="bi ' + b.icon + '"></i>' : '') + T.esc(b.text) + '</button>';
    });
    var leftB = [], rightB = [];
    (o.buttons || []).forEach(function (b, i) { (b.left ? leftB : rightB).push(btns[i]); });
    bg.innerHTML =
        '<div class="modal ' + (o.size || 'md') + '" role="dialog">' +
          '<div class="modal-h"><div><h3>' + T.esc(o.title || '') + '</h3>' +
            (o.sub ? '<div class="sub">' + T.esc(o.sub) + '</div>' : '') + '</div>' +
            '<button class="x" data-close title="Đóng (Esc)">&times;</button></div>' +
          '<div class="modal-b">' + (o.body || '') + '</div>' +
          ((o.buttons && o.buttons.length) ?
            '<div class="modal-f">' + leftB.join('') + '<span class="spacer"></span>' + rightB.join('') + '</div>' : '') +
        '</div>';
    document.body.appendChild(bg);
    zStack.push(bg);

    var h = {
        el: bg,
        box: bg.querySelector('.modal'),
        body: bg.querySelector('.modal-b'),
        close: function () {
            bg.remove();
            zStack = zStack.filter(function (x) { return x !== bg; });
            if (o.onClose) o.onClose();
        },
        q: function (s) { return bg.querySelector(s); },
        qa: function (s) { return Array.prototype.slice.call(bg.querySelectorAll(s)); }
    };
    /* Nút X và phím Esc luôn gọi h.close ĐANG HIỆN HÀNH — màn hình nào ghi đè
       h.close để dọn dẹp (hủy thao tác, trả lại giá trị cũ) thì cũng chạy đúng. */
    bg.querySelector('[data-close]').onclick = function () { h.close(); };
    bg.addEventListener('mousedown', function (e) {
        if (e.target === bg && o.dismiss !== false) h.close();
    });
    (o.buttons || []).forEach(function (b, i) {
        var el = bg.querySelector('[data-mb="' + i + '"]');
        if (el) el.onclick = function () { if (b.click) b.click(h); else h.close(); };
    });
    /* Nút do màn hình cắm vào THÂN hộp thoại cũng phải có màu nhận diện — trước
       đây chỉ hàng nút dưới chân được tô, nên nút trong thân trôi về xám. Chạy
       sau onOpen để bắt cả những nút mới dựng trong đó. */
    if (o.onOpen) o.onOpen(h);
    UI.mauNut(bg);
    setTimeout(function () {
        var f = bg.querySelector('[autofocus],input:not([type=hidden]):not([disabled]),select,textarea');
        if (f && o.focus !== false) try { f.focus(); } catch (e) { }
    }, 40);
    return h;
};

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && zStack.length) {
        var top = zStack[zStack.length - 1];
        var x = top.querySelector('[data-close]');
        if (x) x.click();
    }
});

UI.confirm = function (o) {
    return UI.modal({
        size: 'sm', title: o.title || 'Xác nhận',
        body: '<div class="row" style="gap:12px;align-items:flex-start">' +
              '<i class="bi ' + (o.icon || 'bi-question-circle-fill') + '" style="font-size:28px;color:' +
              (o.danger ? 'var(--err)' : 'var(--brand)') + '"></i>' +
              '<div style="flex:1"><div style="font-size:14.5px">' + (o.message || '') + '</div>' +
              (o.note ? '<div class="note ' + (o.danger ? 'r' : 'b') + ' mt12"><i class="bi bi-info-circle"></i><div>' + o.note + '</div></div>' : '') +
              '</div></div>',
        /* o.phu — lựa chọn thứ ba (ví dụ "Dựng lại theo biểu mẫu chuẩn"), để
           người dùng không bị dồn vào chỉ hai lối Đồng ý / Hủy. */
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } }
        ].concat(o.phu ? [{ text: o.phuText || 'Cách khác', icon: o.phuIcon || 'bi-arrow-repeat',
              click: function (h) { h.close(); o.phu(); } }] : [])
        .concat([
            { text: o.okText || 'Đồng ý', cls: o.danger ? 'danger-solid' : 'primary',
              icon: o.okIcon || (o.danger ? 'bi-trash' : 'bi-check-lg'),
              click: function (h) { h.close(); if (o.ok) o.ok(); } }
        ])
    });
};

/** Hộp thoại nhập một dòng chữ: { title, nhan, giaTri, okText, ok(giaTri) } */
UI.prompt = function (o) {
    return UI.modal({
        size: 'sm', title: o.title || 'Nhập nội dung',
        body: '<div class="fld"><label>' + T.esc(o.nhan || 'Nội dung') + '</label>' +
              '<input id="upNhap" value="' + T.esc(o.giaTri || '') + '" autofocus></div>' +
              (o.moTa ? '<div class="small muted mt8">' + o.moTa + '</div>' : ''),
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } },
            { text: o.okText || 'Đồng ý', cls: 'primary', icon: o.okIcon || 'bi-check-lg',
              click: function (h) {
                  var v = (h.q('#upNhap').value || '').trim();
                  if (!v) return UI.toast('err', 'Chưa nhập nội dung', o.nhan || '');
                  h.close(); if (o.ok) o.ok(v);
              } }
        ],
        onOpen: function (h) {
            var e = h.q('#upNhap');
            e.onkeydown = function (ev) {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    var v = (e.value || '').trim();
                    if (!v) return;
                    h.close(); if (o.ok) o.ok(v);
                }
            };
            setTimeout(function () { e.focus(); e.select(); }, 60);
        }
    });
};

UI.xoa = function (ten, ok) {
    UI.confirm({
        title: 'Xác nhận xóa', danger: true, icon: 'bi-exclamation-triangle-fill',
        message: 'Bạn có chắc chắn muốn xóa <b>' + T.esc(ten) + '</b> không?',
        note: 'Dữ liệu sẽ được chuyển vào <b>Thùng rác</b> — có thể khôi phục tại <i>Hệ thống → Thùng rác</i>.',
        okText: 'Xóa', ok: ok
    });
};

/* =============================================================== PHÂN QUYỀN TRÊN GIAO DIỆN */
/** Bản đồ: quyền → các nút mang thuộc tính data-… tương ứng */
var NUT_QUYEN = {
    them: ['them', 'chep', 'next'], sua: ['sua'], xoa: ['xoa'], in: ['in'],
    pdf: ['pdf'], excelXuat: ['xuat', 'xlbm'], excelNhap: ['nhap', 'nhapxl', 'nhapbg'],
    duyet: ['ghi', 'huyghi', 'duyet'], khoa: ['khoa']
};
/** Gỡ bỏ khỏi giao diện những nút mà vai trò hiện tại không được phép dùng. */
/* ==========================================================================
   MÀU NHẬN DIỆN NÚT — MỘT NƠI QUYẾT ĐỊNH CHO CẢ PHẦN MỀM
   --------------------------------------------------------------------------
   Trước đây mỗi màn hình tự chọn lớp CSS cho từng nút, nên cùng một việc lại
   mang màu khác nhau ở hai nơi, và phần lớn nút trôi về màu xám mặc định.
   Nay màu do ĐÚNG MỘT bảng dưới đây quyết định, ánh xạ theo chính thuộc tính
   data-* của nút — thêm màn hình mới cũng tự có màu đúng, không phải nhớ.

   Màn hình vẫn được quyền tự khai màu: nút nào đã mang sẵn một lớp màu thì
   giữ nguyên, bảng này chỉ tô cho những nút chưa khai.
   ========================================================================== */
var MAU_NUT = {
    /* XANH LÁ — ghi nhận, chốt sổ */
    'ok-solid': ['nhapkho', 'duyet', 'ghiso', 'hoanthanh', 'xacnhan', 'chot'],
    ok:         ['pb', 'boghi', 'khoa', 'mokhoa', 'nt', 'giao', 'thanhly'],
    /* XANH DƯƠNG — tạo mới và xem */
    primary:    ['them'],
    'info-line': ['xem', 'nhap', 'nhapxl', 'xl', 'xuat', 'mau', 'in', 'pdf', 'word',
                  'excel', 'chep', 'sua', 'pnk', 'ct', 'email', 'gui',
                  /* Nút điều hướng sang màn hình khác cũng là "việc xem". */
                  'nav', 'goto', 'mo', 'mobg', 'ls', 'tep', 'sosanh', 'tai', 'giu', 'tk'],
    /* CAM — rà soát, tính lại, chờ xử lý */
    warn:       ['ktra', 'kiemtra', 'kt', 'tinhlai', 'doichieu', 'rasoat', 'thuhoi',
                 'bosung', 'gop', 'lam', 'dong'],
    /* ĐỎ — phá dữ liệu */
    danger:     ['xoa', 'huy', 'khoiphuc', 'kp', 'xoahet', 'donsach', 'naplai'],
    /* TÍM — đọc số */
    report:     ['baocao', 'dashboard', 'phantich', 'thongke', 'truyvet']
};
var _mauTheoAct = null;
function bangMauNut() {
    if (_mauTheoAct) return _mauTheoAct;
    _mauTheoAct = {};
    Object.keys(MAU_NUT).forEach(function (cls) {
        MAU_NUT[cls].forEach(function (act) { _mauTheoAct[act] = cls; });
    });
    return _mauTheoAct;
}
var LOP_MAU = ['ok', 'ok-solid', 'primary', 'info', 'info-line', 'warn', 'warn-solid',
               'danger', 'danger-solid', 'report', 'report-solid', 'ghost'];

/**
 * TÔ MÀU NHẬN DIỆN CHO MỌI NÚT TRONG MỘT VÙNG.
 * Gọi một lần sau khi dựng xong màn hình; gọi lại bao nhiêu lần cũng không sao.
 */
UI.mauNut = function (root) {
    if (!root) return;
    var bang = bangMauNut();
    root.querySelectorAll('button.btn').forEach(function (b) {
        /* Màn hình đã tự khai màu thì tôn trọng. */
        for (var i = 0; i < LOP_MAU.length; i++)
            if (b.classList.contains(LOP_MAU[i])) return;
        var act = '';
        for (var j = 0; j < b.attributes.length; j++) {
            var n = b.attributes[j].name;
            if (n.indexOf('data-') !== 0) continue;
            var k = n.slice(5);
            if (bang[k]) { act = k; break; }
        }
        if (!act) {
            var da = b.getAttribute('data-act');
            if (da && bang[da]) act = da;
        }
        if (act) { b.classList.add(bang[act]); return; }
        /* Không tra được theo thuộc tính thì suy theo chính chữ trên nút — nhờ
           vậy cả thanh thao tác hàng loạt và các nút riêng của từng màn hình
           đều có màu đúng nhóm, không nút nào trôi về xám. */
        var m = mauTheoChu(b.textContent || b.getAttribute('title') || '');
        if (m) b.classList.add(m);
    });
};

UI.apQuyen = function (root, mod) {
    if (!W.Q) return;
    Object.keys(NUT_QUYEN).forEach(function (right) {
        if (W.Q.co(mod, right)) return;
        NUT_QUYEN[right].forEach(function (n) {
            root.querySelectorAll('[data-' + n + ']').forEach(function (b) { b.remove(); });
        });
    });
    // gỡ dấu ngăn cách thừa sau khi bớt nút
    root.querySelectorAll('.toolbar').forEach(function (tb) {
        var last = null;
        Array.prototype.slice.call(tb.children).forEach(function (c) {
            if (c.classList.contains('tb-sep')) {
                if (!last || last.classList.contains('tb-sep')) { c.remove(); return; }
            }
            last = c;
        });
        if (last && last.classList.contains('tb-sep')) last.remove();
    });
    UI.mauNut(root);
};
/** Báo cho người dùng biết thao tác bị chặn vì thiếu quyền. */
UI.thieuQuyen = function (mod, act) {
    var p = W.Q.theoMa(mod);
    UI.toast('err', 'Không đủ quyền',
        'Vai trò "' + W.Q.vaiTro().ten + '" không có quyền ' + W.Q.tenHanhDong(act).toLowerCase() +
        ' trên phân hệ ' + (p ? p.t : mod) + '.');
    return false;
};
/** Chứng từ đã khóa thì không cho sửa / xóa. */
UI.daKhoa = function (r) {
    if (!r || !r.khoa) return false;
    UI.toast('warn', 'Chứng từ đã bị khóa',
        (r.so || '') + ' đang ở trạng thái khóa. Cần quyền “Khóa chứng từ” để mở khóa trước khi sửa.');
    return true;
};

/* =============================================================== BẢNG DỮ LIỆU */
var gridSeq = 0;
UI.Grid = function (o) {
    var g = this;
    // cột có thuộc tính an:true bị ẩn hoàn toàn (dùng cho phân quyền xem giá vốn / lợi nhuận)
    o.cols = (o.cols || []).filter(function (c) { return !c.an; });
    g.o = o;
    g.id = 'g' + (++gridSeq);
    g.rows = o.rows || [];
    g.q = '';
    g.f = {};
    g.sortK = o.sortK || null;
    g.sortD = o.sortD || 1;
    g.page = 1;
    g.size = o.pageSize || 25;
    g.selId = null;
    g.chon = {};                                   // { id: true } — các dòng đang được tích chọn
    // Cấu hình riêng của từng người dùng cho từng lưới: cột nào ẩn, bao nhiêu dòng mỗi trang
    g.maLuoi = o.luoi || o.mount || '';
    var cfgLuoi = UI.cauHinhLuoi(g.maLuoi);
    g.an = cfgLuoi.an || {};
    if (cfgLuoi.size) g.size = cfgLuoi.size;
    if (cfgLuoi.sortK) { g.sortK = cfgLuoi.sortK; g.sortD = cfgLuoi.sortD || 1; }
    g.cotDay = o.cols.slice();                     // toàn bộ cột, kể cả cột đang ẩn
    g.host = typeof o.mount === 'string' ? document.querySelector(o.mount) : o.mount;
    // Thanh công cụ được vẽ MỘT LẦN và nằm ngoài vùng vẽ lại,
    // nhờ vậy các nút trên thanh công cụ không bao giờ mất sự kiện khi bảng vẽ lại.
    g.host.innerHTML = '<div data-gtb></div><div data-gbody></div>';
    g.tb = g.host.querySelector('[data-gtb]');
    g.body = g.host.querySelector('[data-gbody]');
    if (o.toolbar !== false) {
        g.tb.innerHTML = '<div class="toolbar">' + (o.toolbar || '') +
            '<span class="tb-info" data-count></span>' +
            '<button class="btn btn-ico" data-cot title="Chọn cột hiển thị"><i class="bi bi-layout-three-columns"></i></button>' +
            '</div>' +
            (o.chon ? '<div class="bulkbar hide" data-bulkbar></div>' : '');
        var bc = g.tb.querySelector('[data-cot]');
        if (bc) bc.onclick = function () { g.chonCot(); };
        /* Tô màu ngay khi dựng thanh công cụ — màn hình nào quên gọi UI.apQuyen
           thì nút vẫn có màu đúng nhóm nghiệp vụ. */
        UI.mauNut(g.tb);
    }
    g.render();
};

/* Đầu bảng đổ bóng khi bảng đã cuộn — người dùng biết mình đang ở giữa danh
   sách chứ không phải ở đầu. */
UI.theoDoiCuon = function (root) {
    (root || document).querySelectorAll('.tablewrap,.tbl-wrap').forEach(function (w) {
        if (w._theoDoi) return;
        w._theoDoi = true;
        w.addEventListener('scroll', function () {
            w.classList.toggle('da-cuon', w.scrollTop > 2);
        });
    });
};

/**
 * KHUNG XƯƠNG LÚC ĐANG TẢI — dùng khi màn hình phải dựng một bảng lớn.
 * Người dùng thấy ngay hình dạng của bảng sắp hiện thay vì một vùng trắng.
 */
UI.khungXuong = function (soDong, soCot) {
    var d = soDong || 6, c = soCot || 6, h = '', i, j;
    for (i = 0; i < d; i++) {
        h += '<tr class="skel-row">';
        for (j = 0; j < c; j++)
            h += '<td><span class="skel' + (j % 3 === 1 ? ' d2' : j % 3 === 2 ? ' d3' : '') +
                 '" style="width:' + (j === 1 ? 88 : 55 + (j * 7) % 35) + '%"></span></td>';
        h += '</tr>';
    }
    return h;
};
UI.bangKhungXuong = function (soDong, soCot) {
    return '<div class="tablewrap"><table class="grid"><tbody>' +
        UI.khungXuong(soDong, soCot) + '</tbody></table></div>';
};

UI.Grid.prototype.data = function () {
    var g = this, o = g.o, r = g.rows.slice();
    // lọc theo bộ lọc
    (o.filters || []).forEach(function (f) {
        var v = g.f[f.k];
        if (v === undefined || v === '' || v === null) return;
        r = r.filter(function (x) {
            if (f.test) return f.test(x, v);
            return String(x[f.k] === undefined ? '' : x[f.k]) === String(v);
        });
    });
    // tìm kiếm nhanh
    if (g.q) {
        var k = T.kd(g.q), fs = o.search || Object.keys(r[0] || {});
        r = r.filter(function (x) {
            for (var i = 0; i < fs.length; i++) {
                if (T.kd(x[fs[i]]).indexOf(k) >= 0) return true;
            }
            return false;
        });
    }
    // sắp xếp
    if (g.sortK) {
        var col = (o.cols || []).filter(function (c) { return c.k === g.sortK; })[0] || {};
        r.sort(function (a, b) {
            var x = col.sortVal ? col.sortVal(a) : a[g.sortK], y = col.sortVal ? col.sortVal(b) : b[g.sortK];
            if (typeof x === 'number' || typeof y === 'number') return ((x || 0) - (y || 0)) * g.sortD;
            return T.kd(x).localeCompare(T.kd(y), 'vi') * g.sortD;
        });
    }
    return r;
};

UI.Grid.prototype.render = function () {
    var g = this, o = g.o;
    o.cols = (g.cotDay || o.cols).filter(function (c) { return !g.an[c.k]; });
    var all = g.data();
    var tot = all.length;
    var pages = Math.max(1, Math.ceil(tot / g.size));
    if (g.page > pages) g.page = pages;
    var view = g.size === 0 ? all : all.slice((g.page - 1) * g.size, g.page * g.size);
    g.viewRows = view; g.allRows = all;

    var h = '';

    /* --- bộ lọc --- */
    var fl = '';
    if (o.searchBox !== false) {
        fl += '<div class="fld grow" style="max-width:330px"><label>Tìm kiếm</label>' +
              '<input type="search" data-q placeholder="' + T.esc(o.searchPlaceholder || 'Gõ để tìm ngay...') +
              '" value="' + T.esc(g.q) + '"></div>';
    }
    (o.filters || []).forEach(function (f) {
        fl += '<div class="fld" style="min-width:' + (f.w || 165) + 'px"><label>' + T.esc(f.t) + '</label>';
        if (f.type === 'date') {
            fl += '<input type="date" data-fl="' + f.k + '" value="' + T.esc(g.f[f.k] || '') + '">';
        } else {
            fl += '<select data-fl="' + f.k + '"><option value="">— Tất cả —</option>' +
                (f.opts || []).map(function (x) {
                    var v = typeof x === 'object' ? x.v : x, t = typeof x === 'object' ? x.t : x;
                    return '<option value="' + T.esc(v) + '"' + (String(g.f[f.k]) === String(v) ? ' selected' : '') + '>' + T.esc(t) + '</option>';
                }).join('') + '</select>';
        }
        fl += '</div>';
    });
    if (fl) {
        fl += '<div class="fld"><label>&nbsp;</label><button class="btn" data-clear title="Xóa toàn bộ điều kiện lọc"><i class="bi bi-x-circle"></i> Bỏ lọc</button></div>';
        h += '<div class="filters">' + fl + '</div>';
    }

    /* --- bảng --- */
    h += '<div class="tablewrap"' + (o.height ? ' style="max-height:' + o.height + '"' : '') + '><table class="grid"><thead><tr>';
    if (o.chon) {
        var tatCa = all.length > 0 && all.every(function (x) { return g.chon[x.id]; });
        h += '<th style="width:36px" class="ctr"><input type="checkbox" data-chon-all' + (tatCa ? ' checked' : '') +
             ' title="Chọn / bỏ chọn tất cả bản ghi đang hiển thị"></th>';
    }
    if (o.stt !== false) h += '<th style="width:44px" class="ctr">TT</th>';
    (o.cols || []).forEach(function (c) {
        var cls = (c.cls || '') + (c.sort === false ? '' : ' sortable') +
                  (g.sortK === c.k ? (g.sortD > 0 ? ' asc' : ' desc') : '');
        h += '<th class="' + cls.trim() + '"' + (c.w ? ' style="width:' + c.w + 'px"' : '') +
             (c.sort === false ? '' : ' data-sk="' + c.k + '"') + '>' + T.esc(c.t) +
             (c.sort === false ? '' : '<i class="bi ' + (g.sortK === c.k ? (g.sortD > 0 ? 'bi-sort-down-alt' : 'bi-sort-down') : 'bi-arrow-down-up') + ' sort"></i>') +
             '</th>';
    });
    if (o.actions) h += '<th style="width:' + (o.actionsW || 110) + 'px"></th>';
    h += '</tr></thead><tbody>';

    if (!view.length) {
        h += '<tr><td colspan="' + ((o.cols || []).length + (o.stt === false ? 0 : 1) + (o.actions ? 1 : 0) + (o.chon ? 1 : 0)) + '">' +
             '<div class="empty"><i class="bi bi-inbox"></i><b>' +
             (g.q || Object.keys(g.f).length ? 'Không tìm thấy dữ liệu phù hợp' : (o.emptyTitle || 'Chưa có dữ liệu')) + '</b>' +
             (g.q || Object.keys(g.f).length ? 'Thử đổi từ khóa hoặc bỏ bớt điều kiện lọc.' : (o.emptyText || 'Bấm nút “Thêm mới” trên thanh công cụ để bắt đầu.')) +
             '</div></td></tr>';
    }
    view.forEach(function (r, i) {
        var stt = (g.page - 1) * g.size + i + 1;
        h += '<tr data-id="' + T.esc(r.id) + '" class="' + (o.onOpen ? 'clickable' : '') +
             (g.selId === r.id ? ' sel' : '') + (g.chon[r.id] ? ' tick' : '') + '">';
        if (o.chon) h += '<td class="ctr"><input type="checkbox" data-chon="' + T.esc(r.id) + '"' +
                         (g.chon[r.id] ? ' checked' : '') + '></td>';
        if (o.stt !== false) h += '<td class="ctr muted small">' + stt + '</td>';
        (o.cols || []).forEach(function (c) {
            var v = r[c.k];
            var txt = c.r ? c.r(v, r, stt) : (c.fmt === 'money' ? T.money(v)
                     : c.fmt === 'num' ? T.num(v) : c.fmt === 'date' ? T.date(v) : T.esc(v));
            h += '<td class="' + (c.cls || '') + '">' + txt + '</td>';
        });
        if (o.actions) h += '<td><div class="rowbtns">' + o.actions(r) + '</div></td>';
        h += '</tr>';
    });
    h += '</tbody>';

    /* --- dòng tổng --- */
    var totCols = (o.cols || []).filter(function (c) { return c.total; });
    if (totCols.length && all.length) {
        h += '<tfoot><tr>';
        if (o.chon) h += '<td></td>';
        if (o.stt !== false) h += '<td></td>';
        (o.cols || []).forEach(function (c, ci) {
            if (c.total) {
                var s = T.sum(all, function (x) { return c.totalVal ? c.totalVal(x) : x[c.k]; });
                h += '<td class="' + (c.cls || '') + '">' + (c.fmt === 'num' ? T.num(s) : T.money(s)) + '</td>';
            } else h += '<td class="' + (c.cls || '') + '">' + (ci === 0 ? 'TỔNG CỘNG' : '') + '</td>';
        });
        if (o.actions) h += '<td></td>';
        h += '</tr></tfoot>';
    }
    h += '</table></div>';

    /* --- phân trang --- */
    if (o.pager !== false) {
        h += '<div class="pager"><span class="pinfo" data-pinfo></span>' +
             '<select data-size style="width:auto;height:27px;font-size:12.4px">' +
             [10, 15, 25, 50, 100, 200].map(function (n) {
                 return '<option value="' + n + '"' + (n === g.size ? ' selected' : '') + '>' + n + ' dòng/trang</option>';
             }).join('') + '</select>' +
             '<div class="pbtns" data-pbtns></div></div>';
    }

    g.body.innerHTML = h;
    g.bind();
    g.updateInfo();
    UI.mauNut(g.body);              // nút thao tác trên từng dòng cũng có màu đúng nhóm
    UI.theoDoiCuon(g.body);         // đầu bảng đổ bóng khi cuộn
    if (o.chon) g.baoChon();
    // cho phép màn hình gắn thêm sự kiện riêng vào các ô vừa dựng (vd: liên kết mở chứng từ)
    if (o.afterRender) o.afterRender(g.body, g);
};


/* ================================================ CẤU HÌNH LƯỚI THEO NGƯỜI DÙNG
   Mỗi người dùng có cấu hình riêng cho từng lưới: cột nào ẩn, số dòng mỗi trang,
   cột sắp xếp mặc định. Lưu theo tài khoản đăng nhập nên hai người dùng chung
   một máy vẫn giữ được cấu hình riêng.
   ------------------------------------------------------------------------- */
var KHOA_LUOI = 'tverp.luoi.';
function _nguoi() {
    try { return (DB.user() || {}).taiKhoan || 'chung'; } catch (e) { return 'chung'; }
}
UI.cauHinhLuoi = function (ma) {
    if (!ma) return {};
    try {
        var t = localStorage.getItem(KHOA_LUOI + _nguoi());
        var o = t ? JSON.parse(t) : {};
        return o[ma] || {};
    } catch (e) { return {}; }
};
UI.luuCauHinhLuoi = function (ma, cau) {
    if (!ma) return;
    try {
        var k = KHOA_LUOI + _nguoi();
        var t = localStorage.getItem(k);
        var o = t ? JSON.parse(t) : {};
        o[ma] = cau;
        localStorage.setItem(k, JSON.stringify(o));
    } catch (e) { }
};
UI.Grid.prototype.ghiCauHinh = function () {
    UI.luuCauHinhLuoi(this.maLuoi, {
        an: this.an, size: this.size, sortK: this.sortK, sortD: this.sortD
    });
};

/** Hộp chọn cột hiển thị của một lưới. */
UI.Grid.prototype.chonCot = function () {
    var g = this;
    var ds = (g.cotDay || []).filter(function (c) { return c.t; });
    UI.modal({
        size: 'md', title: 'Chọn cột hiển thị',
        sub: 'Cấu hình được ghi nhớ riêng cho tài khoản ' + _nguoi(),
        body: '<div class="row mb12">' +
              '<button class="btn sm" data-tat-ca><i class="bi bi-check-all"></i> Hiện tất cả</button>' +
              '<button class="btn sm" data-mac-dinh><i class="bi bi-arrow-counterclockwise"></i> Về mặc định</button>' +
              '</div><div class="cot-ds">' +
              ds.map(function (c) {
                  return '<label class="cot-o"><input type="checkbox" data-ck="' + T.esc(c.k) + '"' +
                      (g.an[c.k] ? '' : ' checked') + '> <span>' + T.esc(c.t) + '</span></label>';
              }).join('') + '</div>',
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } },
            { text: 'Áp dụng', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                var an = {}, hien = 0;
                h.el.querySelectorAll('[data-ck]').forEach(function (i) {
                    if (i.checked) hien++; else an[i.getAttribute('data-ck')] = true;
                });
                if (!hien) return UI.toast('err', 'Phải giữ ít nhất một cột');
                g.an = an; g.ghiCauHinh(); g.render();
                h.close();
                UI.toast('ok', 'Đã lưu cấu hình cột',
                    hien + ' cột hiển thị · ' + Object.keys(an).length + ' cột đang ẩn.');
            } }
        ],
        onOpen: function (h) {
            h.q('[data-tat-ca]').onclick = function () {
                h.el.querySelectorAll('[data-ck]').forEach(function (i) { i.checked = true; });
            };
            h.q('[data-mac-dinh]').onclick = function () {
                g.an = {}; g.ghiCauHinh(); g.render(); h.close();
                UI.toast('info', 'Đã đưa cấu hình cột về mặc định');
            };
        }
    });
};

UI.Grid.prototype.updateInfo = function () {
    var g = this, o = g.o, tot = g.allRows.length;
    var from = tot ? (g.page - 1) * g.size + 1 : 0;
    var to = g.size === 0 ? tot : Math.min(tot, g.page * g.size);
    var ci = g.host.querySelector('[data-count]');
    if (ci) ci.innerHTML = '<b>' + T.num(tot, 0) + '</b> bản ghi' +
        (tot !== g.rows.length ? ' <span class="muted">/ ' + T.num(g.rows.length, 0) + '</span>' : '');
    var pi = g.body.querySelector('[data-pinfo]');
    if (pi) pi.textContent = tot ? ('Hiển thị ' + from + '–' + to + ' trong tổng số ' + T.num(tot, 0) + ' bản ghi') : 'Không có bản ghi';
    var pb = g.body.querySelector('[data-pbtns]');
    if (!pb) return;
    var pages = Math.max(1, Math.ceil(tot / g.size));
    var b = '<button class="pbtn" data-p="1"' + (g.page === 1 ? ' disabled' : '') + ' title="Trang đầu"><i class="bi bi-chevron-double-left"></i></button>';
    b += '<button class="pbtn" data-p="' + (g.page - 1) + '"' + (g.page === 1 ? ' disabled' : '') + '><i class="bi bi-chevron-left"></i></button>';
    var s = Math.max(1, g.page - 2), e = Math.min(pages, s + 4); s = Math.max(1, e - 4);
    for (var i = s; i <= e; i++) b += '<button class="pbtn' + (i === g.page ? ' on' : '') + '" data-p="' + i + '">' + i + '</button>';
    b += '<button class="pbtn" data-p="' + (g.page + 1) + '"' + (g.page >= pages ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button>';
    b += '<button class="pbtn" data-p="' + pages + '"' + (g.page >= pages ? ' disabled' : '') + ' title="Trang cuối"><i class="bi bi-chevron-double-right"></i></button>';
    pb.innerHTML = b;
    pb.querySelectorAll('[data-p]').forEach(function (x) {
        x.onclick = function () { g.page = Number(x.getAttribute('data-p')); g.render(); };
    });
};

UI.Grid.prototype.bind = function () {
    var g = this, o = g.o, host = g.body;
    var qi = host.querySelector('[data-q]');
    if (qi) {
        var tm;
        qi.oninput = function () {
            clearTimeout(tm);
            tm = setTimeout(function () { g.q = qi.value.trim(); g.page = 1; g.render(); var n = g.body.querySelector('[data-q]'); if (n) { n.focus(); n.selectionStart = n.value.length; } }, 180);
        };
    }
    host.querySelectorAll('[data-fl]').forEach(function (s) {
        s.onchange = function () { g.f[s.getAttribute('data-fl')] = s.value; g.page = 1; g.render(); };
    });
    var cl = host.querySelector('[data-clear]');
    if (cl) cl.onclick = function () { g.f = {}; g.q = ''; g.page = 1; g.render(); UI.toast('info', 'Đã bỏ toàn bộ điều kiện lọc'); };
    host.querySelectorAll('[data-sk]').forEach(function (th) {
        th.onclick = function () {
            var k = th.getAttribute('data-sk');
            if (g.sortK === k) g.sortD = -g.sortD; else { g.sortK = k; g.sortD = 1; }
            g.ghiCauHinh(); g.render();
        };
    });
    var ss = host.querySelector('[data-size]');
    if (ss) ss.onchange = function () { g.size = Number(ss.value); g.page = 1; g.ghiCauHinh(); g.render(); };

    host.querySelectorAll('tbody tr[data-id]').forEach(function (tr) {
        tr.onclick = function (e) {
            if (e.target.closest('[data-act]')) return;
            var id = tr.getAttribute('data-id');
            g.selId = (g.selId === id && o.toggleSelect !== false) ? null : id;
            host.querySelectorAll('tbody tr').forEach(function (x) { x.classList.remove('sel'); });
            if (g.selId) tr.classList.add('sel');
            if (o.onSelect) o.onSelect(g.selected());
        };
        tr.ondblclick = function (e) {
            if (e.target.closest('[data-act]')) return;
            if (o.onOpen) o.onOpen(g.byId(tr.getAttribute('data-id')));
        };
    });
    var all2 = host.querySelector('[data-chon-all]');
    if (all2) all2.onchange = function () {
        g.allRows.forEach(function (r) {
            if (all2.checked) g.chon[r.id] = true; else delete g.chon[r.id];
        });
        g.render(); g.baoChon();
    };
    host.querySelectorAll('[data-chon]').forEach(function (c) {
        c.onclick = function (e) { e.stopPropagation(); };
        c.onchange = function () {
            var id = c.getAttribute('data-chon');
            if (c.checked) g.chon[id] = true; else delete g.chon[id];
            c.closest('tr').classList.toggle('tick', !!c.checked);
            var a = host.querySelector('[data-chon-all]');
            if (a) a.checked = g.allRows.length > 0 && g.allRows.every(function (x) { return g.chon[x.id]; });
            g.baoChon();
        };
    });
    host.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function (e) {
            e.stopPropagation();
            var tr = b.closest('tr'), row = g.byId(tr.getAttribute('data-id'));
            if (o.onAction) o.onAction(b.getAttribute('data-act'), row, b);
        };
    });
};

/** Danh sách bản ghi đang được tích chọn. */
UI.Grid.prototype.daChon = function () {
    var g = this;
    return g.rows.filter(function (r) { return g.chon[r.id]; });
};
UI.Grid.prototype.boChon = function () { this.chon = {}; this.render(); this.baoChon(); };
UI.Grid.prototype.baoChon = function () {
    var g = this, n = g.daChon().length;
    var bar = g.tb ? g.tb.querySelector('[data-bulkbar]') : null;
    if (bar) {
        bar.classList.toggle('hide', n === 0);
        var lb = bar.querySelector('[data-bulkcount]');
        if (lb) lb.innerHTML = 'Đã chọn <b>' + T.num(n, 0) + '</b>/' + T.num(g.rows.length, 0) + ' bản ghi';
        bar.querySelectorAll('button[data-bl]').forEach(function (b) { b.disabled = n === 0; });
    }
    if (g.o.onChon) g.o.onChon(g, n);
};

UI.Grid.prototype.byId = function (id) {
    for (var i = 0; i < this.rows.length; i++) if (this.rows[i].id === id) return this.rows[i];
    return null;
};
UI.Grid.prototype.selected = function () { return this.selId ? this.byId(this.selId) : null; };
UI.Grid.prototype.reload = function (rows) {
    if (rows) this.rows = rows;
    var s = this.selId;
    this.render();
    if (s && this.byId(s)) { this.selId = s; this.render(); }
};

/* =============================================================== COMBOBOX */
/**
 * UI.combo(container, {items:[{v,t,s}], value, placeholder, onChange, search, hanhDong})
 *
 * hanhDong: [{ nhan, icon, click(api) }] — hàng lệnh nằm dưới danh sách, dùng cho
 * "Mở danh sách đầy đủ" và "Tạo mới" của Bộ chọn Master Data. Khai báo được ở mọi
 * combo, không phải sửa lại UI mỗi khi thêm một danh mục mới.
 */
UI.combo = function (host, o) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    var val = o.value || '', open = false, hl = -1, q = '', API = null;
    host.className = 'combo';
    host.innerHTML = '<div class="combo-in"><span class="txt"></span><i class="bi bi-chevron-down"></i></div>' +
        '<div class="combo-pop"><div class="s"><input type="search" placeholder="Gõ để tìm..."></div>' +
        '<div class="list"></div>' +
        ((o.hanhDong && o.hanhDong.length)
            ? '<div class="combo-ht">' + o.hanhDong.map(function (a, i) {
                  return '<button type="button" data-ht="' + i + '">' +
                      (a.icon ? '<i class="bi ' + a.icon + '"></i> ' : '') + T.esc(a.nhan) + '</button>';
              }).join('') + '</div>'
            : '') +
        '</div>';
    var inp = host.querySelector('.combo-in'), txt = host.querySelector('.txt'),
        pop = host.querySelector('.combo-pop'), si = pop.querySelector('input'), list = pop.querySelector('.list');
    pop.querySelectorAll('[data-ht]').forEach(function (b) {
        var dangChay = false;
        function chay(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            if (dangChay) return;
            dangChay = true;
            setTimeout(function () { dangChay = false; }, 0);
            var a = o.hanhDong[Number(b.getAttribute('data-ht'))];
            var tu = q;
            close();
            if (a && a.click) a.click(API, tu);
        }
        b.onmousedown = chay;
        b.onclick = chay;
    });

    function cur() { for (var i = 0; i < o.items.length; i++) if (String(o.items[i].v) === String(val)) return o.items[i]; return null; }
    function paint() {
        var c = cur();
        txt.textContent = c ? c.t : (o.placeholder || '— Chọn —');
        txt.className = 'txt' + (c ? '' : ' ph');
    }
    function filt() {
        var k = T.kd(q);
        return o.items.filter(function (x) { return !k || T.kd(x.t).indexOf(k) >= 0 || T.kd(x.s).indexOf(k) >= 0 || T.kd(x.v).indexOf(k) >= 0; });
    }
    function drawList() {
        var f = filt();
        if (!f.length) { list.innerHTML = '<div class="combo-none">Không tìm thấy</div>'; return; }
        list.innerHTML = f.slice(0, 300).map(function (x, i) {
            return '<div class="combo-opt' + (String(x.v) === String(val) ? ' on' : '') + (i === hl ? ' hl' : '') +
                '" data-v="' + T.esc(x.v) + '">' + T.esc(x.t) + (x.s ? '<small>' + T.esc(x.s) + '</small>' : '') + '</div>';
        }).join('') + (f.length > 300 ? '<div class="combo-none">… còn ' + (f.length - 300) + ' mục, hãy gõ để thu hẹp</div>' : '');
        list.querySelectorAll('[data-v]').forEach(function (d) {
            d.onmousedown = function (e) { e.preventDefault(); pick(d.getAttribute('data-v')); };
        });
    }
    function pick(v) {
        val = v; paint(); close();
        host.setAttribute('data-val', v || '');
        if (o.onChange) o.onChange(v, cur());
    }
    function openIt() {
        if (open) return; open = true; host.classList.add('open'); q = ''; si.value = ''; hl = -1; drawList();
        setTimeout(function () { si.focus(); }, 10);
        // tránh tràn màn hình
        var r = pop.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 8) pop.style.top = 'auto', pop.style.bottom = 'calc(100% + 2px)';
        else pop.style.top = '', pop.style.bottom = '';
    }
    function close() { open = false; host.classList.remove('open'); }

    inp.onclick = function () { open ? close() : openIt(); };
    si.oninput = function () { q = si.value; hl = 0; drawList(); };
    si.onkeydown = function (e) {
        var f = filt();
        if (e.key === 'ArrowDown') { hl = Math.min(f.length - 1, hl + 1); drawList(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); drawList(); e.preventDefault(); }
        else if (e.key === 'Enter') { if (f[hl]) pick(f[hl].v); e.preventDefault(); }
        else if (e.key === 'Escape') { close(); e.stopPropagation(); }
    };
    /* Đóng khi bấm ra ngoài. Ô chọn bị gỡ khỏi trang thì GỠ LUÔN listener — mở
       và đóng nhiều biểu mẫu không để lại rác trong trình duyệt. */
    function ngoai(e) {
        if (!host.isConnected) { document.removeEventListener('mousedown', ngoai); return; }
        if (open && !host.contains(e.target)) close();
    }
    document.addEventListener('mousedown', ngoai);
    paint();
    API = {
        el: host,
        get: function () { return val; },
        /** Đặt giá trị. Truyền baoDoi=true để chạy luôn onChange (dùng khi tạo nhanh bản ghi). */
        set: function (v, baoDoi) {
            val = v; paint();
            host.setAttribute('data-val', v || '');
            if (baoDoi !== false && o.onChange) o.onChange(v);
        },
        item: cur,
        nap: function (it) { o.items = it; drawList(); paint(); },
        setItems: function (it) { o.items = it; drawList(); paint(); },
        /** Từ khóa người dùng đang gõ — dùng để chuyển tiếp sang popup hoặc form tạo mới. */
        tuKhoa: function () { return q; },
        mo: openIt, dong: close
    };
    return API;
};

/* =============================================================== BIỂU MẪU */
/** Đọc toàn bộ trường [data-f] trong một vùng thành đối tượng. */
UI.read = function (root) {
    var o = {};
    root.querySelectorAll('[data-f]').forEach(function (e) {
        var k = e.getAttribute('data-f');
        if (e.type === 'checkbox') o[k] = e.checked;
        else if (e.matches(LOP_SO)) o[k] = T.so(e.value);      // ô tiền / số lượng / tỷ lệ → số thật
        else o[k] = e.value;
    });
    return o;
};
/** Kiểm tra bắt buộc: trả về true nếu hợp lệ. */
UI.validate = function (root, rules) {
    var ok = true, first = null;
    root.querySelectorAll('.errmsg').forEach(function (e) { e.remove(); });
    root.querySelectorAll('.err').forEach(function (e) { e.classList.remove('err'); });
    /** Chọn phần tử NHÌN THẤY ĐƯỢC để tô đỏ thay cho ô ẩn. */
    function oNhinThay(el, oGhep) {
        function an(e) {
            if (!e) return true;
            if (e.type === 'hidden') return true;
            return !(e.offsetWidth || e.offsetHeight ||
                     (e.getClientRects && e.getClientRects().length));
        }
        var ds = [el, oGhep], i, e, ci;
        for (i = 0; i < ds.length; i++) {
            e = ds[i]; if (!e) continue;
            if (e.classList && e.classList.contains('combo')) {
                ci = e.querySelector('.combo-in');
                if (ci && !an(ci)) return ci;
            }
            if (!an(e)) return e;
        }
        /* Không có ô nào hiện — tô đỏ cả khối trường để người dùng vẫn thấy chỗ sai. */
        return (el.closest && el.closest('.fld')) || el;
    }
    (rules || []).forEach(function (r) {
        var el = root.querySelector('[data-f="' + r.k + '"]') || root.querySelector('[data-fk="' + r.k + '"]');
        if (!el) return;
        var v = el.classList && el.classList.contains('combo') ? (el.getAttribute('data-val') || '') : (el.value || '');
        /* Ô ghép (combo): giá trị thật nằm ở ô ẩn cùng tên phía sau. Ô ẩn trống
           mà ô ghép đã có lựa chọn thì lấy theo ô ghép, và ngược lại — không để
           chênh lệch giữa hai ô làm chứng từ hợp lệ bị báo là chưa hợp lệ. */
        var oGhep = root.querySelector('[data-fk="' + r.k + '"]');
        if (!String(v).trim() && oGhep && oGhep !== el) v = oGhep.getAttribute('data-val') || '';
        var bad = r.test ? !r.test(v) : !String(v).trim();
        if (bad) {
            ok = false;
            /* BÁO LỖI PHẢI NHÌN THẤY ĐƯỢC — không bao giờ tô đỏ một ô ẩn, vì
               người dùng sẽ đọc “kiểm tra các ô được tô đỏ” mà trên màn hình
               không có ô nào đỏ cả. Ưu tiên ô ghép hiển thị cùng tên. */
            var tgt = oNhinThay(el, oGhep);
            tgt.classList.add('err');
            var m = document.createElement('div'); m.className = 'errmsg'; m.textContent = r.msg || 'Không được để trống';
            ((tgt.closest ? tgt.closest('.fld') : null) || el.parentNode).appendChild(m);
            if (!first) first = tgt;
        }
    });
    // ---- Kiểm tra CHUNG cho mọi biểu mẫu: ngày, tỷ lệ %, số lượng, tiền ----
    function loi(el, msg) {
        ok = false;
        var tgt = el.classList.contains('combo') ? el.querySelector('.combo-in') : el;
        tgt.classList.add('err');
        var m = document.createElement('div'); m.className = 'errmsg'; m.textContent = msg;
        el.parentNode.appendChild(m);
        if (!first) first = tgt;
    }
    root.querySelectorAll('input[type=date][data-f]').forEach(function (e) {
        var v = e.value;
        if (!v) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return loi(e, 'Ngày không hợp lệ');
        var n = Number(v.substr(0, 4));
        if (n < 2000 || n > 2100) loi(e, 'Năm phải trong khoảng 2000 – 2100');
    });
    root.querySelectorAll('input.tyle').forEach(function (e) {
        if (e.value === '' || e.disabled) return;
        var n = T.so(e.value);
        if (n < 0) loi(e, 'Tỷ lệ không được âm');
        else if (n > 100) loi(e, 'Tỷ lệ không được vượt quá 100%');
    });
    root.querySelectorAll('input.sl').forEach(function (e) {
        if (e.value === '' || e.disabled) return;
        if (T.so(e.value) < 0) loi(e, 'Số lượng không được âm');
    });
    root.querySelectorAll('input.tien').forEach(function (e) {
        if (e.value === '' || e.disabled) return;
        if (T.so(e.value) < 0) loi(e, 'Số tiền không được âm');
    });
    // ---- Cặp ngày: đến ngày không được trước từ ngày ----
    [['ngayHieuLuc', 'ngayKetThuc'], ['tuNgay', 'denNgay'], ['hieuLucTu', 'hieuLucDen'],
     ['ngay', 'ngayNhan'], ['ngay', 'hanThanhToan']].forEach(function (c) {
        var a = root.querySelector('input[type=date][data-f="' + c[0] + '"]');
        var b = root.querySelector('input[type=date][data-f="' + c[1] + '"]');
        if (a && b && a.value && b.value && b.value < a.value)
            loi(b, 'Không được trước ngày ở ô “' + (a.previousElementSibling ? a.previousElementSibling.textContent : c[0]) + '”');
    });

    if (!ok) {
        if (first) try { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { }
        UI.toast('err', 'Dữ liệu chưa hợp lệ', 'Vui lòng kiểm tra các ô được tô đỏ.');
    }
    return ok;
};

/* ========================================================== Ô NHẬP SỐ & TIỀN
   Quy ước dùng chung toàn hệ thống — gắn class cho thẻ <input>:
     .tien   → tiền, không âm, không phần lẻ        (đơn giá, giá vốn, thành tiền…)
     .tien-am→ tiền, CHO PHÉP âm                    (điều chỉnh, chênh lệch…)
     .sl     → số lượng, cho tối đa 2 chữ số lẻ
     .tyle   → tỷ lệ %, 0–100, tối đa 2 chữ số lẻ
     .num-in → giữ tương thích tên cũ, hiểu như .tien
   Hành vi: ĐỊNH DẠNG NGAY TRONG LÚC GÕ — gõ 1000000 thì ô hiện luôn 1.000.000,
   không phải rời ô, không phải bấm Enter. Con trỏ giữ nguyên vị trí tương đối.
   Dán từ Excel: nhận cả "1.000.000", "1,000,000", "1000000", " 1 000 000 đ".
   Cơ sở dữ liệu LUÔN lưu số thuần, không lưu dấu phân cách. Đọc bằng T.so().
   Xử lý bằng ủy quyền sự kiện ở cấp document nên áp dụng được cho cả những ô
   được dựng động (bảng dòng hàng, bảng chi phí lô nhập, bảng kiểm kê…).
   ========================================================================== */
var LOP_SO = '.tien,.tien-am,.sl,.tyle,.num-in';

function kieuO(e) {
    if (e.classList.contains('tien-am')) return { am: true, le: 0, max: null };
    if (e.classList.contains('sl')) return { am: true, le: 3, max: null };
    if (e.classList.contains('tyle')) return { am: false, le: 2, max: 100 };
    return { am: false, le: 0, max: null };            // .tien và .num-in
}

/**
 * Chuẩn hóa nội dung đang gõ thành chuỗi ĐÃ CÓ dấu phân cách hàng nghìn.
 * Trả về { txt, soChuSoTruocConTro } để đặt lại con trỏ cho đúng chỗ.
 */
function dinhDangDangGo(e) {
    var k = kieuO(e), tho = String(e.value);
    var vt = e.selectionStart === null ? tho.length : e.selectionStart;

    // đếm số CHỮ SỐ đứng trước con trỏ — mốc neo duy nhất không đổi khi chèn dấu chấm
    var soChuSo = 0;
    for (var i = 0; i < vt && i < tho.length; i++) if (/\d/.test(tho.charAt(i))) soChuSo++;

    var am = k.am && /^\s*-/.test(tho);
    var s = tho.replace(/[^\d.,]/g, '');

    // Ô tỷ lệ % không cần phân cách hàng nghìn → dấu chấm hiểu là dấu thập phân
    if (e.classList.contains('tyle')) s = s.replace(/\./g, ',');

    var nguyen, le = '', coDauLe = false;
    if (k.le > 0) {
        var j = s.indexOf(',');
        if (j >= 0) {
            coDauLe = true;
            nguyen = s.slice(0, j).replace(/\./g, '');
            le = s.slice(j + 1).replace(/[^\d]/g, '').slice(0, k.le);
        } else nguyen = s.replace(/\./g, '');
    } else {
        nguyen = s.replace(/[.,]/g, '');
    }
    nguyen = nguyen.replace(/^0+(?=\d)/, '');          // bỏ số 0 thừa ở đầu

    var txt = '';
    if (nguyen !== '') txt = Number(nguyen).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
    else if (coDauLe) txt = '0';
    if (coDauLe) txt += ',' + le;
    if (txt !== '' && am) txt = '-' + txt;
    if (tho.trim() === '' || tho.trim() === '-') txt = tho.trim();

    return { txt: txt, soChuSo: soChuSo };
}

/** Đặt con trỏ về đúng chỗ sau khi chuỗi đã được chèn thêm dấu chấm. */
function datConTro(e, soChuSo) {
    var v = e.value, d = 0, i;
    for (i = 0; i < v.length; i++) {
        if (/\d/.test(v.charAt(i))) { d++; if (d >= soChuSo) { i++; break; } }
    }
    if (soChuSo === 0) i = v.length && v.charAt(0) === '-' ? 1 : 0;
    try { e.selectionStart = e.selectionEnd = Math.min(i, v.length); } catch (x) { }
}

/** Chuẩn hóa lần cuối khi rời ô: kẹp giới hạn, ghi số thuần vào data-so. */
function veLaiO(e) {
    var k = kieuO(e), n = T.so(e.value);
    if (!k.am && n < 0) n = -n;
    if (k.max !== null && n > k.max) n = k.max;
    e.value = (String(e.value).trim() === '' ? ''
        : n.toLocaleString('vi-VN', { maximumFractionDigits: k.le }));
    e.setAttribute('data-so', n);
}

document.addEventListener('input', function (ev) {
    var e = ev.target;
    if (!e || !e.matches || !e.matches(LOP_SO)) return;
    var r = dinhDangDangGo(e);
    if (r.txt !== e.value) { e.value = r.txt; datConTro(e, r.soChuSo); }
    e.setAttribute('data-so', T.so(e.value));
}, true);

// Dán từ Excel: gỡ mọi ký tự thừa (khoảng trắng, "đ", "VNĐ", dấu phẩy kiểu Anh)
document.addEventListener('paste', function (ev) {
    var e = ev.target;
    if (!e || !e.matches || !e.matches(LOP_SO)) return;
    var t = (ev.clipboardData || window.clipboardData);
    if (!t) return;
    var s = String(t.getData('text') || '').trim();
    if (!s) return;
    ev.preventDefault();
    // "1,234,567.89" kiểu Anh → đổi sang kiểu Việt trước khi đọc
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '').replace('.', ',');
    var n = T.so(s), k = kieuO(e);
    if (!k.am && n < 0) n = -n;
    if (k.max !== null && n > k.max) n = k.max;
    e.value = n.toLocaleString('vi-VN', { maximumFractionDigits: k.le });
    e.setAttribute('data-so', n);
    e.dispatchEvent(new Event('input', { bubbles: true }));
}, true);

document.addEventListener('focusin', function (ev) {
    var e = ev.target;
    if (!e || !e.matches || !e.matches(LOP_SO)) return;
    setTimeout(function () { try { e.select(); } catch (x) { } }, 0);
});
document.addEventListener('focusout', function (ev) {
    var e = ev.target;
    if (!e || !e.matches || !e.matches(LOP_SO)) return;
    veLaiO(e);
    e.dispatchEvent(new Event('change', { bubbles: true }));
}, true);

/** Định dạng ngay toàn bộ ô số trong một vùng (gọi sau khi dựng xong HTML). */
UI.numInput = function (root) {
    (root || document).querySelectorAll(LOP_SO).forEach(function (e) {
        if (e.type === 'number') e.type = 'text';      // bỏ mũi tên tăng giảm, cho phép dấu chấm
        e.setAttribute('inputmode', 'decimal');
        veLaiO(e);
    });
};
UI.tien = UI.numInput;                                  // tên gọi dễ nhớ hơn
/** Đọc giá trị số của một ô nhập. */
UI.doc1So = function (e) { return e ? T.so(e.value) : 0; };

/* =============================================================== EXCEL */
UI.xuatExcel = function (ten, sheet, cols, rows) {
    if (!W.XLSX) { UI.toast('err', 'Thiếu thư viện Excel'); return; }
    cols = (cols || []).filter(function (c) { return !c.an; });
    var aoa = [cols.map(function (c) { return c.t; })];
    rows.forEach(function (r) {
        aoa.push(cols.map(function (c) { return c.v ? c.v(r) : (r[c.k] === undefined ? '' : r[c.k]); }));
    });
    var ws = W.XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = cols.map(function (c) { return { wch: c.w || 18 }; });
    var wb = W.XLSX.utils.book_new();
    W.XLSX.utils.book_append_sheet(wb, ws, (sheet || 'Sheet1').substr(0, 30));
    W.XLSX.writeFile(wb, ten + '.xlsx');
    UI.toast('ok', 'Đã xuất Excel', ten + '.xlsx — ' + rows.length + ' dòng');
};

UI.nhapExcel = function (o) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv';
    inp.onchange = function () {
        var f = inp.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function (e) {
            try {
                var wb = W.XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                var ws = wb.Sheets[wb.SheetNames[0]];
                var rows = W.XLSX.utils.sheet_to_json(ws, { defval: '' });
                // tiêu đề gốc theo đúng thứ tự cột trong tệp — dùng cho bảng giá nhiều loại giá
                var dau = (W.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })[0] || [])
                    .map(function (x) { return String(x === undefined || x === null ? '' : x).trim(); })
                    .filter(function (x) { return x !== ''; });
                o.done(rows, f.name, dau);
            } catch (err) {
                UI.toast('err', 'Không đọc được tệp', String(err.message || err));
            }
        };
        fr.readAsArrayBuffer(f);
    };
    inp.click();
};

/** Popup nhập Excel chuẩn: tải tệp mẫu → chọn tệp → xem trước → ghi vào danh sách. */
UI.popupNhapExcel = function (o) {
    UI.modal({
        size: 'lg', title: 'Nhập dữ liệu từ Excel — ' + o.ten,
        body:
          '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>Tệp Excel cần có dòng tiêu đề đúng các cột: <b>' +
            o.cols.map(function (c) { return c.t; }).join(', ') + '</b>. ' +
            'Bấm <b>Tải tệp mẫu</b> để lấy đúng định dạng.</div></div>' +
          '<div class="row mb12"><button class="btn" id="btnMau"><i class="bi bi-download"></i> Tải tệp mẫu</button>' +
          '<button class="btn primary" id="btnChon"><i class="bi bi-file-earmark-excel"></i> Chọn tệp Excel...</button>' +
          '<span class="muted small" id="tenTep">Chưa chọn tệp</span></div>' +
          '<div id="xemTruoc"></div>',
        buttons: [
            { text: 'Đóng', click: function (h) { h.close(); } },
            { text: 'Ghi dữ liệu vào danh sách', cls: 'primary', icon: 'bi-database-add', click: function (h) {
                if (!h._rows || !h._rows.length) { UI.toast('warn', 'Chưa có dữ liệu để ghi'); return; }
                var n = o.apply(h._rows);
                h.close();
                UI.toast('ok', 'Nhập Excel thành công', 'Đã thêm ' + n + ' bản ghi.');
            } }
        ],
        onOpen: function (h) {
            h.q('#btnMau').onclick = function () {
                UI.xuatExcel('MAU_' + o.file, o.ten, o.cols, o.mau || []);
            };
            h.q('#btnChon').onclick = function () {
                UI.nhapExcel({ done: function (rows, ten) {
                    h._rows = rows; h.q('#tenTep').textContent = ten + ' — ' + rows.length + ' dòng';
                    var c = o.cols;
                    h.q('#xemTruoc').innerHTML = '<div class="card"><div class="card-h">Xem trước ' +
                        Math.min(rows.length, 10) + '/' + rows.length + ' dòng</div><div class="tablewrap" style="max-height:300px;border:none">' +
                        '<table class="grid"><thead><tr>' + c.map(function (x) { return '<th>' + T.esc(x.t) + '</th>'; }).join('') +
                        '</tr></thead><tbody>' + rows.slice(0, 10).map(function (r) {
                            return '<tr>' + c.map(function (x) { return '<td>' + T.esc(r[x.t]) + '</td>'; }).join('') + '</tr>';
                        }).join('') + '</tbody></table></div></div>';
                } });
            };
        }
    });
};

/* =============================================================== IN ẤN */
/* ==========================================================================
   CỬA SỔ XEM TRƯỚC CHỨNG TỪ
   Quy trình liền mạch chuẩn ERP:
      Lập chứng từ → Xem trước → Chỉnh sửa (nếu cần) → Xem trước → In / Xuất PDF
   Bấm "Chỉnh sửa" KHÔNG đóng chứng từ, KHÔNG tải lại màn hình, KHÔNG tạo chứng
   từ mới — chỉ mở đúng chứng từ đang xem ở chế độ sửa, lưu xong quay lại ngay
   màn hình xem trước với dữ liệu vừa cập nhật.

   UI.print(html, tieu, opt)
     opt.sua()     — hàm mở chế độ chỉnh sửa chứng từ đang xem (có thì hiện nút)
     opt.veLai()   — hàm dựng lại HTML xem trước sau khi lưu (làm mới tại chỗ)
     opt.quayLai() — hàm xử lý nút "Quay lại" (mặc định: đóng cửa sổ)
   ========================================================================== */
var _xemTruoc = null;              // trạng thái cửa sổ xem trước đang mở

UI.print = function (html, tieu, opt) {
    opt = opt || {};
    var w = document.getElementById('printHost');
    _xemTruoc = { html: html, tieu: tieu, opt: opt };

    w.innerHTML =
        '<div class="print-bar">' +
        '<button class="btn sm" id="prBack" title="Quay lại danh sách chứng từ">' +
            '<i class="bi bi-arrow-left"></i> Quay lại</button>' +
        '<b><i class="bi bi-file-earmark-text"></i> Xem trước — ' + T.esc(tieu || '') + '</b>' +
        '<span class="spacer"></span>' +
        (opt.suaTrucTiep ? '<button class="btn sm warn" id="prSuaCT" title="Sửa thẳng trên chính bản in đang xem — không mở cửa sổ nào khác">' +
                   '<i class="bi bi-pencil-fill"></i> Sửa chứng từ</button>' : '') +
        (opt.sua ? '<button class="btn sm" id="prEdit" title="Mở biểu mẫu nhập liệu để sửa số liệu của chứng từ">' +
                   '<i class="bi bi-table"></i> Sửa dữ liệu</button>' : '') +
        (opt.suaNoiDung ? '<button class="btn sm" id="prNoiDung" title="Sửa điều khoản, ghi chú, nội dung diễn giải cho RIÊNG chứng từ này. Biểu mẫu chuẩn không đổi.">' +
                   '<i class="bi bi-body-text"></i> Sửa nội dung</button>' : '') +
        '<button class="btn sm" id="prPdf" title="Lưu thành tệp PDF đúng biểu mẫu đang xem">' +
            '<i class="bi bi-file-earmark-pdf"></i> Xuất PDF</button>' +
        '<button class="btn sm" id="prDoc" title="Xuất tệp Word (.docx) giữ nguyên biểu mẫu: logo, tiêu đề, bảng, khối ký, chân trang">' +
            '<i class="bi bi-file-earmark-word"></i> Xuất Word</button>' +
        '<button class="btn sm" id="prXls" title="Xuất tệp Excel (.xlsx) giữ nguyên biểu mẫu: ô gộp, đường kẻ, màu sắc, vùng in, khổ giấy">' +
            '<i class="bi bi-file-earmark-spreadsheet"></i> Xuất Excel (Biểu mẫu)</button>' +
        (opt.duLieu ? '<button class="btn sm" id="prXlsD" title="Xuất dữ liệu thô dạng bảng để lọc, tổng hợp, tính toán — không theo biểu mẫu">' +
                   '<i class="bi bi-table"></i> Xuất dữ liệu Excel</button>' : '') +
        '<button class="btn sm primary" id="prGo" title="In ra máy in">' +
            '<i class="bi bi-printer"></i> In</button>' +
        '<button class="btn sm" id="prClose" title="Đóng cửa sổ xem trước (Esc)">' +
            '<i class="bi bi-x-lg"></i> Đóng</button>' +
        '</div>' +
        (opt.daSuaTay && opt.daSuaTay()
            ? '<div class="pr-bao"><i class="bi bi-pencil-fill"></i>' +
              '<span>Chứng từ này đang in theo <b>bản đã sửa tay</b> — không dựng lại từ biểu mẫu chuẩn.</span>' +
              '<button class="btn sm" id="prBoSua">Khôi phục theo biểu mẫu chuẩn</button></div>'
            : '') +
        '<div class="print-area" id="prArea">' + html + '</div>';

    moCuaSo(w);
    /* Vẽ ngay mốc sang trang để người dùng thấy đúng chỗ ngắt trang của bản in. */
    if (W.veRanhTrang) setTimeout(function () { W.veRanhTrang(); }, 30);
    if (document.getElementById('prBoSua'))
        document.getElementById('prBoSua').onclick = function () { opt.boSuaTay(); };
    if (opt.suaTrucTiep && document.getElementById('prSuaCT'))
        document.getElementById('prSuaCT').onclick = function () { opt.suaTrucTiep(); };

    function dong() {
        w.classList.add('hide'); w.innerHTML = '';
        document.body.classList.remove('dang-xem-truoc');
        document.querySelector('.shell').classList.remove('hide');
        hienLaiPopup();
        _xemTruoc = null;
        if (opt.dongLai) opt.dongLai();      // quay lại đúng chứng từ đang xem
    }
    UI.dongXemTruoc = dong;

    /* Dựng lại vùng xem trước từ dữ liệu mới nhất */
    function veLai() {
        if (!opt.veLai) return;
        var a = document.getElementById('prArea');
        if (a) a.innerHTML = opt.veLai();
        if (W.veRanhTrang) setTimeout(function () { W.veRanhTrang(); }, 30);
    }

    if (opt.suaNoiDung && document.getElementById('prNoiDung'))
        document.getElementById('prNoiDung').onclick = function () { opt.suaNoiDung(veLai); };

    document.getElementById('prClose').onclick = dong;
    document.getElementById('prBack').onclick = function () {
        if (opt.quayLai) {
            w.classList.add('hide'); w.innerHTML = '';
            document.body.classList.remove('dang-xem-truoc');
            document.querySelector('.shell').classList.remove('hide');
            document.querySelectorAll('.modal-bg').forEach(function (m) { m.remove(); });
            _xemTruoc = null;
            opt.quayLai();
        } else dong();
    };
    document.getElementById('prGo').onclick = function () { window.print(); };
    document.getElementById('prPdf').onclick = function () {
        UI.toast('info', 'Xuất PDF',
            'Ở hộp thoại in, chọn máy in là “Lưu thành PDF” rồi bấm Lưu.', 6000);
        setTimeout(function () { window.print(); }, 400);
    };
    /* Word / Excel biểu mẫu dựng TRỰC TIẾP từ bản in đang hiển thị, nên tệp xuất ra
       luôn đúng biểu mẫu doanh nghiệp đã cấu hình — không bao giờ là dữ liệu thô. */
    function tenTep() {
        var t = opt.tenTep || tieu || 'BieuMau';
        return (window.T && T.kd ? T.kd(t) : t).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }
    /* WYSIWYG: Word và Excel đọc THẲNG khối DOM đang hiển thị trên màn hình,
       không dựng lại lần thứ hai — nên tệp xuất ra luôn khớp bản xem trước,
       kể cả phần người dùng vừa sửa trực tiếp trên bản in. */
    function banIn() { return document.getElementById('prArea'); }
    document.getElementById('prDoc').onclick = function () {
        if (opt.word) return opt.word();
        if (!window.xuatWordTuBanIn) return UI.toast('err', 'Chưa nạp bộ xuất Word');
        window.xuatWordTuBanIn(banIn(), tenTep());
    };
    document.getElementById('prXls').onclick = function () {
        if (opt.excelMau) return opt.excelMau();
        if (opt.excel) return opt.excel();
        if (!window.xuatExcelBieuMauTuBanIn) return UI.toast('err', 'Chưa nạp bộ xuất Excel');
        window.xuatExcelBieuMauTuBanIn(banIn(), tenTep());
    };
    var bxd = document.getElementById('prXlsD');
    if (bxd) bxd.onclick = function () { opt.duLieu(); };
    var be = document.getElementById('prEdit');
    if (be) be.onclick = function () {
        // Ẩn cửa sổ xem trước NHƯNG GIỮ NGUYÊN trạng thái, không xóa nội dung
        w.classList.add('hide');
        document.body.classList.remove('dang-xem-truoc');
        document.querySelector('.shell').classList.remove('hide');
        opt.sua(function () {                        // gọi lại sau khi người dùng bấm Lưu
            UI.lamMoiXemTruoc();
        }, function () {                             // gọi lại nếu người dùng bấm Hủy
            moCuaSo(w);
        });
    };
    w.scrollTop = 0;
};

/* Cửa sổ xem trước LUÔN chiếm trọn màn hình và nằm trên mọi cửa sổ chứng từ.
   Popup chứng từ đang mở được ẩn tạm — không đóng — nên đóng xem trước là
   quay lại đúng chứng từ đang chỉnh sửa, giữ nguyên toàn bộ dữ liệu đã nhập. */
function moCuaSo(w) {
    anPopup();
    w.classList.remove('hide');
    document.body.classList.add('dang-xem-truoc');
    document.querySelector('.shell').classList.add('hide');
    w.scrollTop = 0;
}
function anPopup() {
    document.querySelectorAll('.modal-bg').forEach(function (m) {
        if (!m.classList.contains('an-tam')) m.classList.add('an-tam');
    });
}
function hienLaiPopup() {
    document.querySelectorAll('.modal-bg.an-tam').forEach(function (m) {
        m.classList.remove('an-tam');
    });
}

/** Dựng lại nội dung cửa sổ xem trước sau khi chứng từ vừa được sửa và lưu. */
UI.lamMoiXemTruoc = function (imLang) {
    if (!_xemTruoc) return;
    var w = document.getElementById('printHost');
    var kv = document.getElementById('prArea');
    if (_xemTruoc.opt.veLai && kv) {
        kv.innerHTML = _xemTruoc.opt.veLai();
        _xemTruoc.html = kv.innerHTML;
    }
    moCuaSo(w);
    if (!imLang) UI.toast('ok', 'Đã cập nhật bản xem trước', 'Nội dung vừa sửa đã hiện ngay trên biểu mẫu.');
};

// Esc để đóng cửa sổ xem trước
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !_xemTruoc) return;
    var w = document.getElementById('printHost');
    if (w && !w.classList.contains('hide') && !document.querySelector('.modal-bg:not(.an-tam)')) {
        e.preventDefault();
        var b = document.getElementById('prClose');
        if (b) b.click();
    }
});

/* --------------------------------------------------------------------------
   KHỐI ĐẦU TRANG · CHÂN TRANG · CHỮ KÝ CỦA BIỂU MẪU IN
   Ba hàm dưới đây chỉ là lối vào; phần dựng thật nằm trong HỆ THỐNG THIẾT KẾ
   TÀI LIỆU (assets/js/mod-tailieu.js) và được nạp đè ngay sau tệp này. Giữ
   bản dựng tối giản ở đây để hệ thống vẫn in được nếu vì lý do nào đó tệp
   thiết kế chưa kịp nạp.
   -------------------------------------------------------------------------- */
UI.prHead = function (cty, C) {
    if (W.DDS) return W.DDS.dauTrang(cty, C);
    cty = cty || DB.cty();
    return '<div class="pr-head"><div class="co"><div class="nm">' + T.esc(cty.ten) + '</div>' +
        (cty.diaChi ? '<div class="ln">' + T.esc(cty.diaChi) + '</div>' : '') + '</div></div>';
};
UI.prFoot = function (cty, C, ma) {
    if (W.DDS) return W.DDS.chanTrang(cty, C, ma);
    cty = cty || DB.cty();
    return '<div class="pr-foot"><div>' + T.esc(cty.tat || cty.ten) + '</div><div></div>' +
        '<div>In ngày ' + T.date(T.today()) + '</div></div>';
};
UI.prSign = function (trai, phai, cty) {
    cty = cty || DB.cty();
    if (W.DDS) return W.DDS.ky([
        { r: trai || 'NGƯỜI LẬP BIỂU', d: '(Ký, ghi rõ họ tên)' },
        { r: phai || 'ĐẠI DIỆN ĐƠN VỊ', d: '(Ký, ghi rõ họ tên, đóng dấu)',
          dau: cty.conDau, ky: cty.chuKy }
    ]);
    return '<div class="pr-sign"><div><div class="r">' + T.esc(trai || 'NGƯỜI LẬP BIỂU') +
        '</div><div class="d">(Ký, ghi rõ họ tên)</div><div class="h"></div></div>' +
        '<div><div class="r">' + T.esc(phai || 'ĐẠI DIỆN ĐƠN VỊ') + '</div>' +
        '<div class="d">(Ký, ghi rõ họ tên, đóng dấu)</div><div class="h"></div>' +
        '</div></div>';
};

/* =============================================================== KHÁC */
UI.busy = function (on) { document.getElementById('busy').classList.toggle('on', !!on); };
UI.btn = function (act, icon, title, cls) {
    return '<button class="btn btn-ico sm ' + (cls || '') + '" data-act="' + act + '" title="' + T.esc(title) + '"><i class="bi ' + icon + '"></i></button>';
};

W.UI = UI;
})(window);

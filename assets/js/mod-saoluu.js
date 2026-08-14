/* ==========================================================================
   TVERP — HỆ THỐNG SAO LƯU DỮ LIỆU
   --------------------------------------------------------------------------
   TRIẾT LÝ
     Người dùng KHÔNG phải làm thao tác kỹ thuật. Cấu hình một lần, các lần sau
     hệ thống tự chạy: tự sao lưu theo lịch, tự kiểm tra toàn vẹn, tự dọn bản cũ
     theo quy tắc lưu trữ, tự báo khi thất bại.

     Hai điều tuyệt đối không được vi phạm:
       1. KHÔNG BAO GIỜ BÁO THÀNH CÔNG KHI CHƯA THÀNH CÔNG. Ghi được vào kho
          trong phần mềm nhưng không ghi được ra thư mục đã chọn thì phải nói rõ.
       2. KHÔI PHỤC KHÔNG ĐƯỢC LÀM MẤT DỮ LIỆU ĐANG CÓ. Trước khi ghi đè phải
          chụp lại dữ liệu hiện tại; nửa chừng hỏng thì trả lại nguyên trạng.

   BẢN SAO LƯU GỒM TOÀN BỘ KHO DỮ LIỆU — không thiếu một bảng nào:
     danh mục · kho · giá vốn · bảng giá · báo giá · đơn hàng · hợp đồng ·
     xuất kho · biên bản nghiệm thu · biên bản nghiệm thu giá trị · đề nghị
     thanh toán · thu chi · công nợ · nhật ký · thùng rác · thiết lập hệ thống
     và TỆP ĐÍNH KÈM (logo · chữ ký · con dấu · ảnh hàng hóa · ảnh đại diện ·
     tệp Excel gốc đã nhập). Dashboard và Báo cáo là số liệu DẪN XUẤT, dựng lại
     từ chính kho dữ liệu này nên luôn khớp sau khi khôi phục.

   NƠI LƯU
     · Trong phần mềm — kho sao lưu riêng của trình duyệt (IndexedDB), không
       chiếm chỗ của dữ liệu nghiệp vụ.
     · Tải về máy — một tệp .json duy nhất.
     · Thư mục trên máy — chọn một lần bằng hộp thoại của hệ điều hành. Quyền
       ghi được GIỮ LẠI qua các phiên làm việc nên các lần sau hệ thống tự ghi.
       Thư mục có thể là ổ cứng máy chủ, ổ cứng ngoài, thư mục mạng nội bộ,
       hoặc thư mục đồng bộ của Google Drive · OneDrive · Dropbox — đó chính là
       cách các dịch vụ này hoạt động trên máy tính.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {};

/* ------------------------------------------------------------- CẤU HÌNH */
var CHU_KY = [
    { k: 'tat',   t: 'Không tự động', ngay: 0 },
    { k: 'ngay',  t: 'Hằng ngày',     ngay: 1 },
    { k: 'tuan',  t: 'Hằng tuần',     ngay: 7 },
    { k: 'thang', t: 'Hằng tháng',    ngay: 30 }
];
var GIU_LAI = [7, 30, 90];
var DICH = [
    { k: 'trongPhanMem', t: 'Trong phần mềm (kho sao lưu của trình duyệt)',
      mo: 'Luôn bật. Bản sao lưu nằm ngay trong phần mềm, khôi phục bằng một cú bấm.' },
    { k: 'thuMuc', t: 'Thư mục trên máy',
      mo: 'Ổ cứng máy chủ · ổ cứng ngoài · thư mục mạng nội bộ · thư mục đồng bộ ' +
          'Google Drive · OneDrive · Dropbox. Chọn thư mục một lần, các lần sau hệ thống tự ghi.' }
];
T.CHU_KY_SAO_LUU = CHU_KY;
T.GIU_LAI_SAO_LUU = GIU_LAI;
T.DICH_SAO_LUU = DICH;

/* Sổ DẪN XUẤT — dựng lại từ chứng từ gốc mỗi lần mở phần mềm, nên số bản ghi
   được phép khác giữa gói sao lưu và dữ liệu sau khôi phục. */
var DAN_XUAT = { theKho: 1, butToanNB: 1, lichSuGiaVon: 1 };

/** Cấu hình sao lưu — luôn trả về object đầy đủ, không bao giờ undefined. */
T.cauHinhSaoLuu = function () {
    var mac = { chuKy: 'tuan', giuLai: 30, thuMuc: false, tenThuMuc: '',
                lanCuoi: '', lanLoi: '', loi: '' };
    var m = DB.data && DB.data._meta;
    if (!m) return mac;
    if (!m.saoLuu) m.saoLuu = {};
    var c = m.saoLuu, k;
    for (k in mac) if (c[k] === undefined) c[k] = mac[k];
    return c;
};
T.luuCauHinhSaoLuu = function (o) {
    var c = T.cauHinhSaoLuu();
    Object.keys(o || {}).forEach(function (k) { c[k] = o[k]; });
    DB.save();
    return c;
};

/* ------------------------------------------------------ CHỮ KÝ TOÀN VẸN */
/**
 * CHỮ KÝ TOÀN VẸN của một chuỗi dữ liệu (FNV-1a 32 bit, viết hệ 16 + độ dài).
 * Đủ để phát hiện tệp sao lưu bị sửa, bị cắt hoặc bị hỏng khi sao chép.
 */
T.chuKyDuLieu = function (s) {
    s = String(s == null ? '' : s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8) + '-' + s.length.toString(36);
};

/** Đếm số bản ghi của từng bảng — dùng để đối chiếu trước và sau khôi phục. */
T.demBanGhi = function (d) {
    var ra = {}, tong = 0;
    if (!d || typeof d !== 'object') return { theoBang: ra, tong: 0, soBang: 0 };
    Object.keys(d).forEach(function (k) {
        if (k === '_meta' || !Array.isArray(d[k])) return;
        ra[k] = d[k].length; tong += d[k].length;
    });
    return { theoBang: ra, tong: tong, soBang: Object.keys(ra).length };
};

/**
 * DỰNG MỘT GÓI SAO LƯU HOÀN CHỈNH.
 * Gói mang theo chữ ký toàn vẹn và bảng đếm bản ghi để lúc khôi phục đối chiếu
 * được ngay — không cần tin vào tên tệp.
 */
T.taoGoiSaoLuu = function (loai) {
    var duLieu = JSON.stringify(DB.data);
    var dem = T.demBanGhi(DB.data);
    return {
        id: T.uid('SL'),
        luc: T.now(),
        moc: Date.now(),                         // mốc thời gian tới mili giây — khóa sắp xếp
        ngay: T.today(),
        loai: loai || 'thuCong',                 // 'thuCong' · 'tuDong' · 'truocKhoiPhuc'
        phienBan: T.PHIEN_BAN || '',
        phienBanDL: (DB.data._meta || {}).phienBan || '',
        soBang: dem.soBang,
        soBanGhi: dem.tong,
        theoBang: dem.theoBang,
        kichThuoc: duLieu.length,
        chuKy: T.chuKyDuLieu(duLieu),
        duLieu: duLieu
    };
};

/**
 * KIỂM TRA TÍNH TOÀN VẸN CỦA MỘT GÓI SAO LƯU.
 * Trả về { duoc, loi: [], canhBao: [], dem, d }.
 *
 * Nguyên tắc: KHÔNG BAO GIỜ COI LÀ ĐẠT khi chưa kiểm được. Gói thiếu chữ ký
 * hoặc thiếu số bản ghi là gói không kiểm được — phải từ chối, không được im
 * lặng bỏ qua rồi báo "toàn vẹn".
 */
T.kiemTraGoiSaoLuu = function (g) {
    var loi = [], canhBao = [], d = null, dem = null;
    function ra() { return { duoc: !loi.length, loi: loi, canhBao: canhBao, dem: dem, d: d }; }

    if (!g || typeof g !== 'object' || Array.isArray(g)) {
        loi.push('Tệp không phải gói sao lưu của phần mềm.'); return ra();
    }
    if (typeof g.duLieu !== 'string' || !g.duLieu) {
        loi.push('Gói sao lưu không có phần dữ liệu.'); return ra();
    }
    if (typeof g.chuKy !== 'string' || !g.chuKy) {
        loi.push('Gói sao lưu không có chữ ký toàn vẹn — không kiểm chứng được, ' +
                 'phần mềm từ chối để tránh khôi phục nhầm dữ liệu hỏng.');
        return ra();
    }
    if (T.chuKyDuLieu(g.duLieu) !== g.chuKy) {
        loi.push('Chữ ký toàn vẹn không khớp — tệp đã bị sửa hoặc hỏng khi sao chép.');
        return ra();
    }
    try { d = JSON.parse(g.duLieu); }
    catch (e) { loi.push('Phần dữ liệu không đọc được: ' + (e.message || e)); return ra(); }

    if (!d || typeof d !== 'object' || Array.isArray(d)) {
        d = null; loi.push('Phần dữ liệu không phải kho dữ liệu của phần mềm.'); return ra();
    }
    if (!d._meta || typeof d._meta !== 'object')
        loi.push('Gói sao lưu thiếu phần thiết lập hệ thống (_meta).');

    dem = T.demBanGhi(d);
    if (typeof g.soBanGhi !== 'number')
        loi.push('Gói sao lưu không ghi số bản ghi — không đối chiếu được.');
    else if (dem.tong !== g.soBanGhi)
        loi.push('Số bản ghi không khớp: gói ghi ' + T.num(g.soBanGhi, 0) +
                 ', đọc được ' + T.num(dem.tong, 0) + '.');

    var thieu = (T.COLS_SAO_LUU || []).filter(function (c) { return !Array.isArray(d[c]); });
    if (thieu.length) canhBao.push('Thiếu ' + thieu.length + ' bảng dữ liệu: ' +
        thieu.slice(0, 6).map(function (c) { return T.tenBang(c); }).join(', ') +
        (thieu.length > 6 ? '…' : '') + ' — hệ thống sẽ tạo lại khi khôi phục.');
    return ra();
};

/* ========================================================================
   KHO SAO LƯU TRONG TRÌNH DUYỆT (IndexedDB)
   Dữ liệu nghiệp vụ nằm ở localStorage; bản sao lưu để riêng một kho khác nên
   không bao giờ tranh chỗ với dữ liệu đang dùng.

   Ba bảng tách bạch để mở danh sách KHÔNG phải nạp dữ liệu nặng:
     ban     — thông tin bản sao lưu (thời điểm, số bản ghi, chữ ký…)
     noiDung — phần dữ liệu của từng bản, chỉ đọc khi thật sự cần
     caiDat  — thư mục lưu người dùng đã chọn (giữ qua các phiên làm việc)
   ======================================================================== */
var TEN_KHO = 'tverp_saoluu';
var B_BAN = 'ban', B_ND = 'noiDung', B_CD = 'caiDat';
var _db = null;

function moKho(ok, loi) {
    if (_db) return ok(_db);
    if (!W.indexedDB) return loi(new Error('Trình duyệt không hỗ trợ kho sao lưu (IndexedDB).'));
    var r, xong = false;
    function batLoi(e) { if (xong) return; xong = true; loi(e || new Error('Không mở được kho sao lưu.')); }
    try { r = W.indexedDB.open(TEN_KHO, 2); }
    catch (e) { return batLoi(e); }
    r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(B_BAN)) db.createObjectStore(B_BAN, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(B_ND)) db.createObjectStore(B_ND, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(B_CD)) db.createObjectStore(B_CD, { keyPath: 'k' });
    };
    r.onsuccess = function () {
        if (xong) return; xong = true;
        _db = r.result;
        /* Kết nối chết (tab khác xóa dữ liệu trình duyệt, hệ điều hành thu hồi)
           thì BỎ HẲN tham chiếu để lần sau mở lại — không để cả phiên làm việc
           hỏng theo một lần lỗi. */
        _db.onclose = function () { _db = null; };
        _db.onversionchange = function () { try { _db.close(); } catch (e) { } _db = null; };
        ok(_db);
    };
    r.onerror = function () { batLoi(r.error); };
    r.onblocked = function () { batLoi(new Error('Kho sao lưu đang bị một thẻ trình duyệt khác giữ.')); };
}

/**
 * Mở một giao dịch trên kho sao lưu.
 *   bang — tên bảng hoặc mảng tên bảng
 *   viec(st, tx)  — st là bảng đầu tiên; tx.objectStore(...) cho các bảng khác
 * ok / loi được gọi ĐÚNG MỘT LẦN, kể cả khi giao dịch vừa lỗi vừa bị hủy.
 */
function giaoDich(bang, che, viec, ok, loi) {
    moKho(function (db) {
        var tx, xong = false;
        function batLoi(e) {
            if (xong) return; xong = true;
            /* Kết nối hỏng thì bỏ tham chiếu để lần sau mở lại từ đầu. */
            if (e && (e.name === 'InvalidStateError' || e.name === 'TransactionInactiveError')) _db = null;
            loi(e || new Error('Kho sao lưu báo lỗi.'));
        }
        try { tx = db.transaction(bang, che); }
        catch (e) { return batLoi(e); }
        tx.onerror = function () { batLoi(tx.error); };
        tx.onabort = function () { batLoi(tx.error || new Error('Giao dịch với kho sao lưu bị hủy.')); };
        tx.oncomplete = function () { if (xong) return; xong = true; ok(tx._kq); };
        try {
            viec(tx.objectStore(Array.isArray(bang) ? bang[0] : bang), tx);
        } catch (e2) { batLoi(e2); }
    }, loi);
}

/** Ghi một gói sao lưu vào kho của trình duyệt. */
T.ghiKhoSaoLuu = function (g, ok, loi) {
    var mo = {}; Object.keys(g).forEach(function (k) { if (k !== 'duLieu') mo[k] = g[k]; });
    giaoDich([B_BAN, B_ND], 'readwrite', function (st, tx) {
        st.put(mo);
        tx.objectStore(B_ND).put({ id: g.id, duLieu: g.duLieu });
    }, function () { ok(g); }, loi);
};

/** Danh sách bản sao lưu — MỚI NHẤT TRƯỚC, KHÔNG nạp phần dữ liệu nặng. */
T.dsSaoLuu = function (ok, loi) {
    giaoDich(B_BAN, 'readonly', function (st, tx) {
        var r = st.getAll();
        r.onsuccess = function () {
            var ds = (r.result || []).map(function (x) {
                if (!x || x.duLieu === undefined) return x;          // bản đời cũ còn lẫn dữ liệu
                var y = {}; Object.keys(x).forEach(function (k) { if (k !== 'duLieu') y[k] = x[k]; });
                return y;
            });
            ds.sort(function (a, b) {
                var x = Number(a.moc || 0), y = Number(b.moc || 0);
                if (x !== y) return y - x;
                var p = String(a.luc || ''), q = String(b.luc || '');
                if (p !== q) return p < q ? 1 : -1;
                return String(a.id) < String(b.id) ? 1 : -1;
            });
            tx._kq = ds;
        };
    }, function (ds) { ok(ds || []); }, loi);
};

/** Đọc đầy đủ một gói sao lưu theo id (thông tin + phần dữ liệu). */
T.docSaoLuu = function (id, ok, loi) {
    var mo = null, nd = null;
    giaoDich([B_BAN, B_ND], 'readonly', function (st, tx) {
        var a = st.get(id), b = tx.objectStore(B_ND).get(id);
        a.onsuccess = function () { mo = a.result || null; };
        b.onsuccess = function () { nd = b.result || null; };
    }, function () {
        if (!mo) return ok(null);
        var g = {}; Object.keys(mo).forEach(function (k) { g[k] = mo[k]; });
        if (nd && nd.duLieu !== undefined) g.duLieu = nd.duLieu;
        ok(g);
    }, loi);
};

/** Xóa một bản sao lưu (cả thông tin lẫn phần dữ liệu). */
T.xoaSaoLuu = function (id, ok, loi) {
    giaoDich([B_BAN, B_ND], 'readwrite', function (st, tx) {
        st.delete(id);
        tx.objectStore(B_ND).delete(id);
    }, function () { ok(); }, loi);
};

/**
 * DỌN BẢN CŨ THEO QUY TẮC LƯU TRỮ — giữ lại N bản mới nhất.
 * Bản sao lưu tự chụp trước khi khôi phục KHÔNG bị tính vào hạn mức và luôn
 * giữ lại 3 bản gần nhất: đó là phao cứu sinh khi khôi phục nhầm.
 */
T.donSaoLuuCu = function (giuLai, ok, loi) {
    var n = Math.max(1, Math.round(T.so(giuLai) || 0) || 30);
    T.dsSaoLuu(function (ds) {
        var thuong = ds.filter(function (x) { return x.loai !== 'truocKhoiPhuc'; });
        var phao = ds.filter(function (x) { return x.loai === 'truocKhoiPhuc'; });
        var xoa = thuong.slice(n).concat(phao.slice(3));
        if (!xoa.length) return ok(0);
        var con = xoa.length, da = 0, hong = null;
        xoa.forEach(function (x) {
            T.xoaSaoLuu(x.id, function () { da++; het(); },
                        function (e) { hong = hong || e; het(); });
        });
        function het() { if (--con) return; if (hong) loi(hong); else ok(da); }
    }, loi);
};

/* ========================================================================
   THƯ MỤC TRÊN MÁY — File System Access API
   Chọn thư mục MỘT LẦN. Bản thân thư mục được cất trong kho sao lưu nên các
   phiên làm việc sau vẫn ghi được vào đúng chỗ đó, không phải chọn lại.
   ======================================================================== */
T.coThuMucSaoLuu = function () {
    return typeof W.showDirectoryPicker === 'function';
};
var _thuMuc = null;                    // FileSystemDirectoryHandle đã có quyền ghi
var _dangNap = false;

function catThuMuc(h, xong) {
    giaoDich(B_CD, 'readwrite', function (st) { st.put({ k: 'thuMuc', h: h }); },
             function () { if (xong) xong(true); },
             function () { if (xong) xong(false); });
}
function boCatThuMuc(xong) {
    giaoDich(B_CD, 'readwrite', function (st) { st.delete('thuMuc'); },
             function () { if (xong) xong(); }, function () { if (xong) xong(); });
}
function layThuMucDaCat(xong) {
    giaoDich(B_CD, 'readonly', function (st, tx) {
        var r = st.get('thuMuc');
        r.onsuccess = function () { tx._kq = r.result && r.result.h; };
    }, function (h) { xong(h || null); }, function () { xong(null); });
}

/**
 * NẠP LẠI THƯ MỤC ĐÃ CHỌN TỪ PHIÊN TRƯỚC.
 * Trình duyệt còn nhớ quyền ghi thì dùng luôn; nếu quyền đã hết hạn thì báo về
 * để màn hình mời người dùng bấm cho phép lại — KHÔNG im lặng bỏ qua.
 * xong(trangThai) với trangThai = 'san-sang' · 'can-cho-phep' · 'khong-co'
 */
T.napThuMucSaoLuu = function (xong) {
    xong = xong || function () { };
    if (_thuMuc) return xong('san-sang');
    if (_dangNap) return xong('khong-co');
    _dangNap = true;
    layThuMucDaCat(function (h) {
        _dangNap = false;
        if (!h || typeof h.queryPermission !== 'function') return xong('khong-co');
        h.queryPermission({ mode: 'readwrite' }).then(function (tt) {
            if (tt === 'granted') { _thuMuc = h; return xong('san-sang'); }
            if (tt === 'prompt') { T._thuMucCho = h; return xong('can-cho-phep'); }
            xong('khong-co');
        }).catch(function () { xong('khong-co'); });
    });
};

/** Xin lại quyền ghi cho thư mục đã chọn — phải gọi từ một cú bấm của người dùng. */
T.xinQuyenThuMuc = function (ok, loi) {
    var h = _thuMuc || T._thuMucCho;
    if (!h) return loi(new Error('Chưa có thư mục lưu nào được chọn.'));
    h.requestPermission({ mode: 'readwrite' }).then(function (tt) {
        if (tt !== 'granted') return loi(new Error('Trình duyệt chưa được cho phép ghi vào thư mục này.'));
        _thuMuc = h; T._thuMucCho = null; ok(h);
    }).catch(function (e) { loi(e); });
};

T.chonThuMucSaoLuu = function (ok, loi) {
    if (!T.coThuMucSaoLuu()) return loi(new Error(
        'Trình duyệt này chưa hỗ trợ ghi thẳng vào thư mục. Dùng Google Chrome hoặc Microsoft Edge.'));
    W.showDirectoryPicker({ mode: 'readwrite' }).then(function (h) {
        _thuMuc = h; T._thuMucCho = null;
        T.luuCauHinhSaoLuu({ thuMuc: true, tenThuMuc: h.name || 'Thư mục đã chọn' });
        catThuMuc(h, function () { ok(h); });
    }).catch(function (e) { loi(e); });
};
T.thuMucSaoLuu = function () { return _thuMuc; };
T.boThuMucSaoLuu = function (xong) {
    _thuMuc = null; T._thuMucCho = null;
    T.luuCauHinhSaoLuu({ thuMuc: false, tenThuMuc: '' });
    boCatThuMuc(xong);
};

function ghiThuMuc(g, ok, loi) {
    if (!_thuMuc) return loi(new Error(
        'Thư mục lưu chưa dùng được — mở màn hình Sao lưu & khôi phục dữ liệu và bấm ' +
        'cho phép ghi vào thư mục đã chọn.'));
    /* Tên tệp mang cả mã bản sao lưu: hai bản trong cùng một phút KHÔNG đè nhau. */
    var ten = 'TVERP_SaoLuu_' + String(g.luc).replace(/[-: ]/g, '') + '_' + g.id + '.json';
    _thuMuc.getFileHandle(ten, { create: true }).then(function (fh) {
        return fh.createWritable().then(function (w) {
            return w.write(JSON.stringify(g)).then(function () { return w.close(); });
        });
    }).then(function () { ok(ten); }).catch(function (e) { loi(e); });
}

/* ========================================================================
   SAO LƯU
   ======================================================================== */
var _dangSaoLuu = false;

/**
 * CHẠY MỘT LẦN SAO LƯU.
 *   loai — 'thuCong' · 'tuDong' · 'truocKhoiPhuc'
 *   xong(kq) với kq = { g, tep, donDep, canhBao }
 *   that(err) khi thất bại — cấu hình ghi lại lần lỗi để màn hình cảnh báo.
 *
 * Chống chạy chồng: một lúc chỉ một lần sao lưu. Lịch tự động và nút bấm tay
 * gọi vào cùng lúc thì lần sau bị từ chối ngay, không dựng hai gói song song.
 */
T.chaySaoLuu = function (loai, xong, that) {
    var goi = false;
    function ok(kq) { if (goi) return; goi = true; _dangSaoLuu = false; if (xong) xong(kq); }
    function baoLoi(e) {
        if (goi) return; goi = true; _dangSaoLuu = false;
        c.loi = String((e && e.message) || e || 'Lỗi không xác định');
        c.lanLoi = T.now();
        try { DB.save(); } catch (x) { }
        if (W.UI) UI.toast('err', 'Sao lưu thất bại', c.loi, 9000);
        if (that) that(e);
    }

    var c = T.cauHinhSaoLuu();
    if (_dangSaoLuu) {
        var e0 = new Error('Một lần sao lưu khác đang chạy — hệ thống bỏ qua lần này để không tạo bản trùng.');
        goi = true; if (that) that(e0);
        return;
    }
    _dangSaoLuu = true;

    var g;
    try { g = T.taoGoiSaoLuu(loai); }
    catch (e) { return baoLoi(e); }
    /* Kiểm tra ngay chính gói vừa dựng — không bao giờ lưu một bản hỏng. */
    var kt = T.kiemTraGoiSaoLuu(g);
    if (!kt.duoc) return baoLoi(new Error(kt.loi.join(' ')));

    T.ghiKhoSaoLuu(g, function () {
        /* Bản sao lưu ĐÃ NẰM AN TOÀN trong kho. Từ đây trở đi mọi trục trặc chỉ
           là cảnh báo, không được biến một lần sao lưu thành công thành thất
           bại — nếu không lịch sẽ chạy lại vô tận và kho phình mãi. */
        var kq = { g: g, tep: '', donDep: 0, canhBao: [] };
        T.donSaoLuuCu(c.giuLai, function (n) { kq.donDep = n; buocThuMuc(); },
                      function (e) {
                          kq.canhBao.push('Chưa dọn được bản sao lưu cũ: ' + (e.message || e));
                          buocThuMuc();
                      });

        function buocThuMuc() {
            if (!c.thuMuc) return ketThuc();
            if (_thuMuc) return viet();
            /* Đã cấu hình ghi ra thư mục nhưng phiên này chưa có quyền → thử
               nạp lại quyền đã lưu, không được thì NÓI RÕ chứ không im lặng. */
            T.napThuMucSaoLuu(function (tt) {
                if (tt === 'san-sang') return viet();
                kq.canhBao.push(tt === 'can-cho-phep'
                    ? 'Chưa ghi được ra thư mục đã chọn: trình duyệt cần được cho phép lại. ' +
                      'Mở màn hình Sao lưu & khôi phục dữ liệu và bấm “Cho phép ghi vào thư mục”.'
                    : 'Chưa ghi được ra thư mục đã chọn: thư mục không còn dùng được. Hãy chọn lại thư mục lưu.');
                ketThuc();
            });
        }
        function viet() {
            ghiThuMuc(g, function (ten) { kq.tep = ten; ketThuc(); },
                      function (e) {
                          kq.canhBao.push('Không ghi được vào thư mục đã chọn: ' + (e.message || e));
                          ketThuc();
                      });
        }
        function ketThuc() {
            c.lanCuoi = g.luc;
            /* Cảnh báo vẫn là cảnh báo — giữ lại trên màn hình để người dùng
               biết bản sao lưu chưa ra được tới thư mục ngoài. */
            if (kq.canhBao.length) { c.loi = kq.canhBao.join(' '); c.lanLoi = T.now(); }
            else { c.loi = ''; c.lanLoi = ''; }
            DB.log('Sao lưu dữ liệu', 'saoLuu', { ten: g.id, so: g.soBanGhi + ' bản ghi' });
            DB.save();
            if (kq.canhBao.length && W.UI)
                UI.toast('warn', 'Bản sao lưu đã lưu trong phần mềm', kq.canhBao.join(' '), 10000);
            ok(kq);
        }
    }, baoLoi);
};

/** Tải một gói sao lưu về máy dưới dạng tệp .json. */
T.taiGoiSaoLuu = function (g) {
    var b = new Blob([JSON.stringify(g)], { type: 'application/json' });
    var u = URL.createObjectURL(b);
    var a = document.createElement('a');
    a.href = u;
    a.download = 'TVERP_SaoLuu_' + String(g.luc || T.now()).replace(/[-: ]/g, '') +
                 '_' + (g.id || '') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
};

/* ========================================================================
   LỊCH SAO LƯU TỰ ĐỘNG
   Phần mềm chạy trong trình duyệt nên lịch được kiểm mỗi lần mở phần mềm và
   định kỳ trong lúc đang mở. Đến hạn là tự chạy, người dùng không phải bấm gì.
   ======================================================================== */
T.denHanSaoLuu = function () {
    var c = T.cauHinhSaoLuu();
    var ck = null;
    CHU_KY.forEach(function (x) { if (x.k === c.chuKy) ck = x; });
    if (!ck || !ck.ngay) return false;
    if (!c.lanCuoi) return true;
    return T.soNgay(String(c.lanCuoi).substr(0, 10), T.today()) >= ck.ngay;
};

/**
 * KIỂM LỊCH — gọi khi mở phần mềm và định kỳ trong lúc đang mở.
 * Chỉ đăng ký MỘT bộ hẹn giờ cho cả phiên làm việc dù đăng nhập lại bao nhiêu
 * lần, và không bao giờ chạy hai lần sao lưu chồng nhau.
 */
T.kiemLichSaoLuu = function () {
    if (!DB.data || !DB._user) return;              // chưa đăng nhập thì không tự chạy
    if (_dangSaoLuu) return;
    if (!T.denHanSaoLuu()) return;
    T.chaySaoLuu('tuDong', function (kq) {
        UI.toast('ok', 'Đã sao lưu tự động',
            T.num(kq.g.soBanGhi, 0) + ' bản ghi · ' + Math.round(kq.g.kichThuoc / 1024) + ' KB' +
            (kq.tep ? ' · đã ghi tệp ' + kq.tep : '') +
            (kq.donDep ? ' · đã dọn ' + kq.donDep + ' bản cũ' : ''), 7000);
    }, function () { });
};
/** Đăng ký lịch — gọi bao nhiêu lần cũng chỉ có một bộ hẹn giờ duy nhất. */
T.batLichSaoLuu = function () {
    if (T._lichSaoLuu) return T._lichSaoLuu;
    T._lichSaoLuu = {
        dau: setTimeout(function () { T.kiemLichSaoLuu(); }, 5000),
        lap: setInterval(function () { T.kiemLichSaoLuu(); }, 3600000)
    };
    return T._lichSaoLuu;
};

/* ========================================================================
   KHÔI PHỤC
   ======================================================================== */
/**
 * KHÔI PHỤC TỪ MỘT GÓI SAO LƯU.
 *
 * Ba lớp bảo vệ, theo đúng cam kết "khôi phục không được làm mất dữ liệu":
 *   1. Kiểm toàn vẹn gói trước khi động vào bất cứ thứ gì.
 *   2. Tự chụp một bản của dữ liệu hiện tại. Chụp không được thì DỪNG —
 *      trừ khi người gọi cố ý cho phép đi tiếp (tuyChon.boQuaChup).
 *   3. Ghi đè trong một khối bảo vệ: hỏng giữa chừng thì TRẢ LẠI NGUYÊN TRẠNG
 *      dữ liệu đang chạy rồi mới báo lỗi.
 */
T.khoiPhucTuGoi = function (g, xong, that, tuyChon) {
    tuyChon = tuyChon || {};
    var kt = T.kiemTraGoiSaoLuu(g);
    if (!kt.duoc) { if (that) that(new Error(kt.loi.join(' '))); return; }
    var truoc = T.demBanGhi(DB.data);

    T.chaySaoLuu('truocKhoiPhuc', function () { tiep(''); }, function (e) {
        if (tuyChon.boQuaChup) return tiep('Không chụp được bản dữ liệu hiện tại trước khi ghi đè: ' +
                                           ((e && e.message) || e) + '. Người dùng đã chấp nhận đi tiếp.');
        if (that) that(new Error('Không chụp được bản dữ liệu hiện tại trước khi ghi đè: ' +
            ((e && e.message) || e) + ' — phần mềm dừng lại để không làm mất dữ liệu đang có.'));
    });

    function tiep(canhBao) {
        /* Cấu hình sao lưu mô tả CHÍNH MÁY NÀY — chu kỳ, số bản giữ lại, thư
           mục lưu — chứ không phải dữ liệu nghiệp vụ. Khôi phục một bản cũ
           không được xóa thiết lập đó: người dùng đã cấu hình một lần thì hệ
           thống phải tiếp tục tự chạy đúng lịch sau khi khôi phục. */
        var cauHinhGiuLai = T.clone(T.cauHinhSaoLuu());
        var cu = DB.data;                              // dữ liệu đang chạy, giữ nguyên vẹn
        try {
            var d = JSON.parse(g.duLieu);
            /* Bù đủ bảng còn thiếu để cấu trúc luôn hoàn chỉnh, rồi chạy đúng
               chuỗi nâng cấp như khi mở phần mềm — gói cũ vẫn dùng được. */
            (T.COLS_SAO_LUU || []).forEach(function (c) { if (!Array.isArray(d[c])) d[c] = []; });
            if (!d._meta || typeof d._meta !== 'object') d._meta = {};
            d._meta.saoLuu = cauHinhGiuLai;
            DB.data = d;
            DB.nangCap();
            T.dungTheKho();
            if (DB.save() === false)
                throw new Error('Bộ nhớ trình duyệt không đủ chỗ để lưu bản khôi phục.');
        } catch (e) {
            /* TRẢ LẠI NGUYÊN TRẠNG — dữ liệu đang chạy không được phép mất chỉ
               vì bản sao lưu hỏng hoặc bộ nhớ đầy. */
            DB.data = cu;
            try { DB.save(); } catch (x) { }
            try { T.dungTheKho(); } catch (x2) { }
            if (that) that(e);
            return;
        }

        var sau = T.demBanGhi(DB.data);
        /* Đối chiếu HAI CHIỀU trên hợp của mọi bảng: bảng có trong gói mà sau
           khôi phục lệch số là dấu hiệu mất/thừa dữ liệu; bảng gói không có mà
           sau khôi phục có bản ghi là danh mục nền hệ thống tự dựng lại. */
        var lech = [], boSung = [], moi = {};
        Object.keys(kt.dem.theoBang).forEach(function (k) { moi[k] = 1; });
        Object.keys(sau.theoBang).forEach(function (k) { moi[k] = 1; });
        Object.keys(moi).forEach(function (k) {
            if (DAN_XUAT[k]) return;
            var a = kt.dem.theoBang[k], b = sau.theoBang[k] || 0;
            if (a === undefined) { if (b) boSung.push(T.tenBang(k) + ': ' + b); return; }
            if (a !== b) lech.push(T.tenBang(k) + ': ' + a + ' → ' + b);
        });
        DB.log('Khôi phục dữ liệu', 'saoLuu', { ten: g.id, so: sau.tong + ' bản ghi' });
        DB.save();
        if (xong) xong({ truoc: truoc, sau: sau, lech: lech, boSung: boSung,
                         canhBao: canhBao || '', toanVen: T.raSoatToanVen() });
    }
};

/* ========================================================================
   MÀN HÌNH SAO LƯU & KHÔI PHỤC
   ======================================================================== */
S['sao-luu'] = function (host) {
    /* Sao lưu và khôi phục là việc QUẢN TRỊ HỆ THỐNG. Xem danh sách bản sao lưu
       là quyền Xem; còn chạy sao lưu · đổi cấu hình · TẢI TỆP VỀ MÁY · khôi
       phục · xóa bản sao đều đòi quyền Quản trị — tệp sao lưu chứa nguyên kho
       dữ liệu của doanh nghiệp, không phải ai xem được màn hình cũng tải được. */
    var MOD = 'saoLuu';
    var qQT = Q.co(MOD, 'quanTri');
    var ds = [];
    var ttThuMuc = 'khong-co';

    function ve() {
        var c = T.cauHinhSaoLuu();
        var kb = Math.round(JSON.stringify(DB.data).length / 1024);
        var dem = T.demBanGhi(DB.data);
        var canCho = (ttThuMuc === 'can-cho-phep');
        host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Sao lưu &amp; khôi phục dữ liệu</h2>' +
            '<div class="sub">Cấu hình một lần — các lần sau hệ thống tự sao lưu theo lịch, tự kiểm tra ' +
            'toàn vẹn và tự dọn bản cũ</div></div><div class="spacer"></div>' +
            '<button class="btn primary" id="slNgay"' + (qQT ? '' : ' disabled') + '>' +
            '<i class="bi bi-shield-check"></i> Sao lưu ngay</button></div>' +

            (c.loi ? '<div class="note r mb12"><i class="bi bi-x-octagon-fill"></i><div>' +
                '<b>Lần sao lưu gần nhất chưa trọn vẹn</b> (' +
                T.esc(T.dateTime(c.lanLoi) || c.lanLoi) + '): ' + T.esc(c.loi) + '</div></div>' : '') +

            '<div class="grid2">' +

            '<div class="card"><div class="card-h"><i class="bi bi-calendar-check"></i> Lịch sao lưu tự động</div>' +
            '<div class="card-b">' +
            '<div class="fld mb12"><label>Chu kỳ</label><select id="slChuKy"' + (qQT ? '' : ' disabled') + '>' +
            CHU_KY.map(function (x) {
                return '<option value="' + x.k + '"' + (x.k === c.chuKy ? ' selected' : '') + '>' +
                    T.esc(x.t) + '</option>';
            }).join('') + '</select></div>' +
            '<div class="fld mb12"><label>Giữ lại bao nhiêu bản</label>' +
            '<input class="num sl" id="slGiu" value="' + T.esc(T.soVe(c.giuLai)) + '"' +
            (qQT ? '' : ' disabled') + '>' +
            '<div class="small muted mt4">Gợi ý: ' + GIU_LAI.join(' · ') + ' bản. ' +
            'Bản cũ hơn hạn mức được tự động xóa.</div></div>' +
            '<div class="row mb12">' + GIU_LAI.map(function (n) {
                return '<button class="btn sm" data-giu="' + n + '"' + (qQT ? '' : ' disabled') + '>' +
                    n + ' bản</button>';
            }).join('') + '</div>' +
            '<dl class="kv"><dt>Lần sao lưu gần nhất</dt><dd>' +
            (c.lanCuoi ? T.esc(T.dateTime(c.lanCuoi) || c.lanCuoi) : '<span class="muted">chưa có</span>') + '</dd>' +
            '<dt>Trạng thái</dt><dd>' + (T.denHanSaoLuu()
                ? '<span class="pill y">đã đến hạn — sẽ chạy ngay</span>'
                : '<span class="pill g">đúng lịch</span>') + '</dd></dl>' +
            '<button class="btn primary mt12" id="slLuuCd"' + (qQT ? '' : ' disabled') + '>' +
            '<i class="bi bi-check-lg"></i> Lưu cấu hình</button>' +
            '</div></div>' +

            '<div class="card"><div class="card-h"><i class="bi bi-hdd-network"></i> Nơi lưu bản sao</div>' +
            '<div class="card-b">' +
            '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
            '<b>Trong phần mềm</b> luôn bật — bản sao nằm trong kho riêng của trình duyệt, khôi phục ' +
            'bằng một cú bấm.<br><b>Thư mục trên máy</b>: chọn một lần, các lần sau hệ thống tự ghi. ' +
            'Thư mục có thể là ổ cứng máy chủ, ổ cứng ngoài, thư mục mạng nội bộ, hoặc thư mục đồng bộ ' +
            'của <b>Google Drive · OneDrive · Dropbox</b> — tệp bỏ vào đó là các dịch vụ này tự tải lên ' +
            'đám mây.</div></div>' +
            '<dl class="kv"><dt>Thư mục đang chọn</dt><dd>' +
            (c.thuMuc ? '<b>' + T.esc(c.tenThuMuc || 'đã chọn') + '</b> ' +
                        (ttThuMuc === 'san-sang' ? '<span class="pill g">sẵn sàng ghi</span>'
                         : canCho ? '<span class="pill y">cần cho phép lại</span>'
                                  : '<span class="pill r">không dùng được — hãy chọn lại</span>')
                      : '<span class="muted">chưa chọn</span>') + '</dd></dl>' +
            (canCho ? '<div class="note y mt12"><i class="bi bi-exclamation-triangle"></i><div>' +
                'Trình duyệt cần được cho phép lại thì hệ thống mới ghi tệp sao lưu vào thư mục này. ' +
                'Bấm <b>Cho phép ghi vào thư mục</b> — chỉ một lần cho phiên làm việc.</div></div>' : '') +
            '<div class="row mt12">' +
            (canCho ? '<button class="btn primary" id="slChoPhep"' + (qQT ? '' : ' disabled') + '>' +
                '<i class="bi bi-unlock"></i> Cho phép ghi vào thư mục</button>' : '') +
            '<button class="btn" id="slChonTM"' + (qQT && T.coThuMucSaoLuu() ? '' : ' disabled') + '>' +
            '<i class="bi bi-folder2-open"></i> Chọn thư mục lưu</button>' +
            (c.thuMuc ? '<button class="btn" id="slBoTM"' + (qQT ? '' : ' disabled') + '>' +
                '<i class="bi bi-x-lg"></i> Bỏ thư mục</button>' : '') +
            '<button class="btn" id="slTai"' + (qQT ? '' : ' disabled') + '>' +
            '<i class="bi bi-download"></i> Tải bản mới nhất về máy</button>' +
            '<button class="btn" id="slNap"' + (qQT ? '' : ' disabled') + '>' +
            '<i class="bi bi-upload"></i> Khôi phục từ tệp</button>' +
            '</div>' +
            (T.coThuMucSaoLuu() ? '' :
                '<div class="note y mt12"><i class="bi bi-info-circle"></i><div>Trình duyệt hiện tại ' +
                'chưa hỗ trợ ghi thẳng vào thư mục. Dùng <b>Google Chrome</b> hoặc ' +
                '<b>Microsoft Edge</b>, hoặc dùng nút <b>Tải bản mới nhất về máy</b>.</div></div>') +
            '</div></div>' +

            '<div class="card span2"><div class="card-h"><i class="bi bi-archive"></i> ' +
            'Các bản sao lưu đang có<span class="spacer"></span>' +
            '<span class="small muted">Dữ liệu hiện tại: ' + T.num(dem.tong, 0) + ' bản ghi · ' +
            T.num(dem.soBang, 0) + ' bảng · ' + T.num(kb, 0) + ' KB</span>' +
            '</div><div id="slBang"></div></div>' +

            '</div></div>';
        W.crumb(['Hệ thống', 'Sao lưu & khôi phục']);
        UI.numInput(host);
        gan();
        napDS();
    }

    function gan() {
        function q(s) { return host.querySelector(s); }
        function canQT() { if (qQT) return true; UI.thieuQuyen(MOD, 'quanTri'); return false; }

        if (q('#slNgay')) q('#slNgay').onclick = function () {
            if (!canQT()) return;
            UI.toast('info', 'Đang sao lưu…');
            T.chaySaoLuu('thuCong', function (kq) {
                UI.toast('ok', 'Sao lưu thành công',
                    T.num(kq.g.soBanGhi, 0) + ' bản ghi · ' + T.num(kq.g.soBang, 0) + ' bảng · ' +
                    Math.round(kq.g.kichThuoc / 1024) + ' KB' +
                    (kq.tep ? ' · đã ghi tệp ' + kq.tep : '') +
                    (kq.donDep ? ' · đã dọn ' + kq.donDep + ' bản cũ' : ''), 8000);
                lamMoi();
            }, function () { lamMoi(); });
        };

        if (q('#slLuuCd')) q('#slLuuCd').onclick = function () {
            if (!canQT()) return;
            var n = Math.max(1, Math.round(T.so(q('#slGiu').value) || 30));
            var ck = q('#slChuKy').value;
            var tenCK = (CHU_KY.filter(function (x) { return x.k === ck; })[0] || {}).t || '';
            var thuong = ds.filter(function (x) { return x.loai !== 'truocKhoiPhuc'; });
            var seXoa = Math.max(0, thuong.length - n);
            function luu() {
                T.luuCauHinhSaoLuu({ chuKy: ck, giuLai: n });
                T.donSaoLuuCu(n, function (nDon) {
                    UI.toast('ok', 'Đã lưu cấu hình sao lưu',
                        'Chu kỳ: ' + tenCK + ' · giữ ' + n + ' bản' +
                        (nDon ? ' · đã dọn ' + nDon + ' bản cũ' : ''), 7000);
                    lamMoi();
                }, function (e) {
                    UI.toast('warn', 'Đã lưu cấu hình — chưa dọn được bản cũ',
                             String(e.message || e), 8000);
                    lamMoi();
                });
            }
            /* Hạ hạn mức là một thao tác XÓA THẬT — phải hỏi trước. */
            if (seXoa > 0) return UI.confirm({
                title: 'Giảm số bản sao lưu giữ lại', danger: true,
                message: 'Đang có ' + thuong.length + ' bản sao lưu, hạn mức mới là ' + n + ' bản.',
                note: '<b>' + seXoa + ' bản sao lưu cũ nhất sẽ bị xóa ngay</b> và không lấy lại được. ' +
                      'Tệp đã tải về máy hoặc đã ghi ra thư mục không bị ảnh hưởng.',
                okText: 'Lưu và dọn ' + seXoa + ' bản', okIcon: 'bi-trash', ok: luu
            });
            luu();
        };

        host.querySelectorAll('[data-giu]').forEach(function (e) {
            e.onclick = function () { if (q('#slGiu')) q('#slGiu').value = e.getAttribute('data-giu'); };
        });

        if (q('#slChoPhep')) q('#slChoPhep').onclick = function () {
            if (!canQT()) return;
            T.xinQuyenThuMuc(function () {
                ttThuMuc = 'san-sang';
                UI.toast('ok', 'Đã cho phép ghi vào thư mục',
                         'Từ giờ hệ thống tự ghi tệp sao lưu vào thư mục đã chọn.', 6000);
                ve();
            }, function (e) {
                UI.toast('err', 'Chưa cho phép được', String(e.message || e), 8000);
            });
        };

        if (q('#slChonTM')) q('#slChonTM').onclick = function () {
            if (!canQT()) return;
            T.chonThuMucSaoLuu(function (h) {
                ttThuMuc = 'san-sang';
                UI.toast('ok', 'Đã chọn thư mục lưu', h.name || '', 6000);
                ve();
            }, function (e) {
                if (e && e.name === 'AbortError') return;
                UI.toast('err', 'Không chọn được thư mục', String(e.message || e), 8000);
            });
        };

        if (q('#slBoTM')) q('#slBoTM').onclick = function () {
            if (!canQT()) return;
            T.boThuMucSaoLuu(function () {
                ttThuMuc = 'khong-co';
                UI.toast('ok', 'Đã bỏ thư mục lưu');
                ve();
            });
        };

        if (q('#slTai')) q('#slTai').onclick = function () {
            if (!canQT()) return;
            if (!ds.length) return UI.toast('warn', 'Chưa có bản sao lưu nào',
                'Bấm “Sao lưu ngay” để tạo bản đầu tiên.');
            T.docSaoLuu(ds[0].id, function (g) {
                if (!g) return UI.toast('err', 'Không đọc được bản sao lưu');
                T.taiGoiSaoLuu(g);
                UI.toast('ok', 'Đã tải bản sao lưu về máy');
            }, function (e) { UI.toast('err', 'Không đọc được bản sao lưu', String(e.message || e)); });
        };

        if (q('#slNap')) q('#slNap').onclick = function () { if (canQT()) napTuTep(); };
    }

    /* Nạp lại trạng thái thư mục rồi vẽ lại — dùng sau mỗi thao tác sao lưu. */
    function lamMoi() {
        T.napThuMucSaoLuu(function (tt) { ttThuMuc = tt; ve(); });
    }

    function napDS() {
        T.dsSaoLuu(function (r) { ds = r; veBang(); }, function (e) {
            var o = host.querySelector('#slBang');
            if (!o) return;                                  // đã rời màn hình
            ds = [];
            o.innerHTML = '<div class="note r" style="margin:10px"><i class="bi bi-x-octagon"></i><div>' +
                'Không mở được kho sao lưu của trình duyệt: ' + T.esc(String(e.message || e)) +
                '. Vẫn dùng được nút <b>Khôi phục từ tệp</b>.</div></div>';
        });
    }

    function veBang() {
        var o = host.querySelector('#slBang');
        if (!o) return;
        if (!ds.length) {
            o.innerHTML = '<div class="trong" style="padding:26px">Chưa có bản sao lưu nào. ' +
                'Bấm <b>Sao lưu ngay</b> để tạo bản đầu tiên.</div>';
            return;
        }
        var TEN_LOAI = { thuCong: 'Thủ công', tuDong: 'Tự động', truocKhoiPhuc: 'Trước khi khôi phục' };
        var kh = qQT ? '' : ' disabled';
        o.innerHTML = '<div class="tbl-wrap" style="max-height:46vh"><table class="tbl"><thead><tr>' +
            '<th style="width:150px">Thời điểm</th><th style="width:150px">Loại</th>' +
            '<th style="width:110px" class="num">Bản ghi</th><th style="width:90px" class="num">Bảng</th>' +
            '<th style="width:110px" class="num">Dung lượng</th>' +
            '<th style="width:110px">Phiên bản</th><th style="width:230px" class="ctr">Thao tác</th>' +
            '</tr></thead><tbody>' +
            ds.map(function (x) {
                return '<tr><td>' + T.esc(T.dateTime(x.luc) || x.luc) + '</td>' +
                    '<td>' + T.pill(TEN_LOAI[x.loai] || x.loai) + '</td>' +
                    '<td class="num">' + T.num(x.soBanGhi, 0) + '</td>' +
                    '<td class="num">' + T.num(x.soBang, 0) + '</td>' +
                    '<td class="num">' + T.num(Math.round((x.kichThuoc || 0) / 1024), 0) + ' KB</td>' +
                    '<td>' + T.esc(x.phienBan || '') + '</td>' +
                    '<td class="ctr"><div class="row" style="justify-content:center;gap:6px">' +
                    '<button class="btn sm" data-kt="' + T.esc(x.id) + '" title="Kiểm tra tính toàn vẹn">' +
                    '<i class="bi bi-shield-check"></i></button>' +
                    '<button class="btn sm" data-tai="' + T.esc(x.id) + '" title="Tải về máy"' + kh + '>' +
                    '<i class="bi bi-download"></i></button>' +
                    '<button class="btn sm danger" data-kp="' + T.esc(x.id) + '" title="Khôi phục từ bản này"' + kh + '>' +
                    '<i class="bi bi-arrow-counterclockwise"></i> Khôi phục</button>' +
                    '<button class="btn sm danger" data-xoa="' + T.esc(x.id) + '" title="Xóa bản sao lưu"' + kh + '>' +
                    '<i class="bi bi-trash"></i></button>' +
                    '</div></td></tr>';
            }).join('') + '</tbody></table></div>';

        /* Bảng này dựng sau khi đọc xong kho sao lưu, tức là sau lúc bộ định
           tuyến tô màu — nên phải tô lại cho chính vùng vừa dựng. */
        UI.mauNut(o);
        o.querySelectorAll('[data-kt]').forEach(function (e) {
            e.onclick = function () { kiemTra(e.getAttribute('data-kt')); };
        });
        o.querySelectorAll('[data-tai]').forEach(function (e) {
            e.onclick = function () {
                if (!qQT) return UI.thieuQuyen(MOD, 'quanTri');
                T.docSaoLuu(e.getAttribute('data-tai'), function (g) {
                    if (!g) return UI.toast('err', 'Không đọc được bản sao lưu');
                    T.taiGoiSaoLuu(g); UI.toast('ok', 'Đã tải bản sao lưu về máy');
                }, function (x) { UI.toast('err', 'Không đọc được bản sao lưu', String(x.message || x)); });
            };
        });
        o.querySelectorAll('[data-kp]').forEach(function (e) {
            e.onclick = function () {
                if (!qQT) return UI.thieuQuyen(MOD, 'quanTri');
                T.docSaoLuu(e.getAttribute('data-kp'), function (g) {
                    if (!g) return UI.toast('err', 'Không đọc được bản sao lưu');
                    hoiKhoiPhuc(g);
                }, function (x) { UI.toast('err', 'Không đọc được bản sao lưu', String(x.message || x)); });
            };
        });
        o.querySelectorAll('[data-xoa]').forEach(function (e) {
            e.onclick = function () {
                if (!qQT) return UI.thieuQuyen(MOD, 'quanTri');
                var id = e.getAttribute('data-xoa');
                UI.confirm({
                    title: 'Xóa bản sao lưu', danger: true,
                    message: 'Xóa bản sao lưu này khỏi kho của phần mềm?',
                    note: 'Tệp đã tải về máy hoặc đã ghi ra thư mục KHÔNG bị ảnh hưởng.',
                    okText: 'Xóa', okIcon: 'bi-trash',
                    ok: function () {
                        T.xoaSaoLuu(id, function () { UI.toast('ok', 'Đã xóa bản sao lưu'); napDS(); },
                                    function (x) { UI.toast('err', 'Không xóa được', String(x.message || x)); });
                    }
                });
            };
        });
    }

    function kiemTra(id) {
        T.docSaoLuu(id, function (g) {
            if (!g) return UI.toast('err', 'Không đọc được bản sao lưu');
            veKetQuaKiemTra(g, T.kiemTraGoiSaoLuu(g));
        }, function (x) { UI.toast('err', 'Không đọc được bản sao lưu', String(x.message || x)); });
    }

    function veKetQuaKiemTra(g, kt) {
        UI.modal({
            size: 'md',
            title: kt.duoc ? 'Bản sao lưu toàn vẹn' : 'Bản sao lưu KHÔNG toàn vẹn',
            sub: T.dateTime(g.luc) || g.luc || '',
            body: '<div class="note ' + (kt.duoc ? 'g' : 'r') + ' mb12">' +
                '<i class="bi bi-' + (kt.duoc ? 'shield-check' : 'x-octagon-fill') + '"></i><div>' +
                (kt.duoc
                    ? 'Chữ ký toàn vẹn khớp, số bản ghi khớp, đọc được đầy đủ dữ liệu. Bản này khôi phục được.'
                    : T.esc(kt.loi.join(' '))) + '</div></div>' +
                (kt.canhBao.length ? '<div class="note y mb12"><i class="bi bi-exclamation-triangle"></i><div>' +
                    T.esc(kt.canhBao.join(' ')) + '</div></div>' : '') +
                '<dl class="kv">' +
                '<dt>Chữ ký toàn vẹn</dt><dd class="mono">' + T.esc(g.chuKy || '—') + '</dd>' +
                '<dt>Số bảng dữ liệu</dt><dd>' + T.num(g.soBang, 0) + '</dd>' +
                '<dt>Số bản ghi</dt><dd>' + T.num(g.soBanGhi, 0) + '</dd>' +
                '<dt>Dung lượng</dt><dd>' + T.num(Math.round((g.kichThuoc || 0) / 1024), 0) + ' KB</dd>' +
                '<dt>Phiên bản phần mềm</dt><dd>' + T.esc(g.phienBan || '') + '</dd>' +
                '<dt>Cấu trúc dữ liệu</dt><dd>' + T.esc(g.phienBanDL || '') + '</dd>' +
                '</dl>' +
                (kt.dem ? '<div class="tbl-wrap mt12" style="max-height:300px"><table class="tbl">' +
                    '<thead><tr><th>Bảng dữ liệu</th><th class="num" style="width:120px">Số bản ghi</th>' +
                    '</tr></thead><tbody>' +
                    Object.keys(kt.dem.theoBang).sort().map(function (k) {
                        return '<tr><td>' + T.esc(T.tenBang(k)) + '</td><td class="num">' +
                            T.num(kt.dem.theoBang[k], 0) + '</td></tr>';
                    }).join('') + '</tbody></table></div>' : ''),
            buttons: [{ text: 'Đóng', cls: 'primary', click: function (h) { h.close(); } }]
        });
    }

    function hoiKhoiPhuc(g) {
        if (!qQT) return UI.thieuQuyen(MOD, 'quanTri');
        var kt = T.kiemTraGoiSaoLuu(g);
        if (!kt.duoc) return UI.khongThe('Khôi phục dữ liệu',
            'Bản sao lưu này không toàn vẹn.', kt.loi.join(' '));
        var nay = T.demBanGhi(DB.data);
        UI.confirm({
            title: 'Khôi phục dữ liệu', danger: true,
            message: 'Đưa toàn bộ dữ liệu về bản sao lưu lúc <b>' +
                     T.esc(T.dateTime(g.luc) || g.luc) + '</b>?',
            note: 'Dữ liệu hiện tại (' + T.num(nay.tong, 0) + ' bản ghi) sẽ được thay bằng ' +
                  T.num(g.soBanGhi, 0) + ' bản ghi của bản sao lưu.<br>' +
                  'Hệ thống <b>tự chụp một bản của dữ liệu hiện tại</b> trước khi ghi đè — ' +
                  'khôi phục nhầm vẫn quay lại được.',
            okText: 'Khôi phục', okIcon: 'bi-arrow-counterclockwise',
            ok: function () { chay(g, false); }
        });
    }

    function chay(g, boQuaChup) {
        UI.toast('info', 'Đang khôi phục…');
        T.khoiPhucTuGoi(g, function (kq) {
            W.route();
            UI.modal({
                size: 'md', title: 'Khôi phục xong',
                sub: 'Dữ liệu đã trở về bản sao lưu lúc ' + (T.dateTime(g.luc) || g.luc || ''),
                body: '<div class="note g mb12"><i class="bi bi-check-circle-fill"></i><div>' +
                    'Đã khôi phục <b>' + T.num(kq.sau.tong, 0) + ' bản ghi</b> trên <b>' +
                    T.num(kq.sau.soBang, 0) + ' bảng dữ liệu</b>. Sổ kho, giá vốn và bút toán ' +
                    'quản trị đã được dựng lại từ chứng từ gốc.</div></div>' +
                    (kq.canhBao ? '<div class="note y mb12"><i class="bi bi-exclamation-triangle"></i><div>' +
                        T.esc(kq.canhBao) + '</div></div>' : '') +
                    '<dl class="kv"><dt>Trước khi khôi phục</dt><dd>' +
                    T.num(kq.truoc.tong, 0) + ' bản ghi</dd>' +
                    '<dt>Sau khi khôi phục</dt><dd><b>' + T.num(kq.sau.tong, 0) + '</b> bản ghi</dd>' +
                    '<dt>Đối chiếu với gói sao lưu</dt><dd>' +
                    (kq.lech.length ? '<span class="pill y">' + kq.lech.length + ' bảng lệch</span>'
                                    : '<span class="pill g">khớp tuyệt đối</span>') + '</dd>' +
                    '<dt>Rà soát liên kết dữ liệu</dt><dd>' +
                    (kq.toanVen.tong ? '<span class="pill r">' + kq.toanVen.tong + ' liên kết hỏng</span>'
                                     : '<span class="pill g">không có bản ghi mồ côi</span>') + '</dd>' +
                    '</dl>' +
                    (kq.lech.length ? '<div class="note y mt12"><i class="bi bi-info-circle"></i><div>' +
                        '<b>Bảng lệch số bản ghi</b>: ' + T.esc(kq.lech.join(' · ')) + '</div></div>' : '') +
                    (kq.boSung && kq.boSung.length ? '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>' +
                        '<b>Danh mục nền hệ thống dựng lại</b> (gói sao lưu đời cũ chưa có các bảng này): ' +
                        T.esc(kq.boSung.join(' · ')) + '</div></div>' : ''),
                buttons: [{ text: 'Đóng', cls: 'primary', click: function (h) { h.close(); lamMoi(); } }]
            });
        }, function (e) {
            var lyDo = String((e && e.message) || e);
            /* Không chụp được bản dữ liệu hiện tại → hỏi lại cho rõ, không tự
               ý ghi đè và cũng không âm thầm bỏ cuộc. */
            if (!boQuaChup && lyDo.indexOf('Không chụp được') === 0) return UI.confirm({
                title: 'Không chụp được dữ liệu hiện tại', danger: true,
                message: 'Phần mềm không tạo được bản chụp dữ liệu đang có trước khi ghi đè.',
                note: T.esc(lyDo) + '<br><b>Nếu vẫn khôi phục, dữ liệu hiện tại sẽ mất và không lấy lại được.</b> ' +
                      'Nên bấm Hủy, tải một bản sao lưu về máy trước, rồi khôi phục lại.',
                okText: 'Vẫn khôi phục', okIcon: 'bi-exclamation-triangle',
                ok: function () { chay(g, true); }
            });
            UI.toast('err', 'Khôi phục thất bại — dữ liệu hiện tại giữ nguyên', lyDo, 10000);
            lamMoi();
        }, { boQuaChup: boQuaChup });
    }

    function napTuTep() {
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = function () {
            var f = inp.files[0]; if (!f) return;
            var fr = new FileReader();
            fr.onerror = function () {
                UI.toast('err', 'Không đọc được tệp',
                    'Trình duyệt không mở được tệp đã chọn. Kiểm tra lại quyền truy cập tệp.', 8000);
            };
            fr.onload = function (e) {
                var g;
                try { g = JSON.parse(e.target.result); }
                catch (x) {
                    return UI.toast('err', 'Không đọc được tệp',
                        'Tệp không phải JSON hợp lệ: ' + (x.message || x), 8000);
                }
                /* Tệp sao lưu đời cũ là NGUYÊN kho dữ liệu, chưa có lớp bọc —
                   vẫn nhận, tự bọc lại rồi kiểm tra như bản mới. */
                if (g && typeof g === 'object' && !g.duLieu && g._meta) {
                    var s2 = JSON.stringify(g);
                    var dem = T.demBanGhi(g);
                    g = { id: T.uid('SL'), luc: T.now(), moc: Date.now(), ngay: T.today(),
                          loai: 'thuCong', phienBan: '', phienBanDL: (g._meta || {}).phienBan || '',
                          soBang: dem.soBang, soBanGhi: dem.tong, theoBang: dem.theoBang,
                          kichThuoc: s2.length, chuKy: T.chuKyDuLieu(s2), duLieu: s2 };
                }
                hoiKhoiPhuc(g);
            };
            fr.readAsText(f);
        };
        inp.click();
    }

    ve();
    T.napThuMucSaoLuu(function (tt) { if (tt !== ttThuMuc) { ttThuMuc = tt; ve(); } });
};

})(window);

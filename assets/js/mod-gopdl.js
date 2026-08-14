/* ==========================================================================
   TVERP — GỘP DỮ LIỆU TRÙNG (KHÁCH HÀNG · HÀNG HÓA)

   Doanh nghiệp nhập liệu nhiều nguồn nên hay có bản ghi trùng. Mô-đun này:
     • Phát hiện các bản ghi nghi ngờ trùng theo nhiều tiêu chí.
     • KHÔNG tự động gộp — người dùng chọn bản ghi chính và các bản cần gộp.
     • Cho chọn giữ lại dữ liệu của bản ghi nào cho từng trường; trường trống
       thì tự lấy dữ liệu từ bản ghi còn lại.
     • Chuyển TOÀN BỘ dữ liệu liên quan sang bản ghi chính, không mất dữ liệu
       và không đổi số chứng từ.
     • Tạo điểm khôi phục trước khi gộp, ghi nhật ký đầy đủ và cho HOÀN TÁC.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI;

W.ENGINE_GOP = { ma: 'GOP_DU_LIEU', ten: 'Engine gộp dữ liệu trùng', phienBan: 1,
                 doiTuong: ['khachHang', 'hangHoa'], tuDongGop: false, hoanTac: true };

/* ==========================================================================
   1. CHUẨN HÓA VÀ TIÊU CHÍ PHÁT HIỆN
   ========================================================================== */
function cChu(v) {
    return T.kd(String(v || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function cSo(v) { return String(v || '').replace(/[^0-9]/g, ''); }
function cMa(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function cMail(v) { return String(v || '').toLowerCase().trim(); }

var TC_KH = [
    { k: 'ma', t: 'Mã khách', f: cMa, min: 2 },
    { k: 'mst', t: 'Mã số thuế', f: cSo, min: 8 },
    { k: 'ten', t: 'Tên khách hàng', f: cChu, min: 5 },
    { k: 'dienThoai', t: 'Điện thoại', f: cSo, min: 8 },
    { k: 'email', t: 'Thư điện tử', f: cMail, min: 6 },
    { k: 'diaChi', t: 'Địa chỉ', f: cChu, min: 12 }
];
var TC_HH = [
    { k: 'ma', t: 'Mã hàng (Model)', f: cMa, min: 2 },
    { k: 'barcode', t: 'Mã vạch', f: cMa, min: 6 },
    { k: 'qrCode', t: 'Mã QR', f: cMa, min: 6 },
    { k: 'ten', t: 'Tên hàng', f: cChu, min: 5 },
    { k: 'thongSo', t: 'Thông số kỹ thuật', f: cChu, min: 15 }
];
W.TIEU_CHI_GOP = { khachHang: TC_KH, hangHoa: TC_HH };

/**
 * Tìm các nhóm bản ghi nghi ngờ trùng.
 * Trả về [{ ds: [bản ghi], theo: ['Mã số thuế', 'Tên khách hàng'] }] — không tự gộp.
 */
W.timTrungLap = function (coll, tieuChiChon) {
    var tc = (W.TIEU_CHI_GOP[coll] || []).filter(function (x) {
        return !tieuChiChon || !tieuChiChon.length || tieuChiChon.indexOf(x.k) >= 0;
    });
    var ds = DB.all(coll) || [];
    var cha = {};                                     // id → id gốc của nhóm
    function tim(x) { while (cha[x] !== x) { cha[x] = cha[cha[x]]; x = cha[x]; } return x; }
    function hop(a, b) { a = tim(a); b = tim(b); if (a !== b) cha[b] = a; }
    ds.forEach(function (r) { cha[r.id] = r.id; });

    var lyDo = {};                                    // 'id|id' → [tiêu chí]
    tc.forEach(function (c) {
        var m = {};
        ds.forEach(function (r) {
            var v = c.f(r[c.k]);
            if (!v || v.length < c.min) return;
            (m[v] = m[v] || []).push(r.id);
        });
        Object.keys(m).forEach(function (v) {
            var g = m[v];
            if (g.length < 2) return;
            for (var i = 1; i < g.length; i++) {
                hop(g[0], g[i]);
                var k = [g[0], g[i]].sort().join('|');
                (lyDo[k] = lyDo[k] || []).push(c.t);
            }
        });
    });

    var nhom = {};
    ds.forEach(function (r) { (nhom[tim(r.id)] = nhom[tim(r.id)] || []).push(r); });
    return Object.keys(nhom).filter(function (k) { return nhom[k].length > 1; })
        .map(function (k) {
            var g = nhom[k];
            var theo = {};
            Object.keys(lyDo).forEach(function (p) {
                var ab = p.split('|');
                if (g.some(function (x) { return x.id === ab[0]; }) &&
                    g.some(function (x) { return x.id === ab[1]; }))
                    lyDo[p].forEach(function (t) { theo[t] = 1; });
            });
            return { ds: g, theo: Object.keys(theo) };
        })
        .sort(function (a, b) { return b.ds.length - a.ds.length; });
};

/* ==========================================================================
   2. CÁC TRƯỜNG THAM CHIẾU TỚI BẢN GHI ĐƯỢC GỘP
   ========================================================================== */
/* Khách hàng tham chiếu bằng id, kèm tên đã ghi sẵn trên chứng từ. */
var THAM_CHIEU_KH = [
    { k: 'khachHangId', ten: 'khachHang' },
    { k: 'doiTuongId', ten: 'doiTuong' }
];
/* HÀNG HÓA THAM CHIẾU BẰNG ID NỘI BỘ trên mọi dòng chứng từ, thẻ kho, sổ giá
   vốn và dòng bảng giá. Mã hàng chỉ là bản chụp để in nên được cập nhật theo. */
var KHOA_HH_ID = ['hangHoaId'];
var KHOA_HH_MA = ['maHang', 'ma_hang', 'maVatTu'];
/* Chỉ mục tra nhanh của bảng giá được khóa bằng ID NỘI BỘ. */
var BANG_THEO_MA = [
    { coll: 'bangGiaBan', truong: ['gia', 'ck', 'gc', 'bang'] },
    { coll: 'bangGia', truong: [] }
];

/** Duyệt sâu toàn bộ dữ liệu, đổi giá trị của các khóa cho trước. */
function doiKhoaSau(goc, khoa, cu, moi, ghi, duong) {
    if (!goc || typeof goc !== 'object') return;
    if (Object.prototype.toString.call(goc) === '[object Array]') {
        for (var i = 0; i < goc.length; i++) doiKhoaSau(goc[i], khoa, cu, moi, ghi, duong + '[' + i + ']');
        return;
    }
    Object.keys(goc).forEach(function (k) {
        var v = goc[k];
        if (v && typeof v === 'object') { doiKhoaSau(v, khoa, cu, moi, ghi, duong + '.' + k); return; }
        if (khoa.indexOf(k) >= 0 && v === cu) {
            goc[k] = moi;
            if (ghi) ghi.push({ d: duong + '.' + k, cu: cu });
        }
    });
}

/* ==========================================================================
   3. GỘP
   ========================================================================== */
/**
 * Gộp nhiều bản ghi vào một bản ghi chính.
 *   coll     — 'khachHang' | 'hangHoa'
 *   chinhId  — id bản ghi giữ lại
 *   dsId     — id các bản ghi cần gộp vào
 *   chonGiaTri — { trường: id-bản-ghi-lấy-giá-trị } do người dùng chọn
 * Trả về bản ghi nhật ký gộp (dùng để hoàn tác).
 */
W.gopBanGhi = function (coll, chinhId, dsId, chonGiaTri) {
    var chinh = DB.get(coll, chinhId);
    if (!chinh) return null;
    dsId = (dsId || []).filter(function (x) { return x && x !== chinhId; });
    if (!dsId.length) return null;
    var phu = dsId.map(function (id) { return DB.get(coll, id); }).filter(Boolean);
    if (!phu.length) return null;

    /* --- 3.1 Điểm khôi phục: giữ nguyên trạng bản ghi và mọi chỗ tham chiếu --- */
    var diem = {
        chinhTruoc: T.clone(chinh),
        phuTruoc: phu.map(function (x) { return T.clone(x); }),
        thayDoi: []                                   // [{coll, id, duong, cu}]
    };

    /* --- 3.2 Chọn dữ liệu giữ lại; trường trống thì lấy từ bản ghi còn lại --- */
    var moi = T.clone(chinh);
    var tatCa = [chinh].concat(phu);
    var truong = {};
    tatCa.forEach(function (r) {
        Object.keys(r).forEach(function (k) {
            if (k === 'id' || k.charAt(0) === '_') return;
            truong[k] = 1;
        });
    });
    Object.keys(truong).forEach(function (k) {
        var lay = chonGiaTri && chonGiaTri[k];
        if (lay) {
            var r = tatCa.filter(function (x) { return x.id === lay; })[0];
            if (r && r[k] !== undefined) { moi[k] = r[k]; return; }
        }
        if (trong(moi[k])) {                          // trường trống → lấy của bản ghi còn lại
            for (var i = 0; i < tatCa.length; i++)
                if (!trong(tatCa[i][k])) { moi[k] = tatCa[i][k]; return; }
        }
    });
    /* Các số liệu cộng dồn: tồn kho, số lần giao dịch, hạn mức */
    if (coll === 'hangHoa') {
        moi.ton = tatCa.reduce(function (s, r) { return s + (Number(r.ton) || 0); }, 0);
        moi.tonDau = tatCa.reduce(function (s, r) { return s + (Number(r.tonDau) || 0); }, 0);
        /* Mã hàng của các bản ghi bị gộp trở thành MÃ KHÁC của bản ghi chính —
           tệp bảng giá cũ ghi theo mã cũ vẫn nhận diện đúng sau khi gộp. */
        var gMa = [];
        tatCa.forEach(function (r) {
            gMa = gMa.concat([r.ma]).concat(r.maKhac || []);
        });
        moi.maKhac = T.maKhacTu(gMa, moi.ma);
    }
    if (coll === 'khachHang') {
        moi.soLanGiaoDich = tatCa.reduce(function (s, r) { return s + (Number(r.soLanGiaoDich) || 0); }, 0);
        moi.hanMucNo = tatCa.reduce(function (s, r) { return Math.max(s, Number(r.hanMucNo) || 0); }, 0);
    }
    moi.id = chinhId;

    /* --- 3.3 Chuyển toàn bộ dữ liệu liên quan sang bản ghi chính --- */
    var d = DB.data;
    phu.forEach(function (p) {
        if (coll === 'khachHang') {
            THAM_CHIEU_KH.forEach(function (tc) {
                Object.keys(d).forEach(function (c) {
                    if (!d[c] || typeof d[c].forEach !== 'function' || c === 'khachHang') return;
                    d[c].forEach(function (r, i) {
                        var g = [];
                        doiKhoaSau(r, [tc.k], p.id, chinhId, g, c + '[' + i + ']');
                        g.forEach(function (x) { diem.thayDoi.push({ coll: c, id: r.id, duong: x.d, cu: x.cu }); });
                        // tên khách đã ghi sẵn trên chứng từ → cập nhật theo bản ghi chính
                        if (r[tc.k] === chinhId && tc.ten && r[tc.ten] !== undefined &&
                            r[tc.ten] !== moi.ten) {
                            diem.thayDoi.push({ coll: c, id: r.id, duong: c + '.' + tc.ten,
                                                cu: r[tc.ten], truong: tc.ten });
                            r[tc.ten] = moi.ten;
                        }
                    });
                });
            });
        } else {
            /* GỘP HÀNG HÓA — chuyển LIÊN KẾT ID NỘI BỘ của bản ghi phụ sang bản
               ghi chính trên toàn hệ thống, rồi mới cập nhật mã hàng đã ghi sẵn
               trên chứng từ cho khớp. Không bao giờ chỉ đổi mã: đổi mã mà không
               đổi ID sẽ để lại liên kết trỏ vào bản ghi đã bị xóa. */
            var maCu = p.ma, maMoi = moi.ma;
            Object.keys(d).forEach(function (c) {
                if (!d[c] || typeof d[c].forEach !== 'function' || c === 'hangHoa') return;
                d[c].forEach(function (r, i) {
                    var g = [];
                    doiKhoaSau(r, KHOA_HH_ID, p.id, chinhId, g, c + '[' + i + ']');
                    if (maCu && maMoi && maCu !== maMoi)
                        doiKhoaSau(r, KHOA_HH_MA, maCu, maMoi, g, c + '[' + i + ']');
                    g.forEach(function (x) { diem.thayDoi.push({ coll: c, id: r.id, duong: x.d, cu: x.cu }); });
                });
            });
            /* Bản chụp MÃ HÀNG trên dòng bảng giá: liên kết ID đã được chuyển ở
               vòng trên, ở đây đồng bộ lại mã in ra để không còn mã của mặt hàng
               đã bị gộp bỏ. */
            if (maCu && maMoi && maCu !== maMoi) {
                (d.bangGiaBan || []).forEach(function (bg) {
                    (bg.dong || []).forEach(function (dg) {
                        if (dg.hangHoaId !== chinhId || T.kd(dg.ma || '') !== T.kd(maCu)) return;
                        dg.ma = maMoi;
                        if (moi.model) dg.model = moi.model;
                    });
                });
            }
            /* Chỉ mục tra nhanh của bảng giá khóa bằng ID NỘI BỘ → chuyển khóa,
               giữ giá của bản ghi chính. Dòng gốc đã được chuyển ở vòng trên. */
            BANG_THEO_MA.forEach(function (b) {
                (d[b.coll] || []).forEach(function (bg) {
                    b.truong.forEach(function (f) {
                        var o = bg[f];
                        if (!o || typeof o !== 'object') return;
                        [[p.id, chinhId], [maCu, maMoi]].forEach(function (kk) {
                            var kCu = kk[0], kMoi = kk[1];
                            if (!kCu || !kMoi || kCu === kMoi || o[kCu] === undefined) return;
                            diem.thayDoi.push({ coll: b.coll, id: bg.id, khoaBang: f,
                                                maCu: kCu, giaCu: T.clone(o[kCu]),
                                                coMaMoi: o[kMoi] !== undefined });
                            if (o[kMoi] === undefined) o[kMoi] = o[kCu];
                            delete o[kCu];
                        });
                    });
                });
            });
        }
    });

    /* --- 3.4 Ghi bản ghi chính, bỏ các bản ghi đã gộp --- */
    var a = DB.all(coll);
    for (var i = 0; i < a.length; i++) if (a[i].id === chinhId) { a[i] = moi; break; }
    phu.forEach(function (p) {
        for (var j = 0; j < a.length; j++) if (a[j].id === p.id) { a.splice(j, 1); break; }
    });

    /* --- 3.5 Dựng lại các sổ dẫn xuất --- */
    if (T.dungTheKho) T.dungTheKho();
    if (T.dungButToanNB) T.dungButToanNB();

    /* --- 3.6 Nhật ký gộp --- */
    var nk = {
        id: T.uid('GOP'), coll: coll, luc: T.now(),
        nguoi: (DB.user() || {}).hoTen || (DB.user() || {}).taiKhoan || '',
        chinhId: chinhId, chinhTen: moi.ten || moi.ma || '',
        daGop: phu.map(function (p) { return { id: p.id, ma: p.ma || '', ten: p.ten || '' }; }),
        soThayDoi: diem.thayDoi.length,
        truoc: { chinh: diem.chinhTruoc, phu: diem.phuTruoc },
        sau: T.clone(moi),
        diem: diem, hoanTac: false
    };
    if (!DB.data.gopDuLieu) DB.data.gopDuLieu = [];
    DB.data.gopDuLieu.unshift(nk);
    if (DB.data.gopDuLieu.length > 50) DB.data.gopDuLieu = DB.data.gopDuLieu.slice(0, 50);
    DB.log('Gộp dữ liệu ' + (coll === 'khachHang' ? 'khách hàng' : 'hàng hóa'), coll, moi);
    DB.save();
    return nk;
};

function trong(v) {
    return v === undefined || v === null || v === '' ||
           (typeof v === 'object' && !Object.keys(v).length);
}

/* ==========================================================================
   4. HOÀN TÁC GỘP
   ========================================================================== */
/** Hoàn tác một lần gộp: trả lại nguyên trạng bản ghi và mọi tham chiếu. */
W.hoanTacGop = function (nkId) {
    var nk = (DB.all('gopDuLieu') || []).filter(function (x) { return x.id === nkId; })[0];
    if (!nk || nk.hoanTac) return null;
    var d = DB.data, coll = nk.coll;

    /* 4.1 Trả lại tham chiếu trên chứng từ */
    (nk.diem.thayDoi || []).forEach(function (x) {
        if (x.khoaBang) {
            var bg = DB.get(x.coll, x.id);
            if (!bg || !bg[x.khoaBang]) return;
            var maMoi = nk.diem.chinhTruoc.ma;
            if (!x.coMaMoi && bg[x.khoaBang][maMoi] !== undefined) delete bg[x.khoaBang][maMoi];
            bg[x.khoaBang][x.maCu] = x.giaCu;
            return;
        }
        var r = DB.get(x.coll, x.id);
        if (!r) return;
        if (x.truong) { r[x.truong] = x.cu; return; }
        datTheoDuong(r, x.duong, x.cu);
    });

    /* 4.2 Trả lại bản ghi chính và các bản ghi đã gộp */
    var a = DB.all(coll);
    for (var i = 0; i < a.length; i++)
        if (a[i].id === nk.chinhId) { a[i] = T.clone(nk.diem.chinhTruoc); break; }
    (nk.diem.phuTruoc || []).forEach(function (p) {
        if (!DB.get(coll, p.id)) a.push(T.clone(p));
    });

    if (T.dungTheKho) T.dungTheKho();
    if (T.dungButToanNB) T.dungButToanNB();
    nk.hoanTac = true; nk.hoanTacLuc = T.now();
    nk.hoanTacBoi = (DB.user() || {}).hoTen || (DB.user() || {}).taiKhoan || '';
    DB.log('Hoàn tác gộp dữ liệu', coll, nk);
    DB.save();
    return nk;
};
/** Đặt lại giá trị theo đường dẫn đã ghi khi gộp: 'baoGia[3].lines[0].maHang' */
function datTheoDuong(goc, duong, giaTri) {
    var p = String(duong || '').split('.');
    p.shift();                                        // bỏ 'coll[i]'
    var o = goc;
    for (var i = 0; i < p.length; i++) {
        var m = /^([A-Za-z0-9_]+)((\[\d+\])*)$/.exec(p[i]);
        if (!m) return;
        var k = m[1], idx = (m[2] || '').match(/\d+/g) || [];
        if (i === p.length - 1 && !idx.length) { o[k] = giaTri; return; }
        o = o[k];
        for (var j = 0; j < idx.length; j++) {
            if (!o) return;
            if (i === p.length - 1 && j === idx.length - 1) { o[Number(idx[j])] = giaTri; return; }
            o = o[Number(idx[j])];
        }
        if (!o) return;
    }
}

/* ==========================================================================
   5. MÀN HÌNH GỘP DỮ LIỆU
   ========================================================================== */
var NHAN_TRUONG = {
    ma: 'Mã', ten: 'Tên', mst: 'Mã số thuế', diaChi: 'Địa chỉ', dienThoai: 'Điện thoại',
    email: 'Thư điện tử', nguoiLienHe: 'Người liên hệ', loai: 'Nhóm khách', mucGia: 'Bậc giá',
    duAn: 'Dự án', tenKhac: 'Tên khác', hanMucNo: 'Hạn mức nợ', ghiChu: 'Ghi chú',
    trangThai: 'Trạng thái', bangGiaId: 'Bảng giá riêng', soLanGiaoDich: 'Số lần giao dịch',
    maKhac: 'Mã khác', dvt: 'Đơn vị tính', nhom: 'Nhóm hàng', xuatXu: 'Xuất xứ',
    thuongHieu: 'Thương hiệu', nhaSanXuat: 'Nhà sản xuất', quyCach: 'Quy cách',
    thongSo: 'Thông số kỹ thuật', barcode: 'Mã vạch', qrCode: 'Mã QR', anh: 'Hình ảnh',
    catalogue: 'Catalogue', tepDinhKem: 'Tệp đính kèm', giaVon: 'Giá vốn',
    giaVonBQ: 'Giá vốn bình quân', ton: 'Tồn kho', tonDau: 'Tồn đầu kỳ',
    tonToiThieu: 'Tồn tối thiểu', plId: 'Bảng giá gốc'
};
var TRUONG_CHON = {
    khachHang: ['ma', 'ten', 'tenKhac', 'mst', 'diaChi', 'dienThoai', 'email', 'nguoiLienHe',
                'loai', 'mucGia', 'duAn', 'hanMucNo', 'bangGiaId', 'ghiChu'],
    hangHoa: ['ma', 'ten', 'maKhac', 'dvt', 'nhom', 'xuatXu', 'thuongHieu', 'nhaSanXuat',
              'quyCach', 'thongSo', 'barcode', 'qrCode', 'anh', 'catalogue', 'tepDinhKem', 'ghiChu']
};

function moTa(coll, r) {
    if (coll === 'khachHang')
        return [r.ma, r.mst ? 'MST ' + r.mst : '', r.dienThoai, r.diaChi]
            .filter(Boolean).join(' · ');
    return [r.ma, (r.maKhac || []).join(', '), r.dvt,
            r.thongSo ? String(r.thongSo).substr(0, 40) : '']
        .filter(Boolean).join(' · ');
}
/** Số chứng từ đang tham chiếu tới một bản ghi — cho người dùng thấy sức nặng dữ liệu. */
W.soLienQuan = function (coll, r) {
    var n = 0, d = DB.data;
    Object.keys(d).forEach(function (c) {
        if (!d[c] || typeof d[c].forEach !== 'function' || c === coll) return;
        d[c].forEach(function (x) {
            var s = JSON.stringify(x);
            if (coll === 'khachHang') { if (s.indexOf('"' + r.id + '"') >= 0) n++; }
            else if (r.ma && s.indexOf('"' + r.ma + '"') >= 0) n++;
        });
    });
    return n;
};

/** Màn hình phát hiện và gộp dữ liệu trùng. */
W.manHinhGopDuLieu = function (coll) {
    coll = coll || 'khachHang';
    if (!W.Q.co(coll, 'sua') && !W.Q.laQuanTri())
        return UI.thieuQuyen(coll, 'sua');
    var nhom = [], chonNhom = -1;

    function ten() { return coll === 'khachHang' ? 'khách hàng' : 'hàng hóa'; }

    function quet(h) {
        var tc = [];
        h.el.querySelectorAll('[data-tc]:checked').forEach(function (x) { tc.push(x.getAttribute('data-tc')); });
        nhom = W.timTrungLap(coll, tc);
        chonNhom = -1;
        ve(h);
    }
    function ve(h) {
        h.q('#gdKQ').innerHTML =
            '<div class="row mb8" style="gap:14px;flex-wrap:wrap">' +
            (W.TIEU_CHI_GOP[coll] || []).map(function (c) {
                return '<label class="chk"><input type="checkbox" data-tc="' + c.k + '" checked> ' +
                    '<span>' + T.esc(c.t) + '</span></label>';
            }).join('') +
            '<button type="button" class="btn sm" id="gdQuet"><i class="bi bi-search"></i> Quét lại</button>' +
            '</div>' +
            (nhom.length
              ? '<div class="tbl-wrap" style="max-height:230px;overflow:auto"><table class="tbl"><thead><tr>' +
                '<th style="width:52px">Nhóm</th><th style="width:70px">Số bản ghi</th>' +
                '<th>Các bản ghi nghi ngờ trùng</th><th style="width:230px">Trùng theo</th>' +
                '<th style="width:110px"></th></tr></thead><tbody>' +
                nhom.map(function (g, i) {
                    return '<tr' + (i === chonNhom ? ' class="chon"' : '') + '>' +
                        '<td class="ctr">' + (i + 1) + '</td>' +
                        '<td class="ctr">' + g.ds.length + '</td>' +
                        '<td>' + g.ds.map(function (r) {
                            return T.esc((r.ma ? r.ma + ' — ' : '') + (r.ten || ''));
                        }).join('<br>') + '</td>' +
                        '<td>' + g.theo.map(function (t) {
                            return '<span class="pill b">' + T.esc(t) + '</span>'; }).join(' ') + '</td>' +
                        '<td><button class="btn sm" data-nhom="' + i + '">Xem và gộp</button></td></tr>';
                }).join('') + '</tbody></table></div>'
              : '<div class="empty" style="padding:18px"><i class="bi bi-check-circle"></i>' +
                'Không tìm thấy ' + ten() + ' nào nghi ngờ trùng theo các tiêu chí đang chọn.</div>') +
            '<div id="gdChiTiet" class="mt12"></div>';

        h.q('#gdQuet').onclick = function () { quet(h); };
        h.el.querySelectorAll('[data-nhom]').forEach(function (b) {
            b.onclick = function () { chonNhom = Number(b.getAttribute('data-nhom')); ve(h); veChiTiet(h); };
        });
        if (chonNhom >= 0) veChiTiet(h);
    }
    function veChiTiet(h) {
        var g = nhom[chonNhom];
        if (!g) { h.q('#gdChiTiet').innerHTML = ''; return; }
        var ds = g.ds;
        var truong = (TRUONG_CHON[coll] || []).filter(function (k) {
            return ds.some(function (r) { return !trong(r[k]); });
        });
        h.q('#gdChiTiet').innerHTML =
            '<div class="card-h">Chọn bản ghi chính và dữ liệu giữ lại</div>' +
            '<div class="note b mb8"><i class="bi bi-info-circle"></i><div>' +
            'Bản ghi chính là bản ghi được <b>giữ lại</b>. Các bản ghi còn lại sẽ được gộp vào và ' +
            'toàn bộ dữ liệu liên quan chuyển sang bản ghi chính. Trường nào để trống ở bản ghi chính ' +
            'thì hệ thống <b>tự lấy dữ liệu từ bản ghi còn lại</b>. Số chứng từ không thay đổi.' +
            '</div></div>' +
            '<div class="tbl-wrap" style="max-height:300px;overflow:auto"><table class="tbl gd-bang"><thead><tr>' +
            '<th style="width:150px">Trường dữ liệu</th>' +
            ds.map(function (r) {
                return '<th><label class="chk"><input type="radio" name="gdChinh" value="' + r.id + '"' +
                    (r.id === ds[0].id ? ' checked' : '') + '> <span><b>' + T.esc(r.ma || r.id) + '</b><br>' +
                    '<span class="small muted">' + T.esc(moTa(coll, r)) + '</span><br>' +
                    '<span class="small">' + T.num(W.soLienQuan(coll, r), 0) + ' chứng từ liên quan</span>' +
                    '</span></label></th>';
            }).join('') + '</tr></thead><tbody>' +
            truong.map(function (k) {
                var khac = {};
                ds.forEach(function (r) { if (!trong(r[k])) khac[String(r[k])] = 1; });
                var nhieu = Object.keys(khac).length > 1;
                return '<tr><td>' + T.esc(NHAN_TRUONG[k] || k) +
                    (nhieu ? ' <span class="pill y">khác nhau</span>' : '') + '</td>' +
                    ds.map(function (r, i) {
                        var v = r[k];
                        var hien = trong(v) ? '<span class="muted">(trống)</span>'
                            : T.esc(String(typeof v === 'object' ? '(dữ liệu)' : v).substr(0, 70));
                        return '<td><label class="chk"><input type="radio" name="gd_' + k + '" value="' +
                            r.id + '"' + ((nhieu ? i === 0 : trong(r[k]) === false && i === 0) ? ' checked' : '') +
                            (trong(v) ? ' disabled' : '') + '> <span>' + hien + '</span></label></td>';
                    }).join('') + '</tr>';
            }).join('') + '</tbody></table></div>' +
            '<div class="row mt12" style="gap:8px">' +
            '<button type="button" class="btn primary" id="gdGop"><i class="bi bi-union"></i> Gộp các bản ghi đã chọn</button>' +
            '<span class="small muted">Trước khi gộp hệ thống tự tạo điểm khôi phục — hoàn tác được bất cứ lúc nào.</span>' +
            '</div>';
        h.q('#gdGop').onclick = function () {
            var chinh = (h.el.querySelector('input[name="gdChinh"]:checked') || {}).value;
            if (!chinh) return UI.toast('err', 'Chưa chọn bản ghi chính', '');
            var chon = {};
            truong.forEach(function (k) {
                var x = h.el.querySelector('input[name="gd_' + k + '"]:checked');
                if (x) chon[k] = x.value;
            });
            var phu = ds.map(function (r) { return r.id; }).filter(function (x) { return x !== chinh; });
            var tenC = (DB.get(coll, chinh) || {});
            UI.confirm({
                title: 'Xác nhận gộp ' + ten(), danger: true,
                message: 'Gộp <b>' + phu.length + '</b> bản ghi vào <b>' +
                    T.esc(tenC.ma || '') + ' — ' + T.esc(tenC.ten || '') + '</b>?',
                note: 'Toàn bộ chứng từ, công nợ, tồn kho và lịch sử giao dịch sẽ chuyển sang bản ghi chính. ' +
                      'Số chứng từ không thay đổi. Hệ thống tạo điểm khôi phục và cho hoàn tác.',
                okText: 'Gộp dữ liệu', ok: function () {
                    var nk = W.gopBanGhi(coll, chinh, phu, chon);
                    if (!nk) return UI.toast('err', 'Không gộp được', 'Hãy kiểm tra lại lựa chọn.');
                    UI.toast('ok', 'Đã gộp ' + nk.daGop.length + ' bản ghi',
                        'Chuyển ' + nk.soThayDoi + ' tham chiếu sang ' + (nk.chinhTen || '') +
                        '. Hoàn tác được tại Nhật ký gộp.', 8000);
                    quet(h);
                }
            });
        };
    }

    UI.modal({
        size: 'xl', dismiss: false,
        title: 'Gộp dữ liệu trùng — ' + (coll === 'khachHang' ? 'Khách hàng' : 'Hàng hóa'),
        sub: 'Phát hiện bản ghi nghi ngờ trùng · không tự động gộp · người dùng quyết định',
        body: '<div id="gdKQ"></div>',
        buttons: [
            { text: 'Đóng', click: function (h) { h.close(); } },
            { text: 'Nhật ký gộp và hoàn tác', icon: 'bi-clock-history', click: function () {
                W.nhatKyGop(coll);
            } }
        ],
        onOpen: function (h) { quet(h); }
    });
};

/** Nhật ký gộp dữ liệu kèm chức năng hoàn tác. */
W.nhatKyGop = function (coll) {
    function ve(h) {
        var ds = (DB.all('gopDuLieu') || []).filter(function (x) { return !coll || x.coll === coll; });
        h.q('#nkG').innerHTML = ds.length
            ? '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
              '<th style="width:130px">Thời điểm</th><th style="width:140px">Người thực hiện</th>' +
              '<th style="width:90px">Đối tượng</th><th>Giữ lại</th><th>Đã gộp vào</th>' +
              '<th style="width:90px">Tham chiếu</th><th style="width:150px"></th>' +
              '</tr></thead><tbody>' +
              ds.map(function (x) {
                  return '<tr><td>' + T.esc(T.dateTime(x.luc)) + '</td>' +
                      '<td>' + T.esc(x.nguoi || '') + '</td>' +
                      '<td>' + (x.coll === 'khachHang' ? 'Khách hàng' : 'Hàng hóa') + '</td>' +
                      '<td>' + T.esc(x.chinhTen || '') + '</td>' +
                      '<td>' + x.daGop.map(function (p) {
                          return T.esc((p.ma ? p.ma + ' — ' : '') + (p.ten || '')); }).join('<br>') + '</td>' +
                      '<td class="ctr">' + T.num(x.soThayDoi, 0) + '</td>' +
                      '<td>' + (x.hoanTac
                          ? '<span class="pill">Đã hoàn tác ' + T.esc(T.dateTime(x.hoanTacLuc || '')) + '</span>'
                          : '<button class="btn sm danger" data-ht="' + x.id + '">' +
                            '<i class="bi bi-arrow-counterclockwise"></i> Hoàn tác gộp</button>') +
                      '</td></tr>';
              }).join('') + '</tbody></table></div>'
            : '<div class="empty" style="padding:18px"><i class="bi bi-clock-history"></i>' +
              'Chưa có lần gộp dữ liệu nào.</div>';
        h.el.querySelectorAll('[data-ht]').forEach(function (b) {
            b.onclick = function () {
                UI.confirm({ title: 'Hoàn tác gộp', danger: true,
                    message: 'Trả lại nguyên trạng các bản ghi và toàn bộ tham chiếu trước khi gộp?',
                    okText: 'Hoàn tác', ok: function () {
                        var nk = W.hoanTacGop(b.getAttribute('data-ht'));
                        if (!nk) return UI.toast('err', 'Không hoàn tác được', '');
                        UI.toast('ok', 'Đã hoàn tác gộp',
                            'Khôi phục ' + nk.daGop.length + ' bản ghi và ' + nk.soThayDoi +
                            ' tham chiếu về đúng như trước.', 7000);
                        ve(h);
                    } });
            };
        });
    }
    UI.modal({
        size: 'xl', dismiss: false,
        title: 'Nhật ký gộp dữ liệu',
        sub: 'Người thực hiện · thời gian · dữ liệu trước và sau khi gộp · hoàn tác',
        body: '<div id="nkG"></div>',
        buttons: [{ text: 'Đóng', click: function (h) { h.close(); } }],
        onOpen: function (h) { ve(h); }
    });
};

})(window);

/* ==========================================================================
   6. MÀN HÌNH TRONG MENU HỆ THỐNG
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, S = W.SCREEN = W.SCREEN || {};

S['gop-du-lieu'] = function (host) {
    host.innerHTML =
        '<div class="page"><div class="page-head"><div><h2>Gộp dữ liệu trùng</h2>' +
        '<div class="sub">Phát hiện và gộp Khách hàng, Hàng hóa bị trùng — không tự động gộp, ' +
        'có điểm khôi phục và hoàn tác</div></div></div>' +
        '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
        'Hệ thống chỉ <b>hiển thị danh sách nghi ngờ trùng</b>. Người dùng chọn bản ghi chính, chọn dữ ' +
        'liệu giữ lại rồi mới gộp. Toàn bộ chứng từ, công nợ, tồn kho và lịch sử giao dịch chuyển sang ' +
        'bản ghi chính; <b>số chứng từ không thay đổi</b>.</div></div>' +
        '<div class="grid2">' +
        khoi('khachHang', 'Khách hàng', 'bi-people',
             'Nhận biết theo: Mã khách · Mã số thuế · Tên · Điện thoại · Thư điện tử · Địa chỉ') +
        khoi('hangHoa', 'Hàng hóa', 'bi-box-seam',
             'Nhận biết theo: Mã hàng (Model) · Mã vạch · Mã QR · Tên hàng · Thông số kỹ thuật') +
        '</div>' +
        '<div class="card mt12"><div class="card-h"><b>Nhật ký gộp dữ liệu</b>' +
        '<span class="spacer"></span>' +
        '<button class="btn sm" id="gdNK"><i class="bi bi-clock-history"></i> Mở nhật ký và hoàn tác</button>' +
        '</div><div class="card-b" id="gdTom"></div></div></div>';
    W.crumb(['Hệ thống', 'Gộp dữ liệu trùng']);

    function khoi(coll, ten, icon, mo) {
        var n = (W.timTrungLap(coll) || []).length;
        return '<div class="card"><div class="card-h"><b><i class="bi ' + icon + '"></i> ' + ten + '</b></div>' +
            '<div class="card-b">' +
            '<div class="kpi mb8"><div class="k">Nhóm nghi ngờ trùng</div><div class="v">' +
                T.num(n, 0) + '</div></div>' +
            '<div class="small muted mb12">' + mo + '</div>' +
            '<button class="btn primary" data-mo="' + coll + '">' +
            '<i class="bi bi-union"></i> Mở màn hình gộp ' + ten.toLowerCase() + '</button></div></div>';
    }
    host.querySelectorAll('[data-mo]').forEach(function (b) {
        b.onclick = function () { W.manHinhGopDuLieu(b.getAttribute('data-mo')); };
    });
    host.querySelector('#gdNK').onclick = function () { W.nhatKyGop(); };
    var ds = (DB.all('gopDuLieu') || []).slice(0, 6);
    host.querySelector('#gdTom').innerHTML = ds.length
        ? '<table class="tbl"><thead><tr><th style="width:140px">Thời điểm</th>' +
          '<th style="width:150px">Người thực hiện</th><th style="width:110px">Đối tượng</th>' +
          '<th>Giữ lại</th><th style="width:110px">Số bản ghi</th><th style="width:120px">Trạng thái</th>' +
          '</tr></thead><tbody>' + ds.map(function (x) {
              return '<tr><td>' + T.esc(T.dateTime(x.luc)) + '</td><td>' + T.esc(x.nguoi || '') + '</td>' +
                  '<td>' + (x.coll === 'khachHang' ? 'Khách hàng' : 'Hàng hóa') + '</td>' +
                  '<td>' + T.esc(x.chinhTen || '') + '</td>' +
                  '<td class="ctr">' + T.num(x.daGop.length, 0) + '</td>' +
                  '<td>' + (x.hoanTac ? '<span class="pill">Đã hoàn tác</span>'
                                      : '<span class="pill g">Đang áp dụng</span>') + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<div class="empty" style="padding:14px"><i class="bi bi-clock-history"></i>' +
          'Chưa có lần gộp dữ liệu nào.</div>';
};

})(window);

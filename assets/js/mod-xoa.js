/* ==========================================================================
   TVERP — CHUẨN XÓA DỮ LIỆU VÀ CHUẨN THANH CÔNG CỤ
   Một cơ chế DUY NHẤT cho toàn hệ thống:
     • Nút Xóa không bao giờ bị khóa vì dữ liệu đang có ràng buộc. Người dùng
       luôn bấm được; hệ thống tự rà soát rồi hoặc xóa, hoặc báo rõ lý do.
     • Thông báo nêu đúng phân hệ nào đang dùng, bao nhiêu bản ghi, ví dụ cụ
       thể và việc cần làm để xóa được.
     • Dữ liệu chưa phát sinh giao dịch: xóa cứng. Đã phát sinh giao dịch:
       không xóa cứng, chuyển sang Ngừng sử dụng / Khóa và giữ nguyên lịch sử.
     • Thanh công cụ chạy theo trạng thái chọn dữ liệu: chưa chọn — chỉ Thêm
       mới · Nhập · Xuất · Làm mới · Tìm kiếm; chọn một dòng — bật toàn bộ
       chức năng trên bản ghi; chọn nhiều dòng — bật các chức năng hàng loạt.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI;

/* ------------------------------------------------------- TÊN PHÂN HỆ */
var TEN_PH = {
    khachHang: 'Khách hàng', nhaCungCap: 'Nhà cung cấp', hangHoa: 'Hàng hóa',
    nhomHang: 'Nhóm hàng', dvt: 'Đơn vị tính', hangSX: 'Hãng sản xuất',
    thueSuat: 'Thuế suất GTGT', dieuKhoanTT: 'Điều khoản thanh toán',
    dieuKhoanGH: 'Điều khoản giao hàng', loaiGia: 'Loại giá',
    nguoiKy: 'Người ký', duAn: 'Dự án', bangGiaBan: 'Bảng giá',
    donVi: 'Đơn vị phát hành', kho: 'Kho', nhanVien: 'Nhân viên', vaiTro: 'Vai trò',
    nguoiDung: 'Người dùng',
    loNhap: 'Lô nhập hàng', phieuNhap: 'Phiếu nhập kho', phieuXuat: 'Phiếu xuất kho',
    donMua: 'Đơn mua hàng', baoGia: 'Báo giá', donBan: 'Đơn bán hàng',
    hopDong: 'Hợp đồng', phuLuc: 'Phụ lục hợp đồng', bienBanGiao: 'Biên bản giao hàng',
    bienBanNghiemThu: 'Biên bản nghiệm thu', deNghiTT: 'Đề nghị thanh toán',
    phieuThu: 'Phiếu thu', phieuChi: 'Phiếu chi', kiemKe: 'Biên bản kiểm kê',
    dieuChinhKho: 'Phiếu điều chỉnh tồn kho', theKho: 'Thẻ kho',
    lichSuGiaVon: 'Lịch sử giá vốn', bangGia: 'Bảng giá nội bộ'
};
W.tenPhanHe = function (c) { return TEN_PH[c] || c; };

/* --------------------------------------------------------- CÁCH KHỚP */
/** Khớp theo một trường khóa ngoại trỏ tới id của bản ghi. */
function theoId(truong) {
    return function (r, rec) { return r[truong] && r[truong] === rec.id; };
}
/** Khớp theo HÀNG HÓA trong các dòng hàng của chứng từ — theo ID nội bộ. */
function theoDongHang() {
    return function (r, rec) {
        var ls = r.lines || [];
        for (var i = 0; i < ls.length; i++) if (T.idDong(ls[i]) === rec.id) return true;
        return false;
    };
}
/** Khớp theo một trường của bản ghi (mã, tên) với một trường của bên kia. */
function theoGiaTri(truongKia, truongGoc) {
    return function (r, rec) {
        var v = rec[truongGoc];
        return v !== undefined && v !== '' && r[truongKia] === v;
    };
}
function lk(coll, khop, huong, go) {
    return { coll: coll, ten: TEN_PH[coll] || coll, khop: khop, huong: huong || '', go: go };
}
/* Gỡ một THAM CHIẾU MỀM: trường chỉ trỏ tới bản ghi để tra cứu, không mang số
   liệu nghiệp vụ. Gỡ xong chứng từ vẫn giữ nguyên mọi con số đã lưu. */
function goTruong(truong) {
    return function (ds) { ds.forEach(function (r) { r[truong] = ''; }); };
}
/** Nhãn ngắn của một bản ghi liên quan để nêu ví dụ trong thông báo. */
function nhan(r) {
    return String(r.so || r.ten || r.hoTen || r.ma || r.maHang || r.id || '');
}

/* ==========================================================================
   BẢN ĐỒ LIÊN KẾT DỮ LIỆU CỦA TOÀN HỆ THỐNG
   Dùng cho việc rà soát trước khi xóa: không để lại dữ liệu mồ côi, không làm
   hỏng liên kết giữa chứng từ, kho, giá vốn, công nợ, doanh thu và báo cáo.
   ========================================================================== */
var CT_BAN = ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'bienBanGiao',
              'bienBanNghiemThu', 'deNghiTT', 'phieuThu'];
var CT_MUA = ['donMua', 'loNhap', 'phieuNhap', 'phieuChi'];
var CT_CO_DONG = ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'bienBanGiao',
                  'bienBanNghiemThu', 'deNghiTT', 'donMua', 'loNhap', 'phieuNhap',
                  'kiemKe', 'dieuChinhKho'];

var LIEN_KET = {};
CT_BAN.forEach(function (c) {
    (LIEN_KET.khachHang = LIEN_KET.khachHang || []).push(lk(c, theoId('khachHangId')));
});
CT_MUA.forEach(function (c) {
    (LIEN_KET.nhaCungCap = LIEN_KET.nhaCungCap || []).push(lk(c, theoId('nhaCungCapId')));
});
/* HÀNG HÓA LÀ DỮ LIỆU GỐC. Xóa một mặt hàng KHÔNG được xóa lịch sử bảng giá:
   phiên bản bảng giá là hồ sơ đã phát hành của nhà cung cấp, phải giữ nguyên số
   liệu. Ở đây chỉ ĐÁNH DẤU liên kết không còn hiệu lực — dòng giá vẫn còn
   nguyên trong phiên bản và vẫn tra được lịch sử. */
LIEN_KET.hangHoa = CT_CO_DONG.map(function (c) { return lk(c, theoDongHang()); }).concat([
    lk('theKho', function (r, rec) { return String(r.hangHoaId || '') === rec.id; }),
    lk('lichSuGiaVon', function (r, rec) { return String(r.hangHoaId || '') === rec.id; }),
    lk('bangGiaBan', function (r, rec) {
        return !!((r.bang && r.bang[rec.id]) || (r.gia && r.gia[rec.id] !== undefined));
    },
       'Đánh dấu liên kết không còn hiệu lực — lịch sử giá của phiên bản vẫn giữ nguyên, ' +
       'không xóa dòng giá nào',
       function (ds, rec) { T.ngungLienKetGia(ds, rec); })
]);
LIEN_KET.nhomHang = [lk('hangHoa', theoGiaTri('nhom', 'ten'),
    'Gỡ nhóm hàng khỏi các mặt hàng, hoặc chuyển sang nhóm khác', goTruong('nhom'))];
LIEN_KET.dvt = [lk('hangHoa', theoGiaTri('dvt', 'ma'),
    'Gỡ đơn vị tính khỏi các mặt hàng, hoặc đổi sang đơn vị khác', goTruong('dvt'))];
LIEN_KET.hangSX = [lk('hangHoa', theoGiaTri('nhaSanXuat', 'ten'),
    'Gỡ hãng sản xuất khỏi các mặt hàng, hoặc đổi sang hãng khác', goTruong('nhaSanXuat'))];
/* DỰ ÁN LIÊN KẾT BẰNG ID NỘI BỘ. Chứng từ đời cũ chỉ lưu tên dự án nên vẫn phải
   soát cả theo tên để không bỏ sót — nhưng liên kết chính thức là duAnId. */
LIEN_KET.duAn = ['baoGia', 'donBan', 'hopDong', 'phieuXuat', 'bienBanGiao',
                 'bienBanNghiemThu', 'deNghiTT'].map(function (c) {
    return lk(c, function (r, rec) {
        return String(r.duAnId || '') === rec.id ||
               (!r.duAnId && !!r.duAn && T.kd(r.duAn) === T.kd(rec.ten));
    },
        'Gỡ liên kết dự án khỏi chứng từ — số liệu trên chứng từ không đổi',
        function (ds) { ds.forEach(function (r) { r.duAnId = ''; r.duAn = ''; }); });
});
LIEN_KET.dieuKhoanGH = [];
/* Bảng giá chỉ được THAM CHIẾU: đơn giá đã lưu cứng trên từng dòng chứng từ nên
   gỡ tham chiếu không làm đổi bất kỳ con số nào. */
LIEN_KET.bangGiaBan = [
    lk('khachHang', theoId('bangGiaId'),
       'Gỡ bảng giá khỏi khách hàng — khách quay về bảng giá mặc định của công ty',
       goTruong('bangGiaId')),
    lk('baoGia', theoId('bangGiaId'),
       'Gỡ tham chiếu bảng giá trên chứng từ — đơn giá đã lưu không đổi', goTruong('bangGiaId')),
    lk('donBan', theoId('bangGiaId'),
       'Gỡ tham chiếu bảng giá trên chứng từ — đơn giá đã lưu không đổi', goTruong('bangGiaId')),
    lk('hopDong', theoId('bangGiaId'),
       'Gỡ tham chiếu bảng giá trên chứng từ — đơn giá đã lưu không đổi', goTruong('bangGiaId'))
].concat(['phuLuc', 'phieuXuat', 'bienBanGiao', 'bienBanNghiemThu'].map(function (c) {
    /* Chứng từ phía sau cũng chốt phiên bản bảng giá của cả chuỗi — xóa phiên bản
       phải gỡ hết, không để lại tham chiếu mồ côi. */
    return lk(c, theoId('bangGiaId'),
              'Gỡ tham chiếu bảng giá trên chứng từ — giá vốn đã đóng băng không đổi',
              goTruong('bangGiaId'));
}));
LIEN_KET.donVi = ['kho', 'nguoiKy'].map(function (c) {
    return lk(c, theoId('donViId'));
}).concat([
    /* PRICE POLICY ENGINE V2.0 — chính sách giá nội bộ nằm trong từng phiên bản
       bảng giá, xóa đơn vị phải gỡ chính sách của đơn vị đó khỏi mọi phiên bản. */
    lk('bangGiaBan', function (r, rec) {
        return (r.chietKhauNoiBo || {})[rec.id] !== undefined;
    }, 'Gỡ chiết khấu nội bộ của đơn vị khỏi các phiên bản bảng giá',
       function (ds, rec) {
           ds.forEach(function (r) {
               var ck = T.clone(r.chietKhauNoiBo || {});
               delete ck[rec.id];
               r.chietKhauNoiBo = ck;
           });
       })
]).concat(CT_BAN.concat(CT_MUA).map(function (c) { return lk(c, theoId('donVi')); }))
  .concat([lk('nhanVien', theoId('donVi')), lk('nguoiDung', theoId('donVi'))]);
LIEN_KET.kho = ['phieuNhap', 'phieuXuat', 'loNhap', 'donMua', 'kiemKe', 'dieuChinhKho']
    .map(function (c) { return lk(c, theoId('khoId')); })
    .concat([lk('theKho', function (r, rec) { return r.khoId === rec.id; })]);
LIEN_KET.nhanVien = CT_BAN.concat(CT_MUA).map(function (c) { return lk(c, theoId('nguoiLapId')); })
    .concat([lk('nguoiDung', theoId('nhanVienId'))]);
LIEN_KET.vaiTro = [lk('nguoiDung', theoId('vaiTroId'), 'Chuyển người dùng sang vai trò khác')];
LIEN_KET.loNhap = [lk('phieuNhap', theoId('loNhapId'))];
LIEN_KET.baoGia = [lk('donBan', theoId('baoGiaId')), lk('bienBanGiao', theoId('baoGiaId'))];
LIEN_KET.donBan = ['hopDong', 'phuLuc', 'phieuXuat', 'bienBanGiao', 'bienBanNghiemThu',
                   'deNghiTT', 'phieuThu'].map(function (c) { return lk(c, theoId('donBanId')); });
LIEN_KET.hopDong = ['phuLuc', 'phieuXuat', 'bienBanGiao', 'bienBanNghiemThu', 'deNghiTT']
    .map(function (c) { return lk(c, theoId('hopDongId')); });
LIEN_KET.phieuXuat = [lk('bienBanGiao', theoId('phieuXuatId'))];
LIEN_KET.bienBanGiao = [lk('bienBanNghiemThu', theoId('bienBanGiaoId'))];
/* Biên bản nghiệm thu (BBNT / BBNTGT) đang được dùng làm CĂN CỨ của đề nghị
   thanh toán: gỡ căn cứ khỏi đề nghị, số tiền đã khai trên đề nghị không đổi. */
LIEN_KET.bienBanNghiemThu = [lk('deNghiTT', theoId('bienBanNTId'),
    'Gỡ căn cứ nghiệm thu khỏi đề nghị thanh toán — số tiền đã khai trên đề nghị không đổi',
    function (ds) { ds.forEach(function (r) { r.loaiCanCu = ''; r.bienBanNTId = ''; r.bienBanNTSo = ''; }); })];
/* Phiếu nhập hàng kéo theo LÔ NHẬP và PHIẾU NHẬP KHO của chính nó — xóa phiếu
   mà bỏ lại hai bản ghi này là để tồn kho và giá vốn không còn chứng từ gốc. */
LIEN_KET.donMua = [lk('phieuChi', theoId('donMuaId')),
                   lk('phieuNhap', function (r, rec) {
                       var ids = {};
                       DB.all('loNhap').forEach(function (l) {
                           if (l.donMuaId === rec.id) ids[l.id] = 1;
                       });
                       return !!ids[r.loNhapId];
                   }, 'Thu hồi phiếu nhập kho rồi xóa — tồn kho và giá vốn trở lại như trước khi nhập',
                      function (ds) {
                          ds.forEach(function (p2) {
                              if (p2.trangThai === 'Đã ghi sổ') T.thuHoiNhapKho(p2);
                              DB.remove('phieuNhap', p2.id);
                          });
                          T.dungTheKho();
                      }),
                   lk('loNhap', theoId('donMuaId'),
                      'Xóa lô nhập kỹ thuật đi kèm phiếu nhập hàng',
                      function (ds) {
                          ds.forEach(function (l2) { DB.remove('loNhap', l2.id); });
                      })];
LIEN_KET.kiemKe = [lk('dieuChinhKho', theoId('kiemKeId'))];
LIEN_KET.nguoiKy = [];
LIEN_KET.thueSuat = [];
LIEN_KET.dieuKhoanTT = [];
/* Loại giá đang được phiên bản bảng giá dùng thì phải gỡ khỏi phiên bản trước. */
LIEN_KET.loaiGia = [lk('bangGiaBan', function (r, rec) {
    return (r.cotGia || []).some(function (c) { return T.kd(c) === T.kd(rec.ten); });
}, 'Gỡ loại giá khỏi các phiên bản bảng giá — số giá đã lưu không đổi',
    function (ds, rec) {
        ds.forEach(function (b) {
            b.cotGia = (b.cotGia || []).filter(function (c) { return T.kd(c) !== T.kd(rec.ten); });
            if (T.kd(b.cotChinh || '') === T.kd(rec.ten)) b.cotChinh = b.cotGia[0] || '';
        });
    })];
LIEN_KET.mauBangGia = [];
LIEN_KET.tepGoc = [];
W.LIEN_KET_XOA = LIEN_KET;

/* ==========================================================================
   KIỂM TRA TOÀN VẸN DỮ LIỆU
   Bản đồ khóa ngoại theo chiều ngược lại: trường nào của phân hệ nào phải trỏ
   tới một bản ghi CÓ THẬT. Dùng để bảo đảm sau mọi lần xóa, dữ liệu vẫn liên
   kết chặt chẽ với nhau — không còn bản ghi mồ côi, không đứt liên kết.
   ========================================================================== */
var KHOA_NGOAI = {
    baoGia:  { khachHangId: 'khachHang', bangGiaId: 'bangGiaBan', nguoiLapId: 'nhanVien',
               donVi: 'donVi' },
    donBan:  { khachHangId: 'khachHang', bangGiaId: 'bangGiaBan', baoGiaId: 'baoGia',
               nguoiLapId: 'nhanVien', donVi: 'donVi' },
    hopDong: { khachHangId: 'khachHang', bangGiaId: 'bangGiaBan', donBanId: 'donBan',
               nguoiLapId: 'nhanVien', donVi: 'donVi' },
    phuLuc:  { khachHangId: 'khachHang', hopDongId: 'hopDong', donBanId: 'donBan',
               bangGiaId: 'bangGiaBan', nguoiLapId: 'nhanVien', donVi: 'donVi' },
    phieuXuat: { khachHangId: 'khachHang', donBanId: 'donBan', hopDongId: 'hopDong',
                 bangGiaId: 'bangGiaBan', khoId: 'kho', nguoiLapId: 'nhanVien', donVi: 'donVi' },
    bienBanGiao: { khachHangId: 'khachHang', donBanId: 'donBan', hopDongId: 'hopDong',
                   baoGiaId: 'baoGia', phieuXuatId: 'phieuXuat', bangGiaId: 'bangGiaBan',
                   nguoiLapId: 'nhanVien', donVi: 'donVi' },
    bienBanNghiemThu: { khachHangId: 'khachHang', donBanId: 'donBan', hopDongId: 'hopDong',
                        bienBanGiaoId: 'bienBanGiao', bangGiaId: 'bangGiaBan',
                        nguoiLapId: 'nhanVien', donVi: 'donVi' },
    deNghiTT: { khachHangId: 'khachHang', donBanId: 'donBan', hopDongId: 'hopDong',
                bienBanNTId: 'bienBanNghiemThu', nguoiLapId: 'nhanVien', donVi: 'donVi' },
    phieuThu: { khachHangId: 'khachHang', donBanId: 'donBan', nguoiLapId: 'nhanVien',
                donVi: 'donVi' },
    donMua:   { nhaCungCapId: 'nhaCungCap', khoId: 'kho', nguoiLapId: 'nhanVien',
                donVi: 'donVi' },
    loNhap:   { nhaCungCapId: 'nhaCungCap', khoId: 'kho', nguoiLapId: 'nhanVien', donMuaId: 'donMua' },
    phieuNhap:{ nhaCungCapId: 'nhaCungCap', khoId: 'kho', loNhapId: 'loNhap',
                nguoiLapId: 'nhanVien' },
    phieuChi: { nhaCungCapId: 'nhaCungCap', donMuaId: 'donMua', nguoiLapId: 'nhanVien',
                donVi: 'donVi' },
    kiemKe:      { khoId: 'kho', dieuChinhId: 'dieuChinhKho' },
    dieuChinhKho:{ khoId: 'kho', kiemKeId: 'kiemKe' },
    khachHang: { bangGiaId: 'bangGiaBan' },
    kho:       { donViId: 'donVi' },
    nguoiKy:   { donViId: 'donVi' },
    nguoiDung: { vaiTroId: 'vaiTro', nhanVienId: 'nhanVien', donVi: 'donVi' },
    nhanVien:  { donVi: 'donVi' }
};
/* Chứng từ có dòng hàng — mã hàng phải có trong Danh mục Hàng hóa. */
var CO_MA_HANG = ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat', 'phieuNhap',
                  'donMua', 'loNhap', 'kiemKe', 'dieuChinhKho'];

/**
 * RÀ SOÁT TOÀN VẸN DỮ LIỆU TOÀN HỆ THỐNG.
 * Trả về { tong, loi: [{ phanHe, truong, troTi, so, viDu }] } — mọi tham chiếu
 * đang trỏ tới bản ghi không còn tồn tại.
 */
T.raSoatToanVen = function () {
    var loi = [], tong = 0;
    Object.keys(KHOA_NGOAI).forEach(function (coll) {
        var ds = DB.all(coll);
        if (!ds.length) return;
        Object.keys(KHOA_NGOAI[coll]).forEach(function (truong) {
            var dich = KHOA_NGOAI[coll][truong];
            var hong = ds.filter(function (r) {
                var v = r[truong];
                return v !== undefined && v !== null && v !== '' && !DB.get(dich, v);
            });
            if (!hong.length) return;
            tong += hong.length;
            loi.push({ phanHe: TEN_PH[coll] || coll, coll: coll, truong: truong,
                       troTi: TEN_PH[dich] || dich, so: hong.length,
                       viDu: hong.slice(0, 4).map(nhan) });
        });
    });
    /* Dòng hàng của chứng từ phải trỏ tới mặt hàng bằng ID NỘI BỘ. Dòng nào
       không tra ra mặt hàng nào (kể cả tra bù theo Mã ERP / Model của dữ liệu
       đời cũ) mới là liên kết hỏng. */
    CO_MA_HANG.forEach(function (coll) {
        var hong = [];
        DB.all(coll).forEach(function (r) {
            (r.lines || []).forEach(function (l) {
                if ((l.hangHoaId || l.maHang) && !T.idHH(l)) hong.push(r);
            });
        });
        if (!hong.length) return;
        tong += hong.length;
        loi.push({ phanHe: TEN_PH[coll] || coll, coll: coll, truong: 'Dòng hàng — Mã hàng',
                   troTi: 'Hàng hóa', so: hong.length, viDu: hong.slice(0, 4).map(nhan) });
    });
    /* MỘT BẢNG GIÁ — MỘT PHIÊN BẢN HIỆU LỰC TẠI MỘT THỜI ĐIỂM.
       Hai phiên bản cùng mã cùng phủ một ngày thì hệ thống phải đoán lấy bản nào,
       và giá vốn nội bộ của cùng một chứng từ có thể đổi theo thứ tự dữ liệu. */
    var chong = [];
    (function () {
        var theoMa = {};
        DB.all('bangGiaBan').forEach(function (b) {
            if (b.trangThai !== 'Đang áp dụng') return;
            var k = b.ma || b.nhaCungCap || b.id;
            (theoMa[k] = theoMa[k] || []).push(b);
        });
        Object.keys(theoMa).forEach(function (k) {
            var ds2 = theoMa[k];
            var daCo = {};
            for (var i = 0; i < ds2.length; i++) for (var j = i + 1; j < ds2.length; j++) {
                var a = ds2[i], b2 = ds2[j];
                var tuA = a.tuNgay || '0000-01-01', denA = a.denNgay || '9999-12-31';
                var tuB = b2.tuNgay || '0000-01-01', denB = b2.denNgay || '9999-12-31';
                if (tuA > denB || tuB > denA) continue;
                /* Mỗi phiên bản chỉ đếm MỘT lần dù chồng lấn với nhiều bản khác. */
                if (!daCo[a.id]) { daCo[a.id] = 1; chong.push(a); }
                if (!daCo[b2.id]) { daCo[b2.id] = 1; chong.push(b2); }
            }
        });
    })();
    if (chong.length) {
        tong += chong.length;
        loi.push({ phanHe: 'Bảng giá', coll: 'bangGiaBan',
                   truong: 'Hai phiên bản cùng hiệu lực một thời điểm',
                   troTi: 'Bảng giá', so: chong.length,
                   viDu: chong.slice(0, 4).map(nhan) });
    }
    return { tong: tong, loi: loi };
};

/**
 * RÀ SOÁT RIÊNG CUSTOMER MASTER DATA.
 * Trả về danh sách các điểm dữ liệu không đạt chuẩn dữ liệu nền:
 * trùng mã số thuế · trùng căn cước · trùng mã khách hàng · thiếu loại khách
 * hàng · mã số thuế sai định dạng · khách hàng không có tên.
 */
T.raSoatKhachHang = function () {
    var ds = DB.all('khachHang'), loi = [], tong = 0;
    function them(truong, hong, mo) {
        if (!hong.length) return;
        tong += hong.length;
        loi.push({ phanHe: 'Khách hàng', coll: 'khachHang', truong: truong,
                   troTi: mo || 'Chuẩn dữ liệu nền', so: hong.length,
                   viDu: hong.slice(0, 4).map(function (x) { return (x.ma || '') + ' ' + (x.ten || ''); }) });
    }
    function trung(lay) {
        var m = {}, ra = [];
        ds.forEach(function (x) {
            var k = lay(x);
            if (!k) return;
            if (m[k]) ra.push(x); else m[k] = x;
        });
        return ra;
    }
    them('Mã số thuế trùng', trung(function (x) { return T.chuanMST(x.mst); }), 'Không được có hai hồ sơ cùng mã số thuế');
    them('Căn cước trùng', trung(function (x) {
        return x.loai === 'Cá nhân' ? String(x.cccd || '').replace(/\s/g, '') : ''; }),
        'Không được có hai hồ sơ cùng số căn cước');
    them('Mã khách hàng trùng', trung(function (x) { return x.ma; }), 'Mã khách hàng phải duy nhất');
    them('Thiếu loại khách hàng', ds.filter(function (x) {
        return T.LOAI_KH.indexOf(x.loai) < 0; }), 'Phải là Doanh nghiệp hoặc Cá nhân');
    them('Mã số thuế sai định dạng', ds.filter(function (x) {
        return x.mst && !T.mstHopLe(x.mst); }), 'Phải gồm 10 hoặc 13 chữ số');
    them('Thiếu tên khách hàng', ds.filter(function (x) {
        return !String(x.ten || '').trim(); }), 'Bắt buộc có tên');
    them('Mã khách hàng không đúng quy chuẩn', ds.filter(function (x) {
        return !/^KH\d{6}$/.test(String(x.ma || '')); }), 'Hệ thống sinh dạng KH000001');
    them('Cá nhân còn giữ mã số thuế', ds.filter(function (x) {
        return x.loai === 'Cá nhân' && x.mst; }), 'Khách hàng cá nhân không có mã số thuế');
    return { tong: tong, loi: loi };
};

/**
 * RÀ SOÁT RIÊNG MASTER DATA HÀNG HÓA.
 * Kiểm tra đúng những cam kết kiến trúc của Danh mục Hàng hóa:
 *   · Một mặt hàng chỉ có MỘT Mã hàng, và Mã hàng không trùng nhau.
 *   · Mã hàng đúng quy tắc thống nhất do hệ thống sinh ra.
 *   · Model là trường bắt buộc và luôn giữ đúng mã của nhà sản xuất.
 *   · Không có hai bản ghi cho cùng một mặt hàng (trùng Model + Tên + Thông số).
 *   · Mọi dòng chứng từ đều liên kết bằng ID nội bộ của Danh mục.
 */
T.raSoatHangHoa = function () {
    var ds = DB.all('hangHoa'), loi = [], tong = 0;
    function them(truong, hong, mo) {
        if (!hong.length) return;
        tong += hong.length;
        loi.push({ phanHe: 'Hàng hóa', coll: 'hangHoa', truong: truong,
                   troTi: mo || 'Chuẩn Master Data', so: hong.length,
                   viDu: hong.slice(0, 4).map(function (x) {
                       return (x.ma || x.model || '') + ' ' + (x.ten || ''); }) });
    }
    function trung(lay) {
        var m = {}, ra = [];
        ds.forEach(function (x) {
            var k = lay(x); if (!k) return;
            if (m[k]) ra.push(x); else m[k] = x;
        });
        return ra;
    }
    them('Mã hàng trùng', trung(function (x) { return T.kd(x.ma || ''); }),
         'Một Mã hàng chỉ đại diện cho một mặt hàng');
    them('Thiếu Mã hàng', ds.filter(function (x) { return !String(x.ma || '').trim(); }),
         'Mã hàng do hệ thống sinh, không được để trống');
    them('Mã hàng không đúng quy tắc', ds.filter(function (x) { return !T.maHangChuan(x.ma); }),
         'Quy tắc thống nhất: ' + T.TIEN_TO_MA_HANG + 'số nội bộ');
    them('Thiếu Model', ds.filter(function (x) { return !String(x.model || '').trim(); }),
         'Model của nhà sản xuất là trường bắt buộc');
    them('Thiếu Đơn vị tính', ds.filter(function (x) { return !String(x.dvt || '').trim(); }),
         'Đơn vị tính thuộc hồ sơ tối thiểu của một mặt hàng');
    them('Thiếu Nhóm hàng', ds.filter(function (x) { return !String(x.nhom || '').trim(); }),
         'Nhóm hàng thuộc hồ sơ tối thiểu của một mặt hàng');
    them('Thiếu Hãng', ds.filter(function (x) {
             return !String(x.hang || x.nhaSanXuat || '').trim(); }),
         'Hãng thuộc hồ sơ tối thiểu của một mặt hàng');
    them('Số hiệu nội bộ trùng', trung(function (x) { return String(x.maNoiBo || ''); }),
         'Số hiệu nội bộ phải duy nhất');
    them('Khai hai lần cùng một mặt hàng',
         trung(function (x) { return T.khoaHH(x); }),
         'Trùng cả Model, Tên hàng và Thông số kỹ thuật');
    /* Dòng chứng từ phải liên kết bằng ID nội bộ, không đi bằng chuỗi mã. */
    var thieuId = [];
    CO_MA_HANG.forEach(function (coll) {
        DB.all(coll).forEach(function (r) {
            (r.lines || []).forEach(function (l) {
                if (!(l.hangHoaId || l.maHang || l.tenHang)) return;
                if (!l.hangHoaId || !T.chiMucHangHoa().id[l.hangHoaId]) thieuId.push(r);
            });
        });
    });
    if (thieuId.length) {
        tong += thieuId.length;
        loi.push({ phanHe: 'Chứng từ có dòng hàng', coll: '', truong: 'Dòng hàng chưa gắn ID nội bộ',
                   troTi: 'Danh mục Hàng hóa', so: thieuId.length,
                   viDu: thieuId.slice(0, 4).map(nhan) });
    }
    return { tong: tong, loi: loi };
};

/** Cảnh báo ngay nếu một thao tác vừa làm đứt liên kết dữ liệu. */
function canhBaoToanVen() {
    var kq = T.raSoatToanVen();
    if (!kq.tong) return kq;
    UI.toast('err', 'Phát hiện ' + T.num(kq.tong, 0) + ' liên kết dữ liệu bị đứt',
        kq.loi.slice(0, 3).map(function (x) {
            return x.phanHe + ' → ' + x.troTi + ' (' + x.so + ')';
        }).join(' · ') + '. Vào Hệ thống → Cài đặt để kiểm tra toàn vẹn dữ liệu.', 12000);
    return kq;
}
W.canhBaoToanVen = canhBaoToanVen;

/* ==========================================================================
   RÀNG BUỘC RIÊNG CỦA TỪNG PHÂN HỆ
   Trả về danh sách { ly, huong } — lý do không xóa cứng được và cách xử lý.
   ========================================================================== */
function so(coll, loc) { return DB.all(coll).filter(loc).length; }

var RIENG = {
    donVi: function (r) {
        var ds = [];
        if (DB.data._meta.ctyId === r.id)
            ds.push({ ly: 'Đây là đơn vị đang làm việc của phiên đăng nhập.',
                      huong: 'Chuyển sang đơn vị khác tại Trang chủ rồi xóa lại.' });
        return ds;
    },
    bangGiaBan: function (r) {
        var ds = [];
        if (r.macDinh)
            ds.push({ ly: 'Đây là bảng giá mặc định của nhà cung cấp ' +
                          (r.nhaCungCap || r.ma || '') + '.',
                      huong: 'Bỏ đánh dấu mặc định, hoặc đặt một phiên bản khác làm mặc định.',
                      go: function (x) { x.macDinh = false; } });
        return ds;
    },
    vaiTro: function (r) {
        var ds = [];
        if (r.heThong)
            ds.push({ ly: 'Đây là vai trò hệ thống.',
                      huong: 'Vai trò hệ thống không được xóa để bảo đảm phân quyền.' });
        return ds;
    },
    nguoiDung: function (r) {
        var ds = [];
        if (r.taiKhoan === 'admin')
            ds.push({ ly: 'Đây là tài khoản quản trị gốc của hệ thống.',
                      huong: 'Tài khoản quản trị gốc chỉ được khóa, không xóa.' });
        if (DB.user() && DB.user().id === r.id)
            ds.push({ ly: 'Đây là tài khoản đang đăng nhập.',
                      huong: 'Đăng nhập bằng tài khoản khác rồi xóa lại.' });
        return ds;
    },
    hangHoa: function (r) {
        var ds = [];
        if (Number(r.ton) > 0)
            ds.push({ ly: 'Mặt hàng đang còn tồn kho ' + T.num(r.ton) + ' ' + (r.dvt || '') + '.',
                      huong: 'Xuất hết tồn kho hoặc lập phiếu điều chỉnh tồn về 0 trước khi xóa.' });
        return ds;
    },
    kho: function (r) {
        var ds = [];
        var tk = so('theKho', function (x) { return x.khoId === r.id; });
        if (!tk && DB.all('kho').length <= 1)
            ds.push({ ly: 'Đây là kho duy nhất của hệ thống.',
                      huong: 'Khai thêm một kho khác trước khi xóa kho này.' });
        return ds;
    },
    loNhap: function (r) {
        var ds = [];
        if (T.loDaVaoSo(r))
            ds.push({ ly: 'Lô đã nhập kho — tồn kho và giá vốn bình quân đã ghi nhận theo lô này.',
                      huong: 'Bấm “Thu hồi nhập kho” để trả tồn kho và giá vốn về nguyên trạng, ' +
                             'rồi mới xóa lô. Không xóa thẳng lô đã vào sổ.' });
        return ds;
    },
    /* PHIẾU NHẬP KHO ĐÃ GHI SỔ KHÔNG ĐƯỢC XÓA THẲNG.
       Trước đây không có luật này: xóa một phiếu nhập đã ghi sổ sẽ lấy mất dòng
       sổ kho trong khi tồn kho của hàng hóa vẫn giữ nguyên phần đã cộng — số
       liệu lệch ngay và không cách nào truy ra. */
    phieuNhap: function (r) {
        var ds = [];
        if (r.trangThai === 'Đã ghi sổ')
            ds.push({ ly: 'Phiếu nhập kho đã ghi sổ — tồn kho và giá vốn bình quân đã ghi nhận theo phiếu này.',
                      huong: 'Bấm “Hủy phiếu” để Business Engine trả tồn kho, giá vốn và lịch sử giá vốn ' +
                             'về nguyên trạng, rồi mới xóa.' });
        return ds;
    },
    kiemKe: function (r) {
        var ds = [];
        if (r.trangThai === 'Đã hoàn tất' || r.trangThai === 'Hoàn thành')
            ds.push({ ly: 'Biên bản kiểm kê đã hoàn tất — thuộc lịch sử kiểm kê kho.',
                      huong: 'Lịch sử kiểm kê được giữ nguyên; lập biên bản kiểm kê mới nếu cần.' });
        return ds;
    },
    dieuChinhKho: function (r) {
        var ds = [];
        if (r.trangThai === 'Đã duyệt')
            ds.push({ ly: 'Phiếu đã duyệt và đã tác động vào tồn kho.',
                      huong: 'Lập phiếu điều chỉnh ngược lại để hoàn tác, không xóa phiếu đã duyệt.' });
        return ds;
    }
};
/* Chứng từ đã khóa: mọi loại chứng từ đều áp dụng chung một quy tắc. */
function khoaChungTu(r) {
    if (!r || !r.khoa) return [];
    return [{ ly: 'Chứng từ đang bị khóa.',
              huong: 'Bấm “Mở khóa” trên thanh công cụ rồi xóa lại.' }];
}

/* ==========================================================================
   XÓA MỀM — dữ liệu đã phát sinh giao dịch thì ngừng sử dụng, không xóa cứng
   ========================================================================== */
var MEM = {
    khachHang:  { truong: 'trangThai', gt: 'Ngừng giao dịch', nut: 'Chuyển sang Ngừng giao dịch' },
    nhaCungCap: { truong: 'trangThai', gt: 'Ngừng giao dịch', nut: 'Chuyển sang Ngừng giao dịch' },
    hangHoa:    { truong: 'trangThai', gt: 'Ngừng kinh doanh', nut: 'Chuyển sang Ngừng kinh doanh' },
    kho:        { truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    bangGiaBan: { truong: 'trangThai', gt: 'Ngừng áp dụng', nut: 'Chuyển sang Ngừng áp dụng' },
    nhanVien:   { truong: 'trangThai', gt: 'Nghỉ việc', nut: 'Chuyển sang Nghỉ việc' },
    nguoiDung:  { truong: 'trangThai', gt: 'Khóa', nut: 'Khóa tài khoản' },
    donVi:      { truong: 'trangThai', gt: 'Ngừng hoạt động', nut: 'Chuyển sang Ngừng hoạt động' },
    duAn:       { truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    nhomHang:   { truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    dvt:        { truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    hangSX:     { truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    thueSuat:   { truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    dieuKhoanTT:{ truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    dieuKhoanGH:{ truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    loaiGia:    { truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    nguoiKy:    { truong: 'trangThai', gt: 'Ngừng dùng', nut: 'Chuyển sang Ngừng dùng' },
    vaiTro:     null
};
W.XOA_MEM = MEM;

/* ==========================================================================
   RÀ SOÁT XÓA — trả lời: có xóa được không, vì sao, và cần làm gì
   ========================================================================== */
T.raSoatXoa = function (coll, rec) {
    var kq = { coll: coll, phanHe: TEN_PH[coll] || coll, can: [], rieng: [],
               tong: 0, xoaDuoc: true, mem: null, memDaBat: false };
    if (!rec) { kq.xoaDuoc = false; return kq; }

    kq.rieng = (RIENG[coll] ? RIENG[coll](rec) : []).concat(khoaChungTu(rec));

    (LIEN_KET[coll] || []).forEach(function (e) {
        var ds = DB.all(e.coll).filter(function (r) {
            return r.id !== rec.id && e.khop(r, rec);
        });
        if (!ds.length) return;
        kq.tong += ds.length;
        kq.can.push({
            coll: e.coll, phanHe: e.ten, so: ds.length, ds: ds, go: e.go,
            viDu: ds.slice(0, 4).map(nhan).filter(Boolean),
            huong: e.huong || ('Xóa hoặc gỡ liên kết ' + ds.length + ' bản ghi ở phân hệ ' + e.ten + ' trước.')
        });
    });

    kq.xoaDuoc = !kq.can.length && !kq.rieng.length;
    /* Toàn bộ ràng buộc đều là THAM CHIẾU MỀM → hệ thống gỡ giúp rồi xóa được ngay. */
    kq.goNhanh = !kq.xoaDuoc &&
        kq.rieng.every(function (x) { return !!x.go; }) &&
        kq.can.every(function (x) { return !!x.go; });
    kq.mem = MEM[coll] || null;
    if (kq.mem) kq.memDaBat = rec[kq.mem.truong] === kq.mem.gt;
    return kq;
};

/* Rà soát nhanh cho nhiều bản ghi — dùng cho xóa hàng loạt. */
T.raSoatXoaNhieu = function (coll, ds) {
    var duoc = [], chan = [];
    (ds || []).forEach(function (r) {
        var kq = T.raSoatXoa(coll, r);
        if (kq.xoaDuoc) duoc.push(r); else chan.push({ r: r, kq: kq });
    });
    return { duoc: duoc, chan: chan };
};

/* ==========================================================================
   HỘP THOẠI XÓA CHUẨN — dùng chung cho toàn bộ phân hệ
   ========================================================================== */
function dongLyDo(kq) {
    var h = '';
    if (kq.rieng.length) {
        h += '<ul class="xoa-ly">' + kq.rieng.map(function (x) {
            return '<li><b>' + T.esc(x.ly) + '</b><div class="muted small">→ ' + T.esc(x.huong) + '</div></li>';
        }).join('') + '</ul>';
    }
    if (kq.can.length) {
        h += '<div class="tablewrap mt8"><table class="grid"><thead><tr>' +
            '<th>Phân hệ đang sử dụng</th><th class="ctr" style="width:110px">Số bản ghi</th>' +
            '<th>Ví dụ</th><th style="width:34%">Cần làm gì để xóa được</th></tr></thead><tbody>' +
            kq.can.map(function (x) {
                return '<tr><td><b>' + T.esc(x.phanHe) + '</b></td>' +
                    '<td class="ctr"><span class="pill r">' + T.num(x.so, 0) + '</span></td>' +
                    '<td><span class="ellip">' + T.esc(x.viDu.join(' · ') || '—') +
                    (x.so > x.viDu.length ? ' …' : '') + '</span></td>' +
                    '<td class="small">' + T.esc(x.huong) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
    }
    return h;
}

/** Gỡ toàn bộ tham chiếu mềm của một bản ghi. Trả về số bản ghi đã gỡ. */
T.goRangBuoc = function (coll, rec, kq) {
    kq = kq || T.raSoatXoa(coll, rec);
    var n = 0;
    DB.gopGhi();
    try {
        kq.rieng.forEach(function (x) {
            if (!x.go) return;
            var b = DB.get(coll, rec.id) || rec;
            x.go(b); DB.log('Cập nhật', coll, b); n++;
        });
        kq.can.forEach(function (x) {
            if (!x.go || !x.ds) return;
            x.go(x.ds, rec);
            x.ds.forEach(function (r) { DB.log('Cập nhật', x.coll, r); });
            n += x.ds.length;
        });
    } finally { DB.xongGopGhi(); }
    DB.save();
    return n;
};

/**
 * XÓA MỘT BẢN GHI THEO CHUẨN CHUNG.
 * o = { coll, rec, ten, mod, sauKhi, truocKhi }
 * Nút Xóa luôn bấm được: hàm này tự rà soát rồi quyết định xóa hay báo lý do.
 */
UI.xoaChuan = function (o) {
    var coll = o.coll, rec = o.rec;
    if (!rec) return UI.toast('warn', 'Chưa chọn bản ghi', 'Hãy chọn một dòng trong danh sách rồi bấm Xóa.');
    if (o.mod && W.Q && !W.Q.co(o.mod, 'xoa')) return UI.thieuQuyen(o.mod, 'xoa');
    var ten = o.ten || nhan(rec);
    var kq = T.raSoatXoa(coll, rec);

    if (kq.xoaDuoc) {
        UI.confirm({
            title: 'Xác nhận xóa', danger: true, icon: 'bi-exclamation-triangle-fill',
            message: 'Xóa <b>' + T.esc(ten) + '</b>?',
            note: 'Hệ thống đã rà soát toàn bộ liên kết dữ liệu: <b>chưa phát sinh giao dịch</b> và ' +
                  '<b>không có phân hệ nào đang sử dụng</b> bản ghi này. ' +
                  'Dữ liệu được chuyển vào <b>Thùng rác</b> — khôi phục lại được tại <i>Hệ thống → Thùng rác</i>.',
            okText: 'Xóa', okIcon: 'bi-trash',
            ok: function () {
                if (o.truocKhi && o.truocKhi(rec) === false) return;
                DB.remove(coll, rec.id);
                if (o.sauKhi) o.sauKhi(rec);
                UI.toast('ok', 'Đã xóa ' + (TEN_PH[coll] || '').toLowerCase(), ten +
                    ' — đã chuyển vào Thùng rác. Liên kết dữ liệu đã được rà soát lại.');
                canhBaoToanVen();
            }
        });
        return;
    }

    /* ---- Không xóa cứng được: nêu rõ lý do, số lượng và hướng xử lý ---- */
    var mem = kq.mem, coMem = mem && !kq.memDaBat;
    var nut = [{ text: 'Đóng', click: function (h) { h.close(); } }];
    if (kq.goNhanh) {
        nut.push({ text: 'Gỡ ràng buộc rồi xóa', cls: 'danger', icon: 'bi-scissors', click: function (h) {
            var n = T.goRangBuoc(coll, rec, kq);
            var lai = T.raSoatXoa(coll, DB.get(coll, rec.id) || rec);
            h.close();
            if (!lai.xoaDuoc) {
                if (o.sauKhi) o.sauKhi(rec);
                return UI.toast('warn', 'Đã gỡ ' + n + ' liên kết',
                    'Vẫn còn ràng buộc khác — bấm Xóa lại để xem chi tiết.', 7000);
            }
            if (o.truocKhi && o.truocKhi(rec) === false) return;
            DB.remove(coll, rec.id);
            if (o.sauKhi) o.sauKhi(rec);
            UI.toast('ok', 'Đã gỡ ' + n + ' liên kết và xóa ' + ten,
                'Toàn bộ số liệu trên chứng từ liên quan giữ nguyên. ' +
                'Bản ghi đã chuyển vào Thùng rác.', 7000);
            canhBaoToanVen();
        } });
    }
    if (coMem) {
        nut.push({ text: mem.nut, cls: 'primary', icon: 'bi-slash-circle', click: function (h) {
            var b = DB.get(coll, rec.id) || rec;
            b[mem.truong] = mem.gt;
            DB.log('Cập nhật', coll, b); DB.save();
            h.close();
            if (o.sauKhi) o.sauKhi(b);
            UI.toast('ok', 'Đã chuyển sang “' + mem.gt + '”',
                ten + ' không còn xuất hiện khi lập chứng từ mới. ' +
                'Toàn bộ dữ liệu và lịch sử liên quan được giữ nguyên.', 7000);
        } });
    }
    UI.modal({
        size: 'lg', dismiss: false, icon: 'bi-shield-exclamation',
        title: 'Không xóa được ' + (TEN_PH[coll] || '').toLowerCase() + ' “' + ten + '”',
        sub: kq.tong
            ? 'Đang có ' + T.num(kq.tong, 0) + ' bản ghi ở ' + kq.can.length + ' phân hệ liên quan'
            : 'Ràng buộc nghiệp vụ của hệ thống',
        body: '<div class="note r mb12"><i class="bi bi-exclamation-triangle-fill"></i><div>' +
            'Xóa bản ghi này sẽ làm <b>hỏng liên kết dữ liệu</b> và sinh ra dữ liệu mồ côi ở các phân hệ ' +
            'bên dưới, nên hệ thống <b>không thực hiện xóa</b>. Chi tiết:</div></div>' +
            dongLyDo(kq) +
            (kq.goNhanh
                ? '<div class="note b mt12"><i class="bi bi-scissors"></i><div>' +
                  'Toàn bộ ràng buộc trên đều là <b>tham chiếu</b>, không mang số liệu nghiệp vụ. ' +
                  'Bấm <b>“Gỡ ràng buộc rồi xóa”</b> để hệ thống tự gỡ giúp rồi xóa — ' +
                  '<b>đơn giá, công nợ, tồn kho và mọi số liệu trên chứng từ liên quan giữ nguyên</b>.' +
                  '</div></div>' : '') +
            (coMem
                ? '<div class="note b mt12"><i class="bi bi-slash-circle"></i><div>' +
                  'Dữ liệu đã phát sinh giao dịch nên <b>không xóa cứng</b>. Thay vào đó có thể chuyển sang ' +
                  '<b>“' + T.esc(mem.gt) + '”</b>: bản ghi không còn dùng để lập chứng từ mới, ' +
                  'nhưng <b>toàn bộ chứng từ, tồn kho, giá vốn, công nợ, doanh thu, báo cáo và nhật ký ' +
                  'vẫn nguyên vẹn</b>.</div></div>'
                : (kq.memDaBat
                    ? '<div class="note y mt12"><i class="bi bi-info-circle"></i><div>Bản ghi này ' +
                      '<b>đã ở trạng thái “' + T.esc(mem.gt) + '”</b> nên không còn dùng để lập chứng từ mới.' +
                      '</div></div>'
                    : '')),
        buttons: nut
    });
};

/** Xóa hàng loạt theo chuẩn chung: xóa phần được phép, báo rõ phần bị chặn. */
UI.xoaNhieuChuan = function (o) {
    var coll = o.coll, ds = o.ds || [];
    if (!ds.length) return UI.toast('warn', 'Chưa chọn bản ghi', 'Hãy tích chọn các dòng cần xóa.');
    if (o.mod && W.Q && !W.Q.co(o.mod, 'xoa')) return UI.thieuQuyen(o.mod, 'xoa');
    var p = T.raSoatXoaNhieu(coll, ds);
    var goDuoc = p.chan.filter(function (x) { return x.kq.goNhanh; });
    var body =
        '<div class="grid2 mb12">' +
        '<div class="kpi st g"><div class="lb">Xóa được</div><div class="vl">' + T.num(p.duoc.length, 0) + '</div></div>' +
        '<div class="kpi st r"><div class="lb">Bị chặn vì có dữ liệu liên quan</div><div class="vl">' +
            T.num(p.chan.length, 0) + '</div></div></div>' +
        (p.chan.length
            ? '<div class="tablewrap"><table class="grid"><thead><tr><th style="width:34%">Bản ghi</th>' +
              '<th>Lý do không xóa được</th></tr></thead><tbody>' +
              p.chan.slice(0, 40).map(function (x) {
                  var ly = x.kq.rieng.map(function (y) { return y.ly; })
                      .concat(x.kq.can.map(function (y) {
                          return 'Đang có ' + T.num(y.so, 0) + ' bản ghi ở ' + y.phanHe;
                      }));
                  return '<tr><td><b>' + T.esc(nhan(x.r)) + '</b></td>' +
                      '<td class="small">' + T.esc(ly.join(' · ')) +
                      (x.kq.goNhanh ? ' <span class="pill y">gỡ được</span>' : '') + '</td></tr>';
              }).join('') + '</tbody></table></div>' +
              (p.chan.length > 40 ? '<div class="small muted mt8">… và ' + (p.chan.length - 40) +
                                    ' bản ghi khác.</div>' : '')
            : '<div class="note g"><i class="bi bi-check2-circle"></i><div>Toàn bộ bản ghi đã chọn đều ' +
              'chưa phát sinh liên kết dữ liệu — xóa an toàn.</div></div>') +
        (goDuoc.length
            ? '<div class="note b mt12"><i class="bi bi-scissors"></i><div>' +
              'Trong đó <b>' + T.num(goDuoc.length, 0) + '</b> bản ghi chỉ vướng <b>tham chiếu</b>, ' +
              'không mang số liệu nghiệp vụ. Bấm <b>“Gỡ ràng buộc rồi xóa”</b> để hệ thống tự gỡ giúp ' +
              'rồi xóa — đơn giá, công nợ, tồn kho và mọi số liệu trên chứng từ liên quan giữ nguyên.' +
              '</div></div>' : '');
    UI.modal({
        size: 'lg', dismiss: false, danger: true, icon: 'bi-exclamation-triangle-fill',
        title: 'Xóa ' + T.num(ds.length, 0) + ' bản ghi đã chọn',
        sub: 'Hệ thống đã rà soát liên kết dữ liệu của từng bản ghi',
        body: body +
            '<div class="note b mt12"><i class="bi bi-trash"></i><div>Bản ghi xóa được sẽ chuyển vào ' +
            '<b>Thùng rác</b> — khôi phục lại được tại <i>Hệ thống → Thùng rác</i>. ' +
            'Bản ghi bị chặn <b>giữ nguyên</b>, không bị đụng tới.</div></div>',
        buttons: [
            { text: 'Đóng', click: function (h) { h.close(); } }
        ].concat(goDuoc.length ? [{
            text: 'Gỡ ràng buộc rồi xóa ' + (p.duoc.length + goDuoc.length) + ' bản ghi',
            cls: 'danger', icon: 'bi-scissors',
            click: function (h) {
                var nGo = 0, nXoa = 0;
                DB.gopGhi();
                try {
                    goDuoc.forEach(function (x) { nGo += T.goRangBuoc(coll, x.r, x.kq); });
                    p.duoc.concat(goDuoc.map(function (x) { return x.r; })).forEach(function (r) {
                        var lai = T.raSoatXoa(coll, DB.get(coll, r.id) || r);
                        if (lai.xoaDuoc) { DB.remove(coll, r.id); nXoa++; }
                    });
                } finally { DB.xongGopGhi(); }
                h.close();
                if (o.sauKhi) o.sauKhi(p.duoc);
                UI.toast('ok', 'Đã gỡ ' + nGo + ' liên kết và xóa ' + nXoa + ' bản ghi',
                    'Toàn bộ số liệu trên chứng từ liên quan giữ nguyên. ' +
                    'Bản ghi đã chuyển vào Thùng rác.', 8000);
                canhBaoToanVen();
            }
        }] : []).concat(p.duoc.length ? [{
            text: 'Xóa ' + p.duoc.length + ' bản ghi hợp lệ', cls: 'danger', icon: 'bi-trash',
            click: function (h) {
                DB.gopGhi();
                try { p.duoc.forEach(function (r) { DB.remove(coll, r.id); }); }
                finally { DB.xongGopGhi(); }
                h.close();
                if (o.sauKhi) o.sauKhi(p.duoc);
                UI.toast('ok', 'Đã xóa ' + p.duoc.length + ' bản ghi',
                    p.chan.length
                        ? p.chan.length + ' bản ghi giữ nguyên vì đang có dữ liệu liên quan.'
                        : 'Toàn bộ đã chuyển vào Thùng rác.', 7000);
                canhBaoToanVen();
            }
        }] : [])
    });
};

/**
 * BÁO KHÔNG THỰC HIỆN ĐƯỢC — dùng cho các nút có nghiệp vụ nhưng bản ghi hiện
 * tại chưa đủ điều kiện. Nút vẫn bấm được, hệ thống nói rõ vì sao và cần làm gì.
 */
UI.khongThe = function (viec, ly, huong) {
    UI.modal({
        size: 'sm', icon: 'bi-info-circle-fill',
        title: 'Chưa thực hiện được: ' + viec,
        body: '<div class="note y"><i class="bi bi-exclamation-triangle-fill"></i><div>' +
            '<b>' + T.esc(ly) + '</b>' +
            (huong ? '<div class="mt8">→ ' + T.esc(huong) + '</div>' : '') + '</div></div>',
        buttons: [{ text: 'Đã hiểu', cls: 'primary', click: function (h) { h.close(); } }]
    });
};

/* ==========================================================================
   CHUẨN THANH CÔNG CỤ THEO TRẠNG THÁI CHỌN DỮ LIỆU
   Chưa chọn  → chỉ Thêm mới · Nhập · Xuất · Làm mới · Tìm kiếm (và các công
                cụ mức phân hệ) hoạt động.
   Chọn 1 dòng → bật toàn bộ chức năng trên bản ghi.
   Chọn nhiều  → thanh chức năng hàng loạt tự bật (do UI.Grid quản lý).
   Nút bị tắt CHỈ vì chưa chọn dữ liệu — không bao giờ tắt vì ràng buộc nghiệp
   vụ; ràng buộc nghiệp vụ được kiểm tra và giải thích khi bấm.
   ========================================================================== */
UI.chonToolbar = function (host, keys, them) {
    /* Đánh dấu các nút chỉ dùng được khi đã chọn bản ghi. Hàm này thường được gọi
       lúc dựng cấu hình lưới — trước khi thanh công cụ có mặt trong DOM — nên việc
       đánh dấu được hoãn lại một nhịp và lặp lại mỗi lần đổi lựa chọn. */
    function danhDau() {
        keys.forEach(function (k) {
            var b = host.querySelector('[data-' + k + ']');
            if (b && !b.hasAttribute('data-canchon')) {
                b.setAttribute('data-canchon', '1');
                b.disabled = true;
            }
        });
    }
    setTimeout(danhDau, 0);
    return function (r) {
        danhDau();
        keys.forEach(function (k) {
            var b = host.querySelector('[data-' + k + ']');
            if (b) b.disabled = !r;
        });
        if (them) them(r);
    };
};

/**
 * TÍCH CHỌN MỘT DÒNG CŨNG COI LÀ ĐÃ CHỌN BẢN GHI.
 * Người dùng quen tích ô vuông đầu dòng thay vì bấm vào dòng. Khi chỉ tích đúng
 * một dòng, toàn bộ chức năng trên bản ghi được bật như khi bấm chọn dòng đó.
 */
UI.Grid.prototype.dongDangChon = function () {
    var g = this;
    if (g.selId) { var r = g.byId(g.selId); if (r) return r; }
    var ds = g.daChon();
    return ds.length === 1 ? ds[0] : null;
};
var _baoChonGoc = UI.Grid.prototype.baoChon;
UI.Grid.prototype.baoChon = function () {
    var g = this;
    _baoChonGoc.call(g);
    if (g.o && g.o.onSelect) {
        var ds = g.daChon();
        if (!g.selId && ds.length === 1) g.o.onSelect(ds[0]);
        else if (!g.selId) g.o.onSelect(null);
    }
};
/* Các nút trên thanh công cụ lấy bản ghi theo cùng một quy tắc: dòng đang bấm
   chọn, hoặc dòng duy nhất đang được tích. */
var _selectedGoc = UI.Grid.prototype.selected;
UI.Grid.prototype.selected = function () {
    var r = _selectedGoc.call(this);
    if (r) return r;
    var ds = this.daChon();
    return ds.length === 1 ? ds[0] : null;
};

/** Rà soát nhanh một màn hình — dùng cho kiểm thử tự động và tự kiểm tra. */
W.raSoatToolbar = function (host) {
    host = host || document.getElementById('ws');
    var tb = host.querySelector('.toolbar');
    if (!tb) return { co: false };
    var ds = Array.prototype.slice.call(tb.querySelectorAll('button'));
    return {
        co: true,
        tong: ds.length,
        canChon: ds.filter(function (b) { return b.hasAttribute('data-canchon'); }).length,
        tatKhiChuaChon: ds.filter(function (b) { return b.disabled; })
            .map(function (b) { return (b.textContent || '').trim(); }),
        thieuXuLy: ds.filter(function (b) { return !b.onclick && !b.getAttribute('data-bl'); })
            .map(function (b) { return (b.textContent || '').trim(); })
    };
};

})(window);

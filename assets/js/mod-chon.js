/* ==========================================================================
   BỘ CHỌN MASTER DATA DÙNG CHUNG  (Master Data Picker)
   --------------------------------------------------------------------------
   MỘT bộ chọn duy nhất cho MỌI danh mục nền của phần mềm: Hàng hóa · Khách
   hàng · Nhà cung cấp · Dự án/Công trình · Kho · Nhân viên · Đơn vị phát hành ·
   Chính sách giá · Điều khoản thanh toán · Điều khoản giao hàng · Nhóm hàng ·
   Đơn vị tính · Hãng sản xuất · Thuế suất · Loại hợp đồng · Người ký.

   Mỗi danh mục CHỈ khai một lần trong sổ đăng ký W.MD dưới đây. Thêm một danh
   mục mới = thêm một mục khai báo, KHÔNG phải viết thêm giao diện, KHÔNG sửa
   chương trình ở từng chứng từ.

   Mỗi ô chọn đều có đủ:
     · Dropdown           – bấm là ra danh sách
     · Gõ từ khóa         – tìm ngay theo mọi trường đã khai trong "tim"
     · Auto Complete      – lọc trực tiếp trong lúc gõ
     · Popup chọn         – mở bảng đầy đủ có cột, bộ lọc, phân trang
     · Tạo mới            – nếu người dùng có quyền thêm; lưu xong TỰ QUAY LẠI
                            chứng từ và CHỌN LUÔN bản ghi vừa tạo

   Liên kết toàn hệ thống bằng ID NỘI BỘ. Trường tên chỉ là bản chụp để in.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI;

/* Bộ nhớ khai báo của từng ô chọn đã dựng — dựng bằng W.oMD, nối bằng W.bindMD. */
var DAT = {}, DEM = 0;

function quyen() { return W.Q; }
function conDung(r) {
    return r.trangThai !== 'Ngừng dùng' && r.trangThai !== 'Ngừng kinh doanh' &&
           r.trangThai !== 'Ngừng hợp tác' && r.trangThai !== 'Nghỉ việc';
}
function txt(v) { return v === undefined || v === null ? '' : String(v); }
function ghep(a) { return a.filter(function (x) { return txt(x).trim(); }).join(' · '); }

/* ==========================================================================
   SỔ ĐĂNG KÝ MASTER DATA
   Khai báo của một danh mục:
     ten     – tên hiển thị
     ten1    – tên viết thường dùng trong câu
     coll    – bảng dữ liệu
     mod     – phân hệ để kiểm tra quyền
     icon    – biểu tượng
     nhan(r) – dòng chính hiển thị
     phu(r)  – dòng phụ hiển thị
     tim[]   – các trường được tìm khi gõ từ khóa
     loc[]   – bộ lọc của popup { k, t, w }
     cot(ctx)– cột của popup (mảng cột UI.Grid)
     lay(o)  – nguồn dữ liệu (mặc định DB.all(coll), bỏ bản ghi ngừng dùng)
     formTao – khai báo biểu mẫu Tạo mới đơn giản [{k,t,req,type,opts,rong}]
     taoMoi(o, xong) – biểu mẫu Tạo mới riêng (ưu tiên hơn formTao)
     dungTen – trường dùng làm bản chụp tên trên chứng từ
   ========================================================================== */
var MD = {};

/* ------------------------------------------------------------ HÀNG HÓA */
MD.hangHoa = {
    ten: 'Hàng hóa', ten1: 'hàng hóa', coll: 'hangHoa', mod: 'hangHoa',
    icon: 'bi-box-seam', dungTen: 'ten',
    nhan: function (r) { return r.ten || r.ma; },
    phu: function (r) { return ghep([r.ma, r.model && r.model !== r.ma ? 'Model ' + r.model : '', r.hang, r.nhom, r.thongSo]); },
    tim: ['ma', 'model', 'ten', 'thongSo', 'hang', 'nhom', 'maNoiBo', 'maKhac', 'xuatXu', 'thuongHieu', 'quyCach'],
    loc: [{ k: 'nhom', t: 'Loại thiết bị', w: 190 }, { k: 'hang', t: 'Hãng', w: 170 }],
    cot: function (ctx) { return cotHangHoa(ctx); },
    taoMoi: function (o, xong) { W.themHangHoaNhanh(o, xong); }
};

/* ------------------------------------------------------------ KHÁCH HÀNG */
MD.khachHang = {
    ten: 'Khách hàng', ten1: 'khách hàng', coll: 'khachHang', mod: 'khachHang',
    icon: 'bi-people', dungTen: 'ten',
    nhan: function (r) { return r.ten; },
    phu: function (r) {
        var b = DB.get('bangGiaBan', r.bangGiaId);
        return ghep([r.ma, r.loaiKH, r.mst ? 'MST ' + T.mstHien(r.mst) : '', r.diaChi,
                     b ? b.ten : '']);
    },
    tim: ['ma', 'ten', 'mst', 'diaChi', 'dienThoai', 'email', 'nguoiLienHe', 'daiDien', 'cccd', 'duAn'],
    loc: [{ k: 'loaiKH', t: 'Loại khách hàng', w: 170 }, { k: 'trangThai', t: 'Trạng thái', w: 160 }],
    cot: function () {
        return [
            { k: 'ma', t: 'Mã KH', w: 108, cls: 'mono' },
            { k: 'ten', t: 'Tên khách hàng', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    (r.diaChi ? '<div class="small muted ellip">' + T.esc(r.diaChi) + '</div>' : ''); } },
            { k: 'loaiKH', t: 'Loại', w: 110 },
            { k: 'mst', t: 'MST / CCCD', w: 140, cls: 'mono',
              r: function (v, r) { return T.esc(v ? T.mstHien(v) : (r.cccd || '')); } },
            { k: 'dienThoai', t: 'Điện thoại', w: 120 },
            { k: 'nguoiLienHe', t: 'Người liên hệ', w: 150 }
        ];
    },
    taoMoi: function (o, xong) { W.themKhachHangNhanh(o, xong); }
};

/* ------------------------------------------------------------ NHÀ CUNG CẤP */
MD.nhaCungCap = {
    ten: 'Nhà cung cấp', ten1: 'nhà cung cấp', coll: 'nhaCungCap', mod: 'nhaCungCap',
    icon: 'bi-truck', dungTen: 'ten',
    nhan: function (r) { return r.ten; },
    phu: function (r) { return ghep([r.ma, r.mst ? 'MST ' + r.mst : '', r.diaChi, r.nhomHang]); },
    tim: ['ma', 'ten', 'mst', 'diaChi', 'dienThoai', 'email', 'nguoiLienHe', 'nhomHang'],
    loc: [{ k: 'nhomHang', t: 'Nhóm hàng', w: 190 }, { k: 'trangThai', t: 'Trạng thái', w: 160 }],
    cot: function () {
        return [
            { k: 'ma', t: 'Mã NCC', w: 110, cls: 'mono' },
            { k: 'ten', t: 'Tên nhà cung cấp', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    (r.diaChi ? '<div class="small muted ellip">' + T.esc(r.diaChi) + '</div>' : ''); } },
            { k: 'mst', t: 'Mã số thuế', w: 130, cls: 'mono' },
            { k: 'dienThoai', t: 'Điện thoại', w: 120 },
            { k: 'nhomHang', t: 'Nhóm hàng', w: 170 }
        ];
    },
    formTao: [
        { k: 'ma', t: 'Mã nhà cung cấp', req: true, w: 1 },
        { k: 'ten', t: 'Tên nhà cung cấp', req: true, rong: true },
        { k: 'mst', t: 'Mã số thuế' }, { k: 'dienThoai', t: 'Điện thoại' },
        { k: 'diaChi', t: 'Địa chỉ', rong: true },
        { k: 'nguoiLienHe', t: 'Người liên hệ' }, { k: 'email', t: 'Email' }
    ],
    macDinh: { trangThai: 'Đang hợp tác', nhomHang: '', dieuKhoanTT: '', ghiChu: 'Tạo nhanh từ chứng từ' }
};

/* --------------------------------------------------- DỰ ÁN / CÔNG TRÌNH */
MD.duAn = {
    ten: 'Dự án / Công trình', ten1: 'dự án', coll: 'duAn', mod: 'duAn',
    icon: 'bi-building-fill-gear', dungTen: 'ten',
    nhan: function (r) { return r.ten; },
    phu: function (r) { return ghep([r.ma, r.diaDiem, r.chuDauTu]); },
    tim: ['ma', 'ten', 'diaDiem', 'chuDauTu', 'ghiChu'],
    loc: [],
    cot: function () {
        return [
            { k: 'ma', t: 'Mã dự án', w: 130, cls: 'mono' },
            { k: 'ten', t: 'Tên dự án / công trình' },
            { k: 'diaDiem', t: 'Địa điểm', w: 230 },
            { k: 'chuDauTu', t: 'Chủ đầu tư', w: 210 }
        ];
    },
    formTao: [
        { k: 'ma', t: 'Mã dự án', req: true },
        { k: 'ten', t: 'Tên dự án / công trình', req: true, rong: true },
        { k: 'diaDiem', t: 'Địa điểm', rong: true },
        { k: 'chuDauTu', t: 'Chủ đầu tư', rong: true }
    ],
    macDinh: { ghiChu: 'Tạo nhanh từ chứng từ', trangThai: 'Đang dùng' }
};

/* ------------------------------------------------------------------ KHO */
MD.kho = {
    ten: 'Kho', ten1: 'kho', coll: 'kho', mod: 'kho', icon: 'bi-building', dungTen: 'ten',
    nhan: function (r) { return r.ten; },
    phu: function (r) { return ghep([r.ma, r.diaChi, r.thuKho]); },
    tim: ['ma', 'ten', 'diaChi', 'thuKho'],
    loc: [],
    cot: function () {
        return [{ k: 'ma', t: 'Mã kho', w: 120, cls: 'mono' }, { k: 'ten', t: 'Tên kho' },
                { k: 'diaChi', t: 'Địa chỉ', w: 280 }, { k: 'thuKho', t: 'Thủ kho', w: 170 }];
    },
    formTao: [{ k: 'ma', t: 'Mã kho', req: true }, { k: 'ten', t: 'Tên kho', req: true, rong: true },
              { k: 'diaChi', t: 'Địa chỉ', rong: true }, { k: 'thuKho', t: 'Thủ kho' }]
};

/* -------------------------------------------------------------- NHÂN VIÊN */
MD.nhanVien = {
    ten: 'Nhân viên', ten1: 'nhân viên', coll: 'nhanVien', mod: 'nhanVien',
    icon: 'bi-person-badge', dungTen: 'hoTen',
    nhan: function (r) { return r.hoTen; },
    phu: function (r) { return ghep([r.ma, r.chucVu, r.phongBan, (DB.get('donVi', r.donViId) || {}).ten]); },
    tim: ['ma', 'hoTen', 'chucVu', 'phongBan', 'dienThoai', 'email'],
    loc: [{ k: 'phongBan', t: 'Phòng ban', w: 180 }, { k: 'chucVu', t: 'Chức vụ', w: 180 }],
    cot: function () {
        return [{ k: 'ma', t: 'Mã NV', w: 100, cls: 'mono' }, { k: 'hoTen', t: 'Họ và tên' },
                { k: 'chucVu', t: 'Chức vụ', w: 190 }, { k: 'phongBan', t: 'Phòng ban', w: 180 },
                { k: 'dienThoai', t: 'Điện thoại', w: 130 }];
    },
    formTao: [{ k: 'ma', t: 'Mã nhân viên', req: true }, { k: 'hoTen', t: 'Họ và tên', req: true, rong: true },
              { k: 'chucVu', t: 'Chức vụ' }, { k: 'phongBan', t: 'Phòng ban' },
              { k: 'dienThoai', t: 'Điện thoại' }, { k: 'email', t: 'Email' }],
    macDinh: { trangThai: 'Đang làm việc' }
};

/* ------------------------------------------------------ ĐƠN VỊ PHÁT HÀNH */
MD.donVi = {
    ten: 'Đơn vị phát hành', ten1: 'đơn vị phát hành', coll: 'donVi', mod: 'donVi',
    icon: 'bi-buildings', dungTen: 'ten', khongTao: true,
    nhan: function (r) { return r.ten; },
    phu: function (r) { return ghep([r.ma, r.mst ? 'MST ' + r.mst : '', r.diaChi]); },
    tim: ['ma', 'ten', 'tenTat', 'mst', 'diaChi'],
    loc: [],
    cot: function () {
        return [{ k: 'ma', t: 'Mã', w: 110, cls: 'mono' }, { k: 'ten', t: 'Tên đơn vị' },
                { k: 'mst', t: 'Mã số thuế', w: 130, cls: 'mono' }, { k: 'diaChi', t: 'Địa chỉ', w: 300 }];
    }
};

/* ------------------------------------------------------- CHÍNH SÁCH GIÁ */
MD.chinhSachGia = {
    ten: 'Chính sách giá', ten1: 'chính sách giá', coll: 'bangGiaBan', mod: 'bangGiaBan',
    icon: 'bi-tags', dungTen: 'ten', khongTao: true,
    nhan: function (r) { return r.ten; },
    phu: function (r) { return ghep([r.ma, r.nhaCungCap, r.tuNgay ? 'Từ ' + T.date(r.tuNgay) : '',
                                     (T.cotGiaCua(r) || []).join(' / ')]); },
    tim: ['ma', 'ten', 'nhaCungCap', 'phienBan'],
    loc: [{ k: 'trangThai', t: 'Trạng thái', w: 170 }],
    lay: function () {
        return DB.all('bangGiaBan').filter(function (b) { return b.trangThai === 'Đang áp dụng'; });
    },
    cot: function () {
        return [{ k: 'ma', t: 'Mã bảng giá', w: 150, cls: 'mono' }, { k: 'ten', t: 'Tên bảng giá' },
                { k: 'nhaCungCap', t: 'Nhà cung cấp / Hãng', w: 200 },
                { k: '_c', t: 'Các mức giá', w: 260, sort: false,
                  r: function (v, r) { return T.esc((T.cotGiaCua(r) || []).join(' · ')); } },
                { k: 'tuNgay', t: 'Từ ngày', w: 110, fmt: 'ngay' }];
    }
};

/* ------------------------------------------------ ĐIỀU KHOẢN THANH TOÁN */
MD.dieuKhoanTT = {
    ten: 'Điều khoản thanh toán', ten1: 'điều khoản thanh toán', coll: 'dieuKhoanTT',
    mod: 'dieuKhoanTT', icon: 'bi-file-text', dungTen: 'noiDung',
    nhan: function (r) { return r.ten; },
    phu: function (r) { return ghep([r.ma, r.soNgay ? 'Nợ ' + r.soNgay + ' ngày' : '', r.noiDung]); },
    tim: ['ma', 'ten', 'noiDung'],
    loc: [],
    cot: function () {
        return [{ k: 'ma', t: 'Mã', w: 110, cls: 'mono' }, { k: 'ten', t: 'Tên điều khoản', w: 250 },
                { k: 'soNgay', t: 'Số ngày nợ', w: 110, cls: 'num' },
                { k: 'noiDung', t: 'Nội dung ghi trên chứng từ' }];
    },
    formTao: [{ k: 'ma', t: 'Mã', req: true }, { k: 'ten', t: 'Tên điều khoản', req: true },
              { k: 'soNgay', t: 'Số ngày nợ', type: 'so' },
              { k: 'noiDung', t: 'Nội dung ghi trên chứng từ', req: true, rong: true, dai: true }]
};

/* --------------------------------------------------- ĐIỀU KHOẢN GIAO HÀNG */
MD.dieuKhoanGH = {
    ten: 'Điều khoản giao hàng', ten1: 'điều khoản giao hàng', coll: 'dieuKhoanGH',
    mod: 'dieuKhoanGH', icon: 'bi-truck-front', dungTen: 'noiDung',
    nhan: function (r) { return r.ten; },
    phu: function (r) { return ghep([r.ma, r.soNgay ? 'Giao trong ' + r.soNgay + ' ngày' : '', r.noiDung]); },
    tim: ['ma', 'ten', 'noiDung', 'diaDiem'],
    loc: [],
    cot: function () {
        return [{ k: 'ma', t: 'Mã', w: 110, cls: 'mono' }, { k: 'ten', t: 'Tên điều khoản', w: 250 },
                { k: 'soNgay', t: 'Số ngày giao', w: 120, cls: 'num' },
                { k: 'diaDiem', t: 'Địa điểm giao', w: 200 },
                { k: 'noiDung', t: 'Nội dung ghi trên chứng từ' }];
    },
    formTao: [{ k: 'ma', t: 'Mã', req: true }, { k: 'ten', t: 'Tên điều khoản', req: true },
              { k: 'soNgay', t: 'Số ngày giao', type: 'so' }, { k: 'diaDiem', t: 'Địa điểm giao' },
              { k: 'noiDung', t: 'Nội dung ghi trên chứng từ', req: true, rong: true, dai: true }]
};

/* ------------------------------------------- CÁC DANH MỤC NỀN ĐƠN GIẢN */
MD.nhomHang = {
    ten: 'Nhóm hàng', ten1: 'nhóm hàng', coll: 'nhomHang', mod: 'nhomHang',
    icon: 'bi-diagram-3', dungTen: 'ten',
    nhan: function (r) { return r.ten; }, phu: function (r) { return ghep([r.ma, r.ghiChu]); },
    tim: ['ma', 'ten', 'ghiChu'], loc: [],
    cot: function () { return [{ k: 'ma', t: 'Mã nhóm', w: 130, cls: 'mono' }, { k: 'ten', t: 'Tên nhóm hàng' }, { k: 'ghiChu', t: 'Ghi chú', w: 280 }]; },
    formTao: [{ k: 'ma', t: 'Mã nhóm', req: true }, { k: 'ten', t: 'Tên nhóm hàng', req: true, rong: true }]
};
MD.dvt = {
    ten: 'Đơn vị tính', ten1: 'đơn vị tính', coll: 'dvt', mod: 'dvt',
    icon: 'bi-rulers', dungTen: 'ma', khoaTen: 'ma',
    nhan: function (r) { return r.ma; }, phu: function (r) { return r.ten || ''; },
    tim: ['ma', 'ten'], loc: [],
    cot: function () { return [{ k: 'ma', t: 'Ký hiệu', w: 130, cls: 'mono' }, { k: 'ten', t: 'Tên đầy đủ' }]; },
    formTao: [{ k: 'ma', t: 'Ký hiệu', req: true }, { k: 'ten', t: 'Tên đầy đủ', req: true, rong: true }]
};
MD.hangSX = {
    ten: 'Hãng sản xuất', ten1: 'hãng sản xuất', coll: 'hangSX', mod: 'hangSX',
    icon: 'bi-award', dungTen: 'ten',
    nhan: function (r) { return r.ten; }, phu: function (r) { return ghep([r.ma, r.xuatXu]); },
    tim: ['ma', 'ten', 'xuatXu'], loc: [],
    cot: function () { return [{ k: 'ma', t: 'Mã hãng', w: 130, cls: 'mono' }, { k: 'ten', t: 'Tên hãng' }, { k: 'xuatXu', t: 'Xuất xứ', w: 180 }]; },
    formTao: [{ k: 'ma', t: 'Mã hãng', req: true }, { k: 'ten', t: 'Tên hãng sản xuất', req: true, rong: true }, { k: 'xuatXu', t: 'Xuất xứ' }]
};
MD.loaiHopDong = {
    ten: 'Loại hợp đồng', ten1: 'loại hợp đồng', coll: 'loaiHopDong', mod: 'loaiHopDong',
    icon: 'bi-file-earmark-ruled', dungTen: 'ten', khongTao: true,
    nhan: function (r) { return r.ten; }, phu: function (r) { return ghep([r.ma, r.tienTo, r.moTa]); },
    tim: ['ma', 'ten', 'tienTo', 'moTa'], loc: [],
    cot: function () { return [{ k: 'ma', t: 'Mã', w: 120, cls: 'mono' }, { k: 'ten', t: 'Tên loại hợp đồng' }, { k: 'tienTo', t: 'Tiền tố số HĐ', w: 140, cls: 'mono' }]; }
};
MD.khoanMucChi = {
    ten: 'Khoản mục chi', ten1: 'khoản mục chi', coll: 'khoanMucChi', mod: 'khoanMucChi',
    icon: 'bi-list-columns-reverse', dungTen: 'ten', khoaTen: 'ten',
    nhan: function (r) { return r.ten; },
    phu: function (r) {
        return ghep([r.ma, r.vaoChiPhi === false ? 'không tính vào chi phí' : 'tính vào chi phí',
                     r.giamCongNo ? 'giảm công nợ phải trả' : '']);
    },
    tim: ['ma', 'ten', 'moTa'], loc: [],
    /* Gõ một cái tên chưa có là tạo được ngay tại chỗ. Mặc định an toàn: khoản
       mục mới LÀ chi phí và KHÔNG giảm công nợ — người dùng sửa lại trong Danh
       mục Khoản mục chi nếu đó là khoản trả tiền hàng. */
    formTao: [{ k: 'ten', t: 'Tên khoản mục chi', req: true, rong: true },
              { k: 'ma', t: 'Mã khoản mục' },
              { k: 'moTa', t: 'Diễn giải', rong: true }],
    macDinh: { vaoChiPhi: true, giamCongNo: false, trangThai: 'Đang dùng',
               ghiChu: 'Tạo nhanh từ phiếu chi' },
    cot: function () {
        return [{ k: 'ma', t: 'Mã', w: 120, cls: 'mono' },
                { k: 'ten', t: 'Tên khoản mục chi' },
                { k: 'vaoChiPhi', t: 'Tính vào chi phí', w: 150,
                  r: function (v) { return T.pill(v === false ? 'Không' : 'Có'); } },
                { k: 'giamCongNo', t: 'Giảm công nợ phải trả', w: 180,
                  r: function (v) { return T.pill(v ? 'Có' : 'Không'); } }];
    }
};
MD.nguoiKy = {
    ten: 'Người ký', ten1: 'người ký', coll: 'nguoiKy', mod: 'nguoiKy',
    icon: 'bi-pen', dungTen: 'hoTen',
    nhan: function (r) { return r.hoTen; },
    phu: function (r) { return ghep([r.chucVu, (DB.get('donVi', r.donViId) || {}).ten, r.viTri]); },
    tim: ['hoTen', 'chucVu', 'viTri'], loc: [{ k: 'viTri', t: 'Vị trí ký', w: 180 }],
    cot: function () { return [{ k: 'hoTen', t: 'Họ và tên', w: 220 }, { k: 'chucVu', t: 'Chức vụ', w: 200 }, { k: 'viTri', t: 'Vị trí ký', w: 200 }]; }
};
W.MD = MD;

/* ==========================================================================
   CỘT CỦA POPUP CHỌN HÀNG HÓA
   Hiện đủ: Mã hàng · Model · Tên hàng · ĐVT · Tồn kho · và TOÀN BỘ mức giá của
   bảng giá đang áp dụng (Giá PP · Giá Đại lý · Giá Bán lẻ · Giá Dự án · Giá Đặc
   biệt … — lấy thẳng từ dữ liệu bảng giá, KHÔNG cắm cứng tên cột trong mã).
   ========================================================================== */
function bangGiaCtx(ctx) {
    ctx = ctx || {};
    var b = ctx.bangGiaId ? DB.get('bangGiaBan', ctx.bangGiaId) : null;
    /* MỘT NGUỒN CHỌN BẢNG GIÁ DUY NHẤT — Engine trả lời, màn hình không tự lọc.
       Bảng giá do đơn vị nguồn xây dựng và dùng chung nên mọi đơn vị phát hành
       đều nhìn thấy cùng một tập phiên bản. */
    if (!b) b = T.bangGiaMacDinh(ctx.donViId || (DB.data._meta || {}).ctyId,
                                 ctx.mucGia || '', ctx.ngay || T.today());
    return b;
}
function cotHangHoa(ctx) {
    ctx = ctx || {};
    var giaMua = !!ctx.giaMua;
    var b = bangGiaCtx(ctx);
    var mucs = b ? T.cotGiaCua(b) : [];
    var cotAp = ctx.cotGia || '';
    var c = [
        { k: 'ma', t: 'Mã hàng', w: 130, cls: 'mono' },
        { k: 'model', t: 'Model', w: 128, cls: 'mono',
          r: function (v, r) { return T.esc(v || r.ma || ''); } },
        { k: 'ten', t: 'Tên hàng hóa', r: function (v, r) {
            return '<span class="ellip">' + T.esc(v) + '</span>' +
                (r.thongSo || r.hang
                    ? '<div class="small muted ellip">' + T.esc(ghep([r.hang, r.thongSo])) + '</div>' : ''); } },
        { k: 'dvt', t: 'ĐVT', w: 58, cls: 'ctr' },
        { k: 'ton', t: 'Tồn kho', w: 84, cls: 'num', fmt: 'num' }
    ];
    if (giaMua) {
        c.push({ k: '_gv', t: 'Giá vốn BQ', w: 140, cls: 'num', sort: false,
                 r: function (v, r) { var g = T.giaVonBQ(r); return g ? '<b>' + T.money(g) + '</b>' : '<span class="pill y">chưa có</span>'; } });
        return c;
    }
    if (!mucs.length) {
        c.push({ k: '_g', t: 'Đơn giá', w: 150, cls: 'num', sort: false,
                 r: function () { return '<span class="pill y">chưa có bảng giá</span>'; } });
        return c;
    }
    mucs.forEach(function (m) {
        c.push({
            k: '_g_' + T.kd(m).replace(/[^a-z0-9]+/g, '_'), t: m,
            w: Math.max(110, Math.min(150, 34 + m.length * 8)), cls: 'num', sort: false,
            r: function (v, r) {
                var g = T.giaTheoCot(b, r, m);
                if (!g) return '<span class="muted">—</span>';
                return (cotAp && m === cotAp) ? '<b class="ok-t">' + T.money(g) + '</b>' : T.money(g);
            }
        });
    });
    return c;
}
W.cotChonHangHoa = cotHangHoa;
W.bangGiaChonHang = bangGiaCtx;

/* ==========================================================================
   TRUY VẤN DANH MỤC
   ========================================================================== */
function cau(key) { return MD[key] || null; }
W.mdCau = cau;

/** Toàn bộ bản ghi dùng được của một danh mục. */
W.mdDS = function (key, o) {
    var c = cau(key); if (!c) return [];
    o = o || {};
    var ds = c.lay ? c.lay(o) : DB.all(c.coll).filter(conDung);
    if (o.loc) ds = ds.filter(o.loc);
    return ds;
};
W.mdNhan = function (key, r) { var c = cau(key); return c && r ? txt(c.nhan(r)) : ''; };
W.mdPhu = function (key, r) { var c = cau(key); return c && r ? txt(c.phu(r)) : ''; };

/** Danh sách cho combo. */
W.mdItems = function (key, o) {
    var c = cau(key); if (!c) return [];
    return W.mdDS(key, o).map(function (r) {
        return { v: r.id, t: txt(c.nhan(r)), s: txt(c.phu(r)) };
    });
};

/**
 * TÌM BẢN GHI THEO TỪ KHÓA — dùng chung cho combo, popup và ô Mã hàng.
 * Tìm trên mọi trường đã khai trong "tim", không phân biệt hoa thường và dấu.
 */
W.mdTim = function (key, tuKhoa, o) {
    var c = cau(key); if (!c) return [];
    var k = T.kd(txt(tuKhoa));
    var ds = W.mdDS(key, o);
    if (!k) return ds;
    return ds.filter(function (r) {
        for (var i = 0; i < c.tim.length; i++)
            if (T.kd(txt(r[c.tim[i]])).indexOf(k) >= 0) return true;
        return false;
    });
};

/**
 * KHỚP TÊN CŨ SANG ID NỘI BỘ.
 * Chứng từ đời cũ lưu tên dạng chữ; mở lại thì tự nối về đúng bản ghi danh mục
 * mà KHÔNG sửa dữ liệu cũ — chỉ dùng để hiển thị và để lần sau lưu bằng ID.
 */
W.mdTheoTen = function (key, ten) {
    var c = cau(key); if (!c || !txt(ten).trim()) return null;
    var k = T.kd(ten);
    var ds = c.lay ? c.lay({}) : DB.all(c.coll);
    var t = ds.filter(function (r) { return T.kd(c.nhan(r)) === k; });
    return t[0] || null;
};

/* ==========================================================================
   POPUP CHỌN — bảng đầy đủ, có cột, bộ lọc, tìm kiếm, phân trang
   o: { nhieu, tim, ctx, tieu, sub, daChon, onChon(rows|row), taoMoi }
   ========================================================================== */
W.popupMD = function (key, o) {
    var c = cau(key);
    if (!c) return UI.toast('err', 'Chưa khai báo danh mục', key);
    o = o || {};
    if (!quyen().co(c.mod, 'xem')) return UI.thieuQuyen(c.mod, 'xem');
    var nhieu = !!o.nhieu, chon = {}, g = null;
    (o.daChon || []).forEach(function (id) { chon[id] = true; });
    var coTao = !o.khongTao && !c.khongTao && quyen().co(c.mod, 'them') && (c.taoMoi || c.formTao);

    function rows() { return W.mdDS(key, o); }
    function locs() {
        var ds = rows();
        return (c.loc || []).map(function (f) {
            return { k: f.k, t: f.t, w: f.w || 180,
                     opts: Array.from(new Set(ds.map(function (x) { return x[f.k]; }).filter(Boolean))).sort() };
        });
    }
    var cot = (typeof c.cot === 'function' ? c.cot(o.ctx || {}) : (c.cot || [])).slice();
    if (nhieu) cot.unshift({ k: '_c', t: '', w: 36, sort: false, cls: 'ctr',
        r: function (v, r) { return '<input type="checkbox" data-act="chon"' + (chon[r.id] ? ' checked' : '') + '>'; } });

    var nut = [{ text: 'Hủy', click: function (h) { h.close(); } }];
    if (nhieu) nut.push({ text: o.nhanOK || 'Đưa vào chứng từ', cls: 'primary', icon: 'bi-box-arrow-in-down',
        click: function (h) {
            var ds = Object.keys(chon).filter(function (id) { return chon[id]; })
                        .map(function (id) { return DB.get(c.coll, id); }).filter(Boolean);
            if (!ds.length) return UI.toast('warn', 'Chưa chọn ' + c.ten1 + ' nào');
            h.close(); if (o.onChon) o.onChon(ds);
        } });

    UI.modal({
        size: o.size || 'xl',
        title: o.tieu || ('Chọn ' + c.ten1),
        sub: o.sub || ('Gõ từ khóa để tìm theo ' + (c.tim || []).slice(0, 5).join(' · ') +
                       ' — bấm vào dòng để chọn'),
        body: (coTao ? '<div class="row mb8"><button type="button" class="btn sm primary" id="mdTao">' +
               '<i class="bi bi-plus-lg"></i> Tạo mới ' + T.esc(c.ten1) + '</button>' +
               '<span class="small muted">Chưa có trong danh mục thì tạo ngay tại đây, lưu xong dùng được luôn</span></div>' : '') +
              '<div id="mdGrid"></div>',
        buttons: nut,
        onOpen: function (h) {
            if (coTao) h.q('#mdTao').onclick = function () {
                W.taoMoiMD(key, { tuKhoa: g ? g.q : '' }, function (r) {
                    if (nhieu) { chon[r.id] = true; if (g) g.reload(rows()); }
                    else { h.close(); if (o.onChon) o.onChon(r); }
                });
            };
            g = new UI.Grid({
                mount: h.q('#mdGrid'), rows: rows(), pageSize: o.pageSize || 15, toolbar: false,
                height: o.height || '340px', search: c.tim, filters: locs(), cols: cot,
                onAction: nhieu ? function (a, r, b) { chon[r.id] = b.checked; } : null,
                /* Chọn một bản ghi: bấm vào dòng là chọn xong và quay lại ngay
                   nơi gọi — không bắt bấm thêm nút xác nhận. */
                onSelect: nhieu ? null : function (r) { if (!r) return; h.close(); if (o.onChon) o.onChon(r); },
                onOpen: nhieu ? null : function (r) { if (!r) return; h.close(); if (o.onChon) o.onChon(r); }
            });
            if (o.tim) { g.q = o.tim; g.reload(rows()); }
        }
    });
};

/* ==========================================================================
   TẠO MỚI NGAY TRONG CHỨNG TỪ
   Lưu xong TỰ QUAY LẠI nơi gọi và chọn luôn bản ghi vừa tạo.
   ========================================================================== */
W.taoMoiMD = function (key, o, xong) {
    var c = cau(key);
    if (!c) return;
    o = o || {};
    if (c.khongTao) return UI.toast('warn', 'Không tạo ' + c.ten1 + ' từ chứng từ',
        'Danh mục này chỉ khai báo trong màn hình quản trị.');
    if (!quyen().co(c.mod, 'them')) return UI.thieuQuyen(c.mod, 'them');
    if (c.taoMoi) return c.taoMoi(o, xong);
    if (!c.formTao) return;

    var f = c.formTao;
    var goi = txt(o.tuKhoa).trim();
    UI.modal({
        size: 'lg', title: 'Thêm nhanh ' + c.ten1,
        sub: 'Lưu xong có ngay trong Danh mục ' + c.ten + ' — không phải thoát chứng từ',
        body: '<div class="grid2">' + f.map(function (x) {
            var gt = (x.k === 'ten' || x.k === 'hoTen' || x.k === 'noiDung') && goi ? goi : '';
            return '<div class="fld' + (x.req ? ' req' : '') + (x.rong ? ' span2' : '') + '"' +
                (x.rong ? ' style="grid-column:span 2"' : '') + '><label>' + T.esc(x.t) + '</label>' +
                (x.dai ? '<textarea data-f="' + x.k + '" rows="2">' + T.esc(gt) + '</textarea>'
                       : '<input data-f="' + x.k + '"' + (x.type === 'so' ? ' class="sl"' : '') +
                         ' value="' + T.esc(gt) + '">') + '</div>';
        }).join('') + '</div>',
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } },
            { text: 'Lưu và chọn luôn', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                if (!UI.validate(h.el, f.filter(function (x) { return x.req; })
                        .map(function (x) { return { k: x.k }; }))) return;
                var v = UI.read(h.el), rec = {};
                Object.keys(c.macDinh || {}).forEach(function (k) { rec[k] = c.macDinh[k]; });
                f.forEach(function (x) { rec[x.k] = x.type === 'so' ? T.so(v[x.k]) : txt(v[x.k]).trim(); });
                var khoa = c.khoaTen || 'ma';
                if (rec[khoa] && DB.all(c.coll).some(function (r) { return T.kd(r[khoa]) === T.kd(rec[khoa]); }))
                    return UI.toast('err', 'Trùng mã', rec[khoa] + ' đã có trong danh mục ' + c.ten + '.');
                var r = DB.insert(c.coll, rec);
                h.close();
                UI.toast('ok', 'Đã thêm ' + c.ten1, txt(c.nhan(r)));
                if (xong) xong(r);
            } }
        ]
    });
};

/* ==========================================================================
   Ô CHỌN MASTER DATA TRÊN BIỂU MẪU
   W.oMD(key, o) dựng HTML — W.bindMD(root, ctx) nối toàn bộ ô trong một vùng.
   o: { f: trường lưu ID, fTen: trường lưu bản chụp tên, nhan, gt, gtTen,
        rong, req, ro, tim, ctx, phu(r), onChon(r), khongTao, tuDo }
   tuDo = true: cho phép giữ nguyên chữ tự gõ khi danh mục chưa có bản ghi.
   ========================================================================== */
W.oMD = function (key, o) {
    var c = cau(key); if (!c) return '';
    o = o || {};
    var id = 'md' + (++DEM);
    DAT[id] = { key: key, o: o };
    var f = o.f || (key + 'Id'), fTen = o.fTen || '';
    var gt = txt(o.gt), gtTen = txt(o.gtTen);
    if (!gt && gtTen) { var r0 = W.mdTheoTen(key, gtTen); if (r0) gt = r0.id; }
    var coTao = !o.khongTao && !c.khongTao && !o.ro && quyen().co(c.mod, 'them') && (c.taoMoi || c.formTao);
    return '<div class="fld' + (o.req ? ' req' : '') + (o.rong ? ' span2' : '') + '"' +
        (o.rong ? ' style="grid-column:span 2"' : '') + ' data-mdfld="' + id + '">' +
        '<label>' + T.esc(o.nhan || c.ten) +
        (coTao ? '<button type="button" class="lnk-nut" data-mdtao title="Tạo mới ' + T.esc(c.ten1) + ' ngay tại đây">' +
                 '<i class="bi bi-plus-circle-fill"></i> Tạo mới</button>' : '') +
        '</label>' +
        '<div class="combo" data-mdcb="' + id + '" data-md="' + key + '" data-fk="' + f + '" data-val="' + T.esc(gt) + '"></div>' +
        '<input type="hidden" data-f="' + f + '" value="' + T.esc(gt) + '">' +
        (fTen ? '<input type="hidden" data-f="' + fTen + '" value="' + T.esc(gtTen) + '">' : '') +
        '</div>';
};

/**
 * TÌM HOẶC TẠO NHANH MỘT BẢN GHI DANH MỤC CHỈ TỪ CÁI TÊN — không hộp thoại.
 * Dùng khi người dùng gõ thẳng một tên chưa có vào ô chọn rồi bấm Lưu, và khi
 * nhập tệp Excel: Business Engine tự tạo, KHÔNG hỏi, KHÔNG bắt khai trước.
 * Trả về bản ghi (cũ hoặc mới), null nếu tên rỗng hoặc không đủ quyền.
 */
W.taoNhanhMD = function (key, ten, them) {
    var c = cau(key); if (!c) return null;
    ten = txt(ten).trim(); if (!ten) return null;
    var cu = W.mdTheoTen(key, ten);
    if (cu) return cu;
    if (!quyen().co(c.mod, 'them')) return null;
    var rec = {};
    Object.keys(c.macDinh || {}).forEach(function (k) { rec[k] = c.macDinh[k]; });
    Object.keys(them || {}).forEach(function (k) { rec[k] = them[k]; });
    rec[c.dungTen || 'ten'] = ten;
    /* MÃ DO HỆ THỐNG SINH. Người dùng chỉ gõ cái tên; danh mục nào có cột mã thì
       phần mềm tự cấp mã kế tiếp — không bắt nhớ, không bắt tự đặt. */
    var coMa = !!c.macDinh && c.macDinh.ma !== undefined;
    if (!coMa) coMa = DB.all(c.coll).some(function (r) { return !!r.ma; });
    if (!coMa) coMa = (c.khoaTen || 'ma') === 'ma';
    if (coMa && !rec.ma) rec.ma = W.maNhanhMD(c.coll, key);
    if (!rec.trangThai) rec.trangThai = 'Đang dùng';
    return DB.insert(c.coll, rec);
};

/** Sinh mã kế tiếp cho một danh mục nền theo tiền tố của chính danh mục đó. */
W.maNhanhMD = function (coll, key) {
    var tienTo = { khoanMucChi: 'CP', duAn: 'DA', nhaCungCap: 'NCC', khachHang: 'KH',
                   nhomHang: 'NH', hangSX: 'HSX', kho: 'K', nhanVien: 'NV' }[key] ||
                 String(key || coll).substr(0, 2).toUpperCase();
    var max = 0;
    DB.all(coll).forEach(function (r) {
        var m = String(r.ma || '').match(new RegExp('^' + tienTo + '(\\d+)$', 'i'));
        if (m) max = Math.max(max, Number(m[1]) || 0);
    });
    var n = max + 1;
    return tienTo + (n < 100 ? ('0' + n).slice(-2) : String(n));
};

/** Nối tất cả ô chọn Master Data trong một vùng. Gọi một lần sau khi dựng form. */
W.bindMD = function (root, ctx) {
    var api = {};
    root.querySelectorAll('[data-mdfld]').forEach(function (fld) {
        var id = fld.getAttribute('data-mdfld');
        var d = DAT[id]; if (!d) return;
        api[id] = noiMotO(fld, d.key, d.o, ctx || {});
        api[d.o.f || (d.key + 'Id')] = api[id];
        if (d.o.fTen) api[d.o.fTen] = api[id];
    });
    return api;
};

/**
 * ĐẶT GIÁ TRỊ CHO MỘT Ô CHỌN THEO TÊN.
 * Dùng khi một ô tự điền theo ô khác (ví dụ chọn khách hàng thì điền sẵn dự án
 * đã khai trong hồ sơ khách). Khớp được tên thì chọn đúng bản ghi, không khớp
 * thì giữ nguyên chữ để người dùng tự chọn.
 */
W.mdDatTheoTen = function (api, truong, ten) {
    var o = api && api[truong];
    if (!o || !txt(ten).trim()) return false;
    if (o.get()) return false;                       // đã có giá trị thì không ghi đè
    var r = o.timTen(ten);
    if (!r) return false;
    o.set(r.id);
    return true;
};

function noiMotO(fld, key, o, ctx) {
    var c = cau(key);
    var host = fld.querySelector('[data-mdcb]');
    var hid = fld.querySelector('input[type=hidden][data-f]');
    var hidTen = o.fTen ? fld.querySelector('input[data-f="' + o.fTen + '"]') : null;
    var cb = null;

    function items() { return W.mdItems(key, { loc: o.loc }); }
    /* Ghi ra biểu mẫu: ID nội bộ vào trường liên kết, BẢN CHỤP TÊN vào trường
       văn bản để in lại đúng như lúc phát hành. */
    function ghiRa(v) {
        var r = v ? DB.get(c.coll, v) : null;
        host.setAttribute('data-val', v || '');
        if (hid) hid.value = v || '';
        if (hidTen) {
            if (r) hidTen.value = txt(o.layTen ? o.layTen(r) : (c.dungTen ? r[c.dungTen] : c.nhan(r)));
            else if (!o.tuDo) hidTen.value = '';
        }
        if (o.onChon) o.onChon(r, v);
    }
    cb = UI.combo(host, {
        items: items(), value: host.getAttribute('data-val') || '',
        placeholder: o.trong || ('— Chọn ' + c.ten1 + ' —'),
        onChange: function (v) { ghiRa(v); },
        hanhDong: o.ro ? [] : nutHanhDong()
    });
    function nutHanhDong() {
        var ds = [{ nhan: 'Mở danh sách đầy đủ', icon: 'bi-card-checklist', click: function (a, tuKhoa) {
            W.popupMD(key, {
                tim: tuKhoa || '', ctx: typeof ctx === 'function' ? ctx() : ctx,
                onChon: function (r) { cb.set(r.id); }
            });
        } }];
        if (!o.khongTao && !c.khongTao && quyen().co(c.mod, 'them') && (c.taoMoi || c.formTao))
            ds.push({ nhan: 'Tạo mới ' + c.ten1, icon: 'bi-plus-circle', click: function (a, tuKhoa) {
                W.taoMoiMD(key, { tuKhoa: tuKhoa }, function (r) { cb.nap(items()); cb.set(r.id); });
            } });
        return ds;
    }
    var nutTao = fld.querySelector('[data-mdtao]');
    if (nutTao) nutTao.onclick = function () {
        W.taoMoiMD(key, {}, function (r) { cb.nap(items()); cb.set(r.id); });
    };
    if (o.ro) host.style.pointerEvents = 'none';

    return {
        combo: cb,
        get: function () { return cb.get(); },
        rec: function () { return cb.get() ? DB.get(c.coll, cb.get()) : null; },
        set: function (v, baoDoi) { cb.set(v, baoDoi); if (baoDoi === false) ghiRa(v); },
        napLai: function () { cb.nap(items()); },
        timTen: function (ten) { return W.mdTheoTen(key, ten); }
    };
}

/* ==========================================================================
   Ô TẢI ẢNH LÊN TVERP  (logo · chữ ký · con dấu)
   --------------------------------------------------------------------------
   Ảnh được TẢI THẲNG VÀO TVERP và lưu trong kho dữ liệu dưới dạng dữ liệu ảnh.
   KHÔNG dùng đường dẫn Internet, KHÔNG dùng đường dẫn tệp trên máy — nhờ vậy
   bản in, Word, Excel và PDF luôn lấy ảnh từ chính dữ liệu của phần mềm.
   Có đủ: Tải lên · Xem trước · Thay ảnh · Xóa ảnh.
   ========================================================================== */
var CO_ANH = 1.6 * 1024 * 1024;      // ~1,6 MB mỗi ảnh — đủ cho logo và con dấu

W.oAnhTai = function (o) {
    o = o || {};
    var id = 'anh' + (++DEM);
    var gt = txt(o.gt);
    return '<div class="fld' + (o.rong ? ' span2' : '') + '"' + (o.rong ? ' style="grid-column:span 2"' : '') +
        ' data-anhfld="' + id + '"><label>' + T.esc(o.nhan || 'Ảnh') + '</label>' +
        '<div class="anh-o">' +
        '<div class="anh-xem" data-anhxem>' +
            (gt ? '<img src="' + T.esc(gt) + '" alt="">'
                : '<span class="muted small">Chưa có ảnh</span>') + '</div>' +
        '<div class="anh-nut">' +
            '<button type="button" class="btn sm" data-anhtai><i class="bi bi-upload"></i> ' +
                (gt ? 'Thay ảnh' : 'Tải ảnh lên') + '</button>' +
            '<button type="button" class="btn sm danger" data-anhxoa' + (gt ? '' : ' disabled') + '>' +
                '<i class="bi bi-trash"></i> Xóa ảnh</button>' +
            '<div class="small muted">' + T.esc(o.mo || 'Ảnh PNG / JPG, tối đa 1,6 MB — lưu trong TVERP') + '</div>' +
        '</div>' +
        '<input type="file" accept="image/*" hidden data-anhtep>' +
        '<input type="hidden" data-f="' + T.esc(o.f) + '" value="' + T.esc(gt) + '">' +
        '</div></div>';
};

/** Nối toàn bộ ô tải ảnh trong một vùng. */
W.bindAnhTai = function (root) {
    root.querySelectorAll('[data-anhfld]').forEach(function (fld) {
        var xem = fld.querySelector('[data-anhxem]');
        var tep = fld.querySelector('[data-anhtep]');
        var hid = fld.querySelector('input[type=hidden][data-f]');
        var nTai = fld.querySelector('[data-anhtai]');
        var nXoa = fld.querySelector('[data-anhxoa]');
        function ve(v) {
            hid.value = v || '';
            xem.innerHTML = v ? '<img src="' + T.esc(v) + '" alt="">'
                              : '<span class="muted small">Chưa có ảnh</span>';
            nTai.innerHTML = '<i class="bi bi-upload"></i> ' + (v ? 'Thay ảnh' : 'Tải ảnh lên');
            nXoa.disabled = !v;
        }
        nTai.onclick = function () { tep.value = ''; tep.click(); };
        nXoa.onclick = function () { ve(''); UI.toast('ok', 'Đã xóa ảnh'); };
        tep.onchange = function () {
            var f = tep.files && tep.files[0];
            if (!f) return;
            if (!/^image\//i.test(f.type))
                return UI.toast('err', 'Tệp không phải ảnh', 'Chọn tệp ảnh PNG, JPG hoặc SVG.');
            if (f.size > CO_ANH)
                return UI.toast('err', 'Ảnh quá lớn',
                    'Ảnh ' + (f.size / 1048576).toFixed(1) + ' MB — hãy dùng ảnh dưới 1,6 MB.');
            var fr = new FileReader();
            fr.onload = function (e) { ve(String(e.target.result)); UI.toast('ok', 'Đã tải ảnh lên TVERP', f.name); };
            fr.onerror = function () { UI.toast('err', 'Không đọc được tệp ảnh'); };
            fr.readAsDataURL(f);
        };
    });
};

})(window);

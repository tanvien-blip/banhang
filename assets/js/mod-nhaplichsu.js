/* ==========================================================================
   TVERP — NHẬP DỮ LIỆU LỊCH SỬ TỪ EXCEL
   Doanh nghiệp đã quản lý bằng Excel nhiều năm. Màn hình này nạp lại toàn bộ
   dữ liệu quá khứ rồi TÍNH LẠI giá vốn bình quân để bảo đảm tính liên tục.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;

/* Định nghĩa từng loại dữ liệu lịch sử nhập được — bảng mở, thêm loại mới rất dễ */
var LOAI = [
    {
        k: 'tonDau', t: 'Tồn kho & giá vốn đầu kỳ', i: 'bi-boxes',
        mo: 'Số lượng tồn và giá vốn tại thời điểm bắt đầu dùng phần mềm. Nạp vào dưới dạng một lô "Tồn đầu kỳ".',
        cols: [{ t: 'Mã hàng', k: 'ma' }, { t: 'Tên hàng hóa', k: 'ten' }, { t: 'ĐVT', k: 'dvt' },
               { t: 'Số lượng tồn', k: 'ton' }, { t: 'Giá vốn đơn vị', k: 'giaVon' }, { t: 'Ngày chốt', k: 'ngay' }],
        nap: function (rows, opts) {
            var ngay = opts.ngay || T.today(), lines = [], moi = 0;
            rows.forEach(function (r) {
                var ma = String(r['Mã hàng'] || '').trim();
                var ten = String(r['Tên hàng hóa'] || '').trim();
                if (!ma && !ten) return;
                /* Nhận diện bằng bộ dùng chung: cột "Mã hàng" của tệp lịch sử là
                   MODEL của nhà sản xuất hoặc mã cũ của doanh nghiệp. */
                var hh = T.nhanDienHangHoa({ ma: ma, model: ma, ten: ten }).hh;
                if (!hh && opts.taoMoi) {
                    /* CỬA DUY NHẤT — Danh mục Hàng hóa sinh Mã hàng nội bộ. */
                    hh = T.taoHangHoa({ model: ma || ten, ten: ten || ma,
                        dvt: r['ĐVT'] || 'Cái', nhom: 'Thiết bị khác',
                        ghiChu: 'Nhập từ dữ liệu lịch sử' });
                    if (hh) moi++;
                }
                if (!hh) return;
                var sl = Number(r['Số lượng tồn']) || 0, gv = Number(r['Giá vốn đơn vị']) || 0;
                lines.push({ hangHoaId: hh.id, maHang: hh.ma, tenHang: hh.ten, dvt: hh.dvt, soLuong: sl, donGia: gv,
                    tienHang: Math.round(sl * gv), chiPhiPhanBo: 0, giaVonLo: gv, ghiChu: '' });
            });
            if (!lines.length) return { n: 0, mo: 'Không có dòng hợp lệ' };
            var lo = {
                so: DB.soMoi('NK'), ngay: ngay, loai: 'Tồn đầu kỳ',
                nhaCungCapId: '', nhaCungCap: '(dữ liệu lịch sử)',
                khoId: (T.khoChinh() || {}).id, soHoaDon: '', ngoaiTe: 'VND', tyGia: 1,
                nguoiLapId: (Q.nhanVienCuaToi() || {}).id || '', nguoiLap: (Q.nhanVienCuaToi() || {}).hoTen || '',
                cachPhanBo: 'giaTri', lines: lines, chiPhi: [],
                tongTienHang: T.sum(lines, function (l) { return l.tienHang; }),
                tongChiPhi: 0, tongVatNK: 0,
                tongGiaVon: T.sum(lines, function (l) { return l.tienHang; }),
                daPhanBo: true, trangThai: 'Chờ nhập kho',
                ghiChu: 'Nạp từ dữ liệu lịch sử Excel'
            };
            /* Lô nạp từ lịch sử vẫn phải đi qua ĐÚNG MỘT CỬA nhập kho như mọi lô
               khác. Ghi thẳng trạng thái "Tồn đầu kỳ" mà không sinh phiếu nhập
               là tạo ra tồn kho không có chứng từ đứng sau: đối chiếu báo lô mồ
               côi, và "Tính lại giá vốn" — vốn chạy lại theo phiếu nhập — sẽ xóa
               sạch phần tồn vừa nạp. */
            var pnTD = T.nhapKho(DB.insert('loNhap', lo));
            if (!pnTD) return { n: 0, mo: 'Không nhập kho được lô tồn đầu kỳ ' + lo.so };
            return { n: lines.length, mo: 'Đã nhập kho lô tồn đầu kỳ ' + lo.so + ' — phiếu ' + pnTD.so +
                     (moi ? ' · thêm mới ' + moi + ' mã hàng' : '') };
        }
    },
    {
        k: 'loNhap', t: 'Lịch sử nhập hàng theo lô', i: 'bi-box-arrow-in-down',
        mo: 'Mỗi dòng là một mã hàng trong một lô. Các dòng cùng "Số lô" được gom thành một lô nhập.',
        cols: [{ t: 'Số lô', k: 'so' }, { t: 'Ngày nhập', k: 'ngay' }, { t: 'Nhà cung cấp', k: 'ncc' },
               { t: 'Mã hàng', k: 'ma' }, { t: 'Số lượng', k: 'sl' }, { t: 'Đơn giá mua', k: 'gia' },
               { t: 'Chi phí phân bổ', k: 'cp' }],
        nap: function (rows) {
            var nhom = {}, n = 0, daNhap = 0;
            rows.forEach(function (r) {
                var so = String(r['Số lô'] || '').trim();
                var ma = String(r['Mã hàng'] || '').trim();
                if (!so || !ma) return;
                var hh = T.hh(ma);
                if (!hh) return;
                if (!nhom[so]) nhom[so] = { ngay: String(r['Ngày nhập'] || T.today()).substr(0, 10),
                    ncc: r['Nhà cung cấp'] || '', lines: [] };
                var sl = Number(r['Số lượng']) || 0, gia = Number(r['Đơn giá mua']) || 0;
                var cp = Number(r['Chi phí phân bổ']) || 0;
                nhom[so].lines.push({ hangHoaId: hh.id, maHang: hh.ma || ma, tenHang: hh.ten, dvt: hh.dvt, soLuong: sl, donGia: gia,
                    tienHang: Math.round(sl * gia), chiPhiPhanBo: cp,
                    giaVonLo: sl ? Math.round((sl * gia + cp) / sl) : gia, ghiChu: '' });
                n++;
            });
            Object.keys(nhom).forEach(function (so) {
                var g = nhom[so];
                var ncc = DB.all('nhaCungCap').filter(function (x) { return x.ten === g.ncc; })[0];
                var lo = {
                    so: so, ngay: g.ngay, loai: 'Nhập khẩu',
                    nhaCungCapId: ncc ? ncc.id : '', nhaCungCap: g.ncc,
                    khoId: (T.khoChinh() || {}).id, soHoaDon: '', ngoaiTe: 'VND', tyGia: 1,
                    nguoiLapId: (Q.nhanVienCuaToi() || {}).id || '', nguoiLap: (Q.nhanVienCuaToi() || {}).hoTen || '',
                    cachPhanBo: 'giaTri', lines: g.lines, chiPhi: [],
                    tongTienHang: T.sum(g.lines, function (l) { return l.tienHang; }),
                    tongChiPhi: T.sum(g.lines, function (l) { return l.chiPhiPhanBo; }),
                    tongVatNK: 0,
                    tongGiaVon: T.sum(g.lines, function (l) { return l.tienHang + l.chiPhiPhanBo; }),
                    daPhanBo: true, trangThai: 'Chờ nhập kho',
                    ghiChu: 'Nạp từ dữ liệu lịch sử Excel'
                };
                /* Đi qua đúng cửa nhập kho của Engine — mỗi lô đúng một phiếu
                   nhập, một lần cộng tồn, một lần tính giá vốn. */
                if (T.nhapKho(DB.insert('loNhap', lo))) daNhap++;
            });
            return { n: n, mo: 'Đã nhập kho ' + daNhap + '/' + Object.keys(nhom).length + ' lô nhập' };
        }
    },
    {
        k: 'bangGia', t: 'Lịch sử bảng giá bán', i: 'bi-tags',
        mo: 'Mỗi dòng là đơn giá của một mã hàng trong một bảng giá. Bảng giá cũ được giữ nguyên với hiệu lực riêng.',
        cols: [{ t: 'Tên bảng giá', k: 'ten' }, { t: 'Hiệu lực từ', k: 'tu' }, { t: 'Hiệu lực đến', k: 'den' },
               { t: 'Mã hàng', k: 'ma' }, { t: 'Đơn giá', k: 'gia' }],
        nap: function (rows) {
            var nhom = {}, n = 0;
            rows.forEach(function (r) {
                var ten = String(r['Tên bảng giá'] || '').trim();
                var ma = String(r['Mã hàng'] || '').trim();
                if (!ten || !ma) return;
                var key = ten + '|' + String(r['Hiệu lực từ'] || '');
                if (!nhom[key]) nhom[key] = { ten: ten, tu: String(r['Hiệu lực từ'] || '').substr(0, 10),
                    den: String(r['Hiệu lực đến'] || '').substr(0, 10), dong: [] };
                /* MỘT DÒNG EXCEL LÀ MỘT DÒNG BẢNG GIÁ, liên kết bằng ID NỘI BỘ. */
                var hh2 = T.hh(ma);
                nhom[key].dong.push({
                    hangHoaId: hh2 ? hh2.id : '', ma: hh2 ? (hh2.ma || ma) : ma,
                    model: hh2 ? (hh2.model || hh2.ma || '') : ma, ten: hh2 ? hh2.ten : '',
                    dvt: hh2 ? hh2.dvt : '', thongSo: hh2 ? (hh2.thongSo || '') : '',
                    nhom: hh2 ? (hh2.nhom || '') : '', hang: hh2 ? (hh2.hang || '') : '',
                    ghiChu: '', gia: { 'Giá bán': Math.round(Number(r['Đơn giá']) || 0) },
                    dongExcel: nhom[key].dong.length + 1
                });
                n++;
            });
            Object.keys(nhom).forEach(function (k) {
                var g = nhom[k];
                /* Mã bảng giá phải DUY NHẤT: mã trùng sẽ làm hai phiên bản khác
                   nhau gom về một khóa và một bảng giá biến mất khỏi tra giá. */
                var soLS = 1, coMa = {};
                DB.all('bangGiaBan').forEach(function (x) { coMa[T.kd(x.ma || '')] = 1; });
                while (coMa[T.kd('LS' + soLS)]) soLS++;
                var bgLS = {
                    ma: 'LS' + soLS, ten: g.ten, phienBan: 1, donViId: '',
                    moTa: 'Nạp từ dữ liệu lịch sử Excel', tuNgay: g.tu, denNgay: g.den,
                    trangThai: g.den && g.den < T.today() ? 'Ngừng áp dụng' : 'Đang áp dụng',
                    macDinh: false, dong: g.dong, cotGia: ['Giá bán'], cotChinh: 'Giá bán',
                    /* Bảng giá lịch sử KHÔNG mang chiết khấu nội bộ: đây là số
                       liệu đã xảy ra, không phải bảng giá để lập chứng từ mới. */
                    chietKhauNoiBo: {}
                };
                T.dungChiMucBG(bgLS);
                DB.insert('bangGiaBan', bgLS);
            });
            return { n: n, mo: 'Đã tạo ' + Object.keys(nhom).length + ' bảng giá' };
        }
    },
    {
        k: 'khachHang', t: 'Lịch sử khách hàng', i: 'bi-people',
        mo: 'Bổ sung khách hàng cũ. Mã trùng sẽ được cập nhật, không tạo bản ghi trùng lặp.',
        cols: [{ t: 'Mã KH', k: 'ma' }, { t: 'Tên khách hàng', k: 'ten' }, { t: 'Mã số thuế', k: 'mst' },
               { t: 'Địa chỉ', k: 'diaChi' }, { t: 'Điện thoại', k: 'dt' }, { t: 'Thư điện tử', k: 'email' },
               { t: 'Thuế GTGT (%)', k: 'thue' }],
        nap: function (rows) {
            var n = 0, sua = 0;
            rows.forEach(function (r) {
                var ten = String(r['Tên khách hàng'] || '').trim();
                if (!ten) return;
                var ma = String(r['Mã KH'] || '').trim();
                var cu = DB.all('khachHang').filter(function (x) {
                    return (ma && x.ma === ma) || T.kd(x.ten) === T.kd(ten); })[0];
                /* Ghi thẳng vào CUSTOMER MASTER DATA theo đúng lược đồ chuẩn;
                   mã khách hàng do hệ thống sinh, không lấy mã trong tệp. */
                var o = {
                    ma: (cu && cu.ma) || DB.maKHMoi(), ten: ten, loai: 'Doanh nghiệp',
                    /* Bảng giá của khách chỉ được chọn qua Engine — lấy thẳng bản
                       ghi có cờ macDinh sẽ gán cả phiên bản đã ngừng áp dụng. */
                    mucGia: 'BANLE',
                    bangGiaId: (T.bangGiaMacDinh('', 'BANLE', T.today()) || {}).id || '',
                    mst: T.chuanMST(r['Mã số thuế']), cccd: '', diaChi: r['Địa chỉ'] || '',
                    daiDien: '', dienThoai: String(r['Điện thoại'] || ''), email: r['Email'] || '',
                    nguoiLienHe: '', chucVu: '', dtLienHe: '', emailLienHe: '',
                    dieuKhoanTT: '', nguoiPhuTrachId: '', nguoiPhuTrach: '', donViId: '',
                    hanMucNo: 0, duAn: '', tenKhac: '', soLanGiaoDich: 0, nguonMST: '',
                    ghiChu: 'Nạp từ dữ liệu lịch sử', trangThai: 'Đang giao dịch'
                };
                if (cu) { Object.keys(o).forEach(function (k2) { if (o[k2] !== '' && o[k2] !== 0) cu[k2] = o[k2]; }); sua++; }
                else { DB.insert('khachHang', o); n++; }
            });
            DB.save();
            return { n: n + sua, mo: 'Thêm mới ' + n + ' · cập nhật ' + sua + ' khách hàng' };
        }
    },
    {
        k: 'donBan', t: 'Lịch sử giao dịch bán hàng', i: 'bi-cart-check',
        mo: 'Nạp lại các đơn bán của những năm trước. Giá vốn được ghi ĐÚNG như trong tệp — không tính lại theo giá vốn hiện tại.',
        cols: [{ t: 'Số đơn', k: 'so' }, { t: 'Ngày', k: 'ngay' }, { t: 'Đơn vị phát hành', k: 'dv' },
               { t: 'Khách hàng', k: 'kh' }, { t: 'Mã hàng', k: 'ma' }, { t: 'Số lượng', k: 'sl' },
               { t: 'Đơn giá bán', k: 'gia' }, { t: 'Giá vốn', k: 'gv' }, { t: 'Thuế GTGT (%)', k: 'thue' }],
        nap: function (rows) {
            var nhom = {}, n = 0;
            rows.forEach(function (r) {
                var so = String(r['Số đơn'] || '').trim();
                var ma = String(r['Mã hàng'] || '').trim();
                if (!so || !ma) return;
                var hh = T.hh(ma);
                if (!nhom[so]) {
                    var tenKH = String(r['Khách hàng'] || '').trim();
                    var kh = DB.all('khachHang').filter(function (x) { return T.kd(x.ten) === T.kd(tenKH); })[0];
                    var dv = String(r['Đơn vị phát hành'] || 'EMC').trim().toUpperCase();
                    if (!DB.get('donVi', dv)) dv = 'EMC';
                    nhom[so] = { ngay: String(r['Ngày'] || T.today()).substr(0, 10), donVi: dv,
                        khachHangId: kh ? kh.id : '', khachHang: kh ? kh.ten : tenKH,
                        vatPct: r['Thuế GTGT (%)'] === '' || r['Thuế GTGT (%)'] === undefined ? 10 : Number(r['Thuế GTGT (%)']),
                        lines: [] };
                }
                /* GIÁ VỐN CỦA NĂM CŨ LÀ MỘT SỰ KIỆN ĐÃ XẢY RA, không tái lập được
                   từ lô nhập vì các năm đó chưa quản lý trong phần mềm. Nạp vào
                   với cờ KHÓA GIÁ VỐN: Engine không tính lại, không ghi đè, và
                   cũng không sinh giá vốn gốc mới cho kho. */
                var gvLS = Number(r['Giá vốn']) || 0;
                nhom[so].lines.push({
                    hangHoaId: hh ? hh.id : '', maHang: hh ? (hh.ma || ma) : ma,
                    tenHang: hh ? hh.ten : ma, dvt: hh ? hh.dvt : 'Cái',
                    soLuong: Number(r['Số lượng']) || 0, donGia: Number(r['Đơn giá bán']) || 0,
                    ckPhanTram: 0, giaVon: gvLS, giaVonGoc: gvLS,
                    giaVonKhoa: true, nguonGiaVon: 'Lịch sử', ghiChu: ''
                });
                n++;
            });
            Object.keys(nhom).forEach(function (so) {
                var g = nhom[so];
                var t = T.tinhTong(g.lines, g.vatPct);
                var o = {
                    so: so, ngay: g.ngay, donVi: g.donVi, khachHangId: g.khachHangId, khachHang: g.khachHang,
                    duAn: '', baoGiaId: '', baoGiaSo: '',
                    nguoiLapId: (Q.nhanVienCuaToi() || {}).id || '', nguoiLap: (Q.nhanVienCuaToi() || {}).hoTen || '',
                    ngayGiao: g.ngay, mucGia: 'BANLE', diaDiemGiao: '', dieuKhoanTT: '',
                    lines: g.lines, vatPct: g.vatPct,
                    thanhTien: t.thanhTien, vat: t.vat, tongCong: t.tongCong,
                    trangThai: 'Hoàn thành', ghiChu: 'Nạp từ dữ liệu lịch sử Excel',
                    maGD: DB.maGDMoi()
                };
                o.tongGiaVon = T.giaVonChungTu(o);
                o.laiGop = o.thanhTien - o.tongGiaVon;
                DB.insert('donBan', o);
            });
            return { n: n, mo: 'Đã tạo ' + Object.keys(nhom).length + ' đơn bán lịch sử' };
        }
    }
];

S['nhap-lich-su'] = function (host) {
    var mod = 'caiDat';
    if (!Q.co(mod, 'quanTri')) {
        host.innerHTML = '<div class="page"><div class="empty" style="padding-top:80px">' +
            '<i class="bi bi-shield-lock"></i><b>Không có quyền</b>Cần quyền Quản trị hệ thống.</div></div>';
        W.crumb(['Hệ thống', 'Nhập dữ liệu lịch sử']);
        return;
    }
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Nhập dữ liệu lịch sử</h2>' +
        '<div class="sub">Nạp lại dữ liệu nhiều năm đang quản lý bằng Excel, rồi tính lại giá vốn bình quân để bảo đảm tính liên tục</div></div></div>' +

        '<div class="note b mb12"><i class="bi bi-list-ol"></i><div><b>Thứ tự nạp đúng:</b> ' +
        '1) Khách hàng → 2) Tồn kho &amp; giá vốn đầu kỳ → 3) Lịch sử nhập hàng theo lô → ' +
        '4) Lịch sử bảng giá → 5) Lịch sử giao dịch bán hàng → 6) bấm <b>Tính lại giá vốn</b>.<br>' +
        'Giá vốn ghi trên chứng từ lịch sử được giữ <b>đúng như trong tệp Excel</b>, không bị tính lại theo giá vốn hiện tại.</div></div>' +

        '<div class="grid2" id="dsLoai"></div>' +

        '<div class="card mt12"><div class="card-h"><i class="bi bi-arrow-repeat"></i> Bước cuối: tính lại giá vốn bình quân</div>' +
        '<div class="card-b"><div class="small muted mb12">Sau khi nạp xong toàn bộ lô nhập của các năm, bấm nút dưới đây. ' +
        'Hệ thống phát lại mọi lô theo thứ tự ngày để dựng lại giá vốn bình quân di động và lịch sử biến động. ' +
        '<b>Chứng từ bán hàng đã phát hành không bị đụng tới.</b></div>' +
        '<button class="btn primary" id="btnTinhLai"><i class="bi bi-arrow-repeat"></i> Tính lại toàn bộ giá vốn bình quân</button></div></div>' +
        '</div>';
    W.crumb(['Hệ thống', 'Nhập dữ liệu lịch sử']);

    host.querySelector('#dsLoai').innerHTML = LOAI.map(function (l, i) {
        return '<div class="card"><div class="card-h"><i class="bi ' + l.i + '"></i> ' + T.esc(l.t) + '</div>' +
            '<div class="card-b"><div class="small muted mb12">' + T.esc(l.mo) + '</div>' +
            '<div class="small mb12"><b>Cột bắt buộc:</b> ' + l.cols.map(function (c) { return c.t; }).join(' · ') + '</div>' +
            '<div class="row"><button class="btn sm" data-mau="' + i + '"><i class="bi bi-download"></i> Tải tệp mẫu</button>' +
            '<button class="btn sm primary" data-nap="' + i + '"><i class="bi bi-upload"></i> Nạp tệp Excel</button></div>' +
            '</div></div>';
    }).join('');

    host.querySelectorAll('[data-mau]').forEach(function (b) {
        b.onclick = function () {
            var l = LOAI[Number(b.getAttribute('data-mau'))];
            UI.xuatExcel('MAU_LichSu_' + l.k, l.t, l.cols.map(function (c) { return { t: c.t, k: c.k, w: 20 }; }), []);
        };
    });
    host.querySelectorAll('[data-nap]').forEach(function (b) {
        b.onclick = function () { napTep(LOAI[Number(b.getAttribute('data-nap'))]); };
    });
    host.querySelector('#btnTinhLai').onclick = function () {
        UI.confirm({
            title: 'Tính lại toàn bộ giá vốn bình quân', icon: 'bi-arrow-repeat',
            message: 'Phát lại toàn bộ lô nhập theo thứ tự ngày để dựng lại giá vốn bình quân di động?',
            note: 'Chứng từ bán hàng đã phát hành <b>không thay đổi</b> — giá vốn trên đó đã đóng băng.',
            okText: 'Tính lại', okIcon: 'bi-arrow-repeat',
            ok: function () {
                var kq = T.tinhLaiGiaVon();
                W.route();
                UI.toast('ok', 'Đã tính lại giá vốn',
                    kq.soLo + ' lô · ' + kq.soMa + ' mã hàng · ' + kq.soDong + ' dòng lịch sử.');
            }
        });
    };

    function napTep(l) {
        UI.modal({
            size: 'lg', title: 'Nạp dữ liệu lịch sử — ' + l.t,
            body: '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' + T.esc(l.mo) +
                '<br>Tệp Excel cần có dòng tiêu đề đúng các cột: <b>' +
                l.cols.map(function (c) { return c.t; }).join(', ') + '</b></div></div>' +
                (l.k === 'tonDau' ? '<div class="grid2 mb12">' +
                    '<div class="fld"><label>Ngày chốt tồn đầu kỳ</label><input type="date" data-f="ngay" value="' + T.today() + '"></div>' +
                    '<div class="fld"><label class="row" style="gap:7px;cursor:pointer;margin-top:22px">' +
                    '<input type="checkbox" data-f="taoMoi" checked> Tự tạo mã hàng chưa có trong danh mục</label></div></div>' : '') +
                '<div class="row mb12"><button class="btn" id="btnMau2"><i class="bi bi-download"></i> Tải tệp mẫu</button>' +
                '<button class="btn primary" id="btnChon2"><i class="bi bi-file-earmark-excel"></i> Chọn tệp Excel...</button>' +
                '<span class="muted small" id="tenTep2">Chưa chọn tệp</span></div>' +
                '<div id="xem2"></div>',
            buttons: [
                { text: 'Đóng', click: function (h) { h.close(); } },
                { text: 'Nạp vào phần mềm', cls: 'primary', icon: 'bi-database-add', click: function (h) {
                    if (!h._rows || !h._rows.length) { UI.toast('warn', 'Chưa có dữ liệu để nạp'); return; }
                    var o = UI.read(h.el);
                    var kq = l.nap(h._rows, o);
                    DB.save(); h.close(); W.route();
                    UI.toast(kq.n ? 'ok' : 'warn', kq.n ? 'Đã nạp ' + kq.n + ' dòng' : 'Không nạp được dòng nào', kq.mo);
                } }
            ],
            onOpen: function (h) {
                h.q('#btnMau2').onclick = function () {
                    UI.xuatExcel('MAU_LichSu_' + l.k, l.t, l.cols.map(function (c) { return { t: c.t, k: c.k, w: 20 }; }), []);
                };
                h.q('#btnChon2').onclick = function () {
                    UI.nhapExcel({ done: function (rows, ten) {
                        h._rows = rows;
                        h.q('#tenTep2').textContent = ten + ' — ' + rows.length + ' dòng';
                        h.q('#xem2').innerHTML = '<div class="card"><div class="card-h">Xem trước ' +
                            Math.min(rows.length, 10) + '/' + rows.length + ' dòng</div>' +
                            '<div class="tablewrap" style="max-height:300px;border:none"><table class="grid"><thead><tr>' +
                            l.cols.map(function (c) { return '<th>' + T.esc(c.t) + '</th>'; }).join('') +
                            '</tr></thead><tbody>' + rows.slice(0, 10).map(function (r) {
                                return '<tr>' + l.cols.map(function (c) { return '<td>' + T.esc(r[c.t]) + '</td>'; }).join('') + '</tr>';
                            }).join('') + '</tbody></table></div></div>';
                    } });
                };
            }
        });
    }
};

})(window);

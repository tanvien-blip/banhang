/* ==========================================================================
   TVERP — CHỨNG TỪ BÁN HÀNG (PHẦN 2)
   Phụ lục hợp đồng · Biên bản giao hàng · Biên bản nghiệm thu · Đề nghị thanh toán
   Quy trình linh hoạt: Hợp đồng / Phụ lục / Nghiệm thu / Đề nghị TT đều là bước TÙY CHỌN.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;

function cbKH(h, rec, ro) {
    var host = h.q('#cbKH');
    if (!host) return;
    var cb = UI.combo(host, {
        items: DB.all('khachHang').map(function (c) { return { v: c.id, t: c.ten, s: c.ma }; }),
        value: rec.khachHangId || '', placeholder: '— Chọn khách hàng —',
        onChange: function (v) {
            var c = DB.get('khachHang', v);
            h.q('[data-f="khachHangId"]').value = v;
            if (h.q('#khDiaChi') && c && !h.q('#khDiaChi').value) h.q('#khDiaChi').value = c.diaChi || '';
        }
    });
    host.setAttribute('data-fk', 'khachHangId');
    /* ĐỒNG BỘ NGAY KHI DỰNG BIỂU MẪU — ô chọn khách hàng là ô ghép (combo),
       giá trị thật nằm ở ô ẩn phía sau. UI.combo chỉ báo onChange khi NGƯỜI DÙNG
       đổi lựa chọn, không báo lúc dựng ô. Nếu không tự gán ở đây thì mở một
       chứng từ CŨ ra sửa, ô ẩn vẫn rỗng và phần kiểm tra dữ liệu sẽ báo
       “Dữ liệu chưa hợp lệ” dù khách hàng vẫn đang hiển thị đầy đủ. */
    var oAn = h.q('[data-f="khachHangId"]');
    if (oAn) oAn.value = cb.get() || rec.khachHangId || '';
    h._cbKH = cb;
    if (ro) host.style.pointerEvents = 'none';
}
function oKH(lb, r) {
    return '<div class="fld req span2"><label>' + (lb || 'Khách hàng') + '</label><div id="cbKH" class="combo"></div>' +
        '<input type="hidden" data-f="khachHangId" value="' + T.esc((r && r.khachHangId) || '') + '"></div>';
}
function oDonVi(r) {
    return '<div class="fld"><label>Công ty thực hiện</label><select data-f="donVi">' +
        opt(DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat + ' — ' + d.ten }; }),
            r.donVi || DB.data._meta.ctyId) + '</select></div>';
}
function nvTen() { return (Q.nhanVienCuaToi() || {}).hoTen || ''; }
function nvId() { return (Q.nhanVienCuaToi() || {}).id || ''; }

/* ==========================================================================
   PHỤ LỤC HỢP ĐỒNG  (bước tùy chọn)
   ========================================================================== */
var TT_PL = ['Nháp', 'Đã ký', 'Đang thực hiện', 'Đã thanh lý', 'Đã hủy'];
S['phu-luc'] = function (host) {
    W.DocScreen(host, {
        title: 'Phụ lục hợp đồng', dt: 'Phụ lục', key: 'phuLuc', seq: 'PL', file: 'DanhSach_PhuLucHopDong',
        sub: 'Bước tùy chọn — điều chỉnh giá trị, gia hạn hoặc bổ sung hàng hóa cho hợp đồng đã ký',
        crumb: ['Bán hàng', 'Phụ lục hợp đồng'], stFirst: 'Nháp', duyet: { tt: 'Đã ký' },
        rows: function () { return T.theoCty(DB.all('phuLuc')); },
        search: ['so', 'khachHang', 'hopDongSo', 'noiDung'],
        cols: [
            { k: 'so', t: 'Số phụ lục', w: 176, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày ký', w: 102, fmt: 'date' },
            { k: 'hopDongSo', t: 'Thuộc hợp đồng', w: 168, cls: 'mono', r: function (v, r) {
                return v ? '<span class="link" onclick="event.stopPropagation();W.moChungTu(\'hopDong\',\'' + r.hopDongId + '\')">' + T.esc(v) + '</span>'
                         : '<span class="muted">—</span>'; } },
            { k: 'khachHang', t: 'Khách hàng', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
            { k: 'loai', t: 'Loại phụ lục', w: 190 },
            { k: 'nguoiLap', t: 'Người lập', w: 146 },
            { k: 'tongCong', t: 'Giá trị điều chỉnh', w: 158, cls: 'num', total: true, r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 132, r: function (v, r) {
                return T.pill(v) + (r.khoa ? ' <i class="bi bi-lock-fill" style="color:var(--err)"></i>' : ''); } }
        ],
        filters: [
            { k: 'trangThai', t: 'Trạng thái', opts: TT_PL },
            { k: 'loai', t: 'Loại phụ lục', w: 210, opts: ['Điều chỉnh giá trị', 'Gia hạn thời gian', 'Bổ sung hàng hóa', 'Điều chỉnh điều khoản'] },
            { k: 'nguoiLapId', t: 'Người lập', w: 170, opts: DB.all('nhanVien').map(function (n) { return { v: n.id, t: n.hoTen }; }) }
        ],
        excel: [
            { t: 'Số phụ lục', k: 'so', w: 22 }, { t: 'Ngày ký', k: 'ngay', w: 12 },
            { t: 'Hợp đồng gốc', k: 'hopDongSo', w: 22 }, { t: 'Khách hàng', k: 'khachHang', w: 40 },
            { t: 'Loại phụ lục', k: 'loai', w: 24 }, { t: 'Nội dung', k: 'noiDung', w: 44 },
            { t: 'Tiền hàng', k: 'thanhTien', w: 16 }, { t: 'Thuế suất (%)', k: 'vatPct', w: 12 },
            { t: 'Tiền thuế', k: 'vat', w: 16 }, { t: 'Tổng cộng', k: 'tongCong', w: 18 },
            { t: 'Người lập', k: 'nguoiLap', w: 22 }, { t: 'Trạng thái', k: 'trangThai', w: 16 }
        ],
        blank: function () {
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, hopDongId: '', hopDongSo: '',
                khachHangId: '', khachHang: '', duAn: '', donBanId: '', loai: 'Bổ sung hàng hóa',
                noiDung: '', nguoiLapId: nvId(), nguoiLap: nvTen(), lines: [], vatPct: 10,
                trangThai: 'Nháp', ghiChu: '' };
        },
        rules: [{ k: 'khachHangId' }, { k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' }],
        head: function (r) {
            return '<div class="grid4">' +
            '<div class="fld"><label>Số phụ lục</label><input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
            '<div class="fld req"><label>Ngày ký</label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            oDonVi(r) +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(TT_PL, r.trangThai) + '</select></div>' +
            '<div class="fld span2"><label>Hợp đồng gốc</label><select data-f="hopDongId" id="selHD"><option value="">— Không gắn hợp đồng —</option>' +
                opt(DB.all('hopDong').map(function (x) { return { v: x.id, t: x.so + ' — ' + x.khachHang + ' — ' + T.money(x.tongCong) + ' đ' }; }), r.hopDongId) +
                '</select></div>' +
            oKH('Khách hàng (Bên B)', r) +
            '<div class="fld"><label>Loại phụ lục</label><select data-f="loai">' +
                opt(['Điều chỉnh giá trị', 'Gia hạn thời gian', 'Bổ sung hàng hóa', 'Điều chỉnh điều khoản'], r.loai) + '</select></div>' +
            W.oNguoiLap(r, 'phuLuc') +
            '<div class="fld" style="grid-column:span 4"><label>Nội dung điều chỉnh</label>' +
                '<textarea data-f="noiDung" rows="2">' + T.esc(r.noiDung || '') + '</textarea></div>' +
            '</div>';
        },
        onHead: function (h, r, setMuc, moi, ro) {
            cbKH(h, r, ro);
            W.bindNguoiLap(h, r, 'phuLuc', ro);
            var sel = h.q('#selHD');
            if (sel) sel.onchange = function () {
                var hd = DB.get('hopDong', sel.value);
                if (!hd) return;
                h._cbKH.set(hd.khachHangId);
                h.q('[data-f="khachHangId"]').value = hd.khachHangId;
                UI.toast('info', 'Đã lấy thông tin từ hợp đồng', hd.so);
            };
        },
        toObj: function (v, r, h) {
            var kh = DB.get('khachHang', h._cbKH.get()), hd = DB.get('hopDong', v.hopDongId);
            return { so: v.so, ngay: v.ngay, donVi: v.donVi, hopDongId: v.hopDongId, hopDongSo: hd ? hd.so : '',
                donBanId: hd ? hd.donBanId : (r.donBanId || ''),
                khachHangId: kh ? kh.id : '', khachHang: kh ? kh.ten : '', duAn: hd ? hd.duAn : (r.duAn || ''),
                loai: v.loai, noiDung: v.noiDung, nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId),
                trangThai: v.trangThai, ghiChu: r.ghiChu || '' };
        }
    });
};

/* ==========================================================================
   BIÊN BẢN GIAO HÀNG  (chứng từ độc lập)
   ========================================================================== */
var TT_BB = ['Chờ giao', 'Đã giao hàng', 'Đã hủy'];
S['bien-ban-giao'] = function (host) {
    W.DocScreen(host, {
        title: 'Biên bản giao hàng', dt: 'Biên bản giao hàng', key: 'bienBanGiao', seq: 'BB',
        file: 'DanhSach_BienBanGiaoHang',
        sub: 'Chứng từ độc lập — tạo được trực tiếp từ Báo giá, Đơn bán, Hợp đồng hoặc Phiếu xuất kho',
        crumb: ['Bán hàng', 'Biên bản giao hàng'], stFirst: 'Chờ giao', duyet: { tt: 'Đã giao hàng' },
        rows: function () { return T.theoCty(DB.all('bienBanGiao')); },
        search: ['so', 'khachHang', 'donBanSo', 'phieuXuatSo', 'duAn', 'nguoiNhan'],
        cols: [
            { k: 'so', t: 'Số biên bản', w: 160, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày giao', w: 104, fmt: 'date' },
            { k: 'khachHang', t: 'Bên nhận hàng', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    (r.duAn ? '<div class="small muted ellip">' + T.esc(r.duAn) + '</div>' : ''); } },
            { k: '_goc', t: 'Chứng từ gốc', w: 200, sort: false, r: function (v, r) {
                var a = [];
                if (r.phieuXuatSo) a.push('<span class="link mono small" onclick="event.stopPropagation();W.moChungTu(\'phieuXuat\',\'' + r.phieuXuatId + '\')">' + T.esc(r.phieuXuatSo) + '</span>');
                if (r.donBanSo) a.push('<span class="link mono small" onclick="event.stopPropagation();W.moChungTu(\'donBan\',\'' + r.donBanId + '\')">' + T.esc(r.donBanSo) + '</span>');
                if (r.hopDongSo) a.push('<span class="link mono small" onclick="event.stopPropagation();W.moChungTu(\'hopDong\',\'' + r.hopDongId + '\')">' + T.esc(r.hopDongSo) + '</span>');
                if (r.baoGiaSo) a.push('<span class="link mono small" onclick="event.stopPropagation();W.moChungTu(\'baoGia\',\'' + r.baoGiaId + '\')">' + T.esc(r.baoGiaSo) + '</span>');
                return a.length ? a.join('<br>') : '<span class="muted">lập trực tiếp</span>'; } },
            { k: 'nguoiNhan', t: 'Người nhận', w: 160 },
            { k: 'nguoiLap', t: 'Người lập', w: 140 },
            { k: 'tongCong', t: 'Giá trị', w: 146, cls: 'num', total: true, fmt: 'money' },
            { k: 'trangThai', t: 'Trạng thái', w: 134, r: function (v, r) {
                return T.pill(v) + (r.khoa ? ' <i class="bi bi-lock-fill" style="color:var(--err)"></i>' : ''); } }
        ],
        filters: [
            { k: 'trangThai', t: 'Trạng thái', opts: TT_BB },
            { k: 'donVi', t: 'Đơn vị phát hành', w: 175, opts: DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat }; }) },
            { k: 'nguoiLapId', t: 'Người lập', w: 170, opts: DB.all('nhanVien').map(function (n) { return { v: n.id, t: n.hoTen }; }) },
            { k: 'ngay', t: 'Từ ngày', type: 'date', w: 140, test: function (x, v) { return x.ngay >= v; } }
        ],
        excel: [
            { t: 'Số biên bản', k: 'so', w: 20 }, { t: 'Ngày giao', k: 'ngay', w: 12 },
            { t: 'Bên nhận hàng', k: 'khachHang', w: 40 }, { t: 'Dự án', k: 'duAn', w: 24 },
            { t: 'Địa điểm giao', k: 'diaDiemGiao', w: 30 }, { t: 'Người nhận', k: 'nguoiNhan', w: 22 },
            { t: 'Người giao', k: 'nguoiGiao', w: 22 }, { t: 'Phiếu xuất', k: 'phieuXuatSo', w: 20 },
            { t: 'Đơn bán', k: 'donBanSo', w: 20 }, { t: 'Hợp đồng', k: 'hopDongSo', w: 22 },
            { t: 'Báo giá', k: 'baoGiaSo', w: 20 }, { t: 'Tiền hàng', k: 'thanhTien', w: 16 },
            { t: 'Thuế suất (%)', k: 'vatPct', w: 12 }, { t: 'Tiền thuế', k: 'vat', w: 16 },
            { t: 'Tổng cộng', k: 'tongCong', w: 18 }, { t: 'Người lập', k: 'nguoiLap', w: 22 },
            { t: 'Trạng thái', k: 'trangThai', w: 16 }
        ],
        blank: function () {
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, khachHangId: '', khachHang: '',
                duAn: '', baoGiaId: '', baoGiaSo: '', donBanId: '', donBanSo: '', hopDongId: '', hopDongSo: '',
                phieuXuatId: '', phieuXuatSo: '', diaDiemGiao: '', nguoiNhan: '', nguoiGiao: nvTen(),
                phuongTien: '', nguoiLapId: nvId(), nguoiLap: nvTen(), lines: [], vatPct: 10,
                trangThai: 'Chờ giao', ghiChu: '' };
        },
        rules: [{ k: 'khachHangId' }, { k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' }],
        head: function (r) {
            return '<div class="grid4">' +
            '<div class="fld"><label>Số biên bản</label><input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
            '<div class="fld req"><label>Ngày giao hàng</label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            oDonVi(r) +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(TT_BB, r.trangThai) + '</select></div>' +
            oKH('Bên nhận hàng', r) +
            '<div class="fld"><label>Người nhận hàng</label><input data-f="nguoiNhan" value="' + T.esc(r.nguoiNhan || '') + '"></div>' +
            W.oMD('nhanVien', { f: 'nguoiGiaoId', fTen: 'nguoiGiao', gt: r.nguoiGiaoId, gtTen: r.nguoiGiao,
                                nhan: 'Người giao hàng', tuDo: true }) +
            '<div class="fld span2"><label>Địa điểm giao hàng</label><input id="khDiaChi" data-f="diaDiemGiao" value="' + T.esc(r.diaDiemGiao || '') + '"></div>' +
            W.oMD('duAn', { f: 'duAnId', fTen: 'duAn', gt: r.duAnId, gtTen: r.duAn, rong: true,
                            nhan: 'Dự án / công trình', tuDo: true }) +
            W.oNguoiLap(r, 'bienBanGiao') +
            '<div class="fld"><label>Phương tiện vận chuyển</label><input data-f="phuongTien" value="' + T.esc(r.phuongTien || '') + '"></div>' +
            '<div class="fld span2"><label>Ghi chú</label><input data-f="ghiChu" value="' + T.esc(r.ghiChu || '') + '"></div>' +
            '<div class="fld span4" style="grid-column:span 4">' + lienKetGoc(r) + '</div>' +
            '</div>';
        },
        onHead: function (h, r, setMuc, moi, ro) {
            cbKH(h, r, ro);
            W.bindNguoiLap(h, r, 'bienBanGiao', ro);
        },
        toObj: function (v, r, h) {
            var kh = DB.get('khachHang', h._cbKH.get());
            return { so: v.so, ngay: v.ngay, donVi: v.donVi, khachHangId: kh ? kh.id : '',
                khachHang: kh ? kh.ten : '', duAnId: v.duAnId || '', duAn: v.duAn,
                baoGiaId: r.baoGiaId || '', baoGiaSo: r.baoGiaSo || '',
                donBanId: r.donBanId || '', donBanSo: r.donBanSo || '',
                hopDongId: r.hopDongId || '', hopDongSo: r.hopDongSo || '',
                phieuXuatId: r.phieuXuatId || '', phieuXuatSo: r.phieuXuatSo || '',
                diaDiemGiao: v.diaDiemGiao, nguoiNhan: v.nguoiNhan, nguoiGiaoId: v.nguoiGiaoId || '', nguoiGiao: v.nguoiGiao,
                phuongTien: v.phuongTien, nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId),
                trangThai: v.trangThai, ghiChu: v.ghiChu || '' };
        },
        next: {
            label: 'Bước tiếp theo',
            can: function () { return true; },
            run: function (r, done) {
                var db = DB.get('donBan', r.donBanId);
                if (db) W.buocTiep(db, done);
                else UI.toast('warn', 'Biên bản chưa gắn đơn bán', 'Không dựng được hồ sơ tiếp theo.');
            }
        }
    });
};

function lienKetGoc(r) {
    var a = [];
    function it(lb, so, id, k) {
        if (!so) return;
        a.push('<button type="button" class="btn sm" onclick="W.moChungTu(\'' + k + '\',\'' + id + '\')">' +
            '<i class="bi bi-box-arrow-up-right"></i> ' + lb + ': ' + T.esc(so) + '</button>');
    }
    it('Báo giá', r.baoGiaSo, r.baoGiaId, 'baoGia');
    it('Đơn bán', r.donBanSo, r.donBanId, 'donBan');
    it('Hợp đồng', r.hopDongSo, r.hopDongId, 'hopDong');
    it('Phiếu xuất', r.phieuXuatSo, r.phieuXuatId, 'phieuXuat');
    if (!a.length) return '<div class="note b"><i class="bi bi-info-circle"></i><div>Chứng từ lập trực tiếp, chưa gắn với báo giá / đơn bán / hợp đồng / phiếu xuất nào.</div></div>';
    return '<div class="note b"><i class="bi bi-link-45deg"></i><div><b>Chứng từ gốc — bấm để mở lại:</b><div class="row mt8">' +
        a.join('') + '</div></div></div>';
}

/* ==========================================================================
   BIÊN BẢN NGHIỆM THU  (bước tùy chọn)
   ========================================================================== */
var TT_NT = ['Chờ nghiệm thu', 'Đã nghiệm thu', 'Đã hủy'];
/* Ô chọn MẪU BIÊN BẢN NGHIỆM THU.
   Biên bản phải đồng bộ với loại hợp đồng: chỉ liệt kê các mẫu mà loại hợp
   đồng gốc cho phép. Biên bản lập tay (chưa gắn hợp đồng) thì cho chọn đủ. */
function oMauNT(r) {
    var hd = r.hopDongId ? DB.get('hopDong', r.hopDongId) : null;
    var ma = hd ? T.mauNTCua(hd) : T.MAU_NGHIEM_THU.map(function (x) { return x.k; });
    if (ma.indexOf(r.mauNT || 'KL') < 0) ma = ma.concat([r.mauNT || 'KL']);
    var ds = ma.map(function (k) { return { v: k, t: T.tenMauNT(k) }; });
    return '<div class="fld req" style="grid-column:span 2"><label>Mẫu biên bản nghiệm thu</label>' +
        '<select data-f="mauNT">' + opt(ds, r.mauNT || 'KL') + '</select>' +
        '<div class="small muted">' + (hd
            ? 'Theo loại hợp đồng: <b>' + T.esc((T.loaiHDCua(hd) || {}).ten || hd.loai || '') + '</b>'
            : 'Hợp đồng / BB giao hàng được kế thừa khi tạo từ hồ sơ') + '</div></div>';
}
S['nghiem-thu'] = function (host) {
    W.DocScreen(host, {
        title: 'Biên bản nghiệm thu', dt: 'Biên bản nghiệm thu', key: 'bienBanNghiemThu', seq: 'NT',
        file: 'DanhSach_BienBanNghiemThu',
        sub: 'Một HỒ SƠ NGHIỆM THU gồm hai bản đi song song: BBNT khối lượng và BBNT giá trị',
        banner: '<div class="note b mb8"><i class="bi bi-collection"></i><div>' +
            '<b>Một hồ sơ nghiệm thu có hai bản, không phải chọn một bỏ một.</b> ' +
            'Bản <b>KHỐI LƯỢNG</b> và bản <b>GIÁ TRỊ</b> dùng chung công trình, khách hàng, ' +
            'hợp đồng, phụ lục, đợt nghiệm thu và danh sách công việc. Bản giá trị đọc thẳng ' +
            'khối lượng đã nghiệm thu từ bản khối lượng của cùng hồ sơ, nên <b>giá trị không ' +
            'bao giờ tính độc lập với khối lượng</b>. Hồ sơ nào còn thiếu một bản thì bấm ' +
            '<b>Tạo bản còn lại</b> ngay trên dòng.</div></div>',
        crumb: ['Bán hàng', 'Biên bản nghiệm thu'], stFirst: 'Chờ nghiệm thu', duyet: { tt: 'Đã nghiệm thu' },
        rows: function () { return T.theoCty(DB.all('bienBanNghiemThu')); },
        search: ['so', 'khachHang', 'donBanSo', 'hopDongSo', 'duAn'],
        /* Khối lượng nghiệm thu khai riêng từng dòng — mặc định bằng số lượng
           theo báo giá / hợp đồng, người dùng sửa lại theo thực tế hiện trường. */
        cotDongThem: [{ k: 'soLuongNT', t: 'KL nghiệm thu', w: 112, so: true }],
        cols: [
            { k: 'so', t: 'Số biên bản', w: 160, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày nghiệm thu', w: 130, fmt: 'date' },
            { k: 'khachHang', t: 'Bên A (chủ đầu tư)', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    (r.duAn ? '<div class="small muted ellip">' + T.esc(r.duAn) + '</div>' : ''); } },
            { k: 'hopDongSo', t: 'Hợp đồng', w: 168, cls: 'mono', r: function (v, r) {
                return v ? '<span class="link" onclick="event.stopPropagation();W.moChungTu(\'hopDong\',\'' + r.hopDongId + '\')">' + T.esc(v) + '</span>' : '<span class="muted">—</span>'; } },
            { k: 'bienBanGiaoSo', t: 'BB giao hàng', w: 160, cls: 'mono', r: function (v, r) {
                return v ? '<span class="link" onclick="event.stopPropagation();W.moChungTu(\'bienBanGiao\',\'' + r.bienBanGiaoId + '\')">' + T.esc(v) + '</span>' : '<span class="muted">—</span>'; } },
            { k: 'hoSoSo', t: 'Hồ sơ nghiệm thu', w: 232, r: function (v, r) {
                var hs = T.hoSoNT(r.hoSoId || r.id);
                if (!hs) return '<span class="muted">—</span>';
                var ban = '<span class="' + (hs.coKL ? 'pos' : 'muted') + '">KL ' +
                    (hs.coKL ? '✓' : '—') + '</span> · <span class="' +
                    (hs.coGT ? 'pos' : 'muted') + '">GT ' + (hs.coGT ? '✓' : '—') + '</span>';
                return '<div class="mono small">' + T.esc(hs.hoSoSo) + '</div>' +
                    '<div class="small">' + ban +
                    (hs.duBo ? '' :
                        ' <button class="btn sm" onclick="event.stopPropagation();' +
                        'W.taoBanConLaiNT(\'' + r.id + '\')" title="' + T.esc(hs.thieu) + '">' +
                        'Tạo bản còn lại</button>') + '</div>'; } },
            { k: 'nguoiLap', t: 'Người lập', w: 140 },
            { k: 'tongCong', t: 'Giá trị nghiệm thu', w: 162, cls: 'num', total: true, fmt: 'money' },
            { k: 'trangThai', t: 'Trạng thái', w: 148, r: function (v, r) {
                return T.pill(v) + (r.khoa ? ' <i class="bi bi-lock-fill" style="color:var(--err)"></i>' : ''); } }
        ],
        filters: [
            { k: 'trangThai', t: 'Trạng thái', w: 170, opts: TT_NT },
            { k: 'nguoiLapId', t: 'Người lập', w: 170, opts: DB.all('nhanVien').map(function (n) { return { v: n.id, t: n.hoTen }; }) }
        ],
        excel: [
            { t: 'Số biên bản', k: 'so', w: 20 }, { t: 'Ngày nghiệm thu', k: 'ngay', w: 14 },
            { t: 'Bên A', k: 'khachHang', w: 40 }, { t: 'Dự án', k: 'duAn', w: 26 },
            { t: 'Hợp đồng', k: 'hopDongSo', w: 22 }, { t: 'BB giao hàng', k: 'bienBanGiaoSo', w: 20 },
            { t: 'Mẫu biên bản', k: '_mau', w: 44, v: function (r) { return T.tenMauNT(r.mauNT || 'KL'); } },
            { t: 'Kết luận', k: 'ketLuan', w: 40 }, { t: 'Tiền hàng', k: 'thanhTien', w: 16 },
            { t: 'Thuế suất (%)', k: 'vatPct', w: 12 }, { t: 'Tổng cộng', k: 'tongCong', w: 18 },
            { t: 'Người lập', k: 'nguoiLap', w: 22 }, { t: 'Trạng thái', k: 'trangThai', w: 18 }
        ],
        blank: function () {
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, khachHangId: '', khachHang: '',
                duAn: '', donBanId: '', donBanSo: '', hopDongId: '', hopDongSo: '',
                bienBanGiaoId: '', bienBanGiaoSo: '',
                phuLucId: '', phuLucSo: '', dotNT: 1, hoSoId: '', hoSoSo: '',
                thanhPhanA: 'Đại diện chủ đầu tư', thanhPhanB: nvTen(),
                ketLuan: 'Hàng hóa đúng chủng loại, đủ số lượng, đạt yêu cầu kỹ thuật. Hai bên đồng ý nghiệm thu.',
                nguoiLapId: nvId(), nguoiLap: nvTen(), lines: [], vatPct: 10, mauNT: 'KL',
                trangThai: 'Chờ nghiệm thu', ghiChu: '' };
        },
        rules: [{ k: 'khachHangId' }, { k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' },
                { k: 'mauNT', msg: 'Phải chọn mẫu biên bản nghiệm thu' }],
        head: function (r) {
            return '<div class="grid4">' +
            '<div class="fld"><label>Số biên bản</label><input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
            '<div class="fld req"><label>Ngày nghiệm thu</label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            oDonVi(r) +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(TT_NT, r.trangThai) + '</select></div>' +
            oKH('Bên A (chủ đầu tư / bên mua)', r) +
            '<div class="fld"><label>Đại diện Bên A</label><input data-f="thanhPhanA" value="' + T.esc(r.thanhPhanA || '') + '"></div>' +
            W.oMD('nhanVien', { f: 'thanhPhanBId', fTen: 'thanhPhanB', gt: r.thanhPhanBId, gtTen: r.thanhPhanB,
                                nhan: 'Đại diện Bên B', tuDo: true }) +
            W.oMD('duAn', { f: 'duAnId', fTen: 'duAn', gt: r.duAnId, gtTen: r.duAn, rong: true,
                            nhan: 'Dự án / công trình', tuDo: true }) +
            W.oNguoiLap(r, 'bienBanNghiemThu') +
            oMauNT(r) +
            '<div class="fld" style="grid-column:span 4"><label>Kết luận nghiệm thu</label>' +
                '<textarea data-f="ketLuan" rows="2">' + T.esc(r.ketLuan || '') + '</textarea></div>' +
            '<div class="fld" style="grid-column:span 4">' + lienKetGoc(r) + '</div>' +
            '</div>';
        },
        onHead: function (h, r, setMuc, moi, ro) { cbKH(h, r, ro); W.bindNguoiLap(h, r, 'bienBanNghiemThu', ro); },
        toObj: function (v, r, h) {
            var kh = DB.get('khachHang', h._cbKH.get());
            return { so: v.so, ngay: v.ngay, donVi: v.donVi, khachHangId: kh ? kh.id : '',
                khachHang: kh ? kh.ten : '', duAnId: v.duAnId || '', duAn: v.duAn,
                donBanId: r.donBanId || '', donBanSo: r.donBanSo || '',
                hopDongId: r.hopDongId || '', hopDongSo: r.hopDongSo || '',
                bienBanGiaoId: r.bienBanGiaoId || '', bienBanGiaoSo: r.bienBanGiaoSo || '',
                mauNT: v.mauNT || r.mauNT || 'KL',
                /* HỒ SƠ NGHIỆM THU — giữ nguyên hồ sơ cũ khi sửa; bản lập mới
                   tự mở hồ sơ của chính nó ngay sau khi lưu. */
                hoSoId: r.hoSoId || '', hoSoSo: r.hoSoSo || v.so || '',
                phuLucId: r.phuLucId || '', phuLucSo: r.phuLucSo || '',
                dotNT: Number(r.dotNT) || 1,
                thanhPhanA: v.thanhPhanA, thanhPhanBId: v.thanhPhanBId || '', thanhPhanB: v.thanhPhanB, ketLuan: v.ketLuan,
                nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId),
                trangThai: v.trangThai, ghiChu: r.ghiChu || '' };
        }
    });
};

/* ==========================================================================
   ĐỀ NGHỊ THANH TOÁN / ĐỀ NGHỊ TẠM ỨNG
   --------------------------------------------------------------------------
   Chứng từ đề nghị SỐ TIỀN, không phải chứng từ bán hàng nên KHÔNG kê dòng
   hàng hóa. Số tiền đề nghị do người lập tự khai; phần mềm KHÔNG tự lấy toàn
   bộ giá trị hợp đồng và KHÔNG tự lấy toàn bộ công nợ. Giá trị hợp đồng, số
   đã thanh toán và số còn phải trả chỉ hiển thị làm CĂN CỨ đối chiếu.
   ========================================================================== */
var TT_DN = ['Chờ duyệt', 'Đã duyệt chi', 'Đã thanh toán', 'Từ chối'];
var DOT_TT = ['Tạm ứng', 'Đợt 1', 'Đợt 2', 'Đợt 3', 'Quyết toán', 'Bảo hành'];

/* --------------------------------------------------------------------------
   CĂN CỨ NGHIỆM THU CỦA ĐỀ NGHỊ THANH TOÁN
   Đề nghị thanh toán được lập trên căn cứ MỘT trong hai loại biên bản:
     · BBNT   — Biên bản nghiệm thu (khối lượng, chất lượng hàng hóa đã bàn giao)
     · BBNTGT — Biên bản nghiệm thu GIÁ TRỊ thanh toán
   Hai loại đều là bản ghi của phân hệ Biên bản nghiệm thu, phân biệt bằng
   trường mauNT: 'KL' → BBNT, 'GT' → BBNTGT. Không sinh thêm phân hệ mới,
   không thay đổi nghiệp vụ của phân hệ Biên bản nghiệm thu.
   -------------------------------------------------------------------------- */
var LOAI_CAN_CU = [
    { v: '',       t: '— Không dựa trên biên bản nghiệm thu —' },
    { v: 'BBNT',   t: 'Biên bản nghiệm thu (BBNT)' },
    { v: 'BBNTGT', t: 'Biên bản nghiệm thu giá trị (BBNTGT)' }
];
W.LOAI_CAN_CU_DNTT = LOAI_CAN_CU;

/** Mã mẫu biên bản tương ứng với loại căn cứ. */
function mauCua(loai) { return loai === 'BBNTGT' ? 'GT' : 'KL'; }
/** Loại căn cứ tương ứng với một biên bản nghiệm thu. */
W.loaiCanCuCua = function (bb) { return bb && bb.mauNT === 'GT' ? 'BBNTGT' : 'BBNT'; };

/** Danh sách biên bản nghiệm thu dùng được làm căn cứ, theo loại đã chọn. */
W.dsBienBanCanCu = function (loai, r) {
    var mau = mauCua(loai);
    var ds = T.theoCty(DB.all('bienBanNghiemThu')).filter(function (b) {
        return (b.mauNT || 'KL') === mau && b.trangThai !== 'Đã hủy';
    });
    /* Biên bản đang được chứng từ tham chiếu luôn có mặt trong danh sách kể cả
       khi đã đổi trạng thái — không bao giờ làm đứt liên kết đã ghi. */
    if (r && r.bienBanNTId && !ds.some(function (b) { return b.id === r.bienBanNTId; })) {
        var cu = DB.get('bienBanNghiemThu', r.bienBanNTId);
        if (cu) ds = [cu].concat(ds);
    }
    /* Cùng khách hàng / cùng hợp đồng thì đưa lên trước cho dễ chọn. */
    var kh = r && r.khachHangId, hd = r && r.hopDongId;
    return ds.slice().sort(function (a, b) {
        var da = (hd && a.hopDongId === hd ? 2 : 0) + (kh && a.khachHangId === kh ? 1 : 0);
        var db2 = (hd && b.hopDongId === hd ? 2 : 0) + (kh && b.khachHangId === kh ? 1 : 0);
        if (da !== db2) return db2 - da;
        return String(b.ngay || '').localeCompare(String(a.ngay || '')) ||
               String(a.id).localeCompare(String(b.id));
    });
};

/** Biên bản nghiệm thu phù hợp nhất để làm căn cứ cho một chuỗi chứng từ. */
W.bienBanChoDeNghi = function (n) {
    if (!n || (!n.donBanId && !n.hopDongId)) return null;
    var ds = T.theoCty(DB.all('bienBanNghiemThu')).filter(function (b) {
        return b.trangThai !== 'Đã hủy' &&
               ((n.hopDongId && b.hopDongId === n.hopDongId) ||
                (n.donBanId && b.donBanId === n.donBanId));
    });
    /* Ưu tiên Biên bản nghiệm thu GIÁ TRỊ vì đó mới là căn cứ về tiền. */
    var gt = ds.filter(function (b) { return b.mauNT === 'GT'; });
    var ds2 = (gt.length ? gt : ds).slice().sort(function (a, b) {
        return String(b.ngay || '').localeCompare(String(a.ngay || '')) ||
               String(a.id).localeCompare(String(b.id));
    });
    return ds2[0] || null;
};

/**
 * LẤY TOÀN BỘ DỮ LIỆU CỦA BIÊN BẢN NGHIỆM THU SANG ĐỀ NGHỊ THANH TOÁN.
 * Áp dụng cho cả BBNT và BBNTGT. Chỉ ghi đè những ô người lập chưa tự khai
 * khác đi; số tiền đề nghị lấy đúng giá trị của biên bản.
 */
W.apBienBanVaoDeNghi = function (o, bb) {
    if (!o || !bb) return o;
    var laGT = (bb.mauNT || 'KL') === 'GT';
    o.loaiCanCu = laGT ? 'BBNTGT' : 'BBNT';
    o.bienBanNTId = bb.id; o.bienBanNTSo = bb.so || '';
    o.khachHangId = bb.khachHangId || o.khachHangId || '';
    o.khachHang = bb.khachHang || o.khachHang || '';
    if (bb.duAnId !== undefined) o.duAnId = bb.duAnId || o.duAnId || '';
    o.duAn = bb.duAn || o.duAn || '';
    o.donBanId = bb.donBanId || o.donBanId || '';
    o.donBanSo = bb.donBanSo || o.donBanSo || '';
    o.hopDongId = bb.hopDongId || o.hopDongId || '';
    o.hopDongSo = bb.hopDongSo || o.hopDongSo || '';
    o.donVi = bb.donVi || o.donVi;
    /* Giá trị nghiệm thu chính là số tiền đề nghị thanh toán. */
    o.soTien = Number(bb.tongCong) || 0;
    o.noiDungTT = 'Thanh toán giá trị nghiệm thu theo ' +
        (laGT ? 'Biên bản nghiệm thu giá trị' : 'Biên bản nghiệm thu') + ' số ' + (bb.so || '') +
        (bb.hopDongSo ? ' của hợp đồng ' + bb.hopDongSo : '');
    o.lyDo = T.tenMauNT(bb.mauNT || 'KL') + ' số ' + (bb.so || '') +
             (bb.ngay ? ' ngày ' + T.date(bb.ngay) : '');
    o.hoSoKem = ghepHoSo(o.hoSoKem, (laGT ? 'Biên bản nghiệm thu giá trị' : 'Biên bản nghiệm thu') +
                                    ' số ' + (bb.so || ''));
    return o;
};

function ghepHoSo(cu, them) {
    cu = String(cu || '').trim();
    if (!them) return cu;
    if (cu && T.kd(cu).indexOf(T.kd(them)) >= 0) return cu;
    return cu ? cu + '; ' + them : them;
}

/** Ô chọn căn cứ nghiệm thu trên biểu mẫu Đề nghị thanh toán. */
function oCanCuNT(r) {
    var loai = r.loaiCanCu || '';
    var ds = loai ? W.dsBienBanCanCu(loai, r) : [];
    return '<div class="fld span2"><label>Căn cứ nghiệm thu</label>' +
        '<select data-f="loaiCanCu" id="dnLoaiCC">' + opt(LOAI_CAN_CU, loai) + '</select>' +
        '<div class="small muted">Chọn BBNT hoặc BBNTGT — hệ thống tự lấy toàn bộ dữ liệu của biên bản sang đề nghị</div></div>' +
        '<div class="fld span2"><label>Biên bản nghiệm thu</label>' +
        '<select data-f="bienBanNTId" id="dnBienBan"' + (loai ? '' : ' disabled') + '>' +
        '<option value="">' + (loai ? '— Chọn biên bản —' : '— Chọn loại căn cứ trước —') + '</option>' +
        opt(ds.map(function (b) { return { v: b.id, t: nhanBB(b) }; }), r.bienBanNTId || '') +
        '</select><div class="small muted" id="dnBBMo"></div></div>';
}
function nhanBB(b) {
    return (b.so || '') + ' — ' + T.date(b.ngay) + ' — ' + (b.khachHang || '') +
           ' — ' + T.money(b.tongCong || 0) + ' đ';
}

/** Khối căn cứ đối chiếu hiển thị ngay trên biểu mẫu nhập liệu. */
function khoiCanCu(r) {
    var c = T.canCuDeNghi(r);
    return '<div class="note b" style="grid-column:span 4"><i class="bi bi-calculator"></i><div>' +
        '<b>Căn cứ đối chiếu</b> — chỉ để tham khảo, hệ thống <b>không tự điền</b> vào số tiền đề nghị.<br>' +
        'Giá trị hợp đồng / đơn hàng: <b>' + T.money(c.giaTri) + ' đ</b> &nbsp;·&nbsp; ' +
        'Đã thanh toán: <b>' + T.money(c.daTra) + ' đ</b> &nbsp;·&nbsp; ' +
        'Còn phải thanh toán: <b>' + T.money(c.conLai) + ' đ</b></div></div>';
}

S['de-nghi-tt'] = function (host) {
    W.DocScreen(host, {
        title: 'Đề nghị thanh toán / tạm ứng', dt: 'Đề nghị thanh toán', key: 'deNghiTT', seq: 'DN',
        file: 'DanhSach_DeNghiThanhToan', khongDongHang: true,
        sub: 'Đề nghị thanh toán hoặc tạm ứng theo đợt — số tiền do người lập tự khai',
        crumb: ['Bán hàng', 'Đề nghị thanh toán'], stFirst: 'Chờ duyệt', duyet: { tt: 'Đã duyệt chi' },
        rows: function () { return T.theoCty(DB.all('deNghiTT')); },
        search: ['so', 'khachHang', 'donBanSo', 'hopDongSo', 'lyDo', 'noiDungTT'],
        cols: [
            { k: 'so', t: 'Số đề nghị', w: 158, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ngay', t: 'Ngày lập', w: 102, fmt: 'date' },
            { k: 'loaiDN', t: 'Loại đề nghị', w: 122, r: function (v) { return T.pill(v || 'Thanh toán'); } },
            { k: 'khachHang', t: 'Khách hàng / nội dung', r: function (v, r) {
                return '<span class="ellip">' + T.esc(v) + '</span>' +
                    '<div class="small muted ellip">' + T.esc(r.noiDungTT || r.lyDo || '') + '</div>'; } },
            { k: 'dot', t: 'Đợt', w: 118 },
            { k: 'bienBanNTSo', t: 'Căn cứ nghiệm thu', w: 176, cls: 'mono',
              r: function (v, r) {
                  if (!v) return '<span class="muted">—</span>';
                  return '<span class="link" onclick="event.stopPropagation();W.moChungTu(\'bienBanNghiemThu\',\'' +
                      T.esc(r.bienBanNTId || '') + '\')">' + T.esc(v) + '</span>' +
                      '<div class="small muted">' + T.esc(r.loaiCanCu || '') + '</div>'; } },
            { k: 'hanTT', t: 'Hạn thanh toán', w: 130, fmt: 'date' },
            { k: 'nguoiDeNghi', t: 'Người đề nghị', w: 150, r: function (v, r) { return T.esc(v || r.nguoiLap || ''); } },
            { k: 'soTien', t: 'Số tiền đề nghị', w: 158, cls: 'num', total: true, r: function (v) { return '<b>' + T.money(v) + '</b>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 140, r: function (v, r) {
                return T.pill(v) + (r.khoa ? ' <i class="bi bi-lock-fill" style="color:var(--err)"></i>' : ''); } }
        ],
        filters: [
            { k: 'loaiDN', t: 'Loại đề nghị', w: 150, opts: T.LOAI_DE_NGHI },
            { k: 'loaiCanCu', t: 'Căn cứ nghiệm thu', w: 180, opts: ['BBNT', 'BBNTGT'] },
            { k: 'trangThai', t: 'Trạng thái', w: 165, opts: TT_DN },
            { k: 'nguoiLapId', t: 'Người lập', w: 170, opts: DB.all('nhanVien').map(function (n) { return { v: n.id, t: n.hoTen }; }) }
        ],
        excel: [
            { t: 'Số đề nghị', k: 'so', w: 20 }, { t: 'Ngày lập', k: 'ngay', w: 12 },
            { t: 'Loại đề nghị', k: 'loaiDN', w: 14 },
            { t: 'Khách hàng', k: 'khachHang', w: 40 }, { t: 'Đợt', k: 'dot', w: 18 },
            { t: 'Loại căn cứ', k: 'loaiCanCu', w: 14 },
            { t: 'Số biên bản nghiệm thu', k: 'bienBanNTSo', w: 22 },
            { t: 'Nội dung thanh toán', k: 'noiDungTT', w: 46 },
            { t: 'Lý do', k: 'lyDo', w: 40 }, { t: 'Đơn bán', k: 'donBanSo', w: 20 },
            { t: 'Hợp đồng', k: 'hopDongSo', w: 22 }, { t: 'Hạn thanh toán', k: 'hanTT', w: 14 },
            { t: 'Hồ sơ kèm theo', k: 'hoSoKem', w: 40 },
            { t: 'Hình thức', k: 'hinhThuc', w: 16 },
            { t: 'Số tiền đề nghị', k: 'soTien', w: 18 },
            { t: 'Người đề nghị', k: 'nguoiDeNghi', w: 22 },
            { t: 'Người lập', k: 'nguoiLap', w: 22 },
            { t: 'Trạng thái', k: 'trangThai', w: 16 }
        ],
        blank: function () {
            return { so: '', ngay: T.today(), donVi: DB.data._meta.ctyId, khachHangId: '', khachHang: '',
                duAn: '', donBanId: '', donBanSo: '', hopDongId: '', hopDongSo: '',
                loaiCanCu: '', bienBanNTId: '', bienBanNTSo: '',
                loaiDN: 'Thanh toán', dot: 'Đợt 1', soTien: 0, noiDungTT: '', lyDo: '',
                hoSoKem: '', hinhThuc: 'Chuyển khoản', boPhan: '', kinhGui: '',
                hanTT: T.addDays(T.today(), 15),
                nguoiDeNghiId: nvId(), nguoiDeNghi: nvTen(),
                nguoiLapId: nvId(), nguoiLap: nvTen(),
                trangThai: 'Chờ duyệt', ghiChu: '' };
        },
        rules: [{ k: 'khachHangId' }, { k: 'ngay' }, { k: 'nguoiLapId', msg: 'Phải chọn người lập' },
                { k: 'noiDungTT', msg: 'Phải nhập nội dung thanh toán' }],
        /* Số tiền đề nghị BẮT BUỘC do người lập khai, không được để trống hay
           bằng 0 — hệ thống tuyệt đối không tự điền thay. */
        truocLuu: function (o) {
            if (!(Number(o.soTien) > 0)) {
                UI.toast('err', 'Chưa nhập số tiền đề nghị',
                    'Số tiền đề nghị do người lập tự khai; hệ thống không tự lấy giá trị hợp đồng hay công nợ.');
                return false;
            }
            return true;
        },
        head: function (r) {
            var tamUng = (r.loaiDN || '') === 'Tạm ứng';
            return '<div class="grid4">' +
            '<div class="fld"><label>Số đề nghị</label><input data-f="so" value="' + T.esc(r.so || '') + '" placeholder="Tự sinh khi lưu"></div>' +
            '<div class="fld req"><label>Ngày lập</label><input type="date" data-f="ngay" value="' + T.esc(r.ngay) + '"></div>' +
            oDonVi(r) +
            '<div class="fld"><label>Loại đề nghị</label><select data-f="loaiDN">' +
                opt(T.LOAI_DE_NGHI, r.loaiDN || 'Thanh toán') + '</select></div>' +
            oKH('Khách hàng thanh toán', r) +
            '<div class="fld"><label>Đợt thanh toán</label><select data-f="dot">' +
                opt(DOT_TT, r.dot || (tamUng ? 'Tạm ứng' : 'Đợt 1')) + '</select></div>' +
            '<div class="fld"><label>Hạn thanh toán</label><input type="date" data-f="hanTT" value="' + T.esc(r.hanTT || '') + '"></div>' +
            oCanCuNT(r) +
            '<div class="fld req"><label>Số tiền đề nghị (đồng)</label>' +
                /* Ô tiền phân tách hàng nghìn ngay khi gõ để người lập nhìn là
                   nhận ra bậc số — 89.299.584 chứ không phải 89299584. */
                '<input class="tien" data-f="soTien" value="' + T.esc(T.num(r.soTien || 0, 0)) + '"></div>' +
            '<div class="fld span3"><label>Bằng chữ</label>' +
                '<input id="dnChu" value="' + T.esc(T.docTien(Number(r.soTien) || 0)) + '" readonly></div>' +
            '<div class="fld span4 req"><label>Nội dung thanh toán</label>' +
                '<textarea data-f="noiDungTT" rows="2">' + T.esc(r.noiDungTT || '') + '</textarea></div>' +
            '<div class="fld span2"><label>Lý do / căn cứ đề nghị</label><input data-f="lyDo" value="' + T.esc(r.lyDo || '') + '"></div>' +
            '<div class="fld span2"><label>Hồ sơ kèm theo</label><input data-f="hoSoKem" value="' + T.esc(r.hoSoKem || '') +
                '" placeholder="VD: Biên bản giao hàng, biên bản nghiệm thu, hóa đơn GTGT"></div>' +
            '<div class="fld"><label>Người đề nghị</label><input data-f="nguoiDeNghi" value="' + T.esc(r.nguoiDeNghi || r.nguoiLap || '') + '"></div>' +
            '<div class="fld"><label>Bộ phận</label><input data-f="boPhan" value="' + T.esc(r.boPhan || '') + '"></div>' +
            '<div class="fld"><label>Hình thức thanh toán</label><select data-f="hinhThuc">' +
                opt(T.HINH_THUC_TT, r.hinhThuc || 'Chuyển khoản') + '</select></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(TT_DN, r.trangThai) + '</select></div>' +
            W.oNguoiLap(r, 'deNghiTT') +
            '<div class="fld"><label>Kính gửi</label><input data-f="kinhGui" value="' + T.esc(r.kinhGui || '') +
                '" placeholder="Để trống thì in tên khách hàng"></div>' +
            W.oMD('duAn', { f: 'duAnId', fTen: 'duAn', gt: r.duAnId, gtTen: r.duAn, rong: true,
                            nhan: 'Dự án / công trình', tuDo: true }) +
            khoiCanCu(r) +
            '<div class="fld" style="grid-column:span 4">' + lienKetGoc(r) + '</div>' +
            '</div>';
        },
        onHead: function (h, r, setMuc, moi, ro) {
            cbKH(h, r, ro); W.bindNguoiLap(h, r, 'deNghiTT', ro);
            /* Số tiền → Bằng chữ, đổi ngay khi gõ. */
            var oSo = h.q('[data-f="soTien"]'), oChu = h.q('#dnChu');
            function doc() {
                if (!oChu) return;
                oChu.value = T.docTien(T.so(oSo.value) || 0);
            }
            if (oSo) { oSo.oninput = doc; oSo.onchange = doc; }
            /* Đổi loại đề nghị thì đổi luôn đợt mặc định cho đúng nghiệp vụ. */
            var oL = h.q('[data-f="loaiDN"]'), oD = h.q('[data-f="dot"]');
            if (oL && oD) oL.onchange = function () {
                if (this.value === 'Tạm ứng') oD.value = 'Tạm ứng';
                else if (oD.value === 'Tạm ứng') oD.value = 'Đợt 1';
            };

            /* ---------------- CĂN CỨ NGHIỆM THU: BBNT hoặc BBNTGT ----------------
               Đổi loại căn cứ → nạp lại danh sách biên bản đúng loại.
               Chọn một biên bản → LẤY TOÀN BỘ dữ liệu của biên bản sang đề nghị. */
            var oCC = h.q('#dnLoaiCC'), oBB = h.q('#dnBienBan'), oMo = h.q('#dnBBMo');
            /* Bản ghi làm việc của phần căn cứ — lưu cùng chứng từ khi bấm Lưu. */
            h._cc = { loaiCanCu: r.loaiCanCu || '', bienBanNTId: r.bienBanNTId || '',
                      bienBanNTSo: r.bienBanNTSo || '',
                      donBanId: r.donBanId || '', donBanSo: r.donBanSo || '',
                      hopDongId: r.hopDongId || '', hopDongSo: r.hopDongSo || '' };
            function moTa() {
                if (!oMo) return;
                var bb = h._cc.bienBanNTId ? DB.get('bienBanNghiemThu', h._cc.bienBanNTId) : null;
                oMo.innerHTML = bb
                    ? T.esc(T.tenMauNT(bb.mauNT || 'KL')) + ' · giá trị <b>' + T.money(bb.tongCong || 0) + ' đ</b>' +
                      (bb.hopDongSo ? ' · hợp đồng ' + T.esc(bb.hopDongSo) : '')
                    : '';
            }
            function napBB(giu) {
                if (!oBB) return;
                var loai = oCC ? oCC.value : '';
                var ds = loai ? W.dsBienBanCanCu(loai, { khachHangId: h._cbKH ? h._cbKH.get() : r.khachHangId,
                                                        hopDongId: h._cc.hopDongId,
                                                        bienBanNTId: giu ? h._cc.bienBanNTId : '' }) : [];
                oBB.disabled = !loai || ro;
                oBB.innerHTML = '<option value="">' +
                    (loai ? '— Chọn biên bản —' : '— Chọn loại căn cứ trước —') + '</option>' +
                    opt(ds.map(function (b) { return { v: b.id, t: nhanBB(b) }; }),
                        giu ? (h._cc.bienBanNTId || '') : '');
                if (!giu) { h._cc.bienBanNTId = ''; h._cc.bienBanNTSo = ''; }
                h._cc.loaiCanCu = loai;
                moTa();
            }
            if (oCC && !ro) oCC.onchange = function () { napBB(false); };
            if (oBB && !ro) oBB.onchange = function () {
                var bb = DB.get('bienBanNghiemThu', oBB.value);
                if (!bb) {
                    h._cc.bienBanNTId = ''; h._cc.bienBanNTSo = ''; moTa();
                    return;
                }
                /* Lấy TOÀN BỘ dữ liệu của biên bản sang đề nghị thanh toán. */
                var o2 = {};
                W.apBienBanVaoDeNghi(o2, bb);
                h._cc.loaiCanCu = o2.loaiCanCu;
                h._cc.bienBanNTId = o2.bienBanNTId; h._cc.bienBanNTSo = o2.bienBanNTSo;
                h._cc.donBanId = o2.donBanId || ''; h._cc.donBanSo = o2.donBanSo || '';
                h._cc.hopDongId = o2.hopDongId || ''; h._cc.hopDongSo = o2.hopDongSo || '';
                if (o2.khachHangId && h._cbKH) {
                    h._cbKH.set(o2.khachHangId);
                    var oAn = h.q('[data-f="khachHangId"]');
                    if (oAn) oAn.value = o2.khachHangId;
                }
                function dat(f, gt) { var e = h.q('[data-f="' + f + '"]'); if (e && gt !== undefined && gt !== '') e.value = gt; }
                dat('duAnId', o2.duAnId); dat('duAn', o2.duAn);
                dat('noiDungTT', o2.noiDungTT); dat('lyDo', o2.lyDo); dat('hoSoKem', o2.hoSoKem);
                if (oSo) { oSo.value = T.num(o2.soTien || 0, 0); doc(); }
                moTa();
                UI.toast('ok', 'Đã lấy dữ liệu từ ' + (o2.loaiCanCu === 'BBNTGT'
                        ? 'Biên bản nghiệm thu giá trị' : 'Biên bản nghiệm thu'),
                    (bb.so || '') + ' — ' + T.money(bb.tongCong || 0) + ' đ. Kiểm tra lại rồi bấm Lưu.');
            };
            napBB(true);
        },
        toObj: function (v, r, h) {
            var kh = DB.get('khachHang', h._cbKH.get());
            var st = T.so(v.soTien) || 0;
            var cc = h._cc || {};
            /* Đã chọn một biên bản nghiệm thu làm căn cứ thì CHUỖI CHỨNG TỪ lấy
               ĐÚNG theo biên bản đó — không được giữ lại đơn bán / hợp đồng cũ
               của chứng từ, nếu không phiếu thu lập sau sẽ ghi vào nhầm đơn bán. */
            var coCC = !!cc.bienBanNTId;
            return { so: v.so, ngay: v.ngay, donVi: v.donVi, khachHangId: kh ? kh.id : '',
                khachHang: kh ? kh.ten : '', duAnId: v.duAnId || '', duAn: v.duAn,
                donBanId: coCC ? (cc.donBanId || '') : (r.donBanId || ''),
                donBanSo: coCC ? (cc.donBanSo || '') : (r.donBanSo || ''),
                hopDongId: coCC ? (cc.hopDongId || '') : (r.hopDongId || ''),
                hopDongSo: coCC ? (cc.hopDongSo || '') : (r.hopDongSo || ''),
                loaiCanCu: cc.loaiCanCu || '', bienBanNTId: cc.bienBanNTId || '',
                bienBanNTSo: cc.bienBanNTSo || '',
                loaiDN: v.loaiDN || 'Thanh toán', dot: v.dot, soTien: st,
                noiDungTT: v.noiDungTT, lyDo: v.lyDo, hoSoKem: v.hoSoKem,
                hinhThuc: v.hinhThuc, boPhan: v.boPhan, kinhGui: v.kinhGui, hanTT: v.hanTT,
                nguoiDeNghi: v.nguoiDeNghi,
                nguoiLapId: v.nguoiLapId, nguoiLap: W.tenNguoiLap(v.nguoiLapId),
                trangThai: v.trangThai, ghiChu: r.ghiChu || '',
                noiDungRieng: r.noiDungRieng };
        },
        next: {
            label: 'Lập Phiếu thu',
            can: function (r) { return !!r.donBanId; },
            run: function (r, done) {
                var db = DB.get('donBan', r.donBanId);
                if (db) W.taoPhieuThu(db, done);
                else UI.toast('warn', 'Đề nghị chưa gắn đơn bán');
            }
        }
    });
};

/* ==========================================================================
   SINH CHỨNG TỪ KẾ THỪA — dùng chung cho mọi nguồn
   ========================================================================== */
/**
 * Lấy toàn bộ thông tin có thể kế thừa từ một chứng từ nguồn bất kỳ
 * (Báo giá / Đơn bán / Hợp đồng / Phiếu xuất kho).
 */
W.ngonNguon = function (loai, r) {
    var kh = T.khChungTu(r);
    var db = loai === 'donBan' ? r : (r.donBanId ? DB.get('donBan', r.donBanId) : null);
    var bg = loai === 'baoGia' ? r : (db && db.baoGiaId ? DB.get('baoGia', db.baoGiaId) : null);
    var hd = loai === 'hopDong' ? r : (db ? DB.all('hopDong').filter(function (x) { return x.donBanId === db.id; })[0] : null);
    var px = loai === 'phieuXuat' ? r : null;
    return {
        donVi: r.donVi || DB.data._meta.ctyId,
        khachHangId: r.khachHangId, khachHang: r.khachHang, duAn: r.duAn || '',
        diaDiemGiao: r.diaDiemGiao || (db && db.diaDiemGiao) || kh.diaChi || '',
        nguoiNhan: r.nguoiNhan || kh.nguoiLienHe || 'Đại diện bên mua',
        nguoiGiao: r.nguoiGiao || nvTen(),
        phuongTien: r.phuongTien || '',
        baoGiaId: bg ? bg.id : '', baoGiaSo: bg ? bg.so : '',
        donBanId: db ? db.id : '', donBanSo: db ? db.so : '',
        hopDongId: hd ? hd.id : '', hopDongSo: hd ? hd.so : '',
        phieuXuatId: px ? px.id : '', phieuXuatSo: px ? px.so : '',
        lines: T.clone(r.lines || []),
        vatPct: r.vatPct === undefined ? 10 : r.vatPct,
        thanhTien: r.thanhTien || 0, vat: r.vat || 0, tongCong: r.tongCong || 0,
        nguoiLapId: r.nguoiLapId || nvId(), nguoiLap: r.nguoiLap || nvTen(),
        ghiChu: r.ghiChu || ''
    };
};

/** Tạo Biên bản giao hàng từ Báo giá / Đơn bán / Hợp đồng / Phiếu xuất kho. */
W.taoBBGH = function (loai, r, done) {
    if (!Q.co('bienBanGiao', 'them')) return UI.thieuQuyen('bienBanGiao', 'them');
    var n = W.ngonNguon(loai, r);
    var ten = { baoGia: 'báo giá', donBan: 'đơn bán', hopDong: 'hợp đồng', phieuXuat: 'phiếu xuất kho' }[loai];
    UI.confirm({
        title: 'Tạo Biên bản giao hàng', icon: 'bi-clipboard-check-fill',
        message: 'Tạo <b>Biên bản giao hàng</b> kế thừa từ ' + ten + ' <b>' + T.esc(r.so) + '</b>?',
        note: 'Tự động lấy sang: đơn vị phát hành, khách hàng, địa chỉ giao hàng, người nhận, ' +
              '<b>' + (n.lines.length) + ' dòng hàng hóa</b> kèm số lượng, thuế suất ' + n.vatPct + '%, người lập và ghi chú. ' +
              'Anh chỉ cần kiểm tra rồi bấm Lưu.',
        okText: 'Tạo biên bản', okIcon: 'bi-clipboard-check',
        ok: function () {
            var o = {
                so: DB.soMoi('BB'), ngay: T.today(), donVi: n.donVi,
                khachHangId: n.khachHangId, khachHang: n.khachHang, duAn: n.duAn,
                baoGiaId: n.baoGiaId, baoGiaSo: n.baoGiaSo, donBanId: n.donBanId, donBanSo: n.donBanSo,
                hopDongId: n.hopDongId, hopDongSo: n.hopDongSo,
                phieuXuatId: n.phieuXuatId, phieuXuatSo: n.phieuXuatSo,
                diaDiemGiao: n.diaDiemGiao, nguoiNhan: n.nguoiNhan, nguoiGiao: n.nguoiGiao,
                phuongTien: n.phuongTien, nguoiLapId: n.nguoiLapId, nguoiLap: n.nguoiLap,
                lines: n.lines, vatPct: n.vatPct, thanhTien: n.thanhTien, vat: n.vat, tongCong: n.tongCong,
                /* Cùng một thương vụ thì cùng một mã giao dịch — gán ngay lúc
                   tạo, đúng bằng mã mà T.ganMaGD sẽ gán ở lần nạp sau. */
                maGD: n.maGD || r.maGD || '',
                trangThai: 'Đã giao hàng', ghiChu: 'Lập từ ' + ten + ' ' + r.so
            };
            DB.insert('bienBanGiao', o);
            if (done) done();
            W.route();
            UI.toast('ok', 'Đã tạo biên bản giao hàng ' + o.so, n.lines.length + ' dòng hàng đã được kế thừa.');
            setTimeout(function () { W.moChungTu('bienBanGiao', o.id); }, 400);
        }
    });
};

/** Tạo Biên bản nghiệm thu. */
W.taoNghiemThu = function (loai, r, done) {
    if (!Q.co('bienBanNghiemThu', 'them')) return UI.thieuQuyen('bienBanNghiemThu', 'them');
    var n = W.ngonNguon(loai, r);
    var bb = n.donBanId ? DB.all('bienBanGiao').filter(function (x) { return x.donBanId === n.donBanId; })[0] : null;
    var o = {
        so: DB.soMoi('NT'), ngay: T.today(), donVi: n.donVi,
        khachHangId: n.khachHangId, khachHang: n.khachHang, duAn: n.duAn,
        donBanId: n.donBanId, donBanSo: n.donBanSo, hopDongId: n.hopDongId, hopDongSo: n.hopDongSo,
        bienBanGiaoId: bb ? bb.id : '', bienBanGiaoSo: bb ? bb.so : '',
        thanhPhanA: 'Đại diện chủ đầu tư', thanhPhanB: n.nguoiLap,
        ketLuan: 'Hàng hóa đúng chủng loại, đủ số lượng, đạt yêu cầu kỹ thuật. Hai bên đồng ý nghiệm thu.',
        nguoiLapId: n.nguoiLapId, nguoiLap: n.nguoiLap,
        lines: n.lines, vatPct: n.vatPct, thanhTien: n.thanhTien, vat: n.vat, tongCong: n.tongCong,
        mauNT: 'KL', dotNT: 1, phuLucId: '', phuLucSo: '',
        maGD: n.maGD || r.maGD || '',
        trangThai: 'Đã nghiệm thu', ghiChu: 'Lập từ ' + r.so
    };
    DB.insert('bienBanNghiemThu', o);
    /* Bản vừa tạo mở một HỒ SƠ NGHIỆM THU mới, tự trỏ về chính nó. */
    DB.update('bienBanNghiemThu', o.id, T.gopGiu(DB.get('bienBanNghiemThu', o.id),
        { hoSoId: o.id, hoSoSo: o.so }));
    if (done) done(); W.route();
    UI.toast('ok', 'Đã tạo biên bản nghiệm thu ' + o.so);
    setTimeout(function () { W.moChungTu('bienBanNghiemThu', o.id); }, 400);
};

/**
 * TẠO NỐT BẢN CÒN LẠI CỦA HỒ SƠ NGHIỆM THU — THAO TÁC CỦA NGƯỜI DÙNG.
 *
 * Hồ sơ đã có BBNT KHỐI LƯỢNG thì tạo BBNT GIÁ TRỊ, và ngược lại. Bản mới
 * DÙNG CHUNG toàn bộ dữ liệu nguồn của hồ sơ (công trình, khách hàng, hợp
 * đồng, phụ lục, đợt nghiệm thu, danh sách công việc) — không khai lại và
 * không nhân đôi số liệu. Bản giá trị luôn đọc khối lượng từ bản khối lượng
 * của cùng hồ sơ, nên giá trị không bao giờ tính độc lập với khối lượng.
 */
W.taoBanConLaiNT = function (bbId, done) {
    if (!Q.co('bienBanNghiemThu', 'them')) return UI.thieuQuyen('bienBanNghiemThu', 'them');
    var bb = DB.get('bienBanNghiemThu', bbId);
    if (!bb) return UI.toast('err', 'Không tìm thấy biên bản', '');
    var hoSoId = bb.hoSoId || bb.id;
    var hs = T.hoSoNT(hoSoId);
    if (hs && hs.duBo)
        return UI.toast('info', 'Hồ sơ đã đủ hai bản',
            'Hồ sơ ' + hs.hoSoSo + ' đã có cả BBNT khối lượng và BBNT giá trị.');
    var canTao = (bb.mauNT || 'KL') === 'KL' ? 'GT' : 'KL';
    var o = T.clone(bb);
    delete o.id; delete o._tao; delete o._sua; delete o._nguoiTao; delete o._nguoiSua;
    o.so = DB.soMoi('NT');
    o.mauNT = canTao;
    o.hoSoId = hoSoId;
    o.hoSoSo = bb.hoSoSo || bb.so || hoSoId;
    o.khoa = false;
    o.ghiChu = 'Bản ' + (canTao === 'GT' ? 'GIÁ TRỊ' : 'KHỐI LƯỢNG') +
               ' của hồ sơ nghiệm thu ' + o.hoSoSo;
    DB.insert('bienBanNghiemThu', o);
    if (done) done(); W.route();
    UI.toast('ok', 'Đã tạo ' + (canTao === 'GT' ? 'BBNT GIÁ TRỊ' : 'BBNT KHỐI LƯỢNG'),
        'Hồ sơ ' + o.hoSoSo + ' nay có đủ hai bản, dùng chung dữ liệu nguồn.');
    setTimeout(function () { W.moChungTu('bienBanNghiemThu', o.id); }, 400);
};

/**
 * GỘP MỘT BIÊN BẢN VÀO HỒ SƠ ĐANG CÓ — THAO TÁC CỦA NGƯỜI DÙNG.
 * Dùng cho các biên bản lập từ trước v18.1.0: phần mềm không tự đoán hai biên
 * bản cũ có phải cùng một đợt nghiệm thu hay không, nên để người dùng quyết.
 */
W.gopVaoHoSoNT = function (bbId, hoSoId, done) {
    if (!Q.co('bienBanNghiemThu', 'sua')) return UI.thieuQuyen('bienBanNghiemThu', 'sua');
    var bb = DB.get('bienBanNghiemThu', bbId);
    var dich = T.hoSoNT(hoSoId);
    if (!bb || !dich) return UI.toast('err', 'Không tìm thấy hồ sơ đích', '');
    var cung = (bb.mauNT || 'KL') === 'KL' ? dich.coKL : dich.coGT;
    if (cung) return UI.toast('warn', 'Hồ sơ đích đã có bản cùng loại',
        'Một hồ sơ chỉ có một BBNT khối lượng và một BBNT giá trị.');
    DB.update('bienBanNghiemThu', bbId, T.gopGiu(bb,
        { hoSoId: hoSoId, hoSoSo: dich.hoSoSo }));
    if (done) done(); W.route();
    UI.toast('ok', 'Đã gộp vào hồ sơ ' + dich.hoSoSo, '');
};

/** Tạo Đề nghị thanh toán. */
W.taoDeNghiTT = function (loai, r, done) {
    if (!Q.co('deNghiTT', 'them')) return UI.thieuQuyen('deNghiTT', 'them');
    var n = W.ngonNguon(loai, r);
    var daThu = n.donBanId ? T.sum(DB.all('phieuThu').filter(function (p) {
        return p.donBanId === n.donBanId && p.trangThai === 'Đã ghi sổ'; }), function (p) { return p.soTien; }) : 0;
    /* KHÔNG tự lấy toàn bộ giá trị hợp đồng, KHÔNG tự lấy toàn bộ công nợ.
       Đề nghị mở ra với số tiền BẰNG 0 để người lập tự khai số tiền thật sự
       đề nghị; giá trị hợp đồng và công nợ chỉ hiện làm căn cứ đối chiếu ngay
       trên biểu mẫu nhập liệu.
       CHỨNG TỪ CHƯA ĐƯỢC GHI VÀO KHO DỮ LIỆU Ở BƯỚC NÀY — biểu mẫu mở ra ở
       trạng thái LẬP MỚI và chỉ ghi khi người lập bấm Lưu, dữ liệu hợp lệ.
       Nhờ vậy không bao giờ có chuyện giao diện báo lỗi mà chứng từ vẫn nằm
       trong danh sách. */
    var bb = W.bienBanChoDeNghi(n);
    var o = {
        so: '', ngay: T.today(), donVi: n.donVi,
        khachHangId: n.khachHangId, khachHang: n.khachHang, duAn: n.duAn,
        donBanId: n.donBanId, donBanSo: n.donBanSo, hopDongId: n.hopDongId, hopDongSo: n.hopDongSo,
        loaiCanCu: bb ? (bb.mauNT === 'GT' ? 'BBNTGT' : 'BBNT') : '',
        bienBanNTId: bb ? bb.id : '', bienBanNTSo: bb ? bb.so : '',
        loaiDN: 'Thanh toán', dot: daThu > 0 ? 'Đợt 2' : 'Đợt 1',
        hanTT: T.addDays(T.today(), 15), soTien: 0,
        noiDungTT: 'Thanh toán giá trị hàng hóa đã bàn giao theo ' + (n.hopDongSo || n.donBanSo || r.so),
        lyDo: '', hoSoKem: '', hinhThuc: 'Chuyển khoản', boPhan: '', kinhGui: '',
        nguoiDeNghi: n.nguoiLap,
        nguoiLapId: n.nguoiLapId, nguoiLap: n.nguoiLap,
        trangThai: 'Chờ duyệt', ghiChu: ''
    };
    /* Lập từ chính một biên bản nghiệm thu thì lấy luôn toàn bộ dữ liệu của
       biên bản đó — kể cả Biên bản nghiệm thu giá trị (BBNTGT). */
    if (loai === 'bienBanNghiemThu') W.apBienBanVaoDeNghi(o, r);
    if (done) done(); W.route();
    UI.toast('info', 'Lập đề nghị thanh toán',
        'Kiểm tra lại thông tin rồi bấm Lưu. Số tiền đề nghị do người lập tự khai — ' +
        'hệ thống không tự lấy giá trị hợp đồng hay công nợ.');
    W.moFormChungTu('deNghiTT', o);
};

/** Tạo Phụ lục hợp đồng từ một hợp đồng. */
W.taoPhuLuc = function (hd, done) {
    if (!Q.co('phuLuc', 'them')) return UI.thieuQuyen('phuLuc', 'them');
    var o = {
        so: DB.soMoi('PL'), ngay: T.today(), donVi: hd.donVi, hopDongId: hd.id, hopDongSo: hd.so,
        donBanId: hd.donBanId || '', khachHangId: hd.khachHangId, khachHang: hd.khachHang, duAn: hd.duAn,
        loai: 'Bổ sung hàng hóa', noiDung: 'Bổ sung hàng hóa cho hợp đồng ' + hd.so,
        nguoiLapId: hd.nguoiLapId || nvId(), nguoiLap: hd.nguoiLap || nvTen(),
        lines: T.clone(hd.lines || []), vatPct: hd.vatPct === undefined ? 10 : hd.vatPct,
        thanhTien: hd.thanhTien, vat: hd.vat, tongCong: hd.tongCong,
        /* Phụ lục thuộc về đúng thương vụ của hợp đồng mẹ — gán mã giao dịch
           ngay lúc tạo để chuỗi chứng từ và mọi báo cáo nhận ra ngay, không
           phải đợi lần nạp trang sau. */
        maGD: hd.maGD || '',
        trangThai: 'Nháp', ghiChu: ''
    };
    DB.insert('phuLuc', o);
    if (done) done(); W.route();
    UI.toast('ok', 'Đã tạo phụ lục ' + o.so, 'Hãy sửa lại nội dung và dòng hàng cho đúng phần điều chỉnh.');
    setTimeout(function () { W.moChungTu('phuLuc', o.id); }, 400);
};

})(window);

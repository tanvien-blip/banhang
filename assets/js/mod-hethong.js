/* ==========================================================================
   TVERP — HỆ THỐNG
   Người dùng · Đơn vị phát hành · Biểu mẫu in · Nhật ký · Thùng rác · Sao lưu
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;

/* Mật khẩu cấp cho MỘT TÀI KHOẢN MỚI khi người quản trị không tự nhập. Đúng
   bằng giá trị Business Engine vẫn dùng — không đổi cơ chế đăng nhập, chỉ
   thôi không HIỂN THỊ mật khẩu của người khác lên màn hình. */
var MK_KHOI_TAO = '123456';

/* ==========================================================================
   NGƯỜI DÙNG
   ========================================================================== */
var VAI_TRO = ['Quản trị hệ thống', 'Quản lý', 'Nhân viên kinh doanh', 'Kế toán', 'Thủ kho', 'Chỉ xem'];

/* ==========================================================================
   BẢO MẬT TÀI KHOẢN — dành cho quản trị hệ thống
   Đặt lại mật khẩu · Khóa / mở tài khoản. Mọi thao tác đều ghi Nhật ký.
   ========================================================================== */
function mkNgauNhien() {
    var c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', s = '';
    for (var i = 0; i < 10; i++) s += c.charAt(Math.floor(Math.random() * c.length));
    return s;
}

/** Quản trị đặt lại mật khẩu cho một tài khoản. */
W.datLaiMatKhau = function (nd, g) {
    if (!Q.co('nguoiDung', 'quanTri')) return UI.thieuQuyen('nguoiDung', 'quanTri');
    var goiY = mkNgauNhien();
    UI.modal({
        size: 'md', title: 'Đặt lại mật khẩu — ' + T.esc(nd.taiKhoan),
        sub: nd.hoTen + (nd.vaiTro ? ' · ' + nd.vaiTro : ''),
        body:
            '<div class="note y mb12"><i class="bi bi-shield-exclamation"></i><div>' +
            'Đặt lại mật khẩu sẽ <b>thay thế mật khẩu hiện tại</b> của người dùng. ' +
            'Hãy báo mật khẩu mới cho họ và yêu cầu đổi lại ngay ở lần đăng nhập đầu tiên.</div></div>' +
            '<div class="grid2">' +
            '<div class="fld req"><label>Mật khẩu mới</label>' +
                '<input type="text" data-f="moi" value="' + goiY + '" autofocus></div>' +
            '<div class="fld req"><label>Nhập lại mật khẩu mới</label>' +
                '<input type="text" data-f="lai" value="' + goiY + '"></div>' +
            '<div class="fld span2"><label>&nbsp;</label>' +
                '<div class="row"><button type="button" class="btn sm" id="btnSinh">' +
                '<i class="bi bi-shuffle"></i> Sinh mật khẩu ngẫu nhiên</button>' +
                '<button type="button" class="btn sm" id="btnChep"><i class="bi bi-clipboard"></i> Sao chép</button>' +
                '<span class="small muted">Tối thiểu 6 ký tự</span></div></div>' +
            '<div class="fld span2"><label class="chk"><input type="checkbox" data-f="batDoi" checked> ' +
                '<span>Bắt buộc người dùng đổi mật khẩu ở lần đăng nhập kế tiếp</span></label></div>' +
            '</div><div id="mkLoi2"></div>',
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } },
            { text: 'Đặt lại mật khẩu', cls: 'primary', icon: 'bi-key-fill', click: function (h) {
                var v = UI.read(h.el);
                var e = h.q('#mkLoi2');
                if (String(v.moi).length < 6) return e.innerHTML = loi('Mật khẩu mới phải từ 6 ký tự trở lên.');
                if (v.moi !== v.lai) return e.innerHTML = loi('Hai lần nhập mật khẩu chưa khớp nhau.');
                var u = DB.get('nguoiDung', nd.id);
                if (!u) return UI.toast('err', 'Không tìm thấy tài khoản');
                u.matKhau = v.moi;
                u.batDoiMatKhau = !!v.batDoi;
                u.doiMatKhauLuc = T.now();
                u.doiMatKhauBoi = DB.user().taiKhoan;
                DB.log('Đặt lại mật khẩu', 'nguoiDung', u);
                DB.save();
                h.close();
                if (g) g.reload(DB.all('nguoiDung'));
                UI.toast('ok', 'Đã đặt lại mật khẩu cho ' + u.taiKhoan,
                    'Mật khẩu mới: ' + v.moi + ' — hãy báo lại cho người dùng.', 8000);
            } }
        ],
        onOpen: function (h) {
            h.q('#btnSinh').onclick = function () {
                var m = mkNgauNhien();
                h.q('[data-f="moi"]').value = m; h.q('[data-f="lai"]').value = m;
                UI.toast('info', 'Đã sinh mật khẩu mới', m);
            };
            h.q('#btnChep').onclick = function () {
                var m = h.q('[data-f="moi"]').value;
                try { navigator.clipboard.writeText(m); UI.toast('ok', 'Đã sao chép mật khẩu'); }
                catch (e) { UI.toast('warn', 'Không sao chép được', 'Mật khẩu: ' + m); }
            };
        }
    });
    function loi(t) { return '<div class="note r mt12"><i class="bi bi-x-circle"></i><div>' + t + '</div></div>'; }
};

/** Khóa hoặc mở khóa một tài khoản đăng nhập. */
W.khoaTaiKhoan = function (nd, g) {
    if (!Q.co('nguoiDung', 'quanTri')) return UI.thieuQuyen('nguoiDung', 'quanTri');
    var dangKhoa = nd.trangThai === 'Khóa';
    if (!dangKhoa && nd.id === DB.user().id)
        return UI.toast('err', 'Không tự khóa được', 'Không thể khóa chính tài khoản đang đăng nhập.');
    UI.confirm({
        title: dangKhoa ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
        icon: dangKhoa ? 'bi-unlock-fill' : 'bi-lock-fill', danger: !dangKhoa,
        message: (dangKhoa ? 'Cho phép <b>' : 'Chặn <b>') + T.esc(nd.taiKhoan) + '</b> đăng nhập vào hệ thống?',
        note: dangKhoa ? 'Người dùng sẽ đăng nhập lại được bằng mật khẩu hiện tại.'
                       : 'Tài khoản vẫn được giữ nguyên cùng toàn bộ dữ liệu, chỉ không đăng nhập được.',
        okText: dangKhoa ? 'Mở khóa' : 'Khóa tài khoản',
        ok: function () {
            var u = DB.get('nguoiDung', nd.id);
            u.trangThai = dangKhoa ? 'Hoạt động' : 'Khóa';
            DB.log(dangKhoa ? 'Mở khóa tài khoản' : 'Khóa tài khoản', 'nguoiDung', u);
            DB.save();
            if (g) g.reload(DB.all('nguoiDung'));
            W.route();
            UI.toast('ok', dangKhoa ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', u.taiKhoan);
        }
    });
};

S['nguoi-dung'] = function (host) {
    W.CRUD(host, {
        title: 'Người dùng', coll: 'nguoiDung', file: 'DanhSach_NguoiDung', copy: false,
        sub: 'Tài khoản đăng nhập và phân quyền theo vai trò',
        crumb: ['Hệ thống', 'Người dùng'],
        search: ['taiKhoan', 'hoTen', 'vaiTro'], mod: 'nguoiDung',
        rows: function () { return DB.all('nguoiDung'); },
        cols: [
            { k: 'taiKhoan', t: 'Tài khoản', w: 148, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'hoTen', t: 'Họ và tên' },
            { k: 'vaiTro', t: 'Vai trò', w: 210, r: function (v, r) {
                var vt = DB.get('vaiTro', r.vaiTroId);
                return '<span class="pill b">' + T.esc(vt ? vt.ten : v) + '</span>' +
                    (vt ? '<div class="small muted">' + Q.demQuyen(vt) + ' quyền</div>' : ''); } },
            { k: 'nhanVienId', t: 'Nhân viên', w: 170, r: function (v) {
                var n = DB.get('nhanVien', v);
                return n ? T.esc(n.hoTen) : '<span class="muted">chưa gắn</span>'; } },
            { k: 'donVi', t: 'Đơn vị', w: 120, r: function (v) { var d = DB.get('donVi', v); return d ? T.esc(d.tat) : v; } },
            { k: 'email', t: 'Thư điện tử', w: 220 },
            { k: 'lanCuoi', t: 'Đăng nhập lần cuối', w: 170 },
            { k: 'trangThai', t: 'Trạng thái', w: 120, r: function (v) { return T.pill(v); } }
        ],
        filters: [{ k: 'vaiTroId', t: 'Vai trò', w: 210, opts: DB.all('vaiTro').map(function (v) { return { v: v.id, t: v.ten }; }) },
                  { k: 'trangThai', t: 'Trạng thái', opts: ['Hoạt động', 'Khóa'] }],
        excel: [{ t: 'Tài khoản', k: 'taiKhoan' }, { t: 'Họ tên', k: 'hoTen', w: 26 }, { t: 'Vai trò', k: 'vaiTro', w: 22 },
                { t: 'Thư điện tử', k: 'email', w: 26 }, { t: 'Điện thoại', k: 'dienThoai' }, { t: 'Trạng thái', k: 'trangThai' }],
        fromExcel: function (r) {
            if (!r['Tài khoản']) return null;
            return { taiKhoan: r['Tài khoản'], hoTen: r['Họ tên'] || '', vaiTro: r['Vai trò'] || 'Chỉ xem',
                email: r['Email'] || '', dienThoai: String(r['Điện thoại'] || ''), donVi: DB.data._meta.ctyId,
                trangThai: r['Trạng thái'] || 'Hoạt động', lanCuoi: '' };
        },
        rules: [{ k: 'taiKhoan' }, { k: 'hoTen' }],
        tbExtra: '<span class="tb-sep"></span>' +
            '<button class="btn" data-datlai disabled><i class="bi bi-key-fill"></i> Đặt lại mật khẩu</button>' +
            '<button class="btn" data-khoatk disabled><i class="bi bi-lock-fill"></i> Khóa / Mở tài khoản</button>',
        actions: function (r) {
            return UI.btn('xem', 'bi-eye', 'Xem chi tiết') +
                (Q.co('nguoiDung', 'sua') ? UI.btn('sua', 'bi-pencil', 'Sửa') : '') +
                (Q.co('nguoiDung', 'quanTri') ? UI.btn('mk', 'bi-key-fill', 'Đặt lại mật khẩu') : '') +
                (Q.co('nguoiDung', 'xoa') ? UI.btn('xoa', 'bi-trash', 'Xóa', 'danger') : '');
        }, actionsW: 128,
        onAction: function (a, r, g) { if (a === 'mk') W.datLaiMatKhau(r, g); },
        nutChon: ['datlai', 'khoatk'],
        bind: function (host, g) {
            var b1 = host.querySelector('[data-datlai]');
            var b2 = host.querySelector('[data-khoatk]');
            if (b1) b1.onclick = function () { var r = g.selected(); if (r) W.datLaiMatKhau(r, g); };
            if (b2) b2.onclick = function () { var r = g.selected(); if (r) W.khoaTaiKhoan(r, g); };
        },
        formSize: 'md',
        form: function (r) {
            return '<div class="grid2">' +
            '<div class="fld req"><label>Tài khoản đăng nhập</label><input data-f="taiKhoan" value="' + T.esc(r.taiKhoan || '') + '"></div>' +
            '<div class="fld"><label>Vai trò</label><select data-f="vaiTroId">' +
                opt(DB.all('vaiTro').map(function (v) { return { v: v.id, t: v.ten }; }), r.vaiTroId) + '</select>' +
                '<div class="small muted" style="margin-top:2px">Quyền của tài khoản do vai trò quyết định — sửa tại <i>Hệ thống → Vai trò &amp; phân quyền</i></div></div>' +
            '<div class="fld req span2"><label>Họ và tên</label><input data-f="hoTen" value="' + T.esc(r.hoTen || '') + '"></div>' +
            '<div class="fld"><label>Thư điện tử</label><input data-f="email" value="' + T.esc(r.email || '') + '"></div>' +
            '<div class="fld"><label>Điện thoại</label><input data-f="dienThoai" value="' + T.esc(r.dienThoai || '') + '"></div>' +
            '<div class="fld"><label>Đơn vị công tác</label><select data-f="donVi">' +
                opt(DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat + ' — ' + d.ten }; }), r.donVi) + '</select></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' + opt(['Hoạt động', 'Khóa'], r.trangThai) + '</select></div>' +
            '<div class="fld span2"><label>Gắn với nhân viên</label><select data-f="nhanVienId">' +
                '<option value="">— Không gắn —</option>' +
                opt(DB.all('nhanVien').map(function (n) { return { v: n.id, t: n.ma + ' — ' + n.hoTen + ' (' + n.chucVu + ')' }; }), r.nhanVienId) +
                '</select><div class="small muted" style="margin-top:2px">Ô “Người lập” trên chứng từ mới sẽ tự điền tên nhân viên này.</div></div>' +
            /* KHÔNG hiển thị mật khẩu đang dùng của người khác. Trước đây ô này
               điền sẵn mật khẩu hiện tại ở dạng chữ thường, tức là ai mở màn
               hình Người dùng cũng đọc được mật khẩu của mọi người. Nay ô để
               trống: bỏ trống thì giữ nguyên mật khẩu cũ, gõ vào thì mới đổi. */
            '<div class="fld span2"><label>Đặt lại mật khẩu</label>' +
                '<input type="password" data-f="matKhau" value="" autocomplete="new-password" ' +
                'placeholder="' + (r && r.id ? 'Để trống nếu không đổi mật khẩu' : 'Nhập mật khẩu cho tài khoản mới') + '">' +
                '<div class="small muted" style="margin-top:2px">Phần mềm không hiển thị mật khẩu ' +
                'đang dùng. Để trống ô này thì mật khẩu cũ được giữ nguyên. Người dùng tự đổi ' +
                'được tại menu tài khoản góc trên bên phải.</div></div>' +
            '</div>';
        },
        toObj: function (v, r) {
            v.lanCuoi = r.lanCuoi || '';
            v.anhDaiDien = r.anhDaiDien || '';
            var vt = DB.get('vaiTro', v.vaiTroId);
            v.vaiTro = vt ? vt.ten : '';
            /* Ô mật khẩu để trống = KHÔNG đổi. Giữ nguyên mật khẩu đang có của
               bản ghi; chỉ tài khoản tạo mới mới nhận mật khẩu khởi tạo. */
            if (!v.matKhau) v.matKhau = (r && r.matKhau) || MK_KHOI_TAO;
            return v;
        },
        check: function (o, r) {
            var d = DB.all('nguoiDung').filter(function (x) { return x.taiKhoan === o.taiKhoan && (!r || x.id !== r.id); });
            return d.length ? 'Tài khoản "' + o.taiKhoan + '" đã tồn tại.' : '';
        },
        ten: function (r) { return r.hoTen + ' (' + r.taiKhoan + ')'; }
    });
};

/* ==========================================================================
   ĐƠN VỊ PHÁT HÀNH
   ========================================================================== */
S['don-vi'] = function (host) {
    W.CRUD(host, {
        title: 'Đơn vị phát hành', coll: 'donVi', file: 'DanhSach_DonViPhatHanh', copy: false,
        sub: 'Bốn pháp nhân dùng chung một cơ sở dữ liệu — chỉ khác thông tin pháp lý, điều khoản chung, người ký, con dấu, doanh thu và lợi nhuận',
        crumb: ['Hệ thống', 'Đơn vị phát hành'],
        search: ['ma', 'ten', 'tat', 'mst'],
        rows: function () { return DB.all('donVi'); },
        tbExtra: '<span class="tb-sep"></span><button class="btn ok" data-chon disabled><i class="bi bi-check2-circle"></i> Đặt làm đơn vị làm việc</button>',
        nutChon: ['chon'],
        bind: function (h, g) {
            h.querySelector('[data-chon]').onclick = function () {
                var r = g.selected(); if (!r) return;
                if (r.id === DB.data._meta.ctyId) return UI.khongThe('Đặt làm đơn vị làm việc',
                    'Đơn vị “' + r.ten + '” đang là đơn vị làm việc hiện tại.',
                    'Chọn một đơn vị khác nếu muốn chuyển.');
                DB.setCty(r.id); W.veBadge(); g.reload(); W.route();
                UI.toast('ok', 'Đã chuyển đơn vị làm việc', r.ten);
            };
        },
        cols: [
            { k: '_lg', t: '', w: 56, sort: false, cls: 'ctr', r: function (v, r) {
                return r.logo ? '<img src="' + r.logo + '" style="width:34px;height:34px;object-fit:contain">' :
                    '<span class="pill n">' + T.esc(r.tat.substr(0, 3)) + '</span>'; } },
            { k: 'tat', t: 'Tên viết tắt', w: 118, r: function (v, r) {
                return '<b>' + T.esc(v) + '</b>' + (DB.data._meta.ctyId === r.id ? ' <span class="pill g">đang dùng</span>' : ''); } },
            { k: 'ten', t: 'Tên đầy đủ' },
            { k: 'mst', t: 'Mã số thuế', w: 128, cls: 'mono' },
            { k: 'dienThoai', t: 'Điện thoại', w: 132 },
            { k: 'daiDien', t: 'Người đại diện', w: 180 },
            { k: 'tienTo', t: 'Tiền tố CT', w: 104, cls: 'mono ctr' }
        ],
        excel: [{ t: 'Mã', k: 'ma' }, { t: 'Tên viết tắt', k: 'tat' }, { t: 'Tên đầy đủ', k: 'ten', w: 52 },
                { t: 'MST', k: 'mst' }, { t: 'Địa chỉ', k: 'diaChi', w: 46 }, { t: 'Điện thoại', k: 'dienThoai' },
                { t: 'Người đại diện', k: 'daiDien', w: 22 }, { t: 'Chức vụ', k: 'chucVu' }, { t: 'Ngân hàng', k: 'nganHang', w: 32 }],
        fromExcel: function (r) {
            if (!r['Tên đầy đủ']) return null;
            return { ma: r['Mã'] || ('DV' + Date.now().toString().slice(-4)), tat: r['Tên viết tắt'] || '',
                ten: r['Tên đầy đủ'], mst: String(r['MST'] || ''), diaChi: r['Địa chỉ'] || '',
                dienThoai: String(r['Điện thoại'] || ''), email: '', website: '', daiDien: r['Người đại diện'] || '',
                chucVu: r['Chức vụ'] || '', nganHang: r['Ngân hàng'] || '', logo: '', mau: '#1e4b8f',
                macDinh: false, tienTo: (r['Tên viết tắt'] || 'XX').substr(0, 3).toUpperCase() };
        },
        rules: [{ k: 'ten' }, { k: 'tat' }],
        form: function (r) {
            return '<div class="grid2">' +
            '<div class="fld req"><label>Tên viết tắt</label><input data-f="tat" value="' + T.esc(r.tat || '') + '"></div>' +
            '<div class="fld"><label>Tiền tố số chứng từ</label><input data-f="tienTo" value="' + T.esc(r.tienTo || '') + '" placeholder="VD: EMC → BGEMC-2026001"></div>' +
            '<div class="fld req span2"><label>Tên đầy đủ</label><input data-f="ten" value="' + T.esc(r.ten || '') + '"></div>' +
            '<div class="fld"><label>Mã số thuế</label><input data-f="mst" value="' + T.esc(r.mst || '') + '"></div>' +
            '<div class="fld"><label>Điện thoại</label><input data-f="dienThoai" value="' + T.esc(r.dienThoai || '') + '"></div>' +
            '<div class="fld span2"><label>Địa chỉ</label><input data-f="diaChi" value="' + T.esc(r.diaChi || '') + '"></div>' +
            '<div class="fld"><label>Thư điện tử</label><input data-f="email" value="' + T.esc(r.email || '') + '"></div>' +
            '<div class="fld"><label>Website</label><input data-f="website" value="' + T.esc(r.website || '') + '"></div>' +
            '<div class="fld"><label>Người đại diện</label><input data-f="daiDien" value="' + T.esc(r.daiDien || '') + '"></div>' +
            '<div class="fld"><label>Chức vụ</label><input data-f="chucVu" value="' + T.esc(r.chucVu || '') + '"></div>' +
            '<div class="fld span2"><label>Tài khoản ngân hàng</label><input data-f="nganHang" value="' + T.esc(r.nganHang || '') + '"></div>' +
            '<div class="fld"><label>Màu nhận diện</label><input data-f="mau" value="' + T.esc(r.mau || '#1e4b8f') + '"></div>' +
            '<div class="fld"></div>' +
            W.oAnhTai({ f: 'logo', gt: r.logo, nhan: 'Logo công ty', rong: true,
                        mo: 'Tải ảnh logo lên TVERP — ảnh được lưu trong phần mềm, không dùng đường dẫn. ' +
                            'Đổi logo thì chứng từ cũ vẫn giữ logo cũ.' }) +
            W.oAnhTai({ f: 'chuKy', gt: r.chuKy, nhan: 'Chữ ký người đại diện', rong: true,
                        mo: 'In trên khối chữ ký của mọi chứng từ thuộc công ty này' }) +
            W.oAnhTai({ f: 'conDau', gt: r.conDau, nhan: 'Con dấu công ty', rong: true,
                        mo: 'In chồng lên khối chữ ký của chứng từ' }) +
            /* Câu chữ dùng chung trên biểu mẫu của chính pháp nhân này. TVERP
               không có thư viện điều khoản riêng: điều khoản chung khai ở đây,
               điều khoản của từng chứng từ sửa bằng nút "Sửa nội dung". */
            '<div class="fld span2"><label>Điều khoản chung in trên chứng từ</label>' +
                '<textarea data-f="dieuKhoanChung" rows="3" placeholder="Câu điều khoản dùng chung cho báo giá, đơn đặt hàng và hợp đồng của công ty này">' +
                T.esc(r.dieuKhoanChung || '') + '</textarea></div>' +
            '<div class="fld span2"><label>Ghi chú cuối chứng từ</label>' +
                '<textarea data-f="ghiChuCuoi" rows="2" placeholder="Dòng ghi chú in ở cuối mọi chứng từ của công ty này">' +
                T.esc(r.ghiChuCuoi || '') + '</textarea></div>' +
            '</div>' +
            '<div class="note b mt12"><i class="bi bi-diagram-3"></i><div>' +
            'Bốn công ty <b>dùng chung một cơ sở dữ liệu</b>: hàng hóa, nhà cung cấp, khách hàng, nhập khẩu, ' +
            'kho, tồn kho, giá vốn và bảng giá đều tập trung. Công ty chỉ khác nhau ở <b>logo, thông tin ' +
            'pháp lý, điều khoản chung, người ký, con dấu, doanh thu và lợi nhuận</b>. ' +
            'Biểu mẫu in là <b>01 biểu mẫu chuẩn duy nhất</b> cho mỗi loại chứng từ, chỉ thay thông tin ' +
            'theo từng công ty.</div></div>' +
            (false
                ? '<div class="card mt12"><div class="card-h">Nhận diện hiện tại</div>' +
                  '<div class="card-b row" style="gap:24px;align-items:flex-end;justify-content:center">' +
                  (r.logo ? '<div class="ctr"><img src="' + r.logo + '" style="max-height:80px"><div class="small muted">Logo</div></div>' : '') +
                  (r.chuKy ? '<div class="ctr"><img src="' + r.chuKy + '" style="max-height:60px"><div class="small muted">Chữ ký</div></div>' : '') +
                  (r.conDau ? '<div class="ctr"><img src="' + r.conDau + '" style="max-height:70px"><div class="small muted">Con dấu</div></div>' : '') +
                  '</div></div>' : '');
        },
        onForm: function (h) { if (W.bindAnhTai) W.bindAnhTai(h.el); },
        toObj: function (v, r) {
            v.ma = r.ma || v.tat.toUpperCase(); v.macDinh = r.macDinh || false;
            /* Kho ảnh và mã phiên bản logo do hệ thống giữ — không đọc từ biểu mẫu. */
            v.anhKho = r.anhKho || {}; v.logoId = r.logoId || '';
            /* KIẾN TRÚC V1.0 — đơn vị phát hành là THAM SỐ ĐIỀU KHIỂN Business Engine.
               Cờ đơn vị nguồn và chính sách giá được khai ở màn hình riêng, biểu mẫu
               này không đọc chúng nên phải bảo toàn, nếu không Engine mất đầu vào. */
            v.laDonViKho = r.laDonViKho || false;
            v.chinhSachGia = r.chinhSachGia ||
                { cotGia: '', ckLoai: '%', ckMuc: 0, lamTron: 0, cachTron: 'gan' };
            return v;
        },
        ten: function (r) { return r.ten; }
    });
};

/* ==========================================================================
   NHẬT KÝ HỆ THỐNG
   ========================================================================== */
S['nhat-ky'] = function (host) {
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Nhật ký hệ thống</h2>' +
        '<div class="sub">Ghi lại mọi thao tác thêm / sửa / xóa trên phần mềm</div></div></div><div id="gh"></div></div>';
    W.crumb(['Hệ thống', 'Nhật ký']);
    var g = new UI.Grid({
        mount: '#gh', rows: DB.all('nhatKy'), pageSize: 30, height: 'calc(100vh - 240px)',
        search: ['viec', 'bang', 'mota', 'ai'],
        toolbar: '<button class="btn primary" data-bcao title="Xem trước · In · Xuất PDF · Xuất Word · Xuất Excel (Biểu mẫu) · Xuất dữ liệu Excel"><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>' +
                 '<button class="btn danger" data-xoa><i class="bi bi-trash"></i> Xóa nhật ký</button>' +
                 '<span class="tb-sep"></span><button class="btn" data-xuat title="Xuất nguyên dữ liệu nhật ký"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>',
        filters: [{ k: 'viec', t: 'Loại thao tác', w: 190, opts: ['Thêm mới', 'Cập nhật', 'Xóa', 'Khôi phục', 'Ghi sổ', 'Chuyển đơn vị làm việc'] }],
        cols: [
            { k: 'luc', t: 'Thời điểm', w: 160, cls: 'mono' },
            { k: 'ai', t: 'Người thực hiện', w: 160 },
            { k: 'viec', t: 'Thao tác', w: 170, r: function (v) {
                var m = { 'Thêm mới': 'g', 'Cập nhật': 'b', 'Xóa': 'r', 'Khôi phục': 'c', 'Ghi sổ': 'g' };
                return '<span class="pill ' + (m[v] || 'n') + '">' + T.esc(v) + '</span>'; } },
            { k: 'bang', t: 'Phân hệ', w: 180 },
            { k: 'mota', t: 'Đối tượng' }
        ],
        actions: false, stt: true
    });
    host.querySelector('[data-xoa]').onclick = function () {
        UI.confirm({ title: 'Xóa nhật ký', danger: true, message: 'Xóa toàn bộ <b>' + DB.all('nhatKy').length + '</b> dòng nhật ký?',
            okText: 'Xóa hết', ok: function () { DB.data.nhatKy = []; DB.save(); W.route(); UI.toast('ok', 'Đã xóa nhật ký'); } });
    };
    host.querySelector('[data-bcao]').onclick = function () {
        W.inBaoCao({
            tieu: 'BÁO CÁO NHẬT KÝ THAO TÁC HỆ THỐNG', thoiDiem: T.today(), file: 'BaoCao_NhatKyHeThong',
            dieuKien: [
                { t: 'Loại thao tác', v: (g.f || {}).viec || 'Tất cả thao tác' },
                { t: 'Từ khóa tìm kiếm', v: g.q || '' }
            ],
            cols: [
                { t: 'Thời điểm', k: 'luc', w: 30 }, { t: 'Người thực hiện', k: 'ai', w: 30 },
                { t: 'Thao tác', k: 'viec', w: 32 }, { t: 'Phân hệ', k: 'bang', w: 32 },
                { t: 'Đối tượng', k: 'mota' }
            ],
            rows: g.allRows, kyTrai: 'NGƯỜI LẬP BIỂU', kyPhai: 'QUẢN TRỊ HỆ THỐNG'
        });
    };
    host.querySelector('[data-xuat]').onclick = function () {
        UI.xuatExcel('NhatKyHeThong', 'Nhật ký', [{ t: 'Thời điểm', k: 'luc', w: 18 }, { t: 'Người dùng', k: 'ai', w: 18 },
            { t: 'Thao tác', k: 'viec', w: 16 }, { t: 'Phân hệ', k: 'bang', w: 20 }, { t: 'Đối tượng', k: 'mota', w: 40 }], g.allRows);
    };
};

/* ==========================================================================
   THÙNG RÁC
   ========================================================================== */
S['thung-rac'] = function (host) {
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Thùng rác</h2>' +
        '<div class="sub">Dữ liệu đã xóa — có thể khôi phục lại hoặc xóa vĩnh viễn</div></div></div><div id="gh"></div></div>';
    W.crumb(['Hệ thống', 'Thùng rác']);
    function rows() { return DB.all('thungRac'); }
    var g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: 25, height: 'calc(100vh - 240px)', search: ['ten', 'bang', 'ai'],
        toolbar: '<button class="btn ok" data-kp disabled><i class="bi bi-arrow-counterclockwise"></i> Khôi phục</button>' +
                 '<button class="btn danger" data-xv disabled><i class="bi bi-trash3"></i> Xóa vĩnh viễn</button>' +
                 '<span class="tb-sep"></span><button class="btn danger" data-donr><i class="bi bi-x-octagon"></i> Dọn sạch thùng rác</button>',
        emptyTitle: 'Thùng rác trống', emptyText: 'Dữ liệu bị xóa sẽ xuất hiện tại đây.',
        cols: [
            { k: 'luc', t: 'Thời điểm xóa', w: 160, cls: 'mono' },
            { k: 'bang', t: 'Phân hệ', w: 190, r: function (v) { return '<span class="pill b">' + T.esc(T.tenBang(v)) + '</span>'; } },
            { k: 'ten', t: 'Đối tượng đã xóa' },
            { k: 'ai', t: 'Người xóa', w: 160 }
        ],
        actions: function () { return UI.btn('kp', 'bi-arrow-counterclockwise', 'Khôi phục', 'ok') + UI.btn('xv', 'bi-trash3', 'Xóa vĩnh viễn', 'danger'); },
        onAction: function (a, r) { a === 'kp' ? kp(r) : xv(r); },
        onSelect: UI.chonToolbar(host, ['kp', 'xv'])
    });
    function kp(r) {
        DB.restore(r.id); g.selId = null; g.reload(rows()); W.route();
        UI.toast('ok', 'Đã khôi phục', r.ten);
    }
    function xv(r) {
        UI.confirm({ title: 'Xóa vĩnh viễn', danger: true, message: 'Xóa vĩnh viễn <b>' + T.esc(r.ten) + '</b>? Không thể hoàn tác.',
            okText: 'Xóa vĩnh viễn', ok: function () {
                DB.data.thungRac = DB.data.thungRac.filter(function (x) { return x.id !== r.id; });
                DB.save(); g.selId = null; g.reload(rows()); W.route(); UI.toast('warn', 'Đã xóa vĩnh viễn', r.ten);
            } });
    }
    host.querySelector('[data-kp]').onclick = function () { var r = g.selected(); if (r) kp(r); };
    host.querySelector('[data-xv]').onclick = function () { var r = g.selected(); if (r) xv(r); };
    host.querySelector('[data-donr]').onclick = function () {
        UI.confirm({ title: 'Dọn sạch thùng rác', danger: true, message: 'Xóa vĩnh viễn toàn bộ <b>' + rows().length + '</b> mục trong thùng rác?',
            okText: 'Dọn sạch', ok: function () { DB.data.thungRac = []; DB.save(); g.reload(rows()); W.route(); UI.toast('ok', 'Đã dọn sạch thùng rác'); } });
    };
};

/* ==========================================================================
   CÀI ĐẶT & SAO LƯU
   ========================================================================== */
S['cai-dat'] = function (host) {
    var m = DB.data._meta;
    var kb = Math.round(JSON.stringify(DB.data).length / 1024);
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Cài đặt</h2>' +
        '<div class="sub">Tùy chọn làm việc, khai báo nền, sao lưu và khôi phục dữ liệu</div></div></div>' +
        '<div class="grid2">' +

        '<div class="card"><div class="card-h"><i class="bi bi-sliders"></i> Tùy chọn làm việc</div><div class="card-b">' +
        '<label class="row mb12" style="cursor:pointer"><input type="checkbox" id="cLoc"' + (m.locTheoCty ? ' checked' : '') + '>' +
        '<span><b>Chỉ hiển thị chứng từ của đơn vị đang làm việc</b><br><small class="muted">Khi tắt, mọi màn hình hiển thị chứng từ của cả 4 đơn vị.</small></span></label>' +
        '<label class="row mb12" style="cursor:pointer"><input type="checkbox" id="cRail"' + (document.body.classList.contains('rail') ? ' checked' : '') + '>' +
        '<span><b>Thu gọn thanh điều hướng</b><br><small class="muted">Mở rộng không gian làm việc.</small></span></label>' +
        '<div class="fld mb12"><label>Số dòng mặc định mỗi trang</label><select id="cSize">' +
        opt([15, 25, 50, 100], m.pageSize || 25) + '</select></div>' +
        '<button class="btn primary" id="btnLuuCd"><i class="bi bi-check-lg"></i> Lưu tùy chọn</button>' +
        '</div></div>' +

        '<div class="card"><div class="card-h"><i class="bi bi-hdd-stack"></i> Tình trạng dữ liệu</div><div class="card-b">' +
        '<dl class="kv">' +
        '<dt>Phiên bản phần mềm</dt><dd>' + T.esc(T.PHIEN_BAN || '') + '</dd>' +
        '<dt>Cấu trúc dữ liệu</dt><dd>' + T.esc(m.phienBan || '1.0') + '</dd>' +
        '<dt>Nơi lưu</dt><dd>LocalStorage của trình duyệt</dd>' +
        '<dt>Dung lượng</dt><dd>' + kb + ' KB</dd>' +
        '<dt>Khách hàng</dt><dd>' + T.num(DB.all('khachHang').length, 0) + '</dd>' +
        '<dt>Hàng hóa</dt><dd>' + T.num(DB.all('hangHoa').length, 0) + ' mã · ' + T.num(DB.all('bangGiaBan').length, 0) + ' bảng giá</dd>' +
        '<dt>Chứng từ</dt><dd>' +
            T.num(DB.all('baoGia').length, 0) + ' báo giá · ' + T.num(DB.all('donBan').length, 0) + ' đơn bán · ' +
            T.num(DB.all('hopDong').length, 0) + ' hợp đồng · ' + T.num(DB.all('phieuXuat').length, 0) + ' phiếu xuất · ' +
            T.num(DB.all('phieuThu').length, 0) + ' phiếu thu</dd>' +
        '<dt>Đơn vị làm việc</dt><dd><b>' + T.esc(DB.cty().ten) + '</b></dd>' +
        '</dl></div></div>' +

        '<div class="card span2"><div class="card-h"><i class="bi bi-list-check"></i> Khai báo nền &amp; công cụ quản trị</div><div class="card-b">' +
        '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>Các danh mục nền dùng chung và công cụ quản trị ' +
        'được gom về đây để thanh điều hướng chỉ giữ đúng các nghiệp vụ chính. ' +
        'Cũng có thể gõ tên chức năng vào ô <b>Tìm nhanh chức năng</b> để mở trực tiếp.</div></div>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px">' +
        (W.MENU_PHU || []).filter(function (x) {
            var p = W.Q.theoRoute(x.r); return !p || W.Q.co(p.k, 'xem');
        }).map(function (x) {
            return '<button class="btn" data-nav="' + x.r + '"><i class="bi ' + x.i + '"></i> ' + T.esc(x.t) + '</button>';
        }).join('') +
        '</div></div></div>' +

        '<div class="card"><div class="card-h"><i class="bi bi-shield-lock-fill"></i> Sao lưu &amp; khôi phục dữ liệu</div><div class="card-b">' +
        '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>Việc sao lưu do phần mềm <b>tự động thực hiện theo lịch</b>. ' +
        'Chỉ cần cấu hình một lần ở màn hình <b>Sao lưu &amp; khôi phục dữ liệu</b>: chu kỳ, số bản giữ lại và nơi lưu. ' +
        'Các lần sau hệ thống tự chạy, tự kiểm tra tính toàn vẹn và tự xóa bản cũ.</div></div>' +
        '<div class="row">' +
        '<button class="btn primary" data-nav="sao-luu"><i class="bi bi-shield-lock-fill"></i> Mở Sao lưu &amp; khôi phục dữ liệu</button>' +
        '<button class="btn" id="btnSaoLuu"><i class="bi bi-download"></i> Tải nhanh một tệp sao lưu</button>' +
        '<button class="btn" id="btnXuatAll"><i class="bi bi-file-earmark-excel"></i> Xuất toàn bộ ra Excel</button>' +
        '</div></div></div>' +

        '<div class="card"><div class="card-h"><i class="bi bi-exclamation-triangle"></i> Vùng nguy hiểm</div><div class="card-b">' +
        '<div class="note y mb12"><i class="bi bi-exclamation-triangle"></i><div>Các thao tác dưới đây ảnh hưởng toàn bộ dữ liệu đang có.</div></div>' +
        '<div class="row">' +
        '<button class="btn ok" id="btnToanVen"><i class="bi bi-shield-check"></i> Kiểm tra toàn vẹn dữ liệu</button>' +
        '<button class="btn" id="btnNapGoc"><i class="bi bi-arrow-repeat"></i> Nạp lại dữ liệu gốc</button>' +
        '<button class="btn danger-solid" id="btnXoaCT"><i class="bi bi-eraser"></i> Xóa toàn bộ chứng từ</button>' +
        '<button class="btn danger-solid" id="btnXoaBG"><i class="bi bi-tags"></i> Xóa toàn bộ bảng giá</button>' +
        '<button class="btn danger-solid" id="btnXoaHet"><i class="bi bi-trash3"></i> Xóa sạch dữ liệu nghiệp vụ</button>' +
        '</div>' +
        '<div class="small muted mt12"><b>Kiểm tra toàn vẹn dữ liệu</b>: rà soát toàn bộ khóa ngoại và liên kết ' +
        'giữa danh mục, chứng từ, kho, giá vốn, bảng giá và công nợ — báo ngay nếu có bản ghi mồ côi.<br>' +
        '<b>Nạp lại dữ liệu gốc</b>: khôi phục về đúng bộ dữ liệu ban đầu (241 khách hàng, 92 mã hàng, chứng từ mẫu).<br>' +
        '<b>Xóa toàn bộ chứng từ</b>: giữ danh mục, xóa mọi báo giá / đơn bán / hợp đồng / phiếu xuất / phiếu thu — để nhập lại từ đầu.<br>' +
        '<b>Xóa toàn bộ bảng giá</b>: xóa mọi phiên bản bảng giá và gỡ tham chiếu bảng giá khỏi khách hàng, chứng từ — ' +
        'dùng khi dọn dữ liệu mẫu để nhập bảng giá thật. Đơn giá đã lưu trên chứng từ <b>không đổi</b>.<br>' +
        '<b>Xóa sạch dữ liệu nghiệp vụ</b>: xóa toàn bộ dữ liệu phát sinh — chứng từ bán · mua · kho · ' +
        'công nợ · <b>đợt góp vốn · giao dịch góp vốn · rút vốn · chia lợi nhuận · phân bổ tiền bán hàng ' +
        'vào nghĩa vụ góp vốn</b> — và các sổ dẫn xuất từ chúng.<br>' +
        '<b>GIỮ NGUYÊN</b> dữ liệu nền: đơn vị · người dùng · nhân viên · vai trò · ' +
        '<b>danh sách cổ đông và tỷ lệ sở hữu</b> · nhóm hàng · đơn vị tính · hãng sản xuất · thuế suất · ' +
        'điều khoản · người ký · loại giá · loại hợp đồng · khoản mục chi · dự án · bảng giá.<br>' +
        'Sau khi xóa, phân hệ Góp vốn cổ đông vẫn còn danh sách cổ đông nhưng mọi số liệu nghiệp vụ ' +
        '(nghĩa vụ phải góp · đã thực góp · đã phân bổ · rút vốn · lợi nhuận đã chia · quỹ vốn quay vòng) ' +
        'đều về 0.</div>' +
        '</div></div>' +

        '</div></div>';
    W.crumb(['Hệ thống', 'Cài đặt & Sao lưu']);

    host.querySelector('#btnLuuCd').onclick = function () {
        m.locTheoCty = host.querySelector('#cLoc').checked;
        m.pageSize = Number(host.querySelector('#cSize').value);
        document.body.classList.toggle('rail', host.querySelector('#cRail').checked);
        try { localStorage.setItem('tverp.rail', host.querySelector('#cRail').checked ? '1' : '0'); } catch (e) { }
        DB.save(); UI.toast('ok', 'Đã lưu tùy chọn');
    };
    /* Tải nhanh một tệp sao lưu — vẫn đi qua đúng bộ máy sao lưu của phần mềm
       (có chữ ký toàn vẹn, có số bản ghi từng bảng) để tệp tải về khôi phục
       được bằng màn hình Sao lưu & khôi phục dữ liệu. */
    var bSL = host.querySelector('#btnSaoLuu');
    if (bSL && !W.Q.co('saoLuu', 'quanTri')) bSL.disabled = true;
    if (bSL) bSL.onclick = function () {
        /* Tệp sao lưu chứa NGUYÊN kho dữ liệu của doanh nghiệp — chỉ vai trò có
           quyền quản trị phân hệ Sao lưu mới được tải về máy. */
        if (!W.Q.co('saoLuu', 'quanTri')) return UI.thieuQuyen('saoLuu', 'quanTri');
        try {
            var g = T.taoGoiSaoLuu('thuCong');
            var kt = T.kiemTraGoiSaoLuu(g);
            if (!kt.duoc) { UI.toast('err', 'Không tạo được tệp sao lưu', kt.loi.join(' · ')); return; }
            T.taiGoiSaoLuu(g);
            UI.toast('ok', 'Đã tải tệp sao lưu',
                T.num(g.soBanGhi) + ' bản ghi · ' + g.soBang + ' bảng dữ liệu');
        } catch (e) { UI.toast('err', 'Không tạo được tệp sao lưu', String(e.message || e)); }
    };
    host.querySelectorAll('[data-nav]').forEach(function (b) {
        b.onclick = function () { W.go(b.getAttribute('data-nav')); };
    });
    host.querySelector('#btnXuatAll').onclick = function () {
        var wb = XLSX.utils.book_new();
        [['khachHang', 'Khach hang'], ['nhaCungCap', 'Nha cung cap'], ['hangHoa', 'Hang hoa'],
 ['bangGiaBan', 'Bang gia'], ['loaiGia', 'Loai gia'], ['tepGoc', 'Tep goc'], ['baoGia', 'Bao gia'], ['donBan', 'Don ban'], ['hopDong', 'Hop dong'],
         ['loNhap', 'Lo nhap'], ['phieuNhap', 'Phieu nhap'], ['phieuXuat', 'Phieu xuat'],
         ['bienBanGiao', 'Bien ban giao'], ['deNghiTT', 'De nghi thanh toan'],
         ['phieuThu', 'Phieu thu'], ['donMua', 'Don mua'], ['phieuChi', 'Phieu chi']].forEach(function (p) {
            var rows = DB.all(p[0]).map(function (r) { var o = {}; Object.keys(r).forEach(function (k) {
                if (k !== 'lines' && k[0] !== '_') o[k] = r[k]; }); return o; });
            if (rows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), p[1]);
        });
        XLSX.writeFile(wb, 'TVERP_ToanBoDuLieu_' + T.today().replace(/-/g, '') + '.xlsx');
        UI.toast('ok', 'Đã xuất toàn bộ dữ liệu ra Excel');
    };
    host.querySelector('#btnNapGoc').onclick = function () {
        UI.confirm({ title: 'Nạp lại dữ liệu gốc', danger: true,
            message: 'Xóa dữ liệu hiện tại và nạp lại bộ dữ liệu ban đầu?',
            note: 'Nên tải tệp sao lưu trước khi thực hiện.', okText: 'Nạp lại', okIcon: 'bi-arrow-repeat',
            ok: function () { DB.nap(); UI.toast('ok', 'Đã nạp lại dữ liệu gốc'); W.veBadge(); W.go('trang-chu'); } });
    };
    host.querySelector('#btnXoaCT').onclick = function () {
        /* KHÔNG CÒN DANH SÁCH VIẾT TAY Ở ĐÂY. Trước đây nút này giữ một mảng 15
           bảng riêng, khác với mảng của nút "Xóa sạch" — hai danh sách song song
           là hai cơ hội để lệch nhau, và đó chính là cách lỗi cũ phát sinh (thiếu
           thẻ kho, thiếu góp vốn). Nay cả hai nút đọc từ ĐÚNG MỘT bảng phân loại
           T.LOAI_BANG của Business Engine. */
        var ds = T.bangXoaChungTu();
        UI.confirm({ title: 'Xóa toàn bộ chứng từ', danger: true,
            message: 'Xóa mọi <b>chứng từ và giao dịch phát sinh</b> — báo giá · đơn bán · hợp đồng · ' +
                     'phiếu xuất · phiếu thu · đơn mua · phiếu chi · lô nhập · phiếu nhập kho · thẻ kho · ' +
                     'kiểm kê · điều chỉnh kho · <b>đợt góp vốn · giao dịch góp vốn · rút vốn · ' +
                     'chia lợi nhuận · phân bổ tiền bán hàng vào nghĩa vụ</b>?',
            note: '<b>GIỮ NGUYÊN</b> toàn bộ danh mục: khách hàng · nhà cung cấp · hàng hóa · kho · ' +
                  'bảng giá · <b>danh sách cổ đông và tỷ lệ sở hữu</b> · người dùng · phân quyền · ' +
                  'các danh mục cấu hình. Thùng rác và Nhật ký cũng được giữ để còn dấu vết truy ngược.<br>' +
                  'Xóa ' + ds.length + ' bảng chứng từ.',
            okText: 'Xóa chứng từ', ok: function () {
                ds.forEach(function (c) { DB.data[c] = []; });
                DB.data._meta.seq = {};
                T.donDemSauXoa();
                DB.save();
                UI.toast('ok', 'Đã xóa toàn bộ chứng từ',
                    'Đã xóa ' + ds.length + ' bảng chứng từ và giao dịch. Danh mục, cổ đông và ' +
                    'tỷ lệ sở hữu được giữ nguyên.', 8000);
                W.go('trang-chu');
            } });
    };
    host.querySelector('#btnToanVen').onclick = function () {
        var kq = T.raSoatToanVen();
        /* Rà thêm chuẩn Customer Master Data: trùng mã số thuế, trùng căn cước,
           thiếu loại khách hàng, mã số thuế sai định dạng… */
        var kqKH = T.raSoatKhachHang();
        kq.tong += kqKH.tong;
        kq.loi = kq.loi.concat(kqKH.loi);
        /* Rà thêm chuẩn Master Data Hàng hóa: một mặt hàng một Mã hàng, Mã hàng
           đúng quy tắc hệ thống, Model bắt buộc, mọi dòng chứng từ gắn ID nội bộ. */
        var kqHH = T.raSoatHangHoa();
        kq.tong += kqHH.tong;
        kq.loi = kq.loi.concat(kqHH.loi);
        /* Đối chiếu thẻ kho với tồn danh mục bằng ID NỘI BỘ. */
        var tk = {};
        T.theKho().forEach(function (x) {
            var k = T.idDong(x); if (!k) return;
            tk[k] = (tk[k] || 0) + x.sl;
        });
        var lechTon = DB.all('hangHoa').filter(function (h) {
            return (tk[h.id] || 0) !== (Number(h.ton) || 0); });
        UI.modal({
            size: 'lg', icon: 'bi-shield-check',
            title: (kq.tong || lechTon.length) ? 'Phát hiện liên kết dữ liệu bị đứt'
                                               : 'Dữ liệu liên kết chặt chẽ, không có lỗi',
            sub: 'Đã rà soát toàn bộ khóa ngoại, dòng hàng, thẻ kho và tồn kho của hệ thống',
            body: (!kq.tong && !lechTon.length)
                ? '<div class="note g"><i class="bi bi-check2-circle"></i><div>' +
                  'Toàn bộ tham chiếu giữa các phân hệ đều trỏ tới bản ghi có thật. ' +
                  'Không có bản ghi mồ côi. Thẻ kho khớp tuyệt đối với tồn kho danh mục.</div></div>'
                : '<div class="note r mb12"><i class="bi bi-exclamation-triangle-fill"></i><div>' +
                  'Có <b>' + T.num(kq.tong + lechTon.length, 0) + '</b> điểm dữ liệu không khớp. ' +
                  'Chi tiết bên dưới.</div></div>' +
                  '<div class="tablewrap"><table class="grid"><thead><tr><th>Phân hệ</th>' +
                  '<th>Trường liên kết</th><th>Trỏ tới</th><th class="ctr" style="width:100px">Số bản ghi</th>' +
                  '<th>Ví dụ</th></tr></thead><tbody>' +
                  kq.loi.map(function (x) {
                      return '<tr><td><b>' + T.esc(x.phanHe) + '</b></td><td class="mono">' +
                          T.esc(x.truong) + '</td><td>' + T.esc(x.troTi) + '</td>' +
                          '<td class="ctr"><span class="pill r">' + T.num(x.so, 0) + '</span></td>' +
                          '<td><span class="ellip">' + T.esc(x.viDu.join(' · ')) + '</span></td></tr>';
                  }).join('') +
                  (lechTon.length ? '<tr><td><b>Hàng hóa</b></td><td class="mono">Tồn kho</td>' +
                      '<td>Thẻ kho</td><td class="ctr"><span class="pill r">' + lechTon.length +
                      '</span></td><td><span class="ellip">' +
                      T.esc(lechTon.slice(0, 4).map(function (h) { return h.ma; }).join(' · ')) +
                      '</span></td></tr>' : '') +
                  '</tbody></table></div>',
            buttons: [{ text: 'Đóng', cls: 'primary', click: function (h) { h.close(); } }]
        });
    };
    host.querySelector('#btnXoaBG').onclick = function () {
        var n = DB.all('bangGiaBan').length;
        var nKH = DB.all('khachHang').filter(function (k) { return k.bangGiaId; }).length;
        var nCT = ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat',
                   'bienBanGiao', 'bienBanNghiemThu'].reduce(function (s2, c) {
            return s2 + DB.all(c).filter(function (x) { return x.bangGiaId; }).length; }, 0);
        if (!n) return UI.toast('info', 'Chưa có bảng giá nào', 'Danh mục Bảng giá đang trống.');
        UI.confirm({
            title: 'Xóa toàn bộ bảng giá', danger: true, icon: 'bi-tags',
            message: 'Xóa <b>' + T.num(n, 0) + '</b> phiên bản bảng giá đang có?',
            note: 'Hệ thống sẽ gỡ tham chiếu bảng giá khỏi <b>' + T.num(nKH, 0) + '</b> khách hàng và <b>' +
                  T.num(nCT, 0) + '</b> chứng từ. <b>Đơn giá, thành tiền, công nợ và tồn kho trên chứng từ ' +
                  'giữ nguyên</b> vì số liệu đã lưu cứng theo từng dòng hàng.<br>' +
                  '<b>Chính sách giá nội bộ nằm trong từng phiên bản bảng giá</b> nên cũng bị xóa theo: ' +
                  'sau thao tác này Engine tạm dùng đúng giá vốn gốc cho mọi đơn vị phát hành, ' +
                  'cho tới khi nạp bảng giá mới và khai lại chính sách.<br>' +
                  'Toàn bộ phiên bản bị xóa được chuyển vào <b>Thùng rác</b>, khôi phục lại được.',
            okText: 'Xóa toàn bộ bảng giá', okIcon: 'bi-trash3',
            ok: function () {
                DB.gopGhi();
                try {
                    DB.all('khachHang').forEach(function (k) { if (k.bangGiaId) k.bangGiaId = ''; });
                    ['baoGia', 'donBan', 'hopDong', 'phuLuc', 'phieuXuat',
                     'bienBanGiao', 'bienBanNghiemThu'].forEach(function (c) {
                        DB.all(c).forEach(function (x) { if (x.bangGiaId) x.bangGiaId = ''; });
                    });
                    DB.all('bangGiaBan').slice().forEach(function (b) { DB.remove('bangGiaBan', b.id); });
                    /* Tệp gốc đã nhập và cấu trúc tệp đã ghi nhớ cũng phải dọn theo. */
                    DB.data.tepGoc = [];
                    DB.data.mauBangGia = [];
                } finally { DB.xongGopGhi(); }
                DB.save();
                var tv = W.canhBaoToanVen ? W.canhBaoToanVen() : { tong: 0 };
                UI.toast('ok', 'Đã xóa toàn bộ bảng giá',
                    T.num(n, 0) + ' phiên bản đã chuyển vào Thùng rác. ' +
                    (tv.tong ? '' : 'Đã rà soát lại toàn bộ liên kết dữ liệu: không có bản ghi mồ côi. ') +
                    'Vào Danh mục → Bảng giá → “Nhập bảng giá từ Excel” để nạp bảng giá thật.', 9000);
                W.go('bang-gia');
            }
        });
    };
    host.querySelector('#btnXoaHet').onclick = function () {
        /* DANH SÁCH BẢNG CẦN XÓA KHÔNG CÒN VIẾT TAY Ở ĐÂY NỮA.
           Trước đây nó là một mảng chữ ngay tại chỗ này; thêm bảng mới vào kho
           dữ liệu mà quên khai vào mảng đó thì bảng mới lặng lẽ sống sót —
           đúng chuyện đã xảy ra với dotGopVon và giaoDichVon. Nay Engine giữ
           MỘT phân loại duy nhất (T.BANG_GIU_KHI_XOA) và tự suy ra phần còn lại. */
        var ds = T.bangXoaNghiepVu();
        var giu = T.BANG_GIU_KHI_XOA;
        UI.confirm({ title: 'Xóa sạch dữ liệu nghiệp vụ', danger: true,
            message: 'Xóa <b>toàn bộ dữ liệu nghiệp vụ</b> — chứng từ, kho, công nợ, ' +
                     'và <b>đợt góp vốn · giao dịch góp vốn · rút vốn · chia lợi nhuận · ' +
                     'phân bổ tiền bán hàng vào nghĩa vụ</b>?',
            note: '<b>GIỮ NGUYÊN:</b> đơn vị · người dùng · nhân viên · vai trò · ' +
                  '<b>danh sách cổ đông và tỷ lệ sở hữu</b> · các danh mục cấu hình nền · ' +
                  'bảng giá (có nút xóa riêng).<br>' +
                  'Xóa ' + ds.length + ' bảng nghiệp vụ, giữ ' + giu.length + ' bảng nền. ' +
                  'Có thể nạp lại dữ liệu gốc bất cứ lúc nào.',
            okText: 'Xóa sạch nghiệp vụ', ok: function () {
                ds.forEach(function (c) { DB.data[c] = []; });
                DB.data._meta.seq = {};
                /* Bộ nhớ đệm dựng từ chính các bảng vừa xóa — bỏ đi để màn hình
                   sau không đọc lại chỉ mục của dữ liệu không còn tồn tại. */
                T.donDemSauXoa();
                DB.save();
                UI.toast('warn', 'Đã xóa sạch dữ liệu nghiệp vụ',
                    'Đã xóa ' + ds.length + ' bảng nghiệp vụ. Danh sách cổ đông, tỷ lệ sở hữu, ' +
                    'người dùng, phân quyền và các danh mục nền được giữ nguyên.', 9000);
                W.go('trang-chu');
            } });
    };
};

})(window);

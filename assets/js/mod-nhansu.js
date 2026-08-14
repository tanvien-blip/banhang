/* ==========================================================================
   TVERP — NHÂN SỰ & PHÂN QUYỀN
   Menu tài khoản (thông tin · đổi mật khẩu · ảnh đại diện · đăng xuất)
   Danh mục Nhân viên · Vai trò và ma trận phân quyền
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {}, opt = W.opt;

/* ==========================================================================
   1. HIỂN THỊ NGƯỜI DÙNG TRÊN THANH TRÊN CÙNG
   ========================================================================== */
W.veNguoiDung = function () {
    var nd = DB.user();
    var av = document.querySelector('#userChip .avatar');
    var chu = (nd.hoTen || '?').split(' ').slice(-2).map(function (x) { return x[0]; }).join('').toUpperCase();
    if (nd.anhDaiDien) {
        av.innerHTML = '<img src="' + nd.anhDaiDien + '" alt="">';
        av.classList.add('has-img');
    } else {
        av.textContent = chu;
        av.classList.remove('has-img');
    }
    document.getElementById('uName').innerHTML =
        T.esc(nd.hoTen) + '<small class="vt">' + T.esc(Q.vaiTro().ten) + '</small>';
};

/* ==========================================================================
   2. MENU TÀI KHOẢN
   ========================================================================== */
W.menuTaiKhoan = function () {
    var cu = document.getElementById('acMenu');
    if (cu) { cu.remove(); return; }
    var nd = DB.user();
    var d = document.createElement('div');
    d.id = 'acMenu';
    d.className = 'ac-menu';
    d.innerHTML =
        '<div class="ac-head">' +
          '<div class="ac-av">' + (nd.anhDaiDien ? '<img src="' + nd.anhDaiDien + '">' :
              T.esc((nd.hoTen || '?').split(' ').slice(-2).map(function (x) { return x[0]; }).join('').toUpperCase())) + '</div>' +
          '<div><b>' + T.esc(nd.hoTen) + '</b><small>' + T.esc(nd.taiKhoan) + ' · ' + T.esc(Q.vaiTro().ten) + '</small></div>' +
        '</div>' +
        '<div class="ac-item" data-ac="tt"><i class="bi bi-person-lines-fill"></i> Thông tin cá nhân</div>' +
        '<div class="ac-item" data-ac="anh"><i class="bi bi-image"></i> Thay đổi ảnh đại diện</div>' +
        '<div class="ac-item" data-ac="mk"><i class="bi bi-key-fill"></i> Đổi mật khẩu</div>' +
        '<div class="ac-item" data-ac="quyen"><i class="bi bi-shield-check"></i> Quyền của tôi</div>' +
        '<div class="ac-sep"></div>' +
        '<div class="ac-item danger" data-ac="out"><i class="bi bi-box-arrow-right"></i> Đăng xuất</div>';
    document.body.appendChild(d);
    var r = document.getElementById('userChip').getBoundingClientRect();
    d.style.top = (r.bottom + 6) + 'px';
    d.style.right = (window.innerWidth - r.right) + 'px';

    d.querySelectorAll('[data-ac]').forEach(function (b) {
        b.onclick = function () {
            var k = b.getAttribute('data-ac');
            d.remove();
            if (k === 'tt') thongTinCaNhan();
            else if (k === 'anh') doiAnh();
            else if (k === 'mk') doiMatKhau();
            else if (k === 'quyen') quyenCuaToi();
            else dangXuat();
        };
    });
    setTimeout(function () {
        document.addEventListener('mousedown', function dong(e) {
            if (!d.contains(e.target) && !e.target.closest('#userChip')) {
                d.remove(); document.removeEventListener('mousedown', dong);
            }
        });
    }, 10);
};

function thongTinCaNhan() {
    var nd = DB.user(), nv = DB.get('nhanVien', nd.nhanVienId);
    UI.modal({
        size: 'md', title: 'Thông tin cá nhân',
        body: '<div class="row mb12" style="gap:16px;align-items:flex-start">' +
            '<div class="ac-av lg">' + (nd.anhDaiDien ? '<img src="' + nd.anhDaiDien + '">' :
                T.esc((nd.hoTen || '?').split(' ').slice(-2).map(function (x) { return x[0]; }).join('').toUpperCase())) + '</div>' +
            '<dl class="kv" style="flex:1">' +
            '<dt>Họ và tên</dt><dd>' + T.esc(nd.hoTen) + '</dd>' +
            '<dt>Tài khoản</dt><dd>' + T.esc(nd.taiKhoan) + '</dd>' +
            '<dt>Vai trò</dt><dd><span class="pill b">' + T.esc(Q.vaiTro().ten) + '</span></dd>' +
            '<dt>Nhân viên</dt><dd>' + (nv ? T.esc(nv.ma + ' — ' + nv.hoTen + ' (' + nv.chucVu + ')') : '<span class="muted">chưa gắn</span>') + '</dd>' +
            '<dt>Phòng ban</dt><dd>' + (nv ? T.esc(nv.phongBan || '—') : '—') + '</dd>' +
            '<dt>Thư điện tử</dt><dd>' + T.esc(nd.email || '—') + '</dd>' +
            '<dt>Điện thoại</dt><dd>' + T.esc(nd.dienThoai || '—') + '</dd>' +
            '<dt>Đơn vị</dt><dd>' + T.esc((DB.get('donVi', nd.donVi) || {}).ten || '—') + '</dd>' +
            '<dt>Đơn vị đang làm việc</dt><dd><b>' + T.esc(DB.cty().ten) + '</b></dd>' +
            '<dt>Đăng nhập lần cuối</dt><dd>' + T.esc(nd.lanCuoi || '—') + '</dd>' +
            '</dl></div>' +
            '<div class="note b"><i class="bi bi-info-circle"></i><div>Muốn sửa họ tên, email, điện thoại: vào ' +
            '<b>Hệ thống → Người dùng</b> (cần quyền quản trị). Ảnh đại diện và mật khẩu đổi được ngay tại đây.</div></div>',
        buttons: [
            { text: 'Đóng', click: function (h) { h.close(); } },
            { text: 'Đổi ảnh đại diện', icon: 'bi-image', click: function (h) { h.close(); doiAnh(); } },
            { text: 'Đổi mật khẩu', cls: 'primary', icon: 'bi-key', click: function (h) { h.close(); doiMatKhau(); } }
        ]
    });
}

function doiMatKhau(batBuoc) {
    var nd = DB.user();
    UI.modal({
        size: 'sm', dismiss: !batBuoc,
        title: batBuoc ? 'Bắt buộc đổi mật khẩu' : 'Đổi mật khẩu',
        sub: nd.hoTen + ' (' + nd.taiKhoan + ')',
        body: (batBuoc ? '<div class="note y mb12"><i class="bi bi-shield-exclamation"></i><div>' +
                'Mật khẩu của anh/chị vừa được quản trị hệ thống đặt lại. ' +
                'Hãy đổi sang mật khẩu riêng trước khi tiếp tục sử dụng.</div></div>' : '') +
            '<div class="fld req mb12"><label>Mật khẩu hiện tại</label>' +
            '<div class="pw"><input type="password" data-f="cu" autofocus><button type="button" class="pw-eye" data-eye><i class="bi bi-eye"></i></button></div></div>' +
            '<div class="fld req mb12"><label>Mật khẩu mới</label>' +
            '<div class="pw"><input type="password" data-f="moi"><button type="button" class="pw-eye" data-eye><i class="bi bi-eye"></i></button></div>' +
            '<div class="small muted" style="margin-top:3px">Tối thiểu 6 ký tự</div></div>' +
            '<div class="fld req mb12"><label>Nhập lại mật khẩu mới</label>' +
            '<div class="pw"><input type="password" data-f="lai"><button type="button" class="pw-eye" data-eye><i class="bi bi-eye"></i></button></div></div>' +
            '<div id="mkLoi"></div>',
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } },
            { text: 'Đổi mật khẩu', cls: 'primary', icon: 'bi-key', click: function (h) {
                var v = UI.read(h.el), loi = '';
                if (v.cu !== (nd.matKhau || '123456')) loi = 'Mật khẩu hiện tại không đúng.';
                else if (!v.moi || v.moi.length < 6) loi = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
                else if (v.moi !== v.lai) loi = 'Hai lần nhập mật khẩu mới không giống nhau.';
                else if (v.moi === v.cu) loi = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
                if (loi) {
                    h.q('#mkLoi').innerHTML = '<div class="note r"><i class="bi bi-exclamation-triangle"></i><div>' + loi + '</div></div>';
                    return;
                }
                nd.matKhau = v.moi;
                nd.batDoiMatKhau = false;
                DB.log('Đổi mật khẩu', 'nguoiDung', nd);
                DB.save();
                h.close();
                UI.toast('ok', 'Đã đổi mật khẩu', 'Lần đăng nhập sau hãy dùng mật khẩu mới.');
            } }
        ],
        onOpen: function (h) {
            h.el.querySelectorAll('[data-eye]').forEach(function (b) {
                b.onclick = function () {
                    var i = b.parentNode.querySelector('input');
                    i.type = i.type === 'password' ? 'text' : 'password';
                    b.innerHTML = '<i class="bi bi-eye' + (i.type === 'text' ? '-slash' : '') + '"></i>';
                };
            });
        }
    });
}

W.doiMatKhau = doiMatKhau;

function doiAnh() {
    var nd = DB.user();
    UI.modal({
        size: 'sm', title: 'Ảnh đại diện',
        body: '<div class="ctr mb12"><div class="ac-av xl" id="xemAnh">' +
            (nd.anhDaiDien ? '<img src="' + nd.anhDaiDien + '">' :
                T.esc((nd.hoTen || '?').split(' ').slice(-2).map(function (x) { return x[0]; }).join('').toUpperCase())) +
            '</div></div>' +
            '<div class="row" style="justify-content:center">' +
            '<button class="btn primary" id="btnChonAnh"><i class="bi bi-upload"></i> Chọn ảnh từ máy</button>' +
            '<button class="btn danger" id="btnBoAnh"' + (nd.anhDaiDien ? '' : ' disabled') + '><i class="bi bi-x-lg"></i> Bỏ ảnh</button>' +
            '</div>' +
            '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>Ảnh được thu nhỏ và lưu ngay trong dữ liệu phần mềm ' +
            '(không cần máy chủ). Nên dùng ảnh vuông, dung lượng nhỏ.</div></div>',
        buttons: [
            { text: 'Hủy', click: function (h) { h.close(); } },
            { text: 'Lưu ảnh', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                nd.anhDaiDien = h._anh === undefined ? nd.anhDaiDien : h._anh;
                DB.log('Đổi ảnh đại diện', 'nguoiDung', nd); DB.save();
                W.veNguoiDung(); h.close();
                UI.toast('ok', 'Đã cập nhật ảnh đại diện');
            } }
        ],
        onOpen: function (h) {
            h.q('#btnChonAnh').onclick = function () {
                var i = document.createElement('input');
                i.type = 'file'; i.accept = 'image/*';
                i.onchange = function () {
                    var f = i.files[0]; if (!f) return;
                    var fr = new FileReader();
                    fr.onload = function (e) {
                        var img = new Image();
                        img.onload = function () {
                            // thu nhỏ về 128×128 để tiết kiệm bộ nhớ
                            var c = document.createElement('canvas'), s = 128;
                            c.width = c.height = s;
                            var ctx = c.getContext('2d');
                            var m = Math.min(img.width, img.height);
                            ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
                            h._anh = c.toDataURL('image/jpeg', 0.85);
                            h.q('#xemAnh').innerHTML = '<img src="' + h._anh + '">';
                            h.q('#btnBoAnh').disabled = false;
                        };
                        img.src = e.target.result;
                    };
                    fr.readAsDataURL(f);
                };
                i.click();
            };
            h.q('#btnBoAnh').onclick = function () {
                h._anh = '';
                h.q('#xemAnh').textContent = (DB.user().hoTen || '?').split(' ').slice(-2)
                    .map(function (x) { return x[0]; }).join('').toUpperCase();
                h.q('#btnBoAnh').disabled = true;
            };
        }
    });
}

function quyenCuaToi() {
    var vt = Q.vaiTro();
    UI.modal({
        size: 'xl', title: 'Quyền của tôi — vai trò ' + vt.ten,
        sub: vt.moTa || '',
        body: maTranQuyen(vt, true),
        buttons: [{ text: 'Đóng', cls: 'primary', click: function (h) { h.close(); } }]
    });
}

function dangXuat() {
    UI.confirm({
        title: 'Đăng xuất', icon: 'bi-box-arrow-right',
        message: 'Đăng xuất khỏi tài khoản <b>' + T.esc(DB.user().hoTen) + '</b>?',
        note: 'Dữ liệu đã nhập vẫn được giữ nguyên trong máy.',
        okText: 'Đăng xuất', okIcon: 'bi-box-arrow-right',
        ok: function () {
            DB._user = null;
            document.getElementById('shell').classList.add('hide');
            document.getElementById('manHinhDangNhap').style.display = 'flex';
            document.getElementById('uMk').value = '';
            document.getElementById('uTen').focus();
            UI.toast('info', 'Đã đăng xuất');
        }
    });
}

/* ==========================================================================
   3. DANH MỤC NHÂN VIÊN
   ========================================================================== */
var PHONG_BAN = ['Ban Giám đốc', 'Phòng Kinh doanh', 'Phòng Kỹ thuật', 'Phòng Kế toán', 'Kho vận', 'Hành chính'];

S['nhan-vien'] = function (host) {
    W.CRUD(host, {
        title: 'Nhân viên', coll: 'nhanVien', mod: 'nhanVien', file: 'DanhSach_NhanVien', copy: false,
        sub: 'Danh mục dùng chung cho trường “Người lập” trên toàn bộ chứng từ — khai báo không giới hạn số lượng',
        crumb: ['Hệ thống', 'Nhân viên'],
        search: ['ma', 'hoTen', 'chucVu', 'phongBan', 'dienThoai'],
        rows: function () {
            return DB.all('nhanVien').map(function (n) {
                n._ct = ['baoGia', 'donBan', 'hopDong', 'phieuXuat', 'phieuThu', 'phieuChi', 'donMua']
                    .reduce(function (s, c) {
                        return s + DB.all(c).filter(function (x) { return x.nguoiLapId === n.id; }).length;
                    }, 0);
                n._ds = T.sum(DB.all('donBan').filter(function (x) {
                    return x.nguoiLapId === n.id && x.trangThai !== 'Nháp' && x.trangThai !== 'Đã hủy';
                }), function (x) { return x.tongCong; });
                return n;
            });
        },
        cols: [
            { k: 'ma', t: 'Mã NV', w: 92, cls: 'mono' },
            { k: 'hoTen', t: 'Họ và tên', r: function (v, r) {
                return '<b>' + T.esc(v) + '</b>' + (r.taiKhoanId ? ' <i class="bi bi-person-badge" title="Đã gắn tài khoản đăng nhập" style="color:var(--brand)"></i>' : '') +
                    '<div class="small muted">' + T.esc(r.chucVu || '') + '</div>'; } },
            { k: 'phongBan', t: 'Phòng ban', w: 178 },
            { k: 'donVi', t: 'Đơn vị', w: 108, r: function (v) { var d = DB.get('donVi', v); return d ? T.esc(d.tat) : '<span class="muted">—</span>'; } },
            { k: 'dienThoai', t: 'Điện thoại', w: 126 },
            { k: '_ct', t: 'Số chứng từ', w: 116, cls: 'num', fmt: 'num', total: true },
            { k: '_ds', t: 'Doanh số lập', w: 150, cls: 'num', fmt: 'money', total: true },
            { k: 'trangThai', t: 'Trạng thái', w: 148, r: function (v) {
                return '<span class="pill ' + (v === 'Đang làm việc' ? 'g' : 'n') + '">' + T.esc(v) + '</span>'; } }
        ],
        filters: [
            { k: 'phongBan', t: 'Phòng ban', w: 190, opts: PHONG_BAN },
            { k: 'donVi', t: 'Đơn vị', w: 170, opts: DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat }; }) },
            { k: 'trangThai', t: 'Trạng thái', w: 170, opts: ['Đang làm việc', 'Ngừng làm việc'] }
        ],
        tbExtra: '<span class="tb-sep"></span>' +
            '<button class="btn" data-khoanv disabled><i class="bi bi-lock"></i> Khóa / Mở nhân viên</button>',
        bind: function (h, g) {
            var b = h.querySelector('[data-khoanv]');
            if (!b) return;
            if (!Q.co('nhanVien', 'sua')) { b.remove(); return; }
            b.onclick = function () {
                var r = g.selected(); if (!r) return;
                var dang = r.trangThai === 'Đang làm việc';
                UI.confirm({
                    title: dang ? 'Ngừng sử dụng nhân viên' : 'Cho nhân viên hoạt động lại',
                    danger: dang, icon: dang ? 'bi-lock-fill' : 'bi-unlock-fill',
                    message: (dang ? 'Chuyển <b>' : 'Cho phép <b>') + T.esc(r.hoTen) + '</b> ' +
                        (dang ? 'sang trạng thái Ngừng làm việc?' : 'hoạt động trở lại?'),
                    note: dang ? 'Nhân viên đã ngừng sẽ <b>không xuất hiện</b> trong ô Người lập khi tạo chứng từ mới, ' +
                                 'nhưng các chứng từ cũ vẫn giữ nguyên tên người lập.' : '',
                    okText: dang ? 'Ngừng sử dụng' : 'Kích hoạt lại',
                    ok: function () {
                        r.trangThai = dang ? 'Ngừng làm việc' : 'Đang làm việc';
                        DB.log('Cập nhật', 'nhanVien', r); DB.save(); g.reload(); W.route();
                        UI.toast('ok', dang ? 'Đã ngừng sử dụng nhân viên' : 'Đã kích hoạt lại', r.hoTen);
                    }
                });
            };
        },
        nutChon: ['khoanv'],
        onSelect: function (r) {
            var b = document.querySelector('#ws [data-khoanv]');
            if (b && r) b.innerHTML = r.trangThai === 'Đang làm việc'
                ? '<i class="bi bi-lock"></i> Ngừng sử dụng' : '<i class="bi bi-unlock"></i> Kích hoạt lại';
        },
        excel: [
            { t: 'Mã NV', k: 'ma', w: 12 }, { t: 'Họ và tên', k: 'hoTen', w: 28 },
            { t: 'Chức vụ', k: 'chucVu', w: 24 }, { t: 'Phòng ban', k: 'phongBan', w: 20 },
            { t: 'Đơn vị', k: 'donVi', w: 12 }, { t: 'Điện thoại', k: 'dienThoai', w: 14 },
            { t: 'Thư điện tử', k: 'email', w: 26 }, { t: 'Ngày vào làm', k: 'ngayVao', w: 14 },
            { t: 'Trạng thái', k: 'trangThai', w: 18 }
        ],
        fromExcel: function (r) {
            if (!r['Họ và tên']) return null;
            return { ma: r['Mã NV'] || W.nextMa('nhanVien', 'NV'), hoTen: r['Họ và tên'],
                chucVu: r['Chức vụ'] || '', phongBan: r['Phòng ban'] || '', donVi: r['Đơn vị'] || DB.data._meta.ctyId,
                dienThoai: String(r['Điện thoại'] || ''), email: r['Email'] || '', taiKhoanId: '',
                ngayVao: r['Ngày vào làm'] || T.today(), ghiChu: '',
                trangThai: r['Trạng thái'] || 'Đang làm việc' };
        },
        rules: [{ k: 'ma' }, { k: 'hoTen' }],
        formSize: 'md',
        form: function (r) {
            return '<div class="grid2">' +
            '<div class="fld req"><label>Mã nhân viên</label><input data-f="ma" value="' + T.esc(r.ma || W.nextMa('nhanVien', 'NV')) + '"></div>' +
            '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' +
                opt(['Đang làm việc', 'Ngừng làm việc'], r.trangThai) + '</select></div>' +
            '<div class="fld req span2"><label>Họ và tên</label><input data-f="hoTen" value="' + T.esc(r.hoTen || '') + '"></div>' +
            '<div class="fld"><label>Chức vụ</label><input data-f="chucVu" value="' + T.esc(r.chucVu || '') + '"></div>' +
            '<div class="fld"><label>Phòng ban</label><select data-f="phongBan">' + opt(PHONG_BAN, r.phongBan) + '</select></div>' +
            '<div class="fld"><label>Đơn vị công tác</label><select data-f="donVi">' +
                opt(DB.all('donVi').map(function (d) { return { v: d.id, t: d.tat + ' — ' + d.ten }; }), r.donVi || DB.data._meta.ctyId) + '</select></div>' +
            '<div class="fld"><label>Ngày vào làm</label><input type="date" data-f="ngayVao" value="' + T.esc(r.ngayVao || T.today()) + '"></div>' +
            '<div class="fld"><label>Điện thoại</label><input data-f="dienThoai" value="' + T.esc(r.dienThoai || '') + '"></div>' +
            '<div class="fld"><label>Thư điện tử</label><input data-f="email" value="' + T.esc(r.email || '') + '"></div>' +
            '<div class="fld span2"><label>Tài khoản đăng nhập gắn kèm</label><select data-f="taiKhoanId">' +
                '<option value="">— Không gắn tài khoản —</option>' +
                opt(DB.all('nguoiDung').map(function (u) { return { v: u.id, t: u.taiKhoan + ' — ' + u.hoTen }; }), r.taiKhoanId) +
                '</select><div class="small muted" style="margin-top:2px">Khi người này đăng nhập, ô “Người lập” trên chứng từ mới sẽ tự điền tên họ.</div></div>' +
            '<div class="fld span2"><label>Ghi chú</label><textarea data-f="ghiChu" rows="2">' + T.esc(r.ghiChu || '') + '</textarea></div>' +
            '</div>' + (r.id ? hieuQuaBox(r) : '');
        },
        toObj: function (v) { return v; },
        check: function (o, r) {
            var d = DB.all('nhanVien').filter(function (x) { return x.ma === o.ma && (!r || x.id !== r.id); });
            return d.length ? 'Mã nhân viên "' + o.ma + '" đã tồn tại.' : '';
        },
        ten: function (r) { return r.hoTen; }
    });
};

function hieuQuaBox(nv) {
    var d = W.hieuQuaNhanVien(nv.id);
    return '<div class="card mt16"><div class="card-h"><i class="bi bi-graph-up"></i> Hiệu quả làm việc</div>' +
        '<div class="card-b"><div class="grid4">' +
        kp('Báo giá đã lập', T.num(d.soBG, 0) + ' phiếu') +
        kp('Tỷ lệ chốt báo giá', d.soBG ? T.num(d.bgChot / d.soBG * 100, 1) + '%' : '—', 'c') +
        kp('Đơn bán', T.num(d.soDB, 0) + ' đơn') +
        kp('Doanh số', T.money(d.doanhSo) + ' đ', 'g') +
        kp('Hợp đồng', T.num(d.soHD, 0) + ' hợp đồng') +
        kp('Giá trị hợp đồng', T.money(d.giaTriHD) + ' đ') +
        kp('Đã thu về', T.money(d.daThu) + ' đ', 'g') +
        kp('Còn phải thu', T.money(d.doanhSo - d.daThu) + ' đ', d.doanhSo - d.daThu > 0 ? 'r' : 'g') +
        '</div></div></div>';
}
function kp(l, v, c) {
    return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div><div class="vl" style="font-size:16px">' + v + '</div></div>';
}

/** Thống kê hiệu quả của một nhân viên (dùng cho cả màn hình nhân viên và báo cáo). */
W.hieuQuaNhanVien = function (nvId, tu, den) {
    function loc(arr) {
        return arr.filter(function (x) {
            return x.nguoiLapId === nvId && (!tu || x.ngay >= tu) && (!den || x.ngay <= den);
        });
    }
    var bg = loc(DB.all('baoGia'));
    var db = loc(DB.all('donBan')).filter(function (x) { return x.trangThai !== 'Nháp' && x.trangThai !== 'Đã hủy'; });
    var hd = loc(DB.all('hopDong'));
    var pt = loc(DB.all('phieuThu')).filter(function (x) { return x.trangThai === 'Đã ghi sổ'; });
    return {
        soBG: bg.length, giaTriBG: T.sum(bg, function (x) { return x.tongCong; }),
        bgChot: bg.filter(function (x) { return x.trangThai === 'Đã chốt'; }).length,
        soDB: db.length, doanhSo: T.sum(db, function (x) { return x.tongCong; }),
        soHD: hd.length, giaTriHD: T.sum(hd, function (x) { return x.tongCong; }),
        daThu: T.sum(pt, function (x) { return x.soTien; })
    };
};

/* ==========================================================================
   4. VAI TRÒ & MA TRẬN PHÂN QUYỀN
   ========================================================================== */
function maTranQuyen(vt, chiXem) {
    var nhom = {}, thuTu = [];
    Q.PHAN_HE.forEach(function (p) {
        if (!nhom[p.nhom]) { nhom[p.nhom] = []; thuTu.push(p.nhom); }
        nhom[p.nhom].push(p);
    });
    var h = '<div class="tablewrap" style="max-height:calc(100vh - 300px)"><table class="grid pq"><thead><tr>' +
        '<th style="min-width:210px;position:sticky;left:0;z-index:6;background:var(--head)">Phân hệ</th>';
    Q.HANH_DONG.forEach(function (a) {
        h += '<th class="ctr" title="' + T.esc(a.mo) + '" style="width:62px"><span class="pq-h">' + T.esc(a.t) + '</span>' +
             (chiXem ? '' : '<div><input type="checkbox" data-cot="' + a.k + '" title="Chọn / bỏ cả cột"></div>') + '</th>';
    });
    h += '</tr></thead><tbody>';
    thuTu.forEach(function (n) {
        h += '<tr class="pq-nhom"><td colspan="' + (Q.HANH_DONG.length + 1) + '"><b>' + T.esc(n) + '</b></td></tr>';
        nhom[n].forEach(function (p) {
            var q = (vt.quyen || {})[p.k] || {};
            h += '<tr><td style="position:sticky;left:0;background:#fff;z-index:4">' + T.esc(p.t) +
                 (chiXem ? '' : ' <input type="checkbox" data-dong="' + p.k + '" title="Chọn / bỏ cả dòng" style="margin-left:6px">') + '</td>';
            Q.HANH_DONG.forEach(function (a) {
                if (p.ap.indexOf(a.k) < 0) { h += '<td class="ctr muted" style="background:#fafbfd">–</td>'; return; }
                h += '<td class="ctr">' + (chiXem
                    ? (q[a.k] ? '<i class="bi bi-check-circle-fill" style="color:var(--ok)"></i>'
                              : '<i class="bi bi-dash" style="color:#cbd5e1"></i>')
                    : '<input type="checkbox" data-q="' + p.k + '|' + a.k + '"' + (q[a.k] ? ' checked' : '') + '>') + '</td>';
            });
            h += '</tr>';
        });
    });
    h += '</tbody></table></div>';
    return h;
}

S['vai-tro'] = function (host) {
    var qSua = Q.co('vaiTro', 'sua'), qThem = Q.co('vaiTro', 'them'), qXoa = Q.co('vaiTro', 'xoa');
    host.innerHTML = '<div class="page"><div class="page-head"><div><h2>Vai trò &amp; phân quyền</h2>' +
        '<div class="sub">Mô hình <b>Người dùng → Vai trò → Quyền</b>: mỗi vai trò được cấp quyền chi tiết theo từng phân hệ × từng hành động</div></div></div>' +
        '<div class="note b mb12"><i class="bi bi-diagram-2"></i><div>' +
        'Một người dùng thuộc <b>một vai trò</b>. Vai trò quyết định người đó thấy phân hệ nào trên menu, ' +
        'bấm được nút nào, có xem được <b>giá vốn / lợi nhuận</b> hay không, có được <b>duyệt</b> và <b>khóa chứng từ</b> hay không.' +
        '</div></div><div id="gh"></div></div>';
    W.crumb(['Hệ thống', 'Vai trò & phân quyền']);

    function rows() {
        return DB.all('vaiTro').map(function (v) {
            v._nd = DB.all('nguoiDung').filter(function (u) { return u.vaiTroId === v.id; }).length;
            v._sq = Q.demQuyen(v);
            return v;
        });
    }

    var g = new UI.Grid({
        mount: '#gh', rows: rows(), pageSize: 20, height: 'calc(100vh - 330px)', search: ['ma', 'ten', 'moTa'],
        toolbar:
            '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Thêm vai trò</button>' +
            '<button class="btn" data-sua disabled><i class="bi bi-shield-lock"></i> Phân quyền</button>' +
            '<button class="btn" data-chep disabled><i class="bi bi-files"></i> Nhân bản</button>' +
            '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
            '<span class="tb-sep"></span>' +
            '<button class="btn" data-xuat><i class="bi bi-file-earmark-excel"></i> Xuất ma trận quyền</button>',
        cols: [
            { k: 'ma', t: 'Mã vai trò', w: 130, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'ten', t: 'Tên vai trò', w: 220 },
            { k: 'moTa', t: 'Mô tả', r: function (v) { return '<span class="ellip">' + T.esc(v) + '</span>'; } },
            { k: '_nd', t: 'Người dùng', w: 116, cls: 'num', fmt: 'num' },
            { k: '_sq', t: 'Số quyền bật', w: 130, cls: 'num', fmt: 'num' },
            { k: 'heThong', t: 'Loại', w: 150, r: function (v) {
                return v ? '<span class="pill r">Vai trò hệ thống</span>' : '<span class="pill n">Tự khai báo</span>'; } }
        ],
        actions: function (r) { return UI.btn('sua', 'bi-shield-lock', 'Phân quyền') + UI.btn('xem', 'bi-eye', 'Xem quyền'); },
        actionsW: 78,
        onAction: function (a, r) { a === 'xem' ? xemQuyen(r) : phanQuyen(r); },
        onSelect: UI.chonToolbar(host, ['sua', 'xoa', 'chep']),
        onOpen: function (r) { phanQuyen(r); }
    });
    UI.apQuyen(host, 'vaiTro');

    var qs = function (s) { return host.querySelector(s); };
    if (qs('[data-them]')) qs('[data-them]').onclick = function () { phanQuyen(null); };
    if (qs('[data-sua]')) qs('[data-sua]').onclick = function () { var r = g.selected(); if (r) phanQuyen(r); };
    if (qs('[data-chep]')) qs('[data-chep]').onclick = function () {
        var r = g.selected(); if (!r) return;
        var c = T.clone(r); delete c.id; c.ma = c.ma + '_2'; c.ten = c.ten + ' (bản sao)'; c.heThong = false;
        phanQuyen(c, true);
    };
    if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () {
        var r = g.selected(); if (!r) return;
        UI.xoaChuan({ coll: 'vaiTro', rec: r, mod: 'vaiTro', ten: 'Vai trò ' + r.ten,
            sauKhi: function () { g.selId = null; g.reload(rows()); W.route(); } });
    };
    if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
        var cols = [{ t: 'Nhóm', k: 'nhom', w: 20 }, { t: 'Phân hệ', k: 'phanHe', w: 24 }]
            .concat(DB.all('vaiTro').map(function (v) { return { t: v.ten, k: v.id, w: 22 }; }));
        var rs = [];
        Q.PHAN_HE.forEach(function (p) {
            Q.HANH_DONG.forEach(function (a) {
                if (p.ap.indexOf(a.k) < 0) return;
                var o = { nhom: p.nhom, phanHe: p.t + ' — ' + a.t };
                DB.all('vaiTro').forEach(function (v) {
                    o[v.id] = ((v.quyen || {})[p.k] || {})[a.k] ? 'x' : '';
                });
                rs.push(o);
            });
        });
        UI.xuatExcel('MaTranPhanQuyen', 'Phân quyền', cols, rs);
    };

    function xemQuyen(r) {
        UI.modal({
            size: 'xl', title: 'Quyền của vai trò ' + r.ten, sub: r.moTa || '',
            body: maTranQuyen(r, true),
            buttons: [{ text: 'Đóng', click: function (h) { h.close(); } }]
                .concat(qSua ? [{ text: 'Sửa phân quyền', cls: 'primary', icon: 'bi-shield-lock',
                                  click: function (h) { h.close(); phanQuyen(r); } }] : [])
        });
    }

    function phanQuyen(r, laChep) {
        var moi = !r || !r.id;
        if (moi && !qThem) return UI.thieuQuyen('vaiTro', 'them');
        if (!moi && !qSua) return xemQuyen(r);
        var vt = r ? T.clone(r) : { ma: '', ten: '', moTa: '', heThong: false, quyen: {} };
        UI.modal({
            size: 'full', dismiss: false,
            title: moi ? 'Thêm vai trò mới' : 'Phân quyền — ' + vt.ten,
            sub: 'Tích vào ô giao giữa phân hệ và hành động để cấp quyền. Dấu “–” nghĩa là hành động không áp dụng cho phân hệ đó.',
            body: '<div class="grid3 mb12">' +
                '<div class="fld req"><label>Mã vai trò</label><input data-f="ma" value="' + T.esc(vt.ma) + '"' + (vt.heThong ? ' disabled' : '') + '></div>' +
                '<div class="fld req"><label>Tên vai trò</label><input data-f="ten" value="' + T.esc(vt.ten) + '"></div>' +
                '<div class="fld"><label>Mô tả ngắn</label><input data-f="moTa" value="' + T.esc(vt.moTa || '') + '"></div>' +
                '</div>' +
                '<div class="row mb8">' +
                '<button class="btn sm" data-mau="tatca"><i class="bi bi-check-all"></i> Cấp toàn quyền</button>' +
                '<button class="btn sm" data-mau="nghiepvu"><i class="bi bi-briefcase"></i> Toàn quyền nghiệp vụ</button>' +
                '<button class="btn sm" data-mau="xem"><i class="bi bi-eye"></i> Chỉ xem + in</button>' +
                '<button class="btn sm danger" data-mau="xoa"><i class="bi bi-x-circle"></i> Bỏ hết quyền</button>' +
                '<span class="muted small" style="margin-left:auto" id="demQ"></span></div>' +
                maTranQuyen(vt, false),
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Lưu phân quyền', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                    if (!UI.validate(h.el, [{ k: 'ma' }, { k: 'ten' }])) return;
                    var v = UI.read(h.el);
                    var q = {};
                    h.el.querySelectorAll('[data-q]').forEach(function (c) {
                        if (!c.checked) return;
                        var p = c.getAttribute('data-q').split('|');
                        (q[p[0]] = q[p[0]] || {})[p[1]] = true;
                    });
                    var o = { ma: v.ma, ten: v.ten, moTa: v.moTa, heThong: vt.heThong || false, quyen: q };
                    if (moi || laChep) DB.insert('vaiTro', o); else DB.update('vaiTro', r.id, o);
                    // đồng bộ tên vai trò sang người dùng
                    DB.all('nguoiDung').forEach(function (u) {
                        if (u.vaiTroId === (r ? r.id : o.id)) u.vaiTro = o.ten;
                    });
                    DB.save();
                    h.close(); g.reload(rows()); W.route(); W.veNguoiDung();
                    UI.toast('ok', moi ? 'Đã thêm vai trò' : 'Đã lưu phân quyền',
                        o.ten + ' — ' + Q.demQuyen(o) + ' quyền được bật');
                } }
            ],
            onOpen: function (h) {
                function dem() {
                    h.q('#demQ').textContent = h.el.querySelectorAll('[data-q]:checked').length + ' quyền đang bật';
                }
                h.el.querySelectorAll('[data-q]').forEach(function (c) { c.onchange = dem; });
                h.el.querySelectorAll('[data-cot]').forEach(function (c) {
                    c.onchange = function () {
                        h.el.querySelectorAll('[data-q$="|' + c.getAttribute('data-cot') + '"]')
                            .forEach(function (x) { x.checked = c.checked; });
                        dem();
                    };
                });
                h.el.querySelectorAll('[data-dong]').forEach(function (c) {
                    c.onchange = function () {
                        h.el.querySelectorAll('[data-q^="' + c.getAttribute('data-dong') + '|"]')
                            .forEach(function (x) { x.checked = c.checked; });
                        dem();
                    };
                });
                h.el.querySelectorAll('[data-mau]').forEach(function (b) {
                    b.onclick = function () {
                        var m = b.getAttribute('data-mau');
                        h.el.querySelectorAll('[data-q]').forEach(function (c) {
                            var p = c.getAttribute('data-q').split('|'), mod = p[0], act = p[1];
                            var ph = Q.theoMa(mod);
                            if (m === 'tatca') c.checked = true;
                            else if (m === 'xoa') c.checked = false;
                            else if (m === 'nghiepvu') c.checked = act !== 'quanTri';
                            else if (m === 'xem') c.checked = ['xem', 'in', 'pdf', 'baoCao'].indexOf(act) >= 0;
                        });
                        dem();
                        UI.toast('info', 'Đã áp dụng mẫu quyền', b.textContent.trim());
                    };
                });
                dem();
            }
        });
    }
};

})(window);

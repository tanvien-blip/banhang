/* ==========================================================================
   TVERP — THAO TÁC HÀNG LOẠT
   Khối dùng chung cho MỌI màn hình danh sách: chọn nhiều dòng rồi xóa / sửa /
   đổi trạng thái / duyệt / hủy duyệt / in / xuất PDF / xuất Excel / gán người lập.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q;

/**
 * Gắn thanh thao tác hàng loạt vào một bảng dữ liệu.
 * cfg = {
 *   mod, coll, dt,                       // phân hệ, bảng dữ liệu, tên chứng từ
 *   trangThai: [...],                    // danh sách trạng thái cho đổi hàng loạt
 *   duyetTT, huyDuyetTT,                 // trạng thái khi duyệt / hủy duyệt
 *   suaTruong: [{k,t,type,opts}],        // các trường được phép sửa hàng loạt
 *   excel: [...],                        // cột xuất Excel
 *   inCT: true,                          // có in chứng từ hàng loạt không
 *   nguoiLap: true,                      // có gán lại người lập không
 *   sauKhiDoi: function()                // gọi lại sau khi dữ liệu thay đổi
 * }
 */
W.hangLoat = function (host, g, cfg) {
    var bar = g.tb && g.tb.querySelector('[data-bulkbar]');
    if (!bar) return;
    var mod = cfg.mod, coll = cfg.coll || cfg.mod;
    var qSua = Q.co(mod, 'sua'), qXoa = Q.co(mod, 'xoa'), qDuyet = Q.co(mod, 'duyet'),
        qIn = Q.co(mod, 'in'), qPdf = Q.co(mod, 'pdf'), qXls = Q.co(mod, 'excelXuat');

    function nut(k, ico, ten, hien, cls) {
        return hien ? '<button class="btn sm ' + (cls || '') + '" data-bl="' + k + '" disabled>' +
            '<i class="bi ' + ico + '"></i> ' + ten + '</button>' : '';
    }

    bar.innerHTML =
        '<span class="bl-count" data-bulkcount></span>' +
        '<button class="btn sm" data-bl="all"><i class="bi bi-check-all"></i> Chọn tất cả</button>' +
        '<button class="btn sm" data-bl="none"><i class="bi bi-x-square"></i> Bỏ chọn tất cả</button>' +
        '<span class="tb-sep"></span>' +
        nut('trangThai', 'bi-flag', 'Đổi trạng thái', qSua && cfg.trangThai) +
        nut('duyet', 'bi-check2-circle', 'Duyệt hàng loạt', qDuyet && cfg.duyetTT, 'ok') +
        nut('huyduyet', 'bi-arrow-counterclockwise', 'Hủy duyệt', qDuyet && cfg.huyDuyetTT) +
        nut('sua', 'bi-pencil-square', 'Sửa hàng loạt', qSua && cfg.suaTruong && cfg.suaTruong.length) +
        nut('nguoiLap', 'bi-person-check', 'Gán lại người lập', qSua && cfg.nguoiLap && Q.doiNguoiLap(mod)) +
        '<span class="tb-sep"></span>' +
        nut('in', 'bi-printer', 'In hàng loạt', qIn && cfg.inCT) +
        nut('pdf', 'bi-file-earmark-pdf', 'Xuất PDF', qPdf && cfg.inCT) +
        nut('excel', 'bi-file-earmark-excel', 'Xuất Excel dòng đã chọn', qXls && cfg.excel) +
        nut('email', 'bi-envelope', 'Gửi thư điện tử', cfg.email !== false) +
        nut('khoa', 'bi-lock', 'Khóa hàng loạt', qSua && cfg.inCT) +
        nut('mokhoa', 'bi-unlock', 'Mở khóa hàng loạt', qSua && cfg.inCT) +
        '<span class="tb-sep"></span>' +
        nut('xoa', 'bi-trash', 'Xóa đã chọn', qXoa, 'danger');

    bar.querySelectorAll('[data-bl]').forEach(function (b) {
        b.onclick = function () { chay(b.getAttribute('data-bl')); };
    });
    /* Thanh thao tác hàng loạt cũng theo đúng hệ màu nhận diện của toàn hệ thống. */
    UI.mauNut(bar);

    function ds() { return g.daChon(); }
    function lamMoi() {
        g.chon = {};
        if (cfg.sauKhiDoi) cfg.sauKhiDoi();
        g.reload(cfg.rows ? cfg.rows() : undefined);
        W.route();
    }
    function loc(list, ktKhoa) {
        // bỏ qua chứng từ đã khóa khi thao tác thay đổi dữ liệu
        if (!ktKhoa) return { ok: list, khoa: [] };
        var ok = [], khoa = [];
        list.forEach(function (r) { (r.khoa ? khoa : ok).push(r); });
        return { ok: ok, khoa: khoa };
    }
    function baoKhoa(n) {
        if (n) UI.toast('warn', 'Bỏ qua ' + n + ' chứng từ đã khóa', 'Chứng từ đang khóa không thể thay đổi.');
    }

    function chay(k) {
        var list = ds();
        if (k === 'all') {
            g.allRows.forEach(function (r) { g.chon[r.id] = true; });
            g.render();
            UI.toast('info', 'Đã chọn ' + g.allRows.length + ' bản ghi');
            return;
        }
        if (k === 'none') { g.boChon(); UI.toast('info', 'Đã bỏ chọn tất cả'); return; }
        if (!list.length) return;

        if (k === 'xoa') return xoaNhieu(list);
        if (k === 'khoa' || k === 'mokhoa') return khoaNhieu(list, k === 'khoa');
        if (k === 'trangThai') return doiTrangThai(list);
        if (k === 'duyet') return duyetNhieu(list, cfg.duyetTT, 'Duyệt');
        if (k === 'huyduyet') return duyetNhieu(list, cfg.huyDuyetTT, 'Hủy duyệt');
        if (k === 'sua') return suaNhieu(list);
        if (k === 'nguoiLap') return ganNguoiLap(list);
        if (k === 'in' || k === 'pdf') return inNhieu(list, k === 'pdf');
        if (k === 'excel') return xuatExcel(list);
        if (k === 'email') return guiEmail(list);
    }

    /* ------------------------------------------------ XÓA HÀNG LOẠT
       Dùng chung bộ rà soát liên kết dữ liệu của toàn hệ thống: xóa phần được
       phép, giữ nguyên phần bị chặn và nêu rõ lý do từng bản ghi. */
    function xoaNhieu(list) {
        UI.xoaNhieuChuan({ coll: coll, ds: list, mod: mod, sauKhi: lamMoi });
    }

    /* ------------------------------------------------ KHÓA / MỞ KHÓA HÀNG LOẠT */
    function khoaNhieu(list, khoa) {
        var can = list.filter(function (r) { return !!r.khoa !== khoa; });
        if (!can.length) return UI.khongThe(khoa ? 'Khóa hàng loạt' : 'Mở khóa hàng loạt',
            'Toàn bộ ' + list.length + ' chứng từ đã chọn đều ' +
            (khoa ? 'đang bị khóa rồi.' : 'đang ở trạng thái mở.'),
            'Chọn các chứng từ ở trạng thái ngược lại để thực hiện thao tác này.');
        UI.confirm({
            title: (khoa ? 'Khóa ' : 'Mở khóa ') + can.length + ' chứng từ',
            icon: khoa ? 'bi-lock-fill' : 'bi-unlock', danger: !!khoa,
            message: (khoa ? 'Khóa' : 'Mở khóa') + ' <b>' + can.length + '</b> chứng từ đã chọn' +
                (list.length > can.length
                    ? ' <span class="muted">(bỏ qua ' + (list.length - can.length) + ' chứng từ đã ở trạng thái này)</span>'
                    : '') + '?',
            note: khoa ? 'Chứng từ đã khóa <b>không sửa và không xóa được</b> cho tới khi được mở khóa.'
                       : 'Sau khi mở khóa, chứng từ sửa và xóa được như bình thường.',
            okText: khoa ? 'Khóa' : 'Mở khóa',
            ok: function () {
                DB.gopGhi();
                try {
                    can.forEach(function (r) {
                        r.khoa = khoa; r._khoaBoi = DB.user().hoTen; r._khoaLuc = T.now();
                        DB.log(khoa ? 'Khóa chứng từ' : 'Mở khóa', coll, r);
                    });
                } finally { DB.xongGopGhi(); }
                DB.save(); lamMoi();
                UI.toast('ok', (khoa ? 'Đã khóa ' : 'Đã mở khóa ') + can.length + ' chứng từ');
            }
        });
    }

    /* ------------------------------------------------ ĐỔI TRẠNG THÁI HÀNG LOẠT */
    function doiTrangThai(list) {
        var p = loc(list, true);
        UI.modal({
            size: 'sm', title: 'Đổi trạng thái hàng loạt',
            sub: p.ok.length + ' bản ghi được chọn',
            body: '<div class="fld"><label>Trạng thái mới</label><select data-f="tt">' +
                W.opt(cfg.trangThai, cfg.trangThai[0]) + '</select></div>' +
                (p.khoa.length ? '<div class="note y mt12"><i class="bi bi-lock"></i><div>' + p.khoa.length +
                    ' chứng từ đã khóa sẽ được bỏ qua.</div></div>' : ''),
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Áp dụng', cls: 'primary', icon: 'bi-check-lg', click: function (h) {
                    var tt = UI.read(h.el).tt;
                    p.ok.forEach(function (r) { r.trangThai = tt; DB.log('Cập nhật', coll, r); });
                    DB.save(); h.close(); baoKhoa(p.khoa.length); lamMoi();
                    UI.toast('ok', 'Đã đổi trạng thái ' + p.ok.length + ' bản ghi', 'Trạng thái mới: ' + tt);
                } }
            ]
        });
    }

    /* ------------------------------------------------ DUYỆT / HỦY DUYỆT HÀNG LOẠT */
    function duyetNhieu(list, tt, ten) {
        var p = loc(list, true);
        UI.confirm({
            title: ten + ' hàng loạt', icon: ten === 'Duyệt' ? 'bi-check2-circle' : 'bi-arrow-counterclockwise',
            message: ten + ' <b>' + p.ok.length + '</b> chứng từ đã chọn?',
            note: 'Trạng thái sẽ chuyển thành <b>' + tt + '</b>.' +
                (p.khoa.length ? ' Bỏ qua ' + p.khoa.length + ' chứng từ đã khóa.' : ''),
            okText: ten, okIcon: 'bi-check-lg',
            ok: function () {
                p.ok.forEach(function (r) {
                    r.trangThai = tt;
                    if (ten === 'Duyệt') { r._duyetBoi = DB.user().hoTen; r._duyetLuc = T.now(); }
                    DB.log(ten, coll, r);
                });
                DB.save(); baoKhoa(p.khoa.length); lamMoi();
                UI.toast('ok', 'Đã ' + ten.toLowerCase() + ' ' + p.ok.length + ' chứng từ');
            }
        });
    }

    /* ------------------------------------------------ SỬA HÀNG LOẠT */
    function suaNhieu(list) {
        var p = loc(list, true);
        UI.modal({
            size: 'md', title: 'Sửa hàng loạt', sub: p.ok.length + ' bản ghi được chọn',
            body: '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>Chỉ những trường được tích ' +
                '<b>Áp dụng</b> mới bị thay đổi. Các trường còn lại giữ nguyên giá trị cũ của từng bản ghi.</div></div>' +
                '<table class="grid" style="width:100%"><thead><tr><th style="width:78px" class="ctr">Áp dụng</th>' +
                '<th style="width:190px">Trường</th><th>Giá trị mới</th></tr></thead><tbody>' +
                cfg.suaTruong.map(function (f) {
                    var o;
                    if (f.type === 'select') o = '<select data-f="' + f.k + '">' + W.opt(f.opts, '') + '</select>';
                    else if (f.type === 'date') o = '<input type="date" data-f="' + f.k + '">';
                    else if (f.type === 'number') o = '<input class="num tien" data-f="' + f.k + '">';
                    else o = '<input type="text" data-f="' + f.k + '">';
                    return '<tr><td class="ctr"><input type="checkbox" data-ap="' + f.k + '"></td>' +
                        '<td>' + T.esc(f.t) + '</td><td>' + o + '</td></tr>';
                }).join('') + '</tbody></table>',
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Áp dụng cho ' + p.ok.length + ' bản ghi', cls: 'primary', icon: 'bi-check-lg',
                  click: function (h) {
                    var v = UI.read(h.el), ap = [];
                    h.el.querySelectorAll('[data-ap]:checked').forEach(function (c) { ap.push(c.getAttribute('data-ap')); });
                    if (!ap.length) { UI.toast('warn', 'Chưa chọn trường nào để áp dụng'); return; }
                    p.ok.forEach(function (r) {
                        ap.forEach(function (k) { r[k] = v[k]; });
                        DB.log('Cập nhật', coll, r);
                    });
                    DB.save(); h.close(); baoKhoa(p.khoa.length); lamMoi();
                    UI.toast('ok', 'Đã sửa ' + p.ok.length + ' bản ghi', 'Trường thay đổi: ' + ap.length);
                } }
            ]
        });
    }

    /* ------------------------------------------------ GÁN LẠI NGƯỜI LẬP */
    function ganNguoiLap(list) {
        var p = loc(list, true);
        var ds2 = DB.all('nhanVien').filter(function (n) { return n.trangThai === 'Đang làm việc'; });
        UI.modal({
            size: 'sm', title: 'Gán lại Người lập', sub: p.ok.length + ' chứng từ được chọn',
            body: '<div class="fld"><label>Người lập mới</label><select data-f="nv">' +
                W.opt(ds2.map(function (n) { return { v: n.id, t: n.hoTen + ' — ' + n.chucVu }; }), (ds2[0] || {}).id) +
                '</select></div>' +
                '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>Dùng khi bàn giao công việc giữa các nhân viên. ' +
                'Số liệu thống kê doanh số theo nhân viên sẽ đổi theo.</div></div>',
            buttons: [
                { text: 'Hủy', click: function (h) { h.close(); } },
                { text: 'Gán lại', cls: 'primary', icon: 'bi-person-check', click: function (h) {
                    var id = UI.read(h.el).nv, nv = DB.get('nhanVien', id);
                    p.ok.forEach(function (r) {
                        r.nguoiLapId = id; r.nguoiLap = nv ? nv.hoTen : '';
                        DB.log('Cập nhật', coll, r);
                    });
                    DB.save(); h.close(); baoKhoa(p.khoa.length); lamMoi();
                    UI.toast('ok', 'Đã gán lại người lập', p.ok.length + ' chứng từ → ' + (nv ? nv.hoTen : ''));
                } }
            ]
        });
    }

    /* ------------------------------------------------ IN / PDF HÀNG LOẠT */
    function inNhieu(list, laPdf) {
        if (!W.inChungTuHTML) { UI.toast('err', 'Chưa hỗ trợ in loại chứng từ này'); return; }
        var html = list.map(function (r, i) {
            return '<div class="' + (i < list.length - 1 ? 'page-break' : '') + '">' +
                W.inChungTuHTML(coll, r) + '</div>';
        }).join('');
        UI.print(html, (laPdf ? 'Xuất PDF ' : 'In ') + list.length + ' ' + (cfg.dt || 'chứng từ').toLowerCase());
        UI.toast('info', laPdf ? 'Đã dựng ' + list.length + ' chứng từ' : 'Đã dựng bản in ' + list.length + ' chứng từ',
            laPdf ? 'Bấm “In / Lưu PDF” rồi chọn “Lưu thành PDF”.' : 'Mỗi chứng từ một trang A4.');
    }

    /* ------------------------------------------------ XUẤT EXCEL DÒNG ĐÃ CHỌN */
    function xuatExcel(list) {
        UI.xuatExcel((cfg.file || 'DuLieu') + '_DaChon', cfg.dt || 'Dữ liệu', cfg.excel, list);
    }

    /* ------------------------------------------------ GỬI EMAIL HÀNG LOẠT */
    function guiEmail(list) {
        /* Địa chỉ thư lấy từ CUSTOMER MASTER DATA theo Customer ID — email công
           ty, thiếu thì lấy email người liên hệ. */
        function mailKH(r) {
            var kh = DB.get('khachHang', r.khachHangId) || {};
            return kh.email || kh.emailLienHe || r.email || '';
        }
        var co = list.filter(function (r) { return !!mailKH(r); });
        UI.modal({
            size: 'md', title: 'Gửi thư điện tử hàng loạt', sub: list.length + ' bản ghi được chọn',
            body: '<div class="note y mb12"><i class="bi bi-exclamation-triangle"></i><div>' +
                '<b>Phần mềm chạy trong trình duyệt nên gửi thư qua phần mềm thư điện tử của máy.</b> ' +
                'Phần mềm dựng sẵn danh sách người nhận và nội dung thư để anh sao chép, ' +
                'hoặc mở luôn phần mềm email mặc định của máy. Bản Offline (.EXE) sẽ gửi thẳng qua SMTP của công ty.</div></div>' +
                '<div class="fld mb12"><label>Tiêu đề thư</label><input data-f="tieu" value="' +
                T.esc((cfg.dt || 'Chứng từ') + ' — ' + DB.cty().tat) + '"></div>' +
                '<div class="fld mb12"><label>Người nhận (' + co.length + '/' + list.length + ' bản ghi có email)</label>' +
                '<textarea data-f="dsMail" rows="3">' + T.esc(co.map(mailKH)
                    .filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join('; ')) + '</textarea></div>' +
                '<div class="fld"><label>Nội dung</label><textarea data-f="noiDung" rows="5">' +
                T.esc('Kính gửi Quý khách hàng,\n\n' + DB.cty().ten + ' xin gửi tới Quý khách các chứng từ sau:\n' +
                    list.map(function (r) { return '- ' + (r.so || '') + ' ngày ' + T.date(r.ngay) +
                        (r.tongCong ? ' — ' + T.money(r.tongCong) + ' đ' : ''); }).join('\n') +
                    '\n\nTrân trọng cảm ơn.') + '</textarea></div>',
            buttons: [
                { text: 'Đóng', click: function (h) { h.close(); } },
                { text: 'Chép nội dung', icon: 'bi-clipboard', click: function (h) {
                    var t = h.q('[data-f="dsMail"]').value + '\n\n' + h.q('[data-f="noiDung"]').value;
                    try { navigator.clipboard.writeText(t); UI.toast('ok', 'Đã chép vào bộ nhớ tạm'); }
                    catch (e) { UI.toast('warn', 'Trình duyệt không cho chép tự động', 'Hãy bôi đen và chép tay.'); }
                } },
                { text: 'Mở phần mềm thư điện tử', cls: 'primary', icon: 'bi-envelope', click: function (h) {
                    var v = UI.read(h.el);
                    var url = 'mailto:' + encodeURIComponent(v.dsMail) +
                        '?subject=' + encodeURIComponent(v.tieu) + '&body=' + encodeURIComponent(v.noiDung);
                    window.location.href = url;
                    h.close();
                } }
            ]
        });
    }
};

})(window);

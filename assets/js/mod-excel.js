/* ==========================================================================
   BỘ MÁY NHẬP / XUẤT EXCEL DÙNG CHUNG
   Mọi phân hệ dùng đúng một bộ này — không viết lại ở từng màn hình.

   Bốn chức năng chuẩn:
     1. W.tepMau(cfg)     — tải tệp Excel mẫu, TỰ SINH từ khai báo cột,
                            kèm sheet "Hướng dẫn" và 3 dòng ví dụ thật.
     2. W.nhapExcel(cfg)  — nhập Excel: kiểm tra TỪNG DÒNG, báo lỗi riêng
                            từng dòng, dòng lỗi bị bỏ qua, dòng đúng vẫn ghi.
     3. UI.xuatExcel      — xuất Excel dữ liệu (đã có sẵn trong thư viện giao diện).
     4. W.excelBieuMau    — xuất Excel theo bố cục biểu mẫu (ở phân hệ báo cáo).
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI;

/* ------------------------------------------------------------- TỆP MẪU */
/**
 * Sinh tệp Excel mẫu gồm 2 trang:
 *   • "Dữ liệu"    — dòng tiêu đề đúng tên cột + 3 dòng ví dụ lấy từ dữ liệu thật
 *   • "Hướng dẫn"  — giải thích từng cột: bắt buộc hay không, kiểu dữ liệu, ví dụ
 */
W.tepMau = function (cfg) {
    if (!W.XLSX) return UI.toast('err', 'Thiếu thư viện Excel');
    var cols = (cfg.cols || []).filter(function (c) { return !c.an; });
    var mau = (cfg.mau || []).slice(0, 3);

    // --- Trang dữ liệu ---
    var A = [cols.map(function (c) { return c.t; })];
    mau.forEach(function (r) {
        A.push(cols.map(function (c) {
            var v = c.v ? c.v(r) : r[c.k];
            return v === undefined || v === null ? '' : v;
        }));
    });
    if (!mau.length) A.push(cols.map(function () { return ''; }));
    var ws = W.XLSX.utils.aoa_to_sheet(A);
    ws['!cols'] = cols.map(function (c) { return { wch: c.w || 18 }; });

    // --- Trang hướng dẫn ---
    var H = [
        ['HƯỚNG DẪN NHẬP DỮ LIỆU — ' + (cfg.ten || '')],
        [''],
        ['1. Nhập dữ liệu vào trang "Dữ liệu". Giữ nguyên dòng tiêu đề, không đổi tên cột, không xóa cột.'],
        ['2. Ba dòng ví dụ bên dưới tiêu đề là dữ liệu thật đang có trong phần mềm — xóa đi trước khi nhập.'],
        ['3. Ô tiền có thể gõ 1000000 hoặc 1.000.000, phần mềm tự hiểu. Không ghi chữ "đ" hay "VNĐ".'],
        ['4. Ngày tháng ghi dạng NGÀY/THÁNG/NĂM, ví dụ 05/08/2026.'],
        ['5. Khi nhập, phần mềm kiểm tra từng dòng: dòng nào sai chỉ dòng đó bị bỏ qua và được báo lỗi rõ,'],
        ['   các dòng còn lại vẫn được ghi bình thường — không phải làm lại cả tệp.'],
        [''],
        ['DANH SÁCH CỘT'],
        ['Tên cột', 'Bắt buộc', 'Kiểu dữ liệu', 'Ví dụ / Giải thích']
    ];
    cols.forEach(function (c) {
        var vd = '';
        for (var i = 0; i < mau.length && !vd; i++) {
            var v = c.v ? c.v(mau[i]) : mau[i][c.k];
            if (v !== undefined && v !== null && v !== '') vd = String(v);
        }
        H.push([c.t, c.req ? 'Bắt buộc' : 'Không', c.kieu || (typeof vd === 'number' ? 'Số' : 'Chữ'),
                c.mo || vd || '']);
    });
    var wh = W.XLSX.utils.aoa_to_sheet(H);
    wh['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 60 }];
    wh['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

    var wb = W.XLSX.utils.book_new();
    W.XLSX.utils.book_append_sheet(wb, ws, 'Dữ liệu');
    W.XLSX.utils.book_append_sheet(wb, wh, 'Hướng dẫn');
    W.XLSX.writeFile(wb, (cfg.file || 'TepMau') + '.xlsx');
    UI.toast('ok', 'Đã tải tệp mẫu',
        (cfg.file || 'TepMau') + '.xlsx — có sẵn trang Hướng dẫn và 3 dòng ví dụ.');
};

/* ------------------------------------------------------------- NHẬP EXCEL */
/**
 * Popup nhập Excel chuẩn.
 * cfg = {
 *   ten, file, cols, mau,
 *   kiemTra(dongExcel, chiSo, daGap) → { o: bảnGhi, loi: [chuỗi lỗi] }
 *   ghi(bảnGhi)      → ghi một bản ghi hợp lệ vào cơ sở dữ liệu
 *   xong()           → gọi sau khi ghi xong để vẽ lại màn hình
 * }
 */
W.nhapExcel = function (cfg) {
    var cols = (cfg.cols || []).filter(function (c) { return !c.an; });
    UI.modal({
        size: 'xl', title: 'Nhập dữ liệu từ Excel — ' + (cfg.ten || ''),
        sub: 'Kiểm tra từng dòng · dòng lỗi được bỏ qua và báo rõ · dòng đúng vẫn ghi bình thường',
        body:
          '<div class="note b mb12"><i class="bi bi-info-circle"></i><div>' +
          'Tệp cần có dòng tiêu đề đúng các cột: <b>' + cols.map(function (c) { return c.t; }).join(' · ') + '</b>.<br>' +
          'Chưa có tệp thì bấm <b>Tải tệp mẫu</b> — tệp mẫu kèm trang <i>Hướng dẫn</i> và ví dụ thật.</div></div>' +
          '<div class="row mb12">' +
          '<button class="btn" id="btnMau"><i class="bi bi-file-earmark-arrow-down"></i> Tải tệp mẫu</button>' +
          '<button class="btn primary" id="btnChon"><i class="bi bi-upload"></i> Chọn tệp Excel…</button>' +
          '<span class="muted small" id="tenTep">Chưa chọn tệp</span></div>' +
          '<div id="kqKiemTra"></div>',
        buttons: [
            { text: 'Đóng', click: function (h) { h.close(); } },
            { text: 'Ghi các dòng hợp lệ', cls: 'primary', icon: 'bi-database-add', click: function (h) {
                if (!h._ok || !h._ok.length) return UI.toast('warn', 'Không có dòng hợp lệ nào để ghi');
                var n = 0;
                h._ok.forEach(function (x) { try { cfg.ghi(x.o); n++; } catch (e) { } });
                h.close();
                if (cfg.xong) cfg.xong();
                UI.toast('ok', 'Đã nhập ' + n + ' dòng',
                    h._loi && h._loi.length ? (h._loi.length + ' dòng lỗi đã được bỏ qua.') : 'Toàn bộ dòng đều hợp lệ.');
            } }
        ],
        onOpen: function (h) {
            h.q('#btnMau').onclick = function () {
                W.tepMau({ ten: cfg.ten, file: cfg.file || 'TepMau', cols: cols, mau: cfg.mau });
            };
            h.q('#btnChon').onclick = function () {
                UI.nhapExcel({ done: function (rows, ten) {
                    var ok = [], loi = [], da = {};
                    rows.forEach(function (r, i) {
                        var kq;
                        try { kq = cfg.kiemTra(r, i, da); }
                        catch (e) { kq = { o: null, loi: ['lỗi đọc dòng: ' + (e.message || e)] }; }
                        var mo = cols.map(function (c) { return r[c.t]; }).filter(function (x) {
                            return x !== undefined && String(x).trim() !== ''; }).slice(0, 2).join(' — ');
                        if (kq.loi && kq.loi.length) loi.push({ dong: i + 2, mo: mo, loi: kq.loi });
                        else ok.push({ dong: i + 2, mo: mo, o: kq.o });
                    });
                    h._ok = ok; h._loi = loi;
                    h.q('#tenTep').textContent = ten + ' — đọc được ' + rows.length + ' dòng';
                    h.q('#kqKiemTra').innerHTML =
                        '<div class="grid3 mb12">' +
                        the('Tổng số dòng', T.num(rows.length, 0), '') +
                        the('Hợp lệ — sẽ ghi', T.num(ok.length, 0), 'g') +
                        the('Có lỗi — bỏ qua', T.num(loi.length, 0), loi.length ? 'r' : '') +
                        '</div>' +
                        (loi.length ? '<div class="card mb12"><div class="card-h">' +
                            '<i class="bi bi-exclamation-triangle-fill"></i> Danh sách dòng lỗi' +
                            '<span class="spacer"></span>' +
                            '<button class="btn sm" id="taiLoi"><i class="bi bi-download"></i> Tải danh sách lỗi</button></div>' +
                            '<div class="tablewrap" style="max-height:240px;border:none"><table class="grid"><thead><tr>' +
                            '<th style="width:90px">Dòng Excel</th><th style="width:280px">Nội dung</th><th>Lý do bị bỏ qua</th>' +
                            '</tr></thead><tbody>' + loi.map(function (x) {
                                return '<tr><td class="ctr mono">' + x.dong + '</td>' +
                                    '<td><span class="ellip">' + T.esc(x.mo) + '</span></td>' +
                                    '<td class="neg">' + T.esc(x.loi.join('; ')) + '</td></tr>';
                            }).join('') + '</tbody></table></div></div>' : '') +
                        (ok.length ? '<div class="card"><div class="card-h"><i class="bi bi-check2-circle"></i> ' +
                            'Xem trước ' + Math.min(ok.length, 12) + '/' + ok.length + ' dòng hợp lệ</div>' +
                            '<div class="tablewrap" style="max-height:260px;border:none"><table class="grid"><thead><tr>' +
                            '<th style="width:90px">Dòng</th>' + cols.map(function (c) {
                                return '<th>' + T.esc(c.t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
                            ok.slice(0, 12).map(function (x) {
                                return '<tr><td class="ctr mono">' + x.dong + '</td>' + cols.map(function (c) {
                                    var v = x.o[c.k];
                                    return '<td>' + T.esc(v === undefined ? '' : v) + '</td>';
                                }).join('') + '</tr>';
                            }).join('') + '</tbody></table></div></div>'
                          : '<div class="empty" style="padding:30px"><i class="bi bi-x-octagon"></i>' +
                            '<b>Không có dòng nào hợp lệ</b>Xem cột “Lý do bị bỏ qua” ở trên rồi sửa lại tệp.</div>');

                    var tl = h.q('#taiLoi');
                    if (tl) tl.onclick = function () {
                        UI.xuatExcel('DongLoi_' + (cfg.file || 'NhapExcel'), 'Dòng lỗi',
                            [{ t: 'Dòng Excel', k: 'dong', w: 12 }, { t: 'Nội dung', k: 'mo', w: 46 },
                             { t: 'Lý do bị bỏ qua', k: 'lyDo', w: 60 }],
                            loi.map(function (x) { return { dong: x.dong, mo: x.mo, lyDo: x.loi.join('; ') }; }));
                    };
                } });
            };
        }
    });

    function the(l, v, c) {
        return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div>' +
            '<div class="vl">' + v + '</div></div>';
    }
};

})(window);

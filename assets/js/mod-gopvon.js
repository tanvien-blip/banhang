/* ==========================================================================
   TVERP — PHÂN HỆ GÓP VỐN CỔ ĐÔNG                            (thêm ở v12.0.0)
   --------------------------------------------------------------------------
   Một màn hình duy nhất, sáu thẻ:
       Tổng quan · Danh sách cổ đông · Đợt góp vốn · Thu hồi giá vốn ·
       Lợi nhuận · Báo cáo

   MÀN HÌNH NÀY KHÔNG TỰ TÍNH MỘT CON SỐ TÀI CHÍNH NÀO.
   Doanh thu, giá vốn, chi phí, lợi nhuận, tồn kho, công nợ đều gọi thẳng
   Business Engine (T.ketQuaKinhDoanh · T.giaTriTonKho · T.congNoNCC) qua khối
   Engine vốn trong core.js. Ở đây chỉ có việc vẽ.

   Phân hệ chỉ ghi ba loại dữ liệu gốc: cổ đông, đợt góp vốn, giao dịch vốn.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, Q = W.Q, S = W.SCREEN = W.SCREEN || {};

var MOD = 'gopVon';

/* Bảng màu của biểu đồ vành khuyên — dùng đúng biến màu của TVERP, không đưa
   thêm màu lạ vào hệ thống. */
var MAU_DN = ['var(--act-info)', 'var(--act-ok)', 'var(--act-warn)', 'var(--act-rep)',
              'var(--act-err)', '#5b7c99', '#8a6d9e', '#4f8a83'];

/* --------------------------------------------------------------- TIỆN ÍCH VẼ */

function kpi(l, v, ft, c) {
    return '<div class="kpi st ' + (c || '') + '"><div class="lb">' + l + '</div>' +
        '<div class="vl">' + v + '</div><div class="ft">' + (ft || '&nbsp;') + '</div></div>';
}
function tien(v) { return T.money(v); }

/** Thanh tiến độ — dùng lại đúng .bar-track/.bar-fill có sẵn của TVERP. */
function thanh(pct, xanh) {
    pct = Math.max(0, Math.min(100, Number(pct) || 0));
    return '<div class="bar-track"><div class="bar-fill' + (xanh ? ' g' : '') +
        '" style="width:' + pct + '%"></div></div>';
}

/** Biểu đồ vành khuyên — SVG nội tuyến, không dùng thư viện ngoài. */
function vanhKhuyen(ds, giua, duoi) {
    var tong = T.sum(ds, function (x) { return Math.max(0, Number(x.v) || 0); });
    var R = 52, W2 = 20, C = 2 * Math.PI * R, off = 0;
    var vong = '';
    if (tong <= 0) {
        vong = '<circle class="dn-nen" cx="70" cy="70" r="' + R + '" fill="none" stroke-width="' + W2 + '"></circle>';
    } else {
        ds.forEach(function (x, i) {
            var v = Math.max(0, Number(x.v) || 0);
            if (!v) return;
            var d = C * v / tong;
            vong += '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke-width="' + W2 + '"' +
                ' stroke="' + MAU_DN[i % MAU_DN.length] + '"' +
                ' stroke-dasharray="' + d.toFixed(2) + ' ' + (C - d).toFixed(2) + '"' +
                ' stroke-dashoffset="' + (-off).toFixed(2) + '"' +
                ' transform="rotate(-90 70 70)"><title>' + T.esc(x.l) + ' — ' +
                T.num(v / tong * 100, 1) + '%</title></circle>';
            off += d;
        });
    }
    return '<div class="dn-wrap"><svg class="dn" viewBox="0 0 140 140" role="img" aria-label="Biểu đồ tỷ trọng">' +
        vong +
        '<text class="dn-giua" x="70" y="68" text-anchor="middle">' + T.esc(giua || '') + '</text>' +
        '<text class="dn-duoi" x="70" y="84" text-anchor="middle">' + T.esc(duoi || '') + '</text>' +
        '</svg><div class="dn-chu">' + ds.map(function (x, i) {
            var v = Math.max(0, Number(x.v) || 0);
            return '<div class="dn-mot"><span class="dn-o" style="background:' +
                MAU_DN[i % MAU_DN.length] + '"></span>' +
                '<span class="dn-ten ellip" title="' + T.esc(x.l) + '">' + T.esc(x.l) + '</span>' +
                '<span class="dn-so">' + (tong ? T.num(v / tong * 100, 1) + '%' : '—') + '</span></div>';
        }).join('') + '</div></div>';
}

/** Danh sách năm có dữ liệu — lấy từ chính chứng từ, không ghi cứng năm nào. */
function cacNam() {
    var co = {};
    ['donBan', 'hopDong', 'phieuXuat', 'phuLuc', 'phieuThu', 'phieuChi', 'phieuNhap',
     'giaoDichVon', 'dotGopVon'].forEach(function (c) {
        DB.all(c).forEach(function (r) {
            var n = String(r.ngay || '').substr(0, 4);
            if (/^\d{4}$/.test(n)) co[n] = 1;
        });
    });
    co[T.today().substr(0, 4)] = 1;
    return Object.keys(co).sort().reverse();
}
function optNam() {
    return cacNam().map(function (n) {
        return '<option value="' + n + '">Năm ' + n + '</option>';
    }).join('');
}

function the(tieu, ico, than, phu) {
    return '<div class="card mb12"><div class="card-h"><i class="bi ' + ico + '"></i> ' + T.esc(tieu) +
        (phu ? '<span class="spacer"></span><span class="small muted">' + phu + '</span>' : '') +
        '</div><div class="card-b">' + than + '</div></div>';
}

function bangDon(cot, dong) {
    return '<div class="tablewrap"><table class="grid"><thead><tr>' +
        cot.map(function (c) { return '<th' + (c.n ? ' class="num"' : '') +
            (c.w ? ' style="width:' + c.w + 'px"' : '') + '>' + c.t + '</th>'; }).join('') +
        '</tr></thead><tbody>' + (dong.length ? dong.join('') :
            '<tr><td colspan="' + cot.length + '"><div class="trong"><i class="bi bi-inbox"></i>' +
            '<b>Chưa có dữ liệu</b>Số liệu sẽ hiện ra khi có nghiệp vụ phát sinh.</div></td></tr>') +
        '</tbody></table></div>';
}

function ghiChuNguon(chu) {
    return '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>' + chu + '</div></div>';
}

/* ====================================================================== MÀN HÌNH */

S['gop-von'] = function (host) {
    if (!Q.co(MOD, 'xem')) {
        host.innerHTML = '<div class="page"><div class="trong"><i class="bi bi-lock"></i>' +
            '<b>Không có quyền truy cập</b>Liên hệ quản trị hệ thống để được cấp quyền ' +
            'xem phân hệ Góp vốn cổ đông.</div></div>';
        return;
    }

    var tab = 'quy-trinh';
    var dvVon = T.donViVon() || {};

    var THE = [
        { k: 'quy-trinh', t: 'Quy trình',          i: 'bi-signpost-split-fill' },
        { k: 'tong-quan', t: 'Tổng quan',          i: 'bi-speedometer2' },
        { k: 'co-dong',   t: 'Danh sách cổ đông',  i: 'bi-people-fill' },
        { k: 'dot',       t: 'Đợt góp vốn',        i: 'bi-calendar2-plus-fill' },
        { k: 'thu-hoi',   t: 'Thu hồi giá vốn',    i: 'bi-arrow-repeat' },
        { k: 'loi-nhuan', t: 'Lợi nhuận',          i: 'bi-pie-chart-fill' },
        { k: 'dong-tien', t: 'Dòng tiền cổ đông',   i: 'bi-cash-stack' },
        { k: 'bao-cao',   t: 'Báo cáo',            i: 'bi-file-earmark-bar-graph' }
    ];

    host.innerHTML =
        '<div class="page"><div class="page-head"><div><h2>Góp vốn cổ đông</h2>' +
        '<div class="sub">Vốn góp · quỹ vốn quay vòng · lãi chậm góp · phân chia lợi nhuận — ' +
        'mọi số liệu tài chính đọc trực tiếp từ chứng từ gốc. ' +
        '<b>Lợi nhuận chia cho cổ đông chỉ tính cho ' + T.esc(dvVon.ten || 'Tản Viên') + '.</b>' +
        '</div></div></div>' +
        '<div class="toolbar" id="gvTb">' +
            '<label class="small muted">Kỳ báo cáo</label>' +
            '<select id="gvNam" style="width:160px">' +
                '<option value="">— Tùy chọn ngày —</option>' + optNam() + '</select>' +
            '<label class="small muted">Từ ngày</label><input type="date" id="gvTu" style="width:150px">' +
            '<label class="small muted">Đến ngày</label><input type="date" id="gvDen" style="width:150px">' +
            '<button class="btn warn" data-loc><i class="bi bi-funnel"></i> Áp dụng kỳ</button>' +
            '<button class="btn" data-boloc><i class="bi bi-x-circle"></i> Bỏ lọc</button>' +
            '<span class="tb-sep"></span>' +
            '<button class="btn info-line" data-caidat><i class="bi bi-sliders"></i> Cấu hình lãi chậm góp</button>' +
            '<span class="spacer"></span>' +
            '<span class="small muted" id="gvKy"></span>' +
        '</div>' +
        '<div class="tabs" id="gvTabs">' + THE.map(function (b, i) {
            return '<div class="tab' + (i === 0 ? ' on' : '') + '" data-gv="' + b.k + '">' +
                '<i class="bi ' + b.i + '"></i> ' + b.t + '</div>';
        }).join('') + '</div>' +
        '<div id="gvBody"></div></div>';

    W.crumb(['Thu chi & Công nợ', 'Góp vốn cổ đông']);

    var qs = function (s) { return host.querySelector(s); };
    var body = qs('#gvBody');

    function loc() {
        var o = {};
        var a = qs('#gvTu').value, b = qs('#gvDen').value;
        if (a) o.tuNgay = a;
        if (b) o.denNgay = b;
        return o;
    }
    function nhanKy() {
        var k = T.kyBaoCao(loc());
        qs('#gvKy').textContent = 'Kỳ báo cáo: ' + k.nhan +
            (k.coDauKy ? ' · số đầu kỳ chốt ngày ' + T.date(k.truoc) : ' · không có số đầu kỳ');
    }
    /* Chọn một năm là điền thẳng hai mốc ngày — mọi phép tính chỉ đọc hai mốc đó,
       nên năm và khoảng ngày tùy chọn không bao giờ là hai đường tính khác nhau. */
    function apNam() {
        var n = qs('#gvNam').value;
        if (!n) return;
        qs('#gvTu').value = n + '-01-01';
        qs('#gvDen').value = n + '-12-31';
    }
    /** Ba con số của một chỉ tiêu, hiển thị gọn trong một ô. */
    function baSo(x, mau) {
        return '<div class="ba-ky"><span class="bk-d" title="Số đầu kỳ">' + tien(x.dauKy) + '</span>' +
            '<span class="bk-t ' + (mau || '') + '" title="Phát sinh trong kỳ">' +
            (x.trongKy >= 0 ? '+' : '') + tien(x.trongKy) + '</span>' +
            '<span class="bk-c" title="Số cuối kỳ">' + tien(x.cuoiKy) + '</span></div>';
    }
    function bangBaKy(dong) {
        return '<div class="tablewrap"><table class="grid"><thead><tr>' +
            '<th>Chỉ tiêu</th><th class="num" style="width:170px">Đầu kỳ</th>' +
            '<th class="num" style="width:180px">Phát sinh trong kỳ</th>' +
            '<th class="num" style="width:170px">Cuối kỳ</th>' +
            '<th style="width:300px">Nguồn số liệu</th></tr></thead><tbody>' +
            dong.map(function (d) {
                return '<tr' + (d.dam ? ' class="dam"' : '') + '><td>' + (d.dam ? '<b>' : '') +
                    T.esc(d.ct) + (d.dam ? '</b>' : '') + '</td>' +
                    '<td class="num">' + tien(d.x.dauKy) + '</td>' +
                    '<td class="num"><b class="' + (d.x.trongKy > 0 ? 'pos' : (d.x.trongKy < 0 ? 'neg' : 'muted')) +
                        '">' + (d.x.trongKy > 0 ? '+' : '') + tien(d.x.trongKy) + '</b></td>' +
                    '<td class="num"><b>' + tien(d.x.cuoiKy) + '</b></td>' +
                    '<td class="small muted">' + T.esc(d.nguon || '') + '</td></tr>';
            }).join('') + '</tbody></table></div>';
    }

    /* ================================================== 1. TỔNG QUAN */
    function veTongQuan() {
        var l = loc();
        var q = T.quyVonKy(l);
        var ln = T.chiaLoiNhuanKy(l);
        var dc = T.doiChieuVonKy(l);
        var k = q.ky;

        var h = '<div class="note b"><i class="bi bi-calendar-range"></i><div>' +
            '<b>Kỳ báo cáo: ' + T.esc(k.nhan) + '.</b> ' +
            (k.coDauKy
                ? 'Số <b>đầu kỳ</b> chốt tại ngày ' + T.date(k.truoc) + ', số <b>cuối kỳ</b> chốt tại ngày ' +
                  T.date(k.den) + '. Mọi giao dịch phát sinh sau ' + T.date(k.den) +
                  ' <b>không</b> ảnh hưởng tới một con số nào dưới đây.'
                : 'Chưa khai Từ ngày nên kỳ tính từ lúc khai sinh dữ liệu tới ' + T.date(k.den) +
                  ' — không có số đầu kỳ.') +
            '</div></div>' +
            '<div class="kpis">' +
            kpi('Tổng nghĩa vụ phải góp', tien(q.nghiaVu.cuoiKy), 'đ · trong kỳ +' + tien(q.nghiaVu.trongKy), '') +
            /* BA CHỈ TIÊU KHÔNG ĐƯỢC GỘP (v18.6.0 — Logic 2). Trước đây "Cổ đông
               đã thực góp" gộp cả tiền bán hàng của công ty được phân bổ vào
               nghĩa vụ — nhìn vào tưởng cổ đông đã bỏ tiền ra nhiều hơn thực tế. */
            kpi('Cổ đông đã thực góp', tien(q.coDongNop.cuoiKy),
                'đ · tiền cá nhân cổ đông nộp vào', 'g') +
            kpi('Tiền công ty đã phân bổ vào nghĩa vụ', tien(q.phanBoBanHang.cuoiKy),
                'đ · tiền bán hàng — KHÔNG phải tiền cổ đông bỏ ra', 'c') +
            kpi('Còn phải góp', tien(q.conThieu.cuoiKy), 'đ', q.conThieu.cuoiKy > 0 ? 'r' : 'g') +
            kpi('Lãi chậm góp', tien(q.lai.cuoiKy), 'đ · trong kỳ +' + tien(q.lai.trongKy),
                q.lai.cuoiKy > 0 ? 'y' : 'g') +
            kpi('TIỀN THỰC TẾ đang có', tien(q.tienThucTe.cuoiKy), 'đ · quỹ ban đầu 0',
                q.tienThucTe.cuoiKy < 0 ? 'r' : 'g') +
            kpi('Giá vốn đang nằm trong hàng', tien(q.vonTrongHang.cuoiKy), 'đ · tồn kho tại ' + T.date(k.den), 'c') +
            '</div><div class="kpis">' +
            kpi('Quỹ vốn quay vòng', tien(q.quyQuayVong.cuoiKy), 'đ · tiền + hàng', 'c') +
            kpi('Giá vốn đã thu hồi trong kỳ', tien(q.daThuHoi), 'đ · giá vốn hàng đã bán', 'g') +
            kpi('Tiền bán hàng đã thu', tien(q.tienThu.trongKy), 'đ · phiếu thu trong kỳ', 'g') +
            kpi('Tiền đã chi ra', tien(q.tienChi.trongKy), 'đ · phiếu chi trong kỳ', 'y') +
            kpi('Lợi nhuận chưa chia', tien(ln.chuaChia), 'đ', 'g') +
            kpi('Lợi nhuận đã chia TRONG KỲ', tien(ln.daChiaTrongKy), 'đ', '') +
            '</div>';

        if (q.daGop.cuoiKy <= 0 && q.nghiaVu.cuoiKy > 0)
            h += '<div class="note y"><i class="bi bi-exclamation-triangle"></i><div>' +
                '<b>Đã tạo đợt góp vốn nhưng chưa cổ đông nào thực góp.</b> Nghĩa vụ phải góp ' +
                tien(q.nghiaVu.cuoiKy) + ' đ chỉ là <b>cam kết</b> — hệ thống không coi đó là tiền đã có. ' +
                'Tiền thực tế hiện là ' + tien(q.tienThucTe.cuoiKy) + ' đ.</div></div>';

        h += the('Bảng cân đối vốn của kỳ', 'bi-columns-gap',
            bangBaKy([
                { ct: 'Nghĩa vụ phải góp (cam kết)', x: q.nghiaVu,
                  nguon: 'Bảng phân bổ của các đợt góp vốn đã tạo' },
                { ct: 'Cổ đông đã thực góp (tiền cá nhân cổ đông)', x: q.coDongNop, dam: true,
                  nguon: 'Giao dịch Góp vốn đã ghi sổ, nguồn tiền = Cổ đông nộp' },
                { ct: 'Tiền công ty đã phân bổ vào nghĩa vụ', x: q.phanBoBanHang,
                  nguon: 'Giao dịch Góp vốn đã ghi sổ, nguồn tiền = Tiền bán hàng của công ty' },
                { ct: 'Nghĩa vụ đã thực hiện (cộng hai dòng trên)', x: q.daGop, dam: true,
                  nguon: 'Cổ đông đã thực góp + Tiền công ty đã phân bổ' },
                { ct: 'Cổ đông đã rút vốn', x: q.daRut,
                  nguon: 'Giao dịch vốn loại Rút vốn, đã ghi sổ' },
                { ct: 'Lợi nhuận đã chi trả cho cổ đông', x: q.daChia,
                  nguon: 'Giao dịch vốn loại Chia lợi nhuận, đã ghi sổ' },
                { ct: 'Tiền bán hàng đã thu về', x: q.tienThu,
                  nguon: 'Phiếu thu đã ghi sổ' },
                { ct: 'Tiền đã chi ra (gồm tiền mua hàng)', x: q.tienChi,
                  nguon: 'Phiếu chi đã ghi sổ' },
                { ct: 'TIỀN THỰC TẾ ĐANG CÓ', x: q.tienThucTe, dam: true,
                  nguon: 'Cổ đông thực góp − Rút − Đã chia + Thu − Chi − Tiền trả NCC qua nhập kho. ' +
                         'Quỹ ban đầu = 0. Tiền công ty phân bổ vào nghĩa vụ KHÔNG cộng vào đây ' +
                         'vì nó đã nằm trong Tiền bán hàng đã thu về' },
                { ct: 'Giá vốn đang nằm trong hàng hóa', x: q.vonTrongHang, dam: true,
                  nguon: 'Phát lại sổ kho tới ngày chốt — T.chayLaiKho' },
                { ct: 'QUỸ VỐN QUAY VÒNG', x: q.quyQuayVong, dam: true,
                  nguon: 'Tiền thực tế + Giá vốn trong hàng' }
            ]) +
            ghiChuNguon('<b>Không đồng nào được đếm hai lần.</b> Tiền đã dùng mua hàng nằm ở dòng ' +
                '<i>Tiền đã chi ra</i> nên đã bị trừ khỏi Tiền thực tế; phần vốn đó đang ở dạng HÀNG và ' +
                'được theo dõi riêng ở dòng <i>Giá vốn đang nằm trong hàng hóa</i>. Khi hàng bán và thu tiền, ' +
                'giá vốn rời khỏi tồn kho còn tiền quay lại dòng <i>Tiền bán hàng đã thu về</i>.'),
            'Đầu kỳ · Phát sinh · Cuối kỳ');

        var ds = T.dsCoDongTaiNgay(k.den);
        h += '<div class="grid2" style="align-items:start">' +
            the('Cơ cấu sở hữu tại ' + T.date(k.den), 'bi-pie-chart',
                vanhKhuyen(ds.map(function (x) { return { l: x.ten, v: x.tyLe }; }),
                    T.num(T.tongTyLe(k.den), 1) + '%', 'tổng tỷ lệ'), ds.length + ' cổ đông') +
            the('Tiến độ góp vốn theo đợt', 'bi-bar-chart-steps',
                (function () {
                    var md = T.tinhMoiDot(k.den);
                    if (!md.ds.length) return '<div class="trong"><i class="bi bi-inbox"></i>' +
                        '<b>Chưa có đợt góp vốn nào tới ' + T.date(k.den) + '</b>' +
                        'Mở thẻ Đợt góp vốn để tạo đợt đầu tiên.</div>';
                    return md.ds.map(function (d) {
                        var pct = d.phaiGop ? d.daGop / d.phaiGop * 100 : 0;
                        return '<div class="bar-row"><div class="ellip" title="' + T.esc(d.dot.so) + '">' +
                            T.esc(d.dot.so) + '</div>' + thanh(pct, pct >= 100) +
                            '<div class="bar-val">' + T.num(pct, 1) + '%</div></div>';
                    }).join('');
                })()) +
            '</div>';

        h += the('Vòng quay của đồng vốn trong kỳ', 'bi-arrow-repeat',
            '<div class="flow">' +
            buoc('Cổ đông thực góp', tien(q.daGop.trongKy) + ' đ', q.daGop.trongKy > 0) +
            buoc('Tiền đã chi ra', tien(q.tienChi.trongKy) + ' đ', q.tienChi.trongKy > 0) +
            buoc('Vốn nằm trong hàng', tien(q.vonTrongHang.cuoiKy) + ' đ', q.vonTrongHang.cuoiKy > 0) +
            buoc('Giá vốn đã thu hồi', tien(q.daThuHoi) + ' đ', q.daThuHoi > 0) +
            buoc('Tiền bán hàng thu về', tien(q.tienThu.trongKy) + ' đ', q.tienThu.trongKy > 0) +
            buoc('Tiền thực tế còn lại', tien(q.tienThucTe.cuoiKy) + ' đ', q.tienThucTe.cuoiKy > 0) +
            '</div>');

        h += the('Đối chiếu số liệu của kỳ', dc.dat ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill',
            (dc.dat && !dc.canhBao.length
                ? '<div class="note g"><i class="bi bi-check-circle"></i><div>Số liệu cân — mười hai phép ' +
                  'đối chiếu đều đạt: doanh thu, giá vốn, tồn kho, chi phí khớp Business Engine; ' +
                  'đầu kỳ cộng phát sinh bằng cuối kỳ; không đồng nào bị đếm hai lần.</div></div>'
                : dc.loi.concat(dc.canhBao).map(function (x, i2) {
                    var la = i2 < dc.loi.length;
                    return '<div class="note ' + (la ? 'r' : 'y') + '"><i class="bi bi-' +
                        (la ? 'x-octagon' : 'exclamation-triangle') + '"></i><div><b>' + T.esc(x.ten) +
                        '</b><div>' + T.esc(x.moTa) + '</div>' +
                        (x.huong ? '<div class="small muted">Hướng xử lý: ' + T.esc(x.huong) + '</div>' : '') +
                        '</div></div>';
                }).join('')),
            dc.dat ? 'Đạt' : dc.loi.length + ' lỗi · ' + dc.canhBao.length + ' cảnh báo');

        body.innerHTML = h;
    }
    function buoc(ten, gt, co) {
        return '<div class="flow-step ' + (co ? 'co' : 'trong') + '">' +
            '<div class="fs-l">' + T.esc(ten) + '</div>' +
            '<div class="fs-v" style="font-size:15px">' + gt + '</div></div>';
    }

    /* ================================================== 2. DANH SÁCH CỔ ĐÔNG */
    function veCoDong() {
        var l = loc(), den = l.denNgay || T.today();
        body.innerHTML = '<div id="gvKpi" class="kpis"></div><div id="gh"></div>';

        function dong() {
            var bc = T.boiCanhVonKy(l);
            return DB.all('coDong').map(function (cd) {
                var s = T.soVonCoDong(cd, l, bc);
                return { id: cd.id, ma: cd.ma || '', ten: cd.ten, tyLe: s.tyLe,
                         dienThoai: cd.dienThoai || '', ngayHieuLuc: cd.ngayHieuLuc || '',
                         daGop: s.daGop, daRut: s.daRut, vonRong: s.vonRong,
                         thieu: s.thieu, lai: s.lai, trangThai: cd.trangThai || 'Đang tham gia',
                         _r: cd };
            });
        }
        var rows = dong();
        host.querySelector('#gvKpi').innerHTML =
            kpi('Số cổ đông', T.num(rows.length, 0), 'đang tham gia: ' +
                T.num(rows.filter(function (r) { return r.trangThai === 'Đang tham gia'; }).length, 0), '') +
            kpi('Tổng tỷ lệ sở hữu', T.num(T.tongTyLe(den), 2) + '%', 'phải bằng 100%',
                Math.abs(T.tongTyLe(den) - 100) < 0.001 ? 'g' : 'r') +
            kpi('Tổng đã góp', tien(T.sum(rows, function (r) { return r.daGop; })), 'đ', 'g') +
            kpi('Tổng đã rút', tien(T.sum(rows, function (r) { return r.daRut; })), 'đ', 'y') +
            kpi('Vốn ròng', tien(T.sum(rows, function (r) { return r.vonRong; })), 'đ', 'c') +
            kpi('Tổng lãi chậm góp', tien(T.sum(rows, function (r) { return r.lai; })), 'đ',
                T.sum(rows, function (r) { return r.lai; }) > 0 ? 'y' : 'g');

        var cols = [
            { k: 'ma', t: 'Mã', w: 76, cls: 'mono' },
            { k: 'ten', t: 'Cổ đông', r: function (v, r) {
                return '<b>' + T.esc(v) + '</b>' + (r.dienThoai ?
                    '<div class="small muted">' + T.esc(r.dienThoai) + '</div>' : ''); } },
            { k: 'tyLe', t: 'Tỷ lệ sở hữu', w: 140, cls: 'num', r: function (v) {
                return '<b>' + T.num(v, 2) + '%</b>' + thanh(v, false); } },
            { k: 'ngayHieuLuc', t: 'Hiệu lực từ', w: 112, cls: 'num', fmt: 'date' },
            { k: 'daGop', t: 'Đã góp', w: 148, cls: 'num', total: true,
              r: function (v) { return '<span class="pos">' + tien(v) + '</span>'; } },
            { k: 'daRut', t: 'Đã rút', w: 132, cls: 'num', total: true,
              r: function (v) { return v ? '<span class="neg">' + tien(v) + '</span>' : '<span class="muted">0</span>'; } },
            { k: 'vonRong', t: 'Vốn ròng', w: 148, cls: 'num', total: true, fmt: 'money' },
            { k: 'thieu', t: 'Còn thiếu', w: 138, cls: 'num', total: true,
              r: function (v) { return v > 0 ? '<b class="neg">' + tien(v) + '</b>' : '<span class="muted">0</span>'; } },
            { k: 'lai', t: 'Lãi chậm góp', w: 138, cls: 'num', total: true,
              r: function (v) { return v > 0 ? '<span class="neg">' + tien(v) + '</span>' : '<span class="muted">0</span>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 132, r: function (v) { return T.pill(v); } }
        ];

        var g = new UI.Grid({
            mount: '#gh', rows: rows, pageSize: 25, luoi: 'gv-codong',
            height: 'calc(100vh - 470px)', sortK: 'tyLe', sortD: -1,
            search: ['ma', 'ten', 'dienThoai'],
            toolbar:
                '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Thêm cổ đông</button>' +
                '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
                '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
                '<span class="tb-sep"></span>' +
                '<button class="btn ok" data-tyle disabled><i class="bi bi-percent"></i> Đổi tỷ lệ sở hữu</button>' +
                '<button class="btn info-line" data-ls disabled><i class="bi bi-clock-history"></i> Lịch sử tỷ lệ</button>' +
                '<button class="btn info-line" data-so disabled><i class="bi bi-journal-text"></i> Sổ vốn cổ đông</button>' +
                '<span class="tb-sep"></span>' +
                '<button class="btn ok-solid" data-gop><i class="bi bi-arrow-down-circle"></i> Ghi nhận góp vốn</button>' +
                '<button class="btn danger" data-rut><i class="bi bi-arrow-up-circle"></i> Rút vốn</button>' +
                '<span class="tb-sep"></span>' +
                '<button class="btn" data-xuat><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
                '<button class="btn report" data-in><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>',
            filters: [{ k: 'trangThai', t: 'Trạng thái', w: 170, opts: T.VON_TT_CD }],
            cols: cols,
            actions: function () { return UI.btn('so', 'bi-journal-text', 'Sổ vốn cổ đông'); }, actionsW: 50,
            onAction: function (a, r) { if (a === 'so') soCoDong(r._r); },
            onSelect: UI.chonToolbar(host, ['sua', 'xoa', 'tyle', 'ls', 'so']),
            onOpen: function (r) { soCoDong(r._r); }
        });
        UI.apQuyen(host, MOD);

        function lamMoi() { rows = dong(); g.reload(rows); veCoDong(); }
        function chon() { var r = g.selected(); return r && r._r; }

        if (qs('[data-them]')) qs('[data-them]').onclick = function () { formCoDong(null, lamMoi); };
        if (qs('[data-sua]')) qs('[data-sua]').onclick = function () { var r = chon(); if (r) formCoDong(r, lamMoi); };
        if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () { var r = chon(); if (r) xoaCoDong(r, lamMoi); };
        if (qs('[data-tyle]')) qs('[data-tyle]').onclick = function () { var r = chon(); if (r) doiTyLe(r, lamMoi); };
        if (qs('[data-ls]')) qs('[data-ls]').onclick = function () { var r = chon(); if (r) lichSuTyLe(r); };
        if (qs('[data-so]')) qs('[data-so]').onclick = function () { var r = chon(); if (r) soCoDong(r); };
        if (qs('[data-gop]')) qs('[data-gop]').onclick = function () { formGD('Góp vốn', null, lamMoi); };
        if (qs('[data-rut]')) qs('[data-rut]').onclick = function () { formGD('Rút vốn', null, lamMoi); };
        if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
            UI.xuatExcel('CoDong', 'Danh sách cổ đông',
                cols.map(function (c) { return { t: c.t, k: c.k, w: 20 }; }), g.allRows);
        };
        if (qs('[data-in]')) qs('[data-in]').onclick = function () { inCoDong(g.allRows); };
    }

    /* ------------------------------------------------ biểu mẫu cổ đông */
    function formCoDong(rec, xong) {
        var moi = !rec;
        if (moi && !Q.co(MOD, 'them')) return UI.thieuQuyen(MOD, 'them');
        if (!moi && !Q.co(MOD, 'sua')) return UI.thieuQuyen(MOD, 'sua');
        var r = rec || { ma: '', ten: '', tyLe: 0, dienThoai: '', email: '',
                         ngayHieuLuc: T.today(), trangThai: 'Đang tham gia', ghiChu: '' };
        var h = UI.modal({
            size: 'md', title: moi ? 'Thêm cổ đông' : 'Sửa cổ đông — ' + T.esc(r.ten),
            sub: 'Cổ đông của ' + T.esc(dvVon.ten || ''),
            body:
                '<div class="grid2">' +
                '<div class="fld"><label>Mã cổ đông</label><input data-f="ma" value="' + T.esc(r.ma || '') +
                    '" placeholder="Tự sinh khi lưu"></div>' +
                '<div class="fld req"><label>Tên cổ đông</label><input data-f="ten" value="' + T.esc(r.ten || '') + '"></div>' +
                '<div class="fld' + (moi ? ' req' : '') + '"><label>Tỷ lệ sở hữu (%)</label>' +
                    '<input class="tyle" data-f="tyLe" value="' + T.soVe(r.tyLe || 0, 2) + '"' +
                    (moi ? '' : ' readonly title="Đổi tỷ lệ bằng nút “Đổi tỷ lệ sở hữu” để giữ nguyên lịch sử"') + '></div>' +
                '<div class="fld req"><label>Ngày hiệu lực</label><input type="date" data-f="ngayHieuLuc" value="' +
                    T.esc(r.ngayHieuLuc || T.today()) + '"></div>' +
                '<div class="fld"><label>Điện thoại</label><input data-f="dienThoai" value="' + T.esc(r.dienThoai || '') + '"></div>' +
                '<div class="fld"><label>Email</label><input data-f="email" value="' + T.esc(r.email || '') + '"></div>' +
                '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' +
                    W.opt(T.VON_TT_CD, r.trangThai || 'Đang tham gia') + '</select></div>' +
                '<div class="fld span2"><label>Ghi chú</label><textarea data-f="ghiChu" rows="2">' +
                    T.esc(r.ghiChu || '') + '</textarea></div>' +
                '</div>' +
                (moi ? '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>Tỷ lệ khai ở đây là ' +
                    '<b>mốc tỷ lệ đầu tiên</b>. Về sau muốn đổi thì dùng nút <b>Đổi tỷ lệ sở hữu</b> — ' +
                    'hệ thống ghi thêm một mốc mới và giữ nguyên toàn bộ lịch sử, dữ liệu cũ không bị sai.</div></div>' : ''),
            buttons: [
                { text: 'Hủy', click: function (x) { x.close(); } },
                { text: 'Lưu', cls: 'ok', icon: 'bi-save', click: function (x) {
                    if (!UI.validate(x.el, [
                        { k: 'ten' }, { k: 'ngayHieuLuc' },
                        { k: 'tyLe', test: function (v) { return !moi || T.so(v) > 0; },
                          msg: 'Tỷ lệ sở hữu phải lớn hơn 0' }
                    ])) return;
                    var v = UI.read(x.el);
                    var o = {
                        ma: String(v.ma || '').trim() || maMoi(),
                        ten: String(v.ten).trim(), dienThoai: v.dienThoai || '', email: v.email || '',
                        ngayHieuLuc: v.ngayHieuLuc, trangThai: v.trangThai, ghiChu: v.ghiChu || ''
                    };
                    if (moi) {
                        o.tyLe = T.so(v.tyLe);
                        o.lichSuTyLe = [{ tuNgay: o.ngayHieuLuc, tyLe: o.tyLe,
                                          lyDo: 'Tỷ lệ khởi tạo', ai: DB.user().taiKhoan, luc: T.now() }];
                        DB.insert('coDong', o);
                    } else {
                        o.tyLe = r.tyLe; o.lichSuTyLe = r.lichSuTyLe;
                        DB.update('coDong', r.id, T.gopGiu(DB.get('coDong', r.id), o));
                    }
                    DB.save(); x.close();
                    UI.toast('ok', moi ? 'Đã thêm cổ đông' : 'Đã lưu cổ đông', o.ten);
                    if (xong) xong();
                } }
            ],
            onOpen: function (x) { UI.numInput(x.el); }
        });
        return h;
    }
    function maMoi() {
        var n = 0;
        DB.all('coDong').forEach(function (x) {
            var m = /(\d+)$/.exec(x.ma || ''); if (m) n = Math.max(n, Number(m[1]));
        });
        return 'CD' + ('0' + (n + 1)).slice(-2);
    }

    function xoaCoDong(r, xong) {
        if (!Q.co(MOD, 'xoa')) return UI.thieuQuyen(MOD, 'xoa');
        var gd = DB.all('giaoDichVon').filter(function (g) {
            return g.coDongId === r.id && g.trangThai !== 'Đã hủy';
        });
        if (gd.length) return UI.khongThe('Xóa cổ đông',
            'Cổ đông ' + r.ten + ' đang có ' + gd.length + ' giao dịch vốn.',
            'Xóa cổ đông sẽ để lại giao dịch mồ côi. Hãy chuyển trạng thái sang “Đã rút” ' +
            'thay vì xóa, hoặc xóa các giao dịch trước.');
        var dot = DB.all('dotGopVon').filter(function (d) {
            return d.trangThai !== 'Đã hủy' &&
                   (d.phanBo || []).some(function (p) { return p.coDongId === r.id; });
        });
        if (dot.length) return UI.khongThe('Xóa cổ đông',
            'Cổ đông ' + r.ten + ' đang nằm trong ' + dot.length + ' đợt góp vốn.',
            'Hãy chuyển trạng thái sang “Đã rút” thay vì xóa để giữ đúng nghĩa vụ đã chốt của các đợt cũ.');
        UI.xoa(r.ten, function () {
            DB.remove('coDong', r.id);
            UI.toast('ok', 'Đã xóa cổ đông', r.ten);
            if (xong) xong();
        });
    }

    function doiTyLe(r, xong) {
        if (!Q.co(MOD, 'sua')) return UI.thieuQuyen(MOD, 'sua');
        var htai = T.tyLeCoDong(r);
        UI.modal({
            size: 'sm', title: 'Đổi tỷ lệ sở hữu — ' + T.esc(r.ten),
            sub: 'Tỷ lệ hiện hành ' + T.num(htai, 2) + '%',
            body: '<div class="grid2">' +
                '<div class="fld req"><label>Tỷ lệ mới (%)</label><input class="tyle" data-f="tyLe" value="' +
                    T.soVe(htai, 2) + '" style="font-size:16px;font-weight:700"></div>' +
                '<div class="fld req"><label>Áp dụng từ ngày</label><input type="date" data-f="tuNgay" value="' +
                    T.today() + '"></div>' +
                '<div class="fld span2"><label>Lý do thay đổi</label><input data-f="lyDo" placeholder="Ví dụ: Chuyển nhượng phần vốn góp"></div>' +
                '</div>' +
                '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>Hệ thống <b>ghi thêm một mốc mới</b>, ' +
                'không sửa và không xóa mốc cũ. Mọi đợt góp vốn đã tạo giữ nguyên nghĩa vụ đã chốt; ' +
                'chỉ những nghiệp vụ từ ngày áp dụng trở đi mới dùng tỷ lệ mới.</div></div>',
            buttons: [
                { text: 'Hủy', click: function (x) { x.close(); } },
                { text: 'Ghi nhận tỷ lệ mới', cls: 'ok', icon: 'bi-check-lg', click: function (x) {
                    if (!UI.validate(x.el, [
                        { k: 'tyLe', test: function (v) { return T.so(v) >= 0 && T.so(v) <= 100; },
                          msg: 'Tỷ lệ phải từ 0 đến 100' },
                        { k: 'tuNgay' }
                    ])) return;
                    var v = UI.read(x.el);
                    var cd = DB.get('coDong', r.id);
                    T.doiTyLeCoDong(cd, T.so(v.tyLe), v.tuNgay, v.lyDo || '');
                    DB.log('Đổi tỷ lệ sở hữu', 'coDong', cd);
                    DB.save(); x.close();
                    var tt = T.tongTyLe(v.tuNgay);
                    UI.toast(Math.abs(tt - 100) < 0.001 ? 'ok' : 'warn', 'Đã ghi nhận tỷ lệ mới',
                        cd.ten + ' — ' + T.num(T.so(v.tyLe), 2) + '% từ ' + T.date(v.tuNgay) +
                        '. Tổng tỷ lệ toàn bộ cổ đông hiện là ' + T.num(tt, 2) + '%.', 7000);
                    if (xong) xong();
                } }
            ],
            onOpen: function (x) { UI.numInput(x.el); }
        });
    }

    function lichSuTyLe(r) {
        var ds = (r.lichSuTyLe || []).slice().sort(function (a, b) {
            return a.tuNgay < b.tuNgay ? 1 : -1;
        });
        UI.modal({
            size: 'md', title: 'Lịch sử tỷ lệ sở hữu — ' + T.esc(r.ten),
            sub: ds.length + ' mốc thay đổi',
            body: bangDon(
                [{ t: 'Áp dụng từ', w: 120 }, { t: 'Tỷ lệ', w: 110, n: true }, { t: 'Lý do' },
                 { t: 'Người ghi', w: 130 }, { t: 'Thời điểm', w: 140 }],
                ds.map(function (x) {
                    return '<tr><td>' + T.date(x.tuNgay) + '</td>' +
                        '<td class="num"><b>' + T.num(x.tyLe, 2) + '%</b></td>' +
                        '<td>' + T.esc(x.lyDo || '—') + '</td>' +
                        '<td>' + T.esc(x.ai || '') + '</td>' +
                        '<td class="small muted">' + T.esc(x.luc || '') + '</td></tr>';
                })),
            buttons: [{ text: 'Đóng', cls: 'info-line', click: function (x) { x.close(); } }]
        });
    }

    /* ------------------------------------------------ sổ vốn của một cổ đông */
    function soCoDong(cd) {
        var l = loc();
        var s = T.soVonCoDong(cd, l);
        UI.modal({
            size: 'full', title: 'Sổ vốn cổ đông — ' + T.esc(cd.ten),
            sub: 'Tỷ lệ sở hữu ' + T.num(s.tyLe, 2) + '% · ' +
                 (l.tuNgay || l.denNgay ? 'kỳ ' + (l.tuNgay ? T.date(l.tuNgay) : '…') + ' → ' +
                    T.date(l.denNgay || T.today()) : 'toàn bộ dữ liệu'),
            body:
                '<div class="grid4">' +
                kpi('Đã góp', tien(s.daGop), 'đ', 'g') +
                kpi('Đã rút', tien(s.daRut), 'đ', s.daRut ? 'y' : '') +
                kpi('Vốn ròng', tien(s.vonRong), 'đ', 'c') +
                kpi('Còn thiếu', tien(s.thieu), 'đ', s.thieu ? 'r' : 'g') +
                '</div><div class="grid4 mt12">' +
                kpi('Lãi chậm góp', tien(s.lai), 'đ', s.lai ? 'y' : 'g') +
                kpi('Vốn đang quay vòng', tien(s.dangQuayVong), 'đ · phần tương ứng', 'c') +
                kpi('Lợi nhuận được chia', tien(s.duocChia), 'đ', 'g') +
                kpi('Thực nhận', tien(s.thucNhan), 'đ · sau khấu trừ ' + tien(s.khauTru), 'g') +
                '</div>' +
                the('Nhật ký giao dịch vốn', 'bi-journal-text',
                    bangDon([{ t: 'Ngày', w: 104 }, { t: 'Số chứng từ', w: 130 }, { t: 'Loại', w: 150 },
                             { t: 'Đợt', w: 140 }, { t: 'Số tiền', w: 160, n: true },
                             { t: 'Hình thức', w: 140 }, { t: 'Ghi chú' }],
                        s.nhatKy.map(function (g) {
                            var d = g.dotId ? DB.get('dotGopVon', g.dotId) : null;
                            return '<tr><td>' + T.date(g.ngay) + '</td>' +
                                '<td class="mono">' + T.esc(g.so || '') + '</td>' +
                                '<td>' + T.pill(g.loai) + '</td>' +
                                '<td>' + T.esc(d ? d.so : '—') + '</td>' +
                                '<td class="num"><b class="' + (g.loai === 'Rút vốn' ? 'neg' : 'pos') + '">' +
                                    tien(g.soTien) + '</b></td>' +
                                '<td>' + T.esc(g.hinhThuc || '') + '</td>' +
                                '<td class="small muted">' + T.esc(g.ghiChu || '') + '</td></tr>';
                        })), s.nhatKy.length + ' giao dịch'),
            buttons: [
                { text: 'Đóng', click: function (x) { x.close(); } },
                { text: 'Xuất báo cáo cổ đông', cls: 'report', icon: 'bi-file-earmark-bar-graph',
                  click: function () { inSoCoDong(cd, s); } }
            ]
        });
    }

    /* ------------------------------------------------ biểu mẫu giao dịch vốn */
    function formGD(loai, dotId, xong) {
        if (!Q.co(MOD, 'them')) return UI.thieuQuyen(MOD, 'them');
        var ds = T.dsCoDongTaiNgay();
        if (!ds.length) return UI.khongThe(loai,
            'Chưa có cổ đông nào đang tham gia.',
            'Mở thẻ Danh sách cổ đông và khai cổ đông trước.');
        var dsDot = DB.all('dotGopVon').filter(function (d) {
            return d.trangThai !== 'Đã hủy';
        }).map(function (d) { return { v: d.id, t: d.so + ' — ' + (d.lyDo || '') }; });

        UI.modal({
            size: 'md', title: loai === 'Rút vốn' ? 'Rút vốn' : 'Ghi nhận góp vốn',
            sub: loai === 'Rút vốn'
                ? 'Engine kiểm tra quỹ vốn khả dụng trước khi cho rút'
                : 'Ghi nhận một lần góp vốn thực tế của cổ đông',
            body:
                '<div class="grid2">' +
                '<div class="fld"><label>Số chứng từ</label><input data-f="so" placeholder="Tự sinh khi lưu"></div>' +
                '<div class="fld req"><label>Ngày</label><input type="date" data-f="ngay" value="' + T.today() + '"></div>' +
                '<div class="fld req"><label>Cổ đông</label><select data-f="coDongId">' +
                    '<option value=""></option>' +
                    W.opt(ds.map(function (x) { return { v: x.id, t: x.ten + ' (' + T.num(x.tyLe, 2) + '%)' }; }), '') +
                    '</select></div>' +
                '<div class="fld"><label>Đợt góp vốn</label><select data-f="dotId">' +
                    '<option value="">— Không thuộc đợt nào —</option>' + W.opt(dsDot, dotId || '') + '</select></div>' +
                '<div class="fld req"><label>Số tiền (đ)</label><input class="tien" data-f="soTien" value="0" ' +
                    'style="font-size:17px;font-weight:700"></div>' +
                '<div class="fld"><label>Hình thức</label><select data-f="hinhThuc">' +
                    W.opt(T.VON_HINH_THUC, 'Chuyển khoản') + '</select></div>' +
                '<div class="fld span2"><label>Ghi chú</label><textarea data-f="ghiChu" rows="2"></textarea></div>' +
                '</div><div id="gvCanhBao"></div>',
            buttons: [
                { text: 'Hủy', click: function (x) { x.close(); } },
                { text: loai === 'Rút vốn' ? 'Xác nhận rút vốn' : 'Lưu',
                  cls: loai === 'Rút vốn' ? 'danger-solid' : 'ok-solid',
                  icon: loai === 'Rút vốn' ? 'bi-arrow-up-circle' : 'bi-save',
                  click: function (x) {
                    if (!UI.validate(x.el, [
                        { k: 'ngay' }, { k: 'coDongId', msg: 'Phải chọn cổ đông' },
                        { k: 'soTien', test: function (v) { return T.so(v) > 0; }, msg: 'Số tiền phải lớn hơn 0' }
                    ])) return;
                    var v = UI.read(x.el);
                    /* Ghi qua ĐÚNG MỘT CỬA của Engine — mọi phép kiểm tra, kể cả
                       chốt cửa rút vốn, nằm trong đó chứ không nằm ở màn hình. */
                    var kq = T.ghiGiaoDichVon({
                        so: String(v.so || '').trim(),
                        ngay: v.ngay, coDongId: v.coDongId, dotId: v.dotId || '',
                        loai: loai, soTien: T.so(v.soTien),
                        hinhThuc: v.hinhThuc || 'Chuyển khoản', ghiChu: v.ghiChu || '',
                        donVi: (dvVon.id || ''), nguoiLapId: (Q.nhanVienCuaToi() || {}).id || '',
                        nguoiLap: (Q.nhanVienCuaToi() || {}).hoTen || DB.user().hoTen || ''
                    });
                    if (!kq.rec) return UI.khongThe(loai,
                        'Hệ thống KHÔNG ghi giao dịch này:',
                        kq.loi.join('<br>') +
                        '<br><br>Chưa có dòng dữ liệu nào được ghi. Hãy sửa lại số liệu, ' +
                        'giảm số tiền rút, hoặc hoàn tất các nghĩa vụ nhập hàng trước.');
                    x.close();
                    var cd = DB.get('coDong', kq.rec.coDongId) || {};
                    UI.toast('ok', 'Đã ghi nhận ' + loai.toLowerCase(),
                        cd.ten + ' — ' + tien(kq.rec.soTien) + ' đ · chứng từ ' + kq.rec.so);
                    if (xong) xong();
                } }
            ],
            onOpen: function (x) {
                UI.numInput(x.el);
                if (loai !== 'Rút vốn') return;
                var q = T.quyVon();
                x.el.querySelector('#gvCanhBao').innerHTML =
                    '<div class="note ' + (q.sauCamKet > 0 ? 'b' : 'y') + ' mt12">' +
                    '<i class="bi bi-shield-check"></i><div>' +
                    'Quỹ vốn khả dụng <b>' + tien(q.khaDung) + ' đ</b> · nhu cầu vốn đã cam kết cho nhập hàng <b>' +
                    tien(q.nhuCau.tong) + ' đ</b> (lô chưa nhập kho ' + tien(q.nhuCau.loChuaNhap) +
                    ' đ · nợ nhà cung cấp ' + tien(q.nhuCau.noNCC) + ' đ).<br>' +
                    'Mức rút tối đa hiện nay: <b>' + tien(Math.max(0, q.sauCamKet)) + ' đ</b>.' +
                    '</div></div>';
            }
        });
    }

    /* ================================================== 3. ĐỢT GÓP VỐN */
    function veDot() {
        var l = loc();
        body.innerHTML = '<div id="gvKpi" class="kpis"></div><div id="gh"></div>';
        var moi = T.tinhMoiDot(l.denNgay);
        var th = moi.tongHop;
        var rows = moi.ds.map(function (k) {
            var d = k.dot;
            return { id: d.id, so: d.so, lyDo: d.lyDo || '', ngay: d.ngay, hanGop: d.hanGop || '',
                     laiSuat: Number(d.laiSuat) || T.cauHinhVon().laiSuat,
                     tienCongTy: T.dotChoPhepTienCongTy(d) ? 'Có áp dụng' : '',
                     giaTriHuyDong: Number(d.giaTriHuyDong) || 0,
                     nghiaVuMoi: k.nghiaVuMoi, nhan: k.nhan, chuyenDi: k.chuyenDi,
                     phaiGop: k.phaiGop, daGop: k.daGop, thieu: k.thieu, vuot: k.vuot, lai: k.lai,
                     tyLeHoanThanh: k.tyLeHoanThanh, trangThai: T.ttDot(d),
                     _r: d, _k: k };
        });
        DB.all('dotGopVon').filter(function (d) { return d.trangThai === 'Đã hủy'; }).forEach(function (d) {
            rows.push({ id: d.id, so: d.so, lyDo: d.lyDo || '', ngay: d.ngay, hanGop: d.hanGop || '',
                laiSuat: 0, tienCongTy: T.dotChoPhepTienCongTy(d) ? 'Có áp dụng' : '',
                giaTriHuyDong: Number(d.giaTriHuyDong) || 0,
                nghiaVuMoi: 0, nhan: 0, chuyenDi: 0, phaiGop: 0, daGop: 0,
                thieu: 0, vuot: 0, lai: 0, tyLeHoanThanh: 0, trangThai: 'Đã hủy', _r: d, _k: null });
        });

        host.querySelector('#gvKpi').innerHTML =
            kpi('Số đợt góp vốn', T.num(rows.length, 0), 'đang huy động: ' +
                T.num(rows.filter(function (r) { return r.trangThai === 'Đang huy động'; }).length, 0), '') +
            kpi('Nghĩa vụ đang hoạt động', tien(th.nghiaVuHoatDong), 'đ',
                'không cộng phần chuyển đợt', '') +
            kpi('Đã thực hiện', tien(th.daThucHien), 'đ', 'g') +
            kpi('Còn thiếu', tien(th.conThieu), 'đ', th.conThieu > 0 ? 'r' : 'g') +
            kpi('Đã chuyển sang đợt khác', tien(th.daChuyenSangDotKhac), 'đ',
                th.daChuyenSangDotKhac > 0 ? 'c' : '') +
            kpi('Lãi chậm góp', tien(th.lai), 'đ', th.lai > 0 ? 'y' : 'g');

        var cols = [
            { k: 'so', t: 'Mã đợt', w: 128, cls: 'mono', r: function (v) { return '<b>' + T.esc(v) + '</b>'; } },
            { k: 'lyDo', t: 'Lý do huy động' },
            { k: 'ngay', t: 'Ngày tạo', w: 106, cls: 'num', fmt: 'date' },
            { k: 'hanGop', t: 'Ngày phải góp', w: 118, cls: 'num', r: function (v, r) {
                if (!v) return '<span class="muted">—</span>';
                var tre = r.thieu > 0 && T.today() > v;
                return (tre ? '<b class="neg">' : '') + T.date(v) + (tre ? '</b>' : ''); } },
            { k: 'laiSuat', t: 'Lãi suất', w: 92, cls: 'num', r: function (v) { return T.num(v, 2) + '%/năm'; } },
            { k: 'tienCongTy', t: 'Tiền công ty', w: 112, r: function (v) {
                return v ? '<span class="pill g">Có áp dụng</span>' : '<span class="muted">—</span>'; } },
            { k: 'nghiaVuMoi', t: 'Nghĩa vụ mới', w: 150, cls: 'num', fmt: 'money', total: true },
            { k: 'nhan', t: 'Nhận từ đợt trước', w: 150, cls: 'num', total: true,
              r: function (v) { return v > 0 ? '<span class="pos">' + tien(v) + '</span>'
                                             : '<span class="muted">0</span>'; } },
            { k: 'phaiGop', t: 'Tổng nghĩa vụ', w: 156, cls: 'num', total: true,
              r: function (v) { return '<b>' + tien(v) + '</b>'; } },
            { k: 'daGop', t: 'Đã thực hiện', w: 152, cls: 'num', total: true,
              r: function (v) { return '<span class="pos">' + tien(v) + '</span>'; } },
            { k: 'thieu', t: 'Còn thiếu', w: 148, cls: 'num', total: true,
              r: function (v) { return v > 0 ? '<b class="neg">' + tien(v) + '</b>' : '<span class="muted">0</span>'; } },
            { k: 'tyLeHoanThanh', t: 'Tiến độ', w: 150, cls: 'num', r: function (v) {
                return '<b>' + T.num(v, 1) + '%</b>' + thanh(v, v >= 100); } },
            { k: 'lai', t: 'Lãi chậm góp', w: 138, cls: 'num', total: true,
              r: function (v) { return v > 0 ? '<span class="neg">' + tien(v) + '</span>' : '<span class="muted">0</span>'; } },
            { k: 'trangThai', t: 'Trạng thái', w: 122, r: function (v) { return T.pill(v); } }
        ];

        var g = new UI.Grid({
            mount: '#gh', rows: rows, pageSize: 25, luoi: 'gv-dot',
            height: 'calc(100vh - 470px)', sortK: 'ngay', sortD: -1,
            search: ['so', 'lyDo'],
            toolbar:
                '<button class="btn primary" data-them><i class="bi bi-plus-lg"></i> Tạo đợt góp vốn</button>' +
                '<button class="btn" data-sua disabled><i class="bi bi-pencil"></i> Sửa</button>' +
                '<button class="btn danger" data-xoa disabled><i class="bi bi-trash"></i> Xóa</button>' +
                '<span class="tb-sep"></span>' +
                '<button class="btn info-line" data-ct disabled><i class="bi bi-list-columns"></i> Xem chi tiết</button>' +
                '<span class="tb-sep"></span>' +
                '<button class="btn ok-solid" data-gop><i class="bi bi-arrow-down-circle"></i> Ghi nhận tiền góp</button>' +
                '<button class="btn warn" data-chuyen disabled><i class="bi bi-arrow-right-circle"></i> ' +
                'Chuyển phần còn thiếu sang đợt sau</button>' +
                '<button class="btn info-line" data-phanbo><i class="bi bi-diagram-3"></i> Phân bổ tiền bán hàng</button>' +
                '<span class="tb-sep"></span>' +
                '<button class="btn warn" data-chia disabled><i class="bi bi-percent"></i> Chia lại theo tỷ lệ</button>' +
                '<button class="btn ok" data-dong disabled><i class="bi bi-lock"></i> Đóng đợt</button>' +
                '<span class="tb-sep"></span>' +
                '<button class="btn" data-xuat><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
                '<button class="btn report" data-in><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>',
            filters: [{ k: 'trangThai', t: 'Trạng thái', w: 170, opts: T.VON_TT_DOT }],
            cols: cols,
            actions: function () { return UI.btn('ct', 'bi-list-columns', 'Chi tiết phân bổ'); }, actionsW: 50,
            onAction: function (a, r) { if (a === 'ct') chiTietDot(r._r); },
            onSelect: UI.chonToolbar(host, ['sua', 'xoa', 'ct', 'chia', 'chuyen', 'dong']),
            onOpen: function (r) { chiTietDot(r._r); }
        });
        UI.apQuyen(host, MOD);

        function lamMoi() { veDot(); }
        function chon() { var r = g.selected(); return r && r._r; }

        if (qs('[data-them]')) qs('[data-them]').onclick = function () { formDot(null, lamMoi); };
        if (qs('[data-sua]')) qs('[data-sua]').onclick = function () { var r = chon(); if (r) formDot(r, lamMoi); };
        if (qs('[data-xoa]')) qs('[data-xoa]').onclick = function () { var r = chon(); if (r) xoaDot(r, lamMoi); };
        if (qs('[data-ct]')) qs('[data-ct]').onclick = function () { var r = chon(); if (r) chiTietDot(r); };
        if (qs('[data-chia]')) qs('[data-chia]').onclick = function () { var r = chon(); if (r) chiaLaiDot(r, lamMoi); };
        if (qs('[data-gop]')) qs('[data-gop]').onclick = function () {
            var r = chon(); ghiTienGop(r ? r.id : null, lamMoi); };
        if (qs('[data-chuyen]')) qs('[data-chuyen]').onclick = function () {
            var r = chon(); if (r) chuyenThieu(r, lamMoi); };
        if (qs('[data-dong]')) qs('[data-dong]').onclick = function () { var r = chon(); if (r) dongDot(r, lamMoi); };
        if (qs('[data-phanbo]')) qs('[data-phanbo]').onclick = function () {
            var r = chon();
            phanBoTien(r ? r.id : null, lamMoi);
        };
        if (qs('[data-xuat]')) qs('[data-xuat]').onclick = function () {
            UI.xuatExcel('DotGopVon', 'Đợt góp vốn',
                cols.map(function (c) { return { t: c.t, k: c.k, w: 20 }; }), g.allRows);
        };
        if (qs('[data-in]')) qs('[data-in]').onclick = function () { inDot(g.allRows); };
    }

    function formDot(rec, xong) {
        var moi = !rec;
        if (moi && !Q.co(MOD, 'them')) return UI.thieuQuyen(MOD, 'them');
        if (!moi && !Q.co(MOD, 'sua')) return UI.thieuQuyen(MOD, 'sua');
        if (!moi && rec.trangThai === 'Đã đóng')
            return UI.khongThe('Sửa đợt góp vốn', 'Đợt ' + rec.so + ' đã đóng.',
                'Đợt đã đóng là dữ liệu đã chốt. Muốn sửa thì mở lại đợt trước.');
        var ds = T.dsCoDongTaiNgay(rec ? rec.ngay : T.today());
        if (moi && !ds.length) return UI.khongThe('Tạo đợt góp vốn',
            'Chưa có cổ đông nào đang tham gia.',
            'Mở thẻ Danh sách cổ đông và khai cổ đông trước — Engine cần tỷ lệ sở hữu để chia nghĩa vụ góp.');
        var r = rec || { so: '', lyDo: '', ngay: T.today(), hanGop: T.addDays(T.today(), 30),
                         giaTriHuyDong: 0, laiSuat: T.cauHinhVon().laiSuat,
                         trangThai: 'Đang huy động', ghiChu: '', choPhepTienCongTy: false };
        UI.modal({
            size: 'md', title: moi ? 'Tạo đợt góp vốn' : 'Sửa đợt góp vốn — ' + T.esc(r.so),
            sub: 'Engine tự chia giá trị cần huy động theo tỷ lệ sở hữu — không nhập tay phần phải góp',
            body:
                '<div class="grid2">' +
                '<div class="fld"><label>Mã đợt</label><input data-f="so" value="' + T.esc(r.so || '') +
                    '" placeholder="Tự sinh khi lưu"></div>' +
                '<div class="fld req"><label>Ngày tạo</label><input type="date" data-f="ngay" value="' +
                    T.esc(r.ngay) + '"></div>' +
                '<div class="fld span2 req"><label>Lý do huy động</label><input data-f="lyDo" value="' +
                    T.esc(r.lyDo || '') + '" placeholder="Ví dụ: Nhập lô hàng quý IV"></div>' +
                '<div class="fld req"><label>Giá trị cần huy động (đ)</label><input class="tien" data-f="giaTriHuyDong" value="' +
                    T.soVe(r.giaTriHuyDong || 0, 0) + '" style="font-size:17px;font-weight:700"></div>' +
                '<div class="fld req"><label>Ngày phải góp</label><input type="date" data-f="hanGop" value="' +
                    T.esc(r.hanGop || '') + '"></div>' +
                '<div class="fld"><label>Lãi suất chậm góp (%/năm)</label><input class="tyle" data-f="laiSuat" value="' +
                    T.soVe(r.laiSuat, 2) + '"></div>' +
                '<div class="fld"><label>Trạng thái</label><select data-f="trangThai">' +
                    W.opt(T.VON_TT_DOT, T.ttDot(r)) + '</select></div>' +
                '<div class="fld span2"><label>Ghi chú</label><textarea data-f="ghiChu" rows="2">' +
                    T.esc(r.ghiChu || '') + '</textarea></div>' +
                '<div class="fld span2"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">' +
                    '<input type="checkbox" data-f="choPhepTienCongTy"' +
                    (r.choPhepTienCongTy ? ' checked' : '') + ' style="width:16px;height:16px;flex:none">' +
                    'Đợt này CÓ chủ trương cho phép dùng TIỀN CÔNG TY (tiền bán hàng) thực hiện nghĩa vụ</label>' +
                    '<div class="small muted" style="margin-top:4px">Mặc định TẮT. Tiền bán hàng KHÔNG mặc nhiên ' +
                    'là tiền góp vốn — chỉ khi bật cơ chế này, chức năng “Phân bổ tiền bán hàng” mới được phép ' +
                    'ghi vào nghĩa vụ của đợt. Tiền cổ đông tự nộp không bị ảnh hưởng.</div></div>' +
                '</div><div id="gvXem"></div>',
            buttons: [
                { text: 'Hủy', click: function (x) { x.close(); } },
                { text: 'Lưu', cls: 'ok', icon: 'bi-save', click: function (x) {
                    if (!UI.validate(x.el, [
                        { k: 'ngay' }, { k: 'lyDo' }, { k: 'hanGop' },
                        { k: 'giaTriHuyDong', test: function (v) { return T.so(v) > 0; },
                          msg: 'Giá trị cần huy động phải lớn hơn 0' }
                    ])) return;
                    var v = UI.read(x.el);
                    if (v.hanGop < v.ngay) return UI.toast('err', 'Dữ liệu chưa hợp lệ',
                        'Ngày phải góp không được trước ngày tạo đợt.');
                    var o = {
                        so: String(v.so || '').trim() || (r.so || T.soVonMoi('DOT')),
                        lyDo: v.lyDo, ngay: v.ngay, hanGop: v.hanGop,
                        giaTriHuyDong: Math.round(T.so(v.giaTriHuyDong)),
                        laiSuat: T.so(v.laiSuat), trangThai: v.trangThai,
                        choPhepTienCongTy: !!v.choPhepTienCongTy,
                        ghiChu: v.ghiChu || '', donVi: dvVon.id || '',
                        nguoiLapId: (Q.nhanVienCuaToi() || {}).id || '',
                        nguoiLap: (Q.nhanVienCuaToi() || {}).hoTen || DB.user().hoTen || ''
                    };
                    var dot;
                    if (moi) { dot = DB.insert('dotGopVon', o); }
                    else { dot = DB.update('dotGopVon', r.id, T.gopGiu(DB.get('dotGopVon', r.id), o)) ||
                                 DB.get('dotGopVon', r.id); }
                    /* Chia nghĩa vụ góp theo tỷ lệ sở hữu — Engine làm, không nhập tay. */
                    T.taoPhanBoDot(dot);
                    DB.save(); x.close();
                    UI.toast('ok', moi ? 'Đã tạo đợt góp vốn ' + dot.so : 'Đã lưu đợt ' + dot.so,
                        'Engine đã chia ' + tien(dot.giaTriHuyDong) + ' đ cho ' +
                        (dot.phanBo || []).length + ' cổ đông theo tỷ lệ sở hữu.', 7000);
                    if (xong) xong();
                } }
            ],
            onOpen: function (x) {
                UI.numInput(x.el);
                function xem() {
                    var v = UI.read(x.el);
                    var d2 = T.dsCoDongTaiNgay(v.ngay || T.today());
                    var chia = T.chiaTheoTyLe(T.so(v.giaTriHuyDong), d2);
                    x.el.querySelector('#gvXem').innerHTML = the('Engine sẽ chia như sau', 'bi-calculator',
                        bangDon([{ t: 'Cổ đông' }, { t: 'Tỷ lệ', w: 110, n: true }, { t: 'Phải góp', w: 170, n: true }],
                            chia.map(function (c) {
                                return '<tr><td><b>' + T.esc(c.ten) + '</b></td>' +
                                    '<td class="num">' + T.num(c.tyLe, 2) + '%</td>' +
                                    '<td class="num"><b>' + tien(c.soTien) + '</b></td></tr>';
                            })) +
                        '<div class="small muted mt12">Tổng chia ra: <b>' +
                        tien(T.sum(chia, function (c) { return c.soTien; })) +
                        ' đ</b> — luôn bằng đúng giá trị cần huy động, phần lẻ do làm tròn dồn vào dòng cuối.</div>',
                        d2.length + ' cổ đông · tổng tỷ lệ ' + T.num(T.sum(d2, function (y) { return y.tyLe; }), 2) + '%');
                }
                xem();
                ['giaTriHuyDong', 'ngay'].forEach(function (f) {
                    var e = x.el.querySelector('[data-f="' + f + '"]');
                    if (e) { e.addEventListener('change', xem); e.addEventListener('blur', xem); }
                });
            }
        });
    }

    function chiaLaiDot(r, xong) {
        if (!Q.co(MOD, 'sua')) return UI.thieuQuyen(MOD, 'sua');
        if (r.trangThai === 'Đã đóng') return UI.khongThe('Chia lại theo tỷ lệ',
            'Đợt ' + r.so + ' đã đóng.', 'Mở lại đợt trước khi chia lại.');
        UI.confirm({
            title: 'Chia lại nghĩa vụ góp theo tỷ lệ', icon: 'bi-percent',
            message: 'Chia lại <b>' + tien(r.giaTriHuyDong) + ' đ</b> của đợt <b>' + T.esc(r.so) +
                '</b> theo tỷ lệ sở hữu tại ngày ' + T.date(r.ngay) + '.',
            note: 'Các lần <b>đã góp thực tế không bị đụng tới</b> — chỉ phần <i>phải góp</i> được tính lại. ' +
                'Dùng khi tỷ lệ sở hữu đã thay đổi hoặc khi đổi giá trị cần huy động.',
            /* UI.confirm tự đóng hộp rồi gọi ok() không kèm tham số. */
            okText: 'Chia lại', ok: function () {
                var d = DB.get('dotGopVon', r.id);
                T.taoPhanBoDot(d); DB.log('Chia lại phân bổ', 'dotGopVon', d); DB.save();
                UI.toast('ok', 'Đã chia lại đợt ' + d.so,
                    (d.phanBo || []).length + ' cổ đông · tổng ' + tien(d.giaTriHuyDong) + ' đ');
                if (xong) xong();
            }
        });
    }

    /* ======================================================================
       PHÂN BỔ TIỀN CỦA CÔNG TY VỀ NGHĨA VỤ GÓP VỐN            (v18.3.0)
       ----------------------------------------------------------------------
       Người dùng nhập số tiền và ngày. Phần mềm TÍNH TRƯỚC và cho xem toàn bộ
       kế hoạch: ai được bao nhiêu, vào đợt nào, vì sao, phần nào không phân bổ
       được. Không ghi một dòng nào cho tới khi người dùng bấm xác nhận.

       Ba điều phần mềm KHÔNG làm, và nói thẳng trên màn hình:
         · không chuyển phần dôi ra của cổ đông này sang cổ đông khác;
         · không phân bổ quá số còn thiếu thật của từng người;
         · không tự chạy — chỉ chạy khi người dùng bấm.
       ====================================================================== */
    function phanBoTien(dotId, xong) {
        if (!Q.co(MOD, 'them')) return UI.thieuQuyen(MOD, 'them');
        /* KHÔNG ĐƯỢC BỎ QUA BƯỚC: phân bổ tiền công ty là thực hiện NGHĨA VỤ
           của các đợt còn thiếu — chưa có đợt thì không có gì để phân bổ. */
        if (!DB.all('dotGopVon').some(function (d) { return d.trangThai !== 'Đã hủy'; }))
            return UI.khongThe('Phân bổ tiền bán hàng',
                'Chưa có đợt góp vốn. Vui lòng tạo đợt góp vốn trước.',
                'Mở thẻ Quy trình hoặc thẻ Đợt góp vốn và bấm "Tạo đợt góp vốn" trước, ' +
                'sau đó mới phân bổ tiền của công ty vào nghĩa vụ còn thiếu.');
        /* CƠ CHẾ GẮN VỚI TỪNG ĐỢT (v18.10.0): tiền bán hàng không mặc nhiên là
           tiền góp vốn — chỉ đợt có bật "cho phép dùng tiền công ty" mới nhận
           phân bổ. Không có đợt như vậy thì bước này KHÔNG áp dụng. */
        var dsApDung = T.dsDotChoPhepTienCongTy();
        if (!dsApDung.length)
            return UI.khongThe('Phân bổ tiền bán hàng',
                'Không có đợt góp vốn nào áp dụng cơ chế cho phép dùng tiền công ty.',
                'Tiền bán hàng KHÔNG mặc nhiên là tiền góp vốn. Chỉ khi một đợt góp vốn có ' +
                'chủ trương cho phép dùng tiền công ty (bật ngay khi tạo hoặc sửa đợt) thì mới ' +
                'được phân bổ. Nếu đợt của bạn có chủ trương này, mở <b>Sửa đợt</b> và bật ' +
                '“Cho phép dùng tiền công ty”. Nếu không, bước phân bổ tiền công ty được bỏ qua ' +
                'chính thức — không cần tạo dữ liệu gì.');
        if (dotId) {
            var dCh = DB.get('dotGopVon', dotId);
            if (dCh && !T.dotChoPhepTienCongTy(dCh))
                return UI.khongThe('Phân bổ tiền bán hàng',
                    'Đợt ' + T.esc(dCh.so) + ' không áp dụng cơ chế dùng tiền công ty.',
                    'Đợt này không có chủ trương cho phép dùng tiền bán hàng thực hiện nghĩa vụ. ' +
                    'Muốn phân bổ vào đợt này thì mở <b>Sửa đợt</b> và bật cơ chế trước; hoặc chọn ' +
                    'đợt khác có áp dụng cơ chế.');
        }
        var dot = dotId ? DB.get('dotGopVon', dotId) : null;
        var l = loc();
        var ngayMD = l.denNgay || T.today();

        UI.modal({
            size: 'full', title: 'Phân bổ tiền về nghĩa vụ góp vốn',
            sub: 'Chia tiền của công ty cho các cổ đông theo tỷ lệ sở hữu, chặn trần đúng ở ' +
                 'số mỗi người còn thiếu' + (dot ? ' — chỉ trong đợt ' + T.esc(dot.so) : ''),
            body:
                '<div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap">' +
                '<div><label class="small muted">Số tiền phân bổ (đ)</label>' +
                '<input type="text" id="pbSo" class="tien" style="width:200px" value=""></div>' +
                '<div><label class="small muted">Ngày phân bổ</label>' +
                '<input type="date" id="pbNgay" style="width:160px" value="' + T.esc(ngayMD) + '"></div>' +
                '<div><label class="small muted">Phạm vi</label>' +
                '<select id="pbDot" style="width:280px">' +
                '<option value="">Tất cả các đợt CÓ áp dụng cơ chế tiền công ty</option>' +
                dsApDung.map(function (d) {
                        return '<option value="' + d.id + '"' + (dot && d.id === dot.id ? ' selected' : '') +
                            '>' + T.esc(d.so + ' — ' + (d.lyDo || '')) + '</option>';
                    }).join('') + '</select></div>' +
                '<div><label class="small muted">Hình thức</label>' +
                '<select id="pbHT" style="width:170px">' + T.VON_HINH_THUC.map(function (h) {
                    return '<option>' + T.esc(h) + '</option>'; }).join('') + '</select></div>' +
                '<button class="btn warn" id="pbTinh"><i class="bi bi-calculator"></i> Tính thử</button>' +
                '</div>' +
                '<div class="note b" style="margin-top:10px"><i class="bi bi-info-circle"></i><div>' +
                'Tỷ lệ dùng để <b>chia tiền</b> là tỷ lệ sở hữu có hiệu lực tại <b>ngày phân bổ</b>. ' +
                'Tỷ lệ dùng để tính <b>nghĩa vụ phải góp</b> đã được ghi cứng trong từng đợt tại ' +
                'thời điểm đợt phát sinh và <b>không bị tính lại</b>.</div></div>' +
                '<div id="pbKQ" style="margin-top:10px"></div>',
            buttons: [
                { text: 'Đóng', cls: '', click: function (m) { m.close(); } },
                { text: 'Ghi sổ kế hoạch này', cls: 'primary', id: 'pbGhi',
                  click: function (m) { ghi(m); } }
            ]
        });

        var ke = null;
        var mdSo = document.getElementById('pbSo');
        var mdNgay = document.getElementById('pbNgay');
        var mdDot = document.getElementById('pbDot');
        var mdKQ = document.getElementById('pbKQ');
        if (mdSo) { try { UI.numInput(mdSo.parentNode); } catch (e) { } mdSo.focus(); }
        var bt = document.getElementById('pbTinh');
        if (bt) bt.onclick = tinh;
        veTrong();

        function veTrong() {
            ke = null;
            mdKQ.innerHTML = '<div class="trong"><i class="bi bi-calculator"></i>' +
                '<b>Chưa tính</b>Khai số tiền rồi bấm “Tính thử”. Phần mềm chỉ tính để xem, ' +
                'chưa ghi gì vào dữ liệu.</div>';
        }
        function soTienNhap() { return Math.round(T.so(mdSo.value) || 0); }
        function tinh() {
            var st = soTienNhap();
            if (st <= 0) { veTrong(); return UI.toast('canh', 'Chưa khai số tiền',
                'Nhập số tiền lớn hơn 0 rồi bấm Tính thử.'); }
            ke = T.phanBoTienGop({ soTien: st, ngay: mdNgay.value || T.today(),
                                   dotId: mdDot.value || '' });
            mdKQ.innerHTML = veKe(ke);
        }
        function veKe(k) {
            if (k.loi && k.loi.length)
                return '<div class="note r"><i class="bi bi-x-octagon"></i><div><b>Chưa tính được</b><br>' +
                    k.loi.map(T.esc).join('<br>') + '</div></div>';
            var h = '<div class="kpis">' +
                kpi('Số tiền phân bổ', tien(k.soTien), 'đ', '') +
                kpi('Tổng còn thiếu', tien(k.tongThieu), 'đ', k.tongThieu > 0 ? 'r' : 'g') +
                kpi('Phân bổ được', tien(k.tongPhanBo), 'đ', 'g') +
                kpi('Chưa phân bổ', tien(k.chuaPhanBo), 'đ', k.chuaPhanBo > 0 ? 'y' : 'g') +
                '</div>';
            h += '<div class="tablewrap" style="margin-top:10px"><table class="grid"><thead><tr>' +
                '<th>Cổ đông</th><th class="num">Tỷ lệ tại ngày phân bổ</th>' +
                '<th class="num">Phần theo tỷ lệ</th><th class="num">Còn thiếu thật</th>' +
                '<th class="num">Được phân bổ</th><th class="num">Dôi ra (giữ nguyên)</th>' +
                '<th>Vì sao</th></tr></thead><tbody>' +
                k.theoCoDong.map(function (c) {
                    return '<tr><td><b>' + T.esc(c.ten) + '</b></td>' +
                        '<td class="num">' + T.num(c.tyLe, 2) + '%</td>' +
                        '<td class="num">' + tien(c.phanTheoTyLe) + '</td>' +
                        '<td class="num">' + tien(c.thieu) + '</td>' +
                        '<td class="num"><b class="pos">' + tien(c.phanBo) + '</b></td>' +
                        '<td class="num">' + (c.thua > 0 ? '<b class="neg">' + tien(c.thua) + '</b>'
                                                         : '<span class="muted">0</span>') + '</td>' +
                        '<td class="small">' + T.esc(c.lyDo) + '</td></tr>';
                }).join('') + '</tbody></table></div>';
            h += '<div class="small muted" style="margin:10px 0 4px"><b>CHI TIẾT THEO TỪNG ĐỢT</b> — ' +
                'mỗi đợt là một nghĩa vụ độc lập, đợt sau không ghi đè đợt trước.</div>';
            h += k.dong.length
                ? '<div class="tablewrap"><table class="grid"><thead><tr>' +
                  '<th>Cổ đông</th><th>Đợt</th><th class="num">Hạn góp</th>' +
                  '<th class="num">Tỷ lệ nghĩa vụ của đợt</th><th class="num">Thiếu trước</th>' +
                  '<th class="num">Phân bổ</th><th class="num">Thiếu sau</th></tr></thead><tbody>' +
                  k.dong.map(function (d) {
                      return '<tr><td>' + T.esc(d.ten) + '</td><td class="mono">' + T.esc(d.dotSo) + '</td>' +
                          '<td class="num">' + (d.hanGop ? T.date(d.hanGop) : '—') + '</td>' +
                          '<td class="num">' + T.num(d.tyLeNghiaVu, 2) + '%</td>' +
                          '<td class="num">' + tien(d.thieuTruoc) + '</td>' +
                          '<td class="num"><b class="pos">' + tien(d.phanBo) + '</b></td>' +
                          '<td class="num">' + tien(d.thieuSau) + '</td></tr>';
                  }).join('') + '</tbody></table></div>'
                : '<div class="note g"><i class="bi bi-check-circle"></i><div>' +
                  '<b>Không có nghĩa vụ nào còn thiếu</b> ở phạm vi đang chọn — không phân bổ dòng nào.</div></div>';
            if (k.chuaPhanBo > 0)
                h += '<div class="note y" style="margin-top:10px"><i class="bi bi-exclamation-triangle"></i>' +
                    '<div><b>' + tien(k.chuaPhanBo) + ' đ chưa được phân bổ.</b> Phần mềm ' +
                    '<b>KHÔNG</b> đẩy số này sang cổ đông khác cho hết tiền — làm thế là lấy tiền của ' +
                    'người này trả nghĩa vụ của người kia. Số tiền này vẫn nằm ở quỹ của công ty.</div></div>';
            (k.canhBao || []).forEach(function (c) {
                h += '<div class="note b" style="margin-top:8px"><i class="bi bi-info-circle"></i><div>' +
                    T.esc(c) + '</div></div>';
            });
            return h;
        }
        function ghi(m) {
            if (!ke) return UI.toast('canh', 'Chưa tính kế hoạch', 'Bấm “Tính thử” trước đã.');
            if (!ke.dong.length) return UI.toast('canh', 'Không có gì để ghi',
                'Kế hoạch không có dòng phân bổ nào.');
            UI.confirm({
                title: 'Ghi sổ ' + ke.dong.length + ' giao dịch góp vốn',
                icon: 'bi-arrow-down-circle-fill',
                message: 'Ghi <b>' + tien(ke.tongPhanBo) + ' đ</b> thành <b>' + ke.dong.length +
                    '</b> giao dịch “Góp vốn” đúng theo kế hoạch đang xem.',
                note: 'Mỗi giao dịch được ghi qua đúng cửa kiểm tra của phân hệ vốn và có thể xem lại, ' +
                    'sửa hoặc hủy như mọi giao dịch khác. Phần chưa phân bổ <b>không</b> được ghi.',
                /* UI.confirm tự đóng hộp xác nhận rồi mới gọi ok() KHÔNG kèm
                   tham số — không được gọi x.close() ở đây (x là undefined,
                   sẽ ném lỗi ngay sau khi đã ghi sổ và làm màn hình không
                   được vẽ lại). */
                okText: 'Ghi sổ', ok: function () {
                    var kq = T.ghiPhanBoTienGop(ke, { hinhThuc: document.getElementById('pbHT').value,
                        ghiChu: 'Phân bổ tiền công ty về nghĩa vụ góp vốn' });
                    if (kq.loi.length)
                        UI.toast('err', 'Có ' + kq.loi.length + ' dòng không ghi được', kq.loi.join(' · '));
                    if (kq.rec.length) {
                        UI.toast('ok', 'Đã ghi ' + kq.rec.length + ' giao dịch góp vốn',
                            'Tổng ' + tien(ke.tongPhanBo) + ' đ');
                        m.close();
                        if (xong) xong();
                    }
                }
            });
        }
    }

    function dongDot(r, xong) {
        if (!Q.co(MOD, 'duyet')) return UI.thieuQuyen(MOD, 'duyet');
        if (r.trangThai === 'Đã đóng') return UI.khongThe('Đóng đợt', 'Đợt ' + r.so + ' đã đóng rồi.', '');
        var k = T.tinhDot(r);
        UI.confirm({
            title: 'Đóng đợt góp vốn ' + T.esc(r.so),
            icon: k.thieu > 0 ? 'bi-exclamation-triangle-fill' : 'bi-lock-fill',
            danger: k.thieu > 0,
            message: 'Đã góp <b>' + tien(k.daGop) + ' đ</b> trên <b>' + tien(k.phaiGop) + ' đ</b> phải góp' +
                (k.thieu > 0 ? ' — <b class="neg">còn thiếu ' + tien(k.thieu) + ' đ</b>.' : ' — đã đủ.'),
            note: k.thieu > 0
                ? 'Đóng đợt khi chưa góp đủ thì <b>lãi chậm góp vẫn tiếp tục được tính</b> trên phần còn thiếu. ' +
                  'Phần thiếu không tự biến mất.'
                : 'Đợt đã đóng sẽ không sửa được nữa cho tới khi mở lại.',
            /* UI.confirm tự đóng hộp rồi gọi ok() không kèm tham số. */
            okText: 'Đóng đợt', ok: function () {
                var d = DB.get('dotGopVon', r.id);
                d.trangThai = 'Đã đóng'; DB.log('Đóng đợt góp vốn', 'dotGopVon', d); DB.save();
                UI.toast('ok', 'Đã đóng đợt ' + d.so, ''); if (xong) xong();
            }
        });
    }

    function xoaDot(r, xong) {
        if (!Q.co(MOD, 'xoa')) return UI.thieuQuyen(MOD, 'xoa');
        var gd = DB.all('giaoDichVon').filter(function (g) {
            return g.dotId === r.id && g.trangThai !== 'Đã hủy';
        });
        if (gd.length) return UI.khongThe('Xóa đợt góp vốn',
            'Đợt ' + r.so + ' đang có ' + gd.length + ' giao dịch vốn.',
            'Xóa đợt sẽ để lại giao dịch mồ côi. Hãy xóa các giao dịch trước, ' +
            'hoặc chuyển trạng thái đợt sang “Đã hủy”.');
        UI.xoa('đợt góp vốn ' + r.so, function () {
            DB.remove('dotGopVon', r.id);
            UI.toast('ok', 'Đã xóa đợt góp vốn', r.so); if (xong) xong();
        });
    }

    /* ==================================================================
       CHI TIẾT MỘT ĐỢT — bốn khu vực đúng mục XII của lệnh 18.4.0:
         A. Thông tin đợt
         B. Theo từng cổ đông
         C. Nguồn hình thành nghĩa vụ
         D. Lịch sử phân bổ tiền
       ================================================================== */
    function chiTietDot(r) {
        var l = loc();
        var k = T.tinhDot(r, l.denNgay);
        var tt = T.ttDot(r);
        var lsDot = (r.laiSuat === undefined || r.laiSuat === null || r.laiSuat === '')
            ? T.cauHinhVon().laiSuat : Number(r.laiSuat) || 0;

        /* --- C. Nguồn hình thành nghĩa vụ: gom theo đợt nguồn --- */
        var nguon = {};
        k.theoCoDong.forEach(function (c) {
            (c.dsNhan || []).forEach(function (n) {
                var key = n.tuDotSo || '(không rõ)';
                nguon[key] = (nguon[key] || 0) + (Number(n.soTien) || 0);
            });
        });
        var dongNguon = Object.keys(nguon).map(function (so) {
            return '<tr><td>Nhận chuyển từ đợt <b>' + T.esc(so) + '</b></td>' +
                '<td class="num">' + tien(nguon[so]) + '</td></tr>';
        });
        dongNguon.unshift('<tr><td>Nghĩa vụ mới của chính đợt này</td>' +
            '<td class="num">' + tien(k.nghiaVuMoi) + '</td></tr>');
        if (k.chuyenDi > 0)
            dongNguon.push('<tr><td class="muted">Đã chuyển sang đợt sau (trừ ra)</td>' +
                '<td class="num muted">− ' + tien(k.chuyenDi) + '</td></tr>');
        dongNguon.push('<tr class="dam"><td><b>TỔNG NGHĨA VỤ CỦA ĐỢT</b></td>' +
            '<td class="num"><b>' + tien(k.phaiGop) + '</b></td></tr>');

        /* --- D. Lịch sử phân bổ tiền --- */
        var dongTien = [];
        k.theoCoDong.forEach(function (c) {
            (c.dsTien || []).forEach(function (t) {
                dongTien.push({ ngay: t.ngay, ten: c.ten, soTien: t.soTien,
                                nguonTien: t.nguonTien, ct: t.chungTuSo,
                                gd: (t.gd && t.gd.so) || '' });
            });
        });
        dongTien.sort(function (a, b) { return a.ngay < b.ngay ? 1 : -1; });

        UI.modal({
            size: 'full', title: 'Đợt góp vốn ' + T.esc(r.so),
            sub: (r.lyDo || '') + ' · tạo ngày ' + T.date(r.ngay) +
                 (r.hanGop ? ' · phải góp trước ' + T.date(r.hanGop) : '') +
                 ' · lãi chậm góp ' + T.num(lsDot, 2) + '%/năm · ' + tt +
                 ' · tiền công ty: ' + (T.dotChoPhepTienCongTy(r) ? 'CÓ áp dụng cơ chế' : 'không áp dụng'),
            body:
                /* ---------------- A. THÔNG TIN ĐỢT ---------------- */
                '<div class="grid4">' +
                kpi('Nghĩa vụ mới', tien(k.nghiaVuMoi), 'đ', '') +
                kpi('Nhận từ đợt trước', tien(k.nhan), 'đ', k.nhan ? 'c' : '') +
                kpi('Tổng nghĩa vụ', tien(k.phaiGop), 'đ', 'b') +
                kpi('Đã thực hiện', tien(k.daGop), 'đ', 'g') +
                '</div>' +
                '<div class="grid4 mt8">' +
                kpi('Còn thiếu', tien(k.thieu), 'đ', k.thieu ? 'r' : 'g') +
                kpi('Đã chuyển đi', tien(k.chuyenDi), 'đ', k.chuyenDi ? 'c' : '') +
                kpi('Lãi chậm góp', tien(k.lai), 'đ', k.lai ? 'y' : 'g') +
                kpi(k.vuot > 0 ? 'ĐÃ VƯỢT' : 'Còn phải trả lãi',
                    tien(k.vuot > 0 ? k.vuot : k.laiConLai), 'đ', k.vuot > 0 ? 'c' : 'y') +
                '</div>' +
                '<div class="mt12">' + thanh(k.tyLeHoanThanh, k.tyLeHoanThanh >= 100) + '</div>' +
                '<div class="small muted" style="margin-top:4px">Tiến độ ' + T.num(k.tyLeHoanThanh, 1) + '%' +
                (k.quaHan && k.thieu > 0 ? ' · <b class="neg">đã quá hạn góp</b>' : '') +
                (k.vuot > 0 ? ' · <b>đã thực hiện vượt nghĩa vụ ' + tien(k.vuot) + ' đ</b>' : '') +
                '</div>' +

                /* ---------------- B. THEO TỪNG CỔ ĐÔNG ---------------- */
                the('B. Theo từng cổ đông', 'bi-people',
                    bangDon([{ t: 'Cổ đông' }, { t: 'Tỷ lệ', w: 74, n: true },
                             { t: 'Nghĩa vụ mới', w: 132, n: true },
                             { t: 'Nhận từ đợt trước', w: 138, n: true },
                             { t: 'Tổng phải thực hiện', w: 142, n: true },
                             { t: 'Cổ đông nộp', w: 130, n: true },
                             { t: 'Tiền bán hàng', w: 130, n: true },
                             { t: 'Tổng đã thực hiện', w: 138, n: true },
                             { t: 'Còn thiếu', w: 130, n: true },
                             { t: 'Lãi chậm góp', w: 130, n: true }],
                        k.theoCoDong.map(function (x) {
                            return '<tr><td><b>' + T.esc(x.ten) + '</b></td>' +
                                '<td class="num">' + T.num(x.tyLe, 2) + '%</td>' +
                                '<td class="num">' + tien(x.nghiaVuMoi) + '</td>' +
                                '<td class="num">' + (x.nhan ? tien(x.nhan) : '<span class="muted">0</span>') + '</td>' +
                                '<td class="num"><b>' + tien(x.phaiGop) + '</b></td>' +
                                '<td class="num"><span class="pos">' + tien(x.gopTrucTiep) + '</span></td>' +
                                '<td class="num">' + (x.tienBanHang ? tien(x.tienBanHang)
                                    : '<span class="muted">0</span>') + '</td>' +
                                '<td class="num"><b class="pos">' + tien(x.daGop) + '</b></td>' +
                                '<td class="num">' + (x.thieu > 0 ? '<b class="neg">' + tien(x.thieu) + '</b>'
                                    : '<span class="muted">0</span>') +
                                (x.vuot > 0 ? '<br><span class="small">vượt ' + tien(x.vuot) + '</span>' : '') + '</td>' +
                                '<td class="num">' + (x.lai > 0 ? '<span class="neg">' + tien(x.lai) + '</span>'
                                    : '<span class="muted">0</span>') + '</td></tr>';
                        })),
                    'Tổng phải thực hiện ' + tien(k.phaiGop) + ' đ') +

                /* ---------------- C. NGUỒN HÌNH THÀNH NGHĨA VỤ ---------------- */
                the('C. Nghĩa vụ của đợt này hình thành từ đâu', 'bi-diagram-3',
                    bangDon([{ t: 'Nguồn hình thành' }, { t: 'Số tiền', w: 180, n: true }], dongNguon),
                    'Phần nhận chuyển KHÔNG phải nghĩa vụ mới — nó đã nằm trong đợt sinh ra nó, ' +
                    'nên tổng toàn hệ thống không cộng hai lần') +

                /* ---------------- D. LỊCH SỬ PHÂN BỔ TIỀN ---------------- */
                the('D. Lịch sử phân bổ tiền vào nghĩa vụ của đợt', 'bi-clock-history',
                    bangDon([{ t: 'Ngày', w: 104 }, { t: 'Cổ đông' }, { t: 'Nguồn tiền', w: 190 },
                             { t: 'Chứng từ', w: 150 }, { t: 'Số tiền phân bổ', w: 160, n: true }],
                        dongTien.map(function (t) {
                            return '<tr><td>' + T.date(t.ngay) + '</td>' +
                                '<td>' + T.esc(t.ten) + '</td>' +
                                '<td>' + T.pill(t.nguonTien) + '</td>' +
                                '<td class="mono small">' + T.esc(t.ct || t.gd || '—') + '</td>' +
                                '<td class="num"><b>' + tien(t.soTien) + '</b></td></tr>';
                        })), dongTien.length + ' lần phân bổ') +

                /* ---------------- LÃI CHẬM GÓP TỪNG KHOẢNG ---------------- */
                (k.lai > 0 ? the('Lãi chậm góp — từng khoảng thời gian', 'bi-calculator',
                    bangDon([{ t: 'Cổ đông' }, { t: 'Nội dung' },
                             { t: 'Phần còn thiếu', w: 140, n: true },
                             { t: 'Từ ngày', w: 100 }, { t: 'Đến ngày', w: 100 },
                             { t: 'Số ngày', w: 78, n: true }, { t: 'Lãi suất', w: 80, n: true },
                             { t: 'Tiền lãi', w: 130, n: true }, { t: 'Vì sao khoảng này kết thúc' }],
                        k.theoCoDong.reduce(function (acc, x) {
                            (x.dongLai || []).forEach(function (d) {
                                acc.push('<tr><td>' + T.esc(x.ten) + '</td>' +
                                    '<td class="small">' + T.esc(d.noiDung) + '</td>' +
                                    '<td class="num">' + tien(d.thieu) + '</td>' +
                                    '<td>' + T.date(d.tuNgay) + '</td>' +
                                    '<td>' + T.date(d.denNgay) + '</td>' +
                                    '<td class="num">' + T.num(d.soNgay, 0) + '</td>' +
                                    '<td class="num">' + T.num(d.laiSuat, 2) + '%</td>' +
                                    '<td class="num"><b>' + tien(d.lai) + '</b></td>' +
                                    '<td class="small muted">' + T.esc(d.lyDoKetThuc) + '</td></tr>');
                            });
                            return acc;
                        }, []).concat(['<tr class="dam"><td colspan="7"><b>TỔNG LÃI CHẬM GÓP CỦA ĐỢT</b></td>' +
                            '<td class="num"><b>' + tien(k.lai) + '</b></td><td></td></tr>'])) +
                    ghiChuNguon('Lãi chỉ tính trên <b>phần còn thiếu thật</b> của từng khoảng thời gian, ' +
                        'theo công thức <b>phần thiếu × lãi suất năm × số ngày ÷ 365</b>. Mỗi lần nghĩa vụ ' +
                        'được thực hiện thêm, hệ thống tự cắt sang một khoảng mới với số thiếu nhỏ hơn — ' +
                        'lãi của những ngày trước đó giữ nguyên. <b>Khoản nghĩa vụ được chuyển từ đợt trước ' +
                        'vẫn tính lãi từ hạn góp gốc của nó</b>, vì chuyển đợt là dời chỗ nghĩa vụ chứ ' +
                        'không xóa việc đã chậm.')) : ''),
            buttons: [
                { text: 'Đóng', click: function (x) { x.close(); } },
                { text: 'Ghi nhận tiền góp', cls: 'ok-solid', icon: 'bi-arrow-down-circle',
                  click: function (x) { x.close(); ghiTienGop(r.id, function () { veDot(); }); } },
                { text: 'Chuyển phần còn thiếu sang đợt sau', cls: 'warn', icon: 'bi-arrow-right-circle',
                  click: function (x) { x.close(); chuyenThieu(r, function () { veDot(); }); } },
                { text: 'Xuất báo cáo đợt', cls: 'report', icon: 'bi-file-earmark-bar-graph',
                  click: function () { inChiTietDot(r, k); } }
            ]
        });
    }

    /* ==================================================================
       CHUYỂN PHẦN CÒN THIẾU SANG ĐỢT SAU
       ================================================================== */
    function chuyenThieu(r, xong) {
        if (!Q.co(MOD, 'sua')) return UI.thieuQuyen(MOD, 'sua');
        var l = loc();
        var k = T.tinhDot(r, l.denNgay);
        if (k.thieu <= 0) return UI.khongThe('Chuyển phần còn thiếu',
            'Đợt ' + r.so + ' không còn khoản thiếu nào.',
            'Chỉ chuyển được phần nghĩa vụ chưa thực hiện.');
        var sau = DB.all('dotGopVon').filter(function (d) {
            return d.id !== r.id && T.dotConHieuLuc(d) && T.ttDot(d) !== 'Đã đóng' &&
                   String(d.ngay || '') >= String(r.ngay || '');
        });
        if (!sau.length) return UI.khongThe('Chuyển phần còn thiếu',
            'Chưa có đợt nào lập sau đợt ' + r.so + ' để nhận.',
            'Hãy tạo đợt góp vốn mới trước, rồi chuyển phần còn thiếu sang đợt đó.');

        UI.modal({
            size: 'lg', title: 'Chuyển phần còn thiếu của đợt ' + T.esc(r.so) + ' sang đợt sau',
            sub: 'Nghĩa vụ chưa thực hiện được dời sang đợt sau, lịch sử đợt này vẫn giữ nguyên',
            body:
                '<div class="note b"><i class="bi bi-info-circle"></i><div>' +
                'Phần chuyển đi <b>không bị xóa khỏi lịch sử</b> của đợt ' + T.esc(r.so) + ' — đợt này vẫn ' +
                'ghi rõ đã chuyển bao nhiêu, sang đợt nào, ngày nào. Đợt nhận ghi rõ nhận từ đâu.<br>' +
                '<b>Lãi chậm góp KHÔNG được xóa:</b> khoản chuyển đi vẫn tính lãi từ hạn góp gốc ' +
                (r.hanGop ? '(' + T.date(r.hanGop) + ')' : '') + ', vì chuyển đợt là dời chỗ nghĩa vụ ' +
                'chứ không phải xóa việc đã chậm.</div></div>' +
                '<div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:10px">' +
                '<div><label class="small muted">Chuyển sang đợt</label>' +
                '<select id="cvDot" style="width:320px">' + sau.map(function (d) {
                    return '<option value="' + d.id + '">' + T.esc(d.so + ' — ' + (d.lyDo || '')) +
                        ' (' + T.date(d.ngay) + ')</option>'; }).join('') + '</select></div>' +
                '<div><label class="small muted">Ngày chuyển</label>' +
                '<input type="date" id="cvNgay" style="width:160px" value="' + T.esc(T.today()) + '"></div>' +
                '</div>' +
                '<div style="margin-top:8px"><label class="small muted">Lý do / ghi chú</label>' +
                '<input type="text" id="cvGhi" style="width:100%" placeholder="Ví dụ: gia hạn nghĩa vụ sang đợt sau"></div>' +
                the('Các khoản sẽ được chuyển', 'bi-list-check',
                    bangDon([{ t: 'Cổ đông' }, { t: 'Còn thiếu sẽ chuyển', w: 190, n: true }],
                        k.theoCoDong.filter(function (x) { return x.thieu > 0; }).map(function (x) {
                            return '<tr><td>' + T.esc(x.ten) + '</td>' +
                                '<td class="num"><b>' + tien(x.thieu) + '</b></td></tr>';
                        }).concat(['<tr class="dam"><td><b>TỔNG CHUYỂN</b></td><td class="num"><b>' +
                            tien(k.thieu) + '</b></td></tr>']))),
            buttons: [
                { text: 'Hủy', click: function (x) { x.close(); } },
                { text: 'Chuyển sang đợt đã chọn', cls: 'primary', icon: 'bi-arrow-right-circle',
                  click: function (x) {
                      var den = document.getElementById('cvDot').value;
                      var ngay = document.getElementById('cvNgay').value;
                      var ghi = document.getElementById('cvGhi').value;
                      var kq = T.chuyenNghiaVu({ tuDotId: r.id, denDotId: den, ngay: ngay, ghiChu: ghi });
                      if (kq.loi.length)
                          return UI.toast('err', 'Không chuyển được', kq.loi.join(' · '));
                      x.close();
                      UI.toast('ok', 'Đã chuyển ' + tien(kq.tong) + ' đ',
                          kq.so + ' cổ đông · sang đợt ' + (DB.get('dotGopVon', den) || {}).so);
                      if (xong) xong();
                  } }
            ]
        });
    }

    /* ==================================================================
       GHI NHẬN TIỀN CỔ ĐÔNG THỰC TẾ GÓP — phân bổ vào một hoặc nhiều nghĩa vụ
       ================================================================== */
    function ghiTienGop(dotId, xong) {
        if (!Q.co(MOD, 'them')) return UI.thieuQuyen(MOD, 'them');
        var ds = DB.all('coDong').filter(function (c) { return c.trangThai !== 'Đã rút'; });
        if (!ds.length) return UI.khongThe('Ghi nhận tiền góp',
            'Chưa khai cổ đông nào.',
            'Mở bước 01 — Danh sách cổ đông và khai cổ đông trước.');
        /* KHÔNG ĐƯỢC BỎ QUA BƯỚC: tiền góp được gán vào NGHĨA VỤ của một đợt.
           Chưa có đợt góp vốn thì chưa có nghĩa vụ nào để gán — dừng lại và
           dẫn người dùng về đúng bước, không cho tạo dữ liệu thiếu liên kết. */
        var coDot = DB.all('dotGopVon').some(function (d) { return d.trangThai !== 'Đã hủy'; });
        if (!coDot) return UI.khongThe('Ghi nhận tiền góp',
            'Chưa có đợt góp vốn. Vui lòng tạo đợt góp vốn trước.',
            'Mở thẻ Quy trình hoặc thẻ Đợt góp vốn và bấm "Tạo đợt góp vốn" — Engine sẽ tự ' +
            'phân bổ nghĩa vụ cho từng cổ đông theo tỷ lệ sở hữu, sau đó mới ghi nhận tiền góp.');

        UI.modal({
            size: 'full', title: 'Ghi nhận tiền cổ đông thực tế góp',
            sub: 'Nhập khoản tiền, rồi chỉ định khoản đó thực hiện nghĩa vụ của (những) đợt nào',
            body:
                '<div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap">' +
                '<div><label class="small muted">Cổ đông</label>' +
                '<select id="gtCd" style="width:220px">' + ds.map(function (c) {
                    return '<option value="' + c.id + '">' + T.esc(c.ten) + '</option>'; }).join('') +
                '</select></div>' +
                '<div><label class="small muted">Ngày góp</label>' +
                '<input type="date" id="gtNgay" style="width:150px" value="' + T.esc(T.today()) + '"></div>' +
                '<div><label class="small muted">Số tiền (đ)</label>' +
                '<input type="text" class="tien" id="gtSo" style="width:180px"></div>' +
                '<div><label class="small muted">Phương thức</label>' +
                '<select id="gtHT" style="width:160px">' + T.VON_HINH_THUC.map(function (h) {
                    return '<option>' + T.esc(h) + '</option>'; }).join('') + '</select></div>' +
                '<div><label class="small muted">Chứng từ</label>' +
                '<input type="text" id="gtCT" style="width:170px" placeholder="Số UNC / phiếu thu"></div>' +
                '<button class="btn warn" id="gtRai"><i class="bi bi-magic"></i> Gợi ý phân bổ</button>' +
                '</div>' +
                '<div style="margin-top:8px"><label class="small muted">Ghi chú</label>' +
                '<input type="text" id="gtGhi" style="width:100%"></div>' +
                '<div class="note b" style="margin-top:10px"><i class="bi bi-info-circle"></i><div>' +
                'Phần mềm <b>không tự gán</b> khoản tiền này vào đợt đang mở. Anh chỉ định khoản này ' +
                'thực hiện nghĩa vụ của đợt nào — hoặc bấm <b>Gợi ý phân bổ</b> để hệ thống rải theo ' +
                '<b>hạn góp sớm nhất trước</b>, rồi sửa lại tùy ý.</div></div>' +
                '<div id="gtBang" style="margin-top:10px"></div>',
            buttons: [
                { text: 'Hủy', click: function (x) { x.close(); } },
                { text: 'Ghi nhận', cls: 'primary', icon: 'bi-check2',
                  click: function (x) { luu(x); } }
            ]
        });

        var mdCd = document.getElementById('gtCd');
        var mdSo = document.getElementById('gtSo');
        var mdNgay = document.getElementById('gtNgay');
        try { UI.numInput(document.getElementById('gtBang').parentNode); } catch (e) { }
        if (dotId) { /* mở từ một đợt cụ thể thì ưu tiên đợt đó */ }
        veBang();
        mdCd.onchange = veBang;
        mdNgay.onchange = veBang;
        document.getElementById('gtRai').onclick = function () { veBang(true); };

        function veBang(goiY) {
            var cd = mdCd.value, ngay = mdNgay.value || T.today();
            var st = Math.round(T.so(mdSo.value) || 0);
            var ds2 = T.dotConThieuCua(cd, ngay, '');
            if (dotId && !ds2.some(function (x) { return x.dotId === dotId; })) {
                var d0 = DB.get('dotGopVon', dotId);
                if (d0) ds2.unshift({ dotId: d0.id, dotSo: d0.so,
                    hanGop: d0.hanGop || d0.ngay || '', thieu: 0 });
            }
            var con = st;
            var h = ds2.length
                ? bangDon([{ t: 'Đợt' }, { t: 'Hạn góp', w: 110 }, { t: 'Còn thiếu', w: 150, n: true },
                           { t: 'Phân bổ vào đợt này', w: 190, n: true }],
                    ds2.map(function (x) {
                        var g = 0;
                        if (goiY && con > 0) { g = Math.min(con, x.thieu); con -= g; }
                        return '<tr><td><b>' + T.esc(x.dotSo) + '</b></td>' +
                            '<td>' + (x.hanGop ? T.date(x.hanGop) : '—') + '</td>' +
                            '<td class="num">' + tien(x.thieu) + '</td>' +
                            '<td class="num"><input type="text" class="tien" data-pb="' + x.dotId +
                            '" style="width:150px;text-align:right" value="' + (g ? T.money(g) : '') +
                            '"></td></tr>';
                    }))
                : '<div class="note g"><i class="bi bi-check-circle"></i><div>' +
                  '<b>Cổ đông này không còn nghĩa vụ nào đang thiếu.</b> Vẫn ghi nhận được khoản tiền, ' +
                  'nhưng khoản đó sẽ nằm ở dạng chưa phân bổ vào nghĩa vụ nào.</div></div>';
            document.getElementById('gtBang').innerHTML = h;
            try { UI.numInput(document.getElementById('gtBang')); } catch (e) { }
        }

        function luu(x) {
            var st = Math.round(T.so(mdSo.value) || 0);
            if (st <= 0) return UI.toast('canh', 'Chưa khai số tiền', 'Nhập số tiền lớn hơn 0.');
            var pb = [];
            document.querySelectorAll('#gtBang [data-pb]').forEach(function (e) {
                var v = Math.round(T.so(e.value) || 0);
                if (v > 0) pb.push({ dotId: e.getAttribute('data-pb'), soTien: v });
            });
            var tong = T.sum(pb, function (p) { return p.soTien; });
            if (tong > st) return UI.toast('err', 'Phân bổ vượt số tiền',
                'Tổng phân bổ ' + tien(tong) + ' đ lớn hơn số tiền nộp ' + tien(st) + ' đ.');
            var r = T.ghiTienGopCoDong({
                coDongId: mdCd.value, ngay: mdNgay.value, soTien: st,
                hinhThuc: document.getElementById('gtHT').value,
                chungTuSo: document.getElementById('gtCT').value,
                ghiChu: document.getElementById('gtGhi').value, phanBo: pb });
            if (!r.rec) return UI.toast('err', 'Không ghi được', (r.loi || []).join(' · '));
            x.close();
            UI.toast('ok', 'Đã ghi nhận ' + tien(st) + ' đ',
                pb.length ? 'Phân bổ vào ' + pb.length + ' đợt' : 'Chưa phân bổ vào nghĩa vụ nào');
            if (xong) xong();
        }
    }

    /* ================================================== 4. THU HỒI GIÁ VỐN */
    function veThuHoi() {
        var l = loc();
        var qk = T.quyVonKy(l);
        var q = T.quyVon(l);
        var k = qk.ky;
        var kq = T.ketQuaKinhDoanh(T.locVon(l));
        var nhom = T.ketQuaKinhDoanh(l);
        var tong = qk.daThuHoi + qk.vonTrongHang.cuoiKy;
        var pctThuHoi = tong ? qk.daThuHoi / tong * 100 : 0;

        var h = '<div class="note b"><i class="bi bi-calendar-range"></i><div>' +
            '<b>Kỳ báo cáo: ' + T.esc(k.nhan) + '.</b> Giá vốn đang nằm trong hàng lấy bằng cách ' +
            '<b>phát lại sổ kho tới hết ngày ' + T.date(k.den) + '</b>, không suy ngược từ số hôm nay.' +
            '</div></div>' +
            '<div class="kpis">' +
            /* Ba chỉ tiêu tách bạch (v18.6.0 — Logic 2). */
            kpi('Cổ đông đã thực góp', tien(qk.coDongNop.cuoiKy),
                'đ · tiền cá nhân cổ đông nộp vào', 'g') +
            kpi('Tiền công ty đã phân bổ vào nghĩa vụ', tien(qk.phanBoBanHang.cuoiKy),
                'đ · tiền bán hàng, không phải tiền cổ đông', 'c') +
            kpi('Giá vốn đã thu hồi trong kỳ', tien(qk.daThuHoi), 'đ · giá vốn hàng đã bán', 'g') +
            kpi('Giá vốn đang nằm trong hàng', tien(qk.vonTrongHang.cuoiKy),
                'đ · đầu kỳ ' + tien(qk.vonTrongHang.dauKy), 'c') +
            kpi('Tỷ lệ đã thu hồi', T.num(pctThuHoi, 1) + '%', 'trên tổng vốn đã bỏ vào hàng',
                pctThuHoi >= 50 ? 'g' : 'y') +
            kpi('TIỀN THỰC TẾ đang có', tien(qk.tienThucTe.cuoiKy), 'đ · quỹ ban đầu 0',
                qk.tienThucTe.cuoiKy < 0 ? 'r' : 'g') +
            kpi('Quỹ vốn quay vòng', tien(qk.quyQuayVong.cuoiKy), 'đ · tiền + hàng', 'c') +
            '</div>';

        h += the('Vòng quay vốn của toàn hệ thống', 'bi-arrow-repeat',
            '<div class="bars">' +
            '<div class="bar-row"><div class="ellip">Đã thu hồi</div>' +
                thanh(pctThuHoi, true) + '<div class="bar-val">' + tien(qk.daThuHoi) + '</div></div>' +
            '<div class="bar-row"><div class="ellip">Đang nằm trong hàng</div>' +
                thanh(100 - pctThuHoi, false) + '<div class="bar-val">' + tien(qk.vonTrongHang.cuoiKy) + '</div></div>' +
            '</div>' +
            ghiChuNguon('<b>Phân hệ vốn theo dõi ở mức QUỸ VỐN QUAY VÒNG CỦA TOÀN HỆ THỐNG, ' +
                'không theo từng lô nhập.</b> TVERP tính giá vốn theo bình quân gia quyền di động, ' +
                'nên một đơn vị hàng trong kho không còn nhớ nó đến từ lô nào — phân hệ này ' +
                '<b>giữ nguyên tuyệt đối thuật toán đó</b>, không chuyển sang nhập trước xuất trước và ' +
                'không tạo liên kết giữa chứng từ bán với từng lô nhập. ' +
                'Số “giá vốn đã thu hồi” lấy thẳng từ Business Engine: đó là giá vốn kho thực tế của ' +
                'toàn bộ hàng đã bán trong kỳ.'));

        h += '<div class="grid2" style="align-items:start">' +
            the('Cơ cấu vốn', 'bi-pie-chart',
                vanhKhuyen([{ l: 'Đã thu hồi', v: qk.daThuHoi },
                            { l: 'Đang nằm trong hàng', v: qk.vonTrongHang.cuoiKy }],
                    T.num(pctThuHoi, 0) + '%', 'đã thu hồi')) +
            the('Nhu cầu vốn đã cam kết', 'bi-cart-check',
                bangDon([{ t: 'Khoản mục' }, { t: 'Giá trị', w: 180, n: true }],
                    [
                        '<tr><td>Lô nhập hàng chưa vào kho <span class="small muted">(Chờ kiểm tra · Chờ nhập kho)</span></td>' +
                            '<td class="num"><b>' + tien(q.nhuCau.loChuaNhap) + '</b></td></tr>',
                        '<tr><td>Công nợ phải trả nhà cung cấp</td>' +
                            '<td class="num"><b>' + tien(q.nhuCau.noNCC) + '</b></td></tr>',
                        '<tr><td><b>Tổng nhu cầu vốn</b></td>' +
                            '<td class="num"><b class="neg">' + tien(q.nhuCau.tong) + '</b></td></tr>',
                        '<tr><td>Tiền thực tế còn lại sau khi trừ cam kết</td>' +
                            '<td class="num"><b class="' + (q.sauCamKet >= 0 ? 'pos' : 'neg') + '">' +
                            tien(q.sauCamKet) + '</b></td></tr>'
                    ]),
                q.nhuCau.dsLo.length + ' lô chờ · ' + q.nhuCau.dsNcc.length + ' nhà cung cấp') +
            '</div>';

        if (q.nhuCau.dsLo.length)
            h += the('Các lô nhập hàng đang chờ vốn', 'bi-hourglass-split',
                bangDon([{ t: 'Số lô', w: 130 }, { t: 'Ngày', w: 104 }, { t: 'Nhà cung cấp' },
                         { t: 'Trạng thái', w: 150 }, { t: 'Giá trị cần', w: 170, n: true }],
                    q.nhuCau.dsLo.map(function (lo) {
                        return '<tr><td class="mono">' + T.esc(lo.so) + '</td>' +
                            '<td>' + T.date(lo.ngay) + '</td>' +
                            '<td>' + T.esc(lo.nhaCungCap || '') + '</td>' +
                            '<td>' + T.pill(lo.trangThai) + '</td>' +
                            '<td class="num"><b>' + tien(lo.tongGiaVon || lo.tongTienHang || 0) + '</b></td></tr>';
                    })),
                'Đọc trực tiếp từ phân hệ Nhập hàng');

        h += the('Đối chiếu với Business Engine', 'bi-shield-check',
            bangDon([{ t: 'Chỉ tiêu' }, { t: 'Giá trị', w: 190, n: true }, { t: 'Nguồn số liệu', w: 320 }],
                [
                    '<tr><td>Doanh thu ' + T.esc(dvVon.tat || 'đơn vị nguồn') + '</td><td class="num">' +
                        tien(kq.doanhThu) + '</td><td class="small muted">T.ketQuaKinhDoanh — chuỗi chứng từ bán hàng</td></tr>',
                    '<tr><td>Giá vốn của đơn vị nguồn</td><td class="num">' + tien(kq.giaVon) +
                        '</td><td class="small muted">T.ketQuaKinhDoanh — giá vốn bình quân gia quyền</td></tr>',
                    '<tr><td>Giá vốn kho thực tế toàn nhóm</td><td class="num">' + tien(nhom.giaVonGoc) +
                        '</td><td class="small muted">Phải bằng đúng dòng trên</td></tr>',
                    '<tr><td>Chênh lệch</td><td class="num"><b class="' +
                        (Math.abs(kq.giaVon - nhom.giaVonGoc) <= 4 ? 'pos' : 'neg') + '">' +
                        tien(kq.giaVon - nhom.giaVonGoc) + '</b></td><td class="small muted">Phải bằng 0</td></tr>',
                    '<tr><td>Giá trị hàng tồn kho tại ' + T.date(k.den) + '</td><td class="num">' +
                        tien(qk.vonTrongHang.cuoiKy) +
                        '</td><td class="small muted">T.chayLaiKho — phát lại sổ kho tới ngày chốt</td></tr>'
                ]));

        body.innerHTML = h;
    }

    /* ================================================== 5. LỢI NHUẬN */
    function veLoiNhuan() {
        var l = loc();
        var ln = T.chiaLoiNhuanKy(l);
        var kq = ln.kq;
        var c = T.cauHinhVon();
        var k = ln.ky;

        var h = '<div class="note b"><i class="bi bi-building"></i><div>' +
            '<b>PHẠM VI: CHỈ CÔNG TY TẢN VIÊN.</b> Lợi nhuận đem chia cho cổ đông là lợi nhuận của ' +
            T.esc(dvVon.ten || '') + ' — pháp nhân mà cổ đông góp vốn vào và là chủ sở hữu duy nhất ' +
            'của kho hàng. Lợi nhuận của EMC, AA và Thái Phong <b>không</b> nằm trong số này. ' +
            'Đổi “Đơn vị đang làm việc” ở đầu màn hình <b>không</b> làm đổi phạm vi này.' +
            '</div></div>' +
            '<div class="kpis">' +
            kpi('Doanh thu', tien(kq.doanhThu), 'đ · ' + kq.soChungTu + ' chứng từ', '') +
            kpi('Giá vốn', tien(kq.giaVon), 'đ', 'c') +
            kpi('Lãi gộp', tien(kq.loiNhuanGop), 'đ · biên ' + T.num(kq.bienLoiNhuanGop, 1) + '%', 'g') +
            kpi('Chi phí', tien(kq.chiPhi), 'đ · từ Phiếu chi', 'y') +
            kpi('Lợi nhuận thuần', tien(kq.loiNhuan), 'đ · biên ' + T.num(kq.bienLoiNhuan, 1) + '%',
                kq.loiNhuan >= 0 ? 'g' : 'r') +
            kpi('Đã chia TRONG KỲ', tien(ln.daChiaTrongKy), 'đ · lũy kế ' + tien(ln.daChiaLuyKe), '') +
            '</div><div class="kpis">' +
            kpi('Được phép phân phối', tien(ln.deChia), 'đ · lỗ thì bằng 0', 'g') +
            kpi('Chưa chia trong kỳ', tien(ln.chuaChia), 'đ', 'g') +
            kpi('Đã chia các kỳ trước', tien(ln.daChiaDauKy), 'đ · không tính vào kỳ này', '') +
            kpi('Lợi nhuận chờ bù', tien(ln.choBu), 'đ', ln.choBu > 0 ? 'r' : '') +
            kpi('Kỳ báo cáo', T.date(k.den), k.coDauKy ? 'từ ' + T.date(k.tu) : 'từ đầu dữ liệu', 'c') +
            kpi('Tỷ lệ chia', T.num(T.tongTyLe(k.den), 0) + '%', 'tổng tỷ lệ sở hữu', 'c') +
            '</div>';

        h += the('Cách Business Engine tính ra lợi nhuận đem chia', 'bi-calculator',
            bangDon([{ t: 'Chỉ tiêu' }, { t: 'Giá trị', w: 200, n: true }],
                [
                    '<tr><td>Doanh thu</td><td class="num">' + tien(kq.doanhThu) + '</td></tr>',
                    '<tr><td>− Giá vốn</td><td class="num">' + tien(kq.giaVon) + '</td></tr>',
                    '<tr><td><b>= Lãi gộp</b></td><td class="num"><b>' + tien(kq.loiNhuanGop) + '</b></td></tr>',
                    '<tr><td>− Chi phí <span class="small muted">(lương · thuê kho · marketing · vận chuyển · ' +
                        'văn phòng · bán hàng · khác — đọc thẳng từ Phiếu chi)</span></td>' +
                        '<td class="num">' + tien(kq.chiPhi) + '</td></tr>',
                    '<tr><td><b>= Lợi nhuận thuần</b></td><td class="num"><b class="' +
                        (kq.loiNhuan >= 0 ? 'pos' : 'neg') + '">' + tien(kq.loiNhuan) + '</b></td></tr>'
                ]) +
            ghiChuNguon('Chi phí <b>không cộng vào giá vốn</b> và <b>không làm giảm quỹ vốn</b>. ' +
                'Toàn bộ bốn dòng trên lấy thẳng từ <b>T.ketQuaKinhDoanh</b> của Business Engine, ' +
                'lọc đúng đơn vị phát hành <b>' + T.esc(dvVon.ten || '') + '</b> — phân hệ vốn ' +
                'không tính lại một phép tính nào.'));

        if (ln.choBu > 0)
            h += '<div class="note r"><i class="bi bi-exclamation-octagon"></i><div>' +
                '<b>Kỳ này lỗ ' + tien(ln.choBu) + ' đ — KHÔNG chia lợi nhuận.</b> ' +
                'Khoản lỗ được chuyển sang <b>Lợi nhuận chờ bù</b> và sẽ được bù bằng lợi nhuận của các kỳ sau. ' +
                'Quỹ vốn cổ đông <b>không bị ảnh hưởng</b>.</div></div>';

        var ds = ln.theoCoDong;
        h += '<div class="grid2" style="align-items:start">' +
            the('Tỷ trọng phân chia', 'bi-pie-chart',
                vanhKhuyen(ds.map(function (x) { return { l: x.ten, v: x.duocChia }; }),
                    tien(ln.deChia), 'đ đem chia')) +
            the('Tình hình chi trả', 'bi-cash-stack',
                '<div class="bars">' +
                ds.map(function (x) {
                    var pct = x.thucNhan ? x.daNhan / x.thucNhan * 100 : 0;
                    return '<div class="bar-row"><div class="ellip" title="' + T.esc(x.ten) + '">' +
                        T.esc(x.ten) + '</div>' + thanh(pct, pct >= 100) +
                        '<div class="bar-val">' + T.num(pct, 0) + '%</div></div>';
                }).join('') + '</div>') +
            '</div>';

        h += the('Phân chia lợi nhuận theo tỷ lệ sở hữu', 'bi-people-fill',
            bangDon([{ t: 'Cổ đông' }, { t: 'Tỷ lệ', w: 92, n: true },
                     { t: 'Được chia', w: 168, n: true }, { t: 'Lãi chậm góp', w: 148, n: true },
                     { t: 'Khấu trừ', w: 140, n: true }, { t: 'Thực nhận', w: 168, n: true },
                     { t: 'Đã nhận trong kỳ', w: 168, n: true }, { t: 'Còn phải trả', w: 156, n: true }],
                ds.map(function (x) {
                    return '<tr><td><b>' + T.esc(x.ten) + '</b></td>' +
                        '<td class="num">' + T.num(x.tyLe, 2) + '%</td>' +
                        '<td class="num"><b>' + tien(x.duocChia) + '</b></td>' +
                        '<td class="num">' + (x.laiChamGop ? '<span class="neg">' + tien(x.laiChamGop) + '</span>'
                            : '<span class="muted">0</span>') + '</td>' +
                        '<td class="num">' + (x.khauTru ? '<span class="neg">−' + tien(x.khauTru) + '</span>'
                            : '<span class="muted">0</span>') + '</td>' +
                        '<td class="num"><b class="pos">' + tien(x.thucNhan) + '</b></td>' +
                        '<td class="num">' + tien(x.daNhanTrongKy) +
                            (x.daNhanLuyKe !== x.daNhanTrongKy
                                ? '<div class="small muted">lũy kế ' + tien(x.daNhanLuyKe) + '</div>' : '') +
                            '</td>' +
                        '<td class="num">' + (x.conPhaiTra ? '<b>' + tien(x.conPhaiTra) + '</b>'
                            : '<span class="muted">0</span>') + '</td></tr>';
                })) +
            ghiChuNguon(c.khauTruLai
                ? 'Quy định khấu trừ <b>đang bật</b>: lãi chậm góp của cổ đông được trừ thẳng vào phần lợi nhuận ' +
                  'được chia, tối đa bằng đúng phần được chia. Tắt quy định này ở nút <b>Cấu hình lãi chậm góp</b> ' +
                  'thì lãi chỉ hiển thị để theo dõi, không tự trừ.'
                : 'Quy định khấu trừ <b>đang tắt</b>: lãi chậm góp chỉ hiển thị để theo dõi, ' +
                  'hệ thống không tự trừ vào lợi nhuận được chia.'),
            'Tổng đem chia ' + tien(ln.deChia) + ' đ');

        h += '<div class="toolbar">' +
            '<button class="btn ok-solid" data-chia' + (ln.chuaChia > 0 ? '' : ' disabled') +
                '><i class="bi bi-cash-coin"></i> Ghi nhận chi trả lợi nhuận</button>' +
            '<button class="btn" data-xuatln><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button>' +
            '<button class="btn report" data-inln><i class="bi bi-file-earmark-bar-graph"></i> Xuất báo cáo</button>' +
            '</div>';

        body.innerHTML = h;
        UI.mauNut(body);

        var b1 = body.querySelector('[data-chia]');
        if (b1) b1.onclick = function () { formChiaLN(ln); };
        var b2 = body.querySelector('[data-xuatln]');
        if (b2) b2.onclick = function () {
            UI.xuatExcel('PhanChiaLoiNhuan', 'Phân chia lợi nhuận',
                [{ t: 'Cổ đông', k: 'ten', w: 28 }, { t: 'Tỷ lệ (%)', k: 'tyLe', w: 12 },
                 { t: 'Được chia', k: 'duocChia', w: 18 }, { t: 'Lãi chậm góp', k: 'laiChamGop', w: 18 },
                 { t: 'Khấu trừ', k: 'khauTru', w: 16 }, { t: 'Thực nhận', k: 'thucNhan', w: 18 },
                 { t: 'Đã nhận trong kỳ', k: 'daNhanTrongKy', w: 20 },
                 { t: 'Đã nhận lũy kế', k: 'daNhanLuyKe', w: 20 },
                 { t: 'Còn phải trả', k: 'conPhaiTra', w: 18 }], ds);
        };
        var b3 = body.querySelector('[data-inln]');
        if (b3) b3.onclick = function () { inChiaLN(ln); };
    }

    function formChiaLN(ln) {
        if (!Q.co(MOD, 'them')) return UI.thieuQuyen(MOD, 'them');
        var ds = ln.theoCoDong.filter(function (x) { return x.conPhaiTra > 0; });
        if (!ds.length) return UI.khongThe('Ghi nhận chi trả lợi nhuận',
            'Không còn khoản lợi nhuận nào phải trả.',
            'Toàn bộ phần được chia đã được ghi nhận chi trả.');
        UI.modal({
            size: 'md', title: 'Ghi nhận chi trả lợi nhuận',
            sub: 'Mỗi cổ đông một giao dịch — số tiền mặc định bằng phần còn phải trả',
            body: '<div class="tablewrap"><table class="grid"><thead><tr>' +
                '<th>Cổ đông</th><th class="num" style="width:150px">Còn phải trả</th>' +
                '<th class="num" style="width:190px">Chi trả lần này (đ)</th></tr></thead><tbody>' +
                ds.map(function (x) {
                    return '<tr><td><b>' + T.esc(x.ten) + '</b></td>' +
                        '<td class="num">' + tien(x.conPhaiTra) + '</td>' +
                        '<td><input class="tien" data-cd="' + T.esc(x.coDongId) + '" value="' +
                        T.soVe(x.conPhaiTra, 0) + '" style="text-align:right"></td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<div class="grid2 mt12">' +
                '<div class="fld req"><label>Ngày chi trả</label><input type="date" data-f="ngay" value="' + T.today() + '"></div>' +
                '<div class="fld"><label>Hình thức</label><select data-f="hinhThuc">' +
                    W.opt(T.VON_HINH_THUC, 'Chuyển khoản') + '</select></div>' +
                '<div class="fld span2"><label>Ghi chú</label><input data-f="ghiChu" value="Chi trả lợi nhuận"></div>' +
                '</div>' +
                '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>Giao dịch chỉ ghi vào ' +
                '<b>sổ vốn của phân hệ Góp vốn</b>. Hệ thống <b>không tự sinh Phiếu chi</b> để không làm thay đổi ' +
                'luồng nghiệp vụ Thu chi hiện có — nếu cần chứng từ chi tiền, hãy lập Phiếu chi ở phân hệ ' +
                '<i>Thu chi & Công nợ</i> như bình thường.</div></div>',
            buttons: [
                { text: 'Hủy', click: function (x) { x.close(); } },
                { text: 'Ghi nhận chi trả', cls: 'ok-solid', icon: 'bi-cash-coin', click: function (x) {
                    if (!UI.validate(x.el, [{ k: 'ngay' }])) return;
                    var v = UI.read(x.el);
                    var n = 0, tongTien = 0;
                    var loiGhi = [];
                    x.el.querySelectorAll('[data-cd]').forEach(function (e) {
                        var st = Math.round(T.so(e.value));
                        if (st <= 0) return;
                        var k = T.ghiGiaoDichVon({
                            ngay: v.ngay, coDongId: e.getAttribute('data-cd'),
                            dotId: '', loai: 'Chia lợi nhuận', soTien: st,
                            hinhThuc: v.hinhThuc || 'Chuyển khoản', ghiChu: v.ghiChu || '',
                            donVi: dvVon.id || '', nguoiLapId: (Q.nhanVienCuaToi() || {}).id || '',
                            nguoiLap: (Q.nhanVienCuaToi() || {}).hoTen || DB.user().hoTen || ''
                        });
                        if (!k.rec) { loiGhi = loiGhi.concat(k.loi); return; }
                        n++; tongTien += st;
                    });
                    if (!n) return UI.khongThe('Ghi nhận chi trả lợi nhuận',
                        loiGhi.length ? 'Engine từ chối ghi:' : 'Chưa nhập số tiền nào.',
                        loiGhi.length ? loiGhi.join('<br>') : 'Nhập số tiền chi trả cho ít nhất một cổ đông.');
                    x.close();
                    UI.toast('ok', 'Đã ghi nhận chi trả lợi nhuận',
                        n + ' cổ đông · tổng ' + tien(tongTien) + ' đ');
                    veLoiNhuan();
                } }
            ],
            onOpen: function (x) { UI.numInput(x.el); }
        });
    }

    /* ================================================== 6. BÁO CÁO */
    /* ==================================================================
       BÁO CÁO DÒNG TIỀN CỔ ĐÔNG — tám phần theo mục XVI→XXI của lệnh 18.4.0
       Chọn công ty (theo đơn vị vốn) · cổ đông · khoảng thời gian.
       Xem một người hoặc toàn bộ. Xuất Excel. In / xuất PDF.
       ================================================================== */
    var dtCd = '';

    function veDongTien() {
        var ds = DB.all('coDong');
        if (!ds.length) {
            body.innerHTML = '<div class="trong"><i class="bi bi-people"></i>' +
                '<b>Chưa khai cổ đông nào</b>Vào khu vực Danh sách cổ đông để khai trước.</div>';
            return;
        }
        if (dtCd && dtCd !== '*' && !DB.get('coDong', dtCd)) dtCd = '';
        var h = '<div class="toolbar">' +
            '<label class="small muted">Cổ đông</label>' +
            '<select id="dtCd" style="width:250px"><option value="*">— Toàn bộ cổ đông —</option>' +
            ds.map(function (c) {
                return '<option value="' + c.id + '"' + (dtCd === c.id ? ' selected' : '') + '>' +
                    T.esc(c.ten) + '</option>'; }).join('') + '</select>' +
            '<span class="small muted">Công ty: <b>' + T.esc((T.donViVon() || {}).ten || '—') + '</b></span>' +
            '<span class="spacer"></span>' +
            '<button class="btn info-line" id="dtXls"><i class="bi bi-file-earmark-excel"></i> Xuất báo cáo Excel</button>' +
            '<button class="btn report" id="dtIn"><i class="bi bi-printer"></i> Xem trước · In · PDF</button>' +
            '</div><div id="dtThan"></div>';
        body.innerHTML = h;
        var sel = qs('#dtCd');
        sel.value = dtCd || '*';
        sel.onchange = function () { dtCd = sel.value; veThan(); };
        qs('#dtXls').onclick = xuatExcel;
        qs('#dtIn').onclick = inBaoCao;
        veThan();
        UI.mauNut(body);
    }

    function dtLoc() { var l = loc(); return { tuNgay: l.tuNgay || '', denNgay: l.denNgay || T.today() }; }

    function dtDs() {
        var l = dtLoc();
        if (!dtCd || dtCd === '*') return T.dongTienMoiCoDong(l).ds;
        return [T.dongTienCoDong(dtCd, l)];
    }

    function veThan() {
        var ds = dtDs();
        qs('#dtThan').innerHTML = ds.map(function (r) { return veMotCoDong(r, false); }).join('');
    }

    /** Một cổ đông — đủ tám phần. choIn = true thì bỏ nút và rút gọn khung. */
    function veMotCoDong(r, choIn) {
        var t = r.tong;
        var k = r.kiemTra;
        var h = '';
        h += '<div class="kq-dau"><h3>BÁO CÁO DÒNG TIỀN CỔ ĐÔNG</h3></div>';

        /* ---- PHẦN I ---- */
        h += the('PHẦN I — Thông tin cổ đông', 'bi-person-badge',
            bangDon([{ t: 'Chỉ tiêu', w: 240 }, { t: 'Nội dung' }], [
                '<tr><td>Công ty</td><td><b>' + T.esc((r.donVi || {}).ten || '—') + '</b></td></tr>',
                '<tr><td>Cổ đông</td><td><b>' + T.esc((r.coDong || {}).ten || '—') + '</b></td></tr>',
                '<tr><td>Tỷ lệ sở hữu / góp vốn</td><td><b>' + T.num(r.tyLe, 2) + '%</b></td></tr>',
                '<tr><td>Khoảng thời gian báo cáo</td><td>' +
                    (r.tuNgay ? 'Từ ' + T.date(r.tuNgay) + ' đến ' + T.date(r.denNgay)
                              : 'Từ đầu đến ' + T.date(r.denNgay)) + '</td></tr>'
            ]));

        /* ---- PHẦN II ---- */
        h += the('PHẦN II — Tổng hợp nghĩa vụ và dòng tiền', 'bi-clipboard-data',
            bangDon([{ t: 'Chỉ tiêu' }, { t: 'Số tiền', w: 190, n: true }], [
                '<tr><td>Tổng nghĩa vụ mới phát sinh</td><td class="num">' + tien(t.nghiaVuMoi) + '</td></tr>',
                '<tr><td>Tổng nghĩa vụ nhận chuyển từ các đợt trước</td><td class="num">' +
                    tien(t.nghiaVuNhan) + '</td></tr>',
                '<tr><td class="muted">Trừ: nghĩa vụ đã chuyển sang đợt sau</td><td class="num muted">− ' +
                    tien(t.nghiaVuChuyenDi) + '</td></tr>',
                '<tr class="dam"><td><b>TỔNG NGHĨA VỤ PHẢI GÓP</b></td><td class="num"><b>' +
                    tien(t.tongNghiaVu) + '</b></td></tr>',
                '<tr><td>Tiền cổ đông góp trực tiếp</td><td class="num"><span class="pos">' +
                    tien(t.gopTrucTiep) + '</span></td></tr>',
                '<tr><td>Tiền bán hàng của công ty được phân bổ</td><td class="num"><span class="pos">' +
                    tien(t.tienBanHang) + '</span></td></tr>',
                '<tr class="dam"><td><b>TỔNG ĐÃ THỰC HIỆN NGHĨA VỤ</b></td><td class="num"><b>' +
                    tien(t.daThucHien) + '</b></td></tr>',
                '<tr><td><b>Tổng còn thiếu</b></td><td class="num">' +
                    (t.conThieu > 0 ? '<b class="neg">' + tien(t.conThieu) + '</b>'
                                    : '<span class="muted">0</span>') + '</td></tr>',
                (t.vuot > 0 ? '<tr><td>Đã thực hiện vượt nghĩa vụ</td><td class="num"><b>' +
                    tien(t.vuot) + '</b></td></tr>' : ''),
                '<tr><td>Tổng lãi chậm góp phát sinh</td><td class="num">' + tien(t.laiPhatSinh) + '</td></tr>',
                '<tr><td>Tổng lãi chậm góp đã thanh toán</td><td class="num">' + tien(t.laiDaTra) + '</td></tr>',
                '<tr class="dam"><td><b>LÃI CHẬM GÓP CÒN PHẢI THANH TOÁN</b></td><td class="num"><b>' +
                    tien(t.laiConPhaiTra) + '</b></td></tr>'
            ].filter(Boolean)),
            'Lãi chậm góp KHÔNG cộng vào tiền vốn — hai khoản theo dõi riêng');

        /* ---- PHẦN III ---- */
        h += the('PHẦN III — Chi tiết các lần cổ đông góp trực tiếp', 'bi-cash-coin',
            bangDon([{ t: 'Ngày', w: 100 }, { t: 'Đợt nhận', w: 110 }, { t: 'Phương thức', w: 130 },
                     { t: 'Chứng từ', w: 150 }, { t: 'Số tiền', w: 150, n: true }, { t: 'Diễn giải' }],
                r.lanGop.length ? r.lanGop.map(function (x) {
                    return '<tr><td>' + T.date(x.ngay) + '</td><td class="mono">' + T.esc(x.dotSo) + '</td>' +
                        '<td>' + T.esc(x.hinhThuc) + '</td>' +
                        '<td class="mono small">' + T.esc(x.chungTuSo || '—') + '</td>' +
                        '<td class="num"><b>' + tien(x.soTien) + '</b></td>' +
                        '<td class="small muted">' + T.esc(x.dienGiai) + '</td></tr>';
                }).concat(['<tr class="dam"><td colspan="4"><b>CỘNG</b></td><td class="num"><b>' +
                    tien(t.gopTrucTiep) + '</b></td><td></td></tr>'])
                  : ['<tr><td colspan="6" class="muted">Chưa có lần góp trực tiếp nào trong kỳ.</td></tr>']));

        /* ---- PHẦN IV ---- */
        h += the('PHẦN IV — Nghĩa vụ chuyển từ các đợt trước', 'bi-arrow-right-circle',
            bangDon([{ t: 'Ngày chuyển', w: 110 }, { t: 'Từ đợt', w: 110 }, { t: 'Sang đợt', w: 110 },
                     { t: 'Số tiền', w: 150, n: true }, { t: 'Hạn góp gốc', w: 120 },
                     { t: 'Lãi suất gốc', w: 100, n: true }, { t: 'Người thực hiện', w: 140 },
                     { t: 'Lý do' }],
                r.nhanChuyen.length ? r.nhanChuyen.map(function (x) {
                    return '<tr><td>' + T.date(x.ngay) + '</td>' +
                        '<td class="mono">' + T.esc(x.tuDotSo) + '</td>' +
                        '<td class="mono">' + T.esc(x.denDotSo) + '</td>' +
                        '<td class="num"><b>' + tien(x.soTien) + '</b></td>' +
                        '<td>' + (x.hanGopGoc ? T.date(x.hanGopGoc) : '—') + '</td>' +
                        '<td class="num">' + T.num(x.laiSuatGoc || 0, 2) + '%</td>' +
                        '<td class="small">' + T.esc(x.nguoi || '—') + '</td>' +
                        '<td class="small muted">' + T.esc(x.ghiChu || '') + '</td></tr>';
                }).concat(['<tr class="dam"><td colspan="3"><b>CỘNG</b></td><td class="num"><b>' +
                    tien(t.nghiaVuNhan) + '</b></td><td colspan="4"></td></tr>'])
                  : ['<tr><td colspan="8" class="muted">Không có nghĩa vụ nào được chuyển từ đợt trước.</td></tr>']),
            'Khoản chuyển giữ nguyên hạn góp gốc và lãi suất gốc — chuyển đợt không xóa lãi đã chậm');

        /* ---- PHẦN V ---- */
        h += the('PHẦN V — Tiền bán hàng của công ty được phân bổ', 'bi-shop',
            bangDon([{ t: 'Ngày', w: 100 }, { t: 'Đợt nhận', w: 110 }, { t: 'Tỷ lệ áp dụng', w: 120, n: true },
                     { t: 'Chứng từ nguồn tiền', w: 170 }, { t: 'Số tiền phân bổ', w: 160, n: true },
                     { t: 'Diễn giải' }],
                r.tienBanHang.length ? r.tienBanHang.map(function (x) {
                    return '<tr><td>' + T.date(x.ngay) + '</td><td class="mono">' + T.esc(x.dotSo) + '</td>' +
                        '<td class="num">' + (x.tyLeApDung != null ? T.num(x.tyLeApDung, 2) + '%' : '—') + '</td>' +
                        '<td class="mono small">' + T.esc(x.chungTuSo || x.gdSo || '—') + '</td>' +
                        '<td class="num"><b>' + tien(x.soTien) + '</b></td>' +
                        '<td class="small muted">' + T.esc(x.dienGiai) + '</td></tr>';
                }).concat(['<tr class="dam"><td colspan="4"><b>CỘNG</b></td><td class="num"><b>' +
                    tien(t.tienBanHang) + '</b></td><td></td></tr>'])
                  : ['<tr><td colspan="6" class="muted">Không có khoản tiền bán hàng nào được phân bổ trong kỳ.</td></tr>']),
            'Đây là nghiệp vụ SỬ DỤNG NGUỒN TIỀN — không sinh thêm doanh thu, ' +
            'và không phải tiền cá nhân cổ đông bỏ ra');

        /* ---- PHẦN VI ---- */
        h += the('PHẦN VI — Chi tiết lãi chậm góp theo từng khoảng thời gian', 'bi-calculator',
            bangDon([{ t: 'STT', w: 52, n: true }, { t: 'Đợt', w: 90 }, { t: 'Nội dung' },
                     { t: 'Số tiền thiếu', w: 140, n: true }, { t: 'Từ ngày', w: 100 },
                     { t: 'Đến ngày', w: 100 }, { t: 'Số ngày', w: 76, n: true },
                     { t: 'Lãi suất', w: 78, n: true }, { t: 'Tiền lãi', w: 130, n: true },
                     { t: 'Công thức', w: 190 }],
                r.chiTietLai.length ? r.chiTietLai.map(function (x, i) {
                    return '<tr><td class="num">' + (i + 1) + '</td>' +
                        '<td class="mono">' + T.esc(x.dotSo) + '</td>' +
                        '<td class="small">' + T.esc(x.noiDung) + '</td>' +
                        '<td class="num">' + tien(x.thieu) + '</td>' +
                        '<td>' + T.date(x.tuNgay) + '</td><td>' + T.date(x.denNgay) + '</td>' +
                        '<td class="num">' + T.num(x.soNgay, 0) + '</td>' +
                        '<td class="num">' + T.num(x.laiSuat, 2) + '%</td>' +
                        '<td class="num"><b>' + tien(x.lai) + '</b></td>' +
                        '<td class="small muted">' + T.esc(x.congThuc) + '</td></tr>';
                }).concat(['<tr class="dam"><td colspan="8"><b>TỔNG LÃI CHẬM GÓP</b></td>' +
                    '<td class="num"><b>' + tien(t.laiPhatSinh) + '</b></td><td></td></tr>'])
                  : ['<tr><td colspan="10" class="muted">Không phát sinh lãi chậm góp.</td></tr>']),
            'Mỗi khoảng là một quãng thời gian có số dư thiếu KHÔNG ĐỔI — ' +
            'số thiếu thay đổi là cắt sang khoảng mới');

        /* ---- PHẦN VII ---- */
        h += the('PHẦN VII — Tổng hợp lãi theo từng đợt', 'bi-list-ol',
            bangDon([{ t: 'Đợt' }, { t: 'Lãi phát sinh', w: 160, n: true },
                     { t: 'Đã thanh toán', w: 150, n: true }, { t: 'Còn phải thanh toán', w: 170, n: true }],
                r.laiTheoDot.length ? r.laiTheoDot.map(function (x) {
                    return '<tr><td class="mono"><b>' + T.esc(x.dotSo) + '</b></td>' +
                        '<td class="num">' + tien(x.lai) + '</td>' +
                        '<td class="num">' + tien(x.daTra) + '</td>' +
                        '<td class="num"><b>' + tien(x.conLai) + '</b></td></tr>';
                }).concat(['<tr class="dam"><td><b>CỘNG</b></td><td class="num"><b>' + tien(t.laiPhatSinh) +
                    '</b></td><td class="num"><b>' + tien(t.laiDaTra) + '</b></td>' +
                    '<td class="num"><b>' + tien(t.laiConPhaiTra) + '</b></td></tr>'])
                  : ['<tr><td colspan="4" class="muted">Không có lãi chậm góp.</td></tr>']));

        /* ---- PHẦN VIII ---- */
        h += the('PHẦN VIII — Tổng cộng theo từng đợt', 'bi-table',
            bangDon([{ t: 'Đợt' }, { t: 'Hạn góp', w: 106 }, { t: 'Nghĩa vụ mới', w: 136, n: true },
                     { t: 'Nhận chuyển', w: 130, n: true }, { t: 'Tổng nghĩa vụ', w: 140, n: true },
                     { t: 'Đã thực hiện', w: 140, n: true }, { t: 'Còn thiếu', w: 130, n: true },
                     { t: 'Tiến độ', w: 90, n: true }, { t: 'Lãi', w: 126, n: true },
                     { t: 'Trạng thái', w: 120 }],
                r.theoDot.length ? r.theoDot.map(function (x) {
                    return '<tr><td class="mono"><b>' + T.esc(x.dotSo) + '</b><br>' +
                        '<span class="small muted">' + T.esc(x.lyDo) + '</span></td>' +
                        '<td>' + (x.hanGop ? T.date(x.hanGop) : '—') + '</td>' +
                        '<td class="num">' + tien(x.nghiaVuMoi) + '</td>' +
                        '<td class="num">' + (x.nhan ? tien(x.nhan) : '<span class="muted">0</span>') + '</td>' +
                        '<td class="num"><b>' + tien(x.phaiGop) + '</b></td>' +
                        '<td class="num"><span class="pos">' + tien(x.daGop) + '</span></td>' +
                        '<td class="num">' + (x.thieu > 0 ? '<b class="neg">' + tien(x.thieu) + '</b>'
                            : '<span class="muted">0</span>') + '</td>' +
                        '<td class="num">' + T.num(x.tienDo, 1) + '%</td>' +
                        '<td class="num">' + tien(x.lai) + '</td>' +
                        '<td>' + T.pill(x.trangThai) + '</td></tr>';
                }) : ['<tr><td colspan="10" class="muted">Cổ đông này chưa có đợt góp vốn nào.</td></tr>']));

        /* ---- KIỂM TRA KHỚP ---- */
        h += k.khop
            ? '<div class="note g"><i class="bi bi-check-circle-fill"></i><div><b>Kiểm tra khớp lãi: ĐẠT.</b> ' +
              T.esc(k.moTa) + ' (' + tien(k.theoKhoangThoiGian) + ' đ)</div></div>'
            : '<div class="note r"><i class="bi bi-x-octagon-fill"></i><div><b>LỆCH SỐ LIỆU LÃI.</b> ' +
              T.esc(k.moTa) + '<br>Theo khoảng thời gian ' + tien(k.theoKhoangThoiGian) +
              ' đ · theo đợt ' + tien(k.theoDot) + ' đ · tổng hợp ' + tien(k.theoTongHop) + ' đ.</div></div>';
        return h;
    }

    function xuatExcel() {
        var ds = dtDs();
        var rows = [];
        ds.forEach(function (r) {
            rows.push({ a: 'CỔ ĐÔNG', b: (r.coDong || {}).ten, c: 'Tỷ lệ', d: T.num(r.tyLe, 2) + '%',
                        e: '', f: '', g: '', h: '', i: '' });
            rows.push({ a: 'Tổng nghĩa vụ', b: r.tong.tongNghiaVu, c: 'Đã thực hiện', d: r.tong.daThucHien,
                        e: 'Còn thiếu', f: r.tong.conThieu, g: 'Lãi phát sinh', h: r.tong.laiPhatSinh,
                        i: 'Lãi còn phải trả: ' + r.tong.laiConPhaiTra });
            rows.push({ a: '--- CHI TIẾT LÃI CHẬM GÓP ---' });
            rows.push({ a: 'STT', b: 'Đợt', c: 'Nội dung', d: 'Số tiền thiếu', e: 'Từ ngày',
                        f: 'Đến ngày', g: 'Số ngày', h: 'Lãi suất %', i: 'Tiền lãi' });
            r.chiTietLai.forEach(function (x, i) {
                rows.push({ a: i + 1, b: x.dotSo, c: x.noiDung, d: x.thieu, e: x.tuNgay,
                            f: x.denNgay, g: x.soNgay, h: x.laiSuat, i: x.lai });
            });
            rows.push({ a: '', b: '', c: 'TỔNG LÃI', d: '', e: '', f: '', g: '', h: '',
                        i: r.tong.laiPhatSinh });
            rows.push({ a: '' });
        });
        UI.xuatExcel('DongTienCoDong', 'Dòng tiền cổ đông',
            [{ t: 'A', k: 'a', w: 26 }, { t: 'B', k: 'b', w: 18 }, { t: 'C', k: 'c', w: 40 },
             { t: 'D', k: 'd', w: 18 }, { t: 'E', k: 'e', w: 14 }, { t: 'F', k: 'f', w: 14 },
             { t: 'G', k: 'g', w: 10 }, { t: 'H', k: 'h', w: 11 }, { t: 'I', k: 'i', w: 18 }],
            rows);
    }

    function inBaoCao() {
        var ds = dtDs();
        var h = ds.map(function (r) { return '<div class="kq-in">' + veMotCoDong(r, true) + '</div>'; })
                  .join('<div style="page-break-after:always"></div>');
        UI.print(h, 'Báo cáo dòng tiền cổ đông',
            { tenTep: 'DongTienCoDong', dv: T.donViVon() });
    }

    function veBaoCao() {
        var l = loc();
        var bc = T.baoCaoVonKy(l);
        var k = bc.ky, q = bc.quy, ln = bc.ln;

        /* ---------- A. KẾT QUẢ KINH DOANH TẢN VIÊN ---------- */
        var hA = '<div class="tablewrap"><table class="grid"><thead><tr>' +
            '<th>Chỉ tiêu</th><th class="num" style="width:200px">Giá trị (đ)</th>' +
            '<th style="width:360px">Nguồn số liệu — truy ngược về đâu</th></tr></thead><tbody>' +
            bc.A.map(function (x, i2) {
                var dam = [2, 4, 5].indexOf(i2) >= 0;
                return '<tr><td>' + (dam ? '<b>' + T.esc(x.ct) + '</b>' : T.esc(x.ct)) + '</td>' +
                    '<td class="num"><b class="' + (x.gt < 0 ? 'neg' : (dam ? 'pos' : '')) + '">' +
                    tien(x.gt) + '</b></td>' +
                    '<td class="small muted">' + T.esc(x.nguon) + '</td></tr>';
            }).join('') + '</tbody></table></div>';

        /* ---------- B. BÁO CÁO RIÊNG TỪNG CỔ ĐÔNG ---------- */
        var cot = ['Cổ đông', 'Tỷ lệ sở hữu', 'Tổng nghĩa vụ phải góp', 'Đã thực góp',
                   'Còn phải góp', 'Lãi chậm góp', 'Đã thu hồi vốn', 'Vốn còn đang quay vòng',
                   'Lợi nhuận được chia', 'Lợi nhuận đã nhận', 'Lợi nhuận còn được nhận'];
        var hB = '<div class="tablewrap"><table class="grid"><thead><tr>' +
            cot.map(function (c, i2) {
                return '<th' + (i2 ? ' class="num"' : '') + (i2 ? ' style="width:148px"' : '') + '>' +
                    c + '</th>';
            }).join('') + '</tr></thead><tbody>' +
            bc.B.map(function (x) {
                return '<tr><td><b>' + T.esc(x.coDong.ten) + '</b>' +
                    (x.coDong.ma ? '<div class="small muted mono">' + T.esc(x.coDong.ma) + '</div>' : '') +
                    '</td>' +
                    '<td class="num"><b>' + T.num(x.tyLe, 2) + '%</b></td>' +
                    '<td class="num">' + tien(x.nghiaVu.cuoiKy) + '</td>' +
                    '<td class="num"><span class="pos">' + tien(x.daGop.cuoiKy) + '</span>' +
                        (x.daGop.trongKy ? '<div class="small muted">trong kỳ +' + tien(x.daGop.trongKy) + '</div>' : '') +
                        '</td>' +
                    '<td class="num">' + (x.conPhaiGop > 0 ? '<b class="neg">' + tien(x.conPhaiGop) + '</b>'
                        : '<span class="muted">0</span>') + '</td>' +
                    '<td class="num">' + (x.lai.cuoiKy > 0 ? '<span class="neg">' + tien(x.lai.cuoiKy) + '</span>'
                        : '<span class="muted">0</span>') + '</td>' +
                    '<td class="num">' + tien(x.daThuHoi) + '</td>' +
                    '<td class="num">' + tien(x.vonTrongHang) + '</td>' +
                    '<td class="num"><b>' + tien(x.duocChia) + '</b>' +
                        (x.khauTru ? '<div class="small muted">khấu trừ lãi −' + tien(x.khauTru) + '</div>' : '') +
                        '</td>' +
                    '<td class="num">' + tien(x.daNhanTrongKy) + '</td>' +
                    '<td class="num">' + (x.conDuocNhan ? '<b>' + tien(x.conDuocNhan) + '</b>'
                        : '<span class="muted">0</span>') + '</td></tr>';
            }).join('') +
            '<tr class="dam"><td><b>TỔNG CỘNG</b></td>' +
            '<td class="num"><b>' + T.num(T.sum(bc.B, function (x) { return x.tyLe; }), 2) + '%</b></td>' +
            ['nghiaVu.cuoiKy', 'daGop.cuoiKy', 'conPhaiGop', 'lai.cuoiKy', 'daThuHoi',
             'vonTrongHang', 'duocChia', 'daNhanTrongKy', 'conDuocNhan'].map(function (kk) {
                var v = T.sum(bc.B, function (x) {
                    return kk.indexOf('.') > 0 ? x[kk.split('.')[0]][kk.split('.')[1]] : x[kk];
                });
                return '<td class="num"><b>' + tien(v) + '</b></td>';
            }).join('') + '</tr></tbody></table></div>';

        body.innerHTML =
            '<div class="note b"><i class="bi bi-calendar-range"></i><div>' +
            '<b>Kỳ báo cáo: ' + T.esc(k.nhan) + '.</b> Chọn một năm ở ô <b>Kỳ báo cáo</b> trên thanh lọc, ' +
            'hoặc khai <b>Từ ngày → Đến ngày</b> rồi bấm <b>Áp dụng kỳ</b>. ' +
            'Giao dịch phát sinh sau ' + T.date(k.den) + ' <b>không</b> ảnh hưởng tới báo cáo này.' +
            '</div></div>' +
            the('A. KẾT QUẢ KINH DOANH — ' + T.esc((bc.donVi || {}).ten || 'TẢN VIÊN'), 'bi-building', hA +
                ghiChuNguon('<b>Lợi nhuận cổ đông CHỈ tính cho ' + T.esc((bc.donVi || {}).ten || 'Tản Viên') +
                    '.</b> Doanh thu và lợi nhuận của các công ty khác không nằm trong bảng này. ' +
                    'Lỗ thì phần được phép phân phối bằng 0 — hệ thống không tạo khoản chia âm.'),
                'Kỳ ' + T.esc(k.nhan)) +
            the('B. BÁO CÁO RIÊNG TỪNG CỔ ĐÔNG', 'bi-people-fill', hB +
                ghiChuNguon('Tỷ lệ sở hữu lấy theo <b>lịch sử tỷ lệ có hiệu lực tại ' + T.date(k.den) +
                    '</b> — đổi tỷ lệ về sau không sửa ngược quá khứ. ' +
                    '<b>Đã thu hồi vốn</b> và <b>Vốn còn đang quay vòng</b> là phần tương ứng với vốn ròng ' +
                    'của từng cổ đông trên tổng vốn ròng.'),
                bc.B.length + ' cổ đông') +
            '<div class="toolbar">' +
            '<button class="btn" data-xlA><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel — Phần A</button>' +
            '<button class="btn report" data-inA><i class="bi bi-file-earmark-bar-graph"></i> Xem trước · In · PDF — Phần A</button>' +
            '<span class="tb-sep"></span>' +
            '<button class="btn" data-xlB><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel — Phần B</button>' +
            '<button class="btn report" data-inB><i class="bi bi-file-earmark-bar-graph"></i> Xem trước · In · PDF — Phần B</button>' +
            '</div>' +
            the('Báo cáo bổ trợ', 'bi-collection', bangDon(
                [{ t: 'Báo cáo' }, { t: '', w: 400 }],
                [
                    ['Báo cáo từng đợt góp vốn', 'theo-dot'],
                    ['Báo cáo thu hồi vốn và quỹ vốn quay vòng', 'thu-hoi'],
                    ['Báo cáo phân chia lợi nhuận', 'chia-ln']
                ].map(function (b) {
                    return '<tr><td>' + b[0] + '</td><td>' +
                        '<button class="btn sm" data-xl="' + b[1] + '"><i class="bi bi-file-earmark-excel"></i> Xuất dữ liệu Excel</button> ' +
                        '<button class="btn sm report" data-bc="' + b[1] + '"><i class="bi bi-file-earmark-bar-graph"></i> Xem trước · In · PDF</button>' +
                        '</td></tr>';
                }))) +
            the('Sổ vốn riêng của từng cổ đông', 'bi-journal-text', bangDon(
                [{ t: 'Cổ đông' }, { t: 'Vốn ròng', w: 160, n: true }, { t: 'Còn phải góp', w: 148, n: true },
                 { t: 'Lãi chậm góp', w: 140, n: true }, { t: 'Thực nhận', w: 160, n: true }, { t: '', w: 210 }],
                bc.B.map(function (x) {
                    return '<tr><td><b>' + T.esc(x.coDong.ten) + '</b></td>' +
                        '<td class="num">' + tien(x.vonRong) + '</td>' +
                        '<td class="num">' + (x.conPhaiGop ? '<b class="neg">' + tien(x.conPhaiGop) + '</b>' : '<span class="muted">0</span>') + '</td>' +
                        '<td class="num">' + (x.lai.cuoiKy ? '<span class="neg">' + tien(x.lai.cuoiKy) + '</span>' : '<span class="muted">0</span>') + '</td>' +
                        '<td class="num"><b class="pos">' + tien(x.thucNhan) + '</b></td>' +
                        '<td><button class="btn sm report" data-cdbc="' + T.esc(x.coDong.id) + '">' +
                            '<i class="bi bi-file-earmark-bar-graph"></i> Sổ vốn cổ đông</button></td></tr>';
                }))) +
            ghiChuNguon('Mọi báo cáo dựng lại từ dữ liệu gốc tại thời điểm bấm nút — không có bảng tính ' +
                'trung gian nào được lưu. Xuất PDF theo đúng quy ước TVERP: ở hộp thoại in, chọn máy in là ' +
                '<b>Lưu thành PDF</b>.');

        UI.mauNut(body);

        var COT_A = [{ t: 'Chỉ tiêu', k: 'ct', w: 46 }, { t: 'Giá trị (đ)', k: 'gt', w: 22, tong: false },
                     { t: 'Nguồn số liệu', k: 'nguon', w: 46 }];
        var COT_B = [
            { t: 'Cổ đông', k: '_ten', w: 26, v: function (r) { return r.coDong.ten; } },
            { t: 'Tỷ lệ sở hữu (%)', k: 'tyLe', w: 14 },
            { t: 'Tổng nghĩa vụ phải góp', k: '_nv', w: 20, tong: true, v: function (r) { return r.nghiaVu.cuoiKy; } },
            { t: 'Đã thực góp', k: '_dg', w: 20, tong: true, v: function (r) { return r.daGop.cuoiKy; } },
            { t: 'Còn phải góp', k: 'conPhaiGop', w: 18, tong: true },
            { t: 'Lãi chậm góp', k: '_lai', w: 18, tong: true, v: function (r) { return r.lai.cuoiKy; } },
            { t: 'Đã thu hồi vốn', k: 'daThuHoi', w: 20, tong: true },
            { t: 'Vốn còn đang quay vòng', k: 'vonTrongHang', w: 20, tong: true },
            { t: 'Lợi nhuận được chia', k: 'duocChia', w: 20, tong: true },
            { t: 'Lợi nhuận đã nhận', k: 'daNhanTrongKy', w: 20, tong: true },
            { t: 'Lợi nhuận còn được nhận', k: 'conDuocNhan', w: 20, tong: true }
        ];

        function dieuKienKy() {
            return [
                { t: 'Đơn vị', v: (bc.donVi || {}).ten || '' },
                { t: 'Kỳ báo cáo', v: k.nhan },
                { t: 'Số đầu kỳ chốt ngày', v: k.coDauKy ? T.date(k.truoc) : 'không có số đầu kỳ' },
                { t: 'Lãi suất chậm góp', v: T.num(T.cauHinhVon().laiSuat, 2) + '%/năm' }
            ];
        }
        var b1 = body.querySelector('[data-xlA]');
        if (b1) b1.onclick = function () {
            UI.xuatExcel('GopVon_KetQuaKinhDoanh_' + k.den, 'Kết quả kinh doanh', COT_A, bc.A);
        };
        var b2 = body.querySelector('[data-inA]');
        if (b2) b2.onclick = function () {
            W.inBaoCao({
                tieu: 'BÁO CÁO KẾT QUẢ KINH DOANH VÀ PHÂN PHỐI LỢI NHUẬN',
                phu: (bc.donVi || {}).ten || '', land: false,
                tu: k.tu || '', den: k.den, thoiDiem: T.today(), dieuKien: dieuKienKy(),
                cols: [{ t: 'Chỉ tiêu', k: 'ct', w: 52 },
                       { t: 'Giá trị (đ)', k: 'gt', w: 24, cls: 'n' },
                       { t: 'Nguồn số liệu', k: 'nguon', w: 52 }],
                rows: bc.A, tienChu: ln.deChia, kyTrai: 'KẾ TOÁN', kyPhai: 'GIÁM ĐỐC'
            });
        };
        var b3 = body.querySelector('[data-xlB]');
        if (b3) b3.onclick = function () {
            UI.xuatExcel('GopVon_TungCoDong_' + k.den, 'Báo cáo từng cổ đông', COT_B, bc.B);
        };
        var b4 = body.querySelector('[data-inB]');
        if (b4) b4.onclick = function () {
            W.inBaoCao({
                tieu: 'BÁO CÁO GÓP VỐN VÀ PHÂN CHIA LỢI NHUẬN TỪNG CỔ ĐÔNG',
                phu: (bc.donVi || {}).ten || '',
                tu: k.tu || '', den: k.den, thoiDiem: T.today(), dieuKien: dieuKienKy(),
                cols: COT_B.map(function (c) {
                    return { t: c.t, k: c.k, w: c.w, cls: c.k === '_ten' ? '' : 'n',
                             tong: !!c.tong, v: c.v };
                }),
                rows: bc.B, kyTrai: 'KẾ TOÁN', kyPhai: 'GIÁM ĐỐC'
            });
        };

        var CFG = {
            'theo-dot': {
                tieu: 'BÁO CÁO TỪNG ĐỢT GÓP VỐN',
                rows: function () {
                    var out = [];
                    T.tinhMoiDot(k.den).ds.forEach(function (d) {
                        if (k.tu && String(d.dot.ngay || '') < k.tu) return;
                        d.theoCoDong.forEach(function (x) {
                            out.push({ so: d.dot.so, lyDo: d.dot.lyDo || '', ngay: d.dot.ngay,
                                       hanGop: d.dot.hanGop || '', ten: x.ten, tyLe: x.tyLe,
                                       phaiGop: x.phaiGop, daGop: x.daGop, thieu: x.thieu,
                                       lai: x.lai, trangThai: x.trangThai });
                        });
                    });
                    return out;
                },
                cols: [{ t: 'Mã đợt', k: 'so', w: 14 }, { t: 'Lý do', k: 'lyDo', w: 24 },
                       { t: 'Ngày tạo', k: 'ngay', w: 12 }, { t: 'Phải góp trước', k: 'hanGop', w: 13 },
                       { t: 'Cổ đông', k: 'ten', w: 22 }, { t: 'Tỷ lệ (%)', k: 'tyLe', w: 10 },
                       { t: 'Phải góp', k: 'phaiGop', w: 16, tong: true },
                       { t: 'Đã góp', k: 'daGop', w: 16, tong: true },
                       { t: 'Còn thiếu', k: 'thieu', w: 14, tong: true },
                       { t: 'Lãi chậm góp', k: 'lai', w: 14, tong: true },
                       { t: 'Trạng thái', k: 'trangThai', w: 14 }]
            },
            'thu-hoi': {
                tieu: 'BÁO CÁO THU HỒI VỐN VÀ QUỸ VỐN QUAY VÒNG',
                rows: function () {
                    return [
                        { ct: 'Nghĩa vụ phải góp', dau: q.nghiaVu.dauKy, ky: q.nghiaVu.trongKy, cuoi: q.nghiaVu.cuoiKy,
                          nguon: 'Bảng phân bổ của các đợt góp vốn' },
                        /* Ba chỉ tiêu tách bạch (v18.6.0 — Logic 2). */
                        { ct: 'Cổ đông đã thực góp (tiền cá nhân cổ đông)', dau: q.coDongNop.dauKy,
                          ky: q.coDongNop.trongKy, cuoi: q.coDongNop.cuoiKy,
                          nguon: 'Giao dịch Góp vốn — nguồn tiền Cổ đông nộp' },
                        { ct: 'Tiền công ty đã phân bổ vào nghĩa vụ', dau: q.phanBoBanHang.dauKy,
                          ky: q.phanBoBanHang.trongKy, cuoi: q.phanBoBanHang.cuoiKy,
                          nguon: 'Giao dịch Góp vốn — nguồn tiền Tiền bán hàng của công ty' },
                        { ct: 'Nghĩa vụ đã thực hiện (cộng hai dòng trên)', dau: q.daGop.dauKy,
                          ky: q.daGop.trongKy, cuoi: q.daGop.cuoiKy,
                          nguon: 'Cổ đông đã thực góp + Tiền công ty đã phân bổ' },
                        { ct: 'Cổ đông đã rút vốn', dau: q.daRut.dauKy, ky: q.daRut.trongKy, cuoi: q.daRut.cuoiKy,
                          nguon: 'Giao dịch vốn — Rút vốn' },
                        { ct: 'Lợi nhuận đã chi trả', dau: q.daChia.dauKy, ky: q.daChia.trongKy, cuoi: q.daChia.cuoiKy,
                          nguon: 'Giao dịch vốn — Chia lợi nhuận' },
                        { ct: 'Tiền bán hàng đã thu về', dau: q.tienThu.dauKy, ky: q.tienThu.trongKy, cuoi: q.tienThu.cuoiKy,
                          nguon: 'Phiếu thu đã ghi sổ' },
                        { ct: 'Tiền đã chi ra', dau: q.tienChi.dauKy, ky: q.tienChi.trongKy, cuoi: q.tienChi.cuoiKy,
                          nguon: 'Phiếu chi đã ghi sổ' },
                        { ct: 'TIỀN THỰC TẾ ĐANG CÓ', dau: q.tienThucTe.dauKy, ky: q.tienThucTe.trongKy,
                          cuoi: q.tienThucTe.cuoiKy,
                          nguon: 'Cổ đông thực góp − Rút − Đã chia + Thu − Chi − Trả NCC qua nhập kho' },
                        { ct: 'Giá vốn đang nằm trong hàng', dau: q.vonTrongHang.dauKy, ky: q.vonTrongHang.trongKy,
                          cuoi: q.vonTrongHang.cuoiKy, nguon: 'Phát lại sổ kho tới ngày chốt' },
                        { ct: 'Giá vốn đã thu hồi trong kỳ', dau: 0, ky: q.daThuHoi, cuoi: q.daThuHoi,
                          nguon: 'Giá vốn hàng đã bán — T.ketQuaKinhDoanh' },
                        { ct: 'QUỸ VỐN QUAY VÒNG', dau: q.quyQuayVong.dauKy, ky: q.quyQuayVong.trongKy,
                          cuoi: q.quyQuayVong.cuoiKy, nguon: 'Tiền thực tế + Giá vốn trong hàng' }
                    ];
                },
                cols: [{ t: 'Chỉ tiêu', k: 'ct', w: 40 }, { t: 'Đầu kỳ', k: 'dau', w: 20, tong: true },
                       { t: 'Phát sinh trong kỳ', k: 'ky', w: 20, tong: true },
                       { t: 'Cuối kỳ', k: 'cuoi', w: 20, tong: true },
                       { t: 'Nguồn số liệu', k: 'nguon', w: 44 }]
            },
            'chia-ln': {
                tieu: 'BÁO CÁO PHÂN CHIA LỢI NHUẬN',
                rows: function () { return ln.theoCoDong; },
                cols: [{ t: 'Cổ đông', k: 'ten', w: 26 }, { t: 'Tỷ lệ (%)', k: 'tyLe', w: 10 },
                       { t: 'Được chia', k: 'duocChia', w: 18, tong: true },
                       { t: 'Lãi chậm góp', k: 'laiChamGop', w: 16, tong: true },
                       { t: 'Khấu trừ', k: 'khauTru', w: 14, tong: true },
                       { t: 'Thực nhận', k: 'thucNhan', w: 18, tong: true },
                       { t: 'Đã nhận trong kỳ', k: 'daNhanTrongKy', w: 18, tong: true },
                       { t: 'Còn phải trả', k: 'conPhaiTra', w: 16, tong: true }]
            }
        };
        body.querySelectorAll('[data-xl]').forEach(function (b) {
            b.onclick = function () {
                var c = CFG[b.getAttribute('data-xl')];
                UI.xuatExcel('GopVon_' + b.getAttribute('data-xl') + '_' + k.den, c.tieu,
                    c.cols.map(function (x) { return { t: x.t, k: x.k, w: x.w || 18 }; }), c.rows());
            };
        });
        body.querySelectorAll('[data-bc]').forEach(function (b) {
            b.onclick = function () {
                var c = CFG[b.getAttribute('data-bc')];
                W.inBaoCao({
                    tieu: c.tieu, phu: (bc.donVi || {}).ten || '',
                    tu: k.tu || '', den: k.den, thoiDiem: T.today(), dieuKien: dieuKienKy(),
                    cols: c.cols.map(function (x) {
                        return { t: x.t, k: x.k, w: x.w, cls: x.tong ? 'n' : '', tong: !!x.tong };
                    }),
                    rows: c.rows(), kyTrai: 'KẾ TOÁN', kyPhai: 'GIÁM ĐỐC'
                });
            };
        });
        body.querySelectorAll('[data-cdbc]').forEach(function (b) {
            b.onclick = function () {
                var cd = DB.get('coDong', b.getAttribute('data-cdbc'));
                if (cd) inSoCoDong(cd, T.soVonCoDong(cd, l));
            };
        });
    }

    /* ------------------------------------------------------- CÁC BẢN IN */
    function dieuKien(l) {
        return [
            { t: 'Đơn vị', v: dvVon.ten || '' },
            { t: 'Kỳ báo cáo', v: (l.tuNgay || l.denNgay)
                ? (l.tuNgay ? T.date(l.tuNgay) : '…') + ' → ' + T.date(l.denNgay || T.today())
                : 'Toàn bộ dữ liệu' }
        ];
    }
    function inCoDong(rows) {
        W.inBaoCao({
            tieu: 'DANH SÁCH CỔ ĐÔNG VÀ TÌNH HÌNH GÓP VỐN', phu: dvVon.ten || '',
            thoiDiem: T.today(), dieuKien: dieuKien(loc()),
            cols: [{ t: 'Mã', k: 'ma', w: 10 }, { t: 'Cổ đông', k: 'ten', w: 28 },
                   { t: 'Tỷ lệ (%)', k: 'tyLe', w: 10, cls: 'n' },
                   { t: 'Đã góp', k: 'daGop', w: 18, cls: 'n', tong: true },
                   { t: 'Đã rút', k: 'daRut', w: 16, cls: 'n', tong: true },
                   { t: 'Vốn ròng', k: 'vonRong', w: 18, cls: 'n', tong: true },
                   { t: 'Còn thiếu', k: 'thieu', w: 16, cls: 'n', tong: true },
                   { t: 'Lãi chậm góp', k: 'lai', w: 16, cls: 'n', tong: true },
                   { t: 'Trạng thái', k: 'trangThai', w: 16 }],
            rows: rows, kyTrai: 'KẾ TOÁN', kyPhai: 'GIÁM ĐỐC'
        });
    }
    function inDot(rows) {
        W.inBaoCao({
            tieu: 'BÁO CÁO CÁC ĐỢT GÓP VỐN', phu: dvVon.ten || '',
            thoiDiem: T.today(), dieuKien: dieuKien(loc()),
            cols: [{ t: 'Mã đợt', k: 'so', w: 14 }, { t: 'Lý do huy động', k: 'lyDo', w: 30 },
                   { t: 'Ngày tạo', k: 'ngay', w: 12 }, { t: 'Phải góp trước', k: 'hanGop', w: 13 },
                   { t: 'Cần huy động', k: 'giaTriHuyDong', w: 18, cls: 'n', tong: true },
                   { t: 'Đã góp', k: 'daGop', w: 18, cls: 'n', tong: true },
                   { t: 'Còn thiếu', k: 'thieu', w: 16, cls: 'n', tong: true },
                   { t: 'Lãi chậm góp', k: 'lai', w: 16, cls: 'n', tong: true },
                   { t: 'Trạng thái', k: 'trangThai', w: 14 }],
            rows: rows, kyTrai: 'KẾ TOÁN', kyPhai: 'GIÁM ĐỐC'
        });
    }
    function inChiTietDot(r, k) {
        W.inBaoCao({
            tieu: 'BÁO CÁO ĐỢT GÓP VỐN ' + (r.so || ''), phu: r.lyDo || '',
            thoiDiem: T.today(),
            dieuKien: dieuKien(loc()).concat([
                { t: 'Ngày tạo đợt', v: T.date(r.ngay) },
                { t: 'Ngày phải góp', v: r.hanGop ? T.date(r.hanGop) : '' },
                { t: 'Lãi suất chậm góp', v: T.num(Number(r.laiSuat) || T.cauHinhVon().laiSuat, 2) + '%/năm' },
                { t: 'Giá trị cần huy động', v: T.money(r.giaTriHuyDong) + ' đ' }
            ]),
            cols: [{ t: 'Cổ đông', k: 'ten', w: 30 }, { t: 'Tỷ lệ (%)', k: 'tyLe', w: 10, cls: 'n' },
                   { t: 'Phải góp', k: 'phaiGop', w: 20, cls: 'n', tong: true },
                   { t: 'Đã góp', k: 'daGop', w: 20, cls: 'n', tong: true },
                   { t: 'Còn thiếu', k: 'thieu', w: 18, cls: 'n', tong: true },
                   { t: 'Lãi chậm góp', k: 'lai', w: 18, cls: 'n', tong: true },
                   { t: 'Trạng thái', k: 'trangThai', w: 16 }],
            rows: k.theoCoDong, tienChu: k.phaiGop,
            kyTrai: 'KẾ TOÁN', kyPhai: 'GIÁM ĐỐC'
        });
    }
    function inChiaLN(ln) {
        W.inBaoCao({
            tieu: 'BÁO CÁO PHÂN CHIA LỢI NHUẬN', phu: dvVon.ten || '',
            thoiDiem: T.today(),
            dieuKien: dieuKien(loc()).concat([
                { t: 'Doanh thu', v: T.money(ln.kq.doanhThu) + ' đ' },
                { t: 'Giá vốn', v: T.money(ln.kq.giaVon) + ' đ' },
                { t: 'Chi phí', v: T.money(ln.kq.chiPhi) + ' đ' },
                { t: 'Lợi nhuận thuần', v: T.money(ln.kq.loiNhuan) + ' đ' },
                { t: 'Lợi nhuận đem chia', v: T.money(ln.deChia) + ' đ' }
            ]),
            cols: [{ t: 'Cổ đông', k: 'ten', w: 30 }, { t: 'Tỷ lệ (%)', k: 'tyLe', w: 10, cls: 'n' },
                   { t: 'Được chia', k: 'duocChia', w: 20, cls: 'n', tong: true },
                   { t: 'Lãi chậm góp', k: 'laiChamGop', w: 18, cls: 'n', tong: true },
                   { t: 'Khấu trừ', k: 'khauTru', w: 16, cls: 'n', tong: true },
                   { t: 'Thực nhận', k: 'thucNhan', w: 20, cls: 'n', tong: true },
                   { t: 'Đã nhận trong kỳ', k: 'daNhanTrongKy', w: 20, cls: 'n', tong: true },
                   { t: 'Còn phải trả', k: 'conPhaiTra', w: 18, cls: 'n', tong: true }],
            rows: ln.theoCoDong, tienChu: ln.deChia,
            ghiChu: ln.choBu > 0 ? 'Kỳ này lỗ ' + T.money(ln.choBu) +
                ' đ nên không chia lợi nhuận; khoản lỗ chuyển sang lợi nhuận chờ bù.' : '',
            kyTrai: 'KẾ TOÁN', kyPhai: 'GIÁM ĐỐC'
        });
    }
    function inSoCoDong(cd, s) {
        W.inBaoCao({
            tieu: 'SỔ VỐN CỔ ĐÔNG — ' + (cd.ten || ''), phu: dvVon.ten || '',
            land: false, thoiDiem: T.today(),
            dieuKien: dieuKien(loc()).concat([
                { t: 'Tỷ lệ sở hữu', v: T.num(s.tyLe, 2) + '%' },
                { t: 'Đã góp', v: T.money(s.daGop) + ' đ' },
                { t: 'Đã rút', v: T.money(s.daRut) + ' đ' },
                { t: 'Vốn ròng', v: T.money(s.vonRong) + ' đ' },
                { t: 'Còn thiếu', v: T.money(s.thieu) + ' đ' },
                { t: 'Lãi chậm góp', v: T.money(s.lai) + ' đ' },
                { t: 'Vốn đang quay vòng', v: T.money(s.dangQuayVong) + ' đ' },
                { t: 'Lợi nhuận được chia', v: T.money(s.duocChia) + ' đ' },
                { t: 'Giá trị thực nhận', v: T.money(s.thucNhan) + ' đ' }
            ]),
            cols: [{ t: 'Ngày', k: 'ngay', w: 14, v: function (r) { return T.date(r.ngay); } },
                   { t: 'Số chứng từ', k: 'so', w: 18 },
                   { t: 'Loại giao dịch', k: 'loai', w: 20 },
                   { t: 'Đợt góp vốn', k: '_dot', w: 18,
                     v: function (r) { var d = r.dotId ? DB.get('dotGopVon', r.dotId) : null; return d ? d.so : ''; } },
                   { t: 'Số tiền', k: 'soTien', w: 20, cls: 'n', tong: true },
                   { t: 'Hình thức', k: 'hinhThuc', w: 18 },
                   { t: 'Ghi chú', k: 'ghiChu', w: 26 }],
            rows: s.nhatKy, tienChu: s.thucNhan,
            kyTrai: 'KẾ TOÁN', kyPhai: 'CỔ ĐÔNG'
        });
    }

    /* ------------------------------------------------------- CẤU HÌNH */
    function caiDat() {
        if (!Q.co(MOD, 'sua')) return UI.thieuQuyen(MOD, 'sua');
        var c = T.cauHinhVon();
        UI.modal({
            size: 'sm', title: 'Cấu hình lãi chậm góp',
            sub: 'Áp dụng cho các đợt không khai lãi suất riêng',
            body: '<div class="grid2">' +
                '<div class="fld req"><label>Lãi suất mặc định (%/năm)</label>' +
                    '<input class="tyle" data-f="laiSuat" value="' + T.soVe(c.laiSuat, 2) +
                    '" style="font-size:16px;font-weight:700"></div>' +
                '<div class="fld"><label>&nbsp;</label><label class="chk">' +
                    '<input type="checkbox" data-f="khauTruLai"' + (c.khauTruLai ? ' checked' : '') + '> ' +
                    'Khấu trừ lãi chậm góp vào lợi nhuận được chia</label></div>' +
                '</div>' +
                '<div class="note b mt12"><i class="bi bi-info-circle"></i><div>' +
                'Lãi chỉ tính trên <b>phần còn thiếu</b> và chỉ từ <b>ngày phải góp</b> trở đi. ' +
                'Đây là số liệu thanh toán <b>nội bộ giữa các cổ đông</b> — không đi vào doanh thu, ' +
                'chi phí, lợi nhuận hay bất kỳ báo cáo nào của phần mềm.<br><br>' +
                'Tắt ô khấu trừ thì lãi chỉ hiển thị để theo dõi, hệ thống không tự trừ.</div></div>',
            buttons: [
                { text: 'Hủy', click: function (x) { x.close(); } },
                { text: 'Lưu cấu hình', cls: 'ok', icon: 'bi-save', click: function (x) {
                    if (!UI.validate(x.el, [{ k: 'laiSuat',
                        test: function (v) { return T.so(v) >= 0 && T.so(v) <= 100; },
                        msg: 'Lãi suất phải từ 0 đến 100' }])) return;
                    var v = UI.read(x.el);
                    var cc = T.cauHinhVon();
                    cc.laiSuat = T.so(v.laiSuat);
                    cc.khauTruLai = !!v.khauTruLai;
                    DB.save(); x.close();
                    UI.toast('ok', 'Đã lưu cấu hình',
                        'Lãi chậm góp ' + T.num(cc.laiSuat, 2) + '%/năm · ' +
                        (cc.khauTruLai ? 'có khấu trừ vào lợi nhuận' : 'không khấu trừ'));
                    ve();
                } }
            ],
            onOpen: function (x) { UI.numInput(x.el); }
        });
    }

    /* ------------------------------------------------------- ĐIỀU PHỐI */
    function ve() {
        nhanKy();
        if (tab === 'quy-trinh') return veQuyTrinh();
        if (tab === 'tong-quan') return veTongQuan();
        if (tab === 'co-dong') return veCoDong();
        if (tab === 'dot') return veDot();
        if (tab === 'thu-hoi') return veThuHoi();
        if (tab === 'loi-nhuan') return veLoiNhuan();
        if (tab === 'dong-tien') return veDongTien();
        return veBaoCao();
    }
    /** Chuyển thẻ bằng mã — dùng cho các nút "Xem" của màn Quy trình. */
    function moThe(k) {
        host.querySelectorAll('[data-gv]').forEach(function (x) {
            x.classList.toggle('on', x.getAttribute('data-gv') === k);
        });
        tab = k; ve();
    }

    /* ==================================================================
       QUY TRÌNH TỪNG BƯỚC — bảng chỉ dẫn 10 bước của phân hệ Cổ đông.
       Màn hình này KHÔNG tính toán gì mới và KHÔNG ghi dữ liệu: mọi con số
       đọc từ đúng các hàm Engine đang dùng ở các thẻ khác; mọi nút hành động
       mở ĐÚNG biểu mẫu hiện có (tạo đợt, ghi nhận tiền góp, phân bổ tiền
       công ty, rút vốn, chia lợi nhuận). Nó chỉ trả lời ba câu hỏi của người
       dùng: đang ở bước nào — bước nào xong rồi — bước tiếp theo bấm gì.
       ================================================================== */
    function veQuyTrinh() {
        var l = loc();
        var den = l.denNgay || '';
        var dsCD = T.dsCoDongTaiNgay();
        var tongTL = T.tongTyLe();
        var moi = T.tinhMoiDot(den);
        var th = moi.tongHop || {};
        var soDot = moi.ds.length;
        var coDongNop = T.vonCoDongNop(den);
        var pbBanHang = T.vonPhanBoBanHang(den);
        var soRut = T.gdVon(function (g) { return g.loai === 'Rút vốn'; }).length;
        var soChia = T.gdVon(function (g) { return g.loai === 'Chia lợi nhuận'; }).length;
        var coNghiaVu = th.nghiaVuHoatDong > 0;
        var duTien = coNghiaVu && th.conThieu <= 0;
        /* Cơ chế tiền công ty gắn với từng đợt (v18.10.0): bước 05 chỉ áp dụng
           khi có ít nhất một đợt bật "cho phép dùng tiền công ty". */
        var dsDotTCT = T.dsDotChoPhepTienCongTy();
        var coCoChe = dsDotTCT.length > 0;

        /* Trạng thái từng bước: xong = đã có dữ liệu; bb = bước bắt buộc. */
        var BUOC = [
            { so: '01', t: 'Cổ đông', bb: true, xong: dsCD.length > 0,
              mo: 'Khai danh sách cổ đông và tỷ lệ sở hữu. Đổi tỷ lệ chỉ bằng nút "Đổi tỷ lệ sở hữu" để giữ lịch sử.',
              sl: dsCD.length ? dsCD.length + ' cổ đông · tổng tỷ lệ ' + T.num(tongTL, 2) + '%' +
                  (Math.abs(tongTL - 100) > 0.01 ? ' ⚠ chưa đủ 100%' : '') : 'Chưa có cổ đông',
              nut: 'Thêm cổ đông', hanhDong: function () { formCoDong(null, ve); }, xem: 'co-dong' },
            { so: '02', t: 'Đợt góp vốn', bb: true, xong: soDot > 0,
              mo: 'Khai cần huy động bao nhiêu, hạn góp, lãi suất chậm góp. Số đợt do hệ thống tự sinh.',
              sl: soDot ? soDot + ' đợt · tổng nghĩa vụ ' + tien(th.nghiaVuHoatDong) + ' đ' : 'Chưa có đợt góp vốn',
              nut: 'Tạo đợt góp vốn', hanhDong: function () {
                  if (!dsCD.length) return UI.khongThe('Tạo đợt góp vốn',
                      'Chưa có cổ đông nào đang tham gia.',
                      'Làm bước 01 — Thêm cổ đông trước.');
                  formDot(null, ve);
              }, xem: 'dot' },
            { so: '03', t: 'Phân bổ nghĩa vụ', bb: true, tuDong: true, xong: soDot > 0,
              mo: 'Hệ thống TỰ chia giá trị huy động cho từng cổ đông theo tỷ lệ sở hữu tại ngày tạo đợt — không nhập tay.',
              sl: soDot ? 'Engine đã tự phân bổ cho ' + dsCD.length + ' cổ đông theo tỷ lệ' : 'Chờ tạo đợt ở bước 02',
              xem: 'dot' },
            { so: '04', t: 'Ghi nhận thực góp', bb: true, xong: coDongNop > 0,
              mo: 'Ghi từng khoản tiền cổ đông thực nộp và gán vào nghĩa vụ của đợt (có nút Gợi ý phân bổ theo hạn góp).',
              sl: coDongNop > 0 ? 'Cổ đông đã thực góp ' + tien(coDongNop) + ' đ' : 'Chưa ghi nhận khoản nộp nào',
              nut: 'Ghi nhận tiền góp', hanhDong: function () { ghiTienGop(null, ve); }, xem: 'dot' },
            { so: '05', t: 'Tiền công ty phân bổ vào nghĩa vụ (nếu đợt góp vốn có áp dụng)',
              bb: false, xong: pbBanHang > 0, boQua: !coCoChe && !(pbBanHang > 0),
              mo: coCoChe
                  ? 'Đợt có áp dụng cơ chế: ' + dsDotTCT.map(function (d) { return T.esc(d.so); }).join(', ') +
                    '. Dùng tiền bán hàng của công ty thực hiện nghĩa vụ theo tỷ lệ — KHÔNG phải tiền ' +
                    'cá nhân cổ đông nộp, không đếm hai lần.'
                  : 'Tiền bán hàng KHÔNG mặc nhiên là tiền góp vốn. Không có đợt nào bật cơ chế ' +
                    '“cho phép dùng tiền công ty” nên bước này được BỎ QUA chính thức — không tạo ' +
                    'dữ liệu, không tạo chứng từ, quy trình vẫn đi tiếp bình thường.',
              sl: pbBanHang > 0
                  ? 'Đã phân bổ ' + tien(pbBanHang) + ' đ tiền công ty' +
                    (coCoChe ? '' : ' (giao dịch đã ghi trước khi có cơ chế theo đợt — cần rà soát riêng)')
                  : (coCoChe ? 'Chưa phân bổ khoản nào' : 'Không áp dụng — tiền bán hàng vẫn là tiền của công ty'),
              nut: coCoChe ? 'Phân bổ tiền bán hàng' : '',
              hanhDong: coCoChe ? function () { phanBoTien(null, ve); } : null, xem: 'dot' },
            { so: '06', t: 'Kiểm tra còn thiếu', bb: true, tuDong: true, xong: duTien,
              mo: 'Còn phải góp = Nghĩa vụ − (Cổ đông thực góp + Tiền công ty phân bổ). Hệ thống tự tính, không tính tay.',
              sl: !coNghiaVu ? 'Chờ tạo đợt ở bước 02'
                  : (th.conThieu > 0 ? 'CÒN THIẾU ' + tien(th.conThieu) + ' đ' : 'ĐÃ HOÀN THÀNH — đủ nghĩa vụ'),
              xem: 'dot' },
            { so: '07', t: 'Lãi chậm góp', bb: true, tuDong: true, xong: coNghiaVu && !(th.lai > 0),
              canhBao: coNghiaVu && th.lai > 0,
              mo: 'Tính theo từng khoảng thời gian thực tế của từng lát nghĩa vụ: từ ngày — đến ngày — số dư thiếu — lãi suất — công thức.',
              sl: !coNghiaVu ? 'Chờ phát sinh nghĩa vụ'
                  : (th.lai > 0 ? 'Lãi chậm góp hiện tại ' + tien(th.lai) + ' đ — xem diễn giải từng khoảng'
                                : 'Không phát sinh lãi'),
              xem: 'dong-tien', tenXem: 'Xem diễn giải từng khoảng' },
            { so: '08', t: 'Rút vốn (nếu có)', bb: false, xong: soRut > 0,
              mo: 'Chứng từ rút vốn tự sinh; Engine chặn rút quá phần thực góp cá nhân và quá quỹ đã cam kết nhập hàng.',
              sl: soRut ? soRut + ' giao dịch rút vốn' : 'Chưa có',
              nut: 'Rút vốn', hanhDong: function () { formGD('Rút vốn', null, ve); }, xem: 'dong-tien' },
            { so: '09', t: 'Lợi nhuận / chia lợi nhuận (nếu có)', bb: false, xong: soChia > 0,
              mo: 'Nghiệp vụ riêng, không trộn với góp vốn hay tiền bán hàng. Chỉ chia phần lợi nhuận Tản Viên dương của kỳ.',
              sl: soChia ? soChia + ' giao dịch chia lợi nhuận' : 'Chưa có',
              nut: 'Mở màn Lợi nhuận', hanhDong: function () { moThe('loi-nhuan'); }, xem: 'loi-nhuan' },
            { so: '10', t: 'Báo cáo', bb: true, tuDong: true, xong: true,
              mo: 'Toàn bộ báo cáo tổng hợp từ chứng từ gốc — không nhập lại bằng tay. Kèm bảng đối chiếu tự động ở thẻ Tổng quan.',
              sl: 'Sẵn sàng khi các bước trên xong',
              nut: 'Mở Báo cáo', hanhDong: function () { moThe('bao-cao'); }, xem: 'bao-cao' }
        ];

        /* Bước đang thực hiện = bước BẮT BUỘC đầu tiên chưa xong. */
        var hienTai = -1;
        BUOC.forEach(function (b, i) { if (hienTai < 0 && b.bb && !b.xong) hienTai = i; });
        var xongHet = hienTai < 0;
        var soXong = BUOC.filter(function (b) { return b.bb && b.xong; }).length;
        var soBB = BUOC.filter(function (b) { return b.bb; }).length;

        function pill(b, i) {
            if (b.xong) return '<span class="pill g"><i class="bi bi-check-lg"></i> Hoàn thành</span>';
            if (b.boQua) return '<span class="pill"><i class="bi bi-skip-forward"></i> Bỏ qua — không áp dụng</span>';
            if (b.canhBao) return '<span class="pill y"><i class="bi bi-exclamation-triangle"></i> Cần theo dõi</span>';
            if (i === hienTai) return '<span class="pill y"><i class="bi bi-play-fill"></i> Đang thực hiện</span>';
            return b.bb ? '<span class="pill n">Chưa bắt đầu</span>'
                        : '<span class="pill">Tùy chọn</span>';
        }

        body.innerHTML =
            '<div class="note ' + (xongHet ? 'g' : 'b') + ' mb12"><i class="bi bi-signpost-split-fill"></i><div>' +
            '<b>Quy trình Cổ đông — ' + (xongHet
                ? 'các bước bắt buộc đã hoàn thành (' + soXong + '/' + soBB + ').'
                : 'đang ở BƯỚC ' + BUOC[hienTai].so + ' — ' + T.esc(BUOC[hienTai].t) +
                  ' (' + soXong + '/' + soBB + ' bước bắt buộc đã xong).') + '</b> ' +
            'Tạo nghiệp vụ → hệ thống tự sinh chứng từ, tự phân bổ, tự liên kết — chỉ cần đi lần lượt ' +
            'theo bảng dưới, không phải nhớ menu nào.</div></div>' +
            '<div class="toolbar mb12">' +
            '<button class="btn primary" data-qt-tao><i class="bi bi-plus-lg"></i> Tạo đợt góp vốn</button>' +
            '<button class="btn ok-solid" data-qt-gop><i class="bi bi-arrow-down-circle"></i> Ghi nhận tiền góp</button>' +
            '<span class="tb-sep"></span>' +
            '<button class="btn" data-qt-truoc' + (hienTai <= 0 ? ' disabled' : '') +
                '><i class="bi bi-arrow-left"></i> Quay lại bước trước</button>' +
            '<button class="btn warn" data-qt-tiep' + (xongHet ? ' disabled' : '') +
                '><i class="bi bi-arrow-right-circle-fill"></i> Tiếp tục — bước ' +
                (xongHet ? '—' : BUOC[hienTai].so) + '</button>' +
            '<span class="spacer"></span><span class="small muted">' +
            (xongHet ? 'Có thể mở Báo cáo và đối chiếu' : 'Bước hiện tại: ' + BUOC[hienTai].so + '/10') +
            '</span></div>' +
            '<div class="tablewrap"><table class="grid"><thead><tr>' +
            '<th style="width:64px">Bước</th><th style="width:250px">Nghiệp vụ</th>' +
            '<th>Diễn giải</th><th style="width:280px">Số liệu hiện tại</th>' +
            '<th style="width:140px">Trạng thái</th><th style="width:210px">Thao tác</th>' +
            '</tr></thead><tbody>' +
            BUOC.map(function (b, i) {
                return '<tr' + (i === hienTai ? ' style="background:var(--head)"' : '') + '>' +
                    '<td class="ctr"><b>' + b.so + '</b></td>' +
                    '<td><b>' + T.esc(b.t) + '</b>' +
                        (b.tuDong ? '<div class="small muted"><i class="bi bi-magic"></i> Hệ thống tự làm</div>' : '') + '</td>' +
                    '<td class="small">' + b.mo + '</td>' +
                    '<td class="small"><b>' + b.sl + '</b></td>' +
                    '<td>' + pill(b, i) + '</td>' +
                    '<td>' +
                    (b.nut ? '<button class="btn sm ' + (i === hienTai ? 'primary' : '') +
                        '" data-qt-hd="' + i + '">' + T.esc(b.nut) + '</button> ' : '') +
                    (b.xem ? '<button class="btn sm ghost" data-qt-xem="' + b.xem + '" ' +
                        'title="' + T.esc(b.tenXem || 'Mở thẻ chi tiết để xem lại chứng từ') + '">' +
                        '<i class="bi bi-eye"></i></button>' : '') +
                    '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            ghiChuNguon('Màn hình này chỉ ĐỌC số liệu từ Engine và mở đúng các biểu mẫu hiện có — ' +
                'không tính toán riêng, không ghi dữ liệu, nên không bao giờ lệch với các thẻ khác. ' +
                'Chứng từ đợt góp (ĐGV-…) và giao dịch vốn (GDV-…) đều do hệ thống tự sinh số, ' +
                'không nhập tay, không trùng.');

        var qsB = function (s) { return body.querySelector(s); };
        if (qsB('[data-qt-tao]')) qsB('[data-qt-tao]').onclick = BUOC[1].hanhDong;
        if (qsB('[data-qt-gop]')) qsB('[data-qt-gop]').onclick = BUOC[3].hanhDong;
        if (qsB('[data-qt-tiep]')) qsB('[data-qt-tiep]').onclick = function () {
            if (xongHet) return;
            var b = BUOC[hienTai];
            if (b.hanhDong) b.hanhDong();
            else if (b.xem) moThe(b.xem);
        };
        if (qsB('[data-qt-truoc]')) qsB('[data-qt-truoc]').onclick = function () {
            for (var i = hienTai - 1; i >= 0; i--) {
                if (BUOC[i].nut || BUOC[i].xem) {
                    if (BUOC[i].hanhDong && BUOC[i].nut) BUOC[i].hanhDong();
                    else if (BUOC[i].xem) moThe(BUOC[i].xem);
                    return;
                }
            }
        };
        body.querySelectorAll('[data-qt-hd]').forEach(function (n) {
            n.onclick = function () { BUOC[Number(n.getAttribute('data-qt-hd'))].hanhDong(); };
        });
        body.querySelectorAll('[data-qt-xem]').forEach(function (n) {
            n.onclick = function () { moThe(n.getAttribute('data-qt-xem')); };
        });
        UI.mauNut(body);
    }

    host.querySelectorAll('[data-gv]').forEach(function (t) {
        t.onclick = function () {
            host.querySelectorAll('[data-gv]').forEach(function (x) { x.classList.remove('on'); });
            t.classList.add('on'); tab = t.getAttribute('data-gv'); ve();
        };
    });
    if (qs('[data-loc]')) qs('[data-loc]').onclick = function () { ve(); };
    if (qs('[data-boloc]')) qs('[data-boloc]').onclick = function () {
        qs('#gvNam').value = ''; qs('#gvTu').value = ''; qs('#gvDen').value = ''; ve();
    };
    qs('#gvNam').onchange = function () { apNam(); ve(); };
    /* Sửa tay hai ô ngày thì bỏ chọn năm — tránh nhãn năm mâu thuẫn với mốc ngày. */
    ['#gvTu', '#gvDen'].forEach(function (id) {
        qs(id).onchange = function () {
            var n = qs('#gvNam').value;
            if (n && (qs('#gvTu').value !== n + '-01-01' || qs('#gvDen').value !== n + '-12-31'))
                qs('#gvNam').value = '';
            nhanKy();
        };
    });
    if (qs('[data-caidat]')) qs('[data-caidat]').onclick = caiDat;
    UI.mauNut(qs('#gvTb'));

    ve();
};

})(window);

/* ==========================================================================
   TVERP — TRANG CHỦ / BẢNG ĐIỀU HÀNH
   --------------------------------------------------------------------------
   Đây là màn hình ĐIỀU HÀNH, không phải màn hình thống kê. Người xem cần trả
   lời được ba câu trong vòng năm giây: Đang lãi hay lỗ? Lãi ở đâu? Có gì sai?

   MỌI CON SỐ TRÊN MÀN HÌNH NÀY ĐỀU DO BUSINESS ENGINE CẤP.
   Trang chủ không tự cộng lại theo cách riêng, không có công thức nào của
   riêng nó. Doanh thu, giá vốn, chi phí, lợi nhuận, tồn kho, công nợ đều gọi
   đúng những hàm mà Báo cáo và bộ Đối chiếu đang dùng — nên ba nơi không bao
   giờ ra ba con số khác nhau.

   Bảng điều hành TỰ ĐỔI THEO ĐƠN VỊ ĐANG LÀM VIỆC. Chọn Tản Viên thì giá vốn
   là giá vốn thật của kho; chọn EMC · AA · Thái Phong thì giá vốn là giá vốn
   nội bộ đã đóng băng trên chứng từ. Người dùng không phải chọn cách tính.
   ========================================================================== */
(function (W) {
'use strict';
var T = W.T, DB = W.DB, UI = W.UI, S = W.SCREEN = W.SCREEN || {};

/* ==========================================================================
   KHOẢNG THỜI GIAN XEM
   --------------------------------------------------------------------------
   Trang chủ KHÔNG tự định nghĩa "tháng này", "quý trước", "12 tháng gần nhất"
   là gì. Toàn bộ việc giải mã kỳ nằm ở T.kyChon trong Business Engine, dùng
   chung với Báo cáo tổng hợp và Trợ lý quản trị — nên ba nơi không thể hiểu
   một kỳ theo ba cách khác nhau.

   Danh sách NĂM lấy ĐỘNG từ chứng từ thật: có dữ liệu năm nào thì hiện năm
   đó, sang năm mới tự xuất hiện, không khai cứng ở bất cứ đâu.
   ========================================================================== */
var kyHienTai = 'nam';
var tuyChon = { tuNgay: '', denNgay: '' };

function kyDangXem() { return T.kyChon(kyHienTai, tuyChon); }

/** Một ngày có nằm trong kỳ đang xem hay không — dùng cho các số đếm chứng từ. */
function trongKy(ngay) {
    var k = kyDangXem(), d = String(ngay || '');
    if (k.tuNgay && d < k.tuNgay) return false;
    if (k.denNgay && d > k.denNgay) return false;
    return true;
}

/** Bộ lọc gửi cho Business Engine — đúng kỳ đang xem, đúng đơn vị đang làm việc. */
function locKy(cid) {
    var k = kyDangXem(), o = {};
    if (k.tuNgay) o.tuNgay = k.tuNgay;
    if (k.denNgay) o.denNgay = k.denNgay;
    if (cid) o.donViId = cid;
    return o;
}

S['trang-chu'] = function (host) {
    W.crumb([]);
    host.innerHTML = '<div class="page" id="tcPage"></div>';
    ve();

    function ve() {
        var cty = DB.cty(), cid = cty.id;
        var ky = kyDangXem();
        var loc = locKy(cid);
        var locNhom = locKy('');

        /* ---- MỘT ẢNH CHỤP DUY NHẤT CỦA KỲ, DÙNG CHO CẢ MÀN HÌNH ----
           Doanh thu, giá vốn, chi phí, lợi nhuận, tồn kho tại ngày chốt, công
           nợ tại ngày chốt và dòng tiền trong kỳ đều lấy từ T.tongHopKy nên
           không có đường nào để hai vùng trên màn hình ở hai kỳ khác nhau. */
        var th = T.tongHopKy(loc);
        var kq = th.kq;
        var dc = T.doiChieuSo(loc);
        var hh = DB.all('hangHoa');
        var giaTriTon = th.giaTriTonKho;
        var soMaConHang = th.tonKho.soMa !== undefined ? th.tonKho.soMa
                        : hh.filter(function (x) { return x.ton > 0; }).length;
        var phaiThu = th.phaiThu.conPhaiThu;
        var phaiTra = th.phaiTra.conPhaiTra;
        var dtien = th.dongTien;

        var h = '';

        /* ================= ĐƠN VỊ ĐANG LÀM VIỆC ================= */
        h += '<div class="page-head"><div><h2>Đơn vị đang làm việc</h2>' +
            '<div class="sub">Bấm chọn công ty — toàn bộ bảng điều hành, chứng từ tạo mới và biểu mẫu in tự đổi theo</div></div>' +
            '<div class="spacer"></div><div class="row">' +
            '<button class="btn" id="btnHd"><i class="bi bi-question-circle"></i> Hướng dẫn nhanh</button>' +
            '</div></div>';
        h += '<div class="cty-picker">' + DB.all('donVi').map(function (d) {
            var on = d.id === cid;
            var n = DB.all('donBan').filter(function (x) {
                return x.donVi === d.id && trongKy(x.ngay); }).length;
            return '<div class="cty-card' + (on ? ' on' : '') + '" data-cty="' + d.id + '" title="' + T.esc(d.ten) + '">' +
                '<div class="lg">' + (d.logo ? '<img src="' + d.logo + '" alt="">' : '<span>' + T.esc(d.tat.substr(0, 3).toUpperCase()) + '</span>') + '</div>' +
                '<div class="nm"><b>' + T.esc(d.tat) + '</b><small>' + T.esc(d.ten) + '</small>' +
                '<div class="small" style="margin-top:3px;color:var(--ink-3)">' + n + ' đơn bán · MST ' + T.esc(d.mst || '—') + '</div></div>' +
                '<i class="bi bi-check-circle-fill tick" title="Đang làm việc"></i>' +
                '<span class="flag">chọn</span></div>';
        }).join('') + '</div>';

        /* ================= ĐẦU BẢNG ĐIỀU HÀNH ================= */
        h += '<div class="page-head" style="margin-top:4px"><div><h2>Bảng điều hành — ' + T.esc(cty.tat) + '</h2>' +
            '<div class="sub">' + T.esc(moTaGiaVon(cid)) + '</div></div>' +
            '<div class="spacer"></div><div class="row">' +
            '<button class="btn primary" data-nhanh="bao-gia"><i class="bi bi-plus-lg"></i> Lập Báo giá</button>' +
            '<button class="btn" data-nhanh="phieu-chi"><i class="bi bi-cash-stack"></i> Lập Phiếu chi</button>' +
            '</div></div>';

        /* ================= KỲ BÁO CÁO ================= */
        h += '<div class="card mb12"><div class="card-h"><i class="bi bi-calendar-range"></i> ' +
            'Kỳ báo cáo<span class="spacer"></span><span class="small muted">' +
            'Đổi kỳ là TOÀN BỘ bảng điều hành đổi theo — chỉ tiêu, biểu đồ, tồn kho, công nợ, dòng tiền' +
            '</span></div><div class="card-b">' +
            '<div class="row" style="gap:6px">' +
            T.KY_CHON_SAN.map(function (x) {
                return '<button class="btn sm' + (x.k === kyHienTai ? ' primary' : '') +
                    '" data-ky="' + x.k + '">' + T.esc(x.t) + '</button>';
            }).join('') +
            (function () {
                var ns = T.cacNamCoDuLieu({ donViId: cid }).slice().reverse();
                if (!ns.length) return '';
                return '<select class="sm" id="tcNam" title="Xem kết quả kinh doanh của một năm bất kỳ có dữ liệu">' +
                    '<option value="">— Chọn năm —</option>' +
                    ns.map(function (n) {
                        return '<option value="nam:' + n + '"' +
                            (kyHienTai === 'nam:' + n ? ' selected' : '') + '>Năm ' + n + '</option>';
                    }).join('') + '</select>';
            })() +
            '<span class="tb-sep"></span>' +
            '<label class="small muted" style="align-self:center">Từ ngày</label>' +
            '<input type="date" class="sm" id="tcTu" value="' + T.esc(tuyChon.tuNgay || ky.tuNgay || '') + '">' +
            '<label class="small muted" style="align-self:center">đến</label>' +
            '<input type="date" class="sm" id="tcDen" value="' + T.esc(tuyChon.denNgay || ky.denNgay || T.today()) + '">' +
            '<button class="btn sm' + (kyHienTai === 'tuyChon' ? ' primary' : '') + '" id="tcAp">' +
            '<i class="bi bi-check2"></i> Áp dụng</button>' +
            '</div>' +
            '<div class="small muted" style="margin-top:8px">Đang xem: <b>' + T.esc(ky.nhan) + '</b>' +
            (ky.tuNgay ? ' — từ ' + T.date(ky.tuNgay) + ' đến ' + T.date(ky.denNgay)
                       : ' — tất cả dữ liệu từ trước tới nay') +
            '. Tồn kho và công nợ chốt tại ngày ' + T.date(th.ky.den) + '.</div>' +
            '</div></div>';

        /* ================= ĐỐI CHIẾU TỰ ĐỘNG ================= */
        if (dc.loi.length)
            h += '<div class="note r mb12" data-goto="doi-chieu" style="cursor:pointer">' +
                '<i class="bi bi-x-octagon-fill"></i><div><b>Số liệu đang có ' + dc.loi.length +
                ' điểm sai — cần xử lý ngay.</b><br>' +
                T.esc(dc.loi.map(function (x) { return x.ten; }).join(' · ')) +
                '<br><span class="small">Bấm để mở màn hình Đối chiếu số liệu.</span></div></div>';
        else if (dc.canhBao.length)
            h += '<div class="note y mb12" data-goto="doi-chieu" style="cursor:pointer">' +
                '<i class="bi bi-exclamation-triangle-fill"></i><div><b>Số liệu cân, còn ' +
                dc.canhBao.length + ' điểm cần rà lại.</b><br>' +
                T.esc(dc.canhBao.map(function (x) { return x.ten; }).join(' · ')) +
                '<br><span class="small">Bấm để mở màn hình Đối chiếu số liệu.</span></div></div>';
        else
            h += '<div class="note g mb12" data-goto="doi-chieu" style="cursor:pointer">' +
                '<i class="bi bi-shield-check"></i><div><b>Số liệu cân.</b> ' +
                'Tổng nhập − Tổng xuất = Tồn kho. Doanh thu − Giá vốn − Chi phí = Lợi nhuận. ' +
                '<span class="small">Bấm để xem chi tiết đối chiếu.</span></div></div>';

        /* ================= BỐN CON SỐ ĐIỀU HÀNH ================= */
        h += '<div class="kpis">' +
            kpi('bao-cao', 'bi-graph-up-arrow', 'Tổng doanh thu', T.money(kq.doanhThu) + ' đ',
                kq.soChungTu + ' chứng từ ghi nhận · trước thuế GTGT', '') +
            kpi('gia-von', 'bi-box-seam', 'Tổng giá vốn', T.money(kq.giaVon) + ' đ',
                nhanGiaVon(cid), 'c') +
            kpi('phieu-chi', 'bi-cash-stack', 'Tổng chi phí', T.money(kq.chiPhi) + ' đ',
                kq.chiPhiChiTiet.soPhieu + ' phiếu chi tính vào chi phí', 'y') +
            kpi('bao-cao', 'bi-cash-coin', 'Tổng lợi nhuận', T.money(kq.loiNhuan) + ' đ',
                'Biên lợi nhuận ' + T.num(kq.bienLoiNhuan, 1) + '%',
                kq.loiNhuan >= 0 ? 'g' : 'r') +
            '</div>';

        h += '<div class="kpis">' +
            kpi('bao-cao', 'bi-percent', 'Biên lợi nhuận', T.num(kq.bienLoiNhuan, 1) + '%',
                'Lãi gộp ' + T.num(kq.bienLoiNhuanGop, 1) + '% trước chi phí',
                kq.bienLoiNhuan >= 0 ? 'g' : 'r') +
            kpi('gia-von', 'bi-boxes', 'Giá trị tồn kho', T.money(giaTriTon) + ' đ',
                soMaConHang + '/' + hh.length + ' mã còn hàng — chốt ' + T.date(th.ky.den), '') +
            kpi('cong-no', 'bi-journal-bookmark', 'Công nợ phải thu', T.money(phaiThu) + ' đ',
                th.phaiThu.soDoiTuong + ' khách còn nợ' +
                (th.phaiThu.quaHan ? ' · quá hạn ' + T.money(th.phaiThu.quaHan) + ' đ' : ''),
                th.phaiThu.quaHan > 0 ? 'r' : (phaiThu > 0 ? 'y' : 'g')) +
            kpi('cong-no', 'bi-journal-arrow-up', 'Công nợ phải trả', T.money(phaiTra) + ' đ',
                th.phaiTra.soDoiTuong + ' nhà cung cấp còn nợ' +
                (th.phaiTra.ungTruoc ? ' · đã ứng trước ' + T.money(th.phaiTra.ungTruoc) + ' đ' : ''),
                th.phaiTra.quaHan > 0 ? 'r' : (phaiTra > 0 ? 'y' : 'g')) +
            '</div>';

        /* ================= DÒNG TIỀN THỰC TẾ CỦA KỲ ================= */
        h += '<div class="kpis">' +
            kpi('phieu-thu', 'bi-wallet2', 'Tiền thực tế đầu kỳ', T.money(dtien.dauKy) + ' đ',
                th.ky.coDauKy ? 'Chốt ngày ' + T.date(th.ky.truoc) : 'Quỹ ban đầu bằng 0', '') +
            kpi('phieu-thu', 'bi-arrow-down-circle', 'Tiền vào trong kỳ', T.money(dtien.thu) + ' đ',
                dtien.soPhieuThu + ' phiếu thu' +
                (dtien.gopVon ? ' · cổ đông góp ' + T.money(dtien.gopVon) + ' đ' : ''), 'g') +
            kpi('phieu-chi', 'bi-arrow-up-circle', 'Tiền ra trong kỳ', T.money(dtien.chi) + ' đ',
                dtien.soPhieuChi + ' phiếu chi' +
                (dtien.chiaLoiNhuan ? ' · chia lợi nhuận ' + T.money(dtien.chiaLoiNhuan) + ' đ' : ''), 'c') +
            kpi('gop-von', 'bi-piggy-bank', 'Tiền thực tế cuối kỳ', T.money(dtien.cuoiKy) + ' đ',
                'Đầu kỳ ' + (dtien.thuan >= 0 ? '+' : '−') + T.money(Math.abs(dtien.thuan)) + ' đ trong kỳ',
                dtien.cuoiKy >= 0 ? 'b' : 'r') +
            '</div>';
        if (dtien.cuoiKy < 0)
            h += '<div class="note y mb12"><i class="bi bi-exclamation-triangle"></i><div>' +
                '<b>Tiền thực tế của ' + T.esc(cty.tat) + ' đang âm ' +
                T.money(Math.abs(dtien.cuoiKy)) + ' đ tại ngày ' + T.date(th.ky.den) + '.</b> ' +
                'Nghĩa là tiền đã chi ra nhiều hơn tiền đã thu về' +
                (dtien.coVon ? ' và chưa ghi nhận khoản góp vốn nào bù vào' : '') +
                '. Đây là số liệu thật, phần mềm KHÔNG tự tạo số dư ban đầu để che đi. ' +
                'Nếu thực tế đã có vốn góp hoặc tiền vay, hãy ghi nhận đúng chứng từ ' +
                'để dòng tiền phản ánh đủ.</div></div>';
        if (dtien.dauKy + dtien.thuan !== dtien.cuoiKy)
            h += '<div class="note r mb12"><i class="bi bi-x-octagon"></i><div>' +
                '<b>Dòng tiền không cân.</b> Đầu kỳ cộng phát sinh trong kỳ không bằng cuối kỳ. ' +
                'Mở Báo cáo → Đối chiếu số liệu để tìm nguyên nhân.</div></div>';

        /* Công ty nguồn có hai tầng lợi nhuận — nói rõ, không giấu trong một số. */
        if (kq.laCtyNguon && kq.doanhThuNoiBo)
            h += '<div class="note b mb12"><i class="bi bi-diagram-2-fill"></i><div>' +
                '<b>' + T.esc(cty.tat) + ' có hai tầng lợi nhuận.</b> ' +
                'Bán thẳng cho khách: doanh thu <b>' + T.money(kq.doanhThuKhach) + '</b> đ. ' +
                'Bán nội bộ cho các công ty trong nhóm: doanh thu <b>' + T.money(kq.doanhThuNoiBo) + '</b> đ, ' +
                'lợi nhuận <b>' + T.money(kq.loiNhuanNoiBo) + '</b> đ. ' +
                'Hai tầng cộng lại đúng bằng số hiển thị ở trên.</div></div>';

        /* ================= LỢI NHUẬN THEO CÔNG TY VÀ THEO DỰ ÁN ================= */
        var theoCty = T.ketQuaTungDonVi(locNhom);
        var theoDA = T.ketQuaTungDuAn(locNhom).slice(0, 10);
        h += '<div class="grid2 mb12">' +
            bangKQ('bi-buildings-fill', 'Doanh thu và lợi nhuận theo công ty',
                   'Toàn nhóm, không phụ thuộc đơn vị đang chọn', theoCty) +
            bangKQ('bi-building-fill-gear', 'Doanh thu và lợi nhuận theo dự án',
                   'Gộp chứng từ bán hàng và phiếu chi cùng gắn dự án', theoDA) +
            '</div>';

        /* ============ BẢNG VÀ BIỂU ĐỒ KẾT QUẢ KINH DOANH ============
           Dùng ĐÚNG bộ lọc thời gian của KPI phía trên và ĐÚNG một lần gọi
           Business Engine, nên tổng của bảng luôn bằng KPI. */
        var cd = { buoc: ky.buoc, tieu: ky.buoc === 'nam' ? 'theo từng năm' : ky.nhan };
        var kyBang = T.ketQuaTheoKy(loc, cd.buoc, T.khungKy(ky, { donViId: cid }));
        var mx = Math.max.apply(null, kyBang.ds.map(function (m) {
            return Math.max(m.doanhThu, 0); }).concat([1]));
        var lechKPI = kyBang.tong.doanhThu -
            T.sum(kyBang.ds, function (m) { return m.doanhThu; });

        h += '<div class="card mb12"><div class="card-h"><i class="bi bi-bar-chart-line"></i> ' +
            'Doanh thu · giá vốn · chi phí · lợi nhuận ' + T.esc(cd.tieu) +
            '<span class="spacer"></span><span class="small muted">' +
            (cd.buoc === 'nam' ? kyBang.ds.length + ' năm có dữ liệu'
                               : kyBang.ds.length + ' tháng') + '</span></div>' +
            '<div class="tablewrap" style="border:none">' +
            '<table class="grid" style="table-layout:fixed;width:100%"><thead><tr>' +
            '<th style="width:110px">' + (cd.buoc === 'nam' ? 'Năm' : 'Tháng') + '</th>' +
            '<th style="width:22%">Doanh thu</th>' +
            '<th class="num" style="width:136px">Doanh thu</th>' +
            '<th class="num" style="width:136px">Giá vốn</th>' +
            '<th class="num" style="width:124px">Chi phí</th>' +
            '<th class="num" style="width:136px">Lợi nhuận</th>' +
            '<th class="num" style="width:108px">Biên lợi nhuận</th></tr></thead><tbody>' +
            (kyBang.ds.length ? kyBang.ds.map(function (m) {
                return '<tr><td>' + T.esc(m.nhan) + '</td>' +
                    '<td><div class="bar-track"><div class="bar-fill' +
                    (m.loiNhuan < 0 ? '' : ' g') + '" style="width:' +
                    Math.max(m.doanhThu > 0 ? 1 : 0, m.doanhThu / mx * 100) + '%"></div></div></td>' +
                    '<td class="num b">' + T.money(m.doanhThu) + '</td>' +
                    '<td class="num">' + T.money(m.giaVon) + '</td>' +
                    '<td class="num">' + T.money(m.chiPhi) + '</td>' +
                    '<td class="num b ' + (m.loiNhuan >= 0 ? 'pos' : 'neg') + '">' +
                    T.money(m.loiNhuan) + '</td>' +
                    '<td class="num">' + (m.doanhThu ? T.num(m.bienLoiNhuan, 1) + '%'
                        : '<span class="muted">—</span>') + '</td></tr>';
            }).join('')
              : '<tr><td colspan="7"><div class="trong"><i class="bi bi-inbox"></i>' +
                '<b>Chưa có dữ liệu trong khoảng thời gian này</b>' +
                'Chọn khoảng thời gian khác trên thanh lọc.</div></td></tr>') +
            '</tbody><tfoot><tr>' +
            '<td><b>TỔNG CỘNG</b></td><td></td>' +
            '<td class="num b">' + T.money(kyBang.tong.doanhThu) + '</td>' +
            '<td class="num b">' + T.money(kyBang.tong.giaVon) + '</td>' +
            '<td class="num b">' + T.money(kyBang.tong.chiPhi) + '</td>' +
            '<td class="num b ' + (kyBang.tong.loiNhuan >= 0 ? 'pos' : 'neg') + '">' +
            T.money(kyBang.tong.loiNhuan) + '</td>' +
            '<td class="num b">' + (kyBang.tong.doanhThu
                ? T.num(kyBang.tong.bienLoiNhuan, 1) + '%' : '—') + '</td>' +
            '</tr></tfoot></table></div>' +
            (lechKPI ? '<div class="card-b"><div class="note r"><i class="bi bi-x-octagon"></i><div>' +
                '<b>Tổng của bảng lệch với chỉ tiêu phía trên ' + T.money(lechKPI) + ' đ.</b> ' +
                'Mở Báo cáo → Đối chiếu số liệu để tìm chứng từ gây lệch.</div></div></div>'
              : '<div class="card-b"><div class="small muted">' +
                'Tổng cộng của bảng bằng đúng các chỉ tiêu ở đầu màn hình — cùng một bộ lọc ' +
                'thời gian và cùng một lần gọi Business Engine.</div></div>') +
            '</div>';

        /* ================= TOP 10 ================= */
        var topHang = T.loiNhuanTheoMatHang(loc).slice(0, 10);
        var topKhach = T.loiNhuanTheoKhach(loc).slice(0, 10);
        h += '<div class="grid2 mb12">' +
            top10('bi-box-seam-fill', 'Top 10 mặt hàng lợi nhuận cao nhất', topHang,
                  function (r) { return (r.model || r.ma || '') + ' — ' + (r.ten || ''); }) +
            top10('bi-people-fill', 'Top 10 khách hàng lợi nhuận cao nhất', topKhach,
                  function (r) { return r.ten; }) +
            '</div>';
        h += '<div class="grid2 mb12">' +
            top10('bi-building-fill-gear', 'Top 10 dự án lợi nhuận cao nhất', theoDA,
                  function (r) { return r.ten; }) +
            khoanMucChi(kq) +
            '</div>';

        /* ================= QUY TRÌNH NGHIỆP VỤ ================= */
        /* Đếm chứng từ PHÁT SINH TRONG KỲ đang xem — không phải toàn bộ lịch sử,
           để dải quy trình nói đúng về cùng một kỳ với các chỉ tiêu phía trên. */
        function dem(c) {
            return DB.all(c).filter(function (x) {
                return x.donVi === cid && trongKy(x.ngay); }).length;
        }
        h += '<div class="card mb12"><div class="card-h"><i class="bi bi-diagram-3"></i> ' +
            'Quy trình nghiệp vụ xuyên suốt<span class="spacer"></span>' +
            '<span class="small muted">Số chứng từ phát sinh trong ' + T.esc(ky.nhan) +
            ' — bấm vào từng bước để mở màn hình tương ứng</span></div>' +
            '<div class="card-b"><div class="flow">' +
            step('nhap-hang', 'Nhập hàng', dem('donMua')) +
            step('gia-von', 'Giá vốn', soMaConHang) +
            step('bao-gia', 'Báo giá', dem('baoGia')) +
            step('don-ban', 'Đơn bán hàng', dem('donBan')) +
            step('hop-dong', 'Hợp đồng', dem('hopDong')) +
            step('phieu-xuat', 'Xuất kho', dem('phieuXuat')) +
            step('nghiem-thu', 'Nghiệm thu', dem('bienBanNghiemThu')) +
            step('de-nghi-tt', 'Đề nghị TT', dem('deNghiTT')) +
            step('phieu-thu', 'Thu tiền', dem('phieuThu')) +
            step('phieu-chi', 'Chi tiền', dem('phieuChi')) +
            '</div></div></div>';

        /* ================= VIỆC CẦN LƯU Ý ================= */
        /* Tồn kho lấy tại NGÀY CHỐT KỲ, không lấy số hiện hành — xem kỳ cũ thì
           cảnh báo cũng phải là cảnh báo của kỳ đó. */
        var tonChot = th.tonKho.ton || {};
        var het = hh.filter(function (x) { return (Number(tonChot[x.id]) || 0) <= 0; });
        var bgCho = DB.all('baoGia').filter(function (b) {
            return b.donVi === cid && trongKy(b.ngay) &&
                   (b.trangThai === 'Đã gửi KH' || b.trangThai === 'Nháp'); });
        /* Dùng đúng hàm của Engine, không tự quét lại phiếu chi ở màn hình. */
        var chuaPL = T.chiChuaPhanLoai(loc).length;
        h += '<div class="card"><div class="card-h"><i class="bi bi-bell"></i> Việc cần lưu ý</div>' +
            '<div class="card-b"><div class="grid2">' +
            canhBao('bi-hourglass-split', bgCho.length ? 'y' : 'g', bgCho.length + ' báo giá chờ phản hồi',
                'Báo giá đang ở trạng thái Nháp / Đã gửi khách hàng — cần theo dõi để chốt.', 'bao-gia') +
            canhBao('bi-cash-stack', th.phaiThu.quaHan > 0 ? 'r' : (phaiThu > 0 ? 'y' : 'g'),
                'Còn phải thu ' + T.money(phaiThu) + ' đ',
                (th.phaiThu.quaHan
                    ? 'Trong đó QUÁ HẠN ' + T.money(th.phaiThu.quaHan) + ' đ của ' +
                      th.phaiThu.soQuaHan + ' khách hàng.'
                    : (th.phaiThu.chuaKhaiHan
                        ? T.money(th.phaiThu.chuaKhaiHan) + ' đ chưa khai Điều khoản thanh toán nên chưa xác định được hạn.'
                        : 'Toàn bộ còn trong hạn thanh toán.')) +
                ' Chốt tại ngày ' + T.date(th.ky.den) + '.', 'cong-no') +
            canhBao('bi-box-seam', het.length ? 'y' : 'g', het.length + ' mã hàng hết / âm kho',
                het.length ? 'Ví dụ: ' + T.esc(het.slice(0, 3).map(function (x) { return x.ma; }).join(', '))
                           : 'Tồn kho các mã đều dương.', 'gia-von') +
            canhBao('bi-list-columns-reverse', chuaPL ? 'y' : 'g', 'Phân loại chi phí trong kỳ',
                chuaPL ? chuaPL + ' phiếu chi chưa khai khoản mục — khai đủ thì chi phí mới chính xác.'
                       : 'Mọi phiếu chi đã ghi sổ đều có khoản mục.', 'phieu-chi') +
            '</div></div></div>';

        document.getElementById('tcPage').innerHTML = h;

        /* ---------- SỰ KIỆN ---------- */
        host.querySelectorAll('[data-cty]').forEach(function (c) {
            c.onclick = function () {
                var id = c.getAttribute('data-cty');
                if (id === DB.data._meta.ctyId) { UI.toast('info', 'Đang làm việc trên đơn vị này rồi'); return; }
                DB.setCty(id);
                W.veBadge();
                ve();
                var d = DB.get('donVi', id);
                UI.toast('ok', 'Đã chuyển sang ' + d.tat,
                    d.ten + ' — bảng điều hành, chứng từ mới và biểu mẫu in đã đổi theo đơn vị này.');
            };
        });
        var oNam = host.querySelector('#tcNam');
        if (oNam) oNam.onchange = function () {
            if (oNam.value) { kyHienTai = oNam.value; ve(); }
        };
        host.querySelectorAll('[data-ky]').forEach(function (b) {
            b.onclick = function () { kyHienTai = b.getAttribute('data-ky'); ve(); };
        });
        var bAp = host.querySelector('#tcAp');
        if (bAp) bAp.onclick = function () {
            var a = host.querySelector('#tcTu'), b = host.querySelector('#tcDen');
            var tu = a ? a.value : '', den = b ? b.value : '';
            if (!tu || !den) { UI.toast('canh', 'Chưa đủ khoảng thời gian', 'Khai cả Từ ngày và Đến ngày rồi bấm Áp dụng.'); return; }
            if (tu > den) { UI.toast('canh', 'Khoảng thời gian không hợp lệ', 'Từ ngày phải trước Đến ngày.'); return; }
            tuyChon = { tuNgay: tu, denNgay: den };
            kyHienTai = 'tuyChon';
            ve();
        };
        host.querySelectorAll('[data-nhanh]').forEach(function (b) {
            b.onclick = function () {
                W.go(b.getAttribute('data-nhanh'));
                setTimeout(function () {
                    var t = document.querySelector('[data-them]');
                    if (t) t.click();
                }, 220);
            };
        });
        host.querySelectorAll('[data-goto]').forEach(function (b) {
            b.onclick = function () { W.go(b.getAttribute('data-goto')); };
        });
        var bh = host.querySelector('#btnHd'); if (bh) bh.onclick = function () { W.huongDan(); };
    }

    /* ------------------------------------------------------------ TIỆN ÍCH */
    function moTaGiaVon(cid) {
        return T.laCtyNguon(cid)
            ? 'Đơn vị nguồn — giá vốn là giá vốn thật của kho; có thêm tầng lợi nhuận bán nội bộ cho các công ty trong nhóm'
            : 'Đơn vị phát hành — giá vốn là giá nội bộ đã đóng băng trên từng chứng từ, không đổi khi bảng giá thay đổi';
    }
    function nhanGiaVon(cid) {
        return T.laCtyNguon(cid) ? 'Giá vốn thật của kho' : 'Giá vốn nội bộ đã đóng băng';
    }
    function kpi(route, ico, lb, vl, ft, cls) {
        return '<div class="kpi ' + cls + '" data-goto="' + route + '" title="Bấm để mở màn hình">' +
            '<div class="lb"><i class="bi ' + ico + '"></i> ' + T.esc(lb) + '</div>' +
            '<div class="vl">' + vl + '</div><div class="ft">' + T.esc(ft) + '</div></div>';
    }
    function step(route, ten, n) {
        return '<div class="flow-step" data-goto="' + route + '">' +
            '<div class="fs-l">' + T.esc(ten) + '</div>' +
            '<div class="fs-v">' + T.num(n, 0) + '</div>' +
            '<div class="fs-m">chứng từ</div></div>';
    }
    function canhBao(ico, mau, tieu, mo, route) {
        return '<div class="note ' + mau + ' mb8" style="cursor:pointer" data-goto="' + route + '">' +
            '<i class="bi ' + ico + '"></i><div><b>' + tieu + '</b><br><span class="small">' + mo + '</span></div></div>';
    }
    function emptyMini(t) {
        return '<div class="empty" style="padding:32px"><i class="bi bi-inbox"></i><b>' + T.esc(t) + '</b>' +
            'Số liệu sẽ hiện ngay khi có chứng từ trong kỳ đang xem.</div>';
    }

    /** Bảng doanh thu · giá vốn · chi phí · lợi nhuận của một chiều phân tích. */
    function bangKQ(ico, tieu, phu, ds) {
        return '<div class="card"><div class="card-h"><i class="bi ' + ico + '"></i> ' + T.esc(tieu) +
            '<span class="spacer"></span><span class="small muted">' + T.esc(phu) + '</span></div>' +
            '<div class="tablewrap" style="max-height:320px;border:none">' +
            (ds.length ? '<table class="grid" style="table-layout:fixed;width:100%"><thead><tr>' +
                '<th>Tên</th><th class="num" style="width:120px">Doanh thu</th>' +
                '<th class="num" style="width:112px">Giá vốn</th>' +
                '<th class="num" style="width:100px">Chi phí</th>' +
                '<th class="num" style="width:122px">Lợi nhuận</th>' +
                '<th class="num" style="width:74px">Biên</th></tr></thead><tbody>' +
                ds.map(function (r) {
                    return '<tr><td><span class="ellip" title="' + T.esc(r.ten) + '">' + T.esc(r.ten) + '</span></td>' +
                        '<td class="num b">' + T.money(r.doanhThu) + '</td>' +
                        '<td class="num">' + T.money(r.giaVon) + '</td>' +
                        '<td class="num">' + T.money(r.chiPhi) + '</td>' +
                        '<td class="num b ' + (r.loiNhuan >= 0 ? 'pos' : 'neg') + '">' + T.money(r.loiNhuan) + '</td>' +
                        '<td class="num">' + T.num(r.bienLoiNhuan, 1) + '%</td></tr>';
                }).join('') + '</tbody></table>'
              : emptyMini('Chưa có số liệu trong kỳ đang xem')) +
            '</div></div>';
    }

    /** Bảng xếp hạng lợi nhuận — dùng chung cho mặt hàng · khách hàng · dự án. */
    function top10(ico, tieu, ds, nhan) {
        var mx = ds.length ? Math.max.apply(null, ds.map(function (r) {
            return Math.abs(r.loiNhuan); }).concat([1])) : 1;
        return '<div class="card"><div class="card-h"><i class="bi ' + ico + '"></i> ' + T.esc(tieu) +
            '<span class="spacer"></span><span class="small muted">theo lợi nhuận</span></div>' +
            '<div class="tablewrap" style="max-height:340px;border:none">' +
            (ds.length ? '<table class="grid" style="table-layout:fixed;width:100%"><thead><tr>' +
                '<th style="width:34px">#</th><th>Tên</th><th style="width:24%"></th>' +
                '<th class="num" style="width:126px">Doanh thu</th>' +
                '<th class="num" style="width:126px">Lợi nhuận</th></tr></thead><tbody>' +
                ds.map(function (r, i) {
                    var t = String(nhan(r) || '');
                    return '<tr><td class="muted">' + (i + 1) + '</td>' +
                        '<td><span class="ellip" title="' + T.esc(t) + '">' + T.esc(t) + '</span></td>' +
                        '<td><div class="bar-track"><div class="bar-fill' +
                        (r.loiNhuan >= 0 ? ' g' : '') + '" style="width:' +
                        Math.max(1, Math.abs(r.loiNhuan) / mx * 100) + '%"></div></div></td>' +
                        '<td class="num">' + T.money(r.doanhThu) + '</td>' +
                        '<td class="num b ' + (r.loiNhuan >= 0 ? 'pos' : 'neg') + '">' +
                        T.money(r.loiNhuan) + '</td></tr>';
                }).join('') + '</tbody></table>'
              : emptyMini('Chưa có số liệu trong kỳ đang xem')) +
            '</div></div>';
    }

    /** Cơ cấu chi phí theo khoản mục — trả lời câu "tiền đi đâu". */
    function khoanMucChi(kq) {
        var ds = kq.chiPhiChiTiet.theoKhoanMuc.slice(0, 10);
        var mx = ds.length ? ds[0].soTien : 1;
        return '<div class="card"><div class="card-h"><i class="bi bi-list-columns-reverse"></i> ' +
            'Chi phí theo khoản mục<span class="spacer"></span>' +
            '<span class="small muted">Tổng ' + T.money(kq.chiPhi) + ' đ</span></div>' +
            '<div class="tablewrap" style="max-height:340px;border:none">' +
            (ds.length ? '<table class="grid" style="table-layout:fixed;width:100%"><thead><tr>' +
                '<th>Khoản mục chi</th><th style="width:28%"></th>' +
                '<th class="num" style="width:80px">Số phiếu</th>' +
                '<th class="num" style="width:136px">Số tiền</th></tr></thead><tbody>' +
                ds.map(function (r) {
                    return '<tr><td><span class="ellip" title="' + T.esc(r.ten) + '">' + T.esc(r.ten) + '</span></td>' +
                        '<td><div class="bar-track"><div class="bar-fill y" style="width:' +
                        Math.max(1, r.soTien / mx * 100) + '%"></div></div></td>' +
                        '<td class="num">' + T.num(r.soPhieu, 0) + '</td>' +
                        '<td class="num b">' + T.money(r.soTien) + '</td></tr>';
                }).join('') + '</tbody></table>'
              : emptyMini('Chưa có phiếu chi nào tính vào chi phí trong kỳ')) +
            '</div></div>';
    }
};

})(window);

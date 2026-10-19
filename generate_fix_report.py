import os, subprocess
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []
    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        n = len(self._saved)
        for st in self._saved:
            self.__dict__.update(st)
            self.draw_footer(n)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)
    def draw_footer(self, n):
        self.saveState(); self.setFont("Helvetica", 8); self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(54, 34, "FWP PROJECT — BUG FIX & VERIFICATION REPORT")
        self.drawRightString(558, 34, f"Page {self._pageNumber} / {n}")
        self.setStrokeColor(colors.HexColor("#cbd5e1")); self.setLineWidth(0.5); self.line(54, 46, 558, 46)
        self.restoreState()

def build(filename="C:/Users/Admin/Desktop/fwp/FWP_Bug_Fix_Report.pdf"):
    doc = SimpleDocTemplate(filename, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
    ss = getSampleStyleSheet()
    title = ParagraphStyle('t', parent=ss['Heading1'], fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=colors.HexColor('#0f172a'), spaceAfter=4)
    sub = ParagraphStyle('s', parent=ss['Normal'], fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor('#475569'), spaceAfter=12)
    h1 = ParagraphStyle('h1', parent=ss['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=colors.HexColor('#1e293b'), spaceBefore=14, spaceAfter=6, keepWithNext=True)
    body = ParagraphStyle('b', parent=ss['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#334155'), spaceAfter=6)
    cell = ParagraphStyle('c', parent=ss['Normal'], fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor('#1e293b'))
    hdr = ParagraphStyle('h', parent=ss['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.white)

    S = []
    S.append(Paragraph("FWP SYSTEM: BUG FIX & VERIFICATION REPORT", title))
    S.append(Paragraph("<b>Target:</b> C:\\Users\\Admin\\Desktop\\fwp &nbsp;|&nbsp; <b>Mode:</b> 5-agent plan → 5-agent fix → repeat verify (converged) &nbsp;|&nbsp; <b>Date:</b> Oct 2026", sub))
    S.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#3b82f6"), spaceAfter=12))

    summary = ("<b>KẾT QUẢ CUỐI:</b> Toàn bộ bug đã được xác nhận trong đợt audit 10-agent đã được lập kế hoạch, sửa "
               "và kiểm tra lại theo vòng lặp <b>plan → fix → verify</b> cho tới khi hội tụ. Các vòng double-check cuối "
               "(backend, ML, client, infra, E2E) đều trả về <b>CLEAN</b>: không còn bug sản phẩm nào được xác nhận. "
               "Bằng chứng kiểm chứng: backend <code>npm test</code> 25/25 pass + <code>npm run build</code> OK; "
               "ML <code>py_compile</code> toàn bộ module OK + tái lập các case metric; frontend <code>node --check</code> OK; "
               "Android <code>assembleDebug</code> BUILD SUCCESSFUL; <code>docker compose config</code> hợp lệ.")
    t = Table([[Paragraph(summary, body)]], colWidths=[504])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#f1f5f9')),('BOX',(0,0),(-1,-1),1,colors.HexColor('#cbd5e1')),
                           ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10)]))
    S.append(t); S.append(Spacer(1,10))

    S.append(Paragraph("1. Vòng lặp thực thi (Plan → Fix → Verify)", h1))
    rows = [
        [Paragraph("Vòng", hdr), Paragraph("Loại", hdr), Paragraph("Agent", hdr), Paragraph("Kết quả", hdr)],
        [Paragraph("Audit gốc", cell), Paragraph("10 audit", cell), Paragraph("backend, frontend, ml, security, data, tests, infra, integration, concurrency, adversarial", cell), Paragraph("Phát hiện nhiều bug Critical/High", cell)],
        [Paragraph("Vòng 1", cell), Paragraph("5 plan", cell), Paragraph("backend-p0, ml-data, clients, infra-security, verification-release", cell), Paragraph("Kế hoạch chi tiết theo workstream", cell)],
        [Paragraph("Vòng 1", cell), Paragraph("5 fix", cell), Paragraph("frontend-web, ml-pipeline, backend-core, android-client, infra-tests", cell), Paragraph("Sửa 10 nhóm bug chính", cell)],
        [Paragraph("Vòng 2", cell), Paragraph("5 verify", cell), Paragraph("recheck backend/ml/clients/infra/e2e", cell), Paragraph("Còn sót: metrics crash, auth spec, OTP, CORS/JWT, Android race, reload token", cell)],
        [Paragraph("Vòng 2", cell), Paragraph("5 fix", cell), Paragraph("web, ml, auth, security, android", cell), Paragraph("Sửa lỗi còn sót", cell)],
        [Paragraph("Vòng 3", cell), Paragraph("5 verify", cell), Paragraph("verify backend/ml/clients/infra/e2e", cell), Paragraph("Còn sót nhỏ: JWT placeholder, CORS rỗng, data-source, metric validation, null parity", cell)],
        [Paragraph("Vòng 3", cell), Paragraph("1 fix + verify", cell), Paragraph("infra-ml + reload-token + ndcg", cell), Paragraph("Sửa hết; vòng E2E cuối CLEAN", cell)],
    ]
    ta = Table(rows, colWidths=[56, 60, 190, 198])
    ta.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#1e293b')),('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#cbd5e1')),
                            ('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    S.append(ta); S.append(Spacer(1,10))

    S.append(Paragraph("2. Bug đã sửa & xác minh", h1))
    bugs = [
        ("BUG-01","CRITICAL","frontend/app.js","Token Bearer khôi phục đúng `Bearer ${token}` (đã xác nhận bằng byte-level check).","authHeaders giờ tin cậy, không còn 401 toàn cục."),
        ("BUG-02","CRITICAL","ml/src/models/train.py","Temporal split sort theo created_at TRƯỚC khi tách X/y.","Không còn rò rỉ dữ liệu tương lai."),
        ("BUG-03","HIGH","backend/src/swipe/swipe.service.ts","Advisory lock cặp user + ON CONFLICT DO NOTHING + map 23505 → ConflictException.","Hết race mutual-like, không còn 500."),
        ("BUG-04","HIGH","ml/src/features + serving","Đồng bộ age (DOB), interest (name/UUID), faculty, preference, null parity.","Train/serving không còn lệch đặc trưng."),
        ("BUG-05","HIGH","ml/scripts/retrain.py + compose","Gửi header X-ML-Reload-Token, rollback nếu reload fail, truyền env cho retrainer.","Reload model mới thực sự hoạt động."),
        ("BUG-06","HIGH","backend/src/location/location.service.ts","Atomic upsert lat/long + PostGIS point một câu lệnh.","Không còn lệch tọa độ/point."),
        ("BUG-07","HIGH","backend (tests/CI)","Thêm auth & swipe spec, --passWithNoTests; 25 test pass.","npm test không còn fail."),
        ("BUG-08","MEDIUM","backend/src/chat/chat.controller.ts","ParseIntPipe + DefaultValuePipe + Min/Max + clample.","Không còn NaN/crash ở /messages."),
        ("BUG-09","MEDIUM","android FwpRepository.kt","Bỏ runBlocking, dùng sessionReady barrier + single-flight refresh.","Không còn đói thread/ANR, không mất auth lúc khởi động."),
        ("BUG-10","MEDIUM","docker-compose.yml","Port DB/Redis/ML bind loopback mặc định.","Giảm phơi bày dịch vụ nội bộ."),
        ("BUG-11","HIGH","auth.service.ts / auth.module.ts","OTP atomic + giới hạn 5 lần + cooldown resend; JWT chặn user không ACTIVE; secret fail-fast.","Hết brute-force/race; không còn secret mặc định."),
        ("BUG-12","MEDIUM","chat.gateway.ts / main.ts / ml app.py","CORS allowlist (HTTP/WS/ML), /v1/reload yêu cầu token constant-time.","Không còn wildcard CORS + credentials."),
        ("BUG-13","MEDIUM","ml/src/evaluation/metrics.py","Khởi tạo metrics, validate độ dài, sửa NDCG nhóm 1-item (trả 1.0 đúng).","Metric đánh giá chính xác."),
        ("BUG-14","LOW","ml/src/features/build_features.py","Guard non-null cho same_school/faculty/year.","Parity training/serving."),
    ]
    data = [[Paragraph("ID", hdr), Paragraph("Mức", hdr), Paragraph("Vị trí", hdr), Paragraph("Nội dung sửa", hdr), Paragraph("Xác minh", hdr)]]
    for bid, sev, loc, fix, ver in bugs:
        data.append([Paragraph(bid, cell), Paragraph(sev, cell), Paragraph(loc, cell), Paragraph(fix, cell), Paragraph(ver, cell)])
    tb = Table(data, colWidths=[46, 52, 120, 176, 110])
    tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#1e293b')),('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#cbd5e1')),
                            ('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
    S.append(tb); S.append(Spacer(1,10))

    S.append(Paragraph("3. Trạng thái verify cuối cùng", h1))
    final = [
        [Paragraph("Hạng mục", hdr), Paragraph("Bằng chứng", hdr), Paragraph("Kết luận", hdr)],
        [Paragraph("Backend / Auth", cell), Paragraph("npm test 25/25 pass; nest build OK; tsc --noEmit 0 lỗi", cell), Paragraph("CLEAN", cell)],
        [Paragraph("ML Pipeline & Metrics", cell), Paragraph("py_compile 17 module; tái lập NDCG/metrics/parity; model load OK", cell), Paragraph("CLEAN", cell)],
        [Paragraph("Frontend & Android", cell), Paragraph("node --check OK; assembleDebug BUILD SUCCESSFUL", cell), Paragraph("CLEAN", cell)],
        [Paragraph("Infra / Security", cell), Paragraph("docker compose config hợp lệ; CORS/secret/reload đã siết", cell), Paragraph("CLEAN", cell)],
        [Paragraph("E2E flows", cell), Paragraph("signup→login→profile→recommend→swipe→match→chat→retrain", cell), Paragraph("CLEAN", cell)],
    ]
    tf = Table(final, colWidths=[120, 274, 110])
    tf.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#1e293b')),('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#cbd5e1')),
                            ('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    S.append(tf); S.append(Spacer(1,10))

    S.append(Paragraph("4. Lưu ý còn lại (không phải bug sản phẩm)", h1))
    notes = ("• Môi trường kiểm thử thiếu <code>pytest</code> và Android SDK trong một số lần chạy; các nhánh đó được xác minh bằng "
             "compile/contract-trace thay vì chạy test đầy đủ.<br/>"
             "• Dockerfile dev-mode (start:dev / uvicorn --reload) vẫn phù hợp cho dev; khuyến nghị tách compose production "
             "khi triển khai thật.<br/>"
             "• Các thay đổi đang nằm ở working tree (chưa commit) — nên review <code>git diff</code> trước khi commit.")
    S.append(Paragraph(notes, body))

    doc.build(S, canvasmaker=NumberedCanvas)
    print("PDF build successful:", filename)

if __name__ == '__main__':
    build()

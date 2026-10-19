import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(54, 36, "FWP PROJECT - MULTI-AGENT DOUBLE CHECK BUG AUDIT REPORT")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 54, 36, page_text)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 48, 612 - 54, 48)
        self.restoreState()

def build_pdf(filename="C:/Users/Admin/Desktop/fwp/FWP_Bug_Audit_Report.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        spaceAfter=12
    )
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )
    bold_label = ParagraphStyle(
        'BoldLabel',
        parent=body_style,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0f172a')
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1e293b')
    )
    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    story = []

    # Title & Metadata
    story.append(Paragraph("FWP SYSTEM: MULTI-AGENT DOUBLE CHECK BUG REPORT", title_style))
    story.append(Paragraph("<b>Target:</b> C:\\Users\\Admin\\Desktop\\fwp &nbsp;|&nbsp; <b>Date:</b> October 2026 &nbsp;|&nbsp; <b>Execution:</b> 10-Agent Parallel Swarm", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#3b82f6"), spaceAfter=12))

    # Executive Summary Box
    summary_html = (
        "<b>EXECUTIVE SUMMARY:</b> Ten specialized autonomous subagents were spun up to perform an adversarial, "
        "double-checking audit across Frontend, Backend (NestJS), ML Pipeline, Database, Concurrency, and Infrastructure. "
        "The audit corroborated multiple <b>High &amp; Critical severity runtime bugs</b> that break core functionality in production: "
        "<br/>• <b>Frontend:</b> Hardcoded corrupted Authorization header (<code>Bearer ***}</code>) completely breaking API communications. "
        "<br/>• <b>ML Pipeline:</b> Data leakage and broken temporal validation split (slicing unsorted data), plus severe train/serving skew on Age and Interests. "
        "<br/>• <b>Backend &amp; Concurrency:</b> Race conditions on mutual swiping leading to HTTP 500 errors or duplicate/lost matches; non-atomic PostGIS updates and OTP verification. "
        "<br/>• <b>Infra &amp; Testing:</b> Zero backend test specs causing <code>npm test</code> to fail with exit code 1; unauthenticated Redis/DB exposures in default compose."
    )
    summary_table = Table([[Paragraph(summary_html, body_style)]], colWidths=[504])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 10))

    # Multi-Agent Consensus Summary Table
    story.append(Paragraph("1. Audit Agent Coverage & Consensus Summary", h1_style))
    agent_data = [
        [Paragraph("Agent / Specialization", table_header), Paragraph("Key Focus", table_header), Paragraph("Status", table_header), Paragraph("Top Corroborated Findings", table_header)],
        [Paragraph("1. Frontend Audit", table_cell), Paragraph("Web UI & WS", table_cell), Paragraph("CONFIRMED", table_cell), Paragraph("Corrupted Auth Bearer token, missing userId on login, form omissions", table_cell)],
        [Paragraph("2. Backend Audit", table_cell), Paragraph("NestJS APIs", table_cell), Paragraph("CONFIRMED", table_cell), Paragraph("Inactive JWTs bypass, OTP concurrency race, QueryBuilder column mixup", table_cell)],
        [Paragraph("3. ML Pipeline Audit", table_cell), Paragraph("Models & Skew", table_cell), Paragraph("CONFIRMED", table_cell), Paragraph("Temporal split sliced pre-sorted array; Age/Interest training-serving skew", table_cell)],
        [Paragraph("4. Data & DB Audit", table_cell), Paragraph("TypeORM & SQL", table_cell), Paragraph("CONFIRMED", table_cell), Paragraph("Missing initial migration, racy mutual likes, split location transactions", table_cell)],
        [Paragraph("5. Concurrency Audit", table_cell), Paragraph("Races & Locks", table_cell), Paragraph("CONFIRMED", table_cell), Paragraph("Check-then-insert match duplication; Android runBlocking thread stall", table_cell)],
        [Paragraph("6. Tests & CI Audit", table_cell), Paragraph("Coverage & Build", table_cell), Paragraph("CONFIRMED", table_cell), Paragraph("0 unit tests causing npm test failure; missing CI workflow pipeline", table_cell)],
        [Paragraph("7. Infra & Docker", table_cell), Paragraph("Deployment/Env", table_cell), Paragraph("CONFIRMED", table_cell), Paragraph("Exposed DB/Redis ports, static default secrets, un-reloaded ML container", table_cell)],
        [Paragraph("8. Integration Audit", table_cell), Paragraph("E2E Contracts", table_cell), Paragraph("CONFIRMED", table_cell), Paragraph("Faculty UUID vs code mismatch, hot-reload absent in retrain loop", table_cell)],
        [Paragraph("9. Adversarial Audit", table_cell), Paragraph("Edge Cases/Fuzz", table_cell), Paragraph("CONFIRMED", table_cell), Paragraph("Chat limit=NaN 500 error, wildcard CORS + credentials rejection", table_cell)],
        [Paragraph("10. Security Audit", table_cell), Paragraph("Auth & Policies", table_cell), Paragraph("FILTERED", table_cell), Paragraph("Triggered safety provider filter (covered by Adversarial & Backend agents)", table_cell)],
    ]
    t_agents = Table(agent_data, colWidths=[110, 80, 75, 239])
    t_agents.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_agents)
    story.append(Spacer(1, 12))

    # Detailed Verified Bugs Section
    story.append(Paragraph("2. Deep Dive: High & Critical Verified Bugs", h1_style))

    bugs = [
        {
            "id": "BUG-01",
            "sev": "CRITICAL",
            "title": "Frontend Corrupted Bearer Token Breaks All Authenticated Calls",
            "file": "frontend/app.js (Line 2)",
            "evidence": "Code defines: <code>const authHeaders=()=>({Authorization:`Bearer ***}`});</code>. The template string hardcodes <code>***</code> instead of <code>${token}</code> (likely from accidental regex/scrubbing). Every authenticated HTTP request (profile, chat rooms, photos) immediately returns 401 Unauthorized.",
            "impact": "Web frontend is completely non-functional for logged-in users.",
            "fix": "Restore variable interpolation: <code>const authHeaders=()=>({Authorization:`Bearer ${token}`});</code> and ensure tokens remain isolated."
        },
        {
            "id": "BUG-02",
            "sev": "CRITICAL",
            "title": "ML Temporal Validation Split Slices Unsorted Arrays (Future Data Leakage)",
            "file": "ml/src/models/train.py (Lines 69-83)",
            "evidence": "Arrays are initialized before sorting: <code>X = df[FEATURE_COLUMNS].values</code>, <code>y = df[label_col].values</code>. Then <code>df = df.sort_values('created_at')</code> sorts the DataFrame, but slicing uses the original pre-sort arrays: <code>X[:train_end]</code>. Temporal order is violated; future events contaminate the training partition.",
            "impact": "Reported offline metrics (NDCG, AUC, MAP) are completely invalid and unrepresentative of production performance.",
            "fix": "Sort the DataFrame by parsed <code>created_at</code> and reset indices BEFORE extracting <code>X</code> and <code>y</code>."
        },
        {
            "id": "BUG-03",
            "sev": "HIGH",
            "title": "Concurrent Mutual Likes Cause Race Condition and Duplicate/Lost Matches",
            "file": "backend/src/swipe/swipe.service.ts (Lines 72-125)",
            "evidence": "Swipe deduplication check <code>findOne</code> is outside the transaction. In addition, when two users like each other simultaneously under PostgreSQL READ COMMITTED, both transactions query for reciprocal likes before the other commits. Both may fail to see the reciprocal row, resulting in swiping recorded but match creation permanently bypassed.",
            "impact": "Users who mutually like each other never get matched, or concurrent retries trigger unhandled 500 UniqueConstraint errors.",
            "fix": "Catch PostgreSQL error code 23505 and map to <code>ConflictException</code>; insert matches using <code>ON CONFLICT DO NOTHING</code> with row locks."
        },
        {
            "id": "BUG-04",
            "sev": "HIGH",
            "title": "Severe Training vs. Serving Feature Skew (Age and Interest Matching)",
            "file": "ml/src/features/build_features.py vs ml/src/serving/features.py",
            "evidence": "1. <b>Age Skew:</b> Training approximates age as <code>academic_year + 17</code>, while serving computes exact age from <code>date_of_birth</code>.<br/>2. <b>Interest Skew:</b> Training uses string interest names (Jaccard), while serving compares UUID strings (<code>interest_id</code>), resulting in Jaccard similarity evaluating to 0.0 at inference.",
            "impact": "The trained model weights are applied to corrupted feature distributions in production, causing degraded or arbitrary recommendations.",
            "fix": "Unify feature extraction helpers into a shared contract; export date_of_birth for training and use matching UUID/name sets across both sides."
        },
        {
            "id": "BUG-05",
            "sev": "HIGH",
            "title": "Retrained ML Models are Never Hot-Reloaded into Serving Container",
            "file": "docker-compose.yml (Lines 91-128) & ml/scripts/retrain.py",
            "evidence": "<code>ml-retrainer</code> writes new model weights to shared volume <code>artifacts/active_model</code>, but never notifies <code>ml-service:8000/v1/reload</code>. The serving process loads <code>model.pkl</code> once during startup and continues serving stale models indefinitely.",
            "impact": "Automated retraining pipelines appear successful in DB logs, but users receive predictions from old in-memory models until container restart.",
            "fix": "In <code>retrain.py</code>, invoke an authenticated <code>POST /v1/reload</code> trigger upon registering a new model version."
        },
        {
            "id": "BUG-06",
            "sev": "HIGH",
            "title": "Location Coordinates and PostGIS Point Stored Non-Atomically",
            "file": "backend/src/location/location.service.ts (Lines 14-38)",
            "evidence": "<code>updateLocation</code> updates scalar lat/long via TypeORM <code>save()</code> and then executes a separate raw SQL update for <code>ST_SetSRID(ST_MakePoint(...))</code>. If the second query fails or concurrent updates interleave, coordinates and geography desynchronize.",
            "impact": "Spatial queries and nearby candidate discovery return erroneous distance calculations.",
            "fix": "Combine coordinate update and PostGIS point generation into a single atomic SQL upsert."
        },
        {
            "id": "BUG-07",
            "sev": "HIGH",
            "title": "Backend Has Zero Spec Files; 'npm test' Hard-Fails with Exit Code 1",
            "file": "backend/package.json (Line 13)",
            "evidence": "Jest is configured with <code>testRegex: \".*\\.spec\\.ts$\"</code>, but there are 0 <code>.spec.ts</code> files across 58 backend TypeScript files. Executing <code>npm test</code> immediately fails with 'No tests found, exiting with code 1'.",
            "impact": "Prevents standard CI pipelines from passing and leaves critical business flows (Auth, Swipe, Chat) without automated regression shields.",
            "fix": "Add unit/integration test suites for auth and swipe services; configure <code>--passWithNoTests</code> as a temporary bridge."
        },
        {
            "id": "BUG-08",
            "sev": "MEDIUM",
            "title": "Chat Message Query Accepts NaN Limit, Crashing TypeORM QueryBuilder",
            "file": "backend/src/chat/chat.controller.ts (Lines 57-59)",
            "evidence": "<code>@Query('limit') limit?: number</code> has no validation pipe. Passing non-integer query params (e.g. <code>?limit=abc</code>) coerces to <code>NaN</code>, passed directly to <code>.take(limit)</code>, which triggers an unhandled SQL syntax error (500).",
            "impact": "DoS vulnerability on chat history endpoints and unhandled server 500 errors.",
            "fix": "Enforce <code>ParseIntPipe</code>, <code>@IsInt()</code>, <code>@Min(1)</code>, and <code>@Max(100)</code> with safe server-side clamping."
        },
        {
            "id": "BUG-09",
            "sev": "MEDIUM",
            "title": "Android Repository Uses Synchronous runBlocking on DataStore",
            "file": "android/app/src/main/java/vn/edu/ptit/fwp/data/FwpRepository.kt (Lines 27-46)",
            "evidence": "OkHttp auth interceptor and Authenticator invoke <code>kotlinx.coroutines.runBlocking { session.accessToken() }</code> on OkHttp dispatcher threads, blocking connection pool workers during I/O.",
            "impact": "Risk of thread starvation, UI freezing, and Android ANR (Application Not Responding) under poor network conditions.",
            "fix": "Maintain an in-memory token cache updated via asynchronous Flows/Coroutines and serialize token refresh calls with a single Mutex."
        },
        {
            "id": "BUG-10",
            "sev": "MEDIUM",
            "title": "Default Docker Compose Exposes Database & Unauthenticated Redis",
            "file": "docker-compose.yml (Lines 11-30, 100-101)",
            "evidence": "Host ports 5432, 6379, and 8000 are directly published. Redis has no password requirement, and Postgres defaults to a hardcoded password (<code>fwp_password_change_me</code>).",
            "impact": "If deployed on a public host or open network without external firewalling, internal databases and caches are exposed to unauthorized access.",
            "fix": "Isolate databases within the internal Docker network; remove host port mapping from production compose."
        }
    ]

    for b in bugs:
        sev_color = colors.HexColor('#dc2626') if b['sev'] == 'CRITICAL' else (colors.HexColor('#ea580c') if b['sev'] == 'HIGH' else colors.HexColor('#ca8a04'))
        header_text = f"<b>[{b['id']}] [{b['sev']}] {b['title']}</b>"
        
        card_content = [
            Paragraph(f"<font color='{sev_color.hexval()}'>{header_text}</font>", bold_label),
            Spacer(1, 2),
            Paragraph(f"<b>Location:</b> <code>{b['file']}</code>", body_style),
            Paragraph(f"<b>Evidence & Root Cause:</b> {b['evidence']}", body_style),
            Paragraph(f"<b>Impact:</b> {b['impact']}", body_style),
            Paragraph(f"<b>Recommended Fix:</b> {b['fix']}", body_style),
        ]
        
        card_table = Table([[card_content]], colWidths=[504])
        card_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#ffffff')),
            ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#cbd5e1')),
            ('LINELEFT', (0,0), (-1,-1), 3.5, sev_color),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(KeepTogether([card_table, Spacer(1, 8)]))

    # Priority Action Roadmap
    story.append(Paragraph("3. Recommended Remediation Roadmap", h1_style))
    roadmap_data = [
        [Paragraph("Phase", table_header), Paragraph("Target Action Items", table_header), Paragraph("Estimated Effort", table_header)],
        [Paragraph("P0 (Immediate)", table_cell), Paragraph("• Fix frontend <code>authHeaders</code> token interpolation in <code>app.js</code>.<br/>• Fix <code>train.py</code> temporal split indexing before model re-training.<br/>• Add 23505 duplicate constraint mapping in <code>swipe.service.ts</code>.", table_cell), Paragraph("&lt; 2 Hours", table_cell)],
        [Paragraph("P1 (Short-term)", table_cell), Paragraph("• Synchronize ML training/serving features (age calculation & interest UUID resolution).<br/>• Implement <code>/v1/reload</code> hook in <code>retrain.py</code>.<br/>• Wrap <code>updateLocation</code> in atomic upsert.", table_cell), Paragraph("1 Day", table_cell)],
        [Paragraph("P2 (Hardening)", table_cell), Paragraph("• Add core unit/integration tests in backend (Swipe & Auth) and set up CI pipeline.<br/>• Refactor Android token refresh to use Mutex/cache instead of runBlocking.<br/>• Secure Docker compose network isolation and remove public DB ports.", table_cell), Paragraph("2-3 Days", table_cell)],
    ]
    t_roadmap = Table(roadmap_data, colWidths=[90, 324, 90])
    t_roadmap.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_roadmap)

    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF build successful:", filename)

if __name__ == '__main__':
    build_pdf()

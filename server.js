// ============================================================
// WB AI Bot - Server chính
// Web dashboard + Scheduler tự động chạy mỗi 2 tiếng
// ============================================================

const express = require("express");
const cron = require("node-cron");
const { runAllTasks } = require("./bot");

const app = express();
const PORT = process.env.PORT || 3000;

let lastRun = null;
let lastStatus = "Chưa chạy lần nào";
let isRunning = false;
let logs = [];

// Capture logs
const origConsole = console.log.bind(console);
console.log = (...args) => {
  const msg = args.join(" ");
  origConsole(msg);
  logs.unshift({ time: new Date().toLocaleString("vi-VN"), msg });
  if (logs.length > 100) logs.pop();
};

// ─── Dashboard HTML ────────────────────────────────────────
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WB AI Bot</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px}
h1{font-size:20px;font-weight:600;margin-bottom:4px}
.sub{color:#888;font-size:13px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px}
.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px}
.card-label{font-size:11px;color:#888;margin-bottom:6px}
.card-value{font-size:20px;font-weight:600}
.card-value.green{color:#4ade80}
.card-value.amber{color:#fbbf24}
.card-value.red{color:#f87171}
.btn{padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500}
.btn-primary{background:#534AB7;color:#fff}
.btn-primary:hover{background:#3C3489}
.btn-primary:disabled{background:#333;color:#666;cursor:not-allowed}
.log-box{background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;height:400px;overflow-y:auto;font-family:monospace;font-size:12px}
.log-line{padding:3px 0;border-bottom:1px solid #1a1a1a;color:#aaa}
.log-line.success{color:#4ade80}
.log-line.error{color:#f87171}
.log-line.info{color:#60a5fa}
.log-time{color:#555;font-size:10px;margin-right:8px}
.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
.dot-green{background:#4ade80;box-shadow:0 0 6px #4ade80}
.dot-amber{background:#fbbf24;animation:pulse 1s infinite}
.dot-red{background:#f87171}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
h2{font-size:14px;font-weight:500;margin-bottom:12px;color:#888}
</style>
</head>
<body>
<h1>🤖 WB AI Bot</h1>
<div class="sub">Tự động quản lý shop Wildberries · Cập nhật mỗi 2 tiếng</div>

<div class="grid">
  <div class="card">
    <div class="card-label">Trạng thái</div>
    <div class="card-value ${isRunning ? "amber" : "green"}">
      <span class="status-dot ${isRunning ? "dot-amber" : "dot-green"}"></span>
      ${isRunning ? "Đang chạy..." : "Sẵn sàng"}
    </div>
  </div>
  <div class="card">
    <div class="card-label">Lần chạy cuối</div>
    <div class="card-value" style="font-size:14px">${lastRun ? lastRun.toLocaleString("vi-VN") : "—"}</div>
  </div>
  <div class="card">
    <div class="card-label">Lần chạy tiếp theo</div>
    <div class="card-value amber" style="font-size:14px">Mỗi 2 tiếng</div>
  </div>
  <div class="card">
    <div class="card-label">Logs ghi nhận</div>
    <div class="card-value green">${logs.length}</div>
  </div>
</div>

<div style="margin-bottom:20px;display:flex;gap:10px">
  <button class="btn btn-primary" onclick="runNow()" ${isRunning ? "disabled" : ""} id="run-btn">
    ${isRunning ? "⟳ Đang chạy..." : "▶ Chạy ngay"}
  </button>
  <button class="btn" style="background:#1a1a1a;border:1px solid #2a2a2a" onclick="location.reload()">↻ Làm mới</button>
</div>

<h2>📋 Logs gần đây</h2>
<div class="log-box">
${
  logs.length === 0
    ? '<div class="log-line" style="color:#555">Chưa có log nào. Nhấn "Chạy ngay" để bắt đầu.</div>'
    : logs
        .map((l) => {
          const cls = l.msg.includes("✅") || l.msg.includes("✓")
            ? "success"
            : l.msg.includes("❌") || l.msg.includes("Lỗi")
            ? "error"
            : l.msg.includes("🚀") || l.msg.includes("📊") || l.msg.includes("💡")
            ? "info"
            : "";
          return `<div class="log-line ${cls}"><span class="log-time">${l.time}</span>${l.msg}</div>`;
        })
        .join("")
}
</div>

<script>
async function runNow(){
  document.getElementById('run-btn').disabled=true;
  document.getElementById('run-btn').textContent='⟳ Đang chạy...';
  await fetch('/run',{method:'POST'});
  setTimeout(()=>location.reload(),2000);
}
// Auto refresh mỗi 30 giây khi đang chạy
${isRunning ? "setTimeout(()=>location.reload(),30000);" : ""}
</script>
</body>
</html>`);
});

// ─── API: chạy thủ công ────────────────────────────────────
app.post("/run", async (req, res) => {
  if (isRunning) {
    return res.json({ ok: false, msg: "Đang chạy rồi" });
  }
  res.json({ ok: true, msg: "Đã bắt đầu" });
  runBot();
});

// ─── API: health check ────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ ok: true, lastRun, isRunning, logsCount: logs.length });
});

// ─── Chạy bot ──────────────────────────────────────────────
async function runBot() {
  if (isRunning) return;
  isRunning = true;
  lastRun = new Date();
  try {
    await runAllTasks();
    lastStatus = "Thành công";
  } catch (e) {
    lastStatus = `Lỗi: ${e.message}`;
    console.log(`❌ Bot gặp lỗi: ${e.message}`);
  } finally {
    isRunning = false;
  }
}

// ─── Scheduler: chạy mỗi 2 tiếng ─────────────────────────
cron.schedule("0 */2 * * *", () => {
  console.log("⏰ Scheduler kích hoạt - bắt đầu chu kỳ tự động");
  runBot();
});

// ─── Start server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌐 Server chạy tại port ${PORT}`);
  console.log(`📅 Scheduler: tự động chạy mỗi 2 tiếng`);

  // Chạy ngay lần đầu khi khởi động
  setTimeout(() => {
    console.log("🚀 Chạy lần đầu sau khi khởi động...");
    runBot();
  }, 5000);
});

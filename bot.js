// ============================================================
// WB AI Bot - Wildberries Auto Manager
// Tự động: trả lời đánh giá, câu hỏi, xử lý hoàn trả, phân tích
// ============================================================

const Anthropic = require("@anthropic-ai/sdk");

const WB_API_BASE = "https://suppliers-api.wildberries.ru";
const WB_FEEDBACKS_BASE = "https://feedbacks-api.wildberries.ru";

const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const WB_KEY = process.env.WB_API_KEY;

const headers = {
  Authorization: WB_KEY,
  "Content-Type": "application/json",
};

// ─── Gọi Claude AI ───────────────────────────────────────────
async function askClaude(system, user) {
  const res = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content[0].text.trim();
}

// ─── 1. Lấy & trả lời ĐÁNH GIÁ mới ─────────────────────────
async function handleNewFeedbacks() {
  console.log("\n📝 Kiểm tra đánh giá mới...");
  try {
    const res = await fetch(
      `${WB_FEEDBACKS_BASE}/api/v1/feedbacks?isAnswered=false&take=20&skip=0`,
      { headers }
    );
    const data = await res.json();
    const feedbacks = data.data?.feedbacks || [];
    console.log(`  Tìm thấy ${feedbacks.length} đánh giá chưa trả lời`);

    for (const fb of feedbacks) {
      const stars = fb.productValuation;
      const text = fb.text || "(không có nội dung)";
      const productName = fb.subjectName || "sản phẩm";

      const system = `Bạn là đại diện shop thời trang chuyên nghiệp trên Wildberries (Nga). 
Viết phản hồi bằng tiếng Nga, 2-4 câu, thân thiện và chuyên nghiệp.
- Đánh giá 1-2★: xin lỗi chân thành, đề nghị liên hệ để giải quyết, hứa cải thiện
- Đánh giá 3★: cảm ơn, hỏi thêm để cải thiện
- Đánh giá 4-5★: cảm ơn nhiệt tình, mời quay lại mua
Không dùng template cứng nhắc. Đề cập đến nội dung cụ thể khách viết.`;

      const reply = await askClaude(
        system,
        `Sản phẩm: ${productName}\nSố sao: ${stars}★\nĐánh giá: "${text}"\n\nViết phản hồi:`
      );

      // Đăng phản hồi lên WB
      await fetch(`${WB_FEEDBACKS_BASE}/api/v1/feedbacks`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: fb.id, text: reply }),
      });

      console.log(`  ✅ Đã trả lời đánh giá ${stars}★ - ${productName}`);
      console.log(`     → "${reply.substring(0, 80)}..."`);

      await sleep(2000); // tránh rate limit
    }
  } catch (e) {
    console.error("  ❌ Lỗi xử lý đánh giá:", e.message);
  }
}

// ─── 2. Lấy & trả lời CÂU HỎI khách hàng ────────────────────
async function handleQuestions() {
  console.log("\n❓ Kiểm tra câu hỏi mới...");
  try {
    const res = await fetch(
      `${WB_FEEDBACKS_BASE}/api/v1/questions?isAnswered=false&take=20&skip=0`,
      { headers }
    );
    const data = await res.json();
    const questions = data.data?.questions || [];
    console.log(`  Tìm thấy ${questions.length} câu hỏi chưa trả lời`);

    for (const q of questions) {
      const text = q.text || "";
      const productName = q.subjectName || "sản phẩm";

      const system = `Bạn là nhân viên tư vấn shop thời trang trên Wildberries.
Trả lời bằng tiếng Nga, ngắn gọn 1-3 câu, chính xác và hữu ích.
- Câu hỏi về size: khuyên đo số đo cơ thể và so bảng size, hoặc chọn size lớn hơn nếu nghi ngờ
- Câu hỏi về chất liệu/giặt: hướng dẫn cụ thể
- Câu hỏi về màu sắc/stock: trả lời thực tế
- Câu hỏi về giao hàng: thời gian thông thường qua WB
Luôn thân thiện, kết thúc bằng lời mời mua hàng ngắn.`;

      const reply = await askClaude(
        system,
        `Sản phẩm: ${productName}\nCâu hỏi: "${text}"\n\nTrả lời:`
      );

      await fetch(`${WB_FEEDBACKS_BASE}/api/v1/questions`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: q.id, text: reply }),
      });

      console.log(`  ✅ Đã trả lời câu hỏi về "${productName}"`);
      await sleep(2000);
    }
  } catch (e) {
    console.error("  ❌ Lỗi xử lý câu hỏi:", e.message);
  }
}

// ─── 3. Phân tích HOÀN TRẢ ───────────────────────────────────
async function analyzeReturns() {
  console.log("\n↩️  Phân tích hoàn trả...");
  try {
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const res = await fetch(
      `${WB_API_BASE}/api/v3/returns?limit=50&next=0&dateFrom=${dateFrom}`,
      { headers }
    );
    const data = await res.json();
    const returns = data.returns || [];

    if (returns.length === 0) {
      console.log("  Không có hoàn trả nào trong 30 ngày qua");
      return null;
    }

    // Gom nhóm theo lý do
    const reasons = {};
    const byProduct = {};
    for (const r of returns) {
      const reason = r.returnReason || "Không rõ";
      reasons[reason] = (reasons[reason] || 0) + 1;
      const pid = r.nmId || "unknown";
      byProduct[pid] = byProduct[pid] || { count: 0, name: r.subject || pid };
      byProduct[pid].count++;
    }

    const summary = {
      total: returns.length,
      topReasons: Object.entries(reasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      topProducts: Object.entries(byProduct)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([id, v]) => ({ id, ...v })),
    };

    const analysis = await askClaude(
      `Bạn là chuyên gia phân tích dữ liệu bán hàng thời trang Wildberries. 
Phân tích dữ liệu hoàn trả và đưa ra 3 hành động cụ thể nhất để giảm tỷ lệ hoàn trả. 
Trả lời tiếng Việt, ngắn gọn, thực tế.`,
      `Dữ liệu 30 ngày qua:\n${JSON.stringify(summary, null, 2)}`
    );

    console.log(`  📊 Tổng hoàn trả: ${summary.total}`);
    console.log(`  🔍 Phân tích AI:\n${analysis}`);
    return { summary, analysis };
  } catch (e) {
    console.error("  ❌ Lỗi phân tích hoàn trả:", e.message);
    return null;
  }
}

// ─── 4. Phân tích SIZE & đề xuất điều chỉnh ─────────────────
async function analyzeSizeIssues() {
  console.log("\n📐 Phân tích vấn đề size...");
  try {
    // Lấy đánh giá có đề cập đến size
    const res = await fetch(
      `${WB_FEEDBACKS_BASE}/api/v1/feedbacks?isAnswered=true&take=100&skip=0`,
      { headers }
    );
    const data = await res.json();
    const feedbacks = data.data?.feedbacks || [];

    const sizeKeywords = [
      "размер",
      "маломерит",
      "большемерит",
      "мал",
      "велик",
      "не подошёл размер",
    ];
    const sizeIssues = feedbacks.filter((f) =>
      sizeKeywords.some((k) => (f.text || "").toLowerCase().includes(k))
    );

    if (sizeIssues.length === 0) {
      console.log("  Không tìm thấy vấn đề size nào");
      return;
    }

    // Gom theo sản phẩm
    const byProduct = {};
    for (const f of sizeIssues) {
      const pid = f.subjectName || "unknown";
      byProduct[pid] = byProduct[pid] || {
        count: 0,
        smallCount: 0,
        largeCount: 0,
      };
      byProduct[pid].count++;
      if (
        (f.text || "").includes("маломерит") ||
        (f.text || "").includes("мал")
      )
        byProduct[pid].smallCount++;
      if (
        (f.text || "").includes("большемерит") ||
        (f.text || "").includes("велик")
      )
        byProduct[pid].largeCount++;
    }

    const advice = await askClaude(
      `Bạn là chuyên gia tư vấn size quần áo. Phân tích vấn đề size và đề xuất:
1. Sản phẩm nào cần cập nhật mô tả size
2. Nên điều chỉnh lên hay xuống mấy cm trong bảng size
3. Cách viết lại hướng dẫn chọn size
Trả lời tiếng Việt, cụ thể cho từng sản phẩm.`,
      `Vấn đề size từ ${sizeIssues.length} đánh giá:\n${JSON.stringify(byProduct, null, 2)}`
    );

    console.log(`  📝 Tìm thấy ${sizeIssues.length} phàn nàn về size`);
    console.log(`  💡 Đề xuất:\n${advice}`);
  } catch (e) {
    console.error("  ❌ Lỗi phân tích size:", e.message);
  }
}

// ─── 5. Phân tích sản phẩm nên ĐẶT THÊM / DỪNG ──────────────
async function analyzeInventory() {
  console.log("\n📦 Phân tích tồn kho & hiệu suất sản phẩm...");
  try {
    // Lấy tồn kho
    const stockRes = await fetch(
      `${WB_API_BASE}/api/v3/warehouses`,
      { headers }
    );

    // Lấy doanh số 7 ngày
    const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const salesRes = await fetch(
      `${WB_API_BASE}/api/v1/supplier/sales?dateFrom=${dateFrom}&flag=0`,
      { headers }
    );
    const sales = await salesRes.json();

    // Gom doanh số theo sản phẩm
    const salesByProduct = {};
    for (const s of sales || []) {
      const pid = s.nmId;
      salesByProduct[pid] = salesByProduct[pid] || {
        name: s.subject,
        count: 0,
        revenue: 0,
      };
      salesByProduct[pid].count++;
      salesByProduct[pid].revenue += s.priceWithDisc || 0;
    }

    const top = Object.entries(salesByProduct)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([id, v]) => ({ id, ...v, dailyRate: (v.count / 7).toFixed(1) }));

    const recommendation = await askClaude(
      `Bạn là chuyên gia quản lý hàng tồn kho thời trang Wildberries.
Phân tích doanh số 7 ngày và đưa ra quyết định cụ thể:
- Sản phẩm nào cần đặt thêm ngay (và bao nhiêu để đủ 45 ngày)
- Sản phẩm nào bán chậm, nên xem xét dừng hoặc giảm giá
- Sản phẩm nào đang tăng trưởng tốt, nên đẩy mạnh
Trả lời tiếng Việt, với con số cụ thể.`,
      `Doanh số 7 ngày qua (top sản phẩm):\n${JSON.stringify(top, null, 2)}`
    );

    console.log(`  📊 Phân tích ${top.length} sản phẩm`);
    console.log(`  💡 Đề xuất:\n${recommendation}`);
    return { top, recommendation };
  } catch (e) {
    console.error("  ❌ Lỗi phân tích tồn kho:", e.message);
    return null;
  }
}

// ─── Utility ─────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── MAIN: chạy tất cả tasks ─────────────────────────────────
async function runAllTasks() {
  console.log("=".repeat(50));
  console.log(`🚀 WB AI Bot bắt đầu - ${new Date().toLocaleString("vi-VN")}`);
  console.log("=".repeat(50));

  await handleNewFeedbacks();
  await sleep(3000);

  await handleQuestions();
  await sleep(3000);

  await analyzeReturns();
  await sleep(3000);

  await analyzeSizeIssues();
  await sleep(3000);

  await analyzeInventory();

  console.log("\n" + "=".repeat(50));
  console.log("✅ Hoàn thành tất cả tasks!");
  console.log("=".repeat(50));
}

module.exports = { runAllTasks };

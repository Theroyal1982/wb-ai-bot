# 🤖 WB AI Bot — Hướng dẫn cài đặt

Bot tự động quản lý shop Wildberries: trả lời đánh giá, câu hỏi, 
phân tích hoàn trả, phân tích size, đề xuất đặt hàng.

---

## ⚡ Deploy lên Railway (miễn phí, 5 phút)

### Bước 1 — Tải code lên GitHub
1. Vào https://github.com → Đăng nhập
2. Nhấn **New repository** → đặt tên `wb-ai-bot` → Create
3. Upload toàn bộ file trong thư mục này lên repo đó

### Bước 2 — Tạo project trên Railway
1. Vào https://railway.app → Đăng nhập bằng GitHub
2. Nhấn **New Project** → **Deploy from GitHub repo**
3. Chọn repo `wb-ai-bot` vừa tạo
4. Railway sẽ tự detect Node.js và build

### Bước 3 — Thêm biến môi trường (QUAN TRỌNG)
Vào project → **Variables** → thêm 2 biến:

```
WB_API_KEY    = [API key từ Wildberries Seller Center]
CLAUDE_API_KEY = [API key từ console.anthropic.com]
```

### Bước 4 — Xong!
- Railway tự động deploy và chạy
- Mở URL được cấp để xem dashboard
- Bot tự chạy mỗi 2 tiếng

---

## 🔑 Lấy API keys

### Wildberries API Key
1. Vào https://seller.wildberries.ru
2. Cài đặt → Доступ к API (Truy cập API)
3. Tạo token mới, chọn quyền:
   - Контент (Nội dung)
   - Аналитика (Thống kê)
   - Цены и скидки (Giá & khuyến mại)
   - Отзывы и вопросы (Đánh giá & câu hỏi)
   - Возвраты (Hoàn trả)

### Claude API Key
1. Vào https://console.anthropic.com
2. API Keys → Create Key
3. Copy key (bắt đầu bằng `sk-ant-...`)

---

## 🤖 Bot làm gì tự động?

| Tần suất | Tác vụ |
|----------|--------|
| Mỗi 2 tiếng | Kiểm tra & trả lời đánh giá mới bằng tiếng Nga |
| Mỗi 2 tiếng | Trả lời câu hỏi khách hàng |
| Mỗi 2 tiếng | Phân tích hoàn trả & đề xuất giải pháp |
| Mỗi 2 tiếng | Phát hiện vấn đề size, đề xuất điều chỉnh |
| Mỗi 2 tiếng | Phân tích doanh số, đề xuất đặt hàng thêm |

---

## 💰 Chi phí

| Dịch vụ | Chi phí |
|---------|---------|
| Railway (Hobby plan) | Miễn phí 5 USD credit/tháng |
| Claude API | ~0.5–2 USD/tháng (tùy số lượng đánh giá) |
| **Tổng** | **Gần như miễn phí** |

---

## 📊 Dashboard

Sau khi deploy, mở URL Railway để xem:
- Trạng thái bot (đang chạy / sẵn sàng)
- Log realtime từng tác vụ
- Nút chạy thủ công ngay lập tức

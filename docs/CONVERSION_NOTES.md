# Tái thiết kế từ dự án gốc

Nguồn khảo sát: trình-tạo-câu-lệnh-kể-chuyện-ghibli-v.1.zip (React 19, TypeScript, Vite, Node/Express, @google/genai, giao diện Ghibli với tính năng tải Excel và tạo nhiều phân cảnh).

Tái sử dụng: khung công nghệ React/TS + Node/Express, Gemini server-side, hình thức dự án có bộ cấu hình, hướng xuất văn bản.

Đã thay thế: toàn bộ nhãn Ghibli, thư viện phong cách Ghibli, nội dung ASMR/relaxation, logic tạo cảnh phụ thuộc chủ đề Ghibli và các thành phần nhập kế hoạch Excel cũ. Trọng tâm mới là câu chuyện Stickman với scene continuity, 12s Grok và dữ liệu SRT.

Không sao chép tên mô hình/ngưỡng API cũ, không kế thừa cách lưu API keys trên localStorage từ giao diện nguồn. Gemini chỉ dùng `process.env.GEMINI_API_KEY` trong server.

Mô hình dữ liệu: Project → Scenes(F001,...) → Character IDs/Reference IDs → Prompt + Status → QA → CSV/TXT.

Hạn chế: thiếu tích hợp Grok trực tiếp; định thời gian không có SRT chỉ là ước lượng; QA hình ảnh/video thực phải bổ sung ở phiên bản sau.

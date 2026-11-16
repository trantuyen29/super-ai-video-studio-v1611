# Phố Lắc Lư AI Studio – V3.0 Starter

Đây là **gói khởi tạo có chức năng tra cứu/ghép prompt offline**, chưa phải ứng dụng sinh ảnh/video hoặc Gemini story-generation hoàn chỉnh. Repo không chứa API keys.

## Nguồn canon
Dữ liệu từ workbook `Pho_Lac_Lu_Thu_Vien_Nhan_Vat_Story_Scene_AI_V2.1.xlsx`: 48 nhân vật, các quan hệ có hướng, 48 Signature Motions, 64 motion nền, 24 biểu cảm, 32 cảnh nguồn. Các story seeds/scene examples V3 là bản nháp mở rộng.

## Chạy bản mẫu
1. Cài Node.js 20+.
2. `npm install`
3. `npm run dev` rồi mở địa chỉ do Vite hiển thị.
4. Chọn 2 nhân vật và chủ đề, chọn 24/36/48/60 giây, bấm **Lập nhịp 12 giây**, sau đó xem/copy/xuất prompt.

## Đưa vào Google AI Studio Build
1. Giải nén ZIP, đưa *nội dung thư mục* lên GitHub Repo (không upload ZIP như một mã nguồn duy nhất).
2. Dùng chức năng Import from GitHub (nếu được hỗ trợ trong giao diện tài khoản) hoặc đưa mã nguồn vào dự án Build.
3. Dán `AI_STUDIO_BUILD_PROMPT.md` để yêu cầu nâng cấp.
4. Kết nối Gemini ở server/back-end bằng Secrets của môi trường triển khai, **không hardcode key trong UI hoặc GitHub**.
5. Các ảnh/clip phải tạo bằng công cụ phù hợp, upload/QA, không nhầm với hàng đợi `CHƯA TẠO`.

## Trạng thái chức năng
- Có sẵn: tra cứu canon, chọn nhân vật, lọc nhóm, xác định quan hệ có hướng, dựng nhịp 12s theo mẫu, ghép prompt, copy, tải TXT/JSON, xem khối QA.
- Chưa có: Gemini LLM sinh truyện, tạo ảnh 48 Master, video Grok, lưu trữ asset thực và QA video thị giác tự động.
- Hạn chế: nội dung dự thảo theo template không thay thế khả năng kể chuyện của mô hình AI.

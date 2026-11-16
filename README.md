# Super AI Video Studio — Google AI Studio Edition v2.0

Bộ mã nguồn React/TypeScript + Node/Express dành cho **Google AI Studio Build**. Ứng dụng có định hướng đa kênh, đa tập và đa phong cách (Stickman, editorial, mystery). **Grok Video được hỗ trợ ở mức soạn prompt**, không có tích hợp tạo clip Grok trực tiếp.

## Modules hiện có
1. Dashboard: tạo và quản lý nhiều dự án, chọn phong cách và tỷ lệ khung hình.
2. Kịch bản + SRT: dán văn bản, nhập TXT/SRT, chia cảnh mục tiêu 1–15 giây (mặc định 12s). Timeline từ SRT có timestamp; nếu không có SRT chỉ là ước tính.
3. Character/Style Bible: bốn preset, sửa nhân vật/bối cảnh, kiểm soát mã ảnh tham chiếu.
4. Shotlist + Grok Director: prompt tiếng Anh theo cảnh và continuity trước/sau; tạo prompt bằng mẫu hoặc qua Gemini server-side nếu có key.
5. G01–G06 Pipeline: theo dõi trạng thái thực tế, không tự duyệt.
6. Atlas/Global Reference Registry: quản lý **metadata** ảnh và bộ mã ref (chưa có xử lý pixel / lưu ảnh).
7. Clean Narration: chia đoạn theo giới hạn 1.000–25.000 ký tự, xuất từng PART TXT và manifest.
8. YouTube SEO/Thumbnail: nhập, quản lý, xuất gói nội dung (chưa có gọi YouTube API).
9. QA & CapCut Pro: phát hiện vấn đề cấu trúc scene/timeline/prompt, xuất CSV, backup JSON và ghi chú retention.

## Hướng dẫn nhập vào Google AI Studio
1. Giải nén ZIP và tải **nội dung trong thư mục** vào GitHub repository Private, không đưa nguyên ZIP như một file đơn.
2. Mở https://aistudio.google.com/apps , sử dụng Build và tính năng nhập từ GitHub nếu có trên giao diện tài khoản.
3. Chọn repo, cho Gemini đọc `GOOGLE_AI_STUDIO_PROMPT.txt`; yêu cầu cài dependencies, sửa lỗi nếu có và mở Preview.
4. Thêm `GEMINI_API_KEY` trong Secrets/môi trường máy chủ của ứng dụng nếu muốn AI viết prompt. **Không** commit `.env` thật.
5. Test: tạo dự án → nhập kịch bản → chia cảnh → tạo prompt mẫu → xuất CSV; kiểm mốc SRT và lưu backup.

## Chạy độc lập nếu đã có Node.js 20+
```bash
npm install
npm run dev
```
Mặc định mở http://localhost:3000. `npm run lint` để kiểm tra TypeScript, `npm run build` để build frontend và backend, `npm start` sau build.

## Trạng thái xác thực
- Kiểm tra offline: cú pháp TS/TSX bằng TypeScript transpiler; tính toàn vẹn và an toàn ZIP; source APIs không nhúng API key thật.
- **Chưa chạy thành công npm install/build/Preview từ container hiện tại** do hạn chế tải gói. Không tuyên bố ứng dụng đã triển khai trên tài khoản người dùng.
- Dữ liệu đang lưu trong localStorage từng trình duyệt; không có xác thực tài khoản hoặc đồng bộ cloud. Sao lưu JSON trước khi xóa trình duyệt.
- Chưa có sinh media thật, phân tích pixel/video, TTS thực, khớp SRT bằng forced alignment, quản lý file media trên cloud, đăng YouTube hoặc Analytics tự động.

## Quy tắc phát triển an toàn
- Cấu hình bí mật ở server; không để key trong frontend, GitHub hay `.env` đã commit.
- Đăng YouTube chỉ sau duyệt rõ ràng và dùng OAuth hợp lệ.
- Video Grok ngoài ứng dụng cần người dùng thao tác riêng đến khi được tích hợp chính thức.
- Mọi kiểm tra Character/Color/Prop trên dữ liệu text chỉ là cảnh báo, phải kiểm bằng ảnh/video thực.

## Nguồn tham khảo về ý tưởng kiến trúc
Tài liệu này tổng hợp tư duy thiết kế từ việc nghiên cứu các ZIP người dùng cung cấp: Stickman Video Director, Yt-Director, AI Content Factory, Muse Video, DIRcreative, AI Director Colab, VoiceStudio và Veo Studio. Không gộp nguyên các repository, tài nguyên demo hay mã bên thứ ba vào ứng dụng để giảm xung đột và rủi ro giấy phép. Mã mới phát triển dựa trên bản Stickman Video Director Studio v1.0 đã có trong cuộc trò chuyện.

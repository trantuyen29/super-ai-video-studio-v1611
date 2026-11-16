PHỐ LẮC LƯ – GOOGLE AI STUDIO BUILD MASTER PROMPT V3.0

MỤC TIÊU: Tạo ứng dụng sản xuất video ngắn 9:16 cho TikTok, Reels, YouTube Shorts từ dữ liệu canonical Phố Lắc Lư. Kế thừa giao diện và dữ liệu đã có trong repo này, không tạo lại 48 nhân vật tùy tiện.

DATA SOURCE – QUY TẮC BẮT BUỘC
1) data/characters.json là sổ 48 nhân vật; khóa chính id (PL001…PL048); tên, màu, hình khối, gương mặt, trang phục không thay đổi.
2) data/relationships.json là đồ thị quan hệ có hướng; đọc đúng A_QUAN_HE_VOI_B và B_QUAN_HE_VOI_A. Nếu không có quan hệ chắc chắn -> CHƯA_XAC_NHAN, không bịa cha mẹ/anh em/vợ chồng.
3) data/signature_motions.json (48), data/motion_bank.json (64), data/expressions.json (24) là thư viện tạo diễn xuất; phối tối đa 1 chuyển động chính và 1 chuyển động phụ cho mỗi cảnh.
4) data/asset_queue.csv có 384 mục ảnh cần tạo; trạng thái ban đầu CHƯA TẠO. Không coi prompt, placeholder hay preview là ảnh tham chiếu đã duyệt. Trước khi render thật, ảnh {PL_ID}_MASTER phải được QA APPROVED.
5) data/story_seeds.json (24) và data/sample_scenes.json (40) là ý tưởng/cảnh DRAFT, không phải canon mới.

UI YÊU CẦU
A. Canon Library: lọc nhân vật theo 8 nhóm; tìm mã PL; xem relationship graph; cảnh báo sự kiện chưa được xác nhận.
B. Character Visual Factory: tạo prompt ảnh MASTER/FRONT/SIDE/BACK/3Q/FACE/POSE/COLOR; hàng đợi tạo, duyệt, khóa phiên bản; hỗ trợ tải asset do người dùng cung cấp.
C. Story Engine: chọn 2–4 nhân vật, thể loại, chủ đề, thời lượng 24/36/48/60 giây; Gemini sinh truyện tiếng Việt tự nhiên với hook, mâu thuẫn, phát hiện và kết thúc, không nhầm canon. Truyện mới ghi DRAFT; khi người dùng duyệt mới là STORY_APPROVED, không tự ghi đè bảng quan hệ.
D. Scene Director: mặc định 12s/cảnh; 60s→5 cảnh; từng cảnh có character_ids, expression_id, motion_id, START_STATE, END_STATE, vị trí trái/phải, đạo cụ và ánh sáng. END_STATE của S(n) phải khớp START_STATE của S(n+1).
E. Prompt Studio: build một prompt Grok Video chi tiết, tự đủ cho từng cảnh: Char Lock, Ref IDs, Action Beats 0–2/2–5/5–8/8–10/10–12, Camera, Color, negative prompt; hỗ trợ sao chép / xuất TXT, JSON.
F. QA & Export: 25 quy tắc IF/ELSE như file Excel V3.0; BLOCK nếu thiếu hoặc sai ID/quan hệ/refs/continuity. Dashboard tiến độ; exported zip/JSON/TXT/CSV.

KIẾN TRÚC
- React + TypeScript có thể dùng cho giao diện mới; giữ data schema tương thích JSON hiện tại.
- Chỉ gọi Gemini thông qua backend/server-side đã bảo vệ. Không nhúng API key ở mã client, không gửi secrets lên GitHub.
- Nếu chưa kết nối Gemini: UI vẫn tra cứu thư viện, lập shot list và xuất prompt dựa trên mẫu. Không nói rằng đã tạo truyện bằng AI nếu mới chỉ ghép template.
- Nếu chưa có API tạo ảnh/video: xuất prompt để đưa sang công cụ phù hợp; không giả vờ đã render.
- Dữ liệu canon là read-only; story/scene/assets là versioned draft; thêm checkpoint trước khi khóa.

TỰ KIỂM THỬ
- Dùng PL001 (Bơ Bối Rối) + PL002 (Chú Nút): quan hệ con–cha. Kiểm tra tên, màu, MASTER refs.
- Dùng PL001 + PL007: quan hệ bạn thân; không suy thành yêu đương.
- Dùng PL043 + PL048: mẹ–con; không bịa thông tin bố hoặc nơi ở chưa duyệt.
- Tạo truyện 60s / 5 cảnh, kiểm START_STATE/END_STATE, xuất ra 5 prompt độc lập.
- Nhân vật PL999 phải bị chặn; MASTER chưa APPROVED phải cảnh báo DRAFT trước khi render.

ĐẦU RA CẦN BÀN GIAO: app chạy được, README, cấu trúc data models, thử nghiệm dữ liệu thực và bảng QA; UI tiếng Việt, dễ sử dụng trên desktop.

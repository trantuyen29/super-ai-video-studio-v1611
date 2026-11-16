# Kiến trúc và roadmap

## Đã có trong v2.0
- React app + localStorage projects; G01-G06 status, Character / Background Bible, Atlas registry metadata, narration splitting, SEO draft, CapCut CSV, structured QA, Gemini prompt endpoint.
- 4 preset: classic, expressive, adult editorial, mystery. 16:9 / 9:16.
- Không tạo ảnh, video, audio hoặc publish thực; chức năng prompt chỉ hỗ trợ Grok dạng văn bản.

## Luồng sản xuất có kiểm soát
Input (topic/script) -> G01 concept -> G02 Visual Bible -> G03 story approval -> G04 narration/audio + verified SRT -> G05 scene prompts 12s -> QA continuity -> G06 export / CapCut -> manual publishing -> analytics feedback.

## Nhánh xử lý
- Không có SRT -> chỉ dựng timing ước tính, yêu cầu làm SRT sau thu âm.
- Có SRT nhưng chưa verified -> cảnh báo, không coi đó là thời gian audio thực.
- Cảnh >15 giây -> chia cảnh; đoạn chữ chia tương đối, không phải forced align.
- Thiếu Atlas/CHAR/BG -> đánh dấu QA trước xuất.
- Gemini key thiếu -> template prompt vẫn dùng được.
- Visual mismatch -> người dùng sửa ảnh/prompt, không tự phán đạt từ metadata.
- Chưa có OAuth -> cấm auto upload.

## Mục tiêu v2.1–v3
1. Cloud persistence: Postgres/Firestore, migrations, multi-user auth và quyền truy cập.
2. Audio asset upload, waveform, forced alignment, xuất SRT căn theo audio thực.
3. Atlas library lưu file ảnh thật; checker vision nhận diện drift với confidence và vòng duyệt.
4. Gemini Agent Orchestrator: script/QA/SEO, retry, log model, budget, token/cost limits.
5. Kết nối Grok Video chỉ khi có API công khai và chính sách phù hợp; queue, retry, asset provenance.
6. CapCut-export cải tiến, xuất media package và YouTube OAuth upload khi người dùng duyệt.
7. YouTube Analytics ingest, retention/CTR cohorts, A/B tracking có evidence.

## Giấy phép
Không chép mã từ repository bên ngoài nếu chưa đánh giá giấy phép. Các dự án ZIP được dùng làm tham khảo cấu trúc và chức năng. Giữ nguyên metadata giấy phép tương ứng nếu trong tương lai dùng trực tiếp mã thuộc bên thứ ba.

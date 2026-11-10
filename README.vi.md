# harness-kit

Một thư mục workflow và một bộ luật dùng chung cho mọi AI coding agent.

[English](README.md)

Mỗi phiên AI bắt đầu với bộ nhớ trống, và mỗi công cụ, skill hay plugin lại ghi spec, plan vào một chỗ khác nhau. harness-kit đem lại cho dự án:

- **Bộ nhớ nằm trong repo**: file trạng thái và nhật ký quyết định mà phiên nào cũng đọc đầu tiên và cập nhật sau cùng.
- **Một nơi duy nhất cho tài liệu làm việc**: spec, plan, tasks, research, review đều vào `workflow/features/<NNN-slug>/`, bất kể skill nào tạo ra.
- **Ba skill chạy vòng lặp**: `flow`, `catchup`, `handoff`.
- **Hành vi giống nhau giữa các công cụ**: luật nằm trong `AGENTS.md`, file mà Claude Code, Codex, Cursor, Antigravity, OpenCode và Gemini CLI đều đọc.

## Cài đặt

Chạy ở thư mục gốc của dự án. Cần Node.js 18 trở lên và git.

```bash
npx github:7binh/harness-kit init
```

Hoặc dùng script một dòng:

```bash
curl -fsSL https://raw.githubusercontent.com/7binh/harness-kit/main/install.sh | sh
```

```powershell
irm https://raw.githubusercontent.com/7binh/harness-kit/main/install.ps1 | iex
```

| Tuỳ chọn | Ý nghĩa | Mặc định |
|---|---|---|
| `--dir <path>` | Thư mục workflow, tính từ gốc dự án | `workflow` |
| `--agents <list>` | Adapter bổ sung: `claude`, `gemini`, `all`, `none` | `all` |
| `--force` | Ghi đè cả `STATE.md`, `DECISIONS.md`, `README.md` và các template | tắt |

Chạy lại `init` để cập nhật. Lệnh chỉ thay khối của riêng nó trong `AGENTS.md`, hook của nó, các skill và `.kit/kit.mjs`; trạng thái, quyết định, template và phần còn lại của các file đó được giữ nguyên.

Sau đó commit `AGENTS.md` và `workflow/` để bộ nhớ đi cùng repo.

## Vòng lặp hằng ngày

1. **Mở phiên.** Agent chạy `node workflow/.kit/kit.mjs status` và đọc `STATE.md`. Sau một thời gian nghỉ, yêu cầu `catchup`.
2. **Mô tả tính năng và yêu cầu `flow`.** Skill tạo `workflow/features/NNN-slug/` rồi chạy từng giai đoạn: spec, plan, tasks, implement, verify. Bạn duyệt từng tài liệu trước khi giai đoạn sau dựa lên nó.
3. **Kết thúc phiên.** Yêu cầu `handoff`. Skill tick các task đã xong, ghi quyết định và viết lại `STATE.md`.

Ở công cụ hỗ trợ slash command cho skill, gõ `/flow`, `/catchup`, `/handoff`. Ở công cụ khác, nói bằng lời: "chạy skill flow".

```bash
node workflow/.kit/kit.mjs status       # branch, commit gần nhất, feature đang làm, giai đoạn, cảnh báo lệch
node workflow/.kit/kit.mjs new <slug>   # tạo feature kế tiếp và đặt làm feature đang làm
node workflow/.kit/kit.mjs doctor       # kiểm tra cài đặt, liệt kê tài liệu nằm sai chỗ
```

## Tài liệu được giữ một chỗ bằng cách nào

1. **Luật trong `AGENTS.md`.** Một bảng ánh xạ từng loại tài liệu tới đường dẫn, và nói rõ luật này thay cho thư mục mặc định của mọi skill.
2. **Skill `flow`.** Ở mỗi giai đoạn nó dùng skill tốt nhất đang có (Spec Kit, Superpowers, skill riêng của bạn) để lấy phương pháp, rồi ghi kết quả vào thư mục feature.
3. **Hook chặn (Claude Code).** Việc tạo mới `spec.md`, `plan.md`, `tasks.md`, `research.md`, `prd.md` ngoài thư mục workflow, hoặc tạo file markdown mới trong `specs/`, `plans/`, `docs/specs/`, `docs/plans/`, `docs/superpowers/`, sẽ bị từ chối kèm thông báo chỉ đúng đường dẫn. Sửa file đã có thì không bao giờ bị chặn.

`status` và `doctor` báo mọi tài liệu lọt ra ngoài, ở bất kỳ công cụ nào. Sửa `strayDirs` và `artifactNames` trong `workflow/.kit/config.json` để đổi quy tắc.

## Hỗ trợ theo công cụ

| Công cụ | Đọc luật từ | Đọc skill từ | Hook tự động |
|---|---|---|---|
| Claude Code | `CLAUDE.md` → `AGENTS.md` | `.claude/skills/` | Có: snapshot đầu phiên, chặn khi ghi file |
| Codex | `AGENTS.md` | `.agents/skills/` | Không |
| Cursor | `AGENTS.md` | `.agents/skills/` | Không |
| Antigravity | `AGENTS.md` | `.agents/skills/` | Không |
| OpenCode | `AGENTS.md` | `.agents/skills/` | Không |
| Gemini CLI | `GEMINI.md` → `AGENTS.md` | `.agents/skills/` | Không |

Ở công cụ không có hook, agent tự chạy lệnh status theo luật "Start of a session" trong `AGENTS.md`. Cách này phụ thuộc vào việc model tuân thủ hướng dẫn; hook thì không.

Lưu ý:

- OpenCode cũng quét `.claude/skills/`, nên khi cài adapter Claude nó thấy mỗi skill hai lần (nội dung giống hệt). Dùng `--agents gemini` hoặc `--agents none` nếu bạn không dùng Claude Code.
- Một số bản Cursor được báo là không liệt kê skill trong `.agents/skills/`. Nếu gặp, chép ba thư mục skill sang `.cursor/skills/`.
- Hook chạy `node workflow/.kit/kit.mjs` theo đường dẫn tương đối, nên hãy mở agent từ thư mục gốc của dự án.

## Đưa vào dự án đã có sẵn

`init` không di chuyển file của bạn. Nếu đã có spec ở chỗ khác, `doctor` sẽ liệt kê và in lệnh để chuyển, ví dụ:

```bash
git mv specs/003-trip-sharing workflow/features/003-trip-sharing
```

## Giấy phép

MIT

# harness-kit

Một thư mục workflow và một bộ luật dùng chung cho mọi AI coding agent.

[English](README.md)

Mỗi phiên AI bắt đầu với bộ nhớ trống, và mỗi công cụ, skill hay plugin lại ghi spec, plan vào một chỗ khác nhau. Ở dự án lớn, điều đó dẫn tới mất ngữ cảnh, lặp lại lỗi cũ và tài liệu nằm rải rác. harness-kit đem lại cho dự án:

- **Bộ nhớ nằm trong repo**: tri thức dự án, trạng thái hiện tại, quyết định và nhật ký phiên mà phiên nào cũng đọc đầu tiên và cập nhật sau cùng.
- **Một nơi duy nhất cho tài liệu làm việc**: spec, plan, tasks, research, review đều vào `workflow/features/<NNN-slug>/`, bất kể skill nào tạo ra.
- **Bốn skill chạy vòng lặp**: `onboard`, `flow`, `catchup`, `handoff`.
- **Cổng chất lượng ở một chỗ**: các lệnh chứng minh thay đổi an toàn, chạy bằng một lệnh.
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
| `--git-hook` | Thêm bước kiểm tra pre-commit của git, từ chối tài liệu workflow nằm sai chỗ | tắt |
| `--force` | Ghi đè cả các file của bạn (state, decisions, project, roadmap, template) | tắt |

Chạy lại `init` để cập nhật. Lệnh chỉ thay các khối của riêng nó trong `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, hook của nó, các skill và `.kit/kit.mjs`. Tài liệu, giá trị cấu hình và phần còn lại của các file đó được giữ nguyên.

Sau đó:

1. Mở agent và yêu cầu **`onboard`**. Skill khảo sát codebase rồi điền `workflow/PROJECT.md`, bảng tra ngữ cảnh và các lệnh kiểm tra. Hãy đọc lại những gì nó viết.
2. Commit `AGENTS.md` và `workflow/` để bộ nhớ đi cùng repo.

## Những gì được cài

```text
AGENTS.md                     khối luật workflow (phần còn lại của file là của bạn)
CLAUDE.md, GEMINI.md          khối import AGENTS.md, PROJECT.md và STATE.md
workflow/
  PROJECT.md                  stack, lệnh, luật được kiểm tra tự động, bảng tra ngữ cảnh
  STATE.md                    đang làm gì, bước tiếp theo, câu hỏi mở
  DECISIONS.md                nhật ký quyết định, chỉ thêm không sửa
  ROADMAP.md                  đang làm, kế tiếp, để sau, nợ kỹ thuật
  features/
    ACTIVE                    feature đang làm (tên nhánh trùng feature sẽ được ưu tiên)
    001-some-feature/         spec.md, plan.md, tasks.md, research.md, review.md
  notes/                      tài liệu không gắn với một feature
  log/2026-11.md              nhật ký phiên, mỗi tháng một file
  templates/                  template spec, plan, tasks (sửa cho hợp dự án)
  .kit/kit.mjs                script hỗ trợ, không phụ thuộc gì
  .kit/config.json            tên thư mục, adapter, lệnh kiểm tra, quy tắc tài liệu sai chỗ
  .kit/events.jsonl           log sự kiện của máy (cục bộ, không commit)
.agents/skills/               onboard, flow, catchup, handoff
.claude/skills/               bốn skill đó, cho Claude Code
.claude/settings.json         hai hook, gộp vào cấu hình sẵn có
```

## Vòng lặp hằng ngày

1. **Mở phiên.** Agent chạy `status`, đọc `STATE.md` và `PROJECT.md`. Sau một thời gian nghỉ, yêu cầu `catchup`.
2. **Mô tả tính năng và yêu cầu `flow`.** Skill tạo `workflow/features/NNN-slug/` rồi chạy từng giai đoạn: spec, plan, tasks, implement, verify. Bạn duyệt từng tài liệu trước khi giai đoạn sau dựa lên nó.
3. **Kết thúc phiên.** Yêu cầu `handoff`. Skill tick các task đã xong, ghi quyết định, viết lại `STATE.md` và thêm một mục vào nhật ký phiên.

Ở công cụ hỗ trợ slash command cho skill, gõ `/onboard`, `/flow`, `/catchup`, `/handoff`. Ở công cụ khác, nói bằng lời: "chạy skill flow".

```bash
node workflow/.kit/kit.mjs status        # branch, commit gần nhất, feature đang làm, giai đoạn, cảnh báo lệch
node workflow/.kit/kit.mjs list          # mọi feature kèm giai đoạn và tiến độ task
node workflow/.kit/kit.mjs new <slug>    # tạo feature kế tiếp và đặt làm feature đang làm
node workflow/.kit/kit.mjs use <name>    # đổi feature đang làm
node workflow/.kit/kit.mjs check         # chạy các lệnh kiểm tra chất lượng
node workflow/.kit/kit.mjs log           # xem các mục nhật ký phiên gần nhất
node workflow/.kit/kit.mjs doctor        # kiểm tra cài đặt, liệt kê tài liệu nằm sai chỗ
```

## Dành cho dự án lớn

**Ba tầng ngữ cảnh.** Nạp mọi thứ vào mọi phiên thì không mở rộng được, nên kit chia ra:

| Tầng | Nạp khi nào | Nội dung |
|---|---|---|
| Luôn có | Mọi phiên | `AGENTS.md`, `PROJECT.md`, `STATE.md` và snapshot trực tiếp |
| Theo vùng code | Trước khi sửa vùng đó | Các tài liệu mà bảng tra trong `PROJECT.md` liệt kê |
| Theo feature | Khi đang làm feature | `spec.md`, `plan.md`, `tasks.md` của feature đang làm |

**Tri thức dự án.** `onboard` đọc manifest, file CI, test và một lát cắt của mỗi vùng, rồi ghi lại lệnh thật, luật được công cụ kiểm tra và bảng tra ngữ cảnh. Phần nào không xác định được thì đánh dấu, không đoán.

**Cổng chất lượng.** `checks` trong `config.json` liệt kê các lệnh chứng minh thay đổi an toàn. `kit.mjs check` chạy hết, in phần cuối của lỗi và trả mã lỗi khác 0, nên agent, người và CI dùng chung một lệnh:

```json
"checks": [
  { "name": "typecheck", "command": "npm run typecheck" },
  { "name": "unit tests", "command": "npm test" }
]
```

**Làm song song.** Nhánh tên `003-foo` hoặc `feat/003-foo` tự chọn feature `003-foo` trên nhánh đó, nên nhiều người, nhiều nhánh hay nhiều worktree mỗi bên có feature riêng. `list` hiện tất cả.

**Hai loại log.**

- `workflow/log/YYYY-MM.md` là nhật ký phiên, commit cùng code. Mỗi lần `handoff` thêm một mục gồm thời gian, nhánh, feature, giai đoạn, công cụ đã làm và các commit kể từ mục trước (script tự đọc từ git).
- `workflow/.kit/events.jsonl` là log máy cục bộ: mở phiên, đổi feature, kết quả kiểm tra, và mọi lần bị chặn ghi file hay chặn commit.

**Roadmap và nợ kỹ thuật.** `ROADMAP.md` giữ hàng đợi công việc ngoài feature đang làm. `flow` lấy mục kế tiếp từ đó khi bạn yêu cầu "việc tiếp theo".

## Tài liệu được giữ một chỗ bằng cách nào

Bốn lớp, từ mềm tới cứng:

1. **Luật trong `AGENTS.md`.** Một bảng ánh xạ từng loại tài liệu tới đường dẫn, và nói rõ luật này thay cho thư mục mặc định của mọi skill.
2. **Skill `flow`.** Ở mỗi giai đoạn nó dùng skill tốt nhất đang có (Spec Kit, Superpowers, skill riêng của bạn) để lấy phương pháp, rồi ghi kết quả vào thư mục feature.
3. **Hook chặn (Claude Code).** Việc tạo mới `spec.md`, `plan.md`, `tasks.md`, `research.md`, `prd.md` ngoài thư mục workflow, hoặc tạo file markdown mới trong `specs/`, `plans/`, `docs/specs/`, `docs/plans/`, `docs/superpowers/`, sẽ bị từ chối kèm thông báo chỉ đúng đường dẫn. Sửa file đã có thì không bao giờ bị chặn.
4. **Kiểm tra pre-commit của git (mọi công cụ, bật bằng `--git-hook`).** Commit thêm file như vậy sẽ bị từ chối, bất kể agent hay người nào tạo commit.

`status` và `doctor` cũng báo tài liệu nằm sai chỗ. Sửa `strayDirs` và `artifactNames` trong `config.json` để đổi quy tắc.

## Hỗ trợ theo công cụ

| Công cụ | Đọc luật từ | Đọc skill từ | Hook tự động |
|---|---|---|---|
| Claude Code | `CLAUDE.md` → `AGENTS.md` | `.claude/skills/` | Snapshot đầu phiên, chặn khi ghi file |
| Codex | `AGENTS.md` | `.agents/skills/` | Không |
| Cursor | `AGENTS.md` | `.agents/skills/` | Không |
| Antigravity | `AGENTS.md` | `.agents/skills/` | Không |
| OpenCode | `AGENTS.md` | `.agents/skills/` | Không |
| Gemini CLI | `GEMINI.md` → `AGENTS.md` | `.agents/skills/` | Không |

Ở công cụ không có hook, agent tự chạy lệnh status theo luật "Start of a session" trong `AGENTS.md`. Cách này phụ thuộc vào việc model tuân thủ hướng dẫn. Kiểm tra pre-commit của git thì không, nên hãy bật nó nếu bạn dùng các công cụ này.

Lưu ý:

- OpenCode cũng quét `.claude/skills/`, nên khi cài adapter Claude nó thấy mỗi skill hai lần (nội dung giống hệt). Dùng `--agents gemini` hoặc `--agents none` nếu bạn không dùng Claude Code.
- Một số bản Cursor được báo là không liệt kê skill trong `.agents/skills/`. Nếu gặp, chép các thư mục skill sang `.cursor/skills/`.
- Hook chạy `node workflow/.kit/kit.mjs` theo đường dẫn tương đối, nên hãy mở agent từ thư mục gốc của dự án.

## Dùng trong CI

```yaml
- run: node workflow/.kit/kit.mjs doctor   # lỗi khi có tài liệu workflow nằm ngoài workflow/
- run: node workflow/.kit/kit.mjs check    # lỗi khi một lệnh kiểm tra thất bại
```

## Gỡ cài đặt

```bash
npx github:7binh/harness-kit uninstall          # chỉ liệt kê việc sẽ làm, không đổi gì
npx github:7binh/harness-kit uninstall --yes    # thực hiện
```

Lệnh đưa dự án về trạng thái trước khi `init`:

- Bốn skill bị xoá khỏi `.agents/skills/` và `.claude/skills/`.
- Khối harness-kit bị gỡ khỏi `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`. File nào chỉ chứa khối đó thì bị xoá; file khác giữ nguyên phần của bạn.
- Hook của harness-kit bị gỡ khỏi `.claude/settings.json` và dòng trong git pre-commit. Hook của bạn vẫn còn.
- `workflow/.kit/` bị xoá, cùng mọi file trong `workflow/` còn y nguyên như template.
- **File bạn hoặc agent đã viết được giữ lại**: spec, plan của các feature, nhật ký phiên, và `STATE.md`, `PROJECT.md`, `ROADMAP.md`, `DECISIONS.md` nếu đã sửa. Đó là lịch sử dự án.

Thêm `--purge` để xoá cả thư mục workflow, kể cả tài liệu của bạn. Không có `--yes` thì không có gì bị đụng tới. Xem kết quả bằng `git status`.

Nếu thư mục không tên `workflow` và kit không tự nhận ra nữa, thêm `--dir <thư mục>`.

## Đưa vào dự án đã có sẵn

`init` không di chuyển file của bạn. Nếu đã có spec ở chỗ khác, `doctor` sẽ liệt kê và in lệnh để chuyển, ví dụ:

```bash
git mv specs/003-trip-sharing workflow/features/003-trip-sharing
```

## Giấy phép

MIT

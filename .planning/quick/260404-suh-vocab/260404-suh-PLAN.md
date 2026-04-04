---
phase: quick
plan: 260404-suh
type: execute
wave: 1
depends_on: []
files_modified:
  - vocab/nova.en.json
  - vocab/luna.en.json
  - vocab/mochi.en.json
  - vocab/iris.en.json
  - vocab/leijun.en.json
  - src/schemas/config.ts
  - src/core/character.ts
  - tests/character.test.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "英文用户设置 language=en 后看到全英文鼓励语"
    - "中文用户（默认/language=zh）行为完全不变"
    - "每个角色的英文 vocab 保留各自风格（Nova 热血、Luna 温柔、Mochi 傲娇猫系、Iris 御姐挑衅）"
    - "leijun 英文版保留 Are U OK 标志性梗"
  artifacts:
    - path: "vocab/nova.en.json"
      provides: "Nova 英文 vocab — 运动系加油风"
    - path: "vocab/luna.en.json"
      provides: "Luna 英文 vocab — 温柔治愈陪伴系"
    - path: "vocab/mochi.en.json"
      provides: "Mochi 英文 vocab — 傲娇猫系"
    - path: "vocab/iris.en.json"
      provides: "Iris 英文 vocab — 女王御姐冷静挑衅"
    - path: "vocab/leijun.en.json"
      provides: "Lei Jun 英文 vocab — 雷军风格"
  key_links:
    - from: "src/core/character.ts loadCharacter()"
      to: "vocab/{name}.en.json"
      via: "lang 参数控制文件名后缀"
    - from: "src/schemas/config.ts ConfigType"
      to: "language field"
      via: "parseConfig 解析 language?: 'zh' | 'en'"
---

<objective>
为所有 5 个角色添加英文版 vocab，并在代码层面支持通过 config.json 的 language 字段切换语言（默认 zh，向后兼容）。

Purpose: 让英语用户也能使用 code-cheer，同时不破坏中文用户的现有体验。
Output: 5 个 `.en.json` vocab 文件 + config schema 语言字段 + character.ts 语言感知加载逻辑。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/tony/workspace/ai/code-cheer/src/schemas/config.ts
@/Users/tony/workspace/ai/code-cheer/src/core/character.ts
@/Users/tony/workspace/ai/code-cheer/src/schemas/vocab.ts

<!-- 现有 vocab 结构参考（中文，行数相同） -->
<!-- vocab/nova.json — 291行，post_tool×40, random×60, time×20/20/20/20, usage×20/20, git_events×3/3/3/3/3/3/3/3 -->
<!-- 英文 vocab 保持相同条目数，保留各角色风格 -->
</context>

<tasks>

<task type="auto">
  <name>Task 1: Config schema 加 language 字段 + character.ts 语言感知加载</name>
  <files>src/schemas/config.ts, src/core/character.ts</files>
  <action>
**src/schemas/config.ts：**
1. 在 `ConfigType` 加可选字段 `language?: 'zh' | 'en'`
2. 在 `parseConfig` 中解析 `language`：
   - 只接受 `'zh'` 或 `'en'`，其他值忽略（不 throw，向后兼容）
   - 缺失时不设置（undefined = 默认 zh 行为）
3. 示例：`const language = obj.language === 'en' ? 'en' : undefined`

**src/core/character.ts：**
1. `loadCharacter(name, vocabDir?, lang?)` 加第三个可选参数 `lang?: 'zh' | 'en'`
2. 构造文件名时：`lang === 'en'` → `${name}.en.json`，否则 `${name}.json`（现有行为不变）
3. 若 `${name}.en.json` 不存在且 `lang === 'en'`，fallback 到 `${name}.json` 并 `process.stderr.write` 警告（不 throw）
4. 将 fallback 逻辑提取为 `resolveVocabPath(dir, name, lang?)` 内部函数

**注意：**
- 不修改 `VocabData` 类型和 `parseVocab`（英文 JSON 结构完全相同）
- statuses.ts 和 statusline.ts 的调用点不在此任务中修改（Task 2 中处理）
  </action>
  <verify>
    <automated>cd /Users/tony/workspace/ai/code-cheer && npm run typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>typecheck 通过，loadCharacter 接受可选 lang 参数，lang='en' 时构造 .en.json 路径并 fallback</done>
</task>

<task type="auto">
  <name>Task 2: 创建 5 个英文 vocab 文件 + 接入 statusline 语言选择</name>
  <files>
    vocab/nova.en.json,
    vocab/luna.en.json,
    vocab/mochi.en.json,
    vocab/iris.en.json,
    vocab/leijun.en.json,
    src/statusline.ts
  </files>
  <action>
**为每个角色创建英文 vocab 文件，结构与中文版完全一致，条目数相同，风格如下：**

**nova.en.json** — style: "high-energy sports hype, exclamation-heavy, GO!!" 
- random×60: "Full send!! GO GO GO!!", "Every line of code is a win!!", "You're built different!!", "No bug survives forever!! Charge!!" 等高能加油语
- time.morning×20 / afternoon×20 / evening×20 / midnight×20
- usage.warning×20 / critical×20  
- post_tool×40: "✓ Done!! Keep that momentum going!!", "Nailed it!! On to the next!!" 等
- git_events: 各 3 条英文版本

**luna.en.json** — style: "gentle, nurturing, soft encouragement, tildes~"
- random×60: "You're doing so well today~", "Take a breath, you've got this~", "Little by little, it all adds up~" 等温柔语
- 时间/用量/post_tool 对应英文版，保持 ~ 结尾风格
- git_events 3条/key，温柔语气

**mochi.en.json** — style: "tsundere cat, third-person self-reference, pretends not to care"
- random×60: "Mochi glanced over... I guess that's acceptable.", "Don't think Mochi is impressed or anything! ...okay maybe a little.", "Hmph. Fine work. Not that Mochi cares~" 等傲娇表达
- 第三人称 "Mochi" 贯穿全文
- git_events 傲娇认可风格

**iris.en.json** — style: "cool queen, cold provocation, challenging tone"
- random×60: "Oh? Still here.", "Adequate.", "That almost met my standards.", "Trying to impress me? ...Not bad." 等冷淡御姐语气
- 极简、挑衅、偶尔冷笑
- git_events 冷静评价风格

**leijun.en.json** — style: "Lei Jun CEO style, 'Are U OK', 'classmates', all-in spirit"
- random×60: 保留 "Are U OK?" 作为标志性开头，"classmates" 称呼，"all in" / "beyond bulletproof" 等雷军名言英文版
- "Are U OK? Classmates, this code is beyond bulletproof!", "Classmates, I dreamed of this. Now build it.", "Are U OK? 100% heart. No compromise." 等
- git_events 保留 Are U OK 梗

**所有文件：**
- JSON 结构必须与 nova.json 完全一致（相同的键层级）
- meta.style 用英文描述风格
- 内容翻译/创作要体现原角色个性，不是机械直译

**src/statusline.ts：**
- 找到 `loadCharacter(config.character)` 调用点（updateMode 和 renderMode）
- 改为 `loadCharacter(config.character, undefined, config.language)`
- config 类型已在 Task 1 中更新，此处直接使用

**验证所有文件可被正常加载：**
```bash
cd /Users/tony/workspace/ai/code-cheer && node -e "
const {loadCharacter} = require('./dist/statusline.js');
" 2>&1 || true
```
（先 build 再验证）
  </action>
  <verify>
    <automated>cd /Users/tony/workspace/ai/code-cheer && npm run build 2>&1 | tail -5 && npm test 2>&1 | tail -20</automated>
  </verify>
  <done>
- build 通过（dist/statusline.js 生成）
- npm test 通过（全部测试绿色）
- 5 个 .en.json 文件存在且 JSON 合法
- node dist/statusline.js 在 config.language=en 时输出英文消息
  </done>
</task>

<task type="auto">
  <name>Task 3: 测试补全 — language 切换路径覆盖</name>
  <files>tests/character.test.ts</files>
  <action>
在 `tests/character.test.ts` 中添加针对 `lang` 参数的测试：

1. **加载英文 vocab 测试：**
   - `loadCharacter('nova', realVocabDir, 'en')` 返回合法 VocabData（meta.name 存在）
   - 遍历全部 5 个角色，验证 .en.json 可被加载

2. **fallback 测试：**
   - 当 vocabDir 中只有 `test.json` 无 `test.en.json` 时
   - `loadCharacter('test', tmpDir, 'en')` 应 fallback 到 `test.json`（不 throw）
   - `process.stderr` 收到警告信息（可用 jest.spyOn 捕获）

3. **默认行为不变测试：**
   - `loadCharacter('nova', realVocabDir)` — 不传 lang 仍加载 nova.json（中文）
   - `loadCharacter('nova', realVocabDir, 'zh')` — 显式 zh 也加载 nova.json

**注意：**
- 使用 `path.join(__dirname, '../vocab')` 作为 realVocabDir
- fallback 测试用临时 fixture（只创建 test.json，不创建 test.en.json）
- 遵循 D-12 env-injection 模式（vocabDir 参数注入路径）
  </action>
  <verify>
    <automated>cd /Users/tony/workspace/ai/code-cheer && npm test -- --testPathPattern=character 2>&1 | tail -20</automated>
  </verify>
  <done>character.test.ts 全部测试通过，包含 lang 参数覆盖路径（en 加载、fallback、默认 zh）</done>
</task>

</tasks>

<verification>
```bash
cd /Users/tony/workspace/ai/code-cheer
# 1. 全量测试
npm test

# 2. 类型检查
npm run typecheck

# 3. 手动验证英文模式（临时改 config.json language 为 en）
echo '{"character":"nova","language":"en"}' > /tmp/test-config.json
node -e "
  process.env.CODE_CHEER_CONFIG = '/tmp/test-config.json'
  // 或直接测试 loadCharacter
  const path = require('path')
  const {loadCharacter} = require('./src/core/character')
  const vocab = loadCharacter('nova', path.join(__dirname, 'vocab'), 'en')
  console.log('EN random[0]:', vocab.triggers?.random?.[0])
" 2>&1 || true
```
</verification>

<success_criteria>
- 5 个 `.en.json` 文件创建完成，各保留原角色风格英文表达
- config.json 支持 `"language": "en"` 字段
- loadCharacter 在 lang='en' 时加载 .en.json，lang 缺失/='zh' 时行为与之前完全一致
- leijun.en.json 保留 "Are U OK?" 标志性梗
- 全量测试通过（npm test），typecheck 通过
</success_criteria>

<output>
完成后创建 `.planning/quick/260404-suh-vocab/260404-suh-SUMMARY.md`
</output>

<!-- /autoplan restore point: /Users/tony/.gstack/projects/tonylt-code-cheer/feat-v3.1.0-open-source-release-autoplan-restore-20260404-210314.md -->

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|---------|
| 1 | CEO | 前提全部有效，无挑战 | Mechanical | P6 | 前提逻辑一致，无矛盾 | 无 |
| 2 | CEO | `.en.json` 后缀方案最优 | Mechanical | P5 | 零 runtime dep，扩展简单 | 内嵌lang key, i18n lib |
| 3 | CEO | 英文 vocab 需求合理（开源发布） | Taste Decision | P1 | 开源可见性，英文 README 存在 | 等待需求验证 |
| 4 | CEO | vocab 漂移检测 → TODOS.md T5 | Mechanical | P3 | 现有 5 文件结构一致；工具集成推迟 | 立即修复 |
| 5 | CEO | locale 自动检测 → TODOS.md T6 | Mechanical | P5 | 明确优于魔法；v3.1.0 先不做 | 立即实现 |
| 6 | Eng | resolveVocabPath 侧效应可接受 | Mechanical | P5 | 私有函数，副作用有限；元组重构复杂度不值得 | 元组方案 |
| 7 | Eng | 错误标签硬编码 → LOW，推迟 | Mechanical | P5 | 用户感知影响极小，非紧急 | 立即修复 |
| 8 | Eng | statusline 集成测试缺口 → TODOS.md T7 | Mechanical | P1 | 完整性要求；4个调用点未测试 | 接受风险 |
| 9 | DX | 无效 language 静默忽略 vs throw | Taste Decision | P5 | 计划明确选择向后兼容；throw 破坏现有用法 | 验证+throw |
| 10 | DX | README language 文档缺失 → HIGH | Mechanical | P1 | 英文用户无法发现功能 | 接受文档债务 |
| 11 | DX | CONTRIBUTING 语言贡献指引缺失 → MEDIUM | Mechanical | P1 | 社区贡献需要指引 | 接受 |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open | vocab 漂移 T5, locale 自动检测 T6, TASTE: 英文需求时机 |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | unavailable (503) | — |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | issues_open | statusline 集成测试 T7, 错误标签 LOW |
| Design Review | skipped | No UI scope | 0 | skipped | — |
| DX Review | `/plan-devex-review` | Developer experience | 1 | issues_open | README 文档 T8, CONTRIBUTING T9, TASTE: 无效值处理 |

**VERDICT:** DONE_WITH_CONCERNS — 技术实现正确 (190/190 测试通过)，3 个 TODOS 需后续处理 (T5/T7/T8)，2 个 TASTE decisions 留给用户确认。

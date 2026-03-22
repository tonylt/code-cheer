# Code Cheer — 设计文档

**日期：** 2026-03-22
**状态：** 待实现

---

## 概述

Code Cheer 是一个 Claude Code 状态栏小工具，由虚拟陪伴师角色驱动，在编程过程中提供鼓励，同时展示用量、模型、额度等信息。

---

## 项目结构

```
code-cheer/
├── statusline.py          # 入口：读配置→选触发→组装输出→打印
├── core/
│   ├── character.py       # 加载角色 meta + 词库 JSON
│   ├── trigger.py         # 三种触发器：随机 / 时段 / 用量
│   └── display.py         # 格式化两行输出
├── vocab/
│   ├── nova.json
│   ├── luna.json
│   ├── mochi.json
│   └── iris.json
├── commands/
│   └── cheer.md           # /cheer 斜杠命令逻辑
├── install.sh             # 一键安装脚本
└── README.md
```

**安装后文件分布：**

```
~/.claude/
├── settings.json                  # 注入 statusLine + PostToolUse hook
├── commands/cheer.md              # 复制自 commands/cheer.md
└── code-cheer/
    ├── config.json                # 当前角色 {"character": "nova"}
    ├── state.json                 # 鼓励语缓存 + 时间戳 + rate tier
    ├── statusline.py              # symlink 或复制
    ├── core/
    └── vocab/
```

---

## 状态栏输出格式

两行固定格式：

```
{ascii} {name}: {message}
{model} | {tokens} tokens | 用量 {pct}% | resets in {resets}
```

**各角色示例：**

```
(*>ω<) Nova: 命令跑完啦！下一个目标，冲！！
sonnet-4-6 | 47k tokens | 用量 32% | resets in 3h20m

(´• ω •`) Luna: 跑完了呢，辛苦啦～
sonnet-4-6 | 47k tokens | 用量 32% | resets in 3h20m

(=^･ω･^=) Mochi: 跑完了嘛… Mochi 看着呢，继续啦
sonnet-4-6 | 47k tokens | 用量 32% | resets in 3h20m

(￣ω￣) Iris: 执行完毕。下一项。
sonnet-4-6 | 47k tokens | 用量 32% | resets in 3h20m
```

---

## 四个角色定义

| 角色 | ASCII | 风格 | 核心语言特征 |
|------|-------|------|------------|
| **Nova 星野**（默认） | `(*>ω<)` | 元气满满，运动系啦啦队 | 连续`！！`，体育术语，永远向前，不犹豫 |
| **Luna 月野** | `(´• ω •\`)` | 温柔治愈，陪伴系 | 句尾`～` `呢` `哦`，关心身体细节，轻声细语 |
| **Mochi 年糕** | `(=^･ω･^=)` | 软萌奶凶，傲娇猫系 | 第三人称自称，`才不是` `呜` `哼` `啦`，半懒半甜 |
| **Iris 晴** | `(￣ω￣)` | 女王御姐，冷静挑逗 | `哦？`开头，反问激将，从不直接夸，意味深长收尾 |

---

## 触发机制

鼓励语更换遵循以下优先级：

| 优先级 | 触发条件 | 触发词库 | 实现方式 |
|--------|---------|---------|---------|
| 1（最高） | 用量突破阈值（80% / 95%） | `usage.warning` / `usage.critical` | 检查 `last_rate_tier` 是否跨级，立即换词 |
| 2 | 每次命令执行完成 | `post_tool` | `PostToolUse` hook 调用 `statusline.py --update`，选 `post_tool` 词条写入缓存 |
| 3 | 时段切换（晨/午/晚/深夜） | `time.{slot}` | 对比当前时段与 `state.json` 中记录的 `last_slot` |
| 4（兜底） | 缓存超过 5 分钟 | `random` | 对比 `last_updated` 时间戳，随机选不重复词条 |

**告警持续行为：** 用量跨入 `warning` 或 `critical` tier 后，只要 tier 未变化，继续沿用缓存中的告警词（优先级 2-4 不覆盖告警状态）。tier 降回 `normal` 时立即切换回正常触发流程。

**`state.json` 结构：**

```json
{
  "message": "命令跑完啦！下一个目标，冲！！",
  "last_updated": "2026-03-22T14:30:00",
  "last_rate_tier": "normal",
  "last_slot": "afternoon"
}
```

- `last_rate_tier`：`normal` / `warning`（≥80%）/ `critical`（≥95%）
- `last_slot`：`morning` / `afternoon` / `evening` / `midnight`，用于时段切换判断（不从时间戳反推）

---

## 词库 JSON 结构

每个角色一个 JSON 文件（以 `nova.json` 为例）：

```json
{
  "meta": {
    "name": "Nova",
    "ascii": "(*>ω<)",
    "style": "元气满满，感叹号连发，运动系加油风"
  },
  "triggers": {
    "random": [
      "今天也要全力以赴，冲冲冲！！",
      "每一行代码都是胜利！GO！！",
      "你就是最强的那个人！！",
      "没有 bug 是永远解决不了的！冲！",
      "代码写起来！状态满分！！",
      "燃起来了吗！今天也要破纪录！！",
      "你的努力终将发光！！继续冲！",
      "全力输出！今天也是最强的一天！！",
      "挑战困难！这才是成长！GO GO！！",
      "不要停下来，胜利就在前方！！",
      "每次 commit 都是新的起点！冲！！",
      "今天的你比昨天更强！！燃起来！"
    ],
    "time": {
      "morning":   ["早安！新的一天，全力冲刺从现在开始！！", "早！状态调整好了吗！今天也要拼！！", "早起的鸟儿有代码！冲冲冲！！", "新的一天！昨天的 bug 今天全部干掉！！"],
      "afternoon": ["下午也要保持这个状态！别松懈！！", "午后时光，代码继续燃起来！！", "下午茶？不，是下午冲冲冲！！", "状态最佳时段，现在就是！全力输出！！"],
      "evening":   ["晚上了还在敲代码，你太燃了！！", "夜晚的代码有魔力！继续冲！！", "晚上的专注力给满分！GO！！", "日落了但你没有停，这就是差距！！"],
      "midnight":  ["深夜还在战斗！你是最燃的夜猫子！！", "凌晨了！但代码还在等你！冲！！", "深夜 coding 俱乐部，你是会员！！", "没人能阻止你，连睡意也不行！！"]
    },
    "usage": {
      "warning":  ["额度用了 80%！最后冲刺，GO GO GO！！", "80% 了！把剩下的用在刀刃上！冲！！", "快到限额！这是决赛圈，全力以赴！！"],
      "critical": ["快撑不住了！但你已经超厉害了！！", "额度告急！把最重要的事做完！冲！！", "最后冲刺！用最后的额度创造奇迹！！"]
    },
    "post_tool": [
      "命令跑完啦！下一个目标，冲！！",
      "✓ 成功！继续保持这个势头！！",
      "又一个完成！积小胜为大胜！！",
      "跑完了！不停歇，继续下一关！！",
      "执行成功！你的节奏太稳了！！",
      "干净利落！这就是你的风格！！",
      "✓ 又拿下一个！势不可挡！！",
      "继续冲！今天的成就等着你！！"
    ]
  }
}
```

其余三个角色（`luna.json` / `mochi.json` / `iris.json`）结构相同，词条对应各自语言风格。

**Luna 词条风格示例（random）：**
今天也在认真工作呢～ / 有什么难的地方，慢慢来哦～ / 写代码很累吧，你真的很努力～ / 不用着急，一步一步就好呢～ / 记得偶尔抬头看看窗外哦～ / 每一行代码都有你的心血呢～ / 不管结果怎样，过程你很棒哦～ / 有我在呢，不用一个人扛着哦～ / 写到这里已经很厉害了呀～ / 今天辛苦了，要好好休息哦～ / 你写的每一行我都看到了呢～ / 累了就歇一歇，代码不会跑掉的～

**Mochi 词条风格示例（random）：**
Mochi 看了一眼… 勉强还行啦 / Mochi 才不是在关注你呢哼 / 呜… 你还在啊，Mochi 随便看看 / 这个代码嘛… Mochi 觉得凑合啦 / 哼，你终于开始了，Mochi 等好久了 / Mochi 帮你盯着，你放心写吧啦 / 呜呜这个问题好难… 但你能解决啦 / Mochi 觉得你今天… 还可以啦哼 / 哼，Mochi 才不担心你呢，才不是 / Mochi 观察了一下… 表现尚可啦 / 呜，这个 bug 好烦… 但Mochi陪你 / Mochi 勉强承认你今天有进步啦

**Iris 词条风格示例（random）：**
哦？又来了。 / 今天状态怎么样，值得期待吗。 / 还在坚持。倒也出乎意料。 / 进展如何，别让我失望。 / 还没放弃，有点意思。 / 坐下来就能干活，这点不错。 / 遇到麻烦了？有意思。 / 代码不会骗人，你的会。 / 这个点还在写，目的是什么。 / 继续。别自满。 / 还差得远，但方向对了。 / 哦，学会这个了。够用。

---

## `/cheer` 斜杠命令

`commands/cheer.md` 是 Claude Code 的 custom command 文件（prompt 模板），由 Claude 读取后执行。`$ARGUMENTS` 为用户在 `/cheer` 后输入的参数。

**`commands/cheer.md` 逻辑：**

- `$ARGUMENTS` 为空 → Claude 使用 `AskUserQuestion` 工具展示四个角色（含 ASCII 表情和风格说明），用户点选后执行切换
- `$ARGUMENTS` 为有效角色名（nova/luna/mochi/iris）→ 直接切换
- `$ARGUMENTS` 无效 → 提示可用角色列表

**切换步骤（由 Claude 通过 `Bash` 工具执行）：**
1. 写入 `$HOME/.claude/code-cheer/config.json`：`{"character": "<name>"}`
2. 写入空 `state.json` 清除缓存，新角色立即在状态栏出现
3. 用该角色风格回复一条确认语

**切换确认语：**

| 角色 | 确认语 |
|------|--------|
| Nova | `已切换到 Nova！(*>ω<) 准备好了吗！冲冲冲！！` |
| Luna | `已切换到 Luna～ (´• ω •\`) 我会一直陪着你哦～` |
| Mochi | `哼… Mochi 来了啦 (=^･ω･^=) 才不是很期待呢` |
| Iris | `(￣ω￣) 换我了。希望你不会让我失望。` |

---

## `install.sh` 流程

```bash
#!/bin/bash
# 1. 检查 Python 3 可用性（python3 --version）
# 2. 创建 $HOME/.claude/code-cheer/ 目录
# 3. 复制脚本、core/、vocab/ 到 $HOME/.claude/code-cheer/
# 4. 写入默认 config.json：{"character": "nova"}（若已存在则跳过）
# 5. 写入空 state.json
# 6. 安全合并 $HOME/.claude/settings.json：
#    - 若文件不存在：直接创建并写入
#    - 若文件已存在：备份为 settings.json.bak，再用 Python 字段级 merge
#      仅写入 statusLine 和 hooks.PostToolUse 键，已有其他键保持不变
#      若 statusLine 键已存在（用户有其他状态栏配置）：打印警告并跳过，不覆盖
#    - statusLine 值：{"type":"command","command":"python3 $HOME/.claude/code-cheer/statusline.py"}
#    - hooks.PostToolUse 追加（不替换已有条目）：
#      {"command": "python3 $HOME/.claude/code-cheer/statusline.py --update"}
#    - 所有路径使用 $HOME 展开为绝对路径，不使用 ~
# 7. 复制 commands/cheer.md → $HOME/.claude/commands/cheer.md
# 8. 打印安装成功信息（Nova 风格欢迎语）
```

**`--uninstall` 流程：**
1. 从 `settings.json` 中删除 `statusLine` 键（仅当其值指向 code-cheer 时）
2. 从 `hooks.PostToolUse` 中移除 code-cheer 条目（其他条目保持不变）
3. 删除 `$HOME/.claude/commands/cheer.md`
4. 删除 `$HOME/.claude/code-cheer/` 目录
5. 若存在 `settings.json.bak`，提示用户可手动恢复

---

## `statusline.py` 核心逻辑

```python
# 两种运行模式：
# python3 statusline.py          → 渲染输出（Claude Code statusline 调用）
# python3 statusline.py --update → 仅更新 state.json（PostToolUse hook 调用）

def main():
    update_only = "--update" in sys.argv
    config    = load_config()     # config.json
    state     = load_state()      # state.json
    stats     = load_stats()      # ~/.claude/stats-cache.json
    cc_data   = read_stdin_json() # Claude Code 传入 JSON（model, rate_limits）
    character = load_character(config["character"])

    message, tier = resolve_message(character, state, stats, cc_data)

    if message != state["message"] or tier != state["last_rate_tier"]:
        save_state(message, tier)

    if update_only:
        return  # hook 模式只更新缓存

    print(render(character, message, cc_data, stats))
```

**`resolve_message()` 优先级：**

```python
def resolve_message(character, state, stats, cc_data):
    # 安全读取，字段缺失时使用 fallback 值
    rate_limits = cc_data.get("rate_limits", {})
    used_pct = rate_limits.get("used_percentage", 0)  # 缺失时默认 0（不触发告警）
    tier = get_tier(used_pct)  # normal / warning / critical

    # 1. 用量跨级 → 立即触发告警语
    if tier != state["last_rate_tier"]:
        return pick(character["usage"][tier]), tier

    # 告警持续：tier 未变且处于 warning/critical，继续显示缓存告警词
    if tier != "normal":
        return state["message"], tier

    # 2. 缓存未过期（5分钟内）→ 返回缓存
    if not cache_expired(state["last_updated"], minutes=5):
        return state["message"], tier

    # 3. 时段切换 → 时段词（对比 state["last_slot"]，不从时间戳反推）
    slot = get_time_slot()  # 无参数，返回当前时段
    if slot != state.get("last_slot"):
        return pick(character["time"][slot]), tier

    # 4. 兜底随机（不与上条重复）
    return pick_different(character["random"], state["message"]), tier
```

**`get_time_slot()` 时段划分：**
- `morning`：06:00–11:59
- `afternoon`：12:00–17:59
- `evening`：18:00–22:59
- `midnight`：23:00–05:59

**`--update` 模式（PostToolUse hook）：** 调用 `resolve_message()` 但强制走优先级 2（`post_tool` 词库），忽略缓存时间，直接更新 `state.json`。

**数据 fallback 规则：**

| 字段 | 来源 | 缺失时 fallback |
|------|------|----------------|
| `model` | stdin JSON | `"unknown"` |
| `rate_limits.used_percentage` | stdin JSON | `0`（不触发告警） |
| `rate_limits.resets_at` | stdin JSON | 不显示该字段 |
| `today_tokens` | `stats-cache.json`.`dailyModelTokens[today]` | `"N/A"` |

**`stats-cache.json` 相关字段（Claude Code 自动生成）：**

```json
{
  "dailyModelTokens": [
    {
      "date": "2026-03-22",
      "tokensByModel": {
        "claude-sonnet-4-6": 47768
      }
    }
  ]
}
```

`load_stats()` 读取当日条目，累加所有模型 token 数作为 `today_tokens`。文件不存在时返回空字典，所有字段使用 fallback 值。stdin 解析失败（非 JSON 或为空）时，`cc_data` 默认为空字典，脚本不 crash。

---

## 技术选型

| 项目 | 选择 | 原因 |
|------|------|------|
| 运行语言 | Python 3（标准库） | macOS/Linux 预装，无需 pip install |
| 安装脚本 | Bash | 跨平台，无依赖 |
| 词库格式 | JSON | 用户可直接编辑，无需改代码 |
| 角色配置 | `$HOME/.claude/code-cheer/config.json` | 持久化，与斜杠命令联动 |
| 状态缓存 | `$HOME/.claude/code-cheer/state.json` | 避免状态栏频繁闪烁换词 |
| 数据来源 | Claude Code stdin JSON + stats-cache.json | 官方数据，无需额外 API |
| 路径规范 | 全部使用 `$HOME` 绝对路径 | `~` 在 Claude Code 内部调用时可能不展开 |

**Claude Code `statusLine` 配置格式**（基于 Claude Code v2.1.80+ 规范）：

```json
"statusLine": {
  "type": "command",
  "command": "/Users/yourname/.claude/code-cheer/statusline.py"
}
```

`install.sh` 写入时使用 Python 解析 `$HOME` 为绝对路径后填入，不使用 `~`。

# 切换 code-cheer 应援角色（nova / luna / mochi / iris / rex）
# v3.0+: install with `npm run setup` (TypeScript version)
# Writes version field to config.json; displays git commit stats from state.json if commits_today > 0
ARGUMENT="$ARGUMENTS"

If ARGUMENT is "xiaomi", treat it as "rex".

If ARGUMENT is empty, use AskUserQuestion with these 2 options (first-level menu):
- label "切换角色"  description "Nova / Luna / Mochi / Iris / Rex"
- label "设置城市"  description "设置天气显示城市，或恢复 IP 自动定位"

If user selects "设置城市":
  - Ask a follow-up AskUserQuestion: "请输入城市名（英文，如 Beijing / Shanghai / Tokyo），或选择清除" with options:
    - label "清除" description "删除 city 设置，恢复 IP 自动定位"
    - label "↩ 返回" description "回到上级菜单"
  - The tool will append an "Other" option for the user to type a city name.
  - Read ~/.claude/code-cheer/config.json to get current config (keep character and other fields).
  - If user selected "↩ 返回": re-show the first-level menu (re-run the initial AskUserQuestion with "切换角色" / "设置城市" options). Stop here.
  - If user selected "清除": write config back without the city field.
  - If user typed a city name: write config back with "city": "<typed value>".
  - Reply: "已设置城市为 <city>，下次 Claude 回复后生效。" or "已清除城市设置，将使用 IP 自动定位。"
  - Stop here (do not proceed to character switching logic).

If user selects "切换角色", show a second AskUserQuestion with these 4 options:
- label "Nova"    description "(*>ω<) 元气满满，运动系啦啦队"
- label "Luna"    description "(´• ω •`) 温柔治愈，陪伴系"
- label "Mochi"   description "(=^･ω･^=) 软萌奶凶，傲娇猫系"
- label "Iris"    description "(￣ω￣) 女王御姐，冷静挑衅"

The tool will automatically append an "Other" option. If the user selects Other and types "rex" or "xiaomi", treat it as rex. If the user selects Other and types "返回", re-show the first-level menu (re-run the initial AskUserQuestion with "切换角色" / "设置城市" options) and stop here.

If ARGUMENT is not a valid character, reply: "可用角色：nova / luna / mochi / iris / rex"

Once a character is chosen (NAME = lowercase chosen name):

First, read ~/.claude/code-cheer/state.json (if it exists) using the Read tool to capture the current commits_today value before resetting state.

Then read ~/.claude/code-cheer/config.json to get the current city field (if any), so it is preserved in the rewrite.

Then run a single Bash command that writes config.json preserving the city field if present:
  - If city is present: python3 -c "import os; open(os.path.expanduser('~/.claude/code-cheer/config.json'),'w').write('{\"character\": \"NAME\", \"version\": \"3.1.0\", \"city\": \"CITY\"}')"
  - If city is absent:  python3 -c "import os; open(os.path.expanduser('~/.claude/code-cheer/config.json'),'w').write('{\"character\": \"NAME\", \"version\": \"3.1.0\"}')"
Also reset state in the same command: open(os.path.expanduser('~/.claude/code-cheer/state.json'),'w').write('{\"message\":\"\",\"last_updated\":\"\",\"last_rate_tier\":\"normal\",\"last_slot\":null}')

If the state.json read above contained "commits_today" with a value > 0, append a stats line after the character reply message.

Stats line format (append on a new line after the reply):
- commits_today between 1-3:  "今天已经提交了 {N} 次，继续保持！"
- commits_today between 4-9:  "今天已经提交了 {N} 次！手感不错嘛！"
- commits_today >= 10:        "今天已经提交了 {N} 次！！太强了吧！"

If state.json does not exist, is unreadable, or commits_today is 0/missing/not a number, do NOT append any stats line — just use the character reply as-is.

Then reply:
- nova:   已切换到 Nova！(*>ω<) 准备好了吗！冲冲冲！！
- luna:   已切换到 Luna～ (´• ω •`) 我会一直陪着你哦～
- mochi:  哼… Mochi 来了啦 (=^･ω･^=) 才不是很期待呢
- iris:   (￣ω￣) 换我了。希望你不会让我失望。
- rex:   同学！(^▽^ゞ Rex 来了！Are U OK？！今天我们一起创造历史！

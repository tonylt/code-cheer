# 切换 code-pal 应援角色（nova / luna / mochi / iris / leijun）
# v3.0+: install with `npm run setup` (TypeScript version)
# Writes version field to config.json; displays git commit stats from state.json if commits_today > 0
ARGUMENT="$ARGUMENTS"

If ARGUMENT is empty, use AskUserQuestion with these 4 options:
- label "Nova"    description "(*>ω<) 元气满满，运动系啦啦队"
- label "Luna"    description "(´• ω •`) 温柔治愈，陪伴系"
- label "Mochi"   description "(=^･ω･^=) 软萌奶凶，傲娇猫系"
- label "Iris"    description "(￣ω￣) 女王御姐，冷静挑衅"

The tool will automatically append an "Other" option. If the user selects Other and types "leijun" or "雷总", treat it as leijun.

If ARGUMENT is not a valid character, reply: "可用角色：nova / luna / mochi / iris / leijun"

Once a character is chosen (NAME = lowercase chosen name), run a single Bash command:
  python3 -c "import os; open(os.path.expanduser('~/.claude/code-pal/config.json'),'w').write('{\"character\": \"NAME\", \"version\": \"3.0.0\"}'); open(os.path.expanduser('~/.claude/code-pal/state.json'),'w').write('{\"message\":\"\",\"last_updated\":\"\",\"last_rate_tier\":\"normal\",\"last_slot\":null}')"

After switching, read ~/.claude/code-pal/state.json (if it exists) using the Read tool.
If the file exists and contains "commits_today" with a value > 0, append a stats line after the character reply message.

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
- leijun: 朋友们！(^▽^ゞ 雷总来了！Are U OK？！今天我们一起创造历史！

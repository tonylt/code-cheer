# 切换 code-pal 应援角色（nova / luna / mochi / iris）
# v3.0+: install with `npm run setup` (TypeScript version)
ARGUMENT="$ARGUMENTS"

If ARGUMENT is empty, use AskUserQuestion with these 4 options:
- label "Nova"  description "(*>ω<) 元气满满，运动系啦啦队"
- label "Luna"  description "(´• ω •`) 温柔治愈，陪伴系"
- label "Mochi" description "(=^･ω･^=) 软萌奶凶，傲娇猫系"
- label "Iris"  description "(￣ω￣) 女王御姐，冷静挑衅"

If ARGUMENT is not a valid character, reply: "可用角色：nova / luna / mochi / iris"

Once a character is chosen (NAME = lowercase chosen name), run a single Bash command:
  python3 -c "import os; open(os.path.expanduser('~/.claude/code-pal/config.json'),'w').write('{\"character\": \"NAME\"}'); open(os.path.expanduser('~/.claude/code-pal/state.json'),'w').write('{\"message\":\"\",\"last_updated\":\"\",\"last_rate_tier\":\"normal\",\"last_slot\":null}')"

Then reply:
- nova:  已切换到 Nova！(*>ω<) 准备好了吗！冲冲冲！！
- luna:  已切换到 Luna～ (´• ω •`) 我会一直陪着你哦～
- mochi: 哼… Mochi 来了啦 (=^･ω･^=) 才不是很期待呢
- iris:  (￣ω￣) 换我了。希望你不会让我失望。

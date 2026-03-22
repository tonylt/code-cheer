Switch the Code Cheer companion character.

Available characters: nova, luna, mochi, iris

The user typed: $ARGUMENTS

**Instructions:**

If $ARGUMENTS is empty:
  Use the AskUserQuestion tool to present the 4 characters as options. Each option label should be the character name, and the description should include their ASCII face and style summary:
  - Nova (*>ω<): 元气满满，运动系啦啦队
  - Luna (´• ω •`): 温柔治愈，陪伴系
  - Mochi (=^･ω･^=): 软萌奶凶，傲娇猫系
  - Iris (￣ω￣): 女王御姐，冷静挑逗

If $ARGUMENTS is one of [nova, luna, mochi, iris]:
  Switch to that character directly.

If $ARGUMENTS is anything else:
  Reply: "可用角色：nova / luna / mochi / iris\n用法：/cheer nova"

**To switch a character, use the Bash tool to run these two commands**
(replace CHOSEN_NAME with the selected character name in lowercase):

    echo '{"character": "CHOSEN_NAME"}' > $HOME/.claude/code-cheer/config.json
    echo '{"message":"","last_updated":"","last_rate_tier":"normal","last_slot":null}' > $HOME/.claude/code-cheer/state.json

**After switching, reply with the character's confirmation message:**
- nova: 已切换到 Nova！(*>ω<) 准备好了吗！冲冲冲！！
- luna: 已切换到 Luna～ (´• ω •`) 我会一直陪着你哦～
- mochi: 哼… Mochi 来了啦 (=^･ω･^=) 才不是很期待呢
- iris: (￣ω￣) 换我了。希望你不会让我失望。

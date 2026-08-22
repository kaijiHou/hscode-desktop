#!/usr/bin/env bash
# HSCode: 在 Windows（core.symlinks=false）上，把 git 符号链接实体化为真实文件拷贝。
# 仅为让本地构建/运行可用；这些实体化文件不应作为逻辑改动提交。
set -u
cd /d/hscode

ok=0; miss=0; bad=0
while IFS= read -r link; do
  [ -z "$link" ] && continue
  # 符号链接文件内容 = 目标相对路径
  target="$(cat "$link" 2>/dev/null)"
  if [ -z "$target" ]; then
    echo "BAD  $link (无内容)"
    bad=$((bad+1)); continue
  fi
  link_dir="$(dirname "$link")"
  # 相对于链接所在目录解析
  resolved="$(cd "$link_dir" 2>/dev/null && cd "$(dirname "$target")" 2>/dev/null && pwd)/$(basename "$target")"
  if [ -e "$resolved" ]; then
    rm -f "$link"
    cp "$resolved" "$link" && { ok=$((ok+1)); } || { echo "CPFAIL $link"; bad=$((bad+1)); }
  else
    echo "MISS $link -> $resolved"
    miss=$((miss+1))
  fi
done < <(git ls-files -s | awk '$1==120000 {print $4}')

echo ""
echo "实体化成功: $ok ; 目标缺失: $miss ; 异常: $bad"

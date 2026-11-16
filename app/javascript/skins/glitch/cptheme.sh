#!/bin/bash
# Usage: ./cptheme.sh <name>
# Creates <name>-default (default font) and <name>2-default (Splat2K font)
# skins using app/javascript/images/bg_<name>.webp, based on the splatoween skins.
# Edit the generated names.yml labels afterwards.
set -euo pipefail
cd "$(dirname "$0")"

for suffix in '' 2; do
  src="splatoween${suffix}-default"
  dst="${1}${suffix}-default"
  cp -r "$src" "$dst"
  sed -i "s/splatoween/$1/g" "$dst"/common.scss "$dst"/theme.yml "$dst"/names.yml
done

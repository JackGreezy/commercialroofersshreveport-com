#!/usr/bin/env bash
set -euo pipefail
ROOT=/Users/jackgreenberg/Desktop/rank-and-rent
S=$ROOT/David/clones/scripts
PROJ=$ROOT/commercial-roofing/commercialroofersshreveport-com
REFHOST=big-d-com
VOICE=$S/voice/commercial-roofing.json
PAGES="home=https://www.big-d.com/,about=https://www.big-d.com/about,contact=https://www.big-d.com/contact,index=https://www.big-d.com/projects,slug=https://www.big-d.com/projects/fmi-morenci-mine-heap-leach-stacking-equipment"
CFG=$PROJ/home.config.json
MAP=$S/relabel-map-$REFHOST.json
CAP=$ROOT/David/clones/_captures/$REFHOST-v1

[ -f "$CFG" ] || { echo "MISSING $CFG"; exit 1; }
[ -f "$MAP" ] || { echo "MISSING $MAP"; exit 1; }
if [ ! -f "$CAP/public/home.html.ref" ]; then
  node "$S/faithful-home.mjs" --no-scripts --src "https://www.big-d.com/" --pages "$PAGES" --dir "$CAP"
fi
mkdir -p "$PROJ/public"
cp "$CAP"/public/*.html.ref "$PROJ/public/" 2>/dev/null || true
[ -d "$PROJ/public/assets-f" ] || cp -R "$CAP/public/assets-f" "$PROJ/public/"
mkdir -p "$PROJ/qa-out"
cp "$CAP"/qa-out/ref-*.png "$PROJ/qa-out/" 2>/dev/null || true
python3 "$S/normalize_content.py" "$PROJ" --voice "$VOICE"
python3 - "$PROJ" <<'PY'
import shutil, sys, os
p = sys.argv[1]
src, dst = os.path.join(p, 'public/images'), os.path.join(p, 'public/ours')
if os.path.isdir(src): shutil.copytree(src, dst, dirs_exist_ok=True)
PY
python3 "$S/relabel_engine.py" --config "$CFG" --map "$MAP" --voice "$VOICE"
python3 "$PROJ/scripts/normalize-contact-forms.py" "$PROJ"
python3 "$S/verify_site.py" "$PROJ" --map "$MAP" --json "$PROJ/qa-out/verify.json"
node "$S/qa_shots.mjs" "$PROJ"
echo "BUILD COMPLETE — gates green. Human QA: open $PROJ/qa-out/CONTACT-SHEET.html"

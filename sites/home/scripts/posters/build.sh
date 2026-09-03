#!/bin/sh
# Rebuild every clip's poster and blur-up placeholder. Run after replacing
# any file in public/assets/videos:  sh scripts/posters/build.sh
set -e
cd "$(dirname "$0")/../.."
[ -x scripts/posters/extract ] || xcrun swiftc -O scripts/posters/extract.swift -o scripts/posters/extract
mkdir -p public/assets/videos/posters
for f in public/assets/videos/*.mp4; do
  n=$(basename "$f" .mp4)
  scripts/posters/extract "$f" "public/assets/videos/posters/$n.full.jpg"
done
python3 scripts/posters/finish.py

#!/bin/bash
# This script is used to optimize the images and svg files in the res/ directory.

# Deps
xbps-install -Sy ImageMagick yarn > /dev/null
yarn global add svgo

# Optimize images
find res/ -type f -name '*.png' -exec convert {} -strip {} \;

# Optimize svg
svgo res/*.svg

# Check if any files were modified
git config --global user.email "github-actions[bot]@users.noreply.github.com"
git config --global user.name "github-actions[bot]"
git add res > /dev/null
git diff-index --quiet HEAD
if [ "$?" == "1" ]; then
  git commit -m "[ci-skip] Optimize resource files." > /dev/null
  git push > /dev/null
else
  echo "No icon files were modified."
fi
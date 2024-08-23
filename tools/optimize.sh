#!/bin/bash

# Deps
sudo apt-get update > /dev/null
sudo apt-get install -y imagemagick yarn > /dev/null
yarn global add svgo > /dev/null

# Functions
regenerate()
{
  echo "Generating assets for $1"

  # Optimize the SVG file
  svgo --multipass --quiet "$1"

  # Convert to PNG
  convert -background none "$1" "${1%.*}.png"

  # Convert to ICO
  # https://stackoverflow.com/a/15104985
  convert -background transparent -define "icon:auto-resize=16,24,32,64,128,256" "$1" "${1%.*}.ico"
}

regenerate "res/logo.svg"

# Check if any files were modified
git config --global user.email "github-actions[bot]@users.noreply.github.com"
git config --global user.name "github-actions[bot]"
git add res > /dev/null
git diff-index --quiet HEAD
if [ "$?" == "1" ]; then
  git commit -m "[ci-skip] Regenerate resource files." > /dev/null
  git push > /dev/null
else
  echo "No resource files were modified."
fi
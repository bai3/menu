#!/bin/sh
set -eu
cd "$(git rev-parse --show-toplevel)"
git config --local core.hooksPath .githooks
printf '%s\n' 'Git hooks enabled for this repository.'

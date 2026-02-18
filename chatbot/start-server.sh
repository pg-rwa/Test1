#!/bin/bash
# Keep-alive wrapper for the Next.js server
cd "$(dirname "$0")"

export NODE_ENV=production

while true; do
  echo "[$(date)] Starting Next.js server..."
  npx next start -p 3000 -H 0.0.0.0 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE. Restarting in 2s..."
  sleep 2
done

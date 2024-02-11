#!/bin/sh

while :
do
  pnpm start || true

  echo "Waiting..."

  # wait 1 minute
  sleep 60
done
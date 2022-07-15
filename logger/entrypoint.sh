#!/bin/sh

while :
do
  yarn build || true

  echo "Waiting..."

  # wait 1 minute
  sleep 60
done
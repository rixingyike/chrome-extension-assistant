#!/bin/bash
# https://github.com/codegangsta/gin
# go run main.go weixin-micro-app.go  -init=true
# a = go prom port, p = web port

# go get github.com/codegangsta/gin
# export GO111MODULE=on
# go mod download
# ./dev.sh
gin -a 8090 -p 8080 run main.go
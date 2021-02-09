#!/bin/bash

set -x

npm install -g n
n 10
npm install -g npm@6

# Install latest pm2
npm install -g pm2
#!/bin/bash

set -x

npm install -g n
n 12
npm install -g npm@6

# Install latest pm2
npm install -g pm2

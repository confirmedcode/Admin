#!/bin/bash

export NODE_ENV=production

set -x

cd /home/node/admin
env PATH=$PATH:/usr/local/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u node --hp /home/node
pm2 delete all
pm2 start index.js --merge-logs --log ../logs/app.log

pm2 save

# Install latest pm2
npm install pm2@latest -g

pm2 update

#!/bin/bash

export NODE_ENV=production

cd /home/node/admin
pm2 updatePM2 # pick up new node version if we upgraded
pm2 delete all
pm2 start index.js --merge-logs --log ../logs/app.log
pm2 save
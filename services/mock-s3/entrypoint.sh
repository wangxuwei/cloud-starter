#!/bin/sh

# Start the rustfs server as background
rustfs /data

# Cheap way to wait the server is started (since we start it as background)
sleep 5s

# Create the rustfs alias pointing to this server
mc alias set rustfs http://localhost:9000 rustfsadmin rustfsadmin --api S3v4

# ----
# Seeding the buckets for dev and set them download (no sign in rustfs/dev environment)
# Prod will use aws s3 buckets
mc anonymous set download rustfs/core-bucket
mc anonymous set download rustfs/logs-bucket


# wait forever
tail -f /dev/null
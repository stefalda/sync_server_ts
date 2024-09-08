# Build the docker images
#docker build --platform linux/amd64 -t sync_server:latest .
docker build -t sync_server:latest .
#exit 0
#Now push to the privare repository
docker login --username ste docker.sfalda.com
docker tag sync_server:latest docker.sfalda.com/sync_server
docker push docker.sfalda.com/sync_server

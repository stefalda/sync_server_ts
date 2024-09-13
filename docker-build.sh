# Build the docker images
docker build --platform linux/amd64 -t sfalda/sync_server:latest .
#docker build -t sync_server:latest .
#Now push to the privare repository
#docker login --username ste docker.sfalda.com
docker push sfalda/sync_server:latest

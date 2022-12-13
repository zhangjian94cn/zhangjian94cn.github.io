
mkdir tmp && cp Dockerfile tmp && cd tmp

# docker build . \
#     --build-arg "HTTP_PROXY=http://127.0.0.1:7890/" \
#     --build-arg "HTTPS_PROXY=http://127.0.0.1:7890/" \
#     --build-arg "NO_PROXY=localhost,127.0.0.1,.example.com" \
#     -t ssh-image

docker build . -t ssh-image

docker run -itd \
    -p 50001:22 \
    --name="ssh-container" \
    --cap-add=NET_ADMIN \
    --cap-add=SYS_ADMIN \
    --device=/dev/net/tun \
    -v /home/share:/home \
    -v /var/lib/lxcfs/proc/cpuinfo:/proc/cpuinfo:rw \
    -v /var/lib/lxcfs/proc/diskstats:/proc/diskstats:rw \
    -v /var/lib/lxcfs/proc/meminfo:/proc/meminfo:rw \
    -v /var/lib/lxcfs/proc/stat:/proc/stat:rw \
    -v /var/lib/lxcfs/proc/swaps:/proc/swaps:rw \
    -v /var/lib/lxcfs/proc/uptime:/proc/uptime:rw \
    --memory=4g \
    --cpus=4 \
    --cpuset-cpus="0-3" \
    ssh-image \
    /bin/bash

docker update --restart=always ssh-container

# 
docker build . -t zerotier-image:service

docker run -itd \
    -p 50002:22 \
    --name="zerotier-container" \
    --cap-add=NET_ADMIN \
    --cap-add=SYS_ADMIN \
    --device=/dev/net/tun \
    -v /home/share:/home \
    -v /var/lib/lxcfs/proc/cpuinfo:/proc/cpuinfo:rw \
    -v /var/lib/lxcfs/proc/diskstats:/proc/diskstats:rw \
    -v /var/lib/lxcfs/proc/meminfo:/proc/meminfo:rw \
    -v /var/lib/lxcfs/proc/stat:/proc/stat:rw \
    -v /var/lib/lxcfs/proc/swaps:/proc/swaps:rw \
    -v /var/lib/lxcfs/proc/uptime:/proc/uptime:rw \
    --memory=8g \
    --cpus=4 \
    --cpuset-cpus="0-3" \
    zerotier-image:service \
    /bin/bash

docker update --restart=always zerotier-container

docker stop zerotier-container && docker container prune && docker image rm zerotier-image:service
docker exec -it zerotier-container /bin/bash
zerotier-cli join 83048a0632be90f0
export user=zhangjian && adduser $user && usermod -aG sudo $user
export user=jiana && adduser $user && usermod -aG sudo $user
export user=jiaming && adduser $user && usermod -aG sudo $user
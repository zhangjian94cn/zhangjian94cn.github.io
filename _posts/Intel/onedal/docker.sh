docker run -it \
-p 8023:22 \
--ipc=host  \
--pid=host \
--cap-add=SYS_ADMIN \
--cap-add=NET_ADMIN \
--cap-add=SYS_PTRACE \
--device=/dev/dri \
--device=/dev/net/tun \
--security-opt \
seccomp=unconfined \
--name="oneapi" \
-v /home/container/oneapi:/home/**  \
oneapi /bin/bash




FROM ubuntu:22.04

RUN apt-get update --fix-missing && apt-get install openssh-server htop gnupg vim curl sudo -y

RUN export user=zhangjian && adduser $user && usermod -aG sudo $user

# ENTRYPOINT service ssh restart && bash

# RUN curl https://install.zerotier.com/ | bash 

# RUN curl -s 'https://raw.githubusercontent.com/zerotier/ZeroTierOne/master/doc/contact%40zerotier.com.gpg' | gpg --import && \
# if z=$(curl -s 'https://install.zerotier.com/' | gpg); then echo "$z" | sudo bash; fi
# RUN /usr/sbin/zerotier-one -d && /usr/sbin/zerotier-cli join 83048a0632be90f0

# ENTRYPOINT service zerotier-one restart && bash

FROM zerotier-image
ENTRYPOINT service ssh restart && service zerotier-one restart && bash


#!/bin/bash

# open vnc server
vncserver -localhost no :1

# wake up qnap nas
wakeonlan 24:5E:BE:69:6D:3D

# 设置要操作的Docker容器的名称或ID
CONTAINER_NAME_OR_ID="emby"

# 关闭Docker容器
docker stop $CONTAINER_NAME_OR_ID

# 命令将在当前时间的10分钟后执行
TIME_TO_RUN=$(date -d '+1 minutes' +%H:%M)

# 设置要运行的命令（这里用ls命令作为示例）
COMMAND_TO_RUN="echo zjah | sudo -S mount -a && docker start $CONTAINER_NAME_OR_ID"

# 将命令传递给at命令，安排在10分钟后运行
echo "$COMMAND_TO_RUN" | at "$TIME_TO_RUN"
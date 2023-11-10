---
title: "SSH Connect Docker Container"
layout: post
author: "Zhang Jian"
header-style: text
mathjax: true
tags:
  - dev
  - docker
---


使用crontab -e发现了一个问题，就是有些命令不能成功运行，后来发现是 yarn的相关环境变量没有加进去

nohup: failed to run command 'yarn': No such file or directory
怎么办


这个错误表明在 `cron` 任务执行时无法找到 `yarn` 命令。这可能是由于 `yarn` 不在系统的 PATH 中，或者 `cron` 任务的环境变量设置不包含 `yarn` 的路径。

以下是解决问题的一些建议：

1. **使用绝对路径：**
   确保在 `cron` 任务中使用 `yarn` 命令的绝对路径。你可以使用 `which yarn` 命令找到 `yarn` 的完整路径，然后将其用于 `cron` 任务。

   ```bash
   which yarn
   ```

   然后在 `cron` 中使用找到的路径：

   ```bash
   /path/to/yarn dev > chatgpt.log 2>&1
   ```

2. **设置正确的 PATH：**
   在 `cron` 任务中，`PATH` 变量可能不同于你在终端中的环境。为了确保 `yarn` 可以被找到，你可以在 `cron` 任务中指定完整的 `PATH`。你可以在 `crontab` 文件中设置 `PATH` 变量：

   ```bash
   PATH=/usr/local/bin:/usr/bin:/bin:/path/to/yarn-directory
   * * * * * /path/to/yarn dev > /path/to/chatgpt.log 2>&1
   ```

   确保将 `/path/to/yarn-directory` 替换为实际的 `yarn` 所在的目录。

3. **查找 yarn 所在的目录：**
   如果 `which yarn` 没有返回任何结果，说明 `yarn` 可能没有在系统的 PATH 中。你可以使用以下命令来查找 `yarn` 所在的目录：

   ```bash
   find / -name yarn
   ```

   找到 `yarn` 后，将其路径用于 `cron` 任务。

4. **在脚本中设置完整路径：**
   如果你在一个脚本中运行 `yarn`，确保在脚本中设置完整的 `yarn` 路径。例如，在脚本的顶部添加：

   ```bash
   export PATH=/usr/local/bin:/usr/bin:/bin:/path/to/yarn-directory
   ```

   然后在脚本中使用 `yarn` 时，系统将能够找到正确的路径。

通过上述步骤中的一个或多个，你应该能够解决 `nohup: failed to run command 'yarn': No such file or directory` 的问题。确保在 `cron` 环境中能够正确找到 `yarn` 命令。



查看cron的log


`crontab` 本身并不会生成专门的日志文件，但是系统通常会记录与 `cron` 任务相关的信息。以下是在不同的Linux发行版上查看 `cron` 日志的方法：

### Ubuntu 和 Debian 系统

1. **查看系统日志文件：**
   `cron` 的活动通常被记录在 `/var/log/syslog` 文件中。你可以使用以下命令查看 `cron` 相关的日志：

   ```bash
   cat /var/log/syslog | grep CRON
   ```

   或者

   ```bash
   grep CRON /var/log/syslog
   ```

2. **查看特定用户的 `cron` 日志：**
   如果你的 `cron` 任务是以特定用户身份运行的，你可以查看该用户的 `cron` 日志：

   ```bash
   grep CRON /var/log/syslog | grep username
   ```

### CentOS 和 Red Hat 系统

1. **查看系统日志文件：**
   `cron` 的活动通常被记录在 `/var/log/cron` 文件中。你可以使用以下命令查看 `cron` 相关的日志：

   ```bash
   cat /var/log/cron
   ```

   或者

   ```bash
   less /var/log/cron
   ```

2. **查看特定用户的 `cron` 日志：**
   如果你的 `cron` 任务是以特定用户身份运行的，你可以查看该用户的 `cron` 日志：

   ```bash
   grep username /var/log/cron
   ```

请注意，这些路径和命令可能会因Linux发行版和系统配置而异。如果你的系统有定制的日志配置，你可能需要查看 `/etc/syslog.conf` 或 `/etc/rsyslog.conf` 等配置文件以获取详细信息。

如果你无法找到相关的 `cron` 日志，请检查系统上的日志配置以确定 `cron` 活动的记录位置。
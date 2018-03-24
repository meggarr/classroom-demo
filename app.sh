#!/bin/bash

function usage() {
  echo "Classroom Demo"
  echo
  echo "Usage: $0 <command>"
  echo "Commands"
  echo "  start         Start demo server"
  echo "  stop          Stop demo server"
  echo "  status        Status of demo server"
  exit 1
}

COMMAND="$1"
shift

if [ "$COMMAND" != "start" ] && [ "$COMMAND" != "stop" ] && [ "$COMMAND" != "status" ]; then
  usage
  exit 1
fi

function start() {
  echo Starting demo server ...
  #local _ip_addr=`ip addr | grep 'state UP' -A2 | tail -n1 | awk '{print $2}' | cut -f1  -d'/'`
  local _ip_addr=`hostname -i`

  echo IP Address is ${_ip_addr}

  nohup java -Dopenvidu.secret=myvidu \
      -Dopenvidu.publicurl=https://${_ip_addr}:8443 \
      -Dopenvidu.cdr=true \
      -Dserver.port=8443 \
      -Dkms.uris=[\"ws://${_ip_addr}:8888/kurento\"] \
      -jar ./viduserver.jar </dev/null >./log/viduserver.log 2>&1 &
  sleep 0.5
  local _pid_vidu=`pgrep -f viduserver.jar`
  echo Running Viduserver \(${_pid_vidu}\) ...
  
  echo Preparing application configs ...
  sed -i "s#openvidu.url: .*#openvidu.url: https://${_ip_addr}:8443/#g" ./config/application.properties
  
  nohup java -Djava.security.egd=file:/dev/./urandom \
      -Dspring.config.location=file:./config/ \
      -jar ./classroom.jar </dev/null >./log/app.log 2>&1 &
  sleep 0.5
  local _pid_classroom=`pgrep -f classroom.jar`
  echo Running classroom \(${_pid_classroom}\)...
  
  sleep 0.2
  echo Done-

  echo Demo is at https://${_ip_addr}:5000
  echo
}

function stop() {
  local _pattern="$1"
  local _name=`echo ${_pattern} | cut -d "." -f 1`

  if [ "X${_pattern}" == "X" ]; then
    echo Nothing to stop
  else
    echo -n Stopping ${_name} ...

    local _pid=`pgrep -f ${_pattern}`
    while [ "X${_pid}" != "X" ]; do
      pkill -f ${_pattern}
      sleep 0.1
      _pid=`pgrep -f ${_pattern}`
      echo -n .
    done
    echo
    echo Done-
  fi
}

function status() {
  local _pattern="$1"
  local _name=`echo ${_pattern} | cut -d "." -f 1`

  if [ "X${_pattern}" == "X" ]; then
    echo Nothing to show
  else
    local _pid=`pgrep -f ${_pattern}`
    if [ "X${_pid}" != "X" ]; then
      echo Process ${_name} is running ${_pid}
    else
      echo Process ${_name} is not running
    fi
  fi
}

if [ "$COMMAND" == "start" ]; then
  start
elif [ "$COMMAND" == "stop" ]; then
  stop classroom.jar
  stop viduserver.jar
elif [ "$COMMAND" == "status" ]; then
  status viduserver.jar
  status classroom.jar
fi


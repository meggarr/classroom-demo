#!/bin/bash

DIR=${PWD}

cd ${DIR}
echo
echo Building application resource ...
cd src/angular/frontend
#npm install
ng build --output-path ../../main/resources/static

echo
echo Building application binary ...
cd ../../../
mvn clean package -Dmaven.test.skip=true
cd ${DIR}

echo
echo Packaging tar.gz ...
DIR_TMP=${DIR}/.tmp
DIR_DEMO=${DIR_TMP}/demo
mkdir -p ${DIR_DEMO}/log
cp target/classroom-*.war ${DIR_DEMO}/classroom.jar
cp openvidu-server-1.8.0.jar ${DIR_DEMO}/viduserver.jar
cp app.sh ${DIR_DEMO}/app.sh
cp -r config ${DIR_DEMO}

mkdir -p ${DIR}/build
tar -czvf build/demo.tar.gz -C ${DIR_TMP} demo
rm -rf ${DIR_TMP}

echo Done-

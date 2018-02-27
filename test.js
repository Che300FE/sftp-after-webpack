let SftpKit  = require('./index.js');

let sftpKit = new SftpKit({
    "host": "118.190.91.189",
    "port": "22",
    "username": "bge",
    "password": "bge@che300!",
    "localPath" : ["/Users/miushasha/Documents/gebin/workspace/che300git/sftp-after-webpack/test/index.js",
        "/Users/miushasha/Documents/gebin/workspace/che300git/sftp-after-webpack/test/index2.js"],
    "remotePath": "/home/webserver/static/fezz.che300.com/sftp-kit/"
})
//
sftpKit.upload();
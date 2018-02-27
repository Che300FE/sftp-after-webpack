/**
 * sftp指定路径和文件上传
 * 1）文件夹上传
 * 2）文件上传
 * 3）支持多文件、文件夹上传
 * 4）文件类型控制
 */

let Client = require("ssh2-sftp-client");
let sftp = new Client();
let fs = require("fs");
let path = require("path");

/**
 *
 * @param {本地文件夹路径} localDir
 * @param {文件夹} dirs
 * @param {文件} files
 */
function GetFileAndDirList(localDir, dirs, files) {
    var rootStat = fs.statSync(localDir);
    if(!rootStat.isDirectory()){
        files.push(localDir);
        return;
    }

    var dir = fs.readdirSync(localDir);
    for (var i = 0; i < dir.length; i++) {
        var p = path.join(localDir, dir[i]);
        var stat = fs.statSync(p);
        if (stat.isDirectory()) {
            dirs.push(p);
            GetFileAndDirList(p, dirs, files);
        } else {
            files.push(p);
        }
    }
}

function upload(options, localDirs) {
    let remotePath = options.remotePath;
    if (/\/$/.test(remotePath)) {
        remotePath = remotePath.substr(0, remotePath.lastIndexOf("/"));
    }

    sftp
        .connect(options)
        .then(() => {
            // return sftp.list('/home');
            sftp.mkdir(remotePath, true);
            let dirs = [],
                files = [];
            let localType = 'dir';
            
                    
            let localStat = fs.statSync(localDirs);
            if(!localStat.isDirectory()){
                localType = 'file';
            }

            GetFileAndDirList(localDirs, dirs, files);

            console.log(localDirs);
            console.log(dirs);
            console.log(files);


            for (let i = 0; i < dirs.length; i++) {
                let dir = dirs[i];
                dir = dir.substr(localDirs.length).replace(/\\/g, "/");
                sftp.mkdir(`${remotePath}${dir}`, true);
            }

            for (let index = 0; index < files.length; index++) {
                let file = files[index];
                if(localType == 'dir'){
                    file = file.substr(localDirs.length).replace(/\\/g, "/");
                }else{
                    file = '/'+file.split('/')[file.split('/').length-1];
                }
                console.log(file);
                sftp
                    .put(files[index], `${remotePath}${file}`, true)
                    .then(() => {
                        console.log(
                            `uploading file ${
                                files[index]
                            }  ====> ${remotePath}${file}`
                        );
                        if (index === files.length - 1) {
                            sftp.end();
                        }
                    });
            }
        })
        .catch(err => {
            sftp.end();
            console.log(err, "connect err");
        });
}

function getOptions() {
    const pageJson = JSON.parse(fs.readFileSync("./package.json"));
    return pageJson["sftp-config"];
}

class SftpKit {
    constructor(options) {
        this.options = options;
    }
    upload() {
        let options = this.options;
        if (!options) {
            options = getOptions();
        }
        const localPath = options.localPath;

        if(localPath && localPath instanceof Array){
            localPath.forEach(function(item,index){
                upload(options, item);
            })
        } else {
            upload(options, localPath);
        }
    }
}
module.exports = SftpKit;
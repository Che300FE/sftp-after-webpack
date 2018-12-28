let PromisePool = require('es6-promise-pool');
let Client = require("ssh2-sftp-client");
let fs = require("fs");
let path = require("path"); 

class  SFTPUtils {
    constructor(options){
        this.poolList = [];
        this.count = 0;
        this.options = options;
        this.concurrency = options.concurrency;
    }

    putCommand(commandFunc){
        let me = this;
        return function(){
            return new Promise(function (resolve, reject) {
                let sftp = new Client();
                sftp.connect(me.options)
                    .then(() => {
                        return commandFunc(sftp,resolve);
                    }) 
                    .catch(err => {
                        reject(err);
                        sftp.end();
                        console.log(err, "connect err");
                    });
            })
        }
    }

    mkdirCommand(dirPath,sftp,resolve){
        let me = this;
        return sftp.mkdir(dirPath, true).then(() => {
                resolve()
                sftp.end();
            }).catch(function(err){
                resolve()
                sftp.end();
            });
    }
    
    putFileCommand(filePath,remotePath,sftp,resolve){
        let me = this;
        return sftp
            .put(filePath, remotePath, true)
            .then(() => {
                console.log(
                    `uploading file ${
                        filePath
                    }  ====> ${remotePath}`
                ); 
            }).then(() => {
                resolve();
                sftp.end();
            }).catch(function(){
                resolve()
                sftp.end();
            });
    }
    
    sendFileProducer() {
        let me = this;
        if(me.count >= me.poolList.length-1){
            return null;
        } else {
            me.count++;
            return me.poolList[me.count]();      
        }
    }

    GetFileAndDirList(localDir, dirs, files) {
        let me = this;
        var dir = fs.readdirSync(localDir);
        for (var i = 0; i < dir.length; i++) {
            var p = path.join(localDir, dir[i]);
            var stat = fs.statSync(p);
            if (stat.isDirectory()) {
                dirs.push(p);
                me.GetFileAndDirList(p, dirs, files);
            } else {
                files.push(p);
            }
        }
    }

    uploadByPromisePool(localDirs){
        let me = this;
        let options = me.options;
        let remotePath = options.remotePath;
        if (/\/$/.test(remotePath)) {
            remotePath = remotePath.substr(0, remotePath.lastIndexOf("/"));
        } 
        
        me.poolList.push(me.putCommand(function(sftp,resolve){
            return me.mkdirCommand(remotePath,sftp,resolve);
        }))
        
        let dirs = [],
            files = [];

        if(Object.prototype.toString.call(localDirs) === '[object Array]'){
            localDirs.forEach(item => {
                me.GetFileAndDirList(item, dirs, files);
            });
        } else if(Object.prototype.toString.call(localDirs) === '[object String]'){
            me.GetFileAndDirList(localDirs, dirs, files);
        }

        console.log(dirs,files)
        
        for (let i = 0; i < dirs.length; i++) {
            let dir = dirs[i];
            dir = dir.substr(localDirs.length).replace(/\\/g, "/");
            // console.log('!!!',`${remotePath}${dir}`)
            me.poolList.push(me.putCommand(function(sftp,resolve){
                return me.mkdirCommand(`${remotePath}${dir}`,sftp,resolve);
            }))
        }
    
        for (let index = 0; index < files.length; index++) {
            let file = files[index];
            file = file.substr(localDirs.length).replace(/\\/g, "/");
            // 
            me.poolList.push(me.putCommand(function(sftp,resolve){
                return me.putFileCommand(files[index],`${remotePath}${file}`,sftp,resolve);
            }))
        }
    
        // The number of promises to process simultaneously.
        console.log('me.poolList',me.poolList.length)
    
        // Create a pool.
        var pool = new PromisePool(me.sendFileProducer.bind(me), me.concurrency)
        pool.start().then(function () {
            console.log({"message":"OK"});  
        });
    }
}

class SftpAfterWebpack {
    constructor(options) {
        this.options = options;
        this.pageJson = JSON.parse(fs.readFileSync("./package.json"));
    }
    
    getOptions() {
        let me = this;
        return me.pageJson["sftp-config"];
    }

    apply(compiler) {
        let me = this;
        let options = this.options;
        compiler.plugin("done", function(stats) {
            if (!stats.hasErrors()) {
                if (!options) {
                    options = me.getOptions();
                }
                me.sftpUtils = new SFTPUtils(options);

                const localPath =
                    options.localPath || compiler.options.output.path;
                
                me.sftpUtils.uploadByPromisePool(localPath);
            }
        });
    }
}

module.exports = SftpAfterWebpack;
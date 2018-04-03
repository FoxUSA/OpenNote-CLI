const program = require("caporal");
const PouchDB = require("pouchdb");
const uuidv4 = require("uuid/v4");
const fs = require("fs");
const package_json = require(`${__dirname}/package.json`); // Yes you can do this. Go scream in a stlye gide somewhere if you have a problem with it
const StorageService = require(`${__dirname}/../OpenNote-SharedServices/Storage.service.js`);
const TagService = require(`${__dirname}/../OpenNote-SharedServices/Tag.service.js`);
const CWD = process.cwd()+"/";
const dotOpenNotePath = CWD+".openNote/";
if (typeof localStorage === "undefined" || localStorage === null) {
    var LocalStorage = require("node-localstorage").LocalStorage;
    /*jshint -W020 *///Tell JS to ignore next line
    localStorage = new LocalStorage(dotOpenNotePath);
}

const syncService = require(`${__dirname}/Services/Sync.service.js`)(dotOpenNotePath, localStorage, PouchDB, fs, StorageService, TagService, uuidv4);
const fileService = require(`${__dirname}/Services/File.service.js`)(dotOpenNotePath, localStorage, PouchDB, fs, StorageService);//TODO remove next version


//Error handeling
let logError = (error) => {
    console.error(error);
};

process.on("unhandledRejection", error => {
  console.error(JSON.stringify(error)); //Catch and print out errors we are not catching
});

//Program definition
program .version(package_json.version)
        .description("CLI client for OpenNote");

//Sync command
program .command("sync")
        .description("Sync with CouchDB server")
        .argument("[mode]", "How to handle sync. \"read\" the changes into local db for conflict analysis. \"write\" changes directly to the file system. ", /^read$|^write$/, "read")
        .action((args) => {
            syncService.sync().then(()=>{
                if(args.mode=="write")
                    syncService.makeFiles(CWD);

            }).catch(logError);
        });

//Config command
program .command("config")
        .description("Creates .openNote folder and sets replication url required properties")
        .argument("<url>", "Sync url in the form of {protocol}://{user}:{password}@{url}:{port}/{database}")
        .action((args) => {
            syncService.config(args.url);
        });


//Delta command
program .command("delta")
        .action(() => {
            syncService.delta(CWD).then((data)=>{
                console.log(JSON.stringify(data.delta, null, 4));
            });
        });


//upgrade command //TODO remove in next version
program .command("upgrade")
        .description("Moves files from the legacy opennote php service to s3/Minio file storage. Expects path to uploads.json")
        .option("--jsonPath <jsonPath>", "Path to upload.json. Example: ./uploads.json")//FIXME path aways expects to be relative. If you pass in an absolute one it breaks
        .option("--legacyServiceUrl <legacyServiceUrl>", "Old service url. For example https://example.com")
        .option("--s3Url <s3Url>", "URL of S3 API.")
        .option("--bucket <bucket", "name of S3 bucket")
        .option("--accessKey <accessKey>", "S3 access key")
        .option("--secretKey <secretKey>", "S3 secret key")
        .action((args,options) => {
            fileService.upgrade(    options.legacyServiceUrl,
                                    options.jsonPath,
                                    {
                                        s3URL:options.s3Url,
                                        bucket:options.bucket,
                                        accessKey:options.accessKey,
                                        secretKey:options.secretKey
                                    });
        });

//Save command
program .command("save")
        .description("Save file changes to the local database")
        .action(() => {
            syncService.save(CWD);
        });

//Execute
program.parse(process.argv);//Actually let caporal do its thing

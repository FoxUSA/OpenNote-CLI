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

const syncService = require(`${__dirname}/Services/sync.service.js`)(dotOpenNotePath, localStorage, PouchDB, fs, StorageService, TagService, uuidv4);
let logError = (error) => {
    console.error(error);
};

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



//Save command
program .command("save")
        .action(() => {
            syncService.save(CWD);
        });

//Execute
program.parse(process.argv);//Actually let caporal do its thing

const program = require("caporal");
const PouchDB = require("pouchdb");
const fs = require("fs");
const package_json = require(`${__dirname}/package.json`); // Yes you can do this. Go scream in a stlye gide somewhere if you have a problem with it
const StorageService = require("../OpenNote-SharedServices/storage.service.js");
if (typeof localStorage === "undefined" || localStorage === null) {
    var LocalStorage = require("node-localstorage").LocalStorage;
    /*jshint -W020 *///Tell JS to ignore next line
    localStorage = new LocalStorage("./openNote");
}

const syncService = require(`${__dirname}/Services/sync.service.js`)(localStorage, PouchDB, fs, StorageService);
let logError = (error) => {
    console.error(error);
};

//Global info
program .version(package_json.version)
        .description("CLI client for OpenNote");

//Sync command
program .command("sync")
        .description("Sync with CouchDB server")
        .argument("[mode]", "How to handle sync. \"read\" the changes into local db for conflict analysis. \"write\" changes directly to the file system. ", /^read$|^write$/, "write")
        .action((args) => {
            syncService.sync().then(()=>{
                if(args.mode=="write")
                    syncService.makeFiles(`${__dirname}/testingNotes/`);//FIXME maybe a setup command to figure this path out
                else
                    syncService.returnMap();//FIXME just testing in support of diff method

            }).catch(logError);
        });

//Config command
program .command("config")
        .description("Setup required properties")
        .argument("<url>", "Sync url in the form of {protocol}://{user}:{password}@{url}:{port}/{database}")
        .action((args) => {
            syncService.config(args.url);
        });


//Delta command
program .command("delta")
        .action(() => {
            syncService.delta(`${__dirname}/testingNotes/`);//FIXME
        });

    // TODO push command that acts like git adding and committing a given path

//TODO diff
//TODO save and optinally sync
//Execute
program.parse(process.argv);//Actually let caporal do its thing

//TODO dump id and corisponding(Maybe MD5 or another hash) path map to use when syincing back to server

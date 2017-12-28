module.exports = function(localStorage, PouchDB, fs, StorageService) {
    let storageService = {};

    // //Sillyness because of angular. Acts more like a macro than a function
    // StorageService.call(storageService, localStorage, PouchDB, {
    //     config: {
    //         live: false
    //     },
    //     callback: function(syncObject) {
    //         syncObject.on("complete", function() { //Param info
    //             //makeFiles(`${__dirname}/test/`, storageService.database()); //FIXME should be somewhere else. Also path parameter
    //         }); //.on("error", function(error) {
    //         //     //console.error(`Replication error: ${JSON.stringify(error)}`);
    //         // }).on("paused", function(error) {
    //         //     //console.log(`Replication timeout: ${JSON.stringify(error)}`);
    //         //     if (!replicationTimeout)
    //         //         replicationTimeout = setTimeout(function() {
    //         //             console.log("Replication timeout");
    //         //             replicationTimeout = null;
    //         //         }, 1000);
    //         // }).on("active", function() {
    //         //     //console.log(`Replication active`);
    //         // }).on("denied", function(error) {
    //         //     //console.log(`Replication denied: ${JSON.stringify(error)}`);
    //         // }).on("change", function(info) {
    //         //     //console.log(`Replication change: ${JSON.stringify(info)}`);
    //         //});
    //     }
    // });


    /**
     * Write a database dump to the fs
     * @param  {Map} databaseDump
     */
    let writeDatabase = (databaseDump) => {
        for (let path in databaseDump) //folders need to exist first
            if (path[path.length - 1] == "/")
                if (!fs.existsSync(path))
                    fs.mkdirSync(path);


        for (let path in databaseDump) //Note
            if (path[path.length - 1] != "/")
                fs.writeFileSync(path, databaseDump[path].doc.note);
    };


    /**
     * Dumps a specified database contents to the specified path
     * @param  {[type]} database   - database to dump
     * @param  {[type]} pathPrefix - Path you wish to write to. All path are generated using this prefix
     * @return {Promise}            - Promise with resolver that contains return map
     */
    let dumpDatabase = (database, pathPrefix) => {
        let returnMap = {};
        let promises = [];

        // Function to handle recursive returns from the note tree
        let recursiveAll = (array) => {
            return Promise.all(array).then((result) => {
                if (result.length == array.length) // If no new promises were added, return the result
                    return returnMap;

                return recursiveAll(array); // If new promises were added, re-evaluate the array.
            });
        };

        /**
         * [internalFunction description]
         * @param  {[type]} pathPrefix - prefix where to write output
         * @param  {[type]} folderID   - folder id to load. Null is root node
         */
        let internalFunction = (pathPrefix, folderID) => {
            promises.push(new Promise((resolve, reject) => {
                if (folderID === undefined)
                    folderID = null; // In case it isnt specified
                return database.query("parentFolderID", {
                    key: folderID,
                    include_docs: true
                }).then((items) => {
                    //Create Notes
                    items.rows.filter(storageService.noteFilter).forEach((note) => {
                        let fullPath = `${pathPrefix}${note.doc.title}`;
                        returnMap[fullPath] = note;
                    });

                    //Create folders
                    let folder = items.rows.filter(storageService.folderFilter);
                    folder.forEach((folder) => {
                        let folderPath = `${pathPrefix}${folder.doc.name}/`;
                        returnMap[folderPath] = folder;

                        internalFunction(folderPath, folder.doc._id); //Recursive
                    });

                    return resolve();

                }).catch(reject);
            }));
        };

        internalFunction(pathPrefix); //Start the engine
        return recursiveAll(promises);

    };

    /**
     * [delta description]
     * @param  {[type]} databaseDump - database map
     * @param  {[type]} fsMap        - fs map
     * @return {Map}                 - Map in the form of path and difference note
     */
    let delta = (databaseDump, fsMap)=>{
        let returnArray = {};


        /**
         * Come up with delta map from a and b. Thin ven diagram. Give us the stuff not in the middle.
         * @param  {[type]} a         -
         * @param  {[type]} b         -
         * @param  {[type]} errorText -
         */
        let deltaScanner = (a, b, aText, bText)=>{
            for(let path in a)
                if(!b[path])//Is the path even there?
                    returnArray[path]=`Not in ${bText}`;
                else if((path[path.length-1]!="/" && a[path].doc.note!=b[path].doc.note))
                    returnArray[path]="Differs";
        };

        deltaScanner(databaseDump,fsMap,"db", "fs");//Scan though db
        deltaScanner(fsMap,databaseDump,"fs", "db");//Scan through fs

        return returnArray;
    };

    //TODO
    let scanFS = (path) => {
        return new Promise((resolve, reject) => {
            let i = 0;
            let counter = 1;
            let returnMap = {};
            let internalFunction = (path) => {

                fs.readdir(path, (error, contents) => {
                    if (error)
                        return reject(error);
                    contents.forEach((item)=>{
                        let fullPath = path+item;
                        if(fs.statSync(fullPath).isDirectory()){//Folder
                            returnMap[fullPath+"/"] = {};
                            counter ++;
                            return internalFunction(fullPath+"/");
                        }
                        else{//Files
                            returnMap[fullPath] = {
                                doc:{
                                    note: fs.readFileSync(fullPath).toString()
                                }
                            };
                        }
                    });
                    i++;

                    if(i>=counter)
                        return resolve(returnMap);
                });
            };

            internalFunction(path); //Start the engine
        });
    };

    //TODO
    let init = ()=>{
        return new Promise((resolve, reject) => {
            StorageService.call(storageService, localStorage, PouchDB, {
                config: {
                    live: false
                },
                callback: (syncObject) => {
                    syncObject.on("complete", resolve).on("error", reject);
                }
            });

            //Execute
            storageService.init();
        });
    };

    //Methods we expose
    return {
        // Kick off a sync
        sync: init,

        /**
         * Set config variables.
         * @param  {[type]} url [description]
         */
        config: (url) => { //TODO path parameter for initial path prefix
            StorageService.call(storageService, localStorage); //Init the object
            storageService.setRemoteURL(url);
        },

        /**
         * /Actually dump DB to folder
         * @param  {[type]} pathPrefix - path to write files to
         * @return {[type]}            [description]
         */
        makeFiles: (pathPrefix) => {
            if (!fs.existsSync(pathPrefix))
                fs.mkdirSync(pathPrefix);

            dumpDatabase(storageService.database(), pathPrefix).then((returnMap) => {
                writeDatabase(returnMap);
            });
        },

        delta: (pathPrefix)=>{
            init();
            scanFS(pathPrefix).then((fsMap)=>{
                dumpDatabase(storageService.database(), pathPrefix).then((databaseDump) => {
                    console.log(JSON.stringify(delta(databaseDump, fsMap), null, 4));
                });
            });
        },

        returnMap: () => {
            dumpDatabase(storageService.database(), "/").then((returnMap) => {
                console.log(JSON.stringify(returnMap, null, 4)); //TODO Scan FS and note changes
                //TODO basically make a function that builds a map with the same structure from the file system state and compare them
            });
        }
    };
};

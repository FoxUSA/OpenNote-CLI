//ENUM
const DIFF_TYPES = {
    NOT_IN_FS: "Not in FS",
    NOT_IN_DB: "Not in DB",
    DIFFERS: "Differs"
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
    let deltaScanner = (a, b, errorText)=>{
        for(let path in a)
            if(!b[path])//Is the path even there?
                returnArray[path]=errorText;
            else if((path[path.length-1]!="/" && a[path].doc.note!=b[path].doc.note))
                returnArray[path]=DIFF_TYPES.DIFFERS;
    };

    deltaScanner(databaseDump,fsMap,DIFF_TYPES.NOT_IN_FS);//Scan though db
    deltaScanner(fsMap,databaseDump,DIFF_TYPES.NOT_IN_DB);//Scan through fs

    return returnArray;
};

/**
 * Factory
 * @param  {[type]} dotOpenNotePath [description]
 * @param  {[type]} localStorage    [description]
 * @param  {[type]} PouchDB         [description]
 * @param  {[type]} fs              [description]
 * @param  {[type]} StorageService  [description]
 * @param  {[type]} TagService      [description]
 * @param  {[type]} uuid            [description]
 * @return {[type]}                 - Exposed methods
 */
module.exports = function(dotOpenNotePath,localStorage, PouchDB, fs, StorageService, TagService, uuid) {
    let storageService = {};
    let tagService = {};

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
     * @param  {[type]} pathPrefix - Path you wish to write to. All path are generated using this prefix
     * @return {Promise}            - Promise with resolver that contains return map
     */
    let dumpDatabase = (pathPrefix) => {
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
                return storageService.loadFolderContents(folderID).then((items) => {
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
     * Scan a file system path
     * @param  {[type]} path   - Path to scan
     * @return {Promise}       - When resolved a dump map of the FS in the form of path and data
     */
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

                        if (fullPath==dotOpenNotePath || fullPath==dotOpenNotePath.substring(0,dotOpenNotePath.length-1))
                            return;//Ignore .openNote folder

                        if(fs.statSync(fullPath).isDirectory()){//Folder
                            returnMap[fullPath+"/"] = {doc:{}};
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

    /**
     * Initialize the storage service
     */
    let init = ()=>{
        return new Promise((resolve, reject) => {
            StorageService.call(storageService, localStorage, PouchDB, {
                options: {
                    live: false
                },
                callback: (syncObject) => {
                    syncObject.on("complete", resolve).on("error", reject);
                }
            },
            dotOpenNotePath);

            //Execute
            storageService.init();
            tagService = TagService(storageService);
        });
    };

    /**
     * Save fs changes in diff to the DB
     * @param  {[type]} diff         - Map of what to save
     * @param  {[type]} databaseDump - Database state
     * @param  {[type]} fsMap        - FS state
     */
    let saveToDB = (diff, databaseDump, fsMap)=>{
        for(let path in diff){
            let isFolder = path[path.length-1]=="/";
            switch(diff[path]){
                case DIFF_TYPES.NOT_IN_FS://Delete
                    if(isFolder){
                        tagService.deleteFolder(databaseDump[path].doc).then(()=>{
                            storageService.deleteFolder(databaseDump[path].doc);
                        });
                    }
                    else{
                        tagService.deleteNote(databaseDump[path].doc);
                        storageService.delete(databaseDump[path].doc);
                    }

                    console.log(`${path} deleted`);
                    break;

                case DIFF_TYPES.NOT_IN_DB://Create
                    let lastIndex = path.substring(0,path.length-1).lastIndexOf("/");
                    let parentPath = path.substring(0,lastIndex+1);

                    fsMap[path].doc._id=uuid();

                    //Figure out parent ID
                    fsMap[path].doc.parentFolderID = null;
                    if(databaseDump[parentPath])
                        fsMap[path].doc.parentFolderID=databaseDump[parentPath].id;
                    if(fsMap[parentPath])
                        fsMap[path].doc.parentFolderID=fsMap[parentPath].doc._id;//This works because a map is ordered so folders get ids first

                    if(isFolder){//Folder
                        fsMap[path].doc.type = "folder";
                        fsMap[path].doc.name = path.substring(lastIndex+1,isFolder ? path.length-1: path.length);
                    }
                    else{//Note
                        fsMap[path].doc.type = "note";
                        fsMap[path].doc.title = path.substring(lastIndex+1,isFolder ? path.length-1: path.length);
                        tagService.saveNote(fsMap[path].doc);
                    }

                    storageService.put(fsMap[path].doc);
                    console.log(`${path} created`);
                    break;

                case DIFF_TYPES.DIFFERS: //Modify
                    databaseDump[path].doc.note = fsMap[path].doc.note;
                    tagService.saveNote(databaseDump[path].doc);
                    storageService.put(databaseDump[path].doc);
                    console.log(`${path} updated`);
                    break;
            }
        }
    };

    //Methods we expose
    let methods = {
        // Kick off a sync
        sync: init,

        /**
         * Set config variables.
         * @param  {[type]} url - Remote couchDB url to save in localstorage
         */
        config: (url) => {
            StorageService.call(storageService, localStorage, PouchDB); //Minimal Init the object
            storageService.setRemoteURL(url);
        },

        /**
         * /Actually dump DB to folder. Sync should be run first to initialize storageService
         * @param  {[type]} pathPrefix - path to write files to
         * @return {[type]}            [description]
         */
        makeFiles: (pathPrefix) => {
            if (!fs.existsSync(pathPrefix))
                fs.mkdirSync(pathPrefix);

            dumpDatabase(pathPrefix).then((returnMap) => {
                writeDatabase(returnMap);
            });
        },

        /**
         * Show difference between database and fs
         * @param  {[type]} pathPrefix [description]
         * @return
         */
        delta: (pathPrefix)=>{
            return new Promise((resolve, reject) => {
                init();
                scanFS(pathPrefix).then((fsMap)=>{
                    dumpDatabase(pathPrefix).then((databaseDump) => {
                        resolve({
                            delta: delta(databaseDump, fsMap),
                            databaseDump,
                            fsMap
                        });
                    });
                }).catch(reject);
            });
        },

        /**
         * [delta description]
         * @param  {[type]} pathPrefix [description]
         * @param  {[type]} pathToSaveRegex [description]
         * @return {[type]}            [description]
         */
        save: (pathPrefix, pathToSaveRegex)=>{
            methods.delta(pathPrefix).then((data)=>{
                //TODO pathToSaveRegex regex filter on diff to mimic git add
                saveToDB(data.delta, data.databaseDump, data.fsMap);
            });
        },


    };

    return methods;
};

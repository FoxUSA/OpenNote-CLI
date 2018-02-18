//TODO dowload file and reupload
//TODO make signed url
//TODO change the db notes to point to new url
//FIXME This code is teporary and will be removed next release
const request = require("request");
const AWS = require("aws-sdk");
const TOKEN_LIFE = 60*24*365*100;//100 years

const LINK_REGEX_INDEX={
    WHOLE_MATCH: 0,
    TAG_TYPE:1,
    FILE_NAME:2,
    LINK_TEXT:3
};

const LINK_REGEX = [
    /<(img|a)[^>]*\/upload\/([^"]*)"(?:>([^<]*)<)?[^\/]*[^>]*>/ig,
    /<(img|a)[^>]*\/service(?:.php)?\/file\/([^"]*)"(?:>([^<]*)<)?[^\/]*[^>]*>/ig
];

/**
 * Facotry for the updateHTML method. The uploadMap and s3s3Credentials parameters are injected from the upgrade method
 * @param  {[type]} uploads         - Items get added to this list if they are discovered
 * @param  {[type]} s3              - AWS SDK s3 instance
 * @param  {[type]} s3Credentials   - S3 config
 * @return {Promise}                - When resolves return new html
 */
let updateHTMLFactory = (uploads,s3, s3Credentials, discoverUploads=true)=>{
    const DISCOVERED_FILES="discovered";
    //Make uploads a map. So we only pay the loop price once for finding by id
        let uploadsMap ={};
        uploads.forEach((upload)=>{
            uploadsMap[upload.id]=upload;
        });

    /**
     * [return description]
     * @param  {[type]} note [description]
     * @return {[type]}      [description]
     */
    return (note)=>{
        return new Promise((resolve, reject) => {
            let replaceLinksRecursiveFunction = (note,i, matches,resolve, reject)=>{
                if(i>=matches.length)
                    return resolve(note);

                let match=matches[i];

                //Figure out the file name
                let fileName = uploadsMap[match[LINK_REGEX_INDEX.FILE_NAME]];
                if(fileName)
                    fileName=`${fileName.id}/${fileName.originalName}`;
                else{
                    fileName = match[LINK_REGEX_INDEX.FILE_NAME];//Default to whatever the file was
                    if(discoverUploads)
                        uploads.push({
                            id:DISCOVERED_FILES,
                            originalName:fileName,
                            diskName:fileName});

                    fileName = `${DISCOVERED_FILES}/${fileName}`;//Default to whatever the file was
                }
                //Sign url
                s3.getSignedUrl("getObject", {
                    Bucket: s3Credentials.bucket,
                    Key:fileName,
                    Expires: TOKEN_LIFE
                }, (err,signedURL)=>{
                    if(err)
                        return reject(err);

                        let replaceString="";
                        signedURL = `${s3Credentials.s3URL}/${s3Credentials.bucket}/${fileName}${signedURL.substring(signedURL.lastIndexOf("?"))}`;
                        switch(match[LINK_REGEX_INDEX.TAG_TYPE]){
                            case "a":
                                replaceString=`<a href="${signedURL}">${match[LINK_REGEX_INDEX.LINK_TEXT]}</a>`;
                            break;
                            case "img":
                                replaceString=`<img src="${signedURL}"/>`;
                            break;
                        }

                        return replaceLinksRecursiveFunction(note.replace(match[LINK_REGEX_INDEX.WHOLE_MATCH],replaceString),++i, matches, resolve, reject);
                });
            };

            //Start the engine
            let matches = [];
            LINK_REGEX.forEach((rgx)=>{
                let matchResult;

                while((matchResult = rgx.exec(note))){
                    matches.push(matchResult);//Get all the matches
                }
            });
            return replaceLinksRecursiveFunction(note,0,matches,resolve, reject);

        });

    };
};


/**
 * @param  {[type]} s3            - s3 instance
 * @param  {[type]} s3Credentials - s3 credetials object
 * @param  {[type]} fs            - node fs module
 * @param  {[type]} serverURL     - legacy opennote file url
 * @param  {[type]} uploads       - array of uploads
 */
let moveFiles= (s3,s3Credentials,fs ,serverURL,uploads)=>{
    let workerFunction = (uploads,index, callback)=>{
        let next = ()=>{
            if(index<uploads.length)
                return workerFunction(uploads,index,callback);
            else
                return callback();
        };

        let file = uploads[index];
        //Create folders
        let folderPath = "/tmp/opennote/";
        if (!fs.existsSync(folderPath))
            fs.mkdirSync(folderPath);
        folderPath+=`${file.id}/`;
        if (!fs.existsSync(folderPath))
            fs.mkdirSync(folderPath);

        let downloadPath = `${folderPath}${file.originalName}`;

        //Download file
        let stream = request(`${serverURL}/OpenNote/Service/upload/${file.diskName}`).pipe(fs.createWriteStream(downloadPath));
        stream.on("finish", ()=>{
            index++;
            console.log(`Downloaded ${index}/${uploads.length}`);
            s3.upload({ // https://github.com/minio/cookbook/blob/master/docs/aws-sdk-for-javascript-with-minio.md
                Bucket: s3Credentials.bucket,
                Key: `${file.id}/${file.originalName}`,
                Body: fs.createReadStream(downloadPath)}, (err)=> {
                    if(err)
                        throw err;

                return next();
            });

        });
    };

    return workerFunction(uploads,0,function(){});
};

/**
 * Factory
 * @param  {[type]} dotOpenNotePath [description]
 * @param  {[type]} localStorage    [description]
 * @param  {[type]} PouchDB         [description]
 * @param  {[type]} fs              [description]
 * @param  {[type]} StorageService  [description]
 * @return {Object}                 - Object containing public methods
 */
module.exports = function(dotOpenNotePath, localStorage, PouchDB, fs, StorageService) {
    let storageService = {};

    //Public methods
    return{
        /**
         * Takes files from opennote and uploads them to a specifies s3 api
         * @param  {[type]} serverURL      [description]
         * @param  {[type]} uploadJSONPath [description]
         * @param  {[type]} s3Credentials  [description]
         */
        upgrade: function(serverURL, jsonPath, s3Credentials){
            let uploads = require(`${__dirname}/../${jsonPath}`);

            //Initilize se client
            let s3= new AWS.S3({
                accessKeyId: s3Credentials.accessKey ,
                secretAccessKey: s3Credentials.secretKey,
                endpoint: s3Credentials.s3URL,
                s3ForcePathStyle: true,
                signatureVersion: "v2"//required for really long tokens
            });

            let updateHTML = updateHTMLFactory(uploads,s3, s3Credentials);


            //Init the angular style service
                StorageService.call(storageService, localStorage, PouchDB, {
                    options: {
                        live: false
                    },
                    callback: () => {}
                },
                dotOpenNotePath);

            //Execute
                let promises = [];
                storageService.init();
                storageService.allDocs().then((result)=>{
                    result.rows.forEach((doc)=>{
                        if (!storageService.typeFilter(doc, "note"))//We only want notes
                            return;

                        //Convert
                        let promise = updateHTML(doc.doc.note);
                        promise.then((updatedNote)=>{
                            doc.doc.note=updatedNote;
                            storageService.put(doc.doc);
                        });

                        promises.push(promise);

                    });

                    Promise.all(promises).then(() => {
                        moveFiles(s3,s3Credentials,fs, serverURL,uploads);
                    });
                });
        }
    };

    //TODO Show list of orphans
};

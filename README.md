# OpenNote CLI

Open Note CLI is, well, a CLI client for OpenNote.
[OpenNote](https://github.com/FoxUSA/OpenNote/) is HTML5 progressive/Offline webapp that is: a minimal, text focused, note taking software that supports tree structures and tags. The datastore is CouchDB mostly because it take like 5 lines to have bi-directional sync.

## Install

This is designed to be installed in your path. This is for multiple notebook support. Much like Git, to have another notebook just create another folder somewhere. The `.openNote` contains localDB and CouchDB replication url.
//TODO How to install it in your path

## Help file
```
node index.js

   index.js 18.03.0-Alpha - CLI client for OpenNote

   USAGE

     index.js <command> [options]

   COMMANDS

     sync [mode]         Sync with CouchDB server                                             
     config <url>        Creates .openNote folder and sets replication url required properties
     delta                                                                                    
     save                                                                                     
     help <command>      Display help for a specific command                                  

   GLOBAL OPTIONS

     -h, --help         Display help                                      
     -V, --version      Display version                                   
     --no-color         Disable colors                                    
     --quiet            Quiet mode - only displays warn and error messages
     -v, --verbose      Verbose mode - will also output debug messages    

```

---

## Example Workflow
```
# Setup
node index.js config http://admin:password@127.0.0.1:5984/opennote

# Pull down files
node index.js sync write

# Edit some files with your editor of choice.
nano reallyCoolFolder/note.md

# Show me my changes
node index.js delta

# Save my changes into the local copy of the db
node index.js save

# Sync my local db to the remote server
node index.js sync

```

---

## FAQ
### Can I use this without the web client or CouchDB?
You could but I have no idea why you would want to. Its basically Git without the branches. IE cookies without sugar. Whole idea is its an eco system. Read and modify notes if you are offline and sync them around.

### Can you use Mongo as a datastore
No.

### I don't like _______ please fix it!
This code is Open Source Software (OSS). You are welcome to take the code and fork it.

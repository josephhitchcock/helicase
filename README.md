# helicase
A tool to back up Synology NAS data to multiple external drives

![helicase](https://user-images.githubusercontent.com/10837901/110879471-e643bd80-8291-11eb-936a-c70b2df4b689.png)

## Requirements
* `Node 7.6+` for async/await functionality

## Running the initial backup
1. Open `config.js`
    * Enter your source(s) as path strings.
    * Enter your destinations as objects with a `path` string and `size` number (in terabytes).
    * _Optional_: Add a Slack webhook to be alerted when each batch is completed, then `npm install`.
      * `axios` is used to make the POST requests, otherwise no dependencies are needed.
2. `npm run index`
    * This will gather information about each file within the source directories, and stream it to a temp file.
    * Expected to take minutes.
3. `npm run partition`
    * This will read the temp file and attempt to place each file onto a destination volume, then output instructions.
    * Expected to take seconds.
4. For each destination volume: mount it, then `npm run backup <drive>`
    * This will read the instructions for `drive` and execute them.
    * **Note**: If your drive name has spaces in it, be sure to enclose it in quotes.
    * Expected to take hours.

## Running a subsequent backup
The initial backup needs to write every single file, but subsequent backups only need to write new files and update modified files.

Along with the individual drive instructions, the `partition` script writes a snapshot file to the output directory. When running a subsequent backup, replace `previous.json` in the input directory with the most recent snapshot file. Using this file, the subsequent backup will only generate instructions for the new and modified files, leaving the rest as is.

Add destination drives as necessary, then follow steps 2-4 the same as above.

## File formats

### index.txt

```
/path/to/file1:modified:size
/path/to/file2:modified:size
...
```
This represents the necessary information for all files across the source directories.

### previous.json

```
{
  "/path/to/file1": {
    "drive": String,
    "updated": Number,
    "size": Number
  },
  "/path/to/file2": {
    "drive": String,
    "updated": Number,
    "size": Number
  },
}
```
This represents what files have already been backed up, and which drives they were placed on.

### \<drive\>.json

```
{
  "delete": ["/path/to/file1"],
  "copy": [
    {
      "path": "/path/to/file1",
      "size": Number
    },
    {
      "path": "/path/to/file2",
      "size": Number
    },
  ]
}
```
This represents the instructions that will be executed when the volume <drive> is mounted.


## Script details

### index
This script will first read the source paths and make sure there isn't any overlap (where one source is contained within another). This is done by sorting the source directories alphabetically and making sure that no source is a prefix of the following source. Once we've determined this, we know that each file will be represented only once.

Then we clear out any existing `index.txt` file in `/temp`, to begin appending file information for this script run. For each source, synchronously, we run a `find` command to search for all non-hidden files (files which start with `.`). Note that due to this approach, empty directories will not be cloned, since only actual files are being matched. For each of these files, a `stat` command is executed to gather the file's full path, its last modified timestamp, and its size in bytes. These attributes are joined by the configured delimiter which defaults to `:`, and appended to `index.txt` where each file gets its own line. This delimiter cannot be present in any file paths otherwise the `partition` script will fail, but since the colon character isn't a legal filesystem character and it wouldn't appear in a modified timestamp or byte value, this seems safe.

There isn't a great way to indicate granular progress for this step, since all files for an entire source directory are streamed to the text file in a single command. I could read the last line of the file every once in a while to log that, but I didn't want to incur any extra overhead so you'll just have to be patient.

### partition
This script reads two files, the first one being the `index.txt` file generated by the `index` script stored in `/temp`, and the second one being a `previous.json` file indicating a previous snapshot stored in `/input`. This is used to enable subsequent backups, but is initialized to an empty object for the first run, since there are no previous files. The index file is split by newline characters, and the last line is popped off to handle the trailing newline which causes an empty entry.

A `DriveManager` instance is created which will orchestrate the placement of each file to a drive. This constructor stores a lookup of each destination drive's name to a corresponding `Drive` instance, which keeps track of its capacity and current instructions. The manager also keeps track of active drives, drives which currently have instructions.

A `current` object is instantiated, and then loaded with files from the index file. Each line is split by the delimiter, then keyed by its path with `updated` and `size` attributes.
  * We go through all files in the `previous` object, and check if its path is present in the `current` object. 
    * If it's not we know this file has been deleted. From the previous object, we know which drive this file was placed on, and the manager instructs this drive to store instructions to delete this file. This file's path is removed from the previous object, since it will no longer be present.
  * We go through all files in the `current` object, to check if they exist in `previous`.
    * If it does and its `updated` value is higher, this file has been modified, it will be deleted and then copied again. The manager instructs the drive containing the file to delete it, and then it's removed from the previous object.
    * Otherwise if the modified date is the same, this is the same file and we simply remove it from the current object.

After this, the `current` object will contain only files that are new or have been modified since the last backup.

We now instruct the manager to load the remaining previous files onto the drives, which will update their capacities to reflect the files that are already on them (besides the ones that will be deleted). Then we can see if the new and modified files will fit on the given configuration. There's a few things to note here, namely the parameters in `config.js`:
  * `capacity`: This defines the actual capacity of a drive as a percentage, since we don't expect the entirety to be accessible
  * `buffer`: This defines a buffer in gigabytes, which we'll leave untouched in an effort to not overfill any of the drives
  * `filesystem`: This defines a percentage to assume when writing files to disk, since this can be more than just their bytes

Using these parameters, the manager will determine if a backup of the new and modified files is possible, and return the number of free bytes after placing them. If this value is negative, it indicates that the given configuration won't be able to store it due to the size of the destination volumes and the parameters. It is technically possible that even after this check some files could end up not fitting, if there was fragmented leftover space across drives that wasn't usable by a single large file, but it seems rather unlikely, especially given the buffer.

Once we've completed this check, the manager can go about placing all of the files onto a drive. For each file, the manager attempts to place it onto each drive in the active set in reverse order, from most recently added to least recently added, looking for a drive with enough capacity. If there are none, the manager will add the largest remaining drive into the active set and use that. Almost every time the most recently added drive will be used, since it represents the one that's currently being filled, but this approach allows for small files to backfill remaining space on older active drives. This will make it so that files from the same folder are not necessarily on the same drive, but for this backup I was okay with that. This approach should attempt to minimize the number of drives that need to be plugged in for each subsequent backup.

All that's left is for the manager to instruct the drives in the active set to write their instructions to file, which will be found in `/output`, along with the updated snapshot of the entire backup which will replace `previous.json` on the next run.

### backup
This script takes a command line argument of the drive that's being written to, since it will have to be run for each destination drive which will have to be mounted in turn. As mentioned above, if the drive name has spaces in it, the command line argument will need to be wrapped in quotes to be parsed properly. This drive name will then have to be matched to an instruction file, and lastly we'll check if the drive is mounted by doing a `cd` into it. Here it's assumed that all of the source files and all of the destination drives have the prefix `/Volumes/`. In order to write each file, we transform its path from, for example `/Volumes/Movies/...` to `/Volumes/backup1/Movies/...`, where `backup1` is the name of the current destination drive.

Once we're able to translate the source path to a destination path, we first complete a deletion pass of all files in the `delete` array of the instructions, indicating progress. Then we move on to the `copy` instructions. We get the parent directory by splitting on `/` and slicing off the last entry (the filename), and do a `mkdir -p` to ensure that this path exists. Then we do a `cp -p` of the file into this directory, preserving its actual last modified attribute. Each file copy is executed as a separate command, and each command has error handling which will log to an `errors.txt` file in `/output` if anything goes wrong. One example of something that could happen here would be if a file had been deleted since the index file was generated, attempting to copy it would fail.

Progress is reported for each file copy as an overall percentage of bytes completed so far, and then stats about the data transfer rate are output upon completion.

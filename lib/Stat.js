'use strict';

const constants = require('./constants');

class Stat {

  constructor (props) {
		this.dev = props.dev || 0;   // in-memory has no devices
		this.ino = props.ino;
		this.mode = props.mode;
		this.nlink = props.nlink;
		this.uid = props.uid || 0;   // in-memory usage is always root
		this.gid = props.gid || 0;   // in-memory usage is always root
		this.rdev = props.rdev || 0; // is 0 for regular files and directories
		this.size = props.size;
		this.blksize = undefined;    // in-memory doesn't have blocks
		this.blocks = undefined;     // in-memory doesn't have blocks
		this.atime = props.atime;
		this.mtime = props.mtime;
		this.ctime = props.ctime;
		this.birthtime = props.birthtime;
  }

  isFile () {
		return !!(this.mode & constants.S_IFREG);
  }

  isDirectory () {
		return !!(this.mode & constants.S_IFDIR);
  }

  isBlockDevice () {
		return false;
  }

  isCharacterDevice () {
		return false;
  }

  isSymbolicLink () {
    return !!(this.mode & constants.S_IFLNK);
  }

  isFIFO () {
		return false;
  }

  isSocket () {
		return false;
  }

}

module.exports = Stat;

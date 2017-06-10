/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const normalize = require("./normalize");
const join = require("./join");
const errors = require("errno");
const stream = require("readable-stream");
const fs = require('fs');

const ReadableStream = stream.Readable;
const WritableStream = stream.Writable;

class MemoryFileSystemError extends Error {
	constructor(err, path) {
		super(err, path);
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, this.constructor)
		this.code = err.code;
		this.errno = err.errno;
		this.message = err.description;
		this.path = path;
	}
}

class MemoryStat {
  constructor (props) {
    this.dev = 0;             // in-memory doesn't have devices, default to 0
    this.ino = 0;             // in-memory doesn't have inodes, default to 0
    this.mode = props.mode;
    this.nlink = 1;           // in-memory doesn't have hardlinks, so default to 1
    this.uid = 0;             // in-memory usage is always root
    this.gid = 0;             // in-memory usage is always root
    this.rdev = 0;            // is 0 for regular files and directories
    this.size = props.size;
		this.blksize = undefined; // in-memory doesn't have blocks
    this.blocks = undefined;  // in-memory doesn't have blocks
    this.atime = props.atime;
    this.mtime = props.mtime;
    this.ctime = props.ctime;
    this.birthtime = props.birthtime;
  }
  isFile () {
		return !!(this.mode & fs.constants.S_IFREG);
  }
  isDirectory () {
		return !!(this.mode & fs.constants.S_IFDIR);
  }
  isBlockDevice () {
		return false;
  }
  isCharacterDevice () {
		return false;
  }
  isSymbolicLink () {
    return !!(this.mode & fs.constants.S_IFLNK);
  }
  isFIFO () {
		return false;
  }
  isSocket () {
		return false;
  }
}

class MemoryFile {
  constructor(data) {
    this.data = data;
		let now = new Date;
    this.metadata = new MemoryStat({
			mode: (fs.constants.S_IFREG |
						 fs.constants.S_IRWXU |
						 fs.constants.S_IRWXG |
						 fs.constants.S_IRWXO),  // in-memory files have 777 permissions
			size: data.byteLength,
			atime: now,
      mtime: now,
			ctime: now,
			birthtime: now
		});
  }
}

class MemoryDir {
	constructor(data) {
		this.data = data || {};
		let now = new Date;
		this.metadata = new MemoryStat({
			mode: (fs.constants.S_IFDIR |
						 fs.constants.S_IRWXU |
						 fs.constants.S_IRWXG |
						 fs.constants.S_IRWXO),  // in-memory directories have 777 permissions
			size: 0,                       // in-memory directories don't take up any size
			atime: now,
      mtime: now,
			ctime: now,
			birthtime: now
		});
	}
}

function isDir(item) {
	return item instanceof MemoryDir;
}

function isFile(item) {
	return item instanceof MemoryFile;
}

function pathToArray(path) {
	path = normalize(path);
	const nix = /^\//.test(path);
	if(!nix) {
		if(!/^[A-Za-z]:/.test(path)) {
			throw new MemoryFileSystemError(errors.code.EINVAL, path);
		}
		path = path.replace(/[\\\/]+/g, "\\"); // multi slashs
		path = path.split(/[\\\/]/);
		path[0] = path[0].toUpperCase();
	} else {
		path = path.replace(/\/+/g, "/"); // multi slashs
		path = path.substr(1).split("/");
	}
	if(!path[path.length-1]) path.pop();
	return path;
}

class MemoryFileSystem extends MemoryDir {
	constructor(data) {
		super(data);
		this.join = join;
		this.pathToArray = pathToArray;
		this.normalize = normalize;
	}

	meta(_path) {
		let current = this;
		if (_path === "/") return current;
		const path = pathToArray(_path);
		let i = 0;
		for(; i < path.length - 1; i++) {
			if(!isDir(current.data[path[i]]))
				return null;
			current = current.data[path[i]];
		}
		return current.data[path[i]];
	}

	existsSync(_path) {
		return !!this.meta(_path);
	}

	statSync(_path) {
		let current = this.meta(_path);
		if (current) {
			return current.metadata;
		} else {
			throw new MemoryFileSystemError(errors.code.ENOENT, _path);
		}
	}

	readFileSync(_path, optionsOrEncoding) {
		const path = pathToArray(_path);
		let current = this;
		let i = 0;
		for(; i < path.length - 1; i++) {
			if(!isDir(current.data[path[i]]))
				throw new MemoryFileSystemError(errors.code.ENOENT, _path);
			current = current.data[path[i]];
		}
		if(!isFile(current.data[path[i]])) {
			if(isDir(current.data[path[i]]))
				throw new MemoryFileSystemError(errors.code.EISDIR, _path);
			else
				throw new MemoryFileSystemError(errors.code.ENOENT, _path);
		}
		current = current.data[path[i]];
		const encoding = typeof optionsOrEncoding === "object" ? optionsOrEncoding.encoding : optionsOrEncoding;
		return encoding ? current.data.toString(encoding) : current.data;
	}

	readdirSync(_path) {
		let current = this;
		if(_path === "/") return Object.keys(current.data).filter(Boolean);
		const path = pathToArray(_path);
		let i = 0;
		for(; i < path.length - 1; i++) {
			if(!isDir(current.data[path[i]]))
				throw new MemoryFileSystemError(errors.code.ENOENT, _path);
			current = current.data[path[i]];
		}
		if(!isDir(current.data[path[i]])) {
			if(isFile(current.data[path[i]]))
				throw new MemoryFileSystemError(errors.code.ENOTDIR, _path);
			else
				throw new MemoryFileSystemError(errors.code.ENOENT, _path);
		}
		return Object.keys(current.data[path[i]].data).filter(Boolean);
	}

	mkdirpSync(_path) {
		const path = pathToArray(_path);
		if(path.length === 0) return;
		let current = this;
		for(let i = 0; i < path.length; i++) {
			if(isFile(current.data[path[i]]))
				throw new MemoryFileSystemError(errors.code.ENOTDIR, _path);
			else if(!isDir(current.data[path[i]]))
				current.data[path[i]] = new MemoryDir;
			current = current.data[path[i]];
		}
		return;
	}

	mkdirSync(_path) {
		const path = pathToArray(_path);
		if(path.length === 0) return;
		let current = this;
		let i = 0;
		for(; i < path.length - 1; i++) {
			if(!isDir(current.data[path[i]]))
				throw new MemoryFileSystemError(errors.code.ENOENT, _path);
			current = current.data[path[i]];
		}
		if(isDir(current.data[path[i]]))
			throw new MemoryFileSystemError(errors.code.EEXIST, _path);
		else if(isFile(current.data[path[i]]))
			throw new MemoryFileSystemError(errors.code.ENOTDIR, _path);
		current.data[path[i]] = new MemoryDir;
		return;
	}

	_remove(_path, name, testFn) {
		const path = pathToArray(_path);
		if(path.length === 0) {
			throw new MemoryFileSystemError(errors.code.EPERM, _path);
		}
		let current = this;
		let i = 0;
		for(; i < path.length - 1; i++) {
			if(!isDir(current.data[path[i]]))
				throw new MemoryFileSystemError(errors.code.ENOENT, _path);
			current = current.data[path[i]];
		}
		if(!testFn(current.data[path[i]]))
			throw new MemoryFileSystemError(errors.code.ENOENT, _path);
		delete current.data[path[i]];
		return;
	}

	rmdirSync(_path) {
		return this._remove(_path, "Directory", isDir);
	}

	unlinkSync(_path) {
		return this._remove(_path, "File", isFile);
	}

	readlinkSync(_path) {
		throw new MemoryFileSystemError(errors.code.ENOSYS, _path);
	}

	writeFileSync(_path, content, optionsOrEncoding) {
		if(!content && !optionsOrEncoding) throw new Error("No content");
		const path = pathToArray(_path);
		if(path.length === 0) {
			throw new MemoryFileSystemError(errors.code.EISDIR, _path);
		}
		let current = this;
		let i = 0;
		for(; i < path.length - 1; i++) {
			if(!isDir(current.data[path[i]]))
				throw new MemoryFileSystemError(errors.code.ENOENT, _path);
			current = current.data[path[i]];
		}
		if(isDir(current.data[path[i]]))
			throw new MemoryFileSystemError(errors.code.EISDIR, _path);
		const encoding = typeof optionsOrEncoding === "object" ? optionsOrEncoding.encoding : optionsOrEncoding;
		current.data[path[i]] = optionsOrEncoding || typeof content === "string" ? new MemoryFile(Buffer(content, encoding)) : new MemoryFile(content);
		return;
	}

	// stream methods
	createReadStream(path, options) {
		let stream = new ReadableStream();
		let done = false;
		let data;
		try {
			data = this.readFileSync(path);
		} catch (e) {
			stream._read = function() {
				if (done) {
					return;
				}
				done = true;
				this.emit('error', e);
				this.push(null);
			};
			return stream;
		}
		options = options || { };
		options.start = options.start || 0;
		options.end = options.end || data.length;
		stream._read = function() {
			if (done) {
				return;
			}
			done = true;
			this.push(data.slice(options.start, options.end));
			this.push(null);
		};
		return stream;
	}

	createWriteStream(path) {
		let stream = new WritableStream();
		try {
			// Zero the file and make sure it is writable
			this.writeFileSync(path, new Buffer(0));
		} catch(e) {
			// This or setImmediate?
			stream.once('prefinish', function() {
				stream.emit('error', e);
			});
			return stream;
		}
		let bl = [ ], len = 0;
		stream._write = (chunk, encoding, callback) => {
			bl.push(chunk);
			len += chunk.length;
			this.writeFile(path, Buffer.concat(bl, len), callback);
		};
		return stream;
	}

	// async functions
	exists(path, callback) {
		return callback(this.existsSync(path));
	}

	writeFile(path, content, encoding, callback) {
		if(!callback) {
			callback = encoding;
			encoding = undefined;
		}
		try {
			this.writeFileSync(path, content, encoding);
		} catch(e) {
			return callback(e);
		}
		return callback();
	}
}

// async functions

["stat", "readdir", "mkdirp", "rmdir", "unlink", "readlink"].forEach(function(fn) {
	MemoryFileSystem.prototype[fn] = function(path, callback) {
		let result;
		try {
			result = this[fn + "Sync"](path);
		} catch(e) {
			setImmediate(function() {
				callback(e);
			});

			return;
		}
		setImmediate(function() {
			callback(null, result);
		});
	};
});

["mkdir", "readFile"].forEach(function(fn) {
	MemoryFileSystem.prototype[fn] = function(path, optArg, callback) {
		if(!callback) {
			callback = optArg;
			optArg = undefined;
		}
		let result;
		try {
			result = this[fn + "Sync"](path, optArg);
		} catch(e) {
			setImmediate(function() {
				callback(e);
			});

			return;
		}
		setImmediate(function() {
			callback(null, result);
		});
	};
});

exports.MemoryFileSystemError = MemoryFileSystemError;
exports.MemoryFile = MemoryFile;
exports.MemoryDir = MemoryDir;
exports.MemoryFileSystem = MemoryFileSystem;

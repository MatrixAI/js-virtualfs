'use strict';

const fs = require('fs');
const path = require('path');
const errors = require("errno");
const stream = require("readable-stream");

const ReadableStream = stream.Readable;
const WritableStream = stream.Writable;

class MemoryFileSystemError extends Error {

	constructor(err, path) {
		super(err, path);
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, this.constructor);
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
						 fs.constants.S_IRWXO),
			size: data.byteLength,
			atime: now,
			mtime: now,
			ctime: now,
			birthtime: now
		});
  }

}

class MemorySymlink {

  constructor(link) {
		this.link = link;
		let now = new Date;
		this.metadata = new MemoryStat({
			mode: (fs.constants.S_IFLNK |
						 fs.constants.S_IRWXU |
						 fs.constants.S_IRWXG |
						 fs.constants.S_IRWXO),
			size: Buffer.from(this.link).length,
			atime: now,
			mtime: now,
			ctime: now,
			birthtime: now
		});
	}

}

class MemoryDir {

	constructor(data, parent) {
		this.data = data || {};
		this.data['.'] = this;
		this.data['..'] = parent || this;
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

class MemoryFileSystem extends MemoryDir {

	constructor (data) {

		super(data);

	}

	_parsePath (pathS) {

		// this grabs the first segment stopping on the first slash
		let matches = pathS.match(/^([\s\S]*?)(?:\/+|$)([\s\S]*)/);

		// let matches = pathS.match(/^([\s\S]*?(?:\/+|$))([\s\S]*)/);

		let segment = matches[1] || '';
		let rest = matches[2] || '';

		return {
			segment: segment,
			rest: rest,
			input: pathS
		};

	}

	// this is how you interpret the results
	// target && !name => /
	// !target && !name => not found in the path
	// !target && name => empty at the path
	_navigate (pathS, resolveLastSymlink) {

		resolveLastSymlink =
			(typeof resolveLastSymlink !== 'undefined')
			? resolveLastSymlink
			: true;

		if (!pathS) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

		// at root consider that: '/a', 'a', '/a', './a', '../a' are all the same
		// so we canonicalise all of these to just 'a'
		pathS = pathS.replace(/^\.{1,2}\/|\/+/, '');

		// if it is empty now, this means there was just /
		if (pathS === '') {
			return {
				dir: this,
				target: this,
				name: null,
				remaining: ''
			};
		}

		return this._navigateFrom(this, pathS, resolveLastSymlink);

	}

	// this is where the wrapper works
	// pathS must start from ./a, a, ../a, but never /a
	// also pathS cannot be empty, because we always check the target
	_navigateFrom (curdir, pathS, resolveLastSymlink) {

		if (!pathS) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

		let parse = this._parsePath(pathS);
		let target = curdir.data[parse.segment];

		switch (true) {
		case target instanceof MemorySymlink:
			if (!resolveLastSymlink && !parse.rest) {
				return {
					dir: curdir,
					target: target,
					name: parse.segment,
					remaining: parse.rest
				};
			}
			let symlink = path.posix.join(target.link, parse.rest);
			if (symlink[0] === '/') {
				return this._navigate(symlink, resolveLastSymlink);
			} else {
				return this._navigateFrom(curdir, symlink, resolveLastSymlink);
			}
		case target instanceof MemoryDir:
			if (!parse.rest) {
				return {
					dir: curdir,
					target: target,
					name: parse.segment,
					remaining: parse.rest
				};
			}
			return this._navigateFrom(target, parse.rest, resolveLastSymlink);
		case target instanceof MemoryFile:
			if (!parse.rest) {
				return {
					dir: curdir,
					target: target,
					name: parse.segment,
					remaining: parse.rest
				};
			}
			return {
				dir: curdir,
				target: null,
				name: null,
				remaining: parse.rest
			};
		case typeof target === 'undefined':
			return {
				dir: curdir,
				target: null,
				name: parse.segment,
				remaining: parse.rest
			};
		default:
			throw new TypeError('Non-exhaustive pattern matching!');
		}

	}

	existsSync (pathS) {

		return !!(this._navigate(pathS, true).target);

	}

	statSync (pathS) {

		let target = this._navigate(pathS, false).target;

		if (target) {
			return target.metadata;
		} else {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

	}

	symlinkSync (target, pathS) {

		if (!target)  {
			throw new MemoryFileSystemError(
				errors.code.ENOENT,
				"symlink '" + target + "' -> '" + pathS + "'"
			);
		}

		let navigated = this._navigate(pathS, false);

		if (!navigated.target && !navigated.name) {

			throw new MemoryFileSystemError(
				errors.code.ENOENT,
				"symlink '" + target + "' -> '" + pathS + "'"
			);

		} else if (!navigated.target) {

			navigated.dir.data[navigated.name] = new MemorySymlink(target);
			return;

		} else {

			throw new MemoryFileSystemError(
				errors.code.EEXIST,
				"symlink '" + target + "' -> '" + pathS + "'"
			);

		}

	}

	readFileSync (pathS, optionsOrEncoding) {

		let target = this._navigate(pathS, true).target;

		if (!target) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

		if (target instanceof MemoryDir) {
			throw new MemoryFileSystemError(errors.code.EISDIR, pathS);
		}

		target.metadata.atime = new Date;

		const encoding =
			    typeof optionsOrEncoding === "object"
			? optionsOrEncoding.encoding
			: optionsOrEncoding;

		return encoding ? target.data.toString(encoding) : target.data;

	}

	readdirSync (pathS) {

		let navigated = this._navigate(pathS, true);

		if (!navigated.target) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

		if (navigated.target instanceof MemoryFile) {
			throw new MemoryFileSystemError(errors.code.ENOTDIR, pathS);
		}

		return Object.keys(navigated.target.data).filter(function (v) {
      return v !== '.' && v !== '..';
    });

	}

	mkdirpSync (pathS) {

		let current = null;
		let navigated = this._navigate(pathS, true);

	  while (true) {

			if (!navigated.target && !navigated.name) {
				throw new MemoryFileSystemError(errors.code.ENOTDIR, pathS);
			} else if (!navigated.target) {
				navigated.dir.data[navigated.name] = new MemoryDir({}, navigated.dir);
				if (navigated.remaining) {
					current = navigated.dir.data[navigated.name];
					navigated = this._navigateFrom(current, navigated.remaining, true);
				} else {
					break;
				}
			} else if (!(navigated.target instanceof MemoryDir)) {
				throw new MemoryFileSystemError(errors.code.ENOTDIR, pathS);
			} else {
				break;
			}
		}

		return;

	}

	mkdirSync(pathS) {

		let navigated = this._navigate(pathS, true);

		if (!navigated.target && !navigated.name) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		} else if (!navigated.target && navigated.remaining) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		} else if (!navigated.target) {
			navigated.dir.data[navigated.name] = new MemoryDir({}, navigated.dir);
		} else if (!(navigated.target instanceof MemoryDir)) {
			throw new MemoryFileSystemError(errors.code.ENOTDIR, pathS);
		} else {
			throw new MemoryFileSystemError(errors.code.EEXIST, pathS);
		}

		return;

	}

	rmdirSync (pathS) {

		let navigated = this._navigate(pathS, false);

		if (!navigated.target) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

		if (!(navigated.target instanceof MemoryDir)) {
			throw new MemoryFileSystemError(errors.code.ENOTDIR, pathS);
		}

		// this is for if the path resolved to root
		if (!navigated.name) {
			throw new MemoryFileSystemError(errors.code.EBUSY, pathS);
		}

		if (Object.keys(navigated.target.data).slice(2).length) {
			throw new MemoryFileSystemError(errors.code.ENOTEMPTY, pathS);
		}

		delete navigated.dir.data[navigated.name];

		return;

	}

	unlinkSync (pathS) {

		let navigated = this._navigate(pathS, false);

		if (!navigated.target) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

		if (navigated.target instanceof MemoryDir) {
			throw new MemoryFileSystemError(errors.code.EISDIR, pathS);
		}

		delete navigated.dir.data[navigated.name];

		return;

	}

	readlinkSync (pathS) {

		let target = this._navigate(pathS, false).target;

		if (!target) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

		if (!(target instanceof MemorySymlink)) {
			throw new MemoryFileSystemError(errors.code.EINVAL, pathS);
		}

		return target.link;

	}

	writeFileSync(pathS, content, optionsOrEncoding) {

		let navigated = this._navigate(pathS, true);

		if (!navigated.target && !navigated.name) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

		if (!navigated.target && navigated.remaining) {
			throw new MemoryFileSystemError(errors.code.ENOENT, pathS);
		}

		if (navigated.target instanceof MemoryDir) {
			throw new MemoryFileSystemError(errors.code.EISDIR, pathS);
		}

		const encoding =
			typeof optionsOrEncoding === "object"
			? optionsOrEncoding.encoding
			: optionsOrEncoding;

		let file = {};

		if (optionsOrEncoding || typeof content === 'string') {
			file = new MemoryFile(Buffer(content, encoding));
		} else {
			file = new MemoryFile(content);
		}

		// if a file already exists, then preserve the atime, since it wasn't read
		if (navigated.target instanceof MemoryFile) {
			file.metadata.atime = navigated.target.metadata.atime;
		}

		navigated.dir.data[navigated.name] = file;

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

	createWriteStream (path) {

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

	writeFile (path, content, encoding, callback) {

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
exports.MemorySymlink = MemorySymlink;
exports.MemoryDir = MemoryDir;
exports.MemoryFileSystem = MemoryFileSystem;

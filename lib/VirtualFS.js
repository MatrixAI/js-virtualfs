'use strict';

// for browser compatibility
require('setimmediate');
const Buffer = require('buffer').Buffer;
const path = require('path');
const stream = require("readable-stream");

const errno = require('errno');
const clone = require('component-clone');
const cloneBuffer = require('clone-buffer');
const constants = require('./constants');
const Stat = require('./Stat');
const inodes = require('./INodes');

const INodeManager = inodes.INodeManager;
const File = inodes.File;
const Directory = inodes.Directory;
const Symlink = inodes.Symlink;
const ReadableStream = stream.Readable;
const WritableStream = stream.Writable;

class FSError extends Error {

  /**
   * Creates an Error object simulating Node's fs errors
   * @param {{errno: number, code: string, description: string}} errorSys
   * @param {string|string[]} paths - Paths used when this error is thrown
   * @returns {FSError}
   */
  constructor (errorSys, paths) {
    paths = (Array.isArray(paths)) ? paths : [paths];
    let message
        = errorSys.code + ': '
        + errorSys.description + ', '
        + paths.map(function (v) { return "'" + v + "'"; }).join(' -> ');
    super(message);
    this.code = errorSys.code;
    this.errno = errorSys.errno;
    this.paths = paths;
  }

}

class FS {

  /**
   * Constructs an FS object simulating Node's fs object
   */
  constructor () {
    this._inodeMgr = new INodeManager;
    let rootIndex = this._inodeMgr.createINode(Directory, {});
    this._root = this._inodeMgr.getINode(rootIndex);
  }

  /**
   * Parses and extracts the first path segment
   * @param {string} pathS
   * @returns {{segment: string, rest: string}}
   */
  _parsePath (pathS) {
    let matches = pathS.match(/^([\s\S]*?)(?:\/+|$)([\s\S]*)/);
    let segment = matches[1] || '';
    let rest = matches[2] || '';
    return {
      segment: segment,
      rest: rest
    };
  }

  /**
   * Navigates the filesystem tree from root
   * You can interpret the results like:
   *   target && !name  => dir is at /
   *   !target && !name => not found within a pathS segment
   *   !target && name  => empty target at pathS
   * @private
   * @param {string} pathS
   * @param {boolean} [resolveLastLink=true] - If true, resolve the target symlink
   * @returns {{dir: Directory, target: File|Directory|Symlink, name: string, remaining: string}}
   * @throws {FSError|TypeError} Will throw ENOENT if pathS is empty, should not throw TypeError
   */
  _navigate (pathS, resolveLastLink) {
    resolveLastLink =
      (typeof resolveLastLink !== 'undefined')
      ? resolveLastLink
      : true;
    if (!pathS) {
      throw new FSError(errno.code.ENOENT, pathS);
    }
    // at root consider that: '/a', 'a', '/a', './a', '../a' are all the same
    // so we canonicalise all of these to just 'a'
    pathS = pathS.replace(/^\.{1,2}\/|\/+/, '');
    // if it is empty now, this means there was just /
    if (pathS === '') {
      return {
        dir: this._root,
        target: this._root,
        name: null,
        remaining: ''
      };
    }
    return this._navigateFrom(this._root, pathS, resolveLastLink);
  }

  /**
   * Navigates the filesystem tree from a given directory
   * @private
   * @param {Directory} curdir
   * @param {string} pathS
   * @param {boolean} resolveLastLink
   * @returns {{dir: Directory, target: File|Directory|Symlink, name: string, remaining: string}}
   * @throws {FSError|TypeError} Will throw ENOENT if pathS is empty, should not throw TypeError
   */
  _navigateFrom (curdir, pathS, resolveLastLink) {
    if (!pathS) {
      throw new FSError(errno.code.ENOENT, pathS);
    }
    let parse = this._parsePath(pathS);
    let target = curdir.getEntry(parse.segment);
    switch (true) {
    case target instanceof File:
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
    case target instanceof Directory:
      if (!parse.rest) {
        return {
          dir: curdir,
          target: target,
          name: parse.segment,
          remaining: parse.rest
        };
      }
      return this._navigateFrom(target, parse.rest, resolveLastLink);
    case target instanceof Symlink:
      if (!resolveLastLink && !parse.rest) {
        return {
          dir: curdir,
          target: target,
          name: parse.segment,
          remaining: parse.rest
        };
      }
      let symlink = path.posix.join(target.getLink(), parse.rest);
      if (symlink[0] === '/') {
        return this._navigate(symlink, resolveLastLink);
      } else {
        return this._navigateFrom(curdir, symlink, resolveLastLink);
      }
    case typeof target === 'undefined':
      return {
        dir: curdir,
        target: null,
        name: parse.segment,
        remaining: parse.rest
      };
    default:
      throw new TypeError('Non-exhaustive pattern matching');
    }
  }

  existsSync (pathS) {
    try {
      return !!(this._navigate(pathS, true).target);
    } catch (e) {
      return false;
    }
  }

  statSync (pathS) {
    let target = this._navigate(pathS, true).target;
    if (target) {
      return new Stat(clone(target.getMetadata()));
    } else {
      throw new FSError(errno.code.ENOENT, pathS);
    }
  }

  lstatSync (pathS) {
    let target = this._navigate(pathS, false).target;
    if (target) {
      return new Stat(clone(target.getMetadata()));
    } else {
      throw new FSError(errno.code.ENOENT, pathS);
    }
  }

  writeFileSync(pathS, content, optionsOrEncoding) {
    // this is node behaviour
    if (typeof content === 'undefined') {
      content = 'undefined';
    }
    let navigated = this._navigate(pathS, true);
    if (!navigated.target && !navigated.name) {
      throw new FSError(errno.code.ENOENT, pathS);
    }
    if (!navigated.target && navigated.remaining) {
      throw new FSError(errno.code.ENOENT, pathS);
    }
    if (navigated.target instanceof Directory) {
      throw new FSError(errno.code.EISDIR, pathS);
    }
    const encoding =
          typeof optionsOrEncoding === "object"
          ? optionsOrEncoding.encoding
          : optionsOrEncoding;
    if (optionsOrEncoding || typeof content === 'string') {
      content = Buffer(content, encoding);
    }
    if (navigated.target instanceof File) {
      navigated.target.write(content);
    } else {
      let index = this._inodeMgr.createINode(File, { data: content });
      navigated.dir.addEntry(navigated.name, index);
    }
    return;
  }

  mkdirSync(pathS) {
    let navigated = this._navigate(pathS, true);
    if (!navigated.target && !navigated.name) {
      throw new FSError(errno.code.ENOENT, pathS);
    } else if (!navigated.target && navigated.remaining) {
      throw new FSError(errno.code.ENOENT, pathS);
    } else if (!navigated.target) {
      let index = this._inodeMgr.createINode(
        Directory,
        { parent: navigated.dir.getEntryIndex('.') }
      );
      navigated.dir.addEntry(navigated.name, index);
    } else if (!(navigated.target instanceof Directory)) {
      throw new FSError(errno.code.ENOTDIR, pathS);
    } else {
      throw new FSError(errno.code.EEXIST, pathS);
    }
    return;
  }

  mkdirpSync (pathS) {
    let current = null;
    let navigated = this._navigate(pathS, true);
    while (true) {
      if (!navigated.target && !navigated.name) {
        throw new FSError(errno.code.ENOTDIR, pathS);
      } else if (!navigated.target) {
        let index = this._inodeMgr.createINode(
          Directory,
          { parent: navigated.dir.getEntryIndex('.') }
        );
        navigated.dir.addEntry(navigated.name, index);
        if (navigated.remaining) {
          current = this._inodeMgr.getINode(index);
          navigated = this._navigateFrom(current, navigated.remaining, true);
        } else {
          break;
        }
      } else if (!(navigated.target instanceof Directory)) {
        throw new FSError(errno.code.ENOTDIR, pathS);
      } else {
        break;
      }
    }
    return;
  }

  symlinkSync (target, pathS) {
    if (!target)  {
      throw new FSError(errno.code.ENOENT, [target, pathS]);
    }
    let navigated = this._navigate(pathS, false);
    if (!navigated.target && !navigated.name) {
      throw new FSError(errno.code.ENOENT, [target, pathS]);
    } else if (!navigated.target) {
      let index = this._inodeMgr.createINode(Symlink, { link: target });
      navigated.dir.addEntry(navigated.name, index);
      return;
    } else {
      throw new FSError(errno.code.EEXIST, [target, pathS]);
    }
  }

  readFileSync (pathS, optionsOrEncoding) {
    let target = this._navigate(pathS, true).target;
    if (!target) {
      throw new FSError(errno.code.ENOENT, pathS);
    }
    if (target instanceof Directory) {
      throw new FSError(errno.code.EISDIR, pathS);
    }
    const encoding =
          typeof optionsOrEncoding === "object"
          ? optionsOrEncoding.encoding
          : optionsOrEncoding;
    return encoding ? target.read().toString(encoding) : cloneBuffer(target.read());
  }

  readdirSync (pathS) {
    let navigated = this._navigate(pathS, true);
    if (!navigated.target) {
      throw new FSError(errno.code.ENOENT, pathS);
    }
    if (navigated.target instanceof Symlink) {
      throw new FSError(errno.code.ENOTDIR, pathS);
    }
    return Object.keys(navigated.target.getEntries()).filter(function (v) {
      return v !== '.' && v !== '..';
    });
  }

  readlinkSync (pathS) {
    let target = this._navigate(pathS, false).target;
    if (!target) {
      throw new FSError(errno.code.ENOENT, pathS);
    }
    if (!(target instanceof Symlink)) {
      throw new FSError(errno.code.EINVAL, pathS);
    }
    return target.getLink();
  }

  linkSync (target, pathS) {
    let navigatedTarget;
    let navigatedSource;
    try {
      navigatedTarget = this._navigate(target, false);
      navigatedSource = this._navigate(pathS, false);
    } catch (e) {
      if (e instanceof FSError) {
        throw new FSError(errno.code.ENOENT, [target, pathS]);
      }
    }
    if (!navigatedTarget.target) {
      throw new FSError(errno.code.ENOENT, [target, pathS]);
    }
    if (navigatedTarget.target instanceof Directory) {
      throw new FSError(errno.code.EPERM, [target, pathS]);
    }
    if (!navigatedSource.target && !navigatedSource.name) {
      throw new FSError(errno.code.ENOENT, [target, pathS]);
    }
    if (!navigatedSource.target) {
      let index = navigatedTarget.dir.getEntryIndex(navigatedTarget.name);
      navigatedSource.dir.addEntry(navigatedSource.name, index);
      this._inodeMgr.linkINode(index);
    } else {
      throw new FSError(errno.code.EEXIST, [target, pathS]);
    }
    return;
  }

  unlinkSync (pathS) {
    let navigated = this._navigate(pathS, false);
    if (!navigated.target) {
      throw new FSError(errno.code.ENOENT, pathS);
    }
    if (navigated.target instanceof Directory) {
      throw new FSError(errno.code.EISDIR, pathS);
    }
    navigated.dir.deleteEntry(navigated.name);
    return;
  }

  renameSync(oldPathS, newPathS) {

    let navigatedSource = this._navigate(oldPathS, false);
    let navigatedTarget = this._navigate(newPathS, false);

    // neither oldPathS nor newPathS can point to root
    if (navigatedSource.target === this._root ||
        navigatedTarget.target === this._root)
    {
      throw new FSError(errno.code.EBUSY, [oldPathS, newPathS]);
    }

    // source must resolve to something
    // both source and target must resolve intermediate path segments
    if (!navigatedSource.target || (!navigatedTarget.target && !navigatedTarget.name)) {
      throw new FSError(errno.code.ENOENT, [oldPathS, newPathS]);
    }

    // if source is file, target must not be a directory
    if (navigatedSource.target instanceof File &&
        navigatedTarget.target instanceof Directory)
    {
      throw new FSError(errno.code.EISDIR, [oldPathS, newPathS]);
    }

    // if source is a directory, target must be a directory (if it exists)
    if (navigatedSource.target instanceof Directory &&
        navigatedTarget.target &&
        !(navigatedTarget.target instanceof Directory))
    {
      throw new FSError(errno.code.ENOTDIR, [oldPathS, newPathS]);
    }

    // if the target directory contains elements this cannot be done
    if (navigatedTarget.target instanceof Directory &&
        Object.keys(navigatedTarget.target.getEntries()) - 2)
    {
      throw new FSError(errno.code.ENOTEMPTY, [oldPathS, newPathS]);
    }

    // if they are in the same directory, it is simple rename
    if (navigatedSource.dir === navigatedTarget.dir) {
      navigatedSource.dir.renameEntry(navigatedSource.name, navigatedTarget.name);
      return;
    }

    if (navigatedTarget.target) {
      let index = navigatedSource.dir.getEntryIndex(navigatedSource.name);
      navigatedTarget.dir.deleteEntry(navigatedTarget.name);
      navigatedTarget.dir.addEntry(index, navigatedTarget.name);
      navigatedSource.dir.deleteEntry(index);
      return;
    } else {
      let index = navigatedSource.dir.getEntryIndex(navigatedSource.name);
      navigatedTarget.dir.addEntry(navigatedTarget.name, index);
      navigatedSource.dir.deleteEntry(navigatedSource.name);
      return;
    }

  }

  rmdirSync (pathS) {
    let navigated = this._navigate(pathS, false);
    if (!navigated.target) {
      throw new FSError(errno.code.ENOENT, pathS);
    }
    if (!(navigated.target instanceof Directory)) {
      throw new FSError(errno.code.ENOTDIR, pathS);
    }
    // this is for if the path resolved to root
    if (!navigated.name) {
      throw new FSError(errno.code.EBUSY, pathS);
    }
    // if this directory has subdirectory or files, then we cannot delete
    if (Object.keys(navigated.target.getEntries()).length - 2) {
      throw new FSError(errno.code.ENOTEMPTY, pathS);
    }
    navigated.dir.deleteEntry(navigated.name);
    return;
  }

  // needs file descriptor support
  // needs file table to track file descriptor status
  // process table of 1 cause only 1 process
  // the global process tracks all file descriptors
  // these file descriptors are then assocated with some state like seek position
  // the read and write handlers need to then write into the buffers
  // the existence of open file descriptors means that files or inodes are not fully deleted when they are acquired
  // that is they represent a separate reference count, remeber that means you don't fully delete everything until both references are empty, but all hardlinks can reach 0
  // then when a file is closed as in the case of closeSync, then the file descriptors are also closed and removed
  // we must assign the next available fildes number
  // note resource leaks can occur here!!
  openSync () {

  }

  readSync () {

  }

  writeSync () {

  }

  closeSync () {

  }

  createReadStream(pathS, options) {
    let stream = new ReadableStream();
    let done = false;
    let data;
    try {
      data = this.readFileSync(pathS);
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
      if (done) return;
      done = true;
      this.push(data.slice(options.start, options.end));
      this.push(null);
    };
    return stream;
  }

  createWriteStream (pathS) {
    let stream = new WritableStream();
    try {
      // Zero the file and make sure it is writable
      this.writeFileSync(pathS, new Buffer(0));
    } catch(e) {
      // This or setImmediate?
      stream.once('prefinish', function() {
        stream.emit('error', e);
      });
      return stream;
    }
    let bl = [], len = 0;
    stream._write = (chunk, encoding, callback) => {
      bl.push(chunk);
      len += chunk.length;
      this.writeFile(pathS, Buffer.concat(bl, len), callback);
    };
    return stream;
  }

  exists(pathS, callback) {
    return callback(this.existsSync(pathS));
  }

  writeFile (pathS, content, encoding, callback) {
    if(!callback) {
      callback = encoding;
      encoding = undefined;
    }
    try {
      this.writeFileSync(pathS, content, encoding);
    } catch(e) {
      return callback(e);
    }
    return callback();
  }

}

["stat", "lstat", "readdir", "mkdirp", "rmdir", "unlink", "readlink"].forEach(function(fn) {
  FS.prototype[fn] = function(pathS, callback) {
    let result;
    try {
      result = this[fn + "Sync"](pathS);
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

["mkdir", "readFile", "symlink", "link", "rename"].forEach(function(fn) {
  FS.prototype[fn] = function(pathS, optArg, callback) {
    if(!callback) {
      callback = optArg;
      optArg = undefined;
    }
    let result;
    try {
      result = this[fn + "Sync"](pathS, optArg);
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

exports.FSError = FSError;
exports.FS = FS;

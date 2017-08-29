'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _Array$from = _interopDefault(require('babel-runtime/core-js/array/from'));
var _Set = _interopDefault(require('babel-runtime/core-js/set'));
var _extends = _interopDefault(require('babel-runtime/helpers/extends'));
var _setImmediate = _interopDefault(require('babel-runtime/core-js/set-immediate'));
var buffer = require('buffer');
var pathBrowserify = require('path-browserify');
var errno = _interopDefault(require('errno'));
var _Map = _interopDefault(require('babel-runtime/core-js/map'));
var Counter = _interopDefault(require('resource-counter'));
var readableStream = require('readable-stream');

var constants = {
  O_RDONLY: 0,
  O_WRONLY: 1,
  O_RDWR: 2,
  S_IFMT: 61440,
  S_IFREG: 32768,
  S_IFDIR: 16384,
  S_IFCHR: 8192,
  S_IFBLK: 24576,
  S_IFIFO: 4096,
  S_IFLNK: 40960,
  S_IFSOCK: 49152,
  O_CREAT: 64,
  O_EXCL: 128,
  O_NOCTTY: 256,
  O_TRUNC: 512,
  O_APPEND: 1024,
  O_DIRECTORY: 65536,
  O_NOATIME: 262144,
  O_NOFOLLOW: 131072,
  O_SYNC: 1052672,
  O_DIRECT: 16384,
  O_NONBLOCK: 2048,
  S_IRWXU: 448,
  S_IRUSR: 256,
  S_IWUSR: 128,
  S_IXUSR: 64,
  S_IRWXG: 56,
  S_IRGRP: 32,
  S_IWGRP: 16,
  S_IXGRP: 8,
  S_IRWXO: 7,
  S_IROTH: 4,
  S_IWOTH: 2,
  S_IXOTH: 1,
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  X_OK: 1
};

/** @module Stat */

/**
 * Class representing Stat metadata.
 */
class Stat {

  /**
   * Creates Stat.
   */
  constructor(props) {
    this.dev = props.dev || 0; // in-memory has no devices
    this.ino = props.ino;
    this.mode = props.mode;
    this.nlink = props.nlink;
    this.uid = props.uid || 0; // in-memory usage is always root
    this.gid = props.gid || 0; // in-memory usage is always root
    this.rdev = props.rdev || 0; // is 0 for regular files and directories
    this.size = props.size;
    this.blksize = undefined; // in-memory doesn't have blocks
    this.blocks = undefined; // in-memory doesn't have blocks
    this.atime = props.atime;
    this.mtime = props.mtime;
    this.ctime = props.ctime;
    this.birthtime = props.birthtime;
  }

  /**
   * Checks if file.
   */
  isFile() {
    return !!(this.mode & constants.S_IFREG);
  }

  /**
   * Checks if directory.
   */
  isDirectory() {
    return !!(this.mode & constants.S_IFDIR);
  }

  /**
   * Checks if block device.
   */
  isBlockDevice() {
    return false;
  }

  /**
   * Checks if character device.
   */
  isCharacterDevice() {
    return false;
  }

  /**
   * Checks if symbolic link.
   */
  isSymbolicLink() {
    return !!(this.mode & constants.S_IFLNK);
  }

  /**
   * Checks if FIFO.
   */
  isFIFO() {
    return false;
  }

  /**
   * Checks if socket.
   */
  isSocket() {
    return false;
  }

}

/** @module INodes */

/**
 * Class representing an iNode.
 */
class INode {

  /**
   * Creates iNode.
   * INode and INodeManager will recursively call each other.
   */
  constructor(metadata, iNodeMgr) {
    const now = new Date();
    this._metadata = new Stat(_extends({}, metadata, {
      mode: metadata.mode | constants.S_IRWXU | constants.S_IRWXG | constants.S_IRWXO,
      nlink: metadata.nlink || 0,
      atime: now,
      mtime: now,
      ctime: now,
      birthtime: now
    }));
    this._iNodeMgr = iNodeMgr;
  }

  /**
   * Gets the Stat metadata instance.
   */
  getMetadata() {
    return this._metadata;
  }

}

/**
 * Class representing a file.
 * @extends INode
 */
class File extends INode {

  /**
   * Creates a file.
   */
  constructor(props, iNodeMgr) {
    super({
      ino: props.ino,
      mode: constants.S_IFREG,
      size: props.data.byteLength
    }, iNodeMgr);
    this._data = props.data;
  }

  /**
   * Gets the file buffer.
   */
  getData() {
    return this._data;
  }

  /**
   * Sets the file buffer.
   */
  setData(data) {
    this._data = data;
    return;
  }

  /**
   * Noop.
   */
  destructor() {
    return;
  }

}

/**
 * Class representing a directory.
 * @extends INode
 */
class Directory extends INode {

  /**
   * Creates a directory.
   * Virtual directories have 0 size.
   * If there's no parent inode, we assume this is the root directory.
   */
  constructor(props, iNodeMgr) {
    // if we are at root, parent will equal current inode
    // if so we start with an nlink of 2
    // othewise increment the parent's nlink due to '..'
    // and we start the nlink at 1, because the parent will increment this nlink
    props.parent = props.parent || props.ino;
    let nlink;
    if (props.parent === props.ino) {
      nlink = 2;
    } else {
      nlink = 1;
      iNodeMgr.linkINode(props.parent);
    }
    super({
      ino: props.ino,
      nlink: nlink,
      mode: constants.S_IFDIR,
      size: 0
    }, iNodeMgr);
    this._dir = new _Map([['.', props.ino], ['..', props.parent]]);
  }

  /**
   * Gets all the names.
   */
  getEntries() {
    this._metadata.atime = new Date();
    return this._dir;
  }

  /**
   * Get the inode index for a name.
   */
  getEntryIndex(name) {
    return this._dir.get(name);
  }

  /**
   * Get inode for a name.
   */
  getEntry(name) {
    const index = this._dir.get(name);
    if (index) {
      return this._iNodeMgr.getINode(index);
    }
    return;
  }

  /**
   * Add a name to inode index to this directory.
   * It will increment the link reference to the inode.
   */
  addEntry(name, index) {
    const now = new Date();
    this._metadata.mtime = now;
    this._metadata.ctime = now;
    this._iNodeMgr.linkINode(index);
    this._dir.set(name, index);
    return;
  }

  /**
   * Delete a name in this directory.
   * It will decrement the link reference to the inode.
   */
  deleteEntry(name) {
    const index = this._dir.get(name);
    if (index) {
      const now = new Date();
      this._metadata.mtime = now;
      this._metadata.ctime = now;
      this._dir.delete(name);
      const iNode = this._iNodeMgr.getINode(index);
      if (iNode) {
        iNode.destructor();
        this._iNodeMgr.unlinkINode(index);
      }
    }
    return;
  }

  /**
   * Rename a name in this directory.
   */
  renameEntry(oldName, newName) {
    const index = this._dir.get(oldName);
    if (index) {
      const now = new Date();
      this._metadata.mtime = now;
      this._metadata.ctime = now;
      this._dir.delete(oldName);
      this._dir.set(newName, index);
    }
    return;
  }

  /**
   * This is to be called by the INodeManager all hardlinks to this directory reduce to 0.
   */
  destructor() {
    // decrement the parent's nlink due to '..', do not do this on root
    // otherwise there will be an infinite loop
    if (this._dir.get('.') !== this._dir.get('..')) {
      const index = this._dir.get('..');
      if (index) {
        this._iNodeMgr.unlinkINode(index);
      }
    }
    return;
  }

}

/**
 * Class representing a Symlink.
 * @extends INode
 */
class Symlink extends INode {

  /**
   * Creates a symlink.
   */
  constructor(props, iNodeMgr) {
    super({
      ino: props.ino,
      mode: constants.S_IFLNK,
      size: buffer.Buffer.from(props.link).byteLength
    }, iNodeMgr);
    this._link = props.link;
  }

  /**
   * Gets the link string.
   */
  getLink() {
    return this._link;
  }

  /**
   * Noop.
   */
  destructor() {
    return;
  }

}

/**
 * Class that manages all iNodes including creation and deletion
 */
class INodeManager {

  /**
   * Creates an instance of the INodeManager.
   * It starts the inode counter at 1, as 0 is usually reserved in posix filesystems.
   */
  constructor() {
    this._counter = new Counter(1);
    this._inodes = new _Map();
  }

  /**
   * Creates an inode, from a INode constructor function.
   * The returned inode index must be added as an entry into a directory.
   */
  createINode(iNodeConstructor, props) {
    props.ino = this._counter.allocate();
    this._inodes.set(props.ino, new iNodeConstructor(props, this));
    return props.ino;
  }

  /**
   * Gets the inode.
   */
  getINode(index) {
    return this._inodes.get(index);
  }

  /**
   * Links an inode, this increments the hardlink reference count.
   */
  linkINode(index) {
    const iNode = this._inodes.get(index);
    if (iNode) {
      ++iNode.getMetadata().nlink;
    }
    return;
  }

  /**
   * Unlinks an inode, this decrements the hardlink reference count.
   * If the hardlink reference count reaches 0, the inode is garbage collected.
   */
  unlinkINode(index) {
    const iNode = this._inodes.get(index);
    if (iNode) {
      const metadata = iNode.getMetadata();
      --metadata.nlink;
      if (metadata.nlink === 0) {
        this._inodes.delete(index);
        this._counter.deallocate(index);
      }
    }
    return;
  }

}

/** @module FileDescriptors */

/**
 * Class representing a File Descriptor
 */
class FileDescriptor {

  /**
   * Creates FileDescriptor
   * Starts the seek position at 0
   */
  constructor(inode, flags) {
    this._inode = inode;
    this._flags = flags;
    this._pos = 0;
  }

  /**
   * Gets an INode.
   */
  getINode() {
    return this._inode;
  }

  /**
   * Gets the file descriptor flags.
   * Unlike Linux filesystems, this retains creation and status flags.
   */
  getFlags() {
    return this._flags;
  }

  /**
   * Sets the file descriptor flags.
   */
  setFlags(flags) {
    this._flags = flags;
    return;
  }

  /**
   * Gets the file descriptor position.
   */
  getPos() {
    return this._pos;
  }

  /**
   * Sets the file descriptor position.
   * @throws {TypeError} Will throw if not a File INode
   */
  setPos(pos) {
    // if we seek pass the end of the file, it should keep the length of the data
    const iNode = this.getINode();
    switch (true) {
      case iNode instanceof File:
        const data = iNode.getData();
        this._pos = Math.min(data.length, pos);
      default:
        throw new TypeError('Invalid INode type for seeking');
    }
  }

  /**
   * Reads from this file descriptor into a buffer.
   * It will always try to fill the input buffer.
   * If position is specified, the position change does not persist.
   * If the current file descriptor position is greater than the length of the data, this will read 0 bytes.
   * @throws {TypeError} Will throw if not a File INode
   */
  read(buffer$$1, position = null) {
    let currentPosition;
    if (position === null) {
      currentPosition = this._pos;
    } else {
      currentPosition = position;
    }
    const iNode = this._inode;
    let bytesRead;
    switch (true) {
      case iNode instanceof File:
        const data = iNode.getData();
        const metadata = iNode.getMetadata();
        bytesRead = data.copy(buffer$$1, 0, currentPosition);
        metadata.atime = new Date();
        break;
      default:
        throw new TypeError('Invalid INode type for read');
    }
    if (position === null) {
      this._pos = currentPosition + bytesRead;
    }
    return bytesRead;
  }

  /**
   * Writes to this file descriptor.
   * If position is specified, the position change does not persist.
   * @throws {TypeError} Will throw if not a File INode
   */
  write(buffer$$1, position = null, extraFlags = 0) {
    let currentPosition;
    if (position === null) {
      currentPosition = this._pos;
    } else {
      currentPosition = position;
    }
    const iNode = this._inode;
    let bytesWritten;
    switch (true) {
      case iNode instanceof File:
        let data = iNode.getData();
        const metadata = iNode.getMetadata();
        if ((this.getFlags() | extraFlags) & constants.O_APPEND) {
          currentPosition = data.length;
          data = buffer.Buffer.concat([data, buffer$$1]);
          bytesWritten = buffer$$1.length;
        } else {
          currentPosition = Math.min(data.length, currentPosition);
          const overwrittenLength = data.length - currentPosition;
          const extendedLength = buffer$$1.length - overwrittenLength;
          if (extendedLength > 0) {
            data = buffer.Buffer.concat([data, buffer.Buffer.allocUnsafe(extendedLength)]);
          }
          bytesWritten = buffer$$1.copy(data, currentPosition);
        }
        iNode.setData(data);
        const now = new Date();
        metadata.mtime = now;
        metadata.ctime = now;
        metadata.size = data.length;
        break;
      default:
        throw new TypeError('Invalid INode type for write');
    }
    if (position === null) {
      this._pos = currentPosition + bytesWritten;
    }
    return bytesWritten;
  }

  /**
   * Truncates this file descriptor.
   * @throws {TypeError} Will throw if not a File INode
   */
  truncate(len = 0) {
    const iNode = this._inode;
    switch (true) {
      case iNode instanceof File:
        const data = iNode.getData();
        const metadata = iNode.getMetadata();
        let newData;
        if (len > data.length) {
          newData = buffer.Buffer.alloc(len);
          data.copy(newData, 0, 0, data.length);
          iNode.setData(newData);
        } else if (len < data.length) {
          newData = buffer.Buffer.allocUnsafe(len);
          data.copy(newData, 0, 0, len);
          iNode.setData(newData);
        } else {
          newData = data;
        }
        const now = new Date();
        metadata.mtime = now;
        metadata.ctime = now;
        metadata.size = newData.length;
        this._pos = Math.min(newData.length, this._pos);
        return;
      default:
        throw new TypeError('Invalid INode type for truncate');
    }
  }

}

/**
 * Class that manages all FileDescriptors
 */
class FileDescriptorManager {

  /**
   * Creates an instance of the FileDescriptorManager.
   * It starts the fd counter at 0.
   * Make sure not get real fd numbers confused with these fd numbers.
   */
  constructor() {
    this._counter = new Counter(0);
    this._fds = new _Map();
  }

  /**
   * Creates a file descriptor.
   * While a file descriptor is opened, the underlying iNode can still be garbage collected by the INodeManager, but it won't be garbage collected by JavaScript runtime.
   */
  createFd(inode, flags) {
    const index = this._counter.allocate();
    const fd = new FileDescriptor(inode, flags);
    this._fds.set(index, fd);
    return { index: index, fd: fd };
  }

  /**
   * Gets the file descriptor object.
   */
  getFd(index) {
    return this._fds.get(index);
  }

  /**
   * Deletes a file descriptor.
   * This effectively closes the file descriptor.
   */
  deleteFd(index) {
    this._counter.deallocate(index);
    this._fds.delete(index);
    return;
  }

}

/** @module Streams */

/**
 * Class representing a ReadStream.
 * @extends Readable
 */
class ReadStream extends readableStream.Readable {

  /**
   * Creates ReadStream.
   * It will asynchronously open the file descriptor if a file path was passed in.
   * It will automatically close the opened file descriptor by default.
   */
  constructor(path, options, fs) {
    super({
      encoding: options.encoding
    });
    this._fs = fs;
    this.bytesRead = 0;
    this.path = path;
    this.fd = options.fd === undefined ? null : options.fd;
    this.flags = options.flags === undefined ? 'r' : options.flags;
    this.autoClose = options.autoClose === undefined ? true : options.autoClose;
    this.start = options.start;
    this.end = options.end;
    this.done = false;
    if (typeof this.fd !== 'number') {
      this._open();
    }
    super.on('end', () => {
      if (this.autoClose) {
        super.destroy();
      }
    });
  }

  /**
   * Open file descriptor if ReadStream was constructed from a file path.
   * @private
   */
  _open() {
    this._fs.open(this.path, this.flags, (e, fd) => {
      if (e) {
        if (this.autoClose) {
          super.destroy();
        }
        super.emit('error', e);
        return;
      }
      this.fd = fd;
      super.emit('open', fd);
      super.read();
    });
  }

  /**
   * Read hook for stream implementation.
   * Because this is an in memory filesystem, we can push the entire buffer once on the first read.
   * This does not get affected by the highwater mark.
   * @private
   */
  _read(size) {
    if (typeof this.fd !== 'number') {
      return super.once('open', () => {
        this._read(size);
      });
    }
    if (this.destroyed) return;
    if (this.done) return;
    let buffer$$1;
    try {
      buffer$$1 = this._fs.readFileSync(this.fd);
      this.done = true;
    } catch (e) {
      super.emit('error', e);
      if (this.autoClose) {
        super.destroy();
      }
      return;
    }
    if (typeof this.start === 'number') {
      buffer$$1 = buffer$$1.slice(this.start, this.end + 1);
    }
    super.push(buffer$$1);
    super.push(null);
    this.bytesRead = buffer$$1.length;
    return;
  }

  /**
   * Destroy hook for stream implementation.
   * @private
   */
  _destroy(e, cb) {
    this._close(e_ => {
      cb(e || e_);
    });
  }

  /**
   * Close file descriptor if ReadStream was constructed from a file path.
   * @private
   */
  _close(cb) {
    if (cb) {
      super.once('close', cb);
    }
    if (typeof this.fd !== 'number') {
      super.once('open', () => {
        this._close();
      });
      return;
    }
    if (this.closed) {
      return _setImmediate(() => super.emit('close'));
    }
    this.closed = true;
    this._fs.close(this.fd, e => {
      if (e) {
        this.emit('error', e);
      } else {
        this.emit('close');
      }
    });
    this.fd = null;
  }

}

/**
 * Class representing a WriteStream.
 * @extends Writable
 */
class WriteStream extends readableStream.Writable {

  /**
   * Creates WriteStream.
   */
  constructor(path, options, fs) {
    super();
    this._fs = fs;
    this.bytesWritten = 0;
    this.path = path;
    this.fd = options.fd === undefined ? null : options.fd;
    this.flags = options.flags === undefined ? 'w' : options.flags;
    this.autoClose = options.autoClose === undefined ? true : options.autoClose;
    this.start = options.start;
    this.pos = this.start; // WriteStream maintains its own position
    this.destroySoon = super.end;
    if (options.encoding) {
      super.setDefaultEncoding(options.encoding);
    }
    if (typeof this.fd !== 'number') {
      this._open();
    }
    super.on('finish', () => {
      if (this.autoClose) {
        super.destroy();
      }
    });
  }

  /**
   * Open file descriptor if WriteStream was constructed from a file path.
   * @private
   */
  _open() {
    this._fs.open(this.path, this.flags, (e, fd) => {
      if (e) {
        if (this.autoClose) {
          super.destroy();
        }
        super.emit('error', e);
        return;
      }
      this.fd = fd;
      super.emit('open', fd);
    });
  }

  /**
   * Write hook for stream implementation.
   * @private
   */
  _write(data, encoding, cb) {
    if (typeof this.fd !== 'number') {
      return super.once('open', () => {
        this._write(data, encoding, cb);
      });
    }
    try {
      this.bytesWritten += this._fs.writeSync(this.fd, data, 0, data.length, this.pos);
    } catch (e) {
      if (this.autoClose) {
        super.destroy();
      }
      return cb(e);
    }
    if (this.pos !== undefined) {
      this.pos += data.length;
    }
    return cb();
  }

  /**
   * Vectorised write hook for stream implementation.
   * @private
   */
  _writev(chunks, cb) {
    this._write(buffer.Buffer.concat(chunks.map(chunk => chunk.chunk)), undefined, cb);
    return;
  }

  /**
   * Destroy hook for stream implementation.
   * @private
   */
  _destroy(e, cb) {
    this._close(e_ => {
      cb(e || e_);
    });
  }

  /**
   * Close file descriptor if WriteStream was constructed from a file path.
   * @private
   */
  _close(cb) {
    if (cb) {
      super.once('close', cb);
    }
    if (typeof this.fd !== 'number') {
      super.once('open', () => {
        this._close();
      });
      return;
    }
    if (this.closed) {
      return _setImmediate(() => super.emit('close'));
    }
    this.closed = true;
    this._fs.close(this.fd, e => {
      if (e) {
        this.emit('error', e);
      } else {
        this.emit('close');
      }
    });
    this.fd = null;
  }

  /**
   * Final hook for stream implementation.
   * @private
   */
  _final(cb) {
    cb();
    return;
  }

}

/** @module VirtualFS */

/**
 * Class representing a file system error.
 * @extends Error
 */
class VirtualFSError extends Error {

  /**
   * Creates VirtualFSError.
   */
  constructor(errorSys, path = null, dest = null, syscall = null) {
    let message = errorSys.code + ': ' + errorSys.description;
    if (path) {
      message += ', ' + path;
      if (dest) {
        message += ' -> ' + dest;
      }
    }
    super(message);
    this.errno = errorSys.errno;
    this.code = errorSys.code;
    if (syscall) {
      this.syscall = syscall;
    }
  }

}

/**
 * Class representing a virtual filesystem.
 */
class VirtualFS {

  /**
   * Creates VirtualFS.
   */
  constructor() {
    this._inodeMgr = new INodeManager();
    this._fdMgr = new FileDescriptorManager();
    let rootIndex = this._inodeMgr.createINode(Directory, {});
    this._root = this._inodeMgr.getINode(rootIndex);
    this.constants = constants;
    this.ReadStream = ReadStream;
    this.WriteStream = WriteStream;
  }

  /**
   * Takes a callback, and if undefined, will return a default callback.
   * Used for asynchronous calling styles in accordance with Node behaviour.
   * @private
   */
  _maybeCallback(callback) {
    return typeof callback === 'function' ? callback : err => {
      if (err) throw err;
    };
  }

  /**
   * Sets up an asynchronous call in accordance with Node behaviour.
   * @private
   */
  _callAsync(syncFn, args, successCall, failCall) {
    try {
      let result = syncFn(...args);
      result = result === undefined ? null : result;
      _setImmediate(() => {
        successCall(result);
      });
    } catch (e) {
      _setImmediate(() => {
        failCall(e);
      });
    }
    return;
  }

  /**
   * Takes a default set of options, and merges them into the user provided options.
   * This will also do a shallow clone of the options object so mutations on it won't affect the user supplied object.
   * @private
   */
  _getOptions(defaultOptions, options) {
    if (typeof options === 'string') {
      return _extends({}, defaultOptions, { encoding: options });
    } else {
      return _extends({}, defaultOptions, options);
    }
  }

  /**
   * Parses and extracts the first path segment.
   * @private
   */
  _parsePath(pathS) {
    const matches = pathS.match(/^([\s\S]*?)(?:\/+|$)([\s\S]*)/);
    if (matches) {
      let segment = matches[1] || '';
      let rest = matches[2] || '';
      return {
        segment: segment,
        rest: rest
      };
    } else {
      // this should not happen
      throw new Error('Could not parse pathS: ' + pathS);
    }
  }

  /**
   * Navigates the filesystem tree from root.
   * You can interpret the results like:
   *   target && !name  => dir is at /
   *   !target && !name => empty target with a remaining path, this generally means ENOENT
   *   !target && name  => empty target with a possible remaining path, this can mean ENOENT
   * This also builds the canonical path to the target (even when the target doesn't exist)
   * @private
   * @throws {VirtualFSError|TypeError} Will throw ENOENT if pathS is empty, should not throw TypeError
   */
  _navigate(pathS, resolveLastLink = true, activeSymlinks = new _Set()) {
    if (!pathS) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
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
        remaining: '',
        path: '/'
      };
    }
    return this._navigateFrom(this._root, pathS, resolveLastLink, activeSymlinks);
  }

  /**
   * Navigates the filesystem tree from a given directory.
   * @private
   * @throws {VirtualFSError|TypeError} Will throw ENOENT if pathS is empty, should not throw TypeError
   */
  _navigateFrom(curdir, pathS, resolveLastLink = true, activeSymlinks = new _Set(), pathStack = []) {
    if (!pathS) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    let parse = this._parsePath(pathS);
    if (parse.segment !== '.') {
      if (parse.segment === '..') {
        pathStack.pop(); // this is a noop if the pathStack is empty
      } else {
        pathStack.push(parse.segment);
      }
    }
    let target = curdir.getEntry(parse.segment);
    if (target === undefined) {
      return {
        dir: curdir,
        target: null,
        name: parse.segment,
        remaining: parse.rest,
        path: '/' + pathStack.join('/')
      };
    }
    switch (true) {
      case target instanceof File:
        if (!parse.rest) {
          return {
            dir: curdir,
            target: target,
            name: parse.segment,
            remaining: parse.rest,
            path: '/' + pathStack.join('/')
          };
        }
        return {
          dir: curdir,
          target: null,
          name: null,
          remaining: parse.rest,
          path: '/' + pathStack.join('/')
        };
      case target instanceof Directory:
        if (!parse.rest) {
          return {
            dir: curdir,
            target: target,
            name: parse.segment,
            remaining: parse.rest,
            path: '/' + pathStack.join('/')
          };
        }
        return this._navigateFrom(target, parse.rest, resolveLastLink, activeSymlinks, pathStack);
      case target instanceof Symlink:
        if (!resolveLastLink && !parse.rest) {
          return {
            dir: curdir,
            target: target,
            name: parse.segment,
            remaining: parse.rest,
            path: '/' + pathStack.join('/')
          };
        }
        if (activeSymlinks.has(target)) {
          throw new VirtualFSError(errno.code.ELOOP, pathS);
        } else {
          activeSymlinks.add(target);
        }
        pathStack.pop();
        const symlink = pathBrowserify.join(target.getLink(), parse.rest);
        if (symlink[0] === '/') {
          return this._navigate(symlink, resolveLastLink, activeSymlinks);
        } else {
          return this._navigateFrom(curdir, symlink, resolveLastLink, activeSymlinks, pathStack);
        }
      default:
        throw new TypeError('Non-exhaustive pattern matching');
    }
  }

  access(pathS, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.accessSync.bind(this), [pathS, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  accessSync(pathS, mode) {
    if (mode == undefined) {
      mode = this.constants.F_OK;
    }
    const target = this._navigate(pathS, true).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    const targetMode = target.getMetadata().mode;
    // our filesystem has no notion of users, groups and other
    // so we just directly map the access flags to user permissions flags
    let userMode = 0;
    switch (mode) {
      case this.constants.R_OK:
        userMode |= this.constants.S_IRUSR;
      case this.constants.W_OK:
        userMode |= this.constants.S_IWUSR;
      case this.constants.X_OK:
        userMode |= this.constants.S_IXUSR;
    }
    if ((targetMode & userMode) !== userMode) {
      throw new VirtualFSError(errno.code.EACCES, pathS);
    }
  }

  appendFile(file, data, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.appendFileSync.bind(this), [file, data, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  appendFileSync(file, data = 'undefined', options) {
    options = this._getOptions({ encoding: 'utf8', flag: 'a' }, options);
    if (!(data instanceof buffer.Buffer)) {
      data = buffer.Buffer.from(data.toString(), options.encoding);
    }
    let fdIndex;
    let fd;
    if (typeof file === 'string') {
      fdIndex = this.openSync(file, options.flag);
      fd = this._fdMgr.getFd(fdIndex);
    } else if (typeof file === 'number') {
      fd = this._fdMgr.getFd(file);
    } else {
      throw TypeError('file must be a string or number');
    }
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'appendFile');
    }
    try {
      fd.write(data, null, constants.O_APPEND);
    } catch (e) {
      if (e instanceof RangeError) {
        throw new VirtualFSError(errno.code.ENOSPC, null, null, 'appendFile');
      }
      throw e;
    }
    if (fdIndex !== undefined) this.closeSync(fdIndex);
    return;
  }

  chmod(pathS, mode, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.chmodSync.bind(this), [pathS, mode], callback, callback);
    return;
  }

  chmodSync(pathS, mode) {
    if (!this._navigate(pathS, true).target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    return;
  }

  chown(pathS, uid, gid, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.chownSync.bind(this), [pathS, uid, gid], callback, callback);
    return;
  }

  chownSync(pathS, uid, gid) {
    if (!this._navigate(pathS, true).target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    return;
  }

  close(fdIndex, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.closeSync.bind(this), [fdIndex], callback, callback);
    return;
  }

  closeSync(fdIndex) {
    if (!this._fdMgr.getFd(fdIndex)) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'close');
    }
    this._fdMgr.deleteFd(fdIndex);
    return;
  }

  createReadStream(pathS, options) {
    options = this._getOptions({
      flags: 'r',
      encoding: null,
      fd: null,
      autoClose: true
    }, options);
    if (options.start !== undefined) {
      if (typeof options.start !== 'number') {
        throw new TypeError('"start" option must be a Number');
      }
      if (options.end === undefined) {
        options.end = Infinity;
      } else if (typeof options.end !== 'number') {
        throw new TypeError('"end" option must be a Number');
      }
      if (options.start > options.end) {
        throw new RangeError('"start" option must be <= "end" option');
      }
    }
    return new ReadStream(pathS, options, this);
  }

  createWriteStream(pathS, options) {
    options = this._getOptions({
      flags: 'w',
      defaultEncoding: 'utf8',
      fd: null,
      autoClose: true
    }, options);
    if (options.start !== undefined) {
      if (typeof options.start !== 'number') {
        throw new TypeError('"start" option must be a Number');
      }
      if (options.start < 0) {
        throw new RangeError('"start" must be >= zero');
      }
    }
    return new WriteStream(pathS, options, this);
  }

  exists(pathS, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.existsSync.bind(this), [pathS], callback, callback);
    return;
  }

  existsSync(pathS) {
    try {
      return !!this._navigate(pathS, true).target;
    } catch (e) {
      return false;
    }
  }

  fchmod(fdIndex, mode, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.fchmodSync.bind(this), [fdIndex, mode], callback, callback);
    return;
  }

  fchmodSync(fdIndex, mode) {
    if (!this._fdMgr.getFd(fdIndex)) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fchmod');
    }
    return;
  }

  fchown(fdIndex, uid, gid, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.fchmodSync.bind(this), [fdIndex, uid, gid], callback, callback);
    return;
  }

  fchownSync(fdIndex, uid, gid) {
    if (!this._fdMgr.getFd(fdIndex)) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fchown');
    }
    return;
  }

  fdatasync(fdIndex, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.fchmodSync.bind(this), [fdIndex], callback, callback);
    return;
  }

  fdatasyncSync(fdIndex) {
    if (!this._fdMgr.getFd(fdIndex)) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fdatasync');
    }
    return;
  }

  fstat(fdIndex, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.fstatSync.bind(this), [fdIndex], callback, callback);
    return;
  }

  fstatSync(fdIndex) {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fstat');
    }
    return new Stat(_extends({}, fd.getINode().getMetadata()));
  }

  fsync(fdIndex, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.fsyncSync.bind(this), [fdIndex], callback, callback);
    return;
  }

  fsyncSync(fdIndex) {
    if (!this._fdMgr.getFd(fdIndex)) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fsync');
    }
    return;
  }

  ftruncate(fdIndex, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.ftruncateSync.bind(this), [fdIndex, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  ftruncateSync(fdIndex, len = 0) {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'ftruncate');
    }
    const flags = fd.getFlags();
    if (!(flags & (constants.O_WRONLY | constants.O_RDWR))) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'ftruncate');
    }
    fd.truncate(len);
    return;
  }

  futimes(fdIndex, atime, mtime, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.futimesSync.bind(this), [fdIndex, atime, mtime], callback, callback);
    return;
  }

  futimesSync(fdIndex, atime, mtime) {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'futimes');
    }
    const metadata = fd.getINode().getMetadata();
    let newAtime;
    if (typeof atime === 'number') {
      newAtime = new Date(atime * 1000);
    } else if (atime instanceof Date) {
      newAtime = atime;
    } else {
      throw TypeError('atime and mtime must be dates or unixtime in seconds');
    }
    let newMtime;
    if (typeof mtime === 'number') {
      newMtime = new Date(mtime * 1000);
    } else if (mtime instanceof Date) {
      newMtime = mtime;
    } else {
      throw TypeError('atime and mtime must be dates or unixtime in seconds');
    }
    metadata.atime = newAtime;
    metadata.mtime = newMtime;
    metadata.ctime = new Date();
    return;
  }

  lchmod(pathS, mode, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.lchmodSync.bind(this), [pathS, mode], callback, callback);
    return;
  }

  lchmodSync(pathS, mode) {
    if (!this._navigate(pathS, false).target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    return;
  }

  lchown(pathS, uid, gid, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.lchownSync.bind(this), [pathS, uid, gid], () => callback(null), callback);
    return;
  }

  lchownSync(pathS, uid, gid) {
    if (!this._navigate(pathS, false).target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    return;
  }

  link(target, pathS, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.linkSync.bind(this), [target, pathS], callback, callback);
    return;
  }

  linkSync(existingPathS, newPathS) {
    let navigatedExisting;
    let navigatedNew;
    try {
      navigatedExisting = this._navigate(existingPathS, false);
      navigatedNew = this._navigate(newPathS, false);
    } catch (e) {
      if (e instanceof VirtualFSError) {
        throw new VirtualFSError(errno.code.ENOENT, existingPathS, newPathS);
      }
    }
    if (!navigatedExisting.target) {
      throw new VirtualFSError(errno.code.ENOENT, existingPathS, newPathS);
    }
    if (navigatedExisting.target instanceof Directory) {
      throw new VirtualFSError(errno.code.EPERM, existingPathS, newPathS);
    }
    if (!navigatedNew.target && !navigatedNew.name) {
      throw new VirtualFSError(errno.code.ENOENT, existingPathS, newPathS);
    }
    if (!navigatedNew.target) {
      let index = navigatedExisting.dir.getEntryIndex(navigatedExisting.name);
      navigatedNew.dir.addEntry(navigatedNew.name, index);
      this._inodeMgr.linkINode(index);
      navigatedExisting.target.getMetadata().ctime = new Date();
    } else {
      throw new VirtualFSError(errno.code.EEXIST, existingPathS, newPathS);
    }
    return;
  }

  lstat(pathS, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.lstatSync.bind(this), [pathS], stat => callback(null, stat), callback);
    return;
  }

  lstatSync(pathS) {
    const target = this._navigate(pathS, false).target;
    if (target) {
      return new Stat(_extends({}, target.getMetadata()));
    } else {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
  }

  mkdir(pathS, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.mkdirSync.bind(this), [pathS, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  mkdirSync(pathS, mode) {
    let navigated = this._navigate(pathS, true);
    if (!navigated.target && !navigated.name) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    } else if (!navigated.target && navigated.remaining) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    } else if (!navigated.target) {
      let index = this._inodeMgr.createINode(Directory, { parent: navigated.dir.getEntryIndex('.') });
      navigated.dir.addEntry(navigated.name, index);
    } else if (!(navigated.target instanceof Directory)) {
      throw new VirtualFSError(errno.code.ENOTDIR, pathS);
    } else {
      throw new VirtualFSError(errno.code.EEXIST, pathS);
    }
    return;
  }

  mkdirp(pathS, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.mkdirpSync.bind(this), [pathS, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  mkdirpSync(pathS, mode) {
    let current = null;
    let navigated = this._navigate(pathS, true);
    while (true) {
      if (!navigated.target && !navigated.name) {
        throw new VirtualFSError(errno.code.ENOTDIR, pathS);
      } else if (!navigated.target) {
        let index = this._inodeMgr.createINode(Directory, { parent: navigated.dir.getEntryIndex('.') });
        navigated.dir.addEntry(navigated.name, index);
        if (navigated.remaining) {
          current = this._inodeMgr.getINode(index);
          navigated = this._navigateFrom(current, navigated.remaining, true);
        } else {
          break;
        }
      } else if (!(navigated.target instanceof Directory)) {
        throw new VirtualFSError(errno.code.ENOTDIR, pathS);
      } else {
        break;
      }
    }
    return;
  }

  mkdtemp(pathSPrefix, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.realpathSync.bind(this), [pathSPrefix, ...args.slice(0, cbIndex)], pathS => callback(null, pathS), callback);
    return;
  }

  mkdtempSync(pathSPrefix, options) {
    options = this._getOptions({ encoding: 'utf8' }, options);
    if (!pathSPrefix || typeof pathSPrefix !== 'string') {
      throw new TypeError('filename prefix is required');
    }
    const getChar = () => {
      const possibleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      return possibleChars[Math.floor(Math.random() * possibleChars.length)];
    };
    let pathS;
    while (true) {
      pathS = pathSPrefix.concat(_Array$from({ length: 6 }, () => getChar).map(f => f()).join(''));
      try {
        this.mkdirSync(pathS);
        if (options.encoding === 'buffer') {
          return buffer.Buffer.from(pathS);
        } else {
          return buffer.Buffer.from(pathS).toString(options.encoding);
        }
      } catch (e) {
        if (e.code !== errno.code.EEXIST) {
          throw e;
        }
      }
    }
  }

  open(pathS, flags, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.openSync.bind(this), [pathS, flags, ...args.slice(0, cbIndex)], fdIndex => callback(null, fdIndex), callback);
    return;
  }

  openSync(pathS, flags, mode) {
    if (typeof flags === 'string') {
      switch (flags) {
        case 'r':
          flags = constants.O_RDONLY;
          break;
        case 'r+':
        case 'rs+':
          flags = constants.O_RDWR;
          break;
        case 'w':
          flags = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC;
          break;
        case 'wx':
          flags = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_EXCL;
          break;
        case 'w+':
          flags = constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC;
          break;
        case 'wx+':
          flags = constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC | constants.O_EXCL;
          break;
        case 'a':
          flags = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT;
          break;
        case 'ax':
          flags = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_EXCL;
          break;
        case 'a+':
          flags = constants.O_RDWR | constants.O_APPEND | constants.O_CREAT;
          break;
        case 'ax+':
          flags = constants.O_RDWR | constants.O_APPEND | constants.O_CREAT | constants.O_EXCL;
          break;
        default:
          throw new TypeError('Unknown file open flag: ' + flags);
      }
    }
    if (typeof flags !== 'number') {
      throw new TypeError('Unknown file open flag: ' + flags);
    }
    let navigated = this._navigate(pathS, false);
    if (navigated.target instanceof Symlink) {
      // cannot be symlink if O_NOFOLLOW
      if (flags & constants.O_NOFOLLOW) {
        throw new VirtualFSError(errno.code.ELOOP, pathS);
      }
      // cannot create exclusively if symlink
      if (flags & constants.O_CREAT && flags & constants.O_EXCL) {
        throw new VirtualFSError(errno.code.EEXIST, pathS);
      }
      navigated = this._navigateFrom(navigated.dir, navigated.name + navigated.remaining, true);
    }
    let target = navigated.target;
    // cannot be missing unless O_CREAT
    if (!target) {
      // O_CREAT only applies if there's a left over name without any remaining path
      if (navigated.name && !navigated.remaining && flags & constants.O_CREAT) {
        // always creates a regular file
        const index = this._inodeMgr.createINode(File, { data: buffer.Buffer.alloc(0) });
        navigated.dir.addEntry(navigated.name, index);
        target = this._inodeMgr.getINode(index);
      } else {
        throw new VirtualFSError(errno.code.ENOENT, pathS);
      }
    } else {
      // target already exists cannot be created exclusively
      if (flags & constants.O_CREAT && flags & constants.O_EXCL) {
        throw new VirtualFSError(errno.code.EEXIST, pathS);
      }
      // cannot be directory if write capabilities are requested
      if (target instanceof Directory && flags & (constants.O_WRONLY | flags & constants.O_RDWR)) {
        throw new VirtualFSError(errno.code.EISDIR, pathS);
      }
      // must be directory if O_DIRECTORY
      if (flags & constants.O_DIRECTORY && !(target instanceof Directory)) {
        throw new VirtualFSError(errno.code.ENOTDIR, pathS);
      }
      // must truncate a file if O_TRUNC
      if (flags & constants.O_TRUNC && target instanceof File && flags & (constants.O_WRONLY | constants.O_RDWR)) {
        target.setData(buffer.Buffer.alloc(0));
      }
    }
    return this._fdMgr.createFd(target, flags).index;
  }

  read(fdIndex, buffer$$1, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.readSync.bind(this), [fdIndex, buffer$$1, ...args.slice(0, cbIndex)], bytesRead => callback(null, bytesRead, buffer$$1), callback);
    return;
  }

  readSync(fdIndex, buffer$$1, offset = 0, length = 0, position = null) {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'read');
    }
    if (typeof position === 'number' && position < 0) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'read');
    }
    if (fd.getINode().getMetadata().isDirectory()) {
      throw new VirtualFSError(errno.code.EISDIR, null, null, 'read');
    }
    const flags = fd.getFlags();
    if (flags !== constants.O_RDONLY && !(flags & constants.O_RDWR)) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'read');
    }
    if (offset < 0 || offset > buffer$$1.length) {
      throw new RangeError('Offset is out of bounds');
    }
    if (length < 0 || length > buffer$$1.length) {
      throw new RangeError('Length extends beyond buffer');
    }
    buffer$$1 = buffer$$1.slice(offset, offset + length);
    return fd.read(buffer$$1, position);
  }

  readdir(pathS, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.readdirSync.bind(this), [pathS, ...args.slice(0, cbIndex)], files => callback(null, files), callback);
    return;
  }

  readdirSync(pathS, options) {
    options = this._getOptions({ encoding: 'utf8' }, options);
    let navigated = this._navigate(pathS, true);
    if (!navigated.target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    if (navigated.target instanceof Symlink) {
      throw new VirtualFSError(errno.code.ENOTDIR, pathS);
    }
    return _Array$from(navigated.target.getEntries().keys()).filter(name => name !== '.' && name !== '..').map(name => {
      if (options.encoding === 'buffer') {
        return buffer.Buffer.from(name);
      } else {
        return buffer.Buffer.from(name).toString(options.encoding);
      }
    });
  }

  readFile(file, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.readFileSync.bind(this), [file, ...args.slice(0, cbIndex)], data => callback(null, data), callback);
    return;
  }

  readFileSync(file, options) {
    options = this._getOptions({ encoding: null, flag: 'r' }, options);
    let fdIndex;
    let fd;
    if (typeof file === 'string') {
      fdIndex = this.openSync(file, options.flag);
      fd = this._fdMgr.getFd(fdIndex);
    } else if (typeof file === 'number') {
      fd = this._fdMgr.getFd(file);
    } else {
      throw TypeError('file must be a string or number');
    }
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'readFile');
    }
    if (fd.getINode().getMetadata().isDirectory()) {
      throw new VirtualFSError(errno.code.EISDIR, null, null, 'readFile');
    }
    // as an in-memory filesystem, we can cheat here and get the data directly
    // but doing so, results in circumventing the file descriptor semantics
    // so instead we cheat less by getting the full length minus the fd position
    const bufferLength = fd.getINode().getData().length;
    const fdPosition = fd.getPos();
    const buffer$$1 = buffer.Buffer.allocUnsafe(bufferLength - fdPosition);
    fd.read(buffer$$1);
    if (fdIndex !== undefined) this.closeSync(fdIndex);
    return options.encoding ? buffer$$1.toString(options.encoding) : buffer$$1;
  }

  readlink(pathS, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.readlinkSync.bind(this), [pathS, ...args.slice(0, cbIndex)], linkString => callback(null, linkString), callback);
    return;
  }

  readlinkSync(pathS, options) {
    options = this._getOptions({ encoding: 'utf8' }, options);
    let target = this._navigate(pathS, false).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    if (!(target instanceof Symlink)) {
      throw new VirtualFSError(errno.code.EINVAL, pathS);
    }
    const link = target.getLink();
    if (options.encoding === 'buffer') {
      return buffer.Buffer.from(link);
    } else {
      return buffer.Buffer.from(link).toString(options.encoding);
    }
  }

  realpath(pathS, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.realpathSync.bind(this), [pathS, ...args.slice(0, cbIndex)], pathS => callback(null, pathS), callback);
    return;
  }

  realpathSync(pathS, options) {
    options = this._getOptions({ encoding: 'utf8' }, options);
    const navigated = this._navigate(pathS, true);
    if (!navigated.target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    if (options.encoding === 'buffer') {
      return buffer.Buffer.from(navigated.path);
    } else {
      return buffer.Buffer.from(navigated.path).toString(options.encoding);
    }
  }

  rename(oldPathS, newPathS, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.renameSync.bind(this), [oldPathS, newPathS], callback, callback);
    return;
  }

  renameSync(oldPathS, newPathS) {
    let navigatedSource = this._navigate(oldPathS, false);
    let navigatedTarget = this._navigate(newPathS, false);
    // neither oldPathS nor newPathS can point to root
    if (navigatedSource.target === this._root || navigatedTarget.target === this._root) {
      throw new VirtualFSError(errno.code.EBUSY, oldPathS, newPathS);
    }
    // source must resolve to something
    // both source and target must resolve intermediate path segments
    if (!navigatedSource.target || !navigatedTarget.target && !navigatedTarget.name) {
      throw new VirtualFSError(errno.code.ENOENT, oldPathS, newPathS);
    }
    // if source is file, target must not be a directory
    if (navigatedSource.target instanceof File && navigatedTarget.target instanceof Directory) {
      throw new VirtualFSError(errno.code.EISDIR, oldPathS, newPathS);
    }
    // if source is a directory, target must be a directory (if it exists)
    if (navigatedSource.target instanceof Directory && navigatedTarget.target && !(navigatedTarget.target instanceof Directory)) {
      throw new VirtualFSError(errno.code.ENOTDIR, oldPathS, newPathS);
    }
    // if the target directory contains elements this cannot be done
    if (navigatedTarget.target instanceof Directory && _Array$from(navigatedTarget.target.getEntries().keys()).length - 2) {
      throw new VirtualFSError(errno.code.ENOTEMPTY, oldPathS, newPathS);
    }
    // if they are in the same directory, it is simple rename
    if (navigatedSource.dir === navigatedTarget.dir) {
      navigatedSource.dir.renameEntry(navigatedSource.name, navigatedTarget.name);
      return;
    }
    navigatedSource.target.getMetadata().ctime = new Date();
    if (navigatedTarget.target) {
      let index = navigatedSource.dir.getEntryIndex(navigatedSource.name);
      navigatedTarget.target.getMetadata().ctime = new Date();
      navigatedTarget.dir.deleteEntry(navigatedTarget.name);
      navigatedTarget.dir.addEntry(navigatedTarget.name, index);
      navigatedSource.dir.deleteEntry(index);
      return;
    } else {
      let index = navigatedSource.dir.getEntryIndex(navigatedSource.name);
      navigatedTarget.dir.addEntry(navigatedTarget.name, index);
      navigatedSource.dir.deleteEntry(navigatedSource.name);
      return;
    }
  }

  rmdir(pathS, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.rmdirSync.bind(this), [pathS], callback, callback);
    return;
  }

  rmdirSync(pathS) {
    let navigated = this._navigate(pathS, false);
    if (!navigated.target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    if (!(navigated.target instanceof Directory)) {
      throw new VirtualFSError(errno.code.ENOTDIR, pathS);
    }
    // this is for if the path resolved to root
    if (!navigated.name) {
      throw new VirtualFSError(errno.code.EBUSY, pathS);
    }
    // if this directory has subdirectory or files, then we cannot delete
    if (_Array$from(navigated.target.getEntries().keys()).length - 2) {
      throw new VirtualFSError(errno.code.ENOTEMPTY, pathS);
    }
    navigated.dir.deleteEntry(navigated.name);
    return;
  }

  stat(pathS, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.statSync.bind(this), [pathS], stat => callback(null, stat), callback);
    return;
  }

  statSync(pathS) {
    const target = this._navigate(pathS, true).target;
    if (target) {
      return new Stat(_extends({}, target.getMetadata()));
    } else {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
  }

  symlink(target, pathS, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.symlinkSync.bind(this), [target, pathS, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  symlinkSync(target, pathS, type = 'file') {
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS, target);
    }
    let navigated = this._navigate(pathS, false);
    if (!navigated.target && !navigated.name) {
      throw new VirtualFSError(errno.code.ENOENT, pathS, target);
    } else if (!navigated.target) {
      let index = this._inodeMgr.createINode(Symlink, { link: target });
      navigated.dir.addEntry(navigated.name, index);
      return;
    } else {
      throw new VirtualFSError(errno.code.EEXIST, pathS, target);
    }
  }

  truncate(file, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.truncateSync.bind(this), [file, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  truncateSync(file, len = 0) {
    if (typeof file === 'string') {
      const fdIndex = this.openSync(file, 'r+');
      this.ftruncateSync(fdIndex, len);
      this.closeSync(fdIndex);
    } else if (typeof file === 'number') {
      this.ftruncateSync(file, len);
    } else {
      throw TypeError('file must be a string or number');
    }
    return;
  }

  unlink(pathS, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.unlinkSync.bind(this), [pathS], callback, callback);
    return;
  }

  unlinkSync(pathS) {
    let navigated = this._navigate(pathS, false);
    if (!navigated.target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    if (navigated.target instanceof Directory) {
      throw new VirtualFSError(errno.code.EISDIR, pathS);
    }
    navigated.target.getMetadata().ctime = new Date();
    navigated.dir.deleteEntry(navigated.name);
    return;
  }

  utimes(pathS, atime, mtime, callback) {
    callback = this._maybeCallback(callback);
    this._callAsync(this.utimesSync.bind(this), [pathS, atime, mtime], callback, callback);
    return;
  }

  utimesSync(pathS, atime, mtime) {
    const target = this._navigate(pathS, true).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, pathS);
    }
    const metadata = target.getMetadata();
    let newAtime;
    if (typeof atime === 'string') {
      atime = parseInt(atime);
    }
    if (typeof mtime === 'string') {
      mtime = parseInt(mtime);
    }
    if (typeof atime === 'number') {
      newAtime = new Date(atime * 1000);
    } else if (atime instanceof Date) {
      newAtime = atime;
    } else {
      throw TypeError('atime and mtime must be dates or unixtime in seconds');
    }
    let newMtime;
    if (typeof mtime === 'number') {
      newMtime = new Date(mtime * 1000);
    } else if (mtime instanceof Date) {
      newMtime = mtime;
    } else {
      throw TypeError('atime and mtime must be dates or unixtime in seconds');
    }
    metadata.atime = newAtime;
    metadata.mtime = newMtime;
    metadata.ctime = new Date();
    return;
  }

  write(fdIndex, data, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.writeSync.bind(this), [fdIndex, data, ...args.slice(0, cbIndex)], bytesWritten => callback(null, bytesWritten, data), callback);
    return;
  }

  writeSync(fdIndex, data, offsetOrPos, lengthOrEncoding, position = null) {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'write');
    }
    if (typeof position === 'number' && position < 0) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'write');
    }
    const flags = fd.getFlags();
    if (!(flags & (constants.O_WRONLY | constants.O_RDWR))) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'write');
    }
    let buffer$$1;
    if (data instanceof buffer.Buffer) {
      if (offsetOrPos < 0 || offsetOrPos > data.length) {
        throw new RangeError('Offset is out of bounds');
      }
      if (lengthOrEncoding < 0 || lengthOrEncoding > data.length) {
        throw new RangeError('Length is out of bounds');
      }
      buffer$$1 = data.slice(offsetOrPos, offsetOrPos + lengthOrEncoding);
    } else {
      position = offsetOrPos;
      buffer$$1 = buffer.Buffer.from(data.toString(), lengthOrEncoding);
    }
    try {
      return fd.write(buffer$$1, position);
    } catch (e) {
      if (e instanceof RangeError) {
        throw new VirtualFSError(errno.code.ENOSPC, null, null, 'write');
      }
      throw e;
    }
  }

  writeFile(file, data, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = this._maybeCallback(args[cbIndex]);
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.writeFileSync.bind(this), [file, data, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  writeFileSync(file, data = 'undefined', options) {
    options = this._getOptions({ encoding: 'utf8', flag: 'w' }, options);
    let fdIndex;
    if (typeof file === 'string') {
      fdIndex = this.openSync(file, options.flag);
    } else if (typeof file !== 'number') {
      throw TypeError('file must be a string or number');
    }
    let buffer$$1;
    if (typeof data === 'string') {
      buffer$$1 = buffer.Buffer.from(data, options.encoding);
    } else {
      buffer$$1 = data;
    }
    if (fdIndex !== undefined) {
      this.writeSync(fdIndex, buffer$$1, 0, buffer$$1.length, 0);
    } else {
      this.writeSync(file, buffer$$1, 0, buffer$$1.length, 0);
    }
    if (fdIndex !== undefined) this.closeSync(fdIndex);
    return;
  }

}

exports.VirtualFS = VirtualFS;
exports.VirtualFSError = VirtualFSError;

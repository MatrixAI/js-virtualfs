'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _Set = _interopDefault(require('babel-runtime/core-js/set'));
var _Array$from = _interopDefault(require('babel-runtime/core-js/array/from'));
var _extends = _interopDefault(require('babel-runtime/helpers/extends'));
var _slicedToArray = _interopDefault(require('babel-runtime/helpers/slicedToArray'));
var buffer = require('buffer');
var process = require('process');
var process__default = _interopDefault(process);
var pathNode = _interopDefault(require('path'));
var permaProxy = _interopDefault(require('permaproxy'));
var _Object$freeze = _interopDefault(require('babel-runtime/core-js/object/freeze'));
var _Map = _interopDefault(require('babel-runtime/core-js/map'));
var Counter = _interopDefault(require('resource-counter'));
var _WeakMap = _interopDefault(require('babel-runtime/core-js/weak-map'));
var errno = require('errno');
var stream = require('stream');
var randomBytes = _interopDefault(require('secure-random-bytes'));

var constants = _Object$freeze({
  O_RDONLY: 0,
  O_WRONLY: 1,
  O_RDWR: 2,
  O_ACCMODE: 3,
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
  X_OK: 1,
  COPYFILE_EXCL: 1,
  SEEK_SET: 0,
  SEEK_CUR: 1,
  SEEK_END: 2,
  MAP_SHARED: 1,
  MAP_PRIVATE: 2
});

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
    this.uid = props.uid;
    this.gid = props.gid;
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
    return (this.mode & constants.S_IFMT) == constants.S_IFREG;
  }

  /**
   * Checks if directory.
   */
  isDirectory() {
    return (this.mode & constants.S_IFMT) == constants.S_IFDIR;
  }

  /**
   * Checks if block device.
   */
  isBlockDevice() {
    return (this.mode & constants.S_IFMT) == constants.S_IFBLK;
  }

  /**
   * Checks if character device.
   */
  isCharacterDevice() {
    return (this.mode & constants.S_IFMT) == constants.S_IFCHR;
  }

  /**
   * Checks if symbolic link.
   */
  isSymbolicLink() {
    return (this.mode & constants.S_IFMT) == constants.S_IFLNK;
  }

  /**
   * Checks if FIFO.
   */
  isFIFO() {
    return (this.mode & constants.S_IFMT) == constants.S_IFIFO;
  }

  /**
   * Checks if socket.
   */
  isSocket() {
    return (this.mode & constants.S_IFMT) == constants.S_IFSOCK;
  }

}

class CurrentDirectory {

  constructor(iNodeMgr, iNode, curPath = []) {
    this._iNodeMgr = iNodeMgr;
    this._iNode = iNode;
    this._curPath = curPath;
    iNodeMgr.refINode(iNode);
  }

  changeDir(iNode, curPath) {
    this._iNodeMgr.refINode(iNode);
    this._iNodeMgr.unrefINode(this._iNode);
    this._iNode = iNode;
    this._curPath = curPath;
    return;
  }

  getINode() {
    return this._iNode;
  }

  getPathStack() {
    return [...this._curPath];
  }

  getPath() {
    return '/' + this._curPath.join('/');
  }

}

/**
 * Default root uid.
 */

/** @module Permissions */

const DEFAULT_ROOT_UID = 0;

/**
 * Default root gid.
 */
const DEFAULT_ROOT_GID = 0;

/**
 * Default root directory permissions of `rwxr-xr-x`.
 */
const DEFAULT_ROOT_PERM = constants.S_IRWXU | constants.S_IRGRP | constants.S_IXGRP | constants.S_IROTH | constants.S_IXOTH;

/**
 * Default file permissions of `rw-rw-rw-`.
 */
const DEFAULT_FILE_PERM = constants.S_IRUSR | constants.S_IWUSR | constants.S_IRGRP | constants.S_IWGRP | constants.S_IROTH | constants.S_IWOTH;

/**
 * Default directory permissions of `rwxrwxrwx`.
 */
const DEFAULT_DIRECTORY_PERM = constants.S_IRWXU | constants.S_IRWXG | constants.S_IRWXO;

/**
 * Default symlink permissions of `rwxrwxrwx`.
 */
const DEFAULT_SYMLINK_PERM = constants.S_IRWXU | constants.S_IRWXG | constants.S_IRWXO;

/**
 * Applies umask to default set of permissions.
 */
function applyUmask(perms, umask) {
  return perms & ~umask;
}

/**
 * Permission checking relies on ownership details of the iNode.
 * If the accessing user is the same as the iNode user, then only user permissions are used.
 * If the accessing group is the same as the iNode group, then only the group permissions are used.
 * Otherwise the other permissions are used.
 */
function resolveOwnership(uid, gid, stat) {
  if (uid === stat.uid) {
    return (stat.mode & constants.S_IRWXU) >> 6;
  } else if (gid === stat.gid) {
    return (stat.mode & constants.S_IRWXG) >> 3;
  } else {
    return stat.mode & constants.S_IRWXO;
  }
}

/**
 * Checks the desired permissions with user id and group id against the metadata of an iNode.
 * The desired permissions can be bitwise combinations of constants.R_OK, constants.W_OK and constants.X_OK.
 */
function checkPermissions(access, uid, gid, stat) {
  return (access & resolveOwnership(uid, gid, stat)) === access;
}

/** @module Devices */

const MAJOR_BITSIZE = 12;
const MINOR_BITSIZE = 20;
const MAJOR_MAX = Math.pow(2, MAJOR_BITSIZE) - 1;
const MINOR_MAX = Math.pow(2, MINOR_BITSIZE) - 1;
const MAJOR_MIN = 0;
const MINOR_MIN = 0;

class DeviceError extends Error {

  constructor(code$$1, message) {
    super(message);
    this.code = code$$1;
  }

}

Object.defineProperty(DeviceError, 'ERROR_RANGE', { value: 1 });

Object.defineProperty(DeviceError, 'ERROR_CONFLICT', { value: 2 });

class DeviceManager {

  constructor() {
    this._chrCounterMaj = new Counter(MAJOR_MIN);
    this._chrDevices = new _Map();
  }

  getChr(major, minor) {
    const devicesAndCounterMin = this._chrDevices.get(major);
    if (devicesAndCounterMin) {
      var _devicesAndCounterMin = _slicedToArray(devicesAndCounterMin, 1);

      const devicesMin = _devicesAndCounterMin[0];

      return devicesMin.get(minor);
    }
    return;
  }

  registerChr(device, major, minor) {
    let autoAllocMaj;
    let autoAllocMin;
    let counterMin;
    let devicesMin;
    try {
      if (major === undefined) {
        major = this._chrCounterMaj.allocate();
        autoAllocMaj = major;
      } else {
        const devicesCounterMin = this._chrDevices.get(major);
        if (!devicesCounterMin) {
          this._chrCounterMaj.allocate(major);
          autoAllocMaj = major;
        } else {
          var _devicesCounterMin = _slicedToArray(devicesCounterMin, 2);

          devicesMin = _devicesCounterMin[0];
          counterMin = _devicesCounterMin[1];
        }
      }
      if (!devicesMin || !counterMin) {
        counterMin = new Counter(MINOR_MIN);
        devicesMin = new _Map();
      }
      if (minor === undefined) {
        minor = counterMin.allocate();
        autoAllocMin = minor;
      } else {
        if (!devicesMin.has(minor)) {
          counterMin.allocate(minor);
          autoAllocMin = minor;
        } else {
          throw new DeviceError(DeviceError.ERROR_CONFLICT);
        }
      }
      if (major > MAJOR_MAX || major < MAJOR_MIN || minor > MINOR_MAX || minor < MINOR_MIN) {
        throw new DeviceError(DeviceError.ERROR_RANGE);
      }
      devicesMin.set(minor, device);
      this._chrDevices.set(major, [devicesMin, counterMin]);
      return;
    } catch (e) {
      if (autoAllocMaj != null) {
        this._chrCounterMaj.deallocate(autoAllocMaj);
      }
      if (autoAllocMin != null && counterMin) {
        counterMin.deallocate(autoAllocMin);
      }
      throw e;
    }
  }

  deregisterChr(major, minor) {
    const devicesCounterMin = this._chrDevices.get(major);
    if (devicesCounterMin) {
      var _devicesCounterMin2 = _slicedToArray(devicesCounterMin, 2);

      const devicesMin = _devicesCounterMin2[0],
            counterMin = _devicesCounterMin2[1];

      if (devicesMin.delete(minor)) {
        counterMin.deallocate(minor);
      }
      if (!devicesMin.size) {
        this._chrDevices.delete(major);
        this._chrCounterMaj.deallocate(major);
      }
    }
    return;
  }

}

function mkDev(major, minor) {
  return major << MINOR_BITSIZE | minor;
}

function unmkDev(dev) {
  const major = dev >> MINOR_BITSIZE;
  const minor = dev & (1 << MINOR_BITSIZE) - 1;
  return [major, minor];
}

// $FlowFixMe: Buffer exists
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
      mode: metadata.mode,
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
      uid: props.uid,
      gid: props.gid,
      mode: constants.S_IFREG | props.mode & ~constants.S_IFMT,
      size: props.data ? props.data.byteLength : 0
    }, iNodeMgr);
    this._data = props.data ? props.data : buffer.Buffer.allocUnsafe(0);
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

  read() {}

  write(buffer$$1, position, append) {
    let data = this._data;
    let bytesWritten;
    if (append) {
      data = buffer.Buffer.concat([data, buffer$$1]);
      bytesWritten = buffer$$1.length;
    } else {
      position = Math.min(data.length, position);
      const overwrittenLength = data.length - position;
      const extendedLength = buffer$$1.length - overwrittenLength;
      if (extendedLength > 0) {
        data = buffer.Buffer.concat([data, buffer.Buffer.allocUnsafe(extendedLength)]);
      }
      bytesWritten = buffer$$1.copy(data, position);
    }
    this._data = data;
    return bytesWritten;
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
    // root will start with an nlink of 2 due to '..'
    // otherwise start with an nlink of 1
    if (props.parent === undefined) props.parent = props.ino;
    let nlink;
    if (props.parent === props.ino) {
      nlink = 2;
    } else {
      nlink = 1;
      iNodeMgr.linkINode(iNodeMgr.getINode(props.parent));
    }
    super({
      ino: props.ino,
      mode: constants.S_IFDIR | props.mode & ~constants.S_IFMT,
      uid: props.uid,
      gid: props.gid,
      nlink: nlink,
      size: 0
    }, iNodeMgr);
    this._dir = new _Map([['.', props.ino], ['..', props.parent]]);
  }

  /**
   * Gets an iterator of name to iNode index.
   * This prevents giving out mutability.
   */
  getEntries() {
    this._metadata.atime = new Date();
    return this._dir.entries();
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
    if (index !== undefined) {
      return this._iNodeMgr.getINode(index);
    }
    return;
  }

  /**
   * Add a name to inode index to this directory.
   * It will increment the link reference to the inode.
   * It is not allowed to add entries with the names `.` and `..`.
   */
  addEntry(name, index) {
    if (name === '.' || name === '..') {
      throw new Error('Not allowed to add `.` or `..` entries');
    }
    const now = new Date();
    this._metadata.mtime = now;
    this._metadata.ctime = now;
    this._iNodeMgr.linkINode(this._iNodeMgr.getINode(index));
    this._dir.set(name, index);
    return;
  }

  /**
   * Delete a name in this directory.
   * It will decrement the link reference to the inode.
   * It is not allowed to delete entries with the names `.` and `..`.
   */
  deleteEntry(name) {
    if (name === '.' || name === '..') {
      throw new Error('Not allowed to delete `.` or `..` entries');
    }
    const index = this._dir.get(name);
    if (index !== undefined) {
      const now = new Date();
      this._metadata.mtime = now;
      this._metadata.ctime = now;
      this._dir.delete(name);
      this._iNodeMgr.unlinkINode(this._iNodeMgr.getINode(index));
    }
    return;
  }

  /**
   * Rename a name in this directory.
   */
  renameEntry(oldName, newName) {
    if (oldName === '.' || oldName === '..' || newName === '.' || oldName === '..') {
      throw new Error('Not allowed to rename `.` or `..` entries');
    }
    const index = this._dir.get(oldName);
    if (index != null) {
      const now = new Date();
      this._metadata.mtime = now;
      this._metadata.ctime = now;
      this._dir.delete(oldName);
      this._dir.set(newName, index);
    }
    return;
  }

  /**
   * This is to be called when all hardlinks and references to this directory reduce to 0.
   * The destructor here is about unlinking the parent directory.
   * Because the `..` will no longer exist.
   */
  destructor() {
    // decrement the parent's nlink due to '..'
    // however do not do this on root otherwise there will be an infinite loop
    if (this._dir.get('.') !== this._dir.get('..')) {
      const parentIndex = this._dir.get('..');
      if (parentIndex != null) {
        this._iNodeMgr.unlinkINode(this._iNodeMgr.getINode(parentIndex));
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
      mode: constants.S_IFLNK | props.mode & ~constants.S_IFMT,
      uid: props.uid,
      gid: props.gid,
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
 * Class representing a character device.
 * @extends INode
 */
class CharacterDev extends INode {

  /**
   * Creates a character device.
   */
  constructor(props, iNodeMgr) {
    super({
      ino: props.ino,
      mode: constants.S_IFCHR | props.mode & ~constants.S_IFMT,
      uid: props.uid,
      gid: props.gid,
      rdev: props.rdev,
      size: 0
    }, iNodeMgr);
  }

  getFileDesOps() {
    var _unmkDev = unmkDev(this.getMetadata().rdev),
        _unmkDev2 = _slicedToArray(_unmkDev, 2);

    const major = _unmkDev2[0],
          minor = _unmkDev2[1];

    return this._iNodeMgr._devMgr.getChr(major, minor);
  }

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
  constructor(devMgr) {
    this._counter = new Counter(1);
    this._iNodes = new _Map();
    this._iNodeRefs = new _WeakMap();
    this._devMgr = devMgr;
  }

  /**
   * Creates an inode, from a INode constructor function.
   * The returned inode must be used and later manually deallocated.
   */
  createINode(iNodeConstructor, props = {}) {
    props.ino = this._counter.allocate();
    props.mode = typeof props.mode === 'number' ? props.mode : 0;
    props.uid = typeof props.uid === 'number' ? props.uid : DEFAULT_ROOT_UID;
    props.gid = typeof props.gid === 'number' ? props.gid : DEFAULT_ROOT_GID;
    const iNode = new iNodeConstructor(props, this);
    this._iNodes.set(props.ino, iNode);
    this._iNodeRefs.set(iNode, 0);
    return [iNode, props.ino];
  }

  /**
   * Gets the inode.
   */
  getINode(index) {
    return this._iNodes.get(index);
  }

  /**
   * Links an inode, this increments the hardlink reference count.
   */
  linkINode(iNode) {
    if (iNode) {
      ++iNode.getMetadata().nlink;
    }
    return;
  }

  /**
   * Unlinks an inode, this decrements the hardlink reference count.
   */
  unlinkINode(iNode) {
    if (iNode) {
      --iNode.getMetadata().nlink;
      this._gcINode(iNode);
    }
    return;
  }

  /**
   * References an inode, this increments the private reference count.
   * Private reference count can be used by file descriptors and working directory position.
   */
  refINode(iNode) {
    if (iNode) {
      const refCount = this._iNodeRefs.get(iNode);
      if (refCount !== undefined) {
        this._iNodeRefs.set(iNode, refCount + 1);
      }
    }
    return;
  }

  /**
   * Unreferences an inode, this decrements the private reference count.
   */
  unrefINode(iNode) {
    if (iNode) {
      const refCount = this._iNodeRefs.get(iNode);
      if (refCount !== undefined) {
        this._iNodeRefs.set(iNode, refCount - 1);
        this._gcINode(iNode);
      }
    }
    return;
  }

  /**
   * Decides whether to garbage collect the inode.
   * The true usage count is the hardlink count plus the private reference count.
   * Usually if the true usage count is 0, then the inode is garbage collected.
   * However directories are special cased here, due to the `.` circular hardlink.
   * This allows directories to be garbage collected even when their usage count is 1.
   * This is possible also because there cannot be custom hardlinks to directories.
   */
  _gcINode(iNode) {
    const metadata = iNode.getMetadata();
    const useCount = metadata.nlink + this._iNodeRefs.get(iNode);
    if (useCount === 0 || useCount === 1 && iNode instanceof Directory) {
      const index = metadata.ino;
      iNode.destructor();
      this._iNodes.delete(index);
      this._counter.deallocate(index);
    }
  }

}

/** @module VirtualFSError */

/**
 * Class representing a file system error.
 * @extends Error
 */
class VirtualFSError extends Error {

  /**
   * Creates VirtualFSError.
   */
  constructor(errnoObj, path, dest, syscall) {
    let message = errnoObj.code + ': ' + errnoObj.description;
    if (path != null) {
      message += ', ' + path;
      if (dest != null) message += ' -> ' + dest;
    }
    super(message);
    this.errno = errnoObj.errno;
    this.code = errnoObj.code;
    this.errnoDescription = errnoObj.description;
    if (syscall != null) {
      this.syscall = syscall;
    }
  }

  setPaths(src, dst) {
    let message = this.code + ': ' + this.errnoDescription + ', ' + src;
    if (dst != null) message += ' -> ' + dst;
    this.message = message;
    return;
  }

  setSyscall(syscall) {
    this.syscall = syscall;
  }

}

// $FlowFixMe: Buffer exists
/** @module FileDescriptors */

/**
 * Class representing a File Descriptor
 */
class FileDescriptor {

  /**
   * Creates FileDescriptor
   * Starts the seek position at 0
   */
  constructor(iNode, flags) {
    this._iNode = iNode;
    this._flags = flags;
    this._pos = 0;
  }

  /**
   * Gets an INode.
   */
  getINode() {
    return this._iNode;
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
   */
  setPos(pos, flags = constants.SEEK_SET) {
    const iNode = this.getINode();
    let newPos;
    switch (true) {
      case iNode instanceof File:
      case iNode instanceof Directory:
        switch (flags) {
          case constants.SEEK_SET:
            newPos = pos;
            break;
          case constants.SEEK_CUR:
            newPos = this._pos + pos;
            break;
          case constants.SEEK_END:
            newPos = iNode.getData().length + pos;
            break;
          default:
            newPos = this._pos;
        }
        if (newPos < 0) {
          throw new VirtualFSError(errno.code.EINVAL);
        }
        this._pos = newPos;
        break;
      case iNode instanceof CharacterDev:
        const fops = iNode.getFileDesOps();
        if (!fops) {
          throw new VirtualFSError(errno.code.ENXIO);
        } else if (!fops.setPos) {
          throw new VirtualFSError(errno.code.ESPIPE);
        } else {
          fops.setPos(this, pos, flags);
        }
        break;
      default:
        throw new VirtualFSError(errno.code.ESPIPE);
    }
  }

  /**
   * Reads from this file descriptor into a buffer.
   * It will always try to fill the input buffer.
   * If position is specified, the position change does not persist.
   * If the current file descriptor position is greater than or equal to the length of the data, this will read 0 bytes.
   */
  read(buffer$$1, position = null) {
    let currentPosition;
    if (position === null) {
      currentPosition = this._pos;
    } else {
      currentPosition = position;
    }
    const iNode = this._iNode;
    let bytesRead;
    switch (true) {
      case iNode instanceof File:
        const data = iNode.getData();
        const metadata = iNode.getMetadata();
        bytesRead = data.copy(buffer$$1, 0, currentPosition);
        metadata.atime = new Date();
        break;
      case iNode instanceof CharacterDev:
        const fops = iNode.getFileDesOps();
        if (!fops) {
          throw new VirtualFSError(errno.code.ENXIO);
        } else if (!fops.read) {
          throw new VirtualFSError(errno.code.EINVAL);
        } else {
          bytesRead = fops.read(this, buffer$$1, currentPosition);
        }
        break;
      default:
        throw new VirtualFSError(errno.code.EINVAL);
    }
    if (position === null) {
      this._pos = currentPosition + bytesRead;
    }
    return bytesRead;
  }

  /**
   * Writes to this file descriptor.
   * If position is specified, the position change does not persist.
   */
  write(buffer$$1, position = null, extraFlags = 0) {
    let currentPosition;
    if (position === null) {
      currentPosition = this._pos;
    } else {
      currentPosition = position;
    }
    const iNode = this._iNode;
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
          if (currentPosition > data.length) {
            data = buffer.Buffer.concat([data, buffer.Buffer.alloc(currentPosition - data.length), buffer.Buffer.allocUnsafe(buffer$$1.length)]);
          } else if (currentPosition <= data.length) {
            const overwrittenLength = data.length - currentPosition;
            const extendedLength = buffer$$1.length - overwrittenLength;
            if (extendedLength > 0) {
              data = buffer.Buffer.concat([data, buffer.Buffer.allocUnsafe(extendedLength)]);
            }
          }
          bytesWritten = buffer$$1.copy(data, currentPosition);
        }
        iNode.setData(data);
        const now = new Date();
        metadata.mtime = now;
        metadata.ctime = now;
        metadata.size = data.length;
        break;
      case iNode instanceof CharacterDev:
        const fops = iNode.getFileDesOps();
        if (!fops) {
          throw new VirtualFSError(errno.code.ENXIO);
        } else if (!fops.write) {
          throw new VirtualFSError(errno.code.EINVAL);
        } else {
          bytesWritten = fops.write(this, buffer$$1, currentPosition, extraFlags);
        }
        break;
      default:
        throw new VirtualFSError(errno.code.EINVAL);
    }
    if (position === null) {
      this._pos = currentPosition + bytesWritten;
    }
    return bytesWritten;
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
  constructor(iNodeMgr) {
    this._counter = new Counter(0);
    this._fds = new _Map();
    this._iNodeMgr = iNodeMgr;
  }

  /**
   * Creates a file descriptor.
   * This will increment the reference to the iNode preventing garbage collection by the INodeManager.
   */
  createFd(iNode, flags) {
    this._iNodeMgr.refINode(iNode);
    const index = this._counter.allocate();
    const fd = new FileDescriptor(iNode, flags);
    if (iNode instanceof CharacterDev) {
      const fops = iNode.getFileDesOps();
      if (!fops) {
        throw new VirtualFSError(errno.code.ENXIO);
      } else if (fops.open) {
        fops.open(fd);
      }
    }

    this._fds.set(index, fd);

    return [fd, index];
  }

  /**
   * Gets the file descriptor object.
   */
  getFd(index) {
    return this._fds.get(index);
  }

  /**
   * Duplicates file descriptor index.
   * It may return a new file descriptor index that points to the same file descriptor.
   */
  dupFd(index) {
    const fd = this._fds.get(index);
    if (fd) {
      this._iNodeMgr.refINode(fd.getINode());
      const dupIndex = this._counter.allocate();
      this._fds.set(dupIndex, fd);
      return index;
    }
  }

  /**
   * Deletes a file descriptor.
   * This effectively closes the file descriptor.
   * This will decrement the reference to the iNode allowing garbage collection by the INodeManager.
   */
  deleteFd(fdIndex) {
    const fd = this._fds.get(fdIndex);
    if (fd) {
      const iNode = fd.getINode();
      if (iNode instanceof CharacterDev) {
        const fops = iNode.getFileDesOps();
        if (!fops) {
          throw new VirtualFSError(errno.code.ENXIO);
        } else if (fops.close) {
          fops.close(fd);
        }
      }
      this._fds.delete(fdIndex);
      this._counter.deallocate(fdIndex);
      this._iNodeMgr.unrefINode(iNode);
    }
    return;
  }

}

// $FlowFixMe: Buffer exists
// $FlowFixMe: nextTick exists

/** @module Streams */

/**
 * Class representing a ReadStream.
 * @extends Readable
 */
class ReadStream extends stream.Readable {

  /**
   * Creates ReadStream.
   * It will asynchronously open the file descriptor if a file path was passed in.
   * It will automatically close the opened file descriptor by default.
   */
  constructor(path, options, fs) {
    super({
      highWaterMark: options.highWaterMark,
      encoding: options.encoding
    });
    this._fs = fs;
    this.bytesRead = 0;
    this.path = path;
    this.fd = options.fd === undefined ? null : options.fd;
    this.flags = options.flags === undefined ? 'r' : options.flags;
    this.mode = options.mode === undefined ? DEFAULT_FILE_PERM : options.mode;
    this.autoClose = options.autoClose === undefined ? true : options.autoClose;
    this.start = options.start;
    this.end = options.end === undefined ? Infinity : options.end;
    this.pos = options.start;
    if (typeof this.fd !== 'number') {
      this._open();
    }
    super.on('end', () => {
      if (this.autoClose) {
        this.destroy();
      }
    });
  }

  /**
   * Open file descriptor if ReadStream was constructed from a file path.
   * @private
   */
  _open() {
    this._fs.open(this.path, this.flags, this.mode, (e, fd) => {
      if (e) {
        if (this.autoClose) {
          this.destroy();
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
   * Asynchronous read hook for stream implementation.
   * The size passed into this function is not the requested size, but the high watermark.
   * It's just a heuristic buffering size to avoid sending to many syscalls.
   * However since this is an in-memory filesystem, the size itself is irrelevant.
   * @private
   */
  _read(size) {
    if (typeof this.fd !== 'number') {
      super.once('open', () => {
        this._read(size);
      });
      return;
    }
    if (this.destroyed) return;
    // this.pos is only ever used if this.start is specified
    if (this.pos != null) {
      size = Math.min(this.end - this.pos + 1, size);
    }
    if (size <= 0) {
      this.push(null);
      return;
    }
    this._fs.read(this.fd, buffer.Buffer.allocUnsafe(size), 0, size, this.pos, (e, bytesRead, buf) => {
      if (e) {
        if (this.autoClose) {
          this.destroy();
        }
        super.emit('error', e);
        return;
      }
      if (bytesRead > 0) {
        this.bytesRead += bytesRead;
        this.push(buf.slice(0, bytesRead));
      } else {
        this.push(null);
      }
    });
    if (this.pos != null) {
      this.pos += size;
    }
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
      return process.nextTick(() => super.emit('close'));
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
class WriteStream extends stream.Writable {

  /**
   * Creates WriteStream.
   */
  constructor(path, options, fs) {
    super({
      highWaterMark: options.highWaterMark
    });
    this._fs = fs;
    this.bytesWritten = 0;
    this.path = path;
    this.fd = options.fd === undefined ? null : options.fd;
    this.flags = options.flags === undefined ? 'w' : options.flags;
    this.mode = options.mode === undefined ? DEFAULT_FILE_PERM : options.mode;
    this.autoClose = options.autoClose === undefined ? true : options.autoClose;
    this.start = options.start;
    this.pos = this.start; // WriteStream maintains its own position
    if (options.encoding) {
      super.setDefaultEncoding(options.encoding);
    }
    if (typeof this.fd !== 'number') {
      this._open();
    }
    super.on('finish', () => {
      if (this.autoClose) {
        this.destroy();
      }
    });
  }

  /**
   * Open file descriptor if WriteStream was constructed from a file path.
   * @private
   */
  _open() {
    this._fs.open(this.path, this.flags, this.mode, (e, fd) => {
      if (e) {
        if (this.autoClose) {
          this.destroy();
        }
        super.emit('error', e);
        return;
      }
      this.fd = fd;
      super.emit('open', fd);
    });
  }

  /**
   * Asynchronous write hook for stream implementation.
   * @private
   */
  // $FlowFixMe: _write hook adapted from Node `lib/internal/fs/streams.js`
  _write(data, encoding, cb) {
    if (typeof this.fd !== 'number') {
      return super.once('open', () => {
        this._write(data, encoding, cb);
      });
    }
    this._fs.write(this.fd, data, 0, data.length, this.pos, (e, bytesWritten) => {
      if (e) {
        if (this.autoClose) {
          this.destroy();
        }
        cb(e);
        return;
      }
      this.bytesWritten += bytesWritten;
      cb();
    });
    if (this.pos !== undefined) {
      this.pos += data.length;
    }
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
      return process.nextTick(() => super.emit('close'));
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

// $FlowFixMe: Buffer exists

/** @module VirtualFS */

// $FlowFixMe: nextTick exists
/**
 * Prefer the posix join function if it exists.
 * Browser polyfills of the path module may not have the posix property.
 */
const pathJoin = pathNode.posix ? pathNode.posix.join : pathNode.join;

/**
 * Asynchronous callback backup.
 */
const callbackUp = err => {
  if (err) throw err;
};

/**
 * Class representing a virtual filesystem.
 */
class VirtualFS {

  /**
   * Creates VirtualFS.
   */
  constructor(umask = 0o022, rootIndex = null, devMgr = new DeviceManager(), iNodeMgr = new INodeManager(devMgr), fdMgr = new FileDescriptorManager(iNodeMgr)) {
    let rootNode;
    if (typeof rootIndex === 'number') {
      rootNode = iNodeMgr.getINode(rootIndex);
      if (!(rootNode instanceof Directory)) {
        throw TypeError('rootIndex must point to a root directory');
      }
    } else {
      var _iNodeMgr$createINode = iNodeMgr.createINode(Directory, { mode: DEFAULT_ROOT_PERM, uid: DEFAULT_ROOT_UID, gid: DEFAULT_ROOT_GID });

      var _iNodeMgr$createINode2 = _slicedToArray(_iNodeMgr$createINode, 1);

      rootNode = _iNodeMgr$createINode2[0];
    }
    this._uid = DEFAULT_ROOT_UID;
    this._gid = DEFAULT_ROOT_GID;
    this._umask = umask;
    this._devMgr = devMgr;
    this._iNodeMgr = iNodeMgr;
    this._fdMgr = fdMgr;
    this._root = rootNode;
    this._cwd = new CurrentDirectory(iNodeMgr, rootNode);
    this.constants = constants;
    this.ReadStream = ReadStream;
    this.WriteStream = WriteStream;
  }

  getUmask() {
    return this._umask;
  }

  setUmask(umask) {
    this._umask = umask;
  }

  getUid() {
    return this._uid;
  }

  setUid(uid) {
    this._uid = uid;
  }

  getGid() {
    return this._gid;
  }

  setGid(gid) {
    this._gid = gid;
  }

  getCwd() {
    return this._cwd.getPath();
  }

  chdir(path) {
    path = this._getPath(path);
    const navigated = this._navigate(path, true);
    if (!navigated.target) {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
    if (!(navigated.target instanceof Directory)) {
      throw new VirtualFSError(errno.code.ENOTDIR, path);
    }
    if (!this._checkPermissions(constants.X_OK, navigated.target.getMetadata())) {
      throw new VirtualFSError(errno.code.EACCES, path);
    }
    this._cwd.changeDir(navigated.target, navigated.pathStack);
  }

  access(path, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.accessSync.bind(this), [path, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  accessSync(path, mode = constants.F_OK) {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
    if (mode === constants.F_OK) {
      return;
    }
    if (!this._checkPermissions(mode, target.getMetadata())) {
      throw new VirtualFSError(errno.code.EACCES, path);
    }
  }

  appendFile(file, data, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.appendFileSync.bind(this), [file, data, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  appendFileSync(file, data = 'undefined', options) {
    options = this._getOptions({
      encoding: 'utf8',
      mode: DEFAULT_FILE_PERM,
      flag: 'a'
    }, options);
    data = this._getBuffer(data, options.encoding);
    let fdIndex;
    try {
      let fd;
      if (typeof file === 'number') {
        fd = this._fdMgr.getFd(file);
        if (!fd) throw new VirtualFSError(errno.code.EBADF, null, null, 'appendFile');
        if (!(fd.getFlags() & (constants.O_WRONLY | constants.O_RDWR))) {
          throw new VirtualFSError(errno.code.EBADF, null, null, 'appendFile');
        }
      } else {
        var _openSync = this._openSync(file, options.flag, options.mode);

        var _openSync2 = _slicedToArray(_openSync, 2);

        fd = _openSync2[0];
        fdIndex = _openSync2[1];
      }
      try {
        fd.write(data, null, constants.O_APPEND);
      } catch (e) {
        if (e instanceof RangeError) {
          throw new VirtualFSError(errno.code.EFBIG, null, null, 'appendFile');
        }
        throw e;
      }
    } finally {
      if (fdIndex !== undefined) this.closeSync(fdIndex);
    }
    return;
  }

  chmod(path, mode, callback = callbackUp) {
    this._callAsync(this.chmodSync.bind(this), [path, mode], callback, callback);
    return;
  }

  chmodSync(path, mode) {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
    if (typeof mode !== 'number') {
      throw new TypeError('mode must be an integer');
    }
    const targetMetadata = target.getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID && this._uid !== targetMetadata.uid) {
      throw new VirtualFSError(errno.code.EPERM, null, null, 'chmod');
    }
    targetMetadata.mode = targetMetadata.mode & constants.S_IFMT | mode;
    return;
  }

  chown(path, uid, gid, callback = callbackUp) {
    this._callAsync(this.chownSync.bind(this), [path, uid, gid], callback, callback);
    return;
  }

  chownSync(path, uid, gid) {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
    const targetMetadata = target.getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID) {
      // you don't own the file
      if (targetMetadata.uid !== this._uid) {
        throw new VirtualFSError(errno.code.EPERM, null, null, 'chown');
      }
      // you cannot give files to others
      if (this._uid !== uid) {
        throw new VirtualFSError(errno.code.EPERM, null, null, 'chown');
      }
      // because we don't have user group hierarchies, we allow chowning to any group
    }
    if (typeof uid === 'number') {
      targetMetadata.uid = uid;
    }
    if (typeof gid === 'number') {
      targetMetadata.gid = gid;
    }
    return;
  }

  chownr(path, uid, gid, callback = callbackUp) {
    this._callAsync(this.chownrSync.bind(this), [path, uid, gid], callback, callback);
    return;
  }

  chownrSync(path, uid, gid) {
    path = this._getPath(path);
    this.chownSync(path, uid, gid);
    let children;
    try {
      children = this.readdirSync(path);
    } catch (e) {
      if (e && e.code === 'ENOTDIR') return;
      throw e;
    }
    children.forEach(child => {
      // $FlowFixMe: path is string
      const pathChild = pathJoin(path, child);
      // don't traverse symlinks
      if (!this.lstatSync(pathChild).isSymbolicLink()) {
        this.chownrSync(pathChild, uid, gid);
      }
    });
    return;
  }

  close(fdIndex, callback = callbackUp) {
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

  copyFile(srcPath, dstPath, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.copyFileSync.bind(this), [srcPath, dstPath, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  copyFileSync(srcPath, dstPath, flags = 0) {
    srcPath = this._getPath(srcPath);
    dstPath = this._getPath(dstPath);
    let srcFd;
    let srcFdIndex;
    let dstFd;
    let dstFdIndex;
    try {
      var _openSync3 = this._openSync(srcPath, constants.O_RDONLY);
      // the only things that are copied is the data and the mode


      var _openSync4 = _slicedToArray(_openSync3, 2);

      srcFd = _openSync4[0];
      srcFdIndex = _openSync4[1];

      const srcINode = srcFd.getINode();
      if (srcINode instanceof Directory) {
        throw new VirtualFSError(errno.code.EBADF, srcPath, dstPath);
      }
      let dstFlags = constants.WRONLY | constants.O_CREAT;
      if (flags & constants.COPYFILE_EXCL) {
        dstFlags |= constants.O_EXCL;
      }

      var _openSync5 = this._openSync(dstPath, dstFlags, srcINode.getMetadata().mode);

      var _openSync6 = _slicedToArray(_openSync5, 2);

      dstFd = _openSync6[0];
      dstFdIndex = _openSync6[1];

      const dstINode = dstFd.getINode();
      if (dstINode instanceof File) {
        dstINode.setData(buffer.Buffer.from(srcINode.getData()));
      } else {
        throw new VirtualFSError(errno.code.EINVAL, srcPath, dstPath);
      }
    } finally {
      if (srcFdIndex !== undefined) this.closeSync(srcFdIndex);
      if (dstFdIndex !== undefined) this.closeSync(dstFdIndex);
    }
    return;
  }

  createReadStream(path, options) {
    path = this._getPath(path);
    options = this._getOptions({
      flags: 'r',
      encoding: null,
      fd: null,
      mode: DEFAULT_FILE_PERM,
      autoClose: true,
      end: Infinity
    }, options);
    if (options.start !== undefined) {
      if (options.start > options.end) {
        throw new RangeError('ERR_VALUE_OUT_OF_RANGE');
      }
    }
    return new ReadStream(path, options, this);
  }

  createWriteStream(path, options) {
    path = this._getPath(path);
    options = this._getOptions({
      flags: 'w',
      defaultEncoding: 'utf8',
      fd: null,
      mode: DEFAULT_FILE_PERM,
      autoClose: true
    }, options);
    if (options.start !== undefined) {
      if (options.start < 0) {
        throw new RangeError('ERR_VALUE_OUT_OF_RANGE');
      }
    }
    return new WriteStream(path, options, this);
  }

  exists(path, callback) {
    if (!callback) {
      callback = () => {};
    }
    this._callAsync(this.existsSync.bind(this), [path], callback, callback);
    return;
  }

  existsSync(path) {
    path = this._getPath(path);
    try {
      return !!this._navigate(path, true).target;
    } catch (e) {
      return false;
    }
  }

  fallocate(fdIndex, offset, len, callback = callbackUp) {
    this._callAsync(this.fallocateSync.bind(this), [fdIndex, offset, len], callback, callback);
    return;
  }

  fallocateSync(fdIndex, offset, len) {
    if (offset < 0 || len <= 0) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'fallocate');
    }
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fallocate');
    }
    const iNode = fd.getINode();
    if (!(iNode instanceof File)) {
      throw new VirtualFSError(errno.code.ENODEV, null, null, 'fallocate');
    }
    if (!(fd.getFlags() & (constants.O_WRONLY | constants.O_RDWR))) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fallocate');
    }
    const data = iNode.getData();
    const metadata = iNode.getMetadata();
    if (offset + len > data.length) {
      let newData;
      try {
        newData = buffer.Buffer.concat([data, buffer.Buffer.alloc(offset + len - data.length)]);
      } catch (e) {
        if (e instanceof RangeError) {
          throw new VirtualFSError(errno.code.EFBIG, null, null, 'fallocate');
        }
        throw e;
      }
      iNode.setData(newData);
      metadata.size = newData.length;
    }
    metadata.ctime = new Date();
    return;
  }

  mmap(length, flags, fdIndex, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.mmapSync.bind(this), [length, flags, fdIndex, ...args.slice(0, cbIndex)], buffer$$1 => callback(null, buffer$$1), callback);
    return;
  }

  mmapSync(length, flags, fdIndex, offset = 0) {
    if (length < 1 || offset < 0) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'mmap');
    }
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'mmap');
    }
    const access = fd.getFlags() & constants.O_ACCMODE;
    if (access === constants.O_WRONLY) {
      throw new VirtualFSError(errno.code.EACCES, null, null, 'mmap');
    }
    const iNode = fd.getINode();
    if (!(iNode instanceof File)) {
      throw new VirtualFSError(errno.code.ENODEV, null, null, 'mmap');
    }
    switch (flags) {
      case constants.MAP_PRIVATE:
        return buffer.Buffer.from(iNode.getData().slice(offset, offset + length));
      case constants.MAP_SHARED:
        if (access !== constants.O_RDWR) {
          throw new VirtualFSError(errno.code.EACCES, null, null, 'mmap');
        }
        return permaProxy(iNode, '_data').slice(offset, offset + length);
      default:
        throw new VirtualFSError(errno.code.EINVAL, null, null, 'mmap');
    }
  }

  fchmod(fdIndex, mode, callback = callbackUp) {
    this._callAsync(this.fchmodSync.bind(this), [fdIndex, mode], callback, callback);
    return;
  }

  fchmodSync(fdIndex, mode) {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fchmod');
    }
    if (typeof mode !== 'number') {
      throw new TypeError('mode must be an integer');
    }
    const fdMetadata = fd.getINode().getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID && this._uid !== fdMetadata.uid) {
      throw new VirtualFSError(errno.code.EPERM, null, null, 'fchmod');
    }
    fdMetadata.mode = fdMetadata.mode & constants.S_IMFT | mode;
    return;
  }

  fchown(fdIndex, uid, gid, callback = callbackUp) {
    this._callAsync(this.fchmodSync.bind(this), [fdIndex, uid, gid], callback, callback);
    return;
  }

  fchownSync(fdIndex, uid, gid) {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fchown');
    }
    const fdMetadata = fd.getINode().getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID) {
      // you don't own the file
      if (fdMetadata.uid !== this._uid) {
        throw new VirtualFSError(errno.code.EPERM, null, null, 'fchown');
      }
      // you cannot give files to others
      if (this._uid !== uid) {
        throw new VirtualFSError(errno.code.EPERM, null, null, 'fchown');
      }
      // because we don't have user group hierarchies, we allow chowning to any group
    }
    if (typeof uid === 'number') {
      fdMetadata.uid = uid;
    }
    if (typeof gid === 'number') {
      fdMetadata.gid = gid;
    }
    return;
  }

  fdatasync(fdIndex, callback = callbackUp) {
    this._callAsync(this.fchmodSync.bind(this), [fdIndex], callback, callback);
    return;
  }

  fdatasyncSync(fdIndex) {
    if (!this._fdMgr.getFd(fdIndex)) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fdatasync');
    }
    return;
  }

  fstat(fdIndex, callback = callbackUp) {
    this._callAsync(this.fstatSync.bind(this), [fdIndex], stat => callback(null, stat), callback);
    return;
  }

  fstatSync(fdIndex) {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'fstat');
    }
    return new Stat(_extends({}, fd.getINode().getMetadata()));
  }

  fsync(fdIndex, callback = callbackUp) {
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
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.ftruncateSync.bind(this), [fdIndex, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  ftruncateSync(fdIndex, len = 0) {
    if (len < 0) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'ftruncate');
    }
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'ftruncate');
    }
    const iNode = fd.getINode();
    if (!(iNode instanceof File)) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'ftruncate');
    }
    if (!(fd.getFlags() & (constants.O_WRONLY | constants.O_RDWR))) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'ftruncate');
    }
    const data = iNode.getData();
    const metadata = iNode.getMetadata();
    let newData;
    try {
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
    } catch (e) {
      if (e instanceof RangeError) {
        throw new VirtualFSError(errno.code.EFBIG, null, null, 'ftruncate');
      }
      throw e;
    }
    const now = new Date();
    metadata.mtime = now;
    metadata.ctime = now;
    metadata.size = newData.length;
    fd.setPos(Math.min(newData.length, fd.getPos()));
    return;
  }

  futimes(fdIndex, atime, mtime, callback = callbackUp) {
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
    let newMtime;
    if (typeof atime === 'number') {
      newAtime = new Date(atime * 1000);
    } else if (typeof atime === 'string') {
      newAtime = new Date(parseInt(atime) * 1000);
    } else if (atime instanceof Date) {
      newAtime = atime;
    } else {
      throw TypeError('atime and mtime must be dates or unixtime in seconds');
    }
    if (typeof mtime === 'number') {
      newMtime = new Date(mtime * 1000);
    } else if (typeof mtime === 'string') {
      newMtime = new Date(parseInt(mtime) * 1000);
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

  lchmod(path, mode, callback = callbackUp) {
    this._callAsync(this.lchmodSync.bind(this), [path, mode], callback, callback);
    return;
  }

  lchmodSync(path, mode) {
    path = this._getPath(path);
    const target = this._navigate(path, false).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
    if (typeof mode !== 'number') {
      throw new TypeError('mode must be an integer');
    }
    const targetMetadata = target.getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID && this._uid !== targetMetadata.uid) {
      throw new VirtualFSError(errno.code.EPERM, null, null, 'lchmod');
    }
    targetMetadata.mode = targetMetadata.mode & constants.S_IFMT | mode;
    return;
  }

  lchown(path, uid, gid, callback = callbackUp) {
    this._callAsync(this.lchownSync.bind(this), [path, uid, gid], callback, callback);
    return;
  }

  lchownSync(path, uid, gid) {
    path = this._getPath(path);
    const target = this._navigate(path, false).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
    const targetMetadata = target.getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID) {
      // you don't own the file
      if (targetMetadata.uid !== this._uid) {
        throw new VirtualFSError(errno.code.EPERM, null, null, 'lchown');
      }
      // you cannot give files to others
      if (this._uid !== uid) {
        throw new VirtualFSError(errno.code.EPERM, null, null, 'lchown');
      }
      // because we don't have user group hierarchies, we allow chowning to any group
    }
    if (typeof uid === 'number') {
      targetMetadata.uid = uid;
    }
    if (typeof gid === 'number') {
      targetMetadata.gid = gid;
    }
    return;
  }

  link(existingPath, newPath, callback = callbackUp) {
    this._callAsync(this.linkSync.bind(this), [existingPath, newPath], callback, callback);
    return;
  }

  linkSync(existingPath, newPath) {
    existingPath = this._getPath(existingPath);
    newPath = this._getPath(newPath);
    let navigatedExisting;
    let navigatedNew;
    navigatedExisting = this._navigate(existingPath, false);
    navigatedNew = this._navigate(newPath, false);
    if (!navigatedExisting.target) {
      throw new VirtualFSError(errno.code.ENOENT, existingPath, newPath, 'link');
    }
    if (navigatedExisting.target instanceof Directory) {
      throw new VirtualFSError(errno.code.EPERM, existingPath, newPath, 'link');
    }
    if (!navigatedNew.target) {
      if (navigatedNew.dir.getMetadata().nlink < 2) {
        throw new VirtualFSError(errno.code.ENOENT, existingPath, newPath, 'link');
      }
      if (!this._checkPermissions(constants.W_OK, navigatedNew.dir.getMetadata())) {
        throw new VirtualFSError(errno.code.EACCES, existingPath, newPath, 'link');
      }
      const index = navigatedExisting.dir.getEntryIndex(navigatedExisting.name);
      navigatedNew.dir.addEntry(navigatedNew.name, index);
      navigatedExisting.target.getMetadata().ctime = new Date();
    } else {
      throw new VirtualFSError(errno.code.EEXIST, existingPath, newPath, 'link');
    }
    return;
  }

  lseek(fdIndex, position, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.lseekSync.bind(this), [fdIndex, position, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  lseekSync(fdIndex, position, seekFlags = constants.SEEK_SET) {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'lseek');
    }
    if ([constants.SEEK_SET, constants.SEEK_CUR, constants.SEEK_END].indexOf(seekFlags) === -1) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'lseek');
    }
    try {
      fd.setPos(position, seekFlags);
    } catch (e) {
      if (e instanceof VirtualFSError) {
        e.setSyscall('lseek');
      }
      throw e;
    }
    return;
  }

  lstat(path, callback = callbackUp) {
    this._callAsync(this.lstatSync.bind(this), [path], stat => callback(null, stat), callback);
    return;
  }

  lstatSync(path) {
    path = this._getPath(path);
    const target = this._navigate(path, false).target;
    if (target) {
      return new Stat(_extends({}, target.getMetadata()));
    } else {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
  }

  mkdir(path, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.mkdirSync.bind(this), [path, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  mkdirSync(path, mode = DEFAULT_DIRECTORY_PERM) {
    path = this._getPath(path);
    // we expect a non-existent directory
    path = path.replace(/(.+?)\/+$/, '$1');
    let navigated = this._navigate(path, true);
    if (navigated.target) {
      throw new VirtualFSError(errno.code.EEXIST, path, null, 'mkdir');
    } else if (!navigated.target && navigated.remaining) {
      throw new VirtualFSError(errno.code.ENOENT, path, null, 'mkdir');
    } else if (!navigated.target) {
      if (navigated.dir.getMetadata().nlink < 2) {
        throw new VirtualFSError(errno.code.ENOENT, path, null, 'mkdir');
      }
      if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
        throw new VirtualFSError(errno.code.EACCES, path, null, 'mkdir');
      }

      var _iNodeMgr$createINode3 = this._iNodeMgr.createINode(Directory, {
        mode: applyUmask(mode, this._umask),
        uid: this._uid,
        gid: this._gid,
        parent: navigated.dir.getEntryIndex('.')
      }),
          _iNodeMgr$createINode4 = _slicedToArray(_iNodeMgr$createINode3, 2);

      const index = _iNodeMgr$createINode4[1];

      navigated.dir.addEntry(navigated.name, index);
    }
    return;
  }

  mkdirp(path, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.mkdirpSync.bind(this), [path, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  mkdirpSync(path, mode = DEFAULT_DIRECTORY_PERM) {
    path = this._getPath(path);
    // we expect a directory
    path = path.replace(/(.+?)\/+$/, '$1');
    let iNode;
    let index;
    let currentDir;
    let navigated = this._navigate(path, true);
    while (true) {
      if (!navigated.target) {
        if (navigated.dir.getMetadata().nlink < 2) {
          throw new VirtualFSError(errno.code.ENOENT, path);
        }
        if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
          throw new VirtualFSError(errno.code.EACCES, path);
        }

        var _iNodeMgr$createINode5 = this._iNodeMgr.createINode(Directory, {
          mode: applyUmask(mode, this._umask),
          uid: this._uid,
          gid: this._gid,
          parent: navigated.dir.getEntryIndex('.')
        });

        var _iNodeMgr$createINode6 = _slicedToArray(_iNodeMgr$createINode5, 2);

        iNode = _iNodeMgr$createINode6[0];
        index = _iNodeMgr$createINode6[1];

        navigated.dir.addEntry(navigated.name, index);
        if (navigated.remaining) {
          currentDir = iNode;
          navigated = this._navigateFrom(currentDir, navigated.remaining, true);
        } else {
          break;
        }
      } else if (!(navigated.target instanceof Directory)) {
        throw new VirtualFSError(errno.code.ENOTDIR, path);
      } else {
        break;
      }
    }
    return;
  }

  mkdtemp(pathSPrefix, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.mkdtempSync.bind(this), [pathSPrefix, ...args.slice(0, cbIndex)], pathS => callback(null, pathS), callback);
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

  mknod(path, type, major, minor, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.mknodSync.bind(this), [path, type, major, minor, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  mknodSync(path, type, major, minor, mode = DEFAULT_FILE_PERM) {
    path = this._getPath(path);
    const navigated = this._navigate(path, false);
    if (navigated.target) {
      throw new VirtualFSError(errno.code.EEXIST, path, null, 'mknod');
    }
    if (navigated.dir.getMetadata().nlink < 2) {
      throw new VirtualFSError(errno.code.ENOENT, path, null, 'mknod');
    }
    if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
      throw new VirtualFSError(errno.code.EACCES, path, null, 'mknod');
    }
    let index;
    switch (type) {
      case constants.S_IFREG:
        var _iNodeMgr$createINode7 = this._iNodeMgr.createINode(File, {
          mode: applyUmask(mode, this._umask),
          uid: this._uid,
          gid: this._gid
        });

        var _iNodeMgr$createINode8 = _slicedToArray(_iNodeMgr$createINode7, 2);

        index = _iNodeMgr$createINode8[1];

        break;
      case constants.S_IFCHR:
        if (typeof major !== 'number' || typeof minor !== 'number') {
          throw TypeError('major and minor must set as numbers when creating device nodes');
        }
        if (major > MAJOR_MAX || minor > MINOR_MAX || minor < MAJOR_MIN || minor < MINOR_MIN) {
          throw new VirtualFSError(errno.code.EINVAL, path, null, 'mknod');
        }

        var _iNodeMgr$createINode9 = this._iNodeMgr.createINode(CharacterDev, {
          mode: applyUmask(mode, this._umask),
          uid: this._uid,
          gid: this._gid,
          rdev: mkDev(major, minor)
        });

        var _iNodeMgr$createINode10 = _slicedToArray(_iNodeMgr$createINode9, 2);

        index = _iNodeMgr$createINode10[1];

        break;
      default:
        throw new VirtualFSError(errno.code.EPERM, path, null, 'mknod');
    }
    navigated.dir.addEntry(navigated.name, index);
    return;
  }

  open(path, flags, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.openSync.bind(this), [path, flags, ...args.slice(0, cbIndex)], fdIndex => callback(null, fdIndex), callback);
    return;
  }

  openSync(path, flags, mode = DEFAULT_FILE_PERM) {
    return this._openSync(path, flags, mode)[1];
  }

  _openSync(path, flags, mode = DEFAULT_FILE_PERM) {
    path = this._getPath(path);
    if (typeof flags === 'string') {
      switch (flags) {
        case 'r':
        case 'rs':
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
    let navigated = this._navigate(path, false);
    if (navigated.target instanceof Symlink) {
      // cannot be symlink if O_NOFOLLOW
      if (flags & constants.O_NOFOLLOW) {
        throw new VirtualFSError(errno.code.ELOOP, path, null, 'open');
      }
      navigated = this._navigateFrom(navigated.dir, navigated.name + navigated.remaining, true, undefined, undefined, path);
    }
    let target = navigated.target;
    // cannot be missing unless O_CREAT
    if (!target) {
      // O_CREAT only applies if there's a left over name without any remaining path
      if (!navigated.remaining && flags & constants.O_CREAT) {
        // cannot create if the current directory has been unlinked from its parent directory
        if (navigated.dir.getMetadata().nlink < 2) {
          throw new VirtualFSError(errno.code.ENOENT, path, null, 'open');
        }
        if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
          throw new VirtualFSError(errno.code.EACCES, path, null, 'open');
        }
        let index;

        var _iNodeMgr$createINode11 = this._iNodeMgr.createINode(File, {
          mode: applyUmask(mode, this._umask),
          uid: this._uid,
          gid: this._gid
        });

        var _iNodeMgr$createINode12 = _slicedToArray(_iNodeMgr$createINode11, 2);

        target = _iNodeMgr$createINode12[0];
        index = _iNodeMgr$createINode12[1];

        navigated.dir.addEntry(navigated.name, index);
      } else {
        throw new VirtualFSError(errno.code.ENOENT, path, null, 'open');
      }
    } else {
      // target already exists cannot be created exclusively
      if (flags & constants.O_CREAT && flags & constants.O_EXCL) {
        throw new VirtualFSError(errno.code.EEXIST, path, null, 'open');
      }
      // cannot be directory if write capabilities are requested
      if (target instanceof Directory && flags & (constants.O_WRONLY | flags & constants.O_RDWR)) {
        throw new VirtualFSError(errno.code.EISDIR, path, null, 'open');
      }
      // must be directory if O_DIRECTORY
      if (flags & constants.O_DIRECTORY && !(target instanceof Directory)) {
        throw new VirtualFSError(errno.code.ENOTDIR, path, null, 'open');
      }
      // must truncate a file if O_TRUNC
      if (flags & constants.O_TRUNC && target instanceof File && flags & (constants.O_WRONLY | constants.O_RDWR)) {
        target.setData(buffer.Buffer.alloc(0));
      }
      // convert file descriptor access flags into bitwise permission flags
      let access;
      if (flags & constants.O_RDWR) {
        access = constants.R_OK | constants.W_OK;
      } else if (flags & constants.O_WRONLY) {
        access = constants.W_OK;
      } else {
        access = constants.R_OK;
      }
      if (!this._checkPermissions(access, target.getMetadata())) {
        throw new VirtualFSError(errno.code.EACCES, path, null, 'open');
      }
    }
    try {
      let fd = this._fdMgr.createFd(target, flags);
      return fd;
    } catch (e) {
      if (e instanceof VirtualFSError) {
        e.setPaths(path);
        e.setSyscall('open');
      }
      throw e;
    }
  }

  read(fdIndex, buffer$$1, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
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
    if (flags & constants.O_WRONLY) {
      throw new VirtualFSError(errno.code.EBADF, null, null, 'read');
    }
    if (offset < 0 || offset > buffer$$1.length) {
      throw new RangeError('Offset is out of bounds');
    }
    if (length < 0 || length > buffer$$1.length) {
      throw new RangeError('Length extends beyond buffer');
    }
    buffer$$1 = this._getBuffer(buffer$$1).slice(offset, offset + length);
    let bytesRead;
    try {
      bytesRead = fd.read(buffer$$1, position);
    } catch (e) {
      if (e instanceof VirtualFSError) {
        e.syscall = 'read';
      }
      throw e;
    }
    return bytesRead;
  }

  readdir(path, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.readdirSync.bind(this), [path, ...args.slice(0, cbIndex)], files => callback(null, files), callback);
    return;
  }

  readdirSync(path, options) {
    path = this._getPath(path);
    options = this._getOptions({ encoding: 'utf8' }, options);
    let navigated = this._navigate(path, true);
    if (!navigated.target) {
      throw new VirtualFSError(errno.code.ENOENT, path, null, 'readdir');
    }
    if (!(navigated.target instanceof Directory)) {
      throw new VirtualFSError(errno.code.ENOTDIR, path, null, 'readdir');
    }
    if (!this._checkPermissions(constants.R_OK, navigated.target.getMetadata())) {
      throw new VirtualFSError(errno.code.EACCES, path, null, 'readdir');
    }
    return [...navigated.target.getEntries()].filter(([name, _]) => name !== '.' && name !== '..').map(([name, _]) => {
      // $FlowFixMe: options exists
      if (options.encoding === 'buffer') {
        return buffer.Buffer.from(name);
      } else {
        // $FlowFixMe: options exists and is not a string
        return buffer.Buffer.from(name).toString(options.encoding);
      }
    });
  }

  readFile(file, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.readFileSync.bind(this), [file, ...args.slice(0, cbIndex)], data => callback(null, data), callback);
    return;
  }

  readFileSync(file, options) {
    options = this._getOptions({ encoding: null, flag: 'r' }, options);
    let fdIndex;
    try {
      const buffer$$1 = buffer.Buffer.allocUnsafe(4096);
      let totalBuffer = buffer.Buffer.alloc(0);
      let bytesRead = null;
      if (typeof file === 'number') {
        while (bytesRead !== 0) {
          bytesRead = this.readSync(file, buffer$$1, 0, buffer$$1.length);
          totalBuffer = buffer.Buffer.concat([totalBuffer, buffer$$1.slice(0, bytesRead)]);
        }
      } else {
        fdIndex = this.openSync(file, options.flag);
        while (bytesRead !== 0) {
          bytesRead = this.readSync(fdIndex, buffer$$1, 0, buffer$$1.length);
          totalBuffer = buffer.Buffer.concat([totalBuffer, buffer$$1.slice(0, bytesRead)]);
        }
      }
      return options.encoding ? totalBuffer.toString(options.encoding) : totalBuffer;
    } finally {
      if (fdIndex !== undefined) this.closeSync(fdIndex);
    }
  }

  readlink(path, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.readlinkSync.bind(this), [path, ...args.slice(0, cbIndex)], linkString => callback(null, linkString), callback);
    return;
  }

  readlinkSync(path, options) {
    path = this._getPath(path);
    options = this._getOptions({ encoding: 'utf8' }, options);
    let target = this._navigate(path, false).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
    if (!(target instanceof Symlink)) {
      throw new VirtualFSError(errno.code.EINVAL, path);
    }
    const link = target.getLink();
    if (options.encoding === 'buffer') {
      return buffer.Buffer.from(link);
    } else {
      return buffer.Buffer.from(link).toString(options.encoding);
    }
  }

  realpath(path, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.realpathSync.bind(this), [path, ...args.slice(0, cbIndex)], path => callback(null, path), callback);
    return;
  }

  realpathSync(path, options) {
    path = this._getPath(path);
    options = this._getOptions({ encoding: 'utf8' }, options);
    const navigated = this._navigate(path, true);
    if (!navigated.target) {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
    if (options.encoding === 'buffer') {
      return buffer.Buffer.from('/' + navigated.pathStack.join('/'));
    } else {
      return buffer.Buffer.from('/' + navigated.pathStack.join('/')).toString(options.encoding);
    }
  }

  rename(oldPath, newPath, callback = callbackUp) {
    this._callAsync(this.renameSync.bind(this), [oldPath, newPath], callback, callback);
    return;
  }

  renameSync(oldPath, newPath) {
    oldPath = this._getPath(oldPath);
    newPath = this._getPath(newPath);
    const navigatedSource = this._navigate(oldPath, false);
    const navigatedTarget = this._navigate(newPath, false);
    if (!navigatedSource.target) {
      throw new VirtualFSError(errno.code.ENOENT, oldPath, newPath, 'rename');
    }
    if (navigatedSource.target instanceof Directory) {
      // if oldPath is a directory, target must be a directory (if it exists)
      if (navigatedTarget.target && !(navigatedTarget.target instanceof Directory)) {
        throw new VirtualFSError(errno.code.ENOTDIR, oldPath, newPath, 'rename');
      }
      // neither oldPath nor newPath can point to root
      if (navigatedSource.target === this._root || navigatedTarget.target === this._root) {
        throw new VirtualFSError(errno.code.EBUSY, oldPath, newPath, 'rename');
      }
      // if the target directory contains elements this cannot be done
      // this can be done without read permissions
      if (navigatedTarget.target && [...navigatedTarget.target.getEntries()].length - 2) {
        throw new VirtualFSError(errno.code.ENOTEMPTY, oldPath, newPath, 'rename');
      }
      // if any of the paths used .. or ., then `dir` is not the parent directory
      if (navigatedSource.name === '.' || navigatedSource.name === '..' || navigatedTarget.name === '.' || navigatedTarget.name === '..') {
        throw new VirtualFSError(errno.code.EBUSY, oldPath, newPath, 'rename');
      }
      // cannot rename a source prefix of target
      if (navigatedSource.pathStack.length < navigatedTarget.pathStack.length) {
        let prefixOf = true;
        for (let i = 0; i < navigatedSource.pathStack.length; ++i) {
          if (navigatedSource.pathStack[i] !== navigatedTarget.pathStack[i]) {
            prefixOf = false;
            break;
          }
        }
        if (prefixOf) {
          throw new VirtualFSError(errno.code.EINVAL, oldPath, newPath, 'rename');
        }
      }
    } else {
      // if oldPath is not a directory, then newPath cannot be an existing directory
      if (navigatedTarget.target && navigatedTarget.target instanceof Directory) {
        throw new VirtualFSError(errno.code.EISDIR, oldPath, newPath, 'rename');
      }
    }
    // both the navigatedSource.dir and navigatedTarget.dir must support write permissions
    if (!this._checkPermissions(constants.W_OK, navigatedSource.dir.getMetadata()) || !this._checkPermissions(constants.W_OK, navigatedTarget.dir.getMetadata())) {
      throw new VirtualFSError(errno.code.EACCES, oldPath, newPath, 'rename');
    }
    // if they are in the same directory, it is simple rename
    if (navigatedSource.dir === navigatedTarget.dir) {
      navigatedSource.dir.renameEntry(navigatedSource.name, navigatedTarget.name);
      return;
    }
    const index = navigatedSource.dir.getEntryIndex(navigatedSource.name);
    if (navigatedTarget.target) {
      navigatedTarget.target.getMetadata().ctime = new Date();
      navigatedTarget.dir.deleteEntry(navigatedTarget.name);
      navigatedTarget.dir.addEntry(navigatedTarget.name, index);
    } else {
      if (navigatedTarget.dir.getMetadata().nlink < 2) {
        throw new VirtualFSError(errno.code.ENOENT, oldPath, newPath, 'rename');
      }
      navigatedTarget.dir.addEntry(navigatedTarget.name, index);
    }
    navigatedSource.target.getMetadata().ctime = new Date();
    navigatedSource.dir.deleteEntry(navigatedSource.name);
    return;
  }

  rmdir(path, callback = callbackUp) {
    this._callAsync(this.rmdirSync.bind(this), [path], callback, callback);
    return;
  }

  rmdirSync(path) {
    path = this._getPath(path);
    // if the path has trailing slashes, navigation would traverse into it
    // we must trim off these trailing slashes to allow these directories to be removed
    path = path.replace(/(.+?)\/+$/, '$1');
    let navigated = this._navigate(path, false);
    // this is for if the path resolved to root
    if (!navigated.name) {
      throw new VirtualFSError(errno.code.EBUSY, path, null, 'rmdir');
    }
    // on linux, when .. is used, the parent directory becomes unknown
    // in that case, they return with ENOTEMPTY
    // but the directory may in fact be empty
    // for this edge case, we instead use EINVAL
    if (navigated.name === '.' || navigated.name === '..') {
      throw new VirtualFSError(errno.code.EINVAL, path, null, 'rmdir');
    }
    if (!navigated.target) {
      throw new VirtualFSError(errno.code.ENOENT, path, null, 'rmdir');
    }
    if (!(navigated.target instanceof Directory)) {
      throw new VirtualFSError(errno.code.ENOTDIR, path, null, 'rmdir');
    }
    if ([...navigated.target.getEntries()].length - 2) {
      throw new VirtualFSError(errno.code.ENOTEMPTY, path, null, 'rmdir');
    }
    if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
      throw new VirtualFSError(errno.code.EACCES, path, null, 'rmdir');
    }
    navigated.dir.deleteEntry(navigated.name);
    return;
  }

  stat(path, callback = callbackUp) {
    this._callAsync(this.statSync.bind(this), [path], stat => callback(null, stat), callback);
    return;
  }

  statSync(path) {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (target) {
      return new Stat(_extends({}, target.getMetadata()));
    } else {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
  }

  symlink(dstPath, srcPath, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.symlinkSync.bind(this), [dstPath, srcPath, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  symlinkSync(dstPath, srcPath, type = 'file') {
    dstPath = this._getPath(dstPath);
    srcPath = this._getPath(srcPath);
    if (!dstPath) {
      throw new VirtualFSError(errno.code.ENOENT, srcPath, dstPath, 'symlink');
    }
    let navigated = this._navigate(srcPath, false);
    if (!navigated.target) {
      if (navigated.dir.getMetadata().nlink < 2) {
        throw new VirtualFSError(errno.code.ENOENT, srcPath, dstPath, 'symlink');
      }
      if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
        throw new VirtualFSError(errno.code.EACCES, srcPath, dstPath, 'symlink');
      }

      var _iNodeMgr$createINode13 = this._iNodeMgr.createINode(Symlink, {
        mode: DEFAULT_SYMLINK_PERM,
        uid: this._uid,
        gid: this._gid,
        link: dstPath
      }),
          _iNodeMgr$createINode14 = _slicedToArray(_iNodeMgr$createINode13, 2);

      const index = _iNodeMgr$createINode14[1];

      navigated.dir.addEntry(navigated.name, index);
      return;
    } else {
      throw new VirtualFSError(errno.code.EEXIST, srcPath, dstPath, 'symlink');
    }
  }

  truncate(file, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.truncateSync.bind(this), [file, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  truncateSync(file, len = 0) {
    if (len < 0) {
      throw new VirtualFSError(errno.code.EINVAL, null, null, 'ftruncate');
    }
    if (typeof file === 'number') {
      this.ftruncateSync(file, len);
    } else {
      file = this._getPath(file);
      let fdIndex;
      try {
        fdIndex = this.openSync(file, constants.O_WRONLY);
        this.ftruncateSync(fdIndex, len);
      } finally {
        if (fdIndex !== undefined) this.closeSync(fdIndex);
      }
    }
    return;
  }

  unlink(path, callback = callbackUp) {
    this._callAsync(this.unlinkSync.bind(this), [path], callback, callback);
    return;
  }

  unlinkSync(path) {
    path = this._getPath(path);
    let navigated = this._navigate(path, false);
    if (!navigated.target) {
      throw new VirtualFSError(errno.code.ENOENT, path);
    }
    if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
      throw new VirtualFSError(errno.code.EACCES, path);
    }
    if (navigated.target instanceof Directory) {
      throw new VirtualFSError(errno.code.EISDIR, path);
    }
    navigated.target.getMetadata().ctime = new Date();
    navigated.dir.deleteEntry(navigated.name);
    return;
  }

  utimes(path, atime, mtime, callback = callbackUp) {
    this._callAsync(this.utimesSync.bind(this), [path, atime, mtime], callback, callback);
    return;
  }

  utimesSync(path, atime, mtime) {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (!target) {
      throw new VirtualFSError(errno.code.ENOENT, path, null, 'utimes');
    }
    const metadata = target.getMetadata();
    let newAtime;
    let newMtime;
    if (typeof atime === 'number') {
      newAtime = new Date(atime * 1000);
    } else if (typeof atime === 'string') {
      newAtime = new Date(parseInt(atime) * 1000);
    } else if (atime instanceof Date) {
      newAtime = atime;
    } else {
      throw TypeError('atime and mtime must be dates or unixtime in seconds');
    }
    if (typeof mtime === 'number') {
      newMtime = new Date(mtime * 1000);
    } else if (typeof mtime === 'string') {
      newMtime = new Date(parseInt(mtime) * 1000);
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
    const callback = args[cbIndex] || callbackUp;
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
    if (typeof data === 'string') {
      position = typeof offsetOrPos === 'number' ? offsetOrPos : null;
      lengthOrEncoding = typeof lengthOrEncoding === 'string' ? lengthOrEncoding : 'utf8';
      buffer$$1 = this._getBuffer(data, lengthOrEncoding);
    } else {
      offsetOrPos = typeof offsetOrPos === 'number' ? offsetOrPos : 0;
      if (offsetOrPos < 0 || offsetOrPos > data.length) {
        throw new RangeError('Offset is out of bounds');
      }
      lengthOrEncoding = typeof lengthOrEncoding === 'number' ? lengthOrEncoding : data.length;
      if (lengthOrEncoding < 0 || lengthOrEncoding > data.length) {
        throw new RangeError('Length is out of bounds');
      }
      buffer$$1 = this._getBuffer(data).slice(offsetOrPos, offsetOrPos + lengthOrEncoding);
    }
    try {
      return fd.write(buffer$$1, position);
    } catch (e) {
      if (e instanceof RangeError) {
        throw new VirtualFSError(errno.code.EFBIG, null, null, 'write');
      }
      if (e instanceof VirtualFSError) {
        e.setSyscall('write');
      }
      throw e;
    }
  }

  writeFile(file, data, ...args) {
    let cbIndex = args.findIndex(arg => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = cbIndex >= 0 ? cbIndex : args.length;
    this._callAsync(this.writeFileSync.bind(this), [file, data, ...args.slice(0, cbIndex)], callback, callback);
    return;
  }

  writeFileSync(file, data = 'undefined', options) {
    options = this._getOptions({
      encoding: 'utf8',
      mode: DEFAULT_FILE_PERM,
      flag: 'w'
    }, options);
    let fdIndex;
    try {
      const buffer$$1 = this._getBuffer(data, options.encoding);
      if (typeof file === 'number') {
        this.writeSync(file, buffer$$1, 0, buffer$$1.length, 0);
      } else {
        fdIndex = this.openSync(file, options.flag, options.mode);
        this.writeSync(fdIndex, buffer$$1, 0, buffer$$1.length, 0);
      }
    } finally {
      if (fdIndex !== undefined) this.closeSync(fdIndex);
    }
    return;
  }

  /**
   * Sets up an asynchronous call in accordance with Node behaviour.
   * This function should be implemented with microtask semantics.
   * Because the internal readable-stream package uses process.nextTick.
   * This must also use process.nextTick as well to be on the same queue.
   * It is required to polyfill the process.nextTick for browsers.
   * @private
   */
  _callAsync(syncFn, args, successCall, failCall) {
    process.nextTick(() => {
      try {
        let result = syncFn(...args);
        result = result === undefined ? null : result;
        successCall(result);
      } catch (e) {
        failCall(e);
      }
    });
    return;
  }

  /**
   * Processes path types and collapses it to a string.
   * The path types can be string or Buffer or URL.
   * @private
   */
  _getPath(path) {
    if (typeof path === 'string') {
      return path;
    }
    if (path instanceof buffer.Buffer) {
      return path.toString();
    }
    if (typeof path === 'object' && typeof path.pathname === 'string') {
      return this._getPathFromURL(path);
    }
    throw new TypeError('path must be a string or Buffer or URL');
  }

  /**
   * Acquires the file path from an URL object.
   * @private
   */
  _getPathFromURL(url) {
    if (url.hostname) {
      throw new TypeError('ERR_INVALID_FILE_URL_HOST');
    }
    const pathname = url.pathname;
    if (pathname.match(/%2[fF]/)) {
      // must not allow encoded slashes
      throw new TypeError('ERR_INVALID_FILE_URL_PATH');
    }
    return decodeURIComponent(pathname);
  }

  /**
   * Processes data types and collapses it to a Buffer.
   * The data types can be Buffer or Uint8Array or string.
   * @private
   */
  _getBuffer(data, encoding = null) {
    if (data instanceof buffer.Buffer) {
      return data;
    }
    if (data instanceof Uint8Array) {
      // zero copy implementation
      // also sliced to the view's constraint
      return buffer.Buffer.from(data.buffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    if (typeof data === 'string') {
      return buffer.Buffer.from(data, encoding);
    }
    throw new TypeError('data must be Buffer or Uint8Array or string');
  }

  /**
   * Takes a default set of options, and merges them shallowly into the user provided options.
   * Object spread syntax will ignore an undefined or null options object.
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
   * Checks the permissions fixng the current uid and gid.
   * If the user is root, they can access anything.
   * @private
   */
  _checkPermissions(access, stat) {
    if (this._uid !== DEFAULT_ROOT_UID) {
      return checkPermissions(access, this._uid, this._gid, stat);
    } else {
      return true;
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
   *   !target       => Non-existent segment
   *   name === ''   => Target is at root
   *   name === '.'  => dir is the same as target
   *   name === '..' => dir is a child directory
   * @private
   */
  _navigate(pathS, resolveLastLink = true, activeSymlinks = new _Set(), origPathS = pathS) {
    if (!pathS) {
      throw new VirtualFSError(errno.code.ENOENT, origPathS);
    }
    // multiple consecutive slashes are considered to be 1 slash
    pathS = pathS.replace(/\/+/, '/');
    // a trailing slash is considered to refer to a directory, thus it is converted to /.
    // functions that expect and specially handle missing directories should trim it away
    pathS = pathS.replace(/\/$/, '/.');
    if (pathS[0] === '/') {
      pathS = pathS.substring(1);
      if (!pathS) {
        return {
          dir: this._root,
          target: this._root,
          name: '', // root is the only situation where the name is empty
          remaining: '',
          pathStack: []
        };
      } else {
        return this._navigateFrom(this._root, pathS, resolveLastLink, activeSymlinks, [], origPathS);
      }
    } else {
      return this._navigateFrom(this._cwd.getINode(), pathS, resolveLastLink, activeSymlinks, this._cwd.getPathStack(), origPathS);
    }
  }

  /**
   * Navigates the filesystem tree from a given directory.
   * You should not use this directly unless you first call _navigate and pass the remaining path to _navigateFrom.
   * Note that the pathStack is always the full path to the target.
   * @private
   */
  _navigateFrom(curdir, pathS, resolveLastLink = true, activeSymlinks = new _Set(), pathStack = [], origPathS = pathS) {
    if (!pathS) {
      throw new VirtualFSError(errno.code.ENOENT, origPathS);
    }
    if (!this._checkPermissions(constants.X_OK, curdir.getMetadata())) {
      throw new VirtualFSError(errno.code.EACCES, origPathS);
    }
    let parse = this._parsePath(pathS);
    if (parse.segment !== '.') {
      if (parse.segment === '..') {
        pathStack.pop(); // this is a noop if the pathStack is empty
      } else {
        pathStack.push(parse.segment);
      }
    }
    let nextDir;
    let nextPath;
    let target = curdir.getEntry(parse.segment);
    if (target instanceof File || target instanceof CharacterDev) {
      if (!parse.rest) {
        return {
          dir: curdir,
          target: target,
          name: parse.segment,
          remaining: '',
          pathStack: pathStack
        };
      }
      throw new VirtualFSError(errno.code.ENOTDIR, origPathS);
    } else if (target instanceof Directory) {
      if (!parse.rest) {
        // if parse.segment is ., dir is not the same directory as target
        // if parse.segment is .., dir is the child directory
        return {
          dir: curdir,
          target: target,
          name: parse.segment,
          remaining: '',
          pathStack: pathStack
        };
      }
      nextDir = target;
      nextPath = parse.rest;
    } else if (target instanceof Symlink) {
      if (!resolveLastLink && !parse.rest) {
        return {
          dir: curdir,
          target: target,
          name: parse.segment,
          remaining: '',
          pathStack: pathStack
        };
      }
      if (activeSymlinks.has(target)) {
        throw new VirtualFSError(errno.code.ELOOP, origPathS);
      } else {
        activeSymlinks.add(target);
      }
      // although symlinks should not have an empty links, it's still handled correctly here
      nextPath = pathJoin(target.getLink(), parse.rest);
      if (nextPath[0] === '/') {
        return this._navigate(nextPath, resolveLastLink, activeSymlinks, origPathS);
      } else {
        pathStack.pop();
        nextDir = curdir;
      }
    } else {
      return {
        dir: curdir,
        target: null,
        name: parse.segment,
        remaining: parse.rest,
        pathStack: pathStack
      };
    }
    return this._navigateFrom(nextDir, nextPath, resolveLastLink, activeSymlinks, pathStack, origPathS);
  }

}

const nullDev = {
  setPos: (fd, position, flags) => {
    fd._pos = 0;
    return;
  },
  read: (fd, buffer$$1, position) => {
    return 0;
  },
  write: (fd, buffer$$1, position, extraFlags) => {
    return buffer$$1.length;
  }
};

const zeroDev = {
  setPos: (fd, position, flags) => {
    fd._pos = 0;
    return;
  },
  read: (fd, buffer$$1, position) => {
    buffer$$1.fill(0);
    return buffer$$1.length;
  },
  write: (fd, buffer$$1, position, extraFlags) => {
    return buffer$$1.length;
  }
};

/** @module Full */

const fullDev = {
  setPos: (fd, position, flags) => {
    fd._pos = 0;
    return;
  },
  read: (fd, buffer$$1, position) => {
    buffer$$1.fill(0);
    return buffer$$1.length;
  },
  write: (fd, buffer$$1, position, extraFlags) => {
    throw new VirtualFSError(errno.code.ENOSPC);
  }
};

/** @module Random */

const randomDev = {
  setPos: (fd, position, flags) => {
    fd._pos = 0;
    return;
  },
  read: (fd, buffer$$1, position) => {
    const randomBuf = Buffer.from(randomBytes(buffer$$1.length), 'ascii');
    randomBuf.copy(buffer$$1);
    return randomBuf.length;
  },
  write: (fd, buffer$$1, position, extraFlags) => {
    return buffer$$1.length;
  }
};

// $FlowFixMe: Buffer exists
// $FlowFixMe: process exists

/** @module Tty */

let fds = 0;
let fs$2 = null;
let ttyInFd = null;
let ttyOutFd = null;

const ttyDev = {
  open: fd => {
    if (fds === 0) {
      if (process__default.release && process__default.release.name === 'node') {
        fs$2 = require('fs');
        ttyOutFd = process__default.stdout.fd;
        if (process__default.platform === 'win32') {
          // on windows, stdin is in blocking mode
          // NOTE: on windows node repl environment, stdin is in raw mode
          //       make sure to set process.stdin.setRawMode(false)
          ttyInFd = process__default.stdin.fd;
        } else {
          // on non-windows, stdin is in non-blocking mode
          // to get blocking semantics we need to reopen stdin
          try {
            // if there are problems opening this
            // we assume there is no stdin
            ttyInFd = fs$2.openSync('/dev/fd/0', 'rs');
          } catch (e) {}
        }
      }
    }
    ++fds;
  },
  close: fd => {
    --fds;
    if (fds === 0) {
      if (ttyInFd && fs$2) {
        fs$2.closeSync(ttyInFd);
      }
    }
  },
  read: (fd, buffer$$1, position) => {
    if (ttyInFd !== null && fs$2) {
      // $FlowFixMe: position parameter allows null
      return fs$2.readSync(ttyInFd, buffer$$1, 0, buffer$$1.length, null);
    } else {
      if (window && window.prompt) {
        return buffer.Buffer.from(window.prompt()).copy(buffer$$1);
      }
      throw new VirtualFSError(errno.code.ENXIO);
    }
  },
  write: (fd, buffer$$1, position, extraFlags) => {
    if (ttyOutFd !== null && fs$2) {
      return fs$2.writeSync(ttyOutFd, buffer$$1);
    } else {
      console.log(buffer$$1.toString());
      return buffer$$1.length;
    }
  }
};

/** @module VirtualFSSingleton */

const devMgr = new DeviceManager();

devMgr.registerChr(nullDev, 1, 3);
devMgr.registerChr(zeroDev, 1, 5);
devMgr.registerChr(fullDev, 1, 7);
devMgr.registerChr(randomDev, 1, 8);
devMgr.registerChr(randomDev, 1, 9);
devMgr.registerChr(ttyDev, 4, 0);
devMgr.registerChr(ttyDev, 5, 0);
devMgr.registerChr(ttyDev, 5, 1);

const fs = new VirtualFS(undefined, undefined, devMgr);

fs.mkdirSync('/dev');
fs.chmodSync('/dev', 0o775);

fs.mknodSync('/dev/null', constants.S_IFCHR, 1, 3);
fs.mknodSync('/dev/zero', constants.S_IFCHR, 1, 5);
fs.mknodSync('/dev/full', constants.S_IFCHR, 1, 7);
fs.mknodSync('/dev/random', constants.S_IFCHR, 1, 8);
fs.mknodSync('/dev/urandom', constants.S_IFCHR, 1, 9);
fs.chmodSync('/dev/null', 0o666);
fs.chmodSync('/dev/zero', 0o666);
fs.chmodSync('/dev/full', 0o666);
fs.chmodSync('/dev/random', 0o666);
fs.chmodSync('/dev/urandom', 0o666);

// tty0 points to the currently active virtual console (on linux this is usually tty1 or tty7)
// tty points to the currently active console (physical, virtual or pseudo)
// console points to the system console (it defaults to tty0)
// refer to the tty character device to understand its implementation
fs.mknodSync('/dev/tty0', constants.S_IFCHR, 4, 0);
fs.mknodSync('/dev/tty', constants.S_IFCHR, 5, 0);
fs.mknodSync('/dev/console', constants.S_IFCHR, 5, 1);
fs.chmodSync('/dev/tty0', 0o600);
fs.chmodSync('/dev/tty', 0o666);
fs.chmodSync('/dev/console', 0o600);

fs.mkdirSync('/tmp');
fs.chmodSync('/tmp', 0o777);

fs.mkdirSync('/root');
fs.chmodSync('/root', 0o700);

exports['default'] = fs;
exports.VirtualFS = VirtualFS;
exports.Stat = Stat;
exports.constants = constants;
exports.nullDev = nullDev;
exports.zeroDev = zeroDev;
exports.fullDev = fullDev;
exports.randomDev = randomDev;
exports.Buffer = buffer.Buffer;
exports.nextTick = process.nextTick;
exports.VirtualFSError = VirtualFSError;
exports.errno = errno.code;
exports.MAJOR_BITSIZE = MAJOR_BITSIZE;
exports.MINOR_BITSIZE = MINOR_BITSIZE;
exports.MAJOR_MAX = MAJOR_MAX;
exports.MINOR_MAX = MINOR_MAX;
exports.MAJOR_MIN = MAJOR_MIN;
exports.MINOR_MIN = MINOR_MIN;
exports.DeviceManager = DeviceManager;
exports.DeviceError = DeviceError;
exports.mkDev = mkDev;
exports.unmkDev = unmkDev;
exports.File = File;
exports.Directory = Directory;
exports.Symlink = Symlink;
exports.CharacterDev = CharacterDev;
exports.INodeManager = INodeManager;
exports.FileDescriptor = FileDescriptor;
exports.FileDescriptorManager = FileDescriptorManager;
exports.ReadStream = ReadStream;
exports.WriteStream = WriteStream;
exports.DEFAULT_ROOT_UID = DEFAULT_ROOT_UID;
exports.DEFAULT_ROOT_GID = DEFAULT_ROOT_GID;
exports.DEFAULT_ROOT_PERM = DEFAULT_ROOT_PERM;
exports.DEFAULT_FILE_PERM = DEFAULT_FILE_PERM;
exports.DEFAULT_DIRECTORY_PERM = DEFAULT_DIRECTORY_PERM;
exports.DEFAULT_SYMLINK_PERM = DEFAULT_SYMLINK_PERM;
exports.applyUmask = applyUmask;
exports.checkPermissions = checkPermissions;

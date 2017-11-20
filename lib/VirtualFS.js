//@flow
/** @module VirtualFS */

import type { INode } from './INodes.js';
import type { optionsStream } from './Streams.js';

// $FlowFixMe: Buffer exists
import { Buffer } from 'buffer';
import { nextTick } from 'process';
import { posix as pathPosix } from 'path';
import permaProxy from 'permaproxy';
import constants from './constants.js';
import Stat from './Stat.js';
import CurrentDirectory from './CurrentDirectory.js';
import {
  DEFAULT_ROOT_UID,
  DEFAULT_ROOT_GID,
  DEFAULT_ROOT_PERM,
  DEFAULT_FILE_PERM,
  DEFAULT_DIRECTORY_PERM,
  DEFAULT_SYMLINK_PERM,
  applyUmask,
  checkPermissions
} from './permissions.js';
import {
  MINOR_BITSIZE,
  MAJOR_MAX,
  MINOR_MAX,
  MAJOR_MIN,
  MINOR_MIN,
  DeviceManager,
  mkDev
} from './Devices.js';
import {
  File,
  Directory,
  Symlink,
  CharacterDev,
  INodeManager
} from './INodes.js';
import {
  FileDescriptor,
  FileDescriptorManager
} from './FileDescriptors.js';
import { ReadStream, WriteStream } from './Streams.js';
import { VirtualFSError, errno } from './VirtualFSError.js';

type path = string | Buffer | {pathname: string};
type file = path | number;
type data = Buffer | Uint8Array | string;
type options = string | {
  encoding?: string|null,
  mode?: number,
  flag?: string
};
type callback = (VirtualFSError|null) => void;
type navigated = {
  dir: Directory,
  target: $Subtype<INode>|null,
  name: string,
  remaining: string,
  pathStack: Array<string>
};

/**
 * Asynchronous callback backup.
 */
const callbackUp: callback = (err) => { if (err) throw err; };

/**
 * Class representing a virtual filesystem.
 */
class VirtualFS {

  _uid: number;
  _gid: number;
  _umask: number;
  _devMgr: DeviceManager;
  _iNodeMgr: INodeManager;
  _fdMgr: FileDescriptorManager;
  _root: Directory;
  _cwd: CurrentDirectory;
  constants: Object;
  ReadStream: Class<ReadStream>;
  WriteStream: Class<WriteStream>;

  /**
   * Creates VirtualFS.
   */
  constructor (
    umask: number = 0o022,
    rootIndex: number|null = null,
    devMgr: DeviceManager = new DeviceManager,
    iNodeMgr: INodeManager = new INodeManager(devMgr),
    fdMgr: FileDescriptorManager = new FileDescriptorManager(iNodeMgr)
  ): void {
    let rootNode;
    if (typeof rootIndex === 'number') {
      rootNode = iNodeMgr.getINode(rootIndex);
      if (!(rootNode instanceof Directory)) {
        throw TypeError('rootIndex must point to a root directory');
      }
    } else {
      [rootNode] = iNodeMgr.createINode(
        Directory, { mode: DEFAULT_ROOT_PERM, uid: DEFAULT_ROOT_UID, gid: DEFAULT_ROOT_GID }
      );
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

  getUmask (): number {
    return this._umask;
  }

  setUmask (umask: number): void {
    this._umask = umask;
  }

  getUid (): number {
    return this._uid;
  }

  setUid (uid:number): void {
    this._uid = uid;
  }

  getGid (): number {
    return this._gid;
  }

  setGid (gid:number): void {
    this._gid = gid;
  }

  getCwd (): string {
    return this._cwd.getPath();
  }

  chdir (path: string): void {
    path = this._getPath(path);
    const navigated = this._navigate(path, true);
    if (!navigated.target) {
      throw new VirtualFSError(errno.ENOENT, path);
    }
    if (!(navigated.target instanceof Directory)) {
      throw new VirtualFSError(errno.ENOTDIR, path);
    }
    if (!this._checkPermissions(constants.X_OK, navigated.target.getMetadata())) {
      throw new VirtualFSError(errno.EACCES, path);
    }
    this._cwd.changeDir(navigated.target, navigated.pathStack);
  }

  access (path: string, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.accessSync.bind(this),
      [path, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  accessSync (path: string, mode: number = constants.F_OK): void {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (!target) {
      throw new VirtualFSError(errno.ENOENT, path);
    }
    if (mode === constants.F_OK) {
      return;
    }
    if (!this._checkPermissions(mode, target.getMetadata())) {
      throw new VirtualFSError(errno.EACCES, path);
    }
  }

  appendFile (file: file, data: data, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.appendFileSync.bind(this),
      [file, data, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  appendFileSync (
    file: file,
    data: data = 'undefined',
    options?: options
  ): void {
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
        if (!fd) throw new VirtualFSError(errno.EBADF, null, null, 'appendFile');
        if (!(fd.getFlags() & (constants.O_WRONLY | constants.O_RDWR))) {
          throw new VirtualFSError(errno.EBADF, null, null, 'appendFile');
        }
      } else {
        [fd, fdIndex] = this._openSync(file, options.flag, options.mode);
      }
      try {
        fd.write(data, null, constants.O_APPEND);
      } catch (e) {
        if (e instanceof RangeError) {
          throw new VirtualFSError(errno.EFBIG, null, null, 'appendFile');
        }
        throw e;
      }
    } finally {
      if (fdIndex !== undefined) this.closeSync(fdIndex);
    }
    return;
  }

  chmod (path: path, mode: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.chmodSync.bind(this),
      [path, mode],
      callback,
      callback
    );
    return;
  }

  chmodSync (path: path, mode: number): void {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (!target) {
      throw new VirtualFSError(errno.ENOENT, path);
    }
    if (typeof mode !== 'number') {
      throw new TypeError('mode must be an integer');
    }
    const targetMetadata = target.getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID && this._uid !== targetMetadata.uid) {
      throw new VirtualFSError(errno.EPERM, null, null, 'chmod');
    }
    targetMetadata.mode = (targetMetadata.mode & constants.S_IFMT) | mode;
    return;
  }

  chown (path: path, uid: number, gid: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.chownSync.bind(this),
      [path, uid, gid],
      callback,
      callback
    );
    return;
  }

  chownSync (path: path, uid: number, gid: number): void {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (!target) {
      throw new VirtualFSError(errno.ENOENT, path);
    }
    const targetMetadata = target.getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID) {
      // you don't own the file
      if (targetMetadata.uid !== this._uid) {
        throw new VirtualFSError(errno.EPERM, null, null, 'chown');
      }
      // you cannot give files to others
      if (this._uid !== uid) {
        throw new VirtualFSError(errno.EPERM, null, null, 'chown');
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

  close (fdIndex: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.closeSync.bind(this),
      [fdIndex],
      callback,
      callback
    );
    return;
  }

  closeSync (fdIndex: number): void {
    if (!this._fdMgr.getFd(fdIndex)) {
      throw new VirtualFSError(errno.EBADF, null, null, 'close');
    }
    this._fdMgr.deleteFd(fdIndex);
    return;
  }

  copyFile (srcPath: path, dstPath: path, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.copyFileSync.bind(this),
      [srcPath, dstPath, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  copyFileSync (srcPath: path, dstPath: path, flags: number = 0): void {
    srcPath = this._getPath(srcPath);
    dstPath = this._getPath(dstPath);
    let srcFd;
    let srcFdIndex;
    let dstFd;
    let dstFdIndex;
    try {
      // the only things that are copied is the data and the mode
      [srcFd, srcFdIndex] = this._openSync(srcPath, constants.O_RDONLY);
      const srcINode = srcFd.getINode();
      if (srcINode instanceof Directory) {
        throw new VirtualFSError(errno.EBADF, srcPath, dstPath);
      }
      let dstFlags = constants.WRONLY | constants.O_CREAT;
      if (flags & constants.COPYFILE_EXCL) {
        dstFlags |= constants.O_EXCL;
      }
      [dstFd, dstFdIndex] = this._openSync(dstPath, dstFlags, srcINode.getMetadata().mode);
      const dstINode = dstFd.getINode();
      if (dstINode instanceof File) {
        dstINode.setData(Buffer.from(srcINode.getData()));
      } else {
        throw new VirtualFSError(errno.EINVAL, srcPath, dstPath);
      }
    } finally {
      if (srcFdIndex !== undefined) this.closeSync(srcFdIndex);
      if (dstFdIndex !== undefined) this.closeSync(dstFdIndex);
    }
    return;
  }

  createReadStream (path: path, options?: optionsStream): ReadStream {
    path = this._getPath(path);
    options = this._getOptions(
      {
        flags: 'r',
        encoding: null,
        fd: null,
        mode: DEFAULT_FILE_PERM,
        autoClose: true,
        end: Infinity
      },
      options
    );
    if (options.start !== undefined) {
      if (options.start > options.end) {
        throw new RangeError('ERR_VALUE_OUT_OF_RANGE');
      }
    }
    return new ReadStream(path, options, this);
  }

  createWriteStream (path: path, options?: optionsStream): WriteStream {
    path = this._getPath(path);
    options = this._getOptions(
      {
        flags: 'w',
        defaultEncoding: 'utf8',
        fd: null,
        mode: DEFAULT_FILE_PERM,
        autoClose: true
      },
      options
    );
    if (options.start !== undefined) {
      if (options.start < 0) {
        throw new RangeError('ERR_VALUE_OUT_OF_RANGE');
      }
    }
    return new WriteStream(path, options, this);
  }

  exists (path: path, callback?: (boolean) => void): void {
    if (!callback) {
      callback = () => {};
    }
    this._callAsync(
      this.existsSync.bind(this),
      [path],
      callback,
      callback
    );
    return;
  }

  existsSync (path: path): boolean {
    path = this._getPath(path);
    try {
      return !!(this._navigate(path, true).target);
    } catch (e) {
      return false;
    }
  }

  fallocate (fdIndex: number, offset: number, len: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.fallocateSync.bind(this),
      [fdIndex, offset, len],
      callback,
      callback
    );
    return;
  }

  fallocateSync (fdIndex: number, offset: number, len: number): void {
    if (offset < 0 || len <= 0) {
      throw new VirtualFSError(errno.EINVAL, null, null, 'fallocate');
    }
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'fallocate');
    }
    const iNode = fd.getINode();
    if (!(iNode instanceof File)) {
      throw new VirtualFSError(errno.ENODEV, null, null, 'fallocate');
    }
    if (!(fd.getFlags() & (constants.O_WRONLY | constants.O_RDWR))) {
      throw new VirtualFSError(errno.EBADF, null, null, 'fallocate');
    }
    const data = iNode.getData();
    const metadata = iNode.getMetadata();
    if ((offset + len) > data.length) {
      let newData;
      try {
        newData = Buffer.concat([
          data,
          Buffer.alloc((offset + len) - data.length)
        ]);
      } catch (e) {
        if (e instanceof RangeError) {
          throw new VirtualFSError(errno.EFBIG, null, null, 'fallocate');
        }
        throw e;
      }
      iNode.setData(newData);
      metadata.size = newData.length;
    }
    metadata.ctime = new Date;
    return;
  }

  mmap (length: number, flags: number, fdIndex: number, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.mmapSync.bind(this),
      [length, flags, fdIndex, ...args.slice(0, cbIndex)],
      (buffer) => callback(null, buffer),
      callback
    );
    return;
  }

  mmapSync (length: number, flags: number, fdIndex: number, offset: number = 0): Buffer {
    if (length < 1 || offset < 0) {
      throw new VirtualFSError(errno.EINVAL, null, null, 'mmap');
    }
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'mmap');
    }
    const access = fd.getFlags() & constants.O_ACCMODE;
    if (access === constants.O_WRONLY) {
      throw new VirtualFSError(errno.EACCES, null, null, 'mmap');
    }
    const iNode = fd.getINode();
    if (!(iNode instanceof File)) {
      throw new VirtualFSError(errno.ENODEV, null, null, 'mmap');
    }
    switch (flags) {
    case constants.MAP_PRIVATE:
      return Buffer.from(iNode.getData().slice(offset, offset + length));
    case constants.MAP_SHARED:
      if (access !== constants.O_RDWR) {
        throw new VirtualFSError(errno.EACCES, null, null, 'mmap');
      }
      return permaProxy(iNode, '_data').slice(offset, offset + length);
    default:
      throw new VirtualFSError(errno.EINVAL, null, null, 'mmap');
    }
  }

  fchmod (fdIndex: number, mode: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.fchmodSync.bind(this),
      [fdIndex, mode],
      callback,
      callback
    );
    return;
  }

  fchmodSync (fdIndex: number, mode: number): void {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'fchmod');
    }
    if (typeof mode !== 'number') {
      throw new TypeError('mode must be an integer');
    }
    const fdMetadata = fd.getINode().getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID && this._uid !== fdMetadata.uid) {
      throw new VirtualFSError(errno.EPERM, null, null, 'fchmod');
    }
    fdMetadata.mode = (fdMetadata.mode & constants.S_IMFT) | mode;
    return;
  }

  fchown (fdIndex: number, uid: number, gid: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.fchmodSync.bind(this),
      [fdIndex, uid, gid],
      callback,
      callback
    );
    return;
  }

  fchownSync (fdIndex: number, uid: number, gid: number): void {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'fchown');
    }
    const fdMetadata = fd.getINode().getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID) {
      // you don't own the file
      if (fdMetadata.uid !== this._uid) {
        throw new VirtualFSError(errno.EPERM, null, null, 'fchown');
      }
      // you cannot give files to others
      if (this._uid !== uid) {
        throw new VirtualFSError(errno.EPERM, null, null, 'fchown');
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

  fdatasync (fdIndex: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.fchmodSync.bind(this),
      [fdIndex],
      callback,
      callback
    );
    return;
  }

  fdatasyncSync (fdIndex: number): void {
    if (!this._fdMgr.getFd(fdIndex)) {
      throw new VirtualFSError(errno.EBADF, null, null, 'fdatasync');
    }
    return;
  }

  fstat (fdIndex: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.fstatSync.bind(this),
      [fdIndex],
      (stat) => callback(null, stat),
      callback
    );
    return;
  }

  fstatSync (fdIndex: number): Stat {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'fstat');
    }
    return new Stat({...fd.getINode().getMetadata()});
  }

  fsync (fdIndex: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.fsyncSync.bind(this),
      [fdIndex],
      callback,
      callback
    );
    return;
  }

  fsyncSync (fdIndex: number): void {
    if (!this._fdMgr.getFd(fdIndex)) {
      throw new VirtualFSError(errno.EBADF, null, null, 'fsync');
    }
    return;
  }

  ftruncate (fdIndex: number, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.ftruncateSync.bind(this),
      [fdIndex, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  ftruncateSync (fdIndex: number, len: number = 0): void {
    if (len < 0) {
      throw new VirtualFSError(errno.EINVAL, null, null, 'ftruncate');
    }
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'ftruncate');
    }
    const iNode = fd.getINode();
    if (!(iNode instanceof File)) {
      throw new VirtualFSError(errno.EINVAL, null, null, 'ftruncate');
    }
    if (!(fd.getFlags() & (constants.O_WRONLY | constants.O_RDWR))) {
      throw new VirtualFSError(errno.EINVAL, null, null, 'ftruncate');
    }
    const data = iNode.getData();
    const metadata = iNode.getMetadata();
    let newData;
    try {
      if (len > data.length) {
        newData = Buffer.alloc(len);
        data.copy(newData, 0, 0, data.length);
        iNode.setData(newData);
      } else if (len < data.length) {
        newData = Buffer.allocUnsafe(len);
        data.copy(newData, 0, 0, len);
        iNode.setData(newData);
      } else {
        newData = data;
      }
    } catch (e) {
      if (e instanceof RangeError) {
        throw new VirtualFSError(errno.EFBIG, null, null, 'ftruncate');
      }
      throw e;
    }
    const now = new Date;
    metadata.mtime = now;
    metadata.ctime = now;
    metadata.size = newData.length;
    fd.setPos(Math.min(newData.length, fd.getPos()));
    return;
  }

  futimes (fdIndex: number, atime: number|Date, mtime: number|Date, callback: callback = callbackUp): void {
    this._callAsync(
      this.futimesSync.bind(this),
      [fdIndex, atime, mtime],
      callback,
      callback
    );
    return;
  }

  futimesSync (fdIndex: number, atime: number|string|Date, mtime: number|string|Date): void {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'futimes');
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
    metadata.ctime = new Date;
    return;
  }

  lchmod (path: path, mode: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.lchmodSync.bind(this),
      [path, mode],
      callback,
      callback
    );
    return;
  }

  lchmodSync (path: path, mode: number): void {
    path = this._getPath(path);
    const target = this._navigate(path, false).target;
    if (!target) {
      throw new VirtualFSError(errno.ENOENT, path);
    }
    if (typeof mode !== 'number') {
      throw new TypeError('mode must be an integer');
    }
    const targetMetadata = target.getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID && this._uid !== targetMetadata.uid) {
      throw new VirtualFSError(errno.EPERM, null, null, 'lchmod');
    }
    targetMetadata.mode = (targetMetadata.mode & constants.S_IFMT) | mode;
    return;
  }

  lchown (path: path, uid: number, gid: number, callback: callback = callbackUp): void {
    this._callAsync(
      this.lchownSync.bind(this),
      [path, uid, gid],
      callback,
      callback
    );
    return;
  }

  lchownSync (path: path, uid: number, gid: number): void {
    path = this._getPath(path);
    const target = this._navigate(path, false).target;
    if (!target) {
      throw new VirtualFSError(errno.ENOENT, path);
    }
    const targetMetadata = target.getMetadata();
    if (this._uid !== DEFAULT_ROOT_UID) {
      // you don't own the file
      if (targetMetadata.uid !== this._uid) {
        throw new VirtualFSError(errno.EPERM, null, null, 'lchown');
      }
      // you cannot give files to others
      if (this._uid !== uid) {
        throw new VirtualFSError(errno.EPERM, null, null, 'lchown');
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

  link (existingPath: path, newPath: path, callback: callback = callbackUp): void {
    this._callAsync(
      this.linkSync.bind(this),
      [existingPath, newPath],
      callback,
      callback
    );
    return;
  }

  linkSync (existingPath: path, newPath: path): void {
    existingPath = this._getPath(existingPath);
    newPath = this._getPath(newPath);
    let navigatedExisting;
    let navigatedNew;
    navigatedExisting = this._navigate(existingPath, false);
    navigatedNew = this._navigate(newPath, false);
    if (!navigatedExisting.target) {
      throw new VirtualFSError(errno.ENOENT, existingPath, newPath, 'link');
    }
    if (navigatedExisting.target instanceof Directory) {
      throw new VirtualFSError(errno.EPERM, existingPath, newPath, 'link');
    }
    if (!navigatedNew.target) {
      if (navigatedNew.dir.getMetadata().nlink < 2) {
        throw new VirtualFSError(errno.ENOENT, existingPath, newPath, 'link');
      }
      if (!this._checkPermissions(constants.W_OK, navigatedNew.dir.getMetadata())) {
        throw new VirtualFSError(errno.EACCES, existingPath, newPath, 'link');
      }
      const index = navigatedExisting.dir.getEntryIndex(navigatedExisting.name);
      navigatedNew.dir.addEntry(navigatedNew.name, index);
      navigatedExisting.target.getMetadata().ctime = new Date;
    } else {
      throw new VirtualFSError(errno.EEXIST, existingPath, newPath, 'link');
    }
    return;
  }

  lseek (fdIndex: number, position: number, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.lseekSync.bind(this),
      [fdIndex, position, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  lseekSync (fdIndex: number, position: number, seekFlags: number = constants.SEEK_SET): void {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'lseek');
    }
    if (
      [
        constants.SEEK_SET,
        constants.SEEK_CUR,
        constants.SEEK_END
      ].indexOf(seekFlags) === -1
    ) {
      throw new VirtualFSError(errno.EINVAL, null, null, 'lseek');
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

  lstat (path: path, callback: callback = callbackUp): void {
    this._callAsync(
      this.lstatSync.bind(this),
      [path],
      (stat) => callback(null, stat),
      callback
    );
    return;
  }

  lstatSync (path: path): Stat {
    path = this._getPath(path);
    const target = this._navigate(path, false).target;
    if (target) {
      return new Stat({...target.getMetadata()});
    } else {
      throw new VirtualFSError(errno.ENOENT, path);
    }
  }

  mkdir (path: path, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.mkdirSync.bind(this),
      [path, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  mkdirSync (path: path, mode: number = DEFAULT_DIRECTORY_PERM): void {
    path = this._getPath(path);
    // we expect a non-existent directory
    path = path.replace(/(.+?)\/+$/, '$1');
    let navigated = this._navigate(path, true);
    if (navigated.target) {
      throw new VirtualFSError(errno.EEXIST, path, null, 'mkdir');
    } else if (!navigated.target && navigated.remaining) {
      throw new VirtualFSError(errno.ENOENT, path, null, 'mkdir');
    } else if (!navigated.target) {
      if (navigated.dir.getMetadata().nlink < 2) {
        throw new VirtualFSError(errno.ENOENT, path, null, 'mkdir');
      }
      if (!this._checkPermissions(
          constants.W_OK,
          navigated.dir.getMetadata()
      )) {
        throw new VirtualFSError(errno.EACCES, path, null, 'mkdir');
      }
      const [, index] = this._iNodeMgr.createINode(
        Directory,
        {
          mode: applyUmask(mode, this._umask),
          uid: this._uid,
          gid: this._gid,
          parent: navigated.dir.getEntryIndex('.')
        }
      );
      navigated.dir.addEntry(navigated.name, index);
    }
    return;
  }

  mkdirp (path: path, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.mkdirpSync.bind(this),
      [path, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  mkdirpSync (path: path, mode: number = DEFAULT_DIRECTORY_PERM): void {
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
          throw new VirtualFSError(errno.ENOENT, path);
        }
        if (!this._checkPermissions(
          constants.W_OK,
          navigated.dir.getMetadata()
        )) {
          throw new VirtualFSError(errno.EACCES, path);
        }
        [iNode, index] = this._iNodeMgr.createINode(
          Directory,
          {
            mode: applyUmask(mode, this._umask),
            uid: this._uid,
            gid: this._gid,
            parent: navigated.dir.getEntryIndex('.')
          }
        );
        navigated.dir.addEntry(navigated.name, index);
        if (navigated.remaining) {
          currentDir = iNode;
          navigated = this._navigateFrom(currentDir, navigated.remaining, true);
        } else {
          break;
        }
      } else if (!(navigated.target instanceof Directory)) {
        throw new VirtualFSError(errno.ENOTDIR, path);
      } else {
        break;
      }
    }
    return;
  }

  mkdtemp (pathSPrefix: string, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.mkdtempSync.bind(this),
      [pathSPrefix, ...args.slice(0, cbIndex)],
      (pathS) => callback(null, pathS),
      callback
    );
    return;
  }

  mkdtempSync (pathSPrefix: string, options?: options): string|Buffer {
    options = this._getOptions({encoding: 'utf8'}, options);
    if (!pathSPrefix || typeof pathSPrefix !== 'string') {
      throw new TypeError('filename prefix is required');
    }
    const getChar = () => {
      const possibleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      return possibleChars[Math.floor(Math.random() * possibleChars.length)];
    };
    let pathS;
    while (true) {
      pathS = pathSPrefix.concat(
        Array.from({length: 6}, () => getChar).map((f) => f()).join('')
      );
      try {
        this.mkdirSync(pathS);
        if (options.encoding === 'buffer') {
          return Buffer.from(pathS);
        } else {
          return Buffer.from(pathS).toString(options.encoding);
        }
      } catch (e) {
        if (e.code !== errno.EEXIST) {
          throw e;
        }
      }
    }
  }

  mknod (
    path: path,
    type: number,
    major: number,
    minor: number,
    ...args: Array<any>
  ): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.mknodSync.bind(this),
      [path, type, major, minor, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  mknodSync (
    path: path,
    type: number,
    major: number,
    minor: number,
    mode: number = DEFAULT_FILE_PERM
  ): void {
    path = this._getPath(path);
    const navigated = this._navigate(path, false);
    if (navigated.target) {
      throw new VirtualFSError(errno.EEXIST, path, null, 'mknod');
    }
    if (navigated.dir.getMetadata().nlink < 2) {
      throw new VirtualFSError(errno.ENOENT, path, null, 'mknod');
    }
    if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
      throw new VirtualFSError(errno.EACCES, path, null, 'mknod');
    }
    let index;
    switch (type) {
    case constants.S_IFREG:
      [, index] = this._iNodeMgr.createINode(
        File,
        {
          mode: applyUmask(mode, this._umask),
          uid: this._uid,
          gid: this._gid
        }
      );
      break;
    case constants.S_IFCHR:
      if (typeof major !== 'number' || typeof minor !== 'number') {
        throw TypeError('major and minor must set as numbers when creating device nodes');
      }
      if (major > MAJOR_MAX ||  minor > MINOR_MAX || minor < MAJOR_MIN || minor < MINOR_MIN) {
        throw new VirtualFSError(errno.EINVAL, path, null, 'mknod');
      }
      [, index] = this._iNodeMgr.createINode(
        CharacterDev,
        {
          mode: applyUmask(mode, this._umask),
          uid: this._uid,
          gid: this._gid,
          rdev: mkDev(major, minor)
        }
      );
      break;
    default:
      throw new VirtualFSError(errno.EPERM, path, null, 'mknod');
    }
    navigated.dir.addEntry(navigated.name, index);
    return;
  }

  open (path: path, flags: string|number, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.openSync.bind(this),
      [path, flags, ...args.slice(0, cbIndex)],
      (fdIndex) => callback(null, fdIndex),
      callback
    );
    return;
  }

  openSync (
    path: path,
    flags: string|number,
    mode: number = DEFAULT_FILE_PERM
  ): number {
    return this._openSync(path, flags, mode)[1];
  }

  _openSync (
    path: path,
    flags: string|number,
    mode: number = DEFAULT_FILE_PERM
  ): [FileDescriptor<*>, number] {
    path = this._getPath(path);
    if (typeof flags === 'string') {
      switch(flags) {
      case 'r':
      case 'rs':
        flags = constants.O_RDONLY;
        break;
      case 'r+':
      case 'rs+':
        flags = constants.O_RDWR;
        break;
      case 'w':
        flags = (constants.O_WRONLY |
                 constants.O_CREAT  |
                 constants.O_TRUNC);
        break;
      case 'wx':
        flags = (constants.O_WRONLY |
                 constants.O_CREAT  |
                 constants.O_TRUNC  |
                 constants.O_EXCL);
        break;
      case 'w+':
        flags = (constants.O_RDWR  |
                 constants.O_CREAT |
                 constants.O_TRUNC);
        break;
      case 'wx+':
        flags = (constants.O_RDWR  |
                 constants.O_CREAT |
                 constants.O_TRUNC |
                 constants.O_EXCL);
        break;
      case 'a':
        flags = (constants.O_WRONLY |
                 constants.O_APPEND |
                 constants.O_CREAT);
        break;
      case 'ax':
        flags = (constants.O_WRONLY |
                 constants.O_APPEND |
                 constants.O_CREAT  |
                 constants.O_EXCL);
        break;
      case 'a+':
        flags = (constants.O_RDWR   |
                 constants.O_APPEND |
                 constants.O_CREAT);
        break;
      case 'ax+':
        flags = (constants.O_RDWR   |
                 constants.O_APPEND |
                 constants.O_CREAT  |
                 constants.O_EXCL);
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
        throw new VirtualFSError(errno.ELOOP, path, null, 'open');
      }
      navigated = this._navigateFrom(
        navigated.dir,
        navigated.name + navigated.remaining,
        true,
        undefined,
        undefined,
        path
      );
    }
    let target = navigated.target;
    // cannot be missing unless O_CREAT
    if (!target) {
      // O_CREAT only applies if there's a left over name without any remaining path
      if (!navigated.remaining && (flags & constants.O_CREAT)) {
        // cannot create if the current directory has been unlinked from its parent directory
        if (navigated.dir.getMetadata().nlink < 2) {
          throw new VirtualFSError(errno.ENOENT, path, null, 'open');
        }
        if (!this._checkPermissions(
          constants.W_OK,
          navigated.dir.getMetadata()
        )) {
          throw new VirtualFSError(errno.EACCES, path, null, 'open');
        }
        let index;
        [target, index] = this._iNodeMgr.createINode(
          File,
          {
            mode: applyUmask(mode, this._umask),
            uid: this._uid,
            gid: this._gid
          }
        );
        navigated.dir.addEntry(navigated.name, index);
      } else {
        throw new VirtualFSError(errno.ENOENT, path, null, 'open');
      }
    } else {
      // target already exists cannot be created exclusively
      if ((flags & constants.O_CREAT) && (flags & constants.O_EXCL)) {
        throw new VirtualFSError(errno.EEXIST, path, null, 'open');
      }
      // cannot be directory if write capabilities are requested
      if ((target instanceof Directory) &&
          (flags & (constants.O_WRONLY | flags & constants.O_RDWR)))
      {
        throw new VirtualFSError(errno.EISDIR, path, null, 'open');
      }
      // must be directory if O_DIRECTORY
      if ((flags & constants.O_DIRECTORY) && !(target instanceof Directory)) {
        throw new VirtualFSError(errno.ENOTDIR, path, null, 'open');
      }
      // must truncate a file if O_TRUNC
      if ((flags & constants.O_TRUNC) &&
          (target instanceof File) &&
          (flags & (constants.O_WRONLY | constants.O_RDWR)))
      {
        target.setData(Buffer.alloc(0));
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
        throw new VirtualFSError(errno.EACCES, path, null, 'open');
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

  read (fdIndex: number, buffer: data, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.readSync.bind(this),
      [fdIndex, buffer, ...args.slice(0, cbIndex)],
      (bytesRead) => callback(null, bytesRead, buffer),
      callback
    );
    return;
  }

  readSync (
    fdIndex: number,
    buffer: data,
    offset: number = 0,
    length: number = 0,
    position: number|null = null
  ): number {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'read');
    }
    if (typeof position === 'number' && position < 0) {
      throw new VirtualFSError(errno.EINVAL, null, null, 'read');
    }
    if (fd.getINode().getMetadata().isDirectory()) {
      throw new VirtualFSError(errno.EISDIR, null, null, 'read');
    }
    const flags = fd.getFlags();
    if (flags & constants.O_WRONLY) {
      throw new VirtualFSError(errno.EBADF, null, null, 'read');
    }
    if (offset < 0 || offset > buffer.length) {
      throw new RangeError('Offset is out of bounds');
    }
    if (length < 0 || length > buffer.length) {
      throw new RangeError('Length extends beyond buffer');
    }
    buffer = this._getBuffer(buffer).slice(offset, offset + length);
    let bytesRead;
    try {
      bytesRead = fd.read(buffer, position);
    } catch (e) {
      if (e instanceof VirtualFSError) {
        e.syscall = 'read';
      }
      throw e;
    }
    return bytesRead;
  }

  readdir (path: path, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.readdirSync.bind(this),
      [path, ...args.slice(0, cbIndex)],
      (files) => callback(null, files),
      callback
    );
    return;
  }

  readdirSync (path: path, options?: options): Array<string|Buffer> {
    path = this._getPath(path);
    options = this._getOptions({encoding: 'utf8'}, options);
    let navigated = this._navigate(path, true);
    if (!navigated.target) {
      throw new VirtualFSError(errno.ENOENT, path, null, 'readdir');
    }
    if (!(navigated.target instanceof Directory)) {
      throw new VirtualFSError(errno.ENOTDIR, path, null, 'readdir');
    }
    if (!this._checkPermissions(constants.R_OK, navigated.target.getMetadata())) {
      throw new VirtualFSError(errno.EACCES, path, null, 'readdir');
    }
    return [...navigated.target.getEntries()]
      .filter(([name, _]) => name !== '.' && name !== '..')
      .map(([name, _]) => {
        // $FlowFixMe: options exists
        if (options.encoding === 'buffer') {
          return Buffer.from(name);
        } else {
          // $FlowFixMe: options exists and is not a string
          return Buffer.from(name).toString(options.encoding);
        }
      });
  }

  readFile (file: file, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.readFileSync.bind(this),
      [file, ...args.slice(0, cbIndex)],
      (data) => callback(null, data),
      callback
    );
    return;
  }

  readFileSync (file: file, options?: options): string|Buffer {
    options = this._getOptions({encoding: null, flag: 'r'}, options);
    let fdIndex;
    try {
      const buffer = Buffer.allocUnsafe(4096);
      let totalBuffer = Buffer.alloc(0);
      let bytesRead = null;
      if (typeof file === 'number') {
        while (bytesRead !== 0) {
          bytesRead = this.readSync(file, buffer, 0, buffer.length);
          totalBuffer = Buffer.concat([totalBuffer, buffer.slice(0, bytesRead)]);
        }
      } else {
        fdIndex = this.openSync(file, options.flag);
        while (bytesRead !== 0) {
          bytesRead = this.readSync(fdIndex, buffer, 0, buffer.length);
          totalBuffer = Buffer.concat([totalBuffer, buffer.slice(0, bytesRead)]);
        }
      }
      return (options.encoding) ? totalBuffer.toString(options.encoding) : totalBuffer;
    } finally {
      if (fdIndex !== undefined) this.closeSync(fdIndex);
    }
  }

  readlink (path: path, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.readlinkSync.bind(this),
      [path, ...args.slice(0, cbIndex)],
      (linkString) => callback(null, linkString),
      callback
    );
    return;
  }

  readlinkSync (path: path, options?: options): string|Buffer {
    path = this._getPath(path);
    options = this._getOptions({encoding: 'utf8'}, options);
    let target = this._navigate(path, false).target;
    if (!target) {
      throw new VirtualFSError(errno.ENOENT, path);
    }
    if (!(target instanceof Symlink)) {
      throw new VirtualFSError(errno.EINVAL, path);
    }
    const link = target.getLink();
    if (options.encoding === 'buffer') {
      return Buffer.from(link);
    } else {
      return Buffer.from(link).toString(options.encoding);
    }
  }

  realpath (path: path, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.realpathSync.bind(this),
      [path, ...args.slice(0, cbIndex)],
      (path) => callback(null, path),
      callback
    );
    return;
  }

  realpathSync (path: path, options?: options): string|Buffer {
    path = this._getPath(path);
    options = this._getOptions({encoding: 'utf8'}, options);
    const navigated = this._navigate(path, true);
    if (!navigated.target) {
      throw new VirtualFSError(errno.ENOENT, path);
    }
    if (options.encoding === 'buffer') {
      return Buffer.from('/' + navigated.pathStack.join('/'));
    } else {
      return Buffer.from('/' + navigated.pathStack.join('/')).toString(options.encoding);
    }
  }

  rename (oldPath: path, newPath: path, callback: callback = callbackUp): void {
    this._callAsync(
      this.renameSync.bind(this),
      [oldPath, newPath],
      callback,
      callback
    );
    return;
  }

  renameSync (oldPath: path, newPath: path): void {
    oldPath = this._getPath(oldPath);
    newPath = this._getPath(newPath);
    const navigatedSource = this._navigate(oldPath, false);
    const navigatedTarget = this._navigate(newPath, false);
    if (!navigatedSource.target) {
      throw new VirtualFSError(errno.ENOENT, oldPath, newPath, 'rename');
    }
    if (navigatedSource.target instanceof Directory) {
      // if oldPath is a directory, target must be a directory (if it exists)
      if (navigatedTarget.target &&
          !(navigatedTarget.target instanceof Directory))
      {
        throw new VirtualFSError(errno.ENOTDIR, oldPath, newPath, 'rename');
      }
      // neither oldPath nor newPath can point to root
      if (navigatedSource.target === this._root ||
          navigatedTarget.target === this._root)
      {
        throw new VirtualFSError(errno.EBUSY, oldPath, newPath, 'rename');
      }
      // if the target directory contains elements this cannot be done
      // this can be done without read permissions
      if (navigatedTarget.target && ([...navigatedTarget.target.getEntries()].length - 2)) {
        throw new VirtualFSError(errno.ENOTEMPTY, oldPath, newPath, 'rename');
      }
      // if any of the paths used .. or ., then `dir` is not the parent directory
      if (navigatedSource.name === '.'  ||
          navigatedSource.name === '..' ||
          navigatedTarget.name === '.'  ||
          navigatedTarget.name === '..' )
      {
        throw new VirtualFSError(errno.EBUSY, oldPath, newPath, 'rename');
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
          throw new VirtualFSError(errno.EINVAL, oldPath, newPath, 'rename');
        }
      }
    } else {
      // if oldPath is not a directory, then newPath cannot be an existing directory
      if (navigatedTarget.target && navigatedTarget.target instanceof Directory) {
        throw new VirtualFSError(errno.EISDIR, oldPath, newPath, 'rename');
      }
    }
    // both the navigatedSource.dir and navigatedTarget.dir must support write permissions
    if (!this._checkPermissions(constants.W_OK, navigatedSource.dir.getMetadata()) ||
        !this._checkPermissions(constants.W_OK, navigatedTarget.dir.getMetadata()))
    {
      throw new VirtualFSError(errno.EACCES, oldPath, newPath, 'rename');
    }
    // if they are in the same directory, it is simple rename
    if (navigatedSource.dir === navigatedTarget.dir) {
      navigatedSource.dir.renameEntry(navigatedSource.name, navigatedTarget.name);
      return;
    }
    const index = navigatedSource.dir.getEntryIndex(navigatedSource.name);
    if (navigatedTarget.target) {
      navigatedTarget.target.getMetadata().ctime = new Date;
      navigatedTarget.dir.deleteEntry(navigatedTarget.name);
      navigatedTarget.dir.addEntry(navigatedTarget.name, index);
    } else {
      if (navigatedTarget.dir.getMetadata().nlink < 2) {
        throw new VirtualFSError(errno.ENOENT, oldPath, newPath, 'rename');
      }
      navigatedTarget.dir.addEntry(navigatedTarget.name, index);
    }
    navigatedSource.target.getMetadata().ctime = new Date;
    navigatedSource.dir.deleteEntry(navigatedSource.name);
    return;
  }

  rmdir (path: path, callback: callback = callbackUp): void {
    this._callAsync(
      this.rmdirSync.bind(this),
      [path],
      callback,
      callback
    );
    return;
  }

  rmdirSync (path: path): void {
    path = this._getPath(path);
    // if the path has trailing slashes, navigation would traverse into it
    // we must trim off these trailing slashes to allow these directories to be removed
    path = path.replace(/(.+?)\/+$/, '$1');
    let navigated = this._navigate(path, false);
    // this is for if the path resolved to root
    if (!navigated.name) {
      throw new VirtualFSError(errno.EBUSY, path, null, 'rmdir');
    }
    // on linux, when .. is used, the parent directory becomes unknown
    // in that case, they return with ENOTEMPTY
    // but the directory may in fact be empty
    // for this edge case, we instead use EINVAL
    if (navigated.name === '.' || navigated.name === '..') {
      throw new VirtualFSError(errno.EINVAL, path, null, 'rmdir');
    }
    if (!navigated.target) {
      throw new VirtualFSError(errno.ENOENT, path, null, 'rmdir');
    }
    if (!(navigated.target instanceof Directory)) {
      throw new VirtualFSError(errno.ENOTDIR, path, null, 'rmdir');
    }
    if ([...navigated.target.getEntries()].length - 2) {
      throw new VirtualFSError(errno.ENOTEMPTY, path, null, 'rmdir');
    }
    if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
      throw new VirtualFSError(errno.EACCES, path, null, 'rmdir');
    }
    navigated.dir.deleteEntry(navigated.name);
    return;
  }

  stat (path: path, callback: callback = callbackUp): void {
    this._callAsync(
      this.statSync.bind(this),
      [path],
      (stat) => callback(null, stat),
      callback
    );
    return;
  }

  statSync (path: path): Stat {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (target) {
      return new Stat({...target.getMetadata()});
    } else {
      throw new VirtualFSError(errno.ENOENT, path);
    }
  }

  symlink (dstPath: path, srcPath: path, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.symlinkSync.bind(this),
      [dstPath, srcPath, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  symlinkSync (dstPath: path, srcPath: path, type: string = 'file'): void {
    dstPath = this._getPath(dstPath);
    srcPath = this._getPath(srcPath);
    if (!dstPath) {
      throw new VirtualFSError(errno.ENOENT, srcPath, dstPath, 'symlink');
    }
    let navigated = this._navigate(srcPath, false);
    if (!navigated.target) {
      if (navigated.dir.getMetadata().nlink < 2) {
        throw new VirtualFSError(errno.ENOENT, srcPath, dstPath, 'symlink');
      }
      if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
        throw new VirtualFSError(errno.EACCES, srcPath, dstPath, 'symlink');
      }
      const [, index] = this._iNodeMgr.createINode(
        Symlink,
        {
          mode: DEFAULT_SYMLINK_PERM,
          uid: this._uid,
          gid: this._gid,
          link: dstPath
        }
      );
      navigated.dir.addEntry(navigated.name, index);
      return;
    } else {
      throw new VirtualFSError(errno.EEXIST, srcPath, dstPath, 'symlink');
    }
  }

  truncate (file: file, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.truncateSync.bind(this),
      [file, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  truncateSync (file: file, len: number = 0): void {
    if (len < 0) {
      throw new VirtualFSError(errno.EINVAL, null, null, 'ftruncate');
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

  unlink (path: path, callback: callback = callbackUp): void {
    this._callAsync(
      this.unlinkSync.bind(this),
      [path],
      callback,
      callback
    );
    return;
  }

  unlinkSync (path: path): void {
    path = this._getPath(path);
    let navigated = this._navigate(path, false);
    if (!navigated.target) {
      throw new VirtualFSError(errno.ENOENT, path);
    }
    if (!this._checkPermissions(constants.W_OK, navigated.dir.getMetadata())) {
      throw new VirtualFSError(errno.EACCES, path);
    }
    if (navigated.target instanceof Directory) {
      throw new VirtualFSError(errno.EISDIR, path);
    }
    navigated.target.getMetadata().ctime = new Date;
    navigated.dir.deleteEntry(navigated.name);
    return;
  }

  utimes (
    path: path,
    atime: string|number|Date,
    mtime: string|number|Date,
    callback: callback = callbackUp
  ): void {
    this._callAsync(
      this.utimesSync.bind(this),
      [path, atime, mtime],
      callback,
      callback
    );
    return;
  }

  utimesSync (
    path: path,
    atime: number|string|Date,
    mtime: number|string|Date
  ): void {
    path = this._getPath(path);
    const target = this._navigate(path, true).target;
    if (!target) {
      throw new VirtualFSError(errno.ENOENT, path, null, 'utimes');
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
    metadata.ctime = new Date;
    return;
  }

  write (fdIndex: number, data: data, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.writeSync.bind(this),
      [fdIndex, data, ...args.slice(0, cbIndex)],
      (bytesWritten) => callback(null, bytesWritten, data),
      callback
    );
    return;
  }

  writeSync (
    fdIndex: number,
    data: data,
    offsetOrPos: ?number,
    lengthOrEncoding?: number|string,
    position: number|null = null
  ): number {
    const fd = this._fdMgr.getFd(fdIndex);
    if (!fd) {
      throw new VirtualFSError(errno.EBADF, null, null, 'write');
    }
    if (typeof position === 'number' && position < 0) {
      throw new VirtualFSError(errno.EINVAL, null, null, 'write');
    }
    const flags = fd.getFlags();
    if (!(flags & (constants.O_WRONLY | constants.O_RDWR))) {
      throw new VirtualFSError(errno.EBADF, null, null, 'write');
    }
    let buffer;
    if (typeof data === 'string') {
      position = (typeof offsetOrPos === 'number') ? offsetOrPos : null;
      lengthOrEncoding = (typeof lengthOrEncoding === 'string') ? lengthOrEncoding : 'utf8';
      buffer = this._getBuffer(data, lengthOrEncoding);
    } else {
      offsetOrPos = (typeof offsetOrPos === 'number') ? offsetOrPos : 0;
      if (offsetOrPos < 0 || offsetOrPos > data.length) {
        throw new RangeError('Offset is out of bounds');
      }
      lengthOrEncoding = (typeof lengthOrEncoding === 'number') ? lengthOrEncoding : data.length;
      if (lengthOrEncoding < 0 || lengthOrEncoding > data.length) {
        throw new RangeError('Length is out of bounds');
      }
      buffer = this._getBuffer(data).slice(offsetOrPos, offsetOrPos + lengthOrEncoding);
    }
    try {
      return fd.write(buffer, position);
    } catch (e) {
      if (e instanceof RangeError) {
        throw new VirtualFSError(errno.EFBIG, null, null, 'write');
      }
      if (e instanceof VirtualFSError) {
        e.setSyscall('write');
      }
      throw e;
    }
  }

  writeFile (file: file, data: data, ...args: Array<any>): void {
    let cbIndex = args.findIndex((arg) => typeof arg === 'function');
    const callback = args[cbIndex] || callbackUp;
    cbIndex = (cbIndex >= 0) ? cbIndex : args.length;
    this._callAsync(
      this.writeFileSync.bind(this),
      [file, data, ...args.slice(0, cbIndex)],
      callback,
      callback
    );
    return;
  }

  writeFileSync (file: file, data: data = 'undefined', options?: options) {
    options = this._getOptions({
      encoding: 'utf8',
      mode: DEFAULT_FILE_PERM,
      flag: 'w'
    }, options);
    let fdIndex;
    try {
      const buffer = this._getBuffer(data, options.encoding);
      if (typeof file === 'number') {
        this.writeSync(file, buffer, 0, buffer.length, 0);
      } else {
        fdIndex = this.openSync(file, options.flag, options.mode);
        this.writeSync(fdIndex, buffer, 0, buffer.length, 0);
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
  _callAsync (
    syncFn: Function,
    args: Array<any>,
    successCall: Function,
    failCall: Function
  ) {
    nextTick(() => {
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
  _getPath (path: path): string {
    if (typeof path === 'string') {
      return path;
    }
    if (path instanceof Buffer) {
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
  _getPathFromURL (url: {pathname: string}): string {
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
  _getBuffer (data: data, encoding: string|null = null): Buffer {
    if (data instanceof Buffer) {
      return data;
    }
    if (data instanceof Uint8Array) {
      // zero copy implementation
      // also sliced to the view's constraint
      return Buffer.from(data.buffer).slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
    }
    if (typeof data === 'string') {
      return Buffer.from(data, encoding);
    }
    throw new TypeError('data must be Buffer or Uint8Array or string');
  }

  /**
   * Takes a default set of options, and merges them shallowly into the user provided options.
   * Object spread syntax will ignore an undefined or null options object.
   * @private
   */
  _getOptions (defaultOptions: Object, options: ?(Object|string)): Object {
    if (typeof options === 'string') {
      return {...defaultOptions, encoding: options};
    } else {
      return {...defaultOptions, ...options};
    }
  }

  /**
   * Checks the permissions fixng the current uid and gid.
   * If the user is root, they can access anything.
   * @private
   */
  _checkPermissions (access: number, stat: Stat): boolean {
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
  _parsePath (pathS: string): {segment: string, rest: string} {
    const matches: ?Array<string> = pathS.match(/^([\s\S]*?)(?:\/+|$)([\s\S]*)/);
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
  _navigate (
    pathS: string,
    resolveLastLink: boolean = true,
    activeSymlinks: Set<Symlink> = (new Set),
    origPathS: string = pathS
  ): navigated {
    if (!pathS) {
      throw new VirtualFSError(errno.ENOENT, origPathS);
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
        return this._navigateFrom(
          this._root,
          pathS,
          resolveLastLink,
          activeSymlinks,
          [],
          origPathS
        );
      }
    } else {
      return this._navigateFrom(
        this._cwd.getINode(),
        pathS,
        resolveLastLink,
        activeSymlinks,
        this._cwd.getPathStack(),
        origPathS
      );
    }
  }

  /**
   * Navigates the filesystem tree from a given directory.
   * You should not use this directly unless you first call _navigate and pass the remaining path to _navigateFrom.
   * Note that the pathStack is always the full path to the target.
   * @private
   */
  _navigateFrom (
    curdir: Directory,
    pathS: string,
    resolveLastLink: boolean = true,
    activeSymlinks: Set<Symlink> = (new Set),
    pathStack: Array<string> = [],
    origPathS: string = pathS
  ): navigated {
    if (!pathS) {
      throw new VirtualFSError(errno.ENOENT, origPathS);
    }
    if (!this._checkPermissions(constants.X_OK, curdir.getMetadata())) {
      throw new VirtualFSError(errno.EACCES, origPathS);
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
      throw new VirtualFSError(errno.ENOTDIR, origPathS);
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
        throw new VirtualFSError(errno.ELOOP, origPathS);
      } else {
        activeSymlinks.add(target);
      }
      // although symlinks should not have an empty links, it's still handled correctly here
      nextPath = pathPosix.join(target.getLink(), parse.rest);
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
    return this._navigateFrom(
      nextDir,
      nextPath,
      resolveLastLink,
      activeSymlinks,
      pathStack,
      origPathS
    );
  }

}

export default VirtualFS;

export type { path, data, file, options, callback };

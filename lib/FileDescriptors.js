//@flow
/** @module FileDescriptors */

import { Buffer } from 'buffer';
import Counter from 'resource-counter';
import constants from './constants';
import type { INode } from './INodes';
import { File } from './INodes';

/**
 * Class representing a File Descriptor
 */
class FileDescriptor {

  _inode: $Subtype<INode>;
  _flags: number;
  _pos: number;

  /**
   * Creates FileDescriptor
   * Starts the seek position at 0
   */
  constructor (inode: $Subtype<INode>, flags: number) {
    this._inode = inode;
    this._flags = flags;
    this._pos = 0;
  }

  /**
   * Gets an INode.
   */
  getINode (): $Subtype<INode> {
    return this._inode;
  }

  /**
   * Gets the file descriptor flags.
   * Unlike Linux filesystems, this retains creation and status flags.
   */
  getFlags (): number {
    return this._flags;
  }

  /**
   * Sets the file descriptor flags.
   */
  setFlags (flags: number): void {
    this._flags = flags;
    return;
  }

  /**
   * Gets the file descriptor position.
   */
  getPos (): number {
    return this._pos;
  }

  /**
   * Sets the file descriptor position.
   * @throws {TypeError} Will throw if not a File INode
   */
  setPos (pos: number): void {
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
  read (buffer: Buffer, position: number|null = null): number {
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
      bytesRead = data.copy(buffer, 0, currentPosition);
      metadata.atime = new Date;
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
  write (buffer: Buffer, position: number|null = null, extraFlags: number = 0) {
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
        data = Buffer.concat([data, buffer]);
        bytesWritten = buffer.length;
      } else {
        currentPosition = Math.min(data.length, currentPosition);
        const overwrittenLength = data.length - currentPosition;
        const extendedLength = buffer.length - overwrittenLength;
        if (extendedLength > 0) {
          data = Buffer.concat([data, Buffer.allocUnsafe(extendedLength)]);
        }
        bytesWritten = buffer.copy(data, currentPosition);
      }
      iNode.setData(data);
      const now = new Date;
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
  truncate (len: number = 0) {
    const iNode = this._inode;
    switch (true) {
    case iNode instanceof File:
      const data = iNode.getData();
      const metadata = iNode.getMetadata();
      let newData;
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
      const now = new Date;
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

  _counter: Counter;
  _fds: Map<number,FileDescriptor>;

  /**
   * Creates an instance of the FileDescriptorManager.
   * It starts the fd counter at 0.
   * Make sure not get real fd numbers confused with these fd numbers.
   */
  constructor () {
    this._counter = new Counter(0);
    this._fds = new Map;
  }

  /**
   * Creates a file descriptor.
   * While a file descriptor is opened, the underlying iNode can still be garbage collected by the INodeManager, but it won't be garbage collected by JavaScript runtime.
   */
  createFd (inode: $Subtype<INode>, flags: number): { index: number, fd: FileDescriptor } {
    const index = this._counter.allocate();
    const fd = new FileDescriptor(inode, flags);
    this._fds.set(index, fd);
    return { index: index, fd: fd };
  }

  /**
   * Gets the file descriptor object.
   */
  getFd (index: number): ?FileDescriptor {
    return this._fds.get(index);
  }

  /**
   * Deletes a file descriptor.
   * This effectively closes the file descriptor.
   */
  deleteFd (index: number): void {
    this._counter.deallocate(index);
    this._fds.delete(index);
    return;
  }

}

export { FileDescriptor, FileDescriptorManager };

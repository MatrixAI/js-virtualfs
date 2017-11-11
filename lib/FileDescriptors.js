//@flow
/** @module FileDescriptors */

import type { INode, INodeManager } from './INodes.js';

// $FlowFixMe: Buffer exists
import { Buffer } from 'buffer';
import Counter from 'resource-counter';
import constants from './constants.js';
import { File, Directory, CharacterDev } from './INodes.js';
import { VirtualFSError, errno } from './VirtualFSError.js';

/**
 * Class representing a File Descriptor
 */
class FileDescriptor<I: $Subtype<INode>> {

  _iNode: I;
  _flags: number;
  _pos: number;

  /**
   * Creates FileDescriptor
   * Starts the seek position at 0
   */
  constructor (iNode: I, flags: number) {
    this._iNode = iNode;
    this._flags = flags;
    this._pos = 0;
  }

  /**
   * Gets an INode.
   */
  getINode (): I {
    return this._iNode;
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
   */
  setPos (pos: number, flags: number = constants.SEEK_SET): void {
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
        throw new VirtualFSError(errno.EINVAL);
      }
      this._pos = newPos;
      break;
    case iNode instanceof CharacterDev:
      const fops = iNode.getFileDesOps();
      if (!fops) {
        throw new VirtualFSError(errno.ENXIO);
      } else if (!fops.setPos) {
        throw new VirtualFSError(errno.ESPIPE);
      } else {
        fops.setPos(this, pos, flags);
      }
      break;
    default:
      throw new VirtualFSError(errno.ESPIPE);
    }
  }

  /**
   * Reads from this file descriptor into a buffer.
   * It will always try to fill the input buffer.
   * If position is specified, the position change does not persist.
   * If the current file descriptor position is greater than or equal to the length of the data, this will read 0 bytes.
   */
  read (buffer: Buffer, position: number|null = null): number {
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
      bytesRead = data.copy(buffer, 0, currentPosition);
      metadata.atime = new Date;
      break;
    case iNode instanceof CharacterDev:
      const fops = iNode.getFileDesOps();
      if (!fops) {
        throw new VirtualFSError(errno.ENXIO);
      } else if (!fops.read) {
        throw new VirtualFSError(errno.EINVAL);
      } else {
        bytesRead = fops.read(
          this,
          buffer,
          currentPosition
        );
      }
      break;
    default:
      throw new VirtualFSError(errno.EINVAL);
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
  write (buffer: Buffer, position: number|null = null, extraFlags: number = 0) {
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
        data = Buffer.concat([data, buffer]);
        bytesWritten = buffer.length;
      } else {
        if (currentPosition > data.length) {
          data = Buffer.concat([
            data,
            Buffer.alloc(currentPosition - data.length),
            Buffer.allocUnsafe(buffer.length)
          ]);
        } else if (currentPosition <= data.length) {
          const overwrittenLength = data.length - currentPosition;
          const extendedLength = buffer.length - overwrittenLength;
          if (extendedLength > 0) {
            data = Buffer.concat([data, Buffer.allocUnsafe(extendedLength)]);
          }
        }
        bytesWritten = buffer.copy(data, currentPosition);
      }
      iNode.setData(data);
      const now = new Date;
      metadata.mtime = now;
      metadata.ctime = now;
      metadata.size = data.length;
      break;
    case iNode instanceof CharacterDev:
      const fops = iNode.getFileDesOps();
      if (!fops) {
        throw new VirtualFSError(errno.ENXIO);
      } else if (!fops.write) {
        throw new VirtualFSError(errno.EINVAL);
      } else {
        bytesWritten = fops.write(
          this,
          buffer,
          currentPosition,
          extraFlags
        );
      }
      break;
    default:
      throw new VirtualFSError(errno.EINVAL);
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

  _counter: Counter;
  _fds: Map<number, FileDescriptor<*>>;
  _iNodeMgr: INodeManager;

  /**
   * Creates an instance of the FileDescriptorManager.
   * It starts the fd counter at 0.
   * Make sure not get real fd numbers confused with these fd numbers.
   */
  constructor (iNodeMgr: INodeManager) {
    this._counter = new Counter(0);
    this._fds = new Map;
    this._iNodeMgr = iNodeMgr;
  }

  /**
   * Creates a file descriptor.
   * This will increment the reference to the iNode preventing garbage collection by the INodeManager.
   */
  createFd (iNode: $Subtype<INode>, flags: number): [FileDescriptor<*>, number] {
    this._iNodeMgr.refINode(iNode);
    const index = this._counter.allocate();
    const fd = new FileDescriptor(iNode, flags);
    if (iNode instanceof CharacterDev) {
      const fops = iNode.getFileDesOps();
      if (!fops) {
        throw new VirtualFSError(errno.ENXIO);
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
  getFd (index: number): ?FileDescriptor<*> {
    return this._fds.get(index);
  }

  /**
   * Duplicates file descriptor index.
   * It may return a new file descriptor index that points to the same file descriptor.
   */
  dupFd (index: number): ?number {
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
  deleteFd (fdIndex: number): void {
    const fd = this._fds.get(fdIndex);
    if (fd) {
      const iNode = fd.getINode();
      if (iNode instanceof CharacterDev) {
        const fops = iNode.getFileDesOps();
        if (!fops){
          throw new VirtualFSError(errno.ENXIO);
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

export {
  FileDescriptor,
  FileDescriptorManager
};

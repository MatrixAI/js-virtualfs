//@flow
/** @module INodes */

import type { DeviceManager, DeviceInterface } from './Devices.js';

// $FlowFixMe: Buffer exists
import { Buffer } from 'buffer';
import Counter from 'resource-counter';
import constants from './constants.js';
import Stat from './Stat.js';
import { DEFAULT_ROOT_UID, DEFAULT_ROOT_GID } from './permissions.js';
import { unmkDev } from './Devices.js';

/**
 * Class representing an iNode.
 */
class INode {

  _metadata: Object;
  _iNodeMgr: INodeManager;

  /**
   * Creates iNode.
   * INode and INodeManager will recursively call each other.
   */
  constructor (
    metadata: {
      ino: number,
      mode: number,
      uid: number,
      gid: number,
      nlink?: number,
      size: number
    },
    iNodeMgr: INodeManager
  ) {
    const now = new Date;
    this._metadata = new Stat({
      ...metadata,
      mode: metadata.mode,
      nlink: metadata.nlink || 0,
      atime: now,
      mtime: now,
      ctime: now,
      birthtime: now
    });
    this._iNodeMgr = iNodeMgr;
  }

  /**
   * Gets the Stat metadata instance.
   */
  getMetadata (): Stat {
    return this._metadata;
  }

}

/**
 * Class representing a file.
 * @extends INode
 */
class File extends INode {

  _data: Buffer;

  /**
   * Creates a file.
   */
  constructor (
    props: {
      ino: number,
      mode: number,
      uid: number,
      gid: number,
      data?: Buffer
    },
    iNodeMgr: INodeManager
  ) {
    super(
      {
        ino: props.ino,
        uid: props.uid,
        gid: props.gid,
        mode: constants.S_IFREG | (props.mode & (~constants.S_IFMT)),
        size: (props.data) ? props.data.byteLength : 0
      },
      iNodeMgr
    );
    this._data = (props.data) ? props.data : Buffer.allocUnsafe(0);
  }

  /**
   * Gets the file buffer.
   */
  getData (): Buffer {
    return this._data;
  }

  /**
   * Sets the file buffer.
   */
  setData (data: Buffer): void {
    this._data = data;
    return;
  }

  /**
   * Noop.
   */
  destructor (): void {
    return;
  }

}

/**
 * Class representing a directory.
 * @extends INode
 */
class Directory extends INode {

  _dir: Map<string,number>;

  /**
   * Creates a directory.
   * Virtual directories have 0 size.
   * If there's no parent inode, we assume this is the root directory.
   */
  constructor (
    props: {
      ino: number,
      mode: number,
      uid: number,
      gid: number,
      parent?: number
    },
    iNodeMgr: INodeManager
  ) {
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
    super(
      {
        ino: props.ino,
        mode: constants.S_IFDIR | (props.mode & (~constants.S_IFMT)),
        uid: props.uid,
        gid: props.gid,
        nlink: nlink,
        size: 0
      },
      iNodeMgr
    );
    this._dir = new Map([
      ['.', props.ino],
      ['..', props.parent]
    ]);
  }

  /**
   * Gets an iterator of name to iNode index.
   * This prevents giving out mutability.
   */
  getEntries (): Iterator<[string,number]> {
    this._metadata.atime = new Date;
    return this._dir.entries();
  }

  /**
   * Get the inode index for a name.
   */
  getEntryIndex (name: string): ?number {
    return this._dir.get(name);
  }

  /**
   * Get inode for a name.
   */
  getEntry (name: string): $Subtype<INode>|void {
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
  addEntry (name: string, index: number) {
    if (name === '.' || name === '..') {
      throw new Error('Not allowed to add `.` or `..` entries');
    }
    const now = new Date;
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
  deleteEntry (name: string): void {
    if (name === '.' || name === '..') {
      throw new Error('Not allowed to delete `.` or `..` entries');
    }
    const index = this._dir.get(name);
    if (index !== undefined) {
      const now = new Date;
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
  renameEntry (oldName: string, newName: string): void {
    if (oldName === '.' || oldName === '..' || newName === '.' || newName === '..') {
      throw new Error('Not allowed to rename `.` or `..` entries');
    }
    const index = this._dir.get(oldName);
    if (index != null) {
      const now = new Date;
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
  destructor (): void {
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

  _link: string;

  /**
   * Creates a symlink.
   */
  constructor (
    props: {
      ino: number,
      mode: number,
      uid: number,
      gid: number,
      link: string
    },
    iNodeMgr: INodeManager
  ) {
    super(
      {
        ino: props.ino,
        mode: constants.S_IFLNK | (props.mode & (~constants.S_IFMT)),
        uid: props.uid,
        gid: props.gid,
        size: Buffer.from(props.link).byteLength
      },
      iNodeMgr
    );
    this._link = props.link;
  }

  /**
   * Gets the link string.
   */
  getLink (): string {
    return this._link;
  }

  /**
   * Noop.
   */
  destructor (): void {
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
  constructor (
    props: {
      ino: number,
      mode: number,
      uid: number,
      gid: number,
      rdev: number
    },
    iNodeMgr: INodeManager
  ) {
    super(
      {
        ino: props.ino,
        mode: constants.S_IFCHR | (props.mode & (~constants.S_IFMT)),
        uid: props.uid,
        gid: props.gid,
        rdev: props.rdev,
        size: 0
      },
      iNodeMgr
    );
  }

  getFileDesOps (): ?DeviceInterface<CharacterDev> {
    const [major, minor] = unmkDev(this.getMetadata().rdev);
    return this._iNodeMgr._devMgr.getChr(major, minor);
  }

  destructor (): void {
    return;
  }

}

/**
 * Class that manages all iNodes including creation and deletion
 */
class INodeManager {

  _counter: Counter;
  _iNodes: Map<number,INode>;
  _iNodeRefs: WeakMap<INode,number>;
  _devMgr: DeviceManager;

  /**
   * Creates an instance of the INodeManager.
   * It starts the inode counter at 1, as 0 is usually reserved in posix filesystems.
   */
  constructor (devMgr: DeviceManager) {
    this._counter = new Counter(1);
    this._iNodes = new Map;
    this._iNodeRefs = new WeakMap;
    this._devMgr = devMgr;
  }

  /**
   * Creates an inode, from a INode constructor function.
   * The returned inode must be used and later manually deallocated.
   */
  createINode (
    iNodeConstructor: Class<INode>,
    props: Object = {}
  ): [$Subtype<INode>, number] {
    props.ino = this._counter.allocate();
    props.mode = (typeof props.mode === 'number') ? props.mode : 0;
    props.uid = (typeof props.uid === 'number') ? props.uid : DEFAULT_ROOT_UID;
    props.gid = (typeof props.gid === 'number') ? props.gid : DEFAULT_ROOT_GID;
    const iNode = new iNodeConstructor(props, this);
    this._iNodes.set(props.ino, iNode);
    this._iNodeRefs.set(iNode, 0);
    return [iNode, props.ino];
  }

  /**
   * Gets the inode.
   */
  getINode (index: number): $Subtype<INode>|void {
    return this._iNodes.get(index);
  }

  /**
   * Links an inode, this increments the hardlink reference count.
   */
  linkINode (iNode: ?$Subtype<INode>): void {
    if (iNode) {
      ++(iNode.getMetadata().nlink);
    }
    return;
  }

  /**
   * Unlinks an inode, this decrements the hardlink reference count.
   */
  unlinkINode (iNode: ?$Subtype<INode>): void {
    if (iNode) {
      --(iNode.getMetadata().nlink);
      this._gcINode(iNode);
    }
    return;
  }

  /**
   * References an inode, this increments the private reference count.
   * Private reference count can be used by file descriptors and working directory position.
   */
  refINode (iNode: ?$Subtype<INode>): void {
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
  unrefINode (iNode: ?$Subtype<INode>): void {
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
  _gcINode (iNode: $Subtype<INode>): void {
    const metadata = iNode.getMetadata();
    const useCount = metadata.nlink + this._iNodeRefs.get(iNode);
    if (
      useCount === 0 ||
      (useCount === 1 && iNode instanceof Directory)
    ) {
      const index = metadata.ino;
      iNode.destructor();
      this._iNodes.delete(index);
      this._counter.deallocate(index);
    }
  }

}

export { File, Directory, Symlink, CharacterDev, INodeManager };

export type { INode };

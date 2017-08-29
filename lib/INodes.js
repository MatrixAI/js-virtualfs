//@flow
/** @module INodes */

import { Buffer } from 'buffer';
import Counter from 'resource-counter';
import constants from './constants';
import Stat from './Stat';

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
    metadata: {ino: number, mode: number, nlink?: number, size: number},
    iNodeMgr: INodeManager
  ) {
    const now = new Date;
    this._metadata = new Stat({
      ...metadata,
      mode: (metadata.mode     |
             constants.S_IRWXU |
             constants.S_IRWXG |
             constants.S_IRWXO),
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
  constructor (props: {ino: number, data: Buffer}, iNodeMgr: INodeManager) {
    super(
      {
        ino: props.ino,
        mode: constants.S_IFREG,
        size: props.data.byteLength
      },
      iNodeMgr
    );
    this._data = props.data;
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
  constructor (props: {ino: number, parent?: number}, iNodeMgr: INodeManager) {
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
    super(
      {
        ino: props.ino,
        nlink: nlink,
        mode: constants.S_IFDIR,
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
   * Gets all the names.
   */
  getEntries (): Map<*,*> {
    this._metadata.atime = new Date;
    return this._dir;
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
    if (index) {
      return this._iNodeMgr.getINode(index);
    }
    return;
  }

  /**
   * Add a name to inode index to this directory.
   * It will increment the link reference to the inode.
   */
  addEntry (name: string, index: number) {
    const now = new Date;
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
  deleteEntry (name: string): void {
    const index = this._dir.get(name);
    if (index) {
      const now = new Date;
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
  renameEntry (oldName: string, newName: string): void {
    const index = this._dir.get(oldName);
    if (index) {
      const now = new Date;
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
  destructor (): void {
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

  _link: string;

  /**
   * Creates a symlink.
   */
  constructor (props: {ino: number, link: string}, iNodeMgr: INodeManager) {
    super(
      {
        ino: props.ino,
        mode: constants.S_IFLNK,
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
 * Class that manages all iNodes including creation and deletion
 */
class INodeManager {

  _counter: Counter;
  _inodes: Map<number,INode>;

  /**
   * Creates an instance of the INodeManager.
   * It starts the inode counter at 1, as 0 is usually reserved in posix filesystems.
   */
  constructor () {
    this._counter = new Counter(1);
    this._inodes = new Map;
  }

  /**
   * Creates an inode, from a INode constructor function.
   * The returned inode index must be added as an entry into a directory.
   */
  createINode (iNodeConstructor: Class<INode>, props: Object): number {
    props.ino = this._counter.allocate();
    this._inodes.set(props.ino, new iNodeConstructor(props, this));
    return props.ino;
  }

  /**
   * Gets the inode.
   */
  getINode (index: number): File|Directory|Symlink|void {
    return this._inodes.get(index);
  }

  /**
   * Links an inode, this increments the hardlink reference count.
   */
  linkINode (index: number): void {
    const iNode = this._inodes.get(index);
    if (iNode) {
      ++(iNode.getMetadata().nlink);
    }
    return;
  }

  /**
   * Unlinks an inode, this decrements the hardlink reference count.
   * If the hardlink reference count reaches 0, the inode is garbage collected.
   */
  unlinkINode (index: number): void {
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

export type { INode };
export { File, Directory, Symlink, INodeManager };

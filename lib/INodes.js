'use strict';

const Buffer = require('buffer').Buffer;
const constants = require('./constants');
const Stat = require('./Stat');

/** Class representing an iNode */
class INode {

  /**
   * Creates iNode
   * INode and INodeManager will recursively call each other
   * @param {Object} metadata - Metadata that will be passed to Stat constructor
   * @param {INodeManager} iNodeMgr
   */
  constructor (metadata, iNodeMgr) {
    metadata.nlink = metadata.nlink || 0;
		metadata.mode = (metadata.mode     |
                     constants.S_IRWXU |
                     constants.S_IRWXG |
                     constants.S_IRWXO);
    let now = new Date;
    metadata.atime = now;
    metadata.mtime = now;
    metadata.ctime = now;
    metadata.birthtime = now;
    this._metadata = new Stat(metadata);
    this._iNodeMgr = iNodeMgr;
  }

  /**
   * Gets the Stat metadata instance
   * @returns {Stat}
   */
  getMetadata () {
    return this._metadata;
  }

}

/**
 * Class representing a file
 * @extends INode
 */
class File extends INode {

  /**
   * Creates a file
   * @param {{ino: number, data: Buffer}} props - Initial information about the File
   * @param {INodeManager} iNodeMgr
   */
  constructor (props, iNodeMgr) {
    super(
      {
        ino: props.ino,
        mode: constants.S_IFREG,
        size: props.data.byteLength
      },
      iNodeMgr
    );
    this.data = props.data;
  }

  /**
   * Reads the data and updates atime
   * @returns {Buffer}
   */
  read () {
    this._metadata.atime = new Date;
    return this.data;
  }

  /**
   * Writes the data and updates mtime and ctime
   * @param {Buffer} data
   */
  write (data) {
    let now = new Date;
    this._metadata.mtime = now;
    this._metadata.ctime = now;
    this._metadata.size = data.byteLength;
    this.data = data;
    return;
  }

  /**
   * Noop
   */
  destructor () {
    return;
  }

}

/**
 * Class representing a directory
 * @extends INode
 */
class Directory extends INode {

  /**
   * Creates a directory
   * Virtual directories have 0 size
   * @param {Object} props
   * @param {number} props.ino
   * @param {number} [props.parent] - If no parent inode index, the we assume a root directory
   * @param {INodeManager} iNodeMgr
   */
  constructor (props, iNodeMgr) {
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
    this._dir = {
      '.': props.ino,
      '..': props.parent
    };
  }

  /**
   * Get all names to inodes of this directory
   * @returns {Object.<string, number>}
   */
  getEntries () {
    this._metadata.atime = new Date; // this needs testing
    return this._dir;
  }

  /**
   * Get the inode index for a name
   * @param {string} name
   * @returns {number}
   */
  getEntryIndex (name) {
    return this._dir[name];
  }

  /**
   * Get inode for a name
   * @param {string} name
   * @returns {INode}
   */
  getEntry (name) {
    return this._iNodeMgr.getINode(this._dir[name]);
  }

  /**
   * Add a name to inode index to this directory
   * It will increment the link reference to the inode
   * @param {string} name
   * @param {number} index
   */
  addEntry (name, index) {
    let now = new Date;
    this._metadata.mtime = now;
    this._metadata.ctime = now;
    this._iNodeMgr.linkINode(index);
    this._dir[name] = index;
    return;
  }

  /**
   * Delete a name in this directory
   * It will decrement the link reference to the inode
   * @param {string} name
   * @returns {number} iNode index being deleted
   */
  deleteEntry (name) {
    let now = new Date;
    this._metadata.mtime = now;
    this._metadata.ctime = now;
    let index = this._dir[name];
    delete this._dir[name];
    this._iNodeMgr.getINode(index).destructor();
    this._iNodeMgr.unlinkINode(index);
    return index;
  }

  /**
   * Rename a name in this directory
   * @param {string} oldName
   * @param {string} newName
   */
  renameEntry (oldName, newName) {
    let now = new Date;
    this._metadata.mtime = now;
    this._metadata.ctime = now;
    let inodeIndex = this._dir[oldName];
    delete this._dir[oldName];
    this._dir[newName] = inodeIndex;
    return;
  }

  /**
   * This is to be called by the INodeManager all hardlinks to this directory reduce to 0
   */
  destructor () {
    // decrement the parent's nlink due to '..', do not do this on root
    // otherwise there will be an infinite loop
    if (this._dir['.'] !== this._dir['..']) {
      this._iNodeMgr.unlinkINode(this._dir['..']);
    }
    return;
  }

}

/**
 * Class representing a Symlink
 * @extends INode
 */
class Symlink extends INode {

  /**
   * Creates a symlink
   * @param {{ino: number, link: string}} props
   * @param {INodeManager} iNodeMgr
   */
  constructor (props, iNodeMgr) {
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
   * Gets the link string
   * @returns {string}
   */
  getLink () {
    return this._link;
  }

  /**
   * Noop
   */
  destructor () {
    return;
  }

}

/**
 * Class that manages all iNodes including creation and deletion
 */
class INodeManager {

  /**
   * Creates an instance of the INodeManager
   * It starts the inode counter at 1, as 0 is usually reserved in posix filesystems
   */
  constructor () {
    this._counter = 1;
    this._inodes = {};
  }

  /**
   * Creates an inode
   * @param {File|Directory|Symlink} iNodeConstructor
   * @param {Object} props
   * @returns {number} The inode index that has been created, it needs to be added as an entry into a directory
   * @throws {TypeError} Should not be thrown
   */
  createINode (iNodeConstructor, props) {
    props.ino = this._counter;
    switch (iNodeConstructor) {
    case File:
      this._inodes[this._counter] = new iNodeConstructor(props, this);
      break;
    case Directory:
      this._inodes[this._counter] = new iNodeConstructor(props, this);
      break;
    case Symlink:
      this._inodes[this._counter] = new iNodeConstructor(props, this);
      break;
    default:
      throw new TypeError('Non-exhaustive pattern matching');
    }
    return this._counter++; // return returns before post increment
  }

  /**
   * Gets the inode
   * @param {number} index
   * @returns {File|Directory|Symlink}
   */
  getINode (index) {
    return this._inodes[index];
  }

  /**
   * Links an inode, this increments the hardlink reference count
   * @param {number} index
   */
  linkINode (index) {
    ++this._inodes[index]._metadata.nlink;
    return;
  }

  /**
   * Unlinks an inode, this decrements the hardlink reference count
   * If the hardlink reference count reaches 0, the inode is garbage collected
   * @param {number} index
   */
  unlinkINode (index) {
    --this._inodes[index]._metadata.nlink;
    if (this._inodes[index]._metadata.nlink === 0) {
      delete this._inodes[index];
    }
    return;
  }

}

exports.File = File;
exports.Directory = Directory;
exports.Symlink = Symlink;
exports.INodeManager = INodeManager;

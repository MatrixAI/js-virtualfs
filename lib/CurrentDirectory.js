//@flow
/** @module CurrentDirectory */

import type { Directory, INodeManager } from './INodes.js';

class CurrentDirectory {

  _iNode: Directory;
  _curPath: Array<string>;
  _iNodeMgr: INodeManager;

  constructor (
    iNodeMgr: INodeManager,
    iNode: Directory,
    curPath: Array<string> = []
  ) {
    this._iNodeMgr = iNodeMgr;
    this._iNode = iNode;
    this._curPath = curPath;
    iNodeMgr.refINode(iNode);
  }

  changeDir (iNode: Directory, curPath: Array<string>): void {
    this._iNodeMgr.refINode(iNode);
    this._iNodeMgr.unrefINode(this._iNode);
    this._iNode = iNode;
    this._curPath = curPath;
    return;
  }

  getINode (): Directory {
    return this._iNode;
  }

  getPathStack (): Array<string> {
    return [...this._curPath];
  }

  getPath (): string {
    return '/' + this._curPath.join('/');
  }

}

export default CurrentDirectory;

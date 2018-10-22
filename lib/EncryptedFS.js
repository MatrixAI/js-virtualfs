//@flow
/** @module EncryptedFS */

// TODO: offer async varriations of api methods
import {default as fs} from 'fs';
import VirtualFS from './VirtualFS.js';

class EncryptedFS {
	_upperDir : VirtualFS;
	constructor(
		vfs = new VirtualFS 
	) : void {
		this._upperDir = vfs;
	}

	// TODO: need the 'fucntion' keyword?
	// TODO: how to represent list type for flow
	readdir(path: string) {
		fs.readdir(path, (err, files) => {
			if (err) {
				console.log(err);
			} else {
				console.log(files);
			}
		});
	}
}

var efs = new EncryptedFS;
efs.readdir('./');
console.log



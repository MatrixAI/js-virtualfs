//@flow
/** @module EncryptedFS */

import fs from 'fs';
import Cryptor from './Cryptor.js';
import VFS from './VirtualFS.js';
import process from 'process';

// TODO: are callback mandatory?

export default class EncryptedFS {
	// TODO: need to have per file cryptor instance
	_upperDir : Object;
	_lowerDir: Object; 
	_cryptor: Object;
	_ivSize: number;
	_blockSize: number;
	constructor(
		password: string,
		upperDir: Object = new VFS, 
		lowerDir: Object = fs,	// TODO: how create new instance of fs class? 
		ivSize: number = 16,
		blockSize: number = 4096
	) : void {
		this._cryptor = new Cryptor(password);
		this._upperDir = upperDir;
		this._lowerDir = lowerDir;
		this._ivSize = ivSize;
		this._blockSize = blockSize;
	}


	// TODO: flow
	openSync(path: string, flags: string = 'r', mode: number = 0o666): number {
		return fs.openSync(path, flags, mode);	
	} 


	open(...args: Array<any>): void {

		let argSplit = this._separateCallback(args); 
		let callback = argSplit.cb;
		let methodArgs = argSplit.args;

		this._callAsync(
			this.openSync.bind(this),
			methodArgs,
			callback
		);	
		return;
	}


	// ========= HELPER FUNCTIONS =============
	_callAsync(syncFn: Function, args: Array<any>, cb: Function) {
		process.nextTick(() => {
			try {
				let result = syncFn(...args);


				cb(null, result);

			} catch (e) {
				cb(e, null);
			}
		});
	}	

	_separateCallback(args: Array<any>) {
		// it is js convection that the last parameter
		// will be the callback
		
		// pop 'mandatory' callback 
		// TODO: should we be checking that cb is a function?
		let cb = args.pop();

		return {
			cb: cb,
			args: args
		};

	}
}








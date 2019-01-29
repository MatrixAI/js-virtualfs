//@flow
/** @module EncryptedFS */

import fs from 'fs';
import process from 'process';
import Cryptor from './Cryptor.js';
import VFS from './VirtualFS.js';

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
		this._chunkSize = this._blockSize + this._ivSize;
	}

	// other functions can use this method to encrypt whilst marshalling data to block boundaires
	// remains transparent. 
	_encrypt() {

	}

	_decryptSync(fd: number, offset: number, length: number, position: number): Buffer {
	}

	// takes the position in to a file and returns the block number that 'position' lies in 
	 _getBlockNum(position: number) {
		 
		 // we use blockSize as opposed to chuckSize because chunk contains metadata 
		 // transparent to user. When user specifies position it is as if it were plaintext
		 return Math.floor(position/this._blockSize);
	 }

	readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
		// encrypted file will contain incomprehensible data
		// TODO: read chunksize and remove iv before returning
		//

		// 1. find out block number the read offset it at
		// 2. blocknum == chunknum so read entire chunk and get iv
		// 3. decrypt chunk with attaned iv.
		// TODO: maybe actually better to call is a chunk
		const blockNum = this._getBlockNum();
		
		// read entire chunk 'position' belongs to
		let chunkBuf = new Buffer(this._chunkSize);
		const chunkOffset = blockNum * this._chunkSize;
		fs.readSync(fd, chunkBuf, 0, this._chunkSize, chunkOffset);

		// extract iv 
		const iv = chunkBuf.slice(0, this._ivSize);
		const blockBuf = chunkBuf.slice(this._ivSize+1, chunkBuf.length);

		const ptBlock = this._cryptor.decryptSync(blockBuf, iv);

		return ptBlock;
	}
	
	// TODO: does there need to be a async version?
	// reads from disk the chunk containing the block that needs to be merged with new block
	// returns a plaintext buffer containing the merge blocks in a single block
	// fd: file in question, buffer: new 
	_overlaySegment(fd: number, buffer: Buffer, position: number, forward: boolean = true) {
		// readSync(fd, )	
		return;
	}
	writeSync(fd: number, buffer: Buffer, length: number, offset: number, position: number) {
		// case 1 writing a new file
		// case 2 writing to an exisiting file with position  0
		// case 3 writing to a an extising file with that goes beyond the file length
		// case 4 writing to an existing file that does not go beyond the file length

		
		const numChunksToWrite = length / this._blockSize;
		let startBlockAligned = ((position & this._blockSize-1) === 0) 

		// first block:
		// 	case 1: first block is aligned to start of block
		// 	case 2: first block is aligned to start-of-block but end before end-of-block
		// 	case 2: first block is not aligned to start and ends before end-of-block
		// 	case 3: first block is not aligned to start-of-block and ends at end-of-block
		if (!(startBlockAligned)) {
			// this is the amount from 'position' we are going to overlay with block on disk 
			// amount 
			let overlayBufSize = (this._blockSize-1) - (position & this._blockSize-1) 
			// this._blockMerge(fd, buffer.slice(position, position + overlayBufSize))
		}

		// determine we need to merge first block
			
		// need num of blocks we are writing -> length / blocksize
		// If 1 then only need to check alignation for first block
		// other need to check for both first and last block alignation 
		// check if block aligned NOT chunk aligned
		// let blockAlignedStart = ((position & blocksize) === 0) 
		// let blockAlignedEnd = ((position & blocksize) === blocksize) // want to fill entire block withouth going over to next
		// If either of the above two condition do not hold then we have to copy the existing block from disk, merge the two, rencrypt, then repersist


	}


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





/* 
 * Primitive Documentation:
 *
 * Chunks:
 * 	Chunks consist of a an acutal data 'block' with the IV preceding it
 *
 * Block: 
 * 	This is a constant sized amount (optionally user-specified) of business data.
 * 	A large file is split into several block of *block_size* (generall 4k).
 * 	This is to to allow random access reads and writies.
 * 	For example to read a small section of a file, the entire file does not need to be decrpted
 * 	Only the block(s) that contain the section you want to read.
 * 	This does mean however, that there needs to be an IV for each block.
 * 	This is because reusing IVs, or having predictable IVs is a security threat.
 * 	It can lead to the _______ attack. TODO: which attack again?
 *
 * 	Perhaps for large executables, where you need to always read the file in its entirely,
 * 	We can get rid of the block and IVs. But consider if it's really worth it because you're
 * 	only saving kilobytes here.
 * 
 * Segment:
 * 	Some amount of data equal or smaller than a block
 */



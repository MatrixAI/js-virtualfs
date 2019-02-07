//@flow
/** @module EncryptedFS */

import fs from 'fs';
import process from 'process';
import Cryptor from './Cryptor.js';
import VFS from './VirtualFS.js';

// TODO: conform to coding style of vfs - no blank lines, space are method definition
// TODO: are callback mandatory?
/* TODO: we need to maintain seperate permission for the lower directory vs the upper director
 * For example: if you open a file as write-only, how will you merge the block on the ct file?
 * First you need to read, overlay, then write. But we can read, since the file is write-only.
 * So the lower dir file always needs to be read-write, the upper dir file permission will be
 * whatever the user specified. 
 *
 * One way to implement this is through inheriting the FileDeescriptors class.
 * Extend the class by adding another attribute for the 
 */

export default class EncryptedFS {
	// TODO: need to have per file cryptor instance
	_upperDir : Object;
	_lowerDir: Object; 
	_cryptor: Object;
	_ivSize: number;
	_blockSize: number;
	_chunkSize: number;
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

	/* 
	// other functions can use this method to encrypt whilst marshalling data to block boundaires
	// remains transparent. 
	_encrypt() {

	}

	_decryptSync(fd: number, offset: number, length: number, position: number)//: Buffer {
		{ // TODO: remove when fn is complete
	}
	*/

	// takes the position in to a file and returns the block number that 'position' lies in 
	 _offsetToBlockNum(position: number) {
		 
		 // we use blockSize as opposed to chuckSize because chunk contains metadata 
		 // transparent to user. When user specifies position it is as if it were plaintext
		 return Math.floor(position/this._blockSize);
	 }
	 
	// returns the offset/position of the block number in the unencrypted file
	_blockNumToOffset(blockNum: number): number {
		return (blockNum * this._blockSize);	
	}

	_chunkNumToOffset(chunkNum: number): number {
		return (chunkNum * this._chunkSize);
	}

	_offsetToChunkNum(position: number) {
		 return Math.floor(position/this._chunkSize);
	}

	// TODO: validation of the params?
	// TODO: what to do if buffer is less than 4k? truncate?
	// TODO: what happens if length is larger than buffer?
	// So if the file contains a 100 bytes, and you read 4k, then you will read those 100 into 
	// the buffer at the specified offset. But after those 100 bytes, what ever was in the buffer will remain
	readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
		// TODO: actually use offset, length and position
		
		// length is specified for plaintext file, but we will be reading from encrypted file
		// hence the inclusion of 'chunks' in variable name
		const numChunksToRead = Math.ceil(length / this._blockSize);

		// 1. find out block number the read offset it at
		// 2. blocknum == chunknum so read entire chunk and get iv
		// 3. decrypt chunk with attaned iv.
		//
		// TODO: maybe actually better to call is a chunk
		const startChunkNum = this._offsetToBlockNum(position);



		let chunkCtr = 0;
		const plaintextBlocks = [];
		for (const chunkNum=startChunkNum; chunkCtr < numChunksToRead; chunkCtr++) {
			const chunkOffset = this._chunkNumToOffset(chunkNum + chunkCtr);

			let chunkBuf = Buffer.alloc(this._chunkSize);

			fs.readSync(fd, chunkBuf, 0, this._chunkSize, chunkOffset);

			// extract the iv from beginning of chunk
			const iv = chunkBuf.slice(0, this._ivSize);

			// extract remaining data which is the cipher text
			const chunkData = chunkBuf.slice(this._ivSize);

			const ptBlock = this._cryptor.decryptSync(chunkData, iv);

			plaintextBlocks.push(ptBlock);
		}

		const decryptedReadBuffer = Buffer.concat(plaintextBlocks, numChunksToRead * this._blockSize);

		// offset into the decryptedReadBuffer to read from 
		const startBlockOffset = position & (this._blockSize - 1); 

		decryptedReadBuffer.copy(buffer, offset, startBlockOffset, length);
		/*
		
		// TODO: we never use buffer from param
		// read entire chunk 'position' belongs to
		let chunkBuf = Buffer.alloc(this._chunkSize);
		// remember every chunk_i is associated with block_i, for integer i
		// i.e. startChunkNum and chunkNum can be used interchangably 
		const startChunkOffset = startChunkNum * this._chunkSize;
		fs.readSync(fd, chunkBuf, 0, this._chunkSize, startChunkOffset);

		// extract iv 
		const iv = chunkBuf.slice(0, this._ivSize);
		const blockBuf = chunkBuf.slice(this._ivSize, chunkBuf.length);

		const ptBlock = this._cryptor.decryptSync(blockBuf, iv);

		// TODO: is this the most efficient way? Can we make do without the copy?
		ptBlock.copy(buffer, offset, position, length);
		*/

		/* TODO: this is not an accurate measure of bytesRead. 
		 : find out in what cases bytesRead will be less than read
		 : one case is when you read more than the file contains
		 : in this case we may need a special eof marker or some meta
		 : data about the plain text
		 */
		return length;
	}

	// TODO: does there need to be a an async version of this for async api methods?
	_readBlock(fd: number, position: number) {

		// return zero buffer if file has no content
		if (this._posOutOfBounds(fd, position)) {
			return Buffer.alloc(this._blockSize);
		} 

		const blockNum = this._offsetToBlockNum(position);
		const blockOffset = this._blockNumToOffset(blockNum);
		// TODO: optimisation: if we can ensure that readSync will always write blockSize, then we can use allocUnsafe
		const blockBuf = Buffer.alloc(this._blockSize);

		this.readSync(fd, blockBuf, 0, this._blockSize, blockOffset);

		return blockBuf;

	}
	
	// #TODO: optimise to skip read if newData is block size, otherwise always need a read
	// TODO: what happens if file is less than block size?
	// 
	// TODO: does there need to be a async version?
	// reads from disk the chunk containing the block that needs to be merged with new block
	// returns a plaintext buffer containing the merge blocks in a single block
	// fd: file in question, buffer: new 
	_overlaySegment(fd: number, newData: Buffer, position: number) {
		// 	case 1:  segment is aligned to start of block
		// 	case 2:  segment is aligned to start-of-block but end before end-of-block
		// 	case 3:  segment is not aligned to start and ends before end-of-block 
		// 	case 4:  segment is not aligned to start-of-block and ends at end-of-block
		// 	
		// 	Cases 3 and 4 are not possible when overlaying the last segment
		//
		// TODO: throw err if buff lenght  > block size


		const writeOffset = position & (this._blockSize-1); // byte offset from where to start writing new data in the block
		
		// read entire block, position belongs to
		const origBlock = this._readBlock(fd, position);

		// default to empty array if newData is block aligned
		let startSlice = Buffer.alloc(0);

		const blockAligned = ((position & this._blockSize-1) === 0) 
		if (!(blockAligned)) {
			startSlice = origBlock.slice(0, writeOffset);
		}

		// any data reamining after new block
		const endSlice = origBlock.slice(writeOffset + newData.length)

		// patch up slices to create new block
		// TODO: specify length -- maybe also assert the 3 segments do infact amount to only blocksize
		const newBlock = Buffer.concat([startSlice, newData, endSlice]);		


		// TODO: assert that newBlock is === blockSize

		return newBlock;
	}


	_makeBlockIterable(buffer: Buffer) {
		buffer[Symbol.iterator] = () => {
			let iterationCount = 0;
			let currOffset = 0;
			return {
				next: () => {
					let result;
					if (currOffset < buffer.length) {
						result = { 
							// still functions if less than 'blocksize' amount remaining in buffer 
							value: buffer.slice(currOffset, currOffset + this._blockSize),
							done: false 
						}
						currOffset += this._blockSize;
						iterationCount++;
						return result;
					}
					return { value: iterationCount, done: true }
				}
			}
		}
		return buffer;
	}

	_posOutOfBounds(fd: number, position: number) {
		// TODO: confirm that '>=' is correct here
		const _outOfBounds = (position >= fs.fstatSync(fd).size);
		return _outOfBounds;
	}
	_hasContentSync(fd: number): boolean {
		const _hasContent = (fs.fstatSync(fd).size !== 0);
		return _hasContent;
	}
	
	// TODO: actaully use offset.
	writeSync(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
		// TODO: what will happen when we write a new file smaller than block size?
		// case 1 writing a new file
		// case 2 writing to an exisiting file with position  0
		// case 3 writing to a an extising file with that goes beyond the file length
		// case 4 writing to an existing file that does not go beyond the file length

		const boundaryOffset = position & (this._blockSize-1); // how far from a block boundary our write is
		const numBlocksToWrite = Math.ceil((length + boundaryOffset)/ this._blockSize);


		const startBlockNum = this._offsetToBlockNum(position) 
		const endBlockNum = startBlockNum + numBlocksToWrite - 1;
		

		let startBlock;
		let middleBlocks = Buffer.allocUnsafe(0);
		let endBlock = Buffer.allocUnsafe(0);
		//if (this._hasContentSync(fd)) {
			// only the first and last block needs to be overlayed
			// they needs to be process separately first
			const startBlockOverlaySize = this._blockSize - boundaryOffset;
			// TODO: this should not be using the offsets, that pertains to the file, not this buffer.
			const startBlockOverlay = buffer.slice(0, startBlockOverlaySize);
			// TODO: does this need offset to funciton properly?
			startBlock = this._overlaySegment(fd, startBlockOverlay, position);
			// only bother if there is a last chunk
			let endBlockBufferOffset;
			if (numBlocksToWrite >= 2) {
				// where the end block on file, begins in the buffer
				endBlockBufferOffset = startBlockOverlaySize + (numBlocksToWrite-2) * this._blockSize;
				// TODO: length maybe undefined
				const endBlockOverlay = buffer.slice(endBlockBufferOffset)

				const endBlockOffset = this._blockNumToOffset(endBlockNum);
				endBlock = this._overlaySegment(fd, endBlockOverlay, endBlockOffset)
			}
			/*
		} else {
			// there is no content in the file, so we don't overlay
			startBlock = buffer.slice(offset, offset + Math.min(length, this._blockSize));
			// zero pad the block if the entire write buffer does not fill up a block
			// TODO: confirm that concat is safe to zero pad: will it always pad with zeros? 
			// TODO: This, zero pads after the new data, sometimes we'd need to zero pad before the new data.
			if (startBlock.length < this._blockSize) {
				startBlock = Buffer.concat([startBlock], this._blockSize);
			}

			// always a last block when writing at least 2 blocks
			if (numBlocksToWrite >= 2) {
				lastBlock = buffer.slice(endBlockOffset);
			}
			*/
	//	}

		
		// slice out middle blocks if they actually exist
		if (numBlocksToWrite >= 3) {
			// from start of second block to the end of the second last block
			// TODO: plus overlay amount -> startBlockOffset + ovelayamount, 
			middleBlocks = buffer.slice(startBlockOverlaySize , endBlockBufferOffset);
		}


		// TODO: assert newBlocks is a multiple of blocksize 
		const newBlocks = Buffer.concat([startBlock, middleBlocks, endBlock]);
		
		const blockIter = this._makeBlockIterable(newBlocks);

		// TODO: specify resultant buffer size in Buffer.concat for performance throughout source
		const encryptedChunks = []
		for (let block of blockIter) { 
			// gen iv
			const iv = this._cryptor.genRandomIVSync();

			// encrypt block
			// TODO: so process.nextTick() can allow sync fn's to be run async'ly
			// TODO: is this only the top level function or all sync fn's within the toplevel sync fn?
			const ctBlock = this._cryptor.encryptSync(block, iv);
			// convert into chunk
			// TODO: can this be done by reference instead of .concat createing a new buffer?
			const chunk = Buffer.concat([iv, ctBlock], this._chunkSize);
			// add to buffer array
			encryptedChunks.push(chunk)
			// fs.write to disk
		}

		// concat buffer array
		const encryptedWriteBuffer = Buffer.concat(encryptedChunks, numBlocksToWrite * this._chunkSize);

		// position to write to in the file in lower directory
		const lowerWritePos = this._chunkNumToOffset(startBlockNum);
		// TODO: flush? 
		fs.writeSync(fd, encryptedWriteBuffer, 0, encryptedWriteBuffer.length, lowerWritePos);
		let dummy = Buffer.alloc(4112);
		fs.readSync(fd, dummy, 0, dummy.length, lowerWritePos);

	}


	// TODO: actually implement flags
	// TODO: w+ should truncate, r+ should not
	openSync(path: string, flags: string = 'w+', mode: number = 0o666): number {
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



//@flow
/** @module EncryptedFS */

// TODO: offer async varriations of api methods
import {default as fs} from 'fs';
import VirtualFS from './VirtualFS.js';
import Cryptor from './Cryptor.js';

// TODO: key manager class. Each bundle will have a set of keys that are allowed to
// decrypt the bundle
// TODO: make the secret bundle key manager moudle a dependency of cryfs

class EncryptedFS {
	// TODO: need to have per file cryptor instance
	_upperDir : VirtualFS;
	_lowerDir; // TODO: how to make type for fs?
	_cryptor: Cryptor;
	_ivSize: integer;
	_blockSize: integer;
	constructor(
		upperDir = new VirtualFS, 
		lowerDir = fs,	// TODO: how create new instance of fs class? 
		ivSize = 128,
		blockSize=4096
	) : void {
		this._cryptor = new Cryptor();
		this._upperDir = upperDir;
		this._lowerDir = lowerDir;
		this._ivSize = ivSize;
		this._blockSize = blockSize;
	}

	// TODO: need the 'fucntion' keyword?
	// TODO: how to represent list type for flow
	readdir(path: string) {
		fs.readdir(path, (err, files) => {
			if (err) {
			} else {
			}
		});
	}

	// TODO: optional args
	writeFile(filename, data, callback) {
		return new Promise ( (resolve, reject) => {
			this._cryptor.genRandomIV().then( (iv) => {
				// file should start with iv
				console.log('writeFile(): iv generate ' + iv.toString('hex'));
				return this._cryptor.encrypt(data, iv);
			}).then((ct) => {
				// TODO: breaking encapsulation here
				let iv = this._cryptor._iv;
				// concat with encrypted file data
				fs.writeFile(filename, Buffer.concat([iv, ct]), (err) => {
					if (err) 
						reject(err);
					resolve();
				});
			});
		});
	}

	// TODO: impl other params
	open(path) {
		return new Promise((resolve, reject) => {
			fs.open(path, 'r', (err, fd) => {
				if (err) {
					reject(err);
				}
				resolve(fd);
			});
		});
	}


	// TODO: verify default val for length
	async write(fd, buffer, offset=0, length=null, position=0) {
		// TODO: size in bits vs bytes 
		var bytesWritten = 0;

		// chunk is comprised of a block and its iv
		var chunkSize = this._blockSize + this._ivSize;
		console.log('write(): chunkSize: ' + chunkSize);

		var chunkNum = Math.floor(position/chunkSize);	
		var chunkOffset = chunkNum * chunkSize;
		console.log('write(): chunkNum: ' + chunkNum);
		console.log('write(): chunkOffset: ' + chunkOffset);

		// default to size of buffer
		if (!length) 
			length = buffer.length;

		console.log('write(): bufferLength: ' + length);

		// get file size
		var fileSize = fs.fstatSync(fd)['size'];
		console.log('write(): file size is: ' + fileSize);

		var numChunks = Math.ceil(length/this._blockSize);
		var writeBuffer = new Buffer(numChunks*chunkSize);

		// overlay the first chunk
		var firstChunk = await read(fd, writeBuffer, 0, chunkSize, chunkOffset);
		firstChunk.copy(writeBuffer);

		// overlay last chunk if in the middle of file
		if (length > chunkSize && length < fileSize) {
			var lastChunkOffset = Math.floor(length/chunkSize) * chunkSize + chunkOffset;
			var lastChunk = await read(fd, writeBuffer, 0, chunkSize, lastChunkOffset);
			// TODO: check boundary 
			lastChunk.copy(writeBuffer, length-chunkSize)
		}

		// overlay new data and generate a new iv for each block
		var copyOffset;
		var ct;
		for(var i=0; i <= numChunks; i++) {
			// generate a new iv for 
			var iv = await this._cryptor.genRandomIV();
			iv.copy(writeBuffer, i*chunkSize);

			var dataBlkStart = i*chunkSize+this._ivSize;
			var dataBlkEnd = dataBlkStart+this._blkSize;

			// overlay the buffer from params onto buffer to be encrypted/persisted 
			if (i == 0) {
				// special case for first block
				copyOffset = (position%chunkSize);
				buffer.copy(writeBuffer, copyOffset, 0, chunkSize-startOffset);
				copyOffset = chunkSize-startOffset+1;
			} else if (i == numChunks) {
				// slightly less special case for last block
				buffer.copy(writeBuffer, i*chunkSize, copyOffset);
			} else {
				// blocks in between 
				buffer.copy(writeBuffer, i*chunkSize, copyOffset, copyOffset+chunkSize);
				copyOffset += chunkSize + 1;
			}
			// encrypt the blocks
			ct = await this._cryptor.encrypt(writeBuffer.slice(dataBlkStart, dataBlkEnd), iv); 	
			// replace the cipher text with the plaintext
			ct.copy(writeBuffer, dataBlkStart)

			// persist the ciphertext
		}
		// overlay the new data to be written
		fs.write(fd, writeBuffer, 0, chunkSize, chunkOffset);			


			

			while (bytesWritten < length) {
				console.log('write(): bytesWritten: ' + bytesWritten);
				var chunkBuff = new Buffer(chunkSize);
				// get amount to write in curr chunk from buffer
				// i.e. when writing in the middle of a chunk, write less than chunk size
				var chunkWriteSize = Math.min(position - (chunkOffset + bytesWritten), chunkSize);
				console.log('write(): chunkWriteSize: ' + chunkWriteSize);
				var writeOffset = chunkOffset + bytesWritten;
				console.log('write(): writeOffset: ' + writeOffset);

				console.log('write(): iteration of while loop');
				var currChunk = new Promise((resolve, reject) => {
					// we are overwriting an existing chunk
					if (chunkOffset < fileSize) {
						// rewriting entire chunk so read existing block
						read(fd, chunkBuff, 0, chunkSize, 0).then((chunk) => {
							console.log('write(): existing chunk: ' + chunk.toString('utf8'));
							// write new data into chunk
							buffer.copy(chunk, writeOffset, bytesWritten);
							console.log('write(): new plaintext chunk: ' + chunk.toString('utf8'));
							resolve(chunk);
						});
					} else {
						console.log('write(): write offset > than file size, using fresh buffer');
						// writing in a completely new chunk, return the fresh buffer
						resolve(chunkBuff);
					}
				});

				(async () => {
					currChunk = await currChunk;
					console.log('write(): currChunk: ' + currChunk);
				});
				break;

				currChunk.then((chunk) => {
					// generate new iv
					this._cryptor.genRandomIV().then((iv) => {
						console.log('write(): new generated iv: ' + iv.toString('utf8'));
						// encrypt block
						this._cryptor.encrypt(chunk, iv).then((ct) => {
							// concat iv and persist
							var persistableChunk = Buffer.concat([iv, ct]);
							console.log('write(): final chunk to write: ' + persistableChunk.toString('utf8'));
							fs.write(fd, persistableChunk, 0, chunkSize, chunkOffset);			
							// TODO: length is smaller than buffer ?
							bytesWritten += chunkSize
						});	
					});
				});
			}
			
			var blockData = new Buffer(this._blockSize);
			// read from offset
			// decrypt writeblock
			// while data: writeblock
			this._cryptor.encrypt(buffer, iv).then((ct) => {
				// TODO: breaking encapsulation here
				// concat with encrypted file buffer
				fs.writeFile(filename, Buffer.concat([iv, ct]), (err) => {
					if (err) 
						reject(err);
					resolve();
				});
			});
		});
	}

	read(fd, buffer: Buffer, offset, length, position) {
		return new Promise((resolve, reject) => {
			// get iv size in bytes
			var ivSize = this._ivSize / 8;
			var iv = new Buffer(ivSize);
			// TODO: IV per block stuff
			fs.read(fd, iv, 0, ivSize, 0, (err, bytesRead, ivBuf) => {
				if (err)
					reject(err)
				else if (bytesRead < ivSize) 
					reject('Could not read all of initialisation vector');
				console.log('iv from file: ' + ivBuf.toString('hex'));

				// read ciphertext from file
				fs.read(fd, buffer, offset, length, position+ivSize, (err, bytesRead, buffer) => {
					console.log('read()');
					console.log(buffer);
					if (err)
						reject(err);
					this._cryptor.decrypt(buffer, ivBuf).then((plaintext) => {
						resolve(plaintext.slice(0, bytesRead));
					});
				});
			});
		});
	}
}

var efs = new EncryptedFS;
var fd;
efs.readdir('./');
// TODO: find a way to remove init(). Incorp into constrcutor
efs._cryptor.init('password').then( () => {
	return efs.writeFile('testing.txt', 'something very readable')
}).then( () => {
	efs.readdir('./');
	return efs.open('testing.txt');
}).then((fileDes) => {
	fd = fileDes;
	var buf = new Buffer(50);
	return efs.read(fd, buf, 0, 28, 0);
}).then((buf) => {
	console.log('logging final read buffer');
	console.log(buf.toString('utf8'));

	console.log('main(): writing to file');

	var writeBuffer = new Buffer('hello write!');
	(async () => {
		await efs.write(fd, writeBuffer, 0, writeBuffer.length, 5);
		console.log('main(): written to file');
	})
	return;
}).then(() => {
		
	console.log('main(): reading from file');
	return efs.read(fd, buf, 0, 28, 0);
}).then((buf) => {
	console.log('main(): buf from file');
	console.log('main(): ' + buf.toString('hex'));
	console.log('main(): ' + buf.toString('utf'));
});




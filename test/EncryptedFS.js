import EFS from '../lib/EncryptedFS.js';
import test from 'ava';
import crypto from 'crypto';


test('initialisation', t=> {
	let efs = new EFS('very password');

	t.true(efs instanceof EFS);
});


test('open - sync', t => {
	let efs = new EFS('very password');

	let fd = efs.openSync('test/efs_test.txt');
	console.log(typeof fd);
	
	// TODO: are there better tests than this?
	t.true((fd).constructor === Number);
});


test.cb('open - async', t => {
	let efs = new EFS('very password');

	let fd = efs.open('test/efs_test.txt', (err, fd) => {
		t.true(err === null);
		t.true((fd).constructor === Number);
		t.end();
	});
	
});

// TODO: find a way to unit test this method
test('write - sync', t => {
	t.pass();
	let efs = new EFS('very password');

	let fd = efs.openSync('test/test.txt');

	const writeBuf = Buffer("Super confidential information");

	efs.writeSync(fd, writeBuf);
});

// TODO: find a way to unit test this method
test('read - sync', t => {
	t.pass();
	let efs = new EFS('very password');

	let fd = efs.openSync('test/test.txt');

	const dummyBuffer = Buffer.alloc(10);

	const pt = efs.readSync(fd, dummyBuffer, 0, 1, 0);

});


test('write then read - single block', t => {
	let efs = new EFS('very password');

	let fd = efs.openSync('test/test.txt');

	const writeBuffer = Buffer("Super confidential information");

	efs.writeSync(fd, writeBuffer, 0, writeBuffer.length, 0);

	let readBuffer = Buffer.alloc(writeBuffer.length);

	efs.readSync(fd, readBuffer, 0, writeBuffer.length, 0);

	t.deepEqual(writeBuffer, readBuffer);
});

test('write then read - multiple blocks', t => {
	let efs = new EFS('very password');

	let fd = efs.openSync('test/test.txt');

	const blockSize = 4096;

	const writeBuffer = crypto.randomBytes(blockSize * 3);

	efs.writeSync(fd, writeBuffer, 0, writeBuffer.length, 0);

	let readBuffer = Buffer.alloc(writeBuffer.length);

	efs.readSync(fd, readBuffer, 0, writeBuffer.length, 0);

	t.deepEqual(writeBuffer, readBuffer);
});



// TODO: this should really be split out into tests only concerning writes and tests only concerning reads
/* the start and end blocks are handled differently to the middle blocks
 * hence they all need their own tests to verify functionality */
test('write non-zero position - middle of start block', t => {
	let efs = new EFS('very password');

	const blockSize = 4096;


	// write a three block file
	const writePos = 2000;
	const writeBuffer = crypto.randomBytes(blockSize * 3);
	const fd = efs.openSync('test/test_middle.txt');
	efs.writeSync(fd, writeBuffer, 0, writeBuffer.length, 0);

	// write data in the middle
	const middleData = Buffer('Malcom in the');	
	efs.writeSync(fd, middleData, 0, middleData.length, writePos);

	// re-read the blocks
	let readBuffer = Buffer.alloc(blockSize * 3);
	efs.readSync(fd, readBuffer, 0, readBuffer.length, 0);

	middleData.copy(writeBuffer, writePos);
	const expected = writeBuffer;


	t.true(readBuffer.equals(writeBuffer));
	//t.deepEqual(expected.slice(0, blockSize), readBuffer.slice(0, blockSize));
});

test('write non-zero position - middle of middle block', t => {
	let efs = new EFS('very password');

	const blockSize = 4096;


	// write a three block file
	const writePos = blockSize + 2000;
	const writeBuffer = crypto.randomBytes(blockSize * 3);
	const fd = efs.openSync('test/test_middle.txt');
	efs.writeSync(fd, writeBuffer, 0, writeBuffer.length, 0);

	// write data in the middle
	const middleData = Buffer('Malcom in the');	
	efs.writeSync(fd, middleData, 0, middleData.length, writePos);

	// re-read the blocks
	let readBuffer = Buffer.alloc(blockSize * 3);
	efs.readSync(fd, readBuffer, 0, readBuffer.length, 0);

	middleData.copy(writeBuffer, writePos);
	const expected = writeBuffer;


	t.true(readBuffer.equals(writeBuffer));
	//t.deepEqual(expected.slice(0, blockSize), readBuffer.slice(0, blockSize));
});

test('write non-zero position - middle of end block', t => {
	let efs = new EFS('very password');

	const blockSize = 4096;


	// write a three block file
	const writePos = 2 * blockSize + 2000;
	const writeBuffer = crypto.randomBytes(blockSize * 3);
	const fd = efs.openSync('test/test_middle.txt');
	efs.writeSync(fd, writeBuffer, 0, writeBuffer.length, 0);

	// write data in the middle
	const middleData = Buffer('Malcom in the');	
	efs.writeSync(fd, middleData, 0, middleData.length, writePos);

	// re-read the blocks
	let readBuffer = Buffer.alloc(blockSize * 3);
	efs.readSync(fd, readBuffer, 0, readBuffer.length, 0);

	middleData.copy(writeBuffer, writePos);
	const expected = writeBuffer;


	t.true(readBuffer.equals(writeBuffer));
	//t.deepEqual(expected.slice(0, blockSize), readBuffer.slice(0, blockSize));
});

test('write segment spanning across two block', t => {
	let efs = new EFS('very password');

	const blockSize = 4096;

	// write a three block file
	const writePos = 4090;
	const writeBuffer = crypto.randomBytes(blockSize * 3);
	const fd = efs.openSync('test/test_middle.txt');
	efs.writeSync(fd, writeBuffer, 0, writeBuffer.length, 0);

	// write data in the middle
	const middleData = Buffer('Malcom in the');	
	efs.writeSync(fd, middleData, 0, middleData.length, writePos);

	// re-read the blocks
	let readBuffer = Buffer.alloc(blockSize * 3);
	efs.readSync(fd, readBuffer, 0, readBuffer.length, 0);

	middleData.copy(writeBuffer, writePos);
	const expected = writeBuffer;


	t.true(readBuffer.equals(writeBuffer));
});


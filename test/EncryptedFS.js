import EFS from '../lib/EncryptedFS.js';
import test from 'ava';


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

	console.log('write: ');
	console.log(writeBuf);

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


test('write then read', t => {
	let efs = new EFS('very password');

	let fd = efs.openSync('test/test.txt');

	const writeBuffer = Buffer("Super confidential information");

	efs.writeSync(fd, writeBuffer, 0, writeBuffer.length, 0);

	let readBuffer = Buffer.alloc(4096);

	efs.readSync(fd, readBuffer, 0, writeBuffer.length, 0);

	t.deepEqual(writeBuffer, readBuffer.slice(0, writeBuffer.length));
});

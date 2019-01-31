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

test.serial('write - sync', t => {
	let efs = new EFS('very password');

	let fd = efs.openSync('test/test.txt');

	const writeBuf = Buffer("Super confidential information");

	console.log('write: ')
	console.log(writeBuf);

	efs.writeSync(fd, writeBuf)
	t.pass();
});

test.serial('read - sync', t => {
	let efs = new EFS('very password');

	let fd = efs.openSync('test/test.txt');

	const dummyBuffer = Buffer.alloc(0);

	const pt = efs.readSync(fd, 'test/test.txt', dummyBuffer, 0, 1, 0);

	console.log('read: ')
	console.log(pt);

	t.pass();


});

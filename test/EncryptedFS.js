import EFS from '../lib/EncryptedFS.js';
import test from 'ava';


test('initialisation', t=> {
	let efs = new EFS('very password');

	t.true(efs instanceof EFS);
});


test('open - sync', t => {
	let efs = new EFS('very password');

	let fd = efs.openSync('test/EncryptedFS.js');
	console.log(typeof fd);
	
	// TODO: are there better tests than this?
	t.true((fd).constructor === Number);
});


test.cb('open - async', t => {
	let efs = new EFS('very password');

	let fd = efs.open('test/EncryptedFS.js', (err, fd) => {
		t.true(err === null);
		t.true((fd).constructor === Number);
		t.end();
	});
	
});

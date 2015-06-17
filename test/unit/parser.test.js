var chai = require('chai');
var assert = chai.assert;
var stream = require('stream');
var fs = require('fs');
var path = require('path');

var Parser = require('../../lib/Parser');


describe('Parser', function() {

  it.skip('can determine the bytes per element', function() {

  });

  it('can parse a stream', function(done) {

    // http://stackoverflow.com/questions/12755997/how-to-create-streams-from-string-in-node-js
    var s = new stream.Readable();
    s._read = function noop() {}; 

    var p = new Parser(s);
    var elements = [];
    p.parse(s);
    p.on('element', function(element) {
      elements.push(element);
    });

    // Chop up chunks to simulate data not necessarily
    // arriving in lines
    var chunks = [
      'pl', 'y\nformat ascii 1.0\n',
      'commen', 't made by anonymous\n', 
      'comment this file is a cube\n', 
      'element vertex 8\n', 
      'prope', 'rty float32 x\n', 
      'property float32 y\n', 
      'property float32 z\n', 
      'element face 6\n', 
      'property list uint8 int32 vertex_index\n', 
      'end_header\n', 
      '0 0 0\n', 
      '0 0 1\n', 
      '0 1 1\n', 
      '0 1 0\n', 
      '1 0 0\n', 
      '1 ', '0 1\n', 
      '1 1 1\n', 
      '1 1 0\n', 
      '4 ', '0 1 2 3\n', 
      '4 7 6 5 4\n', 
      '4 0 4 5 1\n', 
      '4 1 5 6 2\n', 
      '4 2 6 7 3\n', 
    ];
    chunks.forEach(function(chunk) {
      s.push(chunk);
    });
    s.push(null);

    p.on('done', function() {
      assert.deepEqual(elements, [
        { name: 'vertex', x: 0, y: 0, z: 0 },
        { name: 'vertex', x: 0, y: 0, z: 1 },
        { name: 'vertex', x: 0, y: 1, z: 1 },
        { name: 'vertex', x: 0, y: 1, z: 0 },
        { name: 'vertex', x: 1, y: 0, z: 0 },
        { name: 'vertex', x: 1, y: 0, z: 1 },
        { name: 'vertex', x: 1, y: 1, z: 1 },
        { name: 'vertex', x: 1, y: 1, z: 0 },
        { name: 'face', values: [ 0, 1, 2, 3 ] },
        { name: 'face', values: [ 7, 6, 5, 4 ] },
        { name: 'face', values: [ 0, 4, 5, 1 ] },
        { name: 'face', values: [ 1, 5, 6, 2 ] },
        { name: 'face', values: [ 2, 6, 7, 3 ] },
      ]);
      done();
    });

  });

  it('can parse cube ascii', function(done) {

    var p = new Parser();
    var elements = [];
    p.on('element', function(element) {
      elements.push(element);
    });
    
    var s = fs.createReadStream(
      path.join(__dirname, '..', 'resources', 'cube_ascii.ply'));
    p.parse(s);

    p.on('done', function() {
      assert.deepEqual(elements, [
        { name: 'vertex', x: 0, y: 0, z: 0 },
        { name: 'vertex', x: 0, y: 0, z: 1 },
        { name: 'vertex', x: 0, y: 1, z: 1 },
        { name: 'vertex', x: 0, y: 1, z: 0 },
        { name: 'vertex', x: 1, y: 0, z: 0 },
        { name: 'vertex', x: 1, y: 0, z: 1 },
        { name: 'vertex', x: 1, y: 1, z: 1 },
        { name: 'vertex', x: 1, y: 1, z: 0 },
        { name: 'face', values: [ 0, 1, 2, 3 ] },
        { name: 'face', values: [ 7, 6, 5, 4 ] },
        { name: 'face', values: [ 0, 4, 5, 1 ] },
        { name: 'face', values: [ 1, 5, 6, 2 ] },
        { name: 'face', values: [ 2, 6, 7, 3 ] },
      ]);
      done();
    });

  });

  it.only('can parse cube_binary_little_endian', function(done) {

    var p = new Parser();
    var elements = [];
    p.on('element', function(element) {
      elements.push(element);
    });
    
    var s = fs.createReadStream(
      path.join(__dirname, '..', 'resources', 'cube_binary_little_endian.ply'));
    p.parse(s);

    p.on('done', function() {
      // assert.deepEqual(elements, [
      //   { name: 'vertex', x: 0, y: 0, z: 0 },
      //   { name: 'vertex', x: 0, y: 0, z: 1 },
      //   { name: 'vertex', x: 0, y: 1, z: 1 },
      //   { name: 'vertex', x: 0, y: 1, z: 0 },
      //   { name: 'vertex', x: 1, y: 0, z: 0 },
      //   { name: 'vertex', x: 1, y: 0, z: 1 },
      //   { name: 'vertex', x: 1, y: 1, z: 1 },
      //   { name: 'vertex', x: 1, y: 1, z: 0 },
      //   { name: 'face', values: [ 0, 1, 2, 3 ] },
      //   { name: 'face', values: [ 7, 6, 5, 4 ] },
      //   { name: 'face', values: [ 0, 4, 5, 1 ] },
      //   { name: 'face', values: [ 1, 5, 6, 2 ] },
      //   { name: 'face', values: [ 2, 6, 7, 3 ] },
      // ]);
      done();
    });

  });

});
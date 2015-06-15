// var chai = require('chai');
// var assert = chai.assert;
var stream = require('stream');
var fs = require('fs');
var path = require('path');

var Parser = require('../../lib/Parser');


describe('Parser', function() {

  it.only('can parse a stream', function() {

    // http://stackoverflow.com/questions/12755997/how-to-create-streams-from-string-in-node-js
    var s = new stream.Readable();
    s._read = function noop() {}; 

    new Parser(s);


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
      '1 0 1\n', 
      '1 1 1\n', 
      '1 1 0\n', 
      '4 0 1 2 3\n', 
      '4 7 6 5 4\n', 
      '4 0 4 5 1\n', 
      '4 1 5 6 2\n', 
      '4 2 6 7 3\n', 
    ];
    chunks.forEach(function(chunk) {
      s.push(chunk);
    });
    s.push(null);


  });

  it('can parse cube_binary_little_endian', function() {
    new Parser(fs.createReadStream(path.join(__dirname, '..', 'resources', 'cube_ascii.ply')));
  });

});
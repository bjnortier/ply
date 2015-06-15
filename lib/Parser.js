'use strict';

// var through = require('through');

var PARSER_STATE = {
  BEGIN: 0,
  FORMAT: 1,
  HEADER: 2,
  BODY: 4,
  DONE: 5,
  ERROR: -1
};

var PLY_FORMAT = {
  ASCII: 0,
  BINARY_LITTLE_ENDIAN: 1,
  BINARY_BIG_ENDIAN: 2,
  UNKNOWN: -1
};

// var PLY_TYPES = {
//   INT: 0,
//   FLOAT: 1,
//   LIST: 2,
//   LIST_INT: 2,
//   LIST_FLOAT: 3
// };





function Parser(stream) {

  var buffer = new Buffer(8192);
  var start = 0;
  var end = 0;


  var state = PARSER_STATE.BEGIN;
  var format;
  var comments = [];
  var elementDefinitions = [];

  var currentElementDef;

  function readLine() {
    for (var i = start; i < end; ++i) {
      // If there are enough bytes in the buffer,
      // read until a line break
      if (buffer[i] === 10) {
        var len = i - start + 1; // number of bytes to consume
        var line = buffer.toString('ascii', start, start + len - 1);        
        start += len; 
        return line;
      }
    }
    return null;
  }

  function readNext() {
    var line;
    var tokens;
    switch (state) {
      case PARSER_STATE.BEGIN:
        if (line = readLine()) {
          if (line !== 'ply') {
            throw new Error('"ply" expected');
          }
          state = PARSER_STATE.FORMAT;
        }
        break;
      case PARSER_STATE.FORMAT:
        if (line = readLine()) {
          if (line === 'format ascii 1.0') {
            format = PLY_FORMAT.ASCII;
          } else if (line === 'format binary_little_endian 1.0') {
            format = PLY_FORMAT.BINARY_LITTLE_ENDIAN;
          } else if (line === 'format binary_big_endian 1.0') {
            format = PLY_FORMAT.BINARY_BIG_ENDIAN;
          } else {
            throw new Error('invalid format: "' + line + '"');
          }
          state = PARSER_STATE.HEADER;
        }
        break;
      case PARSER_STATE.HEADER:
        if (line = readLine()) {
          console.log('hdr>', line);
          if (line.indexOf('comment') === 0) {
            comments.push(line);
          } else if (line.indexOf('element') === 0) {
            currentElementDef = {};
            tokens = line.split(' ');
            if (tokens.length !== 3) {
              throw new Error('invalid element line: "' + line + '"');
            }
            currentElementDef.type = tokens[1];
            currentElementDef.count = parseInt(tokens[2]);
            currentElementDef.properties = [];
            elementDefinitions.push(currentElementDef);
          } else if (line.indexOf('property list') === 0) {
            tokens = line.split(' ');
            currentElementDef.properties.push({
              type: 'vector',
              lengthType: tokens[2],
              valueType: tokens[3],
              name: tokens[4],
            });
          } else if (line.indexOf('property') === 0) {
            tokens = line.split(' ');
            currentElementDef.properties.push({
              type: 'scalar',
              valueType: tokens[1],
              name: tokens[2],
            });
          } else if (line === 'end_header') {
            state = PARSER_STATE.BODY;
          } else {
            throw new Error('invalid header line: "' + line + '"');
          }
        }
        break;
      default: 

    }
  }

  stream.on('data', function(data) {
    // Write the new data to the end of the main buffer
    var toAppend = new Buffer(data);
    toAppend.copy(buffer, end);
    end = end + toAppend.length;

    readNext();
  });

  stream.on('end', function() {
    console.log('!!END!!');
    console.log('format', format);
    console.log('elementDefinitions', JSON.stringify(elementDefinitions, undefined, 2));
  });
}

module.exports = Parser;
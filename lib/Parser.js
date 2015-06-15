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

var PLY_TYPES = {
  INT: 0,
  FLOAT: 1,
  LIST: 2,
  LIST_INT: 2,
  LIST_FLOAT: 3
};

var PLY_TYPENAMES = {
  "char":     [ PLY_TYPES.INT, 1, Int8Array ],
  "int8":     [ PLY_TYPES.INT, 1, Int8Array ],
  "uchar":    [ PLY_TYPES.INT, 1, Uint8Array ],
  "uint8":    [ PLY_TYPES.INT, 1, Uint8Array ],
  "short":    [ PLY_TYPES.INT, 2, Int16Array ],
  "int16":    [ PLY_TYPES.INT, 2, Int16Array ],
  "ushort":   [ PLY_TYPES.INT, 2, Uint16Array ],
  "uint16":   [ PLY_TYPES.INT, 2, Uint16Array ],
  "int":      [ PLY_TYPES.INT, 4, Int32Array ],
  "int32":    [ PLY_TYPES.INT, 4, Int32Array ],
  "uint":     [ PLY_TYPES.INT, 4, Uint32Array ],
  "uint32":   [ PLY_TYPES.INT, 4, Uint32Array ],
  "float":    [ PLY_TYPES.FLOAT, 4, Float32Array ],
  "float32":  [ PLY_TYPES.FLOAT, 4, Float32Array ],
  "double":   [ PLY_TYPES.FLOAT, 8, Float64Array ],
  "float64":  [ PLY_TYPES.FLOAT, 8, Float64Array ]
};

function parseToken(string, valueType) {
  if (PLY_TYPENAMES[valueType][0] === PLY_TYPES.INT) {
    return parseInt(string, 10);
  } else if (PLY_TYPENAMES[valueType][0] === PLY_TYPES.FLOAT) {
    return parseFloat(string, 10);
  } else {
    throw new Error('invalid value type: "' + valueType + '"');
  }
}

function Parser(stream) {

  var buffer = new Buffer(8192);
  var start = 0;
  var end = 0;


  var state = PARSER_STATE.BEGIN;
  var format;
  var comments = [];
  var elementDefinitions = [];
  var currentElementDef;
  var remainingElements;

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
            currentElementDef.name = tokens[1];
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
            remainingElements = elementDefinitions.map(function(def) {
              return {
                name: def.name,
                count: def.count,
                properties: def.properties,
              };
            });
          } else {
            throw new Error('invalid header line: "' + line + '"');
          }
        }
        break;
      case PARSER_STATE.BODY:
        if (line = readLine()) {
          if (remainingElements.length === 0) {
            throw new Error('no more element remaining but more data exists');
          }
          var properties = remainingElements[0].properties;
          // console.log('>>>', JSON.stringify(properties, null, 2));

          // Peek at the first property to check if it's a list
          var element;
          var propertyDef;
          if (properties[0].type === 'scalar') {
            element = line.split(' ').reduce(function(acc, token, i) {
              propertyDef = properties[i];
              acc[propertyDef.name] = parseToken(token, propertyDef.valueType);
              return acc;
            }, {name: remainingElements[0].name});
          } else {
            if (properties.length > 1) {
              throw new Error('only elements with a single property list is supported');
            }
            propertyDef = properties[0];
            tokens = line.split(' ');
            if (parseInt(tokens[0]) !== (tokens.length - 1)) {
              throw new Error('invalid property list line: "' + line + '"');
            }
            element = {
              name: remainingElements[0].name,
              values: tokens.slice(1).map(function(token) {
                return parseToken(token, propertyDef.valueType);
              }),
            };
          }
 
          remainingElements[0].count -= 1;
          if (remainingElements[0].count === 0) {
            remainingElements = remainingElements.slice(1);
          }
          console.log('!emit element', element);
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
  });
}

module.exports = Parser;
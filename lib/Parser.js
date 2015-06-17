'use strict';

var ee = require('event-emitter');

var PLY_TYPENAMES = {
  "char":     [ parseInt,   1, 'getInt8'    ],
  "int8":     [ parseInt,   1, 'getInt8'    ],
  "uchar":    [ parseInt,   1, 'getUint8'   ],
  "uint8":    [ parseInt,   1, 'getUint8'   ],
  "short":    [ parseInt,   2, 'getInt16'   ],
  "int16":    [ parseInt,   2, 'getInt16'   ],
  "ushort":   [ parseInt,   2, 'getUint16'  ],
  "uint16":   [ parseInt,   2, 'getUint16'  ],
  "int":      [ parseInt,   4, 'getInt32'   ],
  "int32":    [ parseInt,   4, 'getInt32'   ],
  "uint":     [ parseInt,   4, 'getUint32'  ],
  "uint32":   [ parseInt,   4, 'getUint32'  ],
  "float":    [ parseFloat, 4, 'getFloat32' ],
  "float32":  [ parseFloat, 4, 'getFloat32' ],
  "double":   [ parseFloat, 8, 'getFloat64' ],
  "float64":  [ parseFloat, 8, 'getFloat64' ]
};

function parseToken(string, valueType) {
  return PLY_TYPENAMES[valueType][0](string, 10);
}

function toArrayBuffer(buffer, size) {
  var ab = new ArrayBuffer(size);
  var view = new Uint8Array(ab);
  for (var i = 0; i < size; ++i) {
    view[i] = buffer[i];
  }
  return ab;
}

function readValueFromBuffer(buffer, valueType, littleEndian) {
  var size = PLY_TYPENAMES[valueType][1];
  var ab = toArrayBuffer(buffer, size);
  var dv = new DataView(ab, 0, PLY_TYPENAMES[valueType][1]);
  return dv[PLY_TYPENAMES[valueType][2]](0, littleEndian);
}

function readArrayFromBuffer(buffer, valueType, length, littleEndian) {
  var size = PLY_TYPENAMES[valueType][1];
  var ab = toArrayBuffer(buffer, size*length);
  var list = [];
  for (var i = 0; i < length; ++i) {
    var dv = new DataView(ab, i*PLY_TYPENAMES[valueType][1], PLY_TYPENAMES[valueType][1]);
    list.push(dv[PLY_TYPENAMES[valueType][2]](0, littleEndian));
  }
  return list;
}

// @class ReadBuffer
//
// A buffer with some convenience methods, and manages
// a start position

function ReadBuffer() {

  var buffer;

  this.append = function(data) {
    var toAppend = new Buffer(data);
    if (buffer) {
      buffer = Buffer.concat([buffer, toAppend]);
    } else {
      buffer = toAppend;
    }
  };

  // If there are enough bytes in the buffer,
  // consume until a line break
  this.consumeLine = function() {
    for (var i = 0; i < buffer.length; ++i) {
      if (buffer[i] === 10) {
        var len = i + 1; // number of bytes to consume
        var line = buffer.toString('ascii', 0, len - 1);        
        buffer = buffer.slice(len);
        return line;
      }
    }
    return null;
  };

  this.consumeBinaryValue = function(valueType) {
    var available = buffer.length;
    var len = PLY_TYPENAMES[valueType][1];
    if (len <= available) {
      var value = readValueFromBuffer(buffer, valueType, this.littleEndian);
      buffer = buffer.slice(len);
      return value;
    } else {
      return null;
    }
  };

  this.consumeBinaryList = function(lengthType, valueType) {
    var available = buffer.length;

    var lengthTypeSize = PLY_TYPENAMES[lengthType][1];
    var valueTypeSize = PLY_TYPENAMES[valueType][1];

    if (lengthTypeSize <= available) {
      var listLength = readValueFromBuffer(buffer, lengthType, this.littleEndian);
      if (lengthTypeSize + listLength*valueTypeSize <= available) {
        buffer = buffer.slice(lengthTypeSize);
        var list = readArrayFromBuffer(
          buffer, valueType, listLength, this.littleEndian);
        buffer = buffer.slice(listLength*valueTypeSize);
        return list;
      } else {
        return null;
      }
    } else {
      return null;
    }
  };

  this.hasBytes = function() {
    return (!!buffer.length);
  };

}

function Parser() {
  ee(this);
  var _this = this;

  var state = 'begin';
  var format;
  var comments = [];
  var elementDefinitions = [];
  var currentElementDef;
  var remainingElements;
  var remainingPropertyDefs;
  var element;

  function readNext(buffer) {
    var line;
    var tokens;
    switch (state) {
      case 'begin':
        if (line = buffer.consumeLine()) {
          if (line !== 'ply') {
            throw new Error('"ply" expected');
          }
          state = 'format';
          return true;
        } else {
          return false;
        }
        break;
      case 'format':
        if (line = buffer.consumeLine()) {
          if (line === 'format ascii 1.0') {
            format = 'ascii';
          } else if (line === 'format binary_little_endian 1.0') {
            buffer.littleEndian = true;
            format = 'little_endian';
          } else if (line === 'format binary_big_endian 1.0') {
            buffer.littleEndian = false;
            format = 'big_endian';
          } else {
            throw new Error('invalid format: "' + line + '"');
          }
          state = 'header';
          return true;
        } else {
          return false;
        }
        break;
      case 'header':
        if (line = buffer.consumeLine()) {
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
            currentElementDef.propertyDefs = [];
            elementDefinitions.push(currentElementDef);
          } else if (line.indexOf('property list') === 0) {
            tokens = line.split(' ');
            currentElementDef.propertyDefs.push({
              type: 'vector',
              lengthType: tokens[2],
              valueType: tokens[3],
              name: tokens[4],
            });
          } else if (line.indexOf('property') === 0) {
            tokens = line.split(' ');
            currentElementDef.propertyDefs.push({
              type: 'scalar',
              valueType: tokens[1],
              name: tokens[2],
            });
          } else if (line === 'end_header') {
            state = 'body';
            remainingElements = elementDefinitions.map(function(def) {
              return {
                name: def.name,
                count: def.count,
                propertyDefs: def.propertyDefs,
              };
            });
            element = {
              name: remainingElements[0].name,
            };
            remainingPropertyDefs = remainingElements[0].propertyDefs;
          } else {
            throw new Error('invalid header line: "' + line + '"');
          }
          return true;
        } else {
          return false;
        }
        break;
      case 'body':
        if (format === 'ascii') {
          if (remainingElements.length === 0) {
            throw new Error('no more element remaining but more data exists');
          }
          var propertyDefs = remainingElements[0].propertyDefs;

          if (line = buffer.consumeLine()) {
            element = {};

            // Peek at the first property to check if it's a list
            var propertyDef;
            if (propertyDefs[0].type === 'scalar') {
              // All the properties of the element are on a single line
              element = line.split(' ').reduce(function(acc, token, i) {
                propertyDef = propertyDefs[i];
                acc[propertyDef.name] = parseToken(token, propertyDef.valueType);
                return acc;
              }, {name: remainingElements[0].name});
            } else {
              if (propertyDefs.length > 1) {
                throw new Error('only elements with a single property list is supported');
              }
              propertyDef = propertyDefs[0];
              tokens = line.split(' ');
              if (parseInt(tokens[0]) !== (tokens.length - 1)) {
                throw new Error('invalid property list line: "' + line + '"');
              }
              element = {
                name: remainingElements[0].name,
              };
              element[propertyDef.name] = tokens.slice(1).map(function(token) {
                return parseToken(token, propertyDef.valueType);
              });
            }

            _this.emit('element', element);
   
            remainingElements[0].count -= 1;
            if (remainingElements[0].count === 0) {
              remainingElements = remainingElements.slice(1);
              if (remainingElements.length) {
                element = {
                  name: remainingElements[0].name,
                };
              }
            }
            return true;
          } else {
            return false;
          }
        } else if ((format === 'little_endian') || (format === 'big_endian')) {
          if (remainingElements.length === 0) {
            throw new Error('no more element remaining but more data exists');
          }
          
          var remainingPropertyDef = remainingPropertyDefs[0];
          var value;
          if (remainingPropertyDef.type === 'scalar') {
            value = buffer.consumeBinaryValue(remainingPropertyDef.valueType);
          } else {
            value = buffer.consumeBinaryList(
                remainingPropertyDef.lengthType, 
                remainingPropertyDef.valueType);
          }
          if (value !== null) {
            element[remainingPropertyDef.name] = value;
            remainingPropertyDefs = remainingPropertyDefs.slice(1);
            
            // All properties have been read
            if (!remainingPropertyDefs.length) {
              
              _this.emit('element', element);

              remainingElements[0].count -= 1;
              if (remainingElements[0].count === 0) {
                remainingElements = remainingElements.slice(1);
              } 
              if (remainingElements.length) {
                remainingPropertyDefs = remainingElements[0].propertyDefs;
                element = {
                  name: remainingElements[0].name,
                };
              }
            }
            return true;
          } else {
            return false;
          }

        }
        break;
      default: 
        throw new Error('invalid parser state');
    }
  }

  this.parse = function(stream) {
    var buffer = new ReadBuffer();
    stream.on('data', function(data) {
      buffer.append(data);
      var success;
      do {
        success = readNext(buffer);
      } while(success && buffer.hasBytes());
    });

    stream.on('end', function() {
      _this.emit('done');
    });
  };

}

module.exports = Parser;
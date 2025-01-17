'use strict';
var osmtogeojson = require('osmtogeojson'),
    querystring = require('querystring'),
    request = require('request'),
    concat = require('concat-stream'),
    JSONStream = require('JSONStream'),
    xmldom = require('@xmldom/xmldom')

module.exports = function(query, cb, options) {
    var contentType;
    options = options || {};
  var toJSON = function(data) {
    return cb(undefined, data);
  };
    var toGeoJSON = function(data) {
        var geojson;

        geojson = osmtogeojson(data, {
            flatProperties: options.flatProperties || false
        });
        cb(undefined, geojson);
    };

    var handleXml = function (data) {
        var parser = new xmldom.DOMParser();
        var doc = parser.parseFromString(data);
        toGeoJSON(doc);
    }

    var reqOptions = {
    timeout: 480000,
    headers: options.headers || {},
    body: querystring.stringify({data: query}),
    };
  reqOptions.headers['content-type'] = 'application/x-www-form-urlencoded';
    var r;

    if (!global.window) {
        r = request.post(options.overpassUrl || 'https://overpass-api.de/api/interpreter', reqOptions);

        r
            .on('response', function(response) {
                if (response.statusCode != 200) {
                    r.abort();
                    return cb({
                        message: 'Request failed: HTTP ' + response.statusCode,
                        statusCode: response.statusCode
                    });
                }
                contentType = response.headers['content-type'];

                if (contentType.indexOf('json') >= 0) {
			if (options.noGeoJSON == true) {
			  r.pipe(JSONStream.parse())
			    .on('data', toJSON)
			    .on('error', cb);
			} else {
                    r.pipe(JSONStream.parse())
                        .on('data', toGeoJSON)
                        .on('error', cb);
       		}
                } else if (contentType.indexOf('xml') >= 0) {
                    var body = '';
                    r.on('data', function (chunk) { body += chunk; })
                        .on('end', function() { handleXml(body); });
                } else {
                    cb({
                        message: 'Unknown Content-Type "' + contentType + '" in response'
                    });
                }
            })
            .on('error', cb);
    } else {
        r = request.post(options.overpassUrl || 'https://overpass-api.de/api/interpreter', reqOptions,
            function (error, response, body) {
                if (!error && response.statusCode === 200) {
                  try {
                    var jsonBody = JSON.parse(body);
            if (options.noGeoJSON == true) {
              return toJSON(jsonBody);
            } else {
              return toGeoJSON(jsonBody);
            }

                  } catch (e) {
                    cb(e);
                  }

                } else if (error) {
                    cb(error);
                } else if (response) {
                    cb({
                        message: 'Request failed: HTTP ' + response.statusCode,
                        statusCode: response.statusCode
                    });
                } else {
                    cb({
                        message: 'Unknown error.',
                    });
                }
            });
    }

    return r;
};

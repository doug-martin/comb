"use strict";
var base = require("../../base"),
    hitch = base.hitch,
    escape = base.regexp.escapeString,
    FileAppender = require("./fileAppender"),
    fs = require("fs"),
    path = require("path"),
    promise = require("../../promise"),
    wrap = promise.wrap;

var conversion = {
    MB: 1048576,
    KB: 1024,
    GB: 1073741824
};
var DEFAULT_SIZE = "10MB";
function convertToBytes(str) {
    var ret = DEFAULT_SIZE;
    var match = str.match(/(\d+)(MB|KB|GB)$/);
    if (match && match.length === 3) {
        var size = parseInt(match[1], 10);
        ret = size * conversion[match[2]];
    }
    return ret;
}

/**
 * @class Appends messages to a file. Rolls files over when a size limit has been reached. Once the max file size has
 * been reached it is rolled over to a file called &lt;logName&gt;.log.n where n is a number.
 * </br></br>
 * <p>Example. RollingFileAppender is current writing to myLog.log, the log reaches is max size to it is
 * renamed to myLog.log.1 and a new myLog.log is created.</p>
 * </br>
 * If maxBackupIndex is reached then the log at that index is deleted. If maxBackupIndex is set to 0 then no log is
 * rolled over.</p>
 *
 * @name RollingFileAppender
 * @augments comb.logging.appenders.FileAppender
 * @memberOf comb.logging.appenders
 *
 * @param {Object} [options] options to assign to this Appender
 * @param {String} [options.name="appender"] the name of this Appender. If you want two of the same type of appender
 *                                           on a logger it must have a different name.
 * @param {String} [options.pattern="[{[yyyy-MM-ddTHH:mm:ss:SSS (z)]timeStamp}] {[- 5]levelName} {[-20]name} - {message}"]
 *  <p>Available Options for formatting see {@link comb.string.format} for formatting options</p>
 *  <ul>
 *      <li>timeStamp - the timestamp of the event being logged</li>
 *      <li>level - the {@link comb.logging.Level} of the event</li>
 *      <li>levelName - the name of the level being logged</li>
 *      <li>name - the name of the logger logging the event</li>
 *      <li>message - the message being logged</li>
 * </ul>
 * @param {comb.logging.Level|String} [options.level=comb.logging.Level.INFO] the logging level of this appender
 *      <p><b>Note:</b> the level can be different from the logger in the case that you want a particular logger
 *      to only log particular event of a level. For example an appender that only logs errors. BEWARE that if the
 *      appenders level is lower than the logger is will not recieve any messages.</p>
 *
 * @param {String} [options.file="./log.log"] the file to log events to.
 * @param {String} [options.encoding="utf8"] the encoding of the file.
 * @param {Boolean} [options.overwrite=false] if true the log file is overwritten otherwise it is appended to.
 * @param {String} [options.maxSize="10MB"] the maxSize of a file. Valid options include "KB", "MB", or "GB"
 *
 * <pre class="code">
 *     maxSize = "100MB"
 *     //or
 *     maxSize = "100KB"
 *     //or
 *     maxSize = "1GB"
 * </pre>
 *
 * @param {Number} [options.maxBackupIndex=10] the maximum number of files to rollOver.
 */
module.exports = FileAppender.extend({
    instance: {

        __watching: false,

        constructor: function (options) {
            options = options || {};
            this.maxSize = options.maxSize || DEFAULT_SIZE;
            !options.name && (options.name = "rollingFileAppender");
            this.maxBackupIndex = options.maxBackupIndex || 10;
            this.__queue = [];
            this.__inRollover = false;
            this._super([options]);
        },

        __startCheck: function () {
            var self = this;
            if (!this.__watching) {
                this.__watching = true;
                fs.watchFile(this.__file, function (stat) {
                    self.__checkFile(stat);
                });
                fs.stat(this.__file, function (err, stat) {
                    self.__checkFile(stat);
                });
            }
        },

        __checkFile: function (stats) {
            var self = this;
            if (!this.__inRollover) {
                if (stats.size >= this.maxSize) {
                    if (this.maxBackupIndex > 0) {
                        this.__inRollover = true;
                        return this.__onExit()
                            .then(function () {
                                return self.__rollover();
                            })
                            .then(function () {
                                return new Promise(function (resolve) {
                                    var ws = fs.createWriteStream(self.__file, {flags: "w", encoding: self.__encoding});
                                    ws.on("open", function () {
                                        self.__writeStream = ws;
                                        self.__inRollover = false;
                                        self.__checkQueue();
                                        resolve();
                                    });
                                });
                            }, function (err) {
                                process.stderr.write("comb.logging.appenders.RollingFileAppender : error rolling over files resuming writing");
                                process.stderr.write(err.stack);
                                return new Promise(function (resolve) {
                                    var ws = fs.createWriteStream(self.__file, {flags: "w", encoding: self.__encoding});
                                    ws.on("open", function () {
                                        self.__writeStream = ws;
                                        self.__inRollover = false;
                                        self.__checkQueue();
                                        resolve();
                                    });
                                });
                            });
                    } else {
                        this.__writeStream = fs.createWriteStream(this.__file, {flags: "w", encoding: this.__encoding});
                    }
                }
            }
            return Promise.resolve();
        },


        append: function (event) {
            if (this._canAppend(event)) {
                !this.__watching && this.__startCheck();
                var ws = this.__writeStream;
                if (!this.__inRollover && ws && ws.writable) {
                    this._super(arguments);
                } else {
                    this.__queue.push(event);
                }
            }
        },

        __checkQueue: function () {
            this.__queue.forEach(this.append, this);
            this.__queue.length = 0;
        },

        __rollover: function () {
            var file = this.__file, self = this;
            var dir = path.dirname(file), baseName = new RegExp("(" + escape(path.basename(path.basename(file))) + ")(?:\\.(\\d*))*");
            return wrap(fs.readdir, fs)(dir).then(function (files) {
                files = files.filter(
                    function (f) {
                        var match = f.match(baseName);
                        if (match) {
                            return true;
                        } else {
                            return false;
                        }
                    });
                files = files.sort(function (a, b) {
                    var ret = 0;
                    if (a > b) {
                        ret = 0;
                    } else if (a < b) {
                        ret = 1;
                    }
                    return ret;
                });
                var count = files.length, i = 0;
                return new Promise(function (resolve, reject) {
                    (function checkFile() {
                        if (count > 0) {
                            var f = dir + "/" + files[i++];
                            if (count > self.maxBackupIndex) {
                                //drop the file;
                                count--;
                                wrap(fs.unlink, fs)(f).then(checkFile, reject);
                            } else {
                                //rename the file
                                var rn = self.__file + "." + count--;
                                wrap(fs.rename, fs)(f, rn).then(checkFile, reject);
                            }
                        } else {
                            resolve();
                        }
                    }());
                });
            });
        },


        getters: {

            maxSize: function () {
                return this.__maxSize;
            }
        },

        setters: {
            maxSize: function (size) {
                this.__maxSize = size ? convertToBytes(size) : DEFAULT_SIZE;
            }
        }
    }
}).registerType("RollingFileAppender");
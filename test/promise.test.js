"use strict";
var it = require('it'),
    assert = require('assert'),
    comb = require("index"),
    Readable = require("stream").Readable;


it.describe("The promise API", function (it) {

    it.describe("comb.wrap", function (it) {
        var nodeCBStyle = function (cb) {
            var args = comb.argsToArray(arguments);
            cb = args.pop();
            cb.apply(this, [null].concat(args));
        };

        var nodeCBStyleError = function (cb) {
            var args = comb.argsToArray(arguments);
            cb = args.pop();
            cb.apply(this, ["ERROR"]);
        };

        it.should("wrap traditional node cb methods with a promise", function () {
            return comb.wrap(nodeCBStyle)("HELLO WORLD").then(function (res) {
                assert.equal(res, "HELLO WORLD");
            });
        });

        it.should("wrap traditional node cb methods with a promise and errback if an error is the first argument", function () {
            return comb.wrap(nodeCBStyleError)("HELLO WORLD").then(assert.fail, function (res) {
                assert.equal(res, "ERROR");
            });
        });
    });

    it.describe("comb.serial", function (it) {

        var asyncAction = function (item, timeout, error) {
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    error ? reject(item) : resolve(item);
                }, timeout);
            });
        };

        var syncAction = function (item, error) {
            if (error) {
                throw "ERROR";
            } else {
                return item;
            }
        };

        it.should("execute the items serially", function (next) {
            comb.serial([
                comb.partial(asyncAction, 1, 100),
                comb.partial(syncAction, 1.5),
                comb.partial(asyncAction, 2, 90),
                comb.partial(syncAction, 2.5),
                comb.partial(asyncAction, 3, 80),
                comb.partial(syncAction, 3.5),
                comb.partial(asyncAction, 4, 70),
                comb.partial(syncAction, 4.5),
                comb.partial(asyncAction, 5, 60),
                comb.partial(syncAction, 5.5),
                comb.partial(asyncAction, 6, 50)
            ]).then(function (res) {
                assert.deepEqual(res, [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]);
                next();
            }, next);
        });

        it.should("catch errors", function (next) {
            comb.serial([
                comb.partial(asyncAction, 1, 100),
                comb.partial(syncAction, 1.5),
                comb.partial(asyncAction, 2, 90),
                comb.partial(syncAction, 2.5),
                comb.partial(asyncAction, 3, 80),
                comb.partial(syncAction, 3.5),
                comb.partial(asyncAction, 4, 70),
                comb.partial(syncAction, 4.5),
                comb.partial(asyncAction, 5, 60),
                comb.partial(syncAction, 5.5, true),
                comb.partial(asyncAction, 6, 50)
            ]).then(next, function (res) {
                assert.deepEqual(res, "ERROR");
                next();
            });
        });

        it.should("catch async errors", function (next) {
            comb.serial([
                comb.partial(asyncAction, 1, 100, true),
                comb.partial(syncAction, 1.5),
                comb.partial(asyncAction, 2, 90),
                comb.partial(syncAction, 2.5),
                comb.partial(asyncAction, 3, 80),
                comb.partial(syncAction, 3.5),
                comb.partial(asyncAction, 4, 70),
                comb.partial(syncAction, 4.5),
                comb.partial(asyncAction, 5, 60),
                comb.partial(syncAction, 5.5, true),
                comb.partial(asyncAction, 6, 50)
            ]).then(next, function (res) {
                assert.deepEqual(res, 1);
                next();
            });
        });

        it.should("reject with an error if not called with an array", function () {
            return comb.serial(
                comb.partial(asyncAction, 1, 100, true),
                comb.partial(syncAction, 1.5),
                comb.partial(asyncAction, 2, 90),
                comb.partial(syncAction, 2.5),
                comb.partial(asyncAction, 3, 80),
                comb.partial(syncAction, 3.5),
                comb.partial(asyncAction, 4, 70),
                comb.partial(syncAction, 4.5),
                comb.partial(asyncAction, 5, 60),
                comb.partial(syncAction, 5.5, true),
                comb.partial(asyncAction, 6, 50)
            ).then(assert.fail, function (err) {
                    assert.equal(err.message, "When calling comb.serial the first argument must be an array");
                });
        });
    });

    it.describe("comb.chain", function (it) {
        function asyncAction(add, timeout, error) {
            return function (num) {
                num = num || 0;
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        !error ? resolve(num + add) : reject("ERROR");
                    }, timeout);
                });
            }
        }

        function syncAction(add, error) {
            return function (num) {
                if (error) {
                    throw "ERROR";
                } else {
                    return num + add;
                }
            }
        }

        it.should("execute the items serially", function () {
            return comb.chain([
                asyncAction(1, 100),
                syncAction(1.5),
                asyncAction(2, 90),
                syncAction(2.5),
                asyncAction(3, 80),
                syncAction(3.5),
                asyncAction(4, 70),
                syncAction(4.5),
                asyncAction(5, 60),
                syncAction(5.5),
                asyncAction(6, 50)
            ]).then(function (results, prev) {
                assert.deepEqual(results, 38.5);
                assert.isUndefined(prev);
            });
        });

        it.should("catch errors", function () {
            return comb.chain([
                asyncAction(1, 100),
                syncAction(1.5),
                asyncAction(2, 90),
                syncAction(2.5),
                asyncAction(3, 80),
                syncAction(3.5),
                asyncAction(4, 70),
                syncAction(4.5),
                asyncAction(5, 60),
                syncAction(5.5, true),
                asyncAction(6, 50)
            ]).then(assert.fail, function (res) {
                assert.deepEqual(res, "ERROR");
            });
        });

        it.should("catch async errors", function () {
            return comb.chain([
                asyncAction(1, 100, true),
                syncAction(1.5),
                asyncAction(2, 90),
                syncAction(2.5),
                asyncAction(3, 80),
                syncAction(3.5),
                asyncAction(4, 70),
                syncAction(4.5),
                asyncAction(5, 60),
                syncAction(5.5, true),
                asyncAction(6, 500)
            ]).then(assert.fail, function (res) {
                assert.deepEqual(res, "ERROR");
            });
        });

        it.should("throw an error if not called with an array", function () {
            assert.throws(function () {
                comb.chain(
                    asyncAction(1, 100, true),
                    syncAction(1.5),
                    asyncAction(2, 90),
                    syncAction(2.5),
                    asyncAction(3, 80),
                    syncAction(3.5),
                    asyncAction(4, 70),
                    syncAction(4.5),
                    asyncAction(5, 60),
                    syncAction(5.5, true),
                    asyncAction(6, 50)
                );
            });
        });
    });

    it.describe("comb.wait", function (it) {

        it.should("wait for the promise to resolve", function () {
            var p = new Promise(function (resolve, reject) {
                process.nextTick(function () {
                    resolve();
                });
            });
            var waiter = comb.wait(p, function wait(arg) {
                assert.isTrue(arg);
            });
            return waiter(true);

        });

        it.should("allow multiple executions", function () {
            var p = new Promise(function (resolve) {
                process.nextTick(function () {
                    resolve(null);
                });
            });
            var waiter = comb.wait(p, function wait(arg) {
                assert.isNumber(arg);
                if (arg === 2) {
                    assert.equal(arg, 2);
                } else {
                    waiter(2);
                }
            });
            return waiter(1);

        });

    });

    it.describe("comb.promisfyStream", function (it) {

        function createStream() {
            var ret = new Readable();
            ret._read = function () {
            }
            return ret;
        }

        it.should("promisfy a stream", function () {
            var collected = [];
            var stream = createStream().on("data", function (data) {
                collected.push(data + "");
            });
            var promise = comb.promisfyStream(stream).then(function () {
                assert.deepEqual(collected.join(""), "abcd");
            })
            stream.push("a");
            stream.push("b");
            stream.push("c");
            stream.push("d");
            stream.push(null);
            return promise;

        });


        it.should("error if the promise errors", function () {
            var collected = [];
            var stream = createStream().on("data", function (data) {
                collected.push(data + "");
            });
            var promise = comb.promisfyStream(stream).then(assert.fail, function (err) {
                assert.deepEqual(collected.join(""), "abc");
                assert.equal(err.message, "error!");
            })
            stream.push("a");
            stream.push("b");
            stream.push("c");
            stream.emit("error", new Error("error!"));
            stream.push(null);
            return promise;

        });

    });
});
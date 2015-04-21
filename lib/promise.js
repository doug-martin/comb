"use strict";
var base = require("./base"),
    isObject = base.isObject,
    argsToArray = base.argsToArray,
    array = base.array,
    forEach = array.forEach,
    spreadArgs = base.__spreadArgs;

module.exports = {
    wrap: wrap,
    wait: wait,
    serial: serial,
    chain: chain,
    promisfyStream: promisfyStream,
    isPromise: isPromise
};

/**
 * Creates the promise chain
 * @ignore
 * @private
 */
function callNext(list, results, propogate) {
    var ret = Promise.resolve();
    forEach(list, function (listItem) {
        ret = ret.then(function (res) {
            return propogate ? listItem(res) : listItem();
        });
        if (!propogate) {
            ret.then(function (res) {
                results.push(res);
                res = null;
            });
        }
    });
    return propogate ? ret : ret.then(function () {
        return results;
    });
}

/**
 * Tests if an object is like a promise (i.e. it contains then, addCallback, addErrback)
 * @param obj object to test
 * @function
 * @static
 * @memberOf comb
 */
function isPromise(obj) {
    return isObject(obj) && typeof obj.then === "function";
}

/**
 * Wraps traditional node style functions with a promise.
 * @example
 *
 * var fs = require("fs");
 * var readFile = comb.wrap(fs.readFile, fs);
 * readFile(__dirname + "/test.json").then(
 *      function(buffer){
 *          console.log(contents);
 *      },
 *      function(err){
 *
 *      }  console.error(err);
 * );
 *
 *
 * @param {Function} fn function to wrap
 * @param {Object} scope scope to call the function in
 *
 * @return {Funciton} a wrapped function
 * @static
 * @memberOf comb
 */
function wrap(fn, scope) {
    return function () {
        var args = argsToArray(arguments);
        return new Promise(function (resolve, reject) {
            args.push(function (err, res) {
                if (err) {
                    reject(err);
                } else {
                    resolve.call(void 0, res);
                }
            });
            fn.apply(scope || this, args);
        });
    }
}

/**
 * Executes a list of items in a serial manner. If the list contains promises then each promise
 * will be executed in a serial manner, if the list contains non async items then the next item in the list
 * is called.
 *
 * @example
 *
 * var asyncAction = function(item, timeout){
 *    var ret = new comb.Promise();
 *    setTimeout(comb.hitchIgnore(ret, "callback", item), timeout);
 *    return ret.promise();
 * };
 *
 * comb.serial([
 *     comb.partial(asyncAction, 1, 1000),
 *     comb.partial(asyncAction, 2, 900),
 *     comb.partial(asyncAction, 3, 800),
 *     comb.partial(asyncAction, 4, 700),
 *     comb.partial(asyncAction, 5, 600),
 *     comb.partial(asyncAction, 6, 500)
 * ]).then(function(results){
 *     console.log(results); // [1,2,3,4,5,6];
 * });
 *
 *
 *
 * @param list
 * @param callback
 * @param errback
 * @static
 * @memberOf comb
 */
function serial(list, callback, errback) {
    if (base.isArray(list)) {
        return callNext(list, [], false);
    } else {
        return Promise.reject(new Error("When calling comb.serial the first argument must be an array"));
    }
}


/**
 * Works just like {@link comb.Promise#chain} method, allowing you to propogate results from one funciton to another.
 * This is different than {@link comb.serial} in that it propogates results from one promise to the next, where
 * {@link comb.serial} does not.
 *
 * @example
 *
 * function asyncAction(add, timeout) {
 *      return function (num) {
 *          num = num || 0;
 *          var ret = new comb.Promise();
 *          setTimeout(function () {
 *               ret.callback(num + add);
 *          }, timeout);
 *          return ret;
 *      }
 * }
 *
 * comb.chain([
 *      asyncAction(1, 100),
 *      asyncAction(2, 100),
 *      asyncAction(3, 100),
 *      asyncAction(4, 100),
 *      asyncAction(5, 100),
 * ]).then(function(results){
 *      console.log(results); //15
 * });
 *
 * @param {function[]} list an array of function to call.
 * @return {comb.Promise} a promise that will resolve with the results of the last function in the list.
 * @static
 * @memberOf comb
 */
function chain(list) {
    if (base.isArray(list)) {
        return callNext(list, [], true);
    } else {
        throw new Error("When calling comb.serial the first argument must be an array");
    }
}


/**
 * Ensures that a promise is resolved before a the function can be run.
 *
 * For example suppose you have to ensure that you are connected to a database before you execute a function.
 *
 * ```
 * var findUser = comb.wait(connect(), function findUser(id){
 *      //this wont execute until we are connected
 *      return User.findById(id);
 * });
 *
 *  Promise.all(findUser(1), findUser(2)).then(function(users){
 *      var user1 = users[0], user2 = users[1];
 *  });
 *
 * ```
 *
 * @param args variable number of arguments to wait on.
 * @param {Function} fn function that will wait.
 * @return {Function} a function that will wait on the args to resolve.
 * @memberOf comb
 * @static
 */
function wait(args, fn) {
    var args = argsToArray(arguments), resolved = false;
    fn = args.pop();
    var p = Promise.all(args);
    return function waiter() {
        if (!resolved) {
            var args = arguments;
            return p.then(function () {
                resolved = true;
                p = null;
                return spreadArgs(fn, args);
            });
        } else {
            return Promise.resolve(fn.apply(this, arguments));
        }
    };
}


/**
 * Wraps a stream in a promise waiting for either the `"end"` or `"error"` event to be triggered.
 *
 * ```
 * comb.promisfyStream(fs.createdReadStream("my.file")).chain(function(){
 *      console.log("done reading!");
 * });
 *
 * ```
 *
 * @param stream stream to wrap
 * @return {comb.Promise} a Promise is resolved if `"end"` is triggered before `"error"` or rejected if `"error"` is triggered.
 * @memberOf comb
 * @static
 */
function promisfyStream(stream) {
    return new Promise(function (resolve, reject) {
        var called;

        function errorHandler() {
            if (!called) {
                called = true;
                spreadArgs(reject, arguments);
                stream.removeListener("error", endHandler);
                stream.removeListener("end", endHandler);
                stream = null;
            }
        }

        function endHandler() {
            if (!called) {
                called = true;
                spreadArgs(resolve, arguments);
                stream.removeListener("error", endHandler);
                stream.removeListener("end", endHandler);
                stream = null;
            }
        }

        stream.on("error", errorHandler).on("end", endHandler);
    });
}








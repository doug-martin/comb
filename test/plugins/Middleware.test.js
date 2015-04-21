"use strict";
var it = require('it'),
    assert = require('assert'),
    comb = require("index"),
    define = comb.define,
    hitch = comb.hitch;


it.describe("comb.plugins.Middleware", function (it) {
//Super of other classes
    function valWrapper(val) {
        return function () {
            return val;
        };
    }

    var Mammal = define(comb.plugins.Middleware, {
        instance: {

            constructor: function (options) {
                options = options || {};
                this._super(arguments);
                this._type = options.type || "mammal";
            },

            speak: function () {
                var self = this;
                return this._hook("pre", "speak")
                    .then(function () {
                        return self._hook("post", "speak");
                    })
                    .then(valWrapper("speak"));
            },

            speakAgain: function () {
                var self = this;
                return this._hook("pre", "speakAgain")
                    .then(function () {
                        return self._hook("post", "speakAgain");
                    })
                    .then(valWrapper("speakAgain"));

            },

            eat: function () {
                var self = this;
                return this._hook("pre", "eat")
                    .then(function () {
                        return self._hook("post", "eat");
                    })
                    .then(valWrapper("eat"));
            }
        }
    });

    it.should("call pre middleware", function (next) {
        Mammal.pre('speak', function (n) {
            assert.isTrue(comb.isFunction(n));
            n();
            next();
        });
        var m = new Mammal({color: "gold"});
        m.speak();
    });

    it.should("call pre middleware on an instance of middleware", function (next) {
        var m = new Mammal({color: "gold"});
        m.pre('speakAgain', function (n) {
            assert.isTrue(comb.isFunction(n));
            n();
            next();
        });
        m.speakAgain();
    });

    it.should("call post middleware", function () {
        Mammal.post('speak', function (n) {
            assert.isTrue(comb.isFunction(n));
            n();
        });
        var m = new Mammal({color: "gold"});
        return m.speak();
    });

    it.should("call post middleware on an instance of middleware", function () {
        var m = new Mammal({color: "gold"});
        m.post('speakAgain', function (n) {
            assert.isTrue(comb.isFunction(n));
            n();
        });
        return m.speakAgain();
    });

    it.should("callback right away if there is no middleware", function () {
        var m = new Mammal({color: "gold"});
        return m.eat().then(function (str) {
            assert.equal(str, "eat");
        });
    });

    it.should("errback if the first argument to next is not null/undefined", function () {
        Mammal.pre('speak', function (n) {
            assert.isTrue(comb.isFunction(n));
            n("error");
        });
        var m = new Mammal({color: "gold"});
        return m.speak().then(assert.fail, function (err) {
            assert.equal(err, "error");
        });
    });

}).as(module);

it.run().both(process.exit);



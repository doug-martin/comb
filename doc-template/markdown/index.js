var Handlebars = require("handlebars"),
    util = require("downdoc/lib/util"),
    fs = require("fs"),
    path = require("path");


var template = __dirname;
var readmeTemplate = fs.readFileSync(path.resolve(template, "./markdown.tmpl"), "utf8");
var compiledReadmeTemplate = Handlebars.compile(readmeTemplate);


var link = function (name, context) {
    return new Handlebars.SafeString(
        "#" + name.replace(/\./g, "_")
    );
};

var escapeLink = function (name) {
    return new Handlebars.SafeString(
        name.replace(/\./g, "_")
    );
};


var joinTypes = function (types) {
    return new Handlebars.SafeString(
        "`" + types.join("|") + "`"
    );
};


var replaceLinks = function (text) {
    return text ? text.replace(/\{@link\s([^\}]*)\}/g, function (m, s) {
        return ["[", s, "](#", s.replace(/\./g, "_"), ")"].join("");
    }) : "";
};

var formatParamName = function (name) {
    var ret = name.name
    if (name.optional) {
        if ("undefined" !== typeof name.defaultValue) {
            ret = "[" + ret + "=" + name.defaultValue + "]";
        } else {
            ret += "?"
        }
    }
    return ret;
};

var propertyTable = function (properties) {
    var ret = "";
    if (properties.length) {
        ret = "<table><tr><td>Property</td><td>Default Value</td><td>Description</td></tr>";
        properties.forEach(function (p) {
            var nameValue = util.isString(p.name) ? p.name : p.name.name;
            var name = p.isStatic ? "<em>" + nameValue + "</em>" : nameValue;
            var value = p.code || "";
            var description = replaceLinks(p.description) || "";

            ret += ["<tr><td>", name , "</td><td>", value, "</td><td>", description, "</td><tr>"].join("")
        });
        ret += "</table>";
    }
    return ret;
};

var importFile = (function () {
    var compiledImports = {};
    return function (file, context, b) {
        if (!file.match(/\.tmpl$/)) {
            file += ".tmpl";
        }
        try {

            var filePath = path.resolve(template, file);
            var tmpl = compiledImports[filePath];
            if (!tmpl) {
                var fileContent = fs.readFileSync(filePath, "utf8");
                tmpl = compiledImports[filePath] = Handlebars.compile(fileContent)
            }
            return tmpl(this);
        } catch (e) {
            throw e;
        }
    }
})();

Handlebars.registerHelper('link', link);
Handlebars.registerHelper('escapeLink', escapeLink);
Handlebars.registerHelper("joinTypes", joinTypes);
Handlebars.registerHelper("replaceLinks", replaceLinks);
Handlebars.registerHelper("formatParamName", formatParamName);
Handlebars.registerHelper("propertyTable", propertyTable);
Handlebars.registerHelper("import", importFile);

var objComp = function (n1, n2) {
    return n1.name === n2.name ? 0 : n1.name < n2.name ? -1 : 1
};

exports.generate = function (tree, options) {
    var nameSpaces = tree.getNamespaces().sort(objComp);
    nameSpaces.forEach(function (n) {
        n.methods.sort(objComp);
        n.properties.sort(objComp);
    });
    var classes = tree.getClasses().sort(objComp);
    classes.forEach(function (c) {
        c.instanceMethods.sort(objComp);
        c.instanceProperties.sort(objComp);
        c.staticMethods.sort(objComp);
        c.staticProperties.sort(objComp);
    });
    return compiledReadmeTemplate({namespaces:nameSpaces, classes:classes});
};

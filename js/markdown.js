const marked = require("marked");
const extendedTables = require("marked-extended-tables");

marked.use(extendedTables());

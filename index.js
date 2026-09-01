const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let code = require("./pair");

require("events").EventEmitter.defaultMaxListeners = 500;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/code", code);

app.use("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "pair.html"));
});

app.listen(PORT, () => {
  console.log(`⏩ MrNobody Pair Server running on port ${PORT}`);
});

module.exports = app;

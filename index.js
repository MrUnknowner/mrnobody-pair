const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;

let code = require("./pair");
let qr = require("./qr");

require("events").EventEmitter.defaultMaxListeners = 500;

// වෙනත් Website එකකින් මේ API එකට Call කරන්න දෙන අවසරය (CORS)
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/code", code);
app.use("/qr", qr);

// API එක වැඩද බලන්න සරල Message එකක්
app.get("/", (req, res) => {
  res.send("MRNOBODY MD API is successfully running!");
});

app.listen(PORT, () => {
  console.log(`⏩ Server running on port ` + PORT);
});

module.exports = app;

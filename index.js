const express = require("express");
const app = express();
const __path = process.cwd();
const PORT = process.env.PORT || 3000;
let code = require("./pair");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/code", code);

app.use("/", async (req, res, next) => {
  res.sendFile(__path + "/pair.html");
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ` + PORT);
});

module.exports = app;

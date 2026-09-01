const express = require('express');
const cors = require('cors');
const pairRouter = require('./pair');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send("🚀 MrNobody Base64 Pair Server is Live!");
});

app.use('/pair', pairRouter);

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

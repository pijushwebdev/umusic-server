const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');


const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());


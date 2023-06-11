const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  //bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();

  })
}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.woapvgk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("umusicDb").collection("users");
    const classCollection = client.db("umusicDb").collection("classes");

    //get all users from mongoDb and send to client
    app.get('/users', verifyJWT, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    //get all classes info
    app.get('/allClasses', async (req, res) => {
      const result = await classCollection.find().toArray()
      res.send(result);
    })

    //create user send to mongoDb and get from client
    app.post('/users', async (req, res) => {
      const user = req.body;
      //for google signIn // existing user find
      const query = { email: user.email }
      const existUser = await usersCollection.findOne(query);
      if (existUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    //add class by instructor // send to mongoDb and get from client
    app.post('/addClassByIns', async (req, res) => {
      const classData = req.body;
      classData.status = 'pending';   
      const result = await classCollection.insertOne(classData);
      res.send(result);
    })

    // update user  to admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    //update user to instructor
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    //allow a class
    app.patch('/classAllow/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'allowed'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    //deny a class
    app.patch('/classDeny/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'denied'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    //send feedback to mongodb
    app.patch('/feedback/:id', async (req,res) => {
      const id = req.params.id;
      const doc = req.body;
      const filter = { _id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          feedback: doc.feedback
        }
      }
      const result = await classCollection.updateOne(filter,updateDoc);
      res.send(result)
    })

    //is a user admin or not
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };

      res.send(result);
    })

    //is a user instructor or not
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' };

      res.send(result);
    })

    //delete user 
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);

    })

    //jwt
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token })
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('music is playing')
})

app.listen(port, () => {
  console.log(`Music is playing on port ${port}`);
})
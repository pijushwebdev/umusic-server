const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//PAYMENTS
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

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
    const cartCollection = client.db("umusicDb").collection("carts");
    const paymentCollection = client.db("umusicDb").collection("payments");

    //verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next();
    }

    //instructor middleware
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next();
    }

    //get all users from mongoDb and send to client
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    //get all classes info for admin manageClasses // admin
    app.get('/allClasses', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classCollection.find().toArray()
      res.send(result);
    })

    //create user send to mongoDb and get from client //signup page // new user
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

    //add class by instructor // send to mongoDb and get from client // addClass by instructor
    app.post('/addClassByIns', verifyJWT, verifyInstructor, async (req, res) => {
      const classData = req.body;
      classData.status = 'pending';
      const result = await classCollection.insertOne(classData);
      res.send(result);
    })

    // update user  to admin //manageUser by admin
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
    //update user to instructor // manageUser by admin
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
    //approve a class
    app.patch('/classAllow/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approved'
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
    app.patch('/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const doc = req.body;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          feedback: doc.feedback
        }
      }
      const result = await classCollection.updateOne(filter, updateDoc);
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

    // all instructors for all
    app.get('/instructors', async (req, res) => {
      const query = { role: 'instructor' };
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    })

    //get all approver class for all
    app.get('/approvedClasses', async (req, res) => {
      const query = { status: 'approved' };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })

    //jwt
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token })
    })

    // cart collection apis
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const query = { email: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result);
    })

    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);

    })

    //delete a cart by email
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    //payment 
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({ clientSecret: paymentIntent.client_secret });

    })

    //store payment info / update seats / delete cart items
    app.post('/payment', verifyJWT, async (req, res) => {
      const payment = req.body;
      // console.log(payment);
      const insertResult = await paymentCollection.insertOne(payment);
      const id = payment.cartId;
      const classId = payment.classId;

      const query = { _id: new ObjectId(id) }; // selected class / cart id
      const cQuery = { _id: new ObjectId(classId) } // class id

      const updateClass = await classCollection.updateOne(cQuery, { $inc: { seats: -1 } })

      const deleteResult = await cartCollection.deleteOne(query);

      res.send({ insertResult, deleteResult, updateClass });
    })

    //get enrolled class from payment collection by student
    app.get('/enrolledClass', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/paymentHistory', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const options = {
        // sort returned documents in descending order by date
        sort: { date: -1 },
        // Include only the `title` and `imdb` fields in each returned document
        projection: { transactionId: 1, className: 1, price: 1, date: 1 },
      };
      const result = await paymentCollection.find(query, options).toArray();
      res.send(result);
    })

    //get all instructor class by email for instructor dashboard
    app.get('/instClasses', verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/instEnrollClass', verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.query.email;
      const query = { instructorEmail: email }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.get( '/topClasses', async() => {
      
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
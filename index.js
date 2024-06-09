const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { formatISO } = require("date-fns");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// Init Express
const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://diagnostic-management-312cf.web.app",
    ],
    credentials: true,
  })
);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.apymwsq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Send a ping to confirm a successful connection

    // Create Database and Collection
    const userCollection = client.db("diagnosticDB").collection("users");
    const testCollection = client.db("diagnosticDB").collection("tests");
    const bannerCollection = client.db("diagnosticDB").collection("banners");
    const bookingCollection = client.db("diagnosticDB").collection("bookings");
    const healthRecommendationsCollection = client
      .db("diagnosticDB")
      .collection("healthRecommendations");

    // Admin Verify
    const adminVerify = async (req, res, next) => {
      const email = req.decoded.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    // JWT Related Route
    app.post("/jwt", (req, res) => {
      // Get User Info
      const email = req.body;
      // Create Token
      const token = jwt.sign(email, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Token Verify
    const verifyToken = (req, res, next) => {
      // Check  authorization
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized Access" });
        }
        req.decoded = decoded;

        next();
      });
    };

    // Get Admin User
    app.get("/user-admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized Access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // Create User
    app.post("/user", async (req, res) => {
      const userInfo = req.body;

      const result = await userCollection.insertOne(userInfo);
      res.send(result);
    });

    // Get All User
    app.get("/user", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Get Single User
    app.get("/user/current/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await userCollection.findOne(filter);

      res.send(result);
    });

    // Update User Status
    app.patch("/user/:id", verifyToken, adminVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { status } = req.body;

      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // Update User Role
    app.patch("/user/role/:id", verifyToken, adminVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { role } = req.body;

      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Update User Status
    app.put("/user/update/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const userInfo = req.body;

      const updateDoc = {
        $set: {
          name: userInfo.name,
          photo: userInfo.photo,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Create Test
    app.post("/tests", verifyToken, adminVerify, async (req, res) => {
      const testInfo = req.body;
      const result = await testCollection.insertOne(testInfo);
      res.send(result);
    });

    // Get All Tests
    // app.get("/tests", async (req, res) => {
    //   const result = await testCollection.find().toArray();
    //   res.send(result);
    // });
    app.get("/tests", async (req, res) => {
      const result = await testCollection.find().toArray();
      res.send(result);
    });
    // Get Single Test
    app.get("/tests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testCollection.findOne(query);
      res.send(result);
    });

    // Update Test
    app.put("/tests/update/:id", verifyToken, adminVerify, async (req, res) => {
      const id = req.params.id;
      const testData = req.body;

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };

      // Update
      const updateDoc = {
        $set: {
          ...testData,
        },
      };
      // Now Send To DB
      const result = await testCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // Delete Test
    app.delete(
      "/test/delete/:id",
      verifyToken,
      adminVerify,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await testCollection.deleteOne(query);
        res.send(result);
      }
    );

    // Create Banner
    app.post("/banner", verifyToken, adminVerify, async (req, res) => {
      const bannerInfo = req.body;
      const result = await bannerCollection.insertOne(bannerInfo);
      res.send(result);
    });
    // Get All Banners
    app.get("/banner", async (req, res) => {
      const result = await bannerCollection.find().toArray();
      res.send(result);
    });

    // Update Banner Status
    app.patch("/banner/:id", verifyToken, adminVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const info = req.body;

      const updateDoc = {
        $set: {
          isActive: info.status,
        },
      };
      const result = await bannerCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // Delete Banner
    app.delete("/banner/:id", verifyToken, adminVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await bannerCollection.deleteOne(query);
      res.send(result);
    });

    // Booking Related Api
    app.post("/booking", verifyToken, async (req, res) => {
      const bookingInfo = req.body;

      // Update Slots
      await testCollection.updateOne(
        { _id: new ObjectId(bookingInfo.testId) },
        { $inc: { slots: -1 } }
      );
      const result = await bookingCollection.insertOne(bookingInfo);
      res.send(result);
    });

    // Get All Bookings
    app.get("/bookings", async (req, res) => {
      console.log(req.query);
      const result = await bookingCollection.find().toArray();
      res.send(result);
    });

    // Update Booking
    app.patch("/booking/status/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const testReport = req.body;
      const query = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          report: testReport.status,
        },
      };
      const result = await bookingCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Get All Upcoming Bookings
    app.get("/booking/upcomin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = { "patientInfo.email": email };
      const result = await bookingCollection.find(filter).toArray();
      res.send(result);
    });

    // Delete Booking
    app.delete("/booking/delete/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Create Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Get All User
    app.get("/health/recommendation", async (req, res) => {
      const result = await healthRecommendationsCollection.find().toArray();
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Listen Server
app.listen(port, () => {
  console.log(`Server is Running On PORT ${port}`);
});

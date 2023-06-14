require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
express= require('express');
const cors= require('cors');
const jwt = require('jsonwebtoken');
const app= express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port= process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o701kt2.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

//Middleware
app.use(cors());
app.use(express.json());

const verifyJWT=(req,res,next)=>{
  const authorization = req.headers.authorization;
  if(!authorization) {
    return res.send({error:true, message: 'Unauthorized Access'});
  }
  //bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err,decoded)=>{
    if(err) {
      return res.send({error:true, message: 'Unauthorized Access'})
    }
    req.decoded=decoded;
    next();
  })
}









async function run() {
  try {
   
    await client.connect();
    const database = client.db("danceFlow");
    const classCollection = database.collection("classes");
    const usersCollection = database.collection("users");
    const cartCollection = database.collection("cart");
    const paymentCollection = database.collection("payment");

    //All Routes here

    //Generate JWT
    app.post('/jwt',(req,res)=>{
        const user=req.body;
        
        const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,
        {expiresIn: '1h'});
        res.send({token});
    });

    //routes

    //get user role
    app.get('/role/:email',async(req,res)=>{
      
      const email= req.params.email;
      if(!email){
        res.send(null);
      }
      const query= { email:email};
      const result= await usersCollection.findOne(query);
      res.send(result)

    })


    //get all instructors
    app.get('/instructors',async(req,res)=>{
      const query= {role: 'instructor'};
      const result= await usersCollection.find(query).toArray();
      res.send(result);
    })


    //get all classes data for user
    app.get('/classes', async(req,res)=>{
      const filter={status: 'approved'}
      
      const result= await classCollection.find(filter).sort({_id: -1}).toArray();
      res.send(result)
      

    });

    //get top classes based on student number
    app.get('/topclasses', async(req,res)=>{
      const filter={status: 'approved'}
      
      const result= await classCollection.find(filter).sort({students: -1}).toArray();
      res.send(result)
      

    });

    //get top instructor based on class number
    app.get('/topinstructors', async(req,res)=>{
      const filter={role: 'instructor'}
      
      const result= await usersCollection.find(filter).sort({classes: -1}).toArray();
      res.send(result)
      

    });

    //get all classes for admin
    app.get('/admin-classes', async(req,res)=>{
      
      
      const result= await classCollection.find().sort({_id: -1}).toArray();
      res.send(result)
      

    });

    //reduce available seat and increase enrolled student
    app.post('/update-class-seats',verifyJWT, async(req,res)=>{
      const {clsId}=req.body;
      const query= { _id: new ObjectId(clsId)};
      const clsResult=await classCollection.findOne(query);
      const upSeats= (clsResult.seats)-1;
      const upStu= (clsResult.students)+1;
      const update= { $set: {seats : upSeats, students:upStu}};
      const result= await classCollection.updateOne(query,update)
      res.send(result);
      
    })

    //get a user classes data
    app.get('/myclasses', async(req,res)=>{
      const email= req.query.email;
      if(!email){
        res.send([])
      }
      const query= { insEmail: email};
      const result=await classCollection.find(query).toArray();
      console.log(result)
      res.send(result);
    })

    //update class details
    app.put('/class', verifyJWT, async(req,res)=>{
      const id= req.body.clsId;
      const className= req.body.courseName;
      const seats= parseInt(req.body.seats);
      const price= req.body.price;
      const filter= { _id: new ObjectId(id)}
      const update= { $set: {seats, price, className}};
      const result= await classCollection.updateOne(filter,update)
      res.send(result);
      

      
      

    })


   // update instructor class count

   app.post('/instructor-classcount', verifyJWT, async(req,res)=>{
       const email= req.body.email;

       const filter= { email: email};

       const findUser= await usersCollection.findOne(filter);
       const newClass=(findUser.classes)+1;
      
       
      const update= { $set: {classes: newClass}};
      const result= await usersCollection.updateOne(filter,update);
      res.send(result)
      


       
   })





    //change class ststus

    app.put('/status', async(req,res)=>{
      const id= req.body.id;
      const status= req.body.status;
      const feedback= req.body.feedback;
      const filter= { _id: new ObjectId(id)} 
      const update= { $set: {status, feedback}};
      const result= await classCollection.updateOne(filter,update)
      res.send(result);

    })




   
    //add class
    app.post('/addclass',verifyJWT, async(req,res)=>{
      const data= req.body;
      if(data.insEmail!==req.decoded.email){
        return res.status(401).send({error:true, message: 'Forbidden Access'});
      }
      const result= await classCollection.insertOne(data);
      res.send(result);
    })




    //create user
    app.post('/createuser', async(req,res)=>{
      const email=req.body.email;
      const user = await usersCollection.findOne({email: email});
      if(user) {
        return res.send({error:true , message : 'User already exist'})
      }
      const result = await usersCollection.insertOne(req.body);
     res.send(result)
    });


    //get users

    app.get('/users',async(req,res)=>{
      const result= await usersCollection.find().toArray();
      res.send(result)

    });


    //update user role

    app.put('/user',verifyJWT, async(req,res)=>{
      const id=req.body.id;
      const role=req.body.role;
      const filter= { _id: new ObjectId(id)}
      const update= { $set: {role: role}};
      const result= await usersCollection.updateOne(filter,update)
      res.send(result);
      
    });

    //add class to cart

    app.post('/cart',verifyJWT, async(req,res)=>{

      const cart = await cartCollection.findOne({clsId: req.body.clsId, email: req.body.email});
      if(cart) {
        return res.send({error:true , message : 'Already in cart'})
      }
      const result = await cartCollection.insertOne(req.body);
      res.send(result)
      
    })

    //get cart data

    app.get('/cart/:email',async(req,res)=>{

      const email= req.params.email;
      if(!email){
        res.send([]);
      }
      const query={ email: email, payment: 'none'};

      const result= await cartCollection.find(query).toArray();
      res.send(result);

    })


    //update cart data

    app.put('/cart',verifyJWT, async(req,res)=>{
      const {clsId,email}=req.body;
      const filter= { clsId : clsId, email: email};
      const update= { $set: {payment: 'done'}};
      const result= await cartCollection.updateOne(filter,update)
      res.send(result);
    })





    // delete cart

    app.delete('/cart/:id',verifyJWT, async(req,res)=>{
      const id= req.params.id;
      const query= { _id : new ObjectId(id)};
      const result=await cartCollection.deleteOne(query);

      res.send(result);
      


    })

    //add payment history

    app.post('/payment-history',verifyJWT, async(req,res)=>{
      const data=req.body;
      const result= await paymentCollection.insertOne(data);
    res.send(result);

    });


    //get payment history

    app.get('/payment-history/:email',async(req,res)=>{

      const email= req.params.email;
      if(!email) {
        res.send([]);
      }

      const query={ customerEmail: email};
      const result= await paymentCollection.find(query).sort({_id: -1}).toArray();

      res.send(result);


    })
    



    //create payment intent

    app.post('/create-payment-intent', verifyJWT,async(req,res)=>{
      const {price}= req.body;
      amount= price*100;
      const paymentIntent= await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })






     //All routes end
  





    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
   
   // await client.close();
  }
}
run().catch(console.dir);






app.get('/',(req,res)=>{
    res.send("Backend is running");
});

app.listen(port,()=>{
    console.log(`server is running at http://localhost:${port}`);
});


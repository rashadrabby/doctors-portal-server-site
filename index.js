const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express()
const { MongoClient, ServerApiVersion, MongoRuntimeError } = require('mongodb');
const port = process.env.PORT || 7181;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eqz0l.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJXT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        next();
    });
};

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        const userCollection = client.db('doctors_portal').collection('users');


        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

        app.get('/user', verifyJXT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        });

        app.put('/user/admin/:email', verifyJXT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = { $set: { role: 'admin' } };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden' });
            }
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = { $set: user, };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' })
            res.send({ result, token });
        });

        // Warning: This is not the proper way to query multiple collection. 
        // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            //Step 1: get all services
            const services = await serviceCollection.find().toArray();

            //Step 2: get the booking of that day. Output[{},{},{}]
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            //Step 3: for each service
            services.forEach(service => {
                //Step 4: find bookings for that service. Output[{},{},{}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                //Step 5: select slots for service Bookings: ['','','','']
                const booked = serviceBookings.map(book => book.slot);
                //Step 6: select those slots that are not include in bookedSlots
                const available = service.slots.filter(slot => !booked.includes(slot));
                //step 7: set available to slots to make it easier 
                service.slots = available;
            });

            res.send(services);

        });

        /**
         * API Naming Convention:
         * app.get('/booking') - to get all bookings in this collection or get more than one or by filter.
         * app.get('/booking/:id') - to get specific booking.
         * app.post('/booking') - to add a new booking.
         * app.patch('/booking/:id') - to update a specific booking.
         * app.delete('/booking/:id') - to delete a specific booking.
         */

        app.get('/booking', verifyJXT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

        });

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists });
            };
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        });

    }
    finally {

    }

};
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Doctors portal!')
})

app.listen(port, () => {
    console.log(`Port ${port}`)
})
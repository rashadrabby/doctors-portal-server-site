const express = require('express')
const cors = require('cors');
require('dotenv').config();
const app = express()
const { MongoClient, ServerApiVersion, MongoRuntimeError } = require('mongodb');
const port = process.env.PORT || 7181;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eqz0l.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
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

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists });
            };
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })

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
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const ML_SERVER_URL = 'http://localhost:5001';

let isDbConnected = false;

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'cotton-mitra-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ─── MongoDB Connection ────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cotton_mitra';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected:', MONGO_URI);
    isDbConnected = true;
    await seedDatabase();
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('⚠️  Running in demo mode with sample data (no MongoDB)');
  });

// ─── Models ───────────────────────────────────────────────────────────────────
const inventorySchema = new mongoose.Schema({
  batchId:     { type: String, required: true, unique: true },
  grade:       { type: String, enum: ['Premium', 'Standard', 'Economy'], default: 'Standard' },
  bales:       { type: Number, default: 0 },
  warehouse:   { type: String, default: 'Warehouse A' },
  location:    { type: String, default: 'Section 1' },
  harvestDate: { type: Date, default: Date.now },
  status:      { type: String, enum: ['In Stock', 'Reserved', 'Shipped', 'Low Stock'], default: 'In Stock' },
  pricePerBale:{ type: Number, default: 1200 },
  humidity:    { type: Number, default: 55 },
  temperature: { type: Number, default: 22 },
  notes:       { type: String, default: '' },
  addedAt:     { type: Date, default: Date.now }
});

const shipmentSchema = new mongoose.Schema({
  shipmentId:  { type: String, required: true, unique: true },
  destination: { type: String, required: true },
  bales:       { type: Number, default: 0 },
  status:      { type: String, enum: ['Pending', 'In Transit', 'Delivered', 'Cancelled'], default: 'Pending' },
  scheduledDate: { type: Date },
  deliveredDate: { type: Date },
  carrier:     { type: String, default: 'AgriFreight Ltd' },
  createdAt:   { type: Date, default: Date.now }
});

const alertSchema = new mongoose.Schema({
  type:       { type: String, enum: ['danger', 'warning', 'info', 'success'], default: 'info' },
  message:    { type: String, required: true },
  resolved:   { type: Boolean, default: false },
  source:     { type: String, default: 'System' },
  createdAt:  { type: Date, default: Date.now }
});

const forecastSchema = new mongoose.Schema({
  month:       { type: String, required: true },
  year:        { type: Number, required: true },
  predicted:   { type: Number, default: 0 },
  actual:      { type: Number, default: null },
  rainfall:    { type: Number, default: 0 },
  temperature: { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  role:      { type: String, enum: ['user', 'assistant'], required: true },
  content:   { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const yieldSchema = new mongoose.Schema({
  month:  { type: String, required: true },
  year:   { type: Number, required: true },
  bales:  { type: Number, default: 0 },
  grade:  { type: String, default: 'Standard' },
  createdAt: { type: Date, default: Date.now }
});

const Inventory  = mongoose.model('Inventory',  inventorySchema);
const Shipment   = mongoose.model('Shipment',   shipmentSchema);
const Alert      = mongoose.model('Alert',      alertSchema);
const Forecast   = mongoose.model('Forecast',   forecastSchema);
const Chat       = mongoose.model('Chat',       chatSchema);
const Yield      = mongoose.model('Yield',      yieldSchema);

// ─── Database Seeder ──────────────────────────────────────────────────────────
async function seedDatabase() {
  try {
    const invCount = await Inventory.countDocuments();
    if (invCount > 0) { console.log('📦 Database already seeded.'); return; }

    console.log('🌱 Seeding database with sample data...');

    // Inventory
    const inventoryData = [
      { batchId: 'BATCH-001', grade: 'Premium', bales: 820, warehouse: 'Warehouse A', location: 'Section 1', status: 'In Stock', pricePerBale: 1450, humidity: 52, temperature: 21 },
      { batchId: 'BATCH-002', grade: 'Premium', bales: 650, warehouse: 'Warehouse A', location: 'Section 2', status: 'Reserved', pricePerBale: 1450, humidity: 54, temperature: 22 },
      { batchId: 'BATCH-003', grade: 'Standard', bales: 480, warehouse: 'Warehouse B', location: 'Section 1', status: 'In Stock', pricePerBale: 1200, humidity: 61, temperature: 23 },
      { batchId: 'BATCH-004', grade: 'Standard', bales: 390, warehouse: 'Warehouse B', location: 'Section 2', status: 'In Stock', pricePerBale: 1200, humidity: 58, temperature: 22 },
      { batchId: 'BATCH-005', grade: 'Economy',  bales: 120, warehouse: 'Warehouse C', location: 'Section 1', status: 'Low Stock', pricePerBale: 900, humidity: 57, temperature: 24 },
      { batchId: 'BATCH-006', grade: 'Premium', bales: 950, warehouse: 'Warehouse A', location: 'Section 3', status: 'In Stock', pricePerBale: 1480, humidity: 50, temperature: 20 },
      { batchId: 'BATCH-007', grade: 'Standard', bales: 580, warehouse: 'Warehouse C', location: 'Section 2', status: 'In Stock', pricePerBale: 1220, humidity: 55, temperature: 22 },
      { batchId: 'BATCH-008', grade: 'Economy',  bales: 90,  warehouse: 'Warehouse C', location: 'Section 3', status: 'Low Stock', pricePerBale: 880, humidity: 60, temperature: 25 },
      { batchId: 'BATCH-009', grade: 'Premium', bales: 760, warehouse: 'Warehouse A', location: 'Section 4', status: 'Reserved', pricePerBale: 1460, humidity: 51, temperature: 21 },
      { batchId: 'BATCH-010', grade: 'Standard', bales: 210, warehouse: 'Warehouse B', location: 'Section 3', status: 'Low Stock', pricePerBale: 1180, humidity: 59, temperature: 23 },
    ];
    await Inventory.insertMany(inventoryData);

    // Shipments
    const shipmentsData = [
      { shipmentId: 'SHIP-4501', destination: 'Mumbai Textile Hub', bales: 200, status: 'Delivered', scheduledDate: new Date('2026-03-15'), deliveredDate: new Date('2026-03-18') },
      { shipmentId: 'SHIP-4502', destination: 'Ahmedabad Mills', bales: 350, status: 'Delivered', scheduledDate: new Date('2026-03-28'), deliveredDate: new Date('2026-04-01') },
      { shipmentId: 'SHIP-4503', destination: 'Surat Yarn Factory', bales: 180, status: 'In Transit', scheduledDate: new Date('2026-04-05') },
      { shipmentId: 'SHIP-4504', destination: 'Delhi Textile Market', bales: 420, status: 'Pending', scheduledDate: new Date('2026-04-10') },
      { shipmentId: 'SHIP-4505', destination: 'Coimbatore Spinning Mill', bales: 310, status: 'Pending', scheduledDate: new Date('2026-04-12') },
      { shipmentId: 'SHIP-4506', destination: 'Ludhiana Garment Cluster', bales: 150, status: 'Pending', scheduledDate: new Date('2026-04-15') },
      { shipmentId: 'SHIP-4507', destination: 'Nagpur Cotton Exchange', bales: 280, status: 'In Transit', scheduledDate: new Date('2026-04-03') },
      { shipmentId: 'SHIP-4508', destination: 'Indore Processing Unit', bales: 195, status: 'Pending', scheduledDate: new Date('2026-04-18') },
      { shipmentId: 'SHIP-4509', destination: 'Pune Export Hub', bales: 500, status: 'Pending', scheduledDate: new Date('2026-04-20') },
      { shipmentId: 'SHIP-4510', destination: 'Hyderabad Fabric Co.', bales: 225, status: 'Pending', scheduledDate: new Date('2026-04-22') },
      { shipmentId: 'SHIP-4511', destination: 'Rajkot Cotton Mills', bales: 175, status: 'Pending', scheduledDate: new Date('2026-04-25') },
      { shipmentId: 'SHIP-4512', destination: 'Jaipur Textile Zone', bales: 130, status: 'Pending', scheduledDate: new Date('2026-04-28') },
    ];
    await Shipment.insertMany(shipmentsData);

    // Alerts
    const alertsData = [
      { type: 'danger',  message: 'Warehouse B humidity level exceeded 60% (currently 61%). Immediate action required to prevent bale damage.', source: 'Sensor', createdAt: new Date(Date.now() - 10 * 60000) },
      { type: 'warning', message: 'Forecast update: Heavy rain expected next week in the Vidarbha region. Protect exposed bales and check drainage.', source: 'Weather', createdAt: new Date(Date.now() - 2 * 3600000) },
      { type: 'info',    message: 'Shipment #SHIP-4502 to Ahmedabad Mills successfully loaded and dispatched. 350 bales.', source: 'Logistics', createdAt: new Date(Date.now() - 4 * 3600000) },
      { type: 'warning', message: 'BATCH-005 and BATCH-008 are critically low on stock (< 150 bales each). Consider restocking.', source: 'Inventory', createdAt: new Date(Date.now() - 6 * 3600000) },
      { type: 'success', message: 'AI Chatbot: Weekly inventory analysis complete. Premium grade stock at 85% capacity. All optimal.', source: 'AI', createdAt: new Date(Date.now() - 24 * 3600000) },
      { type: 'info',    message: 'Scheduled maintenance for Warehouse A conveyor system on April 5, 2026. Plan accordingly.', source: 'Maintenance', createdAt: new Date(Date.now() - 48 * 3600000) },
      { type: 'warning', message: 'Price fluctuation detected: Cotton spot price dropped 3.2% in MCX. Review pricing strategy.', source: 'Market', createdAt: new Date(Date.now() - 72 * 3600000) },
    ];
    await Alert.insertMany(alertsData);

    // Forecast data (last 12 months)
    const months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const forecastData = months.map((m, i) => ({
      month: m,
      year: i < 9 ? 2025 : 2026,
      predicted: 380 + Math.floor(Math.random() * 200),
      actual:    i < 11 ? 350 + Math.floor(Math.random() * 220) : null,
      rainfall:  Math.floor(Math.random() * 120),
      temperature: 22 + Math.floor(Math.random() * 12)
    }));
    await Forecast.insertMany(forecastData);

    // Yield history
    const yieldData = months.map((m, i) => ({
      month: m,
      year: i < 9 ? 2025 : 2026,
      bales: 300 + Math.floor(Math.random() * 500),
      grade: ['Premium','Standard','Economy'][i % 3]
    }));
    await Yield.insertMany(yieldData);

    console.log('✅ Database seeded successfully!');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

// ─── Static Page Routes ───────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({ client_id: process.env.GOOGLE_CLIENT_ID || '' });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    req.session.user = { email, name: email.split('@')[0] };
    return res.json({ success: true, redirect: '/dashboard' });
  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/login/google', (req, res) => {
  const { credential } = req.body;
  if (credential) {
    req.session.user = { email: 'manager@cottonmitra.com', name: 'Farm Manager', picture: null };
    return res.json({ success: true, redirect: '/dashboard' });
  }
  res.status(401).json({ success: false, message: 'Invalid Google token' });
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ success: true, user: req.session.user });
  }
  res.status(401).json({ success: false });
});

app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ─── Dashboard Overview ───────────────────────────────────────────────────────
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const inventory = await Inventory.find();
    const totalBales    = inventory.reduce((s, i) => s + i.bales, 0);
    const premiumBales  = inventory.filter(i => i.grade === 'Premium').reduce((s, i) => s + i.bales, 0);
    const premiumGrade  = totalBales > 0 ? Math.round((premiumBales / totalBales) * 100) : 0;
    const pendingShipments = await Shipment.countDocuments({ status: { $in: ['Pending', 'In Transit'] } });
    const lowStockCount = await Inventory.countDocuments({ status: 'Low Stock' });

    const recentAlerts = await Alert.find({ resolved: false })
      .sort({ createdAt: -1 }).limit(5);

    const yieldData = await Yield.find().sort({ year: 1 });

    res.json({
      total_bales: totalBales,
      premium_grade: premiumGrade,
      pending_shipments: pendingShipments,
      low_stock: lowStockCount,
      alerts: recentAlerts.map(a => ({
        type: a.type,
        message: a.message,
        time: timeAgo(a.createdAt),
        id: a._id
      })),
      yield_chart: yieldData.map(y => ({ month: y.month, year: y.year, bales: y.bales }))
    });
  } catch (err) {
    // Fallback demo data if MongoDB not connected
    res.json({
      total_bales: 4250,
      premium_grade: 85,
      pending_shipments: 12,
      low_stock: 3,
      alerts: [
        { type: 'danger',  message: 'Warehouse B humidity exceeded 60%. Action required.', time: '10 mins ago' },
        { type: 'warning', message: 'Heavy rain expected next week. Protect exposed bales.', time: '2 hours ago' },
        { type: 'info',    message: 'Shipment #SHIP-4502 successfully dispatched.', time: '4 hours ago' },
      ],
      yield_chart: [
        { month: 'Apr', year: 2025, bales: 410 },
        { month: 'May', year: 2025, bales: 395 },
        { month: 'Jun', year: 2025, bales: 460 },
        { month: 'Jul', year: 2025, bales: 520 },
        { month: 'Aug', year: 2025, bales: 545 },
        { month: 'Sep', year: 2025, bales: 510 },
        { month: 'Oct', year: 2025, bales: 505 },
        { month: 'Nov', year: 2025, bales: 465 },
        { month: 'Dec', year: 2025, bales: 425 },
        { month: 'Jan', year: 2026, bales: 400 },
        { month: 'Feb', year: 2026, bales: 435 },
        { month: 'Mar', year: 2026, bales: 460 },
      ]
    });
  }
});

// ─── Demo Data (used when MongoDB unavailable) ────────────────────────────────
const DEMO_INVENTORY = [
  { _id:'d1', batchId:'BATCH-001', grade:'Premium',  bales:820, warehouse:'Warehouse A', location:'Section 1', status:'In Stock',  pricePerBale:1450, humidity:52 },
  { _id:'d2', batchId:'BATCH-002', grade:'Premium',  bales:650, warehouse:'Warehouse A', location:'Section 2', status:'Reserved',  pricePerBale:1450, humidity:54 },
  { _id:'d3', batchId:'BATCH-003', grade:'Standard', bales:480, warehouse:'Warehouse B', location:'Section 1', status:'In Stock',  pricePerBale:1200, humidity:61 },
  { _id:'d4', batchId:'BATCH-004', grade:'Standard', bales:390, warehouse:'Warehouse B', location:'Section 2', status:'In Stock',  pricePerBale:1200, humidity:58 },
  { _id:'d5', batchId:'BATCH-005', grade:'Economy',  bales:120, warehouse:'Warehouse C', location:'Section 1', status:'Low Stock', pricePerBale:900,  humidity:57 },
  { _id:'d6', batchId:'BATCH-006', grade:'Premium',  bales:950, warehouse:'Warehouse A', location:'Section 3', status:'In Stock',  pricePerBale:1480, humidity:50 },
  { _id:'d7', batchId:'BATCH-007', grade:'Standard', bales:580, warehouse:'Warehouse C', location:'Section 2', status:'In Stock',  pricePerBale:1220, humidity:55 },
  { _id:'d8', batchId:'BATCH-008', grade:'Economy',  bales:90,  warehouse:'Warehouse C', location:'Section 3', status:'Low Stock', pricePerBale:880,  humidity:60 },
  { _id:'d9', batchId:'BATCH-009', grade:'Premium',  bales:760, warehouse:'Warehouse A', location:'Section 4', status:'Reserved',  pricePerBale:1460, humidity:51 },
  { _id:'d10',batchId:'BATCH-010', grade:'Standard', bales:210, warehouse:'Warehouse B', location:'Section 3', status:'Low Stock', pricePerBale:1180, humidity:59 },
];
const DEMO_SHIPMENTS = [
  { _id:'s1', shipmentId:'SHIP-4501', destination:'Mumbai Textile Hub',       bales:200, status:'Delivered',  scheduledDate:'2026-03-15', carrier:'AgriFreight Ltd' },
  { _id:'s2', shipmentId:'SHIP-4502', destination:'Ahmedabad Mills',          bales:350, status:'Delivered',  scheduledDate:'2026-03-28', carrier:'AgriFreight Ltd' },
  { _id:'s3', shipmentId:'SHIP-4503', destination:'Surat Yarn Factory',       bales:180, status:'In Transit', scheduledDate:'2026-04-05', carrier:'SpeedCargo Co.' },
  { _id:'s4', shipmentId:'SHIP-4504', destination:'Delhi Textile Market',     bales:420, status:'Pending',   scheduledDate:'2026-04-10', carrier:'AgriFreight Ltd' },
  { _id:'s5', shipmentId:'SHIP-4505', destination:'Coimbatore Spinning Mill', bales:310, status:'Pending',   scheduledDate:'2026-04-12', carrier:'FastTrack Logistics' },
  { _id:'s6', shipmentId:'SHIP-4506', destination:'Ludhiana Garment Cluster', bales:150, status:'Pending',   scheduledDate:'2026-04-15', carrier:'AgriFreight Ltd' },
  { _id:'s7', shipmentId:'SHIP-4507', destination:'Nagpur Cotton Exchange',   bales:280, status:'In Transit', scheduledDate:'2026-04-03', carrier:'SpeedCargo Co.' },
  { _id:'s8', shipmentId:'SHIP-4508', destination:'Pune Export Hub',          bales:500, status:'Pending',   scheduledDate:'2026-04-20', carrier:'AgriFreight Ltd' },
];
const DEMO_ALERTS = [
  { _id:'a1', type:'danger',  message:'Warehouse B humidity level exceeded 60% (currently 61%). Immediate action required.', source:'Sensor',      resolved:false, timeAgo:'10 mins ago' },
  { _id:'a2', type:'warning', message:'Heavy rain expected next week in Vidarbha region. Protect exposed bales and check drainage.', source:'Weather', resolved:false, timeAgo:'2 hours ago' },
  { _id:'a3', type:'info',    message:'Shipment #SHIP-4502 to Ahmedabad Mills dispatched. 350 bales.', source:'Logistics', resolved:false, timeAgo:'4 hours ago' },
  { _id:'a4', type:'warning', message:'BATCH-005 and BATCH-008 critically low (< 150 bales each). Consider restocking.', source:'Inventory', resolved:false, timeAgo:'6 hours ago' },
  { _id:'a5', type:'success', message:'Weekly inventory analysis complete. Premium grade stock at 85% capacity.', source:'AI',       resolved:false, timeAgo:'Yesterday' },
  { _id:'a6', type:'info',    message:'Scheduled maintenance for Warehouse A conveyor system on April 5, 2026.', source:'Maintenance', resolved:false, timeAgo:'2 days ago' },
  { _id:'a7', type:'warning', message:'Cotton spot price dropped 3.2% in MCX. Review pricing strategy.', source:'Market',    resolved:false, timeAgo:'3 days ago' },
];
const DEMO_FORECAST = [
  { month:'Apr', year:2025, predicted:420, actual:410, rainfall:45, temperature:28 },
  { month:'May', year:2025, predicted:380, actual:395, rainfall:62, temperature:31 },
  { month:'Jun', year:2025, predicted:440, actual:460, rainfall:110, temperature:29 },
  { month:'Jul', year:2025, predicted:500, actual:520, rainfall:145, temperature:26 },
  { month:'Aug', year:2025, predicted:560, actual:545, rainfall:130, temperature:25 },
  { month:'Sep', year:2025, predicted:530, actual:510, rainfall:90,  temperature:26 },
  { month:'Oct', year:2025, predicted:490, actual:505, rainfall:40,  temperature:28 },
  { month:'Nov', year:2025, predicted:450, actual:465, rainfall:15,  temperature:24 },
  { month:'Dec', year:2025, predicted:410, actual:425, rainfall:8,   temperature:21 },
  { month:'Jan', year:2026, predicted:390, actual:400, rainfall:5,   temperature:19 },
  { month:'Feb', year:2026, predicted:420, actual:435, rainfall:10,  temperature:22 },
  { month:'Mar', year:2026, predicted:460, actual:null,rainfall:25,  temperature:26 },
];

// ─── Inventory Routes ─────────────────────────────────────────────────────────
app.get('/api/inventory', requireAuth, async (req, res) => {
  try {
    if (!isDbConnected) {
      const { grade, status, warehouse, search, page = 1, limit = 8 } = req.query;
      let items = [...DEMO_INVENTORY];
      if (grade)     items = items.filter(i => i.grade === grade);
      if (status)    items = items.filter(i => i.status === status);
      if (warehouse) items = items.filter(i => i.warehouse === warehouse);
      if (search)    items = items.filter(i => i.batchId.toLowerCase().includes(search.toLowerCase()) || i.location.toLowerCase().includes(search.toLowerCase()));
      const total = items.length;
      const pg = parseInt(page); const lm = parseInt(limit);
      const paged = items.slice((pg-1)*lm, pg*lm);
      return res.json({ success:true, data:paged, total, page:pg, pages:Math.ceil(total/lm) });
    }
    const { grade, status, warehouse, search, page = 1, limit = 8 } = req.query;
    const filter = {};
    if (grade)     filter.grade = grade;
    if (status)    filter.status = status;
    if (warehouse) filter.warehouse = warehouse;
    if (search)    filter.$or = [{ batchId:{$regex:search,$options:'i'} },{ location:{$regex:search,$options:'i'} }];
    const total = await Inventory.countDocuments(filter);
    const items = await Inventory.find(filter).sort({addedAt:-1}).skip((page-1)*limit).limit(parseInt(limit));
    res.json({ success:true, data:items, total, page:parseInt(page), pages:Math.ceil(total/limit) });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
});

app.post('/api/inventory', requireAuth, async (req, res) => {
  try {
    const item = new Inventory(req.body);
    await item.save();

    // Auto-create alert if low stock
    if (item.bales < 150) {
      await Alert.create({
        type: 'warning',
        message: `New batch ${item.batchId} added with low stock (${item.bales} bales). Consider restocking.`,
        source: 'Inventory'
      });
    }

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/inventory/:id', requireAuth, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/inventory/:id', requireAuth, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/inventory/summary', requireAuth, async (req, res) => {
  try {
    const summary = await Inventory.aggregate([
      { $group: {
          _id: '$grade',
          totalBales: { $sum: '$bales' },
          count: { $sum: 1 },
          avgHumidity: { $avg: '$humidity' }
      }}
    ]);
    const warehouseSummary = await Inventory.aggregate([
      { $group: {
          _id: '$warehouse',
          totalBales: { $sum: '$bales' },
          count: { $sum: 1 }
      }}
    ]);
    res.json({ success: true, byGrade: summary, byWarehouse: warehouseSummary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Shipments Routes ─────────────────────────────────────────────────────────
app.get('/api/shipments', requireAuth, async (req, res) => {
  try {
    if (!isDbConnected) {
      const { status } = req.query;
      const items = status ? DEMO_SHIPMENTS.filter(s => s.status === status) : DEMO_SHIPMENTS;
      return res.json({ success:true, data:items });
    }
    const { status } = req.query;
    const filter = status ? { status } : {};
    const shipments = await Shipment.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: shipments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/shipments', requireAuth, async (req, res) => {
  try {
    if (!isDbConnected) {
      const s = { _id:'s'+Date.now(), ...req.body };
      DEMO_SHIPMENTS.push(s);
      return res.status(201).json({ success:true, data:s });
    }
    const shipment = new Shipment(req.body);
    await shipment.save();
    await Alert.create({ type:'info', message:`New shipment ${shipment.shipmentId} to ${shipment.destination} scheduled.`, source:'Logistics' });
    res.status(201).json({ success: true, data: shipment });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/shipments/:id', requireAuth, async (req, res) => {
  try {
    if (!isDbConnected) {
      const idx = DEMO_SHIPMENTS.findIndex(s => s._id === req.params.id);
      if (idx > -1) DEMO_SHIPMENTS[idx] = { ...DEMO_SHIPMENTS[idx], ...req.body };
      return res.json({ success:true, data:DEMO_SHIPMENTS[idx] || {} });
    }
    const shipment = await Shipment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!shipment) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.body.status === 'Delivered') {
      await Alert.create({ type:'success', message:`Shipment ${shipment.shipmentId} delivered (${shipment.bales} bales).`, source:'Logistics' });
    }
    res.json({ success: true, data: shipment });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Forecast Routes (ML-powered) ─────────────────────────────────────────────
app.get('/api/forecast', requireAuth, async (req, res) => {
  try {
    // Try to get ML predictions from the Python microservice
    const mlRes = await axios.get(`${ML_SERVER_URL}/ml/forecast`, { timeout: 15000 });
    const mlData = mlRes.data;

    if (mlData.success && mlData.results && mlData.results.length > 0) {
      const results = mlData.results;
      const trend   = mlData.trend;

      // Split actuals and forecasts
      const actuals   = results.filter(r => r.type === 'Actual');
      const forecasts = results.filter(r => r.type === 'Forecast');

      // Compute insights from ML data
      const actualValues = actuals.map(a => a.value);
      const avgValue = actualValues.length
        ? parseFloat((actualValues.reduce((s,v) => s+v, 0) / actualValues.length).toFixed(2))
        : 0;
      const forecastValues = forecasts.map(f => f.value);
      const totalProjected = parseFloat(forecastValues.reduce((s,v) => s+v, 0).toFixed(2));
      const bestActual = actuals.reduce((b, a) => a.value > b.value ? a : b, actuals[0] || {});

      return res.json({
        success: true,
        mlPowered: true,
        results,
        trend,
        insights: {
          avgConsumption:    avgValue,
          trend:             trend > 0 ? 'upward' : trend < 0 ? 'downward' : 'stable',
          trendValue:        trend,
          totalProjected:    totalProjected,
          bestMonth:         bestActual.month || '—',
          bestValue:         bestActual.value || 0,
          nextMonthForecast: forecasts[0] ? forecasts[0].value : 0,
          modelType:         'RandomForest (scikit-learn)'
        }
      });
    }
    throw new Error('ML service returned empty results');
  } catch (mlErr) {
    // Fallback to demo/DB data if ML server is unavailable
    console.log('⚠️  ML server unavailable, using fallback data:', mlErr.message);
    try {
      const forecasts = isDbConnected ? await Forecast.find().sort({ year:1 }) : DEMO_FORECAST;
      const actuals = forecasts.filter(f => f.actual !== null).map(f => f.actual);
      const avgYield = actuals.length ? Math.round(actuals.reduce((s,v)=>s+v,0)/actuals.length) : 450;
      const nextMonths = ['Apr','May','Jun'].map(month => ({ month, year:2026, predicted:avgYield+Math.floor(Math.random()*80)-40, actual:null, isForecast:true }));
      const best = forecasts.reduce((b,f) => (f.actual||0) > (b.actual||0) ? f : b, {});
      res.json({
        success: true,
        mlPowered: false,
        historical: forecasts,
        upcoming: nextMonths,
        insights: {
          avgMonthlyYield: avgYield,
          trend: actuals.length>2 ? (actuals[actuals.length-1]>actuals[actuals.length-2]?'upward':'downward') : 'stable',
          bestMonth: best,
          totalProjectedQ2: nextMonths.reduce((s,m)=>s+m.predicted,0)
        }
      });
    } catch (err) {
      res.status(500).json({ success:false, message:err.message });
    }
  }
});

// ─── Alerts Routes ────────────────────────────────────────────────────────────
app.get('/api/alerts', requireAuth, async (req, res) => {
  try {
    if (!isDbConnected) {
      const { resolved, type } = req.query;
      let items = [...DEMO_ALERTS];
      if (resolved !== undefined) items = items.filter(a => String(a.resolved) === resolved);
      if (type) items = items.filter(a => a.type === type);
      return res.json({ success:true, data:items, unreadCount:DEMO_ALERTS.filter(a=>!a.resolved).length });
    }
    const { resolved, type } = req.query;
    const filter = {};
    if (resolved !== undefined) filter.resolved = resolved === 'true';
    if (type) filter.type = type;
    const alerts = await Alert.find(filter).sort({ createdAt:-1 });
    const unreadCount = await Alert.countDocuments({ resolved:false });
    res.json({ success:true, data:alerts.map(a=>({...a.toObject(),timeAgo:timeAgo(a.createdAt)})), unreadCount });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
});

app.put('/api/alerts/resolve-all', requireAuth, async (req, res) => {
  try {
    if (!isDbConnected) { DEMO_ALERTS.forEach(a=>a.resolved=true); return res.json({success:true}); }
    await Alert.updateMany({ resolved:false }, { resolved:true });
    res.json({ success:true, message:'All alerts resolved' });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
});

app.put('/api/alerts/:id/resolve', requireAuth, async (req, res) => {
  try {
    if (!isDbConnected) {
      const a = DEMO_ALERTS.find(a=>a._id===req.params.id);
      if (a) a.resolved = true;
      return res.json({ success:true, data:a||{} });
    }
    const alert = await Alert.findByIdAndUpdate(req.params.id, { resolved:true }, { new:true });
    if (!alert) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, data:alert });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
});

app.post('/api/alerts', requireAuth, async (req, res) => {
  try {
    if (!isDbConnected) {
      const a = { _id:'a'+Date.now(), ...req.body, resolved:false, timeAgo:'Just now' };
      DEMO_ALERTS.unshift(a);
      return res.status(201).json({ success:true, data:a });
    }
    const alert = new Alert(req.body);
    await alert.save();
    res.status(201).json({ success:true, data:alert });
  } catch (err) {
    res.status(400).json({ success:false, message:err.message });
  }
});

// ─── Chatbot Route ────────────────────────────────────────────────────────────
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) return res.status(400).json({ success:false, message:'Message and sessionId required' });

    // Use demo or real DB context
    const inventory  = isDbConnected ? await Inventory.find() : DEMO_INVENTORY;
    const alerts     = isDbConnected ? await Alert.find({ resolved:false }).limit(5) : DEMO_ALERTS.filter(a=>!a.resolved);
    const shipments  = isDbConnected ? await Shipment.find({ status:{$in:['Pending','In Transit']} }) : DEMO_SHIPMENTS.filter(s=>['Pending','In Transit'].includes(s.status));
    const forecasts  = isDbConnected ? await Forecast.find().sort({year:1}) : DEMO_FORECAST;

    const totalBales    = inventory.reduce((s,i)=>s+i.bales,0);
    const premiumBales  = inventory.filter(i=>i.grade==='Premium').reduce((s,i)=>s+i.bales,0);
    const lowStockItems = inventory.filter(i=>i.status==='Low Stock');

    const reply = generateAIResponse(message, { totalBales, premiumBales, lowStockItems, pendingShipments:shipments.length, activeAlerts:alerts.length, forecasts });

    if (isDbConnected) {
      await Chat.create({ sessionId, role:'user', content:message });
      await Chat.create({ sessionId, role:'assistant', content:reply });
    }

    res.json({ success:true, reply, sessionId });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
});

app.get('/api/chat/history/:sessionId', requireAuth, async (req, res) => {
  try {
    if (!isDbConnected) return res.json({ success:true, data:[] });
    const history = await Chat.find({ sessionId:req.params.sessionId }).sort({createdAt:1}).limit(50);
    res.json({ success:true, data:history });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
});

// ─── AI Response Generator ────────────────────────────────────────────────────
function generateAIResponse(message, ctx) {
  const msg = message.toLowerCase();
  const { totalBales, premiumBales, lowStockItems, pendingShipments, activeAlerts, forecasts } = ctx;
  const premiumPct = totalBales > 0 ? Math.round((premiumBales / totalBales) * 100) : 0;

  // Inventory queries
  if (msg.includes('total') && (msg.includes('bale') || msg.includes('stock') || msg.includes('inventory'))) {
    return `📦 **Current Inventory Status:**\n\nYou have **${totalBales.toLocaleString()} bales** in total across all warehouses.\n- **Premium Grade:** ${premiumBales.toLocaleString()} bales (${premiumPct}%)\n- **Standard & Economy:** ${(totalBales - premiumBales).toLocaleString()} bales\n${lowStockItems.length > 0 ? `\n⚠️ **Low Stock Alert:** ${lowStockItems.length} batch(es) need restocking (${lowStockItems.map(i => i.batchId).join(', ')}).` : '\n✅ All stock levels are healthy.'}`;
  }

  if (msg.includes('low stock') || msg.includes('restock')) {
    if (lowStockItems.length === 0) return '✅ **Great news!** No inventory items are currently at low stock levels. All batches are well-stocked.';
    return `⚠️ **Low Stock Items (${lowStockItems.length}):**\n\n${lowStockItems.map(i => `• **${i.batchId}** — ${i.bales} bales (${i.grade}, ${i.warehouse})`).join('\n')}\n\n**Recommendation:** Initiate harvest processing or purchase orders for these batches to maintain supply continuity.`;
  }

  if (msg.includes('premium') || msg.includes('grade')) {
    return `✨ **Premium Grade Analysis:**\n\nPremium cotton constitutes **${premiumPct}%** of your total inventory (${premiumBales.toLocaleString()} of ${totalBales.toLocaleString()} bales).\n\n${premiumPct >= 80 ? '🌟 Excellent! Maintaining >80% premium ratio positions you at the top tier of the market.' : premiumPct >= 60 ? '👍 Good ratio, but there\'s room to improve processing quality.' : '📊 Consider reviewing harvest and processing techniques to improve grade distribution.'}`;
  }

  // Shipment queries
  if (msg.includes('shipment') || msg.includes('dispatch') || msg.includes('delivery')) {
    return `🚚 **Shipment Overview:**\n\nYou have **${pendingShipments} active shipment(s)** (Pending or In Transit).\n\nTo manage shipments, head to the **Inventory Management** section and click on the **Shipments** tab. You can track, update status, and create new shipment orders there.`;
  }

  // Alert queries
  if (msg.includes('alert') || msg.includes('warn') || msg.includes('danger')) {
    if (activeAlerts === 0) return '✅ **All Clear!** There are no active unresolved alerts at this time.';
    return `🔔 **Active Alerts: ${activeAlerts}**\n\nYou have ${activeAlerts} unresolved alert(s) requiring attention. Visit the **Alerts** section from the sidebar to review and resolve them.\n\nCommon alert types:\n• 🔴 **Danger** — Immediate action required (e.g., humidity spikes)\n• 🟡 **Warning** — Monitor closely (e.g., weather, low stock)\n• 🔵 **Info** — Informational updates`;
  }

  // Forecast queries
  if (msg.includes('forecast') || msg.includes('predict') || msg.includes('next month') || msg.includes('future')) {
    const actuals = forecasts.filter(f => f.actual !== null);
    const avg = actuals.length ? Math.round(actuals.reduce((s, f) => s + f.actual, 0) / actuals.length) : 450;
    return `📈 **Yield Forecast:**\n\nBased on historical data analysis:\n- **Average Monthly Yield:** ~${avg} bales\n- **Q2 2026 Projection:** ~${avg * 3} bales (3-month estimate)\n- **Trend:** ${avg > 400 ? '📗 Upward — favorable growing conditions' : '📘 Stable — consistent performance'}\n\nVisit the **Forecast** section for detailed monthly charts with rainfall and temperature correlations.`;
  }

  // Humidity / warehouse queries
  if (msg.includes('humidity') || msg.includes('warehouse') || msg.includes('storage')) {
    return `🏭 **Warehouse Conditions:**\n\nCurrent storage overview:\n- **Warehouse A:** Optimal humidity (50-54%) — Premium stock secured\n- **Warehouse B:** ⚠️ Elevated humidity (58-61%) — Monitor closely\n- **Warehouse C:** Normal humidity (55-60%)\n\n**Recommendation:** Activate dehumidifiers in Warehouse B immediately. Optimal cotton storage requires humidity below 55% to prevent mold and fiber degradation.`;
  }

  // Price queries
  if (msg.includes('price') || msg.includes('value') || msg.includes('revenue') || msg.includes('money')) {
    const totalValue = 1450 * (premiumBales) + 1200 * (totalBales - premiumBales) * 0.7;
    return `💰 **Inventory Valuation:**\n\nEstimated current inventory value:\n- **Premium Grade:** ₹1,450/bale × ${premiumBales.toLocaleString()} bales = ₹${(1450 * premiumBales).toLocaleString()}\n- **Standard/Economy:** Average ₹1,100/bale\n- **Total Estimated Value:** ₹${Math.round(totalValue).toLocaleString()}\n\n*Note: Prices are based on current MCX spot rates. Market fluctuations may apply.*`;
  }

  // Help / greeting
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('help')) {
    return `👋 **Hello! I'm your Cotton Mitra AI Assistant.**\n\nI can help you with:\n\n📦 **Inventory** — Total stock, grades, low stock alerts\n🚚 **Shipments** — Pending/delivered shipment status\n📈 **Forecast** — Monthly yield predictions & trends\n🔔 **Alerts** — Active warnings and their status\n💰 **Valuations** — Estimated inventory value\n🏭 **Warehouses** — Humidity, temperature, storage conditions\n\nJust ask me anything about your cotton operations!`;
  }

  if (msg.includes('thank') || msg.includes('thanks')) {
    return `😊 You're welcome! I'm always here to help you manage your Cotton Mitra operations more efficiently. Is there anything else you'd like to know?`;
  }

  // Default response
  return `🤖 I understand you're asking about "${message}".\n\nI'm specialized in Cotton Mitra operations. Here's what I can help with:\n\n• *"What is my total inventory?"*\n• *"Show me low stock items"*\n• *"How many shipments are pending?"*\n• *"What's the forecast for next month?"*\n• *"Check warehouse humidity"*\n• *"What is my inventory value?"*\n\nTry rephrasing your question or type **"help"** for a full list of capabilities.`;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return `${seconds} secs ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString('en-IN');
}

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Cotton Mitra Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🔑 Login:     http://localhost:${PORT}/login\n`);
});

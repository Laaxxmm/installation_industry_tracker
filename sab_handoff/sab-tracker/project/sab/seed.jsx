// SAB India — seed data grounded in the real schema.
// Projects: fire systems, medical gas, AMC. Indian clients, ₹ values.

const SEED = {
  user: { name: 'Arvind Kumar', initials: 'AK', role: 'ADMIN' },
  fy: 'FY 25-26',

  kpis: {
    poValue: 142_60_00_000,       // 14.26 Cr
    billed:  71_40_00_000,        // 7.14 Cr (current FY)
    outstanding: 48_20_00_000,    // 4.82 Cr
    receivables: 32_80_00_000,    // 3.28 Cr
    poDelta: 12, billedDelta: 8, outstandingDelta: -4, receivablesDelta: 18,
  },

  monthlyBilling: [28, 41, 33, 52, 38, 61, 44, 72, 58, 65, 81, 74].map(v => v * 8_00_000),
  monthLabels: ['May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'],

  pnl: {
    revenue: 71_40_00_000,
    labor: 8_20_00_000,
    material: 29_60_00_000,
    other: 2_10_00_000,
    overhead: 5_40_00_000,
    contribution: 31_50_00_000,
    net: 26_10_00_000,
    marginPct: 36.5,
  },

  workStatus: [
    { k: 'In progress',   n: 48, pct: 29, pov: 52_00_00_000, tone:'blue' },
    { k: 'Material ready',n: 21, pct: 13, pov: 18_40_00_000, tone:'amber' },
    { k: 'Awaiting PO',   n: 17, pct: 10, pov: 12_60_00_000, tone:'ink' },
    { k: 'Commissioned',  n: 38, pct: 23, pov: 31_80_00_000, tone:'positive' },
    { k: 'Handover done', n: 29, pct: 18, pov: 22_20_00_000, tone:'positive' },
    { k: 'On hold',       n: 12, pct: 7,  pov: 5_60_00_000,  tone:'alert' },
  ],

  topClients: [
    { n:'Apollo Hospitals Enterprise Ltd',       pos: 14, pov: 18_40_00_000, billed: 12_60_00_000, out: 5_80_00_000 },
    { n:'Tata Consultancy Services',             pos: 9,  pov: 14_20_00_000, billed: 8_90_00_000,  out: 5_30_00_000 },
    { n:'Manipal Health Enterprises',            pos: 11, pov: 11_80_00_000, billed: 9_40_00_000,  out: 2_40_00_000 },
    { n:'Infosys Ltd — Electronic City Campus',  pos: 6,  pov: 9_60_00_000,  billed: 6_20_00_000,  out: 3_40_00_000 },
    { n:'Brigade Enterprises — Metropolis Mall', pos: 5,  pov: 7_80_00_000,  billed: 4_10_00_000,  out: 3_70_00_000 },
  ],

  actions: [
    { k:'POs with unbilled balance',       n: 23, money: 48_20_00_000, tone:'amber',  href:'needBill' },
    { k:'Invoices awaiting payment',       n: 14, money: 32_80_00_000, tone:'blue',   href:'issued' },
    { k:'POs awaiting your approval',      n:  4, money: 38_60_000,    tone:'amber',  href:'purchase-orders' },
    { k:'Vendor bills pending 3-way match',n:  3, money: 14_20_000,    tone:'alert',  href:'vendor-bills' },
    { k:'Payables overdue',                n:  2, money: 9_40_000,     tone:'alert',  href:'vendor-bills' },
    { k:'Timesheets pending approval',     n:  8, money: null,         tone:'amber',  href:'timesheets' },
    { k:'Projects missing PO date',        n:  3, money: null,         tone:'ink',    href:'missing' },
    { k:'Low-stock SKUs (<10 on hand)',    n:  6, money: null,         tone:'alert',  href:'lowstock' },
    { k:'Open punch entries (live)',       n:  4, money: null,         tone:'positive', href:'punch' },
  ],

  projects: [
    { code:'SAB-26-0041', name:'Fire hydrant system — Block A & B', client:'Apollo Hospitals Enterprise Ltd',     loc:'Bengaluru',   desc:'Fire Fighting', pov:2_40_00_000, billed:1_60_00_000, progress:72, status:'In progress',   wsTone:'blue',     pod:'12 Mar 26', sup:'R. Naidu' },
    { code:'SAB-26-0039', name:'Medical gas pipeline — Phase 2',    client:'Manipal Health Enterprises',         loc:'Mangaluru',   desc:'Medical Gas',   pov:1_80_00_000, billed:1_80_00_000, progress:100,status:'Commissioned', wsTone:'positive', pod:'04 Feb 26', sup:'S. Iyer' },
    { code:'SAB-26-0038', name:'Sprinkler retrofit — 14 floors',    client:'Brigade Enterprises — Metropolis',   loc:'Bengaluru',   desc:'Fire Fighting', pov:3_20_00_000, billed:1_20_00_000, progress:38, status:'In progress',   wsTone:'blue',     pod:'28 Jan 26', sup:'R. Naidu' },
    { code:'SAB-26-0036', name:'AMC — detection panel & cylinders', client:'Infosys Ltd — EC Campus',             loc:'Bengaluru',   desc:'AMC',           pov:92_50_000,    billed:46_25_000,   progress:50, status:'In progress',   wsTone:'blue',     pod:'15 Jan 26', sup:'K. Pillai' },
    { code:'SAB-26-0035', name:'Hydrant network — Tower 3',         client:'Prestige Estates',                    loc:'Chennai',     desc:'Fire Fighting', pov:1_40_00_000, billed:0,           progress:8,  status:'Material ready',wsTone:'amber',    pod:'02 Jan 26', sup:'M. Varma' },
    { code:'SAB-25-0204', name:'MGPS — new OT complex',              client:'Apollo Hospitals Enterprise Ltd',     loc:'Hyderabad',   desc:'Medical Gas',   pov:2_80_00_000, billed:2_80_00_000, progress:100,status:'Handover done', wsTone:'positive', pod:'22 Nov 25', sup:'S. Iyer' },
    { code:'SAB-25-0198', name:'Fire alarm — data centre retrofit', client:'Tata Consultancy Services',            loc:'Pune',        desc:'Fire Fighting', pov:4_20_00_000, billed:3_20_00_000, progress:84, status:'In progress',   wsTone:'blue',     pod:'05 Nov 25', sup:'R. Naidu' },
    { code:'SAB-25-0194', name:'Kitchen suppression — 6 outlets',   client:'ITC Hotels — Welcomhotel',            loc:'Bengaluru',   desc:'Fire Fighting', pov:64_00_000,    billed:0,           progress:0,  status:'Awaiting PO',   wsTone:'ink',      pod:'—',         sup:'—' },
    { code:'SAB-25-0191', name:'Gas manifold replacement',           client:'Manipal Health Enterprises',          loc:'Bengaluru',   desc:'Medical Gas',   pov:1_10_00_000, billed:88_00_000,   progress:80, status:'In progress',   wsTone:'blue',     pod:'18 Oct 25', sup:'K. Pillai' },
    { code:'SAB-25-0188', name:'Hydrant — phase 1 commissioning',    client:'DLF Ltd',                             loc:'Gurugram',    desc:'Fire Fighting', pov:2_10_00_000, billed:1_68_00_000, progress:95, status:'Commissioned',  wsTone:'positive', pod:'01 Oct 25', sup:'M. Varma' },
    { code:'SAB-25-0184', name:'AMC — annual refill & testing',      client:'Wipro Technologies',                  loc:'Bengaluru',   desc:'AMC',           pov:48_00_000,    billed:12_00_000,   progress:25, status:'In progress',   wsTone:'blue',     pod:'12 Sep 25', sup:'K. Pillai' },
    { code:'SAB-25-0179', name:'Fire pump room — complete fitout',   client:'Godrej Properties',                   loc:'Mumbai',      desc:'Fire Fighting', pov:5_40_00_000, billed:2_70_00_000, progress:55, status:'On hold',       wsTone:'alert',    pod:'28 Aug 25', sup:'R. Naidu' },
  ],

  invoices: [
    { no:'SAB/26-27/0042', kind:'PROGRESS', client:'Apollo Hospitals',       pc:'SAB-26-0041', amt:48_20_000, status:'ISSUED',  issuedAt:'18 Apr 26', due:'18 May 26' },
    { no:'SAB/26-27/0041', kind:'ADVANCE',  client:'Manipal Health',         pc:'SAB-26-0039', amt:36_00_000, status:'PAID',    issuedAt:'12 Apr 26', due:'—' },
    { no:'SAB/26-27/0040', kind:'PROGRESS', client:'Brigade Metropolis',     pc:'SAB-26-0038', amt:1_20_00_000, status:'ISSUED',issuedAt:'08 Apr 26', due:'08 May 26' },
    { no:'SAB/26-27/0039', kind:'FINAL',    client:'Apollo Hospitals',       pc:'SAB-25-0204', amt:84_00_000, status:'PAID',    issuedAt:'04 Apr 26', due:'—' },
    { no:'SAB/26-27/0038', kind:'PROGRESS', client:'Infosys Ltd',            pc:'SAB-26-0036', amt:46_25_000, status:'ISSUED',  issuedAt:'02 Apr 26', due:'02 May 26' },
    { no:'SAB/26-27/0037', kind:'ADHOC',    client:'Tata Consultancy',       pc:'SAB-25-0198', amt:22_10_000, status:'DRAFT',   issuedAt:'—',         due:'—' },
    { no:'SAB/26-27/0036', kind:'PROGRESS', client:'DLF Ltd',                pc:'SAB-25-0188', amt:42_00_000, status:'PAID',    issuedAt:'28 Mar 26', due:'—' },
    { no:'SAB/26-27/0035', kind:'PROGRESS', client:'Wipro Technologies',     pc:'SAB-25-0184', amt:12_00_000, status:'ISSUED',  issuedAt:'22 Mar 26', due:'22 Apr 26' },
  ],

  quotes: [
    { no:'Q/26-27/021', title:'Fire hydrant — Tower 4 & 5',       client:'Brigade Enterprises',   status:'NEGOTIATING', amt:4_80_00_000, valid:'12 May 26' },
    { no:'Q/26-27/020', title:'MGPS — paediatric wing',            client:'Apollo Hospitals',      status:'SENT',        amt:2_20_00_000, valid:'08 May 26' },
    { no:'Q/26-27/019', title:'AMC — annual contract renewal',     client:'Infosys Ltd',           status:'ACCEPTED',    amt:96_00_000,  valid:'06 May 26' },
    { no:'Q/26-27/018', title:'Sprinkler — data hall expansion',   client:'Tata Consultancy',      status:'CHANGES_REQUESTED', amt:3_40_00_000, valid:'04 May 26' },
    { no:'Q/26-27/017', title:'Kitchen suppression system',        client:'ITC Hotels',            status:'SENT',        amt:64_00_000,   valid:'02 May 26' },
    { no:'Q/26-27/016', title:'Fire alarm — admin block',          client:'Manipal Hospitals',     status:'DRAFT',       amt:1_80_00_000, valid:'—' },
    { no:'Q/26-27/015', title:'Gas manifold replacement — Ph 2',   client:'Manipal Health',        status:'CONVERTED',   amt:1_10_00_000, valid:'—' },
    { no:'Q/26-27/014', title:'Pump room fitout',                  client:'Godrej Properties',     status:'LOST',        amt:5_40_00_000, valid:'—' },
  ],

  inventory: [
    { sku:'FH-150-MS',  name:'MS hydrant valve, 150mm',         unit:'nos', onHand: 42,   cost: 8_200,   val: 3_44_400 },
    { sku:'MGP-CU-28',  name:'Copper pipe, 28mm medical grade', unit:'mtr', onHand: 1_240,cost: 680,     val: 8_43_200 },
    { sku:'SPR-UP-80',  name:'Upright sprinkler, 80°C',         unit:'nos', onHand: 380,  cost: 420,     val: 1_59_600 },
    { sku:'CYL-CO2-6',  name:'CO₂ cylinder, 6 kg',              unit:'nos', onHand: 18,   cost: 12_400,  val: 2_23_200 },
    { sku:'ALM-PNL-8Z', name:'Addressable alarm panel, 8-zone', unit:'nos', onHand:  6,   cost: 68_000,  val: 4_08_000 },
    { sku:'DET-SMK-AP', name:'Smoke detector, addressable',     unit:'nos', onHand: 240,  cost: 1_850,   val: 4_44_000 },
    { sku:'MGP-OXY-VL', name:'O₂ line valve assembly',          unit:'nos', onHand:  4,   cost: 28_400,  val: 1_13_600, low:true },
    { sku:'HSE-FH-30',  name:'Hose, canvas, 30 mtr',            unit:'nos', onHand: 64,   cost: 4_200,   val: 2_68_800 },
    { sku:'GAS-PNL-4',  name:'MGPS area alarm panel, 4-gas',    unit:'nos', onHand:  8,   cost: 92_000,  val: 7_36_000, low:true },
  ],

  timesheets: [
    { emp:'Rakesh Naidu',   pc:'SAB-26-0041', clockIn:'07:52', clockOut:'17:34', hrs:'9h 42m', status:'SUBMITTED', photos:3, loc:'12.9716, 77.5946' },
    { emp:'Suresh Iyer',    pc:'SAB-26-0039', clockIn:'08:04', clockOut:'16:48', hrs:'8h 44m', status:'SUBMITTED', photos:5, loc:'12.8695, 74.8420' },
    { emp:'K. Pillai',      pc:'SAB-26-0036', clockIn:'09:10', clockOut:'—',     hrs:'4h 18m · live', status:'OPEN', photos:0, loc:'12.8458, 77.6603' },
    { emp:'Manoj Varma',    pc:'SAB-26-0038', clockIn:'07:40', clockOut:'17:22', hrs:'9h 42m', status:'APPROVED',  photos:4, loc:'12.9784, 77.6408' },
    { emp:'Rahul Kumar',    pc:'SAB-25-0198', clockIn:'08:20', clockOut:'18:05', hrs:'9h 45m', status:'SUBMITTED', photos:6, loc:'18.5204, 73.8567' },
    { emp:'Anil Deshmukh',  pc:'SAB-25-0179', clockIn:'07:30', clockOut:'16:15', hrs:'8h 45m', status:'REJECTED',  photos:2, loc:'19.0760, 72.8777' },
    { emp:'Prakash Rao',    pc:'SAB-26-0041', clockIn:'08:00', clockOut:'17:10', hrs:'9h 10m', status:'APPROVED',  photos:3, loc:'12.9716, 77.5946' },
    { emp:'Joseph M.',      pc:'SAB-25-0188', clockIn:'07:48', clockOut:'17:02', hrs:'9h 14m', status:'APPROVED',  photos:4, loc:'28.4595, 77.0266' },
  ],

  projectDetail: {
    code: 'SAB-26-0041',
    name: 'Fire hydrant system — Block A & B',
    client: 'Apollo Hospitals Enterprise Ltd',
    loc: 'Marathahalli, Bengaluru',
    pov: 2_40_00_000,
    billed: 1_60_00_000,
    outstanding: 80_00_000,
    progress: 72,
    status: 'In progress',
    supervisor: 'Rakesh Naidu',
    start: '12 Mar 26', end: '30 Jun 26',
    po: 'APL/PO/26/0847', poDate: '12 Mar 26',
    stages: [
      { k:'Survey',     status:'done', pct:100, start:'12 Mar', end:'20 Mar' },
      { k:'Delivery',   status:'done', pct:100, start:'22 Mar', end:'04 Apr' },
      { k:'Install',    status:'now',  pct: 65, start:'05 Apr', end:'24 May' },
      { k:'Commission', status:'next', pct:  0, start:'25 May', end:'10 Jun' },
      { k:'Handover',   status:'next', pct:  0, start:'11 Jun', end:'30 Jun' },
    ],
    pnl: { revenue: 1_60_00_000, labor: 18_40_000, material: 72_80_000, other: 4_20_000, overhead: 8_00_000, contribution: 64_60_000, net: 56_60_000, marginPct: 35.4 },
    ledger: [
      { d:'18 Apr 26', k:'Invoice',   desc:'Progress invoice #0042', amt: 48_20_000, tone:'positive' },
      { d:'15 Apr 26', k:'Stock issue', desc:'150mm MS valve × 12',   amt: -98_400,  tone:'alert' },
      { d:'14 Apr 26', k:'Timesheet', desc:'R. Naidu, 9h 42m',       amt: -6_800,   tone:'alert' },
      { d:'10 Apr 26', k:'Purchase',  desc:'Direct — pipe fittings',  amt: -1_82_000,tone:'alert' },
      { d:'08 Apr 26', k:'Transfer',  desc:'From SAB-26-0038: 45m hose', amt: 0,    tone:'ink' },
      { d:'02 Apr 26', k:'Invoice',   desc:'Progress invoice #0038',  amt: 1_12_00_000, tone:'positive' },
      { d:'28 Mar 26', k:'Stock issue', desc:'Sprinkler 80° × 80',   amt: -33_600,  tone:'alert' },
      { d:'22 Mar 26', k:'Purchase',  desc:'Direct — welding consumables', amt:-24_800, tone:'alert' },
    ],
  },

  descriptions: ['All descriptions','Fire Fighting','Medical Gas','AMC','Detection','Suppression'],

  vendors: [
    { id:'V-1041', name:'Hindustan Pipes & Fittings',     gstin:'27ABCDE1234F1Z5', state:'Maharashtra',  msme:true,  category:'Pipes & valves',   contact:'Rohan Mehta',    phone:'+91 98201 14523', email:'rohan@hpfittings.in',  paymentTerms:'Net 30', creditLimit:25_00_000, outstanding:18_42_500, rating:4.6, onTimePct:92, lastSupplied:'12 Apr 26' },
    { id:'V-1042', name:'BharatFire Equipments Pvt Ltd',  gstin:'29AAACB7821H1ZP', state:'Karnataka',    msme:false, category:'Sprinklers & alarms', contact:'Latha Krishnan', phone:'+91 98450 22148', email:'sales@bharatfire.in', paymentTerms:'Net 45', creditLimit:40_00_000, outstanding:21_80_000, rating:4.4, onTimePct:88, lastSupplied:'18 Apr 26' },
    { id:'V-1043', name:'Indo Gas Cylinders Ltd',         gstin:'07AABCI4502L1Z3', state:'Delhi',        msme:false, category:'Gas cylinders & manifolds', contact:'Devansh Singh', phone:'+91 99110 06672', email:'orders@indogas.co.in', paymentTerms:'Net 30', creditLimit:30_00_000, outstanding:8_60_000,  rating:4.7, onTimePct:96, lastSupplied:'08 Apr 26' },
    { id:'V-1044', name:'Coimbatore Copper Works',        gstin:'33AABCC6671M2ZK', state:'Tamil Nadu',   msme:true,  category:'Medical-grade copper', contact:'Senthil Kumar', phone:'+91 99520 31109', email:'admin@coimcopper.in', paymentTerms:'Net 60', creditLimit:18_00_000, outstanding:6_24_000,  rating:4.2, onTimePct:84, lastSupplied:'02 Apr 26' },
    { id:'V-1045', name:'Pune Detection Systems',         gstin:'27AABCP4471Q1ZF', state:'Maharashtra',  msme:true,  category:'Detection panels',  contact:'Anjali Joshi',   phone:'+91 99220 11247', email:'anjali@punedet.in',   paymentTerms:'Net 30', creditLimit:12_00_000, outstanding:0,         rating:4.8, onTimePct:97, lastSupplied:'21 Apr 26' },
    { id:'V-1046', name:'Mumbai Hose & Fittings',         gstin:'27AABCM5512N1Z9', state:'Maharashtra',  msme:true,  category:'Hoses & couplings', contact:'Kiran Salunke',  phone:'+91 98330 04471', email:'sales@mhf.in',        paymentTerms:'Net 30', creditLimit:10_00_000, outstanding:3_18_000,  rating:4.3, onTimePct:90, lastSupplied:'16 Apr 26' },
    { id:'V-1047', name:'Gujarat Steel Tubes Ltd',        gstin:'24AAACG9921K1Z2', state:'Gujarat',      msme:false, category:'CS pipes',          contact:'Hetal Patel',    phone:'+91 98250 11320', email:'hetal@gstubes.in',    paymentTerms:'Net 45', creditLimit:50_00_000, outstanding:32_40_000, rating:4.1, onTimePct:80, lastSupplied:'11 Apr 26' },
    { id:'V-1048', name:'Hyderabad Welding Supplies',     gstin:'36AABCH8801R1ZB', state:'Telangana',    msme:true,  category:'Consumables',       contact:'Pradeep Reddy',  phone:'+91 99480 17721', email:'pradeep@hws.in',      paymentTerms:'Net 15', creditLimit:6_00_000,  outstanding:1_20_000,  rating:4.5, onTimePct:94, lastSupplied:'19 Apr 26' },
    { id:'V-1049', name:'NCR Pumps & Motors',             gstin:'06AABCN2256E1ZT', state:'Haryana',      msme:false, category:'Pumps & motors',    contact:'Rajiv Khanna',   phone:'+91 98100 32214', email:'rajiv@ncrpumps.in',   paymentTerms:'Net 60', creditLimit:35_00_000, outstanding:14_80_000, rating:4.0, onTimePct:78, lastSupplied:'07 Apr 26' },
    { id:'V-1050', name:'South India Valves Co',          gstin:'29AABCS3398L1ZJ', state:'Karnataka',    msme:true,  category:'Specialty valves',  contact:'Meera Iyengar',  phone:'+91 99000 41128', email:'meera@sivalves.in',   paymentTerms:'Net 30', creditLimit:14_00_000, outstanding:0,         rating:4.6, onTimePct:93, lastSupplied:'20 Apr 26' },
  ],

  purchaseOrders: [
    { id:'SAB/PO/26/0118', vendorId:'V-1041', projectId:'SAB-26-0041', issueDate:'15 Apr 26', expectedDate:'25 Apr 26', status:'sent',                approvalTier:'pm',       approvedBy:'Anita Rao',  approvedAt:'15 Apr 26 10:22', subtotal:1_16_000,  gstAmount:20_880,  total:1_36_880,  receivedQty:0,  billedAmount:0,         lines:[{ sku:'PIPE-CS-150', desc:'150NB CS pipe SCH40',           qty:80,  uom:'m',   rate:1_450,  gstPct:18 }] },
    { id:'SAB/PO/26/0117', vendorId:'V-1042', projectId:'SAB-26-0038', issueDate:'12 Apr 26', expectedDate:'22 Apr 26', status:'partially-received',  approvalTier:'pm',       approvedBy:'Anita Rao',  approvedAt:'12 Apr 26 16:08', subtotal:3_42_000,  gstAmount:61_560,  total:4_03_560,  receivedQty:140, billedAmount:0,         lines:[{ sku:'SPR-UP-80',   desc:'Upright sprinkler 80°C',         qty:200, uom:'nos', rate:425,    gstPct:18 },{ sku:'ALM-PNL-8Z', desc:'Addressable alarm panel 8-zone', qty:4, uom:'nos', rate:64_000, gstPct:18 }] },
    { id:'SAB/PO/26/0116', vendorId:'V-1043', projectId:'SAB-26-0039', issueDate:'10 Apr 26', expectedDate:'18 Apr 26', status:'received',            approvalTier:'pm',       approvedBy:'Anita Rao',  approvedAt:'10 Apr 26 09:45', subtotal:2_48_000,  gstAmount:44_640,  total:2_92_640,  receivedQty:20, billedAmount:2_92_640,  lines:[{ sku:'CYL-CO2-6',   desc:'CO₂ cylinder 6 kg',              qty:20,  uom:'nos', rate:12_400, gstPct:18 }] },
    { id:'SAB/PO/26/0115', vendorId:'V-1047', projectId:'SAB-26-0035', issueDate:'08 Apr 26', expectedDate:'30 Apr 26', status:'pending-approval',    approvalTier:'director', approvedBy:null,         approvedAt:null,             subtotal:14_80_000, gstAmount:2_66_400, total:17_46_400, receivedQty:0,  billedAmount:0,         lines:[{ sku:'PIPE-CS-200', desc:'200NB CS pipe SCH40',           qty:600, uom:'m',   rate:2_466,  gstPct:18 }] },
    { id:'SAB/PO/26/0114', vendorId:'V-1049', projectId:'SAB-25-0179', issueDate:'05 Apr 26', expectedDate:'15 Apr 26', status:'pending-approval',    approvalTier:'director', approvedBy:null,         approvedAt:null,             subtotal:11_20_000, gstAmount:2_01_600, total:13_21_600, receivedQty:0,  billedAmount:0,         lines:[{ sku:'PUMP-FH-450', desc:'Fire pump, 450LPM, 8.8 bar',     qty:2,   uom:'nos', rate:5_60_000, gstPct:18 }] },
    { id:'SAB/PO/26/0113', vendorId:'V-1044', projectId:'SAB-25-0191', issueDate:'02 Apr 26', expectedDate:'20 Apr 26', status:'sent',                approvalTier:'pm',       approvedBy:'Anita Rao',  approvedAt:'02 Apr 26 11:15', subtotal:5_44_000,  gstAmount:97_920,  total:6_41_920,  receivedQty:0,  billedAmount:0,         lines:[{ sku:'MGP-CU-28',   desc:'Copper pipe 28mm medical grade', qty:800, uom:'m',   rate:680,    gstPct:18 }] },
    { id:'SAB/PO/26/0112', vendorId:'V-1045', projectId:'SAB-26-0036', issueDate:'30 Mar 26', expectedDate:'10 Apr 26', status:'received',            approvalTier:'pm',       approvedBy:'Anita Rao',  approvedAt:'30 Mar 26 14:05', subtotal:1_85_000,  gstAmount:33_300,  total:2_18_300,  receivedQty:100, billedAmount:2_18_300, lines:[{ sku:'DET-SMK-AP', desc:'Smoke detector addressable',     qty:100, uom:'nos', rate:1_850,  gstPct:18 }] },
    { id:'SAB/PO/26/0111', vendorId:'V-1046', projectId:'SAB-26-0041', issueDate:'28 Mar 26', expectedDate:'08 Apr 26', status:'received',            approvalTier:'auto',     approvedBy:null,         approvedAt:'28 Mar 26 10:00', subtotal:84_000,    gstAmount:15_120,  total:99_120,    receivedQty:20, billedAmount:99_120,    lines:[{ sku:'HSE-FH-30',   desc:'Hose canvas 30 mtr',             qty:20,  uom:'nos', rate:4_200,  gstPct:18 }] },
    { id:'SAB/PO/26/0110', vendorId:'V-1041', projectId:'SAB-26-0038', issueDate:'25 Mar 26', expectedDate:'05 Apr 26', status:'closed',              approvalTier:'pm',       approvedBy:'Anita Rao',  approvedAt:'25 Mar 26 09:20', subtotal:2_92_000,  gstAmount:52_560,  total:3_44_560,  receivedQty:200, billedAmount:3_44_560, lines:[{ sku:'PIPE-CS-100', desc:'100NB CS pipe SCH40',           qty:200, uom:'m',   rate:1_460,  gstPct:18 }] },
    { id:'SAB/PO/26/0109', vendorId:'V-1048', projectId:'SAB-26-0041', issueDate:'22 Mar 26', expectedDate:'27 Mar 26', status:'pending-approval',    approvalTier:'auto',     approvedBy:null,         approvedAt:null,             subtotal:42_000,    gstAmount:7_560,   total:49_560,    receivedQty:0,  billedAmount:0,         lines:[{ sku:'WLD-ROD-3.2', desc:'Welding rod E7018, 3.2mm',       qty:60,  uom:'kg',  rate:700,    gstPct:18 }] },
  ],

  grns: [
    { id:'SAB/GRN/26/0091', poId:'SAB/PO/26/0117', vendorId:'V-1042', receivedDate:'19 Apr 26', receivedBy:'Site Eng. — R. Naidu',  status:'partially-accepted', vehicleNo:'KA-03 LL 2247', invoiceRef:'BFE/INV/26/3318', lines:[{ sku:'SPR-UP-80', orderedQty:200, receivedQty:200, acceptedQty:200, rejectedQty:0, remarks:'OK' },{ sku:'ALM-PNL-8Z', orderedQty:4, receivedQty:2, acceptedQty:2, rejectedQty:0, remarks:'2 panels in next dispatch' }] },
    { id:'SAB/GRN/26/0090', poId:'SAB/PO/26/0116', vendorId:'V-1043', receivedDate:'18 Apr 26', receivedBy:'Site Eng. — Vikram',    status:'accepted',           vehicleNo:'DL-08 CA 7711', invoiceRef:'IGC/INV/26/0942', lines:[{ sku:'CYL-CO2-6',  orderedQty:20,  receivedQty:20, acceptedQty:20, rejectedQty:0, remarks:'Hydro test certs filed' }] },
    { id:'SAB/GRN/26/0089', poId:'SAB/PO/26/0112', vendorId:'V-1045', receivedDate:'10 Apr 26', receivedBy:'Site Eng. — K. Pillai', status:'accepted',           vehicleNo:'MH-12 AT 9921', invoiceRef:'PDS/INV/26/2114', lines:[{ sku:'DET-SMK-AP', orderedQty:100, receivedQty:100, acceptedQty:100, rejectedQty:0, remarks:'OK' }] },
    { id:'SAB/GRN/26/0088', poId:'SAB/PO/26/0111', vendorId:'V-1046', receivedDate:'07 Apr 26', receivedBy:'Site Eng. — R. Naidu',  status:'partially-accepted', vehicleNo:'MH-12 KL 4521', invoiceRef:'MHF/INV/26/2241', lines:[{ sku:'HSE-FH-30',   orderedQty:20,  receivedQty:20, acceptedQty:18, rejectedQty:2, remarks:'2 hoses fail pressure test — vendor to credit' }] },
    { id:'SAB/GRN/26/0087', poId:'SAB/PO/26/0110', vendorId:'V-1041', receivedDate:'04 Apr 26', receivedBy:'Site Eng. — M. Varma',  status:'accepted',           vehicleNo:'MH-04 BB 3382', invoiceRef:'HPF/INV/26/2188', lines:[{ sku:'PIPE-CS-100', orderedQty:200, receivedQty:200, acceptedQty:200, rejectedQty:0, remarks:'OK' }] },
    { id:'SAB/GRN/26/0086', poId:'SAB/PO/26/0109', vendorId:'V-1048', receivedDate:'27 Mar 26', receivedBy:'Site Eng. — R. Naidu',  status:'rejected',           vehicleNo:'TS-09 EE 1107', invoiceRef:'HWS/INV/26/0775', lines:[{ sku:'WLD-ROD-3.2', orderedQty:60,  receivedQty:60, acceptedQty:0,  rejectedQty:60, remarks:'Wrong grade dispatched — full return' }] },
  ],

  vendorBills: [
    { id:'BILL-2026-0411', vendorId:'V-1042', poId:'SAB/PO/26/0117', grnId:'SAB/GRN/26/0091', vendorInvoice:'BFE/INV/26/3318', invoiceDate:'19 Apr 26', dueDate:'03 Jun 26', status:'discrepancy', matchResult:{ po:'ok', grn:'short-2 panels', amount:'over' }, subtotal:3_42_000, cgst:30_780, sgst:30_780, total:4_03_560, amountPaid:0 },
    { id:'BILL-2026-0410', vendorId:'V-1043', poId:'SAB/PO/26/0116', grnId:'SAB/GRN/26/0090', vendorInvoice:'IGC/INV/26/0942', invoiceDate:'18 Apr 26', dueDate:'18 May 26', status:'matched',     matchResult:{ po:'ok', grn:'ok', amount:'ok' },           subtotal:2_48_000, cgst:0,      sgst:0,      total:2_92_640, amountPaid:0,        igst:44_640 },
    { id:'BILL-2026-0409', vendorId:'V-1045', poId:'SAB/PO/26/0112', grnId:'SAB/GRN/26/0089', vendorInvoice:'PDS/INV/26/2114', invoiceDate:'10 Apr 26', dueDate:'10 May 26', status:'paid',        matchResult:{ po:'ok', grn:'ok', amount:'ok' },           subtotal:1_85_000, cgst:16_650, sgst:16_650, total:2_18_300, amountPaid:2_18_300 },
    { id:'BILL-2026-0408', vendorId:'V-1046', poId:'SAB/PO/26/0111', grnId:'SAB/GRN/26/0088', vendorInvoice:'MHF/INV/26/2241', invoiceDate:'08 Apr 26', dueDate:'08 May 26', status:'pending-match', matchResult:{ po:'ok', grn:'short-2', amount:'pending' },  subtotal:84_000,   cgst:7_560,  sgst:7_560,  total:99_120,   amountPaid:0 },
    { id:'BILL-2026-0407', vendorId:'V-1041', poId:'SAB/PO/26/0110', grnId:'SAB/GRN/26/0087', vendorInvoice:'HPF/INV/26/2188', invoiceDate:'04 Apr 26', dueDate:'04 May 26', status:'approved',    matchResult:{ po:'ok', grn:'ok', amount:'ok' },           subtotal:2_92_000, cgst:26_280, sgst:26_280, total:3_44_560, amountPaid:0 },
    { id:'BILL-2026-0406', vendorId:'V-1047', poId:null,             grnId:null,              vendorInvoice:'GST/INV/26/0998', invoiceDate:'02 Apr 26', dueDate:'17 Mar 26', status:'overdue',     matchResult:{ po:'no PO', grn:'no GRN', amount:'pending' },subtotal:6_20_000, cgst:0,      sgst:0,      total:7_31_600, amountPaid:0,        igst:1_11_600 },
    { id:'BILL-2026-0405', vendorId:'V-1049', poId:null,             grnId:null,              vendorInvoice:'NCR/INV/26/0241', invoiceDate:'28 Mar 26', dueDate:'12 Apr 26', status:'overdue',     matchResult:{ po:'no PO', grn:'no GRN', amount:'pending' },subtotal:1_80_000, cgst:0,      sgst:0,      total:2_12_400, amountPaid:0,        igst:32_400 },
  ],

  mrns: [],
  rfqs: [],

  roles: [
    { id:'admin',      label:'Admin',       desc:'Full system access — users, settings, all financials.',     userCount: 2, tone:'accent',
      perms:{ projects:'RW', invoices:'A',  timesheets:'A',  procurement:'A',  reports:'R', users:'RW' } },
    { id:'manager',    label:'Manager',     desc:'PM-level access — approvals, project ledgers, reports.',     userCount: 3, tone:'blue',
      perms:{ projects:'RW', invoices:'RW', timesheets:'A',  procurement:'A',  reports:'R', users:'R'  } },
    { id:'supervisor', label:'Supervisor',  desc:'Site lead — manages crew, GRNs, daily timesheets.',         userCount: 3, tone:'positive',
      perms:{ projects:'R',  invoices:'—',  timesheets:'RW', procurement:'RW', reports:'—', users:'—'  } },
    { id:'crew',       label:'Crew',        desc:'Field worker — punch in/out, view assigned project info.',  userCount: 3, tone:'amber',
      perms:{ projects:'R',  invoices:'—',  timesheets:'R',  procurement:'—',  reports:'—', users:'—'  } },
    { id:'view-only',  label:'View-only',   desc:'Read-only — auditors, finance reviewers, leadership.',      userCount: 1, tone:'ink',
      perms:{ projects:'R',  invoices:'R',  timesheets:'R',  procurement:'R',  reports:'R', users:'—'  } },
  ],

  users: [
    { id:'U-001', name:'Arvind Kumar',   initials:'AK', email:'arvind.kumar@sabindia.in',   phone:'+91 98201 14523', role:'admin',      status:'active',  lastLogin:'22 Apr 26 · 09:15', joined:'15 Aug 24', projects:['SAB-26-0035','SAB-26-0038','SAB-26-0041','SAB-25-0179'], mfa:true  },
    { id:'U-002', name:'Anita Rao',      initials:'AR', email:'anita.rao@sabindia.in',      phone:'+91 98765 22118', role:'manager',    status:'active',  lastLogin:'22 Apr 26 · 08:42', joined:'02 Mar 23', projects:['SAB-26-0035','SAB-26-0038','SAB-26-0036'],            mfa:true  },
    { id:'U-003', name:'Rajesh Iyer',    initials:'RI', email:'rajesh.iyer@sabindia.in',    phone:'+91 99887 33214', role:'manager',    status:'active',  lastLogin:'21 Apr 26 · 17:08', joined:'12 Jan 24', projects:['SAB-26-0041','SAB-25-0191','SAB-25-0179'],            mfa:true  },
    { id:'U-004', name:'Pooja Menon',    initials:'PM', email:'pooja.menon@sabindia.in',    phone:'+91 97123 44871', role:'manager',    status:'active',  lastLogin:'22 Apr 26 · 10:01', joined:'18 Jun 24', projects:['SAB-26-0036','SAB-26-0035'],                          mfa:false },
    { id:'U-005', name:'Vikram Singh',   initials:'VS', email:'vikram.singh@sabindia.in',   phone:'+91 98442 55190', role:'supervisor', status:'active',  lastLogin:'22 Apr 26 · 07:55', joined:'05 May 24', projects:['SAB-26-0038','SAB-26-0036'],                          mfa:true  },
    { id:'U-006', name:'Karan Pillai',   initials:'KP', email:'karan.pillai@sabindia.in',   phone:'+91 98765 66201', role:'supervisor', status:'active',  lastLogin:'22 Apr 26 · 06:38', joined:'28 Sep 24', projects:['SAB-26-0036'],                                        mfa:false },
    { id:'U-007', name:'Suresh Iyer',    initials:'SI', email:'suresh.iyer@sabindia.in',    phone:'+91 96321 77502', role:'supervisor', status:'invited', lastLogin:'—',                joined:'18 Apr 26', projects:[],                                                    mfa:false },
    { id:'U-008', name:'R. Naidu',       initials:'RN', email:'r.naidu@sabindia.in',        phone:'+91 95412 88431', role:'crew',       status:'active',  lastLogin:'22 Apr 26 · 07:15', joined:'14 Nov 24', projects:['SAB-26-0035','SAB-26-0041'],                          mfa:false },
    { id:'U-009', name:'P. Rao',         initials:'PR', email:'p.rao@sabindia.in',          phone:'+91 94321 99114', role:'crew',       status:'active',  lastLogin:'22 Apr 26 · 07:08', joined:'14 Nov 24', projects:['SAB-26-0038'],                                        mfa:false },
    { id:'U-010', name:'M. Varma',       initials:'MV', email:'m.varma@sabindia.in',        phone:'+91 93215 11227', role:'crew',       status:'active',  lastLogin:'21 Apr 26 · 18:45', joined:'02 Jan 25', projects:['SAB-26-0036'],                                        mfa:false },
    { id:'U-011', name:'Deepak Shetty',  initials:'DS', email:'deepak.shetty@sabindia.in',  phone:'+91 92188 32014', role:'view-only',  status:'active',  lastLogin:'19 Apr 26 · 14:22', joined:'10 Feb 24', projects:[],                                                    mfa:true  },
    { id:'U-012', name:'Neha Bhatia',    initials:'NB', email:'neha.bhatia@sabindia.in',    phone:'+91 91002 44519', role:'admin',      status:'inactive',lastLogin:'04 Mar 26 · 11:18', joined:'22 Aug 23', projects:[],                                                    mfa:true  },
  ],

  userActivity: [
    { ts:'22 Apr 26 · 09:15', actor:'U-001', action:'Approved PO SAB/PO/26/0118',                  meta:'₹1.37 L · Hindustan Pipes' },
    { ts:'22 Apr 26 · 08:42', actor:'U-002', action:'Resolved bill BILL-2026-0411',                meta:'discrepancy → matched' },
    { ts:'22 Apr 26 · 08:14', actor:'U-005', action:'Submitted GRN SAB/GRN/26/0091',               meta:'partial — 2 panels short' },
    { ts:'22 Apr 26 · 07:55', actor:'U-005', action:'Punched in at SAB-26-0038',                   meta:'Patel Hospital site' },
    { ts:'22 Apr 26 · 07:15', actor:'U-008', action:'Punched in at SAB-26-0035',                   meta:'BMC Worli site' },
    { ts:'21 Apr 26 · 17:08', actor:'U-003', action:'Issued invoice SAB/INV/26/0089',              meta:'₹14.20 L · Adani Realty' },
    { ts:'21 Apr 26 · 16:32', actor:'U-002', action:'Updated wage rates — welder skill',           meta:'₹420/hr → ₹450/hr' },
    { ts:'21 Apr 26 · 14:11', actor:'U-001', action:'Invited Suresh Iyer as supervisor',           meta:'pending acceptance' },
  ],

  clients: [
    { id:'C-101', name:'Apollo Hospitals Enterprise Ltd',     gstin:'29AAACA1234E1Z5', state:'Karnataka',  contact:'Dr. Ramesh Iyer',    phone:'+91 98452 11023', email:'procurement@apollohospitals.com',  paymentTerms:'Net 45', tier:'Enterprise', since:'2019-08-12', billingAddr:'154/1 Bannerghatta Road, Bengaluru — 560076', pos:14, pov:18_40_00_000, billed:12_60_00_000, outstanding:5_80_00_000, onTimePayPct:88 },
    { id:'C-102', name:'Tata Consultancy Services',           gstin:'27AAACT2727Q1Z9', state:'Maharashtra',contact:'Vivek Chandran',     phone:'+91 98674 33891', email:'facilities-india@tcs.com',         paymentTerms:'Net 60', tier:'Enterprise', since:'2017-05-04', billingAddr:'TCS House, Raveline Street, Fort, Mumbai — 400001',         pos:9,  pov:14_20_00_000, billed:8_90_00_000,  outstanding:5_30_00_000, onTimePayPct:74 },
    { id:'C-103', name:'Manipal Health Enterprises',          gstin:'29AABCM3344F1ZD', state:'Karnataka',  contact:'Sunitha Rao',        phone:'+91 99645 12880', email:'projects@manipalhospitals.com',    paymentTerms:'Net 30', tier:'Enterprise', since:'2020-01-22', billingAddr:'98 Rustom Bagh, Old Airport Road, Bengaluru — 560017',     pos:11, pov:11_80_00_000, billed:9_40_00_000,  outstanding:2_40_00_000, onTimePayPct:91 },
    { id:'C-104', name:'Infosys Ltd — Electronic City Campus',gstin:'29AAACI4588Q1ZX', state:'Karnataka',  contact:'Naveen Bhat',        phone:'+91 99001 22487', email:'admin-ec@infosys.com',             paymentTerms:'Net 45', tier:'Enterprise', since:'2018-11-09', billingAddr:'Plot 44, Electronic City Phase 1, Bengaluru — 560100',     pos:6,  pov:9_60_00_000,  billed:6_20_00_000,  outstanding:3_40_00_000, onTimePayPct:82 },
    { id:'C-105', name:'Brigade Enterprises — Metropolis Mall',gstin:'29AABCB7711N1ZJ',state:'Karnataka',  contact:'Manisha Rao',        phone:'+91 98863 17729', email:'projects@brigadegroup.com',        paymentTerms:'Net 30', tier:'Mid-market', since:'2021-06-18', billingAddr:'Brigade Gateway, Malleshwaram West, Bengaluru — 560055',  pos:5,  pov:7_80_00_000,  billed:4_10_00_000,  outstanding:3_70_00_000, onTimePayPct:79 },
    { id:'C-106', name:'Prestige Estates',                    gstin:'29AAACP1199H1ZN', state:'Karnataka',  contact:'Karthik Reddy',      phone:'+91 99023 15584', email:'procurement@prestigeconstructions.com', paymentTerms:'Net 30', tier:'Mid-market', since:'2022-02-10', billingAddr:'Falcon House, Brunton Road, Bengaluru — 560025',          pos:3,  pov:3_20_00_000,  billed:1_40_00_000,  outstanding:1_80_00_000, onTimePayPct:86 },
    { id:'C-107', name:'ITC Hotels — Welcomhotel',            gstin:'19AAACI1681G1ZK', state:'West Bengal',contact:'Aniruddha Sen',      phone:'+91 98311 04472', email:'projects.welcomhotel@itchotels.in',paymentTerms:'Net 45', tier:'Mid-market', since:'2023-09-01', billingAddr:'Virginia House, 37 J.L. Nehru Road, Kolkata — 700071',     pos:2,  pov:1_44_00_000,  billed:0,            outstanding:1_44_00_000, onTimePayPct:0 },
    { id:'C-108', name:'DLF Ltd',                             gstin:'06AABCD3344E1Z2', state:'Haryana',    contact:'Ashish Mehrotra',    phone:'+91 98101 28891', email:'projects@dlf.in',                  paymentTerms:'Net 60', tier:'Enterprise', since:'2019-04-15', billingAddr:'DLF Centre, Sansad Marg, New Delhi — 110001',              pos:4,  pov:2_94_00_000,  billed:2_30_00_000,  outstanding:64_00_000,   onTimePayPct:93 },
    { id:'C-109', name:'Wipro Technologies',                  gstin:'29AAACW0181H1ZQ', state:'Karnataka',  contact:'Sandeep Hegde',      phone:'+91 98864 22118', email:'facilities@wipro.com',             paymentTerms:'Net 45', tier:'Enterprise', since:'2020-07-21', billingAddr:'Doddakannelli, Sarjapur Road, Bengaluru — 560035',         pos:3,  pov:48_00_000,    billed:12_00_000,    outstanding:36_00_000,   onTimePayPct:81 },
    { id:'C-110', name:'Godrej Properties',                   gstin:'27AAACG2727Q1ZE', state:'Maharashtra',contact:'Sneha Patil',        phone:'+91 98201 88340', email:'procurement@godrejproperties.com', paymentTerms:'Net 60', tier:'Mid-market', since:'2021-11-30', billingAddr:'Godrej One, Pirojshanagar, Vikhroli East, Mumbai — 400079',pos:1,  pov:5_40_00_000,  billed:2_70_00_000,  outstanding:2_70_00_000, onTimePayPct:68 },
    { id:'C-111', name:'Adani Realty',                        gstin:'24AAACA1144F1Z6', state:'Gujarat',    contact:'Pranav Shah',        phone:'+91 98250 47712', email:'realty@adani.com',                 paymentTerms:'Net 45', tier:'Enterprise', since:'2022-06-08', billingAddr:'Adani House, Mithakhali Six Roads, Ahmedabad — 380009',    pos:2,  pov:18_60_00_000, billed:14_20_00_000, outstanding:4_40_00_000, onTimePayPct:84 },
    { id:'C-112', name:'Embassy Group',                       gstin:'29AABCE5512K1ZR', state:'Karnataka',  contact:'Nikhil Punja',       phone:'+91 99005 11183', email:'pmc@embassyofficeparks.com',       paymentTerms:'Net 30', tier:'Mid-market', since:'2023-02-14', billingAddr:'Embassy Manyata, Outer Ring Road, Bengaluru — 560045',     pos:1,  pov:62_00_000,    billed:0,            outstanding:62_00_000,   onTimePayPct:0 },
  ],

  wageRates: {
    skills: [
      { id:'SK-WLD', name:'Welder',              rate: 450, prevRate: 420, lastUpdated:'21 Apr 26', headcount: 4 },
      { id:'SK-FTR', name:'Pipe fitter',         rate: 380, prevRate: 360, lastUpdated:'12 Mar 26', headcount: 6 },
      { id:'SK-ELC', name:'Electrician',         rate: 410, prevRate: 410, lastUpdated:'02 Feb 26', headcount: 3 },
      { id:'SK-HLP', name:'Helper / unskilled',  rate: 220, prevRate: 200, lastUpdated:'01 Jan 26', headcount: 8 },
      { id:'SK-SUP', name:'Site supervisor',     rate: 620, prevRate: 580, lastUpdated:'12 Mar 26', headcount: 4 },
      { id:'SK-CMN', name:'Commissioning eng.',  rate: 780, prevRate: 720, lastUpdated:'18 Mar 26', headcount: 2 },
      { id:'SK-RGR', name:'Rigger',              rate: 340, prevRate: 320, lastUpdated:'01 Feb 26', headcount: 3 },
      { id:'SK-PNT', name:'Painter / coater',    rate: 290, prevRate: 280, lastUpdated:'01 Jan 26', headcount: 2 },
    ],
    employees: [
      { id:'E-201', name:'Rakesh Naidu',     skill:'Site supervisor',    skillId:'SK-SUP', rate: 720, base: 620, override: true,  lastChanged:'18 Mar 26', joined:'14 Jan 21' },
      { id:'E-202', name:'Suresh Iyer',      skill:'Site supervisor',    skillId:'SK-SUP', rate: 660, base: 620, override: true,  lastChanged:'04 Mar 26', joined:'02 Apr 22' },
      { id:'E-203', name:'Karan Pillai',     skill:'Pipe fitter',        skillId:'SK-FTR', rate: 380, base: 380, override: false, lastChanged:'12 Mar 26', joined:'18 Sep 23' },
      { id:'E-204', name:'Manoj Varma',      skill:'Welder',             skillId:'SK-WLD', rate: 480, base: 450, override: true,  lastChanged:'21 Apr 26', joined:'14 Nov 22' },
      { id:'E-205', name:'Rahul Kumar',      skill:'Welder',             skillId:'SK-WLD', rate: 450, base: 450, override: false, lastChanged:'21 Apr 26', joined:'04 Aug 23' },
      { id:'E-206', name:'Anil Deshmukh',    skill:'Helper / unskilled', skillId:'SK-HLP', rate: 240, base: 220, override: true,  lastChanged:'01 Jan 26', joined:'14 Feb 24' },
      { id:'E-207', name:'Prakash Rao',      skill:'Pipe fitter',        skillId:'SK-FTR', rate: 380, base: 380, override: false, lastChanged:'12 Mar 26', joined:'02 Mar 22' },
      { id:'E-208', name:'Joseph M.',        skill:'Commissioning eng.', skillId:'SK-CMN', rate: 820, base: 780, override: true,  lastChanged:'18 Mar 26', joined:'05 Jul 21' },
      { id:'E-209', name:'Vikram Singh',     skill:'Site supervisor',    skillId:'SK-SUP', rate: 620, base: 620, override: false, lastChanged:'12 Mar 26', joined:'05 May 24' },
      { id:'E-210', name:'Devansh Patel',    skill:'Electrician',        skillId:'SK-ELC', rate: 410, base: 410, override: false, lastChanged:'02 Feb 26', joined:'18 Jun 24' },
      { id:'E-211', name:'Mohan Singh',      skill:'Rigger',             skillId:'SK-RGR', rate: 340, base: 340, override: false, lastChanged:'01 Feb 26', joined:'14 Aug 23' },
      { id:'E-212', name:'Govind Joshi',     skill:'Painter / coater',   skillId:'SK-PNT', rate: 290, base: 290, override: false, lastChanged:'01 Jan 26', joined:'12 Oct 23' },
    ],
  },
};

window.SEED = SEED;

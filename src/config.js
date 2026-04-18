// ─── SALES CATEGORIES ────────────────────────────────────────────────────────
export const INDUSTRIES = [
  'Education Schools',
  'Education Colleges',
  'Corporate IT',
  'Corporate FMCG',
  'Corporate Large',
  'Gifting Events',
  'Sports Gyms',
]

// ─── HARDCODED SHEET URLS (gviz CSV — no publishing required) ────────────────
const _BASE = 'https://docs.google.com/spreadsheets/d/1_1sFSV4MhKXcfU3cgsYbJ5d_FTbbdGqsd427EEDQMLc/gviz/tq?tqx=out:csv&sheet='
export const SHEET_URLS = {
  'Education Schools':  _BASE + 'Education+Schools',
  'Education Colleges': _BASE + 'Education+Colleges',
  'Corporate IT':       _BASE + 'Corporate+IT',
  'Corporate FMCG':     _BASE + 'Corporate+FMCG',
  'Corporate Large':    _BASE + 'Corporate+Large',
  'Gifting Events':     _BASE + 'Gifting+Events',
  'Sports Gyms':        _BASE + 'Sports+Gyms',
}

export const SYNC_INTERVAL_MS = 60_000

// ─── LEAD STATUSES ───────────────────────────────────────────────────────────
export const STATUSES = [
  'New',
  'Contacted',
  'Interested',
  'Meeting Scheduled',
  'Deal Closed',
  'Not Interested',
]

export const STATUS_COLORS = {
  'New':               '#2979ff',
  'Contacted':         '#00bcd4',
  'Interested':        '#ffab00',
  'Meeting Scheduled': '#7c4dff',
  'Deal Closed':       '#00c853',
  'Not Interested':    '#ff4444',
}

// ─── FILTER OPTIONS ──────────────────────────────────────────────────────────
export const INDIAN_STATES = [
  'All States',
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
  'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow',
]

// ─── SAMPLE DATA ─────────────────────────────────────────────────────────────
// industry values must match entries in INDUSTRIES above
export const SAMPLE_DATA = [
  { id: '1',  name: 'Rajesh Kumar',   company: 'Delhi Public School', jobTitle: 'Principal',          location: 'Delhi',     state: 'Delhi',       industry: INDUSTRIES[0], linkedin: 'https://linkedin.com/in/rajeshkumar',   email: 'principal@dps.edu',    phone: '+91 98765 43210', status: 'New',               notes: '' },
  { id: '2',  name: 'Priya Sharma',   company: 'IIT Bombay',          jobTitle: 'Admin Head',          location: 'Mumbai',    state: 'Mumbai',      industry: INDUSTRIES[1], linkedin: 'https://linkedin.com/in/priyasharma',   email: 'admin@iitb.ac.in',     phone: '+91 87654 32109', status: 'Contacted',         notes: 'Called on Monday, follow up needed' },
  { id: '3',  name: 'Vikram Patel',   company: 'Infosys Ltd',         jobTitle: 'HR Director',         location: 'Bangalore', state: 'Bangalore',   industry: INDUSTRIES[2], linkedin: 'https://linkedin.com/in/vikrampatel',   email: 'hr@infosys.com',       phone: '+91 76543 21098', status: 'Interested',        notes: 'Interested in bulk order for 500 bags' },
  { id: '4',  name: 'Anita Desai',    company: 'HUL India',           jobTitle: 'Procurement Manager', location: 'Mumbai',    state: 'Mumbai',      industry: INDUSTRIES[3], linkedin: 'https://linkedin.com/in/anitadesai',    email: 'procurement@hul.com',  phone: '+91 65432 10987', status: 'Meeting Scheduled', notes: 'Meeting on Friday 3pm' },
  { id: '5',  name: 'Suresh Menon',   company: 'Tata Consultancy',    jobTitle: 'Operations Head',     location: 'Chennai',   state: 'Chennai',     industry: INDUSTRIES[4], linkedin: 'https://linkedin.com/in/sureshmenon',   email: 'ops@tcs.com',          phone: '+91 54321 09876', status: 'Deal Closed',       notes: 'Order confirmed: 200 laptop bags' },
  { id: '6',  name: 'Meera Nair',     company: 'EventPro India',      jobTitle: 'Event Director',      location: 'Hyderabad', state: 'Hyderabad',   industry: INDUSTRIES[5], linkedin: 'https://linkedin.com/in/meeranair',     email: 'events@eventpro.in',   phone: '+91 43210 98765', status: 'Interested',        notes: 'Looking for branded bags for corporate events' },
  { id: '7',  name: 'Arjun Singh',    company: 'FitZone Gyms',        jobTitle: 'Brand Manager',       location: 'Pune',      state: 'Pune',        industry: INDUSTRIES[6], linkedin: 'https://linkedin.com/in/arjunsingh',    email: 'brand@fitzone.in',     phone: '+91 32109 87654', status: 'Not Interested',    notes: 'Budget constraints this quarter' },
  { id: '8',  name: 'Kavita Reddy',   company: 'Ryan International',  jobTitle: 'Purchase Head',       location: 'Hyderabad', state: 'Hyderabad',   industry: INDUSTRIES[0], linkedin: 'https://linkedin.com/in/kavitareddy',   email: 'purchase@ryan.edu',    phone: '+91 21098 76543', status: 'Contacted',         notes: 'Sent catalog, awaiting reply' },
  { id: '9',  name: 'Rohit Malhotra', company: 'Wipro Technologies',  jobTitle: 'Admin Manager',       location: 'Bangalore', state: 'Bangalore',   industry: INDUSTRIES[2], linkedin: 'https://linkedin.com/in/rohitmalhotra', email: 'admin@wipro.com',      phone: '+91 19876 54321', status: 'New',               notes: '' },
  { id: '10', name: 'Sunita Joshi',   company: 'Amity University',    jobTitle: 'Dean',                location: 'Noida',     state: 'Uttar Pradesh', industry: INDUSTRIES[1], linkedin: 'https://linkedin.com/in/sunitajoshi', email: 'dean@amity.edu',      phone: '+91 98761 23456', status: 'Interested',        notes: 'Wants customized bags with university logo' },
]

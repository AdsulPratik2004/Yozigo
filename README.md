# Yogizo Cinema 🎬

A modern, high-concurrency movie theater ticketing platform featuring real-time seat reservation, race-condition-safe holds, payment simulation, customer booking history, and an administrative screening manager.

Built with **FastAPI**, **Supabase (PostgreSQL)**, **Vite React (TypeScript)**, and **Tailwind CSS**.

---

## 🌟 Features

- **Real-time Seat Selection**: Interactive 80-seat hall map with instant availability updates
- **Race-Condition Safe**: Atomic seat holds preventing double-booking across concurrent users
- **Automatic Token Refresh**: Seamless authentication with automatic token renewal
- **Admin Dashboard**: Complete movie management and show scheduling
- **Booking History**: Track all your bookings with upcoming/past filters
- **Light Mode UI**: Clean, modern interface optimized for light theme
- **Responsive Design**: Works seamlessly on desktop and mobile devices

---

## ⚡ Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Supabase account

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\Activate.ps1
# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your Supabase credentials
# Copy from backend/.env.example and fill in your values

# Seed database
python seed.py

# Start server
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:8000" > .env

# Start dev server
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## 🔑 Login Credentials

Use these accounts to test the application:

| Role | Email | Password | Access |
| :--- | :--- | :--- | :--- |
| **Admin** | `adsulpratik9@gmail.com` | `@Pratik20-04` | Full admin panel access |
| **User** | `pratikadsul.career@gmail.com` | `@Pratik2004` | Book seats, view bookings |

---

## � Project Structure

```
Yogizo/
├── backend/
│   ├── app/
│   │   ├── routes/          # API endpoints
│   │   ├── auth.py           # Authentication logic
│   │   ├── bff.py            # Supabase integration
│   │   └── main.py           # FastAPI app
│   ├── schema.sql            # Database schema
│   ├── seed.py               # Database seeder
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── context/          # React Context (Auth, Theme)
│   │   ├── lib/              # API client, types
│   │   └── assets/           # Images (logo, favicon)
│   ├── .env.example          # Environment template
│   └── package.json          # Node dependencies
└── README.md
```

---

## 🏗️ Tech Stack

### Backend
- **FastAPI**: High-performance ASGI framework
- **Supabase**: PostgreSQL database & authentication
- **Pytest**: Testing framework
- **python-dotenv**: Environment variable management

### Frontend
- **React 18**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool & dev server
- **Tailwind CSS**: Utility-first styling
- **React Router**: Client-side routing
- **React Query**: Data fetching & caching
- **Supabase Auth**: Authentication

---

## 🔐 Authentication Flow

1. **Signup**: User registers via Supabase Auth → Email verification required
2. **Login**: User signs in → Receives access_token & refresh_token
3. **Token Storage**: Tokens stored in localStorage
4. **Auto Refresh**: When access token expires, frontend automatically refreshes using refresh_token
5. **API Requests**: All requests include Authorization header with access_token

---

## 🎯 Key Features Explained

### Race-Condition Safe Seat Holds
- Uses atomic PostgreSQL stored procedures
- `UNIQUE(show_id, seat_row, seat_number)` constraint prevents duplicates
- Expired holds automatically cleaned within transaction
- 5-minute countdown timer on frontend

### Admin Dashboard
- Create/Edit/Delete movies
- Schedule shows with date, time, and pricing
- View all shows with booking counts
- Delete shows (blocked if bookings exist)

### Booking Management
- View all bookings at `/my-bookings`
- Filter by All/Upcoming/Past
- Detailed booking confirmation page
- Seat breakdown and pricing

---

## 🎨 UI Components

- **MovieCard**: Movie poster with rating, language, duration
- **SeatMap**: Interactive 80-seat grid with visual states
- **Button**: Primary, outline, danger variants
- **Card**: Reusable card component
- **Badge**: Rating display with color coding
- **Navbar**: Navigation with auth state

---

## 🚀 Deployment

### Backend Deployment

1. Deploy to a hosting platform (Railway, Render, AWS, etc.)
2. Set environment variables in production
3. Ensure Supabase project is accessible from deployment URL

### Frontend Deployment

1. Build for production: `npm run build`
2. Deploy to Vercel, Netlify, or similar
3. Set `VITE_API_URL` to production backend URL

---

## 📝 Environment Variables

### Backend (.env)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
```

---

## 🐛 Troubleshooting

### "Invalid or expired token" error
- This is automatically handled by the token refresh mechanism
- If it persists, clear localStorage and re-login

### Supabase connection issues
- Verify SUPABASE_URL and keys are correct
- Check Supabase project is active
- Ensure schema.sql has been executed

### Frontend not connecting to backend
- Check backend is running on port 8000
- Verify VITE_API_URL in frontend .env
- Check CORS settings in FastAPI

---

## 📄 License

This project is for educational purposes.

---

## 👨‍💻 Credits

Built as a modern cinema ticketing platform demonstrating:
- Real-time concurrent seat reservation
- Atomic database transactions
- Automatic token refresh
- Clean React/TypeScript architecture
- Supabase integration

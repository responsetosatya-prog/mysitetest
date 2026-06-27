# MySiteTest - Daily Activity Tracker

A web application where users can:
- Sign up and log in
- Enter daily count and status (Present/Absent/Holiday)
- View monthly summary
- Admin can view all users, block users, and export data

## Tech Stack
- Frontend: React
- Backend: Node.js + Express
- Database: PostgreSQL
- Hosting: Render

## Setup
1. Clone the repository
2. Install backend dependencies: `cd backend && npm install`
3. Install frontend dependencies: `cd frontend && npm install`
4. Create a PostgreSQL database
5. Set environment variables
6. Run backend: `npm start`
7. Run frontend: `npm start`

## Admin Access
- Create admin account via `/api/create-admin` with secret key

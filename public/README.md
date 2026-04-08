# MittiMart: Local Farm-to-Table Marketplace

MittiMart is a cutting-edge, mobile-first web application designed to connect local farmers directly to customers, utilizing a 10-minute Blinkit-style delivery network. Built completely on pure frontend web technologies, the entire sophisticated backend runs smoothly inside browser LocalStorage algorithms—making it completely server-less and 100% free to host anywhere, instantly.

## 🌟 Live Demo Architecture
The application is strictly split into 4 Role-Based Access Views (`RBAC`):

1. **The Buyer Application (Customers)**: Features ultra-fast, responsive UI tailored for browsing farm goods, managing a shopping cart, and checking out seamlessly.
2. **The Seller Dashboard (Farmers)**: Empowering agriculture with an internal CMS designed for local farmers to self-manage inventory, natively compress and embed images of their crops, and track their payouts from fulfilled customer requests.
3. **The Delivery Rider Portal (Fleet)**: Independent drivers log in here to receive a real-time feed of available "Drop Off" routes, track their gross earnings, and lock-in deliveries, complete with algorithmic Haversine ETA calculations.
4. **The Master Control Panel (Admins)**: Navigated via `admin.html`, providing root-level security clearance to overwrite platform data, permanently suspend users/riders, alter global catalog pricing, process forced payouts, and calculate platform profit limits. _(Default passcode: `mittimaster2026`)_

## 🚀 How to Host on Render (100% Free)

Because MittiMart operates globally via an ultra-fast LocalStorage browser engine (`app.js`), it removes the need for configuring Node, Python, or Mongo databases. You can host this flawlessly on **Render.com** as a "Static Site" right now:

### Step 1: Push to GitHub
1. Log in to [GitHub](https://github.com) and create a new repository called `MittiMart`.
2. Upload this exact folder structure to the root of your newly created repository.

### Step 2: Connect to Render
1. Create a free account at [Render.com](https://render.com).
2. Click **New +** and select **Static Site**.
3. Connect your GitHub account and select your `MittiMart` repository.

### Step 3: Deploy configuration
1. **Name**: `mittimart` (or anything you prefer).
2. **Branch**: `main`.
3. **Build Command**: Leave this completely blank (since it's a pure Vanilla web app).
4. **Publish Directory**: Type `.` (just a period, which tells Render to deploy the root folder).
5. Click **Create Static Site**. Fast forward a minute, and Render will issue you your live production URL (e.g., `https://mittimart-app.onrender.com`)!

## ⚡ Technical Highlights
- **Haversine Algorithmic Distance Mapping**: Dynamically calculates and renders ETA models for delivery riders using geometric boundary functions mapping abstract consumer targets.
- **Client-Side Image Squishing**: Farmers' image uploads are processed entirely client-side, running high-resolution photos through an internal HTML5 `<canvas>` resizing framework to maintain precise LocalStorage byte limits without crashing quotas.
- **Deep Authentication Locks**: Security variables verify active sessions on the fly, seamlessly destroying session hooks if a Master Admin overrides user status globally.

Built cleanly without React, Angular, or external libraries. Pure HTML, CSS, and Vanilla JavaScript.

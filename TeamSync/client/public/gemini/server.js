const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({ origin: '*' })); // Allow requests from frontend
app.use(express.json());

const uri = "mongodb+srv://rvit24mca002rvitm_db_user:jOza0RZXqd3lbrpb@cluster0.hxw1u72.mongodb.net/";
const client = new MongoClient(uri);
 
if(client) console.log("mongodb successfully connected")
const dbName = "teamsync_db";
const collectionName = "users";

// Store OTP temporarily in memory (for demo; in production use Redis or DB)
const otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail", // use your email service
  auth: {
    user: "tarunshetty256@gmail.com", // replace with sender email
    pass: "fzduosbpgzwqnptr" // replace with app password
  }
});

// Step 1: Send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.json({ success: false, message: "Email required" });

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const user = await collection.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "You are not a member of Team Sync!" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[email] = otp;

    const data1= `<div style="font-family: 'Montserrat', sans-serif; background-color:lavender; padding:20px;">
    <div style="max-width:500px; margin:auto; background-color:#fff; border-radius:15px; padding:30px; text-align:center; box-shadow:0 5px 15px rgba(0,0,0,0.2);">
      <h2 style="color:#512da8; margin-bottom:10px;">Team Sync OTP Verification</h2>
      <p style="font-size:16px; color:#333;">Hello <strong>${user.name}</strong>,</p>
      <p style="font-size:14px; color:#555;">Use the OTP below to complete your login process:</p>
      
      <div style="font-size:28px; letter-spacing:6px; margin:20px 0; font-weight:700; background-color:#f0f0f0; padding:15px 0; border-radius:10px;">
        ${otp}
      </div>

      <p style="font-size:14px; color:#777;">This OTP is valid for 5 minutes only.</p>
      <p style="margin-top:20px; font-size:12px; color:#999;">
        If you did not request this OTP, please secure your account immediately.
      </p>
    </div>
  </div>
  `;
    // Send email
    await transporter.sendMail({
      from: '"Team Sync"',
      to: email,
      subject: "Your OTP for Team Sync",
      html: data1,
    });

    return res.json({ success: true, message: "OTP sent to your email" ,data:user});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Step 2: Verify OTP
app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) return res.json({ success: false, message: "Email and OTP required" });

  if (parseInt(otp) === otpStore[email]) {
    delete otpStore[email]; // clear OTP after verification

const htmlContent = `
<div style="font-family: 'Montserrat', sans-serif; background-color:#f0f2f5; padding:50px 20px;">
  <div style="max-width:600px; margin:auto; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 12px 30px rgba(0,0,0,0.12);">

    <!-- Top Banner with Gradient -->
    <div style="background: linear-gradient(135deg, #6a1b9a, #512da8); padding:30px; text-align:center;">
      <h1 style="color:#ffffff; font-size:26px; margin:0; font-weight:700;">Team Sync AI Assistant</h1>
      <p style="color:#e0d7f8; font-size:14px; margin-top:5px;">Login Alert & Access Notification</p>
    </div>

    <!-- Content Section -->
    <div style="padding:40px 30px; text-align:center;">
      <img src="https://img.icons8.com/color/96/000000/artificial-intelligence.png" alt="AI" style="margin-bottom:20px;">
      <p style="font-size:16px; color:#333; line-height:1.6;">
        Hello <strong>${email.replace('@gmail.com', '').replace('.rvitm@rvei.edu.in', '')}</strong>,<br><br>
        You have successfully logged in and accessed the <strong>AI Assistant</strong> for your <strong>Team Sync</strong> project management platform.
      </p>

      <p style="font-size:15px; color:#555; line-height:1.6; margin-top:15px;">
        Leverage AI to streamline tasks, boost productivity, and keep your team on track.
      </p>

      <!-- CTA Button -->
      <a href="http://localhost:3000" target="_blank"
        style="display:inline-block; margin-top:30px; padding:14px 35px; background:linear-gradient(135deg, #8e24aa, #5e35b1); 
               color:#fff; font-size:16px; font-weight:600; border-radius:12px; text-decoration:none;
               box-shadow:0 6px 15px rgba(0,0,0,0.15); transition: all 0.3s ease;">
        Access Team Sync
      </a>

      <!-- Security Note -->
      <p style="margin-top:30px; font-size:12px; color:#999;">
        If this wasn’t you, please secure your account immediately.<br>
        &copy; ${new Date().getFullYear()} Team Sync. All rights reserved.
      </p>
    </div>
  </div>
</div>
`;

 await transporter.sendMail({
      from: '"Team Sync" tarunshetty256@gmail.com',
      to: email,
      subject: 'Login Alert: AI Assistant Accessed',
      html: htmlContent,
    });

    return res.json({ success: true, message: "OTP verified. Login successful!" });
  } else {
    return res.json({ success: false, message: "Incorrect OTP" });
  }
});

app.listen(8006, () => console.log("✅ Server running on http://localhost:8006"));

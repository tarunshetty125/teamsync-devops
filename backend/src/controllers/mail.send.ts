 const nodemailer = require("nodemailer");
 require("dotenv").config();





export async function Sendemail(fname: any , email: any ) {

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your gmail
    pass: process.env.EMAIL_PASS, // your app password
  },
});
  
 try {
    const emailHTML = `
    <div style="font-family: Arial, sans-serif; background-color: #f6f9fc; padding: 20px;">
      <div style="max-width: 600px; background-color: #ffffff; border-radius: 10px; overflow: hidden; margin: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(90deg, #007bff, #00c6ff); padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0;">Team Project Management</h1>
          <p style="margin: 0;">Welcome to your project journey 🚀</p>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #333;">Hi ${fname},</h2>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            We're thrilled to have you on board! Your account has been successfully created.
            Start managing your projects, tracking progress, and collaborating with your team seamlessly.
          </p>
          <div style="text-align: center; dc: 30px 0;">
            <a href="http://localhost:5173/login"
              style="background-color: #007bff; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
          <p style="color: #777; font-size: 14px; text-align: center;">
            If you didn’t create this account, please ignore this email.
          </p>
        </div>
        <div style="background-color: #f1f1f1; text-align: center; padding: 15px; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Team Project Management App</p>
        </div>
      </div>
    </div>
    `;

    // Send styled email
    await transporter.sendMail({
      from: `"Team Project Management" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🎉 Welcome to Team Project Management!",
      html: emailHTML,
    });

    console.log("📩 Styled welcome email sent to", email);
  } catch (err) {
    console.error("❌ Error:", err);

  }
}

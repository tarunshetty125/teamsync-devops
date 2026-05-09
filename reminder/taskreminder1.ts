const { MongoClient, ObjectId } = require("mongodb");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
require("dotenv").config();

// ==== CONFIG ====
const MONGO_URI = "mongodb+srv://rvit24mca002rvitm_db_user:jOza0RZXqd3lbrpb@cluster0.hxw1u72.mongodb.net/";
const DB_NAME = "teamsync_db";

const FROM_EMAIL = "tarunshetty256@gmail.com";
const EMAIL_PASS = "fzduosbpgzwqnptr";

// ==== MAIL TRANSPORT ====
const transporter = nodemailer.createTransport({
  service: "gmail", // or your SMTP config
  auth: {
    user: FROM_EMAIL,
    pass: EMAIL_PASS, // App Password if using Gmail 2FA
  },
});

// Verify SMTP credentials
transporter.verify((error: any, success: any) => {
  if (error) {
    console.error("❌ SMTP configuration error:", error);
  } else {
    console.log("✅ SMTP configuration verified, ready to send emails.");
  }
});

// ==== MAIN FUNCTION ====
async function sendUpcomingTaskReminders() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db(DB_NAME);
    const tasks = db.collection("tasks");
    const users = db.collection("users");

    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(now.getDate() + 3);

    // Find upcoming tasks
    const upcomingTasks = await tasks
      .find({ dueDate: { $gte: now, $lte: threeDaysLater } })
      .toArray();

    if (upcomingTasks.length === 0) {
      console.log("✅ No upcoming tasks in the next 3 days.");
      return;
    }

    for (const task of upcomingTasks) {
      // Get assigned user's email
      const user = await users.findOne({
        _id: new ObjectId(task.assignedTo),
      });

      if (!user) {
        console.warn(`⚠️ No user found for userId ${task.assignedTo}`);
        continue;
      }

      const receiverEmail = user.email;

      // Calculate days left
      const dueDate = new Date(task.dueDate);
      const timeDiff = dueDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      // Optional: make it more readable
      let daysLeftText = `${daysLeft} day(s)`;
      if (daysLeft === 0) daysLeftText = "Today";
      else if (daysLeft === 1) daysLeftText = "Tomorrow";

      const mailOptions = {
        from: `"TeamSync Reminder" <${FROM_EMAIL}>`,
        to: receiverEmail,
        subject: `Reminder: Task "${task.title}" is due ${daysLeftText}`,
        text: `Hi,

You have an upcoming task due soon:

Title: ${task.title}
Description: ${task.description || "No description provided"}
Due Date: ${dueDate.toLocaleString()}
Status: ${task.status}
Days Left: ${daysLeftText}

Please make sure to complete it on time.

- TeamSync`,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Reminder sent to ${receiverEmail} for task "${task.title}"`);
      } catch (err) {
        console.error(`❌ Failed to send email to ${receiverEmail}:`, err);
      }
    }

    console.log("✅ All upcoming task reminders processed.");
  } catch (err) {
    console.error("❌ Error sending reminders:", err);
  } finally {
    await client.close();
  }
}

// ==== SCHEDULE DAILY RUN ====
// Runs every day at 9:00 AM
cron.schedule("0 9 * * *", () => {
  console.log("⏰ Running daily task reminder...");
  sendUpcomingTaskReminders();
});

// Optional: Run immediately on start
sendUpcomingTaskReminders();

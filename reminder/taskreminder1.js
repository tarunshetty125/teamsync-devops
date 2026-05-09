var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a = require("mongodb"), MongoClient = _a.MongoClient, ObjectId = _a.ObjectId;
var nodemailer = require("nodemailer");
var cron = require("node-cron");
require("dotenv").config();
// ==== CONFIG ====
var MONGO_URI = "mongodb+srv://rvit24mca002rvitm_db_user:jOza0RZXqd3lbrpb@cluster0.hxw1u72.mongodb.net/";
var DB_NAME = "teamsync_db";
var FROM_EMAIL = "tarunshetty256@gmail.com";
var EMAIL_PASS = "fzduosbpgzwqnptr";
// ==== MAIL TRANSPORT ====
var transporter = nodemailer.createTransport({
    service: "gmail", // or your SMTP config
    auth: {
        user: FROM_EMAIL,
        pass: EMAIL_PASS, // App Password if using Gmail 2FA
    },
});
// Verify SMTP credentials
transporter.verify(function (error, success) {
    if (error) {
        console.error("❌ SMTP configuration error:", error);
    }
    else {
        console.log("✅ SMTP configuration verified, ready to send emails.");
    }
});
// ==== MAIN FUNCTION ====
function sendUpcomingTaskReminders() {
    return __awaiter(this, void 0, void 0, function () {
        var client, db, tasks, users, now, threeDaysLater, upcomingTasks, _i, upcomingTasks_1, task, user, receiverEmail, dueDate, timeDiff, daysLeft, daysLeftText, mailOptions, err_1, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = new MongoClient(MONGO_URI);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 11, 12, 14]);
                    return [4 /*yield*/, client.connect()];
                case 2:
                    _a.sent();
                    console.log("✅ Connected to MongoDB");
                    db = client.db(DB_NAME);
                    tasks = db.collection("tasks");
                    users = db.collection("users");
                    now = new Date();
                    threeDaysLater = new Date();
                    threeDaysLater.setDate(now.getDate() + 3);
                    return [4 /*yield*/, tasks
                            .find({ dueDate: { $gte: now, $lte: threeDaysLater } })
                            .toArray()];
                case 3:
                    upcomingTasks = _a.sent();
                    if (upcomingTasks.length === 0) {
                        console.log("✅ No upcoming tasks in the next 3 days.");
                        return [2 /*return*/];
                    }
                    _i = 0, upcomingTasks_1 = upcomingTasks;
                    _a.label = 4;
                case 4:
                    if (!(_i < upcomingTasks_1.length)) return [3 /*break*/, 10];
                    task = upcomingTasks_1[_i];
                    return [4 /*yield*/, users.findOne({
                            _id: new ObjectId(task.assignedTo),
                        })];
                case 5:
                    user = _a.sent();
                    if (!user) {
                        console.warn("\u26A0\uFE0F No user found for userId ".concat(task.assignedTo));
                        return [3 /*break*/, 9];
                    }
                    receiverEmail = user.email;
                    dueDate = new Date(task.dueDate);
                    timeDiff = dueDate.getTime() - now.getTime();
                    daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                    daysLeftText = "".concat(daysLeft, " day(s)");
                    if (daysLeft === 0)
                        daysLeftText = "Today";
                    else if (daysLeft === 1)
                        daysLeftText = "Tomorrow";
                    mailOptions = {
                        from: "\"TeamSync Reminder\" <".concat(FROM_EMAIL, ">"),
                        to: receiverEmail,
                        subject: "Reminder: Task \"".concat(task.title, "\" is due ").concat(daysLeftText),
                        text: "Hi,\n\nYou have an upcoming task due soon:\n\nTitle: ".concat(task.title, "\nDescription: ").concat(task.description || "No description provided", "\nDue Date: ").concat(dueDate.toLocaleString(), "\nStatus: ").concat(task.status, "\nDays Left: ").concat(daysLeftText, "\n\nPlease make sure to complete it on time.\n\n- TeamSync"),
                    };
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, transporter.sendMail(mailOptions)];
                case 7:
                    _a.sent();
                    console.log("\uD83D\uDCE7 Reminder sent to ".concat(receiverEmail, " for task \"").concat(task.title, "\""));
                    return [3 /*break*/, 9];
                case 8:
                    err_1 = _a.sent();
                    console.error("\u274C Failed to send email to ".concat(receiverEmail, ":"), err_1);
                    return [3 /*break*/, 9];
                case 9:
                    _i++;
                    return [3 /*break*/, 4];
                case 10:
                    console.log("✅ All upcoming task reminders processed.");
                    return [3 /*break*/, 14];
                case 11:
                    err_2 = _a.sent();
                    console.error("❌ Error sending reminders:", err_2);
                    return [3 /*break*/, 14];
                case 12: return [4 /*yield*/, client.close()];
                case 13:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 14: return [2 /*return*/];
            }
        });
    });
}
// ==== SCHEDULE DAILY RUN ====
// Runs every day at 9:00 AM
cron.schedule("0 9 * * *", function () {
    console.log("⏰ Running daily task reminder...");
    sendUpcomingTaskReminders();
});
// Optional: Run immediately on start
sendUpcomingTaskReminders();

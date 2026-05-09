// ======= Dialog Box Function =======
function showDialog(message) {
  const dialog = document.getElementById('dialogBox');
  dialog.textContent = message;
  dialog.style.display = 'block';
  setTimeout(() => { dialog.style.display = 'none'; }, 3000);
}

// ======= OTP Navigation =======
function setupOtpNavigation() {
  const otpBoxes = document.querySelectorAll('.otp-box');
  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', () => {
      if (box.value.length === 1 && idx < otpBoxes.length - 1) otpBoxes[idx + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && box.value === '' && idx > 0) otpBoxes[idx - 1].focus();
    });
  });
}


// ======= OTP Countdown Timer =======
function startCountdown(duration = 30) {
  const countdownEl = document.getElementById('countdown');
  let time = duration;
  countdownEl.textContent = time;
  const resendBtn = document.getElementById('resendOtpBtn');
  resendBtn.disabled = true;
  resendBtn.style.color = '#aaa';

  const interval = setInterval(() => {
    time--;
    countdownEl.textContent = time;
    if (time <= 0) {
      clearInterval(interval);
      resendBtn.disabled = false;
      resendBtn.style.color = '#512da8';
      countdownEl.textContent = '0';
    }
  }, 1000);
}


let data;
// ======= Send OTP Function =======
async function sendOtp(email) {
  try {
    const res = await fetch('http://localhost:8006/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
     data = await res.json();
    console.log(data?.data);
    if (!data.success) showDialog(data.message);
    
    
    return data.success;
  } catch (err) {
    console.error(err);
    showDialog("Server error. Try again later.");
    return false;
  }
}

// ======= Login & OTP Logic =======
document.getElementById('login').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  if (!email) return showDialog("Please enter your email!");

  const otpSent = await sendOtp(email);
  if (!otpSent) return;

  // Show OTP modal
  const modal = document.getElementById('otpModal');
  modal.style.display = 'block';
  setupOtpNavigation();
  startCountdown(30);

  document.getElementById('closeModal').onclick = () => modal.style.display = 'none';

  // Verify OTP
  document.getElementById('verifyOtpBtn').onclick = async () => {
    const otpValue = Array.from(document.querySelectorAll('.otp-box')).map(i => i.value.trim()).join('');
    if (otpValue.length !== 6) return showDialog("Please enter the 6-digit OTP!");

    try {
      const verifyRes = await fetch('http://localhost:8006/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue })
      });
      const verifyData = await verifyRes.json();

    
    

      if (verifyData.success) {


           console.log(data.data.profilePicture);
         const username = email
             .replace('@gmail.com', '')
             .replace('.rvitm@rvei.edu.in', '');
             localStorage.setItem("user", username);
             localStorage.setItem("profile",data.data.profilePicture);

       
        
        showDialog(verifyData.message);
        modal.style.display = 'none';
        setTimeout(() => window.location.href = "index.html", 1500);
      } else showDialog(verifyData.message);
    } catch (err) {
      console.error(err);
      showDialog("Server error. Try again later.");
    }
  };

  // Resend OTP
  document.getElementById('resendOtpBtn').onclick = async () => {
    const success = await sendOtp(email);
    if (success) startCountdown(30);
  };
});

// Close OTP modal if clicked outside
window.onclick = function(event) {
  const modal = document.getElementById('otpModal');
  if (event.target == modal) modal.style.display = "none";
};


document.getElementById('email').value = localStorage.getItem('email');
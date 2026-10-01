import axios from 'axios';
async function test() {
  require('dotenv').config();
  try {
    const res = await axios.get('https://api.flutterwave.com/v3/banks/NG', {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
    });
    console.log("Success! Status:", res.data.status, "| Banks found:", res.data.data?.length);
  } catch (err: any) {
    console.log("Failed:", err.response?.data || err.message);
  }
}
test();

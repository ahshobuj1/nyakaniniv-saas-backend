import axios from 'axios';
async function main() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  
  const payload = {
    type: "kepss", 
    name: "Test Name",
    account_number: "0000000000",
    bank_code: "05",
    currency: "KES"
  };

  try {
    const res = await axios.post('https://api.paystack.co/transferrecipient', payload, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    console.log("Success with kepss:", res.data);
  } catch (err: any) {
    console.error("Failed with kepss:", err.response?.data);
  }
}
main().catch(console.error);

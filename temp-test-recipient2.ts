import axios from 'axios';
async function main() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY; // This should be the real backend key
  console.log("Key:", secretKey?.substring(0, 8) + '...');
  
  const payload = {
    type: "nuban", 
    name: "Test Name",
    account_number: "0000000000",
    bank_code: "05",
    currency: "KES"
  };

  try {
    const res = await axios.post('https://api.paystack.co/transferrecipient', payload, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    console.log("Success with nuban:", res.data);
  } catch (err: any) {
    console.error("Failed with nuban:", err.response?.data);
  }
}
main().catch(console.error);

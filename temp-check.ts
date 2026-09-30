import axios from 'axios';

async function main() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_630a916327eab42de8629cf857cfb77cc41bb45b'; // Generic fallback or check .env
  
  console.log("Fetching Kenya banks...");
  const res = await axios.get('https://api.paystack.co/bank?country=kenya', {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  console.log(res.data.data.map((b: any) => ({ name: b.name, code: b.code })));
}

main().catch(console.error);

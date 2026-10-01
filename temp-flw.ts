import axios from 'axios';
async function test() {
  try {
    const res = await axios.get('https://api.flutterwave.com/v3/banks/NG', {
      headers: { Authorization: `Bearer QubYuH7rW3AL1JXyJUJiKcgugyVhbPN2C8O89MGZFcT8dHQj7Or7j7c9suFF4lfnXUfukAJBx7NmmHQlJnnR8` }
    });
    console.log("Success!", res.data.message);
  } catch (err: any) {
    console.log("Failed:", err.response?.data);
  }
}
test();

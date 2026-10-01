import axios from 'axios';

async function main() {
  try {
    const res = await axios.get('https://api.upbeat.africa/wallet/v1?tenantId=bad70060-ced6-401f-82f5-9f2fcddae319');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error(err.message);
  }
}
main();

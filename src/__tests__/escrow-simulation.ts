import { calculateFinancialBreakdown, getCountryFinancialConfig } from '../core/config/financial-matrix.config';

function runSimulation() {
  console.log('--- TEST 1: Spec Example Calculation ---');
  // Customer pays $1,000, Platform Fee 2% ($20), Gateway Fee $30 -> DJ Net Earning $950
  const breakdown = calculateFinancialBreakdown(1000, 'USD', 30, 'NG');
  console.log('Gross:', breakdown.grossAmount);
  console.log('Platform Fee (2%):', breakdown.platformFee);
  console.log('Gateway Fee:', breakdown.gatewayFee);
  console.log('DJ Net Earning:', breakdown.djNetEarning);

  if (breakdown.platformFee !== 20) throw new Error(`Expected platform fee 20, got ${breakdown.platformFee}`);
  if (breakdown.gatewayFee !== 30) throw new Error(`Expected gateway fee 30, got ${breakdown.gatewayFee}`);
  if (breakdown.djNetEarning !== 950) throw new Error(`Expected net earning 950, got ${breakdown.djNetEarning}`);
  console.log('✅ Spec Example Test Passed!');

  console.log('\n--- TEST 2: Kenya KES Auto Dynamic Estimation ---');
  const keConfig = getCountryFinancialConfig('Kenya');
  const keBreakdown = calculateFinancialBreakdown(100000, 'KES', null, 'Kenya');
  console.log('Country:', keConfig.countryName, 'Currency:', keConfig.currency);
  console.log('Gross:', keBreakdown.grossAmount);
  console.log('Platform Fee (2%):', keBreakdown.platformFee);
  console.log('Estimated Gateway Fee (3.5%):', keBreakdown.gatewayFee);
  console.log('DJ Net Earning:', keBreakdown.djNetEarning);
  console.log('Estimated Flag:', keBreakdown.isGatewayFeeEstimated);

  if (keBreakdown.platformFee !== 2000) throw new Error(`Expected platform fee 2000, got ${keBreakdown.platformFee}`);
  if (keBreakdown.gatewayFee !== 3500) throw new Error(`Expected gateway fee 3500, got ${keBreakdown.gatewayFee}`);
  if (keBreakdown.djNetEarning !== 94500) throw new Error(`Expected net 94500, got ${keBreakdown.djNetEarning}`);
  console.log('✅ Kenya Dynamic Estimation Passed!');

  console.log('\n--- ALL FINANCIAL ENGINE TESTS PASSED! ---');
}

runSimulation();

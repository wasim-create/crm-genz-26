import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, readContracts, readDispatches, readOrders, toISODate } from '../csv';

test('CSV: quotes, commas and new lines inside quotes', () => {
  assert.deepEqual(parseCSV('a,b\n"x, y","line1\nline2"\n'), [['a', 'b'], ['x, y', 'line1\nline2']]);
});

test('dates in the usual sheet formats', () => {
  assert.equal(toISODate('11/3/2026'), '2026-11-03');
  assert.equal(toISODate('2026-11-03'), '2026-11-03');
  assert.equal(toISODate('11/03/2026 10:22:33'), '2026-11-03');
  assert.equal(toISODate(''), '');
});

test('order tracking sheet: real column names, office rows by group id', () => {
  const csv = [
    'Order date,PO#,DEALER NAME,Quantity,Factory Invoice Amount,Invoice Status,unit cost,Website,Product specifications/notes,Proof Approval,ORDER needed by,Estimated Ship Date,Actual Ship Date,Tracking Number,Date Delivered,Comments/updates,Shipping details,Sales Rep,Order Status,Dealer ID',
    '9/1/2026,PO-1,Casco Bay Toyota,100,$235,Paid,2.35,,,Yes,10/27/2026,10/6/2026,10/6/2026,1Z1,10/25/2026,,,Kelley,Delivered,deal_1',
    '10/20/2026,PO-2,Lakeshore (office stock),300,,,,,,,12/15/2026,11/24/2026,,,,,,,In production,grp_lake'
  ].join('\n');
  const { rows, error } = readOrders(csv, 'grp_lake');
  assert.equal(error, '');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].dateDelivered, '2026-10-25');
  assert.equal(rows[0].status, 'Delivered');
  assert.equal(rows[1].toOffice, true);
});

test('contracts sheet: Product column ignored; missing columns reported', () => {
  const ok = readContracts('Name_Number,Contract Number,Effective_Date,Disbursement_Amount,Product,Dealer ID\nJo Smith - 1,KF1,11/2/2026,45,VSC,deal_1\n');
  assert.equal(ok.rows.length, 1);
  assert.equal(ok.rows[0].effectiveDate, '2026-11-02');
  assert.match(readContracts('Name_Number,Effective_Date\nx,1/1/2026').error, /Contract Number/);
});

test('group dispatch form: Dealership ID links the store', () => {
  const csv = 'Timestamp,Email Address,Sales Rep,Dealership Name,Shipping Address,Phone number (required),Attention (Contact name),Product,Quantity,Special Instructions,Purpose,Tracking#,Dealership ID,New Dealership Name,Entry Number\n11/2/2026 9:14:00,a@b.com,Kevin,Lakeshore Ford,1 Main,555,Pat,Keyfetch,25,,Restock,1Z9,deal_ls_ford,,12\n';
  const { rows } = readDispatches(csv);
  assert.deepEqual([rows[0].dealerId, rows[0].quantity, rows[0].timestamp], ['deal_ls_ford', 25, '2026-11-02']);
});
